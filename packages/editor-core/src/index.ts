/**
 * Framework-neutral immutable commands for editing a DESEN Source with stable identity.
 *
 * @packageDocumentation
 */

export { createDesenEditorDocument } from "./source-document.js";

export type {
  DesenEditorDocument,
  DesenEditorDocumentCreationFailure,
  DesenEditorDocumentCreationResult,
  DesenEditorDocumentCreationSuccess,
} from "./source-document.js";
