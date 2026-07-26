/* eslint-disable @typescript-eslint/no-invalid-void-type -- TypeScript's `this: void` is the
 * deliberate receiver-independent callback contract at this trusted adapter boundary. */
import { canonicalizeJson, createCoreDiagnostic, createJsonPointer } from "@desen/protocol";
import { validateDesenEventPayload } from "@desen/validator";

import {
  readRuntimeCommandEventActionsForAdapterBridge,
  registerRuntimeComponentCommandTarget,
  unregisterRuntimeComponentCommandTarget,
} from "./command-event-actions.js";
import {
  consumeRuntimeComponentCommandHostRequestForAdapterBridge,
  isRuntimeCommandEventHostPortsForComponentCommandPort,
} from "./command-event-ports.js";
import { reconcileRuntimeNodeIdentity } from "./node-identity.js";
import {
  createRuntimeResolutionSnapshotForRepeatScope,
  reconcileRuntimeRepeatedNodeIdentity,
} from "./repeat-materialization.js";
import { isRuntimeJsonObject, snapshotRuntimeJsonValue } from "./runtime-json-snapshot.js";
import { RUNTIME_VALUE_SAFETY_LIMITS } from "./value-resolution.js";

import type {
  DesenResolvedJsonValue,
  DesenSemanticDiagnostic,
  DesenValidatedExecutionCatalogSet,
} from "@desen/validator";
import type {
  RuntimeCommandEventActionsHandle,
  RuntimeCommandEventActionsSnapshot,
  RuntimeComponentCommandRegistrationTicket,
} from "./command-event-actions.js";
import type {
  RuntimeCommandEventHostPorts,
  RuntimeComponentCommandHostPort,
  RuntimeComponentCommandHostRequest,
  RuntimeComponentCommandHostResult,
} from "./command-event-ports.js";
import type { RuntimeJsonObject } from "./host-ports.js";
import type { RuntimeNodeIdentity } from "./node-identity.js";
import type {
  RuntimeRepeatKey,
  RuntimeRepeatScope,
  RuntimeRepeatedNodeIdentity,
} from "./repeat-materialization.js";

const LOCAL_IDENTIFIER_PATTERN = /^[A-Za-z][A-Za-z0-9._:-]{0,127}$/u;
const SHA256_DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;
declare const RUNTIME_ADAPTER_BRIDGES_HANDLE_TYPE_BRAND: unique symbol;
declare const RUNTIME_ADAPTER_BINDING_TICKET_TYPE_BRAND: unique symbol;

/** Finite default ceilings for one generic adapter-bridge lifetime. */
export const RUNTIME_ADAPTER_BRIDGE_LIMITS = Object.freeze({
  /** Maximum component and behavior bindings retained together. */
  maxLiveBindings: 5_000,
  /** Maximum source event-handler names retained across all live bindings. */
  maxEventHandlerBindings: 5_000,
  /** Largest zero-based accepted binding generation. */
  maxRegistrationGeneration: Number.MAX_SAFE_INTEGER,
  /** Largest published registry snapshot generation. */
  maxSnapshotGeneration: Number.MAX_SAFE_INTEGER,
  /** Largest zero-based event receipt generation. */
  maxEventGeneration: Number.MAX_SAFE_INTEGER,
  /** Aggregate retained identifier and handler-name UTF-16 code units. */
  maxRetainedIdentifierCodeUnits: RUNTIME_VALUE_SAFETY_LIMITS.maxStringCodeUnits,
  /** Aggregate detached item/repeat-key JSON occurrences retained by live components. */
  maxRetainedScopeJsonOccurrences: RUNTIME_VALUE_SAFETY_LIMITS.maxJsonNodes,
  /** Aggregate canonical UTF-16 code units retained by live component scope projections. */
  maxRetainedScopeCodeUnits: RUNTIME_VALUE_SAFETY_LIMITS.maxStringCodeUnits,
  /** Maximum internally derived runtime-instance identifier length. */
  maxRuntimeInstanceIdCodeUnits: 1_024,
} as const);

/** Optional trusted profile that may only lower adapter-bridge ceilings. */
export interface RuntimeAdapterBridgeLimitProfile {
  readonly maxLiveBindings?: number;
  readonly maxEventHandlerBindings?: number;
  readonly maxRegistrationGeneration?: number;
  readonly maxSnapshotGeneration?: number;
  readonly maxEventGeneration?: number;
  readonly maxRetainedIdentifierCodeUnits?: number;
  readonly maxRetainedScopeJsonOccurrences?: number;
  readonly maxRetainedScopeCodeUnits?: number;
  readonly maxRuntimeInstanceIdCodeUnits?: number;
}

/** Closed outcome accepted from one generic component adapter command callback. */
export type RuntimeAdapterComponentCommandResult =
  Readonly<{ readonly status: "succeeded" }> | Readonly<{ readonly status: "denied" }>;

/** Least-authority command request delivered to one exact live component binding. */
export interface RuntimeAdapterComponentCommandRequest {
  readonly command: string;
  readonly input: RuntimeJsonObject;
}

/** Trusted component adapter callback; it never enters DESEN document data. */
export interface RuntimeAdapterComponentCommandPort {
  readonly invoke: (
    this: void,
    request: RuntimeAdapterComponentCommandRequest,
  ) => RuntimeAdapterComponentCommandResult;
}

/** Inert selector used by the later session coordinator to find one source event handler. */
export type RuntimeAdapterEventHandlerSelector =
  | Readonly<{
      readonly kind: "component";
      readonly sourceNodeId: string;
      readonly eventName: string;
    }>
  | Readonly<{
      readonly kind: "behavior";
      readonly sourceNodeId: string;
      readonly behaviorId: string;
      readonly eventName: string;
    }>;

/** Validated immediate-event request passed to the generic turn-admission integration. */
export interface RuntimeAdapterEventTurnRequest {
  readonly eventId: string;
  readonly documentId: string;
  readonly revision: string;
  readonly surfaceId: string;
  readonly capabilityKind: "component" | "behavior";
  readonly capabilityId: string;
  readonly runtimeInstanceId: string;
  readonly handler: RuntimeAdapterEventHandlerSelector;
  readonly payload: DesenResolvedJsonValue;
  readonly item: RuntimeJsonObject;
  readonly repeatKeys: readonly RuntimeRepeatKey[];
}

/** Closed synchronous admission decision returned by the later event-turn coordinator. */
export type RuntimeAdapterEventTurnResult =
  Readonly<{ readonly status: "accepted" }> | Readonly<{ readonly status: "rejected" }>;

/**
 * Generic event-turn admission port.
 *
 * @remarks M04-T14 validates and identifies an incoming event before invoking this port. M04-T16
 * supplies the implementation that joins the inert handler selector to a prepared action program
 * and current seven-namespace snapshot. This interface deliberately imports no action-turn type.
 */
export interface RuntimeAdapterEventTurnPort {
  readonly dispatch: (
    this: void,
    request: RuntimeAdapterEventTurnRequest,
  ) => RuntimeAdapterEventTurnResult;
}

/** Caller-owned callbacks and optional lower-only profile captured by the bridge factory. */
export interface RuntimeAdapterBridgePortsInput {
  readonly eventTurns: RuntimeAdapterEventTurnPort;
  readonly limits?: RuntimeAdapterBridgeLimitProfile;
}

/** Opaque authority created before T12 and bound exactly once after T12 mounts. */
export interface RuntimeAdapterBridgesHandle {
  readonly [RUNTIME_ADAPTER_BRIDGES_HANDLE_TYPE_BRAND]: true;
}

/** Pair created before T12 so its generic command port can enter the existing T12 port factory. */
export interface RuntimeAdapterBridgePorts {
  readonly handle: RuntimeAdapterBridgesHandle;
  readonly componentCommands: RuntimeComponentCommandHostPort;
}

/** Exact second-phase input binding this bridge to one mounted T12 Catalog and registry. */
export interface RuntimeAdapterBridgesBindInput {
  readonly documentId: string;
  readonly revision: string;
  readonly surfaceId: string;
  readonly catalogSet: DesenValidatedExecutionCatalogSet;
  readonly commandEventActionsHandle: RuntimeCommandEventActionsHandle;
  readonly commandEventSnapshot: RuntimeCommandEventActionsSnapshot;
}

/** Public immutable summary of one live component or behavior binding. */
export type RuntimeAdapterBindingSnapshot =
  | Readonly<{
      readonly kind: "component";
      readonly sourceNodeId: string;
      readonly capabilityId: string;
      readonly runtimeInstanceId: string;
      readonly registrationGeneration: number;
      readonly handledEvents: readonly string[];
    }>
  | Readonly<{
      readonly kind: "behavior";
      readonly sourceNodeId: string;
      readonly behaviorId: string;
      readonly capabilityId: string;
      readonly runtimeInstanceId: string;
      readonly ownerRuntimeInstanceId: string;
      readonly registrationGeneration: number;
      readonly handledEvents: readonly string[];
    }>;

/** Exact callback-free public registry state issued by the adapter bridge. */
export interface RuntimeAdapterBridgesSnapshot {
  readonly documentId: string;
  readonly revision: string;
  readonly surfaceId: string;
  readonly generation: number;
  readonly bindings: readonly RuntimeAdapterBindingSnapshot[];
}

/** Complete result of binding the created bridge to one exact T12 lifetime. */
export type RuntimeAdapterBridgesBindResult =
  | Readonly<{
      readonly status: "bound";
      readonly snapshot: RuntimeAdapterBridgesSnapshot;
    }>
  | Readonly<{
      readonly status: "invalid";
      readonly reason:
        | "already-bound"
        | "catalog-mismatch"
        | "command-authority-invalid"
        | "identity-mismatch"
        | "malformed-input"
        | "retained-limit";
    }>
  | Readonly<{ readonly status: "disposed" }>
  | Readonly<{ readonly status: "busy" }>
  | Readonly<{ readonly status: "invalid-handle" }>;

