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
  materializeRuntimeActionValue,
} from "./action-evaluation.js";
import { createRuntimeHostPorts } from "./host-ports.js";
import {
  disposeRuntimeSurfaceState,
  readRuntimeSurfaceState,
  writeRuntimeSurfaceState,
} from "./local-state.js";
import { isRuntimeJsonObject, snapshotRuntimeJsonValue } from "./runtime-json-snapshot.js";
import { resolveRuntimeValue, RUNTIME_VALUE_SAFETY_LIMITS } from "./value-resolution.js";

import type { DesenDiagnostic, JsonPointer } from "@desen/protocol";
import type {
  RuntimeHostPorts,
  RuntimeJsonObject,
  RuntimeJsonValue,
  RuntimeNavigationResult,
} from "./host-ports.js";
import type {
  RuntimeSurfaceStateHandle,
  RuntimeSurfaceStateIssue,
  RuntimeSurfaceStateSnapshot,
  RuntimeSurfaceStateWriteRejectedReason,
} from "./local-state.js";
import type { RuntimePredicateSpec, RuntimePredicateTypeMismatch } from "./predicate-evaluation.js";
import type { RuntimeValueMaterialization } from "./token-format-resolution.js";
import type { RuntimeResolutionSnapshot, RuntimeValueSpec } from "./value-resolution.js";
import type { RuntimeActionEvaluationSession } from "./action-evaluation.js";

const LOCAL_IDENTIFIER_PATTERN = /^[A-Za-z][A-Za-z0-9._:-]{0,127}$/u;
const ROOT_POINTER = createJsonPointer();
const SURFACE_POINTER = createJsonPointer(["surface"]);
const EMPTY_DIAGNOSTICS = Object.freeze([]) as readonly DesenDiagnostic<string>[];
const EXECUTOR_AUTHORITIES = new WeakMap<
  object,
  StateNavigationActionAuthority | StateNavigationActionTombstone
>();
declare const RUNTIME_STATE_NAVIGATION_ACTIONS_HANDLE_TYPE_BRAND: unique symbol;

/** Finite deterministic identity ceiling for one mounted action executor. */
export const RUNTIME_STATE_NAVIGATION_ACTION_LIMITS = Object.freeze({
  /** Largest zero-based accepted action generation represented exactly. */
  maxActionGeneration: Number.MAX_SAFE_INTEGER,
} as const);

/** Exact `state.set` action owned by this primitive. */
export interface RuntimeStateSetAction {
  readonly type: "state.set";
  readonly path: string;
  readonly value: RuntimeValueSpec;
  readonly when?: RuntimePredicateSpec;
  readonly extensions?: RuntimeJsonObject;
}

/** Exact `state.toggle` action owned by this primitive. */
export interface RuntimeStateToggleAction {
  readonly type: "state.toggle";
  readonly path: string;
  readonly when?: RuntimePredicateSpec;
  readonly extensions?: RuntimeJsonObject;
}

/** Exact local `navigate` action owned by this primitive. */
export interface RuntimeNavigateAction {
  readonly type: "navigate";
  readonly surface: string;
  readonly params?: Readonly<Record<string, RuntimeValueSpec>>;
  readonly when?: RuntimePredicateSpec;
  readonly extensions?: RuntimeJsonObject;
}

/** One action executed by the M04-T10 primitive. */
export type RuntimeStateNavigationAction =
  RuntimeNavigateAction | RuntimeStateSetAction | RuntimeStateToggleAction;

/** Complete trusted inputs used to mount one surface-local action executor. */
export interface RuntimeStateNavigationActionsMountInput {
  /** Active Source or Bundle document identifier. */
  readonly documentId: string;
  /** Exact active Bundle revision. */
  readonly revision: string;
  /** Currently active DESEN-managed surface. */
  readonly surfaceId: string;
  /** Complete same-Bundle surface identifier inventory. */
  readonly surfaceIds: readonly string[];
  /** Exact mounted state authority owned by this surface lifetime. */
  readonly stateHandle: RuntimeSurfaceStateHandle;
  /** Exact current immutable snapshot issued by the state authority. */
  readonly stateSnapshot: RuntimeSurfaceStateSnapshot;
  /** Captured framework-neutral host boundary. */
  readonly hostPorts: RuntimeHostPorts;
}

/**
 * Opaque authority for one state-and-navigation action lifetime.
 *
 * @remarks A structural cast cannot manufacture the private `WeakMap` authority.
 */
export interface RuntimeStateNavigationActionsHandle {
  readonly [RUNTIME_STATE_NAVIGATION_ACTIONS_HANDLE_TYPE_BRAND]: true;
}

/** Why an action executor could not be mounted atomically. */
export type RuntimeStateNavigationActionsMountInvalidReason =
  "malformed-input" | "invalid-state-authority" | "invalid-surface-inventory";

