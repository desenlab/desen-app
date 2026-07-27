import {
  ProtocolStructuralValidationEvidenceError,
  verifyProtocolStructuralValidation,
} from "./lib/protocol-structural-validation-proof.mjs";

try {
  const result = await verifyProtocolStructuralValidation();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        artifactSha256: result.artifactSha256,
        message: "Preserved immutable task-time M02-T06 structural-validation evidence.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof ProtocolStructuralValidationEvidenceError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
