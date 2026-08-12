import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import { lstat, mkdtemp, open, readdir, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify, types as utilTypes } from "node:util";

import { format } from "prettier";
import ts from "typescript";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ARTIFACT = "docs/proof/artifacts/control-plane-api-0.1.0-runtime-recovery.json";
const APP_DIRECTORY = "apps/control-plane-api";
const APP_PACKAGE = `${APP_DIRECTORY}/package.json`;
const APP_INDEX = `${APP_DIRECTORY}/src/index.ts`;
const APP_CONTRACT = `${APP_DIRECTORY}/src/runtime-activation-contract.ts`;
const APP_INTERNAL = `${APP_DIRECTORY}/src/runtime-activation-internal.ts`;
const APP_REPOSITORY = `${APP_DIRECTORY}/src/runtime-activation-repository-internal.ts`;
const APP_SQLITE = `${APP_DIRECTORY}/src/runtime-activation-sqlite-internal.ts`;
const APP_FACTORY = `${APP_DIRECTORY}/src/runtime-activation.ts`;
const APP_RECOVERY_INTERNAL = `${APP_DIRECTORY}/src/runtime-recovery-internal.ts`;
const APP_RUNTIME_TEST = `${APP_DIRECTORY}/test/runtime-activation.test.ts`;
const APP_TYPE_TEST = `${APP_DIRECTORY}/test/runtime-activation.types.ts`;
const APP_RECOVERY_TEST = `${APP_DIRECTORY}/test/runtime-recovery.test.ts`;
const APP_RECOVERY_TYPE_TEST = `${APP_DIRECTORY}/test/runtime-recovery.types.ts`;
const ADR = "docs/adr/0014-runtime-restart-recovery.md";
const PROOF_DOCUMENT = "docs/proof/CONTROL-PLANE-RUNTIME-RECOVERY.md";
const TRACEABILITY = "docs/proof/protocol-0.1.0-traceability.json";
const ROOT_PACKAGE = "package.json";
const CI_SOURCE = "scripts/run-ci-quality-gate.mjs";
const CI_INVENTORY = "scripts/ci/exhaustive-workload-inventory.mjs";
const SHARED_STATE_AUTHORITY = "scripts/ci/shared-state-authority.mjs";
const GENERATOR = "scripts/generate-control-plane-runtime-recovery-proof.mjs";
const VERIFIER = "scripts/verify-control-plane-runtime-recovery.mjs";
const PROOF_LIBRARY = "scripts/lib/control-plane-runtime-recovery-proof.mjs";
const ATOMIC_WRITER = "scripts/lib/atomic-proof-artifact.mjs";
const ROOT_TEST = "tests/control-plane-runtime-recovery.test.mjs";
const BUNDLE_FIXTURE = "examples/sign-in/official-derived.bundle.desen.json";
const CATALOG_FIXTURE = "packages/reference-catalog-web/catalog.json";
const CATALOG_DISTRIBUTION = "packages/reference-catalog-web/dist";

const MAX_AUTHORITY_BYTES = 16 * 1_024 * 1_024;
const MAX_INERT_JSON_NODES = 200_000;
const MAX_INERT_JSON_DEPTH = 512;
const MAX_INERT_JSON_UTF8_BYTES = MAX_AUTHORITY_BYTES;
const READ_FLAGS =
  fileConstants.O_RDONLY | (fileConstants.O_NOFOLLOW ?? 0) | (fileConstants.O_NONBLOCK ?? 0);
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
const execFileAsync = promisify(execFile);

const REVISION_A = "sha256:2dc98d276a3b4102c2891de1519bda86ea2978f5429fd8ea91831f36f8b73ffb";
const REVISION_B = "sha256:cdd16ae0764d3de1199e0e93a0baf7b183ea50ecb207f21cbd197bd1bbcb4ca6";
const TRACE_IDS = Object.freeze(["PIPE-017", "A-009"]);
const CI_TUPLE = Object.freeze([
  "control-plane-runtime-recovery",
  "scripts/verify-control-plane-runtime-recovery.mjs",
  "tests/control-plane-runtime-recovery.test.mjs",
]);
const EXPECTED_PUBLIC_EXPORT_INVENTORY_SHA256 =
  "c3daff8c4df98edc5beaa3f64cb8805613ed5cb29b55aed771346ba3b8949e43";
const EXPECTED_IMPLEMENTATION_SEMANTIC_SHA256 = Object.freeze({
  [APP_CONTRACT]: "00d813dac1aa9a45a6206be0f94684f623b6ce26d8ac27283586b6ca32ace21b",
  [APP_INTERNAL]: "503f441db6263b72de734860806fb5b3388cbe27e9cb14c94ea74598e11beef4",
  [APP_RECOVERY_INTERNAL]: "9ecace5aeb8a7f407cb733731b7d7d6e2f36d930545aaf4cb07dacfbd5b6f1ba",
  [APP_FACTORY]: "c218626f5be645e8f685ce872fa222f908549f6c147cfc84613e6ff625b83931",
});
const EXPECTED_TEST_AUTHORITY_SHA256 = Object.freeze({
  [APP_RECOVERY_TEST]: "904b0495417f5978c4eb71f3d3be18c5cab3dc9e9027b6e37721d4a630baadde",
  [APP_RECOVERY_TYPE_TEST]: "0760afa5ac944fbfcb5b5e46fffe416286214d7dc8c0111058c276de31b8cf52",
  [ROOT_TEST]: "b97e7991e0ac20e7232112594228fdd829a536e81d16d06fd3f909e7e3a02492",
});
const M07_T09_TEST_AUTHORITY_RECEIPTS = Object.freeze({
  [ROOT_TEST]: Object.freeze({
    bytes: 26_432,
    sha256: "d1c898e91d695972c6cdc14e9d5eb138c6655e43a5cbefb5c32bd819748a9eeb",
  }),
});
const M07_T10_TEST_AUTHORITY_RECEIPTS = Object.freeze({
  [ROOT_TEST]: Object.freeze({
    bytes: 28_220,
    sha256: "968dadebad1b4f07ce9d6b277988788a07cb0cdeea06a1cc598a0d1e25f07dbc",
  }),
});
const M07_T11_TEST_AUTHORITY_RECEIPTS = Object.freeze({
  [ROOT_TEST]: Object.freeze({
    bytes: 28_570,
    sha256: "5c0f08c766adf6cb45c68e8d3d406d964c98db3f4c3b662ce0e6319b90815d8e",
  }),
});
const EXPECTED_REGISTRATION_AUTHORITY_SHA256 = Object.freeze({
  [CI_SOURCE]: "c0312d1874917092f4300b7bdb789bc2a35a2d2f973a0bb214b551d86916fabe",
  [CI_INVENTORY]: "00b6b4601e526a9d71465700e5f50d68c84265c211de1ed7f5e9ccee8670b62b",
  [SHARED_STATE_AUTHORITY]: "a6aab2fbefa3392b8614c92799d75429ca5b1b6f812c45b73cb7167fc4be9f16",
});
const M07_T09_REGISTRATION_AUTHORITY_RECEIPTS = Object.freeze({
  [CI_SOURCE]: Object.freeze({
    bytes: 48_058,
    sha256: "cae746df78f6036db3b1bf092ef03f367994a27316757ee52d86b7607a46423a",
  }),
  [CI_INVENTORY]: Object.freeze({
    bytes: 46_343,
    sha256: "554584fff74af5d2ba1e268b18bd901c8f228cdffe046789fbd02f1f9da5f69e",
  }),
  [SHARED_STATE_AUTHORITY]: Object.freeze({
    bytes: 47_479,
    sha256: "9b15cef3b2d795c268945c2f4bee670c037878bd43967c1ce71a41342d463140",
  }),
});
const M07_T10_REGISTRATION_AUTHORITY_RECEIPTS = Object.freeze({
  [CI_SOURCE]: Object.freeze({
    bytes: 48_249,
    sha256: "fdb79dcf8e5fa46e6a22e07e04fc1623214ea0af164b3dde2d876531479177f3",
  }),
  [CI_INVENTORY]: Object.freeze({
    bytes: 46_524,
    sha256: "3b411b2866820003896a7fe6e41fb5fca2db84300687e07d10ab92ce5fdb407f",
  }),
  [SHARED_STATE_AUTHORITY]: Object.freeze({
    bytes: 47_816,
    sha256: "f7827f300a9a53edc6a0c41bf1246df53d5ab21c4cd4e67c6452a2cb95c74e99",
  }),
});
const M07_T11_REGISTRATION_AUTHORITY_RECEIPTS = Object.freeze({
  [CI_SOURCE]: Object.freeze({
    bytes: 48_440,
    sha256: "68fcfacafb2765db2b60b717089a0c1c237f28efb32a5512b4fe38e986f7d459",
  }),
  [CI_INVENTORY]: Object.freeze({
    bytes: 46_705,
    sha256: "c290e7fbcf0adf9d56efa039209e140fb56e31a7a8e2b84e90b2e73330031805",
  }),
  [SHARED_STATE_AUTHORITY]: Object.freeze({
    bytes: 51_626,
    sha256: "0fd1695a90e8c9e6772413fea47a02129af025b7a1cfbc3cc7068560cb764721",
  }),
});
const EXPECTED_RUNTIME_RECOVERY_SUITE_NAME = "M07-T08 restart recovery";
const EXPECTED_RUNTIME_PUBLIC_MODULE_KEYS = Object.freeze([
  "BUNDLE_INTEGRITY_LIMITS",
  "BUNDLE_PACKAGE_PREFLIGHT_LIMITS",
  "BUNDLE_REFERENCE_PREFLIGHT_LIMITS",
  "BUNDLE_RUNTIME_STAGING_LIMITS",
  "BundleStoreError",
  "INVALID_BUNDLE_INTEGRITY_AUTHORITY_CODE",
  "INVALID_BUNDLE_PACKAGE_AUTHORITY_CODE",
  "INVALID_INSTALLED_PACKAGE_CODE",
  "INVALID_RUNTIME_ACTIVATION_AUTHORITY_CODE",
  "INVALID_RUNTIME_RECOVERY_PACKAGE_AUTHORITY_CODE",
  "INVALID_RUNTIME_STAGING_PACKAGE_AUTHORITY_CODE",
  "LOCAL_CONTROL_PLANE_ERROR_MESSAGES",
  "LOCAL_CONTROL_PLANE_IDENTIFIER_PATTERN",
  "LOCAL_CONTROL_PLANE_JSON_MEDIA_TYPE",
  "LOCAL_CONTROL_PLANE_LIMITS",
  "LOCAL_CONTROL_PLANE_LOOPBACK_ADDRESS",
  "LocalControlPlaneError",
  "PACKAGE_PREFLIGHT_INTERNAL_FAILURE_CODE",
  "PACKAGE_PREFLIGHT_LIMIT_EXCEEDED_CODE",
  "REFERENCE_PREFLIGHT_INTERNAL_FAILURE_CODE",
  "RUNTIME_ACTIVATION_BUNDLE_RECLOSURE_FAILED_CODE",
  "RUNTIME_ACTIVATION_INTERNAL_FAILURE_CODE",
  "RUNTIME_RECOVERY_BUNDLE_RECLOSURE_FAILED_CODE",
  "RUNTIME_RECOVERY_INTERNAL_FAILURE_CODE",
  "RUNTIME_STAGING_INTERNAL_FAILURE_CODE",
  "RUNTIME_STAGING_LIMIT_EXCEEDED_CODE",
  "RUNTIME_STAGING_PACKAGE_SNAPSHOT_MISMATCH_CODE",
  "RuntimeActivationError",
  "SOURCE_MATERIAL_LIMIT_EXCEEDED_CODE",
  "openBundleRuntimeActivation",
  "openBundleStore",
  "openLocalControlPlane",
  "preflightBundlePackages",
  "preflightBundleReferences",
  "stageBundleRuntime",
  "verifyBundleStoreEntry",
]);

const ROOT_SCRIPT_COMMANDS = Object.freeze({
  generate:
    "pnpm verify:control-plane-runtime-activation && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:runtime-recovery && node scripts/generate-control-plane-runtime-recovery-proof.mjs",
  verify:
    "pnpm verify:control-plane-runtime-activation && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:runtime-recovery && node scripts/verify-control-plane-runtime-recovery.mjs",
  test: "pnpm verify:control-plane-runtime-activation && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:runtime-recovery && node --test tests/control-plane-runtime-recovery.test.mjs",
});

const EXPECTED_RUNTIME_RECOVERY_TEST_NAMES = Object.freeze([
  "rebuilds generation-zero authority without changing the durable record",
  "revalidates both lineages and uses the recovered record as the next CAS baseline",
  "rejects mismatched, missing, cloned, and proxied package authorities without publication",
  "publishes neither active nor fallback authority when either durable Bundle is missing",
  "fails closed on an unsafe previous-good Bundle path instead of using active alone",
  "recovers the durable winner after a post-COMMIT observation failure",
  "reauthenticates all three fields plus deletion after asynchronous Bundle reads",
  "does not begin previous-good store I/O after close while active reclosure is pending",
  "preserves durable state when active T04 or previous-good T06 reconstruction rejects",
  "restores the safe-integer ceiling without wrapping or resetting generation",
  "rejects a generation-zero record that the transactional repository cannot produce",
  "serializes restart reconstruction and leaves an empty controller unchanged",
]);

