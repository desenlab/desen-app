import {
  canonicalizeJson,
  createCoreDiagnostic,
  createJsonPointer,
  isSha256Digest,
} from "@desen/protocol";
import { validateDesenExecutionCatalogSet, validateDesenExecutionValue } from "@desen/validator";

import {
  captureRuntimeActionWhen,
  createRuntimeActionEvaluationSession,
  evaluateRuntimeActionGuard,
  materializeRuntimeActionNamedValues,
} from "./action-evaluation.js";
import {
  emitRuntimeHostEventHostPort,
  isRuntimeCommandEventHostPorts,
  invokeRuntimeComponentCommandHostPort,
  validateRuntimeHostEventHostPort,
} from "./command-event-ports.js";
import { createRuntimeHostPorts } from "./host-ports.js";
import { isRuntimeJsonObject, snapshotRuntimeJsonValue } from "./runtime-json-snapshot.js";
import { resolveRuntimeValue, RUNTIME_VALUE_SAFETY_LIMITS } from "./value-resolution.js";

import type { DesenCatalog, DesenDiagnostic, JsonPointer } from "@desen/protocol";
import type { DesenValidatedExecutionCatalogSet, ImmutableJson } from "@desen/validator";
import type { RuntimeActionEvaluationSession } from "./action-evaluation.js";
import type {
  RuntimeCommandEventHostPorts,
  RuntimeComponentCommandHostRequest,
  RuntimeHostEventRequest,
} from "./command-event-ports.js";
import type { RuntimeHostPorts, RuntimeJsonObject } from "./host-ports.js";
import type { RuntimePredicateSpec, RuntimePredicateTypeMismatch } from "./predicate-evaluation.js";
import type {
  RuntimeActionGuardRejected,
  RuntimeActionPayloadRejected,
  RuntimeActionSkipped,
} from "./state-navigation-actions.js";
import type { RuntimeValueMaterialization } from "./token-format-resolution.js";
import type { RuntimeResolutionSnapshot, RuntimeValueSpec } from "./value-resolution.js";

const LOCAL_IDENTIFIER_PATTERN = /^[A-Za-z][A-Za-z0-9._:-]{0,127}$/u;
const CAPABILITY_IDENTIFIER_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9.-]*\/[A-Za-z][A-Za-z0-9._:-]{0,127}$/u;
const ROOT_POINTER = createJsonPointer();
const TARGET_POINTER = createJsonPointer(["target"]);
const COMMAND_POINTER = createJsonPointer(["command"]);
const NAME_POINTER = createJsonPointer(["name"]);
const PAYLOAD_POINTER = createJsonPointer(["payload"]);
const EMPTY_DIAGNOSTICS = Object.freeze([]) as readonly DesenDiagnostic<string>[];

declare const RUNTIME_COMMAND_EVENT_ACTIONS_HANDLE_TYPE_BRAND: unique symbol;
declare const RUNTIME_COMPONENT_COMMAND_REGISTRATION_TICKET_TYPE_BRAND: unique symbol;

/** Finite default ceilings for one mounted command/event action lifetime. */
export const RUNTIME_COMMAND_EVENT_ACTION_LIMITS = Object.freeze({
  maxActionGeneration: Number.MAX_SAFE_INTEGER,
  maxRegistrationGeneration: Number.MAX_SAFE_INTEGER,
  maxSnapshotGeneration: Number.MAX_SAFE_INTEGER,
  maxLiveTargets: 5_000,
  maxStaticComponents: 5_000,
  maxHostEvents: 1_024,
  maxRetainedIdentifierCodeUnits: RUNTIME_VALUE_SAFETY_LIMITS.maxStringCodeUnits,
  maxRuntimeInstanceIdCodeUnits: 1_024,
} as const);

/** Optional trusted host profile that may only lower command/event ceilings. */
export interface RuntimeCommandEventActionLimitProfile {
  readonly maxActionGeneration?: number;
  readonly maxRegistrationGeneration?: number;
  readonly maxSnapshotGeneration?: number;
  readonly maxLiveTargets?: number;
  readonly maxStaticComponents?: number;
  readonly maxHostEvents?: number;
  readonly maxRetainedIdentifierCodeUnits?: number;
  readonly maxRuntimeInstanceIdCodeUnits?: number;
}

/** Exact `component.command` action owned by this primitive. */
export interface RuntimeComponentCommandAction {
  readonly type: "component.command";
  readonly target: string;
  readonly command: string;
  readonly input?: Readonly<Record<string, RuntimeValueSpec>>;
  readonly when?: RuntimePredicateSpec;
  readonly extensions?: RuntimeJsonObject;
}

/** Exact allowlisted application-shell `event.emit` action. */
export interface RuntimeHostEventEmitAction {
  readonly type: "event.emit";
  readonly name: string;
  readonly payload?: Readonly<Record<string, RuntimeValueSpec>>;
  readonly when?: RuntimePredicateSpec;
  readonly extensions?: RuntimeJsonObject;
}

/** One action executed by the M04-T12 primitive. */
export type RuntimeCommandEventAction = RuntimeComponentCommandAction | RuntimeHostEventEmitAction;

/** Trusted mount inputs for one surface-local command/event action lifetime. */
export interface RuntimeCommandEventActionsMountInput {
  readonly documentId: string;
  readonly revision: string;
  readonly surfaceId: string;
  readonly staticComponents: Readonly<Record<string, string>>;
  readonly hostEvents: Readonly<Record<string, string>>;
  readonly catalogSet: DesenValidatedExecutionCatalogSet;
  readonly hostPorts: RuntimeHostPorts;
  readonly commandEventPorts: RuntimeCommandEventHostPorts;
  readonly limits?: RuntimeCommandEventActionLimitProfile;
}

/** Opaque authority for one mounted command/event action lifetime. */
export interface RuntimeCommandEventActionsHandle {
  readonly [RUNTIME_COMMAND_EVENT_ACTIONS_HANDLE_TYPE_BRAND]: true;
}

/** Opaque one-registration authority bound to one source node and generation. */
export interface RuntimeComponentCommandRegistrationTicket {
  readonly [RUNTIME_COMPONENT_COMMAND_REGISTRATION_TICKET_TYPE_BRAND]: true;
}

/** Immutable public identity of one currently registered component instance. */
export interface RuntimeRegisteredComponentCommandTargetSnapshot {
  readonly runtimeInstanceId: string;
  readonly registrationGeneration: number;
}

/** Exact immutable live-target registry state issued by this manager. */
export interface RuntimeCommandEventActionsSnapshot {
  readonly documentId: string;
  readonly revision: string;
  readonly surfaceId: string;
  readonly generation: number;
  readonly liveTargets: Readonly<
    Record<
      string,
      Readonly<{
        readonly capabilityId: string;
        readonly instances: readonly RuntimeRegisteredComponentCommandTargetSnapshot[];
      }>
    >
  >;
}

/** Complete atomic mount result. */
export type RuntimeCommandEventActionsMountResult =
  | Readonly<{
      readonly status: "mounted";
      readonly handle: RuntimeCommandEventActionsHandle;
      readonly snapshot: RuntimeCommandEventActionsSnapshot;
    }>
  | Readonly<{
      readonly status: "invalid";
      readonly reason:
        | "catalog-set-invalid"
        | "invalid-command-event-ports"
        | "invalid-static-component"
        | "malformed-input"
        | "registry-limit";
      readonly diagnostics: readonly DesenDiagnostic<string>[];
    }>;

/** Caller-owned request to register one live component instance. */
export interface RuntimeComponentCommandTargetRegistrationInput {
  readonly sourceNodeId: string;
  readonly capabilityId: string;
  readonly runtimeInstanceId: string;
  readonly snapshot: RuntimeCommandEventActionsSnapshot;
}

