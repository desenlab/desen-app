import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  PUBLISH_SOURCE_PREFLIGHT_LIMITS,
  preflightPublishSource,
} from "../packages/publisher/dist/source-preflight.js";
import {
  DEFAULT_PUBLISHER_SOURCE_PREFLIGHT_ARTIFACT_PATH,
  buildPublisherSourcePreflightEvidence,
  PublisherSourcePreflightEvidenceError,
  verifyPublisherSourcePreflightEvidence,
  writePublisherSourcePreflightEvidence,
} from "../scripts/lib/publisher-source-preflight-proof.mjs";

function hasCode(code) {
  return (error) => {
    assert.ok(error instanceof PublisherSourcePreflightEvidenceError);
    assert.equal(error.code, code);
    return true;
  };
}

test("accepts real deterministic M06-T03 Source-preflight evidence", async () => {
  const result = await verifyPublisherSourcePreflightEvidence();

  assert.equal(result.result, "PASS");
  assert.equal(result.prerequisitePins, 4);
  assert.equal(result.proofVectors, 9);
  assert.equal(result.trackedFiles, 20);
  assert.equal(result.proofDocumentPinned, true);
  assert.equal(result.sourceId, "com.example.account-app");
  assert.deepEqual(result.tests, {
    publisherRuntimeCases: 10,
    compilerNegativeCases: 16,
    validatorFoundationCases: 4,
    rootMutationCases: 10,
  });
});

test("two independent evidence builds are byte-identical and retain honest nonclaims", async () => {
  const first = await buildPublisherSourcePreflightEvidence();
  const second = await buildPublisherSourcePreflightEvidence();

  assert.deepEqual(first.artifactBytes, second.artifactBytes);
  assert.equal(first.artifactSha256, second.artifactSha256);
  assert.equal(first.artifact.claims.completeNonterminalAuthority.bundleAbsent, true);
  assert.equal(first.artifact.orderingDecision.invalidCatalogPrecedesIndeterminateReference, true);
  assert.match(first.artifact.nonclaims.join("\n"), /does not normalize Source data/u);
  assert.match(first.artifact.nonclaims.join("\n"), /does not expose a public publish function/u);
});

test("rejects one-byte artifact tampering", async () => {
  const built = await buildPublisherSourcePreflightEvidence();
  const tampered = Buffer.from(built.artifactBytes);
  tampered[tampered.length - 2] ^= 1;

  await assert.rejects(
    verifyPublisherSourcePreflightEvidence({ artifactBytes: tampered }),
    hasCode("PUBLISHER_PREFLIGHT_ARTIFACT_DRIFT"),
  );
});

test("rejects semantic fixture mutation instead of silently changing the golden authority", async () => {
  const source = JSON.parse(
    await readFile(
      new URL("../examples/sign-in/official-derived.source.desen.json", import.meta.url),
      "utf8",
    ),
  );
  source.catalogs[0].version = "0.1.1";

  await assert.rejects(
    buildPublisherSourcePreflightEvidence({ source }),
    hasCode("PUBLISHER_PREFLIGHT_SOURCE_FIXTURE_DRIFT"),
  );
});

test("rejects a preflight that observes Catalog candidates before Source-local checks finish", async () => {
  function eagerCandidatePreflight(rawSource, candidates, limits) {
    try {
      Reflect.ownKeys(candidates);
    } catch {
      // The mutation deliberately crosses the boundary; production preflight must not.
    }
    return preflightPublishSource(rawSource, candidates, limits);
  }

  await assert.rejects(
    buildPublisherSourcePreflightEvidence({ preflight: eagerCandidatePreflight }),
    hasCode("PUBLISHER_PREFLIGHT_CANDIDATE_ORDER_FAILED"),
  );
});

