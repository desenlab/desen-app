/* eslint-disable @typescript-eslint/no-invalid-void-type -- The evaluator and host callbacks are
 * deliberately receiver-independent through TypeScript's explicit `this: void` contract. */
import { canonicalizeJson, isSha256Digest } from "@desen/protocol";

import { readRuntimeSurfaceState } from "./local-state.js";
import { readRuntimeSurfaceOperations } from "./operation-lifecycle.js";
import {
  isRuntimeReactiveHostPorts,
  type RuntimeReactiveHostPorts,
} from "./reactive-host-ports.js";
import { readRuntimeSurfaceResources } from "./resource-lifecycle.js";
import { isRuntimeJsonObject, snapshotRuntimeJsonValue } from "./runtime-json-snapshot.js";
import { createRuntimeResolutionSnapshot } from "./value-resolution.js";

import type {
  RuntimeJsonObject,
  RuntimeJsonValue,
  RuntimeRequestContext,
  RuntimeTokenPort,
} from "./host-ports.js";
import type { RuntimeSurfaceStateHandle, RuntimeSurfaceStateSnapshot } from "./local-state.js";
import type {
  RuntimeSurfaceOperationsHandle,
  RuntimeSurfaceOperationsSnapshot,
} from "./operation-lifecycle.js";
import type {
  RuntimeSurfaceResourcesHandle,
  RuntimeSurfaceResourcesSnapshot,
} from "./resource-lifecycle.js";
import type { RuntimeResolutionSnapshot } from "./value-resolution.js";

const LOCAL_IDENTIFIER_PATTERN = /^[A-Za-z][A-Za-z0-9._:-]{0,127}$/u;
const EMPTY_OBJECT = Object.freeze({}) as RuntimeJsonObject;
const UNAVAILABLE_EVENT = Object.freeze({ status: "unavailable" } as const);

declare const RUNTIME_REACTIVE_REEVALUATION_HANDLE_TYPE_BRAND: unique symbol;

/** Reference-profile ceilings for one whole-surface reactive coordinator. */
export const RUNTIME_REACTIVE_REEVALUATION_LIMITS = Object.freeze({
  /** Largest number of synchronous dirty-state transitions drained in one wave. */
  maxSynchronousTransitions: 64,
  /** Largest zero-based evaluator attempt represented exactly. */
  maxEvaluationGeneration: Number.MAX_SAFE_INTEGER,
  /** Largest zero-based result generation; its final slot is reserved for terminal limit state. */
  maxSnapshotGeneration: Number.MAX_SAFE_INTEGER,
} as const);

/** Optional trusted profile that may only lower reactive coordinator ceilings. */
export interface RuntimeReactiveReevaluationLimitProfile {
  readonly maxSynchronousTransitions?: number;
  readonly maxEvaluationGeneration?: number;
  readonly maxSnapshotGeneration?: number;
}

/**
 * Least-authority token materialization inputs supplied to a trusted whole-surface evaluator.
 */
export interface RuntimeReactiveMaterializationContext {
  /** Stable active-document location and deterministic evaluation request identifier. */
  readonly requestContext: RuntimeRequestContext;
  /** Captured token-only host port; no other host capability is exposed to the evaluator. */
  readonly tokens: RuntimeTokenPort;
}

/** One immutable, internally consistent whole-surface evaluation request. */
export interface RuntimeReactiveEvaluationRequest {
  /** Deterministic identifier allocated before this evaluator attempt. */
  readonly evaluationId: string;
  /** Active Bundle document identifier. */
  readonly documentId: string;
  /** Exact active Bundle revision. */
  readonly revision: string;
  /** Surface whose observable output is being recomputed. */
  readonly surfaceId: string;
  /** Atomic state, context, resource, operation, unavailable-event, empty-item, and env view. */
  readonly resolutionSnapshot: RuntimeResolutionSnapshot;
  /** Token-only host authority paired with this deterministic evaluation request. */
  readonly materializationContext: RuntimeReactiveMaterializationContext;
}

/**
 * Trusted framework-neutral evaluator used to derive one JSON-serializable whole-surface result.
 *
 * @remarks The callback must be synchronous. Promise-like, executable, cyclic, platform, or
 * otherwise unsafe results are rejected before publication. This task defines the reevaluation
 * boundary, not complete validated-tree materialization.
 */
export type RuntimeReactiveEvaluator = (
  this: void,
  request: RuntimeReactiveEvaluationRequest,
) => RuntimeJsonValue;

/** Complete trusted-composition input for one reactive surface lifetime. */
export interface RuntimeReactiveReevaluationMountInput {
  readonly documentId: string;
  readonly revision: string;
  readonly surfaceId: string;
  readonly stateHandle: RuntimeSurfaceStateHandle;
  readonly stateSnapshot: RuntimeSurfaceStateSnapshot;
  readonly resourceHandle: RuntimeSurfaceResourcesHandle;
  readonly resourceSnapshot: RuntimeSurfaceResourcesSnapshot;
  readonly operationHandle: RuntimeSurfaceOperationsHandle;
  readonly operationSnapshot: RuntimeSurfaceOperationsSnapshot;
  readonly hostPorts: RuntimeReactiveHostPorts;
  readonly evaluator: RuntimeReactiveEvaluator;
  readonly limits?: RuntimeReactiveReevaluationLimitProfile;
}

