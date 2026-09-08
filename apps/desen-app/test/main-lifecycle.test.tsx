// @vitest-environment jsdom
import { act } from "react";
import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { EMPTY_REFERENCE_PROJECT_DOCUMENT } from "../src/reference-empty-project.js";

import type { DesenEditorPersistencePort } from "@desen/editor-core";

const PRODUCTION_ENTRY_TEST_TIMEOUT_MS = 15_000;

function pageHideEvent(persisted: boolean): Event {
  const event = new Event("pagehide");
  Object.defineProperty(event, "persisted", {
    enumerable: true,
    value: persisted,
  });
  return event;
}

function persistencePort(
  openSource: DesenEditorPersistencePort["openSource"],
): DesenEditorPersistencePort {
  return Object.freeze({
    openSource,
    saveSource: async () => Object.freeze({ status: "created" as const, generation: 1 as const }),
  });
}

function injectPersistencePort(port: DesenEditorPersistencePort | null) {
  const createInjectedDesenAppLocalPersistencePort = vi.fn((browserFetchValue: unknown) => {
    void browserFetchValue;
    return port;
  });
  vi.doMock("../src/local-runtime-persistence.js", () => ({
    createInjectedDesenAppLocalPersistencePort,
  }));
  return createInjectedDesenAppLocalPersistencePort;
}

function injectPublicationPort(
  implementation: (browserFetchValue: unknown) => unknown = (browserFetchValue) => {
    void browserFetchValue;
    return null;
  },
) {
  const createInjectedDesenAppLocalPublicationPort = vi.fn(implementation);
  vi.doMock("../src/local-runtime-publication.js", () => ({
    createInjectedDesenAppLocalPublicationPort,
  }));
  return createInjectedDesenAppLocalPublicationPort;
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  document.body.innerHTML = '<div id="desen-app-root"></div>';
  window.history.replaceState(null, "", "/");
  vi.resetModules();
  vi.doUnmock("../src/local-runtime-persistence.js");
  vi.doUnmock("../src/local-runtime-publication.js");
});

afterEach(() => {
  act(() => {
    window.dispatchEvent(pageHideEvent(false));
  });
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

it(
  "normalizes the root and mounts the empty durable product workspace",
  async () => {
    const startupFetch = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", startupFetch);
    const replaceState = vi.spyOn(window.history, "replaceState");
    const createPersistence = injectPersistencePort(
      persistencePort(async () => Object.freeze({ status: "missing" as const })),
    );
    const createPublication = injectPublicationPort();

    await act(async () => {
      await import("../src/main.js");
      await Promise.resolve();
    });

    expect(replaceState).toHaveBeenCalledWith(null, "", "/projects");
    expect(window.location.pathname).toBe("/projects");
    expect(await screen.findByRole("heading", { level: 1, name: "Projects" })).toBeTruthy();
    expect(screen.getByText("0 projects")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "New project" }) as HTMLButtonElement).disabled,
    ).toBe(false);
    expect(document.getElementById("desen-app-root")?.textContent).not.toContain("Checkout pilot");
    expect(createPersistence).toHaveBeenCalledTimes(1);
    expect(createPublication).toHaveBeenCalledTimes(1);
    expect(createPublication.mock.calls[0]?.[0]).toEqual(expect.any(Function));
    expect(createPersistence.mock.calls[0]?.[0]).toEqual(expect.any(Function));
    const capturedFetch = createPersistence.mock.calls[0]?.[0] as (
      input: string,
      init: RequestInit,
    ) => Promise<Response>;
    const replacementFetch = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", replacementFetch);
    await capturedFetch("http://127.0.0.1:43127/probe", { method: "GET" });
    expect(startupFetch).toHaveBeenCalledTimes(1);
    expect(replacementFetch).not.toHaveBeenCalled();
  },
  PRODUCTION_ENTRY_TEST_TIMEOUT_MS,
);

it(
  "keeps the durable product available when independent publication configuration is rejected",
  async () => {
    injectPersistencePort(
      persistencePort(async () => Object.freeze({ status: "missing" as const })),
    );
    const createPublication = injectPublicationPort(() => {
      throw new Error("private-publication-configuration-detail");
    });

    await act(async () => {
      await import("../src/main.js");
      await Promise.resolve();
    });

    expect(
      ((await screen.findByRole("button", { name: "New project" })) as HTMLButtonElement).disabled,
    ).toBe(false);
    expect(createPublication).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).not.toContain("private-publication-configuration-detail");
  },
  PRODUCTION_ENTRY_TEST_TIMEOUT_MS,
);

