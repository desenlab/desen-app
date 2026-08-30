import {
  DesenAppEmptyProjectBrowserE2eProofError,
  verifyDesenAppEmptyProjectBrowserE2eEvidence,
} from "./lib/desen-app-empty-project-browser-e2e-proof.mjs";

try {
  const result = await verifyDesenAppEmptyProjectBrowserE2eEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        ...result,
        message:
          "Verified deterministic M10-T01 evidence; browser execution remains owned by the separate Browser E2E job.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof DesenAppEmptyProjectBrowserE2eProofError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
