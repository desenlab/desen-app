import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { preflightPublishCatalogPinning } from "../packages/publisher/dist/catalog-pinning.js";
import { createQualityGateSteps } from "../scripts/run-ci-quality-gate.mjs";
import {
  buildPublisherCatalogPinningEvidence,
  DEFAULT_PUBLISHER_CATALOG_PINNING_ARTIFACT_PATH,
  PublisherCatalogPinningEvidenceError,
  verifyPublisherCatalogPinningEvidence,
  writePublisherCatalogPinningEvidence,
} from "../scripts/lib/publisher-catalog-pinning-proof.mjs";

function hasCode(code) {
  return (error) => {
    assert.ok(error instanceof PublisherCatalogPinningEvidenceError);
    assert.equal(error.code, code);
    return true;
  };
}

function hasCodeAndMessage(code, message) {
  return (error) => {
    assert.ok(error instanceof PublisherCatalogPinningEvidenceError);
    assert.equal(error.code, code);
    assert.equal(error.message, message);
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

function mutatePinnedDocument(mutate) {
  return (...args) => {
    const result = preflightPublishCatalogPinning(...args);
    if (!Object.hasOwn(result, "catalogsPinned")) return result;
    const pinnedDocument = clone(result.pinnedDocument);
    mutate(pinnedDocument, result, args);
    return Object.freeze({ ...result, pinnedDocument: deepFreeze(pinnedDocument) });
  };
}

function validProofDocument(artifactSha256) {
  return [
    "# M06-T08 — Catalog pinning proof",
    "",
    "M06-T08 is `PASS` for its bounded nonterminal claim.",
    "",
    "`docs/proof/artifacts/publisher-0.1.0-catalog-pinning.json`",
    "",
    `\`sha256:${artifactSha256}\``,
    "",
  ].join("\n");
}

function appendValidCiSuccessor(source) {
  const successor = Object.freeze({
    id: "control-plane-append-only-probe",
    verifierFile: "scripts/verify-control-plane-append-only-probe.mjs",
    rootTestFile: "tests/control-plane-append-only-probe.test.mjs",
  });
  const currentSteps = createQualityGateSteps();
  const firstRootTestIndex = currentSteps.findIndex(({ id }) => id.startsWith("test-"));
  const dependencyBoundaryIndex = currentSteps.findIndex(
    ({ id }) => id === "dependency-boundaries",
  );
  assert.ok(firstRootTestIndex > 0);
  assert.ok(dependencyBoundaryIndex > firstRootTestIndex);
  const steps = [
    ...currentSteps.slice(0, firstRootTestIndex),
    {
      id: `verify-${successor.id}`,
      label: `Proof verifier: ${successor.id}`,
      command: "node",
      args: [successor.verifierFile],
    },
    ...currentSteps.slice(firstRootTestIndex, dependencyBoundaryIndex),
    {
      id: `test-${successor.id}`,
      label: `Root proof and mutation test: ${successor.id}`,
      command: "node",
      args: ["--test", "--test-concurrency=1", successor.rootTestFile],
    },
    ...currentSteps.slice(dependencyBoundaryIndex),
  ];
  const planSha256 = createHash("sha256")
    .update(
      JSON.stringify(
        steps.map(({ id, command, args }) => ({
          id,
          command,
          args,
        })),
      ),
    )
    .digest("hex");
  const inventoryTerminator =
    "  ].map(([id, verifierFile, rootTestFile]) => Object.freeze({ id, verifierFile, rootTestFile })),";
  const tuple = [
    "    [",
    `      "${successor.id}",`,
    `      "${successor.verifierFile}",`,
    `      "${successor.rootTestFile}",`,
    "    ],",
    "",
  ].join("\n");
  const withTuple = source.replace(inventoryTerminator, `${tuple}${inventoryTerminator}`);
  assert.notEqual(withTuple, source);
  const withPlan = withTuple.replace(
    /const QUALITY_GATE_PLAN_SHA256 = "[0-9a-f]{64}";/u,
    `const QUALITY_GATE_PLAN_SHA256 = "${planSha256}";`,
  );
  assert.notEqual(withPlan, withTuple);
  return withPlan;
}

function appendValidRootSuccessor(source) {
  const manifest = JSON.parse(source);
  const originalCheck = manifest.scripts.check;
  const originalTest = manifest.scripts.test;
  manifest.scripts["verify:control-plane-append-only-probe"] =
    "node scripts/verify-control-plane-append-only-probe.mjs";
  manifest.scripts["test:control-plane-append-only-probe"] =
    "node --test tests/control-plane-append-only-probe.test.mjs";
  manifest.scripts.check = manifest.scripts.check.replace(
    "pnpm verify:control-plane-package-preflight && pnpm lint",
    "pnpm verify:control-plane-package-preflight && pnpm verify:control-plane-append-only-probe && pnpm lint",
  );
  manifest.scripts.test = manifest.scripts.test.replace(
    "pnpm test:control-plane-package-preflight && turbo run test",
    "pnpm test:control-plane-package-preflight && pnpm test:control-plane-append-only-probe && turbo run test",
  );
  assert.notEqual(manifest.scripts.check, originalCheck);
  assert.notEqual(manifest.scripts.test, originalTest);
  return JSON.stringify(manifest);
}

test("accepts the real deterministic M06-T08 Catalog-pinning evidence", async () => {
  const result = await verifyPublisherCatalogPinningEvidence();
  assert.equal(result.result, "PASS");
  assert.equal(result.prerequisitePins, 2);
  assert.equal(result.traceRows, 12);
  assert.ok(result.trackedFiles >= 16);
  assert.equal(result.proofDocumentPinned, true);
  assert.ok(
    DEFAULT_PUBLISHER_CATALOG_PINNING_ARTIFACT_PATH.endsWith(
      "docs/proof/artifacts/publisher-0.1.0-catalog-pinning.json",
    ),
  );
});

test("two independent Catalog-pinning evidence builds are byte-identical", async () => {
  const first = await buildPublisherCatalogPinningEvidence();
  const second = await buildPublisherCatalogPinningEvidence();
  assert.deepEqual(first.artifactBytes, second.artifactBytes);
  assert.equal(first.artifactSha256, second.artifactSha256);
  assert.equal(first.artifact.claims.sourceDigestReauthenticatedFromExactSource, true);
  assert.deepEqual(first.artifact.claims.variants.positionalIndexes, [0, 1, 0]);
});

test("rejects one-byte artifact tampering", async () => {
  const built = await buildPublisherCatalogPinningEvidence();
  const tampered = Buffer.from(built.artifactBytes);
  tampered[tampered.length - 2] ^= 1;
  await assert.rejects(
    verifyPublisherCatalogPinningEvidence({
      artifactBytes: tampered,
      proofDocument: validProofDocument(built.artifactSha256),
    }),
    hasCode("PUBLISHER_CATALOG_PINNING_ARTIFACT_DRIFT"),
  );
});

test("rejects one-byte drift in each exact prerequisite", async () => {
  for (const relativePath of [
    "docs/proof/artifacts/publisher-0.1.0-catalog-resolution.json",
    "docs/proof/artifacts/publisher-0.1.0-source-normalization.json",
  ]) {
    const tampered = Buffer.from(await readFile(new URL(`../${relativePath}`, import.meta.url)));
    tampered[0] ^= 1;
    await assert.rejects(
      buildPublisherCatalogPinningEvidence({
        prerequisiteBytes: { [relativePath]: tampered },
      }),
      hasCode("PUBLISHER_CATALOG_PINNING_PREREQUISITE_DRIFT"),
    );
  }
});

test("rejects a forged packages-by-position mapping that ignores requirement indexes", async () => {
  const pinning = mutatePinnedDocument((document, result) => {
    document.requires.catalogs = result.sourceCatalogRequirements.map((requirement, index) => {
      const selected = result.packages[Math.min(index, result.packages.length - 1)];
      return {
        id: selected.id,
        version: selected.version,
        target: selected.target,
        digest: selected.packageDigest,
        ...(requirement.extensions === undefined ? {} : { extensions: requirement.extensions }),
      };
    });
  });
  await assert.rejects(
    buildPublisherCatalogPinningEvidence({ pinning }),
    hasCode("PUBLISHER_CATALOG_PINNING_POSITION_DRIFT"),
  );
});

test("rejects tuple deduplication across duplicate Source positions", async () => {
  const pinning = (...args) => {
    const result = preflightPublishCatalogPinning(...args);
    if (!Object.hasOwn(result, "catalogsPinned")) return result;
    const catalogs = Object.freeze(
      result.pinnedDocument.requires.catalogs.filter(
        (entry, index, entries) =>
          entries.findIndex(
            (candidate) =>
              candidate.id === entry.id &&
              candidate.version === entry.version &&
              candidate.target === entry.target &&
              candidate.digest === entry.digest,
          ) === index,
      ),
    );
    const pinnedDocument = Object.freeze({
      ...result.pinnedDocument,
      requires: Object.freeze({ catalogs }),
    });
    return Object.freeze({ ...result, pinnedDocument });
  };
  await assert.rejects(
    buildPublisherCatalogPinningEvidence({ pinning }),
    hasCode("PUBLISHER_CATALOG_PINNING_POSITION_DRIFT"),
  );
});

test("rejects Source discovery location leaked into an exact tuple", async () => {
  const pinning = mutatePinnedDocument((document, result) => {
    document.requires.catalogs.forEach((entry, index) => {
      const location = result.sourceCatalogRequirements[index].location;
      if (location !== undefined) entry.location = location;
    });
  });
  await assert.rejects(
    buildPublisherCatalogPinningEvidence({ pinning }),
    hasCode("PUBLISHER_CATALOG_PINNING_LOCATION_DRIFT"),
  );
});

test("rejects opaque requirement-extension loss", async () => {
  const pinning = mutatePinnedDocument((document) => {
    document.requires.catalogs.forEach((entry) => delete entry.extensions);
  });
  await assert.rejects(
    buildPublisherCatalogPinningEvidence({ pinning }),
    hasCode("PUBLISHER_CATALOG_PINNING_EXTENSION_DRIFT"),
  );
});

test("rejects a forged carried or pinned Source digest", async () => {
  const pinning = (...args) => {
    const result = preflightPublishCatalogPinning(...args);
    if (!Object.hasOwn(result, "catalogsPinned")) return result;
    const pinnedDocument = clone(result.pinnedDocument);
    pinnedDocument.sourceDigest = `sha256:${"0".repeat(64)}`;
    return Object.freeze({
      ...result,
      sourceDigest: `sha256:${"0".repeat(64)}`,
      pinnedDocument: deepFreeze(pinnedDocument),
    });
  };
  await assert.rejects(
    buildPublisherCatalogPinningEvidence({ pinning }),
    hasCode("PUBLISHER_CATALOG_PINNING_SOURCE_DIGEST_DRIFT"),
  );
});

test("rejects a reconstructed carried T07 authority even when its bytes and freezing match", async () => {
  const pinning = (...args) => {
    const result = preflightPublishCatalogPinning(...args);
    if (!Object.hasOwn(result, "catalogsPinned")) return result;
    return Object.freeze({
      ...result,
      source: deepFreeze(clone(result.source)),
    });
  };
  await assert.rejects(
    buildPublisherCatalogPinningEvidence({ pinning }),
    hasCode("PUBLISHER_CATALOG_PINNING_AUTHORITY_DRIFT"),
  );
});

test("rejects partial authority leaked by a later failure", async () => {
  const pinning = (...args) => {
    const result = preflightPublishCatalogPinning(...args);
    if (result.ok !== false) return result;
    return Object.freeze({ ...result, sourceDigest: `sha256:${"0".repeat(64)}` });
  };
  await assert.rejects(
    buildPublisherCatalogPinningEvidence({ pinning }),
    hasCode("PUBLISHER_CATALOG_PINNING_PARTIAL_LEAK"),
  );
});

test("rejects a second T07 invocation in production source", async () => {
  const sourcePath = new URL("../packages/publisher/src/catalog-pinning.ts", import.meta.url);
  const source = await readFile(sourcePath, "utf8");
  const marker = "const normalization = preflightPublishSourceNormalization(";
  assert.ok(source.includes(marker));
  const mutated = source.replace(
    marker,
    "preflightPublishSourceNormalization(rawSourceInput, catalogPackageCandidatesInput, limits);\n  const normalization = preflightPublishSourceNormalization(",
  );
  await assert.rejects(
    buildPublisherCatalogPinningEvidence({
      trackedFileBytes: {
        "packages/publisher/src/catalog-pinning.ts": Buffer.from(mutated),
      },
    }),
    hasCode("PUBLISHER_CATALOG_PINNING_SOURCE_DRIFT"),
  );
});

test("rejects root declaration or package subpath exposure", async () => {
  const current = await readFile(
    new URL("../packages/publisher/dist/index.d.ts", import.meta.url),
    "utf8",
  );
  await assert.rejects(
    buildPublisherCatalogPinningEvidence({
      trackedFileBytes: {
        "packages/publisher/dist/index.d.ts": Buffer.from(
          `${current}\nexport { preflightPublishCatalogPinning } from "./catalog-pinning.js";\n`,
        ),
      },
    }),
    hasCode("PUBLISHER_CATALOG_PINNING_PUBLIC_API_DRIFT"),
  );

  const manifest = JSON.parse(
    await readFile(new URL("../packages/publisher/package.json", import.meta.url), "utf8"),
  );
  manifest.exports["."] = "./dist/catalog-pinning.js";
  await assert.rejects(
    buildPublisherCatalogPinningEvidence({
      trackedFileBytes: {
        "packages/publisher/package.json": Buffer.from(JSON.stringify(manifest)),
      },
    }),
    hasCode("PUBLISHER_CATALOG_PINNING_PUBLIC_API_DRIFT"),
  );
});

test("rejects package and legacy root registration drift", async () => {
  const rootPackage = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );
  rootPackage.scripts["verify:publisher-catalog-pinning"] =
    "node scripts/verify-publisher-catalog-pinning.mjs";
  await assert.rejects(
    buildPublisherCatalogPinningEvidence({
      trackedFileBytes: {
        "package.json": Buffer.from(JSON.stringify(rootPackage)),
      },
    }),
    hasCode("PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT"),
  );

  const duplicate = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  duplicate.scripts.test += " && pnpm test:publisher-catalog-pinning";
  duplicate.scripts.check += " && pnpm verify:publisher-catalog-pinning";
  await assert.rejects(
    buildPublisherCatalogPinningEvidence({
      trackedFileBytes: {
        "package.json": Buffer.from(JSON.stringify(duplicate)),
      },
    }),
    hasCode("PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT"),
  );
});

test("rejects single-pass CI registration drift", async () => {
  const ci = await readFile(new URL("../scripts/run-ci-quality-gate.mjs", import.meta.url), "utf8");
  await assert.rejects(
    buildPublisherCatalogPinningEvidence({
      trackedFileBytes: {
        "scripts/run-ci-quality-gate.mjs": Buffer.from(
          ci.replace('"publisher-catalog-pinning"', '"publisher-catalog-pinning-disabled"'),
        ),
      },
    }),
    hasCode("PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT"),
  );

  const inertTuple = [
    "const PROOF_ENTRIES = Object.freeze([",
    '  ["publisher-source-normalization", "unused", "unused"],',
    '  ["publisher-catalog-pinning", "scripts/verify-publisher-catalog-pinning.mjs",',
    '    "tests/publisher-catalog-pinning.test.mjs"],',
    "]);",
  ].join("\n");
  await assert.rejects(
    buildPublisherCatalogPinningEvidence({
      trackedFileBytes: {
        "scripts/run-ci-quality-gate.mjs": Buffer.from(inertTuple),
      },
    }),
    hasCode("PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT"),
  );
});

test("rejects removal of the exact T11 CI successor", async () => {
  const ci = await readFile(new URL("../scripts/run-ci-quality-gate.mjs", import.meta.url), "utf8");
  const mutated = ci.replace(
    '"publisher-invalid-source-matrix"',
    '"publisher-invalid-source-matrix-removed"',
  );
  assert.notEqual(mutated, ci);
  await assert.rejects(
    buildPublisherCatalogPinningEvidence({
      trackedFileBytes: {
        "scripts/run-ci-quality-gate.mjs": Buffer.from(mutated),
      },
    }),
    hasCode("PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT"),
  );
});

test("rejects reordering the exact T10 to T11 CI edge", async () => {
  const ci = await readFile(new URL("../scripts/run-ci-quality-gate.mjs", import.meta.url), "utf8");
  const t10Tuple = [
    "    [",
    '      "publisher-official-golden",',
    '      "scripts/verify-publisher-official-golden.mjs",',
    '      "tests/publisher-official-golden.test.mjs",',
    "    ],",
    "",
  ].join("\n");
  const t11Tuple = [
    "    [",
    '      "publisher-invalid-source-matrix",',
    '      "scripts/verify-publisher-invalid-source-matrix.mjs",',
    '      "tests/publisher-invalid-source-matrix.test.mjs",',
    "    ],",
    "",
  ].join("\n");
  const mutated = ci.replace(`${t10Tuple}${t11Tuple}`, `${t11Tuple}${t10Tuple}`);
  assert.notEqual(mutated, ci);
  await assert.rejects(
    buildPublisherCatalogPinningEvidence({
      trackedFileBytes: {
        "scripts/run-ci-quality-gate.mjs": Buffer.from(mutated),
      },
    }),
    hasCode("PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT"),
  );
});

test("rejects drift in the exact T11 CI tuple", async () => {
  const ci = await readFile(new URL("../scripts/run-ci-quality-gate.mjs", import.meta.url), "utf8");
  const mutated = ci.replace(
    '"scripts/verify-publisher-invalid-source-matrix.mjs"',
    '"scripts/verify-publisher-official-golden.mjs"',
  );
  assert.notEqual(mutated, ci);
  await assert.rejects(
    buildPublisherCatalogPinningEvidence({
      trackedFileBytes: {
        "scripts/run-ci-quality-gate.mjs": Buffer.from(mutated),
      },
    }),
    hasCode("PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT"),
  );
});

test("rejects exact T11 root registration drift", async () => {
  const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  manifest.scripts["verify:publisher-invalid-source-matrix"] =
    "node scripts/verify-publisher-invalid-source-matrix.mjs";
  await assert.rejects(
    buildPublisherCatalogPinningEvidence({
      trackedFileBytes: {
        "package.json": Buffer.from(JSON.stringify(manifest)),
      },
    }),
    hasCode("PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT"),
  );
});

test("rejects exact T11 package registration drift", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../packages/publisher/package.json", import.meta.url), "utf8"),
  );
  manifest.scripts["test:invalid-source-matrix"] = "vitest run";
  await assert.rejects(
    buildPublisherCatalogPinningEvidence({
      trackedFileBytes: {
        "packages/publisher/package.json": Buffer.from(JSON.stringify(manifest)),
      },
    }),
    hasCode("PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT"),
  );
});

