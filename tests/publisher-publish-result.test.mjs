import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  PUBLISH_PIPELINE_STAGES,
  PUBLISH_SOURCE_JSON_LIMITS,
  PUBLISHER_DIAGNOSTIC_REGISTRY,
} from "../packages/publisher/dist/index.js";
import {
  buildPublisherPublishResultEvidence,
  DEFAULT_PUBLISHER_PUBLISH_RESULT_ARTIFACT_PATH,
  PublisherPublishResultEvidenceError,
  verifyPublisherPublishResultEvidence,
  writePublisherPublishResultEvidence,
} from "../scripts/lib/publisher-publish-result-proof.mjs";

function hasEvidenceCode(expectedCode) {
  return (error) => {
    assert.ok(error instanceof PublisherPublishResultEvidenceError);
    assert.equal(error.code, expectedCode);
    return true;
  };
}

test("accepts exact deterministic M06-T01 Publisher result evidence", async () => {
  const result = await verifyPublisherPublishResultEvidence();

  assert.equal(result.result, "PASS");
  assert.equal(result.reviewedRuntimeExports, 7);
  assert.equal(result.reviewedTypeExports, 15);
  assert.equal(result.pipelineStages, 16);
  assert.equal(result.publisherDiagnosticCodes, 2);
  assert.equal(result.packageTests, 13);
  assert.equal(result.compilerNegativeCases, 9);
  assert.equal(result.rootMutationTests, 12);
  assert.equal(result.parseRejectionVectors, 5);
  assert.equal(result.trackedFiles, 10);
  assert.match(result.artifactSha256, /^[0-9a-f]{64}$/u);
});

test("two independent Publisher evidence builds are byte-identical", async () => {
  const first = await buildPublisherPublishResultEvidence();
  const second = await buildPublisherPublishResultEvidence();

  assert.equal(first.artifactBytes.toString("hex"), second.artifactBytes.toString("hex"));
  assert.equal(first.artifactSha256, second.artifactSha256);
  assert.equal(first.artifact.prerequisite.historicalArtifactRewritten, false);
  assert.deepEqual(first.artifact.prerequisite.currentCompatibilityOwnershipPaths, [
    "scripts/generate-reference-host-web-source-audit-proof.mjs",
    "scripts/lib/reference-host-web-source-audit-proof.mjs",
    "scripts/verify-reference-host-web-source-audit.mjs",
    "tests/reference-host-web-source-audit.test.mjs",
  ]);
});

test("rejects stale or one-byte-tampered Publisher evidence and documentation pins", async () => {
  const pristine = await buildPublisherPublishResultEvidence();
  const tampered = Buffer.from(pristine.artifactBytes);
  tampered[tampered.length - 2] ^= 1;

  await assert.rejects(
    verifyPublisherPublishResultEvidence({ artifactBytes: tampered }),
    hasEvidenceCode("PUBLISHER_ARTIFACT_DRIFT"),
  );

  const proofText = await readFile(
    new URL("../docs/proof/PUBLISHER-PUBLISH-RESULT.md", import.meta.url),
    "utf8",
  );
  await assert.rejects(
    verifyPublisherPublishResultEvidence({
      proofText: proofText.replace(pristine.artifactSha256, "0".repeat(64)),
    }),
    hasEvidenceCode("PUBLISHER_PROOF_PIN_DRIFT"),
  );
});

test("rejects pipeline, diagnostic-registry, and finite-limit drift", async () => {
  await assert.rejects(
    buildPublisherPublishResultEvidence({
      verifySnapshot: false,
      pipelineStages: [...PUBLISH_PIPELINE_STAGES].reverse(),
    }),
    hasEvidenceCode("PUBLISHER_STAGE_ORDER_DRIFT"),
  );

  await assert.rejects(
    buildPublisherPublishResultEvidence({
      verifySnapshot: false,
      registry: Object.freeze(PUBLISHER_DIAGNOSTIC_REGISTRY.slice(1)),
    }),
    hasEvidenceCode("PUBLISHER_DIAGNOSTIC_REGISTRY_DRIFT"),
  );

  await assert.rejects(
    buildPublisherPublishResultEvidence({
      verifySnapshot: false,
      sourceLimits: { ...PUBLISH_SOURCE_JSON_LIMITS, maxJsonDepth: 255 },
    }),
    hasEvidenceCode("PUBLISHER_LIMIT_PROFILE_DRIFT"),
  );
});

