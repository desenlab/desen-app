import {
  appendJsonPointer,
  canonicalizeJson,
  createJsonPointer,
  digestCanonicalJson,
} from "@desen/protocol";
import { validateDesenExecutionCatalogSet } from "@desen/validator";

import {
  createRuntimeRepeatRootScope,
  createRuntimeRepeatedNodeIdentity,
  createRuntimeResolutionSnapshotForRepeatScope,
  materializeRuntimeRepeat,
} from "./repeat-materialization.js";
import { createRuntimeNodeIdentity } from "./node-identity.js";
import { isRuntimeJsonObject, snapshotRuntimeJsonValue } from "./runtime-json-snapshot.js";
import { materializeRuntimeValue } from "./token-format-resolution.js";
import { resolveRuntimeValue } from "./value-resolution.js";
import { evaluateRuntimeVariantOverrides } from "./variant-style-evaluation.js";

import type { DesenBundle, DesenCatalog, JsonPointer } from "@desen/protocol";
import type { DesenValidatedExecutionCatalogSet, ImmutableJson } from "@desen/validator";
import type {
  RuntimeJsonObject,
  RuntimeJsonValue,
  RuntimeTokenPort,
  RuntimeTokenResolution,
} from "./host-ports.js";
import type { RuntimeAdapterNodeIdentity } from "./adapter-bridges.js";
import type {
  RuntimeRepeatKey,
  RuntimeRepeatScope,
  RuntimeRepeatSpec,
} from "./repeat-materialization.js";
import type { RuntimeValueMaterializationContext } from "./token-format-resolution.js";
import type { RuntimePredicateSpec } from "./predicate-evaluation.js";
import type { RuntimeResolutionSnapshot, RuntimeValueSpec } from "./value-resolution.js";
import type {
  RuntimePropValueSpecs,
  RuntimeStyleValueSpecs,
  RuntimeVariantOverrideSpec,
} from "./variant-style-evaluation.js";

const ROOT_POINTER = createJsonPointer();
const LOCAL_IDENTIFIER_PATTERN = /^[A-Za-z][A-Za-z0-9._:-]{0,127}$/u;
const SIDECAR_AUTHORITIES = new WeakMap<object, StoredSidecar>();
declare const RUNTIME_HEADLESS_MATERIALIZATION_SIDECAR_TYPE_BRAND: unique symbol;

type BundleSurface = ImmutableJson<DesenBundle>["surfaces"][string];
type BundleNode = BundleSurface["root"];
type BundleBehavior = NonNullable<BundleNode["behaviors"]>[number];
type BundleAction = NonNullable<BundleNode["on"]>[string][number];
type CatalogSnapshot = ImmutableJson<DesenCatalog>;
type ComponentContract = CatalogSnapshot["components"][string];
type BehaviorContract = CatalogSnapshot["behaviors"][string];

/** Reference-profile ceilings for one complete framework-neutral surface materialization. */
export const RUNTIME_HEADLESS_MATERIALIZATION_LIMITS = Object.freeze({
  /** Maximum instantiated component nodes after all nested repeats expand. */
  maxNodes: 5_000,
  /** Maximum root-to-descendant source-tree depth, with the root at depth zero. */
  maxDepth: 128,
  /** Maximum JSON value and member occurrences retained by the observable plan. */
  maxJsonOccurrences: 262_144,
  /** Maximum combined UTF-16 code units retained in plan keys and string values. */
  maxStringCodeUnits: 4_194_304,
  /** Maximum instances admitted by any one repeat declaration. */
  maxRepeatInstances: 1_000,
} as const);

/** Optional trusted profile that may only lower headless materialization ceilings. */
export interface RuntimeHeadlessMaterializationLimitProfile {
  readonly maxNodes?: number;
  readonly maxDepth?: number;
  readonly maxJsonOccurrences?: number;
  readonly maxStringCodeUnits?: number;
  readonly maxRepeatInstances?: number;
}

/** One JSON-only attached-behavior description in a headless node plan. */
export interface RuntimeHeadlessBehaviorPlan {
  /** Stable identity derived from the owning component instance and behavior source id. */
  readonly identity: string;
  /** Exact behavior source id. */
  readonly id: string;
  /** Exact declared behavior capability id. */
  readonly use: string;
  /** Fully materialized resolved props. */
  readonly props: RuntimeJsonObject;
  /** Fully materialized resolved style states, parts, and properties. */
  readonly style: RuntimeJsonObject;
  /** Materialized behavior-slot children keyed by canonical slot name order. */
  readonly slots: Readonly<Record<string, readonly RuntimeHeadlessNodePlan[]>>;
}

/** One immutable JSON-only component instance in source/repeat order. */
export interface RuntimeHeadlessNodePlan {
  /** Stable document/surface/source-node/repeat-key identity. */
  readonly identity: string;
  /** Exact authoring and diagnostic node id. */
  readonly sourceNodeId: string;
  /** Exact declared component capability id. */
  readonly use: string;
  /** Fully materialized resolved props, with unresolved optional props omitted. */
  readonly props: RuntimeJsonObject;
  /** Fully materialized resolved style states, parts, and properties. */
  readonly style: RuntimeJsonObject;
  /** Materialized component-slot children in source-array order. */
  readonly slots: Readonly<Record<string, readonly RuntimeHeadlessNodePlan[]>>;
  /** Attached behaviors in exact source-array order. */
  readonly behaviors: readonly RuntimeHeadlessBehaviorPlan[];
}

/** Complete protocol-observable headless plan for one active surface. */
export interface RuntimeHeadlessSurfacePlan {
  /** Active Bundle document id. */
  readonly documentId: string;
  /** Active surface id. */
  readonly surfaceId: string;
  /** Zero, one, or repeated root instances in repeat source order. */
  readonly root: readonly RuntimeHeadlessNodePlan[];
}

/**
 * Compact JSON value published through M04-T15.
 *
 * @remarks The evaluation id is deliberately excluded: equivalent reevaluations keep identical
 * bytes while the private sidecar remains authenticated to the exact evaluator attempt.
 */
export interface RuntimeHeadlessMaterializationCommitment {
  readonly status: "materialized";
  readonly planDigest: string;
  readonly bindingDigest: string;
}

/** Opaque authority for one exact evaluation's non-JSON binding sidecar. */
export interface RuntimeHeadlessMaterializationSidecar {
  readonly [RUNTIME_HEADLESS_MATERIALIZATION_SIDECAR_TYPE_BRAND]: true;
}

/** Complete trusted inputs for one already-validated immutable Bundle surface. */
export interface RuntimeHeadlessMaterializationInput {
  readonly documentId: string;
  readonly surfaceId: string;
  readonly surface: BundleSurface;
  readonly catalogSet: DesenValidatedExecutionCatalogSet;
  readonly resolutionSnapshot: RuntimeResolutionSnapshot;
  readonly materializationContext: RuntimeValueMaterializationContext;
  readonly evaluationId: string;
  readonly limits?: RuntimeHeadlessMaterializationLimitProfile;
}

/** Stable fail-closed reason that produced no observable partial plan. */
export type RuntimeHeadlessMaterializationInvalidReason =
  | "catalog-authentication-failed"
  | "digest-failed"
  | "invalid-snapshot"
  | "malformed-input"
  | "malformed-limits"
  | "materialization-failed"
  | "repeat-invalid"
  | "required-prop-unresolved"
  | "token-provider-failed"
  | "unsafe-surface";

