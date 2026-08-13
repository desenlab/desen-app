import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  PUBLISHER_OFFICIAL_GOLDEN_FROZEN_INPUTS,
  PUBLISHER_OFFICIAL_GOLDEN_PREREQUISITE_PINS,
  PublisherOfficialGoldenEvidenceError,
  buildPublisherOfficialGoldenEvidence,
  verifyPublisherOfficialGoldenEvidence,
  writePublisherOfficialGoldenEvidence,
} from "../scripts/lib/publisher-official-golden-proof.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const ARTIFACT = "docs/proof/artifacts/publisher-0.1.0-official-golden.json";
const SOURCE = "packages/protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json";
const CATALOG = "packages/protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json";
const BUNDLE = "packages/protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.bundle.json";
const VECTORS = "packages/protocol/upstream/0.1.0/snapshot/conformance/vectors.json";
const PUBLISHER_INDEX = "packages/publisher/dist/index.js";
const PUBLISHER_TEST = "packages/publisher/test/official-golden.test.ts";
const ROOT_PACKAGE = "package.json";
const PUBLISHER_PACKAGE = "packages/publisher/package.json";
const CI_SOURCE = "scripts/run-ci-quality-gate.mjs";
const CI_WORKFLOW = ".github/workflows/ci.yml";
const PROOF_LIBRARY = "scripts/lib/publisher-official-golden-proof.mjs";
const ROOT_TEST = "tests/publisher-official-golden.test.mjs";
const EXPECTED_REVISION = "sha256:43eef0f11f9bcc4c13fc1eb5691ee974859001fbb4aeee8051948e7c8e195601";
const EXPECTED_SOURCE_DIGEST =
  "sha256:40c294047299b521a46b51d8a72bfbeeaad8a69a9b9045a306139830b7674878";
const EXPECTED_CANONICAL_SHA256 =
  "fac0ee3d559528af2f4274cdfb21979463cbadd419f2faba584263cc8b4c0247";

const baseline = await buildPublisherOfficialGoldenEvidence();
const runtimeReceipt = baseline.runtimeReceipt;
const pinnedProof = [
  "# Test-only final T10 pin",
  "",
  `\`${ARTIFACT}\``,
  "",
  `\`sha256:${baseline.artifactSha256}\``,
  "",
].join("\n");

function expectCode(code) {
  return (error) => {
    assert.equal(error instanceof PublisherOfficialGoldenEvidenceError, true);
    assert.equal(error.code, code);
    return true;
  };
}

function fastOptions(additions = {}) {
  return {
    runtimeReceipt,
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
  return verifyPublisherOfficialGoldenEvidence(
    fastOptions({
      artifactBytes: baseline.artifactBytes,
      proofDocument: pinnedProof,
      ...additions,
    }),
  );
}

function mutateBase64(value) {
  const bytes = Buffer.from(value, "base64");
  bytes[0] ^= 1;
  return bytes.toString("base64");
}

function deeplyFrozen(root) {
  const pending = [root];
  const seen = new Set();
  while (pending.length > 0) {
    const value = pending.pop();
    if (typeof value !== "object" || value === null || seen.has(value)) continue;
    seen.add(value);
    if (!Object.isFrozen(value)) return false;
    for (const key of Reflect.ownKeys(value)) {
      if (Array.isArray(value) && key === "length") continue;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor !== undefined && "value" in descriptor) pending.push(descriptor.value);
    }
  }
  return true;
}

test("[authority] builds the exact versioned M06-T10 profile", () => {
  assert.equal(baseline.artifact.schemaVersion, 1);
  assert.equal(baseline.artifact.profile, "desen.publisher.official-golden-proof.v1");
  assert.equal(baseline.artifact.task, "M06-T10");
  assert.equal(baseline.artifact.result, "PASS");
  assert.equal(baseline.artifact.summary.length > 0, true);
});

test("[authority] pins exactly T09, snapshot, canonicalization, and official-suite parity", () => {
  assert.deepEqual(
    PUBLISHER_OFFICIAL_GOLDEN_PREREQUISITE_PINS.map(({ task }) => task),
    ["M06-T09", "M02-T01", "M02-T04", "M02-T12"],
  );
  assert.deepEqual(
    baseline.artifact.prerequisites.map(({ task }) => task),
    ["M06-T09", "M02-T01", "M02-T04", "M02-T12"],
  );
  assert.equal(
    baseline.artifact.prerequisites[0].sha256,
    "2942aa84066354ee7c27557263a900eb8fd3a149d085ab55c7f880dcfca998df",
  );
});

