import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { brotliDecompressSync } from "node:zlib";

import {
  PUBLISHER_BUNDLE_PUBLICATION_COMPATIBILITY_READERS,
  PUBLISHER_BUNDLE_PUBLICATION_PREREQUISITE_PINS,
  PUBLISHER_BUNDLE_PUBLICATION_RESULT_AUTHORITY_FILES,
  PublisherBundlePublicationEvidenceError,
  buildPublisherBundlePublicationEvidence,
  verifyPublisherBundlePublicationEvidence,
  writePublisherBundlePublicationEvidence,
} from "../scripts/lib/publisher-bundle-publication-proof.mjs";
import { createQualityGateSteps } from "../scripts/run-ci-quality-gate.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const SOURCE = "packages/publisher/src/bundle-publication.ts";
const DISTRIBUTION = "packages/publisher/dist/bundle-publication.js";
const DECLARATION = "packages/publisher/dist/bundle-publication.d.ts";
const SOURCE_INDEX = "packages/publisher/src/index.ts";
const DISTRIBUTION_INDEX = "packages/publisher/dist/index.js";
const PUBLIC_DECLARATION = "packages/publisher/dist/index.d.ts";
const PUBLISHER_PACKAGE = "packages/publisher/package.json";
const ROOT_PACKAGE = "package.json";
const CI_SOURCE = "scripts/run-ci-quality-gate.mjs";
const CI_WORKFLOW = ".github/workflows/ci.yml";
const RUNTIME_TEST = "packages/publisher/test/bundle-publication.test.ts";
const ROOT_TEST = "tests/publisher-bundle-publication.test.mjs";
const TRACEABILITY = "docs/proof/protocol-0.1.0-traceability.json";
const ARTIFACT = "docs/proof/artifacts/publisher-0.1.0-bundle-publication.json";

// Reconstructs exact M07-T08 execution-preflight readers from their live M07-T09 successors so
// rollback rejection remains deterministic and independent from Git or child processes.
const M07_T09_EXECUTION_PREFLIGHT_PROOF_ROLLBACK_PATCH = `
G2EFICwKYyLThe+URexNXJSo0b78r+hdNUjLisJekekB8lJ9f85bJt+b0nwWCBB4yrJ3kFD6rwWindNqtX2UGIViIPGrriRMUdXE
5fTHEnx84VecA2gsG/N8zAIsDMPAJuaPCQQSaBSIBYopqFdx9MUMUWvWzWx7e46tT+a6ooXrpy85nup6LUf//eXryRb25VV0lbYI
e7Wd5cDFbSN/bHNsAG1RcIe609mvrFjxEmChtCbLV5M9it/f8usOpd5HbpdNXujrkyPLvhx/6MQx0pymVFfSUmqfLbKFWIduomCG
g6WbI5NwHZnaY7SIrMe+Wv9tORQ3WxlMBOGfPP1bX1l2J93dHae2KjteWnEUSbkPpnSt9AmFE2kMaw2cm/ZBdWgqTlW3tjjmLDQD
Ru/NJwyBlqNwdpszKRZAuy2Lrye+f4PDZfJ1KFiWDeArE+xd/e2Ts/f6YBrZBUCIgXZE6BJIHlS7F/r3kIiwkIaGyRTPXgSqBKmN
XjQLTGDrJFIsMxDZHaeRddOsjEBOsnLviolnEGHrNrPCrNklugO5CAxOL4aF1dnn0kAaVr3WZAaXQmnRQZCyJ13ZDq7dL7ycWJ3X
baywaNqXE383p9LG1mtK+pcli4y6U7JjIg5w4IB0XvHxBH3+eddye7lbgMeuqvNPoNjjcW72lHWda0IDsbcCmmyf84JRrfOHm2xv
YwQ=
`.replaceAll(/\s/gu, "");
const M07_T09_EXECUTION_PREFLIGHT_ROOT_TEST_ROLLBACK_PATCH = `
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
`.replaceAll(/\s/gu, "");

const baseline = await buildPublisherBundlePublicationEvidence();
const runtimeReceipt = baseline.artifact.claims.singleOfficialInputPublicRuntimeProbe;
const ciReceipt = baseline.artifact.claims.registrations.executableSinglePassCi;
const pinnedProof = [
  "# Test-only final T09 pin",
  "",
  `\`${ARTIFACT}\``,
  "",
  `\`sha256:${baseline.artifactSha256}\``,
  "",
].join("\n");

function expectCode(code) {
  return (error) => {
    assert.equal(error instanceof PublisherBundlePublicationEvidenceError, true);
    assert.equal(error.code, code);
    return true;
  };
}

function fastOptions(additions = {}) {
  return {
    runtimeReceipt,
    ciReceipt,
    ...additions,
  };
}

async function sourceBytes(relativePath) {
  return readFile(path.join(ROOT, relativePath));
}

async function sourceText(relativePath) {
  return readFile(path.join(ROOT, relativePath), "utf8");
}

function applyExactRollbackPatch(currentBytes, encodedPatch) {
  const patchText = brotliDecompressSync(Buffer.from(encodedPatch, "base64")).toString("utf8");
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
    const expectedRollbackCount = Number(header[4] ?? "1");
    assert.ok(currentStart >= currentIndex);
    reconstructedLines.push(...currentLines.slice(currentIndex, currentStart));
    currentIndex = currentStart;
    patchIndex += 1;
    let currentCount = 0;
    let rollbackCount = 0;

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
        rollbackCount += 1;
      } else if (marker === "-") {
        assert.equal(currentLines[currentIndex], content);
        currentIndex += 1;
        currentCount += 1;
      } else if (marker === "+") {
        reconstructedLines.push(content);
        rollbackCount += 1;
      } else {
        break;
      }
      patchIndex += 1;
    }
    assert.equal(currentCount, expectedCurrentCount);
    assert.equal(rollbackCount, expectedRollbackCount);
  }

  reconstructedLines.push(...currentLines.slice(currentIndex));
  return Buffer.from(reconstructedLines.join("\n"), "utf8");
}

async function trackedMutation(relativePath, transform) {
  const original = await sourceText(relativePath);
  const mutated = transform(original);
  assert.notEqual(mutated, original, `Mutation did not alter ${relativePath}`);
  return fastOptions({
    trackedFileBytes: {
      [relativePath]: Buffer.from(mutated, "utf8"),
    },
  });
}

