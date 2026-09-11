import { insertDesenEditorSubtree } from "../src/index.js";

import type { DesenEditorDocument, DesenEditorSubtreeInsertCommand } from "../src/index.js";

declare const document: DesenEditorDocument;

const command: DesenEditorSubtreeInsertCommand = {
  surfaceId: "home",
  parentId: "home.root",
  slot: "content",
  index: 0,
  subtree: {
    id: "starter.dialog",
    use: "run.desen.starter/Dialog",
    slots: {
      content: [{ id: "starter.dialog.content", use: "run.desen.starter/Button" }],
    },
  },
};

const result = insertDesenEditorSubtree(document, command);
if (result.ok) {
  const insertedId: string = result.insertedNodeId;
  // @ts-expect-error Successful editor documents are recursively immutable.
  result.document.id = "mutated";
  void insertedId;
} else {
  // @ts-expect-error Failures expose no partial document.
  void result.document;
}

const invalidSubtree: DesenEditorSubtreeInsertCommand = {
  surfaceId: "home",
  parentId: "home.root",
  slot: "content",
  index: 0,
  subtree: {
    // @ts-expect-error Every Source node requires an inert string identity.
    id: 1,
    use: "run.desen.starter/Button",
  },
};

const executableCommand: DesenEditorSubtreeInsertCommand = {
  surfaceId: "home",
  parentId: "home.root",
  slot: "content",
  index: 0,
  subtree: { id: "starter.button", use: "run.desen.starter/Button" },
  // @ts-expect-error The command surface carries no callback authority.
  onInsert: () => undefined,
};

void [invalidSubtree, executableCommand];
