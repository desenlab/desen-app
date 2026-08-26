import {
  deleteDesenEditorNode,
  moveDesenEditorNode,
  reorderDesenEditorNode,
} from "../src/index.js";

import type {
  DesenEditorDocument,
  DesenEditorNodeDeleteCommand,
  DesenEditorNodeMoveCommand,
  DesenEditorNodeReorderCommand,
  DesenEditorStructuralEditDiagnosticCode,
  DesenEditorStructuralEditFailure,
  DesenEditorStructuralEditResult,
  DesenEditorStructuralEditSuccess,
} from "../src/index.js";

declare const document: DesenEditorDocument;

const deleteCommand: DesenEditorNodeDeleteCommand = {
  surfaceId: "main",
  nodeId: "main.text",
};
const moveCommand: DesenEditorNodeMoveCommand = {
  surfaceId: "main",
  nodeId: "main.text",
  parentId: "main.stack",
  slot: "default",
  index: 0,
};
const reorderCommand: DesenEditorNodeReorderCommand = {
  surfaceId: "main",
  parentId: "main.stack",
  slot: "default",
  nodeId: "main.text",
  index: 0,
};

const deleted: DesenEditorStructuralEditResult = deleteDesenEditorNode(document, deleteCommand);
const moved: DesenEditorStructuralEditResult = moveDesenEditorNode(document, moveCommand);
const reordered: DesenEditorStructuralEditResult = reorderDesenEditorNode(document, reorderCommand);
const commandCode: DesenEditorStructuralEditDiagnosticCode =
  "run.desen.editor/STRUCTURAL_EDIT_COMMAND_INVALID";
void commandCode;

// @ts-expect-error structural-edit diagnostics cannot impersonate frozen core diagnostics
const coreCode: DesenEditorStructuralEditDiagnosticCode = "SCHEMA_INVALID";
void coreCode;

for (const result of [deleted, moved, reordered]) {
  if (result.ok) {
    const success: DesenEditorStructuralEditSuccess = result;
    const nextDocument: DesenEditorDocument = success.document;
    const diagnostics: readonly [] = success.diagnostics;

    // @ts-expect-error successful immutable documents cannot be edited in place
    success.document.id = "mutated";

    // @ts-expect-error success has no diagnostic entry
    const impossibleDiagnostic = success.diagnostics[0];

    void nextDocument;
    void diagnostics;
    void impossibleDiagnostic;
  } else {
    const failure: DesenEditorStructuralEditFailure = result;
    const code: string = failure.diagnostics[0].code;

    // @ts-expect-error failure exposes no partial document
    const partialDocument = failure.document;

    void code;
    void partialDocument;
  }
}

// @ts-expect-error delete command fields are immutable
deleteCommand.nodeId = "other";

// @ts-expect-error move command fields are immutable
moveCommand.index = 1;

// @ts-expect-error reorder command fields are immutable
reorderCommand.slot = "other";

const deleteWithAuthority: DesenEditorNodeDeleteCommand = {
  ...deleteCommand,
  // @ts-expect-error deletion accepts no recursive or policy authority
  recursive: false,
};
const moveWithRewrite: DesenEditorNodeMoveCommand = {
  ...moveCommand,
  // @ts-expect-error moving never accepts a replacement identity
  id: "rewritten",
};
const reorderAcrossSlots: DesenEditorNodeReorderCommand = {
  ...reorderCommand,
  // @ts-expect-error reorder accepts no destination slot distinct from its addressed slot
  destinationSlot: "other",
};

void deleteWithAuthority;
void moveWithRewrite;
void reorderAcrossSlots;
