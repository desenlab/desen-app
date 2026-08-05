import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import { lstat, open, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify, types as utilTypes } from "node:util";

import { format } from "prettier";
import ts from "typescript";

import {
  BUNDLE_VERIFICATION_GUARD_SCHEMA_SPECS,
  verifyBundleVerificationGuardArtifact,
} from "../../apps/control-plane-api/scripts/lib/bundle-verification-guard-codegen.mjs";
import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ARTIFACT = "docs/proof/artifacts/control-plane-api-0.1.0-bundle-verification.json";
const PROOF_DOCUMENT = "docs/proof/CONTROL-PLANE-BUNDLE-VERIFICATION.md";
const TRACEABILITY = "docs/proof/protocol-0.1.0-traceability.json";
const APP_DIRECTORY = "apps/control-plane-api";
const APP_PACKAGE = `${APP_DIRECTORY}/package.json`;
const APP_INDEX = `${APP_DIRECTORY}/src/index.ts`;
const APP_BUNDLE_VERIFICATION_INTERNAL = `${APP_DIRECTORY}/src/bundle-verification-internal.ts`;
const APP_RUNTIME_TEST = `${APP_DIRECTORY}/test/bundle-verification.test.ts`;
const APP_GUARD_TEST = `${APP_DIRECTORY}/test/bundle-verification-guard.test.ts`;
const APP_TYPE_TEST = `${APP_DIRECTORY}/test/bundle-verification.types.ts`;
const APP_GUARD_CODEGEN = `${APP_DIRECTORY}/scripts/lib/bundle-verification-guard-codegen.mjs`;
const APP_GUARD_GENERATOR = `${APP_DIRECTORY}/scripts/generate-bundle-verification-guards.mjs`;
const APP_GUARD_VERIFIER = `${APP_DIRECTORY}/scripts/verify-bundle-verification-guards.mjs`;
const APP_GENERATED_GUARD = `${APP_DIRECTORY}/src/generated/0.1.0/bundle-verification-guards.ts`;
const GUARD_SOURCE_SCHEMA =
  "packages/protocol/upstream/0.1.0/snapshot/schemas/desen-source.schema.json";
const GUARD_BUNDLE_SCHEMA =
  "packages/protocol/upstream/0.1.0/snapshot/schemas/desen-bundle.schema.json";
const ROOT_PACKAGE = "package.json";
const CI_SOURCE = "scripts/run-ci-quality-gate.mjs";
const CI_INVENTORY = "scripts/ci/exhaustive-workload-inventory.mjs";
const GENERATOR = "scripts/generate-control-plane-bundle-verification-proof.mjs";
const VERIFIER = "scripts/verify-control-plane-bundle-verification.mjs";
const PROOF_LIBRARY = "scripts/lib/control-plane-bundle-verification-proof.mjs";
const ATOMIC_WRITER = "scripts/lib/atomic-proof-artifact.mjs";
const ROOT_TEST = "tests/control-plane-bundle-verification.test.mjs";
const SOURCE_FIXTURE =
  "packages/protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json";
const BUNDLE_FIXTURE =
  "packages/protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.bundle.json";

const MAX_AUTHORITY_BYTES = 16 * 1024 * 1024;
const READ_FLAGS =
  fileConstants.O_RDONLY | (fileConstants.O_NOFOLLOW ?? 0) | (fileConstants.O_NONBLOCK ?? 0);
const execFileAsync = promisify(execFile);
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype);
const TYPED_ARRAY_BUFFER_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "buffer",
)?.get;
const TYPED_ARRAY_BYTE_LENGTH_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteLength",
)?.get;
const TYPED_ARRAY_BYTE_OFFSET_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteOffset",
)?.get;
const UINT8_ARRAY_SET = Uint8Array.prototype.set;

const EXPECTED_REVISION = "sha256:43eef0f11f9bcc4c13fc1eb5691ee974859001fbb4aeee8051948e7c8e195601";
const EXPECTED_SOURCE_DIGEST =
  "sha256:40c294047299b521a46b51d8a72bfbeeaad8a69a9b9045a306139830b7674878";
const EXPECTED_CANONICAL_BUNDLE_BYTES = 2_173;
const EXPECTED_CANONICAL_BUNDLE_SHA256 =
  "fac0ee3d559528af2f4274cdfb21979463cbadd419f2faba584263cc8b4c0247";
const EXPECTED_PUBLICATION_BUNDLE_BYTES = 2_270;
const EXPECTED_PUBLICATION_BUNDLE_SHA256 =
  "adb67ee33f7e8f0428fb2da10c4762c9d4d0517fd90acc65ccbcace24efc3d73";
const EXPECTED_SOURCE_LIMIT_CODE = "run.desen.control-plane/SOURCE_MATERIAL_LIMIT_EXCEEDED";
const EXPECTED_GUARD_CODEGEN_SHA256 =
  "1d6c28655ce48c8f507edb9462968f43ebefce6509918b53521df0f79dd9c7af";
const EXPECTED_GENERATED_GUARD_SHA256 =
  "96e9c9ed5912fb39879f9e49b15321cd1161878c67f9269d0fb41a5a3f58ff29";
