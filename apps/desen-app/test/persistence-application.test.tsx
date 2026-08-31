// @vitest-environment jsdom
import { StrictMode, act } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDesenEditorDocument } from "@desen/editor-core";

import { DesenAppApplication } from "../src/application.js";
import * as authoringFixtures from "../src/authoring-fixtures.js";
import { REFERENCE_EDITOR_DOCUMENT } from "../src/authoring-preview.js";

import type {
  DesenEditorDocument,
  DesenEditorPersistencePort,
  DesenEditorSourceOpenResult,
  DesenEditorSourceSaveRequest,
  DesenEditorSourceSaveResult,
} from "@desen/editor-core";

const SOURCE_KEY = "account-app-source";
const SIGN_IN_PATH = "/projects/account-app/surfaces/sign-in";

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

type MutableRecord = Record<string, unknown>;

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

function copyJson<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value;
}

function requireRecord(value: unknown, label: string): MutableRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`Expected ${label} to be an object.`);
  }
  return value as MutableRecord;
}

function requireArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new TypeError(`Expected ${label} to be an array.`);
  return value;
}

function mutableSignInSurface(source: unknown): MutableRecord {
  const surfaces = requireRecord(requireRecord(source, "Source").surfaces, "Source surfaces");
  return requireRecord(surfaces["sign-in"], "sign-in surface");
}

function mutableTitleNode(source: unknown): MutableRecord {
  const surface = mutableSignInSurface(source);
  const root = requireRecord(surface.root, "sign-in root");
  const slots = requireRecord(root.slots, "sign-in root slots");
  const children = requireArray(slots.default, "sign-in default slot");
  const title = children.find(
    (candidate) => requireRecord(candidate, "Source node").id === "sign-in.title",
  );
  if (title === undefined) throw new Error("Expected the sign-in title node.");
  return requireRecord(title, "sign-in title node");
}

function admitDocument(source: unknown): DesenEditorDocument {
  const admitted = createDesenEditorDocument(source);
  if (!admitted.ok) throw new Error("Expected the persistence test Source to be admitted.");
  return admitted.document;
}

function documentWithSignInValues(title: string, email = ""): DesenEditorDocument {
  const source = copyJson<unknown>(REFERENCE_EDITOR_DOCUMENT);
  const titleNode = mutableTitleNode(source);
  requireRecord(titleNode.props, "title props").text = title;
  const state = requireRecord(mutableSignInSurface(source).state, "sign-in state");
  requireRecord(state.email, "email state").initial = email;
  return admitDocument(source);
}

function documentForAnotherIdentity(): DesenEditorDocument {
  const source = copyJson<unknown>(REFERENCE_EDITOR_DOCUMENT);
  requireRecord(source, "Source").id = "com.example.other-app";
  return admitDocument(source);
}

function documentWithoutSignInRoute(): DesenEditorDocument {
  const source = copyJson<unknown>(REFERENCE_EDITOR_DOCUMENT);
  const surfaces = requireRecord(requireRecord(source, "Source").surfaces, "Source surfaces");
  delete surfaces["sign-in"];
  return admitDocument(source);
}

function renderApplication(persistencePort?: DesenEditorPersistencePort) {
  window.history.replaceState(null, "", SIGN_IN_PATH);
  return render(
    persistencePort === undefined ? (
      <DesenAppApplication />
    ) : (
      <DesenAppApplication persistencePort={persistencePort} />
    ),
  );
}

