import {
  DesenAppDesignRunModesProofError,
  writeDesenAppDesignRunModesEvidence,
} from "./lib/desen-app-design-run-modes-proof.mjs";

try {
  const result = await writeDesenAppDesignRunModesEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        ...result,
        message: "Wrote deterministic M09-T10 Design/Run modes evidence.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof DesenAppDesignRunModesProofError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
