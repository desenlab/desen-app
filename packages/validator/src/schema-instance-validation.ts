import {
  appendJsonPointer,
  createJsonPointer,
  isJsonPointer,
  parseJsonPointer,
} from "@desen/protocol";

import { resolveUriReference } from "./uri-reference.js";

import type { JsonPointer } from "@desen/protocol";

type JsonSchema = boolean | SchemaObject;

type SchemaObject = Readonly<Record<string, unknown>>;

type EvaluationStatus = "invalid" | "unknown" | "valid";

interface Evaluation {
  readonly status: EvaluationStatus;
  readonly issues: SchemaContractIssue[];
  readonly evaluatedProperties: Set<string>;
  readonly evaluatedItems: Set<number>;
}

interface EvaluationAccumulator {
  unknown: boolean;
  readonly issues: SchemaContractIssue[];
  readonly evaluatedProperties: Set<string>;
  readonly evaluatedItems: Set<number>;
}

interface SchemaResource {
  readonly root: JsonSchema;
  readonly uri: string;
  readonly pointers: Map<JsonPointer, JsonSchema>;
  readonly anchors: Map<string, JsonSchema>;
  readonly dynamicAnchors: Map<string, JsonSchema>;
}

interface SchemaLocation {
  readonly schema: JsonSchema;
  readonly resource: SchemaResource;
  readonly pointer: JsonPointer;
}

interface ResourceLocation {
  readonly resource: SchemaResource;
  readonly pointer: JsonPointer;
}

interface SchemaRegistry {
  readonly root: SchemaResource;
  readonly resourceBySchema: WeakMap<object, SchemaResource>;
  readonly resourceByUri: Map<string, SchemaResource>;
  readonly locations: SchemaLocation[];
  readonly graphIssues: SchemaContractGraphIssue[];
}

interface DynamicAnalysis {
  readonly obligations: readonly SchemaContractObligation[];
  readonly subtreeContainsDynamic: WeakMap<object, boolean>;
}

interface EvaluationState {
  readonly mode: SchemaContractMode;
  readonly registry: SchemaRegistry;
  readonly dynamics: DynamicAnalysis;
  readonly activeEvaluations: Set<string>;
  readonly dynamicScope: SchemaResource[];
  readonly schemaIds: WeakMap<object, number>;
  evaluationSteps: number;
  evaluationBudgetIssue?: SchemaContractIssue;
  nextSchemaId: number;
}

interface ResolvedSchema {
  readonly schema: JsonSchema;
  readonly resource: SchemaResource;
}

const ROOT_POINTER = createJsonPointer();
const INTERNAL_SCHEMA_ROOT_URI = "https://desen.invalid/schema/root";
const SINGLE_SCHEMA_KEYWORDS = Object.freeze([
  "additionalProperties",
  "contains",
  "contentSchema",
  "else",
  "if",
  "items",
  "not",
  "propertyNames",
  "then",
  "unevaluatedItems",
  "unevaluatedProperties",
] as const);
const ARRAY_SCHEMA_KEYWORDS = Object.freeze(["allOf", "anyOf", "oneOf", "prefixItems"] as const);
const MAP_SCHEMA_KEYWORDS = Object.freeze([
  "$defs",
  "definitions",
  "dependentSchemas",
  "patternProperties",
  "properties",
] as const);
const EVALUATED_SINGLE_SCHEMA_KEYWORDS = Object.freeze([
  "additionalProperties",
  "contains",
  "else",
  "if",
  "items",
  "not",
  "propertyNames",
  "then",
  "unevaluatedItems",
  "unevaluatedProperties",
] as const);
const EVALUATED_ARRAY_SCHEMA_KEYWORDS = ARRAY_SCHEMA_KEYWORDS;
const EVALUATED_MAP_SCHEMA_KEYWORDS = Object.freeze([
  "dependentSchemas",
  "patternProperties",
  "properties",
] as const);

/** Maximum embedded-schema nesting accepted before recursive T06/T08 work begins. */
export const MAX_SCHEMA_GRAPH_DEPTH = 128;

/** Deterministic resource limits for the internal T08 schema-contract host profile. */
export const SCHEMA_CONTRACT_SAFETY_LIMITS = Object.freeze({
  maxSchemaDepth: MAX_SCHEMA_GRAPH_DEPTH,
  maxSchemaNodes: 4_096,
  maxReferences: 4_096,
  maxPatterns: 64,
  maxPatternCodeUnits: 256,
  maxPatternTokens: 128,
  maxPatternQuantifier: 1_024,
  maxPatternExpandedWidth: 4_096,
  maxUnanchoredFixedPatternWidth: 16,
  maxAggregatePatternCodeUnits: 4_096,
  maxEvaluationSteps: 50_000,
} as const);

const {
  maxSchemaNodes: MAX_SCHEMA_GRAPH_NODES,
  maxReferences: MAX_SCHEMA_GRAPH_REFERENCES,
  maxPatterns: MAX_SCHEMA_GRAPH_PATTERNS,
  maxPatternCodeUnits: MAX_PATTERN_CODE_UNITS,
  maxPatternTokens: MAX_PATTERN_TOKENS,
  maxPatternQuantifier: MAX_PATTERN_QUANTIFIER,
  maxPatternExpandedWidth: MAX_PATTERN_EXPANDED_WIDTH,
  maxUnanchoredFixedPatternWidth: MAX_UNANCHORED_FIXED_PATTERN_WIDTH,
  maxAggregatePatternCodeUnits: MAX_SCHEMA_GRAPH_PATTERN_CODE_UNITS,
  maxEvaluationSteps: MAX_SCHEMA_EVALUATION_STEPS,
} = SCHEMA_CONTRACT_SAFETY_LIMITS;

/** Selects whether the supplied object is a complete value or a partial property patch. */
export type SchemaContractMode = "complete" | "patch";

/** One deterministic, value-relative failure produced while applying a JSON Schema contract. */
export interface SchemaContractIssue {
  /** Separates undeclared properties from all other schema mismatches. */
  readonly kind: "unknown-property" | "mismatch";
  /** RFC 6901 JSON Pointer relative to the value passed to {@link applySchemaContract}. */
  readonly pointer: JsonPointer;
  /** Draft 2020-12 keyword responsible for the failure. */
  readonly keyword: string;
}

/** Marks one DESEN ValueSpec whose resolved runtime value cannot be proven statically. */
export interface SchemaContractObligation {
  /** RFC 6901 JSON Pointer to the `$ref`, `$token`, or `$format` value root. */
  readonly pointer: JsonPointer;
}

/** Immutable result of applying one embedded JSON Schema to a literal or partial DESEN value. */
export interface SchemaContractResult {
  /** Sorted, de-duplicated definite contract failures. */
  readonly issues: readonly SchemaContractIssue[];
  /** Sorted, de-duplicated dynamic-value roots that require later resolution and validation. */
  readonly obligations: readonly SchemaContractObligation[];
}

