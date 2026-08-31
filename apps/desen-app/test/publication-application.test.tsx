// @vitest-environment jsdom
import { act } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setDesenEditorOwnerProp } from "@desen/editor-core";
import { canonicalizeJsonBytes } from "@desen/protocol";

import { DesenAppApplication } from "../src/application.js";
import {
  AUTHORING_PUBLICATION_CHANNEL,
  type AuthoringControlPlanePublicationRequest,
  type AuthoringControlPlanePublicationSettlement,
  type AuthoringPublicationPort,
  type AuthoringReferenceHostActivationRequest,
  type AuthoringReferenceHostActivationSettlement,
} from "../src/authoring-publication.js";
import {
  prepareAuthoringPreviewBundle,
  REFERENCE_EDITOR_DOCUMENT,
} from "../src/authoring-preview.js";

import type {
  DesenEditorDocument,
  DesenEditorPersistencePort,
  DesenEditorSourceOpenResult,
  DesenEditorSourceSaveRequest,
  DesenEditorSourceSaveResult,
} from "@desen/editor-core";

const SIGN_IN_PATH = "/projects/account-app/surfaces/sign-in";
const SOURCE_KEY = "account-app-source";
const EDITED_TITLE = "Ship the durable sign-in";
const LATER_TITLE = "A newer unpublished draft";
const RUNTIME_EMAIL = "runtime-only@example.invalid";
const RUNTIME_PASSWORD = "runtime-password-must-not-publish";
const OTHER_REVISION = `sha256:${"b".repeat(64)}`;

interface Deferred<Value> {
  readonly promise: Promise<Value>;
  readonly resolve: (value: Value) => void;
}

interface OpenCall extends Deferred<DesenEditorSourceOpenResult> {
  readonly sourceKey: string;
}

interface SaveCall extends Deferred<DesenEditorSourceSaveResult> {
  readonly request: DesenEditorSourceSaveRequest;
}

interface ControlledPersistence {
  readonly openCalls: OpenCall[];
  readonly port: DesenEditorPersistencePort;
  readonly saveCalls: SaveCall[];
}

interface ChannelCall extends Deferred<AuthoringControlPlanePublicationSettlement> {
  readonly request: AuthoringControlPlanePublicationRequest;
}

interface ActivationCall extends Deferred<AuthoringReferenceHostActivationSettlement> {
  readonly request: AuthoringReferenceHostActivationRequest;
}

interface ControlledPublication {
  readonly activationCalls: ActivationCall[];
  readonly channelCalls: ChannelCall[];
  readonly port: AuthoringPublicationPort;
}

function createDeferred<Value>(): Deferred<Value> {
  let resolvePromise: ((value: Value) => void) | undefined;
  const promise = new Promise<Value>((resolve) => {
    resolvePromise = resolve;
  });
  if (resolvePromise === undefined) throw new Error("Deferred promise was not initialized.");
  return { promise, resolve: resolvePromise };
}

function createControlledPersistence(): ControlledPersistence {
  const openCalls: OpenCall[] = [];
  const saveCalls: SaveCall[] = [];
  const port: DesenEditorPersistencePort = Object.freeze({
    openSource(sourceKey: string) {
      const pending = createDeferred<DesenEditorSourceOpenResult>();
      openCalls.push({ sourceKey, ...pending });
      return pending.promise;
    },
    saveSource(request: DesenEditorSourceSaveRequest) {
      const pending = createDeferred<DesenEditorSourceSaveResult>();
      saveCalls.push({ request, ...pending });
      return pending.promise;
    },
  });
  return { openCalls, port, saveCalls };
}

