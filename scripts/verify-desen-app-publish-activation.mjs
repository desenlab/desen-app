import {
  DesenAppPublishActivationProofError,
  verifyDesenAppPublishActivationEvidence,
} from "./lib/desen-app-publish-activation-proof.mjs";

try {
  const result = await verifyDesenAppPublishActivationEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        ...result,
        message: "Verified deterministic M09-T14/G09 publication and activation evidence.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof DesenAppPublishActivationProofError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
