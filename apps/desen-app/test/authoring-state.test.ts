import referenceCatalog from "@desen/reference-catalog-web/catalog.json";
import { createDesenEditorDocument } from "@desen/editor-core";
import { describe, expect, it } from "vitest";

import officialSignInSource from "../../../examples/sign-in/official-derived.source.desen.json";
import { prepareCatalogAuthoringModel } from "../src/authoring-data.js";
import { REFERENCE_AUTHORING_MODEL } from "../src/reference-authoring-profile.js";
import { applyAuthoringStateEdit, prepareAuthoringStateModel } from "../src/authoring-state.js";

import type { DesenEditorDocument } from "@desen/editor-core";
import type { CatalogAuthoringModel } from "../src/authoring-data.js";
import type {
  AuthoringStateEdit,
  AuthoringStateEditResult,
  AuthoringStateModelResult,
  AuthoringStateReadyModel,
  AuthoringStateRoute,
} from "../src/authoring-state.js";

const SIGN_IN_ROUTE = Object.freeze({
  projectId: "account-app",
  surfaceId: "sign-in",
}) satisfies AuthoringStateRoute;

const HOME_ROUTE = Object.freeze({
  projectId: "account-app",
  surfaceId: "home",
}) satisfies AuthoringStateRoute;

type MutableJsonObject = Record<string, unknown>;

function copyJson<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value;
}

