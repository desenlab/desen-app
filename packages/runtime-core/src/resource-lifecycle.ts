import {
  appendJsonPointer,
  canonicalizeJson,
  createCoreDiagnostic,
  createJsonPointer,
  isSha256Digest,
  parseJsonPointer,
} from "@desen/protocol";
import { validateDesenExecutionCatalogSet, validateDesenExecutionValue } from "@desen/validator";

import { createRuntimeHostPorts } from "./host-ports.js";
import { isRuntimeJsonObject, snapshotRuntimeJsonValue } from "./runtime-json-snapshot.js";
import { materializeRuntimeValue } from "./token-format-resolution.js";
import { resolveRuntimeValue, RUNTIME_VALUE_SAFETY_LIMITS } from "./value-resolution.js";

import type { DesenCatalog, DesenDiagnostic, JsonPointer } from "@desen/protocol";
import type { DesenValidatedExecutionCatalogSet, ImmutableJson } from "@desen/validator";
import type {
  RuntimeHostCallResult,
  RuntimeHostPorts,
  RuntimeJsonObject,
  RuntimeJsonValue,
  RuntimeResourceRequest,
} from "./host-ports.js";
import type { RuntimeValueMaterialization } from "./token-format-resolution.js";
import type {
  RuntimeLifecycleReferenceSnapshot,
  RuntimeResolutionSnapshot,
  RuntimeValueSpec,
} from "./value-resolution.js";

const LOCAL_IDENTIFIER_PATTERN = /^[A-Za-z][A-Za-z0-9._:-]{0,127}$/u;
const EMPTY_DIAGNOSTICS = Object.freeze([]) as readonly DesenDiagnostic<string>[];
const ROOT_POINTER = createJsonPointer();
const DISPOSED_RESOURCE_AUTHORITY = Symbol("disposed-resource-authority");
const RESOURCE_AUTHORITIES = new WeakMap<
  object,
  ResourceAuthority | typeof DISPOSED_RESOURCE_AUTHORITY
>();
declare const RUNTIME_SURFACE_RESOURCES_HANDLE_TYPE_BRAND: unique symbol;

/** Deterministic counters used by one surface-local resource lifetime. */
export const RUNTIME_RESOURCE_LIMITS = Object.freeze({
  /**
   * Largest zero-based attempt generation that can be represented without losing integer
   * identity.
   */
  maxAttemptGeneration: Number.MAX_SAFE_INTEGER,
  /** Largest surface snapshot generation that can be represented exactly. */
  maxSnapshotGeneration: Number.MAX_SAFE_INTEGER,
  /** Largest number of host resource transports retained concurrently by one surface. */
  maxActiveTransports: 64,
} as const);

/** Frozen DESEN resource loading policies. */
export type RuntimeResourcePolicy = "manual" | "mount" | "once";

/** Optional host profile that may only lower the runtime's finite resource ceilings. */
export interface RuntimeResourceLimitProfile {
  /** Inclusive largest per-instance attempt generation; defaults to the runtime ceiling. */
  readonly maxAttemptGeneration?: number;
  /** Inclusive largest public snapshot generation; defaults to the runtime ceiling. */
  readonly maxSnapshotGeneration?: number;
  /** Largest concurrent host loads; defaults to the runtime ceiling. */
  readonly maxActiveTransports?: number;
}

/** One resource declaration projected from an already validated surface. */
export interface RuntimeSurfaceResourceSpec {
  /** Exact resource capability identifier. */
  readonly use: string;
  /** Named ValueSpecs resolved against one atomic runtime snapshot. */
  readonly input: Readonly<Record<string, RuntimeValueSpec>>;
  /** Frozen resource loading policy selected by the document. */
  readonly policy: RuntimeResourcePolicy;
  /** Inert extension data ignored by the runtime lifecycle. */
  readonly extensions?: RuntimeJsonObject;
}

/** Caller-owned data used to mount one complete surface-local resource set. */
export interface RuntimeSurfaceResourcesMountInput {
  /** Active Source or Bundle document identifier. */
  readonly documentId: string;
  /** Exact active Bundle revision. */
  readonly revision: string;
  /** Surface that owns every resource instance. */
  readonly surfaceId: string;
  /** Surface resource declarations keyed by exact instance identifier. */
  readonly resources: Readonly<Record<string, RuntimeSurfaceResourceSpec>>;
  /** Factory-authenticated cumulative execution Catalog set. */
  readonly catalogSet: DesenValidatedExecutionCatalogSet;
  /** Captured framework-neutral host boundary. */
  readonly hostPorts: RuntimeHostPorts;
  /** Optional finite ceilings lowered by a trusted host profile. */
  readonly limits?: RuntimeResourceLimitProfile;
}

/**
 * Opaque authority for one surface-local resource lifetime.
 *
 * @remarks A structural cast cannot manufacture the private `WeakMap` authority used at runtime.
 */
export interface RuntimeSurfaceResourcesHandle {
  /** Compile-time-only marker paired with a private runtime authority. */
  readonly [RUNTIME_SURFACE_RESOURCES_HANDLE_TYPE_BRAND]: "RuntimeSurfaceResourcesHandle";
}

/** Immutable public state of every declared resource in one surface lifetime. */
export interface RuntimeSurfaceResourcesSnapshot {
  /** Active document identity. */
  readonly documentId: string;
  /** Exact active revision. */
  readonly revision: string;
  /** Owning surface identity. */
  readonly surfaceId: string;
  /** Zero-based generation advanced once for each atomic public-state transition. */
  readonly generation: number;
  /** Resolver-compatible lifecycle roots keyed by resource instance identifier. */
  readonly lifecycles: Readonly<Record<string, RuntimeLifecycleReferenceSnapshot>>;
}

/** Why a complete resource set could not be mounted. */
export type RuntimeSurfaceResourcesMountInvalidReason =
  "catalog-set-invalid" | "malformed-input" | "unknown-capability" | "unsupported-policy";

/** Successful atomic creation of an idle resource set. */
export interface RuntimeSurfaceResourcesMounted {
  readonly status: "mounted";
  readonly handle: RuntimeSurfaceResourcesHandle;
  readonly snapshot: RuntimeSurfaceResourcesSnapshot;
}

/** Failed mount carrying no handle or partial resource map. */
export interface RuntimeSurfaceResourcesMountInvalid {
  readonly status: "invalid";
  readonly reason: RuntimeSurfaceResourcesMountInvalidReason;
  readonly instanceId?: string;
  readonly diagnostics: readonly DesenDiagnostic<string>[];
}

/** Complete outcome of mounting one surface-local resource set. */
export type RuntimeSurfaceResourcesMountResult =
  RuntimeSurfaceResourcesMountInvalid | RuntimeSurfaceResourcesMounted;

/** Controlled read outcome for an opaque resource handle. */
export type RuntimeSurfaceResourcesReadResult =
  | Readonly<{ readonly status: "read"; readonly snapshot: RuntimeSurfaceResourcesSnapshot }>
  | Readonly<{ readonly status: "disposed" }>
  | Readonly<{ readonly status: "invalid-handle" }>;