test("rejects removal of the aggregate T11 successor", async () => {
  const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  manifest.scripts.test = manifest.scripts.test.replace(
    " && pnpm test:publisher-invalid-source-matrix",
    "",
  );
  await assert.rejects(
    buildPublisherCatalogPinningEvidence({
      trackedFileBytes: {
        "package.json": Buffer.from(JSON.stringify(manifest)),
      },
    }),
    hasCode("PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT"),
  );
});

test("rejects a non-immediate aggregate T10 to T11 edge", async () => {
  const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  manifest.scripts.check = manifest.scripts.check.replace(
    "pnpm verify:publisher-official-golden && pnpm verify:publisher-invalid-source-matrix",
    "pnpm verify:publisher-invalid-source-matrix && pnpm verify:publisher-official-golden",
  );
  await assert.rejects(
    buildPublisherCatalogPinningEvidence({
      trackedFileBytes: {
        "package.json": Buffer.from(JSON.stringify(manifest)),
      },
    }),
    hasCode("PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT"),
  );
});

test("rejects removal of the exact M07-T01 CI successor", async () => {
  const ci = await readFile(new URL("../scripts/run-ci-quality-gate.mjs", import.meta.url), "utf8");
  const mutated = ci.replace(
    '"control-plane-bundle-store"',
    '"control-plane-bundle-store-removed"',
  );
  assert.notEqual(mutated, ci);
  await assert.rejects(
    buildPublisherCatalogPinningEvidence({
      trackedFileBytes: {
        "scripts/run-ci-quality-gate.mjs": Buffer.from(mutated),
      },
    }),
    hasCode("PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT"),
  );
});

