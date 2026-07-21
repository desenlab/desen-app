import assert from "node:assert/strict";
import { lstat, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_STRUCTURAL_VALIDATOR_PATH,
  StructuralValidatorCodegenError,
  generateStructuralValidators,
  loadStructuralValidatorSchemaFiles,
  verifyStructuralValidatorArtifact,
  writeStructuralValidatorArtifact,
} from "../packages/validator/scripts/lib/structural-validator-codegen.mjs";
import {
  ProtocolStructuralValidationEvidenceError,
  buildProtocolStructuralValidationEvidence,
  verifyProtocolStructuralValidation,
  writeProtocolStructuralValidationEvidence,
} from "../scripts/lib/protocol-structural-validation-proof.mjs";

function hasEvidenceCode(expectedCode) {
  return (error) => {
    assert.ok(error instanceof ProtocolStructuralValidationEvidenceError);
    assert.equal(error.code, expectedCode);
    return true;
  };
}

function hasCodegenCode(expectedCode) {
  return (error) => {
    assert.ok(error instanceof StructuralValidatorCodegenError);
    assert.equal(error.code, expectedCode);
    return true;
  };
}

async function inventoryFiles(root, relativeDirectory = "") {
  const directory = path.join(root, relativeDirectory);
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name, "en"))) {
    const relativePath = relativeDirectory
      ? path.posix.join(relativeDirectory, entry.name)
      : entry.name;
    const absolutePath = path.join(root, ...relativePath.split("/"));
    const stats = await lstat(absolutePath);
    assert.equal(stats.isSymbolicLink(), false, relativePath);
    if (entry.isDirectory()) files.push(...(await inventoryFiles(root, relativePath)));
    else {
      assert.equal(entry.isFile(), true, relativePath);
      files.push(relativePath);
    }
  }
  return files;
}

test("accepts exact deterministic M02-T06 evidence", async () => {
  const result = await verifyProtocolStructuralValidation();

  assert.equal(result.result, "PASS");
  assert.equal(result.schemaRoots, 3);
  assert.equal(result.schemaFamilies, 61);
  assert.equal(result.schemaConstraints, 989);
  assert.equal(result.embeddedSchemas, 44);
  assert.equal(result.locatorFamilies, 13);
  assert.match(result.artifactSha256, /^[0-9a-f]{64}$/u);
});

test("two independent structural evidence builds are byte-identical", async () => {
  const first = await buildProtocolStructuralValidationEvidence();
  const second = await buildProtocolStructuralValidationEvidence();

  assert.equal(first.artifactBytes.toString("hex"), second.artifactBytes.toString("hex"));
  assert.equal(first.artifactSha256, second.artifactSha256);
});

test("rejects one-byte-tampered structural evidence", async () => {
  const pristine = await buildProtocolStructuralValidationEvidence();
  const tampered = Buffer.from(pristine.artifactBytes);
  tampered[tampered.length - 2] ^= 1;

  await assert.rejects(
    verifyProtocolStructuralValidation({ artifactBytes: tampered }),
    hasEvidenceCode("STRUCTURAL_ARTIFACT_DRIFT"),
  );
});

test("rejects reviewed M02-T06 trace ownership drift", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-structural-trace-"));
  context.after(() => rm(directory, { force: true, recursive: true }));
  const trace = JSON.parse(
    await readFile(
      new URL("../docs/proof/protocol-0.1.0-traceability.json", import.meta.url),
      "utf8",
    ),
  );
  const rule = trace.proseRules.find(({ id }) => id === "R-001");
  rule.owners = rule.owners.filter((owner) => owner !== "M02-T06");
  const tracePath = path.join(directory, "trace.json");
  await writeFile(tracePath, `${JSON.stringify(trace)}\n`);

  await assert.rejects(
    buildProtocolStructuralValidationEvidence({ tracePath, verifySnapshot: false }),
    hasEvidenceCode("STRUCTURAL_TRACE_DRIFT"),
  );
});