/** Complete synchronous live-target registration result. */
export type RuntimeComponentCommandTargetRegistrationResult =
  | Readonly<{
      readonly status: "registered";
      readonly sourceNodeId: string;
      readonly runtimeInstanceId: string;
      readonly registrationGeneration: number;
      readonly ticket: RuntimeComponentCommandRegistrationTicket;
      readonly snapshot: RuntimeCommandEventActionsSnapshot;
    }>
  | Readonly<{
      readonly status: "already-registered";
      readonly sourceNodeId: string;
      readonly runtimeInstanceId: string;
      readonly snapshot: RuntimeCommandEventActionsSnapshot;
    }>
  | Readonly<{ readonly status: "unknown-target"; readonly sourceNodeId: string }>
  | Readonly<{ readonly status: "capability-mismatch"; readonly sourceNodeId: string }>
  | Readonly<{
      readonly status: "invalid-snapshot";
      readonly snapshot: RuntimeCommandEventActionsSnapshot;
    }>
  | Readonly<{ readonly status: "registration-limit" | "registry-limit" | "snapshot-limit" }>
  | Readonly<{ readonly status: "malformed-request" }>
  | Readonly<{ readonly status: "busy" }>
  | Readonly<{ readonly status: "disposed" }>
  | Readonly<{ readonly status: "invalid-handle" }>;

/** Caller-owned request to unregister one exact live component generation. */
export interface RuntimeComponentCommandTargetUnregistrationInput {
  readonly ticket: RuntimeComponentCommandRegistrationTicket;
  readonly snapshot: RuntimeCommandEventActionsSnapshot;
}

/** Complete synchronous live-target unregistration result. */
export type RuntimeComponentCommandTargetUnregistrationResult =
  | Readonly<{
      readonly status: "unregistered";
      readonly sourceNodeId: string;
      readonly snapshot: RuntimeCommandEventActionsSnapshot;
    }>
  | Readonly<{ readonly status: "stale-ticket" | "invalid-ticket" | "snapshot-limit" }>
  | Readonly<{
      readonly status: "invalid-snapshot";
      readonly snapshot: RuntimeCommandEventActionsSnapshot;
    }>
  | Readonly<{ readonly status: "busy" }>
  | Readonly<{ readonly status: "disposed" }>
  | Readonly<{ readonly status: "invalid-handle" }>
  | Readonly<{ readonly status: "malformed-request" }>;

/** Complete result of one guarded command or host-event action. */
export type RuntimeCommandEventActionResult =
  | RuntimeActionGuardRejected
  | RuntimeActionPayloadRejected
  | RuntimeActionSkipped
  | Readonly<{
      readonly status: "command-succeeded" | "command-denied";
      readonly requestId: string;
      readonly target: string;
      readonly command: string;
      readonly capabilityId: string;
      readonly runtimeInstanceId: string;
      readonly diagnostics: readonly DesenDiagnostic<string>[];
    }>
  | Readonly<{
      readonly status: "event-emitted" | "event-denied";
      readonly requestId: string;
      readonly name: string;
      readonly contractId: string;
      readonly diagnostics: readonly DesenDiagnostic<string>[];
    }>
  | Readonly<{
      readonly status: "command-target-unavailable";
      readonly target: string;
      readonly reason: "ambiguous" | "unmounted";
      readonly diagnostics: readonly DesenDiagnostic<string>[];
    }>
  | Readonly<{
      readonly status: "unknown-command";
      readonly target: string;
      readonly command: string;
      readonly diagnostics: readonly DesenDiagnostic<string>[];
    }>
  | Readonly<{
      readonly status: "unknown-command-target";
      readonly target: string;
      readonly diagnostics: readonly DesenDiagnostic<string>[];
    }>
  | Readonly<{
      readonly status: "command-input-rejected";
      readonly target: string;
      readonly command: string;
      readonly diagnostics: readonly DesenDiagnostic<string>[];
    }>
  | Readonly<{
      readonly status: "host-event-not-allowlisted";
      readonly name: string;
      readonly diagnostics: readonly DesenDiagnostic<string>[];
    }>
  | Readonly<{
      readonly status: "host-event-payload-invalid";
      readonly requestId: string;
      readonly name: string;
      readonly contractId: string;
      readonly diagnostics: readonly DesenDiagnostic<string>[];
    }>
  | Readonly<{
      readonly status: "adapter-failed";
      readonly action: "component.command" | "event.emit";
      readonly requestId: string;
      readonly diagnostics: readonly DesenDiagnostic<string>[];
    }>
  | Readonly<{
      readonly status: "invalid-action";
      readonly diagnostics: readonly DesenDiagnostic<string>[];
    }>
  | Readonly<{
      readonly status: "invalid-snapshot";
      readonly snapshot: RuntimeCommandEventActionsSnapshot;
    }>
  | Readonly<{ readonly status: "action-limit" }>
  | Readonly<{ readonly status: "busy" }>
  | Readonly<{ readonly status: "disposed" }>
  | Readonly<{ readonly status: "invalid-handle" }>;

/** Terminal idempotent disposal result. */
export type RuntimeCommandEventActionsDisposeResult =
  | Readonly<{ readonly status: "disposed"; readonly disposedTargets: number }>
  | Readonly<{ readonly status: "already-disposed"; readonly disposedTargets: 0 }>
  | Readonly<{ readonly status: "invalid-handle"; readonly disposedTargets: 0 }>;

interface LiveTarget {
  readonly sourceNodeId: string;
  readonly capabilityId: string;
  readonly runtimeInstanceId: string;
  readonly registrationGeneration: number;
  readonly ticket: RuntimeComponentCommandRegistrationTicket;
}

interface CommandEventAuthority {
  status: "live" | "revoked";
  readonly ownerKey: object;
  readonly documentId: string;
  readonly revision: string;
  readonly surfaceId: string;
  readonly staticComponents: ReadonlyMap<string, string>;
  readonly hostEvents: ReadonlyMap<string, string>;
  readonly componentCommands: ReadonlyMap<string, ReadonlySet<string>>;
  readonly catalogSet: DesenValidatedExecutionCatalogSet;
  readonly hostPorts: RuntimeHostPorts;
  readonly commandEventPorts: RuntimeCommandEventHostPorts;
  readonly limits: Required<RuntimeCommandEventActionLimitProfile>;
  readonly liveTargets: Map<string, Map<string, LiveTarget>>;
  liveTargetCount: number;
  snapshot: RuntimeCommandEventActionsSnapshot;
  nextActionGeneration: number;
  nextRegistrationGeneration: number;
  transitioning: boolean;
  reporting: boolean;
}

interface CommandEventTombstone {
  readonly status: "disposed";
  readonly ownerKey: object;
}

interface RegistrationTicketAuthority {
  readonly ownerKey: object;
  readonly sourceNodeId: string;
  readonly runtimeInstanceId: string;
  readonly registrationGeneration: number;
}

interface RegistrationTicketFinal {
  readonly ownerKey: object;
  readonly status: "unregistered" | "disposed";
}

const ACTION_AUTHORITIES = new WeakMap<object, CommandEventAuthority | CommandEventTombstone>();
const REGISTRATION_TICKETS = new WeakMap<
  object,
  RegistrationTicketAuthority | RegistrationTicketFinal
>();

type CatalogSnapshot = ImmutableJson<DesenCatalog>;

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
    return "value" in descriptor && descriptor.enumerable
      ? Object.freeze({ valid: true, present: true, value: descriptor.value })
      : Object.freeze({ valid: false, present: true });
  } catch {
    return Object.freeze({ valid: false, present: false });
  }
}

function exactKeys(
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
        return descriptor !== undefined && "value" in descriptor && descriptor.enumerable;
      })
    );
  } catch {
    return false;
  }
}

function finiteLimit(value: unknown, ceiling: number): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= ceiling
    ? value
    : undefined;
}

function capturedLimit(
  input: RuntimeJsonObject,
  key: keyof RuntimeCommandEventActionLimitProfile,
  fallback: number,
  ceiling: number,
): number | undefined {
  return finiteLimit(Object.hasOwn(input, key) ? input[key] : fallback, ceiling);
}

