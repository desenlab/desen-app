import assert from "node:assert/strict";
import { lstat, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  DEFAULT_REFERENCE_CATALOG_WEB_CAPABILITY_ARTIFACT_PATH,
  DEFAULT_REFERENCE_CATALOG_WEB_CATALOG_PATH,
  ReferenceCatalogWebCapabilityArtifactEvidenceError,
  buildReferenceCatalogWebCapabilityArtifactEvidence,
  verifyReferenceCatalogWebCapabilityArtifactEvidence,
  verifyReferenceCatalogWebCapabilityArtifactOutputs,
  verifyReferenceCatalogWebDistributionInventory,
  verifyReferenceCatalogWebPackagePublicationSurface,
  verifyReferenceCatalogWebSelfReferenceExclusion,
  writeReferenceCatalogWebCapabilityArtifactEvidence,
} from "../scripts/lib/reference-catalog-web-capability-artifact-proof.mjs";

const ARTIFACT_SHA256 = "4ddeee8d33ff718e1907a6402b7c2d10ef0769c872832a4cb056231441ae65e0";
const CATALOG_SHA256 = "3113e299e0bec65f19b823a712378592a57806116b1eadd902c0390906772279";
const PACKAGE_DIGEST = "sha256:4ebfc6209d4874f3798009c72c634d2f65e60f8b59d4a517f269380a8cec6d9e";

function historicalPackageManifest() {
  return {
    files: ["catalog.json", "dist"],
    exports: {
      ".": {
        types: "./dist/index.d.ts",
        import: "./dist/index.js",
      },
      "./catalog.json": "./catalog.json",
      "./components": {
        types: "./dist/components/index.d.ts",
        import: "./dist/components/index.js",
      },
      "./host-operations": {
        types: "./dist/host-operations/index.d.ts",
        import: "./dist/host-operations/index.js",
      },
      "./operations": {
        types: "./dist/operations/index.d.ts",
        import: "./dist/operations/index.js",
      },
      "./parity": {
        types: "./dist/parity/index.d.ts",
        import: "./dist/parity/index.js",
      },
      "./tokens": {
        types: "./dist/tokens/index.d.ts",
        import: "./dist/tokens/index.js",
      },
    },
  };
}

function hasEvidenceCode(expectedCode) {
  return (error) => {
    assert.ok(error instanceof ReferenceCatalogWebCapabilityArtifactEvidenceError);
    assert.equal(error.code, expectedCode);
    return true;
  };
}