/** Complete mount result for one state-and-navigation executor. */
export type RuntimeStateNavigationActionsMountResult =
  | Readonly<{
      readonly status: "mounted";
      readonly handle: RuntimeStateNavigationActionsHandle;
      readonly stateSnapshot: RuntimeSurfaceStateSnapshot;
    }>
  | Readonly<{
      readonly status: "invalid";
      readonly reason: RuntimeStateNavigationActionsMountInvalidReason;
      readonly diagnostics: readonly DesenDiagnostic<string>[];
    }>;

/** A valid false guard that caused no payload read and no action effect. */
export interface RuntimeActionSkipped {
  readonly status: "skipped";
  readonly diagnostics: readonly DesenDiagnostic<string>[];
}

/** Guard preparation or materialization failed closed before the action payload was inspected. */
export interface RuntimeActionGuardRejected {
  readonly status: "guard-rejected";
  readonly reason: "adapter-failed" | "invalid";
  readonly diagnostics: readonly DesenDiagnostic<string>[];
}

/** A guarded action payload could not be materialized into inert JSON. */
export interface RuntimeActionPayloadRejected {
  readonly status: "payload-rejected";
  readonly reason: "adapter-failed" | "invalid" | "unresolved";
  readonly diagnostics: readonly DesenDiagnostic<string>[];
}

/** One complete-schema state write was accepted. */
export interface RuntimeStateActionApplied {
  readonly status: "state-updated" | "state-unchanged";
  readonly action: "state.set" | "state.toggle";
  readonly requestId: string;
  readonly stateSnapshot: RuntimeSurfaceStateSnapshot;
  readonly diagnostics: readonly DesenDiagnostic<string>[];
}

/** One state action was rejected without a partial write. */
export interface RuntimeStateActionRejected {
  readonly status: "state-rejected";
  readonly action: "state.set" | "state.toggle";
  readonly reason: RuntimeSurfaceStateWriteRejectedReason | "toggle-target-not-boolean";
  readonly path: string | null;
  readonly issues: readonly RuntimeSurfaceStateIssue[];
  readonly diagnostics: readonly DesenDiagnostic<string>[];
}

/** Host navigation succeeded and terminally ended the old surface state and executor. */
export interface RuntimeNavigationSucceeded {
  readonly status: "navigated";
  readonly requestId: string;
  readonly surface: string;
  readonly diagnostics: readonly DesenDiagnostic<string>[];
}

/** Host policy denied an otherwise valid local navigation request. */
export interface RuntimeNavigationDenied {
  readonly status: "navigation-denied";
  readonly requestId: string;
  readonly surface: string;
  readonly diagnostics: readonly DesenDiagnostic<string>[];
}

/** A navigation adapter failed, rejected, returned a Promise, or returned a malformed envelope. */
export interface RuntimeNavigationAdapterFailed {
  readonly status: "adapter-failed";
  readonly requestId: string;
  readonly diagnostics: readonly DesenDiagnostic<string>[];
}

/** Complete result of executing exactly one T10 action. */
export type RuntimeStateNavigationActionResult =
  | RuntimeActionGuardRejected
  | RuntimeActionPayloadRejected
  | RuntimeActionSkipped
  | RuntimeNavigationAdapterFailed
  | RuntimeNavigationDenied
  | RuntimeNavigationSucceeded
  | RuntimeStateActionApplied
  | RuntimeStateActionRejected
  | Readonly<{
      readonly status: "invalid-action";
      readonly diagnostics: readonly DesenDiagnostic<string>[];
    }>
  | Readonly<{
      readonly status: "unknown-surface";
      readonly surface: string;
      readonly diagnostics: readonly DesenDiagnostic<string>[];
    }>
  | Readonly<{
      readonly status: "invalid-snapshot";
      readonly stateSnapshot?: RuntimeSurfaceStateSnapshot;
    }>
  | Readonly<{ readonly status: "state-disposed" }>
  | Readonly<{ readonly status: "action-limit" }>
  | Readonly<{ readonly status: "busy" }>
  | Readonly<{ readonly status: "disposed" }>
  | Readonly<{ readonly status: "invalid-handle" }>;

/** Idempotent terminal result of explicitly ending one executor and its state lifetime. */
export type RuntimeStateNavigationActionsDisposeResult =
  | Readonly<{ readonly status: "disposed" }>
  | Readonly<{ readonly status: "already-disposed" }>
  | Readonly<{ readonly status: "invalid-handle" }>;

interface StateNavigationActionAuthority {
  status: "live" | "revoked";
  readonly documentId: string;
  readonly revision: string;
  readonly surfaceId: string;
  readonly surfaceIds: ReadonlySet<string>;
  readonly stateHandle: RuntimeSurfaceStateHandle;
  readonly hostPorts: RuntimeHostPorts;
  stateSnapshot: RuntimeSurfaceStateSnapshot;
  nextActionGeneration: number;
  transitioning: boolean;
  reporting: boolean;
}

