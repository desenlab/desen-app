import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import * as publisherPublicApi from "../packages/publisher/dist/index.js";
import {
  PUBLISH_EXECUTION_PREFLIGHT_LIMITS,
  preflightPublishExecution,
} from "../packages/publisher/dist/execution-preflight.js";
import * as validatorPublicApi from "../packages/validator/dist/index.js";
import {
  buildPublisherExecutionPreflightEvidence,
  DEFAULT_PUBLISHER_EXECUTION_PREFLIGHT_ARTIFACT_PATH,
  PublisherExecutionPreflightEvidenceError,
  verifyPublisherExecutionPreflightEvidence,
  writePublisherExecutionPreflightEvidence,
} from "../scripts/lib/publisher-execution-preflight-proof.mjs";

const FIXTURE_PATHS = {
  validSource: "../packages/protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json",
  validCatalog: "../packages/protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json",
  exampleSortable:
    "../packages/protocol/upstream/0.1.0/snapshot/examples/sortable-list.source.desen.json",
  exampleStoreMap:
    "../packages/protocol/upstream/0.1.0/snapshot/examples/store-map.source.desen.json",
  exampleCatalog: "../packages/protocol/upstream/0.1.0/snapshot/examples/catalog.web.example.json",
};

function hasCode(code) {
  return (error) => {
    assert.ok(error instanceof PublisherExecutionPreflightEvidenceError);
    assert.equal(error.code, code);
    return true;
  };
}

async function readFixtures() {
  return Object.fromEntries(
    await Promise.all(
      Object.entries(FIXTURE_PATHS).map(async ([key, relativePath]) => [
        key,
        JSON.parse(await readFile(new URL(relativePath, import.meta.url), "utf8")),
      ]),
    ),
  );
}

