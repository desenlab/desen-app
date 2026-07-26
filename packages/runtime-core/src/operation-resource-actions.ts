import {
  canonicalizeJson,
  createCoreDiagnostic,
  createJsonPointer,
  isSha256Digest,
} from "@desen/protocol";

import {
  captureRuntimeActionWhen,
  createRuntimeActionEvaluationSession,
  evaluateRuntimeActionGuard,
  materializeRuntimeActionNamedValues,
} from "./action-evaluation.js";
import { createRuntimeHostPorts } from "./host-ports.js";
import {
  acknowledgeRuntimeOperationSettlement,
  disposeRuntimeSurfaceOperations,
  invokeRuntimeOperation,
  readRuntimeSurfaceOperations,
} from "./operation-lifecycle.js";
import {
  disposeRuntimeSurfaceResources,
  readRuntimeSurfaceResources,
  refreshRuntimeSurfaceResource,
} from "./resource-lifecycle.js";
import { isRuntimeJsonObject, snapshotRuntimeJsonValue } from "./runtime-json-snapshot.js";
import { resolveRuntimeValue, RUNTIME_VALUE_SAFETY_LIMITS } from "./value-resolution.js";

import type { DesenDiagnostic, JsonPointer } from "@desen/protocol";
import type { RuntimeActionEvaluationSession } from "./action-evaluation.js";
import type { RuntimeHostPorts, RuntimeJsonObject } from "./host-ports.js";
import type {
  RuntimeOperationConcurrency,
  RuntimeOperationSettlement,
  RuntimeOperationSettlementLease,
  RuntimeSurfaceOperationAliasSpec,
  RuntimeSurfaceOperationsHandle,
  RuntimeSurfaceOperationsSnapshot,
} from "./operation-lifecycle.js";
import type { RuntimePredicateSpec, RuntimePredicateTypeMismatch } from "./predicate-evaluation.js";
import type {
  RuntimeResourceSettlement,
  RuntimeSurfaceResourcesHandle,
  RuntimeSurfaceResourcesSnapshot,
} from "./resource-lifecycle.js";
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
const ALIAS_POINTER = createJsonPointer(["as"]);
const OPERATION_POINTER = createJsonPointer(["operation"]);
const RESOURCE_POINTER = createJsonPointer(["resource"]);
const EMPTY_DIAGNOSTICS = Object.freeze([]) as readonly DesenDiagnostic<string>[];
const EMPTY_ACTIONS = Object.freeze([]) as readonly [];

declare const RUNTIME_OPERATION_RESOURCE_ACTIONS_HANDLE_TYPE_BRAND: unique symbol;
declare const RUNTIME_OPERATION_ACTION_SETTLEMENT_TICKET_TYPE_BRAND: unique symbol;

/** Finite ceilings for one operation/resource action lifetime. */
export const RUNTIME_OPERATION_RESOURCE_ACTION_LIMITS = Object.freeze({
  maxActionGeneration: Number.MAX_SAFE_INTEGER,
  maxPendingSettlements: 64,
  maxRetainedSettlementActions: 4_096,
  maxRetainedHandlerCodeUnits: 1_048_576,
} as const);

/** Optional trusted profile that may only lower action-composition ceilings. */
export interface RuntimeOperationResourceActionLimitProfile {
  readonly maxActionGeneration?: number;
  readonly maxPendingSettlements?: number;
  readonly maxRetainedSettlementActions?: number;
  readonly maxRetainedHandlerCodeUnits?: number;
}

/** Detached data-only action retained for a later M04-T13 turn. */
export type RuntimeDeferredActionSpec = RuntimeJsonObject;

/** Exact `operation.invoke` action owned by this primitive. */
export interface RuntimeOperationInvokeAction {
  readonly type: "operation.invoke";
  readonly operation: string;
  readonly as: string;
  readonly input: Readonly<Record<string, RuntimeValueSpec>>;
  readonly concurrency?: RuntimeOperationConcurrency;
  readonly onSuccess?: readonly RuntimeDeferredActionSpec[];
  readonly onFailure?: readonly RuntimeDeferredActionSpec[];
  readonly when?: RuntimePredicateSpec;
  readonly extensions?: RuntimeJsonObject;
}

/** Exact `resource.refresh` action owned by this primitive. */
export interface RuntimeResourceRefreshAction {
  readonly type: "resource.refresh";
  readonly resource: string;
  readonly when?: RuntimePredicateSpec;
  readonly extensions?: RuntimeJsonObject;
}

/** One action accepted by the M04-T11 primitive. */
export type RuntimeOperationResourceAction =
  RuntimeOperationInvokeAction | RuntimeResourceRefreshAction;

/** Trusted inputs that compose one exclusive T08/T09 surface lifetime. */
export interface RuntimeOperationResourceActionsMountInput {
  readonly documentId: string;
  readonly revision: string;
  readonly surfaceId: string;
  readonly operations: Readonly<Record<string, RuntimeSurfaceOperationAliasSpec>>;
  readonly resourceHandle: RuntimeSurfaceResourcesHandle;
  readonly resourceSnapshot: RuntimeSurfaceResourcesSnapshot;
  readonly operationHandle: RuntimeSurfaceOperationsHandle;
  readonly operationSnapshot: RuntimeSurfaceOperationsSnapshot;
  readonly hostPorts: RuntimeHostPorts;
  readonly limits?: RuntimeOperationResourceActionLimitProfile;
}

/** Opaque authority for one composed operation/resource action lifetime. */
export interface RuntimeOperationResourceActionsHandle {
  readonly [RUNTIME_OPERATION_RESOURCE_ACTIONS_HANDLE_TYPE_BRAND]: true;
}

/** Opaque one-shot ticket retained for M04-T13's settlement-turn `finally`. */
export interface RuntimeOperationActionSettlementTicket {
  readonly [RUNTIME_OPERATION_ACTION_SETTLEMENT_TICKET_TYPE_BRAND]: true;
}

/** Why the complete T08/T09 action composition could not be mounted atomically. */
export type RuntimeOperationResourceActionsMountInvalidReason =
  | "already-owned-authority"
  | "invalid-operation-authority"
  | "invalid-resource-authority"
  | "invalid-operation-inventory"
  | "malformed-input";

/** Complete atomic result of mounting one operation/resource action compositor. */
export type RuntimeOperationResourceActionsMountResult =
  | Readonly<{
      readonly status: "mounted";
      readonly handle: RuntimeOperationResourceActionsHandle;
      readonly resourceSnapshot: RuntimeSurfaceResourcesSnapshot;
      readonly operationSnapshot: RuntimeSurfaceOperationsSnapshot;
    }>
  | Readonly<{
      readonly status: "invalid";
      readonly reason: RuntimeOperationResourceActionsMountInvalidReason;
      readonly diagnostics: readonly DesenDiagnostic<string>[];
    }>;

/** Settlement mapped to an immutable future action turn without exposing the T09 lease. */
export type RuntimeOperationActionSettlementDescriptor =
  | Readonly<{
      readonly status: "succeeded";
      readonly alias: string;
      readonly requestId: string;
      readonly operationSnapshot: RuntimeSurfaceOperationsSnapshot;
      readonly actions: readonly RuntimeDeferredActionSpec[];
      readonly ticket: RuntimeOperationActionSettlementTicket;
    }>
  | Readonly<{
      readonly status: "failed";
      readonly alias: string;
      readonly requestId: string;
      readonly errorCode: string;
      readonly operationSnapshot: RuntimeSurfaceOperationsSnapshot;
      readonly actions: readonly RuntimeDeferredActionSpec[];
      readonly ticket: RuntimeOperationActionSettlementTicket;
    }>
  | Readonly<{
      readonly status: "denied" | "invalid-output" | "adapter-failed";
      readonly alias: string;
      readonly requestId: string;
      readonly diagnostics: readonly DesenDiagnostic<string>[];
      readonly operationSnapshot: RuntimeSurfaceOperationsSnapshot;
      readonly actions: readonly RuntimeDeferredActionSpec[];
      readonly ticket: RuntimeOperationActionSettlementTicket;
    }>
  | Readonly<{
      readonly status: "superseded";
      readonly alias: string;
      readonly requestId: string;
      readonly operationSnapshot: RuntimeSurfaceOperationsSnapshot;
      readonly actions: readonly [];
    }>
  | Readonly<{
      readonly status: "disposed";
      readonly alias: string;
      readonly requestId: string;
      readonly actions: readonly [];
    }>;

