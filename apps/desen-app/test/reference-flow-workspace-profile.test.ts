import { describe, expect, it } from "vitest";

import {
  admitProjectWorkspaceDocument,
  readProjectWorkspaceProfileAuthority,
} from "../src/project-workspace-profile.js";
import { EMPTY_REFERENCE_PROJECT_DOCUMENT } from "../src/reference-empty-project.js";
import { REFERENCE_FLOW_WORKSPACE_PROFILE } from "../src/reference-flow-workspace-profile.js";
import { REFERENCE_SIGN_IN_WORKSPACE_PROFILE } from "../src/reference-sign-in-workspace-profile.js";

import type { ProjectWorkspaceProfileHandle } from "../src/project-workspace-profile.js";

function profile(handle: ProjectWorkspaceProfileHandle) {
  const read = readProjectWorkspaceProfileAuthority(handle);
  if (read.status !== "read") throw new Error("Expected an authenticated workspace.");
  return read.profile;
}

describe("additive reference flow workspace", () => {
  it("authenticates independent Source, storage, route, and two-surface identities", () => {
    const flow = profile(REFERENCE_FLOW_WORKSPACE_PROFILE);
    expect(flow.profileId).toBe("reference-flow-web");
    expect(flow.project.id).toBe("flow-app");
    expect(flow.project.name).toBe("Flow app");
    expect(flow.documentId).toBe("com.example.flow-app");
    expect(flow.sourceKey).toBe("flow-app-source");
    expect(flow.surfacePath).toBe("/projects/flow-app/surfaces/start");
    expect(flow.sourceSurfaceId).toBe("start");
    expect(flow.initialDocument.entry).toBe("start");
    expect(flow.project.surfaces.map(({ id, sourceId }) => ({ id, sourceId }))).toEqual([
      { id: "start", sourceId: "start" },
      { id: "result", sourceId: "result" },
    ]);
    expect(
      admitProjectWorkspaceDocument(REFERENCE_FLOW_WORKSPACE_PROFILE, flow.initialDocument),
    ).toMatchObject({ status: "admitted" });
  });

  it("starts both surfaces empty with declared portrait frames and no authored behavior", () => {
    const flow = profile(REFERENCE_FLOW_WORKSPACE_PROFILE);
    expect(Object.keys(flow.initialDocument.surfaces).sort()).toEqual(["result", "start"]);
    for (const id of ["start", "result"]) {
      expect(flow.initialDocument.surfaces[id]).toEqual({
        id,
        state: {},
        resources: {},
        root: {
          id: `${id}.layout`,
          use: "com.example.ui/Stack",
          props: { direction: "vertical", gap: "md", maxWidth: 420 },
        },
      });
    }
    expect(flow.initialDocument.authoring).toEqual({
      canvas: {
        start: { x: 0, y: 0, width: 420, height: 720 },
        result: { x: 520, y: 0, width: 420, height: 720 },
      },
    });
    expect(JSON.stringify(flow.initialDocument.surfaces)).not.toMatch(
      /operation\.invoke|sign-in|onSuccess/u,
    );
  });

  it("reuses only the reference composition's admitted Catalog, adapters, and tokens", () => {
    const flow = profile(REFERENCE_FLOW_WORKSPACE_PROFILE);
    const legacy = profile(REFERENCE_SIGN_IN_WORKSPACE_PROFILE);
    expect(flow.catalogs).toEqual(legacy.catalogs);
    expect(flow.catalogPackages).toEqual(legacy.catalogPackages);
    expect(flow.runtime.registry).toBe(legacy.runtime.registry);
    expect(flow.runtime.target).toBe(legacy.runtime.target);
    expect(flow.runtime.tokenCssProperties).toEqual(legacy.runtime.tokenCssProperties);
    expect(flow.publication).toEqual(legacy.publication);
  });

  it("does not grant a live operation merely by selecting the new workspace", async () => {
    const flow = profile(REFERENCE_FLOW_WORKSPACE_PROFILE);
    await expect(
      Promise.resolve(
        flow.runtime.hostPorts.operations.invoke({
          context: {
            documentId: flow.documentId,
            revision: `sha256:${"0".repeat(64)}`,
            surfaceId: "start",
            requestId: "request-1",
          },
          capabilityId: "com.example.auth/signIn",
          invocationAlias: "submittedForm",
          input: { email: "designer@example.invalid", password: "synthetic-password" },
          effect: "network",
        }),
      ),
    ).resolves.toEqual({ status: "denied" });
  });

  it("leaves legacy Account app bytes and its original storage identity unchanged", () => {
    const legacy = profile(REFERENCE_SIGN_IN_WORKSPACE_PROFILE);
    const flow = profile(REFERENCE_FLOW_WORKSPACE_PROFILE);
    expect(legacy.initialDocument).toEqual(EMPTY_REFERENCE_PROJECT_DOCUMENT);
    expect(legacy.documentId).toBe("com.example.account-app");
    expect(legacy.sourceKey).toBe("account-app-source");
    expect(legacy.surfacePath).toBe("/projects/account-app/surfaces/sign-in");
    expect(Object.keys(legacy.initialDocument.surfaces)).toEqual(["sign-in"]);
    expect(
      admitProjectWorkspaceDocument(REFERENCE_FLOW_WORKSPACE_PROFILE, legacy.initialDocument),
    ).toMatchObject({ status: "rejected", reason: "document-mismatch" });
    expect(
      admitProjectWorkspaceDocument(REFERENCE_SIGN_IN_WORKSPACE_PROFILE, flow.initialDocument),
    ).toMatchObject({ status: "rejected", reason: "document-mismatch" });
  });
});
