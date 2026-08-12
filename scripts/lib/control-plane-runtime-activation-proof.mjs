import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import { lstat, mkdtemp, open, readdir, realpath, rm, stat, symlink } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify, types as utilTypes } from "node:util";

import { format } from "prettier";
import ts from "typescript";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ARTIFACT = "docs/proof/artifacts/control-plane-api-0.1.0-runtime-activation.json";
const PROOF_DOCUMENT = "docs/proof/CONTROL-PLANE-RUNTIME-ACTIVATION.md";
const TRACEABILITY = "docs/proof/protocol-0.1.0-traceability.json";
const NORMATIVE_COVERAGE = "docs/proof/NORMATIVE-COVERAGE.md";
const PROOF_MATRIX = "docs/proof/PROOF-MATRIX.md";
const FINDINGS = "docs/plan/PROTOCOL-FINDINGS.md";
const ADR = "docs/adr/0013-durable-runtime-activation-record.md";
const APP_DIRECTORY = "apps/control-plane-api";
const APP_PACKAGE = `${APP_DIRECTORY}/package.json`;
const APP_INDEX = `${APP_DIRECTORY}/src/index.ts`;
const APP_CONTRACT = `${APP_DIRECTORY}/src/runtime-activation-contract.ts`;
const APP_INTERNAL = `${APP_DIRECTORY}/src/runtime-activation-internal.ts`;
const APP_REPOSITORY = `${APP_DIRECTORY}/src/runtime-activation-repository-internal.ts`;
const APP_SQLITE = `${APP_DIRECTORY}/src/runtime-activation-sqlite-internal.ts`;
const APP_FACTORY = `${APP_DIRECTORY}/src/runtime-activation.ts`;
const APP_STAGING_INTERNAL = `${APP_DIRECTORY}/src/runtime-staging-internal.ts`;
const APP_RUNTIME_TEST = `${APP_DIRECTORY}/test/runtime-activation.test.ts`;
const APP_TYPE_TEST = `${APP_DIRECTORY}/test/runtime-activation.types.ts`;
const ROOT_PACKAGE = "package.json";
const CI_SOURCE = "scripts/run-ci-quality-gate.mjs";
const CI_INVENTORY = "scripts/ci/exhaustive-workload-inventory.mjs";
const SHARED_STATE_AUTHORITY = "scripts/ci/shared-state-authority.mjs";
const GENERATOR = "scripts/generate-control-plane-runtime-activation-proof.mjs";
const VERIFIER = "scripts/verify-control-plane-runtime-activation.mjs";
const PROOF_LIBRARY = "scripts/lib/control-plane-runtime-activation-proof.mjs";
const ATOMIC_WRITER = "scripts/lib/atomic-proof-artifact.mjs";
const ROOT_TEST = "tests/control-plane-runtime-activation.test.mjs";
const BUNDLE_FIXTURE = "examples/sign-in/official-derived.bundle.desen.json";
const CATALOG_FIXTURE = "packages/reference-catalog-web/catalog.json";
const CATALOG_DISTRIBUTION = "packages/reference-catalog-web/dist";

const MAX_AUTHORITY_BYTES = 16 * 1_024 * 1_024;
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

const EXPECTED_REVISION = "sha256:2dc98d276a3b4102c2891de1519bda86ea2978f5429fd8ea91831f36f8b73ffb";
const REVISION_A = `sha256:${"a".repeat(64)}`;
const REVISION_B = `sha256:${"b".repeat(64)}`;
const TRACE_IDS = Object.freeze([
  "PIPE-007",
  "PIPE-016",
  "PIPE-017",
  "R-008",
  "R-102",
  "R-126",
  "A-008",
  "A-009",
]);

const EXPECTED_RUNTIME_TEST_NAMES = Object.freeze([
  "commits generation zero and transfers the exact staged authority out of T06",
  "rejects equal-revision authorities from distinct private T03 lineages without consuming T06",
  "rejects forged, cloned, proxied, and already consumed pairs before Bundle-store I/O",
  "authenticates storage failures without inspecting hostile values or trusting a forged name",
  "admits only one in-flight attempt and does not consume a busy candidate",
  "terminally consumes a valid candidate when the same-root Bundle cannot be reclosed",
  "propagates Bundle-store operational failures without writing or disguising them as reclosure",
  "rejects same-key bytes whose embedded revision and staged content do not reclose",
  "increments same-revision commits, derives previous-good, and revokes superseded authorities",
  "preserves the authenticated current authority on a definite stale CAS loss",
  "opens a preexisting record only as recovery-required and blocks activation without consumption",
  "reopens a public durable record as raw recovery state rather than active authority",
  "enters sticky recovery when authenticated durable state disappears or is rewritten",
  "rolls back a definite before-COMMIT failure and admits a fresh candidate retry",
  "turns a post-COMMIT failure into recovery-required and revokes the prior current authority",
  "allows one winner across two SQLite connections at the same expected generation",
  "consumes a generation-exhausted candidate without changing the authenticated current slot",
  "keeps generation exhaustion and repository close deterministic",
  "redacts statement-acquisition failure and closes the partially opened repository",
  "rejects unsafe SQLite leaves and sidecars plus schema drift and corruption",
  "rejects malformed roots and revokes service operations after close",
]);
const M07_T08_RUNTIME_TEST_NAMES = Object.freeze(
  EXPECTED_RUNTIME_TEST_NAMES.flatMap((name) =>
    name === "keeps generation exhaustion and repository close deterministic"
      ? [name, "rejects a generation-zero record that already claims a previous-good revision"]
      : [name],
  ),
);
const EXPECTED_TYPE_NEGATIVE_CLAIMS = Object.freeze([
  "A visible record cannot forge the private activation-authority brand.",
  "Caller cannot replace the transaction-derived active revision.",
  "Caller cannot replace the transaction-derived previous-good revision.",
  "Activation authority exposes no staged Bundle or runtime index.",
  "Activation authority exposes no package loader.",
  "Activation authority exposes no mutable release channel.",
  "Activation authority exposes no repository handle.",
  "Activation authority exposes no SQLite handle.",
  "Activation authority grants no recovery or rollback operation.",
  "Restart recovery belongs to M07-T08, not this authority.",
  "A raw recovered record is deliberately not authenticated as an authority.",
  "The caller cannot submit active or previous-good revisions.",
  "Expected generation must be a nonnegative number or null.",
  "T04 authority cannot replace the T06 staging branch.",
  "T06 authority cannot replace the T04 reference branch.",
  "Public opening accepts no arbitrary database path.",
  "Public opening accepts no caller-provided repository.",
  "Public opening accepts no caller-provided Bundle store seam.",
  "Public opening accepts no caller-selected active revision.",
  "Package-private repository construction is not exported publicly.",
  "Package-private SQLite opening is not exported publicly.",
  "Package-private authority inspection is not exported publicly.",
  "Package-private owned-resource assembly is not exported publicly.",
  "Package-private storage errors are not exported publicly.",
  "Package-private storage-error authentication is not exported publicly.",
]);
const EXPECTED_ROOT_TEST_NAMES = Object.freeze([
  "[authority] builds the exact versioned M07-T07 artifact and activation receipt",
  "[determinism] two independent evidence builds produce byte-identical artifacts",
  "[authority] verifies exact artifact bytes and one final proof-document pin",
  "[artifact] rejects one changed evidence byte",
  "[proof] rejects pending, wrong, duplicate, or missing final pins",
  "[prerequisites] rejects one changed byte in all three direct immutable artifacts",
  "[implementation] rejects authority-join, consume, reclosure, CAS, or recovery drift",
  "[registration] rejects package-root, package-script, aggregate, CI, or policy drift",
  "[traceability] rejects exact activation trace-owner drift",
  "[coverage] rejects P-12, N-004/N-038/N-041, or PF-075/PF-076 truth drift",
  "[runtime] rejects changed join, transition, rollback, recovery, or native-load receipts",
  "[tests] rejects skipped focused cases or removed compile-time negatives",
  "[platform] rejects public-export, TSDoc, private-export, or native-import drift",
  "[filesystem] rejects symlinked artifact and proof-document authority",
  "[writer] atomically writes exact deterministic evidence bytes",
  "[writer] preserves the old destination and removes a tampered temporary",
  "[options] rejects unknown, accessor-backed, shared-memory, or hostile authority",
  "[immutability] freezes the evidence graph and preserves T08-T11 nonclaims",
]);
const M07_T09_N004_SUCCESSOR_RECEIPT = Object.freeze({
  bytes: 2_526,
  sha256: "885b985c43c8e4dced2f1361d8e08728a63fa055b29df84e7cccaf16ba5e11de",
});
const M07_T10_N038_SUCCESSOR_RECEIPT = Object.freeze({
  bytes: 2_534,
  sha256: "6c455b9798372973a45b57083f7413e2e7aa9242f28669a35fee790633d032c0",
});

const M07_T07_DOCUMENTED_ACTIVATION_SOURCE_EXPORTS = Object.freeze(
  [
    "BundleRuntimeActivation",
    "BundleRuntimeActivationAuthority",
    "BundleRuntimeActivationDiagnostic",
    "BundleRuntimeActivationResult",
    "BundleRuntimeActivationStage",
    "BundleRuntimeActivationState",
    "INVALID_RUNTIME_ACTIVATION_AUTHORITY_CODE",
    "OpenBundleRuntimeActivationOptions",
    "RUNTIME_ACTIVATION_BUNDLE_RECLOSURE_FAILED_CODE",
    "RUNTIME_ACTIVATION_INTERNAL_FAILURE_CODE",
    "RuntimeActivationError",
    "RuntimeActivationErrorCode",
    "RuntimeActivationRecord",
    "createOwnedBundleRuntimeActivationInternal",
    "openBundleRuntimeActivation",
  ].sort(),
);
const M07_T08_DOCUMENTED_ACTIVATION_SOURCE_EXPORTS = Object.freeze(
  [
    ...M07_T07_DOCUMENTED_ACTIVATION_SOURCE_EXPORTS,
    "BundleRuntimeRecoveryResult",
    "BundleRuntimeRecoveryRole",
    "BundleRuntimeRecoveryStage",
    "INVALID_RUNTIME_RECOVERY_PACKAGE_AUTHORITY_CODE",
    "RUNTIME_RECOVERY_BUNDLE_RECLOSURE_FAILED_CODE",
    "RUNTIME_RECOVERY_INTERNAL_FAILURE_CODE",
  ].sort(),
);

const ROOT_SCRIPT_COMMANDS = Object.freeze({
  generate:
    "pnpm verify:control-plane-runtime-staging && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:runtime-activation && node scripts/generate-control-plane-runtime-activation-proof.mjs",
  verify:
    "pnpm verify:control-plane-runtime-staging && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:runtime-activation && node scripts/verify-control-plane-runtime-activation.mjs",
  test: "pnpm verify:control-plane-runtime-staging && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:runtime-activation && node --test tests/control-plane-runtime-activation.test.mjs",
});
const CI_TUPLE = Object.freeze([
  "control-plane-runtime-activation",
  "scripts/verify-control-plane-runtime-activation.mjs",
  "tests/control-plane-runtime-activation.test.mjs",
]);

export const CONTROL_PLANE_RUNTIME_ACTIVATION_PREREQUISITE_PINS = Object.freeze([
  Object.freeze({
    task: "M07-T01",
    path: "docs/proof/artifacts/control-plane-api-0.1.0-bundle-store.json",
    sha256: "698be7d5610d1732ad991bf7e58131e81d2c34ffa888f65ec3c7916334f54795",
  }),
  Object.freeze({
    task: "M07-T04",
    path: "docs/proof/artifacts/control-plane-api-0.1.0-reference-preflight.json",
    sha256: "29555326d51073c50937519d8706049ad17287079cc3ef4dc7060bb3a3225394",
  }),
  Object.freeze({
    task: "M07-T06",
    path: "docs/proof/artifacts/control-plane-api-0.1.0-runtime-staging.json",
    sha256: "d025da5329d5b56b9b46e7292a08883386a151add5e419edf2a9345425319494",
  }),
]);

const TRACKED_TASK_FILES = Object.freeze([
  APP_PACKAGE,
  APP_INDEX,
  APP_CONTRACT,
  APP_INTERNAL,
  APP_REPOSITORY,
  APP_SQLITE,
  APP_FACTORY,
  APP_STAGING_INTERNAL,
  APP_RUNTIME_TEST,
  APP_TYPE_TEST,
  ADR,
  GENERATOR,
  VERIFIER,
  PROOF_LIBRARY,
  ATOMIC_WRITER,
  ROOT_TEST,
  ROOT_PACKAGE,
  CI_SOURCE,
  CI_INVENTORY,
  SHARED_STATE_AUTHORITY,
]);

