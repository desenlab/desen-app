import {
  RuntimeCoreVariantStyleEvaluationEvidenceError,
  writeRuntimeCoreVariantStyleEvaluationEvidence,
} from "./lib/runtime-core-variant-style-evaluation-proof.mjs";

try {
  const result = await writeRuntimeCoreVariantStyleEvaluationEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        artifactSha256: result.artifactSha256,
        message: "Wrote deterministic M04-T05 variant/style-evaluation evidence.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof RuntimeCoreVariantStyleEvaluationEvidenceError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
