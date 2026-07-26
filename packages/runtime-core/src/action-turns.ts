import {
  canonicalizeJson,
  createCoreDiagnostic,
  createJsonPointer,
  isSha256Digest,
} from "@desen/protocol";

import {
  disposeRuntimeCommandEventActions,
  executeRuntimeCommandEventAction,
  readRuntimeCommandEventActions,
} from "./command-event-actions.js";
import { createRuntimeHostPorts } from "./host-ports.js";
import { disposeRuntimeSurfaceState, readRuntimeSurfaceState } from "./local-state.js";
import { readRuntimeSurfaceOperations } from "./operation-lifecycle.js";
import {
  disposeRuntimeOperationResourceActions,
  executeRuntimeOperationResourceAction,
  finalizeRuntimeOperationActionSettlement,
  readRuntimeOperationResourceActions,
} from "./operation-resource-actions.js";
import { readRuntimeSurfaceResources } from "./resource-lifecycle.js";
import { isRuntimeJsonObject, snapshotRuntimeJsonValue } from "./runtime-json-snapshot.js";
import {
  disposeRuntimeStateNavigationActions,
  executeRuntimeStateNavigationAction,
  readRuntimeStateNavigationActions,
} from "./state-navigation-actions.js";
import {
  createRuntimeResolutionSnapshot,
  resolveRuntimeValue,
  RUNTIME_VALUE_SAFETY_LIMITS,
} from "./value-resolution.js";

import type { DesenDiagnostic, JsonPointer } from "@desen/protocol";
import type {
  RuntimeCommandEventAction,
  RuntimeCommandEventActionResult,
  RuntimeCommandEventActionsHandle,
  RuntimeCommandEventActionsSnapshot,
} from "./command-event-actions.js";
import type { RuntimeHostPorts, RuntimeJsonObject } from "./host-ports.js";
import type { RuntimeSurfaceStateHandle, RuntimeSurfaceStateSnapshot } from "./local-state.js";
import type {
  RuntimeSurfaceOperationsHandle,
  RuntimeSurfaceOperationsSnapshot,
} from "./operation-lifecycle.js";
import type {
  RuntimeOperationActionSettlementDescriptor,
  RuntimeOperationActionSettlementTicket,
  RuntimeOperationResourceAction,
  RuntimeOperationResourceActionResult,
  RuntimeOperationResourceActionsHandle,
} from "./operation-resource-actions.js";
import type {
  RuntimeResourceSettlement,
  RuntimeSurfaceResourcesHandle,
  RuntimeSurfaceResourcesSnapshot,
} from "./resource-lifecycle.js";
import type {
  RuntimeStateNavigationAction,
  RuntimeStateNavigationActionResult,
  RuntimeStateNavigationActionsHandle,
} from "./state-navigation-actions.js";
import type {
  RuntimeEventReferenceSnapshot,
  RuntimeResolutionSnapshot,
} from "./value-resolution.js";

const LOCAL_IDENTIFIER_PATTERN = /^[A-Za-z][A-Za-z0-9._:-]{0,127}$/u;
const ROOT_POINTER = createJsonPointer();
const EMPTY_DIAGNOSTICS = Object.freeze([]) as readonly DesenDiagnostic<string>[];
const EMPTY_STEPS = Object.freeze([]) as readonly RuntimeActionTurnStep[];
const UNAVAILABLE_EVENT = Object.freeze({
  status: "unavailable",
}) as RuntimeEventReferenceSnapshot;
const KNOWN_ACTION_TYPES = Object.freeze({
  "component.command": "command-event",
  "event.emit": "command-event",
  navigate: "state-navigation",
  "operation.invoke": "operation-resource",
  "resource.refresh": "operation-resource",
  "state.set": "state-navigation",
  "state.toggle": "state-navigation",
} as const);

declare const RUNTIME_ACTION_PROGRAM_TYPE_BRAND: unique symbol;
declare const RUNTIME_ACTION_TURNS_HANDLE_TYPE_BRAND: unique symbol;

/** Reference-profile ceilings for one action-turn coordinator. */
export const RUNTIME_ACTION_TURN_LIMITS = Object.freeze({
  /** Largest number of action entries observed in one turn. */
  maxActionsPerTurn: 64,
  /** Largest nested operation-settlement turn depth. */
  maxSettlementDepth: 16,
  /**
   * Shared queued-event/settlement capacity and independent outstanding settlement-publication
   * capacity.
   */
  maxQueuedTurns: 64,
  /** Largest number of work items processed in one synchronous drain wave. */
  maxSynchronousTurnTransitions: 64,
  /** Largest zero-based accepted turn generation represented exactly. */
  maxTurnGeneration: Number.MAX_SAFE_INTEGER,
  /** Cumulative number of action entries retained by the FIFO. */
  maxRetainedQueuedActions: 4_096,
  /** Cumulative canonical UTF-16 code units retained by queued programs. */
  maxRetainedQueuedCodeUnits: RUNTIME_VALUE_SAFETY_LIMITS.maxStringCodeUnits,
} as const);

/** Optional trusted profile that may only lower action-turn ceilings. */
export interface RuntimeActionTurnLimitProfile {
  readonly maxActionsPerTurn?: number;
  readonly maxSettlementDepth?: number;
  readonly maxQueuedTurns?: number;
  readonly maxSynchronousTurnTransitions?: number;
  readonly maxTurnGeneration?: number;
  readonly maxRetainedQueuedActions?: number;
  readonly maxRetainedQueuedCodeUnits?: number;
}

/**
 * Opaque, bounded, detached action program prepared before an event turn.
 *
 * @remarks The executable actions and their private routes are retained only in package-private
 * WeakMap authority. A structural cast cannot manufacture a runnable program.
 */
export interface RuntimeActionTurnProgram {
  readonly [RUNTIME_ACTION_PROGRAM_TYPE_BRAND]: true;
}

/** Complete result of preparing one hostile-boundary action array. */
export type RuntimeActionTurnProgramPreparationResult =
  | Readonly<{
      readonly status: "prepared";
      readonly program: RuntimeActionTurnProgram;
      readonly actionCount: number;
      readonly overflow: boolean;
    }>
  | Readonly<{
      readonly status: "invalid";
      readonly reason: "malformed-actions" | "program-limit";
      readonly diagnostics: readonly DesenDiagnostic<string>[];
    }>;

/** Trusted composition-root input for one surface-local action coordinator. */
export interface RuntimeActionTurnsMountInput {
  readonly documentId: string;
  readonly revision: string;
  readonly surfaceId: string;
  readonly stateHandle: RuntimeSurfaceStateHandle;
  readonly stateSnapshot: RuntimeSurfaceStateSnapshot;
  readonly resourceHandle: RuntimeSurfaceResourcesHandle;
  readonly resourceSnapshot: RuntimeSurfaceResourcesSnapshot;
  readonly operationHandle: RuntimeSurfaceOperationsHandle;
  readonly operationSnapshot: RuntimeSurfaceOperationsSnapshot;
  readonly stateActionsHandle: RuntimeStateNavigationActionsHandle;
  readonly operationResourceActionsHandle: RuntimeOperationResourceActionsHandle;
  readonly commandEventActionsHandle: RuntimeCommandEventActionsHandle;
  readonly commandEventSnapshot: RuntimeCommandEventActionsSnapshot;
  readonly hostPorts: RuntimeHostPorts;
  readonly limits?: RuntimeActionTurnLimitProfile;
}

/**
 * Opaque authority for one bounded, surface-local action-turn lifetime.
 *
 * @remarks Mounting claims the three child action executors under a trusted exclusive-surrender
 * profile. Direct use of surrendered public child handles is unsupported and detected fail closed.
 */
export interface RuntimeActionTurnsHandle {
  readonly [RUNTIME_ACTION_TURNS_HANDLE_TYPE_BRAND]: true;
}

/** Immutable current snapshot of all four manager domains composed by the coordinator. */
export interface RuntimeActionTurnsSnapshot {
  readonly documentId: string;
  readonly revision: string;
  readonly surfaceId: string;
  readonly generation: number;
  readonly stateSnapshot: RuntimeSurfaceStateSnapshot;
  readonly resourceSnapshot: RuntimeSurfaceResourcesSnapshot;
  readonly operationSnapshot: RuntimeSurfaceOperationsSnapshot;
  readonly commandEventSnapshot: RuntimeCommandEventActionsSnapshot;
}

/** Why the coordinator could not claim all child authorities atomically. */
export type RuntimeActionTurnsMountInvalidReason =
  | "already-owned-authority"
  | "invalid-command-event-authority"
  | "invalid-operation-authority"
  | "invalid-resource-authority"
  | "invalid-state-authority"
  | "malformed-input";

/** Complete atomic mount result for one action-turn coordinator. */
export type RuntimeActionTurnsMountResult =
  | Readonly<{
      readonly status: "mounted";
      readonly handle: RuntimeActionTurnsHandle;
      readonly snapshot: RuntimeActionTurnsSnapshot;
    }>
  | Readonly<{
      readonly status: "invalid";
      readonly reason: RuntimeActionTurnsMountInvalidReason;
      readonly diagnostics: readonly DesenDiagnostic<string>[];
    }>;

/** Public event-turn request; origin and settlement depth remain runtime-owned. */
export interface RuntimeActionTurnRequest {
  readonly program: RuntimeActionTurnProgram;
  readonly snapshot: RuntimeResolutionSnapshot;
}

/** One exact child result recorded in source-array order. */
export interface RuntimeActionTurnStep {
  readonly index: number;
  readonly route: "command-event" | "operation-resource" | "state-navigation" | "unknown";
  readonly result:
    | RuntimeCommandEventActionResult
    | RuntimeOperationResourceActionResult
    | RuntimeStateNavigationActionResult
    | Readonly<{
        readonly status: "unknown-action";
        readonly diagnostics: readonly DesenDiagnostic<string>[];
      }>;
}

/** Stable reasons that stop a turn without rolling back prior accepted effects. */
export type RuntimeActionTurnTerminationReason =
  | "action-failed"
  | "action-limit"
  | "child-busy"
  | "invalid-authority"
  | "invalid-snapshot"
  | "settlement-depth"
  | "snapshot-limit"
  | "transition-limit";

interface RuntimeActionTurnCompletionBase {
  readonly turnId: string;
  readonly origin: "event" | "settlement";
  readonly settlementDepth: number;
  readonly steps: readonly RuntimeActionTurnStep[];
  readonly snapshot: RuntimeActionTurnsSnapshot;
  readonly resolutionSnapshot: RuntimeResolutionSnapshot;
  readonly diagnostics: readonly DesenDiagnostic<string>[];
}

/** Never-rejecting completion delivered after one accepted work item leaves the FIFO. */
export type RuntimeActionTurnCompletion =
  | (RuntimeActionTurnCompletionBase &
      Readonly<{
        readonly status: "completed";
      }>)
  | (RuntimeActionTurnCompletionBase &
      Readonly<{
        readonly status: "terminated";
        readonly reason: RuntimeActionTurnTerminationReason;
      }>)
  | (RuntimeActionTurnCompletionBase &
      Readonly<{
        readonly status: "navigated";
        readonly surface: string;
      }>)
  | (RuntimeActionTurnCompletionBase &
      Readonly<{
        readonly status: "disposed";
      }>);

