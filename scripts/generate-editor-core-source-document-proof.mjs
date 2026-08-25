import {
  EditorCoreSourceDocumentProofError,
  writeEditorCoreSourceDocumentEvidence,
} from "./lib/editor-core-source-document-proof.mjs";

try {
  const result = await writeEditorCoreSourceDocumentEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        task: result.task,
        artifactSha256: result.artifactSha256,
        message: "Wrote deterministic M08-T01 editor-core Source-document evidence.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof EditorCoreSourceDocumentProofError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
