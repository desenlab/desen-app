import referenceCatalog from "@desen/reference-catalog-web/catalog.json";
import { createDesenEditorDocument } from "@desen/editor-core";
import { canonicalizeJson } from "@desen/protocol";
import { describe, expect, it } from "vitest";

import officialSignInSource from "../../../examples/sign-in/official-derived.source.desen.json";
import {
  applyAuthoringInputConnection,
  applyAuthoringOperationTriggerConnection,
} from "../src/authoring-connections.js";
import { prepareCatalogAuthoringModel } from "../src/authoring-data.js";
import { createAuthoringComponentSelection } from "../src/authoring-selection.js";

import type { DesenEditorDocument } from "@desen/editor-core";
import type { AuthoringConnectionRoute } from "../src/authoring-connections.js";
import type { AuthoringLayerNode, CatalogAuthoringModel } from "../src/authoring-data.js";
import type { AuthoringComponentSelection } from "../src/authoring-selection.js";

type MutableJsonObject = Record<string, unknown>;
type EditorNode = DesenEditorDocument["surfaces"][string]["root"];

const ROUTE = Object.freeze({
  projectId: "account-app",
  surfaceId: "sign-in",
}) satisfies AuthoringConnectionRoute;

const INPUT_RECIPE = Object.freeze({ stateName: "email" });
const OPERATION_RECIPE = Object.freeze({
  alias: "signIn",
  concurrency: "replace" as const,
  connectLoading: true,
  inputs: Object.freeze([
    Object.freeze({ inputName: "email", stateName: "email" }),
    Object.freeze({ inputName: "password", stateName: "password" }),
  ]),
  operationId: "com.example.auth/signIn",
});

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

function mutableNode(source: MutableJsonObject, nodeId: string): MutableJsonObject {
  const surfaces = record(source.surfaces, "surfaces");
  const surface = record(surfaces[ROUTE.surfaceId], "sign-in");
  const pending = [record(surface.root, "root")];
  while (pending.length > 0) {
    const node = pending.pop();
    if (node === undefined) continue;
    if (node.id === nodeId) return node;
    if (node.slots !== undefined) {
      for (const children of Object.values(record(node.slots, "slots"))) {
        for (const child of array(children, "children")) pending.push(record(child, "child"));
      }
    }
    if (node.behaviors !== undefined) {
      for (const behavior of array(node.behaviors, "behaviors")) {
        const behaviorRecord = record(behavior, "behavior");
        if (behaviorRecord.slots === undefined) continue;
        for (const children of Object.values(record(behaviorRecord.slots, "behavior slots"))) {
          for (const child of array(children, "behavior children")) {
            pending.push(record(child, "behavior child"));
          }
        }
      }
    }
  }
  throw new Error(`Missing ${nodeId}.`);
}

function documentFrom(source: unknown): DesenEditorDocument {
  const admitted = createDesenEditorDocument(source);
  expect(admitted.ok).toBe(true);
  if (!admitted.ok) throw new Error("Expected an Editor Core document.");
  return admitted.document;
}

function modelFor(document: DesenEditorDocument): CatalogAuthoringModel {
  const prepared = prepareCatalogAuthoringModel(referenceCatalog, document);
  expect(prepared.ok).toBe(true);
  if (!prepared.ok) throw new Error(`Expected a model, received ${prepared.reason}.`);
  return prepared.model;
}

function findLayer(model: CatalogAuthoringModel, nodeId: string): AuthoringLayerNode {
  const surface = model.surfaces.find(({ id }) => id === ROUTE.surfaceId);
  if (surface === undefined) throw new Error("Missing sign-in surface.");
  const pending = [surface.root];
  while (pending.length > 0) {
    const node = pending.pop();
    if (node === undefined) continue;
    if (node.id === nodeId) return node;
    for (const slot of node.slots) pending.push(...slot.children);
    for (const behavior of node.behaviors) {
      for (const slot of behavior.slots) pending.push(...slot.children);
    }
  }
  throw new Error(`Missing authoring layer ${nodeId}.`);
}

