// @vitest-environment jsdom
import referenceCatalog from "@desen/reference-catalog-web/catalog.json";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { applyAuthoringOperationTriggerConnection } from "../src/authoring-connections.js";
import { prepareCatalogAuthoringModel } from "../src/authoring-data.js";
import { prepareAuthoringInspectorModel } from "../src/authoring-inspector.js";
import { createAuthoringComponentSelection } from "../src/authoring-selection.js";
import {
  InputConnectionControl,
  OperationConnectionControl,
  VisibilityControl,
} from "../src/behavior-controls.js";
import {
  createAuthoringEventOwnerSelection,
  prepareAuthoringEventActionModel,
} from "../src/authoring-event-actions.js";
import {
  REFERENCE_AUTHORING_MODEL,
  REFERENCE_EDITOR_DOCUMENT,
} from "../src/reference-authoring-profile.js";

import type {
  AuthoringConditionEdit,
  AuthoringConditionEditResult,
} from "../src/authoring-conditions.js";
import type { JsonValue } from "@desen/catalog-sdk";
import type { DesenEditorDocument } from "@desen/editor-core";
import type { AuthoringOperationTriggerConnectionRecipe } from "../src/authoring-connections.js";
import type { CatalogAuthoringModel } from "../src/authoring-data.js";

const ROUTE = Object.freeze({ projectId: "account-app", surfaceId: "sign-in" });
const SIGN_IN_OPERATION_ALIASES = Object.freeze([
  Object.freeze({ alias: "signIn", operationId: "com.example.auth/signIn" }),
]);

function emailInspector() {
  const model = prepareAuthoringInspectorModel(
    REFERENCE_AUTHORING_MODEL,
    ROUTE,
    createAuthoringComponentSelection({
      projectId: ROUTE.projectId,
      surfaceId: ROUTE.surfaceId,
      sourceNodeId: "sign-in.email",
      capabilityId: "com.example.ui/TextField",
      displayName: "Text field",
      conditional: false,
    }),
  );
  if (model.status !== "ready") throw new Error("Expected ready inspector model.");
  return model;
}

function submitInspector(model: CatalogAuthoringModel = REFERENCE_AUTHORING_MODEL) {
  const inspector = prepareAuthoringInspectorModel(
    model,
    ROUTE,
    createAuthoringComponentSelection({
      projectId: ROUTE.projectId,
      surfaceId: ROUTE.surfaceId,
      sourceNodeId: "sign-in.submit",
      capabilityId: "com.example.ui/Button",
      displayName: "Button",
      conditional: false,
    }),
  );
  if (inspector.status !== "ready") throw new Error("Expected ready Button inspector model.");
  return inspector;
}

function submitEventModel(model: CatalogAuthoringModel = REFERENCE_AUTHORING_MODEL) {
  const events = prepareAuthoringEventActionModel(
    model,
    ROUTE,
    createAuthoringEventOwnerSelection({
      projectId: ROUTE.projectId,
      surfaceId: ROUTE.surfaceId,
      ownerKind: "component",
      ownerId: "sign-in.submit",
      capabilityId: "com.example.ui/Button",
      displayName: "Button",
      conditional: false,
    }),
  );
  if (events.status !== "ready") throw new Error("Expected ready Button event model.");
  return events;
}

function modelFor(document: DesenEditorDocument): CatalogAuthoringModel {
  const result = prepareCatalogAuthoringModel(referenceCatalog, document);
  if (!result.ok) throw new Error(`Expected ready authoring model, received ${result.reason}.`);
  return result.model;
}

function editableSubmitOperationModel() {
  const model = structuredClone(submitEventModel());
  const press = model.events.find(({ event }) => event === "press");
  const action = press?.actionList.actions[0]?.action;
  if (action?.type !== "operation.invoke") throw new Error("Expected submit operation action.");
  return { action, model };
}

function disconnectedSubmitModel(): CatalogAuthoringModel {
  const document = structuredClone(REFERENCE_EDITOR_DOCUMENT);
  const submit = document.surfaces["sign-in"]?.root.slots?.default?.find(
    ({ id }) => id === "sign-in.submit",
  );
  if (submit === undefined) throw new Error("Expected submit node.");
  const mutableSubmit = submit as unknown as {
    on?: typeof submit.on;
    props?: Record<string, JsonValue>;
  };
  delete mutableSubmit.on;
  if (mutableSubmit.props !== undefined) delete mutableSubmit.props.loading;
  return modelFor(document);
}

