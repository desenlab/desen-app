/**
 * Framework-neutral state, binding, predicate, action, resource, operation, behavior, and lifecycle semantics.
 *
 * @packageDocumentation
 */

export { createRuntimeHostPorts } from "./host-ports.js";
export {
  createRuntimeResolutionSnapshot,
  resolveRuntimeValue,
  RUNTIME_VALUE_SAFETY_LIMITS,
} from "./value-resolution.js";
export { materializeRuntimeValue } from "./token-format-resolution.js";
export {
  evaluateRuntimeConditionalPresence,
  evaluateRuntimePredicate,
} from "./predicate-evaluation.js";
export { evaluateRuntimeVariantOverrides } from "./variant-style-evaluation.js";
export {
  disposeRuntimeSurfaceState,
  mountRuntimeSurfaceState,
  readRuntimeSurfaceState,
  writeRuntimeSurfaceState,
} from "./local-state.js";
export { createRuntimeNodeIdentity, reconcileRuntimeNodeIdentity } from "./node-identity.js";
export {
  createRuntimeRepeatRootScope,
  createRuntimeRepeatedNodeIdentity,
  createRuntimeResolutionSnapshotForRepeatScope,
  materializeRuntimeRepeat,
  reconcileRuntimeRepeatedNodeIdentity,
  RUNTIME_REPEAT_LIMITS,
} from "./repeat-materialization.js";
export {
  disposeRuntimeSurfaceResources,
  mountRuntimeSurfaceResources,
  readRuntimeSurfaceResources,
  refreshRuntimeSurfaceResource,
  RUNTIME_RESOURCE_LIMITS,
  startRuntimeSurfaceResources,
} from "./resource-lifecycle.js";
export {
  acknowledgeRuntimeOperationSettlement,
  disposeRuntimeSurfaceOperations,
  invokeRuntimeOperation,
  mountRuntimeSurfaceOperations,
  readRuntimeSurfaceOperations,
  RUNTIME_OPERATION_LIMITS,
} from "./operation-lifecycle.js";
export {
  disposeRuntimeStateNavigationActions,
  executeRuntimeStateNavigationAction,
  mountRuntimeStateNavigationActions,
  RUNTIME_STATE_NAVIGATION_ACTION_LIMITS,
} from "./state-navigation-actions.js";
export {
  disposeRuntimeOperationResourceActions,
  executeRuntimeOperationResourceAction,
  mountRuntimeOperationResourceActions,
  RUNTIME_OPERATION_RESOURCE_ACTION_LIMITS,
} from "./operation-resource-actions.js";

export type {
  RuntimeActivationCommitRequest,
  RuntimeActivationCommitResult,
  RuntimeActivationReadResult,
  RuntimeActivationRecord,
  RuntimeAwaitable,
  RuntimeBundleStorageEntry,
  RuntimeBundleStoragePutResult,
  RuntimeBundleStorageReadResult,
  RuntimeClockPort,
  RuntimeContextPort,
  RuntimeDiagnosticsPort,
  RuntimeEnvironmentPort,
  RuntimeHostCallResult,
  RuntimeHostPorts,
  RuntimeJsonObject,
  RuntimeJsonPrimitive,
  RuntimeJsonValue,
  RuntimeNavigationPort,
  RuntimeNavigationRequest,
  RuntimeNavigationResult,
  RuntimeOperationEffect,
  RuntimeOperationPort,
  RuntimeOperationRequest,
  RuntimeRequestContext,
  RuntimeResourcePort,
  RuntimeResourceRequest,
  RuntimeStoragePort,
  RuntimeTokenPort,
  RuntimeTokenRequest,
  RuntimeTokenResolution,
} from "./host-ports.js";

export type {
  RuntimeEventReferenceSnapshot,
  RuntimeFormatPayload,
  RuntimeFormatValue,
  RuntimeLifecycleReferenceSnapshot,
  RuntimeLiteralValue,
  RuntimeReferenceFailureReason,
  RuntimeReferenceValue,
  RuntimeResolutionSnapshot,
  RuntimeResolutionSnapshotInput,
  RuntimeTokenValue,
  RuntimeValueDeferred,
  RuntimeValueInvalid,
  RuntimeValueInvalidReason,
  RuntimeValueResolution,
  RuntimeValueResolved,
  RuntimeValueSpec,
  RuntimeValueUnresolved,
} from "./value-resolution.js";

export type {
  RuntimeTokenProviderFailure,
  RuntimeTokenUnresolved,
  RuntimeValueMaterialization,
  RuntimeValueMaterializationContext,
} from "./token-format-resolution.js";

export type {
  RuntimeConditionalPresence,
  RuntimePredicateArgument,
  RuntimePredicateDeferred,
  RuntimePredicateEvaluated,
  RuntimePredicateEvaluation,
  RuntimePredicateInvalid,
  RuntimePredicateInvalidReason,
  RuntimePredicateOperator,
  RuntimePredicateSpec,
  RuntimePredicateTypeMismatch,
} from "./predicate-evaluation.js";

export type {
  RuntimePropValueSpecs,
  RuntimeStyleValueSpecs,
  RuntimeVariantEvaluationInput,
  RuntimeVariantOverrideInvalidReason,
  RuntimeVariantOverrideSpec,
  RuntimeVariantOverridesEvaluated,
  RuntimeVariantOverridesEvaluation,
  RuntimeVariantOverridesInvalid,
  RuntimeVariantValueSources,
} from "./variant-style-evaluation.js";

