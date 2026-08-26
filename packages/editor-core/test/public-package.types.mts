import {
  clearDesenEditorNodeCondition,
  createDesenEditorDocument,
  deleteDesenEditorNode,
  deleteDesenEditorOwnerProp,
  deleteDesenEditorOwnerStyleProperty,
  deleteDesenEditorVariant,
  deleteDesenEditorVariantProp,
  deleteDesenEditorVariantStyleProperty,
  insertDesenEditorNode,
  insertDesenEditorVariant,
  moveDesenEditorNode,
  reorderDesenEditorNode,
  reorderDesenEditorVariant,
  setDesenEditorNodeCondition,
  setDesenEditorOwnerProp,
  setDesenEditorOwnerStyleProperty,
  setDesenEditorVariantCondition,
  setDesenEditorVariantProp,
  setDesenEditorVariantStyleProperty,
} from "@desen/editor-core";

import type {
  DesenEditorContentEditDiagnostic,
  DesenEditorContentEditDiagnosticCode,
  DesenEditorContentEditFailure,
  DesenEditorContentEditResult,
  DesenEditorContentEditSuccess,
  DesenEditorContentPredicate,
  DesenEditorContentValue,
  DesenEditorContentVariant,
  DesenEditorDocument,
  DesenEditorDocumentCreationFailure,
  DesenEditorDocumentCreationResult,
  DesenEditorDocumentCreationSuccess,
  DesenEditorNodeConditionClearCommand,
  DesenEditorNodeConditionSetCommand,
  DesenEditorNodeDeleteCommand,
  DesenEditorNodeInsertCommand,
  DesenEditorNodeInsertFailure,
  DesenEditorNodeInsertResult,
  DesenEditorNodeInsertSuccess,
  DesenEditorNodeMoveCommand,
  DesenEditorNodeReorderCommand,
  DesenEditorOwnerPropDeleteCommand,
  DesenEditorOwnerPropSetCommand,
  DesenEditorOwnerStylePropertyDeleteCommand,
  DesenEditorOwnerStylePropertySetCommand,
  DesenEditorStructuralEditFailure,
  DesenEditorStructuralEditResult,
  DesenEditorStructuralEditSuccess,
  DesenEditorVariantConditionSetCommand,
  DesenEditorVariantDeleteCommand,
  DesenEditorVariantInsertCommand,
  DesenEditorVariantPropDeleteCommand,
  DesenEditorVariantPropSetCommand,
  DesenEditorVariantReorderCommand,
  DesenEditorVariantStylePropertyDeleteCommand,
  DesenEditorVariantStylePropertySetCommand,
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

const contentValue: DesenEditorContentValue = { $ref: "state.email", fallback: "" };
const contentPredicate: DesenEditorContentPredicate = {
  op: "truthy",
  args: [contentValue],
};
const contentVariant: DesenEditorContentVariant = {
  when: contentPredicate,
  props: { label: "Compact" },
};
const contentDiagnosticCode: DesenEditorContentEditDiagnosticCode =
  "run.desen.editor/CONTENT_EDIT_PATH_NOT_FOUND";
const contentDiagnostic: DesenEditorContentEditDiagnostic = {
  code: contentDiagnosticCode,
  message: "The selected content path does not exist.",
};

const ownerPropSetCommand: DesenEditorOwnerPropSetCommand = {
  surfaceId: "main",
  ownerId: "main.text",
  name: "label",
  value: contentValue,
};
const ownerPropDeleteCommand: DesenEditorOwnerPropDeleteCommand = {
  surfaceId: "main",
  ownerId: "main.text",
  name: "label",
};
const ownerStyleSetCommand: DesenEditorOwnerStylePropertySetCommand = {
  surfaceId: "main",
  ownerId: "main.text",
  state: "base",
  part: "root",
  property: "color",
  value: { $token: "color.content.primary" },
};
const ownerStyleDeleteCommand: DesenEditorOwnerStylePropertyDeleteCommand = {
  surfaceId: "main",
  ownerId: "main.text",
  state: "base",
  part: "root",
  property: "color",
};
const nodeConditionSetCommand: DesenEditorNodeConditionSetCommand = {
  surfaceId: "main",
  nodeId: "main.text",
  when: contentPredicate,
};
const nodeConditionClearCommand: DesenEditorNodeConditionClearCommand = {
  surfaceId: "main",
  nodeId: "main.text",
};
const variantInsertCommand: DesenEditorVariantInsertCommand = {
  surfaceId: "main",
  nodeId: "main.text",
  index: 0,
  variant: contentVariant,
};
const variantDeleteCommand: DesenEditorVariantDeleteCommand = {
  surfaceId: "main",
  nodeId: "main.text",
  index: 0,
};
const variantReorderCommand: DesenEditorVariantReorderCommand = {
  surfaceId: "main",
  nodeId: "main.text",
  variantIndex: 0,
  index: 1,
};
const variantConditionSetCommand: DesenEditorVariantConditionSetCommand = {
  surfaceId: "main",
  nodeId: "main.text",
  index: 0,
  when: contentPredicate,
};
const variantPropSetCommand: DesenEditorVariantPropSetCommand = {
  surfaceId: "main",
  nodeId: "main.text",
  index: 0,
  name: "label",
  value: "Compact",
};
const variantPropDeleteCommand: DesenEditorVariantPropDeleteCommand = {
  surfaceId: "main",
  nodeId: "main.text",
  index: 0,
  name: "label",
};
const variantStyleSetCommand: DesenEditorVariantStylePropertySetCommand = {
  surfaceId: "main",
  nodeId: "main.text",
  index: 0,
  state: "base",
  part: "root",
  property: "opacity",
  value: 0.5,
};
const variantStyleDeleteCommand: DesenEditorVariantStylePropertyDeleteCommand = {
  surfaceId: "main",
  nodeId: "main.text",
  index: 0,
  state: "base",
  part: "root",
  property: "opacity",
};

const contentEdits: readonly DesenEditorContentEditResult[] = [
  setDesenEditorOwnerProp(document, ownerPropSetCommand),
  deleteDesenEditorOwnerProp(document, ownerPropDeleteCommand),
  setDesenEditorOwnerStyleProperty(document, ownerStyleSetCommand),
  deleteDesenEditorOwnerStyleProperty(document, ownerStyleDeleteCommand),
  setDesenEditorNodeCondition(document, nodeConditionSetCommand),
  clearDesenEditorNodeCondition(document, nodeConditionClearCommand),
  insertDesenEditorVariant(document, variantInsertCommand),
  deleteDesenEditorVariant(document, variantDeleteCommand),
  reorderDesenEditorVariant(document, variantReorderCommand),
  setDesenEditorVariantCondition(document, variantConditionSetCommand),
  setDesenEditorVariantProp(document, variantPropSetCommand),
  deleteDesenEditorVariantProp(document, variantPropDeleteCommand),
  setDesenEditorVariantStyleProperty(document, variantStyleSetCommand),
  deleteDesenEditorVariantStyleProperty(document, variantStyleDeleteCommand),
];

for (const contentEdit of contentEdits) {
  if (contentEdit.ok) {
    const success: DesenEditorContentEditSuccess = contentEdit;
    const next: DesenEditorDocument = success.document;

    // @ts-expect-error content-edit successes keep the next Source immutable
    success.document.entry = "mutated";

    // @ts-expect-error content-edit success diagnostics are empty
    const impossibleDiagnostic = success.diagnostics[0];

    void next;
    void impossibleDiagnostic;
  } else {
    const failure: DesenEditorContentEditFailure = contentEdit;
    const diagnosticCode: string = failure.diagnostics[0].code;

    // @ts-expect-error content-edit failures expose no partial Source
    const partialDocument = failure.document;

    void diagnosticCode;
    void partialDocument;
  }
}

// @ts-expect-error owner prop-set command fields remain readonly
ownerPropSetCommand.value = "mutated";

// @ts-expect-error owner prop-delete command fields remain readonly
ownerPropDeleteCommand.name = "mutated";

// @ts-expect-error owner style-set command fields remain readonly
ownerStyleSetCommand.property = "mutated";

// @ts-expect-error owner style-delete command fields remain readonly
ownerStyleDeleteCommand.state = "mutated";

// @ts-expect-error node condition-set command fields remain readonly
nodeConditionSetCommand.when = { op: "truthy", args: [false] };

// @ts-expect-error node condition-clear command fields remain readonly
nodeConditionClearCommand.nodeId = "main.other";

// @ts-expect-error variant insert command fields remain readonly
variantInsertCommand.index = 1;

// @ts-expect-error variant delete command fields remain readonly
variantDeleteCommand.index = 1;

// @ts-expect-error variant reorder command fields remain readonly
variantReorderCommand.variantIndex = 1;

// @ts-expect-error variant condition-set command fields remain readonly
variantConditionSetCommand.when = { op: "truthy", args: [false] };

// @ts-expect-error variant prop-set command fields remain readonly
variantPropSetCommand.value = "mutated";

// @ts-expect-error variant prop-delete command fields remain readonly
variantPropDeleteCommand.name = "mutated";

// @ts-expect-error variant style-set command fields remain readonly
variantStyleSetCommand.property = "mutated";

// @ts-expect-error variant style-delete command fields remain readonly
variantStyleDeleteCommand.state = "mutated";

// @ts-expect-error structural validator codes are not project-owned content-edit codes
const invalidContentDiagnosticCode: DesenEditorContentEditDiagnosticCode = "SCHEMA_INVALID";

void contentDiagnostic;
void invalidContentDiagnosticCode;
