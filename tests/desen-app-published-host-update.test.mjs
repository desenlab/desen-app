import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { gunzipSync } from "node:zlib";

import {
  DESEN_APP_PUBLISHED_HOST_UPDATE_APP_CANVAS_PIN,
  DESEN_APP_PUBLISHED_HOST_UPDATE_ARTIFACT_PIN,
  DESEN_APP_PUBLISHED_HOST_UPDATE_HOST_AUDIT_PIN,
  DESEN_APP_PUBLISHED_HOST_UPDATE_ROOT_TEST_NAMES,
  DESEN_APP_PUBLISHED_HOST_UPDATE_T04_PIN,
  DESEN_APP_PUBLISHED_HOST_UPDATE_T14_PIN,
  DESEN_APP_T04_HISTORICAL_READER_BRIDGE_PIN,
  DesenAppPublishedHostUpdateProofError,
  authenticateDesenAppPublishedHostUpdateSuccessor,
  buildDesenAppPublishedHostUpdateEvidence,
  materializeDesenAppT04HistoricalReaderFileOverrides,
  projectDesenAppT04HistoricalReaderPathInventory,
  readDesenAppT01aHistoricalReaderGapFile,
  readDesenAppT04HistoricalReaderTaskTimeFile,
  verifyDesenAppPublishedHostUpdateBrowserPolicy,
  verifyDesenAppPublishedHostUpdateEvidence,
  verifyDesenAppPublishedHostUpdateGraphPolicy,
  verifyDesenAppPublishedHostUpdateSourcePolicy,
  writeDesenAppPublishedHostUpdateEvidence,
} from "../scripts/lib/desen-app-published-host-update-proof.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-published-host-update.json";
const REPORT_PATH = "docs/proof/DESEN-APP-PUBLISHED-HOST-UPDATE.md";
const T01A_APP_PACKAGE_PATH = "apps/desen-app/package.json";
const T01A_APP_PACKAGE_RECEIPT = Object.freeze({
  bytes: 4_122,
  sha256: "7038647aa1809f07ee5131d0df8d0bee75bf1f2cdf0358be738b2c3603b64577",
});
const T04_APP_PACKAGE_RECEIPT = Object.freeze({
  bytes: 4_546,
  sha256: "c634b5ee1e2d2af0ffd6db8d4841215664591a31999210a8e0b388b71509eb32",
});
const SOURCE_PATHS = Object.freeze({
  runtimePublication: "apps/desen-app/src/local-runtime-publication.ts",
  main: "apps/desen-app/src/main.tsx",
  productBootstrap: "apps/desen-app/src/product-bootstrap.tsx",
  publicationHost: "apps/desen-app/dev/local-publication-host.mjs",
  localDevHost: "apps/desen-app/dev/local-dev-host.mjs",
  referenceServer: "apps/reference-host-web-server/src/server.ts",
  referenceServerIndex: "apps/reference-host-web-server/src/index.ts",
});
const BROWSER_PATHS = Object.freeze({
  config: "apps/desen-app-browser-e2e/published-host-playwright.config.ts",
  server: "apps/desen-app-browser-e2e/published-host-proof-server.mjs",
  spec: "apps/desen-app-browser-e2e/published-host-update.pw.ts",
});

const temporaryDirectories = [];
let artifactBytes;
let bridgeManifest;
let browserPolicyInput;
let built;
let sourcePolicyInput;
let successor;
let verified;

function expectedError(code) {
  return (error) => {
    assert.ok(error instanceof DesenAppPublishedHostUpdateProofError);
    assert.equal(error.code, code);
    return true;
  };
}

function replaceOnce(source, marker, replacement) {
  const index = source.indexOf(marker);
  assert.notEqual(index, -1, `Missing mutation marker ${marker}`);
  return `${source.slice(0, index)}${replacement}${source.slice(index + marker.length)}`;
}

function changedByte(bytes) {
  const changed = Buffer.from(bytes);
  changed[Math.floor(changed.byteLength / 2)] ^= 1;
  return changed;
}

function graphPolicyInput() {
  const runtime = built.artifact.authority.runtimeResolution;
  const fixtureOnly = new Set(runtime.appFixtureOnlySourceFiles);
  return {
    appGraph: runtime.appModules,
    appSourcePaths: built.artifact.authority.appSourceAudit.sourceReceipts
      .map(({ path: relativePath }) => relativePath)
      .filter((relativePath) => !fixtureOnly.has(relativePath)),
    hostGraph: runtime.hostModules,
    hostSourcePaths: built.artifact.authority.referenceHostSourceAudit.sourceReceipts.map(
      ({ path: relativePath }) => relativePath,
    ),
  };
}

before(async () => {
  [sourcePolicyInput, browserPolicyInput] = await Promise.all([
    Object.fromEntries(
      await Promise.all(
        Object.entries(SOURCE_PATHS).map(async ([key, relativePath]) => [
          key,
          await readFile(path.join(ROOT, relativePath), "utf8"),
        ]),
      ),
    ),
    Object.fromEntries(
      await Promise.all(
        Object.entries(BROWSER_PATHS).map(async ([key, relativePath]) => [
          key,
          await readFile(path.join(ROOT, relativePath), "utf8"),
        ]),
      ),
    ),
  ]);
  artifactBytes = await readFile(path.join(ROOT, ARTIFACT_PATH));
  bridgeManifest = JSON.parse(
    gunzipSync(
      await readFile(path.join(ROOT, DESEN_APP_T04_HISTORICAL_READER_BRIDGE_PIN.path)),
    ).toString("utf8"),
  );
  built = await buildDesenAppPublishedHostUpdateEvidence();
  verified = await verifyDesenAppPublishedHostUpdateEvidence();
  successor = await authenticateDesenAppPublishedHostUpdateSuccessor();
});

