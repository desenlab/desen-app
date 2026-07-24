import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { format } from "prettier";
import ts from "typescript";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");

/** Exact classification assigned to the supported reference-token surface. */
export const SC01_DTCG_PROFILE_CLASSIFICATION = "DTCG_2025_10_COMPATIBLE_CLOSED_REFERENCE_PROFILE";

/** Expected outcome label for reviewed fixtures outside the closed reference profile. */
export const SC01_UNSUPPORTED_DTCG_CLASSIFICATION = "UNSUPPORTED_DTCG_FEATURE";

/** Expected outcome label for the reviewed negative fixture matrix. */
export const SC01_INVALID_DTCG_CLASSIFICATION = "INVALID_DTCG";

/** Absolute path to the deterministic SC-01 DTCG compatibility artifact. */
export const DEFAULT_SC01_DTCG_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/artifacts/sc-01-dtcg-compatibility.json",
);

const DEFAULT_PATHS = Object.freeze({
  tokenConsumerPath: path.join(
    WORKSPACE_ROOT,
    "packages/reference-catalog-web/test/tokens-consumer.mjs",
  ),
  builtTokenEntryPath: path.join(
    WORKSPACE_ROOT,
    "packages/reference-catalog-web/dist/tokens/index.js",
  ),
  builtTokenDocumentPath: path.join(
    WORKSPACE_ROOT,
    "packages/reference-catalog-web/dist/tokens/reference-token-document.js",
  ),
  builtTokenProviderPath: path.join(
    WORKSPACE_ROOT,
    "packages/reference-catalog-web/dist/tokens/web-token-provider.js",
  ),
  referencePackagePath: path.join(WORKSPACE_ROOT, "packages/reference-catalog-web/package.json"),
  tokenSourcePath: path.join(
    WORKSPACE_ROOT,
    "packages/reference-catalog-web/src/tokens/reference-token-document.ts",
  ),
  tokenIndexSourcePath: path.join(
    WORKSPACE_ROOT,
    "packages/reference-catalog-web/src/tokens/index.ts",
  ),
  providerSourcePath: path.join(
    WORKSPACE_ROOT,
    "packages/reference-catalog-web/src/tokens/web-token-provider.ts",
  ),
  frozenSpecPath: path.join(WORKSPACE_ROOT, "packages/protocol/upstream/0.1.0/snapshot/SPEC.md"),
});

const BUILD_OPTION_NAMES = Object.freeze(["tokenDocument", ...Object.keys(DEFAULT_PATHS)]);
const FORMAT_REPORT_URL =
  "https://www.w3.org/community/reports/design-tokens/CG-FINAL-format-20251028/";
const COLOR_REPORT_URL =
  "https://www.w3.org/community/reports/design-tokens/CG-FINAL-color-20251028/";
const RESOLVER_REPORT_URL =
  "https://www.w3.org/community/reports/design-tokens/CG-FINAL-resolver-20251028/";
const PUBLICATION_COMMIT = "f0f32a7dce0b51b36488be9cbbf7cad2763c6f29";
const PUBLICATION_COMMIT_URL = `https://github.com/design-tokens/community-group/commit/${PUBLICATION_COMMIT}`;
const EXACT_TOKEN_CONSUMER_BYTES = Buffer.from(
  'export * from "@desen/reference-catalog-web/tokens";\n',
);
const RESOLVER_VERSION_INCONSISTENCY = Object.freeze({
  id: "DTCG_RESOLVER_2025_10_VERSION_CONFLICT",
  report: RESOLVER_REPORT_URL,
  rootPropertyTableValue: "2025-10-01",
  normativeSection: "4.1.2 Version",
  normativeMustValue: "2025-11-01",
  selectedFixtureInterpretation: "2025-11-01",
  note: "The immutable report conflicts internally. The executable fixture follows the normative MUST paragraph in section 4.1.2; no general Resolver conformance is claimed.",
});
const WHOLE_TOKEN_ALIAS = /^\{[^.{}]+(?:\.[^.{}]+)*\}$/u;
const LOCAL_WHOLE_TOKEN_ALIAS = /^\{[^.{}]+(?:\.[^.{}]+)+\}$/u;
const HEX_COLOR = /^#[0-9a-f]{6}$/u;
const MAX_JSON_DEPTH = 64;
const MAX_JSON_NODES = 10_000;

const DTCG_TYPES = new Set([
  "border",
  "color",
  "cubicBezier",
  "dimension",
  "duration",
  "fontFamily",
  "fontWeight",
  "gradient",
  "number",
  "shadow",
  "strokeStyle",
  "transition",
  "typography",
]);

const DTCG_COLOR_SPACES = new Set([
  "a98-rgb",
  "display-p3",
  "hsl",
  "hwb",
  "lab",
  "lch",
  "oklab",
  "oklch",
  "prophoto-rgb",
  "rec2020",
  "srgb",
  "srgb-linear",
  "xyz-d50",
  "xyz-d65",
]);

const BASE_BLACK = Object.freeze({
  colorSpace: "srgb",
  components: Object.freeze([0, 0, 0]),
  alpha: 1,
  hex: "#000000",
});

const clone = (value) => JSON.parse(JSON.stringify(value));