interface StateNavigationActionTombstone {
  readonly status: "disposed" | "navigated";
}

interface MountEnvelope {
  readonly documentId: string;
  readonly revision: string;
  readonly surfaceId: string;
  readonly surfaceIds: readonly string[];
  readonly stateHandle: RuntimeSurfaceStateHandle;
  readonly stateSnapshot: RuntimeSurfaceStateSnapshot;
  readonly hostPorts: RuntimeHostPorts;
}

type MaterializedPayload =
  | Readonly<{ readonly status: "resolved"; readonly value: RuntimeJsonValue }>
  | RuntimeActionPayloadRejected;

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
    return "value" in descriptor
      ? Object.freeze({ valid: true, present: true, value: descriptor.value })
      : Object.freeze({ valid: false, present: true });
  } catch {
    return Object.freeze({ valid: false, present: false });
  }
}

function exactAllowedKeys(
  object: object,
  required: readonly string[],
  optional: readonly string[],
): boolean {
  try {
    const keys = Reflect.ownKeys(object);
    if (keys.some((key) => typeof key !== "string")) return false;
    const names = keys as string[];
    const allowed = new Set([...required, ...optional]);
    return (
      required.every((key) => names.includes(key)) &&
      names.length >= required.length &&
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

function readMountEnvelope(input: unknown): MountEnvelope | undefined {
  if (
    !isPlainRecord(input) ||
    !exactAllowedKeys(
      input,
      [
        "documentId",
        "hostPorts",
        "revision",
        "stateHandle",
        "stateSnapshot",
        "surfaceId",
        "surfaceIds",
      ],
      [],
    )
  ) {
    return undefined;
  }
  const documentId = ownDataValue(input, "documentId");
  const revision = ownDataValue(input, "revision");
  const surfaceId = ownDataValue(input, "surfaceId");
  const surfaceIds = ownDataValue(input, "surfaceIds");
  const stateHandle = ownDataValue(input, "stateHandle");
  const stateSnapshot = ownDataValue(input, "stateSnapshot");
  const hostPorts = ownDataValue(input, "hostPorts");
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
    !surfaceIds.valid ||
    !surfaceIds.present ||
    !stateHandle.valid ||
    !stateHandle.present ||
    !stateSnapshot.valid ||
    !stateSnapshot.present ||
    !hostPorts.valid ||
    !hostPorts.present
  ) {
    return undefined;
  }
  const copiedIds = snapshotRuntimeJsonValue(surfaceIds.value);
  if (!Array.isArray(copiedIds)) return undefined;
  return Object.freeze({
    documentId: documentId.value,
    revision: revision.value,
    surfaceId: surfaceId.value,
    surfaceIds: copiedIds as readonly string[],
    stateHandle: stateHandle.value as RuntimeSurfaceStateHandle,
    stateSnapshot: stateSnapshot.value as RuntimeSurfaceStateSnapshot,
    hostPorts: hostPorts.value as RuntimeHostPorts,
  });
}

function actionDiagnostic(
  code: string,
  message: string,
  authority: Pick<StateNavigationActionAuthority, "documentId" | "surfaceId">,
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
    | "ENTRY_NOT_FOUND"
    | "PREDICATE_TYPE_MISMATCH"
    | "REFERENCE_UNRESOLVED"
    | "STATE_WRITE_INVALID",
  message: string,
  authority: Pick<StateNavigationActionAuthority, "documentId" | "surfaceId">,
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
  authority: StateNavigationActionAuthority,
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
        // Observation cannot alter an action result.
      }
    }
  } finally {
    authority.reporting = false;
  }
}

function predicateDiagnostics(
  authority: StateNavigationActionAuthority,
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

function nextRequestId(authority: StateNavigationActionAuthority): string | undefined {
  const generation = authority.nextActionGeneration;
  if (
    !Number.isSafeInteger(generation) ||
    generation > RUNTIME_STATE_NAVIGATION_ACTION_LIMITS.maxActionGeneration
  ) {
    return undefined;
  }
  return `action:${canonicalizeJson([authority.surfaceId, generation])}`;
}

function acceptRequest(authority: StateNavigationActionAuthority): void {
  authority.nextActionGeneration += 1;
}

function materializationFailure(
  authority: StateNavigationActionAuthority,
  result: Exclude<RuntimeValueMaterialization, { readonly status: "resolved" }>,
  pointer: JsonPointer = result.pointer,
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
          pointer,
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
          pointer,
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
        pointer,
      ),
    ]),
  });
}

function materializePayload(
  authority: StateNavigationActionAuthority,
  spec: RuntimeValueSpec,
  snapshot: RuntimeResolutionSnapshot,
  session: RuntimeActionEvaluationSession,
): MaterializedPayload {
  const result = materializeRuntimeActionValue(session, spec, snapshot);
  return result.status === "resolved"
    ? Object.freeze({ status: "resolved", value: result.value })
    : materializationFailure(authority, result);
}

