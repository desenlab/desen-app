import { createHash } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import { lstat, mkdir, mkdtemp, open, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { isDeepStrictEqual, types as utilTypes } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

import { format } from "prettier";
import ts from "typescript";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const FIXTURE_PATH =
  "packages/protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json";
const PACKAGE_PATH = "packages/editor-core/package.json";
const BASE_TSCONFIG_PATH = "tsconfig.base.json";
const PACKAGE_TSCONFIG_PATH = "packages/editor-core/tsconfig.json";
const BUILD_TSCONFIG_PATH = "packages/editor-core/tsconfig.build.json";
const PUBLIC_TSCONFIG_PATH = "packages/editor-core/tsconfig.public-package.json";
const RUNTIME_DEPENDENCY_AUTHORITY_PATH =
  "docs/proof/artifacts/protocol-0.1.0-execution-contracts.json";
const SOURCE_PATH = "packages/editor-core/src/source-document.ts";
const INDEX_PATH = "packages/editor-core/src/index.ts";
const DIST_SOURCE_PATH = "packages/editor-core/dist/source-document.js";
const DIST_INDEX_PATH = "packages/editor-core/dist/index.js";
const DIST_SOURCE_DECLARATION_PATH = "packages/editor-core/dist/source-document.d.ts";
const DIST_INDEX_DECLARATION_PATH = "packages/editor-core/dist/index.d.ts";
const VALIDATOR_PACKAGE_PATH = "packages/validator/package.json";
const PROTOCOL_PACKAGE_PATH = "packages/protocol/package.json";
const VALIDATOR_RUNTIME_PATHS = Object.freeze([
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
]);
const PROTOCOL_RUNTIME_PATHS = Object.freeze([
  "packages/protocol/dist/canonicalization.js",
  "packages/protocol/dist/diagnostics.js",
  "packages/protocol/dist/index.js",
  "packages/protocol/dist/json-pointer.js",
]);
const RUNTIME_DEPENDENCY_PATHS = Object.freeze([
  VALIDATOR_PACKAGE_PATH,
  PROTOCOL_PACKAGE_PATH,
  ...VALIDATOR_RUNTIME_PATHS,
  ...PROTOCOL_RUNTIME_PATHS,
]);
const EXECUTABLE_DISTRIBUTION_PATHS = Object.freeze([
  DIST_INDEX_PATH,
  DIST_SOURCE_PATH,
  ...VALIDATOR_RUNTIME_PATHS,
  ...PROTOCOL_RUNTIME_PATHS,
]);
const PACKAGE_TEST_PATH = "packages/editor-core/test/source-document.test.ts";
const PACKAGE_TYPES_PATH = "packages/editor-core/test/source-document.types.ts";
const PUBLIC_TEST_PATH = "packages/editor-core/test/public-package.mjs";
const PUBLIC_TYPES_PATH = "packages/editor-core/test/public-package.types.mts";
const GENERATOR_PATH = "scripts/generate-editor-core-source-document-proof.mjs";
const VERIFIER_PATH = "scripts/verify-editor-core-source-document.mjs";
const PROOF_LIBRARY_PATH = "scripts/lib/editor-core-source-document-proof.mjs";
const ATOMIC_WRITER_PATH = "scripts/lib/atomic-proof-artifact.mjs";
const ROOT_TEST_PATH = "tests/editor-core-source-document.test.mjs";
const PROOF_DOCUMENT_PATH = "docs/proof/EDITOR-CORE-SOURCE-DOCUMENT.md";
const ARTIFACT_PATH = "docs/proof/artifacts/editor-core-0.1.0-source-document.json";
const I07_04_PREREQUISITE_PATH = "docs/proof/baselines/i07-04-affected-selector-promotion.json";
const MAX_AUTHORITY_BYTES = 16 * 1_024 * 1_024;
const READ_FLAGS =
  fileConstants.O_RDONLY | (fileConstants.O_NOFOLLOW ?? 0) | (fileConstants.O_NONBLOCK ?? 0);
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype);
const TYPED_ARRAY_INTRINSICS = Object.freeze({
  buffer: Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, "buffer")?.get,
  byteLength: Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, "byteLength")?.get,
  byteOffset: Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, "byteOffset")?.get,
});
const SHADOWABLE_BYTE_VIEW_FIELDS = Object.freeze(["buffer", "byteLength", "byteOffset", "length"]);

export const EDITOR_CORE_SOURCE_DOCUMENT_PREREQUISITE_PIN = Object.freeze({
  task: "I07-04",
  gate: "G07",
  path: I07_04_PREREQUISITE_PATH,
  bytes: 88_341,
  sha256: "76a29908843c0bb9a4ca5ad74b5bc94383c3fa21463ce81e98bf53e8f01d7549",
});
const RUNTIME_DEPENDENCY_AUTHORITY_PIN = Object.freeze({
  path: RUNTIME_DEPENDENCY_AUTHORITY_PATH,
  bytes: 60_075,
  sha256: "f7dc050b8a9e4e5d9ec2531312ca3ad68d0d03c46bda5c44ebf930884554f505",
  profile: "desen-execution-contract-validation-v1",
  task: "M02-T11",
  result: "PASS",
});
const RUNTIME_DEPENDENCY_SUCCESSOR_RECEIPTS = Object.freeze([
  Object.freeze({
    path: "packages/validator/dist/binding-contract-validation.js",
    bytes: 46_895,
    sha256: "82d2d9ae24ca0283c95c914025e4f708bad7f114879460b5931a25459dc2ad19",
  }),
  Object.freeze({
    path: "packages/validator/dist/execution-contract-validation.js",
    bytes: 76_906,
    sha256: "2d84bfa71a348bffe94c8c91711b7a5ea683bd89d8e5a0398e00bda3d63fda4f",
  }),
  Object.freeze({
    path: "packages/validator/dist/index.js",
    bytes: 1_965,
    sha256: "5009c889ea5eeab437f902057cdee9f84ba39c437239f1f5d222ad2ba5e05ec8",
  }),
  Object.freeze({
    path: "packages/validator/dist/interaction-contract-validation.js",
    bytes: 49_673,
    sha256: "431b473b6aa82a5af848faf74cf5459aa4375e2678f936e51c733212c42af331",
  }),
  Object.freeze({
    path: "packages/validator/dist/schema-instance-validation.js",
    bytes: 86_247,
    sha256: "169312f4eb2c304104c4321b57d0b9f07bfe88285753fd1c3f8d569e544901ca",
  }),
  Object.freeze({
    path: "packages/validator/dist/semantic-diagnostics.js",
    bytes: 6_799,
    sha256: "f2fa2b0d7a1bb5a06d57e577ec0b1922d5b924cefca5c65314a55108f123c09b",
  }),
  Object.freeze({
    path: "packages/validator/dist/semantic-validation.js",
    bytes: 27_165,
    sha256: "1d89f973a8a768771aabf203e55bc9816e1b06365553604c5808318abc483368",
  }),
  Object.freeze({
    path: "packages/validator/dist/structural-validation.js",
    bytes: 6_241,
    sha256: "316c1ea98f96ada1cad6a5cb398538fac5c10e94a03e0efa318f07c8d0459c28",
  }),
]);

export const EDITOR_CORE_SOURCE_DOCUMENT_ROOT_TEST_NAMES = Object.freeze([
  "[authority] builds final M08-T01 evidence from the exact G07/I07-04 prerequisite",
  "[determinism] two final evidence builds are byte-identical",
  "[prerequisite] rejects changed I07-04 bytes and incomplete hosted closure",
  "[behavior] rejects wrappers, mutation authority, partial failure, and semantic overreach",
  "[boundary] rejects source, TSDoc, import, distribution, and manifest drift",
  "[inventory] rejects package, public, and root test-authority drift",
  "[artifact] verifies exact bytes and the exact proof-document pin",
  "[writer] atomically writes exact bytes and preserves an existing destination on failure",
  "[writer-filesystem] rejects linked and non-file artifact destinations",
  "[options] rejects unknown, accessor, inherited, symbol, proxy, and shared inputs",
  "[filesystem] rejects linked prerequisite, artifact, and proof authorities",
  "[utf8] rejects invalid proof UTF-8 without normalization",
  "[immutability] freezes final evidence and keeps later M08 scope explicit",
]);
const EXPECTED_ROOT_TEST_CALLBACK_FINGERPRINTS = Object.freeze([
  "5493838627a0b85dd6b7b0d1146473974e1e4a645535b0736876638c64d9b68e",
  "77b144b23e34a0822e21760a900a7ad357869600514a783e74c760f7818a3a7f",
  "263a791c7bf6c255175428c93a181f7e7f304773cb21d1b5f90886485a4534a8",
  "5570dc021c0ffcd02eccde03e4d7030cacde9b327b09e3b4f3dc62eadac8f3d6",
  "1f4aca13bbacedc7649701af784aeb7909579eccfd978f021da71e99249a85d7",
  "bb6380a14027b35cf66b582e99118b8d5ce08f134e3e2f202bb21f6f47fad3b6",
  "a8049dc23fd8cd0583aa2ad6ebfead55a257d2db502b9ef0b21dfaf48a1a698e",
  "523c28ccf996e298116fbb9e220e808b340ae8cd6e9d931270d9a9d826f758eb",
  "e39899ae548b4805cbf967bff4e5d6305713dd732a9cd4430c8f284940473cd3",
  "5b60b86eb07a76541a1fce2ed76685a385b505197fea9a940f2ecaac18f8a418",
  "dc5c5ed0d3e3e1064134a8ac70377b9787153ea6d96470f3550b76aff813d653",
  "eb2425d9254548b845b146ff953302f2b692fd7a9f8b96efaa081e193b22720f",
  "0694916df5e25c3b542f1707a0c1b6e127dfb8c62b7fb9458f3681901ac55627",
]);
const EXPECTED_PACKAGE_TEST_CALLBACK_FINGERPRINTS = Object.freeze([
  "cbf1d3c148aad4e13be6c5e5a1fc75cf96f345444fbfe9950c2164555cf35612",
  "1c43b2b056991f25023ff14cd0b9a44d70f839de6f2dd14cdc77708576e0c1ff",
  "fddb1c7aeb34391c4e9426a8efaf8ffab904502566fd9d1131577e1ddc024906",
  "e61f81b512f0e800f930172dd4d97e0f740595393ea2b254df28775b0d874a30",
  "e568a90c721fa79d4855a5a8b598dc61a10bf130a6634427994f3b3e9e5409ef",
  "c0a69ab681d7ebd201b703ebb13e70411fa0dae17c2e9b1e8a3aa266e216a686",
  "6f0866507bb523e9df3449d18f688fa98ab55c047d04afa0a57625b36518aed1",
]);
const EXPECTED_PUBLIC_TEST_CALLBACK_FINGERPRINTS = Object.freeze([
  "a4c84f99bc5b7df8421505b8016a721deeacc22a9345fa5cd36054526a981c3d",
  "519238d57d8ad08b30cad0889cea0162589d5253a3267389fee00253c20fc343",
  "8a4d1997e01bed9245b7a2a75247b8114fa2f96375a170d81600ae3497ec3aa0",
  "d21ad392e4337797eefc9f37015dbc4d50126a525a017a7c01fa76dc63a6c7b2",
  "877e9d01d4fe2c720265e308896619248fdecbfde09f74a764b38e6d27cea792",
  "2e652121815d1437f6e0c3e5ca65b5cab7187753d3afe160f43b543006d3c5bf",
  "01fe85ae0e4b39538c440e0d279d38d8ec730dc8b69e420c2ec40fafea9fe7f9",
  "ab0e7543dec15e5d5f4210eef4b5337684cdb8b8420943b9a74dac982cec5985",
  "7c5ff850c08afe741c144fb16eb8fbc858c570b3fba6caf8551bdc56c11135f4",
  "c7800f664717c4fb3d36a95a22d258d4ed764f616c6569383db037b4d501d8c0",
  "4ec07420c42b68fc37842054a29f61973a01f1843ef0dbb948aa0800c5543d81",
  "bc2f656c91cc4ffb1cda2103c591db56fd72866734c10f4a583c0b159ba5cd8c",
  "7f498ae505dd142ca256327fabeac419d3d374b0cdaeeb601d01884da16c2593",
  "76c6d87cb53aa940d4bf9c03bf3c774a591765448abdd62546fdf070fefe5704",
  "63f464d6eb8afec9ce0d98f1e5d43dcd7c9ca40ed9478e6804c94dabfcc62778",
  "a120d2843533979c54ebcffe9ce3e156f0d2ff5edc5d24b2bea67bfca79b6b1f",
  "81394ddd2a20c7feabd2544f5916f9d7a836588b2b61f66748e3e4fde3017305",
]);
const EXPECTED_TEST_AUTHORITY_SHA256 = Object.freeze({
  [PACKAGE_TEST_PATH]: "3e032d38875f234a5effa3e8379f67b64280818eafe95b05e42b2551aca0f36d",
  [PACKAGE_TYPES_PATH]: "69a3e450d55a86bbb26a7b59a2cea84e5f85dfacb51aff3d32097fd81fddbf3e",
  [PUBLIC_TEST_PATH]: "cda00f2081c48cf33916ea6f7716db60c1113dec88a991163295a9395b430daf",
  [PUBLIC_TYPES_PATH]: "843ec41ab9d5ed8171ae107993ac3b8e8a8ca3fab81c91869aabc57aabb4708b",
  [ROOT_TEST_PATH]: "e791be0263f0bb4c0cec9016fe68a0dee0cda43e9f7b8260f2fc098948e6d7f7",
});

export const DEFAULT_EDITOR_CORE_SOURCE_DOCUMENT_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_PATH,
);

