import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  CONTROL_PLANE_BUNDLE_STORE_PREREQUISITE_PINS,
  ControlPlaneBundleStoreEvidenceError,
  buildControlPlaneBundleStoreEvidence,
  verifyControlPlaneBundleStoreEvidence,
  writeControlPlaneBundleStoreEvidence,
} from "../scripts/lib/control-plane-bundle-store-proof.mjs";
import { createQualityGateSteps } from "../scripts/run-ci-quality-gate.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const ARTIFACT = "docs/proof/artifacts/control-plane-api-0.1.0-bundle-store.json";
const IMPLEMENTATION = "apps/control-plane-api/src/bundle-store-internal.ts";
const APP_PACKAGE = "apps/control-plane-api/package.json";
const APP_INDEX = "apps/control-plane-api/src/index.ts";
const APP_TEST = "apps/control-plane-api/test/bundle-store.test.ts";
const APP_TYPE_TEST = "apps/control-plane-api/test/bundle-store.types.ts";
const ROOT_PACKAGE = "package.json";
const CI_SOURCE = "scripts/run-ci-quality-gate.mjs";
const TRACEABILITY = "docs/proof/protocol-0.1.0-traceability.json";
const HISTORICAL_COMPATIBILITY_READERS = Object.freeze([
  "scripts/lib/reference-host-web-source-audit-proof.mjs",
  "tests/reference-host-web-source-audit.test.mjs",
  "scripts/lib/publisher-publish-result-proof.mjs",
  "tests/publisher-publish-result.test.mjs",
  "scripts/lib/publisher-execution-preflight-proof.mjs",
  "tests/publisher-execution-preflight.test.mjs",
  "scripts/lib/publisher-catalog-pinning-proof.mjs",
  "tests/publisher-catalog-pinning.test.mjs",
  "scripts/lib/publisher-bundle-publication-proof.mjs",
  "tests/publisher-bundle-publication.test.mjs",
  "scripts/lib/publisher-invalid-source-matrix-proof.mjs",
  "tests/publisher-invalid-source-matrix.test.mjs",
]);
const EXPECTED_REVISION = "sha256:43eef0f11f9bcc4c13fc1eb5691ee974859001fbb4aeee8051948e7c8e195601";
const EXPECTED_SHA256 = "fac0ee3d559528af2f4274cdfb21979463cbadd419f2faba584263cc8b4c0247";

const baseline = await buildControlPlaneBundleStoreEvidence();
const runtimeReceipt = baseline.runtimeReceipt;
const pinnedProof = [
  "# Test-only final M07-T01 pin",
  "",
  `\`${ARTIFACT}\``,
  "",
  `\`sha256:${baseline.artifactSha256}\``,
  "",
].join("\n");

function expectCode(code) {
  return (error) => {
    assert.equal(error instanceof ControlPlaneBundleStoreEvidenceError, true);
    assert.equal(error.code, code);
    return true;
  };
}

function fastOptions(additions = {}) {
  return { runtimeReceipt, ...additions };
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
    trackedFileBytes: { [relativePath]: Buffer.from(mutated, "utf8") },
  });
}

