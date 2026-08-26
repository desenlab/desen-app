import {
  EditorCoreStateBindingEditsProofError,
  writeEditorCoreStateBindingEditsEvidence,
} from "./lib/editor-core-state-binding-edits-proof.mjs";

try {
  const result = await writeEditorCoreStateBindingEditsEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        task: result.task,
        artifactSha256: result.artifactSha256,
        message: "Wrote deterministic M08-T05 state-and-binding edit evidence.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof EditorCoreStateBindingEditsProofError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