/** Stable finite ceiling crossed without truncating the observable surface. */
export type RuntimeHeadlessMaterializationLimitReason =
  | "depth-limit"
  | "json-occurrence-limit"
  | "node-limit"
  | "repeat-limit"
  | "string-code-unit-limit";

/** Complete all-or-nothing materialization result. */
export type RuntimeHeadlessMaterializationResult =
  | Readonly<{
      readonly status: "materialized";
      readonly commitment: RuntimeHeadlessMaterializationCommitment;
      readonly plan: RuntimeHeadlessSurfacePlan;
      readonly sidecar: RuntimeHeadlessMaterializationSidecar;
    }>
  | Readonly<{
      readonly status: "invalid";
      readonly reason: RuntimeHeadlessMaterializationInvalidReason;
      readonly pointer: JsonPointer;
    }>
  | Readonly<{
      readonly status: "limit-exceeded";
      readonly reason: RuntimeHeadlessMaterializationLimitReason;
      readonly limit: number;
      readonly observed: number;
      readonly pointer: JsonPointer;
    }>;

/** Factory-authenticated scope retained only behind the sidecar authority. */
export interface RuntimeHeadlessBindingScope {
  readonly resolutionSnapshot: RuntimeResolutionSnapshot;
  readonly repeatScope: RuntimeRepeatScope;
  readonly repeatKeys: readonly RuntimeRepeatKey[];
}

/** One component event selector and exact inert action programs retained by the sidecar. */
export interface RuntimeHeadlessComponentBindingIntent {
  readonly kind: "component";
  readonly sourceNodeId: string;
  readonly capabilityId: string;
  readonly identity: RuntimeAdapterNodeIdentity;
  readonly scope: RuntimeRepeatScope;
  readonly handledEvents: readonly string[];
  readonly handlers: Readonly<Record<string, readonly BundleAction[]>>;
}

/** One behavior event selector owned by an exact materialized component instance. */
export interface RuntimeHeadlessBehaviorBindingIntent {
  readonly kind: "behavior";
  readonly sourceNodeId: string;
  readonly behaviorId: string;
  readonly capabilityId: string;
  readonly identity: string;
  readonly ownerRuntimeInstanceId: string;
  readonly scope: RuntimeRepeatScope;
  readonly handledEvents: readonly string[];
  readonly handlers: Readonly<Record<string, readonly BundleAction[]>>;
}

/** Root-hidden union consumed by the M04-T16 session compositor. */
export type RuntimeHeadlessBindingIntent =
  RuntimeHeadlessComponentBindingIntent | RuntimeHeadlessBehaviorBindingIntent;

/** Authenticated root-hidden read result for one exact evaluator attempt. */
export type RuntimeHeadlessMaterializationSidecarReadResult =
  | Readonly<{
      readonly status: "read";
      readonly evaluationId: string;
      readonly plan: RuntimeHeadlessSurfacePlan;
      readonly commitment: RuntimeHeadlessMaterializationCommitment;
      readonly intents: readonly RuntimeHeadlessBindingIntent[];
    }>
  | Readonly<{ readonly status: "invalid-sidecar" | "evaluation-mismatch" }>;

interface StoredSidecar {
  readonly evaluationId: string;
  readonly plan: RuntimeHeadlessSurfacePlan;
  readonly commitment: RuntimeHeadlessMaterializationCommitment;
  readonly intents: readonly RuntimeHeadlessBindingIntent[];
}

interface CapturedInput {
  readonly documentId: string;
  readonly surfaceId: string;
  readonly surface: BundleSurface;
  readonly catalogSet: DesenValidatedExecutionCatalogSet;
  readonly resolutionSnapshot: RuntimeResolutionSnapshot;
  readonly materializationContext: RuntimeValueMaterializationContext;
  readonly evaluationId: string;
  readonly limits: Required<RuntimeHeadlessMaterializationLimitProfile>;
}

interface CatalogContracts {
  readonly components: ReadonlyMap<string, ComponentContract>;
  readonly behaviors: ReadonlyMap<string, BehaviorContract>;
}

interface MaterializationState {
  readonly input: CapturedInput;
  readonly contracts: CatalogContracts;
  readonly context: RuntimeValueMaterializationContext;
  readonly intents: RuntimeHeadlessBindingIntent[];
  nodes: number;
}

interface MutableBehaviorPlan {
  identity: string;
  id: string;
  use: string;
  props: RuntimeJsonObject;
  style: RuntimeJsonObject;
  slots: Record<string, RuntimeHeadlessNodePlan[]>;
}

interface MutableNodePlan {
  identity: string;
  sourceNodeId: string;
  use: string;
  props: RuntimeJsonObject;
  style: RuntimeJsonObject;
  slots: Record<string, RuntimeHeadlessNodePlan[]>;
  behaviors: MutableBehaviorPlan[];
}

interface NodeWork {
  readonly node: BundleNode;
  readonly scope: RuntimeRepeatScope;
  readonly resolvedScope?: RuntimeRepeatScope;
  readonly depth: number;
  readonly pointer: JsonPointer;
  readonly destination: RuntimeHeadlessNodePlan[];
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function ownDataValue(
  object: object,
  key: string,
):
  | Readonly<{ readonly valid: true; readonly present: true; readonly value: unknown }>
  | Readonly<{ readonly valid: true; readonly present: false }>
  | Readonly<{ readonly valid: false; readonly present: boolean }> {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(object, key);
    if (descriptor === undefined) return Object.freeze({ valid: true, present: false });
    return descriptor.enumerable && "value" in descriptor
      ? Object.freeze({ valid: true, present: true, value: descriptor.value })
      : Object.freeze({ valid: false, present: true });
  } catch {
    return Object.freeze({ valid: false, present: false });
  }
}

