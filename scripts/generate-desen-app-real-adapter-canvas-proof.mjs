import {
  DesenAppRealAdapterCanvasProofError,
  writeDesenAppRealAdapterCanvasEvidence,
} from "./lib/desen-app-real-adapter-canvas-proof.mjs";

try {
  const result = await writeDesenAppRealAdapterCanvasEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        ...result,
        message: "Wrote deterministic M09-T03 real-adapter canvas evidence.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof DesenAppRealAdapterCanvasProofError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
