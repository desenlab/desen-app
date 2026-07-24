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