const EXPECTED_RUNTIME_EXPORTS = Object.freeze(["createDesenEditorDocument"]);
const EXPECTED_TYPE_EXPORTS = Object.freeze([
  "DesenEditorDocument",
  "DesenEditorDocumentCreationFailure",
  "DesenEditorDocumentCreationResult",
  "DesenEditorDocumentCreationSuccess",
]);
const EXPECTED_SOURCE_EXPORTS = Object.freeze([
  "createDesenEditorDocument",
  "DesenEditorDocument",
  "DesenEditorDocumentCreationFailure",
  "DesenEditorDocumentCreationResult",
  "DesenEditorDocumentCreationSuccess",
]);
const EXPECTED_PACKAGE_SCRIPTS = Object.freeze({
  build: "tsc -p tsconfig.build.json",
  lint: "eslint src test --max-warnings=0",
  typecheck: "tsc -p tsconfig.json --noEmit",
  test: "vitest run",
  "test:public-package":
    "tsc -p tsconfig.build.json && tsc -p tsconfig.public-package.json --noEmit && node --test test/public-package.mjs",
  "test:source-document": "vitest run test/source-document.test.ts",
  "test:coverage": "vitest run --coverage",
});
const PACKAGE_LIFECYCLE_SCRIPT_NAMES = Object.freeze([
  "dependencies",
  "install",
  "postinstall",
  "postpack",
  "postpublish",
  "postversion",
  "preinstall",
  "prepack",
  "prepare",
  "prepublish",
  "prepublishOnly",
  "preversion",
  "publish",
  "version",
]);
const EXPECTED_BASE_COMPILER_OPTIONS = Object.freeze({
  allowJs: false,
  allowSyntheticDefaultImports: true,
  declaration: true,
  declarationMap: true,
  esModuleInterop: true,
  exactOptionalPropertyTypes: true,
  forceConsistentCasingInFileNames: true,
  isolatedModules: true,
  lib: Object.freeze(["ES2023"]),
  module: "ESNext",
  moduleDetection: "force",
  moduleResolution: "Bundler",
  noEmit: true,
  noFallthroughCasesInSwitch: true,
  noImplicitOverride: true,
  noImplicitReturns: true,
  noUncheckedIndexedAccess: true,
  noUnusedLocals: true,
  noUnusedParameters: true,
  resolveJsonModule: true,
  skipLibCheck: true,
  strict: true,
  target: "ES2023",
  useDefineForClassFields: true,
  verbatimModuleSyntax: true,
});
const EXPECTED_BUILD_COMPILER_OPTIONS = Object.freeze({
  declaration: true,
  declarationMap: true,
  noEmit: false,
  outDir: "dist",
  rootDir: "src",
  sourceMap: true,
});
const EXPECTED_PUBLIC_COMPILER_OPTIONS = Object.freeze({ noEmit: true });
const EXPECTED_PACKAGE_MANIFEST = Object.freeze({
  name: "@desen/editor-core",
  version: "0.0.0",
  private: true,
  description:
    "Framework-neutral immutable commands for editing a DESEN Source with stable identity.",
  license: "Apache-2.0",
  type: "module",
  sideEffects: false,
  files: Object.freeze(["dist"]),
  exports: Object.freeze({
    ".": Object.freeze({ types: "./dist/index.d.ts", import: "./dist/index.js" }),
  }),
  scripts: EXPECTED_PACKAGE_SCRIPTS,
  dependencies: Object.freeze({
    "@desen/protocol": "workspace:*",
    "@desen/validator": "workspace:*",
  }),
  devDependencies: Object.freeze({ vitest: "4.1.10" }),
});
const EXPECTED_VALIDATOR_RUNTIME_EXPORTS = Object.freeze({
  ".": Object.freeze({ types: "./dist/index.d.ts", import: "./dist/index.js" }),
  "./schema-contract": Object.freeze({
    types: "./dist/schema-instance-validation.d.ts",
    import: "./dist/schema-instance-validation.js",
  }),
  "./schema-contract-syntax": Object.freeze({
    types: "./schema-contract-syntax.d.ts",
    import: "./schema-contract-syntax.js",
  }),
});
const EXPECTED_PROTOCOL_RUNTIME_EXPORTS = Object.freeze({
  ".": Object.freeze({ types: "./dist/index.d.ts", import: "./dist/index.js" }),
});
const EXPECTED_TRACKED_PATHS = Object.freeze(
  [
    BASE_TSCONFIG_PATH,
    FIXTURE_PATH,
    PACKAGE_PATH,
    "packages/editor-core/README.md",
    INDEX_PATH,
    SOURCE_PATH,
    PACKAGE_TEST_PATH,
    PACKAGE_TYPES_PATH,
    PUBLIC_TEST_PATH,
    PUBLIC_TYPES_PATH,
    BUILD_TSCONFIG_PATH,
    PACKAGE_TSCONFIG_PATH,
    PUBLIC_TSCONFIG_PATH,
    ...RUNTIME_DEPENDENCY_PATHS,
    DIST_INDEX_PATH,
    DIST_INDEX_DECLARATION_PATH,
    "packages/editor-core/dist/index.d.ts.map",
    "packages/editor-core/dist/index.js.map",
    DIST_SOURCE_PATH,
    DIST_SOURCE_DECLARATION_PATH,
    "packages/editor-core/dist/source-document.d.ts.map",
    "packages/editor-core/dist/source-document.js.map",
    GENERATOR_PATH,
    VERIFIER_PATH,
    PROOF_LIBRARY_PATH,
    ATOMIC_WRITER_PATH,
    ROOT_TEST_PATH,
  ].sort(),
);
const FORBIDDEN_IDENTIFIER_NAMES = Object.freeze([
  "__dirname",
  "__filename",
  "Buffer",
  "CSSStyleSheet",
  "Date",
  "Document",
  "Element",
  "Function",
  "HTMLElement",
  "Intl",
  "MutationObserver",
  "Node",
  "React",
  "ReactDOM",
  "Request",
  "Response",
  "WebSocket",
  "Worker",
  "document",
  "eval",
  "exports",
  "fetch",
  "globalThis",
  "indexedDB",
  "localStorage",
  "module",
  "navigator",
  "performance",
  "process",
  "require",
  "sessionStorage",
  "window",
]);
const RUNTIME_CLOSURE_FORBIDDEN_IDENTIFIERS = Object.freeze([
  "__dirname",
  "__filename",
  "Request",
  "Response",
  "WebSocket",
  "Worker",
  "XMLHttpRequest",
  "eval",
  "exports",
  "fetch",
  "globalThis",
  "module",
  "navigator",
  "process",
  "require",
  "window",
]);

/** Controlled failure emitted by the final deterministic M08-T01 proof. */
export class EditorCoreSourceDocumentProofError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "EditorCoreSourceDocumentProofError";
    this.code = code;
    this.details = deepFreeze(details);
  }
}

function fail(code, message, details = undefined) {
  throw new EditorCoreSourceDocumentProofError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function deepFreeze(value, visited = new Set()) {
  if (
    value === null ||
    typeof value !== "object" ||
    ArrayBuffer.isView(value) ||
    visited.has(value)
  ) {
    return value;
  }
  visited.add(value);
  for (const child of Object.values(value)) deepFreeze(child, visited);
  return Object.freeze(value);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function exactJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function captureOwnDataRecord(value, label, allowedKeys = undefined) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    utilTypes.isProxy(value)
  ) {
    fail("EDITOR_SOURCE_DOCUMENT_OPTIONS_INVALID", `${label} must be a plain own-data object.`);
  }
  let prototype;
  let keys;
  try {
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch {
    fail("EDITOR_SOURCE_DOCUMENT_OPTIONS_INVALID", `${label} could not be captured safely.`);
  }
  if (prototype !== Object.prototype && prototype !== null) {
    fail("EDITOR_SOURCE_DOCUMENT_OPTIONS_INVALID", `${label} has an unsupported prototype.`);
  }
  const captured = Object.create(null);
  for (const key of keys) {
    if (typeof key !== "string" || (allowedKeys !== undefined && !allowedKeys.includes(key))) {
      fail("EDITOR_SOURCE_DOCUMENT_OPTIONS_INVALID", `${label} contains an unknown field.`);
    }
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      fail("EDITOR_SOURCE_DOCUMENT_OPTIONS_INVALID", `${label}.${key} is not safely inspectable.`);
    }
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      fail("EDITOR_SOURCE_DOCUMENT_OPTIONS_INVALID", `${label}.${key} must be own data.`);
    }
    captured[key] = descriptor.value;
  }
  return Object.freeze(captured);
}

function captureByteView(value, label) {
  if (value === null || typeof value !== "object" || utilTypes.isProxy(value)) {
    fail("EDITOR_SOURCE_DOCUMENT_OPTIONS_INVALID", `${label} must be copied bytes.`);
  }
  let prototype;
  let backingBuffer;
  let byteLength;
  let byteOffset;
  try {
    prototype = Object.getPrototypeOf(value);
    if (
      SHADOWABLE_BYTE_VIEW_FIELDS.some(
        (field) => Object.getOwnPropertyDescriptor(value, field) !== undefined,
      ) ||
      Object.getOwnPropertySymbols(value).length !== 0
    ) {
      fail(
        "EDITOR_SOURCE_DOCUMENT_OPTIONS_INVALID",
        `${label} must not shadow intrinsic byte-view state.`,
      );
    }
    if (
      typeof TYPED_ARRAY_INTRINSICS.buffer !== "function" ||
      typeof TYPED_ARRAY_INTRINSICS.byteLength !== "function" ||
      typeof TYPED_ARRAY_INTRINSICS.byteOffset !== "function"
    ) {
      fail(
        "EDITOR_SOURCE_DOCUMENT_OPTIONS_INVALID",
        `${label} byte-view intrinsics are unavailable.`,
      );
    }
    backingBuffer = Reflect.apply(TYPED_ARRAY_INTRINSICS.buffer, value, []);
    byteLength = Reflect.apply(TYPED_ARRAY_INTRINSICS.byteLength, value, []);
    byteOffset = Reflect.apply(TYPED_ARRAY_INTRINSICS.byteOffset, value, []);
  } catch {
    fail("EDITOR_SOURCE_DOCUMENT_OPTIONS_INVALID", `${label} could not be captured safely.`);
  }
  if (prototype !== Buffer.prototype && prototype !== Uint8Array.prototype) {
    fail("EDITOR_SOURCE_DOCUMENT_OPTIONS_INVALID", `${label} must be Buffer or Uint8Array bytes.`);
  }
  if (typeof SharedArrayBuffer === "function" && backingBuffer instanceof SharedArrayBuffer) {
    fail("EDITOR_SOURCE_DOCUMENT_OPTIONS_INVALID", `${label} must not use shared memory.`);
  }
  try {
    return Buffer.from(new Uint8Array(backingBuffer, byteOffset, byteLength));
  } catch {
    fail("EDITOR_SOURCE_DOCUMENT_OPTIONS_INVALID", `${label} could not be copied safely.`);
  }
}

function capturePath(value, label) {
  if (typeof value !== "string" || value.length === 0 || value.includes("\0")) {
    fail("EDITOR_SOURCE_DOCUMENT_OPTIONS_INVALID", `${label} must be a non-empty path string.`);
  }
  return path.resolve(value);
}

function normalizeBuildOptions(options) {
  const rawOverrides = options.fileOverrides;
  const overrides = Object.create(null);
  if (rawOverrides !== undefined) {
    const capturedOverrides = captureOwnDataRecord(rawOverrides, "fileOverrides");
    for (const [relativePath, value] of Object.entries(capturedOverrides)) {
      if (!EXPECTED_TRACKED_PATHS.includes(relativePath)) {
        fail(
          "EDITOR_SOURCE_DOCUMENT_OPTIONS_INVALID",
          `fileOverrides contains an untracked path: ${relativePath}.`,
        );
      }
      if (
        EXECUTABLE_DISTRIBUTION_PATHS.includes(relativePath) ||
        relativePath === VALIDATOR_PACKAGE_PATH ||
        relativePath === PROTOCOL_PACKAGE_PATH
      ) {
        fail(
          "EDITOR_SOURCE_DOCUMENT_OPTIONS_INVALID",
          `fileOverrides cannot replace executable distribution bytes: ${relativePath}.`,
        );
      }
      if (typeof value !== "string" && !Buffer.isBuffer(value)) {
        fail(
          "EDITOR_SOURCE_DOCUMENT_OPTIONS_INVALID",
          `fileOverrides.${relativePath} must be text or Buffer bytes.`,
        );
      }
      overrides[relativePath] =
        typeof value === "string"
          ? Buffer.from(value)
          : captureByteView(value, `fileOverrides.${relativePath}`);
    }
  }
  const runtimeApiProvided = Object.hasOwn(options, "runtimeApi");
  const fileOverridesProvided = Object.hasOwn(options, "fileOverrides");
  return Object.freeze({
    dependencyAuthorityBytes:
      options.dependencyAuthorityBytes === undefined
        ? undefined
        : captureByteView(options.dependencyAuthorityBytes, "dependencyAuthorityBytes"),
    dependencyAuthorityPath:
      options.dependencyAuthorityPath === undefined
        ? path.join(WORKSPACE_ROOT, RUNTIME_DEPENDENCY_AUTHORITY_PATH)
        : capturePath(options.dependencyAuthorityPath, "dependencyAuthorityPath"),
    fileOverrides: Object.freeze(overrides),
    fileOverridesProvided,
    runtimeApi: runtimeApiProvided ? captureRuntimeApi(options.runtimeApi) : undefined,
    runtimeApiProvided,
    prerequisiteBytes:
      options.prerequisiteBytes === undefined
        ? undefined
        : captureByteView(options.prerequisiteBytes, "prerequisiteBytes"),
    prerequisitePath:
      options.prerequisitePath === undefined
        ? path.join(WORKSPACE_ROOT, I07_04_PREREQUISITE_PATH)
        : capturePath(options.prerequisitePath, "prerequisitePath"),
  });
}