/** Factory-authenticated node identity accepted by a component adapter binding. */
export type RuntimeAdapterNodeIdentity = RuntimeNodeIdentity | RuntimeRepeatedNodeIdentity;

/** Opaque exact-generation authority for one component or behavior adapter binding. */
export interface RuntimeAdapterBindingTicket {
  readonly [RUNTIME_ADAPTER_BINDING_TICKET_TYPE_BRAND]: true;
}

/** Registration input for one live component adapter instance. */
export interface RuntimeComponentAdapterBindingInput {
  readonly kind: "component";
  readonly identity: RuntimeAdapterNodeIdentity;
  readonly scope: RuntimeRepeatScope;
  readonly handledEvents: readonly string[];
  readonly commands?: RuntimeAdapterComponentCommandPort;
  readonly snapshot: RuntimeAdapterBridgesSnapshot;
}

/**
 * Registration input for one behavior attached to an exact live component generation.
 *
 * @remarks A behavior receives no command port because DESEN 0.1.0 defines no behavior-command
 * action. Its owner ticket prevents a behavior lifetime from floating after its component leaves.
 */
export interface RuntimeBehaviorAdapterBindingInput {
  readonly kind: "behavior";
  readonly owner: RuntimeAdapterBindingTicket;
  readonly behaviorId: string;
  readonly capabilityId: string;
  readonly handledEvents: readonly string[];
  readonly snapshot: RuntimeAdapterBridgesSnapshot;
}

/** One live adapter registration request. */
export type RuntimeAdapterBindingInput =
  RuntimeComponentAdapterBindingInput | RuntimeBehaviorAdapterBindingInput;

/** Complete synchronous result of registering one live adapter binding. */
export type RuntimeAdapterBindingRegistrationResult =
  | Readonly<{
      readonly status: "registered";
      readonly ticket: RuntimeAdapterBindingTicket;
      readonly binding: RuntimeAdapterBindingSnapshot;
      readonly snapshot: RuntimeAdapterBridgesSnapshot;
    }>
  | Readonly<{
      readonly status: "invalid";
      readonly reason:
        | "command-registration-failed"
        | "duplicate-binding"
        | "event-handler-limit"
        | "generation-limit"
        | "identity-mismatch"
        | "incompatible-owner"
        | "invalid-command-authority"
        | "invalid-owner"
        | "malformed-input"
        | "registry-limit"
        | "retained-limit"
        | "snapshot-limit"
        | "unknown-capability";
    }>
  | Readonly<{
      readonly status: "invalid-snapshot";
      readonly snapshot: RuntimeAdapterBridgesSnapshot;
    }>
  | Readonly<{ readonly status: "unbound" | "busy" | "disposed" }>
  | Readonly<{ readonly status: "invalid-handle" }>;

/** Exact current-generation request to unregister one component or behavior binding. */
export interface RuntimeAdapterBindingUnregistrationInput {
  readonly ticket: RuntimeAdapterBindingTicket;
  readonly snapshot: RuntimeAdapterBridgesSnapshot;
}

/** Complete result of unregistering a binding and any behavior children it owns. */
export type RuntimeAdapterBindingUnregistrationResult =
  | Readonly<{
      readonly status: "unregistered";
      readonly kind: "component" | "behavior";
      readonly runtimeInstanceId: string;
      readonly cascadedBehaviors: number;
      readonly snapshot: RuntimeAdapterBridgesSnapshot;
    }>
  | Readonly<{ readonly status: "invalid-ticket" | "stale-ticket" }>
  | Readonly<{
      readonly status: "invalid-snapshot";
      readonly snapshot: RuntimeAdapterBridgesSnapshot;
    }>
  | Readonly<{
      readonly status: "invalid";
      readonly reason: "invalid-command-authority" | "malformed-input" | "snapshot-limit";
    }>
  | Readonly<{ readonly status: "unbound" | "busy" | "disposed" }>
  | Readonly<{ readonly status: "invalid-handle" }>;

/** One incoming payload emitted by an exact current adapter registration. */
export interface RuntimeAdapterEventInput {
  readonly ticket: RuntimeAdapterBindingTicket;
  readonly eventName: string;
  readonly payload: unknown;
  readonly snapshot: RuntimeAdapterBridgesSnapshot;
}

/** Complete synchronous incoming-event outcome. */
export type RuntimeAdapterEventResult =
  | Readonly<{
      readonly status: "dispatched";
      readonly eventId: string;
    }>
  | Readonly<{
      readonly status: "turn-rejected" | "bridge-failed";
      readonly eventId: string;
    }>
  | Readonly<{
      readonly status: "validated-unhandled";
      readonly payload: RuntimeAdapterEventTurnRequest["payload"];
    }>
  | Readonly<{
      readonly status: "unknown-event" | "payload-invalid";
      readonly diagnostics: readonly DesenSemanticDiagnostic[];
    }>
  | Readonly<{ readonly status: "event-limit" | "stale-ticket" }>
  | Readonly<{
      readonly status: "invalid-snapshot";
      readonly snapshot: RuntimeAdapterBridgesSnapshot;
    }>
  | Readonly<{
      readonly status: "invalid-command-authority" | "malformed-input" | "unbound" | "disposed";
    }>
  | Readonly<{ readonly status: "invalid-handle" }>;

/** Callback-free current-state read for one created bridge. */
export type RuntimeAdapterBridgesReadResult =
  | Readonly<{ readonly status: "unbound" }>
  | Readonly<{ readonly status: "read"; readonly snapshot: RuntimeAdapterBridgesSnapshot }>
  | Readonly<{ readonly status: "disposed" }>
  | Readonly<{ readonly status: "invalid-handle" }>;

/** Terminal idempotent disposal result. */
export type RuntimeAdapterBridgesDisposeResult =
  | Readonly<{
      readonly status: "disposed";
      readonly disposedComponents: number;
      readonly disposedBehaviors: number;
    }>
  | Readonly<{
      readonly status: "already-disposed" | "busy" | "invalid-command-authority" | "invalid-handle";
      readonly disposedComponents: 0;
      readonly disposedBehaviors: 0;
    }>;

type Limits = Required<RuntimeAdapterBridgeLimitProfile>;

interface ComponentBinding {
  readonly kind: "component";
  readonly sourceNodeId: string;
  readonly capabilityId: string;
  readonly runtimeInstanceId: string;
  readonly registrationGeneration: number;
  readonly handledEvents: readonly string[];
  readonly item: RuntimeJsonObject;
  readonly repeatKeys: readonly RuntimeRepeatKey[];
  readonly commands: RuntimeAdapterComponentCommandPort["invoke"] | undefined;
  readonly bridgeTicket: RuntimeAdapterBindingTicket;
  readonly commandTicket: RuntimeComponentCommandRegistrationTicket;
  readonly retainedCodeUnits: number;
  readonly retainedScopeJsonOccurrences: number;
  readonly retainedScopeCodeUnits: number;
}

interface BehaviorBinding {
  readonly kind: "behavior";
  readonly sourceNodeId: string;
  readonly behaviorId: string;
  readonly capabilityId: string;
  readonly runtimeInstanceId: string;
  readonly ownerRuntimeInstanceId: string;
  readonly registrationGeneration: number;
  readonly handledEvents: readonly string[];
  readonly item: RuntimeJsonObject;
  readonly repeatKeys: readonly RuntimeRepeatKey[];
  readonly bridgeTicket: RuntimeAdapterBindingTicket;
  readonly retainedCodeUnits: number;
}

type Binding = ComponentBinding | BehaviorBinding;

interface BoundState {
  readonly documentId: string;
  readonly revision: string;
  readonly surfaceId: string;
  readonly catalogSet: DesenValidatedExecutionCatalogSet;
  readonly componentCapabilities: ReadonlySet<string>;
  readonly componentCategories: ReadonlyMap<string, string>;
  readonly behaviorCapabilities: ReadonlySet<string>;
  readonly behaviorAttachments: ReadonlyMap<string, BehaviorAttachment>;
  readonly declaredEvents: ReadonlySet<string>;
  readonly commandHandle: RuntimeCommandEventActionsHandle;
  readonly commandEventPorts: RuntimeCommandEventHostPorts;
  commandSnapshot: RuntimeCommandEventActionsSnapshot;
  snapshot: RuntimeAdapterBridgesSnapshot;
}

interface BridgeAuthority {
  status: "created" | "bound" | "revoked";
  readonly ownerKey: object;
  readonly dispatchEventTurn: RuntimeAdapterEventTurnPort["dispatch"];
  componentCommands: RuntimeComponentCommandHostPort | undefined;
  readonly limits: Limits;
  readonly bindings: Map<string, Binding>;
  readonly components: Map<string, ComponentBinding>;
  readonly behaviorsByOwner: Map<string, Set<string>>;
  bound: BoundState | undefined;
  nextRegistrationGeneration: number;
  nextEventGeneration: number;
  liveHandlerBindings: number;
  retainedCodeUnits: number;
  retainedScopeJsonOccurrences: number;
  retainedScopeCodeUnits: number;
  transitioning: boolean;
  commandActive: boolean;
  eventActivityDepth: number;
  eventDispatchDepth: number;
}

interface DisposedBridgeAuthority {
  readonly status: "disposed";
  readonly ownerKey: object;
}

type StoredBridgeAuthority = BridgeAuthority | DisposedBridgeAuthority;

interface LiveTicketAuthority {
  readonly ownerKey: object;
  readonly runtimeInstanceId: string;
  readonly registrationGeneration: number;
}

