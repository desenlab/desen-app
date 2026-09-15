import { M10AT09ProofError, verifyM10AT09Evidence } from "./lib/m10a-t09-proof.mjs";

try {
  process.stdout.write(`${JSON.stringify(await verifyM10AT09Evidence(), null, 2)}\n`);
} catch (error) {
  process.stderr.write(
    `${JSON.stringify({
      status: "FAIL",
      code: error instanceof M10AT09ProofError ? error.code : "M10A_T09_VERIFICATION_FAILED",
      message: error instanceof Error ? error.message : "Unexpected T09 verification failure.",
    })}\n`,
  );
  process.exitCode = 1;
}
