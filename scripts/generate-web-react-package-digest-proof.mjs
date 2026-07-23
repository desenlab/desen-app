import {
  WebReactPackageDigestEvidenceError,
  writeWebReactPackageDigestEvidence,
} from "./lib/web-react-package-digest-proof.mjs";

try {
  const result = await writeWebReactPackageDigestEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "PASS",
        artifactSha256: result.artifactSha256,
        message: "Wrote deterministic M03-T04 Web-React package digest evidence.",
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const failure =
    error instanceof WebReactPackageDigestEvidenceError
      ? { status: "FAIL", code: error.code, message: error.message, details: error.details }
      : { status: "FAIL", code: "UNEXPECTED_ERROR", message: String(error) };
  process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exitCode = 1;
}
