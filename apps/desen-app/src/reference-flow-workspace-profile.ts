import { createDesenEditorDocument } from "@desen/editor-core";

import {
  createProjectWorkspaceProfile,
  readProjectWorkspaceProfileAuthority,
} from "./project-workspace-profile.js";
import { REFERENCE_SIGN_IN_WORKSPACE_PROFILE } from "./reference-sign-in-workspace-profile.js";

import type { ProjectWorkspaceProfileHandle } from "./project-workspace-profile.js";

const referenceAuthority = readProjectWorkspaceProfileAuthority(
  REFERENCE_SIGN_IN_WORKSPACE_PROFILE,
);
if (referenceAuthority.status !== "read") {
  throw new TypeError("The reference Catalog workspace authority is unavailable.");
}
const reference = referenceAuthority.profile;

const emptyFlowDocument = createDesenEditorDocument({
  ...reference.initialDocument,
  id: "com.example.flow-app",
  entry: "start",
  surfaces: {
    start: {
      id: "start",
      state: {},
      resources: {},
      root: {
        id: "start.layout",
        use: "com.example.ui/Stack",
        props: { direction: "vertical", gap: "md", maxWidth: 420 },
      },
    },
    result: {
      id: "result",
      state: {},
      resources: {},
      root: {
        id: "result.layout",
        use: "com.example.ui/Stack",
        props: { direction: "vertical", gap: "md", maxWidth: 420 },
      },
    },
  },
  authoring: {
    canvas: {
      start: { x: 0, y: 0, width: 420, height: 720 },
      result: { x: 520, y: 0, width: 420, height: 720 },
    },
  },
});
if (!emptyFlowDocument.ok) {
  throw new TypeError("The empty two-surface Flow app Source could not be admitted.");
}

const flowProfile = createProjectWorkspaceProfile({
  profileId: "reference-flow-web",
  project: {
    id: "flow-app",
    name: "Flow app",
    description: "A local two-surface project for authoring connected product flows.",
    surfaces: [
      { id: "start", sourceId: "start", name: "Start", description: "Entry surface" },
      { id: "result", sourceId: "result", name: "Result", description: "Destination surface" },
    ],
  },
  route: { projectId: "flow-app", surfaceId: "start" },
  sourceSurfaceId: "start",
  documentId: "com.example.flow-app",
  sourceKey: "flow-app-source",
  initialDocument: emptyFlowDocument.document,
  catalogs: reference.catalogs,
  catalogPackages: reference.catalogPackages,
  runtime: {
    target: reference.runtime.target,
    registry: reference.runtime.registry,
    tokenCssProperties: reference.runtime.tokenCssProperties,
    hostPorts: reference.runtime.hostPorts,
  },
  publication: reference.publication,
});
if (!flowProfile.ok) {
  throw new TypeError(`The Flow app workspace profile was rejected: ${flowProfile.reason}.`);
}

/**
 * Additive, factory-authenticated blank two-surface workspace for normal local authoring.
 *
 * @remarks This composition reuses the authenticated reference Catalog, adapters, tokens, and
 * inert ports. Its independent Source identity and storage key never migrate or replace the
 * existing Account app. A trusted host must separately authorize any live operation execution.
 */
export const REFERENCE_FLOW_WORKSPACE_PROFILE: ProjectWorkspaceProfileHandle = flowProfile.handle;
