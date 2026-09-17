import { M10AT12ProofError, verifyM10AT12Evidence } from "./lib/m10a-t12-proof.mjs";

try {
  process.stdout.write(`${JSON.stringify(await verifyM10AT12Evidence(), null, 2)}\n`);
} catch (error) {
  process.stderr.write(
    `${JSON.stringify({
      status: "FAIL",
      code: error instanceof M10AT12ProofError ? error.code : "M10A_T12_VERIFICATION_FAILED",
      message: error instanceof Error ? error.message : "Unexpected T12 verification failure.",
    })}\n`,
  );
  process.exitCode = 1;
}
