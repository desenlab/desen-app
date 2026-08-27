import {
  clearDesenEditorNodeCondition,
  createDesenEditorContinuousValidator,
  createDesenEditorDocument,
  createDesenEditorPersistencePort,
  deleteDesenEditorAction,
  deleteDesenEditorEventHandler,
  deleteDesenEditorNode,
  deleteDesenEditorOwnerProp,
  deleteDesenEditorOwnerStyleProperty,
  deleteDesenEditorResourceInput,
  deleteDesenEditorStateDeclaration,
  deleteDesenEditorVariant,
  deleteDesenEditorVariantProp,
  deleteDesenEditorVariantStyleProperty,
  insertDesenEditorAction,
  insertDesenEditorEventHandler,
  insertDesenEditorNode,
  insertDesenEditorStateDeclaration,
  insertDesenEditorVariant,
  moveDesenEditorNode,
  reorderDesenEditorAction,
  reorderDesenEditorNode,
  reorderDesenEditorVariant,
  replaceDesenEditorAction,
  setDesenEditorNodeCondition,
  setDesenEditorNodeRepeatItems,
  setDesenEditorNodeRepeatKey,
  setDesenEditorOwnerProp,
  setDesenEditorOwnerStyleProperty,
  setDesenEditorResourceInput,
  setDesenEditorStateInitial,
  setDesenEditorStateSchema,
  setDesenEditorVariantCondition,
  setDesenEditorVariantProp,
  setDesenEditorVariantStyleProperty,
} from "@desen/editor-core";

