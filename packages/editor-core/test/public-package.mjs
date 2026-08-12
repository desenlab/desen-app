import assert from "node:assert/strict";
import test from "node:test";
import { URL } from "node:url";

import validSource from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json" with { type: "json" };
import * as editorCore from "@desen/editor-core";

test("the built public package exposes only the direct Source document factory", () => {
  assert.equal(
    import.meta.resolve("@desen/editor-core"),
    new URL("../dist/index.js", import.meta.url).href,
  );
  assert.deepEqual(Object.keys(editorCore), ["createDesenEditorDocument"]);

  const result = editorCore.createDesenEditorDocument(validSource);
  assert.equal(result.ok, true);
  if (!result.ok) throw new TypeError("Expected the official Source through the public package.");

  assert.deepEqual(Object.keys(result).sort(), ["diagnostics", "document", "ok"]);
  assert.equal(result.document.kind, "desen.source");
  assert.equal(Object.hasOwn(result.document, "source"), false);
  assert.equal(Object.hasOwn(result.document, "nodes"), false);
  assert.equal(Object.isFrozen(result.document), true);
  assert.deepEqual(result.document, validSource);
});
