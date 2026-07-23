import {
  ReferenceCatalogWebFormFeedbackEvidenceError,
  verifyReferenceCatalogWebFormFeedbackEvidence,
} from "./lib/reference-catalog-web-form-feedback-proof.mjs";

try {
  const result = await verifyReferenceCatalogWebFormFeedbackEvidence();
  process.stdout.write(`${JSON.stringify({ status: "PASS", ...result }, null, 2)}\n`);
} catch (error) {
  const failure =
    error instanceof ReferenceCatalogWebFormFeedbackEvidenceError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
