import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { link, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import validSource from "../packages/protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json" with { type: "json" };
import * as editorCore from "../packages/editor-core/dist/index.js";
import {
  DEFAULT_EDITOR_CORE_SOURCE_DOCUMENT_ARTIFACT_PATH,
  EDITOR_CORE_SOURCE_DOCUMENT_PREREQUISITE_PIN,
  EDITOR_CORE_SOURCE_DOCUMENT_ROOT_TEST_NAMES,
  EditorCoreSourceDocumentProofError,
  buildEditorCoreSourceDocumentEvidence,
  verifyEditorCoreSourceDocumentEvidence,
  writeEditorCoreSourceDocumentEvidence,
} from "../scripts/lib/editor-core-source-document-proof.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const ARTIFACT = "docs/proof/artifacts/editor-core-0.1.0-source-document.json";
const PREREQUISITE = "docs/proof/baselines/i07-04-affected-selector-promotion.json";
const DEPENDENCY_AUTHORITY = "docs/proof/artifacts/protocol-0.1.0-execution-contracts.json";
const PACKAGE_TEST = "packages/editor-core/test/source-document.test.ts";
const AUTHORING_ROUND_TRIP_TEST = "packages/editor-core/test/authoring-round-trip.test.ts";
const AUTHORING_ROUND_TRIP_TYPES = "packages/editor-core/test/authoring-round-trip.types.ts";
const PERSISTENCE_SOURCE = "packages/editor-core/src/persistence.ts";
const PERSISTENCE_TEST = "packages/editor-core/test/persistence.test.ts";
const PERSISTENCE_TYPES = "packages/editor-core/test/persistence.types.ts";
const TERMINAL_INTEGRATION_TEST = "packages/editor-core/test/terminal-integration.test.ts";
const PUBLIC_TEST = "packages/editor-core/test/public-package.mjs";
const ROOT_TEST = "tests/editor-core-source-document.test.mjs";
const BASELINE_RUNTIME_PATHS = [
  "packages/validator/dist/component-contract-validation.js",
  "packages/validator/dist/embedded-schema-validation.js",
  "packages/validator/dist/generated/0.1.0/structural-validators.js",
  "packages/validator/dist/standalone-runtime.js",
  "packages/validator/dist/structural-diagnostics.js",
  "packages/validator/dist/uri-reference.js",
  "packages/validator/dist/validation-internals.js",
  "packages/protocol/dist/canonicalization.js",
  "packages/protocol/dist/diagnostics.js",
  "packages/protocol/dist/index.js",
  "packages/protocol/dist/json-pointer.js",
];
const SUCCESSOR_RUNTIME_RECEIPTS = [
  {
    path: "packages/validator/dist/binding-contract-validation.js",
    bytes: 46_895,
    sha256: "82d2d9ae24ca0283c95c914025e4f708bad7f114879460b5931a25459dc2ad19",
  },
  {
    path: "packages/validator/dist/execution-contract-validation.js",
    bytes: 76_906,
    sha256: "2d84bfa71a348bffe94c8c91711b7a5ea683bd89d8e5a0398e00bda3d63fda4f",
  },
  {
    path: "packages/validator/dist/index.js",
    bytes: 1_965,
    sha256: "5009c889ea5eeab437f902057cdee9f84ba39c437239f1f5d222ad2ba5e05ec8",
  },
  {
    path: "packages/validator/dist/interaction-contract-validation.js",
    bytes: 49_673,
    sha256: "431b473b6aa82a5af848faf74cf5459aa4375e2678f936e51c733212c42af331",
  },
  {
    path: "packages/validator/dist/schema-instance-validation.js",
    bytes: 86_247,
    sha256: "169312f4eb2c304104c4321b57d0b9f07bfe88285753fd1c3f8d569e544901ca",
  },
  {
    path: "packages/validator/dist/semantic-diagnostics.js",
    bytes: 6_799,
    sha256: "f2fa2b0d7a1bb5a06d57e577ec0b1922d5b924cefca5c65314a55108f123c09b",
  },
  {
    path: "packages/validator/dist/semantic-validation.js",
    bytes: 27_165,
    sha256: "1d89f973a8a768771aabf203e55bc9816e1b06365553604c5808318abc483368",
  },
  {
    path: "packages/validator/dist/structural-validation.js",
    bytes: 6_241,
    sha256: "316c1ea98f96ada1cad6a5cb398538fac5c10e94a03e0efa318f07c8d0459c28",
  },
];

let built;
const temporaryDirectories = [];

function cloneFixture() {
  return structuredClone(validSource);
}

function expectedError(code) {
  return (error) => error instanceof EditorCoreSourceDocumentProofError && error.code === code;
}

function changedByte(bytes) {
  const changed = Buffer.from(bytes);
  changed[Math.floor(changed.byteLength / 2)] ^= 1;
  return changed;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function exactProofDocument(artifactSha256) {
  return `# Test proof\n\n## Result\n\nArtifact: \`${ARTIFACT}\`\n\nFinal receipt: \`sha256:${artifactSha256}\`\n`;
}

function replaceLast(source, search, replacement) {
  const index = source.lastIndexOf(search);
  assert.notEqual(index, -1);
  return `${source.slice(0, index)}${replacement}${source.slice(index + search.length)}`;
}

function replaceRegistrationCallbackWithNoop(source, marker, nextMarker = undefined) {
  const registrationStart = source.indexOf(marker);
  const registrationEnd =
    nextMarker === undefined ? source.length : source.indexOf(nextMarker, registrationStart + 1);
  assert.notEqual(registrationStart, -1);
  assert.notEqual(registrationEnd, -1);
  const callbackStart = source.indexOf("() => {", registrationStart);
  const callbackEnd = source.lastIndexOf("});", registrationEnd);
  assert.ok(callbackStart >= registrationStart && callbackStart < registrationEnd);
  assert.ok(callbackEnd > callbackStart);
  return `${source.slice(0, callbackStart)}() => { void 0; }${source.slice(callbackEnd + 1)}`;
}

async function workspaceBytes(relativePath) {
  return readFile(path.join(ROOT, relativePath));
}

async function temporaryDirectory(prefix) {
  const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), prefix)));
  temporaryDirectories.push(directory);
  return directory;
}

function assertDeepFrozen(value, visited = new Set()) {
  if (
    value === null ||
    typeof value !== "object" ||
    ArrayBuffer.isView(value) ||
    visited.has(value)
  ) {
    return;
  }
  visited.add(value);
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) assertDeepFrozen(child, visited);
}

function runtimeThatFreezesRejectedCaller(vector) {
  return {
    createDesenEditorDocument(input) {
      const authoring =
        input !== null && typeof input === "object"
          ? Object.getOwnPropertyDescriptor(input, "authoring")?.value
          : undefined;
      const authoringDescriptor =
        authoring !== null && typeof authoring === "object"
          ? Object.getOwnPropertyDescriptor(authoring, vector)
          : undefined;
      const rootDescriptor =
        input !== null && typeof input === "object"
          ? Object.getOwnPropertyDescriptor(input, vector)
          : undefined;
      const matches =
        vector === "selection"
          ? authoringDescriptor !== undefined && !("value" in authoringDescriptor)
          : vector === "executable"
            ? typeof authoringDescriptor?.value === "function"
            : typeof rootDescriptor?.value === "function";
      if (matches) Object.freeze(input);
      return editorCore.createDesenEditorDocument(input);
    },
  };
}

