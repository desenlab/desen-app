import { createHash } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual, types as utilTypes } from "node:util";
import { fileURLToPath } from "node:url";
import { format } from "prettier";

import * as designSystemCore from "../../packages/design-system-core/dist/index.js";

import { readCheckpointedFrozenArtifact } from "../ci/proof-reader-checkpoints.mjs";
import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ARTIFACT_RELATIVE_PATH = "docs/proof/artifacts/m10a-t02.json";
const PROOF_DOCUMENT_RELATIVE_PATH = "docs/proof/M10A-T02.md";
const SOURCE_FIXTURE_PATH =
  "packages/protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json";
const PACKAGE_MANIFEST_PATH = "packages/design-system-core/package.json";
const SC01_ARTIFACT_PATH = "docs/proof/artifacts/sc-01-dtcg-compatibility.json";
const MAX_AUTHORITY_BYTES = 16 * 1_024 * 1_024;
const READ_FLAGS =
  fileConstants.O_RDONLY | (fileConstants.O_NOFOLLOW ?? 0) | (fileConstants.O_NONBLOCK ?? 0);

const SOURCE_FIXTURE_PIN = Object.freeze({
  path: SOURCE_FIXTURE_PATH,
  bytes: 4_719,
  sha256: "c4b81882420d1b861dbf421da30c1447558560401f697fb7e3883fd6aaf0f7e1",
});

/** Exact immutable SC-01 task-time artifact retained by the T02 successor. */
export const M10A_T02_SC01_PIN = Object.freeze({
  task: "SC-01",
  path: SC01_ARTIFACT_PATH,
  bytes: 31_286,
  sha256: "1df806e0b56d66e27558bbc2bb2f17e0e261b0103c90ed2658ad1eba4c3bdbc6",
  classification: "DTCG_2025_10_COMPATIBLE_CLOSED_REFERENCE_PROFILE",
  leaves: 26,
});

const PACKAGE_AUTHORITY_PATHS = Object.freeze([
  PACKAGE_MANIFEST_PATH,
  "packages/design-system-core/README.md",
  "packages/design-system-core/src/diagnostics.ts",
  "packages/design-system-core/src/index.ts",
  "packages/design-system-core/src/inert-json.ts",
  "packages/design-system-core/src/project-migrations.ts",
  "packages/design-system-core/src/project-record.ts",
  "packages/design-system-core/src/token-document.ts",
  "packages/design-system-core/src/token-resolver.ts",
  "packages/design-system-core/src/token-types.ts",
  "packages/design-system-core/test/project-migrations.test.ts",
  "packages/design-system-core/test/project-migrations.types.ts",
  "packages/design-system-core/test/project-record.test.ts",
  "packages/design-system-core/test/project-record.types.ts",
  "packages/design-system-core/test/public-package.mjs",
  "packages/design-system-core/test/public-package.types.mts",
  "packages/design-system-core/test/token-document.test.ts",
  "packages/design-system-core/test/token-document.types.ts",
  "packages/design-system-core/test/token-resolver.test.ts",
  "packages/design-system-core/test/token-resolver.types.ts",
  "packages/design-system-core/tsconfig.build.json",
  "packages/design-system-core/tsconfig.json",
  "packages/design-system-core/tsconfig.public-package.json",
]);

const REQUIRED_RUNTIME_EXPORTS = Object.freeze([
  "DESIGN_TOKEN_PROFILE",
  "EDITABLE_PROJECT_KIND",
  "EDITABLE_PROJECT_LIMITS",
  "EDITABLE_PROJECT_SCHEMA_VERSION",
  "SUPPORTED_EDITABLE_PROJECT_SCHEMA_VERSIONS",
  "admitDtcgTokenDocument",
  "admitEditableProjectRecord",
  "getDesignTokenValueFamily",
  "getDtcgAliasTarget",
  "isDtcgTokenAlias",
  "migrateEditableProjectRecord",
  "resolveDesignTokens",
]);

const RUNTIME_FUNCTION_EXPORTS = Object.freeze([
  "admitDtcgTokenDocument",
  "admitEditableProjectRecord",
  "getDesignTokenValueFamily",
  "getDtcgAliasTarget",
  "isDtcgTokenAlias",
  "migrateEditableProjectRecord",
  "resolveDesignTokens",
]);

const EXPECTED_PROFILE_KEYS = Object.freeze([
  "colorSpaces",
  "dimensionUnits",
  "durationUnits",
  "formatVersion",
  "limits",
  "metadataMembers",
  "motionTypes",
  "tokenTypes",
  "wholeTokenAliasesOnly",
]);

const EXPECTED_PROFILE_LIMIT_KEYS = Object.freeze([
  "maxAliasDepth",
  "maxArrayItems",
  "maxDocumentCharacters",
  "maxJsonDepth",
  "maxJsonNodes",
  "maxModesAsSources",
  "maxResolutionSteps",
  "maxShadowLayers",
  "maxSources",
  "maxStringLength",
  "maxTokenCount",
  "maxTokenPathLength",
  "maxTokenPathSegments",
]);

const EXPECTED_TOKEN_TYPES = Object.freeze([
  "border",
  "color",
  "cubicBezier",
  "dimension",
  "duration",
  "number",
  "shadow",
  "transition",
  "typography",
]);
const EXPECTED_TOKEN_FAMILIES = Object.freeze([
  "border",
  "color",
  "dimension",
  "motion",
  "number",
  "shadow",
  "typography",
]);
const EXPECTED_MOTION_TYPES = Object.freeze(["duration", "cubicBezier", "transition"]);

/** Stable root-test declarations embedded in the deterministic T02 artifact. */
export const M10A_T02_ROOT_TEST_NAMES = Object.freeze([
  "M10A-T02 builds deterministic evidence through the built public package",
  "M10A-T02 proves a lossless immutable project export and reimport",
  "M10A-T02 proves nine DTCG types seven families and deterministic precedence",
  "M10A-T02 rejects alias cycle missing target type mismatch overflow and unsafe data",
  "M10A-T02 preserves the exact historical 26-leaf SC-01 artifact",
  "M10A-T02 rejects public-runtime package and historical-authority mutations",
  "M10A-T02 verifier rejects artifact and visible-report drift",
  "M10A-T02 writer is atomic and rejects unsafe destinations",
  "M10A-T02 authenticates its checkpointed artifact without external execution",
]);

/** Stable redacted failure emitted by the T02 evidence boundary. */
export class M10AT02ProofError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "M10AT02ProofError";
    this.code = `M10A_T02_${code}`;
  }
}

function fail(code, message) {
  throw new M10AT02ProofError(code, message);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function captureOptions(rawOptions, allowedKeys) {
  const value = rawOptions === undefined ? {} : rawOptions;
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    utilTypes.isProxy(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    fail("OPTIONS_INVALID", "Options must be one inert plain own-data record.");
  }
  const captured = Object.create(null);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor =
      typeof key === "string" ? Object.getOwnPropertyDescriptor(value, key) : undefined;
    if (
      typeof key !== "string" ||
      !allowedKeys.includes(key) ||
      descriptor === undefined ||
      !descriptor.enumerable ||
      !Object.hasOwn(descriptor, "value")
    ) {
      fail("OPTIONS_INVALID", "Options contain an unknown or executable field.");
    }
    captured[key] = descriptor.value;
  }
  return Object.freeze(captured);
}

