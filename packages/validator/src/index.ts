/**
 * Structural and semantic validation against exact DESEN protocol and catalog contracts.
 *
 * @packageDocumentation
 */

export {
  validateDesenBundle,
  validateDesenCatalog,
  validateDesenSource,
  validateDesenStructure,
} from "./structural-validation.js";

export type {
  DesenDocumentForTarget,
  DesenStructuralDiagnostic,
  DesenStructuralDiagnosticCode,
  DesenStructuralTarget,
  DesenStructuralValidationFailure,
  DesenStructuralValidationResult,
  DesenStructuralValidationSuccess,
  ImmutableJson,
} from "./structural-validation.js";
