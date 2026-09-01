// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EventActionPanel } from "../src/event-action-panel.js";
import { REFERENCE_EDITOR_DOCUMENT } from "../src/authoring-preview.js";

import type {
  AuthoringActionListModel,
  AuthoringActionModel,
  AuthoringEventActionEdit,
  AuthoringEventActionEditFailureReason,
  AuthoringEventActionEditResult,
  AuthoringEventActionModelResult,
  AuthoringEventActionReadyModel,
  AuthoringEventHandlerModel,
  AuthoringOperationActionReferenceOption,
} from "../src/authoring-event-actions.js";

type ModelAction = AuthoringActionModel["action"];

const STRING_SCHEMA_KEY = '{"type":"string"}';
const BOOLEAN_SCHEMA_KEY = '{"type":"boolean"}';

const REFERENCES = Object.freeze({
  states: Object.freeze([
    Object.freeze({
      label: "Email",
      value: "email",
      valueKind: "string",
      schemaKey: STRING_SCHEMA_KEY,
      initialValue: "",
    }),
    Object.freeze({
      label: "Password",
      value: "password",
      valueKind: "string",
      schemaKey: STRING_SCHEMA_KEY,
      initialValue: "",
    }),
  ]),
  surfaces: Object.freeze([Object.freeze({ label: "Home", value: "home" })]),
  operations: Object.freeze([
    Object.freeze({
      label: "Sign in",
      value: "com.example.auth/SignIn",
      description: "Authenticate with current credentials.",
      effect: "network",
      inputFields: Object.freeze([
        Object.freeze({
          label: "Email",
          value: "email",
          valueKind: "string",
          schemaKey: STRING_SCHEMA_KEY,
          required: true,
        }),
        Object.freeze({
          label: "Password",
          value: "password",
          valueKind: "string",
          schemaKey: STRING_SCHEMA_KEY,
          required: true,
        }),
      ]),
    }),
  ]),
  resources: Object.freeze([Object.freeze({ label: "Profile", value: "profile" })]),
  componentCommands: Object.freeze([
    Object.freeze({
      command: "focus",
      label: "Email · Focus",
      targetId: "sign-in.email",
      targetLabel: "Email",
    }),
  ]),
});

function list(
  pointer: string,
  present: boolean,
  actions: readonly AuthoringActionModel[] = [],
): AuthoringActionListModel {
  return Object.freeze({
    actions: Object.freeze([...actions]),
    pointer: pointer as AuthoringActionListModel["pointer"],
    present,
  });
}

function action(
  value: ModelAction,
  pointer: string,
  index: number,
  options: Readonly<{
    readonly depth?: number;
    readonly onFailure?: AuthoringActionListModel | null;
    readonly onSuccess?: AuthoringActionListModel | null;
  }> = {},
): AuthoringActionModel {
  return Object.freeze({
    action: value,
    depth: options.depth ?? 0,
    index,
    onFailure: options.onFailure ?? null,
    onSuccess: options.onSuccess ?? null,
    pointer: pointer as AuthoringActionModel["pointer"],
  });
}

function event(
  name: string,
  present: boolean,
  actions: readonly AuthoringActionModel[] = [],
  payloadFields: AuthoringEventHandlerModel["payloadFields"] = Object.freeze([]),
): AuthoringEventHandlerModel {
  return Object.freeze({
    actionList: list(`/on/${name}`, present, actions),
    description: name === "press" ? "Dispatched when the control is activated." : undefined,
    event: name,
    payloadFields,
    payloadSchema: Object.freeze({
      additionalProperties: false,
      type: "object",
    }),
  });
}

function readyModel(events: readonly AuthoringEventHandlerModel[]): AuthoringEventActionReadyModel {
  return Object.freeze({
    events: Object.freeze([...events]),
    owner: Object.freeze({
      capabilityId: "com.example.controls/Button",
      conditional: false,
      displayName: "Continue button",
      kind: "event-owner",
      ownerId: "sign-in.submit",
      ownerKind: "component",
      projectId: "account-app",
      surfaceId: "sign-in",
    }),
    referenceOptions: REFERENCES,
    route: Object.freeze({ projectId: "account-app", surfaceId: "sign-in" }),
    status: "ready",
  });
}

