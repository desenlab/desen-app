// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AUTHORING_RESPONSIVE_BREAKPOINTS } from "../src/authoring-styles.js";
import { StylePanel } from "../src/style-panel.js";

import type { JsonValue } from "@desen/catalog-sdk";
import type { DesenEditorDocument } from "@desen/editor-core";
import type {
  AuthoringStyleControl,
  AuthoringStyleEdit,
  AuthoringStyleEditResult,
  AuthoringStyleModelResult,
  AuthoringStyleReadyModel,
  AuthoringStyleTarget,
  AuthoringStyleValueState,
} from "../src/authoring-styles.js";

const BASE_TARGET: AuthoringStyleTarget = Object.freeze({ kind: "base" });
const MOBILE_TARGET: AuthoringStyleTarget = Object.freeze({
  kind: "breakpoint",
  breakpoint: "mobile",
});
const ABSENT: AuthoringStyleValueState = Object.freeze({ kind: "absent" });

function literal(value: JsonValue): AuthoringStyleValueState {
  return Object.freeze({ kind: "literal", value });
}

function styleControl(
  property: string,
  kind: AuthoringStyleControl["kind"],
  schema: Readonly<Record<string, unknown>>,
  base: AuthoringStyleValueState = ABSENT,
  mobile: AuthoringStyleValueState = ABSENT,
  tokenTypes: AuthoringStyleControl["tokenTypes"] = Object.freeze([]),
): AuthoringStyleControl {
  return Object.freeze({
    part: "root",
    property,
    description: undefined,
    kind,
    tokenTypes,
    propertiesSchema: schema,
    base,
    responsive: Object.freeze(
      AUTHORING_RESPONSIVE_BREAKPOINTS.map((breakpoint) =>
        Object.freeze({
          breakpoint,
          variantIndex: breakpoint.id === "mobile" && mobile.kind !== "absent" ? 0 : null,
          value: breakpoint.id === "mobile" ? mobile : ABSENT,
        }),
      ),
    ),
  });
}

function readyModel(controls: readonly AuthoringStyleControl[]): AuthoringStyleModelResult {
  return Object.freeze({
    status: "ready",
    component: Object.freeze({
      id: "com.example.test/Panel",
      displayName: "Test panel",
      authoringCategory: "Test",
      semanticCategory: undefined,
      description: undefined,
      defaultProps: Object.freeze({}),
      slotContracts: Object.freeze([]),
      styleParts: Object.freeze([]),
      visualStates: Object.freeze([]),
      previewAdapter: undefined,
    }),
    selection: Object.freeze({
      kind: "component",
      projectId: "desen-neutral",
      surfaceId: "home",
      sourceNodeId: "test.panel",
      capabilityId: "com.example.test/Panel",
      displayName: "Test panel",
      conditional: false,
    }),
    parts: Object.freeze([
      Object.freeze({
        name: "root",
        description: "Declared visual root",
        controlsAvailable: true,
        controls: Object.freeze([...controls]),
      }),
    ]),
    unmanagedResponsiveVariants: Object.freeze([]),
  }) satisfies AuthoringStyleReadyModel;
}

function successfulStyleEdit(edit: AuthoringStyleEdit): AuthoringStyleEditResult {
  void edit;
  return Object.freeze({ ok: true, document: Object.freeze({}) as DesenEditorDocument });
}

