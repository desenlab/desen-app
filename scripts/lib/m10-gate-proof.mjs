import { createHash } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import { lstat, open, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { types as utilTypes } from "node:util";

import { readCheckpointedFrozenArtifact } from "../ci/proof-reader-checkpoints.mjs";
import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";
import { buildCurrentDesenAppPublishedHostUpdateGraphAudit } from "./desen-app-published-host-update-proof.mjs";
import { verifyRuntimeCoreBaselineEvidence } from "./runtime-core-baseline-proof.mjs";

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ARTIFACT_RELATIVE_PATH = "docs/proof/artifacts/desen-app-0.1.0-m10-gate.json";
const PROOF_DOCUMENT_RELATIVE_PATH = "docs/proof/DESEN-APP-M10-GATE.md";
const ROOT_PACKAGE_PATH = "package.json";
const BROWSER_PACKAGE_PATH = "apps/desen-app-browser-e2e/package.json";
const WORKFLOW_PATH = ".github/workflows/ci.yml";
const MAX_AUTHORITY_BYTES = 2 * 1024 * 1024;
const READ_FLAGS =
  fileConstants.O_RDONLY | (fileConstants.O_NOFOLLOW ?? 0) | (fileConstants.O_NONBLOCK ?? 0);

/** Exact completed M10 task artifacts required by the terminal gate. */
export const M10_GATE_PARENT_PINS = Object.freeze([
  Object.freeze({
    task: "M10-T01C",
    path: "docs/proof/artifacts/desen-app-0.1.0-evergreen-product-composition.json",
    bytes: 19_299,
    sha256: "779434ca834b8d770c726d905408f0a3d0a7145abbc6eaf2b81f1e77466b46ac",
  }),
  Object.freeze({
    task: "M10-T02",
    path: "docs/proof/artifacts/desen-app-0.1.0-input-pending-fixture.json",
    bytes: 14_261,
    sha256: "161202698b013775cbc89625ecea1f6894e9abcd927fb2eb660dff71652ba43d",
  }),
  Object.freeze({
    task: "M10-T03",
    path: "docs/proof/artifacts/desen-app-0.1.0-failure-fixture.json",
    bytes: 16_868,
    sha256: "bde909f8dbc4837c70627bab454d3dc5a936bd0abb6d70ec22b9cffbdb0e6a20",
  }),
  Object.freeze({
    task: "M10-T04",
    path: "docs/proof/artifacts/desen-app-0.1.0-success-host-operation.json",
    bytes: 22_456,
    sha256: "d9d841af06ec9efc51c3f1c74079f0aa4d5e1c7e996f3b97df7e277e4b1f8423",
  }),
  Object.freeze({
    task: "M10-T05",
    path: "docs/proof/artifacts/desen-app-0.1.0-published-host-update.json",
    bytes: 189_123,
    sha256: "80c0b815a813ef462233b48a7fffe7c4d0bbf391aefc68eb9a6174da6bd84bd3",
  }),
  Object.freeze({
    task: "M10-T06",
    path: "docs/proof/artifacts/desen-app-0.1.0-invalid-publication.json",
    bytes: 193_291,
    sha256: "1eb4260306d20fc87558edc4da4027c96bbb84598b758b242b8530010fe6071a",
  }),
  Object.freeze({
    task: "M10-T07",
    path: "docs/proof/artifacts/desen-app-0.1.0-last-known-good-recovery.json",
    bytes: 304_094,
    sha256: "5e589bc8022de3ccf3add7a9ebab78006ecca6e72628e165f54eef4fd8b90b68",
  }),
  Object.freeze({
    task: "M10-T08",
    path: "docs/proof/artifacts/desen-app-0.1.0-repeatable-demo.json",
    bytes: 319_719,
    sha256: "048041735b406dab4eefa6b0d02e2c039d3b3c3629d4dfc0cd7489a3c9f286f5",
  }),
  Object.freeze({
    task: "M10-T09",
    path: "docs/proof/artifacts/runtime-core-baseline.json",
    bytes: 271,
    sha256: "fbda58d72ccff36d530368422dd7fd82c73dcca359c29e3a6667e8ae4b9b424b",
  }),
]);

/** Complete package-owned browser suite retained by root G10 execution. */
export const M10_GATE_BROWSER_COMMAND =
  "pnpm --filter @desen/app-web... build && pnpm --filter @desen/reference-host-web-server... build && pnpm --filter @desen/reference-host-web... build && pnpm run typecheck && pnpm run build && playwright test --config playwright.config.ts && playwright test --config product-playwright.config.ts && playwright test --config input-pending-playwright.config.ts && playwright test --config failure-playwright.config.ts && playwright test --config success-host-playwright.config.ts && playwright test --config published-host-playwright.config.ts && playwright test --config invalid-publication-playwright.config.ts && playwright test --config restart-recovery-playwright.config.ts && playwright test --config repeatable-demo-playwright.config.ts";

/** Exact nine independent Chromium configurations required by G10. */
export const M10_GATE_BROWSER_CONFIGS = Object.freeze([
  "playwright.config.ts",
  "product-playwright.config.ts",
  "input-pending-playwright.config.ts",
  "failure-playwright.config.ts",
  "success-host-playwright.config.ts",
  "published-host-playwright.config.ts",
  "invalid-publication-playwright.config.ts",
  "restart-recovery-playwright.config.ts",
  "repeatable-demo-playwright.config.ts",
]);

/** Stable G10 root-test declarations used by the deterministic evidence contract. */
export const M10_GATE_ROOT_TEST_NAMES = Object.freeze([
  "G10 authenticates every exact completed M10 parent",
  "G10 exposes real exhaustive and nine-journey root commands",
  "G10 freshly audits the independent host and frozen Runtime Core",
  "G10 rejects every parent artifact mutation",
  "G10 rejects root coordinator substitution omission and recursion",
  "G10 rejects browser journey omission duplication and reordering",
  "G10 rejects hosted browser command bypass",
  "G10 builds deterministic immutable evidence",
  "G10 rejects unsafe options overrides and artifact destinations",
  "G10 verifies its checkpointed artifact and visible report",
]);

/** Stable redacted failure for the M10 gate evidence boundary. */
export class M10GateProofError extends Error {
  /** Creates one code-bearing G10 failure without embedding source or credential bytes. */
  constructor(code, message) {
    super(message);
    this.name = "M10GateProofError";
    this.code = `M10_GATE_${code}`;
  }
}

function fail(code, message) {
  throw new M10GateProofError(code, message);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function captureOptions(rawOptions, allowedKeys) {
  const value = rawOptions === undefined ? {} : rawOptions;
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    utilTypes.isProxy(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    fail("OPTIONS_INVALID", "Options must be one inert plain record.");
  }
  const captured = Object.create(null);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor =
      typeof key === "string" ? Object.getOwnPropertyDescriptor(value, key) : undefined;
    if (
      typeof key !== "string" ||
      !allowedKeys.includes(key) ||
      !descriptor?.enumerable ||
      !("value" in descriptor)
    ) {
      fail("OPTIONS_INVALID", "Options contain an unknown or executable field.");
    }
    captured[key] = descriptor.value;
  }
  return Object.freeze(captured);
}

async function captureWorkspaceRoot(rawRoot = WORKSPACE_ROOT) {
  if (
    typeof rawRoot !== "string" ||
    rawRoot.length === 0 ||
    rawRoot.length > 4096 ||
    !path.isAbsolute(rawRoot) ||
    path.resolve(rawRoot) !== rawRoot ||
    rawRoot.includes("\0")
  ) {
    fail("OPTIONS_INVALID", "workspaceRoot must be one canonical absolute path.");
  }
  try {
    const entry = await lstat(rawRoot);
    if (!entry.isDirectory() || entry.isSymbolicLink() || (await realpath(rawRoot)) !== rawRoot)
      throw new Error();
  } catch {
    fail("AUTHORITY_UNSAFE", "Workspace authority is not one canonical directory.");
  }
  return rawRoot;
}

function captureOverrides(rawOverrides) {
  if (rawOverrides === undefined) return new Map();
  if (!(rawOverrides instanceof Map) || utilTypes.isProxy(rawOverrides))
    fail("OPTIONS_INVALID", "fileOverrides must be one Map.");
  const allowed = new Set([
    ...M10_GATE_PARENT_PINS.map(({ path: artifactPath }) => artifactPath),
    ROOT_PACKAGE_PATH,
    BROWSER_PACKAGE_PATH,
    WORKFLOW_PATH,
  ]);
  const captured = new Map();
  for (const [relativePath, rawBytes] of rawOverrides) {
    if (!allowed.has(relativePath) || !Buffer.isBuffer(rawBytes))
      fail("OPTIONS_INVALID", "fileOverrides contains an unreviewed path or byte value.");
    captured.set(relativePath, Buffer.from(rawBytes));
  }
  return captured;
}

async function readRegularAuthority(workspaceRoot, relativePath, overrides) {
  const override = overrides.get(relativePath);
  if (override !== undefined) return Buffer.from(override);
  const target = path.join(workspaceRoot, relativePath);
  let handle;
  try {
    const before = await lstat(target, { bigint: true });
    if (
      !before.isFile() ||
      before.isSymbolicLink() ||
      before.nlink !== 1n ||
      before.size <= 0n ||
      before.size > BigInt(MAX_AUTHORITY_BYTES) ||
      (await realpath(target)) !== target
    )
      throw new Error();
    handle = await open(target, READ_FLAGS);
    const opened = await handle.stat({ bigint: true });
    if (opened.dev !== before.dev || opened.ino !== before.ino || opened.size !== before.size)
      throw new Error();
    const bytes = await handle.readFile();
    const after = await handle.stat({ bigint: true });
    if (
      bytes.byteLength !== Number(before.size) ||
      after.dev !== before.dev ||
      after.ino !== before.ino ||
      after.size !== before.size ||
      after.mtimeNs !== before.mtimeNs ||
      after.ctimeNs !== before.ctimeNs
    )
      throw new Error();
    return bytes;
  } catch {
    fail("AUTHORITY_UNSAFE", `Required authority is unavailable: ${relativePath}`);
  } finally {
    await handle?.close();
  }
}

function parseJson(bytes, label) {
  let value;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    fail("AUTHORITY_INVALID", `${label} is not valid UTF-8 JSON.`);
  }
  if (value === null || typeof value !== "object" || Array.isArray(value))
    fail("AUTHORITY_INVALID", `${label} must be one JSON object.`);
  return value;
}

