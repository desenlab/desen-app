// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createJsonPointer } from "@desen/protocol";

import { DiagnosticsPanel } from "../src/diagnostics-panel.js";

import type {
  AuthoringDiagnosticOccurrence,
  AuthoringDiagnosticView,
  AuthoringDiagnosticsViewModel,
  AuthoringValidationObligationView,
} from "../src/authoring-diagnostics.js";

const DOCUMENT_FINGERPRINT = `sha256:${"1".repeat(64)}`;
const CATALOG_SET_FINGERPRINT = `sha256:${"2".repeat(64)}`;

function occurrence(
  selectionKey: string,
  subjectId: string,
  occurrencePointer: string,
  kind: "node" | "behavior" = "node",
  previewStatus: "materialized" | "invalid-placeholder" = "invalid-placeholder",
): AuthoringDiagnosticOccurrence {
  return Object.freeze({
    diagnosticIndex: 0,
    selectionKey,
    kind,
    projectId: "account-app",
    surfaceId: "sign-in",
    subjectId,
    occurrencePointer: createJsonPointer(occurrencePointer.split("/").slice(1)),
    previewStatus,
    runtimeNodeIds: Object.freeze(previewStatus === "materialized" ? [`${subjectId}#0`] : []),
  });
}

function diagnostic(
  index: number,
  code: string,
  message: string,
  linkStatus: "linked" | "outside-route" | "unmapped",
  occurrences: readonly AuthoringDiagnosticOccurrence[] = Object.freeze([]),
  pointer = `/diagnostics/${index}`,
): AuthoringDiagnosticView {
  return Object.freeze({
    index,
    code,
    message,
    pointer: createJsonPointer(pointer.split("/").slice(1)),
    context: Object.freeze({
      documentId: "com.example.account-app",
      surfaceId: "sign-in",
      subject: Object.freeze({ kind: "node" as const, id: "identity-looking-context" }),
      capabilityId: null,
    }),
    linkStatus,
    occurrences: Object.freeze([...occurrences]),
  });
}

function obligation(index: number): AuthoringValidationObligationView {
  return Object.freeze({
    index,
    kind: `deferred-${index}`,
    pointer: createJsonPointer(["surfaces", "sign-in", "obligations", String(index)]),
    context: Object.freeze({
      documentId: "com.example.account-app",
      surfaceId: "sign-in",
      subject: Object.freeze({ kind: "node" as const, id: "sign-in.email" }),
      capabilityId: null,
    }),
  });
}

function model(
  diagnostics: readonly AuthoringDiagnosticView[],
  obligations: readonly AuthoringValidationObligationView[] = Object.freeze([]),
): AuthoringDiagnosticsViewModel {
  return Object.freeze({
    route: Object.freeze({ projectId: "account-app", surfaceId: "sign-in" }),
    documentFingerprint: DOCUMENT_FINGERPRINT,
    catalogSetFingerprint: CATALOG_SET_FINGERPRINT,
    valid: diagnostics.length === 0,
    diagnostics: Object.freeze([...diagnostics]),
    obligations: Object.freeze([...obligations]),
  });
}