function selectionFor(document: DesenEditorDocument, nodeId: string): AuthoringComponentSelection {
  const node = findLayer(modelFor(document), nodeId);
  return createAuthoringComponentSelection({
    projectId: ROUTE.projectId,
    surfaceId: ROUTE.surfaceId,
    sourceNodeId: node.id,
    capabilityId: node.capabilityId,
    displayName: node.displayName,
    conditional: node.conditional,
  });
}

function findNode(document: DesenEditorDocument, nodeId: string): EditorNode {
  const surface = document.surfaces[ROUTE.surfaceId];
  if (surface === undefined) throw new Error("Missing sign-in surface.");
  const pending = [surface.root];
  while (pending.length > 0) {
    const node = pending.pop();
    if (node === undefined) continue;
    if (node.id === nodeId) return node;
    for (const children of Object.values(node.slots ?? {})) pending.push(...children);
    for (const behavior of node.behaviors ?? []) {
      for (const children of Object.values(behavior.slots ?? {})) pending.push(...children);
    }
  }
  throw new Error(`Missing Editor node ${nodeId}.`);
}

function disconnectedInputSource(): MutableJsonObject {
  const source = copyJson(officialSignInSource) as MutableJsonObject;
  const email = mutableNode(source, "sign-in.email");
  record(email.props, "email props").value = "";
  email.on = {
    change: [{ type: "state.set", path: "password", value: { $ref: "event.value" } }],
  };
  return source;
}

function disconnectedOperationSource(): MutableJsonObject {
  const source = copyJson(officialSignInSource) as MutableJsonObject;
  const submit = mutableNode(source, "sign-in.submit");
  delete record(submit.props, "submit props").loading;
  submit.on = { press: [{ type: "state.set", path: "email", value: "cleared" }] };
  return source;
}

