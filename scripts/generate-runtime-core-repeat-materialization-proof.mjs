import {
  RuntimeCoreRepeatMaterializationEvidenceError,
  writeRuntimeCoreRepeatMaterializationEvidence,
} from "./lib/runtime-core-repeat-materialization-proof.mjs";

try {
  const result = await writeRuntimeCoreRepeatMaterializationEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        artifactSha256: result.artifactSha256,
        message: "Wrote deterministic M04-T07 repeat-materialization evidence.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof RuntimeCoreRepeatMaterializationEvidenceError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