interface RuntimeOperationActionAcceptedBase {
  readonly alias: string;
  readonly requestId: string;
  readonly operationSnapshot: RuntimeSurfaceOperationsSnapshot;
  readonly settlement: Promise<RuntimeOperationActionSettlementDescriptor>;
  readonly diagnostics: readonly DesenDiagnostic<string>[];
}

/** One operation invocation that started its host transport immediately. */
export interface RuntimeOperationActionStarted extends RuntimeOperationActionAcceptedBase {
  readonly status: "operation-started";
}

/** One operation invocation accepted behind an existing alias-local attempt. */
export interface RuntimeOperationActionQueued extends RuntimeOperationActionAcceptedBase {
  readonly status: "operation-queued";
  readonly position: number;
}

/** One operation invocation pending behind a predecessor settlement ticket. */
export interface RuntimeOperationActionStaged extends RuntimeOperationActionAcceptedBase {
  readonly status: "operation-staged";
}

/** One resource refresh accepted without blocking the originating action turn. */
export interface RuntimeResourceRefreshActionStarted {
  readonly status: "resource-started";
  readonly instanceId: string;
  readonly requestId: string;
  readonly resourceSnapshot: RuntimeSurfaceResourcesSnapshot;
  readonly settlement: Promise<RuntimeResourceSettlement>;
  readonly diagnostics: readonly DesenDiagnostic<string>[];
}

/** Complete synchronous outcome of one M04-T11 action. */
export type RuntimeOperationResourceActionResult =
  | RuntimeActionGuardRejected
  | RuntimeActionPayloadRejected
  | RuntimeActionSkipped
  | RuntimeOperationActionQueued
  | RuntimeOperationActionStaged
  | RuntimeOperationActionStarted
  | RuntimeResourceRefreshActionStarted
  | Readonly<{
      readonly status: "operation-rejected";
      readonly reason: "pending";
      readonly alias: string;
      readonly operationSnapshot: RuntimeSurfaceOperationsSnapshot;
    }>
  | Readonly<{
      readonly status: "operation-input-rejected";
      readonly alias: string;
      readonly diagnostics: readonly DesenDiagnostic<string>[];
    }>
  | Readonly<{
      readonly status: "unknown-operation-alias";
      readonly alias: string;
      readonly diagnostics: readonly DesenDiagnostic<string>[];
    }>
  | Readonly<{
      readonly status: "operation-capability-mismatch";
      readonly alias: string;
      readonly diagnostics: readonly DesenDiagnostic<string>[];
    }>
  | Readonly<{
      readonly status:
        | "operation-queue-limit"
        | "operation-attempt-limit"
        | "operation-snapshot-limit"
        | "operation-retained-limit";
      readonly alias: string;
      readonly diagnostics: readonly DesenDiagnostic<string>[];
    }>
  | Readonly<{
      readonly status: "resource-input-rejected";
      readonly reason: "resolution" | "schema";
      readonly instanceId: string;
      readonly parameter?: string;
      readonly resolution?: Exclude<RuntimeValueMaterialization, { readonly status: "resolved" }>;
      readonly diagnostics: readonly DesenDiagnostic<string>[];
    }>
  | Readonly<{
      readonly status: "resource-snapshot-limit" | "resource-attempt-limit";
      readonly instanceId: string;
      readonly diagnostics: readonly DesenDiagnostic<string>[];
    }>
  | Readonly<{
      readonly status: "unknown-resource";
      readonly resource: string;
      readonly diagnostics: readonly DesenDiagnostic<string>[];
    }>
  | Readonly<{
      readonly status: "settlement-limit";
      readonly reason: "pending-settlements" | "retained-actions" | "retained-handler-code-units";
      readonly diagnostics: readonly DesenDiagnostic<string>[];
    }>
  | Readonly<{
      readonly status: "invalid-action";
      readonly diagnostics: readonly DesenDiagnostic<string>[];
    }>
  | Readonly<{
      readonly status: "invalid-snapshot";
      readonly resourceSnapshot?: RuntimeSurfaceResourcesSnapshot;
      readonly operationSnapshot?: RuntimeSurfaceOperationsSnapshot;
    }>
  | Readonly<{
      readonly status: "invalid-authority";
      readonly boundary: "operation" | "resource";
    }>
  | Readonly<{ readonly status: "resource-disposed" }>
  | Readonly<{ readonly status: "operation-disposed" }>
  | Readonly<{ readonly status: "action-limit" }>
  | Readonly<{ readonly status: "busy" }>
  | Readonly<{ readonly status: "disposed" }>
  | Readonly<{ readonly status: "invalid-handle" }>;

/** Package-internal result consumed by the later turn coordinator. */
export type RuntimeOperationActionSettlementFinalizationResult =
  | Readonly<{
      readonly status: "finalized";
      readonly alias: string;
      readonly requestId: string;
      readonly operationSnapshot: RuntimeSurfaceOperationsSnapshot;
      readonly promotedRequestId?: string;
    }>
  | Readonly<{ readonly status: "already-finalized" }>
  | Readonly<{ readonly status: "disposed" }>
  | Readonly<{ readonly status: "busy" }>
  | Readonly<{ readonly status: "invalid-handle" }>
  | Readonly<{ readonly status: "invalid-ticket" }>;

/** Terminal disposal result for the compositor and both surrendered lifecycle managers. */
export type RuntimeOperationResourceActionsDisposeResult =
  | Readonly<{
      readonly status: "disposed";
      readonly disposedResources: number;
      readonly disposedInvocations: number;
      readonly invalidatedLeases: number;
    }>
  | Readonly<{
      readonly status: "already-disposed";
      readonly disposedResources: 0;
      readonly disposedInvocations: 0;
      readonly invalidatedLeases: 0;
    }>
  | Readonly<{
      readonly status: "invalid-handle";
      readonly disposedResources: 0;
      readonly disposedInvocations: 0;
      readonly invalidatedLeases: 0;
    }>;

interface RetentionReservation {
  active: boolean;
  readonly actionCount: number;
  readonly codeUnits: number;
}

interface OperationResourceActionAuthority {
  status: "live" | "revoked";
  readonly ownerKey: object;
  readonly documentId: string;
  readonly revision: string;
  readonly surfaceId: string;
  readonly operations: ReadonlyMap<string, string>;
  readonly resources: ReadonlySet<string>;
  readonly resourceHandle: RuntimeSurfaceResourcesHandle;
  readonly operationHandle: RuntimeSurfaceOperationsHandle;
  readonly hostPorts: RuntimeHostPorts;
  readonly limits: Required<RuntimeOperationResourceActionLimitProfile>;
  readonly reservations: Set<RetentionReservation>;
  nextActionGeneration: number;
  pendingSettlements: number;
  retainedSettlementActions: number;
  retainedHandlerCodeUnits: number;
  transitioning: boolean;
  reporting: boolean;
}

interface OperationResourceActionTombstone {
  readonly status: "disposed";
  readonly ownerKey: object;
}

interface SettlementTicketAuthority {
  readonly ownerKey: object;
  readonly operationHandle: RuntimeSurfaceOperationsHandle;
  readonly lease: RuntimeOperationSettlementLease;
  readonly reservation: RetentionReservation;
}

