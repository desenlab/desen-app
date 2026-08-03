import process from "node:process";

import {
  PackagePreflightCatalogGuardCodegenError,
  verifyPackagePreflightCatalogGuardArtifact,
} from "./lib/package-preflight-catalog-guard-codegen.mjs";

try {
  const receipt = await verifyPackagePreflightCatalogGuardArtifact();
  process.stdout.write(`${JSON.stringify({ status: "PASS", ...receipt }, null, 2)}\n`);
} catch (error) {
  const failure =
    error instanceof PackagePreflightCatalogGuardCodegenError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
