import starterCatalog from "@desen/starter-catalog-web/catalog.json";
import { STARTER_WEB_REACT_ADAPTER_REGISTRY_INPUT } from "@desen/starter-catalog-web/react-adapters";
import { createRuntimeHostPorts } from "@desen/runtime-core";
import { createRuntimeReactAdapterRegistry } from "@desen/runtime-react";

import { createProjectWorkspaceProfile } from "./project-workspace-profile.js";
import { createStarterProject } from "./starter-project.js";

import type { RuntimeJsonObject } from "@desen/runtime-core";
import type { ProjectWorkspaceProfileHandle } from "./project-workspace-profile.js";

const EMPTY_RUNTIME_JSON = Object.freeze({}) satisfies RuntimeJsonObject;
const STARTER_ENVIRONMENT = Object.freeze({
  platform: "web",
  viewport: Object.freeze({ height: 900, orientation: "landscape", width: 1440 }),
}) satisfies RuntimeJsonObject;

const starterRegistry = createRuntimeReactAdapterRegistry(STARTER_WEB_REACT_ADAPTER_REGISTRY_INPUT);
if (starterRegistry.status !== "created") {
  throw new TypeError("The DESEN Neutral Web React adapter registry could not be created.");
}

const starterHostPorts = createRuntimeHostPorts({
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
    getSnapshot: () => STARTER_ENVIRONMENT,
    subscribe: () => () => undefined,
  },
  clock: { now: () => 1 },
  diagnostics: { report: () => undefined },
});

const starterProject = createStarterProject("desen-neutral");
const starterProfile = createProjectWorkspaceProfile({
  profileId: "desen-neutral-web",
  project: {
    id: "desen-neutral",
    name: "DESEN Neutral",
    description:
      "A local starter workspace for composing and styling reviewed DESEN Neutral capabilities.",
    surfaces: [
      {
        id: "home",
        sourceId: "home",
        name: "Home",
        description: "Responsive starter surface",
      },
    ],
  },
  route: { projectId: "desen-neutral", surfaceId: "home" },
  sourceSurfaceId: "home",
  documentId: starterProject.record.source.id,
  sourceKey: "desen-neutral-source",
  initialDocument: starterProject.record.source,
  catalogs: [starterCatalog],
  catalogPackages: [
    {
      id: starterCatalog.id,
      version: starterCatalog.version,
      target: starterCatalog.target,
      observedPackageDigest: starterCatalog.packageDigest,
      catalog: starterCatalog,
    },
  ],
  runtime: {
    target: starterCatalog.target,
    registry: starterRegistry.handle,
    tokenCssProperties: {},
    hostPorts: starterHostPorts,
  },
  publication: null,
});
if (!starterProfile.ok) {
  throw new TypeError(
    `The DESEN Neutral workspace profile was rejected: ${starterProfile.reason}.`,
  );
}

/**
 * Factory-authenticated DESEN Neutral workspace installed beside the frozen reference projects.
 *
 * @remarks This is an additive product composition. It never reuses a reference document,
 * storage key, token provider, or publication destination, so rich visual authoring can evolve
 * without migrating the completed M10 reference workspaces.
 */
export const STARTER_NEUTRAL_WORKSPACE_PROFILE: ProjectWorkspaceProfileHandle =
  starterProfile.handle;