test("rejects a preflight that bypasses Catalog-backed static-reference validation", async () => {
  function referenceBypassPreflight(rawSource, candidates, limits) {
    const source = JSON.parse(rawSource);
    if (source?.surfaces?.["sign-in"]?.root?.use === "run.desen.unknown/Thing") {
      source.surfaces["sign-in"].root.use = "com.example.ui/Stack";
      return preflightPublishSource(JSON.stringify(source), candidates, limits);
    }
    return preflightPublishSource(rawSource, candidates, limits);
  }

  await assert.rejects(
    buildPublisherSourcePreflightEvidence({ preflight: referenceBypassPreflight }),
    hasCode("PUBLISHER_PREFLIGHT_REFERENCE_STAGE_FAILED"),
  );
});

test("rejects any failure that leaks partial Source, Catalog authority, or a Bundle", async () => {
  function partialFailurePreflight(...args) {
    const result = preflightPublishSource(...args);
    if ("preflighted" in result) return result;
    return Object.freeze({
      ...result,
      bundle: Object.freeze({}),
      source: Object.freeze({}),
      catalogSet: Object.freeze([]),
      packages: Object.freeze([]),
      requirementPackageIndexes: Object.freeze([]),
    });
  }

  await assert.rejects(
    buildPublisherSourcePreflightEvidence({ preflight: partialFailurePreflight }),
    hasCode("PUBLISHER_PREFLIGHT_PARTIAL_FAILURE"),
  );
});

test("rejects root API exposure and target-specific production dependencies", async () => {
  await assert.rejects(
    buildPublisherSourcePreflightEvidence({
      publicApi: {
        preflightPublishSource,
        PUBLISH_SOURCE_PREFLIGHT_LIMITS,
      },
    }),
    hasCode("PUBLISHER_PREFLIGHT_PUBLIC_API_EXPOSED"),
  );

  const source = await readFile(
    new URL("../packages/publisher/src/source-preflight.ts", import.meta.url),
    "utf8",
  );
  await assert.rejects(
    buildPublisherSourcePreflightEvidence({
      preflightSource: `import "node:fs";\n${source}`,
    }),
    hasCode("PUBLISHER_PREFLIGHT_TARGET_BOUNDARY_DRIFT"),
  );
});

test("rejects a missing, stale, duplicated, or pending proof-document artifact pin", async () => {
  const built = await buildPublisherSourcePreflightEvidence();
  const validDocument = [
    "# Proof",
    "",
    "`docs/proof/artifacts/publisher-0.1.0-source-preflight.json`",
    "",
    `\`sha256:${built.artifactSha256}\``,
    "",
  ].join("\n");

  for (const proofDocument of [
    validDocument.replace("publisher-0.1.0-source-preflight.json", "wrong.json"),
    validDocument.replace(built.artifactSha256, "0".repeat(64)),
    `${validDocument}\n\`sha256:${built.artifactSha256}\`\n`,
    `${validDocument}\nPENDING_M06_T03_ARTIFACT_SHA256\n`,
  ]) {
    await assert.rejects(
      verifyPublisherSourcePreflightEvidence({ proofDocument }),
      hasCode("PUBLISHER_PREFLIGHT_PROOF_DOCUMENT_DRIFT"),
    );
  }
});

test("atomic evidence writer rejects destination symlinks and pre-rename byte tampering", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-source-preflight-proof-"));
  t.after(() => rm(directory, { force: true, recursive: true }));

  const symlinkTarget = path.join(directory, "target.json");
  const symlinkPath = path.join(directory, "artifact-link.json");
  await writeFile(symlinkTarget, "{}\n");
  await symlink(symlinkTarget, symlinkPath);
  await assert.rejects(
    writePublisherSourcePreflightEvidence({ artifactPath: symlinkPath }),
    TypeError,
  );

  const tamperedPath = path.join(directory, "tampered.json");
  await assert.rejects(
    writePublisherSourcePreflightEvidence({
      artifactPath: tamperedPath,
      beforeAtomicRename: async ({ temporaryPath }) => {
        await writeFile(temporaryPath, "tampered\n");
      },
    }),
    TypeError,
  );
  await assert.rejects(readFile(tamperedPath), { code: "ENOENT" });

  assert.equal(
    path.basename(DEFAULT_PUBLISHER_SOURCE_PREFLIGHT_ARTIFACT_PATH),
    "publisher-0.1.0-source-preflight.json",
  );
});
