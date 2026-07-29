import type {
  DesenCoreDiagnostic,
  DesenDiagnostic,
  DesenDiagnosticContext,
  JsonPointer,
} from "@desen/protocol";

import { DEPRECATED_CAPABILITY_CODE, PUBLISH_PIPELINE_STAGES } from "./publish-result.js";

import type {
  PublishDiagnostic,
  PublishErrorDiagnostic,
  PublishFailure,
  PublishExtensionDiagnosticCode,
  PublishPipelineStage,
  PublishWarningDiagnostic,
} from "./publish-result.js";

const STAGE_ORDINAL = new Map<PublishPipelineStage, number>(
  PUBLISH_PIPELINE_STAGES.map((stage, index) => [stage, index]),
);

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function ownDataValue<Value>(object: object, key: PropertyKey): Value | undefined {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  return descriptor !== undefined && "value" in descriptor
    ? (descriptor.value as Value)
    : undefined;
}

function immutableContext(
  context: Readonly<DesenDiagnosticContext>,
): Readonly<DesenDiagnosticContext>;
function immutableContext(
  context: Readonly<DesenDiagnosticContext> | undefined,
): Readonly<DesenDiagnosticContext> | undefined;
function immutableContext(
  context: Readonly<DesenDiagnosticContext> | undefined,
): Readonly<DesenDiagnosticContext> | undefined {
  if (context === undefined) return undefined;
  const documentId = ownDataValue<string>(context, "documentId");
  const surfaceId = ownDataValue<string>(context, "surfaceId");
  const capabilityId = ownDataValue<string>(context, "capabilityId");
  const sourceSubject = ownDataValue<NonNullable<DesenDiagnosticContext["subject"]>>(
    context,
    "subject",
  );
  const subjectKind =
    sourceSubject === undefined
      ? undefined
      : ownDataValue<"behavior" | "node">(sourceSubject, "kind");
  const subjectId =
    sourceSubject === undefined ? undefined : ownDataValue<string>(sourceSubject, "id");
  const subject =
    subjectKind === undefined || subjectId === undefined
      ? undefined
      : Object.freeze({ kind: subjectKind, id: subjectId });
  return Object.freeze({
    ...(documentId === undefined ? {} : { documentId }),
    ...(surfaceId === undefined ? {} : { surfaceId }),
    ...(subject === undefined ? {} : { subject }),
    ...(capabilityId === undefined ? {} : { capabilityId }),
  });
}

/**
 * Adds blocking Publisher stage metadata without changing diagnostic classification or identity.
 *
 * @internal Only diagnostics created by DESEN packages may enter this helper. It is intentionally
 * not part of the package root API. Core and Validator diagnostics are always publication errors;
 * Publisher warnings use dedicated project-owned codes and constructors instead of relabeling a
 * failure diagnostic.
 */
export function annotatePublishErrorDiagnostic(
  diagnostic:
    Readonly<DesenCoreDiagnostic> | Readonly<DesenDiagnostic<PublishExtensionDiagnosticCode>>,
  stage: PublishPipelineStage,
): PublishErrorDiagnostic {
  const context = immutableContext(
    ownDataValue<Readonly<DesenDiagnosticContext>>(diagnostic, "context"),
  );
  return Object.freeze({
    ...diagnostic,
    ...(context === undefined ? {} : { context }),
    stage,
    severity: "error",
  }) as PublishErrorDiagnostic;
}

/**
 * Creates the Publisher's fixed, non-blocking deprecated-capability warning.
 *
 * @internal The caller supplies only an authenticated Source usage pointer and its validated
 * identity context. Catalog-controlled deprecation text and replacement hints never cross this
 * boundary, so warnings cannot disclose arbitrary package prose or imply automatic substitution.
 */
export function createDeprecatedCapabilityWarning(
  pointer: JsonPointer,
  context: Readonly<DesenDiagnosticContext>,
): PublishWarningDiagnostic {
  return Object.freeze({
    code: DEPRECATED_CAPABILITY_CODE,
    message: "Source data uses a deprecated Catalog capability.",
    pointer,
    context: immutableContext(context),
    stage: "capability-contracts",
    severity: "warning",
  });
}

function diagnosticKey(diagnostic: PublishDiagnostic): string {
  const context = ownDataValue<Readonly<DesenDiagnosticContext>>(diagnostic, "context");
  const subject =
    context === undefined
      ? undefined
      : ownDataValue<NonNullable<DesenDiagnosticContext["subject"]>>(context, "subject");
  return JSON.stringify([
    diagnostic.severity,
    diagnostic.stage,
    ownDataValue<string>(diagnostic, "pointer") ?? null,
    diagnostic.code,
    context === undefined ? null : (ownDataValue<string>(context, "documentId") ?? null),
    context === undefined ? null : (ownDataValue<string>(context, "surfaceId") ?? null),
    subject === undefined ? null : (ownDataValue<string>(subject, "kind") ?? null),
    subject === undefined ? null : (ownDataValue<string>(subject, "id") ?? null),
    context === undefined ? null : (ownDataValue<string>(context, "capabilityId") ?? null),
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
    const pointerOrder = compareText(
      ownDataValue<string>(left, "pointer") ?? "",
      ownDataValue<string>(right, "pointer") ?? "",
    );
    if (pointerOrder !== 0) return pointerOrder;
    const codeOrder = compareText(left.code, right.code);
    if (codeOrder !== 0) return codeOrder;

    const leftContext = ownDataValue<Readonly<DesenDiagnosticContext>>(left, "context");
    const rightContext = ownDataValue<Readonly<DesenDiagnosticContext>>(right, "context");
    const leftSubject =
      leftContext === undefined
        ? undefined
        : ownDataValue<NonNullable<DesenDiagnosticContext["subject"]>>(leftContext, "subject");
    const rightSubject =
      rightContext === undefined
        ? undefined
        : ownDataValue<NonNullable<DesenDiagnosticContext["subject"]>>(rightContext, "subject");
    const contextPairs = [
      [
        leftContext === undefined ? undefined : ownDataValue<string>(leftContext, "documentId"),
        rightContext === undefined ? undefined : ownDataValue<string>(rightContext, "documentId"),
      ],
      [
        leftContext === undefined ? undefined : ownDataValue<string>(leftContext, "surfaceId"),
        rightContext === undefined ? undefined : ownDataValue<string>(rightContext, "surfaceId"),
      ],
      [
        leftSubject === undefined ? undefined : ownDataValue<string>(leftSubject, "kind"),
        rightSubject === undefined ? undefined : ownDataValue<string>(rightSubject, "kind"),
      ],
      [
        leftSubject === undefined ? undefined : ownDataValue<string>(leftSubject, "id"),
        rightSubject === undefined ? undefined : ownDataValue<string>(rightSubject, "id"),
      ],
      [
        leftContext === undefined ? undefined : ownDataValue<string>(leftContext, "capabilityId"),
        rightContext === undefined ? undefined : ownDataValue<string>(rightContext, "capabilityId"),
      ],
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
