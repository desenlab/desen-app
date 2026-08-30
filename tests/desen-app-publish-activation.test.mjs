import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import {
  DESEN_APP_PUBLISH_ACTIVATION_FOCUSED_TEST_DECLARATIONS,
  DESEN_APP_PUBLISH_ACTIVATION_PARENT_PINS,
  DESEN_APP_PUBLISH_ACTIVATION_ROOT_TEST_NAMES,
  DesenAppPublishActivationProofError,
  buildDesenAppPublishActivationEvidence,
  verifyDesenAppPublishActivationEvidence,
  verifyDesenAppPublishActivationSourcePolicy,
  writeDesenAppPublishActivationEvidence,
} from "../scripts/lib/desen-app-publish-activation-proof.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const SOURCE_PATHS = Object.freeze({
  authoringPreview: "apps/desen-app/src/authoring-preview.ts",
  authoringPublication: "apps/desen-app/src/authoring-publication.ts",
  publicationControls: "apps/desen-app/src/publication-controls.tsx",
  application: "apps/desen-app/src/application.tsx",
  applicationCss: "apps/desen-app/src/application.module.css",
  editorWebPublication: "packages/editor-web/src/local-bundle-channel-publication.ts",
  editorWebIndex: "packages/editor-web/src/index.ts",
  editorWebPublicPackageTypes: "packages/editor-web/test/public-package.types.mts",
});
const TEST_PATHS = Object.freeze({
  authoringPublication: "apps/desen-app/test/authoring-publication.test.ts",
  publicationControls: "apps/desen-app/test/publication-controls.test.tsx",
  publicationApplication: "apps/desen-app/test/publication-application.test.tsx",
  publicationActivationIntegration:
    "apps/desen-app/test/publication-activation-integration.test.ts",
  editorWebPublication: "packages/editor-web/test/local-bundle-channel-publication.test.ts",
  editorWebPublicPackage: "packages/editor-web/test/public-package.mjs",
});
const ROOT_PACKAGE_PATH = "package.json";
const APP_PACKAGE_PATH = "apps/desen-app/package.json";
const EDITOR_WEB_PACKAGE_PATH = "packages/editor-web/package.json";
const temporaryDirectories = [];
let sourcePolicyInput;
let testSources;
let parentArtifactBytes;
let packageSources;
let built;

function expectedError(code) {
  return (error) => error instanceof DesenAppPublishActivationProofError && error.code === code;
}

function replaceOnce(source, search, replacement) {
  const index = source.indexOf(search);
  assert.notEqual(index, -1, `Missing mutation marker ${search}`);
  return `${source.slice(0, index)}${replacement}${source.slice(index + search.length)}`;
}

function changedByte(bytes) {
  const changed = Buffer.from(bytes);
  changed[Math.floor(changed.byteLength / 2)] ^= 1;
  return changed;
}

function exactProofDocument(artifactSha256) {
  return Buffer.from(
    [
      "# Desen App publish and activation",
      "",
      "Task: M09-T14",
      "",
      "Gate: G09",
      "",
      "Status: DONE",
      "",
      "P-08: NOT_PROVEN",
      "PF-085: OPEN",
      "PF-086: OPEN",
      "PF-089: OPEN",
      "",
      `Final artifact: \`sha256:${artifactSha256}\``,
      "",
    ].join("\n"),
  );
}

async function temporaryDirectory(prefix) {
  const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), prefix)));
  temporaryDirectories.push(directory);
  return directory;
}

before(async () => {
  sourcePolicyInput = Object.fromEntries(
    await Promise.all(
      Object.entries(SOURCE_PATHS).map(async ([key, relativePath]) => [
        key,
        await readFile(path.join(ROOT, relativePath), "utf8"),
      ]),
    ),
  );
  testSources = new Map(
    await Promise.all(
      Object.values(TEST_PATHS).map(async (relativePath) => [
        relativePath,
        await readFile(path.join(ROOT, relativePath), "utf8"),
      ]),
    ),
  );
  parentArtifactBytes = new Map(
    await Promise.all(
      DESEN_APP_PUBLISH_ACTIVATION_PARENT_PINS.map(async ({ path: relativePath }) => [
        relativePath,
        await readFile(path.join(ROOT, relativePath)),
      ]),
    ),
  );
  packageSources = new Map(
    await Promise.all(
      [ROOT_PACKAGE_PATH, APP_PACKAGE_PATH, EDITOR_WEB_PACKAGE_PATH].map(async (relativePath) => [
        relativePath,
        await readFile(path.join(ROOT, relativePath)),
      ]),
    ),
  );
  built = await buildDesenAppPublishActivationEvidence();
});

