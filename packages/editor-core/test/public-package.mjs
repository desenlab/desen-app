import assert from "node:assert/strict";
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

function assertRejected(result, pointer) {
  assert.equal(result.ok, false);
  assert.deepEqual(Object.keys(result).sort(), ["diagnostics", "ok"]);
  assert.equal(Object.hasOwn(result, "document"), false);
  assert.equal(result.diagnostics.length, 1);
  assert.equal(result.diagnostics[0].code, "SCHEMA_INVALID");
  assert.equal(result.diagnostics[0].pointer, pointer);
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

test("the package manifest keeps one exact root export and the declared runtime dependencies", () => {
  assert.deepEqual(packageManifest.exports, {
    ".": {
      types: "./dist/index.d.ts",
      import: "./dist/index.js",
    },
  });
  assert.deepEqual(packageManifest.dependencies, {
    "@desen/protocol": "workspace:*",
    "@desen/validator": "workspace:*",
  });
});

test("the emitted public module graph stays platform-neutral and execution-closed", async () => {
  const emittedModules = await Promise.all(
    ["index.js", "source-document.js"].map(async (file) => ({
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
      { file: "index.js", specifiers: ["./source-document.js"] },
      { file: "source-document.js", specifiers: ["@desen/validator"] },
    ],
  );
  assert.match(
    emittedModules[0].source,
    /export\s*\{\s*createDesenEditorDocument\s*\}\s*from\s*["']\.\/source-document\.js["']/,
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

test("the built public package resolves through its export map and exposes one runtime export", () => {
  assert.equal(
    import.meta.resolve("@desen/editor-core"),
    new URL("../dist/index.js", import.meta.url).href,
  );
  assert.deepEqual(Object.keys(editorCore), ["createDesenEditorDocument"]);
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

  assertRejected(result, "/kind");
  assert.equal(Object.isFrozen(input), false);
  input.id = "rejected-caller-remains-writable";
  assert.equal(input.id, "rejected-caller-remains-writable");
});

test("the emitted factory rejects an invalid embedded schema at its exact pointer", () => {
  const input = cloneFixture();
  input.surfaces["sign-in"].state.email.schema = { type: "string", pattern: "[" };

  const result = editorCore.createDesenEditorDocument(input);

  assertRejected(result, "/surfaces/sign-in/state/email/schema/pattern");
});

test("the emitted factory rejects executable non-JSON data without a partial document", () => {
  const input = cloneFixture();
  input.authoring = { executable: () => "not data" };

  const result = editorCore.createDesenEditorDocument(input);

  assertRejected(result, "");
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
    assertRejected(editorCore.createDesenEditorDocument(input), "");
  }

  assert.equal(getterInvocations, 0);
  assert.equal(toJsonInvocations, 0);
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
  assert.equal(first.artifact.boundary.platformImports, 0);
  assert.equal(first.artifact.evidence.tests.packageRuntimeCases, 7);
  assert.equal(first.artifact.evidence.tests.publicRuntimeContractCases, 10);
  assert.equal(first.artifact.evidence.tests.sourceCompilerNegativeCases, 5);
  assert.equal(first.artifact.evidence.tests.publicCompilerNegativeCases, 5);
  assert.equal(first.artifact.evidence.tests.publicProofCoreCases, 7);
  assert.equal(first.artifact.evidence.tests.rootProofCases, 13);
  assert.equal(first.artifact.evidence.trackedFiles.length, 24);
  assert.match(first.artifact.nonclaims.join("\n"), /M08-T10/u);
  assert.match(first.artifact.nonclaims.join("\n"), /G08/u);
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
  const [source, index, distSource, declaration, manifest] = await Promise.all([
    readFile(new URL("../src/source-document.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../dist/source-document.js", import.meta.url), "utf8"),
    readFile(new URL("../dist/source-document.d.ts", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  const manifestWithPlatformDependency = JSON.stringify({
    ...JSON.parse(manifest),
    dependencies: {
      ...JSON.parse(manifest).dependencies,
      react: "19.0.0",
    },
  });
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
      path: "packages/editor-core/src/index.ts",
      value: `${index}\nexport const hiddenAuthority = true;\n`,
    },
    {
      path: "packages/editor-core/dist/source-document.js",
      value: `${distSource}\nwindow.document;\n`,
    },
    {
      path: "packages/editor-core/dist/source-document.d.ts",
      value: declaration.replace("export type DesenEditorDocument", "type DesenEditorDocument"),
    },
    {
      path: "packages/editor-core/package.json",
      value: manifestWithPlatformDependency,
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
});

test("[proof-core] rejects focused-test inventory drift", async () => {
  const packageTest = await readFile(new URL("./source-document.test.ts", import.meta.url), "utf8");
  const publicTypes = await readFile(
    new URL("./public-package.types.mts", import.meta.url),
    "utf8",
  );

  for (const [path, value] of [
    [
      "packages/editor-core/test/source-document.test.ts",
      packageTest.replace(
        '  it("admits the official Source',
        '  test.skip("admits the official Source',
      ),
    ],
    [
      "packages/editor-core/test/public-package.types.mts",
      publicTypes.replace("// @ts-expect-error", "// compiler assertion removed"),
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

  for (const options of [
    accessor,
    inherited,
    symbol,
    proxy,
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
