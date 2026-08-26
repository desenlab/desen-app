import { insertDesenEditorNode } from "../src/index.js";

import type {
  DesenEditorDocument,
  DesenEditorInsertDiagnosticCode,
  DesenEditorNodeInsertCommand,
  DesenEditorNodeInsertFailure,
  DesenEditorNodeInsertResult,
  DesenEditorNodeInsertSuccess,
} from "../src/index.js";

declare const document: DesenEditorDocument;

const command: DesenEditorNodeInsertCommand = {
  surfaceId: "main",
  parentId: "main.root",
  slot: "default",
  index: 0,
  idBase: "main.text",
  use: "com.example.ui/Text",
};

const result: DesenEditorNodeInsertResult = insertDesenEditorNode(document, command);
const commandInvalidCode: DesenEditorInsertDiagnosticCode =
  "run.desen.editor/INSERT_COMMAND_INVALID";
void commandInvalidCode;

// @ts-expect-error editor diagnostics cannot impersonate a frozen core diagnostic code
const coreDiagnosticCode: DesenEditorInsertDiagnosticCode = "SCHEMA_INVALID";
void coreDiagnosticCode;
if (result.ok) {
  const success: DesenEditorNodeInsertSuccess = result;
  const insertedId: string = success.insertedNodeId;
  const nextDocument: DesenEditorDocument = success.document;
  const diagnostics: readonly [] = success.diagnostics;

  // @ts-expect-error a successful immutable document cannot be edited in place
  success.document.id = "mutated";

  // @ts-expect-error a success has no diagnostic entry
  const impossibleDiagnostic = success.diagnostics[0];

  void insertedId;
  void nextDocument;
  void diagnostics;
  void impossibleDiagnostic;
} else {
  const failure: DesenEditorNodeInsertFailure = result;
  const code: string = failure.diagnostics[0].code;

  // @ts-expect-error failure exposes no partial document
  const partialDocument = failure.document;

  // @ts-expect-error failure exposes no allocated identity
  const partialIdentity = failure.insertedNodeId;

  void code;
  void partialDocument;
  void partialIdentity;
}

// @ts-expect-error command fields are immutable
command.index = 1;

const explicitIdBypass: DesenEditorNodeInsertCommand = {
  ...command,
  // @ts-expect-error the allocator, not the caller, owns the inserted id
  id: "main.explicit",
};

const broadMutationPayload: DesenEditorNodeInsertCommand = {
  ...command,
  // @ts-expect-error prop editing remains outside the M08-T02 insert command
  props: { text: "not yet" },
};

void explicitIdBypass;
void broadMutationPayload;