/** One deterministic catalog-preparation failure in an embedded schema graph. */
export interface SchemaContractGraphIssue {
  /** RFC 6901 pointer relative to the embedded schema root. */
  readonly pointer: JsonPointer;
  /** Schema keyword whose graph edge, anchor, pattern, or bounded profile failed. */
  readonly keyword: string;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asSchema(value: unknown): JsonSchema | undefined {
  return typeof value === "boolean" || isObject(value) ? value : undefined;
}

function schemaShapeIssue(schema: JsonSchema): SchemaContractGraphIssue | undefined {
  const pending: Readonly<{ depth: number; schema: JsonSchema }>[] = [{ depth: 0, schema }];
  const visited = new WeakSet<object>();
  let nodeCount = 0;

  const pushChild = (value: unknown, depth: number): void => {
    const child = asSchema(value);
    if (child !== undefined) pending.push({ depth, schema: child });
  };

  while (pending.length > 0) {
    const current = pending.pop() as Readonly<{ depth: number; schema: JsonSchema }>;
    if (typeof current.schema !== "boolean") {
      if (visited.has(current.schema)) continue;
      visited.add(current.schema);
    }
    nodeCount += 1;
    if (nodeCount > MAX_SCHEMA_GRAPH_NODES) {
      return { pointer: ROOT_POINTER, keyword: "schemaGraphSize" };
    }
    if (current.depth > MAX_SCHEMA_GRAPH_DEPTH) {
      return { pointer: ROOT_POINTER, keyword: "schemaGraphDepth" };
    }
    if (typeof current.schema === "boolean") continue;

    const childDepth = current.depth + 1;
    for (const keyword of SINGLE_SCHEMA_KEYWORDS) {
      pushChild(current.schema[keyword], childDepth);
    }
    for (const keyword of ARRAY_SCHEMA_KEYWORDS) {
      const children = current.schema[keyword];
      if (!Array.isArray(children)) continue;
      for (let index = children.length - 1; index >= 0; index -= 1) {
        pushChild(children[index], childDepth);
      }
    }
    for (const keyword of MAP_SCHEMA_KEYWORDS) {
      const children = current.schema[keyword];
      if (!isObject(children)) continue;
      const names = sortedKeys(children);
      for (let index = names.length - 1; index >= 0; index -= 1) {
        pushChild(children[names[index] as string], childDepth);
      }
    }
  }

  return undefined;
}

function sortedKeys(value: object): readonly string[] {
  return Object.keys(value).sort(compareText);
}

function appendPath(pointer: JsonPointer, ...segments: readonly (number | string)[]): JsonPointer {
  return segments.reduce<JsonPointer>(
    (current, segment) => appendJsonPointer(current, segment),
    pointer,
  );
}

function issue(
  kind: SchemaContractIssue["kind"],
  pointer: JsonPointer,
  keyword: string,
): SchemaContractIssue {
  return { kind, pointer, keyword };
}

function emptyEvaluation(status: EvaluationStatus = "valid"): Evaluation {
  return {
    status,
    issues: [],
    evaluatedProperties: new Set<string>(),
    evaluatedItems: new Set<number>(),
  };
}

function accumulator(): EvaluationAccumulator {
  return {
    unknown: false,
    issues: [],
    evaluatedProperties: new Set<string>(),
    evaluatedItems: new Set<number>(),
  };
}

function finishEvaluation(result: EvaluationAccumulator): Evaluation {
  return {
    status: result.issues.length > 0 ? "invalid" : result.unknown ? "unknown" : "valid",
    issues: result.issues,
    evaluatedProperties: result.evaluatedProperties,
    evaluatedItems: result.evaluatedItems,
  };
}

function mergeStatus(result: EvaluationAccumulator, child: Evaluation): void {
  if (child.status === "invalid") result.issues.push(...child.issues);
  if (child.status === "unknown") result.unknown = true;
}

function mergeSameInstance(result: EvaluationAccumulator, child: Evaluation): void {
  mergeStatus(result, child);
  child.evaluatedProperties.forEach((name) => result.evaluatedProperties.add(name));
  child.evaluatedItems.forEach((index) => result.evaluatedItems.add(index));
}

function addMismatch(result: EvaluationAccumulator, pointer: JsonPointer, keyword: string): void {
  result.issues.push(issue("mismatch", pointer, keyword));
}

function isDynamicValueRoot(value: unknown): boolean {
  if (!isObject(value)) return false;
  return (
    (Object.hasOwn(value, "$ref") && typeof value.$ref === "string") ||
    (Object.hasOwn(value, "$token") && typeof value.$token === "string") ||
    (Object.hasOwn(value, "$format") && isObject(value.$format))
  );
}

function analyzeDynamicValues(value: unknown): DynamicAnalysis {
  const obligations: SchemaContractObligation[] = [];
  const subtreeContainsDynamic = new WeakMap<object, boolean>();
  const visiting = new WeakSet<object>();

  const visit = (current: unknown, pointer: JsonPointer): boolean => {
    if (typeof current !== "object" || current === null) return false;
    if (isDynamicValueRoot(current)) {
      obligations.push({ pointer });
      subtreeContainsDynamic.set(current, true);
      return true;
    }
    if (visiting.has(current)) return true;
    const cached = subtreeContainsDynamic.get(current);
    if (cached !== undefined) return cached;

    visiting.add(current);
    let containsDynamic = false;
    if (Array.isArray(current)) {
      current.forEach((child, index) => {
        if (visit(child, appendJsonPointer(pointer, index))) containsDynamic = true;
      });
    } else {
      const record = current as Readonly<Record<string, unknown>>;
      for (const key of sortedKeys(record)) {
        if (visit(record[key], appendJsonPointer(pointer, key))) containsDynamic = true;
      }
    }
    visiting.delete(current);
    subtreeContainsDynamic.set(current, containsDynamic);
    return containsDynamic;
  };

  visit(value, ROOT_POINTER);
  const normalized = [...new Map(obligations.map((entry) => [entry.pointer, entry])).values()]
    .sort((left, right) => compareText(left.pointer, right.pointer))
    .map((entry) => Object.freeze({ pointer: entry.pointer }));
  return {
    obligations: Object.freeze(normalized),
    subtreeContainsDynamic,
  };
}

function containsDynamic(value: unknown, analysis: DynamicAnalysis): boolean {
  return typeof value === "object" && value !== null
    ? (analysis.subtreeContainsDynamic.get(value) ?? false)
    : false;
}

function normalizeResourceUri(identifier: string, parentUri: string): string | undefined {
  const fragment = identifier.indexOf("#");
  if (fragment >= 0 && fragment !== identifier.length - 1) return undefined;
  return resolveUriReference(fragment < 0 ? identifier : identifier.slice(0, fragment), parentUri);
}

function newResource(root: JsonSchema, uri: string): SchemaResource {
  return {
    root,
    uri,
    pointers: new Map<JsonPointer, JsonSchema>(),
    anchors: new Map<string, JsonSchema>(),
    dynamicAnchors: new Map<string, JsonSchema>(),
  };
}

function registerSchema(
  schema: JsonSchema,
  registry: SchemaRegistry,
  resource: SchemaResource,
  pointer: JsonPointer,
  visited: WeakSet<object>,
  ancestorLocations: readonly ResourceLocation[] = [],
): void {
  resource.pointers.set(pointer, schema);
  ancestorLocations.forEach((location) => location.resource.pointers.set(location.pointer, schema));
  const physicalPointer = ancestorLocations[0]?.pointer ?? pointer;
  if (registry.locations.length >= MAX_SCHEMA_GRAPH_NODES) {
    if (!registry.graphIssues.some((entry) => entry.keyword === "schemaGraphSize")) {
      registry.graphIssues.push({ pointer: ROOT_POINTER, keyword: "schemaGraphSize" });
    }
    return;
  }
  if (typeof schema === "boolean") {
    registry.locations.push({ schema, resource, pointer: physicalPointer });
    return;
  }

  let activeResource = resource;
  let activePointer = pointer;
  let activeAncestors = ancestorLocations;
  if (pointer !== ROOT_POINTER && typeof schema.$id === "string") {
    const normalizedUri = normalizeResourceUri(schema.$id, resource.uri);
    if (normalizedUri === undefined) {
      registry.graphIssues.push({
        pointer: appendJsonPointer(physicalPointer, "$id"),
        keyword: "$id",
      });
    } else if (normalizedUri !== resource.uri) {
      activeAncestors = [...ancestorLocations, { resource, pointer }];
      activeResource = newResource(schema, normalizedUri);
      activePointer = ROOT_POINTER;
      activeResource.pointers.set(ROOT_POINTER, schema);
      if (registry.resourceByUri.has(normalizedUri)) {
        registry.graphIssues.push({
          pointer: appendJsonPointer(physicalPointer, "$id"),
          keyword: "$id",
        });
      } else {
        registry.resourceByUri.set(normalizedUri, activeResource);
      }
    }
  }
  registry.resourceBySchema.set(schema, activeResource);

  if (visited.has(schema)) return;
  visited.add(schema);
  registry.locations.push({ schema, resource: activeResource, pointer: physicalPointer });

  if (typeof schema.$anchor === "string") {
    if (
      activeResource.anchors.has(schema.$anchor) ||
      activeResource.dynamicAnchors.has(schema.$anchor)
    ) {
      registry.graphIssues.push({
        pointer: appendJsonPointer(physicalPointer, "$anchor"),
        keyword: "$anchor",
      });
    } else {
      activeResource.anchors.set(schema.$anchor, schema);
    }
  }
  if (typeof schema.$dynamicAnchor === "string") {
    if (
      activeResource.anchors.has(schema.$dynamicAnchor) ||
      activeResource.dynamicAnchors.has(schema.$dynamicAnchor)
    ) {
      registry.graphIssues.push({
        pointer: appendJsonPointer(physicalPointer, "$dynamicAnchor"),
        keyword: "$dynamicAnchor",
      });
    } else {
      activeResource.dynamicAnchors.set(schema.$dynamicAnchor, schema);
    }
  }

  for (const keyword of SINGLE_SCHEMA_KEYWORDS) {
    const child = asSchema(schema[keyword]);
    if (child !== undefined) {
      registerSchema(
        child,
        registry,
        activeResource,
        appendJsonPointer(activePointer, keyword),
        visited,
        activeAncestors.map((location) => ({
          resource: location.resource,
          pointer: appendJsonPointer(location.pointer, keyword),
        })),
      );
    }
  }

  for (const keyword of ARRAY_SCHEMA_KEYWORDS) {
    const children = schema[keyword];
    if (!Array.isArray(children)) continue;
    children.forEach((childValue, index) => {
      const child = asSchema(childValue);
      if (child !== undefined) {
        registerSchema(
          child,
          registry,
          activeResource,
          appendPath(activePointer, keyword, index),
          visited,
          activeAncestors.map((location) => ({
            resource: location.resource,
            pointer: appendPath(location.pointer, keyword, index),
          })),
        );
      }
    });
  }

  for (const keyword of MAP_SCHEMA_KEYWORDS) {
    const children = schema[keyword];
    if (!isObject(children)) continue;
    for (const name of sortedKeys(children)) {
      const child = asSchema(children[name]);
      if (child !== undefined) {
        registerSchema(
          child,
          registry,
          activeResource,
          appendPath(activePointer, keyword, name),
          visited,
          activeAncestors.map((location) => ({
            resource: location.resource,
            pointer: appendPath(location.pointer, keyword, name),
          })),
        );
      }
    }
  }
}

function buildSchemaRegistry(schema: JsonSchema): SchemaRegistry {
  const rootIdentifier = typeof schema === "boolean" ? undefined : schema.$id;
  const rootUri =
    typeof rootIdentifier === "string"
      ? normalizeResourceUri(rootIdentifier, INTERNAL_SCHEMA_ROOT_URI)
      : INTERNAL_SCHEMA_ROOT_URI;
  const root = newResource(schema, rootUri ?? INTERNAL_SCHEMA_ROOT_URI);
  const registry: SchemaRegistry = {
    root,
    resourceBySchema: new WeakMap<object, SchemaResource>(),
    resourceByUri: new Map<string, SchemaResource>([[root.uri, root]]),
    locations: [],
    graphIssues: [],
  };
  if (typeof rootIdentifier === "string" && rootUri === undefined) {
    registry.graphIssues.push({
      pointer: appendJsonPointer(ROOT_POINTER, "$id"),
      keyword: "$id",
    });
  }
  registerSchema(schema, registry, root, ROOT_POINTER, new WeakSet<object>());
  return registry;
}

function decodeFragment(reference: string): string | undefined {
  if (reference === "") return "";
  if (!reference.startsWith("#")) return undefined;
  try {
    return decodeURIComponent(reference.slice(1));
  } catch {
    return undefined;
  }
}

function resolveReference(
  reference: string,
  resource: SchemaResource,
  registry: SchemaRegistry,
  dynamic: boolean,
  dynamicScope: readonly SchemaResource[],
): ResolvedSchema | undefined {
  const fragment = decodeFragment(reference);
  if (fragment === undefined) return undefined;

  let schema: JsonSchema | undefined;
  if (fragment === "") {
    schema = resource.root;
  } else if (fragment.startsWith("/")) {
    if (!isJsonPointer(fragment)) return undefined;
    const pointer = parseJsonPointer(fragment).reduce<JsonPointer>(
      (current, segment) => appendJsonPointer(current, segment),
      ROOT_POINTER,
    );
    schema = resource.pointers.get(pointer);
  } else {
    schema = resource.anchors.get(fragment) ?? resource.dynamicAnchors.get(fragment);
    if (dynamic && resource.dynamicAnchors.has(fragment)) {
      for (const scopeResource of dynamicScope) {
        const scoped = scopeResource.dynamicAnchors.get(fragment);
        if (scoped !== undefined) {
          schema = scoped;
          break;
        }
      }
    }
  }
  if (schema === undefined) return undefined;
  return {
    schema,
    resource:
      typeof schema === "boolean" ? resource : (registry.resourceBySchema.get(schema) ?? resource),
  };
}

function evaluateResolvedReference(
  resolved: ResolvedSchema,
  value: unknown,
  pointer: JsonPointer,
  state: EvaluationState,
): Evaluation {
  const previous = state.dynamicScope.at(-1);
  const entersResource = previous !== resolved.resource;
  if (entersResource) state.dynamicScope.push(resolved.resource);
  try {
    return evaluate(resolved.schema, value, pointer, resolved.resource, state);
  } finally {
    if (entersResource) state.dynamicScope.pop();
  }
}

function schemaId(schema: object, state: EvaluationState): number {
  const existing = state.schemaIds.get(schema);
  if (existing !== undefined) return existing;
  const assigned = state.nextSchemaId;
  state.nextSchemaId += 1;
  state.schemaIds.set(schema, assigned);
  return assigned;
}

function jsonEqual(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (left === null || right === null || typeof left !== "object" || typeof right !== "object") {
    return false;
  }
  if (Array.isArray(left)) {
    return (
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((child, index) => jsonEqual(child, right[index]))
    );
  }
  if (Array.isArray(right)) return false;

  const leftObject = left as Readonly<Record<string, unknown>>;
  const rightObject = right as Readonly<Record<string, unknown>>;
  const leftKeys = sortedKeys(leftObject);
  const rightKeys = sortedKeys(rightObject);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) =>
        key === rightKeys[index] &&
        Object.hasOwn(rightObject, key) &&
        jsonEqual(leftObject[key], rightObject[key]),
    )
  );
}

