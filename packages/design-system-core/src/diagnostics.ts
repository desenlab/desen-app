/** Stable project-model diagnostic codes emitted by Design System Core. */
export type EditableProjectDiagnosticCode =
  | "INVALID_PROJECT"
  | "INVALID_SOURCE"
  | "UNSAFE_PROJECT_VALUE"
  | "PROJECT_LIMIT_EXCEEDED"
  | "UNSUPPORTED_PROJECT_VERSION";

/** One immutable, location-bearing editable-project admission diagnostic. */
export interface EditableProjectDiagnostic {
  /** Stable code suitable for machine branching. */
  readonly code: EditableProjectDiagnosticCode;
  /** JSON Pointer-like location of the rejected value. */
  readonly pointer: string;
  /** Bounded human-readable explanation. */
  readonly message: string;
}

/** Creates one frozen editable-project diagnostic. */
export function createEditableProjectDiagnostic(
  code: EditableProjectDiagnosticCode,
  pointer: string,
  message: string,
): EditableProjectDiagnostic {
  return Object.freeze({ code, pointer, message });
}
