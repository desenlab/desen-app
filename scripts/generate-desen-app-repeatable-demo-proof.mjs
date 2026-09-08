import {
  DesenAppRepeatableDemoProofError,
  writeDesenAppRepeatableDemoEvidence,
} from "./lib/desen-app-repeatable-demo-proof.mjs";

try {
  const result = await writeDesenAppRepeatableDemoEvidence();
  process.stdout.write(
    `${JSON.stringify({ status: "PASS", ...result, message: "Wrote fresh sockets-free normal demo evidence; visible two-cycle Chromium remains independent." }, null, 2)}\n`,
  );
} catch (error) {
  const failure =
    error instanceof DesenAppRepeatableDemoProofError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : {
          status: "FAIL",
          code: "UNEXPECTED_ERROR",
          message: "The bounded proof did not complete.",
        };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
