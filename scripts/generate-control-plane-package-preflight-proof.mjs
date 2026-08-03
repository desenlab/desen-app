import {
  ControlPlanePackagePreflightEvidenceError,
  writeControlPlanePackagePreflightEvidence,
} from "./lib/control-plane-package-preflight-proof.mjs";

try {
  const result = await writeControlPlanePackagePreflightEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        artifactSha256: result.artifactSha256,
        message: "Wrote deterministic M07-T03 exact installed-package preflight evidence.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof ControlPlanePackagePreflightEvidenceError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
