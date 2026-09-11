import { DESIGN_TOKEN_PROFILE, isDtcgTokenAlias } from "@desen/design-system-core";
import { canonicalizeJson } from "@desen/protocol";

import type { DtcgDiagnostic } from "@desen/design-system-core";

/** Frozen SC-01 compatibility families understood by the authoring transfer boundary. */
export type ThemeAuthoringCompatibilityFeatureId =
  | "ADDITIONAL_COLOR_SPACES"
  | "ADDITIONAL_TOKEN_TYPES"
  | "ALIAS_TARGET_TYPE_INFERENCE"
  | "DEPRECATED"
  | "EMPTY_GROUP"
  | "EXTENSIONS"
  | "GROUP_EXTENDS"
  | "JSON_POINTER_REF"
  | "NONE_COLOR_COMPONENTS"
  | "OPTIONAL_COLOR_ALPHA_AND_HEX"
  | "PROPERTY_LEVEL_REF"
  | "RESOLVER_THEMES_AND_MODES"
  | "ROOT_GROUP_TOKEN"
  | "ROOT_TOKEN_CURLY_ALIAS"
  | "SHADOW_INSET";

export interface ReviewedDtcgCompatibilityFeature {
  readonly diagnostic: DtcgDiagnostic;
  readonly featureId: ThemeAuthoringCompatibilityFeatureId;
}

export type ReviewedDtcgCompatibilityProjection =
  | {
      readonly cause: DtcgDiagnostic;
      readonly ok: false;
    }
  | {
      readonly features: readonly ReviewedDtcgCompatibilityFeature[];
      readonly ok: true;
      readonly omitSource: boolean;
    };

type MutableObject = Record<string, unknown>;

interface ProjectionState {
  readonly extendedGroups: WeakSet<object>;
  readonly features: ReviewedDtcgCompatibilityFeature[];
  snapshot: MutableObject;
  readonly sourceId: string;
  tokenCount: number;
  readonly inferredTypes: Map<string, string | undefined>;
  readonly tokenTypes: Map<string, IndexedToken>;
}

interface IndexedToken {
  readonly inheritedType: string | undefined;
  readonly node: MutableObject;
  readonly path: readonly string[];
}

class ReviewedCompatibilityError extends Error {
  readonly diagnostic: DtcgDiagnostic;

  constructor(diagnostic: DtcgDiagnostic) {
    super(diagnostic.message);
    this.name = "ReviewedCompatibilityError";
    this.diagnostic = diagnostic;
  }
}

class ReviewedCompatibilityFeatureLimit extends Error {
  constructor() {
    super("Reviewed unsupported-feature limit exceeded.");
    this.name = "ReviewedCompatibilityFeatureLimit";
  }
}

const STANDARD_TYPES = new Set([
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
const SUPPORTED_TYPES = new Set<string>(DESIGN_TOKEN_PROFILE.tokenTypes);
const FONT_WEIGHTS = new Set([
  "black",
  "bold",
  "book",
  "demi-bold",
  "extra-black",
  "extra-bold",
  "extra-light",
  "hairline",
  "heavy",
  "light",
  "medium",
  "normal",
  "regular",
  "semi-bold",
  "thin",
  "ultra-black",
  "ultra-bold",
  "ultra-light",
]);
const STROKE_STYLES = new Set([
  "dashed",
  "dotted",
  "double",
  "groove",
  "inset",
  "outset",
  "ridge",
  "solid",
]);
const LINE_CAPS = new Set(["butt", "round", "square"]);

type ComponentRange = readonly [minimum: number, maximum: number, maximumExclusive?: true];
const UNIT_COMPONENTS = [
  [0, 1],
  [0, 1],
  [0, 1],
] as const satisfies readonly ComponentRange[];
const COLOR_COMPONENT_RANGES: Readonly<Record<string, readonly ComponentRange[]>> = Object.freeze({
  "a98-rgb": UNIT_COMPONENTS,
  "display-p3": UNIT_COMPONENTS,
  hsl: [
    [0, 360, true],
    [0, 100],
    [0, 100],
  ],
  hwb: [
    [0, 360, true],
    [0, 100],
    [0, 100],
  ],
  lab: [
    [0, 100],
    [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY],
    [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY],
  ],
  lch: [
    [0, 100],
    [0, Number.POSITIVE_INFINITY],
    [0, 360, true],
  ],
  oklab: [
    [0, 1],
    [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY],
    [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY],
  ],
  oklch: [
    [0, 1],
    [0, Number.POSITIVE_INFINITY],
    [0, 360, true],
  ],
  "prophoto-rgb": UNIT_COMPONENTS,
  rec2020: UNIT_COMPONENTS,
  srgb: UNIT_COMPONENTS,
  "srgb-linear": UNIT_COMPONENTS,
  "xyz-d50": UNIT_COMPONENTS,
  "xyz-d65": UNIT_COMPONENTS,
});

function mutableObject(value: unknown): MutableObject | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as MutableObject)
    : undefined;
}

function defineJsonMember(target: MutableObject, key: string, value: unknown): void {
  Object.defineProperty(target, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
}

function escapePointerSegment(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

function pointer(path: readonly string[]): string {
  return path.length === 0 ? "" : `/${path.map(escapePointerSegment).join("/")}`;
}

function tokenPath(path: readonly string[]): string | undefined {
  return path.length === 0 ? undefined : path.join(".");
}

function diagnostic(
  classification: DtcgDiagnostic["classification"],
  code: DtcgDiagnostic["code"],
  message: string,
  location: string,
  sourceId: string,
  path?: string,
): DtcgDiagnostic {
  return Object.freeze({
    classification,
    code,
    message,
    pointer: location,
    sourceId,
    ...(path === undefined ? {} : { tokenPath: path }),
  });
}

function invalid(
  state: ProjectionState,
  code: DtcgDiagnostic["code"],
  message: string,
  location: string,
  path?: string,
): never {
  throw new ReviewedCompatibilityError(
    diagnostic("INVALID_DTCG", code, message, location, state.sourceId, path),
  );
}

function record(
  state: ProjectionState,
  featureId: ThemeAuthoringCompatibilityFeatureId,
  code: DtcgDiagnostic["code"],
  message: string,
  location: string,
  path?: string,
): void {
  if (
    state.features.some(
      (feature) => feature.featureId === featureId && feature.diagnostic.pointer === location,
    )
  )
    return;
  state.features.push(
    Object.freeze({
      diagnostic: diagnostic(
        "UNSUPPORTED_DTCG_FEATURE",
        code,
        message,
        location,
        state.sourceId,
        path,
      ),
      featureId,
    }),
  );
  // The authoring boundary allows 64 features per overlay. The 65th diagnostic is an overflow
  // sentinel; stop the closed projection immediately so hostile inputs cannot turn disclosure
  // collection or group-extension resolution into unbounded work.
  if (state.features.length > 64) throw new ReviewedCompatibilityFeatureLimit();
}

function exactKeys(value: MutableObject, required: readonly string[], optional: readonly string[]) {
  const accepted = new Set([...required, ...optional]);
  const keys = Object.keys(value);
  return required.every((key) => keys.includes(key)) && keys.every((key) => accepted.has(key));
}

function validName(name: string): boolean {
  if (name.length === 0 || name.startsWith("$") || /[.{}]/u.test(name)) return false;
  return ![...name].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 31 || codePoint === 127;
  });
}

function validatePath(path: readonly string[], state: ProjectionState): void {
  // T02 bounds the parent group path for its synthetic $root projection; keeping the same
  // convention avoids rejecting a root token solely because the official identity adds $root.
  const boundedPath = path.at(-1) === "$root" ? path.slice(0, -1) : path;
  const value = boundedPath.join(".");
  if (
    boundedPath.length > DESIGN_TOKEN_PROFILE.limits.maxTokenPathSegments ||
    value.length > DESIGN_TOKEN_PROFILE.limits.maxTokenPathLength
  ) {
    invalid(
      state,
      "INVALID_DTCG_NAME",
      "DTCG token path exceeds the frozen bounded profile.",
      pointer(path),
      value,
    );
  }
}