async function captureWorkspaceRoot(rawRoot = WORKSPACE_ROOT) {
  if (
    typeof rawRoot !== "string" ||
    rawRoot.length === 0 ||
    rawRoot.length > 4_096 ||
    !path.isAbsolute(rawRoot) ||
    path.resolve(rawRoot) !== rawRoot ||
    rawRoot.includes("\0")
  ) {
    fail("OPTIONS_INVALID", "workspaceRoot must be one canonical absolute path.");
  }
  try {
    const entry = await lstat(rawRoot, { bigint: true });
    if (
      !entry.isDirectory() ||
      entry.isSymbolicLink() ||
      entry.nlink < 1n ||
      (await realpath(rawRoot)) !== rawRoot
    ) {
      throw new Error("unsafe root");
    }
  } catch {
    fail("AUTHORITY_UNSAFE", "Workspace authority is not one canonical directory.");
  }
  return rawRoot;
}

function captureBytes(rawBytes, label) {
  if (!Buffer.isBuffer(rawBytes) || utilTypes.isProxy(rawBytes)) {
    fail("OPTIONS_INVALID", `${label} must be one Buffer.`);
  }
  return Buffer.from(rawBytes);
}

function captureOverrides(rawOverrides) {
  if (rawOverrides === undefined) return new Map();
  if (
    !(rawOverrides instanceof Map) ||
    utilTypes.isProxy(rawOverrides) ||
    Object.getPrototypeOf(rawOverrides) !== Map.prototype
  ) {
    fail("OPTIONS_INVALID", "fileOverrides must be one ordinary Map.");
  }
  const allowed = new Set([SOURCE_FIXTURE_PATH, SC01_ARTIFACT_PATH, ...PACKAGE_AUTHORITY_PATHS]);
  const captured = new Map();
  for (const [relativePath, rawBytes] of rawOverrides) {
    if (typeof relativePath !== "string" || !allowed.has(relativePath)) {
      fail("OPTIONS_INVALID", "fileOverrides contains an unreviewed path.");
    }
    captured.set(relativePath, captureBytes(rawBytes, "file override"));
  }
  return captured;
}

async function readRegularAuthority(workspaceRoot, relativePath, overrides = new Map()) {
  const override = overrides.get(relativePath);
  if (override !== undefined) return Buffer.from(override);
  const target = path.join(workspaceRoot, relativePath);
  let handle;
  try {
    const before = await lstat(target, { bigint: true });
    if (
      !before.isFile() ||
      before.isSymbolicLink() ||
      before.nlink !== 1n ||
      before.size <= 0n ||
      before.size > BigInt(MAX_AUTHORITY_BYTES) ||
      (await realpath(target)) !== target
    ) {
      throw new Error("unsafe authority");
    }
    handle = await open(target, READ_FLAGS);
    const opened = await handle.stat({ bigint: true });
    if (
      opened.dev !== before.dev ||
      opened.ino !== before.ino ||
      opened.size !== before.size ||
      opened.mode !== before.mode
    ) {
      throw new Error("authority changed before open");
    }
    const bytes = await handle.readFile();
    const after = await handle.stat({ bigint: true });
    if (
      bytes.byteLength !== Number(before.size) ||
      after.dev !== before.dev ||
      after.ino !== before.ino ||
      after.size !== before.size ||
      after.mode !== before.mode ||
      after.mtimeNs !== before.mtimeNs ||
      after.ctimeNs !== before.ctimeNs
    ) {
      throw new Error("authority changed while read");
    }
    return bytes;
  } catch {
    fail("AUTHORITY_UNSAFE", `Required authority is unavailable: ${relativePath}`);
  } finally {
    await handle?.close();
  }
}

function parseJson(bytes, label) {
  try {
    const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value;
  } catch {
    fail("AUTHORITY_INVALID", `${label} must be one valid UTF-8 JSON object.`);
  }
}

function captureRuntime(rawRuntime = designSystemCore) {
  if (
    rawRuntime === null ||
    typeof rawRuntime !== "object" ||
    Array.isArray(rawRuntime) ||
    utilTypes.isProxy(rawRuntime)
  ) {
    fail("OPTIONS_INVALID", "runtime must expose inert own data exports.");
  }
  const ownKeys = Reflect.ownKeys(rawRuntime);
  const stringKeys = ownKeys.filter((key) => typeof key === "string").sort();
  const unexpectedSymbol = ownKeys.find(
    (key) => typeof key === "symbol" && key !== Symbol.toStringTag,
  );
  if (unexpectedSymbol !== undefined || !isDeepStrictEqual(stringKeys, REQUIRED_RUNTIME_EXPORTS)) {
    fail("PUBLIC_API_DRIFT", "Built public runtime export set drifted.");
  }
  const captured = Object.create(null);
  for (const name of REQUIRED_RUNTIME_EXPORTS) {
    const descriptor = Object.getOwnPropertyDescriptor(rawRuntime, name);
    if (descriptor === undefined || !descriptor.enumerable || !Object.hasOwn(descriptor, "value")) {
      fail("PUBLIC_API_DRIFT", `Built public export ${name} is unavailable.`);
    }
    const value = descriptor.value;
    if (
      RUNTIME_FUNCTION_EXPORTS.includes(name) &&
      (typeof value !== "function" || utilTypes.isProxy(value))
    ) {
      fail("PUBLIC_API_DRIFT", `Built public export ${name} is not callable.`);
    }
    captured[name] = value;
  }
  return Object.freeze(captured);
}

function call(runtime, name, ...args) {
  try {
    return Reflect.apply(runtime[name], undefined, args);
  } catch {
    fail("BEHAVIOR_DRIFT", `Built public operation ${name} threw unexpectedly.`);
  }
}

function assertDeepFrozen(value, label) {
  const pending = [value];
  const visited = new Set();
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === null || typeof current !== "object" || visited.has(current)) continue;
    visited.add(current);
    if (!Object.isFrozen(current)) fail("BEHAVIOR_DRIFT", `${label} is not recursively immutable.`);
    pending.push(...Object.values(current));
  }
}

function exactStringArray(value, expected, label) {
  if (
    !Array.isArray(value) ||
    value.length !== expected.length ||
    value.some((entry, index) => entry !== expected[index])
  ) {
    fail("PUBLIC_API_DRIFT", `${label} drifted from its reviewed closed set.`);
  }
}

function captureExactDataRecord(value, expectedKeys, label) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    utilTypes.isProxy(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    fail("PUBLIC_API_DRIFT", `${label} is not one inert data record.`);
  }
  const ownKeys = Reflect.ownKeys(value);
  const stringKeys = ownKeys.filter((key) => typeof key === "string").sort();
  if (ownKeys.length !== stringKeys.length || !isDeepStrictEqual(stringKeys, expectedKeys)) {
    fail("PUBLIC_API_DRIFT", `${label} key set drifted.`);
  }
  const captured = Object.create(null);
  for (const key of expectedKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !descriptor.enumerable || !Object.hasOwn(descriptor, "value")) {
      fail("PUBLIC_API_DRIFT", `${label} contains an executable field.`);
    }
    captured[key] = descriptor.value;
  }
  return Object.freeze(captured);
}