interface DeadTicketAuthority {
  readonly ownerKey: object;
  readonly status: "unregistered" | "disposed";
}

interface BehaviorAttachment {
  readonly capabilities: ReadonlySet<string>;
  readonly categories: ReadonlySet<string>;
}

interface RetainedScopeProjection {
  readonly item: RuntimeJsonObject;
  readonly repeatKeys: readonly RuntimeRepeatKey[];
  readonly jsonOccurrences: number;
  readonly codeUnits: number;
}

const BRIDGE_AUTHORITIES = new WeakMap<object, StoredBridgeAuthority>();
const BINDING_TICKETS = new WeakMap<object, LiveTicketAuthority | DeadTicketAuthority>();

function isCurrentBridgeAuthority(
  handle: RuntimeAdapterBridgesHandle,
  authority: BridgeAuthority,
): boolean {
  return authority.status !== "revoked" && BRIDGE_AUTHORITIES.get(handle) === authority;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function catalogEventKey(
  capabilityKind: "component" | "behavior",
  capabilityId: string,
  eventName: string,
): string {
  return canonicalizeJson([capabilityKind, capabilityId, eventName]);
}

function captureCatalogStringSet(input: unknown): ReadonlySet<string> | undefined {
  if (!Array.isArray(input)) return undefined;
  const values = new Set<string>();
  try {
    for (const value of input) {
      if (typeof value !== "string") return undefined;
      values.add(value);
    }
  } catch {
    return undefined;
  }
  return values;
}

function catalogInventory(catalogSet: DesenValidatedExecutionCatalogSet):
  | Readonly<{
      componentCapabilities: ReadonlySet<string>;
      componentCategories: ReadonlyMap<string, string>;
      behaviorCapabilities: ReadonlySet<string>;
      behaviorAttachments: ReadonlyMap<string, BehaviorAttachment>;
      declaredEvents: ReadonlySet<string>;
    }>
  | undefined {
  const componentCapabilities = new Set<string>();
  const componentCategories = new Map<string, string>();
  const behaviorCapabilities = new Set<string>();
  const behaviorAttachments = new Map<string, BehaviorAttachment>();
  const declaredEvents = new Set<string>();
  try {
    for (const catalog of catalogSet) {
      for (const [kind, member] of [
        ["component", "components"],
        ["behavior", "behaviors"],
      ] as const) {
        const capabilities = ownDataValue(catalog, member);
        if (!capabilities.valid || !capabilities.present || !isPlainRecord(capabilities.value)) {
          return undefined;
        }
        for (const capabilityId of Object.keys(capabilities.value).sort(compareText)) {
          const capability = ownDataValue(capabilities.value, capabilityId);
          if (!capability.valid || !capability.present || !isPlainRecord(capability.value)) {
            return undefined;
          }
          (kind === "component" ? componentCapabilities : behaviorCapabilities).add(capabilityId);
          if (kind === "component") {
            const category = ownDataValue(capability.value, "category");
            if (!category.valid) return undefined;
            if (category.present) {
              if (typeof category.value !== "string") return undefined;
              componentCategories.set(capabilityId, category.value);
            }
          } else {
            const attachTo = ownDataValue(capability.value, "attachTo");
            if (!attachTo.valid || !attachTo.present || !isPlainRecord(attachTo.value)) {
              return undefined;
            }
            const capabilities = ownDataValue(attachTo.value, "capabilities");
            const categories = ownDataValue(attachTo.value, "categories");
            if (!capabilities.valid || !categories.valid) return undefined;
            const allowedCapabilities = capabilities.present
              ? captureCatalogStringSet(capabilities.value)
              : new Set<string>();
            const allowedCategories = categories.present
              ? captureCatalogStringSet(categories.value)
              : new Set<string>();
            if (allowedCapabilities === undefined || allowedCategories === undefined) {
              return undefined;
            }
            behaviorAttachments.set(
              capabilityId,
              Object.freeze({
                capabilities: allowedCapabilities,
                categories: allowedCategories,
              }),
            );
          }
          const events = ownDataValue(capability.value, "events");
          if (!events.valid) return undefined;
          if (!events.present) continue;
          if (!isPlainRecord(events.value)) return undefined;
          for (const eventName of Object.keys(events.value).sort(compareText)) {
            declaredEvents.add(catalogEventKey(kind, capabilityId, eventName));
          }
        }
      }
    }
  } catch {
    return undefined;
  }
  return Object.freeze({
    componentCapabilities,
    componentCategories,
    behaviorCapabilities,
    behaviorAttachments,
    declaredEvents,
  });
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
): Readonly<{ valid: boolean; present: boolean; value?: unknown }> {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(object, key);
    if (descriptor === undefined) return { valid: true, present: false };
    return "value" in descriptor && descriptor.enumerable
      ? { valid: true, present: true, value: descriptor.value }
      : { valid: false, present: true };
  } catch {
    return { valid: false, present: false };
  }
}

function exactKeys(
  object: object,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean {
  const allowed = new Set([...required, ...optional]);
  try {
    const keys = Reflect.ownKeys(object);
    return (
      keys.every((key) => typeof key === "string" && allowed.has(key)) &&
      required.every((key) => keys.includes(key)) &&
      keys.length >= required.length &&
      keys.length <= required.length + optional.length
    );
  } catch {
    return false;
  }
}

function isJsonString(value: unknown): value is string {
  return typeof value === "string" && snapshotRuntimeJsonValue(value) === value;
}

function isCapabilityId(value: string): boolean {
  const slash = value.indexOf("/");
  if (slash <= 0 || slash !== value.lastIndexOf("/") || slash === value.length - 1) return false;
  const namespace = value.slice(0, slash);
  const name = value.slice(slash + 1);
  const asciiLetter = (character: string): boolean => {
    const code = character.charCodeAt(0);
    return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
  };
  const asciiDigit = (character: string): boolean => {
    const code = character.charCodeAt(0);
    return code >= 48 && code <= 57;
  };
  const asciiAlphanumeric = (character: string): boolean =>
    asciiLetter(character) || asciiDigit(character);
  if (!asciiAlphanumeric(namespace[0] as string)) return false;
  for (let index = 1; index < namespace.length; index += 1) {
    const character = namespace[index] as string;
    if (!asciiAlphanumeric(character) && character !== "." && character !== "-") return false;
  }
  if (name.length === 0 || name.length > 128 || !asciiLetter(name[0] as string)) return false;
  for (let index = 1; index < name.length; index += 1) {
    const character = name[index] as string;
    if (
      !asciiAlphanumeric(character) &&
      character !== "." &&
      character !== "_" &&
      character !== ":" &&
      character !== "-"
    ) {
      return false;
    }
  }
  return true;
}

function captureLimits(input: unknown): Limits | undefined {
  if (input === undefined) return RUNTIME_ADAPTER_BRIDGE_LIMITS;
  if (!isPlainRecord(input)) return undefined;
  const keys = Object.keys(RUNTIME_ADAPTER_BRIDGE_LIMITS) as (keyof Limits)[];
  if (!exactKeys(input, [], keys)) return undefined;
  const captured = {} as Record<keyof Limits, number>;
  for (const key of keys) {
    const member = ownDataValue(input, key);
    if (!member.valid) return undefined;
    const value = member.present ? member.value : RUNTIME_ADAPTER_BRIDGE_LIMITS[key];
    if (
      typeof value !== "number" ||
      !Number.isSafeInteger(value) ||
      value < 0 ||
      value > RUNTIME_ADAPTER_BRIDGE_LIMITS[key]
    ) {
      return undefined;
    }
    captured[key] = value;
  }
  return Object.freeze(captured);
}

function captureCallback(
  input: unknown,
  key: string,
): ((this: void, request: never) => unknown) | undefined {
  if (!isPlainRecord(input) || !exactKeys(input, [key])) return undefined;
  const member = ownDataValue(input, key);
  return member.valid && member.present && typeof member.value === "function"
    ? (member.value as (this: void, request: never) => unknown)
    : undefined;
}

function captureHandledEvents(input: unknown, maximum: number): readonly string[] | undefined {
  if (!Array.isArray(input)) return undefined;
  let arrayLength: unknown;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(input, "length");
    if (descriptor === undefined || !("value" in descriptor)) return undefined;
    arrayLength = descriptor.value;
  } catch {
    return undefined;
  }
  if (
    typeof arrayLength !== "number" ||
    !Number.isSafeInteger(arrayLength) ||
    arrayLength < 0 ||
    arrayLength > maximum
  ) {
    return undefined;
  }
  try {
    const keys = Reflect.ownKeys(input);
    if (
      keys.length !== arrayLength + 1 ||
      !keys.includes("length") ||
      Array.from({ length: arrayLength }, (_, index) => String(index)).some(
        (key) => !keys.includes(key),
      )
    ) {
      return undefined;
    }
  } catch {
    return undefined;
  }
  const events: string[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < arrayLength; index += 1) {
    const event = ownDataValue(input, String(index));
    if (
      !event.valid ||
      !event.present ||
      typeof event.value !== "string" ||
      !LOCAL_IDENTIFIER_PATTERN.test(event.value) ||
      seen.has(event.value)
    ) {
      return undefined;
    }
    seen.add(event.value);
    events.push(event.value);
  }
  return Object.freeze(events.sort(compareText));
}

function captureClosedStatus(input: unknown, statuses: readonly string[]): string | undefined {
  if (!isPlainRecord(input) || !exactKeys(input, ["status"])) return undefined;
  const status = ownDataValue(input, "status");
  return status.valid &&
    status.present &&
    typeof status.value === "string" &&
    statuses.includes(status.value)
    ? status.value
    : undefined;
}

