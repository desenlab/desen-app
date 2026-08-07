import {
  ControlPlaneRuntimeActivationEvidenceError,
  writeControlPlaneRuntimeActivationEvidence,
} from "./lib/control-plane-runtime-activation-proof.mjs";

try {
  const result = await writeControlPlaneRuntimeActivationEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        artifactSha256: result.artifactSha256,
        message: "Wrote deterministic M07-T07 runtime-activation evidence.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof ControlPlaneRuntimeActivationEvidenceError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