function authenticatePositiveIntegerLimits(rawLimits) {
  const limits = captureExactDataRecord(
    rawLimits,
    EXPECTED_PROFILE_LIMIT_KEYS,
    "DTCG project profile limits",
  );
  for (const name of EXPECTED_PROFILE_LIMIT_KEYS) {
    if (!Number.isSafeInteger(limits[name]) || limits[name] <= 0) {
      fail(
        "PUBLIC_API_DRIFT",
        `DTCG project profile limit ${name} is not one finite safe positive integer.`,
      );
    }
  }
  assertDeepFrozen(rawLimits, "DTCG project profile limits");
  return rawLimits;
}

function authenticateProfile(runtime) {
  const profile = captureExactDataRecord(
    runtime.DESIGN_TOKEN_PROFILE,
    EXPECTED_PROFILE_KEYS,
    "DTCG project profile",
  );
  if (
    runtime.EDITABLE_PROJECT_KIND !== "desen.editable-project" ||
    runtime.EDITABLE_PROJECT_SCHEMA_VERSION !== 1
  ) {
    fail("PUBLIC_API_DRIFT", "Editable-project identity drifted.");
  }
  exactStringArray(runtime.SUPPORTED_EDITABLE_PROJECT_SCHEMA_VERSIONS, [1], "schema versions");
  if (profile.formatVersion !== "2025.10" || profile.wholeTokenAliasesOnly !== true) {
    fail("PUBLIC_API_DRIFT", "DTCG project profile identity drifted.");
  }
  exactStringArray(profile.tokenTypes, EXPECTED_TOKEN_TYPES, "token types");
  exactStringArray(profile.motionTypes, EXPECTED_MOTION_TYPES, "motion types");
  exactStringArray(profile.colorSpaces, ["srgb"], "color spaces");
  exactStringArray(profile.dimensionUnits, ["px", "rem"], "dimension units");
  exactStringArray(profile.durationUnits, ["ms", "s"], "duration units");
  authenticatePositiveIntegerLimits(profile.limits);
  assertDeepFrozen(runtime.DESIGN_TOKEN_PROFILE, "DTCG project profile");
  if (
    runtime.EDITABLE_PROJECT_LIMITS === null ||
    typeof runtime.EDITABLE_PROJECT_LIMITS !== "object"
  ) {
    fail("PUBLIC_API_DRIFT", "Editable-project limits are unavailable.");
  }
  assertDeepFrozen(runtime.EDITABLE_PROJECT_LIMITS, "editable-project limits");
  return profile;
}

function color(components) {
  return { colorSpace: "srgb", components, alpha: 1 };
}

function sameJson(left, right) {
  return isDeepStrictEqual(JSON.parse(JSON.stringify(left)), JSON.parse(JSON.stringify(right)));
}

function completeTokenDocument(reverse = false, includeBrand = true) {
  const neutral = color([0.1, 0.2, 0.3]);
  const entries = [
    [
      "border",
      {
        $type: "border",
        focus: {
          $value: { color: neutral, style: "solid", width: { value: 2, unit: "px" } },
        },
      },
    ],
    [
      "color",
      {
        $description: "Neutral palette",
        ...(includeBrand ? { $type: "color" } : {}),
        action: { $value: "{color.brand}" },
        ...(includeBrand
          ? {
              brand: {
                $description: "Brand color",
                $extensions: { "run.desen.editor": { control: "color" } },
                $value: neutral,
              },
            }
          : {}),
      },
    ],
    [
      "motion",
      {
        duration: { $type: "duration", fast: { $value: { value: 180, unit: "ms" } } },
        easing: { $type: "cubicBezier", standard: { $value: [0.2, 0, 0, 1] } },
        transition: {
          $type: "transition",
          enter: {
            $value: {
              delay: { value: 0, unit: "ms" },
              duration: { value: 180, unit: "ms" },
              timingFunction: [0.2, 0, 0, 1],
            },
          },
        },
      },
    ],
    ["number", { $type: "number", opacity: { $value: 0.6 } }],
    [
      "shadow",
      {
        $type: "shadow",
        raised: {
          $value: {
            blur: { value: 12, unit: "px" },
            color: neutral,
            offsetX: { value: 0, unit: "px" },
            offsetY: { value: 4, unit: "px" },
            spread: { value: -1, unit: "px" },
          },
        },
      },
    ],
    ["space", { $type: "dimension", md: { $value: { value: 8, unit: "px" } } }],
    [
      "type",
      {
        $type: "typography",
        body: {
          $value: {
            fontFamily: ["Inter", "sans-serif"],
            fontSize: { value: 16, unit: "px" },
            fontWeight: 450,
            letterSpacing: { value: 0, unit: "px" },
            lineHeight: 1.5,
          },
        },
      },
    ],
  ];
  return Object.fromEntries(reverse ? entries.reverse() : entries);
}

function projectFixture(source, reverse = false) {
  const entries = [
    ["kind", "desen.editable-project"],
    ["schemaVersion", 1],
    ["id", "project.m10a-t02-proof"],
    ["source", source],
    [
      "designSystem",
      {
        tokenSources: [
          {
            id: "neutral.base",
            description: "DESEN Neutral base",
            document: completeTokenDocument(),
            extensions: { "run.desen.source": { retained: true } },
          },
        ],
        recipes: [
          {
            id: "recipe.card",
            name: "Card",
            description: "Metadata only in T02",
            extensions: { "run.desen.recipe": { retained: true } },
          },
        ],
        assets: [
          {
            id: "asset.logo",
            name: "Logo",
            kind: "image",
            mediaType: "image/png",
            extensions: { "run.desen.asset": { retained: true } },
          },
        ],
        extensions: { "run.desen.system": { retained: true } },
      },
    ],
    [
      "connectionIntents",
      [
        {
          id: "intent.submit",
          status: "draft",
          surfaceId: "sign-in",
          nodeId: "sign-in.submit",
          label: "Later connection",
          note: "Inert until the Connections task.",
          extensions: { "run.desen.intent": { retained: true } },
        },
      ],
    ],
    ["extensions", { "run.desen.project": { unicode: "İstanbul 雪 😀", retained: true } }],
  ];
  return Object.fromEntries(reverse ? entries.reverse() : entries);
}

function expectSuccess(result, operation) {
  if (result === null || typeof result !== "object" || result.ok !== true) {
    fail("BEHAVIOR_DRIFT", `${operation} did not return one success result.`);
  }
  assertDeepFrozen(result, `${operation} result`);
  return result;
}

function expectFailure(result, expectedCode, operation) {
  if (
    result === null ||
    typeof result !== "object" ||
    result.ok !== false ||
    Object.hasOwn(result, "tokens") ||
    !Array.isArray(result.diagnostics) ||
    result.diagnostics.length !== 1 ||
    result.diagnostics[0]?.code !== expectedCode
  ) {
    fail("NEGATIVE_MATRIX_DRIFT", `${operation} did not fail closed as ${expectedCode}.`);
  }
  assertDeepFrozen(result, `${operation} rejection`);
  return Object.freeze({ id: operation, code: expectedCode, partialResult: false });
}

