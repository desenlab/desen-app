import { createRuntimeReactAdapterRegistry } from "../src/registry.js";
import { createRuntimeReactReconciliationKey } from "../src/reconciliation.js";

import type { RuntimeReactComponentAdapterProps } from "../src/registry.js";

function Adapter(props: RuntimeReactComponentAdapterProps) {
  void props;
  return null;
}

const created = createRuntimeReactAdapterRegistry({
  components: [
    {
      capabilityId: "run.desen.test/Adapter",
      component: Adapter,
      remountOnProps: ["mode"],
    },
  ],
});
if (created.status === "created") {
  const policy = created.snapshot.componentReconciliationPolicies[0];
  if (policy !== undefined) {
    // @ts-expect-error Registry policy snapshots are immutable.
    policy.remountOnProps.push("bundle-controlled");
    // @ts-expect-error Snapshot metadata cannot be replaced after capture.
    policy.capabilityId = "run.desen.test/Other";
  }
}

createRuntimeReactAdapterRegistry({
  components: [
    {
      capabilityId: "run.desen.test/Adapter",
      component: Adapter,
      // @ts-expect-error Remount policies contain exact property-name strings only.
      remountOnProps: ["mode", 1],
    },
  ],
});

createRuntimeReactReconciliationKey({
  runtimeNodeId: "node:1",
  capabilityId: "run.desen.test/Adapter",
  props: { mode: "compact" },
  remountOnProps: ["mode"],
});

createRuntimeReactReconciliationKey({
  runtimeNodeId: "node:1",
  capabilityId: "run.desen.test/Adapter",
  // @ts-expect-error Selected props remain inert runtime JSON data.
  props: { executable: () => "not data" },
  remountOnProps: ["mode"],
});

createRuntimeReactReconciliationKey({
  runtimeNodeId: "node:1",
  capabilityId: "run.desen.test/Adapter",
  props: {},
  remountOnProps: [],
  // @ts-expect-error Style is never an input to the reconciliation key.
  style: {},
});
