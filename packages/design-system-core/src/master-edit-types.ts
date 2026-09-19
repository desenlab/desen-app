import type { EditableProjectRecord } from "./project-record.js";
import type { EditableProjectRecipeTransactionFailure } from "./recipe-transaction-types.js";

/** Provenance-checked, isolated ordinary-Source projection for visually editing one master. */
export interface EditableProjectMasterDraft {
  /** Exact original project identity; applying against any other snapshot rejects. */
  readonly expectedProjectDigest: string;
  /** Original transitive definition identity, not a selected instance's overridden appearance. */
  readonly expectedDefinitionDigest: string;
  /** Exact Catalog set used to validate the projection and its eventual update. */
  readonly catalogSetFingerprint: string;
  /** Definition edited by this draft. */
  readonly masterId: string;
  /** Existing surface temporarily replaced in the isolated editing projection. */
  readonly surfaceId: string;
  /** Initial immutable projection; it must never replace the live project or be persisted. */
  readonly record: EditableProjectRecord;
}

/** Controlled result of opening an isolated visual master draft, without changing a project. */
export type EditableProjectMasterDraftResult =
  | Readonly<{
      /** Confirms an authentic immutable draft can be edited with ordinary Source commands. */
      ok: true;
      /** Draft whose original project remains untouched until a complete update is prepared. */
      draft: EditableProjectMasterDraft;
    }>
  | EditableProjectRecipeTransactionFailure;