function exactOwnKeys(
  object: object,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean {
  try {
    const keys = Reflect.ownKeys(object);
    const allowed = new Set([...required, ...optional]);
    return (
      keys.every((key) => typeof key === "string" && allowed.has(key)) &&
      required.every((key) => keys.includes(key)) &&
      keys.every((key) => {
        const descriptor = Object.getOwnPropertyDescriptor(object, key);
        return descriptor !== undefined && descriptor.enumerable && "value" in descriptor;
      })
    );
  } catch {
    return false;
  }
}

function invalid(
  reason: RuntimeHeadlessMaterializationInvalidReason,
  pointer: JsonPointer = ROOT_POINTER,
): Extract<RuntimeHeadlessMaterializationResult, { readonly status: "invalid" }> {
  return Object.freeze({ status: "invalid", reason, pointer });
}

function limitExceeded(
  reason: RuntimeHeadlessMaterializationLimitReason,
  limit: number,
  observed: number,
  pointer: JsonPointer,
): Extract<RuntimeHeadlessMaterializationResult, { readonly status: "limit-exceeded" }> {
  return Object.freeze({ status: "limit-exceeded", reason, limit, observed, pointer });
}

function captureLimits(
  input: unknown,
): Required<RuntimeHeadlessMaterializationLimitProfile> | undefined {
  const defaults: Required<RuntimeHeadlessMaterializationLimitProfile> = {
    ...RUNTIME_HEADLESS_MATERIALIZATION_LIMITS,
  };
  if (input === undefined) return Object.freeze(defaults);
  if (!isPlainRecord(input)) return undefined;
  const keys = [
    "maxDepth",
    "maxJsonOccurrences",
    "maxNodes",
    "maxRepeatInstances",
    "maxStringCodeUnits",
  ] as const;
  if (!exactOwnKeys(input, [], keys)) return undefined;
  const captured = { ...defaults };
  for (const key of keys) {
    const member = ownDataValue(input, key);
    if (!member.valid) return undefined;
    if (!member.present) continue;
    const value = member.value;
    const minimum = key === "maxRepeatInstances" ? 1 : 0;
    if (
      typeof value !== "number" ||
      !Number.isSafeInteger(value) ||
      value < minimum ||
      value > RUNTIME_HEADLESS_MATERIALIZATION_LIMITS[key]
    ) {
      return undefined;
    }
    captured[key] = value;
  }
  return Object.freeze(captured);
}

function inspectFrozenJson(
  input: unknown,
  limits: Required<RuntimeHeadlessMaterializationLimitProfile>,
):
  | Readonly<{ readonly status: "valid" }>
  | Extract<
      RuntimeHeadlessMaterializationResult,
      { readonly status: "invalid" | "limit-exceeded" }
    > {
  const pending: {
    readonly value: unknown;
    readonly depth: number;
    readonly pointer: JsonPointer;
  }[] = [{ value: input, depth: 0, pointer: ROOT_POINTER }];
  const visited = new WeakSet<object>();
  let occurrences = 0;
  let codeUnits = 0;

  try {
    while (pending.length > 0) {
      const current = pending.pop() as {
        readonly value: unknown;
        readonly depth: number;
        readonly pointer: JsonPointer;
      };
      occurrences += 1;
      if (occurrences > limits.maxJsonOccurrences) {
        return limitExceeded(
          "json-occurrence-limit",
          limits.maxJsonOccurrences,
          occurrences,
          current.pointer,
        );
      }
      if (typeof current.value === "string") {
        codeUnits += current.value.length;
        if (codeUnits > limits.maxStringCodeUnits) {
          return limitExceeded(
            "string-code-unit-limit",
            limits.maxStringCodeUnits,
            codeUnits,
            current.pointer,
          );
        }
        continue;
      }
      if (
        current.value === null ||
        typeof current.value === "boolean" ||
        (typeof current.value === "number" && Number.isFinite(current.value))
      ) {
        continue;
      }
      if (typeof current.value !== "object" || !Object.isFrozen(current.value)) {
        return invalid("unsafe-surface", current.pointer);
      }
      if (visited.has(current.value)) return invalid("unsafe-surface", current.pointer);
      visited.add(current.value);

      if (Array.isArray(current.value)) {
        const lengthDescriptor = Object.getOwnPropertyDescriptor(current.value, "length");
        const keys = Reflect.ownKeys(current.value);
        if (
          lengthDescriptor === undefined ||
          !("value" in lengthDescriptor) ||
          !Number.isSafeInteger(lengthDescriptor.value) ||
          keys.length !== lengthDescriptor.value + 1 ||
          keys.some((key) => typeof key !== "string") ||
          !keys.includes("length")
        ) {
          return invalid("unsafe-surface", current.pointer);
        }
        for (let index = lengthDescriptor.value - 1; index >= 0; index -= 1) {
          const element = ownDataValue(current.value, String(index));
          if (!element.valid || !element.present) return invalid("unsafe-surface", current.pointer);
          pending.push({
            value: element.value,
            depth: current.depth + 1,
            pointer: appendJsonPointer(current.pointer, index),
          });
        }
        continue;
      }

      if (!isPlainRecord(current.value)) return invalid("unsafe-surface", current.pointer);
      const keys = Reflect.ownKeys(current.value);
      if (keys.some((key) => typeof key !== "string")) {
        return invalid("unsafe-surface", current.pointer);
      }
      const names = (keys as string[]).sort(compareText);
      for (let index = names.length - 1; index >= 0; index -= 1) {
        const key = names[index] as string;
        const member = ownDataValue(current.value, key);
        if (!member.valid || !member.present) return invalid("unsafe-surface", current.pointer);
        codeUnits += key.length;
        if (codeUnits > limits.maxStringCodeUnits) {
          return limitExceeded(
            "string-code-unit-limit",
            limits.maxStringCodeUnits,
            codeUnits,
            appendJsonPointer(current.pointer, key),
          );
        }
        pending.push({
          value: member.value,
          depth: current.depth + 1,
          pointer: appendJsonPointer(current.pointer, key),
        });
      }
    }
  } catch {
    return invalid("unsafe-surface");
  }
  return Object.freeze({ status: "valid" });
}

function captureInput(
  input: RuntimeHeadlessMaterializationInput,
):
  | Readonly<{ readonly status: "captured"; readonly input: CapturedInput }>
  | Extract<
      RuntimeHeadlessMaterializationResult,
      { readonly status: "invalid" | "limit-exceeded" }
    > {
  if (
    !isPlainRecord(input) ||
    (!exactOwnKeys(
      input,
      [
        "catalogSet",
        "documentId",
        "evaluationId",
        "materializationContext",
        "resolutionSnapshot",
        "surface",
        "surfaceId",
      ],
      ["limits"],
    ) &&
      !exactOwnKeys(input, [
        "catalogSet",
        "documentId",
        "evaluationId",
        "limits",
        "materializationContext",
        "resolutionSnapshot",
        "surface",
        "surfaceId",
      ]))
  ) {
    return invalid("malformed-input");
  }
  const documentId = ownDataValue(input, "documentId");
  const surfaceId = ownDataValue(input, "surfaceId");
  const surface = ownDataValue(input, "surface");
  const catalogSet = ownDataValue(input, "catalogSet");
  const resolutionSnapshot = ownDataValue(input, "resolutionSnapshot");
  const materializationContext = ownDataValue(input, "materializationContext");
  const evaluationId = ownDataValue(input, "evaluationId");
  const limitInput = ownDataValue(input, "limits");
  const limits =
    limitInput.valid && limitInput.present
      ? captureLimits(limitInput.value)
      : captureLimits(undefined);
  if (
    !documentId.valid ||
    !documentId.present ||
    typeof documentId.value !== "string" ||
    documentId.value.length === 0 ||
    !surfaceId.valid ||
    !surfaceId.present ||
    typeof surfaceId.value !== "string" ||
    !LOCAL_IDENTIFIER_PATTERN.test(surfaceId.value) ||
    !surface.valid ||
    !surface.present ||
    !catalogSet.valid ||
    !catalogSet.present ||
    !resolutionSnapshot.valid ||
    !resolutionSnapshot.present ||
    !materializationContext.valid ||
    !materializationContext.present ||
    !evaluationId.valid ||
    !evaluationId.present ||
    typeof evaluationId.value !== "string" ||
    evaluationId.value.length === 0
  ) {
    return invalid("malformed-input");
  }
  if (limits === undefined) return invalid("malformed-limits");
  if (
    documentId.value.length + surfaceId.value.length + evaluationId.value.length >
    limits.maxStringCodeUnits
  ) {
    return limitExceeded(
      "string-code-unit-limit",
      limits.maxStringCodeUnits,
      documentId.value.length + surfaceId.value.length + evaluationId.value.length,
      ROOT_POINTER,
    );
  }

  const requestMatches = (() => {
    try {
      const context = materializationContext.value as RuntimeValueMaterializationContext;
      return (
        isPlainRecord(context) &&
        exactOwnKeys(context, ["requestContext", "tokens"]) &&
        context.requestContext.documentId === documentId.value &&
        context.requestContext.surfaceId === surfaceId.value &&
        context.requestContext.requestId === evaluationId.value &&
        typeof context.requestContext.revision === "string" &&
        isPlainRecord(context.tokens) &&
        exactOwnKeys(context.tokens, ["resolve"]) &&
        typeof context.tokens.resolve === "function"
      );
    } catch {
      return false;
    }
  })();
  if (!requestMatches) return invalid("malformed-input");

  try {
    resolveRuntimeValue(true, resolutionSnapshot.value as RuntimeResolutionSnapshot);
    if (Object.keys((resolutionSnapshot.value as RuntimeResolutionSnapshot).item).length !== 0) {
      return invalid("invalid-snapshot");
    }
  } catch {
    return invalid("invalid-snapshot");
  }

  const frozenInspection = inspectFrozenJson(surface.value, limits);
  if (frozenInspection.status !== "valid") return frozenInspection;
  if (!isPlainRecord(surface.value)) return invalid("unsafe-surface");
  const surfaceIdMember = ownDataValue(surface.value, "id");
  const rootMember = ownDataValue(surface.value, "root");
  if (
    !surfaceIdMember.valid ||
    !surfaceIdMember.present ||
    surfaceIdMember.value !== surfaceId.value ||
    !rootMember.valid ||
    !rootMember.present ||
    !isPlainRecord(rootMember.value)
  ) {
    return invalid("unsafe-surface");
  }

  const catalogAuthenticated = (() => {
    try {
      const result = validateDesenExecutionCatalogSet(catalogSet.value);
      return result.valid && result.value === catalogSet.value;
    } catch {
      return false;
    }
  })();
  if (!catalogAuthenticated) return invalid("catalog-authentication-failed");

  return Object.freeze({
    status: "captured",
    input: Object.freeze({
      documentId: documentId.value,
      surfaceId: surfaceId.value,
      surface: surface.value as BundleSurface,
      catalogSet: catalogSet.value as DesenValidatedExecutionCatalogSet,
      resolutionSnapshot: resolutionSnapshot.value as RuntimeResolutionSnapshot,
      materializationContext: materializationContext.value as RuntimeValueMaterializationContext,
      evaluationId: evaluationId.value,
      limits,
    }),
  });
}

function catalogContracts(
  catalogSet: DesenValidatedExecutionCatalogSet,
): CatalogContracts | undefined {
  const components = new Map<string, ComponentContract>();
  const behaviors = new Map<string, BehaviorContract>();
  try {
    for (const catalog of catalogSet) {
      for (const capabilityId of Object.keys(catalog.components).sort(compareText)) {
        const contract = catalog.components[capabilityId];
        if (contract === undefined || components.has(capabilityId)) return undefined;
        components.set(capabilityId, contract);
      }
      for (const capabilityId of Object.keys(catalog.behaviors).sort(compareText)) {
        const contract = catalog.behaviors[capabilityId];
        if (contract === undefined || behaviors.has(capabilityId)) return undefined;
        behaviors.set(capabilityId, contract);
      }
    }
  } catch {
    return undefined;
  }
  return Object.freeze({ components, behaviors });
}

function createCachedMaterializationContext(
  source: RuntimeValueMaterializationContext,
): RuntimeValueMaterializationContext {
  const cache = new Map<string, RuntimeTokenResolution | "failed">();
  const provider = source.tokens.resolve;
  const resolve: RuntimeTokenPort["resolve"] = (request) => {
    const cached = cache.get(request.token);
    if (cached === "failed") throw new TypeError("The token provider failed.");
    if (cached !== undefined) return cached;

    let raw: unknown;
    try {
      raw = Reflect.apply(provider, undefined, [request]);
    } catch {
      cache.set(request.token, "failed");
      throw new TypeError("The token provider failed.");
    }
    const snapshot = snapshotRuntimeJsonValue(raw);
    if (!isRuntimeJsonObject(snapshot)) {
      cache.set(request.token, "failed");
      throw new TypeError("The token provider returned an invalid result.");
    }
    const keys = Object.keys(snapshot).sort(compareText);
    let resolution: RuntimeTokenResolution;
    if (keys.length === 1 && keys[0] === "status" && snapshot.status === "missing") {
      resolution = Object.freeze({ status: "missing" });
    } else if (
      keys.length === 2 &&
      keys[0] === "status" &&
      keys[1] === "value" &&
      snapshot.status === "resolved" &&
      Object.hasOwn(snapshot, "value")
    ) {
      resolution = Object.freeze({
        status: "resolved",
        value: snapshot.value as RuntimeJsonValue,
      });
    } else {
      cache.set(request.token, "failed");
      throw new TypeError("The token provider returned an invalid result.");
    }
    cache.set(request.token, resolution);
    return resolution;
  };
  return Object.freeze({
    requestContext: source.requestContext,
    tokens: Object.freeze({ resolve }),
  });
}

type TerminalResult = Extract<
  RuntimeHeadlessMaterializationResult,
  { readonly status: "invalid" | "limit-exceeded" }
>;

function requiredPropNames(
  contract: ComponentContract | BehaviorContract,
): ReadonlySet<string> | undefined {
  try {
    const schema = contract.propsSchema;
    if (!isPlainRecord(schema)) return undefined;
    const required = ownDataValue(schema, "required");
    if (!required.valid) return undefined;
    if (!required.present) return new Set();
    if (!Array.isArray(required.value)) return undefined;
    const names = new Set<string>();
    for (const name of required.value) {
      if (typeof name !== "string") return undefined;
      names.add(name);
    }
    return names;
  } catch {
    return undefined;
  }
}

function prefixPointer(base: JsonPointer, relative: JsonPointer): JsonPointer {
  return relative === ROOT_POINTER ? base : (`${base}${relative}` as JsonPointer);
}

function terminalForValue(
  result: ReturnType<typeof materializeRuntimeValue>,
  pointer: JsonPointer,
  required: boolean,
): TerminalResult | "omit" | undefined {
  if (result.status === "resolved") return undefined;
  if (result.status === "unresolved") {
    return required ? invalid("required-prop-unresolved", pointer) : "omit";
  }
  if (result.status === "failed") {
    return invalid("token-provider-failed", prefixPointer(pointer, result.pointer));
  }
  return invalid("materialization-failed", prefixPointer(pointer, result.pointer));
}

function materializeProps(
  specs: RuntimePropValueSpecs,
  required: ReadonlySet<string>,
  scope: RuntimeRepeatScope,
  context: RuntimeValueMaterializationContext,
  pointer: JsonPointer,
):
  | Readonly<{ readonly status: "materialized"; readonly value: RuntimeJsonObject }>
  | TerminalResult {
  let snapshot: RuntimeResolutionSnapshot;
  try {
    snapshot = createRuntimeResolutionSnapshotForRepeatScope(scope);
  } catch {
    return invalid("invalid-snapshot", pointer);
  }
  const output: Record<string, RuntimeJsonValue> = Object.create(null);
  for (const name of Object.keys(specs).sort(compareText)) {
    const result = materializeRuntimeValue(specs[name] as RuntimeValueSpec, snapshot, context);
    const terminal = terminalForValue(result, appendJsonPointer(pointer, name), required.has(name));
    if (terminal === "omit") continue;
    if (terminal !== undefined) return terminal;
    if (result.status !== "resolved") return invalid("materialization-failed", pointer);
    output[name] = result.value;
  }
  for (const requiredName of required) {
    if (!Object.hasOwn(output, requiredName)) {
      return invalid("required-prop-unresolved", appendJsonPointer(pointer, requiredName));
    }
  }
  const detached = snapshotRuntimeJsonValue(output);
  return isRuntimeJsonObject(detached)
    ? Object.freeze({ status: "materialized", value: detached })
    : invalid("materialization-failed", pointer);
}

function materializeStyle(
  specs: RuntimeStyleValueSpecs,
  scope: RuntimeRepeatScope,
  context: RuntimeValueMaterializationContext,
  pointer: JsonPointer,
):
  | Readonly<{ readonly status: "materialized"; readonly value: RuntimeJsonObject }>
  | TerminalResult {
  let snapshot: RuntimeResolutionSnapshot;
  try {
    snapshot = createRuntimeResolutionSnapshotForRepeatScope(scope);
  } catch {
    return invalid("invalid-snapshot", pointer);
  }
  const states: Record<string, RuntimeJsonValue> = Object.create(null);
  for (const stateName of Object.keys(specs).sort(compareText)) {
    const partSpecs = specs[stateName] ?? {};
    const parts: Record<string, RuntimeJsonValue> = Object.create(null);
    for (const partName of Object.keys(partSpecs).sort(compareText)) {
      const propertySpecs = partSpecs[partName] ?? {};
      const properties: Record<string, RuntimeJsonValue> = Object.create(null);
      for (const propertyName of Object.keys(propertySpecs).sort(compareText)) {
        const result = materializeRuntimeValue(
          propertySpecs[propertyName] as RuntimeValueSpec,
          snapshot,
          context,
        );
        const terminal = terminalForValue(
          result,
          appendJsonPointer(
            appendJsonPointer(appendJsonPointer(pointer, stateName), partName),
            propertyName,
          ),
          false,
        );
        if (terminal === "omit") continue;
        if (terminal !== undefined) return terminal;
        if (result.status !== "resolved") return invalid("materialization-failed", pointer);
        properties[propertyName] = result.value;
      }
      if (Object.keys(properties).length > 0) parts[partName] = properties;
    }
    if (Object.keys(parts).length > 0) states[stateName] = parts;
  }
  const detached = snapshotRuntimeJsonValue(states);
  return isRuntimeJsonObject(detached)
    ? Object.freeze({ status: "materialized", value: detached })
    : invalid("materialization-failed", pointer);
}

function variantInput(
  source: Pick<BundleNode, "props" | "style" | "variants"> | BundleBehavior,
): Readonly<{
  readonly props?: RuntimePropValueSpecs;
  readonly style?: RuntimeStyleValueSpecs;
  readonly variants?: readonly RuntimeVariantOverrideSpec[];
}> {
  const input: {
    props?: RuntimePropValueSpecs;
    style?: RuntimeStyleValueSpecs;
    variants?: readonly RuntimeVariantOverrideSpec[];
  } = {};
  if (Object.hasOwn(source, "props")) {
    input.props = source.props as unknown as RuntimePropValueSpecs;
  }
  if (Object.hasOwn(source, "style")) {
    input.style = source.style as unknown as RuntimeStyleValueSpecs;
  }
  if ("variants" in source && Object.hasOwn(source, "variants")) {
    input.variants = source.variants as unknown as readonly RuntimeVariantOverrideSpec[];
  }
  return Object.freeze(input);
}

function materializeNodeValues(
  source: Pick<BundleNode, "props" | "style" | "variants"> | BundleBehavior,
  contract: ComponentContract | BehaviorContract,
  scope: RuntimeRepeatScope,
  context: RuntimeValueMaterializationContext,
  pointer: JsonPointer,
):
  | Readonly<{
      readonly status: "materialized";
      readonly props: RuntimeJsonObject;
      readonly style: RuntimeJsonObject;
    }>
  | TerminalResult {
  let snapshot: RuntimeResolutionSnapshot;
  try {
    snapshot = createRuntimeResolutionSnapshotForRepeatScope(scope);
  } catch {
    return invalid("invalid-snapshot", pointer);
  }
  const evaluated = evaluateRuntimeVariantOverrides(variantInput(source), snapshot, context);
  if (evaluated.status === "failed") return invalid("token-provider-failed", pointer);
  if (evaluated.status !== "evaluated") {
    return invalid("materialization-failed", prefixPointer(pointer, evaluated.pointer));
  }
  const required = requiredPropNames(contract);
  if (required === undefined) return invalid("catalog-authentication-failed", pointer);
  const props = materializeProps(
    evaluated.effectiveProps,
    required,
    scope,
    context,
    appendJsonPointer(pointer, "props"),
  );
  if (props.status !== "materialized") return props;
  const style = materializeStyle(
    evaluated.effectiveStyle,
    scope,
    context,
    appendJsonPointer(pointer, "style"),
  );
  return style.status === "materialized"
    ? Object.freeze({
        status: "materialized",
        props: props.value,
        style: style.value,
      })
    : style;
}

function evaluatePresence(
  when: BundleNode["when"] | undefined,
  scope: RuntimeRepeatScope,
  context: RuntimeValueMaterializationContext,
  pointer: JsonPointer,
): Readonly<{ readonly status: "evaluated"; readonly present: boolean }> | TerminalResult {
  if (when === undefined) return Object.freeze({ status: "evaluated", present: true });
  let snapshot: RuntimeResolutionSnapshot;
  try {
    snapshot = createRuntimeResolutionSnapshotForRepeatScope(scope);
  } catch {
    return invalid("invalid-snapshot", pointer);
  }
  const probe = evaluateRuntimeVariantOverrides(
    {
      variants: [
        {
          when: when as unknown as RuntimePredicateSpec,
          props: { __desen_presence: true },
        },
      ],
    },
    snapshot,
    context,
  );
  if (probe.status === "failed") return invalid("token-provider-failed", pointer);
  if (probe.status !== "evaluated") {
    return invalid("materialization-failed", prefixPointer(pointer, probe.pointer));
  }
  return Object.freeze({
    status: "evaluated",
    present: probe.matchingVariantIndices.length === 1,
  });
}

function effectiveRepeatSpec(input: RuntimeRepeatSpec, maximum: number): RuntimeRepeatSpec {
  const limit = Math.min(input.limit ?? maximum, maximum);
  return Object.freeze({
    items: input.items,
    as: input.as,
    key: input.key,
    limit,
    ...(input.extensions === undefined ? {} : { extensions: input.extensions }),
  });
}

function materializeDeferredRepeat(
  parent: RuntimeRepeatScope,
  repeat: RuntimeRepeatSpec,
  state: MaterializationState,
  pointer: JsonPointer,
):
  | Readonly<{ readonly status: "materialized"; readonly scopes: readonly RuntimeRepeatScope[] }>
  | TerminalResult {
  let parentSnapshot: RuntimeResolutionSnapshot;
  try {
    parentSnapshot = createRuntimeResolutionSnapshotForRepeatScope(parent);
  } catch {
    return invalid("invalid-snapshot", pointer);
  }
  const itemsResult = materializeRuntimeValue(repeat.items, parentSnapshot, state.context);
  if (itemsResult.status === "failed") {
    return invalid("token-provider-failed", appendJsonPointer(pointer, "items"));
  }
  if (itemsResult.status !== "resolved") {
    return invalid("repeat-invalid", appendJsonPointer(pointer, "items"));
  }
  if (!Array.isArray(itemsResult.value)) {
    return invalid("repeat-invalid", appendJsonPointer(pointer, "items"));
  }
  const effectiveLimit = Math.min(
    repeat.limit ?? state.input.limits.maxRepeatInstances,
    state.input.limits.maxRepeatInstances,
  );
  if (itemsResult.value.length > effectiveLimit) {
    return limitExceeded(
      "repeat-limit",
      effectiveLimit,
      itemsResult.value.length,
      appendJsonPointer(pointer, "limit"),
    );
  }

  const identities = new Set<string>();
  const scopes: RuntimeRepeatScope[] = [];
  for (let index = 0; index < itemsResult.value.length; index += 1) {
    const item = itemsResult.value[index] as RuntimeJsonValue;
    const provisional = materializeRuntimeRepeat(parent, {
      items: [item],
      as: repeat.as,
      key: index,
      limit: 1,
    });
    if (provisional.status !== "materialized" || provisional.instances.length !== 1) {
      return invalid("repeat-invalid", pointer);
    }
    const provisionalScope = provisional.instances[0]?.scope;
    if (provisionalScope === undefined) return invalid("repeat-invalid", pointer);

    let keySnapshot: RuntimeResolutionSnapshot;
    try {
      keySnapshot = createRuntimeResolutionSnapshotForRepeatScope(provisionalScope);
    } catch {
      return invalid("invalid-snapshot", appendJsonPointer(pointer, "key"));
    }
    const keyResult = materializeRuntimeValue(repeat.key, keySnapshot, state.context);
    if (keyResult.status === "failed") {
      return invalid("token-provider-failed", appendJsonPointer(pointer, "key"));
    }
    if (
      keyResult.status !== "resolved" ||
      (typeof keyResult.value !== "string" && typeof keyResult.value !== "number")
    ) {
      return invalid("repeat-invalid", appendJsonPointer(pointer, "key"));
    }
    const keyIdentity = canonicalizeJson(keyResult.value);
    if (identities.has(keyIdentity)) {
      return invalid("repeat-invalid", appendJsonPointer(pointer, "key"));
    }
    identities.add(keyIdentity);

    const finalInstance = materializeRuntimeRepeat(parent, {
      items: [item],
      as: repeat.as,
      key: keyResult.value,
      limit: 1,
    });
    if (finalInstance.status !== "materialized" || finalInstance.instances.length !== 1) {
      return invalid("repeat-invalid", pointer);
    }
    const finalScope = finalInstance.instances[0]?.scope;
    if (finalScope === undefined) return invalid("repeat-invalid", pointer);
    scopes.push(finalScope);
  }
  return Object.freeze({ status: "materialized", scopes: Object.freeze(scopes) });
}

function materializeNodeScopes(
  node: BundleNode,
  parent: RuntimeRepeatScope,
  state: MaterializationState,
  pointer: JsonPointer,
):
  | Readonly<{ readonly status: "materialized"; readonly scopes: readonly RuntimeRepeatScope[] }>
  | TerminalResult {
  if (!Object.hasOwn(node, "repeat") || node.repeat === undefined) {
    return Object.freeze({ status: "materialized", scopes: Object.freeze([parent]) });
  }
  const repeat = node.repeat as unknown as RuntimeRepeatSpec;
  const result = materializeRuntimeRepeat(
    parent,
    effectiveRepeatSpec(repeat, state.input.limits.maxRepeatInstances),
  );
  if (result.status === "materialized") {
    return Object.freeze({
      status: "materialized",
      scopes: Object.freeze(result.instances.map((instance) => instance.scope)),
    });
  }
  if (result.status === "limit-exceeded") {
    return limitExceeded(
      "repeat-limit",
      result.limit,
      result.observed,
      appendJsonPointer(pointer, "repeat"),
    );
  }
  if (result.status === "deferred") {
    return materializeDeferredRepeat(
      parent,
      effectiveRepeatSpec(repeat, state.input.limits.maxRepeatInstances),
      state,
      appendJsonPointer(pointer, "repeat"),
    );
  }
  return invalid("repeat-invalid", appendJsonPointer(pointer, "repeat"));
}

function runtimeIdentity(
  state: MaterializationState,
  node: BundleNode,
  scope: RuntimeRepeatScope,
  pointer: JsonPointer,
):
  | Readonly<{ readonly key: string; readonly identity: RuntimeAdapterNodeIdentity }>
  | TerminalResult {
  const descriptor = {
    documentId: state.input.documentId,
    surfaceId: state.input.surfaceId,
    nodeId: node.id,
    use: node.use,
  };
  if (scope.repeatKeys.length === 0) {
    const created = createRuntimeNodeIdentity(descriptor);
    return created.status === "created"
      ? Object.freeze({ key: created.identity.key, identity: created.identity })
      : invalid("materialization-failed", pointer);
  }
  const created = createRuntimeRepeatedNodeIdentity(descriptor, scope);
  return created.status === "created"
    ? Object.freeze({ key: created.identity.key, identity: created.identity })
    : invalid("materialization-failed", pointer);
}

function captureHandlers(handlers: BundleNode["on"] | BundleBehavior["on"] | undefined): Readonly<{
  readonly handledEvents: readonly string[];
  readonly handlers: Readonly<Record<string, readonly BundleAction[]>>;
}> {
  const names = handlers === undefined ? [] : Object.keys(handlers).sort(compareText);
  const captured: Record<string, readonly BundleAction[]> = Object.create(null);
  for (const name of names) {
    captured[name] = Object.freeze([...(handlers?.[name] ?? [])]) as readonly BundleAction[];
  }
  return Object.freeze({
    handledEvents: Object.freeze(names),
    handlers: Object.freeze(captured),
  });
}

function behaviorPlan(
  behavior: BundleBehavior,
  ownerIdentity: string,
  sourceNodeId: string,
  scope: RuntimeRepeatScope,
  state: MaterializationState,
  pointer: JsonPointer,
):
  | Readonly<{ readonly status: "materialized"; readonly plan: MutableBehaviorPlan }>
  | TerminalResult {
  const contract = state.contracts.behaviors.get(behavior.use);
  if (contract === undefined) return invalid("catalog-authentication-failed", pointer);
  const values = materializeNodeValues(behavior, contract, scope, state.context, pointer);
  if (values.status !== "materialized") return values;

  const identity = canonicalizeJson([ownerIdentity, "behavior", behavior.id]);
  const slots: Record<string, RuntimeHeadlessNodePlan[]> = Object.create(null);
  for (const slotName of Object.keys(behavior.slots ?? {}).sort(compareText)) slots[slotName] = [];
  const handlers = captureHandlers(behavior.on);
  state.intents.push(
    Object.freeze({
      kind: "behavior",
      sourceNodeId,
      behaviorId: behavior.id,
      capabilityId: behavior.use,
      identity,
      ownerRuntimeInstanceId: ownerIdentity,
      scope,
      handledEvents: handlers.handledEvents,
      handlers: handlers.handlers,
    }),
  );
  return Object.freeze({
    status: "materialized",
    plan: {
      identity,
      id: behavior.id,
      use: behavior.use,
      props: values.props,
      style: values.style,
      slots,
    },
  });
}

function enqueueChildren(
  work: NodeWork[],
  node: BundleNode,
  plan: MutableNodePlan,
  scope: RuntimeRepeatScope,
  depth: number,
  pointer: JsonPointer,
): void {
  const ordered: NodeWork[] = [];
  for (const slotName of Object.keys(node.slots ?? {}).sort(compareText)) {
    const children = node.slots?.[slotName] ?? [];
    const destination = plan.slots[slotName] as RuntimeHeadlessNodePlan[];
    for (let index = 0; index < children.length; index += 1) {
      ordered.push({
        node: children[index] as BundleNode,
        scope,
        depth,
        pointer: appendJsonPointer(
          appendJsonPointer(appendJsonPointer(pointer, "slots"), slotName),
          index,
        ),
        destination,
      });
    }
  }
  for (let behaviorIndex = 0; behaviorIndex < (node.behaviors?.length ?? 0); behaviorIndex += 1) {
    const behavior = node.behaviors?.[behaviorIndex] as BundleBehavior;
    const behaviorPlanValue = plan.behaviors[behaviorIndex] as MutableBehaviorPlan;
    for (const slotName of Object.keys(behavior.slots ?? {}).sort(compareText)) {
      const children = behavior.slots?.[slotName] ?? [];
      const destination = behaviorPlanValue.slots[slotName] as RuntimeHeadlessNodePlan[];
      for (let index = 0; index < children.length; index += 1) {
        ordered.push({
          node: children[index] as BundleNode,
          scope,
          depth,
          pointer: appendJsonPointer(
            appendJsonPointer(
              appendJsonPointer(
                appendJsonPointer(appendJsonPointer(pointer, "behaviors"), behaviorIndex),
                "slots",
              ),
              slotName,
            ),
            index,
          ),
          destination,
        });
      }
    }
  }
  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    work.push(ordered[index] as NodeWork);
  }
}

