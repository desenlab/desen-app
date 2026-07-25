import {
  RuntimeCoreResourceLifecycleEvidenceError,
  writeRuntimeCoreResourceLifecycleEvidence,
} from "./lib/runtime-core-resource-lifecycle-proof.mjs";

try {
  const result = await writeRuntimeCoreResourceLifecycleEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        artifactSha256: result.artifactSha256,
        message: "Wrote deterministic M04-T08 resource-lifecycle evidence.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof RuntimeCoreResourceLifecycleEvidenceError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