/**
 * Opaque authority for one reactive reevaluation lifetime.
 *
 * @remarks A structural cast cannot manufacture the private `WeakMap` authority.
 */
export interface RuntimeReactiveReevaluationHandle {
  readonly [RUNTIME_REACTIVE_REEVALUATION_HANDLE_TYPE_BRAND]: true;
}

/** Stable reason why the current surface output is deliberately inactive. */
export type RuntimeReactiveInactiveReason =
  | "evaluation-limit"
  | "evaluator-failed"
  | "inconsistent-snapshot"
  | "invalid-authority"
  | "invalid-result"
  | "snapshot-limit"
  | "transition-limit";

/** Current bounded whole-surface evaluation outcome. */
export type RuntimeReactiveEvaluationOutcome =
  | Readonly<{
      readonly status: "active";
      readonly value: RuntimeJsonValue;
    }>
  | Readonly<{
      readonly status: "inactive";
      readonly reason: RuntimeReactiveInactiveReason;
    }>;

/**
 * Immutable observable result generation.
 *
 * @remarks Equal output bytes retain the existing object and generation even when a consistent
 * reevaluation occurred. Different output or active/inactive state advances monotonically.
 */
export interface RuntimeReactiveReevaluationSnapshot {
  readonly documentId: string;
  readonly revision: string;
  readonly surfaceId: string;
  readonly generation: number;
  readonly evaluationId: string;
  readonly outcome: RuntimeReactiveEvaluationOutcome;
}

/** Stable reason why no reactive authority was mounted. */
export type RuntimeReactiveReevaluationMountInvalidReason =
  "host-subscription-failed" | "invalid-authority" | "malformed-input";

/** Complete all-or-nothing mount outcome. */
export type RuntimeReactiveReevaluationMountResult =
  | Readonly<{
      readonly status: "mounted";
      readonly handle: RuntimeReactiveReevaluationHandle;
      readonly snapshot: RuntimeReactiveReevaluationSnapshot;
    }>
  | Readonly<{
      readonly status: "invalid";
      readonly reason: RuntimeReactiveReevaluationMountInvalidReason;
    }>;

/** Trusted cause label for one explicitly batched invalidation notice. */
export type RuntimeReactiveInvalidationReason = "action-turn" | "operation" | "resource" | "state";

/** Exact-current request used by a composition root after a complete mutation turn. */
export interface RuntimeReactiveInvalidationInput {
  readonly snapshot: RuntimeReactiveReevaluationSnapshot;
  readonly reason: RuntimeReactiveInvalidationReason;
}

/** Controlled result of one explicit invalidation request. */
export type RuntimeReactiveInvalidationResult =
  | Readonly<{
      readonly status: "reevaluated" | "unchanged";
      readonly snapshot: RuntimeReactiveReevaluationSnapshot;
    }>
  | Readonly<{
      readonly status: "queued";
      readonly snapshot: RuntimeReactiveReevaluationSnapshot;
    }>
  | Readonly<{
      readonly status: "rejected";
      readonly reason:
        "disposed" | "invalid-handle" | "invalid-request" | "invalid-snapshot" | "terminal";
    }>;

/** Controlled read result for a reactive authority. */
export type RuntimeReactiveReevaluationReadResult =
  | Readonly<{
      readonly status: "read";
      readonly snapshot: RuntimeReactiveReevaluationSnapshot;
    }>
  | Readonly<{
      readonly status: "disposed" | "invalid-handle";
    }>;

/** Terminal disposal result for a reactive authority. */
export type RuntimeReactiveReevaluationDisposeResult =
  | Readonly<{
      readonly status: "disposed";
      readonly unsubscribed: 2;
    }>
  | Readonly<{
      readonly status: "already-disposed" | "invalid-handle";
      readonly unsubscribed: 0;
    }>;

interface OwnDataRead {
  readonly valid: boolean;
  readonly present: boolean;
  readonly value?: unknown;
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
  readonly hostPorts: RuntimeReactiveHostPorts;
  readonly evaluator: RuntimeReactiveEvaluator;
  readonly limits: Required<RuntimeReactiveReevaluationLimitProfile>;
}

interface CapturedResolution {
  readonly stateSnapshot: RuntimeSurfaceStateSnapshot;
  readonly resourceSnapshot: RuntimeSurfaceResourcesSnapshot;
  readonly operationSnapshot: RuntimeSurfaceOperationsSnapshot;
  readonly contextCanonical: string;
  readonly environmentCanonical: string;
  readonly resolutionSnapshot: RuntimeResolutionSnapshot;
}