test("[authority] authenticates the four exact frozen official inputs", () => {
  assert.deepEqual(
    baseline.artifact.claims.frozenOfficialInputs.map(({ role, path, sha256 }) => ({
      role,
      path,
      sha256,
    })),
    PUBLISHER_OFFICIAL_GOLDEN_FROZEN_INPUTS,
  );
  assert.deepEqual(
    baseline.artifact.claims.frozenOfficialInputs.map(({ path: inputPath }) => inputPath),
    [SOURCE, CATALOG, BUNDLE, VECTORS],
  );
});

test("[golden] records the exact canonical official Bundle constants", () => {
  const claim = baseline.artifact.claims.publicDoublePublication;
  assert.equal(claim.firstPublication.canonicalBytes, 2_173);
  assert.equal(claim.firstPublication.canonicalSha256, EXPECTED_CANONICAL_SHA256);
  assert.equal(claim.firstPublication.revision, EXPECTED_REVISION);
  assert.equal(claim.firstPublication.sourceDigest, EXPECTED_SOURCE_DIGEST);
  assert.deepEqual(claim.officialBundleWithoutRootPublication.removedRootKeys, ["publication"]);
});

test("[determinism] records two fresh public calls with three-way exact equality", () => {
  const claim = baseline.artifact.claims.publicDoublePublication;
  assert.equal(claim.publicOperation, "publishDesenSource");
  assert.equal(claim.freshPublicationInvocations, 2);
  assert.equal(claim.freshCatalogGraphs, 2);
  assert.equal(claim.freshCandidateGraphs, 2);
  assert.equal(claim.freshResultGraphs, 2);
  assert.deepEqual(claim.comparisons, {
    firstEqualsSecondCanonicalBytes: true,
    firstEqualsOfficialCanonicalBytes: true,
    secondEqualsOfficialCanonicalBytes: true,
    revisionsExactAcrossAllThree: true,
    sourceDigestsExactAcrossAllThree: true,
  });
});

test("[tests] authenticates the exact six-case focused Publisher golden suite", () => {
  assert.equal(baseline.artifact.tests.publisherRuntimeCases, 6);
  assert.equal(baseline.artifact.tests.rootMutationCases >= 25, true);
});

test("[registration] authenticates package, root, aggregate, and single-pass CI wiring", () => {
  const registrations = baseline.artifact.claims.registrations;
  assert.equal(registrations.package, "vitest run test/official-golden.test.ts");
  assert.equal(registrations.aggregateImmediatePredecessor, "publisher-bundle-publication");
  assert.equal(registrations.ci.id, "publisher-official-golden");
  assert.equal(registrations.ci.tupleExact, true);
  assert.equal(registrations.hostedWorkflowSinglePass, true);
});

test("[scope] retains honest T11 and non-runtime nonclaims", () => {
  assert.equal(Array.isArray(baseline.artifact.nonclaims), true);
  assert.equal(baseline.artifact.nonclaims.length, 3);
  assert.equal(
    baseline.artifact.nonclaims.some((claim) => claim.includes("M06-T11")),
    true,
  );
  assert.equal(
    baseline.artifact.nonclaims.some((claim) => claim.includes("activation")),
    true,
  );
});

test("[immutability] returns a recursively frozen evidence graph and receipt", () => {
  assert.equal(deeplyFrozen(baseline.artifact), true);
  assert.equal(deeplyFrozen(baseline.runtimeReceipt), true);
});

test("[authority] verifies fresh in-memory artifact bytes and one exact proof pin", async () => {
  const result = await verifyWith();
  assert.equal(result.result, "PASS");
  assert.equal(result.artifactSha256, baseline.artifactSha256);
  assert.equal(result.publicationInvocations, 2);
  assert.equal(result.canonicalBytes, 2_173);
});

test("[authority] accepts an exact plain Uint8Array artifact override", async () => {
  const result = await verifyPublisherOfficialGoldenEvidence(
    fastOptions({
      artifactBytes: new Uint8Array(baseline.artifactBytes),
      proofDocument: pinnedProof,
    }),
  );
  assert.equal(result.result, "PASS");
});

test("[authority] rejects one changed artifact byte", async () => {
  const bytes = Buffer.from(baseline.artifactBytes);
  bytes[bytes.length - 2] ^= 1;
  await assert.rejects(
    verifyPublisherOfficialGoldenEvidence(
      fastOptions({ artifactBytes: bytes, proofDocument: pinnedProof }),
    ),
    expectCode("PUBLISHER_OFFICIAL_GOLDEN_ARTIFACT_DRIFT"),
  );
});