function appendValidCiSuccessor(source, rootPackageSource) {
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
  const ciSource = withTuple.replace(
    /const QUALITY_GATE_PLAN_SHA256 = "[0-9a-f]{64}";/u,
    `const QUALITY_GATE_PLAN_SHA256 = "${planSha256}";`,
  );
  assert.notEqual(ciSource, withTuple);

  const rootManifest = JSON.parse(rootPackageSource);
  const proofIds = [
    ...currentSteps
      .filter(({ id }) => id.startsWith("verify-"))
      .map(({ id }) => id.slice("verify-".length)),
    successor.id,
  ];
  const splitScript = (script) => script.split(" && ").map((command) => command.trim());
  const legacyPrerequisiteInventory = proofIds.map((id) => ({
    id,
    verify: splitScript(rootManifest.scripts[`verify:${id}`]).slice(0, -1),
    test: splitScript(rootManifest.scripts[`test:${id}`]).slice(0, -1),
  }));
  const expandRootScript = (scriptName, ancestors = []) => {
    assert.equal(ancestors.includes(scriptName), false);
    const script = rootManifest.scripts[scriptName];
    assert.equal(typeof script, "string");
    return splitScript(script).flatMap((command) => {
      const reference = /^pnpm ([a-z0-9:-]+)$/u.exec(command)?.[1];
      return reference && Object.hasOwn(rootManifest.scripts, reference)
        ? expandRootScript(reference, [...ancestors, scriptName])
        : [command];
    });
  };
  const leafInvocations = expandRootScript("check");
  const distinctLeafWorkloads = [...new Set(leafInvocations)].sort();
  const hashJson = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
  const replacements = [
    [
      /const LEGACY_PREREQUISITE_SHA256 =\n {2}"[0-9a-f]{64}";/u,
      `const LEGACY_PREREQUISITE_SHA256 =\n  "${hashJson(legacyPrerequisiteInventory)}";`,
    ],
    [
      /const LEGACY_LEAF_INVOCATION_SHA256 =\n {2}"[0-9a-f]{64}";/u,
      `const LEGACY_LEAF_INVOCATION_SHA256 =\n  "${hashJson(leafInvocations)}";`,
    ],
    [
      /const DISTINCT_LEAF_WORKLOAD_SHA256 =\n {2}"[0-9a-f]{64}";/u,
      `const DISTINCT_LEAF_WORKLOAD_SHA256 =\n  "${hashJson(distinctLeafWorkloads)}";`,
    ],
  ];
  let fullyPinnedCiSource = ciSource;
  for (const [pattern, replacement] of replacements) {
    const mutated = fullyPinnedCiSource.replace(pattern, replacement);
    assert.notEqual(mutated, fullyPinnedCiSource);
    fullyPinnedCiSource = mutated;
  }
  return Object.freeze({ ciSource: fullyPinnedCiSource });
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
    "pnpm verify:control-plane-runtime-fault-injection && pnpm lint",
    "pnpm verify:control-plane-runtime-fault-injection && pnpm verify:control-plane-append-only-probe && pnpm lint",
  );
  manifest.scripts.test = manifest.scripts.test.replace(
    "pnpm test:control-plane-runtime-fault-injection && turbo run test",
    "pnpm test:control-plane-runtime-fault-injection && pnpm test:control-plane-append-only-probe && turbo run test",
  );
  assert.notEqual(manifest.scripts.check, originalCheck);
  assert.notEqual(manifest.scripts.test, originalTest);
  return JSON.stringify(manifest);
}

async function verifyWith(additions = {}) {
  return verifyPublisherBundlePublicationEvidence(
    fastOptions({
      artifactBytes: baseline.artifactBytes,
      proofDocument: pinnedProof,
      ...additions,
    }),
  );
}

test("[authority] builds the exact T09 profile and three prerequisite pins", () => {
  assert.equal(baseline.artifact.profile, "desen.publisher.bundle-publication-proof.v1");
  assert.equal(baseline.artifact.task, "M06-T09");
  assert.equal(baseline.artifact.result, "PASS");
  assert.deepEqual(
    baseline.artifact.prerequisites.map(({ task }) => task),
    ["M06-T08", "M02-T04", "M02-T11"],
  );
});

test("[authority] preserves the exact versioned Publisher artifact root contract", () => {
  assert.deepEqual(Object.keys(baseline.artifact).sort(), [
    "claims",
    "nonclaims",
    "prerequisites",
    "profile",
    "reproduction",
    "result",
    "schemaVersion",
    "summary",
    "task",
    "tests",
    "trackedFiles",
  ]);
  assert.equal(baseline.artifact.schemaVersion, 1);
  assert.equal(
    baseline.artifact.summary,
    "The built public Publisher composes T08 exactly once, validates one revision-only complete Bundle through the exact Catalog set and twice-enforced 2 MiB canonical-byte envelope, and returns only a revision-closed immutable Validator snapshot or an atomic failure shell.",
  );
  assert.equal(baseline.artifact.summary.length > 0, true);
  assert.equal(Array.isArray(baseline.artifact.nonclaims), true);
  assert.equal(baseline.artifact.nonclaims.length > 0, true);
  assert.equal(Object.hasOwn(baseline.artifact, "nonClaims"), false);
});

test("[authority] records one T08 call, two revisions, two measurements, and one Validator call", () => {
  const boundary = baseline.artifact.claims.terminalBoundary;
  assert.equal(boundary.predecessorInvocations, 1);
  assert.equal(boundary.provisionalRevisionInvocations, 1);
  assert.equal(boundary.closureRevisionInvocations, 1);
  assert.equal(boundary.completeCanonicalByteMeasurements, 2);
  assert.equal(boundary.validatorInvocations, 1);
});

test("[limit] records the exact twice-enforced 2 MiB terminal envelope", () => {
  const implementation = baseline.artifact.claims.implementation;
  assert.equal(implementation.maximumCanonicalBytes, 2_097_152);
  assert.deepEqual(implementation.completeBundleLimitChecks, [
    "candidateBytes.byteLength",
    "validatedBytes.byteLength",
  ]);
});

test("[api] records the exact public package-root function and hides private limit seams", () => {
  const api = baseline.artifact.claims.publicApi;
  assert.deepEqual(api.sourceExports, ["publishDesenSource"]);
  assert.equal(api.privateLimitSeamsHidden, true);
  assert.deepEqual(api.catalogCandidateTypeExport, {
    sourceExports: ["PublishCatalogPackageCandidate"],
    declarationExports: ["PublishCatalogPackageCandidate"],
    runtimeValueExportAbsent: true,
  });
  assert.equal(
    api.signature,
    "publishDesenSource(string, readonly PublishCatalogPackageCandidate[]): PublishResult",
  );
});

test("[authority] authenticates one isolated actual dist/index.js success and one atomic failure", () => {
  assert.deepEqual(runtimeReceipt.successKeys, ["bundle", "diagnostics", "ok"]);
  assert.deepEqual(runtimeReceipt.failureKeys, ["diagnostics", "ok", "stage"]);
  assert.equal(runtimeReceipt.successInvocations, 1);
  assert.equal(runtimeReceipt.controlledFailureInvocations, 1);
  assert.equal(runtimeReceipt.revisionClosed, true);
  assert.equal(runtimeReceipt.publicationAbsent, true);
  assert.equal(runtimeReceipt.failureAtomic, true);
  assert.equal(runtimeReceipt.failureStage, "source-schema");
  assert.equal(runtimeReceipt.failureDiagnosticsNonEmpty, true);
  assert.equal(runtimeReceipt.failureFirstDiagnosticError, true);
  assert.equal(runtimeReceipt.failureFirstDiagnosticStageMatchesResult, true);
});

test("[compatibility] externally tracks every current T02 through T09 proof reader", () => {
  assert.deepEqual(
    baseline.artifact.claims.compatibilityReaders.map(({ path: readerPath }) => readerPath),
    PUBLISHER_BUNDLE_PUBLICATION_COMPATIBILITY_READERS,
  );
  assert.equal(
    baseline.artifact.claims.compatibilityReaders.every(({ sha256 }) =>
      /^[0-9a-f]{64}$/u.test(sha256),
    ),
    true,
  );
  assert.deepEqual(
    baseline.artifact.trackedFiles.find(
      ({ path: trackedPath }) =>
        trackedPath === "scripts/lib/publisher-execution-preflight-proof.mjs",
    ),
    {
      path: "scripts/lib/publisher-execution-preflight-proof.mjs",
      bytes: 62_112,
      sha256: "e49e83e2edc9836bf42b98d05545391d23763c886bb90beae96826c6171cd4db",
    },
  );
});

test("[authority] verifies fresh in-memory artifact bytes and an exact proof pin", async () => {
  const result = await verifyWith();
  assert.equal(result.result, "PASS");
  assert.equal(result.artifactSha256, baseline.artifactSha256);
  assert.equal(result.compatibilityReaders, 7);
});

test("[authority] rejects one changed artifact byte", async () => {
  const mutated = Buffer.from(baseline.artifactBytes);
  mutated[mutated.length - 2] ^= 1;
  await assert.rejects(
    verifyPublisherBundlePublicationEvidence(
      fastOptions({ artifactBytes: mutated, proofDocument: pinnedProof }),
    ),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_ARTIFACT_DRIFT"),
  );
});

