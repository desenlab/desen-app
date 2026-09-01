import { createDesenEditorDocument } from "@desen/editor-core";
import { publishDesenSource } from "@desen/publisher";

import type { DesenEditorDocument } from "@desen/editor-core";
import type { PublishCatalogPackageCandidate, PublishSuccess } from "@desen/publisher";

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

/**
 * Publishes one editor Source into an immutable preview Bundle using explicit package candidates.
 *
 * @remarks The input is re-admitted before publication so runtime casts cannot bypass the direct
 * Source boundary. This pure helper grants no persistence, deployment, activation, host-operation,
 * adapter, or Catalog-discovery authority. Rejection exposes neither Publisher diagnostics nor a
 * partial Bundle. The caller must supply candidates captured by its trusted project composition;
 * this module never substitutes a product fixture or default Catalog.
 */
export function prepareAuthoringPreviewBundle(
  document: DesenEditorDocument,
  catalogPackages: readonly PublishCatalogPackageCandidate[],
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
    const published = publishDesenSource(rawSource, catalogPackages);
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

/**
 * Publishes an inert editor-only Bundle whose entry is the exact selected Source surface.
 *
 * @remarks Runtime Core deliberately mounts a Bundle's declared entry surface. A multi-surface
 * editor therefore needs a fresh, fully Publisher-admitted preview Bundle when the designer opens
 * a non-entry surface. This helper changes only the transient preview candidate's `entry`; the
 * authored Source, persistence snapshot, publication revision, Catalog packages and runtime
 * authority remain untouched. Unknown surfaces fail closed through Editor Core admission.
 */
export function prepareAuthoringSurfacePreviewBundle(
  document: DesenEditorDocument,
  catalogPackages: readonly PublishCatalogPackageCandidate[],
  surfaceId: string,
): AuthoringPreviewBundleResult {
  let source: ReturnType<typeof createDesenEditorDocument>;
  try {
    source = createDesenEditorDocument(document);
  } catch {
    return previewFailure("editor-document-invalid");
  }
  if (!source.ok || !Object.hasOwn(source.document.surfaces, surfaceId)) {
    return previewFailure("editor-document-invalid");
  }
  if (source.document.entry === surfaceId) {
    return prepareAuthoringPreviewBundle(source.document, catalogPackages);
  }
  let selected: ReturnType<typeof createDesenEditorDocument>;
  try {
    selected = createDesenEditorDocument({ ...source.document, entry: surfaceId });
  } catch {
    return previewFailure("editor-document-invalid");
  }
  return selected.ok
    ? prepareAuthoringPreviewBundle(selected.document, catalogPackages)
    : previewFailure("editor-document-invalid");
}