interface SettlementTicketFinal {
  readonly status: "finalized" | "disposed";
  readonly ownerKey: object;
}

interface MountEnvelope {
  readonly documentId: string;
  readonly revision: string;
  readonly surfaceId: string;
  readonly operations: RuntimeJsonObject;
  readonly resourceHandle: RuntimeSurfaceResourcesHandle;
  readonly resourceSnapshot: RuntimeSurfaceResourcesSnapshot;
  readonly operationHandle: RuntimeSurfaceOperationsHandle;
  readonly operationSnapshot: RuntimeSurfaceOperationsSnapshot;
  readonly hostPorts: RuntimeHostPorts;
  readonly limits: Required<RuntimeOperationResourceActionLimitProfile>;
}

interface CapturedHandlers {
  readonly onSuccess: readonly RuntimeDeferredActionSpec[];
  readonly onFailure: readonly RuntimeDeferredActionSpec[];
  readonly actionCount: number;
  readonly codeUnits: number;
}

const ACTION_AUTHORITIES = new WeakMap<
  object,
  OperationResourceActionAuthority | OperationResourceActionTombstone
>();
const SETTLEMENT_TICKETS = new WeakMap<object, SettlementTicketAuthority | SettlementTicketFinal>();
const CLAIMED_RESOURCE_HANDLES = new WeakSet<object>();
const CLAIMED_OPERATION_HANDLES = new WeakSet<object>();

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
  key: PropertyKey,
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

function exactAllowedKeys(
  object: object,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean {
  try {
    const keys = Reflect.ownKeys(object);
    if (keys.some((key) => typeof key !== "string")) return false;
    const names = keys as string[];
    const allowed = new Set([...required, ...optional]);
    return (
      required.every((key) => names.includes(key)) &&
      names.every((key) => allowed.has(key)) &&
      names.every((key) => {
        const descriptor = Object.getOwnPropertyDescriptor(object, key);
        return descriptor !== undefined && "value" in descriptor && descriptor.enumerable;
      })
    );
  } catch {
    return false;
  }
}

function readLimit(
  object: RuntimeJsonObject,
  key: keyof RuntimeOperationResourceActionLimitProfile,
  ceiling: number,
): number | undefined {
  if (!Object.hasOwn(object, key)) return ceiling;
  const value = object[key];
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= ceiling
    ? value
    : undefined;
}

function captureLimits(
  input: unknown,
): Required<RuntimeOperationResourceActionLimitProfile> | undefined {
  if (input === undefined) return { ...RUNTIME_OPERATION_RESOURCE_ACTION_LIMITS };
  const copied = snapshotRuntimeJsonValue(input);
  if (
    !isRuntimeJsonObject(copied) ||
    !exactAllowedKeys(
      copied,
      [],
      [
        "maxActionGeneration",
        "maxPendingSettlements",
        "maxRetainedHandlerCodeUnits",
        "maxRetainedSettlementActions",
      ],
    )
  ) {
    return undefined;
  }
  const maxActionGeneration = readLimit(
    copied,
    "maxActionGeneration",
    RUNTIME_OPERATION_RESOURCE_ACTION_LIMITS.maxActionGeneration,
  );
  const maxPendingSettlements = readLimit(
    copied,
    "maxPendingSettlements",
    RUNTIME_OPERATION_RESOURCE_ACTION_LIMITS.maxPendingSettlements,
  );
  const maxRetainedSettlementActions = readLimit(
    copied,
    "maxRetainedSettlementActions",
    RUNTIME_OPERATION_RESOURCE_ACTION_LIMITS.maxRetainedSettlementActions,
  );
  const maxRetainedHandlerCodeUnits = readLimit(
    copied,
    "maxRetainedHandlerCodeUnits",
    RUNTIME_OPERATION_RESOURCE_ACTION_LIMITS.maxRetainedHandlerCodeUnits,
  );
  return maxActionGeneration === undefined ||
    maxPendingSettlements === undefined ||
    maxRetainedSettlementActions === undefined ||
    maxRetainedHandlerCodeUnits === undefined
    ? undefined
    : {
        maxActionGeneration,
        maxPendingSettlements,
        maxRetainedSettlementActions,
        maxRetainedHandlerCodeUnits,
      };
}

function readMountEnvelope(input: unknown): MountEnvelope | undefined {
  if (
    !isPlainRecord(input) ||
    !exactAllowedKeys(
      input,
      [
        "documentId",
        "hostPorts",
        "operationHandle",
        "operationSnapshot",
        "operations",
        "resourceHandle",
        "resourceSnapshot",
        "revision",
        "surfaceId",
      ],
      ["limits"],
    )
  ) {
    return undefined;
  }
  const documentId = ownDataValue(input, "documentId");
  const revision = ownDataValue(input, "revision");
  const surfaceId = ownDataValue(input, "surfaceId");
  const operations = ownDataValue(input, "operations");
  const resourceHandle = ownDataValue(input, "resourceHandle");
  const resourceSnapshot = ownDataValue(input, "resourceSnapshot");
  const operationHandle = ownDataValue(input, "operationHandle");
  const operationSnapshot = ownDataValue(input, "operationSnapshot");
  const hostPorts = ownDataValue(input, "hostPorts");
  const limitsValue = ownDataValue(input, "limits");
  if (
    !documentId.valid ||
    !documentId.present ||
    typeof documentId.value !== "string" ||
    documentId.value.length === 0 ||
    documentId.value.length > RUNTIME_VALUE_SAFETY_LIMITS.maxStringCodeUnits ||
    !revision.valid ||
    !revision.present ||
    typeof revision.value !== "string" ||
    !isSha256Digest(revision.value) ||
    !surfaceId.valid ||
    !surfaceId.present ||
    typeof surfaceId.value !== "string" ||
    !LOCAL_IDENTIFIER_PATTERN.test(surfaceId.value) ||
    !operations.valid ||
    !operations.present ||
    !resourceHandle.valid ||
    !resourceHandle.present ||
    !resourceSnapshot.valid ||
    !resourceSnapshot.present ||
    !operationHandle.valid ||
    !operationHandle.present ||
    !operationSnapshot.valid ||
    !operationSnapshot.present ||
    !hostPorts.valid ||
    !hostPorts.present ||
    !limitsValue.valid
  ) {
    return undefined;
  }
  const copiedOperations = snapshotRuntimeJsonValue(operations.value);
  const limits = captureLimits(limitsValue.present ? limitsValue.value : undefined);
  if (!isRuntimeJsonObject(copiedOperations) || limits === undefined) return undefined;
  return Object.freeze({
    documentId: documentId.value,
    revision: revision.value,
    surfaceId: surfaceId.value,
    operations: copiedOperations,
    resourceHandle: resourceHandle.value as RuntimeSurfaceResourcesHandle,
    resourceSnapshot: resourceSnapshot.value as RuntimeSurfaceResourcesSnapshot,
    operationHandle: operationHandle.value as RuntimeSurfaceOperationsHandle,
    operationSnapshot: operationSnapshot.value as RuntimeSurfaceOperationsSnapshot,
    hostPorts: hostPorts.value as RuntimeHostPorts,
    limits,
  });
}

function captureOperationInventory(
  input: RuntimeJsonObject,
  snapshot: RuntimeSurfaceOperationsSnapshot,
): ReadonlyMap<string, string> | undefined {
  const names = Object.keys(input).sort(compareText);
  if (
    names.length !== Object.keys(snapshot.lifecycles).length ||
    names.some((name) => !Object.hasOwn(snapshot.lifecycles, name))
  ) {
    return undefined;
  }
  const operations = new Map<string, string>();
  for (const alias of names) {
    if (!LOCAL_IDENTIFIER_PATTERN.test(alias)) return undefined;
    const value = input[alias];
    if (
      !isRuntimeJsonObject(value) ||
      !exactAllowedKeys(value, ["operation"]) ||
      typeof value.operation !== "string" ||
      !CAPABILITY_IDENTIFIER_PATTERN.test(value.operation)
    ) {
      return undefined;
    }
    operations.set(alias, value.operation);
  }
  return operations;
}

function actionDiagnostic(
  code: string,
  message: string,
  authority: Pick<OperationResourceActionAuthority, "documentId" | "surfaceId">,
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
  code: "ADAPTER_FAILURE" | "PREDICATE_TYPE_MISMATCH" | "REFERENCE_UNRESOLVED",
  message: string,
  authority: Pick<OperationResourceActionAuthority, "documentId" | "surfaceId">,
  pointer?: JsonPointer,
): Readonly<DesenDiagnostic<string>> {
  return createCoreDiagnostic({
    code,
    message,
    ...(pointer === undefined ? {} : { pointer }),
    context: {
      documentId: authority.documentId,
      surfaceId: authority.surfaceId,
    },
  });
}

function safeReport(
  authority: OperationResourceActionAuthority,
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
        // Diagnostics are observational and cannot replace the controlled action result.
      }
    }
  } finally {
    authority.reporting = false;
  }
}