const M07_T08_TRACKED_RECEIPT_BRIDGE = Object.freeze({
  [APP_PACKAGE]: Object.freeze({
    historical: Object.freeze({
      bytes: 2_159,
      sha256: "2511a9dfaba16880d5591a68adb2dcbbd6d84a90298d38218f2434bb06416627",
    }),
    successor: Object.freeze({
      bytes: 2_232,
      sha256: "b228b200dafda1d319429376b9cc6456fadd4a3db865269ec8c2675eb0e60e8c",
    }),
  }),
  [APP_INDEX]: Object.freeze({
    historical: Object.freeze({
      bytes: 4_606,
      sha256: "e7ef3e595fc15b2374cca9d265c2891d1ccf304052f34ec3a706b67608f59d16",
    }),
    successor: Object.freeze({
      bytes: 4_891,
      sha256: "1295547b6c281ea2678583298648a4ad8287205109d670fa422450146da5031e",
    }),
  }),
  [APP_CONTRACT]: Object.freeze({
    historical: Object.freeze({
      bytes: 8_962,
      sha256: "3a9958660f9c5a1163c229d68826d13e53fb68b30f56371dada9ecafd8342d07",
    }),
    successor: Object.freeze({
      bytes: 12_799,
      sha256: "35602d69d66e24fe7a9171221b046c37abd1be42d2f3ab83eb76a70efeb7aa5b",
    }),
  }),
  [APP_INTERNAL]: Object.freeze({
    historical: Object.freeze({
      bytes: 16_625,
      sha256: "2dd919d08c93d8d38d2a74dea5eecb3cb68f4fa15276430bce75610407e47b28",
    }),
    successor: Object.freeze({
      bytes: 23_409,
      sha256: "a166fc51237c4d7b3389282fd424b5156c2d782c3fceab37f424fead93629880",
    }),
  }),
  [APP_REPOSITORY]: Object.freeze({
    historical: Object.freeze({
      bytes: 9_799,
      sha256: "9f18e742ae78eabc4215d1c981444e4c5f4c8cc48175e1c81407a9395d7e655a",
    }),
    successor: Object.freeze({
      bytes: 9_860,
      sha256: "0c47b5b166d1dbe1226d2d4c312d81cb150d09e87005230c3f88f25c5a789d91",
    }),
  }),
  [APP_SQLITE]: Object.freeze({
    historical: Object.freeze({
      bytes: 22_424,
      sha256: "1d5c24cf26e8f58ed3fb13f844be2197e1bb5306619dbf2f9e3b4e3e2bab6d74",
    }),
    successor: Object.freeze({
      bytes: 22_508,
      sha256: "a97191a6d508d4ff3c26e0f691e52b9c9215b4ecb69a014da4ecd03086a3beeb",
    }),
  }),
  [APP_FACTORY]: Object.freeze({
    historical: Object.freeze({
      bytes: 5_524,
      sha256: "7f7d83d65efa0eee60312acd315b55e63dbd8690f178df984d68ff3e48b2b809",
    }),
    successor: Object.freeze({
      bytes: 5_540,
      sha256: "6455e6d9950d970057c68a2e1fe8349ebe4dd88c51ca2fc4d34576bc3146c6f6",
    }),
  }),
  [APP_RUNTIME_TEST]: Object.freeze({
    historical: Object.freeze({
      bytes: 46_126,
      sha256: "2fbf5f4773e8090ac06d5b812f2c85809e7056edc091a4e35342fc3e5ccd1698",
    }),
    successor: Object.freeze({
      bytes: 48_252,
      sha256: "ae777d9ecbe4817522e63cf7f269e651848b44a9211dbc18f8f95016caaf5885",
    }),
  }),
  [ADR]: Object.freeze({
    historical: Object.freeze({
      bytes: 10_384,
      sha256: "f3edf39e82d1b12d4feaf0f89946e6a40e07fd364721dc92a29baaf77a85c9ba",
    }),
    successor: Object.freeze({
      bytes: 11_185,
      sha256: "7f1233771e1b48563d7f597b6f1dd6dae0c471bb439adf8f02770629e5bed203",
    }),
  }),
  [ROOT_PACKAGE]: Object.freeze({
    historical: Object.freeze({
      bytes: 62_928,
      sha256: "8f47985e6d774a72042261e65c2c2d86c9c5526d27d91be846d3ce38d88beaa0",
    }),
    successor: Object.freeze({
      bytes: 63_983,
      sha256: "4f9c7431ba3df1be3e69bfd092a24421c14ed4a911baed2edbbb395aacca1cc8",
    }),
  }),
  [CI_SOURCE]: Object.freeze({
    historical: Object.freeze({
      bytes: 47_703,
      sha256: "f6703693b1cce00a35666790b27542f140aa17ecc89d6646d135641f6543041d",
    }),
    successor: Object.freeze({
      bytes: 47_870,
      sha256: "c0312d1874917092f4300b7bdb789bc2a35a2d2f973a0bb214b551d86916fabe",
    }),
  }),
  [CI_INVENTORY]: Object.freeze({
    historical: Object.freeze({
      bytes: 46_008,
      sha256: "d05a7e824d5d4787e3ec422896c3ce2ecf3d478390b862200a8ae01adbbf1d22",
    }),
    successor: Object.freeze({
      bytes: 46_165,
      sha256: "00b6b4601e526a9d71465700e5f50d68c84265c211de1ed7f5e9ccee8670b62b",
    }),
  }),
  [SHARED_STATE_AUTHORITY]: Object.freeze({
    historical: Object.freeze({
      bytes: 46_537,
      sha256: "39ccbafa0947cb40e3d4232caf218e2a00247232e5cadc310892c2ecb2dad63c",
    }),
    successor: Object.freeze({
      bytes: 46_971,
      sha256: "a6aab2fbefa3392b8614c92799d75429ca5b1b6f812c45b73cb7167fc4be9f16",
    }),
  }),
});
const M07_T09_TRACKED_RECEIPT_BRIDGE = Object.freeze({
  [APP_PACKAGE]: Object.freeze({
    historical: M07_T08_TRACKED_RECEIPT_BRIDGE[APP_PACKAGE].successor,
    successor: Object.freeze({
      bytes: 2_319,
      sha256: "5c4495f06ecb1394fee2c14c2e57bc1bf76fe9a99ee1cb56c0ce4ff0874388c3",
    }),
  }),
  [ROOT_PACKAGE]: Object.freeze({
    historical: M07_T08_TRACKED_RECEIPT_BRIDGE[ROOT_PACKAGE].successor,
    successor: Object.freeze({
      bytes: 65_109,
      sha256: "4df33d2b8b54754c8b4686c52ae9566d29c3979a15b1c4ece9845c7c0c8ea2c2",
    }),
  }),
  [CI_SOURCE]: Object.freeze({
    historical: M07_T08_TRACKED_RECEIPT_BRIDGE[CI_SOURCE].successor,
    successor: Object.freeze({
      bytes: 48_058,
      sha256: "cae746df78f6036db3b1bf092ef03f367994a27316757ee52d86b7607a46423a",
    }),
  }),
  [CI_INVENTORY]: Object.freeze({
    historical: M07_T08_TRACKED_RECEIPT_BRIDGE[CI_INVENTORY].successor,
    successor: Object.freeze({
      bytes: 46_343,
      sha256: "554584fff74af5d2ba1e268b18bd901c8f228cdffe046789fbd02f1f9da5f69e",
    }),
  }),
  [SHARED_STATE_AUTHORITY]: Object.freeze({
    historical: M07_T08_TRACKED_RECEIPT_BRIDGE[SHARED_STATE_AUTHORITY].successor,
    successor: Object.freeze({
      bytes: 47_479,
      sha256: "9b15cef3b2d795c268945c2f4bee670c037878bd43967c1ce71a41342d463140",
    }),
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
    historical: M07_T08_TRACKED_RECEIPT_BRIDGE[APP_SQLITE].successor,
    successor: Object.freeze({
      bytes: 23_137,
      sha256: "cec7d1437d7e222facdc5681ae720ec6bc3b77fe3f9f5fac7493481f868be164",
    }),
  }),
  [ADR]: Object.freeze({
    historical: M07_T08_TRACKED_RECEIPT_BRIDGE[ADR].successor,
    successor: Object.freeze({
      bytes: 12_308,
      sha256: "8a98d42373b0a655b6f8b0a55a9ab4038868de7735ba32dca491f50e198a728c",
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
    historical: M07_T09_TRACKED_RECEIPT_BRIDGE[CI_SOURCE].successor,
    successor: Object.freeze({
      bytes: 48_249,
      sha256: "fdb79dcf8e5fa46e6a22e07e04fc1623214ea0af164b3dde2d876531479177f3",
    }),
  }),
  [CI_INVENTORY]: Object.freeze({
    historical: M07_T09_TRACKED_RECEIPT_BRIDGE[CI_INVENTORY].successor,
    successor: Object.freeze({
      bytes: 46_524,
      sha256: "3b411b2866820003896a7fe6e41fb5fca2db84300687e07d10ab92ce5fdb407f",
    }),
  }),
  [SHARED_STATE_AUTHORITY]: Object.freeze({
    historical: M07_T09_TRACKED_RECEIPT_BRIDGE[SHARED_STATE_AUTHORITY].successor,
    successor: Object.freeze({
      bytes: 47_816,
      sha256: "f7827f300a9a53edc6a0c41bf1246df53d5ab21c4cd4e67c6452a2cb95c74e99",
    }),
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
    successor: Object.freeze({
      bytes: 48_440,
      sha256: "68fcfacafb2765db2b60b717089a0c1c237f28efb32a5512b4fe38e986f7d459",
    }),
  }),
  [CI_INVENTORY]: Object.freeze({
    historical: M07_T10_TRACKED_RECEIPT_BRIDGE[CI_INVENTORY].successor,
    successor: Object.freeze({
      bytes: 46_705,
      sha256: "c290e7fbcf0adf9d56efa039209e140fb56e31a7a8e2b84e90b2e73330031805",
    }),
  }),
  [SHARED_STATE_AUTHORITY]: Object.freeze({
    historical: M07_T10_TRACKED_RECEIPT_BRIDGE[SHARED_STATE_AUTHORITY].successor,
    successor: Object.freeze({
      bytes: 51_626,
      sha256: "0fd1695a90e8c9e6772413fea47a02129af025b7a1cfbc3cc7068560cb764721",
    }),
  }),
});

const M07_T08_READER_RECEIPT_PROJECTION = Object.freeze({
  [PROOF_LIBRARY]: Object.freeze({
    bytes: 85_644,
    sha256: "99332dca08781d8b86282efb23a19b17ee14913c4d8886a08a7a9d4368f39b78",
  }),
  [ROOT_TEST]: Object.freeze({
    bytes: 26_039,
    sha256: "4c88c51945a53e0730d0305b260048e676528edc692d079ddc1711726ee5208e",
  }),
});

const M07_T08_ACTIVATION_DISTRIBUTION_RECEIPT_BRIDGE = Object.freeze(
  Object.fromEntries(
    [
      [
        "runtime-activation-contract.d.ts",
        8_048,
        "79b5818d1578109e5fb74a37e3b68fd97d869a095e5b55493b95efff1a3202a2",
        11_806,
        "24e37a4ad7ca6b8c6ac48139d3b094324677a4dd2e839a9ab684e121382ee80e",
      ],
      [
        "runtime-activation-contract.d.ts.map",
        3_011,
        "85976ef76ec27f8ee1347bd1a9665d3e959a3b33763cb73c6ab8d4ebc42f5d9a",
        4_217,
        "f79d44a76578b52a0b159dfdcc6c668b70d386452e4fa6d1c7c1c2fa57f948fa",
      ],
      [
        "runtime-activation-contract.js",
        1_905,
        "4147503300c6cfa710c1f8a2b5526028bfb517fca516b5105b3176105d2b3664",
        2_560,
        "15a15996ee909537a0504f0250ff8e43dfcf569b08f490bb089b60712aba7b7f",
      ],
      [
        "runtime-activation-contract.js.map",
        784,
        "dbae75f9a2631dfa5094c4757f25540738355400811cdee0623d8bc368066b82",
        961,
        "56d2dd6e5f3ae7bacc52dfdba99a7afb53c7a2c585050ea347734e7ee2be9c15",
      ],
      [
        "runtime-activation-internal.d.ts",
        68,
        "9fa369d4bbc9ed25df91c9d39f0784a96bd78302df9842a381813f2539cd44cf",
        1_095,
        "f731075396106cd62420001da75fd5f28246eb145c6600883e63226eb81f62b3",
      ],
      [
        "runtime-activation-internal.d.ts.map",
        148,
        "f2fe6879339892669e8771d583222ce33413413d9f5b5baa99de31ca3f0fd010",
        660,
        "bc35233d5990a8c5ded9b38511bd6e0905236e8b8c1f29b574a97258f4d35926",
      ],
      [
        "runtime-activation-internal.js",
        13_899,
        "2c8f2bceaf65be9671ba5bfc653238483a9c6f75da4bd69d408a054c3809ba2f",
        20_019,
        "4f3cee8f943e8e633947062226db0b738d9e7c66941b19640dee784f5eb0536e",
      ],
      [
        "runtime-activation-internal.js.map",
        11_127,
        "c58f12d779d7536497fe46bd3ec72b5d687d88d1e72cc1bad0747c8d1c7541da",
        15_503,
        "6e0ebaa47f223351e3130c1f9b0eb5dec55cf6bf827d0decb5f0f43136092ad5",
      ],
      [
        "runtime-activation-repository-internal.d.ts",
        324,
        "2a29042c3bce9c3fc42242f33400e8e3504ee0fec6942d168b8d1cd02249d108",
        324,
        "2a29042c3bce9c3fc42242f33400e8e3504ee0fec6942d168b8d1cd02249d108",
      ],
      [
        "runtime-activation-repository-internal.d.ts.map",
        274,
        "9ba5e1602e582da736ebab0f193257cc770e29d87d13422bf07b10a51214ad67",
        274,
        "9ba5e1602e582da736ebab0f193257cc770e29d87d13422bf07b10a51214ad67",
      ],
      [
        "runtime-activation-repository-internal.js",
        7_201,
        "496b3ef9d593f0dc69cd1ea8b7adbcf7ebfdcf9fcd3472b086ed4e89e07b458f",
        7_268,
        "7837993919617a49affd3d55d3547a76c2062cf688c6283a63748b9d69d92fb7",
      ],
      [
        "runtime-activation-repository-internal.js.map",
        5_670,
        "a57392521d93bbab6564bbd5bcc8fb7d6a41a5bc922af5fa7bcf5f0628e652cb",
        5_723,
        "49d55e080e0a1f3505e8bb1698537e203a0697df553b89365fde250b62306577",
      ],
      [
        "runtime-activation-sqlite-internal.d.ts",
        259,
        "fd5948e6c1e6a872e4ba0475699b3d2b867b772feaf222cef46d8a591a8152d7",
        259,
        "fd5948e6c1e6a872e4ba0475699b3d2b867b772feaf222cef46d8a591a8152d7",
      ],
      [
        "runtime-activation-sqlite-internal.d.ts.map",
        251,
        "ba8d0c85d4c4dde95896ad4966f90a00b97746fbb93fe3525dc52b0d0910331e",
        251,
        "ba8d0c85d4c4dde95896ad4966f90a00b97746fbb93fe3525dc52b0d0910331e",
      ],
      [
        "runtime-activation-sqlite-internal.js",
        21_624,
        "0523f5a56325ac76150d1755ad1cbe3b0be66a5cc47831c7790f8222dc3ff78c",
        21_714,
        "b14e6cf3c6b292a20e453fb63b414f506ff48c4738005c26d775200b5ad4002c",
      ],
      [
        "runtime-activation-sqlite-internal.js.map",
        17_778,
        "67ad22a81128b382957af9799445a367058a3ce13dc8370ba7be3864eb61afc3",
        17_861,
        "71f5c1c60fea9c4137c84ad8ad2225384ff99042b2a3a2d03aba21422ce7a959",
      ],
      [
        "runtime-activation.d.ts",
        844,
        "87410cd73370f87ad068d92516dfcccc80d889903f52e3b6225c2c25b08fa701",
        860,
        "5c4bfc7a24f08d3c547ccbb96ead76424a7eea4f3d491a02ea209e91fa103f14",
      ],
      [
        "runtime-activation.d.ts.map",
        323,
        "d800f264678b7063b8e8d103f1c5448a96695cac1971f59160d43a3c2f42ca18",
        324,
        "0f3b5c2be12ae1f6f6c04532c32394b212856f839106cfa833d064bbec9e0e02",
      ],
      [
        "runtime-activation.js",
        5_327,
        "798e9a52ddf31881eebd7d0014b345c1947335e73b3799c97b48afcbded5a8af",
        5_343,
        "58a51393ecb14ca6b089ca1b8d3b894c2830dd1c766dc0ec03aadb628e2a0a60",
      ],
      [
        "runtime-activation.js.map",
        3_810,
        "aa1e6bd122307b40ffafb71409cbce731e2809fa3b0d0b7231320cd6a0c1ee93",
        3_811,
        "20d3f8bd0716340744fea3fc5aab79f8c8b8054ad2845f6c8ec6717bf4f1f00b",
      ],
    ].map(([name, historicalBytes, historicalSha256, successorBytes, successorSha256]) => [
      name,
      Object.freeze({
        historical: Object.freeze({ bytes: historicalBytes, sha256: historicalSha256 }),
        successor: Object.freeze({ bytes: successorBytes, sha256: successorSha256 }),
      }),
    ]),
  ),
);

const M07_T08_INDEX_DISTRIBUTION_RECEIPT_BRIDGE = Object.freeze(
  Object.fromEntries(
    [
      [
        "index.d.ts",
        4_457,
        "8911f27f0c5c11d09cd1116f99ea12f323ef37ee56c63693000e119e999f2ecd",
        4_730,
        "81ced4650dcf6f1fb05980c00c610923083c4262c231d604cda504f569171d56",
      ],
      [
        "index.d.ts.map",
        2_084,
        "fd308fb24c1823a6156c7149076c82534f0dcff8517c83aaff02d043a4ad6ce7",
        2_163,
        "d10e151ff9124b072a4466c5b33e012c0f24496b900d89547209bb433a63962c",
      ],
      [
        "index.js",
        2_093,
        "037d35f0354064e41a7b8a89361d4c0bc75fd2e830e4bdaea74941bf669bd618",
        2_282,
        "a97d3e83f6319627c78ad38b7d81b6879ac524408c7f8993c5c5f2a53cfbc02a",
      ],
      [
        "index.js.map",
        996,
        "d011e413c2f446114640487305f094642a5a78a4ee635b79ec69f9937d0cf93a",
        1_036,
        "b075210c25f4659befbdeb9620842c2cd28d7f2075b11a99d83606f554330f36",
      ],
    ].map(([name, historicalBytes, historicalSha256, successorBytes, successorSha256]) => [
      name,
      Object.freeze({
        historical: Object.freeze({ bytes: historicalBytes, sha256: historicalSha256 }),
        successor: Object.freeze({ bytes: successorBytes, sha256: successorSha256 }),
      }),
    ]),
  ),
);
const M07_T10_ACTIVATION_DISTRIBUTION_RECEIPT_BRIDGE = Object.freeze({
  "runtime-activation-sqlite-internal.js": Object.freeze({
    historical:
      M07_T08_ACTIVATION_DISTRIBUTION_RECEIPT_BRIDGE["runtime-activation-sqlite-internal.js"]
        .successor,
    successor: Object.freeze({
      bytes: 22_376,
      sha256: "7eb443e770bb05b064a6b904142ed3efc4f33e1def8fe74a1d1aef973858045a",
    }),
  }),
  "runtime-activation-sqlite-internal.js.map": Object.freeze({
    historical:
      M07_T08_ACTIVATION_DISTRIBUTION_RECEIPT_BRIDGE["runtime-activation-sqlite-internal.js.map"]
        .successor,
    successor: Object.freeze({
      bytes: 18_026,
      sha256: "90ed8c9001563830d6584740ce3a5efb582b3e316d54f057dac8049fb393ee69",
    }),
  }),
});

export const DEFAULT_CONTROL_PLANE_RUNTIME_ACTIVATION_ARTIFACT_PATH = path.join(ROOT, ARTIFACT);

export class ControlPlaneRuntimeActivationEvidenceError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ControlPlaneRuntimeActivationEvidenceError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details = {}) {
  throw new ControlPlaneRuntimeActivationEvidenceError(code, message, details);
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
      fail("INVALID_OPTIONS", `${label} has unsupported byte-view authority.`);
    }
    const snapshot = new Uint8Array(byteLength);
    Reflect.apply(UINT8_ARRAY_SET, snapshot, [new Uint8Array(buffer, byteOffset, byteLength)]);
    return snapshot;
  } catch (error) {
    if (error instanceof ControlPlaneRuntimeActivationEvidenceError) throw error;
    fail("INVALID_OPTIONS", `${label} could not be captured as inert bytes.`);
  }
}

