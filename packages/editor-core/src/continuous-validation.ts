import { appendJsonPointer, digestCanonicalJson } from "@desen/protocol";
import {
  validateDesenExecutionCatalogSet,
  validateDesenSourceExecutionContracts,
} from "@desen/validator";

import type { DesenDiagnosticSubject, JsonPointer } from "@desen/protocol";
import type {
  DesenExecutionContractObligation,
  DesenSemanticDiagnostic,
  DesenValidatedExecutionCatalogSet,
} from "@desen/validator";
import { createDesenEditorDocument } from "./source-document.js";
import type { DesenEditorDocument } from "./source-document.js";

const EMPTY_DIAGNOSTICS = Object.freeze([]) as readonly [];
const ROOT_POINTER = "" as JsonPointer;

/** One invalid source identity and every exact place where it occurs in the current document. */
export interface DesenEditorInvalidSubjectMapping {
  /** Stable surface map key supplied by the Validator diagnostic. */
  readonly surfaceId: string;
  /** Exact diagnostic subject; pointer text is never used to infer this identity. */
  readonly subject: Readonly<DesenDiagnosticSubject>;
  /** Indexes into the report's complete, unmodified diagnostic array. */
  readonly diagnosticIndexes: readonly number[];
  /** Every current occurrence of the exact surface-local subject identity. */
  readonly occurrencePointers: readonly JsonPointer[];
}

/** Immutable result of one synchronous continuous-validation pass. */
export interface DesenEditorContinuousValidationReport {
  /** True when no static Source execution-contract diagnostic exists. */
  readonly valid: boolean;
  /**
   * SHA-256 over the complete RFC 8785 Source, including root authoring metadata. `null` is the
   * controlled stale-input sentinel only when a runtime cast did not supply an editor document.
   */
  readonly documentFingerprint: string | null;
  /** Order-sensitive SHA-256 over the factory's immutable Catalog-set snapshot. */
  readonly catalogSetFingerprint: string;
  /** Complete deterministic cumulative Source diagnostics from the Validator. */
  readonly diagnostics: readonly DesenSemanticDiagnostic[];
  /** Complete dynamic validation work; obligations do not make this report invalid. */
  readonly obligations: readonly DesenExecutionContractObligation[];
  /** Diagnostic groups whose explicit subject exists in the current Source. */
  readonly invalidSubjects: readonly DesenEditorInvalidSubjectMapping[];
  /** Diagnostics that cannot be mapped from explicit surface and subject context alone. */
  readonly unmappedDiagnosticIndexes: readonly number[];
}

/** Pure synchronous validator bound to one independently snapshotted Catalog set. */
export interface DesenEditorContinuousValidator {
  /** Order-sensitive identity of the exact Catalog snapshot captured by the factory. */
  readonly catalogSetFingerprint: string;
  /** Validates one immutable direct editor Source without changing it or the Catalog snapshot. */
  readonly validate: (document: DesenEditorDocument) => DesenEditorContinuousValidationReport;
}

/** Successful creation of a Catalog-bound continuous validator. */
export interface DesenEditorContinuousValidatorCreationSuccess {
  readonly ok: true;
  readonly validator: DesenEditorContinuousValidator;
  readonly diagnostics: readonly [];
}

/** Catalog rejection with no partial validator authority. */
export interface DesenEditorContinuousValidatorCreationFailure {
  readonly ok: false;
  readonly diagnostics: readonly DesenSemanticDiagnostic[];
}

/** Controlled result of capturing and preparing a continuous-validation Catalog set. */
export type DesenEditorContinuousValidatorCreationResult =
  DesenEditorContinuousValidatorCreationSuccess | DesenEditorContinuousValidatorCreationFailure;

type DesenEditorSurface = DesenEditorDocument["surfaces"][string];
type DesenEditorNode = DesenEditorSurface["root"];
type DesenEditorBehavior = NonNullable<DesenEditorNode["behaviors"]>[number];