test("rejects C-011 or PIPE-025 trace ownership drift", async () => {
  const trace = JSON.parse(
    await readFile(
      new URL("../docs/proof/protocol-0.1.0-traceability.json", import.meta.url),
      "utf8",
    ),
  );
  trace.pipelineSteps.find(({ id }) => id === "PIPE-025").owners = ["M06-T99"];

  await assert.rejects(
    buildPublisherPublishResultEvidence({ verifySnapshot: false, trace }),
    hasEvidenceCode("PUBLISHER_TRACE_DRIFT"),
  );
});

test("rejects a public partial parser or wildcard export", async () => {
  const indexSource = await readFile(
    new URL("../packages/publisher/src/index.ts", import.meta.url),
    "utf8",
  );

  await assert.rejects(
    buildPublisherPublishResultEvidence({
      verifySnapshot: false,
      indexSource: `${indexSource}\nexport * from "./source-json.js";\n`,
    }),
    hasEvidenceCode("PUBLISHER_PARTIAL_API_EXPOSED"),
  );

  await assert.rejects(
    buildPublisherPublishResultEvidence({
      verifySnapshot: false,
      indexSource: `import { parseSourceJson as hiddenParser } from "./source-json.js";\n${indexSource}\nexport { hiddenParser as publishRaw };\n`,
    }),
    hasEvidenceCode("PUBLISHER_PARTIAL_API_EXPOSED"),
  );

  const declarationIndexSource = await readFile(
    new URL("../packages/publisher/dist/index.d.ts", import.meta.url),
    "utf8",
  );
  await assert.rejects(
    buildPublisherPublishResultEvidence({
      verifySnapshot: false,
      indexSource: `${indexSource}\nexport { publishRaw } from "./source-json.js";\n`,
      declarationIndexSource: `${declarationIndexSource}\nexport { publishRaw } from "./source-json.js";\n`,
    }),
    hasEvidenceCode("PUBLISHER_PARTIAL_API_EXPOSED"),
  );

  await assert.rejects(
    buildPublisherPublishResultEvidence({
      verifySnapshot: false,
      indexSource: `${indexSource}\nexport { createPublishFailure } from "./publish-diagnostics.js";\n`,
      declarationIndexSource: `${declarationIndexSource}\nexport { createPublishFailure } from "./publish-diagnostics.js";\n`,
    }),
    hasEvidenceCode("PUBLISHER_PARTIAL_API_EXPOSED"),
  );

  await assert.rejects(
    buildPublisherPublishResultEvidence({
      verifySnapshot: false,
      declarationIndexSource: declarationIndexSource.replace(
        "PublishResult,",
        "ChangedPublishResult,",
      ),
    }),
    hasEvidenceCode("PUBLISHER_PUBLIC_API_DRIFT"),
  );
});

