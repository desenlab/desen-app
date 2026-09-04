import {
  DesenAppPublishedHostUpdateProofError,
  writeDesenAppPublishedHostUpdateEvidence,
} from "./lib/desen-app-published-host-update-proof.mjs";

try {
  const result = await writeDesenAppPublishedHostUpdateEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        ...result,
        message: "Wrote deterministic M10-T05 published-host-update evidence.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof DesenAppPublishedHostUpdateProofError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
