import {
  createRuntimeNodeIdentity,
  mountRuntimeSurfaceState,
  readRuntimeSurfaceState,
  reconcileRuntimeNodeIdentity,
  writeRuntimeSurfaceState,
} from "../src/index.js";

import type {
  RuntimeNodeIdentity,
  RuntimeNodeIdentityDescriptor,
  RuntimeSurfaceStateHandle,
  RuntimeSurfaceStateEntrySpec,
  RuntimeSurfaceStateMountInput,
  RuntimeSurfaceStateSnapshot,
  RuntimeSurfaceStateWriteResult,
} from "../src/index.js";

const input: RuntimeSurfaceStateMountInput = {
  surfaceId: "main",
  state: {
    count: {
      schema: { type: "integer" },
      initial: 0,
    },
  },
};
const mounted = mountRuntimeSurfaceState(input);
if (mounted.status === "mounted") {
  const handle: RuntimeSurfaceStateHandle = mounted.handle;
  const snapshot: RuntimeSurfaceStateSnapshot = mounted.snapshot;
  const result: RuntimeSurfaceStateWriteResult = writeRuntimeSurfaceState(handle, {
    path: "count",
    value: 1,
  });
  void [snapshot, result, readRuntimeSurfaceState(handle)];

  // @ts-expect-error snapshots are recursively readonly
  snapshot.values.count = 2;
}

const callbackEntry: RuntimeSurfaceStateEntrySpec = {
  schema: {},
  // @ts-expect-error state values are JSON, never executable callbacks
  initial: () => 1,
};
void callbackEntry;

// @ts-expect-error opaque handles cannot be constructed by shape
const forgedHandle: RuntimeSurfaceStateHandle = { surfaceId: "main" };
void forgedHandle;

const descriptor: RuntimeNodeIdentityDescriptor = {
  documentId: "com.desen.app",
  surfaceId: "main",
  nodeId: "main.root",
  use: "com.desen.ui/Stack",
};

// @ts-expect-error opaque node identities cannot be constructed by shape
const forgedIdentity: RuntimeNodeIdentity = {
  key: '["com.desen.app","main","main.root"]',
  documentId: "com.desen.app",
  surfaceId: "main",
  nodeId: "main.root",
  use: "com.desen.ui/Stack",
  mountGeneration: 0,
};
void forgedIdentity;
const created = createRuntimeNodeIdentity(descriptor);
if (created.status === "created") {
  const identity: RuntimeNodeIdentity = created.identity;
  const reconciliation = reconcileRuntimeNodeIdentity(identity, descriptor);
  void reconciliation;

  // @ts-expect-error node identities are immutable
  identity.nodeId = "other";
}

createRuntimeNodeIdentity({
  ...descriptor,
  // @ts-expect-error revision is deliberately absent from base node identity
  revision: `sha256:${"a".repeat(64)}`,
});

createRuntimeNodeIdentity({
  ...descriptor,
  // @ts-expect-error repeat-key discrimination belongs to M04-T07
  repeatKey: "row-1",
});
