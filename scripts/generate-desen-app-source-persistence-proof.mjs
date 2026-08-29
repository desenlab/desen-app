import {
  DesenAppSourcePersistenceProofError,
  writeDesenAppSourcePersistenceEvidence,
} from "./lib/desen-app-source-persistence-proof.mjs";

try {
  const result = await writeDesenAppSourcePersistenceEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        ...result,
        message: "Wrote deterministic M09-T12 Source persistence evidence.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof DesenAppSourcePersistenceProofError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