test("[authority] rejects a PENDING proof document", async () => {
  await assert.rejects(
    verifyPublisherBundlePublicationEvidence(
      fastOptions({
        artifactBytes: baseline.artifactBytes,
        proofDocument: `\`${ARTIFACT}\`\n\n\`sha256:PENDING\``,
      }),
    ),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_PROOF_DOCUMENT_DRIFT"),
  );
});

test("[authority] rejects a wrong proof-document hash", async () => {
  await assert.rejects(
    verifyPublisherBundlePublicationEvidence(
      fastOptions({
        artifactBytes: baseline.artifactBytes,
        proofDocument: `\`${ARTIFACT}\`\n\n\`sha256:${"0".repeat(64)}\``,
      }),
    ),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_PROOF_DOCUMENT_DRIFT"),
  );
});

test("[options] rejects an options accessor without invoking it", async () => {
  let reads = 0;
  const options = {};
  Object.defineProperty(options, "runtimeReceipt", {
    enumerable: true,
    get() {
      reads += 1;
      return runtimeReceipt;
    },
  });
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(options),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_OPTIONS_INVALID"),
  );
  assert.equal(reads, 0);
});

test("[options] rejects inherited option authority", async () => {
  const options = Object.create({ runtimeReceipt });
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(options),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_OPTIONS_INVALID"),
  );
});

test("[options] rejects an unknown own option", async () => {
  await assert.rejects(
    buildPublisherBundlePublicationEvidence({ unexpected: true }),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_OPTIONS_INVALID"),
  );
});

test("[options] rejects symbol option authority", async () => {
  await assert.rejects(
    buildPublisherBundlePublicationEvidence({ [Symbol("authority")]: true }),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_OPTIONS_INVALID"),
  );
});

test("[options] rejects an accessor in the tracked-byte override map", async () => {
  let reads = 0;
  const map = {};
  Object.defineProperty(map, SOURCE, {
    enumerable: true,
    get() {
      reads += 1;
      return Buffer.from("not observed");
    },
  });
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(fastOptions({ trackedFileBytes: map })),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_OPTIONS_INVALID"),
  );
  assert.equal(reads, 0);
});

test("[options] rejects non-byte tracked override values", async () => {
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(
      fastOptions({ trackedFileBytes: { [SOURCE]: "not bytes" } }),
    ),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_OPTIONS_INVALID"),
  );
});

test("[options] rejects a transparent Proxy artifact byte authority without invoking traps", async () => {
  let traps = 0;
  const artifactBytes = new Proxy(Buffer.from(baseline.artifactBytes), {
    get() {
      traps += 1;
      throw new TypeError("artifact byte authority trap");
    },
    getOwnPropertyDescriptor() {
      traps += 1;
      throw new TypeError("artifact byte authority trap");
    },
    getPrototypeOf() {
      traps += 1;
      throw new TypeError("artifact byte authority trap");
    },
    ownKeys() {
      traps += 1;
      throw new TypeError("artifact byte authority trap");
    },
  });
  await assert.rejects(
    verifyPublisherBundlePublicationEvidence(
      fastOptions({ artifactBytes, proofDocument: pinnedProof }),
    ),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_OPTIONS_INVALID"),
  );
  assert.equal(traps, 0);
});

test("[options] controls a revoked Proxy artifact byte authority", async () => {
  const revocable = Proxy.revocable(Buffer.from(baseline.artifactBytes), {});
  revocable.revoke();
  await assert.rejects(
    verifyPublisherBundlePublicationEvidence(
      fastOptions({ artifactBytes: revocable.proxy, proofDocument: pinnedProof }),
    ),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_OPTIONS_INVALID"),
  );
});

test("[options] rejects a transparent Proxy tracked-byte authority without invoking traps", async () => {
  let traps = 0;
  const bytes = new Proxy(Buffer.from(await sourceBytes(SOURCE)), {
    get() {
      traps += 1;
      throw new TypeError("tracked byte authority trap");
    },
    getOwnPropertyDescriptor() {
      traps += 1;
      throw new TypeError("tracked byte authority trap");
    },
    getPrototypeOf() {
      traps += 1;
      throw new TypeError("tracked byte authority trap");
    },
    ownKeys() {
      traps += 1;
      throw new TypeError("tracked byte authority trap");
    },
  });
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(fastOptions({ trackedFileBytes: { [SOURCE]: bytes } })),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_OPTIONS_INVALID"),
  );
  assert.equal(traps, 0);
});

test("[options] controls a revoked Proxy prerequisite-byte authority", async () => {
  const [{ path: prerequisitePath }] = PUBLISHER_BUNDLE_PUBLICATION_PREREQUISITE_PINS;
  const revocable = Proxy.revocable(Buffer.from(await sourceBytes(prerequisitePath)), {});
  revocable.revoke();
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(
      fastOptions({ prerequisiteBytes: { [prerequisitePath]: revocable.proxy } }),
    ),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_OPTIONS_INVALID"),
  );
});

test("[options] rejects a Uint8Array subclass as artifact byte authority", async () => {
  class ArtifactBytes extends Uint8Array {}
  await assert.rejects(
    verifyPublisherBundlePublicationEvidence(
      fastOptions({
        artifactBytes: new ArtifactBytes(baseline.artifactBytes),
        proofDocument: pinnedProof,
      }),
    ),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_OPTIONS_INVALID"),
  );
});

test("[options] rejects custom-prototype tracked-byte authority", async () => {
  const bytes = new Uint8Array(await sourceBytes(SOURCE));
  Object.setPrototypeOf(bytes, {});
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(fastOptions({ trackedFileBytes: { [SOURCE]: bytes } })),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_OPTIONS_INVALID"),
  );
});

test("[options] rejects accessor-like prerequisite bytes without invoking the accessor", async () => {
  let reads = 0;
  const [{ path: prerequisitePath }] = PUBLISHER_BUNDLE_PUBLICATION_PREREQUISITE_PINS;
  const bytes = Buffer.from(await sourceBytes(prerequisitePath));
  Object.defineProperty(bytes, "authority", {
    enumerable: true,
    get() {
      reads += 1;
      return "not observed";
    },
  });
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(
      fastOptions({ prerequisiteBytes: { [prerequisitePath]: bytes } }),
    ),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_OPTIONS_INVALID"),
  );
  assert.equal(reads, 0);
});

test("[authority] rejects fatal UTF-8 corruption in tracked implementation text", async () => {
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(
      fastOptions({ trackedFileBytes: { [SOURCE]: Uint8Array.of(0xc3, 0x28) } }),
    ),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_UTF8_INVALID"),
  );
});

for (const { task, path: prerequisitePath } of PUBLISHER_BUNDLE_PUBLICATION_PREREQUISITE_PINS) {
  test(`[authority] rejects exact ${task} prerequisite drift`, async () => {
    const bytes = Buffer.from(await sourceBytes(prerequisitePath));
    bytes[0] ^= 1;
    await assert.rejects(
      buildPublisherBundlePublicationEvidence(
        fastOptions({ prerequisiteBytes: { [prerequisitePath]: bytes } }),
      ),
      expectCode("PUBLISHER_BUNDLE_PUBLICATION_PREREQUISITE_DRIFT"),
    );
  });
}

test("[ast] rejects a missing T08 predecessor call in source", async () => {
  const options = await trackedMutation(SOURCE, (text) =>
    text.replace("pinning = preflightPublishCatalogPinning(", "pinning = forgedPinning("),
  );
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(options),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_SOURCE_DRIFT"),
  );
});

test("[ast] rejects a missing first revision calculation in source", async () => {
  const options = await trackedMutation(SOURCE, (text) =>
    text.replace(
      "provisionalRevision = calculateDesenBundleRevision(pinning.pinnedDocument);",
      "provisionalRevision = String(pinning.pinnedDocument);",
    ),
  );
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(options),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_SOURCE_DRIFT"),
  );
});

