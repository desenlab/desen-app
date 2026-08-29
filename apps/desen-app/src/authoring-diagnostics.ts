import { isJsonPointer, isSha256Digest } from "@desen/protocol";

import type {
  DesenEditorContinuousValidationReport,
  DesenEditorInvalidSubjectMapping,
} from "@desen/editor-core";
import type { JsonPointer } from "@desen/protocol";
import type { RuntimeReactDiagnosticIndex } from "@desen/runtime-react";

interface AuthoringVisibleSubject {
  readonly kind: "node" | "behavior";
  readonly id: string;
}

interface AuthoringVisibleContext {
  readonly documentId: string | null;
  readonly surfaceId: string | null;
  readonly subject: AuthoringVisibleSubject | null;
  readonly capabilityId: string | null;
}

/** Exact current App route and validation identities used to reject stale diagnostic reports. */
export interface AuthoringDiagnosticsSnapshotIdentity {
  readonly projectId: string;
  readonly surfaceId: string;
  readonly documentFingerprint: string;
  readonly catalogSetFingerprint: string;
}

/** Callback-free rendered identity index owned by one exact App route. */
export interface AuthoringRenderedDiagnosticsSnapshot {
  readonly projectId: string;
  readonly surfaceId: string;
  readonly diagnosticIndex: RuntimeReactDiagnosticIndex;
}

/** One explicitly mapped Source occurrence that diagnostics UI may make selectable. */
export interface AuthoringDiagnosticOccurrence {
  readonly diagnosticIndex: number;
  /** Opaque snapshot-bound key that must be re-admitted from the current ready view model. */
  readonly selectionKey: string;
  readonly kind: "node" | "behavior";
  readonly projectId: string;
  readonly surfaceId: string;
  readonly subjectId: string;
  readonly occurrencePointer: JsonPointer;
  readonly previewStatus: "materialized" | "invalid-placeholder";
  readonly runtimeNodeIds: readonly string[];
}

/** One visible validation diagnostic in the Validator's original deterministic order. */
export interface AuthoringDiagnosticView {
  readonly index: number;
  readonly code: string;
  readonly message: string;
  readonly pointer: JsonPointer | null;
  readonly context: AuthoringVisibleContext | null;
  readonly linkStatus: "linked" | "outside-route" | "unmapped";
  readonly occurrences: readonly AuthoringDiagnosticOccurrence[];
}

/** Visible inert metadata for dynamic validation work that remains after static validation. */
export interface AuthoringValidationObligationView {
  readonly index: number;
  readonly kind: string;
  readonly pointer: JsonPointer;
  readonly context: AuthoringVisibleContext;
}

/** Complete callback-free diagnostics projection for one exact current authoring snapshot. */
export interface AuthoringDiagnosticsViewModel {
  readonly route: Readonly<{ readonly projectId: string; readonly surfaceId: string }>;
  readonly documentFingerprint: string;
  readonly catalogSetFingerprint: string;
  readonly valid: boolean;
  readonly diagnostics: readonly AuthoringDiagnosticView[];
  readonly obligations: readonly AuthoringValidationObligationView[];
}

/** Closed fail-closed reason why no diagnostic navigation authority was returned. */
export type AuthoringDiagnosticsProjectionRejectionReason =
  | "invalid-report"
  | "invalid-snapshot"
  | "runtime-index-mismatch"
  | "stale-rendered-snapshot"
  | "stale-validation-report";

/** All-or-nothing projection result for one current diagnostics view model. */
export type AuthoringDiagnosticsViewModelResult =
  | Readonly<{ readonly status: "ready"; readonly model: AuthoringDiagnosticsViewModel }>
  | Readonly<{
      readonly status: "rejected";
      readonly reason: AuthoringDiagnosticsProjectionRejectionReason;
    }>;

interface CapturedDiagnostic {
  readonly code: string;
  readonly message: string;
  readonly pointer: JsonPointer | null;
  readonly context: AuthoringVisibleContext | null;
}

interface MappingIndex {
  readonly byDiagnosticIndex: ReadonlyMap<number, DesenEditorInvalidSubjectMapping>;
  readonly unmappedIndexes: ReadonlySet<number>;
}

type RuntimeIdentityResult =
  | Readonly<{ readonly ok: true; readonly runtimeNodeIds: readonly string[] }>
  | Readonly<{ readonly ok: false }>;

