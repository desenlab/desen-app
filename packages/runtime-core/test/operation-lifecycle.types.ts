import {
  acknowledgeRuntimeOperationSettlement,
  invokeRuntimeOperation,
  mountRuntimeSurfaceOperations,
} from "../src/operation-lifecycle.js";

import type { DesenValidatedExecutionCatalogSet } from "@desen/validator";
import type { RuntimeHostPorts } from "../src/host-ports.js";
import type {
  RuntimeOperationLimitProfile,
  RuntimeOperationSettlement,
  RuntimeOperationSettlementLease,
  RuntimeSurfaceOperationsHandle,
  RuntimeSurfaceOperationsMountInput,
  RuntimeSurfaceOperationsSnapshot,
} from "../src/operation-lifecycle.js";

const catalogSet = {} as DesenValidatedExecutionCatalogSet;
const hostPorts = {} as RuntimeHostPorts;
const limits: RuntimeOperationLimitProfile = { maxQueuedInvocations: 8 };
// @ts-expect-error operation limit profiles are immutable trusted host policy
limits.maxQueuedInvocations = 16;

const mountInput: RuntimeSurfaceOperationsMountInput = {
  documentId: "com.desen.app",
  revision: `sha256:${"a".repeat(64)}`,
  surfaceId: "main",
  aliases: {
    signIn: { operation: "com.example.auth/signIn" },
  },
  catalogSet,
  hostPorts,
};

const mounted = mountRuntimeSurfaceOperations(mountInput);
if (mounted.status === "mounted") {
  const handle: RuntimeSurfaceOperationsHandle = mounted.handle;
  const snapshot: RuntimeSurfaceOperationsSnapshot = mounted.snapshot;
  void [handle, snapshot];

  // @ts-expect-error operation lifecycle maps are recursively readonly
  snapshot.lifecycles.signIn = { status: "idle", pending: false };

  invokeRuntimeOperation(handle, {
    alias: "signIn",
    operation: "com.example.auth/signIn",
    input: {},
    operationSnapshot: snapshot,
    // @ts-expect-error concurrency is the closed DESEN 0.1.0 vocabulary
    concurrency: "parallel",
  });

  invokeRuntimeOperation(handle, {
    alias: "signIn",
    operation: "com.example.auth/signIn",
    input: {
      // @ts-expect-error operation input candidates are inert JSON, never callbacks
      execute: () => "secret",
    },
    operationSnapshot: snapshot,
  });

  // @ts-expect-error every invocation must assert the protocol action's operation capability
  invokeRuntimeOperation(handle, {
    alias: "signIn",
    input: {},
    operationSnapshot: snapshot,
  });

  invokeRuntimeOperation(handle, {
    alias: "signIn",
    operation: "com.attacker/replace",
    input: {},
    operationSnapshot: snapshot,
  });
}

const callerContract: RuntimeSurfaceOperationsMountInput = {
  ...mountInput,
  aliases: {
    signIn: {
      operation: "com.example.auth/signIn",
      // @ts-expect-error effects come only from the authenticated Catalog contract
      effect: "none",
    },
  },
};
void callerContract;

// @ts-expect-error opaque operation handles cannot be constructed by shape
const forgedHandle: RuntimeSurfaceOperationsHandle = {};
void forgedHandle;

// @ts-expect-error opaque settlement leases cannot be constructed by shape
const forgedLease: RuntimeOperationSettlementLease = {};
void forgedLease;

const settlement = {} as RuntimeOperationSettlement;
// @ts-expect-error operation settlements are immutable
settlement.status = "succeeded";

acknowledgeRuntimeOperationSettlement(
  {} as RuntimeSurfaceOperationsHandle,
  {} as RuntimeOperationSettlementLease,
);

mountRuntimeSurfaceOperations({
  ...mountInput,
  // @ts-expect-error operation managers allocate request identifiers internally
  requestId: "caller-controlled",
});
