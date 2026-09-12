import assert from "node:assert/strict";
import {
  copyFile,
  link,
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
  M10A_T01_BROWSER_COMMAND,
  M10A_T01_ROOT_TEST_NAMES as NAMES,
  M10AT01ProofError,
  buildM10AT01Evidence,
  buildM10AT01PackageIdentity,
  executeM10AT01BrowserProof,
  verifyM10AT01RecordedEvidence,
  writeM10AT01Catalog,
} from "../scripts/lib/m10a-t01-proof.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const BROWSER_TEST_TITLES = Object.freeze([
  "keeps Select and Dialog interactions inside the approved boundary",
  "preserves protocol identity with session isolation, survives StrictMode remount, and isolates the host graph",
  "publishes three Source surfaces and rejects undeclared capability data",
]);
const BROWSER_ASSERTIONS = Object.freeze([
  "atomicRequiredSlotInsertion",
  "compatibleLiveRerenderIdentity",
  "compatiblePublicationIdentity",
  "disabledAndLoadingButton",
  "escapeFocusReturn",
  "focusTrap",
  "independentHostGraph",
  "keyboardSelect",
  "nestedPortalContainment",
  "portalContainment",
  "publisherDerivedAuthoring",
  "sameStaticAdapterRegistry",
  "strictModeUnmountRemount",
  "unknownCapabilityRejected",
  "unknownStylePartRejected",
  "wrongEventPayloadRejected",
]);
const BROWSER_ENVIRONMENT_LIMITS = Object.freeze({
  keyBytes: 1_024,
  valueBytes: 65_536,
  totalBytes: 262_144,
});
const HISTORICAL_CAPABILITIES = Object.freeze(["Button", "Select", "Dialog"]);
const HISTORICAL_CATALOG_RECEIPT = Object.freeze({
  id: "run.desen.starter.web",
  version: "0.1.0",
  target: "web-react",
  sha256: "0641d4baea6967f57700363a4cdf47ada8118cf39fd7f3bc8a5ec46709402134",
  bytes: 40_745,
});
const HISTORICAL_PACKAGE_DIGEST =
  "sha256:4a9c4029bade26ab398a47823cc8bec27c92c356dc77a73e1e902867f9051659";
const HISTORICAL_ARTIFACT_SHA256 =
  "711f74398fb1d250d392dd4ff1145527cdaa7ca8673e811c7f753d211554cc74";

function code(expected) {
  return (error) => {
    assert.ok(error instanceof M10AT01ProofError);
    assert.equal(error.code, `M10A_T01_${expected}`);
    return true;
  };
}

function passingBrowserObservation() {
  return {
    profile: "desen.m10a-t01.browser-proof.v1",
    result: "PASS",
    tests: BROWSER_TEST_TITLES.map((title) => ({ title, result: "PASS" })),
    graphReceipts: ["authoring", "host"],
    assertions: Object.fromEntries(BROWSER_ASSERTIONS.map((name) => [name, true])),
  };
}

function environmentUtf8Bytes(environment) {
  return Object.entries(environment).reduce(
    (total, [key, value]) =>
      total + Buffer.byteLength(key, "utf8") + Buffer.byteLength(value, "utf8"),
    0,
  );
}

function environmentAtExactSize(base, targetBytes) {
  const environment = { ...base };
  let remaining = targetBytes - environmentUtf8Bytes(environment);
  for (let index = 0; remaining > 0; index += 1) {
    const key = `F${index}`;
    const keyBytes = Buffer.byteLength(key, "utf8");
    if (remaining <= keyBytes)
      throw new TypeError("Environment boundary fixture cannot be filled.");
    const valueBytes = Math.min(BROWSER_ENVIRONMENT_LIMITS.valueBytes, remaining - keyBytes);
    environment[key] = "v".repeat(valueBytes);
    remaining -= keyBytes + valueBytes;
  }
  return environment;
}

async function bytes(relativePath) {
  return readFile(path.join(ROOT, relativePath));
}