function validateMetadata(node: MutableObject, path: readonly string[], state: ProjectionState) {
  const location = pointer(path);
  const currentTokenPath = tokenPath(path);
  if (node.$description !== undefined && typeof node.$description !== "string") {
    invalid(
      state,
      "INVALID_DTCG_STRUCTURE",
      "$description must be a string.",
      `${location}/$description`,
      currentTokenPath,
    );
  }
  if (
    node.$deprecated !== undefined &&
    typeof node.$deprecated !== "boolean" &&
    typeof node.$deprecated !== "string"
  ) {
    invalid(
      state,
      "INVALID_DTCG_STRUCTURE",
      "$deprecated must be a boolean or string.",
      `${location}/$deprecated`,
      currentTokenPath,
    );
  }
  if (node.$extensions !== undefined && mutableObject(node.$extensions) === undefined) {
    invalid(
      state,
      "INVALID_DTCG_STRUCTURE",
      "$extensions must be an object.",
      `${location}/$extensions`,
      currentTokenPath,
    );
  }
}

function decodePointer(reference: unknown, path: string, state: ProjectionState): string[] {
  if (typeof reference !== "string" || !reference.startsWith("#/")) {
    invalid(
      state,
      "INVALID_DTCG_STRUCTURE",
      "$ref must be a same-document JSON Pointer fragment.",
      path,
    );
  }
  let decoded: string;
  try {
    decoded = decodeURIComponent(reference.slice(1));
  } catch {
    invalid(state, "INVALID_DTCG_STRUCTURE", "$ref contains invalid URI escaping.", path);
  }
  if (!decoded.startsWith("/") || /~(?:[^01]|$)/u.test(decoded)) {
    invalid(state, "INVALID_DTCG_STRUCTURE", "$ref contains invalid JSON Pointer escaping.", path);
  }
  return decoded
    .slice(1)
    .split("/")
    .map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"));
}

function valueAtSegments(root: unknown, segments: readonly string[]): unknown {
  let current = root;
  for (const segment of segments) {
    if (Array.isArray(current)) {
      if (!/^(?:0|[1-9][0-9]*)$/u.test(segment)) return undefined;
      current = current[Number(segment)];
    } else {
      const object = mutableObject(current);
      if (object === undefined || !Object.hasOwn(object, segment)) return undefined;
      current = object[segment];
    }
  }
  return current;
}

function resolvePointer(
  reference: unknown,
  location: string,
  state: ProjectionState,
): { readonly segments: readonly string[]; readonly value: unknown } {
  const segments = decodePointer(reference, location, state);
  const value = valueAtSegments(state.snapshot, segments);
  if (value === undefined) {
    invalid(
      state,
      "ALIAS_TARGET_MISSING",
      `JSON Pointer target ${JSON.stringify(reference)} does not exist.`,
      location,
    );
  }
  return { segments, value };
}

function clone<Value>(value: Value): Value {
  return JSON.parse(canonicalizeJson(value)) as Value;
}

function indexTokens(
  group: MutableObject,
  path: readonly string[],
  inheritedType: string | undefined,
  state: ProjectionState,
): void {
  const ownType = typeof group.$type === "string" ? group.$type : undefined;
  const effectiveType = ownType ?? inheritedType;
  const root = mutableObject(group.$root);
  if (root !== undefined) {
    const rootPath = [...path, "$root"];
    state.tokenTypes.set(rootPath.join("."), {
      inheritedType: effectiveType,
      node: root,
      path: rootPath,
    });
  }
  for (const [name, child] of Object.entries(group)) {
    if (name.startsWith("$")) continue;
    const object = mutableObject(child);
    if (object === undefined) continue;
    const childPath = [...path, name];
    if (Object.hasOwn(object, "$value") || Object.hasOwn(object, "$ref")) {
      state.tokenTypes.set(childPath.join("."), {
        inheritedType: effectiveType,
        node: object,
        path: childPath,
      });
    } else {
      indexTokens(object, childPath, effectiveType, state);
    }
  }
}

function inferredTokenType(
  entry: IndexedToken,
  state: ProjectionState,
  active: readonly string[] = [],
): string | undefined {
  const key = entry.path.join(".");
  if (active.includes(key)) {
    invalid(
      state,
      "ALIAS_CYCLE",
      `Alias cycle detected while inferring a token type: ${[
        ...active.slice(active.indexOf(key)),
        key,
      ].join(" -> ")}.`,
      `${pointer(entry.path)}/${Object.hasOwn(entry.node, "$ref") ? "$ref" : "$value"}`,
      key,
    );
  }
  if (active.length >= DESIGN_TOKEN_PROFILE.limits.maxAliasDepth) {
    invalid(
      state,
      "RESOLUTION_LIMIT_EXCEEDED",
      `Alias depth exceeds ${DESIGN_TOKEN_PROFILE.limits.maxAliasDepth}.`,
      pointer(entry.path),
      key,
    );
  }
  const ownType = typeof entry.node.$type === "string" ? entry.node.$type : undefined;
  const isReference = isDtcgTokenAlias(entry.node.$value) || Object.hasOwn(entry.node, "$ref");
  const declaredType = isReference ? ownType : (ownType ?? entry.inheritedType);
  let target: IndexedToken | undefined;
  if (isDtcgTokenAlias(entry.node.$value)) {
    target = state.tokenTypes.get(entry.node.$value.slice(1, -1));
  } else if (Object.hasOwn(entry.node, "$ref")) {
    const segments = decodePointer(entry.node.$ref, `${pointer(entry.path)}/$ref`, state);
    if (segments.at(-1) === "$value") {
      target = state.tokenTypes.get(segments.slice(0, -1).join("."));
    }
  }
  if (target === undefined) return declaredType;
  const targetType = inferredTokenType(target, state, [...active, key]);
  if (declaredType !== undefined && targetType !== undefined && declaredType !== targetType) {
    invalid(
      state,
      "ALIAS_TYPE_MISMATCH",
      `Alias ${JSON.stringify(key)} changes type from ${JSON.stringify(declaredType)} to ${JSON.stringify(targetType)}.`,
      `${pointer(entry.path)}/${Object.hasOwn(entry.node, "$ref") ? "$ref" : "$value"}`,
      key,
    );
  }
  return declaredType ?? targetType;
}

function expectedCompositeReferenceType(
  path: readonly string[],
  currentTokenPath: string,
  state: ProjectionState,
): string | undefined {
  const valueIndex = path.indexOf("$value");
  const relative = valueIndex < 0 ? [] : path.slice(valueIndex + 1);
  const type = state.inferredTypes.get(currentTokenPath);
  const first = relative[0];
  const last = relative.at(-1);
  if (type === "typography") {
    if (first === "fontFamily") return "fontFamily";
    if (first === "fontSize" || first === "letterSpacing") return "dimension";
    if (first === "fontWeight") return "fontWeight";
    if (first === "lineHeight") return "number";
  }
  if (type === "border") {
    if (first === "color") return "color";
    if (first === "style") return "strokeStyle";
    if (first === "width") return "dimension";
  }
  if (type === "transition") {
    if (first === "delay" || first === "duration") return "duration";
    if (first === "timingFunction") return "cubicBezier";
  }
  if (type === "shadow") {
    if (last === "color") return "color";
    if (["blur", "offsetX", "offsetY", "spread"].includes(last ?? "")) {
      return "dimension";
    }
    if (relative.length > 0 && relative.every((segment) => /^\d+$/u.test(segment))) {
      return "shadow";
    }
  }
  if (type === "strokeStyle" && first === "dashArray" && relative.length === 2) {
    return "dimension";
  }
  if (type === "gradient") {
    if (relative.length > 0 && relative.every((segment) => /^\d+$/u.test(segment))) {
      return "gradient";
    }
    if (last === "color") return "color";
    if (last === "position") return "number";
  }
  return undefined;
}

