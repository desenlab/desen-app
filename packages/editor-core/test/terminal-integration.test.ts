import { calculateDesenSourceDigest, canonicalizeJsonBytes, sha256Digest } from "@desen/protocol";
import { describe, expect, it } from "vitest";

import validSource from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json";
import validCatalog from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json";

import {
  clearDesenEditorNodeCondition,
  createDesenEditorContinuousValidator,
  createDesenEditorDocument,
  createDesenEditorPersistencePort,
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

import type { DesenEditorDocument, DesenEditorPersistenceAdapter } from "../src/index.js";

type MutableRecord = Record<string, unknown>;

type TerminalMutationResult =
  | Readonly<{
      readonly ok: true;
      readonly document: DesenEditorDocument;
      readonly diagnostics: readonly unknown[];
      readonly insertedNodeId?: string;
    }>
  | Readonly<{
      readonly ok: false;
      readonly diagnostics: readonly unknown[];
    }>;

interface TranscriptStep {
  readonly name: string;
  readonly apply: (document: DesenEditorDocument) => TerminalMutationResult;
  readonly expectedAddedIdentities?: readonly string[];
  readonly expectedRemovedIdentities?: readonly string[];
  readonly expectedInsertedNodeId?: string;
}

interface TranscriptLedgerEntry {
  readonly index: number;
  readonly name: string;
  readonly sourceDigest: string;
  readonly documentFingerprint: string;
  readonly canonicalByteLength: number;
  readonly identities: readonly string[];
  readonly addedIdentities: readonly string[];
  readonly removedIdentities: readonly string[];
}

interface TranscriptResult {
  readonly document: DesenEditorDocument;
  readonly ledger: readonly TranscriptLedgerEntry[];
  readonly controlledFailureCode: string;
}

const SURFACE_ID = "sign-in";
const ROOT_ID = "sign-in.layout";
const INSERTED_ID = "sign-in.terminal";
const DELETE_PARENT_ID = "sign-in.delete-parent";
const DELETE_CHILD_ID = "sign-in.delete-child";
const TRUE_PREDICATE = Object.freeze({ op: "truthy", args: Object.freeze([true]) });

function clone<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value;
}

function record(value: unknown): MutableRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("Expected a test-fixture object.");
  }
  return value as MutableRecord;
}

function createFatalUtf8Decoder(): {
  readonly decode: (input: Readonly<Uint8Array>) => string;
} {
  const constructor = Reflect.get(globalThis, "TextDecoder") as unknown;
  if (typeof constructor !== "function") {
    throw new TypeError("Expected the persistence test host to provide TextDecoder.");
  }
  type DecoderConstructor = new (
    label: string,
    options: Readonly<{ fatal: boolean; ignoreBOM: boolean }>,
  ) => { readonly decode: (input: Readonly<Uint8Array>) => string };
  return new (constructor as DecoderConstructor)("utf-8", { fatal: true, ignoreBOM: true });
}

function terminalFixture(authoringMarker: string): MutableRecord {
  const input = clone(validSource) as MutableRecord;
  const surface = record(record(input.surfaces)[SURFACE_ID]);
  const state = record(surface.state);
  const resources = record(surface.resources);
  const root = record(surface.root);
  const children = record(root.slots).default;
  if (!Array.isArray(children)) throw new TypeError("Expected the root default slot.");

  input.authoring = {
    ...record(input.authoring),
    terminalIntegration: {
      marker: authoringMarker,
      selection: { surfaceId: SURFACE_ID, nodeId: "sign-in.title" },
    },
  };
  state.terminalNote = {
    schema: { type: "string" },
    initial: "initial",
  };
  resources.terminalTasks = {
    use: "com.example.tasks/list",
    input: {},
    policy: "manual",
  };

  const title = record(children[0]);
  title.variants = [
    {
      when: clone(TRUE_PREDICATE),
      props: { role: "body" },
    },
  ];

  const email = record(children[1]);
  const emailChangeActions = record(email.on).change;
  if (!Array.isArray(emailChangeActions)) throw new TypeError("Expected the email change handler.");
  emailChangeActions.push({
    type: "state.set",
    path: "terminalNote",
    value: { $ref: "event.value" },
  });

  children.push(
    {
      id: "sign-in.container",
      use: "com.example.ui/Stack",
      slots: { default: [] },
    },
    {
      id: DELETE_PARENT_ID,
      use: "com.example.ui/Stack",
      slots: {
        default: [
          {
            id: DELETE_CHILD_ID,
            use: "com.example.ui/Text",
            props: { text: "Deleted with its parent" },
          },
        ],
      },
    },
    {
      id: "sign-in.move",
      use: "com.example.ui/Text",
      props: { text: "Moved without changing identity" },
    },
    {
      id: "sign-in.reorder",
      use: "com.example.ui/Text",
      props: { text: "Reordered without changing identity" },
    },
    {
      id: "sign-in.repeat",
      use: "com.example.ui/Text",
      props: { text: { $ref: "item.row.title" } },
      repeat: {
        items: [{ id: "row-1", title: "First" }],
        as: "row",
        key: { $ref: "item.row.id" },
      },
    },
  );
  return input;
}

