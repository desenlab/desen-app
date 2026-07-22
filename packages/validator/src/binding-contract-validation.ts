import {
  appendJsonPointer,
  canonicalizeJson,
  createCoreDiagnostic,
  parseJsonPointer,
} from "@desen/protocol";

import {
  getPreparedDesenEventPayloadSchema,
  validateDesenInteractionContracts,
} from "./interaction-contract-validation.js";
import {
  applySchemaContract,
  inspectSchemaContractPath,
  validateSchemaContractGraph,
} from "./schema-instance-validation.js";
import {
  invalidBindingContractDiagnostic,
  normalizeSemanticDiagnostics,
} from "./semantic-diagnostics.js";
import { compareText, isJsonObject, ROOT_POINTER } from "./validation-internals.js";

import type {
  CoreDiagnosticCode,
  DesenBundle,
  DesenDiagnosticContext,
  DesenSource,
  JsonPointer,
} from "@desen/protocol";
import type {
  DesenInteractionContractObligation,
  DesenInteractionContractObligationKind,
  DesenInteractionContractTarget,
  DesenValidatedInteractionCatalogSet,
} from "./interaction-contract-validation.js";
import type { SchemaContractJsonType } from "./schema-instance-validation.js";
import type { DesenSemanticDiagnostic } from "./semantic-diagnostics.js";
import type { DesenDocumentForTarget, ImmutableJson } from "./structural-validation.js";
import type { JsonObject, JsonValue } from "./validation-internals.js";

export { INVALID_BINDING_CONTRACT_CODE } from "./semantic-diagnostics.js";

const EMPTY_DIAGNOSTICS = Object.freeze([]) as readonly [];
const EMPTY_OBLIGATIONS = Object.freeze([]) as readonly [];
const EMPTY_TYPES = Object.freeze([]) as readonly [];
const EMPTY_KNOWLEDGE = Object.freeze([]) as readonly ValueKnowledge[];
const ALL_JSON_TYPES = Object.freeze([
  "array",
  "boolean",
  "null",
  "number",
  "object",
  "string",
] as const satisfies readonly SchemaContractJsonType[]);

/** A Source or Bundle root accepted by cumulative static binding validation. */
export type DesenBindingContractTarget = DesenInteractionContractTarget;

/** Dynamic contract channel carried forward unchanged from the T09 boundary. */
export type DesenBindingContractObligationKind = DesenInteractionContractObligationKind;

/** A T09 resolved-value obligation preserved by cumulative T10 validation. */
export type DesenBindingContractObligation = DesenInteractionContractObligation;

/** Successful cumulative T06→T07→T08→T09→T10 binding-contract validation. */
export interface DesenBindingContractValidationSuccess<Target extends DesenBindingContractTarget> {
  /** Confirms that no cumulative or statically provable binding error exists. */
  readonly valid: true;
  /** Identifies the validated protocol root. */
  readonly target: Target;
  /** Independent recursively immutable document snapshot created by the T06 boundary. */
  readonly value: ImmutableJson<DesenDocumentForTarget<Target>>;
  /** Always empty on success. */
  readonly diagnostics: readonly [];
  /** T09 obligations that still require validation after DESEN value resolution. */
  readonly obligations: readonly DesenBindingContractObligation[];
}

/** Failed cumulative binding validation with no trusted document value. */
export interface DesenBindingContractValidationFailure<Target extends DesenBindingContractTarget> {
  /** Confirms that one or more cumulative stages failed. */
  readonly valid: false;
  /** Identifies the attempted protocol root. */
  readonly target: Target;
  /** Sorted and de-duplicated T06 through T10 diagnostics. */
  readonly diagnostics: readonly DesenSemanticDiagnostic[];
  /** T09 obligations preserved even when an independent static binding error exists. */
  readonly obligations: readonly DesenBindingContractObligation[];
}

/** Result of cumulative Source or Bundle binding-contract validation. */
export type DesenBindingContractValidationResult<Target extends DesenBindingContractTarget> =
  DesenBindingContractValidationSuccess<Target> | DesenBindingContractValidationFailure<Target>;

type SourceSnapshot = ImmutableJson<DesenSource>;
type BundleSnapshot = ImmutableJson<DesenBundle>;
type DocumentSnapshot = SourceSnapshot | BundleSnapshot;

interface StateContract {
  readonly schema: JsonValue;
  readonly pointer: JsonPointer;
}

interface RepeatAliasScope {
  readonly name: string;
  /** Direct array members whose independently static paths can be inspected without resolving peers. */
  readonly itemTemplates?: readonly JsonValue[];
  readonly parent?: RepeatAliasScope;
}

interface BindingScope {
  readonly catalogSet: DesenValidatedInteractionCatalogSet;
  readonly context: Readonly<DesenDiagnosticContext>;
  readonly states: ReadonlyMap<string, StateContract>;
  readonly repeat?: RepeatAliasScope;
  readonly eventSchema?: JsonValue;
}

interface NodeWork {
  readonly node: JsonObject;
  readonly pointer: JsonPointer;
  readonly scope: BindingScope;
}

interface ActionWork {
  readonly action: JsonObject;
  readonly pointer: JsonPointer;
  readonly scope: BindingScope;
}

interface PredicateWork {
  readonly predicate: JsonObject;
  readonly pointer: JsonPointer;
  readonly scope: BindingScope;
}

interface ValueWork {
  readonly value: JsonValue;
  readonly pointer: JsonPointer;
  readonly scope: BindingScope;
  /** Prevents a second reference diagnostic when the consumer already emitted its stronger code. */
  readonly suppressUnresolved?: true;
  /** A lexically valid missing predicate input evaluates false instead of becoming a required ref. */
  readonly permitMissingReference?: true;
}

type ValueKnowledge =
  | Readonly<{ kind: "literal"; types: readonly SchemaContractJsonType[]; value: JsonValue }>
  | Readonly<{ kind: "typed"; types: readonly SchemaContractJsonType[] }>
  | Readonly<{ kind: "unknown"; types: readonly SchemaContractJsonType[] }>
  | Readonly<{ kind: "unresolved"; types: readonly [] }>;

type StaticEvaluation =
  | Readonly<{ kind: "dynamic" }>
  | Readonly<{ kind: "missing" }>
  | Readonly<{ kind: "value"; value: JsonValue }>;

type ReferencePresence = "always" | "inactive" | "maybe" | "missing" | "partial";

interface ReferenceAnalysis {
  readonly lexicalValid: boolean;
  readonly presence: ReferencePresence;
  readonly primary: readonly ValueKnowledge[];
  readonly fallback?: JsonValue;
}

type ItemPathAnalysis =
  | Readonly<{ kind: "missing" }>
  | Readonly<{ kind: "unknown" }>
  | Readonly<{ kind: "value"; alternatives: readonly ValueKnowledge[] }>;

