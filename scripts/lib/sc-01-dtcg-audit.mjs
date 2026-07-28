import { createHash } from "node:crypto";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import { types as utilTypes } from "node:util";
import { fileURLToPath } from "node:url";

import ts from "typescript";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const ARTIFACT_NAME = "sc-01-dtcg-compatibility.json";
const ARTIFACT_SHA256 = "1df806e0b56d66e27558bbc2bb2f17e0e261b0103c90ed2658ad1eba4c3bdbc6";
const PROOF_MATRIX_PATH = path.join(WORKSPACE_ROOT, "docs/proof/PROOF-MATRIX.md");
const HISTORICAL_PACKAGE_MANIFEST_SHA256 =
  "sha256:455025526691234369626b96281ba6522a0d90340adcfcd67ffea2d53be167fa";
const HISTORICAL_TOKEN_DOCUMENT_SHA256 =
  "sha256:e7f7f3692b57722a31991aae4768c32ad1e0f61dced84131f7629c29840ebbac";
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype);
const TYPED_ARRAY_BUFFER_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "buffer",
).get;
const TYPED_ARRAY_BYTE_LENGTH_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteLength",
).get;
const TYPED_ARRAY_BYTE_OFFSET_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteOffset",
).get;

/** Exact classification assigned to the supported reference-token surface. */
export const SC01_DTCG_PROFILE_CLASSIFICATION = "DTCG_2025_10_COMPATIBLE_CLOSED_REFERENCE_PROFILE";

/** Expected outcome label for reviewed fixtures outside the closed reference profile. */
export const SC01_UNSUPPORTED_DTCG_CLASSIFICATION = "UNSUPPORTED_DTCG_FEATURE";

/** Expected outcome label for the reviewed negative fixture matrix. */
export const SC01_INVALID_DTCG_CLASSIFICATION = "INVALID_DTCG";

/** Absolute path to the immutable task-time SC-01 DTCG compatibility artifact. */
export const DEFAULT_SC01_DTCG_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/artifacts",
  ARTIFACT_NAME,
);

const FORMAT_REPORT_URL =
  "https://www.w3.org/community/reports/design-tokens/CG-FINAL-format-20251028/";
const COLOR_REPORT_URL =
  "https://www.w3.org/community/reports/design-tokens/CG-FINAL-color-20251028/";
const RESOLVER_REPORT_URL =
  "https://www.w3.org/community/reports/design-tokens/CG-FINAL-resolver-20251028/";
const PUBLICATION_COMMIT = "f0f32a7dce0b51b36488be9cbbf7cad2763c6f29";
const PUBLICATION_COMMIT_URL = `https://github.com/design-tokens/community-group/commit/${PUBLICATION_COMMIT}`;
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

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

