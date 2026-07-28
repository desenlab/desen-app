import { Sc01DtcgAuditError, writeSc01DtcgEvidence } from "./lib/sc-01-dtcg-audit.mjs";

try {
  const result = await writeSc01DtcgEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        classification: result.artifact.classification,
        artifactSha256: result.artifactSha256,
        tokens: result.artifact.auditedReferenceDocument.leafCount,
        reviewedUnsupportedFeatures:
          result.artifact.evidence.compatibilityFixtureCounts.reviewedUnsupportedFeatures,
        compatibilityMode: result.compatibilityMode,
        preserved: result.preserved,
        message: "Preserved the immutable task-time SC-01 DTCG compatibility proof.",
      },
      null,
      2,
    )}\n`,
  );
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