function appendPath(pointer: JsonPointer, ...segments: readonly (number | string)[]): JsonPointer {
  return segments.reduce<JsonPointer>(
    (current, segment) => appendJsonPointer(current, segment),
    pointer,
  );
}

function appendRelativePointer(base: JsonPointer, relative: JsonPointer): JsonPointer {
  return parseJsonPointer(relative).reduce<JsonPointer>(
    (current, segment) => appendJsonPointer(current, segment),
    base,
  );
}

function sortedKeys(object: object): readonly string[] {
  return Object.keys(object).sort(compareText);
}

function asObject(value: JsonValue | undefined): JsonObject | undefined {
  return value !== undefined && isJsonObject(value) ? value : undefined;
}

function asArray(value: JsonValue | undefined): readonly JsonValue[] | undefined {
  return Array.isArray(value) ? value : undefined;
}

function ownValue(object: JsonObject, field: string): JsonValue | undefined {
  return Object.hasOwn(object, field) ? object[field] : undefined;
}

function stringField(object: JsonObject, field: string): string | undefined {
  const value = ownValue(object, field);
  return typeof value === "string" ? value : undefined;
}

function jsonType(value: JsonValue): SchemaContractJsonType {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "object") return "object";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  return "string";
}

function literalKnowledge(value: JsonValue): ValueKnowledge {
  return Object.freeze({ kind: "literal", types: Object.freeze([jsonType(value)]), value });
}

function typedKnowledge(types: readonly SchemaContractJsonType[]): ValueKnowledge {
  const normalized = Object.freeze([...new Set(types)].sort(compareText));
  return normalized.length === 0
    ? Object.freeze({ kind: "unresolved", types: EMPTY_TYPES })
    : Object.freeze({ kind: "typed", types: normalized });
}

function unknownKnowledge(): ValueKnowledge {
  return Object.freeze({ kind: "unknown", types: ALL_JSON_TYPES });
}

function unresolvedKnowledge(): ValueKnowledge {
  return Object.freeze({ kind: "unresolved", types: EMPTY_TYPES });
}

function bindingSuccess<Target extends DesenBindingContractTarget>(
  target: Target,
  value: ImmutableJson<DesenDocumentForTarget<Target>>,
  obligations: readonly DesenBindingContractObligation[],
): DesenBindingContractValidationSuccess<Target> {
  return Object.freeze({
    valid: true,
    target,
    value,
    diagnostics: EMPTY_DIAGNOSTICS,
    obligations,
  });
}

function bindingFailure<Target extends DesenBindingContractTarget>(
  target: Target,
  diagnostics: readonly DesenSemanticDiagnostic[],
  obligations: readonly DesenBindingContractObligation[] = EMPTY_OBLIGATIONS,
): DesenBindingContractValidationFailure<Target> {
  return Object.freeze({
    valid: false,
    target,
    diagnostics: normalizeSemanticDiagnostics(diagnostics),
    obligations,
  });
}

function bindingContext(
  documentId: string,
  surfaceId: string,
  subject?: Readonly<{ kind: "behavior" | "node"; id: string }>,
  capabilityId?: string,
): Readonly<DesenDiagnosticContext> {
  return Object.freeze({
    documentId,
    surfaceId,
    ...(subject === undefined ? {} : { subject: Object.freeze({ ...subject }) }),
    ...(capabilityId === undefined ? {} : { capabilityId }),
  });
}

function withSubject(
  scope: BindingScope,
  kind: "behavior" | "node",
  id: string,
  capabilityId: string,
): BindingScope {
  return Object.freeze({
    ...scope,
    context: bindingContext(
      scope.context.documentId ?? "",
      scope.context.surfaceId ?? "",
      { kind, id },
      capabilityId,
    ),
  });
}

function withEvent(scope: BindingScope, eventSchema: JsonValue | undefined): BindingScope {
  if (eventSchema === undefined) return withoutEvent(scope);
  return Object.freeze({
    catalogSet: scope.catalogSet,
    context: scope.context,
    states: scope.states,
    ...(scope.repeat === undefined ? {} : { repeat: scope.repeat }),
    eventSchema,
  });
}

function withoutEvent(scope: BindingScope): BindingScope {
  return Object.freeze({
    catalogSet: scope.catalogSet,
    context: scope.context,
    states: scope.states,
    ...(scope.repeat === undefined ? {} : { repeat: scope.repeat }),
  });
}

function withRepeat(scope: BindingScope, repeat: RepeatAliasScope): BindingScope {
  return Object.freeze({ ...scope, repeat });
}

function addCoreDiagnostic(
  diagnostics: DesenSemanticDiagnostic[],
  code: Extract<
    CoreDiagnosticCode,
    | "PREDICATE_TYPE_MISMATCH"
    | "REFERENCE_UNRESOLVED"
    | "REPEAT_ITEMS_INVALID"
    | "REPEAT_KEY_INVALID"
    | "STATE_WRITE_INVALID"
  >,
  pointer: JsonPointer,
  context: Readonly<DesenDiagnosticContext>,
): void {
  const messages = {
    PREDICATE_TYPE_MISMATCH: "A statically known predicate operand has an incompatible type.",
    REFERENCE_UNRESOLVED: "A statically invalid reference has no usable value in this scope.",
    REPEAT_ITEMS_INVALID: "Repeat items are statically known not to resolve to an array.",
    REPEAT_KEY_INVALID: "A repeat key is statically missing, invalid, or duplicated.",
    STATE_WRITE_INVALID: "A state action does not target a declared surface-local state entry.",
  } as const;
  diagnostics.push(createCoreDiagnostic({ code, message: messages[code], pointer, context }));
}

function validateStateContracts(
  stateObject: JsonObject,
  statePointer: JsonPointer,
  context: Readonly<DesenDiagnosticContext>,
  diagnostics: DesenSemanticDiagnostic[],
): ReadonlyMap<string, StateContract> {
  const states = new Map<string, StateContract>();
  for (const stateName of sortedKeys(stateObject)) {
    const entry = asObject(stateObject[stateName]);
    if (entry === undefined) continue;
    const pointer = appendJsonPointer(statePointer, stateName);
    const schema = ownValue(entry, "schema") as JsonValue;
    states.set(stateName, Object.freeze({ schema, pointer }));

    const graphIssues = validateSchemaContractGraph(schema);
    if (graphIssues.length > 0) {
      graphIssues.forEach((issue) => {
        diagnostics.push(
          invalidBindingContractDiagnostic(
            appendRelativePointer(appendJsonPointer(pointer, "schema"), issue.pointer),
            context,
          ),
        );
      });
      continue;
    }

    let result: ReturnType<typeof applySchemaContract>;
    try {
      result = applySchemaContract(
        schema,
        ownValue(entry, "initial") as JsonValue,
        "complete",
        "resolved-value",
      );
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      diagnostics.push(
        invalidBindingContractDiagnostic(appendJsonPointer(pointer, "initial"), context),
      );
      continue;
    }
    result.issues.forEach((issue) => {
      diagnostics.push(
        invalidBindingContractDiagnostic(
          appendRelativePointer(appendJsonPointer(pointer, "initial"), issue.pointer),
          context,
        ),
      );
    });
  }
  return states;
}