test("rejects reordering the exact T11 to M07-T01 CI edge", async () => {
  const ci = await readFile(new URL("../scripts/run-ci-quality-gate.mjs", import.meta.url), "utf8");
  const t11Tuple = [
    "    [",
    '      "publisher-invalid-source-matrix",',
    '      "scripts/verify-publisher-invalid-source-matrix.mjs",',
    '      "tests/publisher-invalid-source-matrix.test.mjs",',
    "    ],",
    "",
  ].join("\n");
  const m07Tuple = [
    "    [",
    '      "control-plane-bundle-store",',
    '      "scripts/verify-control-plane-bundle-store.mjs",',
    '      "tests/control-plane-bundle-store.test.mjs",',
    "    ],",
    "",
  ].join("\n");
  const mutated = ci.replace(`${t11Tuple}${m07Tuple}`, `${m07Tuple}${t11Tuple}`);
  assert.notEqual(mutated, ci);
  await assert.rejects(
    buildPublisherCatalogPinningEvidence({
      trackedFileBytes: {
        "scripts/run-ci-quality-gate.mjs": Buffer.from(mutated),
      },
    }),
    hasCode("PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT"),
  );
});

test("rejects drift in the exact M07-T01 CI tuple", async () => {
  const ci = await readFile(new URL("../scripts/run-ci-quality-gate.mjs", import.meta.url), "utf8");
  const mutated = ci.replace(
    '"scripts/verify-control-plane-bundle-store.mjs"',
    '"scripts/verify-publisher-invalid-source-matrix.mjs"',
  );
  assert.notEqual(mutated, ci);
  await assert.rejects(
    buildPublisherCatalogPinningEvidence({
      trackedFileBytes: {
        "scripts/run-ci-quality-gate.mjs": Buffer.from(mutated),
      },
    }),
    hasCode("PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT"),
  );
});

