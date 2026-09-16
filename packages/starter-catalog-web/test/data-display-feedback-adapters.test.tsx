// @vitest-environment jsdom

import { createElement } from "react";
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  StarterAlertReactAdapter,
  StarterAvatarReactAdapter,
  StarterBadgeReactAdapter,
  StarterCardReactAdapter,
  StarterListReactAdapter,
  StarterProgressReactAdapter,
  StarterSkeletonReactAdapter,
  StarterTableReactAdapter,
} from "../src/react-adapters.js";
import {
  STARTER_ALERT_CAPABILITY_ID,
  STARTER_AVATAR_CAPABILITY_ID,
  STARTER_BADGE_CAPABILITY_ID,
  STARTER_CARD_CAPABILITY_ID,
  STARTER_LIST_CAPABILITY_ID,
  STARTER_PROGRESS_CAPABILITY_ID,
  STARTER_SKELETON_CAPABILITY_ID,
  STARTER_TABLE_CAPABILITY_ID,
} from "../src/contracts.js";

import type {
  RuntimeReactComponentAdapterProps,
  RuntimeReactInteractionPort,
} from "@desen/runtime-react";

afterEach(() => {
  document.body.replaceChildren();
});

function input(
  capabilityId: string,
  props: Readonly<Record<string, unknown>>,
  slots: RuntimeReactComponentAdapterProps["slots"] = {},
  style: RuntimeReactComponentAdapterProps["style"] = { base: {} },
): RuntimeReactComponentAdapterProps {
  const interactions = Object.freeze({
    dispatchEvent: () => Object.freeze({ status: "unavailable" }),
    attachCommands: () => Object.freeze({ status: "unavailable" }),
    detachCommands: () => Object.freeze({ status: "unavailable" }),
  } satisfies RuntimeReactInteractionPort);
  return {
    identity: { capabilityId, sourceNodeId: "t09", runtimeNodeId: "t09:instance" },
    props: props as RuntimeReactComponentAdapterProps["props"],
    slots,
    style,
    interactions,
  };
}