function authenticateParents(parentBytes) {
  return M10_GATE_PARENT_PINS.map((pin) => {
    const bytes = parentBytes.get(pin.path);
    if (bytes.byteLength !== pin.bytes || sha256(bytes) !== pin.sha256)
      fail("PARENT_DRIFT", `${pin.task} evidence drifted.`);
    const artifact = parseJson(bytes, pin.task);
    if (artifact.schemaVersion !== 1 || artifact.task !== pin.task)
      fail("PARENT_DRIFT", `${pin.task} identity drifted.`);
    if (pin.task === "M10-T09") {
      if (
        artifact.profile !== "desen.runtime-core-baseline.v1" ||
        artifact.tree !== "3fa3613a3be63c749f40b6a0b55af5b40c675773"
      )
        fail("PARENT_DRIFT", "The Runtime Core baseline identity drifted.");
    } else if (artifact.result !== "PASS") {
      fail("PARENT_DRIFT", `${pin.task} no longer records PASS.`);
    }
    return Object.freeze({ ...pin });
  });
}

function exactMembership(script, member, label) {
  const parts = typeof script === "string" ? script.split(" && ") : [];
  if (parts.filter((part) => part === member).length !== 1)
    fail("WIRING_DRIFT", `${label} lost exact G10 membership.`);
}

