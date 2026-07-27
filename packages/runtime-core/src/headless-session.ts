/* eslint-disable @typescript-eslint/no-invalid-void-type -- Every host and adapter callback at
 * this framework-neutral composition boundary is deliberately receiver-independent. */
import { calculateDesenBundleRevision, canonicalizeJson, isSha256Digest } from "@desen/protocol";
import {
  validateDesenBundleExecutionContracts,
  validateDesenExecutionCatalogSet,
} from "@desen/validator";

import {
  bindRuntimeAdapterBridges,
  createRuntimeAdapterBridgePorts,
  disposeRuntimeAdapterBridges,
  readRuntimeAdapterBridges,
  receiveRuntimeAdapterEvent,
  registerRuntimeAdapterBinding,
  unregisterRuntimeAdapterBinding,
} from "./adapter-bridges.js";
import {
  disposeRuntimeActionTurns,
  executeRuntimeActionTurn,
  mountRuntimeActionTurns,
  prepareRuntimeActionProgram,
  subscribeRuntimeActionTurnSettlements,
} from "./action-turns.js";
import { createRuntimeCommandEventHostPorts } from "./command-event-ports.js";
import {
  disposeRuntimeCommandEventActions,
  mountRuntimeCommandEventActions,
} from "./command-event-actions.js";
import { createRuntimeHostPorts } from "./host-ports.js";
import {
  materializeRuntimeHeadlessSurface,
  readRuntimeHeadlessMaterializationSidecar,
} from "./headless-materialization.js";
import {
  disposeRuntimeSurfaceState,
  mountRuntimeSurfaceState,
  readRuntimeSurfaceState,
} from "./local-state.js";
import {
  disposeRuntimeSurfaceOperations,
  mountRuntimeSurfaceOperations,
  readRuntimeSurfaceOperations,
} from "./operation-lifecycle.js";
import {
  disposeRuntimeOperationResourceActions,
  mountRuntimeOperationResourceActions,
} from "./operation-resource-actions.js";
import { createRuntimeReactiveHostPorts } from "./reactive-host-ports.js";
import {
  disposeRuntimeReactiveReevaluation,
  invalidateRuntimeReactiveReevaluation,
  mountRuntimeReactiveReevaluation,
  readRuntimeReactiveReevaluation,
} from "./reactive-reevaluation.js";
import {
  disposeRuntimeSurfaceResources,
  mountRuntimeSurfaceResources,
  readRuntimeSurfaceResources,
  startRuntimeSurfaceResources,
} from "./resource-lifecycle.js";
import { snapshotRuntimeJsonValue } from "./runtime-json-snapshot.js";
import {
  disposeRuntimeStateNavigationActions,
  mountRuntimeStateNavigationActions,
} from "./state-navigation-actions.js";
import { createRuntimeResolutionSnapshot } from "./value-resolution.js";

import type { DesenBundle, DesenDiagnostic } from "@desen/protocol";
import type { DesenValidatedExecutionCatalogSet, ImmutableJson } from "@desen/validator";
import type {
  RuntimeAdapterBindingSnapshot,
  RuntimeAdapterBindingTicket,
  RuntimeAdapterBridgesHandle,
  RuntimeAdapterBridgesSnapshot,
  RuntimeAdapterEventTurnRequest,
} from "./adapter-bridges.js";
import type {
  RuntimeActionTurnCompletion,
  RuntimeActionTurnExecutionResult,
  RuntimeActionTurnProgram,
  RuntimeActionTurnsHandle,
} from "./action-turns.js";
import type {
  RuntimeHostPorts,
  RuntimeJsonObject,
  RuntimeJsonValue,
  RuntimeNavigationRequest,
  RuntimeNavigationResult,
} from "./host-ports.js";
import type {
  RuntimeHeadlessBindingIntent,
  RuntimeHeadlessMaterializationCommitment,
  RuntimeHeadlessMaterializationLimitProfile,
  RuntimeHeadlessMaterializationSidecar,
  RuntimeHeadlessSurfacePlan,
} from "./headless-materialization.js";
import type { RuntimeSurfaceStateHandle } from "./local-state.js";
import type { RuntimeSurfaceOperationsHandle } from "./operation-lifecycle.js";
import type { RuntimeReactiveHostPorts } from "./reactive-host-ports.js";
import type {
  RuntimeReactiveReevaluationHandle,
  RuntimeReactiveReevaluationSnapshot,
} from "./reactive-reevaluation.js";
import type {
  RuntimeResourceSettlement,
  RuntimeSurfaceResourcesHandle,
} from "./resource-lifecycle.js";
import type { RuntimeResolutionSnapshotInput } from "./value-resolution.js";

const LOCAL_IDENTIFIER_PATTERN = /^[A-Za-z][A-Za-z0-9._:-]{0,127}$/u;
const EMPTY_OBJECT = Object.freeze({}) as RuntimeJsonObject;
const EMPTY_DIAGNOSTICS = Object.freeze([]) as readonly DesenDiagnostic<string>[];
const SESSION_AUTHORITIES = new WeakMap<
  object,
  HeadlessSessionAuthority | HeadlessSessionTombstone
>();
const SESSION_SNAPSHOTS = new WeakMap<object, object>();
const SESSION_SUBSCRIPTIONS = new WeakMap<object, SessionSubscriptionAuthority>();
declare const RUNTIME_HEADLESS_SESSION_HANDLE_TYPE_BRAND: unique symbol;
declare const RUNTIME_HEADLESS_SESSION_SUBSCRIPTION_TYPE_BRAND: unique symbol;

/**
 * Finite framework-neutral ceilings for one complete headless Bundle session.
 *
 * @remarks A trusted profile may only lower these values. The limits cover the complete active
 * tree, transition count, binding-candidate and handled-event sets, observable snapshot
 * generations, and retained JSON plan size; lower managers continue to enforce their own narrower
 * limits independently.
 */
export const RUNTIME_HEADLESS_SESSION_LIMITS = Object.freeze({
  /** Largest active component-node count after conditional and repeat expansion. */
  maxNodes: 5_000,
  /** Largest active component-tree depth, with the root at depth zero. */
  maxDepth: 128,
  /** Largest active component-plus-behavior adapter candidate set. */
  maxBindingCandidates: 5_000,
  /** Largest total handled-event declarations retained by live adapter bindings. */
  maxEventHandlerBindings: 5_000,
  /** Largest number of live external-store listeners retained by one session. */
  maxSubscriptions: 256,
  /** Largest number of successful managed-surface handoffs in one session. */
  maxSurfaceTransitions: 64,
  /** Largest zero-based public session generation represented exactly. */
  maxSnapshotGeneration: Number.MAX_SAFE_INTEGER,
  /** Largest number of JSON occurrences retained by one observable plan. */
  maxPlanJsonOccurrences: 262_144,
  /** Largest canonical UTF-16 plan length retained by one observable plan. */
  maxPlanCodeUnits: 4_194_304,
} as const);

/** Optional trusted profile that may only lower complete-session ceilings. */
export interface RuntimeHeadlessSessionLimitProfile {
  /** Lower active component-node ceiling. */
  readonly maxNodes?: number;
  /** Lower active component-tree depth ceiling. */
  readonly maxDepth?: number;
  /** Lower active adapter-candidate ceiling. */
  readonly maxBindingCandidates?: number;
  /** Lower total handled-event binding ceiling. */
  readonly maxEventHandlerBindings?: number;
  /** Lower live external-store listener ceiling. */
  readonly maxSubscriptions?: number;
  /** Lower successful managed-surface transition ceiling. */
  readonly maxSurfaceTransitions?: number;
  /** Lower inclusive public snapshot-generation ceiling. */
  readonly maxSnapshotGeneration?: number;
  /** Lower retained-plan JSON-occurrence ceiling. */
  readonly maxPlanJsonOccurrences?: number;
  /** Lower retained-plan canonical UTF-16 ceiling. */
  readonly maxPlanCodeUnits?: number;
}

/**
 * Unknown protocol ingress and trusted host boundary used to mount a complete headless session.
 */
export interface RuntimeHeadlessSessionMountInput {
  /** Unknown Bundle candidate validated cumulatively through the execution-contract boundary. */
  readonly bundle: unknown;
  /** Unknown Catalog array prepared and authenticated by the execution Catalog validator. */
  readonly catalogs: unknown;
  /** One host aggregate captured once and shared by every lower manager and reactive coordinator. */
  readonly hostPorts: RuntimeHostPorts;
  /** Optional complete-session ceilings that may only lower the reference profile. */
  readonly limits?: RuntimeHeadlessSessionLimitProfile;
}

/**
 * Opaque authority for one active headless Bundle session.
 *
 * @remarks A structural cast cannot manufacture the private runtime authority. All observable
 * state is obtained through {@link readRuntimeHeadlessSession}.
 */
export interface RuntimeHeadlessSessionHandle {
  /** Compile-time-only marker paired with private `WeakMap` authority. */
  readonly [RUNTIME_HEADLESS_SESSION_HANDLE_TYPE_BRAND]: true;
}

/** Pure-JSON public summary of one currently live component or behavior adapter binding. */
export type RuntimeHeadlessBindingSnapshot = RuntimeAdapterBindingSnapshot;

/**
 * Exact immutable, callback-free observation of one active surface generation.
 *
 * @remarks Every member is JSON-serializable and survives a JSON stringify/parse round trip.
 * Authenticity is nevertheless reference-based: mutating, cloning, or reconstructing this value
 * cannot authorize an event dispatch.
 */
export interface RuntimeHeadlessSessionSnapshot {
  /** Active Bundle document identifier. */
  readonly documentId: string;
  /** Verified exact Bundle revision. */
  readonly revision: string;
  /** Currently active managed surface. */
  readonly surfaceId: string;
  /** Monotonic session-wide publication generation. */
  readonly generation: number;
  /** Exact T15 evaluation identifier that authorized this publication. */
  readonly evaluationId: string;
  /** Digest of the complete observable headless plan. */
  readonly planDigest: string;
  /** Digest of the private adapter-binding intent set. */
  readonly bindingDigest: string;
  /** Complete materialized framework-neutral surface plan. */
  readonly plan: RuntimeHeadlessSurfacePlan;
  /** Current surface-local state namespace. */
  readonly state: RuntimeJsonObject;
  /** Current resolver-compatible resource lifecycle namespace. */
  readonly resource: RuntimeJsonObject;
  /** Current resolver-compatible operation lifecycle namespace. */
  readonly operation: RuntimeJsonObject;
  /** Current callback-free adapter binding summaries in deterministic order. */
  readonly bindings: readonly RuntimeHeadlessBindingSnapshot[];
}

/** Stable reason why a complete session could not be mounted. */
export type RuntimeHeadlessSessionMountInvalidReason =
  | "bundle-invalid"
  | "catalog-invalid"
  | "composition-failed"
  | "entry-invalid"
  | "malformed-input"
  | "materialization-failed"
  | "revision-mismatch";

/** Complete all-or-nothing result of mounting the Bundle entry surface. */
export type RuntimeHeadlessSessionMountResult =
  | Readonly<{
      /** Confirms a live entry-surface session. */
      readonly status: "mounted";
      /** Opaque session authority. */
      readonly handle: RuntimeHeadlessSessionHandle;
      /** Generation-zero pure-JSON observation. */
      readonly snapshot: RuntimeHeadlessSessionSnapshot;
      /**
       * Exact validated execution Catalog set retained by this session.
       *
       * @remarks Raw Catalog ingress is validated once during mount. Framework adapters must pass
       * this exact factory-authenticated reference to their receiving boundary; revalidating the
       * same JSON produces a distinct authority. This member is intentionally outside the
       * JSON-only session snapshot.
       */
      readonly catalogSet: DesenValidatedExecutionCatalogSet;
    }>
  | Readonly<{
      /** Confirms that no session authority or partial surface became observable. */
      readonly status: "invalid";
      /** Stable failure classification. */
      readonly reason: RuntimeHeadlessSessionMountInvalidReason;
      /** Deterministic validator diagnostics when ingress validation supplied them. */
      readonly diagnostics: readonly DesenDiagnostic<string>[];
    }>;

