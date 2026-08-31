import {
  DesenAppUserCreatedBlankProjectProofError,
  verifyDesenAppUserCreatedBlankProjectEvidence,
} from "./lib/desen-app-user-created-blank-project-proof.mjs";

try {
  const result = await verifyDesenAppUserCreatedBlankProjectEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        ...result,
        message:
          "Verified deterministic M10-T01A product-flow evidence; Chromium execution remains owned by the separate Browser E2E job.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof DesenAppUserCreatedBlankProjectProofError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
