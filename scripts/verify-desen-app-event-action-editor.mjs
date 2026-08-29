import {
  DesenAppEventActionEditorProofError,
  verifyDesenAppEventActionEditorEvidence,
} from "./lib/desen-app-event-action-editor-proof.mjs";

try {
  const result = await verifyDesenAppEventActionEditorEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        ...result,
        message: "Verified deterministic M09-T09 event and closed-action editor evidence.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof DesenAppEventActionEditorProofError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
