import {
  canonicalizeJson,
  createCoreDiagnostic,
  createJsonPointer,
  isSha256Digest,
} from "@desen/protocol";
import { validateDesenExecutionCatalogSet, validateDesenExecutionValue } from "@desen/validator";

import { createRuntimeHostPorts } from "./host-ports.js";
import { isRuntimeJsonObject, snapshotRuntimeJsonValue } from "./runtime-json-snapshot.js";
import { RUNTIME_VALUE_SAFETY_LIMITS } from "./value-resolution.js";

import type { DesenCatalog, DesenDiagnostic, JsonPointer } from "@desen/protocol";
import type { DesenValidatedExecutionCatalogSet, ImmutableJson } from "@desen/validator";
import type {
  RuntimeHostCallResult,
  RuntimeHostPorts,
  RuntimeJsonObject,
  RuntimeJsonValue,
  RuntimeOperationEffect,
  RuntimeOperationRequest,
} from "./host-ports.js";
import type { RuntimeLifecycleReferenceSnapshot } from "./value-resolution.js";

const LOCAL_IDENTIFIER_PATTERN = /^[A-Za-z][A-Za-z0-9._:-]{0,127}$/u;
const CAPABILITY_IDENTIFIER_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9.-]*\/[A-Za-z][A-Za-z0-9._:-]{0,127}$/u;
const ROOT_POINTER = createJsonPointer();
const EMPTY_DIAGNOSTICS = Object.freeze([]) as readonly DesenDiagnostic<string>[];
const DISPOSED_OPERATION_AUTHORITY = Symbol("disposed-operation-authority");
const OPERATION_AUTHORITIES = new WeakMap<
  object,
  OperationAuthority | typeof DISPOSED_OPERATION_AUTHORITY
>();
const SETTLEMENT_LEASES = new WeakMap<
  object,
  OperationLeaseAuthority | OperationLeaseFinalAuthority
>();
declare const RUNTIME_SURFACE_OPERATIONS_HANDLE_TYPE_BRAND: unique symbol;
declare const RUNTIME_OPERATION_SETTLEMENT_LEASE_TYPE_BRAND: unique symbol;

/** Finite default ceilings for one surface-local operation manager. */
export const RUNTIME_OPERATION_LIMITS = Object.freeze({
  /** Largest zero-based alias-local attempt generation represented exactly. */
  maxAttemptGeneration: Number.MAX_SAFE_INTEGER,
  /** Largest surface snapshot generation represented exactly. */
  maxSnapshotGeneration: Number.MAX_SAFE_INTEGER,
  /** Largest aggregate number of accepted queued invocations retained by one manager. */
  maxQueuedInvocations: 64,
  /** Largest number of underlying host transports active at once. */
  maxActiveTransports: 64,
} as const);

/** Closed concurrency vocabulary defined by DESEN 0.1.0. */
export type RuntimeOperationConcurrency = "queue" | "reject" | "replace";

/** Optional trusted host profile that may only lower operation-manager ceilings. */
export interface RuntimeOperationLimitProfile {
  /** Inclusive largest alias-local attempt generation. */
  readonly maxAttemptGeneration?: number;
  /** Inclusive largest public snapshot generation. */
  readonly maxSnapshotGeneration?: number;
  /** Largest aggregate accepted queue retained across every mounted alias. */
  readonly maxQueuedInvocations?: number;
  /** Largest concurrent underlying operation transports. */
  readonly maxActiveTransports?: number;
}

/** One operation alias indexed from an already validated complete surface. */
export interface RuntimeSurfaceOperationAliasSpec {
  /** Exact operation capability identifier fixed for this surface lifetime. */
  readonly operation: string;
}

/** Caller-owned data required to create one surface-local operation manager. */
export interface RuntimeSurfaceOperationsMountInput {
  /** Active Source or Bundle document identifier. */
  readonly documentId: string;
  /** Exact active Bundle revision. */
  readonly revision: string;
  /** Surface that owns every invocation alias. */
  readonly surfaceId: string;
  /** Complete alias inventory projected from cumulative whole-surface validation. */
  readonly aliases: Readonly<Record<string, RuntimeSurfaceOperationAliasSpec>>;
  /** Factory-authenticated cumulative execution Catalog set. */
  readonly catalogSet: DesenValidatedExecutionCatalogSet;
  /** Captured framework-neutral host boundary. */
  readonly hostPorts: RuntimeHostPorts;
  /** Optional finite ceilings lowered by a trusted host profile. */
  readonly limits?: RuntimeOperationLimitProfile;
}

/**
 * Opaque authority for one surface-local operation lifetime.
 *
 * @remarks A structural cast cannot manufacture the private `WeakMap` authority used at runtime.
 */
export interface RuntimeSurfaceOperationsHandle {
  /** Compile-time-only marker paired with a private runtime authority. */
  readonly [RUNTIME_SURFACE_OPERATIONS_HANDLE_TYPE_BRAND]: "RuntimeSurfaceOperationsHandle";
}

/**
 * Opaque one-shot permission to finish processing a terminal operation settlement.
 *
 * @remarks Settlement handlers acknowledge this lease only after their new action turn finishes.
 * A queued host invocation cannot be promoted before that acknowledgement.
 */
export interface RuntimeOperationSettlementLease {
  /** Compile-time-only marker paired with private runtime authority. */
  readonly [RUNTIME_OPERATION_SETTLEMENT_LEASE_TYPE_BRAND]: "RuntimeOperationSettlementLease";
}

/** Immutable public lifecycle state for every alias created in one surface lifetime. */
export interface RuntimeSurfaceOperationsSnapshot {
  /** Active document identity. */
  readonly documentId: string;
  /** Exact active revision. */
  readonly revision: string;
  /** Owning surface identity. */
  readonly surfaceId: string;
  /** Zero-based generation advanced once for each public lifecycle transition. */
  readonly generation: number;
  /** Resolver-compatible operation lifecycles keyed by exact invocation alias. */
  readonly lifecycles: Readonly<Record<string, RuntimeLifecycleReferenceSnapshot>>;
}

/** Successful atomic creation of the complete idle alias inventory. */
export interface RuntimeSurfaceOperationsMounted {
  readonly status: "mounted";
  readonly handle: RuntimeSurfaceOperationsHandle;
  readonly snapshot: RuntimeSurfaceOperationsSnapshot;
}

/** Why an operation manager could not be created. */
export type RuntimeSurfaceOperationsMountInvalidReason =
  "catalog-set-invalid" | "malformed-input" | "unknown-capability";

/** Failed mount carrying no handle or partial authority. */
export interface RuntimeSurfaceOperationsMountInvalid {
  readonly status: "invalid";
  readonly reason: RuntimeSurfaceOperationsMountInvalidReason;
  readonly alias?: string;
  readonly diagnostics: readonly DesenDiagnostic<string>[];
}

/** Atomic mount result for a surface-local operation manager. */
export type RuntimeSurfaceOperationsMountResult =
  RuntimeSurfaceOperationsMountInvalid | RuntimeSurfaceOperationsMounted;

/** Controlled read result for an opaque operation handle. */
export type RuntimeSurfaceOperationsReadResult =
  | Readonly<{ readonly status: "read"; readonly snapshot: RuntimeSurfaceOperationsSnapshot }>
  | Readonly<{ readonly status: "disposed" }>
  | Readonly<{ readonly status: "invalid-handle" }>;