test("[proof] rejects a PENDING proof-document pin", async () => {
  await assert.rejects(
    verifyPublisherOfficialGoldenEvidence(
      fastOptions({
        artifactBytes: baseline.artifactBytes,
        proofDocument: `\`${ARTIFACT}\`\n\n\`sha256:PENDING\``,
      }),
    ),
    expectCode("PUBLISHER_OFFICIAL_GOLDEN_PROOF_DOCUMENT_DRIFT"),
  );
});

test("[proof] rejects the wrong proof-document hash", async () => {
  await assert.rejects(
    verifyPublisherOfficialGoldenEvidence(
      fastOptions({
        artifactBytes: baseline.artifactBytes,
        proofDocument: `\`${ARTIFACT}\`\n\n\`sha256:${"0".repeat(64)}\``,
      }),
    ),
    expectCode("PUBLISHER_OFFICIAL_GOLDEN_PROOF_DOCUMENT_DRIFT"),
  );
});

test("[proof] rejects a duplicate artifact-path authority", async () => {
  await assert.rejects(
    verifyPublisherOfficialGoldenEvidence(
      fastOptions({
        artifactBytes: baseline.artifactBytes,
        proofDocument: `${pinnedProof}\n\`${ARTIFACT}\`\n`,
      }),
    ),
    expectCode("PUBLISHER_OFFICIAL_GOLDEN_PROOF_DOCUMENT_DRIFT"),
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
    buildPublisherOfficialGoldenEvidence(options),
    expectCode("PUBLISHER_OFFICIAL_GOLDEN_OPTIONS_INVALID"),
  );
  assert.equal(reads, 0);
});

test("[options] rejects inherited option authority", async () => {
  await assert.rejects(
    buildPublisherOfficialGoldenEvidence(Object.create({ runtimeReceipt })),
    expectCode("PUBLISHER_OFFICIAL_GOLDEN_OPTIONS_INVALID"),
  );
});

test("[options] rejects an unknown own option", async () => {
  await assert.rejects(
    buildPublisherOfficialGoldenEvidence({ unexpected: true }),
    expectCode("PUBLISHER_OFFICIAL_GOLDEN_OPTIONS_INVALID"),
  );
});

test("[options] rejects symbol option authority", async () => {
  await assert.rejects(
    buildPublisherOfficialGoldenEvidence({ [Symbol("authority")]: true }),
    expectCode("PUBLISHER_OFFICIAL_GOLDEN_OPTIONS_INVALID"),
  );
});

test("[options] rejects a transparent Proxy options record without invoking traps", async () => {
  let traps = 0;
  const options = new Proxy(
    { runtimeReceipt },
    {
      get() {
        traps += 1;
        throw new TypeError("option trap");
      },
      getOwnPropertyDescriptor() {
        traps += 1;
        throw new TypeError("option trap");
      },
      getPrototypeOf() {
        traps += 1;
        throw new TypeError("option trap");
      },
      ownKeys() {
        traps += 1;
        throw new TypeError("option trap");
      },
    },
  );
  await assert.rejects(
    buildPublisherOfficialGoldenEvidence(options),
    expectCode("PUBLISHER_OFFICIAL_GOLDEN_OPTIONS_INVALID"),
  );
  assert.equal(traps, 0);
});

test("[options] the builder rejects verifier-only artifact authority", async () => {
  await assert.rejects(
    buildPublisherOfficialGoldenEvidence({
      runtimeReceipt,
      artifactBytes: baseline.artifactBytes,
    }),
    expectCode("PUBLISHER_OFFICIAL_GOLDEN_OPTIONS_INVALID"),
  );
});

test("[options] the verifier rejects writer-only hook authority", async () => {
  let calls = 0;
  await assert.rejects(
    verifyPublisherOfficialGoldenEvidence({
      runtimeReceipt,
      artifactBytes: baseline.artifactBytes,
      proofDocument: pinnedProof,
      beforeAtomicRename() {
        calls += 1;
      },
    }),
    expectCode("PUBLISHER_OFFICIAL_GOLDEN_OPTIONS_INVALID"),
  );
  assert.equal(calls, 0);
});

test("[options] rejects an accessor in the tracked-byte override map", async () => {
  let reads = 0;
  const map = {};
  Object.defineProperty(map, PROOF_LIBRARY, {
    enumerable: true,
    get() {
      reads += 1;
      return Buffer.from("not observed");
    },
  });
  await assert.rejects(
    buildPublisherOfficialGoldenEvidence(fastOptions({ trackedFileBytes: map })),
    expectCode("PUBLISHER_OFFICIAL_GOLDEN_OPTIONS_INVALID"),
  );
  assert.equal(reads, 0);
});

test("[options] rejects non-byte tracked override authority", async () => {
  await assert.rejects(
    buildPublisherOfficialGoldenEvidence(
      fastOptions({ trackedFileBytes: { [PROOF_LIBRARY]: "not bytes" } }),
    ),
    expectCode("PUBLISHER_OFFICIAL_GOLDEN_OPTIONS_INVALID"),
  );
});

