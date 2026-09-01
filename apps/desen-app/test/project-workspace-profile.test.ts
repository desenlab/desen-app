import { describe, expect, it } from "vitest";

import referenceCatalog from "@desen/reference-catalog-web/catalog.json";
import { createDesenEditorDocument } from "@desen/editor-core";

import {
  admitProjectWorkspaceDocument,
  createProjectWorkspaceProfile,
  readProjectWorkspaceProfileAuthority,
} from "../src/project-workspace-profile.js";
import { REFERENCE_SIGN_IN_WORKSPACE_PROFILE } from "../src/reference-sign-in-workspace-profile.js";

import type { PublishCatalogPackageCandidate } from "@desen/publisher";
import type {
  ProjectWorkspaceProfileHandle,
  ProjectWorkspaceProfileInput,
} from "../src/project-workspace-profile.js";

const FORMS_PACKAGE_DIGEST = `sha256:${"1".repeat(64)}`;

const formsCatalog = Object.freeze({
  kind: "desen.catalog",
  desen: "0.1.0",
  id: "run.desen.example.forms",
  version: "0.1.0",
  target: "web-react",
  packageDigest: FORMS_PACKAGE_DIGEST,
  components: Object.freeze({}),
  behaviors: Object.freeze({}),
  operations: Object.freeze({
    "com.example.forms/submit": Object.freeze({
      description: "Submit one designer-authored form.",
      inputSchema: Object.freeze({
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: "object",
        additionalProperties: false,
        properties: Object.freeze({ message: Object.freeze({ type: "string" }) }),
        required: Object.freeze(["message"]),
      }),
      outputSchema: Object.freeze({
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: "object",
        additionalProperties: false,
        properties: Object.freeze({ accepted: Object.freeze({ type: "boolean" }) }),
        required: Object.freeze(["accepted"]),
      }),
      errors: Object.freeze([
        Object.freeze({ code: "unavailable", description: "The form service is unavailable." }),
      ]),
      effect: "network",
      authoring: Object.freeze({
        fixtures: Object.freeze({
          success: Object.freeze({ accepted: true }),
          errors: Object.freeze({ unavailable: Object.freeze({}) }),
        }),
      }),
    }),
  }),
  resources: Object.freeze({}),
  authoring: Object.freeze({}),
  extensions: Object.freeze({}),
});

function referenceAuthority() {
  const read = readProjectWorkspaceProfileAuthority(REFERENCE_SIGN_IN_WORKSPACE_PROFILE);
  if (read.status !== "read") throw new TypeError("Expected the reference workspace profile.");
  return read.profile;
}

function nonAuthDocument() {
  const admitted = createDesenEditorDocument({
    kind: "desen.source",
    desen: "0.1.0",
    id: "com.example.feedback-project",
    catalogs: [
      {
        id: referenceCatalog.id,
        version: referenceCatalog.version,
        target: referenceCatalog.target,
      },
      {
        id: formsCatalog.id,
        version: formsCatalog.version,
        target: formsCatalog.target,
      },
    ],
    entry: "contact-form",
    surfaces: {
      "contact-form": {
        id: "contact-form",
        state: {},
        resources: {},
        root: {
          id: "contact.layout",
          use: "com.example.ui/Stack",
          props: { direction: "vertical", gap: "md", maxWidth: 640 },
        },
      },
      "thank-you": {
        id: "thank-you",
        state: {},
        resources: {},
        root: {
          id: "thank-you.layout",
          use: "com.example.ui/Stack",
          props: { direction: "vertical", gap: "md", maxWidth: 640 },
        },
      },
    },
    authoring: {
      canvas: {
        "contact-form": { x: 0, y: 0, width: 1024, height: 768 },
        "thank-you": { x: 0, y: 0, width: 1024, height: 768 },
      },
    },
    extensions: {},
  });
  if (!admitted.ok) throw new TypeError("Expected the non-auth Source to be admitted.");
  return admitted.document;
}

