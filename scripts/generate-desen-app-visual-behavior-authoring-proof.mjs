import {
  DesenAppVisualBehaviorAuthoringProofError,
  writeDesenAppVisualBehaviorAuthoringEvidence,
} from "./lib/desen-app-visual-behavior-authoring-proof.mjs";

try {
  const result = await writeDesenAppVisualBehaviorAuthoringEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        ...result,
        message: "Wrote deterministic M10-T01B visual-behavior authoring evidence.",
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