function assertReferencedTokenType(
  targetPath: readonly string[],
  expectedType: string | undefined,
  location: string,
  currentTokenPath: string,
  state: ProjectionState,
): void {
  if (expectedType === undefined) {
    invalid(
      state,
      "INVALID_DTCG_STRUCTURE",
      "Curly references are not valid at this token-value location.",
      location,
      currentTokenPath,
    );
  }
  const targetKey = targetPath.join(".");
  const target = state.tokenTypes.get(targetKey);
  const actualType =
    state.inferredTypes.get(targetKey) ??
    (target === undefined ? undefined : inferredTokenType(target, state));
  if (actualType !== expectedType) {
    invalid(
      state,
      "ALIAS_TYPE_MISMATCH",
      `Composite reference expects ${JSON.stringify(expectedType)} but targets ${JSON.stringify(actualType)}.`,
      location,
      currentTokenPath,
    );
  }
}

function arrayReferencePlaceholder(type: string | undefined): unknown {
  if (type === "gradient") {
    return { color: { colorSpace: "srgb", components: [0, 0, 0] }, position: 0 };
  }
  if (type === "shadow") {
    const zero = { unit: "px", value: 0 };
    return {
      blur: zero,
      color: { colorSpace: "srgb", components: [0, 0, 0] },
      offsetX: zero,
      offsetY: zero,
      spread: zero,
    };
  }
  return undefined;
}

function validProjectedGradientStop(value: unknown): boolean {
  const stop = mutableObject(value);
  const color = mutableObject(stop?.color);
  return (
    stop !== undefined &&
    exactKeys(stop, ["color", "position"], []) &&
    color !== undefined &&
    color.colorSpace === "srgb" &&
    Array.isArray(color.components) &&
    color.components.length === 3 &&
    color.components.every(
      (component) => typeof component === "number" && Number.isFinite(component),
    ) &&
    typeof stop.position === "number" &&
    Number.isFinite(stop.position)
  );
}

function validProjectedShadowLayer(value: unknown): boolean {
  const layer = mutableObject(value);
  const color = mutableObject(layer?.color);
  return (
    layer !== undefined &&
    exactKeys(layer, ["blur", "color", "offsetX", "offsetY", "spread"], ["inset"]) &&
    color !== undefined &&
    color.colorSpace === "srgb" &&
    Array.isArray(color.components) &&
    color.components.length === 3 &&
    color.components.every(
      (component) => typeof component === "number" && Number.isFinite(component),
    ) &&
    validDimension(layer.blur) &&
    validDimension(layer.offsetX) &&
    validDimension(layer.offsetY) &&
    validDimension(layer.spread) &&
    (layer.inset === undefined || typeof layer.inset === "boolean")
  );
}

function projectShadowInsets(
  value: unknown,
  valuePath: readonly string[],
  currentTokenPath: string,
  state: ProjectionState,
): void {
  const layers = Array.isArray(value) ? value : [value];
  for (const [index, unresolvedLayer] of layers.entries()) {
    const layer = mutableObject(unresolvedLayer);
    if (layer === undefined || !Object.hasOwn(layer, "inset")) continue;
    const layerPath = Array.isArray(value) ? [...valuePath, String(index)] : valuePath;
    if (typeof layer.inset !== "boolean") {
      invalid(
        state,
        "INVALID_DTCG_VALUE",
        "A reviewed shadow inset must resolve to a boolean.",
        `${pointer(layerPath)}/inset`,
        currentTokenPath,
      );
    }
    record(
      state,
      "SHADOW_INSET",
      "UNSUPPORTED_DTCG_MEMBER",
      "The optional DTCG shadow inset member is outside the frozen T02 profile.",
      `${pointer(layerPath)}/inset`,
      currentTokenPath,
    );
    Reflect.deleteProperty(layer, "inset");
  }
}

function assertNestedArrayReferenceTarget(
  type: string,
  value: unknown,
  path: readonly string[],
  location: string,
  currentTokenPath: string,
  state: ProjectionState,
  active: readonly string[],
): void {
  const projectedReferences = projectPropertyReferences(
    clone(value),
    path,
    currentTokenPath,
    state,
    active,
  );
  const projected = projectNestedColors(projectedReferences, path, currentTokenPath, state);
  const values = Array.isArray(projected) ? projected : [projected];
  const valid =
    values.length > 0 &&
    (type === "gradient"
      ? values.every(validProjectedGradientStop)
      : values.every(validProjectedShadowLayer));
  if (!valid) {
    invalid(
      state,
      "ALIAS_TYPE_MISMATCH",
      `JSON Pointer target is not compatible with the expected ${JSON.stringify(type)} array element.`,
      location,
      currentTokenPath,
    );
  }
}

function projectPropertyReferences(
  value: unknown,
  path: readonly string[],
  currentTokenPath: string,
  state: ProjectionState,
  active: readonly string[] = [],
): unknown {
  if (typeof value === "string" && isDtcgTokenAlias(value)) {
    const identity = `curly:${value}`;
    if (active.includes(identity)) {
      invalid(
        state,
        "ALIAS_CYCLE",
        "A composite token reference cycle is not allowed.",
        pointer(path),
        currentTokenPath,
      );
    }
    if (active.length >= DESIGN_TOKEN_PROFILE.limits.maxAliasDepth) {
      invalid(
        state,
        "RESOLUTION_LIMIT_EXCEEDED",
        `Composite reference depth exceeds ${DESIGN_TOKEN_PROFILE.limits.maxAliasDepth}.`,
        pointer(path),
        currentTokenPath,
      );
    }
    const referencePath = value.slice(1, -1).split(".");
    const target = mutableObject(valueAtSegments(state.snapshot, referencePath));
    if (
      target === undefined ||
      (!Object.hasOwn(target, "$value") && !Object.hasOwn(target, "$ref"))
    ) {
      invalid(
        state,
        "ALIAS_TARGET_MISSING",
        `Composite token target ${JSON.stringify(value)} does not exist.`,
        pointer(path),
        currentTokenPath,
      );
    }
    const expectedType = expectedCompositeReferenceType(path, currentTokenPath, state);
    assertReferencedTokenType(referencePath, expectedType, pointer(path), currentTokenPath, state);
    record(
      state,
      "PROPERTY_LEVEL_REF",
      "UNSUPPORTED_PROPERTY_ALIAS",
      "A valid composite token reference is outside the frozen T02 resolver profile.",
      pointer(path),
      currentTokenPath,
    );
    const arrayPlaceholder = arrayReferencePlaceholder(expectedType);
    if (arrayPlaceholder !== undefined) {
      // Array references resolve as one value and never flatten into the containing array. A safe
      // element-shaped projection keeps that cardinality while the referenced token is validated
      // on its own traversal and the untouched source remains authoritative for export.
      return arrayPlaceholder;
    }
    const targetValue = Object.hasOwn(target, "$value")
      ? target.$value
      : resolvePointer(target.$ref, `${pointer(referencePath)}/$ref`, state).value;
    return projectPropertyReferences(clone(targetValue), path, currentTokenPath, state, [
      ...active,
      identity,
    ]);
  }
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map((entry, index) =>
      projectPropertyReferences(entry, [...path, String(index)], currentTokenPath, state, active),
    );
  }
  const object = value as MutableObject;
  if (Object.hasOwn(object, "$ref")) {
    if (!exactKeys(object, ["$ref"], [])) {
      invalid(
        state,
        "INVALID_DTCG_STRUCTURE",
        "A property reference must contain only $ref.",
        pointer(path),
        currentTokenPath,
      );
    }
    const reference = object.$ref;
    if (typeof reference !== "string") {
      invalid(
        state,
        "INVALID_DTCG_STRUCTURE",
        "A property $ref must be a string.",
        `${pointer(path)}/$ref`,
        currentTokenPath,
      );
    }
    const identity = `pointer:${reference}`;
    if (active.includes(identity)) {
      invalid(
        state,
        "ALIAS_CYCLE",
        "A JSON Pointer property reference cycle is not allowed.",
        `${pointer(path)}/$ref`,
        currentTokenPath,
      );
    }
    if (active.length >= DESIGN_TOKEN_PROFILE.limits.maxAliasDepth) {
      invalid(
        state,
        "RESOLUTION_LIMIT_EXCEEDED",
        `JSON Pointer depth exceeds ${DESIGN_TOKEN_PROFILE.limits.maxAliasDepth}.`,
        `${pointer(path)}/$ref`,
        currentTokenPath,
      );
    }
    const target = resolvePointer(reference, `${pointer(path)}/$ref`, state);
    const expectedType = expectedCompositeReferenceType(path, currentTokenPath, state);
    let validatedWholeToken = false;
    if (target.segments.at(-1) === "$value") {
      const targetPath = target.segments.slice(0, -1);
      if (expectedType !== undefined && state.tokenTypes.has(targetPath.join("."))) {
        assertReferencedTokenType(
          targetPath,
          expectedType,
          `${pointer(path)}/$ref`,
          currentTokenPath,
          state,
        );
        validatedWholeToken = true;
      }
    }
    record(
      state,
      "PROPERTY_LEVEL_REF",
      "UNSUPPORTED_PROPERTY_ALIAS",
      "A valid JSON Pointer property reference is outside the frozen T02 resolver profile.",
      `${pointer(path)}/$ref`,
      currentTokenPath,
    );
    const arrayPlaceholder = arrayReferencePlaceholder(expectedType);
    if (arrayPlaceholder !== undefined) {
      if (!validatedWholeToken && expectedType !== undefined) {
        assertNestedArrayReferenceTarget(
          expectedType,
          target.value,
          path,
          `${pointer(path)}/$ref`,
          currentTokenPath,
          state,
          [...active, identity],
        );
      }
      return arrayPlaceholder;
    }
    return projectPropertyReferences(clone(target.value), path, currentTokenPath, state, [
      ...active,
      identity,
    ]);
  }
  const output: MutableObject = {};
  for (const [key, child] of Object.entries(object)) {
    defineJsonMember(
      output,
      key,
      projectPropertyReferences(child, [...path, key], currentTokenPath, state, active),
    );
  }
  return output;
}