/** Accepted idle event turn whose FIFO drain begins before the call returns. */
export interface RuntimeActionTurnStarted {
  readonly status: "started";
  readonly turnId: string;
  readonly snapshot: RuntimeActionTurnsSnapshot;
  readonly completion: Promise<RuntimeActionTurnCompletion>;
}

/** Reentrant event turn retained behind the currently draining work item. */
export interface RuntimeActionTurnQueued {
  readonly status: "queued";
  readonly turnId: string;
  readonly position: number;
  readonly snapshot: RuntimeActionTurnsSnapshot;
  readonly completion: Promise<RuntimeActionTurnCompletion>;
}

/** Complete synchronous admission result for one caller-owned event turn. */
export type RuntimeActionTurnExecutionResult =
  | RuntimeActionTurnQueued
  | RuntimeActionTurnStarted
  | Readonly<{
      readonly status: "rejected";
      readonly reason:
        "invalid-request" | "queue-limit" | "retained-limit" | "turn-generation-limit";
      readonly diagnostics: readonly DesenDiagnostic<string>[];
    }>
  | Readonly<{ readonly status: "disposed" }>
  | Readonly<{ readonly status: "invalid-handle" }>;

/** Terminal idempotent result for the coordinator and all surrendered child managers. */
export type RuntimeActionTurnsDisposeResult =
  | Readonly<{
      readonly status: "disposed";
      readonly discardedTurns: number;
      readonly disposedTargets: number;
      readonly disposedResources: number;
      readonly disposedInvocations: number;
      readonly invalidatedLeases: number;
    }>
  | Readonly<{
      readonly status: "already-disposed" | "invalid-handle";
      readonly discardedTurns: 0;
      readonly disposedTargets: 0;
      readonly disposedResources: 0;
      readonly disposedInvocations: 0;
      readonly invalidatedLeases: 0;
    }>;

/**
 * Package-internal classification of a completed asynchronous lifecycle change.
 *
 * @remarks This type is deliberately not re-exported from the package root. It lets the trusted
 * headless composition layer invalidate its callback-free public snapshot without exposing a
 * lower-manager settlement Promise or ticket.
 */
export type RuntimeActionTurnSettlementPublication = "disposed" | "operation" | "resource";

/** Package-internal result of attaching the single trusted settlement publication observer. */
export type RuntimeActionTurnSettlementSubscriptionResult =
  | Readonly<{
      readonly status: "subscribed";
      readonly unsubscribe: () => void;
    }>
  | Readonly<{
      readonly status: "already-subscribed" | "disposed" | "invalid-handle" | "invalid-listener";
    }>;

type ActionRoute = RuntimeActionTurnStep["route"];

interface PreparedActionEntry {
  readonly route: ActionRoute;
  readonly type: string;
  readonly action: RuntimeJsonObject;
  readonly codeUnits: number;
}

interface ProgramAuthority {
  readonly entries: readonly PreparedActionEntry[];
  readonly actionCount: number;
  readonly overflow: boolean;
  readonly retainedCodeUnits: number;
}

interface ResolutionScope {
  readonly context: RuntimeJsonObject;
  readonly env: RuntimeJsonObject;
  readonly event: RuntimeEventReferenceSnapshot;
  readonly item: RuntimeJsonObject;
}

interface ScopeSeed extends ResolutionScope {
  readonly emergencySnapshot: RuntimeResolutionSnapshot;
}

interface SettlementReservation {
  active: boolean;
  readonly turnId: string;
  readonly parentDepth: number;
  readonly scope: ScopeSeed;
}

interface EventWorkItem {
  readonly origin: "event";
  readonly turnId: string;
  readonly depth: 0;
  readonly program: RuntimeActionTurnProgram;
  readonly programAuthority: ProgramAuthority;
  readonly scope: ScopeSeed;
  readonly completion: Promise<RuntimeActionTurnCompletion>;
  readonly emergencyCompletion: RuntimeActionTurnCompletion;
  readonly resolve: (completion: RuntimeActionTurnCompletion) => void;
}

interface SettlementWorkItem {
  readonly origin: "settlement";
  readonly turnId: string;
  readonly depth: number;
  readonly program: RuntimeActionTurnProgram | undefined;
  readonly programAuthority: ProgramAuthority | undefined;
  readonly programFailure: "malformed-actions" | "program-limit" | undefined;
  readonly scope: ScopeSeed;
  readonly descriptor: Extract<
    RuntimeOperationActionSettlementDescriptor,
    { readonly ticket: RuntimeOperationActionSettlementTicket }
  >;
}

type WorkItem = EventWorkItem | SettlementWorkItem;

interface ActionTurnsAuthority {
  status: "live" | "revoked";
  readonly ownerKey: object;
  readonly documentId: string;
  readonly revision: string;
  readonly surfaceId: string;
  readonly stateHandle: RuntimeSurfaceStateHandle;
  readonly resourceHandle: RuntimeSurfaceResourcesHandle;
  readonly operationHandle: RuntimeSurfaceOperationsHandle;
  readonly stateActionsHandle: RuntimeStateNavigationActionsHandle;
  readonly operationResourceActionsHandle: RuntimeOperationResourceActionsHandle;
  readonly commandEventActionsHandle: RuntimeCommandEventActionsHandle;
  readonly hostPorts: RuntimeHostPorts;
  readonly limits: Required<RuntimeActionTurnLimitProfile>;
  stateSnapshot: RuntimeSurfaceStateSnapshot;
  resourceSnapshot: RuntimeSurfaceResourcesSnapshot;
  operationSnapshot: RuntimeSurfaceOperationsSnapshot;
  commandEventSnapshot: RuntimeCommandEventActionsSnapshot;
  snapshot: RuntimeActionTurnsSnapshot;
  nextTurnGeneration: number;
  readonly queue: WorkItem[];
  readonly deferredDisposedEvents: EventWorkItem[];
  readonly settlementReservations: Set<SettlementReservation>;
  reservedSettlementSlots: number;
  retainedQueuedActions: number;
  retainedQueuedCodeUnits: number;
  draining: boolean;
  reporting: boolean;
  settlementObserver:
    | {
        active: boolean;
        readonly listener: (publication: RuntimeActionTurnSettlementPublication) => void;
      }
    | undefined;
  readonly pendingSettlementPublications: RuntimeActionTurnSettlementPublication[];
  settlementPublicationReservations: number;
  settlementPublicationScheduled: boolean;
}

interface ActionTurnsTombstone {
  readonly status: "disposed";
  readonly ownerKey: object;
}

interface CapturedMountInput {
  readonly documentId: string;
  readonly revision: string;
  readonly surfaceId: string;
  readonly stateHandle: RuntimeSurfaceStateHandle;
  readonly stateSnapshot: RuntimeSurfaceStateSnapshot;
  readonly resourceHandle: RuntimeSurfaceResourcesHandle;
  readonly resourceSnapshot: RuntimeSurfaceResourcesSnapshot;
  readonly operationHandle: RuntimeSurfaceOperationsHandle;
  readonly operationSnapshot: RuntimeSurfaceOperationsSnapshot;
  readonly stateActionsHandle: RuntimeStateNavigationActionsHandle;
  readonly operationResourceActionsHandle: RuntimeOperationResourceActionsHandle;
  readonly commandEventActionsHandle: RuntimeCommandEventActionsHandle;
  readonly commandEventSnapshot: RuntimeCommandEventActionsSnapshot;
  readonly hostPorts: RuntimeHostPorts;
  readonly limits: Required<RuntimeActionTurnLimitProfile>;
}

const PROGRAM_AUTHORITIES = new WeakMap<object, ProgramAuthority>();
const TURN_AUTHORITIES = new WeakMap<object, ActionTurnsAuthority | ActionTurnsTombstone>();
const CLAIMED_STATE_ACTIONS = new WeakSet<object>();
const CLAIMED_OPERATION_RESOURCE_ACTIONS = new WeakSet<object>();
const CLAIMED_COMMAND_EVENT_ACTIONS = new WeakSet<object>();
const ATTEMPTED_SETTLEMENT_FINALIZATION_TICKETS = new WeakSet<object>();

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function ownDataValue(
  owner: object,
  key: PropertyKey,
): Readonly<{
  readonly valid: boolean;
  readonly present: boolean;
  readonly value?: unknown;
}> {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(owner, key);
    if (descriptor === undefined) return Object.freeze({ valid: true, present: false });
    return "value" in descriptor
      ? Object.freeze({ valid: true, present: true, value: descriptor.value })
      : Object.freeze({ valid: false, present: true });
  } catch {
    return Object.freeze({ valid: false, present: false });
  }
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

function exactKeys(
  value: object,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean {
  try {
    const keys = Reflect.ownKeys(value);
    if (keys.some((key) => typeof key !== "string")) return false;
    const actual = (keys as string[]).sort(compareText);
    const allowed = [...required, ...optional].sort(compareText);
    if (actual.some((key) => !allowed.includes(key))) return false;
    return required.every((key) => actual.includes(key));
  } catch {
    return false;
  }
}

function diagnostic(
  code: string,
  message: string,
  context?: Readonly<{ readonly documentId: string; readonly surfaceId: string }>,
  pointer: JsonPointer = ROOT_POINTER,
): DesenDiagnostic<string> {
  return Object.freeze({
    code,
    message,
    pointer,
    ...(context === undefined
      ? {}
      : {
          context: Object.freeze({
            documentId: context.documentId,
            surfaceId: context.surfaceId,
          }),
        }),
  });
}

function actionLimitDiagnostic(
  authority: Pick<ActionTurnsAuthority, "documentId" | "surfaceId">,
  message: string,
  pointer: JsonPointer = ROOT_POINTER,
): DesenDiagnostic<string> {
  return createCoreDiagnostic({
    code: "ACTION_LIMIT_EXCEEDED",
    message,
    pointer,
    context: {
      documentId: authority.documentId,
      surfaceId: authority.surfaceId,
    },
  });
}

function safeReport(
  authority: ActionTurnsAuthority,
  diagnostics: readonly DesenDiagnostic<string>[],
): void {
  if (authority.reporting) return;
  authority.reporting = true;
  try {
    for (const item of diagnostics) {
      if (authority.status !== "live") break;
      try {
        Reflect.apply(authority.hostPorts.diagnostics.report, undefined, [item]);
      } catch {
        // Diagnostics are observational and cannot change the controlled result.
      }
    }
  } finally {
    authority.reporting = false;
  }
}

function boundedInteger(value: unknown, ceiling: number): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= ceiling
    ? value
    : undefined;
}