test("rejects exact M07-T01 root registration drift", async () => {
  const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  manifest.scripts["verify:control-plane-bundle-store"] =
    "node scripts/verify-control-plane-bundle-store.mjs";
  await assert.rejects(
    buildPublisherCatalogPinningEvidence({
      trackedFileBytes: {
        "package.json": Buffer.from(JSON.stringify(manifest)),
      },
    }),
    hasCode("PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT"),
  );
});

test("rejects removal of the aggregate M07-T01 successor", async () => {
  const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  manifest.scripts.test = manifest.scripts.test.replace(
    " && pnpm test:control-plane-bundle-store",
    "",
  );
  await assert.rejects(
    buildPublisherCatalogPinningEvidence({
      trackedFileBytes: {
        "package.json": Buffer.from(JSON.stringify(manifest)),
      },
    }),
    hasCode("PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT"),
  );
});

test("rejects a non-immediate aggregate T11 to M07-T01 edge", async () => {
  const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  manifest.scripts.check = manifest.scripts.check.replace(
    "pnpm verify:publisher-invalid-source-matrix && pnpm verify:control-plane-bundle-store",
    "pnpm verify:control-plane-bundle-store && pnpm verify:publisher-invalid-source-matrix",
  );
  await assert.rejects(
    buildPublisherCatalogPinningEvidence({
      trackedFileBytes: {
        "package.json": Buffer.from(JSON.stringify(manifest)),
      },
    }),
    hasCode("PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT"),
  );
});

