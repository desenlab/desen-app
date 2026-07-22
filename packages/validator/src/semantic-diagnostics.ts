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

/** Project-owned code for an internally contradictory component capability contract. */
export const INVALID_COMPONENT_CONTRACT_CODE =
  "run.desen.validator/INVALID_COMPONENT_CONTRACT" as const;

/** Project-owned code for an unusable behavior, event, or command catalog contract. */
export const INVALID_INTERACTION_CONTRACT_CODE =
  "run.desen.validator/INVALID_INTERACTION_CONTRACT" as const;

/** Project-owned code for a statically incoherent state or binding contract. */
export const INVALID_BINDING_CONTRACT_CODE =
  "run.desen.validator/INVALID_BINDING_CONTRACT" as const;

/** Project-owned code for an unusable resource, operation, or action execution contract. */
export const INVALID_EXECUTION_CONTRACT_CODE =
  "run.desen.validator/INVALID_EXECUTION_CONTRACT" as const;

/** Namespaced diagnostics introduced by the cumulative semantic validation stages. */
export type DesenSemanticExtensionDiagnosticCode =
  | typeof INVALID_SEMVER_CODE
  | typeof CATALOG_REQUIREMENT_MISMATCH_CODE
  | typeof INVALID_COMPONENT_CONTRACT_CODE
  | typeof INVALID_INTERACTION_CONTRACT_CODE
  | typeof INVALID_BINDING_CONTRACT_CODE
  | typeof INVALID_EXECUTION_CONTRACT_CODE;

/** Any core or project-owned diagnostic returned by cumulative semantic validation stages. */
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

/** Creates the safe project diagnostic used for contradictory component catalog contracts. */
export function invalidComponentContractDiagnostic(
  pointer: JsonPointer,
  context?: DesenDiagnosticContext,
): Readonly<DesenDiagnostic<typeof INVALID_COMPONENT_CONTRACT_CODE>> {
  return extensionDiagnostic(
    INVALID_COMPONENT_CONTRACT_CODE,
    "The component catalog set has not passed a coherent component-contract boundary.",
    pointer,
    context,
  );
}

/** Creates the safe project diagnostic used for unusable interaction catalog contracts. */
export function invalidInteractionContractDiagnostic(
  pointer: JsonPointer,
  context?: DesenDiagnosticContext,
): Readonly<DesenDiagnostic<typeof INVALID_INTERACTION_CONTRACT_CODE>> {
  return extensionDiagnostic(
    INVALID_INTERACTION_CONTRACT_CODE,
    "The catalog set has not passed a coherent behavior, event, and command contract boundary.",
    pointer,
    context,
  );
}

/** Creates the safe project diagnostic used for statically incoherent state or binding data. */
export function invalidBindingContractDiagnostic(
  pointer: JsonPointer,
  context?: DesenDiagnosticContext,
): Readonly<DesenDiagnostic<typeof INVALID_BINDING_CONTRACT_CODE>> {
  return extensionDiagnostic(
    INVALID_BINDING_CONTRACT_CODE,
    "A state declaration or statically decidable binding contract is incoherent.",
    pointer,
    context,
  );
}

/** Creates the safe project diagnostic used for incoherent executable capability contracts. */
export function invalidExecutionContractDiagnostic(
  pointer: JsonPointer,
  context?: DesenDiagnosticContext,
): Readonly<DesenDiagnostic<typeof INVALID_EXECUTION_CONTRACT_CODE>> {
  return extensionDiagnostic(
    INVALID_EXECUTION_CONTRACT_CODE,
    "A resource, operation, or action contract cannot be validated safely and coherently.",
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