function captureLimits(input: unknown): Required<RuntimeActionTurnLimitProfile> | undefined {
  const defaults = RUNTIME_ACTION_TURN_LIMITS;
  if (input === undefined) return Object.freeze({ ...defaults });
  if (
    !isPlainRecord(input) ||
    !exactKeys(
      input,
      [],
      [
        "maxActionsPerTurn",
        "maxQueuedTurns",
        "maxRetainedQueuedActions",
        "maxRetainedQueuedCodeUnits",
        "maxSettlementDepth",
        "maxSynchronousTurnTransitions",
        "maxTurnGeneration",
      ],
    )
  ) {
    return undefined;
  }
  const captured: Record<string, number> = {};
  for (const key of Object.keys(defaults) as (keyof typeof defaults)[]) {
    const value = ownDataValue(input, key);
    if (!value.valid) return undefined;
    const next = value.present ? boundedInteger(value.value, defaults[key]) : defaults[key];
    if (next === undefined) return undefined;
    captured[key] = next;
  }
  return Object.freeze(captured) as Required<RuntimeActionTurnLimitProfile>;
}

function makeSnapshot(
  authority: Pick<
    ActionTurnsAuthority,
    | "commandEventSnapshot"
    | "documentId"
    | "operationSnapshot"
    | "resourceSnapshot"
    | "revision"
    | "stateSnapshot"
    | "surfaceId"
  >,
  generation: number,
): RuntimeActionTurnsSnapshot {
  return Object.freeze({
    documentId: authority.documentId,
    revision: authority.revision,
    surfaceId: authority.surfaceId,
    generation,
    stateSnapshot: authority.stateSnapshot,
    resourceSnapshot: authority.resourceSnapshot,
    operationSnapshot: authority.operationSnapshot,
    commandEventSnapshot: authority.commandEventSnapshot,
  });
}

function publishSnapshot(authority: ActionTurnsAuthority): RuntimeActionTurnsSnapshot {
  authority.snapshot = makeSnapshot(authority, authority.snapshot.generation + 1);
  return authority.snapshot;
}

function routeForType(type: string): ActionRoute {
  return (KNOWN_ACTION_TYPES as Readonly<Record<string, ActionRoute>>)[type] ?? "unknown";
}

/**
 * Prepares at most the first 64 action descriptors without observing or retaining index 64 or any
 * later suffix.
 *
 * @remarks The array is never spread, mapped, or iterated. Every captured index is read through
 * its own data descriptor, copied through the shared bounded JSON boundary, recursively frozen,
 * and assigned a private route. An own length above 64 is retained only as an overflow marker.
 */
export function prepareRuntimeActionProgram(
  actions: readonly unknown[],
): RuntimeActionTurnProgramPreparationResult {
  if (!Array.isArray(actions)) {
    return Object.freeze({
      status: "invalid",
      reason: "malformed-actions",
      diagnostics: EMPTY_DIAGNOSTICS,
    });
  }
  const length = ownDataValue(actions, "length");
  if (
    !length.valid ||
    !length.present ||
    typeof length.value !== "number" ||
    !Number.isSafeInteger(length.value) ||
    length.value < 0
  ) {
    return Object.freeze({
      status: "invalid",
      reason: "malformed-actions",
      diagnostics: EMPTY_DIAGNOSTICS,
    });
  }

  const capturedCount = Math.min(length.value, RUNTIME_ACTION_TURN_LIMITS.maxActionsPerTurn);
  const entries: PreparedActionEntry[] = [];
  let retainedCodeUnits = 0;
  for (let index = 0; index < capturedCount; index += 1) {
    const entry = ownDataValue(actions, String(index));
    if (!entry.valid || !entry.present) {
      return Object.freeze({
        status: "invalid",
        reason: "malformed-actions",
        diagnostics: EMPTY_DIAGNOSTICS,
      });
    }
    const copied = snapshotRuntimeJsonValue(entry.value);
    if (!isRuntimeJsonObject(copied)) {
      return Object.freeze({
        status: "invalid",
        reason: "malformed-actions",
        diagnostics: EMPTY_DIAGNOSTICS,
      });
    }
    const type = ownDataValue(copied, "type");
    if (!type.valid || !type.present || typeof type.value !== "string") {
      return Object.freeze({
        status: "invalid",
        reason: "malformed-actions",
        diagnostics: EMPTY_DIAGNOSTICS,
      });
    }
    let codeUnits: number;
    try {
      codeUnits = canonicalizeJson(copied).length;
    } catch {
      return Object.freeze({
        status: "invalid",
        reason: "malformed-actions",
        diagnostics: EMPTY_DIAGNOSTICS,
      });
    }
    retainedCodeUnits += codeUnits;
    if (retainedCodeUnits > RUNTIME_ACTION_TURN_LIMITS.maxRetainedQueuedCodeUnits) {
      return Object.freeze({
        status: "invalid",
        reason: "program-limit",
        diagnostics: EMPTY_DIAGNOSTICS,
      });
    }
    entries.push(
      Object.freeze({
        route: routeForType(type.value),
        type: type.value,
        action: copied,
        codeUnits,
      }),
    );
  }

  const authority: ProgramAuthority = Object.freeze({
    entries: Object.freeze(entries),
    actionCount: length.value,
    overflow: length.value > RUNTIME_ACTION_TURN_LIMITS.maxActionsPerTurn,
    retainedCodeUnits,
  });
  const program = Object.freeze({}) as RuntimeActionTurnProgram;
  PROGRAM_AUTHORITIES.set(program, authority);
  return Object.freeze({
    status: "prepared",
    program,
    actionCount: authority.actionCount,
    overflow: authority.overflow,
  });
}

function captureMountInput(input: RuntimeActionTurnsMountInput): CapturedMountInput | undefined {
  if (
    !isPlainRecord(input) ||
    !exactKeys(
      input,
      [
        "commandEventActionsHandle",
        "commandEventSnapshot",
        "documentId",
        "hostPorts",
        "operationHandle",
        "operationResourceActionsHandle",
        "operationSnapshot",
        "resourceHandle",
        "resourceSnapshot",
        "revision",
        "stateActionsHandle",
        "stateHandle",
        "stateSnapshot",
        "surfaceId",
      ],
      ["limits"],
    )
  ) {
    return undefined;
  }
  const keys = [
    "commandEventActionsHandle",
    "commandEventSnapshot",
    "documentId",
    "hostPorts",
    "limits",
    "operationHandle",
    "operationResourceActionsHandle",
    "operationSnapshot",
    "resourceHandle",
    "resourceSnapshot",
    "revision",
    "stateActionsHandle",
    "stateHandle",
    "stateSnapshot",
    "surfaceId",
  ] as const;
  const values = Object.fromEntries(keys.map((key) => [key, ownDataValue(input, key)])) as Record<
    (typeof keys)[number],
    ReturnType<typeof ownDataValue>
  >;
  if (
    Object.entries(values).some(
      ([key, value]) => !value.valid || (key !== "limits" && !value.present),
    )
  ) {
    return undefined;
  }
  const limits = captureLimits(values.limits.present ? values.limits.value : undefined);
  if (
    limits === undefined ||
    typeof values.documentId.value !== "string" ||
    values.documentId.value.length === 0 ||
    values.documentId.value.length > RUNTIME_VALUE_SAFETY_LIMITS.maxStringCodeUnits ||
    typeof values.revision.value !== "string" ||
    !isSha256Digest(values.revision.value) ||
    typeof values.surfaceId.value !== "string" ||
    !LOCAL_IDENTIFIER_PATTERN.test(values.surfaceId.value)
  ) {
    return undefined;
  }
  return Object.freeze({
    documentId: values.documentId.value,
    revision: values.revision.value,
    surfaceId: values.surfaceId.value,
    stateHandle: values.stateHandle.value as RuntimeSurfaceStateHandle,
    stateSnapshot: values.stateSnapshot.value as RuntimeSurfaceStateSnapshot,
    resourceHandle: values.resourceHandle.value as RuntimeSurfaceResourcesHandle,
    resourceSnapshot: values.resourceSnapshot.value as RuntimeSurfaceResourcesSnapshot,
    operationHandle: values.operationHandle.value as RuntimeSurfaceOperationsHandle,
    operationSnapshot: values.operationSnapshot.value as RuntimeSurfaceOperationsSnapshot,
    stateActionsHandle: values.stateActionsHandle.value as RuntimeStateNavigationActionsHandle,
    operationResourceActionsHandle: values.operationResourceActionsHandle
      .value as RuntimeOperationResourceActionsHandle,
    commandEventActionsHandle: values.commandEventActionsHandle
      .value as RuntimeCommandEventActionsHandle,
    commandEventSnapshot: values.commandEventSnapshot.value as RuntimeCommandEventActionsSnapshot,
    hostPorts: values.hostPorts.value as RuntimeHostPorts,
    limits,
  });
}

function invalidMount(reason: RuntimeActionTurnsMountInvalidReason): RuntimeActionTurnsMountResult {
  return Object.freeze({ status: "invalid", reason, diagnostics: EMPTY_DIAGNOSTICS });
}

function identitiesMatch(
  documentId: string,
  revision: string,
  surfaceId: string,
  resource: RuntimeSurfaceResourcesSnapshot,
  operation: RuntimeSurfaceOperationsSnapshot,
  commandEvent: RuntimeCommandEventActionsSnapshot,
): boolean {
  return (
    resource.documentId === documentId &&
    resource.revision === revision &&
    resource.surfaceId === surfaceId &&
    operation.documentId === documentId &&
    operation.revision === revision &&
    operation.surfaceId === surfaceId &&
    commandEvent.documentId === documentId &&
    commandEvent.revision === revision &&
    commandEvent.surfaceId === surfaceId
  );
}

