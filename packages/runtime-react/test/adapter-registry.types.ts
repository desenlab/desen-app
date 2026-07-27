import {
  createRuntimeReactAdapterRegistry,
  readRuntimeReactAdapterRegistry,
  renderRuntimeReactSurface,
} from "../src/index.js";

import type { RuntimeHeadlessSurfacePlan } from "@desen/runtime-core";
import type {
  RuntimeReactAdapterRegistryHandle,
  RuntimeReactComponentCommandPort,
  RuntimeReactComponentAdapterProps,
  RuntimeReactInteractionPort,
} from "../src/index.js";

declare const plan: RuntimeHeadlessSurfacePlan;
declare const foreignHandle: RuntimeReactAdapterRegistryHandle;
declare const interactions: RuntimeReactInteractionPort;
declare const commands: RuntimeReactComponentCommandPort;

function Adapter(props: RuntimeReactComponentAdapterProps) {
  void props;
  return null;
}

const registry = createRuntimeReactAdapterRegistry({
  components: [{ capabilityId: "run.desen.test/Adapter", component: Adapter }],
});
if (registry.status === "created") {
  readRuntimeReactAdapterRegistry(registry.handle);
  renderRuntimeReactSurface({ registry: registry.handle, plan });
}
readRuntimeReactAdapterRegistry(foreignHandle);
const attachment = interactions.attachCommands(commands);
if (attachment.status === "attached") {
  interactions.detachCommands(attachment.attachment);
  // @ts-expect-error Attachments expose no raw detach callback.
  attachment.detach();
}
// @ts-expect-error Command detachment requires an opaque attachment identity.
interactions.detachCommands({});

createRuntimeReactAdapterRegistry({
  components: [
    {
      capabilityId: "run.desen.test/Adapter",
      // @ts-expect-error Adapters receive the public semantic contract, not arbitrary props.
      component: (props: { privateImplementationState: object }) => {
        void props;
        return null;
      },
    },
  ],
});

// @ts-expect-error A plan cannot be used as registry authority.
readRuntimeReactAdapterRegistry(plan);