describe("Desen App T12 Style panel", () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  });

  afterEach(() => {
    cleanup();
    document.body.replaceChildren();
  });

  it("fails closed for an idle selection without exposing a raw style editor", () => {
    render(<StylePanel model={Object.freeze({ status: "idle" })} target={BASE_TARGET} />);

    expect(screen.getByText("Select a layer for styles")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: /apply/i })).toBeNull();
  });

  it("authors typed color and dimension literals, token references, responsive selection, and exact reset", () => {
    const onEdit = vi.fn(successfulStyleEdit);
    const onTargetChange = vi.fn();
    const color = styleControl(
      "backgroundColor",
      "structured-json",
      Object.freeze({ anyOf: Object.freeze([]) }),
      literal("#112233"),
      literal("#445566"),
      Object.freeze(["color"]),
    );
    const width = styleControl(
      "width",
      "structured-json",
      Object.freeze({ anyOf: Object.freeze([]) }),
      literal(Object.freeze({ value: 16, unit: "px" })),
    );
    const view = render(
      <StylePanel
        model={readyModel([color, width])}
        onEdit={onEdit}
        onTargetChange={onTargetChange}
        target={BASE_TARGET}
        tokenOptions={Object.freeze([
          Object.freeze({
            path: "color.brand.primary",
            type: "color" as const,
            resolvedValue: "#3355aa",
          }),
        ])}
      />,
    );

    expect(screen.queryByRole("textbox", { name: /JSON/i })).toBeNull();
    const hex = screen.getByRole("textbox", { name: "backgroundColor hex" });
    fireEvent.change(hex, { target: { value: "#abcdef" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply backgroundColor at Desktop" }));
    expect(onEdit).toHaveBeenLastCalledWith({
      kind: "set-literal",
      target: BASE_TARGET,
      part: "root",
      property: "backgroundColor",
      value: "#abcdef",
    });

    fireEvent.change(screen.getByRole("combobox", { name: "backgroundColor format" }), {
      target: { value: "srgb" },
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: "backgroundColor red" }), {
      target: { value: "0.25" },
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: "backgroundColor green" }), {
      target: { value: "0.5" },
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: "backgroundColor blue" }), {
      target: { value: "0.75" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply backgroundColor at Desktop" }));
    expect(onEdit).toHaveBeenLastCalledWith({
      kind: "set-literal",
      target: BASE_TARGET,
      part: "root",
      property: "backgroundColor",
      value: {
        colorSpace: "srgb",
        components: [0.25, 0.5, 0.75],
        alpha: 1,
      },
    });

    fireEvent.change(
      screen.getByRole("combobox", {
        name: "backgroundColor design token for Desktop",
      }),
      { target: { value: "color.brand.primary" } },
    );
    expect(onEdit).toHaveBeenLastCalledWith({
      kind: "set-token",
      target: BASE_TARGET,
      part: "root",
      property: "backgroundColor",
      token: "color.brand.primary",
    });

    fireEvent.change(screen.getByRole("spinbutton", { name: "width value" }), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "width unit" }), {
      target: { value: "rem" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply width at Desktop" }));
    expect(onEdit).toHaveBeenLastCalledWith({
      kind: "set-literal",
      target: BASE_TARGET,
      part: "root",
      property: "width",
      value: { value: 2, unit: "rem" },
    });

    fireEvent.click(screen.getByRole("radio", { name: "Mobile" }));
    expect(onTargetChange).toHaveBeenCalledWith({ kind: "breakpoint", breakpoint: "mobile" });

    view.rerender(
      <StylePanel
        model={readyModel([color, width])}
        onEdit={onEdit}
        onTargetChange={onTargetChange}
        target={MOBILE_TARGET}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Reset backgroundColor at Mobile" }));
    expect(onEdit).toHaveBeenLastCalledWith({
      kind: "reset",
      target: MOBILE_TARGET,
      part: "root",
      property: "backgroundColor",
    });
  });

  it("uses bounded visual controls for gradient, border, shadow, and typography composites", () => {
    const onEdit = vi.fn(successfulStyleEdit);
    const gradient = styleControl(
      "backgroundGradient",
      "structured-json",
      Object.freeze({ type: "object" }),
      literal(
        Object.freeze({
          angle: 90,
          stops: Object.freeze([
            Object.freeze({ color: "#000000", position: 0 }),
            Object.freeze({ color: "#ffffff", position: 100 }),
          ]),
        }),
      ),
    );
    const border = styleControl("border", "structured-json", Object.freeze({ type: "object" }));
    const shadow = styleControl("boxShadow", "structured-json", Object.freeze({ type: "object" }));
    const typography = styleControl(
      "typography",
      "structured-json",
      Object.freeze({ type: "object" }),
    );
    const radius = styleControl(
      "borderTopLeftRadius",
      "structured-json",
      Object.freeze({ anyOf: Object.freeze([]) }),
    );
    const translate = styleControl(
      "translateX",
      "structured-json",
      Object.freeze({ anyOf: Object.freeze([]) }),
    );
    const position = styleControl(
      "position",
      "enum",
      Object.freeze({ enum: Object.freeze(["static", "relative", "absolute"]) }),
      literal("relative"),
    );
    const rotate = styleControl("rotate", "number", Object.freeze({ type: "number" }), literal(0));
    render(
      <StylePanel
        model={readyModel([
          gradient,
          border,
          shadow,
          typography,
          radius,
          translate,
          position,
          rotate,
        ])}
        onEdit={onEdit}
        target={BASE_TARGET}
      />,
    );

    expect(screen.getByRole("spinbutton", { name: "backgroundGradient angle" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add backgroundGradient stop" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "border style" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add boxShadow layer" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "typography font family 1" })).toBeTruthy();
    expect(screen.getByRole("spinbutton", { name: "borderTopLeftRadius value" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "translateX unit" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "position at Desktop" })).toBeTruthy();
    expect(screen.getByRole("spinbutton", { name: "rotate at Desktop" })).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: /JSON/i })).toBeNull();

    fireEvent.change(screen.getByRole("spinbutton", { name: "backgroundGradient angle" }), {
      target: { value: "45" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply backgroundGradient at Desktop" }));
    expect(onEdit).toHaveBeenLastCalledWith({
      kind: "set-literal",
      target: BASE_TARGET,
      part: "root",
      property: "backgroundGradient",
      value: {
        angle: 45,
        stops: [
          { color: "#000000", position: 0 },
          { color: "#ffffff", position: 100 },
        ],
      },
    });
  });
});
