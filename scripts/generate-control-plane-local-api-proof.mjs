import {
  ControlPlaneLocalApiEvidenceError,
  writeControlPlaneLocalApiEvidence,
} from "./lib/control-plane-local-api-proof.mjs";

try {
  const result = await writeControlPlaneLocalApiEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        artifactSha256: result.artifactSha256,
        message: "Wrote deterministic M07-T05 local control-plane API evidence.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof ControlPlaneLocalApiEvidenceError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