function successfulEdit(edit: AuthoringEventActionEdit): AuthoringEventActionEditResult {
  return Object.freeze({
    document: REFERENCE_EDITOR_DOCUMENT,
    ok: true,
    operation: edit.kind,
  });
}

function failedEdit(reason: AuthoringEventActionEditFailureReason): AuthoringEventActionEditResult {
  return Object.freeze({ ok: false, reason });
}

describe("Desen App event and closed-action panel", () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  });

  afterEach(() => {
    cleanup();
    document.body.replaceChildren();
  });

  it("shows the selected component and Catalog events, then adds and deletes an exact handler", () => {
    const onEdit = vi.fn(successfulEdit);
    const initial = readyModel([event("press", false)]);
    const { rerender } = render(
      <EventActionPanel model={initial} onEdit={onEdit} surfaceName="Sign in" />,
    );

    expect(screen.getByRole("heading", { level: 2, name: "Events & Actions" })).toBeTruthy();
    expect(screen.getByLabelText("Selected event component").textContent).toContain(
      "Continue button",
    );
    expect(screen.getByLabelText("Selected event component").textContent).toContain("Component");
    expect(screen.getByRole("list", { name: "Continue button Catalog events" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 3, name: "press" })).toBeTruthy();
    expect(screen.getByText("No handler")).toBeTruthy();
    expect(screen.getByText(/does not execute their actions/u)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Add press event handler" }));
    expect(onEdit).toHaveBeenLastCalledWith({
      kind: "insert-handler",
      event: "press",
      actions: [],
    });
    expect(screen.getByRole("status").textContent).toBe("Added the press handler.");

    rerender(
      <EventActionPanel
        model={readyModel([event("press", true)])}
        onEdit={onEdit}
        surfaceName="Sign in"
      />,
    );
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Add action to press" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete press event handler" }));
    expect(onEdit).toHaveBeenLastCalledWith({ kind: "delete-handler", event: "press" });
    rerender(
      <EventActionPanel
        model={readyModel([event("press", false)])}
        onEdit={onEdit}
        surfaceName="Sign in"
      />,
    );
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Add press event handler" }),
    );
  });

  it("offers all seven complete-action starters and preserves a $ref on insert", () => {
    const onEdit = vi.fn(successfulEdit);
    render(
      <EventActionPanel
        model={readyModel([event("press", true)])}
        onEdit={onEdit}
        surfaceName="Sign in"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add action to press" }));
    const type = screen.getByLabelText("New action type for press") as HTMLSelectElement;
    const json = screen.getByLabelText("New action JSON for press") as HTMLTextAreaElement;
    const expectedTypes = [
      "state.set",
      "state.toggle",
      "navigate",
      "operation.invoke",
      "resource.refresh",
      "component.command",
      "event.emit",
    ];
    expect(
      within(type)
        .getAllByRole("option")
        .map((option) => option.getAttribute("value")),
    ).toEqual(expectedTypes);
    for (const expected of expectedTypes) {
      fireEvent.change(type, { target: { value: expected } });
      expect(JSON.parse(json.value)).toMatchObject({ type: expected });
    }

    fireEvent.change(json, {
      target: {
        value: JSON.stringify({
          type: "event.emit",
          name: "signed.in",
          payload: { email: { $ref: "state.email" } },
        }),
      },
    });
    expect(onEdit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Add action" }));

    expect(onEdit).toHaveBeenCalledWith({
      kind: "insert-action",
      actionListPointer: "/on/press",
      index: 0,
      action: {
        type: "event.emit",
        name: "signed.in",
        payload: { email: { $ref: "state.email" } },
      },
    });
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Add action to press" }),
    );
    expect(screen.getByRole("status").textContent).toBe("Added Emit event to press.");
  });

  it("authors text input state flow and a Catalog operation without requiring JSON", () => {
    const onEdit = vi.fn(successfulEdit);
    const valueField = Object.freeze([
      Object.freeze({
        label: "Value",
        value: "value",
        valueKind: "string" as const,
        schemaKey: STRING_SCHEMA_KEY,
        required: true,
      }),
    ]);
    const { rerender } = render(
      <EventActionPanel
        model={readyModel([event("change", true, [], valueField)])}
        onEdit={onEdit}
        surfaceName="Sign in"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add action to change" }));
    expect((screen.getByLabelText("State to update") as HTMLSelectElement).value).toBe("email");
    expect((screen.getByLabelText("Value comes from") as HTMLSelectElement).value).toBe("event");
    expect((screen.getByLabelText("Event field") as HTMLSelectElement).value).toBe("value");
    fireEvent.click(screen.getByRole("button", { name: "Add action" }));
    expect(onEdit).toHaveBeenLastCalledWith({
      kind: "insert-action",
      actionListPointer: "/on/change",
      index: 0,
      action: { type: "state.set", path: "email", value: { $ref: "event.value" } },
    });

    onEdit.mockClear();
    rerender(
      <EventActionPanel
        model={readyModel([event("press", true)])}
        onEdit={onEdit}
        surfaceName="Sign in"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Add action to press" }));
    fireEvent.change(screen.getByLabelText("New action type for press"), {
      target: { value: "operation.invoke" },
    });
    expect((screen.getByLabelText("Result name") as HTMLInputElement).value).toBe("SignIn");
    expect((screen.getByLabelText(/Email/u) as HTMLSelectElement).value).toBe("email");
    expect((screen.getByLabelText(/Password/u) as HTMLSelectElement).value).toBe("password");
    fireEvent.click(screen.getByRole("button", { name: "Add action" }));
    expect(onEdit).toHaveBeenLastCalledWith({
      kind: "insert-action",
      actionListPointer: "/on/press",
      index: 0,
      action: {
        type: "operation.invoke",
        operation: "com.example.auth/SignIn",
        as: "SignIn",
        input: {
          email: { $ref: "state.email" },
          password: { $ref: "state.password" },
        },
        concurrency: "reject",
      },
    });
  });

  it("filters state-set sources to the selected target's compatible value kind", () => {
    const onEdit = vi.fn(successfulEdit);
    const model = readyModel([
      event(
        "change",
        true,
        [],
        Object.freeze([
          Object.freeze({
            label: "Value",
            value: "value",
            valueKind: "string" as const,
            schemaKey: STRING_SCHEMA_KEY,
            required: true,
          }),
        ]),
      ),
    ]);
    const withBooleanState = Object.freeze({
      ...model,
      referenceOptions: Object.freeze({
        ...model.referenceOptions,
        states: Object.freeze([
          ...model.referenceOptions.states,
          Object.freeze({
            label: "Enabled",
            value: "enabled",
            valueKind: "boolean" as const,
            schemaKey: BOOLEAN_SCHEMA_KEY,
            initialValue: false,
          }),
        ]),
      }),
    });
    render(<EventActionPanel model={withBooleanState} onEdit={onEdit} surfaceName="Sign in" />);

    fireEvent.click(screen.getByRole("button", { name: "Add action to change" }));
    fireEvent.change(screen.getByLabelText("State to update"), {
      target: { value: "enabled" },
    });
    expect((screen.getByLabelText("Value comes from") as HTMLSelectElement).value).toBe("literal");
    expect(
      within(screen.getByLabelText("Value comes from"))
        .getByRole("option", { name: "Event value" })
        .hasAttribute("disabled"),
    ).toBe(true);
    expect((screen.getByLabelText("Fixed value") as HTMLSelectElement).value).toBe("false");
  });

  it("keeps structured visual mappings exact and rejects structured fixed literals", () => {
    const onEdit = vi.fn(successfulEdit);
    const objectSchemaKey = '{"additionalProperties":false,"type":"object"}';
    const arraySchemaKey = '{"items":{"type":"string"},"type":"array"}';
    const base = readyModel([event("press", true)]);
    const structuredModel = Object.freeze({
      ...base,
      referenceOptions: Object.freeze({
        ...base.referenceOptions,
        states: Object.freeze([
          Object.freeze({
            initialValue: Object.freeze({}),
            label: "Payload object",
            schemaKey: objectSchemaKey,
            value: "payload",
            valueKind: "structured" as const,
          }),
          Object.freeze({
            initialValue: Object.freeze([]),
            label: "Payload array",
            schemaKey: arraySchemaKey,
            value: "items",
            valueKind: "structured" as const,
          }),
        ]),
        operations: Object.freeze([
          Object.freeze({
            description: "Submit a structured payload.",
            effect: "network",
            inputFields: Object.freeze([
              Object.freeze({
                label: "Payload",
                required: true,
                schemaKey: objectSchemaKey,
                value: "payload",
                valueKind: "structured" as const,
              }),
            ]),
            label: "Submit payload",
            value: "com.example.data/submit",
          }),
        ]),
      }),
    });
    const { rerender } = render(
      <EventActionPanel model={structuredModel} onEdit={onEdit} surfaceName="Sign in" />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add action to press" }));
    fireEvent.change(screen.getByLabelText("New action type for press"), {
      target: { value: "operation.invoke" },
    });
    const payloadState = screen.getByLabelText(/Payload/u);
    expect(
      within(payloadState)
        .getAllByRole("option")
        .map((option) => option.getAttribute("value")),
    ).toEqual(["", "payload"]);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Add action to press" }));
    fireEvent.change(screen.getByLabelText("New action type for press"), {
      target: { value: "state.set" },
    });
    expect(
      screen.getByText(/Structured fixed values are available in Advanced JSON/u),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add action" }));
    expect(onEdit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain(
      "Use Advanced JSON to enter a structured fixed value.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    const wrongMapping = action(
      {
        type: "operation.invoke",
        operation: "com.example.data/submit",
        as: "submit",
        input: { payload: { $ref: "state.items" } },
        concurrency: "reject",
      },
      "/on/press/0",
      0,
    );
    rerender(
      <EventActionPanel
        model={Object.freeze({
          ...structuredModel,
          events: Object.freeze([event("press", true, [wrongMapping])]),
        })}
        onEdit={onEdit}
        surfaceName="Sign in"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit action 1 in press" }));
    fireEvent.change(screen.getByLabelText("Result name"), { target: { value: "submitAgain" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply action" }));
    expect(onEdit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain(
      "Connect Payload to a schema-compatible local state.",
    );
  });

  it("edits one whole action without committing its intermediate JSON draft", () => {
    const onEdit = vi.fn(successfulEdit);
    const current = action({ type: "state.set", path: "email", value: "" }, "/on/press/0", 0);
    render(
      <EventActionPanel
        model={readyModel([event("press", true, [current])])}
        onEdit={onEdit}
        surfaceName="Sign in"
      />,
    );

    const edit = screen.getByRole("button", { name: "Edit action 1 in press" });
    fireEvent.click(edit);
    const json = screen.getByLabelText("action 1 in press JSON") as HTMLTextAreaElement;
    expect(json.value).toContain('"type": "state.set"');
    fireEvent.change(json, {
      target: {
        value: JSON.stringify({
          type: "state.set",
          path: "email",
          value: { $ref: "event.value" },
        }),
      },
    });
    expect(onEdit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Apply action" }));
    expect(onEdit).toHaveBeenCalledWith({
      kind: "replace-action",
      actionPointer: "/on/press/0",
      action: { type: "state.set", path: "email", value: { $ref: "event.value" } },
    });
    expect(screen.queryByLabelText("action 1 in press JSON")).toBeNull();
    expect(document.activeElement).toBe(edit);
    expect(screen.getByRole("status").textContent).toBe("Updated action 1 in press.");
  });

  it("edits an existing action through visual fields without opening JSON", () => {
    const onEdit = vi.fn(successfulEdit);
    const current = action(
      {
        type: "operation.invoke",
        operation: "com.example.auth/SignIn",
        as: "SignIn",
        input: {
          email: { $ref: "state.email" },
          password: { $ref: "state.password" },
        },
        concurrency: "reject",
      },
      "/on/press/0",
      0,
    );
    render(
      <EventActionPanel
        model={readyModel([event("press", true, [current])])}
        onEdit={onEdit}
        surfaceName="Sign in"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit action 1 in press" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Result name" }), {
      target: { value: "authentication" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "If pressed again" }), {
      target: { value: "replace" },
    });
    expect(screen.getByText("Advanced JSON")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Apply action" }));

    expect(onEdit).toHaveBeenCalledWith({
      kind: "replace-action",
      actionPointer: "/on/press/0",
      action: {
        type: "operation.invoke",
        operation: "com.example.auth/SignIn",
        as: "authentication",
        input: {
          email: { $ref: "state.email" },
          password: { $ref: "state.password" },
        },
        concurrency: "replace",
      },
    });
  });

  it("sanitizes Catalog operation identifiers to Runtime-reference-safe result names", () => {
    const onEdit = vi.fn(successfulEdit);
    const model = readyModel([event("press", true)]);
    const referenceOperation = REFERENCES.operations[0];
    if (referenceOperation === undefined) throw new Error("Expected reference operation.");
    const colonOperation: AuthoringOperationActionReferenceOption = Object.freeze({
      label: "Sign in colon",
      value: "com.example.auth/sign:in",
      description: referenceOperation.description,
      effect: referenceOperation.effect,
      inputFields: referenceOperation.inputFields,
    });
    const withColonOperation = Object.freeze({
      ...model,
      referenceOptions: Object.freeze({
        ...model.referenceOptions,
        operations: Object.freeze([colonOperation]),
      }),
    });
    render(<EventActionPanel model={withColonOperation} onEdit={onEdit} surfaceName="Sign in" />);

    fireEvent.click(screen.getByRole("button", { name: "Add action to press" }));
    fireEvent.change(screen.getByLabelText("New action type for press"), {
      target: { value: "operation.invoke" },
    });
    expect((screen.getByRole("textbox", { name: "Result name" }) as HTMLInputElement).value).toBe(
      "sign-in",
    );
  });

  it("reorders and deletes root actions through exact pointers with focus recovery", () => {
    const onEdit = vi.fn(successfulEdit);
    const set = action({ type: "state.set", path: "email", value: "" }, "/on/press/0", 0);
    const navigate = action({ type: "navigate", surface: "home" }, "/on/press/1", 1);
    const { rerender } = render(
      <EventActionPanel
        model={readyModel([event("press", true, [set, navigate])])}
        onEdit={onEdit}
        surfaceName="Sign in"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Move action 2 in press up" }));
    expect(onEdit).toHaveBeenLastCalledWith({
      kind: "reorder-action",
      actionPointer: "/on/press/1",
      index: 0,
    });
    rerender(
      <EventActionPanel
        model={readyModel([
          event("press", true, [
            action({ type: "navigate", surface: "home" }, "/on/press/0", 0),
            action({ type: "state.set", path: "email", value: "" }, "/on/press/1", 1),
          ]),
        ])}
        onEdit={onEdit}
        surfaceName="Sign in"
      />,
    );
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Edit action 1 in press" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete action 1 in press" }));
    expect(onEdit).toHaveBeenLastCalledWith({
      kind: "delete-action",
      actionPointer: "/on/press/0",
    });
    rerender(
      <EventActionPanel
        model={readyModel([
          event("press", true, [
            action({ type: "state.set", path: "email", value: "" }, "/on/press/0", 0),
          ]),
        ])}
        onEdit={onEdit}
        surfaceName="Sign in"
      />,
    );
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Edit action 1 in press" }),
    );
  });

  it("renders recursive operation settlement lists and inserts into an absent Failure list", () => {
    const onEdit = vi.fn(successfulEdit);
    const success = list("/on/press/0/onSuccess", true, [
      action({ type: "event.emit", name: "signed.in" }, "/on/press/0/onSuccess/0", 0, { depth: 1 }),
    ]);
    const failure = list("/on/press/0/onFailure", false);
    const invoke = action(
      {
        type: "operation.invoke",
        operation: "com.example.auth/SignIn",
        as: "signIn",
        input: { email: { $ref: "state.email" } },
      },
      "/on/press/0",
      0,
      { onFailure: failure, onSuccess: success },
    );
    render(
      <EventActionPanel
        model={readyModel([event("press", true, [invoke])])}
        onEdit={onEdit}
        surfaceName="Sign in"
      />,
    );

    expect(screen.getByRole("list", { name: "action 1 in press success actions" })).toBeTruthy();
    expect(screen.getByText(/settlement list is absent/u)).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Add action to action 1 in press failure" }),
    );
    fireEvent.change(screen.getByLabelText("New action type for action 1 in press failure"), {
      target: { value: "resource.refresh" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add action" }));
    expect(onEdit).toHaveBeenCalledWith({
      kind: "insert-action",
      actionListPointer: "/on/press/0/onFailure",
      index: 0,
      action: { type: "resource.refresh", resource: "profile" },
    });
  });

  it("reports local JSON and edit failures accessibly without losing the draft", () => {
    const onEdit = vi.fn(() => failedEdit("source-invalid"));
    render(
      <EventActionPanel
        model={readyModel([event("press", true)])}
        onEdit={onEdit}
        surfaceName="Sign in"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Add action to press" }));
    const json = screen.getByLabelText("New action JSON for press") as HTMLTextAreaElement;
    fireEvent.change(json, {
      target: { value: '{"type":"state.set","type":"state.toggle","path":"email"}' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add action" }));
    expect(onEdit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe("Object member names must be unique.");
    expect(json.getAttribute("aria-invalid")).toBe("true");

    fireEvent.change(json, {
      target: { value: '{"type":"state.toggle","path":"email"}' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add action" }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert").textContent).toBe(
      "This complete action does not satisfy the Source contract.",
    );
    expect(json.value).toContain("state.toggle");
    expect(document.activeElement).toBe(json);
    expect(screen.getByRole("status").getAttribute("aria-live")).toBe("polite");
  });

  it("keeps idle, rejected, and Catalog-empty states honest and non-actionable", () => {
    const onEdit = vi.fn(successfulEdit);
    const idle = Object.freeze({ status: "idle" }) satisfies AuthoringEventActionModelResult;
    const { rerender } = render(
      <EventActionPanel model={idle} onEdit={onEdit} surfaceName="Sign in" />,
    );
    expect(screen.getByText("Select a component")).toBeTruthy();
    expect(
      screen.getByText("Select a component to inspect its Catalog-declared events."),
    ).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();

    const rejected = Object.freeze({
      reason: "selection-invalid",
      status: "rejected",
    }) satisfies AuthoringEventActionModelResult;
    rerender(<EventActionPanel model={rejected} onEdit={onEdit} surfaceName="Sign in" />);
    expect(screen.getByRole("alert").textContent).toContain("no longer current");
    expect(screen.queryByText("Available Source references")).toBeNull();

    rerender(<EventActionPanel model={readyModel([])} onEdit={onEdit} surfaceName="Sign in" />);
    expect(screen.getByText("No Catalog events")).toBeTruthy();
    expect(screen.getByText(/does not declare any editable events/u)).toBeTruthy();
    expect(screen.queryByText("Add handler")).toBeNull();
    expect(onEdit).not.toHaveBeenCalled();
  });
});