test("accepts an append-only M07 successor without rewriting frozen T08 evidence", async () => {
  const baseline = await buildPublisherCatalogPinningEvidence();
  const ci = await readFile(new URL("../scripts/run-ci-quality-gate.mjs", import.meta.url), "utf8");
  const rootPackage = await readFile(new URL("../package.json", import.meta.url), "utf8");
  const appended = await buildPublisherCatalogPinningEvidence({
    trackedFileBytes: {
      "scripts/run-ci-quality-gate.mjs": Buffer.from(appendValidCiSuccessor(ci), "utf8"),
      "package.json": Buffer.from(appendValidRootSuccessor(rootPackage), "utf8"),
    },
  });
  assert.deepEqual(appended.artifactBytes, baseline.artifactBytes);
  assert.equal(appended.artifactSha256, baseline.artifactSha256);
});

test("rejects dead CI proof steps that are absent from the executed plan", async () => {
  const ci = await readFile(new URL("../scripts/run-ci-quality-gate.mjs", import.meta.url), "utf8");
  const filtered = ci.replaceAll(
    "...PROOF_ENTRIES.map(",
    '...PROOF_ENTRIES.filter(({ id }) => id !== "publisher-catalog-pinning").map(',
  );
  assert.notEqual(filtered, ci);
  const mutated = [
    filtered,
    "",
    "const inertCatalogPinningSteps = Object.freeze([",
    '  "verify-publisher-catalog-pinning",',
    '  "test-publisher-catalog-pinning",',
    "]);",
    "void inertCatalogPinningSteps;",
    "",
  ].join("\n");
  await assert.rejects(
    buildPublisherCatalogPinningEvidence({
      trackedFileBytes: {
        "scripts/run-ci-quality-gate.mjs": Buffer.from(mutated),
      },
    }),
    hasCode("PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT"),
  );
});

