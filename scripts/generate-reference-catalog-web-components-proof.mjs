import {
  ReferenceCatalogWebComponentsEvidenceError,
  writeReferenceCatalogWebComponentsEvidence,
} from "./lib/reference-catalog-web-components-proof.mjs";

try {
  const result = await writeReferenceCatalogWebComponentsEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        artifactSha256: result.artifactSha256,
        message: "Wrote deterministic M03-T05 reference Web component evidence.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof ReferenceCatalogWebComponentsEvidenceError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
