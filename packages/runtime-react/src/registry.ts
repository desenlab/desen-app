/* eslint-disable @typescript-eslint/no-invalid-void-type -- `this: void` is the deliberate
 * receiver-independent callback contract at the React adapter boundary. */
import type { ComponentType, ReactNode } from "react";
import type { RuntimeJsonObject, RuntimeJsonValue } from "@desen/runtime-core";
import type {
  DesenResolvedAdapterStyle,
  DesenResolvedAdapterStyleParts,
  DesenResolvedAdapterStyleProperties,
} from "@desen/validator";

const CAPABILITY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9.-]*\/[A-Za-z][A-Za-z0-9._:-]{0,127}$/u;
const REGISTRY_AUTHORITIES = new WeakMap<
  RuntimeReactAdapterRegistryHandle,
  RuntimeReactAdapterRegistryAuthority
>();
declare const RUNTIME_REACT_ADAPTER_REGISTRY_HANDLE_BRAND: unique symbol;
declare const RUNTIME_REACT_COMMAND_ATTACHMENT_HANDLE_BRAND: unique symbol;

/** Reference ceilings for one immutable React adapter registry. */
export const RUNTIME_REACT_ADAPTER_REGISTRY_LIMITS = Object.freeze({
  /** Maximum component adapter registrations. */
  maxComponentAdapters: 4_096,
  /** Maximum behavior adapter registrations. */
  maxBehaviorAdapters: 4_096,
  /** Maximum combined UTF-16 units retained in capability identifiers. */
  maxIdentifierCodeUnits: 1_048_576,
} as const);

/** Optional trusted profile that may only lower adapter-registry ceilings. */
export interface RuntimeReactAdapterRegistryLimitProfile {
  readonly maxComponentAdapters?: number;
  readonly maxBehaviorAdapters?: number;
  readonly maxIdentifierCodeUnits?: number;
}

/** Stable public identity carried to diagnostics without exposing React or platform instances. */
export interface RuntimeReactDiagnosticIdentity {
  /** Stable materialized runtime-node identity used for reconciliation. */
  readonly runtimeNodeId: string;
  /** Stable authoring node identity used for selectable diagnostics. */
  readonly sourceNodeId: string;
  /** Exact capability selected by the validated render plan. */
  readonly capabilityId: string;
}

/** Named React children produced only from public headless-plan slot entries. */
export type RuntimeReactNamedSlots = Readonly<Record<string, readonly ReactNode[]>>;

/** Complete resolved property map for one semantic style part. */
export type RuntimeReactStyleProperties = DesenResolvedAdapterStyleProperties;

/** Declared semantic style parts for one visual state. */
export type RuntimeReactStyleParts = DesenResolvedAdapterStyleParts;

/**
 * Resolved visual-state → style-part → property → JSON data delivered to an adapter.
 *
 * @remarks `base` is the default map; every other top-level key is a Catalog-declared visual
 * state. The adapter alone decides which declared state is active. The runtime does not merge
 * states, generate CSS, inspect platform structure, or interpret property names.
 */
export type RuntimeReactSemanticStyle = DesenResolvedAdapterStyle;

/** Controlled event result exposed to a trusted adapter without DOM/native-event authority. */
export type RuntimeReactEventDispatchResult =
  | Readonly<{ readonly status: "dispatched"; readonly completion: Promise<void> }>
  | Readonly<{ readonly status: "unavailable" | "rejected" }>;

/** Component command implementation registered by one live platform instance. */
export interface RuntimeReactComponentCommandPort {
  readonly invoke: (
    this: void,
    commandName: string,
    input: RuntimeJsonObject,
  ) => Readonly<{ readonly status: "succeeded" | "denied" }>;
}

/** Opaque owner-bound identity for one authenticated live command attachment. */
export interface RuntimeReactCommandAttachmentHandle {
  readonly [RUNTIME_REACT_COMMAND_ATTACHMENT_HANDLE_BRAND]: true;
}

/** Controlled result of attaching a live component command implementation. */
export type RuntimeReactCommandAttachmentResult =
  | Readonly<{
      readonly status: "attached";
      readonly attachment: RuntimeReactCommandAttachmentHandle;
    }>
  | Readonly<{ readonly status: "unavailable" | "rejected" }>;

