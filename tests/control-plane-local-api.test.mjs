import assert from "node:assert/strict";
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
import { after, before, test } from "node:test";

import {
  CONTROL_PLANE_LOCAL_API_PREREQUISITE_PINS,
  DEFAULT_CONTROL_PLANE_LOCAL_API_ARTIFACT_PATH,
  ControlPlaneLocalApiEvidenceError,
  buildControlPlaneLocalApiEvidence,
  runControlPlaneLocalApiProbe,
  verifyControlPlaneLocalApiEvidence,
  writeControlPlaneLocalApiEvidence,
} from "../scripts/lib/control-plane-local-api-proof.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const ARTIFACT = "docs/proof/artifacts/control-plane-api-0.1.0-local-api.json";
const ADR = "docs/adr/0012-local-control-plane-transport-and-metadata.md";
const TRACEABILITY = "docs/proof/protocol-0.1.0-traceability.json";
const APP_PACKAGE = "apps/control-plane-api/package.json";
const APP_INDEX = "apps/control-plane-api/src/index.ts";
const APP_CONTRACT = "apps/control-plane-api/src/local-control-plane-contract.ts";
const APP_INTERNAL = "apps/control-plane-api/src/local-control-plane-internal.ts";
const APP_REPOSITORY = "apps/control-plane-api/src/local-control-plane-repository-internal.ts";
const APP_SQLITE = "apps/control-plane-api/src/local-control-plane-sqlite-internal.ts";
const APP_FACTORY = "apps/control-plane-api/src/local-control-plane.ts";
const APP_STRICT_JSON = "apps/control-plane-api/src/strict-json-internal.ts";
const APP_RUNTIME_TEST = "apps/control-plane-api/test/local-control-plane.test.ts";
const APP_TYPE_TEST = "apps/control-plane-api/test/local-control-plane.types.ts";
const ROOT_PACKAGE = "package.json";
const LOCKFILE = "pnpm-lock.yaml";
const CI_SOURCE = "scripts/run-ci-quality-gate.mjs";
const CI_INVENTORY = "scripts/ci/exhaustive-workload-inventory.mjs";
const SHARED_STATE_AUTHORITY = "scripts/ci/shared-state-authority.mjs";
const ROOT_TEST = "tests/control-plane-local-api.test.mjs";

let built;
let liveRuntimeReceipt;
let proofDocument;
const temporaryDirectories = [];

function expectedError(code) {
  return (error) => error instanceof ControlPlaneLocalApiEvidenceError && error.code === code;
}

async function workspaceBytes(relativePath) {
  return readFile(path.join(ROOT, relativePath));
}

function changedByte(bytes) {
  const copy = Uint8Array.from(bytes);
  copy[Math.floor(copy.byteLength / 2)] ^= 1;
  return copy;
}

function exactProofDocument(artifactSha256) {
  return [
    "# Test-only M07-T05 proof authority",
    "",
    `Artifact: \`${ARTIFACT}\``,
    "",
    `Final receipt: \`sha256:${artifactSha256}\``,
    "",
  ].join("\n");
}

async function makeTemporaryDirectory(prefix) {
  const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), prefix)));
  temporaryDirectories.push(directory);
  return directory;
}

async function trackedMutation(relativePath, transform) {
  const source = await workspaceBytes(relativePath);
  const sourceText = source.toString("utf8");
  const transformed = transform(sourceText);
  assert.notEqual(transformed, sourceText, `Mutation did not alter ${relativePath}`);
  return {
    trackedFileBytes: { [relativePath]: Buffer.from(transformed, "utf8") },
    runtimeReceipt: built.runtimeReceipt,
  };
}

