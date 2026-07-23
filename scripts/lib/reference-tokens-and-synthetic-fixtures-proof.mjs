import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { format } from "prettier";
import ts from "typescript";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";
import {
  DEFAULT_REFERENCE_CATALOG_WEB_FORM_FEEDBACK_ARTIFACT_PATH,
  verifyReferenceCatalogWebFormFeedbackEvidence,
} from "./reference-catalog-web-form-feedback-proof.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");

/** Absolute path to the deterministic M03-T07 evidence artifact. */
export const DEFAULT_REFERENCE_TOKENS_AND_SYNTHETIC_FIXTURES_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/artifacts/reference-tokens-and-synthetic-fixtures.json",
);

const DEFAULT_PATHS = Object.freeze({
  tokenConsumerPath: path.join(
    WORKSPACE_ROOT,
    "packages/reference-catalog-web/test/tokens-consumer.mjs",
  ),
  testkitConsumerPath: path.join(
    WORKSPACE_ROOT,
    "packages/testkit/test/synthetic-fixtures-consumer.mjs",
  ),
  tokenDocumentSourcePath: path.join(
    WORKSPACE_ROOT,
    "packages/reference-catalog-web/src/tokens/reference-token-document.ts",
  ),
  tokenProviderSourcePath: path.join(
    WORKSPACE_ROOT,
    "packages/reference-catalog-web/src/tokens/web-token-provider.ts",
  ),
  tokenIndexSourcePath: path.join(
    WORKSPACE_ROOT,
    "packages/reference-catalog-web/src/tokens/index.ts",
  ),
  tokenDeclarationPath: path.join(
    WORKSPACE_ROOT,
    "packages/reference-catalog-web/dist/tokens/index.d.ts",
  ),
  tokenBuiltProviderPath: path.join(
    WORKSPACE_ROOT,
    "packages/reference-catalog-web/dist/tokens/web-token-provider.js",
  ),
  referenceReadmePath: path.join(WORKSPACE_ROOT, "packages/reference-catalog-web/README.md"),
  referencePackagePath: path.join(WORKSPACE_ROOT, "packages/reference-catalog-web/package.json"),
  tokenTestPath: path.join(
    WORKSPACE_ROOT,
    "packages/reference-catalog-web/test/reference-tokens.test.ts",
  ),
  tokenTypeTestPath: path.join(
    WORKSPACE_ROOT,
    "packages/reference-catalog-web/test/reference-tokens.types.ts",
  ),
  stackSourcePath: path.join(
    WORKSPACE_ROOT,
    "packages/reference-catalog-web/src/components/stack.tsx",
  ),
  textSourcePath: path.join(
    WORKSPACE_ROOT,
    "packages/reference-catalog-web/src/components/text.tsx",
  ),
  textFieldSourcePath: path.join(
    WORKSPACE_ROOT,
    "packages/reference-catalog-web/src/components/text-field.tsx",
  ),
  buttonSourcePath: path.join(
    WORKSPACE_ROOT,
    "packages/reference-catalog-web/src/components/button.tsx",
  ),
  alertSourcePath: path.join(
    WORKSPACE_ROOT,
    "packages/reference-catalog-web/src/components/alert.tsx",
  ),
  testkitSourcePath: path.join(WORKSPACE_ROOT, "packages/testkit/src/synthetic-fixtures.ts"),
  testkitIndexSourcePath: path.join(WORKSPACE_ROOT, "packages/testkit/src/index.ts"),
  testkitDeclarationPath: path.join(WORKSPACE_ROOT, "packages/testkit/dist/index.d.ts"),
  testkitBuiltSourcePath: path.join(WORKSPACE_ROOT, "packages/testkit/dist/synthetic-fixtures.js"),
  testkitReadmePath: path.join(WORKSPACE_ROOT, "packages/testkit/README.md"),
  testkitPackagePath: path.join(WORKSPACE_ROOT, "packages/testkit/package.json"),
  fixtureTestPath: path.join(WORKSPACE_ROOT, "packages/testkit/test/synthetic-fixtures.test.ts"),
  fixtureTypeTestPath: path.join(WORKSPACE_ROOT, "packages/testkit/test/public-api.types.ts"),
  rootTestPath: path.join(WORKSPACE_ROOT, "tests/reference-tokens-and-synthetic-fixtures.test.mjs"),
  rootPackagePath: path.join(WORKSPACE_ROOT, "package.json"),
  proofDocumentPath: path.join(
    WORKSPACE_ROOT,
    "docs/proof/REFERENCE-TOKENS-AND-SYNTHETIC-FIXTURES.md",
  ),
  prerequisiteArtifactPath: DEFAULT_REFERENCE_CATALOG_WEB_FORM_FEEDBACK_ARTIFACT_PATH,
});

const BUILD_OPTION_NAMES = Object.freeze([
  "tokenApi",
  "testkitApi",
  "catalogApi",
  ...Object.keys(DEFAULT_PATHS),
  "verifyPrerequisite",
]);

const TOKEN_RUNTIME_EXPORTS = Object.freeze([
  "REFERENCE_TOKEN_DOCUMENT",
  "REFERENCE_WEB_TOKEN_CSS_PROPERTIES",
  "REFERENCE_WEB_TOKEN_CSS_REFERENCES",
  "REFERENCE_WEB_TOKEN_PROVIDER",
  "REFERENCE_WEB_TOKEN_VALUES",
  "resolveReferenceWebToken",
]);

const TESTKIT_RUNTIME_EXPORTS = Object.freeze([
  "SYNTHETIC_FIXTURE_CONTEXT",
  "createSyntheticFixtureSnapshot",
  "lookupSyntheticOperationError",
  "lookupSyntheticOperationSuccess",
  "lookupSyntheticResourceFixture",
]);

const TOKEN_TYPE_EXPORTS = Object.freeze([
  "DtcgReferenceAlias",
  "DtcgReferenceColorValue",
  "DtcgReferenceDimensionValue",
  "DtcgReferenceTokenValue",
  "ReferenceWebTokenCssProperties",
  "ReferenceWebTokenCssProperty",
  "ReferenceWebTokenCssReference",
  "ReferenceWebTokenPath",
  "ReferenceWebTokenProvider",
  "ReferenceWebTokenResolution",
  "ReferenceWebTokenResolutionFailure",
  "ReferenceWebTokenResolutionSuccess",
]);

const TESTKIT_TYPE_EXPORTS = Object.freeze([
  "CreateSyntheticFixtureSnapshotInput",
  "SyntheticFixtureContext",
  "SyntheticFixtureLookupResult",
  "SyntheticFixtureSnapshot",
  "SyntheticFixtureValue",
  "SyntheticOperationFixtures",
]);

const EXPECTED_TOKEN_TEST_TITLES = Object.freeze([
  "keeps the complete nested DTCG document recursively immutable",
  "derives exactly the 26 component CSS custom properties without a wrapper",
  "applies the exported custom-property map directly to an existing React host root",
  "resolves direct colors, dimensions, and same-type aliases deterministically",
  "returns an explicit immutable failure for every unknown spelling",
  "exposes detached frozen maps that reject runtime mutation",
]);

const EXPECTED_FIXTURE_TEST_TITLES = Object.freeze([
  "projects only authoring fixtures into detached canonical deeply frozen JSON",
  "returns detached frozen found results for operation success and public errors",
  "returns detached frozen found results for named resource outputs",
  "represents every absent capability, path, or fixture with an explicit missing result",
  "keeps registered capabilities with no authoring fixtures as explicit empty maps",
  "rejects operation error fixtures whose codes are not publicly declared",
  "rejects operations that omit their required public-error declaration",
  "requires the exported context singleton and rejects duplicate capability ids",
  "rejects wrong capability categories and ids reused across categories",
  "rejects bounded-depth, node-count, and canonical-byte overflows as stable TypeErrors",
  "rejects forged snapshots and non-string lookup paths before property coercion",
  "rejects binding fields, unsupported operation fixture paths, and extra wrapper data",
  "rejects accessors, cycles, exotic objects, and non-finite fixture numbers",
]);

const EXPECTED_TOKEN_NEGATIVE_CASES = Object.freeze(
  Array.from({ length: 10 }, (_, index) => `M03-T07-N${String(index + 1).padStart(2, "0")}`),
);
const EXPECTED_FIXTURE_NEGATIVE_CASES = Object.freeze(
  Array.from({ length: 10 }, (_, index) => `M03-T07-N${String(index + 1).padStart(2, "0")}`),
);

const EXPECTED_ROOT_TEST_TITLES = Object.freeze([
  "accepts the tracked deterministic M03-T07 evidence",
  "builds byte-identical evidence twice",
  "labels explicit build options as injected evidence",
  "rejects inherited accessor-backed symbolic and unknown options",
  "rejects stale or one-byte-tampered evidence",
  "rejects missing mismatched or skipped M03-T06 prerequisite evidence",
  "rejects token path value property and reference inventory drift",
  "rejects malformed or mutable DTCG and provider surfaces",
  "rejects a resolver that accepts unknown or prototype token names",
  "rejects component CSS reference or fallback drift",
  "rejects fixture projections that leak bindings endpoints or executable values",
  "rejects public declaration package-export and platform-boundary drift",
  "rejects package-test and compiler-negative inventory drift",
  "rejects inert or incomplete root command wiring",
  "rejects tracked-artifact verification through a symlink alias",
  "writes and verifies an injected artifact atomically and detects pre-rename tampering",
]);

