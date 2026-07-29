import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import * as publisherPublicApi from "../packages/publisher/dist/index.js";
import {
  PUBLISH_SOURCE_PRESERVATION_LIMITS,
  preflightPublishSourcePreservation,
} from "../packages/publisher/dist/source-preservation.js";
import {
  buildPublisherSourcePreservationEvidence,
  DEFAULT_PUBLISHER_SOURCE_PRESERVATION_ARTIFACT_PATH,
  PublisherSourcePreservationEvidenceError,
  verifyPublisherSourcePreservationEvidence,
  writePublisherSourcePreservationEvidence,
} from "../scripts/lib/publisher-source-preservation-proof.mjs";

function hasCode(code) {
  return (error) => {
    assert.ok(error instanceof PublisherSourcePreservationEvidenceError);
    assert.equal(error.code, code);
    return true;
  };
}

function clone(value) {
  return structuredClone(value);
}

function deepFreeze(value, seen = new Set()) {
  if (value === null || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

test("accepts real deterministic M06-T06 source-preservation evidence", async () => {
  const result = await verifyPublisherSourcePreservationEvidence();

  assert.equal(result.result, "PASS");
  assert.equal(result.prerequisitePins, 3);
  assert.equal(result.sharedDeclaredExtensionPoints, 17);
  assert.equal(result.reachableExtensionPointsPerDocument, 16);
  assert.equal(result.exercisedSourceExtensionKinds, 16);
  assert.equal(result.semanticArrayClasses, 8);
  assert.ok(result.sourceNodeTraceEntries >= 10);
  assert.equal(result.finiteLimitVectors, 6);
  assert.equal(result.tests.publisherRuntimeCases, 15);
  assert.equal(result.tests.compilerNegativeCases, 46);
  assert.equal(result.tests.rootMutationCases, 18);
  assert.equal(result.proofDocumentPinned, true);
});

test("two independent evidence builds are byte-identical and retain the exact strategy", async () => {
  const first = await buildPublisherSourcePreservationEvidence();
  const second = await buildPublisherSourcePreservationEvidence();

  assert.deepEqual(first.artifactBytes, second.artifactBytes);
  assert.equal(first.artifactSha256, second.artifactSha256);
  assert.equal(first.artifact.claims.sourceNodeTraceability.strategy, "unchanged-node-identifiers");
  assert.equal(first.artifact.frozenSchemas.extensions.exactSharedDeclaredPoints, 17);
  assert.equal(first.artifact.frozenSchemas.extensions.exactReachablePerDocument, 16);
  assert.equal(
    first.artifact.claims.deterministicEvidenceBuild
      .successorRegistrationSemanticallyAuthenticatedNotByteTracked,
    true,
  );
});

test("rejects one-byte artifact tampering", async () => {
  const built = await buildPublisherSourcePreservationEvidence();
  const tampered = Buffer.from(built.artifactBytes);
  tampered[tampered.length - 2] ^= 1;

  await assert.rejects(
    verifyPublisherSourcePreservationEvidence({
      artifactBytes: tampered,
      proofDocument: "",
    }),
    hasCode("PUBLISHER_PRESERVATION_ARTIFACT_DRIFT"),
  );
});

test("rejects one-byte drift in every exact prerequisite class", async () => {
  for (const relativePath of [
    "../docs/proof/artifacts/protocol-0.1.0-semantic-foundation.json",
    "../docs/proof/artifacts/runtime-react-0.1.0-reconciliation-diagnostics.json",
    "../docs/proof/artifacts/publisher-0.1.0-execution-preflight.json",
  ]) {
    const bytes = await readFile(new URL(relativePath, import.meta.url));
    const tampered = Buffer.from(bytes);
    tampered[0] ^= 1;
    await assert.rejects(
      buildPublisherSourcePreservationEvidence({
        prerequisiteBytes: { [relativePath.slice(3)]: tampered },
      }),
      hasCode("PUBLISHER_PRESERVATION_PREREQUISITE_DRIFT"),
    );
  }
});

test("rejects Source schema extension declaration drift", async () => {
  const sourceSchema = JSON.parse(
    await readFile(
      new URL(
        "../packages/protocol/upstream/0.1.0/snapshot/schemas/desen-source.schema.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  delete sourceSchema.$defs.repeatSpec.properties.extensions;

  await assert.rejects(
    buildPublisherSourcePreservationEvidence({ sourceSchema }),
    hasCode("PUBLISHER_PRESERVATION_SCHEMA_DRIFT"),
  );
});

test("rejects Bundle schema extension reachability drift", async () => {
  const bundleSchema = JSON.parse(
    await readFile(
      new URL(
        "../packages/protocol/upstream/0.1.0/snapshot/schemas/desen-bundle.schema.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  bundleSchema.properties.requires.properties.catalogs.items.$ref =
    "#/$defs/sourceCatalogRequirement";

  await assert.rejects(
    buildPublisherSourcePreservationEvidence({ bundleSchema }),
    hasCode("PUBLISHER_PRESERVATION_SCHEMA_DRIFT"),
  );
});

test("rejects a tracked Source/Catalog tuple mutation", async () => {
  const validSource = JSON.parse(
    await readFile(
      new URL(
        "../packages/protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  validSource.catalogs[0].version = "1.0.1";

  await assert.rejects(
    buildPublisherSourcePreservationEvidence({
      fixtures: {
        validSource,
        validCatalog: JSON.parse(
          await readFile(
            new URL(
              "../packages/protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json",
              import.meta.url,
            ),
            "utf8",
          ),
        ),
        sortableSource: JSON.parse(
          await readFile(
            new URL(
              "../packages/protocol/upstream/0.1.0/snapshot/examples/sortable-list.source.desen.json",
              import.meta.url,
            ),
            "utf8",
          ),
        ),
        storeMapSource: JSON.parse(
          await readFile(
            new URL(
              "../packages/protocol/upstream/0.1.0/snapshot/examples/store-map.source.desen.json",
              import.meta.url,
            ),
            "utf8",
          ),
        ),
      },
    }),
    hasCode("PUBLISHER_PRESERVATION_FIXTURE_DRIFT"),
  );
});

test("rejects a preflight that drops the exact root extension reference", async () => {
  function extensionDroppingPreflight(...args) {
    const result = preflightPublishSourcePreservation(...args);
    if (!Object.hasOwn(result, "preservationPrepared")) return result;
    const preservedDocument = { ...result.preservedDocument };
    delete preservedDocument.extensions;
    return deepFreeze({ ...result, preservedDocument });
  }

  await assert.rejects(
    buildPublisherSourcePreservationEvidence({ preflight: extensionDroppingPreflight }),
    hasCode("PUBLISHER_PRESERVATION_AUTHORITY_FAILED"),
  );
});

test("rejects a preflight that reorders a semantic Source array", async () => {
  function arrayReorderingPreflight(...args) {
    const result = preflightPublishSourcePreservation(...args);
    if (!Object.hasOwn(result, "preservationPrepared")) return result;
    const source = clone(result.source);
    source.catalogs.reverse();
    return deepFreeze({
      ...result,
      source,
      sourceCatalogRequirements: source.catalogs,
      preservedDocument: {
        ...result.preservedDocument,
        surfaces: source.surfaces,
        extensions: source.extensions,
      },
    });
  }

  await assert.rejects(
    buildPublisherSourcePreservationEvidence({ preflight: arrayReorderingPreflight }),
    hasCode("PUBLISHER_PRESERVATION_AUTHORITY_FAILED"),
  );
});

test("rejects a preflight that drops one source-node trace entry", async () => {
  function traceDroppingPreflight(...args) {
    const result = preflightPublishSourcePreservation(...args);
    if (!Object.hasOwn(result, "preservationPrepared")) return result;
    return deepFreeze({
      ...result,
      traceability: {
        ...result.traceability,
        sourceNodes: result.traceability.sourceNodes.slice(1),
      },
    });
  }

  await assert.rejects(
    buildPublisherSourcePreservationEvidence({ preflight: traceDroppingPreflight }),
    hasCode("PUBLISHER_PRESERVATION_TRACE_FAILED"),
  );
});

test("rejects a detached cumulative authority clone", async () => {
  function authorityCloningPreflight(...args) {
    const result = preflightPublishSourcePreservation(...args);
    if (!Object.hasOwn(result, "preservationPrepared")) return result;
    return deepFreeze({ ...result, preservedDocument: clone(result.preservedDocument) });
  }

  await assert.rejects(
    buildPublisherSourcePreservationEvidence({ preflight: authorityCloningPreflight }),
    hasCode("PUBLISHER_PRESERVATION_AUTHORITY_FAILED"),
  );
});

test("rejects a preflight that ignores exact trace ceilings", async () => {
  function unboundedPreflight(rawSource, candidates) {
    return preflightPublishSourcePreservation(
      rawSource,
      candidates,
      PUBLISH_SOURCE_PRESERVATION_LIMITS,
    );
  }

  await assert.rejects(
    buildPublisherSourcePreservationEvidence({ preflight: unboundedPreflight }),
    hasCode("PUBLISHER_PRESERVATION_FAILURE_VECTOR_FAILED"),
  );
});

test("rejects any failure that leaks partial preservation authority or a Bundle", async () => {
  function partialFailurePreflight(...args) {
    const result = preflightPublishSourcePreservation(...args);
    if (Object.hasOwn(result, "preservationPrepared")) return result;
    return deepFreeze({
      ...result,
      bundle: {},
      source: {},
      preservedDocument: {},
      sourceCatalogRequirements: [],
      traceability: { strategy: "unchanged-node-identifiers", sourceNodes: [] },
    });
  }

  await assert.rejects(
    buildPublisherSourcePreservationEvidence({ preflight: partialFailurePreflight }),
    hasCode("PUBLISHER_PRESERVATION_PARTIAL_FAILURE"),
  );
});

test("rejects root runtime, declaration, and package-subpath exposure", async () => {
  await assert.rejects(
    buildPublisherSourcePreservationEvidence({
      publicApi: {
        ...publisherPublicApi,
        preflightPublishSourcePreservation,
      },
    }),
    hasCode("PUBLISHER_PRESERVATION_PUBLIC_API_EXPOSED"),
  );

  const publisherPackage = JSON.parse(
    await readFile(new URL("../packages/publisher/package.json", import.meta.url), "utf8"),
  );
  publisherPackage.exports["./source-preservation"] = "./dist/source-preservation.js";
  await assert.rejects(
    buildPublisherSourcePreservationEvidence({ publisherPackage }),
    hasCode("PUBLISHER_PRESERVATION_PUBLIC_API_EXPOSED"),
  );
});

test("rejects target-specific source and declaration forms", async () => {
  const source = await readFile(
    new URL("../packages/publisher/src/source-preservation.ts", import.meta.url),
    "utf8",
  );
  await assert.rejects(
    buildPublisherSourcePreservationEvidence({
      preservationSource: `${source}\nvoid document.createElement("div");\n`,
    }),
    hasCode("PUBLISHER_PRESERVATION_TARGET_BOUNDARY_DRIFT"),
  );
  await assert.rejects(
    buildPublisherSourcePreservationEvidence({
      preservationSource: `${source}\ndeclare const ambientRuntimeProbe: unknown;\n`,
    }),
    hasCode("PUBLISHER_PRESERVATION_TARGET_BOUNDARY_DRIFT"),
  );

  const declaration = await readFile(
    new URL("../packages/publisher/dist/source-preservation.d.ts", import.meta.url),
    "utf8",
  );
  await assert.rejects(
    buildPublisherSourcePreservationEvidence({
      preservationDeclaration: `${declaration}\ndeclare const window: unknown;\n`,
    }),
    hasCode("PUBLISHER_PRESERVATION_TARGET_BOUNDARY_DRIFT"),
  );
  await assert.rejects(
    buildPublisherSourcePreservationEvidence({
      preservationDeclaration: `${declaration}\ndeclare function ambientRuntimeProbe(): void;\n`,
    }),
    hasCode("PUBLISHER_PRESERVATION_TARGET_BOUNDARY_DRIFT"),
  );
  await assert.rejects(
    buildPublisherSourcePreservationEvidence({
      preservationDeclaration: `${declaration}\ndeclare global { const ambientRuntimeProbe: unknown; }\n`,
    }),
    hasCode("PUBLISHER_PRESERVATION_TARGET_BOUNDARY_DRIFT"),
  );
});

test("rejects selected package, root, and single-pass CI registration drift", async () => {
  const publisherPackage = JSON.parse(
    await readFile(new URL("../packages/publisher/package.json", import.meta.url), "utf8"),
  );
  publisherPackage.scripts["test:source-preservation"] =
    "vitest run test/execution-preflight.test.ts";
  await assert.rejects(
    buildPublisherSourcePreservationEvidence({ publisherPackage }),
    hasCode("PUBLISHER_PRESERVATION_CI_REGISTRATION_DRIFT"),
  );

  const rootPackage = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );
  rootPackage.scripts["verify:publisher-source-preservation"] =
    "node scripts/verify-publisher-source-preservation.mjs";
  await assert.rejects(
    buildPublisherSourcePreservationEvidence({ rootPackage }),
    hasCode("PUBLISHER_PRESERVATION_CI_REGISTRATION_DRIFT"),
  );

  const ciSource = await readFile(
    new URL("../scripts/run-ci-quality-gate.mjs", import.meta.url),
    "utf8",
  );
  await assert.rejects(
    buildPublisherSourcePreservationEvidence({
      ciSource: ciSource.replace(
        '"tests/publisher-source-preservation.test.mjs"',
        '"tests/publisher-execution-preflight.test.mjs"',
      ),
    }),
    hasCode("PUBLISHER_PRESERVATION_CI_REGISTRATION_DRIFT"),
  );
});

test("rejects a missing, stale, duplicated, or pending proof-document artifact pin", async () => {
  const built = await buildPublisherSourcePreservationEvidence();
  const validDocument = [
    "# Proof",
    "",
    "`docs/proof/artifacts/publisher-0.1.0-source-preservation.json`",
    "",
    `\`sha256:${built.artifactSha256}\``,
    "",
  ].join("\n");

  for (const proofDocument of [
    validDocument.replace("publisher-0.1.0-source-preservation.json", "wrong.json"),
    validDocument.replace(built.artifactSha256, "0".repeat(64)),
    `${validDocument}\n\`sha256:${built.artifactSha256}\`\n`,
    `${validDocument}\nPENDING_M06_T06_ARTIFACT_SHA256\n`,
  ]) {
    await assert.rejects(
      verifyPublisherSourcePreservationEvidence({
        artifactBytes: built.artifactBytes,
        proofDocument,
      }),
      hasCode("PUBLISHER_PRESERVATION_PROOF_DOCUMENT_DRIFT"),
    );
  }
});

test("atomic evidence writer rejects destination symlinks and pre-rename byte tampering", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-source-preservation-proof-"));
  t.after(() => rm(directory, { force: true, recursive: true }));

  const symlinkTarget = path.join(directory, "target.json");
  const symlinkPath = path.join(directory, "artifact-link.json");
  await writeFile(symlinkTarget, "{}\n");
  await symlink(symlinkTarget, symlinkPath);
  await assert.rejects(
    writePublisherSourcePreservationEvidence({ artifactPath: symlinkPath }),
    TypeError,
  );

  const tamperedPath = path.join(directory, "tampered.json");
  await assert.rejects(
    writePublisherSourcePreservationEvidence({
      artifactPath: tamperedPath,
      beforeAtomicRename: async ({ temporaryPath }) => {
        await writeFile(temporaryPath, "tampered\n");
      },
    }),
    TypeError,
  );
  await assert.rejects(readFile(tamperedPath), { code: "ENOENT" });

  assert.equal(
    path.basename(DEFAULT_PUBLISHER_SOURCE_PRESERVATION_ARTIFACT_PATH),
    "publisher-0.1.0-source-preservation.json",
  );
});