async function verifyWith(additions = {}) {
  return verifyControlPlaneBundleStoreEvidence(
    fastOptions({
      artifactBytes: baseline.artifactBytes,
      proofDocument: pinnedProof,
      ...additions,
    }),
  );
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

test("[authority] builds the exact versioned M07-T01 artifact and golden receipt", () => {
  assert.equal(baseline.artifact.schemaVersion, 1);
  assert.equal(baseline.artifact.profile, "desen.control-plane.bundle-store-proof.v1");
  assert.equal(baseline.artifact.task, "M07-T01");
  assert.equal(baseline.artifact.result, "PASS");
  assert.deepEqual(baseline.artifact.claims.officialBundle, {
    revision: EXPECTED_REVISION,
    canonicalBytes: 2_173,
    canonicalSha256: EXPECTED_SHA256,
  });
  assert.equal(baseline.artifact.tests.packageRuntimeCases, 18);
  assert.equal(baseline.artifact.tests.compileTimeNegativeCases, 4);
  assert.deepEqual(baseline.artifact.claims.historicalCompatibility, {
    currentReaderPaths: HISTORICAL_COMPATIBILITY_READERS,
    historicalArtifactsRewritten: false,
  });
});

test("[determinism] two independent evidence builds produce byte-identical artifacts", async () => {
  const first = await buildControlPlaneBundleStoreEvidence({ runtimeReceipt });
  const second = await buildControlPlaneBundleStoreEvidence({ runtimeReceipt });
  assert.deepEqual(first.artifactBytes, second.artifactBytes);
  assert.equal(first.artifactSha256, second.artifactSha256);
});

test("[authority] verifies fresh artifact bytes and one exact proof-document pin", async () => {
  const result = await verifyWith();
  assert.deepEqual(result, {
    result: "PASS",
    task: "M07-T01",
    artifactSha256: baseline.artifactSha256,
    revision: EXPECTED_REVISION,
    canonicalBytes: 2_173,
    packageRuntimeCases: 18,
    rootMutationCases: baseline.artifact.tests.rootMutationCases,
  });
});

test("[artifact] rejects one changed evidence byte", async () => {
  const bytes = Buffer.from(baseline.artifactBytes);
  bytes[bytes.length - 2] ^= 1;
  await assert.rejects(
    verifyControlPlaneBundleStoreEvidence(
      fastOptions({ artifactBytes: bytes, proofDocument: pinnedProof }),
    ),
    expectCode("ARTIFACT_DRIFT"),
  );
});

test("[proof] rejects pending, wrong, duplicate, or missing final pins", async () => {
  const invalidDocuments = [
    `\`${ARTIFACT}\`\n\n\`sha256:PENDING\``,
    `\`${ARTIFACT}\`\n\n\`sha256:${"0".repeat(64)}\``,
    `${pinnedProof}\n\`sha256:${baseline.artifactSha256}\``,
    `\`sha256:${baseline.artifactSha256}\``,
  ];
  for (const proofDocument of invalidDocuments) {
    await assert.rejects(
      verifyControlPlaneBundleStoreEvidence(
        fastOptions({ artifactBytes: baseline.artifactBytes, proofDocument }),
      ),
      expectCode("PROOF_DOCUMENT_DRIFT"),
    );
  }
});

test("[prerequisites] rejects one changed byte in every direct prerequisite", async () => {
  for (const pin of CONTROL_PLANE_BUNDLE_STORE_PREREQUISITE_PINS) {
    const bytes = Buffer.from(await sourceBytes(pin.path));
    bytes[Math.min(16, bytes.length - 1)] ^= 1;
    await assert.rejects(
      buildControlPlaneBundleStoreEvidence(
        fastOptions({ prerequisiteBytes: { [pin.path]: bytes } }),
      ),
      expectCode("PREREQUISITE_DRIFT"),
    );
  }
});

test("[implementation] rejects no-clobber, durability, or byte-brand source drift", async () => {
  const mutations = [
    (source) =>
      source.replace("await link(temporary.path, finalPath);", "await unlink(finalPath);"),
    (source) => source.replace("await syncDirectory(authority.algorithm);", "void authority;"),
    (source) => source.replace('tag !== "Uint8Array"', 'tag !== "Uint16Array"'),
    (source) => source.replace("before.nlink !== 1n", "before.nlink < 1n"),
  ];
  for (const transform of mutations) {
    const options = await trackedMutation(IMPLEMENTATION, transform);
    await assert.rejects(
      buildControlPlaneBundleStoreEvidence(options),
      expectCode("IMPLEMENTATION_DRIFT"),
    );
  }
});

test("[registration] rejects package-root, public-export, aggregate, or CI tuple drift", async () => {
  const mutations = [
    [
      APP_PACKAGE,
      (source) => source.replace('"import": "./dist/index.js"', '"import": "./src/index.js"'),
    ],
    [
      APP_INDEX,
      (source) =>
        source.replace(
          'export { openBundleStore } from "./bundle-store.js";',
          'export { openBundleStoreInternal } from "./bundle-store-internal.js";',
        ),
    ],
    [APP_INDEX, (source) => `${source}\nexport const deleteBundle = true;\n`],
    [
      APP_PACKAGE,
      (source) =>
        source.replace(
          '"exports": {\n    ".": {',
          '"exports": {\n    "./unsafe-delete": "./dist/delete.js",\n    ".": {',
        ),
    ],
    [
      ROOT_PACKAGE,
      (source) =>
        source.replace(
          "node scripts/verify-control-plane-bundle-store.mjs",
          "node scripts/verify-publisher-invalid-source-matrix.mjs",
        ),
    ],
    [
      CI_SOURCE,
      (source) => source.replace('"control-plane-bundle-store"', '"bundle-store-unreviewed"'),
    ],
    [
      CI_SOURCE,
      (source) =>
        source.replace(
          ".map(([id, verifierFile, rootTestFile]) => Object.freeze({ id, verifierFile, rootTestFile }))",
          ".map(([id, verifierFile, ...rootTestFile]) => Object.freeze({ id, verifierFile, rootTestFile }))",
        ),
    ],
    [
      CI_SOURCE,
      (source) =>
        source.replace(
          ".map(([id, verifierFile, rootTestFile]) => Object.freeze({ id, verifierFile, rootTestFile }))",
          ".map(async ([id, verifierFile, rootTestFile]) => Object.freeze({ id, verifierFile, rootTestFile }))",
        ),
    ],
    [
      CI_SOURCE,
      (source) =>
        source.replace(
          'const WORKSPACE_ROOT = resolve(import.meta.dirname, "..");',
          [
            "const Object = { freeze: (value) => value };",
            "",
            'const WORKSPACE_ROOT = resolve(import.meta.dirname, "..");',
          ].join("\n"),
        ),
    ],
    [
      CI_SOURCE,
      (source) =>
        source.replace(
          'const WORKSPACE_ROOT = resolve(import.meta.dirname, "..");',
          [
            "const Object = { freeze: () => ({ forged: true }) };",
            "",
            'const WORKSPACE_ROOT = resolve(import.meta.dirname, "..");',
          ].join("\n"),
        ),
    ],
    [
      CI_SOURCE,
      (source) =>
        source.replace(
          'const WORKSPACE_ROOT = resolve(import.meta.dirname, "..");',
          [
            "Array.prototype.map = () => [];",
            "",
            'const WORKSPACE_ROOT = resolve(import.meta.dirname, "..");',
          ].join("\n"),
        ),
    ],
    [
      CI_SOURCE,
      (source) => {
        const tuple = [
          "    [",
          '      "control-plane-bundle-store",',
          '      "scripts/verify-control-plane-bundle-store.mjs",',
          '      "tests/control-plane-bundle-store.test.mjs",',
          "    ],",
        ].join("\n");
        return `${source.replace(`${tuple}\n`, "")}\n/*\n${tuple}\n*/\n`;
      },
    ],
  ];
  for (const [relativePath, transform] of mutations) {
    await assert.rejects(
      buildControlPlaneBundleStoreEvidence(await trackedMutation(relativePath, transform)),
      expectCode("REGISTRATION_DRIFT"),
    );
  }

  const successorOptions = await trackedMutation(ROOT_PACKAGE, (source) =>
    source
      .replace(
        "pnpm verify:control-plane-package-preflight && pnpm lint",
        "pnpm verify:control-plane-package-preflight && pnpm verify:control-plane-successor && pnpm lint",
      )
      .replace(
        "pnpm test:control-plane-package-preflight && turbo run test",
        "pnpm test:control-plane-package-preflight && pnpm test:control-plane-successor && turbo run test",
      ),
  );
  const successor = await buildControlPlaneBundleStoreEvidence(successorOptions);
  assert.deepEqual(successor.artifactBytes, baseline.artifactBytes);

  const ciSuccessorOptions = await trackedMutation(CI_SOURCE, (source) => {
    const successorTuple = [
      "    [",
      '      "control-plane-successor",',
      '      "scripts/verify-control-plane-successor.mjs",',
      '      "tests/control-plane-successor.test.mjs",',
      "    ],",
    ].join("\n");
    const inventoryTerminator =
      "  ].map(([id, verifierFile, rootTestFile]) => Object.freeze({ id, verifierFile, rootTestFile })),";
    const withTuple = source.replace(
      inventoryTerminator,
      `${successorTuple}\n${inventoryTerminator}`,
    );
    assert.notEqual(withTuple, source);

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
        id: "verify-control-plane-successor",
        label: "Proof verifier: control-plane-successor",
        command: "node",
        args: ["scripts/verify-control-plane-successor.mjs"],
      },
      ...currentSteps.slice(firstRootTestIndex, dependencyBoundaryIndex),
      {
        id: "test-control-plane-successor",
        label: "Root proof and mutation test: control-plane-successor",
        command: "node",
        args: ["--test", "--test-concurrency=1", "tests/control-plane-successor.test.mjs"],
      },
      ...currentSteps.slice(dependencyBoundaryIndex),
    ];
    const planSha256 = createHash("sha256")
      .update(JSON.stringify(steps.map(({ id, command, args }) => ({ id, command, args }))))
      .digest("hex");
    const candidate = withTuple.replace(
      /const QUALITY_GATE_PLAN_SHA256 = "[0-9a-f]{64}";/u,
      `const QUALITY_GATE_PLAN_SHA256 = "${planSha256}";`,
    );
    assert.notEqual(candidate, withTuple);
    return candidate;
  });
  const ciSuccessor = await buildControlPlaneBundleStoreEvidence(ciSuccessorOptions);
  assert.deepEqual(ciSuccessor.artifactBytes, baseline.artifactBytes);

  const ciCommentOptions = await trackedMutation(
    CI_SOURCE,
    (source) => `${source}\n/* control-plane-bundle-store comment-only decoy */\n`,
  );
  const ciComment = await buildControlPlaneBundleStoreEvidence(ciCommentOptions);
  assert.deepEqual(ciComment.artifactBytes, baseline.artifactBytes);

  const brokenEdgeOptions = await trackedMutation(ROOT_PACKAGE, (source) =>
    source.replace(
      "pnpm verify:publisher-invalid-source-matrix && pnpm verify:control-plane-bundle-store",
      "pnpm verify:publisher-invalid-source-matrix && pnpm verify:control-plane-interloper && pnpm verify:control-plane-bundle-store",
    ),
  );
  await assert.rejects(
    buildControlPlaneBundleStoreEvidence(brokenEdgeOptions),
    expectCode("REGISTRATION_DRIFT"),
  );
});

