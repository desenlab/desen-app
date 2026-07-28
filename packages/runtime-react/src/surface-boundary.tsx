/* eslint-disable @typescript-eslint/no-invalid-void-type -- `this: void` is the deliberate
 * receiver-independent host failure-renderer contract. */
import { Component, Fragment, createElement, useMemo } from "react";

import {
  RUNTIME_REACT_UNATTRIBUTED_ADAPTER_FAILURE,
  RuntimeReactAdapterFailurePolicyProvider,
  RuntimeReactControlledFailureBoundary,
  createRuntimeReactFailureRendererThrow,
  isRuntimeReactFailureRendererThrow,
  readRuntimeReactClassifiedAdapterFailure,
} from "./adapter-error-boundary.js";

import type { ReactElement, ReactNode } from "react";
import type { RuntimeReactAdapterFailure } from "./adapter-error-boundary.js";
import type {
  RuntimeReactLiveSurfaceFailure,
  RuntimeReactLiveSurfaceResult,
} from "./live-surface.js";
import type { RuntimeReactRenderFailure, RuntimeReactRenderResult } from "./render-plan.js";

/** Failure that a production React host must represent using its own trusted UI policy. */
export type RuntimeReactSurfaceFailure =
  | RuntimeReactLiveSurfaceFailure
  | Readonly<{
      /** A trusted adapter or managed adapter lifetime failed after complete preflight. */
      readonly kind: "adapter";
      readonly failure: RuntimeReactAdapterFailure;
    }>;

/**
 * Host-owned renderer for controlled DESEN failures.
 *
 * @remarks This callback is executable application code. It must be statically selected by the
 * host and must never come from a Bundle, Catalog, capability id, dynamic import, or adapter.
 * Returning `null` is an explicit host policy; the runtime supplies no default placeholder.
 * Like every React renderer, it must be pure and may be invoked more than once.
 */
export type RuntimeReactSurfaceFailureRenderer = (
  this: void,
  failure: RuntimeReactSurfaceFailure,
) => ReactNode;

/** Controlled renderer result accepted by the production failure boundary. */
export type RuntimeReactSurfaceBoundaryResult =
  RuntimeReactRenderResult | RuntimeReactLiveSurfaceResult;

/** Complete host-owned policy and controlled surface result for one production boundary. */
export interface RuntimeReactSurfaceBoundaryProps {
  readonly result: RuntimeReactSurfaceBoundaryResult;
  readonly renderFailure: RuntimeReactSurfaceFailureRenderer;
  /**
   * Explicit host-owned recovery epoch for a sticky adapter boundary failure.
   *
   * @remarks Do not derive this from Bundle content or increment it on every publication. Change
   * it only after the host intentionally authorizes one retry, including a trusted session or
   * executable-registry authority replacement. M05-T07 owns that production-host wiring.
   */
  readonly recoveryKey?: string;
}

interface RuntimeReactSurfaceCoordinatorProps {
  readonly result: RuntimeReactSurfaceBoundaryResult;
  readonly renderFailure: RuntimeReactSurfaceFailureRenderer;
  readonly recoveryKey: string | undefined;
  readonly policy: Readonly<{
    readonly renderFailure: (failure: RuntimeReactAdapterFailure) => ReactNode;
  }>;
}

interface RuntimeReactBranchBoundaryState {
  readonly observedRecoveryKey: string | undefined;
  readonly status: "ready" | "captured" | "propagating";
  readonly error: unknown;
}

interface RuntimeReactSurfaceCoordinatorState {
  readonly observedRecoveryKey: string | undefined;
  readonly status: "ready" | "adapter-failed" | "propagating";
  readonly failure: RuntimeReactAdapterFailure | null;
  readonly error: unknown;
}

interface RuntimeReactManagedBranchBoundaryProps {
  readonly active: boolean;
  readonly recoveryKey: string | undefined;
  readonly onFailure: (failure: RuntimeReactAdapterFailure) => void;
  readonly children?: ReactNode;
}

interface RuntimeReactHostBranchBoundaryProps {
  readonly active: boolean;
  readonly recoveryKey: string | undefined;
  readonly children?: ReactNode;
}

const readyBranchState = (recoveryKey: string | undefined): RuntimeReactBranchBoundaryState =>
  Object.freeze({
    observedRecoveryKey: recoveryKey,
    status: "ready",
    error: undefined,
  });

