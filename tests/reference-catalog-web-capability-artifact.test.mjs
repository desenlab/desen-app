import assert from "node:assert/strict";
import {
  cp,
  lstat,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildReferenceCatalogWebCapabilityArtifactEvidence,
  DEFAULT_REFERENCE_CATALOG_WEB_CAPABILITY_ARTIFACT_PATH,
  DEFAULT_REFERENCE_CATALOG_WEB_CATALOG_PATH,
  ReferenceCatalogWebCapabilityArtifactEvidenceError,
  verifyReferenceCatalogWebDistributionInventory,
  verifyReferenceCatalogWebPackagePublicationSurface,
  verifyReferenceCatalogWebSelfReferenceExclusion,
  verifyReferenceCatalogWebCapabilityArtifactEvidence,
  verifyReferenceCatalogWebCapabilityArtifactOutputs,
  writeReferenceCatalogWebCapabilityArtifactEvidence,
} from "../scripts/lib/reference-catalog-web-capability-artifact-proof.mjs";

const TEST_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(TEST_DIRECTORY, "..");
const DIST_ROOT = path.join(WORKSPACE_ROOT, "packages/reference-catalog-web/dist");
const baselinePromise = buildReferenceCatalogWebCapabilityArtifactEvidence({
  verifyPrerequisite: false,
});

function expectEvidenceFailure(error, code) {
  assert.ok(error instanceof ReferenceCatalogWebCapabilityArtifactEvidenceError);
  if (code !== undefined) assert.equal(error.code, code);
  return true;
}

async function temporaryDirectory(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-m03-t10-proof-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

async function listRegularFiles(directory, segments = []) {
  const result = [];
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    const nextSegments = [...segments, entry.name];
    if (entry.isDirectory()) {
      result.push(...(await listRegularFiles(entryPath, nextSegments)));
    } else if (entry.isFile()) {
      result.push(`dist/${nextSegments.join("/")}`);
    }
  }
  return result;
}

test("accepts the tracked deterministic M03-T10 Catalog and proof outputs", async () => {
  const result = await verifyReferenceCatalogWebCapabilityArtifactEvidence();
  assert.equal(result.result, "PASS");
  assert.equal(result.provenanceMode, "tracked-defaults");
  assert.match(result.packageDigest, /^sha256:[a-f0-9]{64}$/u);
  assert.ok(result.inventoryFiles > 0);
  assert.ok(result.sourceMaps > 0);
});

test("rebuilds two isolated mini-workspaces as the exact workspace dist", async () => {
  const result = await baselinePromise;
  assert.equal(result.artifact.reproducibility.isolatedBuilds, 2);
  assert.equal(result.artifact.reproducibility.byteIdentical, true);
  assert.equal(result.artifact.reproducibility.workspaceDistExactMatch, true);
  assert.match(result.artifact.reproducibility.inventoryAggregateSha256, /^sha256:[a-f0-9]{64}$/u);
  assert.equal(result.artifact.prerequisite.result, "SKIPPED");
  assert.equal(result.artifact.evidence.provenance.mode, "injected-test");
});

test("publishes the exact final tuple without creating an M05 registry", async () => {
  const result = await baselinePromise;
  assert.deepEqual(result.artifact.identity, {
    id: "run.desen.reference.sign-in",
    version: "0.1.0",
    target: "web-react",
    protocol: "0.1.0",
  });
  assert.deepEqual(result.artifact.tuple, {
    id: "run.desen.reference.sign-in",
    version: "0.1.0",
    target: "web-react",
    packageDigest: result.artifact.digest.packageDigest,
  });
  assert.equal(Object.isFrozen(result.artifact.tuple), true);
  assert.equal(Object.isFrozen(result.catalog), true);
  assert.equal(result.artifact.catalog.components.length, 5);
  assert.deepEqual(result.artifact.catalog.operations, ["com.example.auth/signIn"]);
  assert.equal(result.artifact.capabilityComposition.executableRegistryCreated, false);
  assert.equal(result.artifact.capabilityComposition.runtimeAdapterRegistrationOwner, "M05");
});

