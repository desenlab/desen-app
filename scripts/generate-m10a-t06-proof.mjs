import { M10AT06ProofError, writeM10AT06Evidence } from "./lib/m10a-t06-proof.mjs";
import { writeM10AT01Catalog } from "./lib/m10a-t01-proof.mjs";

try {
  const catalog = await writeM10AT01Catalog();
  const evidence = await writeM10AT06Evidence();
  process.stdout.write(
    `${JSON.stringify({ status: "CAPTURED", task: "M10A-T06", catalog, ...evidence }, null, 2)}\n`,
  );
} catch (error) {
  process.stderr.write(
    `${JSON.stringify({
      status: "FAIL",
      code: error instanceof M10AT06ProofError ? error.code : "M10A_T06_CAPTURE_FAILED",
      message: error instanceof Error ? error.message : "Unexpected T06 capture failure.",
    })}\n`,
  );
  process.exitCode = 1;
}
