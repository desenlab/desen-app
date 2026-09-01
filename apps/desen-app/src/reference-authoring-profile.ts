import referenceCatalog from "@desen/reference-catalog-web/catalog.json";
import { createDesenEditorDocument } from "@desen/editor-core";

import officialSignInSource from "../../../examples/sign-in/official-derived.source.desen.json";

import { prepareCatalogAuthoringModel, projectAuthoringCanvasFrame } from "./authoring-data.js";
import { prepareAuthoringPreviewBundle } from "./authoring-preview.js";
import {
  createProjectWorkspaceProfile,
  readProjectWorkspaceProfileAuthority,
} from "./project-workspace-profile.js";
import { REFERENCE_SIGN_IN_WORKSPACE_PROFILE } from "./reference-sign-in-workspace-profile.js";

import type { AuthoringCanvasFrameProjection, CatalogAuthoringModel } from "./authoring-data.js";
import type { AuthoringPreviewBundleResult } from "./authoring-preview.js";
import type { DesenEditorDocument } from "@desen/editor-core";
import type { PublishCatalogPackageCandidate } from "@desen/publisher";
import type { ProjectWorkspaceProfileHandle } from "./project-workspace-profile.js";

function createReferenceEditorDocument(): DesenEditorDocument {
  const admitted = createDesenEditorDocument(officialSignInSource);
  if (!admitted.ok) {
    throw new TypeError("The controlled reference Source could not be admitted for authoring.");
  }
  return admitted.document;
}

/** Frozen direct editor Source admitted from the controlled official-derived sign-in fixture. */
export const REFERENCE_EDITOR_DOCUMENT: DesenEditorDocument = createReferenceEditorDocument();

const referenceAuthoringResult = prepareCatalogAuthoringModel(
  [referenceCatalog],
  REFERENCE_EDITOR_DOCUMENT,
);
if (!referenceAuthoringResult.ok) {
  throw new TypeError(`Reference authoring fixture rejected: ${referenceAuthoringResult.reason}.`);
}

/** Validator-authenticated reference Catalog and official Source projected as an explicit profile. */
export const REFERENCE_AUTHORING_MODEL: CatalogAuthoringModel = referenceAuthoringResult.model;

/** Exact validator-admitted Catalog set owned by the explicit sign-in reference profile. */
export const REFERENCE_AUTHORING_CATALOGS: readonly unknown[] =
  REFERENCE_AUTHORING_MODEL.validationCatalogs;

/** Exact Publisher package candidates owned by the explicit sign-in reference profile. */
export const REFERENCE_AUTHORING_CATALOG_PACKAGES: readonly PublishCatalogPackageCandidate[] =
  Object.freeze([
    Object.freeze({
      id: REFERENCE_AUTHORING_MODEL.catalog.id,
      version: REFERENCE_AUTHORING_MODEL.catalog.version,
      target: REFERENCE_AUTHORING_MODEL.catalog.target,
      observedPackageDigest: referenceCatalog.packageDigest,
      catalog: REFERENCE_AUTHORING_CATALOGS[0],
    }),
  ]);

/** Complete immutable authority required to run the controlled sign-in reference composition. */
export interface ReferenceAuthoringProfile {
  readonly catalogs: readonly unknown[];
  readonly catalogPackages: readonly PublishCatalogPackageCandidate[];
  readonly document: DesenEditorDocument;
  readonly model: CatalogAuthoringModel;
}

/** Explicit sign-in fixture authority; generic authoring modules never select it implicitly. */
export const REFERENCE_AUTHORING_PROFILE: ReferenceAuthoringProfile = Object.freeze({
  catalogs: REFERENCE_AUTHORING_CATALOGS,
  catalogPackages: REFERENCE_AUTHORING_CATALOG_PACKAGES,
  document: REFERENCE_EDITOR_DOCUMENT,
  model: REFERENCE_AUTHORING_MODEL,
});

const productProfileAuthority = readProjectWorkspaceProfileAuthority(
  REFERENCE_SIGN_IN_WORKSPACE_PROFILE,
);
if (productProfileAuthority.status !== "read") {
  throw new TypeError("The reference product workspace profile could not be authenticated.");
}
const officialWorkspaceProfile = createProjectWorkspaceProfile({
  profileId: "reference-official-sign-in-web",
  project: {
    id: "account-app",
    name: "Account app",
    description: "The complete official sign-in authoring fixture.",
    surfaces: [
      {
        id: "sign-in",
        sourceId: "sign-in",
        name: "Sign-in",
        description: "Official reference sign-in surface",
      },
      {
        id: "home",
        sourceId: "home",
        name: "Home",
        description: "Official reference navigation destination",
      },
    ],
  },
  route: { projectId: "account-app", surfaceId: "sign-in" },
  sourceSurfaceId: "sign-in",
  documentId: REFERENCE_EDITOR_DOCUMENT.id,
  sourceKey: productProfileAuthority.profile.sourceKey,
  initialDocument: REFERENCE_EDITOR_DOCUMENT,
  catalogs: REFERENCE_AUTHORING_CATALOGS,
  catalogPackages: REFERENCE_AUTHORING_CATALOG_PACKAGES,
  runtime: {
    target: productProfileAuthority.profile.runtime.target,
    registry: productProfileAuthority.profile.runtime.registry,
    tokenCssProperties: productProfileAuthority.profile.runtime.tokenCssProperties,
    hostPorts: productProfileAuthority.profile.runtime.hostPorts,
  },
  publication: productProfileAuthority.profile.publication,
});
if (!officialWorkspaceProfile.ok) {
  throw new TypeError(
    `The official reference authoring workspace profile was rejected: ${officialWorkspaceProfile.reason}.`,
  );
}

/** Exact complete official fixture profile used by direct App/controller compatibility tests. */
export const REFERENCE_AUTHORING_WORKSPACE_PROFILE: ProjectWorkspaceProfileHandle =
  officialWorkspaceProfile.handle;

/** Publishes through the explicit sign-in reference package set for compatibility and proof use. */
export function prepareReferenceAuthoringPreviewBundle(
  document: DesenEditorDocument,
): AuthoringPreviewBundleResult {
  return prepareAuthoringPreviewBundle(document, REFERENCE_AUTHORING_CATALOG_PACKAGES);
}

/** Projects a frame through the explicit sign-in reference Catalog authority. */
export function projectReferenceAuthoringCanvasFrame(
  document: DesenEditorDocument,
  surfaceId: string,
): AuthoringCanvasFrameProjection {
  return projectAuthoringCanvasFrame(document, surfaceId, REFERENCE_AUTHORING_CATALOGS);
}