function predicateDiagnostics(
  authority: OperationResourceActionAuthority,
  diagnostics: readonly RuntimePredicateTypeMismatch[],
): readonly DesenDiagnostic<string>[] {
  return Object.freeze(
    diagnostics.map(({ pointer }) =>
      coreDiagnostic(
        "PREDICATE_TYPE_MISMATCH",
        "A guarded action predicate compared dynamically incompatible values.",
        authority,
        pointer,
      ),
    ),
  );
}

function currentSnapshots(authority: OperationResourceActionAuthority):
  | Readonly<{
      readonly status: "current";
      readonly resourceSnapshot: RuntimeSurfaceResourcesSnapshot;
      readonly operationSnapshot: RuntimeSurfaceOperationsSnapshot;
    }>
  | Readonly<{ readonly status: "resource-disposed" }>
  | Readonly<{ readonly status: "operation-disposed" }>
  | Readonly<{ readonly status: "invalid"; readonly boundary: "operation" | "resource" }> {
  const resource = readRuntimeSurfaceResources(authority.resourceHandle);
  if (resource.status === "disposed") return Object.freeze({ status: "resource-disposed" });
  if (resource.status !== "read") {
    return Object.freeze({ status: "invalid", boundary: "resource" });
  }
  const operation = readRuntimeSurfaceOperations(authority.operationHandle);
  if (operation.status === "disposed") return Object.freeze({ status: "operation-disposed" });
  if (operation.status !== "read") {
    return Object.freeze({ status: "invalid", boundary: "operation" });
  }
  return Object.freeze({
    status: "current",
    resourceSnapshot: resource.snapshot,
    operationSnapshot: operation.snapshot,
  });
}

function resolutionSnapshotMatches(
  snapshot: RuntimeResolutionSnapshot,
  resourceSnapshot: RuntimeSurfaceResourcesSnapshot,
  operationSnapshot: RuntimeSurfaceOperationsSnapshot,
): boolean {
  try {
    return (
      resolveRuntimeValue(null, snapshot).status === "resolved" &&
      canonicalizeJson(snapshot.resource) === canonicalizeJson(resourceSnapshot.lifecycles) &&
      canonicalizeJson(snapshot.operation) === canonicalizeJson(operationSnapshot.lifecycles)
    );
  } catch {
    return false;
  }
}

function observationFailure(
  authority: OperationResourceActionAuthority,
  expectedResource: RuntimeSurfaceResourcesSnapshot,
  expectedOperation: RuntimeSurfaceOperationsSnapshot,
): RuntimeOperationResourceActionResult | undefined {
  if (authority.status !== "live") return Object.freeze({ status: "disposed" });
  const current = currentSnapshots(authority);
  if (current.status === "resource-disposed") {
    return Object.freeze({ status: "resource-disposed" });
  }
  if (current.status === "operation-disposed") {
    return Object.freeze({ status: "operation-disposed" });
  }
  if (current.status === "invalid") {
    return Object.freeze({ status: "invalid-authority", boundary: current.boundary });
  }
  return current.resourceSnapshot === expectedResource &&
    current.operationSnapshot === expectedOperation
    ? undefined
    : Object.freeze({
        status: "invalid-snapshot",
        resourceSnapshot: current.resourceSnapshot,
        operationSnapshot: current.operationSnapshot,
      });
}

function nextRequestId(authority: OperationResourceActionAuthority): string | undefined {
  const generation = authority.nextActionGeneration;
  return Number.isSafeInteger(generation) && generation <= authority.limits.maxActionGeneration
    ? `operation-resource-action:${canonicalizeJson([authority.surfaceId, generation])}`
    : undefined;
}

function validateExtension(action: object): boolean {
  const extension = ownDataValue(action, "extensions");
  if (!extension.valid) return false;
  return !extension.present || isRuntimeJsonObject(snapshotRuntimeJsonValue(extension.value));
}

function invalidAction(
  authority: OperationResourceActionAuthority,
  message = "The guarded action is malformed or outside this primitive's closed vocabulary.",
  pointer: JsonPointer = ROOT_POINTER,
): Extract<RuntimeOperationResourceActionResult, { readonly status: "invalid-action" }> {
  return Object.freeze({
    status: "invalid-action",
    diagnostics: Object.freeze([
      actionDiagnostic("run.desen.runtime/ACTION_INPUT_INVALID", message, authority, pointer),
    ]),
  });
}

