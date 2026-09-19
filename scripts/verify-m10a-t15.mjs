import { verifyM10AT15Evidence } from "./lib/m10a-t15-proof.mjs";

try {
  process.stdout.write(`${JSON.stringify(await verifyM10AT15Evidence(), null, 2)}\n`);
} catch (error) {
  process.stderr.write(
    `${JSON.stringify({ status: "FAIL", code: error?.code ?? "M10A_T15_VERIFICATION_FAILED", message: error instanceof Error ? error.message : "T15 verification failed.", diagnosticsDirectory: error?.diagnosticsDirectory })}\n`,
  );
  process.exitCode = 1;
}