test("[options] rejects a transparent Proxy tracked byte without invoking traps", async () => {
  let traps = 0;
  const bytes = new Proxy(Buffer.from(await sourceBytes(PROOF_LIBRARY)), {
    get() {
      traps += 1;
      throw new TypeError("byte trap");
    },
    getOwnPropertyDescriptor() {
      traps += 1;
      throw new TypeError("byte trap");
    },
    getPrototypeOf() {
      traps += 1;
      throw new TypeError("byte trap");
    },
    ownKeys() {
      traps += 1;
      throw new TypeError("byte trap");
    },
  });
  await assert.rejects(
    buildPublisherOfficialGoldenEvidence(
      fastOptions({ trackedFileBytes: { [PROOF_LIBRARY]: bytes } }),
    ),
    expectCode("PUBLISHER_OFFICIAL_GOLDEN_OPTIONS_INVALID"),
  );
  assert.equal(traps, 0);
});

test("[options] rejects a Uint8Array subclass as artifact authority", async () => {
  class ArtifactBytes extends Uint8Array {}
  await assert.rejects(
    verifyPublisherOfficialGoldenEvidence(
      fastOptions({
        artifactBytes: new ArtifactBytes(baseline.artifactBytes),
        proofDocument: pinnedProof,
      }),
    ),
    expectCode("PUBLISHER_OFFICIAL_GOLDEN_OPTIONS_INVALID"),
  );
});

test("[options] controls a revoked Proxy prerequisite byte authority", async () => {
  const [{ path: prerequisitePath }] = PUBLISHER_OFFICIAL_GOLDEN_PREREQUISITE_PINS;
  const revocable = Proxy.revocable(Buffer.from(await sourceBytes(prerequisitePath)), {});
  revocable.revoke();
  await assert.rejects(
    buildPublisherOfficialGoldenEvidence(
      fastOptions({ prerequisiteBytes: { [prerequisitePath]: revocable.proxy } }),
    ),
    expectCode("PUBLISHER_OFFICIAL_GOLDEN_OPTIONS_INVALID"),
  );
});

test("[options] rejects custom-prototype tracked bytes", async () => {
  const bytes = new Uint8Array(await sourceBytes(PROOF_LIBRARY));
  Object.setPrototypeOf(bytes, {});
  await assert.rejects(
    buildPublisherOfficialGoldenEvidence(
      fastOptions({ trackedFileBytes: { [PROOF_LIBRARY]: bytes } }),
    ),
    expectCode("PUBLISHER_OFFICIAL_GOLDEN_OPTIONS_INVALID"),
  );
});

test("[authority] fatally rejects invalid UTF-8 in a tracked proof file", async () => {
  await assert.rejects(
    buildPublisherOfficialGoldenEvidence(
      fastOptions({ trackedFileBytes: { [ROOT_TEST]: Uint8Array.of(0xc3, 0x28) } }),
    ),
    expectCode("PUBLISHER_OFFICIAL_GOLDEN_UTF8_INVALID"),
  );
});

test("[prerequisite] rejects exact drift in every direct prerequisite", async () => {
  for (const { path: prerequisitePath } of PUBLISHER_OFFICIAL_GOLDEN_PREREQUISITE_PINS) {
    const bytes = Buffer.from(await sourceBytes(prerequisitePath));
    bytes[0] ^= 1;
    await assert.rejects(
      buildPublisherOfficialGoldenEvidence(
        fastOptions({ prerequisiteBytes: { [prerequisitePath]: bytes } }),
      ),
      expectCode("PUBLISHER_OFFICIAL_GOLDEN_PREREQUISITE_DRIFT"),
      prerequisitePath,
    );
  }
});

test("[fixture] rejects one changed byte in every frozen official input", async () => {
  for (const { path: inputPath } of PUBLISHER_OFFICIAL_GOLDEN_FROZEN_INPUTS) {
    const bytes = Buffer.from(await sourceBytes(inputPath));
    bytes[0] ^= 1;
    await assert.rejects(
      buildPublisherOfficialGoldenEvidence(
        fastOptions({ trackedFileBytes: { [inputPath]: bytes } }),
      ),
      expectCode("PUBLISHER_OFFICIAL_GOLDEN_FIXTURE_DRIFT"),
      inputPath,
    );
  }
});

