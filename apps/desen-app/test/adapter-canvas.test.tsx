// @vitest-environment jsdom
import { StrictMode, act } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDesenEditorDocument, setDesenEditorOwnerProp } from "@desen/editor-core";
import { createRuntimeHostPorts } from "@desen/runtime-core";

import type * as RuntimeCore from "@desen/runtime-core";
import type { RuntimeHostPorts, RuntimeJsonObject } from "@desen/runtime-core";

const lifecycle = vi.hoisted(() => ({
  mounted: [] as object[],
  disposed: [] as object[],
}));

vi.mock("@desen/runtime-core", async (importOriginal) => {
  const actual = await importOriginal<typeof RuntimeCore>();

  return {
    ...actual,
    mountRuntimeHeadlessSession(
      input: Parameters<typeof actual.mountRuntimeHeadlessSession>[0],
    ): ReturnType<typeof actual.mountRuntimeHeadlessSession> {
      const result = actual.mountRuntimeHeadlessSession(input);
      if (result.status === "mounted") lifecycle.mounted.push(result.handle);
      return result;
    },
    disposeRuntimeHeadlessSession(
      handle: Parameters<typeof actual.disposeRuntimeHeadlessSession>[0],
    ): ReturnType<typeof actual.disposeRuntimeHeadlessSession> {
      lifecycle.disposed.push(handle);
      return actual.disposeRuntimeHeadlessSession(handle);
    },
  };
});

import { DesenAdapterCanvas } from "../src/adapter-canvas.js";
import { prepareCatalogAuthoringModel } from "../src/authoring-data.js";
import {
  prepareReferenceAuthoringPreviewBundle as prepareAuthoringPreviewBundle,
  REFERENCE_AUTHORING_PROFILE,
  REFERENCE_AUTHORING_WORKSPACE_PROFILE,
  REFERENCE_EDITOR_DOCUMENT,
} from "../src/reference-authoring-profile.js";
import { createAuthoringComponentSelection } from "../src/authoring-selection.js";
import { readProjectWorkspaceProfileAuthority } from "../src/project-workspace-profile.js";

import type { DesenAdapterCanvasProps } from "../src/adapter-canvas.js";

const EMPTY_RUNTIME_JSON = Object.freeze({}) satisfies RuntimeJsonObject;

const referenceWorkspaceRead = readProjectWorkspaceProfileAuthority(
  REFERENCE_AUTHORING_WORKSPACE_PROFILE,
);
if (referenceWorkspaceRead.status !== "read") {
  throw new TypeError("Expected the authenticated reference workspace profile.");
}
const REFERENCE_WORKSPACE = referenceWorkspaceRead.profile;
const referencePreview = prepareAuthoringPreviewBundle(REFERENCE_EDITOR_DOCUMENT);
if (!referencePreview.ok) {
  throw new TypeError("Expected the reference authoring preview Bundle.");
}

const REFERENCE_CANVAS_AUTHORITIES = Object.freeze({
  authoringModel: REFERENCE_AUTHORING_PROFILE.model,
  bundle: referencePreview.bundle,
  catalogs: REFERENCE_WORKSPACE.catalogs,
  documentId: REFERENCE_WORKSPACE.documentId,
  hostPorts: REFERENCE_WORKSPACE.runtime.hostPorts,
  projectId: REFERENCE_WORKSPACE.project.id,
  registry: REFERENCE_WORKSPACE.runtime.registry,
  surfaceId: REFERENCE_WORKSPACE.sourceSurfaceId,
  tokenCssProperties: REFERENCE_WORKSPACE.runtime.tokenCssProperties,
}) satisfies DesenAdapterCanvasProps;

function createTestHostPorts(): RuntimeHostPorts {
  return createRuntimeHostPorts({
    navigation: { navigate: () => ({ status: "denied" }) },
    storage: {
      getBundle: () => ({ status: "missing" }),
      putBundle: () => ({ status: "conflict" }),
      readActivation: () => ({ status: "missing" }),
      commitActivation: () => ({ status: "conflict", generation: null }),
    },
    operations: { invoke: () => ({ status: "denied" }) },
    resources: { load: () => ({ status: "denied" }) },
    tokens: { resolve: () => ({ status: "missing" }) },
    context: {
      getSnapshot: () => EMPTY_RUNTIME_JSON,
      subscribe: () => () => undefined,
    },
    environment: {
      getSnapshot: () => EMPTY_RUNTIME_JSON,
      subscribe: () => () => undefined,
    },
    clock: { now: () => 1 },
    diagnostics: { report: () => undefined },
  });
}

