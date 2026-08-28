import referenceCatalog from "@desen/reference-catalog-web/catalog.json";
import { createDesenEditorDocument } from "@desen/editor-core";
import { describe, expect, it } from "vitest";

import officialSignInSource from "../../../examples/sign-in/official-derived.source.desen.json";
import {
  applyAuthoringInspectorEdit,
  prepareAuthoringInspectorModel,
} from "../src/authoring-inspector.js";
import { prepareCatalogAuthoringModel, REFERENCE_AUTHORING_MODEL } from "../src/authoring-data.js";
import { createAuthoringComponentSelection } from "../src/authoring-selection.js";

import type { DesenEditorDocument } from "@desen/editor-core";
import type {
  AuthoringInspectorEdit,
  AuthoringInspectorEditResult,
  AuthoringInspectorReadyModel,
  AuthoringInspectorRoute,
} from "../src/authoring-inspector.js";
import type { AuthoringLayerNode, CatalogAuthoringModel } from "../src/authoring-data.js";
import type { AuthoringComponentSelection } from "../src/authoring-selection.js";

const REFERENCE_ROUTE = Object.freeze({
  projectId: "account-app",
  surfaceId: "sign-in",
}) satisfies AuthoringInspectorRoute;

type EditorNode = DesenEditorDocument["surfaces"][string]["root"];
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

function requireReferenceDocument(): DesenEditorDocument {
  const result = createDesenEditorDocument(officialSignInSource);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("Expected the official sign-in Source to be editor-admissible.");
  return result.document;
}

function requireEditorDocument(value: unknown): DesenEditorDocument {
  const result = createDesenEditorDocument(value);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("Expected the synthetic Source to be editor-admissible.");
  return result.document;
}

function requirePreparedModel(catalog: unknown, source: unknown): CatalogAuthoringModel {
  const result = prepareCatalogAuthoringModel(catalog, source);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(`Expected an authoring model, received ${result.reason}.`);
  return result.model;
}

function requireInspector(
  model: CatalogAuthoringModel,
  selection: AuthoringComponentSelection,
  route: AuthoringInspectorRoute = REFERENCE_ROUTE,
): AuthoringInspectorReadyModel {
  const result = prepareAuthoringInspectorModel(model, route, selection);
  expect(result.status).toBe("ready");
  if (result.status !== "ready") {
    throw new Error(`Expected a ready inspector, received ${result.status}.`);
  }
  return result;
}

function requireEditSuccess(result: AuthoringInspectorEditResult): DesenEditorDocument {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(`Expected an inspector edit, received ${result.reason}.`);
  return result.document;
}

function findLayerNode(model: CatalogAuthoringModel, surfaceId: string, nodeId: string) {
  const surface = model.surfaces.find(({ id }) => id === surfaceId);
  if (surface === undefined) throw new Error(`Missing authoring surface ${surfaceId}.`);
  const pending: AuthoringLayerNode[] = [surface.root];
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined) continue;
    if (current.id === nodeId) return current;
    for (const slot of current.slots) pending.push(...slot.children);
    for (const behavior of current.behaviors) {
      for (const slot of behavior.slots) pending.push(...slot.children);
    }
  }
  throw new Error(`Missing authoring node ${nodeId}.`);
}

function selectionFor(
  model: CatalogAuthoringModel,
  sourceNodeId: string,
  route: AuthoringInspectorRoute = REFERENCE_ROUTE,
): AuthoringComponentSelection {
  const node = findLayerNode(model, route.surfaceId, sourceNodeId);
  return createAuthoringComponentSelection({
    projectId: route.projectId,
    surfaceId: route.surfaceId,
    sourceNodeId: node.id,
    capabilityId: node.capabilityId,
    displayName: node.displayName,
    conditional: node.conditional,
  });
}