function guardRejected(
  authority: OperationResourceActionAuthority,
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
  authority: OperationResourceActionAuthority,
  result: Exclude<RuntimeValueMaterialization, { readonly status: "resolved" }>,
): RuntimeActionPayloadRejected {
  if (result.status === "failed") {
    return Object.freeze({
      status: "payload-rejected",
      reason: "adapter-failed",
      diagnostics: Object.freeze([
        coreDiagnostic(
          "ADAPTER_FAILURE",
          "The operation input token provider failed unexpectedly.",
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
          "A required operation input reference has no value or eligible fallback.",
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
        "The operation input is malformed or exceeds the runtime data boundary.",
        authority,
        result.pointer,
      ),
    ]),
  });
}

function captureHandlerArray(value: unknown): readonly RuntimeDeferredActionSpec[] | undefined {
  const copied = snapshotRuntimeJsonValue(value);
  if (!Array.isArray(copied) || copied.some((action) => !isRuntimeJsonObject(action))) {
    return undefined;
  }
  return copied as readonly RuntimeDeferredActionSpec[];
}

function captureHandlers(action: object): CapturedHandlers | undefined {
  const success = ownDataValue(action, "onSuccess");
  const failure = ownDataValue(action, "onFailure");
  if (!success.valid || !failure.valid) return undefined;
  const onSuccess = success.present ? captureHandlerArray(success.value) : EMPTY_ACTIONS;
  const onFailure = failure.present ? captureHandlerArray(failure.value) : EMPTY_ACTIONS;
  if (onSuccess === undefined || onFailure === undefined) return undefined;
  let codeUnits: number;
  try {
    codeUnits = canonicalizeJson([onSuccess, onFailure]).length;
  } catch {
    return undefined;
  }
  return Object.freeze({
    onSuccess,
    onFailure,
    actionCount: onSuccess.length + onFailure.length,
    codeUnits,
  });
}

function settlementLimit(
  authority: OperationResourceActionAuthority,
  handlers: CapturedHandlers,
):
  | Extract<RuntimeOperationResourceActionResult, { readonly status: "settlement-limit" }>
  | undefined {
  let reason:
    "pending-settlements" | "retained-actions" | "retained-handler-code-units" | undefined;
  if (authority.pendingSettlements >= authority.limits.maxPendingSettlements) {
    reason = "pending-settlements";
  } else if (
    authority.retainedSettlementActions + handlers.actionCount >
    authority.limits.maxRetainedSettlementActions
  ) {
    reason = "retained-actions";
  } else if (
    authority.retainedHandlerCodeUnits + handlers.codeUnits >
    authority.limits.maxRetainedHandlerCodeUnits
  ) {
    reason = "retained-handler-code-units";
  }
  if (reason === undefined) return undefined;
  const diagnostics = Object.freeze([
    actionDiagnostic(
      "run.desen.runtime/SETTLEMENT_RETENTION_LIMIT",
      "The bounded settlement-handler retention profile rejected this invocation.",
      authority,
    ),
  ]);
  safeReport(authority, diagnostics);
  return Object.freeze({ status: "settlement-limit", reason, diagnostics });
}

function reserveHandlers(
  authority: OperationResourceActionAuthority,
  handlers: CapturedHandlers,
): RetentionReservation {
  const reservation: RetentionReservation = {
    active: true,
    actionCount: handlers.actionCount,
    codeUnits: handlers.codeUnits,
  };
  authority.reservations.add(reservation);
  authority.pendingSettlements += 1;
  authority.retainedSettlementActions += handlers.actionCount;
  authority.retainedHandlerCodeUnits += handlers.codeUnits;
  return reservation;
}

function releaseReservation(
  authority: OperationResourceActionAuthority,
  reservation: RetentionReservation,
): void {
  if (!reservation.active) return;
  reservation.active = false;
  authority.reservations.delete(reservation);
  authority.pendingSettlements -= 1;
  authority.retainedSettlementActions -= reservation.actionCount;
  authority.retainedHandlerCodeUnits -= reservation.codeUnits;
}

function releaseAllReservations(authority: OperationResourceActionAuthority): void {
  for (const reservation of authority.reservations) reservation.active = false;
  authority.reservations.clear();
  authority.pendingSettlements = 0;
  authority.retainedSettlementActions = 0;
  authority.retainedHandlerCodeUnits = 0;
}

function createSettlementTicket(
  authority: OperationResourceActionAuthority,
  lease: RuntimeOperationSettlementLease,
  reservation: RetentionReservation,
): RuntimeOperationActionSettlementTicket {
  const ticket = Object.freeze({}) as RuntimeOperationActionSettlementTicket;
  SETTLEMENT_TICKETS.set(ticket, {
    ownerKey: authority.ownerKey,
    operationHandle: authority.operationHandle,
    lease,
    reservation,
  });
  return ticket;
}

function mapOperationSettlement(
  authority: OperationResourceActionAuthority,
  raw: Promise<RuntimeOperationSettlement>,
  handlers: CapturedHandlers,
  reservation: RetentionReservation,
): Promise<RuntimeOperationActionSettlementDescriptor> {
  return raw.then(
    (settlement) => {
      if (authority.status !== "live") {
        releaseReservation(authority, reservation);
        return Object.freeze({
          status: "disposed",
          alias: settlement.alias,
          requestId: settlement.requestId,
          actions: EMPTY_ACTIONS,
        });
      }
      const operationManager = readRuntimeSurfaceOperations(authority.operationHandle);
      if (operationManager.status !== "read") {
        releaseReservation(authority, reservation);
        return Object.freeze({
          status: "disposed",
          alias: settlement.alias,
          requestId: settlement.requestId,
          actions: EMPTY_ACTIONS,
        });
      }
      if (settlement.status === "superseded") {
        releaseReservation(authority, reservation);
        return Object.freeze({
          status: "superseded",
          alias: settlement.alias,
          requestId: settlement.requestId,
          operationSnapshot: settlement.snapshot,
          actions: EMPTY_ACTIONS,
        });
      }
      if (settlement.status === "disposed") {
        releaseReservation(authority, reservation);
        return Object.freeze({
          status: "disposed",
          alias: settlement.alias,
          requestId: settlement.requestId,
          actions: EMPTY_ACTIONS,
        });
      }
      const actions = settlement.status === "succeeded" ? handlers.onSuccess : handlers.onFailure;
      const ticket = createSettlementTicket(authority, settlement.lease, reservation);
      if (settlement.status === "succeeded") {
        return Object.freeze({
          status: "succeeded",
          alias: settlement.alias,
          requestId: settlement.requestId,
          operationSnapshot: settlement.snapshot,
          actions,
          ticket,
        });
      }
      if (settlement.status === "failed") {
        return Object.freeze({
          status: "failed",
          alias: settlement.alias,
          requestId: settlement.requestId,
          errorCode: settlement.errorCode,
          operationSnapshot: settlement.snapshot,
          actions,
          ticket,
        });
      }
      return Object.freeze({
        status: settlement.status,
        alias: settlement.alias,
        requestId: settlement.requestId,
        diagnostics: settlement.diagnostics,
        operationSnapshot: settlement.snapshot,
        actions,
        ticket,
      });
    },
    () => {
      releaseReservation(authority, reservation);
      return Object.freeze({
        status: "disposed",
        alias: "",
        requestId: "",
        actions: EMPTY_ACTIONS,
      });
    },
  );
}

/** Mounts one exclusive action compositor over exact current T08 and T09 authorities. */
export function mountRuntimeOperationResourceActions(
  input: RuntimeOperationResourceActionsMountInput,
): RuntimeOperationResourceActionsMountResult {
  const envelope = readMountEnvelope(input);
  if (envelope === undefined) {
    return Object.freeze({
      status: "invalid",
      reason: "malformed-input",
      diagnostics: EMPTY_DIAGNOSTICS,
    });
  }
  if (
    typeof envelope.resourceHandle !== "object" ||
    envelope.resourceHandle === null ||
    typeof envelope.operationHandle !== "object" ||
    envelope.operationHandle === null
  ) {
    return Object.freeze({
      status: "invalid",
      reason: "malformed-input",
      diagnostics: EMPTY_DIAGNOSTICS,
    });
  }
  if (
    CLAIMED_RESOURCE_HANDLES.has(envelope.resourceHandle) ||
    CLAIMED_OPERATION_HANDLES.has(envelope.operationHandle)
  ) {
    return Object.freeze({
      status: "invalid",
      reason: "already-owned-authority",
      diagnostics: EMPTY_DIAGNOSTICS,
    });
  }
  const resource = readRuntimeSurfaceResources(envelope.resourceHandle);
  if (
    resource.status !== "read" ||
    resource.snapshot !== envelope.resourceSnapshot ||
    resource.snapshot.documentId !== envelope.documentId ||
    resource.snapshot.revision !== envelope.revision ||
    resource.snapshot.surfaceId !== envelope.surfaceId
  ) {
    return Object.freeze({
      status: "invalid",
      reason: "invalid-resource-authority",
      diagnostics: EMPTY_DIAGNOSTICS,
    });
  }
  const operation = readRuntimeSurfaceOperations(envelope.operationHandle);
  if (
    operation.status !== "read" ||
    operation.snapshot !== envelope.operationSnapshot ||
    operation.snapshot.documentId !== envelope.documentId ||
    operation.snapshot.revision !== envelope.revision ||
    operation.snapshot.surfaceId !== envelope.surfaceId
  ) {
    return Object.freeze({
      status: "invalid",
      reason: "invalid-operation-authority",
      diagnostics: EMPTY_DIAGNOSTICS,
    });
  }
  const operations = captureOperationInventory(envelope.operations, envelope.operationSnapshot);
  if (operations === undefined) {
    return Object.freeze({
      status: "invalid",
      reason: "invalid-operation-inventory",
      diagnostics: EMPTY_DIAGNOSTICS,
    });
  }
  let hostPorts: RuntimeHostPorts;
  try {
    hostPorts = createRuntimeHostPorts(envelope.hostPorts);
  } catch {
    return Object.freeze({
      status: "invalid",
      reason: "malformed-input",
      diagnostics: EMPTY_DIAGNOSTICS,
    });
  }
  const recapturedResource = readRuntimeSurfaceResources(envelope.resourceHandle);
  const recapturedOperation = readRuntimeSurfaceOperations(envelope.operationHandle);
  if (
    recapturedResource.status !== "read" ||
    recapturedResource.snapshot !== envelope.resourceSnapshot
  ) {
    return Object.freeze({
      status: "invalid",
      reason: "invalid-resource-authority",
      diagnostics: EMPTY_DIAGNOSTICS,
    });
  }
  if (
    recapturedOperation.status !== "read" ||
    recapturedOperation.snapshot !== envelope.operationSnapshot
  ) {
    return Object.freeze({
      status: "invalid",
      reason: "invalid-operation-authority",
      diagnostics: EMPTY_DIAGNOSTICS,
    });
  }
  if (
    CLAIMED_RESOURCE_HANDLES.has(envelope.resourceHandle) ||
    CLAIMED_OPERATION_HANDLES.has(envelope.operationHandle)
  ) {
    return Object.freeze({
      status: "invalid",
      reason: "already-owned-authority",
      diagnostics: EMPTY_DIAGNOSTICS,
    });
  }
  const authority: OperationResourceActionAuthority = {
    status: "live",
    ownerKey: Object.freeze({}),
    documentId: envelope.documentId,
    revision: envelope.revision,
    surfaceId: envelope.surfaceId,
    operations,
    resources: new Set(Object.keys(envelope.resourceSnapshot.lifecycles)),
    resourceHandle: envelope.resourceHandle,
    operationHandle: envelope.operationHandle,
    hostPorts,
    limits: envelope.limits,
    reservations: new Set(),
    nextActionGeneration: 0,
    pendingSettlements: 0,
    retainedSettlementActions: 0,
    retainedHandlerCodeUnits: 0,
    transitioning: false,
    reporting: false,
  };
  CLAIMED_RESOURCE_HANDLES.add(envelope.resourceHandle);
  CLAIMED_OPERATION_HANDLES.add(envelope.operationHandle);
  const handle = Object.freeze({}) as RuntimeOperationResourceActionsHandle;
  ACTION_AUTHORITIES.set(handle, authority);
  return Object.freeze({
    status: "mounted",
    handle,
    resourceSnapshot: envelope.resourceSnapshot,
    operationSnapshot: envelope.operationSnapshot,
  });
}

/**
 * Executes exactly one guarded `operation.invoke` or `resource.refresh` action.
 *
 * @remarks A false guard precedes every type-specific observation. Operation settlement and
 * resource loading never block the originating action turn.
 */
export function executeRuntimeOperationResourceAction(
  handle: RuntimeOperationResourceActionsHandle,
  action: RuntimeOperationResourceAction,
  snapshot: RuntimeResolutionSnapshot,
  resourceSnapshot: RuntimeSurfaceResourcesSnapshot,
  operationSnapshot: RuntimeSurfaceOperationsSnapshot,
): RuntimeOperationResourceActionResult {
  if (typeof handle !== "object" || handle === null) {
    return Object.freeze({ status: "invalid-handle" });
  }
  const authority = ACTION_AUTHORITIES.get(handle);
  if (authority === undefined) return Object.freeze({ status: "invalid-handle" });
  if (authority.status !== "live") return Object.freeze({ status: "disposed" });
  if (authority.transitioning || authority.reporting) return Object.freeze({ status: "busy" });

  const current = currentSnapshots(authority);
  if (current.status === "resource-disposed") {
    return Object.freeze({ status: "resource-disposed" });
  }
  if (current.status === "operation-disposed") {
    return Object.freeze({ status: "operation-disposed" });
  }
  if (current.status === "invalid") {
    return Object.freeze({ status: "invalid-authority", boundary: current.boundary });
  }
  if (
    current.resourceSnapshot !== resourceSnapshot ||
    current.operationSnapshot !== operationSnapshot ||
    !resolutionSnapshotMatches(snapshot, resourceSnapshot, operationSnapshot)
  ) {
    return Object.freeze({
      status: "invalid-snapshot",
      resourceSnapshot: current.resourceSnapshot,
      operationSnapshot: current.operationSnapshot,
    });
  }
  const requestId = nextRequestId(authority);
  if (requestId === undefined) return Object.freeze({ status: "action-limit" });

  authority.transitioning = true;
  try {
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
        isActive: () => authority.status === "live",
      });
    } catch {
      const rejected = guardRejected(authority, "invalid", ROOT_POINTER);
      return observationFailure(authority, resourceSnapshot, operationSnapshot) ?? rejected;
    }

    const capturedWhen = captureRuntimeActionWhen(action);
    const afterWhen = observationFailure(authority, resourceSnapshot, operationSnapshot);
    if (afterWhen !== undefined) return afterWhen;
    if (capturedWhen.status === "invalid") {
      const rejected = guardRejected(authority, "invalid", capturedWhen.pointer);
      return observationFailure(authority, resourceSnapshot, operationSnapshot) ?? rejected;
    }
    const evaluated = evaluateRuntimeActionGuard(session, capturedWhen.when, snapshot);
    const afterGuard = observationFailure(authority, resourceSnapshot, operationSnapshot);
    if (afterGuard !== undefined) return afterGuard;
    if (evaluated.status !== "evaluated") {
      const rejected = guardRejected(
        authority,
        evaluated.status === "adapter-failed" ? "adapter-failed" : "invalid",
        evaluated.pointer,
      );
      return observationFailure(authority, resourceSnapshot, operationSnapshot) ?? rejected;
    }
    const guardDiagnostics = predicateDiagnostics(authority, evaluated.diagnostics);
    if (!evaluated.value) {
      return Object.freeze({ status: "skipped", diagnostics: guardDiagnostics });
    }
    if (guardDiagnostics.length > 0) {
      safeReport(authority, guardDiagnostics);
      const afterReport = observationFailure(authority, resourceSnapshot, operationSnapshot);
      if (afterReport !== undefined) return afterReport;
    }

    const plainAction = isPlainRecord(action);
    const afterPrototype = observationFailure(authority, resourceSnapshot, operationSnapshot);
    if (afterPrototype !== undefined) return afterPrototype;
    if (!plainAction) return invalidAction(authority);
    const type = ownDataValue(action, "type");
    const afterType = observationFailure(authority, resourceSnapshot, operationSnapshot);
    if (afterType !== undefined) return afterType;
    if (!type.valid || !type.present || typeof type.value !== "string") {
      return invalidAction(authority, "The guarded action type is missing or invalid.");
    }

    if (type.value === "operation.invoke") {
      const alias = ownDataValue(action, "as");
      const operation = ownDataValue(action, "operation");
      const afterTarget = observationFailure(authority, resourceSnapshot, operationSnapshot);
      if (afterTarget !== undefined) return afterTarget;
      if (
        !alias.valid ||
        !alias.present ||
        typeof alias.value !== "string" ||
        !LOCAL_IDENTIFIER_PATTERN.test(alias.value)
      ) {
        return invalidAction(
          authority,
          "The operation alias is missing or invalid.",
          ALIAS_POINTER,
        );
      }
      const mountedOperation = authority.operations.get(alias.value);
      if (mountedOperation === undefined) {
        const diagnostics = Object.freeze([
          coreDiagnostic(
            "REFERENCE_UNRESOLVED",
            "The operation alias is absent from the mounted surface inventory.",
            authority,
            ALIAS_POINTER,
          ),
        ]);
        safeReport(authority, diagnostics);
        const rejected = Object.freeze({
          status: "unknown-operation-alias",
          alias: alias.value,
          diagnostics,
        } as const);
        return observationFailure(authority, resourceSnapshot, operationSnapshot) ?? rejected;
      }
      if (
        !operation.valid ||
        !operation.present ||
        typeof operation.value !== "string" ||
        !CAPABILITY_IDENTIFIER_PATTERN.test(operation.value)
      ) {
        return invalidAction(
          authority,
          "The operation capability assertion is missing or invalid.",
          OPERATION_POINTER,
        );
      }
      if (operation.value !== mountedOperation) {
        const diagnostics = Object.freeze([
          actionDiagnostic(
            "run.desen.runtime/OPERATION_CAPABILITY_MISMATCH",
            "The invocation capability assertion does not match its mounted alias.",
            authority,
            OPERATION_POINTER,
          ),
        ]);
        safeReport(authority, diagnostics);
        const rejected = Object.freeze({
          status: "operation-capability-mismatch",
          alias: alias.value,
          diagnostics,
        } as const);
        return observationFailure(authority, resourceSnapshot, operationSnapshot) ?? rejected;
      }
      const validShape =
        exactAllowedKeys(
          action,
          ["as", "input", "operation", "type"],
          ["concurrency", "extensions", "onFailure", "onSuccess", "when"],
        ) && validateExtension(action);
      const afterShape = observationFailure(authority, resourceSnapshot, operationSnapshot);
      if (afterShape !== undefined) return afterShape;
      if (!validShape) return invalidAction(authority);
      const input = ownDataValue(action, "input");
      const concurrency = ownDataValue(action, "concurrency");
      const handlers = captureHandlers(action);
      const afterCapture = observationFailure(authority, resourceSnapshot, operationSnapshot);
      if (afterCapture !== undefined) return afterCapture;
      if (
        !input.valid ||
        !input.present ||
        !concurrency.valid ||
        (concurrency.present &&
          concurrency.value !== "reject" &&
          concurrency.value !== "replace" &&
          concurrency.value !== "queue") ||
        handlers === undefined
      ) {
        return invalidAction(authority);
      }
      const limit = settlementLimit(authority, handlers);
      const afterLimit = observationFailure(authority, resourceSnapshot, operationSnapshot);
      if (afterLimit !== undefined) return afterLimit;
      if (limit !== undefined) return limit;
      const reservation = reserveHandlers(authority, handlers);

      const materialized = materializeRuntimeActionNamedValues(session, input.value, snapshot);
      const afterInput = observationFailure(authority, resourceSnapshot, operationSnapshot);
      if (afterInput !== undefined) {
        releaseReservation(authority, reservation);
        return afterInput;
      }
      if (materialized.status !== "resolved") {
        releaseReservation(authority, reservation);
        const rejected = payloadRejected(authority, materialized);
        safeReport(authority, rejected.diagnostics);
        return observationFailure(authority, resourceSnapshot, operationSnapshot) ?? rejected;
      }
      if (!isRuntimeJsonObject(materialized.value)) {
        releaseReservation(authority, reservation);
        return invalidAction(authority);
      }
      const beforeInvoke = observationFailure(authority, resourceSnapshot, operationSnapshot);
      if (beforeInvoke !== undefined) {
        releaseReservation(authority, reservation);
        return beforeInvoke;
      }
      const invoked = invokeRuntimeOperation(authority.operationHandle, {
        alias: alias.value,
        operation: operation.value,
        input: materialized.value,
        operationSnapshot,
        ...(concurrency.present
          ? { concurrency: concurrency.value as RuntimeOperationConcurrency }
          : {}),
      });
      if (
        invoked.status === "started" ||
        invoked.status === "queued" ||
        invoked.status === "staged"
      ) {
        authority.nextActionGeneration += 1;
        const settlement = mapOperationSettlement(
          authority,
          invoked.settlement,
          handlers,
          reservation,
        );
        const base = {
          alias: invoked.alias,
          requestId: invoked.requestId,
          operationSnapshot: invoked.snapshot,
          settlement,
          diagnostics: Object.freeze([...guardDiagnostics]),
        } as const;
        if (invoked.status === "queued") {
          return Object.freeze({
            status: "operation-queued",
            ...base,
            position: invoked.position,
          });
        }
        return Object.freeze({
          status: invoked.status === "started" ? "operation-started" : "operation-staged",
          ...base,
        });
      }
      releaseReservation(authority, reservation);
      const afterInvoke = observationFailure(authority, resourceSnapshot, operationSnapshot);
      if (afterInvoke !== undefined) return afterInvoke;
      if (invoked.status === "rejected") {
        return Object.freeze({
          status: "operation-rejected",
          reason: invoked.reason,
          alias: invoked.alias,
          operationSnapshot: invoked.snapshot,
        });
      }
      if (invoked.status === "input-rejected") {
        return Object.freeze({
          status: "operation-input-rejected",
          alias: invoked.alias,
          diagnostics: invoked.diagnostics,
        });
      }
      if (invoked.status === "unknown-alias") {
        return Object.freeze({
          status: "unknown-operation-alias",
          alias: invoked.alias,
          diagnostics: invoked.diagnostics,
        });
      }
      if (invoked.status === "capability-mismatch") {
        return Object.freeze({
          status: "operation-capability-mismatch",
          alias: invoked.alias,
          diagnostics: invoked.diagnostics,
        });
      }
      if (
        invoked.status === "queue-limit" ||
        invoked.status === "attempt-limit" ||
        invoked.status === "snapshot-limit" ||
        invoked.status === "retained-limit"
      ) {
        return Object.freeze({
          status: `operation-${invoked.status}` as
            | "operation-attempt-limit"
            | "operation-queue-limit"
            | "operation-retained-limit"
            | "operation-snapshot-limit",
          alias: invoked.alias,
          diagnostics: invoked.diagnostics,
        });
      }
      if (invoked.status === "disposed") return Object.freeze({ status: "operation-disposed" });
      if (invoked.status === "busy") return Object.freeze({ status: "busy" });
      if (invoked.status === "invalid-snapshot") {
        return Object.freeze({
          status: "invalid-snapshot",
          resourceSnapshot,
          operationSnapshot: invoked.snapshot,
        });
      }
      return Object.freeze({ status: "invalid-authority", boundary: "operation" });
    }

    if (type.value === "resource.refresh") {
      const resource = ownDataValue(action, "resource");
      const afterTarget = observationFailure(authority, resourceSnapshot, operationSnapshot);
      if (afterTarget !== undefined) return afterTarget;
      if (
        !resource.valid ||
        !resource.present ||
        typeof resource.value !== "string" ||
        !LOCAL_IDENTIFIER_PATTERN.test(resource.value)
      ) {
        return invalidAction(
          authority,
          "The resource instance identifier is missing or invalid.",
          RESOURCE_POINTER,
        );
      }
      if (!authority.resources.has(resource.value)) {
        const diagnostics = Object.freeze([
          coreDiagnostic(
            "REFERENCE_UNRESOLVED",
            "The refresh target is absent from the current surface resource inventory.",
            authority,
            RESOURCE_POINTER,
          ),
        ]);
        safeReport(authority, diagnostics);
        const rejected = Object.freeze({
          status: "unknown-resource",
          resource: resource.value,
          diagnostics,
        } as const);
        return observationFailure(authority, resourceSnapshot, operationSnapshot) ?? rejected;
      }
      const validShape =
        exactAllowedKeys(action, ["resource", "type"], ["extensions", "when"]) &&
        validateExtension(action);
      const afterShape = observationFailure(authority, resourceSnapshot, operationSnapshot);
      if (afterShape !== undefined) return afterShape;
      if (!validShape) return invalidAction(authority);
      const beforeRefresh = observationFailure(authority, resourceSnapshot, operationSnapshot);
      if (beforeRefresh !== undefined) return beforeRefresh;
      const refreshed = refreshRuntimeSurfaceResource(authority.resourceHandle, {
        instanceId: resource.value,
        resourceSnapshot,
        snapshot,
      });
      if (refreshed.status === "started") {
        authority.nextActionGeneration += 1;
        return Object.freeze({
          status: "resource-started",
          instanceId: refreshed.instanceId,
          requestId: refreshed.requestId,
          resourceSnapshot: refreshed.snapshot,
          settlement: refreshed.settlement,
          diagnostics: Object.freeze([...guardDiagnostics]),
        });
      }
      const afterRefresh = observationFailure(authority, resourceSnapshot, operationSnapshot);
      if (afterRefresh !== undefined) return afterRefresh;
      if (refreshed.status === "input-rejected") {
        return Object.freeze({
          status: "resource-input-rejected",
          reason: refreshed.reason,
          instanceId: refreshed.instanceId,
          ...("parameter" in refreshed ? { parameter: refreshed.parameter } : {}),
          ...("resolution" in refreshed ? { resolution: refreshed.resolution } : {}),
          diagnostics: refreshed.diagnostics,
        });
      }
      if (refreshed.status === "snapshot-limit") {
        return Object.freeze({
          status: "resource-snapshot-limit",
          instanceId: refreshed.instanceId,
          diagnostics: refreshed.diagnostics,
        });
      }
      if (refreshed.status === "attempt-limit") {
        return Object.freeze({
          status: "resource-attempt-limit",
          instanceId: refreshed.instanceId,
          diagnostics: EMPTY_DIAGNOSTICS,
        });
      }
      if (refreshed.status === "unknown-instance") {
        const diagnostics = Object.freeze([
          coreDiagnostic(
            "REFERENCE_UNRESOLVED",
            "The refresh target is absent from the current surface resource inventory.",
            authority,
            RESOURCE_POINTER,
          ),
        ]);
        return Object.freeze({
          status: "unknown-resource",
          resource: refreshed.instanceId,
          diagnostics,
        });
      }
      if (refreshed.status === "disposed") return Object.freeze({ status: "resource-disposed" });
      if (refreshed.status === "busy") return Object.freeze({ status: "busy" });
      if (refreshed.status === "invalid-snapshot") {
        return Object.freeze({
          status: "invalid-snapshot",
          resourceSnapshot: refreshed.snapshot,
          operationSnapshot,
        });
      }
      return Object.freeze({ status: "invalid-authority", boundary: "resource" });
    }

    return invalidAction(
      authority,
      "This primitive accepts only operation.invoke and resource.refresh.",
    );
  } finally {
    authority.transitioning = false;
  }
}