/** Mounts one exclusive coordinator over exact current T06/T08/T09/T10/T11/T12 authorities. */
export function mountRuntimeActionTurns(
  input: RuntimeActionTurnsMountInput,
): RuntimeActionTurnsMountResult {
  const captured = captureMountInput(input);
  if (captured === undefined) return invalidMount("malformed-input");
  if (
    typeof captured.stateActionsHandle !== "object" ||
    captured.stateActionsHandle === null ||
    typeof captured.operationResourceActionsHandle !== "object" ||
    captured.operationResourceActionsHandle === null ||
    typeof captured.commandEventActionsHandle !== "object" ||
    captured.commandEventActionsHandle === null
  ) {
    return invalidMount("malformed-input");
  }
  if (
    CLAIMED_STATE_ACTIONS.has(captured.stateActionsHandle) ||
    CLAIMED_OPERATION_RESOURCE_ACTIONS.has(captured.operationResourceActionsHandle) ||
    CLAIMED_COMMAND_EVENT_ACTIONS.has(captured.commandEventActionsHandle)
  ) {
    return invalidMount("already-owned-authority");
  }

  const state = readRuntimeSurfaceState(captured.stateHandle);
  if (
    state.status !== "active" ||
    state.snapshot !== captured.stateSnapshot ||
    state.snapshot.surfaceId !== captured.surfaceId
  ) {
    return invalidMount("invalid-state-authority");
  }
  const stateActions = readRuntimeStateNavigationActions(captured.stateActionsHandle);
  if (
    stateActions.status !== "read" ||
    stateActions.documentId !== captured.documentId ||
    stateActions.revision !== captured.revision ||
    stateActions.surfaceId !== captured.surfaceId ||
    stateActions.stateSnapshot !== state.snapshot
  ) {
    return invalidMount("invalid-state-authority");
  }
  const resource = readRuntimeSurfaceResources(captured.resourceHandle);
  if (resource.status !== "read" || resource.snapshot !== captured.resourceSnapshot) {
    return invalidMount("invalid-resource-authority");
  }
  const operation = readRuntimeSurfaceOperations(captured.operationHandle);
  if (operation.status !== "read" || operation.snapshot !== captured.operationSnapshot) {
    return invalidMount("invalid-operation-authority");
  }
  const operationResourceActions = readRuntimeOperationResourceActions(
    captured.operationResourceActionsHandle,
  );
  if (
    operationResourceActions.status !== "read" ||
    operationResourceActions.documentId !== captured.documentId ||
    operationResourceActions.revision !== captured.revision ||
    operationResourceActions.surfaceId !== captured.surfaceId ||
    operationResourceActions.resourceSnapshot !== resource.snapshot ||
    operationResourceActions.operationSnapshot !== operation.snapshot
  ) {
    return invalidMount(
      operationResourceActions.status === "invalid-authority" &&
        operationResourceActions.boundary === "resource"
        ? "invalid-resource-authority"
        : "invalid-operation-authority",
    );
  }
  const commandEvent = readRuntimeCommandEventActions(captured.commandEventActionsHandle);
  if (commandEvent.status !== "read" || commandEvent.snapshot !== captured.commandEventSnapshot) {
    return invalidMount("invalid-command-event-authority");
  }
  if (
    !identitiesMatch(
      captured.documentId,
      captured.revision,
      captured.surfaceId,
      resource.snapshot,
      operation.snapshot,
      commandEvent.snapshot,
    )
  ) {
    return invalidMount("malformed-input");
  }

  let hostPorts: RuntimeHostPorts;
  try {
    hostPorts = createRuntimeHostPorts(captured.hostPorts);
  } catch {
    return invalidMount("malformed-input");
  }
  const recapturedState = readRuntimeSurfaceState(captured.stateHandle);
  const recapturedStateActions = readRuntimeStateNavigationActions(captured.stateActionsHandle);
  const recapturedResource = readRuntimeSurfaceResources(captured.resourceHandle);
  const recapturedOperation = readRuntimeSurfaceOperations(captured.operationHandle);
  const recapturedOperationResourceActions = readRuntimeOperationResourceActions(
    captured.operationResourceActionsHandle,
  );
  const recapturedCommandEvent = readRuntimeCommandEventActions(captured.commandEventActionsHandle);
  if (recapturedState.status !== "active" || recapturedState.snapshot !== state.snapshot) {
    return invalidMount("invalid-state-authority");
  }
  if (recapturedResource.status !== "read" || recapturedResource.snapshot !== resource.snapshot) {
    return invalidMount("invalid-resource-authority");
  }
  if (
    recapturedOperation.status !== "read" ||
    recapturedOperation.snapshot !== operation.snapshot
  ) {
    return invalidMount("invalid-operation-authority");
  }
  if (
    recapturedStateActions.status !== "read" ||
    recapturedStateActions.documentId !== captured.documentId ||
    recapturedStateActions.revision !== captured.revision ||
    recapturedStateActions.surfaceId !== captured.surfaceId ||
    recapturedStateActions.stateSnapshot !== recapturedState.snapshot ||
    recapturedStateActions.stateSnapshot !== stateActions.stateSnapshot
  ) {
    return invalidMount("invalid-state-authority");
  }
  if (
    recapturedOperationResourceActions.status !== "read" ||
    recapturedOperationResourceActions.documentId !== captured.documentId ||
    recapturedOperationResourceActions.revision !== captured.revision ||
    recapturedOperationResourceActions.surfaceId !== captured.surfaceId ||
    recapturedOperationResourceActions.resourceSnapshot !== recapturedResource.snapshot ||
    recapturedOperationResourceActions.operationSnapshot !== recapturedOperation.snapshot ||
    recapturedOperationResourceActions.resourceSnapshot !==
      operationResourceActions.resourceSnapshot ||
    recapturedOperationResourceActions.operationSnapshot !==
      operationResourceActions.operationSnapshot
  ) {
    return invalidMount(
      recapturedOperationResourceActions.status === "invalid-authority" &&
        recapturedOperationResourceActions.boundary === "resource"
        ? "invalid-resource-authority"
        : "invalid-operation-authority",
    );
  }
  if (
    recapturedCommandEvent.status !== "read" ||
    recapturedCommandEvent.snapshot !== commandEvent.snapshot
  ) {
    return invalidMount("invalid-command-event-authority");
  }
  if (
    CLAIMED_STATE_ACTIONS.has(captured.stateActionsHandle) ||
    CLAIMED_OPERATION_RESOURCE_ACTIONS.has(captured.operationResourceActionsHandle) ||
    CLAIMED_COMMAND_EVENT_ACTIONS.has(captured.commandEventActionsHandle)
  ) {
    return invalidMount("already-owned-authority");
  }

  const authority = {
    status: "live",
    ownerKey: Object.freeze({}),
    documentId: captured.documentId,
    revision: captured.revision,
    surfaceId: captured.surfaceId,
    stateHandle: captured.stateHandle,
    resourceHandle: captured.resourceHandle,
    operationHandle: captured.operationHandle,
    stateActionsHandle: captured.stateActionsHandle,
    operationResourceActionsHandle: captured.operationResourceActionsHandle,
    commandEventActionsHandle: captured.commandEventActionsHandle,
    hostPorts,
    limits: captured.limits,
    stateSnapshot: state.snapshot,
    resourceSnapshot: resource.snapshot,
    operationSnapshot: operation.snapshot,
    commandEventSnapshot: commandEvent.snapshot,
    snapshot: undefined as unknown as RuntimeActionTurnsSnapshot,
    nextTurnGeneration: 0,
    queue: [],
    deferredDisposedEvents: [],
    settlementReservations: new Set(),
    reservedSettlementSlots: 0,
    retainedQueuedActions: 0,
    retainedQueuedCodeUnits: 0,
    draining: false,
    reporting: false,
    settlementObserver: undefined,
    pendingSettlementPublications: [],
    settlementPublicationReservations: 0,
    settlementPublicationScheduled: false,
  } satisfies ActionTurnsAuthority;
  authority.snapshot = makeSnapshot(authority, 0);
  const handle = Object.freeze({}) as RuntimeActionTurnsHandle;
  CLAIMED_STATE_ACTIONS.add(captured.stateActionsHandle);
  CLAIMED_OPERATION_RESOURCE_ACTIONS.add(captured.operationResourceActionsHandle);
  CLAIMED_COMMAND_EVENT_ACTIONS.add(captured.commandEventActionsHandle);
  TURN_AUTHORITIES.set(handle, authority);
  return Object.freeze({ status: "mounted", handle, snapshot: authority.snapshot });
}

function reserveSettlementPublication(authority: ActionTurnsAuthority): boolean {
  if (
    authority.settlementPublicationReservations >= authority.limits.maxQueuedTurns ||
    authority.pendingSettlementPublications.length >= authority.limits.maxQueuedTurns
  ) {
    return false;
  }
  authority.settlementPublicationReservations += 1;
  return true;
}

function releaseSettlementPublication(authority: ActionTurnsAuthority): void {
  if (authority.settlementPublicationReservations > 0) {
    authority.settlementPublicationReservations -= 1;
  }
}

function scheduleSettlementPublication(
  handle: RuntimeActionTurnsHandle,
  authority: ActionTurnsAuthority,
  publication: RuntimeActionTurnSettlementPublication,
): void {
  if (authority.status !== "live") return;
  if (authority.settlementPublicationReservations === 0) {
    containCoordinatorFailure(handle, authority);
    return;
  }
  if (authority.settlementObserver === undefined) {
    releaseSettlementPublication(authority);
    return;
  }
  if (authority.pendingSettlementPublications.length >= authority.limits.maxQueuedTurns) {
    containCoordinatorFailure(handle, authority);
    return;
  }
  authority.pendingSettlementPublications.push(publication);
  if (authority.settlementPublicationScheduled) return;
  authority.settlementPublicationScheduled = true;
  void Promise.resolve().then(() => {
    authority.settlementPublicationScheduled = false;
    const pending = authority.pendingSettlementPublications.splice(0);
    const observer = authority.settlementObserver;
    for (const current of pending) {
      releaseSettlementPublication(authority);
      if (
        authority.status !== "live" ||
        observer === undefined ||
        authority.settlementObserver !== observer ||
        !observer.active
      ) {
        continue;
      }
      try {
        Reflect.apply(observer.listener, undefined, [current]);
      } catch {
        // The trusted composition layer owns fail-closed session disposal. T13 contains the
        // observer boundary and never lets one callback corrupt its FIFO or another publication.
      }
    }
  });
}

/**
 * Attaches the trusted composition layer's single asynchronous settlement publication observer.
 *
 * @remarks The listener is invoked only from a microtask after the corresponding coordinator
 * update and recursive settlement work have left the synchronous FIFO drain. Operation and
 * resource completions retain FIFO order and each accepted completion produces exactly one
 * callback. The finite pending queue is pre-reserved before its asynchronous effect begins, the
 * callback receives no lower authority, and the returned revoker is idempotent. This module-level
 * seam is intentionally absent from the package root.
 */
export function subscribeRuntimeActionTurnSettlements(
  handle: RuntimeActionTurnsHandle,
  listener: (publication: RuntimeActionTurnSettlementPublication) => void,
): RuntimeActionTurnSettlementSubscriptionResult {
  if (typeof handle !== "object" || handle === null) {
    return Object.freeze({ status: "invalid-handle" });
  }
  if (typeof listener !== "function") return Object.freeze({ status: "invalid-listener" });
  const authority = TURN_AUTHORITIES.get(handle);
  if (authority === undefined) return Object.freeze({ status: "invalid-handle" });
  if (authority.status !== "live") return Object.freeze({ status: "disposed" });
  if (authority.settlementObserver !== undefined) {
    return Object.freeze({ status: "already-subscribed" });
  }
  const observer = { active: true, listener };
  authority.settlementObserver = observer;
  return Object.freeze({
    status: "subscribed",
    unsubscribe: () => {
      if (!observer.active) return;
      observer.active = false;
      if (authority.settlementObserver === observer) {
        authority.settlementObserver = undefined;
        const discarded = authority.pendingSettlementPublications.splice(0).length;
        for (let index = 0; index < discarded; index += 1) {
          releaseSettlementPublication(authority);
        }
      }
    },
  });
}

type FreshReadResult =
  | Readonly<{ readonly status: "fresh" }>
  | Readonly<{ readonly status: "disposed" }>
  | Readonly<{ readonly status: "invalid" }>;

function monotonicSnapshot(
  current: { readonly generation: number },
  candidate: { readonly generation: number },
): "current" | "newer" | "invalid" {
  if (candidate.generation < current.generation) return "invalid";
  if (candidate.generation === current.generation) {
    return candidate === current ? "current" : "invalid";
  }
  return "newer";
}