function findRepeatAlias(
  scope: RepeatAliasScope | undefined,
  name: string,
): RepeatAliasScope | undefined {
  let current = scope;
  while (current !== undefined) {
    if (current.name === name) return current;
    current = current.parent;
  }
  return undefined;
}

function isReference(value: JsonValue): value is JsonObject {
  return isJsonObject(value) && Object.hasOwn(value, "$ref") && typeof value.$ref === "string";
}

function isToken(value: JsonValue): value is JsonObject {
  return isJsonObject(value) && Object.hasOwn(value, "$token") && typeof value.$token === "string";
}

function isFormat(value: JsonValue): value is JsonObject {
  return isJsonObject(value) && Object.hasOwn(value, "$format") && isJsonObject(value.$format);
}

function isPredicate(value: JsonValue): value is JsonObject {
  return (
    isJsonObject(value) &&
    Object.hasOwn(value, "op") &&
    typeof value.op === "string" &&
    Object.hasOwn(value, "args") &&
    Array.isArray(value.args)
  );
}

function inspectItemPath(
  template: JsonValue,
  path: readonly string[],
  scope: BindingScope,
  depth: number,
): ItemPathAnalysis {
  let current = template;
  for (const segment of path) {
    if (isReference(current) || isToken(current) || isFormat(current) || isPredicate(current)) {
      return Object.freeze({ kind: "unknown" });
    }
    if (!isJsonObject(current) || !Object.hasOwn(current, segment)) {
      return Object.freeze({ kind: "missing" });
    }
    current = current[segment] as JsonValue;
  }
  return Object.freeze({
    kind: "value",
    alternatives: knowledgeAlternatives(current, scope, depth + 1),
  });
}

function itemReferenceAnalysis(
  alias: RepeatAliasScope,
  path: readonly string[],
  scope: BindingScope,
  fallback: JsonValue | undefined,
  depth: number,
): ReferenceAnalysis {
  if (alias.itemTemplates === undefined) {
    return Object.freeze({
      lexicalValid: true,
      presence: "maybe",
      primary: Object.freeze([unknownKnowledge()]),
      ...(fallback === undefined ? {} : { fallback }),
    });
  }
  if (alias.itemTemplates.length === 0) {
    return Object.freeze({
      lexicalValid: true,
      presence: "inactive",
      primary: Object.freeze([unknownKnowledge()]),
      ...(fallback === undefined ? {} : { fallback }),
    });
  }

  const primary: ValueKnowledge[] = [];
  let missing = 0;
  let unknown = 0;
  for (const template of alias.itemTemplates) {
    const result = inspectItemPath(template, path, scope, depth + 1);
    if (result.kind === "missing") missing += 1;
    else if (result.kind === "unknown") {
      unknown += 1;
      primary.push(unknownKnowledge());
    } else primary.push(...result.alternatives);
  }

  const presence: ReferencePresence =
    missing === alias.itemTemplates.length
      ? "missing"
      : missing > 0
        ? "partial"
        : unknown > 0
          ? "maybe"
          : "always";
  return Object.freeze({
    lexicalValid: true,
    presence,
    primary: Object.freeze(primary),
    ...(fallback === undefined ? {} : { fallback }),
  });
}

function schemaReferenceAnalysis(
  schema: JsonValue,
  path: readonly string[],
  fallback: JsonValue | undefined,
): ReferenceAnalysis {
  const inspection = inspectSchemaContractPath(schema, path);
  const presence: ReferencePresence =
    inspection.reachability === "impossible" ? "missing" : path.length === 0 ? "always" : "maybe";
  const primary =
    inspection.reachability === "impossible"
      ? EMPTY_TYPES
      : Object.freeze([
          inspection.reachability === "unknown"
            ? unknownKnowledge()
            : typedKnowledge(inspection.types),
        ]);
  return Object.freeze({
    lexicalValid: true,
    presence,
    primary,
    ...(fallback === undefined ? {} : { fallback }),
  });
}

function referenceAnalysis(
  reference: JsonObject,
  scope: BindingScope,
  depth = 0,
): ReferenceAnalysis {
  const referenceText = reference.$ref as string;
  const segments = referenceText.split(".");
  const namespace = segments[0];
  const fallback = ownValue(reference, "fallback");
  if (depth > 128) {
    return Object.freeze({
      lexicalValid: true,
      presence: "maybe",
      primary: Object.freeze([unknownKnowledge()]),
      ...(fallback === undefined ? {} : { fallback }),
    });
  }

  if (namespace === "state") {
    const stateName = segments[1] as string;
    const state = scope.states.get(stateName);
    return state === undefined
      ? Object.freeze({ lexicalValid: false, presence: "missing", primary: EMPTY_KNOWLEDGE })
      : schemaReferenceAnalysis(state.schema, segments.slice(2), fallback);
  }
  if (namespace === "event") {
    return scope.eventSchema === undefined
      ? Object.freeze({ lexicalValid: false, presence: "missing", primary: EMPTY_KNOWLEDGE })
      : schemaReferenceAnalysis(scope.eventSchema, segments.slice(1), fallback);
  }
  if (namespace === "item") {
    const alias = findRepeatAlias(scope.repeat, segments[1] as string);
    return alias === undefined
      ? Object.freeze({ lexicalValid: false, presence: "missing", primary: EMPTY_KNOWLEDGE })
      : itemReferenceAnalysis(alias, segments.slice(2), scope, fallback, depth + 1);
  }

  // Resource and operation contracts belong to T11. Context and env are host/profile supplied.
  return Object.freeze({
    lexicalValid: true,
    presence: "maybe",
    primary: Object.freeze([unknownKnowledge()]),
    ...(fallback === undefined ? {} : { fallback }),
  });
}

function knowledgeAlternatives(
  value: JsonValue,
  scope: BindingScope,
  depth = 0,
): readonly ValueKnowledge[] {
  if (depth > 128) return Object.freeze([unknownKnowledge()]);
  if (!isReference(value)) return Object.freeze([staticKnowledge(value, scope, depth + 1)]);

  const analysis = referenceAnalysis(value, scope, depth + 1);
  if (!analysis.lexicalValid) return Object.freeze([unresolvedKnowledge()]);
  if (analysis.presence === "inactive") return Object.freeze([unknownKnowledge()]);
  if (analysis.presence === "missing") {
    return analysis.fallback === undefined
      ? Object.freeze([unresolvedKnowledge()])
      : knowledgeAlternatives(analysis.fallback, scope, depth + 1);
  }

  const alternatives = [...analysis.primary];
  if (analysis.presence !== "always" && analysis.fallback !== undefined) {
    alternatives.push(...knowledgeAlternatives(analysis.fallback, scope, depth + 1));
  }
  return Object.freeze(alternatives.length === 0 ? [unknownKnowledge()] : alternatives);
}