function runtimeThatMutatesInvalidRootDiagnostic(project) {
  return {
    createDesenEditorDocument(input) {
      const result = editorCore.createDesenEditorDocument(input);
      if (result.ok || input?.kind !== "desen.bundle") return result;
      return project(result);
    },
  };
}

function runtimeThatMutatesRejectedCallerGraph() {
  return {
    createDesenEditorDocument(input) {
      const result = editorCore.createDesenEditorDocument(input);
      if (input?.kind === "desen.bundle") {
        Object.defineProperty(input, "proofMutation", {
          value: true,
          configurable: true,
        });
      }
      return result;
    },
  };
}

before(async () => {
  built = await buildEditorCoreSourceDocumentEvidence();
});

after(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

test("[authority] builds final M08-T01 evidence from the exact G07/I07-04 prerequisite", async () => {
  assert.equal(
    built.artifactSha256,
    "aaa3a2447b71361361f471a822bba78e90a3f97f493b23ad3314f51c62ad4025",
  );
  assert.equal(built.artifactBytes.byteLength, 23_270);
  assert.equal(built.artifact.schemaVersion, 1);
  assert.equal(built.artifact.proofId, "editor-core-source-document");
  assert.equal(built.artifact.profile, "desen.editor-core.source-document-proof.v1");
  assert.equal(built.artifact.task, "M08-T01");
  assert.equal(built.artifact.result, "PASS");
  assert.deepEqual(built.artifact.prerequisite, {
    ...built.artifact.prerequisite,
    ...EDITOR_CORE_SOURCE_DOCUMENT_PREREQUISITE_PIN,
    result: "PASS",
    status: "DONE",
  });
  assert.equal(built.artifact.prerequisite.authority.observations, 20);
  assert.equal(built.artifact.prerequisite.authority.falseNegatives, 0);
  assert.equal(built.artifact.prerequisite.authority.promotion, "PROMOTION_AUTHORIZED");
  assert.equal(built.artifact.prerequisite.authority.cutover, "HOSTED_CUTOVER_VERIFIED");
  assert.equal(built.artifact.prerequisite.authority.cleanup.result, "PASS");
  assert.equal(built.artifact.prerequisite.authority.main.result, "PASS");
  assert.equal(built.artifact.prerequisite.authority.affectedCanary.freshExecution, true);
  assert.equal(built.artifact.prerequisite.authority.affectedCanary.cachedSuccessRead, false);
  assert.equal(built.artifact.prerequisite.authority.infrastructureDebt.status, "CLOSED");
  assert.equal(built.artifact.claim.taskStatus, "DONE");
  assert.equal(built.artifact.claim.prerequisiteGate, "G07");
  assert.equal(built.artifact.claim.prerequisiteStatus, "DONE");
  assert.deepEqual(built.artifact.executionAuthority, {
    dependencyAuthority: {
      composition: "M02_T11_BASELINE_PLUS_M08_READER_SUCCESSORS",
      baseline: {
        path: DEPENDENCY_AUTHORITY,
        bytes: 60_075,
        sha256: "f7dc050b8a9e4e5d9ec2531312ca3ad68d0d03c46bda5c44ebf930884554f505",
        profile: "desen-execution-contract-validation-v1",
        task: "M02-T11",
        result: "PASS",
        provenance: "PINNED_M02_T11_ARTIFACT",
        runtimeReceipts: 11,
        runtimePaths: BASELINE_RUNTIME_PATHS,
      },
      successor: {
        provenance: "M08_PROOF_READER_CHECKPOINT",
        runtimeReceipts: 8,
        receipts: SUCCESSOR_RUNTIME_RECEIPTS,
      },
      coverage: {
        runtimeReceipts: 19,
        disjoint: true,
        exactCurrentBytes: true,
      },
    },
    editorPackagePath: "packages/editor-core/package.json",
    editorDistributionPaths: [
      "packages/editor-core/dist/index.js",
      "packages/editor-core/dist/source-document.js",
    ],
    runtimeDependencyPaths: [
      "packages/validator/package.json",
      "packages/protocol/package.json",
      "packages/validator/dist/binding-contract-validation.js",
      "packages/validator/dist/component-contract-validation.js",
      "packages/validator/dist/embedded-schema-validation.js",
      "packages/validator/dist/execution-contract-validation.js",
      "packages/validator/dist/generated/0.1.0/structural-validators.js",
      "packages/validator/dist/index.js",
      "packages/validator/dist/interaction-contract-validation.js",
      "packages/validator/dist/schema-instance-validation.js",
      "packages/validator/dist/semantic-diagnostics.js",
      "packages/validator/dist/semantic-validation.js",
      "packages/validator/dist/standalone-runtime.js",
      "packages/validator/dist/structural-diagnostics.js",
      "packages/validator/dist/structural-validation.js",
      "packages/validator/dist/uri-reference.js",
      "packages/validator/dist/validation-internals.js",
      "packages/protocol/dist/canonicalization.js",
      "packages/protocol/dist/diagnostics.js",
      "packages/protocol/dist/index.js",
      "packages/protocol/dist/json-pointer.js",
    ],
    receiptedRuntimeFiles: 24,
    proofOwnedHarnessFiles: 1,
    exactReceiptedBytes: true,
    runtimeOverridesCanPass: false,
    fileOverridesCanPass: false,
  });
  assert.equal(built.artifact.evidence.tests.packageRuntimeCases, 7);
  assert.equal(built.artifact.evidence.tests.publicRuntimeContractCases, 10);
  assert.equal(built.artifact.evidence.tests.publicProofCoreCases, 7);
  assert.equal(built.artifact.evidence.tests.rootProofCases, 13);
  assert.deepEqual(
    built.artifact.evidence.tests.rootTestNames,
    EDITOR_CORE_SOURCE_DOCUMENT_ROOT_TEST_NAMES,
  );
  assert.equal(built.artifact.evidence.trackedFiles.length, 47);
  assert.equal(built.artifact.boundary.runtimeClosure.receiptedRuntimeFiles, 24);
  assert.equal(built.artifact.boundary.runtimeClosure.proofOwnedHarnessFiles, 1);
  assert.equal(built.artifact.boundary.runtimeClosure.modules.length, 21);
  assert.equal(built.artifact.boundary.runtimeClosure.unknownStaticEsmEdges, 0);
  assert.deepEqual(built.currentCompatibility.boundary.runtimeExports, [
    "createDesenEditorDocument",
  ]);
  assert.deepEqual(built.currentCompatibility.boundary.additiveRuntimeExports, [
    "clearDesenEditorNodeCondition",
    "createDesenEditorContinuousValidator",
    "createDesenEditorPersistencePort",
    "deleteDesenEditorAction",
    "deleteDesenEditorEventHandler",
    "deleteDesenEditorNode",
    "deleteDesenEditorOwnerProp",
    "deleteDesenEditorOwnerStyleProperty",
    "deleteDesenEditorResourceInput",
    "deleteDesenEditorStateDeclaration",
    "deleteDesenEditorVariant",
    "deleteDesenEditorVariantProp",
    "deleteDesenEditorVariantStyleProperty",
    "insertDesenEditorAction",
    "insertDesenEditorEventHandler",
    "insertDesenEditorNode",
    "insertDesenEditorStateDeclaration",
    "insertDesenEditorVariant",
    "moveDesenEditorNode",
    "reorderDesenEditorAction",
    "reorderDesenEditorNode",
    "reorderDesenEditorVariant",
    "replaceDesenEditorAction",
    "setDesenEditorNodeCondition",
    "setDesenEditorNodeRepeatItems",
    "setDesenEditorNodeRepeatKey",
    "setDesenEditorOwnerProp",
    "setDesenEditorOwnerStyleProperty",
    "setDesenEditorResourceInput",
    "setDesenEditorStateInitial",
    "setDesenEditorStateSchema",
    "setDesenEditorVariantCondition",
    "setDesenEditorVariantProp",
    "setDesenEditorVariantStyleProperty",
  ]);
  assert.equal(
    built.currentCompatibility.boundary.currentPackageTypeExports.includes(
      "DesenEditorNodeInsertResult",
    ),
    true,
  );
  assert.equal(
    built.currentCompatibility.boundary.currentPackageTypeExports.includes(
      "DesenEditorContinuousValidationReport",
    ),
    true,
  );
  assert.deepEqual(built.currentCompatibility.boundary.additiveSuccessor, {
    task: "M08-T08",
    sourcePath: PERSISTENCE_SOURCE,
    runtimePath: "packages/editor-core/dist/persistence.js",
    declarationPath: "packages/editor-core/dist/persistence.d.ts",
    focusedTestPath: PERSISTENCE_TEST,
    focusedTypesPath: PERSISTENCE_TYPES,
    runtimeExports: ["createDesenEditorPersistencePort"],
    typeExports: [
      "DesenEditorPersistenceAdapter",
      "DesenEditorPersistenceAdapterFailureReason",
      "DesenEditorPersistenceAdapterReadResult",
      "DesenEditorPersistenceAdapterSourceRecord",
      "DesenEditorPersistenceAdapterWriteRequest",
      "DesenEditorPersistenceAdapterWriteResult",
      "DesenEditorPersistenceDiagnostic",
      "DesenEditorPersistenceDiagnosticCode",
      "DesenEditorPersistencePort",
      "DesenEditorSourceOpenResult",
      "DesenEditorSourceOpenSuccess",
      "DesenEditorSourceSaveRequest",
      "DesenEditorSourceSaveResult",
    ],
    publicDeclarations: 14,
    tsdocDeclarations: 14,
    publicRuntimeCasesAdded: 3,
    publicCompilerNegativeAssertionsAdded: 21,
  });
  assert.deepEqual(built.currentCompatibility.boundary.proofOnlySuccessor, {
    task: "M08-T07",
    runtimeExports: [],
    typeExports: [],
    focusedTestPath: AUTHORING_ROUND_TRIP_TEST,
    focusedTypesPath: AUTHORING_ROUND_TRIP_TYPES,
    publicRuntimeCasesAdded: 2,
    publicCompilerNegativeAssertionsAdded: 6,
  });
  assert.deepEqual(built.currentCompatibility.boundary.terminalProofSuccessor, {
    task: "M08-T10",
    authority: "PROOF_ONLY_CURRENT_TERMINAL_SUCCESSOR",
    focusedTestPath: TERMINAL_INTEGRATION_TEST,
    runtimeExportsAdded: 0,
    typeExportsAdded: 0,
    focusedRuntimeCases: 4,
    publicRuntimeCasesAdded: 0,
    publicCompilerNegativeAssertionsAdded: 0,
  });
  assert.deepEqual(built.currentCompatibility.boundary.additiveSuccessors.at(-1), {
    task: "M08-T09",
    sourcePath: "packages/editor-core/src/continuous-validation.ts",
    runtimePath: "packages/editor-core/dist/continuous-validation.js",
    declarationPath: "packages/editor-core/dist/continuous-validation.d.ts",
    runtimeExports: ["createDesenEditorContinuousValidator"],
    typeExports: [
      "DesenEditorContinuousValidationReport",
      "DesenEditorContinuousValidator",
      "DesenEditorContinuousValidatorCreationFailure",
      "DesenEditorContinuousValidatorCreationResult",
      "DesenEditorContinuousValidatorCreationSuccess",
      "DesenEditorInvalidSubjectMapping",
    ],
    publicDeclarations: 7,
    tsdocDeclarations: 7,
  });
  assert.equal(built.currentCompatibility.boundary.additiveSuccessors.length, 6);
  assert.equal(built.currentCompatibility.boundary.currentPackageRuntimeExports.length, 35);
  assert.equal(built.currentCompatibility.boundary.currentPackageTypeExports.length, 88);
  assert.equal(built.currentCompatibility.evidence.tests.persistenceRuntimeCases, 10);
  assert.equal(built.currentCompatibility.evidence.tests.persistenceCompilerNegativeCases, 21);
  assert.equal(built.currentCompatibility.evidence.tests.publicRuntimeContractCases, 43);
  assert.equal(built.currentCompatibility.evidence.tests.publicCompilerNegativeCases, 102);
  assert.equal(built.currentCompatibility.evidence.tests.terminalIntegrationRuntimeCases, 4);
  assert.equal(built.currentCompatibility.evidence.trackedFiles.length, 62);
  assert.equal(
    built.currentCompatibility.boundary.packageScripts.includes("test:continuous-validation"),
    true,
  );
  assert.equal(
    built.currentCompatibility.boundary.packageScripts.includes("test:terminal-integration"),
    true,
  );
  for (const receipt of SUCCESSOR_RUNTIME_RECEIPTS) {
    const bytes = await workspaceBytes(receipt.path);
    assert.equal(bytes.byteLength, receipt.bytes);
    assert.equal(sha256(bytes), receipt.sha256);
  }
  assert.deepEqual(
    built.artifact.evidence.trackedFiles
      .map((receipt) => receipt.path)
      .filter((receiptPath) => receiptPath.includes("tsconfig")),
    [
      "packages/editor-core/tsconfig.build.json",
      "packages/editor-core/tsconfig.json",
      "packages/editor-core/tsconfig.public-package.json",
      "tsconfig.base.json",
    ],
  );
});

test("[determinism] two final evidence builds are byte-identical", async () => {
  const first = await buildEditorCoreSourceDocumentEvidence();
  const second = await buildEditorCoreSourceDocumentEvidence();
  assert.deepEqual(first.artifactBytes, second.artifactBytes);
  assert.equal(first.artifactSha256, second.artifactSha256);
  assert.deepEqual(first.artifact, second.artifact);
});

test("[prerequisite] rejects changed I07-04 bytes and incomplete hosted closure", async () => {
  const [bytes, dependencyAuthorityBytes] = await Promise.all([
    workspaceBytes(PREREQUISITE),
    workspaceBytes(DEPENDENCY_AUTHORITY),
  ]);
  const incomplete = JSON.parse(bytes.toString("utf8"));
  incomplete.cutover.status = "PENDING_HOSTED_CUTOVER";
  incomplete.cutover.cleanup = null;
  incomplete.cutover.main = null;
  incomplete.cutover.affectedCanary = null;

  for (const prerequisiteBytes of [
    changedByte(bytes),
    Buffer.from(`${JSON.stringify(incomplete, null, 2)}\n`),
  ]) {
    await assert.rejects(
      buildEditorCoreSourceDocumentEvidence({ prerequisiteBytes }),
      expectedError("EDITOR_SOURCE_DOCUMENT_PREREQUISITE_DRIFT"),
    );
  }
  const receiptMutation = JSON.parse(dependencyAuthorityBytes.toString("utf8"));
  const baselineReceipt = receiptMutation.implementation.trackedFiles.find(
    (receipt) => receipt.path === BASELINE_RUNTIME_PATHS[0],
  );
  assert.ok(baselineReceipt);
  baselineReceipt.sha256 = "0".repeat(64);
  for (const mutatedDependencyAuthorityBytes of [
    changedByte(dependencyAuthorityBytes),
    Buffer.from(`${JSON.stringify(receiptMutation, null, 2)}\n`),
  ]) {
    await assert.rejects(
      buildEditorCoreSourceDocumentEvidence({
        dependencyAuthorityBytes: mutatedDependencyAuthorityBytes,
      }),
      expectedError("EDITOR_SOURCE_DOCUMENT_RUNTIME_AUTHORITY_DRIFT"),
    );
  }
  const exactAuthorityBuild = await buildEditorCoreSourceDocumentEvidence({
    dependencyAuthorityBytes,
  });
  assert.deepEqual(exactAuthorityBuild.artifactBytes, built.artifactBytes);
});

test("[behavior] rejects wrappers, mutation authority, partial failure, and semantic overreach", async () => {
  const runtimes = [
    {
      createDesenEditorDocument(input) {
        const result = editorCore.createDesenEditorDocument(input);
        if (!result.ok) return result;
        return Object.freeze({
          ok: true,
          document: Object.freeze({ source: result.document }),
          diagnostics: Object.freeze([]),
        });
      },
    },
    {
      createDesenEditorDocument(input) {
        const result = editorCore.createDesenEditorDocument(input);
        if (!result.ok) return result;
        return { ok: true, document: cloneFixture(), diagnostics: [] };
      },
    },
    {
      createDesenEditorDocument(input) {
        if (input?.kind !== "desen.source") return editorCore.createDesenEditorDocument(input);
        Object.freeze(input);
        return Object.freeze({ ok: true, document: input, diagnostics: Object.freeze([]) });
      },
    },
    {
      createDesenEditorDocument(input) {
        const result = editorCore.createDesenEditorDocument(input);
        return result.ok ? result : Object.freeze({ ...result, document: Object.freeze({}) });
      },
    },
    {
      createDesenEditorDocument(input) {
        if (input?.surfaces?.["sign-in"]?.root?.use === "com.example.unresolved/Unknown") {
          return Object.freeze({
            ok: false,
            diagnostics: Object.freeze([
              Object.freeze({
                code: "SCHEMA_INVALID",
                message: "Capability is unresolved.",
                pointer: "/surfaces/sign-in/root/use",
              }),
            ]),
          });
        }
        return editorCore.createDesenEditorDocument(input);
      },
    },
    runtimeThatMutatesInvalidRootDiagnostic((result) =>
      Object.freeze({
        ok: false,
        diagnostics: Object.freeze([
          Object.freeze({ ...result.diagnostics[0], classification: "semantic" }),
        ]),
      }),
    ),
    runtimeThatMutatesInvalidRootDiagnostic((result) =>
      Object.freeze({
        ok: false,
        diagnostics: Object.freeze([
          Object.freeze({ ...result.diagnostics[0], message: "A different failure." }),
        ]),
      }),
    ),
    runtimeThatMutatesInvalidRootDiagnostic((result) =>
      Object.freeze({ diagnostics: result.diagnostics, ok: false }),
    ),
    runtimeThatMutatesRejectedCallerGraph(),
    runtimeThatFreezesRejectedCaller("executable"),
    runtimeThatFreezesRejectedCaller("selection"),
    runtimeThatFreezesRejectedCaller("toJSON"),
  ];

  for (const runtimeApi of runtimes) {
    await assert.rejects(
      buildEditorCoreSourceDocumentEvidence({ runtimeApi }),
      expectedError("EDITOR_SOURCE_DOCUMENT_BEHAVIOR_DRIFT"),
    );
  }
});

test("[boundary] rejects source, TSDoc, import, distribution, and manifest drift", async () => {
  const [
    source,
    index,
    distSource,
    declaration,
    persistenceSource,
    persistenceRuntime,
    persistenceDeclaration,
    manifestBytes,
    baseConfigBytes,
    packageConfigBytes,
    buildConfigBytes,
    publicConfigBytes,
  ] = await Promise.all([
    workspaceBytes("packages/editor-core/src/source-document.ts"),
    workspaceBytes("packages/editor-core/src/index.ts"),
    workspaceBytes("packages/editor-core/dist/source-document.js"),
    workspaceBytes("packages/editor-core/dist/source-document.d.ts"),
    workspaceBytes(PERSISTENCE_SOURCE),
    workspaceBytes("packages/editor-core/dist/persistence.js"),
    workspaceBytes("packages/editor-core/dist/persistence.d.ts"),
    workspaceBytes("packages/editor-core/package.json"),
    workspaceBytes("tsconfig.base.json"),
    workspaceBytes("packages/editor-core/tsconfig.json"),
    workspaceBytes("packages/editor-core/tsconfig.build.json"),
    workspaceBytes("packages/editor-core/tsconfig.public-package.json"),
  ]);
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  manifest.dependencies.react = "19.0.0";
  const manifestWithScriptDrift = JSON.parse(manifestBytes.toString("utf8"));
  manifestWithScriptDrift.scripts["test:public-package"] = "node --test test/public-package.mjs";
  const manifestWithLifecycle = JSON.parse(manifestBytes.toString("utf8"));
  manifestWithLifecycle.scripts.prepack = "node ./prepack.mjs";
  const manifestWithBin = JSON.parse(manifestBytes.toString("utf8"));
  manifestWithBin.bin = "./dist/cli.js";
  const manifestWithBrowser = JSON.parse(manifestBytes.toString("utf8"));
  manifestWithBrowser.browser = "./dist/browser.js";
  const manifestWithImports = JSON.parse(manifestBytes.toString("utf8"));
  manifestWithImports.imports = { "#runtime": "./dist/source-document.js" };
  const manifestWithUnknownKey = JSON.parse(manifestBytes.toString("utf8"));
  manifestWithUnknownKey.proofBypass = true;
  const baseConfig = JSON.parse(baseConfigBytes.toString("utf8"));
  baseConfig.compilerOptions.strict = false;
  const packageConfig = JSON.parse(packageConfigBytes.toString("utf8"));
  packageConfig.extends = "../../tsconfig.node.json";
  const buildConfig = JSON.parse(buildConfigBytes.toString("utf8"));
  buildConfig.extends = "../../tsconfig.base.json";
  const buildConfigWithCriticalDrift = JSON.parse(buildConfigBytes.toString("utf8"));
  buildConfigWithCriticalDrift.compilerOptions.noEmit = true;
  const publicConfig = JSON.parse(publicConfigBytes.toString("utf8"));
  publicConfig.compilerOptions.noEmit = false;
  const mutations = [
    [
      "packages/editor-core/src/source-document.ts",
      source.toString("utf8").replace("/**", "/*"),
      "EDITOR_SOURCE_DOCUMENT_SOURCE_CONTRACT_DRIFT",
    ],
    [
      "packages/editor-core/src/source-document.ts",
      `import "node:fs";\n${source}`,
      "EDITOR_SOURCE_DOCUMENT_SOURCE_CONTRACT_DRIFT",
    ],
    [
      "packages/editor-core/src/source-document.ts",
      source
        .toString("utf8")
        .replace(
          "const validation = validateDesenSource(input);",
          "const validation = (document.body, validateDesenSource)(input);",
        ),
      "EDITOR_SOURCE_DOCUMENT_PLATFORM_BOUNDARY_DRIFT",
    ],
    [
      "packages/editor-core/src/source-document.ts",
      source
        .toString("utf8")
        .replace(
          "const validation = validateDesenSource(input);",
          'const validation = require("@desen/validator").validateDesenSource(input);',
        ),
      "EDITOR_SOURCE_DOCUMENT_PLATFORM_BOUNDARY_DRIFT",
    ],
    [
      "packages/editor-core/src/source-document.ts",
      source
        .toString("utf8")
        .replace(
          "const validation = validateDesenSource(input);",
          "const validation = module.exports.validateDesenSource(input);",
        ),
      "EDITOR_SOURCE_DOCUMENT_PLATFORM_BOUNDARY_DRIFT",
    ],
    [
      "packages/editor-core/src/index.ts",
      `${index}\nexport const hiddenAuthority = true;\n`,
      "EDITOR_SOURCE_DOCUMENT_PUBLIC_API_DRIFT",
    ],
    [
      "packages/editor-core/dist/source-document.js",
      `${distSource}\nwindow.document;\n`,
      "EDITOR_SOURCE_DOCUMENT_OPTIONS_INVALID",
    ],
    [
      "packages/editor-core/dist/source-document.js",
      `${distSource}\n// receipt-only drift\n`,
      "EDITOR_SOURCE_DOCUMENT_OPTIONS_INVALID",
    ],
    [
      "packages/editor-core/dist/source-document.d.ts",
      declaration
        .toString("utf8")
        .replace("export type DesenEditorDocument", "type DesenEditorDocument"),
      "EDITOR_SOURCE_DOCUMENT_DISTRIBUTION_DRIFT",
    ],
    [
      "packages/editor-core/dist/source-document.d.ts",
      declaration
        .toString("utf8")
        .replace(
          "export type DesenEditorDocument = ImmutableJson<DesenSource>;",
          'export type DesenEditorDocument = ImmutableJson<DesenSource> & import("react").ReactNode;',
        ),
      "EDITOR_SOURCE_DOCUMENT_PLATFORM_BOUNDARY_DRIFT",
    ],
    [
      PERSISTENCE_SOURCE,
      persistenceSource.toString("utf8").replace("/**", "/*"),
      "EDITOR_SOURCE_DOCUMENT_PUBLIC_API_DRIFT",
    ],
    [
      "packages/editor-core/dist/persistence.js",
      `${persistenceRuntime}\nexport const hiddenPersistenceAuthority = true;\n`,
      "EDITOR_SOURCE_DOCUMENT_SOURCE_CONTRACT_DRIFT",
    ],
    [
      "packages/editor-core/dist/persistence.d.ts",
      `${persistenceDeclaration}\nexport declare const hiddenPersistenceAuthority: true;\n`,
      "EDITOR_SOURCE_DOCUMENT_SOURCE_CONTRACT_DRIFT",
    ],
    [
      "packages/editor-core/package.json",
      JSON.stringify(manifest),
      "EDITOR_SOURCE_DOCUMENT_MANIFEST_DRIFT",
    ],
    [
      "packages/editor-core/package.json",
      JSON.stringify(manifestWithScriptDrift),
      "EDITOR_SOURCE_DOCUMENT_MANIFEST_DRIFT",
    ],
    [
      "packages/editor-core/package.json",
      JSON.stringify(manifestWithLifecycle),
      "EDITOR_SOURCE_DOCUMENT_MANIFEST_DRIFT",
    ],
    [
      "packages/editor-core/package.json",
      JSON.stringify(manifestWithBin),
      "EDITOR_SOURCE_DOCUMENT_MANIFEST_DRIFT",
    ],
    [
      "packages/editor-core/package.json",
      JSON.stringify(manifestWithBrowser),
      "EDITOR_SOURCE_DOCUMENT_MANIFEST_DRIFT",
    ],
    [
      "packages/editor-core/package.json",
      JSON.stringify(manifestWithImports),
      "EDITOR_SOURCE_DOCUMENT_MANIFEST_DRIFT",
    ],
    [
      "packages/editor-core/package.json",
      JSON.stringify(manifestWithUnknownKey),
      "EDITOR_SOURCE_DOCUMENT_MANIFEST_DRIFT",
    ],
    ["tsconfig.base.json", JSON.stringify(baseConfig), "EDITOR_SOURCE_DOCUMENT_TSCONFIG_DRIFT"],
    [
      "packages/editor-core/tsconfig.json",
      JSON.stringify(packageConfig),
      "EDITOR_SOURCE_DOCUMENT_TSCONFIG_DRIFT",
    ],
    [
      "packages/editor-core/tsconfig.build.json",
      JSON.stringify(buildConfig),
      "EDITOR_SOURCE_DOCUMENT_TSCONFIG_DRIFT",
    ],
    [
      "packages/editor-core/tsconfig.build.json",
      JSON.stringify(buildConfigWithCriticalDrift),
      "EDITOR_SOURCE_DOCUMENT_TSCONFIG_DRIFT",
    ],
    [
      "packages/editor-core/tsconfig.public-package.json",
      JSON.stringify(publicConfig),
      "EDITOR_SOURCE_DOCUMENT_TSCONFIG_DRIFT",
    ],
  ];
  for (const [relativePath, value, errorCode] of mutations) {
    await assert.rejects(
      buildEditorCoreSourceDocumentEvidence({ fileOverrides: { [relativePath]: value } }),
      expectedError(errorCode),
    );
  }
});

test("[inventory] rejects package, public, and root test-authority drift", async () => {
  const [
    packageTest,
    packageTypes,
    authoringRoundTripTest,
    authoringRoundTripTypes,
    persistenceTest,
    persistenceTypes,
    publicTest,
    publicTypes,
    rootTest,
  ] = await Promise.all([
    workspaceBytes(PACKAGE_TEST),
    workspaceBytes("packages/editor-core/test/source-document.types.ts"),
    workspaceBytes(AUTHORING_ROUND_TRIP_TEST),
    workspaceBytes(AUTHORING_ROUND_TRIP_TYPES),
    workspaceBytes(PERSISTENCE_TEST),
    workspaceBytes(PERSISTENCE_TYPES),
    workspaceBytes(PUBLIC_TEST),
    workspaceBytes("packages/editor-core/test/public-package.types.mts"),
    workspaceBytes(ROOT_TEST),
  ]);
  const packageTestText = packageTest.toString("utf8");
  const publicTestText = publicTest.toString("utf8");
  const rootTestText = rootTest.toString("utf8");
  const nestedRootTest = `${replaceLast(
    rootTestText,
    'test("[immutability] freezes final evidence and keeps later M08 scope explicit", () => {',
    'if (false) {\n  test("[immutability] freezes final evidence and keeps later M08 scope explicit", () => {',
  )}\n}\n`;
  const packageNoop = replaceRegistrationCallbackWithNoop(
    packageTestText,
    '  it("admits the official Source directly without a hidden document wrapper", () => {',
    '  it("detaches independent snapshots without freezing or retaining caller input", () => {',
  );
  const publicNoop = replaceRegistrationCallbackWithNoop(
    publicTestText,
    'test("the package manifest keeps one exact root export and the declared runtime dependencies", () => {',
    'test("the emitted public module graph stays platform-neutral and execution-closed", async () => {',
  );
  const rootNoop = replaceRegistrationCallbackWithNoop(
    rootTestText,
    'test("[immutability] freezes final evidence and keeps later M08 scope explicit", () => {',
  );
  const directiveDecoy = packageTypes
    .toString("utf8")
    .replace(
      "// @ts-expect-error the direct editor document is recursively immutable",
      'const directiveDecoy = "// @ts-expect-error";',
    );
  const publicDirectiveDecoy = publicTypes
    .toString("utf8")
    .replace(
      "// @ts-expect-error emitted declarations keep the direct document recursively immutable",
      'const directiveDecoy = "// @ts-expect-error";',
    );
  const unusedDirectiveAuthority = `declare const value: unknown;\n\n${Array.from(
    { length: 5 },
    (_, index) => `// @ts-expect-error unused directive ${index + 1}\nvoid value;`,
  ).join("\n\n")}\n`;
  const mutations = [
    [
      PACKAGE_TEST,
      packageTestText.replace(
        '  it("admits the official Source',
        '  test.skip("admits the official Source',
      ),
    ],
    [
      PACKAGE_TEST,
      packageTestText.replace(
        '  it("admits the official Source',
        '  it.skip("admits the official Source',
      ),
    ],
    [PACKAGE_TEST, packageNoop],
    [AUTHORING_ROUND_TRIP_TEST, changedByte(authoringRoundTripTest)],
    [AUTHORING_ROUND_TRIP_TYPES, changedByte(authoringRoundTripTypes)],
    [PERSISTENCE_TEST, changedByte(persistenceTest)],
    [PERSISTENCE_TYPES, changedByte(persistenceTypes)],
    [PUBLIC_TEST, publicTestText.replace('test("[proof-core] two fresh', 'test("two fresh')],
    [
      PUBLIC_TEST,
      publicTestText.replace(
        'import test from "node:test";',
        'import nodeTest from "node:test";\nconst test = nodeTest;',
      ),
    ],
    [PUBLIC_TEST, publicNoop],
    ["packages/editor-core/test/source-document.types.ts", directiveDecoy],
    ["packages/editor-core/test/public-package.types.mts", publicDirectiveDecoy],
    ["packages/editor-core/test/public-package.types.mts", unusedDirectiveAuthority],
    [
      ROOT_TEST,
      replaceLast(
        rootTestText,
        "[immutability] freezes final evidence and keeps later M08 scope explicit",
        "[immutability] renamed authority",
      ),
    ],
    [ROOT_TEST, nestedRootTest],
    [ROOT_TEST, rootNoop],
    [
      ROOT_TEST,
      rootTestText.replace(
        'import { after, before, test } from "node:test";',
        'import { after, before } from "node:test";\nconst test = () => undefined;',
      ),
    ],
  ];
  for (const [relativePath, value] of mutations) {
    await assert.rejects(
      buildEditorCoreSourceDocumentEvidence({ fileOverrides: { [relativePath]: value } }),
      expectedError("EDITOR_SOURCE_DOCUMENT_TEST_INVENTORY_DRIFT"),
    );
  }
});

test("[artifact] verifies exact bytes and the exact proof-document pin", async () => {
  const proofDocument = exactProofDocument(built.artifactSha256);
  const verified = await verifyEditorCoreSourceDocumentEvidence({
    artifactBytes: built.artifactBytes,
    proofDocument,
  });
  assert.deepEqual(verified, {
    task: "M08-T01",
    result: "PASS",
    artifactSha256: built.artifactSha256,
    prerequisiteTask: "I07-04",
    prerequisiteGate: "G07",
    trackedFiles: 47,
    rootProofCases: 13,
  });
  await assert.rejects(
    verifyEditorCoreSourceDocumentEvidence({
      artifactBytes: changedByte(built.artifactBytes),
      proofDocument,
    }),
    expectedError("EDITOR_SOURCE_DOCUMENT_ARTIFACT_DRIFT"),
  );
  await assert.rejects(
    verifyEditorCoreSourceDocumentEvidence({
      artifactBytes: built.artifactBytes,
      proofDocument: exactProofDocument("0".repeat(64)),
    }),
    expectedError("EDITOR_SOURCE_DOCUMENT_PROOF_PIN_DRIFT"),
  );
  const hiddenPinDocuments = [
    `# Test proof\n\n## Result\n\n<!--\nArtifact: \`${ARTIFACT}\`\nFinal receipt: \`sha256:${built.artifactSha256}\`\n-->\n`,
    `# Test proof\n\n## Result\n\n\`\`\`text\nArtifact: \`${ARTIFACT}\`\nFinal receipt: \`sha256:${built.artifactSha256}\`\n\`\`\`\n`,
    `# Test proof\n\n## Result\n\n<div hidden>\nArtifact: \`${ARTIFACT}\`\nFinal receipt: \`sha256:${built.artifactSha256}\`\n</div>\n`,
    `# Test proof\n\n## Result\n\n<div\n class="hidden">\nArtifact: \`${ARTIFACT}\`\nFinal receipt: \`sha256:${built.artifactSha256}\`\n</div>\n`,
    `# Test proof\n\n## Result\n\n<section aria-hidden='true'>\nArtifact: \`${ARTIFACT}\`\nFinal receipt: \`sha256:${built.artifactSha256}\`\n</section>\n`,
    `# Test proof\n\n## Result\n\n<div style="color:red; DISPLAY: none !important">\nArtifact: \`${ARTIFACT}\`\nFinal receipt: \`sha256:${built.artifactSha256}\`\n</div>\n`,
    `# Test proof\n\n## Result\n\n<details>\nArtifact: \`${ARTIFACT}\`\nFinal receipt: \`sha256:${built.artifactSha256}\`\n</details>\n`,
  ];
  for (const proofDocumentWithHiddenPin of hiddenPinDocuments) {
    await assert.rejects(
      verifyEditorCoreSourceDocumentEvidence({
        artifactBytes: built.artifactBytes,
        proofDocument: proofDocumentWithHiddenPin,
      }),
      expectedError("EDITOR_SOURCE_DOCUMENT_PROOF_PIN_DRIFT"),
    );
  }
  for (const contradiction of [
    "Result: FAIL",
    "**Result:** **FAILED**",
    "**Status:** **BLOCKED**",
    "<p>**Status:** **IN_PROGRESS**</p>",
    "Status: incomplete",
  ]) {
    await assert.rejects(
      verifyEditorCoreSourceDocumentEvidence({
        artifactBytes: built.artifactBytes,
        proofDocument: `${exactProofDocument(built.artifactSha256)}\n${contradiction}\n`,
      }),
      expectedError("EDITOR_SOURCE_DOCUMENT_PROOF_PIN_DRIFT"),
    );
  }
  await assert.rejects(
    verifyEditorCoreSourceDocumentEvidence({
      artifactBytes: built.artifactBytes,
      proofDocument: `${exactProofDocument(
        built.artifactSha256,
      )}\n<div hidden>\n**Status:** **FAIL**\n</div>\n`,
    }),
    expectedError("EDITOR_SOURCE_DOCUMENT_PROOF_PIN_DRIFT"),
  );
});