test("[traceability] rejects owner or identity drift in all five exact rows", async () => {
  const options = await trackedMutation(TRACEABILITY, (source) =>
    source.replace('"owners": ["M07-T01", "M07-T11"]', '"owners": ["M07-T11"]'),
  );
  await assert.rejects(
    buildControlPlaneBundleStoreEvidence(options),
    expectCode("TRACEABILITY_DRIFT"),
  );
});

test("[runtime] rejects overwrite, alias, copy, concurrency, or public-boundary fake receipts", async () => {
  const mutations = [
    (receipt) => {
      receipt.conflictStatus = "stored";
    },
    (receipt) => {
      receipt.freshReadCopies = false;
    },
    (receipt) => {
      receipt.equalConcurrency.stored = 2;
      receipt.equalConcurrency.unchanged = 6;
    },
    (receipt) => {
      receipt.storeKeys.push("deleteBundle");
    },
    (receipt) => {
      receipt.storedLinks = 2;
    },
  ];
  for (const mutate of mutations) {
    const receipt = structuredClone(runtimeReceipt);
    mutate(receipt);
    await assert.rejects(
      buildControlPlaneBundleStoreEvidence({ runtimeReceipt: receipt }),
      expectCode("RUNTIME_PROBE_MISMATCH"),
    );
  }
});

