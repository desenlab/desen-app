import {
  DesenAppStateBindingEditorProofError,
  writeDesenAppStateBindingEditorEvidence,
} from "./lib/desen-app-state-binding-editor-proof.mjs";

try {
  const result = await writeDesenAppStateBindingEditorEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        ...result,
        message: "Wrote deterministic M09-T08 state and binding editor evidence.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof DesenAppStateBindingEditorProofError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