test("[ast] rejects a missing canonical-byte measurement in distribution", async () => {
  const options = await trackedMutation(DISTRIBUTION, (text) =>
    text.replace(
      "const canonicalBytes = canonicalizeJsonBytes(candidate);",
      "const canonicalBytes = new Uint8Array();",
    ),
  );
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(options),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_DISTRIBUTION_DRIFT"),
  );
});

test("[ast] rejects Validator invocation without the exact T08 catalogSet", async () => {
  const options = await trackedMutation(SOURCE, (text) =>
    text.replace(
      "validateDesenBundleExecutionContracts(candidate, pinning.catalogSet)",
      "validateDesenBundleExecutionContracts(candidate, [])",
    ),
  );
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(options),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_SOURCE_DRIFT"),
  );
});

test("[ast] rejects publication metadata in the revision-only candidate", async () => {
  const options = await trackedMutation(SOURCE, (text) =>
    text.replace(
      "            revision,\n            sourceDigest:",
      "            revision,\n            publication: {},\n            sourceDigest:",
    ),
  );
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(options),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_SOURCE_DRIFT"),
  );
});

test("[limit] rejects a changed fixed 2 MiB constant", async () => {
  const options = await trackedMutation(SOURCE, (text) =>
    text.replace("maxBundleCanonicalBytes: 2_097_152", "maxBundleCanonicalBytes: 2_097_151"),
  );
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(options),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_SOURCE_DRIFT"),
  );
});

test("[authority] rejects removal of the Validator graph-independence guard", async () => {
  const options = await trackedMutation(SOURCE, (text) =>
    text.replace("!jsonGraphsAreDisjoint(candidate as object, bundle as object)", "false"),
  );
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(options),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_SOURCE_DRIFT"),
  );
});

test("[authority] rejects removal of Validator snapshot byte equality", async () => {
  const options = await trackedMutation(SOURCE, (text) =>
    text.replace("if (!byteEqual(candidateBytes, validatedBytes))", "if (false)"),
  );
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(options),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_SOURCE_DRIFT"),
  );
});

test("[authority] rejects a weakened final revision equality", async () => {
  const options = await trackedMutation(SOURCE, (text) =>
    text.replace("closedRevision !== validatedRevision", "closedRevision === validatedRevision"),
  );
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(options),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_SOURCE_DRIFT"),
  );
});

test("[authority] rejects an extra terminal success field", async () => {
  const options = await trackedMutation(SOURCE, (text) =>
    text.replace("    ok: true,\n    bundle,", "    ok: true,\n    value: bundle,\n    bundle,"),
  );
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(options),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_SOURCE_DRIFT"),
  );
});

test("[limit] rejects replacement of the post-Validator size measurement", async () => {
  const options = await trackedMutation(SOURCE, (text) =>
    text.replace(
      "validatedBytes.byteLength > limits.maxBundleCanonicalBytes",
      "candidateBytes.byteLength > limits.maxBundleCanonicalBytes",
    ),
  );
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(options),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_SOURCE_DRIFT"),
  );
});

test("[authority] rejects a second Validator invocation", async () => {
  const options = await trackedMutation(SOURCE, (text) =>
    text.replace(
      "validation = validateDesenBundleExecutionContracts(candidate, pinning.catalogSet);",
      "validateDesenBundleExecutionContracts(candidate, pinning.catalogSet);\n    validation = validateDesenBundleExecutionContracts(candidate, pinning.catalogSet);",
    ),
  );
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(options),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_SOURCE_DRIFT"),
  );
});

test("[api] rejects removal of the package-root terminal export", async () => {
  const options = await trackedMutation(SOURCE_INDEX, (text) =>
    text.replace(
      'export { publishDesenSource } from "./bundle-publication.js";',
      'export { publishDesenSource as changedPublish } from "./bundle-publication.js";',
    ),
  );
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(options),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_PUBLIC_API_DRIFT"),
  );
});

test("[api] rejects removal of the package-root catalog candidate type export", async () => {
  const options = await trackedMutation(SOURCE_INDEX, (text) =>
    text.replace(
      'export type { PublishCatalogPackageCandidate } from "./catalog-resolution.js";',
      "",
    ),
  );
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(options),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_PUBLIC_API_DRIFT"),
  );
});

test("[api] rejects the catalog candidate type exported from the wrong declaration module", async () => {
  const options = await trackedMutation(PUBLIC_DECLARATION, (text) =>
    text.replace(
      'export type { PublishCatalogPackageCandidate } from "./catalog-resolution.js";',
      'export type { PublishCatalogPackageCandidate } from "./source-json.js";',
    ),
  );
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(options),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_PUBLIC_API_DRIFT"),
  );
});

test("[api] rejects an extra package-root catalog candidate type export", async () => {
  const options = await trackedMutation(SOURCE_INDEX, (text) =>
    text.replace(
      "export type { PublishCatalogPackageCandidate }",
      "export type { PublishCatalogPackageCandidate, UnexpectedCatalogType }",
    ),
  );
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(options),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_PUBLIC_API_DRIFT"),
  );
});

test("[api] rejects a runtime catalog-resolution export from the built package root", async () => {
  const options = await trackedMutation(
    DISTRIBUTION_INDEX,
    (text) =>
      `${text}\nexport { preflightPublishCatalogResolution as PublishCatalogPackageCandidate } from "./catalog-resolution.js";\n`,
  );
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(options),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_PUBLIC_API_DRIFT"),
  );
});

test("[api] rejects a private limit seam leaked by the built package root", async () => {
  const options = await trackedMutation(
    DISTRIBUTION_INDEX,
    (text) => `${text}\nexport { publishDesenSourceWithLimits } from "./bundle-publication.js";\n`,
  );
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(options),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_PUBLIC_API_DRIFT"),
  );
});

test("[api] rejects drift in the built two-argument declaration", async () => {
  const options = await trackedMutation(DECLARATION, (text) =>
    text.replace("rawSource: string", "rawSource: unknown"),
  );
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(options),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_PUBLIC_API_DRIFT"),
  );
});

test("[api] rejects a Publisher package subpath export", async () => {
  const options = await trackedMutation(PUBLISHER_PACKAGE, (text) => {
    const manifest = JSON.parse(text);
    manifest.exports["./private"] = "./dist/bundle-publication.js";
    return JSON.stringify(manifest);
  });
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(options),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_PUBLIC_API_DRIFT"),
  );
});

test("[ci] rejects package focused-test registration drift", async () => {
  const options = await trackedMutation(PUBLISHER_PACKAGE, (text) => {
    const manifest = JSON.parse(text);
    manifest.scripts["test:bundle-publication"] = "echo skipped";
    return JSON.stringify(manifest);
  });
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(options),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_REGISTRATION_DRIFT"),
  );
});

test("[ci] rejects root generator registration drift", async () => {
  const options = await trackedMutation(ROOT_PACKAGE, (text) => {
    const manifest = JSON.parse(text);
    manifest.scripts["generate:publisher-bundle-publication"] = "echo skipped";
    return JSON.stringify(manifest);
  });
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(options),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_REGISTRATION_DRIFT"),
  );
});

test("[ci] rejects a non-immediate aggregate T08 to T09 edge", async () => {
  const options = await trackedMutation(ROOT_PACKAGE, (text) => {
    const manifest = JSON.parse(text);
    manifest.scripts.test = manifest.scripts.test.replace(
      "pnpm test:publisher-catalog-pinning && pnpm test:publisher-bundle-publication",
      "pnpm test:publisher-bundle-publication && pnpm test:publisher-catalog-pinning",
    );
    return JSON.stringify(manifest);
  });
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(options),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_REGISTRATION_DRIFT"),
  );
});

