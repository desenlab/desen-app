import {
  ReferenceTokensAndSyntheticFixturesEvidenceError,
  writeReferenceTokensAndSyntheticFixturesEvidence,
} from "./lib/reference-tokens-and-synthetic-fixtures-proof.mjs";

try {
  const result = await writeReferenceTokensAndSyntheticFixturesEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        artifactSha256: result.artifactSha256,
        message: "Wrote deterministic M03-T07 reference-token and synthetic-fixture evidence.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof ReferenceTokensAndSyntheticFixturesEvidenceError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
