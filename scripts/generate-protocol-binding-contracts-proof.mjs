import {
  ProtocolBindingContractsEvidenceError,
  writeProtocolBindingContractsEvidence,
} from "./lib/protocol-binding-contracts-proof.mjs";

try {
  const result = await writeProtocolBindingContractsEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        artifactSha256: result.artifactSha256,
        message: "Wrote deterministic M02-T10 binding-contract evidence.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof ProtocolBindingContractsEvidenceError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
