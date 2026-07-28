import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import {
  authenticateRuntimeHeadlessSessionAdapterAuthority,
  authenticateRuntimeHeadlessSessionHostAuthority,
  disposeRuntimeHeadlessSession,
} from "@desen/runtime-core";
import {
  authenticateRuntimeWebHostDocumentAuthority,
  disposeRuntimeWebHostAuthority,
  readRuntimeWebHostAuthority,
} from "@desen/runtime-web";
import { readRuntimeReactAdapterRegistry } from "@desen/runtime-react";

import { ReferenceHostApplication } from "./application.js";
import {
  authorizeReferenceHostRecovery,
  createReferenceHostRecoveryAuthority,
  disposeReferenceHostRecoveryAuthority,
  observeReferenceHostRecoveryAuthority,
} from "./recovery-authority.js";
import {
  createReferenceHostRootOptions,
  reportReferenceHostRootUnmountFailure,
} from "./root-policy.js";

import type { Root } from "react-dom/client";
import type { RuntimeReactLiveSurfaceInput } from "@desen/runtime-react";
import type { RuntimeWebHostAuthorityHandle } from "@desen/runtime-web";
import type { ReferenceHostRecoveryAuthorityHandle } from "./recovery-authority.js";
import type { ReferenceHostRootDiagnosticReporter } from "./root-policy.js";

declare const REFERENCE_HOST_ROOT_TYPE_BRAND: unique symbol;

/** Opaque authority for one dedicated reference-host React root. */
export interface ReferenceHostRootHandle {
  readonly [REFERENCE_HOST_ROOT_TYPE_BRAND]: true;
}

/** Trusted construction input for one client-only application root. */
export interface ReferenceHostRootCreateInput {
  readonly container: Element;
  readonly reportDiagnostic: ReferenceHostRootDiagnosticReporter;
}

/** Exact authority bundle accepted by the generic root activation seam. */
export interface ReferenceHostSurfaceActivationInput {
  readonly surface: RuntimeReactLiveSurfaceInput;
  readonly hostAuthority: RuntimeWebHostAuthorityHandle;
}

interface ActiveSurface {
  readonly surface: RuntimeReactLiveSurfaceInput;
  readonly hostAuthority: RuntimeWebHostAuthorityHandle;
  readonly recoveryKey: string;
}

interface ReferenceHostRootStateOwner {
  current: ReferenceHostRootState | undefined;
}

interface ReferenceHostRootState {
  readonly root: Root;
  readonly container: Element;
  readonly reporter: ReferenceHostRootDiagnosticReporter;
  readonly recoveryAuthority: ReferenceHostRecoveryAuthorityHandle;
  readonly owner: ReferenceHostRootStateOwner;
  lifecycle: "active" | "transitioning" | "closing";
  current: ActiveSurface | undefined;
}

interface ReferenceHostRootTombstone {
  readonly lifecycle: "disposed";
}

type ReferenceHostRootEntry = ReferenceHostRootState | ReferenceHostRootTombstone;

const ROOTS = new WeakMap<ReferenceHostRootHandle, ReferenceHostRootEntry>();
const CLAIMED_CONTAINERS = new WeakSet<Element>();
const DISPOSED_ROOT = Object.freeze({
  lifecycle: "disposed",
}) as ReferenceHostRootTombstone;

function rootState(handle: ReferenceHostRootHandle): ReferenceHostRootEntry | undefined {
  try {
    return ROOTS.get(handle);
  } catch {
    return undefined;
  }
}

function captureCreateInput(
  input: ReferenceHostRootCreateInput,
): ReferenceHostRootCreateInput | undefined {
  try {
    if (input === null || typeof input !== "object" || Array.isArray(input)) return undefined;
    const keys = Reflect.ownKeys(input);
    if (
      keys.length !== 2 ||
      !keys.includes("container") ||
      !keys.includes("reportDiagnostic") ||
      keys.some((key) => typeof key !== "string")
    ) {
      return undefined;
    }
    const container = Object.getOwnPropertyDescriptor(input, "container");
    const reporter = Object.getOwnPropertyDescriptor(input, "reportDiagnostic");
    if (
      container === undefined ||
      reporter === undefined ||
      container.enumerable !== true ||
      reporter.enumerable !== true ||
      !("value" in container) ||
      !("value" in reporter) ||
      !(container.value instanceof Element) ||
      typeof reporter.value !== "function"
    ) {
      return undefined;
    }
    return Object.freeze({
      container: container.value,
      reportDiagnostic: reporter.value as ReferenceHostRootDiagnosticReporter,
    });
  } catch {
    return undefined;
  }
}

