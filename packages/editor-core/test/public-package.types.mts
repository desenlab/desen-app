import { createDesenEditorDocument } from "@desen/editor-core";

import type {
  DesenEditorDocument,
  DesenEditorDocumentCreationFailure,
  DesenEditorDocumentCreationResult,
  DesenEditorDocumentCreationSuccess,
} from "@desen/editor-core";

declare const input: unknown;
declare const replacementSurface: DesenEditorDocument["surfaces"][string];

const factory: (value: unknown) => DesenEditorDocumentCreationResult = createDesenEditorDocument;
const result = factory(input);

if (result.ok) {
  const success: DesenEditorDocumentCreationSuccess = result;
  const document: DesenEditorDocument = success.document;
  const kind: "desen.source" = document.kind;
  const diagnostics: readonly [] = success.diagnostics;

  // @ts-expect-error emitted declarations keep the direct document recursively immutable
  document.id = "mutated";

  // @ts-expect-error emitted declarations do not permit replacing nested Source maps
  document.surfaces.main = replacementSurface;

  // @ts-expect-error emitted declarations expose the Source root itself, not a wrapper
  const hiddenSource = document.source;

  // @ts-expect-error a successful admission has no structural diagnostic entries
  const impossibleDiagnostic = success.diagnostics[0];

  void kind;
  void diagnostics;
  void hiddenSource;
  void impossibleDiagnostic;
} else {
  const failure: DesenEditorDocumentCreationFailure = result;
  const code: string = failure.diagnostics[0]?.code ?? "none";

  // @ts-expect-error a rejected admission exposes no partial editor document
  const partialDocument = failure.document;

  void code;
  void partialDocument;
}