/** Controlled result of detaching one exact command attachment. */
export type RuntimeReactCommandDetachmentResult = Readonly<{
  readonly status: "detached" | "already-detached" | "unavailable" | "rejected";
}>;

/**
 * Least-authority interaction seam supplied to each adapter instance.
 *
 * @remarks The base renderer returns explicit `unavailable` outcomes. M05-T04 replaces that inert
 * seam with exact current-session event dispatch and factory-authenticated command attachment.
 */
export interface RuntimeReactInteractionPort {
  readonly dispatchEvent: (
    this: void,
    eventName: string,
    payload: RuntimeJsonValue,
  ) => RuntimeReactEventDispatchResult;
  readonly attachCommands: (
    this: void,
    commands: RuntimeReactComponentCommandPort,
  ) => RuntimeReactCommandAttachmentResult;
  readonly detachCommands: (
    this: void,
    attachment: RuntimeReactCommandAttachmentHandle,
  ) => RuntimeReactCommandDetachmentResult;
}

/** Public props received by a trusted component adapter component. */
export interface RuntimeReactComponentAdapterProps {
  readonly identity: RuntimeReactDiagnosticIdentity;
  readonly props: RuntimeJsonObject;
  readonly slots: RuntimeReactNamedSlots;
  readonly style: RuntimeReactSemanticStyle;
  readonly interactions: RuntimeReactInteractionPort;
}

/** Public props received by a trusted behavior adapter component. */
export interface RuntimeReactBehaviorAdapterProps {
  readonly identity: RuntimeReactDiagnosticIdentity;
  readonly behaviorId: string;
  readonly props: RuntimeJsonObject;
  readonly slots: RuntimeReactNamedSlots;
  readonly style: RuntimeReactSemanticStyle;
  readonly interactions: RuntimeReactInteractionPort;
  readonly children: ReactNode;
}

/** Trusted React component implementation for one exact component capability. */
export type RuntimeReactComponentAdapterComponent =
  ComponentType<RuntimeReactComponentAdapterProps>;

/** Trusted React component implementation for one exact behavior capability. */
export type RuntimeReactBehaviorAdapterComponent = ComponentType<RuntimeReactBehaviorAdapterProps>;

/** Static trusted registration for one component capability. */
export interface RuntimeReactComponentAdapterRegistration {
  readonly capabilityId: string;
  readonly component: RuntimeReactComponentAdapterComponent;
}

/** Static trusted registration for one behavior capability. */
export interface RuntimeReactBehaviorAdapterRegistration {
  readonly capabilityId: string;
  readonly component: RuntimeReactBehaviorAdapterComponent;
}

/** Complete trusted input used to create one finite adapter registry. */
export interface RuntimeReactAdapterRegistryCreateInput {
  readonly components: readonly RuntimeReactComponentAdapterRegistration[];
  readonly behaviors?: readonly RuntimeReactBehaviorAdapterRegistration[];
  readonly limits?: RuntimeReactAdapterRegistryLimitProfile;
}

/** Opaque authority for one factory-created adapter registry. */
export interface RuntimeReactAdapterRegistryHandle {
  readonly [RUNTIME_REACT_ADAPTER_REGISTRY_HANDLE_BRAND]: true;
}

/** Callback-free immutable registry observation. */
export interface RuntimeReactAdapterRegistrySnapshot {
  readonly componentCapabilityIds: readonly string[];
  readonly behaviorCapabilityIds: readonly string[];
}

/** Stable reason why no registry authority was created. */
export type RuntimeReactAdapterRegistryInvalidReason =
  | "duplicate-capability"
  | "identifier-limit"
  | "invalid-limits"
  | "malformed-registration"
  | "registry-limit";

/** Controlled result of creating one registry. */
export type RuntimeReactAdapterRegistryCreateResult =
  | Readonly<{
      readonly status: "created";
      readonly handle: RuntimeReactAdapterRegistryHandle;
      readonly snapshot: RuntimeReactAdapterRegistrySnapshot;
    }>
  | Readonly<{
      readonly status: "invalid";
      readonly reason: RuntimeReactAdapterRegistryInvalidReason;
    }>;

