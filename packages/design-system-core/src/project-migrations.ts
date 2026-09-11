import { canonicalizeJson, digestCanonicalJson } from "@desen/protocol";

import { admitEditableProjectRecord, EDITABLE_PROJECT_SCHEMA_VERSION } from "./project-record.js";

import type { EditableProjectDiagnostic } from "./diagnostics.js";
import type { EditableProjectRecord } from "./project-record.js";

/** Exact closed set of editable-project versions understood by this package. */
export const SUPPORTED_EDITABLE_PROJECT_SCHEMA_VERSIONS = Object.freeze([1] as const);

/** Successful finite migration dispatch and canonical loss report. */
export interface EditableProjectMigrationSuccess {
  /** Confirms that a complete current record is available. */
  readonly ok: true;
  /** Schema version observed before dispatch. */
  readonly fromSchemaVersion: typeof EDITABLE_PROJECT_SCHEMA_VERSION;
  /** Current schema version returned by dispatch. */
  readonly toSchemaVersion: typeof EDITABLE_PROJECT_SCHEMA_VERSION;
  /** False for the v1 identity path; no fictional predecessor is claimed. */
  readonly migrated: false;
  /** Explicitly empty because the current identity path rewrites no field. */
  readonly changes: readonly [];
  /** Explicitly empty because every admitted byte of semantic JSON is retained. */
  readonly losses: readonly [];
  /** Detached recursively immutable current record. */
  readonly record: EditableProjectRecord;
  /** RFC 8785 canonical JSON for deterministic export/reimport. */
  readonly canonicalJson: string;
  /** SHA-256 identity of the canonical project JSON. */
  readonly digest: string;
  /** Always empty on success. */
  readonly diagnostics: readonly [];
}

/** Failed migration dispatch with no partial project or export bytes. */
export interface EditableProjectMigrationFailure {
  /** Confirms that migration did not produce a record. */
  readonly ok: false;
  /** Deterministic admission or version diagnostics. */
  readonly diagnostics: readonly EditableProjectDiagnostic[];
}

/** Result of the finite editable-project migration registry. */
export type EditableProjectMigrationResult =
  EditableProjectMigrationFailure | EditableProjectMigrationSuccess;

/**
 * Dispatches an unknown project through the closed schema-version registry.
 *
 * @remarks Version 1 is currently the only real format, so its path is a lossless identity
 * migration. Unknown, legacy and future versions fail explicitly without speculative conversion.
 */
export function migrateEditableProjectRecord(input: unknown): EditableProjectMigrationResult {
  const admission = admitEditableProjectRecord(input);
  if (!admission.ok) return admission;
  const canonicalJson = canonicalizeJson(admission.record);
  return Object.freeze({
    ok: true,
    fromSchemaVersion: EDITABLE_PROJECT_SCHEMA_VERSION,
    toSchemaVersion: EDITABLE_PROJECT_SCHEMA_VERSION,
    migrated: false,
    changes: Object.freeze([]) as readonly [],
    losses: Object.freeze([]) as readonly [],
    record: admission.record,
    canonicalJson,
    digest: digestCanonicalJson(admission.record),
    diagnostics: Object.freeze([]) as readonly [],
  });
}
