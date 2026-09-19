import { canonicalizeJson, digestCanonicalJson } from "@desen/protocol";

import {
  admitEditableProjectRecord,
  admitEditableProjectRecordForMigration,
  EDITABLE_PROJECT_SCHEMA_VERSION,
} from "./project-record.js";

import type { EditableProjectDiagnostic } from "./diagnostics.js";
import type { EditableProjectRecord } from "./project-record.js";

/** Exact closed set of editable-project versions understood by this package. */
export const SUPPORTED_EDITABLE_PROJECT_SCHEMA_VERSIONS = Object.freeze([1, 2] as const);

/** One exact additive transformation applied by the version-1 migration. */
export type EditableProjectMigrationChange =
  | {
      /** Identifies the envelope discriminator update. */
      readonly code: "SCHEMA_VERSION_UPDATED";
      /** Exact field changed by this transformation. */
      readonly pointer: "/schemaVersion";
      /** The admitted historical version. */
      readonly from: 1;
      /** The current returned version. */
      readonly to: 2;
    }
  | {
      /** Identifies the additive empty authoring graph. */
      readonly code: "RECIPE_GRAPH_ADDED";
      /** Exact field introduced without reinterpreting legacy metadata. */
      readonly pointer: "/designSystem/recipeGraph";
    };

interface EditableProjectMigrationOutput {
  /** Confirms that a complete current record is available. */
  readonly ok: true;
  /** Current schema version returned by dispatch. */
  readonly toSchemaVersion: typeof EDITABLE_PROJECT_SCHEMA_VERSION;
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

/** Successful finite migration dispatch with a truthful version-specific change report. */
export type EditableProjectMigrationSuccess = EditableProjectMigrationOutput &
  (
    | {
        /** Exact admitted predecessor version. */
        readonly fromSchemaVersion: 1;
        /** Confirms the explicit version-1 to version-2 conversion. */
        readonly migrated: true;
        /** Ordered discriminator update and additive empty-graph changes. */
        readonly changes: readonly [
          Extract<EditableProjectMigrationChange, { readonly code: "SCHEMA_VERSION_UPDATED" }>,
          Extract<EditableProjectMigrationChange, { readonly code: "RECIPE_GRAPH_ADDED" }>,
        ];
      }
    | {
        /** Current version admitted without conversion. */
        readonly fromSchemaVersion: 2;
        /** Confirms the version-2 identity path. */
        readonly migrated: false;
        /** Identity dispatch rewrites no field. */
        readonly changes: readonly [];
      }
  );

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
 * @remarks Exact version 1 converts losslessly by adding an empty recipe graph and changing only
 * the envelope version. Version 2 has an identity path. Safe inert capture precedes version
 * dispatch; unknown versions and malformed known formats produce no partial result.
 */
export function migrateEditableProjectRecord(input: unknown): EditableProjectMigrationResult {
  const admission = admitEditableProjectRecordForMigration(input);
  if (!admission.ok) return admission;

  const original = admission.record;
  const current =
    original.schemaVersion === EDITABLE_PROJECT_SCHEMA_VERSION
      ? { ok: true as const, record: original }
      : admitEditableProjectRecord({
          ...original,
          schemaVersion: EDITABLE_PROJECT_SCHEMA_VERSION,
          designSystem: {
            ...original.designSystem,
            recipeGraph: { definitions: [], instances: [] },
          },
        });
  if (!current.ok) return current;
  const output = {
    ok: true,
    toSchemaVersion: EDITABLE_PROJECT_SCHEMA_VERSION,
    losses: Object.freeze([]) as readonly [],
    record: current.record,
    canonicalJson: canonicalizeJson(current.record),
    digest: digestCanonicalJson(current.record),
    diagnostics: Object.freeze([]) as readonly [],
  } as const;

  if (original.schemaVersion === 1) {
    return Object.freeze({
      ...output,
      fromSchemaVersion: 1,
      migrated: true,
      changes: Object.freeze([
        Object.freeze({
          code: "SCHEMA_VERSION_UPDATED",
          pointer: "/schemaVersion",
          from: 1,
          to: 2,
        }),
        Object.freeze({ code: "RECIPE_GRAPH_ADDED", pointer: "/designSystem/recipeGraph" }),
      ] as const),
    });
  }
  return Object.freeze({
    ...output,
    fromSchemaVersion: 2,
    migrated: false,
    changes: Object.freeze([]) as readonly [],
  });
}