type DynamicEquality = "different" | "equal" | "unknown";

function compareDynamicInstance(
  instance: unknown,
  expected: unknown,
  analysis: DynamicAnalysis,
): DynamicEquality {
  if (isDynamicValueRoot(instance)) return "unknown";
  if (
    instance === null ||
    expected === null ||
    typeof instance !== "object" ||
    typeof expected !== "object"
  ) {
    return instance === expected ? "equal" : "different";
  }
  if (Array.isArray(instance)) {
    if (!Array.isArray(expected) || instance.length !== expected.length) return "different";
    let unknown = false;
    for (let index = 0; index < instance.length; index += 1) {
      const child = compareDynamicInstance(instance[index], expected[index], analysis);
      if (child === "different") return "different";
      if (child === "unknown") unknown = true;
    }
    return unknown ? "unknown" : "equal";
  }
  if (Array.isArray(expected)) return "different";

  const instanceObject = instance as Readonly<Record<string, unknown>>;
  const expectedObject = expected as Readonly<Record<string, unknown>>;
  const instanceKeys = sortedKeys(instanceObject);
  const expectedKeys = sortedKeys(expectedObject);
  if (
    instanceKeys.length !== expectedKeys.length ||
    instanceKeys.some((key, index) => key !== expectedKeys[index])
  ) {
    return "different";
  }
  let unknown = false;
  for (const key of instanceKeys) {
    const child = compareDynamicInstance(instanceObject[key], expectedObject[key], analysis);
    if (child === "different") return "different";
    if (child === "unknown") unknown = true;
  }
  if (unknown || containsDynamic(instance, analysis)) return "unknown";
  return "equal";
}

