/**
 * Platform-neutral theme and design-token authoring contracts for DESEN.
 *
 * @packageDocumentation
 */

export { DESEN_NEUTRAL_THEME_DOCUMENT } from "./neutral-theme.js";
export {
  THEME_AUTHORING_KIND,
  THEME_AUTHORING_LIMITS,
  THEME_AUTHORING_SCHEMA_VERSION,
  admitThemeAuthoringDocument,
  applyThemeAuthoringEdit,
  createThemeAuthoringSession,
  exportThemeAuthoringDocument,
  importThemeAuthoringDocument,
  redoThemeAuthoringEdit,
  selectThemeAuthoringMode,
  undoThemeAuthoringEdit,
} from "./theme-authoring.js";

export type { ThemeAuthoringCompatibilityFeatureId } from "./reviewed-dtcg-compatibility.js";

export type {
  ThemeAuthoringAdmissionFailure,
  ThemeAuthoringAdmissionResult,
  ThemeAuthoringAdmissionSuccess,
  ThemeAuthoringAliasEdit,
  ThemeAuthoringControl,
  ThemeAuthoringCreateAliasEdit,
  ThemeAuthoringCreateLiteralEdit,
  ThemeAuthoringDeleteModeEdit,
  ThemeAuthoringDeleteThemeEdit,
  ThemeAuthoringDeleteTokenEdit,
  ThemeAuthoringDiagnostic,
  ThemeAuthoringDiagnosticCode,
  ThemeAuthoringDocument,
  ThemeAuthoringDocumentV1,
  ThemeAuthoringDuplicateModeEdit,
  ThemeAuthoringDuplicateThemeEdit,
  ThemeAuthoringEdit,
  ThemeAuthoringExport,
  ThemeAuthoringHistoryEntry,
  ThemeAuthoringLiteralEdit,
  ThemeAuthoringMode,
  ThemeAuthoringPreview,
  ThemeAuthoringPreviewFailure,
  ThemeAuthoringPreviewSuccess,
  ThemeAuthoringRenameModeEdit,
  ThemeAuthoringRenameThemeEdit,
  ThemeAuthoringSelection,
  ThemeAuthoringSession,
  ThemeAuthoringSessionFailure,
  ThemeAuthoringSessionResult,
  ThemeAuthoringSessionSuccess,
  ThemeAuthoringTheme,
  ThemeAuthoringTokenSource,
  ThemeAuthoringTransferLoss,
  ThemeAuthoringTransferReport,
  ThemeAuthoringTransitionFailure,
  ThemeAuthoringTransitionResult,
  ThemeAuthoringTransitionSuccess,
  ThemeAuthoringUnsupportedFeature,
} from "./theme-authoring.js";