test("rejects forbidden platform edges and dependency drift", async () => {
  await assert.rejects(
    buildPublisherPublishResultEvidence({
      verifySnapshot: false,
      productionSource: 'import "node:fs";\nexport const value = process.cwd();\n',
    }),
    hasEvidenceCode("PUBLISHER_PLATFORM_BOUNDARY_DRIFT"),
  );

  const publisherPackage = JSON.parse(
    await readFile(new URL("../packages/publisher/package.json", import.meta.url), "utf8"),
  );
  publisherPackage.dependencies.react = "19.2.4";
  await assert.rejects(
    buildPublisherPublishResultEvidence({ verifySnapshot: false, publisherPackage }),
    hasEvidenceCode("PUBLISHER_DEPENDENCY_DRIFT"),
  );

  const brokenEntry = structuredClone(publisherPackage);
  delete brokenEntry.dependencies.react;
  brokenEntry.exports["."].types = "./dist/missing.d.ts";
  await assert.rejects(
    buildPublisherPublishResultEvidence({
      verifySnapshot: false,
      publisherPackage: brokenEntry,
    }),
    hasEvidenceCode("PUBLISHER_PACKAGE_ENTRY_DRIFT"),
  );

  const publicParserSubpath = structuredClone(brokenEntry);
  publicParserSubpath.exports["."].types = "./dist/index.d.ts";
  publicParserSubpath.exports["./source-json"] = {
    types: "./dist/source-json.d.ts",
    import: "./dist/source-json.js",
  };
  await assert.rejects(
    buildPublisherPublishResultEvidence({
      verifySnapshot: false,
      publisherPackage: publicParserSubpath,
    }),
    hasEvidenceCode("PUBLISHER_PACKAGE_ENTRY_DRIFT"),
  );
});

test("rejects a parser that exposes partial data or a Bundle on failure", async () => {
  const parser = () =>
    Object.freeze({
      ok: false,
      stage: "json-parse",
      bundle: Object.freeze({}),
      value: Object.freeze({}),
      diagnostics: Object.freeze([]),
    });

  await assert.rejects(
    buildPublisherPublishResultEvidence({ verifySnapshot: false, parser }),
    hasEvidenceCode("PUBLISHER_PARSE_VECTOR_FAILED"),
  );
});

test("rejects root command-wiring and G05 prerequisite drift", async () => {
  const workspacePackage = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );
  workspacePackage.scripts["verify:publisher-publish-result"] = "echo skipped";
  await assert.rejects(
    buildPublisherPublishResultEvidence({ verifySnapshot: false, workspacePackage }),
    hasEvidenceCode("PUBLISHER_COMMAND_WIRING_DRIFT"),
  );

  const publisherPackage = JSON.parse(
    await readFile(new URL("../packages/publisher/package.json", import.meta.url), "utf8"),
  );
  for (const script of ["build", "typecheck"]) {
    const changed = structuredClone(publisherPackage);
    changed.scripts[script] = 'node --eval "void 0"';
    await assert.rejects(
      buildPublisherPublishResultEvidence({
        verifySnapshot: false,
        publisherPackage: changed,
      }),
      hasEvidenceCode("PUBLISHER_COMMAND_WIRING_DRIFT"),
    );
  }

  const publisherTsconfig = JSON.parse(
    await readFile(new URL("../packages/publisher/tsconfig.json", import.meta.url), "utf8"),
  );
  const withoutTestInclude = structuredClone(publisherTsconfig);
  withoutTestInclude.include = withoutTestInclude.include.filter(
    (pattern) => !pattern.startsWith("test/"),
  );
  const excludingTests = structuredClone(publisherTsconfig);
  excludingTests.exclude = ["test/**/*"];
  const withoutTypeChecking = structuredClone(publisherTsconfig);
  withoutTypeChecking.compilerOptions.noCheck = true;
  for (const changed of [withoutTestInclude, excludingTests, withoutTypeChecking]) {
    await assert.rejects(
      buildPublisherPublishResultEvidence({
        verifySnapshot: false,
        publisherTsconfig: changed,
      }),
      hasEvidenceCode("PUBLISHER_COMPILER_CONFIGURATION_DRIFT"),
    );
  }

  const publisherBuildTsconfig = JSON.parse(
    await readFile(new URL("../packages/publisher/tsconfig.build.json", import.meta.url), "utf8"),
  );
  publisherBuildTsconfig.compilerOptions.rootDir = ".";
  await assert.rejects(
    buildPublisherPublishResultEvidence({
      verifySnapshot: false,
      publisherBuildTsconfig,
    }),
    hasEvidenceCode("PUBLISHER_COMPILER_CONFIGURATION_DRIFT"),
  );

  const prerequisite = await readFile(
    new URL("../docs/proof/artifacts/reference-host-web-0.1.0-source-audit.json", import.meta.url),
  );
  prerequisite[0] ^= 1;
  await assert.rejects(
    buildPublisherPublishResultEvidence({
      verifySnapshot: false,
      prerequisiteBytes: prerequisite,
    }),
    hasEvidenceCode("PUBLISHER_PREREQUISITE_DRIFT"),
  );
});

