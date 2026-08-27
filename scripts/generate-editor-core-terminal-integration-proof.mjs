import {
  EditorCoreTerminalIntegrationProofError,
  writeEditorCoreTerminalIntegrationEvidence,
} from "./lib/editor-core-terminal-integration-proof.mjs";

try {
  const result = await writeEditorCoreTerminalIntegrationEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        task: result.task,
        artifactBytes: result.artifactBytes,
        artifactSha256: result.artifactSha256,
        message: "Wrote deterministic M08-T10 terminal-integration evidence.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof EditorCoreTerminalIntegrationProofError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
