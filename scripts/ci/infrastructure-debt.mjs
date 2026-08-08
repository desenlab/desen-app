import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import { promisify, types as utilTypes } from "node:util";

const SAFE_ARRAY_IS_ARRAY = Array.isArray;
const SAFE_BUFFER_FROM = Buffer.from.bind(Buffer);
const SAFE_JSON_PARSE = JSON.parse;
const SAFE_JSON_STRINGIFY = JSON.stringify;
const SAFE_OBJECT_FREEZE = Object.freeze;
const SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR = Object.getOwnPropertyDescriptor;
const SAFE_OBJECT_GET_PROTOTYPE_OF = Object.getPrototypeOf;
const SAFE_OBJECT_PROTOTYPE = Object.prototype;
const SAFE_REFLECT_OWN_KEYS = Reflect.ownKeys;
const SAFE_TEXT_DECODER = TextDecoder;
const SAFE_TEXT_DECODER_DECODE = TextDecoder.prototype.decode;
const SAFE_UTIL_IS_PROXY = utilTypes.isProxy;
const SAFE_UTIL_IS_UINT8_ARRAY = utilTypes.isUint8Array;
const EXEC_FILE = promisify(execFileCallback);

const PROFILE = "desen.ci.infrastructure-debt.v1";
const MANIFEST_RELATIVE_PATH = "scripts/ci/infrastructure-debt.json";
const DEBT_REGISTER_RELATIVE_PATH = "docs/plan/DEBT-REGISTER.md";
const TASK_BOARD_RELATIVE_PATH = "docs/plan/TASKS.md";
const MAX_MANIFEST_BYTES = 512 * 1024;
const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;
const MAX_TARGET_BYTES = 8 * 1024 * 1024;
const MAX_GIT_OUTPUT_BYTES = 8 * 1024 * 1024;
const READ_FLAGS =
  fileConstants.O_RDONLY | (fileConstants.O_NOFOLLOW ?? 0) | (fileConstants.O_NONBLOCK ?? 0);
const ROOT_KEYS = SAFE_OBJECT_FREEZE(["schemaVersion", "profile", "entries"]);
const ENTRY_KEYS = SAFE_OBJECT_FREEZE([
  "id",
  "status",
  "evidence",
  "registeredBy",
  "removalOwner",
  "deadline",
  "targets",
]);
const TARGET_KEYS = SAFE_OBJECT_FREEZE(["path", "symbols"]);
const EVIDENCE_KEYS = SAFE_OBJECT_FREEZE([
  "kind",
  "commitSha",
  "pullRequestUrl",
  "evidencePath",
  "evidenceSha256",
  "hostedRunUrl",
]);
const OPTION_KEYS = SAFE_OBJECT_FREEZE(["workspaceRoot"]);
const ALLOWED_STATUSES = SAFE_OBJECT_FREEZE(["OPEN", "READY_FOR_REMOVAL", "CLOSED"]);
const TASK_STATUSES = SAFE_OBJECT_FREEZE(["NOT_STARTED", "IN_PROGRESS", "BLOCKED", "DONE"]);

function target(relativePath, symbols) {
  return SAFE_OBJECT_FREEZE({
    path: relativePath,
    symbols: SAFE_OBJECT_FREEZE([...symbols]),
  });
}

function authority(id, removalOwner, deadline, targets, registeredBy = "I07-01") {
  return SAFE_OBJECT_FREEZE({
    id,
    registeredBy,
    removalOwner,
    deadline,
    targets: SAFE_OBJECT_FREEZE(targets),
  });
}

/**
 * Exact code-owned authority for every temporary I07 infrastructure structure.
 *
 * The inert manifest may change lifecycle status only. It cannot add cleanup scope, redirect a
 * target path, weaken a zero-reference symbol set, move a deadline, or select its own owner.
 */
