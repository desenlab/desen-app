import {
  DesenAppSuccessHostOperationProofError,
  writeDesenAppSuccessHostOperationEvidence,
} from "./lib/desen-app-success-host-operation-proof.mjs";

try {
  const result = await writeDesenAppSuccessHostOperationEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        ...result,
        message: "Wrote deterministic M10-T04 success and local-host operation evidence.",
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
