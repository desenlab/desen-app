import {
  RuntimeCoreHeadlessSignInEvidenceError,
  verifyRuntimeCoreHeadlessSignInEvidence,
} from "./lib/runtime-core-headless-sign-in-proof.mjs";

try {
  const result = await verifyRuntimeCoreHeadlessSignInEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        artifactSha256: result.artifactSha256,
        message: "Preserved immutable task-time M04-T16/G04 headless sign-in evidence.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof RuntimeCoreHeadlessSignInEvidenceError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