export const INFRASTRUCTURE_DEBT_AUTHORITY = SAFE_OBJECT_FREEZE([
  authority("DEBT-I07-001", "I07-04", "G07", [
    target("scripts/lib/publisher-publish-result-proof.mjs", [
      "G05_COMPATIBILITY_OWNERSHIP_PATHS",
      "REVIEWED_G05_COMPATIBILITY_RECEIPT_HISTORY",
      "TRACKED_FILE_OVERRIDE_PATHS",
      "reviewedHistory",
      "latestReviewed",
      "receiptIsReviewed",
    ]),
    target("tests/publisher-publish-result.test.mjs", [
      "M07_T03_SOURCE_AUDIT_RECONSTRUCTION_PATCH",
      "reconstructM07T03SourceAuditProof",
      "currentCompatibilityBytes",
      "compatibilityPaths",
      "reviewedG05CompatibilityReceiptHistory",
      "PUBLISHER_G05_COMPATIBILITY_READER_DRIFT",
    ]),
  ]),
  authority("DEBT-I07-002", "I07-04", "G07", [
    target("scripts/lib/publisher-execution-preflight-proof.mjs", [
      "M05_SOURCE_AUDIT_PROOF_RELATIVE_PATH",
      "M05_SOURCE_AUDIT_TEST_RELATIVE_PATH",
      "APPROVED_M05_COMPATIBILITY_RECEIPT_HISTORY",
      "APPROVED_CURRENT_M05_COMPATIBILITY_RECEIPTS",
      "captureCompatibilitySourceBytes",
    ]),
    target("tests/publisher-execution-preflight.test.mjs", [
      "compatibilitySources",
      "compatibilitySourceBytes",
      "currentBytes",
      "currentSha256",
    ]),
  ]),
  authority("DEBT-I07-003", "I07-04", "G07", [
    target("scripts/lib/publisher-bundle-publication-proof.mjs", [
      "PUBLISHER_BUNDLE_PUBLICATION_COMPATIBILITY_READERS",
      "EXECUTION_PREFLIGHT_COMPATIBILITY_READER",
      "EXECUTION_PREFLIGHT_COMPATIBILITY_ROOT_TEST",
      "APPROVED_COMPATIBILITY_RECEIPT_HISTORY",
      "APPROVED_CURRENT_COMPATIBILITY_RECEIPTS",
      "APPROVED_CURRENT_COMPATIBILITY_PATHS",
      "assertApprovedCurrentCompatibilityBytes",
      "authenticateCurrentCompatibilityReaders",
      "APPROVED_REQUIRED_CI_WORKFLOW_RECEIPT",
      "matchesReceipt",
      "authenticateRequiredCiWorkflow",
      "authenticatedM07T01Prefix",
    ]),
    target("tests/publisher-bundle-publication.test.mjs", [
      "PUBLISHER_BUNDLE_PUBLICATION_COMPATIBILITY_READERS",
      "[compatibility] externally tracks every current T02 through T09 proof reader",
      "[compatibility] detects tamper in each externally anchored T02 through T09 reader",
      "[compatibility] admits only the exact current execution-preflight root reader",
      "[ci] admits only the exact required-workflow successor into frozen T09 evidence",
      "[ci] accepts an append-only M07 successor without rewriting frozen T09 evidence",
    ]),
  ]),
  authority("DEBT-I07-004", "I07-04", "G07", [
    target("scripts/lib/publisher-invalid-source-matrix-proof.mjs", [
      "APPROVED_CURRENT_T09_SUCCESSOR_PATHS",
      "APPROVED_T09_SUCCESSOR_RECEIPT_HISTORY",
      "APPROVED_CURRENT_T09_SUCCESSOR_RECEIPTS",
      "APPROVED_CURRENT_T10_SUCCESSOR_PATHS",
      "APPROVED_CURRENT_T10_SUCCESSOR_RECEIPTS",
      "REQUIRED_CURRENT_T09_PROOF_MARKERS",
      "REQUIRED_CURRENT_T09_TEST_MARKERS",
      "currentT09SuccessorReceipt",
      "currentT10SuccessorReceipt",
      "assertCurrentT10SuccessorBytes",
      "authenticateLiveCurrentT09Successors",
      "authenticateCurrentT09TrackedInputs",
      "authenticateLiveCurrentT10Successors",
      "authenticateCurrentT10TrackedInputs",
      "currentT10HistoricalReceipt",
      "assertCurrentT09CompatibilityMarkers",
    ]),
    target("tests/publisher-invalid-source-matrix.test.mjs", [
      "[authority] distinguishes semantic coordination drift from frozen surface drift",
      "BUNDLE_PUBLICATION_PROOF_LIBRARY",
      "BUNDLE_PUBLICATION_ROOT_TEST",
      "currentT09ProofBytes",
      "currentT09RootTestBytes",
      "currentT10ProofBytes",
      "currentT10RootTestBytes",
      "approvedCurrentT09",
      "unreviewedT09ProofBytes",
      "[successor] accepts an append-only M07 task without rewriting frozen T11 evidence",
    ]),
    target("scripts/lib/publisher-official-golden-proof.mjs", [
      "APPROVED_REQUIRED_CI_WORKFLOW_RECEIPT",
      "matchesReceipt",
      "authenticateRequiredCiWorkflow",
    ]),
    target("tests/publisher-official-golden.test.mjs", [
      "[ci] admits only the exact required-workflow successor into frozen T10 evidence",
    ]),
  ]),
  authority("DEBT-I07-005", "I07-04", "G07", [
    target("scripts/lib/control-plane-bundle-store-proof.mjs", [
      "HISTORICAL_COMPATIBILITY_READERS",
      "HISTORICAL_TRACKED_RECEIPTS",
      "APPROVED_M07_T02_TRACKED_RECEIPTS",
      "APPROVED_M07_T02_PUBLIC_SOURCE_EXPORTS",
      "HISTORICAL_INDEX_DISTRIBUTION_RECEIPTS",
      "APPROVED_M07_T02_INDEX_DISTRIBUTION_RECEIPTS",
      "currentReaderPaths",
    ]),
    target("tests/control-plane-bundle-store.test.mjs", [
      "HISTORICAL_COMPATIBILITY_READERS",
      "currentReaderPaths",
    ]),
  ]),
  authority("DEBT-I07-006", "I07-04", "G07", [
    target("scripts/lib/reference-host-web-source-audit-proof.mjs", [
      "M06_T05_VALIDATOR_SUCCESSOR",
      "uniqueRuntimeResolutionModule",
      "assertPinnedRuntimeResolutionDigest",
      "normalizeReviewedValidatorSuccessor",
      "verifyReferenceHostWebValidatorSuccessorSources",
    ]),
    target("tests/reference-host-web-source-audit.test.mjs", [
      "verifyReferenceHostWebValidatorSuccessorSources",
      "admits only the source-pinned M06-T05 Validator runtime successor",
    ]),
  ]),
  authority("DEBT-I07-007", "I07-05", "G12", [
    target("scripts/run-ci-quality-gate.mjs", [
      "createQualityGateSteps",
      "runStepSequence",
      "executeQualityGate",
      "executeDefaultQualityGate",
      "activeChild",
    ]),
    target("scripts/test/ci-quality-gate.test.mjs", [
      "createQualityGateSteps",
      "runStepSequence",
      "executeQualityGate",
      "executeDefaultQualityGate",
      "activeChild",
    ]),
    target("scripts/ci/required-exhaustive-equivalence.mjs", [
      "../run-ci-quality-gate.mjs",
      "createRetainedSequentialSteps",
      "validateRetainedSequentialPlan",
      "EXPECTED_RETAINED_PLAN_SHA256",
      "verifyRequiredExhaustiveInventoryEquivalence",
    ]),
    target("scripts/ci/test/required-exhaustive-equivalence.test.mjs", [
      "../../run-ci-quality-gate.mjs",
      "createRetainedSequentialSteps",
      "EXPECTED_RETAINED_PLAN_SHA256",
      "verifyRequiredExhaustiveInventoryEquivalence",
      "retained-plan omission, reorder, argv substitution, and duplicate fail closed",
      "RETAINED_LEGACY_COMMAND",
      "official CI admits only required exhaustive authority and a manual legacy rollback",
    ]),
    target("tests/publisher-bundle-publication.test.mjs", ["createQualityGateSteps"]),
    target("tests/publisher-catalog-pinning.test.mjs", ["createQualityGateSteps"]),
    target("tests/publisher-invalid-source-matrix.test.mjs", ["createQualityGateSteps"]),
    target("tests/control-plane-bundle-store.test.mjs", ["createQualityGateSteps"]),
    target(".github/workflows/ci.yml", [
      "legacy-rollback",
      "legacy-pnpm-store",
      "Legacy rollback",
      "Run retained legacy rollback",
      "node scripts/run-ci-quality-gate.mjs",
    ]),
  ]),
  authority("DEBT-I07-008", "I07-02", "G07", [
    target(".github/workflows/ci-v2-shadow.yml", [
      "CI v2 shadow",
      "modular-shadow",
      "Exhaustive modular shadow",
      "Run exhaustive modular shadow",
    ]),
    target("scripts/ci/run-modular-quality-gate.mjs", [
      "../run-ci-quality-gate.mjs",
      "PROOF_ENTRIES",
      "createQualityGateSteps",
      "executeQualityGate",
      "validateQualityGatePlan",
    ]),
    target("scripts/ci/test/modular-quality-gate.test.mjs", [
      "../../run-ci-quality-gate.mjs",
      "PROOF_ENTRIES",
      "createQualityGateSteps",
    ]),
  ]),
  authority("DEBT-I07-009", "I07-04", "G07", [
    target("scripts/lib/reference-host-web-source-audit-proof.mjs", [
      "M07_T06_CONTROL_PLANE_COORDINATION",
      "M07_T06_CONTROL_PLANE_LOCKFILE_BLOCK",
      "APPROVED_M07_T06_DEPENDENCY_POLICY_SUCCESSOR",
      "normalizeCurrentRootPackageBytes",
      "inspectExactControlPlaneImporter",
      "normalizeCurrentLockfileBytes",
    ]),
    target("tests/reference-host-web-source-audit.test.mjs", [
      "reviewed Publisher and M07-T06 coordination preserve root, package, and lockfile provenance",
    ]),
  ]),
  authority("DEBT-I07-010", "I07-04", "G07", [
    target("scripts/lib/runtime-react-interactions-proof.mjs", [
      "EXPECTED_CURRENT_P05_SUCCESSOR",
      "p05HistoricalStatus",
      "p05CurrentStatus",
      "p05SuccessorArtifactSha256",
    ]),
    target("tests/runtime-react-interactions.test.mjs", [
      "SUCCESSOR_SHA256",
      "SUCCESSOR_ARTIFACT_FILE_NAME",
      "SUCCESSOR_EVIDENCE_TEXT",
      "rejects P-05 monotonic M07-T03 successor closure or P-06 historical pin drift",
    ]),
  ]),
  authority(
    "DEBT-I07-011",
    "I07-04",
    "G07",
    [
      target("scripts/lib/runtime-react-failure-boundary-proof.mjs", [
        "EXPECTED_CURRENT_P17_SUCCESSOR",
        "p17HistoricalStatus",
        "p17CurrentStatus",
        "p17SuccessorArtifactSha256",
      ]),
      target("tests/runtime-react-failure-boundary.test.mjs", [
        "SUCCESSOR_SHA256",
        "SUCCESSOR_ARTIFACT_FILE_NAME",
        "SUCCESSOR_EVIDENCE_TEXT",
        "rejects N-037, monotonic P-17 successor, and PF-055 current-closure drift",
      ]),
      target("scripts/lib/control-plane-bundle-store-proof.mjs", [
        "APPROVED_M07_T04_TRACKED_RECEIPTS",
        "APPROVED_M07_T04_PUBLIC_SOURCE_EXPORTS",
        "APPROVED_M07_T04_INDEX_DISTRIBUTION_RECEIPTS",
        "approvedM07T04",
      ]),
      target("tests/control-plane-bundle-store.test.mjs", [
        "changedPackageByte",
        "indexWithAppendedTail",
      ]),
      target("scripts/lib/control-plane-bundle-verification-proof.mjs", [
        "APPROVED_M07_T04_PUBLIC_SOURCE_EXPORTS",
        "APPROVED_M07_T04_PUBLIC_RUNTIME_KEYS",
        "APPROVED_M07_T04_TRACKED_RECEIPTS",
        "APPROVED_M07_T04_INDEX_DISTRIBUTION_RECEIPTS",
        "approvedM07T04",
        "approvedM07T04Keys",
        "reviewedSuccessor",
      ]),
      target("tests/control-plane-bundle-verification.test.mjs", [
        "APP_INDEX",
        "indexWithAppendedTail",
      ]),
      target("scripts/lib/control-plane-package-preflight-proof.mjs", [
        "APPROVED_M07_T04_PUBLIC_SOURCE_EXPORTS",
        "APPROVED_M07_T04_PUBLIC_RUNTIME_KEYS",
        "APPROVED_M07_T04_TRACKED_RECEIPTS",
        "APPROVED_M07_T04_INDEX_DISTRIBUTION_RECEIPTS",
        "approvedM07T04",
        "taskTimeTail",
        "successorIndex",
        "reviewedSuccessor",
        "reviewedSuccessorTail",
        "pnpm verify:control-plane-reference-preflight",
        "pnpm test:control-plane-reference-preflight",
      ]),
      target("tests/control-plane-package-preflight.test.mjs", [
        "indexWithAppendedTail",
        "unreviewed successor tail",
      ]),
    ],
    "M07-T04",
  ),
  authority(
    "DEBT-I07-012",
    "I07-04",
    "G07",
    [
      target("scripts/lib/control-plane-bundle-store-proof.mjs", [
        "APPROVED_M07_T05_TRACKED_RECEIPTS",
        "APPROVED_M07_T05_PUBLIC_SOURCE_EXPORTS",
        "APPROVED_M07_T05_PUBLIC_RUNTIME_KEYS",
        "APPROVED_M07_T05_INDEX_DISTRIBUTION_RECEIPTS",
      ]),
      target("scripts/lib/control-plane-bundle-verification-proof.mjs", [
        "APPROVED_M07_T05_TRACKED_RECEIPTS",
        "APPROVED_M07_T05_PUBLIC_SOURCE_EXPORTS",
        "APPROVED_M07_T05_PUBLIC_RUNTIME_KEYS",
        "APPROVED_M07_T05_INDEX_DISTRIBUTION_RECEIPTS",
        "M07_T05_BUNDLE_VERIFICATION_INTERNAL_TRACKED_RECEIPT_BRIDGE",
        "M07_T05_BUNDLE_VERIFICATION_INTERNAL_DISTRIBUTION_RECEIPT_BRIDGE",
      ]),
      target("tests/control-plane-bundle-verification.test.mjs", [
        "APP_BUNDLE_VERIFICATION_INTERNAL",
        "relativePath === APP_BUNDLE_VERIFICATION_INTERNAL",
      ]),
      target("scripts/lib/control-plane-package-preflight-proof.mjs", [
        "APPROVED_M07_T05_TRACKED_RECEIPTS",
        "APPROVED_M07_T05_PUBLIC_SOURCE_EXPORTS",
        "APPROVED_M07_T05_PUBLIC_RUNTIME_KEYS",
        "APPROVED_M07_T05_INDEX_DISTRIBUTION_RECEIPTS",
        "M07_T05_AGGREGATE_SUCCESSOR_COMMANDS",
      ]),
      target("tests/control-plane-package-preflight.test.mjs", [
        "pnpm verify:control-plane-reference-preflight && pnpm verify:control-plane-local-api",
      ]),
      target("scripts/lib/control-plane-reference-preflight-proof.mjs", [
        "APPROVED_M07_T05_TRACKED_RECEIPTS",
        "APPROVED_M07_T05_PUBLIC_SOURCE_EXPORTS",
        "APPROVED_M07_T05_PUBLIC_RUNTIME_KEYS",
        "APPROVED_M07_T05_INDEX_DISTRIBUTION_RECEIPTS",
        "HISTORICAL_M07_T04_TRACKED_RECEIPTS",
        "HISTORICAL_M07_T04_INDEX_DISTRIBUTION_RECEIPTS",
      ]),
      target("tests/control-plane-bundle-store.test.mjs", [
        "[registration] rejects package-root, public-export, aggregate, or CI tuple drift",
        "REGISTRATION_DRIFT",
      ]),
      target("tests/publisher-catalog-pinning.test.mjs", ["appendValidRootSuccessor"]),
      target("scripts/lib/control-plane-local-api-proof.mjs", [
        "M07_T05_STRICT_JSON_FORMATTING_TRACKED_RECEIPT_BRIDGE",
        "M07_T05_STRICT_JSON_FORMATTING_DISTRIBUTION_RECEIPT_BRIDGE",
        "M07_T05_FORMATTING_READER_RECEIPT_PROJECTION",
        "M07_T05_ADR_TOKEN_BOUNDS_TRACKED_RECEIPT_BRIDGE",
      ]),
      target("tests/control-plane-local-api.test.mjs", [
        "APP_STRICT_JSON",
        "ADR",
        "[implementation] rejects transport, repository, SQLite, or public-factory source drift",
      ]),
    ],
    "M07-T05",
  ),
  authority(
    "DEBT-I07-013",
    "I07-04",
    "G07",
    [
      target("scripts/lib/control-plane-bundle-store-proof.mjs", [
        "RUNTIME_STAGING_VALUE_EXPORTS",
        "RUNTIME_STAGING_TYPE_EXPORTS",
        "APPROVED_M07_T06_PUBLIC_SOURCE_EXPORTS",
        "APPROVED_M07_T06_PUBLIC_RUNTIME_KEYS",
        "APPROVED_M07_T06_TRACKED_RECEIPTS",
        "APPROVED_M07_T06_INDEX_DISTRIBUTION_RECEIPTS",
      ]),
      target("tests/control-plane-bundle-store.test.mjs", [
        "stageBundleRuntimeChanged",
        "unreviewedRuntimeSuccessor",
        'export { stageBundleRuntime } from "./runtime-staging.js";',
      ]),
      target("scripts/lib/control-plane-bundle-verification-proof.mjs", [
        "APPROVED_M07_T06_PUBLIC_SOURCE_EXPORTS",
        "APPROVED_M07_T06_PUBLIC_RUNTIME_KEYS",
        "APPROVED_M07_T06_TRACKED_RECEIPTS",
        "APPROVED_M07_T06_INDEX_DISTRIBUTION_RECEIPTS",
      ]),
      target("tests/control-plane-bundle-verification.test.mjs", [
        "changedStagingExport",
        "stageBundleRuntimeChanged",
        "unreviewedRuntimeSuccessor",
      ]),
      target("scripts/lib/control-plane-package-preflight-proof.mjs", [
        "APPROVED_M07_T06_PUBLIC_SOURCE_EXPORTS",
        "APPROVED_M07_T06_PUBLIC_RUNTIME_KEYS",
        "APPROVED_M07_T06_TRACKED_RECEIPTS",
        "APPROVED_M07_T06_INDEX_DISTRIBUTION_RECEIPTS",
        "M07_T06_AGGREGATE_SUCCESSOR_COMMANDS",
      ]),
      target("tests/control-plane-package-preflight.test.mjs", [
        "stageBundleRuntimeChanged",
        "pnpm verify:control-plane-runtime-staging-decoy",
        "unreviewedRuntimeSuccessor",
      ]),
      target("scripts/lib/control-plane-reference-preflight-proof.mjs", [
        "APPROVED_M07_T06_PUBLIC_SOURCE_EXPORTS",
        "APPROVED_M07_T06_PUBLIC_RUNTIME_KEYS",
        "APPROVED_M07_T06_TRACKED_RECEIPTS",
        "APPROVED_M07_T06_INDEX_DISTRIBUTION_RECEIPTS",
        "reviewedLaterSuccessor",
      ]),
      target("tests/control-plane-reference-preflight.test.mjs", [
        "stageBundleRuntimeChanged",
        "pnpm verify:control-plane-runtime-staging-decoy",
        "unreviewedRuntimeSuccessor",
      ]),
      target("scripts/lib/control-plane-local-api-proof.mjs", [
        "M07_T06_TRACKED_RECEIPT_BRIDGE",
        "M07_T06_INDEX_DISTRIBUTION_RECEIPT_BRIDGE",
        "APPROVED_M07_T06_PUBLIC_SOURCE_EXPORTS",
        "APPROVED_M07_T06_PUBLIC_RUNTIME_KEYS",
      ]),
      target("tests/control-plane-local-api.test.mjs", [
        "runControlPlaneLocalApiProbe",
        "LOCKFILE",
        "SHARED_STATE_AUTHORITY",
        "liveRuntimeReceipt",
        "successorBuild",
        "successorKeyMutations",
        "stageBundleRuntimeUnsafe",
        "unreviewedRuntimeExport",
      ]),
    ],
    "M07-T06",
  ),
  authority(
    "DEBT-I07-014",
    "I07-04",
    "G07",
    [
      target("scripts/lib/reference-host-web-source-audit-proof.mjs", [
        "M07_T07_CONTROL_PLANE_COORDINATION",
      ]),
      target("scripts/lib/control-plane-bundle-store-proof.mjs", [
        "RUNTIME_ACTIVATION_VALUE_EXPORTS",
        "RUNTIME_ACTIVATION_TYPE_EXPORTS",
        "APPROVED_M07_T07_TRACKED_RECEIPTS",
        "APPROVED_M07_T07_PUBLIC_SOURCE_EXPORTS",
        "APPROVED_M07_T07_PUBLIC_RUNTIME_KEYS",
        "APPROVED_M07_T07_INDEX_DISTRIBUTION_RECEIPTS",
      ]),
      target("tests/control-plane-bundle-store.test.mjs", ["openBundleRuntimeActivationChanged"]),
      target("scripts/lib/control-plane-bundle-verification-proof.mjs", [
        "APPROVED_M07_T07_PUBLIC_SOURCE_EXPORTS",
        "APPROVED_M07_T07_PUBLIC_RUNTIME_KEYS",
        "APPROVED_M07_T07_TRACKED_RECEIPTS",
        "APPROVED_M07_T07_INDEX_DISTRIBUTION_RECEIPTS",
      ]),
      target("tests/control-plane-bundle-verification.test.mjs", ["changedActivationExport"]),
      target("scripts/lib/control-plane-package-preflight-proof.mjs", [
        "APPROVED_M07_T07_PUBLIC_SOURCE_EXPORTS",
        "APPROVED_M07_T07_PUBLIC_RUNTIME_KEYS",
        "APPROVED_M07_T07_TRACKED_RECEIPTS",
        "APPROVED_M07_T07_INDEX_DISTRIBUTION_RECEIPTS",
        "M07_T07_AGGREGATE_SUCCESSOR_COMMANDS",
      ]),
      target("tests/control-plane-package-preflight.test.mjs", [
        "openBundleRuntimeActivationChanged",
        "pnpm verify:control-plane-runtime-activation-decoy",
      ]),
      target("scripts/lib/control-plane-reference-preflight-proof.mjs", [
        "APPROVED_M07_T07_PUBLIC_SOURCE_EXPORTS",
        "APPROVED_M07_T07_PUBLIC_RUNTIME_KEYS",
        "APPROVED_M07_T07_TRACKED_RECEIPTS",
        "APPROVED_M07_T07_INDEX_DISTRIBUTION_RECEIPTS",
      ]),
      target("tests/control-plane-reference-preflight.test.mjs", [
        "openBundleRuntimeActivationChanged",
        "pnpm verify:control-plane-runtime-activation-decoy",
      ]),
      target("scripts/lib/control-plane-local-api-proof.mjs", [
        "M07_T07_TRACKED_RECEIPT_BRIDGE",
        "M07_T07_INDEX_DISTRIBUTION_RECEIPT_BRIDGE",
        "APPROVED_M07_T07_PUBLIC_SOURCE_EXPORTS",
        "APPROVED_M07_T07_PUBLIC_RUNTIME_KEYS",
      ]),
      target("tests/control-plane-local-api.test.mjs", [
        "openBundleRuntimeActivationUnsafe",
        "successorBuild",
      ]),
      target("scripts/lib/control-plane-runtime-staging-proof.mjs", [
        "APPROVED_M07_T07_ACTIVATION_SOURCE_EXPORTS",
        "APPROVED_M07_T07_PUBLIC_RUNTIME_KEYS",
        "M07_T07_NORMATIVE_COVERAGE_SUCCESSOR_RECEIPTS",
        "M07_T07_TRACKED_RECEIPT_BRIDGE",
        "M07_T07_INDEX_DISTRIBUTION_RECEIPT_BRIDGE",
        "normalizedSuccessorLine",
        "reviewedM07T07Successor",
        "historicalRow",
      ]),
      target("scripts/lib/publisher-publish-result-proof.mjs", [
        "REVIEWED_G05_COMPATIBILITY_RECEIPT_HISTORY",
      ]),
      target("tests/publisher-publish-result.test.mjs", [
        "M07_T06_SOURCE_AUDIT_RECONSTRUCTION_PATCH",
        "reconstructM07T03SourceAuditProof",
      ]),
      target("scripts/lib/publisher-execution-preflight-proof.mjs", [
        "APPROVED_M05_COMPATIBILITY_RECEIPT_HISTORY",
        "APPROVED_CURRENT_M05_COMPATIBILITY_RECEIPTS",
      ]),
      target("tests/publisher-execution-preflight.test.mjs", ["compatibilitySources"]),
      target("scripts/lib/publisher-bundle-publication-proof.mjs", [
        "APPROVED_COMPATIBILITY_RECEIPT_HISTORY",
        "APPROVED_CURRENT_COMPATIBILITY_RECEIPTS",
      ]),
      target("tests/publisher-bundle-publication.test.mjs", ["appendValidRootSuccessor"]),
      target("tests/publisher-catalog-pinning.test.mjs", ["appendValidRootSuccessor"]),
      target("scripts/lib/publisher-invalid-source-matrix-proof.mjs", [
        "APPROVED_T09_SUCCESSOR_RECEIPT_HISTORY",
        "APPROVED_CURRENT_T09_SUCCESSOR_RECEIPTS",
        "REQUIRED_CURRENT_T09_PROOF_MARKERS",
        "HISTORICAL_PACKAGE_TEST_RECEIPT",
        "APPROVED_CURRENT_PACKAGE_TEST_RECEIPT",
        "HISTORICAL_RUNTIME_PROBE_PROGRAM_BYTES",
        "APPROVED_CURRENT_RUNTIME_PROBE_PROGRAM_BYTES",
        "historicalRuntimeProbeTransportClaim",
      ]),
      target("tests/publisher-invalid-source-matrix.test.mjs", [
        "appendValidRootSuccessor",
        "[authority] authenticates the bounded focused-suite timeout successor",
      ]),
    ],
    "M07-T07",
  ),
  authority(
    "DEBT-I07-015",
    "I07-04",
    "G07",
    [
      target("scripts/lib/reference-host-web-source-audit-proof.mjs", [
        "M07_T08_CONTROL_PLANE_COORDINATION",
      ]),
      target("tests/publisher-publish-result.test.mjs", [
        "M07_T08_SOURCE_AUDIT_RECONSTRUCTION_PATCH",
      ]),
      target("scripts/lib/control-plane-bundle-store-proof.mjs", [
        "APPROVED_M07_T08_TRACKED_RECEIPTS",
        "APPROVED_M07_T08_PUBLIC_SOURCE_EXPORTS",
        "APPROVED_M07_T08_PUBLIC_RUNTIME_KEYS",
        "APPROVED_M07_T08_INDEX_DISTRIBUTION_RECEIPTS",
        "approvedM07T08",
      ]),
      target("tests/control-plane-bundle-store.test.mjs", [
        "pnpm verify:control-plane-runtime-recovery && pnpm verify:control-plane-successor && pnpm lint",
        "pnpm test:control-plane-runtime-recovery && pnpm test:control-plane-successor && turbo run test",
      ]),
      target("scripts/lib/control-plane-bundle-verification-proof.mjs", [
        "APPROVED_M07_T08_PUBLIC_SOURCE_EXPORTS",
        "APPROVED_M07_T08_PUBLIC_RUNTIME_KEYS",
        "APPROVED_M07_T08_TRACKED_RECEIPTS",
        "APPROVED_M07_T08_INDEX_DISTRIBUTION_RECEIPTS",
        "approvedM07T08",
        "approvedM07T08Keys",
      ]),
      target("scripts/lib/control-plane-package-preflight-proof.mjs", [
        "APPROVED_M07_T08_PUBLIC_SOURCE_EXPORTS",
        "APPROVED_M07_T08_PUBLIC_RUNTIME_KEYS",
        "APPROVED_M07_T08_TRACKED_RECEIPTS",
        "APPROVED_M07_T08_INDEX_DISTRIBUTION_RECEIPTS",
        "M07_T08_AGGREGATE_SUCCESSOR_COMMANDS",
        "approvedM07T08",
      ]),
      target("scripts/lib/control-plane-reference-preflight-proof.mjs", [
        "APPROVED_M07_T08_PUBLIC_SOURCE_EXPORTS",
        "APPROVED_M07_T08_PUBLIC_RUNTIME_KEYS",
        "APPROVED_M07_T08_TRACKED_RECEIPTS",
        "APPROVED_M07_T08_INDEX_DISTRIBUTION_RECEIPTS",
        "approvedM07T08",
      ]),
      target("scripts/lib/control-plane-local-api-proof.mjs", [
        "M07_T08_TRACKED_RECEIPT_BRIDGE",
        "M07_T08_INDEX_DISTRIBUTION_RECEIPT_BRIDGE",
        "APPROVED_M07_T08_PUBLIC_SOURCE_EXPORTS",
        "APPROVED_M07_T08_PUBLIC_RUNTIME_KEYS",
        "currentSuccessorIndex",
        "reviewedCurrentSuccessorTail",
        "m07T08Bridge",
      ]),
      target("tests/control-plane-local-api.test.mjs", [
        "pnpm verify:control-plane-runtime-activation && pnpm verify:control-plane-runtime-recovery",
        "pnpm verify:control-plane-runtime-recovery",
      ]),
      target("scripts/lib/control-plane-runtime-staging-proof.mjs", [
        "APPROVED_M07_T08_ACTIVATION_SOURCE_EXPORTS",
        "APPROVED_M07_T08_PUBLIC_RUNTIME_KEYS",
        "M07_T08_NORMATIVE_COVERAGE_SUCCESSOR_RECEIPTS",
        "M07_T08_TRACKED_RECEIPT_BRIDGE",
        "M07_T08_READER_RECEIPT_PROJECTION",
        "M07_T08_INDEX_DISTRIBUTION_RECEIPT_BRIDGE",
        "reviewedM07T08Activation",
        "reviewedM07T08Tail",
        "m07T08Bridge",
        "m07T08SuccessorReceipt",
        "reviewedM07T08Successor",
      ]),
      target("tests/control-plane-runtime-staging.test.mjs", [
        "INVALID_RUNTIME_RECOVERY_AUTHORITY_CODE_CHANGED",
        "pnpm verify:control-plane-runtime-recovery-decoy",
        "recoverySuccessorReceipt",
        "recoverySuccessorBuild",
        "unreviewedRecoverySuccessor",
      ]),
      target("scripts/lib/control-plane-runtime-activation-proof.mjs", [
        "M07_T08_RUNTIME_TEST_NAMES",
        "M07_T07_DOCUMENTED_ACTIVATION_SOURCE_EXPORTS",
        "M07_T08_DOCUMENTED_ACTIVATION_SOURCE_EXPORTS",
        "M07_T08_TRACKED_RECEIPT_BRIDGE",
        "M07_T08_READER_RECEIPT_PROJECTION",
        "M07_T08_ACTIVATION_DISTRIBUTION_RECEIPT_BRIDGE",
        "M07_T08_INDEX_DISTRIBUTION_RECEIPT_BRIDGE",
        "M07_T07_ACTIVATION_PUBLIC_EXPORTS",
        "M07_T08_RECOVERY_PUBLIC_EXPORTS",
        "M07_T08_ACTIVATION_PUBLIC_EXPORTS",
        "M07_T08_RECOVERY_PUBLIC_EXPORT_NAMES",
        "function assertAdjacent(",
        "M07_T07_PUBLIC_RUNTIME_KEYS",
        "M07_T08_PUBLIC_RUNTIME_KEYS",
        "M07_T07_ACTIVATION_SERVICE_KEYS",
        "M07_T08_ACTIVATION_SERVICE_KEYS",
      ]),
      target("tests/control-plane-runtime-activation.test.mjs", [
        "INVALID_RECOVERY_AUTHORITY_CODE",
        "pnpm verify:control-plane-runtime-activation && pnpm verify:control-plane-runtime-recovery",
        "pnpm verify:control-plane-runtime-recovery && pnpm verify:control-plane-runtime-activation",
      ]),
    ],
    "M07-T08",
  ),
  authority(
    "DEBT-I07-016",
    "I07-04",
    "G07",
    [
      target("scripts/lib/control-plane-bundle-store-proof.mjs", [
        "APPROVED_M07_T09_TRACKED_RECEIPTS",
        "approvedM07T09",
      ]),
      target("tests/control-plane-bundle-store.test.mjs", [
        "test/runtime-fault-injection-decoy.test.ts",
      ]),
      target("scripts/lib/control-plane-bundle-verification-proof.mjs", [
        "APPROVED_M07_T09_TRACKED_RECEIPTS",
        "approvedM07T09",
      ]),
      target("tests/control-plane-bundle-verification.test.mjs", [
        "faultInjectionScriptDrift",
        "faultInjectionAggregateDrift",
        "control-plane-runtime-fault-injection-decoy",
      ]),
      target("scripts/lib/control-plane-package-preflight-proof.mjs", [
        "APPROVED_M07_T09_TRACKED_RECEIPTS",
        "M07_T09_AGGREGATE_SUCCESSOR_COMMANDS",
        "approvedM07T09",
        "reviewedFaultInjectionSuccessor",
      ]),
      target("tests/control-plane-package-preflight.test.mjs", [
        "test/runtime-fault-injection-decoy.test.ts",
        "control-plane-runtime-fault-injection-decoy",
      ]),
      target("scripts/lib/control-plane-reference-preflight-proof.mjs", [
        "APPROVED_M07_T09_TRACKED_RECEIPTS",
        "approvedM07T09",
        "reviewedFaultInjectionSuccessor",
      ]),
      target("tests/control-plane-reference-preflight.test.mjs", [
        "test/runtime-fault-injection-decoy.test.ts",
        "control-plane-runtime-fault-injection-decoy",
      ]),
      target("scripts/lib/control-plane-local-api-proof.mjs", [
        "M07_T09_TRACKED_RECEIPT_BRIDGE",
        "m07T09Bridge",
        "faultInjectionSuccessor",
        "reviewedFaultInjectionSuccessorTail",
      ]),
      target("tests/control-plane-local-api.test.mjs", [
        "test/runtime-fault-injection-decoy.test.ts",
        "control-plane-runtime-fault-injection-decoy",
      ]),
      target("scripts/lib/control-plane-runtime-staging-proof.mjs", [
        "M07_T09_TRACKED_RECEIPT_BRIDGE",
        "M07_T09_NORMATIVE_COVERAGE_SUCCESSOR_RECEIPTS",
        "m07T09Bridge",
        "reviewedM07T09Tail",
        "reviewedM07T09Successor",
      ]),
      target("tests/control-plane-runtime-staging.test.mjs", [
        "test/runtime-fault-injection-decoy.test.ts",
        "control-plane-runtime-fault-injection-decoy",
        "M07-T09 claims",
      ]),
      target("scripts/lib/control-plane-runtime-activation-proof.mjs", [
        "M07_T09_TRACKED_RECEIPT_BRIDGE",
        "M07_T09_N004_SUCCESSOR_RECEIPT",
        "faultInjectionBridge",
        "approvedFaultInjectionCurrent",
        "approvedM07T09N004",
      ]),
      target("tests/control-plane-runtime-activation.test.mjs", [
        "test/runtime-fault-injection-decoy.test.ts",
        "control-plane-runtime-fault-injection-decoy",
        "| IMPLEMENTED |",
      ]),
      target("scripts/lib/control-plane-runtime-recovery-proof.mjs", [
        "M07_T09_REGISTRATION_AUTHORITY_RECEIPTS",
        "M07_T09_TEST_AUTHORITY_RECEIPTS",
        "M07_T09_TRACKED_RECEIPT_BRIDGE",
        "M07_T09_READER_RECEIPT_PROJECTION",
        "trackedFileReceipts",
        "reviewed M07-T09 CI registration set",
      ]),
      target("tests/control-plane-runtime-recovery.test.mjs", [
        "test/runtime-fault-injection-decoy.test.ts",
        "control-plane-runtime-fault-injection-decoy",
        "M07-T09 claims without proof",
      ]),
    ],
    "M07-T09",
  ),
  authority(
    "DEBT-I07-017",
    "I07-04",
    "G07",
    [
      target(".github/workflows/ci.yml", [
        "affected-shadow",
        "Affected shadow observation",
        "Verify shadow affected contracts",
        "Run non-authoritative affected shadow",
        "DESEN_CI_BASE_SHA",
        "DESEN_CI_HEAD_SHA",
        "DESEN_CI_SAME_REPOSITORY",
        "scripts/ci/run-shadow-affected-quality-gate.mjs",
      ]),
      target("scripts/ci/run-shadow-affected-quality-gate.mjs", [
        "SHADOW_AFFECTED_RECEIPT_PROFILE",
        "runShadowAffectedQualityGate",
        "executeShadowAffectedQualityGate",
        "printShadowAffectedReceipt",
      ]),
      target("scripts/ci/test/shadow-affected-quality-gate.test.mjs", [
        "runs every selected command fresh and closes one exact strict subset",
        "exhaustive fallback executes no duplicate shadow workload",
        "a selected failure stops later work and remains non-authoritative",
      ]),
    ],
    "I07-03",
  ),
]);

