import {
  DesenAppFixturesScenariosFidelityProofError,
  verifyDesenAppFixturesScenariosFidelityEvidence,
} from "./lib/desen-app-fixtures-scenarios-fidelity-proof.mjs";

try {
  const result = await verifyDesenAppFixturesScenariosFidelityEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        ...result,
        message: "Verified deterministic M09-T11 fixtures, scenarios, and fidelity evidence.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof DesenAppFixturesScenariosFidelityProofError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
