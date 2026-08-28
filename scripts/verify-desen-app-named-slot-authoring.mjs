import {
  DesenAppNamedSlotAuthoringProofError,
  verifyDesenAppNamedSlotAuthoringEvidence,
} from "./lib/desen-app-named-slot-authoring-proof.mjs";

try {
  const result = await verifyDesenAppNamedSlotAuthoringEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        ...result,
        message: "Verified deterministic M09-T07 named-slot placement and deletion evidence.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof DesenAppNamedSlotAuthoringProofError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
