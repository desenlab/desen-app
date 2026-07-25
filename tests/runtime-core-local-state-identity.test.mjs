import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  DEFAULT_RUNTIME_CORE_LOCAL_STATE_IDENTITY_ARTIFACT_PATH,
  RuntimeCoreLocalStateIdentityEvidenceError,
  buildRuntimeCoreLocalStateIdentityEvidence,
  verifyRuntimeCoreLocalStateIdentityEvidence,
  writeRuntimeCoreLocalStateIdentityEvidence,
} from "../scripts/lib/runtime-core-local-state-identity-proof.mjs";

const runtimeApi = await import("../packages/runtime-core/dist/index.js");
const localStateSourcePath = path.resolve(
  import.meta.dirname,
  "../packages/runtime-core/src/local-state.ts",
);
const identitySourcePath = path.resolve(
  import.meta.dirname,
  "../packages/runtime-core/src/node-identity.ts",
);
const packageTestPath = path.resolve(
  import.meta.dirname,
  "../packages/runtime-core/test/local-state-identity.test.ts",
);
const prerequisitePath = path.resolve(
  import.meta.dirname,
  "../docs/proof/artifacts/runtime-core-0.1.0-value-resolution.json",
);

function hasEvidenceCode(expectedCode) {
  return (error) => {
    assert.ok(error instanceof RuntimeCoreLocalStateIdentityEvidenceError);
    assert.equal(error.code, expectedCode);
    return true;
  };
}

test("accepts tracked deterministic M04-T06 local-state and identity evidence", async () => {
  const result = await verifyRuntimeCoreLocalStateIdentityEvidence();

  assert.equal(result.result, "PASS");
  assert.equal(result.runtimeExports, 6);
  assert.equal(result.typeExports, 20);
  assert.equal(result.internalExports, 2);
  assert.equal(result.tsdocDeclarations, 28);
  assert.equal(result.validatorFacadeRuntimeExports, 1);
  assert.equal(result.validatorFacadeTypeExports, 2);
  assert.equal(result.validatorFacadeTsdocDeclarations, 3);
  assert.equal(result.packageTests, 33);
  assert.equal(result.compilerNegativeCases, 7);
  assert.equal(result.rootMutationTests, 13);
  assert.equal(result.traceRules, 4);
  assert.equal(result.normativeRules, 1);
  assert.equal(result.trackedFiles, 25);
  assert.equal(result.mountProbes, 6);
  assert.equal(result.readProbes, 3);
  assert.equal(result.acceptedWriteProbes, 3);
  assert.equal(result.rejectedWriteProbes, 7);
  assert.equal(result.completeValidationProbes, 3);
  assert.equal(result.schemaSyntaxProbes, 1);
  assert.equal(result.schemaProfileProbes, 2);
  assert.equal(result.resolvedValueProbes, 1);
  assert.equal(result.pf019Probes, 2);
  assert.equal(result.noOpProbes, 1);
  assert.equal(result.atomicityProbes, 4);
  assert.equal(result.disposalProbes, 5);
  assert.equal(result.identityCreationProbes, 2);
  assert.equal(result.identityPreservationProbes, 1);
  assert.equal(result.identityRemountProbes, 1);
  assert.equal(result.identityReplacementProbes, 1);
  assert.equal(result.identityRejectionProbes, 3);
  assert.equal(result.capabilitySafetyProbes, 1);
  assert.equal(result.hostileInputProbes, 1);
  assert.equal(result.platformEffects, 0);
  assert.match(result.artifactSha256, /^[0-9a-f]{64}$/u);
});

test("two independent local-state and identity evidence builds are byte-identical", async () => {
  const first = await buildRuntimeCoreLocalStateIdentityEvidence({
    verifyPrerequisite: false,
  });
  const second = await buildRuntimeCoreLocalStateIdentityEvidence({
    verifyPrerequisite: false,
  });

  assert.equal(first.artifactSha256, second.artifactSha256);
  assert.deepEqual(first.artifactBytes, second.artifactBytes);
});

test("rejects stale or one-byte-tampered local-state and identity evidence", async () => {
  const pristine = await buildRuntimeCoreLocalStateIdentityEvidence({
    verifyPrerequisite: false,
  });
  const tampered = Buffer.from(pristine.artifactBytes);
  tampered[tampered.length - 2] ^= 1;

  await assert.rejects(
    verifyRuntimeCoreLocalStateIdentityEvidence({
      artifactBytes: tampered,
      buildOptions: { verifyPrerequisite: false },
    }),
    hasEvidenceCode("LOCAL_STATE_IDENTITY_ARTIFACT_DRIFT"),
  );
});

