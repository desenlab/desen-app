import {
  ReferenceHostWebChannelConsumptionEvidenceError,
  writeReferenceHostWebChannelConsumptionEvidence,
} from "./lib/reference-host-web-channel-consumption-proof.mjs";

try {
  const result = await writeReferenceHostWebChannelConsumptionEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        artifactSha256: result.artifactSha256,
        message: "Wrote deterministic M07-T11 reference-host channel-consumption evidence.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof ReferenceHostWebChannelConsumptionEvidenceError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