function renderFailureResult(failure: RuntimeReactRenderFailure): RuntimeReactSurfaceFailure {
  return Object.freeze({
    kind: "render",
    failure,
  });
}

function adapterSurfaceFailure(failure: RuntimeReactAdapterFailure): RuntimeReactSurfaceFailure {
  return Object.freeze({
    kind: "adapter",
    failure,
  });
}

function controlledResultFailure(
  result: Extract<RuntimeReactSurfaceBoundaryResult, { readonly status: "failed" }>,
): RuntimeReactSurfaceFailure {
  return "kind" in result.failure ? result.failure : renderFailureResult(result.failure);
}

function guardedHostFailure(
  renderFailure: RuntimeReactSurfaceFailureRenderer,
  failure: RuntimeReactSurfaceFailure,
): ReactElement {
  return createElement(RuntimeReactControlledFailureBoundary, {
    renderFailure: () => renderFailure(failure),
  });
}

/**
 * Always-mounted provenance boundary for the managed DESEN branch.
 *
 * It stays mounted while the managed child is removed, so cleanup exceptions cannot be mistaken
 * for errors thrown by the host's safe failure UI.
 */
class RuntimeReactManagedBranchBoundary extends Component<
  RuntimeReactManagedBranchBoundaryProps,
  RuntimeReactBranchBoundaryState
> {
  public constructor(props: RuntimeReactManagedBranchBoundaryProps) {
    super(props);
    this.state = readyBranchState(props.recoveryKey);
  }

  public static getDerivedStateFromProps(
    props: RuntimeReactManagedBranchBoundaryProps,
    state: RuntimeReactBranchBoundaryState,
  ): RuntimeReactBranchBoundaryState | null {
    return state.observedRecoveryKey === props.recoveryKey
      ? null
      : readyBranchState(props.recoveryKey);
  }

  public static getDerivedStateFromError(error: unknown): Partial<RuntimeReactBranchBoundaryState> {
    if (isRuntimeReactFailureRendererThrow(error)) {
      return Object.freeze({
        status: "propagating",
        error,
      });
    }
    return Object.freeze({
      status: "captured",
      error,
    });
  }

  public override componentDidCatch(error: unknown): void {
    if (isRuntimeReactFailureRendererThrow(error)) return;
    this.props.onFailure(
      readRuntimeReactClassifiedAdapterFailure(error) ?? RUNTIME_REACT_UNATTRIBUTED_ADAPTER_FAILURE,
    );
  }

  public override render(): ReactNode {
    if (this.state.status === "propagating") throw this.state.error;
    if (this.state.status === "captured" || !this.props.active) return null;
    return this.props.children;
  }
}

/**
 * Always-mounted provenance boundary for the host-owned failure branch.
 *
 * While this boundary remains mounted, any render, effect, or branch-transition cleanup error
 * crosses the surrounding application as a fresh host-renderer carrier and can never become
 * `ADAPTER_FAILURE`.
 */
class RuntimeReactHostBranchBoundary extends Component<
  RuntimeReactHostBranchBoundaryProps,
  RuntimeReactBranchBoundaryState
> {
  public constructor(props: RuntimeReactHostBranchBoundaryProps) {
    super(props);
    this.state = readyBranchState(props.recoveryKey);
  }

  public static getDerivedStateFromProps(
    props: RuntimeReactHostBranchBoundaryProps,
    state: RuntimeReactBranchBoundaryState,
  ): RuntimeReactBranchBoundaryState | null {
    return state.observedRecoveryKey === props.recoveryKey
      ? null
      : readyBranchState(props.recoveryKey);
  }

  public static getDerivedStateFromError(error: unknown): Partial<RuntimeReactBranchBoundaryState> {
    return Object.freeze({
      status: "propagating",
      error: isRuntimeReactFailureRendererThrow(error)
        ? error
        : createRuntimeReactFailureRendererThrow(error),
    });
  }

  public override render(): ReactNode {
    if (this.state.status === "propagating") throw this.state.error;
    if (!this.props.active) return null;
    return this.props.children;
  }
}

/**
 * Coordinates mutually exclusive managed and host branches without replacing their provenance
 * boundaries. Whole-surface containment is deliberate: the frozen protocol requires sibling
 * continuation only when isolation is safe, and this profile does not guess that arbitrary React
 * adapter/host-fallback cleanup can be isolated below an ancestor adapter.
 */
class RuntimeReactSurfaceCoordinator extends Component<
  RuntimeReactSurfaceCoordinatorProps,
  RuntimeReactSurfaceCoordinatorState
