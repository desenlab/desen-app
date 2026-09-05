import {
  DesenAppPublishedHostUpdateProofError,
  verifyDesenAppPublishedHostUpdateEvidence,
} from "./lib/desen-app-published-host-update-proof.mjs";

try {
  const result = await verifyDesenAppPublishedHostUpdateEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        ...result,
        message:
          "Verified deterministic M10-T05 evidence with fresh Vite audits and without starting Chromium, a listener, or a product server.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof DesenAppPublishedHostUpdateProofError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
