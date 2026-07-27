import {
  ProtocolSemanticFoundationEvidenceError,
  verifyProtocolSemanticFoundation,
} from "./lib/protocol-semantic-foundation-proof.mjs";

try {
  const result = await verifyProtocolSemanticFoundation();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        artifactSha256: result.artifactSha256,
        message: "Preserved immutable task-time M02-T07 semantic-foundation evidence.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof ProtocolSemanticFoundationEvidenceError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