async function temporaryDirectory(t, label) {
  const directory = await mkdtemp(path.join(os.tmpdir(), `desen-m03-t10-${label}-`));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

test("accepts the immutable task-time M03-T10 capability evidence", async () => {
  assert.deepEqual(await verifyReferenceCatalogWebCapabilityArtifactEvidence(), {
    result: "PASS",
    artifactSha256: `sha256:${ARTIFACT_SHA256}`,
    catalogSha256: `sha256:${CATALOG_SHA256}`,
    packageDigest: PACKAGE_DIGEST,
    inventoryFiles: 76,
    inventoryBytes: 224_069,
    mutationVectors: 236,
    sourceMaps: 38,
    trackedFiles: 288,
    provenanceMode: "tracked-defaults",
    compatibilityMode: "immutable-task-time-artifact",
  });
});

test("two compatibility reads return exact independent historical bytes and semantics", async () => {
  const [first, second] = await Promise.all([
    buildReferenceCatalogWebCapabilityArtifactEvidence(),
    buildReferenceCatalogWebCapabilityArtifactEvidence(),
  ]);
  assert.equal(first.artifactSha256, `sha256:${ARTIFACT_SHA256}`);
  assert.equal(first.catalogSha256, `sha256:${CATALOG_SHA256}`);
  assert.equal(first.compatibilityMode, "immutable-task-time-artifact");
  assert.deepEqual(first.artifactBytes, second.artifactBytes);
  assert.notEqual(first.artifactBytes, second.artifactBytes);
  assert.equal(first.artifact.task, "M03-T10");
  assert.equal(first.artifact.inventory.files, 76);
  assert.equal(first.artifact.inventory.totalBytes, 224_069);
  assert.equal(first.artifact.evidence.trackedFiles.length, 288);
  assert.equal(Object.isFrozen(first.artifact), true);
});

test("rejects one-byte historical artifact tampering", async () => {
  const tampered = Buffer.from(
    await readFile(DEFAULT_REFERENCE_CATALOG_WEB_CAPABILITY_ARTIFACT_PATH),
  );
  tampered[tampered.length - 2] ^= 1;
  await assert.rejects(
    buildReferenceCatalogWebCapabilityArtifactEvidence({ artifactBytes: tampered }),
    hasEvidenceCode("REFERENCE_CAPABILITY_ARTIFACT_HISTORICAL_DRIFT"),
  );
});

test("rejects every successor Catalog source dist or rebuild injection", async () => {
  for (const options of [
    { catalogPath: DEFAULT_REFERENCE_CATALOG_WEB_CATALOG_PATH },
    { catalogBytes: Buffer.from("{}\n") },
    { sourceDirectory: "/tmp/source" },
    { distDirectory: "/tmp/dist" },
    { packageManifest: {} },
    { componentApi: {} },
    { verifyPrerequisite: false },
    { preparedEvidence: {} },
  ]) {
    await assert.rejects(
      buildReferenceCatalogWebCapabilityArtifactEvidence(options),
      hasEvidenceCode("REFERENCE_CAPABILITY_ARTIFACT_OPTIONS_INVALID"),
    );
  }
});

test("rejects accessor inherited symbol and Proxy options without invoking hooks", async () => {
  let getterCalls = 0;
  let proxyCalls = 0;
  const accessor = Object.defineProperty({}, "artifactPath", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return "ignored";
    },
  });
  const inherited = Object.create({ artifactPath: "ignored" });
  const symbol = { [Symbol("artifactPath")]: "ignored" };
  const proxy = new Proxy(
    {},
    {
      ownKeys() {
        proxyCalls += 1;
        return [];
      },
      getPrototypeOf() {
        proxyCalls += 1;
        return Object.prototype;
      },
    },
  );
  for (const options of [accessor, inherited, symbol, proxy]) {
    await assert.rejects(
      buildReferenceCatalogWebCapabilityArtifactEvidence(options),
      hasEvidenceCode("REFERENCE_CAPABILITY_ARTIFACT_OPTIONS_INVALID"),
    );
  }
  assert.equal(getterCalls, 0);
  assert.equal(proxyCalls, 0);
});

test("rejects moved duplicated or mismatched Proof Matrix pins", async () => {
  const matrix = await readFile(new URL("../docs/proof/PROOF-MATRIX.md", import.meta.url), "utf8");
  const exactReference =
    "`reference-catalog-web-capability-artifact.json`\n" + `\`sha256:${ARTIFACT_SHA256}\`.`;
  for (const proofMatrixText of [
    matrix.replace(exactReference, exactReference.replace("\n", "\nintervening\n")),
    `${matrix}\n${exactReference}\n`,
    matrix.replace(exactReference, exactReference.replace(ARTIFACT_SHA256, "0".repeat(64))),
  ]) {
    await assert.rejects(
      verifyReferenceCatalogWebCapabilityArtifactEvidence({ proofMatrixText }),
      hasEvidenceCode("REFERENCE_CAPABILITY_ARTIFACT_PROOF_PIN_DRIFT"),
    );
  }
});

