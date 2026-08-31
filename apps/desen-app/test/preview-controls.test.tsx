// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PreviewContextDisclosure,
  RunControls,
  ScenarioPreviewControl,
} from "../src/preview-controls.js";

import type {
  AuthoringOperationFixtureControllerSnapshot,
  AuthoringOperationFixtureSnapshot,
} from "../src/authoring-fixtures.js";
import type { AuthoringScenarioModelResult } from "../src/authoring-scenarios.js";
import type { PreviewFidelityProjection } from "../src/preview-fidelity.js";

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

describe("Desen App preview disclosures", () => {
  it("renders every approximate difference and undeclared adapter without color-only meaning", () => {
    const fidelity = Object.freeze({
      status: "ready",
      kind: "approximate",
      entries: Object.freeze([
        Object.freeze({
          capabilityId: "com.example.ui/Approximate",
          displayName: "Approximate control",
          kind: "approximate",
          differences: Object.freeze(["Animation is omitted.", "Focus ring timing differs."]),
        }),
        Object.freeze({
          capabilityId: "com.example.ui/Unknown",
          displayName: "Unknown control",
          kind: "undeclared",
          differences: Object.freeze([]),
        }),
      ]),
    }) satisfies PreviewFidelityProjection;

    render(<PreviewContextDisclosure fidelity={fidelity} />);

    const disclosure = screen.getByRole("region", { name: "Preview context and fidelity" });
    expect(disclosure.getAttribute("data-fidelity")).toBe("approximate");
    expect(within(disclosure).getByText("Approximate preview")).toBeTruthy();
    const alert = within(disclosure).getByRole("alert");
    expect(alert.textContent).toContain("Known preview differences");
    expect(alert.textContent).toContain("Approximate control · Animation is omitted.");
    expect(alert.textContent).toContain("Approximate control · Focus ring timing differs.");
    expect(alert.textContent).toContain("Fidelity not declared for Unknown control.");
  });

  it("keeps the scenario selector closed to the exact projected values", () => {
    const onChange = vi.fn();
    const model = Object.freeze({
      status: "ready",
      route: Object.freeze({ projectId: "account-app", surfaceId: "sign-in" }),
      selection: Object.freeze({
        kind: "component",
        projectId: "account-app",
        surfaceId: "sign-in",
        sourceNodeId: "sign-in.email",
        capabilityId: "com.example.ui/TextField",
        displayName: "Text field",
        conditional: false,
      }),
      options: Object.freeze([
        Object.freeze({
          kind: "source",
          value: "source",
          scenarioId: null,
          label: "Source values",
          description: "Current authored component properties.",
        }),
        Object.freeze({
          kind: "catalog",
          value: "catalog:invalid",
          scenarioId: "invalid",
          label: "invalid",
          description: undefined,
        }),
      ]),
    }) satisfies AuthoringScenarioModelResult;

    render(<ScenarioPreviewControl model={model} onChange={onChange} value="source" />);

    const scenario = screen.getByRole("combobox", { name: "Component values" });
    expect(
      within(scenario)
        .getAllByRole("option")
        .map((option) => option.getAttribute("value")),
    ).toEqual(["source", "catalog:invalid"]);
    expect(screen.getByText("Preview only · not saved or published")).toBeTruthy();
    fireEvent.change(scenario, { target: { value: "catalog:invalid" } });
    expect(onChange).toHaveBeenCalledWith("catalog:invalid");
  });

  it("shows generic Source aliases and enables only the matching pending completion", () => {
    const onComplete = vi.fn();
    const onSelectOutcome = vi.fn();
    const operation = Object.freeze({
      alias: "saveDraft",
      capabilityId: "com.example.documents/save",
      description: "Save a document draft.",
      effect: "network",
      outcomes: Object.freeze([
        Object.freeze({
          id: "success",
          label: "Success",
          kind: "success",
          errorCode: null,
          description: "Catalog-declared synthetic success.",
          fixtureValue: Object.freeze({ documentId: "document-7" }),
        }),
        Object.freeze({
          id: "error:conflict",
          label: "Error · conflict",
          kind: "error",
          errorCode: "conflict",
          description: "The draft changed elsewhere.",
          fixtureValue: Object.freeze({}),
        }),
      ]),
      status: "pending",
      selectedOutcomeId: "error:conflict",
      completedOutcomeId: null,
    }) satisfies AuthoringOperationFixtureSnapshot;
    const pending = Object.freeze({
      modelStatus: "ready",
      rejectionReason: null,
      disposed: false,
      operations: Object.freeze([operation]),
    }) satisfies AuthoringOperationFixtureControllerSnapshot;

    render(
      <RunControls onComplete={onComplete} onSelectOutcome={onSelectOutcome} snapshot={pending} />,
    );

    const controls = screen.getByRole("complementary", { name: "Run controls" });
    expect(
      (within(controls).getByRole("radio", { name: /^Synthetic/ }) as HTMLInputElement).checked,
    ).toBe(true);
    expect(
      (within(controls).getByRole("radio", { name: /^Integration/ }) as HTMLInputElement).disabled,
    ).toBe(true);
    expect(
      (within(controls).getByRole("radio", { name: /^Production/ }) as HTMLInputElement).disabled,
    ).toBe(true);
    const outcome = within(controls).getByRole("combobox", {
      name: "Next outcome for saveDraft",
    }) as HTMLSelectElement;
    expect(outcome.disabled).toBe(true);
    expect([...outcome.options].map(({ value }) => value)).toEqual(["success", "error:conflict"]);
    expect(within(controls).getByText(/com\.example\.documents\/save · network/)).toBeTruthy();
    const complete = within(controls).getByRole("button", {
      name: "Complete saveDraft fixture",
    });
    expect((complete as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(complete);
    expect(onComplete).toHaveBeenCalledWith("saveDraft");
    expect(within(controls).getByRole("status").textContent).toContain("Pending");
  });

  it("renders an honest no-operation state without a fabricated outcome selector", () => {
    const snapshot = Object.freeze({
      modelStatus: "ready",
      rejectionReason: null,
      disposed: false,
      operations: Object.freeze([]),
    }) satisfies AuthoringOperationFixtureControllerSnapshot;

    render(<RunControls onComplete={vi.fn()} onSelectOutcome={vi.fn()} snapshot={snapshot} />);

    const controls = screen.getByRole("complementary", { name: "Run controls" });
    expect(within(controls).getByRole("status").textContent).toContain("No simulated operations");
    expect(within(controls).queryByRole("combobox")).toBeNull();
    expect(within(controls).queryByRole("button")).toBeNull();
  });
});