const EXPECTED_GENERATED_GUARD_BYTES = 730_791;
const TRACE_IDS = Object.freeze([
  "PIPE-010",
  "PIPE-011",
  "R-007",
  "R-031",
  "R-138",
  "D-030",
  "D-031",
  "D-034",
  "D-035",
]);
const REQUIRED_DIAGNOSTIC_CODES = Object.freeze([
  "BUNDLE_LIMIT_EXCEEDED",
  "REVISION_MISMATCH",
  "SCHEMA_INVALID",
  "SOURCE_DIGEST_MISMATCH",
  "UNKNOWN_CORE_FIELD",
  "UNSUPPORTED_PROTOCOL",
  EXPECTED_SOURCE_LIMIT_CODE,
]);
const EXPECTED_VERIFICATION_STAGES = Object.freeze([
  "entry-capture",
  "bundle-size",
  "bundle-json",
  "bundle-protocol",
  "bundle-schema",
  "bundle-revision",
  "source-material",
  "source-json",
  "source-protocol",
  "source-schema",
  "source-digest",
  "internal",
]);
const EXPECTED_RUNTIME_TEST_NAMES = Object.freeze([
  "authenticates the Publisher golden with matching or unavailable Source evidence",
  "accepts noncanonical whitespace and exact offset views without retaining caller bytes",
  "accepts authoring-only Source changes because the normative digest omits authoring",
  "enforces the exact 2 MiB stored and complete canonical Bundle boundary",
  "enforces the exact 8 MiB complete canonical Source boundary",
  "rejects malformed UTF-8, a BOM, trailing data, duplicate decoded keys, lone surrogates, and nonfinite numbers",
  "stops at fixed depth, value-count, number-token, and Source-string budgets",
  "gives an explicit unsupported protocol precedence before schema and revision checks",
  "preserves deterministic structural diagnostics without granting authority",
  "requires the stored, embedded, and independently calculated revisions to agree",
  "independently validates available Source bytes and rejects digest mismatch",
  "rejects unsupported or non-interoperable available Source material",
  "captures only exact own-data entry and Source envelopes without invoking accessors",
  "accepts authentic Uint8Array subclasses and rejects spoofed, proxied, shared, or wrong views",
  "rejects malformed Source availability envelopes after Bundle integrity succeeds",
  "does not observe Source material after an earlier revision rejection",
  "keeps authority identity unforgeable and returns no partial data on rejection",
]);
const EXPECTED_GUARD_TEST_NAMES = Object.freeze([
  "matches exhaustive structural success across every frozen valid Source and Bundle fixture",
  "cuts off custom embedded-schema fan-out before either exhaustive validator",
  "cuts off Draft meta-schema fan-out before exhaustive validation",
  "cuts off root child-array diagnostic fan-out before exhaustive validation",
  "stops one embedded schema at its first custom-profile issue",
  "retains one stable root code and offending-property pointer",
]);
const EXPECTED_TYPE_NEGATIVE_CLAIMS = Object.freeze([
  "Source availability must be supplied explicitly.",
  "Caller-selected limits or helper injection cannot weaken the fixed profile.",
  "Available Source evidence must carry a Uint8Array byte view.",
  "The opaque authority cannot be created structurally.",
  "An authority exposes no raw byte view.",
  "Integrity authority grants no activation, channel, or package-resolution API.",
  "The verified Bundle snapshot is recursively immutable.",
  "Rejected results never carry partial authority.",
  "The finite verification profile is immutable.",
]);
const EXPECTED_ROOT_TEST_NAMES = Object.freeze([
  "[authority] builds the exact versioned M07-T02 artifact and golden receipt",
  "[determinism] two independent evidence builds produce byte-identical artifacts",
  "[authority] verifies exact artifact bytes and one final proof-document pin",
  "[artifact] rejects one changed evidence byte",
  "[proof] rejects pending, wrong, duplicate, or missing final pins",
  "[prerequisites] rejects one changed byte in every direct prerequisite",
  "[implementation] rejects changed contract, parser, verifier, or type authority receipts",
  "[registration] rejects package-root, package-script, aggregate, or CI tuple drift",
  "[traceability] rejects owner or identity drift in all nine exact rows",
  "[runtime] rejects changed official authority or diagnostic receipts",
  "[tests] rejects skipped focused cases or removed compile-time negatives",
  "[filesystem] rejects symlinked artifact and proof-document authority",
  "[writer] atomically writes exact deterministic evidence bytes",
  "[writer] preserves the old destination and removes a tampered temporary",
  "[options] rejects unknown, accessor-backed, shared-memory, or hostile authority",
  "[immutability] freezes the evidence graph and preserves honest later-task nonclaims",
]);
const EXPECTED_PUBLIC_SOURCE_EXPORTS = Object.freeze(
  [
    Object.freeze({
      imported: "BUNDLE_INTEGRITY_LIMITS",
      exported: "BUNDLE_INTEGRITY_LIMITS",
      module: "./bundle-verification-contract.js",
      typeOnly: false,
    }),
    Object.freeze({
      imported: "SOURCE_MATERIAL_LIMIT_EXCEEDED_CODE",
      exported: "SOURCE_MATERIAL_LIMIT_EXCEEDED_CODE",
      module: "./bundle-verification-contract.js",
      typeOnly: false,
    }),
    Object.freeze({
      imported: "BundleStoreError",
      exported: "BundleStoreError",
      module: "./bundle-store-contract.js",
      typeOnly: false,
    }),
    Object.freeze({
      imported: "openBundleStore",
      exported: "openBundleStore",
      module: "./bundle-store.js",
      typeOnly: false,
    }),
    Object.freeze({
      imported: "verifyBundleStoreEntry",
      exported: "verifyBundleStoreEntry",
      module: "./bundle-verification.js",
      typeOnly: false,
    }),
    ...[
      "BundleIntegrityAuthority",
      "BundleIntegrityDiagnostic",
      "BundleIntegrityDiagnosticCode",
      "BundleIntegrityLimits",
      "BundleIntegrityVerificationResult",
      "BundleIntegrityVerificationStage",
      "BundleSourceMaterial",
    ].map((name) =>
      Object.freeze({
        imported: name,
        exported: name,
        module: "./bundle-verification-contract.js",
        typeOnly: true,
      }),
    ),
    ...[
      "BundleStore",
      "BundleStoreEntry",
      "BundleStoreErrorCode",
      "BundleStorePutResult",
      "BundleStoreReadResult",
      "OpenBundleStoreOptions",
    ].map((name) =>
      Object.freeze({
        imported: name,
        exported: name,
        module: "./bundle-store-contract.js",
        typeOnly: true,
      }),
    ),
  ].sort((left, right) => {
    const exported = left.exported < right.exported ? -1 : left.exported > right.exported ? 1 : 0;
    if (exported !== 0) return exported;
    return Number(left.typeOnly) - Number(right.typeOnly);
  }),
);
const EXPECTED_PUBLIC_RUNTIME_KEYS = Object.freeze([
  "BUNDLE_INTEGRITY_LIMITS",
  "BundleStoreError",
  "SOURCE_MATERIAL_LIMIT_EXCEEDED_CODE",
  "openBundleStore",
  "verifyBundleStoreEntry",
]);
const APPROVED_M07_T03_PUBLIC_SOURCE_EXPORTS = Object.freeze(
  [
    ...EXPECTED_PUBLIC_SOURCE_EXPORTS,
    ...[
      "BUNDLE_PACKAGE_PREFLIGHT_LIMITS",
      "INVALID_BUNDLE_INTEGRITY_AUTHORITY_CODE",
      "INVALID_INSTALLED_PACKAGE_CODE",
      "PACKAGE_PREFLIGHT_INTERNAL_FAILURE_CODE",
      "PACKAGE_PREFLIGHT_LIMIT_EXCEEDED_CODE",
    ].map((name) =>
      Object.freeze({
        imported: name,
        exported: name,
        module: "./package-preflight-contract.js",
        typeOnly: false,
      }),
    ),
    Object.freeze({
      imported: "preflightBundlePackages",
      exported: "preflightBundlePackages",
      module: "./package-preflight.js",
      typeOnly: false,
    }),
    ...[
      "BundlePackagePreflightAuthority",
      "BundlePackagePreflightDiagnostic",
      "BundlePackagePreflightDiagnosticCode",
      "BundlePackagePreflightLimits",
      "BundlePackagePreflightResult",
      "BundlePackagePreflightStage",
      "InstalledPackageArtifact",
      "InstalledPackageCandidate",
      "VerifiedInstalledPackage",
    ].map((name) =>
      Object.freeze({
        imported: name,
        exported: name,
        module: "./package-preflight-contract.js",
        typeOnly: true,
      }),
    ),
  ].sort((left, right) => {
    const exported = left.exported < right.exported ? -1 : left.exported > right.exported ? 1 : 0;
    if (exported !== 0) return exported;
    return Number(left.typeOnly) - Number(right.typeOnly);
  }),
);
const APPROVED_M07_T03_PUBLIC_RUNTIME_KEYS = Object.freeze([
  "BUNDLE_INTEGRITY_LIMITS",
  "BUNDLE_PACKAGE_PREFLIGHT_LIMITS",
  "BundleStoreError",
  "INVALID_BUNDLE_INTEGRITY_AUTHORITY_CODE",
  "INVALID_INSTALLED_PACKAGE_CODE",
  "PACKAGE_PREFLIGHT_INTERNAL_FAILURE_CODE",
  "PACKAGE_PREFLIGHT_LIMIT_EXCEEDED_CODE",
  "SOURCE_MATERIAL_LIMIT_EXCEEDED_CODE",
  "openBundleStore",
  "preflightBundlePackages",
  "verifyBundleStoreEntry",
]);
const APPROVED_M07_T04_PUBLIC_SOURCE_EXPORTS = Object.freeze(
  [
    ...APPROVED_M07_T03_PUBLIC_SOURCE_EXPORTS,
    ...[
      "BUNDLE_REFERENCE_PREFLIGHT_LIMITS",
      "INVALID_BUNDLE_PACKAGE_AUTHORITY_CODE",
      "REFERENCE_PREFLIGHT_INTERNAL_FAILURE_CODE",
    ].map((name) =>
      Object.freeze({
        imported: name,
        exported: name,
        module: "./reference-preflight-contract.js",
        typeOnly: false,
      }),
    ),
    Object.freeze({
      imported: "preflightBundleReferences",
      exported: "preflightBundleReferences",
      module: "./reference-preflight.js",
      typeOnly: false,
    }),
    ...[
      "BundleReferencePreflightAuthority",
      "BundleReferencePreflightDiagnostic",
      "BundleReferencePreflightDiagnosticCode",
      "BundleReferencePreflightLimits",
      "BundleReferencePreflightResult",
      "BundleReferencePreflightStage",
      "VerifiedBundleSurfaceReferences",
    ].map((name) =>
      Object.freeze({
        imported: name,
        exported: name,
        module: "./reference-preflight-contract.js",
        typeOnly: true,
      }),
    ),
  ].sort((left, right) => {
    const exported = left.exported < right.exported ? -1 : left.exported > right.exported ? 1 : 0;
    if (exported !== 0) return exported;
    return Number(left.typeOnly) - Number(right.typeOnly);
  }),
);
const APPROVED_M07_T04_PUBLIC_RUNTIME_KEYS = Object.freeze([
  "BUNDLE_INTEGRITY_LIMITS",
  "BUNDLE_PACKAGE_PREFLIGHT_LIMITS",
  "BUNDLE_REFERENCE_PREFLIGHT_LIMITS",
  "BundleStoreError",
  "INVALID_BUNDLE_INTEGRITY_AUTHORITY_CODE",
  "INVALID_BUNDLE_PACKAGE_AUTHORITY_CODE",
  "INVALID_INSTALLED_PACKAGE_CODE",
  "PACKAGE_PREFLIGHT_INTERNAL_FAILURE_CODE",
  "PACKAGE_PREFLIGHT_LIMIT_EXCEEDED_CODE",
  "REFERENCE_PREFLIGHT_INTERNAL_FAILURE_CODE",
  "SOURCE_MATERIAL_LIMIT_EXCEEDED_CODE",
  "openBundleStore",
  "preflightBundlePackages",
  "preflightBundleReferences",
  "verifyBundleStoreEntry",
]);
const APPROVED_M07_T05_PUBLIC_SOURCE_EXPORTS = Object.freeze(
  [
    ...APPROVED_M07_T04_PUBLIC_SOURCE_EXPORTS,
    ...[
      "LOCAL_CONTROL_PLANE_ERROR_MESSAGES",
      "LOCAL_CONTROL_PLANE_IDENTIFIER_PATTERN",
      "LOCAL_CONTROL_PLANE_JSON_MEDIA_TYPE",
      "LOCAL_CONTROL_PLANE_LIMITS",
      "LOCAL_CONTROL_PLANE_LOOPBACK_ADDRESS",
      "LocalControlPlaneError",
    ].map((name) =>
      Object.freeze({
        imported: name,
        exported: name,
        module: "./local-control-plane-contract.js",
        typeOnly: false,
      }),
    ),
    Object.freeze({
      imported: "openLocalControlPlane",
      exported: "openLocalControlPlane",
      module: "./local-control-plane.js",
      typeOnly: false,
    }),
    ...[
      "LocalControlPlane",
      "LocalControlPlaneBundlePutResult",
      "LocalControlPlaneBundleReadResult",
      "LocalControlPlaneBundleRecord",
      "LocalControlPlaneChannelPutBody",
      "LocalControlPlaneChannelPutResult",
      "LocalControlPlaneChannelReadResult",
      "LocalControlPlaneChannelRecord",
      "LocalControlPlaneErrorCode",
      "LocalControlPlaneErrorDetail",
      "LocalControlPlaneErrorEnvelope",
      "LocalControlPlaneHttpStatusCode",
      "LocalControlPlaneInjectMethod",
      "LocalControlPlaneInjectRequest",
      "LocalControlPlaneInjectResponse",
      "LocalControlPlaneLimits",
      "LocalControlPlaneListenResult",
      "LocalControlPlaneSourcePutResult",
      "LocalControlPlaneSourceReadResult",
      "LocalControlPlaneSourceRecord",
      "OpenLocalControlPlaneOptions",
    ].map((name) =>
      Object.freeze({
        imported: name,
        exported: name,
        module: "./local-control-plane-contract.js",
        typeOnly: true,
      }),
    ),
  ].sort((left, right) => {
    const exported = left.exported < right.exported ? -1 : left.exported > right.exported ? 1 : 0;
    return exported === 0 ? Number(left.typeOnly) - Number(right.typeOnly) : exported;
  }),
);
const APPROVED_M07_T05_PUBLIC_RUNTIME_KEYS = Object.freeze(
  APPROVED_M07_T05_PUBLIC_SOURCE_EXPORTS.filter(({ typeOnly }) => !typeOnly)
    .map(({ exported }) => exported)
    .sort(),
);
const HISTORICAL_TRACKED_RECEIPTS = Object.freeze({
  [APP_PACKAGE]: Object.freeze({
    bytes: 1_285,
    sha256: "734609cdd94f1e93030f75a7009505a0da4988d31d955f7100aee256cb0c2a5b",
  }),
  [APP_INDEX]: Object.freeze({
    bytes: 896,
    sha256: "58fe0462d7d35a1231259b6386006f950600d401113f229debbe057f0120a4df",
  }),
  [PROOF_LIBRARY]: Object.freeze({
    bytes: 76_998,
    sha256: "d317cef88d2d3fd126bf9ce1d7327cec77aecfdbec9724a205365a63c30521d1",
  }),
  [ROOT_TEST]: Object.freeze({
    bytes: 19_794,
    sha256: "491dd3f45000db8b392f33ad66f380d6c0209aa0209353725cb5310212e71683",
  }),
  [ROOT_PACKAGE]: Object.freeze({
    bytes: 57_321,
    sha256: "34688d939024b598bddaf057767ad028c3d00529cdbaa6fa33de75edd0980a6a",
  }),
  [CI_SOURCE]: Object.freeze({
    bytes: 46_292,
    sha256: "773ce3520cc088e810c686cea3ad816ec0f52211e1bc156c3676623a71b09f23",
  }),
  [CI_INVENTORY]: Object.freeze({
    bytes: 44_703,
    sha256: "dee3450aaa3496f4850c79597f183afa138ad756fd6709c1291ff9d8bab5c9d2",
  }),
});
const M07_T05_BUNDLE_VERIFICATION_INTERNAL_TRACKED_RECEIPT_BRIDGE = Object.freeze({
  [APP_BUNDLE_VERIFICATION_INTERNAL]: Object.freeze({
    historical: Object.freeze({
      bytes: 27_667,
      sha256: "7e8c5defbe5bb352e0a60f112350f19a62deb94cb807e2fa154697eb37d22aa9",
    }),
    successor: Object.freeze({
      bytes: 17_671,
      sha256: "5bf5f6234bcb710393af852fad67b9d914c0379a9aee934e92e2714a531e40d1",
    }),
  }),
});
const APPROVED_M07_T03_TRACKED_RECEIPTS = Object.freeze({
  [APP_PACKAGE]: Object.freeze({
    bytes: 1_744,
    sha256: "5a9c02445cac83f7ad11c56fbb075a24bd6f6e7d107a4cf22d8b670cdfa3e192",
  }),
  [APP_INDEX]: Object.freeze({
    bytes: 1_595,
    sha256: "42d5c844e108fddce5fb3190fee09e192bef4f12d79d61c4c96c2fae016150b3",
  }),
  [ROOT_PACKAGE]: Object.freeze({
    bytes: 58_777,
    sha256: "7b80f42d3f565a58a46de8d0c404c71ceb3407c38e1216135f969bfa90736f61",
  }),
  [CI_SOURCE]: Object.freeze({
    bytes: 47_044,
    sha256: "d6f39b225217a04c8e1712d7514973819e7c9868d058e4c515135f484e5256a9",
  }),
  [CI_INVENTORY]: Object.freeze({
    bytes: 45_389,
    sha256: "259638a7e74e1bf3dcc131c29ff4e977ef2a76d0c93b984a4dc537766929f9d4",
  }),
});
const APPROVED_M07_T04_TRACKED_RECEIPTS = Object.freeze({
  [APP_PACKAGE]: Object.freeze({
    bytes: 1_846,
    sha256: "5934807f1d66f001cf2173e3b1fa0a7b4e5f461df8822b16335cb8f53a83bf94",
  }),
  [APP_INDEX]: Object.freeze({
    bytes: 2_189,
    sha256: "b1081dafc56b43c422e23b8ab14251133bc78295a815d83c12a95122d024fce0",
  }),
  [ROOT_PACKAGE]: Object.freeze({
    bytes: 59_862,
    sha256: "afa38ff5b1963f93d5059aae588b3a1bb99b557b18384424018c0c1bf576d248",
  }),
  [CI_SOURCE]: Object.freeze({
    bytes: 47_220,
    sha256: "975a0adedf39fc8ea6a06ab4d017237056ae7206ee904546fbcb9176f90d0f05",
  }),
  [CI_INVENTORY]: Object.freeze({
    bytes: 45_555,
    sha256: "df477424e71cda0f411483fcd62db17f03c36a68b34bf5273b2198dc1c09b46a",
  }),
});
const APPROVED_M07_T05_TRACKED_RECEIPTS = Object.freeze({
  [APP_PACKAGE]: Object.freeze({
    bytes: 1_972,
    sha256: "fba38ac87e42c58c5965f32433e2391b8a52a10ec2ab4a90bc18a263840398e1",
  }),
  [APP_INDEX]: Object.freeze({
    bytes: 3_343,
    sha256: "f33d36872ebb0b320569c38d29f4397e81d459db085d2d9d92111a2795510e24",
  }),
  [ROOT_PACKAGE]: Object.freeze({
    bytes: 60_843,
    sha256: "c725d3daf2c09ac199edd816c02485e5f281984c2c9a2ff197e1b554196fa5b9",
  }),
  [CI_SOURCE]: Object.freeze({
    bytes: 47_366,
    sha256: "ac96b317d49f031db23bd73995193c854249f66bcdcb6a04905d0e3ca0eb6b77",
  }),
  [CI_INVENTORY]: Object.freeze({
    bytes: 45_691,
    sha256: "e71e53c6a94c798e28bbb2d41ee6556a7cdc28bfdf3bfdbb3c3d39e1d45872c0",
  }),
});
const HISTORICAL_INDEX_DISTRIBUTION_RECEIPTS = Object.freeze({
  "index.d.ts": Object.freeze({
    bytes: 899,
    sha256: "9bf4bef4c690c138df002fdc44c4e83a0ef94c30eb72a925c39f7253eeffa680",
  }),
  "index.d.ts.map": Object.freeze({
    bytes: 539,
    sha256: "ead852d17b09a440050e9c56d456bf403b3b8ff6f7e09910e87dd659f4e68a86",
  }),
  "index.js": Object.freeze({
    bytes: 468,
    sha256: "4adf7d465b29b36ba60fdd03894b0abc08119f18dbf12a361a6f2da3eea44f69",
  }),
  "index.js.map": Object.freeze({
    bytes: 305,
    sha256: "797b2c0d81af06f50abb1bfc52b7e32861c23cb4dfb28023141e76ba76875e67",
  }),
});
const M07_T05_BUNDLE_VERIFICATION_INTERNAL_DISTRIBUTION_RECEIPT_BRIDGE = Object.freeze({
  "bundle-verification-internal.js": Object.freeze({
    historical: Object.freeze({
      bytes: 24_282,
      sha256: "24e83ff9affadf61f27d0d0c48e653be2b40879e9f21322dd30ef0318b0ff06a",
    }),
    successor: Object.freeze({
      bytes: 14_636,
      sha256: "58f135d7c403d52ca551d8bfbd3f16f2f385c93902c8c42e8a0baa0661598e13",
    }),
  }),
  "bundle-verification-internal.js.map": Object.freeze({
    historical: Object.freeze({
      bytes: 22_736,
      sha256: "0084c80d697adafae9728f4ce4fc785b0b7fc9ae0a72d358209af741f39a3fa3",
    }),
    successor: Object.freeze({
      bytes: 11_524,
      sha256: "dcc1a468b848254937f6573978623f2fb4f297b6dd48430c308f5e3f04b19906",
    }),
  }),
});
const APPROVED_M07_T03_INDEX_DISTRIBUTION_RECEIPTS = Object.freeze({
  "index.d.ts": Object.freeze({
    bytes: 1_570,
    sha256: "9b4ed2ac2abce81b9c08e3d6c0a0b20497ef9dd5f2f1e4c0044c7cc3b7e4dbbd",
  }),
  "index.d.ts.map": Object.freeze({
    bytes: 833,
    sha256: "0e0ab85e46db44dc9b195add77ef575da82d1b59cde707d722a611ab69ef7f78",
  }),
  "index.js": Object.freeze({
    bytes: 810,
    sha256: "5b3651b6126b61cfc5f7f69ac5a95fc122ccd93838a7e9b7f292b8324a356aaa",
  }),
  "index.js.map": Object.freeze({
    bytes: 449,
    sha256: "90a97ad54cc860b414dbda2a3e850dc4853f227413176f43355e5d21ff055e77",
  }),
});
const APPROVED_M07_T04_INDEX_DISTRIBUTION_RECEIPTS = Object.freeze({
  "index.d.ts": Object.freeze({
    bytes: 2_144,
    sha256: "8adfbb8de836417e9c2ccf92e7e20deb6d1afcbc4bb9c1ccfef505e637c90929",
  }),
  "index.d.ts.map": Object.freeze({
    bytes: 1_074,
    sha256: "77d5b7269cde3ae2f06c2fc91aee6aab39194404fb871358e52a2e8a1505260f",
  }),
  "index.js": Object.freeze({
    bytes: 1_087,
    sha256: "1470779fe140073285db0eb38acbd72e302998b293bb33236d646eedac197a71",
  }),
  "index.js.map": Object.freeze({
    bytes: 566,
    sha256: "0060ea89d7c17c22492ddabcdf976661de09da7ea588736d8385a88da1f0c26d",
  }),
});
const APPROVED_M07_T05_INDEX_DISTRIBUTION_RECEIPTS = Object.freeze({
  "index.d.ts": Object.freeze({
    bytes: 3_244,
    sha256: "453e5c2b15d3faed0357193ffe5682e5c518b06b5ab9cf904361e76a785401bd",
  }),
  "index.d.ts.map": Object.freeze({
    bytes: 1_537,
    sha256: "53fd5e67aa7236adf897f443611614c248a99beb436ccf3fdb827651de613428",
  }),
  "index.js": Object.freeze({
    bytes: 1_469,
    sha256: "166709a7330e573bf737e2d985fe0c0761c614215df3cadc71d6bbc783c9e777",
  }),
  "index.js.map": Object.freeze({
    bytes: 723,
    sha256: "16112df85d0fe16f3767b17c28f36d0c8c3bc015f82114d4ab2b718c6d9567db",
  }),
});
const ROOT_SCRIPT_COMMANDS = Object.freeze({
  generate:
    "pnpm verify:control-plane-bundle-store && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:bundle-verification && node scripts/generate-control-plane-bundle-verification-proof.mjs",
  verify:
    "pnpm verify:control-plane-bundle-store && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:bundle-verification && node scripts/verify-control-plane-bundle-verification.mjs",
  test: "pnpm verify:control-plane-bundle-store && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:bundle-verification && node --test tests/control-plane-bundle-verification.test.mjs",
});
const CI_TUPLE = Object.freeze([
  "control-plane-bundle-verification",
  "scripts/verify-control-plane-bundle-verification.mjs",
  "tests/control-plane-bundle-verification.test.mjs",
]);

