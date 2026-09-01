import {
  DesenAppEvergreenProductCompositionProofError,
  writeDesenAppEvergreenProductCompositionEvidence,
} from "./lib/desen-app-evergreen-product-composition-proof.mjs";

try {
  const result = await writeDesenAppEvergreenProductCompositionEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        ...result,
        message: "Wrote deterministic M10-T01C evergreen product-composition evidence.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof DesenAppEvergreenProductCompositionProofError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