function captureLimits(
  input: unknown,
): Required<RuntimeCommandEventActionLimitProfile> | undefined {
  if (input === undefined) return { ...RUNTIME_COMMAND_EVENT_ACTION_LIMITS };
  const copied = snapshotRuntimeJsonValue(input);
  if (
    !isRuntimeJsonObject(copied) ||
    !exactKeys(
      copied,
      [],
      [
        "maxActionGeneration",
        "maxHostEvents",
        "maxLiveTargets",
        "maxRegistrationGeneration",
        "maxRetainedIdentifierCodeUnits",
        "maxSnapshotGeneration",
        "maxRuntimeInstanceIdCodeUnits",
        "maxStaticComponents",
      ],
    )
  ) {
    return undefined;
  }
  const entries = {
    maxActionGeneration: capturedLimit(
      copied,
      "maxActionGeneration",
      RUNTIME_COMMAND_EVENT_ACTION_LIMITS.maxActionGeneration,
      RUNTIME_COMMAND_EVENT_ACTION_LIMITS.maxActionGeneration,
    ),
    maxRegistrationGeneration: capturedLimit(
      copied,
      "maxRegistrationGeneration",
      RUNTIME_COMMAND_EVENT_ACTION_LIMITS.maxRegistrationGeneration,
      RUNTIME_COMMAND_EVENT_ACTION_LIMITS.maxRegistrationGeneration,
    ),
    maxSnapshotGeneration: capturedLimit(
      copied,
      "maxSnapshotGeneration",
      RUNTIME_COMMAND_EVENT_ACTION_LIMITS.maxSnapshotGeneration,
      RUNTIME_COMMAND_EVENT_ACTION_LIMITS.maxSnapshotGeneration,
    ),
    maxLiveTargets: capturedLimit(
      copied,
      "maxLiveTargets",
      RUNTIME_COMMAND_EVENT_ACTION_LIMITS.maxLiveTargets,
      RUNTIME_COMMAND_EVENT_ACTION_LIMITS.maxLiveTargets,
    ),
    maxStaticComponents: capturedLimit(
      copied,
      "maxStaticComponents",
      RUNTIME_COMMAND_EVENT_ACTION_LIMITS.maxStaticComponents,
      RUNTIME_COMMAND_EVENT_ACTION_LIMITS.maxStaticComponents,
    ),
    maxHostEvents: capturedLimit(
      copied,
      "maxHostEvents",
      RUNTIME_COMMAND_EVENT_ACTION_LIMITS.maxHostEvents,
      RUNTIME_COMMAND_EVENT_ACTION_LIMITS.maxHostEvents,
    ),
    maxRetainedIdentifierCodeUnits: capturedLimit(
      copied,
      "maxRetainedIdentifierCodeUnits",
      RUNTIME_COMMAND_EVENT_ACTION_LIMITS.maxRetainedIdentifierCodeUnits,
      RUNTIME_COMMAND_EVENT_ACTION_LIMITS.maxRetainedIdentifierCodeUnits,
    ),
    maxRuntimeInstanceIdCodeUnits: capturedLimit(
      copied,
      "maxRuntimeInstanceIdCodeUnits",
      RUNTIME_COMMAND_EVENT_ACTION_LIMITS.maxRuntimeInstanceIdCodeUnits,
      RUNTIME_COMMAND_EVENT_ACTION_LIMITS.maxRuntimeInstanceIdCodeUnits,
    ),
  };
  return Object.values(entries).some((value) => value === undefined)
    ? undefined
    : (entries as Required<RuntimeCommandEventActionLimitProfile>);
}

function isCanonicalJsonString(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      if (index + 1 >= value.length) return false;
      const next = value.charCodeAt(index + 1);
      if (next < 0xdc00 || next > 0xdfff) return false;
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      return false;
    }
  }
  return true;
}

type StringMapCapture =
  | Readonly<{
      readonly status: "captured";
      readonly value: ReadonlyMap<string, string>;
      readonly retainedCodeUnits: number;
    }>
  | Readonly<{ readonly status: "invalid" | "limit" }>;

function captureStringMap(
  input: unknown,
  maxEntries: number,
  maxRetainedCodeUnits: number,
  keyPattern?: RegExp,
  valuePattern?: RegExp,
): StringMapCapture {
  if (!isPlainRecord(input)) return Object.freeze({ status: "invalid" });
  let keys: readonly string[];
  try {
    const ownKeys = Reflect.ownKeys(input);
    if (ownKeys.some((key) => typeof key !== "string")) {
      return Object.freeze({ status: "invalid" });
    }
    if (ownKeys.length > maxEntries) return Object.freeze({ status: "limit" });
    keys = (ownKeys as string[]).sort(compareText);
  } catch {
    return Object.freeze({ status: "invalid" });
  }
  const result = new Map<string, string>();
  let retainedCodeUnits = 0;
  for (const key of keys) {
    retainedCodeUnits += key.length;
    if (retainedCodeUnits > maxRetainedCodeUnits) {
      return Object.freeze({ status: "limit" });
    }
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(input, key);
    } catch {
      return Object.freeze({ status: "invalid" });
    }
    if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
      return Object.freeze({ status: "invalid" });
    }
    const value = descriptor.value;
    if (
      key.length === 0 ||
      key.length > RUNTIME_VALUE_SAFETY_LIMITS.maxStringCodeUnits ||
      !isCanonicalJsonString(key) ||
      (keyPattern !== undefined && !keyPattern.test(key)) ||
      typeof value !== "string" ||
      value.length === 0 ||
      value.length > RUNTIME_VALUE_SAFETY_LIMITS.maxStringCodeUnits ||
      !isCanonicalJsonString(value) ||
      (valuePattern !== undefined && !valuePattern.test(value))
    ) {
      return Object.freeze({ status: "invalid" });
    }
    retainedCodeUnits += value.length;
    if (retainedCodeUnits > maxRetainedCodeUnits) {
      return Object.freeze({ status: "limit" });
    }
    result.set(key, value);
  }
  return Object.freeze({
    status: "captured",
    value: result,
    retainedCodeUnits,
  });
}

function catalogCommands(
  catalogs: DesenValidatedExecutionCatalogSet,
): ReadonlyMap<string, ReadonlySet<string>> {
  const result = new Map<string, ReadonlySet<string>>();
  for (const catalog of catalogs as readonly CatalogSnapshot[]) {
    for (const [capabilityId, contract] of Object.entries(catalog.components)) {
      const names = Object.keys(contract.commands ?? {}).sort(compareText);
      result.set(capabilityId, new Set(names));
    }
  }
  return result;
}

function makeSnapshot(
  authority: Pick<
    CommandEventAuthority,
    "documentId" | "liveTargets" | "revision" | "staticComponents" | "surfaceId"
  >,
  generation: number,
): RuntimeCommandEventActionsSnapshot {
  const liveTargets = Object.create(null) as Record<
    string,
    Readonly<{
      readonly capabilityId: string;
      readonly instances: readonly RuntimeRegisteredComponentCommandTargetSnapshot[];
    }>
  >;
  for (const [sourceNodeId, targets] of [...authority.liveTargets].sort(([left], [right]) =>
    compareText(left, right),
  )) {
    const instances = [...targets.values()]
      .sort((left, right) => compareText(left.runtimeInstanceId, right.runtimeInstanceId))
      .map((target) =>
        Object.freeze({
          runtimeInstanceId: target.runtimeInstanceId,
          registrationGeneration: target.registrationGeneration,
        }),
      );
    liveTargets[sourceNodeId] = Object.freeze({
      capabilityId: authority.staticComponents.get(sourceNodeId) as string,
      instances: Object.freeze(instances),
    });
  }
  return Object.freeze({
    documentId: authority.documentId,
    revision: authority.revision,
    surfaceId: authority.surfaceId,
    generation,
    liveTargets: Object.freeze(liveTargets),
  });
}

function publishSnapshot(authority: CommandEventAuthority): RuntimeCommandEventActionsSnapshot {
  authority.snapshot = makeSnapshot(authority, authority.snapshot.generation + 1);
  return authority.snapshot;
}