export const CONTROL_PLANE_BUNDLE_VERIFICATION_PREREQUISITE_PINS = Object.freeze([
  Object.freeze({
    task: "M07-T01",
    path: "docs/proof/artifacts/control-plane-api-0.1.0-bundle-store.json",
    sha256: "698be7d5610d1732ad991bf7e58131e81d2c34ffa888f65ec3c7916334f54795",
  }),
  Object.freeze({
    task: "I07-02",
    path: "docs/proof/baselines/i07-02-required-exhaustive-equivalence.json",
    sha256: "6b876b09f94517e27098076c9f16e207368ef8d31eb70b0ae2f187b15757345d",
  }),
  Object.freeze({
    task: "M06-T10",
    path: "docs/proof/artifacts/publisher-0.1.0-official-golden.json",
    sha256: "a2cde9718894b4af506e750d66ea7577d96da4e8a09649f17afe0f94dada17e2",
  }),
  Object.freeze({
    task: "M02-T04",
    path: "docs/proof/artifacts/protocol-0.1.0-canonicalization.json",
    sha256: "8da65b96973ee2a592735a6868f45ac1f1d0d059114902769a390fe7de33dcc6",
  }),
  Object.freeze({
    task: "M02-T05",
    path: "docs/proof/artifacts/protocol-0.1.0-diagnostics.json",
    sha256: "e3ec18d8e870e8bbfb8dbfb9958d35208c894519b6ba9af30b6b0bcc5c9e7b8b",
  }),
  Object.freeze({
    task: "M02-T06",
    path: "docs/proof/artifacts/protocol-0.1.0-structural-validation.json",
    sha256: "7e7662e6b20e29452f8c5092e37d2fefe1a416e787816693543b0c2c1a2e6536",
  }),
]);

const FIXTURE_PINS = Object.freeze([
  Object.freeze({ role: "officialSource", path: SOURCE_FIXTURE }),
  Object.freeze({ role: "officialBundle", path: BUNDLE_FIXTURE }),
]);

export const DEFAULT_CONTROL_PLANE_BUNDLE_VERIFICATION_ARTIFACT_PATH = path.join(ROOT, ARTIFACT);

export class ControlPlaneBundleVerificationEvidenceError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ControlPlaneBundleVerificationEvidenceError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details = {}) {
  throw new ControlPlaneBundleVerificationEvidenceError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function byteEqual(left, right) {
  return Buffer.from(left).equals(Buffer.from(right));
}

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function exactOwnDataOptions(value, allowedKeys, label) {
  if (value === undefined) return Object.freeze({});
  if (
    typeof value !== "object" ||
    value === null ||
    utilTypes.isProxy(value) ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    fail("INVALID_OPTIONS", `${label} must be one ordinary own-data record.`);
  }
  const result = {};
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      typeof key !== "string" ||
      !allowedKeys.has(key) ||
      descriptor === undefined ||
      !descriptor.enumerable ||
      !("value" in descriptor)
    ) {
      fail("INVALID_OPTIONS", `${label} contains an unsupported or active field.`);
    }
    result[key] = descriptor.value;
  }
  return Object.freeze(result);
}

function captureOptionalPath(value, label) {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length === 0 || value.includes("\0")) {
    fail("INVALID_OPTIONS", `${label} must be a nonempty primitive path string.`);
  }
  return value;
}

function captureBytes(value, label) {
  if (!utilTypes.isUint8Array(value) || utilTypes.isProxy(value)) {
    fail("INVALID_OPTIONS", `${label} must be an independently owned Uint8Array.`);
  }
  try {
    if (
      TYPED_ARRAY_BUFFER_GETTER === undefined ||
      TYPED_ARRAY_BYTE_LENGTH_GETTER === undefined ||
      TYPED_ARRAY_BYTE_OFFSET_GETTER === undefined
    ) {
      fail("INVALID_OPTIONS", `${label} cannot establish intrinsic byte-view authority.`);
    }
    const buffer = Reflect.apply(TYPED_ARRAY_BUFFER_GETTER, value, []);
    const byteLength = Reflect.apply(TYPED_ARRAY_BYTE_LENGTH_GETTER, value, []);
    const byteOffset = Reflect.apply(TYPED_ARRAY_BYTE_OFFSET_GETTER, value, []);
    if (
      utilTypes.isSharedArrayBuffer(buffer) ||
      !utilTypes.isAnyArrayBuffer(buffer) ||
      !Number.isSafeInteger(byteLength) ||
      !Number.isSafeInteger(byteOffset) ||
      byteLength < 0 ||
      byteOffset < 0 ||
      byteLength > MAX_AUTHORITY_BYTES
    ) {
      fail("INVALID_OPTIONS", `${label} has an unsupported byte-view authority.`);
    }
    const source = new Uint8Array(buffer, byteOffset, byteLength);
    const snapshot = new Uint8Array(byteLength);
    Reflect.apply(UINT8_ARRAY_SET, snapshot, [source]);
    return snapshot;
  } catch (error) {
    if (error instanceof ControlPlaneBundleVerificationEvidenceError) throw error;
    fail("INVALID_OPTIONS", `${label} could not be captured as inert bytes.`);
  }
}

function captureByteOverrides(value, allowedPaths, label) {
  if (value === undefined) return Object.freeze({});
  const record = exactOwnDataOptions(value, new Set(allowedPaths), label);
  const result = {};
  for (const [relativePath, bytes] of Object.entries(record)) {
    result[relativePath] = captureBytes(bytes, `${label}.${relativePath}`);
  }
  return Object.freeze(result);
}

function copyInertJson(value, label, active = new Set(), budget = { nodes: 0 }) {
  budget.nodes += 1;
  if (budget.nodes > 100_000) fail("INVALID_OPTIONS", `${label} exceeds the JSON node ceiling.`);
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail("INVALID_OPTIONS", `${label} contains a non-finite number.`);
    return value;
  }
  if (typeof value !== "object" || utilTypes.isProxy(value) || active.has(value)) {
    fail("INVALID_OPTIONS", `${label} must contain only acyclic inert JSON.`);
  }
  active.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype) {
        fail("INVALID_OPTIONS", `${label} contains a non-ordinary array.`);
      }
      const output = [];
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
          fail("INVALID_OPTIONS", `${label} contains a sparse or active array entry.`);
        }
        output.push(copyInertJson(descriptor.value, label, active, budget));
      }
      if (Reflect.ownKeys(value).length !== value.length + 1) {
        fail("INVALID_OPTIONS", `${label} contains an extra array field.`);
      }
      return Object.freeze(output);
    }
    if (Object.getPrototypeOf(value) !== Object.prototype) {
      fail("INVALID_OPTIONS", `${label} contains a non-ordinary record.`);
    }
    const output = {};
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        typeof key !== "string" ||
        descriptor === undefined ||
        !("value" in descriptor) ||
        !descriptor.enumerable
      ) {
        fail("INVALID_OPTIONS", `${label} contains an active or symbolic field.`);
      }
      output[key] = copyInertJson(descriptor.value, label, active, budget);
    }
    return Object.freeze(output);
  } finally {
    active.delete(value);
  }
}

async function safeReadAbsolute(filePath) {
  const absolute = path.resolve(filePath);
  const requestedParent = path.dirname(absolute);
  let parent;
  try {
    parent = await realpath(requestedParent);
  } catch {
    fail("AUTHORITY_IO_FAILURE", "An evidence authority parent cannot be resolved.");
  }
  if (parent !== requestedParent) {
    fail("UNSAFE_AUTHORITY", "An evidence authority parent must not traverse a symbolic link.");
  }
  const resolved = path.join(parent, path.basename(absolute));
  let before;
  try {
    before = await lstat(resolved);
  } catch {
    fail("AUTHORITY_IO_FAILURE", "An evidence authority cannot be inspected.");
  }
  if (!before.isFile() || before.isSymbolicLink()) {
    fail("UNSAFE_AUTHORITY", "An evidence authority must be a regular non-symbolic file.");
  }
  let handle;
  try {
    handle = await open(resolved, READ_FLAGS);
    const opened = await handle.stat();
    if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino) {
      fail("UNSAFE_AUTHORITY", "An evidence authority changed identity while opening.");
    }
    if (opened.size > MAX_AUTHORITY_BYTES) {
      fail("UNSAFE_AUTHORITY", "An evidence authority exceeds its byte ceiling.");
    }
    const bytes = await handle.readFile();
    const after = await lstat(resolved);
    if (
      !after.isFile() ||
      after.dev !== opened.dev ||
      after.ino !== opened.ino ||
      after.size !== bytes.byteLength
    ) {
      fail("UNSAFE_AUTHORITY", "An evidence authority changed while reading.");
    }
    return Uint8Array.from(bytes);
  } catch (error) {
    if (error instanceof ControlPlaneBundleVerificationEvidenceError) throw error;
    fail("AUTHORITY_IO_FAILURE", "An evidence authority cannot be read safely.");
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

async function authorityBytes(relativePath, overrides = {}) {
  return Object.hasOwn(overrides, relativePath)
    ? Uint8Array.from(overrides[relativePath])
    : safeReadAbsolute(path.join(ROOT, relativePath));
}

function fatalText(bytes, label) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail("AUTHORITY_PARSE_FAILURE", `${label} is not valid UTF-8.`);
  }
}