function collapseKnowledge(alternatives: readonly ValueKnowledge[]): ValueKnowledge {
  if (alternatives.length === 1) return alternatives[0] as ValueKnowledge;
  const resolved = alternatives.filter((knowledge) => knowledge.kind !== "unresolved");
  if (resolved.length === 0) return unresolvedKnowledge();
  if (resolved.some((knowledge) => knowledge.kind === "unknown")) return unknownKnowledge();
  return typedKnowledge(resolved.flatMap((knowledge) => knowledge.types));
}

function staticKnowledge(value: JsonValue, scope: BindingScope, depth = 0): ValueKnowledge {
  if (depth > 128) return unknownKnowledge();
  if (isReference(value)) return collapseKnowledge(knowledgeAlternatives(value, scope, depth + 1));
  if (isFormat(value)) return typedKnowledge(["string"]);
  if (isToken(value)) return unknownKnowledge();
  return literalKnowledge(value);
}

function predicateArgumentAlternatives(
  value: JsonValue,
  scope: BindingScope,
): readonly ValueKnowledge[] {
  return isPredicate(value)
    ? Object.freeze([typedKnowledge(["boolean"])])
    : knowledgeAlternatives(value, scope);
}

function staticReferenceEvaluation(
  reference: JsonObject,
  scope: BindingScope,
  itemValues: ReadonlyMap<string, JsonValue>,
  depth: number,
): StaticEvaluation {
  const segments = (reference.$ref as string).split(".");
  if (segments[0] === "item") {
    const alias = segments[1] as string;
    if (itemValues.has(alias)) {
      const item = itemValues.get(alias) as JsonValue;
      const resolved = evaluateItemTemplatePath(
        item,
        segments.slice(2),
        scope,
        itemValues,
        depth + 1,
      );
      if (resolved.kind === "value") return resolved;
      if (resolved.kind === "missing" && Object.hasOwn(reference, "fallback")) {
        return evaluateStaticValue(reference.fallback as JsonValue, scope, itemValues, depth + 1);
      }
      return resolved;
    }
  }
  return Object.freeze({ kind: "dynamic" });
}

function evaluateItemTemplatePath(
  template: JsonValue,
  path: readonly string[],
  scope: BindingScope,
  itemValues: ReadonlyMap<string, JsonValue>,
  depth: number,
): StaticEvaluation {
  let current = template;
  for (const segment of path) {
    if (isReference(current) || isToken(current) || isFormat(current) || isPredicate(current)) {
      return Object.freeze({ kind: "dynamic" });
    }
    if (!isJsonObject(current) || !Object.hasOwn(current, segment)) {
      return Object.freeze({ kind: "missing" });
    }
    current = current[segment] as JsonValue;
  }
  return evaluateStaticValue(current, scope, itemValues, depth + 1);
}

function evaluateStaticValue(
  value: JsonValue,
  scope: BindingScope,
  itemValues: ReadonlyMap<string, JsonValue> = new Map(),
  depth = 0,
): StaticEvaluation {
  if (depth > 128 || isToken(value) || isPredicate(value)) {
    return Object.freeze({ kind: "dynamic" });
  }
  if (isReference(value)) return staticReferenceEvaluation(value, scope, itemValues, depth);
  if (isFormat(value)) return Object.freeze({ kind: "dynamic" });
  if (Array.isArray(value)) {
    const resolved: JsonValue[] = [];
    for (const child of value) {
      const result = evaluateStaticValue(child, scope, itemValues, depth + 1);
      if (result.kind !== "value") return result;
      resolved.push(result.value);
    }
    return Object.freeze({ kind: "value", value: Object.freeze(resolved) });
  }
  if (isJsonObject(value)) {
    const resolved: Record<string, JsonValue> = Object.create(null) as Record<string, JsonValue>;
    for (const key of sortedKeys(value)) {
      const result = evaluateStaticValue(value[key] as JsonValue, scope, itemValues, depth + 1);
      if (result.kind !== "value") return result;
      resolved[key] = result.value;
    }
    return Object.freeze({ kind: "value", value: Object.freeze(resolved) as JsonObject });
  }
  return Object.freeze({ kind: "value", value });
}

function knowledgeAllows(
  knowledge: ValueKnowledge,
  allowed: ReadonlySet<SchemaContractJsonType>,
): boolean {
  return (
    knowledge.kind === "unknown" ||
    knowledge.kind === "unresolved" ||
    knowledge.types.some((type) => allowed.has(type))
  );
}

function everyKnownAlternativeAllows(
  alternatives: readonly ValueKnowledge[],
  allowed: ReadonlySet<SchemaContractJsonType>,
): boolean {
  return alternatives.every((knowledge) => knowledgeAllows(knowledge, allowed));
}

function knownAlternativesAreCompatible(
  left: readonly ValueKnowledge[],
  right: readonly ValueKnowledge[],
  allowed: ReadonlySet<SchemaContractJsonType>,
): boolean {
  const knownLeft = left.filter(
    (knowledge) => knowledge.kind !== "unknown" && knowledge.kind !== "unresolved",
  );
  const knownRight = right.filter(
    (knowledge) => knowledge.kind !== "unknown" && knowledge.kind !== "unresolved",
  );
  if (knownLeft.length === 0 || knownRight.length === 0) return true;

  const compatible = (subject: ValueKnowledge, peers: readonly ValueKnowledge[]): boolean => {
    return peers.some((peer) => {
      const peerTypes: readonly SchemaContractJsonType[] = peer.types;
      return subject.types.some((type) => allowed.has(type) && peerTypes.includes(type));
    });
  };
  return (
    knownLeft.every((knowledge) => compatible(knowledge, knownRight)) &&
    knownRight.every((knowledge) => compatible(knowledge, knownLeft))
  );
}