function bindingSnapshot(binding: Binding): RuntimeAdapterBindingSnapshot {
  return binding.kind === "component"
    ? Object.freeze({
        kind: "component",
        sourceNodeId: binding.sourceNodeId,
        capabilityId: binding.capabilityId,
        runtimeInstanceId: binding.runtimeInstanceId,
        registrationGeneration: binding.registrationGeneration,
        handledEvents: binding.handledEvents,
      })
    : Object.freeze({
        kind: "behavior",
        sourceNodeId: binding.sourceNodeId,
        behaviorId: binding.behaviorId,
        capabilityId: binding.capabilityId,
        runtimeInstanceId: binding.runtimeInstanceId,
        ownerRuntimeInstanceId: binding.ownerRuntimeInstanceId,
        registrationGeneration: binding.registrationGeneration,
        handledEvents: binding.handledEvents,
      });
}

function makeSnapshot(
  authority: BridgeAuthority,
  generation: number,
): RuntimeAdapterBridgesSnapshot {
  const bound = authority.bound;
  if (bound === undefined) throw new TypeError("Adapter bridges are not bound.");
  const bindings = [...authority.bindings.values()]
    .sort((left, right) => compareText(left.runtimeInstanceId, right.runtimeInstanceId))
    .map(bindingSnapshot);
  return Object.freeze({
    documentId: bound.documentId,
    revision: bound.revision,
    surfaceId: bound.surfaceId,
    generation,
    bindings: Object.freeze(bindings),
  });
}

function canPublishSnapshot(authority: BridgeAuthority): boolean {
  const bound = authority.bound;
  return (
    bound !== undefined &&
    Number.isSafeInteger(bound.snapshot.generation) &&
    bound.snapshot.generation < authority.limits.maxSnapshotGeneration
  );
}

function publishSnapshot(authority: BridgeAuthority): RuntimeAdapterBridgesSnapshot {
  const bound = authority.bound;
  if (bound === undefined) throw new TypeError("Adapter bridges are not bound.");
  bound.snapshot = makeSnapshot(authority, bound.snapshot.generation + 1);
  return bound.snapshot;
}

function nodeParts(
  identity: RuntimeAdapterNodeIdentity,
  scope: RuntimeRepeatScope,
):
  | Readonly<{
      documentId: string;
      surfaceId: string;
      sourceNodeId: string;
      capabilityId: string;
      runtimeInstanceId: string;
    }>
  | undefined {
  try {
    createRuntimeResolutionSnapshotForRepeatScope(scope);
  } catch {
    return undefined;
  }

  const documentId = ownDataValue(identity, "documentId");
  const surfaceId = ownDataValue(identity, "surfaceId");
  const nodeId = ownDataValue(identity, "nodeId");
  const use = ownDataValue(identity, "use");
  if (
    documentId.valid &&
    documentId.present &&
    typeof documentId.value === "string" &&
    surfaceId.valid &&
    surfaceId.present &&
    typeof surfaceId.value === "string" &&
    nodeId.valid &&
    nodeId.present &&
    typeof nodeId.value === "string" &&
    use.valid &&
    use.present &&
    typeof use.value === "string"
  ) {
    const decision = reconcileRuntimeNodeIdentity(identity as RuntimeNodeIdentity, {
      documentId: documentId.value,
      surfaceId: surfaceId.value,
      nodeId: nodeId.value,
      use: use.value,
    });
    if (
      decision.status === "preserve-eligible" &&
      decision.identity === identity &&
      scope.repeatKeys.length === 0
    ) {
      return Object.freeze({
        documentId: documentId.value,
        surfaceId: surfaceId.value,
        sourceNodeId: nodeId.value,
        capabilityId: use.value,
        runtimeInstanceId: decision.identity.key,
      });
    }
  }

  const baseIdentity = ownDataValue(identity, "baseIdentity");
  if (
    !baseIdentity.valid ||
    !baseIdentity.present ||
    typeof baseIdentity.value !== "object" ||
    baseIdentity.value === null
  ) {
    return undefined;
  }
  const baseDocumentId = ownDataValue(baseIdentity.value, "documentId");
  const baseSurfaceId = ownDataValue(baseIdentity.value, "surfaceId");
  const baseNodeId = ownDataValue(baseIdentity.value, "nodeId");
  const baseUse = ownDataValue(baseIdentity.value, "use");
  if (
    !baseDocumentId.valid ||
    !baseDocumentId.present ||
    typeof baseDocumentId.value !== "string" ||
    !baseSurfaceId.valid ||
    !baseSurfaceId.present ||
    typeof baseSurfaceId.value !== "string" ||
    !baseNodeId.valid ||
    !baseNodeId.present ||
    typeof baseNodeId.value !== "string" ||
    !baseUse.valid ||
    !baseUse.present ||
    typeof baseUse.value !== "string"
  ) {
    return undefined;
  }
  const decision = reconcileRuntimeRepeatedNodeIdentity(
    identity as RuntimeRepeatedNodeIdentity,
    {
      documentId: baseDocumentId.value,
      surfaceId: baseSurfaceId.value,
      nodeId: baseNodeId.value,
      use: baseUse.value,
    },
    scope,
  );
  return decision.status === "preserve-eligible" && decision.identity === identity
    ? Object.freeze({
        documentId: baseDocumentId.value,
        surfaceId: baseSurfaceId.value,
        sourceNodeId: baseNodeId.value,
        capabilityId: baseUse.value,
        runtimeInstanceId: decision.identity.key,
      })
    : undefined;
}

function countJsonOccurrences(input: unknown): number {
  let occurrences = 0;
  const pending: unknown[] = [input];
  while (pending.length > 0) {
    const value = pending.pop();
    occurrences += 1;
    if (Array.isArray(value)) {
      for (const member of value) pending.push(member);
    } else if (isRuntimeJsonObject(value)) {
      for (const member of Object.values(value)) pending.push(member);
    }
  }
  return occurrences;
}

/**
 * Detaches only the aliases and repeat keys needed by event dispatch.
 *
 * @remarks Retaining the branded scope itself would also retain its complete seven-namespace base
 * snapshot through the repeat module's private scope authority. Behaviors share their owner's
 * immutable projection and therefore add no second scope-budget charge.
 */
function captureScopeProjection(scope: RuntimeRepeatScope): RetainedScopeProjection | undefined {
  const captured = snapshotRuntimeJsonValue({
    item: scope.aliases,
    repeatKeys: scope.repeatKeys,
  });
  if (!isRuntimeJsonObject(captured)) return undefined;
  const item = captured.item;
  const repeatKeys = captured.repeatKeys;
  if (!isRuntimeJsonObject(item) || !Array.isArray(repeatKeys)) return undefined;
  if (
    repeatKeys.some(
      (key) =>
        (typeof key !== "string" && typeof key !== "number") ||
        (typeof key === "number" && !Number.isFinite(key)),
    )
  ) {
    return undefined;
  }
  let codeUnits: number;
  try {
    codeUnits = canonicalizeJson(captured).length;
  } catch {
    return undefined;
  }
  return Object.freeze({
    item,
    repeatKeys: repeatKeys as readonly RuntimeRepeatKey[],
    jsonOccurrences: countJsonOccurrences(captured),
    codeUnits,
  });
}

function ticketForBinding(
  authority: BridgeAuthority,
  input: unknown,
): Binding | "invalid" | "stale" {
  const ticketAuthority =
    typeof input === "object" && input !== null ? BINDING_TICKETS.get(input) : undefined;
  if (ticketAuthority === undefined || ticketAuthority.ownerKey !== authority.ownerKey) {
    return "invalid";
  }
  if ("status" in ticketAuthority) return "stale";
  const binding = authority.bindings.get(ticketAuthority.runtimeInstanceId);
  return binding !== undefined &&
    binding.bridgeTicket === input &&
    binding.registrationGeneration === ticketAuthority.registrationGeneration
    ? binding
    : "stale";
}

function currentCommandAuthority(authority: BridgeAuthority): boolean {
  const bound = authority.bound;
  if (bound === undefined) return false;
  const current = readRuntimeCommandEventActionsForAdapterBridge(bound.commandHandle);
  return (
    current.status === "read" &&
    current.catalogSet === bound.catalogSet &&
    current.commandEventPorts === bound.commandEventPorts &&
    current.snapshot === bound.commandSnapshot
  );
}

function currentBoundState(authority: BridgeAuthority): BoundState | undefined {
  return authority.status === "bound" ? authority.bound : undefined;
}

