import referenceCatalog from "@desen/reference-catalog-web/catalog.json";
import { REFERENCE_WEB_REACT_ADAPTER_REGISTRY_INPUT } from "@desen/reference-catalog-web/react-adapters";
import {
  REFERENCE_WEB_TOKEN_CSS_PROPERTIES,
  REFERENCE_WEB_TOKEN_PROVIDER,
} from "@desen/reference-catalog-web/tokens";
import { createRuntimeHostPorts } from "@desen/runtime-core";
import { createRuntimeReactAdapterRegistry } from "@desen/runtime-react";

import { createProjectWorkspaceProfile } from "./project-workspace-profile.js";
import { EMPTY_REFERENCE_PROJECT_DOCUMENT } from "./reference-empty-project.js";

import type { RuntimeHostPorts, RuntimeJsonObject } from "@desen/runtime-core";
import type { ProjectWorkspaceProfileHandle } from "./project-workspace-profile.js";

const EMPTY_RUNTIME_JSON = Object.freeze({}) satisfies RuntimeJsonObject;
const REFERENCE_WEB_ENVIRONMENT = Object.freeze({ platform: "web" }) satisfies RuntimeJsonObject;

const referenceRegistry = createRuntimeReactAdapterRegistry(
  REFERENCE_WEB_REACT_ADAPTER_REGISTRY_INPUT,
);
if (referenceRegistry.status !== "created") {
  throw new TypeError("The reference Web React adapter registry could not be created.");
}

const referenceHostPorts = createRuntimeHostPorts({
  navigation: { navigate: () => ({ status: "denied" }) },
  storage: {
    getBundle: () => ({ status: "missing" }),
    putBundle: () => ({ status: "conflict" }),
    readActivation: () => ({ status: "missing" }),
    commitActivation: () => ({ status: "conflict", generation: null }),
  },
  operations: { invoke: () => ({ status: "denied" }) },
  resources: { load: () => ({ status: "denied" }) },
  tokens: {
    resolve: ({ token }) => {
      const resolution = REFERENCE_WEB_TOKEN_PROVIDER.resolve(token);
      return resolution.ok
        ? Object.freeze({ status: "resolved", value: resolution.value })
        : Object.freeze({ status: "missing" });
    },
  },
  context: {
    getSnapshot: () => EMPTY_RUNTIME_JSON,
    subscribe: () => () => undefined,
  },
  environment: {
    getSnapshot: () => REFERENCE_WEB_ENVIRONMENT,
    subscribe: () => () => undefined,
  },
  clock: { now: () => 1 },
  diagnostics: { report: () => undefined },
} satisfies RuntimeHostPorts);

const referenceProfile = createProjectWorkspaceProfile({
  profileId: "reference-sign-in-web",
  project: {
    id: "account-app",
    name: "Account app",
    description: "A local project authored with the official Web React reference Catalog.",
    surfaces: [
      {
        id: "sign-in",
        sourceId: "sign-in",
        name: "Sign-in",
        description: "Local authored Source",
      },
    ],
  },
  route: { projectId: "account-app", surfaceId: "sign-in" },
  sourceSurfaceId: "sign-in",
  documentId: "com.example.account-app",
  sourceKey: "account-app-source",
  initialDocument: EMPTY_REFERENCE_PROJECT_DOCUMENT,
  catalogs: [referenceCatalog],
  catalogPackages: [
    {
      id: referenceCatalog.id,
      version: referenceCatalog.version,
      target: referenceCatalog.target,
      observedPackageDigest: referenceCatalog.packageDigest,
      catalog: referenceCatalog,
    },
  ],
  runtime: {
    target: referenceCatalog.target,
    registry: referenceRegistry.handle,
    tokenCssProperties: REFERENCE_WEB_TOKEN_CSS_PROPERTIES as Readonly<Record<string, string>>,
    hostPorts: referenceHostPorts,
  },
  publication: { channelName: "preview", hostId: "reference-host-web" },
});
if (!referenceProfile.ok) {
  throw new TypeError(
    `The reference sign-in workspace profile was rejected: ${referenceProfile.reason}.`,
  );
}

/**
 * Factory-authenticated reference sign-in workspace profile used by the current local product.
 *
 * @remarks Sign-in is one explicit trusted composition, not a default inferred by generic editor
 * code. Its Source, Catalog package, adapter registry, tokens, storage key, route and publication
 * destination remain byte-for-byte compatible with the completed M10-T01A product behavior.
 */
export const REFERENCE_SIGN_IN_WORKSPACE_PROFILE: ProjectWorkspaceProfileHandle =
  referenceProfile.handle;
