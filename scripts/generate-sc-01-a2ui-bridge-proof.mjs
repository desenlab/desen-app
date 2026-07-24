import {
  Sc01A2uiBridgeError,
  writeSc01A2uiBridgeEvidence,
} from "./lib/sc-01-a2ui-bridge-spike.mjs";

try {
  const result = await writeSc01A2uiBridgeEvidence();
  process.stdout.write(`${JSON.stringify({ status: "PASS", ...result }, null, 2)}\n`);
} catch (error) {
  const failure =
    error instanceof Sc01A2uiBridgeError
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