function createControlledPublication(): ControlledPublication {
  const channelCalls: ChannelCall[] = [];
  const activationCalls: ActivationCall[] = [];
  const port: AuthoringPublicationPort = Object.freeze({
    publishBundleToChannel(request: AuthoringControlPlanePublicationRequest) {
      const pending = createDeferred<AuthoringControlPlanePublicationSettlement>();
      channelCalls.push({ request, ...pending });
      return pending.promise;
    },
    activateReferenceHost(request: AuthoringReferenceHostActivationRequest) {
      const pending = createDeferred<AuthoringReferenceHostActivationSettlement>();
      activationCalls.push({ request, ...pending });
      return pending.promise;
    },
  });
  return { activationCalls, channelCalls, port };
}

function requireCall<Value>(calls: readonly Value[], index: number, label: string): Value {
  const call = calls[index];
  if (call === undefined) throw new Error(`Expected ${label} call ${index}.`);
  return call;
}

async function settleSave(
  controlled: ControlledPersistence,
  index: number,
  result: DesenEditorSourceSaveResult,
): Promise<void> {
  const call = requireCall(controlled.saveCalls, index, "Save");
  await act(async () => {
    call.resolve(result);
    await call.promise;
  });
}

async function settleChannel(
  controlled: ControlledPublication,
  index: number,
  result: AuthoringControlPlanePublicationSettlement,
): Promise<void> {
  const call = requireCall(controlled.channelCalls, index, "control-plane publication");
  await act(async () => {
    call.resolve(result);
    await call.promise;
  });
}

async function settleActivation(
  controlled: ControlledPublication,
  index: number,
  result: AuthoringReferenceHostActivationSettlement,
): Promise<void> {
  const call = requireCall(controlled.activationCalls, index, "reference-host activation");
  await act(async () => {
    call.resolve(result);
    await call.promise;
  });
}

function renderApplication(
  persistencePort: DesenEditorPersistencePort | null = null,
  publicationPort: AuthoringPublicationPort | null = null,
) {
  window.history.replaceState(null, "", SIGN_IN_PATH);
  return render(
    <DesenAppApplication persistencePort={persistencePort} publicationPort={publicationPort} />,
  );
}

function persistenceRegion(): HTMLElement {
  return screen.getByRole("region", { name: "Source persistence" });
}

function publicationRegion(): HTMLElement {
  return screen.getByRole("region", { name: "Publish saved Source" });
}

function openButton(): HTMLButtonElement {
  return within(persistenceRegion()).getByRole("button", {
    name: "Open source",
  }) as HTMLButtonElement;
}

function saveButton(): HTMLButtonElement {
  return within(persistenceRegion()).getByRole("button", {
    name: "Save source",
  }) as HTMLButtonElement;
}

function publishButton(): HTMLButtonElement {
  return within(publicationRegion()).getByRole("button", {
    name: /^(?:Publish|Publishing…|Activating…)$/u,
  }) as HTMLButtonElement;
}

function publicationStatus(): string {
  return within(publicationRegion()).getByRole("status").textContent ?? "";
}

function editedDocument(title: string): DesenEditorDocument {
  const result = setDesenEditorOwnerProp(REFERENCE_EDITOR_DOCUMENT, {
    surfaceId: "sign-in",
    ownerId: "sign-in.title",
    name: "text",
    value: title,
  });
  if (!result.ok) throw new Error("Expected the test title edit to remain editor-admissible.");
  return result.document;
}

function expectedPreview(title: string) {
  const document = editedDocument(title);
  const preview = prepareAuthoringPreviewBundle(document);
  if (!preview.ok) throw new Error("Expected the test title edit to remain publishable.");
  return Object.freeze({ document, preview });
}

async function editTitle(title: string): Promise<void> {
  const layer = screen.getByRole("button", {
    name: /^(?:Select|Deselect) Text layer · sign-in\.title$/u,
  });
  if (layer.getAttribute("aria-label")?.startsWith("Select ") === true) fireEvent.click(layer);
  const inspector = screen.getByRole("complementary", { name: "Inspector" });
  const textbox = within(inspector).getByRole("textbox", { name: "Text" });
  fireEvent.change(textbox, { target: { value: title } });
  fireEvent.blur(textbox);
  await waitFor(() => {
    expect(screen.getByRole("heading", { level: 2, name: title })).toBeTruthy();
  });
}