/** A non-resolved ValueSpec outcome prefixed to its resource input member. */
export interface RuntimeResourceInputResolutionRejected {
  readonly status: "input-rejected";
  readonly instanceId: string;
  readonly reason: "resolution";
  readonly parameter: string;
  readonly resolution: Exclude<RuntimeValueMaterialization, { readonly status: "resolved" }>;
  readonly diagnostics: readonly DesenDiagnostic<string>[];
}

/** A fully resolved resource input that failed its exact Catalog schema. */
export interface RuntimeResourceInputSchemaRejected {
  readonly status: "input-rejected";
  readonly instanceId: string;
  readonly reason: "schema";
  readonly diagnostics: readonly DesenDiagnostic<string>[];
}

/** Resource deliberately left idle by the `manual` policy during initial start. */
export interface RuntimeResourceManualSkipped {
  readonly status: "manual";
  readonly instanceId: string;
}

/** One prepared request rejected before identity allocation because no terminal snapshot fits. */
export interface RuntimeResourceSnapshotLimitRejected {
  readonly status: "snapshot-limit";
  readonly instanceId: string;
  readonly diagnostics: readonly DesenDiagnostic<string>[];
}

/** Final result of one accepted host resource request. */
export type RuntimeResourceSettlement =
  | Readonly<{
      readonly status: "succeeded";
      readonly instanceId: string;
      readonly requestId: string;
      readonly snapshot: RuntimeSurfaceResourcesSnapshot;
    }>
  | Readonly<{
      readonly status: "failed";
      readonly instanceId: string;
      readonly requestId: string;
      readonly errorCode: string;
      readonly snapshot: RuntimeSurfaceResourcesSnapshot;
    }>
  | Readonly<{
      readonly status: "denied";
      readonly instanceId: string;
      readonly requestId: string;
      readonly diagnostics: readonly DesenDiagnostic<string>[];
      readonly snapshot: RuntimeSurfaceResourcesSnapshot;
    }>
  | Readonly<{
      readonly status: "invalid-output";
      readonly instanceId: string;
      readonly requestId: string;
      readonly diagnostics: readonly DesenDiagnostic<string>[];
      readonly snapshot: RuntimeSurfaceResourcesSnapshot;
    }>
  | Readonly<{
      readonly status: "adapter-failed";
      readonly instanceId: string;
      readonly requestId: string;
      readonly diagnostics: readonly DesenDiagnostic<string>[];
      readonly snapshot: RuntimeSurfaceResourcesSnapshot;
    }>
  | Readonly<{
      readonly status: "superseded";
      readonly instanceId: string;
      readonly requestId: string;
      readonly snapshot: RuntimeSurfaceResourcesSnapshot;
    }>
  | Readonly<{
      readonly status: "disposed";
      readonly instanceId: string;
      readonly requestId: string;
    }>;

/** One resource request accepted and transitioned to `pending`. */
export interface RuntimeResourceLoadStarted {
  readonly status: "started";
  readonly instanceId: string;
  readonly requestId: string;
  /** Promise always fulfills with controlled inert data and never rejects. */
  readonly settlement: Promise<RuntimeResourceSettlement>;
}

/** Per-resource result returned by the initial start batch. */
export type RuntimeResourceInitialStartEntry =
  | RuntimeResourceInputResolutionRejected
  | RuntimeResourceInputSchemaRejected
  | RuntimeResourceLoadStarted
  | RuntimeResourceManualSkipped
  | RuntimeResourceSnapshotLimitRejected;

/** Complete result of starting the initial `mount` and `once` policies. */
export type RuntimeSurfaceResourcesStartResult =
  | Readonly<{
      readonly status: "started";
      readonly snapshot: RuntimeSurfaceResourcesSnapshot;
      readonly entries: readonly RuntimeResourceInitialStartEntry[];
    }>
  | Readonly<{
      readonly status: "already-started";
      readonly snapshot: RuntimeSurfaceResourcesSnapshot;
    }>
  | Readonly<{
      readonly status: "invalid-snapshot";
      readonly snapshot: RuntimeSurfaceResourcesSnapshot;
    }>
  | Readonly<{ readonly status: "disposed" }>
  | Readonly<{ readonly status: "invalid-handle" }>;

/** Caller-owned refresh request evaluated before a pending request is superseded. */
export interface RuntimeResourceRefreshInput {
  /** Existing surface-local resource instance identifier. */
  readonly instanceId: string;
  /** Exact current snapshot object issued by this resource manager. */
  readonly resourceSnapshot: RuntimeSurfaceResourcesSnapshot;
  /** Current factory-created resolution snapshot used to re-evaluate the declared input. */
  readonly snapshot: RuntimeResolutionSnapshot;
}

/** Complete refresh result for any resource policy. */
export type RuntimeResourceRefreshResult =
  | RuntimeResourceInputResolutionRejected
  | RuntimeResourceInputSchemaRejected
  | RuntimeResourceSnapshotLimitRejected
  | Readonly<{
      readonly status: "started";
      readonly instanceId: string;
      readonly requestId: string;
      readonly snapshot: RuntimeSurfaceResourcesSnapshot;
      readonly settlement: Promise<RuntimeResourceSettlement>;
    }>
  | Readonly<{
      readonly status: "invalid-snapshot";
      readonly snapshot: RuntimeSurfaceResourcesSnapshot;
    }>
  | Readonly<{ readonly status: "unknown-instance"; readonly instanceId: string }>
  | Readonly<{ readonly status: "attempt-limit"; readonly instanceId: string }>
  | Readonly<{ readonly status: "busy" }>
  | Readonly<{ readonly status: "disposed" }>
  | Readonly<{ readonly status: "invalid-handle" }>
  | Readonly<{ readonly status: "malformed-request" }>;

/** Controlled terminal disposal result. */
export type RuntimeSurfaceResourcesDisposeResult =
  | Readonly<{ readonly status: "disposed"; readonly disposedAttempts: number }>
  | Readonly<{ readonly status: "already-disposed"; readonly disposedAttempts: 0 }>
  | Readonly<{ readonly status: "invalid-handle"; readonly disposedAttempts: 0 }>;

interface ResourceCatalogContract {
  readonly policies: ReadonlySet<RuntimeResourcePolicy>;
  readonly publicErrors: ReadonlySet<string>;
}

interface ResourceRecord {
  readonly instanceId: string;
  readonly capabilityId: string;
  readonly input: Readonly<Record<string, RuntimeValueSpec>>;
  readonly policy: RuntimeResourcePolicy;
  readonly publicErrors: ReadonlySet<string>;
  lifecycle: RuntimeLifecycleReferenceSnapshot;
  nextAttemptGeneration: number;
  currentAttempt: ResourceAttempt | undefined;
}

