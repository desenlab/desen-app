import {
  DesenAppSelectionOverlayProofError,
  writeDesenAppSelectionOverlayEvidence,
} from "./lib/desen-app-selection-overlay-proof.mjs";

try {
  const result = await writeDesenAppSelectionOverlayEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        ...result,
        message: "Wrote deterministic M09-T04 selection-overlay evidence.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof DesenAppSelectionOverlayProofError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