function canPublishSnapshot(authority: CommandEventAuthority): boolean {
  const next = authority.snapshot.generation + 1;
  return Number.isSafeInteger(next) && next <= authority.limits.maxSnapshotGeneration;
}

function canRegisterWithSnapshotReservation(authority: CommandEventAuthority): boolean {
  const next = authority.snapshot.generation + 1;
  if (!Number.isSafeInteger(next) || next > authority.limits.maxSnapshotGeneration) {
    return false;
  }
  return authority.limits.maxSnapshotGeneration - next >= authority.liveTargetCount + 1;
}

function actionDiagnostic(
  code: string,
  message: string,
  authority: Pick<CommandEventAuthority, "documentId" | "surfaceId">,
  pointer?: JsonPointer,
): Readonly<DesenDiagnostic<string>> {
  return Object.freeze({
    code,
    message,
    ...(pointer === undefined ? {} : { pointer }),
    context: Object.freeze({
      documentId: authority.documentId,
      surfaceId: authority.surfaceId,
    }),
  });
}

function coreDiagnostic(
  code:
    | "ADAPTER_FAILURE"
    | "COMMAND_INPUT_INVALID"
    | "PREDICATE_TYPE_MISMATCH"
    | "REFERENCE_UNRESOLVED"
    | "UNKNOWN_COMMAND",
  message: string,
  authority: Pick<CommandEventAuthority, "documentId" | "surfaceId">,
  pointer?: JsonPointer,
): Readonly<DesenDiagnostic<string>> {
  return createCoreDiagnostic({
    code,
    message,
    ...(pointer === undefined ? {} : { pointer }),
    context: { documentId: authority.documentId, surfaceId: authority.surfaceId },
  });
}

function safeReport(
  authority: CommandEventAuthority,
  diagnostics: readonly DesenDiagnostic<string>[],
): void {
  if (authority.reporting) return;
  authority.reporting = true;
  try {
    for (const diagnostic of diagnostics) {
      if (authority.status !== "live") break;
      try {
        Reflect.apply(authority.hostPorts.diagnostics.report, undefined, [diagnostic]);
      } catch {
        // Diagnostics are observational.
      }
    }
  } finally {
    authority.reporting = false;
  }
}

function predicateDiagnostics(
  authority: CommandEventAuthority,
  diagnostics: readonly RuntimePredicateTypeMismatch[],
): readonly DesenDiagnostic<string>[] {
  return Object.freeze(
    diagnostics.map(({ pointer }) =>
      coreDiagnostic(
        "PREDICATE_TYPE_MISMATCH",
        "A guarded command or event predicate compared incompatible values.",
        authority,
        pointer,
      ),
    ),
  );
}

function nextRequestId(authority: CommandEventAuthority): string | undefined {
  const generation = authority.nextActionGeneration;
  if (!Number.isSafeInteger(generation) || generation > authority.limits.maxActionGeneration) {
    return undefined;
  }
  return `command-event-action:${canonicalizeJson([authority.surfaceId, generation])}`;
}

function acceptRequest(authority: CommandEventAuthority): void {
  authority.nextActionGeneration += 1;
}

function validResolutionSnapshot(snapshot: RuntimeResolutionSnapshot): boolean {
  try {
    return resolveRuntimeValue(null, snapshot).status === "resolved";
  } catch {
    return false;
  }
}

function observationFailure(
  authority: CommandEventAuthority,
  expected: RuntimeCommandEventActionsSnapshot,
): RuntimeCommandEventActionResult | undefined {
  if (authority.status !== "live") return Object.freeze({ status: "disposed" });
  return authority.snapshot === expected
    ? undefined
    : Object.freeze({ status: "invalid-snapshot", snapshot: authority.snapshot });
}

function validateExtension(action: object): boolean {
  const extension = ownDataValue(action, "extensions");
  if (!extension.valid) return false;
  if (!extension.present) return true;
  return isRuntimeJsonObject(snapshotRuntimeJsonValue(extension.value));
}

function invalidAction(
  authority: CommandEventAuthority,
  message = "The guarded command/event action is malformed.",
  pointer: JsonPointer = ROOT_POINTER,
): Extract<RuntimeCommandEventActionResult, { readonly status: "invalid-action" }> {
  return Object.freeze({
    status: "invalid-action",
    diagnostics: Object.freeze([
      actionDiagnostic("run.desen.runtime/ACTION_INPUT_INVALID", message, authority, pointer),
    ]),
  });
}

function guardRejected(
  authority: CommandEventAuthority,
  reason: "adapter-failed" | "invalid",
  pointer: JsonPointer,
): RuntimeActionGuardRejected {
  const diagnostics = Object.freeze([
    reason === "adapter-failed"
      ? coreDiagnostic(
          "ADAPTER_FAILURE",
          "The action guard token provider failed unexpectedly.",
          authority,
          pointer,
        )
      : actionDiagnostic(
          "run.desen.runtime/ACTION_GUARD_INVALID",
          "The action guard is malformed or could not be evaluated safely.",
          authority,
          pointer,
        ),
  ]);
  safeReport(authority, diagnostics);
  return Object.freeze({ status: "guard-rejected", reason, diagnostics });
}

function payloadRejected(
  authority: CommandEventAuthority,
  result: Exclude<RuntimeValueMaterialization, { readonly status: "resolved" }>,
): RuntimeActionPayloadRejected {
  if (result.status === "failed") {
    return Object.freeze({
      status: "payload-rejected",
      reason: "adapter-failed",
      diagnostics: Object.freeze([
        coreDiagnostic(
          "ADAPTER_FAILURE",
          "The action token provider failed unexpectedly.",
          authority,
          result.pointer,
        ),
      ]),
    });
  }
  if (result.status === "unresolved") {
    return Object.freeze({
      status: "payload-rejected",
      reason: "unresolved",
      diagnostics: Object.freeze([
        coreDiagnostic(
          "REFERENCE_UNRESOLVED",
          "A required action value has no value or eligible fallback.",
          authority,
          result.pointer,
        ),
      ]),
    });
  }
  return Object.freeze({
    status: "payload-rejected",
    reason: "invalid",
    diagnostics: Object.freeze([
      actionDiagnostic(
        "run.desen.runtime/ACTION_INPUT_INVALID",
        "An action value is malformed or exceeds the runtime data boundary.",
        authority,
        result.pointer,
      ),
    ]),
  });
}

function adapterFailure(
  authority: CommandEventAuthority,
  action: "component.command" | "event.emit",
  requestId: string,
): Extract<RuntimeCommandEventActionResult, { readonly status: "adapter-failed" }> {
  const diagnostics = Object.freeze([
    coreDiagnostic(
      "ADAPTER_FAILURE",
      "The command/event adapter failed or returned a malformed synchronous result.",
      authority,
    ),
  ]);
  safeReport(authority, diagnostics);
  return Object.freeze({ status: "adapter-failed", action, requestId, diagnostics });
}

