import { M10AT06ProofError, verifyM10AT06Evidence } from "./lib/m10a-t06-proof.mjs";

try {
  process.stdout.write(`${JSON.stringify(await verifyM10AT06Evidence(), null, 2)}\n`);
} catch (error) {
  process.stderr.write(
    `${JSON.stringify({
      status: "FAIL",
      code: error instanceof M10AT06ProofError ? error.code : "M10A_T06_VERIFICATION_FAILED",
      message: error instanceof Error ? error.message : "Unexpected T06 verification failure.",
    })}\n`,
  );
  process.exitCode = 1;
}
