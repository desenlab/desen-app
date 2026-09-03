import {
  HistoricalArchiveRedactionProofError,
  verifyHistoricalArchiveRedactionEvidence,
} from "./lib/historical-archive-redaction-proof.mjs";

try {
  process.stdout.write(
    `${JSON.stringify(await verifyHistoricalArchiveRedactionEvidence(), null, 2)}\n`,
  );
} catch (error) {
  const failure =
    error instanceof HistoricalArchiveRedactionProofError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : {
          status: "FAIL",
          code: "UNEXPECTED_ERROR",
          message: "Archive amendment verification failed.",
        };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