function captureBuildOptions(rawOptions) {
  if (rawOptions === undefined) return normalizeBuildOptions(Object.freeze(Object.create(null)));
  return normalizeBuildOptions(
    captureOwnDataRecord(rawOptions, "build options", [
      "dependencyAuthorityBytes",
      "dependencyAuthorityPath",
      "fileOverrides",
      "runtimeApi",
      "prerequisiteBytes",
      "prerequisitePath",
    ]),
  );
}

function captureVerifyOptions(rawOptions) {
  const options =
    rawOptions === undefined
      ? Object.freeze(Object.create(null))
      : captureOwnDataRecord(rawOptions, "verify options", [
          "artifactBytes",
          "artifactPath",
          "dependencyAuthorityBytes",
          "dependencyAuthorityPath",
          "fileOverrides",
          "prerequisiteBytes",
          "prerequisitePath",
          "proofDocument",
          "proofDocumentPath",
          "runtimeApi",
        ]);
  if (Object.hasOwn(options, "fileOverrides") || Object.hasOwn(options, "runtimeApi")) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_OPTIONS_INVALID",
      "Verification cannot replace tracked files or the receipted public runtime.",
    );
  }
  const build = normalizeBuildOptions(options);
  return Object.freeze({
    build,
    artifactBytes:
      options.artifactBytes === undefined
        ? undefined
        : captureByteView(options.artifactBytes, "artifactBytes"),
    artifactPath:
      options.artifactPath === undefined
        ? DEFAULT_EDITOR_CORE_SOURCE_DOCUMENT_ARTIFACT_PATH
        : capturePath(options.artifactPath, "artifactPath"),
    proofDocument: options.proofDocument,
    proofDocumentPath:
      options.proofDocumentPath === undefined
        ? path.join(WORKSPACE_ROOT, PROOF_DOCUMENT_PATH)
        : capturePath(options.proofDocumentPath, "proofDocumentPath"),
  });
}

function captureWriteOptions(rawOptions) {
  const options =
    rawOptions === undefined
      ? Object.freeze(Object.create(null))
      : captureOwnDataRecord(rawOptions, "write options", [
          "artifactPath",
          "beforeAtomicRename",
          "buildOptions",
        ]);
  if (
    options.beforeAtomicRename !== undefined &&
    typeof options.beforeAtomicRename !== "function"
  ) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_OPTIONS_INVALID",
      "beforeAtomicRename must be a function when provided.",
    );
  }
  return Object.freeze({
    artifactPath:
      options.artifactPath === undefined
        ? DEFAULT_EDITOR_CORE_SOURCE_DOCUMENT_ARTIFACT_PATH
        : capturePath(options.artifactPath, "artifactPath"),
    beforeAtomicRename: options.beforeAtomicRename,
    build: captureBuildOptions(options.buildOptions),
  });
}

async function readRegularAuthority(absolutePath, label, maximumBytes = MAX_AUTHORITY_BYTES) {
  const resolvedInput = path.resolve(absolutePath);
  let canonicalParent;
  try {
    canonicalParent = await realpath(path.dirname(resolvedInput));
  } catch (error) {
    fail("EDITOR_SOURCE_DOCUMENT_AUTHORITY_UNSAFE", `${label} parent is unavailable.`, {
      cause: String(error),
    });
  }
  const canonicalPath = path.join(canonicalParent, path.basename(resolvedInput));
  if (canonicalPath !== resolvedInput) {
    fail("EDITOR_SOURCE_DOCUMENT_AUTHORITY_UNSAFE", `${label} must not traverse a linked parent.`);
  }
  let before;
  let handle;
  try {
    before = await lstat(canonicalPath);
    if (
      !before.isFile() ||
      before.isSymbolicLink() ||
      before.nlink !== 1 ||
      before.size > maximumBytes
    ) {
      fail(
        "EDITOR_SOURCE_DOCUMENT_AUTHORITY_UNSAFE",
        `${label} must be one bounded regular non-linked file.`,
      );
    }
    handle = await open(canonicalPath, READ_FLAGS);
    const opened = await handle.stat();
    if (
      !opened.isFile() ||
      opened.nlink !== 1 ||
      opened.size !== before.size ||
      opened.dev !== before.dev ||
      opened.ino !== before.ino
    ) {
      fail("EDITOR_SOURCE_DOCUMENT_AUTHORITY_UNSAFE", `${label} identity changed before read.`);
    }
    const bytes = await handle.readFile();
    const after = await lstat(canonicalPath);
    if (
      !after.isFile() ||
      after.nlink !== 1 ||
      bytes.byteLength !== opened.size ||
      bytes.byteLength > maximumBytes ||
      after.dev !== opened.dev ||
      after.ino !== opened.ino ||
      after.size !== opened.size ||
      after.mtimeMs !== opened.mtimeMs ||
      after.ctimeMs !== opened.ctimeMs
    ) {
      fail("EDITOR_SOURCE_DOCUMENT_AUTHORITY_UNSAFE", `${label} changed while it was read.`);
    }
    return bytes;
  } catch (error) {
    if (error instanceof EditorCoreSourceDocumentProofError) throw error;
    fail("EDITOR_SOURCE_DOCUMENT_AUTHORITY_UNSAFE", `${label} could not be read safely.`, {
      cause: String(error),
    });
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

function fatalUtf8(bytes, label) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail("EDITOR_SOURCE_DOCUMENT_UTF8_INVALID", `${label} is not valid UTF-8.`);
  }
}

async function readTrackedBytes(relativePath, overrides) {
  if (Object.hasOwn(overrides, relativePath)) return Buffer.from(overrides[relativePath]);
  return readRegularAuthority(
    path.join(WORKSPACE_ROOT, relativePath),
    `Required file ${relativePath}`,
  );
}

function parseJson(text, relativePath) {
  try {
    return JSON.parse(text);
  } catch {
    fail("EDITOR_SOURCE_DOCUMENT_JSON_INVALID", `Required JSON is invalid: ${relativePath}.`);
  }
}

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right, "en"));
}

function inspectFrozenInertJson(root, label) {
  const pending = [{ value: root, pointer: "" }];
  const visited = new Set();
  const objects = new Set();
  while (pending.length > 0) {
    const { value, pointer } = pending.pop();
    if (value === null || typeof value === "string" || typeof value === "boolean") continue;
    if (typeof value === "number") {
      if (Number.isFinite(value)) continue;
      fail(
        "EDITOR_SOURCE_DOCUMENT_BEHAVIOR_DRIFT",
        `${label}${pointer} contains a non-finite number.`,
      );
    }
    if (typeof value !== "object") {
      fail(
        "EDITOR_SOURCE_DOCUMENT_BEHAVIOR_DRIFT",
        `${label}${pointer} contains a non-JSON ${typeof value} value.`,
      );
    }
    if (utilTypes.isProxy(value)) {
      fail("EDITOR_SOURCE_DOCUMENT_BEHAVIOR_DRIFT", `${label}${pointer} contains a Proxy.`);
    }
    if (visited.has(value)) {
      fail(
        "EDITOR_SOURCE_DOCUMENT_BEHAVIOR_DRIFT",
        `${label}${pointer} contains a cycle or aliased JSON object.`,
      );
    }
    visited.add(value);
    objects.add(value);
    let prototype;
    let keys;
    try {
      prototype = Object.getPrototypeOf(value);
      keys = Reflect.ownKeys(value);
    } catch {
      fail(
        "EDITOR_SOURCE_DOCUMENT_BEHAVIOR_DRIFT",
        `${label}${pointer} could not be inspected safely.`,
      );
    }
    const array = Array.isArray(value);
    if (!Object.isFrozen(value) || prototype !== (array ? Array.prototype : Object.prototype)) {
      fail(
        "EDITOR_SOURCE_DOCUMENT_BEHAVIOR_DRIFT",
        `${label}${pointer} must be frozen plain JSON data.`,
      );
    }
    if (keys.some((key) => typeof key !== "string")) {
      fail(
        "EDITOR_SOURCE_DOCUMENT_BEHAVIOR_DRIFT",
        `${label}${pointer} contains a symbol property.`,
      );
    }
    const expectedArrayKeys = array
      ? [...Array.from({ length: value.length }, (_, index) => String(index)), "length"]
      : undefined;
    if (array && !exactJson(keys, expectedArrayKeys)) {
      fail(
        "EDITOR_SOURCE_DOCUMENT_BEHAVIOR_DRIFT",
        `${label}${pointer} must be a dense JSON array with only index keys and length.`,
      );
    }
    for (const key of keys) {
      let descriptor;
      try {
        descriptor = Object.getOwnPropertyDescriptor(value, key);
      } catch {
        fail(
          "EDITOR_SOURCE_DOCUMENT_BEHAVIOR_DRIFT",
          `${label}${pointer}/${key} could not be inspected safely.`,
        );
      }
      const arrayLength = array && key === "length";
      if (
        descriptor === undefined ||
        !("value" in descriptor) ||
        descriptor.enumerable === arrayLength
      ) {
        fail(
          "EDITOR_SOURCE_DOCUMENT_BEHAVIOR_DRIFT",
          `${label}${pointer}/${key} is not an exact own-data JSON property.`,
        );
      }
      if (!arrayLength) pending.push({ value: descriptor.value, pointer: `${pointer}/${key}` });
    }
  }
  return Object.freeze({ objects });
}

function captureRuntimeApi(value) {
  const api = captureOwnDataRecord(value, "runtimeApi", ["createDesenEditorDocument"]);
  if (typeof api.createDesenEditorDocument !== "function") {
    fail(
      "EDITOR_SOURCE_DOCUMENT_OPTIONS_INVALID",
      "runtimeApi.createDesenEditorDocument must be a function.",
    );
  }
  return Object.freeze({ createDesenEditorDocument: api.createDesenEditorDocument });
}

async function authenticateRuntimeDependencyAuthority(options, fileBytes) {
  const pin = RUNTIME_DEPENDENCY_AUTHORITY_PIN;
  const bytes =
    options.dependencyAuthorityBytes ??
    (await readRegularAuthority(
      options.dependencyAuthorityPath,
      "M02-T11 runtime dependency authority",
    ));
  if (bytes.byteLength !== pin.bytes || sha256(bytes) !== pin.sha256) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_RUNTIME_AUTHORITY_DRIFT",
      "The exact M02-T11 runtime dependency authority drifted.",
      {
        expectedBytes: pin.bytes,
        actualBytes: bytes.byteLength,
        expectedSha256: pin.sha256,
        actualSha256: sha256(bytes),
      },
    );
  }
  let authority;
  try {
    authority = JSON.parse(fatalUtf8(bytes, RUNTIME_DEPENDENCY_AUTHORITY_PATH));
  } catch (error) {
    if (error instanceof EditorCoreSourceDocumentProofError) throw error;
    fail(
      "EDITOR_SOURCE_DOCUMENT_RUNTIME_AUTHORITY_DRIFT",
      "The exact M02-T11 runtime dependency authority is not valid JSON.",
    );
  }
  const trackedFiles = authority.implementation?.trackedFiles;
  const runtimePaths = [...VALIDATOR_RUNTIME_PATHS, ...PROTOCOL_RUNTIME_PATHS];
  const successorPaths = RUNTIME_DEPENDENCY_SUCCESSOR_RECEIPTS.map((receipt) => receipt.path);
  const successorPathSet = new Set(successorPaths);
  const baselinePaths = runtimePaths.filter((relativePath) => !successorPathSet.has(relativePath));
  if (
    authority.profile !== pin.profile ||
    authority.task !== pin.task ||
    authority.result !== pin.result ||
    !Array.isArray(trackedFiles) ||
    new Set(trackedFiles.map((receipt) => receipt?.path)).size !== trackedFiles.length ||
    successorPathSet.size !== RUNTIME_DEPENDENCY_SUCCESSOR_RECEIPTS.length ||
    baselinePaths.length !== 11 ||
    successorPaths.length !== 8 ||
    !exactJson(sorted([...baselinePaths, ...successorPaths]), sorted(runtimePaths))
  ) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_RUNTIME_AUTHORITY_DRIFT",
      "The composed runtime authority lost its exact PASS identity, unique receipts, or disjoint 11+8 coverage.",
    );
  }
  for (const relativePath of baselinePaths) {
    const matches = trackedFiles.filter((receipt) => receipt?.path === relativePath);
    const receipt = matches[0];
    const runtimeBytes = fileBytes[relativePath];
    if (
      matches.length !== 1 ||
      receipt === null ||
      typeof receipt !== "object" ||
      !exactJson(Reflect.ownKeys(receipt), ["path", "bytes", "sha256"]) ||
      receipt.bytes !== runtimeBytes.byteLength ||
      receipt.sha256 !== sha256(runtimeBytes)
    ) {
      fail(
        "EDITOR_SOURCE_DOCUMENT_RUNTIME_AUTHORITY_DRIFT",
        `The M02-T11 baseline does not receipt the exact runtime dependency: ${relativePath}.`,
      );
    }
  }
  for (const receipt of RUNTIME_DEPENDENCY_SUCCESSOR_RECEIPTS) {
    const runtimeBytes = fileBytes[receipt.path];
    if (
      !exactJson(Reflect.ownKeys(receipt), ["path", "bytes", "sha256"]) ||
      receipt.bytes !== runtimeBytes.byteLength ||
      receipt.sha256 !== sha256(runtimeBytes)
    ) {
      fail(
        "EDITOR_SOURCE_DOCUMENT_RUNTIME_AUTHORITY_DRIFT",
        `The M08 proof reader successor receipt drifted: ${receipt.path}.`,
      );
    }
  }
  return deepFreeze({
    composition: "M02_T11_BASELINE_PLUS_M08_READER_SUCCESSORS",
    baseline: {
      ...pin,
      provenance: "PINNED_M02_T11_ARTIFACT",
      runtimeReceipts: baselinePaths.length,
      runtimePaths: baselinePaths,
    },
    successor: {
      provenance: "M08_PROOF_READER_CHECKPOINT",
      runtimeReceipts: RUNTIME_DEPENDENCY_SUCCESSOR_RECEIPTS.length,
      receipts: RUNTIME_DEPENDENCY_SUCCESSOR_RECEIPTS,
    },
    coverage: {
      runtimeReceipts: runtimePaths.length,
      disjoint: true,
      exactCurrentBytes: true,
    },
  });
}