test("[runtime] rejects a changed first canonical byte output", async () => {
  const receipt = structuredClone(runtimeReceipt);
  receipt.canonicalBase64A = mutateBase64(receipt.canonicalBase64A);
  await assert.rejects(
    buildPublisherOfficialGoldenEvidence(fastOptions({ runtimeReceipt: receipt })),
    expectCode("PUBLISHER_OFFICIAL_GOLDEN_RUNTIME_AUTHORITY_INVALID"),
  );
});

test("[runtime] rejects a changed second canonical byte output", async () => {
  const receipt = structuredClone(runtimeReceipt);
  receipt.canonicalBase64B = mutateBase64(receipt.canonicalBase64B);
  await assert.rejects(
    buildPublisherOfficialGoldenEvidence(fastOptions({ runtimeReceipt: receipt })),
    expectCode("PUBLISHER_OFFICIAL_GOLDEN_RUNTIME_AUTHORITY_INVALID"),
  );
});

test("[runtime] rejects a changed official canonical byte output", async () => {
  const receipt = structuredClone(runtimeReceipt);
  receipt.canonicalBase64Official = mutateBase64(receipt.canonicalBase64Official);
  await assert.rejects(
    buildPublisherOfficialGoldenEvidence(fastOptions({ runtimeReceipt: receipt })),
    expectCode("PUBLISHER_OFFICIAL_GOLDEN_RUNTIME_AUTHORITY_INVALID"),
  );
});

test("[runtime] rejects malformed canonical base64", async () => {
  const receipt = structuredClone(runtimeReceipt);
  receipt.canonicalBase64A = "not canonical base64";
  await assert.rejects(
    buildPublisherOfficialGoldenEvidence(fastOptions({ runtimeReceipt: receipt })),
    expectCode("PUBLISHER_OFFICIAL_GOLDEN_RUNTIME_AUTHORITY_INVALID"),
  );
});

test("[runtime] rejects a changed first revision", async () => {
  const receipt = structuredClone(runtimeReceipt);
  receipt.revisionA = `sha256:${"0".repeat(64)}`;
  await assert.rejects(
    buildPublisherOfficialGoldenEvidence(fastOptions({ runtimeReceipt: receipt })),
    expectCode("PUBLISHER_OFFICIAL_GOLDEN_RUNTIME_AUTHORITY_INVALID"),
  );
});

test("[runtime] rejects a changed second source digest", async () => {
  const receipt = structuredClone(runtimeReceipt);
  receipt.sourceDigestB = `sha256:${"0".repeat(64)}`;
  await assert.rejects(
    buildPublisherOfficialGoldenEvidence(fastOptions({ runtimeReceipt: receipt })),
    expectCode("PUBLISHER_OFFICIAL_GOLDEN_RUNTIME_AUTHORITY_INVALID"),
  );
});

test("[runtime] rejects any invocation count but exactly two", async () => {
  const receipt = structuredClone(runtimeReceipt);
  receipt.invocations = 1;
  await assert.rejects(
    buildPublisherOfficialGoldenEvidence(fastOptions({ runtimeReceipt: receipt })),
    expectCode("PUBLISHER_OFFICIAL_GOLDEN_RUNTIME_AUTHORITY_INVALID"),
  );
});

test("[runtime] rejects any removed official root key beyond publication", async () => {
  const receipt = structuredClone(runtimeReceipt);
  receipt.officialRemovedRootKeys.push("revision");
  receipt.officialRemovedRootKeys.sort();
  await assert.rejects(
    buildPublisherOfficialGoldenEvidence(fastOptions({ runtimeReceipt: receipt })),
    expectCode("PUBLISHER_OFFICIAL_GOLDEN_RUNTIME_AUTHORITY_INVALID"),
  );
});

test("[runtime] rejects retained publication metadata in either output", async () => {
  const receipt = structuredClone(runtimeReceipt);
  receipt.publicationAbsentBoth = false;
  await assert.rejects(
    buildPublisherOfficialGoldenEvidence(fastOptions({ runtimeReceipt: receipt })),
    expectCode("PUBLISHER_OFFICIAL_GOLDEN_RUNTIME_AUTHORITY_INVALID"),
  );
});

test("[runtime] rejects shared fresh input identities", async () => {
  const receipt = structuredClone(runtimeReceipt);
  receipt.candidateGraphsFresh = false;
  await assert.rejects(
    buildPublisherOfficialGoldenEvidence(fastOptions({ runtimeReceipt: receipt })),
    expectCode("PUBLISHER_OFFICIAL_GOLDEN_RUNTIME_AUTHORITY_INVALID"),
  );
});

test("[runtime] rejects shared publication result graphs", async () => {
  const receipt = structuredClone(runtimeReceipt);
  receipt.resultGraphsFresh = false;
  await assert.rejects(
    buildPublisherOfficialGoldenEvidence(fastOptions({ runtimeReceipt: receipt })),
    expectCode("PUBLISHER_OFFICIAL_GOLDEN_RUNTIME_AUTHORITY_INVALID"),
  );
});