function refreshManagedSnapshots(authority: ActionTurnsAuthority): FreshReadResult {
  if (authority.status !== "live") return Object.freeze({ status: "disposed" });
  const stateActions = readRuntimeStateNavigationActions(authority.stateActionsHandle);
  const operationResourceActions = readRuntimeOperationResourceActions(
    authority.operationResourceActionsHandle,
  );
  const commandEventActions = readRuntimeCommandEventActions(authority.commandEventActionsHandle);
  const state = readRuntimeSurfaceState(authority.stateHandle);
  const resource = readRuntimeSurfaceResources(authority.resourceHandle);
  const operation = readRuntimeSurfaceOperations(authority.operationHandle);

  if (
    stateActions.status === "disposed" ||
    stateActions.status === "navigated" ||
    operationResourceActions.status === "disposed" ||
    operationResourceActions.status === "resource-disposed" ||
    operationResourceActions.status === "operation-disposed" ||
    commandEventActions.status === "disposed" ||
    state.status === "disposed" ||
    resource.status === "disposed" ||
    operation.status === "disposed"
  ) {
    return Object.freeze({ status: "disposed" });
  }
  if (
    stateActions.status !== "read" ||
    operationResourceActions.status !== "read" ||
    commandEventActions.status !== "read" ||
    state.status !== "active" ||
    resource.status !== "read" ||
    operation.status !== "read"
  ) {
    return Object.freeze({ status: "invalid" });
  }
  if (
    stateActions.documentId !== authority.documentId ||
    stateActions.revision !== authority.revision ||
    stateActions.surfaceId !== authority.surfaceId ||
    operationResourceActions.documentId !== authority.documentId ||
    operationResourceActions.revision !== authority.revision ||
    operationResourceActions.surfaceId !== authority.surfaceId ||
    stateActions.stateSnapshot !== state.snapshot ||
    operationResourceActions.resourceSnapshot !== resource.snapshot ||
    operationResourceActions.operationSnapshot !== operation.snapshot ||
    !identitiesMatch(
      authority.documentId,
      authority.revision,
      authority.surfaceId,
      resource.snapshot,
      operation.snapshot,
      commandEventActions.snapshot,
    )
  ) {
    return Object.freeze({ status: "invalid" });
  }
  const stateOrder = monotonicSnapshot(authority.stateSnapshot, state.snapshot);
  const resourceOrder = monotonicSnapshot(authority.resourceSnapshot, resource.snapshot);
  const operationOrder = monotonicSnapshot(authority.operationSnapshot, operation.snapshot);
  const commandOrder = monotonicSnapshot(
    authority.commandEventSnapshot,
    commandEventActions.snapshot,
  );
  if (
    stateOrder === "invalid" ||
    resourceOrder === "invalid" ||
    operationOrder === "invalid" ||
    commandOrder === "invalid"
  ) {
    return Object.freeze({ status: "invalid" });
  }
  const changed =
    stateOrder === "newer" ||
    resourceOrder === "newer" ||
    operationOrder === "newer" ||
    commandOrder === "newer";
  authority.stateSnapshot = state.snapshot;
  authority.resourceSnapshot = resource.snapshot;
  authority.operationSnapshot = operation.snapshot;
  authority.commandEventSnapshot = commandEventActions.snapshot;
  if (changed) publishSnapshot(authority);
  return Object.freeze({ status: "fresh" });
}

function updateStateSnapshot(
  authority: ActionTurnsAuthority,
  candidate: RuntimeSurfaceStateSnapshot,
): boolean {
  const order = monotonicSnapshot(authority.stateSnapshot, candidate);
  if (order === "invalid") return false;
  if (order === "newer") {
    authority.stateSnapshot = candidate;
    publishSnapshot(authority);
  }
  return true;
}

function updateResourceSnapshot(
  authority: ActionTurnsAuthority,
  candidate: RuntimeSurfaceResourcesSnapshot,
): boolean {
  const order = monotonicSnapshot(authority.resourceSnapshot, candidate);
  if (order === "invalid") return false;
  if (order === "newer") {
    authority.resourceSnapshot = candidate;
    publishSnapshot(authority);
  }
  return true;
}

function updateOperationSnapshot(
  authority: ActionTurnsAuthority,
  candidate: RuntimeSurfaceOperationsSnapshot,
): boolean {
  const order = monotonicSnapshot(authority.operationSnapshot, candidate);
  if (order === "invalid") return false;
  if (order === "newer") {
    authority.operationSnapshot = candidate;
    publishSnapshot(authority);
  }
  return true;
}

function updateCommandEventSnapshot(
  authority: ActionTurnsAuthority,
  candidate: RuntimeCommandEventActionsSnapshot,
): boolean {
  const order = monotonicSnapshot(authority.commandEventSnapshot, candidate);
  if (order === "invalid") return false;
  if (order === "newer") {
    authority.commandEventSnapshot = candidate;
    publishSnapshot(authority);
  }
  return true;
}

function captureScopeSeed(snapshot: RuntimeResolutionSnapshot): ScopeSeed | undefined {
  try {
    if (resolveRuntimeValue(null, snapshot).status !== "resolved") return undefined;
    return Object.freeze({
      context: snapshot.context,
      env: snapshot.env,
      event: snapshot.event,
      item: snapshot.item,
      emergencySnapshot: snapshot,
    });
  } catch {
    return undefined;
  }
}

function composeResolutionSnapshot(
  authority: ActionTurnsAuthority,
  scope: ResolutionScope,
): RuntimeResolutionSnapshot | undefined {
  try {
    return createRuntimeResolutionSnapshot({
      state: authority.stateSnapshot.values,
      context: scope.context,
      resource: authority.resourceSnapshot.lifecycles,
      operation: authority.operationSnapshot.lifecycles,
      event: scope.event,
      item: scope.item,
      env: scope.env,
    });
  } catch {
    return undefined;
  }
}

function nextTurnId(authority: ActionTurnsAuthority): string | undefined {
  const generation = authority.nextTurnGeneration;
  if (!Number.isSafeInteger(generation) || generation > authority.limits.maxTurnGeneration) {
    return undefined;
  }
  authority.nextTurnGeneration += 1;
  return `action-turn:${canonicalizeJson([authority.surfaceId, generation])}`;
}

function queueSize(authority: ActionTurnsAuthority): number {
  return authority.queue.length + authority.reservedSettlementSlots;
}

function retainProgram(authority: ActionTurnsAuthority, program: ProgramAuthority): boolean {
  if (
    authority.retainedQueuedActions + program.entries.length >
      authority.limits.maxRetainedQueuedActions ||
    authority.retainedQueuedCodeUnits + program.retainedCodeUnits >
      authority.limits.maxRetainedQueuedCodeUnits
  ) {
    return false;
  }
  authority.retainedQueuedActions += program.entries.length;
  authority.retainedQueuedCodeUnits += program.retainedCodeUnits;
  return true;
}

function releaseProgram(authority: ActionTurnsAuthority, program: ProgramAuthority): void {
  authority.retainedQueuedActions -= program.entries.length;
  authority.retainedQueuedCodeUnits -= program.retainedCodeUnits;
}

function captureRequest(request: RuntimeActionTurnRequest):
  | Readonly<{
      readonly program: RuntimeActionTurnProgram;
      readonly programAuthority: ProgramAuthority;
      readonly scope: ScopeSeed;
    }>
  | undefined {
  if (!isPlainRecord(request) || !exactKeys(request, ["program", "snapshot"])) return undefined;
  const program = ownDataValue(request, "program");
  const snapshot = ownDataValue(request, "snapshot");
  if (
    !program.valid ||
    !program.present ||
    typeof program.value !== "object" ||
    program.value === null ||
    !snapshot.valid ||
    !snapshot.present
  ) {
    return undefined;
  }
  const programAuthority = PROGRAM_AUTHORITIES.get(program.value);
  const scope = captureScopeSeed(snapshot.value as RuntimeResolutionSnapshot);
  if (programAuthority === undefined || scope === undefined || scope.event.status !== "available") {
    return undefined;
  }
  return Object.freeze({
    program: program.value as RuntimeActionTurnProgram,
    programAuthority,
    scope,
  });
}

function reserveSettlement(
  authority: ActionTurnsAuthority,
  depth: number,
  scope: ScopeSeed,
): SettlementReservation | undefined {
  if (depth >= authority.limits.maxSettlementDepth) return undefined;
  if (queueSize(authority) >= authority.limits.maxQueuedTurns) return undefined;
  const settlementScope: ResolutionScope = Object.freeze({
    context: scope.context,
    env: scope.env,
    event: UNAVAILABLE_EVENT,
    item: scope.item,
  });
  const emergencySnapshot = composeResolutionSnapshot(authority, settlementScope);
  if (emergencySnapshot === undefined) return undefined;
  const turnId = nextTurnId(authority);
  if (turnId === undefined) return undefined;
  if (!reserveSettlementPublication(authority)) return undefined;
  authority.reservedSettlementSlots += 1;
  const reservation = {
    active: true,
    turnId,
    parentDepth: depth,
    scope: Object.freeze({
      ...settlementScope,
      emergencySnapshot,
    }),
  };
  authority.settlementReservations.add(reservation);
  return reservation;
}

function releaseSettlementReservation(
  authority: ActionTurnsAuthority,
  reservation: SettlementReservation,
): void {
  if (!reservation.active) return;
  reservation.active = false;
  authority.settlementReservations.delete(reservation);
  authority.reservedSettlementSlots -= 1;
}

function abandonSettlementReservation(
  authority: ActionTurnsAuthority,
  reservation: SettlementReservation,
): void {
  if (!reservation.active) return;
  releaseSettlementReservation(authority, reservation);
  releaseSettlementPublication(authority);
}

function isTicketDescriptor(
  descriptor: RuntimeOperationActionSettlementDescriptor,
): descriptor is Extract<
  RuntimeOperationActionSettlementDescriptor,
  { readonly ticket: RuntimeOperationActionSettlementTicket }
> {
  return "ticket" in descriptor;
}

function containCoordinatorFailure(
  handle: RuntimeActionTurnsHandle,
  authority: ActionTurnsAuthority,
): void {
  if (authority.status !== "live") return;
  try {
    disposeRuntimeActionTurns(handle);
  } catch {
    // The coordinator authority is revoked before child cleanup begins.
  }
}

function attemptSettlementTicketFinalization(
  authority: ActionTurnsAuthority,
  ticket: RuntimeOperationActionSettlementTicket,
): ReturnType<typeof finalizeRuntimeOperationActionSettlement> | "already-attempted" | "failed" {
  if (ATTEMPTED_SETTLEMENT_FINALIZATION_TICKETS.has(ticket)) return "already-attempted";
  ATTEMPTED_SETTLEMENT_FINALIZATION_TICKETS.add(ticket);
  try {
    return finalizeRuntimeOperationActionSettlement(
      authority.operationResourceActionsHandle,
      ticket,
    );
  } catch {
    return "failed";
  }
}

function finalizeDetachedSettlementDescriptor(
  authority: ActionTurnsAuthority,
  descriptor: RuntimeOperationActionSettlementDescriptor,
): void {
  if (!isTicketDescriptor(descriptor)) return;
  attemptSettlementTicketFinalization(authority, descriptor.ticket);
}