/** Caller-owned request for one operation invocation. */
export interface RuntimeOperationInvokeInput {
  /** Surface-scoped lifecycle alias. */
  readonly alias: string;
  /** Protocol assertion that must exactly match the capability fixed by the mounted alias. */
  readonly operation: string;
  /** Fully materialized inert input candidate; this manager detaches and schema-validates it. */
  readonly input: RuntimeJsonObject;
  /** Alias behavior while an earlier invocation is pending; defaults to `reject`. */
  readonly concurrency?: RuntimeOperationConcurrency;
  /** Exact current snapshot object issued by this operation manager. */
  readonly operationSnapshot: RuntimeSurfaceOperationsSnapshot;
}

/** A fully resolved operation input that failed the exact Catalog schema. */
export interface RuntimeOperationInputSchemaRejected {
  readonly status: "input-rejected";
  readonly alias: string;
  readonly reason: "schema";
  readonly diagnostics: readonly DesenDiagnostic<string>[];
}

/** Terminal settlement whose queue lease must be acknowledged after settlement actions finish. */
export type RuntimeOperationTerminalSettlement =
  | Readonly<{
      readonly status: "succeeded";
      readonly alias: string;
      readonly requestId: string;
      readonly snapshot: RuntimeSurfaceOperationsSnapshot;
      readonly lease: RuntimeOperationSettlementLease;
    }>
  | Readonly<{
      readonly status: "failed";
      readonly alias: string;
      readonly requestId: string;
      readonly errorCode: string;
      readonly snapshot: RuntimeSurfaceOperationsSnapshot;
      readonly lease: RuntimeOperationSettlementLease;
    }>
  | Readonly<{
      readonly status: "denied" | "invalid-output" | "adapter-failed";
      readonly alias: string;
      readonly requestId: string;
      readonly diagnostics: readonly DesenDiagnostic<string>[];
      readonly snapshot: RuntimeSurfaceOperationsSnapshot;
      readonly lease: RuntimeOperationSettlementLease;
    }>;

/** Complete controlled settlement of one accepted operation invocation. */
export type RuntimeOperationSettlement =
  | RuntimeOperationTerminalSettlement
  | Readonly<{
      readonly status: "superseded";
      readonly alias: string;
      readonly requestId: string;
      readonly snapshot: RuntimeSurfaceOperationsSnapshot;
    }>
  | Readonly<{
      readonly status: "disposed";
      readonly alias: string;
      readonly requestId: string;
    }>;

/** One invocation that became the alias's current pending lifecycle. */
export interface RuntimeOperationInvocationStarted {
  readonly status: "started";
  readonly alias: string;
  readonly requestId: string;
  readonly snapshot: RuntimeSurfaceOperationsSnapshot;
  /** Promise always fulfills with controlled inert data and never rejects. */
  readonly settlement: Promise<RuntimeOperationSettlement>;
}

/** One invocation accepted behind a currently pending alias. */
export interface RuntimeOperationInvocationQueued {
  readonly status: "queued";
  readonly alias: string;
  readonly requestId: string;
  /** One-based position in the accepted alias-local queue. */
  readonly position: number;
  readonly snapshot: RuntimeSurfaceOperationsSnapshot;
  /** Promise always fulfills with controlled inert data and never rejects. */
  readonly settlement: Promise<RuntimeOperationSettlement>;
}

/** One invocation made pending while its predecessor's settlement handler still owns the gate. */
export interface RuntimeOperationInvocationStaged {
  readonly status: "staged";
  readonly alias: string;
  readonly requestId: string;
  readonly snapshot: RuntimeSurfaceOperationsSnapshot;
  /** Promise settles after acknowledgement launches this staged host request. */
  readonly settlement: Promise<RuntimeOperationSettlement>;
}

/** Complete synchronous outcome of requesting an operation invocation. */
export type RuntimeOperationInvokeResult =
  | RuntimeOperationInputSchemaRejected
  | RuntimeOperationInvocationStarted
  | RuntimeOperationInvocationQueued
  | RuntimeOperationInvocationStaged
  | Readonly<{
      readonly status: "rejected";
      readonly reason: "pending";
      readonly alias: string;
      readonly snapshot: RuntimeSurfaceOperationsSnapshot;
    }>
  | Readonly<{
      readonly status: "unknown-alias";
      readonly alias: string;
      readonly diagnostics: readonly DesenDiagnostic<string>[];
    }>
  | Readonly<{
      readonly status: "capability-mismatch";
      readonly alias: string;
      readonly diagnostics: readonly DesenDiagnostic<string>[];
    }>
  | Readonly<{
      readonly status: "queue-limit" | "attempt-limit" | "snapshot-limit" | "retained-limit";
      readonly alias: string;
      readonly diagnostics: readonly DesenDiagnostic<string>[];
    }>
  | Readonly<{
      readonly status: "invalid-snapshot";
      readonly snapshot: RuntimeSurfaceOperationsSnapshot;
    }>
  | Readonly<{ readonly status: "busy" }>
  | Readonly<{ readonly status: "disposed" }>
  | Readonly<{ readonly status: "invalid-handle" }>
  | Readonly<{ readonly status: "malformed-request" }>;

/** Controlled result of acknowledging one terminal settlement lease. */
export type RuntimeOperationSettlementAcknowledgement =
  | Readonly<{
      readonly status: "acknowledged";
      readonly alias: string;
      readonly requestId: string;
      readonly snapshot: RuntimeSurfaceOperationsSnapshot;
      readonly promotedRequestId?: string;
    }>
  | Readonly<{ readonly status: "already-acknowledged" }>
  | Readonly<{ readonly status: "disposed" }>
  | Readonly<{ readonly status: "invalid-handle" }>
  | Readonly<{ readonly status: "invalid-lease" }>
  | Readonly<{ readonly status: "busy" }>;

/** Terminal disposal outcome for an operation manager. */
export type RuntimeSurfaceOperationsDisposeResult =
  | Readonly<{
      readonly status: "disposed";
      readonly disposedInvocations: number;
      readonly invalidatedLeases: number;
    }>
  | Readonly<{
      readonly status: "already-disposed";
      readonly disposedInvocations: 0;
      readonly invalidatedLeases: 0;
    }>
  | Readonly<{
      readonly status: "invalid-handle";
      readonly disposedInvocations: 0;
      readonly invalidatedLeases: 0;
    }>;

interface OperationCatalogContract {
  readonly effect: RuntimeOperationEffect;
  readonly publicErrors: ReadonlySet<string>;
}

interface OperationRecord {
  readonly alias: string;
  readonly capabilityId: string;
  readonly effect: RuntimeOperationEffect;
  readonly publicErrors: ReadonlySet<string>;
  lifecycle: RuntimeLifecycleReferenceSnapshot;
  nextAttemptGeneration: number;
  active: OperationAttempt | undefined;
  settlementGate: OperationAttempt | undefined;
  readonly queue: OperationAttempt[];
}

interface OperationAttempt {
  readonly alias: string;
  readonly requestId: string;
  readonly generation: number;
  readonly request: RuntimeOperationRequest;
  readonly settlement: Promise<RuntimeOperationSettlement>;
  readonly resolve: (settlement: RuntimeOperationSettlement) => void;
  completed: boolean;
  reservationCount: number;
  phase: "pending" | "queued" | "staged" | "awaiting-ack" | "completed";
  transportState: "not-scheduled" | "queued" | "launched" | "settled";
  lease: RuntimeOperationSettlementLease | undefined;
}

interface OperationLeaseAuthority {
  readonly authority: OperationAuthority;
  readonly record: OperationRecord;
  readonly attempt: OperationAttempt;
}

interface OperationLeaseFinalAuthority {
  readonly status: "acknowledged" | "disposed";
  readonly authority: OperationAuthority;
}