function invokeComponentCommand(
  authority: BridgeAuthority,
  request: RuntimeComponentCommandHostRequest,
): RuntimeComponentCommandHostResult {
  if (authority.status !== "bound" || authority.bound === undefined || authority.commandActive) {
    return Object.freeze({ status: "denied" });
  }
  if (
    !consumeRuntimeComponentCommandHostRequestForAdapterBridge(
      request,
      authority.bound.commandEventPorts,
    )
  ) {
    return Object.freeze({ status: "denied" });
  }
  if (
    !isPlainRecord(request) ||
    !exactKeys(request, [
      "capabilityId",
      "command",
      "context",
      "input",
      "runtimeInstanceId",
      "sourceNodeId",
    ])
  ) {
    return Object.freeze({ status: "denied" });
  }
  const sourceNodeId = ownDataValue(request, "sourceNodeId");
  const runtimeInstanceId = ownDataValue(request, "runtimeInstanceId");
  const capabilityId = ownDataValue(request, "capabilityId");
  const command = ownDataValue(request, "command");
  const input = ownDataValue(request, "input");
  if (
    !sourceNodeId.valid ||
    !sourceNodeId.present ||
    typeof sourceNodeId.value !== "string" ||
    !runtimeInstanceId.valid ||
    !runtimeInstanceId.present ||
    typeof runtimeInstanceId.value !== "string" ||
    !capabilityId.valid ||
    !capabilityId.present ||
    typeof capabilityId.value !== "string" ||
    !command.valid ||
    !command.present ||
    typeof command.value !== "string" ||
    !input.valid ||
    !input.present
  ) {
    return Object.freeze({ status: "denied" });
  }
  const binding = authority.components.get(runtimeInstanceId.value);
  if (
    binding === undefined ||
    binding.sourceNodeId !== sourceNodeId.value ||
    binding.capabilityId !== capabilityId.value
  ) {
    return Object.freeze({ status: "denied" });
  }
  if (binding.commands === undefined || !currentCommandAuthority(authority)) {
    throw new TypeError("The selected component adapter command binding is unavailable.");
  }
  const detachedInput = snapshotRuntimeJsonValue(input.value);
  if (!isRuntimeJsonObject(detachedInput)) {
    throw new TypeError("The component adapter command input is invalid.");
  }
  const commandRequest = Object.freeze({
    command: command.value,
    input: detachedInput,
  });
  authority.commandActive = true;
  try {
    let result: unknown;
    try {
      result = Reflect.apply(binding.commands, undefined, [commandRequest]);
    } catch {
      throw new TypeError("The component adapter command callback failed.");
    }
    if (
      authority.status !== "bound" ||
      authority.components.get(binding.runtimeInstanceId) !== binding ||
      !currentCommandAuthority(authority)
    ) {
      throw new TypeError("The component adapter command binding changed during invocation.");
    }
    const status = captureClosedStatus(result, ["succeeded", "denied"]);
    if (
      authority.status !== "bound" ||
      authority.components.get(binding.runtimeInstanceId) !== binding ||
      !currentCommandAuthority(authority)
    ) {
      throw new TypeError("The component adapter command binding changed during invocation.");
    }
    if (status === undefined) {
      throw new TypeError("The component adapter command callback returned an invalid result.");
    }
    return Object.freeze({ status: status as "succeeded" | "denied" });
  } finally {
    authority.commandActive = false;
  }
}

/**
 * Creates the first phase of a generic adapter bridge and its T12-compatible command port.
 *
 * @throws {TypeError} When callbacks or a lower-only limit profile are malformed.
 */
export function createRuntimeAdapterBridgePorts(
  input: RuntimeAdapterBridgePortsInput,
): RuntimeAdapterBridgePorts {
  if (!isPlainRecord(input) || !exactKeys(input, ["eventTurns"], ["limits"])) {
    throw new TypeError("Invalid adapter bridge ports.");
  }
  const eventTurns = ownDataValue(input, "eventTurns");
  const limits = ownDataValue(input, "limits");
  if (!eventTurns.valid || !eventTurns.present || !limits.valid) {
    throw new TypeError("Invalid adapter bridge ports.");
  }
  const dispatchEventTurn = captureCallback(eventTurns.value, "dispatch");
  const capturedLimits = captureLimits(limits.present ? limits.value : undefined);
  if (dispatchEventTurn === undefined || capturedLimits === undefined) {
    throw new TypeError("Invalid adapter bridge ports.");
  }
  const authority: BridgeAuthority = {
    status: "created",
    ownerKey: Object.freeze({}),
    dispatchEventTurn: dispatchEventTurn as RuntimeAdapterEventTurnPort["dispatch"],
    componentCommands: undefined,
    limits: capturedLimits,
    bindings: new Map(),
    components: new Map(),
    behaviorsByOwner: new Map(),
    bound: undefined,
    nextRegistrationGeneration: 0,
    nextEventGeneration: 0,
    liveHandlerBindings: 0,
    retainedCodeUnits: 0,
    retainedScopeJsonOccurrences: 0,
    retainedScopeCodeUnits: 0,
    transitioning: false,
    commandActive: false,
    eventActivityDepth: 0,
    eventDispatchDepth: 0,
  };
  const handle = Object.freeze({}) as RuntimeAdapterBridgesHandle;
  BRIDGE_AUTHORITIES.set(handle, authority);
  const componentCommands = Object.freeze({
    invoke(request: RuntimeComponentCommandHostRequest): RuntimeComponentCommandHostResult {
      const current = BRIDGE_AUTHORITIES.get(handle);
      return current === undefined || current.status === "disposed"
        ? Object.freeze({ status: "denied" })
        : invokeComponentCommand(current, request);
    },
  });
  authority.componentCommands = componentCommands;
  return Object.freeze({ handle, componentCommands });
}

/** Binds one created bridge exactly once to the same Catalog and current registry used by T12. */
export function bindRuntimeAdapterBridges(
  handle: RuntimeAdapterBridgesHandle,
  input: RuntimeAdapterBridgesBindInput,
): RuntimeAdapterBridgesBindResult {
  if (typeof handle !== "object" || handle === null) {
    return Object.freeze({ status: "invalid-handle" });
  }
  const authority = BRIDGE_AUTHORITIES.get(handle);
  if (authority === undefined) return Object.freeze({ status: "invalid-handle" });
  if (authority.status === "disposed" || authority.status === "revoked") {
    return Object.freeze({ status: "disposed" });
  }
  if (authority.status === "bound") {
    return Object.freeze({ status: "invalid", reason: "already-bound" });
  }
  if (authority.transitioning) return Object.freeze({ status: "busy" });
  authority.transitioning = true;
  try {
    if (
      !isPlainRecord(input) ||
      !exactKeys(input, [
        "catalogSet",
        "commandEventActionsHandle",
        "commandEventSnapshot",
        "documentId",
        "revision",
        "surfaceId",
      ])
    ) {
      return Object.freeze({ status: "invalid", reason: "malformed-input" });
    }
    if (!isCurrentBridgeAuthority(handle, authority)) {
      return Object.freeze({ status: "disposed" });
    }
    const documentId = ownDataValue(input, "documentId");
    const revision = ownDataValue(input, "revision");
    const surfaceId = ownDataValue(input, "surfaceId");
    const catalogSet = ownDataValue(input, "catalogSet");
    const commandHandle = ownDataValue(input, "commandEventActionsHandle");
    const commandSnapshot = ownDataValue(input, "commandEventSnapshot");
    if (
      !documentId.valid ||
      !documentId.present ||
      !isJsonString(documentId.value) ||
      documentId.value.length === 0 ||
      !revision.valid ||
      !revision.present ||
      typeof revision.value !== "string" ||
      !SHA256_DIGEST_PATTERN.test(revision.value) ||
      !surfaceId.valid ||
      !surfaceId.present ||
      typeof surfaceId.value !== "string" ||
      !LOCAL_IDENTIFIER_PATTERN.test(surfaceId.value) ||
      !catalogSet.valid ||
      !catalogSet.present ||
      !commandHandle.valid ||
      !commandHandle.present ||
      !commandSnapshot.valid ||
      !commandSnapshot.present
    ) {
      return Object.freeze({ status: "invalid", reason: "malformed-input" });
    }
    const current = readRuntimeCommandEventActionsForAdapterBridge(
      commandHandle.value as RuntimeCommandEventActionsHandle,
    );
    if (current.status !== "read" || current.snapshot !== commandSnapshot.value) {
      return Object.freeze({ status: "invalid", reason: "command-authority-invalid" });
    }
    if (current.catalogSet !== catalogSet.value) {
      return Object.freeze({ status: "invalid", reason: "catalog-mismatch" });
    }
    if (
      authority.componentCommands === undefined ||
      !isRuntimeCommandEventHostPortsForComponentCommandPort(
        current.commandEventPorts,
        authority.componentCommands,
      )
    ) {
      return Object.freeze({ status: "invalid", reason: "command-authority-invalid" });
    }
    if (
      current.snapshot.documentId !== documentId.value ||
      current.snapshot.revision !== revision.value ||
      current.snapshot.surfaceId !== surfaceId.value
    ) {
      return Object.freeze({ status: "invalid", reason: "identity-mismatch" });
    }
    const retainedCodeUnits =
      documentId.value.length + revision.value.length + surfaceId.value.length;
    if (retainedCodeUnits > authority.limits.maxRetainedIdentifierCodeUnits) {
      return Object.freeze({ status: "invalid", reason: "retained-limit" });
    }
    const inventory = catalogInventory(current.catalogSet);
    if (inventory === undefined) {
      return Object.freeze({ status: "invalid", reason: "catalog-mismatch" });
    }
    const bound: BoundState = {
      documentId: documentId.value,
      revision: revision.value,
      surfaceId: surfaceId.value,
      catalogSet: current.catalogSet,
      componentCapabilities: inventory.componentCapabilities,
      componentCategories: inventory.componentCategories,
      behaviorCapabilities: inventory.behaviorCapabilities,
      behaviorAttachments: inventory.behaviorAttachments,
      declaredEvents: inventory.declaredEvents,
      commandHandle: commandHandle.value as RuntimeCommandEventActionsHandle,
      commandEventPorts: current.commandEventPorts,
      commandSnapshot: current.snapshot,
      snapshot: undefined as unknown as RuntimeAdapterBridgesSnapshot,
    };
    authority.bound = bound;
    authority.retainedCodeUnits = retainedCodeUnits;
    authority.status = "bound";
    bound.snapshot = makeSnapshot(authority, 0);
    return Object.freeze({ status: "bound", snapshot: bound.snapshot });
  } finally {
    authority.transitioning = false;
  }
}

function registrationInvalid(
  reason: Extract<
    RuntimeAdapterBindingRegistrationResult,
    { readonly status: "invalid" }
  >["reason"],
): RuntimeAdapterBindingRegistrationResult {
  return Object.freeze({ status: "invalid", reason });
}

