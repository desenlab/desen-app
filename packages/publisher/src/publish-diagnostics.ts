import type { DesenCoreDiagnostic, DesenDiagnostic, DesenDiagnosticContext } from "@desen/protocol";

import { PUBLISH_PIPELINE_STAGES } from "./publish-result.js";

import type {
  PublishDiagnostic,
  PublishErrorDiagnostic,
  PublishFailure,
  PublishExtensionDiagnosticCode,
  PublishPipelineStage,
} from "./publish-result.js";

const STAGE_ORDINAL = new Map<PublishPipelineStage, number>(
  PUBLISH_PIPELINE_STAGES.map((stage, index) => [stage, index]),
);

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function immutableContext(
  context: Readonly<DesenDiagnosticContext> | undefined,
): Readonly<DesenDiagnosticContext> | undefined {
  if (context === undefined) return undefined;
  const subject =
    context.subject === undefined
      ? undefined
      : Object.freeze({ kind: context.subject.kind, id: context.subject.id });
  return Object.freeze({
    ...(context.documentId === undefined ? {} : { documentId: context.documentId }),
    ...(context.surfaceId === undefined ? {} : { surfaceId: context.surfaceId }),
    ...(subject === undefined ? {} : { subject }),
    ...(context.capabilityId === undefined ? {} : { capabilityId: context.capabilityId }),
  });
}

/**
 * Adds blocking Publisher stage metadata without changing diagnostic classification or identity.
 *
 * @internal Only diagnostics created by DESEN packages may enter this helper. It is intentionally
 * not part of the package root API. Core and Validator diagnostics are always publication errors;
 * a later task must introduce a dedicated Publisher-owned warning code and warning constructor
 * instead of relabeling a failure code.
 */
export function annotatePublishErrorDiagnostic(
  diagnostic:
    Readonly<DesenCoreDiagnostic> | Readonly<DesenDiagnostic<PublishExtensionDiagnosticCode>>,
  stage: PublishPipelineStage,
): PublishErrorDiagnostic {
  const context = immutableContext(diagnostic.context);
  return Object.freeze({
    ...diagnostic,
    ...(context === undefined ? {} : { context }),
    stage,
    severity: "error",
  }) as PublishErrorDiagnostic;
}

function diagnosticKey(diagnostic: PublishDiagnostic): string {
  return JSON.stringify([
    diagnostic.severity,
    diagnostic.stage,
    diagnostic.pointer ?? null,
    diagnostic.code,
    diagnostic.context?.documentId ?? null,
    diagnostic.context?.surfaceId ?? null,
    diagnostic.context?.subject?.kind ?? null,
    diagnostic.context?.subject?.id ?? null,
    diagnostic.context?.capabilityId ?? null,
  ]);
}

/**
 * Sorts and de-duplicates trusted Publisher diagnostics without mutating caller-owned arrays.
 *
 * @internal Errors sort before warnings so a rejected result can safely expose a non-empty tuple.
 * Within each category, normative pipeline order precedes JSON Pointer, code, context, and message.
 */
export function normalizePublishDiagnostics(
  diagnostics: readonly PublishDiagnostic[],
): readonly PublishDiagnostic[] {
  const ordered = [...diagnostics].sort((left, right) => {
    if (left.severity !== right.severity) return left.severity === "error" ? -1 : 1;
    const stageOrder =
      (STAGE_ORDINAL.get(left.stage) ?? Number.MAX_SAFE_INTEGER) -
      (STAGE_ORDINAL.get(right.stage) ?? Number.MAX_SAFE_INTEGER);
    if (stageOrder !== 0) return stageOrder;
    const pointerOrder = compareText(left.pointer ?? "", right.pointer ?? "");
    if (pointerOrder !== 0) return pointerOrder;
    const codeOrder = compareText(left.code, right.code);
    if (codeOrder !== 0) return codeOrder;

    const leftContext = left.context;
    const rightContext = right.context;
    const contextPairs = [
      [leftContext?.documentId, rightContext?.documentId],
      [leftContext?.surfaceId, rightContext?.surfaceId],
      [leftContext?.subject?.kind, rightContext?.subject?.kind],
      [leftContext?.subject?.id, rightContext?.subject?.id],
      [leftContext?.capabilityId, rightContext?.capabilityId],
    ] as const;
    for (const [leftValue, rightValue] of contextPairs) {
      const contextOrder = compareText(leftValue ?? "", rightValue ?? "");
      if (contextOrder !== 0) return contextOrder;
    }
    return compareText(left.message, right.message);
  });

  const unique: PublishDiagnostic[] = [];
  let previousKey: string | undefined;
  for (const diagnostic of ordered) {
    const key = diagnosticKey(diagnostic);
    if (key !== previousKey) unique.push(diagnostic);
    previousKey = key;
  }
  return Object.freeze(unique);
}

/**
 * Creates the only package-private terminal failure envelope used by publication stages.
 *
 * @internal Diagnostics are normalized first. The first blocking diagnostic derives the public
 * failure stage; every blocking diagnostic must belong to that same stopped stage. Empty,
 * warning-only, or cross-stage error collections are programmer errors and never become a
 * misleading public result.
 */
export function createPublishFailure(diagnostics: readonly PublishDiagnostic[]): PublishFailure {
  const normalized = normalizePublishDiagnostics(diagnostics);
  const first = normalized[0];
  if (first === undefined || first.severity !== "error") {
    throw new TypeError("A rejected publication requires at least one blocking diagnostic.");
  }
  if (
    normalized.some(
      (diagnostic) => diagnostic.severity === "error" && diagnostic.stage !== first.stage,
    )
  ) {
    throw new TypeError("A rejected publication cannot combine errors from different stages.");
  }
  return Object.freeze({
    ok: false,
    stage: first.stage,
    diagnostics: normalized as readonly [PublishErrorDiagnostic, ...PublishDiagnostic[]],
  });
}