function captureByteOverrides(value, allowedPaths, label) {
  if (value === undefined) return Object.freeze({});
  const record = exactOwnDataOptions(value, new Set(allowedPaths), label);
  return Object.freeze(
    Object.fromEntries(
      Object.entries(record).map(([relativePath, bytes]) => [
        relativePath,
        captureBytes(bytes, `${label}.${relativePath}`),
      ]),
    ),
  );
}

function copyInertJson(value, label, active = new Set(), budget = { nodes: 0 }) {
  budget.nodes += 1;
  if (budget.nodes > 200_000) fail("INVALID_OPTIONS", `${label} exceeds its JSON node ceiling.`);
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
        if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
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
        !descriptor.enumerable ||
        !("value" in descriptor)
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

async function safeReadAbsolute(filePath, maximumBytes = MAX_AUTHORITY_BYTES) {
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
    if (opened.size > maximumBytes) {
      fail("UNSAFE_AUTHORITY", "An evidence authority exceeds its byte ceiling.");
    }
    const bytes = await handle.readFile();
    const after = await lstat(resolved);
    if (
      !after.isFile() ||
      after.isSymbolicLink() ||
      after.dev !== opened.dev ||
      after.ino !== opened.ino ||
      after.size !== bytes.byteLength
    ) {
      fail("UNSAFE_AUTHORITY", "An evidence authority changed while reading.");
    }
    return Uint8Array.from(bytes);
  } catch (error) {
    if (error instanceof ControlPlaneRuntimeActivationEvidenceError) throw error;
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
    if (error instanceof ControlPlaneRuntimeActivationEvidenceError) throw error;
    fail("AUTHORITY_PARSE_FAILURE", `${label} is not valid JSON.`);
  }
}

function parseTypescript(source, relativePath, code = "TEST_AUTHORITY_DRIFT") {
  const sourceFile = ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true);
  if (sourceFile.parseDiagnostics.length > 0)
    fail(code, `${relativePath} is not valid TypeScript.`);
  return sourceFile;
}

function registeredTestNames(source, relativePath, functionNames) {
  const sourceFile = parseTypescript(source, relativePath);
  const names = [];
  const allowed = new Set(functionNames);
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      allowed.has(node.expression.text) &&
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
  parseTypescript(source, relativePath);
  const cases = [...source.matchAll(/\/\/ @ts-expect-error ([^\n]+)/gu)].map(([, claim]) => claim);
  if (cases.length === 0) fail("TEST_AUTHORITY_DRIFT", `${relativePath} has no type negatives.`);
  return Object.freeze(cases);
}

