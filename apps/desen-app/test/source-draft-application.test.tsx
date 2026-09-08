// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { canonicalizeJson } from "@desen/protocol";

import { DesenAppApplication } from "../src/application.js";
import { createFixedDestinationAuthoringPublicationPort } from "../src/authoring-publication.js";
import {
  REFERENCE_AUTHORING_WORKSPACE_PROFILE,
  REFERENCE_EDITOR_DOCUMENT,
} from "../src/reference-authoring-profile.js";
import { readProjectWorkspaceProfileAuthority } from "../src/project-workspace-profile.js";

import type { DesenEditorPersistencePort, DesenEditorSourceSaveRequest } from "@desen/editor-core";

const PATH = "/projects/account-app/surfaces/sign-in";
function button(name: string): HTMLButtonElement {
  return screen.getByRole("button", { name }) as HTMLButtonElement;
}
function draftInput(): HTMLTextAreaElement {
  return screen.getByRole("textbox", { name: "Source JSON draft" }) as HTMLTextAreaElement;
}
function draftRegion() {
  return screen.getByRole("region", { name: "Advanced Source draft" });
}
interface NodeDraft {
  props: Record<string, unknown>;
  on?: Record<string, unknown>;
  slots?: Record<string, NodeDraft[]>;
}
function editText(mutate: (root: NodeDraft, title: NodeDraft) => void): void {
  const source = JSON.parse(draftInput().value) as { surfaces: { "sign-in": { root: NodeDraft } } };
  const root = source.surfaces["sign-in"].root;
  const title = root.slots?.default?.[0];
  if (title === undefined) throw new Error("Missing title.");
  mutate(root, title);
  fireEvent.change(draftInput(), { target: { value: JSON.stringify(source) } });
}
function setup() {
  const saves: DesenEditorSourceSaveRequest[] = [];
  const authority = readProjectWorkspaceProfileAuthority(REFERENCE_AUTHORING_WORKSPACE_PROFILE);
  if (authority.status !== "read" || authority.profile.publication === null)
    throw new Error("Missing profile binding.");
  const publication = authority.profile.publication;
  const persistencePort: DesenEditorPersistencePort = {
    async openSource() {
      return { status: "missing" };
    },
    async saveSource(request) {
      saves.push(request);
      return saves.length === 1
        ? { status: "created", generation: 1 }
        : { status: "updated", generation: saves.length };
    },
  };
  const channel = vi.fn(async () => ({
    status: "failed" as const,
    phase: "request" as const,
    reason: "storage-unavailable" as const,
  }));
  const activation = vi.fn(async () => ({ status: "unavailable" as const }));
  const publicationPort = createFixedDestinationAuthoringPublicationPort({
    channelName: publication.channelName,
    hostId: publication.hostId,
    publishBundleToChannel: channel,
    activatePublishedRevision: activation,
  });
  const rendered = render(
    <DesenAppApplication
      initialDocument={REFERENCE_EDITOR_DOCUMENT}
      persistencePort={persistencePort}
      publicationPort={publicationPort}
      workspaceProfile={REFERENCE_AUTHORING_WORKSPACE_PROFILE}
    />,
  );
  return { saves, channel, activation, ...rendered };
}
async function saveBaseline() {
  fireEvent.click(button("Save source"));
  await waitFor(() => expect(button("Publish").disabled).toBe(false));
}