test("[writer] atomically writes exact bytes and preserves an existing destination on failure", async () => {
  const directory = await temporaryDirectory("desen-m08-t01-writer-");
  const artifactPath = path.join(directory, "artifact.json");
  const written = await writeEditorCoreSourceDocumentEvidence({ artifactPath });
  assert.equal(written.artifactSha256, built.artifactSha256);
  assert.deepEqual(await readFile(artifactPath), built.artifactBytes);

  const sentinel = Buffer.from("preserve-existing-destination\n");
  await writeFile(artifactPath, sentinel);
  await assert.rejects(
    writeEditorCoreSourceDocumentEvidence({
      artifactPath,
      beforeAtomicRename: () => {
        throw new Error("controlled pre-rename failure");
      },
    }),
    expectedError("EDITOR_SOURCE_DOCUMENT_ARTIFACT_WRITE_FAILED"),
  );
  assert.deepEqual(await readFile(artifactPath), sentinel);

  await assert.rejects(
    writeEditorCoreSourceDocumentEvidence({
      artifactPath,
      buildOptions: { prerequisiteBytes: changedByte(await workspaceBytes(PREREQUISITE)) },
    }),
    expectedError("EDITOR_SOURCE_DOCUMENT_PREREQUISITE_DRIFT"),
  );
  assert.deepEqual(await readFile(artifactPath), sentinel);
});