function materializeTree(state: MaterializationState):
  | Readonly<{
      readonly status: "materialized";
      readonly roots: readonly RuntimeHeadlessNodePlan[];
    }>
  | TerminalResult {
  let rootScope: RuntimeRepeatScope;
  try {
    rootScope = createRuntimeRepeatRootScope(state.input.resolutionSnapshot);
  } catch {
    return invalid("invalid-snapshot");
  }

  const roots: RuntimeHeadlessNodePlan[] = [];
  const work: NodeWork[] = [
    {
      node: state.input.surface.root,
      scope: rootScope,
      depth: 0,
      pointer: "/root" as JsonPointer,
      destination: roots,
    },
  ];
  while (work.length > 0) {
    const current = work.pop() as NodeWork;
    if (current.depth > state.input.limits.maxDepth) {
      return limitExceeded(
        "depth-limit",
        state.input.limits.maxDepth,
        current.depth,
        current.pointer,
      );
    }
    const scopes =
      current.resolvedScope === undefined
        ? materializeNodeScopes(current.node, current.scope, state, current.pointer)
        : Object.freeze({
            status: "materialized" as const,
            scopes: Object.freeze([current.resolvedScope]),
          });
    if (scopes.status !== "materialized") return scopes;
    if (current.resolvedScope === undefined && scopes.scopes.length > 1) {
      for (let index = scopes.scopes.length - 1; index >= 0; index -= 1) {
        work.push({
          ...current,
          resolvedScope: scopes.scopes[index] as RuntimeRepeatScope,
        });
      }
      continue;
    }

    const childWorkGroups: NodeWork[][] = [];
    for (const scope of scopes.scopes) {
      const presence = evaluatePresence(
        current.node.when,
        scope,
        state.context,
        appendJsonPointer(current.pointer, "when"),
      );
      if (presence.status !== "evaluated") return presence;
      if (!presence.present) continue;

      state.nodes += 1;
      if (state.nodes > state.input.limits.maxNodes) {
        return limitExceeded(
          "node-limit",
          state.input.limits.maxNodes,
          state.nodes,
          current.pointer,
        );
      }
      const contract = state.contracts.components.get(current.node.use);
      if (contract === undefined) {
        return invalid("catalog-authentication-failed", appendJsonPointer(current.pointer, "use"));
      }
      const values = materializeNodeValues(
        current.node,
        contract,
        scope,
        state.context,
        current.pointer,
      );
      if (values.status !== "materialized") return values;
      const identity = runtimeIdentity(state, current.node, scope, current.pointer);
      if ("status" in identity) return identity;

      const slots: Record<string, RuntimeHeadlessNodePlan[]> = Object.create(null);
      for (const slotName of Object.keys(current.node.slots ?? {}).sort(compareText)) {
        slots[slotName] = [];
      }
      const handlers = captureHandlers(current.node.on);
      state.intents.push(
        Object.freeze({
          kind: "component",
          sourceNodeId: current.node.id,
          capabilityId: current.node.use,
          identity: identity.identity,
          scope,
          handledEvents: handlers.handledEvents,
          handlers: handlers.handlers,
        }),
      );
      const behaviors: MutableBehaviorPlan[] = [];
      for (
        let behaviorIndex = 0;
        behaviorIndex < (current.node.behaviors?.length ?? 0);
        behaviorIndex += 1
      ) {
        const behavior = current.node.behaviors?.[behaviorIndex] as BundleBehavior;
        const result = behaviorPlan(
          behavior,
          identity.key,
          current.node.id,
          scope,
          state,
          appendJsonPointer(appendJsonPointer(current.pointer, "behaviors"), behaviorIndex),
        );
        if (result.status !== "materialized") return result;
        behaviors.push(result.plan);
      }
      const plan: MutableNodePlan = {
        identity: identity.key,
        sourceNodeId: current.node.id,
        use: current.node.use,
        props: values.props,
        style: values.style,
        slots,
        behaviors,
      };
      current.destination.push(plan as RuntimeHeadlessNodePlan);

      const localChildren: NodeWork[] = [];
      enqueueChildren(localChildren, current.node, plan, scope, current.depth + 1, current.pointer);
      childWorkGroups.push(localChildren);
    }
    for (let groupIndex = childWorkGroups.length - 1; groupIndex >= 0; groupIndex -= 1) {
      const group = childWorkGroups[groupIndex] as NodeWork[];
      for (const childWork of group) work.push(childWork);
    }
  }
  return Object.freeze({ status: "materialized", roots });
}