function matchesType(value: unknown, expected: string): boolean {
  switch (expected) {
    case "array":
      return Array.isArray(value);
    case "boolean":
      return typeof value === "boolean";
    case "integer":
      return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value);
    case "null":
      return value === null;
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "object":
      return isObject(value);
    case "string":
      return typeof value === "string";
    default:
      return false;
  }
}

function applyTypeKeyword(
  schema: SchemaObject,
  value: unknown,
  pointer: JsonPointer,
  result: EvaluationAccumulator,
): void {
  const expected = schema.type;
  if (typeof expected === "string") {
    if (!matchesType(value, expected)) addMismatch(result, pointer, "type");
    return;
  }
  if (
    Array.isArray(expected) &&
    !expected.some((candidate) => typeof candidate === "string" && matchesType(value, candidate))
  ) {
    addMismatch(result, pointer, "type");
  }
}

function unicodeLength(value: string): number {
  return Array.from(value).length;
}

interface PatternQuantifier {
  readonly nextIndex: number;
  readonly variableWidth: boolean;
  readonly expandedWidth: number;
}

function consumePatternEscape(
  pattern: string,
  index: number,
  characterClass: boolean,
): number | undefined {
  const marker = pattern[index + 1];
  if (marker === undefined) return undefined;
  if (
    marker === "p" ||
    marker === "P" ||
    marker === "k" ||
    (!characterClass && (marker === "b" || marker === "B")) ||
    (marker >= "1" && marker <= "9")
  ) {
    return undefined;
  }

  if (marker === "u" && pattern[index + 2] === "{") {
    const closing = pattern.indexOf("}", index + 3);
    if (closing < 0) return undefined;
    const digits = pattern.slice(index + 3, closing);
    if (!/^[0-9A-Fa-f]{1,6}$/u.test(digits)) return undefined;
    const codePoint = Number.parseInt(digits, 16);
    return codePoint <= 0x10ffff ? closing + 1 : undefined;
  }
  if (marker === "u") {
    return /^[0-9A-Fa-f]{4}$/u.test(pattern.slice(index + 2, index + 6)) ? index + 6 : undefined;
  }
  if (marker === "x") {
    return /^[0-9A-Fa-f]{2}$/u.test(pattern.slice(index + 2, index + 4)) ? index + 4 : undefined;
  }
  if (marker === "c") {
    const control = pattern[index + 2];
    return control !== undefined && /^[A-Za-z]$/u.test(control) ? index + 3 : undefined;
  }
  return index + 2;
}

function consumePatternClass(pattern: string, index: number): number | undefined {
  let current = index + 1;
  if (pattern[current] === "^") current += 1;
  let containsCharacter = false;
  while (current < pattern.length) {
    const character = pattern[current];
    if (character === "]" && containsCharacter) return current + 1;
    if (character === "[") return undefined;
    if (character === "\\") {
      const escaped = consumePatternEscape(pattern, current, true);
      if (escaped === undefined) return undefined;
      current = escaped;
    } else {
      current += 1;
    }
    containsCharacter = true;
  }
  return undefined;
}

function consumePatternQuantifier(pattern: string, index: number): PatternQuantifier | undefined {
  const marker = pattern[index];
  if (marker === "?" || marker === "*" || marker === "+") {
    return { nextIndex: index + 1, variableWidth: true, expandedWidth: 1 };
  }
  if (marker !== "{") {
    return { nextIndex: index, variableWidth: false, expandedWidth: 1 };
  }

  let current = index + 1;
  const minimumStart = current;
  while (current < pattern.length && /^[0-9]$/u.test(pattern[current] as string)) current += 1;
  if (current === minimumStart) return undefined;
  const minimum = Number(pattern.slice(minimumStart, current));
  if (!Number.isSafeInteger(minimum) || minimum > MAX_PATTERN_QUANTIFIER) return undefined;
  if (pattern[current] === "}") {
    return { nextIndex: current + 1, variableWidth: false, expandedWidth: minimum };
  }
  if (pattern[current] !== ",") return undefined;
  current += 1;
  const maximumStart = current;
  while (current < pattern.length && /^[0-9]$/u.test(pattern[current] as string)) current += 1;
  const maximumText = pattern.slice(maximumStart, current);
  if (pattern[current] !== "}") return undefined;
  if (maximumText === "") {
    return { nextIndex: current + 1, variableWidth: true, expandedWidth: minimum };
  }
  const maximum = Number(maximumText);
  if (!Number.isSafeInteger(maximum) || maximum > MAX_PATTERN_QUANTIFIER || maximum < minimum) {
    return undefined;
  }
  return {
    nextIndex: current + 1,
    variableWidth: maximum !== minimum,
    expandedWidth: maximum,
  };
}

/**
 * Applies the deliberately bounded T08 host-regex profile before native RegExp construction.
 *
 * @remarks Groups, alternation, backreferences, lookaround, Unicode-property escapes, interior
 * zero-width assertions, and more than one variable-width quantifier are rejected. Variable-width
 * repetition additionally requires both edge anchors and must be the final consuming atom. Fixed
 * repetition remains bounded to 1,024; unanchored fixed patterns expand to at most 16 atoms.
 */
function isHostSafePattern(pattern: string): boolean {
  if (pattern.length > MAX_PATTERN_CODE_UNITS) return false;
  let index = 0;
  let tokens = 0;
  let variableQuantifiers = 0;
  let expandedWidth = 0;
  let startsAnchored = false;
  let endsAnchored = false;

  while (index < pattern.length) {
    const character = pattern[index];
    if (variableQuantifiers > 0 && character !== "$") return false;
    if (character === "^") {
      if (index !== 0) return false;
      startsAnchored = true;
      tokens += 1;
      if (tokens > MAX_PATTERN_TOKENS) return false;
      index += 1;
      continue;
    }
    if (character === "$") {
      if (index !== pattern.length - 1) return false;
      endsAnchored = true;
      tokens += 1;
      if (tokens > MAX_PATTERN_TOKENS) return false;
      index += 1;
      continue;
    }
    if (
      character === "(" ||
      character === ")" ||
      character === "|" ||
      character === "]" ||
      character === "{" ||
      character === "}" ||
      character === "?" ||
      character === "*" ||
      character === "+"
    ) {
      return false;
    }

    let atomEnd: number | undefined;
    if (character === "[") atomEnd = consumePatternClass(pattern, index);
    else if (character === "\\") atomEnd = consumePatternEscape(pattern, index, false);
    else atomEnd = index + 1;
    if (atomEnd === undefined) return false;
    tokens += 1;
    if (tokens > MAX_PATTERN_TOKENS) return false;

    const quantifier = consumePatternQuantifier(pattern, atomEnd);
    if (quantifier === undefined) return false;
    if (quantifier.variableWidth) variableQuantifiers += 1;
    expandedWidth += quantifier.expandedWidth;
    if (expandedWidth > MAX_PATTERN_EXPANDED_WIDTH) return false;
    if (
      quantifier.nextIndex !== atomEnd &&
      (pattern[quantifier.nextIndex] === "?" ||
        pattern[quantifier.nextIndex] === "*" ||
        pattern[quantifier.nextIndex] === "+" ||
        pattern[quantifier.nextIndex] === "{")
    ) {
      return false;
    }
    index = quantifier.nextIndex;
  }

  if (variableQuantifiers === 0) {
    return startsAnchored || expandedWidth <= MAX_UNANCHORED_FIXED_PATTERN_WIDTH;
  }
  return variableQuantifiers === 1 && startsAnchored && endsAnchored;
}