const EXPECTED_RECOVERY_TYPE_CLAIMS = Object.freeze([
  "Recovered authority metadata is immutable.",
  "Recovery authority exposes no persistent record writer.",
  "Recovery authority cannot authorize another recovery.",
  "Recovery authority exposes no Bundle or installed-package bytes.",
  "Recovery authority exposes no package or native-module loader.",
  "Recovery authority exposes no SQLite handle.",
  "A no-op recovery result carries no reconstructed authority.",
  "Rejected recovery never carries partial authority.",
  "A raw durable record cannot forge recovered runtime authority.",
  "A raw durable record is not an opaque package authority.",
  "An activation authority cannot replace the active package lineage.",
  "Previous-good package authority is explicitly null or authentic authority.",
  "Caller cannot add a record, revision, path, store, or loader argument.",
  "Recovery accepts package authority, not T07 active authority, in the fallback slot.",
]);

const TRACKED_TASK_FILES = Object.freeze([
  APP_PACKAGE,
  APP_INDEX,
  APP_CONTRACT,
  APP_INTERNAL,
  APP_REPOSITORY,
  APP_SQLITE,
  APP_FACTORY,
  APP_RECOVERY_INTERNAL,
  APP_RUNTIME_TEST,
  APP_TYPE_TEST,
  APP_RECOVERY_TEST,
  APP_RECOVERY_TYPE_TEST,
  ADR,
  TRACEABILITY,
  ROOT_PACKAGE,
  CI_SOURCE,
  CI_INVENTORY,
  SHARED_STATE_AUTHORITY,
  GENERATOR,
  VERIFIER,
  PROOF_LIBRARY,
  ATOMIC_WRITER,
  ROOT_TEST,
]);

const M07_T09_TRACKED_RECEIPT_BRIDGE = Object.freeze({
  [APP_PACKAGE]: Object.freeze({
    historical: Object.freeze({
      bytes: 2_232,
      sha256: "b228b200dafda1d319429376b9cc6456fadd4a3db865269ec8c2675eb0e60e8c",
    }),
    successor: Object.freeze({
      bytes: 2_319,
      sha256: "5c4495f06ecb1394fee2c14c2e57bc1bf76fe9a99ee1cb56c0ce4ff0874388c3",
    }),
  }),
  [ADR]: Object.freeze({
    historical: Object.freeze({
      bytes: 6_844,
      sha256: "1d9769bfb0d8a649388b1c91f8ccb079b963e919ff23995d88e1d9910ce4e330",
    }),
    successor: Object.freeze({
      bytes: 6_902,
      sha256: "c49ad785bf0018ee93115b18a31644505ac97cdc69b8f177b6843ee21f77a98a",
    }),
  }),
  [ROOT_PACKAGE]: Object.freeze({
    historical: Object.freeze({
      bytes: 63_983,
      sha256: "4f9c7431ba3df1be3e69bfd092a24421c14ed4a911baed2edbbb395aacca1cc8",
    }),
    successor: Object.freeze({
      bytes: 65_109,
      sha256: "4df33d2b8b54754c8b4686c52ae9566d29c3979a15b1c4ece9845c7c0c8ea2c2",
    }),
  }),
  [CI_SOURCE]: Object.freeze({
    historical: Object.freeze({
      bytes: 47_870,
      sha256: "c0312d1874917092f4300b7bdb789bc2a35a2d2f973a0bb214b551d86916fabe",
    }),
    successor: M07_T09_REGISTRATION_AUTHORITY_RECEIPTS[CI_SOURCE],
  }),
  [CI_INVENTORY]: Object.freeze({
    historical: Object.freeze({
      bytes: 46_165,
      sha256: "00b6b4601e526a9d71465700e5f50d68c84265c211de1ed7f5e9ccee8670b62b",
    }),
    successor: M07_T09_REGISTRATION_AUTHORITY_RECEIPTS[CI_INVENTORY],
  }),
  [SHARED_STATE_AUTHORITY]: Object.freeze({
    historical: Object.freeze({
      bytes: 46_971,
      sha256: "a6aab2fbefa3392b8614c92799d75429ca5b1b6f812c45b73cb7167fc4be9f16",
    }),
    successor: M07_T09_REGISTRATION_AUTHORITY_RECEIPTS[SHARED_STATE_AUTHORITY],
  }),
});

const M07_T10_TRACKED_RECEIPT_BRIDGE = Object.freeze({
  [APP_PACKAGE]: Object.freeze({
    historical: M07_T09_TRACKED_RECEIPT_BRIDGE[APP_PACKAGE].successor,
    successor: Object.freeze({
      bytes: 2_408,
      sha256: "a54beedd590df3f2c802f42fc7adf8f703a7a69eb1c34dc67fedbb4c23a982c2",
    }),
  }),
  [APP_SQLITE]: Object.freeze({
    historical: Object.freeze({
      bytes: 22_508,
      sha256: "a97191a6d508d4ff3c26e0f691e52b9c9215b4ecb69a014da4ecd03086a3beeb",
    }),
    successor: Object.freeze({
      bytes: 23_137,
      sha256: "cec7d1437d7e222facdc5681ae720ec6bc3b77fe3f9f5fac7493481f868be164",
    }),
  }),
  [ADR]: Object.freeze({
    historical: M07_T09_TRACKED_RECEIPT_BRIDGE[ADR].successor,
    successor: Object.freeze({
      bytes: 6_918,
      sha256: "14d5c1e440b83771414663fdd4cb45cb6b95cb0e6598f2465b55df121f2692d8",
    }),
  }),
  [ROOT_PACKAGE]: Object.freeze({
    historical: M07_T09_TRACKED_RECEIPT_BRIDGE[ROOT_PACKAGE].successor,
    successor: Object.freeze({
      bytes: 66_267,
      sha256: "c0029dc0bc1057f2130a93220479618eee018777d2f1fcc315e2251d829b0e02",
    }),
  }),
  [CI_SOURCE]: Object.freeze({
    historical: M07_T09_REGISTRATION_AUTHORITY_RECEIPTS[CI_SOURCE],
    successor: M07_T10_REGISTRATION_AUTHORITY_RECEIPTS[CI_SOURCE],
  }),
  [CI_INVENTORY]: Object.freeze({
    historical: M07_T09_REGISTRATION_AUTHORITY_RECEIPTS[CI_INVENTORY],
    successor: M07_T10_REGISTRATION_AUTHORITY_RECEIPTS[CI_INVENTORY],
  }),
  [SHARED_STATE_AUTHORITY]: Object.freeze({
    historical: M07_T09_REGISTRATION_AUTHORITY_RECEIPTS[SHARED_STATE_AUTHORITY],
    successor: M07_T10_REGISTRATION_AUTHORITY_RECEIPTS[SHARED_STATE_AUTHORITY],
  }),
});
const M07_T11_TRACKED_RECEIPT_BRIDGE = Object.freeze({
  [ROOT_PACKAGE]: Object.freeze({
    historical: M07_T10_TRACKED_RECEIPT_BRIDGE[ROOT_PACKAGE].successor,
    successor: Object.freeze({
      bytes: 68_073,
      sha256: "110ffffddf7677f6a578c44a0fba31fa15cc7bf08c8b66224cb0ef47e49b4d2b",
    }),
  }),
  [CI_SOURCE]: Object.freeze({
    historical: M07_T10_TRACKED_RECEIPT_BRIDGE[CI_SOURCE].successor,
    successor: M07_T11_REGISTRATION_AUTHORITY_RECEIPTS[CI_SOURCE],
  }),
  [CI_INVENTORY]: Object.freeze({
    historical: M07_T10_TRACKED_RECEIPT_BRIDGE[CI_INVENTORY].successor,
    successor: M07_T11_REGISTRATION_AUTHORITY_RECEIPTS[CI_INVENTORY],
  }),
  [SHARED_STATE_AUTHORITY]: Object.freeze({
    historical: M07_T10_TRACKED_RECEIPT_BRIDGE[SHARED_STATE_AUTHORITY].successor,
    successor: M07_T11_REGISTRATION_AUTHORITY_RECEIPTS[SHARED_STATE_AUTHORITY],
  }),
});

// DEBT-I07-016 retains the historical diagnostic marker "reviewed M07-T09 CI registration set"
// until I07-04 removes the M07-T09 reader bridge. Runtime failures use the current T10 wording.
// A reader cannot embed its own current digest without recursion. The append-only proof-reader
// checkpoint authenticates current reader bytes; this projection preserves the frozen T08 receipt.
const M07_T09_READER_RECEIPT_PROJECTION = Object.freeze({
  [PROOF_LIBRARY]: Object.freeze({
    bytes: 84_219,
    sha256: "08f143107430dde90cf1865c21d7ce1ec854897b0c1c4306b96525bdd0d18daa",
  }),
  [ROOT_TEST]: Object.freeze({
    bytes: 24_939,
    sha256: "b97e7991e0ac20e7232112594228fdd829a536e81d16d06fd3f909e7e3a02492",
  }),
});

const DISTRIBUTION_FILES = Object.freeze([
  `${APP_DIRECTORY}/dist/index.js`,
  `${APP_DIRECTORY}/dist/index.d.ts`,
  `${APP_DIRECTORY}/dist/runtime-activation-contract.js`,
  `${APP_DIRECTORY}/dist/runtime-activation-contract.d.ts`,
  `${APP_DIRECTORY}/dist/runtime-activation-internal.js`,
  `${APP_DIRECTORY}/dist/runtime-activation-internal.d.ts`,
  `${APP_DIRECTORY}/dist/runtime-activation.js`,
  `${APP_DIRECTORY}/dist/runtime-activation.d.ts`,
  `${APP_DIRECTORY}/dist/runtime-recovery-internal.js`,
  `${APP_DIRECTORY}/dist/runtime-recovery-internal.d.ts`,
]);

export const CONTROL_PLANE_RUNTIME_RECOVERY_PREREQUISITE_PINS = Object.freeze([
  Object.freeze({
    task: "M07-T01",
    path: "docs/proof/artifacts/control-plane-api-0.1.0-bundle-store.json",
    bytes: 22_396,
    sha256: "698be7d5610d1732ad991bf7e58131e81d2c34ffa888f65ec3c7916334f54795",
  }),
  Object.freeze({
    task: "M07-T04",
    path: "docs/proof/artifacts/control-plane-api-0.1.0-reference-preflight.json",
    bytes: 34_612,
    sha256: "29555326d51073c50937519d8706049ad17287079cc3ef4dc7060bb3a3225394",
  }),
  Object.freeze({
    task: "M07-T06",
    path: "docs/proof/artifacts/control-plane-api-0.1.0-runtime-staging.json",
    bytes: 47_622,
    sha256: "d025da5329d5b56b9b46e7292a08883386a151add5e419edf2a9345425319494",
  }),
  Object.freeze({
    task: "M07-T07",
    path: "docs/proof/artifacts/control-plane-api-0.1.0-runtime-activation.json",
    bytes: 49_892,
    sha256: "3129a8e40c837a1c49d7fe206de794e0f7f7e130dc7e5e90a012b9e38bf07334",
  }),
]);

export const CONTROL_PLANE_RUNTIME_RECOVERY_ROOT_TEST_NAMES = Object.freeze([
  "[authority] builds the exact M07-T08 recovery artifact from the built API receipt",
  "[determinism] two independent evidence builds are byte-identical",
  "[prerequisites] rejects drift in every immutable predecessor artifact",
  "[runtime] rejects one changed recovery receipt field",
  "[implementation] rejects removal of the public recovery boundary",
  "[artifact] verifies exact bytes and rejects one changed byte",
  "[writer] atomically writes deterministic evidence and preserves an old destination on failure",
  "[options] rejects unknown, accessor-backed, proxy, and shared-memory inputs",
  "[immutability] freezes the complete evidence graph and preserves later-task nonclaims",
]);

export const DEFAULT_CONTROL_PLANE_RUNTIME_RECOVERY_ARTIFACT_PATH = path.join(ROOT, ARTIFACT);

