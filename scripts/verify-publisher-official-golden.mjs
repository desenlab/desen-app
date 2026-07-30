import {
  PublisherOfficialGoldenEvidenceError,
  verifyPublisherOfficialGoldenEvidence,
} from "./lib/publisher-official-golden-proof.mjs";

try {
  const result = await verifyPublisherOfficialGoldenEvidence();
  process.stdout.write(`${JSON.stringify({ status: "PASS", ...result }, null, 2)}\n`);
} catch (error) {
  const failure =
    error instanceof PublisherOfficialGoldenEvidenceError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