test("[tests] rejects skipped runtime cases or removed compile-time negatives", async () => {
  const runtimeOptions = await trackedMutation(APP_TEST, (source) =>
    source.replace(
      'it("returns a fresh byte copy for every read"',
      '/* it("returns a fresh byte copy for every read") */\n  it.skip("returns a fresh byte copy for every read"',
    ),
  );
  await assert.rejects(
    buildControlPlaneBundleStoreEvidence(runtimeOptions),
    expectCode("TEST_AUTHORITY_DRIFT"),
  );

  const conditionalRuntimeOptions = await trackedMutation(APP_TEST, (source) =>
    source.replace(
      'it("returns a fresh byte copy for every read"',
      'if (false) it("returns a fresh byte copy for every read"',
    ),
  );
  await assert.rejects(
    buildControlPlaneBundleStoreEvidence(conditionalRuntimeOptions),
    expectCode("TEST_AUTHORITY_DRIFT"),
  );

  const typeOptions = await trackedMutation(APP_TYPE_TEST, (source) =>
    source.replace("@ts-expect-error", "negative fixture"),
  );
  await assert.rejects(
    buildControlPlaneBundleStoreEvidence(typeOptions),
    expectCode("TEST_AUTHORITY_DRIFT"),
  );

  const falseNegativeOptions = await trackedMutation(APP_TYPE_TEST, (source) =>
    source.replace('entry.revision = "sha256:mutated";', "void entry.revision;"),
  );
  await assert.rejects(
    buildControlPlaneBundleStoreEvidence(falseNegativeOptions),
    expectCode("TEST_AUTHORITY_DRIFT"),
  );

  const rootOptions = await trackedMutation("tests/control-plane-bundle-store.test.mjs", (source) =>
    source.replace(
      'test("[artifact] rejects one changed evidence byte"',
      '/* test("[artifact] rejects one changed evidence byte") */\ntest.skip("[artifact] rejects one changed evidence byte"',
    ),
  );
  await assert.rejects(
    buildControlPlaneBundleStoreEvidence(rootOptions),
    expectCode("TEST_AUTHORITY_DRIFT"),
  );

  for (const relativePath of HISTORICAL_COMPATIBILITY_READERS) {
    const options = await trackedMutation(
      relativePath,
      (source) => `${source}\n/* unreviewed compatibility-reader change */\n`,
    );
    await assert.rejects(
      verifyControlPlaneBundleStoreEvidence({
        ...options,
        artifactBytes: baseline.artifactBytes,
        proofDocument: pinnedProof,
      }),
      expectCode("ARTIFACT_DRIFT"),
    );
  }
});