test("M10A-T01 authenticates its frozen three-capability receipt, not the successor Catalog", async () => {
  const artifact = JSON.parse(await bytes("docs/proof/artifacts/m10a-t01.json"));
  assert.equal(artifact.task, "M10A-T01");
  assert.equal(artifact.profile, "desen.m10a-t01.base-ui-adapter-boundary.v1");
  assert.deepEqual(artifact.claims.boundedCapabilities, HISTORICAL_CAPABILITIES);
  assert.deepEqual(artifact.package.catalog, HISTORICAL_CATALOG_RECEIPT);
  assert.equal(artifact.package.packageDigest, HISTORICAL_PACKAGE_DIGEST);
  assert.equal(artifact.claims.historicalArtifactsRewritten, false);
  assert.equal(artifact.claims.runtimeCoreChanged, false);

  const receipt = await verifyM10AT01RecordedEvidence();
  assert.equal(receipt.status, "PASS");
  assert.equal(receipt.task, "M10A-T01");
  assert.equal(receipt.packageDigest, HISTORICAL_PACKAGE_DIGEST);
  assert.equal(receipt.catalogSha256, HISTORICAL_CATALOG_RECEIPT.sha256);
  assert.equal(receipt.artifactSha256, HISTORICAL_ARTIFACT_SHA256);
  assert.equal(receipt.browserExecutedByVerifier, false);
  assert.deepEqual(
    receipt.browserTests.map(({ title }) => title),
    BROWSER_TEST_TITLES,
  );
});

