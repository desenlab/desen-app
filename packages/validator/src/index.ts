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

export {
  isExactSemanticVersion,
  validateDesenBundleSemantics,
  validateDesenCatalogSemantics,
  validateDesenCatalogSet,
  validateDesenSemanticFoundation,
  validateDesenSourceSemantics,
} from "./semantic-validation.js";

export { CATALOG_REQUIREMENT_MISMATCH_CODE, INVALID_SEMVER_CODE } from "./semantic-diagnostics.js";

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

export type {
  DesenCatalogSetValidationFailure,
  DesenCatalogSetValidationResult,
  DesenCatalogSetValidationSuccess,
  DesenSemanticValidationFailure,
  DesenSemanticValidationResult,
  DesenSemanticValidationSuccess,
  DesenValidatedCatalogSet,
} from "./semantic-validation.js";

export type {
  DesenSemanticDiagnostic,
  DesenSemanticExtensionDiagnosticCode,
} from "./semantic-diagnostics.js";