function nonAuthInput(): ProjectWorkspaceProfileInput {
  const reference = referenceAuthority();
  const catalogPackages: readonly PublishCatalogPackageCandidate[] = [
    {
      id: referenceCatalog.id,
      version: referenceCatalog.version,
      target: referenceCatalog.target,
      observedPackageDigest: referenceCatalog.packageDigest,
      catalog: referenceCatalog,
    },
    {
      id: formsCatalog.id,
      version: formsCatalog.version,
      target: formsCatalog.target,
      observedPackageDigest: formsCatalog.packageDigest,
      catalog: formsCatalog,
    },
  ];
  return {
    profileId: "feedback-project-web",
    project: {
      id: "feedback-project",
      name: "Feedback project",
      description: "An auth-independent multi-surface project.",
      surfaces: [
        {
          id: "contact",
          sourceId: "contact-form",
          name: "Contact",
          description: "Collect feedback",
        },
        {
          id: "thanks",
          sourceId: "thank-you",
          name: "Thank you",
          description: "Confirm submission",
        },
      ],
    },
    route: { projectId: "feedback-project", surfaceId: "contact" },
    sourceSurfaceId: "contact-form",
    documentId: "com.example.feedback-project",
    sourceKey: "feedback-project-source",
    initialDocument: nonAuthDocument(),
    catalogs: [referenceCatalog, formsCatalog],
    catalogPackages,
    runtime: {
      target: "web-react",
      registry: reference.runtime.registry,
      tokenCssProperties: reference.runtime.tokenCssProperties,
      hostPorts: reference.runtime.hostPorts,
    },
    publication: { channelName: "feedback-preview", hostId: "feedback-web-host" },
  };
}