test(NAMES[1], async (context) => {
  const { admission } = await buildM10AT01PackageIdentity();
  assert.equal(admission.baseUi.version, "1.8.0");
  assert.equal(
    admission.baseUi.integrity,
    "sha512-P0/1sxo6SBVZOklKMIedvTWqw2s2IQzi9x5bIVsXu980cuSOD4NeuRSs+/L7LZQfDkZP/uRZyGPyfFl/B1oH+Q==",
  );
  assert.equal(admission.baseUi.license, "MIT");
  assert.equal(admission.baseUi.licenseBytes, 1_072);
  assert.equal(admission.lock.transitiveNodeCount, 8);
  assert.equal(admission.lock.snapshotClosure.length, 9);
  assert.deepEqual(
    admission.lock.snapshotClosure.map(({ key }) => key),
    [
      "@base-ui/react@1.8.0(@types/react@19.2.17)(react-dom@19.2.8(react@19.2.8))(react@19.2.8)",
      "@babel/runtime@7.29.7",
      "@base-ui/utils@0.4.0(@types/react@19.2.17)(react-dom@19.2.8(react@19.2.8))(react@19.2.8)",
      "@floating-ui/core@1.8.0",
      "@floating-ui/dom@1.8.0",
      "@floating-ui/react-dom@2.1.9(react-dom@19.2.8(react@19.2.8))(react@19.2.8)",
      "@floating-ui/utils@0.2.12",
      "reselect@5.3.0",
      "use-sync-external-store@1.6.0(react@19.2.8)",
    ],
  );
  assert.deepEqual(admission.lock.snapshotClosure[2].dependencies, {
    "@babel/runtime": "7.29.7",
    "@floating-ui/utils": "0.2.12",
    react: "19.2.8",
    "react-dom": "19.2.8(react@19.2.8)",
    reselect: "5.3.0",
    "use-sync-external-store": "1.6.0(react@19.2.8)",
  });
  assert.deepEqual(admission.baseUi.peerDependencies, {
    "@date-fns/tz": "^1.2.0",
    "@types/react": "^17 || ^18 || ^19",
    "date-fns": "^4.0.0",
    react: "^17 || ^18 || ^19",
    "react-dom": "^17 || ^18 || ^19",
  });

  // pnpm may materialize its content-addressed store with hard links on Linux and with
  // copy-on-write clones on macOS. Both are valid installations. The authenticated store files
  // may therefore have multiple names, while tracked workspace authorities must remain single-link.
  const fixtureRoot = await realpath(
    await mkdtemp(path.join(os.tmpdir(), "desen-m10a-t01-hardlink-test-")),
  );
  context.after(() => rm(fixtureRoot, { recursive: true, force: true }));
  const starterRoot = path.join(fixtureRoot, "packages/starter-catalog-web");
  const sourceStarterRoot = path.join(ROOT, "packages/starter-catalog-web");
  const sourceBaseUiRoot = await realpath(
    path.join(sourceStarterRoot, "node_modules/@base-ui/react"),
  );
  const baseUiStorePath = path.relative(ROOT, sourceBaseUiRoot);
  assert.equal(baseUiStorePath.startsWith(path.join("node_modules", ".pnpm") + path.sep), true);
  const fixtureBaseUiRoot = path.join(fixtureRoot, baseUiStorePath);
  const fixtureBaseUiLink = path.join(starterRoot, "node_modules/@base-ui/react");
  const sourceDistRoot = path.join(sourceStarterRoot, "dist");
  const fixtureDistRoot = path.join(starterRoot, "dist");
  const distEntries = await readdir(sourceDistRoot, { withFileTypes: true });
  assert.equal(
    distEntries.every((entry) => entry.isFile() && !entry.isSymbolicLink()),
    true,
  );
  await mkdir(path.join(starterRoot, "src"), { recursive: true });
  await mkdir(path.dirname(fixtureBaseUiLink), { recursive: true });
  await mkdir(fixtureBaseUiRoot, { recursive: true });
  await mkdir(fixtureDistRoot, { recursive: true });
  await Promise.all([
    copyFile(path.join(ROOT, "pnpm-lock.yaml"), path.join(fixtureRoot, "pnpm-lock.yaml")),
    copyFile(path.join(sourceStarterRoot, "package.json"), path.join(starterRoot, "package.json")),
    copyFile(
      path.join(sourceStarterRoot, "src/neutral.module.css"),
      path.join(starterRoot, "src/neutral.module.css"),
    ),
    copyFile(
      path.join(sourceBaseUiRoot, "package.json"),
      path.join(fixtureBaseUiRoot, "package.json"),
    ),
    copyFile(path.join(sourceBaseUiRoot, "LICENSE"), path.join(fixtureBaseUiRoot, "LICENSE")),
    ...distEntries.map((entry) =>
      copyFile(path.join(sourceDistRoot, entry.name), path.join(fixtureDistRoot, entry.name)),
    ),
  ]);
  await symlink(fixtureBaseUiRoot, fixtureBaseUiLink, "dir");

  const baseUiManifestAlias = path.join(fixtureRoot, "base-ui-package.json");
  const baseUiLicenseAlias = path.join(fixtureRoot, "base-ui-license.txt");
  await link(path.join(fixtureBaseUiRoot, "package.json"), baseUiManifestAlias);
  await link(path.join(fixtureBaseUiRoot, "LICENSE"), baseUiLicenseAlias);
  assert.equal(
    (await buildM10AT01PackageIdentity({ workspaceRoot: fixtureRoot })).admission.baseUi.version,
    "1.8.0",
  );
  await rm(baseUiManifestAlias);
  await rm(baseUiLicenseAlias);

  const starterManifestAlias = path.join(fixtureRoot, "starter-package.json");
  await link(path.join(starterRoot, "package.json"), starterManifestAlias);
  await assert.rejects(
    buildM10AT01PackageIdentity({ workspaceRoot: fixtureRoot }),
    code("AUTHORITY_UNSAFE"),
  );
  await rm(starterManifestAlias);
});

test(NAMES[2], async () => {
  const identity = await buildM10AT01PackageIdentity();
  const entryPaths = identity.packageIdentity.entries.map(({ path: entryPath }) => entryPath);
  const distFiles = identity.packageIdentity.entries.filter(({ path: entryPath }) =>
    entryPath.startsWith("packages/starter-catalog-web/dist/"),
  );
  assert.equal(distFiles.length, identity.inventory.distFiles);
  assert.equal(entryPaths.includes("package.json"), true);
  assert.equal(entryPaths.includes("src/neutral.module.css"), true);
  assert.equal(entryPaths.includes("metadata/base-ui-lock-admission.json"), true);
  assert.equal(entryPaths.includes("third-party/base-ui-react-package.json"), true);
  assert.equal(entryPaths.includes("third-party/base-ui-react-license.txt"), true);
});

