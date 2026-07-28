import { Component, Fragment, createContext, createElement, useContext } from "react";

import type { ReactElement, ReactNode } from "react";
import type { RuntimeReactDiagnosticIdentity } from "./registry.js";

/** Identity-linked classification for one trusted component adapter failure. */
export interface RuntimeReactComponentAdapterFailure {
  readonly code: "ADAPTER_FAILURE";
  readonly adapterKind: "component";
  readonly runtimeNodeId: string;
  readonly sourceNodeId: string;
  readonly capabilityId: string;
  readonly behaviorId: null;
}

/**
 * Conservative classification for an adapter/descendant lifetime failure whose exact origin
 * React does not expose.
 *
 * @remarks Every identity field is null by design. A host can show a safe whole-surface failure
 * without falsely blaming the nearest still-mounted ancestor adapter.
 */
export interface RuntimeReactUnattributedAdapterFailure {
  readonly code: "ADAPTER_FAILURE";
  readonly adapterKind: null;
  readonly runtimeNodeId: null;
  readonly sourceNodeId: null;
  readonly capabilityId: null;
  readonly behaviorId: null;
}

/** Redacted adapter failure delivered to an explicit host-owned failure policy. */
export type RuntimeReactAdapterFailure =
  RuntimeReactComponentAdapterFailure | RuntimeReactUnattributedAdapterFailure;

interface RuntimeReactAdapterFailurePolicy {
  readonly renderFailure: (failure: RuntimeReactAdapterFailure) => ReactNode;
}

interface RuntimeReactAdapterFailurePolicyProviderProps {
  readonly policy: RuntimeReactAdapterFailurePolicy;
  readonly children?: ReactNode;
}

interface RuntimeReactAdapterExceptionBoundaryProps {
  readonly adapterKind: "component" | "behavior";
  readonly identity: RuntimeReactDiagnosticIdentity;
  readonly behaviorId: string | null;
  readonly canAttributeRawError: boolean;
  readonly children?: ReactNode;
}

type RuntimeReactAdapterExceptionBoundaryState =
  | Readonly<{ readonly status: "ready" }>
  | Readonly<{ readonly status: "captured" }>
  | Readonly<{
      readonly status: "classified";
      readonly error: RuntimeReactClassifiedAdapterThrow | RuntimeReactUnattributedManagedTreeThrow;
    }>
  | Readonly<{
      readonly status: "propagating";
      readonly error:
        | RuntimeReactClassifiedAdapterThrow
        | RuntimeReactFailureRendererThrow
        | RuntimeReactUnattributedManagedTreeThrow;
    }>;

type RuntimeReactFailureRendererGuardState =
  | Readonly<{ readonly status: "ready" }>
  | Readonly<{
      readonly status: "failed";
      readonly error: RuntimeReactFailureRendererThrow;
    }>;

const READY_ADAPTER_STATE = Object.freeze({
  status: "ready",
}) as RuntimeReactAdapterExceptionBoundaryState;
const READY_FAILURE_RENDERER_STATE = Object.freeze({
  status: "ready",
}) as RuntimeReactFailureRendererGuardState;
const AdapterFailurePolicyContext = createContext<RuntimeReactAdapterFailurePolicy | null>(null);
const CLASSIFIED_ADAPTER_THROWS = new WeakSet<object>();
const FAILURE_RENDERER_THROWS = new WeakSet<object>();
const UNATTRIBUTED_MANAGED_TREE_THROWS = new WeakSet<object>();

/**
 * Private fresh carrier that lets a classified adapter failure cross surrounding adapter wrappers
 * without being attributed again. It deliberately retains no raw thrown value.
 */
class RuntimeReactClassifiedAdapterThrow extends Error {
  public constructor(public readonly failure: RuntimeReactAdapterFailure) {
    super("A DESEN React adapter failed.");
    this.name = "RuntimeReactClassifiedAdapterThrow";
    CLASSIFIED_ADAPTER_THROWS.add(this);
  }
}

