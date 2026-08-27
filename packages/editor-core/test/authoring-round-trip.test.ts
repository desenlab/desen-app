import { calculateDesenSourceDigest, canonicalizeJsonBytes } from "@desen/protocol";
import { describe, expect, it } from "vitest";

import validSource from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json";

import {
  clearDesenEditorNodeCondition,
  createDesenEditorDocument,
  deleteDesenEditorAction,
  deleteDesenEditorEventHandler,
  deleteDesenEditorNode,
  deleteDesenEditorOwnerProp,
  deleteDesenEditorOwnerStyleProperty,
  deleteDesenEditorResourceInput,
  deleteDesenEditorStateDeclaration,
  deleteDesenEditorVariant,
  deleteDesenEditorVariantProp,
  deleteDesenEditorVariantStyleProperty,
  insertDesenEditorAction,
  insertDesenEditorEventHandler,
  insertDesenEditorNode,
  insertDesenEditorStateDeclaration,
  insertDesenEditorVariant,
  moveDesenEditorNode,
  reorderDesenEditorAction,
  reorderDesenEditorNode,
  reorderDesenEditorVariant,
  replaceDesenEditorAction,
  setDesenEditorNodeCondition,
  setDesenEditorNodeRepeatItems,
  setDesenEditorNodeRepeatKey,
  setDesenEditorOwnerProp,
  setDesenEditorOwnerStyleProperty,
  setDesenEditorResourceInput,
  setDesenEditorStateInitial,
  setDesenEditorStateSchema,
  setDesenEditorVariantCondition,
  setDesenEditorVariantProp,
  setDesenEditorVariantStyleProperty,
} from "../src/index.js";

import type { DesenEditorDocument } from "../src/index.js";

type MutableRecord = Record<string, unknown>;

type MutationResult =
  | {
      readonly ok: true;
      readonly document: DesenEditorDocument;
      readonly diagnostics: readonly [];
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly { readonly code: string }[];
    };

interface MutationCase {
  readonly name: string;
  readonly run: (document: DesenEditorDocument) => MutationResult;
}

const NAMESPACED_EXTENSION_KEY = "com.example.editor-roundtrip";
const LEGACY_EXTENSION_KEY = "legacy-marker";
const EXPECTED_EXTENSION_KINDS = Object.freeze([
  "document",
  "action.state.set",
  "action.state.toggle",
  "action.navigate",
  "action.operation.invoke",
  "action.resource.refresh",
  "action.component.command",
  "action.event.emit",
  "variant",
  "behavior",
  "repeat",
  "node",
  "state",
  "resource-instance",
  "surface",
  "source-catalog-requirement",
]);

const TRUE_PREDICATE = Object.freeze({
  op: "truthy",
  args: Object.freeze([true]),
});

function clone<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value;
}

function record(value: unknown): MutableRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("Expected a test-fixture object.");
  }
  return value as MutableRecord;
}

function extensionPayload(kind: string): MutableRecord {
  const extensions = JSON.parse(
    `{
      "${NAMESPACED_EXTENSION_KEY}": {
        "kind": "",
        "ordered": ["first", {"middle": true}, "first", null, [], {}],
        "apparentCore": {
          "id": "sign-in.inserted",
          "use": "com.example.invalid/ExtensionMustRemainInert",
          "$ref": "state.extensionMustRemainInert"
        },
        "__proto__": {"retainedAsOwnData": true},
        "constructor": {"retainedAsOwnData": true},
        "prototype": {"retainedAsOwnData": true},
        "unicode": ["İstanbul", "e\\u0301", "雪", "\\ud83d\\ude00"],
        "nullValue": null,
        "emptyObject": {},
        "emptyArray": []
      },
      "${LEGACY_EXTENSION_KEY}": {
        "kind": "",
        "retainedAlthoughNotReverseDomainNamed": true
      },
      "__proto__": {"retainedAsOwnExtensionKey": true},
      "constructor": {"retainedAsOwnExtensionKey": true},
      "prototype": {"retainedAsOwnExtensionKey": true}
    }`,
  ) as MutableRecord;
  record(extensions[NAMESPACED_EXTENSION_KEY]).kind = kind;
  record(extensions[LEGACY_EXTENSION_KEY]).kind = kind;
  return extensions;
}

