import { M10AT03ProofError, writeM10AT03Evidence } from "./lib/m10a-t03-proof.mjs";

try {
  const result = await writeM10AT03Evidence();
  process.stdout.write(
    `${JSON.stringify({ status: "CAPTURED", task: "M10A-T03", ...result }, null, 2)}\n`,
  );
} catch (error) {
  process.stderr.write(
    `${JSON.stringify({
      status: "FAIL",
      code: error instanceof M10AT03ProofError ? error.code : "M10A_T03_CAPTURE_FAILED",
      message: error instanceof Error ? error.message : "Unexpected T03 capture failure.",
    })}\n`,
  );
  process.exitCode = 1;
}