function componentInRange(component: unknown, range: ComponentRange): boolean {
  if (component === "none") return true;
  if (typeof component !== "number" || !Number.isFinite(component)) return false;
  const [minimum, maximum, maximumExclusive] = range;
  return (
    component >= minimum && (maximumExclusive === true ? component < maximum : component <= maximum)
  );
}

function projectColor(
  value: unknown,
  valuePath: readonly string[],
  currentTokenPath: string,
  state: ProjectionState,
): MutableObject {
  const color = mutableObject(value);
  if (
    color === undefined ||
    !exactKeys(color, ["colorSpace", "components"], ["alpha", "hex"]) ||
    typeof color.colorSpace !== "string"
  ) {
    invalid(
      state,
      "INVALID_DTCG_VALUE",
      "A reviewed color must contain colorSpace, components, optional alpha, and optional hex.",
      pointer(valuePath),
      currentTokenPath,
    );
  }
  const ranges = COLOR_COMPONENT_RANGES[color.colorSpace];
  if (
    ranges === undefined ||
    !Array.isArray(color.components) ||
    color.components.length !== 3 ||
    !color.components.every((component, index) => {
      const range = ranges[index];
      return range !== undefined && componentInRange(component, range);
    })
  ) {
    invalid(
      state,
      "INVALID_DTCG_VALUE",
      "Color space and components must match the reviewed DTCG 2025.10 ranges.",
      `${pointer(valuePath)}/components`,
      currentTokenPath,
    );
  }
  if (
    color.alpha !== undefined &&
    (typeof color.alpha !== "number" ||
      !Number.isFinite(color.alpha) ||
      color.alpha < 0 ||
      color.alpha > 1)
  ) {
    invalid(
      state,
      "LIMIT_EXCEEDED",
      "Color alpha must be between zero and one.",
      `${pointer(valuePath)}/alpha`,
      currentTokenPath,
    );
  }
  if (color.hex !== undefined) {
    if (typeof color.hex !== "string" || !/^#[0-9a-fA-F]{6}$/u.test(color.hex)) {
      invalid(
        state,
        "INVALID_DTCG_VALUE",
        "Color hex must use six-digit CSS hex notation.",
        `${pointer(valuePath)}/hex`,
        currentTokenPath,
      );
    }
    record(
      state,
      "OPTIONAL_COLOR_ALPHA_AND_HEX",
      "UNSUPPORTED_DTCG_MEMBER",
      "The optional DTCG color hex fallback is outside the frozen T02 profile.",
      `${pointer(valuePath)}/hex`,
      currentTokenPath,
    );
    delete color.hex;
  }
  if (color.colorSpace !== "srgb") {
    record(
      state,
      "ADDITIONAL_COLOR_SPACES",
      "UNSUPPORTED_COLOR_SPACE",
      `Color space ${JSON.stringify(color.colorSpace)} is outside the frozen T02 profile.`,
      `${pointer(valuePath)}/colorSpace`,
      currentTokenPath,
    );
    color.colorSpace = "srgb";
  }
  color.components = color.components.map((component, index) => {
    if (component !== "none") return color.colorSpace === "srgb" ? component : 0;
    record(
      state,
      "NONE_COLOR_COMPONENTS",
      "UNSUPPORTED_DTCG_MEMBER",
      "The DTCG none color component is outside the frozen T02 profile.",
      `${pointer(valuePath)}/components/${index}`,
      currentTokenPath,
    );
    return 0;
  });
  if (ranges !== UNIT_COMPONENTS && color.colorSpace === "srgb") {
    color.components = [0, 0, 0];
  }
  return color;
}

function validDimension(value: unknown): boolean {
  const dimension = mutableObject(value);
  return (
    dimension !== undefined &&
    exactKeys(dimension, ["unit", "value"], []) &&
    (dimension.unit === "px" || dimension.unit === "rem") &&
    typeof dimension.value === "number" &&
    Number.isFinite(dimension.value)
  );
}

function validateStrokeStyle(
  value: unknown,
  valuePath: readonly string[],
  currentTokenPath: string,
  state: ProjectionState,
): void {
  if (typeof value === "string") {
    if (!STROKE_STYLES.has(value)) {
      invalid(
        state,
        "INVALID_DTCG_VALUE",
        "Stroke style keyword is not in the reviewed DTCG 2025.10 set.",
        pointer(valuePath),
        currentTokenPath,
      );
    }
    return;
  }
  const style = mutableObject(value);
  if (
    style === undefined ||
    !exactKeys(style, ["dashArray", "lineCap"], []) ||
    !Array.isArray(style.dashArray) ||
    style.dashArray.length === 0 ||
    typeof style.lineCap !== "string" ||
    !LINE_CAPS.has(style.lineCap) ||
    !style.dashArray.every((entry) => validDimension(entry))
  ) {
    invalid(
      state,
      "INVALID_DTCG_VALUE",
      "Object stroke styles require a dimension dashArray and a valid lineCap.",
      pointer(valuePath),
      currentTokenPath,
    );
  }
}

