import { Fragment, createElement } from "react";

import { authenticateRuntimeHeadlessSessionAdapterAuthority } from "@desen/runtime-core";
import {
  ADAPTER_VALIDATION_LIMIT_EXCEEDED_CODE,
  RESOLVED_ADAPTER_VALIDATION_LIMITS,
  createDesenResolvedAdapterValidationScope,
  validateDesenResolvedAdapterProps,
  validateDesenResolvedAdapterSlots,
  validateDesenResolvedAdapterStyle,
} from "@desen/validator";

import {
  createRuntimeReactBehaviorAdapterElement,
  createRuntimeReactComponentAdapterElement,
} from "./interactions.js";
import { buildRuntimeReactDiagnosticIndex } from "./diagnostic-index.js";
import { createRuntimeReactReconciliationKey } from "./reconciliation.js";
import { readRuntimeReactAdapterRegistryAuthority } from "./registry.js";

import type { ReactElement, ReactNode } from "react";
import type {
  RuntimeHeadlessBindingSnapshot,
  RuntimeHeadlessSessionHandle,
  RuntimeHeadlessSessionSnapshot,
  RuntimeHeadlessSurfacePlan,
  RuntimeJsonObject,
  RuntimeJsonValue,
} from "@desen/runtime-core";
import type {
  DesenResolvedAdapterValidationLimitProfile,
  DesenResolvedAdapterValidationScope,
  DesenSemanticDiagnostic,
  DesenValidatedExecutionCatalogSet,
} from "@desen/validator";
import type {
  RuntimeReactDiagnosticIndex,
  RuntimeReactDiagnosticIndexBinding,
} from "./diagnostic-index.js";
import type {
  RuntimeReactAdapterRegistryHandle,
  RuntimeReactBehaviorAdapterDefinition,
  RuntimeReactComponentAdapterDefinition,
  RuntimeReactDiagnosticIdentity,
  RuntimeReactNamedSlots,
  RuntimeReactSemanticStyle,
} from "./registry.js";

/** Reference ceilings for one React render-plan compilation. */
export const RUNTIME_REACT_RENDER_LIMITS = Object.freeze({
  maxNodes: 5_000,
  maxDepth: 128,
  maxSlotEntries: 20_000,
  maxBehaviors: 20_000,
  maxJsonDepth: 128,
  maxJsonOccurrences: 262_144,
  maxStringCodeUnits: 4_194_304,
} as const);

/** Optional trusted profile that may only lower render and receiving-validation ceilings. */
export interface RuntimeReactRenderLimitProfile extends DesenResolvedAdapterValidationLimitProfile {
  readonly maxNodes?: number;
  readonly maxDepth?: number;
  readonly maxSlotEntries?: number;
  readonly maxBehaviors?: number;
  readonly maxJsonDepth?: number;
  readonly maxJsonOccurrences?: number;
  readonly maxStringCodeUnits?: number;
}

/**
 * Complete public input for one all-or-nothing authenticated render-plan compilation.
 *
 * @remarks `snapshot` and `catalogSet` must be the exact current objects retained by `session`.
 * A copied plan, reconstructed snapshot, or structurally equal Catalog set is not accepted.
 */
export interface RuntimeReactRenderInput {
  readonly registry: RuntimeReactAdapterRegistryHandle;
  readonly session: RuntimeHeadlessSessionHandle;
  readonly snapshot: RuntimeHeadlessSessionSnapshot;
  readonly catalogSet: DesenValidatedExecutionCatalogSet;
  readonly limits?: RuntimeReactRenderLimitProfile;
}

/** Public receiving channel associated with a renderer failure, when one exists. */
export type RuntimeReactRenderFailureChannel = "props" | "slots" | "style" | null;

/** Stable fail-closed renderer classification. */
export type RuntimeReactRenderFailureCode =
  | "BEHAVIOR_LIMIT_EXCEEDED"
  | "DEPTH_LIMIT_EXCEEDED"
  | "DIAGNOSTIC_INDEX_FAILED"
  | "DUPLICATE_RUNTIME_IDENTITY"
  | "INVALID_BEHAVIOR_PROPS"
  | "INVALID_BEHAVIOR_SLOTS"
  | "INVALID_BEHAVIOR_STYLE"
  | "INVALID_CATALOG_SET"
  | "INVALID_COMPONENT_PROPS"
  | "INVALID_COMPONENT_SLOTS"
  | "INVALID_COMPONENT_STYLE"
  | "INVALID_REGISTRY"
  | "INVALID_SESSION"
  | "INVALID_SESSION_SNAPSHOT"
  | "JSON_DEPTH_LIMIT_EXCEEDED"
  | "JSON_OCCURRENCE_LIMIT_EXCEEDED"
  | "MALFORMED_RENDER_PLAN"
  | "NODE_LIMIT_EXCEEDED"
  | "RECEIVING_VALIDATION_LIMIT_EXCEEDED"
  | "RECONCILIATION_KEY_FAILED"
  | "RUNTIME_BINDING_MISMATCH"
  | "SLOT_LIMIT_EXCEEDED"
  | "STRING_LIMIT_EXCEEDED"
  | "UNKNOWN_BEHAVIOR_CAPABILITY"
  | "UNKNOWN_COMPONENT_CAPABILITY";

/**
 * Public callback-free failure linked to the nearest available source and runtime identities.
 *
 * @remarks Receiving failures preserve the validator's exact immutable diagnostics. Renderer,
 * registry, and session failures use one shared frozen empty diagnostic array.
 */
export interface RuntimeReactRenderFailure {
  readonly code: RuntimeReactRenderFailureCode;
  readonly runtimeNodeId: string | null;
  readonly sourceNodeId: string | null;
  readonly capabilityId: string | null;
  readonly channel: RuntimeReactRenderFailureChannel;
  readonly diagnostics: readonly DesenSemanticDiagnostic[];
}