interface OperationAuthority {
  status: "disposed" | "live";
  readonly documentId: string;
  readonly revision: string;
  readonly surfaceId: string;
  readonly catalogSet: DesenValidatedExecutionCatalogSet;
  readonly hostPorts: RuntimeHostPorts;
  readonly limits: Required<RuntimeOperationLimitProfile>;
  readonly records: Map<string, OperationRecord>;
  readonly transportQueue: {
    readonly record: OperationRecord;
    readonly attempt: OperationAttempt;
  }[];
  outstandingTransports: number;
  drainingTransports: boolean;
  queuedInvocations: number;
  reservedSnapshotTransitions: number;
  transitioning: boolean;
  reporting: boolean;
  snapshot: RuntimeSurfaceOperationsSnapshot;
}

interface MountEnvelope {
  readonly documentId: string;
  readonly revision: string;
  readonly surfaceId: string;
  readonly aliases: RuntimeJsonObject;
  readonly catalogSet: DesenValidatedExecutionCatalogSet;
  readonly hostPorts: RuntimeHostPorts;
  readonly limits: Required<RuntimeOperationLimitProfile>;
}

interface InvokeEnvelope {
  readonly alias: string;
  readonly operation: string;
  readonly input: RuntimeJsonObject;
  readonly concurrency: RuntimeOperationConcurrency;
  readonly operationSnapshot: RuntimeSurfaceOperationsSnapshot;
}

type OperationInputPreparation =
  | Readonly<{ readonly status: "prepared"; readonly value: RuntimeJsonObject }>
  | RuntimeOperationInputSchemaRejected;

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
  | Readonly<{ readonly valid: true; readonly value: unknown }>
  | Readonly<{ readonly valid: false }> {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(object, key);
    return descriptor !== undefined && "value" in descriptor
      ? Object.freeze({ valid: true, value: descriptor.value })
      : Object.freeze({ valid: false });
  } catch {
    return Object.freeze({ valid: false });
  }
}

function exactOwnStringKeys(object: object, expected: readonly string[]): boolean {
  try {
    const keys = Reflect.ownKeys(object);
    if (keys.some((key) => typeof key !== "string") || keys.length !== expected.length)
      return false;
    const observed = (keys as string[]).sort(compareText);
    const wanted = [...expected].sort(compareText);
    return observed.every((key, index) => key === wanted[index]);
  } catch {
    return false;
  }
}

function isConcurrency(value: unknown): value is RuntimeOperationConcurrency {
  return value === "queue" || value === "reject" || value === "replace";
}

function captureOperationLimits(
  input: unknown,
): Required<RuntimeOperationLimitProfile> | undefined {
  const defaults: Required<RuntimeOperationLimitProfile> = {
    maxAttemptGeneration: RUNTIME_OPERATION_LIMITS.maxAttemptGeneration,
    maxSnapshotGeneration: RUNTIME_OPERATION_LIMITS.maxSnapshotGeneration,
    maxQueuedInvocations: RUNTIME_OPERATION_LIMITS.maxQueuedInvocations,
    maxActiveTransports: RUNTIME_OPERATION_LIMITS.maxActiveTransports,
  };
  if (input === undefined) return Object.freeze(defaults);
  if (!isPlainRecord(input)) return undefined;
  let keys: readonly PropertyKey[];
  try {
    keys = Reflect.ownKeys(input);
  } catch {
    return undefined;
  }
  const allowed = new Set([
    "maxActiveTransports",
    "maxAttemptGeneration",
    "maxQueuedInvocations",
    "maxSnapshotGeneration",
  ]);
  if (keys.some((key) => typeof key !== "string" || !allowed.has(key))) return undefined;

  const captured = { ...defaults };
  for (const key of keys as (keyof RuntimeOperationLimitProfile)[]) {
    const value = ownDataValue(input, key);
    if (!value.valid || !Number.isSafeInteger(value.value)) return undefined;
    const numeric = value.value as number;
    const maximum = RUNTIME_OPERATION_LIMITS[key];
    const minimum = key === "maxActiveTransports" ? 1 : 0;
    if (numeric < minimum || numeric > maximum) return undefined;
    captured[key] = numeric;
  }
  return Object.freeze(captured);
}

function readMountEnvelope(input: unknown): MountEnvelope | undefined {
  const baseKeys = ["aliases", "catalogSet", "documentId", "hostPorts", "revision", "surfaceId"];
  if (!isPlainRecord(input)) return undefined;
  const hasBaseKeys = exactOwnStringKeys(input, baseKeys);
  const hasLimitKeys = exactOwnStringKeys(input, [...baseKeys, "limits"]);
  if (!hasBaseKeys && !hasLimitKeys) return undefined;
  const documentId = ownDataValue(input, "documentId");
  const revision = ownDataValue(input, "revision");
  const surfaceId = ownDataValue(input, "surfaceId");
  const aliases = ownDataValue(input, "aliases");
  const catalogSet = ownDataValue(input, "catalogSet");
  const hostPorts = ownDataValue(input, "hostPorts");
  const limitInput = hasLimitKeys
    ? ownDataValue(input, "limits")
    : Object.freeze({ valid: true as const, value: undefined });
  const limits = limitInput.valid ? captureOperationLimits(limitInput.value) : undefined;
  if (
    !documentId.valid ||
    typeof documentId.value !== "string" ||
    documentId.value.length === 0 ||
    documentId.value.length > RUNTIME_VALUE_SAFETY_LIMITS.maxStringCodeUnits ||
    !revision.valid ||
    typeof revision.value !== "string" ||
    !isSha256Digest(revision.value) ||
    !surfaceId.valid ||
    typeof surfaceId.value !== "string" ||
    !LOCAL_IDENTIFIER_PATTERN.test(surfaceId.value) ||
    !aliases.valid ||
    !catalogSet.valid ||
    !hostPorts.valid ||
    limits === undefined
  ) {
    return undefined;
  }
  const aliasSnapshot = snapshotRuntimeJsonValue(aliases.value);
  if (!isRuntimeJsonObject(aliasSnapshot)) return undefined;
  return Object.freeze({
    documentId: documentId.value,
    revision: revision.value,
    surfaceId: surfaceId.value,
    aliases: aliasSnapshot,
    catalogSet: catalogSet.value as DesenValidatedExecutionCatalogSet,
    hostPorts: hostPorts.value as RuntimeHostPorts,
    limits,
  });
}

function readInvokeEnvelope(input: unknown): InvokeEnvelope | undefined {
  const baseKeys = ["alias", "input", "operation", "operationSnapshot"];
  if (!isPlainRecord(input)) return undefined;
  const usesDefault = exactOwnStringKeys(input, baseKeys);
  const hasConcurrency = exactOwnStringKeys(input, [...baseKeys, "concurrency"]);
  if (!usesDefault && !hasConcurrency) return undefined;
  const alias = ownDataValue(input, "alias");
  const operation = ownDataValue(input, "operation");
  const valueInput = ownDataValue(input, "input");
  const operationSnapshot = ownDataValue(input, "operationSnapshot");
  const concurrencyInput = hasConcurrency
    ? ownDataValue(input, "concurrency")
    : Object.freeze({ valid: true as const, value: "reject" });
  if (
    !alias.valid ||
    typeof alias.value !== "string" ||
    !LOCAL_IDENTIFIER_PATTERN.test(alias.value) ||
    !operation.valid ||
    typeof operation.value !== "string" ||
    operation.value.length > RUNTIME_VALUE_SAFETY_LIMITS.maxStringCodeUnits ||
    !CAPABILITY_IDENTIFIER_PATTERN.test(operation.value) ||
    !valueInput.valid ||
    !isRuntimeJsonObject(valueInput.value) ||
    !operationSnapshot.valid ||
    !concurrencyInput.valid ||
    !isConcurrency(concurrencyInput.value)
  ) {
    return undefined;
  }
  const detachedInput = snapshotRuntimeJsonValue(valueInput.value);
  if (!isRuntimeJsonObject(detachedInput)) return undefined;
  return Object.freeze({
    alias: alias.value,
    operation: operation.value,
    input: detachedInput,
    concurrency: concurrencyInput.value,
    operationSnapshot: operationSnapshot.value as RuntimeSurfaceOperationsSnapshot,
  });
}