function projectNestedColors(
  value: unknown,
  path: readonly string[],
  currentTokenPath: string,
  state: ProjectionState,
): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map((child, index) =>
      projectNestedColors(child, [...path, String(index)], currentTokenPath, state),
    );
  }
  const object = value as MutableObject;
  if (Object.hasOwn(object, "colorSpace") || Object.hasOwn(object, "components")) {
    return projectColor(object, path, currentTokenPath, state);
  }
  for (const [key, child] of Object.entries(object)) {
    defineJsonMember(
      object,
      key,
      projectNestedColors(child, [...path, key], currentTokenPath, state),
    );
  }
  return object;
}

function validateUnsupportedLiteral(
  type: string,
  value: unknown,
  valuePath: readonly string[],
  currentTokenPath: string,
  state: ProjectionState,
): void {
  if (type === "fontFamily") {
    if (
      typeof value !== "string" &&
      (!Array.isArray(value) ||
        value.length === 0 ||
        !value.every((entry) => typeof entry === "string"))
    ) {
      invalid(
        state,
        "INVALID_DTCG_VALUE",
        "fontFamily must be a string or a non-empty string array.",
        pointer(valuePath),
        currentTokenPath,
      );
    }
    return;
  }
  if (type === "fontWeight") {
    if (!(
      (typeof value === "number" && Number.isFinite(value) && value >= 1 && value <= 1000) ||
      (typeof value === "string" && FONT_WEIGHTS.has(value))
    )) {
      invalid(
        state,
        "INVALID_DTCG_VALUE",
        "fontWeight must be 1–1000 or a reviewed standard keyword.",
        pointer(valuePath),
        currentTokenPath,
      );
    }
    return;
  }
  if (type === "strokeStyle") {
    validateStrokeStyle(value, valuePath, currentTokenPath, state);
    return;
  }
  if (type === "gradient") {
    if (!Array.isArray(value) || value.length === 0) {
      invalid(
        state,
        "INVALID_DTCG_VALUE",
        "gradient must be an array of reviewed stop objects.",
        pointer(valuePath),
        currentTokenPath,
      );
    }
    for (const [index, unresolvedStop] of value.entries()) {
      const stop = mutableObject(unresolvedStop);
      if (
        stop === undefined ||
        !exactKeys(stop, ["color", "position"], []) ||
        typeof stop.position !== "number" ||
        !Number.isFinite(stop.position)
      ) {
        invalid(
          state,
          "INVALID_DTCG_VALUE",
          "Each reviewed gradient stop requires a color and finite numeric position.",
          `${pointer(valuePath)}/${index}`,
          currentTokenPath,
        );
      }
      stop.color = projectColor(
        stop.color,
        [...valuePath, String(index), "color"],
        currentTokenPath,
        state,
      );
    }
    return;
  }
  invalid(
    state,
    "INVALID_DTCG_VALUE",
    `Unsupported standard token type ${JSON.stringify(type)} is not in the reviewed projection matrix.`,
    pointer(valuePath),
    currentTokenPath,
  );
}

function projectToken(
  node: MutableObject,
  path: readonly string[],
  inheritedType: string | undefined,
  state: ProjectionState,
): void {
  const currentPointer = pointer(path);
  const currentTokenPath = path.join(".");
  validatePath(path, state);
  state.tokenCount += 1;
  if (state.tokenCount > DESIGN_TOKEN_PROFILE.limits.maxTokenCount) {
    invalid(
      state,
      "LIMIT_EXCEEDED",
      `A DTCG document cannot exceed ${DESIGN_TOKEN_PROFILE.limits.maxTokenCount} tokens.`,
      currentPointer,
      currentTokenPath,
    );
  }
  const allowed = new Set([
    "$deprecated",
    "$description",
    "$extensions",
    "$ref",
    "$type",
    "$value",
  ]);
  if (Object.keys(node).some((key) => !allowed.has(key))) {
    invalid(
      state,
      "INVALID_DTCG_STRUCTURE",
      "A token cannot also contain child groups or unknown reserved members.",
      currentPointer,
      currentTokenPath,
    );
  }
  validateMetadata(node, path, state);
  const hasValue = Object.hasOwn(node, "$value");
  const hasReference = Object.hasOwn(node, "$ref");
  if (hasValue === hasReference) {
    invalid(
      state,
      "INVALID_DTCG_STRUCTURE",
      "A token must contain exactly one of $value or $ref.",
      currentPointer,
      currentTokenPath,
    );
  }
  const ownType = node.$type;
  if (ownType !== undefined && (typeof ownType !== "string" || !STANDARD_TYPES.has(ownType))) {
    invalid(
      state,
      "INVALID_DTCG_VALUE",
      "$type must name a type in the frozen reviewed DTCG 2025.10 matrix.",
      `${currentPointer}/$type`,
      currentTokenPath,
    );
  }
  const effectiveType =
    hasReference || isDtcgTokenAlias(node.$value)
      ? typeof ownType === "string"
        ? ownType
        : state.inferredTypes.get(currentTokenPath)
      : typeof ownType === "string"
        ? ownType
        : inheritedType;
  if (effectiveType !== undefined) state.inferredTypes.set(currentTokenPath, effectiveType);
  if (typeof ownType === "string" && !SUPPORTED_TYPES.has(ownType)) {
    record(
      state,
      "ADDITIONAL_TOKEN_TYPES",
      "UNSUPPORTED_DTCG_TYPE",
      `Standard token type ${JSON.stringify(ownType)} is outside the frozen T02 profile.`,
      `${currentPointer}/$type`,
      currentTokenPath,
    );
    node.$type = "number";
  }
  if (hasReference) {
    const reference = node.$ref;
    const target = resolvePointer(reference, `${currentPointer}/$ref`, state);
    const targetsWholeTokenValue = target.segments.at(-1) === "$value";
    const targetPath = targetsWholeTokenValue ? target.segments.slice(0, -1) : undefined;
    const targetToken =
      targetPath === undefined
        ? undefined
        : mutableObject(valueAtSegments(state.snapshot, targetPath));
    delete node.$ref;
    if (
      targetPath !== undefined &&
      targetPath.length > 0 &&
      targetPath.every((segment) => !segment.includes(".")) &&
      targetToken !== undefined &&
      Object.hasOwn(targetToken, "$value")
    ) {
      node.$value = `{${targetPath.join(".")}}`;
    } else {
      node.$value = projectPropertyReferences(
        clone(target.value),
        [...path, "$value"],
        currentTokenPath,
        state,
        [`pointer:${String(reference)}`],
      );
    }
    record(
      state,
      "JSON_POINTER_REF",
      "UNSUPPORTED_DTCG_MEMBER",
      "A valid whole-token JSON Pointer is outside the frozen T02 resolver profile.",
      `${currentPointer}/$ref`,
      currentTokenPath,
    );
  }
  if (!Object.hasOwn(node, "$value")) return;
  if (isDtcgTokenAlias(node.$value)) {
    if (effectiveType !== undefined && !SUPPORTED_TYPES.has(effectiveType)) node.$type = "number";
    return;
  }
  if (effectiveType === undefined) {
    invalid(
      state,
      "MISSING_DTCG_TYPE",
      "A literal token must declare or inherit a standard $type.",
      currentPointer,
      currentTokenPath,
    );
  }
  const valuePath = [...path, "$value"];
  if (mutableObject(node.$value)?.$ref !== undefined) {
    invalid(
      state,
      "INVALID_DTCG_VALUE",
      "A whole token JSON Pointer uses $ref beside $type, not beneath $value.",
      pointer(valuePath),
      currentTokenPath,
    );
  }
  node.$value = projectPropertyReferences(node.$value, valuePath, currentTokenPath, state);
  node.$value = projectNestedColors(node.$value, valuePath, currentTokenPath, state);
  if (SUPPORTED_TYPES.has(effectiveType)) {
    if (effectiveType === "shadow") {
      projectShadowInsets(node.$value, valuePath, currentTokenPath, state);
    }
    if (effectiveType === "border") {
      const border = mutableObject(node.$value);
      const style = border?.style;
      if (style !== undefined && typeof style !== "string" && !isDtcgTokenAlias(style)) {
        validateStrokeStyle(style, [...valuePath, "style"], currentTokenPath, state);
        if (border !== undefined) border.style = "solid";
        record(
          state,
          "ADDITIONAL_TOKEN_TYPES",
          "UNSUPPORTED_STROKE_STYLE",
          "A valid object stroke style is outside the frozen T02 resolver profile.",
          `${pointer(valuePath)}/style`,
          currentTokenPath,
        );
      }
    }
    return;
  }
  validateUnsupportedLiteral(effectiveType, node.$value, valuePath, currentTokenPath, state);
  if (typeof ownType === "string") node.$type = "number";
  node.$value = 0;
  record(
    state,
    "ADDITIONAL_TOKEN_TYPES",
    "UNSUPPORTED_DTCG_TYPE",
    `Standard token type ${JSON.stringify(effectiveType)} is outside the frozen T02 profile.`,
    `${currentPointer}/$type`,
    currentTokenPath,
  );
}

