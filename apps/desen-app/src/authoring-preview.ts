import { createDesenEditorDocument } from "@desen/editor-core";
import { publishDesenSource } from "@desen/publisher";
import referenceCatalog from "@desen/reference-catalog-web/catalog.json";

import officialSignInSource from "../../../examples/sign-in/official-derived.source.desen.json";

import type { DesenEditorDocument } from "@desen/editor-core";
import type { PublishCatalogPackageCandidate, PublishSuccess } from "@desen/publisher";

const REFERENCE_CATALOG_PACKAGE = Object.freeze({
  id: "run.desen.reference.sign-in",
  version: "0.1.0",
  target: "web-react",
  observedPackageDigest: "sha256:d4a4e7e2ea2d68ab8bff085d90e093f2d31b784f0f2fb089c6422ce33914b051",
  catalog: referenceCatalog,
}) satisfies PublishCatalogPackageCandidate;

const REFERENCE_CATALOG_PACKAGES = Object.freeze([REFERENCE_CATALOG_PACKAGE]);

/** Safe, non-diagnostic reason why a session-local authoring preview could not be prepared. */
export type AuthoringPreviewBundleFailureReason =
  "editor-document-invalid" | "publication-rejected";

/** Complete immutable Bundle and its exact revision for one session-local authoring preview. */
export interface AuthoringPreviewBundleSuccess {
  readonly ok: true;
  readonly bundle: PublishSuccess["bundle"];
  readonly revision: string;
}

/** Fail-closed authoring-preview rejection with no partial Bundle authority. */
export interface AuthoringPreviewBundleFailure {
  readonly ok: false;
  readonly reason: AuthoringPreviewBundleFailureReason;
}

/** Closed result of preparing a session-local preview Bundle from one editor document. */
export type AuthoringPreviewBundleResult =
  AuthoringPreviewBundleSuccess | AuthoringPreviewBundleFailure;

function previewFailure(
  reason: AuthoringPreviewBundleFailureReason,
): AuthoringPreviewBundleFailure {
  return Object.freeze({ ok: false, reason });
}

function createReferenceEditorDocument(): DesenEditorDocument {
  const admitted = createDesenEditorDocument(officialSignInSource);
  if (!admitted.ok) {
    throw new TypeError("The controlled reference Source could not be admitted for authoring.");
  }
  return admitted.document;
}

/** Frozen direct editor Source admitted from the controlled official-derived sign-in fixture. */
export const REFERENCE_EDITOR_DOCUMENT: DesenEditorDocument = createReferenceEditorDocument();

/**
 * Publishes one editor Source into an immutable preview Bundle using the exact reference Catalog.
 *
 * @remarks The input is re-admitted before publication so runtime casts cannot bypass the direct
 * Source boundary. This pure helper grants no persistence, deployment, activation, host-operation,
 * or adapter authority. Rejection exposes neither Publisher diagnostics nor a partial Bundle.
 */
export function prepareAuthoringPreviewBundle(
  document: DesenEditorDocument,
): AuthoringPreviewBundleResult {
  let admitted: ReturnType<typeof createDesenEditorDocument>;
  try {
    admitted = createDesenEditorDocument(document);
  } catch {
    return previewFailure("editor-document-invalid");
  }
  if (!admitted.ok) return previewFailure("editor-document-invalid");

  let rawSource: string | undefined;
  try {
    rawSource = JSON.stringify(admitted.document);
  } catch {
    return previewFailure("editor-document-invalid");
  }
  if (rawSource === undefined) return previewFailure("editor-document-invalid");

  try {
    const published = publishDesenSource(rawSource, REFERENCE_CATALOG_PACKAGES);
    if (!published.ok) return previewFailure("publication-rejected");
    return Object.freeze({
      ok: true,
      bundle: published.bundle,
      revision: published.bundle.revision,
    });
  } catch {
    return previewFailure("publication-rejected");
  }
}