function reserveRegistration(
  authority: BridgeAuthority,
  handledEvents: readonly string[],
  retainedCodeUnits: number,
  retainedScopeJsonOccurrences: number,
  retainedScopeCodeUnits: number,
): RuntimeAdapterBindingRegistrationResult | undefined {
  if (authority.bindings.size >= authority.limits.maxLiveBindings) {
    return registrationInvalid("registry-limit");
  }
  if (
    authority.liveHandlerBindings + handledEvents.length >
    authority.limits.maxEventHandlerBindings
  ) {
    return registrationInvalid("event-handler-limit");
  }
  if (
    authority.retainedCodeUnits + retainedCodeUnits >
    authority.limits.maxRetainedIdentifierCodeUnits
  ) {
    return registrationInvalid("retained-limit");
  }
  if (
    authority.retainedScopeJsonOccurrences + retainedScopeJsonOccurrences >
      authority.limits.maxRetainedScopeJsonOccurrences ||
    authority.retainedScopeCodeUnits + retainedScopeCodeUnits >
      authority.limits.maxRetainedScopeCodeUnits
  ) {
    return registrationInvalid("retained-limit");
  }
  if (
    !Number.isSafeInteger(authority.nextRegistrationGeneration) ||
    authority.nextRegistrationGeneration > authority.limits.maxRegistrationGeneration
  ) {
    return registrationInvalid("generation-limit");
  }
  const bound = authority.bound;
  if (bound === undefined) return registrationInvalid("snapshot-limit");
  const nextSnapshotGeneration = bound.snapshot.generation + 1;
  if (
    !Number.isSafeInteger(nextSnapshotGeneration) ||
    nextSnapshotGeneration > authority.limits.maxSnapshotGeneration ||
    authority.limits.maxSnapshotGeneration - nextSnapshotGeneration < authority.bindings.size + 1
  ) {
    return registrationInvalid("snapshot-limit");
  }
  return undefined;
}

function registerComponent(
  authority: BridgeAuthority,
  input: RuntimeComponentAdapterBindingInput,
): RuntimeAdapterBindingRegistrationResult {
  if (!exactKeys(input, ["handledEvents", "identity", "kind", "scope", "snapshot"], ["commands"])) {
    return registrationInvalid("malformed-input");
  }
  const identity = ownDataValue(input, "identity");
  const scope = ownDataValue(input, "scope");
  const handledEventsValue = ownDataValue(input, "handledEvents");
  const commandsValue = ownDataValue(input, "commands");
  if (
    !identity.valid ||
    !identity.present ||
    !scope.valid ||
    !scope.present ||
    !handledEventsValue.valid ||
    !handledEventsValue.present ||
    !commandsValue.valid
  ) {
    return registrationInvalid("malformed-input");
  }
  const handledEvents = captureHandledEvents(
    handledEventsValue.value,
    authority.limits.maxEventHandlerBindings,
  );
  const parts = nodeParts(
    identity.value as RuntimeAdapterNodeIdentity,
    scope.value as RuntimeRepeatScope,
  );
  const bound = authority.bound;
  if (
    parts === undefined ||
    bound === undefined ||
    parts.documentId !== bound.documentId ||
    parts.surfaceId !== bound.surfaceId
  ) {
    return registrationInvalid("identity-mismatch");
  }
  if (
    handledEvents === undefined ||
    parts.runtimeInstanceId.length > authority.limits.maxRuntimeInstanceIdCodeUnits
  ) {
    return registrationInvalid("malformed-input");
  }
  const projection = captureScopeProjection(scope.value as RuntimeRepeatScope);
  if (projection === undefined) return registrationInvalid("malformed-input");
  let commandCallback: RuntimeAdapterComponentCommandPort["invoke"] | undefined;
  if (commandsValue.present) {
    commandCallback = captureCallback(commandsValue.value, "invoke") as
      RuntimeAdapterComponentCommandPort["invoke"] | undefined;
    if (commandCallback === undefined) return registrationInvalid("malformed-input");
  }
  if (authority.bindings.has(parts.runtimeInstanceId)) {
    return registrationInvalid("duplicate-binding");
  }
  const retainedCodeUnits =
    parts.sourceNodeId.length +
    parts.capabilityId.length +
    parts.runtimeInstanceId.length +
    handledEvents.reduce((total, event) => total + event.length, 0);
  const reserved = reserveRegistration(
    authority,
    handledEvents,
    retainedCodeUnits,
    projection.jsonOccurrences,
    projection.codeUnits,
  );
  if (reserved !== undefined) return reserved;
  if (!currentCommandAuthority(authority)) {
    return registrationInvalid("invalid-command-authority");
  }
  const commandRegistration = registerRuntimeComponentCommandTarget(bound.commandHandle, {
    sourceNodeId: parts.sourceNodeId,
    capabilityId: parts.capabilityId,
    runtimeInstanceId: parts.runtimeInstanceId,
    snapshot: bound.commandSnapshot,
  });
  if (commandRegistration.status !== "registered") {
    return registrationInvalid(
      commandRegistration.status === "invalid-snapshot" ||
        commandRegistration.status === "disposed" ||
        commandRegistration.status === "invalid-handle"
        ? "invalid-command-authority"
        : "command-registration-failed",
    );
  }
  const registrationGeneration = authority.nextRegistrationGeneration;
  const ticket = Object.freeze({}) as RuntimeAdapterBindingTicket;
  const binding: ComponentBinding = {
    kind: "component",
    sourceNodeId: parts.sourceNodeId,
    capabilityId: parts.capabilityId,
    runtimeInstanceId: parts.runtimeInstanceId,
    registrationGeneration,
    handledEvents,
    item: projection.item,
    repeatKeys: projection.repeatKeys,
    commands: commandCallback,
    bridgeTicket: ticket,
    commandTicket: commandRegistration.ticket,
    retainedCodeUnits,
    retainedScopeJsonOccurrences: projection.jsonOccurrences,
    retainedScopeCodeUnits: projection.codeUnits,
  };
  authority.nextRegistrationGeneration += 1;
  authority.liveHandlerBindings += handledEvents.length;
  authority.retainedCodeUnits += retainedCodeUnits;
  authority.retainedScopeJsonOccurrences += projection.jsonOccurrences;
  authority.retainedScopeCodeUnits += projection.codeUnits;
  authority.bindings.set(binding.runtimeInstanceId, binding);
  authority.components.set(binding.runtimeInstanceId, binding);
  authority.behaviorsByOwner.set(binding.runtimeInstanceId, new Set());
  bound.commandSnapshot = commandRegistration.snapshot;
  BINDING_TICKETS.set(ticket, {
    ownerKey: authority.ownerKey,
    runtimeInstanceId: binding.runtimeInstanceId,
    registrationGeneration,
  });
  const snapshot = publishSnapshot(authority);
  const snapshotBinding = bindingSnapshot(binding);
  return Object.freeze({ status: "registered", ticket, binding: snapshotBinding, snapshot });
}

function registerBehavior(
  authority: BridgeAuthority,
  input: RuntimeBehaviorAdapterBindingInput,
): RuntimeAdapterBindingRegistrationResult {
  if (
    !exactKeys(input, ["behaviorId", "capabilityId", "handledEvents", "kind", "owner", "snapshot"])
  ) {
    return registrationInvalid("malformed-input");
  }
  const ownerValue = ownDataValue(input, "owner");
  const behaviorId = ownDataValue(input, "behaviorId");
  const capabilityId = ownDataValue(input, "capabilityId");
  const handledEventsValue = ownDataValue(input, "handledEvents");
  if (
    !ownerValue.valid ||
    !ownerValue.present ||
    !behaviorId.valid ||
    !behaviorId.present ||
    typeof behaviorId.value !== "string" ||
    !LOCAL_IDENTIFIER_PATTERN.test(behaviorId.value) ||
    !capabilityId.valid ||
    !capabilityId.present ||
    typeof capabilityId.value !== "string" ||
    !isCapabilityId(capabilityId.value) ||
    !handledEventsValue.valid ||
    !handledEventsValue.present
  ) {
    return registrationInvalid("malformed-input");
  }
  const bound = authority.bound;
  const attachment = bound?.behaviorAttachments.get(capabilityId.value);
  if (
    bound === undefined ||
    !bound.behaviorCapabilities.has(capabilityId.value) ||
    attachment === undefined
  ) {
    return registrationInvalid("unknown-capability");
  }
  const owner = ticketForBinding(authority, ownerValue.value);
  if (owner === "invalid" || owner === "stale" || owner.kind !== "component") {
    return registrationInvalid("invalid-owner");
  }
  const ownerCategory = bound.componentCategories.get(owner.capabilityId);
  if (
    !attachment.capabilities.has(owner.capabilityId) &&
    (ownerCategory === undefined || !attachment.categories.has(ownerCategory))
  ) {
    return registrationInvalid("incompatible-owner");
  }
  const handledEvents = captureHandledEvents(
    handledEventsValue.value,
    authority.limits.maxEventHandlerBindings,
  );
  if (handledEvents === undefined) return registrationInvalid("malformed-input");
  let runtimeInstanceId: string;
  try {
    runtimeInstanceId = canonicalizeJson([owner.runtimeInstanceId, "behavior", behaviorId.value]);
  } catch {
    return registrationInvalid("malformed-input");
  }
  if (runtimeInstanceId.length > authority.limits.maxRuntimeInstanceIdCodeUnits) {
    return registrationInvalid("malformed-input");
  }
  if (authority.bindings.has(runtimeInstanceId)) {
    return registrationInvalid("duplicate-binding");
  }
  const retainedCodeUnits =
    owner.sourceNodeId.length +
    behaviorId.value.length +
    capabilityId.value.length +
    runtimeInstanceId.length +
    handledEvents.reduce((total, event) => total + event.length, 0);
  const reserved = reserveRegistration(authority, handledEvents, retainedCodeUnits, 0, 0);
  if (reserved !== undefined) return reserved;
  if (!currentCommandAuthority(authority)) {
    return registrationInvalid("invalid-command-authority");
  }
  const registrationGeneration = authority.nextRegistrationGeneration;
  const ticket = Object.freeze({}) as RuntimeAdapterBindingTicket;
  const binding: BehaviorBinding = {
    kind: "behavior",
    sourceNodeId: owner.sourceNodeId,
    behaviorId: behaviorId.value,
    capabilityId: capabilityId.value,
    runtimeInstanceId,
    ownerRuntimeInstanceId: owner.runtimeInstanceId,
    registrationGeneration,
    handledEvents,
    item: owner.item,
    repeatKeys: owner.repeatKeys,
    bridgeTicket: ticket,
    retainedCodeUnits,
  };
  authority.nextRegistrationGeneration += 1;
  authority.liveHandlerBindings += handledEvents.length;
  authority.retainedCodeUnits += retainedCodeUnits;
  authority.bindings.set(binding.runtimeInstanceId, binding);
  authority.behaviorsByOwner.get(owner.runtimeInstanceId)?.add(binding.runtimeInstanceId);
  BINDING_TICKETS.set(ticket, {
    ownerKey: authority.ownerKey,
    runtimeInstanceId: binding.runtimeInstanceId,
    registrationGeneration,
  });
  const snapshot = publishSnapshot(authority);
  return Object.freeze({
    status: "registered",
    ticket,
    binding: bindingSnapshot(binding),
    snapshot,
  });
}