after(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

test(DESEN_APP_PUBLISHED_HOST_UPDATE_ROOT_TEST_NAMES[0], async () => {
  assert.deepEqual(built.artifact.prerequisites, [
    DESEN_APP_PUBLISHED_HOST_UPDATE_T04_PIN,
    DESEN_APP_PUBLISHED_HOST_UPDATE_T14_PIN,
    DESEN_APP_PUBLISHED_HOST_UPDATE_HOST_AUDIT_PIN,
    DESEN_APP_PUBLISHED_HOST_UPDATE_APP_CANVAS_PIN,
  ]);
  assert.equal(built.artifact.authority.historicalReaderBridge.fileEntries, 51);
  assert.equal(built.artifact.authority.historicalReaderBridge.predecessorGapFiles, 2);
  assert.equal(built.artifact.authority.historicalReaderBridge.successorAddedPaths, 7);
  assert.equal(built.artifact.authority.historicalReaderBridge.approvedAr01ReceiptAmendments, 2);
  assert.deepEqual(
    built.artifact.authority.historicalReaderBridge.t01aAncestor,
    DESEN_APP_T04_HISTORICAL_READER_BRIDGE_PIN.t01aAncestor,
  );
  assert.deepEqual(Object.keys(bridgeManifest.t01aAncestor.files), [T01A_APP_PACKAGE_PATH]);
  assert.equal(successor.task, "M10-T05");
  assert.equal(successor.artifact.sha256, DESEN_APP_PUBLISHED_HOST_UPDATE_ARTIFACT_PIN.sha256);

  const historical = materializeDesenAppT04HistoricalReaderFileOverrides(successor, new Map());
  assert.equal(historical.size, 53);
  const t04AppPackage = historical.get(T01A_APP_PACKAGE_PATH);
  assert.equal(t04AppPackage.byteLength, T04_APP_PACKAGE_RECEIPT.bytes);
  assert.equal(
    createHash("sha256").update(t04AppPackage).digest("hex"),
    T04_APP_PACKAGE_RECEIPT.sha256,
  );
  const t04AppPackageDirect = readDesenAppT04HistoricalReaderTaskTimeFile(
    successor,
    T01A_APP_PACKAGE_PATH,
  );
  assert.equal(t04AppPackageDirect.byteLength, T04_APP_PACKAGE_RECEIPT.bytes);
  assert.equal(
    createHash("sha256").update(t04AppPackageDirect).digest("hex"),
    T04_APP_PACKAGE_RECEIPT.sha256,
  );
  const firstT01aAppPackage = readDesenAppT01aHistoricalReaderGapFile(
    successor,
    T01A_APP_PACKAGE_PATH,
  );
  const secondT01aAppPackage = readDesenAppT01aHistoricalReaderGapFile(
    successor,
    T01A_APP_PACKAGE_PATH,
  );
  assert.equal(firstT01aAppPackage.byteLength, T01A_APP_PACKAGE_RECEIPT.bytes);
  assert.equal(
    createHash("sha256").update(firstT01aAppPackage).digest("hex"),
    T01A_APP_PACKAGE_RECEIPT.sha256,
  );
  firstT01aAppPackage[0] ^= 1;
  assert.notDeepEqual(firstT01aAppPackage, secondT01aAppPackage);
  assert.throws(
    () => readDesenAppT01aHistoricalReaderGapFile(Object.freeze({}), T01A_APP_PACKAGE_PATH),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
  assert.throws(
    () => readDesenAppT01aHistoricalReaderGapFile(successor, "pnpm-lock.yaml"),
    expectedError("OPTIONS_INVALID"),
  );
  assert.throws(
    () => readDesenAppT01aHistoricalReaderGapFile(Object.freeze({}), "../escape"),
    expectedError("OPTIONS_INVALID"),
  );
  const taskTimePath = "apps/desen-app/src/main.tsx";
  const firstCopy = readDesenAppT04HistoricalReaderTaskTimeFile(successor, taskTimePath);
  const secondCopy = readDesenAppT04HistoricalReaderTaskTimeFile(successor, taskTimePath);
  firstCopy[0] ^= 1;
  assert.notDeepEqual(firstCopy, secondCopy);
  const inventory = [...Object.keys(bridgeManifest.files), ...bridgeManifest.successorAddedPaths];
  assert.deepEqual(
    projectDesenAppT04HistoricalReaderPathInventory(successor, inventory),
    Object.keys(bridgeManifest.files),
  );
  assert.throws(
    () => materializeDesenAppT04HistoricalReaderFileOverrides(Object.freeze({}), new Map()),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );

  assert.doesNotMatch(
    authenticateDesenAppPublishedHostUpdateSuccessor.toString(),
    /(?:verify|build)DesenAppPublishedHostUpdateEvidence|buildDualViteAudit|viteBuild/u,
  );
  const lightweightWorkspace = await realpath(
    await mkdtemp(path.join(os.tmpdir(), "desen-app-t05-lightweight-successor-")),
  );
  temporaryDirectories.push(lightweightWorkspace);
  const report = await readFile(path.join(ROOT, REPORT_PATH));
  const parent = await readFile(path.join(ROOT, DESEN_APP_PUBLISHED_HOST_UPDATE_T04_PIN.path));
  const bridge = await readFile(path.join(ROOT, DESEN_APP_T04_HISTORICAL_READER_BRIDGE_PIN.path));
  const lightweightAuthorities = new Map([
    [ARTIFACT_PATH, artifactBytes],
    [REPORT_PATH, report],
    [DESEN_APP_PUBLISHED_HOST_UPDATE_T04_PIN.path, parent],
    [DESEN_APP_T04_HISTORICAL_READER_BRIDGE_PIN.path, bridge],
  ]);
  for (const [relativePath, bytes] of lightweightAuthorities) {
    const absolutePath = path.join(lightweightWorkspace, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, bytes);
  }
  const lightweightSuccessor = await authenticateDesenAppPublishedHostUpdateSuccessor({
    workspaceRoot: lightweightWorkspace,
  });
  assert.equal(lightweightSuccessor.task, "M10-T05");
  assert.equal(
    lightweightSuccessor.artifact.sha256,
    DESEN_APP_PUBLISHED_HOST_UPDATE_ARTIFACT_PIN.sha256,
  );
  assert.deepEqual(
    readDesenAppT01aHistoricalReaderGapFile(lightweightSuccessor, T01A_APP_PACKAGE_PATH),
    secondT01aAppPackage,
  );

  const artifactPath = path.join(lightweightWorkspace, ARTIFACT_PATH);
  await writeFile(artifactPath, changedByte(artifactBytes));
  await assert.rejects(
    authenticateDesenAppPublishedHostUpdateSuccessor({ workspaceRoot: lightweightWorkspace }),
    expectedError("ARTIFACT_DRIFT"),
  );
  await writeFile(artifactPath, artifactBytes);

  const reportPath = path.join(lightweightWorkspace, REPORT_PATH);
  await writeFile(reportPath, replaceOnce(report.toString("utf8"), "Status: DONE", "Status: OPEN"));
  await assert.rejects(
    authenticateDesenAppPublishedHostUpdateSuccessor({ workspaceRoot: lightweightWorkspace }),
    expectedError("PROOF_DOCUMENT_DRIFT"),
  );
  await writeFile(reportPath, report);

  const parentPath = path.join(lightweightWorkspace, DESEN_APP_PUBLISHED_HOST_UPDATE_T04_PIN.path);
  await writeFile(parentPath, changedByte(parent));
  await assert.rejects(
    authenticateDesenAppPublishedHostUpdateSuccessor({ workspaceRoot: lightweightWorkspace }),
    expectedError("PARENT_DRIFT"),
  );
  await writeFile(parentPath, parent);

  const bridgePath = path.join(
    lightweightWorkspace,
    DESEN_APP_T04_HISTORICAL_READER_BRIDGE_PIN.path,
  );
  await writeFile(bridgePath, changedByte(bridge));
  await assert.rejects(
    authenticateDesenAppPublishedHostUpdateSuccessor({ workspaceRoot: lightweightWorkspace }),
    expectedError("HISTORICAL_BRIDGE_DRIFT"),
  );
});

test(DESEN_APP_PUBLISHED_HOST_UPDATE_ROOT_TEST_NAMES[1], () => {
  assert.deepEqual(verifyDesenAppPublishedHostUpdateSourcePolicy(sourcePolicyInput), {
    exactInjectedProfile: true,
    independentControlPlaneAndActivationAuthorities: true,
    fixedChannelAndHostDestination: true,
    sourceCannotSelectEndpointHandlerCredentialOrHostModule: true,
    browserCredentialsOmitted: true,
    boundedBrowserTransport: true,
    exactActivationRevisionRequired: true,
    normalProductBootstrapReceivesOptionalPort: true,
    flowWorkspaceCannotReceivePublicationPort: true,
    serverOwnsChannelRereadAndActivation: true,
    activationBridgeStrictAndLoopbackOnly: true,
    callbackSettlementClosedAndRedacted: true,
    lifecycleIdempotentAndCredentialsZeroed: true,
  });
  assert.throws(
    () =>
      verifyDesenAppPublishedHostUpdateSourcePolicy({
        ...sourcePolicyInput,
        runtimePublication: sourcePolicyInput.runtimePublication.replaceAll(
          "MAX_RESPONSE_CHUNKS",
          "REMOVED_RESPONSE_CHUNK_BOUND",
        ),
      }),
    expectedError("SOURCE_POLICY_VIOLATION"),
  );
  const branchSwappedMain = replaceOnce(
    replaceOnce(sourcePolicyInput.main, "              publicationPort={publicationPort}\n", ""),
    "              integrationBinding={flowIntegration}\n",
    [
      "              integrationBinding={flowIntegration}",
      "              publicationPort={publicationPort}",
      "",
    ].join("\n"),
  );
  for (const runtimePublication of [
    replaceOnce(
      sourcePolicyInput.runtimePublication,
      "    config?.profile !== DESEN_APP_LOCAL_PUBLICATION_PROFILE ||\n",
      "",
    ),
    replaceOnce(
      sourcePolicyInput.runtimePublication,
      "`${config.activation.origin}${ACTIVATION_PATH}`",
      "`${config.activation.origin}/${request.revision}`",
    ),
    replaceOnce(
      sourcePolicyInput.runtimePublication,
      "          authorization: `Bearer ${config.activation.apiToken}`",
      "          authorization: `Bearer ${config.controlPlane.apiToken}`",
    ),
    replaceOnce(
      sourcePolicyInput.runtimePublication,
      [
        "  return createFixedDestinationAuthoringPublicationPort({",
        "    channelName: config.destination.channelName,",
      ].join("\n"),
      [
        "  return createFixedDestinationAuthoringPublicationPort({",
        "    channelName: config.destination.hostId,",
      ].join("\n"),
    ),
  ]) {
    assert.throws(
      () =>
        verifyDesenAppPublishedHostUpdateSourcePolicy({
          ...sourcePolicyInput,
          runtimePublication,
        }),
      expectedError("SOURCE_POLICY_VIOLATION"),
    );
  }
  assert.throws(
    () =>
      verifyDesenAppPublishedHostUpdateSourcePolicy({
        ...sourcePolicyInput,
        main: branchSwappedMain,
      }),
    expectedError("SOURCE_POLICY_VIOLATION"),
  );
  for (const publicationHost of [
    replaceOnce(
      sourcePolicyInput.publicationHost,
      "server.listen({ host: LOOPBACK, port: 0, exclusive: true }",
      'server.listen({ host: "::", port: 0, exclusive: true }',
    ),
    replaceOnce(
      sourcePolicyInput.publicationHost,
      "    closePromise ??= (async () => {",
      "    closePromise = (async () => {",
    ),
  ]) {
    assert.throws(
      () =>
        verifyDesenAppPublishedHostUpdateSourcePolicy({
          ...sourcePolicyInput,
          publicationHost,
        }),
      expectedError("SOURCE_POLICY_VIOLATION"),
    );
  }
  assert.throws(
    () =>
      verifyDesenAppPublishedHostUpdateSourcePolicy({
        ...sourcePolicyInput,
        referenceServer: replaceOnce(
          sourcePolicyInput.referenceServer,
          "const channelAfterRefresh = await readPublicationChannel(controlPlaneClient);",
          "const channelAfterRefresh = channelBeforeRefresh;",
        ),
      }),
    expectedError("SOURCE_POLICY_VIOLATION"),
  );
});

test(DESEN_APP_PUBLISHED_HOST_UPDATE_ROOT_TEST_NAMES[2], () => {
  const source = built.artifact.authority.source;
  assert.equal(source.independentControlPlaneAndActivationAuthorities, true);
  assert.equal(source.browserCredentialsOmitted, true);
  assert.equal(source.boundedBrowserTransport, true);
  assert.equal(source.callbackSettlementClosedAndRedacted, true);
  assert.equal(source.lifecycleIdempotentAndCredentialsZeroed, true);
  assert.equal(built.artifact.authority.focusedTests.totalDeclarationSites, 66);
  assert.throws(
    () =>
      verifyDesenAppPublishedHostUpdateSourcePolicy({
        ...sourcePolicyInput,
        publicationHost: replaceOnce(
          sourcePolicyInput.publicationHost,
          "timingSafeEqual(candidate, expected)",
          "candidate.equals(expected)",
        ),
      }),
    expectedError("SOURCE_POLICY_VIOLATION"),
  );
});

test(DESEN_APP_PUBLISHED_HOST_UPDATE_ROOT_TEST_NAMES[3], () => {
  const host = built.artifact.authority.referenceHostSourceAudit;
  assert.equal(host.sourceFiles, 13);
  assert.equal(host.executableSourceFiles, 12);
  assert.equal(host.exactJsxOwnershipAllowlistEnforced, true);
  assert.equal(host.directOrHiddenHandwrittenManagedTreesRejected, true);
  assert.equal(host.currentAuditUsesFreshSourceAndBuild, true);
  assert.equal(host.runtimeResolution.moduleCount, 104);
  assert.equal(host.runtimeResolution.staticEdges, 299);
  assert.equal(host.runtimeResolution.dynamicEdges, 0);
  assert.equal(host.runtimeResolution.unresolvedEdges, 0);
});

test(DESEN_APP_PUBLISHED_HOST_UPDATE_ROOT_TEST_NAMES[4], () => {
  const runtime = built.artifact.authority.runtimeResolution;
  assert.equal(runtime.tool, "vite@8.1.5");
  assert.equal(runtime.write, false);
  assert.equal(runtime.independentBuildsPerApplication, 2);
  assert.equal(runtime.app.moduleCount, 168);
  assert.equal(runtime.app.staticEdges, 510);
  assert.equal(runtime.host.moduleCount, 104);
  assert.equal(runtime.host.staticEdges, 299);
  assert.equal(runtime.sharedManagedModuleCount, 22);
  const graph = verifyDesenAppPublishedHostUpdateGraphPolicy(graphPolicyInput());
  assert.deepEqual(graph.app, runtime.app);
  assert.deepEqual(graph.host, runtime.host);
  assert.equal(graph.sharedManagedModuleCount, runtime.sharedManagedModuleCount);
  assert.deepEqual(graph.sharedManagedIdentity, runtime.sharedManagedIdentity);

  let accessorReads = 0;
  const accessorGraph = structuredClone(graphPolicyInput());
  const firstEntry = accessorGraph.appGraph[0];
  Object.defineProperty(accessorGraph.appGraph, "0", {
    configurable: true,
    enumerable: true,
    get() {
      accessorReads += 1;
      return firstEntry;
    },
  });
  assert.throws(
    () => verifyDesenAppPublishedHostUpdateGraphPolicy(accessorGraph),
    expectedError("OPTIONS_INVALID"),
  );
  assert.equal(accessorReads, 0);

  const sparseGraph = structuredClone(graphPolicyInput());
  delete sparseGraph.appGraph[0];
  assert.throws(
    () => verifyDesenAppPublishedHostUpdateGraphPolicy(sparseGraph),
    expectedError("OPTIONS_INVALID"),
  );

  const extraKeyGraph = structuredClone(graphPolicyInput());
  Object.defineProperty(extraKeyGraph.appGraph, "unexpected", {
    configurable: true,
    value: "authority",
  });
  assert.throws(
    () => verifyDesenAppPublishedHostUpdateGraphPolicy(extraKeyGraph),
    expectedError("OPTIONS_INVALID"),
  );

  let proxyTrapReads = 0;
  const proxyGraph = structuredClone(graphPolicyInput());
  proxyGraph.appGraph = new Proxy(proxyGraph.appGraph, {
    get() {
      proxyTrapReads += 1;
      throw new Error("graph proxy getter must not execute");
    },
    getOwnPropertyDescriptor() {
      proxyTrapReads += 1;
      throw new Error("graph proxy descriptor trap must not execute");
    },
    getPrototypeOf() {
      proxyTrapReads += 1;
      throw new Error("graph proxy prototype trap must not execute");
    },
    ownKeys() {
      proxyTrapReads += 1;
      throw new Error("graph proxy ownKeys trap must not execute");
    },
  });
  assert.throws(
    () => verifyDesenAppPublishedHostUpdateGraphPolicy(proxyGraph),
    expectedError("OPTIONS_INVALID"),
  );
  assert.equal(proxyTrapReads, 0);

  let outOfRangeAccessorReads = 0;
  const outOfRangeGraph = structuredClone(graphPolicyInput());
  const outOfRangeImports = outOfRangeGraph.appGraph.find(
    (entry) => entry.imports.length > 0,
  ).imports;
  Object.defineProperty(outOfRangeImports, "4294967295", {
    configurable: true,
    enumerable: true,
    get() {
      outOfRangeAccessorReads += 1;
      return "caller-owned-authority";
    },
  });
  assert.throws(
    () => verifyDesenAppPublishedHostUpdateGraphPolicy(outOfRangeGraph),
    expectedError("OPTIONS_INVALID"),
  );
  assert.equal(outOfRangeAccessorReads, 0);

  const sparseImportsGraph = structuredClone(graphPolicyInput());
  const sparseImports = sparseImportsGraph.appGraph.find(
    (entry) => entry.imports.length > 0,
  ).imports;
  delete sparseImports[0];
  assert.throws(
    () => verifyDesenAppPublishedHostUpdateGraphPolicy(sparseImportsGraph),
    expectedError("OPTIONS_INVALID"),
  );

  const symbolImportsGraph = structuredClone(graphPolicyInput());
  const symbolImports = symbolImportsGraph.appGraph.find(
    (entry) => entry.imports.length > 0,
  ).imports;
  Object.defineProperty(symbolImports, Symbol("caller-owned-authority"), {
    value: "caller-owned-authority",
  });
  assert.throws(
    () => verifyDesenAppPublishedHostUpdateGraphPolicy(symbolImportsGraph),
    expectedError("OPTIONS_INVALID"),
  );

  const revokedImportsGraph = structuredClone(graphPolicyInput());
  const revokedImportsEntry = revokedImportsGraph.appGraph.find(
    (entry) => entry.imports.length > 0,
  );
  const revokedImports = Proxy.revocable(revokedImportsEntry.imports, {});
  revokedImportsEntry.imports = revokedImports.proxy;
  revokedImports.revoke();
  assert.throws(
    () => verifyDesenAppPublishedHostUpdateGraphPolicy(revokedImportsGraph),
    expectedError("OPTIONS_INVALID"),
  );

  const mutated = structuredClone(graphPolicyInput());
  const main = mutated.appGraph.find(({ id }) => id === "apps/desen-app/src/main.tsx");
  main.imports = main.imports.filter(
    (relativePath) => relativePath !== "apps/desen-app/src/local-runtime-publication.ts",
  );
  assert.throws(
    () => verifyDesenAppPublishedHostUpdateGraphPolicy(mutated),
    expectedError("VITE_GRAPH_DRIFT"),
  );
});

test(DESEN_APP_PUBLISHED_HOST_UPDATE_ROOT_TEST_NAMES[5], () => {
  const browser = verifyDesenAppPublishedHostUpdateBrowserPolicy(browserPolicyInput);
  assert.deepEqual(browser, built.artifact.authority.browser);
  assert.equal(browser.visibleSourceGenerationA, 2);
  assert.equal(browser.visibleSourceGenerationB, 3);
  assert.equal(browser.visibleChannelGenerationA, 1);
  assert.equal(browser.visibleChannelGenerationB, 2);
  assert.equal(browser.hostBuildFingerprintStableAcrossAAndB, true);
  assert.equal(browser.directDomOrNetworkMutationUsed, false);
  assert.throws(
    () =>
      verifyDesenAppPublishedHostUpdateBrowserPolicy({
        ...browserPolicyInput,
        spec: replaceOnce(
          browserPolicyInput.spec,
          "const buildBefore = await hostBuildFingerprint(request);",
          "const buildBefore = 'unobserved';",
        ),
      }),
    expectedError("BROWSER_POLICY_VIOLATION"),
  );
  const callbackOpening = ["}) => {", "  const appErrors: string[] = [];"].join("\n");
  for (const bypass of [
    "  return;",
    "  if (Date.now() > 0) return;",
    "  test.skip();",
    '  test.describe.skip("disabled", () => undefined);',
  ]) {
    assert.throws(
      () =>
        verifyDesenAppPublishedHostUpdateBrowserPolicy({
          ...browserPolicyInput,
          spec: replaceOnce(
            browserPolicyInput.spec,
            callbackOpening,
            ["}) => {", bypass, "  const appErrors: string[] = [];"].join("\n"),
          ),
        }),
      expectedError("BROWSER_POLICY_VIOLATION"),
    );
  }
  const nestedScenario = replaceOnce(
    replaceOnce(
      browserPolicyInput.spec,
      callbackOpening,
      ["}) => {", "  if (false) {", "    const appErrors: string[] = [];"].join("\n"),
    ),
    [
      '  await host.screenshot({ path: test.info().outputPath("published-layout-update.png") });',
      "});",
    ].join("\n"),
    [
      '  await host.screenshot({ path: test.info().outputPath("published-layout-update.png") });',
      "  }",
      "});",
    ].join("\n"),
  );
  assert.throws(
    () =>
      verifyDesenAppPublishedHostUpdateBrowserPolicy({
        ...browserPolicyInput,
        spec: nestedScenario,
      }),
    expectedError("BROWSER_POLICY_VIOLATION"),
  );
  const finalRevisionReloadBlock = [
    "  await host.reload();",
    "  await expect(host.getByText(UPDATED_LABEL, { exact: true })).toBeVisible();",
    "  await expect(host.getByText(STABLE_LABEL, { exact: true })).toBeVisible();",
  ].join("\n");
  assert.throws(
    () =>
      verifyDesenAppPublishedHostUpdateBrowserPolicy({
        ...browserPolicyInput,
        spec: replaceOnce(
          browserPolicyInput.spec,
          finalRevisionReloadBlock,
          "  await host.reload();",
        ),
      }),
    expectedError("BROWSER_POLICY_VIOLATION"),
  );
  const withoutFinalReload = replaceOnce(
    browserPolicyInput.spec,
    `\n${finalRevisionReloadBlock}`,
    "",
  );
  assert.throws(
    () =>
      verifyDesenAppPublishedHostUpdateBrowserPolicy({
        ...browserPolicyInput,
        spec: replaceOnce(
          withoutFinalReload,
          "  const updatedReceipt = await publish(page);",
          `${finalRevisionReloadBlock}\n  const updatedReceipt = await publish(page);`,
        ),
      }),
    expectedError("BROWSER_POLICY_VIOLATION"),
  );
  assert.throws(
    () =>
      verifyDesenAppPublishedHostUpdateBrowserPolicy({
        ...browserPolicyInput,
        server: replaceOnce(
          browserPolicyInput.server,
          [
            "  activationBridge = await openDesenAppLocalPublicationHost({",
            "    apiToken: activationToken,",
          ].join("\n"),
          [
            "  activationBridge = await openDesenAppLocalPublicationHost({",
            "    apiToken: controlPlaneToken,",
          ].join("\n"),
        ),
      }),
    expectedError("BROWSER_POLICY_VIOLATION"),
  );
});

test(DESEN_APP_PUBLISHED_HOST_UPDATE_ROOT_TEST_NAMES[6], async () => {
  const boundary = built.artifact.authority.dependencyBoundary;
  assert.equal(boundary.cases.length, 4);
  assert.equal(boundary.publicControlPlaneEntryOnly, true);
  assert.equal(boundary.publicReferenceHostServerEntryOnly, true);
  assert.equal(boundary.exactLocalActivationBridgeOnly, true);
  assert.equal(boundary.neighboringDevModulesDenied, true);
  assert.equal(boundary.otherBrowserImportersDenied, true);
  const configurationPath = "dependency-cruiser.config.cjs";
  const configuration = await readFile(path.join(ROOT, configurationPath));
  await assert.rejects(
    buildDesenAppPublishedHostUpdateEvidence({
      fileOverrides: new Map([
        [
          configurationPath,
          Buffer.from(
            replaceOnce(
              configuration.toString("utf8"),
              "desen-app-browser-e2e-published-server-reference-host-public-root-only",
              "removed-reference-host-public-root-rule",
            ),
          ),
        ],
      ]),
    }),
    expectedError("BOUNDARY_POLICY_VIOLATION"),
  );
  const browserPackagePath = "apps/desen-app-browser-e2e/package.json";
  const browserPackage = await readFile(path.join(ROOT, browserPackagePath), "utf8");
  await assert.rejects(
    buildDesenAppPublishedHostUpdateEvidence({
      fileOverrides: new Map([
        [
          browserPackagePath,
          Buffer.from(
            replaceOnce(
              browserPackage,
              "pnpm --filter @desen/reference-host-web... build",
              "pnpm --filter @desen/reference-host-web build",
            ),
          ),
        ],
      ]),
    }),
    expectedError("SOURCE_POLICY_VIOLATION"),
  );
});

test(DESEN_APP_PUBLISHED_HOST_UPDATE_ROOT_TEST_NAMES[7], () => {
  const claim = built.artifact.claim;
  assert.equal(claim.taskStatus, "DONE");
  assert.equal(claim.p07Status, "PROVEN");
  assert.equal(claim.m10T05Closed, true);
  assert.equal(claim.visibleNormalProductAuthoring, true);
  assert.equal(claim.twoSavedPublishedAndActivatedRevisions, true);
  assert.equal(claim.productionDeploymentCovered, false);
  assert.equal(claim.remoteHostCovered, false);
  assert.equal(claim.invalidPublicationCovered, false);
  assert.equal(claim.lastKnownGoodRecoveryCovered, false);
  assert.equal(claim.m10T06Closed, false);
  assert.equal(claim.m10T07Closed, false);
  assert.equal(claim.m10T08Closed, false);
  assert.equal(claim.m10T09Closed, false);
  assert.equal(claim.g10Closed, false);
});

test(DESEN_APP_PUBLISHED_HOST_UPDATE_ROOT_TEST_NAMES[8], async () => {
  const second = await buildDesenAppPublishedHostUpdateEvidence();
  assert.deepEqual(second.artifactBytes, built.artifactBytes);
  assert.equal(second.artifactSha256, built.artifactSha256);
  assert.equal(verified.artifactSha256, DESEN_APP_PUBLISHED_HOST_UPDATE_ARTIFACT_PIN.sha256);
  assert.equal(verified.browserExecutedByVerifier, false);
  assert.equal(verified.deterministicReaderStartsListener, false);
  assert.equal(verified.viteBuildsExecutedByVerifier, true);
  assert.equal(verified.viteBuildOutputWritten, false);
});

test(DESEN_APP_PUBLISHED_HOST_UPDATE_ROOT_TEST_NAMES[9], async () => {
  const parentBytes = await readFile(path.join(ROOT, DESEN_APP_PUBLISHED_HOST_UPDATE_T04_PIN.path));
  await assert.rejects(
    buildDesenAppPublishedHostUpdateEvidence({
      fileOverrides: new Map([
        [DESEN_APP_PUBLISHED_HOST_UPDATE_T04_PIN.path, changedByte(parentBytes)],
      ]),
    }),
    expectedError("PARENT_DRIFT"),
  );
  const bridgeBytes = await readFile(
    path.join(ROOT, DESEN_APP_T04_HISTORICAL_READER_BRIDGE_PIN.path),
  );
  await assert.rejects(
    buildDesenAppPublishedHostUpdateEvidence({
      fileOverrides: new Map([
        [DESEN_APP_T04_HISTORICAL_READER_BRIDGE_PIN.path, changedByte(bridgeBytes)],
      ]),
    }),
    expectedError("HISTORICAL_BRIDGE_DRIFT"),
  );
  await assert.rejects(
    verifyDesenAppPublishedHostUpdateEvidence({ artifactBytes: changedByte(artifactBytes) }),
    expectedError("ARTIFACT_DRIFT"),
  );
  const report = await readFile(path.join(ROOT, REPORT_PATH));
  await assert.rejects(
    verifyDesenAppPublishedHostUpdateEvidence({
      artifactBytes,
      proofDocument: Buffer.from(
        replaceOnce(report.toString("utf8"), "Status: DONE", "Status: OPEN"),
      ),
    }),
    expectedError("PROOF_DOCUMENT_DRIFT"),
  );

  const unbuiltWorkspace = await realpath(
    await mkdtemp(path.join(os.tmpdir(), "desen-app-t05-preflight-")),
  );
  temporaryDirectories.push(unbuiltWorkspace);
  await assert.rejects(
    verifyDesenAppPublishedHostUpdateEvidence({
      artifactBytes: changedByte(artifactBytes),
      proofDocument: report,
      buildOptions: { workspaceRoot: unbuiltWorkspace },
    }),
    expectedError("ARTIFACT_DRIFT"),
  );
  await assert.rejects(
    verifyDesenAppPublishedHostUpdateEvidence({
      artifactBytes,
      proofDocument: Buffer.from(
        replaceOnce(report.toString("utf8"), "Status: DONE", "Status: OPEN"),
      ),
      buildOptions: { workspaceRoot: unbuiltWorkspace },
    }),
    expectedError("PROOF_DOCUMENT_DRIFT"),
  );
  const invalidBuildOptions = { workspaceRoot: unbuiltWorkspace };
  const invalidBuildVerification = verifyDesenAppPublishedHostUpdateEvidence({
    artifactBytes,
    proofDocument: report,
    buildOptions: invalidBuildOptions,
  });
  invalidBuildOptions.workspaceRoot = ROOT;
  await assert.rejects(invalidBuildVerification, expectedError("SOURCE_INVENTORY_DRIFT"));

  let artifactBytesProxyTrapReads = 0;
  const artifactBytesProxy = new Proxy(Buffer.from(artifactBytes), {
    get() {
      artifactBytesProxyTrapReads += 1;
      throw new Error("artifactBytes proxy getter must not execute");
    },
    getOwnPropertyDescriptor() {
      artifactBytesProxyTrapReads += 1;
      throw new Error("artifactBytes proxy descriptor trap must not execute");
    },
    getPrototypeOf() {
      artifactBytesProxyTrapReads += 1;
      throw new Error("artifactBytes proxy prototype trap must not execute");
    },
    ownKeys() {
      artifactBytesProxyTrapReads += 1;
      throw new Error("artifactBytes proxy ownKeys trap must not execute");
    },
  });
  await assert.rejects(
    verifyDesenAppPublishedHostUpdateEvidence({ artifactBytes: artifactBytesProxy }),
    expectedError("OPTIONS_INVALID"),
  );
  assert.equal(artifactBytesProxyTrapReads, 0);

  let proofDocumentProxyTrapReads = 0;
  const proofDocumentProxy = new Proxy(Buffer.from(report), {
    get() {
      proofDocumentProxyTrapReads += 1;
      throw new Error("proofDocument proxy getter must not execute");
    },
    getOwnPropertyDescriptor() {
      proofDocumentProxyTrapReads += 1;
      throw new Error("proofDocument proxy descriptor trap must not execute");
    },
    getPrototypeOf() {
      proofDocumentProxyTrapReads += 1;
      throw new Error("proofDocument proxy prototype trap must not execute");
    },
    ownKeys() {
      proofDocumentProxyTrapReads += 1;
      throw new Error("proofDocument proxy ownKeys trap must not execute");
    },
  });
  await assert.rejects(
    verifyDesenAppPublishedHostUpdateEvidence({
      artifactBytes,
      proofDocument: proofDocumentProxy,
    }),
    expectedError("OPTIONS_INVALID"),
  );
  assert.equal(proofDocumentProxyTrapReads, 0);

  let byteAccessorReads = 0;
  const accessorArtifactBytes = new Uint8Array(artifactBytes);
  Object.defineProperty(accessorArtifactBytes, "valueOf", {
    configurable: true,
    get() {
      byteAccessorReads += 1;
      throw new Error("byte valueOf getter must not execute");
    },
  });
  Object.defineProperty(accessorArtifactBytes, Symbol.iterator, {
    configurable: true,
    get() {
      byteAccessorReads += 1;
      throw new Error("byte iterator getter must not execute");
    },
  });
  const accessorByteVerification = await verifyDesenAppPublishedHostUpdateEvidence({
    artifactBytes: accessorArtifactBytes,
    proofDocument: report,
  });
  assert.equal(accessorByteVerification.result, "PASS");
  assert.equal(byteAccessorReads, 0);

  const detachedArtifactBytes = new Uint8Array(artifactBytes);
  structuredClone(detachedArtifactBytes.buffer, {
    transfer: [detachedArtifactBytes.buffer],
  });
  await assert.rejects(
    verifyDesenAppPublishedHostUpdateEvidence({ artifactBytes: detachedArtifactBytes }),
    expectedError("OPTIONS_INVALID"),
  );

  const initiallyInvalidArtifactBytes = changedByte(artifactBytes);
  const initiallyInvalidArtifactVerification = verifyDesenAppPublishedHostUpdateEvidence({
    artifactBytes: initiallyInvalidArtifactBytes,
    proofDocument: report,
  });
  initiallyInvalidArtifactBytes.set(artifactBytes);
  await assert.rejects(initiallyInvalidArtifactVerification, expectedError("ARTIFACT_DRIFT"));

  const initiallyInvalidProofDocument = Buffer.from(
    replaceOnce(report.toString("utf8"), "Status: DONE", "Status: OPEN"),
  );
  const initiallyInvalidProofVerification = verifyDesenAppPublishedHostUpdateEvidence({
    artifactBytes,
    proofDocument: initiallyInvalidProofDocument,
  });
  initiallyInvalidProofDocument.set(report);
  await assert.rejects(initiallyInvalidProofVerification, expectedError("PROOF_DOCUMENT_DRIFT"));

  const initiallyValidArtifactBytes = Buffer.from(artifactBytes);
  const initiallyValidProofDocument = Buffer.from(report);
  const initiallyValidParentBytes = Buffer.from(parentBytes);
  const initiallyValidBuildOptions = {
    workspaceRoot: ROOT,
    fileOverrides: new Map([
      [DESEN_APP_PUBLISHED_HOST_UPDATE_T04_PIN.path, initiallyValidParentBytes],
    ]),
  };
  const capturedVerification = verifyDesenAppPublishedHostUpdateEvidence({
    artifactBytes: initiallyValidArtifactBytes,
    proofDocument: initiallyValidProofDocument,
    buildOptions: initiallyValidBuildOptions,
  });
  initiallyValidArtifactBytes[0] ^= 1;
  initiallyValidProofDocument[0] ^= 1;
  initiallyValidBuildOptions.workspaceRoot = unbuiltWorkspace;
  initiallyValidParentBytes[0] ^= 1;
  initiallyValidBuildOptions.fileOverrides.set(SOURCE_PATHS.main, Buffer.from("invalid source"));
  assert.equal((await capturedVerification).result, "PASS");

  let fileOverridesProxyTrapReads = 0;
  const fileOverridesProxy = new Proxy(new Map(), {
    get() {
      fileOverridesProxyTrapReads += 1;
      throw new Error("fileOverrides proxy getter must not execute");
    },
    getOwnPropertyDescriptor() {
      fileOverridesProxyTrapReads += 1;
      throw new Error("fileOverrides proxy descriptor trap must not execute");
    },
    getPrototypeOf() {
      fileOverridesProxyTrapReads += 1;
      throw new Error("fileOverrides proxy prototype trap must not execute");
    },
    ownKeys() {
      fileOverridesProxyTrapReads += 1;
      throw new Error("fileOverrides proxy ownKeys trap must not execute");
    },
  });
  await assert.rejects(
    buildDesenAppPublishedHostUpdateEvidence({ fileOverrides: fileOverridesProxy }),
    expectedError("OPTIONS_INVALID"),
  );
  await assert.rejects(
    verifyDesenAppPublishedHostUpdateEvidence({
      artifactBytes,
      proofDocument: report,
      buildOptions: { fileOverrides: fileOverridesProxy },
    }),
    expectedError("OPTIONS_INVALID"),
  );
  assert.equal(fileOverridesProxyTrapReads, 0);

  let outerOptionsProxyTrapReads = 0;
  const outerOptionsProxy = new Proxy(Object.create(null), {
    get() {
      outerOptionsProxyTrapReads += 1;
      throw new Error("outer options proxy getter must not execute");
    },
    getOwnPropertyDescriptor() {
      outerOptionsProxyTrapReads += 1;
      throw new Error("outer options proxy descriptor trap must not execute");
    },
    getPrototypeOf() {
      outerOptionsProxyTrapReads += 1;
      throw new Error("outer options proxy prototype trap must not execute");
    },
    ownKeys() {
      outerOptionsProxyTrapReads += 1;
      throw new Error("outer options proxy ownKeys trap must not execute");
    },
  });
  await assert.rejects(
    buildDesenAppPublishedHostUpdateEvidence(outerOptionsProxy),
    expectedError("OPTIONS_INVALID"),
  );
  assert.equal(outerOptionsProxyTrapReads, 0);

  const revokedOuterOptions = Proxy.revocable(Object.create(null), {});
  revokedOuterOptions.revoke();
  await assert.rejects(
    buildDesenAppPublishedHostUpdateEvidence(revokedOuterOptions.proxy),
    expectedError("OPTIONS_INVALID"),
  );

  await assert.rejects(
    verifyDesenAppPublishedHostUpdateEvidence({ artifactPath: 1 }),
    expectedError("OPTIONS_INVALID"),
  );
  await assert.rejects(
    verifyDesenAppPublishedHostUpdateEvidence({ proofDocumentPath: 1 }),
    expectedError("OPTIONS_INVALID"),
  );
  await assert.rejects(
    authenticateDesenAppPublishedHostUpdateSuccessor({ workspaceRoot: 1 }),
    expectedError("OPTIONS_INVALID"),
  );
  await assert.rejects(
    writeDesenAppPublishedHostUpdateEvidence({ artifactPath: 1 }),
    expectedError("OPTIONS_INVALID"),
  );

  let overrideBytesProxyTrapReads = 0;
  const overrideBytesProxy = new Proxy(Buffer.from(sourcePolicyInput.main), {
    get() {
      overrideBytesProxyTrapReads += 1;
      throw new Error("fileOverrides byte proxy getter must not execute");
    },
    getOwnPropertyDescriptor() {
      overrideBytesProxyTrapReads += 1;
      throw new Error("fileOverrides byte proxy descriptor trap must not execute");
    },
    getPrototypeOf() {
      overrideBytesProxyTrapReads += 1;
      throw new Error("fileOverrides byte proxy prototype trap must not execute");
    },
    ownKeys() {
      overrideBytesProxyTrapReads += 1;
      throw new Error("fileOverrides byte proxy ownKeys trap must not execute");
    },
  });
  await assert.rejects(
    buildDesenAppPublishedHostUpdateEvidence({
      fileOverrides: new Map([[SOURCE_PATHS.main, overrideBytesProxy]]),
    }),
    expectedError("OPTIONS_INVALID"),
  );
  assert.equal(overrideBytesProxyTrapReads, 0);

  let historicalOverridesProxyTrapReads = 0;
  const historicalOverridesProxy = new Proxy(new Map(), {
    get() {
      historicalOverridesProxyTrapReads += 1;
      throw new Error("historical fileOverrides proxy getter must not execute");
    },
    getOwnPropertyDescriptor() {
      historicalOverridesProxyTrapReads += 1;
      throw new Error("historical fileOverrides proxy descriptor trap must not execute");
    },
    getPrototypeOf() {
      historicalOverridesProxyTrapReads += 1;
      throw new Error("historical fileOverrides proxy prototype trap must not execute");
    },
    ownKeys() {
      historicalOverridesProxyTrapReads += 1;
      throw new Error("historical fileOverrides proxy ownKeys trap must not execute");
    },
  });
  assert.throws(
    () => materializeDesenAppT04HistoricalReaderFileOverrides(successor, historicalOverridesProxy),
    expectedError("OPTIONS_INVALID"),
  );
  assert.equal(historicalOverridesProxyTrapReads, 0);

  let historicalBytesProxyTrapReads = 0;
  const historicalBytesProxy = new Proxy(Buffer.from(sourcePolicyInput.main), {
    get() {
      historicalBytesProxyTrapReads += 1;
      throw new Error("historical byte proxy getter must not execute");
    },
    getOwnPropertyDescriptor() {
      historicalBytesProxyTrapReads += 1;
      throw new Error("historical byte proxy descriptor trap must not execute");
    },
    getPrototypeOf() {
      historicalBytesProxyTrapReads += 1;
      throw new Error("historical byte proxy prototype trap must not execute");
    },
    ownKeys() {
      historicalBytesProxyTrapReads += 1;
      throw new Error("historical byte proxy ownKeys trap must not execute");
    },
  });
  assert.throws(
    () =>
      materializeDesenAppT04HistoricalReaderFileOverrides(
        successor,
        new Map([[SOURCE_PATHS.main, historicalBytesProxy]]),
      ),
    expectedError("OPTIONS_INVALID"),
  );
  assert.equal(historicalBytesProxyTrapReads, 0);

  let accessorReads = 0;
  const accessorOptions = Object.defineProperty({}, "workspaceRoot", {
    enumerable: true,
    get() {
      accessorReads += 1;
      return ROOT;
    },
  });
  await assert.rejects(
    buildDesenAppPublishedHostUpdateEvidence(accessorOptions),
    expectedError("OPTIONS_INVALID"),
  );
  assert.equal(accessorReads, 0);

  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-app-t05-proof-"));
  temporaryDirectories.push(directory);
  const target = path.join(directory, "retained-artifact.json");
  await writeFile(target, artifactBytes);
  const destination = path.join(directory, "artifact.json");
  await symlink(target, destination);
  await assert.rejects(
    writeDesenAppPublishedHostUpdateEvidence({ artifactPath: destination }),
    expectedError("ARTIFACT_WRITE_UNSAFE"),
  );
  assert.deepEqual(await readFile(target), artifactBytes);
});