function guardRejected(
  authority: StateNavigationActionAuthority,
  reason: "adapter-failed" | "invalid",
  diagnostic: DesenDiagnostic<string>,
): RuntimeActionGuardRejected {
  const diagnostics = Object.freeze([Object.freeze(diagnostic)]);
  safeReport(authority, diagnostics);
  return Object.freeze({ status: "guard-rejected", reason, diagnostics });
}

function currentStateSnapshot(
  authority: StateNavigationActionAuthority,
):
  | Readonly<{ readonly status: "current"; readonly snapshot: RuntimeSurfaceStateSnapshot }>
  | Readonly<{ readonly status: "disposed" }>
  | Readonly<{ readonly status: "invalid" }> {
  const read = readRuntimeSurfaceState(authority.stateHandle);
  if (read.status === "active") {
    return Object.freeze({ status: "current", snapshot: read.snapshot });
  }
  return read.status === "disposed"
    ? Object.freeze({ status: "disposed" })
    : Object.freeze({ status: "invalid" });
}

function snapshotMatches(
  snapshot: RuntimeResolutionSnapshot,
  stateSnapshot: RuntimeSurfaceStateSnapshot,
): boolean {
  try {
    const probe = resolveRuntimeValue(null, snapshot);
    return (
      probe.status === "resolved" &&
      canonicalizeJson(snapshot.state) === canonicalizeJson(stateSnapshot.values)
    );
  } catch {
    return false;
  }
}

function ensureExactState(
  authority: StateNavigationActionAuthority,
  expected: RuntimeSurfaceStateSnapshot,
):
  | Readonly<{ readonly status: "current" }>
  | Readonly<{ readonly status: "disposed" }>
  | Readonly<{
      readonly status: "changed";
      readonly snapshot?: RuntimeSurfaceStateSnapshot;
    }> {
  const current = currentStateSnapshot(authority);
  if (current.status === "disposed") return Object.freeze({ status: "disposed" });
  if (current.status === "invalid") return Object.freeze({ status: "changed" });
  return current.snapshot === expected
    ? Object.freeze({ status: "current" })
    : Object.freeze({ status: "changed", snapshot: current.snapshot });
}

function stateChangedResult(
  result: Exclude<ReturnType<typeof ensureExactState>, { readonly status: "current" }>,
): Extract<
  RuntimeStateNavigationActionResult,
  { readonly status: "invalid-snapshot" | "state-disposed" }
> {
  return result.status === "disposed"
    ? Object.freeze({ status: "state-disposed" })
    : Object.freeze({
        status: "invalid-snapshot",
        ...(result.snapshot === undefined ? {} : { stateSnapshot: result.snapshot }),
      });
}

function observationFailure(
  authority: StateNavigationActionAuthority,
  expected: RuntimeSurfaceStateSnapshot,
): RuntimeStateNavigationActionResult | undefined {
  if (authority.status !== "live") return Object.freeze({ status: "disposed" });
  const exact = ensureExactState(authority, expected);
  return exact.status === "current" ? undefined : stateChangedResult(exact);
}

function validateExtension(action: object): boolean {
  const extension = ownDataValue(action, "extensions");
  if (!extension.valid) return false;
  if (!extension.present) return true;
  const copied = snapshotRuntimeJsonValue(extension.value);
  return isRuntimeJsonObject(copied);
}

function pathValue(snapshot: RuntimeSurfaceStateSnapshot, path: string): unknown {
  const segments = path.split(".");
  let current: unknown = snapshot.values;
  for (const segment of segments) {
    if (!isRuntimeJsonObject(current)) return undefined;
    const value = ownDataValue(current, segment);
    if (!value.valid || !value.present) return undefined;
    current = value.value;
  }
  return current;
}

function stateRejected(
  authority: StateNavigationActionAuthority,
  action: "state.set" | "state.toggle",
  reason: RuntimeSurfaceStateWriteRejectedReason | "toggle-target-not-boolean",
  path: string | null,
  issues: readonly RuntimeSurfaceStateIssue[] = Object.freeze([]),
): RuntimeStateActionRejected {
  const diagnostics = Object.freeze([
    coreDiagnostic(
      "STATE_WRITE_INVALID",
      action === "state.toggle" && reason === "toggle-target-not-boolean"
        ? "A state.toggle target must resolve to an exact boolean."
        : "The complete state entry rejected the requested action write.",
      authority,
      ROOT_POINTER,
    ),
  ]);
  safeReport(authority, diagnostics);
  return Object.freeze({
    status: "state-rejected",
    action,
    reason,
    path,
    issues: Object.freeze([...issues]),
    diagnostics,
  });
}