function authenticateWiring(rootBytes, browserBytes, workflowBytes) {
  const root = parseJson(rootBytes, ROOT_PACKAGE_PATH);
  const browser = parseJson(browserBytes, BROWSER_PACKAGE_PATH);
  const expectedRoot = Object.freeze({
    proof: "pnpm check",
    "test:e2e": "pnpm --filter @desen/app-browser-e2e test:e2e",
    "generate:m10-gate": "node scripts/generate-m10-gate-proof.mjs",
    "verify:m10-gate": "node scripts/verify-m10-gate.mjs",
    "test:m10-gate": "node --test tests/m10-gate.test.mjs",
  });
  for (const [name, command] of Object.entries(expectedRoot))
    if (root.scripts?.[name] !== command)
      fail("WIRING_DRIFT", `Root script ${name} does not retain its exact G10 command.`);
  exactMembership(root.scripts?.test, "pnpm test:m10-gate", "Root test chain");
  exactMembership(root.scripts?.check, "pnpm verify:m10-gate", "Root check chain");
  if (root.scripts?.proof === "pnpm proof" || root.scripts?.check?.includes("pnpm proof"))
    fail("WIRING_DRIFT", "The G10 coordinator may not recurse.");
  if (
    browser.name !== "@desen/app-browser-e2e" ||
    browser.scripts?.["test:e2e"] !== M10_GATE_BROWSER_COMMAND
  )
    fail("WIRING_DRIFT", "The complete package-owned browser suite drifted.");
  const configurations = [
    ...M10_GATE_BROWSER_COMMAND.matchAll(/playwright test --config ([^ ]+)/gu),
  ].map((match) => match[1]);
  if (
    configurations.length !== M10_GATE_BROWSER_CONFIGS.length ||
    configurations.some((configuration, index) => configuration !== M10_GATE_BROWSER_CONFIGS[index])
  )
    fail("WIRING_DRIFT", "The browser configuration inventory drifted.");
  const workflow = new TextDecoder("utf-8", { fatal: true }).decode(workflowBytes);
  const hostedCommand = "run: pnpm --filter @desen/app-browser-e2e test:e2e";
  if (workflow.split(hostedCommand).length !== 2)
    fail("WIRING_DRIFT", "Hosted Browser E2E no longer executes the complete package suite once.");
  return Object.freeze({
    rootScripts: expectedRoot,
    exhaustiveCommand: "pnpm check",
    proofCommand: "pnpm proof",
    browserCommand: "pnpm test:e2e",
    packageBrowserCommand: M10_GATE_BROWSER_COMMAND,
    browserConfigurations: M10_GATE_BROWSER_CONFIGS,
    browserConfigurationCount: M10_GATE_BROWSER_CONFIGS.length,
    hostedBrowserUsesCompletePackageCommand: true,
  });
}

