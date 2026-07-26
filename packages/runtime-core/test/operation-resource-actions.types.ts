import {
  disposeRuntimeOperationResourceActions,
  executeRuntimeOperationResourceAction,
  finalizeRuntimeOperationActionSettlement,
  mountRuntimeOperationResourceActions,
  readRuntimeOperationResourceActions,
} from "../src/operation-resource-actions.js";

import type { RuntimeHostPorts } from "../src/host-ports.js";
import type {
  RuntimeSurfaceOperationsHandle,
  RuntimeSurfaceOperationsSnapshot,
} from "../src/operation-lifecycle.js";
import type {
  RuntimeDeferredActionSpec,
  RuntimeOperationActionSettlementDescriptor,
  RuntimeOperationActionSettlementTicket,
  RuntimeOperationInvokeAction,
  RuntimeOperationResourceAction,
  RuntimeOperationResourceActionLimitProfile,
  RuntimeOperationResourceActionResult,
  RuntimeOperationResourceActionsHandle,
  RuntimeOperationResourceActionsMountInput,
  RuntimeOperationResourceActionsReadResult,
  RuntimeResourceRefreshAction,
} from "../src/operation-resource-actions.js";
import type {
  RuntimeSurfaceResourcesHandle,
  RuntimeSurfaceResourcesSnapshot,
} from "../src/resource-lifecycle.js";
import type { RuntimeResolutionSnapshot } from "../src/value-resolution.js";

declare const hostPorts: RuntimeHostPorts;
declare const resourceHandle: RuntimeSurfaceResourcesHandle;
declare const resourceSnapshot: RuntimeSurfaceResourcesSnapshot;
declare const operationHandle: RuntimeSurfaceOperationsHandle;
declare const operationSnapshot: RuntimeSurfaceOperationsSnapshot;
declare const resolutionSnapshot: RuntimeResolutionSnapshot;

const mountInput: RuntimeOperationResourceActionsMountInput = {
  documentId: "com.desen.types",
  revision: `sha256:${"a".repeat(64)}`,
  surfaceId: "sign-in",
  operations: { signIn: { operation: "com.example.auth/signIn" } },
  resourceHandle,
  resourceSnapshot,
  operationHandle,
  operationSnapshot,
  hostPorts,
};
const mounted = mountRuntimeOperationResourceActions(mountInput);
if (mounted.status === "mounted") {
  const handle: RuntimeOperationResourceActionsHandle = mounted.handle;
  const action: RuntimeOperationResourceAction = {
    type: "operation.invoke",
    operation: "com.example.auth/signIn",
    as: "signIn",
    input: {
      email: { $ref: "state.email" },
      password: { $token: "secret" },
    },
    concurrency: "queue",
    onSuccess: [{ type: "navigate", surface: "home" }],
    onFailure: [{ type: "state.set", path: "error", value: true }],
  };
  const result: RuntimeOperationResourceActionResult = executeRuntimeOperationResourceAction(
    handle,
    action,
    resolutionSnapshot,
    resourceSnapshot,
    operationSnapshot,
  );
  const read: RuntimeOperationResourceActionsReadResult =
    readRuntimeOperationResourceActions(handle);
  void [result, read, disposeRuntimeOperationResourceActions(handle)];
}

// @ts-expect-error compositor handles are opaque and cannot be forged structurally
const forgedHandle: RuntimeOperationResourceActionsHandle = {};
void forgedHandle;

// @ts-expect-error compositor reads accept only their opaque action authority
readRuntimeOperationResourceActions({} as RuntimeOperationActionSettlementTicket);

// @ts-expect-error settlement tickets are opaque and cannot be forged structurally
const forgedTicket: RuntimeOperationActionSettlementTicket = {};
void forgedTicket;

// @ts-expect-error operation actions require the operation capability assertion
const missingOperation: RuntimeOperationInvokeAction = {
  type: "operation.invoke",
  as: "signIn",
  input: {},
};
void missingOperation;

// @ts-expect-error operation actions require a surface-scoped alias
const missingAlias: RuntimeOperationInvokeAction = {
  type: "operation.invoke",
  operation: "com.example.auth/signIn",
  input: {},
};
void missingAlias;

// @ts-expect-error operation actions require an explicit named input map
const missingInput: RuntimeOperationInvokeAction = {
  type: "operation.invoke",
  operation: "com.example.auth/signIn",
  as: "signIn",
};
void missingInput;