/**
 * Error raised when infrastructure debt authority, lifecycle, documentation, or filesystem
 * integrity fails closed.
 */
export class InfrastructureDebtError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "InfrastructureDebtError";
    this.code = code;
    this.details = SAFE_OBJECT_FREEZE({ ...details });
  }
}

function fail(code, message, details = {}) {
  throw new InfrastructureDebtError(code, message, details);
}

function arrayContains(values, candidate) {
  let index = 0;
  while (index < values.length) {
    if (values[index] === candidate) return true;
    index += 1;
  }
  return false;
}

function exactOwnDataRecord(value, expectedKeys, label, code) {
  if (
    typeof value !== "object" ||
    value === null ||
    SAFE_UTIL_IS_PROXY(value) ||
    SAFE_ARRAY_IS_ARRAY(value) ||
    SAFE_OBJECT_GET_PROTOTYPE_OF(value) !== SAFE_OBJECT_PROTOTYPE
  ) {
    fail(code, `${label} must be one exact ordinary own-data record.`);
  }
  const keys = SAFE_REFLECT_OWN_KEYS(value);
  if (keys.length !== expectedKeys.length) {
    fail(code, `${label} has an unexpected field count.`, {
      expectedKeys,
      actualKeys: keys,
    });
  }
  let index = 0;
  while (index < expectedKeys.length) {
    const key = keys[index];
    const descriptor =
      typeof key === "string" ? SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR(value, key) : undefined;
    if (
      key !== expectedKeys[index] ||
      descriptor === undefined ||
      !descriptor.enumerable ||
      !("value" in descriptor)
    ) {
      fail(code, `${label} fields must be exact ordered enumerable own data.`, {
        index,
        expectedKey: expectedKeys[index],
        actualKey: typeof key === "string" ? key : String(key),
      });
    }
    index += 1;
  }
  return value;
}