test("rejects generated-validator byte drift and canonical schema identity drift", async () => {
  const generated = await generateStructuralValidators();
  const tampered = Buffer.from(generated.outputBytes);
  tampered[tampered.length - 2] ^= 1;
  await assert.rejects(
    verifyStructuralValidatorArtifact({ outputBytes: tampered }),
    hasCodegenCode("STRUCTURAL_OUTPUT_DRIFT"),
  );

  const schemaFiles = await loadStructuralValidatorSchemaFiles();
  const sourceFile = "desen-source.schema.json";
  const changed = JSON.parse(Buffer.from(schemaFiles.get(sourceFile)).toString("utf8"));
  changed.$id = "https://invalid.example/source.schema.json";
  schemaFiles.set(sourceFile, `${JSON.stringify(changed)}\n`);
  await assert.rejects(
    generateStructuralValidators({ schemaFiles }),
    hasCodegenCode("STRUCTURAL_SCHEMA_IDENTITY_MISMATCH"),
  );
});

test("rejects external references before standalone generation", async () => {
  const schemaFiles = await loadStructuralValidatorSchemaFiles();
  const sourceFile = "desen-source.schema.json";
  const changed = JSON.parse(Buffer.from(schemaFiles.get(sourceFile)).toString("utf8"));
  changed.properties.entry = { $ref: "https://untrusted.example/entry.schema.json" };
  const changedBytes = Buffer.from(`${JSON.stringify(changed)}\n`);
  schemaFiles.set(sourceFile, changedBytes);

  await assert.rejects(
    generateStructuralValidators({ schemaFiles }),
    hasCodegenCode("STRUCTURAL_EXTERNAL_REFERENCE_FORBIDDEN"),
  );
});

test("built package validates all three frozen roots without source-only runtime imports", async () => {
  const validator = await import("../packages/validator/dist/index.js");
  const cases = [
    ["sign-in.source.json", validator.validateDesenSource],
    ["sign-in.bundle.json", validator.validateDesenBundle],
    ["web.catalog.json", validator.validateDesenCatalog],
  ];
  for (const [file, validate] of cases) {
    const document = JSON.parse(
      await readFile(
        new URL(
          `../packages/protocol/upstream/0.1.0/snapshot/conformance/valid/${file}`,
          import.meta.url,
        ),
        "utf8",
      ),
    );
    assert.equal(validate(document).valid, true, file);
  }

  const distRoot = fileURLToPath(new URL("../packages/validator/dist/", import.meta.url));
  const sourceModules = [
    "embedded-schema-validation",
    "generated/0.1.0/structural-validators",
    "index",
    "semantic-diagnostics",
    "semantic-validation",
    "standalone-runtime",
    "structural-diagnostics",
    "structural-validation",
    "uri-reference",
    "validation-internals",
  ];
  const expectedFiles = sourceModules
    .flatMap((module) =>
      [".d.ts", ".d.ts.map", ".js", ".js.map"].map((suffix) => `${module}${suffix}`),
    )
    .sort();
  const actualFiles = (await inventoryFiles(distRoot)).sort();
  assert.deepEqual(actualFiles, expectedFiles);

  const distSource = (
    await Promise.all(
      actualFiles
        .filter((file) => file.endsWith(".js"))
        .map((file) => readFile(path.join(distRoot, ...file.split("/")), "utf8")),
    )
  ).join("\n");
  assert.doesNotMatch(
    distSource,
    /packages\/protocol\/upstream|\/Users\/|from\s+["'][^"']*\.ts["']|from\s+["']node:|\brequire\s*\(|\beval\s*\(|\bnew\s+Function\b|\bimport\s*\(/u,
  );
});

test("writers reject symlink destinations", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-structural-symlink-"));
  context.after(() => rm(directory, { force: true, recursive: true }));
  const realTarget = path.join(directory, "real.ts");
  const linkedTarget = path.join(directory, "linked.ts");
  await writeFile(realTarget, "unchanged\n");
  await symlink(realTarget, linkedTarget);
  const generated = await generateStructuralValidators();

  await assert.rejects(
    writeStructuralValidatorArtifact(generated, {
      workspaceRoot: directory,
      outputPath: linkedTarget,
    }),
    hasCodegenCode("STRUCTURAL_OUTPUT_UNSUPPORTED_ENTRY"),
  );
  await assert.rejects(
    writeProtocolStructuralValidationEvidence({ artifactPath: linkedTarget }),
    hasEvidenceCode("STRUCTURAL_ARTIFACT_UNSUPPORTED_ENTRY"),
  );
  assert.equal(await readFile(realTarget, "utf8"), "unchanged\n");
  assert.equal(path.basename(DEFAULT_STRUCTURAL_VALIDATOR_PATH), "structural-validators.ts");
});
