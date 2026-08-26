import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { URL } from "node:url";

import validSource from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json" with { type: "json" };
import packageManifest from "../package.json" with { type: "json" };
import * as editorCore from "@desen/editor-core";
import {
  buildEditorCoreSourceDocumentEvidence,
  EditorCoreSourceDocumentProofError,
} from "../../../scripts/lib/editor-core-source-document-proof.mjs";

function cloneFixture() {
  return JSON.parse(JSON.stringify(validSource));
}

function contentEditFixture() {
  const input = cloneFixture();
  const root = input.surfaces["sign-in"].root;
  root.behaviors = [
    {
      id: "sign-in.draggable",
      use: "com.example.interactions/Draggable",
      props: { temporary: true },
      style: { base: { handle: { opacity: 1 } } },
    },
  ];
  const submit = root.slots.default.find(({ id }) => id === "sign-in.submit");
  assert.ok(submit);
  submit.variants = [
    {
      when: { op: "eq", args: [{ $ref: "env.colorScheme" }, "dark"] },
      props: { marker: "A", temporary: "remove-me" },
      style: { base: { root: { opacity: 1 } } },
    },
    {
      when: { op: "truthy", args: [{ $ref: "state.email" }] },
      props: { marker: "B" },
    },
    {
      when: { op: "eq", args: [1, 1] },
      props: { marker: "C" },
    },
  ];
  return input;
}

function expectContentEditSuccess(result) {
  assert.equal(result.ok, true);
  if (!result.ok) throw new TypeError("Expected the emitted content edit to succeed.");
  assert.deepEqual(Reflect.ownKeys(result), ["ok", "document", "diagnostics"]);
  assert.deepEqual(result.diagnostics, []);
  assertPlainOwnDataFrozen(result);
  return result.document;
}

function expectContentEditFailure(result, code) {
  assert.equal(result.ok, false);
  if (result.ok) throw new TypeError("Expected the emitted content edit to fail.");
  assert.deepEqual(Reflect.ownKeys(result), ["ok", "diagnostics"]);
  assert.equal(result.diagnostics[0].code, code);
  assert.equal(Object.hasOwn(result, "document"), false);
  assertPlainOwnDataFrozen(result);
}

function surfaceIdentities(document, surfaceId) {
  const identities = [];
  const pending = [document.surfaces[surfaceId].root];
  while (pending.length > 0) {
    const node = pending.pop();
    identities.push(node.id);
    for (const behavior of node.behaviors ?? []) identities.push(behavior.id);
    const slots = node.slots ?? {};
    for (const slot of Object.keys(slots).sort().reverse()) {
      const children = slots[slot];
      for (let index = children.length - 1; index >= 0; index -= 1) {
        pending.push(children[index]);
      }
    }
  }
  return identities;
}

function changedByte(bytes) {
  const changed = Buffer.from(bytes);
  changed[Math.floor(changed.byteLength / 2)] ^= 1;
  return changed;
}

function assertPlainOwnDataFrozen(root) {
  const pending = [root];
  const visited = new Set();

  while (pending.length > 0) {
    const value = pending.pop();
    if (typeof value !== "object" || value === null || visited.has(value)) continue;
    visited.add(value);

    assert.equal(Object.isFrozen(value), true);
    assert.equal(
      Object.getPrototypeOf(value),
      Array.isArray(value) ? Array.prototype : Object.prototype,
    );
    assert.deepEqual(Object.getOwnPropertySymbols(value), []);

    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
      assert.equal(Object.hasOwn(descriptor, "value"), true, `${key} must be an own data property`);
      if (!(Array.isArray(value) && key === "length")) {
        assert.equal(descriptor.enumerable, true, `${key} must be enumerable JSON data`);
      }
      pending.push(descriptor.value);
    }
  }
}

function assertRejected(result, pointer, message) {
  assert.equal(result.ok, false);
  assert.deepEqual(Reflect.ownKeys(result), ["ok", "diagnostics"]);
  assert.equal(Object.hasOwn(result, "document"), false);
  assert.equal(result.diagnostics.length, 1);
  assert.deepEqual(Reflect.ownKeys(result.diagnostics[0]), [
    "code",
    "classification",
    "message",
    "pointer",
  ]);
  assert.deepEqual(result.diagnostics[0], {
    code: "SCHEMA_INVALID",
    classification: "schema",
    message,
    pointer,
  });
  assertPlainOwnDataFrozen(result);
}

function runtimeThatFreezesRejectedCaller(vector) {
  return {
    createDesenEditorDocument(input) {
      const authoring =
        input !== null && typeof input === "object"
          ? Object.getOwnPropertyDescriptor(input, "authoring")?.value
          : undefined;
      const authoringDescriptor =
        authoring !== null && typeof authoring === "object"
          ? Object.getOwnPropertyDescriptor(authoring, vector)
          : undefined;
      const rootDescriptor =
        input !== null && typeof input === "object"
          ? Object.getOwnPropertyDescriptor(input, vector)
          : undefined;
      const matches =
        vector === "selection"
          ? authoringDescriptor !== undefined && !("value" in authoringDescriptor)
          : vector === "executable"
            ? typeof authoringDescriptor?.value === "function"
            : typeof rootDescriptor?.value === "function";
      if (matches) Object.freeze(input);
      return editorCore.createDesenEditorDocument(input);
    },
  };
}

function runtimeThatMutatesInvalidRootDiagnostic(project) {
  return {
    createDesenEditorDocument(input) {
      const result = editorCore.createDesenEditorDocument(input);
      if (result.ok || input?.kind !== "desen.bundle") return result;
      return project(result);
    },
  };
}

function runtimeThatMutatesRejectedCallerGraph() {
  return {
    createDesenEditorDocument(input) {
      const result = editorCore.createDesenEditorDocument(input);
      if (input?.kind === "desen.bundle") {
        Object.defineProperty(input, "proofMutation", {
          value: true,
          configurable: true,
        });
      }
      return result;
    },
  };
}

function hasProofCode(expectedCode) {
  return (error) => {
    assert.ok(error instanceof EditorCoreSourceDocumentProofError);
    assert.equal(error.code, expectedCode);
    return true;
  };
}

