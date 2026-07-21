import assert from "node:assert/strict";
import { lstat, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  ProtocolSemanticFoundationEvidenceError,
  buildProtocolSemanticFoundationEvidence,
  verifyProtocolSemanticFoundation,
  writeProtocolSemanticFoundationEvidence,
} from "../scripts/lib/protocol-semantic-foundation-proof.mjs";

function hasEvidenceCode(expectedCode) {
  return (error) => {
    assert.ok(error instanceof ProtocolSemanticFoundationEvidenceError);
    assert.equal(error.code, expectedCode);
    return true;
  };
}

async function inventoryFiles(root, relativeDirectory = "") {
  const directory = path.join(root, ...relativeDirectory.split("/").filter(Boolean));
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) =>
    left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
  )) {
    const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
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

test("accepts exact deterministic M02-T07 semantic-foundation evidence", async () => {
  const result = await verifyProtocolSemanticFoundation();

  assert.equal(result.result, "PASS");
  assert.equal(result.schemaFamilies, 19);
  assert.equal(result.schemaConstraints, 201);
  assert.equal(result.semverGoldens, 28);
  assert.equal(result.officialSemanticInvalid, 2);
  assert.equal(result.scopeFenceAccepted, 3);
  assert.equal(result.examples, 5);
  assert.match(result.artifactSha256, /^[0-9a-f]{64}$/u);
});

test("two independent semantic-foundation evidence builds are byte-identical", async () => {
  const first = await buildProtocolSemanticFoundationEvidence();
  const second = await buildProtocolSemanticFoundationEvidence();

  assert.equal(first.artifactBytes.toString("hex"), second.artifactBytes.toString("hex"));
  assert.equal(first.artifactSha256, second.artifactSha256);
});

test("rejects one-byte-tampered semantic-foundation evidence", async () => {
  const pristine = await buildProtocolSemanticFoundationEvidence();
  const tampered = Buffer.from(pristine.artifactBytes);
  tampered[tampered.length - 2] ^= 1;

  await assert.rejects(
    verifyProtocolSemanticFoundation({ artifactBytes: tampered }),
    hasEvidenceCode("SEMANTIC_ARTIFACT_DRIFT"),
  );
});

test("rejects reviewed M02-T07 trace and BCP 14 ownership mutations", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-semantic-trace-"));
  context.after(() => rm(directory, { force: true, recursive: true }));

  const trace = JSON.parse(
    await readFile(
      new URL("../docs/proof/protocol-0.1.0-traceability.json", import.meta.url),
      "utf8",
    ),
  );
  const rule = trace.proseRules.find(({ id }) => id === "R-014");
  rule.owners = rule.owners.filter((owner) => owner !== "M02-T07");
  const tracePath = path.join(directory, "trace.json");
  await writeFile(tracePath, `${JSON.stringify(trace)}\n`);
  await assert.rejects(
    buildProtocolSemanticFoundationEvidence({ tracePath, verifySnapshot: false }),
    hasEvidenceCode("SEMANTIC_TRACE_DRIFT"),
  );

  const normative = await readFile(
    new URL("../docs/proof/NORMATIVE-COVERAGE.md", import.meta.url),
    "utf8",
  );
  const changedNormative = normative.replace(
    /^(\| N-006 \|.*?\| )M02-T07, M08-T10(\s+\|)/mu,
    "$1M08-T10$2",
  );
  assert.notEqual(changedNormative, normative);
  const normativeCoveragePath = path.join(directory, "normative.md");
  await writeFile(normativeCoveragePath, changedNormative);
  await assert.rejects(
    buildProtocolSemanticFoundationEvidence({
      normativeCoveragePath,
      verifySnapshot: false,
    }),
    hasEvidenceCode("SEMANTIC_NORMATIVE_COVERAGE_DRIFT"),
  );
});

test("rejects PF-009 and strict-SemVer implementation mutations", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-semantic-finding-"));
  context.after(() => rm(directory, { force: true, recursive: true }));
  const findings = await readFile(
    new URL("../docs/plan/PROTOCOL-FINDINGS.md", import.meta.url),
    "utf8",
  );
  const findingsPath = path.join(directory, "findings.md");
  await writeFile(
    findingsPath,
    findings.replace("run.desen.validator/INVALID_SEMVER", "run.desen.validator/INVALID_VERSION"),
  );
  await assert.rejects(
    buildProtocolSemanticFoundationEvidence({ findingsPath, verifySnapshot: false }),
    hasEvidenceCode("SEMANTIC_FINDING_DRIFT"),
  );

  const api = await import("../packages/validator/dist/index.js");
  await assert.rejects(
    buildProtocolSemanticFoundationEvidence({
      validatorApi: { ...api, isExactSemanticVersion: () => true },
      verifySnapshot: false,
    }),
    hasEvidenceCode("SEMANTIC_SEMVER_GOLDEN_MISMATCH"),
  );
});