function admit(input: unknown): DesenEditorDocument {
  const result = createDesenEditorDocument(input);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new TypeError("Expected the terminal integration fixture to be admitted.");
  return result.document;
}

function createValidator() {
  const result = createDesenEditorContinuousValidator([clone(validCatalog)]);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new TypeError("Expected the terminal integration Catalog to be admitted.");
  return result.validator;
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

function collectIdentities(document: DesenEditorDocument): readonly string[] {
  type Surface = DesenEditorDocument["surfaces"][string];
  type Node = Surface["root"];
  type Behavior = NonNullable<Node["behaviors"]>[number];

  const identities: string[] = [];
  const surfaceEntries = Object.entries(document.surfaces).sort(([left], [right]) =>
    left < right ? -1 : left > right ? 1 : 0,
  );

  function visitOwner(surfaceId: string, kind: "behavior" | "node", owner: Behavior | Node): void {
    identities.push(`${surfaceId}/${kind}/${owner.id}`);
    if (kind === "node") {
      for (const behavior of (owner as Node).behaviors ?? []) {
        visitOwner(surfaceId, "behavior", behavior);
      }
    }
    for (const children of Object.values(owner.slots ?? {})) {
      for (const child of children) visitOwner(surfaceId, "node", child);
    }
  }

  for (const [surfaceId, surface] of surfaceEntries) visitOwner(surfaceId, "node", surface.root);
  return Object.freeze(identities.sort());
}

function difference(left: readonly string[], right: readonly string[]): readonly string[] {
  const rightSet = new Set(right);
  return Object.freeze(left.filter((value) => !rightSet.has(value)).sort());
}

const TRANSCRIPT_STEPS: readonly TranscriptStep[] = Object.freeze([
  {
    name: "insertDesenEditorNode",
    apply: (document) =>
      insertDesenEditorNode(document, {
        surfaceId: SURFACE_ID,
        parentId: ROOT_ID,
        slot: "default",
        index: 10,
        idBase: INSERTED_ID,
        use: "com.example.ui/Stack",
      }),
    expectedAddedIdentities: Object.freeze([`${SURFACE_ID}/node/${INSERTED_ID}`]),
    expectedInsertedNodeId: INSERTED_ID,
  },
  {
    name: "deleteDesenEditorNode",
    apply: (document) =>
      deleteDesenEditorNode(document, { surfaceId: SURFACE_ID, nodeId: DELETE_PARENT_ID }),
    expectedRemovedIdentities: Object.freeze(
      [`${SURFACE_ID}/node/${DELETE_PARENT_ID}`, `${SURFACE_ID}/node/${DELETE_CHILD_ID}`].sort(),
    ),
  },
  {
    name: "moveDesenEditorNode",
    apply: (document) =>
      moveDesenEditorNode(document, {
        surfaceId: SURFACE_ID,
        nodeId: "sign-in.move",
        parentId: "sign-in.container",
        slot: "default",
        index: 0,
      }),
  },
  {
    name: "reorderDesenEditorNode",
    apply: (document) =>
      reorderDesenEditorNode(document, {
        surfaceId: SURFACE_ID,
        parentId: ROOT_ID,
        slot: "default",
        nodeId: "sign-in.reorder",
        index: 0,
      }),
  },
  {
    name: "setDesenEditorOwnerProp",
    apply: (document) =>
      setDesenEditorOwnerProp(document, {
        surfaceId: SURFACE_ID,
        ownerId: INSERTED_ID,
        name: "gap",
        value: "sm",
      }),
  },
  {
    name: "deleteDesenEditorOwnerProp",
    apply: (document) =>
      deleteDesenEditorOwnerProp(document, {
        surfaceId: SURFACE_ID,
        ownerId: INSERTED_ID,
        name: "gap",
      }),
  },
  {
    name: "setDesenEditorOwnerStyleProperty",
    apply: (document) =>
      setDesenEditorOwnerStyleProperty(document, {
        surfaceId: SURFACE_ID,
        ownerId: INSERTED_ID,
        state: "base",
        part: "root",
        property: "padding",
        value: 12,
      }),
  },
  {
    name: "deleteDesenEditorOwnerStyleProperty",
    apply: (document) =>
      deleteDesenEditorOwnerStyleProperty(document, {
        surfaceId: SURFACE_ID,
        ownerId: INSERTED_ID,
        state: "base",
        part: "root",
        property: "padding",
      }),
  },
  {
    name: "setDesenEditorNodeCondition",
    apply: (document) =>
      setDesenEditorNodeCondition(document, {
        surfaceId: SURFACE_ID,
        nodeId: INSERTED_ID,
        when: clone(TRUE_PREDICATE),
      }),
  },
  {
    name: "clearDesenEditorNodeCondition",
    apply: (document) =>
      clearDesenEditorNodeCondition(document, { surfaceId: SURFACE_ID, nodeId: INSERTED_ID }),
  },
  {
    name: "insertDesenEditorVariant",
    apply: (document) =>
      insertDesenEditorVariant(document, {
        surfaceId: SURFACE_ID,
        nodeId: "sign-in.title",
        index: 1,
        variant: {
          when: clone(TRUE_PREDICATE),
          props: { role: "caption" },
        },
      }),
  },
  {
    name: "reorderDesenEditorVariant",
    apply: (document) =>
      reorderDesenEditorVariant(document, {
        surfaceId: SURFACE_ID,
        nodeId: "sign-in.title",
        variantIndex: 1,
        index: 0,
      }),
  },
  {
    name: "setDesenEditorVariantCondition",
    apply: (document) =>
      setDesenEditorVariantCondition(document, {
        surfaceId: SURFACE_ID,
        nodeId: "sign-in.title",
        index: 0,
        when: { op: "truthy", args: [false] },
      }),
  },
  {
    name: "setDesenEditorVariantProp",
    apply: (document) =>
      setDesenEditorVariantProp(document, {
        surfaceId: SURFACE_ID,
        nodeId: "sign-in.title",
        index: 0,
        name: "role",
        value: "heading",
      }),
  },
  {
    name: "deleteDesenEditorVariantProp",
    apply: (document) =>
      deleteDesenEditorVariantProp(document, {
        surfaceId: SURFACE_ID,
        nodeId: "sign-in.title",
        index: 0,
        name: "role",
      }),
  },
  {
    name: "setDesenEditorVariantStyleProperty",
    apply: (document) =>
      setDesenEditorVariantStyleProperty(document, {
        surfaceId: SURFACE_ID,
        nodeId: "sign-in.title",
        index: 0,
        state: "base",
        part: "text",
        property: "color",
        value: "purple",
      }),
  },
  {
    name: "deleteDesenEditorVariantStyleProperty",
    apply: (document) =>
      deleteDesenEditorVariantStyleProperty(document, {
        surfaceId: SURFACE_ID,
        nodeId: "sign-in.title",
        index: 0,
        state: "base",
        part: "text",
        property: "color",
      }),
  },
  {
    name: "deleteDesenEditorVariant",
    apply: (document) =>
      deleteDesenEditorVariant(document, {
        surfaceId: SURFACE_ID,
        nodeId: "sign-in.title",
        index: 0,
      }),
  },
  {
    name: "insertDesenEditorStateDeclaration",
    apply: (document) =>
      insertDesenEditorStateDeclaration(document, {
        surfaceId: SURFACE_ID,
        name: "temporary",
        declaration: { schema: { type: "boolean" }, initial: false },
      }),
  },
  {
    name: "deleteDesenEditorStateDeclaration",
    apply: (document) =>
      deleteDesenEditorStateDeclaration(document, {
        surfaceId: SURFACE_ID,
        name: "temporary",
      }),
  },
  {
    name: "setDesenEditorStateSchema",
    apply: (document) =>
      setDesenEditorStateSchema(document, {
        surfaceId: SURFACE_ID,
        name: "terminalNote",
        schema: { type: "string", minLength: 1 },
      }),
  },
  {
    name: "setDesenEditorStateInitial",
    apply: (document) =>
      setDesenEditorStateInitial(document, {
        surfaceId: SURFACE_ID,
        name: "terminalNote",
        initial: "terminal",
      }),
  },
  {
    name: "setDesenEditorNodeRepeatItems",
    apply: (document) =>
      setDesenEditorNodeRepeatItems(document, {
        surfaceId: SURFACE_ID,
        nodeId: "sign-in.repeat",
        items: [
          { id: "row-2", title: "Second" },
          { id: "row-3", title: "Third" },
        ],
      }),
  },
  {
    name: "setDesenEditorNodeRepeatKey",
    apply: (document) =>
      setDesenEditorNodeRepeatKey(document, {
        surfaceId: SURFACE_ID,
        nodeId: "sign-in.repeat",
        key: { $ref: "item.row.id" },
      }),
  },
  {
    name: "setDesenEditorResourceInput",
    apply: (document) =>
      setDesenEditorResourceInput(document, {
        surfaceId: SURFACE_ID,
        resourceId: "terminalTasks",
        name: "temporary",
        value: "removed-before-validation",
      }),
  },
  {
    name: "deleteDesenEditorResourceInput",
    apply: (document) =>
      deleteDesenEditorResourceInput(document, {
        surfaceId: SURFACE_ID,
        resourceId: "terminalTasks",
        name: "temporary",
      }),
  },
  {
    name: "insertDesenEditorEventHandler",
    apply: (document) =>
      insertDesenEditorEventHandler(document, {
        surfaceId: SURFACE_ID,
        ownerId: INSERTED_ID,
        event: "temporary",
        actions: [{ type: "event.emit", name: "temporary" }],
      }),
  },
  {
    name: "deleteDesenEditorEventHandler",
    apply: (document) =>
      deleteDesenEditorEventHandler(document, {
        surfaceId: SURFACE_ID,
        ownerId: INSERTED_ID,
        event: "temporary",
      }),
  },
  {
    name: "insertDesenEditorAction",
    apply: (document) =>
      insertDesenEditorAction(document, {
        surfaceId: SURFACE_ID,
        ownerId: "sign-in.email",
        actionListPointer: "/on/change",
        index: 2,
        action: { type: "state.set", path: "terminalNote", value: "inserted" },
      }),
  },
  {
    name: "replaceDesenEditorAction",
    apply: (document) =>
      replaceDesenEditorAction(document, {
        surfaceId: SURFACE_ID,
        ownerId: "sign-in.email",
        actionPointer: "/on/change/2",
        action: { type: "state.set", path: "terminalNote", value: "replaced" },
      }),
  },
  {
    name: "reorderDesenEditorAction",
    apply: (document) =>
      reorderDesenEditorAction(document, {
        surfaceId: SURFACE_ID,
        ownerId: "sign-in.email",
        actionPointer: "/on/change/2",
        index: 0,
      }),
  },
  {
    name: "deleteDesenEditorAction",
    apply: (document) =>
      deleteDesenEditorAction(document, {
        surfaceId: SURFACE_ID,
        ownerId: "sign-in.email",
        actionPointer: "/on/change/0",
      }),
  },
]);

function assertControlledFailure(document: DesenEditorDocument): string {
  const beforeBytes = canonicalizeJsonBytes(document);
  const failure = deleteDesenEditorNode(document, {
    surfaceId: SURFACE_ID,
    nodeId: "sign-in.does-not-exist",
  });

  expect(failure.ok).toBe(false);
  if (failure.ok) throw new TypeError("Expected the controlled terminal command to fail.");
  expect(failure.diagnostics[0]?.code).toBe("run.desen.editor/STRUCTURAL_EDIT_TARGET_NOT_FOUND");
  expect(Object.hasOwn(failure, "document")).toBe(false);
  expect(canonicalizeJsonBytes(document)).toEqual(beforeBytes);
  expectDeepFrozen(failure);
  return failure.diagnostics[0]?.code ?? "missing-diagnostic";
}

function runTranscript(input: unknown): TranscriptResult {
  let document = admit(input);
  const ledger: TranscriptLedgerEntry[] = [];
  let controlledFailureCode = "not-run";

  for (const [index, step] of TRANSCRIPT_STEPS.entries()) {
    const priorDocument = document;
    const priorBytes = canonicalizeJsonBytes(priorDocument);
    const priorIdentities = collectIdentities(priorDocument);
    const result = step.apply(priorDocument);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new TypeError(
        `Expected ${step.name} to succeed: ${String(record(result.diagnostics[0]).code)}`,
      );
    }
    expect(result.diagnostics).toEqual([]);
    expect(result.document).not.toBe(priorDocument);
    expect(canonicalizeJsonBytes(priorDocument)).toEqual(priorBytes);
    expectDeepFrozen(result);

    const identities = collectIdentities(result.document);
    const addedIdentities = difference(identities, priorIdentities);
    const removedIdentities = difference(priorIdentities, identities);
    expect(addedIdentities).toEqual(step.expectedAddedIdentities ?? []);
    expect(removedIdentities).toEqual(step.expectedRemovedIdentities ?? []);
    if (step.expectedInsertedNodeId !== undefined) {
      expect(result.insertedNodeId).toBe(step.expectedInsertedNodeId);
    } else {
      expect(Object.hasOwn(result, "insertedNodeId")).toBe(false);
    }

    document = result.document;
    const canonicalBytes = canonicalizeJsonBytes(document);
    ledger.push(
      Object.freeze({
        index,
        name: step.name,
        sourceDigest: calculateDesenSourceDigest(document),
        documentFingerprint: sha256Digest(canonicalBytes),
        canonicalByteLength: canonicalBytes.byteLength,
        identities,
        addedIdentities,
        removedIdentities,
      }),
    );

    // The failed command is intentionally interleaved after structural edits so later families
    // prove that no hidden partial state escaped the rejection boundary.
    if (index === 3) controlledFailureCode = assertControlledFailure(document);
  }

  const frozenLedger = Object.freeze(ledger);
  expectDeepFrozen(frozenLedger);
  return Object.freeze({ document, ledger: frozenLedger, controlledFailureCode });
}

