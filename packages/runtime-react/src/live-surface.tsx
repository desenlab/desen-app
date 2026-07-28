import { useMemo } from "react";

import { renderRuntimeReactSurface } from "./render-plan.js";
import { useRuntimeReactSessionSurface } from "./session-surface.js";

import type {
  RuntimeHeadlessSessionHandle,
  RuntimeHeadlessSessionSnapshot,
} from "@desen/runtime-core";
import type { DesenValidatedExecutionCatalogSet } from "@desen/validator";
import type { RuntimeReactAdapterRegistryHandle } from "./registry.js";
import type {
  RuntimeReactRenderFailure,
  RuntimeReactRenderedSurface,
  RuntimeReactRenderLimitProfile,
} from "./render-plan.js";
import type {
  RuntimeReactSessionSurfaceFailureReason,
  RuntimeReactSessionSurfaceInput,
} from "./session-surface.js";

/**
 * Complete host-owned authority needed to keep one authenticated React surface live.
 *
 * @remarks The session and `serverSnapshot` establish the external-store lifetime. The registry,
 * exact Catalog set, and optional lower-only limits remain host inputs to each authenticated
 * render compilation; Bundle content cannot select callbacks or replace them.
 */
export interface RuntimeReactLiveSurfaceInput {
  readonly registry: RuntimeReactAdapterRegistryHandle;
  readonly session: RuntimeHeadlessSessionHandle;
  readonly serverSnapshot: RuntimeHeadlessSessionSnapshot;
  readonly catalogSet: DesenValidatedExecutionCatalogSet;
  readonly limits?: RuntimeReactRenderLimitProfile;
}

/** Controlled reason why a live React surface is absent. */
export type RuntimeReactLiveSurfaceFailure =
  | Readonly<{
      /** Session observation failed before an authenticated render could be produced. */
      readonly kind: "session";
      readonly reason: RuntimeReactSessionSurfaceFailureReason;
    }>
  | Readonly<{
      /** The exact observed snapshot failed the all-or-nothing renderer preflight. */
      readonly kind: "render";
      readonly failure: RuntimeReactRenderFailure;
    }>;

/**
 * Complete result of observing and compiling one live React surface.
 *
 * @remarks Failure and diagnostic metadata is callback-free. A successful result deliberately
 * carries the authenticated React element tree.
 */
export type RuntimeReactLiveSurfaceResult =
  | Readonly<{
      readonly status: "rendered";
      readonly surface: RuntimeReactRenderedSurface;
    }>
  | Readonly<{
      readonly status: "failed";
      readonly failure: RuntimeReactLiveSurfaceFailure;
    }>;

interface CapturedLiveInput {
  readonly registry: unknown;
  readonly session: unknown;
  readonly serverSnapshot: unknown;
  readonly catalogSet: unknown;
  readonly limits: unknown;
}

const MALFORMED_SESSION_INPUT = Object.freeze({}) as unknown as RuntimeReactSessionSurfaceInput;

function captureLiveInput(input: RuntimeReactLiveSurfaceInput): CapturedLiveInput | undefined {
  try {
    if (input === null || typeof input !== "object" || Array.isArray(input)) return undefined;
    const prototype = Object.getPrototypeOf(input);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    const required = ["registry", "session", "serverSnapshot", "catalogSet"];
    const optional = ["limits"];
    const keys = Reflect.ownKeys(input);
    if (
      required.some((name) => !keys.includes(name)) ||
      keys.some(
        (key) => typeof key !== "string" || (!required.includes(key) && !optional.includes(key)),
      )
    ) {
      return undefined;
    }
    const captured: Record<string, unknown> = Object.create(null);
    for (const key of keys) {
      if (typeof key !== "string") return undefined;
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
        return undefined;
      }
      captured[key] = descriptor.value;
    }
    return Object.freeze({
      registry: captured.registry,
      session: captured.session,
      serverSnapshot: captured.serverSnapshot,
      catalogSet: captured.catalogSet,
      limits: captured.limits,
    });
  } catch {
    return undefined;
  }
}

/**
 * Keeps one authenticated headless session rendered through React's external-store lifecycle.
 *
 * @remarks Runtime publication is observed exclusively through runtime-core's read, subscribe,
 * and unsubscribe seam. Subscription begins only after commit; SSR and abandoned Suspense work
 * acquire none. Every exact successor snapshot is re-authenticated with the same host-retained
 * Catalog set and registry before a new element tree is returned. Session and render failures are
 * explicit and carry no previous surface, so this hook never guesses a placeholder or leaves stale
 * managed UI visible.
 */
export function useRuntimeReactSurface(
  input: RuntimeReactLiveSurfaceInput,
): RuntimeReactLiveSurfaceResult {
  const captured = captureLiveInput(input);
  const observed = useRuntimeReactSessionSurface(
    captured === undefined
      ? MALFORMED_SESSION_INPUT
      : {
          session: captured.session as RuntimeHeadlessSessionHandle,
          serverSnapshot: captured.serverSnapshot as RuntimeHeadlessSessionSnapshot,
        },
  );

  return useMemo(() => {
    if (observed.status === "failed") {
      return Object.freeze({
        status: "failed",
        failure: Object.freeze({
          kind: "session",
          reason: observed.reason,
        }),
      });
    }
    if (captured === undefined) {
      return Object.freeze({
        status: "failed",
        failure: Object.freeze({
          kind: "session",
          reason: "malformed-input",
        }),
      });
    }
    const rendered = renderRuntimeReactSurface({
      registry: captured.registry as RuntimeReactAdapterRegistryHandle,
      session: captured.session as RuntimeHeadlessSessionHandle,
      snapshot: observed.snapshot,
      catalogSet: captured.catalogSet as DesenValidatedExecutionCatalogSet,
      ...(captured.limits === undefined
        ? {}
        : { limits: captured.limits as RuntimeReactRenderLimitProfile }),
    });
    if (rendered.status === "failed") {
      return Object.freeze({
        status: "failed",
        failure: Object.freeze({
          kind: "render",
          failure: rendered.failure,
        }),
      });
    }
    return Object.freeze({
      status: "rendered",
      surface: rendered.surface,
    });
  }, [captured?.catalogSet, captured?.limits, captured?.registry, captured?.session, observed]);
}