const executableInput: RuntimeOperationInvokeAction = {
  type: "operation.invoke",
  operation: "com.example.auth/signIn",
  as: "signIn",
  input: {
    // @ts-expect-error operation input values are data-only ValueSpecs
    password: () => "secret",
  },
};
void executableInput;

const invalidConcurrency: RuntimeOperationInvokeAction = {
  type: "operation.invoke",
  operation: "com.example.auth/signIn",
  as: "signIn",
  input: {},
  // @ts-expect-error concurrency is the closed reject/replace/queue vocabulary
  concurrency: "parallel",
};
void invalidConcurrency;

const executableHandler: RuntimeOperationInvokeAction = {
  type: "operation.invoke",
  operation: "com.example.auth/signIn",
  as: "signIn",
  input: {},
  onSuccess: [
    {
      type: "event.emit",
      // @ts-expect-error retained settlement actions are inert JSON, never callbacks
      callback: () => undefined,
    },
  ],
};
void executableHandler;

const callerIdentity: RuntimeOperationInvokeAction = {
  type: "operation.invoke",
  operation: "com.example.auth/signIn",
  as: "signIn",
  input: {},
  // @ts-expect-error request identity is runtime-owned
  requestId: "caller-owned",
};
void callerIdentity;

const closedOperation: RuntimeOperationInvokeAction = {
  type: "operation.invoke",
  operation: "com.example.auth/signIn",
  as: "signIn",
  input: {},
  // @ts-expect-error arbitrary action fields must live inside extensions
  arbitrary: true,
};
void closedOperation;

// @ts-expect-error resource.refresh requires an exact resource instance identifier
const missingResource: RuntimeResourceRefreshAction = {
  type: "resource.refresh",
};
void missingResource;

const resourceWithHandler: RuntimeResourceRefreshAction = {
  type: "resource.refresh",
  resource: "stores",
  // @ts-expect-error resource.refresh has no settlement handler members
  onSuccess: [],
};
void resourceWithHandler;

const resourceWithInput: RuntimeResourceRefreshAction = {
  type: "resource.refresh",
  resource: "stores",
  // @ts-expect-error resource.refresh always reuses the declaration's current resolved input
  input: {},
};
void resourceWithInput;

// @ts-expect-error mount requires the exact current resource snapshot
const incompleteMount: RuntimeOperationResourceActionsMountInput = {
  documentId: "com.desen.types",
  revision: `sha256:${"a".repeat(64)}`,
  surfaceId: "sign-in",
  operations: {},
  resourceHandle,
  operationHandle,
  operationSnapshot,
  hostPorts,
};
void incompleteMount;

const wrongHandleKinds: RuntimeOperationResourceActionsMountInput = {
  ...mountInput,
  // @ts-expect-error an operation handle cannot occupy the resource-authority slot
  resourceHandle: operationHandle,
  // @ts-expect-error a resource handle cannot occupy the operation-authority slot
  operationHandle: resourceHandle,
};
void wrongHandleKinds;

const invalidLimits: RuntimeOperationResourceActionLimitProfile = {
  // @ts-expect-error limit profiles are closed and cannot invent a semantic ceiling
  maxRetries: 3,
};
void invalidLimits;

declare const deferredActions: readonly RuntimeDeferredActionSpec[];
// @ts-expect-error captured settlement action arrays are immutable
deferredActions.push({});

declare const result: RuntimeOperationResourceActionResult;
// @ts-expect-error public action results are immutable
result.status = "busy";

declare const settlement: RuntimeOperationActionSettlementDescriptor;
// @ts-expect-error mapped settlements never expose the raw T09 lease
void settlement.lease;
// @ts-expect-error settlement descriptors are immutable
settlement.actions = [];

finalizeRuntimeOperationActionSettlement(
  forgedHandle,
  // @ts-expect-error finalization accepts only the opaque T11 ticket
  operationHandle,
);

executeRuntimeOperationResourceAction(
  forgedHandle,
  // @ts-expect-error the primitive executes one action, never a caller-owned action array
  [{ type: "resource.refresh", resource: "stores" }],
  resolutionSnapshot,
  resourceSnapshot,
  operationSnapshot,
);

// @ts-expect-error internal settlement finalization is absent from the package root API
import { finalizeRuntimeOperationActionSettlement as leakedFinalizer } from "../src/index.js";
void leakedFinalizer;

// @ts-expect-error composition-root reads remain package-internal until M04-T16
import { readRuntimeOperationResourceActions as leakedRead } from "../src/index.js";
void leakedRead;
