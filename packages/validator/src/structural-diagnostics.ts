import { appendJsonPointer, createCoreDiagnostic } from "@desen/protocol";

import { appendInstancePath, compareText, stringParameter } from "./validation-internals.js";

import type { DesenCoreDiagnostic, JsonPointer } from "@desen/protocol";
import type { AjvValidationError } from "./validation-internals.js";

/** The only core diagnostics owned by structural validation in M02-T06. */
export type StructuralDiagnosticCode =
  "SCHEMA_INVALID" | "UNKNOWN_CORE_FIELD" | "UNSUPPORTED_PROTOCOL";

/** A frozen structural diagnostic produced by this package. */
export type StructuralDiagnostic = Readonly<DesenCoreDiagnostic<StructuralDiagnosticCode>>;

type DiagnosticMode = "root" | "embedded";

function offendingProperty(error: AjvValidationError): string | undefined {
  if (typeof error.propertyName === "string") return error.propertyName;
  return (
    stringParameter(error, "additionalProperty") ??
    stringParameter(error, "missingProperty") ??
    stringParameter(error, "propertyName")
  );
}

function pointerForError(error: AjvValidationError, base: JsonPointer): JsonPointer {
  const instancePointer = appendInstancePath(base, error.instancePath);
  const property = offendingProperty(error);
  return property === undefined ? instancePointer : appendJsonPointer(instancePointer, property);
}

/** Converts one generated-validator error into a safe, protocol-owned diagnostic. */
export function diagnosticFromAjvError(
  error: AjvValidationError,
  base: JsonPointer,
  mode: DiagnosticMode,
): StructuralDiagnostic {
  const pointer = pointerForError(error, base);

  if (mode === "root" && error.keyword === "additionalProperties") {
    return createCoreDiagnostic({
      code: "UNKNOWN_CORE_FIELD",
      message: "A closed DESEN core object contains an unknown field.",
      pointer,
    });
  }

  return createCoreDiagnostic({
    code: "SCHEMA_INVALID",
    message:
      mode === "root"
        ? `The document violates its ${error.keyword} schema constraint.`
        : `An embedded schema violates its Draft 2020-12 ${error.keyword} constraint.`,
    pointer,
  });
}

/** Creates the activation diagnostic for an explicitly unsupported string protocol version. */
export function unsupportedProtocolDiagnostic(pointer: JsonPointer): StructuralDiagnostic {
  return createCoreDiagnostic({
    code: "UNSUPPORTED_PROTOCOL",
    message: "This validator supports DESEN protocol version 0.1.0.",
    pointer,
  });
}

/** Creates a generic schema diagnostic without exposing caller-controlled values. */
export function schemaDiagnostic(message: string, pointer: JsonPointer): StructuralDiagnostic {
  return createCoreDiagnostic({ code: "SCHEMA_INVALID", message, pointer });
}

/** Sorts and de-duplicates diagnostics independently of Ajv's internal error order. */
export function normalizeDiagnostics(
  diagnostics: readonly StructuralDiagnostic[],
): readonly StructuralDiagnostic[] {
  const ordered = [...diagnostics].sort((left, right) => {
    const pointerOrder = compareText(left.pointer ?? "", right.pointer ?? "");
    if (pointerOrder !== 0) return pointerOrder;
    const codeOrder = compareText(left.code, right.code);
    return codeOrder !== 0 ? codeOrder : compareText(left.message, right.message);
  });

  const unique: StructuralDiagnostic[] = [];
  let previousKey: string | undefined;
  for (const diagnostic of ordered) {
    const key = `${diagnostic.pointer ?? "\u0000"}\u0000${diagnostic.code}`;
    if (key !== previousKey) unique.push(diagnostic);
    previousKey = key;
  }
  return Object.freeze(unique);
}
