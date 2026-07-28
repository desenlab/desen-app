import { useMemo, useSyncExternalStore } from "react";

import {
  readRuntimeHeadlessSession,
  subscribeRuntimeHeadlessSession,
  unsubscribeRuntimeHeadlessSession,
} from "@desen/runtime-core";

import type {
  RuntimeHeadlessSessionHandle,
  RuntimeHeadlessSessionSnapshot,
  RuntimeHeadlessSessionSubscription,
} from "@desen/runtime-core";

/**
 * Stable reason why a React session surface cannot expose a live runtime snapshot.
 *
 * @remarks `subscription-limit` is a commit-time admission failure. The remaining session
 * classifications may be observed either during render-time reading or commit-time subscription.
 * No failure retains a prior snapshot, so a terminal or unsubscribed session cannot leave stale
 * managed UI behind.
 */
export type RuntimeReactSessionSurfaceFailureReason =
  | "disposed"
  | "invalid-handle"
  | "invalid-listener"
  | "invalid-server-snapshot"
  | "malformed-input"
  | "subscription-failed"
  | "subscription-limit";

/**
 * Exact host-owned input for observing one headless session from React.
 *
 * @remarks `serverSnapshot` must be the exact current snapshot object returned with `session`.
 * It is used only by React's server-snapshot channel. Bundle or Catalog data cannot provide
 * callbacks, select a store implementation, or widen the subscription authority.
 */
export interface RuntimeReactSessionSurfaceInput {
  /** Opaque factory-created headless-session authority. */
  readonly session: RuntimeHeadlessSessionHandle;
  /** Exact snapshot used by server rendering and hydration. */
  readonly serverSnapshot: RuntimeHeadlessSessionSnapshot;
}

/**
 * Successful exact observation ready for `renderRuntimeReactSurface`.
 *
 * @remarks The wrapper and snapshot are immutable. Repeated reads of the same runtime snapshot
 * return the same wrapper reference, matching React's `useSyncExternalStore` caching contract.
 */
export interface RuntimeReactSessionSurfaceReady {
  /** Confirms that `snapshot` belongs to the currently observed live session generation. */
  readonly status: "ready";
  /** Exact callback-free runtime snapshot; never a clone or reconstructed equivalent. */
  readonly snapshot: RuntimeHeadlessSessionSnapshot;
}

/**
 * Controlled callback-free failure that never carries a stale session snapshot.
 */
export interface RuntimeReactSessionSurfaceFailure {
  /** Confirms that no managed runtime surface should remain visible. */
  readonly status: "failed";
  /** Closed lifecycle or subscription-admission classification. */
  readonly reason: RuntimeReactSessionSurfaceFailureReason;
}

/**
 * Complete controlled result of observing one runtime session through React.
 *
 * @remarks A ready result can be handed to `renderRuntimeReactSurface` together with the
 * host-retained registry, Catalog set, and limits. Rendering and adapter selection remain outside
 * this hook; protocol documents cannot choose executable callbacks through this result.
 */
export type RuntimeReactSessionSurfaceResult =
  RuntimeReactSessionSurfaceReady | RuntimeReactSessionSurfaceFailure;

interface CapturedInput {
  readonly session: unknown;
  readonly serverSnapshot: unknown;
}

interface RuntimeReactSessionStore {
  readonly getSnapshot: () => RuntimeReactSessionSurfaceResult;
  readonly getServerSnapshot: () => RuntimeReactSessionSurfaceResult;
  readonly subscribe: (listener: () => void) => () => void;
}

const FAILURE_RESULTS = Object.freeze({
  disposed: Object.freeze({ status: "failed", reason: "disposed" }),
  "invalid-handle": Object.freeze({ status: "failed", reason: "invalid-handle" }),
  "invalid-listener": Object.freeze({ status: "failed", reason: "invalid-listener" }),
  "invalid-server-snapshot": Object.freeze({
    status: "failed",
    reason: "invalid-server-snapshot",
  }),
  "malformed-input": Object.freeze({ status: "failed", reason: "malformed-input" }),
  "subscription-failed": Object.freeze({
    status: "failed",
    reason: "subscription-failed",
  }),
  "subscription-limit": Object.freeze({ status: "failed", reason: "subscription-limit" }),
} satisfies Readonly<
  Record<RuntimeReactSessionSurfaceFailureReason, RuntimeReactSessionSurfaceFailure>
>);

const NOOP = (): void => undefined;

function failure(
  reason: RuntimeReactSessionSurfaceFailureReason,
): RuntimeReactSessionSurfaceFailure {
  return FAILURE_RESULTS[reason];
}

function ready(snapshot: RuntimeHeadlessSessionSnapshot): RuntimeReactSessionSurfaceReady {
  return Object.freeze({ status: "ready", snapshot });
}

