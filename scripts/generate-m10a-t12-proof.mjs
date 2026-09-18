import { M10AT12ProofError, writeM10AT12Evidence } from "./lib/m10a-t12-proof.mjs";

try {
  process.stdout.write(`${JSON.stringify(await writeM10AT12Evidence(), null, 2)}\n`);
} catch (error) {
  process.stderr.write(
    `${JSON.stringify({
      status: "FAIL",
      code: error instanceof M10AT12ProofError ? error.code : "M10A_T12_CAPTURE_FAILED",
      message: error instanceof Error ? error.message : "Unexpected T12 capture failure.",
    })}\n`,
  );
  process.exitCode = 1;
}
