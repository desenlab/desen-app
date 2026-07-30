import {
  PublisherSourcePreflightEvidenceError,
  writePublisherSourcePreflightEvidence,
} from "./lib/publisher-source-preflight-proof.mjs";

try {
  const result = await writePublisherSourcePreflightEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        artifactSha256: result.artifactSha256,
        message: "Wrote deterministic M06-T03 Publisher Source-preflight evidence.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof PublisherSourcePreflightEvidenceError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