test("rejects CI plan validation hidden behind an unreachable branch", async () => {
  const ci = await readFile(new URL("../scripts/run-ci-quality-gate.mjs", import.meta.url), "utf8");
  const mutated = ci.replace(
    "  validateQualityGatePlan(steps);",
    "  if (false) validateQualityGatePlan(steps);",
  );
  assert.notEqual(mutated, ci);
  await assert.rejects(
    buildPublisherCatalogPinningEvidence({
      trackedFileBytes: {
        "scripts/run-ci-quality-gate.mjs": Buffer.from(mutated),
      },
    }),
    hasCode("PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT"),
  );
});

test("rejects T08 steps filtered from the candidate CI plan", async () => {
  const ci = await readFile(new URL("../scripts/run-ci-quality-gate.mjs", import.meta.url), "utf8");
  const mutated = ci.replaceAll(
    "...PROOF_ENTRIES.map(",
    '...PROOF_ENTRIES.filter(({ id }) => id !== "publisher-catalog-pinning").map(',
  );
  assert.notEqual(mutated, ci);
  await assert.rejects(
    buildPublisherCatalogPinningEvidence({
      trackedFileBytes: {
        "scripts/run-ci-quality-gate.mjs": Buffer.from(mutated),
      },
    }),
    hasCode("PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT"),
  );
});

test("rejects a CLI main path that bypasses the non-overridable default plan", async () => {
  const ci = await readFile(new URL("../scripts/run-ci-quality-gate.mjs", import.meta.url), "utf8");
  const mutated = ci.replace(
    "receipt = await executeDefaultQualityGate({",
    "receipt = await executeQualityGate({ steps: [],",
  );
  assert.notEqual(mutated, ci);
  await assert.rejects(
    buildPublisherCatalogPinningEvidence({
      trackedFileBytes: {
        "scripts/run-ci-quality-gate.mjs": Buffer.from(mutated),
      },
    }),
    hasCode("PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT"),
  );
});

test("rejects a dead default-plan call followed by an aliased direct executor", async () => {
  const ci = await readFile(new URL("../scripts/run-ci-quality-gate.mjs", import.meta.url), "utf8");
  const mutated = ci.replace(
    "    receipt = await executeDefaultQualityGate({",
    [
      "    if (false) await executeDefaultQualityGate({ steps: [] });",
      "    const bypass = executeQualityGate;",
      "    receipt = await bypass({",
    ].join("\n"),
  );
  assert.notEqual(mutated, ci);
  await assert.rejects(
    buildPublisherCatalogPinningEvidence({
      trackedFileBytes: {
        "scripts/run-ci-quality-gate.mjs": Buffer.from(mutated),
      },
    }),
    hasCode("PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT"),
  );
});