function parseJsonBytes(bytes, label) {
  try {
    return JSON.parse(fatalText(bytes, label));
  } catch (error) {
    if (error instanceof ControlPlaneBundleVerificationEvidenceError) throw error;
    fail("AUTHORITY_PARSE_FAILURE", `${label} is not valid JSON.`);
  }
}

function parseTypescript(source, relativePath) {
  const sourceFile = ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true);
  if (sourceFile.parseDiagnostics.length > 0) {
    fail("TEST_AUTHORITY_DRIFT", `${relativePath} is not valid TypeScript.`);
  }
  return sourceFile;
}

function registeredTestNames(source, relativePath, functionName) {
  const sourceFile = parseTypescript(source, relativePath);
  const names = [];
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === functionName &&
      node.arguments.length > 0 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      names.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return Object.freeze(names);
}

function compilerNegativeCases(source, relativePath) {
  const directives = [...source.matchAll(/\/\/ @ts-expect-error ([^\n]+)/gu)].map(
    ([, message]) => message,
  );
  if (directives.length === 0) {
    fail("TEST_AUTHORITY_DRIFT", `${relativePath} contains no compile-time negative case.`);
  }
  return Object.freeze(directives);
}

function publicExportInventory(source, relativePath) {
  const sourceFile = parseTypescript(source, relativePath);
  const inventory = [];
  for (const statement of sourceFile.statements) {
    if (!ts.isExportDeclaration(statement) || statement.exportClause === undefined) continue;
    if (!ts.isNamedExports(statement.exportClause) || statement.moduleSpecifier === undefined) {
      fail("REGISTRATION_DRIFT", "The package root contains a non-explicit public export.");
    }
    const module = statement.moduleSpecifier.text;
    for (const element of statement.exportClause.elements) {
      inventory.push({
        imported: element.propertyName?.text ?? element.name.text,
        exported: element.name.text,
        module,
        typeOnly: statement.isTypeOnly || element.isTypeOnly,
      });
    }
  }
  inventory.sort((left, right) => {
    const exported = left.exported < right.exported ? -1 : left.exported > right.exported ? 1 : 0;
    if (exported !== 0) return exported;
    return Number(left.typeOnly) - Number(right.typeOnly);
  });
  const serialized = JSON.stringify(inventory);
  if (
    serialized !== JSON.stringify(EXPECTED_PUBLIC_SOURCE_EXPORTS) &&
    serialized !== JSON.stringify(APPROVED_M07_T03_PUBLIC_SOURCE_EXPORTS) &&
    serialized !== JSON.stringify(APPROVED_M07_T04_PUBLIC_SOURCE_EXPORTS) &&
    serialized !== JSON.stringify(APPROVED_M07_T05_PUBLIC_SOURCE_EXPORTS)
  ) {
    fail("REGISTRATION_DRIFT", "The exact public package-root export inventory drifted.");
  }
  // M07-T02 owns only its task-time exports. Authenticate reviewed M07-T03/T04 extensions while
  // projecting the frozen T02 inventory so the historical artifact remains byte-identical.
  return EXPECTED_PUBLIC_SOURCE_EXPORTS;
}

function exactTupleCount(source, tuple) {
  const normalized = `[${tuple.map((entry) => JSON.stringify(entry)).join(",")},]`;
  const compact = source.replaceAll(/\s+/gu, "");
  let count = 0;
  let offset = 0;
  while ((offset = compact.indexOf(normalized, offset)) !== -1) {
    count += 1;
    offset += normalized.length;
  }
  return count;
}

function assertSuccessorSafeAggregateEdge(script, predecessor, current, terminal) {
  if (typeof script !== "string") fail("REGISTRATION_DRIFT", "An aggregate script is absent.");
  const commands = script.split(" && ");
  const predecessorIndex = commands.indexOf(predecessor);
  const currentIndex = commands.indexOf(current);
  const terminalIndex = commands.indexOf(terminal);
  if (
    predecessorIndex < 0 ||
    currentIndex !== predecessorIndex + 1 ||
    terminalIndex <= currentIndex ||
    commands.lastIndexOf(current) !== currentIndex
  ) {
    fail("REGISTRATION_DRIFT", "The M07-T02 aggregate command edge drifted.");
  }
}

async function prerequisiteReceipts(overrides) {
  const receipts = [];
  for (const pin of CONTROL_PLANE_BUNDLE_VERIFICATION_PREREQUISITE_PINS) {
    const bytes = await authorityBytes(pin.path, overrides);
    const observedSha256 = sha256(bytes);
    if (observedSha256 !== pin.sha256) {
      fail("PREREQUISITE_DRIFT", "A direct M07-T02 prerequisite drifted.", {
        task: pin.task,
        path: pin.path,
        expectedSha256: pin.sha256,
        observedSha256,
      });
    }
    receipts.push(
      Object.freeze({ ...pin, bytes: bytes.byteLength, verifiedSha256: observedSha256 }),
    );
  }
  return Object.freeze(receipts);
}

async function fixtureReceipts(overrides) {
  return Object.freeze(
    await Promise.all(
      FIXTURE_PINS.map(async (fixture) => {
        const bytes = await authorityBytes(fixture.path, overrides);
        return Object.freeze({
          ...fixture,
          bytes: bytes.byteLength,
          sha256: sha256(bytes),
        });
      }),
    ),
  );
}

async function taskSourceInventory() {
  const sourceDirectory = path.join(ROOT, APP_DIRECTORY, "src");
  const testDirectory = path.join(ROOT, APP_DIRECTORY, "test");
  const sourceFiles = (await readdir(sourceDirectory))
    .filter((name) => name.startsWith("bundle-verification") && name.endsWith(".ts"))
    .map((name) => `${APP_DIRECTORY}/src/${name}`)
    .sort();
  const testFiles = (await readdir(testDirectory))
    .filter((name) => name.startsWith("bundle-verification") && name.endsWith(".ts"))
    .map((name) => `${APP_DIRECTORY}/test/${name}`)
    .sort();
  const expectedSourceFiles = [
    `${APP_DIRECTORY}/src/bundle-verification-contract.ts`,
    `${APP_DIRECTORY}/src/bundle-verification-internal.ts`,
    `${APP_DIRECTORY}/src/bundle-verification-schema-guard.ts`,
    `${APP_DIRECTORY}/src/bundle-verification-standalone-runtime.ts`,
    `${APP_DIRECTORY}/src/bundle-verification.ts`,
  ].sort();
  const expectedTestFiles = [APP_GUARD_TEST, APP_RUNTIME_TEST, APP_TYPE_TEST].sort();
  if (
    JSON.stringify(sourceFiles) !== JSON.stringify(expectedSourceFiles) ||
    JSON.stringify(testFiles) !== JSON.stringify(expectedTestFiles)
  ) {
    fail("SOURCE_INVENTORY_DRIFT", "The exact M07-T02 source or test inventory drifted.");
  }
  return Object.freeze([
    ...sourceFiles,
    APP_GENERATED_GUARD,
    ...testFiles,
    APP_GUARD_GENERATOR,
    APP_GUARD_VERIFIER,
    APP_GUARD_CODEGEN,
  ]);
}

async function trackedFileReceipts(overrides) {
  const taskSources = await taskSourceInventory();
  const paths = [
    APP_PACKAGE,
    APP_INDEX,
    ...taskSources,
    GENERATOR,
    VERIFIER,
    PROOF_LIBRARY,
    ATOMIC_WRITER,
    ROOT_TEST,
    ROOT_PACKAGE,
    CI_SOURCE,
    CI_INVENTORY,
    GUARD_SOURCE_SCHEMA,
    GUARD_BUNDLE_SCHEMA,
  ];
  const receipts = [];
  for (const relativePath of paths) {
    const bytes = await authorityBytes(relativePath, overrides);
    const overridden = Object.hasOwn(overrides, relativePath);
    const internalBridge =
      M07_T05_BUNDLE_VERIFICATION_INTERNAL_TRACKED_RECEIPT_BRIDGE[relativePath];
    const historical = overridden
      ? undefined
      : (HISTORICAL_TRACKED_RECEIPTS[relativePath] ?? internalBridge?.historical);
    const approvedM07T03 = APPROVED_M07_T03_TRACKED_RECEIPTS[relativePath];
    const approvedM07T04 = APPROVED_M07_T04_TRACKED_RECEIPTS[relativePath];
    const approvedM07T05 =
      APPROVED_M07_T05_TRACKED_RECEIPTS[relativePath] ?? internalBridge?.successor;
    const observedSha256 = sha256(bytes);
    if (
      (approvedM07T03 !== undefined ||
        approvedM07T04 !== undefined ||
        approvedM07T05 !== undefined) &&
      !(
        (bytes.byteLength === historical?.bytes && observedSha256 === historical.sha256) ||
        (approvedM07T03 !== undefined &&
          bytes.byteLength === approvedM07T03.bytes &&
          observedSha256 === approvedM07T03.sha256) ||
        (approvedM07T04 !== undefined &&
          bytes.byteLength === approvedM07T04.bytes &&
          observedSha256 === approvedM07T04.sha256) ||
        (approvedM07T05 !== undefined &&
          bytes.byteLength === approvedM07T05.bytes &&
          observedSha256 === approvedM07T05.sha256)
      )
    ) {
      fail("REGISTRATION_DRIFT", "The reviewed package successor bytes drifted.", {
        path: relativePath,
      });
    }
    receipts.push(
      Object.freeze({
        path: relativePath,
        bytes: historical?.bytes ?? bytes.byteLength,
        sha256: historical?.sha256 ?? observedSha256,
      }),
    );
  }
  return Object.freeze(receipts);
}

async function guardCodegenReceipt(overrides) {
  const codegenBytes = await authorityBytes(APP_GUARD_CODEGEN, overrides);
  if (sha256(codegenBytes) !== EXPECTED_GUARD_CODEGEN_SHA256) {
    fail(
      "GUARD_CODEGEN_DRIFT",
      "The reviewed fail-fast guard generator or its fixed options drifted.",
    );
  }
  const schemaFiles = new Map();
  for (const spec of BUNDLE_VERIFICATION_GUARD_SCHEMA_SPECS) {
    const relativePath =
      spec.schemaFile === "desen-source.schema.json"
        ? GUARD_SOURCE_SCHEMA
        : spec.schemaFile === "desen-bundle.schema.json"
          ? GUARD_BUNDLE_SCHEMA
          : undefined;
    if (relativePath === undefined) {
      fail("GUARD_CODEGEN_DRIFT", "The reviewed guard schema inventory drifted.");
    }
    schemaFiles.set(spec.schemaFile, await authorityBytes(relativePath, overrides));
  }
  const outputBytes = await authorityBytes(APP_GENERATED_GUARD, overrides);
  let receipt;
  try {
    receipt = await verifyBundleVerificationGuardArtifact({ schemaFiles, outputBytes });
  } catch {
    fail(
      "GUARD_CODEGEN_DRIFT",
      "The committed fail-fast guards are not an exact deterministic regeneration.",
    );
  }
  const expected = {
    result: "PASS",
    protocol: "0.1.0",
    tools: { ajv: "8.20.0", prettier: "3.9.6" },
    schemaRoots: 2,
    schemas: [
      {
        schemaFile: "desen-source.schema.json",
        schemaId: "https://schemas.desen.dev/0.1/desen-source.schema.json",
        sha256: "5ce5d541991940676ce0d3705e5b0658cd60f31025be8bfb96aec21a3116dba3",
        bytes: 19_588,
        exportName: "validateSourceGuard",
      },
      {
        schemaFile: "desen-bundle.schema.json",
        schemaId: "https://schemas.desen.dev/0.1/desen-bundle.schema.json",
        sha256: "19ac16176289ce03e8997eba1101e121e42f170bf8fe1934a3fb440e64d994b1",
        bytes: 20_001,
        exportName: "validateBundleGuard",
      },
    ],
    exports: ["validateSourceGuard", "validateBundleGuard", "validateDraft202012Guard"],
    allErrors: false,
    runtimeCompilation: false,
    dynamicLoading: false,
    networkAccess: false,
    runtimeImports: ["../../bundle-verification-standalone-runtime.js"],
    localHelpers: ["jsonEqual", "unicodeLength"],
    outputSha256: EXPECTED_GENERATED_GUARD_SHA256,
    outputBytes: EXPECTED_GENERATED_GUARD_BYTES,
  };
  if (JSON.stringify(receipt) !== JSON.stringify(expected)) {
    fail("GUARD_CODEGEN_DRIFT", "The exact fail-fast guard generation receipt drifted.");
  }
  return deepFreeze(copyInertJson(receipt, "guardCodegenReceipt"));
}

