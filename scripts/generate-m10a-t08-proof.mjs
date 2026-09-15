import { M10AT08ProofError, writeM10AT08Evidence } from "./lib/m10a-t08-proof.mjs";

try {
  process.stdout.write(`${JSON.stringify(await writeM10AT08Evidence(), null, 2)}\n`);
} catch (error) {
  process.stderr.write(
    `${JSON.stringify({
      status: "FAIL",
      code: error instanceof M10AT08ProofError ? error.code : "M10A_T08_CAPTURE_FAILED",
      message: error instanceof Error ? error.message : "Unexpected T08 capture failure.",
    })}\n`,
  );
  process.exitCode = 1;
}