/** One successfully preflighted React surface. */
export interface RuntimeReactRenderedSurface {
  readonly documentId: string;
  readonly surfaceId: string;
  readonly element: ReactElement;
  readonly nodeCount: number;
  readonly behaviorCount: number;
  /**
   * Callback-free immutable runtime-node ↔ source-node lookup for diagnostics and selection.
   *
   * @remarks Repeated authoring nodes and behavior attachments are represented as one-to-many
   * sorted inverse lists. The index retains no React value, platform authority, session, Catalog,
   * registry, props, style, slots, or callback.
   */
  readonly diagnosticIndex: RuntimeReactDiagnosticIndex;
}

/** Complete controlled result of compiling one authenticated headless session snapshot. */
export type RuntimeReactRenderResult =
  | Readonly<{ readonly status: "rendered"; readonly surface: RuntimeReactRenderedSurface }>
  | Readonly<{ readonly status: "failed"; readonly failure: RuntimeReactRenderFailure }>;

interface RenderLimits {
  readonly maxNodes: number;
  readonly maxDepth: number;
  readonly maxSlotEntries: number;
  readonly maxBehaviors: number;
  readonly maxJsonDepth: number;
  readonly maxJsonOccurrences: number;
  readonly maxStringCodeUnits: number;
}

interface CapturedLimits {
  readonly render: RenderLimits;
  readonly receiving: DesenResolvedAdapterValidationLimitProfile;
}

interface RuntimeReactSessionBoundaryProps {
  readonly children: ReactNode;
}

type RuntimeReactSessionBoundaryComponent = (
  props: RuntimeReactSessionBoundaryProps,
) => ReactElement;

/**
 * A component type is a React reconciliation boundary. Retaining one private type per exact
 * authenticated session-and-registry pair preserves adapter state across generations using that
 * trusted host configuration while making it impossible for another session or executable
 * registry with coincidentally equal public identities to inherit local state, refs, effects,
 * interaction ports, or platform instances.
 */
const SESSION_REGISTRY_BOUNDARIES = new WeakMap<
  object,
  WeakMap<object, RuntimeReactSessionBoundaryComponent>
>();

function sessionRegistryBoundary(
  session: object,
  registry: object,
): RuntimeReactSessionBoundaryComponent {
  let registryBoundaries = SESSION_REGISTRY_BOUNDARIES.get(session);
  if (registryBoundaries === undefined) {
    registryBoundaries = new WeakMap<object, RuntimeReactSessionBoundaryComponent>();
    SESSION_REGISTRY_BOUNDARIES.set(session, registryBoundaries);
  }
  const existing = registryBoundaries.get(registry);
  if (existing !== undefined) return existing;
  const boundary: RuntimeReactSessionBoundaryComponent = ({ children }) =>
    createElement(Fragment, null, children);
  registryBoundaries.set(registry, boundary);
  return boundary;
}

interface PreparedBehavior {
  readonly runtimeNodeId: string;
  readonly sourceNodeId: string;
  readonly capabilityId: string;
  readonly behaviorId: string;
  readonly ownerRuntimeNodeId: string;
  readonly props: RuntimeJsonObject;
  readonly style: RuntimeReactSemanticStyle;
  readonly definition: RuntimeReactBehaviorAdapterDefinition;
  readonly reconciliationKey: string;
  readonly slots: Readonly<Record<string, readonly PreparedNode[]>>;
}

interface PreparedNode {
  readonly runtimeNodeId: string;
  readonly sourceNodeId: string;
  readonly capabilityId: string;
  readonly props: RuntimeJsonObject;
  readonly style: RuntimeReactSemanticStyle;
  readonly definition: RuntimeReactComponentAdapterDefinition;
  readonly reconciliationKey: string;
  readonly slots: Readonly<Record<string, readonly PreparedNode[]>>;
  readonly behaviors: readonly PreparedBehavior[];
}

interface PreparationState {
  readonly identities: Set<string>;
  readonly bindings: Map<string, PreparedBindingIdentity>;
  readonly validationScope: DesenResolvedAdapterValidationScope;
  nodeCount: number;
  behaviorCount: number;
  slotEntries: number;
  jsonOccurrences: number;
  stringCodeUnits: number;
}

type PreparedBindingIdentity =
  | Readonly<{
      readonly kind: "component";
      readonly runtimeInstanceId: string;
      readonly sourceNodeId: string;
      readonly capabilityId: string;
    }>
  | Readonly<{
      readonly kind: "behavior";
      readonly runtimeInstanceId: string;
      readonly sourceNodeId: string;
      readonly capabilityId: string;
      readonly behaviorId: string;
      readonly ownerRuntimeNodeId: string;
    }>;

interface RuntimeReactRenderAuthority {
  readonly session: RuntimeHeadlessSessionHandle;
  readonly snapshot: RuntimeHeadlessSessionSnapshot;
}

type JsonCaptureFailureCode =
  | "JSON_DEPTH_LIMIT_EXCEEDED"
  | "JSON_OCCURRENCE_LIMIT_EXCEEDED"
  | "MALFORMED_RENDER_PLAN"
  | "STRING_LIMIT_EXCEEDED";

type JsonCaptureResult =
  | Readonly<{ readonly status: "captured"; readonly value: RuntimeJsonValue }>
  | Readonly<{ readonly status: "failed"; readonly code: JsonCaptureFailureCode }>;

interface CapturedRenderInput {
  readonly registry: unknown;
  readonly session: unknown;
  readonly snapshot: unknown;
  readonly catalogSet: unknown;
  readonly limits: unknown;
}

const INVALID = Symbol("invalid-own-data");
const EMPTY_DIAGNOSTICS = Object.freeze([]) as readonly DesenSemanticDiagnostic[];
const RENDER_FAILURE_RESULTS = new WeakSet<object>();

function isRenderFailure(value: object): value is RuntimeReactRenderResult {
  return RENDER_FAILURE_RESULTS.has(value);
}

