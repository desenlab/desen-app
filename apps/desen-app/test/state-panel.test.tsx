// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { REFERENCE_EDITOR_DOCUMENT } from "../src/reference-authoring-profile.js";
import { StatePanel } from "../src/state-panel.js";

import type { JsonValue } from "@desen/catalog-sdk";
import type {
  AuthoringStateDeclarationModel,
  AuthoringStateEdit,
  AuthoringStateEditFailureReason,
  AuthoringStateEditResult,
  AuthoringStateModelResult,
  AuthoringStateReadyModel,
  AuthoringStateValueType,
} from "../src/authoring-state.js";

function declaration(
  name: string,
  type: AuthoringStateValueType | null,
  initial: JsonValue,
  usageCount = 0,
): AuthoringStateDeclarationModel {
  return Object.freeze({
    initial,
    name,
    schema: Object.freeze(type === null ? { oneOf: [] } : { type }),
    type,
    usageCount,
  });
}

function readyModel(
  declarations: readonly AuthoringStateDeclarationModel[],
): AuthoringStateReadyModel {
  return Object.freeze({
    declarations: Object.freeze([...declarations]),
    route: Object.freeze({ projectId: "account-app", surfaceId: "sign-in" }),
    status: "ready",
  });
}

function successfulEdit(edit: AuthoringStateEdit): AuthoringStateEditResult {
  void edit;
  return Object.freeze({ document: REFERENCE_EDITOR_DOCUMENT, ok: true });
}

function failedEdit(reason: AuthoringStateEditFailureReason): AuthoringStateEditResult {
  return Object.freeze({ ok: false, reason });
}