function exactOptions(value) {
  if (
    typeof value !== "object" ||
    value === null ||
    SAFE_UTIL_IS_PROXY(value) ||
    SAFE_ARRAY_IS_ARRAY(value) ||
    SAFE_OBJECT_GET_PROTOTYPE_OF(value) !== SAFE_OBJECT_PROTOTYPE
  ) {
    fail(
      "INFRASTRUCTURE_DEBT_OPTIONS_INVALID",
      "Verification options must be one ordinary own-data record.",
    );
  }
  const keys = SAFE_REFLECT_OWN_KEYS(value);
  if (keys.length > OPTION_KEYS.length) {
    fail("INFRASTRUCTURE_DEBT_OPTIONS_INVALID", "Verification options contain too many fields.");
  }
  let index = 0;
  while (index < keys.length) {
    const key = keys[index];
    const descriptor =
      typeof key === "string" ? SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR(value, key) : undefined;
    if (
      typeof key !== "string" ||
      !arrayContains(OPTION_KEYS, key) ||
      descriptor === undefined ||
      !descriptor.enumerable ||
      !("value" in descriptor)
    ) {
      fail(
        "INFRASTRUCTURE_DEBT_OPTIONS_INVALID",
        "Verification options contain an unsupported or active field.",
      );
    }
    index += 1;
  }
  return value;
}