test("[filesystem] rejects symlinked artifact and proof-document authority", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "desen-m07-proof-symlink-"));
  try {
    const canonicalTemporary = await realpath(temporary);
    const realArtifact = path.join(canonicalTemporary, "artifact.json");
    const artifactLink = path.join(canonicalTemporary, "artifact-link.json");
    const realProof = path.join(canonicalTemporary, "proof.md");
    const proofLink = path.join(canonicalTemporary, "proof-link.md");
    await writeFile(realArtifact, baseline.artifactBytes);
    await writeFile(realProof, pinnedProof);
    await symlink(realArtifact, artifactLink);
    await symlink(realProof, proofLink);

    const canonicalResult = await verifyControlPlaneBundleStoreEvidence(
      fastOptions({
        artifactPath: realArtifact,
        proofDocumentPath: realProof,
      }),
    );
    assert.equal(canonicalResult.result, "PASS");

    await assert.rejects(
      verifyControlPlaneBundleStoreEvidence(
        fastOptions({ artifactPath: artifactLink, proofDocument: pinnedProof }),
      ),
      expectCode("FILE_AUTHORITY_INVALID"),
    );
    await assert.rejects(
      verifyControlPlaneBundleStoreEvidence(
        fastOptions({
          artifactBytes: baseline.artifactBytes,
          proofDocumentPath: proofLink,
        }),
      ),
      expectCode("FILE_AUTHORITY_INVALID"),
    );

    const realParent = path.join(canonicalTemporary, "real-parent");
    const parentLink = path.join(canonicalTemporary, "parent-link");
    await mkdir(realParent);
    await writeFile(path.join(realParent, "artifact.json"), baseline.artifactBytes);
    await writeFile(path.join(realParent, "proof.md"), pinnedProof);
    await symlink(realParent, parentLink);
    await assert.rejects(
      verifyControlPlaneBundleStoreEvidence(
        fastOptions({
          artifactPath: path.join(parentLink, "artifact.json"),
          proofDocument: pinnedProof,
        }),
      ),
      expectCode("FILE_AUTHORITY_INVALID"),
    );
    await assert.rejects(
      verifyControlPlaneBundleStoreEvidence(
        fastOptions({
          artifactBytes: baseline.artifactBytes,
          proofDocumentPath: path.join(parentLink, "proof.md"),
        }),
      ),
      expectCode("FILE_AUTHORITY_INVALID"),
    );
  } finally {
    await rm(temporary, { force: true, recursive: true });
  }
});

test("[writer] atomically writes exact deterministic evidence bytes", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "desen-m07-proof-write-"));
  try {
    const artifactPath = path.join(temporary, "bundle-store.json");
    const result = await writeControlPlaneBundleStoreEvidence({ artifactPath });
    assert.equal(result.artifactSha256, baseline.artifactSha256);
    assert.deepEqual(await readFile(artifactPath), baseline.artifactBytes);
    assert.deepEqual(
      (await readdir(temporary)).filter((entry) => entry.endsWith(".tmp")),
      [],
    );
  } finally {
    await rm(temporary, { force: true, recursive: true });
  }
});

test("[writer] preserves the old destination and removes a tampered temporary", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "desen-m07-proof-tamper-"));
  try {
    const artifactPath = path.join(temporary, "bundle-store.json");
    const previous = Buffer.from('{"previous":true}\n', "utf8");
    await writeFile(artifactPath, previous);
    await assert.rejects(
      writeControlPlaneBundleStoreEvidence({
        artifactPath,
        beforeAtomicRename: async ({ temporaryPath }) => {
          await writeFile(temporaryPath, "tampered");
        },
      }),
      expectCode("ARTIFACT_WRITE_FAILED"),
    );
    assert.deepEqual(await readFile(artifactPath), previous);
    assert.deepEqual(
      (await readdir(temporary)).filter((entry) => entry.endsWith(".tmp")),
      [],
    );
  } finally {
    await rm(temporary, { force: true, recursive: true });
  }
});

