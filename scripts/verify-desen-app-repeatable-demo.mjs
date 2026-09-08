import {
  DesenAppRepeatableDemoProofError,
  verifyDesenAppRepeatableDemoEvidence,
} from "./lib/desen-app-repeatable-demo-proof.mjs";

try {
  const result = await verifyDesenAppRepeatableDemoEvidence();
  process.stdout.write(
    `${JSON.stringify({ status: "PASS", ...result, message: "Verified fresh normal reset API, public recovery APIs and current graphs; no Chromium or listener started." }, null, 2)}\n`,
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
