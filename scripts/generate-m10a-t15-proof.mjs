import { writeM10AT15Evidence } from "./lib/m10a-t15-proof.mjs";

try {
  process.stdout.write(`${JSON.stringify(await writeM10AT15Evidence(), null, 2)}\n`);
} catch (error) {
  process.stderr.write(
    `${JSON.stringify({ status: "FAIL", code: error?.code ?? "M10A_T15_CAPTURE_FAILED", message: error instanceof Error ? error.message : "T15 capture failed.", diagnosticsDirectory: error?.diagnosticsDirectory })}\n`,
  );
  process.exitCode = 1;
}
