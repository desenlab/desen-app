import {
  DesenAppSchemaInspectorProofError,
  writeDesenAppSchemaInspectorEvidence,
} from "./lib/desen-app-schema-inspector-proof.mjs";

try {
  const result = await writeDesenAppSchemaInspectorEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        ...result,
        message: "Wrote deterministic M09-T05 schema-inspector evidence.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof DesenAppSchemaInspectorProofError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
