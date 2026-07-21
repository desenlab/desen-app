import process from "node:process";

import {
  StructuralValidatorCodegenError,
  verifyStructuralValidatorArtifact,
} from "./lib/structural-validator-codegen.mjs";

try {
  const result = await verifyStructuralValidatorArtifact();
  process.stdout.write(`${JSON.stringify({ status: "PASS", ...result }, null, 2)}\n`);
} catch (error) {
  const failure =
    error instanceof StructuralValidatorCodegenError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
