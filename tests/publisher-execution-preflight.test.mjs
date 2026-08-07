import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
  assert.equal(first.artifactSha256, second.artifactSha256);
  assert.equal(
    first.artifactSha256,
    "6127bc2edd417975d4ae311b7934d9f85048928c84b1500ab50af8f42731ca67",
  );
  const compatibilitySources = [
    {
      path: "scripts/lib/reference-host-web-source-audit-proof.mjs",
      url: new URL("../scripts/lib/reference-host-web-source-audit-proof.mjs", import.meta.url),
      historicalBytes: 228_873,
      historicalSha256: "5f3ee52f48e19e8ccefc6f64b07e73e2fe04aa8edb17deb389f0bfbaf4def2d1",
      currentBytes: 263_857,
      currentSha256: "bb8f2dde9a4f63a848003cf7be7b69c1c9681992d56c9a254653dee8cbd7bbe3",
    },
    {
      path: "tests/reference-host-web-source-audit.test.mjs",
      url: new URL("./reference-host-web-source-audit.test.mjs", import.meta.url),
      historicalBytes: 70_344,
      historicalSha256: "268d8ccec567fb05f07a24746d227ddd76d672525768c2b92faff747a870575f",
      currentBytes: 89_057,
      currentSha256: "9442048b8b96f6aec06136b489dc08e01f159c46609eeb225aa2f949c98e3521",
    },
  ];
  for (const [index, compatibilitySource] of compatibilitySources.entries()) {
    const currentBytes = await readFile(compatibilitySource.url);
    assert.equal(currentBytes.byteLength, compatibilitySource.currentBytes);
    assert.equal(
      createHash("sha256").update(currentBytes).digest("hex"),
      compatibilitySource.currentSha256,
    );
    const approved = await buildPublisherExecutionPreflightEvidence({
      compatibilitySourceBytes: {
        [compatibilitySource.path]: currentBytes,
      },
    });
    assert.deepEqual(approved.artifactBytes, first.artifactBytes);
    assert.deepEqual(
      approved.artifact.trackedFiles.find(
        ({ path: trackedPath }) => trackedPath === compatibilitySource.path,
      ),
      {
        path: compatibilitySource.path,
        bytes: compatibilitySource.historicalBytes,
        sha256: compatibilitySource.historicalSha256,
      },
    );

    const oneByteDrift = Buffer.from(currentBytes);
    oneByteDrift[0] ^= 1;
    await assert.rejects(
      buildPublisherExecutionPreflightEvidence({
        compatibilitySourceBytes: {
          [compatibilitySource.path]: oneByteDrift,
        },
      }),
      hasCode("PUBLISHER_EXECUTION_COMPATIBILITY_DRIFT"),
    );
    await assert.rejects(
      buildPublisherExecutionPreflightEvidence({
        compatibilitySourceBytes: {
          [compatibilitySource.path]: Buffer.concat([
            currentBytes,
            Buffer.from("\n// unreviewed successor\n"),
          ]),
        },
      }),
      hasCode("PUBLISHER_EXECUTION_COMPATIBILITY_DRIFT"),
    );
    if (index === 0) {
      await assert.rejects(
        verifyPublisherExecutionPreflightEvidence({
          compatibilitySourceBytes: {
            [compatibilitySource.path]: currentBytes,
          },
        }),
        hasCode("PUBLISHER_EXECUTION_OPTIONS_INVALID"),
      );
      await assert.rejects(
        writePublisherExecutionPreflightEvidence({
          compatibilitySourceBytes: {
            [compatibilitySource.path]: currentBytes,
          },
        }),
        hasCode("PUBLISHER_EXECUTION_OPTIONS_INVALID"),
      );
    }
  }

  const poisonedPath = compatibilitySources[0].path;
  const approvedBytes = await readFile(compatibilitySources[0].url);
  const poisonedBytes = Buffer.from(approvedBytes);
  poisonedBytes[Math.floor(poisonedBytes.byteLength / 2)] ^= 1;
  const originalMapGet = Map.prototype.get;
  try {
    Map.prototype.get = function (key) {
      if (key === poisonedPath) return approvedBytes;
      return Reflect.apply(originalMapGet, this, [key]);
    };
    await assert.rejects(
      buildPublisherExecutionPreflightEvidence({
        compatibilitySourceBytes: { [poisonedPath]: poisonedBytes },
      }),
      hasCode("PUBLISHER_EXECUTION_COMPATIBILITY_DRIFT"),
    );
  } finally {
    Map.prototype.get = originalMapGet;
  }

  const originalObjectCreate = Object.create;
  let poisonedCreateCalls = 0;
  try {
    Object.create = function (prototype, ...arguments_) {
      if (prototype === null) {
        poisonedCreateCalls += 1;
        const injected = originalObjectCreate(null);
        injected.compatibilitySourceBytes = { [poisonedPath]: approvedBytes };
        return injected;
      }
      return originalObjectCreate(prototype, ...arguments_);
    };
    await assert.rejects(
      verifyPublisherExecutionPreflightEvidence({
        compatibilitySourceBytes: { [poisonedPath]: poisonedBytes },
      }),
      hasCode("PUBLISHER_EXECUTION_OPTIONS_INVALID"),
    );
    assert.equal(poisonedCreateCalls, 0);
  } finally {
    Object.create = originalObjectCreate;
  }

  const originalObjectFreeze = Object.freeze;
  let poisonedFreezeCalls = 0;
  try {
    Object.freeze = function (value) {
      const stack = new Error().stack ?? "";
      if (stack.includes("captureOptions") || stack.includes("captureCompatibilitySourceBytes")) {
        poisonedFreezeCalls += 1;
        return { compatibilitySourceBytes: { [poisonedPath]: approvedBytes } };
      }
      return originalObjectFreeze(value);
    };
    await assert.rejects(
      verifyPublisherExecutionPreflightEvidence({
        compatibilitySourceBytes: { [poisonedPath]: poisonedBytes },
      }),
      hasCode("PUBLISHER_EXECUTION_OPTIONS_INVALID"),
    );
    assert.equal(poisonedFreezeCalls, 0);
  } finally {
    Object.freeze = originalObjectFreeze;
  }

  assert.deepEqual(first.artifact.pipelineOwnership.exactPrecedence, [
    "capability-contracts",
    "state-and-control-flow",
    "binding-compatibility",
  ]);
  assert.deepEqual(first.artifact.claims.runtimeObligations.exactKinds, [
    "behavior-prop",
    "behavior-style-part-property",
    "component-command-input",
    "component-prop",
    "operation-input",
    "resource-input",
    "state-write",
    "style-part-property",
  ]);
  assert.match(first.artifact.nonclaims.join("\n"), /does not .*emit a Bundle/u);
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