function lowerLimit(value: unknown, ceiling: number): number | undefined {
  return Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= ceiling
    ? (value as number)
    : undefined;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function exactOwnDataKeys(
  value: object,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean {
  try {
    const keys = Reflect.ownKeys(value);
    const allowed = new Set([...required, ...optional]);
    return (
      required.every((name) => keys.includes(name)) &&
      keys.every((key) => typeof key === "string" && allowed.has(key)) &&
      keys.every((key) => {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        return descriptor !== undefined && descriptor.enumerable && "value" in descriptor;
      })
    );
  } catch {
    return false;
  }
}

function ownData(value: object, key: string): unknown | typeof INVALID {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor !== undefined && descriptor.enumerable && "value" in descriptor
      ? descriptor.value
      : INVALID;
  } catch {
    return INVALID;
  }
}

function captureRenderInput(input: unknown): CapturedRenderInput | undefined {
  if (
    !isPlainRecord(input) ||
    !exactOwnDataKeys(input, ["registry", "session", "snapshot", "catalogSet"], ["limits"])
  ) {
    return undefined;
  }
  const registry = ownData(input, "registry");
  const session = ownData(input, "session");
  const snapshot = ownData(input, "snapshot");
  const catalogSet = ownData(input, "catalogSet");
  const limits = ownData(input, "limits");
  if (
    registry === INVALID ||
    session === INVALID ||
    snapshot === INVALID ||
    catalogSet === INVALID
  ) {
    return undefined;
  }
  return Object.freeze({
    registry,
    session,
    snapshot,
    catalogSet,
    limits: limits === INVALID ? undefined : limits,
  });
}

function captureLimits(value: unknown): CapturedLimits | undefined {
  const renderCeilings = RUNTIME_REACT_RENDER_LIMITS;
  const receivingCeilings = RESOLVED_ADAPTER_VALIDATION_LIMITS;
  const allowed = new Set([...Object.keys(renderCeilings), ...Object.keys(receivingCeilings)]);
  if (
    value !== undefined &&
    (!isPlainRecord(value) || !exactOwnDataKeys(value, [], [...allowed]))
  ) {
    return undefined;
  }
  const render: Record<string, number> = {};
  const receiving: Record<string, number> = {};
  for (const [name, ceiling] of Object.entries(renderCeilings)) {
    const member = value === undefined ? INVALID : ownData(value, name);
    const limit = lowerLimit(member === INVALID ? ceiling : member, ceiling);
    if (limit === undefined) return undefined;
    render[name] = limit;
  }
  for (const [name, ceiling] of Object.entries(receivingCeilings)) {
    const member = value === undefined ? INVALID : ownData(value, name);
    const limit = lowerLimit(
      member === INVALID ? (name === "maxSlotEntries" ? render.maxSlotEntries : ceiling) : member,
      ceiling,
    );
    if (limit === undefined) return undefined;
    receiving[name] = limit;
  }
  return Object.freeze({
    render: Object.freeze(render) as unknown as RenderLimits,
    receiving: Object.freeze(receiving) as unknown as DesenResolvedAdapterValidationLimitProfile,
  });
}

function captureDenseArray(value: unknown, maximum: number): readonly unknown[] | undefined {
  try {
    if (!Array.isArray(value)) return undefined;
    if (Object.getOwnPropertySymbols(value).length !== 0) return undefined;
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    if (
      lengthDescriptor === undefined ||
      !("value" in lengthDescriptor) ||
      !Number.isSafeInteger(lengthDescriptor.value) ||
      lengthDescriptor.value < 0 ||
      lengthDescriptor.value > maximum
    ) {
      return undefined;
    }
    const length = lengthDescriptor.value as number;
    const names = Object.getOwnPropertyNames(value);
    if (
      names.length !== length + 1 ||
      !names.includes("length") ||
      names.some((name) => name !== "length" && !/^(?:0|[1-9][0-9]*)$/u.test(name))
    ) {
      return undefined;
    }
    const output: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
        return undefined;
      }
      output.push(descriptor.value);
    }
    return Object.freeze(output);
  } catch {
    return undefined;
  }
}

function arrayLength(value: unknown): number | undefined {
  try {
    if (!Array.isArray(value)) return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(value, "length");
    return descriptor !== undefined &&
      "value" in descriptor &&
      Number.isSafeInteger(descriptor.value) &&
      descriptor.value >= 0
      ? (descriptor.value as number)
      : undefined;
  } catch {
    return undefined;
  }
}

function failure(
  code: RuntimeReactRenderFailureCode,
  identity?: Partial<RuntimeReactDiagnosticIdentity>,
  channel: RuntimeReactRenderFailureChannel = null,
  diagnostics: readonly DesenSemanticDiagnostic[] = EMPTY_DIAGNOSTICS,
): RuntimeReactRenderResult {
  const result = Object.freeze({
    status: "failed",
    failure: Object.freeze({
      code,
      runtimeNodeId: identity?.runtimeNodeId ?? null,
      sourceNodeId: identity?.sourceNodeId ?? null,
      capabilityId: identity?.capabilityId ?? null,
      channel,
      diagnostics,
    }),
  } as const);
  RENDER_FAILURE_RESULTS.add(result);
  return result;
}

function receivingFailure(
  ordinaryCode:
    | "INVALID_BEHAVIOR_PROPS"
    | "INVALID_BEHAVIOR_SLOTS"
    | "INVALID_BEHAVIOR_STYLE"
    | "INVALID_COMPONENT_PROPS"
    | "INVALID_COMPONENT_SLOTS"
    | "INVALID_COMPONENT_STYLE",
  identity: RuntimeReactDiagnosticIdentity,
  channel: Exclude<RuntimeReactRenderFailureChannel, null>,
  diagnostics: readonly DesenSemanticDiagnostic[],
): RuntimeReactRenderResult {
  return failure(
    diagnostics.some(({ code }) => code === ADAPTER_VALIDATION_LIMIT_EXCEEDED_CODE)
      ? "RECEIVING_VALIDATION_LIMIT_EXCEEDED"
      : ordinaryCode,
    identity,
    channel,
    diagnostics,
  );
}