test("rejects a tampered prerequisite M02-T06 evidence artifact", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-semantic-prerequisite-"));
  context.after(() => rm(directory, { force: true, recursive: true }));
  const structural = JSON.parse(
    await readFile(
      new URL("../docs/proof/artifacts/protocol-0.1.0-structural-validation.json", import.meta.url),
      "utf8",
    ),
  );
  structural.result = "FAIL";
  const structuralArtifactPath = path.join(directory, "structural.json");
  await writeFile(structuralArtifactPath, `${JSON.stringify(structural)}\n`);

  await assert.rejects(
    buildProtocolSemanticFoundationEvidence({
      structuralArtifactPath,
      verifySnapshot: false,
    }),
    hasEvidenceCode("SEMANTIC_STRUCTURAL_DEPENDENCY_DRIFT"),
  );
});

test("built distribution exposes the semantic API and exactly mirrors production sources", async () => {
  const api = await import("../packages/validator/dist/index.js");
  for (const exportName of [
    "isExactSemanticVersion",
    "validateDesenBundleSemantics",
    "validateDesenCatalogSemantics",
    "validateDesenCatalogSet",
    "validateDesenSemanticFoundation",
    "validateDesenSourceSemantics",
  ]) {
    assert.equal(typeof api[exportName], "function", exportName);
  }

  const sourceRoot = fileURLToPath(new URL("../packages/validator/src/", import.meta.url));
  const distRoot = fileURLToPath(new URL("../packages/validator/dist/", import.meta.url));
  const sourceFiles = (await inventoryFiles(sourceRoot)).filter((file) => file.endsWith(".ts"));
  const expectedDist = sourceFiles
    .flatMap((file) => {
      const module = file.slice(0, -3);
      return [".d.ts", ".d.ts.map", ".js", ".js.map"].map((suffix) => `${module}${suffix}`);
    })
    .sort();
  const actualDist = (await inventoryFiles(distRoot)).sort();
  assert.deepEqual(actualDist, expectedDist);

  const runtimeSource = (
    await Promise.all(
      actualDist
        .filter((file) => file.endsWith(".js"))
        .map((file) => readFile(path.join(distRoot, ...file.split("/")), "utf8")),
    )
  ).join("\n");
  assert.doesNotMatch(
    runtimeSource,
    /packages\/protocol\/upstream|\/Users\/|from\s+["'][^"']*\.ts["']|from\s+["']node:|from\s+["'](?:react|react-dom|next)(?:["'/])|\brequire\s*\(|\beval\s*\(|\bnew\s+Function\b|\bimport\s*\(|\bfetch\s*\(/u,
  );
});

test("semantic evidence records command wiring, extension opacity, and tracked hashes", async () => {
  const { artifact } = await buildProtocolSemanticFoundationEvidence();

  assert.deepEqual(artifact.verification.commands, [
    "pnpm generate:protocol-semantic-foundation",
    "pnpm verify:protocol-semantic-foundation",
    "pnpm test:protocol-semantic-foundation",
    "pnpm check",
  ]);
  assert.equal(artifact.extensionOpacity.nonNamespacedKeyAccepted, true);
  assert.equal(artifact.extensionOpacity.prototypePolluted, false);
  assert.equal(
    artifact.catalogRequirements.forgedCatalogSet[0].code,
    "run.desen.validator/CATALOG_REQUIREMENT_MISMATCH",
  );
  assert.deepEqual(Object.keys(artifact.catalogRequirements.sourceMismatches), [
    "id",
    "version",
    "target",
  ]);
  assert.deepEqual(Object.keys(artifact.catalogRequirements.bundleMismatches), [
    "id",
    "version",
    "target",
  ]);
  assert.deepEqual(artifact.catalogRequirements.undeclaredExtraCatalog, {
    acceptedInTrustedPool: true,
    ignoredWhenUnused: true,
    capabilityNotAuthorized: [
      {
        code: "UNKNOWN_CAPABILITY",
        pointer: "/surfaces/sign-in/root/slots/default/4/on/press/0/operation",
      },
    ],
  });
  assert.match(artifact.prerequisite.structuralValidation.sha256, /^[0-9a-f]{64}$/u);
  assert.ok(artifact.implementation.trackedFiles.length > 20);
  assert.ok(
    artifact.implementation.trackedFiles.every(({ sha256 }) => /^[0-9a-f]{64}$/u.test(sha256)),
  );
});

test("evidence writer rejects a symlink destination", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-semantic-symlink-"));
  context.after(() => rm(directory, { force: true, recursive: true }));
  const realTarget = path.join(directory, "real.json");
  const linkedTarget = path.join(directory, "linked.json");
  await writeFile(realTarget, "unchanged\n");
  await symlink(realTarget, linkedTarget);

  await assert.rejects(
    writeProtocolSemanticFoundationEvidence({ artifactPath: linkedTarget }),
    hasEvidenceCode("SEMANTIC_ARTIFACT_UNSUPPORTED_ENTRY"),
  );
  assert.equal(await readFile(realTarget, "utf8"), "unchanged\n");
});
