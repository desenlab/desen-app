import {
  disposeRuntimeStateNavigationActions,
  executeRuntimeStateNavigationAction,
  mountRuntimeStateNavigationActions,
} from "../src/index.js";

import type {
  RuntimeHostPorts,
  RuntimeNavigateAction,
  RuntimeResolutionSnapshot,
  RuntimeStateNavigationAction,
  RuntimeStateNavigationActionResult,
  RuntimeStateNavigationActionsHandle,
  RuntimeStateNavigationActionsMountInput,
  RuntimeStateSetAction,
  RuntimeSurfaceStateHandle,
  RuntimeSurfaceStateSnapshot,
} from "../src/index.js";

declare const hostPorts: RuntimeHostPorts;
declare const stateHandle: RuntimeSurfaceStateHandle;
declare const stateSnapshot: RuntimeSurfaceStateSnapshot;
declare const resolutionSnapshot: RuntimeResolutionSnapshot;

const mountInput: RuntimeStateNavigationActionsMountInput = {
  documentId: "com.desen.types",
  revision: `sha256:${"a".repeat(64)}`,
  surfaceId: "home",
  surfaceIds: ["home", "settings"],
  stateHandle,
  stateSnapshot,
  hostPorts,
};
const mounted = mountRuntimeStateNavigationActions(mountInput);
if (mounted.status === "mounted") {
  const handle: RuntimeStateNavigationActionsHandle = mounted.handle;
  const action: RuntimeStateNavigationAction = {
    type: "state.set",
    path: "count",
    value: { $ref: "state.count", fallback: 0 },
    when: { op: "gte", args: [{ $ref: "state.count" }, 0] },
    extensions: { "com.example/audit": true },
  };
  const result: RuntimeStateNavigationActionResult = executeRuntimeStateNavigationAction(
    handle,
    action,
    resolutionSnapshot,
    stateSnapshot,
  );
  void [result, disposeRuntimeStateNavigationActions(handle)];
}

// @ts-expect-error action executor handles are opaque and cannot be forged structurally
const forgedHandle: RuntimeStateNavigationActionsHandle = {};
void forgedHandle;

const callbackValue: RuntimeStateSetAction = {
  type: "state.set",
  path: "count",
  // @ts-expect-error action values are data-only ValueSpecs, never executable callbacks
  value: () => 1,
};
void callbackValue;

const callbackParams: RuntimeNavigateAction = {
  type: "navigate",
  surface: "settings",
  params: {
    // @ts-expect-error navigation params are named ValueSpecs, never callbacks
    onReady: () => undefined,
  },
};
void callbackParams;

const callerOwnedIdentity: RuntimeNavigateAction = {
  type: "navigate",
  surface: "settings",
  // @ts-expect-error request identities are runtime-owned and absent from action data
  requestId: "caller-controlled",
};
void callerOwnedIdentity;

const extraActionField: RuntimeStateSetAction = {
  type: "state.set",
  path: "count",
  value: 1,
  // @ts-expect-error action shapes are closed except for the explicit extensions object
  arbitrary: true,
};
void extraActionField;

const invalidGuard: RuntimeStateSetAction = {
  type: "state.set",
  path: "count",
  value: 1,
  when: {
    // @ts-expect-error arbitrary expression operators are not part of the predicate union
    op: "execute-javascript",
    args: [],
  },
};
void invalidGuard;

executeRuntimeStateNavigationAction(
  forgedHandle,
  // @ts-expect-error action arrays belong to the later turn manager, not the one-action primitive
  [{ type: "state.toggle", path: "enabled" }],
  resolutionSnapshot,
  stateSnapshot,
);

// @ts-expect-error mount requires the exact current state snapshot
const incompleteMount: RuntimeStateNavigationActionsMountInput = {
  documentId: "com.desen.types",
  revision: `sha256:${"a".repeat(64)}`,
  surfaceId: "home",
  surfaceIds: ["home"],
  stateHandle,
  hostPorts,
};
void incompleteMount;

declare const immutableResult: RuntimeStateNavigationActionResult;
// @ts-expect-error public action results are immutable
immutableResult.status = "busy";

declare const immutableSnapshot: RuntimeSurfaceStateSnapshot;
// @ts-expect-error state snapshots supplied to the executor remain recursively readonly
immutableSnapshot.values.count = 2;

// @ts-expect-error the common evaluation seam is package-internal and absent from the root API
import type { RuntimeActionEvaluationSession } from "../src/index.js";
declare const hiddenSession: RuntimeActionEvaluationSession;
void hiddenSession;
