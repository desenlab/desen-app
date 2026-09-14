import { M10AT07ProofError, verifyM10AT07Evidence } from "./lib/m10a-t07-proof.mjs";

try {
  process.stdout.write(`${JSON.stringify(await verifyM10AT07Evidence(), null, 2)}\n`);
} catch (error) {
  process.stderr.write(
    `${JSON.stringify({
      status: "FAIL",
      code: error instanceof M10AT07ProofError ? error.code : "M10A_T07_VERIFICATION_FAILED",
      message: error instanceof Error ? error.message : "Unexpected T07 verification failure.",
    })}\n`,
  );
  process.exitCode = 1;
}
