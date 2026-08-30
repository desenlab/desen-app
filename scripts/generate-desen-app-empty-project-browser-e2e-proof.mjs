import {
  DesenAppEmptyProjectBrowserE2eProofError,
  writeDesenAppEmptyProjectBrowserE2eEvidence,
} from "./lib/desen-app-empty-project-browser-e2e-proof.mjs";

try {
  const result = await writeDesenAppEmptyProjectBrowserE2eEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        ...result,
        message: "Wrote deterministic M10-T01 empty-project browser evidence.",
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