function operationDiagnostic(
  code: string,
  message: string,
  authority: Pick<OperationAuthority, "documentId" | "surfaceId">,
  capabilityId?: string,
  pointer?: JsonPointer,
): Readonly<DesenDiagnostic<string>> {
  return Object.freeze({
    code,
    message,
    ...(pointer === undefined ? {} : { pointer }),
    context: Object.freeze({
      documentId: authority.documentId,
      surfaceId: authority.surfaceId,
      ...(capabilityId === undefined ? {} : { capabilityId }),
    }),
  });
}

function coreDiagnostic(
  code:
    | "ADAPTER_FAILURE"
    | "OPERATION_DENIED"
    | "OPERATION_INPUT_INVALID"
    | "OPERATION_OUTPUT_INVALID"
    | "REFERENCE_UNRESOLVED"
    | "UNKNOWN_CAPABILITY",
  message: string,
  authority: Pick<OperationAuthority, "documentId" | "surfaceId">,
  capabilityId?: string,
  pointer?: JsonPointer,
): Readonly<DesenDiagnostic<string>> {
  return createCoreDiagnostic({
    code,
    message,
    ...(pointer === undefined ? {} : { pointer }),
    context: {
      documentId: authority.documentId,
      surfaceId: authority.surfaceId,
      ...(capabilityId === undefined ? {} : { capabilityId }),
    },
  });
}

function safeReport(
  authority: OperationAuthority,
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
        // Diagnostic observation cannot alter an operation transition.
      }
    }
  } finally {
    authority.reporting = false;
  }
}

function catalogContract(
  catalogSet: DesenValidatedExecutionCatalogSet,
  capabilityId: string,
): OperationCatalogContract | undefined {
  let capability: ImmutableJson<DesenCatalog>["operations"][string] | undefined;
  for (const catalog of catalogSet) {
    if (Object.hasOwn(catalog.operations, capabilityId)) {
      capability = catalog.operations[capabilityId];
      break;
    }
  }
  if (capability === undefined) return undefined;
  return Object.freeze({
    effect: capability.effect,
    publicErrors: new Set(capability.errors.map(({ code }) => code)),
  });
}

function publishSnapshot(
  authority: OperationAuthority,
  advance: boolean,
): RuntimeSurfaceOperationsSnapshot {
  const nextGeneration = advance
    ? authority.snapshot.generation + 1
    : authority.snapshot.generation;
  if (
    !Number.isSafeInteger(nextGeneration) ||
    nextGeneration > authority.limits.maxSnapshotGeneration
  ) {
    throw new RangeError("Runtime operation snapshot generation exceeded its exact bound.");
  }
  const lifecycles: Record<string, RuntimeLifecycleReferenceSnapshot> = Object.create(null);
  for (const alias of [...authority.records.keys()].sort(compareText)) {
    const record = authority.records.get(alias);
    if (record === undefined) {
      throw new RangeError("Runtime operation inventory changed during snapshot publication.");
    }
    lifecycles[alias] = record.lifecycle;
  }
  const detached = snapshotRuntimeJsonValue(lifecycles);
  if (!isRuntimeJsonObject(detached)) {
    throw new RangeError(
      "Runtime operation lifecycle map exceeded the shared JSON safety boundary.",
    );
  }
  authority.snapshot = Object.freeze({
    documentId: authority.documentId,
    revision: authority.revision,
    surfaceId: authority.surfaceId,
    generation: nextGeneration,
    lifecycles: detached as Readonly<Record<string, RuntimeLifecycleReferenceSnapshot>>,
  });
  return authority.snapshot;
}

function liveAuthority(
  handle: RuntimeSurfaceOperationsHandle,
): OperationAuthority | "disposed" | undefined {
  if (typeof handle !== "object" || handle === null) return undefined;
  const authority = OPERATION_AUTHORITIES.get(handle as object);
  if (authority === undefined) return undefined;
  if (authority === DISPOSED_OPERATION_AUTHORITY) return "disposed";
  return authority.status === "disposed" ? "disposed" : authority;
}

function prepareOperationInput(
  authority: OperationAuthority,
  envelope: InvokeEnvelope,
  record: OperationRecord,
): OperationInputPreparation {
  const validation = validateDesenExecutionValue(
    envelope.input,
    { kind: "operation-input", capabilityId: record.capabilityId },
    authority.catalogSet,
  );
  if (!validation.valid) {
    return Object.freeze({
      status: "input-rejected",
      alias: envelope.alias,
      reason: "schema",
      diagnostics: validation.diagnostics,
    });
  }
  if (!isRuntimeJsonObject(validation.value)) {
    return Object.freeze({
      status: "input-rejected",
      alias: envelope.alias,
      reason: "schema",
      diagnostics: Object.freeze([
        coreDiagnostic(
          "OPERATION_INPUT_INVALID",
          "The operation input contract did not preserve the required object boundary.",
          authority,
          record.capabilityId,
          ROOT_POINTER,
        ),
      ]),
    });
  }
  return Object.freeze({ status: "prepared", value: validation.value });
}

function nextRequestId(
  authority: OperationAuthority,
  alias: string,
  generation: number,
): string | undefined {
  if (!Number.isSafeInteger(generation) || generation > authority.limits.maxAttemptGeneration) {
    return undefined;
  }
  return `operation:${canonicalizeJson([alias, generation])}`;
}

function makeLimitResult(
  authority: OperationAuthority,
  alias: string,
  capabilityId: string,
  status: "attempt-limit" | "queue-limit" | "snapshot-limit" | "retained-limit",
): Extract<RuntimeOperationInvokeResult, { readonly status: typeof status }> {
  const code = `run.desen.runtime/OPERATION_${status.replaceAll("-", "_").toUpperCase()}_EXCEEDED`;
  const messages = {
    "attempt-limit": "The operation attempt counter exceeded its exact integer bound.",
    "queue-limit": "The operation manager reached its aggregate retained-queue limit.",
    "snapshot-limit": "The invocation cannot preserve every required future lifecycle transition.",
    "retained-limit": "The operation lifecycle map exceeded the shared JSON safety boundary.",
  } as const;
  return Object.freeze({
    status,
    alias,
    diagnostics: Object.freeze([
      operationDiagnostic(code, messages[status], authority, capabilityId),
    ]),
  }) as Extract<RuntimeOperationInvokeResult, { readonly status: typeof status }>;
}