function parseFormatTemplate(template: string): ReadonlySet<string> | undefined {
  const names = new Set<string>();
  let index = 0;
  while (index < template.length) {
    const character = template[index] as string;
    if (character === "}") return undefined;
    if (character !== "{") {
      index += 1;
      continue;
    }

    const start = index + 1;
    let end = start;
    while (end < template.length && template[end] !== "}") {
      if (template[end] === "{") return undefined;
      end += 1;
    }
    if (end >= template.length || end === start) return undefined;
    const name = template.slice(start, end);
    const first = name.codePointAt(0) as number;
    const validStart =
      (first >= 65 && first <= 90) || (first >= 97 && first <= 122) || first === 95;
    if (!validStart) return undefined;
    for (let nameIndex = 1; nameIndex < name.length; nameIndex += 1) {
      const code = name.codePointAt(nameIndex) as number;
      if (!(
        (code >= 65 && code <= 90) ||
        (code >= 97 && code <= 122) ||
        (code >= 48 && code <= 57) ||
        code === 95
      )) {
        return undefined;
      }
    }
    names.add(name);
    index = end + 1;
  }
  return names;
}

function inspectFormat(
  value: JsonObject,
  pointer: JsonPointer,
  scope: BindingScope,
  diagnostics: DesenSemanticDiagnostic[],
  valueStack: ValueWork[],
  permitMissingReference: boolean,
): void {
  const format = value.$format as JsonObject;
  const template = format.template as string;
  const values = format.values as JsonObject;
  const names = parseFormatTemplate(template);
  const templatePointer = appendPath(pointer, "$format", "template");
  if (names === undefined || [...names].some((name) => !Object.hasOwn(values, name))) {
    diagnostics.push(invalidBindingContractDiagnostic(templatePointer, scope.context));
  }
  for (const key of sortedKeys(values)) {
    if (names !== undefined && !names.has(key)) {
      diagnostics.push(
        invalidBindingContractDiagnostic(
          appendPath(pointer, "$format", "values", key),
          scope.context,
        ),
      );
    }
    valueStack.push({
      value: values[key] as JsonValue,
      pointer: appendPath(pointer, "$format", "values", key),
      scope,
      ...(permitMissingReference ? { permitMissingReference: true } : {}),
    });
  }
}

function inspectReference(
  value: JsonObject,
  pointer: JsonPointer,
  scope: BindingScope,
  diagnostics: DesenSemanticDiagnostic[],
  valueStack: ValueWork[],
  suppressUnresolved: boolean,
  permitMissingReference: boolean,
): void {
  const analysis = referenceAnalysis(value, scope);
  const definitelyMissing = analysis.presence === "missing" || analysis.presence === "partial";
  const hasFallback = analysis.fallback !== undefined;
  if (
    !analysis.lexicalValid ||
    (!suppressUnresolved && !permitMissingReference && definitelyMissing && !hasFallback)
  ) {
    addCoreDiagnostic(
      diagnostics,
      "REFERENCE_UNRESOLVED",
      appendJsonPointer(pointer, "$ref"),
      scope.context,
    );
  }
  if (Object.hasOwn(value, "fallback")) {
    valueStack.push({
      value: value.fallback as JsonValue,
      pointer: appendJsonPointer(pointer, "fallback"),
      scope,
      ...(permitMissingReference ? { permitMissingReference: true } : {}),
    });
  }
}

function inspectValueWork(
  work: ValueWork,
  diagnostics: DesenSemanticDiagnostic[],
  valueStack: ValueWork[],
): void {
  if (isReference(work.value)) {
    inspectReference(
      work.value,
      work.pointer,
      work.scope,
      diagnostics,
      valueStack,
      work.suppressUnresolved === true,
      work.permitMissingReference === true,
    );
    return;
  }
  if (isToken(work.value)) return;
  if (isFormat(work.value)) {
    inspectFormat(
      work.value,
      work.pointer,
      work.scope,
      diagnostics,
      valueStack,
      work.permitMissingReference === true,
    );
    return;
  }
  if (Array.isArray(work.value)) {
    for (let index = work.value.length - 1; index >= 0; index -= 1) {
      valueStack.push({
        value: work.value[index] as JsonValue,
        pointer: appendJsonPointer(work.pointer, index),
        scope: work.scope,
        ...(work.permitMissingReference === true ? { permitMissingReference: true } : {}),
      });
    }
    return;
  }
  if (isJsonObject(work.value)) {
    const keys = sortedKeys(work.value);
    for (let index = keys.length - 1; index >= 0; index -= 1) {
      const key = keys[index] as string;
      valueStack.push({
        value: work.value[key] as JsonValue,
        pointer: appendJsonPointer(work.pointer, key),
        scope: work.scope,
        ...(work.permitMissingReference === true ? { permitMissingReference: true } : {}),
      });
    }
  }
}

function predicateMismatch(
  diagnostics: DesenSemanticDiagnostic[],
  pointer: JsonPointer,
  scope: BindingScope,
): void {
  addCoreDiagnostic(diagnostics, "PREDICATE_TYPE_MISMATCH", pointer, scope.context);
}

function validateOrderedPredicate(
  args: readonly JsonValue[],
  pointer: JsonPointer,
  scope: BindingScope,
  diagnostics: DesenSemanticDiagnostic[],
): void {
  const orderedTypes = new Set<SchemaContractJsonType>(["number", "string"]);
  const left = predicateArgumentAlternatives(args[0] as JsonValue, scope);
  const right = predicateArgumentAlternatives(args[1] as JsonValue, scope);
  if (!everyKnownAlternativeAllows(left, orderedTypes)) {
    predicateMismatch(diagnostics, appendPath(pointer, "args", 0), scope);
    return;
  }
  if (!everyKnownAlternativeAllows(right, orderedTypes)) {
    predicateMismatch(diagnostics, appendPath(pointer, "args", 1), scope);
    return;
  }
  if (!knownAlternativesAreCompatible(left, right, orderedTypes)) {
    predicateMismatch(diagnostics, appendPath(pointer, "args", 1), scope);
  }
}

function validateCollectionPredicate(
  op: "contains" | "in",
  args: readonly JsonValue[],
  pointer: JsonPointer,
  scope: BindingScope,
  diagnostics: DesenSemanticDiagnostic[],
): void {
  const collectionIndex = op === "in" ? 1 : 0;
  const memberIndex = op === "in" ? 0 : 1;
  const collection = predicateArgumentAlternatives(args[collectionIndex] as JsonValue, scope);
  const member = predicateArgumentAlternatives(args[memberIndex] as JsonValue, scope);
  const collectionTypes = new Set<SchemaContractJsonType>(["array", "string"]);
  if (!everyKnownAlternativeAllows(collection, collectionTypes)) {
    predicateMismatch(diagnostics, appendPath(pointer, "args", collectionIndex), scope);
    return;
  }
  const stringOnlyCollection = collection.some(
    (knowledge) =>
      knowledge.kind !== "unknown" &&
      knowledge.kind !== "unresolved" &&
      knowledge.types.includes("string") &&
      !knowledge.types.includes("array"),
  );
  if (
    stringOnlyCollection &&
    !everyKnownAlternativeAllows(member, new Set<SchemaContractJsonType>(["string"]))
  ) {
    predicateMismatch(diagnostics, appendPath(pointer, "args", memberIndex), scope);
  }
}