export class ControlPlaneRuntimeRecoveryEvidenceError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ControlPlaneRuntimeRecoveryEvidenceError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details = {}) {
  throw new ControlPlaneRuntimeRecoveryEvidenceError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
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
    (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
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

function captureBytes(value, label) {
  try {
    if (!utilTypes.isUint8Array(value) || utilTypes.isProxy(value)) {
      fail("INVALID_OPTIONS", `${label} must be an authentic Uint8Array.`);
    }
    if (
      TYPED_ARRAY_BUFFER_GETTER === undefined ||
      TYPED_ARRAY_BYTE_LENGTH_GETTER === undefined ||
      TYPED_ARRAY_BYTE_OFFSET_GETTER === undefined
    ) {
      fail("INVALID_OPTIONS", `${label} cannot be captured by this runtime.`);
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
      fail("INVALID_OPTIONS", `${label} must be bounded and nonshared.`);
    }
    const copy = new Uint8Array(byteLength);
    Reflect.apply(UINT8_ARRAY_SET, copy, [new Uint8Array(buffer, byteOffset, byteLength)]);
    return copy;
  } catch (error) {
    if (error instanceof ControlPlaneRuntimeRecoveryEvidenceError) throw error;
    fail("INVALID_OPTIONS", `${label} could not be captured safely.`);
  }
}

function chargeInertJsonBudget(budget, text = "") {
  budget.nodes += 1;
  budget.utf8Bytes += 16 + Buffer.byteLength(text, "utf8");
  if (budget.nodes > MAX_INERT_JSON_NODES || budget.utf8Bytes > MAX_INERT_JSON_UTF8_BYTES) {
    fail("INVALID_OPTIONS", "Inert JSON exceeds its fixed finite capture budget.");
  }
}

/**
 * Copies exact inert JSON through own data descriptors without invoking getters, proxies, or
 * `toJSON` hooks. Cycles, exotic prototypes, sparse arrays, symbols, active properties, excessive
 * depth, and excessive aggregate work fail before evidence can be constructed.
 */
function copyInertJson(
  value,
  label,
  active = new Set(),
  budget = { nodes: 0, utf8Bytes: 0 },
  depth = 0,
) {
  if (depth > MAX_INERT_JSON_DEPTH) {
    fail("INVALID_OPTIONS", `${label} exceeds its inert JSON depth ceiling.`);
  }
  if (value === null || typeof value === "boolean") {
    chargeInertJsonBudget(budget);
    return value;
  }
  if (typeof value === "string") {
    chargeInertJsonBudget(budget, value);
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      fail("INVALID_OPTIONS", `${label} contains a non-finite JSON number.`);
    }
    chargeInertJsonBudget(budget, String(value));
    return value;
  }
  if (typeof value !== "object" || utilTypes.isProxy(value) || active.has(value)) {
    fail("INVALID_OPTIONS", `${label} must contain only acyclic inert JSON.`);
  }

  chargeInertJsonBudget(budget);
  active.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype) {
        fail("INVALID_OPTIONS", `${label} contains a non-ordinary array.`);
      }
      const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
      const length = lengthDescriptor?.value;
      if (
        lengthDescriptor === undefined ||
        !("value" in lengthDescriptor) ||
        typeof length !== "number" ||
        !Number.isSafeInteger(length) ||
        length < 0 ||
        length > MAX_INERT_JSON_NODES ||
        Reflect.ownKeys(value).length !== length + 1
      ) {
        fail("INVALID_OPTIONS", `${label} contains a sparse or extended array.`);
      }
      const output = [];
      for (let index = 0; index < length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
          fail("INVALID_OPTIONS", `${label} contains an active array entry.`);
        }
        output.push(copyInertJson(descriptor.value, label, active, budget, depth + 1));
      }
      return Object.freeze(output);
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      fail("INVALID_OPTIONS", `${label} contains a non-ordinary record.`);
    }
    const output = Object.create(null);
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        typeof key !== "string" ||
        descriptor === undefined ||
        !descriptor.enumerable ||
        !("value" in descriptor)
      ) {
        fail("INVALID_OPTIONS", `${label} contains an active or symbolic field.`);
      }
      chargeInertJsonBudget(budget, key);
      output[key] = copyInertJson(descriptor.value, label, active, budget, depth + 1);
    }
    return Object.freeze(output);
  } finally {
    active.delete(value);
  }
}

function captureByteOverrides(value, allowedPaths, label) {
  if (value === undefined) return Object.freeze({});
  const captured = exactOwnDataOptions(value, new Set(allowedPaths), label);
  const result = {};
  for (const [relativePath, bytes] of Object.entries(captured)) {
    result[relativePath] = captureBytes(bytes, `${label}.${relativePath}`);
  }
  return Object.freeze(result);
}

function byteEqual(left, right) {
  return Buffer.from(left).equals(Buffer.from(right));
}

function sameAuthorityIdentity(left, right) {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.nlink === right.nlink &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
  );
}

function safeAuthorityByteCeiling(value) {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_AUTHORITY_BYTES) {
    fail("INVALID_OPTIONS", "The proof authority byte ceiling is invalid.");
  }
  return value;
}

async function inspectCanonicalAuthorityParent(requestedParent, expectedIdentity) {
  let entry;
  let canonical;
  try {
    entry = await lstat(requestedParent, { bigint: true });
    canonical = await realpath(requestedParent);
  } catch {
    fail("AUTHORITY_IO_FAILURE", "A proof authority parent cannot be resolved.");
  }
  if (
    !entry.isDirectory() ||
    entry.isSymbolicLink() ||
    entry.nlink < 1n ||
    canonical !== requestedParent
  ) {
    fail("UNSAFE_AUTHORITY", "A proof authority parent must be one canonical directory.");
  }
  if (expectedIdentity !== undefined && !sameAuthorityIdentity(entry, expectedIdentity)) {
    fail("UNSAFE_AUTHORITY", "A proof authority parent changed while reading.");
  }
  return entry;
}

async function boundedAuthorityRead(handle, expectedBytes, maximumBytes) {
  const capacity = expectedBytes + 1;
  const target = Buffer.alloc(capacity);
  let total = 0;
  while (total < capacity) {
    const { bytesRead } = await handle.read(target, total, capacity - total, total);
    if (bytesRead === 0) break;
    total += bytesRead;
  }
  if (total > expectedBytes || total > maximumBytes) {
    fail("UNSAFE_AUTHORITY", "A proof authority grew while reading.");
  }
  return target.subarray(0, total);
}

async function safeReadAbsolute(
  absolutePath,
  maximumBytes = MAX_AUTHORITY_BYTES,
  afterOpenForTest,
) {
  const byteCeiling = safeAuthorityByteCeiling(maximumBytes);
  const requested = path.resolve(absolutePath);
  const requestedParent = path.dirname(requested);
  const parentBefore = await inspectCanonicalAuthorityParent(requestedParent);
  const resolved = path.join(requestedParent, path.basename(requested));
  let before;
  try {
    before = await lstat(resolved, { bigint: true });
  } catch {
    fail("AUTHORITY_IO_FAILURE", "A proof authority cannot be inspected.");
  }
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1n) {
    fail("UNSAFE_AUTHORITY", "A proof authority must be one regular single-link file.");
  }
  if (before.size > BigInt(byteCeiling)) {
    fail("UNSAFE_AUTHORITY", "A proof authority exceeds its byte ceiling.");
  }

  let handle;
  try {
    handle = await open(resolved, READ_FLAGS);
    const opened = await handle.stat({ bigint: true });
    if (
      !opened.isFile() ||
      opened.nlink !== 1n ||
      !sameAuthorityIdentity(opened, before) ||
      opened.size > BigInt(byteCeiling)
    ) {
      fail("UNSAFE_AUTHORITY", "A proof authority changed identity while opening.");
    }
    await inspectCanonicalAuthorityParent(requestedParent, parentBefore);
    await afterOpenForTest?.(Object.freeze({ path: resolved }));
    const expectedBytes = Number(opened.size);
    const bytes = await boundedAuthorityRead(handle, expectedBytes, byteCeiling);
    const after = await lstat(resolved, { bigint: true });
    await inspectCanonicalAuthorityParent(requestedParent, parentBefore);
    if (
      !after.isFile() ||
      after.isSymbolicLink() ||
      after.nlink !== 1n ||
      !sameAuthorityIdentity(after, opened) ||
      bytes.byteLength !== expectedBytes ||
      bytes.byteLength > byteCeiling
    ) {
      fail("UNSAFE_AUTHORITY", "A proof authority changed while reading.");
    }
    return Uint8Array.from(bytes);
  } catch (error) {
    if (error instanceof ControlPlaneRuntimeRecoveryEvidenceError) throw error;
    fail("AUTHORITY_IO_FAILURE", "A proof authority cannot be read safely.");
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

/** Deterministic package-local seam for hostile authority-file mutation tests. @internal */
export async function readControlPlaneRuntimeRecoveryAuthorityForTest(
  absolutePath,
  afterOpenForTest,
) {
  if (
    typeof absolutePath !== "string" ||
    absolutePath.length === 0 ||
    absolutePath.includes("\0") ||
    typeof afterOpenForTest !== "function"
  ) {
    fail("INVALID_OPTIONS", "The authority read test seam requires a path and callback.");
  }
  return safeReadAbsolute(absolutePath, MAX_AUTHORITY_BYTES, afterOpenForTest);
}

async function workspaceBytes(relativePath, overrides) {
  return overrides[relativePath] ?? safeReadAbsolute(path.join(ROOT, relativePath));
}

function fatalText(bytes, label) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail("SOURCE_DRIFT", `${label} is not valid UTF-8.`);
  }
}

function parseJsonBytes(bytes, label) {
  try {
    return JSON.parse(fatalText(bytes, label));
  } catch (error) {
    if (error instanceof ControlPlaneRuntimeRecoveryEvidenceError) throw error;
    fail("SOURCE_DRIFT", `${label} is not valid JSON.`);
  }
}

async function prerequisiteReceipts(overrides) {
  const receipts = [];
  for (const pin of CONTROL_PLANE_RUNTIME_RECOVERY_PREREQUISITE_PINS) {
    const bytes = await workspaceBytes(pin.path, overrides);
    const actual = sha256(bytes);
    if (bytes.byteLength !== pin.bytes || actual !== pin.sha256) {
      fail("PREREQUISITE_DRIFT", `The immutable ${pin.task} prerequisite drifted.`, {
        task: pin.task,
        expectedBytes: pin.bytes,
        actualBytes: bytes.byteLength,
        expectedSha256: pin.sha256,
        actualSha256: actual,
      });
    }
    const artifact = parseJsonBytes(bytes, pin.path);
    if (artifact.task !== pin.task || artifact.result !== "PASS") {
      fail("PREREQUISITE_DRIFT", `The immutable ${pin.task} artifact identity drifted.`);
    }
    receipts.push({ ...pin });
  }
  return deepFreeze(receipts);
}

async function fileReceipts(paths, overrides) {
  return deepFreeze(
    await Promise.all(
      [...paths].sort().map(async (relativePath) => {
        const bytes = await workspaceBytes(relativePath, overrides);
        return { path: relativePath, bytes: bytes.byteLength, sha256: sha256(bytes) };
      }),
    ),
  );
}

async function trackedFileReceipts(overrides) {
  let generationMask = 0b1111;
  const receipts = [];
  for (const relativePath of [...TRACKED_TASK_FILES].sort()) {
    const bytes = await workspaceBytes(relativePath, overrides);
    const overridden = Object.hasOwn(overrides, relativePath);
    const bridge = M07_T09_TRACKED_RECEIPT_BRIDGE[relativePath];
    const t10Bridge = M07_T10_TRACKED_RECEIPT_BRIDGE[relativePath];
    const t11Bridge = M07_T11_TRACKED_RECEIPT_BRIDGE[relativePath];
    const observed = Object.freeze({ bytes: bytes.byteLength, sha256: sha256(bytes) });
    if (
      (!overridden || relativePath !== ADR) &&
      (bridge !== undefined || t10Bridge !== undefined || t11Bridge !== undefined)
    ) {
      const taskTime = bridge?.historical ?? t10Bridge?.historical ?? t11Bridge.historical;
      const t09 = bridge?.successor ?? t10Bridge?.historical ?? t11Bridge.historical;
      const t10 = t10Bridge?.successor ?? t11Bridge?.historical;
      const t11 = t11Bridge?.successor;
      let observedGenerationMask = 0;
      if (observed.bytes === taskTime.bytes && observed.sha256 === taskTime.sha256) {
        observedGenerationMask |= 0b001;
      }
      if (observed.bytes === t09.bytes && observed.sha256 === t09.sha256) {
        observedGenerationMask |= 0b010;
      }
      if (t10 !== undefined && observed.bytes === t10.bytes && observed.sha256 === t10.sha256) {
        observedGenerationMask |= 0b100;
      }
      if (t11 !== undefined && observed.bytes === t11.bytes && observed.sha256 === t11.sha256) {
        observedGenerationMask |= 0b1000;
      }
      if (
        t11 === undefined &&
        t10 !== undefined &&
        observed.bytes === t10.bytes &&
        observed.sha256 === t10.sha256
      ) {
        observedGenerationMask |= 0b1000;
      }
      if (observedGenerationMask === 0) {
        fail("REGISTRATION_DRIFT", "A reviewed M07-T10 tracked successor receipt drifted.", {
          path: relativePath,
        });
      }
      generationMask &= observedGenerationMask;
    }
    const taskTimeProjection = bridge?.historical ?? t10Bridge?.historical ?? t11Bridge?.historical;
    const projected =
      !overridden && taskTimeProjection !== undefined
        ? taskTimeProjection
        : !overridden && M07_T09_READER_RECEIPT_PROJECTION[relativePath] !== undefined
          ? M07_T09_READER_RECEIPT_PROJECTION[relativePath]
          : observed;
    receipts.push(Object.freeze({ path: relativePath, ...projected }));
  }
  if (generationMask === 0) {
    fail("REGISTRATION_DRIFT", "The reviewed M07-T10 tracked successor set is incoherent.");
  }
  return deepFreeze(receipts);
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function parseTypescript(source, relativePath, code = "REGISTRATION_DRIFT") {
  const sourceFile = ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true);
  if (sourceFile.parseDiagnostics.length > 0) {
    fail(code, `${relativePath} is not valid TypeScript.`);
  }
  return sourceFile;
}