/** Controlled read result that never exposes registered executable callbacks. */
export type RuntimeReactAdapterRegistryReadResult =
  | Readonly<{
      readonly status: "read";
      readonly snapshot: RuntimeReactAdapterRegistrySnapshot;
    }>
  | Readonly<{ readonly status: "invalid-handle" }>;

/** Exact executable registry authority retained behind the opaque handle. */
export interface RuntimeReactAdapterRegistryAuthority {
  readonly components: ReadonlyMap<string, RuntimeReactComponentAdapterComponent>;
  readonly behaviors: ReadonlyMap<string, RuntimeReactBehaviorAdapterComponent>;
  readonly snapshot: RuntimeReactAdapterRegistrySnapshot;
}

interface CapturedLimits {
  readonly maxComponentAdapters: number;
  readonly maxBehaviorAdapters: number;
  readonly maxIdentifierCodeUnits: number;
}

interface OwnDataValue {
  readonly valid: boolean;
  readonly present: boolean;
  readonly value?: unknown;
}

function ownDataValue(value: object, key: PropertyKey): OwnDataValue {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined) return { valid: true, present: false };
    if (!("value" in descriptor)) return { valid: false, present: true };
    return { valid: true, present: true, value: descriptor.value };
  } catch {
    return { valid: false, present: false };
  }
}