function exactDenseArray(value, label, maximumLength) {
  if (
    typeof value !== "object" ||
    value === null ||
    SAFE_UTIL_IS_PROXY(value) ||
    !SAFE_ARRAY_IS_ARRAY(value) ||
    SAFE_OBJECT_GET_PROTOTYPE_OF(value) !== Array.prototype ||
    value.length > maximumLength
  ) {
    fail(
      "INFRASTRUCTURE_DEBT_SCHEMA_INVALID",
      `${label} must be one bounded ordinary dense array.`,
    );
  }
  const keys = SAFE_REFLECT_OWN_KEYS(value);
  if (keys.length !== value.length + 1 || !arrayContains(keys, "length")) {
    fail(
      "INFRASTRUCTURE_DEBT_SCHEMA_INVALID",
      `${label} must contain only its exact dense indexes.`,
    );
  }
  let index = 0;
  while (index < value.length) {
    const descriptor = SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR(value, String(index));
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      fail(
        "INFRASTRUCTURE_DEBT_SCHEMA_INVALID",
        `${label} contains a sparse or accessor-backed entry.`,
        { index },
      );
    }
    index += 1;
  }
  return value;
}

function assertExactString(actual, expected, label) {
  if (actual !== expected) {
    fail(
      "INFRASTRUCTURE_DEBT_AUTHORITY_DRIFT",
      `${label} differs from code-owned cleanup authority.`,
      { expected, actual },
    );
  }
  return actual;
}

function normalizeTarget(rawTarget, expected, entryId, targetIndex) {
  const targetRecord = exactOwnDataRecord(
    rawTarget,
    TARGET_KEYS,
    `${entryId} target ${targetIndex}`,
    "INFRASTRUCTURE_DEBT_SCHEMA_INVALID",
  );
  assertExactString(targetRecord.path, expected.path, `${entryId} target ${targetIndex} path`);
  const rawSymbols = exactDenseArray(
    targetRecord.symbols,
    `${entryId} target ${targetIndex} symbols`,
    expected.symbols.length,
  );
  if (rawSymbols.length !== expected.symbols.length) {
    fail(
      "INFRASTRUCTURE_DEBT_AUTHORITY_DRIFT",
      `${entryId} target ${targetIndex} has an unexpected symbol count.`,
      { expected: expected.symbols.length, actual: rawSymbols.length },
    );
  }
  const symbols = [];
  let symbolIndex = 0;
  while (symbolIndex < rawSymbols.length) {
    assertExactString(
      rawSymbols[symbolIndex],
      expected.symbols[symbolIndex],
      `${entryId} target ${targetIndex} symbol ${symbolIndex}`,
    );
    symbols[symbolIndex] = rawSymbols[symbolIndex];
    symbolIndex += 1;
  }
  return {
    path: targetRecord.path,
    symbols,
  };
}

function normalizeEvidence(rawEvidence, status, entryId) {
  if (status === "OPEN") {
    if (rawEvidence !== null) {
      fail(
        "INFRASTRUCTURE_DEBT_EVIDENCE_INVALID",
        `${entryId} is OPEN and therefore must carry null evidence.`,
        { id: entryId },
      );
    }
    return null;
  }
  const evidence = exactOwnDataRecord(
    rawEvidence,
    EVIDENCE_KEYS,
    `${entryId} evidence`,
    "INFRASTRUCTURE_DEBT_EVIDENCE_INVALID",
  );
  const expectedKind = status === "READY_FOR_REMOVAL" ? "READINESS" : "CLOSURE";
  if (evidence.kind !== expectedKind) {
    fail(
      "INFRASTRUCTURE_DEBT_EVIDENCE_INVALID",
      `${entryId} evidence kind does not match its lifecycle status.`,
      { id: entryId, expected: expectedKind, actual: evidence.kind },
    );
  }
  if (!/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/u.test(evidence.commitSha)) {
    fail("INFRASTRUCTURE_DEBT_EVIDENCE_INVALID", `${entryId} commit SHA is invalid.`);
  }
  if (
    !/^https:\/\/github\.com\/desenlab\/desen-app\/pull\/[1-9][0-9]*$/u.test(
      evidence.pullRequestUrl,
    )
  ) {
    fail("INFRASTRUCTURE_DEBT_EVIDENCE_INVALID", `${entryId} pull-request URL is invalid.`);
  }
  assertSafeRelativePath(evidence.evidencePath);
  if (
    !evidence.evidencePath.startsWith("docs/proof/") ||
    !evidence.evidencePath.endsWith(".json")
  ) {
    fail(
      "INFRASTRUCTURE_DEBT_EVIDENCE_INVALID",
      `${entryId} evidence must be one JSON artifact under docs/proof/.`,
    );
  }
  if (!/^[0-9a-f]{64}$/u.test(evidence.evidenceSha256)) {
    fail("INFRASTRUCTURE_DEBT_EVIDENCE_INVALID", `${entryId} evidence SHA-256 is invalid.`);
  }
  if (
    !/^https:\/\/github\.com\/desenlab\/desen-app\/actions\/runs\/[1-9][0-9]*$/u.test(
      evidence.hostedRunUrl,
    )
  ) {
    fail("INFRASTRUCTURE_DEBT_EVIDENCE_INVALID", `${entryId} hosted-run URL is invalid.`);
  }
  return {
    kind: evidence.kind,
    commitSha: evidence.commitSha,
    pullRequestUrl: evidence.pullRequestUrl,
    evidencePath: evidence.evidencePath,
    evidenceSha256: evidence.evidenceSha256,
    hostedRunUrl: evidence.hostedRunUrl,
  };
}

function normalizeEntry(rawEntry, expected, entryIndex) {
  const entry = exactOwnDataRecord(
    rawEntry,
    ENTRY_KEYS,
    `debt entry ${entryIndex}`,
    "INFRASTRUCTURE_DEBT_SCHEMA_INVALID",
  );
  assertExactString(entry.id, expected.id, `debt entry ${entryIndex} id`);
  if (!arrayContains(ALLOWED_STATUSES, entry.status)) {
    fail("INFRASTRUCTURE_DEBT_SCHEMA_INVALID", `${entry.id} has an unsupported lifecycle status.`, {
      status: entry.status,
    });
  }
  const evidence = normalizeEvidence(entry.evidence, entry.status, entry.id);
  assertExactString(entry.registeredBy, expected.registeredBy, `${entry.id} registration task`);
  assertExactString(entry.removalOwner, expected.removalOwner, `${entry.id} removal owner`);
  assertExactString(entry.deadline, expected.deadline, `${entry.id} deadline`);
  const rawTargets = exactDenseArray(entry.targets, `${entry.id} targets`, expected.targets.length);
  if (rawTargets.length !== expected.targets.length) {
    fail("INFRASTRUCTURE_DEBT_AUTHORITY_DRIFT", `${entry.id} has an unexpected target count.`, {
      expected: expected.targets.length,
      actual: rawTargets.length,
    });
  }
  const targets = [];
  let targetIndex = 0;
  while (targetIndex < rawTargets.length) {
    targets[targetIndex] = normalizeTarget(
      rawTargets[targetIndex],
      expected.targets[targetIndex],
      entry.id,
      targetIndex,
    );
    targetIndex += 1;
  }
  return {
    id: entry.id,
    status: entry.status,
    evidence,
    registeredBy: entry.registeredBy,
    removalOwner: entry.removalOwner,
    deadline: entry.deadline,
    targets,
  };
}