/** Registers one component or one owner-bound behavior without retaining a platform object. */
export function registerRuntimeAdapterBinding(
  handle: RuntimeAdapterBridgesHandle,
  input: RuntimeAdapterBindingInput,
): RuntimeAdapterBindingRegistrationResult {
  if (typeof handle !== "object" || handle === null) {
    return Object.freeze({ status: "invalid-handle" });
  }
  const authority = BRIDGE_AUTHORITIES.get(handle);
  if (authority === undefined) return Object.freeze({ status: "invalid-handle" });
  if (authority.status === "disposed" || authority.status === "revoked") {
    return Object.freeze({ status: "disposed" });
  }
  if (authority.status !== "bound" || authority.bound === undefined) {
    return Object.freeze({ status: "unbound" });
  }
  if (
    authority.transitioning ||
    authority.commandActive ||
    authority.eventActivityDepth > 0 ||
    authority.eventDispatchDepth > 0
  ) {
    return Object.freeze({ status: "busy" });
  }
  authority.transitioning = true;
  try {
    if (!isPlainRecord(input)) return registrationInvalid("malformed-input");
    const kind = ownDataValue(input, "kind");
    const snapshot = ownDataValue(input, "snapshot");
    if (
      !kind.valid ||
      !kind.present ||
      (kind.value !== "component" && kind.value !== "behavior") ||
      !snapshot.valid ||
      !snapshot.present
    ) {
      return registrationInvalid("malformed-input");
    }
    if (!isCurrentBridgeAuthority(handle, authority) || authority.bound === undefined) {
      return Object.freeze({ status: "disposed" });
    }
    if (snapshot.value !== authority.bound.snapshot) {
      return Object.freeze({ status: "invalid-snapshot", snapshot: authority.bound.snapshot });
    }
    return kind.value === "component"
      ? registerComponent(authority, input as RuntimeComponentAdapterBindingInput)
      : registerBehavior(authority, input as RuntimeBehaviorAdapterBindingInput);
  } finally {
    authority.transitioning = false;
  }
}

function removeBehavior(
  authority: BridgeAuthority,
  binding: BehaviorBinding,
  status: "unregistered" | "disposed",
): void {
  authority.bindings.delete(binding.runtimeInstanceId);
  authority.behaviorsByOwner.get(binding.ownerRuntimeInstanceId)?.delete(binding.runtimeInstanceId);
  authority.liveHandlerBindings -= binding.handledEvents.length;
  authority.retainedCodeUnits -= binding.retainedCodeUnits;
  BINDING_TICKETS.set(binding.bridgeTicket, { ownerKey: authority.ownerKey, status });
}

function removeComponent(
  authority: BridgeAuthority,
  binding: ComponentBinding,
  status: "unregistered" | "disposed",
): number {
  let cascaded = 0;
  for (const behaviorId of authority.behaviorsByOwner.get(binding.runtimeInstanceId) ?? []) {
    const behavior = authority.bindings.get(behaviorId);
    if (behavior?.kind === "behavior") {
      removeBehavior(authority, behavior, status);
      cascaded += 1;
    }
  }
  authority.behaviorsByOwner.delete(binding.runtimeInstanceId);
  authority.bindings.delete(binding.runtimeInstanceId);
  authority.components.delete(binding.runtimeInstanceId);
  authority.liveHandlerBindings -= binding.handledEvents.length;
  authority.retainedCodeUnits -= binding.retainedCodeUnits;
  authority.retainedScopeJsonOccurrences -= binding.retainedScopeJsonOccurrences;
  authority.retainedScopeCodeUnits -= binding.retainedScopeCodeUnits;
  BINDING_TICKETS.set(binding.bridgeTicket, { ownerKey: authority.ownerKey, status });
  return cascaded;
}

/** Unregisters one exact binding generation and cascades an owning component's behaviors. */
export function unregisterRuntimeAdapterBinding(
  handle: RuntimeAdapterBridgesHandle,
  input: RuntimeAdapterBindingUnregistrationInput,
): RuntimeAdapterBindingUnregistrationResult {
  if (typeof handle !== "object" || handle === null) {
    return Object.freeze({ status: "invalid-handle" });
  }
  const authority = BRIDGE_AUTHORITIES.get(handle);
  if (authority === undefined) return Object.freeze({ status: "invalid-handle" });
  if (authority.status === "disposed" || authority.status === "revoked") {
    return Object.freeze({ status: "disposed" });
  }
  if (authority.status !== "bound" || authority.bound === undefined) {
    return Object.freeze({ status: "unbound" });
  }
  if (
    authority.transitioning ||
    authority.commandActive ||
    authority.eventActivityDepth > 0 ||
    authority.eventDispatchDepth > 0
  ) {
    return Object.freeze({ status: "busy" });
  }
  authority.transitioning = true;
  try {
    if (!isPlainRecord(input) || !exactKeys(input, ["snapshot", "ticket"])) {
      return Object.freeze({ status: "invalid", reason: "malformed-input" });
    }
    const snapshot = ownDataValue(input, "snapshot");
    const ticket = ownDataValue(input, "ticket");
    if (!snapshot.valid || !snapshot.present || !ticket.valid || !ticket.present) {
      return Object.freeze({ status: "invalid", reason: "malformed-input" });
    }
    if (!isCurrentBridgeAuthority(handle, authority) || authority.bound === undefined) {
      return Object.freeze({ status: "disposed" });
    }
    if (snapshot.value !== authority.bound.snapshot) {
      return Object.freeze({ status: "invalid-snapshot", snapshot: authority.bound.snapshot });
    }
    const binding = ticketForBinding(authority, ticket.value);
    if (binding === "invalid") return Object.freeze({ status: "invalid-ticket" });
    if (binding === "stale") return Object.freeze({ status: "stale-ticket" });
    if (!canPublishSnapshot(authority)) {
      return Object.freeze({ status: "invalid", reason: "snapshot-limit" });
    }
    let cascadedBehaviors = 0;
    if (binding.kind === "component") {
      if (!currentCommandAuthority(authority)) {
        return Object.freeze({ status: "invalid", reason: "invalid-command-authority" });
      }
      const lower = unregisterRuntimeComponentCommandTarget(authority.bound.commandHandle, {
        ticket: binding.commandTicket,
        snapshot: authority.bound.commandSnapshot,
      });
      if (lower.status !== "unregistered") {
        return Object.freeze({ status: "invalid", reason: "invalid-command-authority" });
      }
      authority.bound.commandSnapshot = lower.snapshot;
      cascadedBehaviors = removeComponent(authority, binding, "unregistered");
    } else {
      removeBehavior(authority, binding, "unregistered");
    }
    return Object.freeze({
      status: "unregistered",
      kind: binding.kind,
      runtimeInstanceId: binding.runtimeInstanceId,
      cascadedBehaviors,
      snapshot: publishSnapshot(authority),
    });
  } finally {
    authority.transitioning = false;
  }
}

function eventSelector(binding: Binding, eventName: string): RuntimeAdapterEventHandlerSelector {
  return binding.kind === "component"
    ? Object.freeze({ kind: "component", sourceNodeId: binding.sourceNodeId, eventName })
    : Object.freeze({
        kind: "behavior",
        sourceNodeId: binding.sourceNodeId,
        behaviorId: binding.behaviorId,
        eventName,
      });
}