async function distributionReceipts() {
  const distDirectory = path.join(ROOT, APP_DIRECTORY, "dist");
  const generatedDirectory = path.join(distDirectory, "generated/0.1.0");
  const topLevel = (await readdir(distDirectory))
    .filter((name) => name.startsWith("bundle-verification") || name.startsWith("index."))
    .sort();
  const generated = (await readdir(generatedDirectory))
    .filter((name) => name.startsWith("bundle-verification-guards."))
    .map((name) => `generated/0.1.0/${name}`)
    .sort();
  const observed = [...topLevel, ...generated].sort();
  const suffixes = [".d.ts", ".d.ts.map", ".js", ".js.map"];
  const expected = [
    "bundle-verification-contract",
    "bundle-verification-internal",
    "bundle-verification-schema-guard",
    "bundle-verification-standalone-runtime",
    "bundle-verification",
    "generated/0.1.0/bundle-verification-guards",
    "index",
  ]
    .flatMap((base) => suffixes.map((suffix) => `${base}${suffix}`))
    .sort();
  if (JSON.stringify(observed) !== JSON.stringify(expected)) {
    fail("DISTRIBUTION_DRIFT", "The M07-T02 distribution inventory drifted.", { observed });
  }
  return Object.freeze(
    await Promise.all(
      observed.map(async (name) => {
        const relativePath = `${APP_DIRECTORY}/dist/${name}`;
        const bytes = await safeReadAbsolute(path.join(ROOT, relativePath));
        const internalBridge =
          M07_T05_BUNDLE_VERIFICATION_INTERNAL_DISTRIBUTION_RECEIPT_BRIDGE[name];
        const historical =
          HISTORICAL_INDEX_DISTRIBUTION_RECEIPTS[name] ?? internalBridge?.historical;
        const approvedM07T03 = APPROVED_M07_T03_INDEX_DISTRIBUTION_RECEIPTS[name];
        const approvedM07T04 = APPROVED_M07_T04_INDEX_DISTRIBUTION_RECEIPTS[name];
        const approvedM07T05 =
          APPROVED_M07_T05_INDEX_DISTRIBUTION_RECEIPTS[name] ?? internalBridge?.successor;
        const observedSha256 = sha256(bytes);
        if (
          historical !== undefined &&
          !(
            (bytes.byteLength === historical.bytes && observedSha256 === historical.sha256) ||
            (approvedM07T03 !== undefined &&
              bytes.byteLength === approvedM07T03.bytes &&
              observedSha256 === approvedM07T03.sha256) ||
            (approvedM07T04 !== undefined &&
              bytes.byteLength === approvedM07T04.bytes &&
              observedSha256 === approvedM07T04.sha256) ||
            (approvedM07T05 !== undefined &&
              bytes.byteLength === approvedM07T05.bytes &&
              observedSha256 === approvedM07T05.sha256)
          )
        ) {
          fail("DISTRIBUTION_DRIFT", "The reviewed package-root distribution drifted.", {
            path: relativePath,
          });
        }
        return Object.freeze({
          path: relativePath,
          bytes: historical?.bytes ?? bytes.byteLength,
          sha256: historical?.sha256 ?? observedSha256,
        });
      }),
    ),
  );
}

async function registrationProjection(overrides) {
  const [appPackageBytes, appIndexBytes, rootPackageBytes, ciBytes, inventoryBytes] =
    await Promise.all([
      authorityBytes(APP_PACKAGE, overrides),
      authorityBytes(APP_INDEX, overrides),
      authorityBytes(ROOT_PACKAGE, overrides),
      authorityBytes(CI_SOURCE, overrides),
      authorityBytes(CI_INVENTORY, overrides),
    ]);
  const appPackage = parseJsonBytes(appPackageBytes, APP_PACKAGE);
  const rootPackage = parseJsonBytes(rootPackageBytes, ROOT_PACKAGE);
  const publicExports = publicExportInventory(fatalText(appIndexBytes, APP_INDEX), APP_INDEX);
  const appProjection = {
    name: appPackage.name,
    main: appPackage.main,
    types: appPackage.types,
    exports: appPackage.exports?.["."],
    packageTest: appPackage.scripts?.["test:bundle-verification"],
    guardGenerator: appPackage.scripts?.["generate:bundle-verification-guards"],
    guardVerifier: appPackage.scripts?.["verify:bundle-verification-guards"],
    protocolDependency: appPackage.dependencies?.["@desen/protocol"],
    validatorDependency: appPackage.dependencies?.["@desen/validator"],
    ajvBuildDependency: appPackage.devDependencies?.ajv,
    prettierBuildDependency: appPackage.devDependencies?.prettier,
  };
  const expectedAppProjection = {
    name: "@desen/control-plane-api",
    main: "./dist/index.js",
    types: "./dist/index.d.ts",
    exports: { types: "./dist/index.d.ts", import: "./dist/index.js" },
    packageTest:
      "vitest run test/bundle-verification.test.ts test/bundle-verification-guard.test.ts",
    guardGenerator: "node scripts/generate-bundle-verification-guards.mjs",
    guardVerifier: "node scripts/verify-bundle-verification-guards.mjs",
    protocolDependency: "workspace:*",
    validatorDependency: "workspace:*",
    ajvBuildDependency: "8.20.0",
    prettierBuildDependency: "3.9.6",
  };
  if (JSON.stringify(appProjection) !== JSON.stringify(expectedAppProjection)) {
    fail("REGISTRATION_DRIFT", "The M07-T02 package registration projection drifted.");
  }
  const rootScripts = {
    generate: rootPackage.scripts?.["generate:control-plane-bundle-verification"],
    verify: rootPackage.scripts?.["verify:control-plane-bundle-verification"],
    test: rootPackage.scripts?.["test:control-plane-bundle-verification"],
  };
  if (JSON.stringify(rootScripts) !== JSON.stringify(ROOT_SCRIPT_COMMANDS)) {
    fail("REGISTRATION_DRIFT", "The exact root M07-T02 commands drifted.");
  }
  assertSuccessorSafeAggregateEdge(
    rootPackage.scripts?.check,
    "pnpm verify:control-plane-bundle-store",
    "pnpm verify:control-plane-bundle-verification",
    "pnpm lint",
  );
  assertSuccessorSafeAggregateEdge(
    rootPackage.scripts?.test,
    "pnpm test:control-plane-bundle-store",
    "pnpm test:control-plane-bundle-verification",
    "turbo run test",
  );
  if (
    exactTupleCount(fatalText(ciBytes, CI_SOURCE), CI_TUPLE) !== 1 ||
    exactTupleCount(fatalText(inventoryBytes, CI_INVENTORY), CI_TUPLE) !== 1
  ) {
    fail("REGISTRATION_DRIFT", "The exact modular-CI proof tuple drifted.");
  }
  return deepFreeze({
    app: expectedAppProjection,
    rootScripts: ROOT_SCRIPT_COMMANDS,
    aggregateImmediatePredecessor: "control-plane-bundle-store",
    aggregateSuccessorExtensionSafe: true,
    ciTuple: CI_TUPLE,
    ciTupleExactInRunnerAndInventory: true,
    publicSourceExports: publicExports,
  });
}

function collectTraceRows(value, found = []) {
  if (Array.isArray(value)) {
    for (const child of value) collectTraceRows(child, found);
    return found;
  }
  if (value !== null && typeof value === "object") {
    if (typeof value.id === "string" && TRACE_IDS.includes(value.id)) found.push(value);
    for (const child of Object.values(value)) collectTraceRows(child, found);
  }
  return found;
}

async function traceProjection(overrides) {
  const trace = parseJsonBytes(await authorityBytes(TRACEABILITY, overrides), TRACEABILITY);
  const rows = collectTraceRows(trace).sort(
    (left, right) => TRACE_IDS.indexOf(left.id) - TRACE_IDS.indexOf(right.id),
  );
  if (
    rows.length !== TRACE_IDS.length ||
    rows.some((row, index) => row.id !== TRACE_IDS[index] || !row.owners?.includes("M07-T02"))
  ) {
    fail("TRACEABILITY_DRIFT", "The exact M07-T02 trace authority drifted.");
  }
  return deepFreeze(copyInertJson(rows, "traceRows"));
}

async function packageTestProjection(overrides) {
  const [runtimeBytes, guardBytes, typeBytes, rootBytes] = await Promise.all([
    authorityBytes(APP_RUNTIME_TEST, overrides),
    authorityBytes(APP_GUARD_TEST, overrides),
    authorityBytes(APP_TYPE_TEST, overrides),
    authorityBytes(ROOT_TEST, overrides),
  ]);
  const runtimeNames = registeredTestNames(
    fatalText(runtimeBytes, APP_RUNTIME_TEST),
    APP_RUNTIME_TEST,
    "it",
  );
  const guardNames = registeredTestNames(
    fatalText(guardBytes, APP_GUARD_TEST),
    APP_GUARD_TEST,
    "it",
  );
  const rootNames = registeredTestNames(fatalText(rootBytes, ROOT_TEST), ROOT_TEST, "test");
  const typeCases = compilerNegativeCases(fatalText(typeBytes, APP_TYPE_TEST), APP_TYPE_TEST);
  if (
    JSON.stringify(runtimeNames) !== JSON.stringify(EXPECTED_RUNTIME_TEST_NAMES) ||
    JSON.stringify(guardNames) !== JSON.stringify(EXPECTED_GUARD_TEST_NAMES) ||
    JSON.stringify(rootNames) !== JSON.stringify(EXPECTED_ROOT_TEST_NAMES) ||
    JSON.stringify(typeCases) !== JSON.stringify(EXPECTED_TYPE_NEGATIVE_CLAIMS)
  ) {
    fail("TEST_AUTHORITY_DRIFT", "The exact M07-T02 focused or mutation-test authority drifted.");
  }
  return deepFreeze({
    packageRuntimeCases: runtimeNames.length,
    packageRuntimeCaseNames: runtimeNames,
    packageGuardCases: guardNames.length,
    packageGuardCaseNames: guardNames,
    packageFocusedCases: runtimeNames.length + guardNames.length,
    compileTimeNegativeCases: typeCases.length,
    compileTimeNegativeClaims: typeCases,
    rootMutationCases: rootNames.length,
    rootMutationCaseNames: rootNames,
  });
}

async function probePackageSelfReference() {
  const program = [
    'import("@desen/control-plane-api")',
    "  .then((module) => process.stdout.write(JSON.stringify({",
    '    verify: typeof module.verifyBundleStoreEntry === "function",',
    "    limits: Object.isFrozen(module.BUNDLE_INTEGRITY_LIMITS),",
    "    sourceLimitCode: module.SOURCE_MATERIAL_LIMIT_EXCEEDED_CODE,",
    '    internalReader: Object.hasOwn(module, "readBundleIntegrityAuthority"),',
    '    internalPredicate: Object.hasOwn(module, "isBundleIntegrityAuthority"),',
    "    keys: Object.keys(module).sort()",
    "  })))",
    "  .catch((error) => { process.stderr.write(String(error)); process.exitCode = 1; });",
  ].join("\n");
  const environment = { ...process.env, NODE_OPTIONS: "" };
  delete environment.NODE_PATH;
  try {
    const { stdout } = await execFileAsync(
      process.execPath,
      ["--no-warnings", "--input-type=module", "-e", program],
      {
        cwd: path.join(ROOT, APP_DIRECTORY),
        encoding: "utf8",
        env: environment,
        maxBuffer: 64 * 1024,
        timeout: 30_000,
      },
    );
    return parseJsonBytes(Buffer.from(stdout, "utf8"), "package self-reference probe");
  } catch {
    fail("RUNTIME_PROBE_MISMATCH", "The built control-plane package is not self-importable.");
  }
}

function diagnosticReceipt(result) {
  return Object.freeze({
    status: result.status,
    stage: result.status === "rejected" ? result.stage : undefined,
    codes: result.status === "rejected" ? result.diagnostics.map(({ code }) => code) : [],
    pointers: result.status === "rejected" ? result.diagnostics.map(({ pointer }) => pointer) : [],
    resultFrozen: Object.isFrozen(result),
    diagnosticsFrozen:
      result.status === "rejected" &&
      Object.isFrozen(result.diagnostics) &&
      result.diagnostics.every((diagnostic) => Object.isFrozen(diagnostic)),
  });
}

function authorityProjection(authority, record, internal) {
  if (authority === undefined || record === undefined) return undefined;
  return Object.freeze({
    publicKeys: Object.keys(authority).sort(),
    protocolVersion: authority.protocolVersion,
    revision: authority.revision,
    sourceDigest: authority.sourceDigest,
    sourceDigestVerification: authority.sourceDigestVerification,
    storedByteLength: authority.storedByteLength,
    canonicalByteLength: authority.canonicalByteLength,
    bundleRevision: authority.bundle.revision,
    bundleSourceDigest: authority.bundle.sourceDigest,
    authorityFrozen: Object.isFrozen(authority),
    bundleFrozen: Object.isFrozen(authority.bundle),
    recordFrozen: Object.isFrozen(record),
    recordBundleFrozen: Object.isFrozen(record.bundle),
    publicAndInternalMetadataEqual:
      authority.bundle === record.bundle &&
      authority.protocolVersion === record.protocolVersion &&
      authority.revision === record.revision &&
      authority.sourceDigest === record.sourceDigest &&
      authority.sourceDigestVerification === record.sourceDigestVerification &&
      authority.storedByteLength === record.storedByteLength &&
      authority.canonicalByteLength === record.canonicalByteLength,
    authenticated: internal.isBundleIntegrityAuthority(authority),
  });
}

function verifiedReceipt(result, internal) {
  if (result.status !== "verified") {
    return Object.freeze({ status: result.status, resultFrozen: Object.isFrozen(result) });
  }
  const record = internal.readBundleIntegrityAuthority(result.authority);
  return Object.freeze({
    status: result.status,
    resultFrozen: Object.isFrozen(result),
    authority: authorityProjection(result.authority, record, internal),
  });
}

function entryForBundle(bundle, protocol) {
  return Object.freeze({
    revision: bundle.revision,
    bytes: protocol.canonicalizeJsonBytes(bundle),
  });
}