test("rejects mount, read, write, dispose, no-op, PF-019, and atomicity semantic drift", async () => {
  const mutations = [
    {
      ...runtimeApi,
      mountRuntimeSurfaceState(input) {
        if (input?.surfaceId === "proof-surface") {
          return {
            status: "invalid",
            reason: "malformed-surface-id",
            entryName: null,
            pointer: "",
            issues: [],
          };
        }
        return runtimeApi.mountRuntimeSurfaceState(input);
      },
    },
    {
      ...runtimeApi,
      readRuntimeSurfaceState(handle) {
        const result = runtimeApi.readRuntimeSurfaceState(handle);
        return result.status === "active"
          ? { status: "disposed", surfaceId: handle.surfaceId }
          : result;
      },
    },
    {
      ...runtimeApi,
      writeRuntimeSurfaceState(handle, input) {
        if (input?.path === "profile.name") {
          const read = runtimeApi.readRuntimeSurfaceState(handle);
          return { status: "unchanged", snapshot: read.snapshot };
        }
        return runtimeApi.writeRuntimeSurfaceState(handle, input);
      },
    },
    {
      ...runtimeApi,
      writeRuntimeSurfaceState(handle, input) {
        const result = runtimeApi.writeRuntimeSurfaceState(handle, input);
        if (result.status === "unchanged") {
          return { status: "updated", snapshot: { ...result.snapshot, generation: 99 } };
        }
        return result;
      },
    },
    {
      ...runtimeApi,
      writeRuntimeSurfaceState(handle, input) {
        if (input?.path === "profile.mode") {
          const read = runtimeApi.readRuntimeSurfaceState(handle);
          return { status: "updated", snapshot: read.snapshot };
        }
        return runtimeApi.writeRuntimeSurfaceState(handle, input);
      },
    },
    {
      ...runtimeApi,
      disposeRuntimeSurfaceState(handle) {
        const result = runtimeApi.disposeRuntimeSurfaceState(handle);
        return result.status === "disposed"
          ? { status: "already-disposed", surfaceId: result.surfaceId }
          : result;
      },
    },
    {
      ...runtimeApi,
      mountRuntimeSurfaceState(input) {
        const hasVocabulary = Object.values(input?.state ?? {}).some(
          (entry) => entry?.schema && Object.hasOwn(entry.schema, "$vocabulary"),
        );
        if (hasVocabulary) {
          return {
            status: "mounted",
            handle: { surfaceId: input.surfaceId },
            snapshot: { surfaceId: input.surfaceId, generation: 0, values: {} },
          };
        }
        return runtimeApi.mountRuntimeSurfaceState(input);
      },
    },
  ];
  for (const changedApi of mutations) {
    await assert.rejects(
      buildRuntimeCoreLocalStateIdentityEvidence({
        runtimeApi: changedApi,
        verifyPrerequisite: false,
      }),
      hasEvidenceCode("LOCAL_STATE_IDENTITY_RUNTIME_BEHAVIOR_DRIFT"),
    );
  }
});

test("rejects stable headless node-identity semantic drift", async () => {
  const mutations = [
    {
      ...runtimeApi,
      createRuntimeNodeIdentity(descriptor) {
        const result = runtimeApi.createRuntimeNodeIdentity(descriptor);
        return result.status === "created"
          ? { ...result, identity: { ...result.identity, key: "node-only" } }
          : result;
      },
    },
    {
      ...runtimeApi,
      reconcileRuntimeNodeIdentity(identity, descriptor) {
        const result = runtimeApi.reconcileRuntimeNodeIdentity(identity, descriptor);
        return result.status === "preserve-eligible"
          ? { ...result, identity: { ...result.identity } }
          : result;
      },
    },
    {
      ...runtimeApi,
      reconcileRuntimeNodeIdentity(identity, descriptor) {
        if (descriptor?.use !== identity?.use) {
          return { status: "preserve-eligible", identity };
        }
        return runtimeApi.reconcileRuntimeNodeIdentity(identity, descriptor);
      },
    },
    {
      ...runtimeApi,
      reconcileRuntimeNodeIdentity(identity, descriptor) {
        if (descriptor?.surfaceId !== identity?.surfaceId) {
          return { status: "preserve-eligible", identity };
        }
        return runtimeApi.reconcileRuntimeNodeIdentity(identity, descriptor);
      },
    },
    {
      ...runtimeApi,
      createRuntimeNodeIdentity(descriptor) {
        if (descriptor?.use?.endsWith("/")) {
          return {
            status: "created",
            identity: {
              key: "unsafe",
              ...descriptor,
              mountGeneration: 0,
            },
          };
        }
        return runtimeApi.createRuntimeNodeIdentity(descriptor);
      },
    },
  ];
  for (const changedApi of mutations) {
    await assert.rejects(
      buildRuntimeCoreLocalStateIdentityEvidence({
        runtimeApi: changedApi,
        verifyPrerequisite: false,
      }),
      hasEvidenceCode("LOCAL_STATE_IDENTITY_RUNTIME_BEHAVIOR_DRIFT"),
    );
  }
});