function inspectPredicateWork(
  work: PredicateWork,
  diagnostics: DesenSemanticDiagnostic[],
  predicateStack: PredicateWork[],
  valueStack: ValueWork[],
): void {
  const op = work.predicate.op as string;
  const args = work.predicate.args as readonly JsonValue[];
  for (let index = args.length - 1; index >= 0; index -= 1) {
    const argument = args[index] as JsonValue;
    if (isPredicate(argument)) {
      predicateStack.push({
        predicate: argument,
        pointer: appendPath(work.pointer, "args", index),
        scope: work.scope,
      });
    } else {
      valueStack.push({
        value: argument,
        pointer: appendPath(work.pointer, "args", index),
        scope: work.scope,
        permitMissingReference: true,
      });
    }
  }

  if (op === "exists") {
    if (!isReference(args[0] as JsonValue)) {
      predicateMismatch(diagnostics, appendPath(work.pointer, "args", 0), work.scope);
    }
    return;
  }
  if (op === "gt" || op === "gte" || op === "lt" || op === "lte") {
    validateOrderedPredicate(args, work.pointer, work.scope, diagnostics);
    return;
  }
  if (op === "in" || op === "contains") {
    validateCollectionPredicate(op, args, work.pointer, work.scope, diagnostics);
    return;
  }
  if (op === "all" || op === "any" || op === "not") {
    const booleanTypes = new Set<SchemaContractJsonType>(["boolean"]);
    args.forEach((argument, index) => {
      if (
        !everyKnownAlternativeAllows(
          predicateArgumentAlternatives(argument, work.scope),
          booleanTypes,
        )
      ) {
        predicateMismatch(diagnostics, appendPath(work.pointer, "args", index), work.scope);
      }
    });
  }
}

function pushValueMap(
  valueStack: ValueWork[],
  value: JsonValue | undefined,
  pointer: JsonPointer,
  scope: BindingScope,
): void {
  const object = asObject(value);
  if (object === undefined) return;
  const keys = sortedKeys(object);
  for (let index = keys.length - 1; index >= 0; index -= 1) {
    const key = keys[index] as string;
    valueStack.push({
      value: object[key] as JsonValue,
      pointer: appendJsonPointer(pointer, key),
      scope,
    });
  }
}

function pushStyleValues(
  valueStack: ValueWork[],
  style: JsonValue | undefined,
  pointer: JsonPointer,
  scope: BindingScope,
): void {
  const states = asObject(style);
  if (states === undefined) return;
  for (const stateName of [...sortedKeys(states)].reverse()) {
    const parts = asObject(states[stateName]);
    if (parts === undefined) continue;
    for (const partName of [...sortedKeys(parts)].reverse()) {
      pushValueMap(valueStack, parts[partName], appendPath(pointer, stateName, partName), scope);
    }
  }
}

function validateStaticRepeatKeys(
  key: JsonValue,
  pointer: JsonPointer,
  alias: string,
  itemTemplates: readonly JsonValue[],
  scope: BindingScope,
  diagnostics: DesenSemanticDiagnostic[],
): boolean {
  const identities = new Set<string>();
  for (const item of itemTemplates) {
    const result = evaluateStaticValue(key, scope, new Map([[alias, item]]));
    if (result.kind === "dynamic") continue;
    if (
      result.kind === "missing" ||
      (result.kind === "value" &&
        typeof result.value !== "string" &&
        typeof result.value !== "number")
    ) {
      addCoreDiagnostic(diagnostics, "REPEAT_KEY_INVALID", pointer, scope.context);
      return true;
    }
    if (result.kind !== "value") continue;
    const identity = canonicalizeJson(result.value);
    if (identities.has(identity)) {
      addCoreDiagnostic(diagnostics, "REPEAT_KEY_INVALID", pointer, scope.context);
      return true;
    }
    identities.add(identity);
  }
  return false;
}

function prepareNodeRepeat(
  node: JsonObject,
  pointer: JsonPointer,
  scope: BindingScope,
  diagnostics: DesenSemanticDiagnostic[],
  valueStack: ValueWork[],
): BindingScope {
  const repeat = asObject(ownValue(node, "repeat"));
  if (repeat === undefined) return scope;
  const repeatPointer = appendJsonPointer(pointer, "repeat");
  const items = ownValue(repeat, "items") as JsonValue;
  const key = ownValue(repeat, "key") as JsonValue;
  const alias = ownValue(repeat, "as") as string;
  valueStack.push({ value: items, pointer: appendJsonPointer(repeatPointer, "items"), scope });

  const itemAlternatives = knowledgeAlternatives(items, scope);
  if (!everyKnownAlternativeAllows(itemAlternatives, new Set<SchemaContractJsonType>(["array"]))) {
    addCoreDiagnostic(
      diagnostics,
      "REPEAT_ITEMS_INVALID",
      appendJsonPointer(repeatPointer, "items"),
      scope.context,
    );
  }
  if (findRepeatAlias(scope.repeat, alias) !== undefined) {
    diagnostics.push(
      invalidBindingContractDiagnostic(appendJsonPointer(repeatPointer, "as"), scope.context),
    );
  }

  const itemTemplates = Array.isArray(items) ? items : undefined;
  const limit = ownValue(repeat, "limit");
  if (itemTemplates !== undefined && typeof limit === "number" && itemTemplates.length > limit) {
    diagnostics.push(
      invalidBindingContractDiagnostic(appendJsonPointer(repeatPointer, "limit"), scope.context),
    );
  }
  const repeatScope = withRepeat(
    scope,
    Object.freeze({
      name: alias,
      ...(itemTemplates === undefined ? {} : { itemTemplates }),
      ...(scope.repeat === undefined ? {} : { parent: scope.repeat }),
    }),
  );
  const keyPointer = appendJsonPointer(repeatPointer, "key");
  const keyAlternatives = knowledgeAlternatives(key, repeatScope);
  let consumerDiagnosed = false;
  if (
    !everyKnownAlternativeAllows(
      keyAlternatives,
      new Set<SchemaContractJsonType>(["number", "string"]),
    )
  ) {
    addCoreDiagnostic(diagnostics, "REPEAT_KEY_INVALID", keyPointer, repeatScope.context);
    consumerDiagnosed = true;
  } else if (
    keyAlternatives.length > 0 &&
    keyAlternatives.every((knowledge) => knowledge.kind === "unresolved")
  ) {
    addCoreDiagnostic(diagnostics, "REPEAT_KEY_INVALID", keyPointer, repeatScope.context);
    consumerDiagnosed = true;
  } else if (itemTemplates !== undefined) {
    consumerDiagnosed = validateStaticRepeatKeys(
      key,
      keyPointer,
      alias,
      itemTemplates,
      repeatScope,
      diagnostics,
    );
  }
  valueStack.push({
    value: key,
    pointer: keyPointer,
    scope: repeatScope,
    ...(consumerDiagnosed ? { suppressUnresolved: true } : {}),
  });
  return repeatScope;
}