function exerciseProject(runtime, source) {
  const forward = projectFixture(source);
  const reverse = projectFixture(source, true);
  const admitted = expectSuccess(
    call(runtime, "admitEditableProjectRecord", forward),
    "project admission",
  );
  const first = expectSuccess(
    call(runtime, "migrateEditableProjectRecord", forward),
    "project migration",
  );
  const second = expectSuccess(
    call(runtime, "migrateEditableProjectRecord", reverse),
    "reordered project migration",
  );
  let decoded;
  try {
    decoded = JSON.parse(first.canonicalJson);
  } catch {
    fail("BEHAVIOR_DRIFT", "Project export is not valid JSON.");
  }
  const reopened = expectSuccess(
    call(runtime, "migrateEditableProjectRecord", decoded),
    "project reimport",
  );
  if (
    first.fromSchemaVersion !== 1 ||
    first.toSchemaVersion !== 1 ||
    first.migrated !== false ||
    !isDeepStrictEqual(first.changes, []) ||
    !isDeepStrictEqual(first.losses, []) ||
    first.canonicalJson !== second.canonicalJson ||
    first.canonicalJson !== reopened.canonicalJson ||
    first.digest !== second.digest ||
    first.digest !== reopened.digest ||
    !isDeepStrictEqual(first.record, reopened.record) ||
    !isDeepStrictEqual(first.record, admitted.record) ||
    first.record.source.kind !== "desen.source" ||
    first.record.connectionIntents[0]?.status !== "draft" ||
    first.record.extensions?.["run.desen.project"]?.retained !== true ||
    first.record.designSystem.tokenSources[0]?.document.color?.brand?.$extensions?.[
      "run.desen.editor"
    ]?.control !== "color"
  ) {
    fail("BEHAVIOR_DRIFT", "Project identity migration or loss-aware reimport drifted.");
  }

  const executable = projectFixture(source);
  executable.connectionIntents[0] = {
    id: "intent.executable",
    status: "ready",
    surfaceId: "sign-in",
    handler: "fetch('/hidden')",
  };
  const rejectedIntent = call(runtime, "admitEditableProjectRecord", executable);
  if (
    rejectedIntent?.ok !== false ||
    rejectedIntent.diagnostics?.[0]?.code !== "INVALID_PROJECT" ||
    Object.hasOwn(rejectedIntent, "record")
  ) {
    fail("NEGATIVE_MATRIX_DRIFT", "Executable connection intent did not fail closed.");
  }

  return Object.freeze({
    kind: first.record.kind,
    schemaVersions: Object.freeze([1]),
    sourceKind: first.record.source.kind,
    sourcePreservedExactly: isDeepStrictEqual(first.record.source, source),
    canonicalBytes: Buffer.byteLength(first.canonicalJson, "utf8"),
    digest: first.digest,
    deterministicAcrossKeyOrder: true,
    reimportByteIdentical: true,
    reimportRecordIdentical: true,
    changes: 0,
    losses: 0,
    retained: Object.freeze({
      tokenSources: first.record.designSystem.tokenSources.length,
      recipes: first.record.designSystem.recipes.length,
      assets: first.record.designSystem.assets.length,
      connectionIntents: first.record.connectionIntents.length,
      projectExtensions: true,
      tokenExtensions: true,
    }),
    connectionIntentAuthority: "INERT_DRAFT_ONLY",
    executableIntentRejected: true,
  });
}

function resolveRequest(runtime, reverse, literalOverrides = undefined) {
  const request = {
    sources: [
      { id: "neutral.base", document: completeTokenDocument(reverse, false) },
      {
        id: "mode.dark",
        document: {
          color: { $type: "color", brand: { $value: color([0.8, 0.85, 0.9]) } },
        },
      },
    ],
  };
  if (literalOverrides !== undefined) request.literalOverrides = literalOverrides;
  return expectSuccess(call(runtime, "resolveDesignTokens", request), "token resolution");
}

