import {
  EditorCoreStructuralEditsProofError,
  writeEditorCoreStructuralEditsEvidence,
} from "./lib/editor-core-structural-edits-proof.mjs";

try {
  const result = await writeEditorCoreStructuralEditsEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        task: result.task,
        artifactSha256: result.artifactSha256,
        message: "Wrote deterministic M08-T03 structural-edit evidence.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof EditorCoreStructuralEditsProofError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