function captureActivationInput(
  input: ReferenceHostSurfaceActivationInput,
): ReferenceHostSurfaceActivationInput | undefined {
  try {
    if (input === null || typeof input !== "object" || Array.isArray(input)) return undefined;
    const keys = Reflect.ownKeys(input);
    if (
      keys.length !== 2 ||
      !keys.includes("surface") ||
      !keys.includes("hostAuthority") ||
      keys.some((key) => typeof key !== "string")
    ) {
      return undefined;
    }
    const surface = Object.getOwnPropertyDescriptor(input, "surface");
    const hostAuthority = Object.getOwnPropertyDescriptor(input, "hostAuthority");
    if (
      surface === undefined ||
      hostAuthority === undefined ||
      surface.enumerable !== true ||
      hostAuthority.enumerable !== true ||
      !("value" in surface) ||
      !("value" in hostAuthority)
    ) {
      return undefined;
    }
    const capturedSurface = captureLiveSurfaceInput(surface.value);
    if (capturedSurface === undefined) return undefined;
    return Object.freeze({
      surface: capturedSurface,
      hostAuthority: hostAuthority.value as RuntimeWebHostAuthorityHandle,
    });
  } catch {
    return undefined;
  }
}

function captureLiveSurfaceInput(value: unknown): RuntimeReactLiveSurfaceInput | undefined {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    const required = ["registry", "session", "serverSnapshot", "catalogSet"];
    const allowed = new Set([...required, "limits"]);
    const keys = Reflect.ownKeys(value);
    if (
      required.some((key) => !keys.includes(key)) ||
      keys.some((key) => typeof key !== "string" || !allowed.has(key))
    ) {
      return undefined;
    }
    const captured: Record<string, unknown> = Object.create(null);
    for (const key of keys) {
      if (typeof key !== "string") return undefined;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || descriptor.enumerable !== true || !("value" in descriptor)) {
        return undefined;
      }
      captured[key] = descriptor.value;
    }
    return Object.freeze({
      registry: captured.registry as RuntimeReactLiveSurfaceInput["registry"],
      session: captured.session as RuntimeReactLiveSurfaceInput["session"],
      serverSnapshot: captured.serverSnapshot as RuntimeReactLiveSurfaceInput["serverSnapshot"],
      catalogSet: captured.catalogSet as RuntimeReactLiveSurfaceInput["catalogSet"],
      ...(captured.limits !== undefined
        ? { limits: captured.limits as NonNullable<RuntimeReactLiveSurfaceInput["limits"]> }
        : {}),
    });
  } catch {
    return undefined;
  }
}

function renderCurrent(handle: ReferenceHostRootHandle, state: ReferenceHostRootState): void {
  const current = state.current;
  state.root.render(
    <StrictMode>
      <ReferenceHostApplication
        state={
          current === undefined
            ? Object.freeze({ status: "booting" })
            : Object.freeze({
                status: "surface",
                input: current.surface,
                recoveryKey: current.recoveryKey,
                onRequestRecovery: () => {
                  authorizeReferenceHostRootRecovery(handle);
                },
              })
        }
      />
    </StrictMode>,
  );
}

function safelyDisposeSession(surface: RuntimeReactLiveSurfaceInput): void {
  try {
    disposeRuntimeHeadlessSession(surface.session);
  } catch {
    // The session is already being terminally abandoned; raw cleanup faults remain unobserved.
  }
}

function terminallyFenceRoot(
  handle: ReferenceHostRootHandle,
  state: ReferenceHostRootState,
  unmount: boolean,
): void {
  if (state.lifecycle === "closing") return;
  state.lifecycle = "closing";
  const current = state.current;
  state.current = undefined;
  state.owner.current = undefined;
  ROOTS.set(handle, DISPOSED_ROOT);

  if (current !== undefined) {
    disposeRuntimeWebHostAuthority(current.hostAuthority);
    safelyDisposeSession(current.surface);
  }

  let unmountConfirmed = false;
  if (unmount) {
    try {
      state.root.unmount();
      unmountConfirmed = true;
    } catch {
      reportReferenceHostRootUnmountFailure(state.reporter);
    }
  }
  disposeReferenceHostRecoveryAuthority(state.recoveryAuthority);

  // A failed or root-callback-triggered unmount leaves the React container state uncertain.
  // Keeping the weak claim prevents a second root from being attached to that same live element.
  if (unmountConfirmed) CLAIMED_CONTAINERS.delete(state.container);
}

/**
 * Creates one client-only dedicated React root and renders host-owned boot infrastructure.
 *
 * @throws TypeError for malformed input or a container already claimed by a live host root.
 */