it.each([
  { channelName: "preview", hostId: "reference-host-web", ready: true },
  { channelName: "another-channel", hostId: "reference-host-web", ready: false },
  { channelName: "preview", hostId: "another-host", ready: false },
])(
  "passes only the profile-matched publication authority to the normal Flow workspace ($channelName/$hostId)",
  async ({ channelName, hostId, ready }) => {
    const { REFERENCE_FLOW_WORKSPACE_PROFILE } =
      await import("../src/reference-flow-workspace-profile.js");
    const { readProjectWorkspaceProfileAuthority } =
      await import("../src/project-workspace-profile.js");
    const { createFixedDestinationAuthoringPublicationPort } =
      await import("../src/authoring-publication.js");
    const authority = readProjectWorkspaceProfileAuthority(REFERENCE_FLOW_WORKSPACE_PROFILE);
    if (authority.status !== "read") throw new Error("Expected the installed Flow authority.");
    const savedSource = authority.profile.initialDocument;
    const openSource = vi.fn(async () =>
      Object.freeze({ status: "opened" as const, generation: 4, document: savedSource }),
    );
    injectPersistencePort(persistencePort(openSource));
    const publish = vi.fn(async () =>
      Object.freeze({
        status: "failed" as const,
        phase: "request" as const,
        reason: "storage-unavailable" as const,
      }),
    );
    const activate = vi.fn(async () => Object.freeze({ status: "unavailable" as const }));
    injectPublicationPort(() =>
      createFixedDestinationAuthoringPublicationPort({
        channelName,
        hostId,
        publishBundleToChannel: publish,
        activatePublishedRevision: activate,
      }),
    );
    window.history.replaceState(null, "", "/projects/flow-app/surfaces/start");

    await act(async () => {
      await import("../src/main.js");
      await Promise.resolve();
    });

    if (ready) {
      expect(await screen.findByRole("heading", { level: 2, name: "Start" })).toBeTruthy();
      expect(openSource).toHaveBeenCalledWith("flow-app-source");
      fireEvent.click(screen.getByText("Source & release", { exact: true }));
      const release = screen.getByRole("region", { name: "Publish saved Source" });
      expect(
        (within(release).getByRole("button", { name: "Publish" }) as HTMLButtonElement).disabled,
      ).toBe(false);
      expect(within(release).getByRole("status").textContent).toContain(
        "Saved generation 4 is ready to publish.",
      );
      await act(async () => {
        fireEvent.click(within(release).getByRole("button", { name: "Publish" }));
      });
      expect(publish).toHaveBeenCalledTimes(1);
      expect(publish).toHaveBeenCalledWith({
        bundleBytes: expect.any(Uint8Array),
        revision: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
      });
    } else {
      expect(
        await screen.findByRole("heading", {
          name: "The project composition was not authenticated.",
        }),
      ).toBeTruthy();
      expect(screen.queryByRole("region", { name: "Publish saved Source" })).toBeNull();
      expect(screen.queryByRole("group", { name: /^Managed / })).toBeNull();
      expect(publish).not.toHaveBeenCalled();
    }
    expect(activate).not.toHaveBeenCalled();
    expect(authority.profile.initialDocument).toBe(savedSource);
  },
  PRODUCTION_ENTRY_TEST_TIMEOUT_MS,
);

it(
  "preserves an opened product Source for BFCache and unmounts only on final pagehide",
  async () => {
    window.history.replaceState(null, "", "/projects/account-app/surfaces/sign-in");
    injectPersistencePort(
      persistencePort(async () =>
        Object.freeze({
          status: "opened" as const,
          generation: 3,
          document: EMPTY_REFERENCE_PROJECT_DOCUMENT,
        }),
      ),
    );

    await act(async () => {
      await import("../src/main.js");
      await Promise.resolve();
    });
    expect(await screen.findByRole("heading", { level: 2, name: "Sign-in" })).toBeTruthy();
    expect(
      await screen.findByRole("button", { name: "Select Stack layer · sign-in.layout" }),
    ).toBeTruthy();

    act(() => {
      window.dispatchEvent(pageHideEvent(true));
    });
    expect(screen.getByRole("heading", { level: 2, name: "Sign-in" })).toBeTruthy();
    expect(document.getElementById("desen-app-root")?.textContent).toContain("Generation 3");

    act(() => {
      window.dispatchEvent(pageHideEvent(false));
    });
    expect(document.getElementById("desen-app-root")?.textContent).toBe("");

    act(() => {
      window.dispatchEvent(pageHideEvent(false));
    });
    expect(document.getElementById("desen-app-root")?.textContent).toBe("");
  },
  PRODUCTION_ENTRY_TEST_TIMEOUT_MS,
);

it(
  "fails closed without mounting fixture data when no runtime persistence was configured",
  async () => {
    injectPersistencePort(null);

    await act(async () => {
      await import("../src/main.js");
      await Promise.resolve();
    });

    expect(
      await screen.findByRole("heading", { name: "DESEN could not open this workspace." }),
    ).toBeTruthy();
    expect(screen.getByText(/No fixture project was substituted/)).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Account app" })).toBeNull();
    expect(screen.queryByRole("group", { name: /^Managed / })).toBeNull();
    expect(screen.queryByRole("button", { name: "New project" })).toBeNull();
  },
  PRODUCTION_ENTRY_TEST_TIMEOUT_MS,
);

it(
  "throws before composing persistence when the production root container is absent",
  async () => {
    const createPersistence = injectPersistencePort(null);
    document.body.replaceChildren();

    await expect(import("../src/main.js")).rejects.toThrow(
      "The Desen App root container is missing.",
    );
    expect(document.body.textContent).toBe("");
    expect(createPersistence).not.toHaveBeenCalled();
  },
  PRODUCTION_ENTRY_TEST_TIMEOUT_MS,
);
