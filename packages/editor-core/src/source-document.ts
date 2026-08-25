import { validateDesenSource } from "@desen/validator";

import type { DesenSource } from "@desen/protocol";
import type { DesenStructuralDiagnostic, ImmutableJson } from "@desen/validator";

const EMPTY_DIAGNOSTICS = Object.freeze([]) as readonly [];

/**
 * The direct, recursively immutable DESEN Source edited by the framework-neutral editor core.
 *
 * @remarks This type adds no wrapper tree, normalized projection, hidden node index, or executable
 * authority. Its root is the exact `desen.source` document model. Creation snapshots parsed JSON
 * values, so callers retain no mutation authority over the editor document.
 */
export type DesenEditorDocument = ImmutableJson<DesenSource>;

/** A structurally admitted direct Source snapshot ready for editor commands. */
export interface DesenEditorDocumentCreationSuccess {
  /** Confirms that a complete editor document is available. */
  readonly ok: true;
  /** Independent immutable Source snapshot; this value is the document model itself. */
  readonly document: DesenEditorDocument;
  /** Always empty when structural admission succeeds. */
  readonly diagnostics: readonly [];
}

/** A rejected Source candidate with no partial editor document. */
export interface DesenEditorDocumentCreationFailure {
  /** Confirms that no editor document was created. */
  readonly ok: false;
  /** Deterministic structural diagnostics from the frozen DESEN 0.1.0 validator. */
  readonly diagnostics: readonly DesenStructuralDiagnostic[];
}

/** Result of admitting an unknown value as the direct editor Source document. */
export type DesenEditorDocumentCreationResult =
  DesenEditorDocumentCreationSuccess | DesenEditorDocumentCreationFailure;

/**
 * Creates an independent immutable editor document from unknown inert JSON data.
 *
 * @remarks Admission enforces only frozen DESEN 0.1.0 Source and embedded-schema structure.
 * Catalog-backed semantics and continuously changing editor diagnostics remain separate later
 * responsibilities. A failure exposes no partial Source snapshot.
 */
export function createDesenEditorDocument(input: unknown): DesenEditorDocumentCreationResult {
  const validation = validateDesenSource(input);
  if (!validation.valid) {
    return Object.freeze({ ok: false, diagnostics: validation.diagnostics });
  }

  return Object.freeze({
    ok: true,
    document: validation.value,
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}