describe("advanced Source draft in the normal application", () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    window.history.replaceState(null, "", PATH);
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it.each([
    [
      "prop",
      (_root: NodeDraft, title: NodeDraft) => {
        title.props.text = 12;
      },
      "sign-in.title",
    ],
    [
      "event",
      (_root: NodeDraft, title: NodeDraft) => {
        title.on = { undeclared: [] };
      },
      "sign-in.title",
    ],
    [
      "slot",
      (root: NodeDraft) => {
        root.slots = { ...root.slots, undeclared: [] };
      },
      "sign-in.layout",
    ],
  ] as const)(
    "rejects an invalid %s draft, links its exact node, and leaves persistence and publication untouched",
    async (_kind, mutate, nodeId) => {
      const app = setup();
      await saveBaseline();
      const saved = canonicalizeJson(app.saves[0]);
      fireEvent.click(screen.getByRole("tab", { name: "Actions" }));
      fireEvent.click(button("Advanced Source"));
      editText(mutate);
      fireEvent.click(button("Validate and apply Source"));
      expect(draftRegion().getAttribute("data-source-draft-state")).toBe("rejected");
      expect(draftRegion().textContent).toContain("Publisher stopped at capability-contracts");
      expect(button("Save source").disabled).toBe(true);
      expect(button("Publish").disabled).toBe(true);
      expect(button("Run").disabled).toBe(true);
      const diagnostics = screen.getByRole("region", { name: "Validation diagnostics" });
      fireEvent.click(
        within(diagnostics).getByRole("button", {
          name: new RegExp(`^Select Node ${nodeId.replaceAll(".", "\\.")} at `, "u"),
        }),
      );
      expect(
        screen.getByRole("button", {
          name: new RegExp(`^Deselect .+ layer · ${nodeId.replaceAll(".", "\\.")}$`, "u"),
        }),
      ).toBeTruthy();
      expect(screen.getByRole("heading", { name: "Sign in", level: 2 })).toBeTruthy();
      fireEvent.click(button("Publish"));
      fireEvent.click(button("Save source"));
      expect(app.saves).toHaveLength(1);
      expect(canonicalizeJson(app.saves[0])).toBe(saved);
      expect(app.channel).not.toHaveBeenCalled();
      expect(app.activation).not.toHaveBeenCalled();
      fireEvent.click(button("Dismiss validation diagnostics"));
      expect(button("Publish").disabled).toBe(true);
      fireEvent.click(button("Discard Source draft"));
      expect(button("Publish").disabled).toBe(false);
      expect(screen.queryByRole("region", { name: "Validation diagnostics" })).toBeNull();
    },
  );

  it("repairs rejected text, applies atomically and still requires the ordinary Save then Publish boundary", async () => {
    const app = setup();
    await saveBaseline();
    fireEvent.click(button("Advanced Source"));
    editText((_root, title) => {
      title.props.text = false;
    });
    fireEvent.click(button("Validate and apply Source"));
    editText((_root, title) => {
      title.props.text = "Repaired Source title";
    });
    expect(screen.queryByRole("region", { name: "Validation diagnostics" })).toBeNull();
    fireEvent.click(button("Validate and apply Source"));
    expect(screen.getByRole("heading", { name: "Repaired Source title", level: 2 })).toBeTruthy();
    expect(button("Publish").disabled).toBe(true);
    expect(app.saves).toHaveLength(1);
    expect(app.channel).not.toHaveBeenCalled();
    fireEvent.click(button("Save source"));
    await waitFor(() => expect(button("Publish").disabled).toBe(false));
    expect(app.saves).toHaveLength(2);
    expect(canonicalizeJson(app.saves[1])).toContain("Repaired Source title");
    expect(canonicalizeJson(app.saves[1])).not.toContain("validationReport");
    fireEvent.click(button("Publish"));
    await waitFor(() => expect(app.channel).toHaveBeenCalledTimes(1));
  });

  it("protects a detached draft across route and page exit and refuses visual edits while it is pending", async () => {
    setup();
    await saveBaseline();
    fireEvent.click(button("Select Text layer · sign-in.title"));
    const inspector = screen.getByRole("complementary", { name: "Inspector" });
    const visualText = within(inspector).getByRole("textbox", { name: "Text" });
    fireEvent.click(button("Advanced Source"));
    const baselineText = draftInput().value;
    fireEvent.change(visualText, { target: { value: "A forbidden concurrent visual edit" } });
    fireEvent.blur(visualText);
    expect(screen.getByRole("heading", { name: "Sign in", level: 2 })).toBeTruthy();
    expect(draftInput().value).toBe(baselineText);
    const confirmation = vi.spyOn(window, "confirm").mockReturnValue(false);
    fireEvent.click(screen.getByRole("link", { name: "Account app" }));
    expect(confirmation).toHaveBeenCalledTimes(1);
    expect(window.location.pathname).toBe(PATH);
    const exit = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(exit);
    expect(exit.defaultPrevented).toBe(true);
  });

  it("keeps malformed text visible and unpublishable until explicit discard", async () => {
    const app = setup();
    await saveBaseline();
    fireEvent.click(button("Advanced Source"));
    fireEvent.change(draftInput(), { target: { value: '{"duplicate":1,"duplicate":2}' } });
    fireEvent.click(button("Validate and apply Source"));
    expect(draftRegion().textContent).toContain("without duplicate members");
    expect(draftInput().value).toBe('{"duplicate":1,"duplicate":2}');
    expect(app.saves).toHaveLength(1);
    expect(app.channel).not.toHaveBeenCalled();
    expect(button("Publish").disabled).toBe(true);
  });
});
