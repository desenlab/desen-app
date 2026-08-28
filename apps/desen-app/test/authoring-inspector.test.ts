import referenceCatalog from "@desen/reference-catalog-web/catalog.json";
import { createCatalogManifest, registerComponent } from "@desen/catalog-sdk";
import { createDesenEditorDocument } from "@desen/editor-core";
import { canonicalizeJsonBytes } from "@desen/protocol";
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

const SYNTHETIC_ROUTE = Object.freeze({
  projectId: "inspector-fixture",
  surfaceId: "fixture",
}) satisfies AuthoringInspectorRoute;
const SYNTHETIC_CATALOG_ID = "run.desen.test.inspector";
const SYNTHETIC_COMPONENT_ID = "com.example.ui/InspectorFixture";

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

function createSyntheticInspectorFixture(
  propsSchema: unknown,
  props: unknown,
  state: unknown = {},
) {
  const component = registerComponent({
    id: SYNTHETIC_COMPONENT_ID,
    manifest: {
      authoring: {
        category: "Tests",
        displayName: "Inspector Fixture",
      },
      category: "complex",
      propsSchema: propsSchema as never,
    },
  });
  const catalog = createCatalogManifest({
    components: [component],
    id: SYNTHETIC_CATALOG_ID,
    packageDigest: `sha256:${"0".repeat(64)}`,
    target: "web-react",
    version: "1.0.0",
  });
  const source = {
    catalogs: [
      {
        id: SYNTHETIC_CATALOG_ID,
        target: "web-react",
        version: "1.0.0",
      },
    ],
    desen: "0.1.0",
    entry: "fixture",
    id: "com.example.inspector-fixture",
    kind: "desen.source",
    surfaces: {
      fixture: {
        id: "fixture",
        resources: {},
        root: {
          id: "fixture.root",
          props,
          use: SYNTHETIC_COMPONENT_ID,
        },
        state,
      },
    },
  };
  const document = requireEditorDocument(source);
  const model = requirePreparedModel(catalog, document);
  const selection = selectionFor(model, "fixture.root", SYNTHETIC_ROUTE);
  return { catalog, document, model, selection };
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
        { kind: "set", valuePointer: "/text", value: "Welcome back" },
      ),
    );
    const roleChanged = requireEditSuccess(
      applyAuthoringInspectorEdit(
        textChanged,
        referenceCatalog,
        REFERENCE_ROUTE,
        selectionFor(REFERENCE_AUTHORING_MODEL, "sign-in.title"),
        { kind: "set", valuePointer: "/role", value: "caption" },
      ),
    );
    const booleanChanged = requireEditSuccess(
      applyAuthoringInspectorEdit(
        roleChanged,
        referenceCatalog,
        REFERENCE_ROUTE,
        selectionFor(REFERENCE_AUTHORING_MODEL, "sign-in.password"),
        { kind: "set", valuePointer: "/secure", value: false },
      ),
    );
    const numberChanged = requireEditSuccess(
      applyAuthoringInspectorEdit(
        booleanChanged,
        referenceCatalog,
        REFERENCE_ROUTE,
        selectionFor(REFERENCE_AUTHORING_MODEL, "sign-in.layout"),
        { kind: "set", valuePointer: "/maxWidth", value: 512 },
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
        valuePointer: "/secure",
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
      { kind: "delete", valuePointer: "/secure" },
    );
    expect(absent).toEqual({ ok: false, reason: "control-unavailable" });

    const required = applyAuthoringInspectorEdit(
      original,
      referenceCatalog,
      REFERENCE_ROUTE,
      selectionFor(REFERENCE_AUTHORING_MODEL, "sign-in.title"),
      { kind: "delete", valuePointer: "/text" },
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
        valuePointer: "/role",
        value: "display",
      }),
    ).toEqual({ ok: false, reason: "value-invalid" });
    expect(
      applyAuthoringInspectorEdit(original, referenceCatalog, REFERENCE_ROUTE, layoutSelection, {
        kind: "set",
        valuePointer: "/maxWidth",
        value: Number.NaN,
      }),
    ).toEqual({ ok: false, reason: "edit-rejected" });
    expect(
      applyAuthoringInspectorEdit(original, referenceCatalog, REFERENCE_ROUTE, layoutSelection, {
        kind: "set",
        valuePointer: "/maxWidth",
        value: Number.POSITIVE_INFINITY,
      }),
    ).toEqual({ ok: false, reason: "edit-rejected" });
    expect(
      applyAuthoringInspectorEdit(original, referenceCatalog, REFERENCE_ROUTE, layoutSelection, {
        kind: "set",
        valuePointer: "/maxWidth",
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
        { kind: "set", valuePointer: "/value", value: "replacement" },
      ),
    ).toEqual({ ok: false, reason: "control-unavailable" });
    expect(
      applyAuthoringInspectorEdit(
        original,
        referenceCatalog,
        REFERENCE_ROUTE,
        selectionFor(REFERENCE_AUTHORING_MODEL, "sign-in.submit"),
        { kind: "set", valuePointer: "/loading", value: false },
      ),
    ).toEqual({ ok: false, reason: "control-unavailable" });

    expect(findEditorNode(original, "sign-in.email").props?.value).toEqual(emailValue);
    expect(findEditorNode(original, "sign-in.submit").props?.loading).toEqual(loadingValue);
  });

  it("captures exact own-data edit fields before authorization and rejects accessor drift", () => {
    const original = requireReferenceDocument();
    const originalSnapshot = copyJson(original);
    const selection = selectionFor(REFERENCE_AUTHORING_MODEL, "sign-in.email");
    let pointerReads = 0;
    const accessorEdit = Object.defineProperties(
      {},
      {
        kind: { enumerable: true, get: () => "set" },
        valuePointer: {
          enumerable: true,
          get: () => (++pointerReads < 4 ? "/label" : "/value"),
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
    expect(pointerReads).toBe(0);
    expect(original).toEqual(originalSnapshot);

    const extraField = {
      kind: "set",
      valuePointer: "/label",
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
      { kind: "set", valuePointer: "/label", value: "Captured label" },
      {
        get(target, property, receiver) {
          if (property === "valuePointer") {
            proxyReads += 1;
            return proxyReads < 4 ? "/label" : "/value";
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

  it("rejects selection accessors unread and captures a data-descriptor Proxy exactly once", () => {
    const original = requireReferenceDocument();
    const originalSnapshot = copyJson(original);
    const exact = selectionFor(REFERENCE_AUTHORING_MODEL, "sign-in.email");
    let accessorReads = 0;
    const accessorSelection = Object.defineProperties(
      {},
      {
        capabilityId: { enumerable: true, value: exact.capabilityId },
        conditional: { enumerable: true, value: exact.conditional },
        displayName: { enumerable: true, value: exact.displayName },
        kind: { enumerable: true, value: exact.kind },
        projectId: { enumerable: true, value: exact.projectId },
        sourceNodeId: {
          enumerable: true,
          get: () => {
            accessorReads += 1;
            return "sign-in.email";
          },
        },
        surfaceId: { enumerable: true, value: exact.surfaceId },
      },
    ) as AuthoringComponentSelection;

    expect(
      applyAuthoringInspectorEdit(original, referenceCatalog, REFERENCE_ROUTE, accessorSelection, {
        kind: "set",
        value: "Unread accessor",
        valuePointer: "/label",
      }),
    ).toEqual({ ok: false, reason: "selection-invalid" });
    expect(accessorReads).toBe(0);
    expect(original).toEqual(originalSnapshot);

    let descriptorReads = 0;
    let directReads = 0;
    const selectionProxy = new Proxy<AuthoringComponentSelection>(
      { ...exact },
      {
        get(target, property, receiver) {
          if (property === "sourceNodeId") {
            directReads += 1;
            return "sign-in.submit";
          }
          return Reflect.get(target, property, receiver) as unknown;
        },
        getOwnPropertyDescriptor(target, property) {
          if (property === "sourceNodeId") {
            descriptorReads += 1;
            return {
              configurable: true,
              enumerable: true,
              value: descriptorReads === 1 ? "sign-in.email" : "sign-in.submit",
              writable: true,
            };
          }
          return Reflect.getOwnPropertyDescriptor(target, property);
        },
      },
    );
    const changed = requireEditSuccess(
      applyAuthoringInspectorEdit(original, referenceCatalog, REFERENCE_ROUTE, selectionProxy, {
        kind: "set",
        value: "Captured selection",
        valuePointer: "/label",
      }),
    );

    expect(descriptorReads).toBe(1);
    expect(directReads).toBe(0);
    expect(findEditorNode(changed, "sign-in.email").props).toMatchObject({
      label: "Captured selection",
      value: { $ref: "state.email" },
    });
    expect(findEditorNode(changed, "sign-in.submit").props?.label).toBe("Sign in");
  });

  it("mutates the validator-admitted Source snapshot when a hostile document Proxy drifts", () => {
    const admitted = requireReferenceDocument();
    const firstSnapshot = copyJson(admitted);
    const driftedSnapshot = copyJson(admitted);
    const driftedSurfaces = requireRecord(
      requireRecord(driftedSnapshot, "drifted source").surfaces,
      "drifted surfaces",
    );
    const driftedSignIn = requireRecord(driftedSurfaces["sign-in"], "drifted sign-in");
    const driftedRoot = requireRecord(driftedSignIn.root, "drifted root");
    const driftedSlots = requireRecord(driftedRoot.slots, "drifted slots");
    const driftedChildren = driftedSlots.default;
    if (!Array.isArray(driftedChildren)) throw new TypeError("Expected drifted default children.");
    const driftedTitle = requireRecord(driftedChildren[0], "drifted title");
    requireRecord(driftedTitle.props, "drifted title props").text = "Hostile second snapshot";

    let snapshotReads = 0;
    let activeSnapshot = firstSnapshot as unknown as object;
    const hostileDocument = new Proxy(firstSnapshot as unknown as DesenEditorDocument, {
      getOwnPropertyDescriptor(_target, property) {
        return Object.getOwnPropertyDescriptor(activeSnapshot, property);
      },
      ownKeys() {
        snapshotReads += 1;
        activeSnapshot = (snapshotReads === 1
          ? firstSnapshot
          : driftedSnapshot) as unknown as object;
        return Reflect.ownKeys(activeSnapshot);
      },
    });
    const selection = selectionFor(REFERENCE_AUTHORING_MODEL, "sign-in.email");
    const changed = requireEditSuccess(
      applyAuthoringInspectorEdit(hostileDocument, referenceCatalog, REFERENCE_ROUTE, selection, {
        kind: "set",
        value: "Snapshot label",
        valuePointer: "/label",
      }),
    );

    expect(snapshotReads).toBe(1);
    expect(findEditorNode(changed, "sign-in.title").props?.text).toBe("Sign in");
    expect(findEditorNode(changed, "sign-in.email").props).toMatchObject({
      label: "Snapshot label",
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
        valuePointer: "/label",
        value: "Forged route",
      }),
    ).toEqual({ ok: false, reason: "selection-invalid" });
    expect(
      applyAuthoringInspectorEdit(original, referenceCatalog, REFERENCE_ROUTE, forged, {
        kind: "set",
        valuePointer: "/label",
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
        valuePointer: "/columns",
        value: 4,
      }),
    );
    expect(findEditorNode(integerChanged, "sign-in.layout").props?.columns).toBe(4);
    expect(
      applyAuthoringInspectorEdit(integerChanged, catalog, REFERENCE_ROUTE, selection, {
        kind: "set",
        valuePointer: "/columns",
        value: 4.5,
      }),
    ).toEqual({ ok: false, reason: "value-invalid" });

    const enumChanged = requireEditSuccess(
      applyAuthoringInspectorEdit(integerChanged, catalog, REFERENCE_ROUTE, selection, {
        kind: "set",
        valuePointer: "/mode",
        value: 2,
      }),
    );
    expect(findEditorNode(enumChanged, "sign-in.layout").props?.mode).toBe(2);
    expect(
      applyAuthoringInspectorEdit(enumChanged, catalog, REFERENCE_ROUTE, selection, {
        kind: "set",
        valuePointer: "/mode",
        value: "2",
      }),
    ).toEqual({ ok: false, reason: "value-invalid" });
  });

  it("derives nested closed-object groups and edits RFC 6901-escaped child pointers", () => {
    const propsSchema = JSON.parse(`{
      "type": "object",
      "additionalProperties": false,
      "required": ["profile/a~b"],
      "properties": {
        "profile/a~b": {
          "title": "Profile",
          "type": "object",
          "additionalProperties": false,
          "required": ["display/name~raw"],
          "properties": {
            "display/name~raw": { "title": "Display name", "type": "string" },
            "age": { "type": "integer" },
            "note": { "type": "string" }
          }
        }
      }
    }`) as unknown;
    const props = JSON.parse(`{
      "profile/a~b": {
        "display/name~raw": "Ada",
        "age": 30,
        "note": "Original"
      }
    }`) as unknown;
    const { catalog, document, model, selection } = createSyntheticInspectorFixture(
      propsSchema,
      props,
    );
    const originalSnapshot = copyJson(document);
    const inspector = requireInspector(model, selection, SYNTHETIC_ROUTE);
    const group = inspector.fields.find(({ control }) => control.valuePointer === "/profile~1a~0b");

    expect(inspector.controlCount).toBe(4);
    expect(group?.control).toMatchObject({
      kind: "group",
      property: "profile/a~b",
      required: true,
      valuePointer: "/profile~1a~0b",
    });
    expect(
      group?.children.map(({ control, qualifiedLabel, value }) => [
        control.property,
        control.valuePointer,
        qualifiedLabel,
        value,
      ]),
    ).toEqual([
      ["age", "/profile~1a~0b/age", "Profile · Age", { kind: "literal", value: 30 }],
      [
        "display/name~raw",
        "/profile~1a~0b/display~1name~0raw",
        "Profile · Display name",
        { kind: "literal", value: "Ada" },
      ],
      ["note", "/profile~1a~0b/note", "Profile · Note", { kind: "literal", value: "Original" }],
    ]);

    const renamed = requireEditSuccess(
      applyAuthoringInspectorEdit(document, catalog, SYNTHETIC_ROUTE, selection, {
        kind: "set",
        value: "Grace",
        valuePointer: "/profile~1a~0b/display~1name~0raw",
      }),
    );
    const noteDeleted = requireEditSuccess(
      applyAuthoringInspectorEdit(renamed, catalog, SYNTHETIC_ROUTE, selection, {
        kind: "delete",
        valuePointer: "/profile~1a~0b/note",
      }),
    );
    expect(findEditorNode(noteDeleted, "fixture.root", "fixture").props).toEqual({
      "profile/a~b": {
        age: 30,
        "display/name~raw": "Grace",
      },
    });
    expect(
      applyAuthoringInspectorEdit(document, catalog, SYNTHETIC_ROUTE, selection, {
        kind: "set",
        value: "Not authorized",
        valuePointer: "/profile~1a~0b/display/name~0raw",
      }),
    ).toEqual({ ok: false, reason: "control-unavailable" });
    expect(document).toEqual(originalSnapshot);
    expect(Object.isFrozen(noteDeleted)).toBe(true);
  });

  it("disambiguates repeated schema titles and names an empty property accessibly", () => {
    const { model, selection } = createSyntheticInspectorFixture(
      {
        additionalProperties: false,
        properties: {
          "": { type: "string" },
          first: { title: "Value", type: "string" },
          second: { title: "Value", type: "string" },
          third: { title: " \t ", type: "string" },
        },
        required: ["", "first", "second", "third"],
        type: "object",
      },
      { "": "empty", first: "one", second: "two", third: "three" },
    );
    const inspector = requireInspector(model, selection, SYNTHETIC_ROUTE);

    expect(
      inspector.fields.map(({ control, label, qualifiedLabel }) => [
        control.valuePointer,
        label,
        qualifiedLabel,
      ]),
    ).toEqual([
      ["/", "Unnamed property", "Unnamed property"],
      ["/first", "Value", "Value (/first)"],
      ["/second", "Value", "Value (/second)"],
      ["/third", "Third", "Third"],
    ]);
  });

  it("creates an absent optional group with one atomic whole-group set", () => {
    const { catalog, document, model, selection } = createSyntheticInspectorFixture(
      {
        additionalProperties: false,
        properties: {
          settings: {
            additionalProperties: false,
            properties: {
              enabled: { type: "boolean" },
              label: { type: "string" },
            },
            required: ["label"],
            type: "object",
          },
        },
        type: "object",
      },
      {},
    );
    const originalSnapshot = copyJson(document);
    const settings = requireInspector(model, selection, SYNTHETIC_ROUTE).fields.find(
      ({ control }) => control.valuePointer === "/settings",
    );

    expect(settings?.control).toMatchObject({
      kind: "group",
      required: false,
      valuePointer: "/settings",
    });
    expect(settings?.value).toEqual({ kind: "absent" });
    expect(settings?.children).toEqual([]);
    expect(
      applyAuthoringInspectorEdit(document, catalog, SYNTHETIC_ROUTE, selection, {
        kind: "set",
        value: { enabled: true },
        valuePointer: "/settings",
      }),
    ).toEqual({ ok: false, reason: "source-invalid" });
    expect(document).toEqual(originalSnapshot);

    const changed = requireEditSuccess(
      applyAuthoringInspectorEdit(document, catalog, SYNTHETIC_ROUTE, selection, {
        kind: "set",
        value: { enabled: true, label: "Ready" },
        valuePointer: "/settings",
      }),
    );
    expect(findEditorNode(changed, "fixture.root", "fixture").props).toEqual({
      settings: { enabled: true, label: "Ready" },
    });
    expect(document).toEqual(originalSnapshot);
  });

  it("edits a structured-JSON property while rejecting dynamic marker injection", () => {
    const { catalog, document, model, selection } = createSyntheticInspectorFixture(
      {
        additionalProperties: false,
        properties: {
          payload: { items: { type: "string" }, type: "array" },
          title: { type: "string" },
        },
        required: ["title"],
        type: "object",
      },
      { payload: ["one"], title: "Fixture" },
    );
    const originalSnapshot = copyJson(document);
    const payload = requireInspector(model, selection, SYNTHETIC_ROUTE).fields.find(
      ({ control }) => control.valuePointer === "/payload",
    );

    expect(payload?.control).toMatchObject({
      fallbackReason: "array",
      kind: "structured-json",
      valuePointer: "/payload",
    });
    expect(payload?.value).toEqual({ kind: "structured", value: ["one"] });

    const changed = requireEditSuccess(
      applyAuthoringInspectorEdit(document, catalog, SYNTHETIC_ROUTE, selection, {
        kind: "set",
        value: ["one", "two"],
        valuePointer: "/payload",
      }),
    );
    expect(findEditorNode(changed, "fixture.root", "fixture").props?.payload).toEqual([
      "one",
      "two",
    ]);
    expect(
      applyAuthoringInspectorEdit(document, catalog, SYNTHETIC_ROUTE, selection, {
        kind: "set",
        value: [{ $ref: "state.secret" }],
        valuePointer: "/payload",
      }),
    ).toEqual({ ok: false, reason: "control-unavailable" });
    expect(document).toEqual(originalSnapshot);
  });

  it("replaces all props through an honest root structured-JSON fallback", () => {
    const { catalog, document, model, selection } = createSyntheticInspectorFixture(
      {
        properties: { label: { type: "string" } },
        type: "object",
      },
      { keep: true, label: "Before" },
    );
    const originalSnapshot = copyJson(document);
    const inspector = requireInspector(model, selection, SYNTHETIC_ROUTE);

    expect(inspector.fields).toHaveLength(1);
    expect(inspector.fields[0]?.control).toEqual({
      fallbackReason: "open-object",
      kind: "structured-json",
      property: null,
      required: true,
      schemaPointer: "/propsSchema",
      valuePointer: "",
    });
    expect(inspector.fields[0]?.value).toEqual({
      kind: "structured",
      value: { keep: true, label: "Before" },
    });

    const changed = requireEditSuccess(
      applyAuthoringInspectorEdit(document, catalog, SYNTHETIC_ROUTE, selection, {
        kind: "set",
        value: { count: 2, label: "After" },
        valuePointer: "",
      }),
    );
    expect(findEditorNode(changed, "fixture.root", "fixture").props).toEqual({
      count: 2,
      label: "After",
    });

    const normalizedNoOp = requireEditSuccess(
      applyAuthoringInspectorEdit(document, catalog, SYNTHETIC_ROUTE, selection, {
        kind: "set",
        value: { label: "Before", keep: true },
        valuePointer: "",
      }),
    );
    expect(findEditorNode(normalizedNoOp, "fixture.root", "fixture").props).toEqual({
      keep: true,
      label: "Before",
    });
    expect(
      applyAuthoringInspectorEdit(document, catalog, SYNTHETIC_ROUTE, selection, {
        kind: "set",
        value: ["not", "props"],
        valuePointer: "",
      }),
    ).toEqual({ ok: false, reason: "edit-rejected" });
    expect(document).toEqual(originalSnapshot);
  });

  it("replaces disjoint near-limit root props without exceeding the private transition budget", () => {
    const editorByteLimit = 8_388_608;
    const payloadLength = 4_300_000;
    const oldPayload = "a".repeat(payloadLength);
    const nextPayload = "b".repeat(payloadLength);
    const { catalog, document, selection } = createSyntheticInspectorFixture(
      { type: "object" },
      { oldPayload },
    );
    const transientUnion = copyJson(document);
    const transientSurfaces = requireRecord(
      requireRecord(transientUnion, "transient source").surfaces,
      "transient surfaces",
    );
    const transientSurface = requireRecord(transientSurfaces.fixture, "transient fixture");
    const transientRoot = requireRecord(transientSurface.root, "transient root");
    requireRecord(transientRoot.props, "transient props").nextPayload = nextPayload;

    expect(canonicalizeJsonBytes(document).byteLength).toBeLessThan(editorByteLimit);
    expect(canonicalizeJsonBytes(transientUnion).byteLength).toBeGreaterThan(editorByteLimit);

    const changed = requireEditSuccess(
      applyAuthoringInspectorEdit(document, catalog, SYNTHETIC_ROUTE, selection, {
        kind: "set",
        value: { nextPayload },
        valuePointer: "",
      }),
    );
    const changedProps = findEditorNode(changed, "fixture.root", "fixture").props ?? {};
    expect(canonicalizeJsonBytes(changed).byteLength).toBeLessThan(editorByteLimit);
    expect(Object.hasOwn(changedProps, "oldPayload")).toBe(false);
    expect(changedProps.nextPayload).toBe(nextPayload);
  }, 20_000);

  it("shrinks an existing near-limit root prop before adding lexically earlier growth", () => {
    const editorByteLimit = 8_388_608;
    const payloadLength = 4_300_000;
    const oldPayload = "a".repeat(payloadLength);
    const nextPayload = "b".repeat(payloadLength);
    const { catalog, document, selection } = createSyntheticInspectorFixture(
      { type: "object" },
      { z: oldPayload },
    );

    const changed = requireEditSuccess(
      applyAuthoringInspectorEdit(document, catalog, SYNTHETIC_ROUTE, selection, {
        kind: "set",
        value: { a: nextPayload, z: "small" },
        valuePointer: "",
      }),
    );
    const changedProps = findEditorNode(changed, "fixture.root", "fixture").props ?? {};

    expect(canonicalizeJsonBytes(changed).byteLength).toBeLessThan(editorByteLimit);
    expect(changedProps.a).toBe(nextPayload);
    expect(changedProps.z).toBe("small");
  }, 20_000);

  it("counts only changed root props against the synchronous transition budget", () => {
    const stableProps = Object.fromEntries(
      Array.from({ length: 300 }, (_, index) => [`stable-${index}`, index]),
    );
    const { catalog, document, selection } = createSyntheticInspectorFixture(
      { type: "object" },
      { ...stableProps, marker: "before" },
    );

    const changed = requireEditSuccess(
      applyAuthoringInspectorEdit(document, catalog, SYNTHETIC_ROUTE, selection, {
        kind: "set",
        value: { ...stableProps, marker: "after" },
        valuePointer: "",
      }),
    );

    expect(findEditorNode(changed, "fixture.root", "fixture").props?.marker).toBe("after");
  });

  it("rejects a wide root replacement before public per-prop commands can block the UI", () => {
    const { catalog, document, selection } = createSyntheticInspectorFixture(
      { type: "object" },
      {},
    );
    const originalSnapshot = copyJson(document);
    const wideProps = Object.fromEntries(
      Array.from({ length: 257 }, (_, index) => [`property-${index}`, index]),
    );

    expect(
      applyAuthoringInspectorEdit(document, catalog, SYNTHETIC_ROUTE, selection, {
        kind: "set",
        value: wideProps,
        valuePointer: "",
      }),
    ).toEqual({ ok: false, reason: "edit-rejected" });
    expect(document).toEqual(originalSnapshot);
  });

  it("locks only the dynamic child while preserving edits to its literal group sibling", () => {
    const { catalog, document, model, selection } = createSyntheticInspectorFixture(
      {
        additionalProperties: false,
        properties: {
          config: {
            additionalProperties: false,
            properties: {
              label: { type: "string" },
              secret: { type: "string" },
            },
            required: ["label", "secret"],
            type: "object",
          },
        },
        required: ["config"],
        type: "object",
      },
      { config: { label: "Before", secret: { $ref: "state.secret" } } },
      { secret: { initial: "classified", schema: { type: "string" } } },
    );
    const group = requireInspector(model, selection, SYNTHETIC_ROUTE).fields[0];

    expect(group?.control.kind).toBe("group");
    expect(group?.children.map(({ control, value }) => [control.valuePointer, value])).toEqual([
      ["/config/label", { kind: "literal", value: "Before" }],
      ["/config/secret", { kind: "dynamic", reference: "state.secret" }],
    ]);

    const changed = requireEditSuccess(
      applyAuthoringInspectorEdit(document, catalog, SYNTHETIC_ROUTE, selection, {
        kind: "set",
        value: "After",
        valuePointer: "/config/label",
      }),
    );
    expect(findEditorNode(changed, "fixture.root", "fixture").props?.config).toEqual({
      label: "After",
      secret: { $ref: "state.secret" },
    });
    expect(
      applyAuthoringInspectorEdit(changed, catalog, SYNTHETIC_ROUTE, selection, {
        kind: "set",
        value: "exposed",
        valuePointer: "/config/secret",
      }),
    ).toEqual({ ok: false, reason: "control-unavailable" });
    expect(findEditorNode(changed, "fixture.root", "fixture").props?.config).toEqual({
      label: "After",
      secret: { $ref: "state.secret" },
    });
  });

  it("locks whole-group replacement and deletion around an optional dynamic child", () => {
    const { catalog, document, model, selection } = createSyntheticInspectorFixture(
      {
        additionalProperties: false,
        properties: {
          config: {
            additionalProperties: false,
            properties: {
              label: { type: "string" },
              secret: { type: "string" },
            },
            required: ["label", "secret"],
            type: "object",
          },
        },
        type: "object",
      },
      { config: { label: "Before", secret: { $ref: "state.secret" } } },
      { secret: { initial: "classified", schema: { type: "string" } } },
    );
    const group = requireInspector(model, selection, SYNTHETIC_ROUTE).fields[0];
    expect(group?.control).toMatchObject({ kind: "group", required: false });
    expect(group?.containsDynamicValue).toBe(true);

    const literalChanged = requireEditSuccess(
      applyAuthoringInspectorEdit(document, catalog, SYNTHETIC_ROUTE, selection, {
        kind: "set",
        value: "After",
        valuePointer: "/config/label",
      }),
    );
    expect(findEditorNode(literalChanged, "fixture.root", "fixture").props?.config).toEqual({
      label: "After",
      secret: { $ref: "state.secret" },
    });
    expect(
      applyAuthoringInspectorEdit(literalChanged, catalog, SYNTHETIC_ROUTE, selection, {
        kind: "set",
        value: { label: "Replacement", secret: "literal" },
        valuePointer: "/config",
      }),
    ).toEqual({ ok: false, reason: "control-unavailable" });
    expect(
      applyAuthoringInspectorEdit(literalChanged, catalog, SYNTHETIC_ROUTE, selection, {
        kind: "delete",
        valuePointer: "/config",
      }),
    ).toEqual({ ok: false, reason: "control-unavailable" });
    expect(findEditorNode(literalChanged, "fixture.root", "fixture").props?.config).toEqual({
      label: "After",
      secret: { $ref: "state.secret" },
    });
  });

  it("treats __proto__ and constructor as exact JSON property names without pollution", () => {
    const propsSchema = JSON.parse(`{
      "type": "object",
      "additionalProperties": false,
      "required": ["__proto__", "constructor"],
      "properties": {
        "__proto__": { "type": "boolean" },
        "constructor": {
          "type": "object",
          "additionalProperties": false,
          "required": ["prototype"],
          "properties": {
            "__proto__": { "type": "string" },
            "prototype": { "type": "string" }
          }
        }
      }
    }`) as unknown;
    const props = JSON.parse(`{
      "__proto__": true,
      "constructor": { "__proto__": "nested", "prototype": "safe" }
    }`) as unknown;
    const { catalog, document, model, selection } = createSyntheticInspectorFixture(
      propsSchema,
      props,
    );
    const inspector = requireInspector(model, selection, SYNTHETIC_ROUTE);

    expect(inspector.fields.map(({ control }) => [control.property, control.valuePointer])).toEqual(
      [
        ["__proto__", "/__proto__"],
        ["constructor", "/constructor"],
      ],
    );
    expect(inspector.fields[1]?.children.map(({ control }) => control.valuePointer)).toEqual([
      "/constructor/__proto__",
      "/constructor/prototype",
    ]);

    const rootChanged = requireEditSuccess(
      applyAuthoringInspectorEdit(document, catalog, SYNTHETIC_ROUTE, selection, {
        kind: "set",
        value: false,
        valuePointer: "/__proto__",
      }),
    );
    const nestedChanged = requireEditSuccess(
      applyAuthoringInspectorEdit(rootChanged, catalog, SYNTHETIC_ROUTE, selection, {
        kind: "set",
        value: "changed",
        valuePointer: "/constructor/__proto__",
      }),
    );
    const changedProps = findEditorNode(nestedChanged, "fixture.root", "fixture").props ?? {};
    const constructorValue = requireRecord(changedProps["constructor"], "props.constructor");
    expect(Object.hasOwn(changedProps, "__proto__")).toBe(true);
    expect(changedProps["__proto__"]).toBe(false);
    expect(Object.hasOwn(constructorValue, "__proto__")).toBe(true);
    expect(constructorValue["__proto__"]).toBe("changed");
    expect(constructorValue.prototype).toBe("safe");
    expect(({} as { polluted?: unknown }).polluted).toBeUndefined();
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
