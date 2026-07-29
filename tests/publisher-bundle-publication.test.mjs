import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  PUBLISHER_BUNDLE_PUBLICATION_COMPATIBILITY_READERS,
  PUBLISHER_BUNDLE_PUBLICATION_PREREQUISITE_PINS,
  PUBLISHER_BUNDLE_PUBLICATION_RESULT_AUTHORITY_FILES,
  PublisherBundlePublicationEvidenceError,
  buildPublisherBundlePublicationEvidence,
  verifyPublisherBundlePublicationEvidence,
  writePublisherBundlePublicationEvidence,
} from "../scripts/lib/publisher-bundle-publication-proof.mjs";

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

test("[compatibility] externally tracks every current T02 through T08 proof reader", () => {
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

test("[compatibility] detects tamper in each externally anchored T02 through T08 reader", async () => {
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
      expectCode("PUBLISHER_BUNDLE_PUBLICATION_ARTIFACT_DRIFT"),
      readerPath,
    );
  }
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
