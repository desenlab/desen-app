import { Fragment, createElement } from "react";

import { readRuntimeReactAdapterRegistryAuthority } from "./registry.js";

import type { ReactElement, ReactNode } from "react";
import type {
  RuntimeHeadlessBehaviorPlan,
  RuntimeHeadlessNodePlan,
  RuntimeHeadlessSurfacePlan,
  RuntimeJsonObject,
  RuntimeJsonValue,
} from "@desen/runtime-core";
import type {
  RuntimeReactAdapterRegistryHandle,
  RuntimeReactBehaviorAdapterComponent,
  RuntimeReactComponentAdapterComponent,
  RuntimeReactDiagnosticIdentity,
  RuntimeReactInteractionPort,
  RuntimeReactNamedSlots,
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

/** Optional trusted profile that may only lower render-plan ceilings. */
export interface RuntimeReactRenderLimitProfile {
  readonly maxNodes?: number;
  readonly maxDepth?: number;
  readonly maxSlotEntries?: number;
  readonly maxBehaviors?: number;
  readonly maxJsonDepth?: number;
  readonly maxJsonOccurrences?: number;
  readonly maxStringCodeUnits?: number;
}

/** Complete public input for one all-or-nothing render-plan compilation. */
export interface RuntimeReactRenderInput {
  readonly registry: RuntimeReactAdapterRegistryHandle;
  readonly plan: RuntimeHeadlessSurfacePlan;
  readonly limits?: RuntimeReactRenderLimitProfile;
}

/** Stable fail-closed renderer classification. */
export type RuntimeReactRenderFailureCode =
  | "BEHAVIOR_LIMIT_EXCEEDED"
  | "DEPTH_LIMIT_EXCEEDED"
  | "DUPLICATE_RUNTIME_IDENTITY"
  | "INVALID_REGISTRY"
  | "JSON_DEPTH_LIMIT_EXCEEDED"
  | "JSON_OCCURRENCE_LIMIT_EXCEEDED"
  | "MALFORMED_RENDER_PLAN"
  | "NODE_LIMIT_EXCEEDED"
  | "SLOT_LIMIT_EXCEEDED"
  | "STRING_LIMIT_EXCEEDED"
  | "UNKNOWN_BEHAVIOR_CAPABILITY"
  | "UNKNOWN_COMPONENT_CAPABILITY";

/** Public callback-free failure linked to the nearest available source and runtime identities. */
export interface RuntimeReactRenderFailure {
  readonly code: RuntimeReactRenderFailureCode;
  readonly runtimeNodeId: string | null;
  readonly sourceNodeId: string | null;
  readonly capabilityId: string | null;
}

/** One successfully preflighted React surface. */
export interface RuntimeReactRenderedSurface {
  readonly documentId: string;
  readonly surfaceId: string;
  readonly element: ReactElement;
  readonly nodeCount: number;
  readonly behaviorCount: number;
}

/** Complete controlled result of compiling one public headless plan. */
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

interface PreparedBehavior {
  readonly plan: RuntimeHeadlessBehaviorPlan;
  readonly component: RuntimeReactBehaviorAdapterComponent;
  readonly slots: Readonly<Record<string, readonly PreparedNode[]>>;
}

interface PreparedNode {
  readonly plan: RuntimeHeadlessNodePlan;
  readonly component: RuntimeReactComponentAdapterComponent;
  readonly slots: Readonly<Record<string, readonly PreparedNode[]>>;
  readonly behaviors: readonly PreparedBehavior[];
}

interface PreparationState {
  readonly identities: Set<string>;
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

const INVALID = Symbol("invalid-own-data");
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

function captureLimits(
  value: RuntimeReactRenderLimitProfile | undefined,
): RenderLimits | undefined {
  if (value === undefined) return RUNTIME_REACT_RENDER_LIMITS;
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
    if (Object.getOwnPropertySymbols(value).length !== 0) return undefined;
    const names = Object.getOwnPropertyNames(value);
    const allowed = new Set(Object.keys(RUNTIME_REACT_RENDER_LIMITS));
    if (names.some((name) => !allowed.has(name))) return undefined;
    const output: Record<string, number> = {};
    for (const [name, ceiling] of Object.entries(RUNTIME_REACT_RENDER_LIMITS)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, name);
      if (descriptor !== undefined && !("value" in descriptor)) return undefined;
      const limit = lowerLimit(descriptor?.value ?? ceiling, ceiling);
      if (limit === undefined) return undefined;
      output[name] = limit;
    }
    return Object.freeze(output) as unknown as RenderLimits;
  } catch {
    return undefined;
  }
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

function ownData(value: object, key: string): unknown | typeof INVALID {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor !== undefined && "value" in descriptor ? descriptor.value : INVALID;
  } catch {
    return INVALID;
  }
}

