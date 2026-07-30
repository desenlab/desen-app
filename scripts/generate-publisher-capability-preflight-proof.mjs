import {
  PublisherCapabilityPreflightEvidenceError,
  writePublisherCapabilityPreflightEvidence,
} from "./lib/publisher-capability-preflight-proof.mjs";

try {
  const result = await writePublisherCapabilityPreflightEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        artifactSha256: result.artifactSha256,
        message: "Wrote deterministic M06-T04 Publisher capability-preflight evidence.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof PublisherCapabilityPreflightEvidenceError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
