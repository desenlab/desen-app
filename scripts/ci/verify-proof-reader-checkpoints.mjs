import {
  ProofReaderCheckpointError,
  verifyProofReaderCheckpoints,
} from "./proof-reader-checkpoints.mjs";

try {
  const result = await verifyProofReaderCheckpoints();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  const failure =
    error instanceof ProofReaderCheckpointError
      ? {
          status: "FAIL",
          code: error.code,
          message: error.message,
          details: error.details,
        }
      : {
          status: "FAIL",
          code: "UNEXPECTED_ERROR",
          message: String(error),
        };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