function explicitAnyCount(source, relativePath) {
  const sourceFile = parseTypescript(source, relativePath, "IMPLEMENTATION_DRIFT");
  let count = 0;
  const visit = (node) => {
    if (node.kind === ts.SyntaxKind.AnyKeyword) count += 1;
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return count;
}

const M07_T07_ACTIVATION_PUBLIC_EXPORTS = Object.freeze(
  [
    ["BundleRuntimeActivation", "./runtime-activation-contract.js", true],
    ["BundleRuntimeActivationAuthority", "./runtime-activation-contract.js", true],
    ["BundleRuntimeActivationDiagnostic", "./runtime-activation-contract.js", true],
    ["BundleRuntimeActivationResult", "./runtime-activation-contract.js", true],
    ["BundleRuntimeActivationStage", "./runtime-activation-contract.js", true],
    ["BundleRuntimeActivationState", "./runtime-activation-contract.js", true],
    ["INVALID_RUNTIME_ACTIVATION_AUTHORITY_CODE", "./runtime-activation-contract.js", false],
    ["openBundleRuntimeActivation", "./runtime-activation.js", false],
    ["OpenBundleRuntimeActivationOptions", "./runtime-activation-contract.js", true],
    ["RUNTIME_ACTIVATION_BUNDLE_RECLOSURE_FAILED_CODE", "./runtime-activation-contract.js", false],
    ["RUNTIME_ACTIVATION_INTERNAL_FAILURE_CODE", "./runtime-activation-contract.js", false],
    ["RuntimeActivationError", "./runtime-activation-contract.js", false],
    ["RuntimeActivationErrorCode", "./runtime-activation-contract.js", true],
    ["RuntimeActivationRecord", "./runtime-activation-contract.js", true],
  ].map(([name, module, typeOnly]) =>
    Object.freeze({ exported: name, imported: name, module, typeOnly }),
  ),
);

const M07_T08_RECOVERY_PUBLIC_EXPORTS = Object.freeze(
  [
    ["BundleRuntimeRecoveryResult", true],
    ["BundleRuntimeRecoveryRole", true],
    ["BundleRuntimeRecoveryStage", true],
    ["INVALID_RUNTIME_RECOVERY_PACKAGE_AUTHORITY_CODE", false],
    ["RUNTIME_RECOVERY_BUNDLE_RECLOSURE_FAILED_CODE", false],
    ["RUNTIME_RECOVERY_INTERNAL_FAILURE_CODE", false],
  ].map(([name, typeOnly]) =>
    Object.freeze({
      exported: name,
      imported: name,
      module: "./runtime-activation-contract.js",
      typeOnly,
    }),
  ),
);

const M07_T08_ACTIVATION_PUBLIC_EXPORTS = Object.freeze(
  [...M07_T07_ACTIVATION_PUBLIC_EXPORTS, ...M07_T08_RECOVERY_PUBLIC_EXPORTS].sort((left, right) => {
    const byName = left.exported.localeCompare(right.exported);
    return byName === 0 ? Number(left.typeOnly) - Number(right.typeOnly) : byName;
  }),
);

const M07_T08_RECOVERY_PUBLIC_EXPORT_NAMES = Object.freeze(
  M07_T08_RECOVERY_PUBLIC_EXPORTS.map(({ exported }) => exported),
);

function publicExportInventory(source) {
  const sourceFile = parseTypescript(source, APP_INDEX, "REGISTRATION_DRIFT");
  const inventory = [];
  for (const statement of sourceFile.statements) {
    if (!ts.isExportDeclaration(statement) || statement.exportClause === undefined) continue;
    if (!ts.isNamedExports(statement.exportClause) || statement.moduleSpecifier === undefined) {
      fail("REGISTRATION_DRIFT", "The package root contains a non-explicit export.");
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
    const byName = left.exported.localeCompare(right.exported);
    return byName === 0 ? Number(left.typeOnly) - Number(right.typeOnly) : byName;
  });
  const activation = inventory.filter(({ module }) => module.startsWith("./runtime-activation"));
  const serializedActivation = JSON.stringify(activation);
  const historical = serializedActivation === JSON.stringify(M07_T07_ACTIVATION_PUBLIC_EXPORTS);
  const approvedCurrent =
    serializedActivation === JSON.stringify(M07_T08_ACTIVATION_PUBLIC_EXPORTS);
  if (
    (!historical && !approvedCurrent) ||
    inventory.some(({ exported }) =>
      [
        "createBundleRuntimeActivationInternal",
        "createOwnedBundleRuntimeActivationInternal",
        "createInMemoryRuntimeActivationRepository",
        "openRuntimeActivationSqliteRepository",
        "readBundleRuntimeActivationAuthority",
        "RuntimeActivationStorageError",
        "readRuntimeActivationStorageErrorCode",
      ].includes(exported),
    )
  ) {
    fail("REGISTRATION_DRIFT", "The exact M07-T07 public package-root inventory drifted.");
  }
  return deepFreeze(
    approvedCurrent
      ? inventory.filter(({ exported }) => !M07_T08_RECOVERY_PUBLIC_EXPORT_NAMES.includes(exported))
      : inventory,
  );
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

function assertAdjacent(
  script,
  predecessor,
  current,
  reviewedSuccessor,
  reviewedFaultInjectionSuccessor,
  reviewedTransitionRaceSuccessor,
  reviewedChannelSuccessor,
  terminal,
) {
  if (typeof script !== "string") fail("REGISTRATION_DRIFT", "An aggregate script is absent.");
  const commands = script.split(" && ");
  const predecessorIndex = commands.indexOf(predecessor);
  const currentIndex = commands.indexOf(current);
  const reviewedSuccessorIndex = commands.indexOf(reviewedSuccessor);
  const reviewedFaultInjectionSuccessorIndex = commands.indexOf(reviewedFaultInjectionSuccessor);
  const reviewedTransitionRaceSuccessorIndex = commands.indexOf(reviewedTransitionRaceSuccessor);
  const reviewedChannelSuccessorIndex = commands.indexOf(reviewedChannelSuccessor);
  const terminalIndex = commands.indexOf(terminal);
  const historical =
    currentIndex === predecessorIndex + 1 &&
    terminalIndex === currentIndex + 1 &&
    reviewedSuccessorIndex < 0 &&
    reviewedFaultInjectionSuccessorIndex < 0 &&
    reviewedTransitionRaceSuccessorIndex < 0;
  const approvedCurrent =
    currentIndex === predecessorIndex + 1 &&
    reviewedSuccessorIndex === currentIndex + 1 &&
    terminalIndex === reviewedSuccessorIndex + 1 &&
    reviewedFaultInjectionSuccessorIndex < 0 &&
    reviewedTransitionRaceSuccessorIndex < 0;
  const approvedFaultInjectionCurrent =
    currentIndex === predecessorIndex + 1 &&
    reviewedSuccessorIndex === currentIndex + 1 &&
    reviewedFaultInjectionSuccessorIndex === reviewedSuccessorIndex + 1 &&
    terminalIndex === reviewedFaultInjectionSuccessorIndex + 1 &&
    reviewedTransitionRaceSuccessorIndex < 0;
  const approvedTransitionRaceCurrent =
    currentIndex === predecessorIndex + 1 &&
    reviewedSuccessorIndex === currentIndex + 1 &&
    reviewedFaultInjectionSuccessorIndex === reviewedSuccessorIndex + 1 &&
    reviewedTransitionRaceSuccessorIndex === reviewedFaultInjectionSuccessorIndex + 1 &&
    terminalIndex === reviewedTransitionRaceSuccessorIndex + 1;
  const approvedChannelCurrent =
    currentIndex === predecessorIndex + 1 &&
    reviewedSuccessorIndex === currentIndex + 1 &&
    reviewedFaultInjectionSuccessorIndex === reviewedSuccessorIndex + 1 &&
    reviewedTransitionRaceSuccessorIndex === reviewedFaultInjectionSuccessorIndex + 1 &&
    reviewedChannelSuccessorIndex === reviewedTransitionRaceSuccessorIndex + 1 &&
    terminalIndex === reviewedChannelSuccessorIndex + 1;
  if (
    predecessorIndex < 0 ||
    (!historical &&
      !approvedCurrent &&
      !approvedFaultInjectionCurrent &&
      !approvedTransitionRaceCurrent &&
      !approvedChannelCurrent) ||
    commands.lastIndexOf(predecessor) !== predecessorIndex ||
    commands.lastIndexOf(current) !== currentIndex ||
    commands.lastIndexOf(terminal) !== terminalIndex ||
    ((approvedCurrent ||
      approvedFaultInjectionCurrent ||
      approvedTransitionRaceCurrent ||
      approvedChannelCurrent) &&
      commands.lastIndexOf(reviewedSuccessor) !== reviewedSuccessorIndex) ||
    ((approvedFaultInjectionCurrent || approvedTransitionRaceCurrent || approvedChannelCurrent) &&
      commands.lastIndexOf(reviewedFaultInjectionSuccessor) !==
        reviewedFaultInjectionSuccessorIndex) ||
    ((approvedTransitionRaceCurrent || approvedChannelCurrent) &&
      commands.lastIndexOf(reviewedTransitionRaceSuccessor) !==
        reviewedTransitionRaceSuccessorIndex) ||
    (approvedChannelCurrent &&
      commands.lastIndexOf(reviewedChannelSuccessor) !== reviewedChannelSuccessorIndex)
  ) {
    fail("REGISTRATION_DRIFT", "The exact M07-T07 aggregate adjacency drifted.");
  }
}

async function prerequisiteReceipts(overrides) {
  return deepFreeze(
    await Promise.all(
      CONTROL_PLANE_RUNTIME_ACTIVATION_PREREQUISITE_PINS.map(async (pin) => {
        const bytes = await authorityBytes(pin.path, overrides);
        const actual = sha256(bytes);
        if (actual !== pin.sha256) {
          fail("PREREQUISITE_DRIFT", `The immutable ${pin.task} prerequisite drifted.`, {
            task: pin.task,
            path: pin.path,
            expectedSha256: pin.sha256,
            actualSha256: actual,
          });
        }
        return Object.freeze({ ...pin, bytes: bytes.byteLength });
      }),
    ),
  );
}

async function trackedFileReceipts(overrides) {
  let historicalState = false;
  let successorState = false;
  let faultInjectionHistoricalState = false;
  let faultInjectionSuccessorState = false;
  let transitionRaceHistoricalState = false;
  let transitionRaceSuccessorState = false;
  const m07T11Generations = [];
  const receipts = [];
  for (const relativePath of TRACKED_TASK_FILES) {
    const bytes = await authorityBytes(relativePath, overrides);
    const overridden = Object.hasOwn(overrides, relativePath);
    const bridge = M07_T08_TRACKED_RECEIPT_BRIDGE[relativePath];
    const faultInjectionBridge = M07_T09_TRACKED_RECEIPT_BRIDGE[relativePath];
    const transitionRaceBridge = M07_T10_TRACKED_RECEIPT_BRIDGE[relativePath];
    const channelBridge = M07_T11_TRACKED_RECEIPT_BRIDGE[relativePath];
    const observed = Object.freeze({ bytes: bytes.byteLength, sha256: sha256(bytes) });
    if ((!overridden || faultInjectionBridge !== undefined) && bridge !== undefined) {
      const historicalMatch =
        observed.bytes === bridge.historical.bytes && observed.sha256 === bridge.historical.sha256;
      const successorMatch =
        observed.bytes === bridge.successor.bytes && observed.sha256 === bridge.successor.sha256;
      const faultInjectionMatch =
        faultInjectionBridge !== undefined &&
        observed.bytes === faultInjectionBridge.successor.bytes &&
        observed.sha256 === faultInjectionBridge.successor.sha256;
      const transitionRaceMatch =
        transitionRaceBridge !== undefined &&
        observed.bytes === transitionRaceBridge.successor.bytes &&
        observed.sha256 === transitionRaceBridge.successor.sha256;
      const channelMatch =
        channelBridge !== undefined &&
        observed.bytes === channelBridge.successor.bytes &&
        observed.sha256 === channelBridge.successor.sha256;
      if (
        !historicalMatch &&
        !successorMatch &&
        !faultInjectionMatch &&
        !transitionRaceMatch &&
        !channelMatch
      ) {
        fail("REGISTRATION_DRIFT", "A reviewed M07-T08 tracked successor receipt drifted.", {
          path: relativePath,
        });
      }
      if (historicalMatch && !successorMatch) historicalState = true;
      if (
        (successorMatch || faultInjectionMatch || transitionRaceMatch || channelMatch) &&
        !historicalMatch
      ) {
        successorState = true;
      }
      if (faultInjectionBridge !== undefined) {
        if (successorMatch && !faultInjectionMatch) faultInjectionHistoricalState = true;
        if (faultInjectionMatch && !successorMatch) faultInjectionSuccessorState = true;
      }
      if (transitionRaceBridge !== undefined) {
        const transitionHistoricalMatch =
          observed.bytes === transitionRaceBridge.historical.bytes &&
          observed.sha256 === transitionRaceBridge.historical.sha256;
        if (transitionHistoricalMatch && !transitionRaceMatch) transitionRaceHistoricalState = true;
        if (transitionRaceMatch && !transitionHistoricalMatch) transitionRaceSuccessorState = true;
      }
      if (channelBridge !== undefined) {
        const channelHistoricalMatch =
          observed.bytes === channelBridge.historical.bytes &&
          observed.sha256 === channelBridge.historical.sha256;
        m07T11Generations.push(
          channelMatch && !channelHistoricalMatch ? "successor" : "historical",
        );
      }
    }
    const projected =
      !overridden && bridge !== undefined
        ? bridge.historical
        : !overridden && M07_T08_READER_RECEIPT_PROJECTION[relativePath] !== undefined
          ? M07_T08_READER_RECEIPT_PROJECTION[relativePath]
          : observed;
    receipts.push(
      Object.freeze({
        path: relativePath,
        bytes: projected.bytes,
        sha256: projected.sha256,
      }),
    );
  }
  if (historicalState && successorState) {
    fail("REGISTRATION_DRIFT", "The reviewed M07-T08 tracked successor set is incoherent.");
  }
  if (faultInjectionHistoricalState && faultInjectionSuccessorState) {
    fail("REGISTRATION_DRIFT", "The reviewed M07-T09 tracked successor set is incoherent.");
  }
  if (transitionRaceHistoricalState && transitionRaceSuccessorState) {
    fail("REGISTRATION_DRIFT", "The reviewed M07-T10 tracked successor set is incoherent.");
  }
  if (m07T11Generations.includes("historical") && m07T11Generations.includes("successor")) {
    fail("REGISTRATION_DRIFT", "The reviewed M07-T11 tracked successor set is incoherent.");
  }
  return deepFreeze(receipts);
}

async function listDistributionFiles() {
  const directory = path.join(ROOT, APP_DIRECTORY, "dist");
  const output = [];
  const visit = async (relative) => {
    const entries = await readdir(path.join(directory, relative), { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const child = path.posix.join(relative, entry.name);
      if (entry.isSymbolicLink()) fail("UNSAFE_AUTHORITY", "Distribution authority is symlinked.");
      if (entry.isDirectory()) await visit(child);
      else if (entry.isFile()) output.push(child);
      else fail("UNSAFE_AUTHORITY", "Distribution authority is not a regular file.");
    }
  };
  await visit("");
  return output;
}

async function distributionReceipts() {
  const files = await listDistributionFiles();
  const observed = files
    .filter((file) => file.startsWith("runtime-activation") || file.startsWith("index."))
    .sort();
  const expected = [
    ...Object.keys(M07_T08_ACTIVATION_DISTRIBUTION_RECEIPT_BRIDGE),
    ...Object.keys(M07_T08_INDEX_DISTRIBUTION_RECEIPT_BRIDGE),
  ].sort();
  if (JSON.stringify(observed) !== JSON.stringify(expected)) {
    fail("DISTRIBUTION_DRIFT", "The exact M07-T08 activation/index distribution drifted.", {
      observed,
    });
  }
  const receipts = [];
  let historicalState = false;
  let successorState = false;
  let transitionRaceHistoricalState = false;
  let transitionRaceSuccessorState = false;
  for (const relativePath of observed) {
    const bytes = await safeReadAbsolute(path.join(ROOT, APP_DIRECTORY, "dist", relativePath));
    const observedReceipt = Object.freeze({ bytes: bytes.byteLength, sha256: sha256(bytes) });
    const bridge =
      M07_T08_ACTIVATION_DISTRIBUTION_RECEIPT_BRIDGE[relativePath] ??
      M07_T08_INDEX_DISTRIBUTION_RECEIPT_BRIDGE[relativePath];
    const transitionRaceBridge = M07_T10_ACTIVATION_DISTRIBUTION_RECEIPT_BRIDGE[relativePath];
    const historicalMatch =
      observedReceipt.bytes === bridge.historical.bytes &&
      observedReceipt.sha256 === bridge.historical.sha256;
    const successorMatch =
      observedReceipt.bytes === bridge.successor.bytes &&
      observedReceipt.sha256 === bridge.successor.sha256;
    const transitionRaceMatch =
      transitionRaceBridge !== undefined &&
      observedReceipt.bytes === transitionRaceBridge.successor.bytes &&
      observedReceipt.sha256 === transitionRaceBridge.successor.sha256;
    if (!historicalMatch && !successorMatch && !transitionRaceMatch) {
      fail("DISTRIBUTION_DRIFT", "A reviewed M07-T08 distribution receipt drifted.", {
        path: `${APP_DIRECTORY}/dist/${relativePath}`,
      });
    }
    if (historicalMatch && !successorMatch) historicalState = true;
    if ((successorMatch || transitionRaceMatch) && !historicalMatch) successorState = true;
    if (transitionRaceBridge !== undefined) {
      const transitionHistoricalMatch =
        observedReceipt.bytes === transitionRaceBridge.historical.bytes &&
        observedReceipt.sha256 === transitionRaceBridge.historical.sha256;
      if (transitionHistoricalMatch && !transitionRaceMatch) transitionRaceHistoricalState = true;
      if (transitionRaceMatch && !transitionHistoricalMatch) transitionRaceSuccessorState = true;
    }
    if (M07_T08_ACTIVATION_DISTRIBUTION_RECEIPT_BRIDGE[relativePath] !== undefined) {
      receipts.push(
        Object.freeze({
          path: `${APP_DIRECTORY}/dist/${relativePath}`,
          bytes: bridge.historical.bytes,
          sha256: bridge.historical.sha256,
        }),
      );
    }
  }
  if (historicalState && successorState) {
    fail("DISTRIBUTION_DRIFT", "The reviewed M07-T08 activation/index distribution is incoherent.");
  }
  if (transitionRaceHistoricalState && transitionRaceSuccessorState) {
    fail("DISTRIBUTION_DRIFT", "The reviewed M07-T10 activation distribution is incoherent.");
  }
  return deepFreeze(receipts);
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
      ].map((relativePath) => authorityBytes(relativePath, overrides)),
    );
  const app = parseJsonBytes(appBytes, APP_PACKAGE);
  const rootPackage = parseJsonBytes(rootBytes, ROOT_PACKAGE);
  const adrReceipt = Object.freeze({ bytes: adrBytes.byteLength, sha256: sha256(adrBytes) });
  const approvedAdrReceipts = [
    M07_T08_TRACKED_RECEIPT_BRIDGE[ADR].historical,
    M07_T08_TRACKED_RECEIPT_BRIDGE[ADR].successor,
    M07_T10_TRACKED_RECEIPT_BRIDGE[ADR].successor,
  ];
  if (
    app.name !== "@desen/control-plane-api" ||
    app.scripts?.["test:runtime-activation"] !== "vitest run test/runtime-activation.test.ts" ||
    app.dependencies?.["better-sqlite3"] !== "13.0.3" ||
    app.exports?.["."]?.import !== "./dist/index.js" ||
    app.exports?.["."]?.types !== "./dist/index.d.ts" ||
    !approvedAdrReceipts.some(
      (receipt) => receipt.bytes === adrReceipt.bytes && receipt.sha256 === adrReceipt.sha256,
    )
  ) {
    fail("REGISTRATION_DRIFT", "The exact M07-T07 application registration drifted.");
  }
  const rootScripts = {
    generate: rootPackage.scripts?.["generate:control-plane-runtime-activation"],
    verify: rootPackage.scripts?.["verify:control-plane-runtime-activation"],
    test: rootPackage.scripts?.["test:control-plane-runtime-activation"],
  };
  if (JSON.stringify(rootScripts) !== JSON.stringify(ROOT_SCRIPT_COMMANDS)) {
    fail("REGISTRATION_DRIFT", "The exact M07-T07 root commands drifted.");
  }
  assertAdjacent(
    rootPackage.scripts?.check,
    "pnpm verify:control-plane-runtime-staging",
    "pnpm verify:control-plane-runtime-activation",
    "pnpm verify:control-plane-runtime-recovery",
    "pnpm verify:control-plane-runtime-fault-injection",
    "pnpm verify:control-plane-runtime-transition-races",
    "pnpm verify:reference-host-web-channel-consumption",
    "pnpm lint",
  );
  assertAdjacent(
    rootPackage.scripts?.test,
    "pnpm test:control-plane-runtime-staging",
    "pnpm test:control-plane-runtime-activation",
    "pnpm test:control-plane-runtime-recovery",
    "pnpm test:control-plane-runtime-fault-injection",
    "pnpm test:control-plane-runtime-transition-races",
    "pnpm test:reference-host-web-channel-consumption",
    "turbo run test",
  );
  if (
    exactTupleCount(fatalText(ciBytes, CI_SOURCE), CI_TUPLE) !== 1 ||
    exactTupleCount(fatalText(inventoryBytes, CI_INVENTORY), CI_TUPLE) !== 1
  ) {
    fail("REGISTRATION_DRIFT", "The exact M07-T07 modular-CI tuple drifted.");
  }
  const sharedState = fatalText(sharedStateBytes, SHARED_STATE_AUTHORITY);
  const exactArrayMember = (declaration, member) => {
    const start = sharedState.indexOf(declaration);
    const end = sharedState.indexOf("]);", start);
    if (start < 0 || end < 0) return false;
    const block = sharedState.slice(start, end);
    return block.split(JSON.stringify(member)).length - 1 === 1;
  };
  if (
    !sharedState.includes(
      'CONTROL_PLANE_RUNTIME_ACTIVATION_SQLITE: "CONTROL_PLANE_RUNTIME_ACTIVATION_SQLITE"',
    ) ||
    !/"control-plane-runtime-activation":\s*NATIVE_ADDON_POLICIES\.CONTROL_PLANE_RUNTIME_ACTIVATION_SQLITE/u.test(
      sharedState,
    ) ||
    !/"test-control-plane-runtime-activation":\s*NATIVE_ADDON_POLICIES\.CONTROL_PLANE_RUNTIME_ACTIVATION_SQLITE/u.test(
      sharedState,
    ) ||
    !exactArrayMember(
      "export const CHILD_PROCESS_VERIFIER_PROOF_IDS = Object.freeze([",
      "control-plane-runtime-activation",
    ) ||
    !exactArrayMember(
      "export const NATIVE_ADDON_PROOF_IDS = Object.freeze([",
      "control-plane-runtime-activation",
    ) ||
    !exactArrayMember(
      "export const NATIVE_ADDON_ROOT_STEP_IDS = Object.freeze([",
      "test-control-plane-runtime-activation",
    )
  ) {
    fail("REGISTRATION_DRIFT", "The exact child/native shared-state authority drifted.");
  }
  return deepFreeze({
    applicationScript: app.scripts["test:runtime-activation"],
    rootScripts,
    aggregateImmediatePredecessor: "control-plane-runtime-staging",
    aggregateImmediateSuccessors: { check: "lint", test: "turbo run test" },
    ciTuple: CI_TUPLE,
    ciTupleExactInRunnerAndInventory: true,
    verifierChildProcessAuthority: true,
    nativeAddonAuthority: "CONTROL_PLANE_RUNTIME_ACTIVATION_SQLITE",
    publicExports: publicExportInventory(fatalText(indexBytes, APP_INDEX)),
  });
}

function collectTraceRows(value, found = []) {
  if (Array.isArray(value)) {
    for (const child of value) collectTraceRows(child, found);
  } else if (value !== null && typeof value === "object") {
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
    rows.some((row, index) => row.id !== TRACE_IDS[index] || !row.owners?.includes("M07-T07"))
  ) {
    fail("TRACEABILITY_DRIFT", "The exact M07-T07 trace-owner authority drifted.");
  }
  return deepFreeze(copyInertJson(rows, "traceRows"));
}

function markdownTableRow(source, id, label) {
  const lines = source.split("\n");
  const matching = lines.filter((line) => line.startsWith(`| ${id} |`));
  if (matching.length !== 1) fail("COVERAGE_DRIFT", `The ${label} row is not unique.`);
  return matching[0];
}

function findingStatus(source, id) {
  const heading = `## ${id} —`;
  const start = source.indexOf(heading);
  const next = source.indexOf("\n## ", start + heading.length);
  if (start < 0) fail("COVERAGE_DRIFT", `${id} is absent.`);
  const section = source.slice(start, next < 0 ? source.length : next);
  const statuses = [...section.matchAll(/^- Status: (.+)$/gmu)].map((match) => match[1]);
  if (statuses.length !== 1) fail("COVERAGE_DRIFT", `${id} status is not unique.`);
  return { status: statuses[0], section };
}

async function coverageProjection(overrides) {
  const [normative, matrix, findings] = await Promise.all(
    [NORMATIVE_COVERAGE, PROOF_MATRIX, FINDINGS].map(async (relativePath) =>
      fatalText(await authorityBytes(relativePath, overrides), relativePath),
    ),
  );
  const n004 = markdownTableRow(normative, "N-004", "N-004");
  const n038 = markdownTableRow(normative, "N-038", "N-038");
  const n041 = markdownTableRow(normative, "N-041", "N-041");
  const p12 = markdownTableRow(matrix, "P-12", "P-12");
  const pf075 = findingStatus(findings, "PF-075");
  const pf076 = findingStatus(findings, "PF-076");
  const historicalN004 = /\| PLANNED\s+\|/u.test(n004);
  const approvedM07T09N004 =
    /\| TESTED\s+\|/u.test(n004) &&
    Buffer.byteLength(n004, "utf8") === M07_T09_N004_SUCCESSOR_RECEIPT.bytes &&
    sha256(Buffer.from(n004, "utf8")) === M07_T09_N004_SUCCESSOR_RECEIPT.sha256;
  const approvedM07T10N038 =
    /\| TESTED\s+\|/u.test(n038) &&
    Buffer.byteLength(n038, "utf8") === M07_T10_N038_SUCCESSOR_RECEIPT.bytes &&
    sha256(Buffer.from(n038, "utf8")) === M07_T10_N038_SUCCESSOR_RECEIPT.sha256;
  if (
    (!historicalN004 && !approvedM07T09N004) ||
    (!/\| PLANNED\s+\|/u.test(n038) && !approvedM07T10N038) ||
    !/\| PLANNED\s+\|/u.test(n041) ||
    !/\| NOT_PROVEN\s+\|/u.test(p12) ||
    pf075.status !== "OPEN" ||
    pf076.status !== "OPEN" ||
    !pf075.section.includes("one-shot") ||
    !pf075.section.includes("do not consume") ||
    !pf076.section.includes("runtime-activation.sqlite3") ||
    !pf076.section.includes("recovery-required")
  ) {
    fail("COVERAGE_DRIFT", "The exact M07-T07 coverage truth drifted.");
  }
  return deepFreeze({
    proofMatrixP12: "NOT_PROVEN",
    normativeN004: "PLANNED",
    normativeN004Contribution:
      "M07-T07 proves one exact preflight-joined, complete-Bundle-reclosed atomic record transition; M07-T09 still owns every precommit fault boundary before N-004 can advance.",
    normativeN038: "PLANNED",
    normativeN041: "PLANNED",
    findingPF075: "OPEN",
    findingPF076: "OPEN",
  });
}

async function packageTestProjection(overrides) {
  const [runtimeBytes, typeBytes, rootBytes] = await Promise.all(
    [APP_RUNTIME_TEST, APP_TYPE_TEST, ROOT_TEST].map((relativePath) =>
      authorityBytes(relativePath, overrides),
    ),
  );
  const runtimeNames = registeredTestNames(
    fatalText(runtimeBytes, APP_RUNTIME_TEST),
    APP_RUNTIME_TEST,
    ["it", "test"],
  );
  const typeCases = compilerNegativeCases(fatalText(typeBytes, APP_TYPE_TEST), APP_TYPE_TEST);
  const rootNames = registeredTestNames(fatalText(rootBytes, ROOT_TEST), ROOT_TEST, ["test"]);
  const historicalRuntimeTests =
    JSON.stringify(runtimeNames) === JSON.stringify(EXPECTED_RUNTIME_TEST_NAMES);
  const approvedCurrentRuntimeTests =
    JSON.stringify(runtimeNames) === JSON.stringify(M07_T08_RUNTIME_TEST_NAMES);
  if (
    (!historicalRuntimeTests && !approvedCurrentRuntimeTests) ||
    JSON.stringify(typeCases) !== JSON.stringify(EXPECTED_TYPE_NEGATIVE_CLAIMS) ||
    JSON.stringify(rootNames) !== JSON.stringify(EXPECTED_ROOT_TEST_NAMES)
  ) {
    fail("TEST_AUTHORITY_DRIFT", "The exact M07-T07 focused or mutation tests drifted.");
  }
  return deepFreeze({
    packageRuntimeCases: EXPECTED_RUNTIME_TEST_NAMES.length,
    packageRuntimeCaseNames: EXPECTED_RUNTIME_TEST_NAMES,
    compileTimeNegativeCases: typeCases.length,
    compileTimeNegativeClaims: typeCases,
    rootMutationCases: rootNames.length,
    rootMutationCaseNames: rootNames,
  });
}

function assertRequiredAuthorities(sourceByPath, authorities) {
  for (const [relativePath, fragments] of Object.entries(authorities)) {
    const source = sourceByPath[relativePath];
    for (const fragment of fragments) {
      if (!source.includes(fragment)) {
        fail("IMPLEMENTATION_DRIFT", `A required M07-T07 authority drifted in ${relativePath}.`);
      }
    }
  }
}

function tsdocProjection(sourceByPath) {
  const documented = [];
  for (const relativePath of [APP_CONTRACT, APP_FACTORY]) {
    const sourceFile = parseTypescript(sourceByPath[relativePath], relativePath, "PLATFORM_DRIFT");
    for (const statement of sourceFile.statements) {
      if (!statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
        continue;
      }
      const name =
        statement.name?.text ?? statement.declarationList?.declarations?.[0]?.name?.text ?? null;
      if (name === null || ts.getJSDocCommentsAndTags(statement).length === 0) {
        fail("PLATFORM_DRIFT", `A public M07-T07 export lacks TSDoc in ${relativePath}.`);
      }
      documented.push(name);
    }
  }
  documented.sort();
  if (
    JSON.stringify(documented) !== JSON.stringify(M07_T07_DOCUMENTED_ACTIVATION_SOURCE_EXPORTS) &&
    JSON.stringify(documented) !== JSON.stringify(M07_T08_DOCUMENTED_ACTIVATION_SOURCE_EXPORTS)
  ) {
    fail("PLATFORM_DRIFT", "The exact M07-T07 documented public surface drifted.");
  }
  return M07_T07_DOCUMENTED_ACTIVATION_SOURCE_EXPORTS;
}

async function implementationProjection(overrides) {
  const paths = [
    APP_CONTRACT,
    APP_INTERNAL,
    APP_REPOSITORY,
    APP_SQLITE,
    APP_FACTORY,
    APP_STAGING_INTERNAL,
  ];
  const sourceByPath = Object.fromEntries(
    await Promise.all(
      paths.map(async (relativePath) => [
        relativePath,
        fatalText(await authorityBytes(relativePath, overrides), relativePath),
      ]),
    ),
  );
  if (
    paths.some((relativePath) => explicitAnyCount(sourceByPath[relativePath], relativePath) > 0)
  ) {
    fail("IMPLEMENTATION_DRIFT", "M07-T07 contains explicit any authority.");
  }
  assertRequiredAuthorities(sourceByPath, {
    [APP_CONTRACT]: [
      'readonly status: "activated";',
      'readonly status: "precondition-failed";',
      'readonly status: "generation-exhausted";',
      'readonly status: "recovery-required";',
      "readonly activeRevision: string;",
      "readonly previousGoodRevision: string | null;",
      "readonly generation: number;",
      "referenceAuthority: BundleReferencePreflightAuthority",
      "stagingAuthority: BundleRuntimeStagingAuthority",
      "expectedGeneration: number | null",
    ],
    [APP_INTERNAL]: [
      "referenceRecord.packageAuthority !== observedStagingRecord.packageAuthority",
      "referenceRecord.packageRecord !== observedStagingRecord.packageRecord",
      'Object.hasOwn(value, "expectedGeneration")',
      "consumeBundleRuntimeStagingAuthority(stagingAuthority)",
      "await options.bundleStore.getBundle(revision)",
      'Object.freeze({ status: "not-available" })',
      "canonicalizeJson(attempt.referenceRecord.bundle)",
      "canonicalizeJson(attempt.stagingRecord.bundle)",
      "const authenticatedCurrent =",
      "attempt.expectedGeneration,\n      authenticatedCurrent,\n      revision,",
      'if (!canCommit()) return Object.freeze({ status: "recovery-required" });',
      'result.status === "recovery-required" && recoveryRecord === undefined',
      'if (inFlight) return Promise.reject(new RuntimeActivationError("ACTIVATION_BUSY"))',
      "enterRecovery(null)",
      'return Object.freeze({ status: "recovery-required", record: null });',
      "revokeCurrent();",
      "function readBundleStoreErrorCode(error: unknown)",
      "if (!(error instanceof BundleStoreError)) return undefined;",
      "function mapBundleStoreOperationalError",
      "if (operational !== undefined) throw operational;",
      "readRuntimeActivationStorageErrorCode(error)",
    ],
    [APP_REPOSITORY]: [
      "const MAX_GENERATION = Number.MAX_SAFE_INTEGER;",
      "const STORAGE_ERRORS = new WeakSet<object>();",
      "STORAGE_ERRORS.add(this);",
      "export function readRuntimeActivationStorageErrorCode",
      'Object.getOwnPropertyDescriptor(error, "code")',
      "current.activeRevision === candidateRevision",
      "current.previousGoodRevision",
      "current.activeRevision",
      "current.generation + 1",
      "current?.generation === MAX_GENERATION",
      "!sameRecord(current, capturedAuthenticatedCurrent)",
      'status: "precondition-failed" as const',
      'status: "generation-exhausted" as const',
    ],
    [APP_SQLITE]: [
      'import Database from "better-sqlite3";',
      'const DATABASE_SIDECAR_SUFFIXES = Object.freeze(["-journal", "-shm", "-wal"] as const);',
      '") STRICT"',
      'database.pragma("journal_mode = WAL")',
      'database.pragma("synchronous = FULL")',
      'database.pragma("trusted_schema = OFF")',
      'openDatabase.exec("BEGIN IMMEDIATE")',
      'pragmaInteger(database, "user_version") !== SCHEMA_VERSION',
      "!sameRecord(current, capturedAuthenticatedCurrent)",
      "hooks.beforeCommit?.()",
      "hooks.afterCommit?.()",
      'hooks.afterPrepareStatement?.("read")',
      'hooks.afterPrepareStatement?.("insert")',
      'hooks.afterPrepareStatement?.("update")',
      'return Object.freeze({ status: "recovery-required" })',
      "assertStorageIdentity(storage.path, storage.identity)",
    ],
    [APP_FACTORY]: [
      'const ACTIVATION_DATABASE_FILE_NAME = "runtime-activation.sqlite3";',
      'await import("./runtime-activation-sqlite-internal.js")',
      "path.join(canonicalRoot, ACTIVATION_DATABASE_FILE_NAME)",
      "openBundleStore({ rootDirectory: canonicalRoot })",
      "createOwnedBundleRuntimeActivationInternal(bundleStore, repository)",
    ],
    [APP_STAGING_INTERNAL]: [
      "export function consumeBundleRuntimeStagingAuthority",
      "AUTHORITIES.delete(stagingAuthority)",
    ],
  });
  const internal = sourceByPath[APP_INTERNAL];
  const repository = sourceByPath[APP_REPOSITORY];
  const sqlite = sourceByPath[APP_SQLITE];
  const repositoryCas = repository.indexOf("(current === null && expectedGeneration !== null)");
  const repositoryBaseline = repository.indexOf(
    "!sameRecord(current, capturedAuthenticatedCurrent)",
    repositoryCas,
  );
  const sqliteWriter = sqlite.indexOf('openDatabase.exec("BEGIN IMMEDIATE")');
  const sqliteReader = sqlite.indexOf('openDatabase.exec("BEGIN");');
  const sqliteReaderProfile = sqlite.indexOf("assertConnectionProfile(openDatabase)", sqliteReader);
  const sqliteReaderSchema = sqlite.indexOf("assertExactSchema(openDatabase)", sqliteReader);
  const sqliteWriterProfile = sqlite.indexOf("assertConnectionProfile(openDatabase)", sqliteWriter);
  const sqliteSchemaReauthentication = sqlite.indexOf(
    "assertExactSchema(openDatabase)",
    sqliteWriter,
  );
  const sqliteRead = sqlite.indexOf("const current = readCurrent();", sqliteWriter);
  const sqliteAfterCommit = sqlite.indexOf("hooks.afterCommit?.()", sqliteWriter);
  const sqlitePostCommitProfile = sqlite.indexOf(
    "assertConnectionProfile(openDatabase)",
    sqliteAfterCommit,
  );
  const sqlitePostCommitSchema = sqlite.indexOf(
    "assertExactSchema(openDatabase)",
    sqliteAfterCommit,
  );
  const sqliteProfileCallCount = sqlite.split("assertConnectionProfile(openDatabase)").length - 1;
  const historicalProfileAuthority = sqliteProfileCallCount === 0;
  const transitionRaceProfileAuthority =
    sqliteProfileCallCount === 3 &&
    sqliteReaderProfile > sqliteReader &&
    sqliteReaderSchema > sqliteReaderProfile &&
    sqliteWriterProfile > sqliteWriter &&
    sqliteSchemaReauthentication > sqliteWriterProfile &&
    sqlitePostCommitProfile > sqliteAfterCommit &&
    sqlitePostCommitSchema > sqlitePostCommitProfile;
  const sqliteCas = sqlite.indexOf("(current === null && expectedGeneration !== null)", sqliteRead);
  const sqliteBaseline = sqlite.indexOf(
    "!sameRecord(current, capturedAuthenticatedCurrent)",
    sqliteCas,
  );
  const livenessGuard = internal.indexOf("if (!canCommit())");
  const durableCommit = internal.indexOf("const committed = options.repository.commit(");
  if (
    internal.indexOf("consumeBundleRuntimeStagingAuthority(stagingAuthority)") >
      internal.indexOf("await options.bundleStore.getBundle(revision)") ||
    repositoryCas < 0 ||
    repositoryBaseline <= repositoryCas ||
    sqliteWriter < 0 ||
    (!historicalProfileAuthority && !transitionRaceProfileAuthority) ||
    sqliteSchemaReauthentication <= sqliteWriter ||
    sqliteRead <= sqliteSchemaReauthentication ||
    sqliteCas <= sqliteRead ||
    sqliteBaseline <= sqliteCas ||
    livenessGuard < 0 ||
    durableCommit <= livenessGuard ||
    [APP_CONTRACT, APP_INTERNAL, APP_REPOSITORY, APP_FACTORY, APP_STAGING_INTERNAL].some(
      (relativePath) => sourceByPath[relativePath].includes('from "better-sqlite3"'),
    ) ||
    sourceByPath[APP_FACTORY].includes('import Database from "better-sqlite3";')
  ) {
    fail("IMPLEMENTATION_DRIFT", "The one-shot-before-await or lazy-native boundary drifted.");
  }
  return deepFreeze({
    authorityJoin:
      "exact shared T03 packageAuthority and packageRecord identity, then one-shot T06 consume",
    bundleReclosure: "same-root immutable T01 read plus complete canonical T02 integrity reclosure",
    repository:
      "caller supplies expected generation while the controller supplies its authenticated complete baseline; repository derives one complete successor record",
    transitions: {
      firstGeneration: 0,
      differentRevisionPreservesCurrentAsPreviousGood: true,
      sameRevisionAdvancesAndPreservesPreviousGood: true,
      stalePresenceMismatchAndExhaustionWriteNothing: true,
      authenticatedBaselineDriftRequiresRecovery: true,
    },
    sqlite: {
      fileName: "runtime-activation.sqlite3",
      schemaVersion: 1,
      strictSingletonRow: true,
      journalMode: "WAL",
      synchronous: "FULL",
      trustedSchema: false,
      busyTimeoutMilliseconds: 5_000,
      immediateCas: true,
      liveSchemaReauthenticatedUnderWriterLock: true,
      parentDatabaseAndSidecarsRevalidated: true,
      precommitRollback: true,
      indeterminateCommitRevokesRepository: true,
    },
    nativeSqliteImportLazy: true,
    hostileStorageErrorsAuthenticatedWithoutAccessors: true,
    operationalBundleStoreFailuresPropagateAsRedactedRuntimeErrors: true,
    failedControllerInitializationClosesOwnedRepository: true,
    explicitAnyTypes: 0,
    documentedActivationSourceExports: tsdocProjection(sourceByPath),
  });
}

async function listCatalogArtifacts() {
  const root = path.join(ROOT, CATALOG_DISTRIBUTION);
  const paths = [];
  const visit = async (relative) => {
    const entries = await readdir(path.join(root, relative), { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const child = path.posix.join(relative, entry.name);
      if (entry.isSymbolicLink()) fail("UNSAFE_AUTHORITY", "Catalog distribution is symlinked.");
      if (entry.isDirectory()) await visit(child);
      else if (entry.isFile()) paths.push(child);
      else fail("UNSAFE_AUTHORITY", "Catalog distribution contains a special entry.");
    }
  };
  await visit("");
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
  return record === null
    ? null
    : {
        activeRevision: record.activeRevision,
        previousGoodRevision: record.previousGoodRevision,
        generation: record.generation,
      };
}

function rejectionReceipt(result) {
  return {
    status: result.status,
    stage: result.stage,
    codes: Array.isArray(result.diagnostics) ? result.diagnostics.map(({ code }) => code) : [],
    frozen: Object.isFrozen(result),
    authorityAbsent: !Object.hasOwn(result, "authority"),
  };
}

function runtimeErrorCode(error) {
  return error !== null && typeof error === "object" && typeof error.code === "string"
    ? error.code
    : null;
}

/** Runs the bounded native M07-T07 child probe against the built package. */
export async function runControlPlaneRuntimeActivationProbeInCurrentProcess(controlPlane) {
  const temporaryDirectories = [];
  const services = new Set();
  const repositories = new Set();
  const makeRoot = async (prefix) => {
    const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), prefix)));
    temporaryDirectories.push(directory);
    return directory;
  };
  try {
    const [
      packageInternal,
      referenceInternal,
      stagingInternal,
      activationInternal,
      repositoryInternal,
      sqliteInternal,
      protocol,
      bundleBytes,
      catalogBytes,
      artifacts,
    ] = await Promise.all([
      import(
        pathToFileURL(path.join(ROOT, APP_DIRECTORY, "dist/package-preflight-internal.js")).href
      ),
      import(
        pathToFileURL(path.join(ROOT, APP_DIRECTORY, "dist/reference-preflight-internal.js")).href
      ),
      import(
        pathToFileURL(path.join(ROOT, APP_DIRECTORY, "dist/runtime-staging-internal.js")).href
      ),
      import(
        pathToFileURL(path.join(ROOT, APP_DIRECTORY, "dist/runtime-activation-internal.js")).href
      ),
      import(
        pathToFileURL(
          path.join(ROOT, APP_DIRECTORY, "dist/runtime-activation-repository-internal.js"),
        ).href
      ),
      import(
        pathToFileURL(path.join(ROOT, APP_DIRECTORY, "dist/runtime-activation-sqlite-internal.js"))
          .href
      ),
      import(pathToFileURL(path.join(ROOT, "packages/protocol/dist/index.js")).href),
      safeReadAbsolute(path.join(ROOT, BUNDLE_FIXTURE)),
      safeReadAbsolute(path.join(ROOT, CATALOG_FIXTURE)),
      listCatalogArtifacts(),
    ]);
    const bundle = parseJsonBytes(bundleBytes, BUNDLE_FIXTURE);
    const catalog = parseJsonBytes(catalogBytes, CATALOG_FIXTURE);
    const canonicalBundleBytes = protocol.canonicalizeJsonBytes(bundle);
    if (bundle.revision !== EXPECTED_REVISION) {
      fail("RUNTIME_PROBE_MISMATCH", "The fixed activation Bundle revision drifted.");
    }

    const lineage = () => {
      const integrity = controlPlane.verifyBundleStoreEntry(
        { revision: bundle.revision, bytes: canonicalBundleBytes },
        Object.freeze({ status: "not-available" }),
      );
      const integrityAuthority = requireAuthority(integrity, "verified", "Integrity");
      const packages = controlPlane.preflightBundlePackages(integrityAuthority, [
        Object.freeze({
          id: catalog.id,
          version: catalog.version,
          target: catalog.target,
          catalog,
          artifacts,
        }),
      ]);
      const packageAuthority = requireAuthority(packages, "preflighted", "Package preflight");
      const reference = controlPlane.preflightBundleReferences(packageAuthority);
      const referenceAuthority = requireAuthority(reference, "preflighted", "Reference preflight");
      const staging = controlPlane.stageBundleRuntime(packageAuthority);
      const stagingAuthority = requireAuthority(staging, "staged", "Runtime staging");
      const packageRecord = packageInternal.readBundlePackagePreflightAuthority(packageAuthority);
      const referenceRecord =
        referenceInternal.readBundleReferencePreflightAuthority(referenceAuthority);
      const stagingRecord = stagingInternal.readBundleRuntimeStagingAuthority(stagingAuthority);
      if (
        packageRecord === undefined ||
        referenceRecord === undefined ||
        stagingRecord === undefined
      ) {
        fail("RUNTIME_PROBE_MISMATCH", "A private activation predecessor is absent.");
      }
      return {
        packageAuthority,
        packageRecord,
        referenceAuthority,
        referenceRecord,
        stagingAuthority,
        stagingRecord,
      };
    };

    const rootDirectory = await makeRoot("desen-m07-t07-public-");
    const bundleStore = await controlPlane.openBundleStore({ rootDirectory });
    const stored = await bundleStore.putBundle({
      revision: bundle.revision,
      bytes: canonicalBundleBytes,
    });
    const service = await controlPlane.openBundleRuntimeActivation({ rootDirectory });
    services.add(service);
    const beforeState = service.readState();
    const firstLineage = lineage();
    const first = await service.activate(
      firstLineage.referenceAuthority,
      firstLineage.stagingAuthority,
      null,
    );
    const firstAuthority = requireAuthority(first, "activated", "First activation");
    const firstPrivate = activationInternal.readBundleRuntimeActivationAuthority(firstAuthority);
    const activeState = service.readState();
    if (firstPrivate === undefined || activeState.status !== "active") {
      fail("RUNTIME_PROBE_MISMATCH", "The committed activation authority is absent.");
    }
    const secondStaging = controlPlane.stageBundleRuntime(firstLineage.packageAuthority);
    const secondStagingAuthority = requireAuthority(secondStaging, "staged", "Same revision stage");
    const secondStagingRecord =
      stagingInternal.readBundleRuntimeStagingAuthority(secondStagingAuthority);
    const second = await service.activate(
      firstLineage.referenceAuthority,
      secondStagingAuthority,
      0,
    );
    const secondAuthority = requireAuthority(second, "activated", "Same revision activation");
    const secondPrivate = activationInternal.readBundleRuntimeActivationAuthority(secondAuthority);
    if (secondStagingRecord === undefined || secondPrivate === undefined) {
      fail("RUNTIME_PROBE_MISMATCH", "The second activation authority is absent.");
    }
    const secondCurrentBeforeClose =
      activationInternal.readBundleRuntimeActivationAuthority(secondAuthority) === secondPrivate;

    const mismatchLeft = lineage();
    const mismatchRight = lineage();
    const mismatch = await service.activate(
      mismatchLeft.referenceAuthority,
      mismatchRight.stagingAuthority,
      1,
    );
    const mismatchStillStaged =
      stagingInternal.readBundleRuntimeStagingAuthority(mismatchRight.stagingAuthority) ===
      mismatchRight.stagingRecord;

    const busyLineage = lineage();
    const busySecondStage = controlPlane.stageBundleRuntime(busyLineage.packageAuthority);
    const busySecondAuthority = requireAuthority(busySecondStage, "staged", "Busy second stage");
    const busySecondRecord = stagingInternal.readBundleRuntimeStagingAuthority(busySecondAuthority);
    let releaseRead;
    const waitingStore = {
      getBundle: () =>
        new Promise((resolve) => {
          releaseRead = resolve;
        }),
      putBundle: async () => Object.freeze({ status: "unchanged" }),
    };
    const busyRepository = repositoryInternal.createInMemoryRuntimeActivationRepository();
    repositories.add(busyRepository);
    const busyController = activationInternal.createBundleRuntimeActivationInternal({
      bundleStore: waitingStore,
      repository: busyRepository,
    });
    services.add(busyController);
    const busyWinnerPromise = busyController.activate(
      busyLineage.referenceAuthority,
      busyLineage.stagingAuthority,
      null,
    );
    let busyLoserCode = null;
    try {
      await busyController.activate(busyLineage.referenceAuthority, busySecondAuthority, null);
    } catch (error) {
      busyLoserCode = runtimeErrorCode(error);
    }
    const busyLoserStillStaged =
      stagingInternal.readBundleRuntimeStagingAuthority(busySecondAuthority) === busySecondRecord;
    releaseRead(
      Object.freeze({
        status: "found",
        entry: Object.freeze({ revision: bundle.revision, bytes: canonicalBundleBytes }),
      }),
    );
    const busyWinner = await busyWinnerPromise;

    const missingLineage = lineage();
    const missingRepository = repositoryInternal.createInMemoryRuntimeActivationRepository();
    repositories.add(missingRepository);
    const missingController = activationInternal.createBundleRuntimeActivationInternal({
      bundleStore: {
        getBundle: async () => Object.freeze({ status: "missing" }),
        putBundle: async () => Object.freeze({ status: "unchanged" }),
      },
      repository: missingRepository,
    });
    services.add(missingController);
    const missing = await missingController.activate(
      missingLineage.referenceAuthority,
      missingLineage.stagingAuthority,
      null,
    );
    const missingConsumed =
      stagingInternal.readBundleRuntimeStagingAuthority(missingLineage.stagingAuthority) ===
      undefined;
    const missingDurable = missingRepository.get();

    const vanishingLineage = lineage();
    const vanishingInnerRepository = repositoryInternal.createInMemoryRuntimeActivationRepository();
    let durableRecordVanished = false;
    const vanishingRepository = Object.freeze({
      get: () =>
        durableRecordVanished
          ? Object.freeze({ status: "missing" })
          : vanishingInnerRepository.get(),
      commit: (expectedGeneration, authenticatedCurrent, candidateRevision) =>
        vanishingInnerRepository.commit(
          expectedGeneration,
          authenticatedCurrent,
          candidateRevision,
        ),
      close: () => vanishingInnerRepository.close(),
    });
    repositories.add(vanishingRepository);
    const vanishingController = activationInternal.createBundleRuntimeActivationInternal({
      bundleStore: {
        getBundle: async () =>
          Object.freeze({
            status: "found",
            entry: Object.freeze({ revision: bundle.revision, bytes: canonicalBundleBytes }),
          }),
        putBundle: async () => Object.freeze({ status: "unchanged" }),
      },
      repository: vanishingRepository,
    });
    services.add(vanishingController);
    const vanishingFirst = await vanishingController.activate(
      vanishingLineage.referenceAuthority,
      vanishingLineage.stagingAuthority,
      null,
    );
    const vanishingAuthority = requireAuthority(
      vanishingFirst,
      "activated",
      "Vanishing-record activation",
    );
    durableRecordVanished = true;
    const vanishedState = vanishingController.readState();
    const blockedAfterVanish = lineage();
    const vanishedActivation = await vanishingController.activate(
      blockedAfterVanish.referenceAuthority,
      blockedAfterVanish.stagingAuthority,
      null,
    );
    const vanishedCandidateStillStaged =
      stagingInternal.readBundleRuntimeStagingAuthority(blockedAfterVanish.stagingAuthority) ===
      blockedAfterVanish.stagingRecord;
    const vanishedAuthorityRevoked =
      activationInternal.readBundleRuntimeActivationAuthority(vanishingAuthority) === undefined;

    const transitionRepository = repositoryInternal.createInMemoryRuntimeActivationRepository();
    repositories.add(transitionRepository);
    const transitionA = transitionRepository.commit(null, null, REVISION_A);
    const transitionB = transitionRepository.commit(0, transitionA.record, REVISION_B);
    const transitionSameB = transitionRepository.commit(1, transitionB.record, REVISION_B);
    const transitionBackA = transitionRepository.commit(2, transitionSameB.record, REVISION_A);
    const beforeStale = transitionRepository.get();
    const stale = transitionRepository.commit(1, transitionBackA.record, REVISION_B);
    const afterStale = transitionRepository.get();
    const exhaustedRepository = repositoryInternal.createInMemoryRuntimeActivationRepository({
      initialRecord: Object.freeze({
        activeRevision: REVISION_A,
        previousGoodRevision: REVISION_B,
        generation: Number.MAX_SAFE_INTEGER,
      }),
    });
    repositories.add(exhaustedRepository);
    const exhaustedBefore = exhaustedRepository.get();
    const exhausted = exhaustedRepository.commit(
      Number.MAX_SAFE_INTEGER,
      exhaustedBefore.record,
      REVISION_B,
    );
    const exhaustedAfter = exhaustedRepository.get();

    const rollbackPath = path.join(rootDirectory, "rollback-activation.sqlite3");
    const rollbackRepository = sqliteInternal.openRuntimeActivationSqliteRepository(rollbackPath, {
      beforeCommit() {
        throw new Error("proof precommit fault");
      },
    });
    repositories.add(rollbackRepository);
    let rollbackCode = null;
    try {
      rollbackRepository.commit(null, null, REVISION_A);
    } catch (error) {
      rollbackCode = runtimeErrorCode(error);
    }
    const rollbackCurrent = rollbackRepository.get();
    rollbackRepository.close();
    repositories.delete(rollbackRepository);

    const statementFailurePath = path.join(rootDirectory, "statement-failure-activation.sqlite3");
    const preparedBeforeFailure = [];
    let statementFailureCode = null;
    try {
      sqliteInternal.openRuntimeActivationSqliteRepository(statementFailurePath, {
        afterPrepareStatement(statement) {
          preparedBeforeFailure.push(statement);
          if (statement === "read") throw new Error("proof statement-acquisition fault");
        },
      });
    } catch (error) {
      statementFailureCode = runtimeErrorCode(error);
    }
    const statementRecoveryRepository =
      sqliteInternal.openRuntimeActivationSqliteRepository(statementFailurePath);
    repositories.add(statementRecoveryRepository);
    const statementRecoveryState = statementRecoveryRepository.get();

    const indeterminatePath = path.join(rootDirectory, "indeterminate-activation.sqlite3");
    const indeterminateRepository = sqliteInternal.openRuntimeActivationSqliteRepository(
      indeterminatePath,
      {
        afterCommit() {
          throw new Error("proof postcommit fault");
        },
      },
    );
    const indeterminate = indeterminateRepository.commit(null, null, REVISION_A);
    let revokedCode = null;
    try {
      indeterminateRepository.get();
    } catch (error) {
      revokedCode = runtimeErrorCode(error);
    }
    const recoveredRepository =
      sqliteInternal.openRuntimeActivationSqliteRepository(indeterminatePath);
    repositories.add(recoveredRepository);
    const recoveredRecord = recoveredRepository.get();
    const indeterminateStat = await stat(indeterminatePath);

    const unsafePath = path.join(rootDirectory, "unsafe-sidecar.sqlite3");
    await symlink(path.join(rootDirectory, "missing-sidecar-target"), `${unsafePath}-wal`);
    let unsafeSidecarCode = null;
    try {
      sqliteInternal.openRuntimeActivationSqliteRepository(unsafePath);
    } catch (error) {
      unsafeSidecarCode = runtimeErrorCode(error);
    }

    const rawRoot = await makeRoot("desen-m07-t07-raw-");
    const rawPath = path.join(rawRoot, "runtime-activation.sqlite3");
    const rawRepository = sqliteInternal.openRuntimeActivationSqliteRepository(rawPath);
    rawRepository.commit(null, null, REVISION_A);
    rawRepository.close();
    const rawService = await controlPlane.openBundleRuntimeActivation({ rootDirectory: rawRoot });
    services.add(rawService);
    const rawState = rawService.readState();

    const ExternalDatabase = createRequire(path.join(ROOT, APP_PACKAGE))("better-sqlite3");
    const directDeletionLineage = lineage();
    const directDeletionDatabase = new ExternalDatabase(
      path.join(rootDirectory, "runtime-activation.sqlite3"),
    );
    directDeletionDatabase.exec("DELETE FROM runtime_activation WHERE singleton = 1");
    directDeletionDatabase.close();
    const directDeletion = await service.activate(
      directDeletionLineage.referenceAuthority,
      directDeletionLineage.stagingAuthority,
      null,
    );
    const directDeletionCandidateConsumed =
      stagingInternal.readBundleRuntimeStagingAuthority(directDeletionLineage.stagingAuthority) ===
      undefined;
    const directDeletionAuthorityRevoked =
      activationInternal.readBundleRuntimeActivationAuthority(secondAuthority) === undefined;
    const directDeletionObserver = sqliteInternal.openRuntimeActivationSqliteRepository(
      path.join(rootDirectory, "runtime-activation.sqlite3"),
    );
    const directDeletionDurable = directDeletionObserver.get();
    directDeletionObserver.close();

    service.close();
    services.delete(service);
    const secondRevokedAfterClose =
      activationInternal.readBundleRuntimeActivationAuthority(secondAuthority) === undefined;
    let closedCode = null;
    try {
      service.readState();
    } catch (error) {
      closedCode = runtimeErrorCode(error);
    }

    return deepFreeze({
      publicModuleKeys: Object.keys(controlPlane).sort(),
      publicSurface: {
        factoryPresent: typeof controlPlane.openBundleRuntimeActivation === "function",
        privateFactoriesAbsent:
          !Object.hasOwn(controlPlane, "createBundleRuntimeActivationInternal") &&
          !Object.hasOwn(controlPlane, "openRuntimeActivationSqliteRepository") &&
          !Object.hasOwn(controlPlane, "readBundleRuntimeActivationAuthority"),
        serviceKeys: Object.keys(rawService).sort(),
        serviceFrozen: Object.isFrozen(rawService),
      },
      officialActivation: {
        storeStatus: stored.status,
        beforeState: beforeState.status,
        status: first.status,
        record: publicRecord(firstAuthority),
        authorityKeys: Object.keys(firstAuthority).sort(),
        authorityFrozen: Object.isFrozen(firstAuthority),
        exactPrivateJoin:
          firstPrivate.referenceRecord === firstLineage.referenceRecord &&
          firstPrivate.stagingRecord === firstLineage.stagingRecord &&
          firstPrivate.referenceRecord.packageAuthority ===
            firstPrivate.stagingRecord.packageAuthority &&
          firstPrivate.referenceRecord.packageRecord === firstPrivate.stagingRecord.packageRecord,
        stagedConsumed:
          stagingInternal.readBundleRuntimeStagingAuthority(firstLineage.stagingAuthority) ===
          undefined,
        canonicalReclosureExact:
          protocol.canonicalizeJson(firstPrivate.reclosedIntegrityAuthority.bundle) ===
            protocol.canonicalizeJson(bundle) &&
          firstPrivate.reclosedIntegrityAuthority.revision === bundle.revision,
        activeStateSameAuthority: activeState.authority === firstAuthority,
      },
      sameRevision: {
        status: second.status,
        record: publicRecord(secondAuthority),
        stagedConsumed:
          stagingInternal.readBundleRuntimeStagingAuthority(secondStagingAuthority) === undefined,
        stagedRecordTransferredExact: secondPrivate.stagingRecord === secondStagingRecord,
        supersededAuthorityRevoked:
          activationInternal.readBundleRuntimeActivationAuthority(firstAuthority) === undefined,
        currentAuthorityAuthenticated: secondCurrentBeforeClose,
      },
      lifetime: {
        mismatch: rejectionReceipt(mismatch),
        mismatchDidNotConsume: mismatchStillStaged,
        busyLoserCode,
        busyLoserDidNotConsume: busyLoserStillStaged,
        busyWinnerStatus: busyWinner.status,
        missingReclosure: rejectionReceipt(missing),
        missingCandidateConsumed: missingConsumed,
        missingDurableStatus: missingDurable.status,
      },
      transitions: {
        firstA: publicRecord(transitionA.record),
        aToB: publicRecord(transitionB.record),
        sameB: publicRecord(transitionSameB.record),
        bToA: publicRecord(transitionBackA.record),
        staleStatus: stale.status,
        staleCurrent: publicRecord(stale.current),
        staleNoWrite: JSON.stringify(beforeStale) === JSON.stringify(afterStale),
        exhaustedStatus: exhausted.status,
        exhaustedCurrent: publicRecord(exhausted.current),
        exhaustedNoWrite: JSON.stringify(exhaustedBefore) === JSON.stringify(exhaustedAfter),
      },
      durability: {
        precommitFailureCode: rollbackCode,
        precommitRollbackStatus: rollbackCurrent.status,
        statementAcquisitionFailureCode: statementFailureCode,
        statementsPreparedBeforeFailure: preparedBeforeFailure,
        statementAcquisitionReopenStatus: statementRecoveryState.status,
        indeterminateStatus: indeterminate.status,
        indeterminateRepositoryRevokedCode: revokedCode,
        recoveredRecord: publicRecord(recoveredRecord.record),
        databaseRegular: indeterminateStat.isFile(),
        databaseSingleLink: indeterminateStat.nlink === 1,
        unsafeSidecarCode,
      },
      recovery: {
        preexistingStatus: rawState.status,
        preexistingRecord: publicRecord(rawState.record),
        activeAuthorityAbsent: !Object.hasOwn(rawState, "authority"),
        vanishedStatus: vanishedState.status,
        vanishedRecord: publicRecord(vanishedState.record),
        vanishedAuthorityRevoked,
        blockedActivationStatus: vanishedActivation.status,
        blockedCandidateNotConsumed: vanishedCandidateStillStaged,
        directDeletionStatus: directDeletion.status,
        directDeletionCandidateConsumed,
        directDeletionAuthorityRevoked,
        directDeletionDurableStatus: directDeletionDurable.status,
      },
      lifecycle: { closedReadCode: closedCode, closeRevokedCurrent: secondRevokedAfterClose },
    });
  } catch (error) {
    if (error instanceof ControlPlaneRuntimeActivationEvidenceError) throw error;
    fail("RUNTIME_PROBE_MISMATCH", "The built M07-T07 child runtime probe failed.");
  } finally {
    for (const service of services) {
      try {
        service.close();
      } catch {
        // Preserve the first proof failure while best-effort revoking native state.
      }
    }
    for (const repository of repositories) {
      try {
        repository.close();
      } catch {
        // Preserve the first proof failure while best-effort revoking native state.
      }
    }
    await Promise.all(
      temporaryDirectories.map((directory) => rm(directory, { force: true, recursive: true })),
    );
  }
}

