import {
  DesenAppInvalidPublicationProofError,
  verifyDesenAppInvalidPublicationEvidence,
} from "./lib/desen-app-invalid-publication-proof.mjs";

try {
  const result = await verifyDesenAppInvalidPublicationEvidence();
  process.stdout.write(
    `${JSON.stringify({ status: "PASS", ...result, message: "Verified fresh public-API rejection/repair and current App/host graphs; no Chromium or listener started." }, null, 2)}\n`,
  );
} catch (error) {
  const failure =
    error instanceof DesenAppInvalidPublicationProofError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
