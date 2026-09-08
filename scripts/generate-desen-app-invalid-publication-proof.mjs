import {
  DesenAppInvalidPublicationProofError,
  writeDesenAppInvalidPublicationEvidence,
} from "./lib/desen-app-invalid-publication-proof.mjs";

try {
  const result = await writeDesenAppInvalidPublicationEvidence();
  process.stdout.write(
    `${JSON.stringify({ status: "PASS", ...result, message: "Wrote fresh M10-T06 invalid-publication evidence; Chromium remains independent." }, null, 2)}\n`,
  );
} catch (error) {
  const failure =
    error instanceof DesenAppInvalidPublicationProofError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