function assertExactSourceAuthority(bytes, relativePath, expectedSha256, code) {
  const actualSha256 = sha256(bytes);
  if (actualSha256 !== expectedSha256) {
    fail(code, `${relativePath} exact source authority drifted.`, {
      path: relativePath,
      expectedSha256,
      actualSha256,
    });
  }
}

function modifierPresent(node, kind) {
  return (
    ts.canHaveModifiers(node) && ts.getModifiers(node)?.some((modifier) => modifier.kind === kind)
  );
}

function exactTopLevelVariable(sourceFile, name, options = {}) {
  const matches = [];
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === name) {
        matches.push({ declaration, statement });
      }
    }
  }
  if (
    matches.length !== 1 ||
    (matches[0].statement.declarationList.flags & ts.NodeFlags.Const) === 0 ||
    (options.exported === true &&
      !modifierPresent(matches[0].statement, ts.SyntaxKind.ExportKeyword)) ||
    matches[0].declaration.initializer === undefined
  ) {
    fail(options.code ?? "REGISTRATION_DRIFT", `${name} is not one exact executable declaration.`);
  }
  return matches[0].declaration;
}

function exactTopLevelDeclaration(sourceFile, name, predicate, code = "IMPLEMENTATION_DRIFT") {
  const matches = sourceFile.statements.filter(
    (statement) => predicate(statement) && statement.name?.text === name,
  );
  if (matches.length !== 1) {
    fail(code, `${name} is not one exact top-level declaration.`);
  }
  return matches[0];
}

function expressionTarget(expression) {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) {
    const owner = expressionTarget(expression.expression);
    return owner === undefined ? undefined : `${owner}.${expression.name.text}`;
  }
  return undefined;
}

function callTarget(call) {
  return expressionTarget(call.expression);
}

function exactCallTarget(node, target) {
  return ts.isCallExpression(node) && callTarget(node) === target;
}

function frozenInitializerArgument(initializer, freezer, code = "REGISTRATION_DRIFT") {
  if (
    !ts.isCallExpression(initializer) ||
    callTarget(initializer) !== freezer ||
    initializer.arguments.length !== 1
  ) {
    fail(code, `Expected one exact ${freezer} executable call.`);
  }
  return initializer.arguments[0];
}

function literalText(node, code = "REGISTRATION_DRIFT") {
  if (!ts.isStringLiteral(node) && !ts.isNoSubstitutionTemplateLiteral(node)) {
    fail(code, "Expected an exact static string literal.");
  }
  return node.text;
}

function proofTupleFromElement(element) {
  if (!ts.isArrayLiteralExpression(element) || element.elements.length !== 3) {
    fail("REGISTRATION_DRIFT", "A proof registration must be one exact three-string tuple.");
  }
  return element.elements.map((entry) => literalText(entry));
}

function assertProofEntryMapper(mapCall) {
  if (
    !ts.isCallExpression(mapCall) ||
    !ts.isPropertyAccessExpression(mapCall.expression) ||
    mapCall.expression.name.text !== "map" ||
    !ts.isArrayLiteralExpression(mapCall.expression.expression) ||
    mapCall.arguments.length !== 1
  ) {
    fail("REGISTRATION_DRIFT", "PROOF_ENTRIES must map one executable tuple array.");
  }
  const mapper = mapCall.arguments[0];
  if (
    !ts.isArrowFunction(mapper) ||
    mapper.parameters.length !== 1 ||
    !ts.isArrayBindingPattern(mapper.parameters[0].name) ||
    mapper.parameters[0].name.elements.length !== 3 ||
    !mapper.parameters[0].name.elements.every(
      (element, index) =>
        ts.isBindingElement(element) &&
        ts.isIdentifier(element.name) &&
        element.name.text === ["id", "verifierFile", "rootTestFile"][index],
    ) ||
    !ts.isCallExpression(mapper.body) ||
    callTarget(mapper.body) !== "Object.freeze" ||
    mapper.body.arguments.length !== 1 ||
    !ts.isObjectLiteralExpression(mapper.body.arguments[0])
  ) {
    fail("REGISTRATION_DRIFT", "PROOF_ENTRIES must retain its exact executable tuple mapper.");
  }
  const properties = mapper.body.arguments[0].properties;
  if (
    properties.length !== 3 ||
    !properties.every(
      (property, index) =>
        ts.isShorthandPropertyAssignment(property) &&
        property.name.text === ["id", "verifierFile", "rootTestFile"][index],
    )
  ) {
    fail("REGISTRATION_DRIFT", "PROOF_ENTRIES must map every tuple field without projection.");
  }
  return mapCall.expression.expression;
}

function executableProofTuples(source, relativePath, declarationName, profile) {
  const sourceFile = parseTypescript(source, relativePath);
  const declaration = exactTopLevelVariable(sourceFile, declarationName);
  let array;
  if (profile === "mapped-object-freeze") {
    const mapped = frozenInitializerArgument(declaration.initializer, "Object.freeze");
    array = assertProofEntryMapper(mapped);
  } else if (profile === "safe-array-freeze") {
    array = frozenInitializerArgument(declaration.initializer, "SAFE_OBJECT_FREEZE");
    if (!ts.isArrayLiteralExpression(array)) {
      fail("REGISTRATION_DRIFT", `${declarationName} must freeze one executable tuple array.`);
    }
  } else {
    fail("REGISTRATION_DRIFT", "Unknown proof registration profile.");
  }
  const tuples = array.elements.map(proofTupleFromElement);
  if (tuples.filter((tuple) => JSON.stringify(tuple) === JSON.stringify(CI_TUPLE)).length !== 1) {
    fail("REGISTRATION_DRIFT", `The exact M07-T08 tuple is absent from ${declarationName}.`);
  }
  return deepFreeze(tuples);
}

function frozenStringArray(sourceFile, declarationName) {
  const declaration = exactTopLevelVariable(sourceFile, declarationName, { exported: true });
  const array = frozenInitializerArgument(declaration.initializer, "Object.freeze");
  if (!ts.isArrayLiteralExpression(array)) {
    fail("REGISTRATION_DRIFT", `${declarationName} must freeze one executable string array.`);
  }
  return array.elements.map((element) => literalText(element));
}

function propertyNameText(name) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return undefined;
}

function frozenObjectLiteral(sourceFile, declarationName) {
  const declaration = exactTopLevelVariable(sourceFile, declarationName);
  const object = frozenInitializerArgument(declaration.initializer, "Object.freeze");
  if (!ts.isObjectLiteralExpression(object)) {
    fail("REGISTRATION_DRIFT", `${declarationName} must freeze one executable object literal.`);
  }
  return object;
}

function exactObjectProperty(object, propertyName) {
  const matches = object.properties.filter(
    (property) =>
      ts.isPropertyAssignment(property) && propertyNameText(property.name) === propertyName,
  );
  if (matches.length !== 1) {
    fail("REGISTRATION_DRIFT", `${propertyName} is not one exact executable object property.`);
  }
  return matches[0].initializer;
}

function assertExactSharedStateRegistration(source) {
  const sourceFile = parseTypescript(source, SHARED_STATE_AUTHORITY);
  const arrays = [
    ["PROOF_IDS", "control-plane-runtime-recovery"],
    ["CHILD_PROCESS_VERIFIER_PROOF_IDS", "control-plane-runtime-recovery"],
    ["NATIVE_ADDON_PROOF_IDS", "control-plane-runtime-recovery"],
    ["NATIVE_ADDON_ROOT_STEP_IDS", "test-control-plane-runtime-recovery"],
  ];
  for (const [declarationName, member] of arrays) {
    const values = frozenStringArray(sourceFile, declarationName);
    if (values.filter((value) => value === member).length !== 1) {
      fail("REGISTRATION_DRIFT", `${declarationName} lost its exact M07-T08 member.`);
    }
  }

  const policies = frozenObjectLiteral(sourceFile, "NATIVE_ADDON_POLICIES");
  if (
    literalText(exactObjectProperty(policies, "CONTROL_PLANE_RUNTIME_RECOVERY_SQLITE")) !==
    "CONTROL_PLANE_RUNTIME_RECOVERY_SQLITE"
  ) {
    fail("REGISTRATION_DRIFT", "The M07-T08 native-addon policy constant drifted.");
  }

  const expectedPolicy = "NATIVE_ADDON_POLICIES.CONTROL_PLANE_RUNTIME_RECOVERY_SQLITE";
  for (const [declarationName, key] of [
    ["NATIVE_ADDON_POLICY_BY_PROOF_ID", "control-plane-runtime-recovery"],
    ["NATIVE_ADDON_POLICY_BY_ROOT_STEP_ID", "test-control-plane-runtime-recovery"],
  ]) {
    const value = exactObjectProperty(frozenObjectLiteral(sourceFile, declarationName), key);
    if (!ts.isPropertyAccessExpression(value) || expressionTarget(value) !== expectedPolicy) {
      fail("REGISTRATION_DRIFT", `${declarationName} lost its exact M07-T08 policy mapping.`);
    }
  }
}

function exactNamedImport(sourceFile, moduleName, importedName) {
  const matches = [];
  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== moduleName ||
      statement.importClause?.namedBindings === undefined ||
      !ts.isNamedImports(statement.importClause.namedBindings)
    ) {
      continue;
    }
    for (const element of statement.importClause.namedBindings.elements) {
      if (
        (element.propertyName?.text ?? element.name.text) === importedName &&
        element.name.text === importedName
      ) {
        matches.push(element);
      }
    }
  }
  if (matches.length !== 1) {
    fail("TEST_COVERAGE_DRIFT", `${importedName} is not one exact named test-runner import.`);
  }
}

function executableTestName(call, callee, relativePath) {
  if (!exactCallTarget(call, callee) || call.arguments.length < 2) {
    fail(
      "TEST_COVERAGE_DRIFT",
      `${relativePath} contains a non-executable ${callee} registration.`,
    );
  }
  const name = literalText(call.arguments[0], "TEST_COVERAGE_DRIFT");
  const callback = call.arguments[1];
  if (
    (!ts.isArrowFunction(callback) && !ts.isFunctionExpression(callback)) ||
    !ts.isBlock(callback.body) ||
    callback.body.statements.length === 0
  ) {
    fail("TEST_COVERAGE_DRIFT", `${relativePath} contains an empty or indirect ${callee} case.`);
  }
  return name;
}