/**
 * Finishes one terminal operation settlement after M04-T13's new action turn has ended.
 *
 * @internal The raw T09 lease never crosses this opaque ticket boundary.
 */
export function finalizeRuntimeOperationActionSettlement(
  handle: RuntimeOperationResourceActionsHandle,
  ticket: RuntimeOperationActionSettlementTicket,
): RuntimeOperationActionSettlementFinalizationResult {
  if (
    typeof handle !== "object" ||
    handle === null ||
    typeof ticket !== "object" ||
    ticket === null
  ) {
    return Object.freeze({
      status: typeof handle !== "object" || handle === null ? "invalid-handle" : "invalid-ticket",
    });
  }
  const owner = ACTION_AUTHORITIES.get(handle);
  if (owner === undefined) return Object.freeze({ status: "invalid-handle" });
  const ticketAuthority = SETTLEMENT_TICKETS.get(ticket);
  if (ticketAuthority === undefined) return Object.freeze({ status: "invalid-ticket" });
  if (ticketAuthority.ownerKey !== owner.ownerKey) {
    return Object.freeze({ status: "invalid-ticket" });
  }
  if ("status" in ticketAuthority) {
    return Object.freeze({
      status: ticketAuthority.status === "finalized" ? "already-finalized" : "disposed",
    });
  }
  if (owner.status === "disposed") {
    SETTLEMENT_TICKETS.set(ticket, Object.freeze({ status: "disposed", ownerKey: owner.ownerKey }));
    return Object.freeze({ status: "disposed" });
  }
  if (owner.status !== "live") {
    releaseReservation(owner, ticketAuthority.reservation);
    SETTLEMENT_TICKETS.set(ticket, Object.freeze({ status: "disposed", ownerKey: owner.ownerKey }));
    return Object.freeze({ status: "disposed" });
  }
  if (owner.transitioning || owner.reporting) return Object.freeze({ status: "busy" });

  owner.transitioning = true;
  try {
    const acknowledged = acknowledgeRuntimeOperationSettlement(
      ticketAuthority.operationHandle,
      ticketAuthority.lease,
    );
    if (acknowledged.status === "busy") return Object.freeze({ status: "busy" });
    if (acknowledged.status === "disposed") {
      releaseReservation(owner, ticketAuthority.reservation);
      SETTLEMENT_TICKETS.set(
        ticket,
        Object.freeze({ status: "disposed", ownerKey: owner.ownerKey }),
      );
      return Object.freeze({ status: "disposed" });
    }
    if (acknowledged.status === "acknowledged") {
      releaseReservation(owner, ticketAuthority.reservation);
      SETTLEMENT_TICKETS.set(
        ticket,
        Object.freeze({ status: "finalized", ownerKey: owner.ownerKey }),
      );
      return Object.freeze({
        status: "finalized",
        alias: acknowledged.alias,
        requestId: acknowledged.requestId,
        operationSnapshot: acknowledged.snapshot,
        ...(acknowledged.promotedRequestId === undefined
          ? {}
          : { promotedRequestId: acknowledged.promotedRequestId }),
      });
    }
    if (acknowledged.status === "already-acknowledged") {
      releaseReservation(owner, ticketAuthority.reservation);
      SETTLEMENT_TICKETS.set(
        ticket,
        Object.freeze({ status: "finalized", ownerKey: owner.ownerKey }),
      );
      return Object.freeze({ status: "already-finalized" });
    }
    return Object.freeze({ status: "invalid-ticket" });
  } finally {
    owner.transitioning = false;
  }
}

