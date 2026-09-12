import { M10AT05ProofError, writeM10AT05Evidence } from "./lib/m10a-t05-proof.mjs";
import { writeM10AT01Catalog } from "./lib/m10a-t01-proof.mjs";

try {
  const catalog = await writeM10AT01Catalog();
  const evidence = await writeM10AT05Evidence();
  process.stdout.write(
    `${JSON.stringify({ status: "CAPTURED", task: "M10A-T05", catalog, ...evidence }, null, 2)}\n`,
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