test("[runtime] rejects shared input-output graphs", async () => {
  const receipt = structuredClone(runtimeReceipt);
  receipt.inputOutputGraphsDisjoint = false;
  await assert.rejects(
    buildPublisherOfficialGoldenEvidence(fastOptions({ runtimeReceipt: receipt })),
    expectCode("PUBLISHER_OFFICIAL_GOLDEN_RUNTIME_AUTHORITY_INVALID"),
  );
});

test("[runtime] rejects nonempty public success diagnostics", async () => {
  const receipt = structuredClone(runtimeReceipt);
  receipt.diagnosticsEmptyBoth = false;
  await assert.rejects(
    buildPublisherOfficialGoldenEvidence(fastOptions({ runtimeReceipt: receipt })),
    expectCode("PUBLISHER_OFFICIAL_GOLDEN_RUNTIME_AUTHORITY_INVALID"),
  );
});

test("[runtime] rejects duplicate terminal Bundle keys", async () => {
  const receipt = structuredClone(runtimeReceipt);
  receipt.bundleKeysA.push(receipt.bundleKeysA[0]);
  receipt.bundleKeysA.sort();
  await assert.rejects(
    buildPublisherOfficialGoldenEvidence(fastOptions({ runtimeReceipt: receipt })),
    expectCode("PUBLISHER_OFFICIAL_GOLDEN_RUNTIME_AUTHORITY_INVALID"),
  );
});

test("[runtime] controls a revoked Proxy nested in receipt keys", async () => {
  const revocable = Proxy.revocable([...runtimeReceipt.bundleKeysA], {});
  revocable.revoke();
  const receipt = { ...runtimeReceipt, bundleKeysA: revocable.proxy };
  await assert.rejects(
    buildPublisherOfficialGoldenEvidence(fastOptions({ runtimeReceipt: receipt })),
    expectCode("PUBLISHER_OFFICIAL_GOLDEN_RUNTIME_AUTHORITY_INVALID"),
  );
});

test("[runtime] rejects a nested key accessor without invoking it", async () => {
  let reads = 0;
  const keys = [...runtimeReceipt.successKeysA];
  Object.defineProperty(keys, "0", {
    enumerable: true,
    get() {
      reads += 1;
      return "bundle";
    },
  });
  const receipt = { ...runtimeReceipt, successKeysA: keys };
  await assert.rejects(
    buildPublisherOfficialGoldenEvidence(fastOptions({ runtimeReceipt: receipt })),
    expectCode("PUBLISHER_OFFICIAL_GOLDEN_RUNTIME_AUTHORITY_INVALID"),
  );
  assert.equal(reads, 0);
});

test("[runtime] rejects a transparent Proxy outer receipt", async () => {
  await assert.rejects(
    buildPublisherOfficialGoldenEvidence(
      fastOptions({ runtimeReceipt: new Proxy({ ...runtimeReceipt }, {}) }),
    ),
    expectCode("PUBLISHER_OFFICIAL_GOLDEN_RUNTIME_AUTHORITY_INVALID"),
  );
});

test("[runtime] rejects custom-prototype outer receipt authority", async () => {
  const receipt = Object.assign(Object.create({}), runtimeReceipt);
  await assert.rejects(
    buildPublisherOfficialGoldenEvidence(fastOptions({ runtimeReceipt: receipt })),
    expectCode("PUBLISHER_OFFICIAL_GOLDEN_RUNTIME_AUTHORITY_INVALID"),
  );
});

test("[runtime] rejects extra outer receipt authority", async () => {
  const receipt = { ...runtimeReceipt, bundle: {} };
  await assert.rejects(
    buildPublisherOfficialGoldenEvidence(fastOptions({ runtimeReceipt: receipt })),
    expectCode("PUBLISHER_OFFICIAL_GOLDEN_RUNTIME_AUTHORITY_INVALID"),
  );
});

test("[runtime] rejects an outer receipt accessor without invoking it", async () => {
  let reads = 0;
  const receipt = { ...runtimeReceipt };
  Object.defineProperty(receipt, "revisionA", {
    enumerable: true,
    get() {
      reads += 1;
      return EXPECTED_REVISION;
    },
  });
  await assert.rejects(
    buildPublisherOfficialGoldenEvidence(fastOptions({ runtimeReceipt: receipt })),
    expectCode("PUBLISHER_OFFICIAL_GOLDEN_RUNTIME_AUTHORITY_INVALID"),
  );
  assert.equal(reads, 0);
});

