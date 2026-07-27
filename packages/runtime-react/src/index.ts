/**
 * React renderer that materializes runtime-core render plans through registered adapters.
 *
 * @packageDocumentation
 */

export {
  createRuntimeReactAdapterRegistry,
  readRuntimeReactAdapterRegistry,
  RUNTIME_REACT_ADAPTER_REGISTRY_LIMITS,
} from "./registry.js";
export { renderRuntimeReactSurface, RUNTIME_REACT_RENDER_LIMITS } from "./render-plan.js";

export type {
  RuntimeReactAdapterRegistryCreateInput,
  RuntimeReactAdapterRegistryCreateResult,
  RuntimeReactAdapterRegistryHandle,
  RuntimeReactAdapterRegistryInvalidReason,
  RuntimeReactAdapterRegistryLimitProfile,
  RuntimeReactAdapterRegistryReadResult,
  RuntimeReactAdapterRegistrySnapshot,
  RuntimeReactBehaviorAdapterComponent,
  RuntimeReactBehaviorAdapterProps,
  RuntimeReactBehaviorAdapterRegistration,
  RuntimeReactCommandAttachmentResult,
  RuntimeReactCommandAttachmentHandle,
  RuntimeReactCommandDetachmentResult,
  RuntimeReactComponentAdapterComponent,
  RuntimeReactComponentAdapterProps,
  RuntimeReactComponentAdapterRegistration,
  RuntimeReactComponentCommandPort,
  RuntimeReactDiagnosticIdentity,
  RuntimeReactEventDispatchResult,
  RuntimeReactInteractionPort,
  RuntimeReactNamedSlots,
  RuntimeReactSemanticStyle,
} from "./registry.js";
export type {
  RuntimeReactRenderFailure,
  RuntimeReactRenderFailureChannel,
  RuntimeReactRenderFailureCode,
  RuntimeReactRenderInput,
  RuntimeReactRenderLimitProfile,
  RuntimeReactRenderResult,
  RuntimeReactRenderedSurface,
} from "./render-plan.js";
