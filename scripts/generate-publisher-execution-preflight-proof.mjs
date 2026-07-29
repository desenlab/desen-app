import {
  PublisherExecutionPreflightEvidenceError,
  writePublisherExecutionPreflightEvidence,
} from "./lib/publisher-execution-preflight-proof.mjs";

try {
  const result = await writePublisherExecutionPreflightEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        artifactSha256: result.artifactSha256,
        message: "Wrote deterministic M06-T05 Publisher execution-preflight evidence.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof PublisherExecutionPreflightEvidenceError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