test("validates the exact full task-time publication target map", () => {
  const historicalManifest = historicalPackageManifest();
  assert.deepEqual(verifyReferenceCatalogWebPackagePublicationSurface(historicalManifest), {
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

  const exportNames = Object.keys(historicalManifest.exports);
  for (const exportName of exportNames) {
    const forged = historicalPackageManifest();
    const target = forged.exports[exportName];
    forged.exports[exportName] =
      typeof target === "string"
        ? "./dist/forged.js"
        : {
            ...target,
            import: "./dist/forged.js",
          };
    assert.throws(
      () => verifyReferenceCatalogWebPackagePublicationSurface(forged),
      hasEvidenceCode("REFERENCE_CAPABILITY_ARTIFACT_PACKAGE_SURFACE_DRIFT"),
    );
  }

  const forgedTypes = historicalPackageManifest();
  forgedTypes.exports["."].types = "./dist/forged.d.ts";
  const addedExport = historicalPackageManifest();
  addedExport.exports["./react-adapters"] = {
    types: "./dist/react-adapters/index.d.ts",
    import: "./dist/react-adapters/index.js",
  };
  const removedExport = historicalPackageManifest();
  delete removedExport.exports["./tokens"];
  for (const forged of [
    { ...historicalPackageManifest(), files: ["dist", "catalog.json"] },
    { ...historicalPackageManifest(), files: ["catalog.json", "dist", "README.md"] },
    forgedTypes,
    addedExport,
    removedExport,
  ]) {
    assert.throws(
      () => verifyReferenceCatalogWebPackagePublicationSurface(forged),
      hasEvidenceCode("REFERENCE_CAPABILITY_ARTIFACT_PACKAGE_SURFACE_DRIFT"),
    );
  }
});

test("rejects publication accessors inherited members and Proxies without invoking hooks", () => {
  let getterCalls = 0;
  let proxyCalls = 0;
  const filesAccessor = historicalPackageManifest();
  Object.defineProperty(filesAccessor, "files", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return ["catalog.json", "dist"];
    },
  });
  const exportsAccessor = historicalPackageManifest();
  Object.defineProperty(exportsAccessor, "exports", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return historicalPackageManifest().exports;
    },
  });
  const nestedAccessor = historicalPackageManifest();
  const nestedTarget = {};
  Object.defineProperty(nestedTarget, "types", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return "./dist/index.d.ts";
    },
  });
  Object.defineProperty(nestedTarget, "import", {
    enumerable: true,
    value: "./dist/index.js",
  });
  nestedAccessor.exports["."] = nestedTarget;
  const inherited = Object.create({
    files: ["catalog.json", "dist"],
    exports: historicalPackageManifest().exports,
  });
  const proxyHandler = {
    ownKeys() {
      proxyCalls += 1;
      return [];
    },
    getPrototypeOf() {
      proxyCalls += 1;
      return Object.prototype;
    },
  };
  const proxyManifest = new Proxy(historicalPackageManifest(), proxyHandler);
  const proxyExports = historicalPackageManifest();
  proxyExports.exports = new Proxy(proxyExports.exports, proxyHandler);
  const proxyTarget = historicalPackageManifest();
  proxyTarget.exports["."] = new Proxy(proxyTarget.exports["."], proxyHandler);

  for (const manifest of [
    filesAccessor,
    exportsAccessor,
    nestedAccessor,
    inherited,
    proxyManifest,
    proxyExports,
    proxyTarget,
  ]) {
    assert.throws(
      () => verifyReferenceCatalogWebPackagePublicationSurface(manifest),
      hasEvidenceCode("REFERENCE_CAPABILITY_ARTIFACT_PACKAGE_SURFACE_DRIFT"),
    );
  }
  assert.equal(getterCalls, 0);
  assert.equal(proxyCalls, 0);
});

test("pins explicit proof and historical Catalog bytes without claiming the successor Catalog", async () => {
  const expected = await buildReferenceCatalogWebCapabilityArtifactEvidence();
  assert.equal(
    verifyReferenceCatalogWebCapabilityArtifactOutputs({
      expected,
      artifactBytes: expected.artifactBytes,
    }).result,
    "PASS",
  );

  const artifactTamper = Buffer.from(expected.artifactBytes);
  artifactTamper[artifactTamper.length - 2] ^= 1;
  assert.throws(
    () =>
      verifyReferenceCatalogWebCapabilityArtifactOutputs({
        expected,
        artifactBytes: artifactTamper,
      }),
    hasEvidenceCode("REFERENCE_CAPABILITY_ARTIFACT_PROOF_DRIFT"),
  );

  const successorCatalogBytes = await readFile(DEFAULT_REFERENCE_CATALOG_WEB_CATALOG_PATH);
  assert.throws(
    () =>
      verifyReferenceCatalogWebCapabilityArtifactOutputs({
        expected,
        artifactBytes: expected.artifactBytes,
        catalogBytes: successorCatalogBytes,
      }),
    hasEvidenceCode("REFERENCE_CAPABILITY_ARTIFACT_CATALOG_DRIFT"),
  );
});

