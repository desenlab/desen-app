import {
  ControlPlaneRuntimeTransitionRacesEvidenceError,
  writeControlPlaneRuntimeTransitionRacesEvidence,
} from "./lib/control-plane-runtime-transition-races-proof.mjs";

try {
  const result = await writeControlPlaneRuntimeTransitionRacesEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        artifactSha256: result.artifactSha256,
        message: "Wrote deterministic M07-T10 runtime transition-race evidence.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof ControlPlaneRuntimeTransitionRacesEvidenceError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
