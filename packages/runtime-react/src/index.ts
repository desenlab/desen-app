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
export {
  buildRuntimeReactDiagnosticIndex,
  RUNTIME_REACT_DIAGNOSTIC_INDEX_LIMITS,
} from "./diagnostic-index.js";
export { useRuntimeReactSurface } from "./live-surface.js";
export { createRuntimeReactReconciliationKey } from "./reconciliation.js";
export { renderRuntimeReactSurface, RUNTIME_REACT_RENDER_LIMITS } from "./render-plan.js";
export { ignoreRuntimeReactRootCaughtError } from "./root-error-policy.js";
export { useRuntimeReactSessionSurface } from "./session-surface.js";
export { RuntimeReactSurfaceBoundary } from "./surface-boundary.js";

export type {
  RuntimeReactAdapterFailure,
  RuntimeReactComponentAdapterFailure,
  RuntimeReactUnattributedAdapterFailure,
} from "./adapter-error-boundary.js";

export type {
  RuntimeReactAdapterReconciliationPolicySnapshot,
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
  RuntimeReactStyleParts,
  RuntimeReactStyleProperties,
} from "./registry.js";
export type {
  RuntimeReactBehaviorDiagnosticIndexBinding,
  RuntimeReactBehaviorDiagnosticIndexEntry,
  RuntimeReactComponentDiagnosticIndexBinding,
  RuntimeReactComponentDiagnosticIndexEntry,
  RuntimeReactDiagnosticIndex,
  RuntimeReactDiagnosticIndexBinding,
  RuntimeReactDiagnosticIndexBuildResult,
  RuntimeReactDiagnosticIndexEntry,
  RuntimeReactDiagnosticIndexInvalidReason,
  RuntimeReactDiagnosticIndexLimitProfile,
} from "./diagnostic-index.js";
export type {
  RuntimeReactLiveSurfaceFailure,
  RuntimeReactLiveSurfaceInput,
  RuntimeReactLiveSurfaceResult,
} from "./live-surface.js";
export type { RuntimeReactReconciliationKeyInput } from "./reconciliation.js";
export type { RuntimeReactRootCaughtErrorHandler } from "./root-error-policy.js";
export type {
  RuntimeReactRenderFailure,
  RuntimeReactRenderFailureChannel,
  RuntimeReactRenderFailureCode,
  RuntimeReactRenderInput,
  RuntimeReactRenderLimitProfile,
  RuntimeReactRenderResult,
  RuntimeReactRenderedSurface,
} from "./render-plan.js";
export type {
  RuntimeReactSessionSurfaceFailure,
  RuntimeReactSessionSurfaceFailureReason,
  RuntimeReactSessionSurfaceInput,
  RuntimeReactSessionSurfaceReady,
  RuntimeReactSessionSurfaceResult,
} from "./session-surface.js";
export type {
  RuntimeReactSurfaceBoundaryProps,
  RuntimeReactSurfaceBoundaryResult,
  RuntimeReactSurfaceFailure,
  RuntimeReactSurfaceFailureRenderer,
} from "./surface-boundary.js";
