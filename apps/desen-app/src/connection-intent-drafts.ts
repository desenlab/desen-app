import { admitEditableProjectRecord } from "@desen/design-system-core";

import type {
  DesignSystemJsonObject,
  EditableProjectConnectionIntent,
  EditableProjectRecord,
} from "@desen/design-system-core";
import type { DesenEditorDocument } from "@desen/editor-core";

/** Inert metadata namespace owned by the Connections workspace. */
export const CONNECTION_INTENT_EXTENSION_KEY = "com.desen.app.connections" as const;
export const CONNECTION_INTENT_SCHEMA_VERSION = 1 as const;

export type ConnectionIntentCandidateKind = "action" | "event" | "navigation" | "state";
export type ConnectionIntentPhase = "applied" | "pending";

/** A candidate describes author intent only; it is never executable Source or host code. */
export interface ConnectionIntentCandidate {
  readonly kind: ConnectionIntentCandidateKind;
  readonly name: string;
}

/** Complete form state retained independently from the canonical DESEN Source. */
export interface ConnectionIntentDraft {
  readonly id: string;
  readonly surfaceId: string;
  readonly nodeId: string;
  readonly label: string;
  readonly note: string;
  readonly candidate: ConnectionIntentCandidate;
}

export type ConnectionIntentDraftFailureReason =
  "candidate-invalid" | "draft-invalid" | "intent-not-found" | "record-invalid" | "stale-target";

export type ConnectionIntentDraftResult =
  | Readonly<{ readonly ok: true; readonly record: EditableProjectRecord }>
  | Readonly<{ readonly ok: false; readonly reason: ConnectionIntentDraftFailureReason }>;

type ConnectionIntentDraftCaptureResult =
  | Readonly<{ readonly ok: true; readonly draft: ConnectionIntentDraft }>
  | Readonly<{ readonly ok: false; readonly reason: "draft-invalid" }>;

export interface ConnectionTargetOption {
  readonly id: string;
  readonly displayName: string;
  readonly capabilityId: string;
}

interface ConnectionIntentExtension {
  readonly kind: "desen.connection-intent";
  readonly schemaVersion: typeof CONNECTION_INTENT_SCHEMA_VERSION;
  readonly phase: ConnectionIntentPhase;
  readonly candidate: ConnectionIntentCandidate;
}