test("keeps T01 evidence byte-stable for later unrelated exports and diagnostics", async () => {
  const [indexSource, declarationIndexSource] = await Promise.all([
    readFile(new URL("../packages/publisher/src/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../packages/publisher/dist/index.d.ts", import.meta.url), "utf8"),
  ]);
  const baseline = await buildPublisherPublishResultEvidence({ verifySnapshot: false });
  const futureDefinition = Object.freeze({
    code: "run.desen.publisher/FUTURE_WARNING",
    meaning: "A later Publisher task warning.",
    defaultStage: "source-semantics",
    defaultSeverity: "warning",
  });
  const registry = Object.freeze([...PUBLISHER_DIAGNOSTIC_REGISTRY, futureDefinition]);
  const lookup = (code) => registry.find((definition) => definition.code === code);
  const guard = (code) => lookup(code) !== undefined;
  const future = await buildPublisherPublishResultEvidence({
    verifySnapshot: false,
    indexSource: `${indexSource}\nexport { futurePublisherEntry } from "./publisher.js";\n`,
    declarationIndexSource: `${declarationIndexSource}\nexport { futurePublisherEntry } from "./publisher.js";\n`,
    registry,
    lookup,
    guard,
  });

  assert.deepEqual(future.artifactBytes, baseline.artifactBytes);
});

test("derives and enforces focused runtime, compiler, and root-test inventory", async () => {
  const [packageTestSource, compilerTypeSource, rootTestSource] = await Promise.all([
    readFile(new URL("../packages/publisher/test/publish-result.test.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../packages/publisher/test/publish-result.types.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("./publisher-publish-result.test.mjs", import.meta.url), "utf8"),
  ]);
  for (const override of [
    { packageTestSource: packageTestSource.replace("  it(", "  untrackedCase(") },
    {
      compilerTypeSource: compilerTypeSource.replace("@ts-expect-error", "@untracked-type-error"),
    },
    { rootTestSource: rootTestSource.replace("\ntest(", "\nuntrackedTest(") },
  ]) {
    await assert.rejects(
      buildPublisherPublishResultEvidence({ verifySnapshot: false, ...override }),
      hasEvidenceCode("PUBLISHER_TEST_INVENTORY_DRIFT"),
    );
  }
});

test("atomic evidence writer rejects destination symlinks and pre-rename byte tampering", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-publisher-proof-"));
  t.after(() => rm(directory, { force: true, recursive: true }));

  const symlinkTarget = path.join(directory, "target.json");
  const symlinkPath = path.join(directory, "artifact-link.json");
  await writeFile(symlinkTarget, "{}\n");
  await symlink(symlinkTarget, symlinkPath);
  await assert.rejects(
    writePublisherPublishResultEvidence({ artifactPath: symlinkPath }),
    TypeError,
  );

  const tamperedPath = path.join(directory, "tampered.json");
  await assert.rejects(
    writePublisherPublishResultEvidence({
      artifactPath: tamperedPath,
      beforeAtomicRename: async ({ temporaryPath }) => {
        await writeFile(temporaryPath, "tampered\n");
      },
    }),
    TypeError,
  );
  await assert.rejects(readFile(tamperedPath), { code: "ENOENT" });

  assert.equal(
    path.basename(DEFAULT_PUBLISHER_PUBLISH_RESULT_ARTIFACT_PATH),
    "publisher-0.1.0-publish-result.json",
  );
});