function requireRecord(value: unknown, path: string): MutableJsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${path} must be an object.`);
  }
  return value as MutableJsonObject;
}

function requireDocument(source: unknown = officialSignInSource): DesenEditorDocument {
  const result = createDesenEditorDocument(source);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("Expected an editor-admissible Source fixture.");
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

function requireReady(result: AuthoringStateModelResult): AuthoringStateReadyModel {
  expect(result.status).toBe("ready");
  if (result.status !== "ready") {
    throw new Error(`Expected a ready state model, received ${result.reason}.`);
  }
  return result;
}

function requireSuccess(result: AuthoringStateEditResult): DesenEditorDocument {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(`Expected a state edit, received ${result.reason}.`);
  return result.document;
}

function apply(
  document: DesenEditorDocument,
  route: AuthoringStateRoute,
  edit: AuthoringStateEdit,
): AuthoringStateEditResult {
  return applyAuthoringStateEdit(document, referenceCatalog, route, edit);
}

function mutableSurface(source: MutableJsonObject, surfaceId: "home" | "sign-in") {
  return requireRecord(requireRecord(source.surfaces, "source.surfaces")[surfaceId], surfaceId);
}

describe("Desen App surface-local state authoring", () => {
  it("projects exact ordered primitive declarations and bounded official usage counts", () => {
    const model = requireReady(
      prepareAuthoringStateModel(REFERENCE_AUTHORING_MODEL, SIGN_IN_ROUTE),
    );

    expect(model).toEqual({
      status: "ready",
      route: SIGN_IN_ROUTE,
      declarations: [
        {
          name: "email",
          type: "string",
          schema: { type: "string" },
          initial: "",
          usageCount: 3,
        },
        {
          name: "password",
          type: "string",
          schema: { type: "string" },
          initial: "",
          usageCount: 3,
        },
      ],
    });
    expect(Object.isFrozen(model)).toBe(true);
    expect(Object.isFrozen(model.route)).toBe(true);
    expect(Object.isFrozen(model.declarations)).toBe(true);
    expect(model.declarations.every((declaration) => Object.isFrozen(declaration))).toBe(true);
    expect(model.declarations.every(({ schema }) => Object.isFrozen(schema))).toBe(true);
  });

  it("counts reads and nested writes conservatively but excludes inert state initial data", () => {
    const source = copyJson(officialSignInSource) as unknown as MutableJsonObject;
    const signIn = mutableSurface(source, "sign-in");
    const state = requireRecord(signIn.state, "sign-in.state");
    state.flag = { schema: { type: "boolean" }, initial: false };
    state.payload = {
      schema: { type: "object" },
      initial: { $ref: "state.flag" },
    };

    const root = requireRecord(signIn.root, "sign-in.root");
    root.extensions = { inertReference: { $ref: "state.flag" } };
    const slots = requireRecord(root.slots, "sign-in.root.slots");
    const children = slots.default as MutableJsonObject[];
    const email = requireRecord(children[1], "email");
    requireRecord(email.props, "email.props").disabled = { $ref: "state.flag" };
    const submit = requireRecord(children[4], "submit");
    requireRecord(submit.props, "submit.props").loading = {
      $ref: "state.flag",
      fallback: false,
    };
    const handlers = requireRecord(submit.on, "submit.on");
    const press = handlers.press as MutableJsonObject[];
    press.unshift({ type: "state.toggle", path: "flag" });
    const invoke = requireRecord(press[1], "submit.press[1]");
    invoke.onFailure = [{ type: "state.set", path: "flag", value: false }];

    const model = requireReady(prepareAuthoringStateModel(requireModel(source), SIGN_IN_ROUTE));
    expect(model.declarations).toEqual([
      {
        name: "email",
        type: "string",
        schema: { type: "string" },
        initial: "",
        usageCount: 3,
      },
      {
        name: "flag",
        type: "boolean",
        schema: { type: "boolean" },
        initial: false,
        usageCount: 5,
      },
      {
        name: "password",
        type: "string",
        schema: { type: "string" },
        initial: "",
        usageCount: 3,
      },
      {
        name: "payload",
        type: null,
        schema: { type: "object" },
        initial: { $ref: "state.flag" },
        usageCount: 0,
      },
    ]);
  });

  it("authenticates exact route data and fails closed without invoking accessors", () => {
    expect(prepareAuthoringStateModel(REFERENCE_AUTHORING_MODEL, HOME_ROUTE)).toEqual({
      status: "ready",
      route: HOME_ROUTE,
      declarations: [],
    });
    expect(
      prepareAuthoringStateModel(REFERENCE_AUTHORING_MODEL, {
        projectId: "account-app",
        surfaceId: "missing",
      }),
    ).toEqual({ status: "rejected", reason: "route-invalid" });

    let accessorCalls = 0;
    const accessorRoute = Object.defineProperty({ surfaceId: "sign-in" }, "projectId", {
      enumerable: true,
      get() {
        accessorCalls += 1;
        return "account-app";
      },
    });
    expect(
      prepareAuthoringStateModel(REFERENCE_AUTHORING_MODEL, accessorRoute as AuthoringStateRoute),
    ).toEqual({ status: "rejected", reason: "route-invalid" });
    expect(accessorCalls).toBe(0);

    expect(
      prepareAuthoringStateModel(REFERENCE_AUTHORING_MODEL, {
        ...SIGN_IN_ROUTE,
        extra: true,
      } as AuthoringStateRoute),
    ).toEqual({ status: "rejected", reason: "route-invalid" });
    expect(
      prepareAuthoringStateModel(
        REFERENCE_AUTHORING_MODEL,
        new Proxy(SIGN_IN_ROUTE, {
          ownKeys() {
            throw new Error("hostile route");
          },
        }),
      ),
    ).toEqual({ status: "rejected", reason: "route-invalid" });
  });

  it("inserts every primitive preset with its exact default on the selected surface", () => {
    const original = requireDocument();
    let current = original;
    for (const edit of [
      { kind: "insert", name: "title", type: "string" },
      { kind: "insert", name: "enabled", type: "boolean" },
      { kind: "insert", name: "ratio", type: "number" },
      { kind: "insert", name: "count", type: "integer" },
      { kind: "insert", name: "constructor", type: "string" },
    ] as const satisfies readonly AuthoringStateEdit[]) {
      current = requireSuccess(apply(current, HOME_ROUTE, edit));
      expect(Object.isFrozen(current)).toBe(true);
    }

    expect(original.surfaces.home?.state).toEqual({});
    expect(current.surfaces.home?.state).toEqual({
      title: { schema: { type: "string" }, initial: "" },
      enabled: { schema: { type: "boolean" }, initial: false },
      ratio: { schema: { type: "number" }, initial: 0 },
      count: { schema: { type: "integer" }, initial: 0 },
      constructor: { schema: { type: "string" }, initial: "" },
    });
    expect(Object.hasOwn(current.surfaces.home?.state ?? {}, "constructor")).toBe(true);

    const projected = requireReady(prepareAuthoringStateModel(requireModel(current), HOME_ROUTE));
    expect(projected.declarations.map(({ name }) => name)).toEqual([
      "constructor",
      "count",
      "enabled",
      "ratio",
      "title",
    ]);
  });

  it("stages schema and initial changes privately and validates only the complete endpoint", () => {
    const original = requireDocument();
    const changed = requireSuccess(
      apply(original, SIGN_IN_ROUTE, {
        kind: "update",
        name: "email",
        type: "boolean",
        initial: false,
      }),
    );

    expect(original.surfaces["sign-in"]?.state.email).toEqual({
      schema: { type: "string" },
      initial: "",
    });
    expect(changed.surfaces["sign-in"]?.state.email).toEqual({
      schema: { type: "boolean" },
      initial: false,
    });
    expect(changed.surfaces["sign-in"]?.state.password).toBeDefined();
    expect(Object.isFrozen(changed.surfaces["sign-in"]?.state.email)).toBe(true);
  });

  it("returns the frozen rejected-candidate report without exposing the candidate", () => {
    const source = copyJson(officialSignInSource) as unknown as MutableJsonObject;
    const signIn = mutableSurface(source, "sign-in");
    const root = requireRecord(signIn.root, "sign-in.root");
    const slots = requireRecord(root.slots, "sign-in.root.slots");
    const email = requireRecord((slots.default as unknown[])[1], "sign-in.email");
    const handlers = requireRecord(email.on, "sign-in.email.on");
    const change = handlers.change as MutableJsonObject[];
    requireRecord(change[0], "sign-in.email.on.change.0").value = "literal email";
    const original = requireDocument(source);
    const before = copyJson(original);

    const rejected = apply(original, SIGN_IN_ROUTE, {
      kind: "update",
      name: "email",
      type: "boolean",
      initial: false,
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
      throw new Error("Expected rejected-candidate state diagnostics.");
    }
    expect(Object.isFrozen(rejected)).toBe(true);
    expect(Object.isFrozen(rejected.validationReport)).toBe(true);
    expect(Object.hasOwn(rejected, "document")).toBe(false);
    expect(original).toEqual(before);
  });

  it("deletes only unused declarations without cascading and retains the required state map", () => {
    const original = requireDocument();
    const inserted = requireSuccess(
      apply(original, HOME_ROUTE, { kind: "insert", name: "temporary", type: "string" }),
    );
    const deleted = requireSuccess(
      apply(inserted, HOME_ROUTE, { kind: "delete", name: "temporary" }),
    );

    expect(inserted.surfaces.home?.state.temporary).toBeDefined();
    expect(deleted.surfaces.home?.state).toEqual({});
    expect(Object.hasOwn(deleted.surfaces.home ?? {}, "state")).toBe(true);

    const inUse = apply(original, SIGN_IN_ROUTE, { kind: "delete", name: "email" });
    expect(inUse).toEqual({ ok: false, reason: "state-in-use" });
    expect(original.surfaces["sign-in"]?.state.email).toBeDefined();
    expect(original.surfaces["sign-in"]?.root.slots?.default?.[1]?.props?.value).toEqual({
      $ref: "state.email",
    });
  });

  it("keeps legal non-addressable and richer-schema declarations visible but outside edits", () => {
    const source = copyJson(officialSignInSource) as unknown as MutableJsonObject;
    const signIn = mutableSurface(source, "sign-in");
    const state = requireRecord(signIn.state, "sign-in.state");
    state["legacy.value"] = { schema: { type: "string" }, initial: "legacy" };
    state.constrained = {
      schema: { type: "string", minLength: 3 },
      initial: "abc",
    };
    const document = requireDocument(source);
    const model = requireReady(prepareAuthoringStateModel(requireModel(document), SIGN_IN_ROUTE));

    expect(model.declarations.find(({ name }) => name === "legacy.value")).toMatchObject({
      name: "legacy.value",
      type: "string",
      usageCount: 0,
    });
    expect(model.declarations.find(({ name }) => name === "constrained")).toMatchObject({
      name: "constrained",
      type: null,
      usageCount: 0,
    });
    expect(apply(document, SIGN_IN_ROUTE, { kind: "delete", name: "legacy.value" })).toEqual({
      ok: false,
      reason: "edit-rejected",
    });
    expect(
      apply(document, SIGN_IN_ROUTE, {
        kind: "update",
        name: "constrained",
        type: "string",
        initial: "replacement",
      }),
    ).toEqual({ ok: false, reason: "edit-rejected" });
    expect(document.surfaces["sign-in"]?.state.constrained).toEqual({
      schema: { type: "string", minLength: 3 },
      initial: "abc",
    });
  });

  it("rejects duplicate and stale targets with stable reasons and no partial document", () => {
    const document = requireDocument();
    expect(
      apply(document, SIGN_IN_ROUTE, { kind: "insert", name: "email", type: "string" }),
    ).toEqual({ ok: false, reason: "state-exists" });
    expect(
      apply(document, SIGN_IN_ROUTE, {
        kind: "update",
        name: "missing",
        type: "string",
        initial: "",
      }),
    ).toEqual({ ok: false, reason: "state-not-found" });
    expect(apply(document, SIGN_IN_ROUTE, { kind: "delete", name: "missing" })).toEqual({
      ok: false,
      reason: "state-not-found",
    });
    expect(document.surfaces["sign-in"]?.state).toEqual({
      email: { schema: { type: "string" }, initial: "" },
      password: { schema: { type: "string" }, initial: "" },
    });
  });

  it("captures edits as exact own data and enforces conservative identifiers and preset initials", () => {
    const document = requireDocument();
    const rejected: unknown[] = [
      { kind: "insert", name: "bad.name", type: "string" },
      { kind: "insert", name: "bad:name", type: "string" },
      { kind: "insert", name: "_hidden", type: "string" },
      { kind: "insert", name: `A${"a".repeat(128)}`, type: "string" },
      { kind: "insert", name: "extra", type: "string", extra: true },
      { kind: "update", name: "email", type: "boolean", initial: "false" },
      { kind: "update", name: "email", type: "integer", initial: 1.5 },
      { kind: "update", name: "email", type: "number", initial: Number.NaN },
      { kind: "update", name: "email", type: "number", initial: Number.POSITIVE_INFINITY },
      { kind: "update", name: "email", type: "string", initial: { value: "email" } },
      { kind: "rename", name: "email", type: "string" },
    ];
    for (const edit of rejected) {
      expect(apply(document, SIGN_IN_ROUTE, edit as AuthoringStateEdit)).toEqual({
        ok: false,
        reason: "edit-rejected",
      });
    }

    let accessorCalls = 0;
    const accessorEdit = Object.defineProperty({ kind: "insert", type: "string" }, "name", {
      enumerable: true,
      get() {
        accessorCalls += 1;
        return "unsafe";
      },
    });
    expect(apply(document, HOME_ROUTE, accessorEdit as AuthoringStateEdit)).toEqual({
      ok: false,
      reason: "edit-rejected",
    });
    expect(accessorCalls).toBe(0);

    const symbolEdit = { kind: "insert", name: "unsafe", type: "string" };
    Object.defineProperty(symbolEdit, Symbol("authority"), { enumerable: true, value: true });
    expect(apply(document, HOME_ROUTE, symbolEdit as AuthoringStateEdit)).toEqual({
      ok: false,
      reason: "edit-rejected",
    });
    expect(
      apply(
        document,
        HOME_ROUTE,
        new Proxy({ kind: "insert", name: "unsafe", type: "string" } satisfies AuthoringStateEdit, {
          getOwnPropertyDescriptor() {
            throw new Error("hostile edit");
          },
        }),
      ),
    ).toEqual({ ok: false, reason: "edit-rejected" });
  });

  it("accepts null-prototype exact command data without prototype-sensitive lookup", () => {
    const document = requireDocument();
    const edit = Object.create(null) as MutableJsonObject;
    Object.defineProperties(edit, {
      kind: { enumerable: true, value: "insert" },
      name: { enumerable: true, value: "prototypeSafe" },
      type: { enumerable: true, value: "boolean" },
    });

    const changed = requireSuccess(apply(document, HOME_ROUTE, edit as AuthoringStateEdit));
    expect(changed.surfaces.home?.state.prototypeSafe).toEqual({
      schema: { type: "boolean" },
      initial: false,
    });
  });

  it("maps Catalog, Source, and route rejection without exposing a candidate", () => {
    const document = requireDocument();
    expect(
      applyAuthoringStateEdit(
        document,
        { ...copyJson(referenceCatalog), kind: "not-a-catalog" },
        HOME_ROUTE,
        { kind: "insert", name: "safe", type: "string" },
      ),
    ).toEqual({ ok: false, reason: "catalog-invalid" });

    const invalidSource = copyJson(officialSignInSource);
    invalidSource.surfaces["sign-in"].root.use = "com.example.ui/Unknown";
    expect(
      applyAuthoringStateEdit(
        invalidSource as unknown as DesenEditorDocument,
        referenceCatalog,
        SIGN_IN_ROUTE,
        { kind: "insert", name: "safe", type: "string" },
      ),
    ).toEqual({ ok: false, reason: "source-invalid" });
    expect(
      apply(
        document,
        { projectId: "account-app", surfaceId: "missing" },
        {
          kind: "insert",
          name: "safe",
          type: "string",
        },
      ),
    ).toEqual({ ok: false, reason: "edit-rejected" });
  });

  it("bounds data-only projection depth and rejects accessors without reading them", () => {
    const deepSource = copyJson(officialSignInSource) as unknown as MutableJsonObject;
    const deepSignIn = mutableSurface(deepSource, "sign-in");
    const deepRoot = requireRecord(deepSignIn.root, "sign-in.root");
    const deepProps = requireRecord(deepRoot.props, "sign-in.root.props");
    let nested: unknown = "end";
    for (let depth = 0; depth < 513; depth += 1) nested = [nested];
    deepProps.direction = nested;
    const deepModel = {
      ...REFERENCE_AUTHORING_MODEL,
      validationDocument: deepSource as unknown as DesenEditorDocument,
    } satisfies CatalogAuthoringModel;
    expect(prepareAuthoringStateModel(deepModel, SIGN_IN_ROUTE)).toEqual({
      status: "rejected",
      reason: "projection-limit",
    });

    const wideSource = copyJson(officialSignInSource) as unknown as MutableJsonObject;
    const wideSignIn = mutableSurface(wideSource, "sign-in");
    const wideRoot = requireRecord(wideSignIn.root, "sign-in.root");
    const wideProps = requireRecord(wideRoot.props, "sign-in.root.props");
    wideProps.direction = Array.from({ length: 100_001 }, () => 0);
    const wideModel = {
      ...REFERENCE_AUTHORING_MODEL,
      validationDocument: wideSource as unknown as DesenEditorDocument,
    } satisfies CatalogAuthoringModel;
    expect(prepareAuthoringStateModel(wideModel, SIGN_IN_ROUTE)).toEqual({
      status: "rejected",
      reason: "projection-limit",
    });

    const accessorSource = copyJson(officialSignInSource) as unknown as MutableJsonObject;
    const accessorSignIn = mutableSurface(accessorSource, "sign-in");
    const accessorRoot = requireRecord(accessorSignIn.root, "sign-in.root");
    const accessorProps = requireRecord(accessorRoot.props, "sign-in.root.props");
    let accessorCalls = 0;
    Object.defineProperty(accessorProps, "gap", {
      enumerable: true,
      get() {
        accessorCalls += 1;
        return "md";
      },
    });
    const accessorModel = {
      ...REFERENCE_AUTHORING_MODEL,
      validationDocument: accessorSource as unknown as DesenEditorDocument,
    } satisfies CatalogAuthoringModel;
    expect(prepareAuthoringStateModel(accessorModel, SIGN_IN_ROUTE)).toEqual({
      status: "rejected",
      reason: "route-invalid",
    });
    expect(accessorCalls).toBe(0);
  });
});