interface ExtendsDeclaration {
  readonly group: MutableObject;
  readonly location: string;
  readonly member: "$extends" | "$ref";
  readonly path: readonly string[];
  readonly targetPath: readonly string[];
}

function reviewedReferencePath(
  value: unknown,
  location: string,
  state: ProjectionState,
): readonly string[] {
  if (typeof value !== "string") {
    invalid(state, "INVALID_DTCG_STRUCTURE", "A group reference must be a string.", location);
  }
  if (/^\{[^.{}]+(?:\.[^.{}]+)*\}$/u.test(value)) {
    const segments = value.slice(1, -1).split(".");
    if (!segments.every(validName)) {
      invalid(state, "INVALID_DTCG_NAME", "A group reference contains an invalid name.", location);
    }
    return segments;
  }
  if (value.startsWith("#/")) return decodePointer(value, location, state);
  invalid(
    state,
    "INVALID_DTCG_STRUCTURE",
    "A group reference must use curly token-path or same-document JSON Pointer syntax.",
    location,
  );
}

function isGroupObject(value: unknown): value is MutableObject {
  const object = mutableObject(value);
  return object !== undefined && !Object.hasOwn(object, "$value");
}

function groupReferenceTarget(
  group: MutableObject,
  path: readonly string[],
  state: ProjectionState,
): readonly string[] | undefined {
  if (!Object.hasOwn(group, "$ref") || Object.hasOwn(group, "$value")) return undefined;
  const location = `${pointer(path)}/$ref`;
  const reference = group.$ref;
  if (typeof reference !== "string" || !reference.startsWith("#/")) {
    // Curly syntax belongs in $value. Group-level $ref is the JSON-Schema-equivalent
    // spelling defined by DTCG group extension semantics.
    return undefined;
  }
  const segments = decodePointer(reference, location, state);
  if (segments.some((segment) => segment.startsWith("$"))) return undefined;
  const target = valueAtSegments(state.snapshot, segments);
  return isGroupObject(target) ? segments : undefined;
}

function collectExtends(
  group: MutableObject,
  path: readonly string[],
  state: ProjectionState,
  declarations: ExtendsDeclaration[],
): void {
  if (Object.hasOwn(group, "$extends") && Object.hasOwn(group, "$ref")) {
    invalid(
      state,
      "INVALID_DTCG_STRUCTURE",
      "A group cannot declare both $extends and $ref.",
      pointer(path),
    );
  }
  const groupRefPath = groupReferenceTarget(group, path, state);
  if (Object.hasOwn(group, "$extends") || groupRefPath !== undefined) {
    const member = Object.hasOwn(group, "$extends") ? "$extends" : "$ref";
    const location = `${pointer(path)}/${member}`;
    const targetPath =
      member === "$extends" ? reviewedReferencePath(group.$extends, location, state) : groupRefPath;
    if (targetPath === undefined) {
      invalid(state, "INVALID_DTCG_STRUCTURE", "A group $ref must target a group.", location);
    }
    declarations.push({
      group,
      location,
      member,
      path,
      targetPath,
    });
    state.extendedGroups.add(group);
    record(
      state,
      "GROUP_EXTENDS",
      "UNSUPPORTED_DTCG_MEMBER",
      "Valid group inheritance is retained but outside the frozen T02 resolver profile.",
      location,
      path.length === 0 ? undefined : path.join("."),
    );
  }
  for (const [name, child] of Object.entries(group)) {
    if (name.startsWith("$")) continue;
    const object = mutableObject(child);
    if (
      object !== undefined &&
      !Object.hasOwn(object, "$value") &&
      (!Object.hasOwn(object, "$ref") || groupReferenceTarget(object, [...path, name], state))
    ) {
      collectExtends(object, [...path, name], state, declarations);
    }
  }
}

function mergeResolvedGroups(base: MutableObject, local: MutableObject): MutableObject {
  const output = clone(base);
  for (const [key, value] of Object.entries(local)) {
    if (key === "$extends" || key === "$ref") continue;
    const prior = Object.hasOwn(output, key) ? output[key] : undefined;
    if (
      !key.startsWith("$") &&
      isGroupObject(prior) &&
      !Object.hasOwn(prior, "$ref") &&
      isGroupObject(value) &&
      !Object.hasOwn(value, "$ref")
    ) {
      defineJsonMember(output, key, mergeResolvedGroups(prior, value));
    } else {
      defineJsonMember(output, key, clone(value));
    }
  }
  return output;
}

function pathIsPrefix(left: readonly string[], right: readonly string[]): boolean {
  return left.length <= right.length && left.every((segment, index) => right[index] === segment);
}

function projectExtends(document: MutableObject, state: ProjectionState): void {
  const declarations: ExtendsDeclaration[] = [];
  collectExtends(document, [], state, declarations);
  const byPath = new Map(declarations.map((entry) => [entry.path.join("."), entry]));
  const active: string[] = [];
  const visited = new Set<string>();
  function visit(entry: ExtendsDeclaration): void {
    const key = entry.path.join(".");
    if (visited.has(key)) return;
    if (active.includes(key)) {
      invalid(
        state,
        "ALIAS_CYCLE",
        `Group extension cycle detected: ${[...active.slice(active.indexOf(key)), key].join(" -> ")}.`,
        entry.location,
      );
    }
    if (active.length >= DESIGN_TOKEN_PROFILE.limits.maxAliasDepth) {
      invalid(
        state,
        "RESOLUTION_LIMIT_EXCEEDED",
        `Group extension depth exceeds ${DESIGN_TOKEN_PROFILE.limits.maxAliasDepth}.`,
        entry.location,
      );
    }
    if (pathIsPrefix(entry.path, entry.targetPath) || pathIsPrefix(entry.targetPath, entry.path)) {
      invalid(
        state,
        "ALIAS_CYCLE",
        "A group cannot extend itself or one of its ancestors or descendants.",
        entry.location,
      );
    }
    const target = valueAtSegments(document, entry.targetPath);
    if (!isGroupObject(target)) {
      invalid(
        state,
        "ALIAS_TARGET_MISSING",
        `Group extension target ${JSON.stringify(entry.targetPath.join("."))} does not exist.`,
        entry.location,
      );
    }
    active.push(key);
    for (const descendant of declarations) {
      if (
        descendant !== entry &&
        pathIsPrefix(entry.path, descendant.path) &&
        descendant.path.length > entry.path.length
      ) {
        visit(descendant);
      }
    }
    const targetEntry = byPath.get(entry.targetPath.join("."));
    if (targetEntry !== undefined) visit(targetEntry);
    const resolvedTarget = valueAtSegments(document, entry.targetPath);
    if (!isGroupObject(resolvedTarget)) {
      invalid(
        state,
        "ALIAS_TARGET_MISSING",
        "Resolved group extension target is invalid.",
        entry.location,
      );
    }
    const merged = mergeResolvedGroups(resolvedTarget, entry.group);
    for (const member of Object.keys(entry.group)) Reflect.deleteProperty(entry.group, member);
    for (const [member, value] of Object.entries(merged)) {
      defineJsonMember(entry.group, member, value);
    }
    active.pop();
    visited.add(key);
  }
  for (const entry of declarations.toSorted(
    (left, right) => right.path.length - left.path.length,
  )) {
    visit(entry);
  }
  state.snapshot = clone(document);
}

