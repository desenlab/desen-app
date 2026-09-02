// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDesenEditorDocument } from "@desen/editor-core";
import { createRuntimeHostPorts } from "@desen/runtime-core";

import { createAuthoringFixtureHostPorts, DesenAppApplication } from "../src/application.js";
import {
  createProjectWorkspaceProfile,
  readProjectWorkspaceProfileAuthority,
} from "../src/project-workspace-profile.js";
import { REFERENCE_SIGN_IN_WORKSPACE_PROFILE } from "../src/reference-sign-in-workspace-profile.js";

import type { RuntimeHostPorts } from "@desen/runtime-core";

const GENERIC_COMPOSITION_MODULES = Object.freeze([
  "adapter-canvas.tsx",
  "application.tsx",
  "authoring-behavior-projection.ts",
  "authoring-conditions.ts",
  "authoring-connections.ts",
  "authoring-data.ts",
  "authoring-event-actions.ts",
  "authoring-fixtures.ts",
  "authoring-persistence.ts",
  "authoring-preview.ts",
  "authoring-publication.ts",
  "authoring-scenarios.ts",
  "behavior-controls.tsx",
  "preview-fidelity.ts",
  "product-bootstrap.tsx",
  "project-data.ts",
  "project-workspace-profile.ts",
]);

const FORBIDDEN_REFERENCE_DEFAULTS = Object.freeze([
  "account-app",
  "sign-in",
  "signIn",
  "invalidCredentials",
  "referenceCatalog",
  "examples/sign-in",
  "@desen/reference-catalog-web",
  "exact web-react catalog",
  "420 × 720",
]);
const SUPPORT_CATALOG_DIGEST = `sha256:${"7".repeat(64)}`;
const supportCatalog = Object.freeze({
  kind: "desen.catalog",
  desen: "0.1.0",
  id: "run.desen.example.feedback-support",
  version: "0.1.0",
  target: "web-react",
  packageDigest: SUPPORT_CATALOG_DIGEST,
  components: Object.freeze({}),
  behaviors: Object.freeze({}),
  operations: Object.freeze({}),
  resources: Object.freeze({}),
  authoring: Object.freeze({}),
  extensions: Object.freeze({}),
});