async function importReceiptedRuntime(fileBytes) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-m08-t01-runtime-"));
  try {
    const runtimePaths = [
      PACKAGE_PATH,
      DIST_INDEX_PATH,
      DIST_SOURCE_PATH,
      ...RUNTIME_DEPENDENCY_PATHS,
    ];
    const runtimeCopies = runtimePaths.map((relativePath) => {
      const match = relativePath.match(/^packages\/(editor-core|validator|protocol)\/(.+)$/u);
      if (match === null) {
        fail(
          "EDITOR_SOURCE_DOCUMENT_DISTRIBUTION_DRIFT",
          `Runtime dependency path is outside the reviewed package closure: ${relativePath}.`,
        );
      }
      return {
        bytes: fileBytes[relativePath],
        destination: path.join(directory, "node_modules", "@desen", match[1], match[2]),
      };
    });
    const copies = [
      {
        bytes: Buffer.from('export * from "@desen/editor-core";\n'),
        destination: path.join(directory, "entry.mjs"),
      },
      ...runtimeCopies,
    ];
    await Promise.all(
      copies.map(async ({ bytes, destination }) => {
        await mkdir(path.dirname(destination), { recursive: true });
        await writeFile(destination, bytes);
      }),
    );
    const runtime = await import(pathToFileURL(path.join(directory, "entry.mjs")).href);
    return captureRuntimeApi({
      createDesenEditorDocument: runtime.createDesenEditorDocument,
    });
  } catch (error) {
    if (error instanceof EditorCoreSourceDocumentProofError) throw error;
    fail(
      "EDITOR_SOURCE_DOCUMENT_DISTRIBUTION_DRIFT",
      "The exact receipted editor-core distribution could not be executed.",
      { cause: String(error) },
    );
  } finally {
    await rm(directory, { force: true, recursive: true }).catch(() => undefined);
  }
}

function assertRejected(result, pointer, message, label) {
  const inspected = inspectFrozenInertJson(result, `${label} result`);
  const diagnostic = result.diagnostics?.[0];
  if (
    result.ok !== false ||
    !exactJson(Reflect.ownKeys(result), ["ok", "diagnostics"]) ||
    Object.hasOwn(result, "document") ||
    !Array.isArray(result.diagnostics) ||
    result.diagnostics.length !== 1 ||
    diagnostic === null ||
    typeof diagnostic !== "object" ||
    !exactJson(Reflect.ownKeys(diagnostic), ["code", "classification", "message", "pointer"]) ||
    diagnostic.code !== "SCHEMA_INVALID" ||
    diagnostic.classification !== "schema" ||
    diagnostic.message !== message ||
    diagnostic.pointer !== pointer
  ) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_BEHAVIOR_DRIFT",
      `${label} no longer rejects with the exact closed diagnostic shell.`,
    );
  }
  return inspected;
}

function callerGraphSnapshot(root, label) {
  const pending = [root];
  const visited = new Set();
  const states = new Map();
  while (pending.length > 0) {
    const value = pending.pop();
    if (
      value === null ||
      (typeof value !== "object" && typeof value !== "function") ||
      visited.has(value)
    ) {
      continue;
    }
    if (utilTypes.isProxy(value)) {
      fail("EDITOR_SOURCE_DOCUMENT_BEHAVIOR_DRIFT", `${label} contains a Proxy.`);
    }
    visited.add(value);
    let prototype;
    let extensible;
    let keys;
    try {
      prototype = Object.getPrototypeOf(value);
      extensible = Object.isExtensible(value);
      keys = Reflect.ownKeys(value);
    } catch {
      fail("EDITOR_SOURCE_DOCUMENT_BEHAVIOR_DRIFT", `${label} could not be snapshotted safely.`);
    }
    const descriptors = keys.map((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined) {
        fail("EDITOR_SOURCE_DOCUMENT_BEHAVIOR_DRIFT", `${label} changed during snapshot.`);
      }
      if ("value" in descriptor) {
        pending.push(descriptor.value);
      } else {
        pending.push(descriptor.get, descriptor.set);
      }
      return { key, descriptor };
    });
    states.set(value, { prototype, extensible, descriptors });
  }
  return states;
}

function descriptorUnchanged(before, after) {
  if (
    before.configurable !== after.configurable ||
    before.enumerable !== after.enumerable ||
    "value" in before !== "value" in after
  ) {
    return false;
  }
  return "value" in before && "value" in after
    ? before.writable === after.writable && Object.is(before.value, after.value)
    : !("value" in before) &&
        !("value" in after) &&
        Object.is(before.get, after.get) &&
        Object.is(before.set, after.set);
}

function assertCallerGraphUnchanged(snapshot, label) {
  for (const [value, state] of snapshot) {
    let prototype;
    let extensible;
    let keys;
    try {
      prototype = Object.getPrototypeOf(value);
      extensible = Object.isExtensible(value);
      keys = Reflect.ownKeys(value);
    } catch {
      fail("EDITOR_SOURCE_DOCUMENT_BEHAVIOR_DRIFT", `${label} could not be reinspected safely.`);
    }
    if (
      prototype !== state.prototype ||
      extensible !== state.extensible ||
      keys.length !== state.descriptors.length ||
      keys.some((key, index) => !Object.is(key, state.descriptors[index].key)) ||
      state.descriptors.some(({ key, descriptor }) => {
        const after = Object.getOwnPropertyDescriptor(value, key);
        return after === undefined || !descriptorUnchanged(descriptor, after);
      })
    ) {
      fail(
        "EDITOR_SOURCE_DOCUMENT_BEHAVIOR_DRIFT",
        `${label} was mutated while its rejection was computed.`,
      );
    }
  }
}

function assertCallerGraphUnfrozenAndDetached(input, outputObjects, label) {
  const pending = [{ value: input, pointer: "" }];
  const visited = new Set();
  while (pending.length > 0) {
    const { value, pointer } = pending.pop();
    if (
      value === null ||
      (typeof value !== "object" && typeof value !== "function") ||
      visited.has(value)
    ) {
      continue;
    }
    if (utilTypes.isProxy(value)) {
      fail("EDITOR_SOURCE_DOCUMENT_BEHAVIOR_DRIFT", `${label}${pointer} contains a Proxy.`);
    }
    visited.add(value);
    if (Object.isFrozen(value)) {
      fail("EDITOR_SOURCE_DOCUMENT_BEHAVIOR_DRIFT", `${label}${pointer} was frozen by admission.`);
    }
    if (outputObjects.has(value)) {
      fail(
        "EDITOR_SOURCE_DOCUMENT_BEHAVIOR_DRIFT",
        `${label}${pointer} is retained by the admitted result.`,
      );
    }
    let keys;
    try {
      keys = Reflect.ownKeys(value);
    } catch {
      fail(
        "EDITOR_SOURCE_DOCUMENT_BEHAVIOR_DRIFT",
        `${label}${pointer} could not be inspected safely.`,
      );
    }
    for (const key of keys) {
      if (typeof key !== "string" || (Array.isArray(value) && key === "length")) continue;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor !== undefined && "value" in descriptor) {
        pending.push({ value: descriptor.value, pointer: `${pointer}/${key}` });
      } else if (descriptor !== undefined) {
        pending.push({ value: descriptor.get, pointer: `${pointer}/${String(key)}/get` });
        pending.push({ value: descriptor.set, pointer: `${pointer}/${String(key)}/set` });
      }
    }
  }
}

function assertSuccessfulAdmission(result, input, expectedDocument, label) {
  const inspected = inspectFrozenInertJson(result, `${label} result`);
  if (
    result.ok !== true ||
    !exactJson(Reflect.ownKeys(result), ["ok", "document", "diagnostics"]) ||
    !isDeepStrictEqual(result.document, expectedDocument) ||
    !exactJson(result.diagnostics, []) ||
    Object.hasOwn(result.document, "source") ||
    Object.hasOwn(result.document, "nodes") ||
    Object.hasOwn(result.document, "index") ||
    Object.hasOwn(result.document, "ast")
  ) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_BEHAVIOR_DRIFT",
      `${label} lost its exact direct Source success contract.`,
    );
  }
  assertCallerGraphUnfrozenAndDetached(input, inspected.objects, `${label} caller`);
  return Object.freeze({
    objects: inspected.objects,
    documentObjects: inspectFrozenInertJson(result.document, `${label} document`).objects,
  });
}

function verifyRuntimeBehavior(runtimeApi, officialSource) {
  if (
    !exactJson(sorted(Object.keys(runtimeApi)), EXPECTED_RUNTIME_EXPORTS) ||
    typeof runtimeApi.createDesenEditorDocument !== "function"
  ) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_PUBLIC_API_DRIFT",
      "The built package must expose only createDesenEditorDocument at runtime.",
    );
  }
  const createDocument = runtimeApi.createDesenEditorDocument;
  const firstInput = cloneJson(officialSource);
  const secondInput = cloneJson(officialSource);
  const first = createDocument(firstInput);
  const second = createDocument(secondInput);
  const firstGraph = assertSuccessfulAdmission(
    first,
    firstInput,
    officialSource,
    "first admission",
  );
  const secondGraph = assertSuccessfulAdmission(
    second,
    secondInput,
    officialSource,
    "second admission",
  );
  for (const object of firstGraph.documentObjects) {
    if (secondGraph.documentObjects.has(object)) {
      fail(
        "EDITOR_SOURCE_DOCUMENT_BEHAVIOR_DRIFT",
        "Independent admissions share document graph identity.",
      );
    }
  }
  firstInput.id = "caller-mutated-after-admission";
  firstInput.surfaces.extra = cloneJson(officialSource.surfaces["sign-in"]);
  if (
    first.document.id !== officialSource.id ||
    Object.hasOwn(first.document.surfaces, "extra") ||
    !isDeepStrictEqual(second.document, officialSource)
  ) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_BEHAVIOR_DRIFT",
      "The emitted factory retained caller mutation authority.",
    );
  }

  const unresolved = cloneJson(officialSource);
  unresolved.surfaces["sign-in"].root.use = "com.example.unresolved/Unknown";
  const unresolvedResult = createDocument(unresolved);
  assertSuccessfulAdmission(
    unresolvedResult,
    unresolved,
    unresolved,
    "unresolved semantic admission",
  );

  const invalidRoot = cloneJson(officialSource);
  invalidRoot.kind = "desen.bundle";
  const invalidRootCallerSnapshot = callerGraphSnapshot(invalidRoot, "invalid root caller");
  const invalidRootResult = createDocument(invalidRoot);
  const invalidRootGraph = assertRejected(
    invalidRootResult,
    "/kind",
    "The document violates its const schema constraint.",
    "invalid Source root",
  );
  assertCallerGraphUnchanged(invalidRootCallerSnapshot, "invalid root caller");
  assertCallerGraphUnfrozenAndDetached(
    invalidRoot,
    invalidRootGraph.objects,
    "invalid root caller",
  );

  const invalidEmbeddedSchema = cloneJson(officialSource);
  invalidEmbeddedSchema.surfaces["sign-in"].state.email.schema = {
    type: "string",
    pattern: "[",
  };
  const invalidEmbeddedCallerSnapshot = callerGraphSnapshot(
    invalidEmbeddedSchema,
    "invalid embedded-schema caller",
  );
  const invalidEmbeddedResult = createDocument(invalidEmbeddedSchema);
  const invalidEmbeddedGraph = assertRejected(
    invalidEmbeddedResult,
    "/surfaces/sign-in/state/email/schema/pattern",
    "An embedded schema contains an invalid regular expression.",
    "invalid embedded schema",
  );
  assertCallerGraphUnchanged(invalidEmbeddedCallerSnapshot, "invalid embedded-schema caller");
  assertCallerGraphUnfrozenAndDetached(
    invalidEmbeddedSchema,
    invalidEmbeddedGraph.objects,
    "invalid embedded-schema caller",
  );

  const executable = cloneJson(officialSource);
  executable.authoring = { executable: () => "not inert JSON" };
  const executableCallerSnapshot = callerGraphSnapshot(executable, "executable caller");
  const executableResult = createDocument(executable);
  const executableGraph = assertRejected(
    executableResult,
    "",
    "Input must be inert RFC 8785-compatible JSON data.",
    "executable input",
  );
  assertCallerGraphUnchanged(executableCallerSnapshot, "executable caller");
  assertCallerGraphUnfrozenAndDetached(executable, executableGraph.objects, "executable caller");

  let getterCalls = 0;
  let toJsonCalls = 0;
  const accessor = cloneJson(officialSource);
  Object.defineProperty(accessor.authoring, "selection", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return { surfaceId: "sign-in" };
    },
  });
  const serializationHook = cloneJson(officialSource);
  serializationHook.toJSON = () => {
    toJsonCalls += 1;
    return cloneJson(officialSource);
  };
  const accessorCallerSnapshot = callerGraphSnapshot(accessor, "accessor caller");
  const serializationHookCallerSnapshot = callerGraphSnapshot(
    serializationHook,
    "serialization-hook caller",
  );
  const accessorResult = createDocument(accessor);
  const accessorGraph = assertRejected(
    accessorResult,
    "",
    "Input must be inert RFC 8785-compatible JSON data.",
    "accessor input",
  );
  assertCallerGraphUnchanged(accessorCallerSnapshot, "accessor caller");
  assertCallerGraphUnfrozenAndDetached(accessor, accessorGraph.objects, "accessor caller");
  const serializationHookResult = createDocument(serializationHook);
  const serializationHookGraph = assertRejected(
    serializationHookResult,
    "",
    "Input must be inert RFC 8785-compatible JSON data.",
    "serialization-hook input",
  );
  assertCallerGraphUnchanged(serializationHookCallerSnapshot, "serialization-hook caller");
  assertCallerGraphUnfrozenAndDetached(
    serializationHook,
    serializationHookGraph.objects,
    "serialization-hook caller",
  );
  if (getterCalls !== 0 || toJsonCalls !== 0) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_BEHAVIOR_DRIFT",
      "The emitted factory invoked caller-owned executable hooks.",
    );
  }

  return Object.freeze({
    directSourceRoot: true,
    hiddenModelKeys: Object.freeze([]),
    detached: true,
    independentSnapshots: true,
    deeplyFrozenPlainOwnData: true,
    callerUnfrozen: true,
    unresolvedSemanticsAdmitted: true,
    rejectedVectors: Object.freeze([
      Object.freeze({ vector: "invalid-root", code: "SCHEMA_INVALID", pointer: "/kind" }),
      Object.freeze({
        vector: "invalid-embedded-schema",
        code: "SCHEMA_INVALID",
        pointer: "/surfaces/sign-in/state/email/schema/pattern",
      }),
      Object.freeze({ vector: "executable-non-json", code: "SCHEMA_INVALID", pointer: "" }),
      Object.freeze({ vector: "accessor", code: "SCHEMA_INVALID", pointer: "" }),
      Object.freeze({ vector: "serialization-hook", code: "SCHEMA_INVALID", pointer: "" }),
    ]),
  });
}

