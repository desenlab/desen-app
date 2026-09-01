import {
  DesenAppInputPendingFixtureProofError,
  verifyDesenAppInputPendingFixtureEvidence,
} from "./lib/desen-app-input-pending-fixture-proof.mjs";

try {
  const result = await verifyDesenAppInputPendingFixtureEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        ...result,
        message:
          "Verified deterministic M10-T02 input/pending fixture evidence without starting product or browser code.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof DesenAppInputPendingFixtureProofError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
