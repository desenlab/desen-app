import {
  DesenAppBrowserE2eWorkspaceCompatibilityProofError,
  verifyDesenAppBrowserE2eWorkspaceCompatibilityEvidence,
} from "./lib/desen-app-browser-e2e-workspace-compatibility-proof.mjs";

try {
  const result = await verifyDesenAppBrowserE2eWorkspaceCompatibilityEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        ...result,
        message:
          "Verified deterministic M10-T01 compatibility evidence; browser execution remains owned by the separate Browser E2E job.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof DesenAppBrowserE2eWorkspaceCompatibilityProofError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