function declarationInventory(sourceText, fileName) {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.ES2023,
    true,
    fileName.endsWith(".js") ? ts.ScriptKind.JS : ts.ScriptKind.TS,
  );
  const runtime = [];
  const types = [];
  const missingTsdoc = [];
  if (sourceFile.parseDiagnostics.length !== 0) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_SOURCE_CONTRACT_DRIFT",
      `${fileName} contains TypeScript parse diagnostics.`,
    );
  }
  for (const statement of sourceFile.statements) {
    const exported = statement.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    );
    if (!exported) continue;
    if (
      (!ts.isTypeAliasDeclaration(statement) &&
        !ts.isInterfaceDeclaration(statement) &&
        !ts.isFunctionDeclaration(statement)) ||
      statement.name === undefined ||
      !ts.isIdentifier(statement.name)
    ) {
      fail(
        "EDITOR_SOURCE_DOCUMENT_SOURCE_CONTRACT_DRIFT",
        `${fileName} contains an unsupported public declaration.`,
      );
    }
    const name = statement.name.text;
    if (ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement)) {
      types.push(name);
    } else {
      runtime.push(name);
    }
    if (ts.getJSDocCommentsAndTags(statement).length === 0) missingTsdoc.push(name);
  }
  return Object.freeze({
    sourceFile,
    runtime: Object.freeze(sorted(runtime)),
    types: Object.freeze(sorted(types)),
    missingTsdoc: Object.freeze(sorted(missingTsdoc)),
  });
}

function reexportInventory(sourceText, fileName) {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.ES2023,
    true,
    fileName.endsWith(".js") ? ts.ScriptKind.JS : ts.ScriptKind.TS,
  );
  const runtime = [];
  const types = [];
  const modules = [];
  if (sourceFile.parseDiagnostics.length !== 0) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_PUBLIC_API_DRIFT",
      `${fileName} contains TypeScript parse diagnostics.`,
    );
  }
  for (const statement of sourceFile.statements) {
    if (
      !ts.isExportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.exportClause === undefined ||
      !ts.isNamedExports(statement.exportClause)
    ) {
      fail(
        "EDITOR_SOURCE_DOCUMENT_PUBLIC_API_DRIFT",
        `${fileName} may contain only explicit named re-exports.`,
      );
    }
    modules.push(statement.moduleSpecifier.text);
    for (const element of statement.exportClause.elements) {
      if (element.propertyName !== undefined) {
        fail(
          "EDITOR_SOURCE_DOCUMENT_PUBLIC_API_DRIFT",
          `${fileName} must not alias public exports.`,
        );
      }
      (statement.isTypeOnly || element.isTypeOnly ? types : runtime).push(element.name.text);
    }
  }
  return Object.freeze({
    sourceFile,
    runtime: Object.freeze(sorted(runtime)),
    types: Object.freeze(sorted(types)),
    modules: Object.freeze(sorted(modules)),
  });
}

function verifyTypescriptConfigContract(files) {
  const base = parseJson(files[BASE_TSCONFIG_PATH], BASE_TSCONFIG_PATH);
  const packageConfig = parseJson(files[PACKAGE_TSCONFIG_PATH], PACKAGE_TSCONFIG_PATH);
  const build = parseJson(files[BUILD_TSCONFIG_PATH], BUILD_TSCONFIG_PATH);
  const publicPackage = parseJson(files[PUBLIC_TSCONFIG_PATH], PUBLIC_TSCONFIG_PATH);
  if (
    !isDeepStrictEqual(base, {
      $schema: "https://json.schemastore.org/tsconfig",
      compilerOptions: EXPECTED_BASE_COMPILER_OPTIONS,
    }) ||
    !isDeepStrictEqual(packageConfig, {
      extends: "../../tsconfig.base.json",
      compilerOptions: { types: [] },
      include: ["src/**/*.ts", "src/**/*.tsx", "test/**/*.ts", "test/**/*.tsx"],
    }) ||
    !isDeepStrictEqual(build, {
      extends: "./tsconfig.json",
      compilerOptions: EXPECTED_BUILD_COMPILER_OPTIONS,
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: ["test/**/*", "**/*.test.ts", "**/*.test.tsx"],
    }) ||
    !isDeepStrictEqual(publicPackage, {
      extends: "./tsconfig.json",
      compilerOptions: EXPECTED_PUBLIC_COMPILER_OPTIONS,
      include: ["test/public-package.types.mts"],
      exclude: [],
    })
  ) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_TSCONFIG_DRIFT",
      "The editor-core TypeScript parent chain or reviewed config surface drifted.",
    );
  }
  const packageCompilerOptions = {
    ...base.compilerOptions,
    ...packageConfig.compilerOptions,
  };
  const buildCompilerOptions = {
    ...packageCompilerOptions,
    ...build.compilerOptions,
  };
  const publicCompilerOptions = {
    ...packageCompilerOptions,
    ...publicPackage.compilerOptions,
  };
  if (
    !isDeepStrictEqual(buildCompilerOptions, {
      ...EXPECTED_BASE_COMPILER_OPTIONS,
      types: [],
      ...EXPECTED_BUILD_COMPILER_OPTIONS,
    }) ||
    !isDeepStrictEqual(publicCompilerOptions, {
      ...EXPECTED_BASE_COMPILER_OPTIONS,
      types: [],
      ...EXPECTED_PUBLIC_COMPILER_OPTIONS,
    })
  ) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_TSCONFIG_DRIFT",
      "The effective editor-core build or public-package compiler contract drifted.",
    );
  }
  return deepFreeze({
    receipts: [
      BASE_TSCONFIG_PATH,
      PACKAGE_TSCONFIG_PATH,
      BUILD_TSCONFIG_PATH,
      PUBLIC_TSCONFIG_PATH,
    ],
    parents: {
      package: "../../tsconfig.base.json",
      build: "./tsconfig.json",
      publicPackage: "./tsconfig.json",
    },
    effective: {
      build: {
        strict: buildCompilerOptions.strict,
        noEmit: buildCompilerOptions.noEmit,
        declaration: buildCompilerOptions.declaration,
        declarationMap: buildCompilerOptions.declarationMap,
        sourceMap: buildCompilerOptions.sourceMap,
        rootDir: buildCompilerOptions.rootDir,
        outDir: buildCompilerOptions.outDir,
        types: buildCompilerOptions.types,
      },
      publicPackage: {
        strict: publicCompilerOptions.strict,
        noEmit: publicCompilerOptions.noEmit,
        module: publicCompilerOptions.module,
        moduleResolution: publicCompilerOptions.moduleResolution,
        target: publicCompilerOptions.target,
        types: publicCompilerOptions.types,
      },
    },
  });
}

function verifyRuntimeModuleClosure(files) {
  const validatorManifest = parseJson(files[VALIDATOR_PACKAGE_PATH], VALIDATOR_PACKAGE_PATH);
  const protocolManifest = parseJson(files[PROTOCOL_PACKAGE_PATH], PROTOCOL_PACKAGE_PATH);
  if (
    validatorManifest.name !== "@desen/validator" ||
    validatorManifest.type !== "module" ||
    !isDeepStrictEqual(validatorManifest.exports, EXPECTED_VALIDATOR_RUNTIME_EXPORTS) ||
    !isDeepStrictEqual(validatorManifest.dependencies, { "@desen/protocol": "workspace:*" }) ||
    ["bin", "browser", "imports", "main", "module"].some((field) =>
      Object.hasOwn(validatorManifest, field),
    ) ||
    protocolManifest.name !== "@desen/protocol" ||
    protocolManifest.type !== "module" ||
    !isDeepStrictEqual(protocolManifest.exports, EXPECTED_PROTOCOL_RUNTIME_EXPORTS) ||
    ["bin", "browser", "dependencies", "imports", "main", "module"].some((field) =>
      Object.hasOwn(protocolManifest, field),
    )
  ) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_DISTRIBUTION_DRIFT",
      "The isolated validator/protocol package-resolution contract drifted.",
    );
  }
  const modulePaths = new Set(EXECUTABLE_DISTRIBUTION_PATHS);
  const specifiersByModule = new Map();
  for (const relativePath of modulePaths) {
    const sourceFile = ts.createSourceFile(
      relativePath,
      files[relativePath],
      ts.ScriptTarget.ES2023,
      true,
      ts.ScriptKind.JS,
    );
    if (sourceFile.parseDiagnostics.length !== 0) {
      fail(
        "EDITOR_SOURCE_DOCUMENT_DISTRIBUTION_DRIFT",
        `Runtime closure module contains parse diagnostics: ${relativePath}.`,
      );
    }
    const specifiers = [];
    for (const statement of sourceFile.statements) {
      if (
        (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) &&
        statement.moduleSpecifier !== undefined
      ) {
        if (!ts.isStringLiteral(statement.moduleSpecifier)) {
          fail(
            "EDITOR_SOURCE_DOCUMENT_DISTRIBUTION_DRIFT",
            `Runtime closure module has a non-literal static edge: ${relativePath}.`,
          );
        }
        specifiers.push(statement.moduleSpecifier.text);
      }
    }
    let forbiddenModuleConstruct;
    const visit = (node) => {
      if (ts.isIdentifier(node) && node.text === "Function") {
        const prototypeAccess = node.parent;
        const toStringAccess = prototypeAccess.parent;
        if (
          !ts.isPropertyAccessExpression(prototypeAccess) ||
          prototypeAccess.expression !== node ||
          prototypeAccess.name.text !== "prototype" ||
          !ts.isPropertyAccessExpression(toStringAccess) ||
          toStringAccess.expression !== prototypeAccess ||
          toStringAccess.name.text !== "toString"
        ) {
          forbiddenModuleConstruct = "unsafe Function authority";
        }
      }
      if (ts.isIdentifier(node) && RUNTIME_CLOSURE_FORBIDDEN_IDENTIFIERS.includes(node.text)) {
        forbiddenModuleConstruct = `host identifier ${node.text}`;
      }
      if (
        (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) ||
        (ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          ["eval", "Function", "require"].includes(node.expression.text)) ||
        (ts.isNewExpression(node) &&
          ts.isIdentifier(node.expression) &&
          node.expression.text === "Function") ||
        ts.isMetaProperty(node) ||
        ts.isImportEqualsDeclaration(node) ||
        ts.isExternalModuleReference(node)
      ) {
        forbiddenModuleConstruct = ts.SyntaxKind[node.kind];
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    if (forbiddenModuleConstruct !== undefined) {
      fail(
        "EDITOR_SOURCE_DOCUMENT_DISTRIBUTION_DRIFT",
        `Runtime closure module has unreviewed host or module authority (${forbiddenModuleConstruct}): ${relativePath}.`,
      );
    }
    specifiersByModule.set(relativePath, specifiers);
  }

  const resolveSpecifier = (fromPath, specifier) => {
    if (specifier.startsWith(".")) {
      const packageRoot = fromPath.match(/^packages\/[^/]+/u)?.[0];
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(fromPath), specifier));
      if (
        packageRoot === undefined ||
        !target.startsWith(`${packageRoot}/`) ||
        !modulePaths.has(target)
      ) {
        fail(
          "EDITOR_SOURCE_DOCUMENT_DISTRIBUTION_DRIFT",
          `Runtime closure edge escapes captured authority: ${fromPath} -> ${specifier}.`,
        );
      }
      return target;
    }
    if (specifier === "@desen/validator" && fromPath.startsWith("packages/editor-core/")) {
      return "packages/validator/dist/index.js";
    }
    if (specifier === "@desen/protocol" && fromPath.startsWith("packages/validator/")) {
      return "packages/protocol/dist/index.js";
    }
    fail(
      "EDITOR_SOURCE_DOCUMENT_DISTRIBUTION_DRIFT",
      `Runtime closure has an unknown bare, URL, node, or absolute edge: ${fromPath} -> ${specifier}.`,
    );
  };

  const reachable = new Set();
  const pending = [DIST_INDEX_PATH];
  while (pending.length > 0) {
    const relativePath = pending.pop();
    if (reachable.has(relativePath)) continue;
    reachable.add(relativePath);
    for (const specifier of specifiersByModule.get(relativePath) ?? []) {
      const target = resolveSpecifier(relativePath, specifier);
      if (!reachable.has(target)) pending.push(target);
    }
  }
  if (!isDeepStrictEqual(sorted(reachable), sorted(modulePaths))) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_DISTRIBUTION_DRIFT",
      "The captured editor/validator/protocol runtime module set is not the exact reachable closure.",
      { reachable: sorted(reachable), captured: sorted(modulePaths) },
    );
  }
  return deepFreeze({
    entry: "@desen/editor-core",
    packageManifests: [PACKAGE_PATH, VALIDATOR_PACKAGE_PATH, PROTOCOL_PACKAGE_PATH],
    modules: sorted(modulePaths),
    receiptedRuntimeFiles: modulePaths.size + 3,
    proofOwnedHarnessFiles: 1,
    unknownStaticEsmEdges: 0,
  });
}