function retainString(value: string, state: PreparationState, limits: RenderLimits): boolean {
  state.stringCodeUnits += value.length;
  return state.stringCodeUnits <= limits.maxStringCodeUnits;
}

function captureJsonValue(
  source: unknown,
  depth: number,
  active: WeakSet<object>,
  state: PreparationState,
  limits: RenderLimits,
): JsonCaptureResult {
  state.jsonOccurrences += 1;
  if (state.jsonOccurrences > limits.maxJsonOccurrences) {
    return Object.freeze({ status: "failed", code: "JSON_OCCURRENCE_LIMIT_EXCEEDED" });
  }
  if (depth > limits.maxJsonDepth) {
    return Object.freeze({ status: "failed", code: "JSON_DEPTH_LIMIT_EXCEEDED" });
  }
  if (source === null || typeof source === "boolean") {
    return Object.freeze({ status: "captured", value: source });
  }
  if (typeof source === "number") {
    return Number.isFinite(source)
      ? Object.freeze({ status: "captured", value: source })
      : Object.freeze({ status: "failed", code: "MALFORMED_RENDER_PLAN" });
  }
  if (typeof source === "string") {
    return retainString(source, state, limits)
      ? Object.freeze({ status: "captured", value: source })
      : Object.freeze({ status: "failed", code: "STRING_LIMIT_EXCEEDED" });
  }
  if (typeof source !== "object" || active.has(source)) {
    return Object.freeze({ status: "failed", code: "MALFORMED_RENDER_PLAN" });
  }

  active.add(source);
  try {
    if (Array.isArray(source)) {
      const lengthDescriptor = Object.getOwnPropertyDescriptor(source, "length");
      if (
        lengthDescriptor === undefined ||
        !("value" in lengthDescriptor) ||
        !Number.isSafeInteger(lengthDescriptor.value) ||
        lengthDescriptor.value < 0
      ) {
        return Object.freeze({ status: "failed", code: "MALFORMED_RENDER_PLAN" });
      }
      const length = lengthDescriptor.value as number;
      if (length > limits.maxJsonOccurrences - state.jsonOccurrences) {
        return Object.freeze({ status: "failed", code: "JSON_OCCURRENCE_LIMIT_EXCEEDED" });
      }
      const keys = Reflect.ownKeys(source);
      if (
        keys.length !== length + 1 ||
        keys.some((key) => typeof key === "symbol") ||
        !keys.includes("length")
      ) {
        return Object.freeze({ status: "failed", code: "MALFORMED_RENDER_PLAN" });
      }
      const output: RuntimeJsonValue[] = [];
      for (let index = 0; index < length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(source, String(index));
        if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
          return Object.freeze({ status: "failed", code: "MALFORMED_RENDER_PLAN" });
        }
        const captured = captureJsonValue(descriptor.value, depth + 1, active, state, limits);
        if (captured.status === "failed") return captured;
        output.push(captured.value);
      }
      return Object.freeze({ status: "captured", value: Object.freeze(output) });
    }

    const prototype = Object.getPrototypeOf(source);
    if (prototype !== Object.prototype && prototype !== null) {
      return Object.freeze({ status: "failed", code: "MALFORMED_RENDER_PLAN" });
    }
    const ownKeys = Reflect.ownKeys(source);
    if (
      ownKeys.length > limits.maxJsonOccurrences - state.jsonOccurrences ||
      ownKeys.some((key) => typeof key === "symbol")
    ) {
      return Object.freeze({
        status: "failed",
        code:
          ownKeys.length > limits.maxJsonOccurrences - state.jsonOccurrences
            ? "JSON_OCCURRENCE_LIMIT_EXCEEDED"
            : "MALFORMED_RENDER_PLAN",
      });
    }
    const keys = (ownKeys as string[]).sort();
    const output = Object.create(null) as Record<string, RuntimeJsonValue>;
    for (const key of keys) {
      if (!retainString(key, state, limits)) {
        return Object.freeze({ status: "failed", code: "STRING_LIMIT_EXCEEDED" });
      }
      const descriptor = Object.getOwnPropertyDescriptor(source, key);
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
        return Object.freeze({ status: "failed", code: "MALFORMED_RENDER_PLAN" });
      }
      const captured = captureJsonValue(descriptor.value, depth + 1, active, state, limits);
      if (captured.status === "failed") return captured;
      output[key] = captured.value;
    }
    return Object.freeze({
      status: "captured",
      value: Object.freeze(output) as RuntimeJsonObject,
    });
  } catch {
    return Object.freeze({ status: "failed", code: "MALFORMED_RENDER_PLAN" });
  } finally {
    active.delete(source);
  }
}

function captureJsonObject(
  value: unknown,
  state: PreparationState,
  limits: RenderLimits,
  identity?: Partial<RuntimeReactDiagnosticIdentity>,
): RuntimeJsonObject | RuntimeReactRenderResult {
  const captured = captureJsonValue(value, 0, new WeakSet(), state, limits);
  if (captured.status === "failed") return failure(captured.code, identity);
  return isPlainRecord(captured.value)
    ? captured.value
    : failure("MALFORMED_RENDER_PLAN", identity);
}

function nodeIdentity(value: unknown): RuntimeReactDiagnosticIdentity | undefined {
  if (!isPlainRecord(value)) return undefined;
  const identity = ownData(value, "identity");
  const sourceNodeId = ownData(value, "sourceNodeId");
  const capabilityId = ownData(value, "use");
  return typeof identity === "string" &&
    identity.length > 0 &&
    typeof sourceNodeId === "string" &&
    sourceNodeId.length > 0 &&
    typeof capabilityId === "string" &&
    capabilityId.length > 0
    ? Object.freeze({
        runtimeNodeId: identity,
        sourceNodeId,
        capabilityId,
      })
    : undefined;
}