function createAttempt(
  authority: OperationAuthority,
  record: OperationRecord,
  input: RuntimeJsonObject,
): OperationAttempt | undefined {
  const generation = record.nextAttemptGeneration;
  const requestId = nextRequestId(authority, record.alias, generation);
  if (requestId === undefined) return undefined;
  let resolveSettlement!: (settlement: RuntimeOperationSettlement) => void;
  const settlement = new Promise<RuntimeOperationSettlement>((resolve) => {
    resolveSettlement = resolve;
  });
  record.nextAttemptGeneration += 1;
  return {
    alias: record.alias,
    requestId,
    generation,
    request: Object.freeze({
      context: Object.freeze({
        documentId: authority.documentId,
        revision: authority.revision,
        surfaceId: authority.surfaceId,
        requestId,
      }),
      capabilityId: record.capabilityId,
      invocationAlias: record.alias,
      input,
      effect: record.effect,
    }),
    settlement,
    resolve: resolveSettlement,
    completed: false,
    reservationCount: 0,
    phase: "queued",
    transportState: "not-scheduled",
    lease: undefined,
  };
}

function reserveTransitions(
  authority: OperationAuthority,
  attempt: OperationAttempt,
  count: number,
) {
  attempt.reservationCount += count;
  authority.reservedSnapshotTransitions += count;
}

function releaseTransitions(authority: OperationAuthority, attempt: OperationAttempt): void {
  authority.reservedSnapshotTransitions -= attempt.reservationCount;
  attempt.reservationCount = 0;
}

function consumeTransitionReservation(
  authority: OperationAuthority,
  attempt: OperationAttempt,
): void {
  if (attempt.reservationCount < 1) {
    throw new RangeError("Operation attempt has no reserved lifecycle transition.");
  }
  attempt.reservationCount -= 1;
  authority.reservedSnapshotTransitions -= 1;
}

function canReserve(
  authority: OperationAuthority,
  immediateTransitions: number,
  addedReservations: number,
  releasedReservations = 0,
): boolean {
  const retained = authority.reservedSnapshotTransitions - releasedReservations + addedReservations;
  const remaining = authority.limits.maxSnapshotGeneration - authority.snapshot.generation;
  return retained >= 0 && immediateTransitions >= 0 && immediateTransitions + retained <= remaining;
}

function completeAttempt(attempt: OperationAttempt, settlement: RuntimeOperationSettlement): void {
  if (attempt.completed) return;
  attempt.completed = true;
  if (settlement.status === "superseded" || settlement.status === "disposed") {
    attempt.phase = "completed";
  }
  attempt.resolve(Object.freeze(settlement));
}

function makeLease(
  authority: OperationAuthority,
  record: OperationRecord,
  attempt: OperationAttempt,
): RuntimeOperationSettlementLease {
  const lease = Object.freeze({}) as RuntimeOperationSettlementLease;
  if (record.active === attempt) record.active = undefined;
  record.settlementGate = attempt;
  attempt.lease = lease;
  attempt.phase = "awaiting-ack";
  SETTLEMENT_LEASES.set(lease, Object.freeze({ authority, record, attempt }));
  return lease;
}

function closedHostResult(input: unknown): RuntimeHostCallResult | undefined {
  if (!isPlainRecord(input)) return undefined;
  const status = ownDataValue(input, "status");
  if (!status.valid || typeof status.value !== "string") return undefined;
  if (status.value === "denied" && exactOwnStringKeys(input, ["status"])) {
    return Object.freeze({ status: "denied" });
  }
  if (status.value === "failed" && exactOwnStringKeys(input, ["errorCode", "status"])) {
    const errorCode = ownDataValue(input, "errorCode");
    return errorCode.valid && typeof errorCode.value === "string"
      ? Object.freeze({ status: "failed", errorCode: errorCode.value })
      : undefined;
  }
  if (status.value === "succeeded" && exactOwnStringKeys(input, ["status", "value"])) {
    const value = ownDataValue(input, "value");
    return value.valid
      ? Object.freeze({ status: "succeeded", value: value.value as RuntimeJsonValue })
      : undefined;
  }
  return undefined;
}

function terminalTechnicalSettlement(
  authority: OperationAuthority,
  record: OperationRecord,
  attempt: OperationAttempt,
  status: "adapter-failed" | "denied" | "invalid-output",
  diagnostics: readonly DesenDiagnostic<string>[],
): void {
  record.lifecycle = Object.freeze({ status: "idle", pending: false });
  const snapshot = publishSnapshot(authority, true);
  consumeTransitionReservation(authority, attempt);
  const lease = makeLease(authority, record, attempt);
  const frozenDiagnostics = Object.freeze([...diagnostics]);
  completeAttempt(attempt, {
    status,
    alias: record.alias,
    requestId: attempt.requestId,
    diagnostics: frozenDiagnostics,
    snapshot,
    lease,
  });
  safeReport(authority, frozenDiagnostics);
}

function settleHostResult(
  authority: OperationAuthority,
  record: OperationRecord,
  attempt: OperationAttempt,
  rawResult: unknown,
): void {
  if (
    authority.status !== "live" ||
    record.active !== attempt ||
    attempt.completed ||
    attempt.phase !== "pending"
  ) {
    return;
  }
  const result = closedHostResult(rawResult);
  if (result === undefined) {
    terminalTechnicalSettlement(authority, record, attempt, "adapter-failed", [
      coreDiagnostic(
        "ADAPTER_FAILURE",
        "The operation adapter returned a malformed settlement envelope.",
        authority,
        record.capabilityId,
      ),
    ]);
    return;
  }
  if (result.status === "denied") {
    terminalTechnicalSettlement(authority, record, attempt, "denied", [
      coreDiagnostic(
        "OPERATION_DENIED",
        "Current host policy denied the operation invocation.",
        authority,
        record.capabilityId,
      ),
    ]);
    return;
  }
  if (result.status === "failed") {
    if (!record.publicErrors.has(result.errorCode)) {
      terminalTechnicalSettlement(authority, record, attempt, "adapter-failed", [
        coreDiagnostic(
          "ADAPTER_FAILURE",
          "The operation adapter returned an undeclared public error code.",
          authority,
          record.capabilityId,
        ),
      ]);
      return;
    }
    record.lifecycle = Object.freeze({
      status: "failed",
      pending: false,
      error: Object.freeze({ code: result.errorCode }),
    });
    try {
      const snapshot = publishSnapshot(authority, true);
      consumeTransitionReservation(authority, attempt);
      const lease = makeLease(authority, record, attempt);
      completeAttempt(attempt, {
        status: "failed",
        alias: record.alias,
        requestId: attempt.requestId,
        errorCode: result.errorCode,
        snapshot,
        lease,
      });
    } catch {
      record.lifecycle = Object.freeze({ status: "idle", pending: false });
      terminalTechnicalSettlement(authority, record, attempt, "invalid-output", [
        operationDiagnostic(
          "run.desen.runtime/OPERATION_RETAINED_LIMIT_EXCEEDED",
          "The declared operation failure would exceed the lifecycle data boundary.",
          authority,
          record.capabilityId,
        ),
      ]);
    }
    return;
  }

  const validation = validateDesenExecutionValue(
    result.value,
    { kind: "operation-output", capabilityId: record.capabilityId },
    authority.catalogSet,
  );
  if (!validation.valid) {
    terminalTechnicalSettlement(authority, record, attempt, "invalid-output", [
      coreDiagnostic(
        "OPERATION_OUTPUT_INVALID",
        "The operation adapter returned output that does not satisfy its declared contract.",
        authority,
        record.capabilityId,
        ROOT_POINTER,
      ),
    ]);
    return;
  }
  record.lifecycle = Object.freeze({
    status: "succeeded",
    pending: false,
    value: validation.value,
  });
  try {
    const snapshot = publishSnapshot(authority, true);
    consumeTransitionReservation(authority, attempt);
    const lease = makeLease(authority, record, attempt);
    completeAttempt(attempt, {
      status: "succeeded",
      alias: record.alias,
      requestId: attempt.requestId,
      snapshot,
      lease,
    });
  } catch {
    record.lifecycle = Object.freeze({ status: "idle", pending: false });
    terminalTechnicalSettlement(authority, record, attempt, "invalid-output", [
      operationDiagnostic(
        "run.desen.runtime/OPERATION_RETAINED_LIMIT_EXCEEDED",
        "The validated operation output would exceed the surface lifecycle data boundary.",
        authority,
        record.capabilityId,
      ),
    ]);
  }
}

