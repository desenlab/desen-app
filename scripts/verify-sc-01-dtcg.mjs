import { Sc01DtcgAuditError, verifySc01DtcgEvidence } from "./lib/sc-01-dtcg-audit.mjs";

try {
  const result = await verifySc01DtcgEvidence();
  process.stdout.write(`${JSON.stringify({ status: "PASS", ...result }, null, 2)}\n`);
} catch (error) {
  const failure =
    error instanceof Sc01DtcgAuditError
      ? {
          status: "FAIL",
          code: error.code,
          message: error.message,
          details: error.details,
        }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
