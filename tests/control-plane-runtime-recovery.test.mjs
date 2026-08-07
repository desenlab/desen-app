import assert from "node:assert/strict";
import {
  appendFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  symlink,
  truncate,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import {
  CONTROL_PLANE_RUNTIME_RECOVERY_EXPECTED_RECEIPT,
  CONTROL_PLANE_RUNTIME_RECOVERY_PREREQUISITE_PINS,
  ControlPlaneRuntimeRecoveryEvidenceError,
  buildControlPlaneRuntimeRecoveryEvidence,
  readControlPlaneRuntimeRecoveryAuthorityForTest,
  verifyControlPlaneRuntimeRecoveryEvidence,
  writeControlPlaneRuntimeRecoveryEvidence,
} from "../scripts/lib/control-plane-runtime-recovery-proof.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const APP_PACKAGE = "apps/control-plane-api/package.json";
const APP_INDEX = "apps/control-plane-api/src/index.ts";
const APP_CONTRACT = "apps/control-plane-api/src/runtime-activation-contract.ts";
const APP_INTERNAL = "apps/control-plane-api/src/runtime-activation-internal.ts";
const APP_RECOVERY_TEST = "apps/control-plane-api/test/runtime-recovery.test.ts";
const APP_RECOVERY_TYPE_TEST = "apps/control-plane-api/test/runtime-recovery.types.ts";
const ROOT_PACKAGE = "package.json";
const CI_SOURCE = "scripts/run-ci-quality-gate.mjs";
const CI_INVENTORY = "scripts/ci/exhaustive-workload-inventory.mjs";
const SHARED_STATE_AUTHORITY = "scripts/ci/shared-state-authority.mjs";
const ROOT_TEST = "tests/control-plane-runtime-recovery.test.mjs";
const ADR = "docs/adr/0014-runtime-restart-recovery.md";
const ARTIFACT = "docs/proof/artifacts/control-plane-api-0.1.0-runtime-recovery.json";

let built;
const temporaryDirectories = [];

function expectedError(code) {
  return (error) =>
    error instanceof ControlPlaneRuntimeRecoveryEvidenceError && error.code === code;
}

function runtimeReceipt() {
  return structuredClone(CONTROL_PLANE_RUNTIME_RECOVERY_EXPECTED_RECEIPT);
}

function exactProofDocument(artifactSha256) {
  return `# Test proof\n\nArtifact: \`${ARTIFACT}\`\n\nFinal receipt: \`sha256:${artifactSha256}\`\n`;
}

function changedByte(bytes) {
  const copy = Uint8Array.from(bytes);
  copy[Math.floor(copy.byteLength / 2)] ^= 1;
  return copy;
}

function oneExecutableTestWithCommentSpoofs(names, { callee, module, suite }) {
  const [first, ...rest] = names;
  const comments = rest
    .map((name) => `// ${callee}(${JSON.stringify(name)}, () => {});`)
    .join("\n");
  const imports = suite === undefined ? callee : `describe, ${callee}`;
  const executable = `${callee}(${JSON.stringify(first)}, () => { void 0; });`;
  if (suite === undefined) {
    return `import { ${imports} } from ${JSON.stringify(module)};\n${executable}\n${comments}\n`;
  }
  return `import { ${imports} } from ${JSON.stringify(module)};\ndescribe(${JSON.stringify(suite)}, () => {\n  ${executable}\n${comments}\n});\n`;
}

function exactNameVoidTestStubs(names, { callee, module, suite }) {
  const imports = suite === undefined ? callee : `describe, ${callee}`;
  const cases = names
    .map((name) => `${callee}(${JSON.stringify(name)}, () => { void 0; });`)
    .join("\n");
  if (suite === undefined) {
    return `import { ${imports} } from ${JSON.stringify(module)};\n${cases}\n`;
  }
  return `import { ${imports} } from ${JSON.stringify(module)};\ndescribe(${JSON.stringify(suite)}, () => {\n${cases}\n});\n`;
}

async function workspaceBytes(relativePath) {
  return readFile(path.join(ROOT, relativePath));
}

async function makeTemporaryDirectory(prefix) {
  const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), prefix)));
  temporaryDirectories.push(directory);
  return directory;
}