function assertUniqueAuthority(entries) {
  let left = 0;
  while (left < entries.length) {
    let right = left + 1;
    while (right < entries.length) {
      if (entries[left].id === entries[right].id) {
        fail("INFRASTRUCTURE_DEBT_SCHEMA_INVALID", "Debt entry IDs must be unique.", {
          id: entries[left].id,
        });
      }
      right += 1;
    }
    left += 1;
  }
}

function normalizeManifest(rawManifest) {
  const manifest = exactOwnDataRecord(
    rawManifest,
    ROOT_KEYS,
    "infrastructure debt manifest",
    "INFRASTRUCTURE_DEBT_SCHEMA_INVALID",
  );
  if (manifest.schemaVersion !== 1 || manifest.profile !== PROFILE) {
    fail(
      "INFRASTRUCTURE_DEBT_SCHEMA_INVALID",
      "Infrastructure debt schema version or profile drifted.",
      { schemaVersion: manifest.schemaVersion, profile: manifest.profile },
    );
  }
  const rawEntries = exactDenseArray(
    manifest.entries,
    "infrastructure debt entries",
    INFRASTRUCTURE_DEBT_AUTHORITY.length,
  );
  if (rawEntries.length !== INFRASTRUCTURE_DEBT_AUTHORITY.length) {
    fail(
      "INFRASTRUCTURE_DEBT_AUTHORITY_DRIFT",
      "The manifest must contain the exact code-owned debt inventory.",
      {
        expected: INFRASTRUCTURE_DEBT_AUTHORITY.length,
        actual: rawEntries.length,
      },
    );
  }
  const entries = [];
  let entryIndex = 0;
  while (entryIndex < rawEntries.length) {
    entries[entryIndex] = normalizeEntry(
      rawEntries[entryIndex],
      INFRASTRUCTURE_DEBT_AUTHORITY[entryIndex],
      entryIndex,
    );
    entryIndex += 1;
  }
  assertUniqueAuthority(entries);
  return {
    schemaVersion: 1,
    profile: PROFILE,
    entries,
  };
}

function deepFreezeJson(value) {
  if (value !== null && typeof value === "object") {
    if (SAFE_ARRAY_IS_ARRAY(value)) {
      let index = 0;
      while (index < value.length) {
        deepFreezeJson(value[index]);
        index += 1;
      }
    } else {
      const keys = SAFE_REFLECT_OWN_KEYS(value);
      let index = 0;
      while (index < keys.length) {
        deepFreezeJson(value[keys[index]]);
        index += 1;
      }
    }
    SAFE_OBJECT_FREEZE(value);
  }
  return value;
}

/**
 * Validates an in-memory manifest without trusting active objects or manifest-owned authority.
 */
export function validateInfrastructureDebtManifest(rawManifest) {
  return deepFreezeJson(normalizeManifest(rawManifest));
}

function serializeSymbolProperty(symbols) {
  const compactValues = symbols.map((symbol) => SAFE_JSON_STRINGIFY(symbol)).join(", ");
  const compact = `          "symbols": [${compactValues}]`;
  if (compact.length <= 100) return [compact];
  const lines = ['          "symbols": ['];
  let index = 0;
  while (index < symbols.length) {
    const suffix = index + 1 === symbols.length ? "" : ",";
    lines.push(`            ${SAFE_JSON_STRINGIFY(symbols[index])}${suffix}`);
    index += 1;
  }
  lines.push("          ]");
  return lines;
}

/**
 * Returns the one accepted canonical UTF-8 representation of a valid manifest.
 */
export function canonicalizeInfrastructureDebtManifest(rawManifest) {
  const manifest = normalizeManifest(rawManifest);
  const lines = [
    "{",
    '  "schemaVersion": 1,',
    `  "profile": ${SAFE_JSON_STRINGIFY(PROFILE)},`,
    '  "entries": [',
  ];
  let entryIndex = 0;
  while (entryIndex < manifest.entries.length) {
    const entry = manifest.entries[entryIndex];
    lines.push(
      "    {",
      `      "id": ${SAFE_JSON_STRINGIFY(entry.id)},`,
      `      "status": ${SAFE_JSON_STRINGIFY(entry.status)},`,
      entry.evidence === null
        ? '      "evidence": null,'
        : [
            '      "evidence": {',
            `        "kind": ${SAFE_JSON_STRINGIFY(entry.evidence.kind)},`,
            `        "commitSha": ${SAFE_JSON_STRINGIFY(entry.evidence.commitSha)},`,
            `        "pullRequestUrl": ${SAFE_JSON_STRINGIFY(entry.evidence.pullRequestUrl)},`,
            `        "evidencePath": ${SAFE_JSON_STRINGIFY(entry.evidence.evidencePath)},`,
            `        "evidenceSha256": ${SAFE_JSON_STRINGIFY(entry.evidence.evidenceSha256)},`,
            `        "hostedRunUrl": ${SAFE_JSON_STRINGIFY(entry.evidence.hostedRunUrl)}`,
            "      },",
          ].join("\n"),
      `      "registeredBy": ${SAFE_JSON_STRINGIFY(entry.registeredBy)},`,
      `      "removalOwner": ${SAFE_JSON_STRINGIFY(entry.removalOwner)},`,
      `      "deadline": ${SAFE_JSON_STRINGIFY(entry.deadline)},`,
      '      "targets": [',
    );
    let targetIndex = 0;
    while (targetIndex < entry.targets.length) {
      const targetEntry = entry.targets[targetIndex];
      lines.push(
        "        {",
        `          "path": ${SAFE_JSON_STRINGIFY(targetEntry.path)},`,
        ...serializeSymbolProperty(targetEntry.symbols),
        targetIndex + 1 === entry.targets.length ? "        }" : "        },",
      );
      targetIndex += 1;
    }
    lines.push("      ]", entryIndex + 1 === manifest.entries.length ? "    }" : "    },");
    entryIndex += 1;
  }
  lines.push("  ]", "}", "");
  return lines.join("\n");
}

function copyExactBytes(rawBytes) {
  if (
    typeof rawBytes !== "object" ||
    rawBytes === null ||
    SAFE_UTIL_IS_PROXY(rawBytes) ||
    !SAFE_UTIL_IS_UINT8_ARRAY(rawBytes)
  ) {
    fail("INFRASTRUCTURE_DEBT_BYTES_INVALID", "Manifest bytes must be one inert Uint8Array.");
  }
  return SAFE_BUFFER_FROM(rawBytes);
}

