import { M10GateProofError, verifyM10GateEvidence } from "./lib/m10-gate-proof.mjs";

try {
  process.stdout.write(`${JSON.stringify(await verifyM10GateEvidence(), null, 2)}\n`);
} catch (error) {
  process.stderr.write(
    `${JSON.stringify({ status: "FAIL", code: error instanceof M10GateProofError ? error.code : "M10_GATE_VERIFICATION_FAILED" })}\n`,
  );
  process.exitCode = 1;
}