function slotProjection(
  slots: Readonly<Record<string, readonly PreparedNode[]>>,
): Readonly<Record<string, readonly Readonly<{ readonly capabilityId: string }>[]>> {
  const projection: Record<string, readonly Readonly<{ readonly capabilityId: string }>[]> =
    Object.create(null);
  for (const name of Object.keys(slots)) {
    projection[name] = Object.freeze(
      (slots[name] ?? []).map((child) => Object.freeze({ capabilityId: child.capabilityId })),
    );
  }
  return Object.freeze(projection);
}

function prepareSlotMap(
  raw: unknown,
  depth: number,
  state: PreparationState,
  limits: RenderLimits,
  components: ReadonlyMap<string, RuntimeReactComponentAdapterDefinition>,
  behaviors: ReadonlyMap<string, RuntimeReactBehaviorAdapterDefinition>,
): Readonly<Record<string, readonly PreparedNode[]>> | RuntimeReactRenderResult {
  if (!isPlainRecord(raw)) return failure("MALFORMED_RENDER_PLAN");
  const slots: Record<string, readonly PreparedNode[]> = Object.create(null);
  let names: string[];
  try {
    if (Object.getOwnPropertySymbols(raw).length !== 0) {
      return failure("MALFORMED_RENDER_PLAN");
    }
    names = Object.getOwnPropertyNames(raw);
    if (names.length > RUNTIME_REACT_RENDER_LIMITS.maxSlotEntries) {
      return failure("SLOT_LIMIT_EXCEEDED");
    }
  } catch {
    return failure("MALFORMED_RENDER_PLAN");
  }
  state.slotEntries += names.length;
  if (state.slotEntries > limits.maxSlotEntries) return failure("SLOT_LIMIT_EXCEEDED");
  for (const name of names) {
    if (!retainString(name, state, limits)) return failure("STRING_LIMIT_EXCEEDED");
    const rawChildren = ownData(raw, name);
    const length = arrayLength(rawChildren);
    if (length !== undefined && length > RUNTIME_REACT_RENDER_LIMITS.maxSlotEntries) {
      return failure("SLOT_LIMIT_EXCEEDED");
    }
    const children = captureDenseArray(rawChildren, RUNTIME_REACT_RENDER_LIMITS.maxSlotEntries);
    if (children === undefined) return failure("MALFORMED_RENDER_PLAN");
    state.slotEntries += children.length;
    if (state.slotEntries > limits.maxSlotEntries) return failure("SLOT_LIMIT_EXCEEDED");
    const prepared: PreparedNode[] = [];
    for (const child of children) {
      const result = prepareNode(child, depth, state, limits, components, behaviors);
      if (isRenderFailure(result)) return result;
      prepared.push(result);
    }
    slots[name] = Object.freeze(prepared);
  }
  return Object.freeze(slots);
}

function prepareBehavior(
  raw: unknown,
  owner: RuntimeReactDiagnosticIdentity,
  depth: number,
  state: PreparationState,
  limits: RenderLimits,
  components: ReadonlyMap<string, RuntimeReactComponentAdapterDefinition>,
  behaviors: ReadonlyMap<string, RuntimeReactBehaviorAdapterDefinition>,
): PreparedBehavior | RuntimeReactRenderResult {
  if (
    !isPlainRecord(raw) ||
    !exactOwnDataKeys(raw, ["identity", "id", "use", "props", "style", "slots"])
  ) {
    return failure("MALFORMED_RENDER_PLAN", owner);
  }
  const identity = ownData(raw, "identity");
  const behaviorId = ownData(raw, "id");
  const capabilityId = ownData(raw, "use");
  if (
    typeof identity !== "string" ||
    identity.length === 0 ||
    typeof behaviorId !== "string" ||
    behaviorId.length === 0 ||
    typeof capabilityId !== "string" ||
    capabilityId.length === 0
  ) {
    return failure("MALFORMED_RENDER_PLAN", owner);
  }
  const behaviorIdentity = Object.freeze({
    runtimeNodeId: identity,
    sourceNodeId: owner.sourceNodeId,
    capabilityId,
  });
  if (
    !retainString(identity, state, limits) ||
    !retainString(behaviorId, state, limits) ||
    !retainString(capabilityId, state, limits)
  ) {
    return failure("STRING_LIMIT_EXCEEDED", behaviorIdentity);
  }
  if (state.identities.has(identity)) {
    return failure("DUPLICATE_RUNTIME_IDENTITY", behaviorIdentity);
  }
  state.identities.add(identity);
  state.behaviorCount += 1;
  if (state.behaviorCount > limits.maxBehaviors) {
    return failure("BEHAVIOR_LIMIT_EXCEEDED", behaviorIdentity);
  }
  const definition = behaviors.get(capabilityId);
  if (definition === undefined) {
    return failure("UNKNOWN_BEHAVIOR_CAPABILITY", behaviorIdentity);
  }
  state.bindings.set(
    identity,
    Object.freeze({
      kind: "behavior",
      runtimeInstanceId: identity,
      sourceNodeId: owner.sourceNodeId,
      capabilityId,
      behaviorId,
      ownerRuntimeNodeId: owner.runtimeNodeId,
    }),
  );
  const capturedProps = captureJsonObject(ownData(raw, "props"), state, limits, behaviorIdentity);
  if (isRenderFailure(capturedProps)) return capturedProps;
  const validatedProps = validateDesenResolvedAdapterProps(
    capturedProps,
    { capabilityKind: "behavior", capabilityId },
    state.validationScope,
  );
  if (!validatedProps.valid) {
    return receivingFailure(
      "INVALID_BEHAVIOR_PROPS",
      behaviorIdentity,
      "props",
      validatedProps.diagnostics,
    );
  }
  let reconciliationKey: string;
  try {
    reconciliationKey = createRuntimeReactReconciliationKey({
      runtimeNodeId: identity,
      capabilityId,
      props: validatedProps.value as RuntimeJsonObject,
      remountOnProps: definition.remountOnProps,
    });
  } catch {
    return failure("RECONCILIATION_KEY_FAILED", behaviorIdentity);
  }
  const capturedStyle = captureJsonObject(ownData(raw, "style"), state, limits, behaviorIdentity);
  if (isRenderFailure(capturedStyle)) return capturedStyle;
  const validatedStyle = validateDesenResolvedAdapterStyle(
    capturedStyle,
    { capabilityKind: "behavior", capabilityId },
    state.validationScope,
  );
  if (!validatedStyle.valid) {
    return receivingFailure(
      "INVALID_BEHAVIOR_STYLE",
      behaviorIdentity,
      "style",
      validatedStyle.diagnostics,
    );
  }
  const slots = prepareSlotMap(ownData(raw, "slots"), depth, state, limits, components, behaviors);
  if (isRenderFailure(slots)) return slots;
  const validatedSlots = validateDesenResolvedAdapterSlots(
    slotProjection(slots),
    { capabilityKind: "behavior", capabilityId },
    state.validationScope,
  );
  if (!validatedSlots.valid) {
    return receivingFailure(
      "INVALID_BEHAVIOR_SLOTS",
      behaviorIdentity,
      "slots",
      validatedSlots.diagnostics,
    );
  }
  return Object.freeze({
    runtimeNodeId: identity,
    sourceNodeId: owner.sourceNodeId,
    capabilityId,
    behaviorId,
    ownerRuntimeNodeId: owner.runtimeNodeId,
    props: validatedProps.value as RuntimeJsonObject,
    style: validatedStyle.value,
    definition,
    reconciliationKey,
    slots,
  });
}