function pushNodeChildren(
  nodeStack: NodeWork[],
  slots: JsonValue | undefined,
  pointer: JsonPointer,
  scope: BindingScope,
): void {
  const slotMap = asObject(slots);
  if (slotMap === undefined) return;
  const names = sortedKeys(slotMap);
  for (let nameIndex = names.length - 1; nameIndex >= 0; nameIndex -= 1) {
    const name = names[nameIndex] as string;
    const children = asArray(slotMap[name]) ?? [];
    for (let childIndex = children.length - 1; childIndex >= 0; childIndex -= 1) {
      const child = asObject(children[childIndex]);
      if (child !== undefined) {
        nodeStack.push({
          node: child,
          pointer: appendPath(pointer, name, childIndex),
          scope,
        });
      }
    }
  }
}

function pushHandlerActions(
  actionStack: ActionWork[],
  handlers: JsonValue | undefined,
  pointer: JsonPointer,
  scope: BindingScope,
  capabilityKind: "behavior" | "component",
  capabilityId: string,
): void {
  const handlerMap = asObject(handlers);
  if (handlerMap === undefined) return;
  const eventNames = sortedKeys(handlerMap);
  for (let eventIndex = eventNames.length - 1; eventIndex >= 0; eventIndex -= 1) {
    const eventName = eventNames[eventIndex] as string;
    const actions = asArray(handlerMap[eventName]) ?? [];
    const schema = getPreparedDesenEventPayloadSchema(
      scope.catalogSet,
      capabilityKind,
      capabilityId,
      eventName,
    );
    const eventScope = withEvent(scope, schema as JsonValue | undefined);
    for (let actionIndex = actions.length - 1; actionIndex >= 0; actionIndex -= 1) {
      const action = asObject(actions[actionIndex]);
      if (action !== undefined) {
        actionStack.push({
          action,
          pointer: appendPath(pointer, eventName, actionIndex),
          scope: eventScope,
        });
      }
    }
  }
}

function inspectBehavior(
  behavior: JsonObject,
  index: number,
  nodePointer: JsonPointer,
  nodeScope: BindingScope,
  nodeStack: NodeWork[],
  actionStack: ActionWork[],
  valueStack: ValueWork[],
): void {
  const pointer = appendPath(nodePointer, "behaviors", index);
  const id = stringField(behavior, "id") as string;
  const capabilityId = stringField(behavior, "use") as string;
  const scope = withSubject(nodeScope, "behavior", id, capabilityId);
  pushValueMap(valueStack, ownValue(behavior, "props"), appendJsonPointer(pointer, "props"), scope);
  pushStyleValues(
    valueStack,
    ownValue(behavior, "style"),
    appendJsonPointer(pointer, "style"),
    scope,
  );
  pushNodeChildren(
    nodeStack,
    ownValue(behavior, "slots"),
    appendJsonPointer(pointer, "slots"),
    nodeScope,
  );
  pushHandlerActions(
    actionStack,
    ownValue(behavior, "on"),
    appendJsonPointer(pointer, "on"),
    scope,
    "behavior",
    capabilityId,
  );
}

function inspectNodeWork(
  work: NodeWork,
  diagnostics: DesenSemanticDiagnostic[],
  nodeStack: NodeWork[],
  actionStack: ActionWork[],
  predicateStack: PredicateWork[],
  valueStack: ValueWork[],
): void {
  const id = stringField(work.node, "id") as string;
  const capabilityId = stringField(work.node, "use") as string;
  const subjectScope = withSubject(work.scope, "node", id, capabilityId);
  const nodeScope = prepareNodeRepeat(
    work.node,
    work.pointer,
    subjectScope,
    diagnostics,
    valueStack,
  );

  pushValueMap(
    valueStack,
    ownValue(work.node, "props"),
    appendJsonPointer(work.pointer, "props"),
    nodeScope,
  );
  pushStyleValues(
    valueStack,
    ownValue(work.node, "style"),
    appendJsonPointer(work.pointer, "style"),
    nodeScope,
  );
  const when = asObject(ownValue(work.node, "when"));
  if (when !== undefined) {
    predicateStack.push({
      predicate: when,
      pointer: appendJsonPointer(work.pointer, "when"),
      scope: nodeScope,
    });
  }

  const variants = asArray(ownValue(work.node, "variants")) ?? [];
  for (let index = variants.length - 1; index >= 0; index -= 1) {
    const variant = asObject(variants[index]);
    if (variant === undefined) continue;
    const pointer = appendPath(work.pointer, "variants", index);
    const predicate = asObject(ownValue(variant, "when"));
    if (predicate !== undefined) {
      predicateStack.push({
        predicate,
        pointer: appendJsonPointer(pointer, "when"),
        scope: nodeScope,
      });
    }
    pushValueMap(
      valueStack,
      ownValue(variant, "props"),
      appendJsonPointer(pointer, "props"),
      nodeScope,
    );
    pushStyleValues(
      valueStack,
      ownValue(variant, "style"),
      appendJsonPointer(pointer, "style"),
      nodeScope,
    );
  }

  const behaviors = asArray(ownValue(work.node, "behaviors")) ?? [];
  for (let index = behaviors.length - 1; index >= 0; index -= 1) {
    const behavior = asObject(behaviors[index]);
    if (behavior !== undefined) {
      inspectBehavior(behavior, index, work.pointer, nodeScope, nodeStack, actionStack, valueStack);
    }
  }

  pushHandlerActions(
    actionStack,
    ownValue(work.node, "on"),
    appendJsonPointer(work.pointer, "on"),
    nodeScope,
    "component",
    capabilityId,
  );
  pushNodeChildren(
    nodeStack,
    ownValue(work.node, "slots"),
    appendJsonPointer(work.pointer, "slots"),
    nodeScope,
  );
}

function pushActionValueFields(work: ActionWork, valueStack: ValueWork[]): void {
  const { action, pointer, scope } = work;
  switch (action.type) {
    case "state.set":
      valueStack.push({
        value: ownValue(action, "value") as JsonValue,
        pointer: appendJsonPointer(pointer, "value"),
        scope,
      });
      break;
    case "navigate":
      pushValueMap(
        valueStack,
        ownValue(action, "params"),
        appendJsonPointer(pointer, "params"),
        scope,
      );
      break;
    case "operation.invoke":
      pushValueMap(
        valueStack,
        ownValue(action, "input"),
        appendJsonPointer(pointer, "input"),
        scope,
      );
      break;
    case "component.command":
      pushValueMap(
        valueStack,
        ownValue(action, "input"),
        appendJsonPointer(pointer, "input"),
        scope,
      );
      break;
    case "event.emit":
      pushValueMap(
        valueStack,
        ownValue(action, "payload"),
        appendJsonPointer(pointer, "payload"),
        scope,
      );
      break;
    default:
      break;
  }
}

