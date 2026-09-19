import { canonicalizeJsonBytes } from "@desen/protocol";

import { admitEditableProjectRecord } from "./project-record.js";

import type { EditableProjectRecord } from "./project-record.js";

/** Finite snapshot-count and canonical-byte limits for one editable-project history. */
export const EDITABLE_PROJECT_HISTORY_LIMITS = Object.freeze({
  /** Number of earlier snapshots retained when no explicit limit is supplied. */
  defaultEntries: 100,
  /** Greatest accepted combined count of past and future snapshots. */
  maxEntries: 512,
  /** Maximum canonical bytes retained across the present, past and future snapshots. */
  maxRetainedBytes: 67_108_864,
});

/** One immutable aggregate snapshot retained for a future history transition. */
export interface EditableProjectHistoryEntry {
  /** Complete admitted project, including canonical Source and authoring metadata. */
  readonly record: EditableProjectRecord;
}

/** Bounded immutable history owned by an authoring host, never by Publisher or Runtime. */
export interface EditableProjectHistory {
  /** Complete current editable project. */
  readonly record: EditableProjectRecord;
  /** Earlier snapshots in chronological order; the last entry is the next undo target. */
  readonly past: readonly EditableProjectHistoryEntry[];
  /** Redo snapshots in transition order; the first entry is the next redo target. */
  readonly future: readonly EditableProjectHistoryEntry[];
  /** Maximum combined number of retained past and future snapshots. */
  readonly limit: number;
  /** Canonical byte count of the current record and all retained history entries. */
  readonly retainedBytes: number;
}

/** Stable reasons for a rejected editable-project history transition. */
export type EditableProjectHistoryDiagnosticCode =
  "HISTORY_EMPTY" | "HISTORY_RECORD_INVALID" | "HISTORY_STATE_INVALID" | "HISTORY_PROJECT_MISMATCH";

/** One immutable diagnostic with no untrusted record contents. */
export interface EditableProjectHistoryDiagnostic {
  /** Machine-readable classification of the rejected transition. */
  readonly code: EditableProjectHistoryDiagnosticCode;
  /** Bounded explanation of why no history change was applied. */
  readonly message: string;
}

/** Successful whole-project transition or canonical no-op. */
export interface EditableProjectHistorySuccess {
  /** Confirms an authenticated history remains available. */
  readonly ok: true;
  /** False only when the candidate equals the complete current project canonically. */
  readonly changed: boolean;
  /** New immutable history, or the exact preceding history for a no-op. */
  readonly history: EditableProjectHistory;
}

/** Rejected transition preserving the caller's preceding history without reading forged state. */
export interface EditableProjectHistoryFailure {
  /** Confirms that no transition was applied. */
  readonly ok: false;
  /** Exact input history; this is not an admission of a rejected or forged history object. */
  readonly history: EditableProjectHistory;
  /** One bounded, immutable explanation of the rejection. */
  readonly diagnostics: readonly [EditableProjectHistoryDiagnostic];
}

/** Controlled result of recording, undoing or redoing a complete project snapshot. */
export type EditableProjectHistoryResult =
  EditableProjectHistorySuccess | EditableProjectHistoryFailure;

const EMPTY_ENTRIES: readonly EditableProjectHistoryEntry[] = Object.freeze([]);
const historyProvenance = new WeakSet<EditableProjectHistory>();
const recordByteLengths = new WeakMap<EditableProjectRecord, number>();

function failure(
  history: EditableProjectHistory,
  code: EditableProjectHistoryDiagnosticCode,
  message: string,
): EditableProjectHistoryFailure {
  return Object.freeze({
    ok: false,
    history,
    diagnostics: Object.freeze([Object.freeze({ code, message })] as const),
  });
}

function invalidHistory(history: EditableProjectHistory): EditableProjectHistoryFailure {
  return failure(
    history,
    "HISTORY_STATE_INVALID",
    "Only a Design System Core-created immutable project history may transition.",
  );
}

function register(history: EditableProjectHistory): EditableProjectHistory {
  historyProvenance.add(history);
  return history;
}

function captureRecord(
  candidate: unknown,
): Readonly<{ readonly record: EditableProjectRecord; readonly bytes: Uint8Array }> | undefined {
  try {
    const admission = admitEditableProjectRecord(candidate);
    if (!admission.ok) return undefined;
    const bytes = canonicalizeJsonBytes(admission.record);
    if (bytes.byteLength > EDITABLE_PROJECT_HISTORY_LIMITS.maxRetainedBytes) return undefined;
    recordByteLengths.set(admission.record, bytes.byteLength);
    return { record: admission.record, bytes };
  } catch {
    return undefined;
  }
}

