import {
  ProtocolOfficialSuiteParityEvidenceError,
  writeProtocolOfficialSuiteParityEvidence,
} from "./lib/protocol-official-suite-parity-proof.mjs";

try {
  const result = await writeProtocolOfficialSuiteParityEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        artifactSha256: result.artifactSha256,
        message: "Wrote deterministic M02-T12 official-suite parity evidence.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof ProtocolOfficialSuiteParityEvidenceError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