> {
  public constructor(props: RuntimeReactSurfaceCoordinatorProps) {
    super(props);
    this.state = Object.freeze({
      observedRecoveryKey: props.recoveryKey,
      status: "ready",
      failure: null,
      error: undefined,
    });
  }

  public static getDerivedStateFromProps(
    props: RuntimeReactSurfaceCoordinatorProps,
    state: RuntimeReactSurfaceCoordinatorState,
  ): RuntimeReactSurfaceCoordinatorState | null {
    if (state.observedRecoveryKey === props.recoveryKey) return null;
    return Object.freeze({
      observedRecoveryKey: props.recoveryKey,
      status: "ready",
      failure: null,
      error: undefined,
    });
  }

  public static getDerivedStateFromError(
    error: unknown,
  ): Partial<RuntimeReactSurfaceCoordinatorState> {
    if (isRuntimeReactFailureRendererThrow(error)) {
      return Object.freeze({
        status: "propagating",
        failure: null,
        error,
      });
    }
    return Object.freeze({
      status: "adapter-failed",
      failure:
        readRuntimeReactClassifiedAdapterFailure(error) ??
        RUNTIME_REACT_UNATTRIBUTED_ADAPTER_FAILURE,
      error: undefined,
    });
  }

  private readonly handleManagedFailure = (failure: RuntimeReactAdapterFailure): void => {
    this.setState(
      Object.freeze({
        status: "adapter-failed",
        failure,
        error: undefined,
      }),
    );
  };

  public override render(): ReactNode {
    if (this.state.status === "propagating") throw this.state.error;

    const resultFailure =
      this.state.status === "adapter-failed" && this.state.failure !== null
        ? adapterSurfaceFailure(this.state.failure)
        : this.props.result.status === "failed"
          ? controlledResultFailure(this.props.result)
          : undefined;
    const managedActive = resultFailure === undefined && this.props.result.status === "rendered";
    const managedTree =
      this.props.result.status === "rendered"
        ? createElement(
            RuntimeReactAdapterFailurePolicyProvider,
            { policy: this.props.policy },
            this.props.result.surface.element,
          )
        : null;

    return createElement(
      Fragment,
      null,
      createElement(
        RuntimeReactManagedBranchBoundary,
        {
          active: managedActive,
          recoveryKey: this.props.recoveryKey,
          onFailure: this.handleManagedFailure,
        },
        managedTree,
      ),
      createElement(
        RuntimeReactHostBranchBoundary,
        {
          active: resultFailure !== undefined,
          recoveryKey: this.props.recoveryKey,
        },
        resultFailure === undefined
          ? null
          : guardedHostFailure(this.props.renderFailure, resultFailure),
      ),
    );
  }
}

/**
 * Renders one controlled DESEN result with explicit host failure policy.
 *
 * @remarks Unknown capabilities and all other preflight failures produce only the host-owned
 * failure surface; the previous managed tree is removed. Safely attributable leaf-component
 * exceptions retain exact diagnostic identity. Behavior, non-leaf, and removal-cleanup exceptions
 * use `ADAPTER_FAILURE` with null identity because React exposes no reliable public origin; this
 * whole-surface profile refuses to blame the nearest ancestor or claim unsafe sibling isolation.
 * No generic component or placeholder is ever guessed.
 *
 * Event-handler exceptions, arbitrary asynchronous work, and server rendering remain outside
 * React error boundaries. A host failure-renderer exception crosses managed and nested DESEN
 * boundaries in a fresh private `Error` whose `cause` is the exact host-thrown value while a
 * containing boundary remains mounted. Whole-root unmount cleanup remains root host policy. React
 * root-level caught-error telemetry remains host policy and may see a raw adapter exception before
 * recovery, so production roots must provide a redacting `onCaughtError` handler when raw logging
 * is not acceptable. M05-T07 owns that reference-host wiring.
 */
export function RuntimeReactSurfaceBoundary({
  result,
  renderFailure,
  recoveryKey,
}: RuntimeReactSurfaceBoundaryProps): ReactElement {
  const policy = useMemo(
    () =>
      Object.freeze({
        renderFailure: (failure: RuntimeReactAdapterFailure): ReactNode =>
          renderFailure(adapterSurfaceFailure(failure)),
      }),
    [renderFailure],
  );

  return createElement(RuntimeReactSurfaceCoordinator, {
    result,
    renderFailure,
    recoveryKey,
    policy,
  });
}