test("[authority] ignores non-semantic public package-root comments", async () => {
  const options = await trackedMutation(PUBLISHER_INDEX, (text) => `${text}\n// drift\n`);
  const verified = await verifyPublisherOfficialGoldenEvidence({
    ...options,
    artifactBytes: baseline.artifactBytes,
    proofDocument: pinnedProof,
  });
  assert.equal(verified.result, "PASS");
});

test("[authority] ignores non-semantic focused Publisher suite comments", async () => {
  const options = await trackedMutation(PUBLISHER_TEST, (text) => `${text}\n// drift\n`);
  const verified = await verifyPublisherOfficialGoldenEvidence({
    ...options,
    artifactBytes: baseline.artifactBytes,
    proofDocument: pinnedProof,
  });
  assert.equal(verified.result, "PASS");
});

test("[registration] rejects focused Publisher command drift", async () => {
  const options = await trackedMutation(PUBLISHER_PACKAGE, (text) => {
    const manifest = JSON.parse(text);
    manifest.scripts["test:official-golden"] = "echo skipped";
    return JSON.stringify(manifest);
  });
  await assert.rejects(
    buildPublisherOfficialGoldenEvidence(options),
    expectCode("PUBLISHER_OFFICIAL_GOLDEN_REGISTRATION_DRIFT"),
  );
});

test("[registration] rejects root verifier command drift", async () => {
  const options = await trackedMutation(ROOT_PACKAGE, (text) => {
    const manifest = JSON.parse(text);
    manifest.scripts["verify:publisher-official-golden"] = "echo skipped";
    return JSON.stringify(manifest);
  });
  await assert.rejects(
    buildPublisherOfficialGoldenEvidence(options),
    expectCode("PUBLISHER_OFFICIAL_GOLDEN_REGISTRATION_DRIFT"),
  );
});

test("[registration] rejects a non-immediate aggregate T09 to T10 edge", async () => {
  const options = await trackedMutation(ROOT_PACKAGE, (text) => {
    const manifest = JSON.parse(text);
    manifest.scripts.test = manifest.scripts.test.replace(
      "pnpm test:publisher-bundle-publication && pnpm test:publisher-official-golden",
      "pnpm test:publisher-official-golden && pnpm test:publisher-bundle-publication",
    );
    return JSON.stringify(manifest);
  });
  await assert.rejects(
    buildPublisherOfficialGoldenEvidence(options),
    expectCode("PUBLISHER_OFFICIAL_GOLDEN_REGISTRATION_DRIFT"),
  );
});

test("[ci] rejects removal of the exact T10 single-pass inventory id", async () => {
  const options = await trackedMutation(CI_SOURCE, (text) =>
    text.replace('"publisher-official-golden"', '"publisher-official-golden-changed"'),
  );
  await assert.rejects(
    buildPublisherOfficialGoldenEvidence(options),
    expectCode("PUBLISHER_OFFICIAL_GOLDEN_CI_DRIFT"),
  );
});

test("[ci] rejects hosted workflow bypass of the reviewed single-pass entrypoint", async () => {
  const options = await trackedMutation(CI_WORKFLOW, (text) =>
    text.replace(
      "run: node scripts/run-ci-quality-gate.mjs",
      "run: pnpm test:publisher-official-golden",
    ),
  );
  await assert.rejects(
    buildPublisherOfficialGoldenEvidence(options),
    expectCode("PUBLISHER_OFFICIAL_GOLDEN_CI_DRIFT"),
  );
});

test("[authority] ignores non-semantic T10 proof-reader comments", async () => {
  const options = await trackedMutation(PROOF_LIBRARY, (text) => `${text}\n// drift\n`);
  const verified = await verifyPublisherOfficialGoldenEvidence({
    ...options,
    artifactBytes: baseline.artifactBytes,
    proofDocument: pinnedProof,
  });
  assert.equal(verified.result, "PASS");
});

test("[inventory] rejects a root mutation inventory reduced below twenty-five cases", async () => {
  const options = await trackedMutation(ROOT_TEST, (text) => text.replaceAll("test(", "void("));
  await assert.rejects(
    buildPublisherOfficialGoldenEvidence(options),
    expectCode("PUBLISHER_OFFICIAL_GOLDEN_TEST_INVENTORY_DRIFT"),
  );
});