function safePattern(pattern: string): RegExp | undefined {
  if (!isHostSafePattern(pattern)) return undefined;
  try {
    return new RegExp(pattern, "u");
  } catch {
    return undefined;
  }
}

function normalizeGraphIssues(
  issues: readonly SchemaContractGraphIssue[],
): readonly SchemaContractGraphIssue[] {
  const ordered = [...issues].sort((left, right) => {
    const pointerOrder = compareText(left.pointer, right.pointer);
    return pointerOrder !== 0 ? pointerOrder : compareText(left.keyword, right.keyword);
  });
  const unique: SchemaContractGraphIssue[] = [];
  let previousKey: string | undefined;
  for (const entry of ordered) {
    const key = `${entry.pointer}\u0000${entry.keyword}`;
    if (key !== previousKey) {
      unique.push(Object.freeze({ pointer: entry.pointer, keyword: entry.keyword }));
    }
    previousKey = key;
  }
  return Object.freeze(unique);
}

function schemaEvaluationProfileIssue(
  schema: JsonSchema,
  inheritedResource: SchemaResource,
  registry: SchemaRegistry,
): SchemaContractGraphIssue | undefined {
  const active = new WeakSet<object>();
  let evaluationSteps = 0;

  const visit = (
    current: JsonSchema,
    currentResource: SchemaResource,
    depth: number,
  ): SchemaContractGraphIssue | undefined => {
    if (depth > MAX_SCHEMA_GRAPH_DEPTH) {
      return { pointer: ROOT_POINTER, keyword: "schemaGraphDepth" };
    }
    evaluationSteps += 1;
    if (evaluationSteps > MAX_SCHEMA_EVALUATION_STEPS) {
      return { pointer: ROOT_POINTER, keyword: "evaluationBudget" };
    }
    if (typeof current === "boolean") return undefined;
    if (active.has(current)) return undefined;
    active.add(current);

    try {
      const resource = registry.resourceBySchema.get(current) ?? currentResource;
      const children: ResolvedSchema[] = [];
      const addChild = (child: JsonSchema, childResource = resource): void => {
        children.push({ schema: child, resource: childResource });
      };

      for (const [keyword, dynamic] of [
        ["$ref", false],
        ["$dynamicRef", true],
      ] as const) {
        const reference = current[keyword];
        if (typeof reference !== "string") continue;
        const resolved = resolveReference(reference, resource, registry, dynamic, [resource]);
        if (resolved !== undefined) children.push(resolved);
      }
      for (const keyword of EVALUATED_SINGLE_SCHEMA_KEYWORDS) {
        const child = asSchema(current[keyword]);
        if (child !== undefined) addChild(child);
      }
      for (const keyword of EVALUATED_ARRAY_SCHEMA_KEYWORDS) {
        const values = current[keyword];
        if (!Array.isArray(values)) continue;
        for (const candidate of values) {
          const child = asSchema(candidate);
          if (child !== undefined) addChild(child);
        }
      }
      for (const keyword of EVALUATED_MAP_SCHEMA_KEYWORDS) {
        const values = current[keyword];
        if (!isObject(values)) continue;
        for (const name of sortedKeys(values)) {
          const child = asSchema(values[name]);
          if (child !== undefined) addChild(child);
        }
      }

      for (const child of children) {
        const childIssue = visit(child.schema, child.resource, depth + 1);
        if (childIssue !== undefined) return childIssue;
      }
      return undefined;
    } finally {
      active.delete(current);
    }
  };

  return visit(schema, inheritedResource, 0);
}

/**
 * Validates local-reference integrity and the bounded T08 host profile for one embedded schema.
 *
 * @remarks This preparation pass is deliberately stricter than general Draft 2020-12 syntax. It
 * accepts only local references, unique canonical resource identifiers and plain-name anchors
 * inside each nearest `$id` resource, at most 128 schema/evaluation levels, 4,096 schema nodes and
 * local references, and 64 bounded host-safe patterns whose aggregate source length is at most
 * 4,096 UTF-16 code units. Forward references and cycles remain valid. The result is sorted,
 * de-duplicated, and recursively immutable.
 */
export function validateSchemaContractGraph(schema: unknown): readonly SchemaContractGraphIssue[] {
  const normalizedSchema = asSchema(schema);
  if (normalizedSchema === undefined) {
    return normalizeGraphIssues([{ pointer: ROOT_POINTER, keyword: "schema" }]);
  }
  const shapeIssue = schemaShapeIssue(normalizedSchema);
  if (shapeIssue !== undefined) return normalizeGraphIssues([shapeIssue]);

  const registry = buildSchemaRegistry(normalizedSchema);
  const issues = [...registry.graphIssues];
  let referenceCount = 0;
  let referenceLimitReported = false;
  let patternCount = 0;
  let patternCodeUnits = 0;

  const inspectPattern = (pattern: string, pointer: JsonPointer, keyword: string): void => {
    patternCount += 1;
    patternCodeUnits += pattern.length;
    if (
      safePattern(pattern) === undefined ||
      patternCount > MAX_SCHEMA_GRAPH_PATTERNS ||
      patternCodeUnits > MAX_SCHEMA_GRAPH_PATTERN_CODE_UNITS
    ) {
      issues.push({ pointer, keyword });
    }
  };

  for (const location of registry.locations) {
    if (typeof location.schema === "boolean") continue;
    for (const [keyword, dynamic] of [
      ["$ref", false],
      ["$dynamicRef", true],
    ] as const) {
      const reference = location.schema[keyword];
      if (typeof reference !== "string") continue;
      referenceCount += 1;
      const referencePointer = appendJsonPointer(location.pointer, keyword);
      if (referenceCount > MAX_SCHEMA_GRAPH_REFERENCES) {
        if (!referenceLimitReported) {
          issues.push({ pointer: referencePointer, keyword });
          referenceLimitReported = true;
        }
        continue;
      }
      if (
        resolveReference(reference, location.resource, registry, dynamic, [location.resource]) ===
        undefined
      ) {
        issues.push({ pointer: referencePointer, keyword });
      }
    }

    if (typeof location.schema.pattern === "string") {
      inspectPattern(
        location.schema.pattern,
        appendJsonPointer(location.pointer, "pattern"),
        "pattern",
      );
    }
    if (isObject(location.schema.patternProperties)) {
      for (const pattern of sortedKeys(location.schema.patternProperties)) {
        inspectPattern(
          pattern,
          appendPath(location.pointer, "patternProperties", pattern),
          "patternProperties",
        );
      }
    }
  }

  const evaluationProfileIssue = schemaEvaluationProfileIssue(
    normalizedSchema,
    registry.root,
    registry,
  );
  if (evaluationProfileIssue !== undefined) issues.push(evaluationProfileIssue);

  return normalizeGraphIssues(issues);
}

function applyStringKeywords(
  schema: SchemaObject,
  value: string,
  pointer: JsonPointer,
  result: EvaluationAccumulator,
): void {
  const length = unicodeLength(value);
  if (typeof schema.minLength === "number" && length < schema.minLength) {
    addMismatch(result, pointer, "minLength");
  }
  if (typeof schema.maxLength === "number" && length > schema.maxLength) {
    addMismatch(result, pointer, "maxLength");
  }
  if (typeof schema.pattern === "string") {
    const pattern = safePattern(schema.pattern);
    if (pattern === undefined || !pattern.test(value)) addMismatch(result, pointer, "pattern");
  }
}

interface DecimalInteger {
  readonly coefficient: bigint;
  readonly exponent: number;
}

function decimalInteger(value: number): DecimalInteger {
  const text = value.toString().toLowerCase();
  const [mantissa = "0", exponentText = "0"] = text.split("e");
  const negative = mantissa.startsWith("-");
  const unsigned = negative ? mantissa.slice(1) : mantissa;
  const [whole = "0", fraction = ""] = unsigned.split(".");
  const digits = `${whole}${fraction}`.replace(/^0+(?=[0-9])/u, "");
  let coefficient = BigInt(digits === "" ? "0" : digits);
  if (negative) coefficient = -coefficient;
  let exponent = Number(exponentText) - fraction.length;

  while (coefficient !== 0n && coefficient % 10n === 0n) {
    coefficient /= 10n;
    exponent += 1;
  }
  return { coefficient, exponent };
}

