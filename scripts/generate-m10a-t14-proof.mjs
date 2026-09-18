import { M10AT14ProofError, writeM10AT14Evidence } from "./lib/m10a-t14-proof.mjs";

try {
  process.stdout.write(`${JSON.stringify(await writeM10AT14Evidence(), null, 2)}\n`);
} catch (error) {
  process.stderr.write(
    `${JSON.stringify({
      status: "FAIL",
      code: error instanceof M10AT14ProofError ? error.code : "M10A_T14_CAPTURE_FAILED",
      message: error instanceof Error ? error.message : "Unexpected T14 capture failure.",
    })}\n`,
  );
  process.exitCode = 1;
}