function decodeUtf8(bytes, label) {
  try {
    const decoder = new SAFE_TEXT_DECODER("utf-8", { fatal: true, ignoreBOM: false });
    return SAFE_TEXT_DECODER_DECODE.call(decoder, bytes);
  } catch (error) {
    fail("INFRASTRUCTURE_DEBT_UTF8_INVALID", `${label} must be valid UTF-8.`, {
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Parses bounded manifest bytes and rejects every non-canonical JSON encoding.
 */
export function parseInfrastructureDebtManifest(rawBytes) {
  const bytes = copyExactBytes(rawBytes);
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_MANIFEST_BYTES) {
    fail(
      "INFRASTRUCTURE_DEBT_BYTES_INVALID",
      "Infrastructure debt manifest bytes are empty or exceed the fixed bound.",
      { bytes: bytes.byteLength, maximum: MAX_MANIFEST_BYTES },
    );
  }
  const text = decodeUtf8(bytes, "Infrastructure debt manifest");
  let parsed;
  try {
    parsed = SAFE_JSON_PARSE(text);
  } catch (error) {
    fail("INFRASTRUCTURE_DEBT_JSON_INVALID", "Infrastructure debt manifest is not valid JSON.", {
      cause: error instanceof Error ? error.message : String(error),
    });
  }
  const normalized = validateInfrastructureDebtManifest(parsed);
  if (text !== canonicalizeInfrastructureDebtManifest(normalized)) {
    fail(
      "INFRASTRUCTURE_DEBT_CANONICAL_INVALID",
      "Infrastructure debt manifest must use its exact canonical JSON encoding.",
    );
  }
  return normalized;
}

function assertSafeRelativePath(relativePath) {
  if (
    typeof relativePath !== "string" ||
    relativePath.length === 0 ||
    relativePath.includes("\0") ||
    relativePath.includes("\\") ||
    path.posix.isAbsolute(relativePath) ||
    path.posix.normalize(relativePath) !== relativePath ||
    relativePath === ".." ||
    relativePath.startsWith("../")
  ) {
    fail(
      "INFRASTRUCTURE_DEBT_PATH_INVALID",
      "A code-owned debt path is not one normalized workspace-relative POSIX path.",
      { path: relativePath },
    );
  }
}

async function readSecureFile(
  workspaceRoot,
  canonicalRoot,
  relativePath,
  maximumBytes,
  allowMissing,
) {
  assertSafeRelativePath(relativePath);
  const absolutePath = path.join(workspaceRoot, ...relativePath.split("/"));
  let before;
  try {
    before = await lstat(absolutePath);
  } catch (error) {
    if (allowMissing && error && typeof error === "object" && error.code === "ENOENT") {
      return undefined;
    }
    fail(
      "INFRASTRUCTURE_DEBT_FILE_INVALID",
      `Required debt file "${relativePath}" is unavailable.`,
      { path: relativePath, cause: error instanceof Error ? error.message : String(error) },
    );
  }
  if (!before.isFile() || before.isSymbolicLink()) {
    fail(
      "INFRASTRUCTURE_DEBT_FILE_INVALID",
      `Debt file "${relativePath}" must be one regular non-symlink file.`,
      { path: relativePath },
    );
  }
  if (before.size <= 0 || before.size > maximumBytes) {
    fail(
      "INFRASTRUCTURE_DEBT_FILE_INVALID",
      `Debt file "${relativePath}" is empty or exceeds its fixed bound.`,
      { path: relativePath, bytes: before.size, maximum: maximumBytes },
    );
  }
  const resolvedTarget = await realpath(absolutePath);
  const expectedTarget = path.join(canonicalRoot, ...relativePath.split("/"));
  if (resolvedTarget !== expectedTarget) {
    fail(
      "INFRASTRUCTURE_DEBT_FILE_INVALID",
      `Debt file "${relativePath}" traverses a symlinked path.`,
      { path: relativePath },
    );
  }

  let handle;
  try {
    handle = await open(absolutePath, READ_FLAGS);
    const opened = await handle.stat();
    if (
      !opened.isFile() ||
      opened.dev !== before.dev ||
      opened.ino !== before.ino ||
      opened.size !== before.size
    ) {
      fail(
        "INFRASTRUCTURE_DEBT_FILE_INVALID",
        `Debt file "${relativePath}" changed during secure open.`,
        { path: relativePath },
      );
    }
    const bytes = await handle.readFile();
    const after = await handle.stat();
    if (
      after.dev !== opened.dev ||
      after.ino !== opened.ino ||
      after.size !== opened.size ||
      bytes.byteLength !== opened.size
    ) {
      fail(
        "INFRASTRUCTURE_DEBT_FILE_INVALID",
        `Debt file "${relativePath}" changed during capture.`,
        { path: relativePath },
      );
    }
    return bytes;
  } catch (error) {
    if (error instanceof InfrastructureDebtError) throw error;
    fail(
      "INFRASTRUCTURE_DEBT_FILE_INVALID",
      `Debt file "${relativePath}" could not be read safely.`,
      { path: relativePath, cause: error instanceof Error ? error.message : String(error) },
    );
  } finally {
    await handle?.close();
  }
}

async function trackedIndex(workspaceRoot) {
  let stdout;
  try {
    ({ stdout } = await EXEC_FILE("git", ["ls-files", "--stage", "-z"], {
      cwd: workspaceRoot,
      encoding: "buffer",
      maxBuffer: MAX_GIT_OUTPUT_BYTES,
    }));
  } catch (error) {
    fail(
      "INFRASTRUCTURE_DEBT_GIT_INVALID",
      "The tracked workspace index could not be enumerated.",
      { cause: error instanceof Error ? error.message : String(error) },
    );
  }
  const text = decodeUtf8(stdout, "Git tracked-path inventory");
  const records = text.split("\0");
  const tracked = new Map();
  let index = 0;
  while (index < records.length) {
    const record = records[index];
    if (record.length === 0) {
      index += 1;
      continue;
    }
    const match = /^(100644|100755|120000|160000) [0-9a-f]{40,64} ([0-3])\t(.+)$/u.exec(record);
    if (match === null || match[2] !== "0" || tracked.has(match[3])) {
      fail(
        "INFRASTRUCTURE_DEBT_GIT_INVALID",
        "The tracked workspace contains an unsupported or unresolved index record.",
        { record },
      );
    }
    tracked.set(match[3], match[1]);
    index += 1;
  }
  return tracked;
}

function assertTrackedRegular(tracked, relativePath) {
  const mode = tracked.get(relativePath);
  if (mode !== "100644" && mode !== "100755") {
    fail(
      "INFRASTRUCTURE_DEBT_TRACKED_PATH_INVALID",
      `Debt path "${relativePath}" must be tracked as one regular file.`,
      { path: relativePath, mode },
    );
  }
}

function exactField(lines, prefix, label, sectionId) {
  const matches = lines.filter((line) => line.startsWith(prefix));
  if (matches.length !== 1) {
    fail(
      "INFRASTRUCTURE_DEBT_DOCUMENTATION_DRIFT",
      `${sectionId} must contain exactly one ${label}.`,
      { sectionId, label, matches: matches.length },
    );
  }
  const encodedValue = matches[0].slice(prefix.length);
  if (
    encodedValue.length < 3 ||
    encodedValue[0] !== "`" ||
    encodedValue[encodedValue.length - 1] !== "`" ||
    encodedValue.slice(1, -1).includes("`")
  ) {
    fail("INFRASTRUCTURE_DEBT_DOCUMENTATION_DRIFT", `${sectionId} ${label} has malformed syntax.`, {
      sectionId,
      label,
    });
  }
  return encodedValue.slice(1, -1);
}

function evidenceState(lines, entry) {
  const matches = lines.filter((line) => line.startsWith("- Closure evidence: "));
  if (matches.length !== 1) {
    fail(
      "INFRASTRUCTURE_DEBT_DOCUMENTATION_DRIFT",
      `${entry.id} must contain exactly one closure-evidence state.`,
      { id: entry.id, matches: matches.length },
    );
  }
  const match = /^- Closure evidence: `(PENDING|READINESS|CLOSURE)`(?:\s+—.*)?$/u.exec(matches[0]);
  const expected = entry.evidence?.kind ?? "PENDING";
  if (match === null || match[1] !== expected) {
    fail(
      "INFRASTRUCTURE_DEBT_DOCUMENTATION_DRIFT",
      `${entry.id} closure-evidence state differs from the authenticated manifest.`,
      { id: entry.id, expected, actual: match?.[1] },
    );
  }
  return expected;
}

function assertSectionProjection(sectionLines, entry) {
  for (const targetEntry of entry.targets) {
    const pathLine = `  - \`${targetEntry.path}\``;
    const pathIndexes = sectionLines.flatMap((line, index) => (line === pathLine ? [index] : []));
    if (pathIndexes.length !== 1) {
      fail(
        "INFRASTRUCTURE_DEBT_DOCUMENTATION_DRIFT",
        `${entry.id} must project target path "${targetEntry.path}" exactly once.`,
        { id: entry.id, path: targetEntry.path, matches: pathIndexes.length },
      );
    }
    const start = pathIndexes[0] + 1;
    let end = start;
    while (end < sectionLines.length && !/^ {2}- `[^`]+`$/u.test(sectionLines[end])) end += 1;
    const targetLines = sectionLines.slice(start, end);
    for (const symbol of targetEntry.symbols) {
      const symbolLine = `    - \`${symbol}\``;
      const matches = targetLines.filter((line) => line === symbolLine).length;
      if (matches !== 1) {
        fail(
          "INFRASTRUCTURE_DEBT_DOCUMENTATION_DRIFT",
          `${entry.id} must project symbol "${symbol}" exactly once under its target.`,
          { id: entry.id, path: targetEntry.path, symbol, matches },
        );
      }
    }
  }
}

function parseDebtRegister(text, entries) {
  const lines = text.split("\n");
  const summaryRecords = [];
  let summaryLineIndex = 0;
  while (summaryLineIndex < lines.length) {
    const cells = lines[summaryLineIndex].split("|").map((cell) => cell.trim());
    if (
      cells.length === 8 &&
      /^DEBT-I07-\d{3}$/u.test(cells[1]) &&
      arrayContains(ALLOWED_STATUSES, cells[2])
    ) {
      summaryRecords.push({
        id: cells[1],
        status: cells[2],
        registeredBy: cells[4],
        removalOwner: cells[5],
        deadline: cells[6],
      });
    }
    summaryLineIndex += 1;
  }
  if (summaryRecords.length !== entries.length) {
    fail(
      "INFRASTRUCTURE_DEBT_DOCUMENTATION_DRIFT",
      "The cleanup-register summary must contain the exact machine-owned debt inventory.",
      { expected: entries.length, actual: summaryRecords.length },
    );
  }
  let summaryIndex = 0;
  while (summaryIndex < entries.length) {
    const entry = entries[summaryIndex];
    const summary = summaryRecords[summaryIndex];
    if (
      summary.id !== entry.id ||
      summary.status !== entry.status ||
      summary.registeredBy !== entry.registeredBy ||
      summary.removalOwner !== entry.removalOwner ||
      summary.deadline !== entry.deadline
    ) {
      fail(
        "INFRASTRUCTURE_DEBT_DOCUMENTATION_DRIFT",
        "Cleanup-register summary rows are unknown, duplicated, reordered, or stale.",
        { index: summaryIndex, expected: entry, actual: summary },
      );
    }
    summaryIndex += 1;
  }
  const headingIndexes = [];
  let lineIndex = 0;
  while (lineIndex < lines.length) {
    if (/^## DEBT-I07-\d{3} — /u.test(lines[lineIndex])) {
      headingIndexes.push(lineIndex);
    }
    lineIndex += 1;
  }
  if (headingIndexes.length !== entries.length) {
    fail(
      "INFRASTRUCTURE_DEBT_DOCUMENTATION_DRIFT",
      "The cleanup register must contain the exact machine-owned debt heading count.",
      { expected: entries.length, actual: headingIndexes.length },
    );
  }

  const records = [];
  let entryIndex = 0;
  while (entryIndex < entries.length) {
    const entry = entries[entryIndex];
    const start = headingIndexes[entryIndex];
    const heading = lines[start];
    if (!heading.startsWith(`## ${entry.id} — `)) {
      fail(
        "INFRASTRUCTURE_DEBT_DOCUMENTATION_DRIFT",
        "Cleanup register headings are unknown, duplicated, or reordered.",
        { index: entryIndex, expected: entry.id, actual: heading },
      );
    }
    const end = headingIndexes[entryIndex + 1] ?? lines.length;
    const sectionLines = lines.slice(start + 1, end);
    const record = {
      id: entry.id,
      status: exactField(sectionLines, "- Status: ", "status", entry.id),
      registeredBy: exactField(
        sectionLines,
        "- Registered by infrastructure task: ",
        "registration task",
        entry.id,
      ),
      removalOwner: exactField(sectionLines, "- Removal owner: ", "removal owner", entry.id),
      deadline: exactField(sectionLines, "- Must close by gate: ", "deadline gate", entry.id),
      evidenceState: evidenceState(sectionLines, entry),
    };
    if (
      record.status !== entry.status ||
      record.registeredBy !== entry.registeredBy ||
      record.removalOwner !== entry.removalOwner ||
      record.deadline !== entry.deadline ||
      record.evidenceState !== (entry.evidence?.kind ?? "PENDING")
    ) {
      fail(
        "INFRASTRUCTURE_DEBT_DOCUMENTATION_DRIFT",
        `${entry.id} documentation differs from the authenticated manifest.`,
        { expected: entry, actual: record },
      );
    }
    assertSectionProjection(sectionLines, entry);
    records.push(record);
    entryIndex += 1;
  }
  return records;
}

function taskBoardStatuses(text, requiredIds) {
  const statuses = new Map();
  const required = new Set(requiredIds);
  const lines = text.split("\n");
  let lineIndex = 0;
  while (lineIndex < lines.length) {
    const match =
      /^\|\s*([A-Z][A-Z0-9-]+)\s*\|\s*(NOT_STARTED|IN_PROGRESS|BLOCKED|DONE)\s*\|/u.exec(
        lines[lineIndex],
      );
    if (match !== null && required.has(match[1])) {
      if (statuses.has(match[1])) {
        fail(
          "INFRASTRUCTURE_DEBT_TASK_BOARD_DRIFT",
          `Task board status for "${match[1]}" is duplicated.`,
          { id: match[1] },
        );
      }
      statuses.set(match[1], match[2]);
    }
    lineIndex += 1;
  }
  let requiredIndex = 0;
  while (requiredIndex < requiredIds.length) {
    const id = requiredIds[requiredIndex];
    const status = statuses.get(id);
    if (!arrayContains(TASK_STATUSES, status)) {
      fail(
        "INFRASTRUCTURE_DEBT_TASK_BOARD_DRIFT",
        `Task board status for "${id}" is missing or unsupported.`,
        { id, status },
      );
    }
    requiredIndex += 1;
  }
  return statuses;
}

function uniqueLifecycleIds(entries) {
  const ids = [];
  const add = (id) => {
    if (!arrayContains(ids, id)) ids.push(id);
  };
  let index = 0;
  while (index < entries.length) {
    add(entries[index].registeredBy);
    add(entries[index].removalOwner);
    add(entries[index].deadline);
    index += 1;
  }
  return ids;
}

function assertLifecycleCeilings(entries, statuses) {
  let index = 0;
  while (index < entries.length) {
    const entry = entries[index];
    const ownerStatus = statuses.get(entry.removalOwner);
    const deadlineStatus = statuses.get(entry.deadline);
    if (
      entry.status === "READY_FOR_REMOVAL" &&
      ownerStatus !== "IN_PROGRESS" &&
      ownerStatus !== "DONE"
    ) {
      fail(
        "INFRASTRUCTURE_DEBT_LIFECYCLE_INVALID",
        `${entry.id} may be READY_FOR_REMOVAL only while its removal owner is active or done.`,
        { id: entry.id, removalOwner: entry.removalOwner, removalOwnerStatus: ownerStatus },
      );
    }
    if (entry.status === "CLOSED" && ownerStatus !== "DONE") {
      fail(
        "INFRASTRUCTURE_DEBT_LIFECYCLE_INVALID",
        `${entry.id} may be CLOSED only after its removal owner is DONE.`,
        { id: entry.id, removalOwner: entry.removalOwner, removalOwnerStatus: ownerStatus },
      );
    }
    if (
      (entry.status === "OPEN" && ownerStatus === "DONE") ||
      (entry.status !== "CLOSED" && deadlineStatus === "DONE")
    ) {
      fail(
        "INFRASTRUCTURE_DEBT_OVERDUE",
        `${entry.id} remained open after its removal owner or deadline completed.`,
        {
          id: entry.id,
          status: entry.status,
          removalOwner: entry.removalOwner,
          removalOwnerStatus: ownerStatus,
          deadline: entry.deadline,
          deadlineStatus,
        },
      );
    }
    index += 1;
  }
}

function assertActiveReferences(entry, targetText, relativePath) {
  const targetEntry = entry.targets.find((candidate) => candidate.path === relativePath);
  for (const symbol of targetEntry.symbols) {
    if (!targetText.includes(symbol)) {
      fail(
        "INFRASTRUCTURE_DEBT_ACTIVE_REFERENCE_MISSING",
        `${entry.id} is not CLOSED but a scoped legacy reference is absent.`,
        { id: entry.id, path: relativePath, symbol },
      );
    }
  }
}

function assertNoClosedReferences(entry, targetText, relativePath) {
  let symbolIndex = 0;
  while (
    symbolIndex <
    entry.targets.find((targetEntry) => targetEntry.path === relativePath).symbols.length
  ) {
    const symbol = entry.targets.find((targetEntry) => targetEntry.path === relativePath).symbols[
      symbolIndex
    ];
    if (targetText.includes(symbol)) {
      fail(
        "INFRASTRUCTURE_DEBT_CLOSED_REFERENCE_PRESENT",
        `${entry.id} is CLOSED but a scoped legacy reference remains.`,
        { id: entry.id, path: relativePath, symbol },
      );
    }
    symbolIndex += 1;
  }
}

/**
 * Authenticates the canonical register, documentation projection, task/gate lifecycle, tracked
 * paths, and CLOSED zero-reference rules against fresh workspace bytes.
 */
export async function verifyInfrastructureDebt(options = {}) {
  const normalizedOptions = exactOptions(options);
  const workspaceRoot =
    normalizedOptions.workspaceRoot === undefined
      ? path.resolve(import.meta.dirname, "../..")
      : normalizedOptions.workspaceRoot;
  if (typeof workspaceRoot !== "string" || workspaceRoot.length === 0) {
    fail("INFRASTRUCTURE_DEBT_OPTIONS_INVALID", "workspaceRoot must be one non-empty string.");
  }
  const rootStats = await lstat(workspaceRoot);
  if (!rootStats.isDirectory() || rootStats.isSymbolicLink()) {
    fail("INFRASTRUCTURE_DEBT_OPTIONS_INVALID", "workspaceRoot must be one real directory.");
  }
  const canonicalRoot = await realpath(workspaceRoot);
  if (canonicalRoot !== path.resolve(workspaceRoot)) {
    fail("INFRASTRUCTURE_DEBT_OPTIONS_INVALID", "workspaceRoot may not traverse a symlink.");
  }

  const tracked = await trackedIndex(workspaceRoot);
  const mandatoryPaths = [
    MANIFEST_RELATIVE_PATH,
    DEBT_REGISTER_RELATIVE_PATH,
    TASK_BOARD_RELATIVE_PATH,
  ];
  let mandatoryIndex = 0;
  while (mandatoryIndex < mandatoryPaths.length) {
    assertTrackedRegular(tracked, mandatoryPaths[mandatoryIndex]);
    mandatoryIndex += 1;
  }

  const manifestBytes = await readSecureFile(
    workspaceRoot,
    canonicalRoot,
    MANIFEST_RELATIVE_PATH,
    MAX_MANIFEST_BYTES,
    false,
  );
  const registerBytes = await readSecureFile(
    workspaceRoot,
    canonicalRoot,
    DEBT_REGISTER_RELATIVE_PATH,
    MAX_DOCUMENT_BYTES,
    false,
  );
  const taskBoardBytes = await readSecureFile(
    workspaceRoot,
    canonicalRoot,
    TASK_BOARD_RELATIVE_PATH,
    MAX_DOCUMENT_BYTES,
    false,
  );
  const manifest = parseInfrastructureDebtManifest(manifestBytes);
  const registerText = decodeUtf8(registerBytes, "Infrastructure debt register");
  const taskBoardText = decodeUtf8(taskBoardBytes, "Task board");
  parseDebtRegister(registerText, manifest.entries);
  const statuses = taskBoardStatuses(taskBoardText, uniqueLifecycleIds(manifest.entries));
  assertLifecycleCeilings(manifest.entries, statuses);

  let evidenceIndex = 0;
  while (evidenceIndex < manifest.entries.length) {
    const entry = manifest.entries[evidenceIndex];
    if (entry.evidence !== null) {
      assertTrackedRegular(tracked, entry.evidence.evidencePath);
      const evidenceBytes = await readSecureFile(
        workspaceRoot,
        canonicalRoot,
        entry.evidence.evidencePath,
        MAX_DOCUMENT_BYTES,
        false,
      );
      const actualSha256 = createHash("sha256").update(evidenceBytes).digest("hex");
      if (actualSha256 !== entry.evidence.evidenceSha256) {
        fail(
          "INFRASTRUCTURE_DEBT_EVIDENCE_INVALID",
          `${entry.id} evidence artifact does not match its authenticated SHA-256.`,
          {
            id: entry.id,
            path: entry.evidence.evidencePath,
            expected: entry.evidence.evidenceSha256,
            actual: actualSha256,
          },
        );
      }
    }
    evidenceIndex += 1;
  }

  let entryIndex = 0;
  while (entryIndex < manifest.entries.length) {
    const entry = manifest.entries[entryIndex];
    let targetIndex = 0;
    while (targetIndex < entry.targets.length) {
      const targetEntry = entry.targets[targetIndex];
      const allowMissing = entry.status === "CLOSED";
      const bytes = await readSecureFile(
        workspaceRoot,
        canonicalRoot,
        targetEntry.path,
        MAX_TARGET_BYTES,
        allowMissing,
      );
      if (bytes !== undefined) {
        assertTrackedRegular(tracked, targetEntry.path);
        if (entry.status === "CLOSED") {
          assertNoClosedReferences(
            entry,
            decodeUtf8(bytes, `${entry.id} cleanup target`),
            targetEntry.path,
          );
        } else {
          assertActiveReferences(
            entry,
            decodeUtf8(bytes, `${entry.id} active cleanup target`),
            targetEntry.path,
          );
        }
      } else if (tracked.has(targetEntry.path)) {
        fail(
          "INFRASTRUCTURE_DEBT_TRACKED_PATH_INVALID",
          `Closed debt path "${targetEntry.path}" is absent from the worktree but remains in the Git index.`,
          { id: entry.id, path: targetEntry.path, mode: tracked.get(targetEntry.path) },
        );
      }
      targetIndex += 1;
    }
    entryIndex += 1;
  }

  const statusCounts = { OPEN: 0, READY_FOR_REMOVAL: 0, CLOSED: 0 };
  let countIndex = 0;
  while (countIndex < manifest.entries.length) {
    statusCounts[manifest.entries[countIndex].status] += 1;
    countIndex += 1;
  }
  return deepFreezeJson({
    schemaVersion: 1,
    profile: PROFILE,
    entries: manifest.entries.length,
    statusCounts,
    taskStatuses: Object.fromEntries(statuses),
  });
}
