// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PersistenceControls } from "../src/persistence-controls.js";

import type {
  PersistenceControlProjection,
  PersistenceControlStatus,
} from "../src/persistence-controls.js";

const DEFAULT_CONFIRMATION_SCOPE = Object.freeze({});

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

function projection(
  status: PersistenceControlStatus = Object.freeze({ state: "ready" }),
  overrides: Partial<Omit<PersistenceControlProjection, "status">> = {},
): PersistenceControlProjection {
  return Object.freeze({
    dirty: true,
    generation: 3,
    reopenRequired: false,
    status,
    ...overrides,
  });
}

function renderControls({
  busy = false,
  confirmationScope = DEFAULT_CONFIRMATION_SCOPE,
  designMode = true,
  onOpen = vi.fn(),
  onSave = vi.fn(),
  value = projection(),
}: Readonly<{
  readonly busy?: boolean;
  readonly confirmationScope?: object | null;
  readonly designMode?: boolean;
  readonly onOpen?: () => void;
  readonly onSave?: () => void;
  readonly value?: PersistenceControlProjection;
}> = {}) {
  const result = render(
    <PersistenceControls
      busy={busy}
      confirmationScope={confirmationScope}
      designMode={designMode}
      onOpen={onOpen}
      onSave={onSave}
      projection={value}
    />,
  );
  const region = screen.getByRole("region", { name: "Source persistence" });
  return Object.freeze({
    ...result,
    open: within(region).getByRole("button", { name: "Open source" }) as HTMLButtonElement,
    region,
    save: within(region).getByRole("button", { name: "Save source" }) as HTMLButtonElement,
  });
}

