import { M10AT13ProofError, writeM10AT13Evidence } from "./lib/m10a-t13-proof.mjs";

try {
  process.stdout.write(`${JSON.stringify(await writeM10AT13Evidence(), null, 2)}\n`);
} catch (error) {
  process.stderr.write(
    `${JSON.stringify({
      status: "FAIL",
      code: error instanceof M10AT13ProofError ? error.code : "M10A_T13_CAPTURE_FAILED",
      message: error instanceof Error ? error.message : "Unexpected T13 capture failure.",
    })}\n`,
  );
  process.exitCode = 1;
}