function bundleAtCanonicalSize(bundle, targetByteLength, protocol) {
  const candidate = structuredClone(bundle);
  candidate.extensions = { padding: "" };
  candidate.revision = EXPECTED_REVISION;
  const emptyLength = protocol.canonicalizeJsonBytes(candidate).byteLength;
  if (emptyLength > targetByteLength) {
    fail("RUNTIME_PROBE_MISMATCH", "The exact canonical-size probe cannot fit its authority.");
  }
  candidate.extensions = { padding: "x".repeat(targetByteLength - emptyLength) };
  candidate.revision = protocol.calculateDesenBundleRevision(candidate);
  if (protocol.canonicalizeJsonBytes(candidate).byteLength !== targetByteLength) {
    fail("RUNTIME_PROBE_MISMATCH", "The exact canonical-size probe drifted.");
  }
  return candidate;
}

function canonicalExpansionEntry(bundle, protocol) {
  const numberCount = 100_000;
  const numbers = new Array(numberCount).fill(1e20);
  const candidate = structuredClone(bundle);
  candidate.extensions = { expanded: numbers };
  candidate.revision = protocol.calculateDesenBundleRevision(candidate);
  const canonicalByteLength = protocol.canonicalizeJsonBytes(candidate).byteLength;
  const marker = "__DESEN_CANONICAL_NUMBER_EXPANSION__";
  const rawCandidate = structuredClone(candidate);
  rawCandidate.extensions = { expanded: marker };
  const template = JSON.stringify(rawCandidate);
  const rawNumbers = `[${new Array(numberCount).fill("1e20").join(",")}]`;
  const bytes = Buffer.from(template.replace(JSON.stringify(marker), rawNumbers), "utf8");
  return Object.freeze({
    entry: Object.freeze({ revision: candidate.revision, bytes }),
    rawByteLength: bytes.byteLength,
    canonicalByteLength,
  });
}

function sourceAtCanonicalSize(source, targetByteLength, protocol) {
  const candidate = structuredClone(source);
  candidate.authoring = { padding: "" };
  const emptyLength = protocol.canonicalizeJsonBytes(candidate).byteLength;
  if (emptyLength > targetByteLength) {
    fail("RUNTIME_PROBE_MISMATCH", "The exact canonical-size Source probe cannot fit.");
  }
  const delta = targetByteLength - emptyLength;
  candidate.authoring = {
    padding: `${"\u0000".repeat(Math.floor(delta / 6))}${"x".repeat(delta % 6)}`,
  };
  const bytes = protocol.canonicalizeJsonBytes(candidate);
  if (bytes.byteLength !== targetByteLength) {
    fail("RUNTIME_PROBE_MISMATCH", "The exact canonical-size Source probe drifted.");
  }
  return Object.freeze({ source: candidate, bytes });
}

function canonicalExpansionSource(source, targetByteLength, protocol) {
  const candidate = structuredClone(source);
  candidate.authoring = { padding: "", expanded: 1e20 };
  const emptyLength = protocol.canonicalizeJsonBytes(candidate).byteLength;
  const delta = targetByteLength - emptyLength;
  candidate.authoring = {
    padding: `${"\u0000".repeat(Math.floor(delta / 6))}${"x".repeat(delta % 6)}`,
    expanded: 1e20,
  };
  const canonicalByteLength = protocol.canonicalizeJsonBytes(candidate).byteLength;
  const canonicalNumber = "100000000000000000000";
  const rawText = JSON.stringify(candidate).replace(canonicalNumber, "1e20");
  if (rawText.includes(canonicalNumber)) {
    fail("RUNTIME_PROBE_MISMATCH", "The compact Source expansion probe drifted.");
  }
  const bytes = Buffer.from(rawText, "utf8");
  return Object.freeze({ bytes, rawByteLength: bytes.byteLength, canonicalByteLength });
}

function firstSurfaceRecord(document) {
  const surfaces = document.surfaces;
  const surfaceId = Object.keys(surfaces).sort()[0];
  if (surfaceId === undefined) {
    fail("RUNTIME_PROBE_MISMATCH", "The fail-fast guard probe has no surface.");
  }
  return surfaces[surfaceId];
}

function fanOutState(schema, count) {
  return Object.fromEntries(
    Array.from({ length: count }, (_, index) => [
      `s${index}`,
      { schema: structuredClone(schema), initial: null },
    ]),
  );
}

export async function runControlPlaneBundleVerificationProbe() {
  const [controlPlane, internal, protocol, sourceBytes, bundleBytes, selfReference] =
    await Promise.all([
      import(pathToFileURL(path.join(ROOT, APP_DIRECTORY, "dist/index.js")).href),
      import(
        pathToFileURL(path.join(ROOT, APP_DIRECTORY, "dist/bundle-verification-internal.js")).href
      ),
      import(pathToFileURL(path.join(ROOT, "packages/protocol/dist/index.js")).href),
      safeReadAbsolute(path.join(ROOT, SOURCE_FIXTURE)),
      safeReadAbsolute(path.join(ROOT, BUNDLE_FIXTURE)),
      probePackageSelfReference(),
    ]);
  const publicationBundle = parseJsonBytes(bundleBytes, BUNDLE_FIXTURE);
  const publicationDescriptor = Object.getOwnPropertyDescriptor(publicationBundle, "publication");
  if (
    publicationDescriptor === undefined ||
    !("value" in publicationDescriptor) ||
    !publicationDescriptor.enumerable
  ) {
    fail("RUNTIME_PROBE_MISMATCH", "The official fixture lost its root publication authority.");
  }
  const bundle = structuredClone(publicationBundle);
  if (!delete bundle.publication || Object.hasOwn(bundle, "publication")) {
    fail("RUNTIME_PROBE_MISMATCH", "Only root publication could not be projected from the golden.");
  }
  const canonicalBytes = protocol.canonicalizeJsonBytes(bundle);
  const entry = Object.freeze({ revision: bundle.revision, bytes: canonicalBytes });
  const available = controlPlane.verifyBundleStoreEntry(entry, {
    status: "available",
    sourceBytes,
  });
  const unavailable = controlPlane.verifyBundleStoreEntry(entry, { status: "not-available" });
  const publicationEntry = entryForBundle(publicationBundle, protocol);
  const publication = controlPlane.verifyBundleStoreEntry(publicationEntry, {
    status: "not-available",
  });

  const changedSource = parseJsonBytes(sourceBytes, SOURCE_FIXTURE);
  changedSource.id = "com.example.changed-account-app";
  const sourceMismatch = controlPlane.verifyBundleStoreEntry(entry, {
    status: "available",
    sourceBytes: protocol.canonicalizeJsonBytes(changedSource),
  });

  const changedBundle = structuredClone(bundle);
  changedBundle.id = "com.example.changed-account-app";
  const revisionMismatch = controlPlane.verifyBundleStoreEntry(
    Object.freeze({
      revision: bundle.revision,
      bytes: protocol.canonicalizeJsonBytes(changedBundle),
    }),
    { status: "not-available" },
  );

  const unsupportedBundle = structuredClone(bundle);
  unsupportedBundle.desen = "9.9.9";
  const unsupported = controlPlane.verifyBundleStoreEntry(
    Object.freeze({
      revision: bundle.revision,
      bytes: protocol.canonicalizeJsonBytes(unsupportedBundle),
    }),
    { status: "not-available" },
  );
  const schemaBundle = structuredClone(bundle);
  delete schemaBundle.entry;
  const schemaInvalid = controlPlane.verifyBundleStoreEntry(
    Object.freeze({
      revision: bundle.revision,
      bytes: protocol.canonicalizeJsonBytes(schemaBundle),
    }),
    { status: "not-available" },
  );
  const malformed = controlPlane.verifyBundleStoreEntry(
    Object.freeze({ revision: bundle.revision, bytes: Buffer.from("{", "utf8") }),
    { status: "not-available" },
  );
  const duplicate = controlPlane.verifyBundleStoreEntry(
    Object.freeze({
      revision: bundle.revision,
      bytes: Buffer.from('{"kind":"desen.bundle","kind":"desen.bundle"}', "utf8"),
    }),
    { status: "not-available" },
  );
  const rawOversized = controlPlane.verifyBundleStoreEntry(
    Object.freeze({
      revision: bundle.revision,
      bytes: new Uint8Array(controlPlane.BUNDLE_INTEGRITY_LIMITS.maxBundleUtf8Bytes + 1),
    }),
    { status: "not-available" },
  );
  const exactCanonicalBundle = bundleAtCanonicalSize(
    bundle,
    controlPlane.BUNDLE_INTEGRITY_LIMITS.maxBundleCanonicalUtf8Bytes,
    protocol,
  );
  const exactCanonical = controlPlane.verifyBundleStoreEntry(
    entryForBundle(exactCanonicalBundle, protocol),
    { status: "not-available" },
  );
  const expansion = canonicalExpansionEntry(bundle, protocol);
  const canonicalOversized = controlPlane.verifyBundleStoreEntry(expansion.entry, {
    status: "not-available",
  });

  const rawOversizedSource = new Uint8Array(
    controlPlane.BUNDLE_INTEGRITY_LIMITS.maxSourceUtf8Bytes + 1,
  );
  rawOversizedSource.fill(0x20);
  rawOversizedSource.set(sourceBytes);
  const sourceRawLimit = controlPlane.verifyBundleStoreEntry(entry, {
    status: "available",
    sourceBytes: rawOversizedSource,
  });
  const parserOversizedSource = parseJsonBytes(sourceBytes, SOURCE_FIXTURE);
  const sourceParserPaddingCodeUnits =
    controlPlane.BUNDLE_INTEGRITY_LIMITS.maxDecodedStringCodeUnits + 1;
  parserOversizedSource.authoring = {
    padding: "x".repeat(sourceParserPaddingCodeUnits),
  };
  const sourceParserBytes = Buffer.from(JSON.stringify(parserOversizedSource), "utf8");
  const sourceParserLimit = controlPlane.verifyBundleStoreEntry(entry, {
    status: "available",
    sourceBytes: sourceParserBytes,
  });

  const sourceDocument = parseJsonBytes(sourceBytes, SOURCE_FIXTURE);
  const exactCanonicalSource = sourceAtCanonicalSize(
    sourceDocument,
    controlPlane.BUNDLE_INTEGRITY_LIMITS.maxSourceCanonicalUtf8Bytes,
    protocol,
  );
  const exactSourceCanonical = controlPlane.verifyBundleStoreEntry(entry, {
    status: "available",
    sourceBytes: exactCanonicalSource.bytes,
  });
  const sourceExpansion = canonicalExpansionSource(
    sourceDocument,
    controlPlane.BUNDLE_INTEGRITY_LIMITS.maxSourceCanonicalUtf8Bytes + 1,
    protocol,
  );
  const sourceCanonicalLimit = controlPlane.verifyBundleStoreEntry(entry, {
    status: "available",
    sourceBytes: sourceExpansion.bytes,
  });

  const exhaustiveCalls = { bundle: 0, source: 0 };
  const rejectingStructuralPorts = Object.freeze({
    validateBundle() {
      exhaustiveCalls.bundle += 1;
      throw new TypeError("The fail-fast guard did not stop exhaustive Bundle validation.");
    },
    validateSource() {
      exhaustiveCalls.source += 1;
      throw new TypeError("The fail-fast guard did not stop exhaustive Source validation.");
    },
  });
  const rootFanOutCount = 10_000;
  const rootFanOutBundle = structuredClone(bundle);
  firstSurfaceRecord(rootFanOutBundle).root.slots = {
    default: Array.from({ length: rootFanOutCount }, () => ({})),
  };
  const rootFanOutEntry = entryForBundle(rootFanOutBundle, protocol);
  const rootFanOut = internal.verifyBundleStoreEntryInternal(
    rootFanOutEntry,
    { status: "not-available" },
    rejectingStructuralPorts,
  );
  const embeddedFanOutCount = 10_000;
  const embeddedFanOutBundle = structuredClone(bundle);
  firstSurfaceRecord(embeddedFanOutBundle).state = fanOutState(
    { $ref: "https://attacker.invalid/schema" },
    embeddedFanOutCount,
  );
  const embeddedFanOutEntry = entryForBundle(embeddedFanOutBundle, protocol);
  const embeddedFanOut = internal.verifyBundleStoreEntryInternal(
    embeddedFanOutEntry,
    { status: "not-available" },
    rejectingStructuralPorts,
  );

  const authority = available.status === "verified" ? available.authority : undefined;
  const unavailableAuthority =
    unavailable.status === "verified" ? unavailable.authority : undefined;
  const authorityRecord =
    authority === undefined ? undefined : internal.readBundleIntegrityAuthority(authority);
  const unavailableAuthorityRecord =
    unavailableAuthority === undefined
      ? undefined
      : internal.readBundleIntegrityAuthority(unavailableAuthority);
  const cloneAuthenticated =
    authority === undefined
      ? true
      : internal.isBundleIntegrityAuthority(Object.freeze({ ...authority }));

  return deepFreeze({
    requiredRuntimeExportsPresent:
      typeof controlPlane.verifyBundleStoreEntry === "function" &&
      Object.isFrozen(controlPlane.BUNDLE_INTEGRITY_LIMITS) &&
      controlPlane.SOURCE_MATERIAL_LIMIT_EXCEEDED_CODE === EXPECTED_SOURCE_LIMIT_CODE,
    publicModuleKeys: Object.keys(controlPlane).sort(),
    privateInternalExportsAbsent:
      !Object.hasOwn(controlPlane, "readBundleIntegrityAuthority") &&
      !Object.hasOwn(controlPlane, "isBundleIntegrityAuthority"),
    packageSelfReference: selfReference,
    limits: copyInertJson(controlPlane.BUNDLE_INTEGRITY_LIMITS, "limits"),
    official: {
      revision: bundle.revision,
      sourceDigest: bundle.sourceDigest,
      canonicalBytes: canonicalBytes.byteLength,
      canonicalSha256: sha256(canonicalBytes),
      availableStatus: available.status,
      unavailableStatus: unavailable.status,
      availableResultFrozen: Object.isFrozen(available),
      unavailableResultFrozen: Object.isFrozen(unavailable),
      matchedAuthority: authorityProjection(authority, authorityRecord, internal),
      unavailableAuthority: authorityProjection(
        unavailableAuthority,
        unavailableAuthorityRecord,
        internal,
      ),
      authorityCloneRejected: !cloneAuthenticated,
    },
    publication: {
      fixtureRootPublicationProjectedOnlyForGolden: true,
      revision: publicationBundle.revision,
      canonicalBytes: publicationEntry.bytes.byteLength,
      canonicalSha256: sha256(publicationEntry.bytes),
      verification: verifiedReceipt(publication, internal),
      publicationPreserved:
        publication.status === "verified" &&
        JSON.stringify(publication.authority.bundle.publication) ===
          JSON.stringify(publicationBundle.publication),
    },
    exactCanonicalLimit: {
      targetBytes: controlPlane.BUNDLE_INTEGRITY_LIMITS.maxBundleCanonicalUtf8Bytes,
      verification: verifiedReceipt(exactCanonical, internal),
    },
    canonicalExpansion: {
      rawBytes: expansion.rawByteLength,
      canonicalBytes: expansion.canonicalByteLength,
      verification: diagnosticReceipt(canonicalOversized),
    },
    sourceMismatch: diagnosticReceipt(sourceMismatch),
    revisionMismatch: diagnosticReceipt(revisionMismatch),
    unsupported: diagnosticReceipt(unsupported),
    schemaInvalid: diagnosticReceipt(schemaInvalid),
    malformed: diagnosticReceipt(malformed),
    duplicate: diagnosticReceipt(duplicate),
    rawBundleLimit: {
      inputBytes: controlPlane.BUNDLE_INTEGRITY_LIMITS.maxBundleUtf8Bytes + 1,
      verification: diagnosticReceipt(rawOversized),
    },
    sourceRawLimit: {
      inputBytes: rawOversizedSource.byteLength,
      verification: diagnosticReceipt(sourceRawLimit),
    },
    sourceParserLimit: {
      inputBytes: sourceParserBytes.byteLength,
      decodedPaddingCodeUnits: sourceParserPaddingCodeUnits,
      verification: diagnosticReceipt(sourceParserLimit),
    },
    exactSourceCanonicalLimit: {
      targetBytes: controlPlane.BUNDLE_INTEGRITY_LIMITS.maxSourceCanonicalUtf8Bytes,
      inputBytes: exactCanonicalSource.bytes.byteLength,
      verification: verifiedReceipt(exactSourceCanonical, internal),
    },
    sourceCanonicalExpansion: {
      rawBytes: sourceExpansion.rawByteLength,
      canonicalBytes: sourceExpansion.canonicalByteLength,
      verification: diagnosticReceipt(sourceCanonicalLimit),
    },
    failFastStructuralGuard: {
      rootChildArray: {
        childCount: rootFanOutCount,
        inputBytes: rootFanOutEntry.bytes.byteLength,
        verification: diagnosticReceipt(rootFanOut),
      },
      customEmbeddedSchemas: {
        schemaCount: embeddedFanOutCount,
        inputBytes: embeddedFanOutEntry.bytes.byteLength,
        verification: diagnosticReceipt(embeddedFanOut),
      },
      exhaustiveBundleCalls: exhaustiveCalls.bundle,
      exhaustiveSourceCalls: exhaustiveCalls.source,
    },
  });
}