function freezePlan(plan: RuntimeHeadlessSurfacePlan): RuntimeHeadlessSurfacePlan {
  const pending: RuntimeHeadlessNodePlan[] = [...plan.root];
  const nodes: RuntimeHeadlessNodePlan[] = [];
  const behaviors: RuntimeHeadlessBehaviorPlan[] = [];
  while (pending.length > 0) {
    const node = pending.pop() as RuntimeHeadlessNodePlan;
    nodes.push(node);
    for (const children of Object.values(node.slots)) pending.push(...children);
    for (const behavior of node.behaviors) {
      behaviors.push(behavior);
      for (const children of Object.values(behavior.slots)) pending.push(...children);
    }
  }
  for (let index = behaviors.length - 1; index >= 0; index -= 1) {
    const behavior = behaviors[index] as MutableBehaviorPlan;
    for (const children of Object.values(behavior.slots)) Object.freeze(children);
    Object.freeze(behavior.slots);
    Object.freeze(behavior);
  }
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const node = nodes[index] as MutableNodePlan;
    for (const children of Object.values(node.slots)) Object.freeze(children);
    Object.freeze(node.slots);
    Object.freeze(node.behaviors);
    Object.freeze(node);
  }
  Object.freeze(plan.root);
  return Object.freeze(plan);
}