test("[writer-filesystem] rejects linked and non-file artifact destinations", async () => {
  const directory = await temporaryDirectory("desen-m08-t01-writer-authority-");
  const target = path.join(directory, "target.json");
  const symbolic = path.join(directory, "symbolic.json");
  const hard = path.join(directory, "hard.json");
  const directoryTarget = path.join(directory, "directory.json");
  await writeFile(target, "existing target\n");
  await symlink(target, symbolic);
  await link(target, hard);
  await mkdir(directoryTarget);
  for (const artifactPath of [symbolic, hard, directoryTarget]) {
    await assert.rejects(
      writeEditorCoreSourceDocumentEvidence({ artifactPath }),
      expectedError("EDITOR_SOURCE_DOCUMENT_ARTIFACT_WRITE_FAILED"),
    );
  }
  assert.equal(await readFile(target, "utf8"), "existing target\n");
});

test("[options] rejects unknown, accessor, inherited, symbol, proxy, and shared inputs", async () => {
  let getterCalls = 0;
  let proxyCalls = 0;
  const accessor = Object.defineProperty({}, "runtimeApi", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return editorCore;
    },
  });
  const inherited = Object.create({ runtimeApi: editorCore });
  const symbol = { [Symbol("runtimeApi")]: editorCore };
  const proxy = new Proxy(
    {},
    {
      ownKeys() {
        proxyCalls += 1;
        return [];
      },
      getPrototypeOf() {
        proxyCalls += 1;
        return Object.prototype;
      },
    },
  );
  const prerequisiteBytes = new Uint8Array(await workspaceBytes(PREREQUISITE));
  const dependencyAuthorityBytes = new Uint8Array(await workspaceBytes(DEPENDENCY_AUTHORITY));
  const shadowedBuffer = new Uint8Array(prerequisiteBytes);
  Object.defineProperty(shadowedBuffer, "buffer", {
    get() {
      getterCalls += 1;
      return new ArrayBuffer(0);
    },
  });
  const shadowedArtifactLength = new Uint8Array(built.artifactBytes);
  Object.defineProperty(shadowedArtifactLength, "length", {
    get() {
      getterCalls += 1;
      return built.artifactBytes.byteLength;
    },
  });
  const shadowedDependencyAuthority = new Uint8Array(dependencyAuthorityBytes);
  Object.defineProperty(shadowedDependencyAuthority, "byteOffset", {
    get() {
      getterCalls += 1;
      return 0;
    },
  });
  for (const options of [
    { unexpected: true },
    { dependencyAuthorityPath: "" },
    accessor,
    inherited,
    symbol,
    proxy,
    {
      runtimeApi: {
        createDesenEditorDocument: editorCore.createDesenEditorDocument,
      },
    },
    { fileOverrides: {} },
    { fileOverrides: { "packages/editor-core/README.md": "# mutation-only override\n" } },
    { fileOverrides: { "packages/validator/dist/index.js": "export {};\n" } },
    { fileOverrides: { "packages/validator/package.json": "{}\n" } },
    { dependencyAuthorityBytes: shadowedDependencyAuthority },
    { prerequisiteBytes: shadowedBuffer },
  ]) {
    await assert.rejects(
      buildEditorCoreSourceDocumentEvidence(options),
      expectedError("EDITOR_SOURCE_DOCUMENT_OPTIONS_INVALID"),
    );
  }
  await assert.rejects(
    verifyEditorCoreSourceDocumentEvidence({
      artifactBytes: shadowedArtifactLength,
      proofDocument: exactProofDocument(built.artifactSha256),
    }),
    expectedError("EDITOR_SOURCE_DOCUMENT_OPTIONS_INVALID"),
  );
  for (const unsafeVerificationOverride of [
    {
      runtimeApi: {
        createDesenEditorDocument: editorCore.createDesenEditorDocument,
      },
    },
    { fileOverrides: {} },
  ]) {
    await assert.rejects(
      verifyEditorCoreSourceDocumentEvidence({
        artifactBytes: built.artifactBytes,
        proofDocument: exactProofDocument(built.artifactSha256),
        ...unsafeVerificationOverride,
      }),
      expectedError("EDITOR_SOURCE_DOCUMENT_OPTIONS_INVALID"),
    );
  }
  if (typeof SharedArrayBuffer === "function") {
    const sharedBytes = new Uint8Array(new SharedArrayBuffer(prerequisiteBytes.byteLength));
    sharedBytes.set(prerequisiteBytes);
    Object.defineProperty(sharedBytes, "buffer", {
      get() {
        getterCalls += 1;
        return new ArrayBuffer(0);
      },
    });
    await assert.rejects(
      buildEditorCoreSourceDocumentEvidence({
        prerequisiteBytes: new Uint8Array(new SharedArrayBuffer(8)),
      }),
      expectedError("EDITOR_SOURCE_DOCUMENT_OPTIONS_INVALID"),
    );
    await assert.rejects(
      buildEditorCoreSourceDocumentEvidence({ prerequisiteBytes: sharedBytes }),
      expectedError("EDITOR_SOURCE_DOCUMENT_OPTIONS_INVALID"),
    );
  }
  assert.equal(getterCalls, 0);
  assert.equal(proxyCalls, 0);
});

