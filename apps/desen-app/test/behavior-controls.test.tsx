// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { prepareAuthoringInspectorModel } from "../src/authoring-inspector.js";
import { REFERENCE_AUTHORING_MODEL } from "../src/authoring-data.js";
import { createAuthoringComponentSelection } from "../src/authoring-selection.js";
import { InputConnectionControl, VisibilityControl } from "../src/behavior-controls.js";
import { REFERENCE_EDITOR_DOCUMENT } from "../src/authoring-preview.js";

import type {
  AuthoringConditionEdit,
  AuthoringConditionEditResult,
} from "../src/authoring-conditions.js";

const ROUTE = Object.freeze({ projectId: "account-app", surfaceId: "sign-in" });

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