function verifySourceAndDistributionContract(files, packageManifest) {
  const typescript = verifyTypescriptConfigContract(files);
  const runtimeClosure = verifyRuntimeModuleClosure(files);
  const source = declarationInventory(files[SOURCE_PATH], SOURCE_PATH);
  const sourcePrivateStatements = source.sourceFile.statements.filter(
    (statement) =>
      !ts.isImportDeclaration(statement) &&
      !statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword),
  );
  const sourcePrivateDeclaration = sourcePrivateStatements[0]?.declarationList?.declarations?.[0];
  if (
    source.sourceFile.statements.length !== 9 ||
    sourcePrivateStatements.length !== 1 ||
    !ts.isVariableStatement(sourcePrivateStatements[0]) ||
    sourcePrivateStatements[0].declarationList.declarations.length !== 1 ||
    sourcePrivateDeclaration === undefined ||
    !ts.isIdentifier(sourcePrivateDeclaration.name) ||
    sourcePrivateDeclaration.name.text !== "EMPTY_DIAGNOSTICS" ||
    !exactJson(sorted([...source.runtime, ...source.types]), EXPECTED_SOURCE_EXPORTS) ||
    !exactJson(source.runtime, EXPECTED_RUNTIME_EXPORTS) ||
    !exactJson(source.types, EXPECTED_TYPE_EXPORTS) ||
    source.missingTsdoc.length !== 0
  ) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_SOURCE_CONTRACT_DRIFT",
      "The source document public declaration or TSDoc inventory drifted.",
      { runtime: source.runtime, types: source.types, missingTsdoc: source.missingTsdoc },
    );
  }
  const imports = source.sourceFile.statements.filter(ts.isImportDeclaration);
  const importProjection = imports.map((statement) => ({
    module: statement.moduleSpecifier.text,
    typeOnly: statement.importClause?.isTypeOnly === true,
  }));
  if (
    !exactJson(importProjection, [
      { module: "@desen/validator", typeOnly: false },
      { module: "@desen/protocol", typeOnly: true },
      { module: "@desen/validator", typeOnly: true },
    ])
  ) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_IMPORT_BOUNDARY_DRIFT",
      "The Source document may import only the validator at runtime and protocol/validator types.",
    );
  }

  const sourceIndex = reexportInventory(files[INDEX_PATH], INDEX_PATH);
  const distIndex = reexportInventory(files[DIST_INDEX_PATH], DIST_INDEX_PATH);
  const declarationIndex = reexportInventory(
    files[DIST_INDEX_DECLARATION_PATH],
    DIST_INDEX_DECLARATION_PATH,
  );
  if (
    !exactJson(sourceIndex.runtime, EXPECTED_RUNTIME_EXPORTS) ||
    !exactJson(sourceIndex.types, EXPECTED_TYPE_EXPORTS) ||
    !exactJson(sourceIndex.modules, ["./source-document.js", "./source-document.js"]) ||
    !exactJson(distIndex.runtime, EXPECTED_RUNTIME_EXPORTS) ||
    distIndex.types.length !== 0 ||
    !exactJson(distIndex.modules, ["./source-document.js"]) ||
    !exactJson(declarationIndex.runtime, EXPECTED_RUNTIME_EXPORTS) ||
    !exactJson(declarationIndex.types, EXPECTED_TYPE_EXPORTS) ||
    !exactJson(declarationIndex.modules, ["./source-document.js", "./source-document.js"])
  ) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_DISTRIBUTION_DRIFT",
      "Source and emitted package-root export inventories no longer agree.",
      {
        sourceIndex: {
          runtime: sourceIndex.runtime,
          types: sourceIndex.types,
          modules: sourceIndex.modules,
        },
        distIndex: {
          runtime: distIndex.runtime,
          types: distIndex.types,
          modules: distIndex.modules,
        },
        declarationIndex: {
          runtime: declarationIndex.runtime,
          types: declarationIndex.types,
          modules: declarationIndex.modules,
        },
      },
    );
  }

  const declaration = declarationInventory(
    files[DIST_SOURCE_DECLARATION_PATH],
    DIST_SOURCE_DECLARATION_PATH,
  );
  const declarationImportProjection = declaration.sourceFile.statements
    .filter(ts.isImportDeclaration)
    .map((statement) => ({
      module: statement.moduleSpecifier.text,
      typeOnly: statement.importClause?.isTypeOnly === true,
    }));
  if (
    declaration.sourceFile.statements.length !== 7 ||
    !exactJson(declaration.runtime, EXPECTED_RUNTIME_EXPORTS) ||
    !exactJson(declaration.types, EXPECTED_TYPE_EXPORTS) ||
    !exactJson(declarationImportProjection, [
      { module: "@desen/protocol", typeOnly: true },
      { module: "@desen/validator", typeOnly: true },
    ]) ||
    declaration.missingTsdoc.length !== 0
  ) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_DISTRIBUTION_DRIFT",
      "Emitted declarations lost the reviewed API or TSDoc contract.",
    );
  }

  const emittedSource = ts.createSourceFile(
    DIST_SOURCE_PATH,
    files[DIST_SOURCE_PATH],
    ts.ScriptTarget.ES2023,
    true,
    ts.ScriptKind.JS,
  );
  const emittedImports = emittedSource.statements
    .filter(ts.isImportDeclaration)
    .map((statement) => statement.moduleSpecifier.text);
  const emittedPrivateStatements = emittedSource.statements.filter(
    (statement) =>
      !ts.isImportDeclaration(statement) &&
      !statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword),
  );
  const emittedPrivateDeclaration = emittedPrivateStatements[0]?.declarationList?.declarations?.[0];
  if (
    emittedSource.parseDiagnostics.length !== 0 ||
    emittedSource.statements.length !== 3 ||
    emittedPrivateStatements.length !== 1 ||
    !ts.isVariableStatement(emittedPrivateStatements[0]) ||
    emittedPrivateStatements[0].declarationList.declarations.length !== 1 ||
    emittedPrivateDeclaration === undefined ||
    !ts.isIdentifier(emittedPrivateDeclaration.name) ||
    emittedPrivateDeclaration.name.text !== "EMPTY_DIAGNOSTICS" ||
    !exactJson(emittedImports, ["@desen/validator"])
  ) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_DISTRIBUTION_DRIFT",
      "Emitted runtime code acquired an unexpected import.",
    );
  }

  const forbidden = new Set();
  const isPropertyKey = (node) => {
    const parent = node.parent;
    return (
      (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
      ((ts.isPropertyAssignment(parent) ||
        ts.isPropertyDeclaration(parent) ||
        ts.isPropertySignature(parent) ||
        ts.isMethodDeclaration(parent) ||
        ts.isMethodSignature(parent) ||
        ts.isGetAccessorDeclaration(parent) ||
        ts.isSetAccessorDeclaration(parent)) &&
        parent.name === node)
    );
  };
  for (const sourceFile of [
    source.sourceFile,
    sourceIndex.sourceFile,
    distIndex.sourceFile,
    declaration.sourceFile,
    declarationIndex.sourceFile,
    emittedSource,
  ]) {
    function visit(node) {
      if (
        ts.isIdentifier(node) &&
        FORBIDDEN_IDENTIFIER_NAMES.includes(node.text) &&
        !isPropertyKey(node)
      ) {
        forbidden.add(node.text);
      }
      if (ts.isImportTypeNode(node)) {
        const literal = ts.isLiteralTypeNode(node.argument) ? node.argument.literal : undefined;
        forbidden.add(
          ts.isStringLiteral(literal) ? `import(${JSON.stringify(literal.text)})` : "import type",
        );
      }
      if (ts.isImportEqualsDeclaration(node) || ts.isExternalModuleReference(node)) {
        forbidden.add("require/import-equals");
      }
      if (ts.isModuleDeclaration(node)) forbidden.add("module declaration");
      if (ts.isExportAssignment(node)) forbidden.add("export assignment");
      if (ts.isMetaProperty(node)) forbidden.add("import.meta");
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        forbidden.add("dynamic import");
      }
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        (node.expression.text === "eval" || node.expression.text === "Function")
      ) {
        forbidden.add(node.expression.text);
      }
      ts.forEachChild(node, visit);
    }
    visit(sourceFile);
  }
  if (forbidden.size > 0) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_PLATFORM_BOUNDARY_DRIFT",
      "Platform or executable authority entered editor-core.",
      { forbidden: sorted(forbidden) },
    );
  }

  if (
    !isDeepStrictEqual(packageManifest, EXPECTED_PACKAGE_MANIFEST) ||
    PACKAGE_LIFECYCLE_SCRIPT_NAMES.some((name) => Object.hasOwn(packageManifest.scripts, name)) ||
    Object.hasOwn(packageManifest, "bin") ||
    Object.hasOwn(packageManifest, "browser") ||
    Object.hasOwn(packageManifest, "imports")
  ) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_MANIFEST_DRIFT",
      "The editor-core manifest lost its exact package, script, lifecycle, export, or dependency boundary.",
    );
  }

  return Object.freeze({
    runtimeExports: EXPECTED_RUNTIME_EXPORTS,
    typeExports: EXPECTED_TYPE_EXPORTS,
    publicDeclarations: EXPECTED_SOURCE_EXPORTS.length,
    tsdocDeclarations: EXPECTED_SOURCE_EXPORTS.length,
    runtimeImports: Object.freeze(["@desen/validator"]),
    typeImports: Object.freeze(["@desen/protocol", "@desen/validator"]),
    productionDependencies: Object.freeze(["@desen/protocol", "@desen/validator"]),
    runtimeClosure,
    packageScripts: Object.freeze(Object.keys(EXPECTED_PACKAGE_SCRIPTS)),
    lifecycleScripts: 0,
    typescript,
    platformImports: 0,
    executableAuthority: 0,
  });
}

function parseTestAuthority(files, relativePath, scriptKind) {
  const sourceFile = ts.createSourceFile(
    relativePath,
    files[relativePath],
    ts.ScriptTarget.ES2023,
    true,
    scriptKind,
  );
  if (sourceFile.parseDiagnostics.length !== 0) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_TEST_INVENTORY_DRIFT",
      `${relativePath} contains parse diagnostics.`,
    );
  }
  return sourceFile;
}

function directTestRegistration(call, callee) {
  if (
    !ts.isIdentifier(call.expression) ||
    call.expression.text !== callee ||
    call.arguments.length !== 2 ||
    !ts.isStringLiteral(call.arguments[0]) ||
    (!ts.isArrowFunction(call.arguments[1]) && !ts.isFunctionExpression(call.arguments[1])) ||
    call.arguments[1].parameters.length !== 0 ||
    !ts.isBlock(call.arguments[1].body) ||
    call.arguments[1].body.statements.length === 0
  ) {
    return undefined;
  }
  return { name: call.arguments[0].text, callback: call.arguments[1] };
}

function collectCalls(sourceFile, callee) {
  const calls = [];
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ((ts.isIdentifier(node.expression) && node.expression.text === callee) ||
        (ts.isPropertyAccessExpression(node.expression) &&
          ts.isIdentifier(node.expression.expression) &&
          node.expression.expression.text === callee))
    ) {
      calls.push(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return calls;
}

function exactExpectErrorDirectives(files, relativePath, scriptKind) {
  const sourceFile = parseTestAuthority(files, relativePath, scriptKind);
  const directives = sourceFile.commentDirectives ?? [];
  if (
    directives.length !== 5 ||
    directives.some((directive) => directive.type !== ts.CommentDirectiveType.ExpectError)
  ) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_TEST_INVENTORY_DRIFT",
      `${relativePath} must contain exactly five parsed @ts-expect-error directives.`,
    );
  }
  return directives.length;
}

function callbackFingerprint(callback, sourceFile) {
  const printed = ts
    .createPrinter({ newLine: ts.NewLineKind.LineFeed, removeComments: true })
    .printNode(ts.EmitHint.Unspecified, callback, sourceFile);
  return sha256(Buffer.from(printed, "utf8"));
}

