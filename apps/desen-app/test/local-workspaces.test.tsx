// @vitest-environment jsdom
import { StrictMode, act, useEffect } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DesenAppLocalWorkspaces } from "../src/local-workspaces.js";
import { DesenAppProduct } from "../src/product-bootstrap.js";
import { installDesenAppNavigationGuard, navigateDesenApp } from "../src/project-navigation.js";
import {
  createProjectWorkspaceProfile,
  readProjectWorkspaceProfileAuthority,
} from "../src/project-workspace-profile.js";
import { EMPTY_REFERENCE_PROJECT_DOCUMENT } from "../src/reference-empty-project.js";
import { REFERENCE_FLOW_WORKSPACE_PROFILE } from "../src/reference-flow-workspace-profile.js";
import { REFERENCE_SIGN_IN_WORKSPACE_PROFILE } from "../src/reference-sign-in-workspace-profile.js";

import type { ReactNode } from "react";
import type {
  DesenEditorDocument,
  DesenEditorPersistencePort,
  DesenEditorSourceSaveRequest,
  DesenEditorSourceSaveResult,
} from "@desen/editor-core";
import type { DesenAppLocalWorkspace } from "../src/local-workspaces.js";
import type { ProjectWorkspaceProfileHandle } from "../src/project-workspace-profile.js";

const LEGACY_PATH = "/projects/account-app/surfaces/sign-in";
const FLOW_PATH = "/projects/flow-app/surfaces/start";

function fakeWorkspaces() {
  const renderLegacy = vi.fn(() => (
    <section aria-label="Account workspace">
      <input aria-label="Local draft" defaultValue="legacy draft" />
    </section>
  ));
  const renderFlow = vi.fn(() => <section aria-label="Flow workspace">Two empty surfaces</section>);
  const workspaces: readonly DesenAppLocalWorkspace[] = [
    { profile: REFERENCE_SIGN_IN_WORKSPACE_PROFILE, render: renderLegacy },
    { profile: REFERENCE_FLOW_WORKSPACE_PROFILE, render: renderFlow },
  ];
  return { workspaces, renderLegacy, renderFlow };
}

function chooseWorkspace(value: string): void {
  fireEvent.change(screen.getByRole("combobox", { name: "Local workspace" }), {
    target: { value },
  });
}

function storedLegacyWorkspace() {
  const records = new Map<string, { document: DesenEditorDocument; generation: number }>([
    ["account-app-source", { document: EMPTY_REFERENCE_PROJECT_DOCUMENT, generation: 1 }],
  ]);
  const openKeys: string[] = [];
  const saves: DesenEditorSourceSaveRequest[] = [];
  const port: DesenEditorPersistencePort = {
    async openSource(sourceKey) {
      openKeys.push(sourceKey);
      const record = records.get(sourceKey);
      return record === undefined ? { status: "missing" } : { status: "opened", ...record };
    },
    async saveSource(request): Promise<DesenEditorSourceSaveResult> {
      saves.push(request);
      const current = records.get(request.sourceKey);
      if (request.expectedGeneration !== (current?.generation ?? null)) {
        return { status: "conflict", currentGeneration: current?.generation ?? null };
      }
      const generation = (current?.generation ?? 0) + 1;
      records.set(request.sourceKey, { document: request.document, generation });
      return current === undefined
        ? { status: "created", generation: 1 }
        : { status: "updated", generation };
    },
  };
  const workspaces: readonly DesenAppLocalWorkspace[] = [
    {
      profile: REFERENCE_SIGN_IN_WORKSPACE_PROFILE,
      render: () => (
        <DesenAppProduct
          persistencePort={port}
          workspaceProfile={REFERENCE_SIGN_IN_WORKSPACE_PROFILE}
        />
      ),
    },
    {
      profile: REFERENCE_FLOW_WORKSPACE_PROFILE,
      render: () => (
        <DesenAppProduct
          persistencePort={port}
          workspaceProfile={REFERENCE_FLOW_WORKSPACE_PROFILE}
        />
      ),
    },
  ];
  return { records, openKeys, saves, workspaces };
}