const UNSUPPORTED_FIXTURE_GROUPS = Object.freeze([
  Object.freeze({
    id: "ROOT_TOKEN_CURLY_ALIAS",
    feature: "A root token alias such as {primary}",
    examples: Object.freeze(["{primary}"]),
    fixtures: Object.freeze([
      Object.freeze({
        id: "root-token-curly-alias",
        document: Object.freeze({
          primary: Object.freeze({ $type: "color", $value: BASE_BLACK }),
          alias: Object.freeze({ $type: "color", $value: "{primary}" }),
        }),
      }),
    ]),
  }),
  Object.freeze({
    id: "ALIAS_TARGET_TYPE_INFERENCE",
    feature: "A whole-token alias that inherits its type from the target token",
    examples: Object.freeze(["alias with no own or parent $type"]),
    fixtures: Object.freeze([
      Object.freeze({
        id: "alias-infers-target-type",
        document: Object.freeze({
          palette: Object.freeze({
            primary: Object.freeze({ $type: "color", $value: BASE_BLACK }),
          }),
          alias: Object.freeze({ $value: "{palette.primary}" }),
        }),
      }),
    ]),
  }),
  Object.freeze({
    id: "JSON_POINTER_REF",
    feature: "A whole-token JSON Pointer $ref",
    examples: Object.freeze([{ $ref: "#/primary/$value" }]),
    fixtures: Object.freeze([
      Object.freeze({
        id: "whole-token-json-pointer",
        document: Object.freeze({
          primary: Object.freeze({ $type: "color", $value: BASE_BLACK }),
          alias: Object.freeze({
            $type: "color",
            $ref: "#/primary/$value",
          }),
        }),
      }),
    ]),
  }),
  Object.freeze({
    id: "PROPERTY_LEVEL_REF",
    feature: "A property-level JSON Pointer reference",
    examples: Object.freeze(["#/base/$value/components/0"]),
    fixtures: Object.freeze([
      Object.freeze({
        id: "color-component-json-pointer",
        document: Object.freeze({
          base: Object.freeze({ $type: "color", $value: BASE_BLACK }),
          derived: Object.freeze({
            $type: "color",
            $value: Object.freeze({
              colorSpace: "srgb",
              components: Object.freeze([
                Object.freeze({ $ref: "#/base/$value/components/0" }),
                0,
                0,
              ]),
              alpha: 1,
              hex: "#000000",
            }),
          }),
        }),
      }),
    ]),
  }),
  Object.freeze({
    id: "ROOT_GROUP_TOKEN",
    feature: "The $root token member of a group",
    examples: Object.freeze(["$root"]),
    fixtures: Object.freeze([
      Object.freeze({
        id: "group-root-token",
        document: Object.freeze({
          semantic: Object.freeze({
            $type: "color",
            $root: Object.freeze({ $value: BASE_BLACK }),
            accent: Object.freeze({ $value: BASE_BLACK }),
          }),
        }),
      }),
    ]),
  }),
  Object.freeze({
    id: "GROUP_EXTENDS",
    feature: "Group inheritance through $extends",
    examples: Object.freeze(["$extends"]),
    fixtures: Object.freeze([
      Object.freeze({
        id: "group-extends",
        document: Object.freeze({
          base: Object.freeze({
            $type: "color",
            accent: Object.freeze({ $value: BASE_BLACK }),
          }),
          derived: Object.freeze({
            $type: "color",
            $extends: "{base}",
            accent: Object.freeze({ $value: BASE_BLACK }),
          }),
        }),
      }),
    ]),
  }),
  Object.freeze({
    id: "EMPTY_GROUP",
    feature: "An empty DTCG group",
    examples: Object.freeze(["empty group"]),
    fixtures: Object.freeze([
      Object.freeze({
        id: "empty-described-group",
        document: Object.freeze({
          empty: Object.freeze({ $description: "A valid empty DTCG group." }),
        }),
      }),
    ]),
  }),
  Object.freeze({
    id: "EXTENSIONS",
    feature: "Vendor metadata carried in $extensions",
    examples: Object.freeze(["$extensions"]),
    fixtures: Object.freeze([
      Object.freeze({
        id: "token-vendor-extension",
        document: Object.freeze({
          primary: Object.freeze({
            $type: "color",
            $value: BASE_BLACK,
            $extensions: Object.freeze({
              "example.com": Object.freeze({ source: "fixture" }),
            }),
          }),
        }),
      }),
    ]),
  }),
  Object.freeze({
    id: "DEPRECATED",
    feature: "Token or group deprecation metadata",
    examples: Object.freeze(["$deprecated"]),
    fixtures: Object.freeze([
      Object.freeze({
        id: "deprecated-token",
        document: Object.freeze({
          legacy: Object.freeze({
            $type: "color",
            $value: BASE_BLACK,
            $deprecated: "Use primary.",
          }),
        }),
      }),
    ]),
  }),
  Object.freeze({
    id: "ADDITIONAL_TOKEN_TYPES",
    feature: "DTCG token types outside color and dimension",
    examples: Object.freeze(["number", "typography"]),
    fixtures: Object.freeze([
      Object.freeze({
        id: "number-token",
        document: Object.freeze({
          opacity: Object.freeze({ $type: "number", $value: 0.5 }),
        }),
      }),
      Object.freeze({
        id: "typography-token",
        document: Object.freeze({
          body: Object.freeze({
            $type: "typography",
            $value: Object.freeze({
              fontFamily: "Inter",
              fontSize: Object.freeze({ value: 1, unit: "rem" }),
              fontWeight: 400,
              letterSpacing: Object.freeze({ value: 0, unit: "px" }),
              lineHeight: 1.5,
            }),
          }),
        }),
      }),
    ]),
  }),
  Object.freeze({
    id: "ADDITIONAL_COLOR_SPACES",
    feature: "DTCG color spaces outside sRGB",
    examples: Object.freeze(["display-p3", "oklch"]),
    fixtures: Object.freeze([
      Object.freeze({
        id: "display-p3-color",
        document: Object.freeze({
          accent: Object.freeze({
            $type: "color",
            $value: Object.freeze({
              colorSpace: "display-p3",
              components: Object.freeze([0.1, 0.2, 0.3]),
              alpha: 1,
            }),
          }),
        }),
      }),
      Object.freeze({
        id: "oklch-color",
        document: Object.freeze({
          accent: Object.freeze({
            $type: "color",
            $value: Object.freeze({
              colorSpace: "oklch",
              components: Object.freeze([0.5, 0.2, 180]),
              alpha: 1,
            }),
          }),
        }),
      }),
    ]),
  }),
  Object.freeze({
    id: "NONE_COLOR_COMPONENTS",
    feature: "A DTCG color using none for an intentionally missing component",
    examples: Object.freeze(["none"]),
    fixtures: Object.freeze([
      Object.freeze({
        id: "srgb-none-component",
        document: Object.freeze({
          accent: Object.freeze({
            $type: "color",
            $value: Object.freeze({
              colorSpace: "srgb",
              components: Object.freeze(["none", 0.2, 0.3]),
              alpha: 1,
            }),
          }),
        }),
      }),
    ]),
  }),
  Object.freeze({
    id: "OPTIONAL_COLOR_ALPHA_AND_HEX",
    feature: "A valid DTCG sRGB color without the locally required alpha and hex members",
    examples: Object.freeze(["color without alpha", "color without hex"]),
    fixtures: Object.freeze([
      Object.freeze({
        id: "color-without-local-alpha-and-hex",
        document: Object.freeze({
          accent: Object.freeze({
            $type: "color",
            $value: Object.freeze({
              colorSpace: "srgb",
              components: Object.freeze([0.1, 0.2, 0.3]),
            }),
          }),
        }),
      }),
    ]),
  }),
  Object.freeze({
    id: "RESOLVER_THEMES_AND_MODES",
    feature: "DTCG Resolver sets, modifiers, contexts, and resolution order",
    examples: Object.freeze(["theme", "mode"]),
    upstreamInconsistency: RESOLVER_VERSION_INCONSISTENCY,
    fixtures: Object.freeze([
      Object.freeze({
        id: "resolver-theme-modifier",
        document: Object.freeze({
          version: "2025-11-01",
          modifiers: Object.freeze({
            theme: Object.freeze({
              contexts: Object.freeze({
                light: Object.freeze([
                  Object.freeze({
                    color: Object.freeze({
                      background: Object.freeze({ $type: "color", $value: BASE_BLACK }),
                    }),
                  }),
                ]),
                dark: Object.freeze([
                  Object.freeze({
                    color: Object.freeze({
                      background: Object.freeze({ $type: "color", $value: BASE_BLACK }),
                    }),
                  }),
                ]),
              }),
              default: "light",
            }),
          }),
          resolutionOrder: Object.freeze([Object.freeze({ $ref: "#/modifiers/theme" })]),
        }),
      }),
    ]),
  }),
]);

const INVALID_FIXTURES = Object.freeze([
  Object.freeze({
    id: "name-containing-dot",
    document: Object.freeze({
      "bad.name": Object.freeze({ $type: "color", $value: BASE_BLACK }),
    }),
  }),
  Object.freeze({
    id: "malformed-dimension-value",
    document: Object.freeze({
      space: Object.freeze({
        $type: "dimension",
        sm: Object.freeze({
          $value: Object.freeze({ value: "1", unit: "rem" }),
        }),
      }),
    }),
  }),
  Object.freeze({
    id: "alias-cycle",
    document: Object.freeze({
      color: Object.freeze({
        $type: "color",
        a: Object.freeze({ $value: "{color.b}" }),
        b: Object.freeze({ $value: "{color.a}" }),
      }),
    }),
  }),
  Object.freeze({
    id: "malformed-json-pointer",
    document: Object.freeze({
      primary: Object.freeze({ $type: "color", $value: BASE_BLACK }),
      alias: Object.freeze({ $type: "color", $ref: "primary/$value" }),
    }),
  }),
  Object.freeze({
    id: "missing-json-pointer-target",
    document: Object.freeze({
      alias: Object.freeze({ $type: "color", $ref: "#/missing/$value" }),
    }),
  }),
  Object.freeze({
    id: "misplaced-json-pointer-under-value",
    document: Object.freeze({
      primary: Object.freeze({ $type: "color", $value: BASE_BLACK }),
      alias: Object.freeze({
        $type: "color",
        $value: Object.freeze({ $ref: "#/primary/$value" }),
      }),
    }),
  }),
  Object.freeze({
    id: "malformed-resolver-required-fields",
    document: Object.freeze({
      version: "bogus",
      modifiers: Object.freeze({ theme: Object.freeze({}) }),
      resolutionOrder: Object.freeze([]),
    }),
  }),
]);

/**
 * Stable error emitted when SC-01 evidence cannot be built or verified.
 */
export class Sc01DtcgAuditError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "Sc01DtcgAuditError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new Sc01DtcgAuditError(code, message, details);
}

function assertCondition(condition, code, message, details = undefined) {
  if (!condition) fail(code, message, details);
}

function sha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function sorted(values) {
  return [...values].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stableJsonValue(value) {
  if (Array.isArray(value)) return value.map(stableJsonValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    sorted(Object.keys(value)).map((key) => [key, stableJsonValue(value[key])]),
  );
}

function canonicalJsonBytes(value) {
  return Buffer.from(JSON.stringify(stableJsonValue(value)));
}

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

function isDeeplyFrozen(value, active = new Set()) {
  if (value === null || typeof value !== "object") return true;
  if (active.has(value) || !Object.isFrozen(value)) return false;
  active.add(value);
  const result = Object.values(value).every((nested) => isDeeplyFrozen(nested, active));
  active.delete(value);
  return result;
}

function normalizeOptions(options, allowedNames, operation) {
  if (options === undefined) return Object.freeze({});
  assertCondition(
    isRecord(options) &&
      (Object.getPrototypeOf(options) === Object.prototype ||
        Object.getPrototypeOf(options) === null) &&
      Object.getOwnPropertySymbols(options).length === 0,
    "SC01_DTCG_OPTIONS_INVALID",
    `${operation} options must be a plain string-keyed record.`,
  );
  const descriptors = Object.getOwnPropertyDescriptors(options);
  const output = Object.create(null);
  for (const name of sorted(Object.keys(descriptors))) {
    const descriptor = descriptors[name];
    assertCondition(
      Object.hasOwn(descriptor, "value") && allowedNames.includes(name),
      "SC01_DTCG_OPTIONS_INVALID",
      `${operation} option ${JSON.stringify(name)} is unknown or accessor-backed.`,
    );
    output[name] = descriptor.value;
  }
  return Object.freeze(output);
}

function assertJsonData(value, pathLabel = "/", state = undefined, depth = 0) {
  const traversal = state ?? {
    active: new Set(),
    nodes: 0,
  };
  traversal.nodes += 1;
  assertCondition(
    traversal.nodes <= MAX_JSON_NODES && depth <= MAX_JSON_DEPTH,
    SC01_INVALID_DTCG_CLASSIFICATION,
    `DTCG fixture exceeds the bounded JSON audit at ${pathLabel}.`,
  );

  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    assertCondition(
      Number.isFinite(value),
      SC01_INVALID_DTCG_CLASSIFICATION,
      `DTCG numbers must be finite at ${pathLabel}.`,
    );
    return;
  }
  assertCondition(
    typeof value === "object",
    SC01_INVALID_DTCG_CLASSIFICATION,
    `DTCG data must be JSON-compatible at ${pathLabel}.`,
  );
  const prototype = Object.getPrototypeOf(value);
  assertCondition(
    Array.isArray(value) || prototype === Object.prototype || prototype === null,
    SC01_INVALID_DTCG_CLASSIFICATION,
    `DTCG data must use arrays or plain records at ${pathLabel}.`,
  );
  assertCondition(
    !traversal.active.has(value) && Object.getOwnPropertySymbols(value).length === 0,
    SC01_INVALID_DTCG_CLASSIFICATION,
    `DTCG data must be acyclic and string-keyed at ${pathLabel}.`,
  );
  traversal.active.add(value);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const key of sorted(Object.keys(descriptors))) {
    const descriptor = descriptors[key];
    assertCondition(
      Object.hasOwn(descriptor, "value") && descriptor.value !== undefined,
      SC01_INVALID_DTCG_CLASSIFICATION,
      `DTCG data cannot contain accessors or undefined at ${pathLabel}.`,
    );
    assertJsonData(descriptor.value, `${pathLabel}/${key}`, traversal, depth + 1);
  }
  traversal.active.delete(value);
}

