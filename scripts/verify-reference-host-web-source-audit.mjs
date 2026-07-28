import {
  DEFAULT_REFERENCE_HOST_WEB_SOURCE_AUDIT_ARTIFACT_PATH,
  ReferenceHostWebSourceAuditEvidenceError,
  verifyReferenceHostWebSourceAuditEvidence,
} from "./lib/reference-host-web-source-audit-proof.mjs";

try {
  const result = await verifyReferenceHostWebSourceAuditEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        result: result.result,
        message: "Verified deterministic M05-T09 reference-host source/import audit evidence.",
        artifact: DEFAULT_REFERENCE_HOST_WEB_SOURCE_AUDIT_ARTIFACT_PATH,
        sha256: result.artifactSha256,
        bytes: result.artifactBytes,
        trackedFiles: result.trackedFiles,
        sourceFiles: result.sourceFiles,
        sourceAssertions: result.sourceAssertions,
        jsxElements: result.jsxElements,
        graphModules: result.graphModules,
        graphStaticEdges: result.graphStaticEdges,
        graphDynamicEdges: result.graphDynamicEdges,
        graphSha256: result.graphSha256,
        packageBoundaryViolations: result.packageBoundaryViolations,
        exactDocumentationReferences: result.exactDocumentationReferences,
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const code =
    error instanceof ReferenceHostWebSourceAuditEvidenceError
      ? error.code
      : "REFERENCE_HOST_SOURCE_AUDIT_VERIFICATION_FAILED";
  process.stderr.write(`${code}: M05-T09 evidence verification failed safely.\n`);
  process.exitCode = 1;
}