describe("Desen App Source persistence controls", () => {
  it("projects generation and dirty state in text and delegates admitted actions", () => {
    const onOpen = vi.fn();
    const onSave = vi.fn();
    const { open, region, save } = renderControls({ onOpen, onSave });

    expect(region.getAttribute("data-persistence-state")).toBe("ready");
    expect(within(region).getByLabelText("Source persistence state").textContent).toContain(
      "Generation 3",
    );
    expect(within(region).getByLabelText("Source persistence state").textContent).toContain(
      "Unsaved changes",
    );
    expect(within(region).queryByText("Reopen required")).toBeNull();
    expect(within(region).getByRole("status").textContent).toBe("Unsaved changes. Generation 3.");
    expect(within(region).getByRole("status").getAttribute("aria-live")).toBe("polite");
    expect(within(region).queryByRole("textbox")).toBeNull();
    expect(open.disabled).toBe(false);
    expect(save.disabled).toBe(false);

    fireEvent.click(save);
    expect(onOpen).not.toHaveBeenCalled();
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("requires explicit inline confirmation before a dirty Source can be opened", () => {
    const onOpen = vi.fn();
    const { open, region } = renderControls({ onOpen });
    const confirmationId = open.getAttribute("aria-controls");

    expect(confirmationId).not.toBeNull();
    expect(open.getAttribute("aria-expanded")).toBe("false");
    expect(within(region).queryByRole("alert")).toBeNull();

    fireEvent.click(open);
    expect(onOpen).not.toHaveBeenCalled();
    expect(open.getAttribute("aria-expanded")).toBe("true");
    const alert = within(region).getByRole("alert");
    expect(alert.id).toBe(confirmationId);
    expect(within(alert).getByText("Discard unsaved changes?")).toBeTruthy();
    expect(alert.textContent).toContain(
      "Opening the stored Source will replace the current authored Source in this session.",
    );

    fireEvent.click(within(alert).getByRole("button", { name: "Cancel open" }));
    expect(onOpen).not.toHaveBeenCalled();
    expect(within(region).queryByRole("alert")).toBeNull();
    expect(document.activeElement).toBe(open);

    fireEvent.click(open);
    const confirm = within(region).getByRole("button", { name: "Discard changes and open" });
    confirm.focus();
    expect(document.activeElement).toBe(confirm);
    fireEvent.click(confirm);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(within(region).queryByRole("alert")).toBeNull();
    expect(open.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(open);
  });

  it("revokes a dirty-open confirmation when its exact authority identity changes", () => {
    const firstScope = Object.freeze({});
    const secondScope = Object.freeze({});
    const onOpen = vi.fn();
    const value = projection();
    const rendered = renderControls({ confirmationScope: firstScope, onOpen, value });

    fireEvent.click(rendered.open);
    const staleConfirm = within(rendered.region).getByRole("button", {
      name: "Discard changes and open",
    });

    rendered.rerender(
      <PersistenceControls
        busy={false}
        confirmationScope={secondScope}
        designMode
        onOpen={onOpen}
        onSave={() => undefined}
        projection={value}
      />,
    );

    expect(within(rendered.region).queryByRole("alert")).toBeNull();
    fireEvent.click(staleConfirm);
    expect(onOpen).not.toHaveBeenCalled();

    fireEvent.click(rendered.open);
    expect(within(rendered.region).getByRole("alert")).toBeTruthy();
    fireEvent.click(
      within(rendered.region).getByRole("button", { name: "Discard changes and open" }),
    );
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  const statusCases = [
    [
      Object.freeze({ state: "unavailable" }),
      "Persistence unavailable. This environment cannot open or save Sources.",
    ],
    [
      Object.freeze({ state: "missing" }),
      "No stored Source exists yet. Save source will create generation 1.",
    ],
    [Object.freeze({ state: "opening" }), "Opening Source…"],
    [Object.freeze({ state: "saving" }), "Saving Source…"],
    [
      Object.freeze({ operation: "open", state: "success" }),
      "Source opened successfully. Generation 3.",
    ],
    [
      Object.freeze({ operation: "save", state: "success" }),
      "Source snapshot saved successfully. Newer changes remain unsaved. Generation 3.",
    ],
    [
      Object.freeze({ state: "conflict" }),
      "Save conflict. A newer stored generation exists; reopen before saving again.",
    ],
    [
      Object.freeze({ state: "indeterminate" }),
      "Save outcome is uncertain. Reopen to confirm the stored Source before saving again.",
    ],
    [
      Object.freeze({ operation: "open", state: "failed" }),
      "Open failed. The current session draft was preserved.",
    ],
    [
      Object.freeze({ operation: "save", state: "failed" }),
      "Save failed. The current session draft was preserved.",
    ],
    [
      Object.freeze({ state: "exhausted" }),
      "Generation limit reached. This storage identity cannot accept another changed Source.",
    ],
  ] as const satisfies readonly (readonly [PersistenceControlStatus, string])[];

  for (const [status, message] of statusCases) {
    it(`announces the ${status.state} projection without relying on color`, () => {
      const { region } = renderControls({ value: projection(status) });

      expect(region.getAttribute("data-persistence-state")).toBe(status.state);
      expect(within(region).getByRole("status").textContent).toBe(message);
      expect(within(region).getByText("Generation 3")).toBeTruthy();
      expect(within(region).getByText("Unsaved changes")).toBeTruthy();
    });
  }

  it("shows the empty generation, clean state, and explicit reopen requirement", () => {
    const { region, save } = renderControls({
      value: projection(Object.freeze({ state: "ready" }), {
        dirty: false,
        generation: null,
        reopenRequired: true,
      }),
    });

    expect(within(region).getByText("Generation —")).toBeTruthy();
    expect(within(region).getByText("Saved")).toBeTruthy();
    expect(within(region).getByText("Reopen required")).toBeTruthy();
    expect(within(region).getByRole("status").textContent).toBe(
      "Reopen required before another save.",
    );
    expect(save.disabled).toBe(true);
  });

  it("reports a fully current Source when save success settles without newer edits", () => {
    const { region } = renderControls({
      value: projection(Object.freeze({ operation: "save", state: "success" }), {
        dirty: false,
      }),
    });

    expect(within(region).getByRole("status").textContent).toBe(
      "Source saved successfully. Generation 3.",
    );
    expect(within(region).getByText("Saved")).toBeTruthy();
  });

  it("keeps a clean Source save disabled while leaving open admitted", () => {
    const onOpen = vi.fn();
    const onSave = vi.fn();
    const { open, save } = renderControls({
      onOpen,
      onSave,
      value: projection(Object.freeze({ state: "ready" }), { dirty: false }),
    });

    expect(open.disabled).toBe(false);
    expect(save.disabled).toBe(true);
    fireEvent.click(open);
    fireEvent.click(save);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("resets dirty-open confirmation when admission or persistence status changes", () => {
    const cases = [
      Object.freeze({
        busy: true,
        designMode: true,
        value: projection(),
      }),
      Object.freeze({
        busy: false,
        designMode: false,
        value: projection(),
      }),
      Object.freeze({
        busy: false,
        designMode: true,
        value: projection(Object.freeze({ state: "ready" }), { dirty: false }),
      }),
      Object.freeze({
        busy: false,
        designMode: true,
        value: projection(Object.freeze({ state: "unavailable" })),
      }),
      Object.freeze({
        busy: false,
        designMode: true,
        value: projection(Object.freeze({ operation: "open", state: "failed" })),
      }),
    ];

    for (const [index, entry] of cases.entries()) {
      const onOpen = vi.fn();
      const rendered = renderControls({ onOpen });
      fireEvent.click(rendered.open);
      expect(within(rendered.region).getByRole("alert")).toBeTruthy();

      rendered.rerender(
        <PersistenceControls
          busy={entry.busy}
          confirmationScope={DEFAULT_CONFIRMATION_SCOPE}
          designMode={entry.designMode}
          onOpen={onOpen}
          onSave={() => undefined}
          projection={entry.value}
        />,
      );

      expect(within(rendered.region).queryByRole("alert")).toBeNull();
      expect(onOpen).not.toHaveBeenCalled();
      rendered.unmount();
      if (index < cases.length - 1) document.body.replaceChildren();
    }
  });

  it("blocks both actions outside Design mode and explains admission", () => {
    const { open, region, save } = renderControls({ designMode: false });

    expect(open.disabled).toBe(true);
    expect(save.disabled).toBe(true);
    expect(within(region).getByText("Open and save are available in Design mode.")).toBeTruthy();
  });

  it("blocks both actions for external busy, opening, saving, and unavailable states", () => {
    const cases = [
      Object.freeze({ busy: true, status: Object.freeze({ state: "ready" as const }) }),
      Object.freeze({ busy: false, status: Object.freeze({ state: "opening" as const }) }),
      Object.freeze({ busy: false, status: Object.freeze({ state: "saving" as const }) }),
      Object.freeze({ busy: false, status: Object.freeze({ state: "unavailable" as const }) }),
    ];

    for (const [index, entry] of cases.entries()) {
      const rendered = renderControls({ busy: entry.busy, value: projection(entry.status) });
      expect(rendered.open.disabled).toBe(true);
      expect(rendered.save.disabled).toBe(true);
      expect(rendered.region.getAttribute("aria-busy")).toBe(
        entry.busy || entry.status.state === "opening" || entry.status.state === "saving"
          ? "true"
          : "false",
      );
      rendered.unmount();
      if (index < cases.length - 1) document.body.replaceChildren();
    }
  });

  it("admits reopen but blocks save after conflict, uncertainty, or generation exhaustion", () => {
    const statuses = [
      Object.freeze({ state: "conflict" as const }),
      Object.freeze({ state: "indeterminate" as const }),
      Object.freeze({ state: "exhausted" as const }),
    ];

    for (const [index, status] of statuses.entries()) {
      const onOpen = vi.fn();
      const rendered = renderControls({
        onOpen,
        value: projection(status, { reopenRequired: true }),
      });
      expect(rendered.open.disabled).toBe(false);
      expect(rendered.save.disabled).toBe(true);
      expect(within(rendered.region).getByText("Reopen required")).toBeTruthy();
      fireEvent.click(rendered.open);
      expect(onOpen).not.toHaveBeenCalled();
      expect(within(rendered.region).getByRole("alert").textContent).toContain(
        "Discard unsaved changes?",
      );
      rendered.unmount();
      if (index < statuses.length - 1) document.body.replaceChildren();
    }
  });

  it("allows a definite failed save to be retried while the draft remains dirty", () => {
    const { open, save } = renderControls({
      value: projection(Object.freeze({ operation: "save", state: "failed" })),
    });

    expect(open.disabled).toBe(false);
    expect(save.disabled).toBe(false);
  });
});