function authoringPayload(label: string): MutableRecord {
  const apparentCore =
    label === "alpha"
      ? {
          id: "sign-in.inserted",
          use: "com.example.invalid/AuthoringMustRemainInert",
          slots: {
            default: [{ id: "sign-in.title", use: "com.example.invalid/AuthoringShadow" }],
          },
          on: {
            press: [
              { type: "event.emit", name: "authoring.alpha" },
              { type: "state.toggle", path: "authoring.alpha" },
            ],
          },
        }
      : {
          id: "sign-in.inserted",
          use: "com.example.invalid/AuthoringMustRemainInert",
          behaviors: [{ id: "sign-in.behavior", use: "com.example.invalid/AuthoringShadow" }],
          slots: {
            default: [{ id: "sign-in.delete-me", use: "com.example.invalid/AuthoringShadow" }],
          },
          on: {
            press: [{ type: "navigate", surface: "authoring-omega" }],
          },
        };
  return JSON.parse(
    `{"canvas":{"sign-in":{"x":17,"y":23}},"selection":{"surfaceId":"sign-in","nodeId":"sign-in.title"},"viewport":{"label":${JSON.stringify(label)},"zoom":1.25},"__proto__":{"retained":true},"apparentCore":${JSON.stringify(apparentCore)}}`,
  ) as MutableRecord;
}

function allExtensionActions(): unknown[] {
  return [
    {
      type: "state.set",
      path: "future.value",
      value: { $ref: "state.future", fallback: null },
      extensions: extensionPayload("action.state.set"),
    },
    {
      type: "state.toggle",
      path: "future.enabled",
      extensions: extensionPayload("action.state.toggle"),
    },
    {
      type: "navigate",
      surface: "future-surface",
      params: { tab: { $ref: "state.future" } },
      extensions: extensionPayload("action.navigate"),
    },
    {
      type: "operation.invoke",
      operation: "com.example.future/Save",
      as: "futureSave",
      input: { value: { $ref: "state.future" } },
      concurrency: "queue",
      onSuccess: [{ type: "event.emit", name: "future.saved" }],
      onFailure: [{ type: "resource.refresh", resource: "futureResource" }],
      extensions: extensionPayload("action.operation.invoke"),
    },
    {
      type: "resource.refresh",
      resource: "futureResource",
      extensions: extensionPayload("action.resource.refresh"),
    },
    {
      type: "component.command",
      target: "future.component",
      command: "futureCommand",
      input: { value: { $ref: "state.future" } },
      extensions: extensionPayload("action.component.command"),
    },
    {
      type: "event.emit",
      name: "future.event",
      payload: { value: { $ref: "state.future" } },
      extensions: extensionPayload("action.event.emit"),
    },
  ];
}