test(NAMES[3], async () => {
  const starterPath = "packages/starter-catalog-web/package.json";
  const starter = JSON.parse(await bytes(starterPath));
  starter.dependencies["@base-ui/react"] = "1.8.1";
  await assert.rejects(
    buildM10AT01PackageIdentity({
      fileOverrides: new Map([[starterPath, Buffer.from(JSON.stringify(starter))]]),
    }),
    code("DEPENDENCY_ADMISSION_INVALID"),
  );

  const lockPath = "pnpm-lock.yaml";
  const lock = await bytes(lockPath);
  const changedLock = Buffer.from(
    lock
      .toString("utf8")
      .replace(
        "sha512-P0/1sxo6SBVZOklKMIedvTWqw2s2IQzi9x5bIVsXu980cuSOD4NeuRSs+/L7LZQfDkZP/uRZyGPyfFl/B1oH+Q==",
        `sha512-${"A".repeat(88)}`,
      ),
  );
  await assert.rejects(
    buildM10AT01PackageIdentity({ fileOverrides: new Map([[lockPath, changedLock]]) }),
    code("LOCKFILE_INVALID"),
  );

  const lockText = lock.toString("utf8");
  for (const changedSnapshot of [
    lockText.replace(
      "      reselect: 5.3.0\n      use-sync-external-store: 1.6.0(react@19.2.8)",
      "      reselect: 5.3.0\n      semver: 7.7.4\n      use-sync-external-store: 1.6.0(react@19.2.8)",
    ),
    lockText.replace("      '@floating-ui/core': 1.8.0", "      '@floating-ui/core': 1.7.3"),
    lockText.replace("      reselect: 5.3.0\n", ""),
  ]) {
    assert.notEqual(changedSnapshot, lockText);
    await assert.rejects(
      buildM10AT01PackageIdentity({
        fileOverrides: new Map([[lockPath, Buffer.from(changedSnapshot)]]),
      }),
      code("DEPENDENCY_ADMISSION_INVALID"),
    );
  }

  const license = await readFile(
    path.join(ROOT, "packages/starter-catalog-web/node_modules/@base-ui/react/LICENSE"),
  );
  const changedLicense = Buffer.from(license);
  changedLicense[0] ^= 1;
  await assert.rejects(
    buildM10AT01PackageIdentity({
      fileOverrides: new Map([["metadata/installed-base-ui/LICENSE", changedLicense]]),
    }),
    code("DEPENDENCY_ADMISSION_INVALID"),
  );

  const identity = await buildM10AT01PackageIdentity();
  const distPath = identity.packageIdentity.entries.find(({ path: entryPath }) =>
    entryPath.startsWith("packages/starter-catalog-web/dist/"),
  ).path;
  const changedDist = Buffer.from(await bytes(distPath));
  changedDist[Math.floor(changedDist.length / 2)] ^= 1;
  const changedIdentity = await buildM10AT01PackageIdentity({
    fileOverrides: new Map([[distPath, changedDist]]),
  });
  assert.notEqual(
    changedIdentity.packageIdentity.packageDigest,
    identity.packageIdentity.packageDigest,
  );
});

