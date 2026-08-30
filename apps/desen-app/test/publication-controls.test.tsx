// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PublicationControls } from "../src/publication-controls.js";

import type {
  PublicationControlProjection,
  PublicationControlStatus,
} from "../src/publication-controls.js";

const REVISION = `sha256:${"a".repeat(64)}`;
const PREVIOUS_REVISION = `sha256:${"b".repeat(64)}`;

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

function projection(status: PublicationControlStatus): PublicationControlProjection {
  return Object.freeze({ channelName: "preview", status });
}

function renderControls({
  busy = false,
  designMode = true,
  onPublish = vi.fn(),
  status = Object.freeze({ state: "ready", sourceGeneration: 4 }),
}: Readonly<{
  readonly busy?: boolean;
  readonly designMode?: boolean;
  readonly onPublish?: () => void;
  readonly status?: PublicationControlStatus;
}> = {}) {
  const result = render(
    <PublicationControls
      busy={busy}
      designMode={designMode}
      onPublish={onPublish}
      projection={projection(status)}
    />,
  );
  const region = screen.getByRole("region", { name: "Publish saved Source" });
  return Object.freeze({
    ...result,
    button: within(region).getByRole("button", { name: /Publish|Publishing|Activating/u }),
    region,
  });
}

describe("Desen App publication controls", () => {
  it("publishes only an admitted saved generation and explains transient-data isolation", () => {
    const onPublish = vi.fn();
    const { button, region } = renderControls({ onPublish });

    expect(region.getAttribute("data-publication-state")).toBe("ready");
    expect(button).toHaveProperty("disabled", false);
    expect(within(region).getByRole("status").textContent).toBe(
      "Saved generation 4 is ready to publish.",
    );
    expect(region.textContent).toContain(
      "Only the exact saved Source is published. Preview scenarios and fixture data stay local.",
    );
    expect(within(region).getByRole("list", { name: "Publication stages" })).toBeTruthy();

    fireEvent.click(button);
    expect(onPublish).toHaveBeenCalledTimes(1);
  });

  it("blocks publication without a saved Source or trusted host port", () => {
    for (const status of [
      Object.freeze({ state: "save-required" as const }),
      Object.freeze({ state: "unavailable" as const }),
    ]) {
      const rendered = renderControls({ status });
      expect(rendered.button).toHaveProperty("disabled", true);
      expect(within(rendered.region).getByRole("status").textContent).toMatch(
        status.state === "save-required" ? /Save the current Source/u : /not configured/u,
      );
      rendered.unmount();
      document.body.replaceChildren();
    }
  });

  it("shows Publisher, channel, and activation as separate pending stages", () => {
    for (const stage of ["publisher", "channel", "activation"] as const) {
      const rendered = renderControls({
        status: Object.freeze({
          state: "pending",
          stage,
          sourceGeneration: 4,
          revision: stage === "publisher" ? null : REVISION,
        }),
      });
      const items = within(rendered.region).getAllByRole("listitem");
      expect(rendered.button).toHaveProperty("disabled", true);
      expect(rendered.region.getAttribute("aria-busy")).toBe("true");
      expect(items.map((item) => item.getAttribute("data-stage-state"))).toEqual(
        stage === "publisher"
          ? ["done", "current", "blocked"]
          : stage === "channel"
            ? ["done", "current", "blocked"]
            : ["done", "done", "current"],
      );
      rendered.unmount();
      document.body.replaceChildren();
    }
  });

  it("claims Active only with distinct Source, channel, and durable activation receipts", () => {
    const { region } = renderControls({
      status: Object.freeze({
        state: "active",
        relationship: "activated",
        revision: REVISION,
        sourceGeneration: 4,
        channelGeneration: 7,
        activationGeneration: 3,
      }),
    });

    expect(within(region).getByRole("status").textContent).toContain("is active");
    const receipt = within(region).getByText("Revision", { selector: "dt" }).parentElement;
    expect(receipt?.textContent).toContain("sha256:aaa");
    expect(region.textContent).toContain("Sourceg4");
    expect(region.textContent).toContain("Channelg7");
    expect(region.textContent).toContain("Activationg3");
    expect(
      within(region)
        .getAllByRole("listitem")
        .every((item) => item.getAttribute("data-stage-state") === "done"),
    ).toBe(true);
  });

  it("reports channel conflict without presenting reference-host activation", () => {
    const { region } = renderControls({
      status: Object.freeze({
        state: "conflict",
        currentChannelGeneration: 8,
        sourceGeneration: 4,
        revision: REVISION,
      }),
    });

    expect(within(region).getByRole("status").textContent).toContain(
      "preview channel moved to generation 8 concurrently",
    );
    expect(
      within(region)
        .getAllByRole("listitem")
        .map((item) => item.getAttribute("data-stage-state")),
    ).toEqual(["done", "failed", "blocked"]);
    expect(region.textContent).not.toContain("is active");
  });

  it("shows a separately preserved last-known-good revision after activation rejection", () => {
    const { region } = renderControls({
      status: Object.freeze({
        state: "preserved",
        activeRevision: PREVIOUS_REVISION,
        publishedRevision: REVISION,
        sourceGeneration: 4,
        channelGeneration: 7,
      }),
    });

    expect(within(region).getByRole("status").textContent).toContain(
      "reference host preserved sha256:bbb",
    );
    expect(
      within(region)
        .getAllByRole("listitem")
        .map((item) => item.getAttribute("data-stage-state")),
    ).toEqual(["done", "done", "failed"]);
  });

  it("blocks blind retry after an indeterminate publication result", () => {
    const { button, region } = renderControls({
      status: Object.freeze({
        state: "indeterminate",
        stage: "channel",
        sourceGeneration: 4,
        revision: REVISION,
      }),
    });

    expect(button).toHaveProperty("disabled", true);
    expect(within(region).getByRole("status").textContent).toContain("outcome is uncertain");
  });

  it("blocks the action outside Design mode and while another App operation is busy", () => {
    for (const input of [
      Object.freeze({ busy: false, designMode: false }),
      Object.freeze({ busy: true, designMode: true }),
    ]) {
      const rendered = renderControls(input);
      expect(rendered.button).toHaveProperty("disabled", true);
      expect(rendered.region.getAttribute("aria-busy")).toBe(input.busy ? "true" : "false");
      if (!input.designMode) {
        expect(rendered.region.textContent).toContain("Publish is available in Design mode.");
      }
      rendered.unmount();
      document.body.replaceChildren();
    }
  });
});
