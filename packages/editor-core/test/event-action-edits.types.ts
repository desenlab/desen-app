import {
  deleteDesenEditorAction,
  deleteDesenEditorEventHandler,
  insertDesenEditorAction,
  insertDesenEditorEventHandler,
  reorderDesenEditorAction,
  replaceDesenEditorAction,
} from "../src/event-action-edits.js";

import type {
  DesenEditorAction,
  DesenEditorActionDeleteCommand,
  DesenEditorActionInsertCommand,
  DesenEditorActionListPointer,
  DesenEditorActionPointer,
  DesenEditorActionReorderCommand,
  DesenEditorActionReplaceCommand,
  DesenEditorEventActionEditDiagnosticCode,
  DesenEditorEventActionEditFailure,
  DesenEditorEventActionEditResult,
  DesenEditorEventActionEditSuccess,
  DesenEditorEventHandlerDeleteCommand,
  DesenEditorEventHandlerInsertCommand,
} from "../src/event-action-edits.js";
import type { DesenEditorDocument } from "../src/source-document.js";

declare const document: DesenEditorDocument;

const guard = { op: "truthy", args: [true] } as const;
const actions = [
  {
    type: "state.set",
    path: "profile.name",
    value: { $ref: "state.profile", fallback: null },
    when: guard,
    extensions: { "com.example.action": { retained: true } },
  },
  { type: "state.toggle", path: "profile.enabled", when: guard },
  {
    type: "navigate",
    surface: "future",
    params: { tab: "profile" },
    extensions: { "com.example.action": { retained: true } },
  },
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
  },
] as const satisfies readonly DesenEditorAction[];

const rootListPointer: DesenEditorActionListPointer = "/on/press";
const successListPointer: DesenEditorActionListPointer = "/on/press/0/onSuccess";
const rootActionPointer: DesenEditorActionPointer = "/on/press/0";
const nestedActionPointer: DesenEditorActionPointer = "/on/press/0/onFailure/0";

const handlerInsert: DesenEditorEventHandlerInsertCommand = {
  surfaceId: "main",
  ownerId: "main.form",
  event: "submit",
  actions,
};
const handlerDelete: DesenEditorEventHandlerDeleteCommand = {
  surfaceId: "main",
  ownerId: "main.form",
  event: "submit",
};
const actionInsert: DesenEditorActionInsertCommand = {
  surfaceId: "main",
  ownerId: "main.form",
  actionListPointer: successListPointer,
  index: 0,
  action: actions[6],
};
const actionReplace: DesenEditorActionReplaceCommand = {
  surfaceId: "main",
  ownerId: "main.form",
  actionPointer: nestedActionPointer,
  action: actions[2],
};
const actionDelete: DesenEditorActionDeleteCommand = {
  surfaceId: "main",
  ownerId: "main.form",
  actionPointer: rootActionPointer,
};
const actionReorder: DesenEditorActionReorderCommand = {
  surfaceId: "main",
  ownerId: "main.form",
  actionPointer: rootActionPointer,
  index: 1,
};

const results: readonly DesenEditorEventActionEditResult[] = [
  insertDesenEditorEventHandler(document, handlerInsert),
  deleteDesenEditorEventHandler(document, handlerDelete),
  insertDesenEditorAction(document, actionInsert),
  replaceDesenEditorAction(document, actionReplace),
  deleteDesenEditorAction(document, actionDelete),
  reorderDesenEditorAction(document, actionReorder),
];

const commandCode: DesenEditorEventActionEditDiagnosticCode =
  "run.desen.editor/EVENT_ACTION_EDIT_COMMAND_INVALID";
void commandCode;

// @ts-expect-error editor diagnostics cannot impersonate a frozen core diagnostic code
const coreCode: DesenEditorEventActionEditDiagnosticCode = "SCHEMA_INVALID";
void coreCode;

for (const result of results) {
  if (result.ok) {
    const success: DesenEditorEventActionEditSuccess = result;
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
    const failure: DesenEditorEventActionEditFailure = result;
    const code: string = failure.diagnostics[0].code;

    // @ts-expect-error atomic failure exposes no partial document
    const partialDocument = failure.document;

    void code;
    void partialDocument;
  }
}

// @ts-expect-error command fields are immutable
handlerInsert.event = "replacement";

// @ts-expect-error action arrays are immutable through the command contract
handlerInsert.actions.push(actions[0]);

// @ts-expect-error the event handler insertion command requires a complete actions array
const incompleteHandler: DesenEditorEventHandlerInsertCommand = {
  surfaceId: "main",
  ownerId: "main.form",
  event: "submit",
};
void incompleteHandler;

// @ts-expect-error action insertion requires an exact numeric position
const incompleteActionInsert: DesenEditorActionInsertCommand = {
  surfaceId: "main",
  ownerId: "main.form",
  actionListPointer: rootListPointer,
  action: actions[0],
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

const broadHandlerAuthority: DesenEditorEventHandlerInsertCommand = {
  ...handlerInsert,
  // @ts-expect-error handler insertion cannot rewrite Catalog declarations
  declareEvent: true,
};
void broadHandlerAuthority;

const broadActionAuthority: DesenEditorActionReplaceCommand = {
  ...actionReplace,
  // @ts-expect-error whole-action replacement has no generic path or leaf-patch authority
  valuePointer: "/payload/value",
};
void broadActionAuthority;

const settlementAuthority: DesenEditorActionInsertCommand = {
  ...actionInsert,
  // @ts-expect-error nested action lists are addressed only by the typed owner-relative pointer
  outcome: "onSuccess",
};
void settlementAuthority;

const executablePayload: DesenEditorAction = {
  type: "event.emit",
  name: "profile.changed",
  payload: {
    // @ts-expect-error action payload values are inert ValueSpecs, not executable callbacks
    value: () => true,
  },
};
void executablePayload;

// @ts-expect-error a state.set action requires its complete value
const incompleteStateSet: DesenEditorAction = {
  type: "state.set",
  path: "profile.name",
};
void incompleteStateSet;

// @ts-expect-error operation.invoke requires a complete inert input map
const incompleteOperation: DesenEditorAction = {
  type: "operation.invoke",
  operation: "com.example.profile/Save",
  as: "saveProfile",
};
void incompleteOperation;

// @ts-expect-error the action union remains closed to the seven DESEN 0.1.0 variants
const openAction: DesenEditorAction = { type: "future.execute", value: true };
void openAction;

const executableAction: DesenEditorActionInsertCommand = {
  ...actionInsert,
  // @ts-expect-error an action command cannot carry executable authority
  action: () => "execute",
};
void executableAction;

void rootListPointer;
void successListPointer;