export function createReferenceHostRoot(
  input: ReferenceHostRootCreateInput,
): ReferenceHostRootHandle {
  const captured = captureCreateInput(input);
  if (captured === undefined) throw new TypeError("Invalid reference-host root input.");
  if (CLAIMED_CONTAINERS.has(captured.container)) {
    throw new TypeError("Reference-host container already has a live root.");
  }

  const handle = Object.freeze({}) as ReferenceHostRootHandle;
  const owner: ReferenceHostRootStateOwner = { current: undefined };
  const root = createRoot(
    captured.container,
    createReferenceHostRootOptions(captured.reportDiagnostic, () => {
      const current = owner.current;
      if (current !== undefined) terminallyFenceRoot(handle, current, false);
    }),
  );
  const state: ReferenceHostRootState = {
    root,
    container: captured.container,
    reporter: captured.reportDiagnostic,
    recoveryAuthority: createReferenceHostRecoveryAuthority(),
    owner,
    lifecycle: "active",
    current: undefined,
  };
  owner.current = state;
  CLAIMED_CONTAINERS.add(captured.container);
  ROOTS.set(handle, state);
  try {
    renderCurrent(handle, state);
  } catch {
    terminallyFenceRoot(handle, state, true);
    throw new TypeError("Reference-host root could not render its boot infrastructure.");
  }
  return handle;
}

/**
 * Activates or explicitly replaces the exact runtime/session authority rendered by one host root.
 */
export function activateReferenceHostSurface(
  handle: ReferenceHostRootHandle,
  input: ReferenceHostSurfaceActivationInput,
):
  | Readonly<{
      readonly status: "activated";
      readonly relationship: "initial" | "preserved" | "replaced";
    }>
  | Readonly<{
      readonly status:
        | "disposed"
        | "incompatible-authority"
        | "invalid-host-authority"
        | "invalid-registry-authority"
        | "invalid-session-authority"
        | "mismatched-host-authority"
        | "invalid-root"
        | "malformed-input"
        | "render-failed"
        | "transition-in-progress";
    }> {
  const state = rootState(handle);
  if (state === undefined) return Object.freeze({ status: "invalid-root" });
  if (state.lifecycle === "disposed" || state.lifecycle === "closing") {
    return Object.freeze({ status: "disposed" });
  }
  if (state.lifecycle === "transitioning") {
    return Object.freeze({ status: "transition-in-progress" });
  }
  state.lifecycle = "transitioning";
  const captured = captureActivationInput(input);
  if (state.lifecycle !== "transitioning") return Object.freeze({ status: "disposed" });
  if (captured === undefined) {
    state.lifecycle = "active";
    return Object.freeze({ status: "malformed-input" });
  }
  const hostRead = readRuntimeWebHostAuthority(captured.hostAuthority);
  if (state.lifecycle !== "transitioning") return Object.freeze({ status: "disposed" });
  if (hostRead.status !== "active") {
    state.lifecycle = "active";
    return Object.freeze({ status: "invalid-host-authority" });
  }
  const hostAuthentication = authenticateRuntimeHeadlessSessionHostAuthority(
    captured.surface.session,
    { hostPorts: hostRead.hostPorts },
  );
  if (state.lifecycle !== "transitioning") return Object.freeze({ status: "disposed" });
  if (hostAuthentication.status !== "authenticated") {
    state.lifecycle = "active";
    return Object.freeze({
      status:
        hostAuthentication.status === "mismatched-host-authority"
          ? "mismatched-host-authority"
          : "invalid-session-authority",
    });
  }
  const surfaceAuthentication = authenticateRuntimeHeadlessSessionAdapterAuthority(
    captured.surface.session,
    {
      snapshot: captured.surface.serverSnapshot,
      catalogSet: captured.surface.catalogSet,
    },
  );
  if (state.lifecycle !== "transitioning") return Object.freeze({ status: "disposed" });
  if (surfaceAuthentication.status !== "authenticated") {
    state.lifecycle = "active";
    return Object.freeze({ status: "invalid-session-authority" });
  }
  const documentAuthentication = authenticateRuntimeWebHostDocumentAuthority(
    captured.hostAuthority,
    {
      documentId: surfaceAuthentication.snapshot.documentId,
      revision: surfaceAuthentication.snapshot.revision,
    },
  );
  if (state.lifecycle !== "transitioning") return Object.freeze({ status: "disposed" });
  if (documentAuthentication.status !== "authenticated") {
    state.lifecycle = "active";
    return Object.freeze({
      status:
        documentAuthentication.status === "mismatched-document-authority"
          ? "mismatched-host-authority"
          : "invalid-host-authority",
    });
  }
  const registryRead = readRuntimeReactAdapterRegistry(captured.surface.registry);
  if (registryRead.status !== "read") {
    state.lifecycle = "active";
    return Object.freeze({ status: "invalid-registry-authority" });
  }

  const previous = state.current;
  const sessionChanged =
    previous !== undefined && previous.surface.session !== captured.surface.session;
  const hostChanged = previous !== undefined && previous.hostAuthority !== captured.hostAuthority;
  if (hostChanged && !sessionChanged) {
    state.lifecycle = "active";
    return Object.freeze({ status: "incompatible-authority" });
  }

  const observed = observeReferenceHostRecoveryAuthority(state.recoveryAuthority, {
    session: captured.surface.session,
    registry: captured.surface.registry,
    catalogSet: captured.surface.catalogSet,
    hostAuthority: captured.hostAuthority,
  });
  if (observed.status !== "observed") {
    state.lifecycle = "active";
    return Object.freeze({ status: "malformed-input" });
  }

  if (previous !== undefined && sessionChanged) {
    state.current = undefined;
    if (hostChanged) disposeRuntimeWebHostAuthority(previous.hostAuthority);
    safelyDisposeSession(previous.surface);
    if (state.lifecycle !== "transitioning") {
      disposeRuntimeWebHostAuthority(captured.hostAuthority);
      safelyDisposeSession(captured.surface);
      return Object.freeze({ status: "disposed" });
    }
  }

  state.current = Object.freeze({
    surface: captured.surface,
    hostAuthority: captured.hostAuthority,
    recoveryKey: observed.snapshot.recoveryKey,
  });
  try {
    renderCurrent(handle, state);
  } catch {
    terminallyFenceRoot(handle, state, true);
    return Object.freeze({ status: "render-failed" });
  }
  if (state.lifecycle !== "transitioning") return Object.freeze({ status: "disposed" });
  state.lifecycle = "active";
  return Object.freeze({
    status: "activated",
    relationship: observed.snapshot.relationship,
  });
}

