import { createDesenEditorDocument, insertDesenEditorNode } from "@desen/editor-core";

import type {
  DesenEditorDocument,
  DesenEditorDocumentCreationFailure,
  DesenEditorDocumentCreationResult,
  DesenEditorDocumentCreationSuccess,
  DesenEditorNodeInsertCommand,
  DesenEditorNodeInsertFailure,
  DesenEditorNodeInsertResult,
  DesenEditorNodeInsertSuccess,
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

declare const document: DesenEditorDocument;
const command: DesenEditorNodeInsertCommand = {
  surfaceId: "main",
  parentId: "main.root",
  slot: "default",
  index: 0,
  idBase: "main.text",
  use: "com.example.ui/Text",
};
const insertion: DesenEditorNodeInsertResult = insertDesenEditorNode(document, command);
if (insertion.ok) {
  const success: DesenEditorNodeInsertSuccess = insertion;
  const insertedId: string = success.insertedNodeId;
  const next: DesenEditorDocument = success.document;

  // @ts-expect-error emitted command successes keep the next Source immutable
  success.document.entry = "mutated";

  // @ts-expect-error emitted success diagnostics are empty
  const impossibleDiagnostic = success.diagnostics[0];

  void insertedId;
  void next;
  void impossibleDiagnostic;
} else {
  const failure: DesenEditorNodeInsertFailure = insertion;
  const diagnosticCode: string = failure.diagnostics[0].code;

  // @ts-expect-error emitted failures expose no partial Source
  const partialDocument = failure.document;

  // @ts-expect-error emitted failures expose no allocated identity
  const partialIdentity = failure.insertedNodeId;

  void diagnosticCode;
  void partialDocument;
  void partialIdentity;
}

// @ts-expect-error emitted command fields remain readonly
command.index = 1;

const explicitIdBypass: DesenEditorNodeInsertCommand = {
  ...command,
  // @ts-expect-error callers cannot bypass emitted allocator ownership
  id: "main.explicit",
};
void explicitIdBypass;
