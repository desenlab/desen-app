import {
  ProtocolTypesError,
  generateProtocolTypes,
  verifyProtocolTypes,
  writeProtocolTypeArtifacts,
} from "./lib/protocol-types.mjs";
import { verifyProtocolSnapshot } from "./lib/protocol-snapshot-integrity.mjs";

try {
  await verifyProtocolSnapshot();
  const generated = await generateProtocolTypes();
  await writeProtocolTypeArtifacts(generated);

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
