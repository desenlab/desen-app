import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { resolvePublishCatalogs } from "../packages/publisher/dist/catalog-resolution.js";
import {
  buildPublisherCatalogResolutionEvidence,
  PublisherCatalogResolutionEvidenceError,
  verifyPublisherCatalogResolutionEvidence,
} from "../scripts/lib/publisher-catalog-resolution-proof.mjs";

function hasCode(code) {
  return (error) => {
    assert.ok(error instanceof PublisherCatalogResolutionEvidenceError);
    assert.equal(error.code, code);
    return true;
  };
}

test("accepts real deterministic M06-T02 Catalog-resolution evidence", async () => {
  const result = await verifyPublisherCatalogResolutionEvidence();

  assert.equal(result.result, "PASS");
  assert.equal(result.prerequisitePins, 4);
  assert.equal(result.proofVectors, 9);
  assert.equal(result.trackedFiles, 15);
  assert.equal(result.proofDocumentPinned, true);
  assert.deepEqual(result.tests, {
    packageRuntimeCases: 22,
    compilerNegativeCases: 10,
    rootMutationCases: 8,
  });
  assert.deepEqual(result.exactTuple, {
    id: "run.desen.reference.sign-in",
    version: "0.1.0",
    target: "web-react",
    packageDigest: "sha256:acdbbfe9ad4c1fce8093b0b68036bc7f5678e8b2a603357dbe25f2413a3db6f0",
  });
});

test("two independent evidence builds are byte-identical and preserve honest nonclaims", async () => {
  const first = await buildPublisherCatalogResolutionEvidence();
  const second = await buildPublisherCatalogResolutionEvidence();

  assert.deepEqual(first.artifactBytes, second.artifactBytes);
  assert.equal(first.artifactSha256, second.artifactSha256);
  assert.equal(first.artifact.trustBoundary.packageByteAuthenticationPerformedHere, false);
  assert.equal(first.artifact.trustBoundary.canonicalCatalogJsonUsedAsPackageDigest, false);
  assert.match(
    first.artifact.nonclaims.join("\n"),
    /does not read, hash, download, install, or authenticate package artifact bytes/u,
  );
});

test("rejects one-byte artifact tampering", async () => {
  const built = await buildPublisherCatalogResolutionEvidence();
  const tampered = Buffer.from(built.artifactBytes);
  tampered[tampered.length - 2] ^= 1;

  await assert.rejects(
    verifyPublisherCatalogResolutionEvidence({ artifactBytes: tampered }),
    hasCode("PUBLISHER_CATALOG_ARTIFACT_DRIFT"),
  );
});

test("rejects semantic fixture mutation instead of silently changing the golden tuple", async () => {
  const catalog = JSON.parse(
    await readFile(new URL("../packages/reference-catalog-web/catalog.json", import.meta.url)),
  );
  catalog.packageDigest = `sha256:${"9".repeat(64)}`;

  await assert.rejects(
    buildPublisherCatalogResolutionEvidence({ catalog }),
    hasCode("PUBLISHER_CATALOG_FIXTURE_DRIFT"),
  );
});

test("rejects a resolver that chooses the first duplicate candidate", async () => {
  function firstCandidateResolver(requirements, candidates, documentId, limits) {
    return resolvePublishCatalogs(requirements, [candidates[0]], documentId, limits);
  }

  await assert.rejects(
    buildPublisherCatalogResolutionEvidence({ resolver: firstCandidateResolver }),
    hasCode("PUBLISHER_CATALOG_DUPLICATE_VECTOR_FAILED"),
  );
});

test("rejects any failure that leaks partial Catalog authority or a Bundle", async () => {
  function partialFailureResolver(...args) {
    const result = resolvePublishCatalogs(...args);
    if ("resolved" in result) return result;
    return Object.freeze({
      ...result,
      bundle: Object.freeze({}),
      catalogSet: Object.freeze([]),
      packages: Object.freeze([]),
      requirementPackageIndexes: Object.freeze([]),
    });
  }

  await assert.rejects(
    buildPublisherCatalogResolutionEvidence({ resolver: partialFailureResolver }),
    hasCode("PUBLISHER_CATALOG_PARTIAL_FAILURE"),
  );
});

test("rejects location authority, root API exposure, and target-specific dependencies", async () => {
  function locationAuthorityResolver(requirements, candidates, documentId, limits) {
    const first = requirements[0];
    if (first?.location !== undefined && candidates.length > 1) {
      return resolvePublishCatalogs(requirements, [candidates[0]], documentId, limits);
    }
    return resolvePublishCatalogs(requirements, candidates, documentId, limits);
  }
  await assert.rejects(
    buildPublisherCatalogResolutionEvidence({ resolver: locationAuthorityResolver }),
    hasCode("PUBLISHER_CATALOG_LOCATION_VECTOR_FAILED"),
  );

  await assert.rejects(
    buildPublisherCatalogResolutionEvidence({
      publicApi: {
        resolvePublishCatalogs,
      },
    }),
    hasCode("PUBLISHER_CATALOG_PUBLIC_API_EXPOSED"),
  );

  const source = await readFile(
    new URL("../packages/publisher/src/catalog-resolution.ts", import.meta.url),
    "utf8",
  );
  await assert.rejects(
    buildPublisherCatalogResolutionEvidence({
      resolverSource: `import "node:fs";\n${source}`,
    }),
    hasCode("PUBLISHER_CATALOG_TARGET_BOUNDARY_DRIFT"),
  );
});

test("rejects a missing, stale, duplicated, or pending proof-document artifact pin", async () => {
  const built = await buildPublisherCatalogResolutionEvidence();
  const validDocument = [
    "# Proof",
    "",
    "`docs/proof/artifacts/publisher-0.1.0-catalog-resolution.json`",
    "",
    `\`sha256:${built.artifactSha256}\``,
    "",
  ].join("\n");

  for (const proofDocument of [
    validDocument.replace("publisher-0.1.0-catalog-resolution.json", "wrong.json"),
    validDocument.replace(built.artifactSha256, "0".repeat(64)),
    `${validDocument}\n\`sha256:${built.artifactSha256}\`\n`,
    `${validDocument}\nPENDING_M06_T02_ARTIFACT_SHA256\n`,
  ]) {
    await assert.rejects(
      verifyPublisherCatalogResolutionEvidence({ proofDocument }),
      hasCode("PUBLISHER_CATALOG_PROOF_DOCUMENT_DRIFT"),
    );
  }
});