interface ResourceAttempt {
  readonly instanceId: string;
  readonly requestId: string;
  readonly generation: number;
  readonly request: RuntimeResourceRequest;
  readonly settlement: Promise<RuntimeResourceSettlement>;
  readonly resolve: (settlement: RuntimeResourceSettlement) => void;
  completed: boolean;
  reservationActive: boolean;
  transportState: "launched" | "queued" | "settled";
}

interface ResourceAuthority {
  status: "disposed" | "live";
  readonly documentId: string;
  readonly revision: string;
  readonly surfaceId: string;
  readonly catalogSet: DesenValidatedExecutionCatalogSet;
  readonly hostPorts: RuntimeHostPorts;
  readonly limits: Required<RuntimeResourceLimitProfile>;
  readonly records: Map<string, ResourceRecord>;
  readonly launchQueue: { readonly record: ResourceRecord; readonly attempt: ResourceAttempt }[];
  drainingTransports: boolean;
  outstandingTransports: number;
  reservedSnapshotTransitions: number;
  transitioning: boolean;
  started: boolean;
  snapshot: RuntimeSurfaceResourcesSnapshot;
}

interface MountEnvelope {
  readonly documentId: string;
  readonly revision: string;
  readonly surfaceId: string;
  readonly resources: RuntimeJsonObject;
  readonly catalogSet: DesenValidatedExecutionCatalogSet;
  readonly hostPorts: RuntimeHostPorts;
  readonly limits: Required<RuntimeResourceLimitProfile>;
}

type ResourceInputPreparation =
  | Readonly<{ readonly status: "prepared"; readonly value: RuntimeJsonObject }>
  | RuntimeResourceInputResolutionRejected
  | RuntimeResourceInputSchemaRejected;

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isResourcePolicy(value: unknown): value is RuntimeResourcePolicy {
  return value === "manual" || value === "mount" || value === "once";
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

function captureResourceLimits(input: unknown): Required<RuntimeResourceLimitProfile> | undefined {
  const defaults: Required<RuntimeResourceLimitProfile> = {
    maxAttemptGeneration: RUNTIME_RESOURCE_LIMITS.maxAttemptGeneration,
    maxSnapshotGeneration: RUNTIME_RESOURCE_LIMITS.maxSnapshotGeneration,
    maxActiveTransports: RUNTIME_RESOURCE_LIMITS.maxActiveTransports,
  };
  if (input === undefined) return Object.freeze(defaults);
  if (!isPlainRecord(input)) return undefined;
  let keys: readonly PropertyKey[];
  try {
    keys = Reflect.ownKeys(input);
  } catch {
    return undefined;
  }
  const allowed = new Set(["maxActiveTransports", "maxAttemptGeneration", "maxSnapshotGeneration"]);
  if (keys.some((key) => typeof key !== "string" || !allowed.has(key))) return undefined;

  const captured = { ...defaults };
  for (const key of keys as (keyof RuntimeResourceLimitProfile)[]) {
    const value = ownDataValue(input, key);
    if (!value.valid || !Number.isSafeInteger(value.value)) return undefined;
    const numeric = value.value as number;
    if (
      (key === "maxActiveTransports" &&
        (numeric < 1 || numeric > RUNTIME_RESOURCE_LIMITS.maxActiveTransports)) ||
      (key !== "maxActiveTransports" && (numeric < 0 || numeric > RUNTIME_RESOURCE_LIMITS[key]))
    ) {
      return undefined;
    }
    captured[key] = numeric;
  }
  return Object.freeze(captured);
}

function readMountEnvelope(input: unknown): MountEnvelope | undefined {
  const baseKeys = ["catalogSet", "documentId", "hostPorts", "resources", "revision", "surfaceId"];
  if (!isPlainRecord(input)) {
    return undefined;
  }
  const hasBaseKeys = exactOwnStringKeys(input, baseKeys);
  const hasLimitKeys = exactOwnStringKeys(input, [...baseKeys, "limits"]);
  if (!hasBaseKeys && !hasLimitKeys) return undefined;
  const documentId = ownDataValue(input, "documentId");
  const revision = ownDataValue(input, "revision");
  const surfaceId = ownDataValue(input, "surfaceId");
  const resources = ownDataValue(input, "resources");
  const catalogSet = ownDataValue(input, "catalogSet");
  const hostPorts = ownDataValue(input, "hostPorts");
  const limitInput = hasLimitKeys
    ? ownDataValue(input, "limits")
    : Object.freeze({ valid: true as const, value: undefined });
  const limits = limitInput.valid ? captureResourceLimits(limitInput.value) : undefined;
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
    !resources.valid ||
    !catalogSet.valid ||
    !hostPorts.valid ||
    limits === undefined
  ) {
    return undefined;
  }
  const resourceSnapshot = snapshotRuntimeJsonValue(resources.value);
  if (!isRuntimeJsonObject(resourceSnapshot)) return undefined;
  return Object.freeze({
    documentId: documentId.value,
    revision: revision.value,
    surfaceId: surfaceId.value,
    resources: resourceSnapshot,
    catalogSet: catalogSet.value as DesenValidatedExecutionCatalogSet,
    hostPorts: hostPorts.value as RuntimeHostPorts,
    limits,
  });
}

function resourceDiagnostic(
  code: string,
  message: string,
  authority: Pick<ResourceAuthority, "documentId" | "surfaceId">,
  capabilityId?: string,
  pointer?: JsonPointer,
): Readonly<DesenDiagnostic<string>> {
  const context = Object.freeze({
    documentId: authority.documentId,
    surfaceId: authority.surfaceId,
    ...(capabilityId === undefined ? {} : { capabilityId }),
  });
  return Object.freeze({
    code,
    message,
    ...(pointer === undefined ? {} : { pointer }),
    context,
  });
}

