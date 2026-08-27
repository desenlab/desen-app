import { createDesenEditorContinuousValidator } from "../src/index.js";

import type {
  DesenEditorContinuousValidationReport,
  DesenEditorContinuousValidator,
  DesenEditorContinuousValidatorCreationFailure,
  DesenEditorContinuousValidatorCreationResult,
  DesenEditorContinuousValidatorCreationSuccess,
  DesenEditorDocument,
  DesenEditorInvalidSubjectMapping,
} from "../src/index.js";

declare const catalogs: unknown;
declare const document: DesenEditorDocument;
declare const continuousValidator: DesenEditorContinuousValidator;
declare const invalidSubjectKind: "surface";

const creation: DesenEditorContinuousValidatorCreationResult =
  createDesenEditorContinuousValidator(catalogs);

if (creation.ok) {
  const success: DesenEditorContinuousValidatorCreationSuccess = creation;
  const validator: DesenEditorContinuousValidator = success.validator;
  const report: DesenEditorContinuousValidationReport = validator.validate(document);
  const valid: boolean = report.valid;
  const documentFingerprint: string | null = report.documentFingerprint;
  const catalogSetFingerprint: string = report.catalogSetFingerprint;
  const mapping: DesenEditorInvalidSubjectMapping | undefined = report.invalidSubjects[0];
  const diagnosticIndex: number | undefined = mapping?.diagnosticIndexes[0];
  const occurrencePointer: string | undefined = mapping?.occurrencePointers[0];
  const unmappedIndex: number | undefined = report.unmappedDiagnosticIndexes[0];

  // @ts-expect-error continuous validation accepts only an admitted direct editor Source
  continuousValidator.validate({});

  // @ts-expect-error a bound validator cannot be replaced through its immutable success
  success.validator = validator;

  // @ts-expect-error the Catalog fingerprint is immutable
  validator.catalogSetFingerprint = "sha256:changed";

  // @ts-expect-error validation is synchronous and does not return a Promise
  const asynchronous: Promise<DesenEditorContinuousValidationReport> = validator.validate(document);

  // @ts-expect-error reports expose no Source or Validator clone
  const leakedDocument = report.document;

  if (mapping !== undefined) {
    // @ts-expect-error diagnostic mappings are immutable
    report.invalidSubjects.push(mapping);

    // @ts-expect-error occurrence pointers cannot be rewritten
    mapping.occurrencePointers[0] = "/changed";
  }

  const invalidMapping: DesenEditorInvalidSubjectMapping = {
    surfaceId: "main",
    subject: {
      // @ts-expect-error a diagnostic subject is closed to node and behavior
      kind: invalidSubjectKind,
      id: "main",
    },
    diagnosticIndexes: [],
    occurrencePointers: [],
  };

  void valid;
  void documentFingerprint;
  void catalogSetFingerprint;
  void diagnosticIndex;
  void occurrencePointer;
  void unmappedIndex;
  void asynchronous;
  void leakedDocument;
  void invalidMapping;
} else {
  const failure: DesenEditorContinuousValidatorCreationFailure = creation;
  const code: string = failure.diagnostics[0]?.code ?? "none";

  // @ts-expect-error a rejected Catalog set exposes no partial validator
  const partialValidator = failure.validator;

  void code;
  void partialValidator;
}
