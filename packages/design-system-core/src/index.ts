/**
 * Platform-neutral editable-project and design-token contracts for DESEN authoring.
 *
 * @packageDocumentation
 */

export {
  EDITABLE_PROJECT_KIND,
  EDITABLE_PROJECT_LIMITS,
  EDITABLE_PROJECT_SCHEMA_VERSION,
  admitEditableProjectRecord,
} from "./project-record.js";
export {
  SUPPORTED_EDITABLE_PROJECT_SCHEMA_VERSIONS,
  migrateEditableProjectRecord,
} from "./project-migrations.js";
export { DESIGN_TOKEN_PROFILE, getDesignTokenValueFamily } from "./token-types.js";
export { admitDtcgTokenDocument, getDtcgAliasTarget, isDtcgTokenAlias } from "./token-document.js";
export { resolveDesignTokens } from "./token-resolver.js";
export { EDITABLE_PROJECT_RECIPE_LIMITS } from "./master-instance-types.js";
export {
  createEditableProjectMasterDraft,
  prepareEditableProjectMasterDraftUpdate,
} from "./master-edit.js";
export type {
  EditableProjectMasterDraft,
  EditableProjectMasterDraftResult,
} from "./master-edit-types.js";
export {
  getEditableProjectMasterDefinitionDigest,
  prepareEditableProjectRecipeTransaction,
  validateEditableProjectRecipeContracts,
} from "./recipe-transactions.js";
export type {
  EditableProjectInstanceDestination,
  EditableProjectRecipeContractResult,
  EditableProjectRecipeTransactionCommand,
  EditableProjectRecipeTransactionDiagnostic,
  EditableProjectRecipeTransactionDiagnosticCode,
  EditableProjectRecipeTransactionFailure,
  EditableProjectRecipeTransactionResult,
  EditableProjectRecipeTransactionSuccess,
} from "./recipe-transaction-types.js";
export {
  EDITABLE_PROJECT_HISTORY_LIMITS,
  createEditableProjectHistory,
  recordEditableProjectHistory,
  redoEditableProjectHistory,
  undoEditableProjectHistory,
} from "./project-history.js";

export type {
  EditableProjectInstanceMapping,
  EditableProjectInstanceOverride,
  EditableProjectMasterDefinition,
  EditableProjectMasterInstance,
  EditableProjectOverrideProperty,
  EditableProjectRecipeBehavior,
  EditableProjectRecipeChild,
  EditableProjectRecipeGraph,
  EditableProjectRecipeNode,
  EditableProjectRecipeOccurrence,
  EditableProjectRecipeOwner,
} from "./master-instance-types.js";
export type {
  EditableProjectHistory,
  EditableProjectHistoryDiagnostic,
  EditableProjectHistoryDiagnosticCode,
  EditableProjectHistoryEntry,
  EditableProjectHistoryFailure,
  EditableProjectHistoryResult,
  EditableProjectHistorySuccess,
} from "./project-history.js";

export type { EditableProjectDiagnostic, EditableProjectDiagnosticCode } from "./diagnostics.js";
export type {
  DesignSystemJsonObject,
  DesignSystemJsonPrimitive,
  DesignSystemJsonValue,
} from "./inert-json.js";
export type {
  EditableProjectAdmissionFailure,
  EditableProjectAdmissionResult,
  EditableProjectAdmissionSuccess,
  EditableProjectAssetMetadata,
  EditableProjectConnectionIntent,
  EditableProjectDesignSystem,
  EditableProjectDesignSystemV1,
  EditableProjectRecipeMetadata,
  EditableProjectRecord,
  EditableProjectRecordV1,
  EditableProjectRecordV2,
  EditableProjectTokenSource,
} from "./project-record.js";
export type {
  EditableProjectMigrationChange,
  EditableProjectMigrationFailure,
  EditableProjectMigrationResult,
  EditableProjectMigrationSuccess,
} from "./project-migrations.js";
export type {
  AdmittedDtcgToken,
  DesignTokenValueFamily,
  DtcgBorderValue,
  DtcgColorValue,
  DtcgCubicBezierValue,
  DtcgDiagnostic,
  DtcgDiagnosticCode,
  DtcgDimensionValue,
  DtcgDurationValue,
  DtcgFailureClassification,
  DtcgFontFamilyValue,
  DtcgFontWeightValue,
  DtcgFormatVersion,
  DtcgJsonArray,
  DtcgJsonObject,
  DtcgJsonPrimitive,
  DtcgJsonValue,
  DtcgLiteralValueByType,
  DtcgNamedFontWeight,
  DtcgNamedStrokeStyle,
  DtcgNodeMetadata,
  DtcgProfileLimits,
  DtcgProjectProfile,
  DtcgShadowLayerValue,
  DtcgShadowValue,
  DtcgTokenAlias,
  DtcgTokenLiteral,
  DtcgTokenType,
  DtcgTokenValue,
  DtcgTransitionValue,
  DtcgTypographyValue,
} from "./token-types.js";
export type {
  DtcgTokenDocument,
  DtcgTokenDocumentAdmissionFailure,
  DtcgTokenDocumentAdmissionResult,
  DtcgTokenDocumentAdmissionSuccess,
} from "./token-document.js";
export type {
  DesignTokenLiteralOverride,
  DesignTokenLiteralOverrideOrigin,
  DesignTokenOrigin,
  DesignTokenResolutionFailure,
  DesignTokenResolutionRequest,
  DesignTokenResolutionResult,
  DesignTokenResolutionSuccess,
  DesignTokenSource,
  DesignTokenSourceOrigin,
  RejectedDesignTokenSource,
  ResolvedDesignToken,
} from "./token-resolver.js";