function isMultipleOf(value: number, divisor: number): boolean {
  if (!(divisor > 0) || !Number.isFinite(divisor)) return false;
  const dividend = decimalInteger(value);
  const factor = decimalInteger(divisor);
  const exponentDifference = dividend.exponent - factor.exponent;
  if (exponentDifference >= 0) {
    const numerator = dividend.coefficient * 10n ** BigInt(exponentDifference);
    return numerator % factor.coefficient === 0n;
  }
  const denominator = factor.coefficient * 10n ** BigInt(-exponentDifference);
  return dividend.coefficient % denominator === 0n;
}

function applyNumberKeywords(
  schema: SchemaObject,
  value: number,
  pointer: JsonPointer,
  result: EvaluationAccumulator,
): void {
  if (typeof schema.multipleOf === "number" && !isMultipleOf(value, schema.multipleOf)) {
    addMismatch(result, pointer, "multipleOf");
  }
  if (typeof schema.minimum === "number" && value < schema.minimum) {
    addMismatch(result, pointer, "minimum");
  }
  if (typeof schema.maximum === "number" && value > schema.maximum) {
    addMismatch(result, pointer, "maximum");
  }
  if (typeof schema.exclusiveMinimum === "number" && value <= schema.exclusiveMinimum) {
    addMismatch(result, pointer, "exclusiveMinimum");
  }
  if (typeof schema.exclusiveMaximum === "number" && value >= schema.exclusiveMaximum) {
    addMismatch(result, pointer, "exclusiveMaximum");
  }
}

function evaluateSchemaArray(
  schemas: unknown,
  value: unknown,
  pointer: JsonPointer,
  resource: SchemaResource,
  state: EvaluationState,
): readonly Evaluation[] {
  if (!Array.isArray(schemas)) return [];
  return schemas.flatMap((candidate) => {
    const schema = asSchema(candidate);
    return schema === undefined ? [] : [evaluate(schema, value, pointer, resource, state)];
  });
}

function mergePossibleAnnotations(
  result: EvaluationAccumulator,
  branches: readonly Evaluation[],
): void {
  for (const branch of branches) {
    if (branch.status === "invalid") continue;
    branch.evaluatedProperties.forEach((name) => result.evaluatedProperties.add(name));
    branch.evaluatedItems.forEach((index) => result.evaluatedItems.add(index));
  }
}

function mergeAllAnnotations(result: EvaluationAccumulator, branches: readonly Evaluation[]): void {
  for (const branch of branches) {
    branch.evaluatedProperties.forEach((name) => result.evaluatedProperties.add(name));
    branch.evaluatedItems.forEach((index) => result.evaluatedItems.add(index));
  }
}

function applyCombinators(
  schema: SchemaObject,
  value: unknown,
  pointer: JsonPointer,
  resource: SchemaResource,
  state: EvaluationState,
  result: EvaluationAccumulator,
  patchRoot: boolean,
): void {
  const allOf = evaluateSchemaArray(schema.allOf, value, pointer, resource, state);
  allOf.forEach((branch) => mergeSameInstance(result, branch));

  const anyOf = evaluateSchemaArray(schema.anyOf, value, pointer, resource, state);
  if (anyOf.length > 0) {
    const valid = anyOf.filter((branch) => branch.status === "valid");
    const unknown = anyOf.filter((branch) => branch.status === "unknown");
    const possible = [...valid, ...unknown];
    if (possible.length === 0) {
      if (patchRoot) mergeAllAnnotations(result, anyOf);
      addMismatch(result, pointer, "anyOf");
    } else {
      mergePossibleAnnotations(result, possible);
    }
    if (valid.length === 0 && unknown.length > 0) result.unknown = true;
  }

  const oneOf = evaluateSchemaArray(schema.oneOf, value, pointer, resource, state);
  if (oneOf.length > 0) {
    const valid = oneOf.filter((branch) => branch.status === "valid");
    const unknown = oneOf.filter((branch) => branch.status === "unknown");
    const possible = [...valid, ...unknown];
    if (possible.length === 0 || valid.length > 1) {
      if (patchRoot) mergeAllAnnotations(result, possible.length === 0 ? oneOf : valid);
      addMismatch(result, pointer, "oneOf");
    } else {
      mergePossibleAnnotations(result, possible);
    }
    if (possible.length > 0 && unknown.length > 0) {
      result.unknown = true;
    }
  }

  const notSchema = asSchema(schema.not);
  if (notSchema !== undefined) {
    const negated = evaluate(notSchema, value, pointer, resource, state);
    if (negated.status === "valid") addMismatch(result, pointer, "not");
    else if (negated.status === "unknown") result.unknown = true;
  }

  const ifSchema = asSchema(schema.if);
  if (ifSchema !== undefined) {
    const condition = evaluate(ifSchema, value, pointer, resource, state);
    const thenSchema = asSchema(schema.then);
    const elseSchema = asSchema(schema.else);
    if (condition.status === "valid") {
      mergePossibleAnnotations(result, [condition]);
      if (thenSchema !== undefined) {
        mergeSameInstance(result, evaluate(thenSchema, value, pointer, resource, state));
      }
    } else if (condition.status === "invalid") {
      if (elseSchema !== undefined) {
        mergeSameInstance(result, evaluate(elseSchema, value, pointer, resource, state));
      }
    } else {
      mergePossibleAnnotations(result, [condition]);
      const branches = [
        thenSchema === undefined
          ? emptyEvaluation()
          : evaluate(thenSchema, value, pointer, resource, state),
        elseSchema === undefined
          ? emptyEvaluation()
          : evaluate(elseSchema, value, pointer, resource, state),
      ];
      const possible = branches.filter((branch) => branch.status !== "invalid");
      if (possible.length === 0) {
        if (patchRoot) mergeAllAnnotations(result, branches);
        addMismatch(result, pointer, "if");
      } else {
        mergePossibleAnnotations(result, possible);
      }
      if (possible.length > 0 && branches.some((branch) => branch.status !== "valid")) {
        result.unknown = true;
      }
    }
  }
}

function applyPropertyNames(
  schema: JsonSchema,
  value: Readonly<Record<string, unknown>>,
  pointer: JsonPointer,
  resource: SchemaResource,
  state: EvaluationState,
  result: EvaluationAccumulator,
): void {
  for (const name of sortedKeys(value)) {
    const childPointer = appendJsonPointer(pointer, name);
    const nameResult = evaluate(schema, name, childPointer, resource, state);
    if (nameResult.status === "invalid") addMismatch(result, childPointer, "propertyNames");
    else if (nameResult.status === "unknown") result.unknown = true;
  }
}

