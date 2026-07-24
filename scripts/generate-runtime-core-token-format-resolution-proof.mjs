import {
  RuntimeCoreTokenFormatResolutionEvidenceError,
  writeRuntimeCoreTokenFormatResolutionEvidence,
} from "./lib/runtime-core-token-format-resolution-proof.mjs";

try {
  const result = await writeRuntimeCoreTokenFormatResolutionEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        artifactSha256: result.artifactSha256,
        message: "Wrote deterministic M04-T03 runtime token/format evidence.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof RuntimeCoreTokenFormatResolutionEvidenceError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
