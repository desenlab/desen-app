import {
  PublisherInvalidSourceMatrixEvidenceError,
  writePublisherInvalidSourceMatrixEvidence,
} from "./lib/publisher-invalid-source-matrix-proof.mjs";

try {
  const result = await writePublisherInvalidSourceMatrixEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        artifactSha256: result.artifactSha256,
        message: "Wrote deterministic M06-T11 Publisher invalid-source evidence.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof PublisherInvalidSourceMatrixEvidenceError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
