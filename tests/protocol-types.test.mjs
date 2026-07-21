import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  PROTOCOL_TYPE_SCHEMA_SPECS,
  ProtocolTypesError,
  generateProtocolTypes,
  loadProtocolTypeSchemaFiles,
  verifyProtocolTypes,
  writeProtocolTypeArtifacts,
} from "../scripts/lib/protocol-types.mjs";

const canonicalSchemaFiles = await loadProtocolTypeSchemaFiles();
const canonicalGeneration = await generateProtocolTypes({ schemaFiles: canonicalSchemaFiles });

function cloneByteMap(source) {
  return new Map([...source].map(([key, value]) => [key, Buffer.from(value)]));
}

function hasProtocolTypesCode(expectedCode) {
  return (error) => {
    assert.ok(error instanceof ProtocolTypesError);
    assert.equal(error.code, expectedCode);
    return true;
  };
}

async function createTemporaryOutputs(testContext) {
  const outputRoot = await mkdtemp(path.join(tmpdir(), "desen-protocol-types-"));
  for (const [fileName, bytes] of canonicalGeneration.outputs) {
    await writeFile(path.join(outputRoot, fileName), bytes);
  }
  testContext.after(() => rm(outputRoot, { force: true, recursive: true }));
  return outputRoot;
}

test("accepts exact deterministic declarations and evidence", async () => {
  const result = await verifyProtocolTypes();

  assert.equal(result.result, "PASS");
  assert.equal(result.schemaRoots, 3);
  assert.equal(result.generatedRoots, 3);
  assert.deepEqual(result.publicExports, ["DesenSource", "DesenBundle", "DesenCatalog"]);
});

test("two independent generations produce identical bytes", async () => {
  const first = await generateProtocolTypes({ schemaFiles: cloneByteMap(canonicalSchemaFiles) });
  const second = await generateProtocolTypes({ schemaFiles: cloneByteMap(canonicalSchemaFiles) });

  assert.equal(first.artifactBytes.toString("hex"), second.artifactBytes.toString("hex"));
  for (const spec of PROTOCOL_TYPE_SCHEMA_SPECS) {
    assert.equal(
      first.outputs.get(spec.outputFile).toString("hex"),
      second.outputs.get(spec.outputFile).toString("hex"),
    );
  }
});