const EMPTY_RUNTIME_NODE_IDS = Object.freeze([]) as readonly string[];

function rejected(
  reason: AuthoringDiagnosticsProjectionRejectionReason,
): AuthoringDiagnosticsViewModelResult {
  return Object.freeze({ status: "rejected", reason });
}

function isNonEmptyText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function captureContext(value: unknown, required: boolean): AuthoringVisibleContext | null | false {
  if (value === undefined) return required ? false : null;
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;

  const input = value as Readonly<Record<string, unknown>>;
  const documentId = input.documentId;
  const surfaceId = input.surfaceId;
  const capabilityId = input.capabilityId;
  if (
    (documentId !== undefined && !isNonEmptyText(documentId)) ||
    (surfaceId !== undefined && !isNonEmptyText(surfaceId)) ||
    (capabilityId !== undefined && !isNonEmptyText(capabilityId))
  ) {
    return false;
  }

  let subject: AuthoringVisibleSubject | null = null;
  if (input.subject !== undefined) {
    if (
      typeof input.subject !== "object" ||
      input.subject === null ||
      Array.isArray(input.subject)
    ) {
      return false;
    }
    const candidate = input.subject as Readonly<Record<string, unknown>>;
    if (
      (candidate.kind !== "node" && candidate.kind !== "behavior") ||
      !isNonEmptyText(candidate.id)
    ) {
      return false;
    }
    subject = Object.freeze({ kind: candidate.kind, id: candidate.id });
  }

  return Object.freeze({
    documentId: documentId ?? null,
    surfaceId: surfaceId ?? null,
    subject,
    capabilityId: capabilityId ?? null,
  }) as AuthoringVisibleContext;
}

function captureDiagnostics(
  report: DesenEditorContinuousValidationReport,
): readonly CapturedDiagnostic[] | undefined {
  if (!Array.isArray(report.diagnostics)) return undefined;
  const diagnostics: CapturedDiagnostic[] = [];
  for (const diagnostic of report.diagnostics) {
    if (
      typeof diagnostic !== "object" ||
      diagnostic === null ||
      !isNonEmptyText(diagnostic.code) ||
      !isNonEmptyText(diagnostic.message) ||
      (diagnostic.pointer !== undefined && !isJsonPointer(diagnostic.pointer))
    ) {
      return undefined;
    }
    const context = captureContext(diagnostic.context, false);
    if (context === false) return undefined;
    diagnostics.push(
      Object.freeze({
        code: diagnostic.code,
        message: diagnostic.message,
        pointer: diagnostic.pointer ?? null,
        context,
      }),
    );
  }
  return Object.freeze(diagnostics);
}

function mappingMatchesDiagnostic(
  mapping: DesenEditorInvalidSubjectMapping,
  diagnostic: CapturedDiagnostic,
): boolean {
  return (
    diagnostic.context?.surfaceId === mapping.surfaceId &&
    diagnostic.context.subject?.kind === mapping.subject.kind &&
    diagnostic.context.subject.id === mapping.subject.id
  );
}

function captureMappingIndex(
  report: DesenEditorContinuousValidationReport,
  diagnostics: readonly CapturedDiagnostic[],
): MappingIndex | undefined {
  if (!Array.isArray(report.invalidSubjects) || !Array.isArray(report.unmappedDiagnosticIndexes)) {
    return undefined;
  }
  const byDiagnosticIndex = new Map<number, DesenEditorInvalidSubjectMapping>();
  for (const mapping of report.invalidSubjects) {
    if (
      typeof mapping !== "object" ||
      mapping === null ||
      !isNonEmptyText(mapping.surfaceId) ||
      (mapping.subject.kind !== "node" && mapping.subject.kind !== "behavior") ||
      !isNonEmptyText(mapping.subject.id) ||
      !Array.isArray(mapping.diagnosticIndexes) ||
      !Array.isArray(mapping.occurrencePointers) ||
      mapping.occurrencePointers.length === 0 ||
      !mapping.occurrencePointers.every(isJsonPointer)
    ) {
      return undefined;
    }
    for (const diagnosticIndex of mapping.diagnosticIndexes) {
      const diagnostic = diagnostics[diagnosticIndex];
      if (
        !Number.isSafeInteger(diagnosticIndex) ||
        diagnosticIndex < 0 ||
        diagnostic === undefined ||
        byDiagnosticIndex.has(diagnosticIndex) ||
        !mappingMatchesDiagnostic(mapping, diagnostic)
      ) {
        return undefined;
      }
      byDiagnosticIndex.set(diagnosticIndex, mapping);
    }
  }

  const unmappedIndexes = new Set<number>();
  for (const diagnosticIndex of report.unmappedDiagnosticIndexes) {
    if (
      !Number.isSafeInteger(diagnosticIndex) ||
      diagnosticIndex < 0 ||
      diagnostics[diagnosticIndex] === undefined ||
      byDiagnosticIndex.has(diagnosticIndex) ||
      unmappedIndexes.has(diagnosticIndex)
    ) {
      return undefined;
    }
    unmappedIndexes.add(diagnosticIndex);
  }
  if (byDiagnosticIndex.size + unmappedIndexes.size !== diagnostics.length) return undefined;
  return { byDiagnosticIndex, unmappedIndexes };
}

