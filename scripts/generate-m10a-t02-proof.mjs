import { M10AT02ProofError, writeM10AT02Evidence } from "./lib/m10a-t02-proof.mjs";

try {
  const result = await writeM10AT02Evidence();
  process.stdout.write(
    `${JSON.stringify({ status: "CAPTURED", task: "M10A-T02", ...result }, null, 2)}\n`,
  );
} catch (error) {
  process.stderr.write(
    `${JSON.stringify({
      status: "FAIL",
      code: error instanceof M10AT02ProofError ? error.code : "M10A_T02_CAPTURE_FAILED",
      message: error instanceof Error ? error.message : "Unexpected T02 capture failure.",
    })}\n`,
  );
  process.exitCode = 1;
}