describe("Desen App atomic connection recipes", () => {
  it("connects Value and change as one endpoint while preserving unrelated actions", () => {
    const document = documentFrom(disconnectedInputSource());
    const before = canonicalizeJson(document);
    const result = applyAuthoringInputConnection(
      document,
      referenceCatalog,
      ROUTE,
      selectionFor(document, "sign-in.email"),
      INPUT_RECIPE,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(`Expected input connection, received ${result.reason}.`);
    expect(result.operation).toBe("connect-input");
    expect(canonicalizeJson(document)).toBe(before);
    const email = findNode(result.document, "sign-in.email");
    expect(email.props?.value).toEqual({ $ref: "state.email" });
    expect(email.on?.change).toEqual([
      { type: "state.set", path: "password", value: { $ref: "event.value" } },
      { type: "state.set", path: "email", value: { $ref: "event.value" } },
    ]);
    expect(Object.isFrozen(result.document)).toBe(true);
    expect(modelFor(result.document).validationDocument).toEqual(result.document);

    const repeated = applyAuthoringInputConnection(
      result.document,
      referenceCatalog,
      ROUTE,
      selectionFor(result.document, "sign-in.email"),
      INPUT_RECIPE,
    );
    expect(repeated.ok).toBe(true);
    if (repeated.ok)
      expect(findNode(repeated.document, "sign-in.email").on?.change).toHaveLength(2);
  });

  it("reconnects by replacing the previous canonical write instead of updating two states", () => {
    const document = documentFrom(officialSignInSource);
    const result = applyAuthoringInputConnection(
      document,
      referenceCatalog,
      ROUTE,
      selectionFor(document, "sign-in.email"),
      { stateName: "password" },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(`Expected reconnection, received ${result.reason}.`);
    const email = findNode(result.document, "sign-in.email");
    expect(email.props?.value).toEqual({ $ref: "state.password" });
    expect(email.on?.change).toEqual([
      { type: "state.set", path: "password", value: { $ref: "event.value" } },
    ]);
  });

  it("fails closed on missing, incompatible, conflicting, and malformed input recipes", () => {
    const source = disconnectedInputSource();
    const document = documentFrom(source);
    const selection = selectionFor(document, "sign-in.email");
    expect(
      applyAuthoringInputConnection(document, referenceCatalog, ROUTE, selection, {
        stateName: "missing",
      }),
    ).toEqual({ ok: false, reason: "state-unavailable" });

    const withBoolean = copyJson(source);
    const surface = record(record(withBoolean.surfaces, "surfaces")["sign-in"], "sign-in");
    record(surface.state, "state").flag = { schema: { type: "boolean" }, initial: false };
    const booleanDocument = documentFrom(withBoolean);
    const incompatible = applyAuthoringInputConnection(
      booleanDocument,
      referenceCatalog,
      ROUTE,
      selectionFor(booleanDocument, "sign-in.email"),
      { stateName: "flag" },
    );
    expect(incompatible).toEqual({ ok: false, reason: "connection-incompatible" });
    expect(incompatible).not.toHaveProperty("document");

    const incompatibleEventCatalog = copyJson(referenceCatalog) as MutableJsonObject;
    const textField = record(
      record(incompatibleEventCatalog.components, "components")["com.example.ui/TextField"],
      "TextField",
    );
    const changeEvent = record(record(textField.events, "events").change, "change");
    const payloadSchema = record(changeEvent.payloadSchema, "payload schema");
    record(record(payloadSchema.properties, "properties").value, "value schema").type = "boolean";
    const incompatibleEventSource = disconnectedInputSource();
    delete mutableNode(incompatibleEventSource, "sign-in.email").on;
    const incompatibleEventDocument = documentFrom(incompatibleEventSource);
    expect(
      applyAuthoringInputConnection(
        incompatibleEventDocument,
        incompatibleEventCatalog,
        ROUTE,
        selectionFor(incompatibleEventDocument, "sign-in.email"),
        INPUT_RECIPE,
      ),
    ).toEqual({ ok: false, reason: "connection-incompatible" });

    const conflictingSource = disconnectedInputSource();
    mutableNode(conflictingSource, "sign-in.email").on = {
      change: [{ type: "state.set", path: "email", value: "forced" }],
    };
    const conflictingDocument = documentFrom(conflictingSource);
    expect(
      applyAuthoringInputConnection(
        conflictingDocument,
        referenceCatalog,
        ROUTE,
        selectionFor(conflictingDocument, "sign-in.email"),
        INPUT_RECIPE,
      ),
    ).toEqual({ ok: false, reason: "connection-conflict" });

    let reads = 0;
    const hostile = Object.defineProperty({}, "stateName", {
      enumerable: true,
      get() {
        reads += 1;
        return "email";
      },
    });
    expect(
      applyAuthoringInputConnection(
        document,
        referenceCatalog,
        ROUTE,
        selection,
        hostile as { readonly stateName: string },
      ),
    ).toEqual({ ok: false, reason: "recipe-invalid" });
    expect(reads).toBe(0);
  });

  it("connects press, mapped state inputs, and loading without exposing intermediates", () => {
    const document = documentFrom(disconnectedOperationSource());
    const before = canonicalizeJson(document);
    const result = applyAuthoringOperationTriggerConnection(
      document,
      referenceCatalog,
      ROUTE,
      selectionFor(document, "sign-in.submit"),
      OPERATION_RECIPE,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(`Expected operation connection, received ${result.reason}.`);
    expect(result.operation).toBe("connect-operation-trigger");
    expect(canonicalizeJson(document)).toBe(before);
    const submit = findNode(result.document, "sign-in.submit");
    expect(submit.props?.loading).toEqual({
      $ref: "operation.signIn.pending",
      fallback: false,
    });
    expect(submit.on?.press).toEqual([
      { type: "state.set", path: "email", value: "cleared" },
      {
        type: "operation.invoke",
        operation: "com.example.auth/signIn",
        as: "signIn",
        input: {
          email: { $ref: "state.email" },
          password: { $ref: "state.password" },
        },
        concurrency: "replace",
      },
    ]);

    const repeated = applyAuthoringOperationTriggerConnection(
      result.document,
      referenceCatalog,
      ROUTE,
      selectionFor(result.document, "sign-in.submit"),
      OPERATION_RECIPE,
    );
    expect(repeated.ok).toBe(true);
    if (repeated.ok)
      expect(findNode(repeated.document, "sign-in.submit").on?.press).toHaveLength(2);
  });

  it("round-trips reject concurrency on append and rejects unknown policy atomically", () => {
    const document = documentFrom(disconnectedOperationSource());
    const before = canonicalizeJson(document);
    const selection = selectionFor(document, "sign-in.submit");
    const appended = applyAuthoringOperationTriggerConnection(
      document,
      referenceCatalog,
      ROUTE,
      selection,
      { ...OPERATION_RECIPE, concurrency: "reject" },
    );

    expect(appended.ok).toBe(true);
    if (!appended.ok) throw new Error(`Expected operation append, received ${appended.reason}.`);
    expect(findNode(appended.document, "sign-in.submit").on?.press?.at(-1)).toMatchObject({
      type: "operation.invoke",
      concurrency: "reject",
    });
    expect(canonicalizeJson(document)).toBe(before);

    const forged = applyAuthoringOperationTriggerConnection(
      document,
      referenceCatalog,
      ROUTE,
      selection,
      { ...OPERATION_RECIPE, concurrency: "parallel" as never },
    );
    expect(forged).toEqual({ ok: false, reason: "recipe-invalid" });
    expect(forged).not.toHaveProperty("document");
    expect(canonicalizeJson(document)).toBe(before);
  });

  it("rejects incomplete operation mappings atomically", () => {
    const document = documentFrom(disconnectedOperationSource());
    const incomplete = applyAuthoringOperationTriggerConnection(
      document,
      referenceCatalog,
      ROUTE,
      selectionFor(document, "sign-in.submit"),
      {
        ...OPERATION_RECIPE,
        inputs: [{ inputName: "email", stateName: "email" }],
      },
    );
    expect(incomplete).toEqual({ ok: false, reason: "connection-incompatible" });
    expect(incomplete).not.toHaveProperty("document");

    const mismatchedSource = disconnectedOperationSource();
    const surface = record(record(mismatchedSource.surfaces, "surfaces")["sign-in"], "sign-in");
    record(surface.state, "state").flag = { schema: { type: "boolean" }, initial: false };
    const mismatchedDocument = documentFrom(mismatchedSource);
    const mismatched = applyAuthoringOperationTriggerConnection(
      mismatchedDocument,
      referenceCatalog,
      ROUTE,
      selectionFor(mismatchedDocument, "sign-in.submit"),
      {
        ...OPERATION_RECIPE,
        inputs: [
          { inputName: "email", stateName: "email" },
          { inputName: "password", stateName: "flag" },
        ],
      },
    );
    expect(mismatched).toEqual({ ok: false, reason: "connection-incompatible" });
    expect(mismatched).not.toHaveProperty("document");

    const accessorInputs: unknown[] = [];
    Object.defineProperty(accessorInputs, "0", {
      enumerable: true,
      get() {
        throw new Error("must not read operation input accessors");
      },
    });
    expect(
      applyAuthoringOperationTriggerConnection(
        document,
        referenceCatalog,
        ROUTE,
        selectionFor(document, "sign-in.submit"),
        { ...OPERATION_RECIPE, inputs: accessorInputs as never },
      ),
    ).toEqual({ ok: false, reason: "recipe-invalid" });
  });

  it("repairs one root invocation in place while preserving branches, guards, and extensions", () => {
    const source = copyJson(officialSignInSource) as MutableJsonObject;
    const layout = mutableNode(source, "sign-in.layout");
    const slots = record(layout.slots, "layout slots");
    slots.default = array(slots.default, "layout default").filter(
      (child) => record(child, "layout child").id !== "sign-in.error",
    );
    const submit = mutableNode(source, "sign-in.submit");
    const press = array(record(submit.on, "submit on").press, "submit press");
    const invocation = record(press[0], "submit invocation");
    invocation.onFailure = [{ type: "state.set", path: "email", value: "failed" }];
    invocation.when = { op: "eq", args: [true, true] };
    invocation.extensions = { "com.example.action": { retained: true } };
    record(submit.on, "submit on").press = [
      { type: "state.set", path: "email", value: "before" },
      invocation,
      { type: "state.set", path: "password", value: "after" },
    ];
    const document = documentFrom(source);
    const before = canonicalizeJson(document);
    const catalog = copyJson(referenceCatalog) as MutableJsonObject;
    const operations = record(catalog.operations, "operations");
    operations["com.example.auth/recover"] = copyJson(operations["com.example.auth/signIn"]);

    const result = applyAuthoringOperationTriggerConnection(
      document,
      catalog,
      ROUTE,
      selectionFor(document, "sign-in.submit"),
      {
        ...OPERATION_RECIPE,
        alias: "recover",
        concurrency: "reject",
        operationId: "com.example.auth/recover",
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(`Expected operation repair, received ${result.reason}.`);
    expect(canonicalizeJson(document)).toBe(before);
    const repaired = findNode(result.document, "sign-in.submit");
    expect(repaired.props?.loading).toEqual({
      $ref: "operation.recover.pending",
      fallback: false,
    });
    expect(repaired.on?.press).toEqual([
      { type: "state.set", path: "email", value: "before" },
      {
        type: "operation.invoke",
        operation: "com.example.auth/recover",
        as: "recover",
        input: {
          email: { $ref: "state.email" },
          password: { $ref: "state.password" },
        },
        concurrency: "reject",
        onSuccess: [{ type: "navigate", surface: "home" }],
        onFailure: [{ type: "state.set", path: "email", value: "failed" }],
        when: { op: "eq", args: [true, true] },
        extensions: { "com.example.action": { retained: true } },
      },
      { type: "state.set", path: "password", value: "after" },
    ]);
  });

  it("rejects multiple ambiguous root invocations without exposing a candidate", () => {
    const source = copyJson(officialSignInSource) as MutableJsonObject;
    const submit = mutableNode(source, "sign-in.submit");
    const press = array(record(submit.on, "submit on").press, "submit press");
    press.push({
      type: "operation.invoke",
      operation: "com.example.auth/signIn",
      as: "backupSignIn",
      input: {
        email: { $ref: "state.email" },
        password: { $ref: "state.password" },
      },
      concurrency: "queue",
    });
    const document = documentFrom(source);
    const before = canonicalizeJson(document);

    const result = applyAuthoringOperationTriggerConnection(
      document,
      referenceCatalog,
      ROUTE,
      selectionFor(document, "sign-in.submit"),
      { ...OPERATION_RECIPE, alias: "authenticate", concurrency: "reject" },
    );

    expect(result).toEqual({ ok: false, reason: "connection-conflict" });
    expect(result).not.toHaveProperty("document");
    expect(canonicalizeJson(document)).toBe(before);
  });

  it("requires exact structured schema identity for operation input mappings", () => {
    const structuredSource = disconnectedOperationSource();
    const surface = record(record(structuredSource.surfaces, "surfaces")["sign-in"], "sign-in");
    const objectSchema = {
      additionalProperties: false,
      properties: { token: { type: "string" } },
      required: ["token"],
      type: "object",
    };
    record(surface.state, "state").payload = {
      schema: objectSchema,
      initial: { token: "fixture-token" },
    };
    const document = documentFrom(structuredSource);
    const recipe = {
      ...OPERATION_RECIPE,
      inputs: [
        { inputName: "email", stateName: "email" },
        { inputName: "password", stateName: "payload" },
      ],
    };

    const matchingCatalog = copyJson(referenceCatalog) as MutableJsonObject;
    const matchingOperation = record(
      record(matchingCatalog.operations, "operations")["com.example.auth/signIn"],
      "signIn",
    );
    const matchingInput = record(matchingOperation.inputSchema, "inputSchema");
    record(matchingInput.properties, "properties").password = objectSchema;
    const accepted = applyAuthoringOperationTriggerConnection(
      document,
      matchingCatalog,
      ROUTE,
      selectionFor(document, "sign-in.submit"),
      recipe,
    );
    expect(accepted.ok).toBe(true);

    const arrayCatalog = copyJson(matchingCatalog);
    const arrayOperation = record(
      record(arrayCatalog.operations, "operations")["com.example.auth/signIn"],
      "signIn",
    );
    const arrayInput = record(arrayOperation.inputSchema, "inputSchema");
    record(arrayInput.properties, "properties").password = {
      items: { type: "string" },
      type: "array",
    };
    expect(
      applyAuthoringOperationTriggerConnection(
        document,
        arrayCatalog,
        ROUTE,
        selectionFor(document, "sign-in.submit"),
        recipe,
      ),
    ).toEqual({ ok: false, reason: "connection-incompatible" });
  });
});