/** Controlled exact-snapshot read result for one session authority. */
export type RuntimeHeadlessSessionReadResult =
  | Readonly<{
      /** The session remains active. */
      readonly status: "read";
      /** Exact current pure-JSON observation. */
      readonly snapshot: RuntimeHeadlessSessionSnapshot;
    }>
  | Readonly<{
      /** The session has terminally ended. */
      readonly status: "disposed";
    }>
  | Readonly<{
      /** The supplied handle was not created by the session factory. */
      readonly status: "invalid-handle";
    }>;

/**
 * Exact caller-owned inputs for one framework-adapter authority preflight.
 *
 * @remarks Both members must be the same objects retained by the live session. Structural,
 * canonical, or byte equality never substitutes for exact factory-authenticated identity.
 */
export interface RuntimeHeadlessSessionAdapterAuthorityInput {
  /** Exact current snapshot returned by mount, read, or a prior authenticated result. */
  readonly snapshot: RuntimeHeadlessSessionSnapshot;
  /** Exact validated Catalog set supplied when this session was mounted. */
  readonly catalogSet: DesenValidatedExecutionCatalogSet;
}

/**
 * Closed result of authenticating a framework adapter against one live session generation.
 *
 * @remarks An authenticated result returns only the session's current public snapshot; it does
 * not expose the retained Catalog set, host ports, callbacks, private materialization sidecar, or
 * any lower runtime authority. `invalid-snapshot` returns the current public snapshot solely so a
 * holder of the session handle can retry after a stale observation. All variants are frozen,
 * callback-free own-data records.
 */
export type RuntimeHeadlessSessionAdapterAuthorityResult =
  | Readonly<{
      /** Both exact references belong to the current live session generation. */
      readonly status: "authenticated";
      /** The only snapshot this adapter preflight authorizes for synchronous consumption. */
      readonly snapshot: RuntimeHeadlessSessionSnapshot;
    }>
  | Readonly<{
      /** The supplied snapshot was stale, reconstructed, or owned by another session. */
      readonly status: "invalid-snapshot";
      /** Exact current public observation, supplied only for a bounded retry. */
      readonly snapshot: RuntimeHeadlessSessionSnapshot;
    }>
  | Readonly<{
      /** The supplied validated Catalog set is not the exact set retained by this session. */
      readonly status: "invalid-catalog-set";
    }>
  | Readonly<{
      /** The session has terminally ended. */
      readonly status: "disposed";
    }>
  | Readonly<{
      /** The supplied handle was not created by the session factory. */
      readonly status: "invalid-handle";
    }>
  | Readonly<{
      /** The request was not the exact enumerable own-data envelope. */
      readonly status: "malformed-request";
    }>;

/** Receiver-independent invalidation notice used by framework snapshot-store adapters. */
export type RuntimeHeadlessSessionListener = (this: void) => void;

/**
 * Opaque revocation authority for one headless-session listener.
 *
 * @remarks A structural cast cannot manufacture a subscription accepted by
 * {@link unsubscribeRuntimeHeadlessSession}. The listener itself is never included in a public
 * session snapshot.
 */
export interface RuntimeHeadlessSessionSubscription {
  /** Compile-time-only marker paired with private `WeakMap` authority. */
  readonly [RUNTIME_HEADLESS_SESSION_SUBSCRIPTION_TYPE_BRAND]: true;
}

/** Controlled result of attaching one asynchronous session invalidation listener. */
export type RuntimeHeadlessSessionSubscribeResult =
  | Readonly<{
      /** The listener is registered and receives only future snapshot changes. */
      readonly status: "subscribed";
      /** Factory-authenticated authority used for explicit, idempotent revocation. */
      readonly subscription: RuntimeHeadlessSessionSubscription;
    }>
  | Readonly<{
      /** Stable closed classification; no listener was retained. */
      readonly status: "disposed" | "invalid-handle" | "invalid-listener" | "subscription-limit";
    }>;

/** Controlled idempotent result of revoking one factory-created session subscription. */
export type RuntimeHeadlessSessionUnsubscribeResult = Readonly<{
  /** Whether this call revoked the listener or found an inert/foreign authority. */
  readonly status: "unsubscribed" | "already-unsubscribed" | "invalid-subscription";
}>;

/** Caller-owned immediate component or behavior event request. */
export interface RuntimeHeadlessSessionEventInput {
  /** Exact current session snapshot object returned by mount, read, or a prior event completion. */
  readonly snapshot: RuntimeHeadlessSessionSnapshot;
  /** Exact runtime instance identifier exposed by the current materialized plan/binding summary. */
  readonly runtimeInstanceId: string;
  /** Declared component or behavior event name. */
  readonly eventName: string;
  /** Unknown event payload validated by the exact Catalog contract before action admission. */
  readonly payload: unknown;
}

/** Pure-JSON completion of one admitted event turn and any synchronous publication it caused. */
export interface RuntimeHeadlessSessionEventCompletion {
  /** Final action-turn classification after the event leaves the bounded FIFO. */
  readonly status: "completed" | "disposed" | "navigated" | "terminated";
  /** Deterministic action-turn identifier. */
  readonly turnId: string;
  /** Current session observation after reevaluation or exact navigation handoff. */
  readonly snapshot: RuntimeHeadlessSessionSnapshot | null;
}

/** Complete synchronous admission result for an incoming adapter event. */
export type RuntimeHeadlessSessionEventResult =
  | Readonly<{
      /** T14 authenticated the live ticket and T13 admitted the selected prepared program. */
      readonly status: "dispatched";
      /** Deterministic T14 event identifier. */
      readonly eventId: string;
      /** Never-rejecting completion of the admitted event turn. */
      readonly completion: Promise<RuntimeHeadlessSessionEventCompletion>;
    }>
  | Readonly<{
      /** The caller supplied an older or reconstructed session snapshot. */
      readonly status: "invalid-snapshot";
      /** Exact current observation retained by the session. */
      readonly snapshot: RuntimeHeadlessSessionSnapshot;
    }>
  | Readonly<{
      /** No current materialized binding has this runtime instance. */
      readonly status: "unknown-binding";
    }>
  | Readonly<{
      /** The bridge or exact prepared handler rejected the request without an action turn. */
      readonly status: "rejected";
      /** Stable closed classification that does not expose lower authority. */
      readonly reason:
        | "event-limit"
        | "invalid-event"
        | "payload-invalid"
        | "stale-binding"
        | "turn-rejected"
        | "unhandled-event";
    }>
  | Readonly<{
      /** The session has terminally ended. */
      readonly status: "disposed";
    }>
  | Readonly<{
      /** The supplied handle was not created by the session factory. */
      readonly status: "invalid-handle";
    }>
  | Readonly<{
      /** The request was not an exact bounded own-data envelope. */
      readonly status: "malformed-request";
    }>;

/** Terminal idempotent result of ending a complete session lifetime. */
export type RuntimeHeadlessSessionDisposeResult =
  | Readonly<{
      /** The reactive coordinator, adapter bridge, and action coordinator were revoked in order. */
      readonly status: "disposed";
      /** Number of managed surfaces successfully activated during this lifetime. */
      readonly activatedSurfaces: number;
    }>
  | Readonly<{
      /** The authority had already ended or was never factory-created. */
      readonly status: "already-disposed" | "invalid-handle";
      /** No additional surface was affected. */
      readonly activatedSurfaces: 0;
    }>;

type BundleSnapshot = ImmutableJson<DesenBundle>;
type BundleSurface = BundleSnapshot["surfaces"][string];
type Limits = Required<RuntimeHeadlessSessionLimitProfile>;

interface SurfaceDefinition {
  readonly surfaceId: string;
  readonly surface: BundleSurface;
  readonly staticComponents: Readonly<Record<string, string>>;
  readonly operationAliases: Readonly<Record<string, Readonly<{ readonly operation: string }>>>;
  readonly programs: ReadonlyMap<string, RuntimeActionTurnProgram>;
}

interface CandidateMaterialization {
  readonly evaluationId: string;
  readonly commitment: RuntimeHeadlessMaterializationCommitment;
  readonly plan: RuntimeHeadlessSurfacePlan;
  readonly sidecar: RuntimeHeadlessMaterializationSidecar;
}

interface ActiveBinding {
  readonly intent: RuntimeHeadlessBindingIntent;
  readonly ticket: RuntimeAdapterBindingTicket;
  readonly snapshot: RuntimeAdapterBindingSnapshot;
}

interface SurfaceLifetime {
  readonly definition: SurfaceDefinition;
  readonly stateHandle: RuntimeSurfaceStateHandle;
  readonly resourceHandle: RuntimeSurfaceResourcesHandle;
  readonly operationHandle: RuntimeSurfaceOperationsHandle;
  readonly turnsHandle: RuntimeActionTurnsHandle;
  readonly unsubscribeSettlements: () => void;
  readonly bridgeHandle: RuntimeAdapterBridgesHandle;
  bridgeSnapshot: RuntimeAdapterBridgesSnapshot;
  readonly reactiveHandle: RuntimeReactiveReevaluationHandle;
  reactiveSnapshot: RuntimeReactiveReevaluationSnapshot;
  readonly candidates: Map<string, CandidateMaterialization>;
  bindings: Map<string, ActiveBinding>;
}

interface PendingDispatch {
  admission:
    | Extract<RuntimeActionTurnExecutionResult, { readonly status: "queued" | "started" }>
    | undefined;
  completion: Promise<RuntimeHeadlessSessionEventCompletion> | undefined;
}

interface HeadlessSessionRetainedGraph {
  readonly bundle: BundleSnapshot;
  readonly catalogSet: DesenValidatedExecutionCatalogSet;
  readonly hostPorts: RuntimeReactiveHostPorts;
  readonly definitions: ReadonlyMap<string, SurfaceDefinition>;
}

interface HeadlessSessionAuthority {
  status: "mounting" | "live" | "revoked";
  retainedGraph: HeadlessSessionRetainedGraph | undefined;
  readonly hostOwner: { current: HeadlessSessionAuthority | undefined };
  readonly snapshotOwner: object;
  readonly limits: Limits;
  readonly handle: RuntimeHeadlessSessionHandle;
  current: SurfaceLifetime | undefined;
  snapshot: RuntimeHeadlessSessionSnapshot | undefined;
  nextSnapshotGeneration: number;
  transitionCount: number;
  activatedSurfaces: number;
  pendingNavigation: string | undefined;
  activeDispatch: PendingDispatch | undefined;
  transitioning: boolean;
  readonly cleanupPending: SurfaceLifetime[];
  cleanupScheduled: boolean;
  readonly observedSettlements: WeakSet<object>;
  readonly subscriptions: Set<SessionSubscriptionAuthority>;
  notificationScheduled: boolean;
}

interface HeadlessSessionTombstone {
  readonly status: "disposed";
  readonly activatedSurfaces: number;
}

interface SessionSubscriptionAuthority {
  status: "live" | "revoked";
  readonly owner: HeadlessSessionAuthority;
  readonly subscription: RuntimeHeadlessSessionSubscription;
  readonly listener: RuntimeHeadlessSessionListener;
  observedSnapshot: RuntimeHeadlessSessionSnapshot | undefined;
}

interface CapturedMountInput {
  readonly bundle: unknown;
  readonly catalogs: unknown;
  readonly hostPorts: RuntimeHostPorts;
  readonly limits: Limits;
}

interface CapturedEventInput {
  readonly snapshot: RuntimeHeadlessSessionSnapshot;
  readonly runtimeInstanceId: string;
  readonly eventName: string;
  readonly payload: unknown;
}

interface CapturedAdapterAuthorityInput {
  readonly snapshot: unknown;
  readonly catalogSet: unknown;
}