function applyStateWrite(
  authority: StateNavigationActionAuthority,
  action: "state.set" | "state.toggle",
  path: string,
  value: RuntimeJsonValue,
  requestId: string,
  guardDiagnostics: readonly DesenDiagnostic<string>[],
  expectedState: RuntimeSurfaceStateSnapshot,
): RuntimeStateNavigationActionResult {
  const beforeWrite = observationFailure(authority, expectedState);
  if (beforeWrite !== undefined) return beforeWrite;
  const write = writeRuntimeSurfaceState(authority.stateHandle, { path, value });
  if (write.status === "rejected") {
    const rejected = stateRejected(authority, action, write.reason, write.path, write.issues);
    return observationFailure(authority, expectedState) ?? rejected;
  }
  if (write.status === "disposed") return Object.freeze({ status: "state-disposed" });
  if (write.status === "invalid") {
    return Object.freeze({ status: "invalid-snapshot" });
  }
  acceptRequest(authority);
  authority.stateSnapshot = write.snapshot;
  return Object.freeze({
    status: write.status === "updated" ? "state-updated" : "state-unchanged",
    action,
    requestId,
    stateSnapshot: write.snapshot,
    diagnostics: Object.freeze([...guardDiagnostics]),
  });
}

function closedNavigationResult(input: unknown): RuntimeNavigationResult | undefined {
  const captured = snapshotRuntimeJsonValue(input);
  if (!isRuntimeJsonObject(captured) || !exactAllowedKeys(captured, ["status"], [])) {
    return undefined;
  }
  const status = ownDataValue(captured, "status");
  if (
    !status.valid ||
    !status.present ||
    (status.value !== "succeeded" && status.value !== "denied")
  ) {
    return undefined;
  }
  return Object.freeze({ status: status.value });
}

/**
 * Mounts one executor over an exact current state lifetime and complete local-surface inventory.
 *
 * @remarks No action, token, diagnostic, navigation, or state-write callback runs during mount.
 */