type SubjectOccurrenceWork =
  | Readonly<{
      kind: "node";
      value: DesenEditorNode;
      pointer: JsonPointer;
    }>
  | Readonly<{
      kind: "behavior";
      value: DesenEditorBehavior;
      pointer: JsonPointer;
    }>;

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function subjectKey(surfaceId: string, kind: "node" | "behavior", id: string): string {
  return JSON.stringify([surfaceId, kind, id]);
}

function appendPath(pointer: JsonPointer, ...segments: readonly (number | string)[]): JsonPointer {
  return segments.reduce<JsonPointer>(
    (current, segment) => appendJsonPointer(current, segment),
    pointer,
  );
}

function pushSlotChildren(
  stack: SubjectOccurrenceWork[],
  owner: DesenEditorNode | DesenEditorBehavior,
  pointer: JsonPointer,
): void {
  if (owner.slots === undefined) return;
  const slotNames = Object.keys(owner.slots).sort(compareText);
  for (let slotIndex = slotNames.length - 1; slotIndex >= 0; slotIndex -= 1) {
    const slotName = slotNames[slotIndex] as string;
    const children = owner.slots[slotName] ?? [];
    for (let childIndex = children.length - 1; childIndex >= 0; childIndex -= 1) {
      stack.push({
        kind: "node",
        value: children[childIndex] as DesenEditorNode,
        pointer: appendPath(pointer, "slots", slotName, childIndex),
      });
    }
  }
}

function sourceSubjectOccurrences(
  document: DesenEditorDocument,
): ReadonlyMap<string, readonly JsonPointer[]> {
  const mutableOccurrences = new Map<string, JsonPointer[]>();
  const surfaceIds = Object.keys(document.surfaces).sort(compareText);

  for (const surfaceId of surfaceIds) {
    const surface = document.surfaces[surfaceId];
    if (surface === undefined) continue;
    const stack: SubjectOccurrenceWork[] = [
      {
        kind: "node",
        value: surface.root,
        pointer: appendPath(ROOT_POINTER, "surfaces", surfaceId, "root"),
      },
    ];

    while (stack.length > 0) {
      const current = stack.pop() as SubjectOccurrenceWork;
      const key = subjectKey(surfaceId, current.kind, current.value.id);
      const existing = mutableOccurrences.get(key);
      if (existing === undefined) mutableOccurrences.set(key, [current.pointer]);
      else existing.push(current.pointer);

      pushSlotChildren(stack, current.value, current.pointer);
      if (current.kind === "node") {
        const behaviors = current.value.behaviors ?? [];
        for (let behaviorIndex = behaviors.length - 1; behaviorIndex >= 0; behaviorIndex -= 1) {
          stack.push({
            kind: "behavior",
            value: behaviors[behaviorIndex] as DesenEditorBehavior,
            pointer: appendPath(current.pointer, "behaviors", behaviorIndex),
          });
        }
      }
    }
  }

  return new Map(
    [...mutableOccurrences].map(([key, pointers]) => [key, Object.freeze([...pointers])]),
  );
}