function projectGraphAudit(graph) {
  const audit = graph.runtimeResolution;
  const dynamicEdges = audit.app.dynamicEdges + audit.host.dynamicEdges;
  const unresolvedEdges = audit.app.unresolvedEdges + audit.host.unresolvedEdges;
  if (
    graph.referenceHostSourceAudit.publicAdapterRegistryCalls !== 1 ||
    graph.referenceHostSourceAudit.publicRuntimeReactSurfaceCalls !== 1 ||
    graph.referenceHostSourceAudit.publicReactRootCalls !== 1 ||
    dynamicEdges !== 0 ||
    unresolvedEdges !== 0 ||
    audit.noHandwrittenHostManagedTreePreservedByFreshHostAudit !== true ||
    audit.publicRegistryAndRuntimeOnly !== true ||
    audit.backingModulesStableAcrossObservations !== true ||
    audit.independentBuildsPerApplication !== 2
  )
    fail("HOST_AUDIT_FAILED", "Fresh App/host graph authority does not satisfy G10.");
  return Object.freeze({
    appSourceFiles: graph.appSourceAudit.completeSourceFiles,
    hostSourceFiles: graph.referenceHostSourceAudit.sourceFiles,
    hostJsxElements: graph.referenceHostSourceAudit.jsxElements,
    appModules: audit.app.moduleCount,
    hostModules: audit.host.moduleCount,
    sharedManagedModules: audit.sharedManagedModuleCount,
    dynamicEdges,
    unresolvedEdges,
    appGraphSha256: audit.app.graphSha256,
    hostGraphSha256: audit.host.graphSha256,
    appOutputIdentity: audit.appOutput.identitySha256,
    hostOutputIdentity: audit.hostOutput.identitySha256,
    backingSnapshotSha256: audit.backingSnapshotSha256,
    publicRegistryAndRuntimeOnly: true,
    noHandwrittenHostManagedTree: true,
    independentBuildsPerApplication: 2,
  });
}

