import { createDesenEditorDocument } from "../src/index.js";

import type { DesenEditorDocument } from "../src/index.js";

declare const document: DesenEditorDocument;

const kind: "desen.source" = document.kind;
void kind;

// @ts-expect-error the direct editor document is recursively immutable
document.id = "mutated";

declare const replacementSurface: DesenEditorDocument["surfaces"][string];
// @ts-expect-error nested Source maps cannot be replaced through the immutable model
document.surfaces.main = replacementSurface;

// @ts-expect-error the document root is the Source itself, not a hidden wrapper
const hiddenSource = document.source;
void hiddenSource;

const result = createDesenEditorDocument({ unknown: true });
if (result.ok) {
  const accepted: DesenEditorDocument = result.document;
  void accepted;

  // @ts-expect-error a success has no structural diagnostics
  const impossibleDiagnostic = result.diagnostics[0];
  void impossibleDiagnostic;
} else {
  const code: string = result.diagnostics[0]?.code ?? "none";
  void code;

  // @ts-expect-error rejected input exposes no partial document
  const partialDocument = result.document;
  void partialDocument;
}