describe("M10A-T09 data-display and feedback Web adapters", () => {
  it("renders explicit Card and List managed slots with stable list identities", () => {
    const card = input(
      STARTER_CARD_CAPABILITY_ID,
      { label: "Project summary" },
      {
        content: ["Card content"],
      },
    );
    const list = input(
      STARTER_LIST_CAPABILITY_ID,
      { label: "Project tasks", itemIds: ["research", "prototype"] },
      {
        items: [
          createElement("span", { key: "research" }, "Research"),
          createElement("span", { key: "prototype" }, "Prototype"),
        ],
      },
    );
    const view = render(
      <>
        <StarterCardReactAdapter {...card} />
        <StarterListReactAdapter {...list} />
      </>,
    );
    expect(view.getByRole("article", { name: "Project summary" }).textContent).toContain(
      "Card content",
    );
    expect(view.getByRole("list", { name: "Project tasks" })).toBeTruthy();
    expect(view.getAllByRole("listitem")).toHaveLength(2);
    expect(view.container.querySelector("[data-desen-item-id='prototype']")?.textContent).toContain(
      "Prototype",
    );
  });

  it("renders basic native Table semantics, captions, complete cells, and stable row identities", () => {
    const ready = input(STARTER_TABLE_CAPABILITY_ID, {
      caption: "Project status",
      columns: [
        { id: "name", label: "Name" },
        { id: "status", label: "Status" },
      ],
      rows: [
        { id: "research", cells: { name: "Research", status: "Ready" } },
        { id: "prototype", cells: { name: "Prototype", status: "In progress" } },
      ],
    });
    const empty = input(STARTER_TABLE_CAPABILITY_ID, {
      caption: "Empty status",
      columns: [{ id: "name", label: "Name" }],
      rows: [],
      emptyText: "No project rows yet.",
    });
    const view = render(
      <>
        <StarterTableReactAdapter {...ready} />
        <StarterTableReactAdapter {...empty} />
      </>,
    );
    expect(view.getByRole("table", { name: "Project status" })).toBeTruthy();
    expect(view.getAllByRole("columnheader", { name: "Name" })).toHaveLength(2);
    expect(view.getByRole("cell", { name: "In progress" })).toBeTruthy();
    expect(view.container.querySelector("tr[data-desen-row-id='prototype']")).toBeTruthy();
    expect(view.getByRole("cell", { name: "No project rows yet." }).getAttribute("colspan")).toBe(
      "1",
    );
  });

  it("renders visible and accessible feedback across ready, error, and loading examples", () => {
    const badge = input(STARTER_BADGE_CAPABILITY_ID, { label: "Ready", tone: "success" });
    const avatar = input(STARTER_AVATAR_CAPABILITY_ID, { label: "Ada Lovelace", initials: "AL" });
    const alert = input(STARTER_ALERT_CAPABILITY_ID, {
      title: "Could not save changes",
      description: "Your draft is still available locally.",
      tone: "error",
    });
    const skeleton = input(STARTER_SKELETON_CAPABILITY_ID, {
      label: "Loading project details",
      shape: "circle",
      width: 40,
      height: 40,
    });
    const progress = input(STARTER_PROGRESS_CAPABILITY_ID, {
      label: "Uploading assets",
      value: 45,
      showValue: true,
    });
    const view = render(
      <>
        <StarterBadgeReactAdapter {...badge} />
        <StarterAvatarReactAdapter {...avatar} />
        <StarterAlertReactAdapter {...alert} />
        <StarterSkeletonReactAdapter {...skeleton} />
        <StarterProgressReactAdapter {...progress} />
      </>,
    );
    expect(view.getByText("Ready").getAttribute("data-tone")).toBe("success");
    expect(view.getByRole("img", { name: "Ada Lovelace" }).textContent).toBe("AL");
    expect(view.getByRole("alert").textContent).toContain("Your draft is still available locally.");
    expect(view.getByRole("status", { name: "Loading project details" })).toBeTruthy();
    expect(
      view.getByRole("progressbar", { name: "Uploading assets" }).getAttribute("aria-valuenow"),
    ).toBe("45");
    expect(view.getByText("45%")).toBeTruthy();
  });

  it("rejects missing explicit slots, duplicate identities, incomplete rows, and unbounded data", () => {
    const missingCardSlot = input(STARTER_CARD_CAPABILITY_ID, { label: "Project summary" });
    const duplicateListIds = input(
      STARTER_LIST_CAPABILITY_ID,
      { label: "Tasks", itemIds: ["same", "same"] },
      { items: ["First", "Second"] },
    );
    const incompleteRow = input(STARTER_TABLE_CAPABILITY_ID, {
      caption: "Project status",
      columns: [
        { id: "name", label: "Name" },
        { id: "status", label: "Status" },
      ],
      rows: [{ id: "research", cells: { name: "Research" } }],
    });
    const executableData = input(STARTER_BADGE_CAPABILITY_ID, {
      label: () => "not inert",
    });
    const tooManyRows = input(STARTER_TABLE_CAPABILITY_ID, {
      caption: "Project status",
      columns: [{ id: "name", label: "Name" }],
      rows: Array.from({ length: 101 }, (_, index) => ({
        id: `row-${index}`,
        cells: { name: `Row ${index}` },
      })),
    });
    for (const [Adapter, props] of [
      [StarterCardReactAdapter, missingCardSlot],
      [StarterListReactAdapter, duplicateListIds],
      [StarterTableReactAdapter, incompleteRow],
      [StarterBadgeReactAdapter, executableData],
      [StarterTableReactAdapter, tooManyRows],
    ] as const) {
      expect(() => render(createElement(Adapter, props))).toThrow("STARTER_ADAPTER_INPUT_INVALID");
    }
  });
});
