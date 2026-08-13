import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import * as publisherPublicApi from "../packages/publisher/dist/index.js";
import {
  PUBLISH_SOURCE_NORMALIZATION_LIMITS,
  SOURCE_NORMALIZATION_LIMIT_EXCEEDED_CODE,
  preflightPublishSourceNormalization,
} from "../packages/publisher/dist/source-normalization.js";
import {
  buildPublisherSourceNormalizationEvidence,
  DEFAULT_PUBLISHER_SOURCE_NORMALIZATION_ARTIFACT_PATH,
  PublisherSourceNormalizationEvidenceError,
  verifyPublisherSourceNormalizationEvidence,
  writePublisherSourceNormalizationEvidence,
} from "../scripts/lib/publisher-source-normalization-proof.mjs";

function hasCode(code) {
  return (error) => {
    assert.ok(error instanceof PublisherSourceNormalizationEvidenceError);
    assert.equal(error.code, code);
    return true;
  };
}

function clone(value) {
  return structuredClone(value);
}

function deepFreeze(value, visited = new Set()) {
  if (typeof value !== "object" || value === null || visited.has(value)) return value;
  visited.add(value);
  for (const child of Object.values(value)) deepFreeze(child, visited);
  return Object.freeze(value);
}

function mutateSuccessfulDocument(mutate) {
  return (...args) => {
    const result = preflightPublishSourceNormalization(...args);
    if (!Object.hasOwn(result, "sourceNormalized")) return result;
    const document = clone(result.normalizedDocument);
    mutate(document, args);
    return Object.freeze({ ...result, normalizedDocument: deepFreeze(document) });
  };
}

