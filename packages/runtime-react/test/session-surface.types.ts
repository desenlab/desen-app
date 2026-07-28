import { useRuntimeReactSessionSurface } from "../src/session-surface.js";

import type {
  RuntimeHeadlessSessionHandle,
  RuntimeHeadlessSessionSnapshot,
} from "@desen/runtime-core";
import type {
  RuntimeReactSessionSurfaceFailure,
  RuntimeReactSessionSurfaceFailureReason,
  RuntimeReactSessionSurfaceInput,
  RuntimeReactSessionSurfaceReady,
  RuntimeReactSessionSurfaceResult,
} from "../src/session-surface.js";

declare const session: RuntimeHeadlessSessionHandle;
declare const snapshot: RuntimeHeadlessSessionSnapshot;
declare const result: RuntimeReactSessionSurfaceResult;
declare const ready: RuntimeReactSessionSurfaceReady;
declare const failed: RuntimeReactSessionSurfaceFailure;

const input: RuntimeReactSessionSurfaceInput = { session, serverSnapshot: snapshot };
const reason: RuntimeReactSessionSurfaceFailureReason = "subscription-limit";

function observeSessionSurface(): RuntimeReactSessionSurfaceResult {
  const observed = useRuntimeReactSessionSurface(input);
  if (observed.status === "ready") {
    const exactSnapshot: RuntimeHeadlessSessionSnapshot = observed.snapshot;
    void exactSnapshot;
  } else {
    const controlledReason: RuntimeReactSessionSurfaceFailureReason = observed.reason;
    void controlledReason;
  }
  return observed;
}

if (result.status === "ready") {
  const exactSnapshot: RuntimeHeadlessSessionSnapshot = result.snapshot;
  void exactSnapshot;
} else {
  const controlledFailure: RuntimeReactSessionSurfaceFailure = result;
  void controlledFailure;
}

// @ts-expect-error The controlled result discriminator is immutable.
ready.status = "failed";
// @ts-expect-error Exact runtime snapshots remain immutable through the React hook.
ready.snapshot.generation = 2;
// @ts-expect-error Failure classifications are immutable.
failed.reason = "disposed";
// @ts-expect-error A host must provide the exact server snapshot channel.
const missingServerSnapshot: RuntimeReactSessionSurfaceInput = { session };
const executableInput: RuntimeReactSessionSurfaceInput = {
  session,
  serverSnapshot: snapshot,
  // @ts-expect-error Session-surface input has no document-selectable render callback.
  render: () => null,
};
const forgedInput: RuntimeReactSessionSurfaceInput = {
  // @ts-expect-error Reconstructed structural session handles cannot satisfy opaque authority.
  session: {},
  serverSnapshot: snapshot,
};
// @ts-expect-error Failure reasons are a closed classification.
const unknownReason: RuntimeReactSessionSurfaceFailureReason = "unknown";

void executableInput;
void forgedInput;
void missingServerSnapshot;
void observeSessionSurface;
void reason;
void unknownReason;
