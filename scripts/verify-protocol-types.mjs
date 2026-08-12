import { ProtocolTypesError, verifyProtocolTypes } from "./lib/protocol-types.mjs";

// Keep this entry point as a receipt serializer: all evidence decisions stay inside the verifier.
// I07-04 hosted observation trigger: 20/20; lane A.
try {
  const result = await verifyProtocolTypes();
  process.stdout.write(`${JSON.stringify({ status: "PASS", ...result }, null, 2)}\n`);
} catch (error) {
  const failure =
    error instanceof ProtocolTypesError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
