import {
  DesenAppVisualBehaviorAuthoringProofError,
  verifyDesenAppVisualBehaviorAuthoringEvidence,
} from "./lib/desen-app-visual-behavior-authoring-proof.mjs";

try {
  const result = await verifyDesenAppVisualBehaviorAuthoringEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        ...result,
        message:
          "Verified deterministic M10-T01B visual-behavior evidence; Chromium remains owned by the separate Browser E2E job.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof DesenAppVisualBehaviorAuthoringProofError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
