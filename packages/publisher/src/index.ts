/**
 * Pure, deterministic DESEN Source to immutable Bundle publication orchestration.
 *
 * @packageDocumentation
 */

export {
  DEPRECATED_CAPABILITY_CODE,
  getPublisherDiagnosticDefinition,
  INVALID_SOURCE_JSON_CODE,
  isPublisherDiagnosticCode,
  PUBLISH_PIPELINE_STAGES,
  PUBLISHER_DIAGNOSTIC_REGISTRY,
  SOURCE_LIMIT_EXCEEDED_CODE,
} from "./publish-result.js";
export { PUBLISH_SOURCE_JSON_LIMITS } from "./source-json.js";

export type {
  PublishCoreDiagnostic,
  PublishDiagnostic,
  PublishDiagnosticSeverity,
  PublishErrorDiagnostic,
  PublishExtensionDiagnostic,
  PublishExtensionDiagnosticCode,
  PublishFailure,
  PublishPipelineStage,
  PublisherDiagnosticCode,
  PublisherDiagnosticDefinition,
  PublisherExtensionDiagnosticCode,
  PublishResult,
  PublishSuccess,
  PublishWarningDiagnostic,
} from "./publish-result.js";
export type { PublishSourceJsonLimits } from "./source-json.js";