describe("Desen App local state panel", () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  });

  afterEach(() => {
    cleanup();
    document.body.replaceChildren();
  });

  it("presents surface-local state in deterministic order without persistence claims", () => {
    const onEdit = vi.fn(successfulEdit);
    render(
      <StatePanel
        model={readyModel([
          declaration("password", "string", "", 3),
          declaration("legacy", null, { $ref: "literal.data" }),
          declaration("email", "string", "", 3),
        ])}
        onEdit={onEdit}
        surfaceName="Sign in"
      />,
    );

    expect(screen.getByRole("heading", { level: 2, name: "Local state" })).toBeTruthy();
    expect(screen.getByText(/Values belong only to Sign in\./u).textContent).toContain(
      "save and publication are not available here",
    );

    const list = screen.getByRole("list", { name: "Sign in local state" });
    const names = within(list)
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);
    expect(names).toEqual(["email", "legacy", "password"]);
    expect(screen.getByLabelText("email usage count").textContent).toBe("Used by 3");

    const emailDelete = screen.getByRole("button", { name: "Delete email local state" });
    expect((emailDelete as HTMLButtonElement).disabled).toBe(true);
    const descriptionId = emailDelete.getAttribute("aria-describedby");
    expect(descriptionId).not.toBeNull();
    expect(document.getElementById(descriptionId as string)?.textContent).toBe(
      "Used states cannot be deleted. Remove 3 uses first.",
    );

    expect(screen.getByLabelText("legacy custom state").textContent).toContain(
      "Read-only custom schema",
    );
    expect(screen.queryByLabelText("legacy initial value")).toBeNull();
    expect(
      (screen.getByRole("button", { name: "Delete legacy local state" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    expect(screen.getByRole("status").textContent).toBe(
      "State edits remain local until Save source succeeds.",
    );
    expect(onEdit).not.toHaveBeenCalled();
  });

  it("submits friendly string, boolean, number, and integer initial controls with one Apply", () => {
    const onEdit = vi.fn(successfulEdit);
    render(
      <StatePanel
        model={readyModel([
          declaration("email", "string", ""),
          declaration("rememberMe", "boolean", false),
          declaration("opacity", "number", 0.5),
          declaration("attempts", "integer", 1),
        ])}
        onEdit={onEdit}
        surfaceName="Sign in"
      />,
    );

    fireEvent.change(screen.getByLabelText("email initial value"), {
      target: { value: "person@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply email local state" }));

    fireEvent.change(screen.getByLabelText("rememberMe initial value"), {
      target: { value: "true" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply rememberMe local state" }));

    fireEvent.change(screen.getByLabelText("opacity initial value"), {
      target: { value: "1.25" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply opacity local state" }));

    fireEvent.change(screen.getByLabelText("attempts initial value"), {
      target: { value: "4" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply attempts local state" }));

    expect(onEdit).toHaveBeenNthCalledWith(1, {
      initial: "person@example.com",
      kind: "update",
      name: "email",
      type: "string",
    });
    expect(onEdit).toHaveBeenNthCalledWith(2, {
      initial: true,
      kind: "update",
      name: "rememberMe",
      type: "boolean",
    });
    expect(onEdit).toHaveBeenNthCalledWith(3, {
      initial: 1.25,
      kind: "update",
      name: "opacity",
      type: "number",
    });
    expect(onEdit).toHaveBeenNthCalledWith(4, {
      initial: 4,
      kind: "update",
      name: "attempts",
      type: "integer",
    });
    expect(screen.getByRole("status").textContent).toBe("Updated attempts local state.");
  });

  it("resets the initial control safely when changing primitive type before Apply", () => {
    const onEdit = vi.fn(successfulEdit);
    render(
      <StatePanel
        model={readyModel([declaration("draft", "string", "Original")])}
        onEdit={onEdit}
        surfaceName="Sign in"
      />,
    );

    fireEvent.change(screen.getByLabelText("draft type"), { target: { value: "boolean" } });
    expect((screen.getByLabelText("draft initial value") as HTMLSelectElement).value).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Apply draft local state" }));

    expect(onEdit).toHaveBeenCalledWith({
      initial: false,
      kind: "update",
      name: "draft",
      type: "boolean",
    });
  });

  it("rejects invalid numeric drafts locally and announces backend update failures", () => {
    const onEdit = vi.fn(() => failedEdit("source-invalid"));
    render(
      <StatePanel
        model={readyModel([declaration("attempts", "integer", 1)])}
        onEdit={onEdit}
        surfaceName="Sign in"
      />,
    );

    fireEvent.change(screen.getByLabelText("attempts initial value"), {
      target: { value: "2.5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply attempts local state" }));

    expect(onEdit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe(
      "Enter a whole finite number for the initial value.",
    );
    expect(screen.getByRole("status").textContent).toBe(
      "Enter a whole finite number for the initial value.",
    );

    fireEvent.change(screen.getByLabelText("attempts initial value"), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply attempts local state" }));

    expect(onEdit).toHaveBeenCalledWith({
      initial: 3,
      kind: "update",
      name: "attempts",
      type: "integer",
    });
    expect(screen.getByRole("alert").textContent).toBe(
      "The Source could not accept this state change.",
    );
    expect(screen.getByRole("status").textContent).toBe(
      "The Source could not accept this state change.",
    );
  });

  it("adds only directly addressable names and reports duplicate state failures", () => {
    const onEdit = vi.fn(successfulEdit);
    render(<StatePanel model={readyModel([])} onEdit={onEdit} surfaceName="Sign in" />);

    const name = screen.getByLabelText("New state name") as HTMLInputElement;
    fireEvent.change(name, { target: { value: "profile.name" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onEdit).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toContain(
      "starts with a letter and contains only letters, numbers, _ or -",
    );

    fireEvent.change(name, { target: { value: "  rememberMe  " } });
    fireEvent.change(screen.getByLabelText("New state type"), { target: { value: "boolean" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onEdit).toHaveBeenLastCalledWith({
      kind: "insert",
      name: "rememberMe",
      type: "boolean",
    });
    expect(name.value).toBe("");
    expect(document.activeElement).toBe(name);
    expect(screen.getByRole("status").textContent).toBe("Added rememberMe local state.");

    onEdit.mockImplementationOnce(() => failedEdit("state-exists"));
    fireEvent.change(name, { target: { value: "email" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByRole("status").textContent).toBe(
      "A local state with this name already exists.",
    );
    expect(name.value).toBe("email");
  });

  it("disables deletion for used state and deletes an unused state through the exact edit", () => {
    const onEdit = vi.fn(successfulEdit);
    render(
      <StatePanel
        model={readyModel([
          declaration("email", "string", "", 3),
          declaration("temporary", "boolean", false),
        ])}
        onEdit={onEdit}
        surfaceName="Sign in"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete email local state" }));
    expect(onEdit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Delete temporary local state" }));
    expect(onEdit).toHaveBeenCalledWith({ kind: "delete", name: "temporary" });
    expect(screen.getByRole("status").textContent).toBe("Deleted temporary local state.");
  });

  it("refreshes an unsaved primitive draft when the projected declaration changes", () => {
    const onEdit = vi.fn(successfulEdit);
    const { rerender } = render(
      <StatePanel
        model={readyModel([declaration("email", "string", "Original")])}
        onEdit={onEdit}
        surfaceName="Sign in"
      />,
    );

    const initial = screen.getByLabelText("email initial value") as HTMLInputElement;
    fireEvent.change(initial, { target: { value: "Unsaved" } });
    expect(initial.value).toBe("Unsaved");

    rerender(
      <StatePanel
        model={readyModel([declaration("email", "string", "From Source")])}
        onEdit={onEdit}
        surfaceName="Sign in"
      />,
    );
    expect((screen.getByLabelText("email initial value") as HTMLInputElement).value).toBe(
      "From Source",
    );
    expect(
      (screen.getByRole("button", { name: "Apply email local state" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("fails closed for rejected projection and keeps the empty ready path actionable", () => {
    const onEdit = vi.fn(successfulEdit);
    const rejected = Object.freeze({
      reason: "route-invalid",
      status: "rejected",
    }) satisfies AuthoringStateModelResult;
    const { rerender } = render(
      <StatePanel model={rejected} onEdit={onEdit} surfaceName="Missing surface" />,
    );

    expect(screen.getByRole("alert").textContent).toContain("Local state unavailable");
    expect(screen.getByRole("alert").textContent).toContain("no longer a valid Source route");
    expect(screen.queryByLabelText("New state name")).toBeNull();

    rerender(<StatePanel model={readyModel([])} onEdit={onEdit} surfaceName="Home" />);
    expect(screen.getByText("No local state yet")).toBeTruthy();
    expect(screen.getByText("Add state to hold values for this surface.")).toBeTruthy();
    expect(screen.getByLabelText("New state name")).toBeTruthy();
    expect(screen.getByRole("status").getAttribute("aria-live")).toBe("polite");
  });
});
