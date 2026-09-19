import { canonicalizeJsonBytes } from "@desen/protocol";
import { describe, expect, it } from "vitest";

import validSource from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json";

import {
  captureDesenEditorClipboard,
  createDesenEditorDocument,
  createDesenEditorHistory,
  insertDesenEditorEventHandler,
  pasteDesenEditorClipboard,
  readDesenEditorNodePlacement,
  recordDesenEditorHistory,
  redoDesenEditorHistory,
  undoDesenEditorHistory,
} from "../src/index.js";

function document() {
  const result = createDesenEditorDocument(validSource);
  if (!result.ok) throw new TypeError("Expected a valid Source fixture.");
  return result.document;
}

describe("editor history and identity-safe clipboard", () => {
  it("keeps bounded immutable undo/redo snapshots and clears redo after a new edit", () => {
    const initial = document();
    const first = { ...initial, id: "com.example.first" };
    const second = { ...initial, id: "com.example.second" };
    const firstDocument = createDesenEditorDocument(first);
    const secondDocument = createDesenEditorDocument(second);
    if (!firstDocument.ok || !secondDocument.ok) throw new TypeError("Expected valid edits.");
    const initialHistory = createDesenEditorHistory(initial, 2);
    if (initialHistory === undefined) throw new TypeError("Expected a history.");
    const emptyUndo = undoDesenEditorHistory(initialHistory);
    expect(emptyUndo.ok).toBe(false);
    if (!emptyUndo.ok) {
      expect(emptyUndo.history).toBe(initialHistory);
      expect(Object.isFrozen(emptyUndo.diagnostics[0])).toBe(true);
      expect(Reflect.set(emptyUndo.diagnostics[0] as object, "code", "mutated")).toBe(false);
    }
    const committed = recordDesenEditorHistory(initialHistory, firstDocument.document);
    expect(committed.ok).toBe(true);
    if (!committed.ok) return;
    const undone = undoDesenEditorHistory(committed.history);
    expect(undone.ok).toBe(true);
    if (!undone.ok) return;
    expect(Object.isFrozen(undone.history.future[0])).toBe(true);
    expect(Reflect.set(undone.history.future[0] as object, "document", initial)).toBe(false);
    expect(canonicalizeJsonBytes(undone.history.document)).toEqual(canonicalizeJsonBytes(initial));
    const redone = redoDesenEditorHistory(undone.history);
    expect(redone.ok).toBe(true);
    if (!redone.ok) return;
    expect(Object.isFrozen(redone.history.past.at(-1))).toBe(true);
    expect(canonicalizeJsonBytes(redone.history.document)).toEqual(
      canonicalizeJsonBytes(firstDocument.document),
    );
    const branched = recordDesenEditorHistory(undone.history, secondDocument.document);
    expect(branched.ok).toBe(true);
    if (!branched.ok) return;
    expect(redoDesenEditorHistory(branched.history).ok).toBe(false);
  });

  it("snapshots mutable history inputs and rejects invalid records without changing authority", () => {
    const mutableInitial = JSON.parse(JSON.stringify(validSource));
    const created = createDesenEditorHistory(mutableInitial as never, 2);
    expect(created).toBeDefined();
    if (created === undefined) return;
    const initialBytes = canonicalizeJsonBytes(created.document);
    mutableInitial.id = "com.example.mutated-after-capture";
    expect(canonicalizeJsonBytes(created.document)).toEqual(initialBytes);
    expect(Object.isFrozen(created.document)).toBe(true);

    const mutableNext = JSON.parse(JSON.stringify(validSource));
    mutableNext.id = "com.example.next";
    const recorded = recordDesenEditorHistory(created, mutableNext as never);
    expect(recorded.ok).toBe(true);
    if (!recorded.ok) return;
    const recordedBytes = canonicalizeJsonBytes(recorded.history.document);
    mutableNext.id = "com.example.mutated-after-record";
    expect(canonicalizeJsonBytes(recorded.history.document)).toEqual(recordedBytes);
    expect(Object.isFrozen(recorded.history.document)).toBe(true);

    const invalid = recordDesenEditorHistory(recorded.history, { invalid: true } as never);
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.history).toBe(recorded.history);
      expect(invalid.diagnostics[0].code).toBe("run.desen.editor/HISTORY_DOCUMENT_INVALID");
    }
  });

  it("rejects forged mutable history authorities before any transition", () => {
    const mutable = JSON.parse(JSON.stringify(validSource));
    const forged = {
      document: mutable,
      future: [],
      limit: 1_000_000,
      past: [],
    } as never;
    const next = document();
    for (const result of [
      recordDesenEditorHistory(forged, next),
      undoDesenEditorHistory(forged),
      redoDesenEditorHistory(forged),
    ]) {
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.history).toBe(forged);
        expect(result.diagnostics[0].code).toBe("run.desen.editor/HISTORY_STATE_INVALID");
      }
    }
    mutable.id = "com.example.mutated-forged-history";
    expect(Object.isFrozen(mutable)).toBe(false);
  });

  it("duplicates a nested node with fresh identities and rejects a foreign payload", () => {
    const initial = document();
    const captured = captureDesenEditorClipboard(initial, "sign-in", ["sign-in.email"]);
    expect(captured.ok).toBe(true);
    if (!captured.ok) return;
    const pasted = pasteDesenEditorClipboard(initial, {
      payload: captured.payload,
      surfaceId: "sign-in",
      parentId: "sign-in.layout",
      slot: "default",
      index: 2,
    });
    expect(pasted.ok).toBe(true);
    if (!pasted.ok) return;
    expect(pasted.insertedNodeIds).toEqual(["sign-in.email.copy"]);
    const children = pasted.document.surfaces["sign-in"]?.root.slots?.default ?? [];
    expect(children.map(({ id }) => id)).toContain("sign-in.email.copy");
    expect(pasted.document.surfaces["sign-in"]?.state["email-copy"]).toEqual(
      pasted.document.surfaces["sign-in"]?.state.email,
    );
    expect(children.find(({ id }) => id === "sign-in.email.copy")?.props?.value).toEqual({
      $ref: "state.email-copy",
    });
    expect(children.find(({ id }) => id === "sign-in.email.copy")?.on?.change?.[0]).toMatchObject({
      path: "email-copy",
      type: "state.set",
    });
    expect(Object.isFrozen(captured.payload.state.email)).toBe(true);
    const crossSurface = pasteDesenEditorClipboard(initial, {
      payload: captured.payload,
      surfaceId: "home",
      parentId: "home.layout",
      slot: "default",
      index: 1,
    });
    expect(crossSurface.ok).toBe(true);
    if (!crossSurface.ok) return;
    expect(crossSurface.document.surfaces.home?.state["email-copy"]).toEqual(
      initial.surfaces["sign-in"]?.state.email,
    );
    expect(
      crossSurface.document.surfaces.home?.root.slots?.default?.find(
        ({ id }) => id === "sign-in.email.copy",
      )?.props?.value,
    ).toEqual({ $ref: "state.email-copy" });
    expect(
      pasteDesenEditorClipboard(initial, {
        payload: { ...captured.payload },
        surfaceId: "sign-in",
        parentId: "sign-in.layout",
        slot: "default",
        index: 0,
      }).ok,
    ).toBe(false);
    expect(canonicalizeJsonBytes(initial)).toEqual(canonicalizeJsonBytes(document()));
  });

  it("allocates all selected roots before remapping cross-root component references", () => {
    const initial = document();
    const forwardLinked = insertDesenEditorEventHandler(initial, {
      surfaceId: "sign-in",
      ownerId: "sign-in.title",
      event: "future",
      actions: [
        {
          type: "component.command",
          target: "sign-in.email",
          command: "focus",
        },
      ],
    });
    expect(forwardLinked.ok).toBe(true);
    if (!forwardLinked.ok) return;
    const linked = insertDesenEditorEventHandler(forwardLinked.document, {
      surfaceId: "sign-in",
      ownerId: "sign-in.email",
      event: "future",
      actions: [
        {
          type: "component.command",
          target: "sign-in.title",
          command: "future",
        },
      ],
    });
    expect(linked.ok).toBe(true);
    if (!linked.ok) return;
    const captured = captureDesenEditorClipboard(linked.document, "sign-in", [
      "sign-in.title",
      "sign-in.email",
    ]);
    expect(captured.ok).toBe(true);
    if (!captured.ok) return;
    const pasted = pasteDesenEditorClipboard(linked.document, {
      payload: captured.payload,
      surfaceId: "sign-in",
      parentId: "sign-in.layout",
      slot: "default",
      index: 5,
    });
    expect(pasted.ok).toBe(true);
    if (!pasted.ok) return;
    const children = pasted.document.surfaces["sign-in"]?.root.slots?.default ?? [];
    expect(children.find(({ id }) => id === "sign-in.title.copy")?.on?.future?.[0]).toMatchObject({
      type: "component.command",
      target: "sign-in.email.copy",
      command: "focus",
    });
    expect(children.find(({ id }) => id === "sign-in.email.copy")?.on?.future?.[0]).toMatchObject({
      type: "component.command",
      target: "sign-in.title.copy",
      command: "future",
    });
  });

  it("rejects component command targets outside the captured identity closure", () => {
    const initial = document();
    const linked = insertDesenEditorEventHandler(initial, {
      surfaceId: "sign-in",
      ownerId: "sign-in.title",
      event: "focusPeer",
      actions: [
        {
          type: "component.command",
          target: "sign-in.email",
          command: "focus",
        },
      ],
    });
    expect(linked.ok).toBe(true);
    if (!linked.ok) return;

    const captured = captureDesenEditorClipboard(linked.document, "sign-in", ["sign-in.title"]);
    expect(captured.ok).toBe(false);
    if (!captured.ok) {
      expect(captured.diagnostics[0].code).toBe("run.desen.editor/CLIPBOARD_REFERENCE_INVALID");
    }
    expect(canonicalizeJsonBytes(initial)).toEqual(canonicalizeJsonBytes(document()));
  });

  it("copies surface bindings and rewrites multi-root nested actions without touching extensions", () => {
    const raw = JSON.parse(JSON.stringify(validSource)) as unknown as {
      surfaces: Record<
        string,
        {
          state: Record<string, unknown>;
          resources: Record<
            string,
            {
              use: string;
              input: Record<string, unknown>;
              policy: "manual" | "mount" | "once";
              extensions?: Record<string, unknown>;
            }
          >;
          root: {
            slots?: Record<
              string,
              {
                id: string;
                props?: Record<string, unknown>;
                on?: Record<string, Record<string, unknown>[]>;
                extensions?: Record<string, unknown>;
              }[]
            >;
          };
        }
      >;
    };
    const surface = raw.surfaces["sign-in"];
    const title = surface?.root.slots?.default?.[0];
    const email = surface?.root.slots?.default?.[1];
    if (surface === undefined || title === undefined || email === undefined) {
      throw new TypeError("Expected the sign-in roots.");
    }
    surface.state.shared = {
      schema: { type: "object" },
      initial: { enabled: false, value: "original" },
    };
    surface.state.resourceOwner = {
      schema: { type: "string" },
      initial: "owner-1",
    };
    surface.resources.profile = {
      use: "com.example.data/profile",
      input: { owner: { $ref: "state.resourceOwner" } },
      policy: "manual",
      extensions: { "com.example.opaque": { ref: "state.shared" } },
    };
    title.props = {
      stateValue: { $ref: "state.shared.value" },
      resourceValue: {
        $format: {
          template: "{value}",
          values: { value: { $ref: "resource.profile.value.name" } },
        },
      },
      pending: { $ref: "operation.lookup.pending" },
    };
    title.extensions = {
      "com.example.opaque": {
        state: "state.shared",
        resource: "resource.profile.value",
        operation: "operation.lookup.pending",
        target: "sign-in.email",
      },
    };
    title.on = {
      activate: [
        {
          type: "operation.invoke",
          operation: "com.example.auth/lookup",
          as: "lookup",
          input: {
            state: { $ref: "state.shared" },
            resource: { $ref: "resource.profile.value" },
          },
          onSuccess: [
            {
              type: "state.set",
              path: "shared.value",
              value: { $ref: "operation.lookup.value.name" },
            },
            {
              type: "operation.invoke",
              operation: "com.example.audit/write",
              as: "audit",
              input: { prior: { $ref: "operation.lookup.status" } },
              onSuccess: [
                { type: "resource.refresh", resource: "profile" },
                {
                  type: "component.command",
                  target: "sign-in.email",
                  command: "focus",
                  input: { value: { $ref: "state.shared.value" } },
                },
              ],
              onFailure: [
                {
                  type: "state.toggle",
                  path: "shared.enabled",
                  when: {
                    op: "eq",
                    args: [{ $ref: "operation.audit.status" }, "failed"],
                  },
                },
              ],
            },
          ],
          onFailure: [{ type: "resource.refresh", resource: "profile" }],
        },
      ],
    };
    email.props = { label: "Email" };
    email.on = {
      focusPeer: [
        {
          type: "component.command",
          target: "sign-in.title",
          command: "focus",
          input: { loading: { $ref: "operation.audit.pending" } },
        },
      ],
    };
    const admitted = createDesenEditorDocument(raw);
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) return;
    const captured = captureDesenEditorClipboard(admitted.document, "sign-in", [
      "sign-in.title",
      "sign-in.email",
    ]);
    expect(captured.ok).toBe(true);
    if (!captured.ok) return;
    expect(Object.keys(captured.payload.state).sort()).toEqual(["resourceOwner", "shared"]);
    expect(Object.keys(captured.payload.resources)).toEqual(["profile"]);
    const pasted = pasteDesenEditorClipboard(admitted.document, {
      payload: captured.payload,
      surfaceId: "sign-in",
      parentId: "sign-in.layout",
      slot: "default",
      index: 5,
    });
    expect(pasted.ok).toBe(true);
    if (!pasted.ok) return;

    const pastedSurface = pasted.document.surfaces["sign-in"];
    expect(pastedSurface?.state["shared-copy"]).toEqual(surface.state.shared);
    expect(pastedSurface?.state["resourceOwner-copy"]).toEqual(surface.state.resourceOwner);
    expect(pastedSurface?.resources["profile-copy"]).toMatchObject({
      input: { owner: { $ref: "state.resourceOwner-copy" } },
      extensions: { "com.example.opaque": { ref: "state.shared" } },
    });
    const children = pastedSurface?.root.slots?.default ?? [];
    const copiedTitle = children.find(({ id }) => id === "sign-in.title.copy");
    const copiedEmail = children.find(({ id }) => id === "sign-in.email.copy");
    expect(copiedTitle?.props).toMatchObject({
      stateValue: { $ref: "state.shared-copy.value" },
      resourceValue: {
        $format: {
          values: { value: { $ref: "resource.profile-copy.value.name" } },
        },
      },
      pending: { $ref: "operation.lookup-copy.pending" },
    });
    expect(copiedTitle?.extensions).toEqual(title.extensions);
    const lookup = copiedTitle?.on?.activate?.[0];
    expect(lookup).toMatchObject({
      type: "operation.invoke",
      as: "lookup-copy",
      input: {
        state: { $ref: "state.shared-copy" },
        resource: { $ref: "resource.profile-copy.value" },
      },
    });
    if (lookup?.type !== "operation.invoke") throw new TypeError("Expected copied lookup action.");
    expect(lookup.onSuccess?.[0]).toMatchObject({
      type: "state.set",
      path: "shared-copy.value",
      value: { $ref: "operation.lookup-copy.value.name" },
    });
    const audit = lookup.onSuccess?.[1];
    expect(audit).toMatchObject({
      type: "operation.invoke",
      as: "audit-copy",
      input: { prior: { $ref: "operation.lookup-copy.status" } },
    });
    if (audit?.type !== "operation.invoke") throw new TypeError("Expected copied audit action.");
    expect(audit.onSuccess).toMatchObject([
      { type: "resource.refresh", resource: "profile-copy" },
      {
        type: "component.command",
        target: "sign-in.email.copy",
        input: { value: { $ref: "state.shared-copy.value" } },
      },
    ]);
    expect(audit.onFailure?.[0]).toMatchObject({
      type: "state.toggle",
      path: "shared-copy.enabled",
      when: { args: [{ $ref: "operation.audit-copy.status" }, "failed"] },
    });
    expect(copiedEmail?.on?.focusPeer?.[0]).toMatchObject({
      type: "component.command",
      target: "sign-in.title.copy",
      input: { loading: { $ref: "operation.audit-copy.pending" } },
    });
  });

  it("captures transitive resource-to-resource-to-state dependencies", () => {
    const raw = JSON.parse(JSON.stringify(validSource)) as unknown as {
      surfaces: Record<
        string,
        {
          state: Record<string, unknown>;
          resources: Record<string, unknown>;
          root: { slots?: Record<string, { id: string; props?: Record<string, unknown> }[]> };
        }
      >;
    };
    const surface = raw.surfaces["sign-in"];
    const title = surface?.root.slots?.default?.[0];
    if (surface === undefined || title === undefined) throw new TypeError("Expected title node.");
    surface.resources.profile = {
      use: "com.example.data/profile",
      input: { owner: { $ref: "state.email" } },
      policy: "manual",
    };
    surface.resources.account = {
      use: "com.example.data/account",
      input: { profile: { $ref: "resource.profile.value" } },
      policy: "manual",
    };
    title.props = { account: { $ref: "resource.account.value" } };
    const admitted = createDesenEditorDocument(raw);
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) return;
    const captured = captureDesenEditorClipboard(admitted.document, "sign-in", [title.id]);
    expect(captured.ok).toBe(true);
    if (!captured.ok) return;
    expect(Object.keys(captured.payload.resources).sort()).toEqual(["account", "profile"]);
    expect(Object.keys(captured.payload.state)).toEqual(["email"]);

    const pasted = pasteDesenEditorClipboard(admitted.document, {
      payload: captured.payload,
      surfaceId: "home",
      parentId: "home.layout",
      slot: "default",
      index: 1,
    });
    expect(pasted.ok).toBe(true);
    if (!pasted.ok) return;
    const home = pasted.document.surfaces.home;
    expect(home?.resources["account-copy"]?.input.profile).toEqual({
      $ref: "resource.profile-copy.value",
    });
    expect(home?.resources["profile-copy"]?.input.owner).toEqual({ $ref: "state.email-copy" });
    expect(
      home?.root.slots?.default?.find(({ id }) => id === "sign-in.title.copy")?.props?.account,
    ).toEqual({ $ref: "resource.account-copy.value" });
  });

  it("rewrites style, variant, repeat, and behavior ValueSpecs", () => {
    const raw = JSON.parse(JSON.stringify(validSource)) as unknown as {
      surfaces: Record<
        string,
        {
          root: {
            slots?: Record<
              string,
              {
                id: string;
                style?: Record<string, unknown>;
                repeat?: Record<string, unknown>;
                variants?: Record<string, unknown>[];
                behaviors?: Record<string, unknown>[];
              }[]
            >;
          };
        }
      >;
    };
    const title = raw.surfaces["sign-in"]?.root.slots?.default?.[0];
    if (title === undefined) throw new TypeError("Expected title node.");
    title.style = { base: { root: { color: { $ref: "state.email" } } } };
    title.repeat = {
      items: { $ref: "state.email" },
      as: "row",
      key: { $ref: "state.email" },
    };
    title.variants = [
      {
        when: { op: "truthy", args: [{ $ref: "state.email" }] },
        props: { text: { $ref: "state.email" } },
        style: { base: { root: { opacity: { $ref: "state.email" } } } },
      },
    ];
    title.behaviors = [
      {
        id: "sign-in.title.tooltip",
        use: "com.example.interactions/Tooltip",
        props: { label: { $ref: "state.email" } },
        style: { base: { root: { color: { $ref: "state.email" } } } },
        on: {
          dismiss: [{ type: "state.set", path: "email", value: "dismissed" }],
        },
      },
    ];
    const admitted = createDesenEditorDocument(raw);
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) return;
    const captured = captureDesenEditorClipboard(admitted.document, "sign-in", [title.id]);
    expect(captured.ok).toBe(true);
    if (!captured.ok) return;
    const pasted = pasteDesenEditorClipboard(admitted.document, {
      payload: captured.payload,
      surfaceId: "home",
      parentId: "home.layout",
      slot: "default",
      index: 1,
    });
    expect(pasted.ok).toBe(true);
    if (!pasted.ok) return;
    const copied = pasted.document.surfaces.home?.root.slots?.default?.find(
      ({ id }) => id === "sign-in.title.copy",
    );
    expect(copied?.style).toMatchObject({
      base: { root: { color: { $ref: "state.email-copy" } } },
    });
    expect(copied?.repeat).toMatchObject({
      items: { $ref: "state.email-copy" },
      key: { $ref: "state.email-copy" },
    });
    expect(copied?.variants?.[0]).toMatchObject({
      when: { args: [{ $ref: "state.email-copy" }] },
      props: { text: { $ref: "state.email-copy" } },
      style: { base: { root: { opacity: { $ref: "state.email-copy" } } } },
    });
    expect(copied?.behaviors?.[0]).toMatchObject({
      id: "sign-in.title.tooltip.copy",
      props: { label: { $ref: "state.email-copy" } },
      style: { base: { root: { color: { $ref: "state.email-copy" } } } },
      on: { dismiss: [{ type: "state.set", path: "email-copy" }] },
    });
  });

  it("rejects partial or conflicting operation alias remapping atomically", () => {
    const initial = document();
    const before = canonicalizeJsonBytes(initial);
    const partial = captureDesenEditorClipboard(initial, "sign-in", ["sign-in.error"]);
    expect(partial.ok).toBe(false);
    if (!partial.ok) {
      expect(partial.diagnostics[0].code).toBe("run.desen.editor/CLIPBOARD_REFERENCE_INVALID");
    }

    const raw = JSON.parse(JSON.stringify(validSource)) as unknown as {
      surfaces: Record<
        string,
        {
          root: {
            slots?: Record<
              string,
              { id: string; on?: Record<string, Record<string, unknown>[]> }[]
            >;
          };
        }
      >;
    };
    const children = raw.surfaces["sign-in"]?.root.slots?.default;
    const title = children?.[0];
    const email = children?.[1];
    if (title === undefined || email === undefined) throw new TypeError("Expected sibling nodes.");
    title.on = {
      run: [
        {
          type: "operation.invoke",
          operation: "com.example.first/run",
          as: "sharedAlias",
          input: {},
        },
      ],
    };
    email.on = {
      run: [
        {
          type: "operation.invoke",
          operation: "com.example.second/run",
          as: "sharedAlias",
          input: {},
        },
      ],
    };
    const admitted = createDesenEditorDocument(raw);
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) return;
    const ambiguous = captureDesenEditorClipboard(admitted.document, "sign-in", [
      "sign-in.title",
      "sign-in.email",
    ]);
    expect(ambiguous.ok).toBe(false);
    if (!ambiguous.ok) {
      expect(ambiguous.diagnostics[0].code).toBe("run.desen.editor/CLIPBOARD_REFERENCE_INVALID");
    }
    expect(canonicalizeJsonBytes(initial)).toEqual(before);
  });

  it("rejects unresolved state and resource dependencies before producing a payload", () => {
    const raw = JSON.parse(JSON.stringify(validSource)) as unknown as {
      surfaces: Record<
        string,
        {
          root: {
            slots?: Record<string, { id: string; props?: Record<string, unknown> }[]>;
          };
        }
      >;
    };
    const title = raw.surfaces["sign-in"]?.root.slots?.default?.[0];
    if (title === undefined) throw new TypeError("Expected the title node.");
    title.props = {
      missingState: { $ref: "state.missing" },
      missingResource: { $ref: "resource.missing.value" },
    };
    const admitted = createDesenEditorDocument(raw);
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) return;
    const captured = captureDesenEditorClipboard(admitted.document, "sign-in", [title.id]);
    expect(captured.ok).toBe(false);
    if (!captured.ok) {
      expect(captured.diagnostics[0].code).toBe("run.desen.editor/CLIPBOARD_REFERENCE_INVALID");
    }
  });

  it("remaps bindings inside predicate literal objects that only resemble nested predicates", () => {
    const raw = JSON.parse(JSON.stringify(validSource)) as unknown as {
      surfaces: Record<
        string,
        {
          root: {
            slots?: Record<string, { id: string; when?: Record<string, unknown> }[]>;
          };
        }
      >;
    };
    const title = raw.surfaces["sign-in"]?.root.slots?.default?.[0];
    if (title === undefined) throw new TypeError("Expected the title node.");
    title.when = {
      op: "truthy",
      args: [{ op: "eq", args: [1, 1], hidden: { $ref: "state.email" } }],
    };
    const admitted = createDesenEditorDocument(raw);
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) return;
    const captured = captureDesenEditorClipboard(admitted.document, "sign-in", [title.id]);
    expect(captured.ok).toBe(true);
    if (!captured.ok) return;
    expect(Object.keys(captured.payload.state)).toEqual(["email"]);
    const pasted = pasteDesenEditorClipboard(admitted.document, {
      payload: captured.payload,
      surfaceId: "home",
      parentId: "home.layout",
      slot: "default",
      index: 1,
    });
    expect(pasted.ok).toBe(true);
    if (!pasted.ok) return;
    expect(
      pasted.document.surfaces.home?.root.slots?.default?.find(
        ({ id }) => id === "sign-in.title.copy",
      )?.when,
    ).toMatchObject({
      args: [{ op: "eq", args: [1, 1], hidden: { $ref: "state.email-copy" } }],
    });
  });

  it("preserves opaque extension data while remapping schema-owned references", () => {
    const raw = JSON.parse(JSON.stringify(validSource)) as {
      surfaces: Record<
        string,
        {
          root: {
            slots?: Record<
              string,
              {
                id: string;
                extensions?: Record<string, unknown>;
              }[]
            >;
          };
        }
      >;
    };
    const title = raw.surfaces["sign-in"]?.root.slots?.default?.[0];
    if (title === undefined) throw new TypeError("Expected the title node.");
    title.extensions = {
      "com.example.opaque": {
        nodeId: "sign-in.email",
        target: "sign-in.email",
        note: "node.sign-in.email",
        ordinary: "sign-in.email",
      },
    };
    const admitted = createDesenEditorDocument(raw);
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) return;
    const captured = captureDesenEditorClipboard(admitted.document, "sign-in", [
      "sign-in.title",
      "sign-in.email",
    ]);
    expect(captured.ok).toBe(true);
    if (!captured.ok) return;
    const pasted = pasteDesenEditorClipboard(admitted.document, {
      payload: captured.payload,
      surfaceId: "sign-in",
      parentId: "sign-in.layout",
      slot: "default",
      index: 5,
    });
    expect(pasted.ok).toBe(true);
    if (!pasted.ok) return;
    const copiedTitle = pasted.document.surfaces["sign-in"]?.root.slots?.default?.find(
      ({ id }) => id === "sign-in.title.copy",
    );
    expect(copiedTitle?.extensions).toEqual(title.extensions);
  });

  it("allocates bounded deterministic copy identities for maximum-length IDs and collisions", () => {
    const raw = JSON.parse(JSON.stringify(validSource)) as {
      surfaces: Record<
        string,
        {
          root: {
            slots?: Record<string, { id: string }[]>;
          };
        }
      >;
    };
    const children = raw.surfaces["sign-in"]?.root.slots?.default;
    const title = children?.[0];
    const email = children?.[1];
    if (title === undefined || email === undefined) throw new TypeError("Expected sibling nodes.");
    const maximumId = "a".repeat(128);
    const firstCopyId = `${"a".repeat(123)}.copy`;
    title.id = maximumId;
    email.id = firstCopyId;
    const admitted = createDesenEditorDocument(raw);
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) return;
    const captured = captureDesenEditorClipboard(admitted.document, "sign-in", [maximumId]);
    expect(captured.ok).toBe(true);
    if (!captured.ok) return;
    const pasted = pasteDesenEditorClipboard(admitted.document, {
      payload: captured.payload,
      surfaceId: "sign-in",
      parentId: "sign-in.layout",
      slot: "default",
      index: 5,
    });
    expect(pasted.ok).toBe(true);
    if (!pasted.ok) return;
    expect(pasted.insertedNodeIds).toEqual([`${"a".repeat(121)}.copy.2`]);
  });

  it("keeps remapped state action paths inside the protocol length boundary", () => {
    const raw = JSON.parse(JSON.stringify(validSource)) as unknown as {
      surfaces: Record<
        string,
        {
          state: Record<string, unknown>;
          root: {
            slots?: Record<
              string,
              { id: string; on?: Record<string, Record<string, unknown>[]> }[]
            >;
          };
        }
      >;
    };
    const surface = raw.surfaces["sign-in"];
    const title = surface?.root.slots?.default?.[0];
    if (surface === undefined || title === undefined) throw new TypeError("Expected title node.");
    const nestedName = "x".repeat(126);
    surface.state.s = {
      schema: { type: "object" },
      initial: { [nestedName]: false },
    };
    title.on = {
      toggle: [{ type: "state.toggle", path: `s.${nestedName}` }],
    };
    const admitted = createDesenEditorDocument(raw);
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) return;
    const captured = captureDesenEditorClipboard(admitted.document, "sign-in", [title.id]);
    expect(captured.ok).toBe(true);
    if (!captured.ok) return;
    const pasted = pasteDesenEditorClipboard(admitted.document, {
      payload: captured.payload,
      surfaceId: "home",
      parentId: "home.layout",
      slot: "default",
      index: 1,
    });
    expect(pasted.ok).toBe(true);
    if (!pasted.ok) return;
    const copiedTitle = pasted.document.surfaces.home?.root.slots?.default?.find(
      ({ id }) => id === "sign-in.title.copy",
    );
    const copiedPath = copiedTitle?.on?.toggle?.[0];
    expect(copiedPath).toMatchObject({ type: "state.toggle" });
    if (copiedPath?.type !== "state.toggle") return;
    expect(copiedPath.path).toHaveLength(128);
    const copiedStateRoot = copiedPath.path.split(".")[0];
    expect(copiedStateRoot).not.toBe("s");
    expect(pasted.document.surfaces.home?.state[copiedStateRoot ?? ""]).toEqual(surface.state.s);
  });

  it("rejects exhausted single-character state identity space without inventing an invalid root", () => {
    const raw = JSON.parse(JSON.stringify(validSource)) as unknown as {
      surfaces: Record<
        string,
        {
          state: Record<string, unknown>;
          root: {
            slots?: Record<
              string,
              { id: string; on?: Record<string, Record<string, unknown>[]> }[]
            >;
          };
        }
      >;
    };
    const source = raw.surfaces["sign-in"];
    const target = raw.surfaces.home;
    const title = source?.root.slots?.default?.[0];
    if (source === undefined || target === undefined || title === undefined) {
      throw new TypeError("Expected source and target surfaces.");
    }
    const nestedName = "x".repeat(126);
    source.state.s = { schema: { type: "object" }, initial: { [nestedName]: false } };
    title.on = { toggle: [{ type: "state.toggle", path: `s.${nestedName}` }] };
    for (const stateName of "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ") {
      target.state[stateName] = { schema: { type: "boolean" }, initial: false };
    }
    const admitted = createDesenEditorDocument(raw);
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) return;
    const captured = captureDesenEditorClipboard(admitted.document, "sign-in", [title.id]);
    expect(captured.ok).toBe(true);
    if (!captured.ok) return;
    const before = canonicalizeJsonBytes(admitted.document);
    const pasted = pasteDesenEditorClipboard(admitted.document, {
      payload: captured.payload,
      surfaceId: "home",
      parentId: "home.layout",
      slot: "default",
      index: 1,
    });
    expect(pasted.ok).toBe(false);
    if (!pasted.ok) {
      expect(pasted.diagnostics[0].code).toBe("run.desen.editor/CLIPBOARD_REFERENCE_INVALID");
    }
    expect(canonicalizeJsonBytes(admitted.document)).toEqual(before);
  });

  it("never reuses maximum-length source identities that already end in a copy suffix", () => {
    const raw = JSON.parse(JSON.stringify(validSource)) as unknown as {
      surfaces: Record<
        string,
        {
          state: Record<string, unknown>;
          root: {
            slots?: Record<
              string,
              {
                id: string;
                props?: Record<string, unknown>;
                on?: Record<string, Record<string, unknown>[]>;
              }[]
            >;
          };
        }
      >;
    };
    const surface = raw.surfaces["sign-in"];
    const email = surface?.root.slots?.default?.[1];
    const emailState = surface?.state.email;
    if (surface === undefined || email === undefined || emailState === undefined) {
      throw new TypeError("Expected the email node and state.");
    }
    const maximumNodeId = `${"a".repeat(123)}.copy`;
    const maximumStateName = `${"s".repeat(123)}-copy`;
    email.id = maximumNodeId;
    email.props = { ...email.props, value: { $ref: `state.${maximumStateName}` } };
    const change = email.on?.change?.[0];
    if (change === undefined) throw new TypeError("Expected the email change action.");
    change.path = maximumStateName;
    surface.state[maximumStateName] = emailState;
    delete surface.state.email;

    const admitted = createDesenEditorDocument(raw);
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) return;
    const captured = captureDesenEditorClipboard(admitted.document, "sign-in", [maximumNodeId]);
    expect(captured.ok).toBe(true);
    if (!captured.ok) return;
    const pasted = pasteDesenEditorClipboard(admitted.document, {
      payload: captured.payload,
      surfaceId: "home",
      parentId: "home.layout",
      slot: "default",
      index: 1,
    });
    expect(pasted.ok).toBe(true);
    if (!pasted.ok) return;
    const expectedNodeId = `${"a".repeat(121)}.copy.2`;
    const expectedStateName = `${"s".repeat(121)}-copy-2`;
    expect(pasted.insertedNodeIds).toEqual([expectedNodeId]);
    expect(pasted.insertedNodeIds[0]).not.toBe(maximumNodeId);
    expect(pasted.document.surfaces.home?.state[expectedStateName]).toEqual(emailState);
    expect(
      pasted.document.surfaces.home?.root.slots?.default?.find(({ id }) => id === expectedNodeId)
        ?.props?.value,
    ).toEqual({ $ref: `state.${expectedStateName}` });
  });

  it("rejects structurally admitted documents with ambiguous identities", () => {
    const raw = JSON.parse(JSON.stringify(validSource)) as {
      surfaces: Record<
        string,
        {
          root: {
            slots?: Record<string, { id: string }[]>;
          };
        }
      >;
    };
    const children = raw.surfaces["sign-in"]?.root.slots?.default;
    const title = children?.[0];
    const email = children?.[1];
    if (title === undefined || email === undefined) throw new TypeError("Expected sibling nodes.");
    email.id = title.id;
    const admitted = createDesenEditorDocument(raw);
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) return;
    const before = canonicalizeJsonBytes(admitted.document);
    const captured = captureDesenEditorClipboard(admitted.document, "sign-in", [title.id]);
    expect(captured.ok).toBe(false);
    if (!captured.ok) {
      expect(captured.diagnostics[0].code).toBe("run.desen.editor/CLIPBOARD_IDENTITY_INVALID");
    }
    expect(canonicalizeJsonBytes(admitted.document)).toEqual(before);
  });

  it("fails closed on hostile selection and paste-command wrappers", () => {
    const initial = document();
    const before = canonicalizeJsonBytes(initial);
    const hostileSelection = new Proxy([] as string[], {
      getPrototypeOf() {
        throw new TypeError("hostile selection");
      },
    });
    expect(() => captureDesenEditorClipboard(initial, "sign-in", hostileSelection)).not.toThrow();
    const selectionResult = captureDesenEditorClipboard(initial, "sign-in", hostileSelection);
    expect(selectionResult.ok).toBe(false);
    if (!selectionResult.ok) {
      expect(selectionResult.diagnostics[0].code).toBe("run.desen.editor/CLIPBOARD_INVALID");
    }

    const accessorSelection = ["sign-in.title"];
    Object.defineProperty(accessorSelection, "0", {
      enumerable: true,
      get() {
        throw new TypeError("hostile selection accessor");
      },
    });
    expect(() => captureDesenEditorClipboard(initial, "sign-in", accessorSelection)).not.toThrow();
    expect(captureDesenEditorClipboard(initial, "sign-in", accessorSelection).ok).toBe(false);

    const captured = captureDesenEditorClipboard(initial, "sign-in", ["sign-in.title"]);
    expect(captured.ok).toBe(true);
    if (!captured.ok) return;
    const hostileDocument = new Proxy(initial, {
      ownKeys() {
        throw new TypeError("hostile document");
      },
    });
    expect(() =>
      captureDesenEditorClipboard(hostileDocument, "sign-in", ["sign-in.title"]),
    ).not.toThrow();
    expect(captureDesenEditorClipboard(hostileDocument, "sign-in", ["sign-in.title"]).ok).toBe(
      false,
    );
    const hostileDocumentPaste = () =>
      pasteDesenEditorClipboard(hostileDocument, {
        payload: captured.payload,
        surfaceId: "sign-in",
        parentId: "sign-in.layout",
        slot: "default",
        index: 1,
      });
    expect(hostileDocumentPaste).not.toThrow();
    expect(hostileDocumentPaste().ok).toBe(false);
    expect(() =>
      readDesenEditorNodePlacement(hostileDocument, "sign-in", "sign-in.title"),
    ).not.toThrow();
    expect(readDesenEditorNodePlacement(hostileDocument, "sign-in", "sign-in.title")).toBeNull();
    expect(() =>
      captureDesenEditorClipboard(initial, "constructor", ["sign-in.title"]),
    ).not.toThrow();
    expect(captureDesenEditorClipboard(initial, "constructor", ["sign-in.title"]).ok).toBe(false);
    const inheritedSurfaceCommand = {
      payload: captured.payload,
      surfaceId: "constructor",
      parentId: "sign-in.layout",
      slot: "default",
      index: 1,
    };
    expect(() => pasteDesenEditorClipboard(initial, inheritedSurfaceCommand)).not.toThrow();
    const inheritedSurface = pasteDesenEditorClipboard(initial, inheritedSurfaceCommand);
    expect(inheritedSurface.ok).toBe(false);
    if (!inheritedSurface.ok) {
      expect(inheritedSurface.diagnostics[0].code).toBe(
        "run.desen.editor/CLIPBOARD_TARGET_INVALID",
      );
    }
    const hostileCommand = new Proxy(
      {
        payload: captured.payload,
        surfaceId: "sign-in",
        parentId: "sign-in.layout",
        slot: "default",
        index: 1,
      },
      {
        ownKeys() {
          throw new TypeError("hostile command");
        },
      },
    );
    expect(() => pasteDesenEditorClipboard(initial, hostileCommand)).not.toThrow();
    const pasteResult = pasteDesenEditorClipboard(initial, hostileCommand);
    expect(pasteResult.ok).toBe(false);
    if (!pasteResult.ok) {
      expect(pasteResult.diagnostics[0].code).toBe("run.desen.editor/CLIPBOARD_INVALID");
    }
    const accessorCommand = {
      surfaceId: "sign-in",
      parentId: "sign-in.layout",
      slot: "default",
      index: 1,
    } as Record<string, unknown>;
    Object.defineProperty(accessorCommand, "payload", {
      enumerable: true,
      get() {
        throw new TypeError("hostile command accessor");
      },
    });
    expect(() => pasteDesenEditorClipboard(initial, accessorCommand as never)).not.toThrow();
    expect(pasteDesenEditorClipboard(initial, accessorCommand as never).ok).toBe(false);
    expect(canonicalizeJsonBytes(initial)).toEqual(before);
  });
});