function measurePlan(
  plan: RuntimeHeadlessSurfacePlan,
  limits: Required<RuntimeHeadlessMaterializationLimitProfile>,
): TerminalResult | undefined {
  const pending: RuntimeJsonValue[] = [plan as unknown as RuntimeJsonValue];
  let occurrences = 0;
  let codeUnits = 0;
  while (pending.length > 0) {
    const value = pending.pop() as RuntimeJsonValue;
    occurrences += 1;
    if (occurrences > limits.maxJsonOccurrences) {
      return limitExceeded(
        "json-occurrence-limit",
        limits.maxJsonOccurrences,
        occurrences,
        ROOT_POINTER,
      );
    }
    if (typeof value === "string") {
      codeUnits += value.length;
      if (codeUnits > limits.maxStringCodeUnits) {
        return limitExceeded(
          "string-code-unit-limit",
          limits.maxStringCodeUnits,
          codeUnits,
          ROOT_POINTER,
        );
      }
      continue;
    }
    if (value === null || typeof value !== "object") continue;
    if (Array.isArray(value)) {
      for (let index = value.length - 1; index >= 0; index -= 1) {
        pending.push(value[index] as RuntimeJsonValue);
      }
      continue;
    }
    const keys = Object.keys(value).sort(compareText);
    for (let index = keys.length - 1; index >= 0; index -= 1) {
      const key = keys[index] as string;
      codeUnits += key.length;
      if (codeUnits > limits.maxStringCodeUnits) {
        return limitExceeded(
          "string-code-unit-limit",
          limits.maxStringCodeUnits,
          codeUnits,
          ROOT_POINTER,
        );
      }
      pending.push((value as RuntimeJsonObject)[key] as RuntimeJsonValue);
    }
  }
  return undefined;
}

