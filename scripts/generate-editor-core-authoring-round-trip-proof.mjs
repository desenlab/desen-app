import {
  EditorCoreAuthoringRoundTripProofError,
  writeEditorCoreAuthoringRoundTripEvidence,
} from "./lib/editor-core-authoring-round-trip-proof.mjs";

try {
  const result = await writeEditorCoreAuthoringRoundTripEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        task: result.task,
        artifactBytes: result.artifactBytes,
        artifactSha256: result.artifactSha256,
        message: "Wrote deterministic M08-T07 authoring-round-trip evidence.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof EditorCoreAuthoringRoundTripProofError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
