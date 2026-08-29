import referenceCatalog from "@desen/reference-catalog-web/catalog.json";
import { createDesenEditorDocument } from "@desen/editor-core";
import { canonicalizeJson } from "@desen/protocol";
import { describe, expect, it } from "vitest";

import officialSignInSource from "../../../examples/sign-in/official-derived.source.desen.json";
import { REFERENCE_AUTHORING_MODEL, prepareCatalogAuthoringModel } from "../src/authoring-data.js";
import {
  applyAuthoringEventActionEdit,
  createAuthoringEventOwnerSelection,
  isSameAuthoringEventOwnerSelection,
  prepareAuthoringEventActionModel,
} from "../src/authoring-event-actions.js";

import type { DesenEditorDocument } from "@desen/editor-core";
import type { CatalogAuthoringModel } from "../src/authoring-data.js";
import type {
  AuthoringClosedAction,
  AuthoringEventActionEdit,
  AuthoringEventActionEditResult,
  AuthoringEventActionModelResult,
  AuthoringEventActionReadyModel,
  AuthoringEventActionRoute,
  AuthoringEventOwnerSelection,
} from "../src/authoring-event-actions.js";

type MutableJsonObject = Record<string, unknown>;

const SIGN_IN_ROUTE = Object.freeze({
  projectId: "account-app",
  surfaceId: "sign-in",
}) satisfies AuthoringEventActionRoute;

const HOME_ROUTE = Object.freeze({
  projectId: "account-app",
  surfaceId: "home",
}) satisfies AuthoringEventActionRoute;

function copyJson<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value;
}