test(NAMES[4], async (context) => {
  const valid = passingBrowserObservation();
  const validEvidence = await buildM10AT01Evidence({ browserObservation: valid });
  assert.equal(validEvidence.artifact.browser.tests.length, 3);
  for (const mutate of [
    (value) => value.tests.pop(),
    (value) => (value.tests[0].result = "FAIL"),
    (value) => (value.assertions.unreviewed = true),
    (value) => (value.assertions.focusTrap = false),
  ]) {
    const changed = structuredClone(valid);
    mutate(changed);
    await assert.rejects(
      buildM10AT01Evidence({ browserObservation: changed }),
      code("BROWSER_OBSERVATION_INVALID"),
    );
  }

  const tempRoot = await realpath(await mkdtemp(path.join(os.tmpdir(), "desen-m10a-t01-test-")));
  context.after(() => rm(tempRoot, { recursive: true, force: true }));
  let observedCommand;
  const observed = await executeM10AT01BrowserProof({
    environment: { DESEN_M10A_T01_PROOF_TEMP: tempRoot },
    runChild: async (command, args, options) => {
      observedCommand = { command, args };
      await writeFile(
        path.join(options.env.DESEN_M10A_T01_PROOF_TEMP, "browser-proof.json"),
        `${JSON.stringify(valid)}\n`,
      );
      return {
        code: 0,
        signal: null,
        timedOut: false,
        outputExceeded: false,
        parentSignal: null,
        processGroupReleased: true,
        unexpectedSurvivors: false,
      };
    },
  });
  assert.deepEqual(observedCommand, M10A_T01_BROWSER_COMMAND);
  assert.equal(observed.tests.length, 3);
  await assert.rejects(
    executeM10AT01BrowserProof({
      environment: { DESEN_M10A_T01_PROOF_TEMP: tempRoot },
      runChild: async () => ({
        code: 0,
        signal: null,
        timedOut: false,
        outputExceeded: false,
        parentSignal: null,
        processGroupReleased: true,
        unexpectedSurvivors: false,
      }),
    }),
    code("BROWSER_OBSERVATION_STALE"),
  );

  const wrongReportRoot = await realpath(
    await mkdtemp(path.join(os.tmpdir(), "desen-m10a-t01-test-")),
  );
  context.after(() => rm(wrongReportRoot, { recursive: true, force: true }));
  await assert.rejects(
    executeM10AT01BrowserProof({
      environment: { DESEN_M10A_T01_PROOF_TEMP: wrongReportRoot },
      runChild: async (_command, _args, options) => {
        await writeFile(
          path.join(options.env.DESEN_M10A_T01_PROOF_TEMP, "browser-report.json"),
          `${JSON.stringify(valid)}\n`,
        );
        return {
          code: 0,
          signal: null,
          timedOut: false,
          outputExceeded: false,
          parentSignal: null,
          processGroupReleased: true,
          unexpectedSurvivors: false,
        };
      },
    }),
    code("AUTHORITY_UNSAFE"),
  );

  const cancellationRoot = await realpath(
    await mkdtemp(path.join(os.tmpdir(), "desen-m10a-t01-test-")),
  );
  context.after(() => rm(cancellationRoot, { recursive: true, force: true }));
  await assert.rejects(
    executeM10AT01BrowserProof({
      environment: { DESEN_M10A_T01_PROOF_TEMP: cancellationRoot },
      runChild: async () => ({
        code: 0,
        signal: null,
        timedOut: false,
        outputExceeded: false,
        parentSignal: "SIGTERM",
        processGroupReleased: true,
        unexpectedSurvivors: false,
        stdout: Buffer.alloc(0),
        stderr: Buffer.from(`cancelled ${ROOT} ${cancellationRoot}`),
      }),
    }),
    (error) => {
      assert.equal(code("BROWSER_EXECUTION_FAILED")(error), true);
      assert.match(error.diagnostic, /cancelled <workspace> <temp>/u);
      assert.equal(error.diagnostic.includes(ROOT), false);
      assert.equal(error.diagnostic.includes(cancellationRoot), false);
      return true;
    },
  );

  const survivingGroupRoot = await realpath(
    await mkdtemp(path.join(os.tmpdir(), "desen-m10a-t01-test-")),
  );
  context.after(() => rm(survivingGroupRoot, { recursive: true, force: true }));
  await assert.rejects(
    executeM10AT01BrowserProof({
      environment: { DESEN_M10A_T01_PROOF_TEMP: survivingGroupRoot },
      runChild: async (_command, _args, options) => {
        await writeFile(
          path.join(options.env.DESEN_M10A_T01_PROOF_TEMP, "browser-proof.json"),
          `${JSON.stringify(valid)}\n`,
        );
        return {
          code: 0,
          signal: null,
          timedOut: false,
          outputExceeded: false,
          parentSignal: null,
          processGroupReleased: false,
          unexpectedSurvivors: true,
        };
      },
    }),
    code("BROWSER_EXECUTION_FAILED"),
  );
});