function exerciseTokens(runtime, profile) {
  const admitted = expectSuccess(
    call(runtime, "admitDtcgTokenDocument", completeTokenDocument(), "neutral.base"),
    "DTCG admission",
  );
  const baseWithoutTarget = completeTokenDocument(false, false);
  const standaloneBase = call(runtime, "admitDtcgTokenDocument", baseWithoutTarget, "neutral.base");
  const overlay = resolveRequest(runtime, false);
  const reordered = resolveRequest(runtime, true);
  const literal = color([0.3, 0.9, 0.4]);
  const overridden = resolveRequest(runtime, false, [
    { path: "color.brand", type: "color", value: literal },
  ]);
  const overlayValue = color([0.8, 0.85, 0.9]);
  const crossSourceUntypedAliasTargetIntroducedLater =
    !Object.hasOwn(baseWithoutTarget.color, "$type") &&
    !Object.hasOwn(baseWithoutTarget.color.action, "$type") &&
    !Object.hasOwn(baseWithoutTarget.color, "brand") &&
    standaloneBase?.ok === false &&
    standaloneBase.diagnostics?.[0]?.code === "ALIAS_TARGET_MISSING" &&
    standaloneBase.snapshot !== undefined;
  const tokenChecks = [
    [admitted.tokenPaths.length === 10, "complete type fixture"],
    [isDeepStrictEqual(overlay, reordered), "key-order independence"],
    [JSON.stringify(overlay) === JSON.stringify(reordered), "byte-stable resolution"],
    [sameJson(overlay.tokens["color.brand"]?.value, overlayValue), "later overlay"],
    [sameJson(overlay.tokens["color.action"]?.value, overlayValue), "overlay alias"],
    [crossSourceUntypedAliasTargetIntroducedLater, "deferred cross-source alias closure"],
    [overlay.tokens["color.action"]?.type === "color", "cross-source inferred alias type"],
    [overlay.tokens["color.brand"]?.origin?.sourceId === "mode.dark", "overlay origin"],
    [
      overlay.tokens["color.action"]?.origin?.sourceId === "neutral.base",
      "cross-source alias origin",
    ],
    [
      isDeepStrictEqual(overlay.tokens["color.action"]?.aliasChain, ["color.brand"]),
      "alias provenance",
    ],
    [sameJson(overridden.tokens["color.brand"]?.value, literal), "literal override"],
    [sameJson(overridden.tokens["color.action"]?.value, literal), "literal alias"],
    [overridden.tokens["color.brand"]?.origin?.kind === "literal-override", "literal origin"],
    [overridden.tokens["color.action"]?.origin?.kind === "source", "alias source origin"],
    [
      isDeepStrictEqual(overridden.tokenPaths, [...overridden.tokenPaths].sort()),
      "sorted token paths",
    ],
  ];
  const failedTokenCheck = tokenChecks.find(([passed]) => !passed);
  if (failedTokenCheck !== undefined) {
    fail("BEHAVIOR_DRIFT", `Token ${failedTokenCheck[1]} drifted.`);
  }
  const resolvedTypes = [
    ...new Set(overlay.tokenPaths.map((tokenPath) => overlay.tokens[tokenPath].type)),
  ].sort();
  const resolvedFamilies = [
    ...new Set(overlay.tokenPaths.map((tokenPath) => overlay.tokens[tokenPath].family)),
  ].sort();
  if (
    !isDeepStrictEqual(resolvedTypes, [...EXPECTED_TOKEN_TYPES].sort()) ||
    !isDeepStrictEqual(resolvedFamilies, [...EXPECTED_TOKEN_FAMILIES].sort())
  ) {
    fail("BEHAVIOR_DRIFT", "The resolved token type or family coverage drifted.");
  }

  let getterInvocations = 0;
  const unsafeToken = Object.defineProperty({}, "$value", {
    enumerable: true,
    get() {
      getterInvocations += 1;
      return 1;
    },
  });
  Object.defineProperty(unsafeToken, "$type", { enumerable: true, value: "number" });
  const negativeMatrix = Object.freeze([
    expectFailure(
      call(runtime, "resolveDesignTokens", {
        sources: [
          {
            id: "cycle.base",
            document: {
              number: { first: { $value: "{number.second}" } },
            },
          },
          {
            id: "cycle.mode",
            document: {
              number: { second: { $value: "{number.first}" } },
            },
          },
        ],
      }),
      "ALIAS_CYCLE",
      "alias-cycle",
    ),
    expectFailure(
      call(runtime, "resolveDesignTokens", {
        sources: [
          {
            id: "missing.base",
            document: { number: { value: { $value: "{number.absent}" } } },
          },
          {
            id: "missing.mode",
            document: { number: { present: { $type: "number", $value: 1 } } },
          },
        ],
      }),
      "ALIAS_TARGET_MISSING",
      "alias-missing-target",
    ),
    expectFailure(
      call(runtime, "resolveDesignTokens", {
        sources: [
          {
            id: "mismatch.base",
            document: {
              color: {
                value: { $type: "color", $value: "{number.value}" },
              },
            },
          },
          {
            id: "mismatch.mode",
            document: {
              number: { value: { $type: "number", $value: 1 } },
            },
          },
        ],
      }),
      "ALIAS_TYPE_MISMATCH",
      "alias-type-mismatch",
    ),
    expectFailure(
      call(runtime, "admitDtcgTokenDocument", {
        number: { $type: "number", overflow: { $value: 1_000_000_001 } },
      }),
      "LIMIT_EXCEEDED",
      "numeric-overflow",
    ),
    expectFailure(
      call(runtime, "admitDtcgTokenDocument", { unsafe: unsafeToken }),
      "UNSAFE_DTCG_VALUE",
      "unsafe-accessor",
    ),
  ]);
  if (getterInvocations !== 0) {
    fail("NEGATIVE_MATRIX_DRIFT", "Unsafe DTCG accessor was invoked.");
  }

  return Object.freeze({
    standard: `DTCG ${profile.formatVersion}`,
    supportedTypes: EXPECTED_TOKEN_TYPES,
    supportedTypeCount: EXPECTED_TOKEN_TYPES.length,
    supportedFamilies: EXPECTED_TOKEN_FAMILIES,
    supportedFamilyCount: EXPECTED_TOKEN_FAMILIES.length,
    motionTypes: EXPECTED_MOTION_TYPES,
    profile: Object.freeze({
      wholeTokenAliasesOnly: true,
      colorSpaces: Object.freeze([...profile.colorSpaces]),
      dimensionUnits: Object.freeze([...profile.dimensionUnits]),
      durationUnits: Object.freeze([...profile.durationUnits]),
      limits: profile.limits,
    }),
    admittedTokenCount: admitted.tokenPaths.length,
    resolvedTokenPaths: overlay.tokenPaths,
    deterministicOrder: true,
    orderedSourceIds: overlay.sourceIds,
    laterSourceWins: true,
    aliasResolvedAfterOverlay: true,
    crossSourceUntypedAliasTargetIntroducedLater,
    literalOverrideWinsLast: true,
    aliasesObserveLiteralOverride: true,
    outputRecursivelyImmutable: true,
    observations: Object.freeze({
      overlayBrand: overlay.tokens["color.brand"].value,
      overlayAlias: overlay.tokens["color.action"].value,
      literalBrand: overridden.tokens["color.brand"].value,
      literalAlias: overridden.tokens["color.action"].value,
    }),
    negativeMatrix,
  });
}

function authenticateManifest(bytes) {
  const manifest = parseJson(bytes, PACKAGE_MANIFEST_PATH);
  const dependencies = Object.keys(manifest.dependencies ?? {}).sort();
  const allowedDependencies = ["@desen/editor-core", "@desen/protocol"];
  if (
    manifest.name !== "@desen/design-system-core" ||
    manifest.private !== true ||
    manifest.type !== "module" ||
    manifest.sideEffects !== false ||
    !isDeepStrictEqual(manifest.files, ["dist"]) ||
    manifest.exports?.["."]?.types !== "./dist/index.d.ts" ||
    manifest.exports?.["."]?.import !== "./dist/index.js" ||
    !isDeepStrictEqual(dependencies, allowedDependencies) ||
    ["build", "lint", "typecheck", "test", "test:public-package"].some(
      (name) => typeof manifest.scripts?.[name] !== "string",
    )
  ) {
    fail(
      "PACKAGE_DRIFT",
      "Design System Core manifest drifted from its reviewed private boundary.",
    );
  }
  return Object.freeze({
    name: manifest.name,
    private: true,
    type: "module",
    sideEffects: false,
    exportRoot: manifest.exports["."],
    productionDependencies: Object.freeze(dependencies),
    onlyReviewedInternalDependencies: true,
  });
}

async function authenticateSc01(bytes) {
  if (bytes.byteLength !== M10A_T02_SC01_PIN.bytes || sha256(bytes) !== M10A_T02_SC01_PIN.sha256) {
    fail("SC01_DRIFT", "Historical SC-01 artifact bytes changed.");
  }
  const artifact = parseJson(bytes, SC01_ARTIFACT_PATH);
  if (
    artifact.schemaVersion !== 1 ||
    artifact.checkpoint !== "SC-01" ||
    artifact.result !== "PASS" ||
    artifact.classification !== M10A_T02_SC01_PIN.classification ||
    artifact.auditedReferenceDocument?.leafCount !== M10A_T02_SC01_PIN.leaves ||
    !isDeepStrictEqual(artifact.auditedReferenceDocument?.effectiveTypes, ["color", "dimension"]) ||
    !isDeepStrictEqual(artifact.auditedReferenceDocument?.typeCounts, {
      color: 20,
      dimension: 6,
    }) ||
    artifact.auditedReferenceDocument?.aliases?.count !== 3 ||
    artifact.claim?.fullResolverClaim !== false
  ) {
    fail("SC01_DRIFT", "Historical SC-01 closed profile identity changed.");
  }
  return Object.freeze({
    ...M10A_T02_SC01_PIN,
    effectiveTypes: Object.freeze(["color", "dimension"]),
    typeCounts: Object.freeze({ color: 20, dimension: 6 }),
    aliases: 3,
    fullResolverClaim: false,
    relationship: "UNCHANGED_HISTORICAL_CLOSED_REFERENCE_PROFILE",
  });
}