function assertName(name, pathLabel) {
  assertCondition(
    name.length > 0 && !name.startsWith("$") && !/[.{}]/u.test(name),
    SC01_INVALID_DTCG_CLASSIFICATION,
    `Invalid DTCG token or group name ${JSON.stringify(name)} at ${pathLabel}.`,
  );
}

function assertDescription(value, pathLabel) {
  assertCondition(
    value === undefined || typeof value === "string",
    SC01_INVALID_DTCG_CLASSIFICATION,
    `$description must be a string at ${pathLabel}.`,
  );
}

function recordUnsupported(state, id, pathLabel) {
  if (!state.unsupported.some((entry) => entry.id === id && entry.path === pathLabel)) {
    state.unsupported.push(Object.freeze({ id, path: pathLabel }));
  }
}

function inspectExtension(value, pathLabel, state) {
  assertCondition(
    isRecord(value),
    SC01_INVALID_DTCG_CLASSIFICATION,
    `$extensions must be an object at ${pathLabel}.`,
  );
  recordUnsupported(state, "EXTENSIONS", pathLabel);
}

function inspectDeprecated(value, pathLabel, state) {
  assertCondition(
    typeof value === "boolean" || typeof value === "string",
    SC01_INVALID_DTCG_CLASSIFICATION,
    `$deprecated must be a boolean or string at ${pathLabel}.`,
  );
  recordUnsupported(state, "DEPRECATED", pathLabel);
}

function inspectType(value, pathLabel, state) {
  if (value === undefined) return undefined;
  assertCondition(
    typeof value === "string" && DTCG_TYPES.has(value),
    SC01_INVALID_DTCG_CLASSIFICATION,
    `Unknown DTCG $type at ${pathLabel}.`,
  );
  if (value !== "color" && value !== "dimension") {
    recordUnsupported(state, "ADDITIONAL_TOKEN_TYPES", pathLabel);
  }
  return value;
}

function resolveSameDocumentPointer(document, reference, pathLabel) {
  let pointer;
  try {
    pointer = decodeURIComponent(reference.slice(1));
  } catch {
    fail(SC01_INVALID_DTCG_CLASSIFICATION, `$ref contains invalid URI escaping at ${pathLabel}.`);
  }
  assertCondition(
    !/~(?:[^01]|$)/u.test(pointer),
    SC01_INVALID_DTCG_CLASSIFICATION,
    `$ref contains invalid JSON Pointer escaping at ${pathLabel}.`,
  );
  let target = document;
  for (const encodedSegment of pointer.slice(1).split("/")) {
    const segment = encodedSegment.replaceAll("~1", "/").replaceAll("~0", "~");
    assertCondition(
      (isRecord(target) || Array.isArray(target)) && Object.hasOwn(target, segment),
      SC01_INVALID_DTCG_CLASSIFICATION,
      `$ref target ${reference} does not exist at ${pathLabel}.`,
    );
    target = target[segment];
  }
  return target;
}

function inspectReferenceObject(value, pathLabel, state, featureId) {
  assertCondition(
    isRecord(value) &&
      typeof value.$ref === "string" &&
      /^#(?:\/(?:[^~]|~[01])*)+$/u.test(value.$ref) &&
      Object.keys(value).length >= 1,
    SC01_INVALID_DTCG_CLASSIFICATION,
    `$ref must be a valid same-document JSON Pointer at ${pathLabel}.`,
  );
  resolveSameDocumentPointer(state.document, value.$ref, pathLabel);
  recordUnsupported(state, featureId, pathLabel);
}