function prepareNode(
  raw: unknown,
  depth: number,
  state: PreparationState,
  limits: RenderLimits,
  components: ReadonlyMap<string, RuntimeReactComponentAdapterDefinition>,
  behaviors: ReadonlyMap<string, RuntimeReactBehaviorAdapterDefinition>,
): PreparedNode | RuntimeReactRenderResult {
  const identity = nodeIdentity(raw);
  if (
    identity === undefined ||
    !isPlainRecord(raw) ||
    !exactOwnDataKeys(raw, [
      "identity",
      "sourceNodeId",
      "use",
      "props",
      "style",
      "slots",
      "behaviors",
    ])
  ) {
    return failure("MALFORMED_RENDER_PLAN", identity);
  }
  if (depth > limits.maxDepth) return failure("DEPTH_LIMIT_EXCEEDED", identity);
  if (
    !retainString(identity.runtimeNodeId, state, limits) ||
    !retainString(identity.sourceNodeId, state, limits) ||
    !retainString(identity.capabilityId, state, limits)
  ) {
    return failure("STRING_LIMIT_EXCEEDED", identity);
  }
  if (state.identities.has(identity.runtimeNodeId)) {
    return failure("DUPLICATE_RUNTIME_IDENTITY", identity);
  }
  state.identities.add(identity.runtimeNodeId);
  state.nodeCount += 1;
  if (state.nodeCount > limits.maxNodes) return failure("NODE_LIMIT_EXCEEDED", identity);
  const definition = components.get(identity.capabilityId);
  if (definition === undefined) {
    return failure("UNKNOWN_COMPONENT_CAPABILITY", identity);
  }
  state.bindings.set(
    identity.runtimeNodeId,
    Object.freeze({
      kind: "component",
      runtimeInstanceId: identity.runtimeNodeId,
      sourceNodeId: identity.sourceNodeId,
      capabilityId: identity.capabilityId,
    }),
  );

  const rawBehaviors = ownData(raw, "behaviors");
  const behaviorLength = arrayLength(rawBehaviors);
  if (behaviorLength !== undefined && behaviorLength > RUNTIME_REACT_RENDER_LIMITS.maxBehaviors) {
    return failure("BEHAVIOR_LIMIT_EXCEEDED", identity);
  }
  const behaviorValues = captureDenseArray(rawBehaviors, RUNTIME_REACT_RENDER_LIMITS.maxBehaviors);
  if (behaviorValues === undefined) return failure("MALFORMED_RENDER_PLAN", identity);

  const capturedProps = captureJsonObject(ownData(raw, "props"), state, limits, identity);
  if (isRenderFailure(capturedProps)) return capturedProps;
  const validatedProps = validateDesenResolvedAdapterProps(
    capturedProps,
    { capabilityKind: "component", capabilityId: identity.capabilityId },
    state.validationScope,
  );
  if (!validatedProps.valid) {
    return receivingFailure(
      "INVALID_COMPONENT_PROPS",
      identity,
      "props",
      validatedProps.diagnostics,
    );
  }
  let reconciliationKey: string;
  try {
    reconciliationKey = createRuntimeReactReconciliationKey({
      runtimeNodeId: identity.runtimeNodeId,
      capabilityId: identity.capabilityId,
      props: validatedProps.value as RuntimeJsonObject,
      remountOnProps: definition.remountOnProps,
    });
  } catch {
    return failure("RECONCILIATION_KEY_FAILED", identity);
  }
  const capturedStyle = captureJsonObject(ownData(raw, "style"), state, limits, identity);
  if (isRenderFailure(capturedStyle)) return capturedStyle;
  const validatedStyle = validateDesenResolvedAdapterStyle(
    capturedStyle,
    { capabilityKind: "component", capabilityId: identity.capabilityId },
    state.validationScope,
  );
  if (!validatedStyle.valid) {
    return receivingFailure(
      "INVALID_COMPONENT_STYLE",
      identity,
      "style",
      validatedStyle.diagnostics,
    );
  }
  const slots = prepareSlotMap(
    ownData(raw, "slots"),
    depth + 1,
    state,
    limits,
    components,
    behaviors,
  );
  if (isRenderFailure(slots)) return slots;
  const validatedSlots = validateDesenResolvedAdapterSlots(
    slotProjection(slots),
    { capabilityKind: "component", capabilityId: identity.capabilityId },
    state.validationScope,
  );
  if (!validatedSlots.valid) {
    return receivingFailure(
      "INVALID_COMPONENT_SLOTS",
      identity,
      "slots",
      validatedSlots.diagnostics,
    );
  }

  const preparedBehaviors: PreparedBehavior[] = [];
  for (const behavior of behaviorValues) {
    const prepared = prepareBehavior(
      behavior,
      identity,
      depth + 1,
      state,
      limits,
      components,
      behaviors,
    );
    if (isRenderFailure(prepared)) return prepared;
    preparedBehaviors.push(prepared);
  }
  return Object.freeze({
    runtimeNodeId: identity.runtimeNodeId,
    sourceNodeId: identity.sourceNodeId,
    capabilityId: identity.capabilityId,
    props: validatedProps.value as RuntimeJsonObject,
    style: validatedStyle.value,
    definition,
    reconciliationKey,
    slots,
    behaviors: Object.freeze(preparedBehaviors),
  });
}