describe("project workspace profile", () => {
  it("keeps sign-in as one explicit authenticated reference composition", () => {
    const read = readProjectWorkspaceProfileAuthority(REFERENCE_SIGN_IN_WORKSPACE_PROFILE);

    expect(read.status).toBe("read");
    if (read.status !== "read") return;
    expect(read.profile).toMatchObject({
      profileId: "reference-sign-in-web",
      route: { projectId: "account-app", surfaceId: "sign-in" },
      surfacePath: "/projects/account-app/surfaces/sign-in",
      sourceSurfaceId: "sign-in",
      documentId: "com.example.account-app",
      sourceKey: "account-app-source",
      publication: { channelName: "preview", hostId: "reference-host-web" },
    });
    expect(read.profile.catalogs).toHaveLength(1);
    expect(read.profile.catalogPackages).toHaveLength(1);
    expect(read.profile.runtime.registrySnapshot.componentCapabilityIds).toEqual([
      "com.example.ui/Alert",
      "com.example.ui/Button",
      "com.example.ui/Stack",
      "com.example.ui/Text",
      "com.example.ui/TextField",
    ]);
    expect(
      read.profile.runtime.hostPorts.tokens.resolve({
        context: {
          documentId: read.profile.documentId,
          revision: `sha256:${"0".repeat(64)}`,
          surfaceId: read.profile.sourceSurfaceId,
          requestId: "profile-test",
        },
        token: "color.action.primary",
      }),
    ).toMatchObject({ status: "resolved" });
    expect(Object.isFrozen(read.profile)).toBe(true);
    expect(Object.isFrozen(read.profile.project.surfaces)).toBe(true);
  });

  it("admits an auth-independent multi-Catalog, multi-surface composition", () => {
    const created = createProjectWorkspaceProfile(nonAuthInput());

    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const read = readProjectWorkspaceProfileAuthority(created.handle);
    expect(read).toEqual({ status: "read", profile: created.snapshot });
    if (read.status !== "read") return;
    expect(read.profile.project.surfaces).toEqual([
      {
        id: "contact",
        sourceId: "contact-form",
        name: "Contact",
        description: "Collect feedback",
      },
      {
        id: "thanks",
        sourceId: "thank-you",
        name: "Thank you",
        description: "Confirm submission",
      },
    ]);
    expect(read.profile.surfacePath).toBe("/projects/feedback-project/surfaces/contact");
    expect(read.profile.catalogs).toHaveLength(2);
    expect(read.profile.catalogPackages.map(({ id }) => id)).toEqual([
      "run.desen.reference.sign-in",
      "run.desen.example.forms",
    ]);
  });

  it("keeps the authored entry independent from a deep-linked route surface", () => {
    const input = nonAuthInput();
    const created = createProjectWorkspaceProfile({
      ...input,
      route: { projectId: "feedback-project", surfaceId: "thanks" },
      sourceSurfaceId: "thank-you",
    });

    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.snapshot.surfacePath).toBe("/projects/feedback-project/surfaces/thanks");
    expect(created.snapshot.sourceSurfaceId).toBe("thank-you");
    expect(created.snapshot.initialDocument.entry).toBe("contact-form");
  });

  it("re-admits current Sources only when every profile-owned identity remains exact", () => {
    const created = createProjectWorkspaceProfile(nonAuthInput());
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(admitProjectWorkspaceDocument(created.handle, nonAuthDocument())).toMatchObject({
      status: "admitted",
    });
    expect(
      admitProjectWorkspaceDocument(
        Object.freeze({}) as ProjectWorkspaceProfileHandle,
        nonAuthDocument(),
      ),
    ).toEqual({ status: "rejected", reason: "profile-invalid" });

    const document = nonAuthDocument();
    expect(
      admitProjectWorkspaceDocument(created.handle, { ...document, entry: "thank-you" }),
    ).toEqual({ status: "rejected", reason: "document-mismatch" });
    expect(
      admitProjectWorkspaceDocument(created.handle, {
        ...document,
        surfaces: {
          ...document.surfaces,
          hidden: {
            id: "hidden",
            state: {},
            resources: {},
            root: {
              id: "hidden.layout",
              use: "com.example.ui/Stack",
              props: { direction: "vertical", gap: "md", maxWidth: 640 },
            },
          },
        },
      }),
    ).toEqual({ status: "rejected", reason: "document-mismatch" });
    expect(
      admitProjectWorkspaceDocument(created.handle, {
        ...document,
        catalogs: document.catalogs.slice(0, 1),
      }),
    ).toEqual({ status: "rejected", reason: "catalog-document-mismatch" });
  });

  it("matches the complete Catalog set by exact identity rather than caller array position", () => {
    const input = nonAuthInput();
    const created = createProjectWorkspaceProfile({
      ...input,
      catalogs: [...input.catalogs].reverse(),
    });

    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.snapshot.catalogs.map(({ id }) => id)).toEqual([
      "run.desen.example.forms",
      "run.desen.reference.sign-in",
    ]);
  });

  it("detaches mutable metadata, package inventory and token CSS from caller ownership", () => {
    const input = nonAuthInput();
    const mutableSurface = input.project.surfaces[0] as {
      name: string;
      description: string;
    };
    const mutableCss = { "--workspace-accent": "blue" };
    const mutableInput = {
      ...input,
      project: {
        ...input.project,
        surfaces: input.project.surfaces.map((surface) => ({ ...surface })),
      },
      catalogs: [...input.catalogs],
      catalogPackages: input.catalogPackages.map((candidate) => ({ ...candidate })),
      runtime: { ...input.runtime, tokenCssProperties: mutableCss },
    } satisfies ProjectWorkspaceProfileInput;
    const created = createProjectWorkspaceProfile(mutableInput);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const firstMutableSurface = mutableInput.project.surfaces[0];
    if (firstMutableSurface === undefined) throw new TypeError("Expected a mutable surface.");
    mutableSurface.name = "Changed outside";
    mutableSurface.description = "Changed outside";
    firstMutableSurface.name = "Changed after creation";
    mutableCss["--workspace-accent"] = "red";
    mutableInput.catalogs.pop();
    mutableInput.catalogPackages.pop();

    const read = readProjectWorkspaceProfileAuthority(created.handle);
    expect(read.status).toBe("read");
    if (read.status !== "read") return;
    expect(read.profile.project.surfaces[0]?.name).toBe("Contact");
    expect(read.profile.runtime.tokenCssProperties["--workspace-accent"]).toBe("blue");
    expect(read.profile.catalogs).toHaveLength(2);
    expect(read.profile.catalogPackages).toHaveLength(2);
  });

  it("rejects an accessor-backed profile without invoking the accessor", () => {
    const input = nonAuthInput() as unknown as Record<string, unknown>;
    let reads = 0;
    Object.defineProperty(input, "profileId", {
      enumerable: true,
      get() {
        reads += 1;
        return "feedback-project-web";
      },
    });

    expect(createProjectWorkspaceProfile(input as unknown as ProjectWorkspaceProfileInput)).toEqual(
      { ok: false, reason: "input-invalid" },
    );
    expect(reads).toBe(0);
  });

  it("rejects route-to-Source identity drift", () => {
    const input = nonAuthInput();

    expect(createProjectWorkspaceProfile({ ...input, sourceSurfaceId: "thank-you" })).toEqual({
      ok: false,
      reason: "route-invalid",
    });
  });

  it("rejects incomplete package candidates before granting Publisher authority", () => {
    const input = nonAuthInput();

    expect(
      createProjectWorkspaceProfile({
        ...input,
        catalogPackages: input.catalogPackages.slice(0, 1),
      }),
    ).toEqual({ ok: false, reason: "catalog-package-invalid" });
  });

  it("rejects a forged adapter-registry authority", () => {
    const input = nonAuthInput();

    expect(
      createProjectWorkspaceProfile({
        ...input,
        runtime: {
          ...input.runtime,
          registry: Object.freeze({}) as ProjectWorkspaceProfileInput["runtime"]["registry"],
        },
      }),
    ).toEqual({ ok: false, reason: "runtime-invalid" });
  });

  it("does not accept a structurally forged workspace handle", () => {
    expect(
      readProjectWorkspaceProfileAuthority(Object.freeze({}) as ProjectWorkspaceProfileHandle),
    ).toEqual({ status: "invalid-handle" });
  });
});