function bindingProjection(intents: readonly RuntimeHeadlessBindingIntent[]): RuntimeJsonValue {
  return intents.map((intent) =>
    intent.kind === "component"
      ? {
          kind: intent.kind,
          sourceNodeId: intent.sourceNodeId,
          capabilityId: intent.capabilityId,
          identity: intent.identity.key,
          aliases: intent.scope.aliases,
          repeatKeys: intent.scope.repeatKeys,
          handledEvents: intent.handledEvents,
          handlers: intent.handlers as unknown as RuntimeJsonObject,
        }
      : {
          kind: intent.kind,
          sourceNodeId: intent.sourceNodeId,
          behaviorId: intent.behaviorId,
          capabilityId: intent.capabilityId,
          identity: intent.identity,
          ownerRuntimeInstanceId: intent.ownerRuntimeInstanceId,
          aliases: intent.scope.aliases,
          repeatKeys: intent.scope.repeatKeys,
          handledEvents: intent.handledEvents,
          handlers: intent.handlers as unknown as RuntimeJsonObject,
        },
  ) as unknown as RuntimeJsonValue;
}

/**
 * Materializes one execution-validated immutable Bundle surface into an atomic JSON-only plan.
 *
 * @remarks The full plan and factory-authenticated binding scopes stay behind an evaluation-bound
 * sidecar. Only canonical SHA-256 commitments need to cross M04-T15. The function executes no
 * adapter, action, registration, platform API, or arbitrary document code.
 */