function inspectActionWork(
  work: ActionWork,
  diagnostics: DesenSemanticDiagnostic[],
  actionStack: ActionWork[],
  predicateStack: PredicateWork[],
  valueStack: ValueWork[],
): void {
  const when = asObject(ownValue(work.action, "when"));
  if (when !== undefined) {
    predicateStack.push({
      predicate: when,
      pointer: appendJsonPointer(work.pointer, "when"),
      scope: work.scope,
    });
  }
  pushActionValueFields(work, valueStack);

  if (work.action.type === "state.set" || work.action.type === "state.toggle") {
    const path = ownValue(work.action, "path") as string;
    const stateName = path.split(".")[0] as string;
    if (!work.scope.states.has(stateName)) {
      addCoreDiagnostic(
        diagnostics,
        "STATE_WRITE_INVALID",
        appendJsonPointer(work.pointer, "path"),
        work.scope.context,
      );
    }
  }

  if (work.action.type !== "operation.invoke") return;
  const settlementScope = withoutEvent(work.scope);
  for (const field of ["onFailure", "onSuccess"] as const) {
    const actions = asArray(ownValue(work.action, field)) ?? [];
    for (let index = actions.length - 1; index >= 0; index -= 1) {
      const action = asObject(actions[index]);
      if (action !== undefined) {
        actionStack.push({
          action,
          pointer: appendPath(work.pointer, field, index),
          scope: settlementScope,
        });
      }
    }
  }
}

function surfaceBindingDiagnostics(
  documentId: string,
  surfaceId: string,
  surface: JsonObject,
  catalogSet: DesenValidatedInteractionCatalogSet,
  diagnostics: DesenSemanticDiagnostic[],
): void {
  const context = bindingContext(documentId, surfaceId);
  const statePointer = appendPath(ROOT_POINTER, "surfaces", surfaceId, "state");
  const stateObject = asObject(ownValue(surface, "state")) ?? Object.freeze({});
  const states = validateStateContracts(stateObject, statePointer, context, diagnostics);
  const baseScope: BindingScope = Object.freeze({ catalogSet, context, states });
  const nodeStack: NodeWork[] = [];
  const actionStack: ActionWork[] = [];
  const predicateStack: PredicateWork[] = [];
  const valueStack: ValueWork[] = [];

  const root = asObject(ownValue(surface, "root"));
  if (root !== undefined) {
    nodeStack.push({
      node: root,
      pointer: appendPath(ROOT_POINTER, "surfaces", surfaceId, "root"),
      scope: baseScope,
    });
  }

  const resources = asObject(ownValue(surface, "resources"));
  if (resources !== undefined) {
    for (const resourceName of [...sortedKeys(resources)].reverse()) {
      const resource = asObject(resources[resourceName]);
      if (resource !== undefined) {
        pushValueMap(
          valueStack,
          ownValue(resource, "input"),
          appendPath(ROOT_POINTER, "surfaces", surfaceId, "resources", resourceName, "input"),
          baseScope,
        );
      }
    }
  }

  while (nodeStack.length > 0) {
    inspectNodeWork(
      nodeStack.pop() as NodeWork,
      diagnostics,
      nodeStack,
      actionStack,
      predicateStack,
      valueStack,
    );
  }
  while (actionStack.length > 0) {
    inspectActionWork(
      actionStack.pop() as ActionWork,
      diagnostics,
      actionStack,
      predicateStack,
      valueStack,
    );
  }
  while (predicateStack.length > 0) {
    inspectPredicateWork(
      predicateStack.pop() as PredicateWork,
      diagnostics,
      predicateStack,
      valueStack,
    );
  }
  while (valueStack.length > 0) {
    inspectValueWork(valueStack.pop() as ValueWork, diagnostics, valueStack);
  }
}

function bindingDocumentDiagnostics(
  document: DocumentSnapshot,
  catalogSet: DesenValidatedInteractionCatalogSet,
): readonly DesenSemanticDiagnostic[] {
  const diagnostics: DesenSemanticDiagnostic[] = [];
  const snapshot = document as unknown as JsonObject;
  const surfaces = asObject(ownValue(snapshot, "surfaces"));
  if (surfaces === undefined) return EMPTY_DIAGNOSTICS;
  for (const surfaceId of sortedKeys(surfaces)) {
    const surface = asObject(surfaces[surfaceId]);
    if (surface !== undefined) {
      surfaceBindingDiagnostics(document.id, surfaceId, surface, catalogSet, diagnostics);
    }
  }
  return normalizeSemanticDiagnostics(diagnostics);
}

/**
 * Applies cumulative structural, semantic, catalog, interaction, and static binding checks.
 *
 * @remarks T10 validates inert state initial values, surface-local state/item/event references,
 * format placeholders, statically decidable predicate operand types, repeat item/key contracts,
 * and the immediate event-action turn. Resource/operation semantics, complete state-action writes,
 * runtime value resolution, predicate execution, and dynamic repeat instances remain later-stage
 * responsibilities. The exact catalog set prepared by `validateDesenInteractionCatalogSet` is
 * required; a nominal cast cannot cross T09's private runtime trust boundary.
 */
export function validateDesenBindingContracts<Target extends DesenBindingContractTarget>(
  target: Target,
  input: unknown,
  catalogSet: DesenValidatedInteractionCatalogSet,
): DesenBindingContractValidationResult<Target> {
  const interactions = validateDesenInteractionContracts(target, input, catalogSet);
  if (!interactions.valid) {
    return bindingFailure(target, interactions.diagnostics, interactions.obligations);
  }
  const diagnostics = bindingDocumentDiagnostics(
    interactions.value as SourceSnapshot | BundleSnapshot,
    catalogSet,
  );
  return diagnostics.length === 0
    ? bindingSuccess(target, interactions.value, interactions.obligations)
    : bindingFailure(target, diagnostics, interactions.obligations);
}

/** Validates a Source cumulatively through the M02-T10 binding-contract boundary. */
export function validateDesenSourceBindingContracts(
  input: unknown,
  catalogSet: DesenValidatedInteractionCatalogSet,
): DesenBindingContractValidationResult<"source"> {
  return validateDesenBindingContracts("source", input, catalogSet);
}

/** Validates a Bundle cumulatively through the M02-T10 binding-contract boundary. */
export function validateDesenBundleBindingContracts(
  input: unknown,
  catalogSet: DesenValidatedInteractionCatalogSet,
): DesenBindingContractValidationResult<"bundle"> {
  return validateDesenBindingContracts("bundle", input, catalogSet);
}