function allDirectCalls(sourceFile, callee) {
  const calls = [];
  const visit = (node) => {
    if (ts.isCallExpression(node) && exactCallTarget(node, callee)) calls.push(node);
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return calls;
}

function recoveryTypeClaimInventory(source) {
  const sourceFile = parseTypescript(source, APP_RECOVERY_TYPE_TEST, "TEST_COVERAGE_DRIFT");
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    false,
    ts.LanguageVariant.Standard,
    source,
  );
  const directives = [];
  while (true) {
    const kind = scanner.scan();
    if (kind === ts.SyntaxKind.EndOfFileToken) break;
    const tokenText = scanner.getTokenText();
    if (!tokenText.includes("@ts-expect-error")) continue;
    if (kind !== ts.SyntaxKind.SingleLineCommentTrivia) {
      fail(
        "TEST_COVERAGE_DRIFT",
        "Compiler-negative claims must be executable single-line TypeScript directives.",
      );
    }
    const match = /^\/\/\s*@ts-expect-error\s+(.+?)\s*$/u.exec(tokenText);
    if (match === null) {
      fail("TEST_COVERAGE_DRIFT", "A compiler-negative directive has an invalid exact shape.");
    }
    directives.push({
      claim: match[1],
      start: scanner.getTokenPos(),
      end: scanner.getTextPos(),
    });
  }

  const statements = [];
  const visit = (node) => {
    if (ts.isStatement(node) && !ts.isBlock(node)) {
      statements.push({ node, start: node.getStart(sourceFile) });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  statements.sort((left, right) => left.start - right.start);

  const pairedStatements = new Set();
  for (const directive of directives) {
    const statement = statements.find(({ start }) => start >= directive.end);
    if (statement === undefined || pairedStatements.has(statement.node)) {
      fail(
        "TEST_COVERAGE_DRIFT",
        "Every compiler-negative directive must own one unique following statement.",
      );
    }
    const directiveLine = sourceFile.getLineAndCharacterOfPosition(directive.start).line;
    const statementLine = sourceFile.getLineAndCharacterOfPosition(statement.start).line;
    const gap = source.slice(directive.end, statement.start);
    if (statementLine !== directiveLine + 1 || !/^\r?\n[\t ]*$/u.test(gap)) {
      fail(
        "TEST_COVERAGE_DRIFT",
        "Every compiler-negative directive must immediately precede its executable statement.",
      );
    }
    pairedStatements.add(statement.node);
  }
  return directives.map(({ claim }) => claim);
}

function runtimeTestInventory(source) {
  const sourceFile = parseTypescript(source, APP_RECOVERY_TEST, "TEST_COVERAGE_DRIFT");
  exactNamedImport(sourceFile, "vitest", "describe");
  exactNamedImport(sourceFile, "vitest", "it");
  const suites = sourceFile.statements.filter(
    (statement) =>
      ts.isExpressionStatement(statement) && exactCallTarget(statement.expression, "describe"),
  );
  if (suites.length !== 1 || allDirectCalls(sourceFile, "describe").length !== 1) {
    fail("TEST_COVERAGE_DRIFT", "The focused runtime suite is not one top-level describe call.");
  }
  const suite = suites[0].expression;
  if (
    suite.arguments.length < 2 ||
    literalText(suite.arguments[0], "TEST_COVERAGE_DRIFT") !==
      EXPECTED_RUNTIME_RECOVERY_SUITE_NAME ||
    !ts.isArrowFunction(suite.arguments[1]) ||
    !ts.isBlock(suite.arguments[1].body)
  ) {
    fail("TEST_COVERAGE_DRIFT", "The exact focused runtime suite declaration drifted.");
  }
  const names = suite.arguments[1].body.statements.map((statement) => {
    if (!ts.isExpressionStatement(statement) || !ts.isCallExpression(statement.expression)) {
      fail("TEST_COVERAGE_DRIFT", "The focused runtime suite contains non-test executable state.");
    }
    return executableTestName(statement.expression, "it", APP_RECOVERY_TEST);
  });
  if (allDirectCalls(sourceFile, "it").length !== names.length) {
    fail("TEST_COVERAGE_DRIFT", "Focused runtime tests must be direct suite registrations.");
  }
  return names;
}

function rootTestInventory(source) {
  const sourceFile = parseTypescript(source, ROOT_TEST, "TEST_COVERAGE_DRIFT");
  exactNamedImport(sourceFile, "node:test", "test");
  const calls = sourceFile.statements
    .filter(
      (statement) =>
        ts.isExpressionStatement(statement) && exactCallTarget(statement.expression, "test"),
    )
    .map((statement) => statement.expression);
  if (allDirectCalls(sourceFile, "test").length !== calls.length) {
    fail("TEST_COVERAGE_DRIFT", "Root proof tests must be direct top-level registrations.");
  }
  return calls.map((call) => executableTestName(call, "test", ROOT_TEST));
}

function semanticSourceSha256(source, relativePath) {
  parseTypescript(source, relativePath, "IMPLEMENTATION_DRIFT");
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    true,
    ts.LanguageVariant.Standard,
    source,
  );
  const tokens = [];
  while (true) {
    const kind = scanner.scan();
    if (kind === ts.SyntaxKind.EndOfFileToken) break;
    tokens.push([kind, scanner.getTokenText()]);
  }
  return sha256(Buffer.from(JSON.stringify(tokens), "utf8"));
}

function descendantCalls(node) {
  const calls = [];
  const visit = (child) => {
    if (ts.isCallExpression(child)) calls.push(child);
    ts.forEachChild(child, visit);
  };
  visit(node);
  return calls;
}

function exactDescendantCallCount(node, target, expected) {
  const count = descendantCalls(node).filter((call) => callTarget(call) === target).length;
  if (count !== expected) {
    fail(
      "IMPLEMENTATION_DRIFT",
      `${target} has ${String(count)} calls instead of ${String(expected)}.`,
    );
  }
}

function exactDescendantVariable(node, name) {
  const matches = [];
  const visit = (child) => {
    if (
      ts.isVariableDeclaration(child) &&
      ts.isIdentifier(child.name) &&
      child.name.text === name
    ) {
      matches.push(child);
    }
    ts.forEachChild(child, visit);
  };
  visit(node);
  if (matches.length !== 1 || matches[0].initializer === undefined) {
    fail("IMPLEMENTATION_DRIFT", `${name} is not one exact executable variable.`);
  }
  return matches[0];
}

function publicExportInventory(source) {
  const sourceFile = parseTypescript(source, APP_INDEX);
  const inventory = [];
  for (const statement of sourceFile.statements) {
    if (!ts.isExportDeclaration(statement)) {
      const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined;
      if (
        ts.isExportAssignment(statement) ||
        modifiers?.some(
          ({ kind }) =>
            kind === ts.SyntaxKind.ExportKeyword || kind === ts.SyntaxKind.DefaultKeyword,
        )
      ) {
        fail("REGISTRATION_DRIFT", "The package root contains a non-list export declaration.");
      }
      continue;
    }
    if (
      statement.exportClause === undefined ||
      !ts.isNamedExports(statement.exportClause) ||
      statement.moduleSpecifier === undefined
    ) {
      fail("REGISTRATION_DRIFT", "The package root contains a non-explicit export declaration.");
    }
    for (const element of statement.exportClause.elements) {
      inventory.push({
        exported: element.name.text,
        imported: element.propertyName?.text ?? element.name.text,
        module: statement.moduleSpecifier.text,
        typeOnly: statement.isTypeOnly || element.isTypeOnly,
      });
    }
  }
  inventory.sort((left, right) => {
    const byName = compareText(left.exported, right.exported);
    return byName === 0 ? Number(left.typeOnly) - Number(right.typeOnly) : byName;
  });
  const inventorySha256 = sha256(Buffer.from(JSON.stringify(inventory), "utf8"));
  if (inventory.length !== 105 || inventorySha256 !== EXPECTED_PUBLIC_EXPORT_INVENTORY_SHA256) {
    fail("REGISTRATION_DRIFT", "The exact full package-root export inventory drifted.", {
      expectedCount: 105,
      actualCount: inventory.length,
      expectedSha256: EXPECTED_PUBLIC_EXPORT_INVENTORY_SHA256,
      actualSha256: inventorySha256,
    });
  }
  const forbidden = new Set([
    "captureBundleRuntimeRecovery",
    "createBundleRuntimeActivationInternal",
    "openRuntimeActivationSqliteRepository",
    "readBundleRuntimeActivationAuthority",
    "recloseBundleRuntimeRecovery",
    "RuntimeActivationStorageError",
  ]);
  if (inventory.some(({ exported }) => forbidden.has(exported))) {
    fail("REGISTRATION_DRIFT", "A private recovery or storage symbol escaped the package root.");
  }
  return deepFreeze({ entries: inventory, count: inventory.length, sha256: inventorySha256 });
}

function assertAdjacent(
  script,
  predecessor,
  current,
  reviewedSuccessor,
  laterSuccessor,
  channelSuccessor,
  terminal,
) {
  if (typeof script !== "string") {
    fail("REGISTRATION_DRIFT", "An aggregate root script is absent.");
  }
  const commands = script.split(" && ");
  const index = commands.indexOf(current);
  const reviewedSuccessorIndex = commands.indexOf(reviewedSuccessor);
  const laterSuccessorIndex = commands.indexOf(laterSuccessor);
  const channelSuccessorIndex = commands.indexOf(channelSuccessor);
  const terminalIndex = commands.indexOf(terminal);
  const historical =
    terminalIndex === index + 1 && reviewedSuccessorIndex < 0 && laterSuccessorIndex < 0;
  const approvedT09 =
    reviewedSuccessorIndex === index + 1 &&
    terminalIndex === reviewedSuccessorIndex + 1 &&
    laterSuccessorIndex < 0;
  const approvedT10 =
    reviewedSuccessorIndex === index + 1 &&
    laterSuccessorIndex === reviewedSuccessorIndex + 1 &&
    terminalIndex === laterSuccessorIndex + 1;
  const approvedT11 =
    reviewedSuccessorIndex === index + 1 &&
    laterSuccessorIndex === reviewedSuccessorIndex + 1 &&
    channelSuccessorIndex === laterSuccessorIndex + 1 &&
    terminalIndex === channelSuccessorIndex + 1;
  if (
    index < 1 ||
    commands[index - 1] !== predecessor ||
    (!historical && !approvedT09 && !approvedT10 && !approvedT11) ||
    commands.lastIndexOf(current) !== index ||
    commands.lastIndexOf(terminal) !== terminalIndex ||
    ((approvedT09 || approvedT10 || approvedT11) &&
      commands.lastIndexOf(reviewedSuccessor) !== reviewedSuccessorIndex) ||
    ((approvedT10 || approvedT11) &&
      commands.lastIndexOf(laterSuccessor) !== laterSuccessorIndex) ||
    (approvedT11 && commands.lastIndexOf(channelSuccessor) !== channelSuccessorIndex)
  ) {
    fail("REGISTRATION_DRIFT", "The T08 aggregate script position drifted.");
  }
}

async function registrationProjection(overrides) {
  const [appBytes, indexBytes, rootBytes, ciBytes, inventoryBytes, sharedStateBytes, adrBytes] =
    await Promise.all(
      [
        APP_PACKAGE,
        APP_INDEX,
        ROOT_PACKAGE,
        CI_SOURCE,
        CI_INVENTORY,
        SHARED_STATE_AUTHORITY,
        ADR,
      ].map((relativePath) => workspaceBytes(relativePath, overrides)),
    );
  const app = parseJsonBytes(appBytes, APP_PACKAGE);
  const rootPackage = parseJsonBytes(rootBytes, ROOT_PACKAGE);
  if (
    app.name !== "@desen/control-plane-api" ||
    app.scripts?.["test:runtime-recovery"] !== "vitest run test/runtime-recovery.test.ts" ||
    app.dependencies?.["better-sqlite3"] !== "13.0.3" ||
    app.exports?.["."]?.import !== "./dist/index.js" ||
    app.exports?.["."]?.types !== "./dist/index.d.ts"
  ) {
    fail("REGISTRATION_DRIFT", "The exact M07-T08 application registration drifted.");
  }

  const rootScripts = {
    generate: rootPackage.scripts?.["generate:control-plane-runtime-recovery"],
    verify: rootPackage.scripts?.["verify:control-plane-runtime-recovery"],
    test: rootPackage.scripts?.["test:control-plane-runtime-recovery"],
  };
  if (JSON.stringify(rootScripts) !== JSON.stringify(ROOT_SCRIPT_COMMANDS)) {
    fail("REGISTRATION_DRIFT", "The exact M07-T08 root commands drifted.");
  }
  assertAdjacent(
    rootPackage.scripts?.check,
    "pnpm verify:control-plane-runtime-activation",
    "pnpm verify:control-plane-runtime-recovery",
    "pnpm verify:control-plane-runtime-fault-injection",
    "pnpm verify:control-plane-runtime-transition-races",
    "pnpm verify:reference-host-web-channel-consumption",
    "pnpm lint",
  );
  assertAdjacent(
    rootPackage.scripts?.test,
    "pnpm test:control-plane-runtime-activation",
    "pnpm test:control-plane-runtime-recovery",
    "pnpm test:control-plane-runtime-fault-injection",
    "pnpm test:control-plane-runtime-transition-races",
    "pnpm test:reference-host-web-channel-consumption",
    "turbo run test",
  );

  const ciSource = fatalText(ciBytes, CI_SOURCE);
  const inventorySource = fatalText(inventoryBytes, CI_INVENTORY);
  const registrationStates = [
    [CI_SOURCE, ciBytes],
    [CI_INVENTORY, inventoryBytes],
    [SHARED_STATE_AUTHORITY, sharedStateBytes],
  ].map(([relativePath, bytes]) => {
    const observed = Object.freeze({ bytes: bytes.byteLength, sha256: sha256(bytes) });
    const t09 = M07_T09_REGISTRATION_AUTHORITY_RECEIPTS[relativePath];
    const t10 = M07_T10_REGISTRATION_AUTHORITY_RECEIPTS[relativePath];
    const t11 = M07_T11_REGISTRATION_AUTHORITY_RECEIPTS[relativePath];
    if (observed.sha256 === EXPECTED_REGISTRATION_AUTHORITY_SHA256[relativePath]) {
      return "historical";
    }
    if (observed.bytes === t09.bytes && observed.sha256 === t09.sha256) return "t09";
    if (observed.bytes === t10.bytes && observed.sha256 === t10.sha256) return "t10";
    if (observed.bytes === t11.bytes && observed.sha256 === t11.sha256) return "t11";
    fail("REGISTRATION_DRIFT", `${relativePath} reviewed source authority drifted.`);
  });
  if (new Set(registrationStates).size !== 1) {
    fail("REGISTRATION_DRIFT", "The reviewed M07-T10 CI registration set is incoherent.");
  }
  executableProofTuples(ciSource, CI_SOURCE, "PROOF_ENTRIES", "mapped-object-freeze");
  executableProofTuples(inventorySource, CI_INVENTORY, "PROOF_UNIT_TUPLES", "safe-array-freeze");

  const sharedState = fatalText(sharedStateBytes, SHARED_STATE_AUTHORITY);
  assertExactSharedStateRegistration(sharedState);

  const adr = fatalText(adrBytes, ADR);
  const adrReceipt = Object.freeze({ bytes: adrBytes.byteLength, sha256: sha256(adrBytes) });
  const adrBridge = M07_T09_TRACKED_RECEIPT_BRIDGE[ADR];
  const t10AdrBridge = M07_T10_TRACKED_RECEIPT_BRIDGE[ADR];
  const historicalAdr =
    adrReceipt.bytes === adrBridge.historical.bytes &&
    adrReceipt.sha256 === adrBridge.historical.sha256;
  const successorAdr =
    adrReceipt.bytes === adrBridge.successor.bytes &&
    adrReceipt.sha256 === adrBridge.successor.sha256;
  const t10Adr =
    adrReceipt.bytes === t10AdrBridge.successor.bytes &&
    adrReceipt.sha256 === t10AdrBridge.successor.sha256;
  if (!historicalAdr && !successorAdr && !t10Adr) {
    fail("DOCUMENTATION_DRIFT", "ADR 0014 differs from the reviewed T08/T09/T10 decisions.");
  }
  for (const marker of [
    "# ADR 0014: Reconstruct runtime authority from an unchanged durable record",
    "Recovery performs no durable write",
    "no tamper-proof, rollback-attack-resistant, or hostile",
    ...(successorAdr || t10Adr ? ["M07-T09 proves"] : []),
    ...(t10Adr ? ["M07-T10 proves"] : []),
  ]) {
    if (!adr.includes(marker)) {
      fail(
        "DOCUMENTATION_DRIFT",
        "ADR 0014 no longer records the exact T08 decision and nonclaim.",
      );
    }
  }

  return deepFreeze({
    appTestScript: app.scripts["test:runtime-recovery"],
    rootScripts,
    publicExports: publicExportInventory(fatalText(indexBytes, APP_INDEX)),
    ciTuple: [...CI_TUPLE],
    ciTupleCount: { runner: 1, exhaustiveInventory: 1 },
    sharedState: {
      executionClass: "PROOF_OS_TEMP_ISOLATED",
      verifierChildProcessPolicy: "VERIFIER_RUNTIME_PROBE",
      rootChildProcessPolicy: "NODE_TEST_HARNESS",
      nativeAddonPolicy: "CONTROL_PLANE_RUNTIME_RECOVERY_SQLITE",
      workspaceWrites: [],
    },
    adr: ADR,
    proofDocument: PROOF_DOCUMENT,
    proofDocumentRequiresExactArtifactPin: true,
  });
}

async function testProjection(overrides) {
  const [runtimeBytes, typeBytes, rootBytes] = await Promise.all(
    [APP_RECOVERY_TEST, APP_RECOVERY_TYPE_TEST, ROOT_TEST].map((relativePath) =>
      workspaceBytes(relativePath, overrides),
    ),
  );
  for (const [relativePath, bytes] of [
    [APP_RECOVERY_TEST, runtimeBytes],
    [APP_RECOVERY_TYPE_TEST, typeBytes],
    [ROOT_TEST, rootBytes],
  ]) {
    const reviewedSuccessor = M07_T09_TEST_AUTHORITY_RECEIPTS[relativePath];
    const reviewedT10Successor = M07_T10_TEST_AUTHORITY_RECEIPTS[relativePath];
    const reviewedT11Successor = M07_T11_TEST_AUTHORITY_RECEIPTS[relativePath];
    if (
      (reviewedSuccessor !== undefined &&
        bytes.byteLength === reviewedSuccessor.bytes &&
        sha256(bytes) === reviewedSuccessor.sha256) ||
      (reviewedT10Successor !== undefined &&
        bytes.byteLength === reviewedT10Successor.bytes &&
        sha256(bytes) === reviewedT10Successor.sha256) ||
      (reviewedT11Successor !== undefined &&
        bytes.byteLength === reviewedT11Successor.bytes &&
        sha256(bytes) === reviewedT11Successor.sha256)
    ) {
      continue;
    }
    assertExactSourceAuthority(
      bytes,
      relativePath,
      EXPECTED_TEST_AUTHORITY_SHA256[relativePath],
      "TEST_COVERAGE_DRIFT",
    );
  }
  const runtimeSource = fatalText(runtimeBytes, APP_RECOVERY_TEST);
  const typeSource = fatalText(typeBytes, APP_RECOVERY_TYPE_TEST);
  const rootSource = fatalText(rootBytes, ROOT_TEST);
  const recoveryNames = runtimeTestInventory(runtimeSource);
  const typeClaims = recoveryTypeClaimInventory(typeSource);
  if (JSON.stringify(recoveryNames) !== JSON.stringify(EXPECTED_RUNTIME_RECOVERY_TEST_NAMES)) {
    fail("TEST_COVERAGE_DRIFT", "The exact focused runtime-recovery inventory drifted.");
  }
  if (JSON.stringify(typeClaims) !== JSON.stringify(EXPECTED_RECOVERY_TYPE_CLAIMS)) {
    fail("TEST_COVERAGE_DRIFT", "The exact M07-T08 compiler-negative inventory drifted.");
  }
  const rootNames = rootTestInventory(rootSource);
  if (
    JSON.stringify(rootNames) !== JSON.stringify(CONTROL_PLANE_RUNTIME_RECOVERY_ROOT_TEST_NAMES)
  ) {
    fail("TEST_COVERAGE_DRIFT", "The exact M07-T08 root proof inventory drifted.");
  }
  return deepFreeze({
    packageRuntimeCases: recoveryNames.length,
    packageRuntimeCaseNames: recoveryNames,
    compileTimeNegativeCases: typeClaims.length,
    compileTimeNegativeClaims: typeClaims,
    rootMutationCases: rootNames.length,
    rootMutationCaseNames: rootNames,
  });
}

async function traceProjection(overrides) {
  const traceability = parseJsonBytes(await workspaceBytes(TRACEABILITY, overrides), TRACEABILITY);
  const found = [];
  const visit = (value) => {
    if (Array.isArray(value)) {
      for (const child of value) visit(child);
      return;
    }
    if (value === null || typeof value !== "object") return;
    if (
      TRACE_IDS.includes(value.id) &&
      Array.isArray(value.owners) &&
      value.owners.includes("M07-T08")
    ) {
      found.push(copyInertJson(value, `trace ${value.id}`));
    }
    for (const child of Object.values(value)) visit(child);
  };
  visit(traceability);
  found.sort((left, right) => TRACE_IDS.indexOf(left.id) - TRACE_IDS.indexOf(right.id));
  if (
    found.length !== TRACE_IDS.length ||
    found.some((row, index) => row.id !== TRACE_IDS[index])
  ) {
    fail("TRACEABILITY_DRIFT", "The exact M07-T08 trace-owner rows drifted.");
  }
  return deepFreeze(found);
}

async function implementationProjection(overrides, runtimeReceipt) {
  const paths = [APP_CONTRACT, APP_INTERNAL, APP_RECOVERY_INTERNAL, APP_FACTORY];
  const sources = Object.fromEntries(
    await Promise.all(
      paths.map(async (relativePath) => [
        relativePath,
        fatalText(await workspaceBytes(relativePath, overrides), relativePath),
      ]),
    ),
  );
  const semanticSources = paths.map((relativePath) => {
    const actual = semanticSourceSha256(sources[relativePath], relativePath);
    const expected = EXPECTED_IMPLEMENTATION_SEMANTIC_SHA256[relativePath];
    if (actual !== expected) {
      fail("IMPLEMENTATION_DRIFT", `${relativePath} semantic token authority drifted.`, {
        path: relativePath,
        expectedSha256: expected,
        actualSha256: actual,
      });
    }
    return { path: relativePath, sha256: actual };
  });

  const contractSource = parseTypescript(
    sources[APP_CONTRACT],
    APP_CONTRACT,
    "IMPLEMENTATION_DRIFT",
  );
  const recoveryResult = exactTopLevelDeclaration(
    contractSource,
    "BundleRuntimeRecoveryResult",
    ts.isTypeAliasDeclaration,
  );
  const activationContract = exactTopLevelDeclaration(
    contractSource,
    "BundleRuntimeActivation",
    ts.isInterfaceDeclaration,
  );
  if (
    !modifierPresent(recoveryResult, ts.SyntaxKind.ExportKeyword) ||
    !modifierPresent(activationContract, ts.SyntaxKind.ExportKeyword)
  ) {
    fail("IMPLEMENTATION_DRIFT", "The public recovery declarations must remain exported.");
  }
  const recoverMembers = activationContract.members.filter(
    (member) =>
      ts.isPropertySignature(member) &&
      member.name !== undefined &&
      propertyNameText(member.name) === "recover",
  );
  const recoverMember = recoverMembers[0];
  if (
    recoverMembers.length !== 1 ||
    recoverMember.type === undefined ||
    !ts.isFunctionTypeNode(recoverMember.type) ||
    recoverMember.type.parameters.length !== 3 ||
    recoverMember.type.parameters
      .map((parameter) => (ts.isIdentifier(parameter.name) ? parameter.name.text : undefined))
      .join("\0") !== "this\0activePackageAuthority\0previousGoodPackageAuthority"
  ) {
    fail("IMPLEMENTATION_DRIFT", "The exact public recover function type drifted.");
  }

  const internalSource = parseTypescript(
    sources[APP_INTERNAL],
    APP_INTERNAL,
    "IMPLEMENTATION_DRIFT",
  );
  const activationFactory = exactTopLevelDeclaration(
    internalSource,
    "createBundleRuntimeActivationInternal",
    ts.isFunctionDeclaration,
  );
  const recoverVariable = exactDescendantVariable(activationFactory, "recover");
  if (
    !ts.isArrowFunction(recoverVariable.initializer) ||
    recoverVariable.type?.getText(internalSource) !== 'BundleRuntimeActivation["recover"]'
  ) {
    fail("IMPLEMENTATION_DRIFT", "The internal recover operation lost its exact contract binding.");
  }
  const recoverOperation = recoverVariable.initializer;
  exactDescendantCallCount(recoverOperation, "captureBundleRuntimeRecovery", 1);
  exactDescendantCallCount(recoverOperation, "recloseBundleRuntimeRecovery", 1);
  exactDescendantCallCount(recoverOperation, "options.repository.get", 1);
  exactDescendantCallCount(recoverOperation, "options.repository.commit", 0);
  exactDescendantCallCount(recoverOperation, "sameRecord", 1);
  exactDescendantCallCount(recoverOperation, "createRecoveredAuthority", 1);
  const orderedRecoveryCalls = descendantCalls(recoverOperation).filter((call) =>
    ["recloseBundleRuntimeRecovery", "options.repository.get", "createRecoveredAuthority"].includes(
      callTarget(call),
    ),
  );
  if (
    orderedRecoveryCalls.map(callTarget).join("\0") !==
    "recloseBundleRuntimeRecovery\0options.repository.get\0createRecoveredAuthority"
  ) {
    fail("IMPLEMENTATION_DRIFT", "Final durable reauthentication no longer precedes publication.");
  }

  const recoverySource = parseTypescript(
    sources[APP_RECOVERY_INTERNAL],
    APP_RECOVERY_INTERNAL,
    "IMPLEMENTATION_DRIFT",
  );
  const captureRecovery = exactTopLevelDeclaration(
    recoverySource,
    "captureBundleRuntimeRecovery",
    ts.isFunctionDeclaration,
  );
  const consumePrepared = exactTopLevelDeclaration(
    recoverySource,
    "consumePreparedLineage",
    ts.isFunctionDeclaration,
  );
  const recloseLineage = exactTopLevelDeclaration(
    recoverySource,
    "recloseLineage",
    ts.isFunctionDeclaration,
  );
  const recloseRecovery = exactTopLevelDeclaration(
    recoverySource,
    "recloseBundleRuntimeRecovery",
    ts.isFunctionDeclaration,
  );
  exactDescendantCallCount(captureRecovery, "capturePackageRole", 2);
  exactDescendantCallCount(captureRecovery, "prepareLineage", 2);
  exactDescendantCallCount(captureRecovery, "consumePreparedLineage", 2);
  exactDescendantCallCount(consumePrepared, "consumeBundleRuntimeStagingAuthority", 1);
  exactDescendantCallCount(recloseLineage, "bundleStore.getBundle", 1);
  exactDescendantCallCount(recloseLineage, "verifyBundleStoreEntry", 1);
  exactDescendantCallCount(recloseRecovery, "recloseLineage", 2);
  exactDescendantCallCount(recloseRecovery, "assertContinue", 1);
  exactDescendantCallCount(recloseRecovery, "bundleStore.putBundle", 0);

  const factorySource = parseTypescript(sources[APP_FACTORY], APP_FACTORY, "IMPLEMENTATION_DRIFT");
  const ownedFactory = exactTopLevelDeclaration(
    factorySource,
    "createOwnedBundleRuntimeActivationInternal",
    ts.isFunctionDeclaration,
  );
  const publicFactory = exactTopLevelDeclaration(
    factorySource,
    "openBundleRuntimeActivation",
    ts.isFunctionDeclaration,
  );
  exactDescendantCallCount(ownedFactory, "createBundleRuntimeActivationInternal", 1);
  exactDescendantCallCount(publicFactory, "openBundleStore", 1);
  exactDescendantCallCount(publicFactory, "sqlite.openRuntimeActivationSqliteRepository", 1);
  exactDescendantCallCount(publicFactory, "createOwnedBundleRuntimeActivationInternal", 1);

  return deepFreeze({
    semanticSources,
    structuralAuthority: {
      publicRecoveryResult: "BundleRuntimeRecoveryResult",
      publicRecoveryMethod: "BundleRuntimeActivation.recover",
      controllerRecoveryBinding: 'BundleRuntimeActivation["recover"]',
      finalRecoveryCalls: orderedRecoveryCalls.map(callTarget),
      synchronousLineagePreparation: true,
      sameStoreDualReclosure: true,
      repositoryCommitCallsDuringRecovery: 0,
    },
    durableRecordFields: ["activeRevision", "previousGoodRevision", "generation"],
    callerCannotSelectDurableRecord: true,
    bothRevisionLineagesRequiredBeforePublication: true,
    durableRecordReauthenticatedAfterAsyncReconstruction: true,
    recoveryNeverWritesDurableState:
      runtimeReceipt.durableStorage.recordUnchanged === true &&
      runtimeReceipt.durableStorage.databaseBytesUnchanged === true &&
      runtimeReceipt.recovered.durableRecordUnchanged === true,
  });
}

async function distributionProjection() {
  const receipts = await fileReceipts(DISTRIBUTION_FILES, Object.freeze({}));
  const declaration = fatalText(
    await safeReadAbsolute(
      path.join(ROOT, `${APP_DIRECTORY}/dist/runtime-activation-contract.d.ts`),
    ),
    "runtime activation declaration",
  );
  const implementation = fatalText(
    await safeReadAbsolute(path.join(ROOT, `${APP_DIRECTORY}/dist/runtime-activation-internal.js`)),
    "runtime activation distribution",
  );
  if (!declaration.includes("readonly recover:") || !implementation.includes("recover")) {
    fail("DISTRIBUTION_DRIFT", "The built package does not contain the recovery boundary.");
  }
  return deepFreeze({ files: receipts, publicDeclarationContainsRecovery: true });
}

async function listCatalogArtifacts() {
  const root = await realpath(path.join(ROOT, CATALOG_DISTRIBUTION));
  const paths = [];
  const visit = async (relative) => {
    const directory = path.join(root, relative);
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const child = path.posix.join(relative, entry.name);
      if (entry.isSymbolicLink()) fail("UNSAFE_AUTHORITY", "Catalog distribution is symlinked.");
      if (entry.isDirectory()) await visit(child);
      else if (entry.isFile()) paths.push(child);
      else fail("UNSAFE_AUTHORITY", "Catalog distribution contains a special entry.");
    }
  };
  await visit("");
  paths.sort();
  return Object.freeze(
    await Promise.all(
      paths.map(async (relative) =>
        Object.freeze({
          path: `dist/${relative}`,
          bytes: await safeReadAbsolute(path.join(root, relative)),
        }),
      ),
    ),
  );
}

