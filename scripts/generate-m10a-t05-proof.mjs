import { M10AT05ProofError, verifyM10AT05Evidence } from "./lib/m10a-t05-proof.mjs";

try {
  process.stdout.write(
    `${JSON.stringify({ status: "HISTORICAL", ...(await verifyM10AT05Evidence()) }, null, 2)}\n`,
  );
} catch (error) {
  process.stderr.write(
    `${JSON.stringify({
      status: "FAIL",
      code: error instanceof M10AT05ProofError ? error.code : "M10A_T05_CAPTURE_FAILED",
      message: error instanceof Error ? error.message : "Unexpected T05 capture failure.",
    })}\n`,
  );
  process.exitCode = 1;
}
