// @vitest-environment jsdom
import { StrictMode, act } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import officialSignInSource from "../../../examples/sign-in/official-derived.source.desen.json";
import { createDesenEditorDocument } from "@desen/editor-core";
import { DesenAppProduct } from "../src/product-bootstrap.js";
import { EMPTY_REFERENCE_PROJECT_DOCUMENT } from "../src/reference-empty-project.js";

import type {
  DesenEditorPersistencePort,
  DesenEditorSourceOpenResult,
  DesenEditorSourceSaveRequest,
  DesenEditorSourceSaveResult,
} from "@desen/editor-core";

const PROJECTS_PATH = "/projects";
const SURFACE_PATH = "/projects/account-app/surfaces/sign-in";
const SOURCE_KEY = "account-app-source";

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

function deferred<Value>(): Deferred<Value> {
  let resolvePromise: ((value: Value) => void) | undefined;
  const promise = new Promise<Value>((resolve) => {
    resolvePromise = resolve;
  });
  if (resolvePromise === undefined) throw new Error("Deferred promise was not initialized.");
  return Object.freeze({ promise, resolve: resolvePromise });
}

function controlledPersistence(): ControlledPersistence {
  const openCalls: OpenCall[] = [];
  const saveCalls: SaveCall[] = [];
  const port: DesenEditorPersistencePort = Object.freeze({
    openSource(sourceKey: string) {
      const pending = deferred<DesenEditorSourceOpenResult>();
      openCalls.push({ sourceKey, ...pending });
      return pending.promise;
    },
    saveSource(request: DesenEditorSourceSaveRequest) {
      const pending = deferred<DesenEditorSourceSaveResult>();
      saveCalls.push({ request, ...pending });
      return pending.promise;
    },
  });
  return Object.freeze({ openCalls, port, saveCalls });
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

function renderProduct(controlled: ControlledPersistence, path = PROJECTS_PATH) {
  window.history.replaceState(null, "", path);
  return render(<DesenAppProduct persistencePort={controlled.port} />);
}

async function openMissingWorkspace(controlled: ControlledPersistence): Promise<void> {
  expect(controlled.openCalls).toHaveLength(1);
  expect(controlled.openCalls[0]?.sourceKey).toBe(SOURCE_KEY);
  await settleOpen(controlled, 0, { status: "missing" });
}

function openCreationDialog(): HTMLElement {
  fireEvent.click(screen.getByRole("button", { name: "New project" }));
  return screen.getByRole("dialog", { name: "Create a project" });
}

describe("Desen App normal product bootstrap", () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
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
    vi.restoreAllMocks();
    cleanup();
    document.body.replaceChildren();
    window.history.replaceState(null, "", PROJECTS_PATH);
  });

  it("opens the durable workspace exactly once through StrictMode before mounting product data", async () => {
    const controlled = controlledPersistence();
    window.history.replaceState(null, "", SURFACE_PATH);
    render(
      <StrictMode>
        <DesenAppProduct persistencePort={controlled.port} />
      </StrictMode>,
    );

    expect(screen.getByRole("heading", { name: "Opening your projects…" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "All projects" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Stack layer/ })).toBeNull();
    expect(controlled.openCalls).toHaveLength(1);

    await settleOpen(controlled, 0, { status: "missing" });

    expect(window.location.pathname).toBe(PROJECTS_PATH);
    expect(screen.getByRole("heading", { name: "All projects" })).toBeTruthy();
    expect(screen.getByText("0 projects")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "New project" }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it("creates the exact admitted empty Source before routing into its editor", async () => {
    const controlled = controlledPersistence();
    renderProduct(controlled);
    await openMissingWorkspace(controlled);

    openCreationDialog();
    expect(screen.getByText("Blank sign-in project")).toBeTruthy();
    expect(screen.getByText(/420 × 720 portrait frame/)).toBeTruthy();
    const submit = screen
      .getByRole("dialog", { name: "Create a project" })
      .querySelector<HTMLButtonElement>('button[type="submit"]');
    if (submit === null) throw new Error("Expected the project creation submit control.");
    fireEvent.click(submit);

    expect(controlled.saveCalls).toHaveLength(1);
    expect(controlled.saveCalls[0]?.request).toEqual({
      sourceKey: SOURCE_KEY,
      expectedGeneration: null,
      document: EMPTY_REFERENCE_PROJECT_DOCUMENT,
    });
    expect((screen.getByRole("button", { name: "Creating…" }) as HTMLButtonElement).disabled).toBe(
      true,
    );

    await settleSave(controlled, 0, { status: "created", generation: 1 });

    expect(window.location.pathname).toBe(SURFACE_PATH);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Select Stack layer · sign-in.layout" }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /layer · (?!sign-in\.layout)/ })).toBeNull();
    const persistence = screen.getByRole("region", { name: "Source persistence" });
    expect(within(persistence).getByText(/saved.*generation 1/i)).toBeTruthy();
    expect(
      (within(persistence).getByRole("button", { name: "Save source" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("opens an existing admitted Source without substituting fixture projects", async () => {
    const controlled = controlledPersistence();
    renderProduct(controlled, SURFACE_PATH);

    await settleOpen(controlled, 0, {
      status: "opened",
      generation: 4,
      document: EMPTY_REFERENCE_PROJECT_DOCUMENT,
    });

    expect(window.location.pathname).toBe(SURFACE_PATH);
    expect(
      screen.getByRole("button", { name: "Select Stack layer · sign-in.layout" }),
    ).toBeTruthy();
    expect(screen.queryByText("Checkout pilot")).toBeNull();
    const persistence = screen.getByRole("region", { name: "Source persistence" });
    expect(within(persistence).getByRole("status").textContent).toMatch(/generation 4/i);
  });

  it("rejects an admitted Source that exceeds the exact one-surface local product profile", async () => {
    const admitted = createDesenEditorDocument(officialSignInSource);
    if (!admitted.ok) throw new Error("Expected the multi-surface test Source to be valid.");
    const controlled = controlledPersistence();
    renderProduct(controlled, SURFACE_PATH);

    await settleOpen(controlled, 0, {
      status: "opened",
      generation: 4,
      document: admitted.document,
    });

    expect(
      screen.getByRole("heading", { name: "DESEN could not open this workspace." }),
    ).toBeTruthy();
    expect(screen.getByText(/No fixture project was substituted/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Stack layer/ })).toBeNull();
    expect(screen.queryByText("Account app")).toBeNull();
  });

  it("keeps create conflicts visible and offers an explicit non-overwriting reopen", async () => {
    const controlled = controlledPersistence();
    renderProduct(controlled);
    await openMissingWorkspace(controlled);
    openCreationDialog();

    const submit = screen
      .getByRole("dialog", { name: "Create a project" })
      .querySelector<HTMLButtonElement>('button[type="submit"]');
    if (submit === null) throw new Error("Expected the project creation submit control.");
    fireEvent.click(submit);
    await settleSave(controlled, 0, { status: "conflict", currentGeneration: 1 });

    expect(window.location.pathname).toBe(PROJECTS_PATH);
    expect(screen.getByRole("alert").textContent).toMatch(/another window/i);
    expect(controlled.saveCalls).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Open stored project" }));
    expect(controlled.openCalls).toHaveLength(2);
    await settleOpen(controlled, 1, {
      status: "opened",
      generation: 1,
      document: EMPTY_REFERENCE_PROJECT_DOCUMENT,
    });

    expect(window.location.pathname).toBe(SURFACE_PATH);
    expect(controlled.saveCalls).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: "Select Stack layer · sign-in.layout" }),
    ).toBeTruthy();
  });

  it("clears a stale create dialog when retry later opens the stored project", async () => {
    const controlled = controlledPersistence();
    renderProduct(controlled);
    await openMissingWorkspace(controlled);
    openCreationDialog();

    const submit = screen
      .getByRole("dialog", { name: "Create a project" })
      .querySelector<HTMLButtonElement>('button[type="submit"]');
    if (submit === null) throw new Error("Expected the project creation submit control.");
    fireEvent.click(submit);
    await settleSave(controlled, 0, { status: "conflict", currentGeneration: 1 });
    fireEvent.click(screen.getByRole("button", { name: "Open stored project" }));
    await settleOpen(controlled, 1, {
      status: "failed",
      diagnostic: {
        code: "run.desen.editor/PERSISTENCE_STORAGE_BUSY",
        message: "The editor Source storage is busy.",
      },
    });

    expect(
      screen.getByRole("heading", { name: "DESEN could not open this workspace." }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await settleOpen(controlled, 2, {
      status: "opened",
      generation: 1,
      document: EMPTY_REFERENCE_PROJECT_DOCUMENT,
    });

    expect(window.location.pathname).toBe(PROJECTS_PATH);
    expect(screen.queryByRole("dialog", { name: "Create a project" })).toBeNull();
    expect(screen.getByRole("heading", { level: 3, name: "Account app" })).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "New project" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("fails closed on unavailable or rejected storage and retries only on user request", async () => {
    const controlled = controlledPersistence();
    renderProduct(controlled, SURFACE_PATH);
    await settleOpen(controlled, 0, {
      status: "failed",
      diagnostic: {
        code: "run.desen.editor/PERSISTENCE_STORAGE_CORRUPT",
        message: "The editor Source storage is corrupt.",
      },
    });

    expect(
      screen.getByRole("heading", { name: "DESEN could not open this workspace." }),
    ).toBeTruthy();
    expect(screen.getByText(/No fixture project was substituted/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Stack layer/ })).toBeNull();
    expect(controlled.openCalls).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(controlled.openCalls).toHaveLength(2));
  });

  it("does not offer a false retry when the trusted host supplied no persistence authority", () => {
    render(<DesenAppProduct persistencePort={null} />);

    expect(
      screen.getByRole("heading", { name: "DESEN could not open this workspace." }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    expect(screen.getByRole("status").textContent).toMatch(/local workspace service/i);
    expect(screen.queryByText("Account app")).toBeNull();
  });

  it("revokes an in-flight create when the owning product composition unmounts", async () => {
    const controlled = controlledPersistence();
    const rendered = renderProduct(controlled);
    await openMissingWorkspace(controlled);
    openCreationDialog();
    const submit = screen
      .getByRole("dialog", { name: "Create a project" })
      .querySelector<HTMLButtonElement>('button[type="submit"]');
    if (submit === null) throw new Error("Expected the project creation submit control.");
    fireEvent.click(submit);
    expect(controlled.saveCalls).toHaveLength(1);

    rendered.unmount();
    await settleSave(controlled, 0, { status: "created", generation: 1 });

    expect(window.location.pathname).toBe(PROJECTS_PATH);
    expect(document.body.textContent).toBe("");
  });

  it("permanently discards a confirmed prepared-controller draft before it can be reopened", async () => {
    const controlled = controlledPersistence();
    renderProduct(controlled);
    await openMissingWorkspace(controlled);
    openCreationDialog();
    const submit = screen
      .getByRole("dialog", { name: "Create a project" })
      .querySelector<HTMLButtonElement>('button[type="submit"]');
    if (submit === null) throw new Error("Expected the project creation submit control.");
    fireEvent.click(submit);
    await settleSave(controlled, 0, { status: "created", generation: 1 });

    fireEvent.click(
      screen.getByRole("button", {
        name: /Insert Text into Stack sign-in\.layout default slot at position 1/u,
      }),
    );
    expect(screen.getByRole("button", { name: "Deselect Text layer · node.text" })).toBeTruthy();
    const confirmDiscard = vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(screen.getByRole("link", { name: "Projects" }));

    expect(confirmDiscard).toHaveBeenCalledTimes(1);
    expect(window.location.pathname).toBe(PROJECTS_PATH);
    expect(screen.getByText("Account app")).toBeTruthy();
    fireEvent.click(screen.getByRole("link", { name: "Open project" }));
    fireEvent.click(screen.getByRole("link", { name: /Sign-in/u }));

    expect(
      screen.getByRole("button", { name: "Select Stack layer · sign-in.layout" }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Text layer · node\.text/u })).toBeNull();
    fireEvent.click(screen.getByText("Source & release", { exact: true }));
    const persistence = screen.getByRole("region", { name: "Source persistence" });
    expect(
      (within(persistence).getByRole("button", { name: "Save source" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("blocks navigation while a prepared-controller save can still commit the current draft", async () => {
    const controlled = controlledPersistence();
    renderProduct(controlled);
    await openMissingWorkspace(controlled);
    openCreationDialog();
    const submit = screen
      .getByRole("dialog", { name: "Create a project" })
      .querySelector<HTMLButtonElement>('button[type="submit"]');
    if (submit === null) throw new Error("Expected the project creation submit control.");
    fireEvent.click(submit);
    await settleSave(controlled, 0, { status: "created", generation: 1 });

    fireEvent.click(
      screen.getByRole("button", {
        name: /Insert Text into Stack sign-in\.layout default slot at position 1/u,
      }),
    );
    fireEvent.click(screen.getByText("Source & release", { exact: true }));
    const persistence = screen.getByRole("region", { name: "Source persistence" });
    fireEvent.click(within(persistence).getByRole("button", { name: "Save source" }));
    expect(controlled.saveCalls).toHaveLength(2);

    const confirmDiscard = vi.spyOn(window, "confirm");
    fireEvent.click(screen.getByRole("link", { name: "Projects" }));
    expect(window.location.pathname).toBe(SURFACE_PATH);
    expect(confirmDiscard).not.toHaveBeenCalled();

    await settleSave(controlled, 1, { status: "updated", generation: 2 });
    fireEvent.click(screen.getByRole("link", { name: "Projects" }));
    expect(window.location.pathname).toBe(PROJECTS_PATH);
    expect(confirmDiscard).not.toHaveBeenCalled();
  });

  it("blocks discard after an indeterminate save until the stored Source is reopened", async () => {
    const controlled = controlledPersistence();
    renderProduct(controlled);
    await openMissingWorkspace(controlled);
    openCreationDialog();
    const submit = screen
      .getByRole("dialog", { name: "Create a project" })
      .querySelector<HTMLButtonElement>('button[type="submit"]');
    if (submit === null) throw new Error("Expected the project creation submit control.");
    fireEvent.click(submit);
    await settleSave(controlled, 0, { status: "created", generation: 1 });

    fireEvent.click(
      screen.getByRole("button", {
        name: /Insert Text into Stack sign-in\.layout default slot at position 1/u,
      }),
    );
    fireEvent.click(screen.getByText("Source & release", { exact: true }));
    const persistence = screen.getByRole("region", { name: "Source persistence" });
    fireEvent.click(within(persistence).getByRole("button", { name: "Save source" }));
    await settleSave(controlled, 1, {
      status: "indeterminate",
      diagnostic: {
        code: "run.desen.editor/PERSISTENCE_COMMIT_INDETERMINATE",
        message: "The editor Source may have committed; reopen it before another save.",
      },
    });

    const confirmDiscard = vi.spyOn(window, "confirm");
    fireEvent.click(screen.getByRole("link", { name: "Projects" }));
    expect(window.location.pathname).toBe(SURFACE_PATH);
    expect(confirmDiscard).not.toHaveBeenCalled();
  });
});
