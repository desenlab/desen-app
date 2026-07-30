import {
  ReferenceHostWebSourceAuditEvidenceError,
  verifyCurrentReferenceHostWebSourceAuditEvidence,
  verifyReferenceHostWebSourceAuditEvidence,
} from "./lib/reference-host-web-source-audit-proof.mjs";

try {
  const historical = await verifyReferenceHostWebSourceAuditEvidence();
  const current = await verifyCurrentReferenceHostWebSourceAuditEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        result: "PASS",
        message: "Verified immutable M05-T09 receipt and current enduring reference-host evidence.",
        historical,
        current,
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
  process.stderr.write(`${code}: M05-T09 compatibility verification failed safely.\n`);
  process.exitCode = 1;
}
