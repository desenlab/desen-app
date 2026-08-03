import process from "node:process";

import {
  BundleVerificationGuardCodegenError,
  generateBundleVerificationGuards,
  verifyBundleVerificationGuardArtifact,
  writeBundleVerificationGuardArtifact,
} from "./lib/bundle-verification-guard-codegen.mjs";

try {
  const generated = await generateBundleVerificationGuards();
  await writeBundleVerificationGuardArtifact(generated);
  const receipt = await verifyBundleVerificationGuardArtifact();
  process.stdout.write(`${JSON.stringify({ status: "PASS", ...receipt }, null, 2)}\n`);
} catch (error) {
  const failure =
    error instanceof BundleVerificationGuardCodegenError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