/** Mounts one surface-local command/event executor with no live component instances. */
export function mountRuntimeCommandEventActions(
  input: RuntimeCommandEventActionsMountInput,
): RuntimeCommandEventActionsMountResult {
  if (
    !isPlainRecord(input) ||
    !exactKeys(
      input,
      [
        "catalogSet",
        "commandEventPorts",
        "documentId",
        "hostEvents",
        "hostPorts",
        "revision",
        "staticComponents",
        "surfaceId",
      ],
      ["limits"],
    )
  ) {
    return Object.freeze({
      status: "invalid",
      reason: "malformed-input",
      diagnostics: EMPTY_DIAGNOSTICS,
    });
  }
  const values = Object.fromEntries(
    [
      "catalogSet",
      "commandEventPorts",
      "documentId",
      "hostEvents",
      "hostPorts",
      "limits",
      "revision",
      "staticComponents",
      "surfaceId",
    ].map((key) => [key, ownDataValue(input, key)]),
  ) as Record<string, ReturnType<typeof ownDataValue>>;
  const documentId = values.documentId;
  const revision = values.revision;
  const surfaceId = values.surfaceId;
  const staticComponentsValue = values.staticComponents;
  const hostEventsValue = values.hostEvents;
  const catalogSetValue = values.catalogSet;
  const commandEventPortsValue = values.commandEventPorts;
  const hostPortsValue = values.hostPorts;
  const limitsValue = values.limits;
  if (
    documentId === undefined ||
    !documentId.valid ||
    !documentId.present ||
    typeof documentId.value !== "string" ||
    documentId.value.length === 0 ||
    documentId.value.length > RUNTIME_VALUE_SAFETY_LIMITS.maxStringCodeUnits ||
    !isCanonicalJsonString(documentId.value) ||
    revision === undefined ||
    !revision.valid ||
    !revision.present ||
    typeof revision.value !== "string" ||
    !isSha256Digest(revision.value) ||
    surfaceId === undefined ||
    !surfaceId.valid ||
    !surfaceId.present ||
    typeof surfaceId.value !== "string" ||
    !LOCAL_IDENTIFIER_PATTERN.test(surfaceId.value) ||
    staticComponentsValue === undefined ||
    !staticComponentsValue.valid ||
    !staticComponentsValue.present ||
    hostEventsValue === undefined ||
    !hostEventsValue.valid ||
    !hostEventsValue.present ||
    catalogSetValue === undefined ||
    !catalogSetValue.valid ||
    !catalogSetValue.present ||
    commandEventPortsValue === undefined ||
    !commandEventPortsValue.valid ||
    !commandEventPortsValue.present ||
    hostPortsValue === undefined ||
    !hostPortsValue.valid ||
    !hostPortsValue.present ||
    limitsValue === undefined ||
    !limitsValue.valid
  ) {
    return Object.freeze({
      status: "invalid",
      reason: "malformed-input",
      diagnostics: EMPTY_DIAGNOSTICS,
    });
  }
  const limits = captureLimits(limitsValue.present ? limitsValue.value : undefined);
  if (limits === undefined) {
    return Object.freeze({
      status: "invalid",
      reason: "malformed-input",
      diagnostics: EMPTY_DIAGNOSTICS,
    });
  }
  const staticCapture = captureStringMap(
    staticComponentsValue.value,
    limits.maxStaticComponents,
    limits.maxRetainedIdentifierCodeUnits,
    LOCAL_IDENTIFIER_PATTERN,
    CAPABILITY_IDENTIFIER_PATTERN,
  );
  if (staticCapture.status === "limit") {
    return Object.freeze({
      status: "invalid",
      reason: "registry-limit",
      diagnostics: EMPTY_DIAGNOSTICS,
    });
  }
  if (staticCapture.status !== "captured") {
    return Object.freeze({
      status: "invalid",
      reason: "malformed-input",
      diagnostics: EMPTY_DIAGNOSTICS,
    });
  }
  const hostCapture = captureStringMap(
    hostEventsValue.value,
    limits.maxHostEvents,
    limits.maxRetainedIdentifierCodeUnits - staticCapture.retainedCodeUnits,
  );
  if (hostCapture.status === "limit") {
    return Object.freeze({
      status: "invalid",
      reason: "registry-limit",
      diagnostics: EMPTY_DIAGNOSTICS,
    });
  }
  if (hostCapture.status !== "captured") {
    return Object.freeze({
      status: "invalid",
      reason: "malformed-input",
      diagnostics: EMPTY_DIAGNOSTICS,
    });
  }
  const staticComponents = staticCapture.value;
  const hostEvents = hostCapture.value;
  const catalogSet = catalogSetValue.value as DesenValidatedExecutionCatalogSet;
  const validated = validateDesenExecutionCatalogSet(catalogSet);
  if (!validated.valid || validated.value !== catalogSet) {
    return Object.freeze({
      status: "invalid",
      reason: "catalog-set-invalid",
      diagnostics: validated.valid ? EMPTY_DIAGNOSTICS : validated.diagnostics,
    });
  }
  const componentCommands = catalogCommands(catalogSet);
  if ([...staticComponents.values()].some((capabilityId) => !componentCommands.has(capabilityId))) {
    return Object.freeze({
      status: "invalid",
      reason: "invalid-static-component",
      diagnostics: EMPTY_DIAGNOSTICS,
    });
  }
  const commandEventPorts = commandEventPortsValue.value as RuntimeCommandEventHostPorts;
  if (!isRuntimeCommandEventHostPorts(commandEventPorts)) {
    return Object.freeze({
      status: "invalid",
      reason: "invalid-command-event-ports",
      diagnostics: EMPTY_DIAGNOSTICS,
    });
  }
  let hostPorts: RuntimeHostPorts;
  try {
    hostPorts = createRuntimeHostPorts(hostPortsValue.value as RuntimeHostPorts);
  } catch {
    return Object.freeze({
      status: "invalid",
      reason: "malformed-input",
      diagnostics: EMPTY_DIAGNOSTICS,
    });
  }
  const authority: CommandEventAuthority = {
    status: "live",
    ownerKey: Object.freeze({}),
    documentId: documentId.value,
    revision: revision.value,
    surfaceId: surfaceId.value,
    staticComponents,
    hostEvents,
    componentCommands,
    catalogSet,
    hostPorts,
    commandEventPorts,
    limits,
    liveTargets: new Map(),
    liveTargetCount: 0,
    snapshot: undefined as unknown as RuntimeCommandEventActionsSnapshot,
    nextActionGeneration: 0,
    nextRegistrationGeneration: 0,
    transitioning: false,
    reporting: false,
  };
  authority.snapshot = makeSnapshot(authority, 0);
  const handle = Object.freeze({}) as RuntimeCommandEventActionsHandle;
  ACTION_AUTHORITIES.set(handle, authority);
  return Object.freeze({ status: "mounted", handle, snapshot: authority.snapshot });
}