function preservationInput(authoringLabel: string): MutableRecord {
  const input = clone(validSource) as MutableRecord;
  const surfaces = record(input.surfaces);
  const surface = record(surfaces["sign-in"]);
  const root = record(surface.root);
  const slots = record(root.slots);
  const children = slots.default as unknown[];
  const title = record(children[0]);
  const state = record(surface.state);
  const resources = record(surface.resources);
  const catalogs = input.catalogs as unknown[];

  input.authoring = authoringPayload(authoringLabel);
  input.extensions = extensionPayload("document");
  record(catalogs[0]).extensions = extensionPayload("source-catalog-requirement");
  surface.extensions = extensionPayload("surface");
  record(state.email).extensions = extensionPayload("state");
  state.deleteMe = { schema: { type: "boolean" }, initial: false };
  resources.proof = {
    use: "com.example.data/Proof",
    input: {
      existing: { $ref: "state.email" },
      removeMe: { $ref: "state.password" },
    },
    policy: "manual",
    extensions: extensionPayload("resource-instance"),
  };

  root.extensions = extensionPayload("node");
  root.behaviors = [
    {
      id: "sign-in.behavior",
      use: "com.example.interactions/Preview",
      props: { removeMe: true },
      style: { base: { root: { removeMe: true } } },
      slots: { holding: [] },
      extensions: extensionPayload("behavior"),
    },
  ];
  root.on = { preservation: allExtensionActions() };

  title.props = { ...record(title.props), removeMe: true };
  title.style = { base: { root: { removeMe: true } } };
  title.when = clone(TRUE_PREDICATE);
  title.repeat = {
    items: { $ref: "resource.proof.value", fallback: [] },
    as: "row",
    key: { $ref: "item.row.id" },
    limit: 10,
    extensions: extensionPayload("repeat"),
  };
  title.variants = [
    {
      when: clone(TRUE_PREDICATE),
      props: { removeMe: true },
      style: { base: { root: { removeMe: true } } },
      extensions: extensionPayload("variant"),
    },
    { when: { op: "truthy", args: [false] }, props: { removable: true } },
  ];
  title.on = {
    edit: [
      { type: "state.toggle", path: "future.edit" },
      { type: "navigate", surface: "future-edit" },
    ],
    deleteMe: [{ type: "event.emit", name: "future.delete" }],
  };

  children.push(
    { id: "sign-in.delete-me", use: "com.example.ui/Text" },
    { id: "sign-in.move-me", use: "com.example.ui/Text" },
    { id: "sign-in.reorder-me", use: "com.example.ui/Text" },
  );
  return input;
}

function createDocument(input: unknown): DesenEditorDocument {
  const result = createDesenEditorDocument(input);
  if (!result.ok) {
    throw new TypeError(
      `Expected preservation fixture admission: ${result.diagnostics[0]?.code ?? "missing diagnostic"}`,
    );
  }
  return result.document;
}

function successful(result: MutationResult): DesenEditorDocument {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new TypeError(`Expected preservation edit success: ${result.diagnostics[0]?.code}`);
  }
  expect(result.diagnostics).toEqual([]);
  return result.document;
}

function extensionProjection(root: unknown): readonly (readonly [string, unknown])[] {
  const found = new Map<string, unknown>();
  const pending = [root];
  const visited = new Set<object>();

  while (pending.length > 0) {
    const value = pending.pop();
    if (typeof value !== "object" || value === null || visited.has(value)) continue;
    visited.add(value);
    if (!Array.isArray(value)) {
      const descriptors = Object.getOwnPropertyDescriptors(value);
      const extensionDescriptor = descriptors.extensions;
      if (extensionDescriptor !== undefined && "value" in extensionDescriptor) {
        const extensions = record(extensionDescriptor.value);
        const marker = record(extensions[NAMESPACED_EXTENSION_KEY]);
        if (typeof marker.kind === "string") {
          expect(found.has(marker.kind)).toBe(false);
          found.set(marker.kind, clone(extensions));
        }
      }
      for (const descriptor of Object.values(descriptors)) {
        if ("value" in descriptor) pending.push(descriptor.value);
      }
    } else {
      pending.push(...value);
    }
  }

  return Object.freeze(
    [...found.entries()]
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([kind, extensions]) => Object.freeze([kind, extensions] as const)),
  );
}

function withoutAuthoring(document: DesenEditorDocument): MutableRecord {
  const projection = clone(document) as MutableRecord;
  delete projection.authoring;
  return projection;
}

function firstRootDefaultChildId(document: DesenEditorDocument): unknown {
  const surface = record(record(document.surfaces)["sign-in"]);
  const root = record(surface.root);
  const children = record(root.slots).default as unknown[];
  return record(children[0]).id;
}