function verifyTestInventory(files) {
  if (
    Object.entries(EXPECTED_TEST_AUTHORITY_SHA256).some(
      ([relativePath, expected]) => sha256(Buffer.from(files[relativePath], "utf8")) !== expected,
    )
  ) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_TEST_INVENTORY_DRIFT",
      "The reviewed package, public, compiler-negative, or root test source authority drifted.",
    );
  }
  const packageSourceFile = parseTestAuthority(files, PACKAGE_TEST_PATH, ts.ScriptKind.TS);
  const vitestImports = packageSourceFile.statements.filter(
    (statement) =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === "vitest",
  );
  const vitestBindings = vitestImports[0]?.importClause?.namedBindings;
  const topLevelDescribeCalls = packageSourceFile.statements
    .filter(ts.isExpressionStatement)
    .map((statement) => statement.expression)
    .filter(
      (expression) =>
        ts.isCallExpression(expression) &&
        ts.isIdentifier(expression.expression) &&
        expression.expression.text === "describe",
    );
  const describeRegistration =
    topLevelDescribeCalls.length === 1
      ? directTestRegistration(topLevelDescribeCalls[0], "describe")
      : undefined;
  const directPackageCalls =
    describeRegistration === undefined
      ? []
      : describeRegistration.callback.body.statements
          .filter(ts.isExpressionStatement)
          .map((statement) => statement.expression)
          .filter(ts.isCallExpression)
          .map((call) => directTestRegistration(call, "it"));
  const packageCallbackFingerprints = directPackageCalls.map((registration) =>
    registration === undefined
      ? undefined
      : callbackFingerprint(registration.callback, packageSourceFile),
  );
  if (
    vitestImports.length !== 1 ||
    vitestImports[0].importClause?.isTypeOnly === true ||
    vitestBindings === undefined ||
    !ts.isNamedImports(vitestBindings) ||
    !exactJson(
      vitestBindings.elements.map((element) => ({
        imported: element.propertyName?.text ?? element.name.text,
        local: element.name.text,
        typeOnly: element.isTypeOnly,
      })),
      [
        { imported: "describe", local: "describe", typeOnly: false },
        { imported: "expect", local: "expect", typeOnly: false },
        { imported: "it", local: "it", typeOnly: false },
      ],
    ) ||
    describeRegistration === undefined ||
    collectCalls(packageSourceFile, "describe").length !== 1 ||
    describeRegistration.callback.body.statements.length !== 7 ||
    directPackageCalls.length !== 7 ||
    directPackageCalls.some((registration) => registration === undefined) ||
    collectCalls(packageSourceFile, "it").length !== 7 ||
    !exactJson(packageCallbackFingerprints, EXPECTED_PACKAGE_TEST_CALLBACK_FINGERPRINTS)
  ) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_TEST_INVENTORY_DRIFT",
      "The package proof must bind Vitest directly and register seven runnable direct it cases in one top-level describe.",
    );
  }

  const publicSourceFile = parseTestAuthority(files, PUBLIC_TEST_PATH, ts.ScriptKind.JS);
  const publicNodeTestImports = publicSourceFile.statements.filter(
    (statement) =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === "node:test",
  );
  const publicTopLevelTestCalls = publicSourceFile.statements
    .filter(ts.isExpressionStatement)
    .map((statement) => statement.expression)
    .filter(
      (expression) =>
        ts.isCallExpression(expression) &&
        ts.isIdentifier(expression.expression) &&
        expression.expression.text === "test",
    );
  const publicRegistrations = publicTopLevelTestCalls.map((call) =>
    directTestRegistration(call, "test"),
  );
  const publicCallbackFingerprints = publicRegistrations.map((registration) =>
    registration === undefined
      ? undefined
      : callbackFingerprint(registration.callback, publicSourceFile),
  );
  if (
    publicNodeTestImports.length !== 1 ||
    publicNodeTestImports[0].importClause?.isTypeOnly === true ||
    publicNodeTestImports[0].importClause?.name?.text !== "test" ||
    publicNodeTestImports[0].importClause?.namedBindings !== undefined ||
    publicTopLevelTestCalls.length !== 17 ||
    collectCalls(publicSourceFile, "test").length !== 17 ||
    publicRegistrations.some((registration) => registration === undefined) ||
    !exactJson(publicCallbackFingerprints, EXPECTED_PUBLIC_TEST_CALLBACK_FINGERPRINTS)
  ) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_TEST_INVENTORY_DRIFT",
      "The public proof must default-bind node:test and register seventeen runnable direct top-level cases.",
    );
  }

  const rootSourceFile = parseTestAuthority(files, ROOT_TEST_PATH, ts.ScriptKind.JS);
  const nodeTestImports = rootSourceFile.statements.filter(
    (statement) =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === "node:test",
  );
  const nodeTestBindings = nodeTestImports[0]?.importClause?.namedBindings;
  if (
    nodeTestImports.length !== 1 ||
    nodeTestImports[0].importClause?.isTypeOnly === true ||
    nodeTestBindings === undefined ||
    !ts.isNamedImports(nodeTestBindings) ||
    !exactJson(
      nodeTestBindings.elements.map((element) => ({
        imported: element.propertyName?.text ?? element.name.text,
        local: element.name.text,
        typeOnly: element.isTypeOnly,
      })),
      [
        { imported: "after", local: "after", typeOnly: false },
        { imported: "before", local: "before", typeOnly: false },
        { imported: "test", local: "test", typeOnly: false },
      ],
    )
  ) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_TEST_INVENTORY_DRIFT",
      "The root proof cases must bind test directly from node:test without aliases.",
    );
  }
  const allRootTestCalls = collectCalls(rootSourceFile, "test");
  const topLevelRootTestCalls = rootSourceFile.statements
    .filter(ts.isExpressionStatement)
    .map((statement) => statement.expression)
    .filter(
      (expression) =>
        ts.isCallExpression(expression) &&
        ts.isIdentifier(expression.expression) &&
        expression.expression.text === "test",
    );
  const rootRegistrations = topLevelRootTestCalls.map((call) =>
    directTestRegistration(call, "test"),
  );
  const rootTestNames = rootRegistrations.map((registration) => registration?.name);
  const rootCallbackFingerprints = rootRegistrations.map((registration) =>
    registration === undefined
      ? undefined
      : callbackFingerprint(registration.callback, rootSourceFile),
  );
  if (
    allRootTestCalls.length !== topLevelRootTestCalls.length ||
    rootRegistrations.some((registration) => registration === undefined) ||
    rootTestNames.some((name) => name === undefined) ||
    !exactJson(rootCallbackFingerprints, EXPECTED_ROOT_TEST_CALLBACK_FINGERPRINTS)
  ) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_TEST_INVENTORY_DRIFT",
      "Every M08-T01 root proof case must be a direct, runnable top-level test registration.",
    );
  }
  const inventory = deepFreeze({
    registrationAuthority: "TYPESCRIPT_AST",
    runnerReceipts: 0,
    packageRuntimeCases: directPackageCalls.length,
    sourceCompilerNegativeCases: exactExpectErrorDirectives(
      files,
      PACKAGE_TYPES_PATH,
      ts.ScriptKind.TS,
    ),
    publicRuntimeContractCases: publicRegistrations.filter(
      (registration) => !registration.name.startsWith("[proof-core]"),
    ).length,
    publicCompilerNegativeCases: exactExpectErrorDirectives(
      files,
      PUBLIC_TYPES_PATH,
      ts.ScriptKind.TS,
    ),
    publicProofCoreCases: publicRegistrations.filter((registration) =>
      registration.name.startsWith("[proof-core]"),
    ).length,
    rootProofCases: rootTestNames.length,
    rootTestNames,
  });
  if (
    !exactJson(inventory, {
      registrationAuthority: "TYPESCRIPT_AST",
      runnerReceipts: 0,
      packageRuntimeCases: 7,
      sourceCompilerNegativeCases: 5,
      publicRuntimeContractCases: 10,
      publicCompilerNegativeCases: 5,
      publicProofCoreCases: 7,
      rootProofCases: EDITOR_CORE_SOURCE_DOCUMENT_ROOT_TEST_NAMES.length,
      rootTestNames: EDITOR_CORE_SOURCE_DOCUMENT_ROOT_TEST_NAMES,
    })
  ) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_TEST_INVENTORY_DRIFT",
      "The reviewed M08-T01 focused test inventory drifted.",
      { actual: inventory },
    );
  }
  return inventory;
}

async function trackedInventory(overrides, capturedBytes) {
  const entries = [];
  for (const relativePath of EXPECTED_TRACKED_PATHS) {
    const bytes = Object.hasOwn(capturedBytes, relativePath)
      ? capturedBytes[relativePath]
      : await readTrackedBytes(relativePath, overrides);
    entries.push(
      Object.freeze({ path: relativePath, bytes: bytes.byteLength, sha256: sha256(bytes) }),
    );
  }
  return Object.freeze(entries);
}

async function authenticatePrerequisite(options) {
  const bytes =
    options.prerequisiteBytes ??
    (await readRegularAuthority(options.prerequisitePath, "I07-04/G07 prerequisite"));
  const pin = EDITOR_CORE_SOURCE_DOCUMENT_PREREQUISITE_PIN;
  if (bytes.byteLength !== pin.bytes || sha256(bytes) !== pin.sha256) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_PREREQUISITE_DRIFT",
      "The exact I07-04/G07 prerequisite bytes drifted.",
      {
        expectedBytes: pin.bytes,
        actualBytes: bytes.byteLength,
        expectedSha256: pin.sha256,
        actualSha256: sha256(bytes),
      },
    );
  }
  let authority;
  try {
    authority = JSON.parse(fatalUtf8(bytes, I07_04_PREREQUISITE_PATH));
  } catch (error) {
    if (error instanceof EditorCoreSourceDocumentProofError) throw error;
    fail(
      "EDITOR_SOURCE_DOCUMENT_PREREQUISITE_DRIFT",
      "The exact I07-04/G07 prerequisite is not valid JSON.",
    );
  }
  const cutover = authority.cutover;
  if (
    authority.schemaVersion !== 1 ||
    authority.profile !== "desen.ci.affected-selector-promotion-evidence.v1" ||
    authority.task !== "I07-04" ||
    authority.repository !== "https://github.com/desenlab/desen-app" ||
    !Array.isArray(authority.observations) ||
    authority.observations.length !== 20 ||
    authority.observations.some(
      (observation) =>
        observation?.quality?.status !== "PASS" ||
        observation.quality.authority !== "REQUIRED" ||
        observation.quality.scope !== "EXHAUSTIVE" ||
        observation?.affected?.status !== "PASS" ||
        observation.affected.freshExecution !== true ||
        observation.affected.cachedSuccessRead !== false,
    ) ||
    authority.threshold?.minimumConsecutiveEligibleComparisons !== 20 ||
    authority.threshold.eligibleComparisons !== 20 ||
    authority.threshold.consecutiveEligibleComparisons !== 20 ||
    authority.threshold.falseNegatives !== 0 ||
    authority.threshold.sameRevisionWithinComparison !== true ||
    authority.threshold.freshHostedExecution !== true ||
    authority.threshold.cachedSuccessAllowed !== false ||
    authority.threshold.satisfied !== true ||
    authority.decision?.status !== "PROMOTION_AUTHORIZED" ||
    authority.decision.affectedPromotionAuthorized !== true ||
    authority.decision.eligiblePullRequests !== "REQUIRED_AFFECTED" ||
    authority.decision.unsafePullRequests !== "REQUIRED_EXHAUSTIVE" ||
    authority.decision.main !== "REQUIRED_EXHAUSTIVE" ||
    authority.decision.release !== "REQUIRED_EXHAUSTIVE" ||
    authority.decision.manualAudit !== "REQUIRED_EXHAUSTIVE" ||
    cutover?.status !== "HOSTED_CUTOVER_VERIFIED" ||
    cutover?.cleanup?.status !== "PASS" ||
    cutover.cleanup.authority !== "REQUIRED" ||
    cutover.cleanup.scope !== "EXHAUSTIVE" ||
    cutover?.main?.status !== "PASS" ||
    cutover.main.authority !== "REQUIRED" ||
    cutover.main.scope !== "EXHAUSTIVE" ||
    cutover?.affectedCanary?.status !== "PASS" ||
    cutover.affectedCanary.authority !== "REQUIRED" ||
    cutover.affectedCanary.effectiveScope !== "AFFECTED" ||
    cutover.affectedCanary.freshExecution !== true ||
    cutover.affectedCanary.cachedSuccessRead !== false ||
    cutover?.proofReaderCheckpoint?.liveVerification !== "PASS" ||
    cutover?.infrastructureDebt?.status !== "CLOSED" ||
    cutover.infrastructureDebt.zeroReferences !== "PASS" ||
    cutover.infrastructureDebt.removedPendingHostedProofCount !== 0
  ) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_PREREQUISITE_DRIFT",
      "The pinned I07-04 authority does not close the formal G07 prerequisite.",
    );
  }
  return deepFreeze({
    ...pin,
    result: "PASS",
    status: "DONE",
    authority: {
      profile: authority.profile,
      observations: authority.observations.length,
      falseNegatives: authority.threshold.falseNegatives,
      promotion: authority.decision.status,
      cutover: cutover.status,
      cleanup: {
        revision: cutover.cleanup.receiptRevision,
        runId: cutover.cleanup.runId,
        jobId: cutover.cleanup.jobId,
        receiptSha256: cutover.cleanup.receiptSha256,
        authority: cutover.cleanup.authority,
        scope: cutover.cleanup.scope,
        result: cutover.cleanup.status,
      },
      main: {
        revision: cutover.main.receiptRevision,
        runId: cutover.main.runId,
        jobId: cutover.main.jobId,
        receiptSha256: cutover.main.receiptSha256,
        authority: cutover.main.authority,
        scope: cutover.main.scope,
        result: cutover.main.status,
      },
      affectedCanary: {
        revision: cutover.affectedCanary.executionRevision,
        runId: cutover.affectedCanary.runId,
        jobId: cutover.affectedCanary.jobId,
        receiptSha256: cutover.affectedCanary.receiptSha256,
        authority: cutover.affectedCanary.authority,
        scope: cutover.affectedCanary.effectiveScope,
        freshExecution: cutover.affectedCanary.freshExecution,
        cachedSuccessRead: cutover.affectedCanary.cachedSuccessRead,
        result: cutover.affectedCanary.status,
      },
      proofReaderCheckpoint: cutover.proofReaderCheckpoint,
      infrastructureDebt: {
        status: cutover.infrastructureDebt.status,
        zeroReferences: cutover.infrastructureDebt.zeroReferences,
        removedPendingHostedProofCount: cutover.infrastructureDebt.removedPendingHostedProofCount,
        liveVerification: cutover.infrastructureDebt.liveVerification,
      },
    },
  });
}

function buildOptionsFromCapture(options) {
  return {
    ...(options.dependencyAuthorityBytes === undefined
      ? { dependencyAuthorityPath: options.dependencyAuthorityPath }
      : { dependencyAuthorityBytes: options.dependencyAuthorityBytes }),
    ...(options.fileOverridesProvided ? { fileOverrides: options.fileOverrides } : {}),
    ...(options.runtimeApiProvided ? { runtimeApi: options.runtimeApi } : {}),
    ...(options.prerequisiteBytes === undefined
      ? { prerequisitePath: options.prerequisitePath }
      : { prerequisiteBytes: options.prerequisiteBytes }),
  };
}

