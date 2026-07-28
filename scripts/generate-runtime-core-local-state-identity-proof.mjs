import {
  RuntimeCoreLocalStateIdentityEvidenceError,
  writeRuntimeCoreLocalStateIdentityEvidence,
} from "./lib/runtime-core-local-state-identity-proof.mjs";

try {
  const result = await writeRuntimeCoreLocalStateIdentityEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        artifactSha256: result.artifactSha256,
        compatibilityMode: result.compatibilityMode,
        preserved: result.preserved,
        message: "Preserved immutable task-time M04-T06 local-state and node-identity evidence.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof RuntimeCoreLocalStateIdentityEvidenceError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