function receipt(relativePath, bytes) {
  return Object.freeze({ path: relativePath, bytes: bytes.byteLength, sha256: sha256(bytes) });
}

async function serializeArtifact(artifact) {
  return Buffer.from(await format(JSON.stringify(artifact), { parser: "json" }), "utf8");
}

/** Build deterministic M10A-T02 evidence by executing the built public package in memory. */
export async function buildM10AT02Evidence(rawOptions = undefined) {
  const options = captureOptions(rawOptions, ["workspaceRoot", "fileOverrides", "runtime"]);
  const workspaceRoot = await captureWorkspaceRoot(options.workspaceRoot);
  const overrides = captureOverrides(options.fileOverrides);
  const runtime = captureRuntime(options.runtime);
  const paths = [SOURCE_FIXTURE_PATH, SC01_ARTIFACT_PATH, ...PACKAGE_AUTHORITY_PATHS];
  const entries = await Promise.all(
    paths.map(async (relativePath) => [
      relativePath,
      await readRegularAuthority(workspaceRoot, relativePath, overrides),
    ]),
  );
  const files = new Map(entries);
  const sourceBytes = files.get(SOURCE_FIXTURE_PATH);
  if (
    sourceBytes.byteLength !== SOURCE_FIXTURE_PIN.bytes ||
    sha256(sourceBytes) !== SOURCE_FIXTURE_PIN.sha256
  ) {
    fail("SOURCE_DRIFT", "Frozen DESEN Source fixture changed.");
  }
  const source = parseJson(sourceBytes, SOURCE_FIXTURE_PATH);
  const profile = authenticateProfile(runtime);
  const packageBoundary = authenticateManifest(files.get(PACKAGE_MANIFEST_PATH));
  const project = exerciseProject(runtime, source);
  const tokens = exerciseTokens(runtime, profile);
  const historicalSc01 = await authenticateSc01(files.get(SC01_ARTIFACT_PATH));
  const packageFiles = Object.freeze(
    PACKAGE_AUTHORITY_PATHS.map((relativePath) => receipt(relativePath, files.get(relativePath))),
  );
  const artifact = deepFreeze({
    schemaVersion: 1,
    task: "M10A-T02",
    proofId: "m10a-t02",
    profile: "desen.design-system-core.proof.v1",
    result: "PASS",
    claim: {
      implementationEvidence: "PASS",
      taskCompletionRequiresHostedExactHead: true,
      platformNeutralCore: true,
      projectEnvelopeVersioned: true,
      projectRoundTripLossAware: true,
      tokenResolutionDeterministic: true,
      historicalSc01Unchanged: true,
    },
    publicPackage: {
      ...packageBoundary,
      requiredRuntimeExports: REQUIRED_RUNTIME_EXPORTS,
      exercisedBuiltPublicRoot: true,
      sourceAuthority: SOURCE_FIXTURE_PIN,
      files: packageFiles,
    },
    project,
    tokens,
    historicalSc01,
    tests: {
      rootTestNames: M10A_T02_ROOT_TEST_NAMES,
      packageBehaviorRunsSeparately: true,
      verifierWritesWorkspace: false,
      verifierUsesNetwork: false,
      verifierSpawnsChildren: false,
      hostedExactHeadRequired: true,
    },
    nonClaims: [
      "T02 does not add the T03 theme editor or any normal App integration.",
      "T02 does not create immutable releases, recipe materialization, asset loading, executable connections, or runtime semantics.",
      "The broader T02 DTCG project profile is a successor and does not rewrite SC-01's historical closed reference profile.",
      "Local deterministic evidence does not substitute for exact-head hosted Quality gate and fresh-main closure.",
    ],
  });
  const artifactBytes = await serializeArtifact(artifact);
  return Object.freeze({ artifact, artifactBytes, artifactSha256: sha256(artifactBytes) });
}

async function readVisibleProof(workspaceRoot, rawOverride) {
  if (rawOverride !== undefined) return captureBytes(rawOverride, "proofDocumentBytes");
  return readRegularAuthority(workspaceRoot, PROOF_DOCUMENT_RELATIVE_PATH);
}

function proofBlock(...lines) {
  return lines.join("\n");
}

function pendingProofDocumentMarkerInventory(artifactSha256) {
  return Object.freeze([
    "# M10A-T02 — Project design-system model and token resolver",
    "**Last verified:** YYYY-MM-DD",
    proofBlock(
      "**Status:** implementation evidence passes locally; exact-head hosted closure is pending. This",
      "report does not start M10A-T03, add normal App integration, or advance G10A.",
    ),
    "## Delivered boundary",
    proofBlock(
      "`@desen/design-system-core` is a private, platform-neutral package for the App-owned editable",
      "project envelope and its bounded DTCG 2025.10 token profile. Its built public root has exactly 12",
      "reviewed runtime exports; missing or additional exports are rejected. The version-1 envelope",
      "retains one structurally admitted canonical DESEN Source together with ordered token documents,",
      "inert recipe and asset metadata, draft connection intents, and namespaced extensions. The current",
      "migration registry has one honest identity path: it exports canonical JSON, reports no invented",
      "changes or losses, and reimports to the same immutable record and digest.",
    ),
    proofBlock(
      "The token surface resolves nine exact DTCG value types across seven author-facing families:",
      "`color`, `dimension`, `number`, `typography`, `border`, `shadow`, plus the motion family's",
      "`duration`, `cubicBezier`, and `transition`. Ordered sources model explicit modes: later sources",
      "win by token path, aliases resolve only after the complete overlay exists, and final typed literal",
      "overrides take precedence without changing token type or introducing new paths. Resolution order",
      "and origin/alias provenance are deterministic.",
    ),
    "## Executed evidence",
    proofBlock(
      "The proof executes the built public package root, not private TypeScript modules. Its complete",
      "fixture admits all nine types and proves a base untyped alias whose typed target is introduced only",
      "by the later dark-mode source, literal precedence, stable sorted output, recursively immutable",
      "results, and loss-aware project export/reimport. The cross-source negative matrix rejects an alias",
      "cycle, missing alias, and type-mismatched alias; numeric overflow and an accessor are rejected",
      "without invocation or partial output. A connection record carrying executable state is also",
      "rejected. Before evidence serialization, all 13 declared profile limits must be finite, safe",
      "positive integers.",
    ),
    proofBlock(
      "The historical 31,286-byte SC-01 artifact remains byte-identical at",
      "`sha256:1df806e0b56d66e27558bbc2bb2f17e0e261b0103c90ed2658ad1eba4c3bdbc6`.",
      "Its original 26-leaf, color/dimension-only closed reference profile and its explicit",
      "`fullResolverClaim: false` boundary remain unchanged; T02 is a separate broader project profile,",
      "not a retrospective rewrite.",
    ),
    proofBlock(
      "The verifier is read-only, performs no network access, starts no child process, and compares a",
      "fresh public-package observation with the checkpointed artifact. The generator alone writes the",
      "task artifact through the shared same-directory atomic writer.",
    ),
    `Final artifact: \`sha256:${artifactSha256}\``,
    "## Verification",
    proofBlock(
      "- Package build, typecheck, and tests: 52/52 pass; the public-package contract passes 3/3.",
      "- Root proof mutation matrix: 8/8 non-checkpoint cases pass; final checkpoint authentication is",
      "  sealed with the repository proof-reader append.",
      "- Dependency boundaries and exhaustive repository checks: pending final local seal.",
      "- Exact-head hosted Quality gate and fresh-main evidence: pending; no hosted receipt is claimed.",
    ),
    proofBlock(
      "Primary commands are `pnpm generate:m10a-t02`, `pnpm verify:m10a-t02`, and",
      "`pnpm test:m10a-t02` once their root wiring is sealed.",
    ),
    "## Non-claims",
    proofBlock(
      "T02 provides no theme editor, immutable release, recipe materializer, asset loader, executable",
      "connection, application migration, runtime behavior, component-library expansion, remote or",
      "multi-user deployment, or production-readiness claim. Those remain owned by later M10A tasks and",
      "G10A.",
    ),
  ]);
}