describe("Desen App no-code behavior controls", () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  });

  afterEach(() => {
    cleanup();
    document.body.replaceChildren();
  });

  it("offers one atomic controlled-input connection instead of two manual edits", () => {
    const inspector = emailInspector();
    const onConnect = vi.fn(() =>
      Object.freeze({
        ok: true as const,
        operation: "connect-input" as const,
        document: REFERENCE_EDITOR_DOCUMENT,
      }),
    );
    render(
      <InputConnectionControl
        connectedStateName="email"
        inspector={inspector}
        onConnect={onConnect}
      />,
    );

    expect(screen.getByText(/Connects Value to state and writes every change/u)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Input connection state"), {
      target: { value: "password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Connect input" }));
    expect(onConnect).toHaveBeenCalledWith("password");
    expect(screen.getByRole("status").textContent).toContain(
      "Connected Value and change to state.password",
    );
  });

  it("does not report a value-only half binding as connected", () => {
    render(
      <InputConnectionControl
        connectedStateName={null}
        inspector={emailInspector()}
        onConnect={vi.fn()}
      />,
    );

    expect(screen.getByText("Not connected")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Connect input" })).toBeTruthy();
  });

  it("adopts the first compatible state when one is created while the layer stays selected", () => {
    const inspector = emailInspector();
    const onConnect = vi.fn(() =>
      Object.freeze({
        ok: true as const,
        operation: "connect-input" as const,
        document: REFERENCE_EDITOR_DOCUMENT,
      }),
    );
    const { rerender } = render(
      <InputConnectionControl
        connectedStateName={null}
        inspector={{ ...inspector, localStates: [] }}
        onConnect={onConnect}
      />,
    );

    expect(screen.getByText(/Create a compatible local state/u)).toBeTruthy();
    rerender(
      <InputConnectionControl
        connectedStateName={null}
        inspector={inspector}
        onConnect={onConnect}
      />,
    );

    const stateSelect = screen.getByLabelText("Input connection state") as HTMLSelectElement;
    expect(stateSelect.value).toBe("email");
    fireEvent.click(screen.getByRole("button", { name: "Connect input" }));
    expect(onConnect).toHaveBeenCalledWith("email");
  });

  it("connects press, mapped inputs, concurrency, and Runtime pending as one operation recipe", () => {
    let document = REFERENCE_EDITOR_DOCUMENT;
    const onConnect = vi.fn((recipe: AuthoringOperationTriggerConnectionRecipe) => {
      const result = applyAuthoringOperationTriggerConnection(
        document,
        referenceCatalog,
        ROUTE,
        submitInspector(modelFor(document)).selection,
        recipe,
      );
      if (result.ok) document = result.document;
      return result;
    });
    const { rerender } = render(
      <OperationConnectionControl
        inspector={submitInspector()}
        model={submitEventModel()}
        onConnect={onConnect}
        operationAliases={SIGN_IN_OPERATION_ALIASES}
      />,
    );

    expect(screen.getByText("Connected")).toBeTruthy();
    expect(
      (screen.getByLabelText("Operation connection Catalog operation") as HTMLSelectElement).value,
    ).toBe("com.example.auth/signIn");
    expect((screen.getByLabelText(/Operation connection email/iu) as HTMLSelectElement).value).toBe(
      "email",
    );
    expect(
      (screen.getByLabelText(/Operation connection password/iu) as HTMLSelectElement).value,
    ).toBe("password");
    expect(
      (screen.getByLabelText("Operation connection concurrency") as HTMLSelectElement).value,
    ).toBe("replace");
    fireEvent.change(screen.getByLabelText("Operation connection concurrency"), {
      target: { value: "reject" },
    });
    fireEvent.change(screen.getByLabelText("Operation connection result name"), {
      target: { value: "signIn" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Repair operation" }));

    expect(onConnect).toHaveBeenCalledWith({
      alias: "signIn",
      concurrency: "reject",
      connectLoading: true,
      inputs: [
        { inputName: "email", stateName: "email" },
        { inputName: "password", stateName: "password" },
      ],
      operationId: "com.example.auth/signIn",
    });
    const repairedModel = modelFor(document);
    rerender(
      <OperationConnectionControl
        inspector={submitInspector(repairedModel)}
        model={submitEventModel(repairedModel)}
        onConnect={onConnect}
        operationAliases={SIGN_IN_OPERATION_ALIASES}
      />,
    );
    expect(
      (screen.getByLabelText("Operation connection result name") as HTMLInputElement).value,
    ).toBe("signIn");
    expect(
      (screen.getByLabelText("Operation connection concurrency") as HTMLSelectElement).value,
    ).toBe("reject");
    expect(screen.getByRole("status").textContent).toContain(
      "Connected Press, operation.signIn, and Loading pending.",
    );
  });

  it("resets a same-owner draft and stale notice after an external operation edit", () => {
    const onConnect = vi.fn(() =>
      Object.freeze({ ok: false as const, reason: "connection-conflict" as const }),
    );
    const { rerender } = render(
      <OperationConnectionControl
        inspector={submitInspector()}
        model={submitEventModel()}
        onConnect={onConnect}
        operationAliases={SIGN_IN_OPERATION_ALIASES}
      />,
    );

    fireEvent.change(screen.getByLabelText("Operation connection result name"), {
      target: { value: "draftAlias" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Repair operation" }));
    expect(screen.getByRole("status").textContent).toContain("conflicting operation");

    const external = applyAuthoringOperationTriggerConnection(
      REFERENCE_EDITOR_DOCUMENT,
      referenceCatalog,
      ROUTE,
      submitInspector().selection,
      {
        alias: "signIn",
        concurrency: "queue",
        connectLoading: true,
        inputs: [
          { inputName: "email", stateName: "email" },
          { inputName: "password", stateName: "password" },
        ],
        operationId: "com.example.auth/signIn",
      },
    );
    expect(external.ok).toBe(true);
    if (!external.ok) throw new Error(`Expected external edit, received ${external.reason}.`);
    const externalModel = modelFor(external.document);
    rerender(
      <OperationConnectionControl
        inspector={submitInspector(externalModel)}
        model={submitEventModel(externalModel)}
        onConnect={onConnect}
        operationAliases={SIGN_IN_OPERATION_ALIASES}
      />,
    );

    expect(
      (screen.getByLabelText("Operation connection result name") as HTMLInputElement).value,
    ).toBe("signIn");
    expect(
      (screen.getByLabelText("Operation connection concurrency") as HTMLSelectElement).value,
    ).toBe("queue");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("suggests a surface-unique alias and rejects a manually reserved result name", () => {
    const model = disconnectedSubmitModel();
    const onConnect = vi.fn();
    render(
      <OperationConnectionControl
        inspector={submitInspector(model)}
        model={submitEventModel(model)}
        onConnect={onConnect}
        operationAliases={SIGN_IN_OPERATION_ALIASES}
      />,
    );

    const alias = screen.getByLabelText("Operation connection result name") as HTMLInputElement;
    expect(alias.value).toBe("signIn-2");
    fireEvent.change(alias, { target: { value: "signIn" } });
    expect(screen.getByRole("alert").textContent).toContain("already used on this surface");
    const connect = screen.getByRole("button", { name: "Connect operation" });
    expect((connect as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(connect);
    expect(onConnect).not.toHaveBeenCalled();

    fireEvent.change(alias, { target: { value: "authenticate" } });
    expect(screen.queryByRole("alert")).toBeNull();
    expect((connect as HTMLButtonElement).disabled).toBe(false);
  });

  it("requires an explicit state when a new operation input has no exact-name match", () => {
    const authoringModel = disconnectedSubmitModel();
    const model = structuredClone(submitEventModel(authoringModel));
    const operation = model.referenceOptions.operations[0];
    const fields = operation?.inputFields as
      NonNullable<typeof operation>["inputFields"][number][] | undefined;
    const passwordIndex = fields?.findIndex(({ value }) => value === "password") ?? -1;
    const passwordField = fields?.[passwordIndex];
    if (fields === undefined || passwordField === undefined || passwordIndex < 0) {
      throw new Error("Expected password operation field.");
    }
    fields[passwordIndex] = { ...passwordField, label: "Secret", value: "secret" };
    const onConnect = vi.fn(() =>
      Object.freeze({
        ok: true as const,
        operation: "connect-operation-trigger" as const,
        document: REFERENCE_EDITOR_DOCUMENT,
      }),
    );
    render(
      <OperationConnectionControl
        inspector={submitInspector(authoringModel)}
        model={model}
        onConnect={onConnect}
        operationAliases={[]}
      />,
    );

    const secret = screen.getByLabelText(/Operation connection Secret/iu) as HTMLSelectElement;
    const connect = screen.getByRole("button", { name: "Connect operation" });
    expect(secret.value).toBe("");
    expect((connect as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(secret, { target: { value: "password" } });
    expect((connect as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(connect);
    expect(onConnect).toHaveBeenCalledWith(
      expect.objectContaining({
        inputs: [
          { inputName: "email", stateName: "email" },
          { inputName: "secret", stateName: "password" },
        ],
      }),
    );
  });

  it("keeps an omitted optional input omitted when repairing", () => {
    const model = structuredClone(submitEventModel());
    const operation = model.referenceOptions.operations[0];
    const template = operation?.inputFields[0];
    if (operation === undefined || template === undefined) {
      throw new Error("Expected sign-in operation fields.");
    }
    (operation.inputFields as unknown as (typeof template)[]).push({
      ...template,
      label: "Note",
      required: false,
      value: "note",
    });
    const onConnect = vi.fn(() =>
      Object.freeze({
        ok: true as const,
        operation: "connect-operation-trigger" as const,
        document: REFERENCE_EDITOR_DOCUMENT,
      }),
    );
    render(
      <OperationConnectionControl
        inspector={submitInspector()}
        model={model}
        onConnect={onConnect}
        operationAliases={SIGN_IN_OPERATION_ALIASES}
      />,
    );

    expect((screen.getByLabelText(/Operation connection Note/iu) as HTMLSelectElement).value).toBe(
      "",
    );
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Repair operation" }));
    expect(onConnect).toHaveBeenCalledWith(
      expect.objectContaining({
        inputs: [
          { inputName: "email", stateName: "email" },
          { inputName: "password", stateName: "password" },
        ],
      }),
    );
  });

  it("requires explicit replacement states before repairing advanced declared inputs", () => {
    const { action, model } = editableSubmitOperationModel();
    const input = action.input as Record<string, JsonValue>;
    input.email = "literal@example.test";
    input.password = { $ref: "event.value" };
    const onConnect = vi.fn(() =>
      Object.freeze({
        ok: true as const,
        operation: "connect-operation-trigger" as const,
        document: REFERENCE_EDITOR_DOCUMENT,
      }),
    );
    render(
      <OperationConnectionControl
        inspector={submitInspector()}
        model={model}
        onConnect={onConnect}
        operationAliases={SIGN_IN_OPERATION_ALIASES}
      />,
    );

    expect(screen.getByRole("alert").textContent).toContain("email, password");
    const repair = screen.getByRole("button", { name: "Repair operation" });
    expect((repair as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Operation connection email/iu), {
      target: { value: "email" },
    });
    fireEvent.change(screen.getByLabelText(/Operation connection password/iu), {
      target: { value: "password" },
    });
    expect(screen.queryByRole("alert")).toBeNull();
    expect((repair as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(repair);
    expect(onConnect).toHaveBeenCalledWith(
      expect.objectContaining({
        inputs: [
          { inputName: "email", stateName: "email" },
          { inputName: "password", stateName: "password" },
        ],
      }),
    );
  });

  it("never drops an additional advanced input that only Actions can represent", () => {
    const { action, model } = editableSubmitOperationModel();
    const input = action.input as Record<string, JsonValue>;
    input.auditContext = { $ref: "state.auditContext" };
    render(
      <OperationConnectionControl
        inspector={submitInspector()}
        model={model}
        onConnect={vi.fn()}
        operationAliases={SIGN_IN_OPERATION_ALIASES}
      />,
    );

    expect(screen.getByRole("alert").textContent).toContain("auditContext");
    expect(
      (screen.getByRole("button", { name: "Repair operation" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("authors an operation-status visibility predicate and can return to always visible", () => {
    const inspector = emailInspector();
    const onEdit = vi.fn((edit: AuthoringConditionEdit): AuthoringConditionEditResult => {
      void edit;
      return Object.freeze({
        ok: true as const,
        operation: "set" as const,
        document: REFERENCE_EDITOR_DOCUMENT,
      });
    });
    const { rerender } = render(
      <VisibilityControl
        currentWhen={null}
        localStates={inspector.localStates}
        onEdit={onEdit}
        operationAliases={[{ alias: "authenticate", operationId: "com.example.auth/signIn" }]}
        ownerId="node.alert"
      />,
    );

    fireEvent.change(screen.getByLabelText("Layer visibility mode"), {
      target: { value: "operation" },
    });
    fireEvent.change(screen.getByLabelText("Visibility operation status"), {
      target: { value: "failed" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply visibility" }));
    expect(onEdit).toHaveBeenLastCalledWith({
      kind: "set",
      when: {
        op: "eq",
        args: [{ $ref: "operation.authenticate.status" }, "failed"],
      },
    });

    onEdit.mockImplementation(() =>
      Object.freeze({
        ok: true as const,
        operation: "clear" as const,
        document: REFERENCE_EDITOR_DOCUMENT,
      }),
    );
    rerender(
      <VisibilityControl
        currentWhen={{
          op: "eq",
          args: [{ $ref: "operation.authenticate.status" }, "failed"],
        }}
        localStates={inspector.localStates}
        onEdit={onEdit}
        operationAliases={[{ alias: "authenticate", operationId: "com.example.auth/signIn" }]}
        ownerId="node.alert"
      />,
    );
    fireEvent.change(screen.getByLabelText("Layer visibility mode"), {
      target: { value: "always" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Make always visible" }));
    expect(onEdit).toHaveBeenLastCalledWith({ kind: "clear" });
  });
});
