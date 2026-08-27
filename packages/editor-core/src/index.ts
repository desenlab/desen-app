/**
 * Framework-neutral immutable commands for editing a DESEN Source with stable identity.
 *
 * @packageDocumentation
 */

export { createDesenEditorDocument } from "./source-document.js";
export { insertDesenEditorNode } from "./stable-id-insert.js";
export {
  deleteDesenEditorNode,
  moveDesenEditorNode,
  reorderDesenEditorNode,
} from "./structural-edits.js";
export {
  clearDesenEditorNodeCondition,
  deleteDesenEditorOwnerProp,
  deleteDesenEditorOwnerStyleProperty,
  deleteDesenEditorVariant,
  deleteDesenEditorVariantProp,
  deleteDesenEditorVariantStyleProperty,
  insertDesenEditorVariant,
  reorderDesenEditorVariant,
  setDesenEditorNodeCondition,
  setDesenEditorOwnerProp,
  setDesenEditorOwnerStyleProperty,
  setDesenEditorVariantCondition,
  setDesenEditorVariantProp,
  setDesenEditorVariantStyleProperty,
} from "./content-edits.js";
export {
  deleteDesenEditorResourceInput,
  deleteDesenEditorStateDeclaration,
  insertDesenEditorStateDeclaration,
  setDesenEditorNodeRepeatItems,
  setDesenEditorNodeRepeatKey,
  setDesenEditorResourceInput,
  setDesenEditorStateInitial,
  setDesenEditorStateSchema,
} from "./state-binding-edits.js";
export {
  deleteDesenEditorAction,
  deleteDesenEditorEventHandler,
  insertDesenEditorAction,
  insertDesenEditorEventHandler,
  reorderDesenEditorAction,
  replaceDesenEditorAction,
} from "./event-action-edits.js";

export type {
  DesenEditorDocument,
  DesenEditorDocumentCreationFailure,
  DesenEditorDocumentCreationResult,
  DesenEditorDocumentCreationSuccess,
} from "./source-document.js";

export type {
  DesenEditorInsertDiagnostic,
  DesenEditorInsertDiagnosticCode,
  DesenEditorNodeInsertCommand,
  DesenEditorNodeInsertFailure,
  DesenEditorNodeInsertResult,
  DesenEditorNodeInsertSuccess,
} from "./stable-id-insert.js";

export type {
  DesenEditorNodeDeleteCommand,
  DesenEditorNodeMoveCommand,
  DesenEditorNodeReorderCommand,
  DesenEditorStructuralEditDiagnostic,
  DesenEditorStructuralEditDiagnosticCode,
  DesenEditorStructuralEditFailure,
  DesenEditorStructuralEditResult,
  DesenEditorStructuralEditSuccess,
} from "./structural-edits.js";

export type {
  DesenEditorContentEditDiagnostic,
  DesenEditorContentEditDiagnosticCode,
  DesenEditorContentEditFailure,
  DesenEditorContentEditResult,
  DesenEditorContentEditSuccess,
  DesenEditorContentPredicate,
  DesenEditorContentValue,
  DesenEditorContentVariant,
  DesenEditorNodeConditionClearCommand,
  DesenEditorNodeConditionSetCommand,
  DesenEditorOwnerPropDeleteCommand,
  DesenEditorOwnerPropSetCommand,
  DesenEditorOwnerStylePropertyDeleteCommand,
  DesenEditorOwnerStylePropertySetCommand,
  DesenEditorVariantConditionSetCommand,
  DesenEditorVariantDeleteCommand,
  DesenEditorVariantInsertCommand,
  DesenEditorVariantPropDeleteCommand,
  DesenEditorVariantPropSetCommand,
  DesenEditorVariantReorderCommand,
  DesenEditorVariantStylePropertyDeleteCommand,
  DesenEditorVariantStylePropertySetCommand,
} from "./content-edits.js";

export type {
  DesenEditorBindingValue,
  DesenEditorNodeRepeatItemsSetCommand,
  DesenEditorNodeRepeatKeySetCommand,
  DesenEditorResourceInputDeleteCommand,
  DesenEditorResourceInputSetCommand,
  DesenEditorStateBindingEditDiagnostic,
  DesenEditorStateBindingEditDiagnosticCode,
  DesenEditorStateBindingEditFailure,
  DesenEditorStateBindingEditResult,
  DesenEditorStateBindingEditSuccess,
  DesenEditorStateDeclaration,
  DesenEditorStateDeclarationDeleteCommand,
  DesenEditorStateDeclarationInsertCommand,
  DesenEditorStateInitialSetCommand,
  DesenEditorStateSchemaSetCommand,
} from "./state-binding-edits.js";

export type {
  DesenEditorAction,
  DesenEditorActionDeleteCommand,
  DesenEditorActionInsertCommand,
  DesenEditorActionListPointer,
  DesenEditorActionPointer,
  DesenEditorActionReorderCommand,
  DesenEditorActionReplaceCommand,
  DesenEditorEventActionEditDiagnostic,
  DesenEditorEventActionEditDiagnosticCode,
  DesenEditorEventActionEditFailure,
  DesenEditorEventActionEditResult,
  DesenEditorEventActionEditSuccess,
  DesenEditorEventHandlerDeleteCommand,
  DesenEditorEventHandlerInsertCommand,
} from "./event-action-edits.js";
