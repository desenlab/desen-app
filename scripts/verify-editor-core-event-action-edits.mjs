import {
  EditorCoreEventActionEditsProofError,
  verifyEditorCoreEventActionEditsEvidence,
} from "./lib/editor-core-event-action-edits-proof.mjs";

try {
  const result = await verifyEditorCoreEventActionEditsEvidence();
  process.stdout.write(`${JSON.stringify({ status: "PASS", ...result }, null, 2)}\n`);
} catch (error) {
  const failure =
    error instanceof EditorCoreEventActionEditsProofError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