function mutateTraceOwner(value, traceId) {
  if (Array.isArray(value)) {
    for (const child of value) mutateTraceOwner(child, traceId);
    return;
  }
  if (value !== null && typeof value === "object") {
    if (value.id === traceId && Array.isArray(value.owners)) {
      value.owners = value.owners.filter((owner) => owner !== "M07-T05");
    }
    for (const child of Object.values(value)) mutateTraceOwner(child, traceId);
  }
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

before(async () => {
  liveRuntimeReceipt = await runControlPlaneLocalApiProbe();
  built = await buildControlPlaneLocalApiEvidence({ runtimeReceipt: liveRuntimeReceipt });
  proofDocument = exactProofDocument(built.artifactSha256);
});

after(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

test("[authority] builds the exact versioned M07-T05 artifact and local API receipt", () => {
  assert.equal(DEFAULT_CONTROL_PLANE_LOCAL_API_ARTIFACT_PATH, path.join(ROOT, ARTIFACT));
  assert.equal(built.artifact.schemaVersion, 1);
  assert.equal(built.artifact.profile, "desen.control-plane.local-api-proof.v1");
  assert.equal(built.artifact.task, "M07-T05");
  assert.equal(built.artifact.result, "PASS");
  assert.equal(built.artifact.tests.packageRuntimeCases, 16);
  assert.equal(built.artifact.tests.compileTimeNegativeCases, 18);
  assert.equal(built.artifact.tests.rootMutationCases, 16);
  assert.match(built.artifactSha256, /^[0-9a-f]{64}$/u);
});

test("[determinism] two independent evidence builds produce byte-identical artifacts", async () => {
  const second = await buildControlPlaneLocalApiEvidence();
  assert.deepEqual(second.artifactBytes, built.artifactBytes);
  assert.equal(second.artifactSha256, built.artifactSha256);
  assert.notEqual(second.runtimeReceipt, built.runtimeReceipt);
});

test("[authority] verifies exact artifact bytes and one final proof-document pin", async () => {
  const result = await verifyControlPlaneLocalApiEvidence({
    artifactBytes: built.artifactBytes,
    proofDocument,
    runtimeReceipt: built.runtimeReceipt,
  });
  assert.equal(result.task, "M07-T05");
  assert.equal(result.result, "PASS");
  assert.equal(result.artifactSha256, built.artifactSha256);
  assert.equal(result.packageRuntimeCases, 16);
  assert.equal(result.compileTimeNegativeCases, 18);
  assert.equal(result.rootMutationCases, 16);
  assert.ok(Object.isFrozen(result));
});

test("[artifact] rejects one changed evidence byte", async () => {
  await assert.rejects(
    verifyControlPlaneLocalApiEvidence({
      artifactBytes: changedByte(built.artifactBytes),
      proofDocument,
      runtimeReceipt: built.runtimeReceipt,
    }),
    expectedError("ARTIFACT_DRIFT"),
  );
});

test("[proof] rejects pending, wrong, duplicate, or missing final pins", async () => {
  const variants = [
    proofDocument.replace(`sha256:${built.artifactSha256}`, "sha256:PENDING"),
    proofDocument.replace(built.artifactSha256, "0".repeat(64)),
    `${proofDocument}\n${proofDocument}`,
    "# no final pin\n",
  ];
  for (const candidate of variants) {
    await assert.rejects(
      verifyControlPlaneLocalApiEvidence({
        artifactBytes: built.artifactBytes,
        proofDocument: candidate,
        runtimeReceipt: built.runtimeReceipt,
      }),
      expectedError("PROOF_PIN_DRIFT"),
    );
  }
});

test("[prerequisites] rejects one changed byte in the exact M07-T01 prerequisite", async () => {
  assert.equal(CONTROL_PLANE_LOCAL_API_PREREQUISITE_PINS.length, 1);
  for (const prerequisite of CONTROL_PLANE_LOCAL_API_PREREQUISITE_PINS) {
    await assert.rejects(
      buildControlPlaneLocalApiEvidence({
        prerequisiteBytes: {
          [prerequisite.path]: changedByte(await workspaceBytes(prerequisite.path)),
        },
        runtimeReceipt: built.runtimeReceipt,
      }),
      expectedError("PREREQUISITE_DRIFT"),
    );
  }
});

test("[implementation] rejects transport, repository, SQLite, or public-factory source drift", async () => {
  const mutations = [
    [
      APP_CONTRACT,
      (source) => source.replace("readonly rootDirectory: string;", "readonly directory: string;"),
    ],
    [APP_INTERNAL, (source) => source.replace("trustProxy: false,", "trustProxy: true,")],
    [
      APP_REPOSITORY,
      (source) =>
        source.replace(
          "current.generation !== expectedGeneration",
          "current.generation < expectedGeneration",
        ),
    ],
    [
      APP_SQLITE,
      (source) => source.replace('database.pragma("synchronous = FULL")', "void database"),
    ],
    [
      APP_FACTORY,
      (source) =>
        source.replace(
          "path.join(canonicalRoot, METADATA_FILE_NAME)",
          "path.join(captured.rootDirectory, METADATA_FILE_NAME)",
        ),
    ],
    [
      APP_STRICT_JSON,
      (source) =>
        source.replace(
          'return { kind: "duplicate", path: memberPath };',
          'return { kind: "invalid", path: memberPath };',
        ),
    ],
    [ADR, (source) => source.replace("32–256", "32–255")],
  ];
  for (const [relativePath, transform] of mutations) {
    await assert.rejects(
      buildControlPlaneLocalApiEvidence(await trackedMutation(relativePath, transform)),
      expectedError("IMPLEMENTATION_DRIFT"),
    );
  }
});

test("[registration] rejects package-root, package-script, aggregate, or CI tuple drift", async () => {
  const mutations = [
    [APP_PACKAGE, (source) => source.replace('"test:local-api":', '"test:local-api-removed":')],
    [
      APP_PACKAGE,
      (source) =>
        source.replace(
          '"test:runtime-fault-injection": "vitest run test/runtime-fault-injection.test.ts"',
          '"test:runtime-fault-injection": "vitest run test/runtime-fault-injection-decoy.test.ts"',
        ),
    ],
    [
      APP_PACKAGE,
      (source) =>
        source.replace(
          '"test:runtime-transition-races": "vitest run test/runtime-transition-races.test.ts"',
          '"test:runtime-transition-races": "vitest run test/runtime-transition-races-decoy.test.ts"',
        ),
    ],
    [
      APP_PACKAGE,
      (source) =>
        source.replace(
          '"@desen/runtime-core": "workspace:*",',
          '"@desen/runtime-core": "workspace:^",',
        ),
    ],
    [
      APP_INDEX,
      (source) =>
        source.replace(
          'export { openLocalControlPlane } from "./local-control-plane.js";',
          'export { openLocalControlPlane as openUnsafe } from "./local-control-plane.js";',
        ),
    ],
    [
      APP_INDEX,
      (source) =>
        source.replace(
          'export { openBundleRuntimeActivation } from "./runtime-activation.js";',
          'export { openBundleRuntimeActivation as openBundleRuntimeActivationUnsafe } from "./runtime-activation.js";',
        ),
    ],
    [
      APP_INDEX,
      (source) =>
        source.replace(
          'export { stageBundleRuntime } from "./runtime-staging.js";',
          'export { stageBundleRuntime as stageBundleRuntimeUnsafe } from "./runtime-staging.js";',
        ),
    ],
    [
      ROOT_PACKAGE,
      (source) =>
        source.replace(
          "pnpm verify:control-plane-local-api && pnpm verify:control-plane-runtime-staging",
          "pnpm verify:control-plane-runtime-staging",
        ),
    ],
    [
      ROOT_PACKAGE,
      (source) =>
        source.replace(
          "pnpm verify:control-plane-runtime-recovery && pnpm verify:control-plane-runtime-fault-injection",
          "pnpm verify:control-plane-runtime-recovery && pnpm verify:control-plane-runtime-fault-injection-decoy",
        ),
    ],
    [
      ROOT_PACKAGE,
      (source) =>
        source.replace(
          "pnpm verify:control-plane-runtime-fault-injection && pnpm verify:control-plane-runtime-transition-races",
          "pnpm verify:control-plane-runtime-fault-injection && pnpm verify:control-plane-runtime-transition-races-decoy",
        ),
    ],
    [
      ROOT_PACKAGE,
      (source) =>
        source.replace(
          "pnpm verify:control-plane-runtime-activation && pnpm verify:control-plane-runtime-recovery",
          "pnpm verify:control-plane-runtime-recovery",
        ),
    ],
    [CI_SOURCE, (source) => source.replace('"control-plane-local-api"', '"local-api-removed"')],
    [
      CI_SOURCE,
      (source) => source.replace('"control-plane-runtime-staging"', '"runtime-staging-removed"'),
    ],
    [CI_INVENTORY, (source) => source.replace('"control-plane-local-api"', '"local-api-removed"')],
    [
      CI_SOURCE,
      (source) =>
        source.replace(
          '      "control-plane-runtime-fault-injection",',
          '      "control-plane-runtime-fault-injection-decoy",',
        ),
    ],
    [
      CI_SOURCE,
      (source) =>
        source.replace(
          '      "control-plane-runtime-transition-races",',
          '      "control-plane-runtime-transition-races-decoy",',
        ),
    ],
    [
      CI_INVENTORY,
      (source) =>
        source.replace(
          '    "control-plane-runtime-fault-injection",',
          '    "control-plane-runtime-fault-injection-decoy",',
        ),
    ],
    [
      CI_INVENTORY,
      (source) =>
        source.replace(
          '    "control-plane-runtime-transition-races",',
          '    "control-plane-runtime-transition-races-decoy",',
        ),
    ],
    [
      CI_INVENTORY,
      (source) => source.replace('"control-plane-runtime-staging"', '"runtime-staging-removed"'),
    ],
    [
      LOCKFILE,
      (source) =>
        source.replace(
          "version: link:../../packages/runtime-core",
          "version: link:../../packages/runtime-core-drifted",
        ),
    ],
    [SHARED_STATE_AUTHORITY, (source) => source.replace('  "control-plane-runtime-staging",', "")],
    [
      SHARED_STATE_AUTHORITY,
      (source) =>
        source.replace(
          '  "control-plane-runtime-fault-injection",',
          '  "control-plane-runtime-fault-injection-decoy",',
        ),
    ],
    [
      SHARED_STATE_AUTHORITY,
      (source) =>
        source.replace(
          '  "control-plane-runtime-transition-races",',
          '  "control-plane-runtime-transition-races-decoy",',
        ),
    ],
  ];
  for (const [relativePath, transform] of mutations) {
    await assert.rejects(
      buildControlPlaneLocalApiEvidence(await trackedMutation(relativePath, transform)),
      expectedError("REGISTRATION_DRIFT"),
    );
  }

  const currentAppPackage = (await workspaceBytes(APP_PACKAGE)).toString("utf8");
  const historicalAppPackage = currentAppPackage.replace(
    '    "test:runtime-transition-races": "vitest run test/runtime-transition-races.test.ts",\n',
    "",
  );
  assert.notEqual(historicalAppPackage, currentAppPackage);
  await assert.rejects(
    buildControlPlaneLocalApiEvidence({
      trackedFileBytes: { [APP_PACKAGE]: Buffer.from(historicalAppPackage, "utf8") },
      runtimeReceipt: built.runtimeReceipt,
    }),
    expectedError("REGISTRATION_DRIFT"),
  );
});

test("[traceability] rejects owner or identity drift in the exact rows", async () => {
  const trace = JSON.parse(await workspaceBytes(TRACEABILITY));
  const traceIds = built.artifact.claims.traceRows.map(({ id }) => id);
  assert.deepEqual(traceIds, ["R-125"]);
  for (const traceId of traceIds) {
    const changed = structuredClone(trace);
    mutateTraceOwner(changed, traceId);
    await assert.rejects(
      buildControlPlaneLocalApiEvidence({
        trackedFileBytes: {
          [TRACEABILITY]: Buffer.from(`${JSON.stringify(changed, null, 2)}\n`, "utf8"),
        },
        runtimeReceipt: built.runtimeReceipt,
      }),
      expectedError("TRACEABILITY_DRIFT"),
    );
  }
});

test("[runtime] rejects changed Source, restart, two-instance CAS, Bundle/channel, or security receipts", async () => {
  const successorBuild = await buildControlPlaneLocalApiEvidence({
    runtimeReceipt: liveRuntimeReceipt,
  });
  assert.deepEqual(successorBuild.artifactBytes, built.artifactBytes);
  assert.ok(liveRuntimeReceipt.publicModuleKeys.includes("stageBundleRuntime"));
  assert.ok(liveRuntimeReceipt.publicModuleKeys.includes("openBundleRuntimeActivation"));
  assert.equal(built.runtimeReceipt.publicModuleKeys.includes("stageBundleRuntime"), false);
  assert.equal(
    built.runtimeReceipt.publicModuleKeys.includes("openBundleRuntimeActivation"),
    false,
  );
  const successorKeyMutations = [
    (receipt) => {
      receipt.publicModuleKeys = receipt.publicModuleKeys.filter(
        (key) => key !== "stageBundleRuntime",
      );
    },
    (receipt) => {
      receipt.publicModuleKeys = receipt.publicModuleKeys.filter(
        (key) => key !== "openBundleRuntimeActivation",
      );
    },
    (receipt) => {
      receipt.publicModuleKeys = [...receipt.publicModuleKeys, "unreviewedRuntimeExport"].sort();
    },
  ];
  for (const mutate of successorKeyMutations) {
    const receipt = structuredClone(liveRuntimeReceipt);
    mutate(receipt);
    await assert.rejects(
      buildControlPlaneLocalApiEvidence({ runtimeReceipt: receipt }),
      expectedError("RUNTIME_PROBE_MISMATCH"),
    );
  }
  const mutations = [
    (receipt) => {
      receipt.officialSource.firstReadExact = false;
    },
    (receipt) => {
      receipt.officialSource.restartExact = false;
    },
    (receipt) => {
      receipt.officialSource.twoInstanceCas.winners = 2;
    },
    (receipt) => {
      receipt.invalidBundles.first.inodePreserved = false;
    },
    (receipt) => {
      receipt.channel.activationFieldsAbsent = false;
    },
    (receipt) => {
      receipt.security.tokenRedacted = false;
    },
    (receipt) => {
      receipt.separation.activeRevisionPublic = true;
    },
  ];
  for (const mutate of mutations) {
    const receipt = structuredClone(built.runtimeReceipt);
    mutate(receipt);
    await assert.rejects(
      buildControlPlaneLocalApiEvidence({ runtimeReceipt: receipt }),
      expectedError("RUNTIME_PROBE_MISMATCH"),
    );
  }
});

test("[tests] rejects skipped focused cases or removed compile-time negatives", async () => {
  const runtimeSource = (await workspaceBytes(APP_RUNTIME_TEST)).toString("utf8");
  await assert.rejects(
    buildControlPlaneLocalApiEvidence({
      trackedFileBytes: {
        [APP_RUNTIME_TEST]: Buffer.from(runtimeSource.replaceAll("it(", "it.skip("), "utf8"),
      },
      runtimeReceipt: built.runtimeReceipt,
    }),
    expectedError("TEST_AUTHORITY_DRIFT"),
  );
  const typeSource = (await workspaceBytes(APP_TYPE_TEST)).toString("utf8");
  await assert.rejects(
    buildControlPlaneLocalApiEvidence({
      trackedFileBytes: {
        [APP_TYPE_TEST]: Buffer.from(
          typeSource.replaceAll("// @ts-expect-error", "// removed"),
          "utf8",
        ),
      },
      runtimeReceipt: built.runtimeReceipt,
    }),
    expectedError("TEST_AUTHORITY_DRIFT"),
  );
  const rootSource = (await workspaceBytes(ROOT_TEST)).toString("utf8");
  await assert.rejects(
    buildControlPlaneLocalApiEvidence({
      trackedFileBytes: {
        [ROOT_TEST]: Buffer.from(rootSource.replaceAll('test("[', 'test.skip("['), "utf8"),
      },
      runtimeReceipt: built.runtimeReceipt,
    }),
    expectedError("TEST_AUTHORITY_DRIFT"),
  );
});

test("[filesystem] rejects symlinked artifact and proof-document authority", async () => {
  const directory = await makeTemporaryDirectory("desen-m07-t05-symlink-");
  const realArtifact = path.join(directory, "artifact.real.json");
  const artifactLink = path.join(directory, "artifact.json");
  const realProof = path.join(directory, "proof.real.md");
  const proofLink = path.join(directory, "proof.md");
  await writeFile(realArtifact, built.artifactBytes);
  await writeFile(realProof, proofDocument);
  await symlink(realArtifact, artifactLink);
  await symlink(realProof, proofLink);
  await assert.rejects(
    verifyControlPlaneLocalApiEvidence({
      artifactPath: artifactLink,
      proofDocument,
      runtimeReceipt: built.runtimeReceipt,
    }),
    expectedError("UNSAFE_AUTHORITY"),
  );
  await assert.rejects(
    verifyControlPlaneLocalApiEvidence({
      artifactBytes: built.artifactBytes,
      proofDocumentPath: proofLink,
      runtimeReceipt: built.runtimeReceipt,
    }),
    expectedError("UNSAFE_AUTHORITY"),
  );
  const realParent = path.join(directory, "real-parent");
  const linkedParent = path.join(directory, "linked-parent");
  await mkdir(realParent);
  await writeFile(path.join(realParent, "artifact.json"), built.artifactBytes);
  await symlink(realParent, linkedParent);
  await assert.rejects(
    verifyControlPlaneLocalApiEvidence({
      artifactPath: path.join(linkedParent, "artifact.json"),
      proofDocument,
      runtimeReceipt: built.runtimeReceipt,
    }),
    expectedError("UNSAFE_AUTHORITY"),
  );
});

test("[writer] atomically writes exact deterministic evidence bytes", async () => {
  const directory = await makeTemporaryDirectory("desen-m07-t05-writer-");
  const artifactPath = path.join(directory, "artifact.json");
  const result = await writeControlPlaneLocalApiEvidence({ artifactPath });
  assert.equal(result.artifactSha256, built.artifactSha256);
  assert.deepEqual(await readFile(artifactPath), built.artifactBytes);
  assert.ok(Object.isFrozen(result));
});

test("[writer] preserves the old destination and removes a tampered temporary", async () => {
  const directory = await makeTemporaryDirectory("desen-m07-t05-writer-tamper-");
  const artifactPath = path.join(directory, "artifact.json");
  const oldBytes = Buffer.from("old-authority\n");
  await writeFile(artifactPath, oldBytes);
  await assert.rejects(
    writeControlPlaneLocalApiEvidence({
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

test("[options] rejects unknown, accessor-backed, shared-memory, or hostile authority", async () => {
  await assert.rejects(
    buildControlPlaneLocalApiEvidence({ unknown: true }),
    expectedError("INVALID_OPTIONS"),
  );
  const active = {};
  Object.defineProperty(active, "runtimeReceipt", {
    enumerable: true,
    get() {
      throw new Error("must not execute");
    },
  });
  await assert.rejects(buildControlPlaneLocalApiEvidence(active), expectedError("INVALID_OPTIONS"));
  await assert.rejects(
    buildControlPlaneLocalApiEvidence(new Proxy({}, {})),
    expectedError("INVALID_OPTIONS"),
  );
  const shared = new Uint8Array(new SharedArrayBuffer(1));
  await assert.rejects(
    verifyControlPlaneLocalApiEvidence({
      artifactBytes: shared,
      proofDocument,
      runtimeReceipt: built.runtimeReceipt,
    }),
    expectedError("INVALID_OPTIONS"),
  );
  let hookObservations = 0;
  const hostileBytes = Uint8Array.from(built.artifactBytes);
  for (const key of ["buffer", "byteLength", "byteOffset", Symbol.iterator]) {
    Object.defineProperty(hostileBytes, key, {
      configurable: true,
      get() {
        hookObservations += 1;
        throw new Error("caller hook must stay inert");
      },
    });
  }
  const verified = await verifyControlPlaneLocalApiEvidence({
    artifactBytes: hostileBytes,
    proofDocument,
    runtimeReceipt: built.runtimeReceipt,
  });
  assert.equal(verified.result, "PASS");
  assert.equal(hookObservations, 0);
});

test("[immutability] freezes the evidence graph and preserves honest later-task nonclaims", () => {
  assert.ok(Object.isFrozen(built));
  assert.ok(deeplyFrozen(built.artifact));
  assert.ok(deeplyFrozen(built.runtimeReceipt));
  assert.ok(built.artifact.nonclaims.some((claim) => claim.includes("M07-T06")));
  assert.ok(built.artifact.nonclaims.some((claim) => claim.includes("M07-T07")));
  assert.ok(built.artifact.nonclaims.some((claim) => claim.includes("activation")));
  assert.equal(JSON.stringify(built.artifact).includes("function"), false);
});