export async function runControlPlaneRuntimeActivationProbe() {
  const proofLibraryUrl = pathToFileURL(path.join(ROOT, PROOF_LIBRARY)).href;
  const program = [
    'const Module = (await import("node:module")).default;',
    "const originalLoad = Module._load;",
    "let nativeLoads = 0;",
    'Module._load = function(request, parent, isMain) { if (typeof request === "string" && request.includes("better-sqlite3")) nativeLoads += 1; return Reflect.apply(originalLoad, this, [request, parent, isMain]); };',
    `const [controlPlane, proof] = await Promise.all([import("@desen/control-plane-api"), import(${JSON.stringify(proofLibraryUrl)})]);`,
    'const [{ mkdtemp, realpath, rm }, os, path] = await Promise.all([import("node:fs/promises"), import("node:os"), import("node:path")]);',
    'const lazyRoot = await realpath(await mkdtemp(path.join(os.default.tmpdir(), "desen-m07-t07-lazy-")));',
    "const beforeOpen = nativeLoads;",
    "let lazyService;",
    "let loadedByPublicFactory = false;",
    "try { lazyService = await controlPlane.openBundleRuntimeActivation({ rootDirectory: lazyRoot }); loadedByPublicFactory = nativeLoads > beforeOpen; } finally { try { lazyService?.close(); } finally { await rm(lazyRoot, { force: true, recursive: true }); } }",
    "const receipt = await proof.runControlPlaneRuntimeActivationProbeInCurrentProcess(controlPlane);",
    "const nativeImport = { beforeOpen, loadedByPublicFactory };",
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
        parseJsonBytes(Buffer.from(stdout, "utf8"), "runtime activation child probe"),
        "runtimeReceipt",
      ),
    );
  } catch (error) {
    if (error instanceof ControlPlaneRuntimeActivationEvidenceError) throw error;
    fail("RUNTIME_PROBE_MISMATCH", "The bounded M07-T07 child runtime probe failed.");
  }
}