function recordByteLength(record: EditableProjectRecord): number {
  const byteLength = recordByteLengths.get(record);
  if (byteLength === undefined) throw new TypeError("An authenticated history lost its record.");
  return byteLength;
}

function sameRecord(record: EditableProjectRecord, bytes: Uint8Array): boolean {
  if (recordByteLength(record) !== bytes.byteLength) return false;
  const previous = canonicalizeJsonBytes(record);
  return previous.every((byte, index) => byte === bytes[index]);
}

function success(history: EditableProjectHistory, changed = true): EditableProjectHistorySuccess {
  return Object.freeze({ ok: true, changed, history });
}

/**
 * Creates bounded history from one admitted whole-project snapshot.
 *
 * @remarks Invalid records or limits return `undefined`. Every admitted record is detached and
 * deeply immutable. The byte limit applies to each returned history; callers control how long
 * they retain superseded histories. This helper grants no Catalog, preview or persistence authority.
 */
export function createEditableProjectHistory(
  record: unknown,
  limit: number = EDITABLE_PROJECT_HISTORY_LIMITS.defaultEntries,
): EditableProjectHistory | undefined {
  if (
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > EDITABLE_PROJECT_HISTORY_LIMITS.maxEntries
  )
    return undefined;
  const captured = captureRecord(record);
  if (captured === undefined) return undefined;
  return register(
    Object.freeze({
      record: captured.record,
      past: EMPTY_ENTRIES,
      future: EMPTY_ENTRIES,
      limit,
      retainedBytes: captured.bytes.byteLength,
    }),
  );
}

/**
 * Records one complete project and clears redo only when its canonical contents actually change.
 *
 * @remarks Oldest past entries are evicted until both the entry and byte limits hold. A metadata-
 * only change is still a history entry. Rejected candidates preserve the exact previous history.
 */
export function recordEditableProjectHistory(
  history: EditableProjectHistory,
  candidate: unknown,
): EditableProjectHistoryResult {
  if (!historyProvenance.has(history)) return invalidHistory(history);
  const captured = captureRecord(candidate);
  if (captured === undefined)
    return failure(
      history,
      "HISTORY_RECORD_INVALID",
      "The complete project could not be admitted.",
    );
  if (captured.record.id !== history.record.id)
    return failure(
      history,
      "HISTORY_PROJECT_MISMATCH",
      "A history cannot change project identity.",
    );
  if (sameRecord(history.record, captured.bytes)) return success(history, false);

  const past = [...history.past, Object.freeze({ record: history.record })].slice(-history.limit);
  let retainedBytes =
    captured.bytes.byteLength +
    past.reduce((total, entry) => total + recordByteLength(entry.record), 0);
  while (retainedBytes > EDITABLE_PROJECT_HISTORY_LIMITS.maxRetainedBytes) {
    const oldest = past.shift();
    if (oldest === undefined) break;
    retainedBytes -= recordByteLength(oldest.record);
  }
  return success(
    register(
      Object.freeze({
        record: captured.record,
        past: Object.freeze(past),
        future: EMPTY_ENTRIES,
        limit: history.limit,
        retainedBytes,
      }),
    ),
  );
}

/** Moves the complete current project to redo and restores the most recent past snapshot. */
export function undoEditableProjectHistory(
  history: EditableProjectHistory,
): EditableProjectHistoryResult {
  if (!historyProvenance.has(history)) return invalidHistory(history);
  const previous = history.past.at(-1);
  if (previous === undefined)
    return failure(history, "HISTORY_EMPTY", "No project edit is available to undo.");
  return success(
    register(
      Object.freeze({
        record: previous.record,
        past: Object.freeze(history.past.slice(0, -1)),
        future: Object.freeze([Object.freeze({ record: history.record }), ...history.future]),
        limit: history.limit,
        retainedBytes: history.retainedBytes,
      }),
    ),
  );
}

/** Restores the next complete redo snapshot, retaining the former present for undo. */
export function redoEditableProjectHistory(
  history: EditableProjectHistory,
): EditableProjectHistoryResult {
  if (!historyProvenance.has(history)) return invalidHistory(history);
  const next = history.future[0];
  if (next === undefined)
    return failure(history, "HISTORY_EMPTY", "No project edit is available to redo.");
  return success(
    register(
      Object.freeze({
        record: next.record,
        past: Object.freeze([...history.past, Object.freeze({ record: history.record })]),
        future: Object.freeze(history.future.slice(1)),
        limit: history.limit,
        retainedBytes: history.retainedBytes,
      }),
    ),
  );
}