test("[options] rejects unknown, accessor-backed, shared-memory, or hostile authority", async () => {
  await assert.rejects(
    buildControlPlaneBundleStoreEvidence({ unexpected: true }),
    expectCode("INVALID_OPTIONS"),
  );
  const accessor = {};
  Object.defineProperty(accessor, "runtimeReceipt", {
    enumerable: true,
    get() {
      throw new Error("must not run");
    },
  });
  await assert.rejects(
    buildControlPlaneBundleStoreEvidence(accessor),
    expectCode("INVALID_OPTIONS"),
  );
  await assert.rejects(
    verifyControlPlaneBundleStoreEvidence(
      fastOptions({
        artifactBytes: new Uint8Array(new SharedArrayBuffer(8)),
        proofDocument: pinnedProof,
      }),
    ),
    expectCode("INVALID_OPTIONS"),
  );
  class SharedBytesWithSpoofedBuffer extends Uint8Array {
    get buffer() {
      return new ArrayBuffer(8);
    }
  }
  await assert.rejects(
    verifyControlPlaneBundleStoreEvidence(
      fastOptions({
        artifactBytes: new SharedBytesWithSpoofedBuffer(new SharedArrayBuffer(8)),
        proofDocument: pinnedProof,
      }),
    ),
    expectCode("INVALID_OPTIONS"),
  );
  let coercions = 0;
  await assert.rejects(
    verifyControlPlaneBundleStoreEvidence(
      fastOptions({
        artifactBytes: baseline.artifactBytes,
        proofDocument: {
          toString() {
            coercions += 1;
            return pinnedProof;
          },
        },
      }),
    ),
    expectCode("INVALID_OPTIONS"),
  );
  assert.equal(coercions, 0);

  const hostilePath = {
    [Symbol.toPrimitive]() {
      coercions += 1;
      return path.join(ROOT, ARTIFACT);
    },
    toString() {
      coercions += 1;
      return path.join(ROOT, ARTIFACT);
    },
  };
  await assert.rejects(
    verifyControlPlaneBundleStoreEvidence(
      fastOptions({ artifactPath: hostilePath, proofDocument: pinnedProof }),
    ),
    expectCode("INVALID_OPTIONS"),
  );
  await assert.rejects(
    verifyControlPlaneBundleStoreEvidence(
      fastOptions({
        artifactBytes: baseline.artifactBytes,
        proofDocumentPath: hostilePath,
      }),
    ),
    expectCode("INVALID_OPTIONS"),
  );
  await assert.rejects(
    writeControlPlaneBundleStoreEvidence({ artifactPath: hostilePath }),
    expectCode("INVALID_OPTIONS"),
  );
  assert.equal(coercions, 0);

  const extraArrayKey = structuredClone(runtimeReceipt);
  Object.defineProperty(extraArrayKey.divergentConcurrency.statuses, "4294967295", {
    configurable: true,
    enumerable: true,
    value: "stored",
  });
  await assert.rejects(
    buildControlPlaneBundleStoreEvidence({ runtimeReceipt: extraArrayKey }),
    expectCode("INVALID_OPTIONS"),
  );
  const hostile = new Proxy(
    {},
    {
      ownKeys() {
        throw new Error("must stay controlled");
      },
    },
  );
  await assert.rejects(
    buildControlPlaneBundleStoreEvidence(hostile),
    expectCode("INVALID_OPTIONS"),
  );
});

test("[immutability] freezes the evidence graph and preserves honest later-task nonclaims", () => {
  assert.equal(deeplyFrozen(baseline.artifact), true);
  assert.equal(deeplyFrozen(baseline.runtimeReceipt), true);
  assert.equal(baseline.artifact.claims.publicBoundary.testFaultSeamPublic, false);
  assert.equal(
    baseline.artifact.nonclaims.some((claim) => claim.includes("M07-T02")),
    true,
  );
  assert.equal(
    baseline.artifact.nonclaims.some(
      (claim) =>
        claim.includes("N-010 remains PLANNED") &&
        claim.includes("M07-T03") &&
        claim.includes("M12-T12") &&
        claim.includes("N-019 remains PLANNED") &&
        claim.includes("M07-T05"),
    ),
    true,
  );
  assert.equal(
    baseline.artifact.nonclaims.some((claim) => claim.includes("channel pointers")),
    true,
  );
});