test("preserves reviewed recursive and required-union projections", () => {
  const source = canonicalGeneration.outputs.get("desen-source.generated.ts").toString("utf8");
  const catalog = canonicalGeneration.outputs.get("desen-catalog.generated.ts").toString("utf8");

  assert.match(source, /\| ValueSpec\[\]/);
  assert.doesNotMatch(source, /undefined\[\]/);
  assert.match(source, /export interface PredicateSpec \{/);
  assert.match(source, /export type VariantSpec =[\s\S]*?props:/);
  assert.match(source, /export type VariantSpec =[\s\S]*?style:/);
  assert.match(catalog, /attachTo:[\s\S]*?capabilities: string\[\]/);
  assert.match(catalog, /attachTo:[\s\S]*?categories: string\[\]/);
});

test("schema content drift makes tracked output stale", async () => {
  const schemaFiles = cloneByteMap(canonicalSchemaFiles);
  const source = JSON.parse(schemaFiles.get("desen-source.schema.json").toString("utf8"));
  source.properties.kind.const = "desen.source.changed";
  schemaFiles.set("desen-source.schema.json", Buffer.from(`${JSON.stringify(source)}\n`));

  await assert.rejects(
    verifyProtocolTypes({
      schemaFiles,
      generatedFiles: cloneByteMap(canonicalGeneration.outputs),
      verifyArtifact: false,
      verifySnapshot: false,
    }),
    hasProtocolTypesCode("TYPE_OUTPUT_DRIFT"),
  );
});

test("rejects wrong schema inventory, identity, and reviewed projection shape", async () => {
  const missingSchema = cloneByteMap(canonicalSchemaFiles);
  missingSchema.delete("desen-catalog.schema.json");
  await assert.rejects(
    generateProtocolTypes({ schemaFiles: missingSchema }),
    hasProtocolTypesCode("TYPE_SCHEMA_INVENTORY_MISMATCH"),
  );

  const wrongIdentity = cloneByteMap(canonicalSchemaFiles);
  const bundle = JSON.parse(wrongIdentity.get("desen-bundle.schema.json").toString("utf8"));
  bundle.$id = "https://invalid.example/desen-bundle.schema.json";
  wrongIdentity.set("desen-bundle.schema.json", Buffer.from(JSON.stringify(bundle)));
  await assert.rejects(
    generateProtocolTypes({ schemaFiles: wrongIdentity }),
    hasProtocolTypesCode("TYPE_SCHEMA_ID_MISMATCH"),
  );

  const changedProjection = cloneByteMap(canonicalSchemaFiles);
  const catalog = JSON.parse(changedProjection.get("desen-catalog.schema.json").toString("utf8"));
  catalog.$defs.behaviorCapability.properties.attachTo.anyOf.pop();
  changedProjection.set("desen-catalog.schema.json", Buffer.from(JSON.stringify(catalog)));
  await assert.rejects(
    generateProtocolTypes({ schemaFiles: changedProjection }),
    hasProtocolTypesCode("TYPE_PROJECTION_INVARIANT"),
  );
});

test("rejects changed, missing, and unexpected generated declarations", async () => {
  const changed = cloneByteMap(canonicalGeneration.outputs);
  changed.set(
    "desen-source.generated.ts",
    Buffer.concat([changed.get("desen-source.generated.ts"), Buffer.from("\n")]),
  );
  await assert.rejects(
    verifyProtocolTypes({
      generatedFiles: changed,
      verifyArtifact: false,
      verifySnapshot: false,
    }),
    hasProtocolTypesCode("TYPE_OUTPUT_DRIFT"),
  );

  const missing = cloneByteMap(canonicalGeneration.outputs);
  missing.delete("desen-bundle.generated.ts");
  await assert.rejects(
    verifyProtocolTypes({
      generatedFiles: missing,
      verifyArtifact: false,
      verifySnapshot: false,
    }),
    hasProtocolTypesCode("TYPE_OUTPUT_INVENTORY_MISMATCH"),
  );

  const unexpected = cloneByteMap(canonicalGeneration.outputs);
  unexpected.set("stale.generated.ts", Buffer.from("export {};\n"));
  await assert.rejects(
    verifyProtocolTypes({
      generatedFiles: unexpected,
      verifyArtifact: false,
      verifySnapshot: false,
    }),
    hasProtocolTypesCode("TYPE_OUTPUT_INVENTORY_MISMATCH"),
  );
});

test("rejects a symlink in the tracked generated inventory", async (testContext) => {
  const outputRoot = await createTemporaryOutputs(testContext);
  const sourcePath = path.join(outputRoot, "desen-source.generated.ts");
  await unlink(sourcePath);
  await symlink("desen-bundle.generated.ts", sourcePath);

  await assert.rejects(
    verifyProtocolTypes({
      outputRoot,
      verifyArtifact: false,
      verifySnapshot: false,
    }),
    hasProtocolTypesCode("TYPE_OUTPUT_UNSUPPORTED_ENTRY"),
  );
});

test("writer rejects symlinked output directory chains before writing", async (testContext) => {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "desen-type-writer-workspace-"));
  const externalRoot = await mkdtemp(path.join(tmpdir(), "desen-type-writer-external-"));
  testContext.after(() => rm(workspaceRoot, { force: true, recursive: true }));
  testContext.after(() => rm(externalRoot, { force: true, recursive: true }));

  const symlinkedOutputRoot = path.join(workspaceRoot, "generated");
  await symlink(externalRoot, symlinkedOutputRoot);
  await assert.rejects(
    writeProtocolTypeArtifacts(canonicalGeneration, {
      workspaceRoot,
      outputRoot: symlinkedOutputRoot,
      artifactPath: path.join(workspaceRoot, "evidence", "types.json"),
    }),
    hasProtocolTypesCode("TYPE_OUTPUT_UNSUPPORTED_ENTRY"),
  );
  assert.deepEqual(await readdir(externalRoot), []);

  await unlink(symlinkedOutputRoot);
  const symlinkedArtifactRoot = path.join(workspaceRoot, "evidence");
  await symlink(externalRoot, symlinkedArtifactRoot);
  await assert.rejects(
    writeProtocolTypeArtifacts(canonicalGeneration, {
      workspaceRoot,
      outputRoot: path.join(workspaceRoot, "generated"),
      artifactPath: path.join(symlinkedArtifactRoot, "types.json"),
    }),
    hasProtocolTypesCode("TYPE_OUTPUT_UNSUPPORTED_ENTRY"),
  );
  assert.deepEqual(await readdir(externalRoot), []);
});

test("rejects stale or tampered evidence", async () => {
  const tamperedArtifact = Buffer.concat([canonicalGeneration.artifactBytes, Buffer.from("\n")]);
  await assert.rejects(
    verifyProtocolTypes({
      generatedFiles: cloneByteMap(canonicalGeneration.outputs),
      artifactBytes: tamperedArtifact,
      verifySnapshot: false,
    }),
    hasProtocolTypesCode("TYPE_ARTIFACT_DRIFT"),
  );
});

test("keeps the package public surface curated to three documented root types", async () => {
  const source = await readFile(
    new URL("../packages/protocol/src/index.ts", import.meta.url),
    "utf8",
  );
  const exports = [...source.matchAll(/export type ([A-Za-z][A-Za-z0-9]*)\s*=/g)].map(
    (match) => match[1],
  );

  assert.deepEqual(exports, ["DesenSource", "DesenBundle", "DesenCatalog"]);
  assert.doesNotMatch(source, /export\s+\*/);
  for (const exportName of exports) {
    assert.match(source, new RegExp(`/\\*\\*[\\s\\S]*?\\*/\\nexport type ${exportName} =`));
  }
});