function reopenThroughJson(document: DesenEditorDocument): DesenEditorDocument {
  const expectedBytes = canonicalizeJsonBytes(document);
  const expectedAuthoring = clone(document.authoring);
  const expectedExtensions = extensionProjection(document);
  const parsed = JSON.parse(JSON.stringify(document)) as MutableRecord;
  const reopened = createDocument(parsed);

  expect(reopened).not.toBe(document);
  expect(reopened).not.toBe(parsed);
  expect(reopened.authoring).not.toBe(parsed.authoring);
  expect(reopened.extensions).not.toBe(parsed.extensions);
  expect(reopened.authoring).toEqual(expectedAuthoring);
  expect(extensionProjection(reopened)).toEqual(expectedExtensions);
  expect(canonicalizeJsonBytes(reopened)).toEqual(expectedBytes);
  expectDeepFrozen(reopened);

  record(parsed.authoring).roundTripCallerMutation = true;
  record(record(parsed.extensions)[NAMESPACED_EXTENSION_KEY]).roundTripCallerMutation = true;
  expect(reopened.authoring).toEqual(expectedAuthoring);
  expect(extensionProjection(reopened)).toEqual(expectedExtensions);
  expect(canonicalizeJsonBytes(reopened)).toEqual(expectedBytes);
  return reopened;
}

function expectDeepFrozen(root: unknown): void {
  const pending = [root];
  const visited = new Set<object>();
  while (pending.length > 0) {
    const value = pending.pop();
    if (typeof value !== "object" || value === null || visited.has(value)) continue;
    visited.add(value);
    expect(Object.isFrozen(value)).toBe(true);
    pending.push(...Object.values(value));
  }
}