test("covers every regular workspace dist file and its exact byte hash", async () => {
  const result = await baselinePromise;
  const actualPaths = await listRegularFiles(DIST_ROOT);
  const provenPaths = result.artifact.inventory.entries.map(({ path: entryPath }) => entryPath);
  assert.deepEqual(provenPaths, actualPaths);
  for (const entry of result.artifact.inventory.entries) {
    const bytes = await readFile(
      path.join(WORKSPACE_ROOT, "packages/reference-catalog-web", entry.path),
    );
    assert.equal(bytes.length, entry.bytes);
    assert.match(entry.sha256, /^sha256:[a-f0-9]{64}$/u);
  }
});

test("retains every JavaScript and declaration source-map byte", async () => {
  const result = await baselinePromise;
  const paths = new Set(result.artifact.inventory.entries.map(({ path: entryPath }) => entryPath));
  const maps = [...paths].filter((entryPath) => entryPath.endsWith(".map"));
  assert.equal(maps.length, result.artifact.reproducibility.sourceMaps.sourceMaps);
  for (const entryPath of paths) {
    if (entryPath.endsWith(".js") || entryPath.endsWith(".d.ts")) {
      assert.ok(paths.has(`${entryPath}.map`));
    }
  }
});

test("excludes the final digest and therefore its exact tuple from dist bytes", async () => {
  const result = await baselinePromise;
  assert.deepEqual(result.artifact.reproducibility.selfReferenceExclusion, {
    packageDigestBytesAbsent: true,
    exactTupleBytesAbsent: true,
    reason: "the exact tuple necessarily contains the absent packageDigest",
  });
  const forged = result.distributionInventory.map((entry, index) =>
    index === 0
      ? {
          ...entry,
          bytes: Buffer.concat([
            entry.bytes,
            Buffer.from(result.artifact.tuple.packageDigest, "ascii"),
          ]),
        }
      : entry,
  );
  assert.throws(
    () =>
      verifyReferenceCatalogWebSelfReferenceExclusion(forged, result.artifact.tuple.packageDigest),
    (error) =>
      expectEvidenceFailure(error, "REFERENCE_CAPABILITY_ARTIFACT_SELF_REFERENCE_DETECTED"),
  );
});

test("changes the digest for every artifact byte, path, and removal vector", async () => {
  const result = await baselinePromise;
  const files = result.artifact.inventory.files;
  assert.equal(result.artifact.mutations.byteVectors, files);
  assert.equal(result.artifact.mutations.pathVectors, files);
  assert.equal(result.artifact.mutations.removalVectors, files);
  assert.equal(result.artifact.mutations.additionVectors, 1);
  assert.equal(result.artifact.mutations.unsafePathRejections, 1);
  assert.equal(result.artifact.mutations.catalogSemanticVectors, 5);
  assert.equal(result.artifact.mutations.publishedSelfDigestRejections, 1);
  assert.equal(result.artifact.mutations.total, files * 3 + 8);
});

test("pins both published Catalog and proof presentation bytes", async () => {
  const result = await baselinePromise;
  const verification = verifyReferenceCatalogWebCapabilityArtifactOutputs({
    expected: result,
    artifactBytes: result.artifactBytes,
    catalogBytes: result.catalogBytes,
  });
  assert.equal(verification.result, "PASS");

  const artifactTamper = Buffer.from(result.artifactBytes);
  artifactTamper[artifactTamper.length - 2] ^= 1;
  assert.throws(
    () =>
      verifyReferenceCatalogWebCapabilityArtifactOutputs({
        expected: result,
        artifactBytes: artifactTamper,
        catalogBytes: result.catalogBytes,
      }),
    (error) => expectEvidenceFailure(error, "REFERENCE_CAPABILITY_ARTIFACT_PROOF_DRIFT"),
  );

  const catalogTamper = Buffer.from(result.catalogBytes);
  catalogTamper[catalogTamper.length - 2] ^= 1;
  assert.throws(
    () =>
      verifyReferenceCatalogWebCapabilityArtifactOutputs({
        expected: result,
        artifactBytes: result.artifactBytes,
        catalogBytes: catalogTamper,
      }),
    (error) => expectEvidenceFailure(error, "REFERENCE_CAPABILITY_ARTIFACT_CATALOG_DRIFT"),
  );
});