export function materializeRuntimeHeadlessSurface(
  input: RuntimeHeadlessMaterializationInput,
): RuntimeHeadlessMaterializationResult {
  const captured = captureInput(input);
  if (captured.status !== "captured") return captured;
  const contracts = catalogContracts(captured.input.catalogSet);
  if (contracts === undefined) return invalid("catalog-authentication-failed");

  let context: RuntimeValueMaterializationContext;
  try {
    context = createCachedMaterializationContext(captured.input.materializationContext);
  } catch {
    return invalid("malformed-input");
  }
  const state: MaterializationState = {
    input: captured.input,
    contracts,
    context,
    intents: [],
    nodes: 0,
  };
  let tree:
    | Readonly<{
        readonly status: "materialized";
        readonly roots: readonly RuntimeHeadlessNodePlan[];
      }>
    | TerminalResult;
  try {
    tree = materializeTree(state);
  } catch {
    return invalid("materialization-failed");
  }
  if (tree.status !== "materialized") return tree;

  const plan = freezePlan({
    documentId: captured.input.documentId,
    surfaceId: captured.input.surfaceId,
    root: tree.roots,
  });
  const planLimit = measurePlan(plan, captured.input.limits);
  if (planLimit !== undefined) return planLimit;

  let planDigest: string;
  let bindingDigest: string;
  try {
    planDigest = digestCanonicalJson(plan);
    bindingDigest = digestCanonicalJson(bindingProjection(state.intents));
  } catch {
    return invalid("digest-failed");
  }
  const commitment = Object.freeze({
    status: "materialized",
    planDigest,
    bindingDigest,
  } as const satisfies RuntimeHeadlessMaterializationCommitment);
  const intents = Object.freeze([...state.intents]);
  const sidecar = Object.freeze({}) as RuntimeHeadlessMaterializationSidecar;
  SIDECAR_AUTHORITIES.set(sidecar, {
    evaluationId: captured.input.evaluationId,
    plan,
    commitment,
    intents,
  });
  return Object.freeze({ status: "materialized", commitment, plan, sidecar });
}

/**
 * Reads one private sidecar only for the exact evaluator request that created it.
 *
 * @internal This seam is intentionally omitted from the package root; M04-T16 session composition
 * consumes it without making action programs or repeat scopes protocol-observable.
 */
export function readRuntimeHeadlessMaterializationSidecar(
  sidecar: RuntimeHeadlessMaterializationSidecar,
  evaluationId: string,
): RuntimeHeadlessMaterializationSidecarReadResult {
  if (typeof sidecar !== "object" || sidecar === null) {
    return Object.freeze({ status: "invalid-sidecar" });
  }
  const authority = SIDECAR_AUTHORITIES.get(sidecar);
  if (authority === undefined) return Object.freeze({ status: "invalid-sidecar" });
  if (typeof evaluationId !== "string" || evaluationId !== authority.evaluationId) {
    return Object.freeze({ status: "evaluation-mismatch" });
  }
  return Object.freeze({
    status: "read",
    evaluationId: authority.evaluationId,
    plan: authority.plan,
    commitment: authority.commitment,
    intents: authority.intents,
  });
}