async function saveAs(
  controlled: ControlledPersistence,
  index: number,
  result: DesenEditorSourceSaveResult,
): Promise<void> {
  fireEvent.click(saveButton());
  expect(controlled.saveCalls).toHaveLength(index + 1);
  await settleSave(controlled, index, result);
  await waitFor(() => {
    expect(publicationStatus()).toMatch(/ready to publish/u);
  });
}

function publishedSettlement(
  revision: string,
  channelGeneration: number,
): AuthoringControlPlanePublicationSettlement {
  return Object.freeze({
    status: "published",
    channelName: AUTHORING_PUBLICATION_CHANNEL,
    revision,
    bundleStatus: "stored",
    channelStatus: "updated",
    channelGeneration,
  });
}

function activeSettlement(
  revision: string,
  activationGeneration: number,
  relationship: "activated" | "preserved" | "recovered" = "activated",
): AuthoringReferenceHostActivationSettlement {
  return Object.freeze({
    status: "active",
    relationship,
    activeRevision: revision,
    activationGeneration,
  });
}

async function beginPublication(
  controlled: ControlledPublication,
  index = 0,
): Promise<ChannelCall> {
  fireEvent.click(publishButton());
  await waitFor(() => {
    expect(controlled.channelCalls).toHaveLength(index + 1);
  });
  return requireCall(controlled.channelCalls, index, "control-plane publication");
}