test("rejects unsafe or unknown build options without invoking accessors", async () => {
  let getterCalls = 0;
  const accessor = {};
  Object.defineProperty(accessor, "componentApi", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return {};
    },
  });
  for (const options of [
    accessor,
    Object.create({ componentApi: {} }),
    { [Symbol("componentApi")]: {} },
    { unknown: true },
    { verifyPrerequisite: "false" },
    { sourceDirectory: "relative" },
  ]) {
    await assert.rejects(buildReferenceCatalogWebCapabilityArtifactEvidence(options), (error) =>
      expectEvidenceFailure(error, "REFERENCE_CAPABILITY_ARTIFACT_OPTIONS_INVALID"),
    );
  }
  assert.equal(getterCalls, 0);
});

test("rejects missing or executable-registration API drift before building", async () => {
  await assert.rejects(
    buildReferenceCatalogWebCapabilityArtifactEvidence({
      componentApi: {},
      verifyPrerequisite: false,
    }),
    (error) => expectEvidenceFailure(error, "REFERENCE_CAPABILITY_ARTIFACT_PUBLIC_API_DRIFT"),
  );
  await assert.rejects(
    buildReferenceCatalogWebCapabilityArtifactEvidence({
      operationsApi: { signInOperationRegistration: () => undefined },
      verifyPrerequisite: false,
    }),
    (error) => expectEvidenceFailure(error, "REFERENCE_CAPABILITY_ARTIFACT_REGISTRATION_DRIFT"),
  );
});

test("rejects package publication or executable Catalog-loader drift", async () => {
  const packageManifest = JSON.parse(
    await readFile(
      path.join(WORKSPACE_ROOT, "packages/reference-catalog-web/package.json"),
      "utf8",
    ),
  );
  assert.deepEqual(verifyReferenceCatalogWebPackagePublicationSurface(packageManifest), {
    files: ["catalog.json", "dist"],
    exports: [
      ".",
      "./catalog.json",
      "./components",
      "./host-operations",
      "./operations",
      "./parity",
      "./tokens",
    ],
    export: "./catalog.json",
    target: "./catalog.json",
    executableLoader: false,
  });
  const mutations = [
    (manifest) => {
      manifest.files = ["dist"];
    },
    (manifest) => {
      manifest.exports["./catalog.json"] = "./dist/catalog-loader.js";
    },
    (manifest) => {
      manifest.exports["./loader"] = "./dist/catalog-loader.js";
    },
  ];
  for (const mutate of mutations) {
    const mutated = structuredClone(packageManifest);
    mutate(mutated);
    assert.throws(
      () => verifyReferenceCatalogWebPackagePublicationSurface(mutated),
      (error) =>
        expectEvidenceFailure(error, "REFERENCE_CAPABILITY_ARTIFACT_PACKAGE_SURFACE_DRIFT"),
    );
  }
});

test("rejects incomplete root task and aggregate quality-gate wiring", async (t) => {
  const directory = await temporaryDirectory(t);
  const rootPackage = JSON.parse(await readFile(path.join(WORKSPACE_ROOT, "package.json"), "utf8"));
  const mutations = [
    (manifest) => {
      manifest.scripts["verify:reference-catalog-web-capability-artifact"] =
        "node scripts/verify-reference-catalog-web-capability-artifact.mjs";
    },
    (manifest) => {
      manifest.scripts.test = manifest.scripts.test.replace(
        "pnpm test:reference-catalog-web-capability-artifact && ",
        "",
      );
    },
    (manifest) => {
      manifest.scripts.check = manifest.scripts.check.replace(
        "pnpm verify:reference-catalog-web-capability-artifact && ",
        "",
      );
    },
  ];
  for (const [index, mutate] of mutations.entries()) {
    const mutated = structuredClone(rootPackage);
    mutate(mutated);
    const rootPackagePath = path.join(directory, `package-${String(index)}.json`);
    await writeFile(rootPackagePath, `${JSON.stringify(mutated)}\n`);
    await assert.rejects(
      buildReferenceCatalogWebCapabilityArtifactEvidence({
        rootPackagePath,
        verifyPrerequisite: false,
      }),
      (error) => expectEvidenceFailure(error, "REFERENCE_CAPABILITY_ARTIFACT_COMMAND_WIRING_DRIFT"),
    );
  }
});