function coreDiagnostic(
  code:
    | "ADAPTER_FAILURE"
    | "REFERENCE_UNRESOLVED"
    | "RESOURCE_INPUT_INVALID"
    | "RESOURCE_OUTPUT_INVALID"
    | "UNKNOWN_CAPABILITY",
  message: string,
  authority: Pick<ResourceAuthority, "documentId" | "surfaceId">,
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

function prefixPointer(parameter: string, pointer: JsonPointer): JsonPointer {
  let result = appendJsonPointer(ROOT_POINTER, parameter);
  for (const segment of parseJsonPointer(pointer)) result = appendJsonPointer(result, segment);
  return result;
}

function safeReport(
  authority: ResourceAuthority,
  diagnostics: readonly DesenDiagnostic<string>[],
): void {
  for (const diagnostic of diagnostics) {
    if (authority.status !== "live") break;
    try {
      Reflect.apply(authority.hostPorts.diagnostics.report, undefined, [diagnostic]);
    } catch {
      // Observation is intentionally unable to alter a resource transition.
    }
  }
}

function catalogContract(
  catalogSet: DesenValidatedExecutionCatalogSet,
  capabilityId: string,
): ResourceCatalogContract | undefined {
  let capability: ImmutableJson<DesenCatalog>["resources"][string] | undefined;
  for (const catalog of catalogSet) {
    if (Object.hasOwn(catalog.resources, capabilityId)) {
      capability = catalog.resources[capabilityId];
      break;
    }
  }
  if (capability === undefined) return undefined;
  return Object.freeze({
    policies: new Set(capability.policies) as ReadonlySet<RuntimeResourcePolicy>,
    publicErrors: new Set(capability.errors.map(({ code }) => code)),
  });
}

function invalidMount(
  reason: RuntimeSurfaceResourcesMountInvalidReason,
  diagnostics: readonly DesenDiagnostic<string>[] = EMPTY_DIAGNOSTICS,
  instanceId?: string,
): RuntimeSurfaceResourcesMountInvalid {
  return Object.freeze({
    status: "invalid",
    reason,
    ...(instanceId === undefined ? {} : { instanceId }),
    diagnostics: Object.freeze([...diagnostics]),
  });
}

function snapshotLimitRejection(
  authority: ResourceAuthority,
  record: ResourceRecord,
): RuntimeResourceSnapshotLimitRejected {
  return Object.freeze({
    status: "snapshot-limit",
    instanceId: record.instanceId,
    diagnostics: Object.freeze([
      resourceDiagnostic(
        "run.desen.runtime/RESOURCE_SNAPSHOT_LIMIT_EXCEEDED",
        "No pending request can start while preserving a terminal resource snapshot slot.",
        authority,
        record.capabilityId,
      ),
    ]),
  });
}

function parseResourceRecord(
  instanceId: string,
  input: RuntimeJsonValue,
  catalogSet: DesenValidatedExecutionCatalogSet,
): Readonly<
  | { readonly valid: true; readonly record: ResourceRecord }
  | {
      readonly valid: false;
      readonly reason: "malformed-input" | "unknown-capability" | "unsupported-policy";
      readonly diagnostic?: DesenDiagnostic<string>;
    }
> {
  const use = isRuntimeJsonObject(input) ? input.use : undefined;
  const policy = isRuntimeJsonObject(input) ? input.policy : undefined;
  if (
    !LOCAL_IDENTIFIER_PATTERN.test(instanceId) ||
    !isRuntimeJsonObject(input) ||
    !["input\u0000policy\u0000use", "extensions\u0000input\u0000policy\u0000use"].includes(
      Object.keys(input).sort(compareText).join("\u0000"),
    ) ||
    typeof use !== "string" ||
    !isRuntimeJsonObject(input.input) ||
    !isResourcePolicy(policy) ||
    (Object.hasOwn(input, "extensions") && !isRuntimeJsonObject(input.extensions))
  ) {
    return Object.freeze({ valid: false, reason: "malformed-input" });
  }
  const contract = catalogContract(catalogSet, use);
  if (contract === undefined) {
    return Object.freeze({ valid: false, reason: "unknown-capability" });
  }
  if (!contract.policies.has(policy)) {
    return Object.freeze({ valid: false, reason: "unsupported-policy" });
  }
  return Object.freeze({
    valid: true,
    record: {
      instanceId,
      capabilityId: use,
      input: input.input as Readonly<Record<string, RuntimeValueSpec>>,
      policy,
      publicErrors: contract.publicErrors,
      lifecycle: Object.freeze({ status: "idle", pending: false }),
      nextAttemptGeneration: 0,
      currentAttempt: undefined,
    },
  });
}

function publishSnapshot(
  authority: ResourceAuthority,
  advance: boolean,
): RuntimeSurfaceResourcesSnapshot {
  const nextGeneration = advance
    ? authority.snapshot.generation + 1
    : authority.snapshot.generation;
  if (
    !Number.isSafeInteger(nextGeneration) ||
    nextGeneration > authority.limits.maxSnapshotGeneration
  ) {
    throw new RangeError("Runtime resource snapshot generation exceeded its exact integer bound.");
  }
  const lifecycles: Record<string, RuntimeLifecycleReferenceSnapshot> = Object.create(null);
  for (const instanceId of [...authority.records.keys()].sort(compareText)) {
    const record = authority.records.get(instanceId);
    if (record === undefined) {
      throw new RangeError("Runtime resource inventory changed during snapshot publication.");
    }
    lifecycles[instanceId] = record.lifecycle;
  }
  const detachedLifecycles = snapshotRuntimeJsonValue(lifecycles);
  if (!isRuntimeJsonObject(detachedLifecycles)) {
    throw new RangeError(
      "Runtime resource lifecycle map exceeded the shared JSON safety boundary.",
    );
  }
  authority.snapshot = Object.freeze({
    documentId: authority.documentId,
    revision: authority.revision,
    surfaceId: authority.surfaceId,
    generation: nextGeneration,
    lifecycles: detachedLifecycles as Readonly<Record<string, RuntimeLifecycleReferenceSnapshot>>,
  });
  return authority.snapshot;
}

function liveAuthority(
  handle: RuntimeSurfaceResourcesHandle,
): ResourceAuthority | "disposed" | undefined {
  if (typeof handle !== "object" || handle === null) return undefined;
  const authority = RESOURCE_AUTHORITIES.get(handle as object);
  if (authority === undefined) return undefined;
  if (authority === DISPOSED_RESOURCE_AUTHORITY) return "disposed";
  return authority.status === "disposed" ? "disposed" : authority;
}

function resolutionSnapshotMatches(
  authority: ResourceAuthority,
  snapshot: RuntimeResolutionSnapshot,
  resourceSnapshot: RuntimeSurfaceResourcesSnapshot,
): boolean {
  if (resourceSnapshot !== authority.snapshot) return false;
  try {
    const brandProbe = resolveRuntimeValue(null, snapshot);
    return (
      brandProbe.status === "resolved" &&
      canonicalizeJson(snapshot.resource) === canonicalizeJson(authority.snapshot.lifecycles)
    );
  } catch {
    return false;
  }
}

function resolutionDiagnostic(
  authority: ResourceAuthority,
  record: ResourceRecord,
  parameter: string,
  resolution: Exclude<RuntimeValueMaterialization, { readonly status: "resolved" }>,
): readonly DesenDiagnostic<string>[] {
  const pointer = prefixPointer(parameter, resolution.pointer);
  if (resolution.status === "unresolved") {
    return Object.freeze([
      coreDiagnostic(
        "REFERENCE_UNRESOLVED",
        "A required resource input reference has no value or eligible fallback.",
        authority,
        record.capabilityId,
        pointer,
      ),
    ]);
  }
  if (resolution.status === "failed") {
    return Object.freeze([
      coreDiagnostic(
        "ADAPTER_FAILURE",
        "The resource input token provider failed unexpectedly.",
        authority,
        record.capabilityId,
        pointer,
      ),
    ]);
  }
  return Object.freeze([
    coreDiagnostic(
      "RESOURCE_INPUT_INVALID",
      "A resource input ValueSpec is malformed or exceeds the runtime data boundary.",
      authority,
      record.capabilityId,
      pointer,
    ),
  ]);
}

function nextAttemptRequestId(
  authority: ResourceAuthority,
  record: ResourceRecord,
): string | undefined {
  const generation = record.nextAttemptGeneration;
  if (!Number.isSafeInteger(generation) || generation > authority.limits.maxAttemptGeneration) {
    return undefined;
  }
  return `resource:${canonicalizeJson([record.instanceId, generation])}`;
}

function remapMaterializationFailure(
  keys: readonly string[],
  resolution: Exclude<RuntimeValueMaterialization, { readonly status: "resolved" }>,
): Readonly<{
  readonly parameter: string;
  readonly resolution: Exclude<RuntimeValueMaterialization, { readonly status: "resolved" }>;
}> {
  let parameter = keys[0] ?? "input";
  let pointer = resolution.pointer;
  try {
    const segments = parseJsonPointer(resolution.pointer);
    const indexText = segments[0];
    if (
      indexText !== undefined &&
      /^(?:0|[1-9][0-9]*)$/u.test(indexText) &&
      Number(indexText) < keys.length
    ) {
      parameter = keys[Number(indexText)] as string;
      pointer = ROOT_POINTER;
      for (const segment of segments.slice(1)) {
        pointer = appendJsonPointer(pointer, segment);
      }
    }
  } catch {
    pointer = ROOT_POINTER;
  }
  return Object.freeze({
    parameter,
    resolution: Object.freeze({ ...resolution, pointer }) as Exclude<
      RuntimeValueMaterialization,
      { readonly status: "resolved" }
    >,
  });
}

function prepareResourceInput(
  authority: ResourceAuthority,
  record: ResourceRecord,
  snapshot: RuntimeResolutionSnapshot,
  requestId: string,
): ResourceInputPreparation {
  const keys = Object.keys(record.input).sort(compareText);
  const specs = keys.map((parameter) => record.input[parameter] as RuntimeValueSpec);
  let materialization: RuntimeValueMaterialization;
  try {
    materialization = materializeRuntimeValue(specs, snapshot, {
      requestContext: Object.freeze({
        documentId: authority.documentId,
        revision: authority.revision,
        surfaceId: authority.surfaceId,
        requestId,
      }),
      tokens: Object.freeze({
        resolve(request: Parameters<RuntimeHostPorts["tokens"]["resolve"]>[0]) {
          if (authority.status !== "live") {
            throw new TypeError("The resource lifetime was disposed during input preparation.");
          }
          return Reflect.apply(authority.hostPorts.tokens.resolve, undefined, [request]);
        },
      }),
    });
  } catch {
    const parameter = keys[0] ?? "input";
    const resolution = Object.freeze({
      status: "invalid",
      pointer: ROOT_POINTER,
      reason: "unsafe-or-unbounded-json",
    } as const);
    return Object.freeze({
      status: "input-rejected",
      instanceId: record.instanceId,
      reason: "resolution",
      parameter,
      resolution,
      diagnostics: Object.freeze([
        coreDiagnostic(
          "RESOURCE_INPUT_INVALID",
          "The resource input resolution snapshot or token provider is invalid.",
          authority,
          record.capabilityId,
          appendJsonPointer(ROOT_POINTER, parameter),
        ),
      ]),
    });
  }
  if (materialization.status !== "resolved") {
    const remapped = remapMaterializationFailure(keys, materialization);
    return Object.freeze({
      status: "input-rejected",
      instanceId: record.instanceId,
      reason: "resolution",
      parameter: remapped.parameter,
      resolution: remapped.resolution,
      diagnostics: resolutionDiagnostic(authority, record, remapped.parameter, remapped.resolution),
    });
  }
  if (!Array.isArray(materialization.value) || materialization.value.length !== keys.length) {
    return Object.freeze({
      status: "input-rejected",
      instanceId: record.instanceId,
      reason: "schema",
      diagnostics: Object.freeze([
        coreDiagnostic(
          "RESOURCE_INPUT_INVALID",
          "The resource input materializer did not preserve its exact member inventory.",
          authority,
          record.capabilityId,
          ROOT_POINTER,
        ),
      ]),
    });
  }

  const resolved: Record<string, RuntimeJsonValue> = Object.create(null);
  for (const [index, parameter] of keys.entries()) {
    resolved[parameter] = materialization.value[index] as RuntimeJsonValue;
  }
  const candidate = Object.freeze(resolved);
  const validation = validateDesenExecutionValue(
    candidate,
    { kind: "resource-input", capabilityId: record.capabilityId },
    authority.catalogSet,
  );
  if (!validation.valid) {
    return Object.freeze({
      status: "input-rejected",
      instanceId: record.instanceId,
      reason: "schema",
      diagnostics: validation.diagnostics,
    });
  }
  if (!isRuntimeJsonObject(validation.value)) {
    return Object.freeze({
      status: "input-rejected",
      instanceId: record.instanceId,
      reason: "schema",
      diagnostics: Object.freeze([
        coreDiagnostic(
          "RESOURCE_INPUT_INVALID",
          "The resource input contract did not preserve the required object boundary.",
          authority,
          record.capabilityId,
          ROOT_POINTER,
        ),
      ]),
    });
  }
  return Object.freeze({ status: "prepared", value: validation.value });
}

function createAttempt(
  authority: ResourceAuthority,
  record: ResourceRecord,
  input: RuntimeJsonObject,
): ResourceAttempt | undefined {
  const generation = record.nextAttemptGeneration;
  const requestId = nextAttemptRequestId(authority, record);
  if (requestId === undefined) return undefined;
  record.nextAttemptGeneration += 1;
  let resolveSettlement!: (settlement: RuntimeResourceSettlement) => void;
  const settlement = new Promise<RuntimeResourceSettlement>((resolve) => {
    resolveSettlement = resolve;
  });
  return {
    instanceId: record.instanceId,
    requestId,
    generation,
    request: Object.freeze({
      context: Object.freeze({
        documentId: authority.documentId,
        revision: authority.revision,
        surfaceId: authority.surfaceId,
        requestId,
      }),
      instanceId: record.instanceId,
      capabilityId: record.capabilityId,
      input,
    }),
    settlement,
    resolve: resolveSettlement,
    completed: false,
    reservationActive: false,
    transportState: "queued",
  };
}

function canReserveAttempt(
  authority: ResourceAuthority,
  replacedAttempt?: ResourceAttempt,
): boolean {
  const released = replacedAttempt !== undefined && replacedAttempt.reservationActive ? 1 : 0;
  const retainedReservations = authority.reservedSnapshotTransitions - released + 1;
  return (
    retainedReservations >= 0 &&
    1 + retainedReservations <=
      authority.limits.maxSnapshotGeneration - authority.snapshot.generation
  );
}

function reserveAttempt(authority: ResourceAuthority, attempt: ResourceAttempt): void {
  if (attempt.reservationActive) return;
  attempt.reservationActive = true;
  authority.reservedSnapshotTransitions += 1;
}

function releaseAttemptReservation(authority: ResourceAuthority, attempt: ResourceAttempt): void {
  if (!attempt.reservationActive) return;
  attempt.reservationActive = false;
  authority.reservedSnapshotTransitions -= 1;
}

function completeAttempt(attempt: ResourceAttempt, settlement: RuntimeResourceSettlement): void {
  if (attempt.completed) return;
  attempt.completed = true;
  attempt.resolve(Object.freeze(settlement));
}

function supersedeAttempt(
  authority: ResourceAuthority,
  attempt: ResourceAttempt,
  snapshot: RuntimeSurfaceResourcesSnapshot,
): void {
  releaseAttemptReservation(authority, attempt);
  completeAttempt(attempt, {
    status: "superseded",
    instanceId: attempt.instanceId,
    requestId: attempt.requestId,
    snapshot,
  });
}

function technicalSettlement(
  authority: ResourceAuthority,
  record: ResourceRecord,
  attempt: ResourceAttempt,
  status: "adapter-failed" | "denied" | "invalid-output",
  diagnostics: readonly DesenDiagnostic<string>[],
): void {
  record.currentAttempt = undefined;
  record.lifecycle = Object.freeze({ status: "idle", pending: false });
  const snapshot = publishSnapshot(authority, true);
  releaseAttemptReservation(authority, attempt);
  const frozenDiagnostics = Object.freeze([...diagnostics]);
  completeAttempt(attempt, {
    status,
    instanceId: record.instanceId,
    requestId: attempt.requestId,
    diagnostics: frozenDiagnostics,
    snapshot,
  });
  safeReport(authority, frozenDiagnostics);
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

function settleHostResult(
  authority: ResourceAuthority,
  record: ResourceRecord,
  attempt: ResourceAttempt,
  rawResult: unknown,
): void {
  if (authority.status !== "live" || record.currentAttempt !== attempt || attempt.completed) {
    return;
  }
  const result = closedHostResult(rawResult);
  if (result === undefined) {
    technicalSettlement(authority, record, attempt, "adapter-failed", [
      coreDiagnostic(
        "ADAPTER_FAILURE",
        "The resource adapter returned a malformed settlement envelope.",
        authority,
        record.capabilityId,
      ),
    ]);
    return;
  }
  if (result.status === "denied") {
    technicalSettlement(authority, record, attempt, "denied", [
      resourceDiagnostic(
        "run.desen.runtime/RESOURCE_DENIED",
        "Current host policy denied the resource request.",
        authority,
        record.capabilityId,
      ),
    ]);
    return;
  }
  if (result.status === "failed") {
    if (!record.publicErrors.has(result.errorCode)) {
      technicalSettlement(authority, record, attempt, "adapter-failed", [
        coreDiagnostic(
          "ADAPTER_FAILURE",
          "The resource adapter returned an undeclared public error code.",
          authority,
          record.capabilityId,
        ),
      ]);
      return;
    }
    record.currentAttempt = undefined;
    record.lifecycle = Object.freeze({
      status: "failed",
      pending: false,
      error: Object.freeze({ code: result.errorCode }),
    });
    let snapshot: RuntimeSurfaceResourcesSnapshot;
    try {
      snapshot = publishSnapshot(authority, true);
    } catch {
      technicalSettlement(authority, record, attempt, "invalid-output", [
        resourceDiagnostic(
          "run.desen.runtime/RESOURCE_RETAINED_LIMIT_EXCEEDED",
          "The resource failure lifecycle would exceed the surface data boundary.",
          authority,
          record.capabilityId,
        ),
      ]);
      return;
    }
    releaseAttemptReservation(authority, attempt);
    completeAttempt(attempt, {
      status: "failed",
      instanceId: record.instanceId,
      requestId: attempt.requestId,
      errorCode: result.errorCode,
      snapshot,
    });
    return;
  }

  const validation = validateDesenExecutionValue(
    result.value,
    { kind: "resource-output", capabilityId: record.capabilityId },
    authority.catalogSet,
  );
  if (!validation.valid) {
    technicalSettlement(authority, record, attempt, "invalid-output", [
      coreDiagnostic(
        "RESOURCE_OUTPUT_INVALID",
        "The resource adapter returned output that does not satisfy its declared contract.",
        authority,
        record.capabilityId,
        ROOT_POINTER,
      ),
    ]);
    return;
  }
  record.currentAttempt = undefined;
  record.lifecycle = Object.freeze({
    status: "succeeded",
    pending: false,
    value: validation.value,
  });
  let snapshot: RuntimeSurfaceResourcesSnapshot;
  try {
    snapshot = publishSnapshot(authority, true);
  } catch {
    technicalSettlement(authority, record, attempt, "invalid-output", [
      resourceDiagnostic(
        "run.desen.runtime/RESOURCE_RETAINED_LIMIT_EXCEEDED",
        "The validated resource output would exceed the surface lifecycle data boundary.",
        authority,
        record.capabilityId,
      ),
    ]);
    return;
  }
  releaseAttemptReservation(authority, attempt);
  completeAttempt(attempt, {
    status: "succeeded",
    instanceId: record.instanceId,
    requestId: attempt.requestId,
    snapshot,
  });
}

function settleHostFailure(
  authority: ResourceAuthority,
  record: ResourceRecord,
  attempt: ResourceAttempt,
): void {
  if (authority.status !== "live" || record.currentAttempt !== attempt || attempt.completed) {
    return;
  }
  technicalSettlement(authority, record, attempt, "adapter-failed", [
    coreDiagnostic(
      "ADAPTER_FAILURE",
      "The resource adapter failed unexpectedly.",
      authority,
      record.capabilityId,
    ),
  ]);
}

function removeQueuedAttempt(authority: ResourceAuthority, attempt: ResourceAttempt): void {
  if (attempt.transportState !== "queued") return;
  const index = authority.launchQueue.findIndex(({ attempt: candidate }) => candidate === attempt);
  if (index >= 0) authority.launchQueue.splice(index, 1);
  attempt.transportState = "settled";
}

function finishTransport(
  authority: ResourceAuthority,
  attempt: ResourceAttempt,
  settle: () => void,
): void {
  if (attempt.transportState !== "launched") return;
  try {
    settle();
  } finally {
    attempt.transportState = "settled";
    authority.outstandingTransports -= 1;
    drainLaunchQueue(authority);
  }
}

function launchAttempt(
  authority: ResourceAuthority,
  record: ResourceRecord,
  attempt: ResourceAttempt,
): void {
  if (authority.status !== "live" || record.currentAttempt !== attempt || attempt.completed) {
    return;
  }
  attempt.transportState = "launched";
  authority.outstandingTransports += 1;
  let result: unknown;
  try {
    result = Reflect.apply(authority.hostPorts.resources.load, undefined, [attempt.request]);
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

function drainLaunchQueue(authority: ResourceAuthority): void {
  if (authority.drainingTransports) return;
  authority.drainingTransports = true;
  try {
    while (
      authority.status === "live" &&
      authority.outstandingTransports < authority.limits.maxActiveTransports
    ) {
      const queued = authority.launchQueue.shift();
      if (queued === undefined) break;
      if (
        queued.attempt.transportState !== "queued" ||
        queued.attempt.completed ||
        queued.record.currentAttempt !== queued.attempt
      ) {
        queued.attempt.transportState = "settled";
        continue;
      }
      launchAttempt(authority, queued.record, queued.attempt);
    }
  } finally {
    authority.drainingTransports = false;
  }
}

function scheduleAttempt(
  authority: ResourceAuthority,
  record: ResourceRecord,
  attempt: ResourceAttempt,
): void {
  if (authority.status !== "live" || record.currentAttempt !== attempt || attempt.completed) {
    return;
  }
  attempt.transportState = "queued";
  authority.launchQueue.push(Object.freeze({ record, attempt }));
  drainLaunchQueue(authority);
}

/**
 * Mounts every surface resource atomically as an idle lifecycle without calling the host.
 *
 * @remarks The Catalog set must be the exact factory-authenticated T11 value. Capability policy
 * and public-error metadata are copied from that immutable set; callers cannot supply either.
 * Inputs remain inert ValueSpecs until a later start or refresh receives one matching atomic
 * resolution snapshot.
 */
export function mountRuntimeSurfaceResources(
  input: RuntimeSurfaceResourcesMountInput,
): RuntimeSurfaceResourcesMountResult {
  const envelope = readMountEnvelope(input);
  if (envelope === undefined) return invalidMount("malformed-input");

  const catalogValidation = validateDesenExecutionCatalogSet(envelope.catalogSet);
  if (!catalogValidation.valid || catalogValidation.value !== envelope.catalogSet) {
    return invalidMount(
      "catalog-set-invalid",
      catalogValidation.valid ? EMPTY_DIAGNOSTICS : catalogValidation.diagnostics,
    );
  }

  let hostPorts: RuntimeHostPorts;
  try {
    hostPorts = createRuntimeHostPorts(envelope.hostPorts);
  } catch {
    return invalidMount("malformed-input");
  }

  const authority: ResourceAuthority = {
    status: "live",
    documentId: envelope.documentId,
    revision: envelope.revision,
    surfaceId: envelope.surfaceId,
    catalogSet: envelope.catalogSet,
    hostPorts,
    limits: envelope.limits,
    records: new Map(),
    launchQueue: [],
    drainingTransports: false,
    outstandingTransports: 0,
    reservedSnapshotTransitions: 0,
    transitioning: false,
    started: false,
    snapshot: Object.freeze({
      documentId: envelope.documentId,
      revision: envelope.revision,
      surfaceId: envelope.surfaceId,
      generation: 0,
      lifecycles: Object.freeze({}),
    }),
  };

  for (const instanceId of Object.keys(envelope.resources).sort(compareText)) {
    const parsed = parseResourceRecord(
      instanceId,
      envelope.resources[instanceId] as RuntimeJsonValue,
      envelope.catalogSet,
    );
    if (!parsed.valid) {
      const diagnostics =
        parsed.reason === "unknown-capability"
          ? Object.freeze([
              coreDiagnostic(
                "UNKNOWN_CAPABILITY",
                "The surface resource capability is absent from the prepared Catalog set.",
                authority,
                isRuntimeJsonObject(envelope.resources[instanceId])
                  ? String(envelope.resources[instanceId].use ?? "")
                  : undefined,
              ),
            ])
          : parsed.reason === "unsupported-policy"
            ? Object.freeze([
                coreDiagnostic(
                  "RESOURCE_INPUT_INVALID",
                  "The selected resource policy is not declared by its exact capability.",
                  authority,
                  isRuntimeJsonObject(envelope.resources[instanceId])
                    ? String(envelope.resources[instanceId].use ?? "")
                    : undefined,
                  appendJsonPointer(ROOT_POINTER, "policy"),
                ),
              ])
            : EMPTY_DIAGNOSTICS;
      return invalidMount(parsed.reason, diagnostics, instanceId);
    }
    authority.records.set(instanceId, parsed.record);
  }

  publishSnapshot(authority, false);
  const handle = Object.freeze({}) as RuntimeSurfaceResourcesHandle;
  RESOURCE_AUTHORITIES.set(handle, authority);
  return Object.freeze({
    status: "mounted",
    handle,
    snapshot: authority.snapshot,
  });
}

/** Reads the exact current immutable resource snapshot without invoking a host callback. */
export function readRuntimeSurfaceResources(
  handle: RuntimeSurfaceResourcesHandle,
): RuntimeSurfaceResourcesReadResult {
  const authority = liveAuthority(handle);
  if (authority === undefined) return Object.freeze({ status: "invalid-handle" });
  if (authority === "disposed") return Object.freeze({ status: "disposed" });
  return Object.freeze({ status: "read", snapshot: authority.snapshot });
}

/**
 * Starts all `mount` and `once` resources from one matching pre-start resolution snapshot.
 *
 * @remarks Every input is resolved and schema-validated before the batch publishes its single
 * pending generation. `manual` instances remain idle. Host callbacks are invoked in exact
 * instance-id order only after that batch transition, and even a synchronous result settles in a
 * later Promise microtask so callers can observe `pending`.
 */
export function startRuntimeSurfaceResources(
  handle: RuntimeSurfaceResourcesHandle,
  snapshot: RuntimeResolutionSnapshot,
  resourceSnapshot: RuntimeSurfaceResourcesSnapshot,
): RuntimeSurfaceResourcesStartResult {
  const authority = liveAuthority(handle);
  if (authority === undefined) return Object.freeze({ status: "invalid-handle" });
  if (authority === "disposed") return Object.freeze({ status: "disposed" });
  if (authority.started) {
    return Object.freeze({ status: "already-started", snapshot: authority.snapshot });
  }
  if (!resolutionSnapshotMatches(authority, snapshot, resourceSnapshot)) {
    return Object.freeze({ status: "invalid-snapshot", snapshot: authority.snapshot });
  }

  authority.started = true;
  authority.transitioning = true;
  try {
    const entries: RuntimeResourceInitialStartEntry[] = [];
    const attempts: Readonly<{ record: ResourceRecord; attempt: ResourceAttempt }>[] = [];
    const diagnostics: DesenDiagnostic<string>[] = [];
    for (const record of [...authority.records.values()].sort((left, right) =>
      compareText(left.instanceId, right.instanceId),
    )) {
      if (record.policy === "manual") {
        entries.push(Object.freeze({ status: "manual", instanceId: record.instanceId }));
        continue;
      }
      if (!canReserveAttempt(authority)) {
        const rejected = snapshotLimitRejection(authority, record);
        entries.push(rejected);
        diagnostics.push(...rejected.diagnostics);
        continue;
      }
      const requestId = nextAttemptRequestId(authority, record);
      if (requestId === undefined) {
        const diagnostic = resourceDiagnostic(
          "run.desen.runtime/RESOURCE_ATTEMPT_LIMIT_EXCEEDED",
          "The resource attempt counter exceeded its exact integer bound.",
          authority,
          record.capabilityId,
        );
        entries.push(
          Object.freeze({
            status: "input-rejected",
            instanceId: record.instanceId,
            reason: "schema",
            diagnostics: Object.freeze([diagnostic]),
          }),
        );
        diagnostics.push(diagnostic);
        continue;
      }
      const prepared = prepareResourceInput(authority, record, snapshot, requestId);
      if (authority.status !== "live") return Object.freeze({ status: "disposed" });
      if (prepared.status !== "prepared") {
        entries.push(prepared);
        diagnostics.push(...prepared.diagnostics);
        continue;
      }
      const attempt = createAttempt(authority, record, prepared.value);
      if (attempt === undefined) {
        const diagnostic = resourceDiagnostic(
          "run.desen.runtime/RESOURCE_ATTEMPT_LIMIT_EXCEEDED",
          "The resource attempt counter exceeded its exact integer bound.",
          authority,
          record.capabilityId,
        );
        entries.push(
          Object.freeze({
            status: "input-rejected",
            instanceId: record.instanceId,
            reason: "schema",
            diagnostics: Object.freeze([diagnostic]),
          }),
        );
        diagnostics.push(diagnostic);
        continue;
      }
      reserveAttempt(authority, attempt);
      record.currentAttempt = attempt;
      record.lifecycle = Object.freeze({ status: "pending", pending: true });
      attempts.push(Object.freeze({ record, attempt }));
      entries.push(
        Object.freeze({
          status: "started",
          instanceId: record.instanceId,
          requestId: attempt.requestId,
          settlement: attempt.settlement,
        }),
      );
    }

    const pendingSnapshot =
      attempts.length > 0 ? publishSnapshot(authority, true) : authority.snapshot;
    for (const { record, attempt } of attempts) {
      scheduleAttempt(authority, record, attempt);
    }
    safeReport(authority, diagnostics);
    return Object.freeze({
      status: "started",
      snapshot: pendingSnapshot,
      entries: Object.freeze(entries),
    });
  } finally {
    authority.transitioning = false;
  }
}

/**
 * Re-evaluates and reloads one resource under any policy.
 *
 * @remarks Input resolution and schema validation happen before a live request is superseded.
 * Once a new request is accepted, the prior attempt becomes logically stale; its later host
 * settlement is ignored before the envelope is inspected. No transport cancellation, retry,
 * timeout, or cache policy is invented by this primitive.
 */
export function refreshRuntimeSurfaceResource(
  handle: RuntimeSurfaceResourcesHandle,
  input: RuntimeResourceRefreshInput,
): RuntimeResourceRefreshResult {
  const authority = liveAuthority(handle);
  if (authority === undefined) return Object.freeze({ status: "invalid-handle" });
  if (authority === "disposed") return Object.freeze({ status: "disposed" });
  if (authority.transitioning) return Object.freeze({ status: "busy" });
  if (
    !isPlainRecord(input) ||
    !exactOwnStringKeys(input, ["instanceId", "resourceSnapshot", "snapshot"])
  ) {
    return Object.freeze({ status: "malformed-request" });
  }
  const instanceId = ownDataValue(input, "instanceId");
  const currentResourceSnapshot = ownDataValue(input, "resourceSnapshot");
  const resolutionSnapshot = ownDataValue(input, "snapshot");
  if (
    !instanceId.valid ||
    typeof instanceId.value !== "string" ||
    !LOCAL_IDENTIFIER_PATTERN.test(instanceId.value) ||
    !currentResourceSnapshot.valid ||
    !resolutionSnapshot.valid
  ) {
    return Object.freeze({ status: "malformed-request" });
  }
  const record = authority.records.get(instanceId.value);
  if (record === undefined) {
    return Object.freeze({ status: "unknown-instance", instanceId: instanceId.value });
  }
  const snapshot = resolutionSnapshot.value as RuntimeResolutionSnapshot;
  if (
    !resolutionSnapshotMatches(
      authority,
      snapshot,
      currentResourceSnapshot.value as RuntimeSurfaceResourcesSnapshot,
    )
  ) {
    return Object.freeze({ status: "invalid-snapshot", snapshot: authority.snapshot });
  }
  const previousAttempt = record.currentAttempt;
  if (!canReserveAttempt(authority, previousAttempt)) {
    const rejected = snapshotLimitRejection(authority, record);
    safeReport(authority, rejected.diagnostics);
    return rejected;
  }
  const requestId = nextAttemptRequestId(authority, record);
  if (requestId === undefined) {
    return Object.freeze({ status: "attempt-limit", instanceId: record.instanceId });
  }

  authority.transitioning = true;
  try {
    const prepared = prepareResourceInput(authority, record, snapshot, requestId);
    if (authority.status !== "live") return Object.freeze({ status: "disposed" });
    if (prepared.status !== "prepared") {
      safeReport(authority, prepared.diagnostics);
      return prepared;
    }
    const attempt = createAttempt(authority, record, prepared.value);
    if (attempt === undefined) {
      return Object.freeze({ status: "attempt-limit", instanceId: record.instanceId });
    }

    reserveAttempt(authority, attempt);
    record.currentAttempt = attempt;
    record.lifecycle = Object.freeze({ status: "pending", pending: true });
    const pendingSnapshot = publishSnapshot(authority, true);
    if (previousAttempt !== undefined) {
      removeQueuedAttempt(authority, previousAttempt);
      supersedeAttempt(authority, previousAttempt, pendingSnapshot);
    }
    scheduleAttempt(authority, record, attempt);
    return Object.freeze({
      status: "started",
      instanceId: record.instanceId,
      requestId: attempt.requestId,
      snapshot: pendingSnapshot,
      settlement: attempt.settlement,
    });
  } finally {
    authority.transitioning = false;
  }
}

/**
 * Revokes one complete surface resource lifetime and logically invalidates pending settlements.
 *
 * @remarks Disposal is terminal and idempotent. It cannot cancel host transport, erase retained
 * caller snapshots, or convert a late settlement into lifecycle data.
 */
export function disposeRuntimeSurfaceResources(
  handle: RuntimeSurfaceResourcesHandle,
): RuntimeSurfaceResourcesDisposeResult {
  const authority = liveAuthority(handle);
  if (authority === undefined) {
    return Object.freeze({ status: "invalid-handle", disposedAttempts: 0 });
  }
  if (authority === "disposed") {
    return Object.freeze({ status: "already-disposed", disposedAttempts: 0 });
  }
  authority.status = "disposed";
  let disposedAttempts = 0;
  for (const record of authority.records.values()) {
    const attempt = record.currentAttempt;
    record.currentAttempt = undefined;
    if (attempt === undefined || attempt.completed) continue;
    removeQueuedAttempt(authority, attempt);
    releaseAttemptReservation(authority, attempt);
    disposedAttempts += 1;
    completeAttempt(attempt, {
      status: "disposed",
      instanceId: attempt.instanceId,
      requestId: attempt.requestId,
    });
  }
  authority.launchQueue.length = 0;
  authority.records.clear();
  RESOURCE_AUTHORITIES.set(handle as object, DISPOSED_RESOURCE_AUTHORITY);
  return Object.freeze({ status: "disposed", disposedAttempts });
}