function settleHostFailure(
  authority: OperationAuthority,
  record: OperationRecord,
  attempt: OperationAttempt,
): void {
  if (
    authority.status !== "live" ||
    record.active !== attempt ||
    attempt.completed ||
    attempt.phase !== "pending"
  ) {
    return;
  }
  terminalTechnicalSettlement(authority, record, attempt, "adapter-failed", [
    coreDiagnostic(
      "ADAPTER_FAILURE",
      "The operation adapter failed unexpectedly.",
      authority,
      record.capabilityId,
    ),
  ]);
}

function removeTransportQueue(authority: OperationAuthority, attempt: OperationAttempt): void {
  if (attempt.transportState !== "queued") return;
  const index = authority.transportQueue.findIndex(
    ({ attempt: candidate }) => candidate === attempt,
  );
  if (index >= 0) authority.transportQueue.splice(index, 1);
  attempt.transportState = "settled";
}

function finishTransport(
  authority: OperationAuthority,
  attempt: OperationAttempt,
  settle: () => void,
): void {
  if (attempt.transportState !== "launched") return;
  try {
    settle();
  } finally {
    attempt.transportState = "settled";
    authority.outstandingTransports -= 1;
    drainTransportQueue(authority);
  }
}

function launchTransport(
  authority: OperationAuthority,
  record: OperationRecord,
  attempt: OperationAttempt,
): void {
  if (
    authority.status !== "live" ||
    record.active !== attempt ||
    attempt.completed ||
    attempt.phase !== "pending"
  ) {
    attempt.transportState = "settled";
    return;
  }
  attempt.transportState = "launched";
  authority.outstandingTransports += 1;
  let result: unknown;
  try {
    result = Reflect.apply(authority.hostPorts.operations.invoke, undefined, [attempt.request]);
  } catch {
    void Promise.resolve().then(() =>
      finishTransport(authority, attempt, () => settleHostFailure(authority, record, attempt)),
    );
    return;
  }
  void Promise.resolve(result).then(
    (settled) =>
      finishTransport(authority, attempt, () =>
        settleHostResult(authority, record, attempt, settled),
      ),
    () => finishTransport(authority, attempt, () => settleHostFailure(authority, record, attempt)),
  );
}

function drainTransportQueue(authority: OperationAuthority): void {
  if (authority.drainingTransports) return;
  authority.drainingTransports = true;
  try {
    while (
      authority.status === "live" &&
      authority.outstandingTransports < authority.limits.maxActiveTransports
    ) {
      const queued = authority.transportQueue.shift();
      if (queued === undefined) break;
      if (
        queued.attempt.transportState !== "queued" ||
        queued.attempt.completed ||
        queued.attempt.phase !== "pending" ||
        queued.record.active !== queued.attempt
      ) {
        queued.attempt.transportState = "settled";
        continue;
      }
      launchTransport(authority, queued.record, queued.attempt);
    }
  } finally {
    authority.drainingTransports = false;
  }
}

function scheduleTransport(
  authority: OperationAuthority,
  record: OperationRecord,
  attempt: OperationAttempt,
): void {
  attempt.transportState = "queued";
  authority.transportQueue.push(Object.freeze({ record, attempt }));
  drainTransportQueue(authority);
}

function supersedeAttempt(
  authority: OperationAuthority,
  attempt: OperationAttempt,
  snapshot: RuntimeSurfaceOperationsSnapshot,
): void {
  if (attempt.phase === "queued" || attempt.phase === "staged") {
    authority.queuedInvocations -= 1;
  }
  removeTransportQueue(authority, attempt);
  releaseTransitions(authority, attempt);
  completeAttempt(attempt, {
    status: "superseded",
    alias: attempt.alias,
    requestId: attempt.requestId,
    snapshot,
  });
}

function rollbackAttempt(record: OperationRecord, attempt: OperationAttempt): void {
  if (record.nextAttemptGeneration === attempt.generation + 1) {
    record.nextAttemptGeneration = attempt.generation;
  }
}

/**
 * Mounts the complete surface alias inventory atomically as idle without calling the host.
 *
 * @remarks The exact factory-authenticated Catalog set is retained as the sole authority for
 * operation effects, input/output schemas, and public errors.
 */