function projectGroup(
  group: MutableObject,
  path: readonly string[],
  inheritedType: string | undefined,
  state: ProjectionState,
): boolean {
  validateMetadata(group, path, state);
  const allowed = new Set(["$deprecated", "$description", "$extensions", "$root", "$type"]);
  for (const key of Object.keys(group).filter((name) => name.startsWith("$"))) {
    if (!allowed.has(key)) {
      invalid(
        state,
        "INVALID_DTCG_STRUCTURE",
        `Unknown DTCG group member ${JSON.stringify(key)}.`,
        `${pointer(path)}/${escapePointerSegment(key)}`,
      );
    }
  }
  const ownType = group.$type;
  if (ownType !== undefined && (typeof ownType !== "string" || !STANDARD_TYPES.has(ownType))) {
    invalid(
      state,
      "INVALID_DTCG_VALUE",
      "$type must name a type in the frozen reviewed DTCG 2025.10 matrix.",
      `${pointer(path)}/$type`,
    );
  }
  const effectiveType = typeof ownType === "string" ? ownType : inheritedType;
  if (typeof ownType === "string" && !SUPPORTED_TYPES.has(ownType)) {
    record(
      state,
      "ADDITIONAL_TOKEN_TYPES",
      "UNSUPPORTED_DTCG_TYPE",
      `Standard group type ${JSON.stringify(ownType)} is outside the frozen T02 profile.`,
      `${pointer(path)}/$type`,
      tokenPath(path),
    );
    group.$type = "number";
  }
  if (Object.hasOwn(group, "$root")) {
    const root = mutableObject(group.$root);
    if (root === undefined) {
      invalid(
        state,
        "INVALID_DTCG_STRUCTURE",
        "$root must contain a token object.",
        `${pointer(path)}/$root`,
      );
    }
    projectToken(root, [...path, "$root"], effectiveType, state);
  }
  let children = 0;
  const originalChildCount = Object.keys(group).filter((name) => !name.startsWith("$")).length;
  for (const [name, child] of Object.entries(group)) {
    if (name.startsWith("$")) continue;
    if (!validName(name)) {
      invalid(
        state,
        "INVALID_DTCG_NAME",
        `Invalid DTCG token or group name ${JSON.stringify(name)}.`,
        `${pointer(path)}/${escapePointerSegment(name)}`,
      );
    }
    const object = mutableObject(child);
    if (object === undefined) {
      invalid(
        state,
        "INVALID_DTCG_STRUCTURE",
        "DTCG group children must be objects.",
        `${pointer(path)}/${escapePointerSegment(name)}`,
      );
    }
    const childPath = [...path, name];
    validatePath(childPath, state);
    if (Object.hasOwn(object, "$value") || Object.hasOwn(object, "$ref")) {
      projectToken(object, childPath, effectiveType, state);
      children += 1;
    } else if (projectGroup(object, childPath, effectiveType, state)) {
      children += 1;
    } else {
      Reflect.deleteProperty(group, name);
    }
  }
  if (children > 0 || Object.hasOwn(group, "$root")) return true;
  if (originalChildCount === 0 && path.length === 0 && !state.extendedGroups.has(group)) {
    invalid(state, "EMPTY_DTCG_GROUP", "A token source root cannot be empty.", "");
  }
  if (originalChildCount === 0 && !state.extendedGroups.has(group)) {
    record(
      state,
      "EMPTY_GROUP",
      "EMPTY_DTCG_GROUP",
      "A valid empty DTCG group is retained but outside the frozen T02 profile.",
      pointer(path),
      tokenPath(path),
    );
  }
  return false;
}

function looksLikeResolverDocument(document: MutableObject): boolean {
  return (
    typeof document.version === "string" &&
    Array.isArray(document.resolutionOrder) &&
    (Object.hasOwn(document, "modifiers") || Object.hasOwn(document, "sets"))
  );
}