function bindingIdentity(
  binding: RuntimeHeadlessBindingSnapshot,
): Partial<RuntimeReactDiagnosticIdentity> {
  return {
    runtimeNodeId: binding.runtimeInstanceId,
    sourceNodeId: binding.sourceNodeId,
    capabilityId: binding.capabilityId,
  };
}

function matchesPreparedBinding(
  prepared: PreparedBindingIdentity,
  binding: RuntimeHeadlessBindingSnapshot,
): boolean {
  if (
    prepared.kind !== binding.kind ||
    prepared.runtimeInstanceId !== binding.runtimeInstanceId ||
    prepared.sourceNodeId !== binding.sourceNodeId ||
    prepared.capabilityId !== binding.capabilityId
  ) {
    return false;
  }
  return prepared.kind === "component"
    ? binding.kind === "component"
    : binding.kind === "behavior" &&
        prepared.behaviorId === binding.behaviorId &&
        prepared.ownerRuntimeNodeId === binding.ownerRuntimeInstanceId;
}

function validateBindingParity(
  prepared: ReadonlyMap<string, PreparedBindingIdentity>,
  bindings: readonly RuntimeHeadlessBindingSnapshot[],
): RuntimeReactRenderResult | undefined {
  const matched = new Set<string>();
  for (const binding of bindings) {
    const expected = prepared.get(binding.runtimeInstanceId);
    if (
      expected === undefined ||
      matched.has(binding.runtimeInstanceId) ||
      !matchesPreparedBinding(expected, binding)
    ) {
      return failure("RUNTIME_BINDING_MISMATCH", bindingIdentity(binding));
    }
    matched.add(binding.runtimeInstanceId);
  }
  for (const expected of prepared.values()) {
    if (!matched.has(expected.runtimeInstanceId)) {
      return failure("RUNTIME_BINDING_MISMATCH", {
        runtimeNodeId: expected.runtimeInstanceId,
        sourceNodeId: expected.sourceNodeId,
        capabilityId: expected.capabilityId,
      });
    }
  }
  return undefined;
}

function diagnosticBindings(
  prepared: ReadonlyMap<string, PreparedBindingIdentity>,
): readonly RuntimeReactDiagnosticIndexBinding[] {
  return Object.freeze(
    [...prepared.values()].map((binding): RuntimeReactDiagnosticIndexBinding =>
      binding.kind === "component"
        ? Object.freeze({
            kind: "component",
            runtimeNodeId: binding.runtimeInstanceId,
            sourceNodeId: binding.sourceNodeId,
            capabilityId: binding.capabilityId,
          })
        : Object.freeze({
            kind: "behavior",
            runtimeNodeId: binding.runtimeInstanceId,
            sourceNodeId: binding.sourceNodeId,
            capabilityId: binding.capabilityId,
            behaviorId: binding.behaviorId,
            ownerRuntimeNodeId: binding.ownerRuntimeNodeId,
          }),
    ),
  );
}

function renderSlots(
  slots: Readonly<Record<string, readonly PreparedNode[]>>,
  authority: RuntimeReactRenderAuthority,
): RuntimeReactNamedSlots {
  const output: Record<string, readonly ReactNode[]> = Object.create(null);
  for (const name of Object.keys(slots)) {
    output[name] = Object.freeze((slots[name] ?? []).map((child) => renderNode(child, authority)));
  }
  return Object.freeze(output);
}

function renderNode(node: PreparedNode, authority: RuntimeReactRenderAuthority): ReactElement {
  const identity = Object.freeze({
    runtimeNodeId: node.runtimeNodeId,
    sourceNodeId: node.sourceNodeId,
    capabilityId: node.capabilityId,
  });
  let rendered: ReactNode = createRuntimeReactComponentAdapterElement({
    ...authority,
    kind: "component",
    runtimeInstanceId: node.runtimeNodeId,
    reconciliationKey: node.reconciliationKey,
    hasManagedDescendants: Object.values(node.slots).some((children) => children.length > 0),
    component: node.definition.component,
    identity,
    props: node.props,
    slots: renderSlots(node.slots, authority),
    style: node.style,
  });
  for (const behavior of [...node.behaviors].reverse()) {
    rendered = createRuntimeReactBehaviorAdapterElement({
      ...authority,
      kind: "behavior",
      runtimeInstanceId: behavior.runtimeNodeId,
      reconciliationKey: behavior.reconciliationKey,
      component: behavior.definition.component,
      identity: Object.freeze({
        runtimeNodeId: behavior.runtimeNodeId,
        sourceNodeId: behavior.sourceNodeId,
        capabilityId: behavior.capabilityId,
      }),
      behaviorId: behavior.behaviorId,
      props: behavior.props,
      slots: renderSlots(behavior.slots, authority),
      style: behavior.style,
      children: rendered,
    });
  }
  return createElement(Fragment, { key: node.runtimeNodeId }, rendered);
}

