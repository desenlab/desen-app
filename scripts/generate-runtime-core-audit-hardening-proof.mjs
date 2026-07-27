import {
  RuntimeCoreAuditHardeningEvidenceError,
  verifyRuntimeCoreAuditHardeningEvidence,
} from "./lib/runtime-core-audit-hardening-proof.mjs";

try {
  const result = await verifyRuntimeCoreAuditHardeningEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        artifactSha256: result.artifactSha256,
        message: "Preserved immutable task-time M04-T17/G04 audit-hardening evidence.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof RuntimeCoreAuditHardeningEvidenceError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