function enqueueSettlementDescriptor(
  handle: RuntimeActionTurnsHandle,
  authority: ActionTurnsAuthority,
  reservation: SettlementReservation,
  descriptor: RuntimeOperationActionSettlementDescriptor,
): void {
  const ticketDescriptor = isTicketDescriptor(descriptor) ? descriptor : undefined;
  if (!reservation.active) {
    finalizeDetachedSettlementDescriptor(authority, descriptor);
    return;
  }
  releaseSettlementReservation(authority, reservation);
  let queued = false;
  let failed = false;
  try {
    if (authority.status !== "live") return;
    if ("operationSnapshot" in descriptor) {
      if (!updateOperationSnapshot(authority, descriptor.operationSnapshot)) {
        disposeRuntimeActionTurns(handle);
        return;
      }
    }
    if (ticketDescriptor === undefined) {
      if (descriptor.status === "disposed") disposeRuntimeActionTurns(handle);
      else scheduleSettlementPublication(handle, authority, "operation");
      return;
    }

    const prepared = prepareRuntimeActionProgram(ticketDescriptor.actions);
    const programAuthority =
      prepared.status === "prepared" ? PROGRAM_AUTHORITIES.get(prepared.program) : undefined;
    let programFailure: "malformed-actions" | "program-limit" | undefined;
    if (prepared.status === "invalid") {
      programFailure = prepared.reason;
    } else if (programAuthority === undefined || !retainProgram(authority, programAuthority)) {
      programFailure = "program-limit";
    }
    authority.queue.push(
      Object.freeze({
        origin: "settlement",
        turnId: reservation.turnId,
        depth: reservation.parentDepth + 1,
        program: prepared.status === "prepared" ? prepared.program : undefined,
        programAuthority,
        programFailure,
        scope: reservation.scope,
        descriptor: ticketDescriptor,
      }),
    );
    queued = true;
    drainQueue(handle, authority);
  } catch {
    failed = true;
  } finally {
    if (ticketDescriptor !== undefined && !queued) {
      finalizeDetachedSettlementDescriptor(authority, ticketDescriptor);
    }
    if (failed) containCoordinatorFailure(handle, authority);
  }
}

function observeResourceSettlement(
  handle: RuntimeActionTurnsHandle,
  authority: ActionTurnsAuthority,
  settlement: RuntimeResourceSettlement,
): void {
  if (authority.status !== "live") return;
  if ("snapshot" in settlement) {
    if (!updateResourceSnapshot(authority, settlement.snapshot)) {
      disposeRuntimeActionTurns(handle);
    } else {
      scheduleSettlementPublication(handle, authority, "resource");
    }
    return;
  }
  if (settlement.status === "disposed") disposeRuntimeActionTurns(handle);
}

function containOperationSettlementCallbackFailure(
  handle: RuntimeActionTurnsHandle,
  authority: ActionTurnsAuthority,
  reservation: SettlementReservation,
  descriptor?: RuntimeOperationActionSettlementDescriptor,
): void {
  const descriptorNeedsFinalization = reservation.active && descriptor !== undefined;
  releaseSettlementReservation(authority, reservation);
  if (descriptorNeedsFinalization) {
    finalizeDetachedSettlementDescriptor(authority, descriptor);
  }
  containCoordinatorFailure(handle, authority);
}

function attachOperationSettlement(
  handle: RuntimeActionTurnsHandle,
  authority: ActionTurnsAuthority,
  reservation: SettlementReservation,
  settlement: Promise<RuntimeOperationActionSettlementDescriptor>,
): void {
  let observedDescriptor: RuntimeOperationActionSettlementDescriptor | undefined;
  try {
    void settlement
      .then(
        (descriptor) => {
          observedDescriptor = descriptor;
          try {
            enqueueSettlementDescriptor(handle, authority, reservation, descriptor);
          } catch {
            containOperationSettlementCallbackFailure(handle, authority, reservation, descriptor);
          }
        },
        () => {
          containOperationSettlementCallbackFailure(handle, authority, reservation);
        },
      )
      .catch(() => {
        containOperationSettlementCallbackFailure(
          handle,
          authority,
          reservation,
          observedDescriptor,
        );
      });
  } catch {
    containOperationSettlementCallbackFailure(handle, authority, reservation, observedDescriptor);
  }
}

function attachResourceSettlement(
  handle: RuntimeActionTurnsHandle,
  authority: ActionTurnsAuthority,
  settlement: Promise<RuntimeResourceSettlement>,
): void {
  try {
    void settlement
      .then(
        (result) => {
          try {
            observeResourceSettlement(handle, authority, result);
          } catch {
            containCoordinatorFailure(handle, authority);
          }
        },
        () => containCoordinatorFailure(handle, authority),
      )
      .catch(() => containCoordinatorFailure(handle, authority));
  } catch {
    containCoordinatorFailure(handle, authority);
  }
}

function unknownActionResult(
  authority: ActionTurnsAuthority,
): Extract<RuntimeActionTurnStep["result"], { readonly status: "unknown-action" }> {
  return Object.freeze({
    status: "unknown-action",
    diagnostics: Object.freeze([
      diagnostic(
        "run.desen.runtime/ACTION_INPUT_INVALID",
        "The prepared action discriminator is not supported by this runtime profile.",
        authority,
      ),
    ]),
  });
}

function childTerminationReason(
  result: RuntimeActionTurnStep["result"],
): RuntimeActionTurnTerminationReason | "continue" | "disposed" | "navigated" {
  if (result.status === "skipped") return "continue";
  if (
    result.status === "state-updated" ||
    result.status === "state-unchanged" ||
    result.status === "operation-started" ||
    result.status === "operation-queued" ||
    result.status === "operation-staged" ||
    result.status === "resource-started" ||
    result.status === "command-succeeded" ||
    result.status === "event-emitted"
  ) {
    return "continue";
  }
  if (result.status === "navigated") return "navigated";
  if (
    result.status === "disposed" ||
    result.status === "state-disposed" ||
    result.status === "resource-disposed" ||
    result.status === "operation-disposed"
  ) {
    return "disposed";
  }
  if (result.status === "invalid-snapshot") return "invalid-snapshot";
  if (result.status === "busy") return "child-busy";
  if (result.status === "action-limit") return "action-limit";
  if (result.status === "invalid-handle" || result.status === "invalid-authority") {
    return "invalid-authority";
  }
  return "action-failed";
}

function updateFromChildResult(
  authority: ActionTurnsAuthority,
  result: RuntimeActionTurnStep["result"],
): boolean {
  if (
    (result.status === "state-updated" || result.status === "state-unchanged") &&
    !updateStateSnapshot(authority, result.stateSnapshot)
  ) {
    return false;
  }
  if (
    (result.status === "operation-started" ||
      result.status === "operation-queued" ||
      result.status === "operation-staged" ||
      result.status === "operation-rejected") &&
    !updateOperationSnapshot(authority, result.operationSnapshot)
  ) {
    return false;
  }
  if (
    result.status === "resource-started" &&
    !updateResourceSnapshot(authority, result.resourceSnapshot)
  ) {
    return false;
  }
  if (result.status === "invalid-snapshot") {
    if (
      "stateSnapshot" in result &&
      result.stateSnapshot !== undefined &&
      !updateStateSnapshot(authority, result.stateSnapshot)
    ) {
      return false;
    }
    if (
      "resourceSnapshot" in result &&
      result.resourceSnapshot !== undefined &&
      !updateResourceSnapshot(authority, result.resourceSnapshot)
    ) {
      return false;
    }
    if (
      "operationSnapshot" in result &&
      result.operationSnapshot !== undefined &&
      !updateOperationSnapshot(authority, result.operationSnapshot)
    ) {
      return false;
    }
    if (
      "snapshot" in result &&
      result.snapshot !== undefined &&
      "liveTargets" in result.snapshot &&
      !updateCommandEventSnapshot(authority, result.snapshot)
    ) {
      return false;
    }
  }
  return true;
}

function reserveOperationSettlementOrReport(
  authority: ActionTurnsAuthority,
  depth: number,
  scope: ScopeSeed,
): SettlementReservation | undefined {
  const reservation = reserveSettlement(authority, depth, scope);
  if (reservation !== undefined) return reservation;
  const diagnostics = Object.freeze([
    actionLimitDiagnostic(
      authority,
      "The shared action-turn FIFO cannot reserve a non-droppable operation settlement turn.",
    ),
  ]);
  safeReport(authority, diagnostics);
  return undefined;
}

function reserveResourceSettlementPublicationOrReport(authority: ActionTurnsAuthority): boolean {
  if (reserveSettlementPublication(authority)) return true;
  const diagnostics = Object.freeze([
    actionLimitDiagnostic(
      authority,
      "The settlement publication queue cannot reserve a non-droppable resource completion.",
    ),
  ]);
  safeReport(authority, diagnostics);
  return false;
}