function hostedPullRequestMarker(receipt) {
  return proofBlock(
    `[PR #${receipt.prNumber}](https://github.com/desenlab/desen-app/pull/${receipt.prNumber}) at exact head`,
    `\`${receipt.headSha}\` passed`,
    `[run ${receipt.pullRunId}](https://github.com/desenlab/desen-app/actions/runs/${receipt.pullRunId}):`,
    `[Quality gate job ${receipt.pullQualityJobId}](https://github.com/desenlab/desen-app/actions/runs/${receipt.pullRunId}/job/${receipt.pullQualityJobId}) and`,
    `[Browser E2E job ${receipt.pullBrowserJobId}](https://github.com/desenlab/desen-app/actions/runs/${receipt.pullRunId}/job/${receipt.pullBrowserJobId})`,
    "both completed successfully. The pull request was squash-merged as",
    `[\`${receipt.mergeSha}\`](https://github.com/desenlab/desen-app/commit/${receipt.mergeSha}).`,
  );
}

function hostedFreshMainMarker(receipt) {
  return proofBlock(
    "The resulting fresh",
    `[\`main\` run ${receipt.freshRunId}](https://github.com/desenlab/desen-app/actions/runs/${receipt.freshRunId}) passed at exact merge SHA`,
    `\`${receipt.mergeSha}\`:`,
    `[Quality gate job ${receipt.freshQualityJobId}](https://github.com/desenlab/desen-app/actions/runs/${receipt.freshRunId}/job/${receipt.freshQualityJobId}) and`,
    `[Browser E2E job ${receipt.freshBrowserJobId}](https://github.com/desenlab/desen-app/actions/runs/${receipt.freshRunId}/job/${receipt.freshBrowserJobId})`,
    "both completed successfully.",
  );
}

function doneProofDocumentMarkerInventory(artifactSha256, receipt) {
  const pending = pendingProofDocumentMarkerInventory(artifactSha256);
  return Object.freeze([
    ...pending.slice(0, 2),
    proofBlock(
      "**Status:** `DONE`. Exact-head pull-request checks, squash merge, and fresh-main checks pass. This",
      "report does not start M10A-T03, add normal App integration, or advance G10A.",
    ),
    ...pending.slice(3, 12),
    proofBlock(
      "- Package build, typecheck, and tests: 52/52 pass; the public-package contract passes 3/3.",
      "- Root proof mutation matrix: 8/8 non-checkpoint cases pass; final checkpoint authentication is",
      "  sealed with the repository proof-reader append.",
      "- Dependency boundaries and exhaustive repository checks: pass.",
      "- Exact-head pull-request and fresh-main Quality gate and Browser E2E checks: pass; exact receipts",
      "  are recorded below.",
    ),
    pending[13],
    "## Hosted closure",
    hostedPullRequestMarker(receipt),
    hostedFreshMainMarker(receipt),
    "M10A-T03 is ready but remains `NOT_STARTED`.",
    ...pending.slice(14),
  ]);
}

function captureDoneProofReceipts(observed) {
  if (
    observed.length !== 20 ||
    observed[14] !== "## Hosted closure" ||
    observed[17] !== "M10A-T03 is ready but remains `NOT_STARTED`."
  ) {
    return undefined;
  }
  const pullLines = observed[15].split("\n");
  const freshLines = observed[16].split("\n");
  if (
    pullLines.length !== 7 ||
    freshLines.length !== 6 ||
    pullLines[5] !== "both completed successfully. The pull request was squash-merged as" ||
    freshLines[0] !== "The resulting fresh" ||
    freshLines[5] !== "both completed successfully."
  ) {
    return undefined;
  }
  const pullRequest =
    /^\[PR #([1-9][0-9]*)\]\(https:\/\/github\.com\/desenlab\/desen-app\/pull\/([1-9][0-9]*)\) at exact head$/u.exec(
      pullLines[0],
    );
  const head = /^`([0-9a-f]{40})` passed$/u.exec(pullLines[1]);
  const pullRun =
    /^\[run ([1-9][0-9]*)\]\(https:\/\/github\.com\/desenlab\/desen-app\/actions\/runs\/([1-9][0-9]*)\):$/u.exec(
      pullLines[2],
    );
  const pullQuality =
    /^\[Quality gate job ([1-9][0-9]*)\]\(https:\/\/github\.com\/desenlab\/desen-app\/actions\/runs\/([1-9][0-9]*)\/job\/([1-9][0-9]*)\) and$/u.exec(
      pullLines[3],
    );
  const pullBrowser =
    /^\[Browser E2E job ([1-9][0-9]*)\]\(https:\/\/github\.com\/desenlab\/desen-app\/actions\/runs\/([1-9][0-9]*)\/job\/([1-9][0-9]*)\)$/u.exec(
      pullLines[4],
    );
  const merge =
    /^\[`([0-9a-f]{40})`\]\(https:\/\/github\.com\/desenlab\/desen-app\/commit\/([0-9a-f]{40})\)\.$/u.exec(
      pullLines[6],
    );
  const freshRun =
    /^\[`main` run ([1-9][0-9]*)\]\(https:\/\/github\.com\/desenlab\/desen-app\/actions\/runs\/([1-9][0-9]*)\) passed at exact merge SHA$/u.exec(
      freshLines[1],
    );
  const freshSha = /^`([0-9a-f]{40})`:$/u.exec(freshLines[2]);
  const freshQuality =
    /^\[Quality gate job ([1-9][0-9]*)\]\(https:\/\/github\.com\/desenlab\/desen-app\/actions\/runs\/([1-9][0-9]*)\/job\/([1-9][0-9]*)\) and$/u.exec(
      freshLines[3],
    );
  const freshBrowser =
    /^\[Browser E2E job ([1-9][0-9]*)\]\(https:\/\/github\.com\/desenlab\/desen-app\/actions\/runs\/([1-9][0-9]*)\/job\/([1-9][0-9]*)\)$/u.exec(
      freshLines[4],
    );
  if (
    pullRequest === null ||
    head === null ||
    pullRun === null ||
    pullQuality === null ||
    pullBrowser === null ||
    merge === null ||
    freshRun === null ||
    freshSha === null ||
    freshQuality === null ||
    freshBrowser === null ||
    pullRequest[1] !== pullRequest[2] ||
    pullRun[1] !== pullRun[2] ||
    pullQuality[1] !== pullQuality[3] ||
    pullQuality[2] !== pullRun[1] ||
    pullBrowser[1] !== pullBrowser[3] ||
    pullBrowser[2] !== pullRun[1] ||
    merge[1] !== merge[2] ||
    freshRun[1] !== freshRun[2] ||
    freshQuality[1] !== freshQuality[3] ||
    freshQuality[2] !== freshRun[1] ||
    freshBrowser[1] !== freshBrowser[3] ||
    freshBrowser[2] !== freshRun[1] ||
    freshSha[1] !== merge[1] ||
    head[1] === merge[1] ||
    pullRun[1] === freshRun[1] ||
    new Set([pullQuality[1], pullBrowser[1], freshQuality[1], freshBrowser[1]]).size !== 4
  ) {
    return undefined;
  }
  return Object.freeze({
    prNumber: pullRequest[1],
    headSha: head[1],
    pullRunId: pullRun[1],
    pullQualityJobId: pullQuality[1],
    pullBrowserJobId: pullBrowser[1],
    mergeSha: merge[1],
    freshRunId: freshRun[1],
    freshQualityJobId: freshQuality[1],
    freshBrowserJobId: freshBrowser[1],
  });
}