test("[ci] rejects removal of the exact publisher-bundle-publication CI id", async () => {
  const options = await trackedMutation(CI_SOURCE, (text) =>
    text.replace('"publisher-bundle-publication"', '"publisher-bundle-publication-changed"'),
  );
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(options),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_CI_DRIFT"),
  );
});

test("[ci] rejects T09 CI verifier-path drift", async () => {
  const options = await trackedMutation(CI_SOURCE, (text) =>
    text.replace(
      '"scripts/verify-publisher-bundle-publication.mjs"',
      '"scripts/verify-publisher-catalog-pinning.mjs"',
    ),
  );
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(options),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_CI_DRIFT"),
  );
});

test("[ci] rejects removal of the exact T11 CI successor", async () => {
  const options = await trackedMutation(CI_SOURCE, (text) =>
    text.replace('"publisher-invalid-source-matrix"', '"publisher-invalid-source-matrix-removed"'),
  );
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(options),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_CI_DRIFT"),
  );
});

test("[ci] rejects reordering the exact T10 to T11 CI edge", async () => {
  const options = await trackedMutation(CI_SOURCE, (text) => {
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
    return text.replace(`${t10Tuple}${t11Tuple}`, `${t11Tuple}${t10Tuple}`);
  });
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(options),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_CI_DRIFT"),
  );
});

test("[ci] rejects drift in the exact T11 CI tuple", async () => {
  const options = await trackedMutation(CI_SOURCE, (text) =>
    text.replace(
      '"scripts/verify-publisher-invalid-source-matrix.mjs"',
      '"scripts/verify-publisher-official-golden.mjs"',
    ),
  );
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(options),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_CI_DRIFT"),
  );
});

test("[ci] rejects exact T11 root registration drift", async () => {
  const options = await trackedMutation(ROOT_PACKAGE, (text) => {
    const manifest = JSON.parse(text);
    manifest.scripts["verify:publisher-invalid-source-matrix"] =
      "node scripts/verify-publisher-invalid-source-matrix.mjs";
    return JSON.stringify(manifest);
  });
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(options),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_REGISTRATION_DRIFT"),
  );
});

test("[ci] rejects exact T11 package registration drift", async () => {
  const options = await trackedMutation(PUBLISHER_PACKAGE, (text) => {
    const manifest = JSON.parse(text);
    manifest.scripts["test:invalid-source-matrix"] = "vitest run";
    return JSON.stringify(manifest);
  });
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(options),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_REGISTRATION_DRIFT"),
  );
});

test("[ci] rejects removal of the aggregate T11 successor", async () => {
  const options = await trackedMutation(ROOT_PACKAGE, (text) => {
    const manifest = JSON.parse(text);
    manifest.scripts.test = manifest.scripts.test.replace(
      " && pnpm test:publisher-invalid-source-matrix",
      "",
    );
    return JSON.stringify(manifest);
  });
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(options),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_REGISTRATION_DRIFT"),
  );
});

test("[ci] rejects a non-immediate aggregate T10 to T11 edge", async () => {
  const options = await trackedMutation(ROOT_PACKAGE, (text) => {
    const manifest = JSON.parse(text);
    manifest.scripts.check = manifest.scripts.check.replace(
      "pnpm verify:publisher-official-golden && pnpm verify:publisher-invalid-source-matrix",
      "pnpm verify:publisher-invalid-source-matrix && pnpm verify:publisher-official-golden",
    );
    return JSON.stringify(manifest);
  });
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(options),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_REGISTRATION_DRIFT"),
  );
});

test("[ci] rejects removal of the exact M07-T01 CI successor", async () => {
  const options = await trackedMutation(CI_SOURCE, (text) =>
    text.replace('"control-plane-bundle-store"', '"control-plane-bundle-store-removed"'),
  );
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(options),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_CI_DRIFT"),
  );
});

test("[ci] rejects reordering the exact T11 to M07-T01 CI edge", async () => {
  const options = await trackedMutation(CI_SOURCE, (text) => {
    const t11Tuple = [
      "    [",
      '      "publisher-invalid-source-matrix",',
      '      "scripts/verify-publisher-invalid-source-matrix.mjs",',
      '      "tests/publisher-invalid-source-matrix.test.mjs",',
      "    ],",
      "",
    ].join("\n");
    const m07T01Tuple = [
      "    [",
      '      "control-plane-bundle-store",',
      '      "scripts/verify-control-plane-bundle-store.mjs",',
      '      "tests/control-plane-bundle-store.test.mjs",',
      "    ],",
      "",
    ].join("\n");
    return text.replace(`${t11Tuple}${m07T01Tuple}`, `${m07T01Tuple}${t11Tuple}`);
  });
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(options),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_CI_DRIFT"),
  );
});

test("[ci] rejects drift in the exact M07-T01 CI tuple", async () => {
  const options = await trackedMutation(CI_SOURCE, (text) =>
    text.replace(
      '"scripts/verify-control-plane-bundle-store.mjs"',
      '"scripts/verify-publisher-invalid-source-matrix.mjs"',
    ),
  );
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(options),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_CI_DRIFT"),
  );
});

test("[ci] rejects exact M07-T01 root registration drift", async () => {
  const options = await trackedMutation(ROOT_PACKAGE, (text) => {
    const manifest = JSON.parse(text);
    manifest.scripts["verify:control-plane-bundle-store"] =
      "node scripts/verify-control-plane-bundle-store.mjs";
    return JSON.stringify(manifest);
  });
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(options),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_REGISTRATION_DRIFT"),
  );
});

test("[ci] rejects removal of the aggregate M07-T01 successor", async () => {
  const options = await trackedMutation(ROOT_PACKAGE, (text) => {
    const manifest = JSON.parse(text);
    manifest.scripts.test = manifest.scripts.test.replace(
      " && pnpm test:control-plane-bundle-store",
      "",
    );
    return JSON.stringify(manifest);
  });
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(options),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_REGISTRATION_DRIFT"),
  );
});

test("[ci] rejects a non-immediate aggregate T11 to M07-T01 edge", async () => {
  const options = await trackedMutation(ROOT_PACKAGE, (text) => {
    const manifest = JSON.parse(text);
    manifest.scripts.check = manifest.scripts.check.replace(
      "pnpm verify:publisher-invalid-source-matrix && pnpm verify:control-plane-bundle-store",
      "pnpm verify:control-plane-bundle-store && pnpm verify:publisher-invalid-source-matrix",
    );
    return JSON.stringify(manifest);
  });
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(options),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_REGISTRATION_DRIFT"),
  );
});

test("[ci] accepts an append-only M07 successor without rewriting frozen T09 evidence", async () => {
  const source = await sourceText(CI_SOURCE);
  const rootPackage = await sourceText(ROOT_PACKAGE);
  const appendedRootPackage = appendValidRootSuccessor(rootPackage);
  const appended = appendValidCiSuccessor(source, appendedRootPackage);
  const result = await buildPublisherBundlePublicationEvidence({
    runtimeReceipt,
    trackedFileBytes: {
      [CI_SOURCE]: Buffer.from(appended.ciSource, "utf8"),
      [ROOT_PACKAGE]: Buffer.from(appendedRootPackage, "utf8"),
    },
  });
  assert.deepEqual(result.artifactBytes, baseline.artifactBytes);
  assert.equal(result.artifactSha256, baseline.artifactSha256);
});

test("[ci] executes byte-identical detached CI bytes through the real default entrypoint", async () => {
  const result = await buildPublisherBundlePublicationEvidence({
    runtimeReceipt,
    trackedFileBytes: {
      [CI_SOURCE]: await sourceBytes(CI_SOURCE),
    },
  });
  assert.deepEqual(result.artifactBytes, baseline.artifactBytes);
  assert.equal(result.artifactSha256, baseline.artifactSha256);
});