describe("Desen App publication integration", () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    document.title = "";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
    document.body.replaceChildren();
  });

  it("authors, runs, saves, publishes, and visibly activates one exact edited durable revision", async () => {
    const persistence = createControlledPersistence();
    const publication = createControlledPublication();
    renderApplication(persistence.port, publication.port);

    await editTitle(EDITED_TITLE);
    fireEvent.click(
      screen.getByRole("button", { name: "Select Text field layer · sign-in.email" }),
    );
    const scenario = within(screen.getByRole("region", { name: "Scenario preview" })).getByRole(
      "combobox",
      { name: "Component values" },
    );
    fireEvent.change(scenario, { target: { value: "catalog:invalid" } });
    await waitFor(() => {
      expect(
        (
          within(screen.getByRole("group", { name: "Sign-in adapter canvas" })).getByLabelText(
            "Email",
          ) as HTMLInputElement
        ).value,
      ).toBe("bad");
    });
    fireEvent.change(scenario, { target: { value: "source" } });
    await waitFor(() => {
      expect(
        (
          within(screen.getByRole("group", { name: "Sign-in adapter canvas" })).getByLabelText(
            "Email",
          ) as HTMLInputElement
        ).value,
      ).toBe("");
    });

    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    const runControls = screen.getByRole("complementary", { name: "Run controls" });
    const outcome = within(runControls).getByRole("combobox", {
      name: "Next outcome for signIn",
    });
    fireEvent.change(outcome, { target: { value: "error:invalidCredentials" } });
    const runCanvas = screen.getByRole("group", { name: "Sign-in adapter canvas" });
    const runtimeEmail = within(runCanvas).getByLabelText("Email") as HTMLInputElement;
    const runtimePassword = within(runCanvas).getByLabelText("Password") as HTMLInputElement;
    await act(async () => {
      fireEvent.change(runtimeEmail, { target: { value: RUNTIME_EMAIL } });
      await Promise.resolve();
    });
    await act(async () => {
      fireEvent.change(runtimePassword, { target: { value: RUNTIME_PASSWORD } });
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(runtimeEmail.value).toBe(RUNTIME_EMAIL);
      expect(runtimePassword.value).toBe(RUNTIME_PASSWORD);
    });
    fireEvent.click(within(runCanvas).getByRole("button", { name: "Sign in" }));
    await waitFor(() => {
      expect(within(runControls).getByRole("status").textContent).toContain("Pending");
    });
    fireEvent.click(within(runControls).getByRole("button", { name: "Complete signIn fixture" }));
    await waitFor(() => {
      expect(within(runControls).getByRole("status").textContent).toContain(
        "Synthetic public error completed",
      );
    });
    fireEvent.click(screen.getByRole("button", { name: "Design" }));

    await saveAs(persistence, 0, { status: "created", generation: 1 });
    const expected = expectedPreview(EDITED_TITLE);
    expect(persistence.saveCalls[0]?.request).toEqual({
      sourceKey: SOURCE_KEY,
      expectedGeneration: null,
      document: expected.document,
    });

    const channelCall = await beginPublication(publication);
    expect(Object.keys(channelCall.request).sort()).toEqual(["bundleBytes", "revision"]);
    expect(channelCall.request.revision).toBe(expected.preview.revision);
    expect(channelCall.request.bundleBytes).toEqual(canonicalizeJsonBytes(expected.preview.bundle));
    const serializedBundle = new TextDecoder().decode(channelCall.request.bundleBytes);
    expect(serializedBundle).toContain(EDITED_TITLE);
    expect(serializedBundle).not.toContain(RUNTIME_EMAIL);
    expect(serializedBundle).not.toContain(RUNTIME_PASSWORD);
    expect(serializedBundle).not.toContain('"initial":"bad"');
    expect(serializedBundle).not.toContain('"scenario"');
    expect(serializedBundle).not.toContain('"fixture"');

    await settleChannel(publication, 0, publishedSettlement(channelCall.request.revision, 7));
    await waitFor(() => {
      expect(publication.activationCalls).toHaveLength(1);
    });
    expect(publication.activationCalls[0]?.request).toEqual({
      channelName: "preview",
      channelGeneration: 7,
      revision: channelCall.request.revision,
    });
    await settleActivation(publication, 0, activeSettlement(channelCall.request.revision, 11));

    await waitFor(() => {
      expect(publicationRegion().getAttribute("data-publication-state")).toBe("active");
    });
    expect(publicationStatus()).toContain("is active in the reference host");
    const receipt = within(publicationRegion()).getByText("Revision", {
      selector: "dt",
    }).parentElement?.parentElement;
    expect(receipt?.textContent).toContain("Sourceg1");
    expect(receipt?.textContent).toContain("Channelg7");
    expect(receipt?.textContent).toContain("Activationg11");
    expect(
      within(publicationRegion())
        .getAllByRole("listitem")
        .every((item) => item.getAttribute("data-stage-state") === "done"),
    ).toBe(true);
  });

  it("single-dispatches pending work and fences persistence, modes, navigation, and authoring mutation", async () => {
    const persistence = createControlledPersistence();
    const publication = createControlledPublication();
    renderApplication(persistence.port, publication.port);
    await editTitle(EDITED_TITLE);
    await saveAs(persistence, 0, { status: "created", generation: 1 });

    const selectedTitleLayer = screen.getByRole("button", {
      name: "Deselect Text layer · sign-in.title",
    }) as HTMLButtonElement;
    const titleDraft = within(screen.getByRole("complementary", { name: "Inspector" })).getByRole(
      "textbox",
      { name: "Text" },
    ) as HTMLInputElement;
    fireEvent.change(titleDraft, { target: { value: "A stale pending inspector draft" } });
    const stalePublishButton = publishButton();
    await beginPublication(publication);

    expect(stalePublishButton.disabled).toBe(true);
    expect(stalePublishButton.textContent).toBe("Publishing…");
    expect(openButton().disabled).toBe(true);
    expect(saveButton().disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Design" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect((screen.getByRole("button", { name: "Run" }) as HTMLButtonElement).disabled).toBe(true);
    expect(selectedTitleLayer.disabled).toBe(false);
    expect(titleDraft.disabled).toBe(false);

    fireEvent.click(stalePublishButton);
    fireEvent.click(stalePublishButton);
    fireEvent.click(openButton());
    fireEvent.click(saveButton());
    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    fireEvent.click(selectedTitleLayer);
    fireEvent.blur(titleDraft);
    fireEvent.click(screen.getByRole("link", { name: "Account app" }));

    expect(publication.channelCalls).toHaveLength(1);
    expect(publication.activationCalls).toHaveLength(0);
    expect(persistence.openCalls).toHaveLength(0);
    expect(persistence.saveCalls).toHaveLength(1);
    expect(window.location.pathname).toBe(SIGN_IN_PATH);
    expect(screen.getByRole("heading", { level: 2, name: EDITED_TITLE })).toBeTruthy();
    expect(
      screen.queryByRole("heading", { level: 2, name: "A stale pending inspector draft" }),
    ).toBeNull();
    const beforeUnload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(beforeUnload);
    expect(beforeUnload.defaultPrevented).toBe(true);

    const revision = requireCall(publication.channelCalls, 0, "control-plane publication").request
      .revision;
    await settleChannel(publication, 0, publishedSettlement(revision, 3));
    await waitFor(() => {
      expect(publication.activationCalls).toHaveLength(1);
      expect(publishButton().textContent).toBe("Activating…");
    });
    const activatingButton = publishButton();
    fireEvent.click(activatingButton);
    fireEvent.click(activatingButton);
    fireEvent.click(screen.getByRole("link", { name: "Account app" }));
    expect(publication.channelCalls).toHaveLength(1);
    expect(publication.activationCalls).toHaveLength(1);
    expect(window.location.pathname).toBe(SIGN_IN_PATH);

    await settleActivation(publication, 0, activeSettlement(revision, 4));
    await waitFor(() => {
      expect(publicationRegion().getAttribute("data-publication-state")).toBe("active");
    });
  });

  it("does not ask the reference host to activate a control-plane conflict", async () => {
    const persistence = createControlledPersistence();
    const publication = createControlledPublication();
    renderApplication(persistence.port, publication.port);
    await saveAs(persistence, 0, { status: "created", generation: 1 });

    const channelCall = await beginPublication(publication);
    await settleChannel(
      publication,
      0,
      Object.freeze({
        status: "conflict",
        revision: channelCall.request.revision,
        bundleStatus: "stored",
        currentGeneration: 8,
      }),
    );

    await waitFor(() => {
      expect(publicationRegion().getAttribute("data-publication-state")).toBe("conflict");
    });
    expect(publication.activationCalls).toHaveLength(0);
    expect(publicationStatus()).toContain("preview channel moved to generation 8 concurrently");
    expect(publicationRegion().textContent).not.toContain("is active");
    expect(
      within(publicationRegion())
        .getAllByRole("listitem")
        .map((item) => item.getAttribute("data-stage-state")),
    ).toEqual(["done", "failed", "blocked"]);
  });

  it("shows a mismatched durable host revision only as last-known-good preservation", async () => {
    const persistence = createControlledPersistence();
    const publication = createControlledPublication();
    renderApplication(persistence.port, publication.port);
    await saveAs(persistence, 0, { status: "created", generation: 1 });

    const channelCall = await beginPublication(publication);
    await settleChannel(publication, 0, publishedSettlement(channelCall.request.revision, 7));
    await waitFor(() => {
      expect(publication.activationCalls).toHaveLength(1);
    });
    await settleActivation(publication, 0, activeSettlement(OTHER_REVISION, 5, "preserved"));

    await waitFor(() => {
      expect(publicationRegion().getAttribute("data-publication-state")).toBe("preserved");
    });
    expect(publicationStatus()).toContain("reference host preserved sha256:bbb");
    expect(publicationRegion().textContent).not.toContain("is active");
    expect(within(publicationRegion()).queryByText("Activation", { selector: "dt" })).toBeNull();
    expect(
      within(publicationRegion())
        .getAllByRole("listitem")
        .map((item) => item.getAttribute("data-stage-state")),
    ).toEqual(["done", "done", "failed"]);
  });

  it("does not surface late replaced-port or unmounted settlements as current success", async () => {
    {
      const racePersistence = createControlledPersistence();
      const stalePublication = createControlledPublication();
      const replacementPublication = createControlledPublication();
      const raceRender = renderApplication(racePersistence.port, stalePublication.port);
      await editTitle(EDITED_TITLE);
      await saveAs(racePersistence, 0, { status: "created", generation: 1 });
      const staleChannelCall = await beginPublication(stalePublication);

      act(() => {
        staleChannelCall.resolve(publishedSettlement(staleChannelCall.request.revision, 5));
        raceRender.rerender(
          <DesenAppApplication
            persistencePort={racePersistence.port}
            publicationPort={replacementPublication.port}
          />,
        );
      });
      await act(async () => {
        await staleChannelCall.promise;
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(stalePublication.activationCalls).toHaveLength(0);
      expect(replacementPublication.activationCalls).toHaveLength(0);
      expect(publicationRegion().textContent).not.toContain("is active");
      raceRender.unmount();
    }

    const persistence = createControlledPersistence();
    const oldPublication = createControlledPublication();
    const currentPublication = createControlledPublication();
    const rendered = renderApplication(persistence.port, oldPublication.port);
    await editTitle(EDITED_TITLE);
    await saveAs(persistence, 0, { status: "created", generation: 1 });

    const oldChannelCall = await beginPublication(oldPublication);
    rendered.rerender(
      <DesenAppApplication
        persistencePort={persistence.port}
        publicationPort={currentPublication.port}
      />,
    );
    await waitFor(() => {
      expect(publicationStatus()).toMatch(/ready to publish/u);
    });
    await editTitle(LATER_TITLE);
    expect(publicationRegion().getAttribute("data-publication-state")).toBe("save-required");

    await settleChannel(oldPublication, 0, publishedSettlement(oldChannelCall.request.revision, 6));
    expect(oldPublication.activationCalls).toHaveLength(0);
    expect(publicationRegion().getAttribute("data-publication-state")).toBe("save-required");
    expect(screen.getByRole("heading", { level: 2, name: LATER_TITLE })).toBeTruthy();
    expect(publicationRegion().textContent).not.toContain("is active");

    await saveAs(persistence, 1, { status: "updated", generation: 2 });
    const currentChannelCall = await beginPublication(currentPublication);
    await settleChannel(
      currentPublication,
      0,
      publishedSettlement(currentChannelCall.request.revision, 9),
    );
    await waitFor(() => {
      expect(currentPublication.activationCalls).toHaveLength(1);
    });
    rendered.unmount();
    await settleActivation(
      currentPublication,
      0,
      activeSettlement(currentChannelCall.request.revision, 12),
    );

    renderApplication(persistence.port, currentPublication.port);
    expect(publicationRegion().getAttribute("data-publication-state")).not.toBe("active");
    expect(publicationRegion().textContent).not.toContain("is active");
    expect(screen.getByRole("heading", { level: 2, name: "Sign in" })).toBeTruthy();
  }, 10_000);

  it("keeps persistence and publication independently unavailable without trusted public ports", () => {
    const publication = createControlledPublication();
    const rendered = renderApplication(null, publication.port);

    expect(within(persistenceRegion()).getByRole("status").textContent).toMatch(
      /persistence unavailable/iu,
    );
    expect(openButton().disabled).toBe(true);
    expect(saveButton().disabled).toBe(true);
    expect(publicationStatus()).toMatch(/not configured/iu);
    expect(publishButton().disabled).toBe(true);
    fireEvent.click(publishButton());
    expect(publication.channelCalls).toHaveLength(0);

    const persistence = createControlledPersistence();
    rendered.rerender(
      <DesenAppApplication persistencePort={persistence.port} publicationPort={null} />,
    );
    expect(openButton().disabled).toBe(false);
    expect(saveButton().disabled).toBe(false);
    expect(publicationStatus()).toMatch(/not configured/iu);
    expect(publishButton().disabled).toBe(true);
  });
});