interface ReactiveAuthority {
  status: "mounting" | "live" | "faulted" | "revoked";
  readonly documentId: string;
  readonly revision: string;
  readonly surfaceId: string;
  readonly limits: Required<RuntimeReactiveReevaluationLimitProfile>;
  stateHandle: RuntimeSurfaceStateHandle | undefined;
  stateSnapshot: RuntimeSurfaceStateSnapshot | undefined;
  resourceHandle: RuntimeSurfaceResourcesHandle | undefined;
  resourceSnapshot: RuntimeSurfaceResourcesSnapshot | undefined;
  operationHandle: RuntimeSurfaceOperationsHandle | undefined;
  operationSnapshot: RuntimeSurfaceOperationsSnapshot | undefined;
  hostPorts: RuntimeReactiveHostPorts | undefined;
  evaluator: RuntimeReactiveEvaluator | undefined;
  contextUnsubscribe: (() => void) | undefined;
  environmentUnsubscribe: (() => void) | undefined;
  snapshot: RuntimeReactiveReevaluationSnapshot | undefined;
  outcomeKey: string | undefined;
  nextEvaluationGeneration: number;
  invalidationGeneration: number;
  dirty: boolean;
  draining: boolean;
}

interface ReactiveTombstone {
  readonly status: "disposed";
}

type ReactiveEntry = ReactiveAuthority | ReactiveTombstone;

const REACTIVE_AUTHORITIES = new WeakMap<object, ReactiveEntry>();

