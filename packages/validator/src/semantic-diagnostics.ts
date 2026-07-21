import { createCoreDiagnostic } from "@desen/protocol";

import { compareText } from "./validation-internals.js";

import type {
  CoreDiagnosticCode,
  DesenCoreDiagnostic,
  DesenDiagnostic,
  DesenDiagnosticContext,
  JsonPointer,
} from "@desen/protocol";

/** Project-owned code for an exact-version value that is not valid Semantic Versioning 2.0.0. */
export const INVALID_SEMVER_CODE = "run.desen.validator/INVALID_SEMVER" as const;

/** Project-owned code for a document/catalog-set identity mismatch. */
export const CATALOG_REQUIREMENT_MISMATCH_CODE =
  "run.desen.validator/CATALOG_REQUIREMENT_MISMATCH" as const;

/** Namespaced diagnostics introduced by the M02-T07 semantic foundation. */
export type DesenSemanticExtensionDiagnosticCode =
  typeof INVALID_SEMVER_CODE | typeof CATALOG_REQUIREMENT_MISMATCH_CODE;

/** Any core or project-owned diagnostic returned by semantic-foundation validation. */
export type DesenSemanticDiagnostic =
  | Readonly<DesenCoreDiagnostic<CoreDiagnosticCode>>
  | Readonly<DesenDiagnostic<DesenSemanticExtensionDiagnosticCode>>;

function immutableContext(
  context: DesenDiagnosticContext | undefined,
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

function extensionDiagnostic<Code extends DesenSemanticExtensionDiagnosticCode>(
  code: Code,
  message: string,
  pointer: JsonPointer,
  context?: DesenDiagnosticContext,
): Readonly<DesenDiagnostic<Code>> {
  const normalizedContext = immutableContext(context);
  return Object.freeze({
    code,
    message,
    pointer,
    ...(normalizedContext === undefined ? {} : { context: normalizedContext }),
  });
}

/** Creates the safe project diagnostic used for strict Semantic Versioning failures. */
export function invalidSemanticVersionDiagnostic(
  pointer: JsonPointer,
  context?: DesenDiagnosticContext,
): Readonly<DesenDiagnostic<typeof INVALID_SEMVER_CODE>> {
  return extensionDiagnostic(
    INVALID_SEMVER_CODE,
    "A catalog or package version is not an exact Semantic Versioning 2.0.0 value.",
    pointer,
    context,
  );
}

/** Creates the safe project diagnostic used when a catalog requirement is not exact. */
export function catalogRequirementMismatchDiagnostic(
  pointer: JsonPointer,
  context?: DesenDiagnosticContext,
): Readonly<DesenDiagnostic<typeof CATALOG_REQUIREMENT_MISMATCH_CODE>> {
  return extensionDiagnostic(
    CATALOG_REQUIREMENT_MISMATCH_CODE,
    "The document and trusted catalog set do not have an exact catalog requirement relationship.",
    pointer,
    context,
  );
}

/** Rebuilds a core diagnostic beneath a catalog-set array index without retaining caller data. */
export function prefixedCoreDiagnostic(
  diagnostic: Readonly<DesenCoreDiagnostic>,
  pointer: JsonPointer,
): Readonly<DesenCoreDiagnostic> {
  return createCoreDiagnostic({ code: diagnostic.code, message: diagnostic.message, pointer });
}

/** Sorts and de-duplicates mixed core and namespaced semantic diagnostics deterministically. */
export function normalizeSemanticDiagnostics(
  diagnostics: readonly DesenSemanticDiagnostic[],
): readonly DesenSemanticDiagnostic[] {
  const ordered = [...diagnostics].sort((left, right) => {
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

  const unique: DesenSemanticDiagnostic[] = [];
  let previousKey: string | undefined;
  for (const diagnostic of ordered) {
    const key = JSON.stringify([
      diagnostic.pointer ?? null,
      diagnostic.code,
      diagnostic.context?.documentId ?? null,
      diagnostic.context?.surfaceId ?? null,
      diagnostic.context?.subject?.kind ?? null,
      diagnostic.context?.subject?.id ?? null,
      diagnostic.context?.capabilityId ?? null,
    ]);
    if (key !== previousKey) unique.push(diagnostic);
    previousKey = key;
  }
  return Object.freeze(unique);
}
