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
export { createRuntimeCommandEventHostPorts } from "./command-event-ports.js";
export {
  disposeRuntimeCommandEventActions,
  executeRuntimeCommandEventAction,
  mountRuntimeCommandEventActions,
  readRuntimeCommandEventActions,
  registerRuntimeComponentCommandTarget,
  RUNTIME_COMMAND_EVENT_ACTION_LIMITS,
  unregisterRuntimeComponentCommandTarget,
} from "./command-event-actions.js";
export {
  disposeRuntimeActionTurns,
  executeRuntimeActionTurn,
  mountRuntimeActionTurns,
  prepareRuntimeActionProgram,
  RUNTIME_ACTION_TURN_LIMITS,
} from "./action-turns.js";
export {
  bindRuntimeAdapterBridges,
  createRuntimeAdapterBridgePorts,
  disposeRuntimeAdapterBridges,
  readRuntimeAdapterBridges,
  receiveRuntimeAdapterEvent,
  registerRuntimeAdapterBinding,
  RUNTIME_ADAPTER_BRIDGE_LIMITS,
  unregisterRuntimeAdapterBinding,
} from "./adapter-bridges.js";
export { createRuntimeReactiveHostPorts } from "./reactive-host-ports.js";
export {
  disposeRuntimeReactiveReevaluation,
  invalidateRuntimeReactiveReevaluation,
  mountRuntimeReactiveReevaluation,
  readRuntimeReactiveReevaluation,
  RUNTIME_REACTIVE_REEVALUATION_LIMITS,
} from "./reactive-reevaluation.js";
export {
  materializeRuntimeHeadlessSurface,
  RUNTIME_HEADLESS_MATERIALIZATION_LIMITS,
} from "./headless-materialization.js";
export { snapshotRuntimeJsonValue } from "./runtime-json-snapshot.js";
export {
  attachRuntimeHeadlessSessionComponentCommands,
  authenticateRuntimeHeadlessSessionAdapterAuthority,
  detachRuntimeHeadlessSessionComponentCommands,
  dispatchRuntimeHeadlessSessionEvent,
  disposeRuntimeHeadlessSession,
  mountRuntimeHeadlessSession,
  readRuntimeHeadlessSession,
  RUNTIME_HEADLESS_SESSION_LIMITS,
  subscribeRuntimeHeadlessSession,
  unsubscribeRuntimeHeadlessSession,
} from "./headless-session.js";

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

export type { RuntimeReactiveHostPorts } from "./reactive-host-ports.js";

export type {
  RuntimeReactiveEvaluationOutcome,
  RuntimeReactiveEvaluationRequest,
  RuntimeReactiveEvaluator,
  RuntimeReactiveInactiveReason,
  RuntimeReactiveInvalidationInput,
  RuntimeReactiveInvalidationReason,
  RuntimeReactiveInvalidationResult,
  RuntimeReactiveMaterializationContext,
  RuntimeReactiveReevaluationDisposeResult,
  RuntimeReactiveReevaluationHandle,
  RuntimeReactiveReevaluationLimitProfile,
  RuntimeReactiveReevaluationMountInput,
  RuntimeReactiveReevaluationMountInvalidReason,
  RuntimeReactiveReevaluationMountResult,
  RuntimeReactiveReevaluationReadResult,
  RuntimeReactiveReevaluationSnapshot,
} from "./reactive-reevaluation.js";

export type {
  RuntimeHeadlessBehaviorPlan,
  RuntimeHeadlessMaterializationCommitment,
  RuntimeHeadlessMaterializationInput,
  RuntimeHeadlessMaterializationInvalidReason,
  RuntimeHeadlessMaterializationLimitProfile,
  RuntimeHeadlessMaterializationLimitReason,
  RuntimeHeadlessMaterializationResult,
  RuntimeHeadlessMaterializationSidecar,
  RuntimeHeadlessNodePlan,
  RuntimeHeadlessSurfacePlan,
} from "./headless-materialization.js";