function record(value: unknown, path: string): MutableJsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${path} must be an object.`);
  }
  return value as MutableJsonObject;
}

function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new TypeError(`${path} must be an array.`);
  return value;
}

function mutableSurface(source: MutableJsonObject, surfaceId: "home" | "sign-in") {
  return record(record(source.surfaces, "source.surfaces")[surfaceId], surfaceId);
}

function mutableNode(source: MutableJsonObject, nodeId: string): MutableJsonObject {
  const root = record(mutableSurface(source, "sign-in").root, "sign-in.root");
  const pending = [root];
  while (pending.length > 0) {
    const node = pending.pop();
    if (node === undefined) continue;
    if (node.id === nodeId) return node;
    const slotsValue = node.slots;
    if (slotsValue !== undefined) {
      for (const children of Object.values(record(slotsValue, `${String(node.id)}.slots`))) {
        for (const child of array(children, "slot children")) {
          pending.push(record(child, "slot child"));
        }
      }
    }
    if (node.behaviors !== undefined) {
      for (const behavior of array(node.behaviors, "node.behaviors")) {
        const behaviorObject = record(behavior, "behavior");
        if (behaviorObject.slots === undefined) continue;
        for (const children of Object.values(record(behaviorObject.slots, "behavior.slots"))) {
          for (const child of array(children, "behavior slot children")) {
            pending.push(record(child, "behavior slot child"));
          }
        }
      }
    }
  }
  throw new Error(`Missing node ${nodeId}.`);
}

function requireDocument(source: unknown = officialSignInSource): DesenEditorDocument {
  const result = createDesenEditorDocument(copyJson(source));
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("Expected an Editor Core document fixture.");
  return result.document;
}

function requireModel(
  source: unknown = officialSignInSource,
  catalog: unknown = referenceCatalog,
): CatalogAuthoringModel {
  const result = prepareCatalogAuthoringModel(catalog, source);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(`Expected an authoring model, received ${result.reason}.`);
  return result.model;
}

function requireReady(result: AuthoringEventActionModelResult): AuthoringEventActionReadyModel {
  expect(result.status).toBe("ready");
  if (result.status !== "ready") throw new Error(`Expected ready, received ${result.status}.`);
  return result;
}

function requireSuccess(result: AuthoringEventActionEditResult): DesenEditorDocument {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(`Expected success, received ${result.reason}.`);
  return result.document;
}

function emailSelection(): AuthoringEventOwnerSelection {
  return createAuthoringEventOwnerSelection({
    projectId: SIGN_IN_ROUTE.projectId,
    surfaceId: SIGN_IN_ROUTE.surfaceId,
    ownerKind: "component",
    ownerId: "sign-in.email",
    capabilityId: "com.example.ui/TextField",
    displayName: "Text field",
    conditional: false,
  });
}

function submitSelection(): AuthoringEventOwnerSelection {
  return createAuthoringEventOwnerSelection({
    projectId: SIGN_IN_ROUTE.projectId,
    surfaceId: SIGN_IN_ROUTE.surfaceId,
    ownerKind: "component",
    ownerId: "sign-in.submit",
    capabilityId: "com.example.ui/Button",
    displayName: "Button",
    conditional: false,
  });
}

function forgedBehaviorSelection(): AuthoringEventOwnerSelection {
  return {
    ...emailSelection(),
    ownerKind: "behavior",
  } as unknown as AuthoringEventOwnerSelection;
}

function apply(
  document: DesenEditorDocument,
  selection: AuthoringEventOwnerSelection,
  edit: AuthoringEventActionEdit,
): AuthoringEventActionEditResult {
  return applyAuthoringEventActionEdit(document, referenceCatalog, SIGN_IN_ROUTE, selection, edit);
}

function fakeModel(
  source: MutableJsonObject,
  catalog: unknown = referenceCatalog,
): CatalogAuthoringModel {
  return {
    ...REFERENCE_AUTHORING_MODEL,
    validationCatalogs: [catalog],
    validationDocument: source as unknown as DesenEditorDocument,
  };
}

function emailActions(document: DesenEditorDocument): readonly unknown[] {
  const root = document.surfaces["sign-in"]?.root;
  const email = root?.slots?.default?.find(({ id }) => id === "sign-in.email");
  return email?.on?.change ?? [];
}

describe("Desen App event and closed-action authoring", () => {
  it("creates exact component owner references and rejects forged behavior values", () => {
    const selection = emailSelection();
    expect(Object.isFrozen(selection)).toBe(true);
    expect(selection.ownerKind).toBe("component");
    expect(isSameAuthoringEventOwnerSelection(selection, emailSelection())).toBe(true);
    expect(isSameAuthoringEventOwnerSelection(null, selection)).toBe(false);
    expect(isSameAuthoringEventOwnerSelection(selection, forgedBehaviorSelection())).toBe(false);
    expect(() =>
      createAuthoringEventOwnerSelection({
        projectId: SIGN_IN_ROUTE.projectId,
        surfaceId: SIGN_IN_ROUTE.surfaceId,
        ownerKind: "behavior",
        ownerId: "sign-in.email",
        capabilityId: "com.example.ui/TextField",
        displayName: "Text field",
        conditional: false,
      } as unknown as Omit<AuthoringEventOwnerSelection, "kind">),
    ).toThrow(TypeError);

    let calls = 0;
    const input = Object.defineProperty(
      {
        surfaceId: "sign-in",
        ownerKind: "component",
        ownerId: "sign-in.email",
        capabilityId: "com.example.ui/TextField",
        displayName: "Text field",
        conditional: false,
      },
      "projectId",
      {
        enumerable: true,
        get() {
          calls += 1;
          return "account-app";
        },
      },
    );
    expect(() =>
      createAuthoringEventOwnerSelection(input as Omit<AuthoringEventOwnerSelection, "kind">),
    ).toThrow(TypeError);
    expect(calls).toBe(0);
    expect(() =>
      createAuthoringEventOwnerSelection({
        ...selection,
        extra: true,
      } as Omit<AuthoringEventOwnerSelection, "kind">),
    ).toThrow(TypeError);
  });

  it("projects sign-in change and press with canonical nested settlement pointers", () => {
    const email = requireReady(
      prepareAuthoringEventActionModel(REFERENCE_AUTHORING_MODEL, SIGN_IN_ROUTE, emailSelection()),
    );
    expect(email.owner.ownerId).toBe("sign-in.email");
    expect(email.events).toHaveLength(1);
    expect(email.events[0]).toMatchObject({
      event: "change",
      actionList: { pointer: "/on/change", present: true },
    });
    expect(email.events[0]?.actionList.actions[0]).toMatchObject({
      pointer: "/on/change/0",
      index: 0,
      depth: 0,
      action: { type: "state.set", path: "email" },
      onSuccess: null,
      onFailure: null,
    });
    expect(email.referenceOptions.states.map(({ value }) => value)).toEqual(["email", "password"]);
    expect(email.referenceOptions.surfaces.map(({ value }) => value)).toEqual(["home", "sign-in"]);
    expect(email.referenceOptions.operations.map(({ value }) => value)).toEqual([
      "com.example.auth/signIn",
    ]);
    expect(
      email.referenceOptions.componentCommands.map(({ targetId, command }) => [targetId, command]),
    ).toEqual([
      ["sign-in.email", "focus"],
      ["sign-in.password", "focus"],
    ]);

    const submit = requireReady(
      prepareAuthoringEventActionModel(REFERENCE_AUTHORING_MODEL, SIGN_IN_ROUTE, submitSelection()),
    );
    const invoke = submit.events[0]?.actionList.actions[0];
    expect(invoke).toMatchObject({
      pointer: "/on/press/0",
      action: { type: "operation.invoke", operation: "com.example.auth/signIn" },
      onSuccess: { pointer: "/on/press/0/onSuccess", present: true },
      onFailure: { pointer: "/on/press/0/onFailure", present: false, actions: [] },
    });
    expect(invoke?.onSuccess?.actions[0]).toMatchObject({
      pointer: "/on/press/0/onSuccess/0",
      depth: 1,
      action: { type: "navigate", surface: "home" },
    });
    expect(Object.isFrozen(submit.events)).toBe(true);
    expect(Object.isFrozen(invoke?.onSuccess)).toBe(true);
  });

  it("retains declared absent, present-empty, and present-nonempty handler states", () => {
    const absentSource = copyJson(officialSignInSource) as unknown as MutableJsonObject;
    delete mutableNode(absentSource, "sign-in.email").on;
    const absent = requireReady(
      prepareAuthoringEventActionModel(requireModel(absentSource), SIGN_IN_ROUTE, emailSelection()),
    );
    expect(absent.events[0]?.actionList).toMatchObject({ present: false, actions: [] });

    const emptySource = copyJson(officialSignInSource) as unknown as MutableJsonObject;
    record(mutableNode(emptySource, "sign-in.email").on, "email.on").change = [];
    const empty = requireReady(
      prepareAuthoringEventActionModel(requireModel(emptySource), SIGN_IN_ROUTE, emailSelection()),
    );
    expect(empty.events[0]?.actionList).toMatchObject({ present: true, actions: [] });

    const nonempty = requireReady(
      prepareAuthoringEventActionModel(REFERENCE_AUTHORING_MODEL, SIGN_IN_ROUTE, emailSelection()),
    );
    expect(nonempty.events[0]?.actionList).toMatchObject({ present: true });
    expect(nonempty.events[0]?.actionList.actions).toHaveLength(1);
  });

  it("escapes every owner-relative event token canonically", () => {
    const source = copyJson(officialSignInSource) as unknown as MutableJsonObject;
    const email = mutableNode(source, "sign-in.email");
    email.on = { "change/~done": record(email.on, "email.on").change };

    const catalog = copyJson(referenceCatalog) as unknown as MutableJsonObject;
    const components = record(catalog.components, "catalog.components");
    const textField = record(components["com.example.ui/TextField"], "TextField");
    const events = record(textField.events, "TextField.events");
    textField.events = { "change/~done": events.change };

    const result = requireReady(
      prepareAuthoringEventActionModel(fakeModel(source, catalog), SIGN_IN_ROUTE, emailSelection()),
    );
    expect(result.events[0]?.actionList.pointer).toBe("/on/change~1~0done");
    expect(result.events[0]?.actionList.actions[0]?.pointer).toBe("/on/change~1~0done/0");
  });

  it("maps all six App edits one-to-one to immutable Editor Core transitions", () => {
    const original = requireDocument();
    const selection = emailSelection();
    const deletedHandler = apply(original, selection, { kind: "delete-handler", event: "change" });
    expect(deletedHandler).toMatchObject({ ok: true, operation: "delete-handler" });
    let current = requireSuccess(deletedHandler);
    expect(emailActions(current)).toEqual([]);

    const insertedHandler = apply(current, selection, {
      kind: "insert-handler",
      event: "change",
      actions: [],
    });
    expect(insertedHandler).toMatchObject({ ok: true, operation: "insert-handler" });
    current = requireSuccess(insertedHandler);

    const insertedAction = apply(current, selection, {
      kind: "insert-action",
      actionListPointer: "/on/change",
      index: 0,
      action: { type: "state.set", path: "email", value: "first" },
    });
    expect(insertedAction).toMatchObject({ ok: true, operation: "insert-action" });
    current = requireSuccess(insertedAction);

    const replacedAction = apply(current, selection, {
      kind: "replace-action",
      actionPointer: "/on/change/0",
      action: { type: "state.set", path: "email", value: "replaced" },
    });
    expect(replacedAction).toMatchObject({ ok: true, operation: "replace-action" });
    current = requireSuccess(replacedAction);

    current = requireSuccess(
      apply(current, selection, {
        kind: "insert-action",
        actionListPointer: "/on/change",
        index: 1,
        action: { type: "state.set", path: "email", value: "second" },
      }),
    );
    const reorderedAction = apply(current, selection, {
      kind: "reorder-action",
      actionPointer: "/on/change/0",
      index: 1,
    });
    expect(reorderedAction).toMatchObject({ ok: true, operation: "reorder-action" });
    current = requireSuccess(reorderedAction);
    expect(emailActions(current)).toMatchObject([
      { type: "state.set", value: "second" },
      { type: "state.set", value: "replaced" },
    ]);

    const deletedAction = apply(current, selection, {
      kind: "delete-action",
      actionPointer: "/on/change/0",
    });
    expect(deletedAction).toMatchObject({ ok: true, operation: "delete-action" });
    expect(emailActions(requireSuccess(deletedAction))).toMatchObject([
      { type: "state.set", value: "replaced" },
    ]);
    expect(emailActions(original)).toMatchObject([{ value: { $ref: "event.value" } }]);
  });

  it("returns the frozen rejected-candidate report without exposing the candidate", () => {
    const original = requireDocument();
    const before = canonicalizeJson(original);
    const rejected = apply(original, emailSelection(), {
      kind: "replace-action",
      actionPointer: "/on/change/0",
      action: { type: "state.set", path: "missing", value: "next" },
    });

    expect(rejected).toMatchObject({
      ok: false,
      reason: "source-invalid",
      validationReport: {
        valid: false,
        invalidSubjects: [
          expect.objectContaining({
            surfaceId: "sign-in",
            subject: { kind: "node", id: "sign-in.email" },
          }),
        ],
      },
    });
    if (rejected.ok || rejected.validationReport === undefined) {
      throw new Error("Expected rejected-candidate event diagnostics.");
    }
    expect(Object.isFrozen(rejected)).toBe(true);
    expect(Object.isFrozen(rejected.validationReport)).toBe(true);
    expect(Object.hasOwn(rejected, "document")).toBe(false);
    expect(canonicalizeJson(original)).toBe(before);
  });

  it("uses post-removal final reorder indices without an App-side adjustment", () => {
    const original = requireDocument();
    const selection = emailSelection();
    let current = requireSuccess(
      apply(original, selection, { kind: "delete-handler", event: "change" }),
    );
    current = requireSuccess(
      apply(current, selection, {
        kind: "insert-handler",
        event: "change",
        actions: [
          { type: "state.set", path: "email", value: "A" },
          { type: "state.set", path: "email", value: "B" },
          { type: "state.set", path: "email", value: "C" },
        ],
      }),
    );
    current = requireSuccess(
      apply(current, selection, {
        kind: "reorder-action",
        actionPointer: "/on/change/0",
        index: 2,
      }),
    );
    expect(emailActions(current)).toMatchObject([{ value: "B" }, { value: "C" }, { value: "A" }]);
  });

  it("materializes and retains operation success/failure settlement lists", () => {
    const original = requireDocument();
    const selection = submitSelection();
    const inserted = requireSuccess(
      apply(original, selection, {
        kind: "insert-action",
        actionListPointer: "/on/press/0/onFailure",
        index: 0,
        action: { type: "state.set", path: "email", value: "" },
      }),
    );
    const submit = inserted.surfaces["sign-in"]?.root.slots?.default?.find(
      ({ id }) => id === "sign-in.submit",
    );
    const invoke = submit?.on?.press?.[0];
    expect(invoke).toMatchObject({
      type: "operation.invoke",
      onSuccess: [{ type: "navigate", surface: "home" }],
      onFailure: [{ type: "state.set", path: "email", value: "" }],
    });

    const emptied = requireSuccess(
      apply(inserted, selection, {
        kind: "delete-action",
        actionPointer: "/on/press/0/onFailure/0",
      }),
    );
    const projected = requireReady(
      prepareAuthoringEventActionModel(requireModel(emptied), SIGN_IN_ROUTE, selection),
    );
    expect(projected.events[0]?.actionList.actions[0]?.onFailure).toMatchObject({
      present: true,
      actions: [],
    });
  });

  it("projects every member of the seven-action union including nested settlements", () => {
    const source = copyJson(officialSignInSource) as unknown as MutableJsonObject;
    const actions: readonly AuthoringClosedAction[] = [
      { type: "state.set", path: "email", value: "" },
      { type: "state.toggle", path: "flag" },
      { type: "navigate", surface: "home" },
      {
        type: "operation.invoke",
        operation: "com.example.auth/signIn",
        as: "signIn",
        input: {},
        onSuccess: [{ type: "event.emit", name: "signed.in" }],
        onFailure: [],
      },
      { type: "resource.refresh", resource: "profile" },
      { type: "component.command", target: "sign-in.email", command: "focus" },
      { type: "event.emit", name: "edited" },
    ];
    record(mutableNode(source, "sign-in.email").on, "email.on").change = actions;

    const ready = requireReady(
      prepareAuthoringEventActionModel(fakeModel(source), SIGN_IN_ROUTE, emailSelection()),
    );
    expect(ready.events[0]?.actionList.actions.map(({ action }) => action.type)).toEqual([
      "state.set",
      "state.toggle",
      "navigate",
      "operation.invoke",
      "resource.refresh",
      "component.command",
      "event.emit",
    ]);
    expect(ready.events[0]?.actionList.actions[3]?.onSuccess?.actions[0]).toMatchObject({
      pointer: "/on/change/3/onSuccess/0",
      action: { type: "event.emit", name: "signed.in" },
    });
    expect(ready.events[0]?.actionList.actions[3]?.onFailure).toMatchObject({
      present: true,
      actions: [],
    });
  });

  it("fails closed for idle, stale, cross-route, forged behavior, and ambiguous selections", () => {
    expect(
      prepareAuthoringEventActionModel(REFERENCE_AUTHORING_MODEL, SIGN_IN_ROUTE, null),
    ).toEqual({ status: "idle" });
    expect(
      prepareAuthoringEventActionModel(REFERENCE_AUTHORING_MODEL, HOME_ROUTE, emailSelection()),
    ).toEqual({ status: "rejected", reason: "selection-invalid" });
    expect(
      prepareAuthoringEventActionModel(REFERENCE_AUTHORING_MODEL, SIGN_IN_ROUTE, {
        ...emailSelection(),
        ownerId: "missing",
      }),
    ).toEqual({ status: "rejected", reason: "selection-invalid" });
    expect(
      prepareAuthoringEventActionModel(
        REFERENCE_AUTHORING_MODEL,
        SIGN_IN_ROUTE,
        forgedBehaviorSelection(),
      ),
    ).toEqual({ status: "rejected", reason: "selection-invalid" });

    const ambiguous = copyJson(officialSignInSource) as unknown as MutableJsonObject;
    const root = record(mutableSurface(ambiguous, "sign-in").root, "root");
    const children = array(record(root.slots, "root.slots").default, "root.slots.default");
    children.push(copyJson(mutableNode(ambiguous, "sign-in.email")));
    expect(
      prepareAuthoringEventActionModel(fakeModel(ambiguous), SIGN_IN_ROUTE, emailSelection()),
    ).toEqual({ status: "rejected", reason: "selection-invalid" });

    const behaviorAmbiguous = copyJson(officialSignInSource) as unknown as MutableJsonObject;
    mutableNode(behaviorAmbiguous, "sign-in.email").behaviors = [
      { id: "sign-in.email", use: "com.example.behavior/Forged" },
    ];
    expect(
      prepareAuthoringEventActionModel(
        fakeModel(behaviorAmbiguous),
        SIGN_IN_ROUTE,
        emailSelection(),
      ),
    ).toEqual({ status: "rejected", reason: "selection-invalid" });

    const original = requireDocument();
    expect(
      applyAuthoringEventActionEdit(original, referenceCatalog, HOME_ROUTE, emailSelection(), {
        kind: "delete-handler",
        event: "change",
      }),
    ).toEqual({ ok: false, reason: "owner-invalid" });
    expect(
      apply(
        original,
        { ...emailSelection(), capabilityId: "com.example.ui/Button" },
        {
          kind: "delete-handler",
          event: "change",
        },
      ),
    ).toEqual({ ok: false, reason: "owner-invalid" });
  });

  it("rejects undeclared events, malformed pointers, and invalid indices before mutation", () => {
    const original = requireDocument();
    const selection = emailSelection();
    expect(apply(original, selection, { kind: "delete-handler", event: "unknown" })).toEqual({
      ok: false,
      reason: "event-not-found",
    });
    expect(
      apply(original, selection, {
        kind: "insert-action",
        actionListPointer: "/on/change/00/onSuccess",
        index: 0,
        action: { type: "event.emit", name: "x" },
      }),
    ).toEqual({ ok: false, reason: "path-invalid" });
    expect(
      apply(original, selection, {
        kind: "delete-action",
        actionPointer: "/on/change/01",
      }),
    ).toEqual({ ok: false, reason: "path-invalid" });
    expect(
      apply(original, selection, {
        kind: "insert-action",
        actionListPointer: "/on/change",
        index: 2,
        action: { type: "event.emit", name: "x" },
      }),
    ).toEqual({ ok: false, reason: "position-invalid" });
    expect(
      apply(original, selection, {
        kind: "reorder-action",
        actionPointer: "/on/change/0",
        index: 1,
      }),
    ).toEqual({ ok: false, reason: "position-invalid" });
    expect(
      apply(original, selection, {
        kind: "insert-action",
        actionListPointer: "/on/change",
        index: -1,
        action: { type: "event.emit", name: "x" },
      }),
    ).toEqual({ ok: false, reason: "edit-rejected" });
  });

  it("enforces the 25,000-action and 64-level projection limits", () => {
    const wide = copyJson(officialSignInSource) as unknown as MutableJsonObject;
    record(mutableNode(wide, "sign-in.email").on, "email.on").change = Array.from(
      { length: 25_001 },
      () => ({ type: "event.emit", name: "x" }),
    );
    expect(
      prepareAuthoringEventActionModel(fakeModel(wide), SIGN_IN_ROUTE, emailSelection()),
    ).toEqual({ status: "rejected", reason: "projection-limit" });

    function nestedAction(wrappers: number): AuthoringClosedAction {
      let action: AuthoringClosedAction = { type: "navigate", surface: "home" };
      for (let index = 0; index < wrappers; index += 1) {
        action = {
          type: "operation.invoke",
          operation: "com.example.auth/signIn",
          as: `result${index}`,
          input: {},
          onSuccess: [action],
        };
      }
      return action;
    }

    const atLimit = copyJson(officialSignInSource) as unknown as MutableJsonObject;
    record(mutableNode(atLimit, "sign-in.email").on, "email.on").change = [nestedAction(64)];
    expect(
      prepareAuthoringEventActionModel(fakeModel(atLimit), SIGN_IN_ROUTE, emailSelection()).status,
    ).toBe("ready");

    const tooDeep = copyJson(officialSignInSource) as unknown as MutableJsonObject;
    record(mutableNode(tooDeep, "sign-in.email").on, "email.on").change = [nestedAction(65)];
    expect(
      prepareAuthoringEventActionModel(fakeModel(tooDeep), SIGN_IN_ROUTE, emailSelection()),
    ).toEqual({ status: "rejected", reason: "projection-limit" });
  });

  it("contains malformed own-data edits and preserves every caller input on success or failure", () => {
    const original = requireDocument();
    const beforeDocument = canonicalizeJson(original);
    const beforeCatalog = canonicalizeJson(referenceCatalog);
    const route = { ...SIGN_IN_ROUTE };
    const selection = emailSelection();
    const beforeRoute = canonicalizeJson(route);
    const beforeSelection = canonicalizeJson(selection);

    const edit = {
      kind: "replace-action",
      actionPointer: "/on/change/0",
      action: { type: "state.set", path: "email", value: "next" },
    } as const satisfies AuthoringEventActionEdit;
    const beforeEdit = canonicalizeJson(edit);
    expect(
      applyAuthoringEventActionEdit(original, referenceCatalog, route, selection, edit).ok,
    ).toBe(true);
    expect(canonicalizeJson(original)).toBe(beforeDocument);
    expect(canonicalizeJson(referenceCatalog)).toBe(beforeCatalog);
    expect(canonicalizeJson(route)).toBe(beforeRoute);
    expect(canonicalizeJson(selection)).toBe(beforeSelection);
    expect(canonicalizeJson(edit)).toBe(beforeEdit);

    let getterCalls = 0;
    const accessorEdit = Object.defineProperty(
      { kind: "replace-action", actionPointer: "/on/change/0" },
      "action",
      {
        enumerable: true,
        get() {
          getterCalls += 1;
          return { type: "event.emit", name: "unsafe" };
        },
      },
    ) as unknown as AuthoringEventActionEdit;
    expect(apply(original, selection, accessorEdit)).toEqual({
      ok: false,
      reason: "edit-rejected",
    });
    expect(getterCalls).toBe(0);
    expect(canonicalizeJson(original)).toBe(beforeDocument);

    expect(
      applyAuthoringEventActionEdit(
        original,
        { ...copyJson(referenceCatalog), kind: "not-a-catalog" },
        SIGN_IN_ROUTE,
        selection,
        { kind: "delete-handler", event: "change" },
      ),
    ).toEqual({ ok: false, reason: "catalog-invalid" });
    expect(canonicalizeJson(original)).toBe(beforeDocument);
  });
});