function assertRuntimeReceipt(observedReceipt) {
  const currentRuntimeKeys = JSON.stringify(observedReceipt.publicModuleKeys);
  const currentSelfReferenceKeys = JSON.stringify(observedReceipt.packageSelfReference?.keys);
  const approvedM07T03Keys = JSON.stringify(APPROVED_M07_T03_PUBLIC_RUNTIME_KEYS);
  const approvedM07T04Keys = JSON.stringify(APPROVED_M07_T04_PUBLIC_RUNTIME_KEYS);
  const approvedM07T05Keys = JSON.stringify(APPROVED_M07_T05_PUBLIC_RUNTIME_KEYS);
  const reviewedSuccessor =
    (currentRuntimeKeys === approvedM07T03Keys &&
      currentSelfReferenceKeys === approvedM07T03Keys) ||
    (currentRuntimeKeys === approvedM07T04Keys &&
      currentSelfReferenceKeys === approvedM07T04Keys) ||
    (currentRuntimeKeys === approvedM07T05Keys && currentSelfReferenceKeys === approvedM07T05Keys);
  const receipt = reviewedSuccessor
    ? {
        ...observedReceipt,
        publicModuleKeys: EXPECTED_PUBLIC_RUNTIME_KEYS,
        packageSelfReference: {
          ...observedReceipt.packageSelfReference,
          keys: EXPECTED_PUBLIC_RUNTIME_KEYS,
        },
      }
    : observedReceipt;
  const runtimeReceiptKeys = [
    "canonicalExpansion",
    "duplicate",
    "exactCanonicalLimit",
    "exactSourceCanonicalLimit",
    "failFastStructuralGuard",
    "limits",
    "malformed",
    "official",
    "packageSelfReference",
    "privateInternalExportsAbsent",
    "publicModuleKeys",
    "publication",
    "rawBundleLimit",
    "requiredRuntimeExportsPresent",
    "revisionMismatch",
    "schemaInvalid",
    "sourceCanonicalExpansion",
    "sourceMismatch",
    "sourceParserLimit",
    "sourceRawLimit",
    "unsupported",
  ];
  const expectedLimits = {
    maxBundleUtf8Bytes: 2_097_152,
    maxBundleCanonicalUtf8Bytes: 2_097_152,
    maxSourceUtf8Bytes: 8_388_608,
    maxSourceCanonicalUtf8Bytes: 8_388_608,
    maxJsonDepth: 256,
    maxJsonValueOccurrences: 262_144,
    maxDecodedStringCodeUnits: 4_194_304,
    maxNumberTokenCodeUnits: 1_024,
  };
  const publicKeys = [
    "bundle",
    "canonicalByteLength",
    "protocolVersion",
    "revision",
    "sourceDigest",
    "sourceDigestVerification",
    "storedByteLength",
  ];
  const expectedMatchedAuthority = {
    publicKeys,
    protocolVersion: "0.1.0",
    revision: EXPECTED_REVISION,
    sourceDigest: EXPECTED_SOURCE_DIGEST,
    sourceDigestVerification: "matched",
    storedByteLength: EXPECTED_CANONICAL_BUNDLE_BYTES,
    canonicalByteLength: EXPECTED_CANONICAL_BUNDLE_BYTES,
    bundleRevision: EXPECTED_REVISION,
    bundleSourceDigest: EXPECTED_SOURCE_DIGEST,
    authorityFrozen: true,
    bundleFrozen: true,
    recordFrozen: true,
    recordBundleFrozen: true,
    publicAndInternalMetadataEqual: true,
    authenticated: true,
  };
  const expectedUnavailableAuthority = {
    ...expectedMatchedAuthority,
    sourceDigestVerification: "not-available",
  };
  if (
    JSON.stringify(Object.keys(receipt).sort()) !== JSON.stringify(runtimeReceiptKeys) ||
    receipt.requiredRuntimeExportsPresent !== true ||
    receipt.privateInternalExportsAbsent !== true ||
    JSON.stringify(receipt.publicModuleKeys) !== JSON.stringify(EXPECTED_PUBLIC_RUNTIME_KEYS) ||
    receipt.packageSelfReference?.verify !== true ||
    receipt.packageSelfReference?.limits !== true ||
    receipt.packageSelfReference?.sourceLimitCode !== EXPECTED_SOURCE_LIMIT_CODE ||
    receipt.packageSelfReference?.internalReader !== false ||
    receipt.packageSelfReference?.internalPredicate !== false ||
    JSON.stringify(receipt.packageSelfReference?.keys) !==
      JSON.stringify(EXPECTED_PUBLIC_RUNTIME_KEYS) ||
    JSON.stringify(receipt.limits) !== JSON.stringify(expectedLimits) ||
    receipt.official?.revision !== EXPECTED_REVISION ||
    receipt.official?.sourceDigest !== EXPECTED_SOURCE_DIGEST ||
    receipt.official?.canonicalBytes !== EXPECTED_CANONICAL_BUNDLE_BYTES ||
    receipt.official?.canonicalSha256 !== EXPECTED_CANONICAL_BUNDLE_SHA256 ||
    receipt.official?.availableStatus !== "verified" ||
    receipt.official?.unavailableStatus !== "verified" ||
    receipt.official?.availableResultFrozen !== true ||
    receipt.official?.unavailableResultFrozen !== true ||
    JSON.stringify(receipt.official?.matchedAuthority) !==
      JSON.stringify(expectedMatchedAuthority) ||
    JSON.stringify(receipt.official?.unavailableAuthority) !==
      JSON.stringify(expectedUnavailableAuthority) ||
    receipt.official?.authorityCloneRejected !== true ||
    receipt.publication?.revision !== EXPECTED_REVISION ||
    receipt.publication?.fixtureRootPublicationProjectedOnlyForGolden !== true ||
    receipt.publication?.canonicalBytes !== EXPECTED_PUBLICATION_BUNDLE_BYTES ||
    receipt.publication?.canonicalSha256 !== EXPECTED_PUBLICATION_BUNDLE_SHA256 ||
    receipt.publication?.verification?.status !== "verified" ||
    receipt.publication?.verification?.resultFrozen !== true ||
    receipt.publication?.verification?.authority?.storedByteLength !==
      EXPECTED_PUBLICATION_BUNDLE_BYTES ||
    receipt.publication?.verification?.authority?.canonicalByteLength !==
      EXPECTED_PUBLICATION_BUNDLE_BYTES ||
    receipt.publication?.publicationPreserved !== true ||
    receipt.exactCanonicalLimit?.targetBytes !== 2_097_152 ||
    receipt.exactCanonicalLimit?.verification?.status !== "verified" ||
    receipt.exactCanonicalLimit?.verification?.resultFrozen !== true ||
    receipt.exactCanonicalLimit?.verification?.authority?.authenticated !== true ||
    receipt.exactCanonicalLimit?.verification?.authority?.canonicalByteLength !== 2_097_152 ||
    receipt.rawBundleLimit?.inputBytes !== 2_097_153 ||
    !(receipt.canonicalExpansion?.rawBytes < 2_097_152) ||
    !(receipt.canonicalExpansion?.canonicalBytes > 2_097_152) ||
    receipt.sourceRawLimit?.inputBytes !== 8_388_609 ||
    !(receipt.sourceParserLimit?.inputBytes < 8_388_608) ||
    receipt.sourceParserLimit?.decodedPaddingCodeUnits !== 4_194_305 ||
    receipt.exactSourceCanonicalLimit?.targetBytes !== 8_388_608 ||
    receipt.exactSourceCanonicalLimit?.inputBytes !== 8_388_608 ||
    receipt.exactSourceCanonicalLimit?.verification?.status !== "verified" ||
    receipt.exactSourceCanonicalLimit?.verification?.authority?.authenticated !== true ||
    !(receipt.sourceCanonicalExpansion?.rawBytes < 8_388_608) ||
    receipt.sourceCanonicalExpansion?.canonicalBytes !== 8_388_609 ||
    receipt.failFastStructuralGuard?.rootChildArray?.childCount !== 10_000 ||
    !(receipt.failFastStructuralGuard?.rootChildArray?.inputBytes < 2_097_152) ||
    receipt.failFastStructuralGuard?.customEmbeddedSchemas?.schemaCount !== 10_000 ||
    !(receipt.failFastStructuralGuard?.customEmbeddedSchemas?.inputBytes < 2_097_152) ||
    receipt.failFastStructuralGuard?.exhaustiveBundleCalls !== 0 ||
    receipt.failFastStructuralGuard?.exhaustiveSourceCalls !== 0
  ) {
    fail("RUNTIME_PROBE_MISMATCH", "The official verification authority receipt drifted.");
  }
  const expectedFailures = [
    [receipt.sourceMismatch, "SOURCE_DIGEST_MISMATCH", "source-digest", ["/sourceDigest"]],
    [receipt.revisionMismatch, "REVISION_MISMATCH", "bundle-revision", ["/revision"]],
    [receipt.unsupported, "UNSUPPORTED_PROTOCOL", "bundle-protocol", ["/desen"]],
    [receipt.schemaInvalid, "SCHEMA_INVALID", "bundle-schema", ["/entry"]],
    [receipt.malformed, "SCHEMA_INVALID", "bundle-json", [""]],
    [receipt.duplicate, "SCHEMA_INVALID", "bundle-json", ["/kind"]],
    [receipt.rawBundleLimit?.verification, "BUNDLE_LIMIT_EXCEEDED", "bundle-size", [""]],
    [receipt.canonicalExpansion?.verification, "BUNDLE_LIMIT_EXCEEDED", "bundle-size", [""]],
    [receipt.sourceRawLimit?.verification, EXPECTED_SOURCE_LIMIT_CODE, "source-material", [""]],
    [
      receipt.sourceParserLimit?.verification,
      EXPECTED_SOURCE_LIMIT_CODE,
      "source-json",
      ["/authoring/padding"],
    ],
    [
      receipt.sourceCanonicalExpansion?.verification,
      EXPECTED_SOURCE_LIMIT_CODE,
      "source-json",
      [""],
    ],
    [
      receipt.failFastStructuralGuard?.rootChildArray?.verification,
      "SCHEMA_INVALID",
      "bundle-schema",
      ["/surfaces/home/root/slots/default/0/id"],
    ],
    [
      receipt.failFastStructuralGuard?.customEmbeddedSchemas?.verification,
      "SCHEMA_INVALID",
      "bundle-schema",
      ["/surfaces/home/state/s0/schema/$ref"],
    ],
  ];
  for (const [failureReceipt, expectedCode, expectedStage, expectedPointers] of expectedFailures) {
    if (
      failureReceipt?.status !== "rejected" ||
      failureReceipt?.resultFrozen !== true ||
      failureReceipt?.diagnosticsFrozen !== true ||
      failureReceipt?.stage !== expectedStage ||
      JSON.stringify(failureReceipt?.codes) !== JSON.stringify([expectedCode]) ||
      JSON.stringify(failureReceipt?.pointers) !== JSON.stringify(expectedPointers)
    ) {
      fail("RUNTIME_PROBE_MISMATCH", `The ${expectedCode} verification receipt drifted.`);
    }
  }
  return deepFreeze(receipt);
}

