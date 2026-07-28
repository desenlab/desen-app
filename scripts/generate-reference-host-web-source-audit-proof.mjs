import {
  ReferenceHostWebSourceAuditEvidenceError,
  verifyCurrentReferenceHostWebSourceAuditEvidence,
  verifyReferenceHostWebSourceAuditEvidence,
  writeReferenceHostWebSourceAuditEvidence,
} from "./lib/reference-host-web-source-audit-proof.mjs";

try {
  const historical = await verifyReferenceHostWebSourceAuditEvidence();
  const current = await verifyCurrentReferenceHostWebSourceAuditEvidence();
  const preserved = await writeReferenceHostWebSourceAuditEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        result: "PASS",
        message:
          "Preserved immutable M05-T09 receipt after verifying current enduring host evidence.",
        historical,
        current,
        preserved,
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
  process.stderr.write(`${code}: M05-T09 compatibility generation failed safely.\n`);
  process.exitCode = 1;
}