function validResolverUriReference(reference: string): boolean {
  if (
    reference.length === 0 ||
    !/^(?:[A-Za-z0-9._~!$&'()*+,;=:@/?#-]|%[0-9A-Fa-f]{2})+$/u.test(reference)
  ) {
    return false;
  }
  const firstFragment = reference.indexOf("#");
  if (firstFragment >= 0 && reference.indexOf("#", firstFragment + 1) >= 0) return false;
  const beforeFragment = firstFragment < 0 ? reference : reference.slice(0, firstFragment);
  const firstQuery = beforeFragment.indexOf("?");
  if (firstQuery >= 0 && beforeFragment.indexOf("?", firstQuery + 1) >= 0) return false;
  if (reference.startsWith("#")) return reference.startsWith("#/");
  const firstSegment = beforeFragment.split("/", 1)[0] ?? "";
  const colon = firstSegment.indexOf(":");
  return colon < 0 || /^[A-Za-z][A-Za-z0-9+.-]*:/u.test(firstSegment);
}

function validateResolverDocument(document: MutableObject, state: ProjectionState): void {
  const allowedRootMembers = new Set([
    "$defs",
    "$extensions",
    "description",
    "modifiers",
    "name",
    "resolutionOrder",
    "sets",
    "version",
  ]);
  const hasModifiers = Object.hasOwn(document, "modifiers");
  const hasSets = Object.hasOwn(document, "sets");
  const modifierDefinitions = mutableObject(document.modifiers);
  const setDefinitions = mutableObject(document.sets);
  if (
    (document.version !== "2025-10-01" && document.version !== "2025-11-01") ||
    !Array.isArray(document.resolutionOrder) ||
    document.resolutionOrder.length === 0 ||
    (!hasModifiers && !hasSets) ||
    (hasModifiers && modifierDefinitions === undefined) ||
    (hasSets && setDefinitions === undefined) ||
    Object.keys(document).some((key) => !allowedRootMembers.has(key)) ||
    (document.name !== undefined && typeof document.name !== "string") ||
    (document.description !== undefined && typeof document.description !== "string") ||
    (document.$extensions !== undefined && mutableObject(document.$extensions) === undefined) ||
    (document.$defs !== undefined && mutableObject(document.$defs) === undefined)
  ) {
    invalid(
      state,
      "INVALID_DTCG_STRUCTURE",
      "The reviewed Resolver document requires a pinned version, resolutionOrder, and modifiers or sets.",
      "",
    );
  }
  function validateSource(sourceValue: unknown, location: string): void {
    const source = mutableObject(sourceValue);
    if (source === undefined) {
      invalid(state, "INVALID_DTCG_STRUCTURE", "Resolver sources must be objects.", location);
    }
    if (Object.hasOwn(source, "$ref")) {
      if (!exactKeys(source, ["$ref"], [])) {
        invalid(
          state,
          "INVALID_DTCG_STRUCTURE",
          "A reviewed Resolver source reference must contain only $ref.",
          location,
        );
      }
      if (typeof source.$ref !== "string" || !validResolverUriReference(source.$ref)) {
        invalid(
          state,
          "INVALID_DTCG_STRUCTURE",
          "A reviewed Resolver source $ref must be a valid URI reference.",
          `${location}/$ref`,
        );
      }
      if (source.$ref.startsWith("#/")) {
        const target = resolvePointer(source.$ref, `${location}/$ref`, state);
        if (target.segments[0] !== "sets" || target.segments.length !== 2) {
          invalid(
            state,
            "INVALID_DTCG_STRUCTURE",
            "A Resolver source may reference a same-document set but not a modifier or resolution order.",
            `${location}/$ref`,
          );
        }
      }
      return;
    }
    if (looksLikeResolverDocument(source)) {
      invalid(
        state,
        "INVALID_DTCG_STRUCTURE",
        "A Resolver source must be a DTCG token document or URI reference, not another Resolver document.",
        location,
      );
    }
    const nested = projectReviewedDtcgCompatibility(clone(source), state.sourceId);
    if (!nested.ok) {
      invalid(
        state,
        nested.cause.code,
        `Invalid inline Resolver token source: ${nested.cause.message}`,
        `${location}${nested.cause.pointer}`,
        nested.cause.tokenPath,
      );
    }
    if (nested.features.length > 64) {
      invalid(
        state,
        "LIMIT_EXCEEDED",
        "An inline Resolver token source exceeds the reviewed unsupported-feature limit.",
        location,
      );
    }
  }
  const sets = setDefinitions;
  if (sets !== undefined) {
    for (const [name, setValue] of Object.entries(sets)) {
      const set = mutableObject(setValue);
      if (
        name.length === 0 ||
        set === undefined ||
        !exactKeys(set, ["sources"], ["$extensions", "description"]) ||
        !Array.isArray(set.sources) ||
        (set.description !== undefined && typeof set.description !== "string") ||
        (set.$extensions !== undefined && mutableObject(set.$extensions) === undefined)
      ) {
        invalid(
          state,
          "INVALID_DTCG_STRUCTURE",
          `Resolver set ${JSON.stringify(name)} is malformed.`,
          `/sets/${escapePointerSegment(name)}`,
        );
      }
      for (const [index, source] of set.sources.entries()) {
        validateSource(source, `/sets/${escapePointerSegment(name)}/sources/${index}`);
      }
    }
    const visited = new Set<string>();
    const active: string[] = [];
    function visitSet(name: string): void {
      if (visited.has(name)) return;
      if (active.includes(name)) {
        invalid(
          state,
          "ALIAS_CYCLE",
          `Resolver set cycle detected: ${[...active.slice(active.indexOf(name)), name].join(" -> ")}.`,
          `/sets/${escapePointerSegment(name)}`,
        );
      }
      if (active.length >= DESIGN_TOKEN_PROFILE.limits.maxAliasDepth) {
        invalid(
          state,
          "RESOLUTION_LIMIT_EXCEEDED",
          `Resolver set depth exceeds ${DESIGN_TOKEN_PROFILE.limits.maxAliasDepth}.`,
          `/sets/${escapePointerSegment(name)}`,
        );
      }
      const set = mutableObject(sets?.[name]);
      if (set === undefined || !Array.isArray(set.sources)) return;
      active.push(name);
      for (const sourceValue of set.sources) {
        const source = mutableObject(sourceValue);
        if (typeof source?.$ref !== "string" || !source.$ref.startsWith("#/sets/")) continue;
        const target = decodePointer(
          source.$ref,
          `/sets/${escapePointerSegment(name)}/sources/$ref`,
          state,
        );
        if (target.length === 2 && target[0] === "sets" && target[1] !== undefined) {
          visitSet(target[1]);
        }
      }
      active.pop();
      visited.add(name);
    }
    for (const name of Object.keys(sets)) visitSet(name);
  }
  const modifiers = modifierDefinitions;
  if (modifiers !== undefined) {
    for (const [name, modifierValue] of Object.entries(modifiers)) {
      const modifier = mutableObject(modifierValue);
      const contexts = mutableObject(modifier?.contexts);
      if (
        name.length === 0 ||
        modifier === undefined ||
        contexts === undefined ||
        Object.keys(contexts).length < 2 ||
        !Object.values(contexts).every(Array.isArray) ||
        !exactKeys(modifier, ["contexts"], ["$extensions", "default", "description"]) ||
        (modifier.description !== undefined && typeof modifier.description !== "string") ||
        (modifier.$extensions !== undefined && mutableObject(modifier.$extensions) === undefined) ||
        (modifier.default !== undefined &&
          (typeof modifier.default !== "string" || !Object.hasOwn(contexts, modifier.default)))
      ) {
        invalid(
          state,
          "INVALID_DTCG_STRUCTURE",
          `Resolver modifier ${JSON.stringify(name)} is malformed.`,
          `/modifiers/${escapePointerSegment(name)}`,
        );
      }
      for (const [contextName, sources] of Object.entries(contexts)) {
        if (contextName.length === 0 || !Array.isArray(sources)) {
          invalid(
            state,
            "INVALID_DTCG_STRUCTURE",
            `Resolver context ${JSON.stringify(contextName)} is malformed.`,
            `/modifiers/${escapePointerSegment(name)}/contexts/${escapePointerSegment(contextName)}`,
          );
        }
        for (const [index, source] of sources.entries()) {
          validateSource(
            source,
            `/modifiers/${escapePointerSegment(name)}/contexts/${escapePointerSegment(contextName)}/${index}`,
          );
        }
      }
    }
  }
  for (const [index, orderValue] of document.resolutionOrder.entries()) {
    const order = mutableObject(orderValue);
    if (order === undefined || !exactKeys(order, ["$ref"], [])) {
      invalid(
        state,
        "INVALID_DTCG_STRUCTURE",
        "Resolver resolutionOrder entries must contain one $ref.",
        `/resolutionOrder/${index}`,
      );
    }
    const target = resolvePointer(order.$ref, `/resolutionOrder/${index}/$ref`, state);
    if (
      target.segments.length !== 2 ||
      (target.segments[0] !== "sets" && target.segments[0] !== "modifiers")
    ) {
      invalid(
        state,
        "INVALID_DTCG_STRUCTURE",
        "resolutionOrder references must target a declared set or modifier.",
        `/resolutionOrder/${index}/$ref`,
      );
    }
  }
}

/**
 * Project only the frozen, reviewed DTCG 2025.10 compatibility matrix into the T02 validator.
 * The caller retains the original document; this function mutates only its bounded validation copy.
 */
export function projectReviewedDtcgCompatibility(
  document: unknown,
  sourceId: string,
): ReviewedDtcgCompatibilityProjection {
  const root = mutableObject(document);
  if (root === undefined) {
    return {
      cause: diagnostic(
        "INVALID_DTCG",
        "INVALID_DTCG_STRUCTURE",
        "A DTCG source document must be an object.",
        "",
        sourceId,
      ),
      ok: false,
    };
  }
  const state: ProjectionState = {
    extendedGroups: new WeakSet(),
    features: [],
    snapshot: clone(root),
    sourceId,
    tokenCount: 0,
    inferredTypes: new Map(),
    tokenTypes: new Map(),
  };
  try {
    if (looksLikeResolverDocument(root)) {
      validateResolverDocument(root, state);
      record(
        state,
        "RESOLVER_THEMES_AND_MODES",
        "UNSUPPORTED_DTCG_MEMBER",
        "A reviewed DTCG Resolver document is not a token document and has no T02 preview authority.",
        "",
      );
      return Object.freeze({ features: Object.freeze(state.features), ok: true, omitSource: true });
    }
    projectExtends(root, state);
    indexTokens(state.snapshot, [], undefined, state);
    const nonEmpty = projectGroup(root, [], undefined, state);
    return Object.freeze({
      features: Object.freeze(state.features),
      ok: true,
      omitSource: !nonEmpty,
    });
  } catch (error) {
    if (error instanceof ReviewedCompatibilityFeatureLimit) {
      return Object.freeze({ features: Object.freeze(state.features), ok: true, omitSource: true });
    }
    if (error instanceof ReviewedCompatibilityError) {
      return Object.freeze({ cause: error.diagnostic, ok: false });
    }
    throw error;
  }
}