function authenticatedPlan(
  snapshot: RuntimeHeadlessSessionSnapshot,
): RuntimeHeadlessSurfacePlan | undefined {
  const plan = snapshot.plan;
  return isPlainRecord(plan) && exactOwnDataKeys(plan, ["documentId", "surfaceId", "root"])
    ? plan
    : undefined;
}

/**
 * Authenticates one current session generation, preflights its complete public plan, then creates
 * the React element tree.
 *
 * @remarks Registry, session generation, exact Catalog set, complete resolved component and
 * behavior props, semantic style maps, and materialized named slots all pass before the first
 * React element is created. The prepared component and behavior inventory must also match the
 * authenticated session's current bindings in both directions. Adapters receive only detached
 * validated props, complete state → part → property style data, exact named React slots, stable
 * public identities, and a commit-gated least-authority interaction seam. State activation and
 * platform translation remain adapter responsibilities. No raw plan, behavior plan, lower bridge,
 * React-private structure, DOM reference, fallback component, or dynamic loader crosses the
 * boundary.
 */
export function renderRuntimeReactSurface(
  input: RuntimeReactRenderInput,
): RuntimeReactRenderResult {
  const captured = captureRenderInput(input);
  if (captured === undefined) return failure("MALFORMED_RENDER_PLAN");

  const registry = readRuntimeReactAdapterRegistryAuthority(
    captured.registry as RuntimeReactAdapterRegistryHandle,
  );
  if (registry === undefined) return failure("INVALID_REGISTRY");

  // Capture every caller-controlled profile before authenticating the session. A hostile Proxy
  // may perform reentrant host work from reflection traps; the later authority check must observe
  // any disposal or publication caused by that work rather than authorize a stale generation.
  const limits = captureLimits(captured.limits);
  if (limits === undefined) return failure("MALFORMED_RENDER_PLAN");

  const authenticated = authenticateRuntimeHeadlessSessionAdapterAuthority(
    captured.session as RuntimeHeadlessSessionHandle,
    {
      snapshot: captured.snapshot as RuntimeHeadlessSessionSnapshot,
      catalogSet: captured.catalogSet as DesenValidatedExecutionCatalogSet,
    },
  );
  if (authenticated.status === "invalid-snapshot") {
    return failure("INVALID_SESSION_SNAPSHOT");
  }
  if (authenticated.status === "invalid-catalog-set") {
    return failure("INVALID_CATALOG_SET");
  }
  if (authenticated.status !== "authenticated") {
    return failure("INVALID_SESSION");
  }

  const scope = createDesenResolvedAdapterValidationScope(
    captured.catalogSet as DesenValidatedExecutionCatalogSet,
    limits.receiving,
  );
  if (scope.status === "invalid") {
    return failure(
      scope.reason === "invalid-catalog-set" ? "INVALID_CATALOG_SET" : "MALFORMED_RENDER_PLAN",
    );
  }

  const plan = authenticatedPlan(authenticated.snapshot);
  if (plan === undefined) return failure("MALFORMED_RENDER_PLAN");
  const documentId = ownData(plan, "documentId");
  const surfaceId = ownData(plan, "surfaceId");
  const rawRoots = ownData(plan, "root");
  const rootLength = arrayLength(rawRoots);
  if (rootLength !== undefined && rootLength > RUNTIME_REACT_RENDER_LIMITS.maxNodes) {
    return failure("NODE_LIMIT_EXCEEDED");
  }
  const roots = captureDenseArray(rawRoots, RUNTIME_REACT_RENDER_LIMITS.maxNodes);
  if (
    typeof documentId !== "string" ||
    documentId.length === 0 ||
    typeof surfaceId !== "string" ||
    surfaceId.length === 0 ||
    roots === undefined
  ) {
    return failure("MALFORMED_RENDER_PLAN");
  }

  const state: PreparationState = {
    identities: new Set(),
    bindings: new Map(),
    validationScope: scope.scope,
    nodeCount: 0,
    behaviorCount: 0,
    slotEntries: 0,
    jsonOccurrences: 0,
    stringCodeUnits: 0,
  };
  if (
    !retainString(documentId, state, limits.render) ||
    !retainString(surfaceId, state, limits.render)
  ) {
    return failure("STRING_LIMIT_EXCEEDED");
  }
  const prepared: PreparedNode[] = [];
  for (const root of roots) {
    const result = prepareNode(
      root,
      0,
      state,
      limits.render,
      registry.components,
      registry.behaviors,
    );
    if (isRenderFailure(result)) return result;
    prepared.push(result);
  }

  const parityFailure = validateBindingParity(state.bindings, authenticated.snapshot.bindings);
  if (parityFailure !== undefined) return parityFailure;

  const diagnosticIndex = buildRuntimeReactDiagnosticIndex(diagnosticBindings(state.bindings), {
    maxBindings: state.nodeCount + state.behaviorCount,
    maxIdentifierOccurrences: state.nodeCount * 3 + state.behaviorCount * 5,
    maxIdentifierCodeUnits: limits.render.maxStringCodeUnits,
  });
  if (diagnosticIndex.status !== "built") {
    return failure("DIAGNOSTIC_INDEX_FAILED");
  }

  const authority: RuntimeReactRenderAuthority = Object.freeze({
    session: captured.session as RuntimeHeadlessSessionHandle,
    snapshot: authenticated.snapshot,
  });
  const managedTree = createElement(
    Fragment,
    null,
    ...prepared.map((node) => renderNode(node, authority)),
  );
  const SessionBoundary = sessionRegistryBoundary(
    captured.session as object,
    captured.registry as object,
  );
  const element = createElement(SessionBoundary, null, managedTree);
  return Object.freeze({
    status: "rendered",
    surface: Object.freeze({
      documentId,
      surfaceId,
      element,
      nodeCount: state.nodeCount,
      behaviorCount: state.behaviorCount,
      diagnosticIndex: diagnosticIndex.index,
    }),
  });
}
