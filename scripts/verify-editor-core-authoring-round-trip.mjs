import {
  EditorCoreAuthoringRoundTripProofError,
  verifyEditorCoreAuthoringRoundTripEvidence,
} from "./lib/editor-core-authoring-round-trip-proof.mjs";

try {
  const result = await verifyEditorCoreAuthoringRoundTripEvidence();
  process.stdout.write(`${JSON.stringify({ status: "PASS", ...result }, null, 2)}\n`);
} catch (error) {
  const failure =
    error instanceof EditorCoreAuthoringRoundTripProofError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
