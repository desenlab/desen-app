import {
  EditorCoreStableIdInsertProofError,
  writeEditorCoreStableIdInsertEvidence,
} from "./lib/editor-core-stable-id-insert-proof.mjs";

try {
  const result = await writeEditorCoreStableIdInsertEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        task: result.task,
        artifactSha256: result.artifactSha256,
        message: "Wrote deterministic M08-T02 stable-ID insert evidence.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof EditorCoreStableIdInsertProofError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
