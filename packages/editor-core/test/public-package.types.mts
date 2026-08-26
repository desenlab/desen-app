import {
  createDesenEditorDocument,
  deleteDesenEditorNode,
  insertDesenEditorNode,
  moveDesenEditorNode,
  reorderDesenEditorNode,
} from "@desen/editor-core";

import type {
  DesenEditorDocument,
  DesenEditorDocumentCreationFailure,
  DesenEditorDocumentCreationResult,
  DesenEditorDocumentCreationSuccess,
  DesenEditorNodeDeleteCommand,
  DesenEditorNodeInsertCommand,
  DesenEditorNodeInsertFailure,
  DesenEditorNodeInsertResult,
  DesenEditorNodeInsertSuccess,
  DesenEditorNodeMoveCommand,
  DesenEditorNodeReorderCommand,
  DesenEditorStructuralEditFailure,
  DesenEditorStructuralEditResult,
  DesenEditorStructuralEditSuccess,
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

const deleteCommand: DesenEditorNodeDeleteCommand = {
  surfaceId: "main",
  nodeId: "main.text",
};
const moveCommand: DesenEditorNodeMoveCommand = {
  surfaceId: "main",
  nodeId: "main.text",
  parentId: "main.column",
  slot: "content",
  index: 0,
};
const reorderCommand: DesenEditorNodeReorderCommand = {
  surfaceId: "main",
  parentId: "main.root",
  slot: "default",
  nodeId: "main.text",
  index: 0,
};
const deletion: DesenEditorStructuralEditResult = deleteDesenEditorNode(document, deleteCommand);
const movement: DesenEditorStructuralEditResult = moveDesenEditorNode(document, moveCommand);
const reordering: DesenEditorStructuralEditResult = reorderDesenEditorNode(
  document,
  reorderCommand,
);

for (const structuralEdit of [deletion, movement, reordering]) {
  if (structuralEdit.ok) {
    const success: DesenEditorStructuralEditSuccess = structuralEdit;
    const next: DesenEditorDocument = success.document;

    // @ts-expect-error structural-edit successes keep the next Source immutable
    success.document.entry = "mutated";

    // @ts-expect-error structural-edit success diagnostics are empty
    const impossibleDiagnostic = success.diagnostics[0];

    void next;
    void impossibleDiagnostic;
  } else {
    const failure: DesenEditorStructuralEditFailure = structuralEdit;
    const diagnosticCode: string = failure.diagnostics[0].code;

    // @ts-expect-error structural-edit failures expose no partial Source
    const partialDocument = failure.document;

    void diagnosticCode;
    void partialDocument;
  }
}

// @ts-expect-error emitted delete-command fields remain readonly
deleteCommand.nodeId = "main.other";

// @ts-expect-error emitted move-command fields remain readonly
moveCommand.index = 1;

// @ts-expect-error emitted reorder-command fields remain readonly
reorderCommand.slot = "other";

const crossSurfaceAuthority: DesenEditorNodeMoveCommand = {
  ...moveCommand,
  // @ts-expect-error structural moves expose one selected surface, not a second authority
  destinationSurfaceId: "other",
};
void crossSurfaceAuthority;