export type {
  RuntimeSurfaceStateDisposeResult,
  RuntimeSurfaceStateEntrySpec,
  RuntimeSurfaceStateHandle,
  RuntimeSurfaceStateIssue,
  RuntimeSurfaceStateMountInput,
  RuntimeSurfaceStateMountInvalid,
  RuntimeSurfaceStateMountInvalidReason,
  RuntimeSurfaceStateMountResult,
  RuntimeSurfaceStateReadResult,
  RuntimeSurfaceStateSnapshot,
  RuntimeSurfaceStateWriteInput,
  RuntimeSurfaceStateWriteRejected,
  RuntimeSurfaceStateWriteRejectedReason,
  RuntimeSurfaceStateWriteResult,
} from "./local-state.js";

export type {
  RuntimeNodeIdentity,
  RuntimeNodeIdentityCreationResult,
  RuntimeNodeIdentityDescriptor,
  RuntimeNodeIdentityInvalid,
  RuntimeNodeIdentityInvalidReason,
  RuntimeNodeIdentityReconciliation,
} from "./node-identity.js";

export type {
  RuntimeRepeatDeferred,
  RuntimeRepeatInvalid,
  RuntimeRepeatInvalidCode,
  RuntimeRepeatInvalidReason,
  RuntimeRepeatKey,
  RuntimeRepeatLimitExceeded,
  RuntimeRepeatMaterialization,
  RuntimeRepeatMaterialized,
  RuntimeRepeatMaterializedInstance,
  RuntimeRepeatScope,
  RuntimeRepeatSpec,
  RuntimeRepeatedNodeIdentity,
  RuntimeRepeatedNodeIdentityCreationResult,
  RuntimeRepeatedNodeIdentityInvalid,
  RuntimeRepeatedNodeIdentityInvalidReason,
  RuntimeRepeatedNodeIdentityReconciliation,
} from "./repeat-materialization.js";

export type {
  RuntimeResourceInitialStartEntry,
  RuntimeResourceInputResolutionRejected,
  RuntimeResourceInputSchemaRejected,
  RuntimeResourceLimitProfile,
  RuntimeResourceLoadStarted,
  RuntimeResourceManualSkipped,
  RuntimeResourcePolicy,
  RuntimeResourceRefreshInput,
  RuntimeResourceRefreshResult,
  RuntimeResourceSettlement,
  RuntimeResourceSnapshotLimitRejected,
  RuntimeSurfaceResourceSpec,
  RuntimeSurfaceResourcesDisposeResult,
  RuntimeSurfaceResourcesHandle,
  RuntimeSurfaceResourcesMounted,
  RuntimeSurfaceResourcesMountInput,
  RuntimeSurfaceResourcesMountInvalid,
  RuntimeSurfaceResourcesMountInvalidReason,
  RuntimeSurfaceResourcesMountResult,
  RuntimeSurfaceResourcesReadResult,
  RuntimeSurfaceResourcesSnapshot,
  RuntimeSurfaceResourcesStartResult,
} from "./resource-lifecycle.js";

export type {
  RuntimeOperationConcurrency,
  RuntimeOperationInputSchemaRejected,
  RuntimeOperationInvocationQueued,
  RuntimeOperationInvocationStaged,
  RuntimeOperationInvocationStarted,
  RuntimeOperationInvokeInput,
  RuntimeOperationInvokeResult,
  RuntimeOperationLimitProfile,
  RuntimeOperationSettlement,
  RuntimeOperationSettlementAcknowledgement,
  RuntimeOperationSettlementLease,
  RuntimeOperationTerminalSettlement,
  RuntimeSurfaceOperationAliasSpec,
  RuntimeSurfaceOperationsDisposeResult,
  RuntimeSurfaceOperationsHandle,
  RuntimeSurfaceOperationsMounted,
  RuntimeSurfaceOperationsMountInput,
  RuntimeSurfaceOperationsMountInvalid,
  RuntimeSurfaceOperationsMountInvalidReason,
  RuntimeSurfaceOperationsMountResult,
  RuntimeSurfaceOperationsReadResult,
  RuntimeSurfaceOperationsSnapshot,
} from "./operation-lifecycle.js";

export type {
  RuntimeActionGuardRejected,
  RuntimeActionPayloadRejected,
  RuntimeActionSkipped,
  RuntimeNavigateAction,
  RuntimeNavigationAdapterFailed,
  RuntimeNavigationDenied,
  RuntimeNavigationSucceeded,
  RuntimeStateActionApplied,
  RuntimeStateActionRejected,
  RuntimeStateNavigationAction,
  RuntimeStateNavigationActionResult,
  RuntimeStateNavigationActionsDisposeResult,
  RuntimeStateNavigationActionsHandle,
  RuntimeStateNavigationActionsMountInput,
  RuntimeStateNavigationActionsMountInvalidReason,
  RuntimeStateNavigationActionsMountResult,
  RuntimeStateSetAction,
  RuntimeStateToggleAction,
} from "./state-navigation-actions.js";

export type {
  RuntimeDeferredActionSpec,
  RuntimeOperationActionQueued,
  RuntimeOperationActionSettlementDescriptor,
  RuntimeOperationActionStaged,
  RuntimeOperationActionStarted,
  RuntimeOperationInvokeAction,
  RuntimeOperationResourceAction,
  RuntimeOperationResourceActionLimitProfile,
  RuntimeOperationResourceActionResult,
  RuntimeOperationResourceActionsDisposeResult,
  RuntimeOperationResourceActionsHandle,
  RuntimeOperationResourceActionsMountInput,
  RuntimeOperationResourceActionsMountInvalidReason,
  RuntimeOperationResourceActionsMountResult,
  RuntimeResourceRefreshAction,
  RuntimeResourceRefreshActionStarted,
} from "./operation-resource-actions.js";