function serializeArtifact(artifact) {
  return Buffer.from(`${JSON.stringify(artifact, null, 2)}\n`, "utf8");
}

/** Builds deterministic G10 evidence from exact parents plus fresh host/Core observations. */
export async function buildM10GateEvidence(rawOptions = undefined) {
  const options = captureOptions(rawOptions, ["workspaceRoot", "fileOverrides"]);
  const workspaceRoot = await captureWorkspaceRoot(options.workspaceRoot);
  const overrides = captureOverrides(options.fileOverrides);
  const paths = [
    ...M10_GATE_PARENT_PINS.map(({ path: artifactPath }) => artifactPath),
    ROOT_PACKAGE_PATH,
    BROWSER_PACKAGE_PATH,
    WORKFLOW_PATH,
  ];
  const [entries, graph, core] = await Promise.all([
    Promise.all(
      paths.map(async (relativePath) => [
        relativePath,
        await readRegularAuthority(workspaceRoot, relativePath, overrides),
      ]),
    ),
    buildCurrentDesenAppPublishedHostUpdateGraphAudit({ workspaceRoot }),
    verifyRuntimeCoreBaselineEvidence({ workspaceRoot }),
  ]);
  const files = new Map(entries);
  const parents = Object.freeze(authenticateParents(files));
  const wiring = authenticateWiring(
    files.get(ROOT_PACKAGE_PATH),
    files.get(BROWSER_PACKAGE_PATH),
    files.get(WORKFLOW_PATH),
  );
  const hostAudit = projectGraphAudit(graph);
  if (
    core.status !== "PASS" ||
    core.baseline.tree !== "3fa3613a3be63c749f40b6a0b55af5b40c675773" ||
    core.observation.tree !== core.baseline.tree ||
    core.observation.clean !== true
  )
    fail("CORE_BASELINE_FAILED", "Runtime Core no longer equals the committed M10 baseline.");
  const artifact = Object.freeze({
    schemaVersion: 1,
    gate: "G10",
    proofId: "m10-gate",
    profile: "desen.app.m10-gate-proof.v1",
    result: "PASS",
    parents,
    claim: Object.freeze({
      gateStatus: "DONE",
      noHandwrittenHostManagedTree: true,
      managedSurfaceChangesWithoutHostSourceChange: true,
      visibleNoCodeAuthoringAndPublication: true,
      typedPendingFailureSuccessAndNavigation: true,
      realHostOperationOutsideDocument: true,
      invalidPublicationRejected: true,
      lastKnownGoodPreservedAcrossRestart: true,
      repeatableTwoCycleDemo: true,
      runtimeCoreBaselineFrozen: true,
    }),
    authority: Object.freeze({
      wiring,
      hostAudit,
      runtimeCore: Object.freeze({
        path: core.baseline.path,
        objectFormat: core.baseline.objectFormat,
        captureCommit: core.baseline.captureCommit,
        tree: core.baseline.tree,
        trackedFiles: core.observation.trackedFiles,
        freshComparison: true,
      }),
    }),
    tests: Object.freeze({
      rootTestNames: M10_GATE_ROOT_TEST_NAMES,
      deterministicReaderRunsBrowser: false,
      browserExecutionIsSeparateAndRequired: true,
      hostedExactHeadRequired: true,
    }),
    nonClaims: Object.freeze([
      "G10 proves the reviewed local Web reference composition, not remote or multi-user deployment.",
      "G10 does not claim production authentication, native targets, Map, Sortable, domains, or package publication.",
      "The artifact records identity and fresh source/Core observations; it never substitutes for the required live Chromium and exhaustive executions.",
      "Local success alone does not authorize completion before exact-head pull-request CI and fresh main CI pass.",
    ]),
  });
  const artifactBytes = serializeArtifact(artifact);
  return Object.freeze({
    artifact,
    artifactBytes,
    artifactSha256: sha256(artifactBytes),
  });
}