export function mountRuntimeSurfaceOperations(
  input: RuntimeSurfaceOperationsMountInput,
): RuntimeSurfaceOperationsMountResult {
  const envelope = readMountEnvelope(input);
  if (envelope === undefined) {
    return Object.freeze({
      status: "invalid",
      reason: "malformed-input",
      diagnostics: EMPTY_DIAGNOSTICS,
    });
  }
  const catalogValidation = validateDesenExecutionCatalogSet(envelope.catalogSet);
  if (!catalogValidation.valid || catalogValidation.value !== envelope.catalogSet) {
    return Object.freeze({
      status: "invalid",
      reason: "catalog-set-invalid",
      diagnostics: catalogValidation.valid ? EMPTY_DIAGNOSTICS : catalogValidation.diagnostics,
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
  const authority: OperationAuthority = {
    status: "live",
    documentId: envelope.documentId,
    revision: envelope.revision,
    surfaceId: envelope.surfaceId,
    catalogSet: envelope.catalogSet,
    hostPorts,
    limits: envelope.limits,
    records: new Map(),
    transportQueue: [],
    outstandingTransports: 0,
    drainingTransports: false,
    queuedInvocations: 0,
    reservedSnapshotTransitions: 0,
    transitioning: false,
    reporting: false,
    snapshot: Object.freeze({
      documentId: envelope.documentId,
      revision: envelope.revision,
      surfaceId: envelope.surfaceId,
      generation: 0,
      lifecycles: Object.freeze({}),
    }),
  };
  for (const alias of Object.keys(envelope.aliases).sort(compareText)) {
    const spec = envelope.aliases[alias];
    if (
      !LOCAL_IDENTIFIER_PATTERN.test(alias) ||
      !isRuntimeJsonObject(spec) ||
      !exactOwnStringKeys(spec, ["operation"])
    ) {
      return Object.freeze({
        status: "invalid",
        reason: "malformed-input",
        alias,
        diagnostics: EMPTY_DIAGNOSTICS,
      });
    }
    const operation = ownDataValue(spec, "operation");
    if (!operation.valid || typeof operation.value !== "string" || operation.value.length === 0) {
      return Object.freeze({
        status: "invalid",
        reason: "malformed-input",
        alias,
        diagnostics: EMPTY_DIAGNOSTICS,
      });
    }
    const contract = catalogContract(authority.catalogSet, operation.value);
    if (contract === undefined) {
      return Object.freeze({
        status: "invalid",
        reason: "unknown-capability",
        alias,
        diagnostics: Object.freeze([
          coreDiagnostic(
            "UNKNOWN_CAPABILITY",
            "A mounted operation alias names a capability absent from the prepared Catalog set.",
            authority,
            operation.value,
          ),
        ]),
      });
    }
    authority.records.set(alias, {
      alias,
      capabilityId: operation.value,
      effect: contract.effect,
      publicErrors: contract.publicErrors,
      lifecycle: Object.freeze({ status: "idle", pending: false }),
      nextAttemptGeneration: 0,
      active: undefined,
      settlementGate: undefined,
      queue: [],
    });
  }
  try {
    publishSnapshot(authority, false);
  } catch {
    return Object.freeze({
      status: "invalid",
      reason: "malformed-input",
      diagnostics: Object.freeze([
        operationDiagnostic(
          "run.desen.runtime/OPERATION_RETAINED_LIMIT_EXCEEDED",
          "The mounted alias inventory exceeds the shared JSON safety boundary.",
          authority,
        ),
      ]),
    });
  }
  const handle = Object.freeze({}) as RuntimeSurfaceOperationsHandle;
  OPERATION_AUTHORITIES.set(handle, authority);
  return Object.freeze({ status: "mounted", handle, snapshot: authority.snapshot });
}

/** Reads the exact current immutable operation snapshot without invoking a host callback. */
export function readRuntimeSurfaceOperations(
  handle: RuntimeSurfaceOperationsHandle,
): RuntimeSurfaceOperationsReadResult {
  const authority = liveAuthority(handle);
  if (authority === undefined) return Object.freeze({ status: "invalid-handle" });
  if (authority === "disposed") return Object.freeze({ status: "disposed" });
  return Object.freeze({ status: "read", snapshot: authority.snapshot });
}

/**
 * Resolves, validates, and accepts one operation invocation under exact alias concurrency.
 *
 * @remarks Invalid and rejected requests do not consume an attempt generation. Accepted queued
 * requests do consume identity immediately, but no queued host callback starts until the preceding
 * terminal settlement lease is explicitly acknowledged.
 */
export function invokeRuntimeOperation(
  handle: RuntimeSurfaceOperationsHandle,
  input: RuntimeOperationInvokeInput,
): RuntimeOperationInvokeResult {
  const authority = liveAuthority(handle);
  if (authority === undefined) return Object.freeze({ status: "invalid-handle" });
  if (authority === "disposed") return Object.freeze({ status: "disposed" });
  if (authority.transitioning || authority.reporting) return Object.freeze({ status: "busy" });
  const envelope = readInvokeEnvelope(input);
  if (envelope === undefined) return Object.freeze({ status: "malformed-request" });
  if (envelope.operationSnapshot !== authority.snapshot) {
    return Object.freeze({ status: "invalid-snapshot", snapshot: authority.snapshot });
  }
  const existing = authority.records.get(envelope.alias);
  if (existing === undefined) {
    const diagnostics = Object.freeze([
      coreDiagnostic(
        "REFERENCE_UNRESOLVED",
        "The operation alias is absent from the mounted surface inventory.",
        authority,
      ),
    ]);
    safeReport(authority, diagnostics);
    return Object.freeze({
      status: "unknown-alias",
      alias: envelope.alias,
      diagnostics,
    });
  }
  if (envelope.operation !== existing.capabilityId) {
    const diagnostics = Object.freeze([
      operationDiagnostic(
        "run.desen.runtime/OPERATION_CAPABILITY_MISMATCH",
        "The invocation capability assertion does not match its mounted operation alias.",
        authority,
        existing.capabilityId,
      ),
    ]);
    safeReport(authority, diagnostics);
    return Object.freeze({
      status: "capability-mismatch",
      alias: envelope.alias,
      diagnostics,
    });
  }
  const gate = existing.settlementGate;
  const activePending =
    existing.active?.phase === "pending" || existing.active?.phase === "staged"
      ? existing.active
      : undefined;
  const backlogOnly =
    gate !== undefined && activePending === undefined && existing.queue.length > 0;
  const logicalPending = activePending ?? (backlogOnly ? existing.queue[0] : undefined);
  if (logicalPending !== undefined && envelope.concurrency === "reject") {
    return Object.freeze({
      status: "rejected",
      reason: "pending",
      alias: envelope.alias,
      snapshot: authority.snapshot,
    });
  }
  if (
    ((logicalPending !== undefined && envelope.concurrency === "queue") ||
      (gate !== undefined && logicalPending === undefined)) &&
    authority.queuedInvocations >= authority.limits.maxQueuedInvocations
  ) {
    const result = makeLimitResult(authority, envelope.alias, existing.capabilityId, "queue-limit");
    safeReport(authority, result.diagnostics);
    return result;
  }

  const nextGeneration = existing.nextAttemptGeneration;
  const requestId = nextRequestId(authority, envelope.alias, nextGeneration);
  if (requestId === undefined) {
    const result = makeLimitResult(
      authority,
      envelope.alias,
      existing.capabilityId,
      "attempt-limit",
    );
    safeReport(authority, result.diagnostics);
    return result;
  }
  const replacing =
    logicalPending !== undefined && envelope.concurrency === "replace"
      ? [...(activePending === undefined ? [] : [activePending]), ...existing.queue]
      : [];
  const releasedReservations = replacing.reduce(
    (total, attempt) => total + attempt.reservationCount,
    0,
  );
  const isQueued = logicalPending !== undefined && envelope.concurrency === "queue";
  const stageBacklog = gate !== undefined && backlogOnly && envelope.concurrency === "queue";
  const stageNew =
    gate !== undefined && (logicalPending === undefined || envelope.concurrency === "replace");
  const immediateTransitions = stageBacklog || stageNew || !isQueued ? 1 : 0;
  const addedReservations = isQueued ? 2 : 1;
  const consumedBacklogReservation = stageBacklog ? 1 : 0;
  if (
    !canReserve(
      authority,
      immediateTransitions,
      addedReservations,
      releasedReservations + consumedBacklogReservation,
    )
  ) {
    const result = makeLimitResult(
      authority,
      envelope.alias,
      existing.capabilityId,
      "snapshot-limit",
    );
    safeReport(authority, result.diagnostics);
    return result;
  }

  authority.transitioning = true;
  try {
    const prepared = prepareOperationInput(authority, envelope, existing);
    if (authority.status !== "live") return Object.freeze({ status: "disposed" });
    if (prepared.status !== "prepared") {
      safeReport(authority, prepared.diagnostics);
      return prepared;
    }
    const record = existing;
    const attempt = createAttempt(authority, record, prepared.value);
    if (attempt === undefined) {
      const result = makeLimitResult(
        authority,
        envelope.alias,
        existing.capabilityId,
        "attempt-limit",
      );
      safeReport(authority, result.diagnostics);
      return result;
    }

    if (gate !== undefined && stageBacklog) {
      const staged = record.queue[0];
      if (staged === undefined || staged.phase !== "queued") {
        rollbackAttempt(record, attempt);
        return Object.freeze({ status: "busy" });
      }
      reserveTransitions(authority, attempt, 2);
      const previousLifecycle = record.lifecycle;
      record.active = staged;
      staged.phase = "staged";
      record.lifecycle = Object.freeze({ status: "pending", pending: true });
      let pendingSnapshot: RuntimeSurfaceOperationsSnapshot;
      try {
        pendingSnapshot = publishSnapshot(authority, true);
      } catch {
        record.active = undefined;
        staged.phase = "queued";
        record.lifecycle = previousLifecycle;
        releaseTransitions(authority, attempt);
        rollbackAttempt(record, attempt);
        const result = makeLimitResult(
          authority,
          envelope.alias,
          existing.capabilityId,
          "retained-limit",
        );
        safeReport(authority, result.diagnostics);
        return result;
      }
      consumeTransitionReservation(authority, staged);
      record.queue.shift();
      record.queue.push(attempt);
      authority.queuedInvocations += 1;
      return Object.freeze({
        status: "queued",
        alias: record.alias,
        requestId: attempt.requestId,
        position: record.queue.length,
        snapshot: pendingSnapshot,
        settlement: attempt.settlement,
      });
    }

    if (isQueued) {
      reserveTransitions(authority, attempt, 2);
      record.queue.push(attempt);
      authority.queuedInvocations += 1;
      return Object.freeze({
        status: "queued",
        alias: record.alias,
        requestId: attempt.requestId,
        position: record.queue.length,
        snapshot: authority.snapshot,
        settlement: attempt.settlement,
      });
    }

    reserveTransitions(authority, attempt, 1);
    record.active = attempt;
    attempt.phase = gate === undefined ? "pending" : "staged";
    const previousLifecycle = record.lifecycle;
    record.lifecycle = Object.freeze({ status: "pending", pending: true });
    let pendingSnapshot: RuntimeSurfaceOperationsSnapshot;
    try {
      pendingSnapshot = publishSnapshot(authority, true);
    } catch {
      releaseTransitions(authority, attempt);
      record.active = activePending;
      record.lifecycle = previousLifecycle;
      rollbackAttempt(record, attempt);
      const result = makeLimitResult(
        authority,
        envelope.alias,
        existing.capabilityId,
        "retained-limit",
      );
      safeReport(authority, result.diagnostics);
      return result;
    }
    if (logicalPending !== undefined && envelope.concurrency === "replace") {
      existing.queue.length = 0;
      for (const replaced of replacing) {
        supersedeAttempt(authority, replaced, pendingSnapshot);
      }
    }
    if (gate !== undefined) {
      authority.queuedInvocations += 1;
      return Object.freeze({
        status: "staged",
        alias: record.alias,
        requestId: attempt.requestId,
        snapshot: pendingSnapshot,
        settlement: attempt.settlement,
      });
    }
    scheduleTransport(authority, record, attempt);
    return Object.freeze({
      status: "started",
      alias: record.alias,
      requestId: attempt.requestId,
      snapshot: pendingSnapshot,
      settlement: attempt.settlement,
    });
  } finally {
    authority.transitioning = false;
  }
}

/**
 * Acknowledges one terminal settlement and promotes at most one queued invocation.
 *
 * @remarks The lifecycle terminal state is already public before this call. Promotion publishes a
 * new pending generation before invoking the host, preserving the settlement-handler action-turn
 * boundary required by M04-T11 and M04-T13.
 */
export function acknowledgeRuntimeOperationSettlement(
  handle: RuntimeSurfaceOperationsHandle,
  lease: RuntimeOperationSettlementLease,
): RuntimeOperationSettlementAcknowledgement {
  const authority = liveAuthority(handle);
  if (authority === undefined) return Object.freeze({ status: "invalid-handle" });
  if (authority === "disposed") return Object.freeze({ status: "disposed" });
  if (authority.transitioning || authority.reporting) return Object.freeze({ status: "busy" });
  if (typeof lease !== "object" || lease === null) {
    return Object.freeze({ status: "invalid-lease" });
  }
  const leaseAuthority = SETTLEMENT_LEASES.get(lease as object);
  if (leaseAuthority !== undefined && "status" in leaseAuthority) {
    if (leaseAuthority.authority !== authority) {
      return Object.freeze({ status: "invalid-lease" });
    }
    return leaseAuthority.status === "acknowledged"
      ? Object.freeze({ status: "already-acknowledged" })
      : Object.freeze({ status: "disposed" });
  }
  if (
    leaseAuthority === undefined ||
    leaseAuthority.authority !== authority ||
    leaseAuthority.attempt.lease !== lease ||
    leaseAuthority.attempt.phase !== "awaiting-ack" ||
    leaseAuthority.record.settlementGate !== leaseAuthority.attempt
  ) {
    return Object.freeze({ status: "invalid-lease" });
  }

  authority.transitioning = true;
  try {
    const { record, attempt } = leaseAuthority;
    SETTLEMENT_LEASES.set(lease as object, Object.freeze({ status: "acknowledged", authority }));
    attempt.phase = "completed";
    attempt.lease = undefined;
    record.settlementGate = undefined;
    const staged = record.active?.phase === "staged" ? record.active : undefined;
    if (staged !== undefined) {
      authority.queuedInvocations -= 1;
      staged.phase = "pending";
      scheduleTransport(authority, record, staged);
      return Object.freeze({
        status: "acknowledged",
        alias: record.alias,
        requestId: attempt.requestId,
        snapshot: authority.snapshot,
        promotedRequestId: staged.requestId,
      });
    }
    const promoted = record.queue.shift();
    if (promoted === undefined) {
      return Object.freeze({
        status: "acknowledged",
        alias: record.alias,
        requestId: attempt.requestId,
        snapshot: authority.snapshot,
      });
    }

    authority.queuedInvocations -= 1;
    record.active = promoted;
    promoted.phase = "pending";
    record.lifecycle = Object.freeze({ status: "pending", pending: true });
    const snapshot = publishSnapshot(authority, true);
    consumeTransitionReservation(authority, promoted);
    scheduleTransport(authority, record, promoted);
    return Object.freeze({
      status: "acknowledged",
      alias: record.alias,
      requestId: attempt.requestId,
      snapshot,
      promotedRequestId: promoted.requestId,
    });
  } finally {
    authority.transitioning = false;
  }
}

/**
 * Revokes one complete operation lifetime and invalidates pending transports and settlement leases.
 *
 * @remarks Disposal is terminal and idempotent. It cannot cancel an already-started host
 * transport, but every late result is rejected before its settlement envelope is inspected.
 */
export function disposeRuntimeSurfaceOperations(
  handle: RuntimeSurfaceOperationsHandle,
): RuntimeSurfaceOperationsDisposeResult {
  const authority = liveAuthority(handle);
  if (authority === undefined) {
    return Object.freeze({
      status: "invalid-handle",
      disposedInvocations: 0,
      invalidatedLeases: 0,
    });
  }
  if (authority === "disposed") {
    return Object.freeze({
      status: "already-disposed",
      disposedInvocations: 0,
      invalidatedLeases: 0,
    });
  }
  authority.status = "disposed";
  let disposedInvocations = 0;
  let invalidatedLeases = 0;
  for (const record of authority.records.values()) {
    const attempts = [
      ...(record.settlementGate === undefined ? [] : [record.settlementGate]),
      ...(record.active === undefined ? [] : [record.active]),
      ...record.queue,
    ];
    record.settlementGate = undefined;
    record.active = undefined;
    record.queue.length = 0;
    for (const attempt of attempts) {
      if (attempt.lease !== undefined) {
        SETTLEMENT_LEASES.set(
          attempt.lease as object,
          Object.freeze({ status: "disposed", authority }),
        );
        attempt.lease = undefined;
        invalidatedLeases += 1;
      }
      removeTransportQueue(authority, attempt);
      releaseTransitions(authority, attempt);
      if (!attempt.completed) {
        disposedInvocations += 1;
        completeAttempt(attempt, {
          status: "disposed",
          alias: attempt.alias,
          requestId: attempt.requestId,
        });
      }
      attempt.phase = "completed";
    }
  }
  authority.transportQueue.length = 0;
  authority.queuedInvocations = 0;
  authority.records.clear();
  OPERATION_AUTHORITIES.set(handle as object, DISPOSED_OPERATION_AUTHORITY);
  return Object.freeze({
    status: "disposed",
    disposedInvocations,
    invalidatedLeases,
  });
}
