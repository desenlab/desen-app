import {
  ProtocolValidatorDiagnosticMicroVectorsEvidenceError,
  writeProtocolValidatorDiagnosticMicroVectorsEvidence,
} from "./lib/protocol-validator-diagnostic-micro-vectors-proof.mjs";

try {
  const result = await writeProtocolValidatorDiagnosticMicroVectorsEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        artifactSha256: result.artifactSha256,
        message: "Wrote deterministic M02-T13 validator diagnostic micro-vector evidence.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof ProtocolValidatorDiagnosticMicroVectorsEvidenceError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