test("[ci] rejects a detached real CLI that replaces the validated default plan with zero steps", async () => {
  const options = await trackedMutation(CI_SOURCE, (text) =>
    text.replace("    steps: createQualityGateSteps(),", "    steps: [],"),
  );
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(options),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_CI_DRIFT"),
  );
});

test("[ci] rejects verifier-command drift despite a trusted historical receipt", async () => {
  const options = await trackedMutation(CI_SOURCE, (text) =>
    text.replace(
      'commandStep(`verify-${id}`, `Proof verifier: ${id}`, "node", [verifierFile])',
      'commandStep(`verify-${id}`, `Proof verifier: ${id}`, "pnpm", [verifierFile])',
    ),
  );
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(options),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_CI_RUNTIME_DRIFT"),
  );
});

test("[ci] rejects drift in the independently observed CI plan digest", async () => {
  const options = await trackedMutation(CI_SOURCE, (text) =>
    text.replace(
      /const QUALITY_GATE_PLAN_SHA256 = "[0-9a-f]{64}";/u,
      `const QUALITY_GATE_PLAN_SHA256 = "${"0".repeat(64)}";`,
    ),
  );
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(options),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_CI_RUNTIME_DRIFT"),
  );
});

test("[ci] rejects hosted workflow bypass of the reviewed single-pass entrypoint", async () => {
  const options = await trackedMutation(CI_WORKFLOW, (text) =>
    text.replace(
      "run: node scripts/run-ci-quality-gate.mjs",
      "run: pnpm test:publisher-bundle-publication",
    ),
  );
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(options),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_CI_DRIFT"),
  );
});

test("[ci] admits only the exact required-workflow successor into frozen T09 evidence", async () => {
  const exact = await buildPublisherBundlePublicationEvidence({
    runtimeReceipt,
    ciReceipt,
    trackedFileBytes: {
      [CI_WORKFLOW]: await sourceBytes(CI_WORKFLOW),
    },
  });
  assert.deepEqual(exact.artifactBytes, baseline.artifactBytes);

  const unreviewed = await trackedMutation(CI_WORKFLOW, (text) => `${text}\n# unreviewed drift\n`);
  await assert.rejects(
    verifyWith(unreviewed),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_ARTIFACT_DRIFT"),
  );
});

test("[authority] rejects a runtime receipt with failed revision closure", async () => {
  const receipt = structuredClone(runtimeReceipt);
  receipt.revisionClosed = false;
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(fastOptions({ runtimeReceipt: receipt })),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_RUNTIME_AUTHORITY_INVALID"),
  );
});

test("[authority] rejects a runtime receipt with any failure stage but source-schema", async () => {
  const receipt = structuredClone(runtimeReceipt);
  receipt.failureStage = "source-json";
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(fastOptions({ runtimeReceipt: receipt })),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_RUNTIME_AUTHORITY_INVALID"),
  );
});

test("[authority] rejects duplicate official Bundle keys in the runtime receipt", async () => {
  const receipt = structuredClone(runtimeReceipt);
  receipt.bundleKeys.push(receipt.bundleKeys[0]);
  receipt.bundleKeys.sort();
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(fastOptions({ runtimeReceipt: receipt })),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_RUNTIME_AUTHORITY_INVALID"),
  );
});

test("[authority] rejects omission of the official extensions Bundle key", async () => {
  const receipt = structuredClone(runtimeReceipt);
  receipt.bundleKeys = receipt.bundleKeys.filter((key) => key !== "extensions");
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(fastOptions({ runtimeReceipt: receipt })),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_RUNTIME_AUTHORITY_INVALID"),
  );
});

for (const failureSemantic of [
  "failureDiagnosticsNonEmpty",
  "failureFirstDiagnosticError",
  "failureFirstDiagnosticStageMatchesResult",
]) {
  test(`[authority] rejects false runtime failure semantic ${failureSemantic}`, async () => {
    const receipt = structuredClone(runtimeReceipt);
    receipt[failureSemantic] = false;
    await assert.rejects(
      buildPublisherBundlePublicationEvidence(fastOptions({ runtimeReceipt: receipt })),
      expectCode("PUBLISHER_BUNDLE_PUBLICATION_RUNTIME_AUTHORITY_INVALID"),
    );
  });
}

test("[authority] rejects malformed runtime failure diagnostic authority", async () => {
  const receipt = structuredClone(runtimeReceipt);
  receipt.failureDiagnosticsNonEmpty = "true";
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(fastOptions({ runtimeReceipt: receipt })),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_RUNTIME_AUTHORITY_INVALID"),
  );
});

test("[authority] rejects extra runtime-receipt authority", async () => {
  const receipt = structuredClone(runtimeReceipt);
  receipt.bundle = {};
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(fastOptions({ runtimeReceipt: receipt })),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_RUNTIME_AUTHORITY_INVALID"),
  );
});

test("[authority] controls a revoked Proxy nested in runtime API keys", async () => {
  const revocable = Proxy.revocable([...runtimeReceipt.apiKeys], {});
  revocable.revoke();
  const receipt = { ...runtimeReceipt, apiKeys: revocable.proxy };
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(fastOptions({ runtimeReceipt: receipt })),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_RUNTIME_AUTHORITY_INVALID"),
  );
});

test("[authority] rejects a transparent Proxy nested in runtime success keys", async () => {
  const receipt = {
    ...runtimeReceipt,
    successKeys: new Proxy([...runtimeReceipt.successKeys], {}),
  };
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(fastOptions({ runtimeReceipt: receipt })),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_RUNTIME_AUTHORITY_INVALID"),
  );
});

test("[authority] rejects a nested runtime-key accessor without invoking it", async () => {
  let reads = 0;
  const keys = [...runtimeReceipt.successKeys];
  Object.defineProperty(keys, "0", {
    enumerable: true,
    get() {
      reads += 1;
      return "bundle";
    },
  });
  const receipt = { ...runtimeReceipt, successKeys: keys };
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(fastOptions({ runtimeReceipt: receipt })),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_RUNTIME_AUTHORITY_INVALID"),
  );
  assert.equal(reads, 0);
});

test("[authority] rejects custom-prototype runtime failure keys", async () => {
  const keys = [...runtimeReceipt.failureKeys];
  Object.setPrototypeOf(keys, Object.create(Array.prototype));
  const receipt = { ...runtimeReceipt, failureKeys: keys };
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(fastOptions({ runtimeReceipt: receipt })),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_RUNTIME_AUTHORITY_INVALID"),
  );
});

test("[authority] rejects sparse runtime Bundle keys", async () => {
  const keys = [...runtimeReceipt.bundleKeys];
  delete keys[0];
  const receipt = { ...runtimeReceipt, bundleKeys: keys };
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(fastOptions({ runtimeReceipt: receipt })),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_RUNTIME_AUTHORITY_INVALID"),
  );
});

test("[authority] rejects extra own keys on a nested runtime array", async () => {
  const keys = [...runtimeReceipt.apiKeys];
  keys.extra = "authority";
  const receipt = { ...runtimeReceipt, apiKeys: keys };
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(fastOptions({ runtimeReceipt: receipt })),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_RUNTIME_AUTHORITY_INVALID"),
  );
});

test("[authority] rejects a non-string nested runtime key", async () => {
  const keys = [...runtimeReceipt.bundleKeys];
  keys[0] = 0;
  const receipt = { ...runtimeReceipt, bundleKeys: keys };
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(fastOptions({ runtimeReceipt: receipt })),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_RUNTIME_AUTHORITY_INVALID"),
  );
});

test("[ci] rejects a forged executable CI receipt", async () => {
  const receipt = structuredClone(ciReceipt);
  receipt.stepCount += 1;
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(fastOptions({ ciReceipt: receipt })),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_CI_RUNTIME_DRIFT"),
  );
});