/**
 * Private fresh carrier for a host failure-renderer exception.
 *
 * The original value is retained only as the standard host-visible `cause`; it is never branded
 * or placed in a global identity set. Reusing the same value later in an adapter therefore cannot
 * bypass adapter-failure redaction. Keeping the carrier intact also lets nested DESEN surfaces
 * cross every managed adapter boundary without blaming an ancestor adapter.
 */
class RuntimeReactFailureRendererThrow extends Error {
  public constructor(original: unknown) {
    super("The host-owned DESEN failure renderer threw.", { cause: original });
    this.name = "RuntimeReactFailureRendererThrow";
    FAILURE_RENDERER_THROWS.add(this);
  }
}

/**
 * Private redacted carrier for a raw error whose exact origin React cannot expose safely.
 *
 * A non-leaf adapter boundary can receive a descendant's removal error. Guessing that the parent
 * adapter threw would create false diagnostics, so this carrier deliberately has no identity and
 * can only become a whole-surface managed-tree failure.
 */
class RuntimeReactUnattributedManagedTreeThrow extends Error {
  public constructor() {
    super("A DESEN-managed React tree failed without safe adapter attribution.");
    this.name = "RuntimeReactUnattributedManagedTreeThrow";
    UNATTRIBUTED_MANAGED_TREE_THROWS.add(this);
  }
}

function isClassifiedAdapterThrow(error: unknown): error is RuntimeReactClassifiedAdapterThrow {
  return (
    ((typeof error === "object" && error !== null) || typeof error === "function") &&
    CLASSIFIED_ADAPTER_THROWS.has(error)
  );
}

function isFailureRendererThrow(error: unknown): error is RuntimeReactFailureRendererThrow {
  return (
    ((typeof error === "object" && error !== null) || typeof error === "function") &&
    FAILURE_RENDERER_THROWS.has(error)
  );
}

function isUnattributedManagedTreeThrow(
  error: unknown,
): error is RuntimeReactUnattributedManagedTreeThrow {
  return (
    ((typeof error === "object" && error !== null) || typeof error === "function") &&
    UNATTRIBUTED_MANAGED_TREE_THROWS.has(error)
  );
}

function createComponentAdapterFailure(
  props: RuntimeReactAdapterExceptionBoundaryProps,
): RuntimeReactComponentAdapterFailure {
  return Object.freeze({
    code: "ADAPTER_FAILURE",
    adapterKind: "component",
    runtimeNodeId: props.identity.runtimeNodeId,
    sourceNodeId: props.identity.sourceNodeId,
    capabilityId: props.identity.capabilityId,
    behaviorId: null,
  });
}

/** Shared immutable payload for a safely unattributed whole-surface adapter failure. */
export const RUNTIME_REACT_UNATTRIBUTED_ADAPTER_FAILURE: RuntimeReactUnattributedAdapterFailure =
  Object.freeze({
    code: "ADAPTER_FAILURE",
    adapterKind: null,
    runtimeNodeId: null,
    sourceNodeId: null,
    capabilityId: null,
    behaviorId: null,
  });

function RuntimeReactFailureRendererInvocation({
  renderFailure,
}: {
  readonly renderFailure: () => ReactNode;
}): ReactElement {
  return createElement(Fragment, null, renderFailure());
}

/**
 * Brands host failure-UI errors before they can cross another managed adapter boundary.
 *
 * @internal The private carrier is intentionally not unwrapped by nested DESEN surfaces.
 */
class RuntimeReactFailureRendererGuard extends Component<
  Readonly<{ readonly renderFailure: () => ReactNode }>,
  RuntimeReactFailureRendererGuardState
> {
  public override state: RuntimeReactFailureRendererGuardState = READY_FAILURE_RENDERER_STATE;

  public static getDerivedStateFromError(error: unknown): RuntimeReactFailureRendererGuardState {
    return Object.freeze({
      status: "failed",
      error: isFailureRendererThrow(error) ? error : new RuntimeReactFailureRendererThrow(error),
    });
  }

  public override render(): ReactNode {
    if (this.state.status === "failed") throw this.state.error;
    return createElement(RuntimeReactFailureRendererInvocation, this.props);
  }
}

/**
 * Converts only this adapter's raw render/commit exception into an identity-linked private
 * carrier. Already classified child failures and host-renderer failures pass through unchanged.
 */