const mutationCases: readonly MutationCase[] = Object.freeze([
  {
    name: "insertDesenEditorNode",
    run: (document) =>
      insertDesenEditorNode(document, {
        surfaceId: "sign-in",
        parentId: "sign-in.layout",
        slot: "default",
        index: 0,
        idBase: "sign-in.inserted",
        use: "com.example.future/Unknown",
      }),
  },
  {
    name: "deleteDesenEditorNode",
    run: (document) =>
      deleteDesenEditorNode(document, { surfaceId: "sign-in", nodeId: "sign-in.delete-me" }),
  },
  {
    name: "moveDesenEditorNode",
    run: (document) =>
      moveDesenEditorNode(document, {
        surfaceId: "sign-in",
        nodeId: "sign-in.move-me",
        parentId: "sign-in.behavior",
        slot: "holding",
        index: 0,
      }),
  },
  {
    name: "reorderDesenEditorNode",
    run: (document) =>
      reorderDesenEditorNode(document, {
        surfaceId: "sign-in",
        parentId: "sign-in.layout",
        slot: "default",
        nodeId: "sign-in.reorder-me",
        index: 0,
      }),
  },
  {
    name: "setDesenEditorOwnerProp",
    run: (document) =>
      setDesenEditorOwnerProp(document, {
        surfaceId: "sign-in",
        ownerId: "sign-in.title",
        name: "futureProp",
        value: { $ref: "state.future" },
      }),
  },
  {
    name: "deleteDesenEditorOwnerProp",
    run: (document) =>
      deleteDesenEditorOwnerProp(document, {
        surfaceId: "sign-in",
        ownerId: "sign-in.title",
        name: "removeMe",
      }),
  },
  {
    name: "setDesenEditorOwnerStyleProperty",
    run: (document) =>
      setDesenEditorOwnerStyleProperty(document, {
        surfaceId: "sign-in",
        ownerId: "sign-in.title",
        state: "future",
        part: "root",
        property: "color",
        value: { $token: "color.future" },
      }),
  },
  {
    name: "deleteDesenEditorOwnerStyleProperty",
    run: (document) =>
      deleteDesenEditorOwnerStyleProperty(document, {
        surfaceId: "sign-in",
        ownerId: "sign-in.title",
        state: "base",
        part: "root",
        property: "removeMe",
      }),
  },
  {
    name: "setDesenEditorNodeCondition",
    run: (document) =>
      setDesenEditorNodeCondition(document, {
        surfaceId: "sign-in",
        nodeId: "sign-in.title",
        when: { op: "truthy", args: [false] },
      }),
  },
  {
    name: "clearDesenEditorNodeCondition",
    run: (document) =>
      clearDesenEditorNodeCondition(document, {
        surfaceId: "sign-in",
        nodeId: "sign-in.title",
      }),
  },
  {
    name: "insertDesenEditorVariant",
    run: (document) =>
      insertDesenEditorVariant(document, {
        surfaceId: "sign-in",
        nodeId: "sign-in.title",
        index: 1,
        variant: { when: { op: "truthy", args: [true] }, props: { inserted: true } },
      }),
  },
  {
    name: "deleteDesenEditorVariant",
    run: (document) =>
      deleteDesenEditorVariant(document, {
        surfaceId: "sign-in",
        nodeId: "sign-in.title",
        index: 1,
      }),
  },
  {
    name: "reorderDesenEditorVariant",
    run: (document) =>
      reorderDesenEditorVariant(document, {
        surfaceId: "sign-in",
        nodeId: "sign-in.title",
        variantIndex: 1,
        index: 0,
      }),
  },
  {
    name: "setDesenEditorVariantCondition",
    run: (document) =>
      setDesenEditorVariantCondition(document, {
        surfaceId: "sign-in",
        nodeId: "sign-in.title",
        index: 0,
        when: { op: "truthy", args: [false] },
      }),
  },
  {
    name: "setDesenEditorVariantProp",
    run: (document) =>
      setDesenEditorVariantProp(document, {
        surfaceId: "sign-in",
        nodeId: "sign-in.title",
        index: 0,
        name: "future",
        value: true,
      }),
  },
  {
    name: "deleteDesenEditorVariantProp",
    run: (document) =>
      deleteDesenEditorVariantProp(document, {
        surfaceId: "sign-in",
        nodeId: "sign-in.title",
        index: 0,
        name: "removeMe",
      }),
  },
  {
    name: "setDesenEditorVariantStyleProperty",
    run: (document) =>
      setDesenEditorVariantStyleProperty(document, {
        surfaceId: "sign-in",
        nodeId: "sign-in.title",
        index: 0,
        state: "future",
        part: "root",
        property: "color",
        value: "purple",
      }),
  },
  {
    name: "deleteDesenEditorVariantStyleProperty",
    run: (document) =>
      deleteDesenEditorVariantStyleProperty(document, {
        surfaceId: "sign-in",
        nodeId: "sign-in.title",
        index: 0,
        state: "base",
        part: "root",
        property: "removeMe",
      }),
  },
  {
    name: "insertDesenEditorStateDeclaration",
    run: (document) =>
      insertDesenEditorStateDeclaration(document, {
        surfaceId: "sign-in",
        name: "inserted",
        declaration: { schema: { type: "string" }, initial: "" },
      }),
  },
  {
    name: "deleteDesenEditorStateDeclaration",
    run: (document) =>
      deleteDesenEditorStateDeclaration(document, { surfaceId: "sign-in", name: "deleteMe" }),
  },
  {
    name: "setDesenEditorStateSchema",
    run: (document) =>
      setDesenEditorStateSchema(document, {
        surfaceId: "sign-in",
        name: "email",
        schema: { type: "number", minimum: 0 },
      }),
  },
  {
    name: "setDesenEditorStateInitial",
    run: (document) =>
      setDesenEditorStateInitial(document, {
        surfaceId: "sign-in",
        name: "email",
        initial: { inert: true },
      }),
  },
  {
    name: "setDesenEditorNodeRepeatItems",
    run: (document) =>
      setDesenEditorNodeRepeatItems(document, {
        surfaceId: "sign-in",
        nodeId: "sign-in.title",
        items: { $ref: "state.futureRows" },
      }),
  },
  {
    name: "setDesenEditorNodeRepeatKey",
    run: (document) =>
      setDesenEditorNodeRepeatKey(document, {
        surfaceId: "sign-in",
        nodeId: "sign-in.title",
        key: { $ref: "item.row.futureId" },
      }),
  },
  {
    name: "setDesenEditorResourceInput",
    run: (document) =>
      setDesenEditorResourceInput(document, {
        surfaceId: "sign-in",
        resourceId: "proof",
        name: "inserted",
        value: { $ref: "state.future" },
      }),
  },
  {
    name: "deleteDesenEditorResourceInput",
    run: (document) =>
      deleteDesenEditorResourceInput(document, {
        surfaceId: "sign-in",
        resourceId: "proof",
        name: "removeMe",
      }),
  },
  {
    name: "insertDesenEditorEventHandler",
    run: (document) =>
      insertDesenEditorEventHandler(document, {
        surfaceId: "sign-in",
        ownerId: "sign-in.title",
        event: "inserted",
        actions: [{ type: "event.emit", name: "future.inserted" }],
      }),
  },
  {
    name: "deleteDesenEditorEventHandler",
    run: (document) =>
      deleteDesenEditorEventHandler(document, {
        surfaceId: "sign-in",
        ownerId: "sign-in.title",
        event: "deleteMe",
      }),
  },
  {
    name: "insertDesenEditorAction",
    run: (document) =>
      insertDesenEditorAction(document, {
        surfaceId: "sign-in",
        ownerId: "sign-in.title",
        actionListPointer: "/on/edit",
        index: 1,
        action: { type: "resource.refresh", resource: "futureResource" },
      }),
  },
  {
    name: "replaceDesenEditorAction",
    run: (document) =>
      replaceDesenEditorAction(document, {
        surfaceId: "sign-in",
        ownerId: "sign-in.title",
        actionPointer: "/on/edit/0",
        action: { type: "event.emit", name: "future.replaced" },
      }),
  },
  {
    name: "deleteDesenEditorAction",
    run: (document) =>
      deleteDesenEditorAction(document, {
        surfaceId: "sign-in",
        ownerId: "sign-in.title",
        actionPointer: "/on/edit/0",
      }),
  },
  {
    name: "reorderDesenEditorAction",
    run: (document) =>
      reorderDesenEditorAction(document, {
        surfaceId: "sign-in",
        ownerId: "sign-in.title",
        actionPointer: "/on/edit/0",
        index: 1,
      }),
  },
]);

