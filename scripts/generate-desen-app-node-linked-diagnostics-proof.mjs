import {
  DesenAppNodeLinkedDiagnosticsProofError,
  writeDesenAppNodeLinkedDiagnosticsEvidence,
} from "./lib/desen-app-node-linked-diagnostics-proof.mjs";

try {
  const result = await writeDesenAppNodeLinkedDiagnosticsEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        ...result,
        message: "Wrote deterministic M09-T13 node-linked diagnostics evidence.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof DesenAppNodeLinkedDiagnosticsProofError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
