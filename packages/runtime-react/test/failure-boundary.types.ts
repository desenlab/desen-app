import {
  RuntimeReactSurfaceBoundary,
  ignoreRuntimeReactRootCaughtError,
  type RuntimeReactAdapterFailure,
  type RuntimeReactComponentAdapterFailure,
  type RuntimeReactRenderResult,
  type RuntimeReactRootCaughtErrorHandler,
  type RuntimeReactSurfaceBoundaryProps,
  type RuntimeReactSurfaceFailure,
  type RuntimeReactSurfaceFailureRenderer,
  type RuntimeReactUnattributedAdapterFailure,
} from "../src/index.js";
import type { RootOptions } from "react-dom/client";

declare const result: RuntimeReactRenderResult;
declare const failure: RuntimeReactSurfaceFailure;
declare const adapterFailure: RuntimeReactAdapterFailure;

const renderer: RuntimeReactSurfaceFailureRenderer = (observed) => {
  if (observed.kind === "adapter") {
    const code: "ADAPTER_FAILURE" = observed.failure.code;
    const kind: "component" | null = observed.failure.adapterKind;
    void code;
    void kind;
  } else if (observed.kind === "render") {
    void observed.failure.code;
  } else {
    void observed.reason;
  }
  return null;
};

const props: RuntimeReactSurfaceBoundaryProps = {
  result,
  renderFailure: renderer,
  recoveryKey: "host-authorized-retry-1",
};

RuntimeReactSurfaceBoundary(props);
const rootCaughtErrorHandler: NonNullable<RootOptions["onCaughtError"]> =
  ignoreRuntimeReactRootCaughtError;
const publicCaughtErrorHandler: RuntimeReactRootCaughtErrorHandler =
  ignoreRuntimeReactRootCaughtError;
void failure;
void adapterFailure;
void rootCaughtErrorHandler;
void publicCaughtErrorHandler;

if (adapterFailure.adapterKind === "component") {
  const componentFailure: RuntimeReactComponentAdapterFailure = adapterFailure;
  const behaviorId: null = componentFailure.behaviorId;
  void behaviorId;
} else {
  const unattributedFailure: RuntimeReactUnattributedAdapterFailure = adapterFailure;
  const runtimeNodeId: null = unattributedFailure.runtimeNodeId;
  void runtimeNodeId;
}

// @ts-expect-error The host must supply an explicit failure renderer.
const missingRenderer: RuntimeReactSurfaceBoundaryProps = { result };

// @ts-expect-error The failure renderer receives no raw thrown value.
void adapterFailure.error;

// @ts-expect-error The failure renderer receives no stack.
void adapterFailure.stack;

// @ts-expect-error The failure renderer receives no raw cause.
void adapterFailure.cause;

// @ts-expect-error React component stacks are not part of the public diagnostic.
void adapterFailure.componentStack;

// @ts-expect-error Adapter failures use one closed protocol code.
const guessedCode: RuntimeReactAdapterFailure["code"] = "UNKNOWN_COMPONENT_CAPABILITY";

// @ts-expect-error Adapter kind is closed.
const guessedKind: RuntimeReactAdapterFailure["adapterKind"] = "fallback";

// @ts-expect-error Failure identity is immutable.
adapterFailure.sourceNodeId = "changed";

const guessedFallback: RuntimeReactSurfaceBoundaryProps = {
  result,
  renderFailure: renderer,
  // @ts-expect-error A guessed placeholder component is not a boundary policy input.
  fallbackComponent: () => null,
};

void missingRenderer;
void guessedCode;
void guessedKind;
void guessedFallback;