export function mountRuntimeStateNavigationActions(
  input: RuntimeStateNavigationActionsMountInput,
): RuntimeStateNavigationActionsMountResult {
  const envelope = readMountEnvelope(input);
  if (envelope === undefined) {
    return Object.freeze({
      status: "invalid",
      reason: "malformed-input",
      diagnostics: EMPTY_DIAGNOSTICS,
    });
  }
  if (
    envelope.surfaceIds.some(
      (surfaceId) => typeof surfaceId !== "string" || !LOCAL_IDENTIFIER_PATTERN.test(surfaceId),
    ) ||
    new Set(envelope.surfaceIds).size !== envelope.surfaceIds.length ||
    !envelope.surfaceIds.includes(envelope.surfaceId)
  ) {
    return Object.freeze({
      status: "invalid",
      reason: "invalid-surface-inventory",
      diagnostics: EMPTY_DIAGNOSTICS,
    });
  }
  const state = readRuntimeSurfaceState(envelope.stateHandle);
  if (
    state.status !== "active" ||
    state.snapshot !== envelope.stateSnapshot ||
    state.snapshot.surfaceId !== envelope.surfaceId ||
    envelope.stateHandle.surfaceId !== envelope.surfaceId
  ) {
    return Object.freeze({
      status: "invalid",
      reason: "invalid-state-authority",
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
  const recapturedState = readRuntimeSurfaceState(envelope.stateHandle);
  if (
    recapturedState.status !== "active" ||
    recapturedState.snapshot !== envelope.stateSnapshot ||
    recapturedState.snapshot.surfaceId !== envelope.surfaceId ||
    envelope.stateHandle.surfaceId !== envelope.surfaceId
  ) {
    return Object.freeze({
      status: "invalid",
      reason: "invalid-state-authority",
      diagnostics: EMPTY_DIAGNOSTICS,
    });
  }
  const authority: StateNavigationActionAuthority = {
    status: "live",
    documentId: envelope.documentId,
    revision: envelope.revision,
    surfaceId: envelope.surfaceId,
    surfaceIds: new Set(envelope.surfaceIds),
    stateHandle: envelope.stateHandle,
    stateSnapshot: envelope.stateSnapshot,
    hostPorts,
    nextActionGeneration: 0,
    transitioning: false,
    reporting: false,
  };
  const handle = Object.freeze({}) as RuntimeStateNavigationActionsHandle;
  EXECUTOR_AUTHORITIES.set(handle, authority);
  return Object.freeze({ status: "mounted", handle, stateSnapshot: authority.stateSnapshot });
}

/**
 * Executes exactly one guarded `state.set`, `state.toggle`, or local `navigate` action.
 *
 * @remarks Guard preparation and evaluation precede every read of the action discriminator or
 * payload. A valid false guard returns without inspecting path, value, target, params, extensions,
 * or invoking payload token, diagnostic, navigation, and state-write callbacks. Action arrays,
 * turns, settlement handlers, and depth limits remain M04-T11/M04-T13 responsibilities.
 */
export function executeRuntimeStateNavigationAction(
  handle: RuntimeStateNavigationActionsHandle,
  action: RuntimeStateNavigationAction,
  snapshot: RuntimeResolutionSnapshot,
  stateSnapshot: RuntimeSurfaceStateSnapshot,
): RuntimeStateNavigationActionResult {
  if (typeof handle !== "object" || handle === null) {
    return Object.freeze({ status: "invalid-handle" });
  }
  const authority = EXECUTOR_AUTHORITIES.get(handle);
  if (authority === undefined) return Object.freeze({ status: "invalid-handle" });
  if (authority.status !== "live") return Object.freeze({ status: "disposed" });
  if (authority.transitioning || authority.reporting) return Object.freeze({ status: "busy" });

  const current = currentStateSnapshot(authority);
  if (current.status === "disposed") return Object.freeze({ status: "state-disposed" });
  if (
    current.status !== "current" ||
    current.snapshot !== stateSnapshot ||
    !snapshotMatches(snapshot, stateSnapshot)
  ) {
    return Object.freeze({
      status: "invalid-snapshot",
      ...(current.status === "current" ? { stateSnapshot: current.snapshot } : {}),
    });
  }
  authority.stateSnapshot = current.snapshot;

  const requestId = nextRequestId(authority);
  if (requestId === undefined) return Object.freeze({ status: "action-limit" });

  authority.transitioning = true;
  try {
    let session: RuntimeActionEvaluationSession;
    try {
      session = createRuntimeActionEvaluationSession({
        requestContext: {
          documentId: authority.documentId,
          revision: authority.revision,
          surfaceId: authority.surfaceId,
          requestId,
        },
        tokens: authority.hostPorts.tokens,
        isActive: () => authority.status === "live",
      });
    } catch {
      const rejected = guardRejected(
        authority,
        "invalid",
        actionDiagnostic(
          "run.desen.runtime/ACTION_GUARD_INVALID",
          "The action evaluation boundary could not be created safely.",
          authority,
          ROOT_POINTER,
        ),
      );
      return observationFailure(authority, stateSnapshot) ?? rejected;
    }

    const capturedWhen = captureRuntimeActionWhen(action);
    const afterWhenCapture = observationFailure(authority, stateSnapshot);
    if (afterWhenCapture !== undefined) return afterWhenCapture;
    if (capturedWhen.status === "invalid") {
      const rejected = guardRejected(
        authority,
        "invalid",
        actionDiagnostic(
          "run.desen.runtime/ACTION_GUARD_INVALID",
          "The action guard property is malformed.",
          authority,
          capturedWhen.pointer,
        ),
      );
      return observationFailure(authority, stateSnapshot) ?? rejected;
    }

    const evaluatedGuard = evaluateRuntimeActionGuard(session, capturedWhen.when, snapshot);
    const afterGuardEvaluation = observationFailure(authority, stateSnapshot);
    if (afterGuardEvaluation !== undefined) return afterGuardEvaluation;
    if (evaluatedGuard.status !== "evaluated") {
      const rejected = guardRejected(
        authority,
        evaluatedGuard.status === "adapter-failed" ? "adapter-failed" : "invalid",
        evaluatedGuard.status === "adapter-failed"
          ? coreDiagnostic(
              "ADAPTER_FAILURE",
              "The action guard token provider failed unexpectedly.",
              authority,
              evaluatedGuard.pointer,
            )
          : actionDiagnostic(
              "run.desen.runtime/ACTION_GUARD_INVALID",
              "The action guard is malformed or could not be evaluated safely.",
              authority,
              evaluatedGuard.pointer,
            ),
      );
      return observationFailure(authority, stateSnapshot) ?? rejected;
    }
    const guard = Object.freeze({
      value: evaluatedGuard.value,
      diagnostics: predicateDiagnostics(authority, evaluatedGuard.diagnostics),
    });
    if (!guard.value) {
      return Object.freeze({
        status: "skipped",
        diagnostics: Object.freeze([...guard.diagnostics]),
      });
    }
    if (guard.diagnostics.length > 0) {
      safeReport(authority, guard.diagnostics);
      const afterGuardReport = observationFailure(authority, stateSnapshot);
      if (afterGuardReport !== undefined) return afterGuardReport;
    }

    const plainAction = isPlainRecord(action);
    const afterActionPrototype = observationFailure(authority, stateSnapshot);
    if (afterActionPrototype !== undefined) return afterActionPrototype;
    if (!plainAction) {
      return Object.freeze({
        status: "invalid-action",
        diagnostics: Object.freeze([
          actionDiagnostic(
            "run.desen.runtime/ACTION_INPUT_INVALID",
            "The guarded action must be a closed data object.",
            authority,
            ROOT_POINTER,
          ),
        ]),
      });
    }
    const type = ownDataValue(action, "type");
    const afterTypeCapture = observationFailure(authority, stateSnapshot);
    if (afterTypeCapture !== undefined) return afterTypeCapture;
    if (!type.valid || !type.present || typeof type.value !== "string") {
      return Object.freeze({
        status: "invalid-action",
        diagnostics: Object.freeze([
          actionDiagnostic(
            "run.desen.runtime/ACTION_INPUT_INVALID",
            "The guarded action type is missing or invalid.",
            authority,
            ROOT_POINTER,
          ),
        ]),
      });
    }

    if (type.value === "state.set") {
      const validShape =
        exactAllowedKeys(action, ["path", "type", "value"], ["extensions", "when"]) &&
        validateExtension(action);
      const afterShape = observationFailure(authority, stateSnapshot);
      if (afterShape !== undefined) return afterShape;
      if (!validShape) {
        return Object.freeze({ status: "invalid-action", diagnostics: EMPTY_DIAGNOSTICS });
      }
      const path = ownDataValue(action, "path");
      const value = ownDataValue(action, "value");
      const afterPayloadCapture = observationFailure(authority, stateSnapshot);
      if (afterPayloadCapture !== undefined) return afterPayloadCapture;
      if (
        !path.valid ||
        !path.present ||
        typeof path.value !== "string" ||
        !LOCAL_IDENTIFIER_PATTERN.test(path.value) ||
        !value.valid ||
        !value.present
      ) {
        return Object.freeze({ status: "invalid-action", diagnostics: EMPTY_DIAGNOSTICS });
      }
      const materialized = materializePayload(
        authority,
        value.value as RuntimeValueSpec,
        snapshot,
        session,
      );
      const afterMaterialization = observationFailure(authority, stateSnapshot);
      if (afterMaterialization !== undefined) return afterMaterialization;
      if (materialized.status !== "resolved") {
        safeReport(authority, materialized.diagnostics);
        return observationFailure(authority, stateSnapshot) ?? materialized;
      }
      return applyStateWrite(
        authority,
        "state.set",
        path.value,
        materialized.value,
        requestId,
        guard.diagnostics,
        stateSnapshot,
      );
    }

    if (type.value === "state.toggle") {
      const validShape =
        exactAllowedKeys(action, ["path", "type"], ["extensions", "when"]) &&
        validateExtension(action);
      const afterShape = observationFailure(authority, stateSnapshot);
      if (afterShape !== undefined) return afterShape;
      if (!validShape) {
        return Object.freeze({ status: "invalid-action", diagnostics: EMPTY_DIAGNOSTICS });
      }
      const path = ownDataValue(action, "path");
      const afterPathCapture = observationFailure(authority, stateSnapshot);
      if (afterPathCapture !== undefined) return afterPathCapture;
      if (
        !path.valid ||
        !path.present ||
        typeof path.value !== "string" ||
        !LOCAL_IDENTIFIER_PATTERN.test(path.value)
      ) {
        return Object.freeze({ status: "invalid-action", diagnostics: EMPTY_DIAGNOSTICS });
      }
      const currentValue = pathValue(stateSnapshot, path.value);
      if (typeof currentValue !== "boolean") {
        const rejected = stateRejected(
          authority,
          "state.toggle",
          "toggle-target-not-boolean",
          path.value,
        );
        return observationFailure(authority, stateSnapshot) ?? rejected;
      }
      return applyStateWrite(
        authority,
        "state.toggle",
        path.value,
        !currentValue,
        requestId,
        guard.diagnostics,
        stateSnapshot,
      );
    }

    if (type.value === "navigate") {
      const surface = ownDataValue(action, "surface");
      const afterSurfaceCapture = observationFailure(authority, stateSnapshot);
      if (afterSurfaceCapture !== undefined) return afterSurfaceCapture;
      if (
        !surface.valid ||
        !surface.present ||
        typeof surface.value !== "string" ||
        !LOCAL_IDENTIFIER_PATTERN.test(surface.value) ||
        !authority.surfaceIds.has(surface.value)
      ) {
        const safeSurface =
          surface.valid &&
          surface.present &&
          typeof surface.value === "string" &&
          LOCAL_IDENTIFIER_PATTERN.test(surface.value)
            ? surface.value
            : "";
        const diagnostics = Object.freeze([
          coreDiagnostic(
            "ENTRY_NOT_FOUND",
            "Navigation may target only an existing surface in the active Bundle.",
            authority,
            SURFACE_POINTER,
          ),
        ]);
        safeReport(authority, diagnostics);
        const rejected = Object.freeze({
          status: "unknown-surface",
          surface: safeSurface,
          diagnostics,
        } as const);
        return observationFailure(authority, stateSnapshot) ?? rejected;
      }
      const validShape =
        exactAllowedKeys(action, ["surface", "type"], ["extensions", "params", "when"]) &&
        validateExtension(action);
      const afterShape = observationFailure(authority, stateSnapshot);
      if (afterShape !== undefined) return afterShape;
      if (!validShape) {
        return Object.freeze({ status: "invalid-action", diagnostics: EMPTY_DIAGNOSTICS });
      }
      const params = ownDataValue(action, "params");
      const afterParamsCapture = observationFailure(authority, stateSnapshot);
      if (afterParamsCapture !== undefined) return afterParamsCapture;
      if (!params.valid) {
        return Object.freeze({ status: "invalid-action", diagnostics: EMPTY_DIAGNOSTICS });
      }
      const materialized = materializeRuntimeActionNamedValues(
        session,
        params.present ? params.value : Object.freeze({}),
        snapshot,
      );
      const afterParamMaterialization = observationFailure(authority, stateSnapshot);
      if (afterParamMaterialization !== undefined) return afterParamMaterialization;
      if (materialized.status !== "resolved") {
        const rejected = materializationFailure(authority, materialized);
        safeReport(authority, rejected.diagnostics);
        return observationFailure(authority, stateSnapshot) ?? rejected;
      }
      if (!isRuntimeJsonObject(materialized.value)) {
        return Object.freeze({ status: "invalid-action", diagnostics: EMPTY_DIAGNOSTICS });
      }
      const detachedParams = materialized.value;
      const beforeNavigation = observationFailure(authority, stateSnapshot);
      if (beforeNavigation !== undefined) return beforeNavigation;

      acceptRequest(authority);
      let rawResult: unknown;
      try {
        rawResult = Reflect.apply(authority.hostPorts.navigation.navigate, undefined, [
          Object.freeze({
            context: Object.freeze({
              documentId: authority.documentId,
              revision: authority.revision,
              surfaceId: authority.surfaceId,
              requestId,
            }),
            targetSurfaceId: surface.value,
            params: detachedParams,
          }),
        ]);
      } catch {
        rawResult = undefined;
      }
      const afterNavigationCallback = observationFailure(authority, stateSnapshot);
      if (afterNavigationCallback !== undefined) return afterNavigationCallback;
      const result = closedNavigationResult(rawResult);
      const afterResultCapture = observationFailure(authority, stateSnapshot);
      if (afterResultCapture !== undefined) return afterResultCapture;
      if (result === undefined) {
        const diagnostics = Object.freeze([
          coreDiagnostic(
            "ADAPTER_FAILURE",
            "The navigation adapter failed or returned a malformed synchronous result.",
            authority,
          ),
        ]);
        safeReport(authority, diagnostics);
        const failed = Object.freeze({ status: "adapter-failed", requestId, diagnostics } as const);
        return observationFailure(authority, stateSnapshot) ?? failed;
      }
      if (result.status === "denied") {
        const diagnostics = Object.freeze([
          actionDiagnostic(
            "run.desen.runtime/NAVIGATION_DENIED",
            "Current host policy denied local navigation.",
            authority,
          ),
        ]);
        safeReport(authority, diagnostics);
        const denied = Object.freeze({
          status: "navigation-denied",
          requestId,
          surface: surface.value,
          diagnostics,
        } as const);
        return observationFailure(authority, stateSnapshot) ?? denied;
      }

      authority.status = "revoked";
      disposeRuntimeSurfaceState(authority.stateHandle);
      EXECUTOR_AUTHORITIES.set(handle, Object.freeze({ status: "navigated" }));
      return Object.freeze({
        status: "navigated",
        requestId,
        surface: surface.value,
        diagnostics: Object.freeze([...guard.diagnostics]),
      });
    }

    return Object.freeze({
      status: "invalid-action",
      diagnostics: Object.freeze([
        actionDiagnostic(
          "run.desen.runtime/ACTION_INPUT_INVALID",
          "This primitive accepts only state.set, state.toggle, and navigate.",
          authority,
          ROOT_POINTER,
        ),
      ]),
    });
  } finally {
    authority.transitioning = false;
  }
}

/**
 * Explicitly ends one executor and its owned surface-state lifetime.
 *
 * @remarks Successful navigation performs the same terminal revocation automatically.
 */
export function disposeRuntimeStateNavigationActions(
  handle: RuntimeStateNavigationActionsHandle,
): RuntimeStateNavigationActionsDisposeResult {
  if (typeof handle !== "object" || handle === null) {
    return Object.freeze({ status: "invalid-handle" });
  }
  const authority = EXECUTOR_AUTHORITIES.get(handle);
  if (authority === undefined) return Object.freeze({ status: "invalid-handle" });
  if (authority.status !== "live") return Object.freeze({ status: "already-disposed" });
  authority.status = "revoked";
  disposeRuntimeSurfaceState(authority.stateHandle);
  EXECUTOR_AUTHORITIES.set(handle, Object.freeze({ status: "disposed" }));
  return Object.freeze({ status: "disposed" });
}