function requireAuthority(result, status, label) {
  if (result?.status !== status || result.authority === undefined) {
    fail("RUNTIME_PROBE_MISMATCH", `${label} did not produce exact authority.`);
  }
  return result.authority;
}

function publicRecord(record) {
  return {
    activeRevision: record.activeRevision,
    previousGoodRevision: record.previousGoodRevision,
    generation: record.generation,
  };
}

function rejectionReceipt(result) {
  return {
    status: result.status,
    role: result.role,
    stage: result.stage,
    codes: Array.isArray(result.diagnostics) ? result.diagnostics.map(({ code }) => code) : [],
    frozen: Object.isFrozen(result),
    authorityAbsent: !Object.hasOwn(result, "authority"),
  };
}

/** Runs the exact restart-recovery probe against an already imported built package. */
export async function runControlPlaneRuntimeRecoveryProbeInCurrentProcess(controlPlane) {
  const temporaryDirectories = [];
  const services = new Set();
  const makeRoot = async () => {
    const directory = await realpath(
      await mkdtemp(path.join(os.tmpdir(), "desen-m07-t08-runtime-recovery-")),
    );
    temporaryDirectories.push(directory);
    return directory;
  };
  try {
    const [activationInternal, activationSqlite, protocol, bundleBytes, catalogBytes, artifacts] =
      await Promise.all([
        import(
          pathToFileURL(path.join(ROOT, APP_DIRECTORY, "dist/runtime-activation-internal.js")).href
        ),
        import(
          pathToFileURL(
            path.join(ROOT, APP_DIRECTORY, "dist/runtime-activation-sqlite-internal.js"),
          ).href
        ),
        import(pathToFileURL(path.join(ROOT, "packages/protocol/dist/index.js")).href),
        safeReadAbsolute(path.join(ROOT, BUNDLE_FIXTURE)),
        safeReadAbsolute(path.join(ROOT, CATALOG_FIXTURE)),
        listCatalogArtifacts(),
      ]);
    const bundleA = parseJsonBytes(bundleBytes, BUNDLE_FIXTURE);
    const bundleB = structuredClone(bundleA);
    bundleB.surfaces["sign-in"].root.slots.default[0].props.text = "Welcome back";
    bundleB.revision = protocol.calculateDesenBundleRevision(bundleB);
    if (bundleA.revision !== REVISION_A || bundleB.revision !== REVISION_B) {
      fail("RUNTIME_PROBE_MISMATCH", "The fixed recovery Bundle revisions drifted.");
    }
    const catalog = parseJsonBytes(catalogBytes, CATALOG_FIXTURE);
    const candidate = Object.freeze({
      id: catalog.id,
      version: catalog.version,
      target: catalog.target,
      catalog,
      artifacts,
    });
    const canonicalA = protocol.canonicalizeJsonBytes(bundleA);
    const canonicalB = protocol.canonicalizeJsonBytes(bundleB);
    const packageAuthority = (bundle, bytes, label) => {
      const integrity = controlPlane.verifyBundleStoreEntry(
        { revision: bundle.revision, bytes },
        Object.freeze({ status: "not-available" }),
      );
      const integrityAuthority = requireAuthority(integrity, "verified", `${label} integrity`);
      return requireAuthority(
        controlPlane.preflightBundlePackages(integrityAuthority, [candidate]),
        "preflighted",
        `${label} packages`,
      );
    };
    const activationLineage = (bundle, bytes, label) => {
      const packages = packageAuthority(bundle, bytes, label);
      const references = requireAuthority(
        controlPlane.preflightBundleReferences(packages),
        "preflighted",
        `${label} references`,
      );
      const staging = requireAuthority(
        controlPlane.stageBundleRuntime(packages),
        "staged",
        `${label} staging`,
      );
      return { packages, references, staging };
    };

    const rootDirectory = await makeRoot();
    const store = await controlPlane.openBundleStore({ rootDirectory });
    await store.putBundle({ revision: REVISION_A, bytes: canonicalA });
    await store.putBundle({ revision: REVISION_B, bytes: canonicalB });
    const writer = await controlPlane.openBundleRuntimeActivation({ rootDirectory });
    services.add(writer);
    const lineageA = activationLineage(bundleA, canonicalA, "A");
    const activatedA = await writer.activate(lineageA.references, lineageA.staging, null);
    requireAuthority(activatedA, "activated", "A activation");
    const lineageB = activationLineage(bundleB, canonicalB, "B");
    const activatedB = await writer.activate(lineageB.references, lineageB.staging, 0);
    const committedAuthority = requireAuthority(activatedB, "activated", "B activation");
    const committedRecord = publicRecord(committedAuthority);
    writer.close();
    services.delete(writer);

    const databasePath = path.join(rootDirectory, "runtime-activation.sqlite3");
    const readDurableRow = () => {
      const repository = activationSqlite.openRuntimeActivationSqliteRepository(databasePath);
      try {
        const result = repository.get();
        if (result.status !== "found") {
          fail("RUNTIME_PROBE_MISMATCH", "The durable recovery row unexpectedly disappeared.");
        }
        return publicRecord(result.record);
      } finally {
        repository.close();
      }
    };
    const durableRowBeforeRecovery = readDurableRow();
    const databaseBytesBeforeRecovery = await safeReadAbsolute(databasePath);

    const recoveredService = await controlPlane.openBundleRuntimeActivation({ rootDirectory });
    services.add(recoveredService);
    const beforeRecovery = recoveredService.readState();
    const packageA = packageAuthority(bundleA, canonicalA, "restart A");
    const packageB = packageAuthority(bundleB, canonicalB, "restart B");
    const mismatchedActive = await recoveredService.recover(packageA, packageA);
    const afterMismatchedActive = recoveredService.readState();
    const missingPreviousGood = await recoveredService.recover(packageB, null);
    const afterMissingPreviousGood = recoveredService.readState();
    const recovered = await recoveredService.recover(packageB, packageA);
    const recoveredAuthority = requireAuthority(recovered, "recovered", "Restart recovery");
    const afterRecovery = recoveredService.readState();
    const privateAuthority =
      activationInternal.readBundleRuntimeActivationAuthority(recoveredAuthority);
    if (privateAuthority === undefined) {
      fail("RUNTIME_PROBE_MISMATCH", "Recovered private authority is absent.");
    }
    const durableRecordUnchanged =
      JSON.stringify(committedRecord) === JSON.stringify(publicRecord(recoveredAuthority));
    const authorityWasCurrent =
      afterRecovery.status === "active" && afterRecovery.authority === recoveredAuthority;
    recoveredService.close();
    services.delete(recoveredService);
    const authorityRevokedAfterClose =
      activationInternal.readBundleRuntimeActivationAuthority(recoveredAuthority) === undefined;
    const databaseBytesAfterRecovery = await safeReadAbsolute(databasePath);
    const durableRowAfterRecovery = readDurableRow();
    const recordUnchanged =
      JSON.stringify(durableRowBeforeRecovery) === JSON.stringify(committedRecord) &&
      JSON.stringify(durableRowAfterRecovery) === JSON.stringify(committedRecord) &&
      JSON.stringify(publicRecord(recoveredAuthority)) === JSON.stringify(committedRecord);
    const databaseBytesUnchanged = byteEqual(
      databaseBytesBeforeRecovery,
      databaseBytesAfterRecovery,
    );

    return deepFreeze({
      publicModuleKeys: Object.keys(controlPlane).sort(compareText),
      publicSurface: {
        serviceKeys: ["activate", "close", "readState", "recover"],
        actualServiceKeys: Object.keys(recoveredService).sort(),
        serviceFrozen: Object.isFrozen(recoveredService),
        recoveryFunctionPresent: typeof recoveredService.recover === "function",
      },
      durableBeforeRestart: committedRecord,
      durableStorage: {
        databaseFile: "runtime-activation.sqlite3",
        before: {
          row: durableRowBeforeRecovery,
          bytes: databaseBytesBeforeRecovery.byteLength,
          sha256: sha256(databaseBytesBeforeRecovery),
        },
        after: {
          row: durableRowAfterRecovery,
          bytes: databaseBytesAfterRecovery.byteLength,
          sha256: sha256(databaseBytesAfterRecovery),
        },
        recordUnchanged,
        databaseBytesUnchanged,
      },
      beforeRecovery: {
        status: beforeRecovery.status,
        record: publicRecord(beforeRecovery.record),
        authorityAbsent: !Object.hasOwn(beforeRecovery, "authority"),
      },
      mismatchedActive: rejectionReceipt(mismatchedActive),
      mismatchedActiveLeftRecordPending:
        afterMismatchedActive.status === "recovery-required" &&
        JSON.stringify(publicRecord(afterMismatchedActive.record)) ===
          JSON.stringify(committedRecord),
      missingPreviousGood: rejectionReceipt(missingPreviousGood),
      missingPreviousGoodLeftRecordPending:
        afterMissingPreviousGood.status === "recovery-required" &&
        JSON.stringify(publicRecord(afterMissingPreviousGood.record)) ===
          JSON.stringify(committedRecord),
      recovered: {
        status: recovered.status,
        record: publicRecord(recoveredAuthority),
        authorityFrozen: Object.isFrozen(recoveredAuthority),
        authorityKeys: Object.keys(recoveredAuthority).sort(),
        authorityWasCurrent,
        privateAuthorityAuthenticated: true,
        privatePreviousGoodRevision:
          privateAuthority.previousGoodRecord?.stagingRecord.packageRecord.integrityRecord
            .revision ?? null,
        durableRecordUnchanged: durableRecordUnchanged && recordUnchanged,
        authorityRevokedAfterClose,
      },
    });
  } catch (error) {
    if (error instanceof ControlPlaneRuntimeRecoveryEvidenceError) throw error;
    fail("RUNTIME_PROBE_MISMATCH", "The built M07-T08 runtime-recovery probe failed.");
  } finally {
    for (const service of services) {
      try {
        service.close();
      } catch {
        // Preserve the first proof failure while best-effort revoking native state.
      }
    }
    await Promise.all(
      temporaryDirectories.map((directory) => rm(directory, { force: true, recursive: true })),
    );
  }
}