function ownDataValue(owner: object, key: PropertyKey): OwnDataRead {
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
  if (typeof value !== "object" || value === null) return false;
  try {
    if (Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function hasExactKeys(
  value: object,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean {
  try {
    const keys = Reflect.ownKeys(value);
    if (keys.some((key) => typeof key !== "string")) return false;
    const names = keys as string[];
    return (
      required.every((key) => names.includes(key)) &&
      names.every((key) => required.includes(key) || optional.includes(key)) &&
      names.length >= required.length
    );
  } catch {
    return false;
  }
}

function lowerBoundedInteger(value: unknown, ceiling: number): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= ceiling
    ? value
    : undefined;
}

function captureLimits(
  input: unknown,
): Required<RuntimeReactiveReevaluationLimitProfile> | undefined {
  const defaults = RUNTIME_REACTIVE_REEVALUATION_LIMITS;
  if (input === undefined) return Object.freeze({ ...defaults });
  if (
    !isPlainRecord(input) ||
    !hasExactKeys(
      input,
      [],
      ["maxEvaluationGeneration", "maxSnapshotGeneration", "maxSynchronousTransitions"],
    )
  ) {
    return undefined;
  }
  const result: Record<string, number> = {};
  for (const key of Object.keys(defaults) as (keyof typeof defaults)[]) {
    const property = ownDataValue(input, key);
    if (!property.valid) return undefined;
    const value = property.present
      ? lowerBoundedInteger(property.value, defaults[key])
      : defaults[key];
    if (value === undefined) return undefined;
    result[key] = value;
  }
  return Object.freeze(result) as Required<RuntimeReactiveReevaluationLimitProfile>;
}

function captureMountInput(input: unknown): CapturedMountInput | undefined {
  if (
    !isPlainRecord(input) ||
    !hasExactKeys(
      input,
      [
        "documentId",
        "evaluator",
        "hostPorts",
        "operationHandle",
        "operationSnapshot",
        "resourceHandle",
        "resourceSnapshot",
        "revision",
        "stateHandle",
        "stateSnapshot",
        "surfaceId",
      ],
      ["limits"],
    )
  ) {
    return undefined;
  }
  const values = Object.create(null) as Record<string, unknown>;
  for (const key of [
    "documentId",
    "evaluator",
    "hostPorts",
    "limits",
    "operationHandle",
    "operationSnapshot",
    "resourceHandle",
    "resourceSnapshot",
    "revision",
    "stateHandle",
    "stateSnapshot",
    "surfaceId",
  ]) {
    const property = ownDataValue(input, key);
    if (!property.valid) return undefined;
    if (property.present) values[key] = property.value;
  }
  const limits = captureLimits(values.limits);
  if (
    typeof values.documentId !== "string" ||
    values.documentId.length === 0 ||
    values.documentId.length > 2_048 ||
    typeof values.revision !== "string" ||
    !isSha256Digest(values.revision) ||
    typeof values.surfaceId !== "string" ||
    !LOCAL_IDENTIFIER_PATTERN.test(values.surfaceId) ||
    typeof values.evaluator !== "function" ||
    typeof values.stateHandle !== "object" ||
    values.stateHandle === null ||
    typeof values.stateSnapshot !== "object" ||
    values.stateSnapshot === null ||
    typeof values.resourceHandle !== "object" ||
    values.resourceHandle === null ||
    typeof values.resourceSnapshot !== "object" ||
    values.resourceSnapshot === null ||
    typeof values.operationHandle !== "object" ||
    values.operationHandle === null ||
    typeof values.operationSnapshot !== "object" ||
    values.operationSnapshot === null ||
    !isRuntimeReactiveHostPorts(values.hostPorts) ||
    limits === undefined
  ) {
    return undefined;
  }
  try {
    canonicalizeJson([values.documentId, values.revision, values.surfaceId]);
  } catch {
    return undefined;
  }
  return Object.freeze({
    documentId: values.documentId,
    revision: values.revision,
    surfaceId: values.surfaceId,
    stateHandle: values.stateHandle as RuntimeSurfaceStateHandle,
    stateSnapshot: values.stateSnapshot as RuntimeSurfaceStateSnapshot,
    resourceHandle: values.resourceHandle as RuntimeSurfaceResourcesHandle,
    resourceSnapshot: values.resourceSnapshot as RuntimeSurfaceResourcesSnapshot,
    operationHandle: values.operationHandle as RuntimeSurfaceOperationsHandle,
    operationSnapshot: values.operationSnapshot as RuntimeSurfaceOperationsSnapshot,
    hostPorts: values.hostPorts,
    evaluator: values.evaluator as RuntimeReactiveEvaluator,
    limits,
  });
}

function initialAuthoritiesAreCurrent(input: CapturedMountInput): boolean {
  const state = readRuntimeSurfaceState(input.stateHandle);
  const resources = readRuntimeSurfaceResources(input.resourceHandle);
  const operations = readRuntimeSurfaceOperations(input.operationHandle);
  return (
    state.status === "active" &&
    state.snapshot === input.stateSnapshot &&
    state.snapshot.surfaceId === input.surfaceId &&
    resources.status === "read" &&
    resources.snapshot === input.resourceSnapshot &&
    resources.snapshot.documentId === input.documentId &&
    resources.snapshot.revision === input.revision &&
    resources.snapshot.surfaceId === input.surfaceId &&
    operations.status === "read" &&
    operations.snapshot === input.operationSnapshot &&
    operations.snapshot.documentId === input.documentId &&
    operations.snapshot.revision === input.revision &&
    operations.snapshot.surfaceId === input.surfaceId
  );
}

function monotonicSnapshot(
  current: { readonly generation: number },
  candidate: { readonly generation: number },
): boolean {
  return (
    candidate.generation > current.generation ||
    (candidate.generation === current.generation && candidate === current)
  );
}

function readHostObject(
  callback: (this: void) => RuntimeJsonObject,
): Readonly<{ readonly value: RuntimeJsonObject; readonly canonical: string }> | undefined {
  let raw: unknown;
  try {
    raw = Reflect.apply(callback, undefined, []);
  } catch {
    return undefined;
  }
  const detached = snapshotRuntimeJsonValue(raw);
  if (!isRuntimeJsonObject(detached)) return undefined;
  try {
    return Object.freeze({ value: detached, canonical: canonicalizeJson(detached) });
  } catch {
    return undefined;
  }
}

function currentLowerSnapshots(authority: ReactiveAuthority):
  | Readonly<{
      readonly state: RuntimeSurfaceStateSnapshot;
      readonly resources: RuntimeSurfaceResourcesSnapshot;
      readonly operations: RuntimeSurfaceOperationsSnapshot;
    }>
  | undefined {
  const stateHandle = authority.stateHandle;
  const resourceHandle = authority.resourceHandle;
  const operationHandle = authority.operationHandle;
  const previousState = authority.stateSnapshot;
  const previousResources = authority.resourceSnapshot;
  const previousOperations = authority.operationSnapshot;
  if (
    stateHandle === undefined ||
    resourceHandle === undefined ||
    operationHandle === undefined ||
    previousState === undefined ||
    previousResources === undefined ||
    previousOperations === undefined
  ) {
    return undefined;
  }
  const state = readRuntimeSurfaceState(stateHandle);
  const resources = readRuntimeSurfaceResources(resourceHandle);
  const operations = readRuntimeSurfaceOperations(operationHandle);
  if (
    state.status !== "active" ||
    state.snapshot.surfaceId !== authority.surfaceId ||
    resources.status !== "read" ||
    resources.snapshot.documentId !== authority.documentId ||
    resources.snapshot.revision !== authority.revision ||
    resources.snapshot.surfaceId !== authority.surfaceId ||
    operations.status !== "read" ||
    operations.snapshot.documentId !== authority.documentId ||
    operations.snapshot.revision !== authority.revision ||
    operations.snapshot.surfaceId !== authority.surfaceId ||
    !monotonicSnapshot(previousState, state.snapshot) ||
    !monotonicSnapshot(previousResources, resources.snapshot) ||
    !monotonicSnapshot(previousOperations, operations.snapshot)
  ) {
    return undefined;
  }
  return Object.freeze({
    state: state.snapshot,
    resources: resources.snapshot,
    operations: operations.snapshot,
  });
}

function captureResolution(authority: ReactiveAuthority): CapturedResolution | undefined {
  const lower = currentLowerSnapshots(authority);
  const hostPorts = authority.hostPorts;
  if (lower === undefined || hostPorts === undefined) return undefined;
  const context = readHostObject(hostPorts.context.getSnapshot);
  const environment = readHostObject(hostPorts.environment.getSnapshot);
  if (context === undefined || environment === undefined) return undefined;

  let resolutionSnapshot: RuntimeResolutionSnapshot;
  try {
    resolutionSnapshot = createRuntimeResolutionSnapshot({
      state: lower.state.values,
      context: context.value,
      resource: lower.resources.lifecycles,
      operation: lower.operations.lifecycles,
      event: UNAVAILABLE_EVENT,
      item: EMPTY_OBJECT,
      env: environment.value,
    });
  } catch {
    return undefined;
  }

  const confirmedLower = currentLowerSnapshots(authority);
  const confirmedContext = readHostObject(hostPorts.context.getSnapshot);
  const confirmedEnvironment = readHostObject(hostPorts.environment.getSnapshot);
  if (
    confirmedLower === undefined ||
    confirmedLower.state !== lower.state ||
    confirmedLower.resources !== lower.resources ||
    confirmedLower.operations !== lower.operations ||
    confirmedContext?.canonical !== context.canonical ||
    confirmedEnvironment?.canonical !== environment.canonical
  ) {
    return undefined;
  }

  return Object.freeze({
    stateSnapshot: lower.state,
    resourceSnapshot: lower.resources,
    operationSnapshot: lower.operations,
    contextCanonical: context.canonical,
    environmentCanonical: environment.canonical,
    resolutionSnapshot,
  });
}

function authenticateResolution(
  authority: ReactiveAuthority,
  captured: CapturedResolution,
): boolean {
  const lower = currentLowerSnapshots(authority);
  const hostPorts = authority.hostPorts;
  if (
    lower === undefined ||
    hostPorts === undefined ||
    lower.state !== captured.stateSnapshot ||
    lower.resources !== captured.resourceSnapshot ||
    lower.operations !== captured.operationSnapshot
  ) {
    return false;
  }
  const context = readHostObject(hostPorts.context.getSnapshot);
  const environment = readHostObject(hostPorts.environment.getSnapshot);
  return (
    context?.canonical === captured.contextCanonical &&
    environment?.canonical === captured.environmentCanonical
  );
}

function resolutionRemainsCurrent(
  authority: ReactiveAuthority,
  captured: CapturedResolution,
  invalidationGeneration: number,
): boolean {
  if (
    authority.status !== "live" ||
    authority.dirty ||
    authority.invalidationGeneration !== invalidationGeneration
  ) {
    return false;
  }
  const authenticated = authenticateResolution(authority, captured);
  return (
    authenticated &&
    authority.status === "live" &&
    !authority.dirty &&
    authority.invalidationGeneration === invalidationGeneration
  );
}

function evaluationId(authority: ReactiveAuthority, generation: number): string {
  return `reactive-evaluation:${canonicalizeJson([
    authority.documentId,
    authority.revision,
    authority.surfaceId,
    generation,
  ])}`;
}

function outcomeKey(outcome: RuntimeReactiveEvaluationOutcome): string {
  return outcome.status === "active"
    ? `active:${canonicalizeJson(outcome.value)}`
    : `inactive:${outcome.reason}`;
}

function inactiveOutcome(reason: RuntimeReactiveInactiveReason): RuntimeReactiveEvaluationOutcome {
  return Object.freeze({ status: "inactive", reason });
}

function publishOutcome(
  authority: ReactiveAuthority,
  currentEvaluationId: string,
  outcome: RuntimeReactiveEvaluationOutcome,
): "published" | "unchanged" | "snapshot-limit" {
  const key = outcomeKey(outcome);
  if (authority.snapshot !== undefined && authority.outcomeKey === key) return "unchanged";

  if (authority.snapshot === undefined && authority.limits.maxSnapshotGeneration === 0) {
    const limited = inactiveOutcome("snapshot-limit");
    authority.snapshot = Object.freeze({
      documentId: authority.documentId,
      revision: authority.revision,
      surfaceId: authority.surfaceId,
      generation: 0,
      evaluationId: currentEvaluationId,
      outcome: limited,
    });
    authority.outcomeKey = outcomeKey(limited);
    authority.status = "faulted";
    authority.dirty = false;
    return "snapshot-limit";
  }

  const generation = authority.snapshot === undefined ? 0 : authority.snapshot.generation + 1;
  if (authority.snapshot !== undefined && generation >= authority.limits.maxSnapshotGeneration) {
    const limited = inactiveOutcome("snapshot-limit");
    authority.snapshot = Object.freeze({
      documentId: authority.documentId,
      revision: authority.revision,
      surfaceId: authority.surfaceId,
      generation: authority.limits.maxSnapshotGeneration,
      evaluationId: currentEvaluationId,
      outcome: limited,
    });
    authority.outcomeKey = outcomeKey(limited);
    authority.status = "faulted";
    authority.dirty = false;
    return "snapshot-limit";
  }
  authority.snapshot = Object.freeze({
    documentId: authority.documentId,
    revision: authority.revision,
    surfaceId: authority.surfaceId,
    generation,
    evaluationId: currentEvaluationId,
    outcome,
  });
  authority.outcomeKey = key;
  return "published";
}

function nextEvaluation(authority: ReactiveAuthority): number | undefined {
  const generation = authority.nextEvaluationGeneration;
  if (!Number.isSafeInteger(generation) || generation > authority.limits.maxEvaluationGeneration) {
    return undefined;
  }
  authority.nextEvaluationGeneration += 1;
  return generation;
}

function evaluateCurrent(
  authority: ReactiveAuthority,
): "published" | "stale" | "terminal" | "unchanged" {
  const generation = nextEvaluation(authority);
  if (generation === undefined) {
    const id = evaluationId(authority, authority.limits.maxEvaluationGeneration);
    publishOutcome(authority, id, inactiveOutcome("evaluation-limit"));
    authority.status = "faulted";
    authority.dirty = false;
    return "terminal";
  }
  const id = evaluationId(authority, generation);
  const capturedEpoch = authority.invalidationGeneration;
  const captured = captureResolution(authority);
  if (captured === undefined) {
    if (authority.dirty || authority.invalidationGeneration !== capturedEpoch) {
      authority.dirty = true;
      return "stale";
    }
    const invalidAuthority = currentLowerSnapshots(authority) === undefined;
    const result = publishOutcome(
      authority,
      id,
      inactiveOutcome(invalidAuthority ? "invalid-authority" : "inconsistent-snapshot"),
    );
    if (invalidAuthority) {
      authority.status = "faulted";
      authority.dirty = false;
    }
    return result === "snapshot-limit" ? "terminal" : result;
  }
  if (authority.dirty || authority.invalidationGeneration !== capturedEpoch) {
    authority.dirty = true;
    return "stale";
  }

  const evaluator = authority.evaluator;
  const hostPorts = authority.hostPorts;
  if (evaluator === undefined || hostPorts === undefined) return "terminal";
  const requestContext = Object.freeze({
    documentId: authority.documentId,
    revision: authority.revision,
    surfaceId: authority.surfaceId,
    requestId: id,
  });
  const materializationContext = Object.freeze({
    requestContext,
    tokens: hostPorts.tokens,
  });
  const request = Object.freeze({
    evaluationId: id,
    documentId: authority.documentId,
    revision: authority.revision,
    surfaceId: authority.surfaceId,
    resolutionSnapshot: captured.resolutionSnapshot,
    materializationContext,
  });

  let raw: unknown;
  let evaluatorFailed = false;
  try {
    raw = Reflect.apply(evaluator, undefined, [request]);
  } catch {
    evaluatorFailed = true;
  }

  if (!resolutionRemainsCurrent(authority, captured, capturedEpoch)) {
    if (authority.status === "live") authority.dirty = true;
    return authority.status === "live" ? "stale" : "terminal";
  }

  if (evaluatorFailed) {
    const result = publishOutcome(authority, id, inactiveOutcome("evaluator-failed"));
    authority.stateSnapshot = captured.stateSnapshot;
    authority.resourceSnapshot = captured.resourceSnapshot;
    authority.operationSnapshot = captured.operationSnapshot;
    return result === "snapshot-limit" ? "terminal" : result;
  }

  const detached = snapshotRuntimeJsonValue(raw);

  if (!resolutionRemainsCurrent(authority, captured, capturedEpoch)) {
    if (authority.status === "live") authority.dirty = true;
    return authority.status === "live" ? "stale" : "terminal";
  }

  const outcome =
    detached === undefined
      ? inactiveOutcome("invalid-result")
      : Object.freeze({ status: "active", value: detached } as const);
  const result = publishOutcome(authority, id, outcome);
  authority.stateSnapshot = captured.stateSnapshot;
  authority.resourceSnapshot = captured.resourceSnapshot;
  authority.operationSnapshot = captured.operationSnapshot;
  return result === "snapshot-limit" ? "terminal" : result;
}

function drain(authority: ReactiveAuthority): "published" | "queued" | "unchanged" {
  if (authority.status !== "live") return "unchanged";
  if (authority.draining) return "queued";
  authority.draining = true;
  let published = false;
  let transitions = 0;
  try {
    while (authority.status === "live" && authority.dirty) {
      if (transitions >= authority.limits.maxSynchronousTransitions) {
        authority.dirty = false;
        const generation = Math.max(0, authority.nextEvaluationGeneration - 1);
        const result = publishOutcome(
          authority,
          evaluationId(authority, generation),
          inactiveOutcome("transition-limit"),
        );
        published ||= result === "published" || result === "snapshot-limit";
        authority.status = "faulted";
        break;
      }
      transitions += 1;
      authority.dirty = false;
      const result = evaluateCurrent(authority);
      published ||= result === "published";
      if (result === "terminal") break;
    }
  } catch {
    if (authority.status === "live") {
      authority.dirty = false;
      const generation = Math.max(0, authority.nextEvaluationGeneration - 1);
      const result = publishOutcome(
        authority,
        evaluationId(authority, generation),
        inactiveOutcome("inconsistent-snapshot"),
      );
      published ||= result === "published" || result === "snapshot-limit";
    }
  } finally {
    authority.draining = false;
  }
  return published ? "published" : "unchanged";
}

function markDirty(authority: ReactiveAuthority): void {
  if (authority.status !== "live" && authority.status !== "mounting") return;
  if (authority.invalidationGeneration >= Number.MAX_SAFE_INTEGER) {
    if (authority.status === "live") {
      authority.dirty = false;
      publishOutcome(
        authority,
        evaluationId(authority, Math.max(0, authority.nextEvaluationGeneration - 1)),
        inactiveOutcome("transition-limit"),
      );
      authority.status = "faulted";
    }
    return;
  }
  authority.invalidationGeneration += 1;
  authority.dirty = true;
  if (authority.status === "live" && !authority.draining) drain(authority);
}

function subscribe(
  authority: ReactiveAuthority,
  callback: (this: void, onChange: () => void) => () => void,
): (() => void) | undefined {
  let unsubscribe: unknown;
  try {
    unsubscribe = Reflect.apply(callback, undefined, [() => markDirty(authority)]);
  } catch {
    return undefined;
  }
  return typeof unsubscribe === "function" ? (unsubscribe as () => void) : undefined;
}

function callUnsubscribe(callback: (() => void) | undefined): void {
  if (callback === undefined) return;
  try {
    Reflect.apply(callback, undefined, []);
  } catch {
    // Host cleanup failures cannot restore or retain runtime authority.
  }
}

interface RevokedSubscriptions {
  readonly context: (() => void) | undefined;
  readonly environment: (() => void) | undefined;
}

function revokeAuthority(authority: ReactiveAuthority): RevokedSubscriptions {
  authority.status = "revoked";
  authority.dirty = false;
  const subscriptions = Object.freeze({
    context: authority.contextUnsubscribe,
    environment: authority.environmentUnsubscribe,
  });
  authority.contextUnsubscribe = undefined;
  authority.environmentUnsubscribe = undefined;
  authority.evaluator = undefined;
  authority.hostPorts = undefined;
  authority.stateHandle = undefined;
  authority.stateSnapshot = undefined;
  authority.resourceHandle = undefined;
  authority.resourceSnapshot = undefined;
  authority.operationHandle = undefined;
  authority.operationSnapshot = undefined;
  authority.snapshot = undefined;
  authority.outcomeKey = undefined;
  return subscriptions;
}

function invalidMount(
  reason: RuntimeReactiveReevaluationMountInvalidReason,
): RuntimeReactiveReevaluationMountResult {
  return Object.freeze({ status: "invalid", reason });
}

/**
 * Mounts one bounded whole-surface reactive coordinator over exact current state, resource, and
 * operation authorities.
 *
 * @remarks Context and environment subscriptions are captured once and treated only as
 * invalidation notices. Each evaluation rereads complete detached host snapshots, samples all
 * runtime managers atomically, uses an unavailable event and empty repeat item scope, and checks
 * every authority before and after reflecting the evaluator result. Reentrant notices coalesce
 * into one dirty bit and are drained synchronously without a timer or platform scheduler.
 *
 * The coordinator intentionally performs whole-surface reevaluation. DESEN 0.1.0 permits that
 * implementation when its observable behavior and finite limits match a dependency-indexed
 * implementation. A trusted composition root must have mounted the lower resource and operation
 * managers with the same {@link RuntimeReactiveHostPorts} and must submit one explicit
 * invalidation after their state, settlement, or complete action turn changes; the public lower
 * manager APIs do not expose enough authority to authenticate that join here.
 *
 * Complete validated-tree traversal, event and item provenance, selector-to-action-program
 * joining, conditional descendant cleanup, and coordinated session disposal remain M04-T16.
 * Dependency-index versus whole-surface oracle traces and performance remain M04-T16/M12.
 * Component instance reconciliation, remount-required properties, React, DOM, focus, and
 * accessibility behavior remain M05. Token-provider changes have no subscription in 0.1.0 and
 * therefore are not an independent invalidation source in this coordinator.
 */
export function mountRuntimeReactiveReevaluation(
  input: RuntimeReactiveReevaluationMountInput,
): RuntimeReactiveReevaluationMountResult {
  const captured = captureMountInput(input);
  if (captured === undefined) return invalidMount("malformed-input");
  if (!initialAuthoritiesAreCurrent(captured)) return invalidMount("invalid-authority");

  const authority: ReactiveAuthority = {
    status: "mounting",
    documentId: captured.documentId,
    revision: captured.revision,
    surfaceId: captured.surfaceId,
    limits: captured.limits,
    stateHandle: captured.stateHandle,
    stateSnapshot: captured.stateSnapshot,
    resourceHandle: captured.resourceHandle,
    resourceSnapshot: captured.resourceSnapshot,
    operationHandle: captured.operationHandle,
    operationSnapshot: captured.operationSnapshot,
    hostPorts: captured.hostPorts,
    evaluator: captured.evaluator,
    contextUnsubscribe: undefined,
    environmentUnsubscribe: undefined,
    snapshot: undefined,
    outcomeKey: undefined,
    nextEvaluationGeneration: 0,
    invalidationGeneration: 0,
    dirty: true,
    draining: false,
  };
  const handle = Object.freeze({}) as RuntimeReactiveReevaluationHandle;
  REACTIVE_AUTHORITIES.set(handle, authority);

  authority.contextUnsubscribe = subscribe(authority, captured.hostPorts.context.subscribe);
  if (authority.contextUnsubscribe === undefined) {
    revokeAuthority(authority);
    REACTIVE_AUTHORITIES.delete(handle);
    return invalidMount("host-subscription-failed");
  }
  authority.environmentUnsubscribe = subscribe(authority, captured.hostPorts.environment.subscribe);
  if (authority.environmentUnsubscribe === undefined) {
    const subscriptions = revokeAuthority(authority);
    REACTIVE_AUTHORITIES.delete(handle);
    callUnsubscribe(subscriptions.context);
    return invalidMount("host-subscription-failed");
  }

  authority.status = "live";
  drain(authority);
  if (authority.snapshot === undefined) {
    authority.snapshot = Object.freeze({
      documentId: authority.documentId,
      revision: authority.revision,
      surfaceId: authority.surfaceId,
      generation: 0,
      evaluationId: evaluationId(authority, 0),
      outcome: inactiveOutcome("transition-limit"),
    });
    authority.outcomeKey = outcomeKey(authority.snapshot.outcome);
    authority.status = "faulted";
  }
  return Object.freeze({ status: "mounted", handle, snapshot: authority.snapshot });
}

/**
 * Requests one whole-surface reevaluation after a trusted composition root completes a mutation
 * turn.
 *
 * @remarks The exact current snapshot is required, preventing stale or structurally forged
 * callers from driving the coordinator. Reentrant requests are coalesced and report `queued`.
 */
export function invalidateRuntimeReactiveReevaluation(
  handle: RuntimeReactiveReevaluationHandle,
  input: RuntimeReactiveInvalidationInput,
): RuntimeReactiveInvalidationResult {
  if (typeof handle !== "object" || handle === null) {
    return Object.freeze({ status: "rejected", reason: "invalid-handle" });
  }
  const entry = REACTIVE_AUTHORITIES.get(handle);
  if (entry === undefined) {
    return Object.freeze({ status: "rejected", reason: "invalid-handle" });
  }
  if (entry.status === "disposed") {
    return Object.freeze({ status: "rejected", reason: "disposed" });
  }
  if (entry.status === "revoked") {
    return Object.freeze({ status: "rejected", reason: "disposed" });
  }
  const admissionSnapshot = entry.snapshot;
  if (!isPlainRecord(input) || !hasExactKeys(input, ["reason", "snapshot"])) {
    return Object.freeze({ status: "rejected", reason: "invalid-request" });
  }
  const requestedSnapshot = ownDataValue(input, "snapshot");
  const reason = ownDataValue(input, "reason");
  if (
    !requestedSnapshot.valid ||
    !requestedSnapshot.present ||
    !reason.valid ||
    !reason.present ||
    typeof reason.value !== "string" ||
    !["action-turn", "operation", "resource", "state"].includes(reason.value)
  ) {
    return Object.freeze({ status: "rejected", reason: "invalid-request" });
  }
  const currentEntry = REACTIVE_AUTHORITIES.get(handle);
  if (currentEntry !== entry) {
    return Object.freeze({ status: "rejected", reason: "disposed" });
  }
  if (entry.status === "faulted") {
    return Object.freeze({ status: "rejected", reason: "terminal" });
  }
  if (
    admissionSnapshot === undefined ||
    entry.snapshot !== admissionSnapshot ||
    requestedSnapshot.value !== admissionSnapshot
  ) {
    return Object.freeze({ status: "rejected", reason: "invalid-snapshot" });
  }

  const before = admissionSnapshot;
  const wasDraining = entry.draining;
  markDirty(entry);
  if (REACTIVE_AUTHORITIES.get(handle) !== entry || entry.snapshot === undefined) {
    return Object.freeze({ status: "rejected", reason: "disposed" });
  }
  const after = entry.snapshot;
  if (wasDraining) return Object.freeze({ status: "queued", snapshot: after });
  return Object.freeze({
    status: after === before ? "unchanged" : "reevaluated",
    snapshot: after,
  });
}

/** Reads the exact current observable result without triggering evaluation or host effects. */
export function readRuntimeReactiveReevaluation(
  handle: RuntimeReactiveReevaluationHandle,
): RuntimeReactiveReevaluationReadResult {
  if (typeof handle !== "object" || handle === null) {
    return Object.freeze({ status: "invalid-handle" });
  }
  const entry = REACTIVE_AUTHORITIES.get(handle);
  if (entry === undefined) return Object.freeze({ status: "invalid-handle" });
  if (entry.status === "disposed" || entry.status === "revoked") {
    return Object.freeze({ status: "disposed" });
  }
  return Object.freeze({
    status: "read",
    snapshot: entry.snapshot as RuntimeReactiveReevaluationSnapshot,
  });
}

/**
 * Terminally revokes one reactive coordinator before unsubscribing both host notice callbacks.
 *
 * @remarks Late or reentrant callbacks are inert. The coordinator does not dispose the state,
 * resource, operation, action-turn, or adapter authorities that a later complete session owns.
 */
export function disposeRuntimeReactiveReevaluation(
  handle: RuntimeReactiveReevaluationHandle,
): RuntimeReactiveReevaluationDisposeResult {
  if (typeof handle !== "object" || handle === null) {
    return Object.freeze({ status: "invalid-handle", unsubscribed: 0 });
  }
  const entry = REACTIVE_AUTHORITIES.get(handle);
  if (entry === undefined) {
    return Object.freeze({ status: "invalid-handle", unsubscribed: 0 });
  }
  if (entry.status === "disposed" || entry.status === "revoked") {
    return Object.freeze({ status: "already-disposed", unsubscribed: 0 });
  }

  const subscriptions = revokeAuthority(entry);
  REACTIVE_AUTHORITIES.set(handle, Object.freeze({ status: "disposed" }));

  callUnsubscribe(subscriptions.context);
  callUnsubscribe(subscriptions.environment);
  return Object.freeze({ status: "disposed", unsubscribed: 2 });
}