/** Registers one live runtime instance without retaining a platform object or callback. */
export function registerRuntimeComponentCommandTarget(
  handle: RuntimeCommandEventActionsHandle,
  input: RuntimeComponentCommandTargetRegistrationInput,
): RuntimeComponentCommandTargetRegistrationResult {
  if (typeof handle !== "object" || handle === null) {
    return Object.freeze({ status: "invalid-handle" });
  }
  const authority = ACTION_AUTHORITIES.get(handle);
  if (authority === undefined) return Object.freeze({ status: "invalid-handle" });
  if (authority.status !== "live") return Object.freeze({ status: "disposed" });
  if (authority.transitioning || authority.reporting) return Object.freeze({ status: "busy" });
  authority.transitioning = true;
  try {
    if (
      !isPlainRecord(input) ||
      !exactKeys(input, ["capabilityId", "runtimeInstanceId", "snapshot", "sourceNodeId"])
    ) {
      return authority.status === "live"
        ? Object.freeze({ status: "malformed-request" })
        : Object.freeze({ status: "disposed" });
    }
    if (authority.status !== "live") return Object.freeze({ status: "disposed" });
    const sourceNodeId = ownDataValue(input, "sourceNodeId");
    const capabilityId = ownDataValue(input, "capabilityId");
    const runtimeInstanceId = ownDataValue(input, "runtimeInstanceId");
    const snapshot = ownDataValue(input, "snapshot");
    if (authority.status !== "live") return Object.freeze({ status: "disposed" });
    if (
      !sourceNodeId.valid ||
      !sourceNodeId.present ||
      typeof sourceNodeId.value !== "string" ||
      !LOCAL_IDENTIFIER_PATTERN.test(sourceNodeId.value) ||
      !capabilityId.valid ||
      !capabilityId.present ||
      typeof capabilityId.value !== "string" ||
      !runtimeInstanceId.valid ||
      !runtimeInstanceId.present ||
      typeof runtimeInstanceId.value !== "string" ||
      runtimeInstanceId.value.length === 0 ||
      runtimeInstanceId.value.length > authority.limits.maxRuntimeInstanceIdCodeUnits ||
      snapshotRuntimeJsonValue(runtimeInstanceId.value) !== runtimeInstanceId.value ||
      !snapshot.valid ||
      !snapshot.present
    ) {
      return Object.freeze({ status: "malformed-request" });
    }
    if (snapshot.value !== authority.snapshot) {
      return Object.freeze({ status: "invalid-snapshot", snapshot: authority.snapshot });
    }
    const staticCapability = authority.staticComponents.get(sourceNodeId.value);
    if (staticCapability === undefined) {
      return Object.freeze({ status: "unknown-target", sourceNodeId: sourceNodeId.value });
    }
    if (staticCapability !== capabilityId.value) {
      return Object.freeze({
        status: "capability-mismatch",
        sourceNodeId: sourceNodeId.value,
      });
    }
    const targets = authority.liveTargets.get(sourceNodeId.value);
    if (targets?.has(runtimeInstanceId.value) === true) {
      return Object.freeze({
        status: "already-registered",
        sourceNodeId: sourceNodeId.value,
        runtimeInstanceId: runtimeInstanceId.value,
        snapshot: authority.snapshot,
      });
    }
    if (authority.liveTargetCount >= authority.limits.maxLiveTargets) {
      return Object.freeze({ status: "registry-limit" });
    }
    const generation = authority.nextRegistrationGeneration;
    if (
      !Number.isSafeInteger(generation) ||
      generation > authority.limits.maxRegistrationGeneration
    ) {
      return Object.freeze({ status: "registration-limit" });
    }
    if (!canRegisterWithSnapshotReservation(authority)) {
      return Object.freeze({ status: "snapshot-limit" });
    }
    const ticket = Object.freeze({}) as RuntimeComponentCommandRegistrationTicket;
    const target: LiveTarget = {
      sourceNodeId: sourceNodeId.value,
      capabilityId: capabilityId.value,
      runtimeInstanceId: runtimeInstanceId.value,
      registrationGeneration: generation,
      ticket,
    };
    const updatedTargets = new Map(targets);
    updatedTargets.set(runtimeInstanceId.value, target);
    authority.nextRegistrationGeneration += 1;
    authority.liveTargetCount += 1;
    authority.liveTargets.set(sourceNodeId.value, updatedTargets);
    REGISTRATION_TICKETS.set(ticket, {
      ownerKey: authority.ownerKey,
      sourceNodeId: sourceNodeId.value,
      runtimeInstanceId: runtimeInstanceId.value,
      registrationGeneration: generation,
    });
    const nextSnapshot = publishSnapshot(authority);
    return Object.freeze({
      status: "registered",
      sourceNodeId: sourceNodeId.value,
      runtimeInstanceId: runtimeInstanceId.value,
      registrationGeneration: generation,
      ticket,
      snapshot: nextSnapshot,
    });
  } finally {
    authority.transitioning = false;
  }
}

/** Unregisters only the exact live generation authorized by one opaque ticket. */
export function unregisterRuntimeComponentCommandTarget(
  handle: RuntimeCommandEventActionsHandle,
  input: RuntimeComponentCommandTargetUnregistrationInput,
): RuntimeComponentCommandTargetUnregistrationResult {
  if (typeof handle !== "object" || handle === null) {
    return Object.freeze({ status: "invalid-handle" });
  }
  const authority = ACTION_AUTHORITIES.get(handle);
  if (authority === undefined) return Object.freeze({ status: "invalid-handle" });
  if (authority.status !== "live") return Object.freeze({ status: "disposed" });
  if (authority.transitioning || authority.reporting) return Object.freeze({ status: "busy" });
  authority.transitioning = true;
  try {
    if (!isPlainRecord(input) || !exactKeys(input, ["snapshot", "ticket"])) {
      return authority.status === "live"
        ? Object.freeze({ status: "malformed-request" })
        : Object.freeze({ status: "disposed" });
    }
    if (authority.status !== "live") return Object.freeze({ status: "disposed" });
    const ticketValue = ownDataValue(input, "ticket");
    const snapshot = ownDataValue(input, "snapshot");
    if (authority.status !== "live") return Object.freeze({ status: "disposed" });
    if (!ticketValue.valid || !ticketValue.present || !snapshot.valid || !snapshot.present) {
      return Object.freeze({ status: "malformed-request" });
    }
    if (snapshot.value !== authority.snapshot) {
      return Object.freeze({ status: "invalid-snapshot", snapshot: authority.snapshot });
    }
    const ticket = ticketValue.value as RuntimeComponentCommandRegistrationTicket;
    const ticketAuthority =
      typeof ticket === "object" && ticket !== null ? REGISTRATION_TICKETS.get(ticket) : undefined;
    if (ticketAuthority === undefined || ticketAuthority.ownerKey !== authority.ownerKey) {
      return Object.freeze({ status: "invalid-ticket" });
    }
    if ("status" in ticketAuthority) return Object.freeze({ status: "stale-ticket" });
    const targets = authority.liveTargets.get(ticketAuthority.sourceNodeId);
    const target = targets?.get(ticketAuthority.runtimeInstanceId);
    if (
      target === undefined ||
      target.ticket !== ticket ||
      target.registrationGeneration !== ticketAuthority.registrationGeneration
    ) {
      return Object.freeze({ status: "stale-ticket" });
    }
    if (!canPublishSnapshot(authority)) {
      return Object.freeze({ status: "snapshot-limit" });
    }
    const updatedTargets = new Map(targets);
    updatedTargets.delete(target.runtimeInstanceId);
    if (updatedTargets.size === 0) {
      authority.liveTargets.delete(target.sourceNodeId);
    } else {
      authority.liveTargets.set(target.sourceNodeId, updatedTargets);
    }
    authority.liveTargetCount -= 1;
    REGISTRATION_TICKETS.set(
      ticket,
      Object.freeze({ ownerKey: authority.ownerKey, status: "unregistered" }),
    );
    return Object.freeze({
      status: "unregistered",
      sourceNodeId: target.sourceNodeId,
      snapshot: publishSnapshot(authority),
    });
  } finally {
    authority.transitioning = false;
  }
}

/**
 * Executes one guarded Catalog command or allowlisted outbound host event.
 *
 * @remarks The guard is fully decided before the action discriminator or any type-specific
 * property is observed. A command crosses the bridge only for exactly one current live target and
 * a complete Catalog-valid input. An event crosses emission only after the selected host contract
 * validates its detached payload.
 */