function createFeedbackWorkspaceProfile(hostPorts?: RuntimeHostPorts) {
  const reference = readProjectWorkspaceProfileAuthority(REFERENCE_SIGN_IN_WORKSPACE_PROFILE);
  if (reference.status !== "read") throw new TypeError("Expected reference runtime authorities.");
  const admitted = createDesenEditorDocument({
    kind: "desen.source",
    desen: "0.1.0",
    id: "com.example.feedback-studio",
    catalogs: [
      ...reference.profile.initialDocument.catalogs,
      {
        id: supportCatalog.id,
        version: supportCatalog.version,
        target: supportCatalog.target,
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
      "thank-you": {
        id: "thank-you",
        state: {},
        resources: {},
        root: {
          id: "thank-you.layout",
          use: "com.example.ui/Stack",
          props: { direction: "vertical", gap: "md", maxWidth: 480 },
          slots: {
            default: [
              {
                id: "thank-you.title",
                use: "com.example.ui/Text",
                props: { text: "Thank you", role: "heading" },
              },
            ],
          },
        },
      },
    },
    authoring: {
      canvas: {
        feedback: { x: 0, y: 0, width: 480, height: 720 },
        "thank-you": { x: 0, y: 0, width: 480, height: 720 },
      },
    },
    extensions: {},
  });
  if (!admitted.ok) throw new TypeError("Expected the feedback Source to be admitted.");

  return createProjectWorkspaceProfile({
    profileId: "feedback-studio-web",
    project: {
      id: "feedback-studio",
      name: "Feedback studio",
      description: "A non-authentication product composition.",
      surfaces: [
        {
          id: "collect-feedback",
          sourceId: "feedback",
          name: "Collect feedback",
          description: "A public feedback surface.",
        },
        {
          id: "thanks",
          sourceId: "thank-you",
          name: "Thank you",
          description: "A submission confirmation surface.",
        },
      ],
    },
    route: { projectId: "feedback-studio", surfaceId: "collect-feedback" },
    sourceSurfaceId: "feedback",
    documentId: admitted.document.id,
    sourceKey: "feedback-studio-source",
    initialDocument: admitted.document,
    catalogs: [...reference.profile.catalogs, supportCatalog],
    catalogPackages: [
      ...reference.profile.catalogPackages,
      {
        id: supportCatalog.id,
        version: supportCatalog.version,
        target: supportCatalog.target,
        observedPackageDigest: supportCatalog.packageDigest,
        catalog: supportCatalog,
      },
    ],
    runtime: {
      target: reference.profile.runtime.target,
      registry: reference.profile.runtime.registry,
      tokenCssProperties: reference.profile.runtime.tokenCssProperties,
      hostPorts: hostPorts ?? reference.profile.runtime.hostPorts,
    },
    publication: null,
  });
}

describe("M10-T01C evergreen product composition", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/projects");
  });

  afterEach(() => {
    cleanup();
    document.body.replaceChildren();
  });

  it("keeps generic editor modules free of the reference sign-in composition", () => {
    for (const moduleName of GENERIC_COMPOSITION_MODULES) {
      const source = readFileSync(resolve(process.cwd(), "src", moduleName), "utf8");
      for (const forbidden of FORBIDDEN_REFERENCE_DEFAULTS) {
        expect(source, `${moduleName} must not contain ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  it("renders a non-auth multi-surface, multi-Catalog project with distinct route slugs", async () => {
    const created = createFeedbackWorkspaceProfile();
    expect(created.ok).toBe(true);
    if (!created.ok) throw new TypeError(`Feedback profile rejected: ${created.reason}.`);
    window.history.replaceState(null, "", created.snapshot.surfacePath);

    const firstSurface = render(<DesenAppApplication workspaceProfile={created.handle} />);

    expect(screen.getByRole("heading", { level: 2, name: "Collect feedback" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Feedback studio" }).getAttribute("href")).toBe(
      "/projects/feedback-studio",
    );
    const canvas = await screen.findByRole("group", { name: "Managed feedback canvas" });
    expect(within(canvas).getByRole("heading", { name: "Share feedback" })).toBeTruthy();
    expect(within(canvas).queryByRole("heading", { name: "Sign in" })).toBeNull();
    expect(screen.getByRole("region", { name: "Collect feedback layer hierarchy" })).toBeTruthy();
    expect(screen.getByText("2 Catalogs")).toBeTruthy();
    expect(screen.getByText("2 packages")).toBeTruthy();
    expect(document.title).toBe("Collect feedback · Feedback studio · DESEN");

    firstSurface.unmount();
    window.history.replaceState(null, "", "/projects/feedback-studio/surfaces/thanks");
    render(<DesenAppApplication workspaceProfile={created.handle} />);

    const secondCanvas = await screen.findByRole("group", { name: "Managed thank-you canvas" });
    expect(within(secondCanvas).getByRole("heading", { name: "Thank you" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Thank you layer hierarchy" })).toBeTruthy();
    expect(document.title).toBe("Thank you · Feedback studio · DESEN");
  });

  it("blocks every profile host callback inside synthetic authoring preview", async () => {
    const navigate = vi.fn(() => Object.freeze({ status: "succeeded" as const }));
    const getBundle = vi.fn(() => Object.freeze({ status: "missing" as const }));
    const putBundle = vi.fn(() => Object.freeze({ status: "stored" as const }));
    const readActivation = vi.fn(() => Object.freeze({ status: "missing" as const }));
    const commitActivation = vi.fn(() =>
      Object.freeze({ status: "conflict" as const, generation: 8 }),
    );
    const invokeProductOperation = vi.fn(() =>
      Object.freeze({ status: "succeeded" as const, value: Object.freeze({}) }),
    );
    const load = vi.fn(() =>
      Object.freeze({ status: "succeeded" as const, value: Object.freeze({}) }),
    );
    const resolveToken = vi.fn(() => Object.freeze({ status: "missing" as const }));
    const contextGetSnapshot = vi.fn(() => Object.freeze({ productContext: true }));
    const contextSubscribe = vi.fn(() => () => undefined);
    const environmentGetSnapshot = vi.fn(() => Object.freeze({ productEnvironment: true }));
    const environmentSubscribe = vi.fn(() => () => undefined);
    const now = vi.fn(() => 99);
    const report = vi.fn(() => undefined);
    const base = createRuntimeHostPorts({
      navigation: { navigate },
      storage: { getBundle, putBundle, readActivation, commitActivation },
      operations: { invoke: invokeProductOperation },
      resources: { load },
      tokens: { resolve: resolveToken },
      context: { getSnapshot: contextGetSnapshot, subscribe: contextSubscribe },
      environment: {
        getSnapshot: environmentGetSnapshot,
        subscribe: environmentSubscribe,
      },
      clock: { now },
      diagnostics: { report },
    });
    const invokeFixtureOperation = vi.fn(() => Object.freeze({ status: "denied" as const }));
    const preview = createAuthoringFixtureHostPorts(base, {
      invoke: invokeFixtureOperation,
    });

    expect(
      preview.navigation.navigate({
        context: {} as never,
        targetSurfaceId: "another-surface",
        params: Object.freeze({}),
      }),
    ).toEqual({ status: "denied" });
    await expect(
      Promise.resolve(
        preview.resources.load({
          context: {} as never,
          instanceId: "profile",
          capabilityId: "run.example/Profile",
          input: Object.freeze({}),
        }),
      ),
    ).resolves.toEqual({ status: "denied" });
    await expect(
      Promise.resolve(preview.storage.getBundle(`sha256:${"0".repeat(64)}`)),
    ).resolves.toEqual({ status: "missing" });
    expect(navigate).not.toHaveBeenCalled();
    expect(load).not.toHaveBeenCalled();
    expect(getBundle).not.toHaveBeenCalled();
    expect(putBundle).not.toHaveBeenCalled();
    expect(readActivation).not.toHaveBeenCalled();
    expect(commitActivation).not.toHaveBeenCalled();
    expect(invokeProductOperation).not.toHaveBeenCalled();

    expect(preview.tokens.resolve({ context: {} as never, token: "color.action.primary" })).toEqual(
      { status: "missing" },
    );
    expect(preview.context.getSnapshot()).toEqual({});
    expect(preview.environment.getSnapshot()).toEqual({});
    expect(preview.clock.now()).toBe(1);
    preview.diagnostics.report({} as never);
    await Promise.resolve(
      preview.operations.invoke({
        context: {} as never,
        capabilityId: "run.example/submit",
        invocationAlias: "submit",
        input: Object.freeze({}),
        effect: "network",
      }),
    );
    expect(invokeFixtureOperation).toHaveBeenCalledTimes(1);

    const created = createFeedbackWorkspaceProfile(base);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    window.history.replaceState(null, "", created.snapshot.surfacePath);
    render(<DesenAppApplication workspaceProfile={created.handle} />);
    expect(await screen.findByRole("group", { name: "Managed feedback canvas" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    expect(await screen.findByRole("complementary", { name: "Run controls" })).toBeTruthy();

    for (const callback of [
      navigate,
      getBundle,
      putBundle,
      readActivation,
      commitActivation,
      invokeProductOperation,
      load,
      resolveToken,
      contextGetSnapshot,
      contextSubscribe,
      environmentGetSnapshot,
      environmentSubscribe,
      now,
      report,
    ]) {
      expect(callback).not.toHaveBeenCalled();
    }
  });
});