test("keeps unrelated root-script growth outside the task-owned evidence bytes", async (t) => {
  const directory = await temporaryDirectory(t);
  const rootPackage = JSON.parse(await readFile(path.join(WORKSPACE_ROOT, "package.json"), "utf8"));
  const baselineRootPackagePath = path.join(directory, "root-package-baseline.json");
  const grownRootPackagePath = path.join(directory, "root-package-grown.json");
  await writeFile(baselineRootPackagePath, `${JSON.stringify(rootPackage)}\n`);
  rootPackage.scripts["future:unrelated-root-task"] = "node future-root-task.mjs";
  await writeFile(grownRootPackagePath, `${JSON.stringify(rootPackage)}\n`);

  const [baseline, grown] = await Promise.all([
    buildReferenceCatalogWebCapabilityArtifactEvidence({
      rootPackagePath: baselineRootPackagePath,
      verifyPrerequisite: false,
    }),
    buildReferenceCatalogWebCapabilityArtifactEvidence({
      rootPackagePath: grownRootPackagePath,
      verifyPrerequisite: false,
    }),
  ]);
  assert.deepEqual(grown.artifactBytes, baseline.artifactBytes);
  assert.equal(
    baseline.artifact.evidence.trackedFiles.some(({ path: trackedPath }) => {
      return trackedPath === "package.json";
    }),
    false,
  );
});

test("rejects extra, missing, renamed, or symbolic-link dist output", async (t) => {
  const result = await baselinePromise;
  const cases = [
    async (distDirectory) => {
      await writeFile(path.join(distDirectory, "forged.bin"), "forged");
    },
    async (distDirectory) => {
      await unlink(path.join(distDirectory, result.distributionInventory[0].relativePath));
    },
    async (distDirectory) => {
      const original = path.join(distDirectory, result.distributionInventory[0].relativePath);
      await rename(original, `${original}.renamed`);
    },
    async (distDirectory) => {
      const original = path.join(distDirectory, result.distributionInventory[0].relativePath);
      await unlink(original);
      await symlink(path.join(DIST_ROOT, result.distributionInventory[0].relativePath), original);
    },
  ];
  for (const [index, mutate] of cases.entries()) {
    const owner = await temporaryDirectory(t);
    const distDirectory = path.join(owner, `dist-${String(index)}`);
    await cp(DIST_ROOT, distDirectory, { recursive: true, dereference: false });
    await mutate(distDirectory);
    await assert.rejects(
      verifyReferenceCatalogWebDistributionInventory({
        expected: result,
        distDirectory,
      }),
      (error) => expectEvidenceFailure(error),
    );
  }
});

test("writes and verifies custom Catalog and proof destinations", async (t) => {
  const result = await baselinePromise;
  const directory = await temporaryDirectory(t);
  const catalogPath = path.join(directory, "catalog.json");
  const artifactPath = path.join(directory, "proof.json");
  await writeReferenceCatalogWebCapabilityArtifactEvidence({
    catalogPath,
    artifactPath,
    preparedEvidence: result,
  });
  assert.deepEqual(await readFile(catalogPath), result.catalogBytes);
  assert.deepEqual(await readFile(artifactPath), result.artifactBytes);
  const catalogEntry = await lstat(catalogPath);
  const artifactEntry = await lstat(artifactPath);
  assert.ok(catalogEntry.isFile());
  assert.ok(artifactEntry.isFile());
  const verification = await verifyReferenceCatalogWebCapabilityArtifactEvidence({
    catalogPath,
    artifactPath,
    preparedEvidence: result,
  });
  assert.equal(verification.result, "PASS");
});