test("[inventory] rejects removal of one required symlink-authority case", async () => {
  const options = await trackedMutation(ROOT_TEST, (text) =>
    text.replace(
      /^test\("\[symlink\] rejects a verifier artifact symlink through the no-follow reader"/mu,
      'void("[symlink] rejects a verifier artifact symlink through the no-follow reader"',
    ),
  );
  await assert.rejects(
    buildPublisherOfficialGoldenEvidence(options),
    expectCode("PUBLISHER_OFFICIAL_GOLDEN_TEST_INVENTORY_DRIFT"),
  );
});

test("[options] rejects simultaneous artifact byte and path authority", async () => {
  await assert.rejects(
    verifyPublisherOfficialGoldenEvidence(
      fastOptions({
        artifactBytes: baseline.artifactBytes,
        artifactPath: "/tmp/not-read.json",
        proofDocument: pinnedProof,
      }),
    ),
    expectCode("PUBLISHER_OFFICIAL_GOLDEN_OPTIONS_INVALID"),
  );
});

test("[options] rejects simultaneous proof text and path authority", async () => {
  await assert.rejects(
    verifyPublisherOfficialGoldenEvidence(
      fastOptions({
        artifactBytes: baseline.artifactBytes,
        proofDocument: pinnedProof,
        proofDocumentPath: "/tmp/not-read.md",
      }),
    ),
    expectCode("PUBLISHER_OFFICIAL_GOLDEN_OPTIONS_INVALID"),
  );
});

test("[writer] atomically writes exact official evidence bytes", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-t10-writer-"));
  const artifactPath = path.join(directory, "artifact.json");
  try {
    const result = await writePublisherOfficialGoldenEvidence({ artifactPath });
    assert.equal(result.artifactSha256, baseline.artifactSha256);
    assert.deepEqual(await readFile(artifactPath), baseline.artifactBytes);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("[writer] preserves the old destination and removes a tampered temporary", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-t10-writer-tamper-"));
  const artifactPath = path.join(directory, "artifact.json");
  const oldBytes = Buffer.from("old artifact\n");
  await writeFile(artifactPath, oldBytes);
  try {
    await assert.rejects(
      writePublisherOfficialGoldenEvidence({
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
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-t10-writer-link-"));
  const target = path.join(directory, "target.json");
  const artifactPath = path.join(directory, "artifact.json");
  await writeFile(target, "target\n");
  await symlink(target, artifactPath);
  try {
    await assert.rejects(writePublisherOfficialGoldenEvidence({ artifactPath }), TypeError);
    assert.equal(await readFile(target, "utf8"), "target\n");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("[symlink] rejects a verifier artifact symlink through the no-follow reader", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-t10-artifact-link-"));
  const target = path.join(directory, "target.json");
  const artifactPath = path.join(directory, "artifact.json");
  await writeFile(target, baseline.artifactBytes);
  await symlink(target, artifactPath);
  try {
    await assert.rejects(
      verifyPublisherOfficialGoldenEvidence(
        fastOptions({ artifactPath, proofDocument: pinnedProof }),
      ),
      expectCode("PUBLISHER_OFFICIAL_GOLDEN_ARTIFACT_DRIFT"),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("[symlink] rejects a proof-document symlink through the no-follow reader", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-t10-proof-link-"));
  const target = path.join(directory, "target.md");
  const proofDocumentPath = path.join(directory, "proof.md");
  await writeFile(target, pinnedProof);
  await symlink(target, proofDocumentPath);
  try {
    await assert.rejects(
      verifyPublisherOfficialGoldenEvidence(
        fastOptions({ artifactBytes: baseline.artifactBytes, proofDocumentPath }),
      ),
      expectCode("PUBLISHER_OFFICIAL_GOLDEN_PROOF_DOCUMENT_DRIFT"),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("[proof] fatally rejects invalid UTF-8 in a proof-document file", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-t10-proof-utf8-"));
  const proofDocumentPath = path.join(directory, "proof.md");
  await writeFile(proofDocumentPath, Uint8Array.of(0xc3, 0x28));
  try {
    await assert.rejects(
      verifyPublisherOfficialGoldenEvidence(
        fastOptions({ artifactBytes: baseline.artifactBytes, proofDocumentPath }),
      ),
      expectCode("PUBLISHER_OFFICIAL_GOLDEN_PROOF_DOCUMENT_DRIFT"),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("[writer] rejects semantic overrides on the official write path", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-t10-writer-override-"));
  try {
    await assert.rejects(
      writePublisherOfficialGoldenEvidence({
        artifactPath: path.join(directory, "artifact.json"),
        runtimeReceipt,
      }),
      expectCode("PUBLISHER_OFFICIAL_GOLDEN_OFFICIAL_WRITE_OVERRIDE"),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("[writer] rejects a non-function atomic hook", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-t10-writer-hook-"));
  try {
    await assert.rejects(
      writePublisherOfficialGoldenEvidence({
        artifactPath: path.join(directory, "artifact.json"),
        beforeAtomicRename: true,
      }),
      expectCode("PUBLISHER_OFFICIAL_GOLDEN_OPTIONS_INVALID"),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
