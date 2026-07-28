import {
  DEFAULT_REFERENCE_HOST_WEB_SHELL_ARTIFACT_PATH,
  ReferenceHostWebShellEvidenceError,
  writeReferenceHostWebShellEvidence,
} from "./lib/reference-host-web-shell-proof.mjs";

try {
  const result = await writeReferenceHostWebShellEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        result: result.result,
        message: "Wrote deterministic M05-T07 reference-host shell evidence.",
        artifact: DEFAULT_REFERENCE_HOST_WEB_SHELL_ARTIFACT_PATH,
        sha256: result.artifactSha256,
        bytes: result.artifactBytes,
        trackedFiles: result.trackedFiles,
        focusedTests: result.focusedTests,
        compilerNegativeCases: result.compilerNegativeCases,
        rootMutationTests: result.rootMutationTests,
        buildFiles: result.buildFiles,
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const code =
    error instanceof ReferenceHostWebShellEvidenceError
      ? error.code
      : "REFERENCE_HOST_SHELL_GENERATION_FAILED";
  process.stderr.write(`${code}: M05-T07 evidence generation failed safely.\n`);
  process.exitCode = 1;
}
