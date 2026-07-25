import { mountRuntimeSurfaceResources, refreshRuntimeSurfaceResource } from "../src/index.js";

import type { DesenValidatedExecutionCatalogSet } from "@desen/validator";
import type {
  RuntimeHostPorts,
  RuntimeResourceLimitProfile,
  RuntimeResourceSettlement,
  RuntimeSurfaceResourceSpec,
  RuntimeSurfaceResourcesHandle,
  RuntimeSurfaceResourcesMountInput,
  RuntimeSurfaceResourcesSnapshot,
} from "../src/index.js";

const catalogSet = {} as DesenValidatedExecutionCatalogSet;
const hostPorts = {} as RuntimeHostPorts;
const limits: RuntimeResourceLimitProfile = { maxActiveTransports: 8 };
// @ts-expect-error resource limit profiles are immutable host policy
limits.maxActiveTransports = 16;

const mountInput: RuntimeSurfaceResourcesMountInput = {
  documentId: "com.desen.app",
  revision: `sha256:${"a".repeat(64)}`,
  surfaceId: "main",
  resources: {
    stores: {
      use: "com.example.stores/list",
      input: {},
      policy: "mount",
    },
  },
  catalogSet,
  hostPorts,
};

const mounted = mountRuntimeSurfaceResources(mountInput);
if (mounted.status === "mounted") {
  const handle: RuntimeSurfaceResourcesHandle = mounted.handle;
  const snapshot: RuntimeSurfaceResourcesSnapshot = mounted.snapshot;
  void [handle, snapshot];

  // @ts-expect-error resource lifecycle maps are recursively readonly
  snapshot.lifecycles.stores = { status: "idle", pending: false };

  // @ts-expect-error refresh always requires the current factory-created resolution snapshot
  refreshRuntimeSurfaceResource(handle, { instanceId: "stores" });
}

const executableInput: RuntimeSurfaceResourceSpec = {
  use: "com.example.stores/list",
  input: {
    // @ts-expect-error resource inputs are inert ValueSpecs, never callbacks
    region: () => "eu",
  },
  policy: "mount",
};
void executableInput;

const unknownPolicy: RuntimeSurfaceResourceSpec = {
  use: "com.example.stores/list",
  input: {},
  // @ts-expect-error resource policies use the frozen closed vocabulary
  policy: "network-first",
};
void unknownPolicy;

const callerDefinedContract: RuntimeSurfaceResourcesMountInput = {
  ...mountInput,
  resources: {
    stores: {
      use: "com.example.stores/list",
      input: {},
      policy: "mount",
      // @ts-expect-error public errors come only from the authenticated Catalog contract
      publicErrorCodes: ["unavailable"],
    },
  },
};
void callerDefinedContract;

// @ts-expect-error opaque resource handles cannot be constructed by shape
const forgedHandle: RuntimeSurfaceResourcesHandle = {};
void forgedHandle;

const settlement = {} as RuntimeResourceSettlement;
// @ts-expect-error resource settlements are immutable
settlement.status = "succeeded";

mountRuntimeSurfaceResources({
  ...mountInput,
  // @ts-expect-error resource managers allocate request identifiers internally
  requestId: "caller-controlled",
});