function mapInvalidSubjects(
  document: DesenEditorDocument,
  diagnostics: readonly DesenSemanticDiagnostic[],
): Readonly<{
  invalidSubjects: readonly DesenEditorInvalidSubjectMapping[];
  unmappedDiagnosticIndexes: readonly number[];
}> {
  const occurrences = sourceSubjectOccurrences(document);
  const grouped = new Map<
    string,
    {
      readonly surfaceId: string;
      readonly subject: Readonly<DesenDiagnosticSubject>;
      readonly diagnosticIndexes: number[];
      readonly occurrencePointers: readonly JsonPointer[];
    }
  >();
  const unmappedDiagnosticIndexes: number[] = [];

  diagnostics.forEach((diagnostic, diagnosticIndex) => {
    const surfaceId = diagnostic.context?.surfaceId;
    const subject = diagnostic.context?.subject;
    if (surfaceId === undefined || subject === undefined) {
      unmappedDiagnosticIndexes.push(diagnosticIndex);
      return;
    }

    const key = subjectKey(surfaceId, subject.kind, subject.id);
    const occurrencePointers = occurrences.get(key);
    if (occurrencePointers === undefined || occurrencePointers.length === 0) {
      unmappedDiagnosticIndexes.push(diagnosticIndex);
      return;
    }

    const existing = grouped.get(key);
    if (existing !== undefined) {
      existing.diagnosticIndexes.push(diagnosticIndex);
      return;
    }
    grouped.set(key, {
      surfaceId,
      subject: Object.freeze({ kind: subject.kind, id: subject.id }),
      diagnosticIndexes: [diagnosticIndex],
      occurrencePointers,
    });
  });

  const invalidSubjects = [...grouped.values()]
    .sort((left, right) => {
      const surfaceOrder = compareText(left.surfaceId, right.surfaceId);
      if (surfaceOrder !== 0) return surfaceOrder;
      const kindOrder = compareText(left.subject.kind, right.subject.kind);
      return kindOrder !== 0 ? kindOrder : compareText(left.subject.id, right.subject.id);
    })
    .map((mapping) =>
      Object.freeze({
        surfaceId: mapping.surfaceId,
        subject: mapping.subject,
        diagnosticIndexes: Object.freeze([...mapping.diagnosticIndexes]),
        occurrencePointers: mapping.occurrencePointers,
      }),
    );

  return Object.freeze({
    invalidSubjects: Object.freeze(invalidSubjects),
    unmappedDiagnosticIndexes: Object.freeze(unmappedDiagnosticIndexes),
  });
}

function unmappedDiagnostics(diagnostics: readonly DesenSemanticDiagnostic[]): Readonly<{
  invalidSubjects: readonly DesenEditorInvalidSubjectMapping[];
  unmappedDiagnosticIndexes: readonly number[];
}> {
  return Object.freeze({
    invalidSubjects: Object.freeze([]),
    unmappedDiagnosticIndexes: Object.freeze(diagnostics.map((_, index) => index)),
  });
}

function createBoundValidator(
  catalogSet: DesenValidatedExecutionCatalogSet,
): DesenEditorContinuousValidator {
  const catalogSetFingerprint = digestCanonicalJson(catalogSet);
  return Object.freeze({
    catalogSetFingerprint,
    validate(document: DesenEditorDocument): DesenEditorContinuousValidationReport {
      const admission = createDesenEditorDocument(document);
      if (!admission.ok) {
        const mapped = unmappedDiagnostics(admission.diagnostics);
        return Object.freeze({
          valid: false,
          documentFingerprint: null,
          catalogSetFingerprint,
          diagnostics: admission.diagnostics,
          obligations: Object.freeze([]),
          invalidSubjects: mapped.invalidSubjects,
          unmappedDiagnosticIndexes: mapped.unmappedDiagnosticIndexes,
        });
      }

      const snapshot = admission.document;
      const validation = validateDesenSourceExecutionContracts(snapshot, catalogSet);
      const mapped = mapInvalidSubjects(snapshot, validation.diagnostics);
      return Object.freeze({
        valid: validation.valid,
        documentFingerprint: digestCanonicalJson(snapshot),
        catalogSetFingerprint,
        diagnostics: validation.diagnostics,
        obligations: validation.obligations,
        invalidSubjects: mapped.invalidSubjects,
        unmappedDiagnosticIndexes: mapped.unmappedDiagnosticIndexes,
      });
    },
  });
}

/**
 * Captures unknown Catalog data and creates one framework- and platform-neutral validator.
 *
 * @remarks Catalog input is independently snapshotted by the cumulative execution validator.
 * Validation is pure and synchronous: it performs no persistence, host I/O, adapter execution,
 * value resolution, retry, or pointer-based subject inference. Dynamic obligations remain a
 * complete later-validation handoff and therefore do not make an otherwise valid Source invalid.
 */
export function createDesenEditorContinuousValidator(
  catalogs: unknown,
): DesenEditorContinuousValidatorCreationResult {
  const validation = validateDesenExecutionCatalogSet(catalogs);
  if (!validation.valid) {
    return Object.freeze({ ok: false, diagnostics: validation.diagnostics });
  }

  return Object.freeze({
    ok: true,
    validator: createBoundValidator(validation.value),
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}
