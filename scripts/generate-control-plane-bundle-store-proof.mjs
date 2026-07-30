import {
  ControlPlaneBundleStoreEvidenceError,
  writeControlPlaneBundleStoreEvidence,
} from "./lib/control-plane-bundle-store-proof.mjs";

try {
  const result = await writeControlPlaneBundleStoreEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        artifactSha256: result.artifactSha256,
        message: "Wrote deterministic M07-T01 immutable Bundle-store evidence.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof ControlPlaneBundleStoreEvidenceError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
