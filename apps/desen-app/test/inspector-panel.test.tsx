// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createJsonPointer } from "@desen/protocol";

import { InspectorPanel } from "../src/inspector-panel.js";
import { REFERENCE_EDITOR_DOCUMENT } from "../src/authoring-preview.js";

import type {
  ComponentInspectorControl,
  ComponentInspectorControlPlan,
  ComponentInspectorFallbackReason,
  JsonValue,
} from "@desen/catalog-sdk";
import type { JsonPointer } from "@desen/protocol";
import type {
  AuthoringInspectorEdit,
  AuthoringInspectorEditResult,
  AuthoringInspectorBindingEdit,
  AuthoringInspectorField,
  AuthoringInspectorReadyModel,
  AuthoringInspectorStateOption,
  AuthoringInspectorValueState,
} from "../src/authoring-inspector.js";

function field(
  control: ComponentInspectorControl,
  label: string,
  qualifiedLabel: string,
  value: AuthoringInspectorValueState,
  children: readonly AuthoringInspectorField[] = [],
  containsDynamicValue = value.kind === "dynamic",
): AuthoringInspectorField {
  return Object.freeze({
    children: Object.freeze([...children]),
    containsDynamicValue,
    control,
    description: undefined,
    label,
    qualifiedLabel,
    value,
  });
}

function readyModel(
  fields: readonly AuthoringInspectorField[],
  controlCount: number,
  localStates: readonly AuthoringInspectorStateOption[] = Object.freeze([]),
): AuthoringInspectorReadyModel {
  const controls = Object.freeze(fields.map(({ control }) => control));
  const inspector = Object.freeze({
    propsSchema: Object.freeze({
      additionalProperties: false,
      properties: Object.freeze({}),
      type: "object",
    }),
    controls,
  }) satisfies ComponentInspectorControlPlan;

  return Object.freeze({
    component: Object.freeze({
      authoringCategory: "Test",
      description: undefined,
      defaultProps: Object.freeze({}),
      displayName: "Test component",
      id: "com.example.test/Inspector",
      inspector,
      semanticCategory: undefined,
      slotContracts: Object.freeze([]),
    }),
    controlCount,
    fields: Object.freeze([...fields]),
    localStates: Object.freeze([...localStates]),
    node: Object.freeze({
      behaviors: Object.freeze([]),
      capabilityId: "com.example.test/Inspector",
      conditional: false,
      displayName: "Test component",
      id: "test.node",
      kind: "component",
      props: Object.freeze({}),
      slotContracts: Object.freeze([]),
      slots: Object.freeze([]),
    }),
    selection: Object.freeze({
      capabilityId: "com.example.test/Inspector",
      conditional: false,
      displayName: "Test component",
      kind: "component",
      projectId: "account-app",
      sourceNodeId: "test.node",
      surfaceId: "sign-in",
    }),
    status: "ready",
  });
}

function structuredField(
  property: string | null,
  valuePointer: JsonPointer,
  label: string,
  required: boolean,
  fallbackReason: ComponentInspectorFallbackReason,
  value: JsonValue,
): AuthoringInspectorField {
  const control = Object.freeze({
    fallbackReason,
    kind: "structured-json",
    property,
    required,
    schemaPointer:
      property === null
        ? createJsonPointer(["propsSchema"])
        : createJsonPointer(["propsSchema", "properties", property]),
    valuePointer,
  }) satisfies ComponentInspectorControl;
  return field(
    control,
    label,
    label,
    Object.freeze({ kind: "structured", value }) as AuthoringInspectorValueState,
  );
}

function successfulEdit(edit: AuthoringInspectorEdit): AuthoringInspectorEditResult {
  void edit;
  return Object.freeze({ ok: true, document: REFERENCE_EDITOR_DOCUMENT });
}

function successfulBindingEdit(edit: AuthoringInspectorBindingEdit): AuthoringInspectorEditResult {
  void edit;
  return Object.freeze({ ok: true, document: REFERENCE_EDITOR_DOCUMENT });
}

function DraftProbe({ label }: Readonly<{ readonly label: string }>) {
  const [value, setValue] = useState("");
  return (
    <label>
      {label}
      <input onChange={(event) => setValue(event.currentTarget.value)} value={value} />
    </label>
  );
}