function runtimeIdentities(
  mapping: DesenEditorInvalidSubjectMapping,
  index: RuntimeReactDiagnosticIndex,
): RuntimeIdentityResult {
  const runtimeNodeIds =
    mapping.subject.kind === "node"
      ? index.runtimeNodeIdsBySourceNodeId[mapping.subject.id]
      : index.runtimeNodeIdsByBehaviorId[mapping.subject.id];
  if (runtimeNodeIds === undefined || runtimeNodeIds.length === 0) {
    return Object.freeze({ ok: true, runtimeNodeIds: EMPTY_RUNTIME_NODE_IDS });
  }

  const matchingRuntimeNodeIds: string[] = [];
  for (const runtimeNodeId of runtimeNodeIds) {
    const entry = index.byRuntimeNodeId[runtimeNodeId];
    if (entry === undefined) return Object.freeze({ ok: false });
    if (mapping.subject.kind === "node") {
      if (entry.sourceNodeId !== mapping.subject.id) return Object.freeze({ ok: false });
      if (entry.kind === "component") matchingRuntimeNodeIds.push(runtimeNodeId);
      continue;
    }
    if (entry.kind !== "behavior" || entry.behaviorId !== mapping.subject.id) {
      return Object.freeze({ ok: false });
    }
    matchingRuntimeNodeIds.push(runtimeNodeId);
  }
  if (mapping.subject.kind === "node" && matchingRuntimeNodeIds.length === 0) {
    return Object.freeze({ ok: false });
  }
  return Object.freeze({
    ok: true,
    runtimeNodeIds: Object.freeze(matchingRuntimeNodeIds),
  });
}

function captureObligations(
  report: DesenEditorContinuousValidationReport,
): readonly AuthoringValidationObligationView[] | undefined {
  if (!Array.isArray(report.obligations)) return undefined;
  const obligations: AuthoringValidationObligationView[] = [];
  for (const [index, obligation] of report.obligations.entries()) {
    if (
      typeof obligation !== "object" ||
      obligation === null ||
      !isNonEmptyText(obligation.kind) ||
      !isJsonPointer(obligation.pointer)
    ) {
      return undefined;
    }
    const context = captureContext(obligation.context, true);
    if (context === false || context === null) return undefined;
    obligations.push(
      Object.freeze({ index, kind: obligation.kind, pointer: obligation.pointer, context }),
    );
  }
  return Object.freeze(obligations);
}

function exactSnapshot(snapshot: AuthoringDiagnosticsSnapshotIdentity): boolean {
  return (
    isNonEmptyText(snapshot.projectId) &&
    isNonEmptyText(snapshot.surfaceId) &&
    isSha256Digest(snapshot.documentFingerprint) &&
    isSha256Digest(snapshot.catalogSetFingerprint)
  );
}

function occurrenceSelectionKey(
  snapshot: AuthoringDiagnosticsSnapshotIdentity,
  diagnosticIndex: number,
  mapping: DesenEditorInvalidSubjectMapping,
  occurrencePointer: JsonPointer,
): string {
  return JSON.stringify([
    snapshot.documentFingerprint,
    snapshot.catalogSetFingerprint,
    snapshot.projectId,
    snapshot.surfaceId,
    diagnosticIndex,
    mapping.subject.kind,
    mapping.subject.id,
    occurrencePointer,
  ]);
}