function withoutAuthoring(document: DesenEditorDocument): MutableRecord {
  const projection = clone(document) as MutableRecord;
  delete projection.authoring;
  return projection;
}

describe("M08-T10 terminal editor-core integration", () => {
  it("composes all 32 command APIs with immutable snapshots and an exact stable-identity ledger", () => {
    const callerInput = terminalFixture("same-run");
    const expectedCallerBytes = canonicalizeJsonBytes(callerInput);
    const transcript = runTranscript(callerInput);

    expect(TRANSCRIPT_STEPS).toHaveLength(32);
    expect(transcript.ledger.map(({ name }) => name)).toEqual(
      TRANSCRIPT_STEPS.map(({ name }) => name),
    );
    expect(transcript.controlledFailureCode).toBe(
      "run.desen.editor/STRUCTURAL_EDIT_TARGET_NOT_FOUND",
    );
    expect(collectIdentities(transcript.document)).toContain(`${SURFACE_ID}/node/${INSERTED_ID}`);
    expect(collectIdentities(transcript.document)).not.toContain(
      `${SURFACE_ID}/node/${DELETE_PARENT_ID}`,
    );
    expect(collectIdentities(transcript.document)).not.toContain(
      `${SURFACE_ID}/node/${DELETE_CHILD_ID}`,
    );
    expect(canonicalizeJsonBytes(callerInput)).toEqual(expectedCallerBytes);
    expect(
      transcript.ledger.every(({ documentFingerprint }) =>
        /^sha256:[0-9a-f]{64}$/u.test(documentFingerprint),
      ),
    ).toBe(true);
    expectDeepFrozen(transcript);
  });

  it("replays two independent command runs byte-for-byte without sharing result identity", () => {
    const first = runTranscript(terminalFixture("deterministic"));
    const second = runTranscript(terminalFixture("deterministic"));

    expect(first.ledger).toEqual(second.ledger);
    expect(first.ledger.map(({ documentFingerprint }) => documentFingerprint)).toEqual(
      second.ledger.map(({ documentFingerprint }) => documentFingerprint),
    );
    expect(first.document).toEqual(second.document);
    expect(canonicalizeJsonBytes(first.document)).toEqual(canonicalizeJsonBytes(second.document));
    expect(first.document).not.toBe(second.document);
    expect(first.document.surfaces).not.toBe(second.document.surfaces);
    expect(calculateDesenSourceDigest(first.document)).toBe(
      calculateDesenSourceDigest(second.document),
    );
  });

  it("ends T09-valid with retained obligations and distinguishes authoring fingerprints from digests", () => {
    const first = runTranscript(terminalFixture("authoring-alpha"));
    const second = runTranscript(terminalFixture("authoring-omega"));
    const validator = createValidator();
    const firstReport = validator.validate(first.document);
    const secondReport = validator.validate(second.document);

    expect(firstReport.valid).toBe(true);
    expect(secondReport.valid).toBe(true);
    expect(firstReport.diagnostics).toEqual([]);
    expect(secondReport.diagnostics).toEqual([]);
    expect(firstReport.invalidSubjects).toEqual([]);
    expect(secondReport.invalidSubjects).toEqual([]);
    expect(firstReport.unmappedDiagnosticIndexes).toEqual([]);
    expect(secondReport.unmappedDiagnosticIndexes).toEqual([]);
    expect(firstReport.obligations.length).toBeGreaterThan(0);
    expect(secondReport.obligations).toEqual(firstReport.obligations);
    expect(canonicalizeJsonBytes(withoutAuthoring(first.document))).toEqual(
      canonicalizeJsonBytes(withoutAuthoring(second.document)),
    );
    expect(calculateDesenSourceDigest(first.document)).toBe(
      calculateDesenSourceDigest(second.document),
    );
    expect(firstReport.documentFingerprint).not.toBe(secondReport.documentFingerprint);
    expect(firstReport.documentFingerprint).toBe(first.ledger.at(-1)?.documentFingerprint);
    expect(secondReport.documentFingerprint).toBe(second.ledger.at(-1)?.documentFingerprint);
    expectDeepFrozen(firstReport);
    expectDeepFrozen(secondReport);
  });

  it("round-trips the terminal document through an injected T08 persistence adapter", async () => {
    const transcript = runTranscript(terminalFixture("persistence"));
    const expectedBytes = canonicalizeJsonBytes(transcript.document);
    const decoder = createFatalUtf8Decoder();
    const calls: string[] = [];
    let missingReadObserved = false;
    let stored:
      | Readonly<{ readonly generation: 1; readonly sourceKey: string; readonly value: unknown }>
      | undefined;
    const adapter: DesenEditorPersistenceAdapter = {
      readSource: async (sourceKey) => {
        expect(sourceKey).toBe("terminal-source");
        if (stored === undefined) {
          expect(missingReadObserved).toBe(false);
          missingReadObserved = true;
          calls.push(`read:${sourceKey}:missing`);
          return { status: "missing" };
        }
        expect(missingReadObserved).toBe(true);
        expect(stored.sourceKey).toBe(sourceKey);
        calls.push(`read:${sourceKey}:found:${stored.generation}`);
        return {
          status: "found",
          record: {
            sourceKey: stored.sourceKey,
            generation: stored.generation,
            value: clone(stored.value),
          },
        };
      },
      compareAndSetSource: async (request) => {
        expect(missingReadObserved).toBe(true);
        expect(stored).toBeUndefined();
        expect(Reflect.ownKeys(request)).toEqual(["sourceKey", "expectedGeneration", "bytes"]);
        expect(Object.isFrozen(request)).toBe(true);
        expect(request.sourceKey).toBe("terminal-source");
        expect(request.expectedGeneration).toBeNull();
        expect(request.bytes).toEqual(expectedBytes);
        const parsed = JSON.parse(decoder.decode(request.bytes)) as unknown;
        const admitted = createDesenEditorDocument(parsed);
        expect(admitted.ok).toBe(true);
        if (!admitted.ok) throw new TypeError("Expected adapter bytes to re-admit as a Source.");
        expect(canonicalizeJsonBytes(admitted.document)).toEqual(request.bytes);
        stored = Object.freeze({
          sourceKey: request.sourceKey,
          generation: 1,
          value: admitted.document,
        });
        calls.push(`write:${request.sourceKey}:create:1`);
        return { status: "created", generation: 1 };
      },
    };
    const port = createDesenEditorPersistencePort(adapter);

    await expect(port.openSource("terminal-source")).resolves.toEqual({ status: "missing" });
    const save = await port.saveSource({
      sourceKey: "terminal-source",
      expectedGeneration: null,
      document: transcript.document,
    });
    expect(save).toEqual({ status: "created", generation: 1 });
    const open = await port.openSource("terminal-source");
    expect(open.status).toBe("opened");
    if (open.status !== "opened") throw new TypeError("Expected the terminal Source to reopen.");
    expect(open.generation).toBe(1);
    expect(open.document).toEqual(transcript.document);
    expect(open.document).not.toBe(transcript.document);
    expect(open.document.authoring).toEqual(transcript.document.authoring);
    expect(canonicalizeJsonBytes(open.document)).toEqual(expectedBytes);
    expect(createValidator().validate(open.document)).toEqual(
      createValidator().validate(transcript.document),
    );
    expect(calls).toEqual([
      "read:terminal-source:missing",
      "write:terminal-source:create:1",
      "read:terminal-source:found:1",
    ]);
    expectDeepFrozen(save);
    expectDeepFrozen(open);
    expectDeepFrozen(port);
  });
});
