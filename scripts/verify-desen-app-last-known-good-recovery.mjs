import {
  DesenAppLastKnownGoodRecoveryProofError,
  verifyDesenAppLastKnownGoodRecoveryEvidence,
} from "./lib/desen-app-last-known-good-recovery-proof.mjs";

try {
  const result = await verifyDesenAppLastKnownGoodRecoveryEvidence();
  process.stdout.write(
    `${JSON.stringify({ status: "PASS", ...result, message: "Verified fresh public recovery APIs, TypeScript emission and current graphs; no Chromium or listener started." }, null, 2)}\n`,
  );
} catch (error) {
  const failure =
    error instanceof DesenAppLastKnownGoodRecoveryProofError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