function persistenceRegion(): HTMLElement {
  return screen.getByRole("region", { name: "Source persistence" });
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

function requestOpen(): void {
  fireEvent.click(openButton());
  const confirmation = screen.queryByRole("button", { name: "Discard changes and open" });
  if (confirmation !== null) fireEvent.click(confirmation);
}

function persistenceStatus(): string {
  return within(persistenceRegion()).getByRole("status").textContent ?? "";
}

async function settleOpen(
  controlled: ControlledPersistence,
  index: number,
  result: DesenEditorSourceOpenResult,
): Promise<void> {
  const call = controlled.openCalls[index];
  if (call === undefined) throw new Error(`Expected open call ${index}.`);
  await act(async () => {
    call.resolve(result);
    await call.promise;
  });
}

async function settleSave(
  controlled: ControlledPersistence,
  index: number,
  result: DesenEditorSourceSaveResult,
): Promise<void> {
  const call = controlled.saveCalls[index];
  if (call === undefined) throw new Error(`Expected save call ${index}.`);
  await act(async () => {
    call.resolve(result);
    await call.promise;
  });
}

async function editTitle(title: string): Promise<void> {
  const layer = screen.getByRole("button", {
    name: /^(?:Select|Deselect) Text layer · sign-in\.title$/,
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

function failedOpen(): DesenEditorSourceOpenResult {
  return Object.freeze({
    status: "failed",
    diagnostic: Object.freeze({
      code: "run.desen.editor/PERSISTENCE_STORAGE_UNAVAILABLE",
      message: "The editor Source storage is unavailable.",
    }),
  });
}

function indeterminateSave(): DesenEditorSourceSaveResult {
  return Object.freeze({
    status: "indeterminate",
    diagnostic: Object.freeze({
      code: "run.desen.editor/PERSISTENCE_COMMIT_INDETERMINATE",
      message: "The editor Source save may have committed.",
    }),
  });
}

describe("Desen App Source persistence integration", () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    document.title = "";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
    document.body.replaceChildren();
  });

  it("keeps persistence visibly unavailable when the host injects no public port", () => {
    renderApplication();

    expect(persistenceStatus()).toMatch(/persistence unavailable/i);
    expect(openButton().disabled).toBe(true);
    expect(saveButton().disabled).toBe(true);
    expect(within(persistenceRegion()).queryByRole("textbox")).toBeNull();
  });

  it("protects an edited no-port draft across navigation, traversal, and page exit", async () => {
    const controlled = createControlledPersistence();
    const rendered = renderApplication();
    const confirmNavigation = vi.spyOn(window, "confirm").mockReturnValue(false);

    expect(within(persistenceRegion()).getByText("Local draft unchanged")).toBeTruthy();
    const pristineBeforeUnload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(pristineBeforeUnload);
    expect(pristineBeforeUnload.defaultPrevented).toBe(false);

    fireEvent.click(screen.getByRole("link", { name: "Account app" }));
    expect(confirmNavigation).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { level: 2, name: "All surfaces" })).toBeTruthy();
    const surfaceNavigation = screen.getByRole("navigation", { name: "Account app surfaces" });
    fireEvent.click(within(surfaceNavigation).getByRole("link", { name: /Sign-in/ }));
    expect(window.location.pathname).toBe(SIGN_IN_PATH);

    fireEvent.click(screen.getByRole("button", { name: "Select Text layer · sign-in.title" }));
    const sameValueDraft = within(
      screen.getByRole("complementary", { name: "Inspector" }),
    ).getByRole("textbox", { name: "Text" });
    fireEvent.change(sameValueDraft, { target: { value: "Transient same-value draft" } });
    fireEvent.change(sameValueDraft, { target: { value: "Sign in" } });
    fireEvent.blur(sameValueDraft);
    expect(within(persistenceRegion()).getByText("Local draft unchanged")).toBeTruthy();

    await editTitle("Changed then reverted without persistence");
    expect(within(persistenceRegion()).getByText("Unsaved changes")).toBeTruthy();
    await editTitle("Sign in");
    expect(within(persistenceRegion()).getByText("Local draft unchanged")).toBeTruthy();
    const revertedBeforeUnload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(revertedBeforeUnload);
    expect(revertedBeforeUnload.defaultPrevented).toBe(false);
    fireEvent.click(screen.getByRole("link", { name: "Account app" }));
    expect(confirmNavigation).not.toHaveBeenCalled();
    fireEvent.click(
      within(screen.getByRole("navigation", { name: "Account app surfaces" })).getByRole("link", {
        name: /Sign-in/,
      }),
    );
    expect(window.location.pathname).toBe(SIGN_IN_PATH);

    rendered.rerender(<DesenAppApplication persistencePort={controlled.port} />);
    expect(within(persistenceRegion()).getByText("Unsaved changes")).toBeTruthy();
    rendered.rerender(<DesenAppApplication />);
    expect(within(persistenceRegion()).getByText("Local draft unchanged")).toBeTruthy();

    await editTitle("Unsaved in-memory draft");
    expect(within(persistenceRegion()).getByText("Unsaved changes")).toBeTruthy();
    rendered.rerender(<DesenAppApplication persistencePort={controlled.port} />);
    expect(within(persistenceRegion()).getByText("Unsaved changes")).toBeTruthy();
    rendered.rerender(<DesenAppApplication />);
    expect(within(persistenceRegion()).getByText("Unsaved changes")).toBeTruthy();
    fireEvent.click(screen.getByRole("link", { name: "Account app" }));
    expect(confirmNavigation).toHaveBeenCalledTimes(1);
    expect(window.location.pathname).toBe(SIGN_IN_PATH);
    expect(screen.getByRole("heading", { level: 2, name: "Unsaved in-memory draft" })).toBeTruthy();

    window.history.pushState(null, "", "/projects/account-app");
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(confirmNavigation).toHaveBeenCalledTimes(2);
    expect(window.location.pathname).toBe(SIGN_IN_PATH);
    expect(screen.getByRole("heading", { level: 2, name: "Unsaved in-memory draft" })).toBeTruthy();

    const beforeUnload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(beforeUnload);
    expect(beforeUnload.defaultPrevented).toBe(true);

    confirmNavigation.mockReturnValue(true);
    fireEvent.click(screen.getByRole("link", { name: "Account app" }));
    expect(confirmNavigation).toHaveBeenCalledTimes(3);
    expect(screen.getByRole("heading", { level: 2, name: "All surfaces" })).toBeTruthy();

    const afterUnmount = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(afterUnmount);
    expect(afterUnmount.defaultPrevented).toBe(false);
  });

  it("requires explicit, cancelable confirmation before dirty Open can replace the draft", async () => {
    const controlled = createControlledPersistence();
    renderApplication(controlled.port);
    await editTitle("Keep this local draft");

    fireEvent.click(openButton());
    expect(controlled.openCalls).toHaveLength(0);
    expect(within(persistenceRegion()).getByText("Discard unsaved changes?")).toBeTruthy();
    fireEvent.click(
      within(persistenceRegion()).getByRole("button", {
        name: "Cancel open",
      }),
    );
    expect(controlled.openCalls).toHaveLength(0);
    expect(screen.getByRole("heading", { level: 2, name: "Keep this local draft" })).toBeTruthy();

    requestOpen();
    expect(controlled.openCalls).toHaveLength(1);
    await settleOpen(controlled, 0, { status: "missing" });
    expect(screen.getByRole("heading", { level: 2, name: "Keep this local draft" })).toBeTruthy();
  });

  it("saves with explicit create, update, and unchanged generation preconditions", async () => {
    const controlled = createControlledPersistence();
    const rendered = renderApplication(controlled.port);

    fireEvent.click(saveButton());
    expect(controlled.saveCalls).toHaveLength(1);
    expect(controlled.saveCalls[0]?.request).toEqual({
      sourceKey: SOURCE_KEY,
      expectedGeneration: null,
      document: REFERENCE_EDITOR_DOCUMENT,
    });
    await settleSave(controlled, 0, { status: "created", generation: 1 });
    expect(persistenceStatus()).toMatch(/saved.*generation 1/i);

    await editTitle("First durable title");
    fireEvent.click(saveButton());
    expect(controlled.saveCalls[1]?.request.sourceKey).toBe(SOURCE_KEY);
    expect(controlled.saveCalls[1]?.request.expectedGeneration).toBe(1);
    expect(controlled.saveCalls[1]?.request.document).toEqual(
      documentWithSignInValues("First durable title"),
    );
    await settleSave(controlled, 1, { status: "updated", generation: 2 });
    expect(persistenceStatus()).toMatch(/saved.*generation 2/i);

    await editTitle("Canonical bytes already stored");
    fireEvent.click(saveButton());
    expect(controlled.saveCalls[2]?.request.sourceKey).toBe(SOURCE_KEY);
    expect(controlled.saveCalls[2]?.request.expectedGeneration).toBe(2);
    await settleSave(controlled, 2, { status: "unchanged", generation: 2 });
    expect(persistenceStatus()).toMatch(/already saved.*generation 2|saved.*generation 2/i);
    expect(saveButton().disabled).toBe(true);
    rendered.rerender(<DesenAppApplication />);
    expect(within(persistenceRegion()).getByText("Local draft unchanged")).toBeTruthy();
    const afterPortRemoval = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(afterPortRemoval);
    expect(afterPortRemoval.defaultPrevented).toBe(false);
  });

  it("keeps rejected-candidate diagnostics outside Source, dirty state, and Save requests", () => {
    const controlled = createControlledPersistence();
    renderApplication(controlled.port);
    fireEvent.click(screen.getByRole("button", { name: "Select Stack layer · sign-in.layout" }));
    const inspector = screen.getByRole("complementary", { name: "Inspector" });
    const maxWidth = within(inspector).getByRole("spinbutton", {
      name: "Max Width",
    }) as HTMLInputElement;
    const dirtyBefore = persistenceRegion().querySelector("[data-dirty]")?.textContent;

    fireEvent.change(maxWidth, { target: { value: "0" } });
    fireEvent.blur(maxWidth);

    expect(within(inspector).getByRole("region", { name: "Validation diagnostics" })).toBeTruthy();
    expect(persistenceRegion().querySelector("[data-dirty]")?.textContent).toBe(dirtyBefore);
    fireEvent.click(saveButton());
    expect(controlled.saveCalls).toHaveLength(1);
    expect(controlled.saveCalls[0]?.request).toEqual({
      sourceKey: SOURCE_KEY,
      expectedGeneration: null,
      document: REFERENCE_EDITOR_DOCUMENT,
    });
    expect(Object.hasOwn(controlled.saveCalls[0]?.request.document ?? {}, "diagnostics")).toBe(
      false,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Sign in" })).toBeTruthy();
  });

  it("preserves the session after a missing Open and authorizes a create-only Save", async () => {
    const controlled = createControlledPersistence();
    renderApplication(controlled.port);
    await editTitle("Keep this unsaved draft");

    requestOpen();
    expect(controlled.openCalls[0]?.sourceKey).toBe(SOURCE_KEY);
    await settleOpen(controlled, 0, { status: "missing" });

    expect(screen.getByRole("heading", { level: 2, name: "Keep this unsaved draft" })).toBeTruthy();
    expect(persistenceStatus()).toMatch(/missing|not found|create/i);
    expect(saveButton().disabled).toBe(false);
    fireEvent.click(saveButton());
    expect(controlled.saveCalls[0]?.request).toEqual({
      sourceKey: SOURCE_KEY,
      expectedGeneration: null,
      document: documentWithSignInValues("Keep this unsaved draft"),
    });
  });

  it("opens one exact accepted Source atomically and clears transient editor and fixture state", async () => {
    const createFixtureController = authoringFixtures.createAuthoringOperationFixtureController;
    const controllers: ReturnType<typeof createFixtureController>[] = [];
    const contexts: Parameters<typeof createFixtureController>[1][] = [];
    vi.spyOn(authoringFixtures, "createAuthoringOperationFixtureController").mockImplementation(
      (model, context) => {
        contexts.push(context);
        const controller = createFixtureController(model, context);
        controllers.push(controller);
        return controller;
      },
    );
    const controlled = createControlledPersistence();
    const rendered = renderApplication(controlled.port);
    await editTitle("Discarded draft");
    fireEvent.click(
      screen.getByRole("button", { name: "Select Text field layer · sign-in.email" }),
    );
    const scenario = within(screen.getByRole("region", { name: "Scenario preview" })).getByRole(
      "combobox",
      { name: "Component values" },
    );
    fireEvent.change(scenario, { target: { value: "catalog:default" } });
    const scenarioController = controllers.at(-1);
    const scenarioContext = contexts.at(-1);
    if (scenarioController === undefined || scenarioContext === undefined) {
      throw new Error("Expected the Catalog scenario fixture authority.");
    }
    const fixtureRequest = {
      context: { ...scenarioContext, requestId: "persistence-open-revocation" },
      capabilityId: "com.example.auth/signIn",
      invocationAlias: "signIn",
      input: {},
      effect: "network" as const,
    };
    const pendingFixture = scenarioController.operationPort.invoke(fixtureRequest);
    expect(scenarioController.read().operations[0]?.status).toBe("pending");

    const runButton = screen.getByRole("button", { name: "Run" }) as HTMLButtonElement;
    requestOpen();
    expect(runButton.disabled).toBe(true);
    const openedDocument = documentWithSignInValues("Stored title", "stored@example.com");
    await settleOpen(controlled, 0, {
      status: "opened",
      generation: 7,
      document: openedDocument,
    });

    expect(screen.getByRole("heading", { level: 2, name: "Stored title" })).toBeTruthy();
    expect(
      (
        within(screen.getByRole("group", { name: "Sign-in adapter canvas" })).getByLabelText(
          "Email",
        ) as HTMLInputElement
      ).value,
    ).toBe("stored@example.com");
    expect(persistenceStatus()).toMatch(/opened.*generation 7/i);
    expect(runButton.disabled).toBe(false);
    await expect(Promise.resolve(pendingFixture)).resolves.toEqual({ status: "denied" });
    expect(scenarioController.operationPort.invoke(fixtureRequest)).toEqual({ status: "denied" });
    expect(screen.getByText("Select a layer")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Select Text field layer · sign-in.email" }),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Select Text field layer · sign-in.email" }),
    );
    expect(
      (
        within(screen.getByRole("region", { name: "Scenario preview" })).getByRole("combobox", {
          name: "Component values",
        }) as HTMLSelectElement
      ).value,
    ).toBe("source");
    expect(saveButton().disabled).toBe(true);
    rendered.rerender(<DesenAppApplication />);
    expect(persistenceStatus()).toMatch(/persistence unavailable/i);
    expect(within(persistenceRegion()).getByText("Local draft unchanged")).toBeTruthy();
    const afterPortRemoval = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(afterPortRemoval);
    expect(afterPortRemoval.defaultPrevented).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    expect(
      within(screen.getByRole("complementary", { name: "Run controls" })).getByRole("status")
        .textContent,
    ).not.toContain("Pending");
  });

  it("keeps the prior Source and canvas for failed, wrong-document, and wrong-route opens", async () => {
    const controlled = createControlledPersistence();
    renderApplication(controlled.port);
    await editTitle("Preserved title");
    const originalCanvas = screen.getByRole("group", { name: "Sign-in adapter canvas" });

    const rejectedResults: readonly DesenEditorSourceOpenResult[] = [
      failedOpen(),
      { status: "opened", generation: 2, document: documentForAnotherIdentity() },
      { status: "opened", generation: 3, document: documentWithoutSignInRoute() },
    ];
    for (const [index, result] of rejectedResults.entries()) {
      requestOpen();
      expect(controlled.openCalls[index]?.sourceKey).toBe(SOURCE_KEY);
      await settleOpen(controlled, index, result);
      expect(screen.getByRole("heading", { level: 2, name: "Preserved title" })).toBeTruthy();
      expect(screen.getByRole("group", { name: "Sign-in adapter canvas" })).toBe(originalCanvas);
      expect(within(originalCanvas).getByLabelText("Email")).toBeTruthy();
      expect(persistenceStatus()).toMatch(/failed|rejected|could not|unavailable/i);
    }
  });

  it("locks Save after conflict or indeterminate settlement until an explicit Open", async () => {
    const controlled = createControlledPersistence();
    renderApplication(controlled.port);

    fireEvent.click(saveButton());
    await settleSave(controlled, 0, { status: "created", generation: 1 });
    await editTitle("Conflicting edit");
    fireEvent.click(saveButton());
    await settleSave(controlled, 1, { status: "conflict", currentGeneration: 4 });
    expect(persistenceStatus()).toMatch(/conflict.*open|open.*conflict/i);
    expect(saveButton().disabled).toBe(true);

    requestOpen();
    await settleOpen(controlled, 0, {
      status: "opened",
      generation: 4,
      document: documentWithSignInValues("Conflict winner"),
    });
    await editTitle("Edit after conflict recovery");
    expect(saveButton().disabled).toBe(false);
    fireEvent.click(saveButton());
    expect(controlled.saveCalls[2]?.request.expectedGeneration).toBe(4);
    await settleSave(controlled, 2, indeterminateSave());
    expect(persistenceStatus()).toMatch(/uncertain|indeterminate.*open|open.*indeterminate/i);
    expect(saveButton().disabled).toBe(true);

    await editTitle("Still locked after another edit");
    expect(saveButton().disabled).toBe(true);
    requestOpen();
    await settleOpen(controlled, 1, {
      status: "opened",
      generation: 5,
      document: documentWithSignInValues("Known durable state"),
    });
    await editTitle("Unlocked after Open");
    expect(saveButton().disabled).toBe(false);
  });

  it("protects a dirty pending session across canceled links, traversal, and page exit", async () => {
    const controlled = createControlledPersistence();
    renderApplication(controlled.port);
    const originalCanvas = screen.getByRole("group", { name: "Sign-in adapter canvas" });
    fireEvent.click(screen.getByRole("button", { name: "Select Text layer · sign-in.title" }));
    requestOpen();
    expect(controlled.openCalls).toHaveLength(1);
    const confirmNavigation = vi.spyOn(window, "confirm").mockReturnValue(false);

    fireEvent.click(screen.getByRole("link", { name: "Account app" }));
    expect(confirmNavigation).toHaveBeenCalledTimes(1);
    expect(window.location.pathname).toBe(SIGN_IN_PATH);
    expect(screen.getByRole("group", { name: "Sign-in adapter canvas" })).toBe(originalCanvas);
    expect(
      screen.getByRole("button", { name: "Deselect Text layer · sign-in.title" }),
    ).toBeTruthy();
    expect(controlled.openCalls).toHaveLength(1);

    window.history.pushState(null, "", "/projects/account-app");
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(confirmNavigation).toHaveBeenCalledTimes(2);
    expect(window.location.pathname).toBe(SIGN_IN_PATH);
    expect(screen.getByRole("group", { name: "Sign-in adapter canvas" })).toBe(originalCanvas);
    expect(controlled.openCalls).toHaveLength(1);

    const beforeUnload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(beforeUnload);
    expect(beforeUnload.defaultPrevented).toBe(true);

    confirmNavigation.mockReturnValue(true);
    fireEvent.click(screen.getByRole("link", { name: "Account app" }));
    expect(screen.getByRole("heading", { level: 2, name: "All surfaces" })).toBeTruthy();
    const afterUnmount = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(afterUnmount);
    expect(afterUnmount.defaultPrevented).toBe(false);

    await settleOpen(controlled, 0, {
      status: "opened",
      generation: 8,
      document: documentWithSignInValues("Late discarded session"),
    });
    expect(screen.queryByRole("heading", { level: 2, name: "Late discarded session" })).toBeNull();
  });

  it("keeps a newer authored edit when an older Open settles through the React wiring", async () => {
    const controlled = createControlledPersistence();
    renderApplication(controlled.port);

    requestOpen();
    await editTitle("Keep the edit made while opening");
    await settleOpen(controlled, 0, {
      status: "opened",
      generation: 6,
      document: documentWithSignInValues("Late stored title"),
    });

    expect(
      screen.getByRole("heading", { level: 2, name: "Keep the edit made while opening" }),
    ).toBeTruthy();
    expect(screen.queryByRole("heading", { level: 2, name: "Late stored title" })).toBeNull();
    expect(within(persistenceRegion()).getByText("Unsaved changes")).toBeTruthy();
    fireEvent.click(saveButton());
    expect(controlled.saveCalls[0]?.request.expectedGeneration).toBeNull();
    expect(controlled.saveCalls[0]?.request.document).toEqual(
      documentWithSignInValues("Keep the edit made while opening"),
    );
  });

  it("ignores stale open and save settlements after the owning surface route unmounts", async () => {
    const controlled = createControlledPersistence();
    renderApplication(controlled.port);
    vi.spyOn(window, "confirm").mockReturnValue(true);

    requestOpen();
    fireEvent.click(screen.getByRole("link", { name: "Account app" }));
    expect(screen.getByRole("heading", { level: 2, name: "All surfaces" })).toBeTruthy();
    await settleOpen(controlled, 0, {
      status: "opened",
      generation: 9,
      document: documentWithSignInValues("Late open must be ignored"),
    });
    fireEvent.click(screen.getByRole("link", { name: /Sign-in/ }));
    expect(screen.getByRole("heading", { level: 2, name: "Sign in" })).toBeTruthy();

    fireEvent.click(saveButton());
    expect(controlled.saveCalls[0]?.request.expectedGeneration).toBeNull();
    fireEvent.click(screen.getByRole("link", { name: "Account app" }));
    await settleSave(controlled, 0, { status: "created", generation: 1 });
    fireEvent.click(screen.getByRole("link", { name: /Sign-in/ }));
    expect(screen.getByRole("heading", { level: 2, name: "Sign in" })).toBeTruthy();
    fireEvent.click(saveButton());
    expect(controlled.saveCalls[1]?.request.expectedGeneration).toBeNull();
  });

  it("keeps one injected persistence controller live through StrictMode replay", async () => {
    const controlled = createControlledPersistence();
    window.history.replaceState(null, "", SIGN_IN_PATH);
    const rendered = render(
      <StrictMode>
        <DesenAppApplication persistencePort={controlled.port} />
      </StrictMode>,
    );

    fireEvent.click(saveButton());
    expect(controlled.saveCalls).toHaveLength(1);
    await settleSave(controlled, 0, { status: "created", generation: 1 });
    requestOpen();
    expect(controlled.openCalls).toHaveLength(1);

    rendered.unmount();
    await settleOpen(controlled, 0, {
      status: "opened",
      generation: 2,
      document: documentWithSignInValues("Late StrictMode result"),
    });
    expect(controlled.saveCalls).toHaveLength(1);
    expect(controlled.openCalls).toHaveLength(1);
  });

  it("ignores an old port settlement after trusted host authority is replaced", async () => {
    const first = createControlledPersistence();
    const second = createControlledPersistence();
    const rendered = renderApplication(first.port);

    requestOpen();
    rendered.rerender(<DesenAppApplication persistencePort={second.port} />);
    await settleOpen(first, 0, {
      status: "opened",
      generation: 8,
      document: documentWithSignInValues("Old host result"),
    });

    expect(screen.getByRole("heading", { level: 2, name: "Sign in" })).toBeTruthy();
    expect(screen.queryByRole("heading", { level: 2, name: "Old host result" })).toBeNull();
    fireEvent.click(saveButton());
    expect(first.saveCalls).toHaveLength(0);
    expect(second.saveCalls[0]?.request.expectedGeneration).toBeNull();
  });

  it("revokes a dirty Open confirmation when trusted host authority is replaced", () => {
    const first = createControlledPersistence();
    const second = createControlledPersistence();
    const rendered = renderApplication(first.port);

    fireEvent.click(openButton());
    const staleConfirmation = within(persistenceRegion()).getByRole("button", {
      name: "Discard changes and open",
    });
    expect(first.openCalls).toHaveLength(0);

    rendered.rerender(<DesenAppApplication persistencePort={second.port} />);
    expect(
      within(persistenceRegion()).queryByRole("button", {
        name: "Discard changes and open",
      }),
    ).toBeNull();
    fireEvent.click(staleConfirmation);
    expect(first.openCalls).toHaveLength(0);
    expect(second.openCalls).toHaveLength(0);

    fireEvent.click(openButton());
    expect(second.openCalls).toHaveLength(0);
    fireEvent.click(
      within(persistenceRegion()).getByRole("button", {
        name: "Discard changes and open",
      }),
    );
    expect(first.openCalls).toHaveLength(0);
    expect(second.openCalls).toHaveLength(1);
  });

  it("never sends Catalog scenario values or Runtime form secrets to the persistence port", async () => {
    const controlled = createControlledPersistence();
    renderApplication(controlled.port);
    fireEvent.click(
      screen.getByRole("button", { name: "Select Text field layer · sign-in.email" }),
    );
    fireEvent.change(
      within(screen.getByRole("region", { name: "Scenario preview" })).getByRole("combobox", {
        name: "Component values",
      }),
      { target: { value: "catalog:invalid" } },
    );
    await waitFor(() => {
      expect(
        (
          within(screen.getByRole("group", { name: "Sign-in adapter canvas" })).getByLabelText(
            "Email",
          ) as HTMLInputElement
        ).value,
      ).toBe("bad");
    });

    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    const canvas = screen.getByRole("group", { name: "Sign-in adapter canvas" });
    await act(async () => {
      fireEvent.change(within(canvas).getByLabelText("Email"), {
        target: { value: "runtime@example.com" },
      });
      fireEvent.change(within(canvas).getByLabelText("Password"), {
        target: { value: "runtime-secret" },
      });
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    fireEvent.click(saveButton());

    const request = controlled.saveCalls[0]?.request;
    expect(request?.sourceKey).toBe(SOURCE_KEY);
    expect(request?.document).toEqual(REFERENCE_EDITOR_DOCUMENT);
    const serialized = JSON.stringify(request?.document);
    expect(serialized).not.toContain("runtime@example.com");
    expect(serialized).not.toContain("runtime-secret");
    expect(serialized).not.toContain('"initial":"bad"');
  });

  it("keeps a newer edit dirty when an older Source snapshot settles in flight", async () => {
    const controlled = createControlledPersistence();
    const rendered = renderApplication(controlled.port);
    await editTitle("Snapshot sent to storage");

    fireEvent.click(saveButton());
    expect(controlled.saveCalls[0]?.request.document).toEqual(
      documentWithSignInValues("Snapshot sent to storage"),
    );
    await editTitle("Newer local edit");
    await settleSave(controlled, 0, { status: "created", generation: 1 });

    expect(screen.getByRole("heading", { level: 2, name: "Newer local edit" })).toBeTruthy();
    expect(within(persistenceRegion()).getByText("Unsaved changes")).toBeTruthy();
    expect(saveButton().disabled).toBe(false);

    await editTitle("Snapshot sent to storage");
    expect(within(persistenceRegion()).getByText("Saved")).toBeTruthy();
    expect(saveButton().disabled).toBe(true);
    const revertedBeforeUnload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(revertedBeforeUnload);
    expect(revertedBeforeUnload.defaultPrevented).toBe(false);

    await editTitle("Newer local edit");
    expect(within(persistenceRegion()).getByText("Unsaved changes")).toBeTruthy();
    fireEvent.click(saveButton());
    expect(controlled.saveCalls[1]?.request.expectedGeneration).toBe(1);
    expect(controlled.saveCalls[1]?.request.document).toEqual(
      documentWithSignInValues("Newer local edit"),
    );
    await settleSave(controlled, 1, { status: "updated", generation: 2 });
    expect(within(persistenceRegion()).getByText("Saved")).toBeTruthy();

    rendered.rerender(<DesenAppApplication />);
    expect(within(persistenceRegion()).getByText("Local draft unchanged")).toBeTruthy();
    const afterPortRemoval = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(afterPortRemoval);
    expect(afterPortRemoval.defaultPrevented).toBe(false);
  });
});
