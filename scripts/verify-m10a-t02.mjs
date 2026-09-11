import { M10AT02ProofError, verifyM10AT02Evidence } from "./lib/m10a-t02-proof.mjs";

try {
  process.stdout.write(`${JSON.stringify(await verifyM10AT02Evidence(), null, 2)}\n`);
} catch (error) {
  process.stderr.write(
    `${JSON.stringify({
      status: "FAIL",
      code: error instanceof M10AT02ProofError ? error.code : "M10A_T02_VERIFICATION_FAILED",
      message: error instanceof Error ? error.message : "Unexpected T02 verification failure.",
    })}\n`,
  );
  process.exitCode = 1;
}
