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

export {
  validateDesenBundleComponentContracts,
  validateDesenComponentCatalogSet,
  validateDesenComponentContracts,
  validateDesenSourceComponentContracts,
} from "./component-contract-validation.js";

export {
  EVENT_PAYLOAD_SAFETY_LIMITS,
  validateDesenBundleInteractionContracts,
  validateDesenEventPayload,
  validateDesenInteractionCatalogSet,
  validateDesenInteractionContracts,
  validateDesenSourceInteractionContracts,
} from "./interaction-contract-validation.js";

export {
  validateDesenBindingContracts,
  validateDesenBundleBindingContracts,
  validateDesenSourceBindingContracts,
} from "./binding-contract-validation.js";

export {
  EXECUTION_VALUE_SAFETY_LIMITS,
  validateDesenBundleExecutionContracts,
  validateDesenExecutionCatalogSet,
  validateDesenExecutionContracts,
  validateDesenExecutionValue,
  validateDesenSourceExecutionContracts,
} from "./execution-contract-validation.js";

export {
  CATALOG_REQUIREMENT_MISMATCH_CODE,
  INVALID_COMPONENT_CONTRACT_CODE,
  INVALID_BINDING_CONTRACT_CODE,
  INVALID_EXECUTION_CONTRACT_CODE,
  INVALID_INTERACTION_CONTRACT_CODE,
  INVALID_SEMVER_CODE,
} from "./semantic-diagnostics.js";

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

export type {
  DesenComponentCatalogSetValidationFailure,
  DesenComponentCatalogSetValidationResult,
  DesenComponentCatalogSetValidationSuccess,
  DesenComponentContractObligation,
  DesenComponentContractObligationKind,
  DesenComponentContractTarget,
  DesenComponentContractValidationFailure,
  DesenComponentContractValidationResult,
  DesenComponentContractValidationSuccess,
  DesenValidatedComponentCatalogSet,
} from "./component-contract-validation.js";

export type {
  DesenEventCapabilityKind,
  DesenEventContractReference,
  DesenEventPayloadValidationFailure,
  DesenEventPayloadValidationResult,
  DesenEventPayloadValidationSuccess,
  DesenInteractionCatalogSetValidationFailure,
  DesenInteractionCatalogSetValidationResult,
  DesenInteractionCatalogSetValidationSuccess,
  DesenInteractionContractObligation,
  DesenInteractionContractObligationKind,
  DesenInteractionContractTarget,
  DesenInteractionContractValidationFailure,
  DesenInteractionContractValidationResult,
  DesenInteractionContractValidationSuccess,
  DesenResolvedJsonValue,
  DesenValidatedInteractionCatalogSet,
} from "./interaction-contract-validation.js";

export type {
  DesenBindingContractObligation,
  DesenBindingContractObligationKind,
  DesenBindingContractTarget,
  DesenBindingContractValidationFailure,
  DesenBindingContractValidationResult,
  DesenBindingContractValidationSuccess,
} from "./binding-contract-validation.js";

export type {
  DesenExecutionCatalogSetValidationFailure,
  DesenExecutionCatalogSetValidationResult,
  DesenExecutionCatalogSetValidationSuccess,
  DesenExecutionContractObligation,
  DesenExecutionContractObligationKind,
  DesenExecutionContractTarget,
  DesenExecutionContractValidationFailure,
  DesenExecutionContractValidationResult,
  DesenExecutionContractValidationSuccess,
  DesenExecutionValueContractKind,
  DesenExecutionValueContractReference,
  DesenExecutionValueValidationFailure,
  DesenExecutionValueValidationResult,
  DesenExecutionValueValidationSuccess,
  DesenValidatedExecutionCatalogSet,
} from "./execution-contract-validation.js";