/** Advances sticky adapter recovery only after an explicit host or user decision. */
export function authorizeReferenceHostRootRecovery(handle: ReferenceHostRootHandle):
  | Readonly<{ readonly status: "authorized" }>
  | Readonly<{
      readonly status:
        "disposed" | "invalid-root" | "render-failed" | "transition-in-progress" | "unavailable";
    }> {
  const state = rootState(handle);
  if (state === undefined) return Object.freeze({ status: "invalid-root" });
  if (state.lifecycle === "disposed" || state.lifecycle === "closing") {
    return Object.freeze({ status: "disposed" });
  }
  if (state.lifecycle === "transitioning") {
    return Object.freeze({ status: "transition-in-progress" });
  }
  if (state.current === undefined) return Object.freeze({ status: "unavailable" });
  state.lifecycle = "transitioning";
  const authorized = authorizeReferenceHostRecovery(state.recoveryAuthority);
  if (authorized.status !== "authorized") {
    state.lifecycle = "active";
    return Object.freeze({ status: authorized.status === "disposed" ? "disposed" : "unavailable" });
  }
  state.current = Object.freeze({
    ...state.current,
    recoveryKey: authorized.recoveryKey,
  });
  try {
    renderCurrent(handle, state);
  } catch {
    terminallyFenceRoot(handle, state, true);
    return Object.freeze({ status: "render-failed" });
  }
  if (state.lifecycle !== "transitioning") return Object.freeze({ status: "disposed" });
  state.lifecycle = "active";
  return Object.freeze({ status: "authorized" });
}

/** Returns inert root lifecycle metadata without retaining runtime or platform authority. */
export function readReferenceHostRoot(handle: ReferenceHostRootHandle):
  | Readonly<{
      readonly status: "active";
      readonly phase: "booting" | "surface";
      readonly recoveryKey: string | null;
    }>
  | Readonly<{ readonly status: "disposed" | "invalid-root" | "transitioning" }> {
  const state = rootState(handle);
  if (state === undefined) return Object.freeze({ status: "invalid-root" });
  if (state.lifecycle === "disposed" || state.lifecycle === "closing") {
    return Object.freeze({ status: "disposed" });
  }
  if (state.lifecycle === "transitioning") return Object.freeze({ status: "transitioning" });
  return Object.freeze({
    status: "active",
    phase: state.current === undefined ? "booting" : "surface",
    recoveryKey: state.current?.recoveryKey ?? null,
  });
}

/**
 * Terminally fences host effects, revokes the headless session, and unmounts the React root.
 *
 * @remarks Cleanup is idempotent. Raw session or React cleanup failures are never inspected or
 * forwarded; an unmount failure produces only one fixed application diagnostic.
 */
export function disposeReferenceHostRoot(
  handle: ReferenceHostRootHandle,
): Readonly<{ readonly status: "disposed" | "already-disposed" | "invalid-root" }> {
  const state = rootState(handle);
  if (state === undefined) return Object.freeze({ status: "invalid-root" });
  if (state.lifecycle === "disposed" || state.lifecycle === "closing") {
    return Object.freeze({ status: "already-disposed" });
  }
  terminallyFenceRoot(handle, state, true);
  return Object.freeze({ status: "disposed" });
}