function authenticateProofDocument(proofDocument, artifactSha256) {
  if (!proofDocument.endsWith("\n") || proofDocument.endsWith("\n\n")) {
    fail("REPORT_DRIFT", "Visible T02 proof is not one canonical marker inventory.");
  }
  const observed = proofDocument.slice(0, -1).split("\n\n");
  const pending = pendingProofDocumentMarkerInventory(artifactSha256);
  const lastVerifiedIsCanonical = /^\*\*Last verified:\*\* \d{4}-\d{2}-\d{2}$/u.test(observed[1]);
  if (lastVerifiedIsCanonical) observed[1] = pending[1];
  if (isDeepStrictEqual(observed, pending)) return;
  const receipt = captureDoneProofReceipts(observed);
  if (
    receipt !== undefined &&
    isDeepStrictEqual(observed, doneProofDocumentMarkerInventory(artifactSha256, receipt))
  ) {
    return;
  }
  fail("REPORT_DRIFT", "Visible T02 proof marker inventory drifted.");
}

/** Verify checkpointed T02 evidence against a fresh built-public-package observation. */
export async function verifyM10AT02Evidence(rawOptions = undefined) {
  const options = captureOptions(rawOptions, [
    "workspaceRoot",
    "artifactBytes",
    "proofDocumentBytes",
    "runtime",
    "fileOverrides",
  ]);
  const workspaceRoot = await captureWorkspaceRoot(options.workspaceRoot);
  let artifactBytes;
  let checkpointHeadSha256 = "TEST_OVERRIDE";
  if (options.artifactBytes === undefined) {
    const frozen = await readCheckpointedFrozenArtifact("M10A-T02", { workspaceRoot });
    if (frozen.path !== ARTIFACT_RELATIVE_PATH) {
      fail("ARTIFACT_DRIFT", "Checkpointed T02 artifact path drifted.");
    }
    artifactBytes = Buffer.from(frozen.bytes);
    checkpointHeadSha256 = frozen.checkpointHeadSha256;
  } else {
    artifactBytes = captureBytes(options.artifactBytes, "artifactBytes");
  }
  const built = await buildM10AT02Evidence({
    workspaceRoot,
    ...(options.runtime === undefined ? {} : { runtime: options.runtime }),
    ...(options.fileOverrides === undefined ? {} : { fileOverrides: options.fileOverrides }),
  });
  if (!artifactBytes.equals(built.artifactBytes)) {
    fail("ARTIFACT_DRIFT", "Stored T02 artifact differs from fresh evidence.");
  }
  const proofBytes = await readVisibleProof(workspaceRoot, options.proofDocumentBytes);
  let proofDocument;
  try {
    proofDocument = new TextDecoder("utf-8", { fatal: true }).decode(proofBytes);
  } catch {
    fail("REPORT_DRIFT", "Visible T02 proof is not valid UTF-8.");
  }
  authenticateProofDocument(proofDocument, built.artifactSha256);
  return Object.freeze({
    status: "PASS",
    task: "M10A-T02",
    artifactBytes: built.artifactBytes.byteLength,
    artifactSha256: built.artifactSha256,
    checkpointHeadSha256,
    projectDigest: built.artifact.project.digest,
    tokenTypes: built.artifact.tokens.supportedTypeCount,
    tokenFamilies: built.artifact.tokens.supportedFamilyCount,
    rejectedCases: built.artifact.tokens.negativeMatrix.length,
    historicalSc01Sha256: built.artifact.historicalSc01.sha256,
    externalExecution: false,
  });
}

async function assertWritableArtifactDestination(artifactPath) {
  try {
    const entry = await lstat(artifactPath, { bigint: true });
    if (!entry.isFile() || entry.isSymbolicLink() || entry.nlink !== 1n) {
      fail("ARTIFACT_WRITE_UNSAFE", "Artifact destination must be one unlinked regular file.");
    }
  } catch (error) {
    if (error instanceof M10AT02ProofError) throw error;
    if (error?.code !== "ENOENT") {
      fail("ARTIFACT_WRITE_UNSAFE", "Artifact destination could not be inspected safely.");
    }
  }
}

/** Write exact deterministic T02 evidence through the shared atomic artifact helper. */
export async function writeM10AT02Evidence(rawOptions = undefined) {
  const options = captureOptions(rawOptions, [
    "workspaceRoot",
    "artifactPath",
    "beforeAtomicRename",
  ]);
  const workspaceRoot = await captureWorkspaceRoot(options.workspaceRoot);
  const artifactPath = options.artifactPath ?? path.join(workspaceRoot, ARTIFACT_RELATIVE_PATH);
  if (
    typeof artifactPath !== "string" ||
    !path.isAbsolute(artifactPath) ||
    path.resolve(artifactPath) !== artifactPath ||
    artifactPath.includes("\0")
  ) {
    fail("OPTIONS_INVALID", "artifactPath must be one canonical absolute path.");
  }
  if (
    options.beforeAtomicRename !== undefined &&
    (typeof options.beforeAtomicRename !== "function" ||
      utilTypes.isProxy(options.beforeAtomicRename))
  ) {
    fail("OPTIONS_INVALID", "beforeAtomicRename must be one non-Proxy function.");
  }
  const built = await buildM10AT02Evidence({ workspaceRoot });
  await assertWritableArtifactDestination(artifactPath);
  try {
    await writeAtomicProofArtifact({
      artifactPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename: options.beforeAtomicRename,
    });
  } catch (error) {
    if (error instanceof M10AT02ProofError) throw error;
    fail("ARTIFACT_WRITE_UNSAFE", "Atomic T02 evidence write failed.");
  }
  return Object.freeze({
    artifactPath,
    artifactBytes: built.artifactBytes.byteLength,
    artifactSha256: built.artifactSha256,
  });
}

/** Relative tracked path of the deterministic T02 evidence artifact. */
export const M10A_T02_ARTIFACT_PATH = ARTIFACT_RELATIVE_PATH;