function makeEmergencyEventCompletion(
  authority: ActionTurnsAuthority,
  turnId: string,
  scope: ScopeSeed,
): RuntimeActionTurnCompletion {
  return Object.freeze({
    status: "disposed",
    turnId,
    origin: "event",
    settlementDepth: 0,
    steps: EMPTY_STEPS,
    snapshot: authority.snapshot,
    resolutionSnapshot: scope.emergencySnapshot,
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}

function makeCompletion(
  authority: ActionTurnsAuthority,
  item: WorkItem,
  status: "completed" | "disposed" | "navigated" | "terminated",
  steps: readonly RuntimeActionTurnStep[],
  resolutionSnapshot: RuntimeResolutionSnapshot,
  diagnostics: readonly DesenDiagnostic<string>[],
  reason?: RuntimeActionTurnTerminationReason,
  surface?: string,
): RuntimeActionTurnCompletion {
  const base = {
    turnId: item.turnId,
    origin: item.origin,
    settlementDepth: item.depth,
    steps: Object.freeze([...steps]),
    snapshot: authority.snapshot,
    resolutionSnapshot,
    diagnostics: Object.freeze([...diagnostics]),
  } as const;
  if (status === "terminated") {
    return Object.freeze({
      ...base,
      status,
      reason: reason as RuntimeActionTurnTerminationReason,
    });
  }
  if (status === "navigated") {
    return Object.freeze({ ...base, status, surface: surface as string });
  }
  return Object.freeze({ ...base, status });
}

function finalizeSettlementItem(
  authority: ActionTurnsAuthority,
  item: SettlementWorkItem,
): boolean {
  const finalized = attemptSettlementTicketFinalization(authority, item.descriptor.ticket);
  if (finalized === "already-attempted") return true;
  if (finalized === "failed") return false;
  if (finalized.status === "finalized") {
    try {
      return updateOperationSnapshot(authority, finalized.operationSnapshot);
    } catch {
      return false;
    }
  }
  if (finalized.status === "disposed" && authority.status !== "live") return true;
  if (finalized.status === "already-finalized") return false;
  return false;
}

function processWorkItem(
  handle: RuntimeActionTurnsHandle,
  authority: ActionTurnsAuthority,
  item: WorkItem,
): RuntimeActionTurnCompletion {
  const steps: RuntimeActionTurnStep[] = [];
  const diagnostics: DesenDiagnostic<string>[] = [];
  let resolutionSnapshot = item.scope.emergencySnapshot;
  let completionStatus: "completed" | "disposed" | "navigated" | "terminated" = "completed";
  let terminationReason: RuntimeActionTurnTerminationReason | undefined;
  let navigationSurface: string | undefined;

  try {
    const initialResolution = composeResolutionSnapshot(authority, item.scope);
    if (initialResolution !== undefined) resolutionSnapshot = initialResolution;
    if (initialResolution === undefined) {
      completionStatus = "terminated";
      terminationReason = "snapshot-limit";
    } else if (authority.status !== "live") {
      completionStatus = "disposed";
    } else if (item.depth > authority.limits.maxSettlementDepth) {
      const limit = actionLimitDiagnostic(
        authority,
        "The nested action-settlement depth exceeded the configured bound.",
      );
      diagnostics.push(limit);
      safeReport(authority, Object.freeze([limit]));
      if (authority.status === "live") {
        completionStatus = "terminated";
        terminationReason = "settlement-depth";
      } else {
        completionStatus = "disposed";
      }
    } else if (item.origin === "settlement" && item.programFailure !== undefined) {
      const invalid = diagnostic(
        "run.desen.runtime/ACTION_INPUT_INVALID",
        "The selected settlement branch could not be prepared as a bounded action program.",
        authority,
      );
      diagnostics.push(invalid);
      safeReport(authority, Object.freeze([invalid]));
      completionStatus = "terminated";
      terminationReason = "action-failed";
    } else {
      const programAuthority = item.programAuthority;
      if (programAuthority === undefined) {
        completionStatus = "terminated";
        terminationReason = "invalid-authority";
      } else {
        let used = 0;
        while (used < programAuthority.actionCount) {
          if (used === authority.limits.maxActionsPerTurn) {
            const limit = actionLimitDiagnostic(
              authority,
              "The action turn exceeded its configured action bound.",
              createJsonPointer([used]),
            );
            diagnostics.push(limit);
            safeReport(authority, Object.freeze([limit]));
            if (authority.status === "live") {
              completionStatus = "terminated";
              terminationReason = "action-limit";
            } else {
              completionStatus = "disposed";
            }
            break;
          }
          const entry = programAuthority.entries[used];
          used += 1;
          if (entry === undefined) {
            const limit = actionLimitDiagnostic(
              authority,
              "The prepared program overflow marker terminated the action turn.",
              createJsonPointer([used - 1]),
            );
            diagnostics.push(limit);
            safeReport(authority, Object.freeze([limit]));
            completionStatus = "terminated";
            terminationReason = "action-limit";
            break;
          }

          const fresh = refreshManagedSnapshots(authority);
          if (fresh.status !== "fresh") {
            completionStatus = fresh.status === "disposed" ? "disposed" : "terminated";
            terminationReason = fresh.status === "disposed" ? undefined : "invalid-authority";
            break;
          }
          const currentResolution = composeResolutionSnapshot(authority, item.scope);
          if (currentResolution === undefined) {
            completionStatus = "terminated";
            terminationReason = "snapshot-limit";
            break;
          }
          resolutionSnapshot = currentResolution;

          let result: RuntimeActionTurnStep["result"];
          let settlementReservation: SettlementReservation | undefined;
          let resourcePublicationReserved = false;
          if (entry.route === "unknown") {
            result = unknownActionResult(authority);
          } else if (entry.route === "state-navigation") {
            result = executeRuntimeStateNavigationAction(
              authority.stateActionsHandle,
              entry.action as unknown as RuntimeStateNavigationAction,
              currentResolution,
              authority.stateSnapshot,
            );
          } else if (entry.route === "operation-resource") {
            if (entry.type === "operation.invoke") {
              settlementReservation = reserveOperationSettlementOrReport(
                authority,
                item.depth,
                item.scope,
              );
              if (settlementReservation === undefined) {
                if (authority.status === "live") {
                  completionStatus = "terminated";
                  terminationReason = "action-limit";
                } else {
                  completionStatus = "disposed";
                }
                break;
              }
            } else if (entry.type === "resource.refresh") {
              resourcePublicationReserved = reserveResourceSettlementPublicationOrReport(authority);
              if (!resourcePublicationReserved) {
                if (authority.status === "live") {
                  completionStatus = "terminated";
                  terminationReason = "action-limit";
                } else {
                  completionStatus = "disposed";
                }
                break;
              }
            }
            result = executeRuntimeOperationResourceAction(
              authority.operationResourceActionsHandle,
              entry.action as unknown as RuntimeOperationResourceAction,
              currentResolution,
              authority.resourceSnapshot,
              authority.operationSnapshot,
            );
          } else {
            result = executeRuntimeCommandEventAction(
              authority.commandEventActionsHandle,
              entry.action as unknown as RuntimeCommandEventAction,
              currentResolution,
              authority.commandEventSnapshot,
            );
          }

          if (!updateFromChildResult(authority, result)) {
            if (settlementReservation !== undefined) {
              if (
                result.status === "operation-started" ||
                result.status === "operation-queued" ||
                result.status === "operation-staged"
              ) {
                attachOperationSettlement(
                  handle,
                  authority,
                  settlementReservation,
                  result.settlement,
                );
                disposeRuntimeActionTurns(handle);
              } else {
                abandonSettlementReservation(authority, settlementReservation);
              }
            }
            if (resourcePublicationReserved) {
              if (result.status === "resource-started") {
                attachResourceSettlement(handle, authority, result.settlement);
                disposeRuntimeActionTurns(handle);
              } else {
                releaseSettlementPublication(authority);
              }
            }
            steps.push(Object.freeze({ index: used - 1, route: entry.route, result }));
            completionStatus = "terminated";
            terminationReason = "invalid-snapshot";
            break;
          }
          steps.push(Object.freeze({ index: used - 1, route: entry.route, result }));

          if (
            settlementReservation !== undefined &&
            (result.status === "operation-started" ||
              result.status === "operation-queued" ||
              result.status === "operation-staged")
          ) {
            attachOperationSettlement(handle, authority, settlementReservation, result.settlement);
          } else if (settlementReservation !== undefined) {
            abandonSettlementReservation(authority, settlementReservation);
          }
          if (result.status === "resource-started") {
            attachResourceSettlement(handle, authority, result.settlement);
          } else if (resourcePublicationReserved) {
            releaseSettlementPublication(authority);
          }

          const outcome = childTerminationReason(result);
          if (outcome === "continue") continue;
          if (outcome === "navigated") {
            completionStatus = "navigated";
            navigationSurface =
              result.status === "navigated" ? result.surface : authority.surfaceId;
          } else if (outcome === "disposed") {
            completionStatus = "disposed";
          } else {
            completionStatus = "terminated";
            terminationReason = outcome;
          }
          break;
        }
      }
    }
  } catch {
    completionStatus = "disposed";
    terminationReason = undefined;
    navigationSurface = undefined;
    if (authority.status === "live") {
      try {
        disposeRuntimeActionTurns(handle);
      } catch {
        // Finalization below remains mandatory even when terminal child disposal fails.
      }
    }
  } finally {
    if (completionStatus === "navigated" || completionStatus === "disposed") {
      try {
        disposeRuntimeActionTurns(handle);
      } catch {
        completionStatus = "disposed";
        terminationReason = undefined;
        navigationSurface = undefined;
      }
    }
    if (item.origin === "settlement") {
      const finalized = finalizeSettlementItem(authority, item);
      if (!finalized && authority.status === "live") {
        completionStatus = "disposed";
        try {
          disposeRuntimeActionTurns(handle);
        } catch {
          // The ticket attempt is already recorded; the drain fence contains the coordinator.
        }
      }
    }
    const finalResolution = composeResolutionSnapshot(authority, item.scope);
    if (finalResolution !== undefined) resolutionSnapshot = finalResolution;
  }

  return makeCompletion(
    authority,
    item,
    completionStatus,
    steps,
    resolutionSnapshot,
    diagnostics,
    terminationReason,
    navigationSurface,
  );
}

function resolveDisposedEventItem(authority: ActionTurnsAuthority, item: EventWorkItem): void {
  let completion = item.emergencyCompletion;
  try {
    const resolution =
      composeResolutionSnapshot(authority, item.scope) ?? item.scope.emergencySnapshot;
    completion = makeCompletion(
      authority,
      item,
      "disposed",
      EMPTY_STEPS,
      resolution,
      EMPTY_DIAGNOSTICS,
    );
  } catch {
    // The admission-time completion is already immutable and factory-authenticated.
  }
  item.resolve(completion);
}

function releaseQueuedItem(authority: ActionTurnsAuthority, item: WorkItem): void {
  if (
    item.programAuthority !== undefined &&
    (item.origin === "event" || item.programFailure === undefined)
  ) {
    releaseProgram(authority, item.programAuthority);
  }
}

function flushDeferredDisposedEvents(authority: ActionTurnsAuthority): void {
  const deferred = authority.deferredDisposedEvents.splice(0);
  for (const item of deferred) {
    try {
      resolveDisposedEventItem(authority, item);
    } catch {
      item.resolve(item.emergencyCompletion);
    }
  }
}

function terminateTransitionOverflow(
  handle: RuntimeActionTurnsHandle,
  authority: ActionTurnsAuthority,
): void {
  const diagnostics = Object.freeze([
    actionLimitDiagnostic(
      authority,
      "The synchronous action-turn transition chain exceeded the configured bound.",
    ),
  ]);
  safeReport(authority, diagnostics);
  while (authority.queue.length > 0) {
    const item = authority.queue.shift();
    if (item === undefined) break;
    releaseQueuedItem(authority, item);
    const resolution =
      composeResolutionSnapshot(authority, item.scope) ?? item.scope.emergencySnapshot;
    if (item.origin === "event") {
      let completion = item.emergencyCompletion;
      try {
        completion = makeCompletion(
          authority,
          item,
          "terminated",
          EMPTY_STEPS,
          resolution,
          diagnostics,
          "transition-limit",
        );
      } catch {
        // The admission-time completion keeps this accepted Promise fulfilled.
      }
      item.resolve(completion);
    } else {
      if (!finalizeSettlementItem(authority, item)) {
        try {
          disposeRuntimeActionTurns(handle);
        } catch {
          // The settlement finalization attempt is already recorded.
        }
        return;
      }
      if (authority.status === "live") {
        scheduleSettlementPublication(handle, authority, "operation");
      }
    }
  }
}

function settleAbandonedQueue(
  handle: RuntimeActionTurnsHandle,
  authority: ActionTurnsAuthority,
): void {
  while (authority.queue.length > 0) {
    const item = authority.queue.shift();
    if (item === undefined) break;
    releaseQueuedItem(authority, item);
    if (item.origin === "event") {
      item.resolve(item.emergencyCompletion);
    } else if (!finalizeSettlementItem(authority, item) && authority.status === "live") {
      try {
        disposeRuntimeActionTurns(handle);
      } catch {
        // The finalization attempt and every accepted event completion remain terminal.
      }
    }
  }
}

function drainQueue(handle: RuntimeActionTurnsHandle, authority: ActionTurnsAuthority): void {
  if (authority.draining || authority.status !== "live") return;
  authority.draining = true;
  try {
    let transitions = 0;
    while (authority.queue.length > 0 && authority.status === "live") {
      if (transitions === authority.limits.maxSynchronousTurnTransitions) {
        terminateTransitionOverflow(handle, authority);
        break;
      }
      const item = authority.queue.shift();
      if (item === undefined) break;
      transitions += 1;
      let completion: RuntimeActionTurnCompletion | undefined;
      try {
        completion = processWorkItem(handle, authority, item);
      } catch {
        if (item.origin === "settlement") finalizeSettlementItem(authority, item);
        if (authority.status === "live") {
          try {
            disposeRuntimeActionTurns(handle);
          } catch {
            // The accepted event still resolves from its admission-time emergency completion.
          }
        }
        if (item.origin === "event") completion = item.emergencyCompletion;
      } finally {
        // Disposal resets the complete retained budget, including the active item. A live
        // coordinator releases only after the active completion has been fully formed so
        // reentrant admission cannot borrow memory still retained by the current turn.
        if (authority.status === "live") releaseQueuedItem(authority, item);
      }
      if (item.origin === "event") item.resolve(completion ?? item.emergencyCompletion);
      else if (authority.status === "live") {
        scheduleSettlementPublication(handle, authority, "operation");
      }
      flushDeferredDisposedEvents(authority);
    }
  } catch {
    if (authority.status === "live") {
      try {
        disposeRuntimeActionTurns(handle);
      } catch {
        // Queue ownership is reclaimed below without exposing the platform failure.
      }
    }
    settleAbandonedQueue(handle, authority);
  } finally {
    authority.draining = false;
    try {
      flushDeferredDisposedEvents(authority);
    } catch {
      const deferred = authority.deferredDisposedEvents.splice(0);
      for (const item of deferred) item.resolve(item.emergencyCompletion);
    }
  }
}

/**
 * Admits one depth-zero event turn into the coordinator's shared FIFO.
 *
 * @remarks Idle admission returns `started`; reentrant admission returns `queued`. Both expose a
 * never-rejecting completion Promise. No reentrant call executes recursively. Settlement origin,
 * event unavailability, and nested depth are package-owned and cannot be caller supplied.
 */
export function executeRuntimeActionTurn(
  handle: RuntimeActionTurnsHandle,
  request: RuntimeActionTurnRequest,
): RuntimeActionTurnExecutionResult {
  if (typeof handle !== "object" || handle === null) {
    return Object.freeze({ status: "invalid-handle" });
  }
  const authority = TURN_AUTHORITIES.get(handle);
  if (authority === undefined) return Object.freeze({ status: "invalid-handle" });
  if (authority.status !== "live") return Object.freeze({ status: "disposed" });
  if (authority.reporting) {
    return Object.freeze({
      status: "rejected",
      reason: "invalid-request",
      diagnostics: EMPTY_DIAGNOSTICS,
    });
  }

  const captured = captureRequest(request);
  if (captured === undefined) {
    return Object.freeze({
      status: "rejected",
      reason: "invalid-request",
      diagnostics: EMPTY_DIAGNOSTICS,
    });
  }
  const fresh = refreshManagedSnapshots(authority);
  if (fresh.status === "disposed") {
    disposeRuntimeActionTurns(handle);
    return Object.freeze({ status: "disposed" });
  }
  if (fresh.status !== "fresh") {
    return Object.freeze({
      status: "rejected",
      reason: "invalid-request",
      diagnostics: EMPTY_DIAGNOSTICS,
    });
  }
  if (queueSize(authority) >= authority.limits.maxQueuedTurns) {
    const diagnostics = Object.freeze([
      actionLimitDiagnostic(
        authority,
        "The shared action-turn FIFO exceeded the configured bound.",
      ),
    ]);
    safeReport(authority, diagnostics);
    if (authority.status !== "live") return Object.freeze({ status: "disposed" });
    return Object.freeze({ status: "rejected", reason: "queue-limit", diagnostics });
  }
  if (!retainProgram(authority, captured.programAuthority)) {
    return Object.freeze({
      status: "rejected",
      reason: "retained-limit",
      diagnostics: EMPTY_DIAGNOSTICS,
    });
  }
  const nextGenerationBeforeAdmission = authority.nextTurnGeneration;
  const turnId = nextTurnId(authority);
  if (turnId === undefined) {
    releaseProgram(authority, captured.programAuthority);
    return Object.freeze({
      status: "rejected",
      reason: "turn-generation-limit",
      diagnostics: EMPTY_DIAGNOSTICS,
    });
  }

  const reentrant = authority.draining;
  const position = authority.queue.length + 1;
  let item: EventWorkItem;
  let admission: RuntimeActionTurnQueued | RuntimeActionTurnStarted;
  try {
    let resolveCompletion!: (completion: RuntimeActionTurnCompletion) => void;
    const completion = new Promise<RuntimeActionTurnCompletion>((resolve) => {
      resolveCompletion = resolve;
    });
    const emergencyCompletion = makeEmergencyEventCompletion(authority, turnId, captured.scope);
    item = Object.freeze({
      origin: "event",
      turnId,
      depth: 0,
      program: captured.program,
      programAuthority: captured.programAuthority,
      scope: captured.scope,
      completion,
      emergencyCompletion,
      resolve: resolveCompletion,
    });
    admission = reentrant
      ? Object.freeze({
          status: "queued",
          turnId,
          position,
          snapshot: authority.snapshot,
          completion,
        })
      : Object.freeze({
          status: "started",
          turnId,
          snapshot: authority.snapshot,
          completion,
        });
  } catch {
    releaseProgram(authority, captured.programAuthority);
    authority.nextTurnGeneration = nextGenerationBeforeAdmission;
    return Object.freeze({
      status: "rejected",
      reason: "invalid-request",
      diagnostics: EMPTY_DIAGNOSTICS,
    });
  }

  let queued = false;
  try {
    authority.queue.push(item);
    queued = true;
    if (!reentrant) drainQueue(handle, authority);
  } catch {
    if (!queued) {
      releaseProgram(authority, captured.programAuthority);
      authority.nextTurnGeneration = nextGenerationBeforeAdmission;
      return Object.freeze({
        status: "rejected",
        reason: "invalid-request",
        diagnostics: EMPTY_DIAGNOSTICS,
      });
    }
    item.resolve(item.emergencyCompletion);
    if (authority.status === "live") {
      try {
        disposeRuntimeActionTurns(handle);
      } catch {
        // The accepted admission and its immutable emergency completion remain observable.
      }
    }
    return admission;
  }

  if (reentrant) return admission;
  try {
    return Object.freeze({
      status: "started",
      turnId,
      snapshot: authority.snapshot,
      completion: item.completion,
    });
  } catch {
    return admission;
  }
}

function disposeAuthority(
  handle: RuntimeActionTurnsHandle,
  authority: ActionTurnsAuthority,
): Extract<RuntimeActionTurnsDisposeResult, { readonly status: "disposed" }> {
  authority.status = "revoked";
  const settlementObserver = authority.settlementObserver;
  authority.settlementObserver = undefined;
  authority.pendingSettlementPublications.splice(0);
  authority.settlementPublicationReservations = 0;
  if (settlementObserver !== undefined && settlementObserver.active) {
    void Promise.resolve().then(() => {
      if (!settlementObserver.active) return;
      try {
        Reflect.apply(settlementObserver.listener, undefined, ["disposed"]);
      } catch {
        // The terminal lower authority is already revoked; callback failure cannot revive it.
      } finally {
        settlementObserver.active = false;
      }
    });
  }
  const queued = authority.queue.splice(0);
  const discardedTurns = queued.length + authority.reservedSettlementSlots;
  for (const reservation of authority.settlementReservations) {
    reservation.active = false;
  }
  authority.settlementReservations.clear();
  authority.reservedSettlementSlots = 0;

  try {
    disposeRuntimeStateNavigationActions(authority.stateActionsHandle);
  } catch {
    // Child platform failures never prevent terminal queue containment.
  }
  let operationResources: ReturnType<typeof disposeRuntimeOperationResourceActions> | undefined;
  try {
    operationResources = disposeRuntimeOperationResourceActions(
      authority.operationResourceActionsHandle,
    );
  } catch {
    operationResources = undefined;
  }
  let commandEvents: ReturnType<typeof disposeRuntimeCommandEventActions> | undefined;
  try {
    commandEvents = disposeRuntimeCommandEventActions(authority.commandEventActionsHandle);
  } catch {
    commandEvents = undefined;
  }
  try {
    disposeRuntimeSurfaceState(authority.stateHandle);
  } catch {
    // The coordinator still terminally revokes its own authority and accepted work.
  }

  for (const item of queued) {
    try {
      releaseQueuedItem(authority, item);
      if (item.origin === "settlement") {
        finalizeSettlementItem(authority, item);
      } else if (authority.draining) {
        authority.deferredDisposedEvents.push(item);
      } else {
        resolveDisposedEventItem(authority, item);
      }
    } catch {
      if (item.origin === "event") {
        item.resolve(item.emergencyCompletion);
      } else {
        finalizeSettlementItem(authority, item);
      }
    }
  }
  authority.retainedQueuedActions = 0;
  authority.retainedQueuedCodeUnits = 0;
  TURN_AUTHORITIES.set(handle, Object.freeze({ status: "disposed", ownerKey: authority.ownerKey }));
  return Object.freeze({
    status: "disposed",
    discardedTurns,
    disposedTargets: commandEvents?.status === "disposed" ? commandEvents.disposedTargets : 0,
    disposedResources:
      operationResources?.status === "disposed" ? operationResources.disposedResources : 0,
    disposedInvocations:
      operationResources?.status === "disposed" ? operationResources.disposedInvocations : 0,
    invalidatedLeases:
      operationResources?.status === "disposed" ? operationResources.invalidatedLeases : 0,
  });
}

/** Terminally disposes the coordinator, all surrendered children, and every queued work item. */
export function disposeRuntimeActionTurns(
  handle: RuntimeActionTurnsHandle,
): RuntimeActionTurnsDisposeResult {
  if (typeof handle !== "object" || handle === null) {
    return Object.freeze({
      status: "invalid-handle",
      discardedTurns: 0,
      disposedTargets: 0,
      disposedResources: 0,
      disposedInvocations: 0,
      invalidatedLeases: 0,
    });
  }
  const authority = TURN_AUTHORITIES.get(handle);
  if (authority === undefined) {
    return Object.freeze({
      status: "invalid-handle",
      discardedTurns: 0,
      disposedTargets: 0,
      disposedResources: 0,
      disposedInvocations: 0,
      invalidatedLeases: 0,
    });
  }
  if (authority.status !== "live") {
    return Object.freeze({
      status: "already-disposed",
      discardedTurns: 0,
      disposedTargets: 0,
      disposedResources: 0,
      disposedInvocations: 0,
      invalidatedLeases: 0,
    });
  }
  return disposeAuthority(handle, authority);
}