function expectedRuntimeReceipt() {
  return {
    publicModuleKeys: [],
    publicSurface: {
      factoryPresent: true,
      privateFactoriesAbsent: true,
      serviceKeys: ["activate", "close", "readState"],
      serviceFrozen: true,
    },
    officialActivation: {
      storeStatus: "stored",
      beforeState: "empty",
      status: "activated",
      record: {
        activeRevision: EXPECTED_REVISION,
        previousGoodRevision: null,
        generation: 0,
      },
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
      authorityFrozen: true,
      exactPrivateJoin: true,
      stagedConsumed: true,
      canonicalReclosureExact: true,
      activeStateSameAuthority: true,
    },
    sameRevision: {
      status: "activated",
      record: {
        activeRevision: EXPECTED_REVISION,
        previousGoodRevision: null,
        generation: 1,
      },
      stagedConsumed: true,
      stagedRecordTransferredExact: true,
      supersededAuthorityRevoked: true,
      currentAuthorityAuthenticated: true,
    },
    lifetime: {
      mismatch: {
        status: "rejected",
        stage: "authority-join",
        codes: ["run.desen.control-plane/INVALID_RUNTIME_ACTIVATION_AUTHORITY"],
        frozen: true,
        authorityAbsent: true,
      },
      mismatchDidNotConsume: true,
      busyLoserCode: "ACTIVATION_BUSY",
      busyLoserDidNotConsume: true,
      busyWinnerStatus: "activated",
      missingReclosure: {
        status: "rejected",
        stage: "bundle-reclosure",
        codes: ["run.desen.control-plane/RUNTIME_ACTIVATION_BUNDLE_RECLOSURE_FAILED"],
        frozen: true,
        authorityAbsent: true,
      },
      missingCandidateConsumed: true,
      missingDurableStatus: "missing",
    },
    transitions: {
      firstA: { activeRevision: REVISION_A, previousGoodRevision: null, generation: 0 },
      aToB: { activeRevision: REVISION_B, previousGoodRevision: REVISION_A, generation: 1 },
      sameB: { activeRevision: REVISION_B, previousGoodRevision: REVISION_A, generation: 2 },
      bToA: { activeRevision: REVISION_A, previousGoodRevision: REVISION_B, generation: 3 },
      staleStatus: "precondition-failed",
      staleCurrent: {
        activeRevision: REVISION_A,
        previousGoodRevision: REVISION_B,
        generation: 3,
      },
      staleNoWrite: true,
      exhaustedStatus: "generation-exhausted",
      exhaustedCurrent: {
        activeRevision: REVISION_A,
        previousGoodRevision: REVISION_B,
        generation: Number.MAX_SAFE_INTEGER,
      },
      exhaustedNoWrite: true,
    },
    durability: {
      precommitFailureCode: "STORAGE_IO_FAILURE",
      precommitRollbackStatus: "missing",
      statementAcquisitionFailureCode: "STORAGE_IO_FAILURE",
      statementsPreparedBeforeFailure: ["read"],
      statementAcquisitionReopenStatus: "missing",
      indeterminateStatus: "recovery-required",
      indeterminateRepositoryRevokedCode: "ACTIVATION_CLOSED",
      recoveredRecord: { activeRevision: REVISION_A, previousGoodRevision: null, generation: 0 },
      databaseRegular: true,
      databaseSingleLink: true,
      unsafeSidecarCode: "UNSAFE_STORAGE_PATH",
    },
    recovery: {
      preexistingStatus: "recovery-required",
      preexistingRecord: { activeRevision: REVISION_A, previousGoodRevision: null, generation: 0 },
      activeAuthorityAbsent: true,
      vanishedStatus: "recovery-required",
      vanishedRecord: null,
      vanishedAuthorityRevoked: true,
      blockedActivationStatus: "recovery-required",
      blockedCandidateNotConsumed: true,
      directDeletionStatus: "recovery-required",
      directDeletionCandidateConsumed: true,
      directDeletionAuthorityRevoked: true,
      directDeletionDurableStatus: "missing",
    },
    lifecycle: { closedReadCode: "ACTIVATION_CLOSED", closeRevokedCurrent: true },
    nativeImport: { beforeOpen: 0, loadedByPublicFactory: true },
  };
}

