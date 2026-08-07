import {
  ControlPlaneRuntimeRecoveryEvidenceError,
  writeControlPlaneRuntimeRecoveryEvidence,
} from "./lib/control-plane-runtime-recovery-proof.mjs";

try {
  const result = await writeControlPlaneRuntimeRecoveryEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        artifactSha256: result.artifactSha256,
        message: "Wrote deterministic M07-T08 runtime-recovery evidence.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof ControlPlaneRuntimeRecoveryEvidenceError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
