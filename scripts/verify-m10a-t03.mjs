import { M10AT03ProofError, verifyM10AT03Evidence } from "./lib/m10a-t03-proof.mjs";

try {
  process.stdout.write(`${JSON.stringify(await verifyM10AT03Evidence(), null, 2)}\n`);
} catch (error) {
  process.stderr.write(
    `${JSON.stringify({
      status: "FAIL",
      code: error instanceof M10AT03ProofError ? error.code : "M10A_T03_VERIFICATION_FAILED",
      message: error instanceof Error ? error.message : "Unexpected T03 verification failure.",
    })}\n`,
  );
  process.exitCode = 1;
}
