import { M10AT04ProofError, writeM10AT04Evidence } from "./lib/m10a-t04-proof.mjs";

try {
  const result = await writeM10AT04Evidence();
  process.stdout.write(
    `${JSON.stringify({ status: "CAPTURED", task: "M10A-T04", ...result }, null, 2)}\n`,
  );
} catch (error) {
  process.stderr.write(
    `${JSON.stringify({
      status: "FAIL",
      code: error instanceof M10AT04ProofError ? error.code : "M10A_T04_CAPTURE_FAILED",
      message: error instanceof Error ? error.message : "Unexpected T04 capture failure.",
    })}\n`,
  );
  process.exitCode = 1;
}