/** Terminally revokes this compositor and both exclusively surrendered T08/T09 managers. */
export function disposeRuntimeOperationResourceActions(
  handle: RuntimeOperationResourceActionsHandle,
): RuntimeOperationResourceActionsDisposeResult {
  if (typeof handle !== "object" || handle === null) {
    return Object.freeze({
      status: "invalid-handle",
      disposedResources: 0,
      disposedInvocations: 0,
      invalidatedLeases: 0,
    });
  }
  const authority = ACTION_AUTHORITIES.get(handle);
  if (authority === undefined) {
    return Object.freeze({
      status: "invalid-handle",
      disposedResources: 0,
      disposedInvocations: 0,
      invalidatedLeases: 0,
    });
  }
  if (authority.status !== "live") {
    return Object.freeze({
      status: "already-disposed",
      disposedResources: 0,
      disposedInvocations: 0,
      invalidatedLeases: 0,
    });
  }
  authority.status = "revoked";
  releaseAllReservations(authority);
  const operations = disposeRuntimeSurfaceOperations(authority.operationHandle);
  const resources = disposeRuntimeSurfaceResources(authority.resourceHandle);
  ACTION_AUTHORITIES.set(
    handle,
    Object.freeze({ status: "disposed", ownerKey: authority.ownerKey }),
  );
  return Object.freeze({
    status: "disposed",
    disposedResources: resources.status === "disposed" ? resources.disposedAttempts : 0,
    disposedInvocations: operations.status === "disposed" ? operations.disposedInvocations : 0,
    invalidatedLeases: operations.status === "disposed" ? operations.invalidatedLeases : 0,
  });
}