function findEditorNode(
  document: DesenEditorDocument,
  nodeId: string,
  surfaceId = "sign-in",
): EditorNode {
  const surface = document.surfaces[surfaceId];
  if (surface === undefined) throw new Error(`Missing editor surface ${surfaceId}.`);
  const pending: EditorNode[] = [surface.root];
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined) continue;
    if (current.id === nodeId) return current;
    for (const children of Object.values(current.slots ?? {})) pending.push(...children);
    for (const behavior of current.behaviors ?? []) {
      for (const children of Object.values(behavior.slots ?? {})) pending.push(...children);
    }
  }
  throw new Error(`Missing editor node ${nodeId}.`);
}

function childOrder(document: DesenEditorDocument): readonly string[] {
  return (document.surfaces["sign-in"]?.root.slots?.default ?? []).map(({ id }) => id);
}

function controlSignature(model: CatalogAuthoringModel, componentId: string) {
  const component = model.components.find(({ id }) => id === componentId);
  if (component === undefined) throw new Error(`Missing Catalog component ${componentId}.`);
  return component.inspector.controls.map((control) => [
    control.property,
    control.kind,
    control.required,
    control.kind === "enum" ? control.options : null,
  ]);
}

describe("Desen App schema-driven authoring inspector", () => {
  it("derives the exact canonical primitive and enum matrix for every reference component", () => {
    expect(controlSignature(REFERENCE_AUTHORING_MODEL, "com.example.ui/Alert")).toEqual([
      ["text", "string", true, null],
      ["tone", "enum", true, ["info", "success", "warning", "critical"]],
    ]);
    expect(controlSignature(REFERENCE_AUTHORING_MODEL, "com.example.ui/Button")).toEqual([
      ["disabled", "boolean", false, null],
      ["label", "string", true, null],
      ["loading", "boolean", false, null],
      ["variant", "enum", false, ["primary", "secondary", "danger"]],
    ]);
    expect(controlSignature(REFERENCE_AUTHORING_MODEL, "com.example.ui/Stack")).toEqual([
      ["align", "enum", false, ["start", "center", "end", "stretch"]],
      ["direction", "enum", false, ["vertical", "horizontal"]],
      ["gap", "enum", false, ["none", "xs", "sm", "md", "lg", "xl"]],
      ["maxWidth", "number", false, null],
    ]);
    expect(controlSignature(REFERENCE_AUTHORING_MODEL, "com.example.ui/Text")).toEqual([
      ["role", "enum", false, ["body", "heading", "caption"]],
      ["text", "string", true, null],
    ]);
    expect(controlSignature(REFERENCE_AUTHORING_MODEL, "com.example.ui/TextField")).toEqual([
      ["disabled", "boolean", false, null],
      ["invalid", "boolean", false, null],
      ["label", "string", true, null],
      ["placeholder", "string", false, null],
      ["secure", "boolean", false, null],
      ["value", "string", true, null],
    ]);

    expect(Object.isFrozen(REFERENCE_AUTHORING_MODEL)).toBe(true);
    expect(
      REFERENCE_AUTHORING_MODEL.components.every(
        ({ inspector }) => Object.isFrozen(inspector) && Object.isFrozen(inspector.controls),
      ),
    ).toBe(true);
  });

  it("distinguishes literal, absent, and dynamic Source values without coercion", () => {
    const email = requireInspector(
      REFERENCE_AUTHORING_MODEL,
      selectionFor(REFERENCE_AUTHORING_MODEL, "sign-in.email"),
    );
    const emailValues = Object.fromEntries(
      email.fields.map(({ control, value }) => [control.property, value]),
    );

    expect(email.fields.map(({ control }) => control.property)).toEqual([
      "disabled",
      "invalid",
      "label",
      "placeholder",
      "secure",
      "value",
    ]);
    expect(emailValues).toEqual({
      disabled: { kind: "absent" },
      invalid: { kind: "absent" },
      label: { kind: "literal", value: "Email" },
      placeholder: { kind: "absent" },
      secure: { kind: "absent" },
      value: { kind: "dynamic", reference: "state.email" },
    });

    const password = requireInspector(
      REFERENCE_AUTHORING_MODEL,
      selectionFor(REFERENCE_AUTHORING_MODEL, "sign-in.password"),
    );
    expect(password.fields.find(({ control }) => control.property === "secure")?.value).toEqual({
      kind: "literal",
      value: true,
    });

    const submit = requireInspector(
      REFERENCE_AUTHORING_MODEL,
      selectionFor(REFERENCE_AUTHORING_MODEL, "sign-in.submit"),
    );
    expect(submit.fields.find(({ control }) => control.property === "loading")?.value).toEqual({
      kind: "dynamic",
      reference: "operation.signIn.pending",
    });
    expect(Object.isFrozen(email.fields)).toBe(true);
    expect(email.fields.every(Object.isFrozen)).toBe(true);
  });

  it("sets string, enum, boolean, and number props through fresh immutable Source snapshots", () => {
    const original = requireReferenceDocument();
    const originalSnapshot = copyJson(original);
    const expectedOrder = childOrder(original);
    const emailBinding = copyJson(findEditorNode(original, "sign-in.email").props?.value);
    const loadingBinding = copyJson(findEditorNode(original, "sign-in.submit").props?.loading);

    const textChanged = requireEditSuccess(
      applyAuthoringInspectorEdit(
        original,
        referenceCatalog,
        REFERENCE_ROUTE,
        selectionFor(REFERENCE_AUTHORING_MODEL, "sign-in.title"),
        { kind: "set", property: "text", value: "Welcome back" },
      ),
    );
    const roleChanged = requireEditSuccess(
      applyAuthoringInspectorEdit(
        textChanged,
        referenceCatalog,
        REFERENCE_ROUTE,
        selectionFor(REFERENCE_AUTHORING_MODEL, "sign-in.title"),
        { kind: "set", property: "role", value: "caption" },
      ),
    );
    const booleanChanged = requireEditSuccess(
      applyAuthoringInspectorEdit(
        roleChanged,
        referenceCatalog,
        REFERENCE_ROUTE,
        selectionFor(REFERENCE_AUTHORING_MODEL, "sign-in.password"),
        { kind: "set", property: "secure", value: false },
      ),
    );
    const numberChanged = requireEditSuccess(
      applyAuthoringInspectorEdit(
        booleanChanged,
        referenceCatalog,
        REFERENCE_ROUTE,
        selectionFor(REFERENCE_AUTHORING_MODEL, "sign-in.layout"),
        { kind: "set", property: "maxWidth", value: 512 },
      ),
    );

    expect(findEditorNode(numberChanged, "sign-in.title").props).toMatchObject({
      role: "caption",
      text: "Welcome back",
    });
    expect(findEditorNode(numberChanged, "sign-in.password").props?.secure).toBe(false);
    expect(findEditorNode(numberChanged, "sign-in.layout").props?.maxWidth).toBe(512);
    expect(findEditorNode(numberChanged, "sign-in.email").props?.value).toEqual(emailBinding);
    expect(findEditorNode(numberChanged, "sign-in.submit").props?.loading).toEqual(loadingBinding);
    expect(childOrder(numberChanged)).toEqual(expectedOrder);

    expect(original).toEqual(originalSnapshot);
    expect(textChanged).not.toBe(original);
    expect(roleChanged).not.toBe(textChanged);
    expect(booleanChanged).not.toBe(roleChanged);
    expect(numberChanged).not.toBe(booleanChanged);
    expect(Object.isFrozen(numberChanged)).toBe(true);
    expect(Object.isFrozen(findEditorNode(numberChanged, "sign-in.layout").props)).toBe(true);
    expect(Object.isFrozen(numberChanged.surfaces["sign-in"]?.root.slots?.default)).toBe(true);
  });

  it("deletes only an existing optional prop and rejects absent or required deletion atomically", () => {
    const original = requireReferenceDocument();
    const originalSnapshot = copyJson(original);
    const passwordSelection = selectionFor(REFERENCE_AUTHORING_MODEL, "sign-in.password");

    const deleted = requireEditSuccess(
      applyAuthoringInspectorEdit(original, referenceCatalog, REFERENCE_ROUTE, passwordSelection, {
        kind: "delete",
        property: "secure",
      }),
    );
    expect(Object.hasOwn(findEditorNode(deleted, "sign-in.password").props ?? {}, "secure")).toBe(
      false,
    );
    expect(findEditorNode(deleted, "sign-in.password").props?.value).toEqual({
      $ref: "state.password",
    });
    expect(childOrder(deleted)).toEqual(childOrder(original));

    const absent = applyAuthoringInspectorEdit(
      original,
      referenceCatalog,
      REFERENCE_ROUTE,
      selectionFor(REFERENCE_AUTHORING_MODEL, "sign-in.email"),
      { kind: "delete", property: "secure" },
    );
    expect(absent).toEqual({ ok: false, reason: "control-unavailable" });

    const required = applyAuthoringInspectorEdit(
      original,
      referenceCatalog,
      REFERENCE_ROUTE,
      selectionFor(REFERENCE_AUTHORING_MODEL, "sign-in.title"),
      { kind: "delete", property: "text" },
    );
    expect(required).toEqual({ ok: false, reason: "required-property" });
    expect(original).toEqual(originalSnapshot);
  });

  it("rejects invalid enum and numeric values without mutating the current Source", () => {
    const original = requireReferenceDocument();
    const originalSnapshot = copyJson(original);
    const titleSelection = selectionFor(REFERENCE_AUTHORING_MODEL, "sign-in.title");
    const layoutSelection = selectionFor(REFERENCE_AUTHORING_MODEL, "sign-in.layout");

    expect(
      applyAuthoringInspectorEdit(original, referenceCatalog, REFERENCE_ROUTE, titleSelection, {
        kind: "set",
        property: "role",
        value: "display",
      }),
    ).toEqual({ ok: false, reason: "value-invalid" });
    expect(
      applyAuthoringInspectorEdit(original, referenceCatalog, REFERENCE_ROUTE, layoutSelection, {
        kind: "set",
        property: "maxWidth",
        value: Number.NaN,
      }),
    ).toEqual({ ok: false, reason: "value-invalid" });
    expect(
      applyAuthoringInspectorEdit(original, referenceCatalog, REFERENCE_ROUTE, layoutSelection, {
        kind: "set",
        property: "maxWidth",
        value: Number.POSITIVE_INFINITY,
      }),
    ).toEqual({ ok: false, reason: "value-invalid" });
    expect(
      applyAuthoringInspectorEdit(original, referenceCatalog, REFERENCE_ROUTE, layoutSelection, {
        kind: "set",
        property: "maxWidth",
        value: 0,
      }),
    ).toEqual({ ok: false, reason: "source-invalid" });
    expect(original).toEqual(originalSnapshot);
  });

  it("keeps dynamic props outside T05 mutation authority and preserves their exact objects", () => {
    const original = requireReferenceDocument();
    const emailValue = copyJson(findEditorNode(original, "sign-in.email").props?.value);
    const loadingValue = copyJson(findEditorNode(original, "sign-in.submit").props?.loading);

    expect(
      applyAuthoringInspectorEdit(
        original,
        referenceCatalog,
        REFERENCE_ROUTE,
        selectionFor(REFERENCE_AUTHORING_MODEL, "sign-in.email"),
        { kind: "set", property: "value", value: "replacement" },
      ),
    ).toEqual({ ok: false, reason: "control-unavailable" });
    expect(
      applyAuthoringInspectorEdit(
        original,
        referenceCatalog,
        REFERENCE_ROUTE,
        selectionFor(REFERENCE_AUTHORING_MODEL, "sign-in.submit"),
        { kind: "set", property: "loading", value: false },
      ),
    ).toEqual({ ok: false, reason: "control-unavailable" });

    expect(findEditorNode(original, "sign-in.email").props?.value).toEqual(emailValue);
    expect(findEditorNode(original, "sign-in.submit").props?.loading).toEqual(loadingValue);
  });

  it("captures exact own-data edit fields before authorization and rejects accessor drift", () => {
    const original = requireReferenceDocument();
    const originalSnapshot = copyJson(original);
    const selection = selectionFor(REFERENCE_AUTHORING_MODEL, "sign-in.email");
    let propertyReads = 0;
    const accessorEdit = Object.defineProperties(
      {},
      {
        kind: { enumerable: true, get: () => "set" },
        property: {
          enumerable: true,
          get: () => (++propertyReads < 4 ? "label" : "value"),
        },
        value: { enumerable: true, get: () => "replacement" },
      },
    ) as AuthoringInspectorEdit;

    expect(
      applyAuthoringInspectorEdit(
        original,
        referenceCatalog,
        REFERENCE_ROUTE,
        selection,
        accessorEdit,
      ),
    ).toEqual({ ok: false, reason: "edit-rejected" });
    expect(propertyReads).toBe(0);
    expect(original).toEqual(originalSnapshot);

    const extraField = {
      kind: "set",
      property: "label",
      value: "replacement",
      unexpected: true,
    } as unknown as AuthoringInspectorEdit;
    expect(
      applyAuthoringInspectorEdit(
        original,
        referenceCatalog,
        REFERENCE_ROUTE,
        selection,
        extraField,
      ),
    ).toEqual({ ok: false, reason: "edit-rejected" });

    let proxyReads = 0;
    const snapshottedProxy = new Proxy<AuthoringInspectorEdit>(
      { kind: "set", property: "label", value: "Captured label" },
      {
        get(target, property, receiver) {
          if (property === "property") {
            proxyReads += 1;
            return proxyReads < 4 ? "label" : "value";
          }
          return Reflect.get(target, property, receiver) as unknown;
        },
      },
    );
    const changed = requireEditSuccess(
      applyAuthoringInspectorEdit(
        original,
        referenceCatalog,
        REFERENCE_ROUTE,
        selection,
        snapshottedProxy,
      ),
    );
    expect(proxyReads).toBe(0);
    expect(findEditorNode(changed, "sign-in.email").props).toMatchObject({
      label: "Captured label",
      value: { $ref: "state.email" },
    });
  });

  it("rejects stale routes and forged selection identity before exposing or applying controls", () => {
    const original = requireReferenceDocument();
    const originalSnapshot = copyJson(original);
    const exact = selectionFor(REFERENCE_AUTHORING_MODEL, "sign-in.email");
    const staleRoute = Object.freeze({ projectId: "other-project", surfaceId: "sign-in" });
    const forged = createAuthoringComponentSelection({
      projectId: "account-app",
      surfaceId: "sign-in",
      sourceNodeId: "sign-in.email",
      capabilityId: "com.example.ui/Button",
      displayName: "Button",
      conditional: false,
    });

    expect(prepareAuthoringInspectorModel(REFERENCE_AUTHORING_MODEL, staleRoute, exact)).toEqual({
      status: "rejected",
    });
    expect(
      prepareAuthoringInspectorModel(REFERENCE_AUTHORING_MODEL, REFERENCE_ROUTE, forged),
    ).toEqual({ status: "rejected" });
    expect(
      applyAuthoringInspectorEdit(original, referenceCatalog, staleRoute, exact, {
        kind: "set",
        property: "label",
        value: "Forged route",
      }),
    ).toEqual({ ok: false, reason: "selection-invalid" });
    expect(
      applyAuthoringInspectorEdit(original, referenceCatalog, REFERENCE_ROUTE, forged, {
        kind: "set",
        property: "label",
        value: "Forged identity",
      }),
    ).toEqual({ ok: false, reason: "selection-invalid" });
    expect(original).toEqual(originalSnapshot);
  });

  it("preserves integer and mixed primitive enum values with exact JSON types", () => {
    const catalog = copyJson<unknown>(referenceCatalog);
    const components = requireRecord(requireRecord(catalog, "catalog").components, "components");
    const stack = requireRecord(components["com.example.ui/Stack"], "Stack");
    const propsSchema = requireRecord(stack.propsSchema, "Stack.propsSchema");
    const properties = requireRecord(propsSchema.properties, "Stack.propsSchema.properties");
    properties.columns = { minimum: 1, type: "integer" };
    properties.mode = { enum: [null, true, 2, "auto"] };

    const source = copyJson<unknown>(officialSignInSource);
    const surfaces = requireRecord(requireRecord(source, "source").surfaces, "surfaces");
    const signIn = requireRecord(surfaces["sign-in"], "sign-in");
    const root = requireRecord(signIn.root, "sign-in.root");
    const props = requireRecord(root.props, "sign-in.root.props");
    props.columns = 3;
    props.mode = true;

    const model = requirePreparedModel(catalog, source);
    const selection = selectionFor(model, "sign-in.layout");
    const inspector = requireInspector(model, selection);
    expect(
      inspector.fields
        .filter(({ control }) => control.property === "columns" || control.property === "mode")
        .map(({ control, value }) => [
          control.property,
          control.kind,
          control.kind === "enum" ? control.options : null,
          value,
        ]),
    ).toEqual([
      ["columns", "integer", null, { kind: "literal", value: 3 }],
      ["mode", "enum", [null, true, 2, "auto"], { kind: "literal", value: true }],
    ]);

    const document = requireEditorDocument(source);
    const integerChanged = requireEditSuccess(
      applyAuthoringInspectorEdit(document, catalog, REFERENCE_ROUTE, selection, {
        kind: "set",
        property: "columns",
        value: 4,
      }),
    );
    expect(findEditorNode(integerChanged, "sign-in.layout").props?.columns).toBe(4);
    expect(
      applyAuthoringInspectorEdit(integerChanged, catalog, REFERENCE_ROUTE, selection, {
        kind: "set",
        property: "columns",
        value: 4.5,
      }),
    ).toEqual({ ok: false, reason: "value-invalid" });

    const enumChanged = requireEditSuccess(
      applyAuthoringInspectorEdit(integerChanged, catalog, REFERENCE_ROUTE, selection, {
        kind: "set",
        property: "mode",
        value: 2,
      }),
    );
    expect(findEditorNode(enumChanged, "sign-in.layout").props?.mode).toBe(2);
    expect(
      applyAuthoringInspectorEdit(enumChanged, catalog, REFERENCE_ROUTE, selection, {
        kind: "set",
        property: "mode",
        value: "2",
      }),
    ).toEqual({ ok: false, reason: "value-invalid" });
  });

  it("keeps dynamic object values bound instead of presenting the structured fallback", () => {
    const catalog = copyJson<unknown>(referenceCatalog);
    const components = requireRecord(requireRecord(catalog, "catalog").components, "components");
    const stack = requireRecord(components["com.example.ui/Stack"], "Stack");
    const propsSchema = requireRecord(stack.propsSchema, "Stack.propsSchema");
    const properties = requireRecord(propsSchema.properties, "Stack.propsSchema.properties");
    properties.config = {
      additionalProperties: false,
      properties: { label: { type: "string" } },
      required: ["label"],
      type: "object",
    };

    const source = copyJson<unknown>(officialSignInSource);
    const surfaces = requireRecord(requireRecord(source, "source").surfaces, "surfaces");
    const signIn = requireRecord(surfaces["sign-in"], "sign-in");
    const root = requireRecord(signIn.root, "sign-in.root");
    const props = requireRecord(root.props, "sign-in.root.props");
    props.config = { $ref: "state.email" };

    const model = requirePreparedModel(catalog, source);
    const selection = selectionFor(model, "sign-in.layout");
    const field = requireInspector(model, selection).fields.find(
      ({ control }) => control.property === "config",
    );
    expect(field?.control.kind).toBe("group");
    expect(field?.value).toEqual({ kind: "dynamic", reference: "state.email" });
  });
});