function captureInput(input: RuntimeReactSessionSurfaceInput): CapturedInput | undefined {
  try {
    if (input === null || typeof input !== "object" || Array.isArray(input)) return undefined;
    const prototype = Object.getPrototypeOf(input);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    const keys = Reflect.ownKeys(input);
    if (
      keys.length !== 2 ||
      !keys.includes("session") ||
      !keys.includes("serverSnapshot") ||
      keys.some((key) => typeof key !== "string")
    ) {
      return undefined;
    }
    const session = Object.getOwnPropertyDescriptor(input, "session");
    const serverSnapshot = Object.getOwnPropertyDescriptor(input, "serverSnapshot");
    if (
      session === undefined ||
      serverSnapshot === undefined ||
      !session.enumerable ||
      !serverSnapshot.enumerable ||
      !("value" in session) ||
      !("value" in serverSnapshot)
    ) {
      return undefined;
    }
    return Object.freeze({
      session: session.value,
      serverSnapshot: serverSnapshot.value,
    });
  } catch {
    return undefined;
  }
}

function safeRead(
  session: unknown,
):
  | Readonly<{ readonly status: "read"; readonly snapshot: RuntimeHeadlessSessionSnapshot }>
  | Readonly<{ readonly status: "disposed" | "invalid-handle" }> {
  try {
    return readRuntimeHeadlessSession(session as RuntimeHeadlessSessionHandle);
  } catch {
    return Object.freeze({ status: "invalid-handle" });
  }
}

function notify(listener: () => void): void {
  try {
    Reflect.apply(listener, undefined, []);
  } catch {
    // React owns this callback. A hostile replacement still cannot widen or retain core authority.
  }
}

function createMalformedStore(): RuntimeReactSessionStore {
  const result = failure("malformed-input");
  return Object.freeze({
    getSnapshot: () => result,
    getServerSnapshot: () => result,
    subscribe: () => NOOP,
  });
}

function createSessionStore(session: unknown, serverSnapshot: unknown): RuntimeReactSessionStore {
  const initial = safeRead(session);
  let terminalFailure: RuntimeReactSessionSurfaceFailure | undefined;
  let current: RuntimeReactSessionSurfaceResult;
  let serverResult: RuntimeReactSessionSurfaceResult;
  if (initial.status === "read") {
    current = ready(initial.snapshot);
    serverResult =
      initial.snapshot === serverSnapshot ? current : failure("invalid-server-snapshot");
  } else {
    current = failure(initial.status);
    serverResult = current;
  }

  const observeCurrent = (): RuntimeReactSessionSurfaceResult => {
    if (terminalFailure !== undefined) return terminalFailure;
    const observed = safeRead(session);
    if (observed.status !== "read") {
      const next = failure(observed.status);
      current = next;
      return next;
    }
    if (current.status === "ready" && current.snapshot === observed.snapshot) return current;
    const next = ready(observed.snapshot);
    current = next;
    return next;
  };

  const getSnapshot = (): RuntimeReactSessionSurfaceResult => observeCurrent();
  const getServerSnapshot = (): RuntimeReactSessionSurfaceResult => serverResult;

  const subscribe = (listener: () => void): (() => void) => {
    if (terminalFailure !== undefined || current.status === "failed") return NOOP;
    let active = true;
    const onSessionNotice = (): void => {
      if (!active) return;
      const previous = current;
      const next = observeCurrent();
      if (next !== previous) notify(listener);
    };

    let result: ReturnType<typeof subscribeRuntimeHeadlessSession>;
    try {
      result = subscribeRuntimeHeadlessSession(
        session as RuntimeHeadlessSessionHandle,
        onSessionNotice,
      );
    } catch {
      terminalFailure = failure("subscription-failed");
      current = terminalFailure;
      notify(listener);
      return () => {
        active = false;
      };
    }
    if (result.status !== "subscribed") {
      terminalFailure = failure(result.status);
      current = terminalFailure;
      notify(listener);
      return () => {
        active = false;
      };
    }

    const subscription: RuntimeHeadlessSessionSubscription = result.subscription;
    const beforePostAdmissionRead = current;
    const afterPostAdmissionRead = observeCurrent();
    if (afterPostAdmissionRead !== beforePostAdmissionRead) notify(listener);

    return () => {
      if (!active) return;
      active = false;
      try {
        unsubscribeRuntimeHeadlessSession(subscription);
      } catch {
        // The exact React lifetime is already inert; lower cleanup cannot grant new authority.
      }
    };
  };

  return Object.freeze({ getSnapshot, getServerSnapshot, subscribe });
}

/**
 * Observes one exact headless-session snapshot through React's external-store lifecycle.
 *
 * @remarks Reading is render-safe and callback-free. Subscription begins only after React commits,
 * uses one exact factory-created subscription ticket, and revokes that exact ticket during
 * StrictMode replay, session replacement, or unmount. Server rendering and abandoned Suspense
 * work call only the server/read channels and therefore acquire no subscription authority.
 *
 * A session publication reuses the exact snapshot object returned by runtime-core. Disposal,
 * invalid authority, or subscription admission failure replaces the ready result with an explicit
 * failure and never carries the previous snapshot forward.
 */
export function useRuntimeReactSessionSurface(
  input: RuntimeReactSessionSurfaceInput,
): RuntimeReactSessionSurfaceResult {
  const captured = captureInput(input);
  const valid = captured !== undefined;
  const session = captured?.session;
  const serverSnapshot = captured?.serverSnapshot;
  const store = useMemo(
    () => (valid ? createSessionStore(session, serverSnapshot) : createMalformedStore()),
    [serverSnapshot, session, valid],
  );
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}