describe("Desen App diagnostics panel", () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  });

  afterEach(() => {
    cleanup();
    document.body.replaceChildren();
  });

  it("keeps every diagnostic in projector order, announces the count, and does not steal focus", () => {
    const before = document.createElement("button");
    before.textContent = "Existing focus";
    document.body.append(before);
    before.focus();

    render(
      <DiagnosticsPanel
        model={model([
          diagnostic(7, "ZETA_CODE", "First projected diagnostic", "unmapped"),
          diagnostic(1, "ALPHA_CODE", "Second projected diagnostic", "outside-route"),
          diagnostic(4, "MIDDLE_CODE", "Third projected diagnostic", "unmapped"),
        ])}
        onDismiss={vi.fn()}
        onSelect={vi.fn()}
        selectedSelectionKey={null}
      />,
    );

    expect(screen.getByRole("status").textContent).toContain("3 issues");
    expect(document.activeElement).toBe(before);
    expect(
      [...document.querySelectorAll<HTMLElement>("[data-diagnostic-index]")].map(
        (item) => item.dataset.diagnosticIndex,
      ),
    ).toEqual(["7", "1", "4"]);
    expect(
      [...document.querySelectorAll<HTMLElement>("[data-diagnostic-index]")].map(
        (item) => item.textContent,
      ),
    ).toEqual([
      expect.stringContaining("First projected diagnostic"),
      expect.stringContaining("Second projected diagnostic"),
      expect.stringContaining("Third projected diagnostic"),
    ]);
  });

  it("renders every explicitly mapped occurrence as a native selection button", () => {
    const onSelect = vi.fn();
    const onDismiss = vi.fn();
    const first = occurrence("selection-one", "sign-in.email", "/surfaces/sign-in/root/0");
    const second = occurrence(
      "selection-two",
      "sign-in.submit",
      "/surfaces/sign-in/root/1/behaviors/0",
      "behavior",
      "materialized",
    );

    render(
      <DiagnosticsPanel
        model={model([
          diagnostic(0, "SOURCE_INVALID", "Two explicit targets", "linked", [first, second]),
        ])}
        onDismiss={onDismiss}
        onSelect={onSelect}
        selectedSelectionKey="selection-two"
      />,
    );

    const targetGroup = screen.getByRole("group", { name: "Source targets for issue 1" });
    const firstTarget = within(targetGroup).getByRole("button", {
      name: "Select Node sign-in.email at /surfaces/sign-in/root/0",
    });
    const secondTarget = within(targetGroup).getByRole("button", {
      name: "Select Behavior sign-in.submit at /surfaces/sign-in/root/1/behaviors/0",
    });
    expect(firstTarget.tagName).toBe("BUTTON");
    expect(firstTarget.hasAttribute("aria-current")).toBe(false);
    expect(secondTarget.getAttribute("aria-current")).toBe("true");

    fireEvent.click(firstTarget);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("selection-one");

    fireEvent.click(screen.getByRole("button", { name: "Dismiss validation diagnostics" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("leaves identity-looking unmapped and out-of-route metadata readable but non-selectable", () => {
    const onSelect = vi.fn();
    render(
      <DiagnosticsPanel
        model={model(
          [
            diagnostic(
              0,
              "NODE_sign-in.password",
              "Select sign-in.password from this message",
              "unmapped",
              [],
              "/surfaces/sign-in/nodes/sign-in.password",
            ),
            diagnostic(1, "OTHER_SURFACE", "Profile target remains visible", "outside-route"),
          ],
          [obligation(0)],
        )}
        onDismiss={vi.fn()}
        onSelect={onSelect}
        selectedSelectionKey={null}
      />,
    );

    expect(screen.getByText("Select sign-in.password from this message").isConnected).toBe(true);
    expect(screen.getByText("/surfaces/sign-in/nodes/sign-in.password").isConnected).toBe(true);
    expect(screen.getByText("No Source target").isConnected).toBe(true);
    expect(screen.getByText("Outside this surface").isConnected).toBe(true);
    expect(screen.getByText("deferred-0").isConnected).toBe(true);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("renders a neutral empty projection and the singular live count", () => {
    const { rerender } = render(
      <DiagnosticsPanel
        model={model([])}
        onDismiss={vi.fn()}
        onSelect={vi.fn()}
        selectedSelectionKey={null}
      />,
    );
    expect(screen.getByRole("status").textContent).toContain("0 issues");
    expect(screen.getByText("No validation issues in this snapshot.").isConnected).toBe(true);

    rerender(
      <DiagnosticsPanel
        model={model([diagnostic(0, "ONLY_ONE", "One diagnostic", "unmapped")])}
        onDismiss={vi.fn()}
        onSelect={vi.fn()}
        selectedSelectionKey={null}
      />,
    );
    expect(screen.getByRole("status").textContent).toContain("1 issue");
  });
});