test("[ci] controls a revoked Proxy CI receipt", async () => {
  const revocable = Proxy.revocable({ ...ciReceipt }, {});
  revocable.revoke();
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(fastOptions({ ciReceipt: revocable.proxy })),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_CI_RUNTIME_DRIFT"),
  );
});

test("[ci] rejects a transparent Proxy CI receipt", async () => {
  const receipt = new Proxy({ ...ciReceipt }, {});
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(fastOptions({ ciReceipt: receipt })),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_CI_RUNTIME_DRIFT"),
  );
});

test("[ci] rejects a CI receipt accessor without invoking it", async () => {
  let reads = 0;
  const receipt = { ...ciReceipt };
  Object.defineProperty(receipt, "planSha256", {
    enumerable: true,
    get() {
      reads += 1;
      return ciReceipt.planSha256;
    },
  });
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(fastOptions({ ciReceipt: receipt })),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_CI_RUNTIME_DRIFT"),
  );
  assert.equal(reads, 0);
});

test("[ci] rejects a custom-prototype CI receipt", async () => {
  const receipt = Object.assign(Object.create({}), ciReceipt);
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(fastOptions({ ciReceipt: receipt })),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_CI_RUNTIME_DRIFT"),
  );
});

test("[ci] rejects extra CI receipt authority", async () => {
  const receipt = { ...ciReceipt, steps: [] };
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(fastOptions({ ciReceipt: receipt })),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_CI_RUNTIME_DRIFT"),
  );
});

test("[authority] rejects removal of a T09 traceability owner", async () => {
  const options = await trackedMutation(TRACEABILITY, (text) => {
    const traceability = JSON.parse(text);
    const row = traceability.pipelineSteps.find(({ id }) => id === "PIPE-039");
    row.owners = row.owners.filter((owner) => owner !== "M06-T09");
    return JSON.stringify(traceability);
  });
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(options),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_TRACEABILITY_DRIFT"),
  );
});

test("[authority] rejects a T10 golden claim added to T09 package tests", async () => {
  const options = await trackedMutation(
    RUNTIME_TEST,
    (text) => `${text}\n// frozen official Bundle\n`,
  );
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(options),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_T10_SCOPE_DRIFT"),
  );
});

test("[authority] rejects a root mutation inventory reduced below thirty cases", async () => {
  const options = await trackedMutation(ROOT_TEST, (text) => text.replaceAll("test(", "void("));
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(options),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_TEST_INVENTORY_DRIFT"),
  );
});

test("[compatibility] detects tamper in each externally anchored T02 through T09 reader", async () => {
  const reviewedCurrentPath = "scripts/lib/publisher-execution-preflight-proof.mjs";
  for (const readerPath of PUBLISHER_BUNDLE_PUBLICATION_COMPATIBILITY_READERS) {
    const bytes = Buffer.from(await sourceBytes(readerPath));
    bytes[bytes.length - 1] ^= 1;
    await assert.rejects(
      verifyPublisherBundlePublicationEvidence(
        fastOptions({
          artifactBytes: baseline.artifactBytes,
          proofDocument: pinnedProof,
          trackedFileBytes: { [readerPath]: bytes },
        }),
      ),
      expectCode(
        readerPath === reviewedCurrentPath
          ? "PUBLISHER_BUNDLE_PUBLICATION_COMPATIBILITY_DRIFT"
          : "PUBLISHER_BUNDLE_PUBLICATION_ARTIFACT_DRIFT",
      ),
      readerPath,
    );
  }

  const reviewedCurrentBytes = await sourceBytes(reviewedCurrentPath);
  assert.equal(reviewedCurrentBytes.byteLength, 72_334);
  assert.equal(
    createHash("sha256").update(reviewedCurrentBytes).digest("hex"),
    "9d1b048513ac4cc0170dae2cc61c5e0befd3ed5c0d4c764e0f5f0199a6a39fea",
  );
  const predecessorM07T08Bytes = applyExactRollbackPatch(
    reviewedCurrentBytes,
    M07_T09_EXECUTION_PREFLIGHT_PROOF_ROLLBACK_PATCH,
  );
  assert.equal(predecessorM07T08Bytes.byteLength, 72_025);
  assert.equal(
    createHash("sha256").update(predecessorM07T08Bytes).digest("hex"),
    "b4d55e0da2a2992bcc311254bfc47c2c69287f9e049ed8e84bb9b50c8886d2a4",
  );
  const approved = await buildPublisherBundlePublicationEvidence(
    fastOptions({
      trackedFileBytes: { [reviewedCurrentPath]: reviewedCurrentBytes },
    }),
  );
  assert.deepEqual(approved.artifactBytes, baseline.artifactBytes);
  assert.equal(approved.artifactSha256, baseline.artifactSha256);

  const unreviewedCurrentBytes = Buffer.concat([
    reviewedCurrentBytes,
    Buffer.from("\n// unreviewed compatibility successor\n"),
  ]);
  const reviewedCurrentSha256 = createHash("sha256").update(reviewedCurrentBytes).digest("hex");
  const unreviewedCurrentSha256 = createHash("sha256").update(unreviewedCurrentBytes).digest("hex");
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(
      fastOptions({
        trackedFileBytes: { [reviewedCurrentPath]: unreviewedCurrentBytes },
      }),
    ),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_COMPATIBILITY_DRIFT"),
  );
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(
      fastOptions({
        trackedFileBytes: { [reviewedCurrentPath]: predecessorM07T08Bytes },
      }),
    ),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_COMPATIBILITY_DRIFT"),
  );

  const originalObjectFreeze = Object.freeze;
  try {
    Object.freeze = (value) => {
      if (
        value?.overridden === true &&
        value.bytes instanceof Uint8Array &&
        value.bytes.byteLength === unreviewedCurrentBytes.byteLength &&
        createHash("sha256").update(value.bytes).digest("hex") === unreviewedCurrentSha256
      ) {
        return originalObjectFreeze({
          bytes: reviewedCurrentBytes,
          overridden: true,
        });
      }
      if (
        value?.bytes === unreviewedCurrentBytes.byteLength &&
        value?.sha256 === unreviewedCurrentSha256
      ) {
        return originalObjectFreeze({
          bytes: reviewedCurrentBytes.byteLength,
          sha256: reviewedCurrentSha256,
        });
      }
      return originalObjectFreeze(value);
    };
    await assert.rejects(
      buildPublisherBundlePublicationEvidence(
        fastOptions({
          trackedFileBytes: { [reviewedCurrentPath]: unreviewedCurrentBytes },
        }),
      ),
      expectCode("PUBLISHER_BUNDLE_PUBLICATION_COMPATIBILITY_DRIFT"),
    );
  } finally {
    Object.freeze = originalObjectFreeze;
  }

  const originalObjectEntries = Object.entries;
  try {
    Object.entries = (value) => {
      const entries = originalObjectEntries(value);
      if (Object.isFrozen(value) && entries.length === 1 && entries[0][0] === reviewedCurrentPath) {
        return [
          [
            reviewedCurrentPath,
            {
              bytes: unreviewedCurrentBytes.byteLength,
              sha256: unreviewedCurrentSha256,
            },
          ],
        ];
      }
      return entries;
    };
    await assert.rejects(
      buildPublisherBundlePublicationEvidence(
        fastOptions({
          trackedFileBytes: { [reviewedCurrentPath]: unreviewedCurrentBytes },
        }),
      ),
      expectCode("PUBLISHER_BUNDLE_PUBLICATION_COMPATIBILITY_DRIFT"),
    );
  } finally {
    Object.entries = originalObjectEntries;
  }

  const originalArrayFilter = Array.prototype.filter;
  try {
    Array.prototype.filter = function (predicate, thisArgument) {
      let isTrackedPairInventory = false;
      for (let index = 0; index < this.length; index += 1) {
        if (this[index]?.relativePath === reviewedCurrentPath) {
          isTrackedPairInventory = true;
          break;
        }
      }
      if (isTrackedPairInventory) {
        return [
          {
            relativePath: reviewedCurrentPath,
            bytes: reviewedCurrentBytes,
            overridden: true,
          },
        ];
      }
      return Reflect.apply(originalArrayFilter, this, [predicate, thisArgument]);
    };
    await assert.rejects(
      buildPublisherBundlePublicationEvidence(
        fastOptions({
          trackedFileBytes: { [reviewedCurrentPath]: unreviewedCurrentBytes },
        }),
      ),
      expectCode("PUBLISHER_BUNDLE_PUBLICATION_COMPATIBILITY_DRIFT"),
    );
  } finally {
    Array.prototype.filter = originalArrayFilter;
  }
});