/** Runs the recovery probe in a bounded child and records the lazy native-adapter boundary. */
export async function runControlPlaneRuntimeRecoveryProbe() {
  const proofLibraryUrl = pathToFileURL(path.join(ROOT, PROOF_LIBRARY)).href;
  const program = [
    'const Module = (await import("node:module")).default;',
    "const originalLoad = Module._load;",
    "let nativeLoads = 0;",
    'Module._load = function(request, parent, isMain) { if (typeof request === "string" && request.includes("better-sqlite3")) nativeLoads += 1; return Reflect.apply(originalLoad, this, [request, parent, isMain]); };',
    `const [controlPlane, proof] = await Promise.all([import("@desen/control-plane-api"), import(${JSON.stringify(proofLibraryUrl)})]);`,
    "const beforeOpen = nativeLoads;",
    "const receipt = await proof.runControlPlaneRuntimeRecoveryProbeInCurrentProcess(controlPlane);",
    "const nativeImport = { beforeOpen, loadedDuringRecoveryProbe: nativeLoads > beforeOpen };",
    "Module._load = originalLoad;",
    "process.stdout.write(JSON.stringify({ ...receipt, nativeImport }));",
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
        maxBuffer: 2 * 1_024 * 1_024,
        timeout: 60_000,
      },
    );
    return deepFreeze(
      copyInertJson(
        parseJsonBytes(Buffer.from(stdout, "utf8"), "runtime recovery child probe"),
        "runtimeReceipt",
      ),
    );
  } catch (error) {
    if (error instanceof ControlPlaneRuntimeRecoveryEvidenceError) throw error;
    fail("RUNTIME_PROBE_MISMATCH", "The bounded M07-T08 runtime-recovery child probe failed.");
  }
}

