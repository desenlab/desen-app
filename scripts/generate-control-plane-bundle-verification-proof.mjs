import {
  ControlPlaneBundleVerificationEvidenceError,
  writeControlPlaneBundleVerificationEvidence,
} from "./lib/control-plane-bundle-verification-proof.mjs";

try {
  const result = await writeControlPlaneBundleVerificationEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        artifactSha256: result.artifactSha256,
        message: "Wrote deterministic M07-T02 Bundle-integrity verification evidence.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof ControlPlaneBundleVerificationEvidenceError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