test("checks self-reference only in explicit inert distribution bytes", () => {
  assert.deepEqual(
    verifyReferenceCatalogWebSelfReferenceExclusion(
      [{ path: "dist/index.js", bytes: Buffer.from("safe"), sha256: "unused" }],
      PACKAGE_DIGEST,
    ),
    {
      packageDigestBytesAbsent: true,
      exactTupleBytesAbsent: true,
      reason: "the exact tuple necessarily contains the absent packageDigest",
    },
  );
  assert.throws(
    () =>
      verifyReferenceCatalogWebSelfReferenceExclusion(
        [{ path: "dist/index.js", bytes: Buffer.from(`unsafe:${PACKAGE_DIGEST}`) }],
        PACKAGE_DIGEST,
      ),
    hasEvidenceCode("REFERENCE_CAPABILITY_ARTIFACT_SELF_REFERENCE_DETECTED"),
  );

  let getterCalls = 0;
  const entry = Object.defineProperty({}, "bytes", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return Buffer.from("ignored");
    },
  });
  assert.throws(
    () => verifyReferenceCatalogWebSelfReferenceExclusion([entry], PACKAGE_DIGEST),
    hasEvidenceCode("REFERENCE_CAPABILITY_ARTIFACT_OPTIONS_INVALID"),
  );
  assert.equal(getterCalls, 0);
});

test("requires an explicit staged historical distribution and rejects drift or symlinks", async (t) => {
  const expected = await buildReferenceCatalogWebCapabilityArtifactEvidence();
  await assert.rejects(
    verifyReferenceCatalogWebDistributionInventory({ expected }),
    hasEvidenceCode("REFERENCE_CAPABILITY_ARTIFACT_OPTIONS_INVALID"),
  );

  const emptyDirectory = await temporaryDirectory(t, "empty-dist");
  await assert.rejects(
    verifyReferenceCatalogWebDistributionInventory({
      expected,
      distDirectory: emptyDirectory,
    }),
    hasEvidenceCode("REFERENCE_CAPABILITY_ARTIFACT_DISTRIBUTION_DRIFT"),
  );

  const unsafeDirectory = await temporaryDirectory(t, "unsafe-dist");
  const target = path.join(unsafeDirectory, "target.js");
  await writeFile(target, "safe\n");
  await symlink(target, path.join(unsafeDirectory, "linked.js"));
  await assert.rejects(
    verifyReferenceCatalogWebDistributionInventory({
      expected,
      distDirectory: unsafeDirectory,
    }),
    hasEvidenceCode("REFERENCE_CAPABILITY_ARTIFACT_UNSAFE"),
  );
});

test("rejects a symlink historical artifact source", async (t) => {
  const directory = await temporaryDirectory(t, "source");
  const target = path.join(directory, "target.json");
  const source = path.join(directory, "artifact.json");
  await writeFile(target, await readFile(DEFAULT_REFERENCE_CATALOG_WEB_CAPABILITY_ARTIFACT_PATH));
  await symlink(target, source);
  await assert.rejects(
    buildReferenceCatalogWebCapabilityArtifactEvidence({ artifactPath: source }),
    hasEvidenceCode("REFERENCE_CAPABILITY_ARTIFACT_UNSAFE"),
  );
});