export async function buildControlPlaneBundleVerificationEvidence(options) {
  const captured = exactOwnDataOptions(
    options,
    new Set(["prerequisiteBytes", "runtimeReceipt", "trackedFileBytes"]),
    "build options",
  );
  const taskSources = await taskSourceInventory();
  const trackedPaths = [
    APP_PACKAGE,
    APP_INDEX,
    ...taskSources,
    GENERATOR,
    VERIFIER,
    PROOF_LIBRARY,
    ATOMIC_WRITER,
    ROOT_TEST,
    ROOT_PACKAGE,
    CI_SOURCE,
    CI_INVENTORY,
    TRACEABILITY,
    ...FIXTURE_PINS.map(({ path: fixturePath }) => fixturePath),
    GUARD_SOURCE_SCHEMA,
    GUARD_BUNDLE_SCHEMA,
  ];
  const trackedFileBytes = captureByteOverrides(
    captured.trackedFileBytes,
    trackedPaths,
    "trackedFileBytes",
  );
  const prerequisiteBytes = captureByteOverrides(
    captured.prerequisiteBytes,
    CONTROL_PLANE_BUNDLE_VERIFICATION_PREREQUISITE_PINS.map(({ path: pinPath }) => pinPath),
    "prerequisiteBytes",
  );
  const runtimeReceipt = assertRuntimeReceipt(
    captured.runtimeReceipt === undefined
      ? await runControlPlaneBundleVerificationProbe()
      : copyInertJson(captured.runtimeReceipt, "runtimeReceipt"),
  );
  const [
    prerequisites,
    fixtures,
    trackedFiles,
    distribution,
    registrations,
    traceRows,
    tests,
    guardCodegen,
  ] = await Promise.all([
    prerequisiteReceipts(prerequisiteBytes),
    fixtureReceipts(trackedFileBytes),
    trackedFileReceipts(trackedFileBytes),
    distributionReceipts(),
    registrationProjection(trackedFileBytes),
    traceProjection(trackedFileBytes),
    packageTestProjection(trackedFileBytes),
    guardCodegenReceipt(trackedFileBytes),
  ]);
  const artifact = deepFreeze({
    schemaVersion: 1,
    profile: "desen.control-plane.bundle-verification-proof.v1",
    task: "M07-T02",
    result: "PASS",
    summary:
      "Untrusted stored bytes yield authenticated DESEN 0.1.0 Bundle authority only after bounded syntax, protocol, complete-size, revision, and available-Source digest verification.",
    prerequisites,
    fixtures,
    claims: {
      supportedProtocol: "0.1.0",
      failFastStructuralGuard: {
        generation: guardCodegen,
        runtime: runtimeReceipt.failFastStructuralGuard,
      },
      publicBoundary: {
        runtimeExports: EXPECTED_PUBLIC_RUNTIME_KEYS,
        sourceExports: registrations.publicSourceExports,
        packageSelfReference: runtimeReceipt.packageSelfReference,
        privateAuthorityReaderExported: !runtimeReceipt.privateInternalExportsAbsent,
      },
      limits: runtimeReceipt.limits,
      officialBundle: runtimeReceipt.official,
      publicationBearingBundle: runtimeReceipt.publication,
      completeBundleSizeProfile: {
        exactCanonicalLimit: runtimeReceipt.exactCanonicalLimit,
        rawLimitExceeded: runtimeReceipt.rawBundleLimit,
        canonicalExpansionExceeded: runtimeReceipt.canonicalExpansion,
      },
      availableSourceLimits: {
        diagnosticCode: EXPECTED_SOURCE_LIMIT_CODE,
        rawLimitExceeded: runtimeReceipt.sourceRawLimit,
        parserLimitExceeded: runtimeReceipt.sourceParserLimit,
        exactCanonicalLimit: runtimeReceipt.exactSourceCanonicalLimit,
        canonicalExpansionExceeded: runtimeReceipt.sourceCanonicalExpansion,
      },
      diagnostics: {
        requiredCodes: REQUIRED_DIAGNOSTIC_CODES,
        closedFailureStages: EXPECTED_VERIFICATION_STAGES,
        sourceMismatch: runtimeReceipt.sourceMismatch,
        revisionMismatch: runtimeReceipt.revisionMismatch,
        unsupportedProtocol: runtimeReceipt.unsupported,
        schemaInvalid: runtimeReceipt.schemaInvalid,
        malformedSyntax: runtimeReceipt.malformed,
        duplicateMember: runtimeReceipt.duplicate,
        oversizedIngress: runtimeReceipt.rawBundleLimit.verification,
      },
      authority: {
        returnedOnlyOnSuccess: true,
        publicMetadata: runtimeReceipt.official.matchedAuthority,
        unavailableSourceMetadata: runtimeReceipt.official.unavailableAuthority,
        runtimeAuthenticated: runtimeReceipt.official.matchedAuthority.authenticated,
        shallowCloneRejected: runtimeReceipt.official.authorityCloneRejected,
        immutable: runtimeReceipt.official.matchedAuthority.authorityFrozen,
        internalMetadataEqual:
          runtimeReceipt.official.matchedAuthority.publicAndInternalMetadataEqual,
      },
      precedence: [
        "exact entry capture and raw Bundle byte ceiling",
        "bounded Bundle UTF-8 and JSON syntax",
        "supported Bundle protocol",
        "complete canonical Bundle-size premeasurement",
        "fail-fast exact Bundle structural schema and exhaustive success consistency fence",
        "stored key, embedded revision, and recalculated revision equality",
        "exact Source availability envelope and raw Source byte ceiling",
        "bounded Source UTF-8 and JSON syntax",
        "supported Source protocol",
        "complete canonical Source-size premeasurement",
        "fail-fast exact Source structural schema and exhaustive success consistency fence",
        "available Source digest equality",
      ],
      registrations,
      traceRows,
    },
    trackedFiles,
    distribution,
    tests,
    nonclaims: [
      "M07-T03 still owns exact package target, version, artifact-digest resolution, and package preflight.",
      "M07-T04 still owns surface/capability reference preflight and the remaining finite runtime limits.",
      "M07-T05 still owns editable Source persistence, immutable Bundle integration, mutable channel pointers, and the local transport API.",
      "M07-T06 through M07-T11 still own staging, activation, last-known-good state, crash recovery, fault injection, concurrency, and reference-host channel consumption.",
      "Source bytes are verified only when explicitly supplied to this stateless boundary; this task does not persist, retrieve, select, or trust a Source location.",
      "Publication signatures and owner-specific publication measurements are not verified or claimed by M07-T02.",
      "Successful verification is not package preflight, staging, activation, or durable last-known-good authority.",
    ],
    reproduction: [
      "pnpm verify:control-plane-bundle-store",
      "pnpm --filter @desen/control-plane-api... build",
      "pnpm --filter @desen/control-plane-api typecheck",
      "pnpm --filter @desen/control-plane-api test:bundle-verification",
      "node scripts/generate-control-plane-bundle-verification-proof.mjs",
      "node scripts/verify-control-plane-bundle-verification.mjs",
      "node --test tests/control-plane-bundle-verification.test.mjs",
    ],
  });
  const artifactText = await format(JSON.stringify(artifact), {
    parser: "json",
    printWidth: 100,
  });
  const artifactBytes = Buffer.from(artifactText, "utf8");
  return Object.freeze({
    artifact,
    artifactBytes,
    artifactSha256: sha256(artifactBytes),
    runtimeReceipt,
  });
}

function proofDocumentHasExactPin(document, artifactSha256) {
  const artifactMentions = [
    ...document.matchAll(new RegExp(ARTIFACT.replaceAll(".", "\\."), "gu")),
  ];
  const hashMentions = [...document.matchAll(new RegExp(`sha256:${artifactSha256}`, "gu"))];
  return (
    artifactMentions.length === 1 &&
    hashMentions.length === 1 &&
    !document.includes("sha256:PENDING")
  );
}

function captureProofDocument(value) {
  if (typeof value !== "string" || Buffer.byteLength(value, "utf8") > MAX_AUTHORITY_BYTES) {
    fail("INVALID_OPTIONS", "proofDocument must be a bounded primitive string.");
  }
  return value;
}

export async function verifyControlPlaneBundleVerificationEvidence(options) {
  const captured = exactOwnDataOptions(
    options,
    new Set([
      "artifactBytes",
      "artifactPath",
      "prerequisiteBytes",
      "proofDocument",
      "proofDocumentPath",
      "runtimeReceipt",
      "trackedFileBytes",
    ]),
    "verify options",
  );
  const built = await buildControlPlaneBundleVerificationEvidence({
    ...(captured.prerequisiteBytes === undefined
      ? {}
      : { prerequisiteBytes: captured.prerequisiteBytes }),
    ...(captured.runtimeReceipt === undefined ? {} : { runtimeReceipt: captured.runtimeReceipt }),
    ...(captured.trackedFileBytes === undefined
      ? {}
      : { trackedFileBytes: captured.trackedFileBytes }),
  });
  const artifactPath = captureOptionalPath(captured.artifactPath, "artifactPath");
  const proofDocumentPath = captureOptionalPath(captured.proofDocumentPath, "proofDocumentPath");
  const artifactBytes =
    captured.artifactBytes === undefined
      ? await safeReadAbsolute(
          artifactPath === undefined
            ? DEFAULT_CONTROL_PLANE_BUNDLE_VERIFICATION_ARTIFACT_PATH
            : artifactPath,
        )
      : captureBytes(captured.artifactBytes, "artifactBytes");
  if (!byteEqual(artifactBytes, built.artifactBytes)) {
    fail("ARTIFACT_DRIFT", "The committed M07-T02 evidence artifact is not reproducible.");
  }
  const proofDocument =
    captured.proofDocument === undefined
      ? fatalText(
          await safeReadAbsolute(
            proofDocumentPath === undefined ? path.join(ROOT, PROOF_DOCUMENT) : proofDocumentPath,
          ),
          PROOF_DOCUMENT,
        )
      : captureProofDocument(captured.proofDocument);
  if (!proofDocumentHasExactPin(proofDocument, built.artifactSha256)) {
    fail("PROOF_PIN_DRIFT", "The proof document does not contain one exact final artifact pin.");
  }
  return Object.freeze({
    task: "M07-T02",
    result: "PASS",
    artifactSha256: built.artifactSha256,
    packageRuntimeCases: built.artifact.tests.packageRuntimeCases,
    packageGuardCases: built.artifact.tests.packageGuardCases,
    packageFocusedCases: built.artifact.tests.packageFocusedCases,
    compileTimeNegativeCases: built.artifact.tests.compileTimeNegativeCases,
    rootMutationCases: built.artifact.tests.rootMutationCases,
  });
}

export async function writeControlPlaneBundleVerificationEvidence(options) {
  const captured = exactOwnDataOptions(
    options,
    new Set(["artifactPath", "beforeAtomicRename"]),
    "write options",
  );
  const requestedPath = captureOptionalPath(captured.artifactPath, "artifactPath");
  if (
    captured.beforeAtomicRename !== undefined &&
    typeof captured.beforeAtomicRename !== "function"
  ) {
    fail("INVALID_OPTIONS", "beforeAtomicRename must be a function when supplied.");
  }
  const built = await buildControlPlaneBundleVerificationEvidence();
  const artifactPath = requestedPath ?? DEFAULT_CONTROL_PLANE_BUNDLE_VERIFICATION_ARTIFACT_PATH;
  try {
    await writeAtomicProofArtifact({
      artifactPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename: captured.beforeAtomicRename,
    });
  } catch {
    fail("ARTIFACT_WRITE_FAILED", "The M07-T02 artifact could not be committed atomically.");
  }
  return Object.freeze({
    artifactPath: path.resolve(artifactPath),
    artifactSha256: built.artifactSha256,
  });
}