const M07_T07_PUBLIC_RUNTIME_KEYS = Object.freeze([
  "BUNDLE_INTEGRITY_LIMITS",
  "BUNDLE_PACKAGE_PREFLIGHT_LIMITS",
  "BUNDLE_REFERENCE_PREFLIGHT_LIMITS",
  "BUNDLE_RUNTIME_STAGING_LIMITS",
  "BundleStoreError",
  "INVALID_BUNDLE_INTEGRITY_AUTHORITY_CODE",
  "INVALID_BUNDLE_PACKAGE_AUTHORITY_CODE",
  "INVALID_INSTALLED_PACKAGE_CODE",
  "INVALID_RUNTIME_ACTIVATION_AUTHORITY_CODE",
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
const M07_T08_PUBLIC_RUNTIME_KEYS = Object.freeze(
  [
    ...M07_T07_PUBLIC_RUNTIME_KEYS,
    "INVALID_RUNTIME_RECOVERY_PACKAGE_AUTHORITY_CODE",
    "RUNTIME_RECOVERY_BUNDLE_RECLOSURE_FAILED_CODE",
    "RUNTIME_RECOVERY_INTERNAL_FAILURE_CODE",
  ].sort(),
);
const M07_T07_ACTIVATION_SERVICE_KEYS = Object.freeze(["activate", "close", "readState"]);
const M07_T08_ACTIVATION_SERVICE_KEYS = Object.freeze([
  "activate",
  "close",
  "readState",
  "recover",
]);

function assertRuntimeReceipt(receipt) {
  if (!Array.isArray(receipt.publicModuleKeys)) {
    fail("RUNTIME_PROBE_MISMATCH", "The built public module inventory is absent.");
  }
  const historical =
    JSON.stringify(receipt.publicModuleKeys) === JSON.stringify(M07_T07_PUBLIC_RUNTIME_KEYS) &&
    JSON.stringify(receipt.publicSurface?.serviceKeys) ===
      JSON.stringify(M07_T07_ACTIVATION_SERVICE_KEYS);
  const approvedCurrent =
    JSON.stringify(receipt.publicModuleKeys) === JSON.stringify(M07_T08_PUBLIC_RUNTIME_KEYS) &&
    JSON.stringify(receipt.publicSurface?.serviceKeys) ===
      JSON.stringify(M07_T08_ACTIVATION_SERVICE_KEYS);
  if (!historical && !approvedCurrent) {
    fail("RUNTIME_PROBE_MISMATCH", "The reviewed M07-T08 runtime Object.keys receipt drifted.");
  }
  const projected = {
    ...receipt,
    publicModuleKeys: [],
    publicSurface: {
      ...receipt.publicSurface,
      serviceKeys: M07_T07_ACTIVATION_SERVICE_KEYS,
    },
  };
  if (JSON.stringify(projected) !== JSON.stringify(expectedRuntimeReceipt())) {
    fail("RUNTIME_PROBE_MISMATCH", "The exact M07-T07 runtime receipt drifted.");
  }
  return deepFreeze({
    ...receipt,
    publicModuleKeys: M07_T07_PUBLIC_RUNTIME_KEYS,
    publicSurface: {
      ...receipt.publicSurface,
      serviceKeys: M07_T07_ACTIVATION_SERVICE_KEYS,
    },
  });
}

export async function buildControlPlaneRuntimeActivationEvidence(options) {
  const captured = exactOwnDataOptions(
    options,
    new Set(["prerequisiteBytes", "runtimeReceipt", "trackedFileBytes"]),
    "build options",
  );
  const trackedPaths = [
    ...TRACKED_TASK_FILES,
    TRACEABILITY,
    NORMATIVE_COVERAGE,
    PROOF_MATRIX,
    FINDINGS,
  ];
  const trackedFileBytes = captureByteOverrides(
    captured.trackedFileBytes,
    trackedPaths,
    "trackedFileBytes",
  );
  const prerequisiteBytes = captureByteOverrides(
    captured.prerequisiteBytes,
    CONTROL_PLANE_RUNTIME_ACTIVATION_PREREQUISITE_PINS.map(({ path: pinPath }) => pinPath),
    "prerequisiteBytes",
  );
  const runtimeReceipt = assertRuntimeReceipt(
    captured.runtimeReceipt === undefined
      ? await runControlPlaneRuntimeActivationProbe()
      : copyInertJson(captured.runtimeReceipt, "runtimeReceipt"),
  );
  const [
    prerequisites,
    trackedFiles,
    distribution,
    registrations,
    traceRows,
    coverage,
    tests,
    implementation,
  ] = await Promise.all([
    prerequisiteReceipts(prerequisiteBytes),
    trackedFileReceipts(trackedFileBytes),
    distributionReceipts(),
    registrationProjection(trackedFileBytes),
    traceProjection(trackedFileBytes),
    coverageProjection(trackedFileBytes),
    packageTestProjection(trackedFileBytes),
    implementationProjection(trackedFileBytes),
  ]);
  const expectedRuntimeKeys = registrations.publicExports
    .filter(({ typeOnly }) => !typeOnly)
    .map(({ exported }) => exported)
    .sort();
  if (JSON.stringify(runtimeReceipt.publicModuleKeys) !== JSON.stringify(expectedRuntimeKeys)) {
    fail("RUNTIME_PROBE_MISMATCH", "Built runtime exports disagree with the package-root source.");
  }
  const artifact = deepFreeze({
    schemaVersion: 1,
    proofId: "control-plane-runtime-activation",
    profile: "desen.control-plane.runtime-activation-proof.v1",
    task: "M07-T07",
    result: "PASS",
    summary:
      "The built Web control plane authenticates one exact T04/T06 private lineage, consumes its staged authority before asynchronous work, recloses the complete Bundle from the same immutable T01 store, and commits active, previous-good, and generation as one repository-derived durable record before publishing in-process authority.",
    prerequisites,
    claims: {
      authorityJoin: {
        exactPrivateLineage: runtimeReceipt.officialActivation.exactPrivateJoin,
        stagedCandidateConsumedBeforeFirstAwait: true,
        successfulCandidateConsumed: runtimeReceipt.officialActivation.stagedConsumed,
        mismatchedCandidateNotConsumed: runtimeReceipt.lifetime.mismatchDidNotConsume,
        busyCandidateNotConsumed: runtimeReceipt.lifetime.busyLoserDidNotConsume,
        admittedRejectedCandidateConsumed: runtimeReceipt.lifetime.missingCandidateConsumed,
        supersededActivationAuthorityRevoked:
          runtimeReceipt.sameRevision.supersededAuthorityRevoked,
      },
      sameApplicationBundleReclosure: {
        immutableStorePrerequisite: "M07-T01",
        completeCanonicalEquality: runtimeReceipt.officialActivation.canonicalReclosureExact,
        missingEntryRejectedBeforeCommit:
          runtimeReceipt.lifetime.missingReclosure.stage === "bundle-reclosure",
        missingEntryLeftRepositoryEmpty: runtimeReceipt.lifetime.missingDurableStatus === "missing",
      },
      officialFirstActivation: runtimeReceipt.officialActivation,
      sameRevisionActivation: runtimeReceipt.sameRevision,
      durableTransitions: runtimeReceipt.transitions,
      rollbackAndRecovery: {
        ...runtimeReceipt.durability,
        preexistingRawRecord: runtimeReceipt.recovery,
        activeAuthorityPublishedForRawRecord: false,
      },
      publicBoundary: runtimeReceipt.publicSurface,
      lazyNativeImport: runtimeReceipt.nativeImport,
      implementation,
      registrations,
      traceRows,
      coverageTransitions: coverage,
    },
    trackedFiles,
    distribution,
    tests,
    nonclaims: [
      "M07-T08 still owns validation and reconstruction of durable activation authority after restart or an indeterminate commit.",
      "M07-T09 still owns exhaustive boundary fault injection before, during, and after durable commit.",
      "M07-T10 still owns the complete A → invalid B → valid C, concurrent-writer, race, and restart matrices.",
      "M07-T11 still owns mutable-channel consumption and reference-host notification without treating discovery metadata as activation authority.",
      "P-12 remains NOT_PROVEN because invalid activation preservation across restart requires M07-T08 through M07-T11 and M10-T07.",
      "N-004 remains PLANNED: M07-T07 proves one exact atomic record transition, while M07-T09 still owns every precommit fault boundary required to advance the clause.",
      "N-038 and N-041 remain PLANNED; this task proves the exact transactional slice, not every invalid precommit boundary or final measured cross-system limit profile.",
      "PF-075 and PF-076 remain OPEN implementation findings while their local one-shot and durable-CAS decisions are executable here.",
      "The activation record grants no rollback method, package loader, adapter execution, rendering, channel mutation, host callback, signing, network distribution, or npm publication authority.",
      "SQLite is the Web application adapter only; Android and iOS require native repositories preserving the same observable record, CAS, atomicity, and recovery rules.",
    ],
    reproduction: [
      "pnpm verify:control-plane-runtime-staging",
      "pnpm --filter @desen/control-plane-api... build",
      "pnpm --filter @desen/control-plane-api typecheck",
      "pnpm --filter @desen/control-plane-api test:runtime-activation",
      "node scripts/generate-control-plane-runtime-activation-proof.mjs",
      "node scripts/verify-control-plane-runtime-activation.mjs",
      "node --test tests/control-plane-runtime-activation.test.mjs",
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

export async function verifyControlPlaneRuntimeActivationEvidence(options) {
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
  const built = await buildControlPlaneRuntimeActivationEvidence({
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
            ? DEFAULT_CONTROL_PLANE_RUNTIME_ACTIVATION_ARTIFACT_PATH
            : artifactPath,
        )
      : captureBytes(captured.artifactBytes, "artifactBytes");
  if (!byteEqual(artifactBytes, built.artifactBytes)) {
    fail("ARTIFACT_DRIFT", "The committed M07-T07 evidence artifact is not reproducible.");
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
    fail("PROOF_PIN_DRIFT", "The proof document lacks one exact final M07-T07 artifact pin.");
  }
  return Object.freeze({
    task: "M07-T07",
    result: "PASS",
    artifactSha256: built.artifactSha256,
    packageRuntimeCases: built.artifact.tests.packageRuntimeCases,
    compileTimeNegativeCases: built.artifact.tests.compileTimeNegativeCases,
    rootMutationCases: built.artifact.tests.rootMutationCases,
    prerequisiteArtifacts: built.artifact.prerequisites.length,
    traceRows: built.artifact.claims.traceRows.length,
  });
}

export async function writeControlPlaneRuntimeActivationEvidence(options) {
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
  const built = await buildControlPlaneRuntimeActivationEvidence();
  const artifactPath = requestedPath ?? DEFAULT_CONTROL_PLANE_RUNTIME_ACTIVATION_ARTIFACT_PATH;
  try {
    await writeAtomicProofArtifact({
      artifactPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename: captured.beforeAtomicRename,
    });
  } catch {
    fail("ARTIFACT_WRITE_FAILED", "The M07-T07 artifact could not be committed atomically.");
  }
  return Object.freeze({
    artifactPath: path.resolve(artifactPath),
    artifactSha256: built.artifactSha256,
  });
}