function expectedRuntimeReceipt() {
  const record = { activeRevision: REVISION_B, previousGoodRevision: REVISION_A, generation: 1 };
  return {
    publicModuleKeys: [...EXPECTED_RUNTIME_PUBLIC_MODULE_KEYS],
    publicSurface: {
      serviceKeys: ["activate", "close", "readState", "recover"],
      actualServiceKeys: ["activate", "close", "readState", "recover"],
      serviceFrozen: true,
      recoveryFunctionPresent: true,
    },
    durableBeforeRestart: record,
    durableStorage: {
      databaseFile: "runtime-activation.sqlite3",
      before: {
        row: record,
        bytes: 8_192,
        sha256: "d82f0b5dcad4ff2b8398724b79fe91f01243cc04d6747ca98a137b35e9564f61",
      },
      after: {
        row: record,
        bytes: 8_192,
        sha256: "d82f0b5dcad4ff2b8398724b79fe91f01243cc04d6747ca98a137b35e9564f61",
      },
      recordUnchanged: true,
      databaseBytesUnchanged: true,
    },
    beforeRecovery: { status: "recovery-required", record, authorityAbsent: true },
    mismatchedActive: {
      status: "rejected",
      role: "active",
      stage: "package-authority",
      codes: ["run.desen.control-plane/INVALID_RUNTIME_RECOVERY_PACKAGE_AUTHORITY"],
      frozen: true,
      authorityAbsent: true,
    },
    mismatchedActiveLeftRecordPending: true,
    missingPreviousGood: {
      status: "rejected",
      role: "previous-good",
      stage: "package-authority",
      codes: ["run.desen.control-plane/INVALID_RUNTIME_RECOVERY_PACKAGE_AUTHORITY"],
      frozen: true,
      authorityAbsent: true,
    },
    missingPreviousGoodLeftRecordPending: true,
    recovered: {
      status: "recovered",
      record,
      authorityFrozen: true,
      authorityKeys: [
        "activeRevision",
        "documentId",
        "entrySurfaceId",
        "generation",
        "previousGoodRevision",
        "profile",
        "profileVersion",
        "protocolVersion",
      ],
      authorityWasCurrent: true,
      privateAuthorityAuthenticated: true,
      privatePreviousGoodRevision: REVISION_A,
      durableRecordUnchanged: true,
      authorityRevokedAfterClose: true,
    },
    nativeImport: { beforeOpen: 0, loadedDuringRecoveryProbe: true },
  };
}

export const CONTROL_PLANE_RUNTIME_RECOVERY_EXPECTED_RECEIPT = deepFreeze(expectedRuntimeReceipt());

function assertRuntimeReceipt(value) {
  const receipt = copyInertJson(value, "runtimeReceipt");
  if (JSON.stringify(receipt) !== JSON.stringify(CONTROL_PLANE_RUNTIME_RECOVERY_EXPECTED_RECEIPT)) {
    fail("RUNTIME_PROBE_MISMATCH", "The exact M07-T08 runtime-recovery receipt drifted.");
  }
  return deepFreeze(receipt);
}

export async function buildControlPlaneRuntimeRecoveryEvidence(options) {
  const captured = exactOwnDataOptions(
    options,
    new Set(["prerequisiteBytes", "runtimeReceipt", "trackedFileBytes"]),
    "build options",
  );
  const prerequisiteBytes = captureByteOverrides(
    captured.prerequisiteBytes,
    CONTROL_PLANE_RUNTIME_RECOVERY_PREREQUISITE_PINS.map(({ path: pinPath }) => pinPath),
    "prerequisiteBytes",
  );
  const trackedFileBytes = captureByteOverrides(
    captured.trackedFileBytes,
    TRACKED_TASK_FILES,
    "trackedFileBytes",
  );
  const runtimeReceipt = assertRuntimeReceipt(
    captured.runtimeReceipt === undefined
      ? await runControlPlaneRuntimeRecoveryProbe()
      : captured.runtimeReceipt,
  );
  const [
    prerequisites,
    trackedFiles,
    distribution,
    implementation,
    registrations,
    tests,
    traceRows,
  ] = await Promise.all([
    prerequisiteReceipts(prerequisiteBytes),
    trackedFileReceipts(trackedFileBytes),
    distributionProjection(),
    implementationProjection(trackedFileBytes, runtimeReceipt),
    registrationProjection(trackedFileBytes),
    testProjection(trackedFileBytes),
    traceProjection(trackedFileBytes),
  ]);
  const artifact = deepFreeze({
    schemaVersion: 1,
    proofId: "control-plane-runtime-recovery",
    profile: "desen.control-plane.runtime-recovery-proof.v1",
    task: "M07-T08",
    result: "PASS",
    summary:
      "The built Web control plane reconstructs an unchanged durable active/previous-good record only after both referenced Bundle and package lineages pass complete recovery preflight and the durable record is reauthenticated immediately before in-process authority publication.",
    prerequisites,
    claims: {
      durableRecord: runtimeReceipt.durableBeforeRestart,
      durableStorage: runtimeReceipt.durableStorage,
      rawRestartState: runtimeReceipt.beforeRecovery,
      authorityReconstruction: runtimeReceipt.recovered,
      packageAuthorityRejections: {
        mismatchedActive: runtimeReceipt.mismatchedActive,
        mismatchedActiveLeftRecordPending: runtimeReceipt.mismatchedActiveLeftRecordPending,
        missingPreviousGood: runtimeReceipt.missingPreviousGood,
        missingPreviousGoodLeftRecordPending: runtimeReceipt.missingPreviousGoodLeftRecordPending,
      },
      publicBoundary: runtimeReceipt.publicSurface,
      lazyNativeImport: runtimeReceipt.nativeImport,
      implementation,
      registrations,
      traceRows,
      coverageTruth: {
        proofMatrixP12: "NOT_PROVEN",
        normativeN004: "PLANNED",
        normativeN038: "PLANNED",
        normativeN041: "PLANNED",
        gateG07: "NOT_STARTED",
      },
    },
    trackedFiles,
    distribution,
    tests,
    nonclaims: [
      "M07-T09 still owns exhaustive fault injection across fetch, integrity, package, reference, staging, durable commit, and recovery boundaries.",
      "M07-T10 still owns the complete A to invalid B to valid C, concurrent activation, journal-mode decision, and restart race matrices.",
      "M07-T11 still owns mutable-channel consumption and separately built reference-host notification.",
      "P-12 remains NOT_PROVEN until the remaining M07 tasks and M10-T07 complete product-level invalid-publication recovery.",
      "N-004, N-038, and N-041 remain PLANNED; this task proves exact restart reconstruction rather than exhaustive boundary faults or final cross-system limits.",
      "Recovery never rewrites the durable record, promotes previous-good automatically, or accepts a raw record, caller-selected revision, abandoned staged handle, loader, adapter, callback, channel, or SQLite handle as authority.",
      "The application-owned local root remains trusted; without an external cryptographic anchor or sentinel, recovery cannot distinguish a valid-looking historical or replaced database from legitimate historical state, so M07-T08 makes no tamper-proof or anti-rollback claim.",
      "SQLite is the Web adapter only; Android and iOS may use native repositories preserving the same observable record and recovery invariants.",
    ],
    reproduction: [
      "pnpm --filter @desen/control-plane-api... build",
      "pnpm --filter @desen/control-plane-api typecheck",
      "pnpm --filter @desen/control-plane-api test:runtime-activation",
      "node scripts/generate-control-plane-runtime-recovery-proof.mjs",
      "node scripts/verify-control-plane-runtime-recovery.mjs",
      "node --test tests/control-plane-runtime-recovery.test.mjs",
    ],
  });
  const artifactText = await format(JSON.stringify(artifact), { parser: "json", printWidth: 100 });
  const artifactBytes = Buffer.from(artifactText, "utf8");
  return Object.freeze({
    artifact,
    artifactBytes,
    artifactSha256: sha256(artifactBytes),
    runtimeReceipt,
  });
}

function captureOptionalPath(value, label) {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length === 0 || value.includes("\0")) {
    fail("INVALID_OPTIONS", `${label} must be a nonempty primitive path string.`);
  }
  return path.resolve(value);
}

function captureProofDocument(value) {
  if (
    typeof value !== "string" ||
    value.includes("\0") ||
    Buffer.byteLength(value, "utf8") > MAX_AUTHORITY_BYTES
  ) {
    fail("INVALID_OPTIONS", "proofDocument must be a bounded primitive string.");
  }
  return value;
}

function proofDocumentHasExactPin(document, artifactSha256) {
  const artifactLine = `Artifact: \`${ARTIFACT}\``;
  const receiptLine = `Final receipt: \`sha256:${artifactSha256}\``;
  return (
    document.split(artifactLine).length - 1 === 1 &&
    document.split(receiptLine).length - 1 === 1 &&
    document.match(new RegExp(ARTIFACT.replaceAll(".", "\\."), "gu"))?.length === 1 &&
    document.match(/Final receipt: `sha256:[0-9a-f]{64}`/gu)?.length === 1 &&
    !document.includes("sha256:PENDING")
  );
}

export async function verifyControlPlaneRuntimeRecoveryEvidence(options) {
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
  const built = await buildControlPlaneRuntimeRecoveryEvidence({
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
      ? await safeReadAbsolute(artifactPath ?? DEFAULT_CONTROL_PLANE_RUNTIME_RECOVERY_ARTIFACT_PATH)
      : captureBytes(captured.artifactBytes, "artifactBytes");
  if (!byteEqual(artifactBytes, built.artifactBytes)) {
    fail("ARTIFACT_DRIFT", "The committed M07-T08 recovery artifact is not reproducible.");
  }
  const proofDocument =
    captured.proofDocument === undefined
      ? fatalText(
          await safeReadAbsolute(proofDocumentPath ?? path.join(ROOT, PROOF_DOCUMENT)),
          PROOF_DOCUMENT,
        )
      : captureProofDocument(captured.proofDocument);
  if (!proofDocumentHasExactPin(proofDocument, built.artifactSha256)) {
    fail("PROOF_PIN_DRIFT", "The proof document lacks one exact final M07-T08 artifact pin.");
  }
  return Object.freeze({
    task: "M07-T08",
    result: "PASS",
    artifactSha256: built.artifactSha256,
    packageRuntimeCases: built.artifact.tests.packageRuntimeCases,
    compileTimeNegativeCases: built.artifact.tests.compileTimeNegativeCases,
    rootMutationCases: built.artifact.tests.rootMutationCases,
    prerequisiteArtifacts: built.artifact.prerequisites.length,
    traceRows: built.artifact.claims.traceRows.length,
  });
}

export async function writeControlPlaneRuntimeRecoveryEvidence(options) {
  const captured = exactOwnDataOptions(
    options,
    new Set(["artifactPath", "beforeAtomicRename"]),
    "write options",
  );
  const artifactPath =
    captureOptionalPath(captured.artifactPath, "artifactPath") ??
    DEFAULT_CONTROL_PLANE_RUNTIME_RECOVERY_ARTIFACT_PATH;
  if (
    captured.beforeAtomicRename !== undefined &&
    typeof captured.beforeAtomicRename !== "function"
  ) {
    fail("INVALID_OPTIONS", "beforeAtomicRename must be a function when supplied.");
  }
  const built = await buildControlPlaneRuntimeRecoveryEvidence();
  try {
    await writeAtomicProofArtifact({
      artifactPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename: captured.beforeAtomicRename,
    });
  } catch {
    fail("ARTIFACT_WRITE_FAILED", "The M07-T08 artifact could not be committed atomically.");
  }
  return Object.freeze({ artifactPath, artifactSha256: built.artifactSha256 });
}
