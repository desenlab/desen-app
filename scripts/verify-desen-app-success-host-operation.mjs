import {
  DesenAppSuccessHostOperationProofError,
  verifyDesenAppSuccessHostOperationEvidence,
} from "./lib/desen-app-success-host-operation-proof.mjs";

try {
  const result = await verifyDesenAppSuccessHostOperationEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        ...result,
        message:
          "Verified deterministic M10-T04 success and local-host operation evidence without starting product or browser code.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof DesenAppSuccessHostOperationProofError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
