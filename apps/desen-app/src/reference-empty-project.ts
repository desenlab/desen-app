import { createDesenEditorDocument } from "@desen/editor-core";

import type { DesenEditorDocument } from "@desen/editor-core";

const EMPTY_REFERENCE_SOURCE = Object.freeze({
  kind: "desen.source",
  desen: "0.1.0",
  id: "com.example.account-app",
  catalogs: Object.freeze([
    Object.freeze({
      id: "run.desen.reference.sign-in",
      version: "0.1.0",
      target: "web-react",
    }),
  ]),
  entry: "sign-in",
  surfaces: Object.freeze({
    "sign-in": Object.freeze({
      id: "sign-in",
      state: Object.freeze({}),
      resources: Object.freeze({}),
      root: Object.freeze({
        id: "sign-in.layout",
        use: "com.example.ui/Stack",
        props: Object.freeze({
          direction: "vertical",
          gap: "md",
          maxWidth: 420,
        }),
      }),
    }),
  }),
  authoring: Object.freeze({
    canvas: Object.freeze({
      "sign-in": Object.freeze({ x: 0, y: 0, width: 420, height: 720 }),
    }),
  }),
  extensions: Object.freeze({}),
});

function admitEmptyReferenceProject(): DesenEditorDocument {
  const admitted = createDesenEditorDocument(EMPTY_REFERENCE_SOURCE);
  if (!admitted.ok) {
    throw new TypeError("The empty reference project could not be admitted for authoring.");
  }
  return admitted.document;
}

/**
 * Exact empty-project bootstrap used by the real-browser authoring proof.
 *
 * @remarks The bootstrap fixes only the Source identity, exact reference Catalog requirement,
 * one empty sign-in surface, its required Stack root, and its declared 420 by 720 authoring frame.
 * It contains no child component, local state, binding, event, or action and is structurally
 * re-admitted before export.
 */
export const EMPTY_REFERENCE_PROJECT_DOCUMENT: DesenEditorDocument = admitEmptyReferenceProject();
