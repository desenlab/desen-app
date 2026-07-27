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

import { readRuntimeReactAdapterRegistryAuthority } from "./registry.js";

import type { ReactElement, ReactNode } from "react";
import type {
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
  RuntimeReactAdapterRegistryHandle,
  RuntimeReactBehaviorAdapterComponent,
  RuntimeReactComponentAdapterComponent,
  RuntimeReactDiagnosticIdentity,
  RuntimeReactInteractionPort,
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

interface PreparedBehavior {
  readonly runtimeNodeId: string;
  readonly sourceNodeId: string;
  readonly capabilityId: string;
  readonly behaviorId: string;
  readonly props: RuntimeJsonObject;
  readonly style: RuntimeReactSemanticStyle;
  readonly component: RuntimeReactBehaviorAdapterComponent;
  readonly slots: Readonly<Record<string, readonly PreparedNode[]>>;
}

interface PreparedNode {
  readonly runtimeNodeId: string;
  readonly sourceNodeId: string;
  readonly capabilityId: string;
  readonly props: RuntimeJsonObject;
  readonly style: RuntimeReactSemanticStyle;
  readonly component: RuntimeReactComponentAdapterComponent;
  readonly slots: Readonly<Record<string, readonly PreparedNode[]>>;
  readonly behaviors: readonly PreparedBehavior[];
}

interface PreparationState {
  readonly identities: Set<string>;
  readonly validationScope: DesenResolvedAdapterValidationScope;
  nodeCount: number;
  behaviorCount: number;
  slotEntries: number;
  jsonOccurrences: number;
  stringCodeUnits: number;
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
const UNAVAILABLE_INTERACTIONS: RuntimeReactInteractionPort = Object.freeze({
  dispatchEvent: () => Object.freeze({ status: "unavailable" }),
  attachCommands: () => Object.freeze({ status: "unavailable" }),
  detachCommands: () => Object.freeze({ status: "unavailable" }),
});

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
  components: ReadonlyMap<string, RuntimeReactComponentAdapterComponent>,
  behaviors: ReadonlyMap<string, RuntimeReactBehaviorAdapterComponent>,
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
  components: ReadonlyMap<string, RuntimeReactComponentAdapterComponent>,
  behaviors: ReadonlyMap<string, RuntimeReactBehaviorAdapterComponent>,
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
  const component = behaviors.get(capabilityId);
  if (component === undefined) {
    return failure("UNKNOWN_BEHAVIOR_CAPABILITY", behaviorIdentity);
  }
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
    props: validatedProps.value as RuntimeJsonObject,
    style: validatedStyle.value,
    component,
    slots,
  });
}

function prepareNode(
  raw: unknown,
  depth: number,
  state: PreparationState,
  limits: RenderLimits,
  components: ReadonlyMap<string, RuntimeReactComponentAdapterComponent>,
  behaviors: ReadonlyMap<string, RuntimeReactBehaviorAdapterComponent>,
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
  const component = components.get(identity.capabilityId);
  if (component === undefined) {
    return failure("UNKNOWN_COMPONENT_CAPABILITY", identity);
  }

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
    component,
    slots,
    behaviors: Object.freeze(preparedBehaviors),
  });
}

function renderSlots(
  slots: Readonly<Record<string, readonly PreparedNode[]>>,
): RuntimeReactNamedSlots {
  const output: Record<string, readonly ReactNode[]> = Object.create(null);
  for (const name of Object.keys(slots)) {
    output[name] = Object.freeze((slots[name] ?? []).map((child) => renderNode(child)));
  }
  return Object.freeze(output);
}

function renderNode(node: PreparedNode): ReactElement {
  const identity = Object.freeze({
    runtimeNodeId: node.runtimeNodeId,
    sourceNodeId: node.sourceNodeId,
    capabilityId: node.capabilityId,
  });
  let rendered: ReactNode = createElement(node.component, {
    identity,
    props: node.props,
    slots: renderSlots(node.slots),
    style: node.style,
    interactions: UNAVAILABLE_INTERACTIONS,
  });
  for (const behavior of [...node.behaviors].reverse()) {
    rendered = createElement(behavior.component, {
      identity: Object.freeze({
        runtimeNodeId: behavior.runtimeNodeId,
        sourceNodeId: behavior.sourceNodeId,
        capabilityId: behavior.capabilityId,
      }),
      behaviorId: behavior.behaviorId,
      props: behavior.props,
      slots: renderSlots(behavior.slots),
      style: behavior.style,
      interactions: UNAVAILABLE_INTERACTIONS,
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
 * React element is created. Adapters receive only detached validated props, complete
 * state → part → property style data, exact named React slots, stable public identities, and the
 * least-authority interaction seam. State activation and platform translation remain adapter
 * responsibilities. No raw plan, behavior plan, React-private structure, DOM reference, fallback
 * component, or dynamic loader crosses the boundary.
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

  const element = createElement(Fragment, null, ...prepared.map((node) => renderNode(node)));
  return Object.freeze({
    status: "rendered",
    surface: Object.freeze({
      documentId,
      surfaceId,
      element,
      nodeCount: state.nodeCount,
      behaviorCount: state.behaviorCount,
    }),
  });
}