describe("M08-T07 authoring isolation and extension round trips", () => {
  it("round-trips root authoring and all 16 Source extension locations without assigning semantics", () => {
    const input = preservationInput("alpha");
    const expectedAuthoring = clone(input.authoring);
    const expectedExtensions = extensionProjection(input);
    const document = createDocument(input);
    const alternate = createDocument(preservationInput("omega"));
    const extensionChangedInput = preservationInput("alpha");
    record(record(extensionChangedInput.extensions)[NAMESPACED_EXTENSION_KEY]).changed = true;
    const extensionChanged = createDocument(extensionChangedInput);
    const reopened = reopenThroughJson(document);
    const reopenedAlternate = reopenThroughJson(alternate);
    const reopenedExtensionChanged = reopenThroughJson(extensionChanged);

    expect(expectedExtensions.map(([kind]) => kind)).toEqual([...EXPECTED_EXTENSION_KINDS].sort());
    for (const [, extensionsValue] of expectedExtensions) {
      const extensions = record(extensionsValue);
      const namespaced = record(extensions[NAMESPACED_EXTENSION_KEY]);
      expect(Object.hasOwn(extensions, "__proto__")).toBe(true);
      expect(Object.hasOwn(extensions, "constructor")).toBe(true);
      expect(Object.hasOwn(extensions, "prototype")).toBe(true);
      expect(Object.hasOwn(namespaced, "__proto__")).toBe(true);
      expect(Object.hasOwn(namespaced, "constructor")).toBe(true);
      expect(Object.hasOwn(namespaced, "prototype")).toBe(true);
      expect(namespaced.apparentCore).toMatchObject({ id: "sign-in.inserted" });
      expect(namespaced.ordered).toEqual(["first", { middle: true }, "first", null, [], {}]);
      expect(namespaced.unicode).toEqual(["İstanbul", "é", "雪", "😀"]);
      expect(namespaced.nullValue).toBeNull();
      expect(namespaced.emptyObject).toEqual({});
      expect(namespaced.emptyArray).toEqual([]);
    }
    const leftApparentCore = record(record(document.authoring).apparentCore);
    const rightApparentCore = record(record(alternate.authoring).apparentCore);
    expect(leftApparentCore.id).toBe("sign-in.inserted");
    expect(rightApparentCore.id).toBe("sign-in.inserted");
    expect(leftApparentCore.slots).not.toEqual(rightApparentCore.slots);
    expect(leftApparentCore.on).not.toEqual(rightApparentCore.on);
    expect(document.authoring).toEqual(expectedAuthoring);
    expect(extensionProjection(document)).toEqual(expectedExtensions);
    expect(canonicalizeJsonBytes(withoutAuthoring(document))).toEqual(
      canonicalizeJsonBytes(withoutAuthoring(alternate)),
    );
    expect(calculateDesenSourceDigest(document)).toBe(calculateDesenSourceDigest(alternate));
    expect(calculateDesenSourceDigest(extensionChanged)).not.toBe(
      calculateDesenSourceDigest(document),
    );
    expect(calculateDesenSourceDigest(reopened)).toBe(
      calculateDesenSourceDigest(reopenedAlternate),
    );
    expect(calculateDesenSourceDigest(reopenedExtensionChanged)).not.toBe(
      calculateDesenSourceDigest(reopened),
    );

    record(record(input.authoring).viewport).label = "caller-mutated";
    record(record(input.extensions)[NAMESPACED_EXTENSION_KEY]).changed = "caller-mutated";
    expect(document.authoring).toEqual(expectedAuthoring);
    expect(extensionProjection(document)).toEqual(expectedExtensions);
    expectDeepFrozen(document);
  });

  it.each(mutationCases)(
    "$name isolates root authoring and preserves every unknown extension parsed value",
    ({ name, run }) => {
      const leftDocument = createDocument(preservationInput("alpha"));
      const rightDocument = createDocument(preservationInput("omega"));
      const expectedLeftAuthoring = clone(leftDocument.authoring);
      const expectedRightAuthoring = clone(rightDocument.authoring);
      const expectedExtensions = extensionProjection(leftDocument);
      const leftBytes = canonicalizeJsonBytes(leftDocument);
      const rightBytes = canonicalizeJsonBytes(rightDocument);

      const left = successful(run(leftDocument));
      const right = successful(run(rightDocument));
      const reopenedLeft = reopenThroughJson(left);
      const reopenedRight = reopenThroughJson(right);

      expect(left).not.toBe(leftDocument);
      expect(right).not.toBe(rightDocument);
      if (name === "insertDesenEditorNode") {
        expect(firstRootDefaultChildId(left)).toBe("sign-in.inserted");
        expect(firstRootDefaultChildId(right)).toBe("sign-in.inserted");
      }
      expect(left.authoring).toEqual(expectedLeftAuthoring);
      expect(right.authoring).toEqual(expectedRightAuthoring);
      expect(extensionProjection(left)).toEqual(expectedExtensions);
      expect(extensionProjection(right)).toEqual(expectedExtensions);
      expect(canonicalizeJsonBytes(withoutAuthoring(left))).toEqual(
        canonicalizeJsonBytes(withoutAuthoring(right)),
      );
      expect(calculateDesenSourceDigest(left)).toBe(calculateDesenSourceDigest(right));
      expect(calculateDesenSourceDigest(reopenedLeft)).toBe(
        calculateDesenSourceDigest(reopenedRight),
      );
      expect(canonicalizeJsonBytes(leftDocument)).toEqual(leftBytes);
      expect(canonicalizeJsonBytes(rightDocument)).toEqual(rightBytes);
      expectDeepFrozen(left);
      expectDeepFrozen(right);
    },
  );
});
