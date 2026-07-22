import {
  ProtocolExecutionContractsEvidenceError,
  writeProtocolExecutionContractsEvidence,
} from "./lib/protocol-execution-contracts-proof.mjs";

try {
  const result = await writeProtocolExecutionContractsEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        artifactSha256: result.artifactSha256,
        message: "Wrote deterministic M02-T11 execution-contract evidence.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof ProtocolExecutionContractsEvidenceError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
