import {
  RuntimeCoreActionTurnsEvidenceError,
  writeRuntimeCoreActionTurnsEvidence,
} from "./lib/runtime-core-action-turns-proof.mjs";

try {
  const result = await writeRuntimeCoreActionTurnsEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        artifactSha256: result.artifactSha256,
        message: "Wrote deterministic M04-T13 action-turn evidence.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof RuntimeCoreActionTurnsEvidenceError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
