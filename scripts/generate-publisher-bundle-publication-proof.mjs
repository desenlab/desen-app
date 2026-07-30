import {
  PublisherBundlePublicationEvidenceError,
  writePublisherBundlePublicationEvidence,
} from "./lib/publisher-bundle-publication-proof.mjs";

try {
  const result = await writePublisherBundlePublicationEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        artifactSha256: result.artifactSha256,
        message: "Wrote deterministic M06-T09 Publisher Bundle-publication evidence.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof PublisherBundlePublicationEvidenceError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
