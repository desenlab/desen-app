import { validateEditableProjectRecipeContracts } from "@desen/design-system-core";

import { prepareAuthoringPreviewBundle } from "./authoring-preview.js";
import {
  admitProjectWorkspaceDocument,
  readProjectWorkspaceProfileAuthority,
} from "./project-workspace-profile.js";

import type { EditableProjectRecord } from "@desen/design-system-core";
import type { DesenEditorDocument } from "@desen/editor-core";
import type { AuthoringPreviewBundleSuccess } from "./authoring-preview.js";
import type { ProjectWorkspaceRecord } from "./project-lifecycle.js";
import type { ProjectWorkspaceProfileHandle } from "./project-workspace-profile.js";

/** One immutable project, exact ordinary Source and matching Publisher preview. */
export interface ProjectAuthoringSession {
  /** Admitted aggregate, including every recipe relationship and local override. */
  readonly record: EditableProjectRecord;
  /** Exact complete-project digest used for stale-operation fences. */
  readonly digest: string;
  /** The very same ordinary Source retained inside `record`, never a recipe expansion on read. */
  readonly document: DesenEditorDocument;
  /** Publisher result over that Source and the exact authenticated profile's package set. */
  readonly preview: AuthoringPreviewBundleSuccess;
}

/** Bounded failure which grants no partial project, Source or preview. */
export type ProjectAuthoringSessionFailureReason =
  | "profile-invalid"
  | "project-invalid"
  | "project-mismatch"
  | "source-rejected"
  | "publisher-rejected";

/** All-or-nothing preparation of an aggregate authoring session. */
export type ProjectAuthoringSessionResult =
  | Readonly<{ ok: true; session: ProjectAuthoringSession }>
  | Readonly<{ ok: false; reason: ProjectAuthoringSessionFailureReason }>;

/**
 * Checks the complete graph and unused masters, authenticates the exact product profile, and
 * preflights the stored Source with Publisher before any active session or workspace replacement.
 * This function performs no save, activation, host operation, repair or recipe rewrite.
 */
export function prepareProjectAuthoringSession(
  profile: ProjectWorkspaceProfileHandle,
  candidate: unknown,
): ProjectAuthoringSessionResult {
  const authority = readProjectWorkspaceProfileAuthority(profile);
  if (authority.status !== "read") return Object.freeze({ ok: false, reason: "profile-invalid" });
  const admitted = validateEditableProjectRecipeContracts(candidate, authority.profile.catalogs);
  if (!admitted.ok) return Object.freeze({ ok: false, reason: "project-invalid" });
  if (admitted.record.id !== authority.profile.project.id)
    return Object.freeze({ ok: false, reason: "project-mismatch" });
  const source = admitProjectWorkspaceDocument(profile, admitted.record.source);
  if (source.status !== "admitted") return Object.freeze({ ok: false, reason: "source-rejected" });
  const preview = prepareAuthoringPreviewBundle(
    admitted.record.source,
    authority.profile.catalogPackages,
  );
  if (!preview.ok) return Object.freeze({ ok: false, reason: "publisher-rejected" });
  return Object.freeze({
    ok: true,
    session: Object.freeze({
      record: admitted.record,
      digest: admitted.digest,
      document: admitted.record.source,
      preview,
    }),
  });
}

/**
 * Captures the exact installed project profiles for lifecycle admission, including recoverable
 * deleted projects. Unknown projects and incompatible records reject before workspace replacement.
 * The returned trusted callback is configuration, never persisted document data.
 */
export function createProjectWorkspaceAuthoringAdmission(
  profiles: readonly ProjectWorkspaceProfileHandle[],
): (workspace: ProjectWorkspaceRecord) => boolean {
  const installed = new Map<string, ProjectWorkspaceProfileHandle>();
  for (const profile of profiles) {
    const authority = readProjectWorkspaceProfileAuthority(profile);
    if (authority.status !== "read" || installed.has(authority.profile.project.id))
      throw new TypeError("Installed project profile authority is invalid or duplicated.");
    installed.set(authority.profile.project.id, profile);
  }
  return (workspace) =>
    [...workspace.projects, ...workspace.deletedProjects].every(({ id, record }) => {
      const profile = installed.get(id);
      return profile !== undefined && prepareProjectAuthoringSession(profile, record).ok;
    });
}