/** Builds final deterministic M08-T01 evidence from the emitted public package. */
export async function buildEditorCoreSourceDocumentEvidence(rawOptions = undefined) {
  const options = captureBuildOptions(rawOptions);
  const paths = [
    BASE_TSCONFIG_PATH,
    FIXTURE_PATH,
    PACKAGE_PATH,
    PACKAGE_TSCONFIG_PATH,
    BUILD_TSCONFIG_PATH,
    PUBLIC_TSCONFIG_PATH,
    ...RUNTIME_DEPENDENCY_PATHS,
    SOURCE_PATH,
    INDEX_PATH,
    DIST_SOURCE_PATH,
    DIST_INDEX_PATH,
    DIST_SOURCE_DECLARATION_PATH,
    DIST_INDEX_DECLARATION_PATH,
    PACKAGE_TEST_PATH,
    PACKAGE_TYPES_PATH,
    PUBLIC_TEST_PATH,
    PUBLIC_TYPES_PATH,
    ROOT_TEST_PATH,
  ];
  const capturedByteValues = await Promise.all(
    paths.map((relativePath) => readTrackedBytes(relativePath, options.fileOverrides)),
  );
  const fileBytes = Object.freeze(
    Object.fromEntries(
      paths.map((relativePath, index) => [relativePath, capturedByteValues[index]]),
    ),
  );
  const files = Object.freeze(
    Object.fromEntries(
      paths.map((relativePath) => [relativePath, fatalUtf8(fileBytes[relativePath], relativePath)]),
    ),
  );
  const officialSource = parseJson(files[FIXTURE_PATH], FIXTURE_PATH);
  const packageManifest = parseJson(files[PACKAGE_PATH], PACKAGE_PATH);
  const dependencyAuthority = await authenticateRuntimeDependencyAuthority(options, fileBytes);
  const boundary = verifySourceAndDistributionContract(files, packageManifest);
  const runtimeApi = options.runtimeApi ?? (await importReceiptedRuntime(fileBytes));
  const documentModel = verifyRuntimeBehavior(runtimeApi, officialSource);
  if (options.runtimeApiProvided) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_OPTIONS_INVALID",
      "A mutation runtime cannot issue final M08-T01 PASS evidence.",
    );
  }
  const tests = verifyTestInventory(files);
  if (options.fileOverridesProvided) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_OPTIONS_INVALID",
      "Mutation file overrides cannot issue final M08-T01 PASS evidence.",
    );
  }
  const trackedFiles = await trackedInventory(options.fileOverrides, fileBytes);
  const prerequisite = await authenticatePrerequisite(options);
  const executionAuthority = deepFreeze({
    dependencyAuthority,
    editorPackagePath: PACKAGE_PATH,
    editorDistributionPaths: [DIST_INDEX_PATH, DIST_SOURCE_PATH],
    runtimeDependencyPaths: RUNTIME_DEPENDENCY_PATHS,
    receiptedRuntimeFiles: 3 + RUNTIME_DEPENDENCY_PATHS.length,
    proofOwnedHarnessFiles: 1,
    exactReceiptedBytes: true,
    runtimeOverridesCanPass: false,
    fileOverridesCanPass: false,
  });

  const artifact = deepFreeze({
    schemaVersion: 1,
    proofId: "editor-core-source-document",
    profile: "desen.editor-core.source-document-proof.v1",
    task: "M08-T01",
    result: "PASS",
    prerequisite,
    claim: {
      protocol: "0.1.0",
      platform: "platform-neutral",
      directSourceRoot: true,
      structuralAdmissionOnly: true,
      semanticValidation: false,
      taskStatus: "DONE",
      prerequisiteGate: "G07",
      prerequisiteStatus: "DONE",
    },
    publicApi: {
      runtimeExports: boundary.runtimeExports,
      typeExports: boundary.typeExports,
      publicDeclarations: boundary.publicDeclarations,
      tsdocDeclarations: boundary.tsdocDeclarations,
    },
    documentModel,
    executionAuthority,
    structuralAdmission: {
      officialFixture: FIXTURE_PATH,
      exactFixtureIdentity: true,
      unresolvedSemanticReferenceAccepted: true,
      failureExposesPartialDocument: false,
    },
    boundary,
    evidence: { tests, trackedFiles },
    nonclaims: [
      "The exact pinned dependency bytes plus the Node runtime, loader, and process environment are trusted authorities; M08-T01 is not a general hostile-JavaScript capability sandbox.",
      "M08-T01 defines admission and immutable ownership only; mutation commands and stable-ID allocation remain assigned to M08-T02 through M08-T06.",
      "Persistence and authoring-extension round trips remain assigned to M08-T07 and M08-T08.",
      "Continuous semantic validation and invalid-node mapping remain assigned to M08-T09.",
      "The React/DOM boundary and terminal editor determinism proof remain assigned to M08-T10 and G08.",
    ],
    reproduction: [
      "pnpm --filter @desen/editor-core build",
      "pnpm --filter @desen/editor-core test:source-document",
      "pnpm --filter @desen/editor-core test:public-package",
      "node scripts/generate-editor-core-source-document-proof.mjs",
      "node scripts/verify-editor-core-source-document.mjs",
      "node --test tests/editor-core-source-document.test.mjs",
    ],
  });
  const artifactText = await format(JSON.stringify(artifact), {
    parser: "json",
    printWidth: 100,
    tabWidth: 2,
    endOfLine: "lf",
  });
  const artifactBytes = Buffer.from(artifactText, "utf8");
  return Object.freeze({
    artifact,
    artifactBytes,
    artifactSha256: sha256(artifactBytes),
  });
}

function visibleHtmlSegments(line, containers) {
  const voidElements = new Set([
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
  ]);
  const tagPattern = /<\s*(\/?)\s*([A-Za-z][\w:-]*)([^>]*)>/gu;
  let cursor = 0;
  let visible = "";
  let excluded = "";
  for (const match of line.matchAll(tagPattern)) {
    if (containers.length === 0) visible += line.slice(cursor, match.index);
    else excluded += line.slice(cursor, match.index);
    const closing = match[1] === "/";
    const name = match[2].toLowerCase();
    const attributes = match[3];
    if (closing) {
      const matchingIndex = containers.findLastIndex((container) => container.name === name);
      if (matchingIndex >= 0) containers.splice(matchingIndex);
    } else if (!attributes.trimEnd().endsWith("/") && !voidElements.has(name)) {
      containers.push({ name });
    }
    cursor = match.index + match[0].length;
  }
  if (containers.length === 0) visible += line.slice(cursor);
  else excluded += line.slice(cursor);
  return { visible, excluded };
}

function visibleProofDocumentLines(document) {
  const visible = [];
  const htmlAuthority = [];
  const rawAuthority = [];
  let fence;
  let insideComment = false;
  const htmlContainers = [];
  for (const rawLine of document.split(/\r?\n/u)) {
    if (fence !== undefined) {
      const fenceMatch = rawLine.match(/^ {0,3}(`{3,}|~{3,})(.*)$/u);
      if (
        fenceMatch !== null &&
        fenceMatch[1][0] === fence.marker &&
        fenceMatch[1].length >= fence.length &&
        fenceMatch[2].trim() === ""
      ) {
        fence = undefined;
      }
      continue;
    }
    let remainder = rawLine;
    let line = "";
    while (remainder.length > 0) {
      if (insideComment) {
        const commentEnd = remainder.indexOf("-->");
        if (commentEnd < 0) {
          remainder = "";
        } else {
          insideComment = false;
          remainder = remainder.slice(commentEnd + 3);
        }
        continue;
      }
      const commentStart = remainder.indexOf("<!--");
      if (commentStart < 0) {
        line += remainder;
        remainder = "";
      } else {
        line += remainder.slice(0, commentStart);
        insideComment = true;
        remainder = remainder.slice(commentStart + 4);
      }
    }
    if (/^(?: {4}|\t)/u.test(line)) continue;
    const htmlSegments = visibleHtmlSegments(line, htmlContainers);
    const htmlVisibleLine = htmlSegments.visible;
    if (htmlSegments.excluded.trim() !== "") htmlAuthority.push(htmlSegments.excluded);
    const fenceMatch = htmlVisibleLine.match(/^ {0,3}(`{3,}|~{3,})(.*)$/u);
    if (fenceMatch !== null) {
      fence = { marker: fenceMatch[1][0], length: fenceMatch[1].length };
      continue;
    }
    rawAuthority.push(line);
    visible.push(htmlVisibleLine.trimEnd());
  }
  return {
    visible,
    htmlAuthority,
    rawHtml: /<\s*\/?\s*[A-Za-z][\s\S]*?>/u.test(rawAuthority.join("\n")),
  };
}

function proofDocumentHasContradictoryStatus(visibleLines) {
  for (const line of visibleLines) {
    const normalized = line
      .replace(/\\([`*_~])/gu, "$1")
      .replace(/[`*_~]/gu, "")
      .replace(/\s+/gu, " ")
      .trim();
    const field = normalized.match(/\b(?:result|status)\s*:\s*(.*)$/iu);
    if (field === null) continue;
    const value = field[1].trim();
    if (
      !/^(?:PASS|DONE)\b/iu.test(value) ||
      /\b(?:BLOCKED|ERROR|FAIL(?:ED|URE)?|INCOMPLETE|IN[ _-]?PROGRESS|NOT[ _-]?STARTED|PENDING|SKIPPED|TODO|UNKNOWN)\b/iu.test(
        value,
      )
    ) {
      return true;
    }
  }
  return false;
}

function proofDocumentHasExactPin(document, artifactSha256) {
  if (typeof document !== "string") return false;
  const artifactLine = `Artifact: \`${ARTIFACT_PATH}\``;
  const receiptLine = `Final receipt: \`sha256:${artifactSha256}\``;
  const { visible: visibleLines, htmlAuthority, rawHtml } = visibleProofDocumentLines(document);
  const receiptLines = visibleLines.filter((line) =>
    /^Final receipt: `sha256:[0-9a-f]{64}`$/u.test(line),
  );
  return (
    visibleLines.filter((line) => line === "## Result").length === 1 &&
    visibleLines.filter((line) => line === artifactLine).length === 1 &&
    visibleLines.filter((line) => line === receiptLine).length === 1 &&
    receiptLines.length === 1 &&
    !rawHtml &&
    !proofDocumentHasContradictoryStatus([...visibleLines, ...htmlAuthority]) &&
    !visibleLines.join("\n").includes("sha256:PENDING")
  );
}

/** Rebuilds M08-T01 and verifies exact artifact bytes plus the human proof digest pin. */
export async function verifyEditorCoreSourceDocumentEvidence(rawOptions = undefined) {
  const options = captureVerifyOptions(rawOptions);
  if (options.proofDocument !== undefined && typeof options.proofDocument !== "string") {
    fail(
      "EDITOR_SOURCE_DOCUMENT_OPTIONS_INVALID",
      "proofDocument must be UTF-8 text when provided.",
    );
  }
  const built = await buildEditorCoreSourceDocumentEvidence(buildOptionsFromCapture(options.build));
  const artifactBytes =
    options.artifactBytes ??
    (await readRegularAuthority(options.artifactPath, "M08-T01 proof artifact"));
  if (!Buffer.from(artifactBytes).equals(Buffer.from(built.artifactBytes))) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_ARTIFACT_DRIFT",
      "The committed M08-T01 artifact is not exactly reproducible.",
    );
  }
  const proofDocument =
    options.proofDocument ??
    fatalUtf8(
      await readRegularAuthority(options.proofDocumentPath, "M08-T01 proof document"),
      PROOF_DOCUMENT_PATH,
    );
  if (!proofDocumentHasExactPin(proofDocument, built.artifactSha256)) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_PROOF_PIN_DRIFT",
      "The M08-T01 proof document lacks one exact final artifact pin.",
    );
  }
  return deepFreeze({
    task: "M08-T01",
    result: "PASS",
    artifactSha256: built.artifactSha256,
    prerequisiteTask: built.artifact.prerequisite.task,
    prerequisiteGate: built.artifact.prerequisite.gate,
    trackedFiles: built.artifact.evidence.trackedFiles.length,
    rootProofCases: built.artifact.evidence.tests.rootProofCases,
  });
}

async function assertSafeWriteDestination(artifactPath) {
  const parent = await realpath(path.dirname(artifactPath)).catch(() => undefined);
  if (parent === undefined || path.join(parent, path.basename(artifactPath)) !== artifactPath) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_ARTIFACT_WRITE_FAILED",
      "The M08-T01 artifact destination parent must be canonical.",
    );
  }
  let entry;
  try {
    entry = await lstat(artifactPath);
  } catch (error) {
    if (error?.code === "ENOENT") return;
    fail(
      "EDITOR_SOURCE_DOCUMENT_ARTIFACT_WRITE_FAILED",
      "The M08-T01 artifact destination could not be inspected.",
    );
  }
  if (!entry.isFile() || entry.isSymbolicLink() || entry.nlink !== 1) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_ARTIFACT_WRITE_FAILED",
      "The M08-T01 artifact destination must be one regular non-linked file.",
    );
  }
}

/** Atomically commits exact M08-T01 artifact bytes after a complete successful build. */
export async function writeEditorCoreSourceDocumentEvidence(rawOptions = undefined) {
  const options = captureWriteOptions(rawOptions);
  const built = await buildEditorCoreSourceDocumentEvidence(buildOptionsFromCapture(options.build));
  await assertSafeWriteDestination(options.artifactPath);
  try {
    await writeAtomicProofArtifact({
      artifactPath: options.artifactPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename: options.beforeAtomicRename,
    });
  } catch {
    fail(
      "EDITOR_SOURCE_DOCUMENT_ARTIFACT_WRITE_FAILED",
      "The M08-T01 artifact could not be committed atomically.",
    );
  }
  const committed = await readRegularAuthority(options.artifactPath, "M08-T01 proof artifact");
  if (!committed.equals(built.artifactBytes)) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_ARTIFACT_WRITE_FAILED",
      "The committed M08-T01 artifact bytes changed after atomic write.",
    );
  }
  return deepFreeze({
    task: "M08-T01",
    result: "PASS",
    artifactPath: options.artifactPath,
    artifactSha256: built.artifactSha256,
  });
}