/**
 * Projects a current continuous-validation report into inert diagnostics and selectable targets.
 *
 * @remarks The report must match both exact candidate fingerprints; rendered identities are
 * fenced separately by the supplied App route. Only `invalidSubjects` may create a target;
 * diagnostic text and pointers remain presentation metadata. Missing runtime identities become
 * selectable invalid placeholders, while stale routes or inconsistent runtime kinds return no
 * partial view model. Dynamic obligations are copied as visible callback-free metadata and are
 * never resolved or executed.
 */
export function projectAuthoringDiagnostics(
  report: DesenEditorContinuousValidationReport,
  snapshot: AuthoringDiagnosticsSnapshotIdentity,
  rendered?: AuthoringRenderedDiagnosticsSnapshot,
): AuthoringDiagnosticsViewModelResult {
  if (!exactSnapshot(snapshot)) return rejected("invalid-snapshot");
  if (
    typeof report.valid !== "boolean" ||
    !isSha256Digest(report.documentFingerprint) ||
    !isSha256Digest(report.catalogSetFingerprint)
  ) {
    return rejected("invalid-report");
  }
  if (
    report.documentFingerprint !== snapshot.documentFingerprint ||
    report.catalogSetFingerprint !== snapshot.catalogSetFingerprint
  ) {
    return rejected("stale-validation-report");
  }
  if (rendered !== undefined) {
    if (
      !isNonEmptyText(rendered.projectId) ||
      !isNonEmptyText(rendered.surfaceId) ||
      rendered.projectId !== snapshot.projectId ||
      rendered.surfaceId !== snapshot.surfaceId
    ) {
      return rejected("stale-rendered-snapshot");
    }
  }

  const diagnostics = captureDiagnostics(report);
  const obligations = captureObligations(report);
  if (diagnostics === undefined || obligations === undefined) return rejected("invalid-report");
  const mappings = captureMappingIndex(report, diagnostics);
  if (mappings === undefined) return rejected("invalid-report");

  const diagnosticViews: AuthoringDiagnosticView[] = [];
  for (const [index, diagnostic] of diagnostics.entries()) {
    const mapping = mappings.byDiagnosticIndex.get(index);
    if (mapping === undefined) {
      diagnosticViews.push(
        Object.freeze({
          ...diagnostic,
          index,
          linkStatus: "unmapped",
          occurrences: Object.freeze([]),
        }),
      );
      continue;
    }
    if (mapping.surfaceId !== snapshot.surfaceId) {
      diagnosticViews.push(
        Object.freeze({
          ...diagnostic,
          index,
          linkStatus: "outside-route",
          occurrences: Object.freeze([]),
        }),
      );
      continue;
    }

    const runtime =
      rendered === undefined
        ? Object.freeze({ ok: true as const, runtimeNodeIds: EMPTY_RUNTIME_NODE_IDS })
        : runtimeIdentities(mapping, rendered.diagnosticIndex);
    if (!runtime.ok) return rejected("runtime-index-mismatch");
    const exactRuntimeIds =
      mapping.occurrencePointers.length === 1 ? runtime.runtimeNodeIds : EMPTY_RUNTIME_NODE_IDS;
    const occurrences = Object.freeze(
      mapping.occurrencePointers.map((occurrencePointer) =>
        Object.freeze({
          diagnosticIndex: index,
          selectionKey: occurrenceSelectionKey(snapshot, index, mapping, occurrencePointer),
          kind: mapping.subject.kind,
          projectId: snapshot.projectId,
          surfaceId: snapshot.surfaceId,
          subjectId: mapping.subject.id,
          occurrencePointer,
          previewStatus: exactRuntimeIds.length === 0 ? "invalid-placeholder" : "materialized",
          runtimeNodeIds: exactRuntimeIds,
        }),
      ),
    );
    diagnosticViews.push(
      Object.freeze({ ...diagnostic, index, linkStatus: "linked", occurrences }),
    );
  }

  const model: AuthoringDiagnosticsViewModel = Object.freeze({
    route: Object.freeze({ projectId: snapshot.projectId, surfaceId: snapshot.surfaceId }),
    documentFingerprint: snapshot.documentFingerprint,
    catalogSetFingerprint: snapshot.catalogSetFingerprint,
    valid: report.valid,
    diagnostics: Object.freeze(diagnosticViews),
    obligations,
  });
  return Object.freeze({ status: "ready", model });
}