function inspectColor(value, pathLabel, state) {
  assertCondition(
    isRecord(value) &&
      typeof value.colorSpace === "string" &&
      DTCG_COLOR_SPACES.has(value.colorSpace) &&
      Array.isArray(value.components),
    SC01_INVALID_DTCG_CLASSIFICATION,
    `Color values require a known colorSpace and components array at ${pathLabel}.`,
  );

  const propertyReference = value.components.find(
    (component) => isRecord(component) && Object.hasOwn(component, "$ref"),
  );
  if (propertyReference !== undefined) {
    inspectReferenceObject(
      propertyReference,
      `${pathLabel}/components`,
      state,
      "PROPERTY_LEVEL_REF",
    );
    return Object.freeze({ direct: true, colorSpace: value.colorSpace });
  }

  const hasNoneComponent = value.components.includes("none");
  if (hasNoneComponent) {
    assertCondition(
      value.components.length === 3 &&
        value.components.every(
          (component) =>
            component === "none" || (typeof component === "number" && Number.isFinite(component)),
        ),
      SC01_INVALID_DTCG_CLASSIFICATION,
      `DTCG none components must otherwise contain finite numbers at ${pathLabel}.`,
    );
    if (value.colorSpace === "srgb") {
      assertCondition(
        value.components.every(
          (component) => component === "none" || (component >= 0 && component <= 1),
        ),
        SC01_INVALID_DTCG_CLASSIFICATION,
        `Numeric sRGB components must be between zero and one at ${pathLabel}.`,
      );
    }
    if (value.alpha !== undefined) {
      assertCondition(
        typeof value.alpha === "number" &&
          Number.isFinite(value.alpha) &&
          value.alpha >= 0 &&
          value.alpha <= 1,
        SC01_INVALID_DTCG_CLASSIFICATION,
        `Color alpha must be between zero and one at ${pathLabel}.`,
      );
    }
    recordUnsupported(state, "NONE_COLOR_COMPONENTS", pathLabel);
    return Object.freeze({ direct: true, colorSpace: value.colorSpace });
  }

  assertCondition(
    value.components.length === 3 &&
      value.components.every(
        (component) => typeof component === "number" && Number.isFinite(component),
      ),
    SC01_INVALID_DTCG_CLASSIFICATION,
    `The audited color fixtures require three finite components at ${pathLabel}.`,
  );
  if (value.alpha !== undefined) {
    assertCondition(
      typeof value.alpha === "number" &&
        Number.isFinite(value.alpha) &&
        value.alpha >= 0 &&
        value.alpha <= 1,
      SC01_INVALID_DTCG_CLASSIFICATION,
      `Color alpha must be between zero and one at ${pathLabel}.`,
    );
  }

  if (value.colorSpace !== "srgb") {
    recordUnsupported(state, "ADDITIONAL_COLOR_SPACES", pathLabel);
    return Object.freeze({ direct: true, colorSpace: value.colorSpace });
  }
  assertCondition(
    value.components.every((component) => component >= 0 && component <= 1),
    SC01_INVALID_DTCG_CLASSIFICATION,
    `sRGB components must be between zero and one at ${pathLabel}.`,
  );

  if (value.alpha === undefined || value.hex === undefined) {
    recordUnsupported(state, "OPTIONAL_COLOR_ALPHA_AND_HEX", pathLabel);
    return Object.freeze({ direct: true, colorSpace: "srgb" });
  }
  assertCondition(
    typeof value.hex === "string" && HEX_COLOR.test(value.hex),
    SC01_INVALID_DTCG_CLASSIFICATION,
    `The closed profile requires lowercase six-digit hex at ${pathLabel}.`,
  );
  const expectedHex = `#${value.components
    .map((component) =>
      Math.round(component * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
  assertCondition(
    value.hex === expectedHex,
    SC01_INVALID_DTCG_CLASSIFICATION,
    `The local hex fallback must match the sRGB components at ${pathLabel}.`,
  );
  const keys = sorted(Object.keys(value));
  assertCondition(
    keys.length === 4 &&
      ["alpha", "colorSpace", "components", "hex"].every((key) => keys.includes(key)),
    SC01_INVALID_DTCG_CLASSIFICATION,
    `The closed sRGB profile has an exact four-member value at ${pathLabel}.`,
  );
  return Object.freeze({ direct: true, colorSpace: "srgb" });
}

function inspectDimension(value, pathLabel) {
  assertCondition(
    isRecord(value) &&
      sorted(Object.keys(value)).join(",") === "unit,value" &&
      typeof value.value === "number" &&
      Number.isFinite(value.value) &&
      (value.unit === "px" || value.unit === "rem"),
    SC01_INVALID_DTCG_CLASSIFICATION,
    `Dimension values require a finite value and px or rem unit at ${pathLabel}.`,
  );
  return Object.freeze({ direct: true, unit: value.unit });
}

function inspectAdditionalType(value, type, pathLabel) {
  if (type === "number") {
    assertCondition(
      typeof value === "number" && Number.isFinite(value),
      SC01_INVALID_DTCG_CLASSIFICATION,
      `Number tokens require a finite number at ${pathLabel}.`,
    );
  } else {
    assertCondition(
      value !== undefined,
      SC01_INVALID_DTCG_CLASSIFICATION,
      `Token values cannot be undefined at ${pathLabel}.`,
    );
  }
  return Object.freeze({ direct: true });
}

function inspectToken(node, pathParts, inheritedType, state) {
  const pathLabel = pathParts.join(".");
  const allowed = new Set([
    "$deprecated",
    "$description",
    "$extensions",
    "$ref",
    "$type",
    "$value",
  ]);
  for (const key of Object.keys(node)) {
    assertCondition(
      allowed.has(key),
      SC01_INVALID_DTCG_CLASSIFICATION,
      `Token ${pathLabel} contains unsupported child or metadata ${key}.`,
    );
  }
  const hasValue = Object.hasOwn(node, "$value");
  const hasReference = Object.hasOwn(node, "$ref");
  assertCondition(
    hasValue !== hasReference,
    SC01_INVALID_DTCG_CLASSIFICATION,
    `A token must contain exactly one of $value or $ref at ${pathLabel}.`,
  );
  assertDescription(node.$description, pathLabel);
  if (Object.hasOwn(node, "$extensions")) {
    inspectExtension(node.$extensions, pathLabel, state);
  }
  if (Object.hasOwn(node, "$deprecated")) {
    inspectDeprecated(node.$deprecated, pathLabel, state);
  }

  const ownType = inspectType(node.$type, pathLabel, state);
  const effectiveType = ownType ?? inheritedType;
  const hasCurlyAlias =
    hasValue && typeof node.$value === "string" && WHOLE_TOKEN_ALIAS.test(node.$value);
  if (effectiveType === undefined && hasCurlyAlias) {
    recordUnsupported(state, "ALIAS_TARGET_TYPE_INFERENCE", pathLabel);
  } else {
    assertCondition(
      effectiveType !== undefined,
      SC01_INVALID_DTCG_CLASSIFICATION,
      `Token type cannot be inferred at ${pathLabel}.`,
    );
  }
  const token = {
    path: pathLabel,
    ownType: ownType ?? null,
    type: effectiveType ?? null,
    value: hasValue ? node.$value : undefined,
    alias: null,
    direct: null,
  };

  if (hasReference) {
    inspectReferenceObject({ $ref: node.$ref }, pathLabel, state, "JSON_POINTER_REF");
  } else if (typeof node.$value === "string") {
    assertCondition(
      WHOLE_TOKEN_ALIAS.test(node.$value),
      SC01_INVALID_DTCG_CLASSIFICATION,
      `Malformed whole-token alias at ${pathLabel}.`,
    );
    token.alias = node.$value.slice(1, -1);
    if (!LOCAL_WHOLE_TOKEN_ALIAS.test(node.$value)) {
      recordUnsupported(state, "ROOT_TOKEN_CURLY_ALIAS", pathLabel);
    }
  } else if (effectiveType === "color") {
    token.direct = inspectColor(node.$value, `${pathLabel}.$value`, state);
  } else if (effectiveType === "dimension") {
    token.direct = inspectDimension(node.$value, `${pathLabel}.$value`);
  } else {
    token.direct = inspectAdditionalType(node.$value, effectiveType, `${pathLabel}.$value`);
  }

  assertCondition(
    !state.tokens.has(pathLabel),
    SC01_INVALID_DTCG_CLASSIFICATION,
    `Duplicate token path ${pathLabel}.`,
  );
  state.tokens.set(pathLabel, token);
}

function inspectExtends(value, pathLabel, state) {
  const valid =
    (typeof value === "string" && (WHOLE_TOKEN_ALIAS.test(value) || value.startsWith("#/"))) ||
    (isRecord(value) && typeof value.$ref === "string" && value.$ref.length > 0);
  assertCondition(
    valid,
    SC01_INVALID_DTCG_CLASSIFICATION,
    `$extends must contain a valid group reference at ${pathLabel}.`,
  );
  recordUnsupported(state, "GROUP_EXTENDS", pathLabel);
}

function inspectGroup(node, pathParts, inheritedType, state) {
  const pathLabel = pathParts.length === 0 ? "/" : pathParts.join(".");
  state.groupCount += 1;
  assertDescription(node.$description, pathLabel);
  if (Object.hasOwn(node, "$extensions")) {
    inspectExtension(node.$extensions, pathLabel, state);
  }
  if (Object.hasOwn(node, "$deprecated")) {
    inspectDeprecated(node.$deprecated, pathLabel, state);
  }
  if (Object.hasOwn(node, "$extends")) inspectExtends(node.$extends, pathLabel, state);
  const ownType = inspectType(node.$type, pathLabel, state);
  const effectiveType = ownType ?? inheritedType;

  for (const key of Object.keys(node).filter((entry) => entry.startsWith("$"))) {
    assertCondition(
      ["$deprecated", "$description", "$extends", "$extensions", "$root", "$type"].includes(key),
      SC01_INVALID_DTCG_CLASSIFICATION,
      `Unknown DTCG group metadata ${key} at ${pathLabel}.`,
    );
  }

  if (Object.hasOwn(node, "$root")) {
    assertCondition(
      isRecord(node.$root) && Object.hasOwn(node.$root, "$value"),
      SC01_INVALID_DTCG_CLASSIFICATION,
      `$root must be a token at ${pathLabel}.`,
    );
    inspectToken(node.$root, [...pathParts, "$root"], effectiveType, state);
    recordUnsupported(state, "ROOT_GROUP_TOKEN", pathLabel);
  }

  const childKeys = sorted(Object.keys(node).filter((entry) => !entry.startsWith("$")));
  if (childKeys.length === 0 && !Object.hasOwn(node, "$root")) {
    recordUnsupported(state, "EMPTY_GROUP", pathLabel);
  }
  for (const key of childKeys) {
    assertName(key, pathLabel);
    const child = node[key];
    assertCondition(
      isRecord(child),
      SC01_INVALID_DTCG_CLASSIFICATION,
      `DTCG groups and tokens must be objects at ${pathLabel}.${key}.`,
    );
    if (Object.hasOwn(child, "$value") || Object.hasOwn(child, "$ref"))
      inspectToken(child, [...pathParts, key], effectiveType, state);
    else inspectGroup(child, [...pathParts, key], effectiveType, state);
  }
}

function resolveAliases(state) {
  const memo = new Map();
  const resolve = (tokenPath, active) => {
    if (memo.has(tokenPath)) return memo.get(tokenPath);
    const token = state.tokens.get(tokenPath);
    assertCondition(
      token !== undefined,
      SC01_INVALID_DTCG_CLASSIFICATION,
      `Alias target ${tokenPath} does not exist.`,
    );
    assertCondition(
      !active.has(tokenPath),
      SC01_INVALID_DTCG_CLASSIFICATION,
      `Alias cycle detected at ${tokenPath}.`,
    );
    if (token.alias === null) {
      assertCondition(
        token.type !== null,
        SC01_INVALID_DTCG_CLASSIFICATION,
        `Direct token type cannot be inferred at ${tokenPath}.`,
      );
      const direct = Object.freeze({ depth: 0, type: token.type, terminal: tokenPath });
      memo.set(tokenPath, direct);
      return direct;
    }
    active.add(tokenPath);
    const target = resolve(token.alias, active);
    active.delete(tokenPath);
    assertCondition(
      token.type === null || target.type === token.type,
      SC01_INVALID_DTCG_CLASSIFICATION,
      `Alias target ${token.alias} has a different effective type at ${tokenPath}.`,
    );
    const result = Object.freeze({
      depth: target.depth + 1,
      type: token.type ?? target.type,
      terminal: target.terminal,
    });
    memo.set(tokenPath, result);
    return result;
  };

  const aliases = [];
  for (const token of state.tokens.values()) {
    if (token.alias === null) continue;
    const resolution = resolve(token.path, new Set());
    aliases.push(
      Object.freeze({
        path: token.path,
        reference: `{${token.alias}}`,
        target: token.alias,
        terminal: resolution.terminal,
        chainDepth: resolution.depth,
        effectiveType: resolution.type,
      }),
    );
  }
  return Object.freeze(
    sorted(aliases.map((entry) => entry.path)).map((tokenPath) =>
      aliases.find((entry) => entry.path === tokenPath),
    ),
  );
}

function looksLikeResolverDocument(document) {
  return (
    isRecord(document) &&
    typeof document.version === "string" &&
    Array.isArray(document.resolutionOrder) &&
    (isRecord(document.sets) || isRecord(document.modifiers))
  );
}

function validateResolverDocument(document) {
  assertCondition(
    document.version === "2025-10-01" || document.version === "2025-11-01",
    SC01_INVALID_DTCG_CLASSIFICATION,
    "The DTCG Resolver version must match one of the two values printed by the immutable 2025.10 report.",
  );
  if (Object.hasOwn(document, "modifiers")) {
    for (const [name, modifier] of Object.entries(document.modifiers)) {
      assertCondition(
        name.length > 0 &&
          isRecord(modifier) &&
          isRecord(modifier.contexts) &&
          Object.keys(modifier.contexts).length > 0 &&
          Object.values(modifier.contexts).every(Array.isArray),
        SC01_INVALID_DTCG_CLASSIFICATION,
        `Resolver modifier ${JSON.stringify(name)} must define a non-empty contexts map.`,
      );
      if (Object.hasOwn(modifier, "default")) {
        assertCondition(
          typeof modifier.default === "string" &&
            Object.hasOwn(modifier.contexts, modifier.default),
          SC01_INVALID_DTCG_CLASSIFICATION,
          `Resolver modifier ${JSON.stringify(name)} has an invalid default context.`,
        );
      }
    }
  }
  for (const [index, entry] of document.resolutionOrder.entries()) {
    assertCondition(
      isRecord(entry) &&
        typeof entry.$ref === "string" &&
        /^#(?:\/(?:[^~]|~[01])*)+$/u.test(entry.$ref),
      SC01_INVALID_DTCG_CLASSIFICATION,
      `Resolver resolutionOrder entry ${index} must be a same-document $ref in this audit fixture.`,
    );
    resolveSameDocumentPointer(document, entry.$ref, `/resolutionOrder/${index}`);
  }
}

/**
 * Evaluates the current closed profile or one explicitly reviewed SC-01 fixture.
 *
 * @remarks This test helper is not a general DTCG validator. Outcomes for arbitrary inputs outside
 * the built reference document and the exact embedded fixture matrix carry no DTCG conformance or
 * validity meaning.
 */
export function evaluateSc01DtcgFixture(document) {
  try {
    assertJsonData(document);
    assertCondition(
      isRecord(document),
      SC01_INVALID_DTCG_CLASSIFICATION,
      "A DTCG token document must be an object.",
    );
    if (looksLikeResolverDocument(document)) {
      validateResolverDocument(document);
      fail(
        SC01_UNSUPPORTED_DTCG_CLASSIFICATION,
        "DTCG Resolver sets, modifiers, contexts, and resolution order are outside the closed reference profile.",
        { featureId: "RESOLVER_THEMES_AND_MODES", path: "/" },
      );
    }

    const state = {
      document,
      tokens: new Map(),
      groupCount: 0,
      unsupported: [],
    };
    inspectGroup(document, [], undefined, state);
    const aliases = resolveAliases(state);
    if (state.unsupported.length > 0) {
      const first = state.unsupported[0];
      fail(
        SC01_UNSUPPORTED_DTCG_CLASSIFICATION,
        `Reviewed DTCG fixture feature ${first.id} is outside the closed reference profile.`,
        { featureId: first.id, path: first.path },
      );
    }

    const tokens = [...state.tokens.values()];
    const directColors = tokens.filter((token) => token.type === "color" && token.alias === null);
    const directDimensions = tokens.filter(
      (token) => token.type === "dimension" && token.alias === null,
    );
    const effectiveTypes = sorted(new Set(tokens.map((token) => token.type)));
    const observedUnits = sorted(
      new Set(
        directDimensions.map((token) => token.direct?.unit).filter((unit) => unit !== undefined),
      ),
    );
    const observedColorSpaces = sorted(
      new Set(
        directColors
          .map((token) => token.direct?.colorSpace)
          .filter((colorSpace) => colorSpace !== undefined),
      ),
    );

    return deepFreeze({
      classification: SC01_DTCG_PROFILE_CLASSIFICATION,
      leafCount: tokens.length,
      groupCount: state.groupCount,
      tokenPaths: sorted(tokens.map((token) => token.path)),
      effectiveTypes,
      typeCounts: Object.fromEntries(
        effectiveTypes.map((type) => [type, tokens.filter((token) => token.type === type).length]),
      ),
      typeInheritance: {
        inherited: tokens.filter((token) => token.ownType === null).length,
        explicitOnToken: tokens.filter((token) => token.ownType !== null).length,
      },
      colorProfile: {
        directValues: directColors.length,
        observedColorSpaces,
        acceptedColorSpaces: ["srgb"],
        alphaRequiredLocally: true,
        lowercaseSixDigitHexRequiredLocally: true,
        hexMustMatchRoundedSrgbComponents: true,
      },
      dimensionProfile: {
        directValues: directDimensions.length,
        acceptedUnits: ["px", "rem"],
        observedUnits,
      },
      aliases: {
        count: aliases.length,
        syntax: "whole-token curly alias",
        sameDocumentOnly: true,
        chainResolutionAudited: true,
        cycleFree: true,
        maximumObservedChainDepth:
          aliases.length === 0 ? 0 : Math.max(...aliases.map((entry) => entry.chainDepth)),
        entries: aliases,
      },
    });
  } catch (error) {
    if (
      error instanceof Sc01DtcgAuditError &&
      (error.code === SC01_UNSUPPORTED_DTCG_CLASSIFICATION ||
        error.code === SC01_INVALID_DTCG_CLASSIFICATION)
    ) {
      return deepFreeze({
        classification: error.code,
        featureId: error.details?.featureId ?? null,
        path: error.details?.path ?? null,
        message: error.message,
      });
    }
    throw error;
  }
}

function buildUnsupportedMatrix() {
  return UNSUPPORTED_FIXTURE_GROUPS.map((group) => {
    const fixtureResults = group.fixtures.map((fixture) => {
      const document = stableJsonValue(clone(fixture.document));
      const outcome = evaluateSc01DtcgFixture(document);
      assertCondition(
        outcome.classification === SC01_UNSUPPORTED_DTCG_CLASSIFICATION &&
          outcome.featureId === group.id,
        "SC01_DTCG_MATRIX_DRIFT",
        `Unsupported fixture ${fixture.id} did not retain its exact classification.`,
        { expectedFeatureId: group.id, outcome },
      );
      return Object.freeze({
        id: fixture.id,
        classification: outcome.classification,
        featureId: outcome.featureId,
        canonicalJsonSha256: sha256(canonicalJsonBytes(document)),
        document,
      });
    });
    return Object.freeze({
      id: group.id,
      dtcgStatus: "VALID_DTCG_2025_10",
      localStatus: "UNSUPPORTED",
      classification: SC01_UNSUPPORTED_DTCG_CLASSIFICATION,
      feature: group.feature,
      examples: group.examples,
      ...(group.upstreamInconsistency === undefined
        ? {}
        : { upstreamInconsistency: group.upstreamInconsistency }),
      executableFixtures: fixtureResults,
    });
  });
}

function buildInvalidMatrix() {
  return INVALID_FIXTURES.map((fixture) => {
    const document = stableJsonValue(clone(fixture.document));
    const outcome = evaluateSc01DtcgFixture(document);
    assertCondition(
      outcome.classification === SC01_INVALID_DTCG_CLASSIFICATION,
      "SC01_DTCG_MATRIX_DRIFT",
      `Reviewed negative fixture ${fixture.id} did not retain its expected INVALID_DTCG outcome.`,
      { outcome },
    );
    return Object.freeze({
      id: fixture.id,
      classification: outcome.classification,
      canonicalJsonSha256: sha256(canonicalJsonBytes(document)),
      document,
    });
  });
}

function auditHostOwnedBoundary(executedSources, frozenSpec) {
  const requiredSpecSentence =
    "A token reference is resolved by the host's token provider. DESEN does not redefine token storage.";
  assertCondition(
    frozenSpec.includes(requiredSpecSentence),
    "SC01_DTCG_HOST_BOUNDARY_DRIFT",
    "Frozen DESEN 0.1.0 no longer states the host-owned token-storage boundary.",
  );
  const bannedProviderPatterns = Object.freeze([
    ["localStorage", /\blocalStorage\b/u],
    ["sessionStorage", /\bsessionStorage\b/u],
    ["indexedDB", /\bindexedDB\b/u],
    ["fetch", /\bfetch\s*\(/u],
    ["XMLHttpRequest", /\bXMLHttpRequest\b/u],
    ["WebSocket", /\bWebSocket\b/u],
    ["EventSource", /\bEventSource\b/u],
    ["sendBeacon", /\bsendBeacon\s*\(/u],
    ["node:fs", /["']node:fs(?:\/promises)?["']/u],
    ["node:http", /["']node:https?["']/u],
    ["node:network", /["']node:(?:dns|net|tls)["']/u],
    ["node:child_process", /["']node:child_process["']/u],
    [
      "document",
      /\b(?:globalThis\s*\.\s*)?document\s*\.\s*(?:body|createElement|documentElement|getElementById|querySelector)\b/u,
    ],
    ["window", /\bwindow\s*\.\s*(?:document|localStorage|sessionStorage|fetch|location)\b/u],
  ]);
  const findings = executedSources.flatMap(({ label, source }) =>
    bannedProviderPatterns
      .filter(([, pattern]) => pattern.test(source))
      .map(([name]) => `${label}:${name}`),
  );
  assertCondition(
    findings.length === 0,
    "SC01_DTCG_HOST_BOUNDARY_DRIFT",
    "The reference provider acquired storage, network, or global DOM ownership.",
    { findings },
  );
  return deepFreeze({
    owner: "host",
    frozenProtocol: "DESEN 0.1.0",
    protocolTokenShape: '{ "$token": "color.action.primary" }',
    protocolDefinesTokenStorage: false,
    protocolRole:
      "The host token provider resolves the opaque token name and the receiving capability schema determines the expected resolved type.",
    referenceProviderPersistence: "none",
    referenceProviderExternalLookup: "none",
    referenceProviderGlobalDomMutation: "none",
    auditedExecutedImplementations: [
      "token index TypeScript source and exact built module",
      "token document TypeScript source and exact built module",
      "token provider TypeScript source and exact built module",
    ],
    competingTokenFileFormatCreated: false,
  });
}

/**
 * Audits injected executed-source bytes against the frozen host-owned storage boundary.
 *
 * @remarks This export exists only for root mutation tests of the side-effect denylist.
 */
export function auditSc01ExecutedSourceFixture(executedSources, frozenSpec) {
  return auditHostOwnedBoundary(executedSources, frozenSpec);
}

async function readRegularFile(filePath, label) {
  const [entry, resolved] = await Promise.all([lstat(filePath), realpath(filePath)]);
  assertCondition(
    entry.isFile() && !entry.isSymbolicLink(),
    "SC01_DTCG_SOURCE_UNSAFE",
    `${label} must be a regular non-symlink file.`,
  );
  return Object.freeze({ bytes: await readFile(resolved), resolved });
}

function assertTypeScriptBuildParity(sourceFile, builtFile, label) {
  const transpiledSource = ts.transpileModule(sourceFile.bytes.toString("utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2023,
      verbatimModuleSyntax: true,
    },
  }).outputText;
  const builtWithoutSourceMap = builtFile.bytes
    .toString("utf8")
    .replace(/\/\/# sourceMappingURL=.*\n?$/u, "");
  assertCondition(
    transpiledSource === builtWithoutSourceMap,
    "SC01_DTCG_BUILT_BINDING_DRIFT",
    `${label} is stale or does not compile exactly from its tracked TypeScript source.`,
  );
}

function inspectRuntimeModuleEdges(source, label, expectedSpecifiers, exportOnly) {
  assertCondition(
    typeof source === "string" &&
      Array.isArray(expectedSpecifiers) &&
      expectedSpecifiers.every((specifier) => typeof specifier === "string"),
    "SC01_DTCG_BUILT_BINDING_DRIFT",
    `${label} module-edge audit received invalid input.`,
  );
  const syntax = ts.createSourceFile(
    `${label}.js`,
    source,
    ts.ScriptTarget.ES2023,
    true,
    ts.ScriptKind.JS,
  );
  assertCondition(
    syntax.parseDiagnostics.length === 0,
    "SC01_DTCG_BUILT_BINDING_DRIFT",
    `${label} is not parseable JavaScript.`,
  );
  if (exportOnly) {
    assertCondition(
      syntax.statements.every(
        (statement) =>
          ts.isExportDeclaration(statement) &&
          statement.moduleSpecifier !== undefined &&
          ts.isStringLiteral(statement.moduleSpecifier),
      ),
      "SC01_DTCG_BUILT_BINDING_DRIFT",
      `${label} must remain an export-only module with no executable statements.`,
    );
  }

  const specifiers = [];
  let hasDynamicImportOrRequire = false;
  const visit = (node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    }
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === "require"))
    ) {
      hasDynamicImportOrRequire = true;
    }
    ts.forEachChild(node, visit);
  };
  visit(syntax);
  const actual = sorted(specifiers);
  const expected = sorted(expectedSpecifiers);
  assertCondition(
    !hasDynamicImportOrRequire &&
      actual.length === expected.length &&
      actual.every((specifier, index) => specifier === expected[index]),
    "SC01_DTCG_BUILT_BINDING_DRIFT",
    `${label} runtime module edges changed.`,
    { expected, actual, hasDynamicImportOrRequire },
  );
  return Object.freeze(actual);
}

/**
 * Audits one injected JavaScript module against an exact runtime-edge fixture.
 *
 * @remarks This export exists only so root mutation tests can exercise the fail-closed module graph.
 */
export function auditSc01RuntimeModuleFixture({
  source,
  label = "injected-runtime-module",
  expectedSpecifiers,
  exportOnly = false,
}) {
  return inspectRuntimeModuleEdges(source, label, expectedSpecifiers, exportOnly);
}

async function auditBuiltTokenBinding({
  tokenConsumerFile,
  referencePackageFile,
  builtTokenEntryFile,
  builtTokenDocumentFile,
  builtTokenProviderFile,
  tokenIndexSourceFile,
  tokenSourceFile,
  providerSourceFile,
}) {
  assertCondition(
    tokenConsumerFile.bytes.equals(EXACT_TOKEN_CONSUMER_BYTES),
    "SC01_DTCG_BUILT_BINDING_DRIFT",
    "The token consumer shim must remain the exact one-line package self-export.",
  );

  let packageManifest;
  try {
    packageManifest = JSON.parse(referencePackageFile.bytes.toString("utf8"));
  } catch {
    fail("SC01_DTCG_BUILT_BINDING_DRIFT", "The reference package manifest must remain valid JSON.");
  }
  const tokenExport = packageManifest.exports?.["./tokens"]?.import;
  assertCondition(
    packageManifest.name === "@desen/reference-catalog-web" &&
      tokenExport === "./dist/tokens/index.js",
    "SC01_DTCG_BUILT_BINDING_DRIFT",
    "The package self-export no longer resolves ./tokens to the built token entry.",
  );
  const packageRoot = path.dirname(referencePackageFile.resolved);
  const expectedConsumer = await realpath(path.join(packageRoot, "test/tokens-consumer.mjs"));
  const resolvedExport = await realpath(path.resolve(packageRoot, tokenExport));
  assertCondition(
    tokenConsumerFile.resolved === expectedConsumer &&
      resolvedExport === builtTokenEntryFile.resolved,
    "SC01_DTCG_BUILT_BINDING_DRIFT",
    "The consumer or package export no longer resolves through the tracked built token entry.",
  );

  const builtEntryText = builtTokenEntryFile.bytes.toString("utf8");
  const exactDocumentExport =
    'export { REFERENCE_TOKEN_DOCUMENT } from "./reference-token-document.js";';
  const exactProviderExport =
    'export { REFERENCE_WEB_TOKEN_CSS_PROPERTIES, REFERENCE_WEB_TOKEN_CSS_REFERENCES, REFERENCE_WEB_TOKEN_PROVIDER, REFERENCE_WEB_TOKEN_VALUES, resolveReferenceWebToken, } from "./web-token-provider.js";';
  assertCondition(
    builtEntryText.includes(exactDocumentExport) && builtEntryText.includes(exactProviderExport),
    "SC01_DTCG_BUILT_BINDING_DRIFT",
    "The built token entry no longer has the exact document and provider module edges.",
  );
  const [resolvedBuiltDocument, resolvedBuiltProvider] = await Promise.all([
    realpath(path.join(path.dirname(builtTokenEntryFile.resolved), "reference-token-document.js")),
    realpath(path.join(path.dirname(builtTokenEntryFile.resolved), "web-token-provider.js")),
  ]);
  assertCondition(
    resolvedBuiltDocument === builtTokenDocumentFile.resolved &&
      resolvedBuiltProvider === builtTokenProviderFile.resolved,
    "SC01_DTCG_BUILT_BINDING_DRIFT",
    "A built entry document or provider target changed.",
  );
  const resolvedProviderDocument = await realpath(
    path.join(path.dirname(builtTokenProviderFile.resolved), "reference-token-document.js"),
  );
  assertCondition(
    resolvedProviderDocument === builtTokenDocumentFile.resolved,
    "SC01_DTCG_BUILT_BINDING_DRIFT",
    "The built provider no longer imports the tracked built token document.",
  );
  assertTypeScriptBuildParity(tokenIndexSourceFile, builtTokenEntryFile, "The built token index");
  assertTypeScriptBuildParity(tokenSourceFile, builtTokenDocumentFile, "The built token document");
  assertTypeScriptBuildParity(
    providerSourceFile,
    builtTokenProviderFile,
    "The built token provider",
  );
  const runtimeModuleEdges = {
    tokenIndex: inspectRuntimeModuleEdges(
      builtEntryText,
      "The built token index",
      ["./reference-token-document.js", "./web-token-provider.js"],
      true,
    ),
    tokenDocument: inspectRuntimeModuleEdges(
      builtTokenDocumentFile.bytes.toString("utf8"),
      "The built token document",
      [],
      false,
    ),
    tokenProvider: inspectRuntimeModuleEdges(
      builtTokenProviderFile.bytes.toString("utf8"),
      "The built token provider",
      ["./reference-token-document.js"],
      false,
    ),
  };

  return deepFreeze({
    consumerShim: {
      exactLine: EXACT_TOKEN_CONSUMER_BYTES.toString("utf8").trimEnd(),
      bytes: tokenConsumerFile.bytes.length,
      sha256: sha256(tokenConsumerFile.bytes),
    },
    packageSelfExport: {
      package: "@desen/reference-catalog-web",
      subpath: "./tokens",
      import: tokenExport,
      manifestSha256: sha256(referencePackageFile.bytes),
    },
    resolvedBuiltEntry: {
      path: "packages/reference-catalog-web/dist/tokens/index.js",
      bytes: builtTokenEntryFile.bytes.length,
      sha256: sha256(builtTokenEntryFile.bytes),
    },
    resolvedBuiltDocument: {
      path: "packages/reference-catalog-web/dist/tokens/reference-token-document.js",
      bytes: builtTokenDocumentFile.bytes.length,
      sha256: sha256(builtTokenDocumentFile.bytes),
    },
    resolvedBuiltProvider: {
      path: "packages/reference-catalog-web/dist/tokens/web-token-provider.js",
      bytes: builtTokenProviderFile.bytes.length,
      sha256: sha256(builtTokenProviderFile.bytes),
    },
    sourceToBuiltTranspileParity: {
      tokenIndex: true,
      tokenDocument: true,
      tokenProvider: true,
    },
    runtimeModuleEdges,
  });
}

async function loadBuiltTokenDocument(tokenConsumerPath) {
  const module = await import(
    `${pathToFileURL(tokenConsumerPath).href}?sc-01-dtcg=${Date.now()}-${Math.random()}`
  );
  assertCondition(
    Object.hasOwn(module, "REFERENCE_TOKEN_DOCUMENT"),
    "SC01_DTCG_BUILT_API_DRIFT",
    "The built token API does not expose REFERENCE_TOKEN_DOCUMENT.",
  );
  return module.REFERENCE_TOKEN_DOCUMENT;
}

function assertCurrentReferenceProfile(audit, tokenDocument) {
  assertCondition(
    audit.classification === SC01_DTCG_PROFILE_CLASSIFICATION,
    "SC01_DTCG_REFERENCE_PROFILE_DRIFT",
    "The current built token document no longer fits the closed DTCG reference profile.",
    { outcome: audit },
  );
  assertCondition(
    isDeeplyFrozen(tokenDocument),
    "SC01_DTCG_REFERENCE_PROFILE_DRIFT",
    "The current built REFERENCE_TOKEN_DOCUMENT must remain recursively frozen.",
  );
  assertCondition(
    audit.leafCount === 26 &&
      audit.typeCounts.color === 20 &&
      audit.typeCounts.dimension === 6 &&
      audit.effectiveTypes.join(",") === "color,dimension" &&
      audit.typeInheritance.inherited === 26 &&
      audit.typeInheritance.explicitOnToken === 0,
    "SC01_DTCG_REFERENCE_PROFILE_DRIFT",
    "The exact 26-leaf color/dimension inheritance profile changed.",
    { audit },
  );
  assertCondition(
    audit.colorProfile.directValues === 17 &&
      audit.colorProfile.observedColorSpaces.join(",") === "srgb" &&
      audit.dimensionProfile.directValues === 6 &&
      audit.dimensionProfile.observedUnits.join(",") === "rem",
    "SC01_DTCG_REFERENCE_PROFILE_DRIFT",
    "The exact direct color or dimension profile changed.",
    { audit },
  );
  assertCondition(
    audit.aliases.count === 3 &&
      audit.aliases.maximumObservedChainDepth === 1 &&
      audit.aliases.entries.every((entry) => entry.effectiveType === "color"),
    "SC01_DTCG_REFERENCE_PROFILE_DRIFT",
    "The exact whole-token alias profile changed.",
    { aliases: audit.aliases },
  );
}

async function canonicalArtifactTarget(artifactPath) {
  const absolute = path.resolve(artifactPath);
  try {
    return await realpath(absolute);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    return path.join(await realpath(path.dirname(absolute)), path.basename(absolute));
  }
}

async function targetsTrackedArtifact(artifactPath) {
  const [actual, expected] = await Promise.all([
    canonicalArtifactTarget(artifactPath),
    canonicalArtifactTarget(DEFAULT_SC01_DTCG_ARTIFACT_PATH),
  ]);
  return actual === expected;
}

function assertCanonicalTrackedSpelling(artifactPath) {
  assertCondition(
    path.resolve(artifactPath) === path.resolve(DEFAULT_SC01_DTCG_ARTIFACT_PATH),
    "SC01_DTCG_TRACKED_ALIAS_REJECTED",
    "The tracked SC-01 artifact may not be accessed through an alternate path.",
  );
}

/**
 * Builds deterministic executable evidence for the SC-01 DTCG compatibility decision.
 */
export async function buildSc01DtcgEvidence(options = undefined) {
  const normalized = normalizeOptions(options, BUILD_OPTION_NAMES, "Build");
  const overrides = sorted(Object.keys(normalized));
  const paths = Object.freeze(
    Object.fromEntries(
      Object.entries(DEFAULT_PATHS).map(([name, defaultPath]) => [
        name,
        normalized[name] ?? defaultPath,
      ]),
    ),
  );
  for (const [name, filePath] of Object.entries(paths)) {
    assertCondition(
      typeof filePath === "string" && filePath.length > 0,
      "SC01_DTCG_OPTIONS_INVALID",
      `${name} must be a non-empty path string.`,
    );
  }

  const [
    tokenConsumerFile,
    referencePackageFile,
    builtTokenEntryFile,
    builtTokenDocumentFile,
    builtTokenProviderFile,
    tokenIndexSourceFile,
    tokenSourceFile,
    providerSourceFile,
    frozenSpecFile,
  ] = await Promise.all([
    readRegularFile(paths.tokenConsumerPath, "Token consumer shim"),
    readRegularFile(paths.referencePackagePath, "Reference package manifest"),
    readRegularFile(paths.builtTokenEntryPath, "Built token entry"),
    readRegularFile(paths.builtTokenDocumentPath, "Built token document"),
    readRegularFile(paths.builtTokenProviderPath, "Built token provider"),
    readRegularFile(paths.tokenIndexSourcePath, "Token index source"),
    readRegularFile(paths.tokenSourcePath, "Reference token source"),
    readRegularFile(paths.providerSourcePath, "Reference token provider source"),
    readRegularFile(paths.frozenSpecPath, "Frozen DESEN specification"),
  ]);
  const builtTokenBinding = await auditBuiltTokenBinding({
    tokenConsumerFile,
    referencePackageFile,
    builtTokenEntryFile,
    builtTokenDocumentFile,
    builtTokenProviderFile,
    tokenIndexSourceFile,
    tokenSourceFile,
    providerSourceFile,
  });
  const tokenDocument =
    normalized.tokenDocument ?? (await loadBuiltTokenDocument(paths.tokenConsumerPath));
  const audit = evaluateSc01DtcgFixture(tokenDocument);
  assertCurrentReferenceProfile(audit, tokenDocument);
  const unsupported = buildUnsupportedMatrix();
  const invalid = buildInvalidMatrix();
  const hostOwnedStorageBoundary = auditHostOwnedBoundary(
    [
      {
        label: "token-index-source",
        source: tokenIndexSourceFile.bytes.toString("utf8"),
      },
      {
        label: "token-index-built",
        source: builtTokenEntryFile.bytes.toString("utf8"),
      },
      {
        label: "token-document-source",
        source: tokenSourceFile.bytes.toString("utf8"),
      },
      {
        label: "token-document-built",
        source: builtTokenDocumentFile.bytes.toString("utf8"),
      },
      {
        label: "token-provider-source",
        source: providerSourceFile.bytes.toString("utf8"),
      },
      {
        label: "token-provider-built",
        source: builtTokenProviderFile.bytes.toString("utf8"),
      },
    ],
    frozenSpecFile.bytes.toString("utf8"),
  );
  const canonicalDocument = canonicalJsonBytes(tokenDocument);

  const artifact = {
    schemaVersion: 1,
    checkpoint: "SC-01",
    result: "PASS",
    classification: SC01_DTCG_PROFILE_CLASSIFICATION,
    claim: {
      summary:
        "The built 26-leaf reference document is a DTCG 2025.10-compatible closed color/dimension profile, with separately reviewed exact compatibility fixtures; no general DTCG input verdict is produced.",
      auditScope: "CURRENT_BUILT_REFERENCE_DOCUMENT_AND_REVIEWED_EXACT_FIXTURE_MATRIX",
      arbitraryInputConformanceVerdict: false,
      fullParserClaim: false,
      fullResolverClaim: false,
      protocol: "DESEN 0.1.0",
      target: "web-react",
    },
    stableStandardPin: {
      organization: "Design Tokens Community Group",
      stableVersion: "2025.10",
      publicationDate: "2025-10-28",
      reportStatus: "FINAL_COMMUNITY_GROUP_REPORT",
      w3cStandardTrack: false,
      immutableReports: [
        { module: "Format", url: FORMAT_REPORT_URL },
        { module: "Color", url: COLOR_REPORT_URL },
        { module: "Resolver", url: RESOLVER_REPORT_URL },
      ],
      publicationCommit: {
        repository: "https://github.com/design-tokens/community-group",
        sha: PUBLICATION_COMMIT,
        url: PUBLICATION_COMMIT_URL,
      },
      upstreamInconsistencies: [RESOLVER_VERSION_INCONSISTENCY],
    },
    auditedReferenceDocument: {
      source: "built @desen/reference-catalog-web/tokens REFERENCE_TOKEN_DOCUMENT",
      canonicalJsonSha256: sha256(canonicalDocument),
      canonicalJsonBytes: canonicalDocument.length,
      recursivelyFrozen: true,
      ...audit,
    },
    compatibility: {
      currentReferenceProfileCompatibleSubset: [
        "JSON token and nested-group structure identified by $value",
        "Group $type inheritance",
        "color and dimension token types",
        "sRGB color values",
        "px and rem dimension units",
        "same-document whole-token dotted curly aliases",
        "recursive alias chains with missing-target, cycle, and type-mismatch rejection",
      ],
      locallyStricterProfile: [
        "Color is limited to sRGB.",
        "Color components are limited to finite numbers; the DTCG none component value is intentionally unsupported.",
        "Color alpha is locally required although DTCG permits omission.",
        "A lowercase six-digit hex fallback matching rounded sRGB components is locally required although DTCG permits omission.",
        "Only color and dimension token types are accepted.",
        "Only dotted whole-token curly aliases are accepted; a valid root alias such as {primary} is intentionally not accepted.",
        "An alias must receive color or dimension from itself or a parent group; DTCG target-token type inference is intentionally unsupported.",
      ],
      reviewedValidButUnsupportedFeatures: unsupported,
      reviewedInvalidFixtures: {
        reviewScope: "EXACT_EMBEDDED_FIXTURES_ONLY",
        expectedClassification: SC01_INVALID_DTCG_CLASSIFICATION,
        fixtures: invalid,
      },
    },
    hostOwnedStorageBoundary,
    evidence: {
      provenance: {
        mode: overrides.length === 0 ? "tracked-defaults" : "injected-test",
        overrides,
      },
      sourceFiles: [
        {
          path: "packages/reference-catalog-web/test/tokens-consumer.mjs",
          sha256: sha256(tokenConsumerFile.bytes),
          bytes: tokenConsumerFile.bytes.length,
        },
        {
          path: "packages/reference-catalog-web/package.json",
          sha256: sha256(referencePackageFile.bytes),
          bytes: referencePackageFile.bytes.length,
        },
        {
          path: "packages/reference-catalog-web/dist/tokens/index.js",
          sha256: sha256(builtTokenEntryFile.bytes),
          bytes: builtTokenEntryFile.bytes.length,
        },
        {
          path: "packages/reference-catalog-web/dist/tokens/reference-token-document.js",
          sha256: sha256(builtTokenDocumentFile.bytes),
          bytes: builtTokenDocumentFile.bytes.length,
        },
        {
          path: "packages/reference-catalog-web/dist/tokens/web-token-provider.js",
          sha256: sha256(builtTokenProviderFile.bytes),
          bytes: builtTokenProviderFile.bytes.length,
        },
        {
          path: "packages/reference-catalog-web/src/tokens/index.ts",
          sha256: sha256(tokenIndexSourceFile.bytes),
          bytes: tokenIndexSourceFile.bytes.length,
        },
        {
          path: "packages/reference-catalog-web/src/tokens/reference-token-document.ts",
          sha256: sha256(tokenSourceFile.bytes),
          bytes: tokenSourceFile.bytes.length,
        },
        {
          path: "packages/reference-catalog-web/src/tokens/web-token-provider.ts",
          sha256: sha256(providerSourceFile.bytes),
          bytes: providerSourceFile.bytes.length,
        },
        {
          path: "packages/protocol/upstream/0.1.0/snapshot/SPEC.md",
          sha256: sha256(frozenSpecFile.bytes),
          bytes: frozenSpecFile.bytes.length,
        },
      ],
      builtTokenBinding,
      compatibilityFixtureCounts: {
        reviewedUnsupportedFeatures: unsupported.length,
        reviewedUnsupportedFixtures: unsupported.reduce(
          (count, feature) => count + feature.executableFixtures.length,
          0,
        ),
        reviewedInvalidFixtures: invalid.length,
      },
    },
    boundaries: [
      "This evidence audits only the current built closed reference profile and the exact embedded fixture documents and hashes.",
      "Evaluator outcomes for arbitrary inputs outside those audited bytes are not DTCG validity or conformance verdicts.",
      "Within the reviewed matrix only, valid unsupported fixtures expect UNSUPPORTED_DTCG_FEATURE and reviewed negative fixtures expect INVALID_DTCG.",
      "This evidence does not implement or claim a general DTCG parser or validator.",
      "This evidence does not implement or claim DTCG Resolver sets, modifiers, contexts, themes, or modes.",
      "The root-token alias gap is recorded but the existing provider public API and source are unchanged.",
      "DESEN keeps token storage host-owned and does not define a competing token-file format.",
    ],
  };
  const artifactBytes = Buffer.from(
    await format(JSON.stringify(artifact), {
      parser: "json",
      endOfLine: "lf",
      printWidth: 100,
      tabWidth: 2,
    }),
  );
  return Object.freeze({
    artifact: deepFreeze(artifact),
    artifactBytes,
    artifactSha256: sha256(artifactBytes),
  });
}

/**
 * Verifies tracked or supplied SC-01 evidence against a fresh deterministic build.
 */
export async function verifySc01DtcgEvidence(options = undefined) {
  const normalized = normalizeOptions(
    options,
    ["artifactPath", "artifactBytes", ...BUILD_OPTION_NAMES],
    "Verify",
  );
  const artifactPath = normalized.artifactPath ?? DEFAULT_SC01_DTCG_ARTIFACT_PATH;
  assertCondition(
    typeof artifactPath === "string" && artifactPath.length > 0,
    "SC01_DTCG_OPTIONS_INVALID",
    "Verify artifactPath must be a non-empty path string.",
  );
  if (Object.hasOwn(normalized, "artifactBytes")) {
    assertCondition(
      normalized.artifactBytes instanceof Uint8Array &&
        !(
          typeof SharedArrayBuffer === "function" &&
          normalized.artifactBytes.buffer instanceof SharedArrayBuffer
        ),
      "SC01_DTCG_OPTIONS_INVALID",
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
      "SC01_DTCG_NONDEFAULT_TRACKED_VERIFY",
      "The tracked SC-01 artifact can only be verified from fixed defaults.",
    );
  }
  const expected = await buildSc01DtcgEvidence(buildOptions);
  const actualBytes = Buffer.from(normalized.artifactBytes ?? (await readFile(artifactPath)));
  assertCondition(
    actualBytes.equals(expected.artifactBytes),
    "SC01_DTCG_ARTIFACT_DRIFT",
    "The SC-01 DTCG artifact differs from a fresh deterministic build.",
    {
      expectedSha256: expected.artifactSha256,
      actualSha256: sha256(actualBytes),
    },
  );
  return Object.freeze({
    result: "PASS",
    classification: expected.artifact.classification,
    artifactSha256: expected.artifactSha256,
    tokens: expected.artifact.auditedReferenceDocument.leafCount,
    reviewedUnsupportedFeatures:
      expected.artifact.evidence.compatibilityFixtureCounts.reviewedUnsupportedFeatures,
    reviewedUnsupportedFixtures:
      expected.artifact.evidence.compatibilityFixtureCounts.reviewedUnsupportedFixtures,
    reviewedInvalidFixtures:
      expected.artifact.evidence.compatibilityFixtureCounts.reviewedInvalidFixtures,
    provenanceMode: expected.artifact.evidence.provenance.mode,
  });
}

/**
 * Writes deterministic SC-01 DTCG evidence through the shared atomic proof writer.
 */
export async function writeSc01DtcgEvidence(options = undefined) {
  const normalized = normalizeOptions(
    options,
    ["artifactPath", "beforeAtomicRename", "buildOptions"],
    "Write",
  );
  const artifactPath = normalized.artifactPath ?? DEFAULT_SC01_DTCG_ARTIFACT_PATH;
  assertCondition(
    typeof artifactPath === "string" && artifactPath.length > 0,
    "SC01_DTCG_OPTIONS_INVALID",
    "Write artifactPath must be a non-empty path string.",
  );
  if (Object.hasOwn(normalized, "beforeAtomicRename")) {
    assertCondition(
      typeof normalized.beforeAtomicRename === "function",
      "SC01_DTCG_OPTIONS_INVALID",
      "Write beforeAtomicRename must be a function.",
    );
  }
  if (Object.hasOwn(normalized, "buildOptions")) {
    assertCondition(
      isRecord(normalized.buildOptions),
      "SC01_DTCG_OPTIONS_INVALID",
      "Write buildOptions must be a record.",
    );
  }
  const tracked = await targetsTrackedArtifact(artifactPath);
  if (tracked) {
    assertCanonicalTrackedSpelling(artifactPath);
    assertCondition(
      !Object.hasOwn(normalized, "beforeAtomicRename") &&
        !Object.hasOwn(normalized, "buildOptions"),
      "SC01_DTCG_NONDEFAULT_TRACKED_WRITE",
      "The tracked SC-01 artifact can only be generated from fixed defaults.",
    );
  }
  const result = await buildSc01DtcgEvidence(normalized.buildOptions);
  try {
    await writeAtomicProofArtifact({
      artifactPath,
      artifactBytes: result.artifactBytes,
      beforeAtomicRename: normalized.beforeAtomicRename,
    });
  } catch (error) {
    fail("SC01_DTCG_ARTIFACT_WRITE_FAILED", "The SC-01 artifact could not be written safely.", {
      cause: error instanceof Error ? error.message : String(error),
    });
  }
  return result;
}
