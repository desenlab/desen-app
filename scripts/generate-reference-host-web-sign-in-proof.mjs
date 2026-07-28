import {
  DEFAULT_REFERENCE_HOST_WEB_SIGN_IN_ARTIFACT_PATH,
  ReferenceHostWebSignInEvidenceError,
  writeReferenceHostWebSignInEvidence,
} from "./lib/reference-host-web-sign-in-proof.mjs";

try {
  const result = await writeReferenceHostWebSignInEvidence();
  process.stdout.write(
    `${JSON.stringify(
      {
        result: result.result,
        message: "Generated deterministic M05-T08 reference-host sign-in evidence.",
        artifact: DEFAULT_REFERENCE_HOST_WEB_SIGN_IN_ARTIFACT_PATH,
        sha256: result.artifactSha256,
        bytes: result.artifactBytes,
        trackedFiles: result.trackedFiles,
        sourceAssertions: result.sourceAssertions,
        focusedTests: result.focusedTests,
        fullAppTests: result.fullAppTests,
        compilerNegativeCases: result.compilerNegativeCases,
        rootMutationTests: result.rootMutationTests,
        traceEntries: result.traceEntries,
        buildFiles: result.buildFiles,
        buildAggregateSha256: result.buildAggregateSha256,
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const code =
    error instanceof ReferenceHostWebSignInEvidenceError
      ? error.code
      : "REFERENCE_HOST_SIGN_IN_GENERATION_FAILED";
  process.stderr.write(`${code}: M05-T08 evidence generation failed safely.\n`);
  process.exitCode = 1;
}
