import { createDesenEditorDocument, insertDesenEditorNode } from "../src/index.js";

import type { DesenEditorDocument, DesenEditorNodeInsertCommand } from "../src/index.js";

declare const document: DesenEditorDocument;

const authoring = document.authoring;
const extensions = document.extensions;

// @ts-expect-error root authoring data remains recursively immutable
document.authoring = { selection: null };

if (document.authoring !== undefined) {
  // @ts-expect-error the authoring map cannot be changed outside an immutable transition
  document.authoring.selection = { surfaceId: "other" };
}

// @ts-expect-error root extension data remains recursively immutable
document.extensions = { "com.example.changed": true };

if (document.extensions !== undefined) {
  // @ts-expect-error unknown extension entries cannot be changed outside an immutable transition
  document.extensions["com.example.changed"] = true;
}

const insertCommand: DesenEditorNodeInsertCommand = {
  surfaceId: "main",
  parentId: "main.root",
  slot: "default",
  index: 0,
  idBase: "main.inserted",
  use: "com.example.ui/Text",
};

const authoringAuthority = {
  ...insertCommand,
  // @ts-expect-error existing exact mutation commands cannot smuggle root authoring authority
  authoring: { selection: null },
} satisfies DesenEditorNodeInsertCommand;

const extensionAuthority = {
  ...insertCommand,
  // @ts-expect-error existing exact mutation commands cannot smuggle generic extension authority
  extensions: { "com.example.changed": true },
} satisfies DesenEditorNodeInsertCommand;

const created = createDesenEditorDocument({});
const inserted = insertDesenEditorNode(document, insertCommand);

void authoring;
void extensions;
void authoringAuthority;
void extensionAuthority;
void created;
void inserted;