async function currentText(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

async function currentJson(relativePath) {
  return JSON.parse(await currentText(relativePath));
}

function validProofDocument(artifactSha256) {
  return [
    "# M06-T07 — Source normalization proof",
    "",
    "M06-T07 is `PASS` for its bounded claim.",
    "",
    "The authenticated Source digest precedes root authoring removal and RFC 8785 normalization.",
    "",
    "`docs/proof/artifacts/publisher-0.1.0-source-normalization.json`",
    "",
    `\`sha256:${artifactSha256}\``,
    "",
  ].join("\n");
}

test("accepts the real deterministic M06-T07 normalization evidence", async () => {
  const result = await verifyPublisherSourceNormalizationEvidence();

  assert.equal(result.result, "PASS");
  assert.equal(result.prerequisitePins, 2);
  assert.ok(result.tracePointersResolved > 0);
  assert.ok(result.trackedFiles >= 18);
  assert.equal(result.proofDocumentPinned, true);
  assert.equal(
    DEFAULT_PUBLISHER_SOURCE_NORMALIZATION_ARTIFACT_PATH.endsWith(
      "docs/proof/artifacts/publisher-0.1.0-source-normalization.json",
    ),
    true,
  );
});

test("two independent evidence builds are byte-identical", async () => {
  const first = await buildPublisherSourceNormalizationEvidence();
  const second = await buildPublisherSourceNormalizationEvidence();

  assert.deepEqual(first.artifactBytes, second.artifactBytes);
  assert.equal(first.artifactSha256, second.artifactSha256);
  assert.equal(first.artifact.claims.sourceDigestCalculatedBeforeNormalization, true);
  assert.equal(first.artifact.claims.sourceDigestMatchesExactAuthenticatedSourceProjection, true);
  assert.equal(first.artifact.claims.rootAuthoringIndependent, true);
  assert.equal(first.artifact.claims.canonicalUtf8Limits.defaultExactBytes, 2_097_152);
  assert.equal(first.artifact.claims.canonicalUtf8Limits.defaultOverByOneRejected, true);
});

test("rejects one-byte artifact tampering", async () => {
  const built = await buildPublisherSourceNormalizationEvidence();
  const tampered = Buffer.from(built.artifactBytes);
  tampered[tampered.length - 2] ^= 1;

  await assert.rejects(
    verifyPublisherSourceNormalizationEvidence({
      artifactBytes: tampered,
      proofDocument: validProofDocument(built.artifactSha256),
    }),
    hasCode("PUBLISHER_NORMALIZATION_ARTIFACT_DRIFT"),
  );
});

test("rejects one-byte drift in each exact prerequisite", async () => {
  for (const relativePath of [
    "docs/proof/artifacts/protocol-0.1.0-canonicalization.json",
    "docs/proof/artifacts/publisher-0.1.0-source-preservation.json",
  ]) {
    const tampered = Buffer.from(await readFile(new URL(`../${relativePath}`, import.meta.url)));
    tampered[0] ^= 1;
    await assert.rejects(
      buildPublisherSourceNormalizationEvidence({
        prerequisiteBytes: { [relativePath]: tampered },
      }),
      hasCode("PUBLISHER_NORMALIZATION_PREREQUISITE_DRIFT"),
    );
  }
});

test("rejects a normalizer whose output depends on root authoring", async () => {
  const normalization = mutateSuccessfulDocument((document, [rawSource]) => {
    const source = JSON.parse(rawSource);
    if (typeof source.authoring?.editor !== "string") return;
    document.extensions ??= {};
    document.extensions["dev.desen.mutation/authoring"] = source.authoring.editor;
  });

  await assert.rejects(
    buildPublisherSourceNormalizationEvidence({ normalization }),
    hasCode("PUBLISHER_NORMALIZATION_AUTHORING_DRIFT"),
  );
});

test("rejects a forged or authoring-dependent Source digest", async () => {
  function forgedDigest(...args) {
    const result = preflightPublishSourceNormalization(...args);
    if (!Object.hasOwn(result, "sourceNormalized")) return result;
    return Object.freeze({ ...result, sourceDigest: `sha256:${"0".repeat(64)}` });
  }

  await assert.rejects(
    buildPublisherSourceNormalizationEvidence({ normalization: forgedDigest }),
    hasCode("PUBLISHER_NORMALIZATION_SOURCE_DIGEST_DRIFT"),
  );
});

test("rejects recursive over-deletion of nested authoring", async () => {
  const normalization = mutateSuccessfulDocument((document) => {
    const extension = document.extensions?.["dev.desen.proof"];
    if (typeof extension === "object" && extension !== null) delete extension.authoring;
  });

  await assert.rejects(
    buildPublisherSourceNormalizationEvidence({ normalization }),
    hasCode("PUBLISHER_NORMALIZATION_EXTENSION_DRIFT"),
  );
});

test("rejects semantic extension-array reordering", async () => {
  const normalization = mutateSuccessfulDocument((document) => {
    const extension = document.extensions?.["dev.desen.proof"];
    if (Array.isArray(extension?.order)) extension.order.reverse();
  });

  await assert.rejects(
    buildPublisherSourceNormalizationEvidence({ normalization }),
    hasCode("PUBLISHER_NORMALIZATION_EXTENSION_DRIFT"),
  );
});

test("rejects schema-default injection and empty-member rewriting", async () => {
  const normalization = mutateSuccessfulDocument((document, [rawSource]) => {
    const source = JSON.parse(rawSource);
    const sourceAction = source.surfaces?.["sign-in"]?.root?.slots?.default?.[4]?.on?.press?.[0];
    if (sourceAction && !Object.hasOwn(sourceAction, "concurrency")) {
      document.surfaces["sign-in"].root.slots.default[4].on.press[0].concurrency = "reject";
    }
  });

  await assert.rejects(
    buildPublisherSourceNormalizationEvidence({ normalization }),
    hasCode("PUBLISHER_NORMALIZATION_MINIMALITY_DRIFT"),
  );
});

test("rejects a normalizer that ignores canonical-byte ceilings", async () => {
  function ignoresLimit(rawSource, candidates, profile = PUBLISH_SOURCE_NORMALIZATION_LIMITS) {
    const result = preflightPublishSourceNormalization(rawSource, candidates, profile);
    if (
      result.ok !== false ||
      !result.diagnostics.some(({ code }) => code === SOURCE_NORMALIZATION_LIMIT_EXCEEDED_CODE)
    ) {
      return result;
    }
    return preflightPublishSourceNormalization(rawSource, candidates, {
      sourcePreservation: profile.sourcePreservation,
      maxNormalizedDocumentCanonicalBytes: 8_388_608,
    });
  }

  await assert.rejects(
    buildPublisherSourceNormalizationEvidence({ normalization: ignoresLimit }),
    hasCode("PUBLISHER_NORMALIZATION_EXPECTED_FAILURE"),
  );
});

test("rejects partial authority leaked from a later failure", async () => {
  function leaksPartial(...args) {
    const result = preflightPublishSourceNormalization(...args);
    if (result.ok !== false) return result;
    return Object.freeze({ ...result, normalizedDocument: Object.freeze({}) });
  }

  await assert.rejects(
    buildPublisherSourceNormalizationEvidence({ normalization: leaksPartial }),
    hasCode("PUBLISHER_NORMALIZATION_PARTIAL_FAILURE"),
  );
});

test("rejects remapping of an inherited failure", async () => {
  function remapsFailure(...args) {
    const result = preflightPublishSourceNormalization(...args);
    if (result.ok !== false || result.stage !== "json-parse") return result;
    return deepFreeze({
      ...result,
      stage: "normalization",
      diagnostics: result.diagnostics.map((diagnostic) => ({
        ...diagnostic,
        stage: "normalization",
      })),
    });
  }

  await assert.rejects(
    buildPublisherSourceNormalizationEvidence({ normalization: remapsFailure }),
    hasCode("PUBLISHER_NORMALIZATION_INHERITED_FAILURE_DRIFT"),
  );
});

test("rejects cloning of an exact predecessor authority in production source", async () => {
  const source = await currentText("packages/publisher/src/source-normalization.ts");
  const mutated = source.replace(
    "source: preservation.source,",
    "source: structuredClone(preservation.source),",
  );
  assert.notEqual(mutated, source);

  await assert.rejects(
    buildPublisherSourceNormalizationEvidence({ normalizationSource: mutated }),
    hasCode("PUBLISHER_NORMALIZATION_AUTHORITY_DRIFT"),
  );

  const deadCallBypass = source
    .replace(
      "const preservation = preflightPublishSourcePreservation(",
      "const preservation = preflightPublishSourcePreservationRenamed(",
    )
    .concat(
      "\n// source: preservation.source,\nvoid preflightPublishSourcePreservation(undefined, undefined, undefined);\n",
    );
  assert.notEqual(deadCallBypass, source);
  await assert.rejects(
    buildPublisherSourceNormalizationEvidence({ normalizationSource: deadCallBypass }),
    hasCode("PUBLISHER_NORMALIZATION_AUTHORITY_DRIFT"),
  );

  function clonesEveryRuntimeAuthority(...args) {
    const result = preflightPublishSourceNormalization(...args);
    if (!Object.hasOwn(result, "sourceNormalized")) return result;
    return deepFreeze({
      ...result,
      source: clone(result.source),
      catalogSet: clone(result.catalogSet),
      packages: clone(result.packages),
      requirementPackageIndexes: clone(result.requirementPackageIndexes),
      diagnostics: clone(result.diagnostics),
      obligations: clone(result.obligations),
      preservedDocument: clone(result.preservedDocument),
      sourceCatalogRequirements: clone(result.sourceCatalogRequirements),
      traceability: clone(result.traceability),
    });
  }
  await assert.rejects(
    buildPublisherSourceNormalizationEvidence({ normalization: clonesEveryRuntimeAuthority }),
    hasCode("PUBLISHER_NORMALIZATION_AUTHORITY_DRIFT"),
  );

  function clonesCompleteRuntimeResult(...args) {
    const result = preflightPublishSourceNormalization(...args);
    return Object.hasOwn(result, "sourceNormalized") ? deepFreeze(clone(result)) : result;
  }
  await assert.rejects(
    buildPublisherSourceNormalizationEvidence({ normalization: clonesCompleteRuntimeResult }),
    hasCode("PUBLISHER_NORMALIZATION_IMPLEMENTATION_PROVENANCE_DRIFT"),
  );

  function clonesCompleteRuntimeResultWithoutFreeze(...args) {
    const result = preflightPublishSourceNormalization(...args);
    return Object.hasOwn(result, "sourceNormalized") ? clone(result) : result;
  }
  await assert.rejects(
    buildPublisherSourceNormalizationEvidence({
      normalization: clonesCompleteRuntimeResultWithoutFreeze,
    }),
    hasCode("PUBLISHER_NORMALIZATION_FREEZE_DRIFT"),
  );

  const implicitProduction = await buildPublisherSourceNormalizationEvidence();
  const explicitProduction = await buildPublisherSourceNormalizationEvidence({
    normalization: preflightPublishSourceNormalization,
  });
  assert.deepEqual(explicitProduction.artifactBytes, implicitProduction.artifactBytes);
  assert.equal(explicitProduction.artifactSha256, implicitProduction.artifactSha256);
});

test("rejects target-platform and unreviewed imports in production source", async () => {
  const source = await currentText("packages/publisher/src/source-normalization.ts");

  await assert.rejects(
    buildPublisherSourceNormalizationEvidence({
      normalizationSource: `${source}\nvoid process;\n`,
    }),
    hasCode("PUBLISHER_NORMALIZATION_BOUNDARY_DRIFT"),
  );
  await assert.rejects(
    buildPublisherSourceNormalizationEvidence({
      normalizationSource: `import "node:fs";\n${source}`,
    }),
    hasCode("PUBLISHER_NORMALIZATION_BOUNDARY_DRIFT"),
  );
  const distribution = await currentText("packages/publisher/dist/source-normalization.js");
  await assert.rejects(
    buildPublisherSourceNormalizationEvidence({
      normalizationDistribution: `${distribution}\nvoid process;\n`,
    }),
    hasCode("PUBLISHER_NORMALIZATION_BOUNDARY_DRIFT"),
  );
  const digestStart = distribution.indexOf("    let sourceDigest;");
  const normalizationStart = distribution.indexOf(
    "    const normalized = normalizeDocument",
    digestStart,
  );
  const successStart = distribution.indexOf("    return Object.freeze", normalizationStart);
  assert.ok(
    digestStart > 0 && normalizationStart > digestStart && successStart > normalizationStart,
  );
  const reorderedDistribution =
    distribution.slice(0, digestStart) +
    distribution.slice(normalizationStart, successStart) +
    distribution.slice(digestStart, normalizationStart) +
    distribution.slice(successStart);
  await assert.rejects(
    buildPublisherSourceNormalizationEvidence({
      normalizationDistribution: reorderedDistribution,
    }),
    hasCode("PUBLISHER_NORMALIZATION_AUTHORITY_DRIFT"),
  );
});

test("rejects private declaration or package-root API leakage", async () => {
  const publicDeclaration = await currentText("packages/publisher/dist/index.d.ts");

  await assert.rejects(
    buildPublisherSourceNormalizationEvidence({
      publicDeclaration: `${publicDeclaration}\nexport type PublishNormalizedDocument = {};\n`,
    }),
    hasCode("PUBLISHER_NORMALIZATION_BOUNDARY_DRIFT"),
  );
  await assert.rejects(
    buildPublisherSourceNormalizationEvidence({
      publicDeclaration: `${publicDeclaration}\nexport declare const SOURCE_NORMALIZATION_LIMIT_EXCEEDED_CODE: string;\n`,
    }),
    hasCode("PUBLISHER_NORMALIZATION_BOUNDARY_DRIFT"),
  );
  await assert.rejects(
    buildPublisherSourceNormalizationEvidence({
      publicApi: { ...publisherPublicApi, preflightPublishSourceNormalization },
    }),
    hasCode("PUBLISHER_NORMALIZATION_BOUNDARY_DRIFT"),
  );
});

test("rejects a private package-subpath export", async () => {
  const publisherPackage = await currentJson("packages/publisher/package.json");
  publisherPackage.exports["./source-normalization"] = "./dist/source-normalization.js";

  await assert.rejects(
    buildPublisherSourceNormalizationEvidence({ publisherPackage }),
    hasCode("PUBLISHER_NORMALIZATION_BOUNDARY_DRIFT"),
  );

  const redirectedRoot = await currentJson("packages/publisher/package.json");
  redirectedRoot.exports["."] = {
    types: "./dist/source-normalization.d.ts",
    import: "./dist/source-normalization.js",
  };
  await assert.rejects(
    buildPublisherSourceNormalizationEvidence({ publisherPackage: redirectedRoot }),
    hasCode("PUBLISHER_NORMALIZATION_BOUNDARY_DRIFT"),
  );
});

test("rejects missing private declaration contract fields", async () => {
  const declaration = await currentText("packages/publisher/dist/source-normalization.d.ts");
  const mutated = declaration.replace("maxNormalizedDocumentCanonicalBytes", "renamedLimit");
  assert.notEqual(mutated, declaration);

  await assert.rejects(
    buildPublisherSourceNormalizationEvidence({ normalizationDeclaration: mutated }),
    hasCode("PUBLISHER_NORMALIZATION_DECLARATION_DRIFT"),
  );
});

test("rejects package and root registration drift", async () => {
  const publisherPackage = await currentJson("packages/publisher/package.json");
  publisherPackage.scripts["test:source-normalization"] =
    "vitest run test/source-preservation.test.ts";
  await assert.rejects(
    buildPublisherSourceNormalizationEvidence({ publisherPackage }),
    hasCode("PUBLISHER_NORMALIZATION_REGISTRATION_DRIFT"),
  );

  const rootPackage = await currentJson("package.json");
  rootPackage.scripts["verify:publisher-source-normalization"] =
    "node scripts/verify-publisher-source-normalization.mjs";
  await assert.rejects(
    buildPublisherSourceNormalizationEvidence({ rootPackage }),
    hasCode("PUBLISHER_NORMALIZATION_REGISTRATION_DRIFT"),
  );

  const predecessorRemoved = await currentJson("package.json");
  predecessorRemoved.scripts.check = predecessorRemoved.scripts.check
    .split(" && ")
    .filter((command) => command !== "pnpm verify:publisher-source-preservation")
    .join(" && ");
  await assert.rejects(
    buildPublisherSourceNormalizationEvidence({ rootPackage: predecessorRemoved }),
    hasCode("PUBLISHER_NORMALIZATION_REGISTRATION_DRIFT"),
  );

  const duplicated = await currentJson("package.json");
  duplicated.scripts.test = `${duplicated.scripts.test} && pnpm test:publisher-source-normalization`;
  await assert.rejects(
    buildPublisherSourceNormalizationEvidence({ rootPackage: duplicated }),
    hasCode("PUBLISHER_NORMALIZATION_REGISTRATION_DRIFT"),
  );
});

test("rejects retired reader-local test-inventory overrides", async () => {
  for (const key of ["runtimeTest", "typeTest", "rootTest"]) {
    await assert.rejects(
      buildPublisherSourceNormalizationEvidence({ [key]: "retired" }),
      hasCode("PUBLISHER_NORMALIZATION_OPTIONS_INVALID"),
    );
  }
});

test("rejects single-pass CI proof-tuple drift", async () => {
  const ciSource = await currentText("scripts/run-ci-quality-gate.mjs");
  const mutated = ciSource.replace(
    '"publisher-source-normalization",',
    '"publisher-source-normalization-removed",',
  );
  assert.notEqual(mutated, ciSource);

  await assert.rejects(
    buildPublisherSourceNormalizationEvidence({ ciSource: mutated }),
    hasCode("PUBLISHER_NORMALIZATION_REGISTRATION_DRIFT"),
  );
});

test("rejects protocol traceability ownership drift", async () => {
  const traceability = await currentJson("docs/proof/protocol-0.1.0-traceability.json");
  const row = traceability.proseRules.find(({ id }) => id === "R-034");
  row.owners = row.owners.filter((owner) => owner !== "M06-T07");

  await assert.rejects(
    buildPublisherSourceNormalizationEvidence({ traceability }),
    hasCode("PUBLISHER_NORMALIZATION_TRACEABILITY_DRIFT"),
  );
});

test("rejects proof-document path, semantic marker, or hash drift", async () => {
  const built = await buildPublisherSourceNormalizationEvidence();
  await assert.rejects(
    verifyPublisherSourceNormalizationEvidence({
      artifactBytes: built.artifactBytes,
      proofDocument: "# M06-T07\nPASS\nRFC 8785\nauthoring\n",
    }),
    hasCode("PUBLISHER_NORMALIZATION_PROOF_DOCUMENT_DRIFT"),
  );
  await assert.rejects(
    verifyPublisherSourceNormalizationEvidence({
      artifactBytes: built.artifactBytes,
      proofDocument: validProofDocument(built.artifactSha256).replace(
        "M06-T07 is `PASS` for its bounded claim.",
        "M06-T07 is `PASS` for its bounded claim.\n\nM06-T07 — FAIL: this evidence does not pass.",
      ),
    }),
    hasCode("PUBLISHER_NORMALIZATION_PROOF_DOCUMENT_DRIFT"),
  );
  await assert.rejects(
    verifyPublisherSourceNormalizationEvidence({
      artifactBytes: built.artifactBytes,
      proofDocument: `${validProofDocument(
        built.artifactSha256,
      )}\nDespite the marker, this bounded claim fails.\n`,
    }),
    hasCode("PUBLISHER_NORMALIZATION_PROOF_DOCUMENT_DRIFT"),
  );
});

test("accepts an injected exact proof-document pin", async () => {
  const built = await buildPublisherSourceNormalizationEvidence();
  const result = await verifyPublisherSourceNormalizationEvidence({
    artifactBytes: built.artifactBytes,
    proofDocument: validProofDocument(built.artifactSha256),
  });
  assert.equal(result.artifactSha256, built.artifactSha256);
  assert.equal(result.proofDocumentPinned, true);
});

test("atomic writer rejects a symlink destination", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "desen-normalization-symlink-"));
  try {
    const target = path.join(temporary, "target.json");
    const artifactPath = path.join(temporary, "artifact.json");
    await writeFile(target, "{}\n");
    await symlink(target, artifactPath);

    await assert.rejects(
      writePublisherSourceNormalizationEvidence({ artifactPath }),
      /destination must be a regular file/u,
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("atomic writer rejects temporary-byte tampering before rename", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "desen-normalization-tamper-"));
  try {
    const artifactPath = path.join(temporary, "artifact.json");
    await assert.rejects(
      writePublisherSourceNormalizationEvidence({
        artifactPath,
        beforeAtomicRename: async ({ temporaryPath }) => {
          await writeFile(temporaryPath, "tampered\n");
        },
      }),
      /temporary bytes changed/u,
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("rejects unknown or accessor-backed evidence options", async () => {
  await assert.rejects(
    buildPublisherSourceNormalizationEvidence({ unknown: true }),
    hasCode("PUBLISHER_NORMALIZATION_OPTIONS_INVALID"),
  );
  await assert.rejects(
    buildPublisherSourceNormalizationEvidence({
      get proofDocument() {
        throw new Error("must not execute");
      },
    }),
    hasCode("PUBLISHER_NORMALIZATION_OPTIONS_INVALID"),
  );
  await assert.rejects(
    buildPublisherSourceNormalizationEvidence(Object.create({ normalization: undefined })),
    hasCode("PUBLISHER_NORMALIZATION_OPTIONS_INVALID"),
  );
  await assert.rejects(
    buildPublisherSourceNormalizationEvidence(
      new Proxy(
        {},
        {
          ownKeys() {
            throw new Error("must be contained");
          },
        },
      ),
    ),
    hasCode("PUBLISHER_NORMALIZATION_OPTIONS_INVALID"),
  );
  await assert.rejects(
    buildPublisherSourceNormalizationEvidence({
      prerequisiteBytes: {
        get ["docs/proof/artifacts/protocol-0.1.0-canonicalization.json"]() {
          throw new Error("must not execute");
        },
      },
    }),
    hasCode("PUBLISHER_NORMALIZATION_OPTIONS_INVALID"),
  );
  const publisherPackage = await currentJson("packages/publisher/package.json");
  Object.defineProperty(publisherPackage.exports, ".", {
    enumerable: true,
    get() {
      throw new Error("must not execute");
    },
  });
  await assert.rejects(
    buildPublisherSourceNormalizationEvidence({ publisherPackage }),
    hasCode("PUBLISHER_NORMALIZATION_OPTIONS_INVALID"),
  );
  await assert.rejects(
    writePublisherSourceNormalizationEvidence({ artifactPath: 42 }),
    hasCode("PUBLISHER_NORMALIZATION_OPTIONS_INVALID"),
  );
});
