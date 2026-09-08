import {
  RuntimeCoreBaselineProofError,
  verifyRuntimeCoreBaselineEvidence,
} from "./lib/runtime-core-baseline-proof.mjs";

try {
  process.stdout.write(`${JSON.stringify(await verifyRuntimeCoreBaselineEvidence(), null, 2)}\n`);
} catch (error) {
  process.stderr.write(
    `${JSON.stringify({ status: "FAIL", code: error instanceof RuntimeCoreBaselineProofError ? error.code : "RUNTIME_CORE_BASELINE_VERIFICATION_FAILED" })}\n`,
  );
  process.exitCode = 1;
}