test("[compatibility] admits only the exact current execution-preflight root reader", async () => {
  const readerPath = "tests/publisher-execution-preflight.test.mjs";
  const currentBytes = await sourceBytes(readerPath);
  assert.equal(currentBytes.byteLength, 24_873);
  assert.equal(
    createHash("sha256").update(currentBytes).digest("hex"),
    "5e0e7c2d7362f7a83996ef953ac45c0e4f249f844cc5b64de48a961df12553b1",
  );
  const predecessorM07T08Bytes = applyExactRollbackPatch(
    currentBytes,
    M07_T09_EXECUTION_PREFLIGHT_ROOT_TEST_ROLLBACK_PATCH,
  );
  assert.equal(predecessorM07T08Bytes.byteLength, 17_767);
  assert.equal(
    createHash("sha256").update(predecessorM07T08Bytes).digest("hex"),
    "8ab35ee609d175377ccb2beb679f6d76f93c9c2cf4bc749df0d94a7ff7e47e74",
  );

  const approved = await buildPublisherBundlePublicationEvidence(
    fastOptions({ trackedFileBytes: { [readerPath]: currentBytes } }),
  );
  assert.deepEqual(approved.artifactBytes, baseline.artifactBytes);
  assert.equal(approved.artifactSha256, baseline.artifactSha256);

  const unreviewedBytes = Buffer.concat([
    currentBytes,
    Buffer.from("\n// unreviewed execution-preflight root successor\n"),
  ]);
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(
      fastOptions({ trackedFileBytes: { [readerPath]: unreviewedBytes } }),
    ),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_COMPATIBILITY_DRIFT"),
  );
  await assert.rejects(
    buildPublisherBundlePublicationEvidence(
      fastOptions({ trackedFileBytes: { [readerPath]: predecessorM07T08Bytes } }),
    ),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_COMPATIBILITY_DRIFT"),
  );
});

for (const authorityPath of PUBLISHER_BUNDLE_PUBLICATION_RESULT_AUTHORITY_FILES) {
  test(`[api] detects one-byte drift in public result authority ${authorityPath}`, async () => {
    const bytes = await sourceBytes(authorityPath);
    const mutated = Buffer.concat([bytes, Buffer.from(" ")]);
    await assert.rejects(
      verifyPublisherBundlePublicationEvidence(
        fastOptions({
          artifactBytes: baseline.artifactBytes,
          proofDocument: pinnedProof,
          trackedFileBytes: { [authorityPath]: mutated },
        }),
      ),
      expectCode("PUBLISHER_BUNDLE_PUBLICATION_ARTIFACT_DRIFT"),
    );
  });
}

test("[options] rejects simultaneous artifact byte and path authority", async () => {
  await assert.rejects(
    verifyPublisherBundlePublicationEvidence(
      fastOptions({
        artifactBytes: baseline.artifactBytes,
        artifactPath: "/tmp/not-read.json",
        proofDocument: pinnedProof,
      }),
    ),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_OPTIONS_INVALID"),
  );
});

test("[options] rejects simultaneous proof text and path authority", async () => {
  await assert.rejects(
    verifyPublisherBundlePublicationEvidence(
      fastOptions({
        artifactBytes: baseline.artifactBytes,
        proofDocument: pinnedProof,
        proofDocumentPath: "/tmp/not-read.md",
      }),
    ),
    expectCode("PUBLISHER_BUNDLE_PUBLICATION_OPTIONS_INVALID"),
  );
});

test("[writer] atomically writes exact official evidence bytes", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-t09-writer-"));
  const artifactPath = path.join(directory, "artifact.json");
  try {
    const result = await writePublisherBundlePublicationEvidence({ artifactPath });
    assert.equal(result.artifactSha256, baseline.artifactSha256);
    assert.deepEqual(await readFile(artifactPath), baseline.artifactBytes);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("[writer] preserves the old destination and removes a tampered temporary", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-t09-writer-tamper-"));
  const artifactPath = path.join(directory, "artifact.json");
  const oldBytes = Buffer.from("old artifact\n");
  await writeFile(artifactPath, oldBytes);
  try {
    await assert.rejects(
      writePublisherBundlePublicationEvidence({
        artifactPath,
        beforeAtomicRename: async ({ temporaryPath }) => {
          await writeFile(temporaryPath, "tampered temporary\n");
        },
      }),
      TypeError,
    );
    assert.deepEqual(await readFile(artifactPath), oldBytes);
    assert.deepEqual(
      (await readdir(directory)).filter((entry) => entry.endsWith(".tmp")),
      [],
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("[symlink] rejects an atomic-writer destination symlink", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-t09-writer-link-"));
  const target = path.join(directory, "target.json");
  const artifactPath = path.join(directory, "artifact.json");
  await writeFile(target, "target\n");
  await symlink(target, artifactPath);
  try {
    await assert.rejects(writePublisherBundlePublicationEvidence({ artifactPath }), TypeError);
    assert.equal(await readFile(target, "utf8"), "target\n");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("[symlink] rejects a verifier artifact symlink through the no-follow reader", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-t09-artifact-link-"));
  const target = path.join(directory, "target.json");
  const artifactPath = path.join(directory, "artifact.json");
  await writeFile(target, baseline.artifactBytes);
  await symlink(target, artifactPath);
  try {
    await assert.rejects(
      verifyPublisherBundlePublicationEvidence(
        fastOptions({ artifactPath, proofDocument: pinnedProof }),
      ),
      expectCode("PUBLISHER_BUNDLE_PUBLICATION_ARTIFACT_DRIFT"),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("[symlink] rejects a proof-document symlink through the no-follow reader", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-t09-proof-link-"));
  const target = path.join(directory, "target.md");
  const proofDocumentPath = path.join(directory, "proof.md");
  await writeFile(target, pinnedProof);
  await symlink(target, proofDocumentPath);
  try {
    await assert.rejects(
      verifyPublisherBundlePublicationEvidence(
        fastOptions({ artifactBytes: baseline.artifactBytes, proofDocumentPath }),
      ),
      expectCode("PUBLISHER_BUNDLE_PUBLICATION_PROOF_DOCUMENT_DRIFT"),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("[authority] fatally rejects invalid UTF-8 in a proof-document file", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-t09-proof-utf8-"));
  const proofDocumentPath = path.join(directory, "proof.md");
  await writeFile(proofDocumentPath, Uint8Array.of(0xc3, 0x28));
  try {
    await assert.rejects(
      verifyPublisherBundlePublicationEvidence(
        fastOptions({ artifactBytes: baseline.artifactBytes, proofDocumentPath }),
      ),
      expectCode("PUBLISHER_BUNDLE_PUBLICATION_PROOF_DOCUMENT_DRIFT"),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("[writer] rejects semantic overrides on the official write path", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-t09-writer-override-"));
  try {
    await assert.rejects(
      writePublisherBundlePublicationEvidence({
        artifactPath: path.join(directory, "artifact.json"),
        runtimeReceipt,
      }),
      expectCode("PUBLISHER_BUNDLE_PUBLICATION_OFFICIAL_WRITE_OVERRIDE"),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