interface OwnDataRead {
  readonly valid: boolean;
  readonly present: boolean;
  readonly value?: unknown;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function revokeSessionSubscription(subscription: SessionSubscriptionAuthority): void {
  if (subscription.status === "revoked") return;
  subscription.status = "revoked";
  subscription.owner.subscriptions.delete(subscription);
}

function scheduleSessionNotification(authority: HeadlessSessionAuthority): void {
  if (authority.notificationScheduled || authority.subscriptions.size === 0) return;
  authority.notificationScheduled = true;
  void Promise.resolve().then(() => {
    authority.notificationScheduled = false;
    const terminalAtStart = authority.status === "revoked";
    const publishedSnapshot = authority.snapshot;
    const subscriptions = [...authority.subscriptions];
    for (const subscription of subscriptions) {
      if (
        subscription.status !== "live" ||
        subscription.owner !== authority ||
        !authority.subscriptions.has(subscription)
      ) {
        continue;
      }
      const terminal = authority.status === "revoked";
      const currentSnapshot = terminal ? undefined : publishedSnapshot;
      if (subscription.observedSnapshot === currentSnapshot) continue;
      subscription.observedSnapshot = currentSnapshot;
      try {
        Reflect.apply(subscription.listener, undefined, []);
      } catch {
        // Store listeners are notification-only. One hostile consumer cannot block another or
        // change the callback-free session snapshot that every consumer rereads independently.
      }
    }
    if (terminalAtStart) {
      for (const subscription of [...authority.subscriptions]) {
        revokeSessionSubscription(subscription);
      }
    }
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

function ownDataValue(owner: object, key: PropertyKey): OwnDataRead {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(owner, key);
    if (descriptor === undefined) return Object.freeze({ valid: true, present: false });
    return "value" in descriptor && descriptor.enumerable
      ? Object.freeze({ valid: true, present: true, value: descriptor.value })
      : Object.freeze({ valid: false, present: true });
  } catch {
    return Object.freeze({ valid: false, present: false });
  }
}

function exactOwnDataKeys(
  owner: object,
  required: readonly string[],
  optional: readonly string[],
): boolean {
  try {
    const keys = Reflect.ownKeys(owner);
    const allowed = new Set([...required, ...optional]);
    return (
      required.every((key) => keys.includes(key)) &&
      keys.every((key) => typeof key === "string" && allowed.has(key)) &&
      keys.every((key) => {
        const descriptor = Object.getOwnPropertyDescriptor(owner, key);
        return descriptor !== undefined && descriptor.enumerable && "value" in descriptor;
      })
    );
  } catch {
    return false;
  }
}

function captureAdapterAuthorityInput(input: unknown): CapturedAdapterAuthorityInput | undefined {
  try {
    if (typeof input !== "object" || input === null || Array.isArray(input)) return undefined;
    const prototype = Reflect.getPrototypeOf(input);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    const keys = Reflect.ownKeys(input);
    if (
      keys.length !== 2 ||
      !keys.includes("snapshot") ||
      !keys.includes("catalogSet") ||
      keys.some((key) => typeof key !== "string" || (key !== "snapshot" && key !== "catalogSet"))
    ) {
      return undefined;
    }
    const snapshot = Reflect.getOwnPropertyDescriptor(input, "snapshot");
    const catalogSet = Reflect.getOwnPropertyDescriptor(input, "catalogSet");
    if (
      snapshot === undefined ||
      !snapshot.enumerable ||
      !("value" in snapshot) ||
      catalogSet === undefined ||
      !catalogSet.enumerable ||
      !("value" in catalogSet)
    ) {
      return undefined;
    }
    return Object.freeze({
      snapshot: snapshot.value,
      catalogSet: catalogSet.value,
    });
  } catch {
    return undefined;
  }
}

function captureLimits(input: unknown): Limits | undefined {
  if (input === undefined) return RUNTIME_HEADLESS_SESSION_LIMITS;
  if (
    !isPlainRecord(input) ||
    !exactOwnDataKeys(
      input,
      [],
      [
        "maxBindingCandidates",
        "maxDepth",
        "maxEventHandlerBindings",
        "maxNodes",
        "maxPlanCodeUnits",
        "maxPlanJsonOccurrences",
        "maxSnapshotGeneration",
        "maxSubscriptions",
        "maxSurfaceTransitions",
      ],
    )
  ) {
    return undefined;
  }
  const captured = Object.create(null) as Record<string, number>;
  for (const [key, maximum] of Object.entries(RUNTIME_HEADLESS_SESSION_LIMITS)) {
    const read = ownDataValue(input, key);
    if (!read.valid) return undefined;
    const candidate = read.present ? read.value : maximum;
    if (
      typeof candidate !== "number" ||
      !Number.isSafeInteger(candidate) ||
      candidate < 0 ||
      candidate > maximum
    ) {
      return undefined;
    }
    captured[key] = candidate;
  }
  return Object.freeze(captured) as unknown as Limits;
}

function captureMountInput(
  input: RuntimeHeadlessSessionMountInput,
): CapturedMountInput | undefined {
  if (
    !isPlainRecord(input) ||
    !exactOwnDataKeys(input, ["bundle", "catalogs", "hostPorts"], ["limits"])
  ) {
    return undefined;
  }
  const bundle = ownDataValue(input, "bundle");
  const catalogs = ownDataValue(input, "catalogs");
  const hostPorts = ownDataValue(input, "hostPorts");
  const limitsValue = ownDataValue(input, "limits");
  if (
    !bundle.valid ||
    !bundle.present ||
    !catalogs.valid ||
    !catalogs.present ||
    !hostPorts.valid ||
    !hostPorts.present ||
    !limitsValue.valid
  ) {
    return undefined;
  }
  const limits = captureLimits(limitsValue.present ? limitsValue.value : undefined);
  if (limits === undefined) return undefined;
  return Object.freeze({
    bundle: bundle.value,
    catalogs: catalogs.value,
    hostPorts: hostPorts.value as RuntimeHostPorts,
    limits,
  });
}

function captureEventInput(
  input: RuntimeHeadlessSessionEventInput,
): CapturedEventInput | undefined {
  if (
    !isPlainRecord(input) ||
    !exactOwnDataKeys(input, ["eventName", "payload", "runtimeInstanceId", "snapshot"], [])
  ) {
    return undefined;
  }
  const snapshot = ownDataValue(input, "snapshot");
  const runtimeInstanceId = ownDataValue(input, "runtimeInstanceId");
  const eventName = ownDataValue(input, "eventName");
  const payload = ownDataValue(input, "payload");
  if (
    !snapshot.valid ||
    !snapshot.present ||
    !runtimeInstanceId.valid ||
    !runtimeInstanceId.present ||
    typeof runtimeInstanceId.value !== "string" ||
    runtimeInstanceId.value.length === 0 ||
    !eventName.valid ||
    !eventName.present ||
    typeof eventName.value !== "string" ||
    !LOCAL_IDENTIFIER_PATTERN.test(eventName.value) ||
    !payload.valid ||
    !payload.present
  ) {
    return undefined;
  }
  return Object.freeze({
    snapshot: snapshot.value as RuntimeHeadlessSessionSnapshot,
    runtimeInstanceId: runtimeInstanceId.value,
    eventName: eventName.value,
    payload: payload.value,
  });
}

function invalidMount(
  reason: RuntimeHeadlessSessionMountInvalidReason,
  diagnostics: readonly DesenDiagnostic<string>[] = EMPTY_DIAGNOSTICS,
): RuntimeHeadlessSessionMountResult {
  return Object.freeze({ status: "invalid", reason, diagnostics });
}

function componentSelectorKey(sourceNodeId: string, eventName: string): string {
  return canonicalizeJson(["component", sourceNodeId, eventName]);
}

function behaviorSelectorKey(sourceNodeId: string, behaviorId: string, eventName: string): string {
  return canonicalizeJson(["behavior", sourceNodeId, behaviorId, eventName]);
}

function prepareHandler(
  programs: Map<string, RuntimeActionTurnProgram>,
  key: string,
  actions: readonly RuntimeJsonValue[],
  aliases: Map<string, string>,
): boolean {
  const prepared = prepareRuntimeActionProgram(actions);
  if (prepared.status !== "prepared" || prepared.overflow || programs.has(key)) return false;
  programs.set(key, prepared.program);
  return collectOperationAliases(actions, aliases);
}

function collectOperationAliases(
  actions: readonly RuntimeJsonValue[],
  aliases: Map<string, string>,
): boolean {
  const pending = [...actions];
  while (pending.length > 0) {
    const action = pending.pop();
    if (!isPlainRecord(action)) return false;
    if (action.type === "operation.invoke") {
      if (typeof action.as !== "string" || typeof action.operation !== "string") return false;
      const prior = aliases.get(action.as);
      if (prior !== undefined && prior !== action.operation) return false;
      aliases.set(action.as, action.operation);
      for (const branch of ["onFailure", "onSuccess"] as const) {
        const nested = action[branch];
        if (nested === undefined) continue;
        if (!Array.isArray(nested)) return false;
        for (let index = nested.length - 1; index >= 0; index -= 1) {
          pending.push(nested[index] as RuntimeJsonValue);
        }
      }
    }
  }
  return true;
}

function prepareHandlers(
  programs: Map<string, RuntimeActionTurnProgram>,
  aliases: Map<string, string>,
  sourceNodeId: string,
  behaviorId: string | undefined,
  handlers: unknown,
): boolean {
  if (handlers === undefined) return true;
  if (!isPlainRecord(handlers)) return false;
  for (const eventName of Object.keys(handlers).sort(compareText)) {
    const actions = handlers[eventName];
    if (!LOCAL_IDENTIFIER_PATTERN.test(eventName) || !Array.isArray(actions)) return false;
    const key =
      behaviorId === undefined
        ? componentSelectorKey(sourceNodeId, eventName)
        : behaviorSelectorKey(sourceNodeId, behaviorId, eventName);
    if (!prepareHandler(programs, key, actions as readonly RuntimeJsonValue[], aliases)) {
      return false;
    }
  }
  return true;
}

function childNodes(owner: RuntimeJsonObject): RuntimeJsonObject[] | undefined {
  const slots = owner.slots;
  if (slots === undefined) return [];
  if (!isPlainRecord(slots)) return undefined;
  const children: RuntimeJsonObject[] = [];
  for (const slotName of Object.keys(slots).sort(compareText)) {
    const slot = slots[slotName];
    if (!Array.isArray(slot)) return undefined;
    for (const child of slot) {
      if (!isPlainRecord(child)) return undefined;
      children.push(child as RuntimeJsonObject);
    }
  }
  return children;
}

function prepareSurfaceDefinition(
  surfaceId: string,
  surface: BundleSurface,
  limits: Limits,
): SurfaceDefinition | undefined {
  const surfaceJson = surface as unknown as RuntimeJsonObject;
  const root = surfaceJson.root;
  if (!isPlainRecord(root)) return undefined;
  const staticComponents = new Map<string, string>();
  const aliases = new Map<string, string>();
  const programs = new Map<string, RuntimeActionTurnProgram>();
  const pending: { readonly node: RuntimeJsonObject; readonly depth: number }[] = [
    { node: root as RuntimeJsonObject, depth: 0 },
  ];
  let observedNodes = 0;

  while (pending.length > 0) {
    const current = pending.pop() as { readonly node: RuntimeJsonObject; readonly depth: number };
    observedNodes += 1;
    if (observedNodes > limits.maxNodes || current.depth > limits.maxDepth) return undefined;
    const sourceNodeId = current.node.id;
    const capabilityId = current.node.use;
    if (
      typeof sourceNodeId !== "string" ||
      !LOCAL_IDENTIFIER_PATTERN.test(sourceNodeId) ||
      typeof capabilityId !== "string" ||
      staticComponents.has(sourceNodeId)
    ) {
      return undefined;
    }
    staticComponents.set(sourceNodeId, capabilityId);
    if (!prepareHandlers(programs, aliases, sourceNodeId, undefined, current.node.on))
      return undefined;

    const behaviors = current.node.behaviors;
    if (behaviors !== undefined) {
      if (!Array.isArray(behaviors)) return undefined;
      const behaviorIds = new Set<string>();
      for (const behavior of behaviors) {
        if (!isPlainRecord(behavior)) return undefined;
        const behaviorId = behavior.id;
        if (
          typeof behaviorId !== "string" ||
          !LOCAL_IDENTIFIER_PATTERN.test(behaviorId) ||
          behaviorIds.has(behaviorId)
        ) {
          return undefined;
        }
        behaviorIds.add(behaviorId);
        if (!prepareHandlers(programs, aliases, sourceNodeId, behaviorId, behavior.on)) {
          return undefined;
        }
        const behaviorChildren = childNodes(behavior as RuntimeJsonObject);
        if (behaviorChildren === undefined) return undefined;
        for (let index = behaviorChildren.length - 1; index >= 0; index -= 1) {
          pending.push({
            node: behaviorChildren[index] as RuntimeJsonObject,
            depth: current.depth + 1,
          });
        }
      }
    }

    const children = childNodes(current.node);
    if (children === undefined) return undefined;
    for (let index = children.length - 1; index >= 0; index -= 1) {
      pending.push({
        node: children[index] as RuntimeJsonObject,
        depth: current.depth + 1,
      });
    }
  }

  return Object.freeze({
    surfaceId,
    surface,
    staticComponents: Object.freeze(Object.fromEntries([...staticComponents].sort())),
    operationAliases: Object.freeze(
      Object.fromEntries(
        [...aliases]
          .sort(([left], [right]) => compareText(left, right))
          .map(([alias, operation]) => [alias, Object.freeze({ operation })]),
      ),
    ),
    programs,
  });
}

function prepareDefinitions(
  bundle: BundleSnapshot,
  limits: Limits,
): ReadonlyMap<string, SurfaceDefinition> | undefined {
  const definitions = new Map<string, SurfaceDefinition>();
  const surfaces = bundle.surfaces as unknown as RuntimeJsonObject;
  for (const surfaceId of Object.keys(surfaces).sort(compareText)) {
    const surface = surfaces[surfaceId];
    if (!isPlainRecord(surface)) return undefined;
    const definition = prepareSurfaceDefinition(surfaceId, surface as BundleSurface, limits);
    if (definition === undefined) return undefined;
    definitions.set(surfaceId, definition);
  }
  return definitions;
}

function isClosedNavigationSuccess(input: unknown): input is RuntimeNavigationResult {
  if (!isPlainRecord(input) || !exactOwnDataKeys(input, ["status"], [])) return false;
  return ownDataValue(input, "status").value === "succeeded";
}

function createSharedHostPorts(
  input: RuntimeHostPorts,
  owner: { current: HeadlessSessionAuthority | undefined },
): RuntimeReactiveHostPorts {
  const captured = createRuntimeHostPorts(input);
  const navigate = captured.navigation.navigate;
  const subscribeContext = captured.context.subscribe;
  const subscribeEnvironment = captured.environment.subscribe;

  const notifyAfterReactiveEvaluation = (): void => {
    const authority = owner.current;
    if (authority === undefined || authority.status !== "live" || authority.transitioning) return;
    const current = authority.current;
    if (current === undefined) return;
    const reactive = readRuntimeReactiveReevaluation(current.reactiveHandle);
    if (reactive.status === "read") {
      commitPublishedReactive(authority, current, reactive.snapshot);
    } else {
      disposeSessionAuthority(authority);
    }
  };

  const navigation = Object.freeze({
    navigate(request: RuntimeNavigationRequest): RuntimeNavigationResult {
      const result = Reflect.apply(navigate, undefined, [request]);
      if (isClosedNavigationSuccess(result)) {
        const authority = owner.current;
        const graph = authority?.retainedGraph;
        if (
          authority !== undefined &&
          graph !== undefined &&
          authority.status !== "revoked" &&
          request.context.documentId === graph.bundle.id &&
          request.context.revision === graph.bundle.revision
        ) {
          authority.pendingNavigation = request.targetSurfaceId;
          // T10 invokes navigation while T13 still owns the current drain. The microtask performs
          // the surface handoff only after that ordered action has returned and therefore never
          // disposes the coordinator from inside its own child callback.
          void Promise.resolve().then(() => {
            if (authority.status === "live" && authority.pendingNavigation !== undefined) {
              transitionToPendingSurface(authority);
            }
          });
        }
      }
      return result;
    },
  });
  const context = Object.freeze({
    getSnapshot: captured.context.getSnapshot,
    subscribe(notice: () => void): () => void {
      return Reflect.apply(subscribeContext, undefined, [
        () => {
          try {
            Reflect.apply(notice, undefined, []);
          } finally {
            notifyAfterReactiveEvaluation();
          }
        },
      ]);
    },
  });
  const environment = Object.freeze({
    getSnapshot: captured.environment.getSnapshot,
    subscribe(notice: () => void): () => void {
      return Reflect.apply(subscribeEnvironment, undefined, [
        () => {
          try {
            Reflect.apply(notice, undefined, []);
          } finally {
            notifyAfterReactiveEvaluation();
          }
        },
      ]);
    },
  });

  return createRuntimeReactiveHostPorts(
    Object.freeze({
      navigation,
      storage: captured.storage,
      operations: captured.operations,
      resources: captured.resources,
      tokens: captured.tokens,
      context,
      environment,
      clock: captured.clock,
      diagnostics: captured.diagnostics,
    }),
  );
}

function captureHostNamespace(
  callback: (this: void) => RuntimeJsonObject,
): RuntimeJsonObject | undefined {
  try {
    const snapshot = snapshotRuntimeJsonValue(Reflect.apply(callback, undefined, []));
    return isPlainRecord(snapshot) ? (snapshot as RuntimeJsonObject) : undefined;
  } catch {
    return undefined;
  }
}

function currentResolutionSnapshot(
  authority: HeadlessSessionAuthority,
  lifetime: SurfaceLifetime | undefined,
  event: Readonly<
    | { readonly status: "unavailable" }
    | { readonly status: "available"; readonly value: RuntimeJsonValue }
  >,
  item: RuntimeJsonObject,
) {
  const graph = authority.retainedGraph;
  if (graph === undefined) return undefined;
  let stateValues = EMPTY_OBJECT;
  let resourceLifecycles: RuntimeResolutionSnapshotInput["resource"] = {};
  let operationLifecycles: RuntimeResolutionSnapshotInput["operation"] = {};
  if (lifetime !== undefined) {
    const state = readRuntimeSurfaceState(lifetime.stateHandle);
    const resources = readRuntimeSurfaceResources(lifetime.resourceHandle);
    const operations = readRuntimeSurfaceOperations(lifetime.operationHandle);
    if (state.status !== "active" || resources.status !== "read" || operations.status !== "read") {
      return undefined;
    }
    stateValues = state.snapshot.values;
    resourceLifecycles = resources.snapshot.lifecycles;
    operationLifecycles = operations.snapshot.lifecycles;
  }
  const context = captureHostNamespace(graph.hostPorts.context.getSnapshot);
  const environment = captureHostNamespace(graph.hostPorts.environment.getSnapshot);
  if (context === undefined || environment === undefined) return undefined;
  try {
    return createRuntimeResolutionSnapshot({
      state: stateValues,
      context,
      resource: resourceLifecycles,
      operation: operationLifecycles,
      event,
      item,
      env: environment,
    });
  } catch {
    return undefined;
  }
}

function currentLowerSnapshots(lifetime: SurfaceLifetime):
  | Readonly<{
      state: Extract<ReturnType<typeof readRuntimeSurfaceState>, { readonly status: "active" }>;
      resources: Extract<
        ReturnType<typeof readRuntimeSurfaceResources>,
        { readonly status: "read" }
      >;
      operations: Extract<
        ReturnType<typeof readRuntimeSurfaceOperations>,
        { readonly status: "read" }
      >;
    }>
  | undefined {
  const state = readRuntimeSurfaceState(lifetime.stateHandle);
  const resources = readRuntimeSurfaceResources(lifetime.resourceHandle);
  const operations = readRuntimeSurfaceOperations(lifetime.operationHandle);
  return state.status === "active" && resources.status === "read" && operations.status === "read"
    ? Object.freeze({ state, resources, operations })
    : undefined;
}

function materializationLimits(limits: Limits): RuntimeHeadlessMaterializationLimitProfile {
  return Object.freeze({
    maxNodes: limits.maxNodes,
    maxDepth: limits.maxDepth,
    maxJsonOccurrences: limits.maxPlanJsonOccurrences,
    maxStringCodeUnits: limits.maxPlanCodeUnits,
  });
}

function exactCommitment(input: RuntimeJsonValue):
  | Readonly<{
      status: "materialized";
      planDigest: string;
      bindingDigest: string;
    }>
  | undefined {
  if (
    !isPlainRecord(input) ||
    !exactOwnDataKeys(input, ["bindingDigest", "planDigest", "status"], [])
  ) {
    return undefined;
  }
  const status = ownDataValue(input, "status");
  const planDigest = ownDataValue(input, "planDigest");
  const bindingDigest = ownDataValue(input, "bindingDigest");
  return status.value === "materialized" &&
    isSha256Digest(planDigest.value) &&
    isSha256Digest(bindingDigest.value)
    ? Object.freeze({
        status: "materialized",
        planDigest: planDigest.value,
        bindingDigest: bindingDigest.value,
      })
    : undefined;
}

function commitmentValue(commitment: RuntimeHeadlessMaterializationCommitment): RuntimeJsonObject {
  return Object.freeze({
    status: "materialized",
    planDigest: commitment.planDigest,
    bindingDigest: commitment.bindingDigest,
  });
}

function bindingRuntimeInstanceId(intent: RuntimeHeadlessBindingIntent): string {
  return intent.kind === "component"
    ? intent.identity.key
    : canonicalizeJson([intent.ownerRuntimeInstanceId, "behavior", intent.behaviorId]);
}

function bindingIntentSignature(intent: RuntimeHeadlessBindingIntent): string {
  return intent.kind === "component"
    ? canonicalizeJson({
        capabilityId: intent.capabilityId,
        handledEvents: intent.handledEvents,
        item: intent.scope.aliases,
        kind: intent.kind,
        repeatKeys: intent.scope.repeatKeys,
        runtimeInstanceId: intent.identity.key,
        sourceNodeId: intent.sourceNodeId,
      })
    : canonicalizeJson({
        aliases: intent.scope.aliases,
        behaviorId: intent.behaviorId,
        capabilityId: intent.capabilityId,
        handledEvents: intent.handledEvents,
        kind: intent.kind,
        ownerRuntimeInstanceId: intent.ownerRuntimeInstanceId,
        repeatKeys: intent.scope.repeatKeys,
        sourceNodeId: intent.sourceNodeId,
      });
}

function handlersHavePreparedPrograms(
  definition: SurfaceDefinition,
  intent: RuntimeHeadlessBindingIntent,
): boolean {
  const eventNames = Object.keys(intent.handlers).sort(compareText);
  if (canonicalizeJson(eventNames) !== canonicalizeJson(intent.handledEvents)) return false;
  return eventNames.every((eventName) =>
    definition.programs.has(
      intent.kind === "component"
        ? componentSelectorKey(intent.sourceNodeId, eventName)
        : behaviorSelectorKey(intent.sourceNodeId, intent.behaviorId, eventName),
    ),
  );
}

function unregisterActiveBinding(lifetime: SurfaceLifetime, active: ActiveBinding): boolean {
  const removed = unregisterRuntimeAdapterBinding(lifetime.bridgeHandle, {
    ticket: active.ticket,
    snapshot: lifetime.bridgeSnapshot,
  });
  if (removed.status !== "unregistered") return false;
  lifetime.bridgeSnapshot = removed.snapshot;
  return true;
}

function registerIntent(
  lifetime: SurfaceLifetime,
  intent: RuntimeHeadlessBindingIntent,
  current: Map<string, ActiveBinding>,
): ActiveBinding | undefined {
  const registered =
    intent.kind === "component"
      ? registerRuntimeAdapterBinding(lifetime.bridgeHandle, {
          kind: "component",
          identity: intent.identity,
          scope: intent.scope,
          handledEvents: intent.handledEvents,
          snapshot: lifetime.bridgeSnapshot,
        })
      : (() => {
          const owner = current.get(intent.ownerRuntimeInstanceId);
          if (owner === undefined || owner.intent.kind !== "component") return undefined;
          return registerRuntimeAdapterBinding(lifetime.bridgeHandle, {
            kind: "behavior",
            owner: owner.ticket,
            behaviorId: intent.behaviorId,
            capabilityId: intent.capabilityId,
            handledEvents: intent.handledEvents,
            snapshot: lifetime.bridgeSnapshot,
          });
        })();
  if (registered === undefined || registered.status !== "registered") return undefined;
  lifetime.bridgeSnapshot = registered.snapshot;
  return Object.freeze({
    intent,
    ticket: registered.ticket,
    snapshot: registered.binding,
  });
}

function restoreBindings(
  lifetime: SurfaceLifetime,
  previous: readonly ActiveBinding[],
): Map<string, ActiveBinding> | undefined {
  const bridge = readRuntimeAdapterBridges(lifetime.bridgeHandle);
  if (bridge.status !== "read" || bridge.snapshot.bindings.length !== 0) return undefined;
  lifetime.bridgeSnapshot = bridge.snapshot;
  const restored = new Map<string, ActiveBinding>();
  for (const { intent } of previous) {
    const registered = registerIntent(lifetime, intent, restored);
    if (registered === undefined) return undefined;
    restored.set(registered.snapshot.runtimeInstanceId, registered);
  }
  return restored;
}

function clearBindingsForRollback(
  lifetime: SurfaceLifetime,
  known: readonly ActiveBinding[],
): boolean {
  const knownById = new Map(
    known.map((active) => [active.snapshot.runtimeInstanceId, active] as const),
  );
  for (;;) {
    const bridge = readRuntimeAdapterBridges(lifetime.bridgeHandle);
    if (bridge.status !== "read") return false;
    lifetime.bridgeSnapshot = bridge.snapshot;
    if (bridge.snapshot.bindings.length === 0) return true;
    const live = [...bridge.snapshot.bindings].sort((left, right) => {
      if (left.kind !== right.kind) return left.kind === "behavior" ? -1 : 1;
      return compareText(right.runtimeInstanceId, left.runtimeInstanceId);
    });
    const selected = live[0];
    if (selected === undefined) return false;
    const active = knownById.get(selected.runtimeInstanceId);
    if (active === undefined || !unregisterActiveBinding(lifetime, active)) return false;
  }
}

function rollbackBindings(
  lifetime: SurfaceLifetime,
  previous: readonly ActiveBinding[],
  added: readonly ActiveBinding[],
): boolean {
  if (!clearBindingsForRollback(lifetime, [...previous, ...added])) return false;
  const restored = restoreBindings(lifetime, previous);
  if (restored === undefined) return false;
  lifetime.bindings = restored;
  return true;
}

type BindingReconciliationResult = "failed" | "reconciled" | "rejected";

function reconcileBindings(
  lifetime: SurfaceLifetime,
  intents: readonly RuntimeHeadlessBindingIntent[],
  maximumBindings: number,
  maximumEventHandlers: number,
): BindingReconciliationResult {
  if (intents.length > maximumBindings) return "rejected";
  const desiredById = new Map<string, RuntimeHeadlessBindingIntent>();
  let handledEventBindings = 0;
  for (const intent of intents) {
    handledEventBindings += intent.handledEvents.length;
    if (
      handledEventBindings > maximumEventHandlers ||
      !handlersHavePreparedPrograms(lifetime.definition, intent)
    ) {
      return "rejected";
    }
    const runtimeInstanceId = bindingRuntimeInstanceId(intent);
    if (desiredById.has(runtimeInstanceId)) return "rejected";
    desiredById.set(runtimeInstanceId, intent);
  }
  const requestedById = new Map(desiredById);

  const previous = [...lifetime.bindings.values()];
  const next = new Map<string, ActiveBinding>();
  const changedOrRemoved: ActiveBinding[] = [];
  for (const [runtimeInstanceId, active] of lifetime.bindings) {
    const desired = desiredById.get(runtimeInstanceId);
    if (
      desired !== undefined &&
      bindingIntentSignature(desired) === bindingIntentSignature(active.intent)
    ) {
      next.set(runtimeInstanceId, active);
      desiredById.delete(runtimeInstanceId);
    } else {
      changedOrRemoved.push(active);
    }
  }

  // A changed component invalidates its behavior tickets even if a behavior's inert descriptor is
  // otherwise equal, so dependent behaviors join the same replacement transaction.
  const replacedComponentIds = new Set(
    changedOrRemoved
      .filter(({ intent }) => intent.kind === "component")
      .map(({ snapshot }) => snapshot.runtimeInstanceId),
  );
  for (const [runtimeInstanceId, active] of [...next]) {
    if (
      active.intent.kind === "behavior" &&
      replacedComponentIds.has(active.intent.ownerRuntimeInstanceId)
    ) {
      next.delete(runtimeInstanceId);
      changedOrRemoved.push(active);
      const desired = requestedById.get(runtimeInstanceId);
      if (desired === undefined) return "rejected";
      desiredById.set(runtimeInstanceId, desired);
    }
  }

  const removals = [...changedOrRemoved].sort((left, right) => {
    if (left.intent.kind !== right.intent.kind) return left.intent.kind === "behavior" ? -1 : 1;
    return compareText(right.snapshot.runtimeInstanceId, left.snapshot.runtimeInstanceId);
  });
  const removedIds = new Set<string>();
  for (const active of removals) {
    // Component removal cascades its behavior children. Avoid presenting the now-stale child ticket
    // to T14 a second time.
    if (active.intent.kind === "behavior" && removedIds.has(active.intent.ownerRuntimeInstanceId)) {
      continue;
    }
    if (!unregisterActiveBinding(lifetime, active)) {
      rollbackBindings(lifetime, previous, []);
      return "failed";
    }
    removedIds.add(active.snapshot.runtimeInstanceId);
  }

  const additions = intents.filter((intent) => desiredById.has(bindingRuntimeInstanceId(intent)));
  const added: ActiveBinding[] = [];
  for (const intent of additions) {
    const registered = registerIntent(lifetime, intent, next);
    if (registered === undefined) {
      rollbackBindings(lifetime, previous, added);
      return "failed";
    }
    next.set(registered.snapshot.runtimeInstanceId, registered);
    added.push(registered);
  }
  const ordered = new Map<string, ActiveBinding>();
  for (const intent of intents) {
    const runtimeInstanceId = bindingRuntimeInstanceId(intent);
    const active = next.get(runtimeInstanceId);
    if (active === undefined) {
      rollbackBindings(lifetime, previous, added);
      return "failed";
    }
    ordered.set(runtimeInstanceId, active);
  }
  lifetime.bindings = ordered;
  return "reconciled";
}

function commitPublishedReactive(
  authority: HeadlessSessionAuthority,
  lifetime: SurfaceLifetime,
  reactive: RuntimeReactiveReevaluationSnapshot,
): boolean {
  const graph = authority.retainedGraph;
  if (authority.status === "revoked" || graph === undefined || authority.current !== lifetime) {
    lifetime.candidates.clear();
    return false;
  }
  if (
    reactive.documentId !== graph.bundle.id ||
    reactive.revision !== graph.bundle.revision ||
    reactive.surfaceId !== lifetime.definition.surfaceId
  ) {
    lifetime.candidates.clear();
    disposeSessionAuthority(authority);
    return false;
  }
  const previousSnapshot = authority.snapshot;
  const alreadyCommitted =
    previousSnapshot !== undefined &&
    previousSnapshot.surfaceId === lifetime.definition.surfaceId &&
    previousSnapshot.evaluationId === reactive.evaluationId &&
    reactive === lifetime.reactiveSnapshot;
  if (reactive.outcome.status !== "active") {
    lifetime.candidates.clear();
    disposeSessionAuthority(authority);
    return false;
  }
  const commitment = exactCommitment(reactive.outcome.value);
  const exactCandidate = lifetime.candidates.get(reactive.evaluationId);
  const candidate =
    exactCandidate ??
    (alreadyCommitted && lifetime.candidates.size === 1
      ? lifetime.candidates.values().next().value
      : undefined);
  lifetime.candidates.clear();
  if (commitment === undefined || candidate === undefined) {
    if (alreadyCommitted && candidate === undefined) return true;
    disposeSessionAuthority(authority);
    return false;
  }
  if (
    candidate.commitment.planDigest !== commitment.planDigest ||
    candidate.commitment.bindingDigest !== commitment.bindingDigest
  ) {
    disposeSessionAuthority(authority);
    return false;
  }
  const sidecar = readRuntimeHeadlessMaterializationSidecar(
    candidate.sidecar,
    candidate.evaluationId,
  );
  if (
    sidecar.status !== "read" ||
    sidecar.commitment.planDigest !== commitment.planDigest ||
    sidecar.commitment.bindingDigest !== commitment.bindingDigest ||
    sidecar.plan !== candidate.plan
  ) {
    disposeSessionAuthority(authority);
    return false;
  }
  const lower = currentLowerSnapshots(lifetime);
  const currentBridge = readRuntimeAdapterBridges(lifetime.bridgeHandle);
  if (
    lower === undefined ||
    currentBridge.status !== "read" ||
    currentBridge.snapshot !== lifetime.bridgeSnapshot
  ) {
    disposeSessionAuthority(authority);
    return false;
  }
  if (
    alreadyCommitted &&
    previousSnapshot.planDigest === commitment.planDigest &&
    previousSnapshot.bindingDigest === commitment.bindingDigest &&
    previousSnapshot.state === lower.state.snapshot.values &&
    previousSnapshot.resource === lower.resources.snapshot.lifecycles &&
    previousSnapshot.operation === lower.operations.snapshot.lifecycles &&
    previousSnapshot.bindings === currentBridge.snapshot.bindings
  ) {
    return true;
  }
  const generation =
    previousSnapshot === undefined
      ? 0
      : authority.nextSnapshotGeneration > authority.limits.maxSnapshotGeneration
        ? undefined
        : authority.nextSnapshotGeneration;
  if (generation === undefined) {
    disposeSessionAuthority(authority);
    return false;
  }

  let bridge: ReturnType<typeof readRuntimeAdapterBridges> = currentBridge;
  let plan = candidate.plan;
  if (alreadyCommitted) {
    if (
      previousSnapshot.planDigest !== commitment.planDigest ||
      previousSnapshot.bindingDigest !== commitment.bindingDigest
    ) {
      disposeSessionAuthority(authority);
      return false;
    }
    plan = previousSnapshot.plan;
  } else {
    const reconciliation = reconcileBindings(
      lifetime,
      sidecar.intents,
      authority.limits.maxBindingCandidates,
      authority.limits.maxEventHandlerBindings,
    );
    if (reconciliation !== "reconciled") {
      disposeSessionAuthority(authority);
      return false;
    }
    bridge = readRuntimeAdapterBridges(lifetime.bridgeHandle);
    if (bridge.status !== "read" || bridge.snapshot !== lifetime.bridgeSnapshot) {
      disposeSessionAuthority(authority);
      return false;
    }
  }

  const snapshot = Object.freeze({
    documentId: graph.bundle.id,
    revision: graph.bundle.revision,
    surfaceId: lifetime.definition.surfaceId,
    generation,
    evaluationId: reactive.evaluationId,
    planDigest: commitment.planDigest,
    bindingDigest: commitment.bindingDigest,
    plan,
    state: lower.state.snapshot.values,
    resource: lower.resources.snapshot.lifecycles as RuntimeJsonObject,
    operation: lower.operations.snapshot.lifecycles as RuntimeJsonObject,
    bindings: bridge.snapshot.bindings,
  }) as RuntimeHeadlessSessionSnapshot;
  SESSION_SNAPSHOTS.set(snapshot, authority.snapshotOwner);
  authority.snapshot = snapshot;
  authority.nextSnapshotGeneration = generation + 1;
  lifetime.reactiveSnapshot = reactive;
  if (authority.status === "live") scheduleSessionNotification(authority);
  return true;
}

interface BuiltSurface {
  readonly lifetime: SurfaceLifetime;
  readonly initialResourceSettlements: readonly Promise<RuntimeResourceSettlement>[];
}

function disposeCompleteSurface(lifetime: SurfaceLifetime): boolean {
  let reactiveDisposed = false;
  try {
    const reactive = disposeRuntimeReactiveReevaluation(lifetime.reactiveHandle);
    reactiveDisposed = reactive.status === "disposed" || reactive.status === "already-disposed";
  } catch {
    // The next independent authority must still be revoked.
  }
  if (!reactiveDisposed) return false;
  let bridgeDisposed = false;
  try {
    const bridge = disposeRuntimeAdapterBridges(lifetime.bridgeHandle);
    bridgeDisposed = bridge.status === "disposed" || bridge.status === "already-disposed";
  } catch {
    // A deferred session retry must preserve T14-before-T13 disposal order.
  }
  if (!bridgeDisposed) return false;
  lifetime.unsubscribeSettlements();
  let turnsDisposed = false;
  try {
    const turns = disposeRuntimeActionTurns(lifetime.turnsHandle);
    turnsDisposed = turns.status === "disposed" || turns.status === "already-disposed";
  } catch {
    // Session authority is revoked independently below.
  }
  if (!turnsDisposed) return false;
  lifetime.candidates.clear();
  lifetime.bindings.clear();
  return true;
}

function buildSurface(
  authority: HeadlessSessionAuthority,
  definition: SurfaceDefinition,
): BuiltSurface | undefined {
  const graph = authority.retainedGraph;
  if (graph === undefined) return undefined;
  let state: ReturnType<typeof mountRuntimeSurfaceState> | undefined;
  let resources: ReturnType<typeof mountRuntimeSurfaceResources> | undefined;
  let operations: ReturnType<typeof mountRuntimeSurfaceOperations> | undefined;
  let stateActions: ReturnType<typeof mountRuntimeStateNavigationActions> | undefined;
  let operationActions: ReturnType<typeof mountRuntimeOperationResourceActions> | undefined;
  let commandActions: ReturnType<typeof mountRuntimeCommandEventActions> | undefined;
  let bridge: ReturnType<typeof createRuntimeAdapterBridgePorts> | undefined;
  let turns: ReturnType<typeof mountRuntimeActionTurns> | undefined;
  let unsubscribeSettlements: (() => void) | undefined;
  let reactive: ReturnType<typeof mountRuntimeReactiveReevaluation> | undefined;

  const cleanupPartial = (): void => {
    if (reactive?.status === "mounted") {
      try {
        disposeRuntimeReactiveReevaluation(reactive.handle);
      } catch {
        // Continue in the same required authority order.
      }
    }
    if (bridge !== undefined) {
      try {
        disposeRuntimeAdapterBridges(bridge.handle);
      } catch {
        // Continue toward lower authority cleanup.
      }
    }
    if (turns?.status === "mounted") {
      unsubscribeSettlements?.();
      try {
        disposeRuntimeActionTurns(turns.handle);
      } catch {
        // The session itself retains no lower handle after this failure.
      }
      return;
    }
    if (stateActions?.status === "mounted") {
      try {
        disposeRuntimeStateNavigationActions(stateActions.handle);
      } catch {
        // Fall through to the remaining independent managers.
      }
    } else if (state?.status === "mounted") {
      try {
        disposeRuntimeSurfaceState(state.handle);
      } catch {
        // No caller receives the partial state handle.
      }
    }
    if (operationActions?.status === "mounted") {
      try {
        disposeRuntimeOperationResourceActions(operationActions.handle);
      } catch {
        // No caller receives either surrendered lifecycle handle.
      }
    } else {
      if (resources?.status === "mounted") {
        try {
          disposeRuntimeSurfaceResources(resources.handle);
        } catch {
          // No caller receives the partial resource handle.
        }
      }
      if (operations?.status === "mounted") {
        try {
          disposeRuntimeSurfaceOperations(operations.handle);
        } catch {
          // No caller receives the partial operation handle.
        }
      }
    }
    if (commandActions?.status === "mounted") {
      try {
        disposeRuntimeCommandEventActions(commandActions.handle);
      } catch {
        // No caller receives the partial command/event handle.
      }
    }
  };

  try {
    const surface = definition.surface;
    state = mountRuntimeSurfaceState({
      surfaceId: definition.surfaceId,
      state: surface.state as unknown as Parameters<typeof mountRuntimeSurfaceState>[0]["state"],
    });
    if (state.status !== "mounted") {
      cleanupPartial();
      return undefined;
    }

    resources = mountRuntimeSurfaceResources({
      documentId: graph.bundle.id,
      revision: graph.bundle.revision,
      surfaceId: definition.surfaceId,
      resources: surface.resources as unknown as Parameters<
        typeof mountRuntimeSurfaceResources
      >[0]["resources"],
      catalogSet: graph.catalogSet,
      hostPorts: graph.hostPorts,
    });
    if (resources.status !== "mounted") {
      cleanupPartial();
      return undefined;
    }

    operations = mountRuntimeSurfaceOperations({
      documentId: graph.bundle.id,
      revision: graph.bundle.revision,
      surfaceId: definition.surfaceId,
      aliases: definition.operationAliases,
      catalogSet: graph.catalogSet,
      hostPorts: graph.hostPorts,
    });
    if (operations.status !== "mounted") {
      cleanupPartial();
      return undefined;
    }

    const context = captureHostNamespace(graph.hostPorts.context.getSnapshot);
    const environment = captureHostNamespace(graph.hostPorts.environment.getSnapshot);
    if (context === undefined || environment === undefined) {
      cleanupPartial();
      return undefined;
    }
    const initialResolution = createRuntimeResolutionSnapshot({
      state: state.snapshot.values,
      context,
      resource: resources.snapshot.lifecycles,
      operation: operations.snapshot.lifecycles,
      event: { status: "unavailable" },
      item: {},
      env: environment,
    });
    const startedResources = startRuntimeSurfaceResources(
      resources.handle,
      initialResolution,
      resources.snapshot,
    );
    if (startedResources.status !== "started") {
      cleanupPartial();
      return undefined;
    }
    const resourceSnapshot = startedResources.snapshot;
    const initialResourceSettlements = startedResources.entries.flatMap((entry) =>
      entry.status === "started" ? [entry.settlement] : [],
    );

    stateActions = mountRuntimeStateNavigationActions({
      documentId: graph.bundle.id,
      revision: graph.bundle.revision,
      surfaceId: definition.surfaceId,
      surfaceIds: [...graph.definitions.keys()].sort(compareText),
      stateHandle: state.handle,
      stateSnapshot: state.snapshot,
      hostPorts: graph.hostPorts,
    });
    if (stateActions.status !== "mounted") {
      cleanupPartial();
      return undefined;
    }

    operationActions = mountRuntimeOperationResourceActions({
      documentId: graph.bundle.id,
      revision: graph.bundle.revision,
      surfaceId: definition.surfaceId,
      operations: definition.operationAliases,
      resourceHandle: resources.handle,
      resourceSnapshot,
      operationHandle: operations.handle,
      operationSnapshot: operations.snapshot,
      hostPorts: graph.hostPorts,
    });
    if (operationActions.status !== "mounted") {
      cleanupPartial();
      return undefined;
    }

    bridge = createRuntimeAdapterBridgePorts({
      eventTurns: {
        dispatch(request: RuntimeAdapterEventTurnRequest) {
          return dispatchPreparedEvent(authority, request);
        },
      },
      limits: {
        maxLiveBindings: authority.limits.maxBindingCandidates,
        maxEventHandlerBindings: authority.limits.maxEventHandlerBindings,
      },
    });
    const commandEventPorts = createRuntimeCommandEventHostPorts({
      commands: bridge.componentCommands,
      events: {
        validate: () => Object.freeze({ status: "invalid" }),
        emit: () => Object.freeze({ status: "denied" }),
      },
    });
    commandActions = mountRuntimeCommandEventActions({
      documentId: graph.bundle.id,
      revision: graph.bundle.revision,
      surfaceId: definition.surfaceId,
      staticComponents: definition.staticComponents,
      hostEvents: {},
      catalogSet: graph.catalogSet,
      hostPorts: graph.hostPorts,
      commandEventPorts,
    });
    if (commandActions.status !== "mounted") {
      cleanupPartial();
      return undefined;
    }

    const bound = bindRuntimeAdapterBridges(bridge.handle, {
      documentId: graph.bundle.id,
      revision: graph.bundle.revision,
      surfaceId: definition.surfaceId,
      catalogSet: graph.catalogSet,
      commandEventActionsHandle: commandActions.handle,
      commandEventSnapshot: commandActions.snapshot,
    });
    if (bound.status !== "bound") {
      cleanupPartial();
      return undefined;
    }
    turns = mountRuntimeActionTurns({
      documentId: graph.bundle.id,
      revision: graph.bundle.revision,
      surfaceId: definition.surfaceId,
      stateHandle: state.handle,
      stateSnapshot: state.snapshot,
      resourceHandle: resources.handle,
      resourceSnapshot,
      operationHandle: operations.handle,
      operationSnapshot: operations.snapshot,
      stateActionsHandle: stateActions.handle,
      operationResourceActionsHandle: operationActions.handle,
      commandEventActionsHandle: commandActions.handle,
      commandEventSnapshot: commandActions.snapshot,
      hostPorts: graph.hostPorts,
    });
    if (turns.status !== "mounted") {
      cleanupPartial();
      return undefined;
    }

    const publishedLifetime: { current: SurfaceLifetime | undefined } = { current: undefined };
    const settlementSubscription = subscribeRuntimeActionTurnSettlements(turns.handle, (reason) => {
      const lifetime = publishedLifetime.current;
      if (lifetime === undefined || authority.status !== "live" || authority.current !== lifetime) {
        return;
      }
      try {
        if (reason === "disposed") {
          disposeSessionAuthority(authority);
          return;
        }
        if (authority.pendingNavigation !== undefined) {
          transitionToPendingSurface(authority);
        } else {
          invalidateSurface(authority, lifetime, reason);
        }
      } catch {
        disposeSessionAuthority(authority);
      }
    });
    if (settlementSubscription.status !== "subscribed") {
      cleanupPartial();
      return undefined;
    }
    unsubscribeSettlements = settlementSubscription.unsubscribe;

    const candidates = new Map<string, CandidateMaterialization>();
    reactive = mountRuntimeReactiveReevaluation({
      documentId: graph.bundle.id,
      revision: graph.bundle.revision,
      surfaceId: definition.surfaceId,
      stateHandle: state.handle,
      stateSnapshot: state.snapshot,
      resourceHandle: resources.handle,
      resourceSnapshot,
      operationHandle: operations.handle,
      operationSnapshot: operations.snapshot,
      hostPorts: graph.hostPorts,
      evaluator(request) {
        candidates.clear();
        const result = materializeRuntimeHeadlessSurface({
          documentId: graph.bundle.id,
          surfaceId: definition.surfaceId,
          surface: definition.surface,
          catalogSet: graph.catalogSet,
          resolutionSnapshot: request.resolutionSnapshot,
          materializationContext: request.materializationContext,
          evaluationId: request.evaluationId,
          limits: materializationLimits(authority.limits),
        });
        if (result.status !== "materialized") {
          throw new TypeError("Headless surface materialization failed closed.");
        }
        candidates.set(
          request.evaluationId,
          Object.freeze({
            evaluationId: request.evaluationId,
            commitment: result.commitment,
            plan: result.plan,
            sidecar: result.sidecar,
          }),
        );
        return commitmentValue(result.commitment);
      },
    });
    if (reactive.status !== "mounted" || reactive.snapshot.outcome.status !== "active") {
      cleanupPartial();
      return undefined;
    }

    const lifetime: SurfaceLifetime = {
      definition,
      stateHandle: state.handle,
      resourceHandle: resources.handle,
      operationHandle: operations.handle,
      turnsHandle: turns.handle,
      unsubscribeSettlements: settlementSubscription.unsubscribe,
      bridgeHandle: bridge.handle,
      bridgeSnapshot: bound.snapshot,
      reactiveHandle: reactive.handle,
      reactiveSnapshot: reactive.snapshot,
      candidates,
      bindings: new Map(),
    };
    publishedLifetime.current = lifetime;
    authority.current = lifetime;
    if (!commitPublishedReactive(authority, lifetime, reactive.snapshot)) {
      if (authority.current === lifetime) {
        authority.current = undefined;
        disposeCompleteSurface(lifetime);
      }
      return undefined;
    }
    return Object.freeze({
      lifetime,
      initialResourceSettlements: Object.freeze(initialResourceSettlements),
    });
  } catch {
    cleanupPartial();
    return undefined;
  }
}

function invalidateSurface(
  authority: HeadlessSessionAuthority,
  lifetime: SurfaceLifetime,
  reason: "action-turn" | "operation" | "resource" | "state",
): boolean {
  if (authority.status === "revoked" || authority.current !== lifetime) return false;
  const current = readRuntimeReactiveReevaluation(lifetime.reactiveHandle);
  if (current.status !== "read") {
    disposeSessionAuthority(authority);
    return false;
  }
  const invalidated = invalidateRuntimeReactiveReevaluation(lifetime.reactiveHandle, {
    snapshot: current.snapshot,
    reason,
  });
  if (
    invalidated.status !== "reevaluated" &&
    invalidated.status !== "unchanged" &&
    invalidated.status !== "queued"
  ) {
    disposeSessionAuthority(authority);
    return false;
  }
  const published =
    invalidated.status === "queued"
      ? readRuntimeReactiveReevaluation(lifetime.reactiveHandle)
      : Object.freeze({ status: "read" as const, snapshot: invalidated.snapshot });
  if (published.status !== "read") {
    disposeSessionAuthority(authority);
    return false;
  }
  return commitPublishedReactive(authority, lifetime, published.snapshot);
}

function terminalCompletion(
  completion: RuntimeActionTurnCompletion,
  snapshot: RuntimeHeadlessSessionSnapshot | undefined,
): RuntimeHeadlessSessionEventCompletion {
  return Object.freeze({
    status: completion.status,
    turnId: completion.turnId,
    snapshot: snapshot ?? null,
  });
}

function observeResourceSettlement(
  authority: HeadlessSessionAuthority,
  lifetime: SurfaceLifetime,
  settlement: Promise<RuntimeResourceSettlement>,
): void {
  if (authority.observedSettlements.has(settlement)) return;
  authority.observedSettlements.add(settlement);
  void settlement.then(
    () => {
      if (authority.status === "live" && authority.current === lifetime) {
        invalidateSurface(authority, lifetime, "resource");
      }
    },
    () => undefined,
  );
}

function observedTurnCompletion(
  authority: HeadlessSessionAuthority,
  lifetime: SurfaceLifetime,
  completion: Promise<RuntimeActionTurnCompletion>,
): Promise<RuntimeHeadlessSessionEventCompletion> {
  return completion.then(
    (completed) => {
      if (authority.status !== "live" || authority.current !== lifetime) {
        return terminalCompletion(completed, authority.snapshot);
      }
      if (authority.pendingNavigation !== undefined || completed.status === "navigated") {
        transitionToPendingSurface(authority);
      } else {
        invalidateSurface(authority, lifetime, "action-turn");
      }
      return terminalCompletion(completed, authority.snapshot);
    },
    () =>
      Object.freeze({
        status: "disposed",
        turnId: "",
        snapshot: authority.snapshot ?? null,
      }),
  );
}

function requestMatchesIntent(
  request: RuntimeAdapterEventTurnRequest,
  active: ActiveBinding,
): boolean {
  const intent = active.intent;
  if (
    request.runtimeInstanceId !== active.snapshot.runtimeInstanceId ||
    request.capabilityId !== intent.capabilityId ||
    request.capabilityKind !== intent.kind ||
    canonicalizeJson(request.item) !== canonicalizeJson(intent.scope.aliases) ||
    canonicalizeJson(request.repeatKeys) !== canonicalizeJson(intent.scope.repeatKeys)
  ) {
    return false;
  }
  return intent.kind === "component"
    ? request.handler.kind === "component" &&
        request.handler.sourceNodeId === intent.sourceNodeId &&
        request.handler.eventName in intent.handlers
    : request.handler.kind === "behavior" &&
        request.handler.sourceNodeId === intent.sourceNodeId &&
        request.handler.behaviorId === intent.behaviorId &&
        request.handler.eventName in intent.handlers;
}

function dispatchPreparedEvent(
  authority: HeadlessSessionAuthority,
  request: RuntimeAdapterEventTurnRequest,
): Readonly<{ readonly status: "accepted" | "rejected" }> {
  const lifetime = authority.current;
  const graph = authority.retainedGraph;
  if (
    authority.status !== "live" ||
    lifetime === undefined ||
    graph === undefined ||
    request.documentId !== graph.bundle.id ||
    request.revision !== graph.bundle.revision ||
    request.surfaceId !== lifetime.definition.surfaceId
  ) {
    return Object.freeze({ status: "rejected" });
  }
  const active = lifetime.bindings.get(request.runtimeInstanceId);
  if (active === undefined || !requestMatchesIntent(request, active)) {
    return Object.freeze({ status: "rejected" });
  }
  const key =
    request.handler.kind === "component"
      ? componentSelectorKey(request.handler.sourceNodeId, request.handler.eventName)
      : behaviorSelectorKey(
          request.handler.sourceNodeId,
          request.handler.behaviorId,
          request.handler.eventName,
        );
  const program = lifetime.definition.programs.get(key);
  if (program === undefined) return Object.freeze({ status: "rejected" });
  const resolution = currentResolutionSnapshot(
    authority,
    lifetime,
    { status: "available", value: request.payload },
    request.item,
  );
  if (resolution === undefined) return Object.freeze({ status: "rejected" });
  const admitted = executeRuntimeActionTurn(lifetime.turnsHandle, {
    program,
    snapshot: resolution,
  });
  if (admitted.status !== "started" && admitted.status !== "queued") {
    return Object.freeze({ status: "rejected" });
  }
  const completion = observedTurnCompletion(authority, lifetime, admitted.completion);
  if (authority.activeDispatch !== undefined) {
    authority.activeDispatch.admission = admitted;
    authority.activeDispatch.completion = completion;
  }
  return Object.freeze({ status: "accepted" });
}

function transitionToPendingSurface(authority: HeadlessSessionAuthority): boolean {
  const target = authority.pendingNavigation;
  const previous = authority.current;
  const graph = authority.retainedGraph;
  if (
    target === undefined ||
    previous === undefined ||
    graph === undefined ||
    authority.status !== "live" ||
    authority.transitioning
  ) {
    return false;
  }
  authority.pendingNavigation = undefined;
  if (
    authority.transitionCount >= authority.limits.maxSurfaceTransitions ||
    authority.nextSnapshotGeneration > authority.limits.maxSnapshotGeneration
  ) {
    disposeSessionAuthority(authority);
    return false;
  }
  const definition = graph.definitions.get(target);
  if (definition === undefined) {
    disposeSessionAuthority(authority);
    return false;
  }
  authority.transitioning = true;
  const previousSnapshot = authority.snapshot;
  const built = buildSurface(authority, definition);
  if (built === undefined) {
    if (
      SESSION_AUTHORITIES.get(authority.handle) !== authority ||
      authority.retainedGraph === undefined
    ) {
      authority.current = undefined;
      authority.snapshot = undefined;
      authority.transitioning = false;
      if (!authority.cleanupPending.includes(previous)) {
        authority.cleanupPending.push(previous);
      }
      completeDeferredSessionCleanup(authority, true);
      return false;
    }
    authority.current = previous;
    authority.snapshot = previousSnapshot;
    authority.transitioning = false;
    disposeSessionAuthority(authority);
    return false;
  }
  authority.transitionCount += 1;
  authority.activatedSurfaces += 1;
  authority.transitioning = false;
  if (!disposeCompleteSurface(previous)) {
    authority.cleanupPending.push(previous);
    disposeSessionAuthority(authority);
    return false;
  }
  for (const settlement of built.initialResourceSettlements) {
    observeResourceSettlement(authority, built.lifetime, settlement);
  }
  return true;
}

function completeDeferredSessionCleanup(
  authority: HeadlessSessionAuthority,
  scheduleRetry: boolean,
): boolean {
  while (authority.cleanupPending.length > 0) {
    const pending = authority.cleanupPending[0] as SurfaceLifetime;
    if (!disposeCompleteSurface(pending)) break;
    authority.cleanupPending.shift();
  }
  if (authority.cleanupPending.length === 0) return true;
  if (scheduleRetry && !authority.cleanupScheduled) {
    authority.cleanupScheduled = true;
    void Promise.resolve().then(() => {
      authority.cleanupScheduled = false;
      completeDeferredSessionCleanup(authority, false);
    });
  }
  return false;
}

function disposeSessionAuthority(authority: HeadlessSessionAuthority): void {
  if (authority.status === "revoked") {
    completeDeferredSessionCleanup(authority, true);
    return;
  }
  authority.status = "revoked";
  const current = authority.current;
  authority.current = undefined;
  authority.pendingNavigation = undefined;
  authority.activeDispatch = undefined;
  authority.snapshot = undefined;
  authority.hostOwner.current = undefined;
  authority.retainedGraph = undefined;
  if (current !== undefined && !authority.cleanupPending.includes(current)) {
    authority.cleanupPending.push(current);
  }
  SESSION_AUTHORITIES.set(
    authority.handle,
    Object.freeze({
      status: "disposed",
      activatedSurfaces: authority.activatedSurfaces,
    }),
  );
  scheduleSessionNotification(authority);
  completeDeferredSessionCleanup(authority, true);
}

/**
 * Validates unknown Catalog and Bundle ingress, verifies the exact Bundle revision, and mounts the
 * entry surface through one authenticated T06–T15 composition.
 *
 * @remarks The function creates exactly one reactive host aggregate and passes that same object to
 * resource, operation, action, and reactive managers. Every source handler is bounded and prepared
 * before the first adapter binding becomes live. A materialized plan is published only when T15's
 * evaluation identifier and both commitment digests authenticate its private sidecar.
 *
 * Every generic operation or resource settlement completed by T13 schedules a stale-safe
 * whole-surface publication after the recursive settlement drain. No operation name, frozen
 * example, or application-specific handler is privileged by the composition.
 */
export function mountRuntimeHeadlessSession(
  input: RuntimeHeadlessSessionMountInput,
): RuntimeHeadlessSessionMountResult {
  const captured = captureMountInput(input);
  if (captured === undefined) return invalidMount("malformed-input");

  let catalogs: ReturnType<typeof validateDesenExecutionCatalogSet>;
  try {
    catalogs = validateDesenExecutionCatalogSet(captured.catalogs);
  } catch {
    return invalidMount("catalog-invalid");
  }
  if (!catalogs.valid) {
    return invalidMount(
      "catalog-invalid",
      catalogs.diagnostics as readonly DesenDiagnostic<string>[],
    );
  }

  let validated: ReturnType<typeof validateDesenBundleExecutionContracts>;
  try {
    validated = validateDesenBundleExecutionContracts(captured.bundle, catalogs.value);
  } catch {
    return invalidMount("bundle-invalid");
  }
  if (!validated.valid) {
    return invalidMount(
      "bundle-invalid",
      validated.diagnostics as readonly DesenDiagnostic<string>[],
    );
  }
  const bundle = validated.value;
  let calculatedRevision: string;
  try {
    calculatedRevision = calculateDesenBundleRevision(bundle);
  } catch {
    return invalidMount("bundle-invalid");
  }
  if (bundle.revision !== calculatedRevision) return invalidMount("revision-mismatch");
  if (
    typeof bundle.entry !== "string" ||
    !LOCAL_IDENTIFIER_PATTERN.test(bundle.entry) ||
    !Object.hasOwn(bundle.surfaces, bundle.entry)
  ) {
    return invalidMount("entry-invalid");
  }
  const definitions = prepareDefinitions(bundle, captured.limits);
  if (definitions === undefined || !definitions.has(bundle.entry)) {
    return invalidMount("composition-failed");
  }

  const handle = Object.freeze({}) as RuntimeHeadlessSessionHandle;
  const hostOwner: { current: HeadlessSessionAuthority | undefined } = { current: undefined };
  let hostPorts: RuntimeReactiveHostPorts;
  try {
    hostPorts = createSharedHostPorts(captured.hostPorts, hostOwner);
  } catch {
    return invalidMount("malformed-input");
  }
  const authority: HeadlessSessionAuthority = {
    status: "mounting",
    retainedGraph: Object.freeze({
      bundle,
      catalogSet: catalogs.value,
      hostPorts,
      definitions,
    }),
    hostOwner,
    snapshotOwner: Object.freeze({}),
    limits: captured.limits,
    handle,
    current: undefined,
    snapshot: undefined,
    nextSnapshotGeneration: 0,
    transitionCount: 0,
    activatedSurfaces: 0,
    pendingNavigation: undefined,
    activeDispatch: undefined,
    transitioning: false,
    cleanupPending: [],
    cleanupScheduled: false,
    observedSettlements: new WeakSet(),
    subscriptions: new Set(),
    notificationScheduled: false,
  };
  hostOwner.current = authority;
  SESSION_AUTHORITIES.set(handle, authority);
  const definition = definitions.get(bundle.entry) as SurfaceDefinition;
  const built = buildSurface(authority, definition);
  if (built === undefined || authority.snapshot === undefined) {
    disposeSessionAuthority(authority);
    return invalidMount("materialization-failed");
  }
  authority.status = "live";
  authority.activatedSurfaces = 1;
  for (const settlement of built.initialResourceSettlements) {
    observeResourceSettlement(authority, built.lifetime, settlement);
  }
  return Object.freeze({
    status: "mounted",
    handle,
    snapshot: authority.snapshot,
    catalogSet: catalogs.value,
  });
}

/** Reads the exact current pure-JSON observation without invoking host or adapter effects. */
export function readRuntimeHeadlessSession(
  handle: RuntimeHeadlessSessionHandle,
): RuntimeHeadlessSessionReadResult {
  if (typeof handle !== "object" || handle === null) {
    return Object.freeze({ status: "invalid-handle" });
  }
  const authority = SESSION_AUTHORITIES.get(handle);
  if (authority === undefined) return Object.freeze({ status: "invalid-handle" });
  if (authority.status === "disposed" || authority.status === "revoked") {
    return Object.freeze({ status: "disposed" });
  }
  if (authority.status !== "live" || authority.snapshot === undefined) {
    return Object.freeze({ status: "disposed" });
  }
  return Object.freeze({ status: "read", snapshot: authority.snapshot });
}

/**
 * Authenticates an exact current session snapshot and its exact retained execution Catalog set for
 * one synchronous framework-adapter preflight.
 *
 * @remarks Authentication is reference-based and intentionally narrower than session ownership:
 * it neither validates receiving values nor grants event, command, attachment, or lower-manager
 * authority. Consumers must authenticate again after a session notification and live operations
 * must cross their own dedicated authority seams.
 *
 * A live/disposed handle check occurs before reflecting over caller input. The session authority
 * is then rechecked after exact own-data capture so a hostile Proxy that disposes the session or
 * publishes another snapshot during reflection cannot authenticate stale authority. No Catalog
 * member, schema, metadata, or callback is read or returned.
 */
export function authenticateRuntimeHeadlessSessionAdapterAuthority(
  handle: RuntimeHeadlessSessionHandle,
  input: RuntimeHeadlessSessionAdapterAuthorityInput,
): RuntimeHeadlessSessionAdapterAuthorityResult {
  if (typeof handle !== "object" || handle === null) {
    return Object.freeze({ status: "invalid-handle" });
  }
  const authority = SESSION_AUTHORITIES.get(handle);
  if (authority === undefined) return Object.freeze({ status: "invalid-handle" });
  if (
    authority.status !== "live" ||
    authority.snapshot === undefined ||
    authority.retainedGraph === undefined
  ) {
    return Object.freeze({ status: "disposed" });
  }

  const captured = captureAdapterAuthorityInput(input);
  const current = SESSION_AUTHORITIES.get(handle);
  if (
    current !== authority ||
    current.status !== "live" ||
    current.snapshot === undefined ||
    current.retainedGraph === undefined
  ) {
    return Object.freeze({ status: "disposed" });
  }
  if (captured === undefined) return Object.freeze({ status: "malformed-request" });
  const currentSnapshot = current.snapshot;
  if (
    typeof captured.snapshot !== "object" ||
    captured.snapshot === null ||
    captured.snapshot !== currentSnapshot ||
    SESSION_SNAPSHOTS.get(captured.snapshot) !== current.snapshotOwner
  ) {
    return Object.freeze({ status: "invalid-snapshot", snapshot: currentSnapshot });
  }
  if (captured.catalogSet !== current.retainedGraph.catalogSet) {
    return Object.freeze({ status: "invalid-catalog-set" });
  }
  return Object.freeze({ status: "authenticated", snapshot: currentSnapshot });
}

/**
 * Subscribes to future headless-session snapshot changes without performing an initial callback.
 *
 * @remarks Notifications are receiver-independent, argument-free, and deferred until after the
 * publishing runtime stack unwinds. A listener must call {@link readRuntimeHeadlessSession} to
 * obtain the exact current snapshot. Multiple synchronous publications may coalesce into one
 * notice, which matches React `useSyncExternalStore` semantics because the snapshot read, not the
 * callback count, defines observable state. Listener exceptions are contained independently.
 */
export function subscribeRuntimeHeadlessSession(
  handle: RuntimeHeadlessSessionHandle,
  listener: RuntimeHeadlessSessionListener,
): RuntimeHeadlessSessionSubscribeResult {
  if (typeof handle !== "object" || handle === null) {
    return Object.freeze({ status: "invalid-handle" });
  }
  if (typeof listener !== "function") return Object.freeze({ status: "invalid-listener" });
  const authority = SESSION_AUTHORITIES.get(handle);
  if (authority === undefined) return Object.freeze({ status: "invalid-handle" });
  if (authority.status === "disposed" || authority.status === "revoked") {
    return Object.freeze({ status: "disposed" });
  }
  if (authority.status !== "live" || authority.snapshot === undefined) {
    return Object.freeze({ status: "disposed" });
  }
  if (authority.subscriptions.size >= authority.limits.maxSubscriptions) {
    return Object.freeze({ status: "subscription-limit" });
  }
  const subscription = Object.freeze({}) as RuntimeHeadlessSessionSubscription;
  const subscriptionAuthority: SessionSubscriptionAuthority = {
    status: "live",
    owner: authority,
    subscription,
    listener,
    observedSnapshot: authority.snapshot,
  };
  authority.subscriptions.add(subscriptionAuthority);
  SESSION_SUBSCRIPTIONS.set(subscription, subscriptionAuthority);
  return Object.freeze({ status: "subscribed", subscription });
}

/**
 * Idempotently revokes one factory-created headless-session subscription.
 *
 * @remarks Revocation is safe from inside the listener itself and cancels a queued notification
 * that has not yet selected the subscription. Foreign objects never affect a live session.
 */
export function unsubscribeRuntimeHeadlessSession(
  subscription: RuntimeHeadlessSessionSubscription,
): RuntimeHeadlessSessionUnsubscribeResult {
  if (typeof subscription !== "object" || subscription === null) {
    return Object.freeze({ status: "invalid-subscription" });
  }
  const authority = SESSION_SUBSCRIPTIONS.get(subscription);
  if (authority === undefined) return Object.freeze({ status: "invalid-subscription" });
  if (authority.status === "revoked") {
    return Object.freeze({ status: "already-unsubscribed" });
  }
  revokeSessionSubscription(authority);
  return Object.freeze({ status: "unsubscribed" });
}

/**
 * Authenticates one exact current materialized binding through T14 and admits its preprepared
 * handler to T13 against all seven current resolution namespaces.
 */
export function dispatchRuntimeHeadlessSessionEvent(
  handle: RuntimeHeadlessSessionHandle,
  input: RuntimeHeadlessSessionEventInput,
): RuntimeHeadlessSessionEventResult {
  if (typeof handle !== "object" || handle === null) {
    return Object.freeze({ status: "invalid-handle" });
  }
  const authority = SESSION_AUTHORITIES.get(handle);
  if (authority === undefined) return Object.freeze({ status: "invalid-handle" });
  if (authority.status === "disposed" || authority.status === "revoked") {
    return Object.freeze({ status: "disposed" });
  }
  const captured = captureEventInput(input);
  if (captured === undefined) return Object.freeze({ status: "malformed-request" });
  if (
    authority.snapshot === undefined ||
    captured.snapshot !== authority.snapshot ||
    SESSION_SNAPSHOTS.get(captured.snapshot) !== authority.snapshotOwner
  ) {
    return authority.snapshot === undefined
      ? Object.freeze({ status: "disposed" })
      : Object.freeze({ status: "invalid-snapshot", snapshot: authority.snapshot });
  }
  const lifetime = authority.current;
  if (authority.status !== "live" || lifetime === undefined) {
    return Object.freeze({ status: "disposed" });
  }
  const reactive = readRuntimeReactiveReevaluation(lifetime.reactiveHandle);
  if (
    reactive.status !== "read" ||
    reactive.snapshot !== lifetime.reactiveSnapshot ||
    reactive.snapshot.evaluationId !== captured.snapshot.evaluationId
  ) {
    disposeSessionAuthority(authority);
    return Object.freeze({ status: "disposed" });
  }
  const active = lifetime.bindings.get(captured.runtimeInstanceId);
  if (active === undefined) return Object.freeze({ status: "unknown-binding" });
  if (authority.activeDispatch !== undefined) {
    return Object.freeze({ status: "rejected", reason: "turn-rejected" });
  }
  const pending: PendingDispatch = { admission: undefined, completion: undefined };
  authority.activeDispatch = pending;
  let received: ReturnType<typeof receiveRuntimeAdapterEvent>;
  try {
    received = receiveRuntimeAdapterEvent(lifetime.bridgeHandle, {
      ticket: active.ticket,
      eventName: captured.eventName,
      payload: captured.payload,
      snapshot: lifetime.bridgeSnapshot,
    });
  } catch {
    if (authority.activeDispatch === pending) authority.activeDispatch = undefined;
    completeDeferredSessionCleanup(authority, false);
    if (SESSION_AUTHORITIES.get(handle) !== authority || authority.retainedGraph === undefined) {
      return Object.freeze({ status: "disposed" });
    }
    return Object.freeze({ status: "rejected", reason: "invalid-event" });
  }
  completeDeferredSessionCleanup(authority, false);
  if (SESSION_AUTHORITIES.get(handle) !== authority || authority.retainedGraph === undefined) {
    return Object.freeze({ status: "disposed" });
  }
  if (
    received.status === "dispatched" &&
    pending.admission !== undefined &&
    pending.completion !== undefined
  ) {
    const completion = pending.completion.finally(() => {
      if (authority.activeDispatch === pending) authority.activeDispatch = undefined;
      completeDeferredSessionCleanup(authority, true);
    });
    pending.completion = completion;
    return Object.freeze({
      status: "dispatched",
      eventId: received.eventId,
      completion,
    });
  }
  if (authority.activeDispatch === pending) authority.activeDispatch = undefined;
  if (received.status === "validated-unhandled") {
    return Object.freeze({ status: "rejected", reason: "unhandled-event" });
  }
  if (received.status === "payload-invalid") {
    return Object.freeze({ status: "rejected", reason: "payload-invalid" });
  }
  if (received.status === "unknown-event") {
    return Object.freeze({ status: "rejected", reason: "invalid-event" });
  }
  if (received.status === "event-limit") {
    return Object.freeze({ status: "rejected", reason: "event-limit" });
  }
  if (received.status === "stale-ticket" || received.status === "invalid-snapshot") {
    return Object.freeze({ status: "rejected", reason: "stale-binding" });
  }
  if (received.status === "turn-rejected" || received.status === "bridge-failed") {
    return Object.freeze({ status: "rejected", reason: "turn-rejected" });
  }
  return Object.freeze({
    status: "rejected",
    reason: received.status === "disposed" ? "stale-binding" : "invalid-event",
  });
}

/**
 * Terminally revokes T15, then T14, then T13, and leaves only an inert session tombstone.
 *
 * @remarks A reentrant request made from an active T14 event or T13-host callback revokes public
 * session authority immediately, then completes the still-ordered T14/T13 cleanup after that
 * synchronous callback unwinds. A busy lower disposal is retained as pending cleanup, never
 * treated as completed.
 */
export function disposeRuntimeHeadlessSession(
  handle: RuntimeHeadlessSessionHandle,
): RuntimeHeadlessSessionDisposeResult {
  if (typeof handle !== "object" || handle === null) {
    return Object.freeze({ status: "invalid-handle", activatedSurfaces: 0 });
  }
  const authority = SESSION_AUTHORITIES.get(handle);
  if (authority === undefined) {
    return Object.freeze({ status: "invalid-handle", activatedSurfaces: 0 });
  }
  if (authority.status === "disposed") {
    return Object.freeze({ status: "already-disposed", activatedSurfaces: 0 });
  }
  if (authority.status === "revoked") {
    return Object.freeze({ status: "already-disposed", activatedSurfaces: 0 });
  }
  const activatedSurfaces = authority.activatedSurfaces;
  disposeSessionAuthority(authority);
  return Object.freeze({ status: "disposed", activatedSurfaces });
}