function exactKeys(
  value: object,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean {
  try {
    if (Object.getOwnPropertySymbols(value).length !== 0) return false;
    const names = Object.getOwnPropertyNames(value);
    const allowed = new Set([...required, ...optional]);
    return (
      required.every((name) => names.includes(name)) && names.every((name) => allowed.has(name))
    );
  } catch {
    return false;
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

function lowerLimit(value: unknown, ceiling: number): number | undefined {
  return Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= ceiling
    ? (value as number)
    : undefined;
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
      if (descriptor === undefined || !("value" in descriptor)) return undefined;
      output.push(descriptor.value);
    }
    return Object.freeze(output);
  } catch {
    return undefined;
  }
}

function captureLimits(value: unknown): CapturedLimits | undefined {
  if (value === undefined) return RUNTIME_REACT_ADAPTER_REGISTRY_LIMITS;
  if (
    !isPlainRecord(value) ||
    !exactKeys(value, [], Object.keys(RUNTIME_REACT_ADAPTER_REGISTRY_LIMITS))
  ) {
    return undefined;
  }
  const captured: Record<string, number> = {};
  for (const [name, ceiling] of Object.entries(RUNTIME_REACT_ADAPTER_REGISTRY_LIMITS)) {
    const member = ownDataValue(value, name);
    if (!member.valid) return undefined;
    const limit = member.present ? lowerLimit(member.value, ceiling) : ceiling;
    if (limit === undefined) return undefined;
    captured[name] = limit;
  }
  return Object.freeze(captured) as unknown as CapturedLimits;
}

function captureRegistrations<Component>(
  value: unknown,
  maximum: number,
  identifiers: Set<string>,
  identifierBudget: { used: number; readonly maximum: number },
): ReadonlyMap<string, Component> | RuntimeReactAdapterRegistryInvalidReason {
  try {
    if (!Array.isArray(value)) return "malformed-registration";
    const length = Object.getOwnPropertyDescriptor(value, "length");
    if (length !== undefined && "value" in length && length.value > maximum) {
      return "registry-limit";
    }
  } catch {
    return "malformed-registration";
  }
  const candidates = captureDenseArray(value, maximum);
  if (candidates === undefined) return "malformed-registration";
  const registrations = new Map<string, Component>();
  for (const candidate of candidates) {
    if (!isPlainRecord(candidate) || !exactKeys(candidate, ["capabilityId", "component"])) {
      return "malformed-registration";
    }
    const capabilityId = ownDataValue(candidate, "capabilityId");
    const component = ownDataValue(candidate, "component");
    if (
      !capabilityId.valid ||
      !capabilityId.present ||
      typeof capabilityId.value !== "string" ||
      capabilityId.value.length > identifierBudget.maximum - identifierBudget.used
    ) {
      return "identifier-limit";
    }
    if (
      !CAPABILITY_ID_PATTERN.test(capabilityId.value) ||
      !component.valid ||
      !component.present ||
      typeof component.value !== "function"
    ) {
      return "malformed-registration";
    }
    if (identifiers.has(capabilityId.value)) return "duplicate-capability";
    identifiers.add(capabilityId.value);
    identifierBudget.used += capabilityId.value.length;
    registrations.set(capabilityId.value, component.value as Component);
  }
  return registrations;
}

function invalid(
  reason: RuntimeReactAdapterRegistryInvalidReason,
): RuntimeReactAdapterRegistryCreateResult {
  return Object.freeze({ status: "invalid", reason });
}

/**
 * Captures a finite static set of trusted React adapters behind an opaque registry authority.
 *
 * @remarks A Bundle can select only an exact capability id already present in this registry. It
 * cannot provide a module name, import specifier, component value, fallback, or executable loader.
 * Registration callbacks never enter the public snapshot and are never invoked by this factory.
 */
export function createRuntimeReactAdapterRegistry(
  input: RuntimeReactAdapterRegistryCreateInput,
): RuntimeReactAdapterRegistryCreateResult {
  if (!isPlainRecord(input) || !exactKeys(input, ["components"], ["behaviors", "limits"])) {
    return invalid("malformed-registration");
  }
  const componentsValue = ownDataValue(input, "components");
  const behaviorsValue = ownDataValue(input, "behaviors");
  const limitsValue = ownDataValue(input, "limits");
  if (
    !componentsValue.valid ||
    !componentsValue.present ||
    !behaviorsValue.valid ||
    !limitsValue.valid
  ) {
    return invalid("malformed-registration");
  }
  const limits = captureLimits(limitsValue.present ? limitsValue.value : undefined);
  if (limits === undefined) return invalid("invalid-limits");
  const identifiers = new Set<string>();
  const identifierBudget = { used: 0, maximum: limits.maxIdentifierCodeUnits };
  const components = captureRegistrations<RuntimeReactComponentAdapterComponent>(
    componentsValue.value,
    limits.maxComponentAdapters,
    identifiers,
    identifierBudget,
  );
  if (typeof components === "string") return invalid(components);
  const behaviors = captureRegistrations<RuntimeReactBehaviorAdapterComponent>(
    behaviorsValue.present ? behaviorsValue.value : [],
    limits.maxBehaviorAdapters,
    identifiers,
    identifierBudget,
  );
  if (typeof behaviors === "string") return invalid(behaviors);

  const snapshot = Object.freeze({
    componentCapabilityIds: Object.freeze([...components.keys()].sort()),
    behaviorCapabilityIds: Object.freeze([...behaviors.keys()].sort()),
  });
  const handle = Object.freeze({}) as RuntimeReactAdapterRegistryHandle;
  REGISTRY_AUTHORITIES.set(handle, Object.freeze({ components, behaviors, snapshot }));
  return Object.freeze({ status: "created", handle, snapshot });
}

/** Reads one callback-free immutable registry snapshot from a factory-authenticated handle. */
export function readRuntimeReactAdapterRegistry(
  handle: RuntimeReactAdapterRegistryHandle,
): RuntimeReactAdapterRegistryReadResult {
  if (typeof handle !== "object" || handle === null) {
    return Object.freeze({ status: "invalid-handle" });
  }
  const authority = REGISTRY_AUTHORITIES.get(handle);
  return authority === undefined
    ? Object.freeze({ status: "invalid-handle" })
    : Object.freeze({ status: "read", snapshot: authority.snapshot });
}

/** @internal Exact executable lookup used only by the renderer. */
export function readRuntimeReactAdapterRegistryAuthority(
  handle: RuntimeReactAdapterRegistryHandle,
): RuntimeReactAdapterRegistryAuthority | undefined {
  return typeof handle === "object" && handle !== null
    ? REGISTRY_AUTHORITIES.get(handle)
    : undefined;
}