function exactKeys(
  value: object,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean {
  try {
    const names = Object.getOwnPropertyNames(value);
    const allowed = new Set([...required, ...optional]);
    return (
      Object.getOwnPropertySymbols(value).length === 0 &&
      required.every((name) => names.includes(name)) &&
      names.every((name) => allowed.has(name))
    );
  } catch {
    return false;
  }
}

function failure(
  code: RuntimeReactRenderFailureCode,
  identity?: Partial<RuntimeReactDiagnosticIdentity>,
): RuntimeReactRenderResult {
  const result = Object.freeze({
    status: "failed",
    failure: Object.freeze({
      code,
      runtimeNodeId: identity?.runtimeNodeId ?? null,
      sourceNodeId: identity?.sourceNodeId ?? null,
      capabilityId: identity?.capabilityId ?? null,
    }),
  } as const);
  RENDER_FAILURE_RESULTS.add(result);
  return result;
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
      if (ownKeys.length > limits.maxJsonOccurrences - state.jsonOccurrences) {
        return Object.freeze({ status: "failed", code: "JSON_OCCURRENCE_LIMIT_EXCEEDED" });
      }
      return Object.freeze({ status: "failed", code: "MALFORMED_RENDER_PLAN" });
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

function publicSlotPlans(
  slots: Readonly<Record<string, readonly PreparedNode[]>>,
): Readonly<Record<string, readonly RuntimeHeadlessNodePlan[]>> {
  const output: Record<string, readonly RuntimeHeadlessNodePlan[]> = Object.create(null);
  for (const name of Object.keys(slots).sort()) {
    output[name] = Object.freeze((slots[name] ?? []).map((child) => child.plan));
  }
  return Object.freeze(output);
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
    if (Object.getOwnPropertySymbols(raw).length !== 0) return failure("MALFORMED_RENDER_PLAN");
    names = Object.getOwnPropertyNames(raw);
    if (names.length > RUNTIME_REACT_RENDER_LIMITS.maxSlotEntries) {
      return failure("SLOT_LIMIT_EXCEEDED");
    }
    names.sort();
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
    !exactKeys(raw, ["identity", "id", "use", "props", "style", "slots"])
  ) {
    return failure("MALFORMED_RENDER_PLAN", owner);
  }
  const identity = ownData(raw, "identity");
  const id = ownData(raw, "id");
  const capabilityId = ownData(raw, "use");
  const props = ownData(raw, "props");
  const style = ownData(raw, "style");
  if (
    typeof identity !== "string" ||
    identity.length === 0 ||
    typeof id !== "string" ||
    id.length === 0 ||
    typeof capabilityId !== "string" ||
    capabilityId.length === 0
  ) {
    return failure("MALFORMED_RENDER_PLAN", owner);
  }
  const behaviorIdentity = {
    runtimeNodeId: identity,
    sourceNodeId: owner.sourceNodeId,
    capabilityId,
  };
  if (
    !retainString(identity, state, limits) ||
    !retainString(id, state, limits) ||
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
  const capturedProps = captureJsonObject(props, state, limits, behaviorIdentity);
  if (isRenderFailure(capturedProps)) return capturedProps;
  const capturedStyle = captureJsonObject(style, state, limits, behaviorIdentity);
  if (isRenderFailure(capturedStyle)) return capturedStyle;
  const slots = prepareSlotMap(ownData(raw, "slots"), depth, state, limits, components, behaviors);
  if (isRenderFailure(slots)) return slots;
  return Object.freeze({
    plan: Object.freeze({
      identity,
      id,
      use: capabilityId,
      props: capturedProps,
      style: capturedStyle,
      slots: publicSlotPlans(slots),
    }),
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
    !exactKeys(raw, ["identity", "sourceNodeId", "use", "props", "style", "slots", "behaviors"])
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
  if (component === undefined) return failure("UNKNOWN_COMPONENT_CAPABILITY", identity);
  const props = ownData(raw, "props");
  const style = ownData(raw, "style");
  const rawBehaviors = ownData(raw, "behaviors");
  const behaviorLength = arrayLength(rawBehaviors);
  if (behaviorLength !== undefined && behaviorLength > RUNTIME_REACT_RENDER_LIMITS.maxBehaviors) {
    return failure("BEHAVIOR_LIMIT_EXCEEDED", identity);
  }
  const behaviorValues = captureDenseArray(rawBehaviors, RUNTIME_REACT_RENDER_LIMITS.maxBehaviors);
  if (behaviorValues === undefined) {
    return failure("MALFORMED_RENDER_PLAN", identity);
  }
  const capturedProps = captureJsonObject(props, state, limits, identity);
  if (isRenderFailure(capturedProps)) return capturedProps;
  const capturedStyle = captureJsonObject(style, state, limits, identity);
  if (isRenderFailure(capturedStyle)) return capturedStyle;
  const slots = prepareSlotMap(
    ownData(raw, "slots"),
    depth + 1,
    state,
    limits,
    components,
    behaviors,
  );
  if (isRenderFailure(slots)) return slots;
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
    plan: Object.freeze({
      identity: identity.runtimeNodeId,
      sourceNodeId: identity.sourceNodeId,
      use: identity.capabilityId,
      props: capturedProps,
      style: capturedStyle,
      slots: publicSlotPlans(slots),
      behaviors: Object.freeze(preparedBehaviors.map((behavior) => behavior.plan)),
    }),
    component,
    slots,
    behaviors: Object.freeze(preparedBehaviors),
  });
}

function renderSlots(
  slots: Readonly<Record<string, readonly PreparedNode[]>>,
): RuntimeReactNamedSlots {
  const output: Record<string, readonly ReactNode[]> = Object.create(null);
  for (const name of Object.keys(slots).sort()) {
    output[name] = Object.freeze((slots[name] ?? []).map((child) => renderNode(child)));
  }
  return Object.freeze(output);
}

function renderNode(node: PreparedNode): ReactElement {
  const identity = Object.freeze({
    runtimeNodeId: node.plan.identity,
    sourceNodeId: node.plan.sourceNodeId,
    capabilityId: node.plan.use,
  });
  let rendered: ReactNode = createElement(node.component, {
    identity,
    props: node.plan.props,
    slots: renderSlots(node.slots),
    style: node.plan.style,
    behaviors: node.plan.behaviors,
    interactions: UNAVAILABLE_INTERACTIONS,
  });
  for (const behavior of [...node.behaviors].reverse()) {
    rendered = createElement(behavior.component, {
      identity: Object.freeze({
        runtimeNodeId: behavior.plan.identity,
        sourceNodeId: node.plan.sourceNodeId,
        capabilityId: behavior.plan.use,
      }),
      behaviorId: behavior.plan.id,
      props: behavior.plan.props,
      slots: renderSlots(behavior.slots),
      style: behavior.plan.style,
      interactions: UNAVAILABLE_INTERACTIONS,
      children: rendered,
    });
  }
  return createElement(Fragment, { key: node.plan.identity }, rendered);
}

/**
 * Preflights a complete public headless plan, then creates its React element tree.
 *
 * @remarks Every node and behavior resolves by exact id through the static trusted registry before
 * any adapter component runs. An unknown capability, duplicate identity, malformed own-data
 * boundary, or finite-limit failure produces one explicit result and no placeholder element.
 * Ordinary surface roots use the same registry lookup as every descendant.
 */
export function renderRuntimeReactSurface(
  input: RuntimeReactRenderInput,
): RuntimeReactRenderResult {
  if (!isPlainRecord(input) || !exactKeys(input, ["registry", "plan"], ["limits"])) {
    return failure("MALFORMED_RENDER_PLAN");
  }
  const registry = ownData(input, "registry");
  const plan = ownData(input, "plan");
  const limitsValue = ownData(input, "limits");
  if (registry === INVALID || plan === INVALID) return failure("MALFORMED_RENDER_PLAN");
  const authority = readRuntimeReactAdapterRegistryAuthority(
    registry as RuntimeReactAdapterRegistryHandle,
  );
  if (authority === undefined) return failure("INVALID_REGISTRY");
  const limits = captureLimits(
    limitsValue === INVALID
      ? undefined
      : (limitsValue as RuntimeReactRenderLimitProfile | undefined),
  );
  if (limits === undefined || !isPlainRecord(plan)) return failure("MALFORMED_RENDER_PLAN");
  if (!exactKeys(plan, ["documentId", "surfaceId", "root"])) {
    return failure("MALFORMED_RENDER_PLAN");
  }
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
    nodeCount: 0,
    behaviorCount: 0,
    slotEntries: 0,
    jsonOccurrences: 0,
    stringCodeUnits: 0,
  };
  if (!retainString(documentId, state, limits) || !retainString(surfaceId, state, limits)) {
    return failure("STRING_LIMIT_EXCEEDED");
  }
  const prepared: PreparedNode[] = [];
  for (const root of roots) {
    const result = prepareNode(root, 0, state, limits, authority.components, authority.behaviors);
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
