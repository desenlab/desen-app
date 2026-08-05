import {
  ControlPlaneReferencePreflightEvidenceError,
  writeControlPlaneReferencePreflightEvidence,
} from "./lib/control-plane-reference-preflight-proof.mjs";

try {
  const result = await writeControlPlaneReferencePreflightEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        artifactSha256: result.artifactSha256,
        message: "Wrote deterministic M07-T04 reference and finite-limit preflight evidence.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof ControlPlaneReferencePreflightEvidenceError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
