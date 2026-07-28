import type {
  RuntimeReactCommandAttachmentHandle,
  RuntimeReactComponentCommandPort,
  RuntimeReactInteractionPort,
  RuntimeReactRenderFailureCode,
} from "../src/index.js";

declare const interactions: RuntimeReactInteractionPort;
declare const commands: RuntimeReactComponentCommandPort;
declare const attachment: RuntimeReactCommandAttachmentHandle;

const bindingFailure: RuntimeReactRenderFailureCode = "RUNTIME_BINDING_MISMATCH";
const dispatched = interactions.dispatchEvent("change", { value: "next" });
if (dispatched.status === "dispatched") {
  const completion: Promise<void> = dispatched.completion;
  void completion;
}
commands.invoke("focus", {});
interactions.detachCommands(attachment);

// @ts-expect-error Native/platform event objects are not inert runtime JSON.
interactions.dispatchEvent("change", new Event("change"));
// @ts-expect-error A command always receives a named JSON object input.
commands.invoke("focus", []);
// @ts-expect-error Opaque attachment authority cannot be reconstructed.
interactions.detachCommands({ attachment: true });

void bindingFailure;
