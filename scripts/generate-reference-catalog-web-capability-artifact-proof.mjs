import {
  ReferenceCatalogWebCapabilityArtifactEvidenceError,
  writeReferenceCatalogWebCapabilityArtifactEvidence,
} from "./lib/reference-catalog-web-capability-artifact-proof.mjs";

try {
  const result = await writeReferenceCatalogWebCapabilityArtifactEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        catalogSha256: result.catalogSha256,
        artifactSha256: result.artifactSha256,
        packageDigest: result.artifact.tuple.packageDigest,
        files: result.artifact.inventory.files,
        message: "Wrote the deterministic M03-T10 Catalog and capability-artifact proof.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof ReferenceCatalogWebCapabilityArtifactEvidenceError
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
