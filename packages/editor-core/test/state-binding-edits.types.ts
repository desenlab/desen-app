import {
  deleteDesenEditorResourceInput,
  deleteDesenEditorStateDeclaration,
  insertDesenEditorStateDeclaration,
  setDesenEditorNodeRepeatItems,
  setDesenEditorNodeRepeatKey,
  setDesenEditorResourceInput,
  setDesenEditorStateInitial,
  setDesenEditorStateSchema,
} from "../src/state-binding-edits.js";

import type {
  DesenEditorBindingValue,
  DesenEditorNodeRepeatItemsSetCommand,
  DesenEditorNodeRepeatKeySetCommand,
  DesenEditorResourceInputDeleteCommand,
  DesenEditorResourceInputSetCommand,
  DesenEditorStateBindingEditDiagnosticCode,
  DesenEditorStateBindingEditFailure,
  DesenEditorStateBindingEditResult,
  DesenEditorStateBindingEditSuccess,
  DesenEditorStateDeclaration,
  DesenEditorStateDeclarationDeleteCommand,
  DesenEditorStateDeclarationInsertCommand,
  DesenEditorStateInitialSetCommand,
  DesenEditorStateSchemaSetCommand,
} from "../src/state-binding-edits.js";
import type { DesenEditorDocument } from "../src/source-document.js";

declare const document: DesenEditorDocument;

const declaration: DesenEditorStateDeclaration = {
  schema: { type: "object", properties: { value: { type: "string" } } },
  initial: { value: "initial" },
  extensions: { "com.example.state": { retained: true } },
};
const binding: DesenEditorBindingValue = {
  $ref: "resource.rows.value",
  fallback: [],
};

const stateInsert: DesenEditorStateDeclarationInsertCommand = {
  surfaceId: "main",
  name: "profile.name",
  declaration,
};
const stateDelete: DesenEditorStateDeclarationDeleteCommand = {
  surfaceId: "main",
  name: "profile.name",
};
const schemaSet: DesenEditorStateSchemaSetCommand = {
  surfaceId: "main",
  name: "profile.name",
  schema: { type: "string" },
};
const initialSet: DesenEditorStateInitialSetCommand = {
  surfaceId: "main",
  name: "profile.name",
  initial: { $ref: "marker-shaped-inert-state-data" },
};
const repeatItemsSet: DesenEditorNodeRepeatItemsSetCommand = {
  surfaceId: "main",
  nodeId: "main.row",
  items: binding,
};
const repeatKeySet: DesenEditorNodeRepeatKeySetCommand = {
  surfaceId: "main",
  nodeId: "main.row",
  key: { $ref: "item.row.id" },
};
const resourceInputSet: DesenEditorResourceInputSetCommand = {
  surfaceId: "main",
  resourceId: "rows",
  name: "__proto__",
  value: binding,
};
const resourceInputDelete: DesenEditorResourceInputDeleteCommand = {
  surfaceId: "main",
  resourceId: "rows",
  name: "__proto__",
};

const results: readonly DesenEditorStateBindingEditResult[] = [
  insertDesenEditorStateDeclaration(document, stateInsert),
  deleteDesenEditorStateDeclaration(document, stateDelete),
  setDesenEditorStateSchema(document, schemaSet),
  setDesenEditorStateInitial(document, initialSet),
  setDesenEditorNodeRepeatItems(document, repeatItemsSet),
  setDesenEditorNodeRepeatKey(document, repeatKeySet),
  setDesenEditorResourceInput(document, resourceInputSet),
  deleteDesenEditorResourceInput(document, resourceInputDelete),
];

const commandCode: DesenEditorStateBindingEditDiagnosticCode =
  "run.desen.editor/STATE_BINDING_EDIT_COMMAND_INVALID";
void commandCode;

// @ts-expect-error editor diagnostics cannot impersonate a frozen core diagnostic code
const coreCode: DesenEditorStateBindingEditDiagnosticCode = "SCHEMA_INVALID";
void coreCode;

for (const result of results) {
  if (result.ok) {
    const success: DesenEditorStateBindingEditSuccess = result;
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
    const failure: DesenEditorStateBindingEditFailure = result;
    const code: string = failure.diagnostics[0].code;

    // @ts-expect-error atomic failure exposes no partial document
    const partialDocument = failure.document;

    void code;
    void partialDocument;
  }
}

// @ts-expect-error command fields are immutable
stateInsert.name = "replacement";

const executableInitial: DesenEditorStateInitialSetCommand = {
  surfaceId: "main",
  name: "profile.name",
  // @ts-expect-error state initial values are inert JSON, not executable callbacks
  initial: () => "executable",
};
void executableInitial;

// @ts-expect-error binding values are inert ValueSpecs, not executable callbacks
const executableBinding: DesenEditorBindingValue = () => true;
void executableBinding;

// @ts-expect-error a complete state declaration requires its initial value
const incompleteDeclaration: DesenEditorStateDeclaration = {
  schema: { type: "string" },
};
void incompleteDeclaration;

// @ts-expect-error state insertion requires a complete declaration
const incompleteInsert: DesenEditorStateDeclarationInsertCommand = {
  surfaceId: "main",
  name: "profile.name",
};
void incompleteInsert;

const broadStateAuthority: DesenEditorStateDeclarationInsertCommand = {
  ...stateInsert,
  // @ts-expect-error state insertion accepts no rename or reference-cascade authority
  rewriteReferences: true,
};
void broadStateAuthority;

const broadRepeatAuthority: DesenEditorNodeRepeatItemsSetCommand = {
  ...repeatItemsSet,
  // @ts-expect-error repeat-items editing cannot create or replace the complete repeat
  as: "row",
};
void broadRepeatAuthority;

const genericTargetAuthority: DesenEditorResourceInputSetCommand = {
  ...resourceInputSet,
  // @ts-expect-error the API uses exact commands rather than a generic path/discriminant target
  target: { kind: "resource-input", resourceId: "rows", name: "value" },
};
void genericTargetAuthority;

// @ts-expect-error repeat key commands require a complete key ValueSpec
const missingRepeatKey: DesenEditorNodeRepeatKeySetCommand = {
  surfaceId: "main",
  nodeId: "main.row",
};
void missingRepeatKey;

// @ts-expect-error resource input deletion requires the exact resource identity
const missingResource: DesenEditorResourceInputDeleteCommand = {
  surfaceId: "main",
  name: "value",
};
void missingResource;