function componentSelection(
  sourceNodeId: string,
  capabilityId: string,
  displayName: string,
  conditional = false,
) {
  return createAuthoringComponentSelection({
    projectId: "account-app",
    surfaceId: "sign-in",
    sourceNodeId,
    capabilityId,
    displayName,
    conditional,
  });
}

describe("Desen App exact React adapter canvas", () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    lifecycle.mounted.length = 0;
    lifecycle.disposed.length = 0;
  });

  afterEach(() => {
    cleanup();
    document.body.replaceChildren();
  });

  it("renders the official-derived sign-in only through the shared real adapters", async () => {
    render(<DesenAdapterCanvas {...REFERENCE_CANVAS_AUTHORITIES} />);

    const canvas = await screen.findByRole("group", { name: "Managed sign-in canvas" });
    expect(canvas).toBeInstanceOf(HTMLFieldSetElement);
    expect((canvas as HTMLFieldSetElement).disabled).toBe(true);
    const heading = within(canvas).getByRole("heading", { level: 2, name: "Sign in" });
    expect(heading).toBeTruthy();
    const sourceStack = heading.parentElement as HTMLElement;
    expect(sourceStack.style.maxWidth).toBe("420px");
    expect(sourceStack.style.minWidth).toBe("0px");
    expect(sourceStack.style.width).toBe("100%");

    const email = within(canvas).getByLabelText("Email") as HTMLInputElement;
    const password = within(canvas).getByLabelText("Password") as HTMLInputElement;
    const submit = within(canvas).getByRole("button", { name: "Sign in" });
    expect(email.type).toBe("text");
    expect(password.type).toBe("password");
    expect(email.matches(":disabled")).toBe(true);
    expect(password.matches(":disabled")).toBe(true);
    expect(submit.matches(":disabled")).toBe(true);
    expect(within(canvas).queryByRole("alert")).toBeNull();
    expect(screen.getByText("Design preview · controls are disabled.")).toBeTruthy();
    expect(canvas.getAttribute("data-adapter-canvas-mode")).toBe("design");
    expect(canvas.getAttribute("data-adapter-interactions")).toBe("disabled");
    expect(document.querySelector("canvas")).toBeNull();
    expect(lifecycle.mounted).toHaveLength(1);
  });

  it("runs real adapter events on the same session and preserves state across mode changes", async () => {
    const selection = componentSelection("sign-in.email", "com.example.ui/TextField", "Text field");
    const view = render(
      <DesenAdapterCanvas {...REFERENCE_CANVAS_AUTHORITIES} selection={selection} />,
    );

    const designCanvas = await screen.findByRole("group", { name: "Managed sign-in canvas" });
    const managedSubtree = designCanvas.querySelector("[data-managed-capability-subtree='true']");
    const session = lifecycle.mounted[0];
    expect(session).toBeDefined();
    expect(managedSubtree).toBeTruthy();
    expect((designCanvas as HTMLFieldSetElement).disabled).toBe(true);
    expect(screen.getByRole("status", { name: "Selected layer preview" })).toBeTruthy();

    view.rerender(
      <DesenAdapterCanvas {...REFERENCE_CANVAS_AUTHORITIES} mode="run" selection={selection} />,
    );

    const runCanvas = screen.getByRole("group", { name: "Managed sign-in canvas" });
    expect(runCanvas).toBe(designCanvas);
    expect(runCanvas.querySelector("[data-managed-capability-subtree='true']")).toBe(
      managedSubtree,
    );
    expect((runCanvas as HTMLFieldSetElement).disabled).toBe(false);
    expect(runCanvas.getAttribute("data-adapter-canvas-mode")).toBe("run");
    expect(runCanvas.getAttribute("data-adapter-interactions")).toBe("enabled");
    expect(
      screen.getByText("Run preview · real adapter controls use the selected synthetic fixture."),
    ).toBeTruthy();
    expect(screen.queryByRole("status", { name: "Selected layer preview" })).toBeNull();
    expect(lifecycle.mounted).toEqual([session]);
    expect(lifecycle.disposed).toHaveLength(0);

    const email = within(runCanvas).getByLabelText("Email") as HTMLInputElement;
    await act(async () => {
      fireEvent.change(email, { target: { value: "run-mode@example.test" } });
      await Promise.resolve();
    });
    await waitFor(() => expect(email.value).toBe("run-mode@example.test"));

    view.rerender(
      <DesenAdapterCanvas {...REFERENCE_CANVAS_AUTHORITIES} mode="design" selection={selection} />,
    );

    const restoredDesignCanvas = screen.getByRole("group", {
      name: "Managed sign-in canvas",
    });
    expect(restoredDesignCanvas).toBe(designCanvas);
    expect(restoredDesignCanvas.querySelector("[data-managed-capability-subtree='true']")).toBe(
      managedSubtree,
    );
    expect((restoredDesignCanvas as HTMLFieldSetElement).disabled).toBe(true);
    expect(within(restoredDesignCanvas).getByLabelText("Email")).toHaveProperty(
      "value",
      "run-mode@example.test",
    );
    expect(screen.getByRole("status", { name: "Selected layer preview" })).toBeTruthy();
    expect(lifecycle.mounted).toEqual([session]);
    expect(lifecycle.disposed).toHaveLength(0);
  });

  it("keeps an exact host authority stable and hides its tree synchronously on replacement", async () => {
    const firstHostPorts = createTestHostPorts();
    const secondHostPorts = createTestHostPorts();
    const view = render(
      <DesenAdapterCanvas {...REFERENCE_CANVAS_AUTHORITIES} hostPorts={firstHostPorts} />,
    );

    expect(await screen.findByRole("group", { name: "Managed sign-in canvas" })).toBeTruthy();
    const firstSession = lifecycle.mounted[0];
    expect(firstSession).toBeDefined();
    const firstCanvas = screen.getByRole("group", { name: "Managed sign-in canvas" });

    view.rerender(
      <DesenAdapterCanvas
        {...REFERENCE_CANVAS_AUTHORITIES}
        hostPorts={firstHostPorts}
        mode="run"
      />,
    );
    expect(screen.getByRole("group", { name: "Managed sign-in canvas" })).toBe(firstCanvas);
    expect(lifecycle.mounted).toEqual([firstSession]);
    expect(lifecycle.disposed).toHaveLength(0);

    view.rerender(
      <DesenAdapterCanvas
        {...REFERENCE_CANVAS_AUTHORITIES}
        hostPorts={secondHostPorts}
        mode="run"
      />,
    );

    const secondCanvas = screen.getByRole("group", { name: "Managed sign-in canvas" });
    expect(secondCanvas).not.toBe(firstCanvas);
    expect(firstCanvas.isConnected).toBe(false);
    await waitFor(() => {
      expect(lifecycle.mounted).toHaveLength(2);
      expect(lifecycle.disposed).toEqual([firstSession]);
    });
    expect(screen.getByRole("group", { name: "Managed sign-in canvas" })).toBe(secondCanvas);
  });

  it("renders a different project, document, and surface tuple from explicit authorities", async () => {
    const admitted = createDesenEditorDocument({
      kind: "desen.source",
      desen: "0.1.0",
      id: "com.example.feedback-studio",
      catalogs: [
        {
          id: "run.desen.reference.sign-in",
          version: "0.1.0",
          target: "web-react",
        },
      ],
      entry: "feedback",
      surfaces: {
        feedback: {
          id: "feedback",
          state: {},
          resources: {},
          root: {
            id: "feedback.layout",
            use: "com.example.ui/Stack",
            props: { direction: "vertical", gap: "md", maxWidth: 480 },
            slots: {
              default: [
                {
                  id: "feedback.title",
                  use: "com.example.ui/Text",
                  props: { text: "Share feedback", role: "heading" },
                },
              ],
            },
          },
        },
      },
      authoring: {
        canvas: { feedback: { x: 0, y: 0, width: 480, height: 720 } },
      },
      extensions: {},
    });
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) throw new Error("Expected the alternate Source to be admitted.");

    const authoring = prepareCatalogAuthoringModel(
      REFERENCE_AUTHORING_PROFILE.catalogs,
      admitted.document,
    );
    expect(authoring.ok).toBe(true);
    if (!authoring.ok) throw new Error("Expected the alternate authoring model.");
    const preview = prepareAuthoringPreviewBundle(admitted.document);
    expect(preview.ok).toBe(true);
    if (!preview.ok) throw new Error("Expected the alternate preview Bundle.");

    render(
      <DesenAdapterCanvas
        {...REFERENCE_CANVAS_AUTHORITIES}
        authoringModel={authoring.model}
        bundle={preview.bundle}
        documentId="com.example.feedback-studio"
        projectId="feedback-studio"
        surfaceId="feedback"
      />,
    );

    const canvas = await screen.findByRole("group", { name: "Managed feedback canvas" });
    expect(within(canvas).getByRole("heading", { name: "Share feedback" })).toBeTruthy();
    expect(within(canvas).queryByRole("heading", { name: "Sign in" })).toBeNull();
    expect(lifecycle.mounted).toHaveLength(1);
  });

  it("removes a previous tree synchronously and disposes the exact route session", async () => {
    const view = render(<DesenAdapterCanvas {...REFERENCE_CANVAS_AUTHORITIES} />);
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeTruthy();
    const firstSession = lifecycle.mounted[0];
    expect(firstSession).toBeDefined();

    view.rerender(<DesenAdapterCanvas {...REFERENCE_CANVAS_AUTHORITIES} surfaceId="profile" />);

    expect(screen.queryByRole("heading", { name: "Sign in" })).toBeNull();
    expect(screen.queryByLabelText("Email")).toBeNull();
    await waitFor(() => {
      expect(lifecycle.mounted).toHaveLength(2);
      expect(lifecycle.disposed).toEqual(lifecycle.mounted);
    });
  });

  it("replaces the exact session when a current authoring draft Bundle is rerendered", async () => {
    const baselinePreview = prepareAuthoringPreviewBundle(REFERENCE_EDITOR_DOCUMENT);
    expect(baselinePreview.ok).toBe(true);
    if (!baselinePreview.ok) throw new Error("Expected the reference preview Bundle.");

    const selection = componentSelection("sign-in.title", "com.example.ui/Text", "Text");
    const view = render(
      <DesenAdapterCanvas
        {...REFERENCE_CANVAS_AUTHORITIES}
        bundle={baselinePreview.bundle}
        selection={selection}
      />,
    );

    expect(await screen.findByRole("heading", { level: 2, name: "Sign in" })).toBeTruthy();
    const firstSession = lifecycle.mounted[0];
    expect(firstSession).toBeDefined();

    const edited = setDesenEditorOwnerProp(REFERENCE_EDITOR_DOCUMENT, {
      surfaceId: "sign-in",
      ownerId: "sign-in.title",
      name: "text",
      value: "Welcome back",
    });
    expect(edited.ok).toBe(true);
    if (!edited.ok) throw new Error("Expected a valid title prop mutation.");

    const currentAuthoring = prepareCatalogAuthoringModel(
      REFERENCE_AUTHORING_PROFILE.catalogs,
      edited.document,
    );
    expect(currentAuthoring.ok).toBe(true);
    if (!currentAuthoring.ok) throw new Error("Expected the current authoring model.");

    const currentPreview = prepareAuthoringPreviewBundle(edited.document);
    expect(currentPreview.ok).toBe(true);
    if (!currentPreview.ok) throw new Error("Expected the current preview Bundle.");

    view.rerender(
      <DesenAdapterCanvas
        {...REFERENCE_CANVAS_AUTHORITIES}
        authoringModel={currentAuthoring.model}
        bundle={currentPreview.bundle}
        selection={selection}
      />,
    );

    expect(screen.queryByRole("heading", { name: "Sign in" })).toBeNull();
    const canvas = await screen.findByRole("group", { name: "Managed sign-in canvas" });
    expect(within(canvas).getByRole("heading", { level: 2, name: "Welcome back" })).toBeTruthy();
    await waitFor(() => {
      expect(lifecycle.mounted).toHaveLength(2);
      expect(lifecycle.disposed).toEqual([firstSession]);
    });

    const overlay = screen.getByRole("status", { name: "Selected layer preview" });
    const managedSubtree = canvas.querySelector("[data-managed-capability-subtree='true']");
    expect(overlay.textContent).toContain("Text");
    expect(overlay.textContent).toContain("sign-in.title");
    expect(overlay.textContent).toContain("Visible in preview");
    expect(canvas.parentElement).toBe(overlay.parentElement);
    expect(canvas.contains(overlay)).toBe(false);
    expect(overlay.contains(canvas)).toBe(false);
    expect(managedSubtree).toBeTruthy();
    expect(managedSubtree?.contains(overlay)).toBe(false);
    expect((canvas as HTMLFieldSetElement).disabled).toBe(true);
  });

  it("balances StrictMode replay and final unmount with exact session disposal", async () => {
    const view = render(
      <StrictMode>
        <DesenAdapterCanvas {...REFERENCE_CANVAS_AUTHORITIES} />
      </StrictMode>,
    );

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeTruthy();
    await waitFor(() => {
      expect(lifecycle.mounted).toHaveLength(2);
      expect(lifecycle.disposed).toEqual([lifecycle.mounted[0]]);
    });

    view.unmount();
    expect(lifecycle.disposed).toEqual([lifecycle.mounted[0], lifecycle.mounted[1]]);
  });

  it("renders Source-identity selection chrome as a sibling outside the managed subtree", async () => {
    render(
      <DesenAdapterCanvas
        {...REFERENCE_CANVAS_AUTHORITIES}
        selection={componentSelection("sign-in.email", "com.example.ui/TextField", "Text field")}
      />,
    );

    const canvas = await screen.findByRole("group", { name: "Managed sign-in canvas" });
    const overlay = await screen.findByRole("status", { name: "Selected layer preview" });
    const managedSubtree = document.querySelector("[data-managed-capability-subtree='true']");

    expect(overlay.textContent).toContain("Text field");
    expect(overlay.textContent).toContain("sign-in.email");
    expect(overlay.textContent).toContain("Visible in preview");
    expect(canvas.parentElement).toBe(overlay.parentElement);
    expect(canvas.contains(overlay)).toBe(false);
    expect(overlay.contains(canvas)).toBe(false);
    expect(managedSubtree).toBeTruthy();
    expect(managedSubtree?.contains(overlay)).toBe(false);
    expect((canvas as HTMLFieldSetElement).disabled).toBe(true);
  });

  it("keeps a selected conditional Source node honest when it is not materialized", async () => {
    render(
      <DesenAdapterCanvas
        {...REFERENCE_CANVAS_AUTHORITIES}
        selection={componentSelection("sign-in.error", "com.example.ui/Alert", "Alert", true)}
      />,
    );

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeTruthy();
    const overlay = screen.getByRole("status", { name: "Selected layer preview" });
    expect(overlay.getAttribute("data-materialized")).toBe("false");
    expect(overlay.textContent).toContain("Hidden by condition");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("rejects stale and cross-route selection identities without exposing overlay chrome", async () => {
    const stale = createAuthoringComponentSelection({
      projectId: "other-project",
      surfaceId: "sign-in",
      sourceNodeId: "sign-in.email",
      capabilityId: "com.example.ui/TextField",
      displayName: "Text field",
      conditional: false,
    });
    const view = render(<DesenAdapterCanvas {...REFERENCE_CANVAS_AUTHORITIES} selection={stale} />);

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeTruthy();
    expect(screen.queryByRole("status", { name: "Selected layer preview" })).toBeNull();

    const forged = createAuthoringComponentSelection({
      projectId: "account-app",
      surfaceId: "sign-in",
      sourceNodeId: "sign-in.forged",
      capabilityId: "com.example.ui/Alert",
      displayName: "Forged",
      conditional: true,
    });
    view.rerender(<DesenAdapterCanvas {...REFERENCE_CANVAS_AUTHORITIES} selection={forged} />);
    expect(screen.queryByRole("status", { name: "Selected layer preview" })).toBeNull();
  });
});