export function executeRuntimeCommandEventAction(
  handle: RuntimeCommandEventActionsHandle,
  action: RuntimeCommandEventAction,
  resolutionSnapshot: RuntimeResolutionSnapshot,
  registrySnapshot: RuntimeCommandEventActionsSnapshot,
): RuntimeCommandEventActionResult {
  if (typeof handle !== "object" || handle === null) {
    return Object.freeze({ status: "invalid-handle" });
  }
  const authority = ACTION_AUTHORITIES.get(handle);
  if (authority === undefined) return Object.freeze({ status: "invalid-handle" });
  if (authority.status !== "live") return Object.freeze({ status: "disposed" });
  if (authority.transitioning || authority.reporting) return Object.freeze({ status: "busy" });
  if (registrySnapshot !== authority.snapshot) {
    return Object.freeze({ status: "invalid-snapshot", snapshot: authority.snapshot });
  }
  const requestId = nextRequestId(authority);
  if (requestId === undefined) return Object.freeze({ status: "action-limit" });

  authority.transitioning = true;
  try {
    if (!validResolutionSnapshot(resolutionSnapshot)) {
      return Object.freeze({
        status: "invalid-snapshot",
        snapshot: authority.snapshot,
      });
    }
    let session: RuntimeActionEvaluationSession;
    try {
      session = createRuntimeActionEvaluationSession({
        requestContext: Object.freeze({
          documentId: authority.documentId,
          revision: authority.revision,
          surfaceId: authority.surfaceId,
          requestId,
        }),
        tokens: authority.hostPorts.tokens,
        isActive: () =>
          authority.status === "live" &&
          authority.snapshot === registrySnapshot &&
          authority.transitioning,
      });
    } catch {
      const rejected = guardRejected(authority, "invalid", ROOT_POINTER);
      return observationFailure(authority, registrySnapshot) ?? rejected;
    }

    const capturedWhen = captureRuntimeActionWhen(action);
    const afterWhen = observationFailure(authority, registrySnapshot);
    if (afterWhen !== undefined) return afterWhen;
    if (capturedWhen.status === "invalid") {
      const rejected = guardRejected(authority, "invalid", capturedWhen.pointer);
      return observationFailure(authority, registrySnapshot) ?? rejected;
    }
    const evaluated = evaluateRuntimeActionGuard(session, capturedWhen.when, resolutionSnapshot);
    const afterGuard = observationFailure(authority, registrySnapshot);
    if (afterGuard !== undefined) return afterGuard;
    if (evaluated.status !== "evaluated") {
      const rejected = guardRejected(
        authority,
        evaluated.status === "adapter-failed" ? "adapter-failed" : "invalid",
        evaluated.pointer,
      );
      return observationFailure(authority, registrySnapshot) ?? rejected;
    }
    const guardDiagnostics = predicateDiagnostics(authority, evaluated.diagnostics);
    if (!evaluated.value) {
      return Object.freeze({ status: "skipped", diagnostics: guardDiagnostics });
    }
    if (guardDiagnostics.length > 0) {
      safeReport(authority, guardDiagnostics);
      const afterReport = observationFailure(authority, registrySnapshot);
      if (afterReport !== undefined) return afterReport;
    }

    const plainAction = isPlainRecord(action);
    const afterPrototype = observationFailure(authority, registrySnapshot);
    if (afterPrototype !== undefined) return afterPrototype;
    if (!plainAction) return invalidAction(authority);
    const type = ownDataValue(action, "type");
    const afterType = observationFailure(authority, registrySnapshot);
    if (afterType !== undefined) return afterType;
    if (!type.valid || !type.present || typeof type.value !== "string") {
      return invalidAction(
        authority,
        "The guarded action type is missing or invalid.",
        ROOT_POINTER,
      );
    }

    if (type.value === "component.command") {
      const target = ownDataValue(action, "target");
      const afterTarget = observationFailure(authority, registrySnapshot);
      if (afterTarget !== undefined) return afterTarget;
      if (
        !target.valid ||
        !target.present ||
        typeof target.value !== "string" ||
        !LOCAL_IDENTIFIER_PATTERN.test(target.value)
      ) {
        return invalidAction(
          authority,
          "The component command target is missing or invalid.",
          TARGET_POINTER,
        );
      }
      const capabilityId = authority.staticComponents.get(target.value);
      if (capabilityId === undefined) {
        const diagnostics = Object.freeze([
          coreDiagnostic(
            "UNKNOWN_COMMAND",
            "The component command target is absent from the mounted static inventory.",
            authority,
            TARGET_POINTER,
          ),
        ]);
        safeReport(authority, diagnostics);
        const rejected = Object.freeze({
          status: "unknown-command-target",
          target: target.value,
          diagnostics,
        } as const);
        return observationFailure(authority, registrySnapshot) ?? rejected;
      }

      const command = ownDataValue(action, "command");
      const afterCommand = observationFailure(authority, registrySnapshot);
      if (afterCommand !== undefined) return afterCommand;
      if (
        !command.valid ||
        !command.present ||
        typeof command.value !== "string" ||
        !LOCAL_IDENTIFIER_PATTERN.test(command.value)
      ) {
        return invalidAction(
          authority,
          "The component command name is missing or invalid.",
          COMMAND_POINTER,
        );
      }
      const selector = Object.freeze({
        kind: "component-command-input",
        capabilityId,
        commandName: command.value,
      } as const);
      const declarationProbe = validateDesenExecutionValue(
        Object.freeze({}),
        selector,
        authority.catalogSet,
      );
      const declared =
        authority.componentCommands.get(capabilityId)?.has(command.value) === true &&
        (declarationProbe.valid ||
          (declarationProbe.diagnostics.length > 0 &&
            declarationProbe.diagnostics.every(
              (diagnostic) => diagnostic.code === "COMMAND_INPUT_INVALID",
            )));
      if (!declared) {
        const diagnostics = Object.freeze([
          coreDiagnostic(
            "UNKNOWN_COMMAND",
            "The requested command is not declared by the target component capability.",
            authority,
            COMMAND_POINTER,
          ),
        ]);
        safeReport(authority, diagnostics);
        const rejected = Object.freeze({
          status: "unknown-command",
          target: target.value,
          command: command.value,
          diagnostics,
        } as const);
        return observationFailure(authority, registrySnapshot) ?? rejected;
      }

      const targets = authority.liveTargets.get(target.value);
      if (targets === undefined || targets.size !== 1) {
        const reason = targets === undefined ? "unmounted" : "ambiguous";
        const diagnostics = Object.freeze([
          actionDiagnostic(
            "run.desen.runtime/COMMAND_TARGET_UNAVAILABLE",
            reason === "unmounted"
              ? "The command target has no current live runtime instance."
              : "The command target has multiple live runtime instances and cannot be guessed.",
            authority,
            TARGET_POINTER,
          ),
        ]);
        safeReport(authority, diagnostics);
        const rejected = Object.freeze({
          status: "command-target-unavailable",
          target: target.value,
          reason,
          diagnostics,
        } as const);
        return observationFailure(authority, registrySnapshot) ?? rejected;
      }
      const liveTarget = targets.values().next().value as LiveTarget;

      const validShape =
        exactKeys(action, ["command", "target", "type"], ["extensions", "input", "when"]) &&
        validateExtension(action);
      const afterShape = observationFailure(authority, registrySnapshot);
      if (afterShape !== undefined) return afterShape;
      if (!validShape) return invalidAction(authority);
      const input = ownDataValue(action, "input");
      const afterInputCapture = observationFailure(authority, registrySnapshot);
      if (afterInputCapture !== undefined) return afterInputCapture;
      if (!input.valid) return invalidAction(authority);
      const materialized = materializeRuntimeActionNamedValues(
        session,
        input.present ? input.value : Object.freeze({}),
        resolutionSnapshot,
      );
      const afterMaterialization = observationFailure(authority, registrySnapshot);
      if (afterMaterialization !== undefined) return afterMaterialization;
      if (materialized.status !== "resolved") {
        const rejected = payloadRejected(authority, materialized);
        safeReport(authority, rejected.diagnostics);
        return observationFailure(authority, registrySnapshot) ?? rejected;
      }
      if (!isRuntimeJsonObject(materialized.value)) return invalidAction(authority);
      const validation = validateDesenExecutionValue(
        materialized.value,
        selector,
        authority.catalogSet,
      );
      const afterValidation = observationFailure(authority, registrySnapshot);
      if (afterValidation !== undefined) return afterValidation;
      if (!validation.valid || !isRuntimeJsonObject(validation.value)) {
        const diagnostics = Object.freeze(
          validation.valid
            ? [
                coreDiagnostic(
                  "COMMAND_INPUT_INVALID",
                  "The resolved command input is not a JSON object.",
                  authority,
                  ROOT_POINTER,
                ),
              ]
            : [...validation.diagnostics],
        );
        safeReport(authority, diagnostics);
        const rejected = Object.freeze({
          status: "command-input-rejected",
          target: target.value,
          command: command.value,
          diagnostics,
        } as const);
        return observationFailure(authority, registrySnapshot) ?? rejected;
      }
      const beforeInvoke = observationFailure(authority, registrySnapshot);
      if (beforeInvoke !== undefined) return beforeInvoke;
      const request: RuntimeComponentCommandHostRequest = Object.freeze({
        context: Object.freeze({
          documentId: authority.documentId,
          revision: authority.revision,
          surfaceId: authority.surfaceId,
          requestId,
        }),
        sourceNodeId: target.value,
        runtimeInstanceId: liveTarget.runtimeInstanceId,
        capabilityId,
        command: command.value,
        input: validation.value as RuntimeJsonObject,
      });
      acceptRequest(authority);
      const invoked = invokeRuntimeComponentCommandHostPort(authority.commandEventPorts, request);
      const afterInvoke = observationFailure(authority, registrySnapshot);
      if (afterInvoke !== undefined) return afterInvoke;
      if (invoked.status === "succeeded") {
        return Object.freeze({
          status: "command-succeeded",
          requestId,
          target: target.value,
          command: command.value,
          capabilityId,
          runtimeInstanceId: liveTarget.runtimeInstanceId,
          diagnostics: Object.freeze([...guardDiagnostics]),
        });
      }
      if (invoked.status === "denied") {
        const denial = actionDiagnostic(
          "run.desen.runtime/COMMAND_DENIED",
          "Current host policy denied the component command.",
          authority,
          COMMAND_POINTER,
        );
        safeReport(authority, Object.freeze([denial]));
        const afterDenialReport = observationFailure(authority, registrySnapshot);
        if (afterDenialReport !== undefined) return afterDenialReport;
        return Object.freeze({
          status: "command-denied",
          requestId,
          target: target.value,
          command: command.value,
          capabilityId,
          runtimeInstanceId: liveTarget.runtimeInstanceId,
          diagnostics: Object.freeze([...guardDiagnostics, denial]),
        });
      }
      const failed = adapterFailure(authority, "component.command", requestId);
      return observationFailure(authority, registrySnapshot) ?? failed;
    }

    if (type.value === "event.emit") {
      const name = ownDataValue(action, "name");
      const afterName = observationFailure(authority, registrySnapshot);
      if (afterName !== undefined) return afterName;
      if (
        !name.valid ||
        !name.present ||
        typeof name.value !== "string" ||
        name.value.length === 0 ||
        name.value.length > RUNTIME_VALUE_SAFETY_LIMITS.maxStringCodeUnits ||
        !isCanonicalJsonString(name.value)
      ) {
        return invalidAction(
          authority,
          "The outbound host event name is missing or invalid.",
          NAME_POINTER,
        );
      }
      const contractId = authority.hostEvents.get(name.value);
      if (contractId === undefined) {
        const diagnostics = Object.freeze([
          actionDiagnostic(
            "run.desen.runtime/HOST_EVENT_NOT_ALLOWLISTED",
            "The outbound host event is not allowlisted by the mounted host profile.",
            authority,
            NAME_POINTER,
          ),
        ]);
        safeReport(authority, diagnostics);
        const rejected = Object.freeze({
          status: "host-event-not-allowlisted",
          name: name.value,
          diagnostics,
        } as const);
        return observationFailure(authority, registrySnapshot) ?? rejected;
      }
      const validShape =
        exactKeys(action, ["name", "type"], ["extensions", "payload", "when"]) &&
        validateExtension(action);
      const afterShape = observationFailure(authority, registrySnapshot);
      if (afterShape !== undefined) return afterShape;
      if (!validShape) return invalidAction(authority);
      const payload = ownDataValue(action, "payload");
      const afterPayloadCapture = observationFailure(authority, registrySnapshot);
      if (afterPayloadCapture !== undefined) return afterPayloadCapture;
      if (!payload.valid) return invalidAction(authority);
      const materialized = materializeRuntimeActionNamedValues(
        session,
        payload.present ? payload.value : Object.freeze({}),
        resolutionSnapshot,
      );
      const afterMaterialization = observationFailure(authority, registrySnapshot);
      if (afterMaterialization !== undefined) return afterMaterialization;
      if (materialized.status !== "resolved") {
        const rejected = payloadRejected(authority, materialized);
        safeReport(authority, rejected.diagnostics);
        return observationFailure(authority, registrySnapshot) ?? rejected;
      }
      if (!isRuntimeJsonObject(materialized.value)) return invalidAction(authority);
      const request: RuntimeHostEventRequest = Object.freeze({
        context: Object.freeze({
          documentId: authority.documentId,
          revision: authority.revision,
          surfaceId: authority.surfaceId,
          requestId,
        }),
        name: name.value,
        contractId,
        payload: materialized.value,
      });
      const beforeValidation = observationFailure(authority, registrySnapshot);
      if (beforeValidation !== undefined) return beforeValidation;
      acceptRequest(authority);
      const validation = validateRuntimeHostEventHostPort(authority.commandEventPorts, request);
      const afterHostValidation = observationFailure(authority, registrySnapshot);
      if (afterHostValidation !== undefined) return afterHostValidation;
      if (validation.status === "invalid") {
        const diagnostics = Object.freeze([
          actionDiagnostic(
            "run.desen.runtime/HOST_EVENT_PAYLOAD_INVALID",
            "The outbound event payload failed its selected host contract.",
            authority,
            PAYLOAD_POINTER,
          ),
        ]);
        safeReport(authority, diagnostics);
        const afterInvalidReport = observationFailure(authority, registrySnapshot);
        if (afterInvalidReport !== undefined) return afterInvalidReport;
        return Object.freeze({
          status: "host-event-payload-invalid",
          requestId,
          name: name.value,
          contractId,
          diagnostics,
        });
      }
      if (validation.status !== "valid") {
        const failed = adapterFailure(authority, "event.emit", requestId);
        return observationFailure(authority, registrySnapshot) ?? failed;
      }
      const beforeEmission = observationFailure(authority, registrySnapshot);
      if (beforeEmission !== undefined) return beforeEmission;
      const emitted = emitRuntimeHostEventHostPort(authority.commandEventPorts, request);
      const afterEmission = observationFailure(authority, registrySnapshot);
      if (afterEmission !== undefined) return afterEmission;
      if (emitted.status === "succeeded") {
        return Object.freeze({
          status: "event-emitted",
          requestId,
          name: name.value,
          contractId,
          diagnostics: Object.freeze([...guardDiagnostics]),
        });
      }
      if (emitted.status === "denied") {
        const denial = actionDiagnostic(
          "run.desen.runtime/HOST_EVENT_DENIED",
          "Current host policy denied the outbound host event.",
          authority,
          NAME_POINTER,
        );
        safeReport(authority, Object.freeze([denial]));
        const afterDenialReport = observationFailure(authority, registrySnapshot);
        if (afterDenialReport !== undefined) return afterDenialReport;
        return Object.freeze({
          status: "event-denied",
          requestId,
          name: name.value,
          contractId,
          diagnostics: Object.freeze([...guardDiagnostics, denial]),
        });
      }
      const failed = adapterFailure(authority, "event.emit", requestId);
      return observationFailure(authority, registrySnapshot) ?? failed;
    }

    return invalidAction(
      authority,
      "This primitive accepts only component.command and event.emit.",
      ROOT_POINTER,
    );
  } finally {
    authority.transitioning = false;
  }
}

