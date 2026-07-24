import {
  RuntimeCoreHostPortsEvidenceError,
  writeRuntimeCoreHostPortsEvidence,
} from "./lib/runtime-core-host-ports-proof.mjs";

try {
  const result = await writeRuntimeCoreHostPortsEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        artifactSha256: result.artifactSha256,
        message: "Wrote deterministic M04-T01 runtime host-port evidence.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof RuntimeCoreHostPortsEvidenceError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