function applyObjectKeywords(
  schema: SchemaObject,
  value: Readonly<Record<string, unknown>>,
  pointer: JsonPointer,
  resource: SchemaResource,
  state: EvaluationState,
  result: EvaluationAccumulator,
  patchRoot: boolean,
): void {
  const keys = sortedKeys(value);
  if (typeof schema.minProperties === "number" && keys.length < schema.minProperties) {
    if (patchRoot) result.unknown = true;
    else {
      addMismatch(result, pointer, "minProperties");
    }
  }
  if (typeof schema.maxProperties === "number") {
    if (keys.length > schema.maxProperties) {
      addMismatch(result, pointer, "maxProperties");
    } else if (patchRoot) {
      result.unknown = true;
    }
  }
  if (Array.isArray(schema.required)) {
    for (const requiredName of schema.required) {
      if (typeof requiredName === "string" && !Object.hasOwn(value, requiredName)) {
        if (patchRoot) result.unknown = true;
        else {
          addMismatch(result, appendJsonPointer(pointer, requiredName), "required");
        }
      }
    }
  }
  if (isObject(schema.dependentRequired)) {
    for (const trigger of sortedKeys(schema.dependentRequired)) {
      const dependencies = schema.dependentRequired[trigger];
      if (!Array.isArray(dependencies)) continue;
      if (!Object.hasOwn(value, trigger)) {
        if (patchRoot && dependencies.length > 0) result.unknown = true;
        continue;
      }
      for (const dependency of dependencies) {
        if (typeof dependency === "string" && !Object.hasOwn(value, dependency)) {
          if (patchRoot) result.unknown = true;
          else {
            addMismatch(result, appendJsonPointer(pointer, dependency), "dependentRequired");
          }
        }
      }
    }
  }

  const propertyNames = asSchema(schema.propertyNames);
  if (propertyNames !== undefined) {
    applyPropertyNames(propertyNames, value, pointer, resource, state, result);
    if (patchRoot && propertyNames !== true) result.unknown = true;
  }

  const matched = new Set<string>();
  if (isObject(schema.properties)) {
    for (const name of sortedKeys(schema.properties)) {
      const childSchema = asSchema(schema.properties[name]);
      if (childSchema === undefined) continue;
      if (!Object.hasOwn(value, name)) {
        if (patchRoot && childSchema !== true) result.unknown = true;
        continue;
      }
      matched.add(name);
      result.evaluatedProperties.add(name);
      mergeStatus(
        result,
        evaluate(childSchema, value[name], appendJsonPointer(pointer, name), resource, state),
      );
    }
  }

  if (isObject(schema.patternProperties)) {
    for (const patternText of sortedKeys(schema.patternProperties)) {
      const childSchema = asSchema(schema.patternProperties[patternText]);
      if (childSchema === undefined) continue;
      if (patchRoot && childSchema !== true) result.unknown = true;
      const pattern = safePattern(patternText);
      if (pattern === undefined) {
        addMismatch(result, pointer, "patternProperties");
        continue;
      }
      for (const name of keys) {
        if (!pattern.test(name)) continue;
        matched.add(name);
        result.evaluatedProperties.add(name);
        mergeStatus(
          result,
          evaluate(childSchema, value[name], appendJsonPointer(pointer, name), resource, state),
        );
      }
    }
  }

  if (Object.hasOwn(schema, "additionalProperties")) {
    const additional = asSchema(schema.additionalProperties);
    if (additional !== undefined) {
      if (patchRoot && additional !== true) result.unknown = true;
      for (const name of keys) {
        if (matched.has(name)) continue;
        result.evaluatedProperties.add(name);
        const childPointer = appendJsonPointer(pointer, name);
        if (additional === false) {
          result.issues.push(issue("unknown-property", childPointer, "additionalProperties"));
        } else if (additional !== true) {
          mergeStatus(result, evaluate(additional, value[name], childPointer, resource, state));
        }
      }
    }
  }

  if (isObject(schema.dependentSchemas)) {
    for (const trigger of sortedKeys(schema.dependentSchemas)) {
      const dependent = asSchema(schema.dependentSchemas[trigger]);
      if (dependent === undefined) continue;
      if (!Object.hasOwn(value, trigger)) {
        if (patchRoot && dependent !== true) result.unknown = true;
        continue;
      }
      mergeSameInstance(result, evaluate(dependent, value, pointer, resource, state));
    }
  }
}

function applyUniqueItems(
  value: readonly unknown[],
  pointer: JsonPointer,
  state: EvaluationState,
  result: EvaluationAccumulator,
): void {
  for (let index = 0; index < value.length; index += 1) {
    const candidate = value[index];
    if (containsDynamic(candidate, state.dynamics)) continue;
    for (let previous = 0; previous < index; previous += 1) {
      const prior = value[previous];
      if (!containsDynamic(prior, state.dynamics) && jsonEqual(candidate, prior)) {
        addMismatch(result, appendJsonPointer(pointer, index), "uniqueItems");
        break;
      }
    }
  }
}

function applyContains(
  containsSchema: JsonSchema,
  schema: SchemaObject,
  value: readonly unknown[],
  pointer: JsonPointer,
  resource: SchemaResource,
  state: EvaluationState,
  result: EvaluationAccumulator,
): void {
  let validCount = 0;
  let unknownCount = 0;
  value.forEach((item, index) => {
    const candidate = evaluate(
      containsSchema,
      item,
      appendJsonPointer(pointer, index),
      resource,
      state,
    );
    if (candidate.status === "valid") {
      validCount += 1;
      result.evaluatedItems.add(index);
    } else if (candidate.status === "unknown") {
      unknownCount += 1;
      result.evaluatedItems.add(index);
    }
  });

  const minimum = typeof schema.minContains === "number" ? schema.minContains : 1;
  const maximum = typeof schema.maxContains === "number" ? schema.maxContains : undefined;
  if (validCount + unknownCount < minimum) {
    addMismatch(result, pointer, Object.hasOwn(schema, "minContains") ? "minContains" : "contains");
  }
  if (maximum !== undefined && validCount > maximum) {
    addMismatch(result, pointer, "maxContains");
  }
  if (
    unknownCount > 0 &&
    validCount <= (maximum ?? Number.POSITIVE_INFINITY) &&
    validCount + unknownCount >= minimum
  ) {
    result.unknown = true;
  }
}

function applyArrayKeywords(
  schema: SchemaObject,
  value: readonly unknown[],
  pointer: JsonPointer,
  resource: SchemaResource,
  state: EvaluationState,
  result: EvaluationAccumulator,
): void {
  if (typeof schema.minItems === "number" && value.length < schema.minItems) {
    addMismatch(result, pointer, "minItems");
  }
  if (typeof schema.maxItems === "number" && value.length > schema.maxItems) {
    addMismatch(result, pointer, "maxItems");
  }
  if (schema.uniqueItems === true) applyUniqueItems(value, pointer, state, result);

  let prefixLength = 0;
  if (Array.isArray(schema.prefixItems)) {
    prefixLength = schema.prefixItems.length;
    schema.prefixItems.forEach((candidate, index) => {
      if (index >= value.length) return;
      const childSchema = asSchema(candidate);
      if (childSchema === undefined) return;
      result.evaluatedItems.add(index);
      mergeStatus(
        result,
        evaluate(childSchema, value[index], appendJsonPointer(pointer, index), resource, state),
      );
    });
  }

  if (Object.hasOwn(schema, "items")) {
    const itemSchema = asSchema(schema.items);
    if (itemSchema !== undefined) {
      for (let index = prefixLength; index < value.length; index += 1) {
        result.evaluatedItems.add(index);
        const childPointer = appendJsonPointer(pointer, index);
        if (itemSchema === false) addMismatch(result, childPointer, "items");
        else if (itemSchema !== true) {
          mergeStatus(result, evaluate(itemSchema, value[index], childPointer, resource, state));
        }
      }
    }
  }

  const containsSchema = asSchema(schema.contains);
  if (containsSchema !== undefined) {
    applyContains(containsSchema, schema, value, pointer, resource, state, result);
  }
}

function applyUnevaluatedProperties(
  schema: JsonSchema,
  value: Readonly<Record<string, unknown>>,
  pointer: JsonPointer,
  resource: SchemaResource,
  state: EvaluationState,
  result: EvaluationAccumulator,
): void {
  for (const name of sortedKeys(value)) {
    if (result.evaluatedProperties.has(name)) continue;
    result.evaluatedProperties.add(name);
    const childPointer = appendJsonPointer(pointer, name);
    if (schema === false) {
      result.issues.push(issue("unknown-property", childPointer, "unevaluatedProperties"));
    } else if (schema !== true) {
      mergeStatus(result, evaluate(schema, value[name], childPointer, resource, state));
    }
  }
}