test("rejects temporary-byte substitution during either atomic output commit", async (t) => {
  const result = await baselinePromise;
  const directory = await temporaryDirectory(t);
  await assert.rejects(
    writeReferenceCatalogWebCapabilityArtifactEvidence({
      catalogPath: path.join(directory, "catalog.json"),
      artifactPath: path.join(directory, "proof.json"),
      preparedEvidence: result,
      beforeCatalogAtomicRename: async ({ temporaryPath }) => {
        await writeFile(temporaryPath, "tampered");
      },
    }),
    (error) => expectEvidenceFailure(error, "REFERENCE_CAPABILITY_ARTIFACT_WRITE_FAILED"),
  );

  await assert.rejects(
    writeReferenceCatalogWebCapabilityArtifactEvidence({
      catalogPath: path.join(directory, "second-catalog.json"),
      artifactPath: path.join(directory, "second-proof.json"),
      preparedEvidence: result,
      beforeArtifactAtomicRename: async ({ temporaryPath }) => {
        await writeFile(temporaryPath, "tampered");
      },
    }),
    (error) => expectEvidenceFailure(error, "REFERENCE_CAPABILITY_ARTIFACT_WRITE_FAILED"),
  );
});

test("rejects symbolic-link publication and verification destinations", async (t) => {
  const result = await baselinePromise;
  const directory = await temporaryDirectory(t);
  const target = path.join(directory, "target.json");
  const catalogPath = path.join(directory, "catalog.json");
  await writeFile(target, "existing");
  await symlink(target, catalogPath);
  await assert.rejects(
    writeReferenceCatalogWebCapabilityArtifactEvidence({
      catalogPath,
      artifactPath: path.join(directory, "proof.json"),
      preparedEvidence: result,
    }),
    (error) => expectEvidenceFailure(error, "REFERENCE_CAPABILITY_ARTIFACT_WRITE_FAILED"),
  );
  assert.equal(await readFile(target, "utf8"), "existing");
  const verifierProofPath = path.join(directory, "verifier-proof.json");
  await writeFile(verifierProofPath, result.artifactBytes);
  await assert.rejects(
    verifyReferenceCatalogWebCapabilityArtifactEvidence({
      catalogPath,
      artifactPath: verifierProofPath,
      preparedEvidence: result,
    }),
    (error) => expectEvidenceFailure(error, "REFERENCE_CAPABILITY_ARTIFACT_UNSAFE_PATH"),
  );
});

test("forbids injected bytes, hooks, or prepared evidence at both tracked defaults", async () => {
  const result = await baselinePromise;
  await assert.rejects(
    verifyReferenceCatalogWebCapabilityArtifactEvidence({
      artifactPath: DEFAULT_REFERENCE_CATALOG_WEB_CAPABILITY_ARTIFACT_PATH,
      catalogPath: DEFAULT_REFERENCE_CATALOG_WEB_CATALOG_PATH,
      artifactBytes: result.artifactBytes,
      catalogBytes: result.catalogBytes,
    }),
    (error) =>
      expectEvidenceFailure(error, "REFERENCE_CAPABILITY_ARTIFACT_NONDEFAULT_TRACKED_VERIFY"),
  );
  await assert.rejects(
    writeReferenceCatalogWebCapabilityArtifactEvidence({
      artifactPath: DEFAULT_REFERENCE_CATALOG_WEB_CAPABILITY_ARTIFACT_PATH,
      catalogPath: DEFAULT_REFERENCE_CATALOG_WEB_CATALOG_PATH,
      preparedEvidence: result,
    }),
    (error) =>
      expectEvidenceFailure(error, "REFERENCE_CAPABILITY_ARTIFACT_NONDEFAULT_TRACKED_WRITE"),
  );
});

test("rejects mixed tracked/staged targets and unsafe action options", async (t) => {
  const directory = await temporaryDirectory(t);
  await assert.rejects(
    verifyReferenceCatalogWebCapabilityArtifactEvidence({
      artifactPath: DEFAULT_REFERENCE_CATALOG_WEB_CAPABILITY_ARTIFACT_PATH,
      catalogPath: path.join(directory, "catalog.json"),
    }),
    (error) => expectEvidenceFailure(error, "REFERENCE_CAPABILITY_ARTIFACT_MIXED_OUTPUT_TARGETS"),
  );
  let getterCalls = 0;
  const accessor = {};
  Object.defineProperty(accessor, "catalogPath", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return path.join(directory, "catalog.json");
    },
  });
  await assert.rejects(verifyReferenceCatalogWebCapabilityArtifactEvidence(accessor), (error) =>
    expectEvidenceFailure(error, "REFERENCE_CAPABILITY_ARTIFACT_OPTIONS_INVALID"),
  );
  assert.equal(getterCalls, 0);
});