const EXPECTED_ROOT_SCRIPTS = Object.freeze({
  generate:
    "pnpm verify:reference-catalog-web-form-feedback && pnpm --filter @desen/reference-catalog-web... build && pnpm --filter @desen/reference-catalog-web typecheck && pnpm --filter @desen/reference-catalog-web test:tokens && pnpm --filter @desen/testkit... build && pnpm --filter @desen/testkit typecheck && pnpm --filter @desen/testkit test:synthetic-fixtures && node scripts/generate-reference-tokens-and-synthetic-fixtures-proof.mjs",
  verify:
    "pnpm verify:reference-catalog-web-form-feedback && pnpm --filter @desen/reference-catalog-web... build && pnpm --filter @desen/reference-catalog-web typecheck && pnpm --filter @desen/reference-catalog-web test:tokens && pnpm --filter @desen/testkit... build && pnpm --filter @desen/testkit typecheck && pnpm --filter @desen/testkit test:synthetic-fixtures && node scripts/verify-reference-tokens-and-synthetic-fixtures.mjs",
  test: "pnpm verify:reference-catalog-web-form-feedback && pnpm --filter @desen/reference-catalog-web... build && pnpm --filter @desen/reference-catalog-web typecheck && pnpm --filter @desen/reference-catalog-web test:tokens && pnpm --filter @desen/testkit... build && pnpm --filter @desen/testkit typecheck && pnpm --filter @desen/testkit test:synthetic-fixtures && node --test tests/reference-tokens-and-synthetic-fixtures.test.mjs",
});

const TOKEN_INVENTORY = Object.freeze(
  [
    ["color.action.primary", "#1d4ed8", "--desen-color-action-primary", "color", null],
    ["color.border.default", "#6b7280", "--desen-color-border", "color", null],
    ["color.border.strong", "#374151", "--desen-color-border-strong", "color", null],
    ["color.content.onAction", "#ffffff", "--desen-color-on-action", "color", null],
    [
      "color.content.onCritical",
      "#ffffff",
      "--desen-color-on-critical",
      "color",
      "{color.content.onAction}",
    ],
    ["color.critical.base", "#b91c1c", "--desen-color-critical", "color", null],
    ["color.critical.surface", "#fef2f2", "--desen-color-critical-surface", "color", null],
    ["color.critical.text", "#7f1d1d", "--desen-color-critical-text", "color", null],
    ["color.info.base", "#1d4ed8", "--desen-color-info", "color", "{color.action.primary}"],
    ["color.info.surface", "#eff6ff", "--desen-color-info-surface", "color", null],
    ["color.info.text", "#1e3a8a", "--desen-color-info-text", "color", null],
    ["color.success.base", "#15803d", "--desen-color-success", "color", null],
    ["color.success.surface", "#f0fdf4", "--desen-color-success-surface", "color", null],
    ["color.success.text", "#14532d", "--desen-color-success-text", "color", null],
    [
      "color.surface.default",
      "#ffffff",
      "--desen-color-surface",
      "color",
      "{color.content.onAction}",
    ],
    ["color.surface.disabled", "#f3f4f6", "--desen-color-surface-disabled", "color", null],
    ["color.text.default", "#111827", "--desen-color-text", "color", null],
    ["color.warning.base", "#a16207", "--desen-color-warning", "color", null],
    ["color.warning.surface", "#fffbeb", "--desen-color-warning-surface", "color", null],
    ["color.warning.text", "#713f12", "--desen-color-warning-text", "color", null],
    ["radius.control", "0.375rem", "--desen-radius-control", "dimension", null],
    ["space.lg", "1.5rem", "--desen-space-lg", "dimension", null],
    ["space.md", "1rem", "--desen-space-md", "dimension", null],
    ["space.sm", "0.5rem", "--desen-space-sm", "dimension", null],
    ["space.xl", "2rem", "--desen-space-xl", "dimension", null],
    ["space.xs", "0.25rem", "--desen-space-xs", "dimension", null],
  ].map(([token, value, cssProperty, type, alias]) =>
    Object.freeze({
      token,
      value,
      cssProperty,
      cssReference: `var(${cssProperty}, ${value})`,
      type,
      alias,
    }),
  ),
);

const COMPONENT_TOKEN_PROPERTIES = Object.freeze({
  "alert.tsx": Object.freeze([
    "--desen-color-critical",
    "--desen-color-critical-surface",
    "--desen-color-critical-text",
    "--desen-color-info",
    "--desen-color-info-surface",
    "--desen-color-info-text",
    "--desen-color-success",
    "--desen-color-success-surface",
    "--desen-color-success-text",
    "--desen-color-warning",
    "--desen-color-warning-surface",
    "--desen-color-warning-text",
    "--desen-radius-control",
    "--desen-space-md",
    "--desen-space-sm",
  ]),
  "button.tsx": Object.freeze([
    "--desen-color-action-primary",
    "--desen-color-border-strong",
    "--desen-color-critical",
    "--desen-color-on-action",
    "--desen-color-on-critical",
    "--desen-color-surface",
    "--desen-color-text",
    "--desen-radius-control",
    "--desen-space-md",
    "--desen-space-sm",
  ]),
  "stack.tsx": Object.freeze([
    "--desen-space-lg",
    "--desen-space-md",
    "--desen-space-sm",
    "--desen-space-xl",
    "--desen-space-xs",
  ]),
  "text-field.tsx": Object.freeze([
    "--desen-color-border",
    "--desen-color-critical",
    "--desen-color-surface",
    "--desen-color-surface-disabled",
    "--desen-color-text",
    "--desen-radius-control",
    "--desen-space-sm",
    "--desen-space-xs",
  ]),
  "text.tsx": Object.freeze([]),
});

const TRACKED_EVIDENCE_PATHS = Object.freeze([
  "docs/proof/REFERENCE-TOKENS-AND-SYNTHETIC-FIXTURES.md",
  "packages/reference-catalog-web/README.md",
  "packages/reference-catalog-web/package.json",
  "packages/reference-catalog-web/src/tokens/reference-token-document.ts",
  "packages/reference-catalog-web/src/tokens/web-token-provider.ts",
  "packages/reference-catalog-web/src/tokens/index.ts",
  "packages/reference-catalog-web/test/reference-tokens.test.ts",
  "packages/reference-catalog-web/test/reference-tokens.types.ts",
  "packages/reference-catalog-web/test/tokens-consumer.mjs",
  "packages/reference-catalog-web/src/components/stack.tsx",
  "packages/reference-catalog-web/src/components/text.tsx",
  "packages/reference-catalog-web/src/components/text-field.tsx",
  "packages/reference-catalog-web/src/components/button.tsx",
  "packages/reference-catalog-web/src/components/alert.tsx",
  "packages/testkit/README.md",
  "packages/testkit/package.json",
  "packages/testkit/src/synthetic-fixtures.ts",
  "packages/testkit/src/index.ts",
  "packages/testkit/test/synthetic-fixtures.test.ts",
  "packages/testkit/test/public-api.types.ts",
  "packages/testkit/test/synthetic-fixtures-consumer.mjs",
  "scripts/generate-reference-tokens-and-synthetic-fixtures-proof.mjs",
  "scripts/verify-reference-tokens-and-synthetic-fixtures.mjs",
  "scripts/lib/reference-tokens-and-synthetic-fixtures-proof.mjs",
  "tests/reference-tokens-and-synthetic-fixtures.test.mjs",
]);

const FORBIDDEN_PLATFORM_IMPORTS = Object.freeze([
  "react",
  "react-dom",
  "react-native",
  "node:fs",
  "node:path",
]);
const FORBIDDEN_PLATFORM_IDENTIFIERS = new Set([
  "document",
  "window",
  "HTMLElement",
  "HTMLInputElement",
  "Element",
]);

/** Stable proof failure with a machine-readable code and optional inert details. */
export class ReferenceTokensAndSyntheticFixturesEvidenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "ReferenceTokensAndSyntheticFixturesEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new ReferenceTokensAndSyntheticFixturesEvidenceError(code, message, details);
}

