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