const IDENTIFIER = /^[A-Za-z0-9](?:[A-Za-z0-9._:-]{0,127})$/u;
const LABEL = /^.{0,512}$/su;
const CANDIDATE_NAME = /^.{0,256}$/su;
const CANDIDATE_KINDS: readonly ConnectionIntentCandidateKind[] = Object.freeze([
  "action",
  "event",
  "navigation",
  "state",
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean {
  const allowed = new Set([...required, ...optional]);
  const keys = Object.keys(value);
  return (
    required.every((key) => Object.hasOwn(value, key)) && keys.every((key) => allowed.has(key))
  );
}

function isLabel(value: unknown, pattern = LABEL): value is string {
  return typeof value === "string" && pattern.test(value);
}

function captureCandidate(value: unknown): ConnectionIntentCandidate | undefined {
  if (!isObject(value) || !hasExactKeys(value, ["kind", "name"])) return undefined;
  if (
    !CANDIDATE_KINDS.includes(value.kind as ConnectionIntentCandidateKind) ||
    !isLabel(value.name, CANDIDATE_NAME)
  ) {
    return undefined;
  }
  return Object.freeze({
    kind: value.kind as ConnectionIntentCandidateKind,
    name: value.name as string,
  });
}

function captureDraft(value: unknown): ConnectionIntentDraft | undefined {
  if (
    !isObject(value) ||
    !hasExactKeys(value, ["id", "surfaceId", "nodeId", "label", "note", "candidate"])
  ) {
    return undefined;
  }
  if (
    !IDENTIFIER.test(String(value.id)) ||
    !IDENTIFIER.test(String(value.surfaceId)) ||
    !IDENTIFIER.test(String(value.nodeId)) ||
    !isLabel(value.label) ||
    !isLabel(value.note, /^.{0,2048}$/su)
  ) {
    return undefined;
  }
  const candidate = captureCandidate(value.candidate);
  if (candidate === undefined) return undefined;
  return Object.freeze({
    id: value.id as string,
    surfaceId: value.surfaceId as string,
    nodeId: value.nodeId as string,
    label: value.label as string,
    note: value.note as string,
    candidate,
  });
}

function captureExtension(value: unknown): ConnectionIntentExtension | undefined {
  if (!isObject(value) || !hasExactKeys(value, ["kind", "schemaVersion", "phase", "candidate"])) {
    return undefined;
  }
  const candidate = captureCandidate(value.candidate);
  if (
    value.kind !== "desen.connection-intent" ||
    value.schemaVersion !== CONNECTION_INTENT_SCHEMA_VERSION ||
    (value.phase !== "pending" && value.phase !== "applied") ||
    candidate === undefined
  ) {
    return undefined;
  }
  return Object.freeze({
    kind: "desen.connection-intent",
    schemaVersion: CONNECTION_INTENT_SCHEMA_VERSION,
    phase: value.phase,
    candidate,
  });
}

function readExtension(
  intent: EditableProjectConnectionIntent,
): ConnectionIntentExtension | undefined {
  return captureExtension(intent.extensions?.[CONNECTION_INTENT_EXTENSION_KEY]);
}

function findIntent(
  record: EditableProjectRecord,
  id: string,
): EditableProjectConnectionIntent | undefined {
  return record.connectionIntents.find((intent) => intent.id === id);
}

function nodeExists(document: DesenEditorDocument, surfaceId: string, nodeId: string): boolean {
  const surface = document.surfaces[surfaceId];
  if (surface === undefined) return false;
  const pending = [surface.root];
  let matches = 0;
  while (pending.length > 0) {
    const node = pending.pop();
    if (node === undefined) continue;
    if (node.id === nodeId) matches += 1;
    for (const children of Object.values(node.slots ?? {})) pending.push(...children);
    for (const behavior of node.behaviors ?? []) {
      for (const children of Object.values(behavior.slots ?? {})) pending.push(...children);
    }
  }
  return matches === 1;
}

/** Lists stable Source targets for a surface without exposing any executable behavior. */
export function listConnectionTargets(
  document: DesenEditorDocument,
  surfaceId: string,
): readonly ConnectionTargetOption[] {
  const surface = document.surfaces[surfaceId];
  if (surface === undefined) return Object.freeze([]);
  const output: ConnectionTargetOption[] = [];
  const pending = [surface.root];
  while (pending.length > 0) {
    const node = pending.pop();
    if (node === undefined) continue;
    output.push(Object.freeze({ id: node.id, displayName: node.id, capabilityId: node.use }));
    for (const children of Object.values(node.slots ?? {})) pending.push(...children);
    for (const behavior of node.behaviors ?? []) {
      for (const children of Object.values(behavior.slots ?? {})) pending.push(...children);
    }
  }
  return Object.freeze(output.reverse());
}

/** Validates a form without admitting executable handlers, URLs, credentials, or Source. */
export function createConnectionIntentDraft(value: unknown): ConnectionIntentDraftCaptureResult {
  const draft = captureDraft(value);
  return draft === undefined
    ? Object.freeze({ ok: false, reason: "draft-invalid" as const })
    : Object.freeze({ ok: true as const, draft });
}

function writeRecord(
  record: EditableProjectRecord,
  draft: ConnectionIntentDraft,
  phase: ConnectionIntentPhase,
): ConnectionIntentDraftResult {
  if (!nodeExists(record.source, draft.surfaceId, draft.nodeId)) {
    return Object.freeze({ ok: false, reason: "stale-target" });
  }
  const extension: ConnectionIntentExtension = Object.freeze({
    kind: "desen.connection-intent",
    schemaVersion: CONNECTION_INTENT_SCHEMA_VERSION,
    phase,
    candidate: draft.candidate,
  });
  const nextIntent: EditableProjectConnectionIntent = Object.freeze({
    id: draft.id,
    status: "draft",
    surfaceId: draft.surfaceId,
    nodeId: draft.nodeId,
    ...(draft.label === "" ? {} : { label: draft.label }),
    ...(draft.note === "" ? {} : { note: draft.note }),
    extensions: Object.freeze({
      [CONNECTION_INTENT_EXTENSION_KEY]: extension as unknown as DesignSystemJsonObject,
    }),
  });
  const nextIntents = Object.freeze([
    ...record.connectionIntents.filter((intent) => intent.id !== draft.id),
    nextIntent,
  ]);
  const admission = admitEditableProjectRecord({ ...record, connectionIntents: nextIntents });
  return admission.ok
    ? Object.freeze({ ok: true as const, record: admission.record })
    : Object.freeze({ ok: false as const, reason: "record-invalid" });
}

/** Saves a pending form beside the valid Source; the Source bytes remain unchanged. */
export function saveConnectionIntentDraft(
  record: EditableProjectRecord,
  value: unknown,
): ConnectionIntentDraftResult {
  const captured = createConnectionIntentDraft(value);
  if (!captured.ok) return Object.freeze({ ok: false, reason: captured.reason });
  return writeRecord(record, captured.draft, "pending");
}

/** Applies only the inert intent metadata after rechecking the current node identity. */
export function applyConnectionIntentDraft(
  record: EditableProjectRecord,
  value: unknown,
): ConnectionIntentDraftResult {
  const captured = createConnectionIntentDraft(value);
  if (!captured.ok) return Object.freeze({ ok: false, reason: captured.reason });
  return writeRecord(record, captured.draft, "applied");
}

/** Removes one intent record and leaves every Source/design-system field untouched. */
export function discardConnectionIntentDraft(
  record: EditableProjectRecord,
  id: string,
): ConnectionIntentDraftResult {
  if (!IDENTIFIER.test(id) || findIntent(record, id) === undefined) {
    return Object.freeze({ ok: false, reason: "intent-not-found" });
  }
  const admission = admitEditableProjectRecord({
    ...record,
    connectionIntents: Object.freeze(record.connectionIntents.filter((intent) => intent.id !== id)),
  });
  return admission.ok
    ? Object.freeze({ ok: true as const, record: admission.record })
    : Object.freeze({ ok: false as const, reason: "record-invalid" });
}

/** Reopens only a Connections-owned intent; foreign legacy notes stay inert and untouched. */
export function readConnectionIntentDraft(
  record: EditableProjectRecord,
  id: string,
): ConnectionIntentDraft | undefined {
  const intent = findIntent(record, id);
  if (intent === undefined || intent.nodeId === undefined) return undefined;
  const extension = readExtension(intent);
  if (extension === undefined) return undefined;
  return Object.freeze({
    id: intent.id,
    surfaceId: intent.surfaceId,
    nodeId: intent.nodeId,
    label: intent.label ?? "",
    note: intent.note ?? "",
    candidate: extension.candidate,
  });
}

/** Projects persisted drafts for one surface without treating applied intents as executable. */
export function listConnectionIntentDrafts(
  record: EditableProjectRecord,
  surfaceId: string,
): readonly (ConnectionIntentDraft & { readonly phase: ConnectionIntentPhase })[] {
  return Object.freeze(
    record.connectionIntents.flatMap((intent) => {
      if (intent.surfaceId !== surfaceId || intent.nodeId === undefined) return [];
      const extension = readExtension(intent);
      if (extension === undefined) return [];
      return [
        Object.freeze({
          id: intent.id,
          surfaceId: intent.surfaceId,
          nodeId: intent.nodeId,
          label: intent.label ?? "",
          note: intent.note ?? "",
          candidate: extension.candidate,
          phase: extension.phase,
        }),
      ];
    }),
  );
}
