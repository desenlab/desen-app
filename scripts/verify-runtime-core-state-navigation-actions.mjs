import {
  RuntimeCoreStateNavigationActionsEvidenceError,
  verifyRuntimeCoreStateNavigationActionsEvidence,
} from "./lib/runtime-core-state-navigation-actions-proof.mjs";

try {
  const result = await verifyRuntimeCoreStateNavigationActionsEvidence();
  process.stdout.write(`${JSON.stringify({ status: "PASS", ...result }, null, 2)}\n`);
} catch (error) {
  const failure =
    error instanceof RuntimeCoreStateNavigationActionsEvidenceError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