function duplicateProjectHandle(): ProjectWorkspaceProfileHandle {
  const authority = readProjectWorkspaceProfileAuthority(REFERENCE_SIGN_IN_WORKSPACE_PROFILE);
  if (authority.status !== "read") throw new Error("Expected an authenticated reference profile.");
  const profile = authority.profile;
  const created = createProjectWorkspaceProfile({
    profileId: "duplicate-account-web",
    project: profile.project,
    route: profile.route,
    sourceSurfaceId: profile.sourceSurfaceId,
    documentId: profile.documentId,
    sourceKey: "duplicate-account-source",
    initialDocument: profile.initialDocument,
    catalogs: profile.catalogs,
    catalogPackages: profile.catalogPackages,
    runtime: {
      target: profile.runtime.target,
      registry: profile.runtime.registry,
      tokenCssProperties: profile.runtime.tokenCssProperties,
      hostPorts: profile.runtime.hostPorts,
    },
    publication: profile.publication,
  });
  if (!created.ok) throw new Error("Expected the independent profile to be valid in isolation.");
  return created.handle;
}

describe("normal local workspace selection", () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    window.history.replaceState(null, "", "/projects");
    Object.defineProperties(HTMLDialogElement.prototype, {
      close: {
        configurable: true,
        value(this: HTMLDialogElement) {
          this.removeAttribute("open");
        },
      },
      showModal: {
        configurable: true,
        value(this: HTMLDialogElement) {
          this.setAttribute("open", "");
        },
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    window.history.replaceState(null, "", "/projects");
  });

  it("retains the first trusted workspace as the existing default", () => {
    const fixtures = fakeWorkspaces();
    render(<DesenAppLocalWorkspaces workspaces={fixtures.workspaces} />);
    expect(screen.getByRole("region", { name: "Account workspace" })).toBeTruthy();
    expect(fixtures.renderFlow).not.toHaveBeenCalled();
    expect(
      (screen.getByRole("combobox", { name: "Local workspace" }) as HTMLSelectElement).value,
    ).toBe("reference-sign-in-web");
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Account app",
      "Flow app",
    ]);
  });

  it("switches only through the visible chooser and the canonical admitted App route", () => {
    const fixtures = fakeWorkspaces();
    render(<DesenAppLocalWorkspaces workspaces={fixtures.workspaces} />);
    chooseWorkspace("reference-flow-web");
    expect(window.location.pathname).toBe(FLOW_PATH);
    expect(screen.getByRole("region", { name: "Flow workspace" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Account workspace" })).toBeNull();
    chooseWorkspace("reference-sign-in-web");
    expect(window.location.pathname).toBe(LEGACY_PATH);
    expect(screen.getByRole("region", { name: "Account workspace" })).toBeTruthy();
  });

  it("selects a known result-surface deep link without opening the default Source", () => {
    const fixtures = fakeWorkspaces();
    window.history.replaceState(null, "", "/projects/flow-app/surfaces/result");
    render(<DesenAppLocalWorkspaces workspaces={fixtures.workspaces} />);
    expect(screen.getByRole("region", { name: "Flow workspace" })).toBeTruthy();
    expect(fixtures.renderLegacy).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe("/projects/flow-app/surfaces/result");
  });

  it("retains the selected workspace when a missing Source redirects to projects on mount", () => {
    const fixtures = fakeWorkspaces();
    function MissingWorkspace() {
      useEffect(() => navigateDesenApp("/projects", true), []);
      return <p>Missing Flow workspace</p>;
    }
    const renderMissing = vi.fn(() => <MissingWorkspace />);
    render(
      <DesenAppLocalWorkspaces
        workspaces={[
          fixtures.workspaces[0] as DesenAppLocalWorkspace,
          { profile: REFERENCE_FLOW_WORKSPACE_PROFILE, render: renderMissing },
        ]}
      />,
    );
    chooseWorkspace("reference-flow-web");
    expect(window.location.pathname).toBe("/projects");
    expect(screen.getByText("Missing Flow workspace")).toBeTruthy();
    expect(
      (screen.getByRole("combobox", { name: "Local workspace" }) as HTMLSelectElement).value,
    ).toBe("reference-flow-web");
    expect(fixtures.renderLegacy).toHaveBeenCalledTimes(1);
  });

  it("preserves the current mount and selected option when the existing navigation guard vetoes", () => {
    const fixtures = fakeWorkspaces();
    render(<DesenAppLocalWorkspaces workspaces={fixtures.workspaces} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Local draft" }), {
      target: { value: "unsaved draft" },
    });
    const guard = vi.fn(() => false);
    const revoke = installDesenAppNavigationGuard(guard);
    try {
      chooseWorkspace("reference-flow-web");
      expect(guard).toHaveBeenCalledWith(FLOW_PATH);
      expect(window.location.pathname).toBe("/projects");
      expect(fixtures.renderFlow).not.toHaveBeenCalled();
      expect((screen.getByRole("textbox", { name: "Local draft" }) as HTMLInputElement).value).toBe(
        "unsaved draft",
      );
      expect(
        (screen.getByRole("combobox", { name: "Local workspace" }) as HTMLSelectElement).value,
      ).toBe("reference-sign-in-web");
    } finally {
      revoke();
    }
  });

  it("follows admitted browser traversal and keeps an unqualified projects route in its workspace", () => {
    const fixtures = fakeWorkspaces();
    render(<DesenAppLocalWorkspaces workspaces={fixtures.workspaces} />);
    act(() => {
      window.history.replaceState(null, "", FLOW_PATH);
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(screen.getByRole("region", { name: "Flow workspace" })).toBeTruthy();
    act(() => navigateDesenApp("/projects"));
    expect(screen.getByRole("region", { name: "Flow workspace" })).toBeTruthy();
    expect(fixtures.renderLegacy).toHaveBeenCalledTimes(1);
  });

  it.each([
    "/projects/unknown/surfaces/start",
    "/projects/flow-app/surfaces/unknown",
    "/projects/flow-app/surfaces/start?profile=untrusted",
  ])("does not turn an untrusted or unknown address into workspace authority: %s", (pathname) => {
    const fixtures = fakeWorkspaces();
    window.history.replaceState(null, "", pathname);
    render(<DesenAppLocalWorkspaces workspaces={fixtures.workspaces} />);
    expect(screen.getByRole("heading", { name: "Workspace not found" })).toBeTruthy();
    expect(fixtures.renderLegacy).not.toHaveBeenCalled();
    expect(fixtures.renderFlow).not.toHaveBeenCalled();
    chooseWorkspace("reference-flow-web");
    expect(window.location.pathname).toBe(FLOW_PATH);
    expect(screen.getByRole("region", { name: "Flow workspace" })).toBeTruthy();
  });

  it("rejects forged profiles, duplicate handles, duplicate project identities, and empty inventories", () => {
    const callback = vi.fn((): ReactNode => "Never render");
    const legacy = { profile: REFERENCE_SIGN_IN_WORKSPACE_PROFILE, render: callback };
    const inventories: readonly (readonly DesenAppLocalWorkspace[])[] = [
      [],
      [{ profile: {} as ProjectWorkspaceProfileHandle, render: callback }],
      [legacy, legacy],
      [legacy, { profile: duplicateProjectHandle(), render: callback }],
    ];
    for (const workspaces of inventories) {
      const mounted = render(<DesenAppLocalWorkspaces workspaces={workspaces} />);
      expect(screen.getByRole("alert").textContent).toContain("Workspace unavailable");
      expect(callback).not.toHaveBeenCalled();
      mounted.unmount();
    }
  });

  it("rejects accessor-based configuration without invoking a hidden profile or renderer", () => {
    const accessor = vi.fn(() => REFERENCE_SIGN_IN_WORKSPACE_PROFILE);
    const renderWorkspace = vi.fn((): ReactNode => "Never render");
    const candidate = Object.defineProperties(
      {},
      {
        profile: { enumerable: true, get: accessor },
        render: { enumerable: true, value: renderWorkspace },
      },
    ) as DesenAppLocalWorkspace;
    render(<DesenAppLocalWorkspaces workspaces={[candidate]} />);
    expect(screen.getByRole("alert").textContent).toContain("Workspace unavailable");
    expect(accessor).not.toHaveBeenCalled();
    expect(renderWorkspace).not.toHaveBeenCalled();
  });

  it("creates the separate two-surface project through normal UI without changing stored Account app", async () => {
    const stored = storedLegacyWorkspace();
    const legacyBefore = JSON.stringify(stored.records.get("account-app-source"));
    window.history.replaceState(null, "", LEGACY_PATH);
    render(
      <StrictMode>
        <DesenAppLocalWorkspaces workspaces={stored.workspaces} />
      </StrictMode>,
    );
    await screen.findByRole("button", { name: "Select Stack layer · sign-in.layout" });
    chooseWorkspace("reference-flow-web");
    const newProject = await screen.findByRole("button", { name: "New project" });
    expect(window.location.pathname).toBe("/projects");
    expect(
      (screen.getByRole("combobox", { name: "Local workspace" }) as HTMLSelectElement).value,
    ).toBe("reference-flow-web");
    expect(stored.saves).toHaveLength(0);
    fireEvent.click(newProject);
    const dialog = screen.getByRole("dialog", { name: "Create a project" });
    expect(within(dialog).getByText("Blank Flow app project")).toBeTruthy();
    expect(within(dialog).getByText(/web-react.*1 Catalog.*2 surfaces/u)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Create project" }));
    await screen.findByRole("button", { name: "Select Stack layer · start.layout" });
    expect(window.location.pathname).toBe(FLOW_PATH);
    expect(stored.openKeys).toEqual(["account-app-source", "flow-app-source"]);
    expect(stored.saves).toHaveLength(1);
    expect(stored.saves[0]?.sourceKey).toBe("flow-app-source");
    expect(
      Object.keys(stored.records.get("flow-app-source")?.document.surfaces ?? {}).sort(),
    ).toEqual(["result", "start"]);
    expect(JSON.stringify(stored.records.get("account-app-source"))).toBe(legacyBefore);
    chooseWorkspace("reference-sign-in-web");
    await screen.findByRole("button", { name: "Select Stack layer · sign-in.layout" });
    expect(window.location.pathname).toBe(LEGACY_PATH);
    expect(JSON.stringify(stored.records.get("account-app-source"))).toBe(legacyBefore);
  });

  it("uses the actual editor dirty-draft guard before changing persistence controllers", async () => {
    const stored = storedLegacyWorkspace();
    window.history.replaceState(null, "", LEGACY_PATH);
    render(<DesenAppLocalWorkspaces workspaces={stored.workspaces} />);
    await screen.findByRole("button", { name: "Select Stack layer · sign-in.layout" });
    fireEvent.click(
      screen.getByRole("button", {
        name: /Insert Text into Stack sign-in\.layout default slot at position 1/u,
      }),
    );
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    chooseWorkspace("reference-flow-web");
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(window.location.pathname).toBe(LEGACY_PATH);
    expect(stored.openKeys).toEqual(["account-app-source"]);
    expect(screen.getByRole("button", { name: "Deselect Text layer · node.text" })).toBeTruthy();
    expect(
      (screen.getByRole("combobox", { name: "Local workspace" }) as HTMLSelectElement).value,
    ).toBe("reference-sign-in-web");
    confirm.mockReturnValue(true);
    chooseWorkspace("reference-flow-web");
    await waitFor(() => expect(stored.openKeys).toEqual(["account-app-source", "flow-app-source"]));
    expect(stored.saves).toHaveLength(0);
    expect(stored.records.get("account-app-source")?.document).toEqual(
      EMPTY_REFERENCE_PROJECT_DOCUMENT,
    );
  });
});