async function readProofDocument(workspaceRoot) {
  return readRegularAuthority(workspaceRoot, PROOF_DOCUMENT_RELATIVE_PATH, new Map());
}

/** Verifies the checkpointed G10 artifact against fresh current authorities and its visible report. */
export async function verifyM10GateEvidence(rawOptions = undefined) {
  const options = captureOptions(rawOptions, ["workspaceRoot"]);
  const workspaceRoot = await captureWorkspaceRoot(options.workspaceRoot);
  const frozen = await readCheckpointedFrozenArtifact("G10", { workspaceRoot });
  if (frozen.path !== ARTIFACT_RELATIVE_PATH)
    fail("ARTIFACT_DRIFT", "Checkpointed G10 artifact path drifted.");
  const built = await buildM10GateEvidence({ workspaceRoot });
  if (!Buffer.from(frozen.bytes).equals(built.artifactBytes))
    fail("ARTIFACT_DRIFT", "Checkpointed G10 bytes differ from fresh evidence.");
  const proofDocument = new TextDecoder("utf-8", { fatal: true }).decode(
    await readProofDocument(workspaceRoot),
  );
  if (
    !proofDocument.includes("Status: DONE") ||
    !proofDocument.includes(`Final artifact: \`sha256:${built.artifactSha256}\``)
  )
    fail("REPORT_DRIFT", "The visible G10 report does not identify the verified artifact.");
  return Object.freeze({
    status: "PASS",
    gate: "G10",
    artifactBytes: built.artifactBytes.byteLength,
    artifactSha256: built.artifactSha256,
    checkpointHeadSha256: frozen.checkpointHeadSha256,
    parentArtifacts: built.artifact.parents.length,
    browserConfigurations: built.artifact.authority.wiring.browserConfigurationCount,
    hostModules: built.artifact.authority.hostAudit.hostModules,
    sharedManagedModules: built.artifact.authority.hostAudit.sharedManagedModules,
    runtimeCoreTree: built.artifact.authority.runtimeCore.tree,
    browserExecutedByVerifier: false,
  });
}

/** Writes exact deterministic G10 bytes atomically; an existing different artifact is rejected. */
export async function writeM10GateEvidence(rawOptions = undefined) {
  const options = captureOptions(rawOptions, [
    "workspaceRoot",
    "artifactPath",
    "beforeAtomicRename",
  ]);
  const workspaceRoot = await captureWorkspaceRoot(options.workspaceRoot);
  const artifactPath = options.artifactPath ?? path.join(workspaceRoot, ARTIFACT_RELATIVE_PATH);
  if (
    typeof artifactPath !== "string" ||
    !path.isAbsolute(artifactPath) ||
    path.resolve(artifactPath) !== artifactPath
  )
    fail("OPTIONS_INVALID", "artifactPath must be one canonical absolute path.");
  if (
    options.beforeAtomicRename !== undefined &&
    (typeof options.beforeAtomicRename !== "function" ||
      utilTypes.isProxy(options.beforeAtomicRename))
  )
    fail("OPTIONS_INVALID", "beforeAtomicRename must be one function.");
  const built = await buildM10GateEvidence({ workspaceRoot });
  try {
    const existing = await readFile(artifactPath).catch((error) => {
      if (error?.code === "ENOENT") return undefined;
      throw error;
    });
    if (existing !== undefined && !existing.equals(built.artifactBytes))
      fail("ARTIFACT_WRITE_UNSAFE", "Refusing to replace different G10 evidence.");
    await writeAtomicProofArtifact({
      artifactPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename: options.beforeAtomicRename,
    });
  } catch (error) {
    if (error instanceof M10GateProofError) throw error;
    fail("ARTIFACT_WRITE_UNSAFE", "Atomic G10 evidence write failed.");
  }
  return Object.freeze({
    artifactPath,
    artifactBytes: built.artifactBytes.byteLength,
    artifactSha256: built.artifactSha256,
  });
}

/** Relative tracked path of the deterministic G10 artifact. */
export const M10_GATE_ARTIFACT_PATH = ARTIFACT_RELATIVE_PATH;