function staticModuleSpecifiers(source) {
  return [
    ...source.matchAll(/^\s*(?:import|export)\s+(?:[^"'\n]*?\s+from\s+)?["']([^"']+)["']/gm),
  ].map((match) => match[1]);
}

function replaceLast(source, search, replacement) {
  const index = source.lastIndexOf(search);
  assert.notEqual(index, -1);
  return `${source.slice(0, index)}${replacement}${source.slice(index + search.length)}`;
}

function replaceRegistrationCallbackWithNoop(source, marker, nextMarker = undefined) {
  const registrationStart = source.indexOf(marker);
  const registrationEnd =
    nextMarker === undefined ? source.length : source.indexOf(nextMarker, registrationStart + 1);
  assert.notEqual(registrationStart, -1);
  assert.notEqual(registrationEnd, -1);
  const callbackStart = source.indexOf("() => {", registrationStart);
  const callbackEnd = source.lastIndexOf("});", registrationEnd);
  assert.ok(callbackStart >= registrationStart && callbackStart < registrationEnd);
  assert.ok(callbackEnd > callbackStart);
  return `${source.slice(0, callbackStart)}() => { void 0; }${source.slice(callbackEnd + 1)}`;
}

test("the package manifest keeps one exact root export and the declared runtime dependencies", () => {
  assert.deepEqual(packageManifest, {
    name: "@desen/editor-core",
    version: "0.0.0",
    private: true,
    description:
      "Framework-neutral immutable commands for editing a DESEN Source with stable identity.",
    license: "Apache-2.0",
    type: "module",
    sideEffects: false,
    files: ["dist"],
    exports: {
      ".": {
        types: "./dist/index.d.ts",
        import: "./dist/index.js",
      },
    },
    scripts: {
      build: "tsc -p tsconfig.build.json",
      lint: "eslint src test --max-warnings=0",
      typecheck: "tsc -p tsconfig.json --noEmit",
      test: "vitest run",
      "test:public-package":
        "tsc -p tsconfig.build.json && tsc -p tsconfig.public-package.json --noEmit && node --test test/public-package.mjs",
      "test:content-edits": "vitest run test/content-edits.test.ts",
      "test:source-document": "vitest run test/source-document.test.ts",
      "test:stable-id-insert": "vitest run test/stable-id-insert.test.ts",
      "test:structural-edits": "vitest run test/structural-edits.test.ts",
      "test:coverage": "vitest run --coverage",
    },
    dependencies: {
      "@desen/protocol": "workspace:*",
      "@desen/validator": "workspace:*",
    },
    devDependencies: { vitest: "4.1.10" },
  });
});

test("the emitted public module graph stays platform-neutral and execution-closed", async () => {
  const emittedModules = await Promise.all(
    [
      "index.js",
      "source-document.js",
      "stable-id-insert.js",
      "structural-edits.js",
      "content-edits.js",
    ].map(async (file) => ({
      file,
      source: await readFile(new URL(`../dist/${file}`, import.meta.url), "utf8"),
    })),
  );

  assert.deepEqual(
    emittedModules.map(({ file, source }) => ({
      file,
      specifiers: staticModuleSpecifiers(source),
    })),
    [
      {
        file: "index.js",
        specifiers: [
          "./source-document.js",
          "./stable-id-insert.js",
          "./structural-edits.js",
          "./content-edits.js",
        ],
      },
      { file: "source-document.js", specifiers: ["@desen/validator"] },
      {
        file: "stable-id-insert.js",
        specifiers: ["@desen/protocol", "./source-document.js"],
      },
      {
        file: "structural-edits.js",
        specifiers: ["@desen/protocol", "./source-document.js"],
      },
      {
        file: "content-edits.js",
        specifiers: ["@desen/protocol", "./source-document.js"],
      },
    ],
  );
  assert.match(
    emittedModules[0].source,
    /export\s*\{\s*createDesenEditorDocument\s*\}\s*from\s*["']\.\/source-document\.js["']/,
  );
  assert.match(
    emittedModules[0].source,
    /export\s*\{\s*insertDesenEditorNode\s*\}\s*from\s*["']\.\/stable-id-insert\.js["']/,
  );
  assert.match(
    emittedModules[0].source,
    /export\s*\{\s*deleteDesenEditorNode,\s*moveDesenEditorNode,\s*reorderDesenEditorNode\s*,?\s*\}\s*from\s*["']\.\/structural-edits\.js["']/,
  );
  assert.match(
    emittedModules[0].source,
    /export\s*\{\s*clearDesenEditorNodeCondition,\s*deleteDesenEditorOwnerProp,\s*deleteDesenEditorOwnerStyleProperty,\s*deleteDesenEditorVariant,\s*deleteDesenEditorVariantProp,\s*deleteDesenEditorVariantStyleProperty,\s*insertDesenEditorVariant,\s*reorderDesenEditorVariant,\s*setDesenEditorNodeCondition,\s*setDesenEditorOwnerProp,\s*setDesenEditorOwnerStyleProperty,\s*setDesenEditorVariantCondition,\s*setDesenEditorVariantProp,\s*setDesenEditorVariantStyleProperty\s*,?\s*\}\s*from\s*["']\.\/content-edits\.js["']/,
  );

  const emittedGraph = emittedModules.map(({ source }) => source).join("\n");
  for (const forbidden of [
    /\bimport\s*\(/,
    /\beval\s*\(/,
    /\bReact(?:DOM)?\b/,
    /\b(?:window|navigator|HTMLElement|customElements|MutationObserver|XMLHttpRequest|WebSocket)\b/,
    /\b(?:globalThis\.)?document\s*\.\s*(?:body|head|createElement|querySelector|querySelectorAll|getElementById|addEventListener)\b/,
  ]) {
    assert.doesNotMatch(emittedGraph, forbidden);
  }
});

test("the built public package resolves through its export map and exposes the reviewed runtime exports", () => {
  assert.equal(
    import.meta.resolve("@desen/editor-core"),
    new URL("../dist/index.js", import.meta.url).href,
  );
  assert.deepEqual(Object.keys(editorCore), [
    "clearDesenEditorNodeCondition",
    "createDesenEditorDocument",
    "deleteDesenEditorNode",
    "deleteDesenEditorOwnerProp",
    "deleteDesenEditorOwnerStyleProperty",
    "deleteDesenEditorVariant",
    "deleteDesenEditorVariantProp",
    "deleteDesenEditorVariantStyleProperty",
    "insertDesenEditorNode",
    "insertDesenEditorVariant",
    "moveDesenEditorNode",
    "reorderDesenEditorNode",
    "reorderDesenEditorVariant",
    "setDesenEditorNodeCondition",
    "setDesenEditorOwnerProp",
    "setDesenEditorOwnerStyleProperty",
    "setDesenEditorVariantCondition",
    "setDesenEditorVariantProp",
    "setDesenEditorVariantStyleProperty",
  ]);
});

test("the emitted factory returns the direct plain frozen Source without a hidden model", () => {
  const input = cloneFixture();
  const result = editorCore.createDesenEditorDocument(input);

  assert.equal(result.ok, true);
  if (!result.ok) throw new TypeError("Expected the official Source through the public package.");

  assert.deepEqual(Object.keys(result).sort(), ["diagnostics", "document", "ok"]);
  assert.deepEqual(
    Object.getOwnPropertyNames(result.document).sort(),
    Object.getOwnPropertyNames(validSource).sort(),
  );
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.document, validSource);
  assert.equal(result.document.kind, "desen.source");
  for (const hiddenModelKey of ["source", "nodes", "index", "ast"]) {
    assert.equal(Object.hasOwn(result.document, hiddenModelKey), false);
  }
  assertPlainOwnDataFrozen(result);
});

test("the emitted factory detaches caller input and creates independent snapshots", () => {
  const firstInput = cloneFixture();
  const secondInput = cloneFixture();
  const first = editorCore.createDesenEditorDocument(firstInput);
  const second = editorCore.createDesenEditorDocument(secondInput);

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  if (!first.ok || !second.ok) throw new TypeError("Expected independent Source snapshots.");

  assert.notStrictEqual(first.document, firstInput);
  assert.notStrictEqual(first.document, second.document);
  assert.notStrictEqual(first.document.surfaces, firstInput.surfaces);
  assert.notStrictEqual(first.document.surfaces, second.document.surfaces);
  assert.equal(Object.isFrozen(firstInput), false);
  assert.equal(Object.isFrozen(firstInput.surfaces), false);

  firstInput.id = "caller-mutated";
  firstInput.surfaces.extra = cloneFixture().surfaces["sign-in"];

  assert.equal(first.document.id, validSource.id);
  assert.equal(Object.hasOwn(first.document.surfaces, "extra"), false);
  assert.deepEqual(second.document, validSource);
});

test("the emitted factory admits structurally valid unresolved capability use", () => {
  const input = cloneFixture();
  input.surfaces["sign-in"].root.use = "com.example.unresolved/Unknown";

  const result = editorCore.createDesenEditorDocument(input);

  assert.equal(result.ok, true);
  if (!result.ok) throw new TypeError("Expected structural admission to succeed.");
  assert.equal(result.document.surfaces["sign-in"].root.use, "com.example.unresolved/Unknown");
});

test("the emitted factory rejects an invalid Source root without a partial document", () => {
  const input = cloneFixture();
  input.kind = "desen.bundle";

  const result = editorCore.createDesenEditorDocument(input);

  assertRejected(result, "/kind", "The document violates its const schema constraint.");
  assert.equal(Object.isFrozen(input), false);
  input.id = "rejected-caller-remains-writable";
  assert.equal(input.id, "rejected-caller-remains-writable");
});

test("the emitted factory rejects an invalid embedded schema at its exact pointer", () => {
  const input = cloneFixture();
  input.surfaces["sign-in"].state.email.schema = { type: "string", pattern: "[" };

  const result = editorCore.createDesenEditorDocument(input);

  assertRejected(
    result,
    "/surfaces/sign-in/state/email/schema/pattern",
    "An embedded schema contains an invalid regular expression.",
  );
});

test("the emitted factory rejects executable non-JSON data without a partial document", () => {
  const input = cloneFixture();
  input.authoring = { executable: () => "not data" };

  const result = editorCore.createDesenEditorDocument(input);

  assertRejected(result, "", "Input must be inert RFC 8785-compatible JSON data.");
});

test("the emitted factory rejects getter and toJSON hooks without invoking caller code", () => {
  let getterInvocations = 0;
  let toJsonInvocations = 0;
  const accessorInput = cloneFixture();
  Object.defineProperty(accessorInput.authoring, "selection", {
    enumerable: true,
    get() {
      getterInvocations += 1;
      return { surfaceId: "sign-in" };
    },
  });
  const serializationHookInput = cloneFixture();
  serializationHookInput.toJSON = () => {
    toJsonInvocations += 1;
    return cloneFixture();
  };

  for (const input of [accessorInput, serializationHookInput]) {
    assertRejected(
      editorCore.createDesenEditorDocument(input),
      "",
      "Input must be inert RFC 8785-compatible JSON data.",
    );
  }

  assert.equal(getterInvocations, 0);
  assert.equal(toJsonInvocations, 0);
});

test("the emitted insert command allocates a stable id and returns one new direct Source", () => {
  const creation = editorCore.createDesenEditorDocument(cloneFixture());
  assert.equal(creation.ok, true);
  if (!creation.ok) throw new TypeError("Expected the public Source factory to succeed.");

  const result = editorCore.insertDesenEditorNode(creation.document, {
    surfaceId: "sign-in",
    parentId: "sign-in.layout",
    slot: "default",
    index: 1,
    idBase: "sign-in.title",
    use: "com.example.ui/Text",
  });

  assert.equal(result.ok, true);
  if (!result.ok) throw new TypeError("Expected public insertion to succeed.");
  assert.equal(result.insertedNodeId, "sign-in.title-2");
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(
    result.document.surfaces["sign-in"].root.slots.default.map(({ id }) => id),
    [
      "sign-in.title",
      "sign-in.title-2",
      "sign-in.email",
      "sign-in.password",
      "sign-in.error",
      "sign-in.submit",
    ],
  );
  assert.deepEqual(result.document.surfaces["sign-in"].root.slots.default[1], {
    id: "sign-in.title-2",
    use: "com.example.ui/Text",
  });
  assert.notStrictEqual(result.document, creation.document);
  assert.deepEqual(creation.document, validSource);
  assertPlainOwnDataFrozen(result);
});

test("the emitted insert command is deterministic and keeps identity allocation surface-local", () => {
  const creation = editorCore.createDesenEditorDocument(cloneFixture());
  assert.equal(creation.ok, true);
  if (!creation.ok) throw new TypeError("Expected the public Source factory to succeed.");
  const command = {
    surfaceId: "home",
    parentId: "home.layout",
    slot: "default",
    index: 0,
    idBase: "sign-in.title",
    use: "com.example.unresolved/Unknown",
  };

  const first = editorCore.insertDesenEditorNode(creation.document, command);
  const second = editorCore.insertDesenEditorNode(creation.document, { ...command });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  if (!first.ok || !second.ok) throw new TypeError("Expected deterministic public inserts.");
  assert.equal(first.insertedNodeId, "sign-in.title");
  assert.equal(second.insertedNodeId, "sign-in.title");
  assert.deepEqual(first.document, second.document);
  assert.notStrictEqual(first.document, second.document);
  assertPlainOwnDataFrozen(first);
  assertPlainOwnDataFrozen(second);
});

test("the emitted insert command creates Object.prototype-named slots as own data", () => {
  const creation = editorCore.createDesenEditorDocument(cloneFixture());
  assert.equal(creation.ok, true);
  if (!creation.ok) throw new TypeError("Expected the public Source factory to succeed.");
  const inheritedConstructor = Object.prototype.constructor;

  const result = editorCore.insertDesenEditorNode(creation.document, {
    surfaceId: "sign-in",
    parentId: "sign-in.layout",
    slot: "constructor",
    index: 0,
    idBase: "sign-in.prototype-safe",
    use: "com.example.ui/Text",
  });

  assert.equal(result.ok, true);
  if (!result.ok) throw new TypeError("Expected prototype-named public insertion to succeed.");
  const slots = result.document.surfaces["sign-in"].root.slots;
  assert.equal(Object.hasOwn(slots, "constructor"), true);
  assert.deepEqual(slots.constructor, [
    { id: "sign-in.prototype-safe", use: "com.example.ui/Text" },
  ]);
  assert.equal(Object.prototype.constructor, inheritedConstructor);
  assertPlainOwnDataFrozen(result);
});

test("the emitted insert command rejects missing, ambiguous, and invalid positions atomically", () => {
  const input = cloneFixture();
  input.surfaces["sign-in"].root.slots.default[1].id =
    input.surfaces["sign-in"].root.slots.default[0].id;
  const creation = editorCore.createDesenEditorDocument(input);
  assert.equal(creation.ok, true);
  if (!creation.ok) throw new TypeError("Expected structural Source admission.");
  const base = {
    surfaceId: "sign-in",
    parentId: input.surfaces["sign-in"].root.slots.default[0].id,
    slot: "default",
    index: 0,
    idBase: "sign-in.inserted",
    use: "com.example.ui/Text",
  };

  const ambiguous = editorCore.insertDesenEditorNode(creation.document, base);
  const missing = editorCore.insertDesenEditorNode(creation.document, {
    ...base,
    parentId: "missing.parent",
  });
  const invalidPosition = editorCore.insertDesenEditorNode(creation.document, {
    ...base,
    parentId: "sign-in.layout",
    slot: "absent",
    index: 1,
  });

  for (const [result, code] of [
    [ambiguous, "run.desen.editor/INSERT_TARGET_AMBIGUOUS"],
    [missing, "run.desen.editor/INSERT_TARGET_NOT_FOUND"],
    [invalidPosition, "run.desen.editor/INSERT_POSITION_INVALID"],
  ]) {
    assert.equal(result.ok, false);
    assert.equal(result.diagnostics[0].code, code);
    assert.equal(Object.hasOwn(result, "document"), false);
    assert.equal(Object.hasOwn(result, "insertedNodeId"), false);
    assertPlainOwnDataFrozen(result);
  }
});

test("the emitted insert command rejects active or authority-expanding command input", () => {
  const creation = editorCore.createDesenEditorDocument(cloneFixture());
  assert.equal(creation.ok, true);
  if (!creation.ok) throw new TypeError("Expected the public Source factory to succeed.");
  const base = {
    surfaceId: "sign-in",
    parentId: "sign-in.layout",
    slot: "default",
    index: 0,
    idBase: "sign-in.inserted",
    use: "com.example.ui/Text",
  };
  let getterInvocations = 0;
  const accessor = { ...base };
  Object.defineProperty(accessor, "idBase", {
    enumerable: true,
    get() {
      getterInvocations += 1;
      return "active";
    },
  });

  for (const command of [accessor, { ...base, id: "explicit-bypass" }]) {
    const result = editorCore.insertDesenEditorNode(creation.document, command);
    assert.equal(result.ok, false);
    assert.equal(result.diagnostics[0].code, "run.desen.editor/INSERT_COMMAND_INVALID");
    assert.equal(Object.hasOwn(result, "document"), false);
    assert.equal(Object.hasOwn(result, "insertedNodeId"), false);
  }
  assert.equal(getterInvocations, 0);
});

test("the emitted structural commands delete, move, and reorder without rewriting identities", () => {
  const creation = editorCore.createDesenEditorDocument(cloneFixture());
  assert.equal(creation.ok, true);
  if (!creation.ok) throw new TypeError("Expected the public Source factory to succeed.");

  const reordered = editorCore.reorderDesenEditorNode(creation.document, {
    surfaceId: "sign-in",
    parentId: "sign-in.layout",
    slot: "default",
    nodeId: "sign-in.submit",
    index: 0,
  });
  assert.equal(reordered.ok, true);
  if (!reordered.ok) throw new TypeError("Expected public reorder to succeed.");
  assert.deepEqual(
    reordered.document.surfaces["sign-in"].root.slots.default.map(({ id }) => id),
    ["sign-in.submit", "sign-in.title", "sign-in.email", "sign-in.password", "sign-in.error"],
  );

  const moved = editorCore.moveDesenEditorNode(reordered.document, {
    surfaceId: "sign-in",
    nodeId: "sign-in.email",
    parentId: "sign-in.title",
    slot: "content",
    index: 0,
  });
  assert.equal(moved.ok, true);
  if (!moved.ok) throw new TypeError("Expected public move to succeed.");
  assert.deepEqual(
    moved.document.surfaces["sign-in"].root.slots.default.map(({ id }) => id),
    ["sign-in.submit", "sign-in.title", "sign-in.password", "sign-in.error"],
  );
  assert.equal(
    moved.document.surfaces["sign-in"].root.slots.default[1].slots.content[0].id,
    "sign-in.email",
  );

  const deleted = editorCore.deleteDesenEditorNode(moved.document, {
    surfaceId: "sign-in",
    nodeId: "sign-in.error",
  });
  assert.equal(deleted.ok, true);
  if (!deleted.ok) throw new TypeError("Expected public delete to succeed.");
  assert.deepEqual(
    deleted.document.surfaces["sign-in"].root.slots.default.map(({ id }) => id),
    ["sign-in.submit", "sign-in.title", "sign-in.password"],
  );
  assert.deepEqual(creation.document, validSource);
  assert.notStrictEqual(reordered.document, creation.document);
  assert.notStrictEqual(moved.document, reordered.document);
  assert.notStrictEqual(deleted.document, moved.document);
  assertPlainOwnDataFrozen(reordered);
  assertPlainOwnDataFrozen(moved);
  assertPlainOwnDataFrozen(deleted);
});

test("the emitted move command targets behavior slots and creates prototype-named own data", () => {
  const input = cloneFixture();
  input.surfaces["sign-in"].root.behaviors = [
    {
      id: "sign-in.sortable",
      use: "com.example.interactions/Sortable",
      slots: {},
    },
  ];
  const creation = editorCore.createDesenEditorDocument(input);
  assert.equal(creation.ok, true);
  if (!creation.ok) throw new TypeError("Expected the behavior fixture to be admitted.");
  const inheritedConstructor = Object.prototype.constructor;

  const result = editorCore.moveDesenEditorNode(creation.document, {
    surfaceId: "sign-in",
    nodeId: "sign-in.password",
    parentId: "sign-in.sortable",
    slot: "constructor",
    index: 0,
  });

  assert.equal(result.ok, true);
  if (!result.ok) throw new TypeError("Expected behavior-slot move to succeed.");
  const behaviorSlots = result.document.surfaces["sign-in"].root.behaviors[0].slots;
  assert.equal(Object.hasOwn(behaviorSlots, "constructor"), true);
  assert.deepEqual(
    behaviorSlots.constructor.map(({ id }) => id),
    ["sign-in.password"],
  );
  assert.equal(Object.prototype.constructor, inheritedConstructor);
  assertPlainOwnDataFrozen(result);
});

test("the emitted structural commands reject roots, cycles, and invalid positions atomically", () => {
  const creation = editorCore.createDesenEditorDocument(cloneFixture());
  assert.equal(creation.ok, true);
  if (!creation.ok) throw new TypeError("Expected the public Source factory to succeed.");

  const failures = [
    [
      editorCore.deleteDesenEditorNode(creation.document, {
        surfaceId: "sign-in",
        nodeId: "sign-in.layout",
      }),
      "run.desen.editor/STRUCTURAL_EDIT_ROOT_FORBIDDEN",
    ],
    [
      editorCore.moveDesenEditorNode(creation.document, {
        surfaceId: "sign-in",
        nodeId: "sign-in.title",
        parentId: "sign-in.title",
        slot: "content",
        index: 0,
      }),
      "run.desen.editor/STRUCTURAL_EDIT_CYCLE_FORBIDDEN",
    ],
    [
      editorCore.moveDesenEditorNode(creation.document, {
        surfaceId: "sign-in",
        nodeId: "sign-in.title",
        parentId: "sign-in.layout",
        slot: "default",
        index: 1,
      }),
      "run.desen.editor/STRUCTURAL_EDIT_POSITION_INVALID",
    ],
    [
      editorCore.reorderDesenEditorNode(creation.document, {
        surfaceId: "sign-in",
        parentId: "sign-in.title",
        slot: "content",
        nodeId: "sign-in.email",
        index: 0,
      }),
      "run.desen.editor/STRUCTURAL_EDIT_TARGET_NOT_FOUND",
    ],
  ];

  for (const [result, code] of failures) {
    assert.equal(result.ok, false);
    assert.equal(result.diagnostics[0].code, code);
    assert.equal(Object.hasOwn(result, "document"), false);
    assertPlainOwnDataFrozen(result);
  }
  assert.deepEqual(creation.document, validSource);
});

test("the emitted structural commands reject active and authority-expanding command input", () => {
  const creation = editorCore.createDesenEditorDocument(cloneFixture());
  assert.equal(creation.ok, true);
  if (!creation.ok) throw new TypeError("Expected the public Source factory to succeed.");
  let getterInvocations = 0;
  const activeDelete = { surfaceId: "sign-in", nodeId: "sign-in.title" };
  Object.defineProperty(activeDelete, "nodeId", {
    enumerable: true,
    get() {
      getterInvocations += 1;
      return "sign-in.title";
    },
  });

  for (const result of [
    editorCore.deleteDesenEditorNode(creation.document, activeDelete),
    editorCore.moveDesenEditorNode(creation.document, {
      surfaceId: "sign-in",
      nodeId: "sign-in.title",
      parentId: "sign-in.layout",
      slot: "default",
      index: 0,
      retainedAuthority: true,
    }),
    editorCore.reorderDesenEditorNode(creation.document, {
      surfaceId: "sign-in",
      parentId: "sign-in.layout",
      slot: "default",
      nodeId: "sign-in.title",
      index: -1,
    }),
  ]) {
    assert.equal(result.ok, false);
    assert.equal(result.diagnostics[0].code, "run.desen.editor/STRUCTURAL_EDIT_COMMAND_INVALID");
    assert.equal(Object.hasOwn(result, "document"), false);
  }
  assert.equal(getterInvocations, 0);
});

test("the emitted base content commands edit component and behavior owners", () => {
  const input = contentEditFixture();
  const creation = editorCore.createDesenEditorDocument(input);
  assert.equal(creation.ok, true);
  if (!creation.ok) throw new TypeError("Expected the content-edit fixture to be admitted.");
  const identities = surfaceIdentities(creation.document, "sign-in");

  let document = expectContentEditSuccess(
    editorCore.setDesenEditorOwnerProp(creation.document, {
      surfaceId: "sign-in",
      ownerId: "sign-in.title",
      name: "text",
      value: "Continue",
    }),
  );
  document = expectContentEditSuccess(
    editorCore.setDesenEditorOwnerProp(document, {
      surfaceId: "sign-in",
      ownerId: "sign-in.draggable",
      name: "axis",
      value: "x",
    }),
  );
  document = expectContentEditSuccess(
    editorCore.setDesenEditorOwnerStyleProperty(document, {
      surfaceId: "sign-in",
      ownerId: "sign-in.title",
      state: "base",
      part: "root",
      property: "color",
      value: { $token: "color.content.primary" },
    }),
  );
  document = expectContentEditSuccess(
    editorCore.setDesenEditorOwnerStyleProperty(document, {
      surfaceId: "sign-in",
      ownerId: "sign-in.draggable",
      state: "dragging",
      part: "handle",
      property: "opacity",
      value: 0.5,
    }),
  );

  const root = document.surfaces["sign-in"].root;
  assert.equal(root.slots.default[0].props.text, "Continue");
  assert.deepEqual(root.slots.default[0].style, {
    base: { root: { color: { $token: "color.content.primary" } } },
  });
  assert.equal(root.behaviors[0].props.axis, "x");
  assert.equal(root.behaviors[0].style.dragging.handle.opacity, 0.5);
  assert.deepEqual(surfaceIdentities(document, "sign-in"), identities);
  assert.deepEqual(creation.document, input);
});

test("the emitted condition and variant lifecycle commands preserve ordered semantics", () => {
  const creation = editorCore.createDesenEditorDocument(contentEditFixture());
  assert.equal(creation.ok, true);
  if (!creation.ok) throw new TypeError("Expected the content-edit fixture to be admitted.");

  let document = expectContentEditSuccess(
    editorCore.setDesenEditorNodeCondition(creation.document, {
      surfaceId: "sign-in",
      nodeId: "sign-in.title",
      when: { op: "truthy", args: [true] },
    }),
  );
  document = expectContentEditSuccess(
    editorCore.clearDesenEditorNodeCondition(document, {
      surfaceId: "sign-in",
      nodeId: "sign-in.title",
    }),
  );
  document = expectContentEditSuccess(
    editorCore.insertDesenEditorVariant(document, {
      surfaceId: "sign-in",
      nodeId: "sign-in.submit",
      index: 1,
      variant: {
        when: { op: "eq", args: [4, 4] },
        props: { marker: "D" },
      },
    }),
  );
  document = expectContentEditSuccess(
    editorCore.reorderDesenEditorVariant(document, {
      surfaceId: "sign-in",
      nodeId: "sign-in.submit",
      variantIndex: 3,
      index: 0,
    }),
  );
  document = expectContentEditSuccess(
    editorCore.deleteDesenEditorVariant(document, {
      surfaceId: "sign-in",
      nodeId: "sign-in.submit",
      index: 2,
    }),
  );

  const [title, , , , submit] = document.surfaces["sign-in"].root.slots.default;
  assert.equal(Object.hasOwn(title, "when"), false);
  assert.deepEqual(
    submit.variants.map(({ props }) => props.marker),
    ["C", "A", "B"],
  );
  assert.deepEqual(
    creation.document.surfaces["sign-in"].root.slots.default[4].variants.map(
      ({ props }) => props.marker,
    ),
    ["A", "B", "C"],
  );
});

test("the emitted delete and variant-update commands retain emptied own containers", () => {
  const input = contentEditFixture();
  const firstVariant = input.surfaces["sign-in"].root.slots.default[4].variants[0];
  firstVariant.props = { temporary: "remove-me" };
  const creation = editorCore.createDesenEditorDocument(input);
  assert.equal(creation.ok, true);
  if (!creation.ok) throw new TypeError("Expected the content-edit fixture to be admitted.");

  let document = expectContentEditSuccess(
    editorCore.deleteDesenEditorOwnerProp(creation.document, {
      surfaceId: "sign-in",
      ownerId: "sign-in.draggable",
      name: "temporary",
    }),
  );
  document = expectContentEditSuccess(
    editorCore.deleteDesenEditorOwnerStyleProperty(document, {
      surfaceId: "sign-in",
      ownerId: "sign-in.draggable",
      state: "base",
      part: "handle",
      property: "opacity",
    }),
  );
  document = expectContentEditSuccess(
    editorCore.setDesenEditorVariantCondition(document, {
      surfaceId: "sign-in",
      nodeId: "sign-in.submit",
      index: 0,
      when: { op: "eq", args: ["updated", "updated"] },
    }),
  );
  document = expectContentEditSuccess(
    editorCore.setDesenEditorVariantProp(document, {
      surfaceId: "sign-in",
      nodeId: "sign-in.submit",
      index: 0,
      name: "temporary",
      value: "replacement",
    }),
  );
  document = expectContentEditSuccess(
    editorCore.deleteDesenEditorVariantProp(document, {
      surfaceId: "sign-in",
      nodeId: "sign-in.submit",
      index: 0,
      name: "temporary",
    }),
  );
  document = expectContentEditSuccess(
    editorCore.setDesenEditorVariantStyleProperty(document, {
      surfaceId: "sign-in",
      nodeId: "sign-in.submit",
      index: 0,
      state: "base",
      part: "root",
      property: "opacity",
      value: 0.5,
    }),
  );
  document = expectContentEditSuccess(
    editorCore.deleteDesenEditorVariantStyleProperty(document, {
      surfaceId: "sign-in",
      nodeId: "sign-in.submit",
      index: 0,
      state: "base",
      part: "root",
      property: "opacity",
    }),
  );

  const behavior = document.surfaces["sign-in"].root.behaviors[0];
  const variant = document.surfaces["sign-in"].root.slots.default[4].variants[0];
  assert.equal(Object.hasOwn(behavior, "props"), true);
  assert.deepEqual(behavior.props, {});
  assert.deepEqual(behavior.style, { base: { handle: {} } });
  assert.deepEqual(variant.when, { op: "eq", args: ["updated", "updated"] });
  assert.equal(Object.hasOwn(variant, "props"), true);
  assert.deepEqual(variant.props, {});
  assert.deepEqual(variant.style, { base: { root: {} } });
});

test("the emitted content commands reject missing, ambiguous, invalid, and structural paths atomically", () => {
  const creation = editorCore.createDesenEditorDocument(cloneFixture());
  assert.equal(creation.ok, true);
  if (!creation.ok) throw new TypeError("Expected the public Source factory to succeed.");
  const ambiguousInput = cloneFixture();
  ambiguousInput.surfaces["sign-in"].root.slots.default[1].id = "sign-in.title";
  const ambiguousCreation = editorCore.createDesenEditorDocument(ambiguousInput);
  assert.equal(ambiguousCreation.ok, true);
  if (!ambiguousCreation.ok) throw new TypeError("Expected ambiguous structural Source admission.");

  expectContentEditFailure(
    editorCore.setDesenEditorOwnerProp(creation.document, {
      surfaceId: "sign-in",
      ownerId: "missing.owner",
      name: "label",
      value: "Missing",
    }),
    "run.desen.editor/CONTENT_EDIT_TARGET_NOT_FOUND",
  );
  expectContentEditFailure(
    editorCore.setDesenEditorOwnerStyleProperty(ambiguousCreation.document, {
      surfaceId: "sign-in",
      ownerId: "sign-in.title",
      state: "base",
      part: "root",
      property: "color",
      value: "red",
    }),
    "run.desen.editor/CONTENT_EDIT_TARGET_AMBIGUOUS",
  );
  expectContentEditFailure(
    editorCore.clearDesenEditorNodeCondition(creation.document, {
      surfaceId: "sign-in",
      nodeId: "sign-in.title",
    }),
    "run.desen.editor/CONTENT_EDIT_PATH_NOT_FOUND",
  );
  expectContentEditFailure(
    editorCore.deleteDesenEditorVariant(creation.document, {
      surfaceId: "sign-in",
      nodeId: "sign-in.submit",
      index: 0,
    }),
    "run.desen.editor/CONTENT_EDIT_POSITION_INVALID",
  );
  expectContentEditFailure(
    editorCore.insertDesenEditorVariant(creation.document, {
      surfaceId: "sign-in",
      nodeId: "sign-in.submit",
      index: 0,
      variant: {},
    }),
    "SCHEMA_INVALID",
  );
  assert.deepEqual(creation.document, validSource);
  assert.deepEqual(ambiguousCreation.document, ambiguousInput);
});

test("all emitted content commands reject active or authority-expanding command input", () => {
  const creation = editorCore.createDesenEditorDocument(contentEditFixture());
  assert.equal(creation.ok, true);
  if (!creation.ok) throw new TypeError("Expected the content-edit fixture to be admitted.");
  const base = { surfaceId: "sign-in" };
  const commands = [
    [
      editorCore.setDesenEditorOwnerProp,
      { ...base, ownerId: "sign-in.title", name: "text", value: "x" },
    ],
    [editorCore.deleteDesenEditorOwnerProp, { ...base, ownerId: "sign-in.title", name: "text" }],
    [
      editorCore.setDesenEditorOwnerStyleProperty,
      {
        ...base,
        ownerId: "sign-in.title",
        state: "base",
        part: "root",
        property: "color",
        value: "red",
      },
    ],
    [
      editorCore.deleteDesenEditorOwnerStyleProperty,
      { ...base, ownerId: "sign-in.draggable", state: "base", part: "handle", property: "opacity" },
    ],
    [
      editorCore.setDesenEditorNodeCondition,
      { ...base, nodeId: "sign-in.title", when: { op: "truthy", args: [true] } },
    ],
    [editorCore.clearDesenEditorNodeCondition, { ...base, nodeId: "sign-in.error" }],
    [
      editorCore.insertDesenEditorVariant,
      {
        ...base,
        nodeId: "sign-in.submit",
        index: 0,
        variant: { when: { op: "eq", args: [1, 1] }, props: {} },
      },
    ],
    [editorCore.deleteDesenEditorVariant, { ...base, nodeId: "sign-in.submit", index: 0 }],
    [
      editorCore.reorderDesenEditorVariant,
      { ...base, nodeId: "sign-in.submit", variantIndex: 0, index: 1 },
    ],
    [
      editorCore.setDesenEditorVariantCondition,
      { ...base, nodeId: "sign-in.submit", index: 0, when: { op: "eq", args: [1, 1] } },
    ],
    [
      editorCore.setDesenEditorVariantProp,
      { ...base, nodeId: "sign-in.submit", index: 0, name: "marker", value: "x" },
    ],
    [
      editorCore.deleteDesenEditorVariantProp,
      { ...base, nodeId: "sign-in.submit", index: 0, name: "marker" },
    ],
    [
      editorCore.setDesenEditorVariantStyleProperty,
      {
        ...base,
        nodeId: "sign-in.submit",
        index: 0,
        state: "base",
        part: "root",
        property: "opacity",
        value: 1,
      },
    ],
    [
      editorCore.deleteDesenEditorVariantStyleProperty,
      {
        ...base,
        nodeId: "sign-in.submit",
        index: 0,
        state: "base",
        part: "root",
        property: "opacity",
      },
    ],
  ];

  for (const [edit, command] of commands) {
    expectContentEditFailure(
      edit(creation.document, { ...command, retainedAuthority: true }),
      "run.desen.editor/CONTENT_EDIT_COMMAND_INVALID",
    );
  }

  let getterInvocations = 0;
  const active = { surfaceId: "sign-in", ownerId: "sign-in.title", name: "text", value: "x" };
  Object.defineProperty(active, "name", {
    enumerable: true,
    get() {
      getterInvocations += 1;
      return "text";
    },
  });
  const symbolCommand = {
    surfaceId: "sign-in",
    nodeId: "sign-in.error",
    [Symbol("authority")]: true,
  };
  const inheritedCommand = Object.create({ surfaceId: "sign-in" });
  Object.assign(inheritedCommand, { nodeId: "sign-in.error" });

  for (const result of [
    editorCore.setDesenEditorOwnerProp(creation.document, active),
    editorCore.clearDesenEditorNodeCondition(creation.document, symbolCommand),
    editorCore.clearDesenEditorNodeCondition(creation.document, inheritedCommand),
  ]) {
    expectContentEditFailure(result, "run.desen.editor/CONTENT_EDIT_COMMAND_INVALID");
  }
  assert.equal(getterInvocations, 0);
});

test("the emitted content commands are deterministic, immutable, and Catalog-unresolved", () => {
  const input = contentEditFixture();
  const creation = editorCore.createDesenEditorDocument(input);
  assert.equal(creation.ok, true);
  if (!creation.ok) throw new TypeError("Expected the content-edit fixture to be admitted.");
  const identities = surfaceIdentities(creation.document, "sign-in");

  const edit = (document) => {
    let next = expectContentEditSuccess(
      editorCore.setDesenEditorOwnerProp(document, {
        surfaceId: "sign-in",
        ownerId: "sign-in.title",
        name: "futureCatalogProp",
        value: { $token: "future.catalog.token" },
      }),
    );
    next = expectContentEditSuccess(
      editorCore.setDesenEditorOwnerStyleProperty(next, {
        surfaceId: "sign-in",
        ownerId: "sign-in.title",
        state: "futureState",
        part: "futurePart",
        property: "futureProperty",
        value: "unresolved-but-structural",
      }),
    );
    return expectContentEditSuccess(
      editorCore.insertDesenEditorVariant(next, {
        surfaceId: "sign-in",
        nodeId: "sign-in.submit",
        index: 1,
        variant: {
          when: { op: "truthy", args: [{ $ref: "context.futureFlag" }] },
          props: { futureVariantProp: true },
        },
      }),
    );
  };

  const first = edit(creation.document);
  const second = edit(creation.document);
  assert.deepEqual(first, second);
  assert.notStrictEqual(first, second);
  assert.deepEqual(surfaceIdentities(first, "sign-in"), identities);
  assert.deepEqual(creation.document, input);
  assert.equal(
    first.surfaces["sign-in"].root.slots.default[0].props.futureCatalogProp.$token,
    "future.catalog.token",
  );
  assert.equal(
    first.surfaces["sign-in"].root.slots.default[0].style.futureState.futurePart.futureProperty,
    "unresolved-but-structural",
  );
  assert.equal(
    first.surfaces["sign-in"].root.slots.default[4].variants[1].props.futureVariantProp,
    true,
  );
});

test("[proof-core] two fresh final builds are byte-identical and preserve honest scope", async () => {
  const first = await buildEditorCoreSourceDocumentEvidence();
  const second = await buildEditorCoreSourceDocumentEvidence();

  assert.deepEqual(first.artifactBytes, second.artifactBytes);
  assert.equal(first.artifactSha256, second.artifactSha256);
  assert.equal(first.artifact.task, "M08-T01");
  assert.equal(first.artifact.result, "PASS");
  assert.equal(first.artifact.profile, "desen.editor-core.source-document-proof.v1");
  assert.equal(first.artifact.claim.taskStatus, "DONE");
  assert.equal(first.artifact.claim.prerequisiteGate, "G07");
  assert.equal(first.artifact.claim.prerequisiteStatus, "DONE");
  assert.equal(first.artifact.claim.semanticValidation, false);
  assert.equal(first.artifact.prerequisite.task, "I07-04");
  assert.equal(first.artifact.prerequisite.result, "PASS");
  assert.equal(first.artifact.prerequisite.status, "DONE");
  assert.equal(first.artifact.prerequisite.authority.cutover, "HOSTED_CUTOVER_VERIFIED");
  assert.equal(first.artifact.documentModel.directSourceRoot, true);
  assert.equal(first.artifact.documentModel.detached, true);
  assert.equal(first.artifact.executionAuthority.exactReceiptedBytes, true);
  assert.equal(first.artifact.executionAuthority.runtimeOverridesCanPass, false);
  assert.equal(first.artifact.executionAuthority.fileOverridesCanPass, false);
  assert.deepEqual(first.artifact.executionAuthority.dependencyAuthority.coverage, {
    runtimeReceipts: 19,
    disjoint: true,
    exactCurrentBytes: true,
  });
  assert.equal(first.artifact.executionAuthority.dependencyAuthority.baseline.task, "M02-T11");
  assert.equal(first.artifact.executionAuthority.dependencyAuthority.baseline.result, "PASS");
  assert.equal(
    first.artifact.executionAuthority.dependencyAuthority.baseline.sha256,
    "f7dc050b8a9e4e5d9ec2531312ca3ad68d0d03c46bda5c44ebf930884554f505",
  );
  assert.equal(first.artifact.executionAuthority.dependencyAuthority.baseline.runtimeReceipts, 11);
  assert.equal(first.artifact.executionAuthority.dependencyAuthority.successor.runtimeReceipts, 8);
  assert.equal(first.artifact.boundary.platformImports, 0);
  assert.equal(first.artifact.evidence.tests.packageRuntimeCases, 7);
  assert.equal(first.artifact.evidence.tests.publicRuntimeContractCases, 10);
  assert.equal(first.artifact.evidence.tests.sourceCompilerNegativeCases, 5);
  assert.equal(first.artifact.evidence.tests.publicCompilerNegativeCases, 5);
  assert.equal(first.artifact.evidence.tests.publicProofCoreCases, 7);
  assert.equal(first.artifact.evidence.tests.rootProofCases, 13);
  assert.equal(first.artifact.evidence.trackedFiles.length, 47);
  assert.equal(first.artifact.executionAuthority.receiptedRuntimeFiles, 24);
  assert.equal(first.artifact.executionAuthority.proofOwnedHarnessFiles, 1);
  assert.equal(first.artifact.boundary.runtimeClosure.receiptedRuntimeFiles, 24);
  assert.equal(first.artifact.boundary.runtimeClosure.modules.length, 21);
  assert.equal(first.artifact.boundary.runtimeClosure.unknownStaticEsmEdges, 0);
  assert.equal(first.artifact.boundary.lifecycleScripts, 0);
  assert.deepEqual(first.artifact.boundary.typescript.effective.build, {
    strict: true,
    noEmit: false,
    declaration: true,
    declarationMap: true,
    sourceMap: true,
    rootDir: "src",
    outDir: "dist",
    types: [],
  });
  assert.equal(first.artifact.boundary.typescript.effective.publicPackage.noEmit, true);
  assert.match(first.artifact.nonclaims.join("\n"), /M08-T10/u);
  assert.match(first.artifact.nonclaims.join("\n"), /G08/u);
  assert.match(first.artifact.nonclaims.join("\n"), /hostile-JavaScript capability sandbox/u);
});

test("[proof-core] rejects a wrapper-returning or mutable public runtime", async () => {
  const wrapperRuntime = {
    createDesenEditorDocument(input) {
      const result = editorCore.createDesenEditorDocument(input);
      if (!result.ok) return result;
      return Object.freeze({
        ok: true,
        document: Object.freeze({ source: result.document }),
        diagnostics: Object.freeze([]),
      });
    },
  };
  const mutableRuntime = {
    createDesenEditorDocument(input) {
      const result = editorCore.createDesenEditorDocument(input);
      if (!result.ok) return result;
      return { ok: true, document: cloneFixture(), diagnostics: [] };
    },
  };

  for (const runtimeApi of [wrapperRuntime, mutableRuntime]) {
    await assert.rejects(
      buildEditorCoreSourceDocumentEvidence({ runtimeApi }),
      hasProofCode("EDITOR_SOURCE_DOCUMENT_BEHAVIOR_DRIFT"),
    );
  }
});

test("[proof-core] rejects caller retention and partial failure authority", async () => {
  const retainedCallerRuntime = {
    createDesenEditorDocument(input) {
      if (input?.kind !== "desen.source") return editorCore.createDesenEditorDocument(input);
      Object.freeze(input);
      return Object.freeze({ ok: true, document: input, diagnostics: Object.freeze([]) });
    },
  };
  const partialFailureRuntime = {
    createDesenEditorDocument(input) {
      const result = editorCore.createDesenEditorDocument(input);
      if (result.ok) return result;
      return Object.freeze({ ...result, document: Object.freeze({}) });
    },
  };

  for (const runtimeApi of [
    retainedCallerRuntime,
    partialFailureRuntime,
    runtimeThatMutatesInvalidRootDiagnostic((result) =>
      Object.freeze({
        ok: false,
        diagnostics: Object.freeze([
          Object.freeze({ ...result.diagnostics[0], classification: "semantic" }),
        ]),
      }),
    ),
    runtimeThatMutatesInvalidRootDiagnostic((result) =>
      Object.freeze({
        ok: false,
        diagnostics: Object.freeze([
          Object.freeze({ ...result.diagnostics[0], message: "A different failure." }),
        ]),
      }),
    ),
    runtimeThatMutatesInvalidRootDiagnostic((result) =>
      Object.freeze({ diagnostics: result.diagnostics, ok: false }),
    ),
    runtimeThatMutatesRejectedCallerGraph(),
    runtimeThatFreezesRejectedCaller("executable"),
    runtimeThatFreezesRejectedCaller("selection"),
    runtimeThatFreezesRejectedCaller("toJSON"),
  ]) {
    await assert.rejects(
      buildEditorCoreSourceDocumentEvidence({ runtimeApi }),
      hasProofCode("EDITOR_SOURCE_DOCUMENT_BEHAVIOR_DRIFT"),
    );
  }
});

test("[proof-core] rejects admission that becomes semantically too strict", async () => {
  const semanticRuntime = {
    createDesenEditorDocument(input) {
      if (input?.surfaces?.["sign-in"]?.root?.use === "com.example.unresolved/Unknown") {
        return Object.freeze({
          ok: false,
          diagnostics: Object.freeze([
            Object.freeze({
              code: "SCHEMA_INVALID",
              message: "Capability is unresolved.",
              pointer: "/surfaces/sign-in/root/use",
            }),
          ]),
        });
      }
      return editorCore.createDesenEditorDocument(input);
    },
  };

  await assert.rejects(
    buildEditorCoreSourceDocumentEvidence({ runtimeApi: semanticRuntime }),
    hasProofCode("EDITOR_SOURCE_DOCUMENT_BEHAVIOR_DRIFT"),
  );
});

test("[proof-core] rejects source, TSDoc, import, distribution, and manifest drift", async () => {
  const [
    source,
    index,
    distSource,
    declaration,
    manifest,
    baseConfigText,
    packageConfigText,
    buildConfigText,
    publicConfigText,
    dependencyAuthorityBytes,
  ] = await Promise.all([
    readFile(new URL("../src/source-document.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../dist/source-document.js", import.meta.url), "utf8"),
    readFile(new URL("../dist/source-document.d.ts", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../../../tsconfig.base.json", import.meta.url), "utf8"),
    readFile(new URL("../tsconfig.json", import.meta.url), "utf8"),
    readFile(new URL("../tsconfig.build.json", import.meta.url), "utf8"),
    readFile(new URL("../tsconfig.public-package.json", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../../../docs/proof/artifacts/protocol-0.1.0-execution-contracts.json",
        import.meta.url,
      ),
    ),
  ]);
  const parsedManifest = JSON.parse(manifest);
  const manifestWithPlatformDependency = JSON.stringify({
    ...parsedManifest,
    dependencies: {
      ...parsedManifest.dependencies,
      react: "19.0.0",
    },
  });
  const manifestWithScriptDrift = JSON.stringify({
    ...parsedManifest,
    scripts: {
      ...parsedManifest.scripts,
      "test:public-package": "node --test test/public-package.mjs",
    },
  });
  const manifestWithLifecycle = JSON.stringify({
    ...parsedManifest,
    scripts: { ...parsedManifest.scripts, prepack: "node ./prepack.mjs" },
  });
  const manifestWithBin = JSON.stringify({ ...parsedManifest, bin: "./dist/cli.js" });
  const manifestWithBrowser = JSON.stringify({
    ...parsedManifest,
    browser: "./dist/browser.js",
  });
  const manifestWithImports = JSON.stringify({
    ...parsedManifest,
    imports: { "#runtime": "./dist/source-document.js" },
  });
  const manifestWithUnknownKey = JSON.stringify({ ...parsedManifest, proofBypass: true });
  const baseConfig = JSON.parse(baseConfigText);
  baseConfig.compilerOptions.strict = false;
  const packageConfig = JSON.parse(packageConfigText);
  packageConfig.extends = "../../tsconfig.node.json";
  const buildConfig = JSON.parse(buildConfigText);
  buildConfig.extends = "../../tsconfig.base.json";
  const publicConfig = JSON.parse(publicConfigText);
  publicConfig.compilerOptions.noEmit = false;
  const mutations = [
    {
      path: "packages/editor-core/src/source-document.ts",
      value: source.replace("/**", "/*"),
    },
    {
      path: "packages/editor-core/src/source-document.ts",
      value: `import "node:fs";\n${source}`,
    },
    {
      path: "packages/editor-core/src/source-document.ts",
      value: source.replace(
        "const validation = validateDesenSource(input);",
        "const validation = (document, validateDesenSource)(input);",
      ),
    },
    {
      path: "packages/editor-core/src/source-document.ts",
      value: source.replace(
        "const validation = validateDesenSource(input);",
        'const validation = require("@desen/validator").validateDesenSource(input);',
      ),
    },
    {
      path: "packages/editor-core/src/source-document.ts",
      value: source.replace(
        "const validation = validateDesenSource(input);",
        "const validation = module.exports.validateDesenSource(input);",
      ),
    },
    {
      path: "packages/editor-core/src/index.ts",
      value: `${index}\nexport const hiddenAuthority = true;\n`,
    },
    {
      path: "packages/editor-core/dist/source-document.js",
      value: `${distSource}\nwindow.document;\n`,
    },
    {
      path: "packages/editor-core/dist/source-document.js",
      value: `${distSource}\n// receipt-only drift\n`,
    },
    {
      path: "packages/editor-core/dist/source-document.d.ts",
      value: declaration.replace("export type DesenEditorDocument", "type DesenEditorDocument"),
    },
    {
      path: "packages/editor-core/dist/source-document.d.ts",
      value: declaration.replace(
        "export type DesenEditorDocument = ImmutableJson<DesenSource>;",
        'export type DesenEditorDocument = ImmutableJson<DesenSource> & import("react").ReactNode;',
      ),
    },
    {
      path: "packages/editor-core/package.json",
      value: manifestWithPlatformDependency,
    },
    {
      path: "packages/editor-core/package.json",
      value: manifestWithScriptDrift,
    },
    {
      path: "packages/editor-core/package.json",
      value: manifestWithLifecycle,
    },
    { path: "packages/editor-core/package.json", value: manifestWithBin },
    { path: "packages/editor-core/package.json", value: manifestWithBrowser },
    { path: "packages/editor-core/package.json", value: manifestWithImports },
    { path: "packages/editor-core/package.json", value: manifestWithUnknownKey },
    { path: "tsconfig.base.json", value: JSON.stringify(baseConfig) },
    { path: "packages/editor-core/tsconfig.json", value: JSON.stringify(packageConfig) },
    { path: "packages/editor-core/tsconfig.build.json", value: JSON.stringify(buildConfig) },
    {
      path: "packages/editor-core/tsconfig.public-package.json",
      value: JSON.stringify(publicConfig),
    },
  ];

  for (const mutation of mutations) {
    await assert.rejects(
      buildEditorCoreSourceDocumentEvidence({
        fileOverrides: { [mutation.path]: mutation.value },
      }),
      EditorCoreSourceDocumentProofError,
    );
  }
  const receiptMutation = JSON.parse(dependencyAuthorityBytes.toString("utf8"));
  const baselineReceipt = receiptMutation.implementation.trackedFiles.find(
    (receipt) => receipt.path === "packages/protocol/dist/canonicalization.js",
  );
  assert.ok(baselineReceipt);
  baselineReceipt.sha256 = "0".repeat(64);
  for (const mutatedDependencyAuthorityBytes of [
    changedByte(dependencyAuthorityBytes),
    Buffer.from(`${JSON.stringify(receiptMutation, null, 2)}\n`),
  ]) {
    await assert.rejects(
      buildEditorCoreSourceDocumentEvidence({
        dependencyAuthorityBytes: mutatedDependencyAuthorityBytes,
      }),
      hasProofCode("EDITOR_SOURCE_DOCUMENT_RUNTIME_AUTHORITY_DRIFT"),
    );
  }
});

test("[proof-core] rejects focused-test inventory drift", async () => {
  const [packageTest, packageTypes, publicTest, publicTypes, rootTest] = await Promise.all([
    readFile(new URL("./source-document.test.ts", import.meta.url), "utf8"),
    readFile(new URL("./source-document.types.ts", import.meta.url), "utf8"),
    readFile(new URL("./public-package.mjs", import.meta.url), "utf8"),
    readFile(new URL("./public-package.types.mts", import.meta.url), "utf8"),
    readFile(
      new URL("../../../tests/editor-core-source-document.test.mjs", import.meta.url),
      "utf8",
    ),
  ]);
  const nestedRootTest = `${replaceLast(
    rootTest,
    'test("[immutability] freezes final evidence and keeps later M08 scope explicit", () => {',
    'if (false) {\n  test("[immutability] freezes final evidence and keeps later M08 scope explicit", () => {',
  )}\n}\n`;
  const packageNoop = replaceRegistrationCallbackWithNoop(
    packageTest,
    '  it("admits the official Source directly without a hidden document wrapper", () => {',
    '  it("detaches independent snapshots without freezing or retaining caller input", () => {',
  );
  const publicNoop = replaceRegistrationCallbackWithNoop(
    publicTest,
    'test("the package manifest keeps one exact root export and the declared runtime dependencies", () => {',
    'test("the emitted public module graph stays platform-neutral and execution-closed", async () => {',
  );
  const rootNoop = replaceRegistrationCallbackWithNoop(
    rootTest,
    'test("[immutability] freezes final evidence and keeps later M08 scope explicit", () => {',
  );
  const packageDirectiveDecoy = packageTypes.replace(
    "// @ts-expect-error the direct editor document is recursively immutable",
    'const directiveDecoy = "// @ts-expect-error";',
  );
  const publicDirectiveDecoy = publicTypes.replace(
    "// @ts-expect-error emitted declarations keep the direct document recursively immutable",
    'const directiveDecoy = "// @ts-expect-error";',
  );
  const unusedDirectiveAuthority = `declare const value: unknown;\n\n${Array.from(
    { length: 5 },
    (_, index) => `// @ts-expect-error unused directive ${index + 1}\nvoid value;`,
  ).join("\n\n")}\n`;

  for (const [path, value] of [
    [
      "packages/editor-core/test/source-document.test.ts",
      packageTest.replace(
        '  it("admits the official Source',
        '  test.skip("admits the official Source',
      ),
    ],
    [
      "packages/editor-core/test/source-document.test.ts",
      packageTest.replace(
        '  it("admits the official Source',
        '  it.skip("admits the official Source',
      ),
    ],
    ["packages/editor-core/test/source-document.test.ts", packageNoop],
    [
      "packages/editor-core/test/public-package.mjs",
      publicTest.replace(
        'import test from "node:test";',
        'import nodeTest from "node:test";\nconst test = nodeTest;',
      ),
    ],
    ["packages/editor-core/test/public-package.mjs", publicNoop],
    ["packages/editor-core/test/source-document.types.ts", packageDirectiveDecoy],
    ["packages/editor-core/test/public-package.types.mts", publicDirectiveDecoy],
    ["packages/editor-core/test/public-package.types.mts", unusedDirectiveAuthority],
    ["tests/editor-core-source-document.test.mjs", nestedRootTest],
    ["tests/editor-core-source-document.test.mjs", rootNoop],
    [
      "tests/editor-core-source-document.test.mjs",
      rootTest.replace(
        'import { after, before, test } from "node:test";',
        'import { after, before } from "node:test";\nconst test = () => undefined;',
      ),
    ],
  ]) {
    await assert.rejects(
      buildEditorCoreSourceDocumentEvidence({ fileOverrides: { [path]: value } }),
      hasProofCode("EDITOR_SOURCE_DOCUMENT_TEST_INVENTORY_DRIFT"),
    );
  }
});

test("[proof-core] rejects accessor, inherited, symbol, and Proxy options without hooks", async () => {
  let getterCalls = 0;
  let proxyCalls = 0;
  const accessor = Object.defineProperty({}, "runtimeApi", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return editorCore;
    },
  });
  const inherited = Object.create({ runtimeApi: editorCore });
  const symbol = { [Symbol("runtimeApi")]: editorCore };
  const proxy = new Proxy(
    {},
    {
      ownKeys() {
        proxyCalls += 1;
        return [];
      },
      getPrototypeOf() {
        proxyCalls += 1;
        return Object.prototype;
      },
    },
  );
  const prerequisiteBytes = new Uint8Array(
    await readFile(
      new URL(
        "../../../docs/proof/baselines/i07-04-affected-selector-promotion.json",
        import.meta.url,
      ),
    ),
  );
  const dependencyAuthorityBytes = new Uint8Array(
    await readFile(
      new URL(
        "../../../docs/proof/artifacts/protocol-0.1.0-execution-contracts.json",
        import.meta.url,
      ),
    ),
  );
  const shadowedBuffer = new Uint8Array(prerequisiteBytes);
  Object.defineProperty(shadowedBuffer, "buffer", {
    get() {
      getterCalls += 1;
      return new ArrayBuffer(0);
    },
  });
  const shadowedLength = new Uint8Array(prerequisiteBytes);
  Object.defineProperty(shadowedLength, "length", {
    get() {
      getterCalls += 1;
      return prerequisiteBytes.byteLength;
    },
  });
  const shadowedDependencyAuthority = new Uint8Array(dependencyAuthorityBytes);
  Object.defineProperty(shadowedDependencyAuthority, "byteLength", {
    get() {
      getterCalls += 1;
      return dependencyAuthorityBytes.byteLength;
    },
  });

  for (const options of [
    accessor,
    inherited,
    symbol,
    proxy,
    {
      runtimeApi: {
        createDesenEditorDocument: editorCore.createDesenEditorDocument,
      },
    },
    { fileOverrides: {} },
    { fileOverrides: { "packages/editor-core/README.md": "# mutation-only override\n" } },
    { fileOverrides: { "packages/validator/dist/index.js": "export {};\n" } },
    { fileOverrides: { "packages/validator/package.json": "{}\n" } },
    { dependencyAuthorityBytes: shadowedDependencyAuthority },
    { prerequisiteBytes: shadowedBuffer },
    { prerequisiteBytes: shadowedLength },
  ]) {
    await assert.rejects(
      buildEditorCoreSourceDocumentEvidence(options),
      hasProofCode("EDITOR_SOURCE_DOCUMENT_OPTIONS_INVALID"),
    );
  }
  if (typeof SharedArrayBuffer === "function") {
    const sharedBytes = new Uint8Array(new SharedArrayBuffer(prerequisiteBytes.byteLength));
    sharedBytes.set(prerequisiteBytes);
    Object.defineProperty(sharedBytes, "buffer", {
      get() {
        getterCalls += 1;
        return new ArrayBuffer(0);
      },
    });
    await assert.rejects(
      buildEditorCoreSourceDocumentEvidence({ prerequisiteBytes: sharedBytes }),
      hasProofCode("EDITOR_SOURCE_DOCUMENT_OPTIONS_INVALID"),
    );
  }
  assert.equal(getterCalls, 0);
  assert.equal(proxyCalls, 0);
});