function deepFreeze(value, seen = new Set()) {
  if (value === null || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

test("accepts real deterministic M06-T05 execution-preflight evidence", async () => {
  const result = await verifyPublisherExecutionPreflightEvidence();

  assert.equal(result.result, "PASS");
  assert.equal(result.prerequisitePins, 3);
  assert.equal(result.acceptedFixtures, 4);
  assert.equal(result.obligationKinds, 8);
  assert.equal(result.stageFailureVectors, 6);
  assert.equal(result.simultaneousPrecedenceVectors, 2);
  assert.equal(result.finiteLimitVectors, 6);
  assert.equal(result.proofDocumentPinned, true);
  assert.equal(result.tests.publisherRuntimeCases, 14);
  assert.ok(result.tests.compilerNegativeCases >= 20);
  assert.ok(result.tests.validatorBindingCases > 20);
  assert.ok(result.tests.validatorExecutionCases > 20);
  assert.equal(result.tests.rootMutationCases, 15);
});

test("two independent evidence builds are byte-identical and retain stages 8, 9, and 10", async () => {
  const first = await buildPublisherExecutionPreflightEvidence();
  const second = await buildPublisherExecutionPreflightEvidence();
  assert.deepEqual(first.artifactBytes, second.artifactBytes);
  assert.equal(
    first.artifactSha256,
    "6127bc2edd417975d4ae311b7934d9f85048928c84b1500ab50af8f42731ca67",
  );
  assert.deepEqual(first.artifact.pipelineOwnership.exactPrecedence, [
    "capability-contracts",
    "state-and-control-flow",
    "binding-compatibility",
  ]);
  assert.equal(first.artifact.claims.runtimeObligations.exactKinds.length, 8);
  assert.match(first.artifact.nonclaims.join("\\n"), /does not .*emit a Bundle/u);
});

test("rejects one-byte artifact tampering", async () => {
  const built = await buildPublisherExecutionPreflightEvidence();
  const tampered = Buffer.from(built.artifactBytes);
  tampered[tampered.length - 2] ^= 1;

  await assert.rejects(
    verifyPublisherExecutionPreflightEvidence({
      artifactBytes: tampered,
      proofDocument: "",
    }),
    hasCode("PUBLISHER_EXECUTION_ARTIFACT_DRIFT"),
  );
});

test("rejects one-byte drift in every exact prerequisite class", async () => {
  for (const relativePath of [
    "../docs/proof/artifacts/protocol-0.1.0-binding-contracts.json",
    "../docs/proof/artifacts/protocol-0.1.0-execution-contracts.json",
    "../docs/proof/artifacts/publisher-0.1.0-capability-preflight.json",
  ]) {
    const url = new URL(relativePath, import.meta.url);
    const bytes = await readFile(url);
    const tampered = Buffer.from(bytes);
    tampered[0] ^= 1;
    const workspacePath = relativePath.slice(3);
    await assert.rejects(
      buildPublisherExecutionPreflightEvidence({
        prerequisiteBytes: { [workspacePath]: tampered },
      }),
      hasCode("PUBLISHER_EXECUTION_PREREQUISITE_DRIFT"),
    );
  }
});

test("rejects Source and Catalog tuple mutation instead of changing the proof corpus", async () => {
  const fixtures = await readFixtures();
  fixtures.exampleSortable.catalogs[0].version = "1.0.1";

  await assert.rejects(
    buildPublisherExecutionPreflightEvidence({ fixtures }),
    hasCode("PUBLISHER_EXECUTION_FIXTURE_DRIFT"),
  );
});

test("rejects a public Validator prerequisite that bypasses one emission-site phase", async () => {
  const validatorApi = {
    ...validatorPublicApi,
    validateDesenPreparedSourcePublicationContracts(source, catalogSet) {
      if (source?.surfaces?.["sign-in"]?.root?.when?.op === "gt") {
        return deepFreeze({
          valid: true,
          target: "source-publication-contracts",
          value: source,
          diagnostics: [],
          obligations: [],
        });
      }
      return validatorPublicApi.validateDesenPreparedSourcePublicationContracts(source, catalogSet);
    },
  };

  await assert.rejects(
    buildPublisherExecutionPreflightEvidence({ validatorApi }),
    hasCode("PUBLISHER_EXECUTION_VALIDATOR_PREREQUISITE_FAILED"),
  );
});

test("rejects a Publisher preflight that drops one required runtime obligation", async () => {
  function obligationDroppingPreflight(...args) {
    const result = preflightPublishExecution(...args);
    if (!Object.hasOwn(result, "executionPreflighted")) return result;
    return deepFreeze({ ...result, obligations: result.obligations.slice(1) });
  }

  await assert.rejects(
    buildPublisherExecutionPreflightEvidence({ preflight: obligationDroppingPreflight }),
    hasCode("PUBLISHER_EXECUTION_OBLIGATION_FAILED"),
  );
});

test("rejects a detached Source clone that cannot retain exact runtime authority", async () => {
  function clonedSourcePreflight(...args) {
    const result = preflightPublishExecution(...args);
    if (!Object.hasOwn(result, "executionPreflighted")) return result;
    return deepFreeze({ ...result, source: JSON.parse(JSON.stringify(result.source)) });
  }

  await assert.rejects(
    buildPublisherExecutionPreflightEvidence({ preflight: clonedSourcePreflight }),
    hasCode("PUBLISHER_EXECUTION_AUTHORITY_FAILED"),
  );
});

test("rejects Publisher stage remapping instead of preserving Validator phase provenance", async () => {
  function remappedPreflight(...args) {
    const result = preflightPublishExecution(...args);
    if (result?.ok !== false || result.stage !== "state-and-control-flow") return result;
    return deepFreeze({
      ...result,
      stage: "binding-compatibility",
      diagnostics: result.diagnostics.map((diagnostic) => ({
        ...diagnostic,
        stage: "binding-compatibility",
      })),
    });
  }

  await assert.rejects(
    buildPublisherExecutionPreflightEvidence({ preflight: remappedPreflight }),
    hasCode("PUBLISHER_EXECUTION_STAGE_FAILED"),
  );
});

test("rejects any failure that leaks partial Source, Catalog authority, obligations, or Bundle", async () => {
  function partialFailurePreflight(...args) {
    const result = preflightPublishExecution(...args);
    if (Object.hasOwn(result, "executionPreflighted")) return result;
    return deepFreeze({
      ...result,
      bundle: {},
      source: {},
      catalogSet: [],
      packages: [],
      requirementPackageIndexes: [],
      obligations: [],
    });
  }

  await assert.rejects(
    buildPublisherExecutionPreflightEvidence({ preflight: partialFailurePreflight }),
    hasCode("PUBLISHER_EXECUTION_PARTIAL_FAILURE"),
  );
});

test("rejects a preflight that ignores exact obligation ceilings", async () => {
  function unboundedPreflight(rawSource, candidates) {
    return preflightPublishExecution(rawSource, candidates, PUBLISH_EXECUTION_PREFLIGHT_LIMITS);
  }

  await assert.rejects(
    buildPublisherExecutionPreflightEvidence({ preflight: unboundedPreflight }),
    hasCode("PUBLISHER_EXECUTION_LIMIT_VECTOR_FAILED"),
  );
});

test("rejects root preflight exposure and a package export subpath", async () => {
  await assert.rejects(
    buildPublisherExecutionPreflightEvidence({
      publicApi: {
        ...publisherPublicApi,
        preflightPublishExecution,
      },
    }),
    hasCode("PUBLISHER_EXECUTION_PUBLIC_API_EXPOSED"),
  );

  const publisherPackage = JSON.parse(
    await readFile(new URL("../packages/publisher/package.json", import.meta.url), "utf8"),
  );
  publisherPackage.exports["./execution-preflight"] = "./dist/execution-preflight.js";
  await assert.rejects(
    buildPublisherExecutionPreflightEvidence({ publisherPackage }),
    hasCode("PUBLISHER_EXECUTION_PUBLIC_API_EXPOSED"),
  );
});

test("rejects target-specific source and declaration forms", async () => {
  const source = await readFile(
    new URL("../packages/publisher/src/execution-preflight.ts", import.meta.url),
    "utf8",
  );
  await assert.rejects(
    buildPublisherExecutionPreflightEvidence({
      executionSource: `${source}\nvoid document.createElement("div");\n`,
    }),
    hasCode("PUBLISHER_EXECUTION_TARGET_BOUNDARY_DRIFT"),
  );

  const declaration = await readFile(
    new URL("../packages/publisher/dist/execution-preflight.d.ts", import.meta.url),
    "utf8",
  );
  await assert.rejects(
    buildPublisherExecutionPreflightEvidence({
      executionDeclaration: `${declaration}\ndeclare const window: unknown;\n`,
    }),
    hasCode("PUBLISHER_EXECUTION_TARGET_BOUNDARY_DRIFT"),
  );
});

test("rejects a missing, stale, duplicated, or pending proof-document artifact pin", async () => {
  const built = await buildPublisherExecutionPreflightEvidence();
  const validDocument = [
    "# Proof",
    "",
    "`docs/proof/artifacts/publisher-0.1.0-execution-preflight.json`",
    "",
    `\`sha256:${built.artifactSha256}\``,
    "",
  ].join("\n");

  for (const proofDocument of [
    validDocument.replace("publisher-0.1.0-execution-preflight.json", "wrong.json"),
    validDocument.replace(built.artifactSha256, "0".repeat(64)),
    `${validDocument}\n\`sha256:${built.artifactSha256}\`\n`,
    `${validDocument}\nPENDING_M06_T05_ARTIFACT_SHA256\n`,
  ]) {
    await assert.rejects(
      verifyPublisherExecutionPreflightEvidence({
        artifactBytes: built.artifactBytes,
        proofDocument,
      }),
      hasCode("PUBLISHER_EXECUTION_PROOF_DOCUMENT_DRIFT"),
    );
  }
});

test("atomic evidence writer rejects destination symlinks and pre-rename byte tampering", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-execution-preflight-proof-"));
  t.after(() => rm(directory, { force: true, recursive: true }));

  const symlinkTarget = path.join(directory, "target.json");
  const symlinkPath = path.join(directory, "artifact-link.json");
  await writeFile(symlinkTarget, "{}\n");
  await symlink(symlinkTarget, symlinkPath);
  await assert.rejects(
    writePublisherExecutionPreflightEvidence({ artifactPath: symlinkPath }),
    TypeError,
  );

  const tamperedPath = path.join(directory, "tampered.json");
  await assert.rejects(
    writePublisherExecutionPreflightEvidence({
      artifactPath: tamperedPath,
      beforeAtomicRename: async ({ temporaryPath }) => {
        await writeFile(temporaryPath, "tampered\n");
      },
    }),
    TypeError,
  );
  await assert.rejects(readFile(tamperedPath), { code: "ENOENT" });

  assert.equal(
    path.basename(DEFAULT_PUBLISHER_EXECUTION_PREFLIGHT_ARTIFACT_PATH),
    "publisher-0.1.0-execution-preflight.json",
  );
});