before(async () => {
  built = await buildControlPlaneRuntimeRecoveryEvidence({ runtimeReceipt: runtimeReceipt() });
});

after(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

test("[authority] builds the exact M07-T08 recovery artifact from the built API receipt", () => {
  assert.equal(built.artifact.schemaVersion, 1);
  assert.equal(built.artifact.proofId, "control-plane-runtime-recovery");
  assert.equal(built.artifact.profile, "desen.control-plane.runtime-recovery-proof.v1");
  assert.equal(built.artifact.task, "M07-T08");
  assert.equal(built.artifact.result, "PASS");
  assert.deepEqual(
    { ...built.artifact.claims.durableRecord },
    {
      activeRevision: "sha256:cdd16ae0764d3de1199e0e93a0baf7b183ea50ecb207f21cbd197bd1bbcb4ca6",
      previousGoodRevision:
        "sha256:2dc98d276a3b4102c2891de1519bda86ea2978f5429fd8ea91831f36f8b73ffb",
      generation: 1,
    },
  );
  assert.equal(built.artifact.claims.rawRestartState.status, "recovery-required");
  assert.equal(built.artifact.claims.rawRestartState.authorityAbsent, true);
  assert.equal(built.artifact.claims.authorityReconstruction.status, "recovered");
  assert.equal(built.artifact.claims.authorityReconstruction.durableRecordUnchanged, true);
  assert.equal(built.artifact.claims.authorityReconstruction.privateAuthorityAuthenticated, true);
  assert.equal(
    built.artifact.claims.authorityReconstruction.privatePreviousGoodRevision,
    built.artifact.claims.durableRecord.previousGoodRevision,
  );
  assert.deepEqual(
    built.artifact.claims.durableStorage.before.row,
    built.artifact.claims.durableRecord,
  );
  assert.deepEqual(
    built.artifact.claims.durableStorage.after.row,
    built.artifact.claims.durableRecord,
  );
  assert.equal(built.artifact.claims.durableStorage.before.bytes, 8_192);
  assert.equal(
    built.artifact.claims.durableStorage.before.sha256,
    "d82f0b5dcad4ff2b8398724b79fe91f01243cc04d6747ca98a137b35e9564f61",
  );
  assert.deepEqual(
    built.artifact.claims.durableStorage.after,
    built.artifact.claims.durableStorage.before,
  );
  assert.equal(built.artifact.claims.durableStorage.recordUnchanged, true);
  assert.equal(built.artifact.claims.durableStorage.databaseBytesUnchanged, true);
  assert.equal(built.artifact.claims.implementation.recoveryNeverWritesDurableState, true);
  assert.equal(built.artifact.claims.registrations.publicExports.count, 105);
  assert.equal(
    built.artifact.claims.registrations.publicExports.sha256,
    "c3daff8c4df98edc5beaa3f64cb8805613ed5cb29b55aed771346ba3b8949e43",
  );
  assert.deepEqual(built.runtimeReceipt.publicModuleKeys, [
    "BUNDLE_INTEGRITY_LIMITS",
    "BUNDLE_PACKAGE_PREFLIGHT_LIMITS",
    "BUNDLE_REFERENCE_PREFLIGHT_LIMITS",
    "BUNDLE_RUNTIME_STAGING_LIMITS",
    "BundleStoreError",
    "INVALID_BUNDLE_INTEGRITY_AUTHORITY_CODE",
    "INVALID_BUNDLE_PACKAGE_AUTHORITY_CODE",
    "INVALID_INSTALLED_PACKAGE_CODE",
    "INVALID_RUNTIME_ACTIVATION_AUTHORITY_CODE",
    "INVALID_RUNTIME_RECOVERY_PACKAGE_AUTHORITY_CODE",
    "INVALID_RUNTIME_STAGING_PACKAGE_AUTHORITY_CODE",
    "LOCAL_CONTROL_PLANE_ERROR_MESSAGES",
    "LOCAL_CONTROL_PLANE_IDENTIFIER_PATTERN",
    "LOCAL_CONTROL_PLANE_JSON_MEDIA_TYPE",
    "LOCAL_CONTROL_PLANE_LIMITS",
    "LOCAL_CONTROL_PLANE_LOOPBACK_ADDRESS",
    "LocalControlPlaneError",
    "PACKAGE_PREFLIGHT_INTERNAL_FAILURE_CODE",
    "PACKAGE_PREFLIGHT_LIMIT_EXCEEDED_CODE",
    "REFERENCE_PREFLIGHT_INTERNAL_FAILURE_CODE",
    "RUNTIME_ACTIVATION_BUNDLE_RECLOSURE_FAILED_CODE",
    "RUNTIME_ACTIVATION_INTERNAL_FAILURE_CODE",
    "RUNTIME_RECOVERY_BUNDLE_RECLOSURE_FAILED_CODE",
    "RUNTIME_RECOVERY_INTERNAL_FAILURE_CODE",
    "RUNTIME_STAGING_INTERNAL_FAILURE_CODE",
    "RUNTIME_STAGING_LIMIT_EXCEEDED_CODE",
    "RUNTIME_STAGING_PACKAGE_SNAPSHOT_MISMATCH_CODE",
    "RuntimeActivationError",
    "SOURCE_MATERIAL_LIMIT_EXCEEDED_CODE",
    "openBundleRuntimeActivation",
    "openBundleStore",
    "openLocalControlPlane",
    "preflightBundlePackages",
    "preflightBundleReferences",
    "stageBundleRuntime",
    "verifyBundleStoreEntry",
  ]);
  assert.equal(built.artifact.prerequisites.length, 4);
  assert.deepEqual(
    built.artifact.claims.traceRows.map(({ id }) => id),
    ["PIPE-017", "A-009"],
  );
  assert.match(built.artifactSha256, /^[0-9a-f]{64}$/u);
});

test("[determinism] two independent evidence builds are byte-identical", async () => {
  const second = await buildControlPlaneRuntimeRecoveryEvidence({
    runtimeReceipt: runtimeReceipt(),
  });
  assert.deepEqual(second.artifactBytes, built.artifactBytes);
  assert.equal(second.artifactSha256, built.artifactSha256);
  assert.notEqual(second.runtimeReceipt, built.runtimeReceipt);
});

test("[prerequisites] rejects drift in every immutable predecessor artifact", async () => {
  assert.deepEqual(
    CONTROL_PLANE_RUNTIME_RECOVERY_PREREQUISITE_PINS.map(({ task }) => task),
    ["M07-T01", "M07-T04", "M07-T06", "M07-T07"],
  );
  for (const prerequisite of CONTROL_PLANE_RUNTIME_RECOVERY_PREREQUISITE_PINS) {
    await assert.rejects(
      buildControlPlaneRuntimeRecoveryEvidence({
        prerequisiteBytes: {
          [prerequisite.path]: changedByte(await workspaceBytes(prerequisite.path)),
        },
        runtimeReceipt: runtimeReceipt(),
      }),
      expectedError("PREREQUISITE_DRIFT"),
    );
  }
});

test("[runtime] rejects one changed recovery receipt field", async () => {
  const mutations = [
    (receipt) => {
      receipt.durableBeforeRestart.generation = 2;
    },
    (receipt) => {
      receipt.beforeRecovery.authorityAbsent = false;
    },
    (receipt) => {
      receipt.mismatchedActive.role = "previous-good";
    },
    (receipt) => {
      receipt.missingPreviousGoodLeftRecordPending = false;
    },
    (receipt) => {
      receipt.recovered.durableRecordUnchanged = false;
    },
    (receipt) => {
      receipt.recovered.privatePreviousGoodRevision = null;
    },
    (receipt) => {
      receipt.durableStorage.after.sha256 = "0".repeat(64);
    },
    (receipt) => {
      receipt.durableStorage.databaseBytesUnchanged = false;
    },
    (receipt) => {
      receipt.publicModuleKeys.push("readBundleRuntimeActivationAuthority");
    },
  ];
  for (const mutate of mutations) {
    const receipt = runtimeReceipt();
    mutate(receipt);
    await assert.rejects(
      buildControlPlaneRuntimeRecoveryEvidence({ runtimeReceipt: receipt }),
      expectedError("RUNTIME_PROBE_MISMATCH"),
    );
  }
});

test("[implementation] rejects removal of the public recovery boundary", async () => {
  const runtimeTestNames = built.artifact.tests.packageRuntimeCaseNames;
  const rootTestNames = built.artifact.tests.rootMutationCaseNames;
  const typeClaims = built.artifact.tests.compileTimeNegativeClaims;
  const cases = [
    [
      APP_CONTRACT,
      (source) =>
        `${source.replace("readonly recover:", "readonly restore:")}\n// readonly recover:\n`,
      "IMPLEMENTATION_DRIFT",
    ],
    [
      APP_INTERNAL,
      (source) =>
        source.replace(
          "const read = options.repository.get();",
          'const read = { status: "missing" as const }; // options.repository.get()',
        ),
      "IMPLEMENTATION_DRIFT",
    ],
    [
      APP_INDEX,
      (source) =>
        `${source}\nexport { readBundleRuntimeActivationAuthority } from "./runtime-activation-internal.js";\n`,
      "REGISTRATION_DRIFT",
    ],
    [
      APP_INDEX,
      (source) => `${source}\nexport * from "./runtime-activation-internal.js";\n`,
      "REGISTRATION_DRIFT",
    ],
    [
      APP_PACKAGE,
      (source) =>
        source.replace(
          '"test:runtime-recovery": "vitest run test/runtime-recovery.test.ts"',
          '"test:runtime-recovery": "vitest run test/runtime-activation.test.ts"',
        ),
      "REGISTRATION_DRIFT",
    ],
    [
      ROOT_PACKAGE,
      (source) => {
        const manifest = JSON.parse(source);
        delete manifest.scripts["verify:control-plane-runtime-recovery"];
        return `${JSON.stringify(manifest, null, 2)}\n`;
      },
      "REGISTRATION_DRIFT",
    ],
    [
      CI_SOURCE,
      (source) =>
        `${source.replace(
          '      "control-plane-runtime-recovery",\n      "scripts/verify-control-plane-runtime-recovery.mjs",\n      "tests/control-plane-runtime-recovery.test.mjs",',
          '      "removed-runtime-recovery",\n      "scripts/removed-runtime-recovery.mjs",\n      "tests/removed-runtime-recovery.test.mjs",',
        )}\n// ["control-plane-runtime-recovery","scripts/verify-control-plane-runtime-recovery.mjs","tests/control-plane-runtime-recovery.test.mjs",]\n`,
      "REGISTRATION_DRIFT",
    ],
    [
      CI_INVENTORY,
      (source) =>
        `${source.replace(
          '    "control-plane-runtime-recovery",\n    "scripts/verify-control-plane-runtime-recovery.mjs",\n    "tests/control-plane-runtime-recovery.test.mjs",',
          '    "removed-runtime-recovery",\n    "scripts/removed-runtime-recovery.mjs",\n    "tests/removed-runtime-recovery.test.mjs",',
        )}\n// ["control-plane-runtime-recovery","scripts/verify-control-plane-runtime-recovery.mjs","tests/control-plane-runtime-recovery.test.mjs",]\n`,
      "REGISTRATION_DRIFT",
    ],
    [
      SHARED_STATE_AUTHORITY,
      (source) =>
        source.replace(
          '  "control-plane-runtime-recovery",\n]);',
          '  // "control-plane-runtime-recovery",\n]);',
        ),
      "REGISTRATION_DRIFT",
    ],
    [
      SHARED_STATE_AUTHORITY,
      (source) =>
        source.replace(
          '"control-plane-runtime-recovery": NATIVE_ADDON_POLICIES.CONTROL_PLANE_RUNTIME_RECOVERY_SQLITE',
          '// "control-plane-runtime-recovery": NATIVE_ADDON_POLICIES.CONTROL_PLANE_RUNTIME_RECOVERY_SQLITE',
        ),
      "REGISTRATION_DRIFT",
    ],
    [
      CI_SOURCE,
      (source) =>
        source.replace(
          "proofEntries = PROOF_ENTRIES,",
          'proofEntries = PROOF_ENTRIES.filter(({ id }) => id !== "control-plane-runtime-recovery"),',
        ),
      "REGISTRATION_DRIFT",
    ],
    [
      CI_INVENTORY,
      (source) =>
        source.replace(
          "const verifiers = PROOF_UNIT_TUPLES.map(([id, verifierFile]) =>",
          'const verifiers = PROOF_UNIT_TUPLES.filter(([id]) => id !== "control-plane-runtime-recovery").map(([id, verifierFile]) =>',
        ),
      "REGISTRATION_DRIFT",
    ],
    [
      SHARED_STATE_AUTHORITY,
      (source) =>
        source.replace(
          "const CHILD_PROCESS_VERIFIER_PROOF_ID_SET = new Set(CHILD_PROCESS_VERIFIER_PROOF_IDS);",
          'const CHILD_PROCESS_VERIFIER_PROOF_ID_SET = new Set(CHILD_PROCESS_VERIFIER_PROOF_IDS.filter((id) => id !== "control-plane-runtime-recovery"));',
        ),
      "REGISTRATION_DRIFT",
    ],
    [
      APP_RECOVERY_TEST,
      () =>
        oneExecutableTestWithCommentSpoofs(runtimeTestNames, {
          callee: "it",
          module: "vitest",
          suite: "M07-T08 restart recovery",
        }),
      "TEST_COVERAGE_DRIFT",
    ],
    [
      APP_RECOVERY_TEST,
      () =>
        exactNameVoidTestStubs(runtimeTestNames, {
          callee: "it",
          module: "vitest",
          suite: "M07-T08 restart recovery",
        }),
      "TEST_COVERAGE_DRIFT",
    ],
    [
      ROOT_TEST,
      () =>
        oneExecutableTestWithCommentSpoofs(rootTestNames, {
          callee: "test",
          module: "node:test",
        }),
      "TEST_COVERAGE_DRIFT",
    ],
    [
      ROOT_TEST,
      () =>
        exactNameVoidTestStubs(rootTestNames, {
          callee: "test",
          module: "node:test",
        }),
      "TEST_COVERAGE_DRIFT",
    ],
    [
      APP_RECOVERY_TYPE_TEST,
      () =>
        `const inert = 0;\n/*\n${typeClaims
          .map((claim) => `@ts-expect-error ${claim}`)
          .join("\n")}\n*/\nvoid inert;\n`,
      "TEST_COVERAGE_DRIFT",
    ],
    [
      ADR,
      (source) =>
        source.replace(
          "# ADR 0014: Reconstruct runtime authority from an unchanged durable record",
          "# ADR 0014: Removed decision",
        ),
      "DOCUMENTATION_DRIFT",
    ],
  ];
  for (const [relativePath, transform, code] of cases) {
    const current = (await workspaceBytes(relativePath)).toString("utf8");
    const changed = transform(current);
    assert.notEqual(changed, current, `${relativePath} mutation must change its authority`);
    await assert.rejects(
      buildControlPlaneRuntimeRecoveryEvidence({
        runtimeReceipt: runtimeReceipt(),
        trackedFileBytes: { [relativePath]: Buffer.from(changed, "utf8") },
      }),
      expectedError(code),
    );
  }
});

test("[artifact] verifies exact bytes and rejects one changed byte", async () => {
  const verified = await verifyControlPlaneRuntimeRecoveryEvidence({
    artifactBytes: built.artifactBytes,
    proofDocument: exactProofDocument(built.artifactSha256),
    runtimeReceipt: runtimeReceipt(),
  });
  assert.deepEqual(verified, {
    task: "M07-T08",
    result: "PASS",
    artifactSha256: built.artifactSha256,
    packageRuntimeCases: built.artifact.tests.packageRuntimeCases,
    compileTimeNegativeCases: built.artifact.tests.compileTimeNegativeCases,
    rootMutationCases: 9,
    prerequisiteArtifacts: 4,
    traceRows: 2,
  });
  await assert.rejects(
    verifyControlPlaneRuntimeRecoveryEvidence({
      artifactBytes: changedByte(built.artifactBytes),
      proofDocument: exactProofDocument(built.artifactSha256),
      runtimeReceipt: runtimeReceipt(),
    }),
    expectedError("ARTIFACT_DRIFT"),
  );
  const proofDocument = exactProofDocument(built.artifactSha256);
  for (const candidate of [
    proofDocument.replace(built.artifactSha256, "0".repeat(64)),
    proofDocument.replace(`Artifact: \`${ARTIFACT}\``, "Artifact: `wrong.json`"),
    `${proofDocument}\n${proofDocument}`,
    "# No final proof pin\n",
  ]) {
    await assert.rejects(
      verifyControlPlaneRuntimeRecoveryEvidence({
        artifactBytes: built.artifactBytes,
        proofDocument: candidate,
        runtimeReceipt: runtimeReceipt(),
      }),
      expectedError("PROOF_PIN_DRIFT"),
    );
  }
});

test("[writer] atomically writes deterministic evidence and preserves an old destination on failure", async () => {
  const directory = await makeTemporaryDirectory("desen-m07-t08-writer-");
  const artifactPath = path.join(directory, "artifact.json");
  const result = await writeControlPlaneRuntimeRecoveryEvidence({ artifactPath });
  assert.equal(result.artifactSha256, built.artifactSha256);
  assert.deepEqual(await readFile(artifactPath), built.artifactBytes);
  const oldBytes = Buffer.from("old-recovery-authority\n");
  await writeFile(artifactPath, oldBytes);
  await assert.rejects(
    writeControlPlaneRuntimeRecoveryEvidence({
      artifactPath,
      beforeAtomicRename: async ({ temporaryPath }) => {
        await writeFile(temporaryPath, Buffer.from("tampered\n"));
      },
    }),
    expectedError("ARTIFACT_WRITE_FAILED"),
  );
  assert.deepEqual(await readFile(artifactPath), oldBytes);
  assert.deepEqual(await readdir(directory), ["artifact.json"]);
});

test("[options] rejects unknown, accessor-backed, proxy, and shared-memory inputs", async () => {
  await assert.rejects(
    buildControlPlaneRuntimeRecoveryEvidence({ unknown: true }),
    expectedError("INVALID_OPTIONS"),
  );
  const active = {};
  Object.defineProperty(active, "runtimeReceipt", {
    enumerable: true,
    get() {
      throw new Error("must not execute");
    },
  });
  await assert.rejects(
    buildControlPlaneRuntimeRecoveryEvidence(active),
    expectedError("INVALID_OPTIONS"),
  );
  await assert.rejects(
    buildControlPlaneRuntimeRecoveryEvidence(new Proxy({}, {})),
    expectedError("INVALID_OPTIONS"),
  );
  await assert.rejects(
    verifyControlPlaneRuntimeRecoveryEvidence({
      artifactBytes: new Uint8Array(new SharedArrayBuffer(1)),
      proofDocument: exactProofDocument(built.artifactSha256),
      runtimeReceipt: runtimeReceipt(),
    }),
    expectedError("INVALID_OPTIONS"),
  );

  let getterHits = 0;
  const accessorReceipt = runtimeReceipt();
  Object.defineProperty(accessorReceipt.recovered, "status", {
    enumerable: true,
    get() {
      getterHits += 1;
      return "recovered";
    },
  });
  await assert.rejects(
    buildControlPlaneRuntimeRecoveryEvidence({ runtimeReceipt: accessorReceipt }),
    expectedError("INVALID_OPTIONS"),
  );
  assert.equal(getterHits, 0);

  let proxyTraps = 0;
  const proxyReceipt = runtimeReceipt();
  proxyReceipt.recovered = new Proxy(proxyReceipt.recovered, {
    getPrototypeOf(target) {
      proxyTraps += 1;
      return Reflect.getPrototypeOf(target);
    },
    ownKeys(target) {
      proxyTraps += 1;
      return Reflect.ownKeys(target);
    },
  });
  await assert.rejects(
    buildControlPlaneRuntimeRecoveryEvidence({ runtimeReceipt: proxyReceipt }),
    expectedError("INVALID_OPTIONS"),
  );
  assert.equal(proxyTraps, 0);

  let toJsonHits = 0;
  const toJsonReceipt = runtimeReceipt();
  toJsonReceipt.recovered.toJSON = () => {
    toJsonHits += 1;
    return {};
  };
  await assert.rejects(
    buildControlPlaneRuntimeRecoveryEvidence({ runtimeReceipt: toJsonReceipt }),
    expectedError("INVALID_OPTIONS"),
  );
  assert.equal(toJsonHits, 0);

  const cyclicReceipt = runtimeReceipt();
  cyclicReceipt.recovered.cycle = cyclicReceipt.recovered;
  await assert.rejects(
    buildControlPlaneRuntimeRecoveryEvidence({ runtimeReceipt: cyclicReceipt }),
    expectedError("INVALID_OPTIONS"),
  );

  const authorityDirectory = await makeTemporaryDirectory("desen-m07-t08-authority-");
  const realParent = path.join(authorityDirectory, "real-parent");
  const linkedParent = path.join(authorityDirectory, "linked-parent");
  await mkdir(realParent);
  await writeFile(path.join(realParent, "artifact.json"), built.artifactBytes);
  await symlink(realParent, linkedParent);
  await assert.rejects(
    verifyControlPlaneRuntimeRecoveryEvidence({
      artifactPath: path.join(linkedParent, "artifact.json"),
      proofDocument: exactProofDocument(built.artifactSha256),
      runtimeReceipt: runtimeReceipt(),
    }),
    expectedError("UNSAFE_AUTHORITY"),
  );

  const growingAuthority = path.join(authorityDirectory, "growing.json");
  await writeFile(growingAuthority, built.artifactBytes);
  await assert.rejects(
    readControlPlaneRuntimeRecoveryAuthorityForTest(growingAuthority, async ({ path: opened }) => {
      await appendFile(opened, Buffer.from("x", "utf8"));
    }),
    expectedError("UNSAFE_AUTHORITY"),
  );

  const sameSizeAuthority = path.join(authorityDirectory, "same-size.json");
  const sameSizeBefore = Buffer.from("AAAA", "utf8");
  const sameSizeAfter = Buffer.from("BBBB", "utf8");
  await writeFile(sameSizeAuthority, sameSizeBefore);
  await assert.rejects(
    readControlPlaneRuntimeRecoveryAuthorityForTest(sameSizeAuthority, async ({ path: opened }) => {
      await writeFile(opened, sameSizeAfter);
    }),
    expectedError("UNSAFE_AUTHORITY"),
  );

  const parentBeforeSwap = path.join(authorityDirectory, "parent-before-swap");
  const parentAfterSwap = path.join(authorityDirectory, "parent-after-swap");
  await mkdir(parentBeforeSwap);
  const parentSwapAuthority = path.join(parentBeforeSwap, "artifact.json");
  await writeFile(parentSwapAuthority, built.artifactBytes);
  await assert.rejects(
    readControlPlaneRuntimeRecoveryAuthorityForTest(parentSwapAuthority, async () => {
      await rename(parentBeforeSwap, parentAfterSwap);
      await symlink(parentAfterSwap, parentBeforeSwap);
    }),
    expectedError("UNSAFE_AUTHORITY"),
  );

  const boundedGrowthAuthority = path.join(authorityDirectory, "bounded-growth.json");
  await writeFile(boundedGrowthAuthority, Buffer.from("small", "utf8"));
  await assert.rejects(
    readControlPlaneRuntimeRecoveryAuthorityForTest(
      boundedGrowthAuthority,
      async ({ path: opened }) => {
        await truncate(opened, 32 * 1_024 * 1_024);
      },
    ),
    expectedError("UNSAFE_AUTHORITY"),
  );
});

test("[immutability] freezes the complete evidence graph and preserves later-task nonclaims", () => {
  assert.ok(Object.isFrozen(built));
  assert.ok(Object.isFrozen(built.artifact));
  assert.ok(Object.isFrozen(built.artifact.claims));
  assert.ok(Object.isFrozen(built.artifact.claims.durableStorage));
  assert.ok(Object.isFrozen(built.artifact.claims.registrations));
  assert.ok(Object.isFrozen(built.artifact.claims.registrations.publicExports.entries));
  assert.ok(Object.isFrozen(built.artifact.claims.authorityReconstruction));
  assert.ok(Object.isFrozen(built.artifact.trackedFiles));
  assert.ok(Object.isFrozen(built.runtimeReceipt));
  for (const task of ["M07-T09", "M07-T10", "M07-T11"]) {
    assert.ok(built.artifact.nonclaims.some((claim) => claim.includes(task)));
  }
  assert.ok(built.artifact.nonclaims.some((claim) => claim.includes("P-12")));
  assert.ok(built.artifact.nonclaims.some((claim) => claim.includes("anti-rollback")));
  assert.ok(built.artifact.nonclaims.some((claim) => claim.includes("Android")));
  assert.equal(JSON.stringify(built.artifact).includes("function"), false);
});
