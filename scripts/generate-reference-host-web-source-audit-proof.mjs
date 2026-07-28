import { readFile } from "node:fs/promises";

import {
  DEFAULT_REFERENCE_HOST_WEB_SOURCE_AUDIT_ARTIFACT_PATH,
  DEFAULT_REFERENCE_HOST_WEB_SOURCE_AUDIT_PROOF_PATH,
  ReferenceHostWebSourceAuditEvidenceError,
  verifyReferenceHostWebSourceAuditProofDocument,
  writeReferenceHostWebSourceAuditEvidence,
} from "./lib/reference-host-web-source-audit-proof.mjs";

const PENDING_SHA256 = "[PENDING_FINAL_ARTIFACT_SHA256]";

try {
  const proofDocument = await readFile(DEFAULT_REFERENCE_HOST_WEB_SOURCE_AUDIT_PROOF_PATH, "utf8");
  const pending = proofDocument.includes(PENDING_SHA256);
  if (pending) {
    verifyReferenceHostWebSourceAuditProofDocument(proofDocument, PENDING_SHA256, {
      allowPending: true,
    });
  }
  const result = await writeReferenceHostWebSourceAuditEvidence({
    proofDocumentText: proofDocument,
  });
  process.stdout.write(
    `${JSON.stringify(
      {
        result: result.result,
        message: "Generated deterministic M05-T09 reference-host source/import audit evidence.",
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
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const code =
    error instanceof ReferenceHostWebSourceAuditEvidenceError
      ? error.code
      : "REFERENCE_HOST_SOURCE_AUDIT_GENERATION_FAILED";
  process.stderr.write(`${code}: M05-T09 evidence generation failed safely.\n`);
  process.exitCode = 1;
}