/**
 * Terminally revokes one command/event manager and every outstanding registration ticket.
 *
 * @remarks Disposal retains only minimal opaque tombstones. No component, platform object,
 * callback request, command input, or event payload survives through the manager authority.
 */
export function disposeRuntimeCommandEventActions(
  handle: RuntimeCommandEventActionsHandle,
): RuntimeCommandEventActionsDisposeResult {
  if (typeof handle !== "object" || handle === null) {
    return Object.freeze({ status: "invalid-handle", disposedTargets: 0 });
  }
  const authority = ACTION_AUTHORITIES.get(handle);
  if (authority === undefined) {
    return Object.freeze({ status: "invalid-handle", disposedTargets: 0 });
  }
  if (authority.status !== "live") {
    return Object.freeze({ status: "already-disposed", disposedTargets: 0 });
  }
  authority.status = "revoked";
  const disposedTargets = authority.liveTargetCount;
  for (const targets of authority.liveTargets.values()) {
    for (const target of targets.values()) {
      REGISTRATION_TICKETS.set(
        target.ticket,
        Object.freeze({ ownerKey: authority.ownerKey, status: "disposed" }),
      );
    }
  }
  authority.liveTargets.clear();
  authority.liveTargetCount = 0;
  ACTION_AUTHORITIES.set(
    handle,
    Object.freeze({ status: "disposed", ownerKey: authority.ownerKey }),
  );
  return Object.freeze({ status: "disposed", disposedTargets });
}
