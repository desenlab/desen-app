import { createDesenEditorDocument } from "@desen/editor-core";

import type {
  DesenEditorDocument,
  DesenEditorDocumentCreationFailure,
  DesenEditorDocumentCreationResult,
  DesenEditorDocumentCreationSuccess,
} from "@desen/editor-core";

declare const input: unknown;

const factory: (value: unknown) => DesenEditorDocumentCreationResult = createDesenEditorDocument;
const result = factory(input);

if (result.ok) {
  const success: DesenEditorDocumentCreationSuccess = result;
  const document: DesenEditorDocument = success.document;
  const kind: "desen.source" = document.kind;
  const diagnostics: readonly [] = success.diagnostics;
  void kind;
  void diagnostics;
} else {
  const failure: DesenEditorDocumentCreationFailure = result;
  const code: string = failure.diagnostics[0]?.code ?? "none";
  void code;
}
