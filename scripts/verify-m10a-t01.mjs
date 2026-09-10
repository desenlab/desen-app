import { M10AT01ProofError, verifyM10AT01Evidence } from "./lib/m10a-t01-proof.mjs";

try {
  process.stdout.write(`${JSON.stringify(await verifyM10AT01Evidence(), null, 2)}\n`);
} catch (error) {
  process.stderr.write(
    `${JSON.stringify({
      status: "FAIL",
      code: error instanceof M10AT01ProofError ? error.code : "M10A_T01_VERIFICATION_FAILED",
      ...(error instanceof M10AT01ProofError && error.diagnostic
        ? { diagnostic: error.diagnostic }
        : {}),
    })}\n`,
  );
  process.exitCode = 1;
}