test("rejects direct and destructured reassignment of CI execution authority", async () => {
  const ci = await readFile(new URL("../scripts/run-ci-quality-gate.mjs", import.meta.url), "utf8");
  const mutations = [
    ci.replace("const entrypoint =", "main = async () => {};\n\nconst entrypoint ="),
    ci.replace(
      "const entrypoint =",
      [
        "({ executeDefaultQualityGate } = {",
        '  executeDefaultQualityGate: async () => ({ status: "PASS" }),',
        "});",
        "",
        "const entrypoint =",
      ].join("\n"),
    ),
  ];
  for (const mutated of mutations) {
    assert.notEqual(mutated, ci);
    await assert.rejects(
      buildPublisherCatalogPinningEvidence({
        trackedFileBytes: {
          "scripts/run-ci-quality-gate.mjs": Buffer.from(mutated),
        },
      }),
      hasCodeAndMessage(
        "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
        "Single-pass CI must not reassign an authoritative execution binding or use direct eval.",
      ),
    );
  }
});

test("rejects real-entrypoint-only CI plan-creator reassignment", async () => {
  const ci = await readFile(new URL("../scripts/run-ci-quality-gate.mjs", import.meta.url), "utf8");
  const marker = "if (import.meta.url === entrypoint) {";
  const mutated = ci.replace(
    marker,
    [marker, "  createQualityGateSteps = () => Object.freeze([]);", "}", marker].join("\n"),
  );
  assert.notEqual(mutated, ci);
  await assert.rejects(
    buildPublisherCatalogPinningEvidence({
      trackedFileBytes: {
        "scripts/run-ci-quality-gate.mjs": Buffer.from(mutated),
      },
    }),
    hasCodeAndMessage(
      "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
      "Single-pass CI must not reassign an authoritative execution binding or use direct eval.",
    ),
  );
});

test("rejects an early return that makes the reviewed CI main path unreachable", async () => {
  const ci = await readFile(new URL("../scripts/run-ci-quality-gate.mjs", import.meta.url), "utf8");
  const mutated = ci.replace("async function main() {", "async function main() {\n  return;");
  assert.notEqual(mutated, ci);
  await assert.rejects(
    buildPublisherCatalogPinningEvidence({
      trackedFileBytes: {
        "scripts/run-ci-quality-gate.mjs": Buffer.from(mutated),
      },
    }),
    hasCodeAndMessage(
      "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
      "CI main must not contain an early-return path before or around default-plan execution.",
    ),
  );
});

test("rejects caller-controlled steps placed after the default CI plan", async () => {
  const ci = await readFile(new URL("../scripts/run-ci-quality-gate.mjs", import.meta.url), "utf8");
  const mutated = ci.replace(
    "    ...options,\n    steps: createQualityGateSteps(),",
    "    steps: createQualityGateSteps(),\n    ...options,",
  );
  assert.notEqual(mutated, ci);
  await assert.rejects(
    buildPublisherCatalogPinningEvidence({
      trackedFileBytes: {
        "scripts/run-ci-quality-gate.mjs": Buffer.from(mutated),
      },
    }),
    hasCode("PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT"),
  );
});

test("rejects drift in the independently pinned CI plan digest", async () => {
  const ci = await readFile(new URL("../scripts/run-ci-quality-gate.mjs", import.meta.url), "utf8");
  const mutated = ci.replace(
    /const QUALITY_GATE_PLAN_SHA256 = "[0-9a-f]{64}";/u,
    `const QUALITY_GATE_PLAN_SHA256 = "${"0".repeat(64)}";`,
  );
  assert.notEqual(mutated, ci);
  await assert.rejects(
    buildPublisherCatalogPinningEvidence({
      trackedFileBytes: {
        "scripts/run-ci-quality-gate.mjs": Buffer.from(mutated),
      },
    }),
    hasCode("PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT"),
  );
});

test("rejects non-UTF-8 CI source bytes before executable observation", async () => {
  const ci = Buffer.from(
    await readFile(new URL("../scripts/run-ci-quality-gate.mjs", import.meta.url)),
  );
  ci[0] = 0xff;
  await assert.rejects(
    buildPublisherCatalogPinningEvidence({
      trackedFileBytes: {
        "scripts/run-ci-quality-gate.mjs": ci,
      },
    }),
    hasCode("PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT"),
  );
});

test("anchors the current M06-T02 historical compatibility reader in successor evidence", async () => {
  const built = await buildPublisherCatalogPinningEvidence();
  const relativePath = "scripts/lib/publisher-catalog-resolution-proof.mjs";
  const current = await readFile(new URL(`../${relativePath}`, import.meta.url));
  const tampered = Buffer.from(current);
  tampered[tampered.length - 1] ^= 1;
  await assert.rejects(
    verifyPublisherCatalogPinningEvidence({
      artifactBytes: built.artifactBytes,
      proofDocument: validProofDocument(built.artifactSha256),
      trackedFileBytes: { [relativePath]: tampered },
    }),
    hasCode("PUBLISHER_CATALOG_PINNING_ARTIFACT_DRIFT"),
  );
});

test("rejects protocol traceability ownership drift", async () => {
  const traceability = JSON.parse(
    await readFile(
      new URL("../docs/proof/protocol-0.1.0-traceability.json", import.meta.url),
      "utf8",
    ),
  );
  traceability.conformanceRules.find(({ id }) => id === "C-013").owners = ["M06-T10"];
  await assert.rejects(
    buildPublisherCatalogPinningEvidence({
      traceabilityText: JSON.stringify(traceability),
    }),
    hasCode("PUBLISHER_CATALOG_PINNING_TRACEABILITY_DRIFT"),
  );
});