function applyUnevaluatedItems(
  schema: JsonSchema,
  value: readonly unknown[],
  pointer: JsonPointer,
  resource: SchemaResource,
  state: EvaluationState,
  result: EvaluationAccumulator,
): void {
  value.forEach((item, index) => {
    if (result.evaluatedItems.has(index)) return;
    result.evaluatedItems.add(index);
    const childPointer = appendJsonPointer(pointer, index);
    if (schema === false) addMismatch(result, childPointer, "unevaluatedItems");
    else if (schema !== true) {
      mergeStatus(result, evaluate(schema, item, childPointer, resource, state));
    }
  });
}

function evaluate(
  schema: JsonSchema,
  value: unknown,
  pointer: JsonPointer,
  inheritedResource: SchemaResource,
  state: EvaluationState,
): Evaluation {
  if (state.evaluationSteps >= MAX_SCHEMA_EVALUATION_STEPS) {
    state.evaluationBudgetIssue ??= issue("mismatch", pointer, "evaluationBudget");
    const budgetFailure = accumulator();
    budgetFailure.issues.push(state.evaluationBudgetIssue);
    return finishEvaluation(budgetFailure);
  }
  state.evaluationSteps += 1;
  if (schema === true) return emptyEvaluation();
  if (schema === false) {
    const result = accumulator();
    addMismatch(result, pointer, "false");
    return finishEvaluation(result);
  }

  const activeKey = `${schemaId(schema, state)}\u0000${pointer}`;
  if (state.activeEvaluations.has(activeKey)) return emptyEvaluation("unknown");
  state.activeEvaluations.add(activeKey);

  try {
    const result = accumulator();
    const resource = state.registry.resourceBySchema.get(schema) ?? inheritedResource;
    const patchRoot = state.mode === "patch" && pointer === ROOT_POINTER;

    for (const [keyword, dynamic] of [
      ["$ref", false],
      ["$dynamicRef", true],
    ] as const) {
      const reference = schema[keyword];
      if (typeof reference !== "string") continue;
      const resolved = resolveReference(
        reference,
        resource,
        state.registry,
        dynamic,
        state.dynamicScope,
      );
      if (resolved === undefined) addMismatch(result, pointer, keyword);
      else mergeSameInstance(result, evaluateResolvedReference(resolved, value, pointer, state));
    }

    applyCombinators(schema, value, pointer, resource, state, result, patchRoot);
    if (isDynamicValueRoot(value)) {
      result.unknown = true;
      return finishEvaluation(result);
    }
    applyTypeKeyword(schema, value, pointer, result);

    if (!patchRoot) {
      if (Object.hasOwn(schema, "const")) {
        const comparison = compareDynamicInstance(value, schema.const, state.dynamics);
        if (comparison === "unknown") result.unknown = true;
        else if (comparison === "different") addMismatch(result, pointer, "const");
      }
      if (Array.isArray(schema.enum)) {
        const comparisons = schema.enum.map((candidate) =>
          compareDynamicInstance(value, candidate, state.dynamics),
        );
        if (!comparisons.includes("equal")) {
          if (comparisons.includes("unknown")) result.unknown = true;
          else addMismatch(result, pointer, "enum");
        }
      }
    } else if (Object.hasOwn(schema, "const") || Array.isArray(schema.enum)) {
      result.unknown = true;
    }

    if (typeof value === "string") applyStringKeywords(schema, value, pointer, result);
    if (typeof value === "number" && Number.isFinite(value)) {
      applyNumberKeywords(schema, value, pointer, result);
    }
    if (Array.isArray(value)) {
      applyArrayKeywords(schema, value, pointer, resource, state, result);
    } else if (isObject(value)) {
      applyObjectKeywords(schema, value, pointer, resource, state, result, patchRoot);
    }

    if (isObject(value) && Object.hasOwn(schema, "unevaluatedProperties")) {
      const unevaluated = asSchema(schema.unevaluatedProperties);
      if (unevaluated !== undefined) {
        if (patchRoot && unevaluated !== true) result.unknown = true;
        applyUnevaluatedProperties(unevaluated, value, pointer, resource, state, result);
      }
    }
    if (Array.isArray(value) && Object.hasOwn(schema, "unevaluatedItems")) {
      const unevaluated = asSchema(schema.unevaluatedItems);
      if (unevaluated !== undefined) {
        if (patchRoot && unevaluated !== true) result.unknown = true;
        applyUnevaluatedItems(unevaluated, value, pointer, resource, state, result);
      }
    }

    return finishEvaluation(result);
  } finally {
    state.activeEvaluations.delete(activeKey);
  }
}

function normalizeIssues(issues: readonly SchemaContractIssue[]): readonly SchemaContractIssue[] {
  const ordered = [...issues].sort((left, right) => {
    const pointerOrder = compareText(left.pointer, right.pointer);
    if (pointerOrder !== 0) return pointerOrder;
    const kindOrder = compareText(left.kind, right.kind);
    return kindOrder !== 0 ? kindOrder : compareText(left.keyword, right.keyword);
  });

  const unique: Readonly<SchemaContractIssue>[] = [];
  let previousKey: string | undefined;
  for (const entry of ordered) {
    const key = `${entry.pointer}\u0000${entry.kind}\u0000${entry.keyword}`;
    if (key !== previousKey) {
      unique.push(
        Object.freeze({ kind: entry.kind, pointer: entry.pointer, keyword: entry.keyword }),
      );
    }
    previousKey = key;
  }
  return Object.freeze(unique);
}

/**
 * Applies one structurally validated Draft 2020-12 schema to a DESEN literal object or patch.
 *
 * @remarks This internal, platform-neutral interpreter never compiles or evaluates generated code,
 * mutates input, applies defaults, coerces types, fetches references, or reads non-local schemas.
 * `complete` applies whole-value constraints. `patch` suppresses root-level completeness and
 * cross-value requirements while continuing to validate supplied names and values. DESEN `$ref`,
 * `$token`, and `$format` roots are treated as unresolved values: definite surrounding constraints
 * still run, while each dynamic root becomes one later-validation obligation.
 *
 * The caller must first pass schemas and values through the validator package's inert structural
 * boundary. Invalid schemas, cyclic JavaScript objects, and non-JSON values are outside this
 * internal function's contract.
 */
export function applySchemaContract(
  schema: unknown,
  value: unknown,
  mode: SchemaContractMode,
): SchemaContractResult {
  if (mode !== "complete" && mode !== "patch") {
    throw new TypeError("Schema contract mode must be `complete` or `patch`.");
  }

  const normalizedSchema = asSchema(schema);
  const dynamics = analyzeDynamicValues(value);
  if (normalizedSchema === undefined) {
    return Object.freeze({
      issues: normalizeIssues([issue("mismatch", ROOT_POINTER, "schema")]),
      obligations: dynamics.obligations,
    });
  }
  const shapeIssue = schemaShapeIssue(normalizedSchema);
  if (shapeIssue !== undefined) {
    return Object.freeze({
      issues: normalizeIssues([issue("mismatch", ROOT_POINTER, shapeIssue.keyword)]),
      obligations: dynamics.obligations,
    });
  }

  const registry = buildSchemaRegistry(normalizedSchema);
  const evaluationProfileIssue = schemaEvaluationProfileIssue(
    normalizedSchema,
    registry.root,
    registry,
  );
  if (evaluationProfileIssue !== undefined) {
    return Object.freeze({
      issues: normalizeIssues([issue("mismatch", ROOT_POINTER, evaluationProfileIssue.keyword)]),
      obligations: dynamics.obligations,
    });
  }
  const evaluation = evaluate(normalizedSchema, value, ROOT_POINTER, registry.root, {
    mode,
    registry,
    dynamics,
    activeEvaluations: new Set<string>(),
    dynamicScope: [registry.root],
    schemaIds: new WeakMap<object, number>(),
    evaluationSteps: 0,
    nextSchemaId: 0,
  });
  return Object.freeze({
    issues: normalizeIssues(evaluation.issues),
    obligations: dynamics.obligations,
  });
}