after(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

test(DESEN_APP_PUBLISH_ACTIVATION_ROOT_TEST_NAMES[0], () => {
  assert.equal(built.artifact.schemaVersion, 1);
  assert.equal(built.artifact.proofId, "desen-app-publish-activation");
  assert.equal(built.artifact.profile, "desen.app.publish-activation-proof.v1");
  assert.equal(built.artifact.task, "M09-T14");
  assert.equal(built.artifact.gate, "G09");
  assert.equal(built.artifact.result, "PASS");
  assert.deepEqual(built.artifact.prerequisites, DESEN_APP_PUBLISH_ACTIVATION_PARENT_PINS);
  assert.equal(built.artifact.boundary.parentArtifacts, 9);
  assert.equal(built.artifact.claim.taskStatus, "DONE");
  assert.equal(built.artifact.claim.gateStatus, "DONE");
});

test(DESEN_APP_PUBLISH_ACTIVATION_ROOT_TEST_NAMES[1], () => {
  const source = verifyDesenAppPublishActivationSourcePolicy(sourcePolicyInput);
  assert.equal(source.publicPublisherRootOnly, true);
  assert.equal(source.savedAuthoredSourceOnly, true);
  assert.equal(source.publisherRerunBeforePublication, true);
  assert.equal(built.artifact.claim.publisherRerunFromSavedSource, true);
  assert.equal(built.artifact.claim.savedAuthoredSourceOnly, true);
});

test(DESEN_APP_PUBLISH_ACTIVATION_ROOT_TEST_NAMES[2], () => {
  const claim = built.artifact.claim;
  assert.equal(claim.scenarioPreviewPublished, false);
  assert.equal(claim.fixtureDataPublished, false);
  assert.equal(claim.operationInputOrSecretPublished, false);
  assert.equal(claim.rejectedDiagnosticsPublished, false);
  assert.equal(
    built.artifact.authority.source.transientScenarioFixtureOperationAndDiagnosticsExcluded,
    true,
  );
});

test(DESEN_APP_PUBLISH_ACTIVATION_ROOT_TEST_NAMES[3], () => {
  const claim = built.artifact.claim;
  assert.equal(claim.exactCanonicalBundleBytesStored, true);
  assert.equal(claim.fixedPreviewChannelCompareAndSet, true);
  assert.equal(claim.mutableChannelIsActivationAuthority, false);
  assert.equal(built.artifact.authority.source.editorWebUsesInjectedFetchOnly, true);
});

test(DESEN_APP_PUBLISH_ACTIVATION_ROOT_TEST_NAMES[4], () => {
  const claim = built.artifact.claim;
  assert.equal(claim.sourceGenerationDistinct, true);
  assert.equal(claim.channelGenerationDistinct, true);
  assert.equal(claim.durableActivationGenerationDistinct, true);
  assert.equal(claim.activeRevisionRequiresReferenceHostReceipt, true);
});

test(DESEN_APP_PUBLISH_ACTIVATION_ROOT_TEST_NAMES[5], () => {
  const claim = built.artifact.claim;
  assert.equal(claim.staleCompletionCanBecomeActive, false);
  assert.equal(claim.blindRetryAfterIndeterminate, false);
  assert.equal(claim.conflictActivatesCandidate, false);
  assert.equal(claim.lastKnownGoodActivationPreserved, true);
  assert.equal(built.artifact.authority.source.staleOperationFenced, true);
});

test(DESEN_APP_PUBLISH_ACTIVATION_ROOT_TEST_NAMES[6], () => {
  const source = built.artifact.authority.source;
  assert.equal(source.browserAppImportsNodeCompositionPackages, false);
  for (const key of [
    "authoringPreview",
    "authoringPublication",
    "publicationControls",
    "application",
  ]) {
    assert.equal(
      source.imports[key].some(
        (specifier) =>
          specifier.startsWith("node:") ||
          specifier === "@desen/control-plane-api" ||
          specifier === "@desen/reference-host-web-server",
      ),
      false,
    );
  }
});

test(DESEN_APP_PUBLISH_ACTIVATION_ROOT_TEST_NAMES[7], () => {
  assert.equal(built.artifact.tests.realPublicIntegration, true);
  assert.equal(built.artifact.claim.realPublicControlPlaneAndReferenceHostIntegration, true);
  assert.equal(built.artifact.boundary.realPublicIntegration, true);
});

test(DESEN_APP_PUBLISH_ACTIVATION_ROOT_TEST_NAMES[8], () => {
  assert.deepEqual(built.artifact.tests.focusedFiles, Object.values(TEST_PATHS));
  assert.equal(
    built.artifact.tests.focusedTestDeclarations,
    DESEN_APP_PUBLISH_ACTIVATION_FOCUSED_TEST_DECLARATIONS,
  );
  assert.deepEqual(built.artifact.tests.testDeclarationCounts, {
    [TEST_PATHS.authoringPublication]: 15,
    [TEST_PATHS.publicationControls]: 8,
    [TEST_PATHS.publicationApplication]: 6,
    [TEST_PATHS.publicationActivationIntegration]: 2,
    [TEST_PATHS.editorWebPublication]: 10,
    [TEST_PATHS.editorWebPublicPackage]: 4,
  });
  assert.deepEqual(
    built.artifact.tests.rootTestNames,
    DESEN_APP_PUBLISH_ACTIVATION_ROOT_TEST_NAMES,
  );
  assert.equal(built.artifact.tests.rootTestNames.length, 12);
  assert.equal(
    built.currentCompatibility.projection.tests.testDeclarationCounts[
      TEST_PATHS.publicationApplication
    ],
    6,
  );
  assert.deepEqual(built.currentCompatibility.publicationApplicationTimeoutSuccessor, {
    relationship: "EXACT_TEST_TIMEOUT_HARDENING_SUCCESSOR",
    path: TEST_PATHS.publicationApplication,
    timeoutMilliseconds: 10_000,
    frozenReceipt: {
      bytes: 24_485,
      sha256: "52e29b84745ff331556529612015b95b581bf3007118352ebad796ca9541e0e3",
    },
    currentReceipt: {
      bytes: 24_493,
      sha256: "5eba8a2b15cbcf992d0f04d0d7ad719c1a9fc42cdb66635ebc0eab679a221901",
    },
    exactFrozenProjection: true,
  });
});

test(DESEN_APP_PUBLISH_ACTIVATION_ROOT_TEST_NAMES[9], async () => {
  const second = await buildDesenAppPublishActivationEvidence();
  assert.equal(built.artifactBytes.byteLength, 24_763);
  assert.equal(
    built.artifactSha256,
    "6bd2db0ca490f1d0046f145da7c4b7e9b4b25ec0f8295a159529a0e66534b23b",
  );
  assert.deepEqual(second.artifact, built.artifact);
  assert.deepEqual(second.artifactBytes, built.artifactBytes);
  assert.equal(second.artifactSha256, built.artifactSha256);
  assert.equal(
    second.currentCompatibility.projectionSha256,
    built.currentCompatibility.projectionSha256,
  );
});

test(DESEN_APP_PUBLISH_ACTIVATION_ROOT_TEST_NAMES[10], async () => {
  assert.throws(
    () =>
      verifyDesenAppPublishActivationSourcePolicy({
        ...sourcePolicyInput,
        authoringPublication: replaceOnce(
          sourcePolicyInput.authoringPublication,
          "capturedSnapshot.canonicalDocument !== capturedSnapshot.canonicalSavedDocument",
          "false",
        ),
      }),
    expectedError("SOURCE_POLICY_VIOLATION"),
  );
  assert.throws(
    () =>
      verifyDesenAppPublishActivationSourcePolicy({
        ...sourcePolicyInput,
        application: `import { openLocalControlPlane } from "@desen/control-plane-api";\n${sourcePolicyInput.application}`,
      }),
    expectedError("SOURCE_POLICY_VIOLATION"),
  );
  const controlPlaneTestPath = TEST_PATHS.editorWebPublication;
  await assert.rejects(
    buildDesenAppPublishActivationEvidence({
      fileOverrides: new Map([
        [
          controlPlaneTestPath,
          Buffer.from(
            replaceOnce(
              testSources.get(controlPlaneTestPath),
              "returns the exact channel conflict without retrying or overwriting a concurrent winner",
              "silently overwrites a concurrent winner",
            ),
          ),
        ],
      ]),
    }),
    expectedError("TEST_POLICY_VIOLATION"),
  );
  const publicationApplicationTestPath = TEST_PATHS.publicationApplication;
  await assert.rejects(
    buildDesenAppPublishActivationEvidence({
      fileOverrides: new Map([
        [
          publicationApplicationTestPath,
          Buffer.from(
            replaceOnce(
              testSources.get(publicationApplicationTestPath),
              "  }, 10_000);\n",
              "  });\n",
            ),
          ),
        ],
      ]),
    }),
    expectedError("TEST_TIMEOUT_SUCCESSOR_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppPublishActivationEvidence({
      fileOverrides: new Map([
        [
          publicationApplicationTestPath,
          Buffer.from(
            replaceOnce(
              testSources.get(publicationApplicationTestPath),
              "  }, 10_000);\n",
              "  }, 20_000);\n",
            ),
          ),
        ],
      ]),
    }),
    expectedError("TEST_TIMEOUT_SUCCESSOR_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppPublishActivationEvidence({
      fileOverrides: new Map([
        [
          publicationApplicationTestPath,
          changedByte(Buffer.from(testSources.get(publicationApplicationTestPath))),
        ],
      ]),
    }),
    expectedError("TEST_TIMEOUT_SUCCESSOR_DRIFT"),
  );
  const editorPackage = JSON.parse(packageSources.get(EDITOR_WEB_PACKAGE_PATH).toString("utf8"));
  editorPackage.scripts["test:publication"] = "vitest run";
  await assert.rejects(
    buildDesenAppPublishActivationEvidence({
      fileOverrides: new Map([
        [EDITOR_WEB_PACKAGE_PATH, Buffer.from(`${JSON.stringify(editorPackage, null, 2)}\n`)],
      ]),
    }),
    expectedError("PACKAGE_POLICY_VIOLATION"),
  );
});