import type {
  DesenEditorAction,
  DesenEditorActionDeleteCommand,
  DesenEditorActionInsertCommand,
  DesenEditorActionListPointer,
  DesenEditorActionPointer,
  DesenEditorActionReorderCommand,
  DesenEditorActionReplaceCommand,
  DesenEditorBindingValue,
  DesenEditorContentEditDiagnostic,
  DesenEditorContentEditDiagnosticCode,
  DesenEditorContentEditFailure,
  DesenEditorContentEditResult,
  DesenEditorContentEditSuccess,
  DesenEditorContentPredicate,
  DesenEditorContentValue,
  DesenEditorContentVariant,
  DesenEditorContinuousValidationReport,
  DesenEditorContinuousValidator,
  DesenEditorContinuousValidatorCreationFailure,
  DesenEditorContinuousValidatorCreationResult,
  DesenEditorContinuousValidatorCreationSuccess,
  DesenEditorDocument,
  DesenEditorDocumentCreationFailure,
  DesenEditorDocumentCreationResult,
  DesenEditorDocumentCreationSuccess,
  DesenEditorEventActionEditDiagnostic,
  DesenEditorEventActionEditDiagnosticCode,
  DesenEditorEventActionEditFailure,
  DesenEditorEventActionEditResult,
  DesenEditorEventActionEditSuccess,
  DesenEditorEventHandlerDeleteCommand,
  DesenEditorEventHandlerInsertCommand,
  DesenEditorNodeConditionClearCommand,
  DesenEditorNodeConditionSetCommand,
  DesenEditorNodeDeleteCommand,
  DesenEditorNodeInsertCommand,
  DesenEditorNodeInsertFailure,
  DesenEditorNodeInsertResult,
  DesenEditorNodeInsertSuccess,
  DesenEditorNodeMoveCommand,
  DesenEditorNodeRepeatItemsSetCommand,
  DesenEditorNodeRepeatKeySetCommand,
  DesenEditorNodeReorderCommand,
  DesenEditorOwnerPropDeleteCommand,
  DesenEditorOwnerPropSetCommand,
  DesenEditorOwnerStylePropertyDeleteCommand,
  DesenEditorOwnerStylePropertySetCommand,
  DesenEditorPersistenceAdapter,
  DesenEditorPersistenceAdapterSourceRecord,
  DesenEditorPersistenceAdapterWriteRequest,
  DesenEditorPersistenceAdapterWriteResult,
  DesenEditorPersistenceDiagnosticCode,
  DesenEditorPersistencePort,
  DesenEditorInvalidSubjectMapping,
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
  DesenEditorStructuralEditFailure,
  DesenEditorStructuralEditResult,
  DesenEditorStructuralEditSuccess,
  DesenEditorSourceOpenResult,
  DesenEditorSourceSaveRequest,
  DesenEditorSourceSaveResult,
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
declare const publicInvalidSubjectMapping: DesenEditorInvalidSubjectMapping;

const continuousCreation: DesenEditorContinuousValidatorCreationResult =
  createDesenEditorContinuousValidator(input);
if (continuousCreation.ok) {
  const success: DesenEditorContinuousValidatorCreationSuccess = continuousCreation;
  const validator: DesenEditorContinuousValidator = success.validator;
  const report: DesenEditorContinuousValidationReport = validator.validate(document);
  const documentFingerprint: string | null = report.documentFingerprint;
  const catalogSetFingerprint: string = report.catalogSetFingerprint;
  const firstInvalidSubject: DesenEditorInvalidSubjectMapping | undefined =
    report.invalidSubjects[0];
  const firstUnmappedDiagnostic: number | undefined = report.unmappedDiagnosticIndexes[0];

  // @ts-expect-error emitted continuous validators keep their Catalog identity immutable
  validator.catalogSetFingerprint = "sha256:changed";

  // @ts-expect-error emitted continuous validation is synchronous
  const asynchronousReport: Promise<DesenEditorContinuousValidationReport> =
    validator.validate(document);

  // @ts-expect-error reports expose no Source snapshot
  const leakedDocument = report.document;

  // @ts-expect-error invalid-subject groups are recursively immutable
  publicInvalidSubjectMapping.diagnosticIndexes.push(0);

  // @ts-expect-error the public validator accepts an admitted direct editor Source
  validator.validate({});

  void documentFingerprint;
  void catalogSetFingerprint;
  void firstInvalidSubject;
  void firstUnmappedDiagnostic;
  void asynchronousReport;
  void leakedDocument;
} else {
  const failure: DesenEditorContinuousValidatorCreationFailure = continuousCreation;
  const diagnosticCode: string = failure.diagnostics[0]?.code ?? "none";

  // @ts-expect-error a rejected Catalog set exposes no partial validator
  const partialValidator = failure.validator;

  void diagnosticCode;
  void partialValidator;
}

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

const bindingValue: DesenEditorBindingValue = { $ref: "state.email" };
const stateDeclaration: DesenEditorStateDeclaration = {
  schema: { type: "string" },
  initial: "",
};
const stateBindingDiagnosticCode: DesenEditorStateBindingEditDiagnosticCode =
  "run.desen.editor/STATE_BINDING_EDIT_PATH_NOT_FOUND";
const stateBindingDiagnostic: DesenEditorStateBindingEditDiagnostic = {
  code: stateBindingDiagnosticCode,
  message: "The selected state/binding path does not exist.",
};

const stateInsertCommand: DesenEditorStateDeclarationInsertCommand = {
  surfaceId: "main",
  name: "profile",
  declaration: stateDeclaration,
};
const stateDeleteCommand: DesenEditorStateDeclarationDeleteCommand = {
  surfaceId: "main",
  name: "profile",
};
const stateSchemaCommand: DesenEditorStateSchemaSetCommand = {
  surfaceId: "main",
  name: "profile",
  schema: { type: "object" },
};
const stateInitialCommand: DesenEditorStateInitialSetCommand = {
  surfaceId: "main",
  name: "profile",
  initial: { $ref: "state.email", literal: true },
};
const repeatItemsCommand: DesenEditorNodeRepeatItemsSetCommand = {
  surfaceId: "main",
  nodeId: "main.item",
  items: bindingValue,
};
const repeatKeyCommand: DesenEditorNodeRepeatKeySetCommand = {
  surfaceId: "main",
  nodeId: "main.item",
  key: { $ref: "item.row.id" },
};
const resourceInputSetCommand: DesenEditorResourceInputSetCommand = {
  surfaceId: "main",
  resourceId: "profile",
  name: "query",
  value: bindingValue,
};
const resourceInputDeleteCommand: DesenEditorResourceInputDeleteCommand = {
  surfaceId: "main",
  resourceId: "profile",
  name: "query",
};

const stateBindingEdits: readonly DesenEditorStateBindingEditResult[] = [
  insertDesenEditorStateDeclaration(document, stateInsertCommand),
  deleteDesenEditorStateDeclaration(document, stateDeleteCommand),
  setDesenEditorStateSchema(document, stateSchemaCommand),
  setDesenEditorStateInitial(document, stateInitialCommand),
  setDesenEditorNodeRepeatItems(document, repeatItemsCommand),
  setDesenEditorNodeRepeatKey(document, repeatKeyCommand),
  setDesenEditorResourceInput(document, resourceInputSetCommand),
  deleteDesenEditorResourceInput(document, resourceInputDeleteCommand),
];

for (const stateBindingEdit of stateBindingEdits) {
  if (stateBindingEdit.ok) {
    const success: DesenEditorStateBindingEditSuccess = stateBindingEdit;
    const next: DesenEditorDocument = success.document;
    const diagnostics: readonly [] = success.diagnostics;

    // @ts-expect-error state/binding successes keep the next Source immutable
    success.document.entry = "mutated";

    // @ts-expect-error state/binding success diagnostics are empty
    const impossibleDiagnostic = success.diagnostics[0];

    void next;
    void diagnostics;
    void impossibleDiagnostic;
  } else {
    const failure: DesenEditorStateBindingEditFailure = stateBindingEdit;
    const diagnosticCode: string = failure.diagnostics[0].code;

    // @ts-expect-error state/binding failures expose no partial Source
    const partialDocument = failure.document;

    void diagnosticCode;
    void partialDocument;
  }
}

// @ts-expect-error state declaration-insert command fields remain readonly
stateInsertCommand.declaration = stateDeclaration;

// @ts-expect-error state declaration-delete command fields remain readonly
stateDeleteCommand.name = "other";

// @ts-expect-error state schema-set command fields remain readonly
stateSchemaCommand.schema = { type: "number" };

// @ts-expect-error state initial-set command fields remain readonly
stateInitialCommand.initial = null;

// @ts-expect-error repeat items-set command fields remain readonly
repeatItemsCommand.items = { $ref: "state.other" };

// @ts-expect-error repeat key-set command fields remain readonly
repeatKeyCommand.key = { $ref: "item.row.other" };

// @ts-expect-error resource input-set command fields remain readonly
resourceInputSetCommand.value = "mutated";

// @ts-expect-error resource input-delete command fields remain readonly
resourceInputDeleteCommand.name = "other";

// @ts-expect-error structural validator codes are not project-owned state/binding edit codes
const invalidStateBindingDiagnosticCode: DesenEditorStateBindingEditDiagnosticCode =
  "SCHEMA_INVALID";

void stateBindingDiagnostic;
void invalidStateBindingDiagnosticCode;

const eventActionGuard = { op: "truthy", args: [true] } as const;
const eventActions = [
  {
    type: "state.set",
    path: "profile.name",
    value: { $ref: "state.profile", fallback: null },
    when: eventActionGuard,
  },
  { type: "state.toggle", path: "profile.enabled" },
  { type: "navigate", surface: "future", params: { tab: "profile" } },
  {
    type: "operation.invoke",
    operation: "com.example.profile/Save",
    as: "saveProfile",
    input: { profile: { $ref: "state.profile" } },
    concurrency: "replace",
    onSuccess: [{ type: "event.emit", name: "profile.saved" }],
    onFailure: [{ type: "resource.refresh", resource: "profile" }],
  },
  { type: "resource.refresh", resource: "profile" },
  {
    type: "component.command",
    target: "profile.form",
    command: "focus",
    input: { field: "name" },
  },
  {
    type: "event.emit",
    name: "profile.changed",
    payload: { value: { $ref: "state.profile" } },
    extensions: { "com.example.action": { retained: true } },
  },
] as const satisfies readonly DesenEditorAction[];

const rootActionListPointer: DesenEditorActionListPointer = "/on/submit";
const nestedActionListPointer: DesenEditorActionListPointer = "/on/submit/0/onSuccess";
const rootActionPointer: DesenEditorActionPointer = "/on/submit/0";
const nestedActionPointer: DesenEditorActionPointer = "/on/submit/0/onFailure/0";
const eventActionDiagnosticCode: DesenEditorEventActionEditDiagnosticCode =
  "run.desen.editor/EVENT_ACTION_EDIT_PATH_NOT_FOUND";
const eventActionDiagnostic: DesenEditorEventActionEditDiagnostic = {
  code: eventActionDiagnosticCode,
  message: "The selected event/action path does not exist.",
};

const eventHandlerInsertCommand: DesenEditorEventHandlerInsertCommand = {
  surfaceId: "main",
  ownerId: "main.form",
  event: "submit",
  actions: eventActions,
};
const eventHandlerDeleteCommand: DesenEditorEventHandlerDeleteCommand = {
  surfaceId: "main",
  ownerId: "main.form",
  event: "submit",
};
const actionInsertCommand: DesenEditorActionInsertCommand = {
  surfaceId: "main",
  ownerId: "main.form",
  actionListPointer: nestedActionListPointer,
  index: 0,
  action: eventActions[6],
};
const actionReplaceCommand: DesenEditorActionReplaceCommand = {
  surfaceId: "main",
  ownerId: "main.form",
  actionPointer: nestedActionPointer,
  action: eventActions[2],
};
const actionDeleteCommand: DesenEditorActionDeleteCommand = {
  surfaceId: "main",
  ownerId: "main.form",
  actionPointer: rootActionPointer,
};
const actionReorderCommand: DesenEditorActionReorderCommand = {
  surfaceId: "main",
  ownerId: "main.form",
  actionPointer: rootActionPointer,
  index: 1,
};

const eventActionEdits: readonly DesenEditorEventActionEditResult[] = [
  insertDesenEditorEventHandler(document, eventHandlerInsertCommand),
  deleteDesenEditorEventHandler(document, eventHandlerDeleteCommand),
  insertDesenEditorAction(document, actionInsertCommand),
  replaceDesenEditorAction(document, actionReplaceCommand),
  deleteDesenEditorAction(document, actionDeleteCommand),
  reorderDesenEditorAction(document, actionReorderCommand),
];

for (const eventActionEdit of eventActionEdits) {
  if (eventActionEdit.ok) {
    const success: DesenEditorEventActionEditSuccess = eventActionEdit;
    const next: DesenEditorDocument = success.document;
    const diagnostics: readonly [] = success.diagnostics;

    // @ts-expect-error event/action successes keep the next Source immutable
    success.document.entry = "mutated";

    // @ts-expect-error event/action success diagnostics are empty
    const impossibleDiagnostic = success.diagnostics[0];

    void next;
    void diagnostics;
    void impossibleDiagnostic;
  } else {
    const failure: DesenEditorEventActionEditFailure = eventActionEdit;
    const diagnosticCode: string = failure.diagnostics[0].code;

    // @ts-expect-error event/action failures expose no partial Source
    const partialDocument = failure.document;

    void diagnosticCode;
    void partialDocument;
  }
}

// @ts-expect-error structural validator codes are not project-owned event/action edit codes
const invalidEventActionDiagnosticCode: DesenEditorEventActionEditDiagnosticCode = "SCHEMA_INVALID";

// @ts-expect-error event handler-insert command fields remain readonly
eventHandlerInsertCommand.event = "replacement";

// @ts-expect-error event handler action arrays remain readonly
eventHandlerInsertCommand.actions.push(eventActions[0]);

// @ts-expect-error event handler insertion requires a complete actions array
const incompleteEventHandler: DesenEditorEventHandlerInsertCommand = {
  surfaceId: "main",
  ownerId: "main.form",
  event: "submit",
};
void incompleteEventHandler;

// @ts-expect-error action insertion requires an exact numeric position
const incompleteActionInsert: DesenEditorActionInsertCommand = {
  surfaceId: "main",
  ownerId: "main.form",
  actionListPointer: rootActionListPointer,
  action: eventActions[0],
};
void incompleteActionInsert;

// @ts-expect-error action replacement requires a complete replacement action
const incompleteActionReplace: DesenEditorActionReplaceCommand = {
  surfaceId: "main",
  ownerId: "main.form",
  actionPointer: rootActionPointer,
};
void incompleteActionReplace;

// @ts-expect-error action deletion requires an exact action pointer
const incompleteActionDelete: DesenEditorActionDeleteCommand = {
  surfaceId: "main",
  ownerId: "main.form",
};
void incompleteActionDelete;

// @ts-expect-error action reorder requires its post-removal final index
const incompleteActionReorder: DesenEditorActionReorderCommand = {
  surfaceId: "main",
  ownerId: "main.form",
  actionPointer: rootActionPointer,
};
void incompleteActionReorder;

const broadEventHandlerAuthority: DesenEditorEventHandlerInsertCommand = {
  ...eventHandlerInsertCommand,
  // @ts-expect-error event handler insertion cannot declare Catalog event authority
  declareEvent: true,
};
void broadEventHandlerAuthority;

const broadActionAuthority: DesenEditorActionReplaceCommand = {
  ...actionReplaceCommand,
  // @ts-expect-error complete action replacement exposes no generic leaf-patch authority
  valuePointer: "/payload/value",
};
void broadActionAuthority;

const broadSettlementAuthority: DesenEditorActionInsertCommand = {
  ...actionInsertCommand,
  // @ts-expect-error settlement branches are addressed only by the owner-relative pointer
  outcome: "onSuccess",
};
void broadSettlementAuthority;

const executableEventPayload: DesenEditorAction = {
  type: "event.emit",
  name: "profile.changed",
  payload: {
    // @ts-expect-error event payload values are inert ValueSpecs, not executable callbacks
    value: () => true,
  },
};
void executableEventPayload;

// @ts-expect-error a state.set action requires its complete value
const incompleteStateSetAction: DesenEditorAction = {
  type: "state.set",
  path: "profile.name",
};
void incompleteStateSetAction;

// @ts-expect-error operation.invoke requires a complete inert input map
const incompleteOperationAction: DesenEditorAction = {
  type: "operation.invoke",
  operation: "com.example.profile/Save",
  as: "saveProfile",
};
void incompleteOperationAction;

// @ts-expect-error the emitted action union remains closed to seven DESEN 0.1.0 variants
const openEventAction: DesenEditorAction = { type: "future.execute", value: true };
void openEventAction;

const executableActionCommand: DesenEditorActionInsertCommand = {
  ...actionInsertCommand,
  // @ts-expect-error emitted action commands cannot carry executable authority
  action: () => "execute",
};
void executableActionCommand;

// @ts-expect-error an action-list pointer must begin with the owner-relative /on root
const malformedListPointer: DesenEditorActionListPointer = "on/submit";
void malformedListPointer;

// @ts-expect-error an action pointer must remain rooted in the owner-relative /on map
const incompletePublicActionPointer: DesenEditorActionPointer = "/actions/0";
void incompletePublicActionPointer;

void eventActionDiagnostic;
void invalidEventActionDiagnosticCode;

// @ts-expect-error emitted root authoring data remains recursively immutable
document.authoring = { selection: null };

if (document.authoring !== undefined) {
  // @ts-expect-error emitted authoring entries cannot be changed outside an immutable transition
  document.authoring.selection = { surfaceId: "other" };
}

// @ts-expect-error emitted root extension data remains recursively immutable
document.extensions = { "com.example.changed": true };

if (document.extensions !== undefined) {
  // @ts-expect-error emitted unknown extension entries remain recursively immutable
  document.extensions["com.example.changed"] = true;
}

const publicAuthoringAuthority: DesenEditorNodeInsertCommand = {
  ...command,
  // @ts-expect-error existing emitted commands cannot smuggle root authoring authority
  authoring: { selection: null },
};

const publicExtensionAuthority: DesenEditorNodeInsertCommand = {
  ...command,
  // @ts-expect-error existing emitted commands cannot smuggle generic extension authority
  extensions: { "com.example.changed": true },
};

void publicAuthoringAuthority;
void publicExtensionAuthority;

declare const persistenceAdapter: DesenEditorPersistenceAdapter;
declare const persistenceAdapterRequest: DesenEditorPersistenceAdapterWriteRequest;
declare const persistenceRecord: DesenEditorPersistenceAdapterSourceRecord;
declare const publicOpenResult: DesenEditorSourceOpenResult;
declare const publicSaveResult: DesenEditorSourceSaveResult;

const persistencePort: DesenEditorPersistencePort =
  createDesenEditorPersistencePort(persistenceAdapter);
const publicCreateSaveRequest: DesenEditorSourceSaveRequest = {
  sourceKey: "source-a",
  expectedGeneration: null,
  document,
};

const publicReceiverBoundRead = async function (
  this: { readonly token: string },
  sourceKey: string,
) {
  void sourceKey;
  return { status: "missing" } as const;
};

// @ts-expect-error emitted adapter callbacks cannot require a receiver
const publicInvalidReceiverRead: DesenEditorPersistenceAdapter["readSource"] =
  publicReceiverBoundRead;

// @ts-expect-error emitted save preconditions are required rather than inferred
const publicMissingExpectedGeneration: DesenEditorSourceSaveRequest = {
  sourceKey: "source-a",
  document,
};

const publicStringGeneration: DesenEditorSourceSaveRequest = {
  sourceKey: "source-a",
  // @ts-expect-error emitted save generations are exactly number or null
  expectedGeneration: "1",
  document,
};

const publicInvalidCreatedSettlement: DesenEditorPersistenceAdapterWriteResult = {
  status: "created",
  // @ts-expect-error emitted create settlements expose only generation one
  generation: 2,
};

const publicBroadAdapterRequest: DesenEditorPersistenceAdapterWriteRequest = {
  sourceKey: "source-a",
  expectedGeneration: null,
  bytes: new Uint8Array(),
  // @ts-expect-error the neutral emitted request carries no filesystem authority
  path: "/tmp/source.json",
};

// @ts-expect-error emitted adapter requests keep storage identity immutable
persistenceAdapterRequest.sourceKey = "source-b";

// @ts-expect-error emitted adapter requests keep the CAS precondition immutable
persistenceAdapterRequest.expectedGeneration = 2;

// @ts-expect-error emitted public save requests are immutable transition values
publicCreateSaveRequest.document = document;

// @ts-expect-error emitted adapter contracts cannot have callbacks replaced
persistenceAdapter.readSource = async () => ({ status: "missing" });

// @ts-expect-error emitted captured ports cannot have callbacks replaced
persistencePort.openSource = async () => ({ status: "missing" });

// @ts-expect-error emitted stored parsed values remain unknown until core readmission
const publicTrustedStoredDocument: DesenEditorDocument = persistenceRecord.value;

if (publicOpenResult.status === "opened") {
  // @ts-expect-error emitted opened documents remain recursively immutable
  publicOpenResult.document.id = "mutated";

  // @ts-expect-error an emitted open success has no failure diagnostic
  const publicImpossibleOpenDiagnostic = publicOpenResult.diagnostic;
  void publicImpossibleOpenDiagnostic;
} else if (publicOpenResult.status === "missing") {
  // @ts-expect-error an emitted missing result exposes no partial Source
  const publicPartialOpenedDocument = publicOpenResult.document;
  void publicPartialOpenedDocument;
}

if (publicSaveResult.status === "conflict") {
  // @ts-expect-error an emitted conflict does not claim a committed generation
  const publicCommittedConflictGeneration = publicSaveResult.generation;
  void publicCommittedConflictGeneration;
} else if (publicSaveResult.status === "failed") {
  // @ts-expect-error an emitted definite failure has no current conflict generation
  const publicFailedCurrentGeneration = publicSaveResult.currentGeneration;
  void publicFailedCurrentGeneration;
} else if (publicSaveResult.status === "indeterminate") {
  // @ts-expect-error an emitted uncertain commit cannot expose a trustworthy generation
  const publicIndeterminateGeneration = publicSaveResult.generation;
  void publicIndeterminateGeneration;
}

// @ts-expect-error the minimal emitted port exposes no storage lifecycle authority
persistencePort.close();

// @ts-expect-error the minimal emitted port cannot enumerate Source identities
persistencePort.listSources();

// @ts-expect-error the minimal emitted port cannot delete a Source identity
persistencePort.deleteSource("source-a");

// @ts-expect-error emitted persistence diagnostics stay a closed namespaced union
const publicInvalidPersistenceDiagnostic: DesenEditorPersistenceDiagnosticCode =
  "run.desen.editor/PERSISTENCE_PRIVATE_PROVIDER_ERROR";

void publicInvalidReceiverRead;
void publicMissingExpectedGeneration;
void publicStringGeneration;
void publicInvalidCreatedSettlement;
void publicBroadAdapterRequest;
void publicTrustedStoredDocument;
void publicInvalidPersistenceDiagnostic;