/** Validates and forwards one current component or behavior event through the generic turn port. */
export function receiveRuntimeAdapterEvent(
  handle: RuntimeAdapterBridgesHandle,
  input: RuntimeAdapterEventInput,
): RuntimeAdapterEventResult {
  if (typeof handle !== "object" || handle === null) {
    return Object.freeze({ status: "invalid-handle" });
  }
  const authority = BRIDGE_AUTHORITIES.get(handle);
  if (authority === undefined) return Object.freeze({ status: "invalid-handle" });
  if (authority.status === "disposed" || authority.status === "revoked") {
    return Object.freeze({ status: "disposed" });
  }
  if (authority.status !== "bound" || authority.bound === undefined) {
    return Object.freeze({ status: "unbound" });
  }
  authority.eventActivityDepth += 1;
  try {
    if (
      !isPlainRecord(input) ||
      !exactKeys(input, ["eventName", "payload", "snapshot", "ticket"])
    ) {
      return Object.freeze({ status: "malformed-input" });
    }
    const snapshot = ownDataValue(input, "snapshot");
    const ticket = ownDataValue(input, "ticket");
    const eventName = ownDataValue(input, "eventName");
    if (
      !snapshot.valid ||
      !snapshot.present ||
      !ticket.valid ||
      !ticket.present ||
      !eventName.valid ||
      !eventName.present ||
      typeof eventName.value !== "string" ||
      !LOCAL_IDENTIFIER_PATTERN.test(eventName.value)
    ) {
      return Object.freeze({ status: "malformed-input" });
    }
    if (!isCurrentBridgeAuthority(handle, authority) || authority.bound === undefined) {
      return Object.freeze({ status: "disposed" });
    }
    if (snapshot.value !== authority.bound.snapshot) {
      return Object.freeze({ status: "invalid-snapshot", snapshot: authority.bound.snapshot });
    }
    const binding = ticketForBinding(authority, ticket.value);
    if (binding === "invalid" || binding === "stale") {
      return Object.freeze({ status: "stale-ticket" });
    }
    if (binding.kind === "behavior") {
      const owner = authority.components.get(binding.ownerRuntimeInstanceId);
      if (owner === undefined || authority.bindings.get(owner.runtimeInstanceId) !== owner) {
        return Object.freeze({ status: "stale-ticket" });
      }
    }
    if (!currentCommandAuthority(authority)) {
      return Object.freeze({ status: "invalid-command-authority" });
    }
    if (
      !authority.bound.declaredEvents.has(
        catalogEventKey(binding.kind, binding.capabilityId, eventName.value),
      )
    ) {
      const diagnostic = createCoreDiagnostic({
        code: "UNKNOWN_EVENT",
        message: "The requested component or behavior event contract is not declared.",
        pointer: createJsonPointer(),
        context: { capabilityId: binding.capabilityId },
      });
      return Object.freeze({
        status: "unknown-event",
        diagnostics: Object.freeze([diagnostic]),
      });
    }
    const payload = ownDataValue(input, "payload");
    if (!payload.valid || !payload.present) {
      return Object.freeze({ status: "malformed-input" });
    }
    if (!isCurrentBridgeAuthority(handle, authority) || authority.bound === undefined) {
      return Object.freeze({ status: "disposed" });
    }
    const validationCatalog = authority.bound.catalogSet;
    const validation = validateDesenEventPayload(
      payload.value,
      {
        capabilityKind: binding.kind,
        capabilityId: binding.capabilityId,
        eventName: eventName.value,
      },
      validationCatalog,
    );
    if (!isCurrentBridgeAuthority(handle, authority)) {
      return Object.freeze({ status: "disposed" });
    }
    if (!currentCommandAuthority(authority)) {
      return Object.freeze({ status: "invalid-command-authority" });
    }
    const currentBound = currentBoundState(authority);
    if (currentBound === undefined) {
      return Object.freeze({ status: "disposed" });
    }
    if (snapshot.value !== currentBound.snapshot) {
      return Object.freeze({ status: "invalid-snapshot", snapshot: currentBound.snapshot });
    }
    if (authority.bindings.get(binding.runtimeInstanceId) !== binding) {
      return Object.freeze({ status: "stale-ticket" });
    }
    if (binding.kind === "behavior") {
      const owner = authority.components.get(binding.ownerRuntimeInstanceId);
      if (owner === undefined || authority.bindings.get(owner.runtimeInstanceId) !== owner) {
        return Object.freeze({ status: "stale-ticket" });
      }
    }
    if (!validation.valid) {
      return Object.freeze({
        status: validation.diagnostics.some((diagnostic) => diagnostic.code === "UNKNOWN_EVENT")
          ? "unknown-event"
          : "payload-invalid",
        diagnostics: validation.diagnostics,
      });
    }
    if (!binding.handledEvents.includes(eventName.value)) {
      return Object.freeze({ status: "validated-unhandled", payload: validation.value });
    }
    if (
      !Number.isSafeInteger(authority.nextEventGeneration) ||
      authority.nextEventGeneration > authority.limits.maxEventGeneration
    ) {
      return Object.freeze({ status: "event-limit" });
    }
    const eventId = `adapter-event-${authority.nextEventGeneration}`;
    authority.nextEventGeneration += 1;
    const selector = eventSelector(binding, eventName.value);
    const request = Object.freeze({
      eventId,
      documentId: currentBound.documentId,
      revision: currentBound.revision,
      surfaceId: currentBound.surfaceId,
      capabilityKind: binding.kind,
      capabilityId: binding.capabilityId,
      runtimeInstanceId: binding.runtimeInstanceId,
      handler: selector,
      payload: validation.value,
      item: binding.item,
      repeatKeys: binding.repeatKeys,
    }) as RuntimeAdapterEventTurnRequest;
    let raw: unknown;
    authority.eventDispatchDepth += 1;
    try {
      raw = Reflect.apply(authority.dispatchEventTurn, undefined, [request]);
    } catch {
      return Object.freeze({ status: "bridge-failed", eventId });
    } finally {
      authority.eventDispatchDepth -= 1;
    }
    const status = captureClosedStatus(raw, ["accepted", "rejected"]);
    if (status === "accepted") return Object.freeze({ status: "dispatched", eventId });
    if (status === "rejected") return Object.freeze({ status: "turn-rejected", eventId });
    return Object.freeze({ status: "bridge-failed", eventId });
  } finally {
    authority.eventActivityDepth -= 1;
  }
}

/** Reads the exact current bridge snapshot without invoking adapter, event, or command callbacks. */
export function readRuntimeAdapterBridges(
  handle: RuntimeAdapterBridgesHandle,
): RuntimeAdapterBridgesReadResult {
  if (typeof handle !== "object" || handle === null) {
    return Object.freeze({ status: "invalid-handle" });
  }
  const authority = BRIDGE_AUTHORITIES.get(handle);
  if (authority === undefined) return Object.freeze({ status: "invalid-handle" });
  if (authority.status === "disposed" || authority.status === "revoked") {
    return Object.freeze({ status: "disposed" });
  }
  return authority.status === "created" || authority.bound === undefined
    ? Object.freeze({ status: "unbound" })
    : Object.freeze({ status: "read", snapshot: authority.bound.snapshot });
}

/** Terminally revokes every adapter binding and removes its exact mirrored T12 targets when live. */
export function disposeRuntimeAdapterBridges(
  handle: RuntimeAdapterBridgesHandle,
): RuntimeAdapterBridgesDisposeResult {
  if (typeof handle !== "object" || handle === null) {
    return Object.freeze({
      status: "invalid-handle",
      disposedComponents: 0,
      disposedBehaviors: 0,
    });
  }
  const authority = BRIDGE_AUTHORITIES.get(handle);
  if (authority === undefined) {
    return Object.freeze({
      status: "invalid-handle",
      disposedComponents: 0,
      disposedBehaviors: 0,
    });
  }
  if (authority.status === "disposed" || authority.status === "revoked") {
    return Object.freeze({
      status: "already-disposed",
      disposedComponents: 0,
      disposedBehaviors: 0,
    });
  }
  if (
    authority.transitioning ||
    authority.commandActive ||
    authority.eventActivityDepth > 0 ||
    authority.eventDispatchDepth > 0
  ) {
    return Object.freeze({
      status: "busy",
      disposedComponents: 0,
      disposedBehaviors: 0,
    });
  }
  const components = [...authority.components.values()];
  const disposedComponents = components.length;
  const disposedBehaviors = [...authority.bindings.values()].filter(
    (binding) => binding.kind === "behavior",
  ).length;
  const bound = authority.bound;
  if (bound !== undefined) {
    const current = readRuntimeCommandEventActionsForAdapterBridge(bound.commandHandle);
    if (
      current.status === "read" &&
      (current.catalogSet !== bound.catalogSet ||
        current.commandEventPorts !== bound.commandEventPorts ||
        current.snapshot.documentId !== bound.documentId ||
        current.snapshot.revision !== bound.revision ||
        current.snapshot.surfaceId !== bound.surfaceId)
    ) {
      return Object.freeze({
        status: "invalid-command-authority",
        disposedComponents: 0,
        disposedBehaviors: 0,
      });
    }
    if (current.status === "invalid-handle") {
      return Object.freeze({
        status: "invalid-command-authority",
        disposedComponents: 0,
        disposedBehaviors: 0,
      });
    }
    if (current.status === "read") {
      let snapshot = current.snapshot;
      for (const component of components) {
        const lower = unregisterRuntimeComponentCommandTarget(bound.commandHandle, {
          ticket: component.commandTicket,
          snapshot,
        });
        if (lower.status === "busy") {
          return Object.freeze({
            status: "busy",
            disposedComponents: 0,
            disposedBehaviors: 0,
          });
        }
        if (lower.status === "disposed") break;
        if (lower.status !== "unregistered") {
          return Object.freeze({
            status: "invalid-command-authority",
            disposedComponents: 0,
            disposedBehaviors: 0,
          });
        }
        snapshot = lower.snapshot;
      }
    }
  }
  authority.status = "revoked";
  for (const binding of [...authority.bindings.values()]) {
    BINDING_TICKETS.set(binding.bridgeTicket, {
      ownerKey: authority.ownerKey,
      status: "disposed",
    });
  }
  authority.bindings.clear();
  authority.components.clear();
  authority.behaviorsByOwner.clear();
  authority.liveHandlerBindings = 0;
  authority.retainedCodeUnits = 0;
  authority.retainedScopeJsonOccurrences = 0;
  authority.retainedScopeCodeUnits = 0;
  authority.bound = undefined;
  BRIDGE_AUTHORITIES.set(
    handle,
    Object.freeze({ status: "disposed", ownerKey: authority.ownerKey }),
  );
  return Object.freeze({ status: "disposed", disposedComponents, disposedBehaviors });
}