test("[filesystem] rejects linked prerequisite, artifact, and proof authorities", async () => {
  const directory = await temporaryDirectory("desen-m08-t01-authority-");
  const prerequisiteTarget = path.join(directory, "prerequisite-target.json");
  const prerequisiteSymbolic = path.join(directory, "prerequisite-symbolic.json");
  const prerequisiteHard = path.join(directory, "prerequisite-hard.json");
  const dependencyAuthorityTarget = path.join(directory, "dependency-authority-target.json");
  const dependencyAuthoritySymbolic = path.join(directory, "dependency-authority-symbolic.json");
  const dependencyAuthorityHard = path.join(directory, "dependency-authority-hard.json");
  const dependencyAuthorityDirectory = path.join(directory, "dependency-authority-directory");
  const artifactTarget = path.join(directory, "artifact-target.json");
  const artifactSymbolic = path.join(directory, "artifact-symbolic.json");
  const artifactHard = path.join(directory, "artifact-hard.json");
  const proofTarget = path.join(directory, "proof-target.md");
  const proofSymbolic = path.join(directory, "proof-symbolic.md");
  const proofHard = path.join(directory, "proof-hard.md");
  await writeFile(prerequisiteTarget, await workspaceBytes(PREREQUISITE));
  await symlink(prerequisiteTarget, prerequisiteSymbolic);
  await link(prerequisiteTarget, prerequisiteHard);
  await writeFile(dependencyAuthorityTarget, await workspaceBytes(DEPENDENCY_AUTHORITY));
  await symlink(dependencyAuthorityTarget, dependencyAuthoritySymbolic);
  await link(dependencyAuthorityTarget, dependencyAuthorityHard);
  await mkdir(dependencyAuthorityDirectory);
  await writeFile(artifactTarget, built.artifactBytes);
  await symlink(artifactTarget, artifactSymbolic);
  await link(artifactTarget, artifactHard);
  await writeFile(proofTarget, exactProofDocument(built.artifactSha256));
  await symlink(proofTarget, proofSymbolic);
  await link(proofTarget, proofHard);

  for (const prerequisitePath of [prerequisiteSymbolic, prerequisiteHard]) {
    await assert.rejects(
      buildEditorCoreSourceDocumentEvidence({ prerequisitePath }),
      expectedError("EDITOR_SOURCE_DOCUMENT_AUTHORITY_UNSAFE"),
    );
  }
  for (const dependencyAuthorityPath of [
    dependencyAuthoritySymbolic,
    dependencyAuthorityHard,
    dependencyAuthorityDirectory,
  ]) {
    await assert.rejects(
      buildEditorCoreSourceDocumentEvidence({ dependencyAuthorityPath }),
      expectedError("EDITOR_SOURCE_DOCUMENT_AUTHORITY_UNSAFE"),
    );
  }
  for (const artifactPath of [artifactSymbolic, artifactHard]) {
    await assert.rejects(
      verifyEditorCoreSourceDocumentEvidence({
        artifactPath,
        proofDocument: exactProofDocument(built.artifactSha256),
      }),
      expectedError("EDITOR_SOURCE_DOCUMENT_AUTHORITY_UNSAFE"),
    );
  }
  for (const proofDocumentPath of [proofSymbolic, proofHard]) {
    await assert.rejects(
      verifyEditorCoreSourceDocumentEvidence({
        artifactBytes: built.artifactBytes,
        proofDocumentPath,
      }),
      expectedError("EDITOR_SOURCE_DOCUMENT_AUTHORITY_UNSAFE"),
    );
  }
});

