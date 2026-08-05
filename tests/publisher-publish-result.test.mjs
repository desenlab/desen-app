import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { brotliDecompressSync } from "node:zlib";

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

// Reconstructs the exact stale M07-T03 bytes from the live M07-T04 fixture so the rollback
// regression remains cryptographic, deterministic, and independent from Git or child processes.
const M07_T03_SOURCE_AUDIT_RECONSTRUCTION_PATCH = `
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
Q4QIlezsGt+U7CbIvRJrDgs=
`.replaceAll(/\s/gu, "");

function reconstructM07T03SourceAuditProof(currentBytes) {
  const patchText = brotliDecompressSync(
    Buffer.from(M07_T03_SOURCE_AUDIT_RECONSTRUCTION_PATCH, "base64"),
  ).toString("utf8");
  const currentLines = currentBytes.toString("utf8").split("\n");
  const patchLines = patchText.split("\n");
  const reconstructedLines = [];
  let currentIndex = 0;
  let patchIndex = 0;

  while (patchIndex < patchLines.length) {
    const header = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/u.exec(patchLines[patchIndex]);
    if (header === null) {
      patchIndex += 1;
      continue;
    }
    const currentStart = Number(header[1]) - 1;
    const expectedCurrentCount = Number(header[2] ?? "1");
    const expectedReconstructedCount = Number(header[4] ?? "1");
    assert.ok(currentStart >= currentIndex);
    reconstructedLines.push(...currentLines.slice(currentIndex, currentStart));
    currentIndex = currentStart;
    patchIndex += 1;
    let currentCount = 0;
    let reconstructedCount = 0;

    while (patchIndex < patchLines.length && !patchLines[patchIndex].startsWith("@@ ")) {
      const patchLine = patchLines[patchIndex];
      if (patchLine === "\\ No newline at end of file") {
        patchIndex += 1;
        continue;
      }
      const marker = patchLine[0];
      const content = patchLine.slice(1);
      if (marker === " ") {
        assert.equal(currentLines[currentIndex], content);
        reconstructedLines.push(content);
        currentIndex += 1;
        currentCount += 1;
        reconstructedCount += 1;
      } else if (marker === "-") {
        assert.equal(currentLines[currentIndex], content);
        currentIndex += 1;
        currentCount += 1;
      } else if (marker === "+") {
        reconstructedLines.push(content);
        reconstructedCount += 1;
      } else {
        break;
      }
      patchIndex += 1;
    }
    assert.equal(currentCount, expectedCurrentCount);
    assert.equal(reconstructedCount, expectedReconstructedCount);
  }

  reconstructedLines.push(...currentLines.slice(currentIndex));
  return Buffer.from(reconstructedLines.join("\n"), "utf8");
}

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
  assert.equal(
    first.artifactSha256,
    "aefed86741562bfa0f4bcbe163af50c8471dd6bf5979b7da36d681728536ff63",
  );
  assert.equal(first.artifact.prerequisite.historicalArtifactRewritten, false);
  assert.deepEqual(first.artifact.prerequisite.currentCompatibilityOwnershipPaths, [
    "scripts/generate-reference-host-web-source-audit-proof.mjs",
    "scripts/lib/reference-host-web-source-audit-proof.mjs",
    "scripts/verify-reference-host-web-source-audit.mjs",
    "tests/reference-host-web-source-audit.test.mjs",
  ]);

  const currentCompatibilityBytes = Object.fromEntries(
    await Promise.all(
      [
        "scripts/lib/reference-host-web-source-audit-proof.mjs",
        "tests/reference-host-web-source-audit.test.mjs",
      ].map(async (relativePath) => [
        relativePath,
        await readFile(new URL(`../${relativePath}`, import.meta.url)),
      ]),
    ),
  );
  const projected = await buildPublisherPublishResultEvidence({
    verifySnapshot: false,
    trackedFileBytes: currentCompatibilityBytes,
  });
  assert.deepEqual(projected.artifactBytes, first.artifactBytes);

  const sourceAuditProofPath = "scripts/lib/reference-host-web-source-audit-proof.mjs";
  const staleM07T03Bytes = reconstructM07T03SourceAuditProof(
    currentCompatibilityBytes[sourceAuditProofPath],
  );
  assert.equal(staleM07T03Bytes.byteLength, 246_554);
  assert.equal(
    createHash("sha256").update(staleM07T03Bytes).digest("hex"),
    "2bf728948372d8366f7badc7f2d7a36f6b8799b0dcc45baef92c29c90bdd2114",
  );
  await assert.rejects(
    buildPublisherPublishResultEvidence({
      verifySnapshot: false,
      trackedFileBytes: { [sourceAuditProofPath]: staleM07T03Bytes },
    }),
    hasEvidenceCode("PUBLISHER_G05_COMPATIBILITY_READER_DRIFT"),
  );

  const compatibilityPaths = Object.keys(currentCompatibilityBytes);
  for (const [relativePath, bytes] of Object.entries(currentCompatibilityBytes)) {
    await assert.rejects(
      buildPublisherPublishResultEvidence({
        verifySnapshot: false,
        trackedFileBytes: { [relativePath]: Buffer.alloc(0) },
      }),
      hasEvidenceCode("PUBLISHER_G05_COMPATIBILITY_READER_DRIFT"),
    );
    const substitutedPath = compatibilityPaths.find((candidate) => candidate !== relativePath);
    assert.notEqual(substitutedPath, undefined);
    await assert.rejects(
      buildPublisherPublishResultEvidence({
        verifySnapshot: false,
        trackedFileBytes: { [relativePath]: currentCompatibilityBytes[substitutedPath] },
      }),
      hasEvidenceCode("PUBLISHER_G05_COMPATIBILITY_READER_DRIFT"),
    );
    const tampered = Buffer.from(bytes);
    tampered[Math.floor(tampered.byteLength / 2)] ^= 1;
    await assert.rejects(
      buildPublisherPublishResultEvidence({
        verifySnapshot: false,
        trackedFileBytes: { [relativePath]: tampered },
      }),
      hasEvidenceCode("PUBLISHER_G05_COMPATIBILITY_READER_DRIFT"),
    );
    await assert.rejects(
      buildPublisherPublishResultEvidence({
        verifySnapshot: false,
        trackedFileBytes: {
          [relativePath]: Buffer.concat([bytes, Buffer.from("\n// unreviewed successor\n")]),
        },
      }),
      hasEvidenceCode("PUBLISHER_G05_COMPATIBILITY_READER_DRIFT"),
    );
  }

  await assert.rejects(
    buildPublisherPublishResultEvidence({
      verifySnapshot: false,
      reviewedG05CompatibilityReceiptHistory: {},
    }),
    hasEvidenceCode("PUBLISHER_OPTIONS_INVALID"),
  );
  await assert.rejects(
    buildPublisherPublishResultEvidence({
      verifySnapshot: false,
      reviewedG05CompatibilityReceiptHistory: {
        "scripts/lib/reference-host-web-source-audit-proof.mjs": [
          {
            task: "caller-substitution",
            bytes:
              currentCompatibilityBytes["scripts/lib/reference-host-web-source-audit-proof.mjs"]
                .byteLength,
            sha256: "0".repeat(64),
          },
        ],
      },
    }),
    hasEvidenceCode("PUBLISHER_OPTIONS_INVALID"),
  );
  await assert.rejects(
    buildPublisherPublishResultEvidence({
      verifySnapshot: false,
      trackedFileBytes: {
        "scripts/lib/publisher-publish-result-proof.mjs": Buffer.from("caller authority"),
      },
    }),
    hasEvidenceCode("PUBLISHER_OPTIONS_INVALID"),
  );
  const accessorOptions = { verifySnapshot: false };
  Object.defineProperty(accessorOptions, "trackedFileBytes", {
    enumerable: true,
    get() {
      return currentCompatibilityBytes;
    },
  });
  await assert.rejects(
    buildPublisherPublishResultEvidence(accessorOptions),
    hasEvidenceCode("PUBLISHER_OPTIONS_INVALID"),
  );

  const compatibilityPath = "scripts/lib/reference-host-web-source-audit-proof.mjs";
  const poisonedCandidate = Buffer.from(currentCompatibilityBytes[compatibilityPath]);
  poisonedCandidate[Math.floor(poisonedCandidate.byteLength / 3)] ^= 1;
  const originalEntries = Object.entries;
  try {
    Object.entries = (value) => {
      if (
        Object.getPrototypeOf(value) === null &&
        Object.keys(value).length === 1 &&
        Object.hasOwn(value, compatibilityPath)
      ) {
        return [[compatibilityPath, currentCompatibilityBytes[compatibilityPath]]];
      }
      return originalEntries(value);
    };
    await assert.rejects(
      buildPublisherPublishResultEvidence({
        verifySnapshot: false,
        trackedFileBytes: { [compatibilityPath]: poisonedCandidate },
      }),
      hasEvidenceCode("PUBLISHER_G05_COMPATIBILITY_READER_DRIFT"),
    );
  } finally {
    Object.entries = originalEntries;
  }

  const originalFreeze = Object.freeze;
  let freezeSubstitutions = 0;
  try {
    Object.freeze = (value) => {
      if (
        value !== null &&
        typeof value === "object" &&
        Object.getPrototypeOf(value) === null &&
        Object.hasOwn(value, compatibilityPath)
      ) {
        freezeSubstitutions += 1;
        return { [compatibilityPath]: currentCompatibilityBytes[compatibilityPath] };
      }
      return originalFreeze(value);
    };
    await assert.rejects(
      buildPublisherPublishResultEvidence({
        verifySnapshot: false,
        trackedFileBytes: { [compatibilityPath]: poisonedCandidate },
      }),
      hasEvidenceCode("PUBLISHER_G05_COMPATIBILITY_READER_DRIFT"),
    );
    assert.equal(freezeSubstitutions, 0);
  } finally {
    Object.freeze = originalFreeze;
  }
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