function assertCondition(condition, code, message, details = undefined) {
  if (!condition) fail(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sorted(values) {
  return [...values].sort(compareText);
}

function assertArrayEqual(actual, expected, code, message) {
  assertCondition(
    actual.length === expected.length && actual.every((value, index) => value === expected[index]),
    code,
    message,
    { actual, expected },
  );
}

function normalizeOptions(options, allowedNames, label) {
  if (options === undefined) return Object.freeze(Object.create(null));
  assertCondition(
    options !== null && typeof options === "object" && !Array.isArray(options),
    "TOKEN_FIXTURE_OPTIONS_INVALID",
    `${label} options must be a plain record.`,
  );
  let prototype;
  let keys;
  try {
    prototype = Object.getPrototypeOf(options);
    keys = Reflect.ownKeys(options);
  } catch (error) {
    fail("TOKEN_FIXTURE_OPTIONS_INVALID", `${label} options could not be inspected safely.`, {
      cause: error instanceof Error ? error.message : String(error),
    });
  }
  assertCondition(
    prototype === Object.prototype || prototype === null,
    "TOKEN_FIXTURE_OPTIONS_INVALID",
    `${label} options may not inherit configuration.`,
  );
  const allowed = new Set(allowedNames);
  const normalized = Object.create(null);
  for (const key of keys) {
    assertCondition(
      typeof key === "string" && allowed.has(key),
      "TOKEN_FIXTURE_OPTIONS_INVALID",
      `${label} options contain an unknown or symbolic key.`,
    );
    const descriptor = Object.getOwnPropertyDescriptor(options, key);
    assertCondition(
      descriptor !== undefined &&
        Object.hasOwn(descriptor, "value") &&
        descriptor.enumerable === true,
      "TOKEN_FIXTURE_OPTIONS_INVALID",
      `${label} option ${String(key)} must be an enumerable own data property.`,
    );
    normalized[key] = descriptor.value;
  }
  return Object.freeze(normalized);
}

function validateBuildOptions(options) {
  for (const name of Object.keys(DEFAULT_PATHS)) {
    if (Object.hasOwn(options, name)) {
      assertCondition(
        typeof options[name] === "string" && options[name].length > 0,
        "TOKEN_FIXTURE_OPTIONS_INVALID",
        `Build option ${name} must be a non-empty path string.`,
      );
    }
  }
  for (const name of ["tokenApi", "testkitApi", "catalogApi"]) {
    if (Object.hasOwn(options, name)) {
      assertCondition(
        options[name] !== null &&
          (typeof options[name] === "object" || typeof options[name] === "function"),
        "TOKEN_FIXTURE_OPTIONS_INVALID",
        `Build option ${name} must be object-like.`,
      );
    }
  }
  if (Object.hasOwn(options, "verifyPrerequisite")) {
    assertCondition(
      typeof options.verifyPrerequisite === "boolean",
      "TOKEN_FIXTURE_OPTIONS_INVALID",
      "Build option verifyPrerequisite must be boolean.",
    );
  }
}

function captureApi(module, names, label) {
  const captured = Object.create(null);
  const descriptors = new Map();
  for (const name of names) {
    const descriptor = Object.getOwnPropertyDescriptor(module, name);
    assertCondition(
      descriptor !== undefined && Object.hasOwn(descriptor, "value"),
      "TOKEN_FIXTURE_PUBLIC_API_DRIFT",
      `${label} export ${name} must be an own data property.`,
    );
    captured[name] = descriptor.value;
    descriptors.set(name, descriptor.value);
  }
  return Object.freeze({
    api: Object.freeze(captured),
    assertStable() {
      for (const [name, value] of descriptors) {
        const descriptor = Object.getOwnPropertyDescriptor(module, name);
        assertCondition(
          descriptor !== undefined &&
            Object.hasOwn(descriptor, "value") &&
            descriptor.value === value,
          "TOKEN_FIXTURE_PUBLIC_API_DRIFT",
          `${label} export ${name} changed during evidence construction.`,
        );
      }
    },
  });
}

function assertDeeplyFrozen(value, label, active = new Set()) {
  if (value === null || typeof value !== "object" || active.has(value)) {
    return;
  }
  active.add(value);
  assertCondition(
    Object.isFrozen(value),
    "TOKEN_FIXTURE_MUTABILITY_DRIFT",
    `${label} must be recursively frozen.`,
  );
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    assertCondition(
      descriptor !== undefined && Object.hasOwn(descriptor, "value"),
      "TOKEN_FIXTURE_ACCESSOR_DRIFT",
      `${label}.${String(key)} must be a data property.`,
    );
    assertDeeplyFrozen(descriptor.value, `${label}.${String(key)}`, active);
  }
}

function safeRecordEntries(value, label) {
  assertCondition(
    value !== null && typeof value === "object" && !Array.isArray(value),
    "TOKEN_FIXTURE_DTCG_DRIFT",
    `${label} must be an object.`,
  );
  const keys = Reflect.ownKeys(value);
  assertCondition(
    keys.every((key) => typeof key === "string"),
    "TOKEN_FIXTURE_DTCG_DRIFT",
    `${label} may not contain symbol keys.`,
  );
  return keys.map((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    assertCondition(
      descriptor !== undefined && Object.hasOwn(descriptor, "value") && descriptor.enumerable,
      "TOKEN_FIXTURE_DTCG_DRIFT",
      `${label}.${key} must be an enumerable data property.`,
    );
    return [key, descriptor.value];
  });
}

function flattenDtcgDocument(document) {
  const leaves = new Map();
  function visit(node, segments, inheritedType) {
    const label = segments.length === 0 ? "/" : segments.join(".");
    const entries = safeRecordEntries(node, label);
    const entryMap = new Map(entries);
    const ownType = entryMap.get("$type");
    assertCondition(
      ownType === undefined || ownType === "color" || ownType === "dimension",
      "TOKEN_FIXTURE_DTCG_DRIFT",
      `${label} has an unsupported DTCG type.`,
    );
    const type = ownType ?? inheritedType;
    if (entryMap.has("$value")) {
      assertCondition(
        entries.every(([key]) => ["$description", "$type", "$value"].includes(key)),
        "TOKEN_FIXTURE_DTCG_DRIFT",
        `${label} token contains an unsupported member.`,
      );
      assertCondition(
        type === "color" || type === "dimension",
        "TOKEN_FIXTURE_DTCG_DRIFT",
        `${label} token has no effective type.`,
      );
      leaves.set(label, Object.freeze({ type, value: entryMap.get("$value") }));
      return;
    }
    assertCondition(
      entries
        .filter(([key]) => key.startsWith("$"))
        .every(([key]) => key === "$description" || key === "$type"),
      "TOKEN_FIXTURE_DTCG_DRIFT",
      `${label} group contains an unsupported DTCG member.`,
    );
    const children = entries.filter(([key]) => !key.startsWith("$"));
    assertCondition(
      children.length > 0,
      "TOKEN_FIXTURE_DTCG_DRIFT",
      `${label} group may not be empty in the reference subset.`,
    );
    for (const [key, child] of children) {
      assertCondition(
        key.length > 0 && !/[.{}]/u.test(key),
        "TOKEN_FIXTURE_DTCG_DRIFT",
        `${label} has an invalid group or token name.`,
      );
      visit(child, [...segments, key], type);
    }
  }
  visit(document, [], undefined);
  return leaves;
}

function inspectDtcgValue(entry, expected) {
  if (expected.alias !== null) {
    assertCondition(
      entry.value === expected.alias,
      "TOKEN_FIXTURE_DTCG_DRIFT",
      `${expected.token} alias changed.`,
    );
    return Object.freeze({ kind: "alias", alias: expected.alias });
  }
  const valueEntries = safeRecordEntries(entry.value, `${expected.token}.$value`);
  const value = Object.fromEntries(valueEntries);
  if (expected.type === "dimension") {
    assertArrayEqual(
      sorted(Object.keys(value)),
      ["unit", "value"],
      "TOKEN_FIXTURE_DTCG_DRIFT",
      `${expected.token} dimension shape changed.`,
    );
    assertCondition(
      (value.unit === "px" || value.unit === "rem") &&
        typeof value.value === "number" &&
        Number.isFinite(value.value) &&
        `${value.value}${value.unit}` === expected.value,
      "TOKEN_FIXTURE_DTCG_DRIFT",
      `${expected.token} dimension value changed.`,
    );
    return Object.freeze({ kind: "dimension", unit: value.unit, value: value.value });
  }

  assertArrayEqual(
    sorted(Object.keys(value)),
    ["alpha", "colorSpace", "components", "hex"],
    "TOKEN_FIXTURE_DTCG_DRIFT",
    `${expected.token} color shape changed.`,
  );
  assertCondition(
    value.colorSpace === "srgb" &&
      value.alpha === 1 &&
      value.hex === expected.value &&
      Array.isArray(value.components) &&
      value.components.length === 3 &&
      value.components.every(
        (component) =>
          typeof component === "number" &&
          Number.isFinite(component) &&
          component >= 0 &&
          component <= 1,
      ),
    "TOKEN_FIXTURE_DTCG_DRIFT",
    `${expected.token} color value changed.`,
  );
  const calculatedHex = `#${value.components
    .map((component) =>
      Math.round(component * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
  assertCondition(
    calculatedHex === value.hex,
    "TOKEN_FIXTURE_DTCG_DRIFT",
    `${expected.token} sRGB components and hex differ.`,
  );
  return Object.freeze({ kind: "color", colorSpace: "srgb", alpha: 1, hex: value.hex });
}

function inspectTokens(tokenApi) {
  assertDeeplyFrozen(tokenApi.REFERENCE_TOKEN_DOCUMENT, "REFERENCE_TOKEN_DOCUMENT");
  assertDeeplyFrozen(tokenApi.REFERENCE_WEB_TOKEN_PROVIDER, "REFERENCE_WEB_TOKEN_PROVIDER");
  assertDeeplyFrozen(tokenApi.REFERENCE_WEB_TOKEN_VALUES, "REFERENCE_WEB_TOKEN_VALUES");
  assertDeeplyFrozen(
    tokenApi.REFERENCE_WEB_TOKEN_CSS_PROPERTIES,
    "REFERENCE_WEB_TOKEN_CSS_PROPERTIES",
  );
  assertDeeplyFrozen(
    tokenApi.REFERENCE_WEB_TOKEN_CSS_REFERENCES,
    "REFERENCE_WEB_TOKEN_CSS_REFERENCES",
  );
  assertCondition(
    Object.getPrototypeOf(tokenApi.REFERENCE_WEB_TOKEN_CSS_PROPERTIES) === Object.prototype,
    "TOKEN_FIXTURE_INVENTORY_DRIFT",
    "The React host style projection must use an ordinary object prototype.",
  );

  const leaves = flattenDtcgDocument(tokenApi.REFERENCE_TOKEN_DOCUMENT);
  assertArrayEqual(
    sorted(leaves.keys()),
    TOKEN_INVENTORY.map(({ token }) => token),
    "TOKEN_FIXTURE_INVENTORY_DRIFT",
    "The DTCG leaf inventory changed.",
  );
  assertArrayEqual(
    [...tokenApi.REFERENCE_WEB_TOKEN_PROVIDER.tokenPaths],
    TOKEN_INVENTORY.map(({ token }) => token),
    "TOKEN_FIXTURE_INVENTORY_DRIFT",
    "The provider token path inventory changed.",
  );

  const entries = [];
  for (const expected of TOKEN_INVENTORY) {
    const leaf = leaves.get(expected.token);
    assertCondition(
      leaf?.type === expected.type,
      "TOKEN_FIXTURE_DTCG_DRIFT",
      `${expected.token} effective type changed.`,
    );
    const source = inspectDtcgValue(leaf, expected);
    const resolved = tokenApi.resolveReferenceWebToken(expected.token);
    assertCondition(
      JSON.stringify(resolved) ===
        JSON.stringify({
          ok: true,
          token: expected.token,
          value: expected.value,
          cssProperty: expected.cssProperty,
          cssReference: expected.cssReference,
        }),
      "TOKEN_FIXTURE_INVENTORY_DRIFT",
      `${expected.token} resolution changed.`,
      { actual: resolved, expected },
    );
    assertDeeplyFrozen(resolved, `resolution(${expected.token})`);
    assertCondition(
      tokenApi.REFERENCE_WEB_TOKEN_VALUES[expected.token] === expected.value &&
        tokenApi.REFERENCE_WEB_TOKEN_CSS_PROPERTIES[expected.cssProperty] === expected.value &&
        tokenApi.REFERENCE_WEB_TOKEN_CSS_REFERENCES[expected.token] === expected.cssReference,
      "TOKEN_FIXTURE_INVENTORY_DRIFT",
      `${expected.token} map projection changed.`,
    );
    entries.push(Object.freeze({ ...expected, source }));
  }

  assertArrayEqual(
    sorted(Object.keys(tokenApi.REFERENCE_WEB_TOKEN_VALUES)),
    TOKEN_INVENTORY.map(({ token }) => token),
    "TOKEN_FIXTURE_INVENTORY_DRIFT",
    "The token value map changed.",
  );
  assertArrayEqual(
    sorted(Object.keys(tokenApi.REFERENCE_WEB_TOKEN_CSS_PROPERTIES)),
    sorted(TOKEN_INVENTORY.map(({ cssProperty }) => cssProperty)),
    "TOKEN_FIXTURE_INVENTORY_DRIFT",
    "The CSS property inventory changed.",
  );
  assertArrayEqual(
    sorted(Object.keys(tokenApi.REFERENCE_WEB_TOKEN_CSS_REFERENCES)),
    TOKEN_INVENTORY.map(({ token }) => token),
    "TOKEN_FIXTURE_INVENTORY_DRIFT",
    "The CSS reference inventory changed.",
  );

  const unknownCases = [
    "",
    "color",
    "color.info",
    "color.info.unknown",
    "__proto__",
    "prototype",
    "constructor",
    "toString",
    "hasOwnProperty",
    "{color.action.primary}",
  ];
  for (const token of unknownCases) {
    const expectedFailure = Object.freeze({ ok: false, code: "UNKNOWN_TOKEN", token });
    for (const result of [
      tokenApi.resolveReferenceWebToken(token),
      tokenApi.REFERENCE_WEB_TOKEN_PROVIDER.resolve(token),
    ]) {
      assertCondition(
        JSON.stringify(result) === JSON.stringify(expectedFailure),
        "TOKEN_FIXTURE_UNKNOWN_TOKEN_DRIFT",
        `Unknown token ${JSON.stringify(token)} did not fail explicitly.`,
      );
      assertDeeplyFrozen(result, `unknown(${token})`);
    }
  }
  return Object.freeze({
    entries: Object.freeze(entries),
    unknownCases: Object.freeze(unknownCases),
  });
}

function parseSource(text, relativePath) {
  const sourceFile = ts.createSourceFile(
    relativePath,
    text,
    ts.ScriptTarget.ESNext,
    true,
    relativePath.endsWith(".tsx")
      ? ts.ScriptKind.TSX
      : relativePath.endsWith(".mjs")
        ? ts.ScriptKind.JS
        : ts.ScriptKind.TS,
  );
  assertCondition(
    sourceFile.parseDiagnostics.length === 0,
    "TOKEN_FIXTURE_SOURCE_PARSE_FAILED",
    `${relativePath} could not be parsed.`,
  );
  return sourceFile;
}

function auditPlatformNeutralSource(text, relativePath, allowedImports, allowedTypeImports = []) {
  const sourceFile = parseSource(text, relativePath);
  const imports = [];
  const forbiddenIdentifiers = new Set();
  function visit(node) {
    if (
      ts.isImportDeclaration(node) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      imports.push(
        Object.freeze({
          specifier: node.moduleSpecifier.text,
          typeOnly: node.importClause?.isTypeOnly === true,
        }),
      );
    }
    if (ts.isIdentifier(node) && FORBIDDEN_PLATFORM_IDENTIFIERS.has(node.text)) {
      forbiddenIdentifiers.add(node.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  for (const { specifier, typeOnly } of imports) {
    assertCondition(
      (allowedImports.some(
        (allowed) => specifier === allowed || (allowed === "./" && specifier.startsWith("./")),
      ) ||
        (typeOnly && allowedTypeImports.includes(specifier))) &&
        (!FORBIDDEN_PLATFORM_IMPORTS.includes(specifier) || typeOnly),
      "TOKEN_FIXTURE_PLATFORM_BOUNDARY_DRIFT",
      `${relativePath} imports disallowed platform module ${specifier}.`,
    );
  }
  assertArrayEqual(
    sorted(forbiddenIdentifiers),
    [],
    "TOKEN_FIXTURE_PLATFORM_BOUNDARY_DRIFT",
    `${relativePath} contains platform-specific identifiers.`,
  );
  return Object.freeze({
    path: relativePath,
    imports: Object.freeze(
      imports
        .map(({ specifier, typeOnly }) => `${typeOnly ? "type:" : "runtime:"}${specifier}`)
        .sort(compareText),
    ),
  });
}

function inspectComponentCoverage(componentSources, tokenValues) {
  const propertyToValue = new Map(
    TOKEN_INVENTORY.map(({ cssProperty, value }) => [cssProperty, value]),
  );
  const files = [];
  const completeProperties = new Set();
  let occurrences = 0;
  for (const [filename, source] of Object.entries(componentSources).sort(([left], [right]) =>
    compareText(left, right),
  )) {
    parseSource(source, filename);
    const allProperties = [...source.matchAll(/--desen-[a-z0-9-]+/gu)].map(([match]) => match);
    const references = [
      ...source.matchAll(/var\(\s*(--desen-[a-z0-9-]+)\s*,\s*([^)]+?)\s*\)/gu),
    ].map((match) => ({ cssProperty: match[1], fallback: match[2].trim() }));
    assertCondition(
      references.length === allProperties.length,
      "TOKEN_FIXTURE_COMPONENT_CSS_DRIFT",
      `${filename} contains a DESEN CSS property outside a var() reference with fallback.`,
    );
    assertArrayEqual(
      sorted(new Set(references.map(({ cssProperty }) => cssProperty))),
      COMPONENT_TOKEN_PROPERTIES[filename],
      "TOKEN_FIXTURE_COMPONENT_CSS_DRIFT",
      `${filename} token property coverage changed.`,
    );
    for (const { cssProperty, fallback } of references) {
      const expectedValue = propertyToValue.get(cssProperty);
      assertCondition(
        expectedValue !== undefined &&
          tokenValues[TOKEN_INVENTORY.find((entry) => entry.cssProperty === cssProperty)?.token] ===
            expectedValue &&
          fallback === expectedValue,
        "TOKEN_FIXTURE_COMPONENT_CSS_DRIFT",
        `${filename} fallback for ${cssProperty} differs from the provider.`,
        { fallback, expectedValue },
      );
      completeProperties.add(cssProperty);
      occurrences += 1;
    }
    files.push(
      Object.freeze({
        path: filename,
        properties: Object.freeze(
          sorted(new Set(references.map(({ cssProperty }) => cssProperty))),
        ),
        occurrences: references.length,
      }),
    );
  }
  assertArrayEqual(
    sorted(completeProperties),
    sorted(TOKEN_INVENTORY.map(({ cssProperty }) => cssProperty)),
    "TOKEN_FIXTURE_COMPONENT_CSS_DRIFT",
    "The current five component sources do not cover all 26 provider CSS properties.",
  );
  return Object.freeze({
    files: Object.freeze(files),
    coveredProperties: Object.freeze(sorted(completeProperties)),
    occurrences,
  });
}

function assertPlainJson(value, label) {
  const active = new Set();
  function visit(current, pathLabel) {
    if (current === null || typeof current === "string" || typeof current === "boolean") {
      return;
    }
    if (typeof current === "number") {
      assertCondition(
        Number.isFinite(current),
        "TOKEN_FIXTURE_FIXTURE_DRIFT",
        `${pathLabel} contains a non-finite number.`,
      );
      return;
    }
    assertCondition(
      typeof current === "object" && current !== null,
      "TOKEN_FIXTURE_BINDING_LEAK",
      `${pathLabel} contains an executable or non-JSON value.`,
    );
    assertCondition(
      !active.has(current),
      "TOKEN_FIXTURE_FIXTURE_DRIFT",
      `${pathLabel} contains a cycle.`,
    );
    active.add(current);
    const prototype = Object.getPrototypeOf(current);
    assertCondition(
      Array.isArray(current)
        ? prototype === Array.prototype
        : prototype === Object.prototype || prototype === null,
      "TOKEN_FIXTURE_FIXTURE_DRIFT",
      `${pathLabel} contains an unsupported object prototype.`,
    );
    for (const key of Reflect.ownKeys(current)) {
      assertCondition(
        typeof key === "string",
        "TOKEN_FIXTURE_FIXTURE_DRIFT",
        `${pathLabel} contains a symbol key.`,
      );
      const descriptor = Object.getOwnPropertyDescriptor(current, key);
      assertCondition(
        descriptor !== undefined && Object.hasOwn(descriptor, "value"),
        "TOKEN_FIXTURE_ACCESSOR_DRIFT",
        `${pathLabel}.${key} must be a data property.`,
      );
      visit(descriptor.value, `${pathLabel}.${key}`);
    }
    active.delete(current);
  }
  visit(value, label);
  let serialized;
  try {
    serialized = JSON.stringify(value);
  } catch (error) {
    fail("TOKEN_FIXTURE_FIXTURE_DRIFT", `${label} is not JSON-serializable.`, {
      cause: error instanceof Error ? error.message : String(error),
    });
  }
  assertCondition(
    !/(?:endpoint|execute|callback|https?:\/\/)/iu.test(serialized),
    "TOKEN_FIXTURE_BINDING_LEAK",
    `${label} contains a host binding, endpoint, or executable field.`,
  );
  return serialized;
}

function expectFixtureTypeError(invoke, messagePattern, label) {
  let rejection;
  try {
    invoke();
  } catch (error) {
    rejection = error;
  }
  assertCondition(
    rejection instanceof TypeError &&
      typeof rejection.message === "string" &&
      messagePattern.test(rejection.message),
    "TOKEN_FIXTURE_GUARDRAIL_DRIFT",
    `${label} was not rejected with the expected stable TypeError.`,
    {
      actual:
        rejection instanceof Error
          ? `${rejection.name}: ${rejection.message}`
          : rejection === undefined
            ? "no rejection"
            : String(rejection),
      expected: messagePattern.source,
    },
  );
}

function inspectFixtures(testkitApi, catalogApi) {
  const operation = catalogApi.registerOperation({
    id: "com.example.proof/calculate",
    manifest: {
      description: "Synthetic calculation proof contract.",
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
      errors: [{ code: "INVALID_INPUT" }],
      effect: "none",
      authoring: {
        fixtures: {
          success: { total: 42, record: "synthetic-operation-result" },
          errors: { INVALID_INPUT: { field: "synthetic-field" } },
        },
      },
      extensions: {
        "proof.binding": {
          endpoint: "https://binding.invalid/calculate",
        },
      },
    },
  });
  const resource = catalogApi.registerResource({
    id: "com.example.proof/items",
    manifest: {
      description: "Synthetic item proof contract.",
      inputSchema: { type: "object" },
      outputSchema: { type: "array" },
      errors: [],
      policies: ["manual"],
      authoring: {
        fixtures: {
          populated: [{ id: "synthetic-item" }],
          empty: [],
        },
      },
      extensions: {
        "proof.binding": {
          endpoint: "https://binding.invalid/items",
        },
      },
    },
  });
  const snapshot = testkitApi.createSyntheticFixtureSnapshot({
    context: testkitApi.SYNTHETIC_FIXTURE_CONTEXT,
    operations: [operation],
    resources: [resource],
  });
  assertDeeplyFrozen(snapshot, "synthetic fixture snapshot");
  assertPlainJson(snapshot, "synthetic fixture snapshot");
  const expectedSnapshot = {
    context: {
      kind: "synthetic-authoring-fixture",
      source: "manifest.authoring.fixtures",
    },
    operations: {
      "com.example.proof/calculate": {
        errors: { INVALID_INPUT: { field: "synthetic-field" } },
        success: { record: "synthetic-operation-result", total: 42 },
      },
    },
    resources: {
      "com.example.proof/items": {
        empty: [],
        populated: [{ id: "synthetic-item" }],
      },
    },
  };
  assertCondition(
    JSON.stringify(snapshot) === JSON.stringify(expectedSnapshot),
    "TOKEN_FIXTURE_FIXTURE_DRIFT",
    "The inert sample operation/resource projection changed.",
    { actual: snapshot, expected: expectedSnapshot },
  );

  const found = Object.freeze({
    operationSuccess: testkitApi.lookupSyntheticOperationSuccess(
      snapshot,
      "com.example.proof/calculate",
    ),
    operationError: testkitApi.lookupSyntheticOperationError(
      snapshot,
      "com.example.proof/calculate",
      "INVALID_INPUT",
    ),
    resource: testkitApi.lookupSyntheticResourceFixture(
      snapshot,
      "com.example.proof/items",
      "populated",
    ),
  });
  const missing = Object.freeze({
    operation: testkitApi.lookupSyntheticOperationSuccess(snapshot, "com.example.proof/missing"),
    error: testkitApi.lookupSyntheticOperationError(
      snapshot,
      "com.example.proof/calculate",
      "MISSING",
    ),
    resource: testkitApi.lookupSyntheticResourceFixture(
      snapshot,
      "com.example.proof/items",
      "missing",
    ),
  });
  for (const [label, result] of [...Object.entries(found), ...Object.entries(missing)]) {
    assertDeeplyFrozen(result, `${label} lookup`);
    assertPlainJson(result, `${label} lookup`);
  }
  assertCondition(
    Object.values(found).every(({ status }) => status === "found") &&
      Object.values(missing).every(
        (result) =>
          result.status === "missing" && Object.keys(result).sort().join(",") === "context,status",
      ),
    "TOKEN_FIXTURE_FIXTURE_DRIFT",
    "Synthetic fixture found/missing lookup semantics changed.",
  );

  const forgedOperation = Object.freeze({ ...operation, execute: () => null });
  let executableRejected = false;
  try {
    testkitApi.createSyntheticFixtureSnapshot({
      context: testkitApi.SYNTHETIC_FIXTURE_CONTEXT,
      operations: [forgedOperation],
      resources: [resource],
    });
  } catch (error) {
    executableRejected = error instanceof TypeError;
  }
  assertCondition(
    executableRejected,
    "TOKEN_FIXTURE_BINDING_LEAK",
    "Fixture construction accepted an executable host binding.",
  );

  const createSnapshot = (operations, resources) =>
    testkitApi.createSyntheticFixtureSnapshot({
      context: testkitApi.SYNTHETIC_FIXTURE_CONTEXT,
      operations,
      resources,
    });
  const operationWithSuccess = (id, success) => ({
    id,
    manifest: {
      inputSchema: {},
      outputSchema: {},
      errors: [],
      effect: "none",
      authoring: { fixtures: { success } },
    },
  });

  expectFixtureTypeError(
    () =>
      createSnapshot(
        [
          {
            id: "com.example.proof/missing-errors",
            manifest: {
              inputSchema: {},
              outputSchema: {},
              effect: "none",
              authoring: { fixtures: { success: { synthetic: true } } },
            },
          },
        ],
        [],
      ),
    /expected the required public-error array/u,
    "Required operation errors",
  );
  expectFixtureTypeError(
    () => createSnapshot([resource], []),
    /expected a declared operation effect/u,
    "Resource-in-operation category",
  );
  expectFixtureTypeError(
    () => createSnapshot([], [operation]),
    /expected unique declared resource policies/u,
    "Operation-in-resource category",
  );
  expectFixtureTypeError(
    () => createSnapshot([operation], [{ id: operation.id, manifest: resource.manifest }]),
    /is already registered as an operation/u,
    "Cross-category duplicate capability id",
  );

  let excessiveDepth = {};
  for (let depth = 0; depth < 65; depth += 1) {
    excessiveDepth = { next: excessiveDepth };
  }
  expectFixtureTypeError(
    () =>
      createSnapshot([operationWithSuccess("com.example.proof/depth-limit", excessiveDepth)], []),
    /64-level depth limit/u,
    "Synthetic fixture depth limit",
  );
  expectFixtureTypeError(
    () =>
      createSnapshot(
        [
          operationWithSuccess(
            "com.example.proof/node-limit",
            Array.from({ length: 20_001 }, (_, index) => index),
          ),
        ],
        [],
      ),
    /20000-node limit/u,
    "Synthetic fixture node limit",
  );
  expectFixtureTypeError(
    () =>
      createSnapshot(
        [operationWithSuccess("com.example.proof/byte-limit", "x".repeat(1_048_577))],
        [],
      ),
    /1048576-byte canonical input limit/u,
    "Synthetic fixture canonical byte limit",
  );

  let propertyTrapCalls = 0;
  const forgedSnapshot = new Proxy(
    {},
    {
      get() {
        propertyTrapCalls += 1;
        return {};
      },
    },
  );
  for (const [label, invoke] of [
    [
      "operation-success factory snapshot",
      () =>
        testkitApi.lookupSyntheticOperationSuccess(forgedSnapshot, "com.example.proof/calculate"),
    ],
    [
      "operation-error factory snapshot",
      () =>
        testkitApi.lookupSyntheticOperationError(
          forgedSnapshot,
          "com.example.proof/calculate",
          "INVALID_INPUT",
        ),
    ],
    [
      "resource factory snapshot",
      () =>
        testkitApi.lookupSyntheticResourceFixture(
          forgedSnapshot,
          "com.example.proof/items",
          "populated",
        ),
    ],
  ]) {
    expectFixtureTypeError(
      invoke,
      /expected a snapshot created by createSyntheticFixtureSnapshot/u,
      label,
    );
  }
  assertCondition(
    propertyTrapCalls === 0,
    "TOKEN_FIXTURE_GUARDRAIL_DRIFT",
    "A forged snapshot property trap ran before factory provenance rejection.",
  );

  const forgedName = {
    toString() {
      propertyTrapCalls += 1;
      return "com.example.proof/calculate";
    },
  };
  for (const [label, invoke] of [
    ["operationId", () => testkitApi.lookupSyntheticOperationSuccess(snapshot, forgedName)],
    [
      "errorCode",
      () =>
        testkitApi.lookupSyntheticOperationError(
          snapshot,
          "com.example.proof/calculate",
          forgedName,
        ),
    ],
    [
      "resourceId",
      () => testkitApi.lookupSyntheticResourceFixture(snapshot, forgedName, "populated"),
    ],
    [
      "fixtureName",
      () =>
        testkitApi.lookupSyntheticResourceFixture(snapshot, "com.example.proof/items", forgedName),
    ],
  ]) {
    expectFixtureTypeError(invoke, /expected a string/u, `Non-string ${label}`);
  }
  assertCondition(
    propertyTrapCalls === 0,
    "TOKEN_FIXTURE_GUARDRAIL_DRIFT",
    "A non-string lookup name was coerced before rejection.",
  );

  const fixtureEvidence = Object.freeze({
    context: snapshot.context,
    snapshot,
    found,
    missing,
    bindingDataExcluded: true,
    executableBindingRejected: true,
    guardrails: Object.freeze({
      requiredOperationErrors: true,
      capabilityCategories: Object.freeze(["operation", "resource"]),
      crossCategoryCapabilityIdsRejected: true,
      limits: Object.freeze({
        depth: 64,
        nodes: 20_000,
        canonicalUtf8Bytes: 1_048_576,
      }),
      factorySnapshotOnlyLookups: Object.freeze([
        "lookupSyntheticOperationError",
        "lookupSyntheticOperationSuccess",
        "lookupSyntheticResourceFixture",
      ]),
      stringOnlyLookupNames: Object.freeze([
        "errorCode",
        "fixtureName",
        "operationId",
        "resourceId",
      ]),
    }),
  });
  assertPlainJson(fixtureEvidence, "synthetic fixture evidence");
  return fixtureEvidence;
}

function collectNamedExports(text, relativePath) {
  const sourceFile = parseSource(text, relativePath);
  const runtime = new Set();
  const types = new Set();
  for (const statement of sourceFile.statements) {
    if (ts.isExportDeclaration(statement) && statement.exportClause !== undefined) {
      const typeOnlyStatement = statement.isTypeOnly;
      if (ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) {
          (typeOnlyStatement || element.isTypeOnly ? types : runtime).add(element.name.text);
        }
      }
    }
    const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined;
    if (modifiers?.some(({ kind }) => kind === ts.SyntaxKind.ExportKeyword)) {
      const name = statement.name?.text;
      if (name !== undefined) {
        const typeOnly =
          ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement);
        (typeOnly ? types : runtime).add(name);
      }
    }
  }
  return Object.freeze({
    runtime: Object.freeze(sorted(runtime)),
    types: Object.freeze(sorted(types)),
  });
}

function inspectPublicSurfaces({
  tokenIndexSource,
  tokenDeclaration,
  testkitIndexSource,
  testkitDeclaration,
  tokenConsumer,
  testkitConsumer,
  referencePackage,
  testkitPackage,
}) {
  for (const [text, relativePath, runtimeExpected, typeExpected] of [
    [
      tokenIndexSource,
      "packages/reference-catalog-web/src/tokens/index.ts",
      TOKEN_RUNTIME_EXPORTS,
      TOKEN_TYPE_EXPORTS,
    ],
    [
      tokenDeclaration,
      "packages/reference-catalog-web/dist/tokens/index.d.ts",
      TOKEN_RUNTIME_EXPORTS,
      TOKEN_TYPE_EXPORTS,
    ],
    [
      testkitIndexSource,
      "packages/testkit/src/index.ts",
      TESTKIT_RUNTIME_EXPORTS,
      TESTKIT_TYPE_EXPORTS,
    ],
    [
      testkitDeclaration,
      "packages/testkit/dist/index.d.ts",
      TESTKIT_RUNTIME_EXPORTS,
      TESTKIT_TYPE_EXPORTS,
    ],
  ]) {
    const exports = collectNamedExports(text, relativePath);
    assertArrayEqual(
      exports.runtime,
      runtimeExpected,
      "TOKEN_FIXTURE_DECLARATION_DRIFT",
      `${relativePath} runtime exports changed.`,
    );
    assertArrayEqual(
      exports.types,
      typeExpected,
      "TOKEN_FIXTURE_DECLARATION_DRIFT",
      `${relativePath} type exports changed.`,
    );
  }

  assertCondition(
    tokenConsumer.trim() === 'export * from "@desen/reference-catalog-web/tokens";' &&
      testkitConsumer.includes('from "@desen/testkit"') &&
      !tokenConsumer.includes("../") &&
      !testkitConsumer.includes("../"),
    "TOKEN_FIXTURE_PACKAGE_CONSUMER_DRIFT",
    "Evidence consumers must use the public package specifiers.",
  );
  assertCondition(
    referencePackage.exports?.["./tokens"]?.types === "./dist/tokens/index.d.ts" &&
      referencePackage.exports?.["./tokens"]?.import === "./dist/tokens/index.js",
    "TOKEN_FIXTURE_PACKAGE_EXPORT_DRIFT",
    "The reference token subpath export changed.",
  );
  assertCondition(
    testkitPackage.exports?.["."]?.types === "./dist/index.d.ts" &&
      testkitPackage.exports?.["."]?.import === "./dist/index.js",
    "TOKEN_FIXTURE_PACKAGE_EXPORT_DRIFT",
    "The testkit public export changed.",
  );
  assertCondition(
    !Object.hasOwn(referencePackage.dependencies ?? {}, "@desen/testkit") &&
      !Object.hasOwn(referencePackage.peerDependencies ?? {}, "@desen/testkit") &&
      !Object.hasOwn(testkitPackage.dependencies ?? {}, "react") &&
      !Object.hasOwn(testkitPackage.dependencies ?? {}, "react-dom"),
    "TOKEN_FIXTURE_PLATFORM_BOUNDARY_DRIFT",
    "Production tokens depend on testkit or testkit depends on React.",
  );
  return Object.freeze({
    tokenPackage: "@desen/reference-catalog-web/tokens",
    testkitPackage: "@desen/testkit",
    tokenRuntimeExports: TOKEN_RUNTIME_EXPORTS,
    tokenTypeExports: TOKEN_TYPE_EXPORTS,
    testkitRuntimeExports: TESTKIT_RUNTIME_EXPORTS,
    testkitTypeExports: TESTKIT_TYPE_EXPORTS,
  });
}

function inspectPackageDocumentation(referenceReadme, testkitReadme) {
  const documents = [
    {
      path: "packages/reference-catalog-web/README.md",
      text: referenceReadme.replaceAll(/\s+/gu, " ").trim(),
      claims: [
        "stable DTCG 2025.10 format",
        "exact 26 CSS custom properties",
        "runtime responsibilities remain assigned to M04",
        "final package tuple remain assigned to M03-T08 through M03-T10 and M05",
      ],
    },
    {
      path: "packages/testkit/README.md",
      text: testkitReadme.replaceAll(/\s+/gu, " ").trim(),
      claims: [
        "caller's explicit classification; it is not a secret, credential, or personal-data detector",
        "correct category. The same capability id cannot be projected in both maps",
        "bounded to 64 nested levels, 20,000 traversed values, and 1,048,576 canonical UTF-8 bytes",
        "Lookup helpers accept only snapshots created by this process",
        "Actual sign-in values and trusted host bindings are not part of this infrastructure",
      ],
    },
  ];
  for (const document of documents) {
    for (const claim of document.claims) {
      assertCondition(
        document.text.includes(claim),
        "TOKEN_FIXTURE_DOCUMENTATION_DRIFT",
        `${document.path} lost required claim: ${claim}.`,
      );
    }
  }
  return Object.freeze(
    documents.map(({ path: documentPath, claims }) =>
      Object.freeze({
        path: documentPath,
        claims: Object.freeze([...claims]),
      }),
    ),
  );
}

function extractTestTitles(text, relativePath) {
  parseSource(text, relativePath);
  return [...text.matchAll(/\bit\(\s*["'`]([^"'`]+)["'`]/gu)].map((match) => match[1]);
}

function extractRootTestTitles(text) {
  parseSource(text, "tests/reference-tokens-and-synthetic-fixtures.test.mjs");
  return [...text.matchAll(/\btest\(\s*["'`]([^"'`]+)["'`]/gu)].map((match) => match[1]);
}

function extractNegativeCases(text) {
  return [...text.matchAll(/@ts-expect-error\s+(M03-T07-N[0-9]{2})\b/gu)].map((match) => match[1]);
}

function inspectInventories({ tokenTest, fixtureTest, tokenTypeTest, fixtureTypeTest, rootTest }) {
  const tokenTests = extractTestTitles(
    tokenTest,
    "packages/reference-catalog-web/test/reference-tokens.test.ts",
  );
  const fixtureTests = extractTestTitles(
    fixtureTest,
    "packages/testkit/test/synthetic-fixtures.test.ts",
  );
  const rootTests = extractRootTestTitles(rootTest);
  const tokenNegativeCases = extractNegativeCases(tokenTypeTest);
  const fixtureNegativeCases = extractNegativeCases(fixtureTypeTest);
  assertArrayEqual(
    tokenTests,
    EXPECTED_TOKEN_TEST_TITLES,
    "TOKEN_FIXTURE_TEST_INVENTORY_DRIFT",
    "The token package test inventory changed.",
  );
  assertArrayEqual(
    fixtureTests,
    EXPECTED_FIXTURE_TEST_TITLES,
    "TOKEN_FIXTURE_TEST_INVENTORY_DRIFT",
    "The fixture package test inventory changed.",
  );
  assertArrayEqual(
    rootTests,
    EXPECTED_ROOT_TEST_TITLES,
    "TOKEN_FIXTURE_TEST_INVENTORY_DRIFT",
    "The root proof test inventory changed.",
  );
  assertArrayEqual(
    tokenNegativeCases,
    EXPECTED_TOKEN_NEGATIVE_CASES,
    "TOKEN_FIXTURE_TYPE_INVENTORY_DRIFT",
    "The token compiler-negative inventory changed.",
  );
  assertArrayEqual(
    fixtureNegativeCases,
    EXPECTED_FIXTURE_NEGATIVE_CASES,
    "TOKEN_FIXTURE_TYPE_INVENTORY_DRIFT",
    "The fixture compiler-negative inventory changed.",
  );
  return Object.freeze({
    tokenTests: Object.freeze(tokenTests),
    fixtureTests: Object.freeze(fixtureTests),
    rootTests: Object.freeze(rootTests),
    tokenNegativeCases: Object.freeze(tokenNegativeCases),
    fixtureNegativeCases: Object.freeze(fixtureNegativeCases),
  });
}

function inspectRootWiring(rootPackage) {
  for (const [kind, expected] of Object.entries(EXPECTED_ROOT_SCRIPTS)) {
    const name = `${kind}:reference-tokens-and-synthetic-fixtures`;
    assertCondition(
      rootPackage.scripts?.[name] === expected,
      "TOKEN_FIXTURE_ROOT_WIRING_DRIFT",
      `Root script ${name} changed or became incomplete.`,
      { actual: rootPackage.scripts?.[name], expected },
    );
  }
  for (const name of ["test", "check"]) {
    assertCondition(
      rootPackage.scripts?.[name]?.includes(
        `${name === "test" ? "test" : "verify"}:reference-tokens-and-synthetic-fixtures`,
      ),
      "TOKEN_FIXTURE_ROOT_WIRING_DRIFT",
      `Root ${name} no longer runs M03-T07 evidence.`,
    );
  }
}

async function verifyPrerequisite(artifactPath) {
  let verification;
  try {
    verification = await verifyReferenceCatalogWebFormFeedbackEvidence({ artifactPath });
  } catch (error) {
    fail("TOKEN_FIXTURE_PREREQUISITE_DRIFT", "M03-T06 prerequisite verification failed.", {
      cause: error instanceof Error ? error.message : String(error),
    });
  }
  const bytes = await readFile(artifactPath);
  let artifact;
  try {
    artifact = JSON.parse(bytes);
  } catch {
    fail("TOKEN_FIXTURE_PREREQUISITE_DRIFT", "M03-T06 prerequisite is not valid JSON.");
  }
  assertCondition(
    artifact.schemaVersion === 1 &&
      artifact.task === "M03-T06" &&
      artifact.result === "PASS" &&
      artifact.claim?.protocol === "0.1.0" &&
      artifact.claim?.target === "web-react" &&
      artifact.evidence?.provenance?.mode === "tracked-defaults",
    "TOKEN_FIXTURE_PREREQUISITE_DRIFT",
    "M03-T06 prerequisite identity or provenance changed.",
  );
  const digest = sha256(bytes);
  assertCondition(
    verification.artifactSha256 === digest,
    "TOKEN_FIXTURE_PREREQUISITE_DRIFT",
    "M03-T06 verifier and prerequisite bytes disagree.",
  );
  return Object.freeze({
    task: "M03-T06",
    result: "PASS",
    verifiedBy: "verifyReferenceCatalogWebFormFeedbackEvidence",
    artifactSha256: digest,
  });
}

async function readInputs(paths) {
  const names = Object.keys(DEFAULT_PATHS).filter((name) => name !== "prerequisiteArtifactPath");
  const entries = await Promise.all(names.map(async (name) => [name, await readFile(paths[name])]));
  return Object.fromEntries(entries);
}

async function trackedFileHashes() {
  const workspace = await realpath(WORKSPACE_ROOT);
  return Promise.all(
    TRACKED_EVIDENCE_PATHS.map(async (relativePath) => {
      const absolutePath = path.join(WORKSPACE_ROOT, relativePath);
      const [entry, resolved] = await Promise.all([lstat(absolutePath), realpath(absolutePath)]);
      assertCondition(
        entry.isFile() && !entry.isSymbolicLink() && resolved.startsWith(`${workspace}${path.sep}`),
        "TOKEN_FIXTURE_TRACKED_FILE_UNSAFE",
        `${relativePath} must be a regular in-workspace file.`,
      );
      const bytes = await readFile(resolved);
      return Object.freeze({ path: relativePath, bytes: bytes.length, sha256: sha256(bytes) });
    }),
  );
}

async function canonicalArtifactTarget(artifactPath) {
  const absolute = path.resolve(artifactPath);
  try {
    return await realpath(absolute);
  } catch (error) {
    if (
      error === null ||
      typeof error !== "object" ||
      !Object.hasOwn(error, "code") ||
      error.code !== "ENOENT"
    ) {
      throw error;
    }
    return path.join(await realpath(path.dirname(absolute)), path.basename(absolute));
  }
}

async function targetsTrackedArtifact(artifactPath) {
  const [actual, expected] = await Promise.all([
    canonicalArtifactTarget(artifactPath),
    canonicalArtifactTarget(DEFAULT_REFERENCE_TOKENS_AND_SYNTHETIC_FIXTURES_ARTIFACT_PATH),
  ]);
  return actual === expected;
}

function assertCanonicalTrackedSpelling(artifactPath) {
  assertCondition(
    path.resolve(artifactPath) ===
      path.resolve(DEFAULT_REFERENCE_TOKENS_AND_SYNTHETIC_FIXTURES_ARTIFACT_PATH),
    "TOKEN_FIXTURE_TRACKED_ALIAS_REJECTED",
    "The tracked M03-T07 artifact may not be accessed through an alternate or symlink path.",
  );
}

/**
 * Builds deterministic M03-T07 evidence from the built public token and testkit packages.
 */
export async function buildReferenceTokensAndSyntheticFixturesEvidence(options = undefined) {
  const normalized = normalizeOptions(options, BUILD_OPTION_NAMES, "Build");
  validateBuildOptions(normalized);
  const overrides = Object.freeze(sorted(Object.keys(normalized)));
  const paths = Object.freeze(
    Object.fromEntries(
      Object.entries(DEFAULT_PATHS).map(([name, defaultPath]) => [
        name,
        normalized[name] ?? defaultPath,
      ]),
    ),
  );

  const [loadedTokenApi, loadedTestkitApi, loadedCatalogApi] = await Promise.all([
    normalized.tokenApi ??
      import(`${pathToFileURL(paths.tokenConsumerPath).href}?proof=${Date.now()}`),
    normalized.testkitApi ??
      import(`${pathToFileURL(paths.testkitConsumerPath).href}?proof=${Date.now()}`),
    normalized.catalogApi ??
      import(
        `${pathToFileURL(path.join(WORKSPACE_ROOT, "packages/catalog-sdk/dist/index.js")).href}`
      ),
  ]);
  const tokenCapture = captureApi(loadedTokenApi, TOKEN_RUNTIME_EXPORTS, "token API");
  const testkitCapture = captureApi(loadedTestkitApi, TESTKIT_RUNTIME_EXPORTS, "testkit API");
  const catalogCapture = captureApi(
    loadedCatalogApi,
    ["registerOperation", "registerResource"],
    "Catalog API",
  );

  const prerequisite =
    normalized.verifyPrerequisite === false
      ? Object.freeze({
          task: "M03-T06",
          result: "SKIPPED",
          verifiedBy: null,
          artifactSha256: null,
        })
      : await verifyPrerequisite(paths.prerequisiteArtifactPath);
  assertCondition(
    overrides.length > 0 || prerequisite.result === "PASS",
    "TOKEN_FIXTURE_PREREQUISITE_UNPROVEN",
    "Tracked-default M03-T07 evidence requires a passing M03-T06 prerequisite.",
  );

  const inputs = await readInputs(paths);
  const text = Object.fromEntries(
    Object.entries(inputs).map(([name, bytes]) => [name, bytes.toString("utf8")]),
  );
  const tokenEvidence = inspectTokens(tokenCapture.api);
  const componentCoverage = inspectComponentCoverage(
    {
      "alert.tsx": text.alertSourcePath,
      "button.tsx": text.buttonSourcePath,
      "stack.tsx": text.stackSourcePath,
      "text-field.tsx": text.textFieldSourcePath,
      "text.tsx": text.textSourcePath,
    },
    tokenCapture.api.REFERENCE_WEB_TOKEN_VALUES,
  );
  const fixtureEvidence = inspectFixtures(testkitCapture.api, catalogCapture.api);
  const sourceAudit = Object.freeze([
    auditPlatformNeutralSource(
      text.tokenDocumentSourcePath,
      "packages/reference-catalog-web/src/tokens/reference-token-document.ts",
      [],
    ),
    auditPlatformNeutralSource(
      text.tokenProviderSourcePath,
      "packages/reference-catalog-web/src/tokens/web-token-provider.ts",
      ["./"],
      ["react"],
    ),
    auditPlatformNeutralSource(
      text.testkitSourcePath,
      "packages/testkit/src/synthetic-fixtures.ts",
      ["@desen/protocol", "@desen/catalog-sdk"],
    ),
    auditPlatformNeutralSource(
      text.tokenBuiltProviderPath,
      "packages/reference-catalog-web/dist/tokens/web-token-provider.js",
      ["./"],
    ),
    auditPlatformNeutralSource(
      text.testkitBuiltSourcePath,
      "packages/testkit/dist/synthetic-fixtures.js",
      ["@desen/protocol"],
    ),
  ]);
  const publicApi = inspectPublicSurfaces({
    tokenIndexSource: text.tokenIndexSourcePath,
    tokenDeclaration: text.tokenDeclarationPath,
    testkitIndexSource: text.testkitIndexSourcePath,
    testkitDeclaration: text.testkitDeclarationPath,
    tokenConsumer: text.tokenConsumerPath,
    testkitConsumer: text.testkitConsumerPath,
    referencePackage: JSON.parse(text.referencePackagePath),
    testkitPackage: JSON.parse(text.testkitPackagePath),
  });
  const packageDocumentation = inspectPackageDocumentation(
    text.referenceReadmePath,
    text.testkitReadmePath,
  );
  const inventories = inspectInventories({
    tokenTest: text.tokenTestPath,
    fixtureTest: text.fixtureTestPath,
    tokenTypeTest: text.tokenTypeTestPath,
    fixtureTypeTest: text.fixtureTypeTestPath,
    rootTest: text.rootTestPath,
  });
  inspectRootWiring(JSON.parse(text.rootPackagePath));
  const normalizedProofDocument = text.proofDocumentPath.replaceAll(/\s+/gu, " ").trim();
  assertCondition(
    normalizedProofDocument.includes("M04-T03") &&
      normalizedProofDocument.includes("M03-T08") &&
      normalizedProofDocument.includes("N-036") &&
      normalizedProofDocument.includes("N-040") &&
      normalizedProofDocument.includes("64 nested levels") &&
      normalizedProofDocument.includes("20,000 traversed values") &&
      normalizedProofDocument.includes("1,048,576 canonical UTF-8 bytes") &&
      normalizedProofDocument.includes("caller classification") &&
      normalizedProofDocument.includes("factory-created snapshots") &&
      normalizedProofDocument.includes("remain incomplete"),
    "TOKEN_FIXTURE_DOCUMENTATION_DRIFT",
    "The proof document lost its runtime, fixture, or normative non-claims.",
  );

  const trackedFiles = await trackedFileHashes();
  tokenCapture.assertStable();
  testkitCapture.assertStable();
  catalogCapture.assertStable();

  const artifact = {
    schemaVersion: 1,
    task: "M03-T07",
    result: "PASS",
    claim: {
      summary:
        "One DTCG 2025.10 reference document supplies exactly 26 Web CSS tokens, while testkit projects only inert synthetic operation/resource fixtures.",
      protocol: "0.1.0",
      target: "web-react",
      normativeCoverage: {
        partial: ["N-036", "N-040"],
        note: "The local synthetic fixture boundary is constrained; later authoring, publication, host, secret, and personal-data audits remain required.",
      },
      proofMatrixStatusChanges: [],
    },
    prerequisite,
    tokens: {
      format: "DTCG 2025.10 reference subset",
      count: tokenEvidence.entries.length,
      inventory: tokenEvidence.entries,
      unknownCases: tokenEvidence.unknownCases,
      componentCssCoverage: componentCoverage,
      providerIsDomFree: true,
      genericDesenResolution: false,
    },
    fixtures: fixtureEvidence,
    publicApi,
    evidence: {
      provenance: {
        mode: overrides.length === 0 ? "tracked-defaults" : "injected-test",
        overrides,
      },
      sourceAudit,
      packageDocumentation,
      packageTests: {
        tokens: inventories.tokenTests,
        fixtures: inventories.fixtureTests,
      },
      rootTests: inventories.rootTests,
      typeNegativeCases: {
        tokens: inventories.tokenNegativeCases,
        fixtures: inventories.fixtureNegativeCases,
      },
      trackedFiles,
      commands: [
        "generate:reference-tokens-and-synthetic-fixtures",
        "verify:reference-tokens-and-synthetic-fixtures",
        "test:reference-tokens-and-synthetic-fixtures",
      ],
    },
    boundaries: [
      "DESEN references host-owned tokens and does not define a competing token-file format.",
      "The Web provider returns inert data and does not render a wrapper or mutate the DOM.",
      "Existing component var() fallbacks remain byte-owned by M03-T05/M03-T06 and exactly match provider values.",
      "Testkit snapshots include only manifest.authoring.fixtures and exclude host bindings.",
      "Production packages do not depend on @desen/testkit.",
      "The fixture sample is synthetic proof data, not a sign-in fixture or live user record.",
    ],
    deferred: [
      "M03-T08 sign-in pending, success, and failure fixtures with separate host operation binding",
      "M03-T09 complete catalog-to-implementation parity",
      "M03-T10 final immutable package inventory and exact tuple",
      "M04-T03 generic DESEN token lookup, fallback, receiving-schema validation, and runtime resolution",
      "M06/M09/M10 authoring-only scenario handling, publication exclusion, and production-host fixture ignorance",
      "M09-T11 and M12-T04 completion audits for N-036 and N-040",
    ],
  };
  const artifactText = await format(JSON.stringify(artifact), {
    parser: "json",
    endOfLine: "lf",
    printWidth: 100,
    tabWidth: 2,
  });
  const artifactBytes = Buffer.from(artifactText);
  tokenCapture.assertStable();
  testkitCapture.assertStable();
  return Object.freeze({ artifact, artifactBytes, artifactSha256: sha256(artifactBytes) });
}

/** Verifies an artifact against a fresh deterministic M03-T07 evidence build. */
export async function verifyReferenceTokensAndSyntheticFixturesEvidence(options = undefined) {
  const normalized = normalizeOptions(
    options,
    ["artifactPath", "artifactBytes", ...BUILD_OPTION_NAMES],
    "Verify",
  );
  const artifactPath =
    normalized.artifactPath ?? DEFAULT_REFERENCE_TOKENS_AND_SYNTHETIC_FIXTURES_ARTIFACT_PATH;
  assertCondition(
    typeof artifactPath === "string" && artifactPath.length > 0,
    "TOKEN_FIXTURE_OPTIONS_INVALID",
    "Verify artifactPath must be a non-empty path string.",
  );
  if (Object.hasOwn(normalized, "artifactBytes")) {
    assertCondition(
      normalized.artifactBytes instanceof Uint8Array &&
        !(
          typeof SharedArrayBuffer === "function" &&
          normalized.artifactBytes.buffer instanceof SharedArrayBuffer
        ),
      "TOKEN_FIXTURE_OPTIONS_INVALID",
      "Verify artifactBytes must be a non-shared byte array.",
    );
  }
  const buildOptions = Object.create(null);
  for (const name of BUILD_OPTION_NAMES) {
    if (Object.hasOwn(normalized, name)) buildOptions[name] = normalized[name];
  }
  const tracked =
    normalized.artifactBytes === undefined && (await targetsTrackedArtifact(artifactPath));
  if (tracked) {
    assertCanonicalTrackedSpelling(artifactPath);
    assertCondition(
      Object.keys(buildOptions).length === 0,
      "TOKEN_FIXTURE_NONDEFAULT_TRACKED_VERIFY",
      "The tracked M03-T07 artifact can only be verified from fixed defaults.",
    );
  }
  const expected = await buildReferenceTokensAndSyntheticFixturesEvidence(buildOptions);
  if (tracked) {
    assertCondition(
      expected.artifact.evidence.provenance.mode === "tracked-defaults" &&
        expected.artifact.prerequisite.result === "PASS",
      "TOKEN_FIXTURE_NONDEFAULT_TRACKED_VERIFY",
      "Tracked verification lost fixed provenance or its M03-T06 prerequisite.",
    );
  }
  const actualBytes = Buffer.from(normalized.artifactBytes ?? (await readFile(artifactPath)));
  assertCondition(
    actualBytes.equals(expected.artifactBytes),
    "TOKEN_FIXTURE_ARTIFACT_DRIFT",
    "The M03-T07 artifact differs from a fresh deterministic build.",
    { expectedSha256: expected.artifactSha256, actualSha256: sha256(actualBytes) },
  );
  return Object.freeze({
    result: "PASS",
    artifactSha256: expected.artifactSha256,
    prerequisiteSha256: expected.artifact.prerequisite.artifactSha256,
    provenanceMode: expected.artifact.evidence.provenance.mode,
    tokens: expected.artifact.tokens.count,
    componentCssProperties: expected.artifact.tokens.componentCssCoverage.coveredProperties.length,
    packageTests:
      expected.artifact.evidence.packageTests.tokens.length +
      expected.artifact.evidence.packageTests.fixtures.length,
    rootTests: expected.artifact.evidence.rootTests.length,
    typeNegativeCases:
      expected.artifact.evidence.typeNegativeCases.tokens.length +
      expected.artifact.evidence.typeNegativeCases.fixtures.length,
    trackedFiles: expected.artifact.evidence.trackedFiles.length,
  });
}

/** Writes deterministic M03-T07 evidence through the shared atomic proof writer. */
export async function writeReferenceTokensAndSyntheticFixturesEvidence(options = undefined) {
  const normalized = normalizeOptions(
    options,
    ["artifactPath", "beforeAtomicRename", "buildOptions"],
    "Write",
  );
  const artifactPath =
    normalized.artifactPath ?? DEFAULT_REFERENCE_TOKENS_AND_SYNTHETIC_FIXTURES_ARTIFACT_PATH;
  assertCondition(
    typeof artifactPath === "string" && artifactPath.length > 0,
    "TOKEN_FIXTURE_OPTIONS_INVALID",
    "Write artifactPath must be a non-empty path string.",
  );
  if (Object.hasOwn(normalized, "beforeAtomicRename")) {
    assertCondition(
      typeof normalized.beforeAtomicRename === "function",
      "TOKEN_FIXTURE_OPTIONS_INVALID",
      "Write beforeAtomicRename must be a function.",
    );
  }
  if (Object.hasOwn(normalized, "buildOptions")) {
    assertCondition(
      normalized.buildOptions !== null &&
        typeof normalized.buildOptions === "object" &&
        !Array.isArray(normalized.buildOptions),
      "TOKEN_FIXTURE_OPTIONS_INVALID",
      "Write buildOptions must be a record.",
    );
  }
  const tracked = await targetsTrackedArtifact(artifactPath);
  if (tracked) {
    assertCanonicalTrackedSpelling(artifactPath);
    assertCondition(
      !Object.hasOwn(normalized, "beforeAtomicRename") &&
        !Object.hasOwn(normalized, "buildOptions"),
      "TOKEN_FIXTURE_NONDEFAULT_TRACKED_WRITE",
      "The tracked M03-T07 artifact can only be generated from fixed defaults.",
    );
  }
  const result = await buildReferenceTokensAndSyntheticFixturesEvidence(normalized.buildOptions);
  if (tracked) {
    assertCondition(
      result.artifact.evidence.provenance.mode === "tracked-defaults" &&
        result.artifact.prerequisite.result === "PASS",
      "TOKEN_FIXTURE_NONDEFAULT_TRACKED_WRITE",
      "Tracked generation lost fixed provenance or its M03-T06 prerequisite.",
    );
  }
  try {
    await writeAtomicProofArtifact({
      artifactPath,
      artifactBytes: result.artifactBytes,
      beforeAtomicRename: normalized.beforeAtomicRename,
    });
  } catch (error) {
    fail(
      "TOKEN_FIXTURE_ARTIFACT_WRITE_FAILED",
      "The M03-T07 artifact could not be written safely.",
      { cause: error instanceof Error ? error.message : String(error) },
    );
  }
  return result;
}