test("[utf8] rejects invalid proof UTF-8 without normalization", async () => {
  const directory = await temporaryDirectory("desen-m08-t01-utf8-");
  const proofDocumentPath = path.join(directory, "invalid-proof.md");
  await writeFile(proofDocumentPath, Uint8Array.of(0xff));
  await assert.rejects(
    verifyEditorCoreSourceDocumentEvidence({
      artifactBytes: built.artifactBytes,
      proofDocumentPath,
    }),
    expectedError("EDITOR_SOURCE_DOCUMENT_UTF8_INVALID"),
  );
});

test("[immutability] freezes final evidence and keeps later M08 scope explicit", () => {
  assertDeepFrozen(built.artifact);
  assert.equal(built.artifact.claim.semanticValidation, false);
  assert.equal(built.artifact.documentModel.directSourceRoot, true);
  assert.equal(built.artifact.documentModel.detached, true);
  assert.equal(built.artifact.boundary.platformImports, 0);
  assert.equal(built.artifact.boundary.executableAuthority, 0);
  assert.match(built.artifact.nonclaims.join("\n"), /Node runtime, loader, and process/u);
  assert.match(built.artifact.nonclaims.join("\n"), /hostile-JavaScript capability sandbox/u);
  assert.match(built.artifact.nonclaims.join("\n"), /M08-T02/u);
  assert.match(built.artifact.nonclaims.join("\n"), /M08-T07/u);
  assert.match(built.artifact.nonclaims.join("\n"), /M08-T08/u);
  assert.match(built.artifact.nonclaims.join("\n"), /M08-T09/u);
  assert.match(built.artifact.nonclaims.join("\n"), /M08-T10/u);
  assert.match(built.artifact.nonclaims.join("\n"), /G08/u);
  assert.equal(DEFAULT_EDITOR_CORE_SOURCE_DOCUMENT_ARTIFACT_PATH, path.join(ROOT, ARTIFACT));
  assert.throws(() => {
    built.artifact.claim.taskStatus = "IN_PROGRESS";
  }, TypeError);
});