test(DESEN_APP_PUBLISH_ACTIVATION_ROOT_TEST_NAMES[11], async () => {
  const firstParent = DESEN_APP_PUBLISH_ACTIVATION_PARENT_PINS[0];
  await assert.rejects(
    buildDesenAppPublishActivationEvidence({
      fileOverrides: new Map([
        [firstParent.path, changedByte(parentArtifactBytes.get(firstParent.path))],
      ]),
    }),
    expectedError("PARENT_DRIFT"),
  );
  await assert.rejects(
    verifyDesenAppPublishActivationEvidence({
      artifactBytes: changedByte(built.artifactBytes),
      proofDocument: exactProofDocument(built.artifactSha256),
    }),
    expectedError("ARTIFACT_DRIFT"),
  );
  await assert.rejects(
    verifyDesenAppPublishActivationEvidence({
      artifactBytes: built.artifactBytes,
      proofDocument: Buffer.from("Task: M09-T14\nStatus: DONE\n"),
    }),
    expectedError("PROOF_DOCUMENT_DRIFT"),
  );

  const directory = await temporaryDirectory("desen-app-publish-activation-");
  const artifactPath = path.join(directory, "artifact.json");
  const written = await writeDesenAppPublishActivationEvidence({ artifactPath });
  assert.deepEqual(await readFile(artifactPath), built.artifactBytes);
  assert.equal(written.artifactSha256, built.artifactSha256);

  await writeFile(artifactPath, Buffer.from("last-known-good\n"));
  await assert.rejects(
    writeDesenAppPublishActivationEvidence({
      artifactPath,
      beforeAtomicRename: () => {
        throw new Error("injected interruption");
      },
    }),
    expectedError("ARTIFACT_WRITE_UNSAFE"),
  );
  assert.equal(await readFile(artifactPath, "utf8"), "last-known-good\n");

  const linkedArtifactPath = path.join(directory, "linked.json");
  await symlink(artifactPath, linkedArtifactPath);
  await assert.rejects(
    verifyDesenAppPublishActivationEvidence({
      artifactPath: linkedArtifactPath,
      proofDocument: exactProofDocument(built.artifactSha256),
    }),
    expectedError("AUTHORITY_UNSAFE"),
  );
  await assert.rejects(
    buildDesenAppPublishActivationEvidence({ unknown: true }),
    expectedError("OPTIONS_INVALID"),
  );
});