test(NAMES[5], async (context) => {
  for (const options of [null, [], new Proxy({}, {}), { unknown: true }]) {
    await assert.rejects(buildM10AT01PackageIdentity(options), code("OPTIONS_INVALID"));
  }
  await assert.rejects(
    buildM10AT01PackageIdentity({
      fileOverrides: new Map([["README.md", Buffer.from("changed")]]),
    }),
    code("OPTIONS_INVALID"),
  );
  await assert.rejects(
    buildM10AT01PackageIdentity({
      fileOverrides: new Map([["packages/starter-catalog-web/package.json", "not bytes"]]),
    }),
    code("OPTIONS_INVALID"),
  );
  await assert.rejects(
    writeM10AT01Catalog({ catalogPath: path.join(ROOT, "catalog.json") }),
    code("OPTIONS_INVALID"),
  );
  await assert.rejects(
    executeM10AT01BrowserProof({ environment: { DESEN_M10A_T01_PROOF_TEMP: "relative" } }),
    code("BROWSER_ENVIRONMENT_INVALID"),
  );

  const executeWithEnvironment = async (environmentFactory) => {
    const tempRoot = await realpath(
      await mkdtemp(path.join(os.tmpdir(), "desen-m10a-t01-environment-test-")),
    );
    context.after(() => rm(tempRoot, { recursive: true, force: true }));
    const environment = environmentFactory(tempRoot);
    let observedEnvironment;
    await executeM10AT01BrowserProof({
      environment,
      runChild: async (_command, _args, options) => {
        observedEnvironment = options.env;
        await writeFile(
          path.join(options.env.DESEN_M10A_T01_PROOF_TEMP, "browser-proof.json"),
          `${JSON.stringify(passingBrowserObservation())}\n`,
        );
        return {
          code: 0,
          signal: null,
          timedOut: false,
          outputExceeded: false,
          parentSignal: null,
          processGroupReleased: true,
          unexpectedSurvivors: false,
        };
      },
    });
    return { environment, observedEnvironment };
  };

  const exactKey = await executeWithEnvironment((tempRoot) => ({
    DESEN_M10A_T01_PROOF_TEMP: tempRoot,
    ["K".repeat(BROWSER_ENVIRONMENT_LIMITS.keyBytes)]: "",
  }));
  assert.equal(
    Object.keys(exactKey.observedEnvironment).some(
      (key) => Buffer.byteLength(key, "utf8") === BROWSER_ENVIRONMENT_LIMITS.keyBytes,
    ),
    true,
  );

  const exactValue = await executeWithEnvironment((tempRoot) => ({
    DESEN_M10A_T01_PROOF_TEMP: tempRoot,
    EXACT_VALUE: "V".repeat(BROWSER_ENVIRONMENT_LIMITS.valueBytes),
  }));
  assert.equal(
    Buffer.byteLength(exactValue.observedEnvironment.EXACT_VALUE, "utf8"),
    BROWSER_ENVIRONMENT_LIMITS.valueBytes,
  );

  const exactAggregate = await executeWithEnvironment((tempRoot) =>
    environmentAtExactSize(
      { DESEN_M10A_T01_PROOF_TEMP: tempRoot },
      BROWSER_ENVIRONMENT_LIMITS.totalBytes,
    ),
  );
  assert.equal(
    environmentUtf8Bytes(exactAggregate.observedEnvironment),
    BROWSER_ENVIRONMENT_LIMITS.totalBytes,
  );

  const rejectionRoot = await realpath(
    await mkdtemp(path.join(os.tmpdir(), "desen-m10a-t01-environment-test-")),
  );
  context.after(() => rm(rejectionRoot, { recursive: true, force: true }));
  for (const environment of [
    {
      DESEN_M10A_T01_PROOF_TEMP: rejectionRoot,
      ["K".repeat(BROWSER_ENVIRONMENT_LIMITS.keyBytes + 1)]: "",
    },
    {
      DESEN_M10A_T01_PROOF_TEMP: rejectionRoot,
      OVERSIZED_VALUE: "V".repeat(BROWSER_ENVIRONMENT_LIMITS.valueBytes + 1),
    },
    environmentAtExactSize(
      { DESEN_M10A_T01_PROOF_TEMP: rejectionRoot },
      BROWSER_ENVIRONMENT_LIMITS.totalBytes + 1,
    ),
  ]) {
    await assert.rejects(
      executeM10AT01BrowserProof({
        environment,
        runChild: async () => {
          throw new TypeError("An oversized environment reached the child runner.");
        },
      }),
      code("OPTIONS_INVALID"),
    );
  }
});

test(NAMES[6], async () => {
  const result = await verifyM10AT01RecordedEvidence();
  assert.equal(result.status, "PASS");
  assert.equal(result.task, "M10A-T01");
  assert.equal(result.browserExecutedByVerifier, false);
  assert.equal(result.browserTests.length, 3);
});