test("atomic compatibility writer rejects symlink destinations and temporary-byte tampering", async (t) => {
  const directory = await temporaryDirectory(t, "unsafe-write");
  const target = path.join(directory, "target.json");
  const symlinkDestination = path.join(directory, "linked.json");
  await writeFile(target, "{}\n");
  await symlink(target, symlinkDestination);
  await assert.rejects(
    writeReferenceCatalogWebCapabilityArtifactEvidence({
      artifactPath: symlinkDestination,
    }),
    hasEvidenceCode("REFERENCE_CAPABILITY_ARTIFACT_WRITE_FAILED"),
  );

  await assert.rejects(
    writeReferenceCatalogWebCapabilityArtifactEvidence({
      artifactPath: path.join(directory, "tampered.json"),
      async beforeArtifactAtomicRename({ temporaryPath }) {
        await writeFile(temporaryPath, "{}\n");
      },
    }),
    hasEvidenceCode("REFERENCE_CAPABILITY_ARTIFACT_WRITE_FAILED"),
  );
});

test("compatibility writer treats a symlink-parent tracked alias as the same no-op target", async (t) => {
  const directory = await temporaryDirectory(t, "tracked-alias");
  const aliasParent = path.join(directory, "artifacts");
  const aliasPath = path.join(
    aliasParent,
    path.basename(DEFAULT_REFERENCE_CATALOG_WEB_CAPABILITY_ARTIFACT_PATH),
  );
  await symlink(
    path.dirname(DEFAULT_REFERENCE_CATALOG_WEB_CAPABILITY_ARTIFACT_PATH),
    aliasParent,
    "dir",
  );

  const before = await lstat(DEFAULT_REFERENCE_CATALOG_WEB_CAPABILITY_ARTIFACT_PATH, {
    bigint: true,
  });
  const preserved = await writeReferenceCatalogWebCapabilityArtifactEvidence({
    artifactPath: aliasPath,
  });
  const after = await lstat(DEFAULT_REFERENCE_CATALOG_WEB_CAPABILITY_ARTIFACT_PATH, {
    bigint: true,
  });
  assert.equal(preserved.preserved, true);
  assert.equal(after.dev, before.dev);
  assert.equal(after.ino, before.ino);
  assert.equal(after.mtimeNs, before.mtimeNs);

  let hookCalls = 0;
  await assert.rejects(
    writeReferenceCatalogWebCapabilityArtifactEvidence({
      artifactPath: aliasPath,
      beforeArtifactAtomicRename() {
        hookCalls += 1;
      },
    }),
    hasEvidenceCode("REFERENCE_CAPABILITY_ARTIFACT_NONDEFAULT_TRACKED_WRITE"),
  );
  assert.equal(hookCalls, 0);
});

test("compatibility writer preserves tracked evidence copies exact bytes and leaves Catalog untouched", async (t) => {
  const directory = await temporaryDirectory(t, "copy");
  const destination = path.join(directory, "artifact.json");
  const catalogBefore = await readFile(DEFAULT_REFERENCE_CATALOG_WEB_CATALOG_PATH);
  const trackedBefore = await readFile(DEFAULT_REFERENCE_CATALOG_WEB_CAPABILITY_ARTIFACT_PATH);

  const preserved = await writeReferenceCatalogWebCapabilityArtifactEvidence();
  assert.equal(preserved.preserved, true);
  await assert.rejects(
    writeReferenceCatalogWebCapabilityArtifactEvidence({
      beforeArtifactAtomicRename() {
        return undefined;
      },
    }),
    hasEvidenceCode("REFERENCE_CAPABILITY_ARTIFACT_NONDEFAULT_TRACKED_WRITE"),
  );

  const copied = await writeReferenceCatalogWebCapabilityArtifactEvidence({
    artifactPath: destination,
  });
  const verified = await verifyReferenceCatalogWebCapabilityArtifactEvidence({
    artifactPath: destination,
  });
  assert.equal(copied.artifactSha256, `sha256:${ARTIFACT_SHA256}`);
  assert.equal(verified.artifactSha256, `sha256:${ARTIFACT_SHA256}`);
  assert.deepEqual(await readFile(destination), trackedBefore);
  assert.deepEqual(
    await readFile(DEFAULT_REFERENCE_CATALOG_WEB_CAPABILITY_ARTIFACT_PATH),
    trackedBefore,
  );
  assert.deepEqual(await readFile(DEFAULT_REFERENCE_CATALOG_WEB_CATALOG_PATH), catalogBefore);
});