test("rejects complete resolved-value validation and source invariant drift", async () => {
  const source = await readFile(localStateSourcePath, "utf8");
  const identitySource = await readFile(identitySourcePath, "utf8");
  const mutations = [
    source.replace("const syntaxFailures = syntaxIssues(schema);", "const syntaxFailures = [];"),
    source.replace('Object.hasOwn(current.schema, "$vocabulary")', "false"),
    source.replace('"complete",\n      "resolved-value"', '"partial",\n      "obligation"'),
    source.replace('const segments = path.split(".");', "const segments = [path];"),
    source.replace(
      "canonicalizeJson(nextEntry) === canonicalizeJson(currentEntry)",
      "canonicalizeJson(nextEntry) !== canonicalizeJson(currentEntry)",
    ),
  ];
  for (const changedSource of mutations) {
    await assert.rejects(
      buildRuntimeCoreLocalStateIdentityEvidence({
        fileOverrides: { "packages/runtime-core/src/local-state.ts": changedSource },
        verifyPrerequisite: false,
      }),
      hasEvidenceCode("LOCAL_STATE_IDENTITY_SOURCE_SEMANTIC_DRIFT"),
    );
  }
  await assert.rejects(
    buildRuntimeCoreLocalStateIdentityEvidence({
      fileOverrides: {
        "packages/runtime-core/src/node-identity.ts": identitySource.replace(
          "previousIdentity.use === descriptor.use",
          "previousIdentity.use !== descriptor.use",
        ),
      },
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("LOCAL_STATE_IDENTITY_SOURCE_SEMANTIC_DRIFT"),
  );
});

test("rejects public export, TSDoc, platform, and distribution drift", async () => {
  const source = await readFile(localStateSourcePath, "utf8");
  const mutations = [
    {
      path: "packages/runtime-core/src/local-state.ts",
      value: `${source}\n/** Drift. */\nexport function leakedStateApi() {}\n`,
      code: "LOCAL_STATE_IDENTITY_SOURCE_EXPORT_DRIFT",
    },
    {
      path: "packages/runtime-core/src/local-state.ts",
      value: source.replace(
        "/** One protocol state declaration",
        "/* One protocol state declaration",
      ),
      code: "LOCAL_STATE_IDENTITY_TSDOC_MISSING",
    },
    {
      path: "packages/runtime-core/src/local-state.ts",
      value: `${source}\nconst platformLeak = window;\nvoid platformLeak;\n`,
      code: "LOCAL_STATE_IDENTITY_PLATFORM_BOUNDARY_DRIFT",
    },
    {
      path: "packages/runtime-core/dist/local-state.js",
      value: "export function wrongBuiltStateApi() {}\n",
      code: "LOCAL_STATE_IDENTITY_DISTRIBUTION_DRIFT",
    },
  ];
  for (const mutation of mutations) {
    await assert.rejects(
      buildRuntimeCoreLocalStateIdentityEvidence({
        fileOverrides: { [mutation.path]: mutation.value },
        verifyPrerequisite: false,
      }),
      hasEvidenceCode(mutation.code),
    );
  }
});

test("rejects validator subpath and runtime dependency seam drift", async () => {
  const validatorWrapperJavaScript = await readFile(
    path.resolve(import.meta.dirname, "../packages/validator/schema-contract-syntax.js"),
    "utf8",
  );
  const validatorWrapperDeclaration = await readFile(
    path.resolve(import.meta.dirname, "../packages/validator/schema-contract-syntax.d.ts"),
    "utf8",
  );
  const validatorManifest = JSON.parse(
    await readFile(path.resolve(import.meta.dirname, "../packages/validator/package.json"), "utf8"),
  );
  const validatorRootManifest = structuredClone(validatorManifest);
  const validatorSyntaxManifest = structuredClone(validatorManifest);
  const validatorFilesManifest = structuredClone(validatorManifest);
  validatorRootManifest.exports["."].import = "./dist/changed-index.js";
  validatorManifest.exports["./schema-contract"].import = "./dist/index.js";
  validatorSyntaxManifest.exports["./schema-contract-syntax"].import = "./dist/index.js";
  validatorFilesManifest.files = validatorFilesManifest.files.filter(
    (entry) => entry !== "schema-contract-syntax.js",
  );
  const runtimeManifest = JSON.parse(
    await readFile(
      path.resolve(import.meta.dirname, "../packages/runtime-core/package.json"),
      "utf8",
    ),
  );
  runtimeManifest.dependencies["@desen/validator"] = "^0.1.0";

  await assert.rejects(
    buildRuntimeCoreLocalStateIdentityEvidence({
      fileOverrides: {
        "packages/validator/package.json": JSON.stringify(validatorRootManifest),
      },
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("LOCAL_STATE_IDENTITY_VALIDATOR_SEAM_DRIFT"),
  );
  await assert.rejects(
    buildRuntimeCoreLocalStateIdentityEvidence({
      fileOverrides: {
        "packages/validator/package.json": JSON.stringify(validatorFilesManifest),
      },
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("LOCAL_STATE_IDENTITY_VALIDATOR_SEAM_DRIFT"),
  );
  await assert.rejects(
    buildRuntimeCoreLocalStateIdentityEvidence({
      fileOverrides: {
        "packages/validator/schema-contract-syntax.js": `${validatorWrapperJavaScript}\nexport const leakedRuntime = true;\n`,
      },
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("LOCAL_STATE_IDENTITY_VALIDATOR_SEAM_DRIFT"),
  );
  await assert.rejects(
    buildRuntimeCoreLocalStateIdentityEvidence({
      fileOverrides: {
        "packages/validator/schema-contract-syntax.d.ts": validatorWrapperDeclaration.replace(
          "/** One generated Draft 2020-12 meta-schema failure. */",
          "/* One generated Draft 2020-12 meta-schema failure. */",
        ),
      },
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("LOCAL_STATE_IDENTITY_VALIDATOR_SEAM_DRIFT"),
  );
  await assert.rejects(
    buildRuntimeCoreLocalStateIdentityEvidence({
      fileOverrides: { "packages/validator/package.json": JSON.stringify(validatorManifest) },
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("LOCAL_STATE_IDENTITY_VALIDATOR_SEAM_DRIFT"),
  );
  await assert.rejects(
    buildRuntimeCoreLocalStateIdentityEvidence({
      fileOverrides: {
        "packages/validator/package.json": JSON.stringify(validatorSyntaxManifest),
      },
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("LOCAL_STATE_IDENTITY_VALIDATOR_SEAM_DRIFT"),
  );
  await assert.rejects(
    buildRuntimeCoreLocalStateIdentityEvidence({
      fileOverrides: {
        "packages/runtime-core/package.json": JSON.stringify(runtimeManifest),
      },
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("LOCAL_STATE_IDENTITY_PACKAGE_CONTRACT_DRIFT"),
  );
});

test("rejects package, root wiring, skipped tests, and conditional registration drift", async () => {
  const packageTests = await readFile(packageTestPath, "utf8");
  const rootTests = await readFile(new URL(import.meta.url), "utf8");
  const packageManifest = JSON.parse(
    await readFile(
      path.resolve(import.meta.dirname, "../packages/runtime-core/package.json"),
      "utf8",
    ),
  );
  packageManifest.scripts["test:local-state-identity"] = "vitest run test/value-resolution.test.ts";
  const rootManifest = JSON.parse(
    await readFile(path.resolve(import.meta.dirname, "../package.json"), "utf8"),
  );
  rootManifest.scripts["verify:runtime-core-local-state-identity"] =
    "node scripts/verify-runtime-core-local-state-identity.mjs";

  for (const fileOverrides of [
    { "packages/runtime-core/package.json": JSON.stringify(packageManifest) },
    { "package.json": JSON.stringify(rootManifest) },
    {
      "packages/runtime-core/test/local-state-identity.test.ts": packageTests.replace(
        'it("mounts all initials atomically',
        'it.skip("mounts all initials atomically',
      ),
    },
    {
      "tests/runtime-core-local-state-identity.test.mjs": rootTests.replace(
        'test("accepts tracked deterministic',
        'test.skip("accepts tracked deterministic',
      ),
    },
  ]) {
    await assert.rejects(
      buildRuntimeCoreLocalStateIdentityEvidence({
        fileOverrides,
        verifyPrerequisite: false,
      }),
      (error) =>
        error instanceof RuntimeCoreLocalStateIdentityEvidenceError &&
        [
          "LOCAL_STATE_IDENTITY_PACKAGE_CONTRACT_DRIFT",
          "LOCAL_STATE_IDENTITY_ROOT_SCRIPT_DRIFT",
          "LOCAL_STATE_IDENTITY_TEST_INVENTORY_DRIFT",
        ].includes(error.code),
    );
  }
});

test("rejects trace, PF-036, N-024, and proof-document drift", async () => {
  const mutations = [
    {
      path: "docs/proof/protocol-0.1.0-traceability.json",
      mutate: (text) => text.replace('"owners": ["M04-T06"]', '"owners": ["M04-T16"]'),
      code: "LOCAL_STATE_IDENTITY_TRACE_DRIFT",
    },
    {
      path: "docs/plan/PROTOCOL-FINDINGS.md",
      mutate: (text) =>
        text.replace(
          "no\n  longest-prefix or backtracking lookup occurs",
          "a\n  longest-prefix lookup occurs",
        ),
      code: "LOCAL_STATE_IDENTITY_FINDING_DRIFT",
    },
    {
      path: "docs/proof/NORMATIVE-COVERAGE.md",
      mutate: (text) => text.replace(/^(\| N-024 \|.*?\| )TESTED(\s+\|)/mu, "$1PLANNED$2"),
      code: "LOCAL_STATE_IDENTITY_NORMATIVE_DRIFT",
    },
    {
      path: "docs/proof/RUNTIME-CORE-LOCAL-STATE-IDENTITY.md",
      mutate: (text) => text.replaceAll("writeRuntimeSurfaceState", "writeUnknownSurfaceState"),
      code: "LOCAL_STATE_IDENTITY_DOCUMENTATION_DRIFT",
    },
  ];
  for (const mutation of mutations) {
    const original = await readFile(path.resolve(import.meta.dirname, "..", mutation.path), "utf8");
    await assert.rejects(
      buildRuntimeCoreLocalStateIdentityEvidence({
        fileOverrides: { [mutation.path]: mutation.mutate(original) },
        verifyPrerequisite: false,
      }),
      hasEvidenceCode(mutation.code),
    );
  }
});

test("rejects stale injected M04-T02 prerequisite bytes", async () => {
  const bytes = await readFile(prerequisitePath);
  const tampered = Buffer.from(bytes);
  tampered[0] ^= 1;
  await assert.rejects(
    buildRuntimeCoreLocalStateIdentityEvidence({
      valueResolutionPrerequisiteArtifactBytes: tampered,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("LOCAL_STATE_IDENTITY_PREREQUISITE_DRIFT"),
  );
});

test("atomic local-state writer rejects symlink destinations", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-local-state-proof-symlink-"));
  try {
    const target = path.join(directory, "target.json");
    const destination = path.join(directory, "artifact.json");
    await writeFile(target, "{}\n");
    await symlink(target, destination);
    const evidence = await buildRuntimeCoreLocalStateIdentityEvidence({
      verifyPrerequisite: false,
    });

    await assert.rejects(
      writeRuntimeCoreLocalStateIdentityEvidence({
        artifactPath: destination,
        preparedEvidence: evidence,
        buildOptions: { verifyPrerequisite: false },
      }),
      /regular file/u,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("atomic local-state writer detects temporary-byte tampering before rename", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-local-state-proof-tamper-"));
  try {
    const destination = path.join(directory, "artifact.json");
    const evidence = await buildRuntimeCoreLocalStateIdentityEvidence({
      verifyPrerequisite: false,
    });

    await assert.rejects(
      writeRuntimeCoreLocalStateIdentityEvidence({
        artifactPath: destination,
        preparedEvidence: evidence,
        buildOptions: { verifyPrerequisite: false },
        beforeAtomicRename: async ({ temporaryPath }) => {
          await writeFile(temporaryPath, "{}\n");
        },
      }),
      /temporary bytes changed/u,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

assert.equal(
  path.basename(DEFAULT_RUNTIME_CORE_LOCAL_STATE_IDENTITY_ARTIFACT_PATH),
  "runtime-core-0.1.0-local-state-identity.json",
);