describe("Desen App nested and structured Inspector panel", () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  });

  afterEach(() => {
    cleanup();
    document.body.replaceChildren();
  });

  it("keeps right-sidebar tab panels mounted while providing keyboard-accessible Inspector, State, and Actions views", () => {
    render(
      <InspectorPanel
        eventActionControls={<DraftProbe label="Action draft" />}
        inspector={readyModel([], 0)}
        onEdit={vi.fn()}
        stateControls={<DraftProbe label="State draft" />}
      />,
    );

    const inspector = screen.getByRole("complementary", { name: "Inspector" });
    const tabs = within(inspector).getAllByRole("tab");
    expect(within(inspector).getByRole("tablist", { name: "Inspector views" })).toBeTruthy();
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Inspector", "State", "Actions"]);

    const inspectorTab = within(inspector).getByRole("tab", { name: "Inspector" });
    const stateTab = within(inspector).getByRole("tab", { name: "State" });
    const actionsTab = within(inspector).getByRole("tab", { name: "Actions" });
    const inspectorPanel = document.getElementById(
      inspectorTab.getAttribute("aria-controls") ?? "",
    ) as HTMLElement;
    const statePanel = document.getElementById(
      stateTab.getAttribute("aria-controls") ?? "",
    ) as HTMLElement;
    const actionsPanel = document.getElementById(
      actionsTab.getAttribute("aria-controls") ?? "",
    ) as HTMLElement;

    for (const [tab, panel] of [
      [inspectorTab, inspectorPanel],
      [stateTab, statePanel],
      [actionsTab, actionsPanel],
    ] as const) {
      expect(tab.getAttribute("aria-controls")).toBe(panel.id);
      expect(panel.getAttribute("role")).toBe("tabpanel");
      expect(panel.getAttribute("aria-labelledby")).toBe(tab.id);
    }
    expect(inspectorTab.getAttribute("aria-selected")).toBe("true");
    expect(statePanel.hidden).toBe(true);
    expect(actionsPanel.hidden).toBe(true);

    fireEvent.keyDown(inspectorTab, { key: "ArrowRight" });
    expect(document.activeElement).toBe(stateTab);
    expect(stateTab.getAttribute("aria-selected")).toBe("true");
    expect(statePanel.hidden).toBe(false);
    const stateDraft = within(statePanel).getByRole("textbox", { name: "State draft" });
    fireEvent.change(stateDraft, { target: { value: "state draft is retained" } });

    fireEvent.keyDown(stateTab, { key: "ArrowRight" });
    expect(document.activeElement).toBe(actionsTab);
    expect(actionsTab.getAttribute("aria-selected")).toBe("true");
    const actionDraft = within(actionsPanel).getByRole("textbox", { name: "Action draft" });
    fireEvent.change(actionDraft, { target: { value: "action draft is retained" } });

    fireEvent.keyDown(actionsTab, { key: "Home" });
    expect(document.activeElement).toBe(inspectorTab);
    expect(inspectorTab.getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(inspectorTab, { key: "End" });
    expect(document.activeElement).toBe(actionsTab);
    fireEvent.keyDown(actionsTab, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(stateTab);
    expect(
      (within(statePanel).getByRole("textbox", { name: "State draft" }) as HTMLInputElement).value,
    ).toBe("state draft is retained");
    fireEvent.keyDown(stateTab, { key: "ArrowRight" });
    expect(
      (within(actionsPanel).getByRole("textbox", { name: "Action draft" }) as HTMLInputElement)
        .value,
    ).toBe("action draft is retained");
  });

  it("hands focus between an optional boolean setter and switch with non-scrolling focus semantics", () => {
    const secureControl = Object.freeze({
      kind: "boolean",
      property: "secure",
      required: false,
      schemaPointer: createJsonPointer(["propsSchema", "properties", "secure"]),
      valuePointer: createJsonPointer(["secure"]),
    }) satisfies ComponentInspectorControl;
    const edits: AuthoringInspectorEdit[] = [];

    function OptionalSecureHarness() {
      const [value, setValue] = useState<AuthoringInspectorValueState>(
        Object.freeze({ kind: "absent" }),
      );
      const secureField = field(secureControl, "Secure", "Secure", value);

      return (
        <InspectorPanel
          inspector={readyModel([secureField], 1)}
          onEdit={(edit) => {
            edits.push(edit);
            if (edit.kind === "delete") {
              setValue(Object.freeze({ kind: "absent" }));
            } else if (typeof edit.value === "boolean") {
              setValue(Object.freeze({ kind: "literal", value: edit.value }));
            }
            return successfulEdit(edit);
          }}
        />
      );
    }

    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    render(<OptionalSecureHarness />);

    fireEvent.click(screen.getByRole("button", { name: "Set Secure" }));
    const secure = screen.getByRole("switch", { name: "Secure" });
    expect(document.activeElement).toBe(secure);
    expect(focus).toHaveBeenLastCalledWith({ preventScroll: true });

    fireEvent.click(screen.getByRole("button", { name: "Unset Secure" }));
    const setSecure = screen.getByRole("button", { name: "Set Secure" });
    expect(document.activeElement).toBe(setSecure);
    expect(focus).toHaveBeenLastCalledWith({ preventScroll: true });
    expect(edits).toEqual([
      { kind: "set", value: false, valuePointer: secureControl.valuePointer },
      { kind: "delete", valuePointer: secureControl.valuePointer },
    ]);
    focus.mockRestore();
  });

  it("changes or detaches a compatible direct local-state value source", () => {
    const valueControl = Object.freeze({
      kind: "string",
      property: "value",
      required: true,
      schemaPointer: createJsonPointer(["propsSchema", "properties", "value"]),
      valuePointer: createJsonPointer(["value"]),
    }) satisfies ComponentInspectorControl;
    const valueField = field(
      valueControl,
      "Value",
      "Value",
      Object.freeze({
        kind: "dynamic",
        reference: "state.email",
        value: Object.freeze({ $ref: "state.email" }),
      }),
    );
    const states = Object.freeze([
      Object.freeze({
        enumValues: undefined,
        initial: "",
        name: "email",
        reference: "state.email",
        type: "string" as const,
      }),
      Object.freeze({
        enumValues: undefined,
        initial: "",
        name: "password",
        reference: "state.password",
        type: "string" as const,
      }),
    ]);
    const onBindingEdit = vi.fn(successfulBindingEdit);
    render(
      <InspectorPanel
        inspector={readyModel([valueField], 1, states)}
        onBindingEdit={onBindingEdit}
        onEdit={vi.fn()}
      />,
    );

    const source = screen.getByRole("combobox", { name: "Value value source" });
    expect((source as HTMLSelectElement).value).toBe("email");
    fireEvent.change(source, { target: { value: "password" } });
    expect(onBindingEdit).toHaveBeenLastCalledWith({
      kind: "bind",
      stateName: "password",
      valuePointer: "/value",
    });
    expect(screen.getByRole("status").textContent).toBe("Bound Value to state.password.");

    fireEvent.change(source, { target: { value: "__local__" } });
    expect(onBindingEdit).toHaveBeenLastCalledWith({
      kind: "use-initial",
      valuePointer: "/value",
    });
    expect(screen.getByRole("status").textContent).toBe(
      "Restored Value to the bound state's initial value.",
    );
  });

  it("keeps operation bindings visible and read-only", () => {
    const loadingControl = Object.freeze({
      kind: "boolean",
      property: "loading",
      required: false,
      schemaPointer: createJsonPointer(["propsSchema", "properties", "loading"]),
      valuePointer: createJsonPointer(["loading"]),
    }) satisfies ComponentInspectorControl;
    const loading = field(
      loadingControl,
      "Loading",
      "Loading",
      Object.freeze({
        kind: "dynamic",
        reference: "operation.signIn.pending",
        value: Object.freeze({ $ref: "operation.signIn.pending", fallback: false }),
      }),
    );
    render(<InspectorPanel inspector={readyModel([loading], 1)} onEdit={vi.fn()} />);

    expect(screen.getByText("operation.signIn.pending")).toBeTruthy();
    expect(
      screen.getByText("This runtime or advanced binding is preserved as read-only."),
    ).toBeTruthy();
    expect(screen.queryByRole("combobox", { name: "Loading value source" })).toBeNull();
  });

  it("exposes recursive groups and leaf controls through qualified accessible names", () => {
    const labelControl = Object.freeze({
      kind: "string",
      property: "label",
      required: true,
      schemaPointer: createJsonPointer([
        "propsSchema",
        "properties",
        "settings",
        "properties",
        "layout",
        "properties",
        "label",
      ]),
      valuePointer: createJsonPointer(["settings", "layout", "label"]),
    }) satisfies ComponentInspectorControl;
    const labelField = field(
      labelControl,
      "Label",
      "Settings · Layout · Label",
      Object.freeze({ kind: "literal", value: "Original" }),
    );
    const layoutControl = Object.freeze({
      children: Object.freeze([labelControl]),
      kind: "group",
      property: "layout",
      required: true,
      schemaPointer: createJsonPointer([
        "propsSchema",
        "properties",
        "settings",
        "properties",
        "layout",
      ]),
      valuePointer: createJsonPointer(["settings", "layout"]),
    }) satisfies ComponentInspectorControl;
    const layoutField = field(
      layoutControl,
      "Layout",
      "Settings · Layout",
      Object.freeze({
        kind: "structured",
        value: Object.freeze({ label: "Original" }),
      }),
      [labelField],
    );
    const settingsControl = Object.freeze({
      children: Object.freeze([layoutControl]),
      kind: "group",
      property: "settings",
      required: false,
      schemaPointer: createJsonPointer(["propsSchema", "properties", "settings"]),
      valuePointer: createJsonPointer(["settings"]),
    }) satisfies ComponentInspectorControl;
    const settingsField = field(
      settingsControl,
      "Settings",
      "Settings",
      Object.freeze({
        kind: "structured",
        value: Object.freeze({ layout: Object.freeze({ label: "Original" }) }),
      }),
      [layoutField],
    );

    render(<InspectorPanel inspector={readyModel([settingsField], 3)} onEdit={vi.fn()} />);

    const settings = screen.getByRole("group", { name: "Settings group" });
    const layout = within(settings).getByRole("group", { name: "Settings · Layout group" });
    expect(settings).toBeInstanceOf(HTMLFieldSetElement);
    expect(layout).toBeInstanceOf(HTMLFieldSetElement);
    expect(within(settings).getByText("Settings group", { selector: "legend" })).toBeTruthy();
    expect(
      within(layout).getByText("Settings · Layout group", { selector: "legend" }),
    ).toBeTruthy();
    const label = within(layout).getByRole("textbox", {
      name: "Settings · Layout · Label",
    }) as HTMLInputElement;
    expect(label.value).toBe("Original");
    expect(
      within(layout).getByRole("button", { name: "Apply Settings · Layout · Label" }),
    ).toBeTruthy();
    expect(within(layout).getByText("/settings/layout/label")).toBeTruthy();
    expect(screen.getByText("3 controls")).toBeTruthy();
  });

  it("canonicalizes a successful decimal draft and keeps validation errors inline", () => {
    const ratioControl = Object.freeze({
      kind: "number",
      property: "ratio",
      required: true,
      schemaPointer: createJsonPointer(["propsSchema", "properties", "ratio"]),
      valuePointer: createJsonPointer(["ratio"]),
    }) satisfies ComponentInspectorControl;
    const ratio = field(
      ratioControl,
      "Ratio",
      "Ratio",
      Object.freeze({ kind: "literal", value: 2 }),
    );
    const onEdit = vi.fn(successfulEdit);
    render(<InspectorPanel inspector={readyModel([ratio], 1)} onEdit={onEdit} />);

    const input = screen.getByRole("spinbutton", { name: "Ratio" }) as HTMLInputElement;
    const defaultFooter = "Edits remain local until Save source succeeds.";
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);

    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByRole("alert").textContent).toBe("Enter a finite number.");
    expect(screen.getByRole("status").textContent).toBe(defaultFooter);
    expect(onEdit).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "1.0" } });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe(defaultFooter);
    fireEvent.blur(input);

    expect(onEdit).toHaveBeenCalledWith({
      kind: "set",
      value: 1,
      valuePointer: "/ratio",
    });
    expect(input.value).toBe("1");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("Updated Ratio.");
  });

  it("shows an honest fallback reason and commits structured JSON only through explicit Apply", () => {
    const initialValue = Object.freeze({ alpha: true, zeta: 1 });
    const options = structuredField(
      "options",
      createJsonPointer(["options"]),
      "Options",
      false,
      "open-object",
      initialValue,
    );
    const onEdit = vi.fn(successfulEdit);
    render(<InspectorPanel inspector={readyModel([options], 1)} onEdit={onEdit} />);

    expect(screen.getByText("Structured JSON")).toBeTruthy();
    expect(screen.getByText("Open object schema")).toBeTruthy();
    const textarea = screen.getByRole("textbox", { name: "Options JSON" }) as HTMLTextAreaElement;
    const apply = screen.getByRole("button", { name: "Apply Options JSON" });
    const reset = screen.getByRole("button", { name: "Reset Options JSON" });
    const initialText = ["{", '  "alpha": true,', '  "zeta": 1', "}"].join("\n");
    expect(textarea.value).toBe(initialText);
    expect((apply as HTMLButtonElement).disabled).toBe(true);
    expect((reset as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(textarea, { target: { value: '{"changed":true}' } });
    fireEvent.blur(textarea);
    expect(onEdit).not.toHaveBeenCalled();
    expect((apply as HTMLButtonElement).disabled).toBe(false);
    expect((reset as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(reset);
    expect(textarea.value).toBe(initialText);
    expect(onEdit).not.toHaveBeenCalled();

    fireEvent.change(textarea, { target: { value: '{"beta":[2,1],"alpha":false}' } });
    fireEvent.blur(textarea);
    expect(onEdit).not.toHaveBeenCalled();
    fireEvent.click(apply);

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith({
      kind: "set",
      value: { alpha: false, beta: [2, 1] },
      valuePointer: "/options",
    });
    const edit = onEdit.mock.calls[0]?.[0];
    expect(edit?.kind).toBe("set");
    if (edit?.kind !== "set") throw new Error("Expected one structured set edit.");
    expect(Object.isFrozen(edit.value)).toBe(true);
    expect(Object.isFrozen((edit.value as Readonly<Record<string, JsonValue>>).beta)).toBe(true);
    expect(textarea.value).toBe(
      ["{", '  "alpha": false,', '  "beta": [', "    2,", "    1", "  ]", "}"].join("\n"),
    );
    expect(screen.getByRole("status").textContent).toBe("Updated Options.");
  });

  it.each([
    ["malformed", '{"alpha":', "Enter valid JSON."],
    ["duplicate", '{"alpha":1,"\\u0061lpha":2}', "Object member names must be unique."],
    [
      "dynamic",
      '{"nested":{"\\u0024ref":"state.email"}}',
      "Binding keys that start with $ stay locked until binding editing is available.",
    ],
  ])("rejects %s structured JSON before invoking the edit boundary", (_case, text, message) => {
    const options = structuredField(
      "options",
      createJsonPointer(["options"]),
      "Options",
      false,
      "combinator",
      Object.freeze({ alpha: true }),
    );
    const onEdit = vi.fn(successfulEdit);
    render(<InspectorPanel inspector={readyModel([options], 1)} onEdit={onEdit} />);

    const textarea = screen.getByRole("textbox", { name: "Options JSON" });
    fireEvent.change(textarea, { target: { value: text } });
    fireEvent.click(screen.getByRole("button", { name: "Apply Options JSON" }));

    expect(onEdit).not.toHaveBeenCalled();
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByRole("alert").textContent).toBe(message);
    expect(screen.getByRole("status").textContent).toBe(
      "Edits remain local until Save source succeeds.",
    );
    expect(textarea.getAttribute("aria-invalid")).toBe("true");
    const describedBy = textarea.getAttribute("aria-describedby")?.split(" ") ?? [];
    expect(
      describedBy.some((id) => document.getElementById(id)?.getAttribute("role") === "alert"),
    ).toBe(true);

    fireEvent.change(textarea, { target: { value: '{"safe":true}' } });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe(
      "Edits remain local until Save source succeeds.",
    );
    fireEvent.change(textarea, { target: { value: text } });
    fireEvent.click(screen.getByRole("button", { name: "Apply Options JSON" }));
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Reset Options JSON" }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect((textarea as HTMLTextAreaElement).value).toBe(["{", '  "alpha": true', "}"].join("\n"));
    expect(screen.getByRole("status").textContent).toBe(
      "Edits remain local until Save source succeeds.",
    );
    expect(onEdit).not.toHaveBeenCalled();
  });

  it("hides optional group Unset when the current subtree contains a dynamic value", () => {
    const groupControl = Object.freeze({
      children: Object.freeze([]),
      kind: "group",
      property: "options",
      required: false,
      schemaPointer: createJsonPointer(["propsSchema", "properties", "options"]),
      valuePointer: createJsonPointer(["options"]),
    }) satisfies ComponentInspectorControl;
    const options = field(
      groupControl,
      "Options",
      "Options",
      Object.freeze({
        kind: "structured",
        value: Object.freeze({ binding: Object.freeze({ $ref: "state.email" }) }),
      }),
      [],
      true,
    );
    const onEdit = vi.fn(successfulEdit);
    render(<InspectorPanel inspector={readyModel([options], 1)} onEdit={onEdit} />);

    expect(screen.getByRole("group", { name: "Options group" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Unset Options" })).toBeNull();
    expect(onEdit).not.toHaveBeenCalled();
  });

  it("stages an absent group as complete JSON and dispatches its exact group pointer", () => {
    const childControl = Object.freeze({
      kind: "string",
      property: "label",
      required: true,
      schemaPointer: createJsonPointer([
        "propsSchema",
        "properties",
        "settings",
        "properties",
        "label",
      ]),
      valuePointer: createJsonPointer(["settings", "label"]),
    }) satisfies ComponentInspectorControl;
    const groupControl = Object.freeze({
      children: Object.freeze([childControl]),
      kind: "group",
      property: "settings",
      required: false,
      schemaPointer: createJsonPointer(["propsSchema", "properties", "settings"]),
      valuePointer: createJsonPointer(["settings"]),
    }) satisfies ComponentInspectorControl;
    const settings = field(groupControl, "Settings", "Settings", Object.freeze({ kind: "absent" }));
    const onEdit = vi.fn(successfulEdit);
    const view = render(<InspectorPanel inspector={readyModel([settings], 2)} onEdit={onEdit} />);

    expect(screen.getByText("Complete object required")).toBeTruthy();
    const textarea = screen.getByRole("textbox", { name: "Settings JSON" }) as HTMLTextAreaElement;
    expect(textarea.value).toBe("{}");
    fireEvent.change(textarea, { target: { value: '{"label":"Ready"}' } });
    fireEvent.blur(textarea);
    expect(onEdit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Apply Settings JSON" }));

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith({
      kind: "set",
      value: { label: "Ready" },
      valuePointer: "/settings",
    });
    const edit = onEdit.mock.calls[0]?.[0];
    expect(edit?.kind).toBe("set");
    if (edit?.kind !== "set") throw new Error("Expected one complete group set edit.");
    expect(Object.isFrozen(edit.value)).toBe(true);
    expect(screen.getByRole("status").textContent).toBe("Updated Settings.");

    const label = field(
      childControl,
      "Label",
      "Settings · Label",
      Object.freeze({ kind: "literal", value: "Ready" }),
    );
    const presentSettings = field(
      groupControl,
      "Settings",
      "Settings",
      Object.freeze({ kind: "structured", value: Object.freeze({ label: "Ready" }) }),
      [label],
    );
    view.rerender(<InspectorPanel inspector={readyModel([presentSettings], 2)} onEdit={onEdit} />);
    const group = screen.getByRole("group", { name: "Settings group" });
    expect(document.activeElement).toBe(group);

    fireEvent.click(screen.getByRole("button", { name: "Unset Settings" }));
    view.rerender(<InspectorPanel inspector={readyModel([settings], 2)} onEdit={onEdit} />);
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Settings JSON" }));
  });

  it("offers Unset for an optional structured property but never for the root pointer", () => {
    const optional = structuredField(
      "options",
      createJsonPointer(["options"]),
      "Options",
      false,
      "array",
      Object.freeze([1, 2]),
    );
    const root = structuredField(
      null,
      createJsonPointer(),
      "Properties",
      true,
      "reference",
      Object.freeze({ options: Object.freeze([1, 2]) }),
    );
    const onEdit = vi.fn(successfulEdit);
    const view = render(<InspectorPanel inspector={readyModel([optional], 1)} onEdit={onEdit} />);

    fireEvent.click(screen.getByRole("button", { name: "Unset Options" }));
    expect(onEdit).toHaveBeenCalledWith({ kind: "delete", valuePointer: "/options" });
    const absentOptional = Object.freeze({
      ...optional,
      value: Object.freeze({ kind: "absent" as const }),
    });
    view.rerender(<InspectorPanel inspector={readyModel([absentOptional], 1)} onEdit={onEdit} />);
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Options JSON" }));

    onEdit.mockClear();
    view.rerender(<InspectorPanel inspector={readyModel([root], 1)} onEdit={onEdit} />);
    expect(screen.getByText("Referenced schema")).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Properties JSON" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Unset Properties" })).toBeNull();
    expect(onEdit).not.toHaveBeenCalled();
  });
});
