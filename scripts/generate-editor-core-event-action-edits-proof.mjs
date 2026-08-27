import {
  EditorCoreEventActionEditsProofError,
  writeEditorCoreEventActionEditsEvidence,
} from "./lib/editor-core-event-action-edits-proof.mjs";

try {
  const result = await writeEditorCoreEventActionEditsEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        task: result.task,
        artifactSha256: result.artifactSha256,
        message: "Wrote deterministic M08-T06 event-and-action edit evidence.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof EditorCoreEventActionEditsProofError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