function normalizeOptions(options, allowedNames, operation) {
  if (options === undefined) return Object.freeze({});
  if (
    options === null ||
    typeof options !== "object" ||
    Array.isArray(options) ||
    utilTypes.isProxy(options)
  ) {
    fail(
      "SC01_DTCG_OPTIONS_INVALID",
      `${operation} options must be a non-Proxy plain own-data object.`,
    );
  }
  let prototype;
  let keys;
  try {
    prototype = Object.getPrototypeOf(options);
    keys = Reflect.ownKeys(options);
  } catch {
    fail("SC01_DTCG_OPTIONS_INVALID", `${operation} options could not be captured safely.`);
  }
  if (
    (prototype !== Object.prototype && prototype !== null) ||
    keys.some((key) => typeof key !== "string" || !allowedNames.includes(key))
  ) {
    fail(
      "SC01_DTCG_OPTIONS_INVALID",
      `${operation} options contain unknown, inherited, or symbolic fields.`,
    );
  }
  const output = Object.create(null);
  for (const name of sorted(keys)) {
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(options, name);
    } catch {
      fail(
        "SC01_DTCG_OPTIONS_INVALID",
        `${operation} option ${JSON.stringify(name)} could not be captured safely.`,
      );
    }
    if (descriptor === undefined || !descriptor.enumerable || !Object.hasOwn(descriptor, "value")) {
      fail(
        "SC01_DTCG_OPTIONS_INVALID",
        `${operation} option ${JSON.stringify(name)} must be an enumerable own data property.`,
      );
    }
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
    typeof value === "object" && !utilTypes.isProxy(value),
    SC01_INVALID_DTCG_CLASSIFICATION,
    `DTCG data must be JSON-compatible non-Proxy data at ${pathLabel}.`,
  );
  let prototype;
  let keys;
  let descriptors;
  try {
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    fail(
      SC01_INVALID_DTCG_CLASSIFICATION,
      `DTCG data could not be inspected safely at ${pathLabel}.`,
    );
  }
  assertCondition(
    Array.isArray(value) || prototype === Object.prototype || prototype === null,
    SC01_INVALID_DTCG_CLASSIFICATION,
    `DTCG data must use arrays or plain records at ${pathLabel}.`,
  );
  if (Array.isArray(value)) {
    const lengthDescriptor = descriptors.length;
    assertCondition(
      lengthDescriptor !== undefined &&
        Object.hasOwn(lengthDescriptor, "value") &&
        Number.isSafeInteger(lengthDescriptor.value) &&
        lengthDescriptor.value <= MAX_JSON_NODES &&
        keys.length === lengthDescriptor.value + 1 &&
        keys.at(-1) === "length" &&
        keys.slice(0, -1).every((key, index) => typeof key === "string" && key === String(index)),
      SC01_INVALID_DTCG_CLASSIFICATION,
      `DTCG arrays must be dense own-data arrays at ${pathLabel}.`,
    );
  }
  assertCondition(
    !traversal.active.has(value) && keys.every((key) => typeof key === "string"),
    SC01_INVALID_DTCG_CLASSIFICATION,
    `DTCG data must be acyclic and string-keyed at ${pathLabel}.`,
  );
  traversal.active.add(value);
  for (const key of sorted(Object.keys(descriptors))) {
    const descriptor = descriptors[key];
    assertCondition(
      Object.hasOwn(descriptor, "value") &&
        descriptor.value !== undefined &&
        (key === "length" || descriptor.enumerable),
      SC01_INVALID_DTCG_CLASSIFICATION,
      `DTCG data cannot contain accessors, hidden fields, or undefined at ${pathLabel}.`,
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

function auditHostOwnedBoundary(executedSources, frozenSpec) {
  assertCondition(
    Array.isArray(executedSources) &&
      !utilTypes.isProxy(executedSources) &&
      Object.getPrototypeOf(executedSources) === Array.prototype &&
      typeof frozenSpec === "string",
    "SC01_DTCG_OPTIONS_INVALID",
    "Executed-source fixtures must be a plain array and the frozen specification must be text.",
  );
  const executedSourceKeys = Reflect.ownKeys(executedSources);
  assertCondition(
    executedSources.length <= MAX_JSON_NODES &&
      executedSourceKeys.length === executedSources.length + 1 &&
      executedSourceKeys.at(-1) === "length" &&
      executedSourceKeys
        .slice(0, -1)
        .every((key, index) => typeof key === "string" && key === String(index)),
    "SC01_DTCG_OPTIONS_INVALID",
    "Executed-source fixtures must be a bounded dense own-data array.",
  );
  const capturedSources = [];
  for (let index = 0; index < executedSources.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(executedSources, String(index));
    assertCondition(
      descriptor !== undefined && descriptor.enumerable && Object.hasOwn(descriptor, "value"),
      "SC01_DTCG_OPTIONS_INVALID",
      "Executed-source fixtures must be a dense own-data array.",
    );
    const entry = normalizeOptions(
      descriptor.value,
      ["label", "source"],
      `Executed-source fixture ${index}`,
    );
    assertCondition(
      typeof entry.label === "string" && typeof entry.source === "string",
      "SC01_DTCG_OPTIONS_INVALID",
      "Executed-source fixture labels and source values must be strings.",
    );
    capturedSources.push(Object.freeze({ label: entry.label, source: entry.source }));
  }
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
  const findings = capturedSources.flatMap(({ label, source }) =>
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

function inspectRuntimeModuleEdges(source, label, expectedSpecifiers, exportOnly) {
  assertCondition(
    typeof source === "string" &&
      Array.isArray(expectedSpecifiers) &&
      !utilTypes.isProxy(expectedSpecifiers) &&
      Object.getPrototypeOf(expectedSpecifiers) === Array.prototype &&
      expectedSpecifiers.every((specifier) => typeof specifier === "string"),
    "SC01_DTCG_BUILT_BINDING_DRIFT",
    `${label} module-edge audit received invalid input.`,
  );
  const expectedSpecifierKeys = Reflect.ownKeys(expectedSpecifiers);
  assertCondition(
    expectedSpecifiers.length <= MAX_JSON_NODES &&
      expectedSpecifierKeys.length === expectedSpecifiers.length + 1 &&
      expectedSpecifierKeys.at(-1) === "length" &&
      expectedSpecifierKeys
        .slice(0, -1)
        .every((key, index) => typeof key === "string" && key === String(index)),
    "SC01_DTCG_BUILT_BINDING_DRIFT",
    `${label} expected module edges must be a bounded dense own-data array.`,
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
export function auditSc01RuntimeModuleFixture(rawOptions) {
  const options = normalizeOptions(
    rawOptions,
    ["source", "label", "expectedSpecifiers", "exportOnly"],
    "Runtime module fixture",
  );
  const source = options.source;
  const label = options.label ?? "injected-runtime-module";
  const expectedSpecifiers = options.expectedSpecifiers;
  const exportOnly = options.exportOnly ?? false;
  assertCondition(
    typeof label === "string" && typeof exportOnly === "boolean",
    "SC01_DTCG_OPTIONS_INVALID",
    "Runtime module fixture label and exportOnly values are invalid.",
  );
  return inspectRuntimeModuleEdges(source, label, expectedSpecifiers, exportOnly);
}

const HISTORICAL_ARTIFACT_BYTES = 31_286;
const MAX_PROOF_MATRIX_BYTES = 2_000_000;
const SC01_PROOF_MATRIX_CONTEXT = [
  "SC-01 is complete with recommendation `continue`. The proof-only `SC01_STATIC_TEXT_V1` bridge",
  "passes 27 focused tests across 1,029 deterministic positive vectors, 1,029 exact JSON structural",
  "round-trips in each direction, 2,058 A2UI message schema validations, and 34 stable rejection cases:",
  "`sc-01-a2ui-bridge.json`",
  "`sha256:2f927afee4ec50d8191fd2d44db93e35ff89f64856d0ae7bbc4be14193588902`.",
  "The DTCG audit passes 20 focused tests that preserve the immutable task-time receipt and cover its",
  "26-token built reference document, 14 unsupported feature families, 16 exact",
  "valid-but-unsupported fixtures, seven exact negative fixtures, proof-pin integrity, hostile inputs,",
  "symlinks, and atomic-copy safety:",
  "`sc-01-dtcg-compatibility.json`",
  "`sha256:1df806e0b56d66e27558bbc2bb2f17e0e261b0103c90ed2658ad1eba4c3bdbc6`.",
  "Its strict compatibility reader never consults current successor package source or build output.",
  "These are strategic compatibility receipts, not runtime or renderer conformance evidence; no",
  "`P-*`, `N-*`, or `S-*` status changes.",
  "",
  "M04-T01 defines and proves the first framework-neutral runtime integration slice without changing",
].join("\n");
const HISTORICAL_SOURCE_FILES = Object.freeze([
  Object.freeze({
    path: "packages/reference-catalog-web/test/tokens-consumer.mjs",
    sha256: "sha256:8a39ae2c3183ea968ec235458269e8283fe46af3ffd1bb00c011bf3b1eecdee3",
    bytes: 53,
  }),
  Object.freeze({
    path: "packages/reference-catalog-web/package.json",
    sha256: HISTORICAL_PACKAGE_MANIFEST_SHA256,
    bytes: 2_254,
  }),
  Object.freeze({
    path: "packages/reference-catalog-web/dist/tokens/index.js",
    sha256: "sha256:4b47a66a77ddfb34a8ead7f62a35523c06aff94467f29183eeaba291f779eaf8",
    bytes: 409,
  }),
  Object.freeze({
    path: "packages/reference-catalog-web/dist/tokens/reference-token-document.js",
    sha256: "sha256:9f566e8ca4d8ac065abd531ec30e9a8b01fa6557b44e46c1d03c0c1b163066b3",
    bytes: 3_184,
  }),
  Object.freeze({
    path: "packages/reference-catalog-web/dist/tokens/web-token-provider.js",
    sha256: "sha256:81c4897b946483672cb6b70d79b9ec05fad2f45e06dc14bea3dfb0cf7af7ffd5",
    bytes: 11_116,
  }),
  Object.freeze({
    path: "packages/reference-catalog-web/src/tokens/index.ts",
    sha256: "sha256:03ae286043cc3c84eaf3fd33f187e86025f3bfdaed4a0151ef4660be9a17f22c",
    bytes: 857,
  }),
  Object.freeze({
    path: "packages/reference-catalog-web/src/tokens/reference-token-document.ts",
    sha256: "sha256:d20e599ebd5bd2e958ed77ed98b76dc5a13576166141e9b1620998b6050de05e",
    bytes: 4_897,
  }),
  Object.freeze({
    path: "packages/reference-catalog-web/src/tokens/web-token-provider.ts",
    sha256: "sha256:3a9bc4f1fc48d9839d5fa663670df4612421e1d60cba734e636750d4df62676a",
    bytes: 14_450,
  }),
  Object.freeze({
    path: "packages/protocol/upstream/0.1.0/snapshot/SPEC.md",
    sha256: "sha256:6443aed035cdced68e688402863ae3b7cc77f6dd75c8ad610831483d54b35d9c",
    bytes: 77_981,
  }),
]);

function optionalString(value, label) {
  if (value !== undefined && (typeof value !== "string" || value.length === 0)) {
    fail("SC01_DTCG_OPTIONS_INVALID", `${label} must be a non-empty string.`);
  }
  return value;
}

function optionalBytes(value, label) {
  if (value === undefined) return undefined;
  if (
    value === null ||
    typeof value !== "object" ||
    utilTypes.isProxy(value) ||
    !utilTypes.isUint8Array(value)
  ) {
    fail("SC01_DTCG_OPTIONS_INVALID", `${label} must be non-shared non-Proxy bytes.`);
  }
  let prototype;
  let backingBuffer;
  let byteLength;
  let byteOffset;
  try {
    prototype = Object.getPrototypeOf(value);
    if (prototype !== Uint8Array.prototype && prototype !== Buffer.prototype) {
      fail(
        "SC01_DTCG_OPTIONS_INVALID",
        `${label} must use the exact Buffer or Uint8Array prototype.`,
      );
    }
    backingBuffer = Reflect.apply(TYPED_ARRAY_BUFFER_GETTER, value, []);
    byteLength = Reflect.apply(TYPED_ARRAY_BYTE_LENGTH_GETTER, value, []);
    byteOffset = Reflect.apply(TYPED_ARRAY_BYTE_OFFSET_GETTER, value, []);
  } catch (error) {
    if (error instanceof Sc01DtcgAuditError) throw error;
    fail("SC01_DTCG_OPTIONS_INVALID", `${label} could not be captured safely.`);
  }
  if (utilTypes.isSharedArrayBuffer(backingBuffer)) {
    fail("SC01_DTCG_OPTIONS_INVALID", `${label} must not use shared backing memory.`);
  }
  try {
    const captured = new Uint8Array(byteLength);
    captured.set(new Uint8Array(backingBuffer, byteOffset, byteLength));
    return Buffer.from(captured);
  } catch {
    fail("SC01_DTCG_OPTIONS_INVALID", `${label} backing memory is detached or invalid.`);
  }
}

function optionalCallback(value, label) {
  if (value !== undefined && (typeof value !== "function" || utilTypes.isProxy(value))) {
    fail("SC01_DTCG_OPTIONS_INVALID", `${label} must be a non-Proxy function.`);
  }
  return value;
}

async function readRegularBytes(filePath, label, maximumBytes = undefined) {
  let entry;
  try {
    entry = await lstat(filePath);
  } catch (error) {
    fail("SC01_DTCG_ARTIFACT_MISSING", `${label} is missing or inaccessible.`, {
      cause: String(error),
    });
  }
  if (!entry.isFile() || entry.isSymbolicLink()) {
    fail("SC01_DTCG_ARTIFACT_UNSAFE", `${label} must be a regular non-symlink file.`);
  }
  if (maximumBytes !== undefined && entry.size > maximumBytes) {
    fail("SC01_DTCG_ARTIFACT_UNSAFE", `${label} exceeds its bounded byte limit.`);
  }

  let handle;
  try {
    handle = await open(filePath, "r");
    const [openedEntry, currentEntry] = await Promise.all([handle.stat(), lstat(filePath)]);
    if (
      !openedEntry.isFile() ||
      !currentEntry.isFile() ||
      currentEntry.isSymbolicLink() ||
      openedEntry.dev !== currentEntry.dev ||
      openedEntry.ino !== currentEntry.ino
    ) {
      fail("SC01_DTCG_ARTIFACT_UNSAFE", `${label} changed identity while it was being opened.`);
    }
    const bytes = await handle.readFile();
    if (maximumBytes !== undefined && bytes.length > maximumBytes) {
      fail("SC01_DTCG_ARTIFACT_UNSAFE", `${label} exceeds its bounded byte limit.`);
    }
    return bytes;
  } catch (error) {
    if (error instanceof Sc01DtcgAuditError) throw error;
    fail("SC01_DTCG_ARTIFACT_UNSAFE", `${label} could not be read safely.`, {
      cause: String(error),
    });
  } finally {
    await handle?.close();
  }
}

async function canonicalDestinationPath(filePath) {
  const absolutePath = path.resolve(filePath);
  const canonicalParent = await realpath(path.dirname(absolutePath));
  return path.join(canonicalParent, path.basename(absolutePath));
}

function assertHistoricalSourceLedger(sourceFiles) {
  if (!Array.isArray(sourceFiles) || sourceFiles.length !== HISTORICAL_SOURCE_FILES.length) {
    fail("SC01_DTCG_HISTORICAL_ARTIFACT_DRIFT", "The immutable SC-01 source ledger changed.");
  }
  for (let index = 0; index < HISTORICAL_SOURCE_FILES.length; index += 1) {
    const expected = HISTORICAL_SOURCE_FILES[index];
    const actual = sourceFiles[index];
    if (
      actual?.path !== expected.path ||
      actual?.sha256 !== expected.sha256 ||
      actual?.bytes !== expected.bytes
    ) {
      fail("SC01_DTCG_HISTORICAL_ARTIFACT_DRIFT", "The immutable SC-01 source ledger changed.", {
        index,
        expected,
        actual,
      });
    }
  }
}

function assertHistoricalSemantics(artifact) {
  const unsupported = artifact.compatibility?.reviewedValidButUnsupportedFeatures;
  const invalid = artifact.compatibility?.reviewedInvalidFixtures?.fixtures;
  const fixtureCounts = artifact.evidence?.compatibilityFixtureCounts;
  const standard = artifact.stableStandardPin;
  const builtBinding = artifact.evidence?.builtTokenBinding;
  if (
    artifact.schemaVersion !== 1 ||
    artifact.checkpoint !== "SC-01" ||
    artifact.result !== "PASS" ||
    artifact.classification !== SC01_DTCG_PROFILE_CLASSIFICATION ||
    artifact.claim?.auditScope !==
      "CURRENT_BUILT_REFERENCE_DOCUMENT_AND_REVIEWED_EXACT_FIXTURE_MATRIX" ||
    artifact.claim?.arbitraryInputConformanceVerdict !== false ||
    artifact.claim?.fullParserClaim !== false ||
    artifact.claim?.fullResolverClaim !== false ||
    artifact.claim?.protocol !== "DESEN 0.1.0" ||
    artifact.claim?.target !== "web-react" ||
    standard?.stableVersion !== "2025.10" ||
    standard?.publicationDate !== "2025-10-28" ||
    standard?.publicationCommit?.sha !== PUBLICATION_COMMIT ||
    standard?.publicationCommit?.url !== PUBLICATION_COMMIT_URL ||
    standard?.immutableReports?.length !== 3 ||
    standard.immutableReports[0]?.url !== FORMAT_REPORT_URL ||
    standard.immutableReports[1]?.url !== COLOR_REPORT_URL ||
    standard.immutableReports[2]?.url !== RESOLVER_REPORT_URL ||
    artifact.auditedReferenceDocument?.canonicalJsonSha256 !== HISTORICAL_TOKEN_DOCUMENT_SHA256 ||
    artifact.auditedReferenceDocument?.canonicalJsonBytes !== 2_902 ||
    artifact.auditedReferenceDocument?.leafCount !== 26 ||
    artifact.auditedReferenceDocument?.typeCounts?.color !== 20 ||
    artifact.auditedReferenceDocument?.typeCounts?.dimension !== 6 ||
    artifact.auditedReferenceDocument?.aliases?.count !== 3 ||
    artifact.auditedReferenceDocument?.recursivelyFrozen !== true ||
    !Array.isArray(unsupported) ||
    unsupported.length !== 14 ||
    unsupported.reduce(
      (count, feature) =>
        count + (Array.isArray(feature.executableFixtures) ? feature.executableFixtures.length : 0),
      0,
    ) !== 16 ||
    !Array.isArray(invalid) ||
    invalid.length !== 7 ||
    artifact.compatibility?.reviewedInvalidFixtures?.reviewScope !==
      "EXACT_EMBEDDED_FIXTURES_ONLY" ||
    artifact.hostOwnedStorageBoundary?.owner !== "host" ||
    artifact.hostOwnedStorageBoundary?.protocolDefinesTokenStorage !== false ||
    artifact.hostOwnedStorageBoundary?.competingTokenFileFormatCreated !== false ||
    artifact.evidence?.provenance?.mode !== "tracked-defaults" ||
    artifact.evidence?.provenance?.overrides?.length !== 0 ||
    fixtureCounts?.reviewedUnsupportedFeatures !== 14 ||
    fixtureCounts?.reviewedUnsupportedFixtures !== 16 ||
    fixtureCounts?.reviewedInvalidFixtures !== 7 ||
    builtBinding?.packageSelfExport?.manifestSha256 !== HISTORICAL_PACKAGE_MANIFEST_SHA256 ||
    builtBinding?.packageSelfExport?.subpath !== "./tokens" ||
    builtBinding?.packageSelfExport?.import !== "./dist/tokens/index.js" ||
    builtBinding?.sourceToBuiltTranspileParity?.tokenIndex !== true ||
    builtBinding?.sourceToBuiltTranspileParity?.tokenDocument !== true ||
    builtBinding?.sourceToBuiltTranspileParity?.tokenProvider !== true
  ) {
    fail(
      "SC01_DTCG_HISTORICAL_ARTIFACT_DRIFT",
      "The immutable SC-01 DTCG artifact lost its task-time semantics.",
    );
  }
  assertHistoricalSourceLedger(artifact.evidence?.sourceFiles);
}

function parseHistoricalArtifact(bytes) {
  const actualSha256 = sha256(bytes);
  const expectedSha256 = `sha256:${ARTIFACT_SHA256}`;
  if (bytes.length !== HISTORICAL_ARTIFACT_BYTES || actualSha256 !== expectedSha256) {
    fail(
      "SC01_DTCG_HISTORICAL_ARTIFACT_DRIFT",
      "The immutable SC-01 DTCG artifact bytes changed.",
      {
        expectedBytes: HISTORICAL_ARTIFACT_BYTES,
        actualBytes: bytes.length,
        expectedSha256,
        actualSha256,
      },
    );
  }
  let artifact;
  try {
    artifact = JSON.parse(bytes.toString("utf8"));
  } catch {
    fail(
      "SC01_DTCG_HISTORICAL_ARTIFACT_DRIFT",
      "The immutable SC-01 DTCG artifact is not valid JSON.",
    );
  }
  assertHistoricalSemantics(artifact);
  return deepFreeze(artifact);
}

function verifyProofMatrixPin(matrixText) {
  const exactReference = `\`${ARTIFACT_NAME}\`\n\`sha256:${ARTIFACT_SHA256}\`.`;
  if (
    matrixText.split(exactReference).length !== 2 ||
    matrixText.split(`\`${ARTIFACT_NAME}\``).length !== 2 ||
    matrixText.split(SC01_PROOF_MATRIX_CONTEXT).length !== 2
  ) {
    fail(
      "SC01_DTCG_PROOF_PIN_DRIFT",
      "Proof Matrix must retain one exact adjacent immutable SC-01 DTCG artifact pin.",
    );
  }
}

async function readHistoricalArtifact(options) {
  const artifactPath =
    optionalString(options.artifactPath, "artifactPath") ?? DEFAULT_SC01_DTCG_ARTIFACT_PATH;
  const artifactBytes =
    optionalBytes(options.artifactBytes, "artifactBytes") ??
    (await readRegularBytes(
      path.resolve(artifactPath),
      "Immutable SC-01 DTCG artifact",
      HISTORICAL_ARTIFACT_BYTES,
    ));
  const artifact = parseHistoricalArtifact(artifactBytes);
  return Object.freeze({
    artifact,
    artifactBytes,
    artifactSha256: `sha256:${ARTIFACT_SHA256}`,
    compatibilityMode: "immutable-task-time-artifact",
  });
}

/**
 * Reads exact SC-01 task-time evidence without consulting successor package source or build output.
 */
export async function buildSc01DtcgEvidence(rawOptions = undefined) {
  const options = normalizeOptions(rawOptions, ["artifactPath", "artifactBytes"], "Build");
  return readHistoricalArtifact(options);
}

/** Verifies exact SC-01 bytes, task-time semantics, and the immutable Proof Matrix pin. */
export async function verifySc01DtcgEvidence(rawOptions = undefined) {
  const options = normalizeOptions(
    rawOptions,
    ["artifactPath", "artifactBytes", "proofMatrixText"],
    "Verify",
  );
  const proofMatrixText = optionalString(options.proofMatrixText, "proofMatrixText");
  if (
    proofMatrixText !== undefined &&
    Buffer.byteLength(proofMatrixText, "utf8") > MAX_PROOF_MATRIX_BYTES
  ) {
    fail(
      "SC01_DTCG_OPTIONS_INVALID",
      "proofMatrixText exceeds the bounded Proof Matrix byte limit.",
    );
  }
  const built = await readHistoricalArtifact(options);
  verifyProofMatrixPin(
    proofMatrixText ??
      (await readRegularBytes(PROOF_MATRIX_PATH, "Proof Matrix", MAX_PROOF_MATRIX_BYTES)).toString(
        "utf8",
      ),
  );
  return Object.freeze({
    result: built.artifact.result,
    classification: built.artifact.classification,
    artifactSha256: built.artifactSha256,
    tokens: built.artifact.auditedReferenceDocument.leafCount,
    reviewedUnsupportedFeatures:
      built.artifact.evidence.compatibilityFixtureCounts.reviewedUnsupportedFeatures,
    reviewedUnsupportedFixtures:
      built.artifact.evidence.compatibilityFixtureCounts.reviewedUnsupportedFixtures,
    reviewedInvalidFixtures:
      built.artifact.evidence.compatibilityFixtureCounts.reviewedInvalidFixtures,
    provenanceMode: built.artifact.evidence.provenance.mode,
    compatibilityMode: built.compatibilityMode,
  });
}

/**
 * Preserves the tracked SC-01 artifact or copies its exact bytes to an alternate safe target.
 */
export async function writeSc01DtcgEvidence(rawOptions = undefined) {
  const options = normalizeOptions(
    rawOptions,
    ["artifactPath", "beforeAtomicRename", "buildOptions"],
    "Write",
  );
  const artifactPath =
    optionalString(options.artifactPath, "artifactPath") ?? DEFAULT_SC01_DTCG_ARTIFACT_PATH;
  const beforeAtomicRename = optionalCallback(options.beforeAtomicRename, "beforeAtomicRename");
  const buildOptions =
    options.buildOptions === undefined
      ? undefined
      : normalizeOptions(options.buildOptions, ["artifactPath", "artifactBytes"], "buildOptions");

  let canonicalArtifactPath;
  let canonicalTrackedPath;
  try {
    [canonicalArtifactPath, canonicalTrackedPath] = await Promise.all([
      canonicalDestinationPath(artifactPath),
      canonicalDestinationPath(DEFAULT_SC01_DTCG_ARTIFACT_PATH),
    ]);
  } catch (error) {
    fail(
      "SC01_DTCG_ARTIFACT_WRITE_FAILED",
      "The immutable SC-01 artifact destination could not be resolved safely.",
      { cause: String(error) },
    );
  }

  if (canonicalArtifactPath === canonicalTrackedPath) {
    if (beforeAtomicRename !== undefined || buildOptions !== undefined) {
      fail(
        "SC01_DTCG_NONDEFAULT_TRACKED_WRITE",
        "The immutable tracked SC-01 artifact cannot be rebuilt or hooked.",
      );
    }
    const built = await readHistoricalArtifact(Object.freeze({}));
    return Object.freeze({ ...built, preserved: true });
  }

  const built = await readHistoricalArtifact(buildOptions ?? Object.freeze({}));
  try {
    await writeAtomicProofArtifact({
      artifactPath: canonicalArtifactPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename,
    });
  } catch (error) {
    fail(
      "SC01_DTCG_ARTIFACT_WRITE_FAILED",
      "The immutable SC-01 artifact could not be copied safely.",
      { cause: String(error) },
    );
  }
  return Object.freeze({
    ...built,
    artifactPath: canonicalArtifactPath,
    preserved: false,
  });
}