test("rejects focused runtime test-inventory erosion", async () => {
  await assert.rejects(
    buildPublisherCatalogPinningEvidence({
      trackedFileBytes: {
        "packages/publisher/test/catalog-pinning.test.ts": Buffer.from(
          'import { test } from "vitest";\ntest("only one", () => {});\n',
        ),
      },
    }),
    hasCode("PUBLISHER_CATALOG_PINNING_TEST_INVENTORY_DRIFT"),
  );
});

test("rejects compiler-negative inventory erosion", async () => {
  await assert.rejects(
    buildPublisherCatalogPinningEvidence({
      trackedFileBytes: {
        "packages/publisher/test/catalog-pinning.types.ts": Buffer.from("export {};\n"),
      },
    }),
    hasCode("PUBLISHER_CATALOG_PINNING_TEST_INVENTORY_DRIFT"),
  );
});

test("rejects proof-document path and hash drift", async () => {
  const built = await buildPublisherCatalogPinningEvidence();
  await assert.rejects(
    verifyPublisherCatalogPinningEvidence({
      artifactBytes: built.artifactBytes,
      proofDocument: validProofDocument("0".repeat(64)),
    }),
    hasCode("PUBLISHER_CATALOG_PINNING_PROOF_DOCUMENT_DRIFT"),
  );
});

test("artifact reader rejects symbolic links and non-regular files", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-catalog-pinning-reader-"));
  try {
    const built = await buildPublisherCatalogPinningEvidence();
    const target = path.join(directory, "artifact-target.json");
    const symbolic = path.join(directory, "artifact-link.json");
    await writeFile(target, built.artifactBytes);
    await symlink(target, symbolic);

    for (const artifactPath of [symbolic, directory]) {
      await assert.rejects(
        verifyPublisherCatalogPinningEvidence({
          artifactPath,
          proofDocument: validProofDocument(built.artifactSha256),
        }),
        hasCode("PUBLISHER_CATALOG_PINNING_ARTIFACT_DRIFT"),
      );
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("proof-document reader rejects symbolic links and non-regular files", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-catalog-pinning-reader-"));
  try {
    const built = await buildPublisherCatalogPinningEvidence();
    const target = path.join(directory, "proof-target.md");
    const symbolic = path.join(directory, "proof-link.md");
    await writeFile(target, validProofDocument(built.artifactSha256));
    await symlink(target, symbolic);

    for (const proofDocumentPath of [symbolic, directory]) {
      await assert.rejects(
        verifyPublisherCatalogPinningEvidence({
          artifactBytes: built.artifactBytes,
          proofDocumentPath,
        }),
        hasCode("PUBLISHER_CATALOG_PINNING_PROOF_DOCUMENT_DRIFT"),
      );
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("atomic writer creates an exact alternate evidence copy", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-catalog-pinning-"));
  try {
    const destination = path.join(directory, "evidence.json");
    const built = await buildPublisherCatalogPinningEvidence();
    await writePublisherCatalogPinningEvidence({ artifactPath: destination });
    assert.deepEqual(await readFile(destination), built.artifactBytes);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("atomic writer rejects a symbolic-link destination", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-catalog-pinning-"));
  try {
    const target = path.join(directory, "target.json");
    const destination = path.join(directory, "evidence.json");
    await writeFile(target, "preserve");
    await symlink(target, destination);
    await assert.rejects(writePublisherCatalogPinningEvidence({ artifactPath: destination }));
    assert.equal(await readFile(target, "utf8"), "preserve");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("atomic writer rejects temporary-byte tampering before rename", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-catalog-pinning-"));
  try {
    const destination = path.join(directory, "evidence.json");
    await assert.rejects(
      writePublisherCatalogPinningEvidence({
        artifactPath: destination,
        beforeAtomicRename: async ({ temporaryPath }) => {
          await writeFile(temporaryPath, "tampered");
        },
      }),
    );
    await assert.rejects(readFile(destination), { code: "ENOENT" });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects unknown and accessor-backed evidence options", async () => {
  await assert.rejects(
    buildPublisherCatalogPinningEvidence({ unknown: true }),
    hasCode("PUBLISHER_CATALOG_PINNING_OPTIONS_INVALID"),
  );
  let invoked = false;
  const options = {};
  Object.defineProperty(options, "sourceText", {
    enumerable: true,
    get() {
      invoked = true;
      return "{}";
    },
  });
  await assert.rejects(
    buildPublisherCatalogPinningEvidence(options),
    hasCode("PUBLISHER_CATALOG_PINNING_OPTIONS_INVALID"),
  );
  assert.equal(invoked, false);
});
