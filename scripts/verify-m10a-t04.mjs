import { M10AT04ProofError, verifyM10AT04Evidence } from "./lib/m10a-t04-proof.mjs";

try {
  process.stdout.write(`${JSON.stringify(await verifyM10AT04Evidence(), null, 2)}\n`);
} catch (error) {
  process.stderr.write(
    `${JSON.stringify({
      status: "FAIL",
      code: error instanceof M10AT04ProofError ? error.code : "M10A_T04_VERIFICATION_FAILED",
      message: error instanceof Error ? error.message : "Unexpected T04 verification failure.",
    })}\n`,
  );
  process.exitCode = 1;
}