export type {
  RuntimeHeadlessBindingSnapshot,
  RuntimeHeadlessSessionAdapterAuthorityInput,
  RuntimeHeadlessSessionAdapterAuthorityResult,
  RuntimeHeadlessSessionComponentCommandsAttachResult,
  RuntimeHeadlessSessionComponentCommandsAttachment,
  RuntimeHeadlessSessionComponentCommandsDetachResult,
  RuntimeHeadlessSessionComponentCommandsInput,
  RuntimeHeadlessSessionDisposeResult,
  RuntimeHeadlessSessionEventCompletion,
  RuntimeHeadlessSessionEventInput,
  RuntimeHeadlessSessionEventResult,
  RuntimeHeadlessSessionHandle,
  RuntimeHeadlessSessionLimitProfile,
  RuntimeHeadlessSessionListener,
  RuntimeHeadlessSessionMountInput,
  RuntimeHeadlessSessionMountInvalidReason,
  RuntimeHeadlessSessionMountResult,
  RuntimeHeadlessSessionReadResult,
  RuntimeHeadlessSessionSnapshot,
  RuntimeHeadlessSessionSubscribeResult,
  RuntimeHeadlessSessionSubscription,
  RuntimeHeadlessSessionUnsubscribeResult,
} from "./headless-session.js";

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

export type {
  RuntimeCommandEventHostPorts,
  RuntimeCommandEventHostPortsInput,
  RuntimeComponentCommandHostPort,
  RuntimeComponentCommandHostRequest,
  RuntimeComponentCommandHostResult,
  RuntimeHostEventEmissionResult,
  RuntimeHostEventPort,
  RuntimeHostEventRequest,
  RuntimeHostEventValidationResult,
} from "./command-event-ports.js";

export type {
  RuntimeCommandEventAction,
  RuntimeCommandEventActionLimitProfile,
  RuntimeCommandEventActionResult,
  RuntimeCommandEventActionsDisposeResult,
  RuntimeCommandEventActionsHandle,
  RuntimeCommandEventActionsMountInput,
  RuntimeCommandEventActionsMountResult,
  RuntimeCommandEventActionsReadResult,
  RuntimeCommandEventActionsSnapshot,
  RuntimeComponentCommandAction,
  RuntimeComponentCommandRegistrationTicket,
  RuntimeComponentCommandTargetRegistrationInput,
  RuntimeComponentCommandTargetRegistrationResult,
  RuntimeComponentCommandTargetUnregistrationInput,
  RuntimeComponentCommandTargetUnregistrationResult,
  RuntimeHostEventEmitAction,
  RuntimeRegisteredComponentCommandTargetSnapshot,
} from "./command-event-actions.js";

export type {
  RuntimeActionTurnCompletion,
  RuntimeActionTurnExecutionResult,
  RuntimeActionTurnLimitProfile,
  RuntimeActionTurnProgram,
  RuntimeActionTurnProgramPreparationResult,
  RuntimeActionTurnQueued,
  RuntimeActionTurnRequest,
  RuntimeActionTurnStarted,
  RuntimeActionTurnStep,
  RuntimeActionTurnTerminationReason,
  RuntimeActionTurnsDisposeResult,
  RuntimeActionTurnsHandle,
  RuntimeActionTurnsMountInput,
  RuntimeActionTurnsMountInvalidReason,
  RuntimeActionTurnsMountResult,
  RuntimeActionTurnsSnapshot,
} from "./action-turns.js";

export type {
  RuntimeAdapterBindingInput,
  RuntimeAdapterBindingRegistrationResult,
  RuntimeAdapterBindingSnapshot,
  RuntimeAdapterBindingTicket,
  RuntimeAdapterBindingUnregistrationInput,
  RuntimeAdapterBindingUnregistrationResult,
  RuntimeAdapterBridgeLimitProfile,
  RuntimeAdapterBridgePorts,
  RuntimeAdapterBridgePortsInput,
  RuntimeAdapterBridgesBindInput,
  RuntimeAdapterBridgesBindResult,
  RuntimeAdapterBridgesDisposeResult,
  RuntimeAdapterBridgesHandle,
  RuntimeAdapterBridgesReadResult,
  RuntimeAdapterBridgesSnapshot,
  RuntimeAdapterComponentCommandPort,
  RuntimeAdapterComponentCommandRequest,
  RuntimeAdapterComponentCommandResult,
  RuntimeAdapterEventHandlerSelector,
  RuntimeAdapterEventInput,
  RuntimeAdapterEventResult,
  RuntimeAdapterEventTurnPort,
  RuntimeAdapterEventTurnRequest,
  RuntimeAdapterEventTurnResult,
  RuntimeAdapterNodeIdentity,
  RuntimeBehaviorAdapterBindingInput,
  RuntimeComponentAdapterBindingInput,
} from "./adapter-bridges.js";
