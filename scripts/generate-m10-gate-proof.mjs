import { M10GateProofError, writeM10GateEvidence } from "./lib/m10-gate-proof.mjs";

try {
  process.stdout.write(
    `${JSON.stringify({ status: "CAPTURED", ...(await writeM10GateEvidence()) }, null, 2)}\n`,
  );
} catch (error) {
  process.stderr.write(
    `${JSON.stringify({ status: "FAIL", code: error instanceof M10GateProofError ? error.code : "M10_GATE_CAPTURE_FAILED" })}\n`,
  );
  process.exitCode = 1;
}