class RuntimeReactAdapterExceptionBoundary extends Component<
  RuntimeReactAdapterExceptionBoundaryProps,
  RuntimeReactAdapterExceptionBoundaryState
> {
  public override state: RuntimeReactAdapterExceptionBoundaryState = READY_ADAPTER_STATE;

  public static getDerivedStateFromError(
    error: unknown,
  ): RuntimeReactAdapterExceptionBoundaryState {
    if (
      isClassifiedAdapterThrow(error) ||
      isFailureRendererThrow(error) ||
      isUnattributedManagedTreeThrow(error)
    ) {
      return Object.freeze({
        status: "propagating",
        error,
      });
    }
    return Object.freeze({ status: "captured" });
  }

  public override componentDidCatch(error: unknown): void {
    if (
      isClassifiedAdapterThrow(error) ||
      isFailureRendererThrow(error) ||
      isUnattributedManagedTreeThrow(error)
    ) {
      return;
    }
    this.setState(
      Object.freeze({
        status: "classified",
        error:
          this.props.canAttributeRawError && this.props.adapterKind === "component"
            ? new RuntimeReactClassifiedAdapterThrow(createComponentAdapterFailure(this.props))
            : new RuntimeReactUnattributedManagedTreeThrow(),
      }),
    );
  }

  public override render(): ReactNode {
    if (this.state.status === "propagating" || this.state.status === "classified") {
      throw this.state.error;
    }
    if (this.state.status === "captured") return null;
    return this.props.children;
  }
}

/**
 * Supplies the host-owned failure policy to managed adapter and node boundaries.
 *
 * @internal Bundle and Catalog data never receive or select this executable policy.
 */
export function RuntimeReactAdapterFailurePolicyProvider({
  policy,
  children,
}: RuntimeReactAdapterFailurePolicyProviderProps): ReactElement {
  return createElement(AdapterFailurePolicyContext.Provider, { value: policy }, children);
}

/**
 * Activates a classifier only inside the explicit production surface boundary.
 *
 * @internal Lower-level consumers that render a compiled element without the production boundary
 * receive normal React error propagation rather than an implicit fallback policy.
 */
export function RuntimeReactAdapterFailureBoundary({
  adapterKind,
  identity,
  behaviorId,
  canAttributeRawError,
  children,
}: RuntimeReactAdapterExceptionBoundaryProps): ReactElement {
  const policy = useContext(AdapterFailurePolicyContext);
  if (policy === null) return createElement(Fragment, null, children);
  return createElement(
    RuntimeReactAdapterExceptionBoundary,
    {
      adapterKind,
      identity,
      behaviorId,
      canAttributeRawError,
    },
    children,
  );
}

/**
 * Renders any controlled failure through the same nested-surface-safe host error guard.
 *
 * @remarks Descendant failures are guarded while this boundary remains mounted. Cleanup during
 * removal of the complete React root has no surviving component boundary and remains root policy.
 */
export function RuntimeReactControlledFailureBoundary({
  renderFailure,
}: Readonly<{ readonly renderFailure: () => ReactNode }>): ReactElement {
  return createElement(RuntimeReactFailureRendererGuard, { renderFailure });
}

/** True only for a fresh private host failure-renderer carrier. */
export function isRuntimeReactFailureRendererThrow(error: unknown): boolean {
  return isFailureRendererThrow(error);
}

/** Wraps a raw host failure-renderer cleanup error in one fresh private provenance carrier. */
export function createRuntimeReactFailureRendererThrow(error: unknown): Error {
  return new RuntimeReactFailureRendererThrow(error);
}

/** True only for a redacted managed-tree failure whose exact adapter origin is unavailable. */
export function isRuntimeReactUnattributedManagedTreeThrow(error: unknown): boolean {
  return isUnattributedManagedTreeThrow(error);
}

/** True only for a fresh private identity-linked adapter carrier. */
export function readRuntimeReactClassifiedAdapterFailure(
  error: unknown,
): RuntimeReactAdapterFailure | undefined {
  return isClassifiedAdapterThrow(error) ? error.failure : undefined;
}
