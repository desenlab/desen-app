import {
  createDesenEditorContinuousValidator,
  createDesenEditorDocument,
} from "@desen/editor-core";
import { canonicalizeJson, digestCanonicalJson } from "@desen/protocol";
import { publishDesenSource } from "@desen/publisher";

import {
  admitProjectWorkspaceDocument,
  readProjectWorkspaceProfileAuthority,
} from "./project-workspace-profile.js";
import { parseInertJsonText } from "./structured-json.js";

import type {
  DesenEditorContinuousValidationReport,
  DesenEditorDocument,
} from "@desen/editor-core";
import type { PublishFailure } from "@desen/publisher";
import type { AuthoringPreviewBundleSuccess } from "./authoring-preview.js";
import type { ProjectWorkspaceProfileHandle } from "./project-workspace-profile.js";

/** A rejected text draft never exposes a candidate document or a publishable Bundle. */
export interface AuthoringSourceDraftFailure {
  readonly ok: false;
  readonly reason: "invalid-json" | "invalid-source" | "workspace-mismatch" | "stale-draft";
  readonly validationReport?: DesenEditorContinuousValidationReport;
  readonly publicationFailure?: PublishFailure;
}

/** One freshly admitted complete Source replacement, still requiring ordinary Save and Publish. */
export type AuthoringSourceDraftResult =
  | AuthoringSourceDraftFailure
  | Readonly<{
      readonly ok: true;
      readonly document: DesenEditorDocument;
      readonly preview: AuthoringPreviewBundleSuccess;
    }>;

/**
 * Reviews an advanced Source draft against its exact authoring baseline and trusted workspace.
 *
 * @remarks Raw text crosses the bounded inert parser and the public Publisher independently of
 * the continuous diagnostic mapper. Only that mapper's explicit invalid subjects may authorize
 * node links. Even a publishable document must match the workspace's fixed identities before it
 * can replace the session; no persistence, channel or activation callback is reachable here.
 */
export function reviewAuthoringSourceDraft(
  rawText: unknown,
  profile: ProjectWorkspaceProfileHandle,
  currentDocument: DesenEditorDocument,
  route: Readonly<{ readonly projectId: string; readonly surfaceId: string }>,
  baselineFingerprint: string,
): AuthoringSourceDraftResult {
  try {
    const authority = readProjectWorkspaceProfileAuthority(profile);
    const current = admitProjectWorkspaceDocument(profile, currentDocument);
    if (
      authority.status !== "read" ||
      current.status !== "admitted" ||
      authority.profile.project.id !== route.projectId ||
      !authority.profile.project.surfaces.some(({ sourceId }) => sourceId === route.surfaceId)
    )
      return Object.freeze({ ok: false, reason: "workspace-mismatch" });
    if (digestCanonicalJson(current.document) !== baselineFingerprint) {
      return Object.freeze({ ok: false, reason: "stale-draft" });
    }
    const parsed = parseInertJsonText(rawText);
    if (!parsed.ok || typeof rawText !== "string") {
      return Object.freeze({ ok: false, reason: "invalid-json" });
    }
    const publication = publishDesenSource(rawText, authority.profile.catalogPackages);
    const candidate = createDesenEditorDocument(parsed.value);
    // An invalid foreign document must not borrow this route's node identities for diagnostic
    // navigation. Advanced input edits Source content, not workspace/Catalog composition.
    if (
      candidate.ok &&
      (candidate.document.id !== current.document.id ||
        candidate.document.entry !== current.document.entry ||
        canonicalizeJson(Object.keys(candidate.document.surfaces).sort()) !==
          canonicalizeJson(Object.keys(current.document.surfaces).sort()) ||
        canonicalizeJson(candidate.document.catalogs) !==
          canonicalizeJson(current.document.catalogs))
    ) {
      return Object.freeze({ ok: false, reason: "workspace-mismatch" });
    }
    const validator = createDesenEditorContinuousValidator(authority.profile.catalogs);
    const report =
      candidate.ok && validator.ok ? validator.validator.validate(candidate.document) : undefined;
    if (!publication.ok || !candidate.ok || report?.valid !== true) {
      return Object.freeze({
        ok: false,
        reason: "invalid-source",
        ...(report === undefined ? {} : { validationReport: report }),
        ...(publication.ok ? {} : { publicationFailure: publication }),
      });
    }
    const admitted = admitProjectWorkspaceDocument(profile, candidate.document);
    if (admitted.status !== "admitted") {
      return Object.freeze({ ok: false, reason: "workspace-mismatch" });
    }
    return Object.freeze({
      ok: true,
      document: admitted.document,
      preview: Object.freeze({
        ok: true,
        bundle: publication.bundle,
        revision: publication.bundle.revision,
      }),
    });
  } catch {
    return Object.freeze({ ok: false, reason: "invalid-source" });
  }
}
