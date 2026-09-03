import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual, types as utilTypes } from "node:util";
import { gunzipSync } from "node:zlib";

import { format } from "prettier";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";
import {
  authenticateRedactedHistoricalArchive,
  getHistoricalArchiveRedactionPin,
  matchesAmendedHistoricalReceipt,
} from "./historical-archive-redaction.mjs";

const MODULE_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(MODULE_DIRECTORY, "../..");
const ARTIFACT_RELATIVE_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-evergreen-product-composition.json";
const PROOF_DOCUMENT_RELATIVE_PATH = "docs/proof/DESEN-APP-EVERGREEN-PRODUCT-COMPOSITION.md";
const PARENT_ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-visual-behavior-authoring.json";
const HISTORICAL_READER_BRIDGE_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-t01b-historical-reader-bridge.json.gz";
const T01C_HISTORICAL_READER_BRIDGE_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-t01c-historical-reader-bridge.json.gz";
const T01C_PREDECESSOR_GAP_PATHS = Object.freeze([
  "apps/desen-app-browser-e2e/package.json",
  "apps/desen-app/src/application.module.css",
  "apps/desen-app/src/behavior-controls.tsx",
  "apps/desen-app/test/authoring-connections.test.ts",
]);
const T04_PREDECESSOR_GAP_PATHS = Object.freeze([
  "apps/desen-app-browser-e2e/product-proof-server.mjs",
  "apps/desen-app/dev/local-dev-host.mjs",
  "apps/desen-app/dev/local-dev-host.test.mjs",
  "apps/desen-app/src/preview-controls.tsx",
  "apps/desen-app/test/main-lifecycle.test.tsx",
  "apps/desen-app/tsconfig.local-dev.json",
  "scripts/verify-boundary-fixtures.mjs",
  "tests/boundaries/README.md",
]);
const T01C_SUCCESSOR_ADDED_PATHS = Object.freeze([
  "apps/desen-app-browser-e2e/input-pending-fixture.pw.ts",
  "apps/desen-app-browser-e2e/input-pending-playwright.config.ts",
]);
const MAX_AUTHORITY_BYTES = 16 * 1_024 * 1_024;
const MAX_HISTORICAL_BRIDGE_BYTES = 4 * 1_024 * 1_024;
const MAX_HISTORICAL_BRIDGE_INFLATED_BYTES = 8 * 1_024 * 1_024;
const MAX_HISTORICAL_BRIDGE_DECODED_FILE_BYTES = 6 * 1_024 * 1_024;
const READ_FLAGS =
  fileConstants.O_RDONLY | (fileConstants.O_NOFOLLOW ?? 0) | (fileConstants.O_NONBLOCK ?? 0);

const SOURCE_PATHS = Object.freeze({
  referenceBrowserHarness: "apps/desen-app-browser-e2e/proof-application.tsx",
  adapterCanvas: "apps/desen-app/src/adapter-canvas.tsx",
  application: "apps/desen-app/src/application.tsx",
  authoringConnections: "apps/desen-app/src/authoring-connections.ts",
  authoringData: "apps/desen-app/src/authoring-data.ts",
  authoringEventActions: "apps/desen-app/src/authoring-event-actions.ts",
  authoringFixtures: "apps/desen-app/src/authoring-fixtures.ts",
  authoringPersistence: "apps/desen-app/src/authoring-persistence.ts",
  authoringPreview: "apps/desen-app/src/authoring-preview.ts",
  authoringPublication: "apps/desen-app/src/authoring-publication.ts",
  authoringScenarios: "apps/desen-app/src/authoring-scenarios.ts",
  eventActionPanel: "apps/desen-app/src/event-action-panel.tsx",
  main: "apps/desen-app/src/main.tsx",
  previewFidelity: "apps/desen-app/src/preview-fidelity.ts",
  productBootstrap: "apps/desen-app/src/product-bootstrap.tsx",
  projectData: "apps/desen-app/src/project-data.ts",
  publicationControls: "apps/desen-app/src/publication-controls.tsx",
  projectInventoryFixture: "apps/desen-app/src/project-inventory-fixture.ts",
  projectWorkspaceProfile: "apps/desen-app/src/project-workspace-profile.ts",
  referenceAuthoringProfile: "apps/desen-app/src/reference-authoring-profile.ts",
  referenceProjectFixtures: "apps/desen-app/src/reference-project-fixtures.ts",
  referenceWorkspaceProfile: "apps/desen-app/src/reference-sign-in-workspace-profile.ts",
});

const TEST_PATHS = Object.freeze([
  "apps/desen-app-browser-e2e/empty-project-to-sign-in.pw.ts",
  "apps/desen-app-browser-e2e/user-created-blank-project.pw.ts",
  "apps/desen-app/test/adapter-canvas.test.tsx",
  "apps/desen-app/test/application.test.tsx",
  "apps/desen-app/test/authoring-behavior-projection.test.ts",
  "apps/desen-app/test/authoring-data.test.ts",
  "apps/desen-app/test/authoring-diagnostics.test.ts",
  "apps/desen-app/test/authoring-event-actions.test.ts",
  "apps/desen-app/test/authoring-fixtures.test.ts",
  "apps/desen-app/test/authoring-inspector.test.ts",
  "apps/desen-app/test/authoring-persistence.test.ts",
  "apps/desen-app/test/authoring-preview.test.ts",
  "apps/desen-app/test/authoring-publication.test.ts",
  "apps/desen-app/test/authoring-scenarios.test.ts",
  "apps/desen-app/test/authoring-selection.test.ts",
  "apps/desen-app/test/authoring-slots.test.ts",
  "apps/desen-app/test/authoring-state.test.ts",
  "apps/desen-app/test/behavior-controls.test.tsx",
  "apps/desen-app/test/evergreen-product-composition.test.tsx",
  "apps/desen-app/test/event-action-panel.test.tsx",
  "apps/desen-app/test/inspector-panel.test.tsx",
  "apps/desen-app/test/persistence-application.test.tsx",
  "apps/desen-app/test/preview-fidelity.test.ts",
  "apps/desen-app/test/product-bootstrap.test.tsx",
  "apps/desen-app/test/project-inventory-fixture.test.ts",
  "apps/desen-app/test/project-workspace-profile.test.ts",
  "apps/desen-app/test/publication-activation-integration.test.ts",
  "apps/desen-app/test/publication-application.test.tsx",
  "apps/desen-app/test/state-panel.test.tsx",
]);

const CONTRACT_PATHS = Object.freeze([
  "apps/desen-app/README.md",
  "apps/desen-app/package.json",
  "package.json",
]);
const BOUNDARY_PATHS = Object.freeze([
  "dependency-cruiser.config.cjs",
  "tests/boundaries/fixtures/allowed-desen-app-browser-e2e-reviewed-imports/apps/desen-app-browser-e2e/proof-application.ts",
  "tests/boundaries/fixtures/allowed-desen-app-browser-e2e-reviewed-imports/apps/desen-app/src/reference-sign-in-workspace-profile.ts",
]);
const PROOF_ENTRYPOINT_PATHS = Object.freeze([
  "scripts/lib/atomic-proof-artifact.mjs",
  "scripts/generate-desen-app-t01b-historical-reader-bridge.mjs",
  "scripts/generate-desen-app-evergreen-product-composition-proof.mjs",
  "scripts/verify-desen-app-evergreen-product-composition.mjs",
  "tests/desen-app-historical-reader-fixture.mjs",
]);
const TRACKED_PATHS = Object.freeze(
  [
    ...Object.values(SOURCE_PATHS),
    ...TEST_PATHS,
    ...CONTRACT_PATHS,
    ...BOUNDARY_PATHS,
    ...PROOF_ENTRYPOINT_PATHS,
    PARENT_ARTIFACT_PATH,
    HISTORICAL_READER_BRIDGE_PATH,
  ].sort((left, right) => left.localeCompare(right, "en-US")),
);

const GENERIC_SOURCE_KEYS = Object.freeze([
  "adapterCanvas",
  "application",
  "authoringConnections",
  "authoringData",
  "authoringEventActions",
  "authoringFixtures",
  "authoringPersistence",
  "authoringPreview",
  "authoringPublication",
  "authoringScenarios",
  "eventActionPanel",
  "previewFidelity",
  "productBootstrap",
  "projectData",
  "publicationControls",
  "projectInventoryFixture",
  "projectWorkspaceProfile",
]);
const FORBIDDEN_REFERENCE_DEFAULTS = Object.freeze([
  "account-app",
  "sign-in",
  "signIn",
  "referenceCatalog",
  "examples/sign-in",
  "@desen/reference-catalog-web",
  "exact web-react catalog",
  "420 × 720",
]);

/** Exact immutable M10-T01B predecessor required by the evergreen composition proof. */
export const DESEN_APP_EVERGREEN_PRODUCT_COMPOSITION_PARENT_PIN = Object.freeze({
  task: "M10-T01B",
  gate: null,
  proofId: "desen-app-visual-behavior-authoring",
  path: PARENT_ARTIFACT_PATH,
  bytes: 10_962,
  sha256: "cd7366014a0cb6f056fa78392f81ef7cb4b5be2f523b95e5984c704be3caf0e8",
  profile: "desen.app.visual-behavior-authoring-proof.v1",
  result: "PASS",
  immutable: true,
});

/** Independent root cases owned by the append-only M10-T01C proof family. */
export const DESEN_APP_EVERGREEN_PRODUCT_COMPOSITION_ROOT_TEST_NAMES = Object.freeze([
  "[authority] authenticates the exact immutable M10-T01B predecessor",
  "[profile] admits one exact factory-authenticated workspace authority",
  "[generic] keeps reusable composition free of reference sign-in defaults",
  "[catalog-set] threads the complete admitted Catalog set through authoring and runtime",
  "[routing] keeps route slugs, Source identities, storage, and publication host-owned",
  "[product] renders a non-auth product through the complete App composition",
  "[coverage] proves two surfaces and two Catalogs with exact negative admission",
  "[boundary] keeps production integration, remote deployment, and G10 unclaimed",
  "[determinism] builds byte-identical evidence with complete exact receipts",
  "[policy] rejects source, parent, artifact, report, option, and destination drift",
]);

/** Default destination of the deterministic M10-T01C artifact. */
export const DEFAULT_DESEN_APP_EVERGREEN_PRODUCT_COMPOSITION_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_RELATIVE_PATH,
);

const DEFAULT_PROOF_DOCUMENT_PATH = path.join(WORKSPACE_ROOT, PROOF_DOCUMENT_RELATIVE_PATH);
const FOCUSED_TEST_COMMAND =
  "pnpm --filter @desen/app-web exec vitest run test/project-workspace-profile.test.ts test/evergreen-product-composition.test.tsx";

// Filled after the detached artifact is generated. The artifact deliberately excludes its own
// reader pair so that append-only checkpoint authority, rather than self-reference, owns them.
export const DESEN_APP_EVERGREEN_PRODUCT_COMPOSITION_ARTIFACT_PIN = Object.freeze({
  bytes: 19_299,
  sha256: "779434ca834b8d770c726d905408f0a3d0a7145abbc6eaf2b81f1e77466b46ac",
});

/** Historical pre-redaction identity; current archive bytes require the AR-01 transport pin. */
export const DESEN_APP_T01B_HISTORICAL_READER_BRIDGE_PIN = Object.freeze({
  path: HISTORICAL_READER_BRIDGE_PATH,
  bytes: 1_826_186,
  sha256: "49fb19ef436b48b7189278e649152e660fefea6881e1163213cc61e9e6e77c96",
  uncompressedBytes: 7_522_591,
  baseCommit: "a44575d48e073468da6b25eb8b31a375218caf0a",
  fileEntries: 76,
  successorAddedPaths: 9,
  projections: 15,
});

/** Historical T01C identity retained by frozen evidence, not the current redacted transport. */
export const DESEN_APP_T01C_HISTORICAL_READER_BRIDGE_PIN = Object.freeze({
  path: T01C_HISTORICAL_READER_BRIDGE_PATH,
  bytes: 2_307_407,
  sha256: "16f6ec332fb03368e617563560b9930a7608594907ce61d5d15554be4dc7523d",
  uncompressedBytes: 4_557_796,
  baseCommit: "3814002f89ec8e75019431cd1475a98c97041b0c",
  fileEntries: 68,
  predecessorGapFiles: 4,
  successorAddedPaths: 2,
  projections: 1,
});

const HISTORICAL_READER_PROOF_IDS = Object.freeze([
  "desen-app-catalog-panel-layer-tree",
  "desen-app-design-run-modes",
  "desen-app-event-action-editor",
  "desen-app-fixtures-scenarios-fidelity",
  "desen-app-named-slot-authoring",
  "desen-app-node-linked-diagnostics",
  "desen-app-publish-activation",
  "desen-app-real-adapter-canvas",
  "desen-app-schema-inspector",
  "desen-app-selection-overlay",
  "desen-app-shell-navigation",
  "desen-app-source-persistence",
  "desen-app-state-binding-editor",
  "desen-app-structured-inspector",
  "desen-app-user-created-blank-project",
]);
const HISTORICAL_BRIDGE_AUTHORITIES = new WeakMap();
let cachedHistoricalBridgeAuthority;

async function authenticateInputPendingFixtureSuccessor(workspaceRoot) {
  let successorModule;
  try {
    successorModule = await import("./desen-app-input-pending-fixture-proof.mjs");
  } catch (error) {
    if (error?.code === "ERR_MODULE_NOT_FOUND") {
      fail(
        "SUCCESSOR_POLICY_VIOLATION",
        "Historical T01C compatibility requires the official M10-T02 successor reader.",
        { cause: String(error) },
      );
    }
    throw error;
  }
  const authenticate = successorModule.authenticateDesenAppInputPendingFixtureSuccessor;
  const materialize = successorModule.materializeDesenAppT01cHistoricalReaderFileOverrides;
  const readTaskTimeFile = successorModule.readDesenAppT01cHistoricalReaderTaskTimeFile;
  if (
    typeof authenticate !== "function" ||
    typeof materialize !== "function" ||
    typeof readTaskTimeFile !== "function"
  ) {
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      "The official M10-T02 successor reader does not expose the T01C bridge contract.",
    );
  }
  let successor;
  try {
    successor = await authenticate({ workspaceRoot });
  } catch (error) {
    fail("SUCCESSOR_POLICY_VIOLATION", "The official M10-T02 successor was not authenticated.", {
      cause: String(error),
    });
  }
  return Object.freeze({ materialize, readTaskTimeFile, successor });
}

async function authenticateSuccessHostHistoricalGapFiles(workspaceRoot) {
  try {
    const successorModule = await import("./desen-app-success-host-operation-proof.mjs");
    const authenticate = successorModule.authenticateDesenAppSuccessHostOperationSuccessor;
    const readTaskTimeFile = successorModule.readDesenAppT03HistoricalReaderTaskTimeFile;
    const projectPathInventory = successorModule.projectDesenAppT03HistoricalReaderPathInventory;
    if (
      typeof authenticate !== "function" ||
      typeof readTaskTimeFile !== "function" ||
      typeof projectPathInventory !== "function"
    ) {
      fail("SUCCESSOR_POLICY_VIOLATION", "The M10-T04 historical gap contract is unavailable.");
    }
    const successor = await authenticate({ workspaceRoot });
    return Object.freeze({
      files: new Map(
        T04_PREDECESSOR_GAP_PATHS.map((relativePath) => [
          relativePath,
          readTaskTimeFile(successor, relativePath),
        ]),
      ),
      projectPathInventory: (currentPaths) => projectPathInventory(successor, currentPaths),
    });
  } catch (error) {
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      "The exact M10-T04 historical gaps were not authenticated.",
      {
        cause: String(error),
      },
    );
  }
}

/** Stable fail-closed error raised by the M10-T01C evidence reader. */
export class DesenAppEvergreenProductCompositionProofError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "DesenAppEvergreenProductCompositionProofError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details = {}) {
  throw new DesenAppEvergreenProductCompositionProofError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function deepFreeze(value) {
  if (ArrayBuffer.isView(value)) return value;
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const key of Reflect.ownKeys(value)) deepFreeze(value[key]);
    Object.freeze(value);
  }
  return value;
}

function exactOwnDataOptions(value, allowedKeys, label) {
  if (value === undefined) return Object.freeze(Object.create(null));
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    utilTypes.isProxy(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
  ) {
    fail("OPTIONS_INVALID", `${label} must be one inert own-data object.`);
  }
  const captured = Object.create(null);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      typeof key !== "string" ||
      !allowedKeys.includes(key) ||
      descriptor === undefined ||
      !descriptor.enumerable ||
      !("value" in descriptor)
    ) {
      fail("OPTIONS_INVALID", `${label} contains unsupported authority.`);
    }
    captured[key] = descriptor.value;
  }
  return Object.freeze(captured);
}

function captureBytes(value, label) {
  if (!(value instanceof Uint8Array) || utilTypes.isProxy(value)) {
    fail("OPTIONS_INVALID", `${label} must be one non-Proxy byte array.`);
  }
  if (value.byteLength > MAX_AUTHORITY_BYTES) {
    fail("OPTIONS_INVALID", `${label} exceeds the evidence authority bound.`);
  }
  return Buffer.from(value);
}

function captureOverrides(value) {
  if (value === undefined) return new Map();
  if (!(value instanceof Map) || utilTypes.isProxy(value)) {
    fail("OPTIONS_INVALID", "fileOverrides must be one non-Proxy Map.");
  }
  const captured = new Map();
  for (const [relativePath, bytes] of value) {
    if (typeof relativePath !== "string" || !TRACKED_PATHS.includes(relativePath)) {
      fail("OPTIONS_INVALID", "fileOverrides contains an untracked path.", { relativePath });
    }
    captured.set(relativePath, captureBytes(bytes, `fileOverrides[${relativePath}]`));
  }
  return captured;
}

function captureBuildOptions(value) {
  const options = exactOwnDataOptions(value, ["fileOverrides", "workspaceRoot"], "build options");
  const workspaceRoot = options.workspaceRoot ?? WORKSPACE_ROOT;
  if (
    typeof workspaceRoot !== "string" ||
    workspaceRoot.length === 0 ||
    workspaceRoot.includes("\0")
  ) {
    fail("OPTIONS_INVALID", "workspaceRoot must be one non-empty path.");
  }
  return Object.freeze({
    workspaceRoot: path.resolve(workspaceRoot),
    fileOverrides: captureOverrides(options.fileOverrides),
  });
}

async function readRegularAuthority(absolutePath, relativePath) {
  let handle;
  try {
    const metadata = await lstat(absolutePath);
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > MAX_AUTHORITY_BYTES) {
      fail("AUTHORITY_UNSAFE", `Authority is not one bounded regular file: ${relativePath}.`);
    }
    const canonical = await realpath(absolutePath);
    if (canonical !== absolutePath) {
      fail("AUTHORITY_UNSAFE", `Authority resolves through a linked path: ${relativePath}.`);
    }
    handle = await open(absolutePath, READ_FLAGS);
    const opened = await handle.stat();
    if (!opened.isFile() || opened.size !== metadata.size || opened.size > MAX_AUTHORITY_BYTES) {
      fail("AUTHORITY_UNSAFE", `Authority changed during acquisition: ${relativePath}.`);
    }
    return await handle.readFile();
  } catch (error) {
    if (error instanceof DesenAppEvergreenProductCompositionProofError) throw error;
    fail("AUTHORITY_UNSAFE", `Could not read evidence authority: ${relativePath}.`, {
      cause: String(error),
    });
  } finally {
    await handle?.close();
  }
}

async function acquireFiles(options) {
  const canonicalRoot = await realpath(options.workspaceRoot);
  if (canonicalRoot !== options.workspaceRoot) {
    fail("AUTHORITY_UNSAFE", "workspaceRoot must be its canonical non-symbolic path.");
  }
  const files = new Map();
  for (const relativePath of TRACKED_PATHS) {
    files.set(
      relativePath,
      options.fileOverrides.get(relativePath) ??
        (await readRegularAuthority(path.join(canonicalRoot, relativePath), relativePath)),
    );
  }
  return files;
}

function decodeUtf8(bytes, relativePath, code = "SOURCE_POLICY_VIOLATION") {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail(code, `${relativePath} is not valid UTF-8.`);
  }
}

function parseJson(bytes, relativePath, code = "SOURCE_POLICY_VIOLATION") {
  try {
    return JSON.parse(decodeUtf8(bytes, relativePath, code));
  } catch (error) {
    if (error instanceof DesenAppEvergreenProductCompositionProofError) throw error;
    fail(code, `${relativePath} is not valid JSON.`);
  }
}

function occurrenceCount(source, fragment) {
  return source.split(fragment).length - 1;
}

function requireFragments(source, fragments, label) {
  const missing = fragments.filter((fragment) => !source.includes(fragment));
  if (missing.length > 0) {
    fail("SOURCE_POLICY_VIOLATION", `${label} lost required evergreen authority.`, { missing });
  }
}

function forbidFragments(source, fragments, label) {
  const present = fragments.filter((fragment) => source.includes(fragment));
  if (present.length > 0) {
    fail("SOURCE_POLICY_VIOLATION", `${label} acquired reference-product authority.`, { present });
  }
}

/** Verifies the bounded M10-T01C source profile without executing product or browser code. */
export function verifyDesenAppEvergreenProductCompositionSourcePolicy(rawInput) {
  const input = exactOwnDataOptions(rawInput, Object.keys(SOURCE_PATHS), "source policy input");
  for (const key of Object.keys(SOURCE_PATHS)) {
    if (typeof input[key] !== "string") {
      fail("SOURCE_POLICY_VIOLATION", `source policy input.${key} must be text.`);
    }
  }
  for (const key of GENERIC_SOURCE_KEYS) {
    forbidFragments(input[key], FORBIDDEN_REFERENCE_DEFAULTS, SOURCE_PATHS[key]);
  }

  requireFragments(
    input.referenceBrowserHarness,
    [
      "<DesenAppApplication",
      "initialDocument={EMPTY_REFERENCE_PROJECT_DOCUMENT}",
      "persistencePort={persistencePort}",
      "workspaceProfile={REFERENCE_SIGN_IN_WORKSPACE_PROFILE}",
    ],
    SOURCE_PATHS.referenceBrowserHarness,
  );
  requireFragments(
    input.projectWorkspaceProfile,
    [
      "export interface ProjectWorkspaceProfileHandle",
      "const PROFILE_AUTHORITIES = new WeakMap",
      "export function createProjectWorkspaceProfile(",
      "export function readProjectWorkspaceProfileAuthority(",
      "validateDesenInteractionCatalogSet",
      "validateDesenSourceInteractionContracts",
      "readRuntimeReactAdapterRegistry",
      "publishDesenSource",
      "packages.length !== catalogs.length",
      "seen.size === catalogs.length",
      "sourceSurfaceId",
      "sourceKey",
      "publication",
      "export function admitProjectWorkspaceDocument(",
      "document.entry !== profile.initialDocument.entry",
      "documentSurfaceIds.length !== profileSurfaceIds.length",
      "catalogRequirementsMatch(document, profile.catalogs)",
    ],
    SOURCE_PATHS.projectWorkspaceProfile,
  );
  requireFragments(
    input.projectInventoryFixture,
    [
      "export interface ProjectInventoryFixtureHandle",
      "const FIXTURE_AUTHORITIES = new WeakMap",
      "export function createProjectInventoryFixture(",
      "export function readProjectInventoryFixture(",
      'readonly status: "invalid-handle"',
      "carries no document, persistence or runtime authority",
    ],
    SOURCE_PATHS.projectInventoryFixture,
  );
  requireFragments(
    input.application,
    [
      "readonly workspaceProfile: ProjectWorkspaceProfileHandle",
      "readProjectWorkspaceProfileAuthority(props.workspaceProfile)",
      "workspaceSnapshot.catalogs",
      "workspaceSnapshot.catalogPackages",
      "workspaceSnapshot.runtime.registry",
      "workspaceSnapshot.runtime.hostPorts",
      "workspaceSnapshot.initialDocument",
      "readAuthoringPublicationPortDestination(props.publicationPort)",
      "admitProjectWorkspaceDocument(",
      "readProjectInventoryFixture(props.projectInventoryFixture)",
      "Inert project inventory cannot be composed with Source, mutation, persistence, publication, or project-creation authority.",
      "export function createAuthoringFixtureHostPorts(",
      "_baseHostPorts: RuntimeHostPorts",
      "operations: operationPort",
      'tokens: { resolve: () => Object.freeze({ status: "missing" }) }',
      "clock: { now: () => 1 }",
    ],
    SOURCE_PATHS.application,
  );
  requireFragments(
    input.adapterCanvas,
    [
      "readonly catalogs: DesenValidatedInteractionCatalogSet",
      "readonly registry: RuntimeReactAdapterRegistryHandle",
      "readonly hostPorts: RuntimeHostPorts",
      "Catalog, registry, ports and token authorities are mandatory and never inferred from examples.",
    ],
    SOURCE_PATHS.adapterCanvas,
  );
  requireFragments(
    input.authoringPersistence,
    [
      "readonly profile: ProjectWorkspaceProfileHandle",
      "admitProjectWorkspaceDocument(profileHandle, document)",
      'workspaceAdmission.status !== "admitted"',
      "authority.profile.sourceKey",
      'reason: "profile-invalid"',
    ],
    SOURCE_PATHS.authoringPersistence,
  );
  requireFragments(
    input.authoringPublication,
    [
      "readonly profile: ProjectWorkspaceProfileHandle",
      "profile.publication === null",
      'reason: "publication-unavailable"',
      "const AUTHORING_PUBLICATION_PORT_DESTINATIONS = new WeakMap",
      "readAuthoringPublicationPortDestination(",
      "portDestination.channelName !== profile.publication.channelName",
      "portDestination.hostId !== profile.publication.hostId",
      "admitProjectWorkspaceDocument(profile, input)",
      "profile.catalogPackages",
      "const channelName = profile.publication.channelName",
      "const hostId = profile.publication.hostId",
    ],
    SOURCE_PATHS.authoringPublication,
  );
  requireFragments(
    input.authoringData,
    [
      "validateDesenInteractionCatalogSet(normalizeCatalogSetInput",
      "readonly catalogs: readonly CatalogAuthoringIdentity[]",
      "const componentEntries = catalogs.flatMap",
      "const behaviorEntries = catalogs.flatMap",
    ],
    SOURCE_PATHS.authoringData,
  );
  for (const key of [
    "authoringConnections",
    "authoringEventActions",
    "authoringFixtures",
    "authoringPreview",
    "authoringScenarios",
  ]) {
    requireFragments(input[key], ["catalog"], SOURCE_PATHS[key]);
  }
  requireFragments(
    input.authoringPreview,
    [
      "export function prepareAuthoringSurfacePreviewBundle(",
      "if (source.document.entry === surfaceId)",
      "createDesenEditorDocument({ ...source.document, entry: surfaceId })",
      "? prepareAuthoringPreviewBundle(selected.document, catalogPackages)",
    ],
    SOURCE_PATHS.authoringPreview,
  );
  requireFragments(
    input.productBootstrap,
    [
      "readonly workspaceProfile: ProjectWorkspaceProfileHandle",
      "readProjectWorkspaceProfileAuthority(workspaceProfile)",
      "profile.initialDocument",
      "profile.project",
    ],
    SOURCE_PATHS.productBootstrap,
  );
  requireFragments(
    input.main,
    [
      "REFERENCE_SIGN_IN_WORKSPACE_PROFILE",
      "workspaceProfile={REFERENCE_SIGN_IN_WORKSPACE_PROFILE}",
    ],
    SOURCE_PATHS.main,
  );
  requireFragments(
    input.referenceWorkspaceProfile,
    [
      "createProjectWorkspaceProfile({",
      'profileId: "reference-sign-in-web"',
      "REFERENCE_SIGN_IN_WORKSPACE_PROFILE",
    ],
    SOURCE_PATHS.referenceWorkspaceProfile,
  );
  requireFragments(
    input.referenceAuthoringProfile,
    [
      "REFERENCE_AUTHORING_PROFILE",
      "REFERENCE_AUTHORING_WORKSPACE_PROFILE",
      "prepareReferenceAuthoringPreviewBundle",
      "projectReferenceAuthoringCanvasFrame",
    ],
    SOURCE_PATHS.referenceAuthoringProfile,
  );
  requireFragments(
    input.referenceProjectFixtures,
    [
      "createProjectInventoryFixture(REFERENCE_APP_PROJECTS)",
      "REFERENCE_APP_PROJECT_INVENTORY_FIXTURE",
      "Inert navigation inventory",
    ],
    SOURCE_PATHS.referenceProjectFixtures,
  );

  return deepFreeze({
    authenticatedWorkspaceProfile: true,
    exactOwnDataAdmission: true,
    genericReferenceResidueRejected: true,
    fullCatalogSetValidated: true,
    packageCatalogBijection: true,
    routeAndSourceIdentitySeparated: true,
    exactDocumentAdmissionShared: true,
    storageIdentityHostOwned: true,
    runtimeAuthorityHostOwned: true,
    syntheticRunHostCallbacksIsolated: true,
    publicationBindingOptional: true,
    publicationControllerProfileBound: true,
    opaqueFixtureInventoryAuthority: true,
    fixtureInventoryAuthorityExclusive: true,
    fixtureInventoryCarriesNoWorkspaceAuthority: true,
    explicitReferenceCompositionOnly: true,
  });
}

function authenticateParent(bytes) {
  const pin = DESEN_APP_EVERGREEN_PRODUCT_COMPOSITION_PARENT_PIN;
  if (bytes.byteLength !== pin.bytes || sha256(bytes) !== pin.sha256) {
    fail("PARENT_DRIFT", "The exact immutable M10-T01B predecessor drifted.");
  }
  const artifact = parseJson(bytes, pin.path, "PARENT_DRIFT");
  if (
    artifact?.task !== pin.task ||
    artifact?.proofId !== pin.proofId ||
    artifact?.profile !== pin.profile ||
    artifact?.result !== pin.result ||
    artifact?.claim?.taskStatus !== "DONE" ||
    artifact?.claim?.p08Status !== "PROVEN" ||
    artifact?.claim?.p09Status !== "PARTIAL"
  ) {
    fail("PARENT_DRIFT", "The immutable M10-T01B predecessor identity or claim drifted.");
  }
  return deepFreeze({ ...pin });
}

function verifyTestAuthority(files) {
  const emptyProjectBrowser = decodeUtf8(
    files.get("apps/desen-app-browser-e2e/empty-project-to-sign-in.pw.ts"),
    "apps/desen-app-browser-e2e/empty-project-to-sign-in.pw.ts",
  );
  const userProjectBrowser = decodeUtf8(
    files.get("apps/desen-app-browser-e2e/user-created-blank-project.pw.ts"),
    "apps/desen-app-browser-e2e/user-created-blank-project.pw.ts",
  );
  const application = decodeUtf8(
    files.get("apps/desen-app/test/application.test.tsx"),
    "apps/desen-app/test/application.test.tsx",
  );
  const fixtures = decodeUtf8(
    files.get("apps/desen-app/test/authoring-fixtures.test.ts"),
    "apps/desen-app/test/authoring-fixtures.test.ts",
  );
  const evergreen = decodeUtf8(
    files.get("apps/desen-app/test/evergreen-product-composition.test.tsx"),
    "apps/desen-app/test/evergreen-product-composition.test.tsx",
  );
  const profiles = decodeUtf8(
    files.get("apps/desen-app/test/project-workspace-profile.test.ts"),
    "apps/desen-app/test/project-workspace-profile.test.ts",
  );
  const inventory = decodeUtf8(
    files.get("apps/desen-app/test/project-inventory-fixture.test.ts"),
    "apps/desen-app/test/project-inventory-fixture.test.ts",
  );
  const previews = decodeUtf8(
    files.get("apps/desen-app/test/authoring-preview.test.ts"),
    "apps/desen-app/test/authoring-preview.test.ts",
  );
  const publicationApplication = decodeUtf8(
    files.get("apps/desen-app/test/publication-application.test.tsx"),
    "apps/desen-app/test/publication-application.test.tsx",
  );
  requireFragments(
    emptyProjectBrowser,
    ['getByRole("group", { name: "Managed sign-in canvas" })'],
    "apps/desen-app-browser-e2e/empty-project-to-sign-in.pw.ts",
  );
  forbidFragments(
    emptyProjectBrowser,
    ["Sign-in adapter canvas"],
    "apps/desen-app-browser-e2e/empty-project-to-sign-in.pw.ts",
  );
  requireFragments(
    userProjectBrowser,
    ['getByRole("group", { name: "Managed sign-in canvas" })'],
    "apps/desen-app-browser-e2e/user-created-blank-project.pw.ts",
  );
  forbidFragments(
    userProjectBrowser,
    ["Sign-in adapter canvas"],
    "apps/desen-app-browser-e2e/user-created-blank-project.pw.ts",
  );
  requireFragments(
    application,
    [
      "projectInventoryFixture={REFERENCE_APP_PROJECT_INVENTORY_FIXTURE}",
      "projectInventoryFixture={Object.freeze({}) as ProjectInventoryFixtureHandle}",
      "remounts the complete surface session when its workspace profile changes",
      "uses opaque handle identity when public profile and route identities are equal",
      "revokes the previous fixture authority synchronously when a scenario replaces its Bundle",
    ],
    "apps/desen-app/test/application.test.tsx",
  );
  requireFragments(
    fixtures,
    [
      "derives a non-auth operation, effect, and error inventory from Catalog authority",
      'input: { opaque: "fixture-secret" }',
      "input must remain opaque",
      "controller.deactivate()",
      "controller.dispose()",
    ],
    "apps/desen-app/test/authoring-fixtures.test.ts",
  );
  requireFragments(
    previews,
    [
      "publishes a non-entry surface as an isolated transient Runtime preview",
      "rejects an unknown transient preview surface without altering the Source",
      "prepareAuthoringSurfacePreviewBundle(",
      'expect(REFERENCE_EDITOR_DOCUMENT.entry).toBe("sign-in")',
    ],
    "apps/desen-app/test/authoring-preview.test.ts",
  );
  requireFragments(
    publicationApplication,
    [
      "keeps a non-entry canvas transient while Save and Publish retain the authored entry",
      'expect(persistence.saveCalls[0]?.request.document.entry).toBe("sign-in")',
      "expect(transientPreview.revision).not.toBe(basePreview.revision)",
      "expect(channelCall.request.revision).toBe(basePreview.revision)",
      "expect(channelCall.request.revision).not.toBe(transientPreview.revision)",
      'expect(publishedBundle.entry).toBe("sign-in")',
    ],
    "apps/desen-app/test/publication-application.test.tsx",
  );
  requireFragments(
    evergreen,
    [
      'profileId: "feedback-studio-web"',
      'id: "collect-feedback"',
      'sourceId: "feedback"',
      'id: "thanks"',
      'sourceId: "thank-you"',
      'name: "Share feedback"',
      'name: "Thank you"',
      "catalogs: [...reference.profile.catalogs, supportCatalog]",
      'queryByRole("heading", { name: "Sign in" })',
      "GENERIC_COMPOSITION_MODULES",
      "FORBIDDEN_REFERENCE_DEFAULTS",
      "blocks every profile host callback inside synthetic authoring preview",
    ],
    "apps/desen-app/test/evergreen-product-composition.test.tsx",
  );
  requireFragments(
    profiles,
    [
      'id: "contact"',
      'sourceId: "contact-form"',
      'id: "thanks"',
      'sourceId: "thank-you"',
      "catalogs: [referenceCatalog, formsCatalog]",
      'sourceSurfaceId: "contact-form"',
      'sourceSurfaceId: "thank-you"',
      "catalogPackages: input.catalogPackages.slice(0, 1)",
      "registry: Object.freeze({})",
      "readProjectWorkspaceProfileAuthority(Object.freeze({})",
    ],
    "apps/desen-app/test/project-workspace-profile.test.ts",
  );
  requireFragments(
    inventory,
    [
      "createProjectInventoryFixture([input])",
      "readProjectInventoryFixture(created.handle)",
      "ProjectInventoryFixtureHandle",
      "accessorProject",
      "hostile",
    ],
    "apps/desen-app/test/project-inventory-fixture.test.ts",
  );
  if (
    occurrenceCount(evergreen, "it(") !== 3 ||
    occurrenceCount(profiles, "it(") < 8 ||
    !evergreen.includes("renders a non-auth multi-surface, multi-Catalog project")
  ) {
    fail("SOURCE_POLICY_VIOLATION", "Evergreen focused test declarations drifted.");
  }
  return deepFreeze({
    evergreenCases: 3,
    profileCases: occurrenceCount(profiles, "it("),
    nonAuthFullAppRender: true,
    routeSlugDiffersFromSourceId: true,
    multiSurfaceProfile: true,
    multiCatalogProfile: true,
    nonEntrySurfacePreview: true,
    nonEntrySaveAndPublishBaseAuthorityCovered: true,
    wrongSurfaceRejected: true,
    missingCatalogPackageRejected: true,
    forgedRegistryRejected: true,
    forgedHandleRejected: true,
    opaqueFixtureInventoryCovered: true,
    fixtureAccessorAndHostileInputRejected: true,
    applicationFixtureAuthorityLifecycleCovered: true,
    fixtureRequestInputRemainsOpaque: true,
    fullAppSyntheticHostIsolationCovered: true,
    productAgnosticBrowserCanvasNameCovered: true,
  });
}

function verifyContracts(files) {
  const appPackage = parseJson(
    files.get("apps/desen-app/package.json"),
    "apps/desen-app/package.json",
  );
  const rootPackage = parseJson(files.get("package.json"), "package.json");
  if (
    appPackage?.name !== "@desen/app-web" ||
    rootPackage?.scripts?.["generate:desen-app-evergreen-product-composition"] !==
      "node scripts/generate-desen-app-evergreen-product-composition-proof.mjs" ||
    rootPackage?.scripts?.["verify:desen-app-evergreen-product-composition"] !==
      "node scripts/verify-desen-app-evergreen-product-composition.mjs" ||
    rootPackage?.scripts?.["test:desen-app-evergreen-product-composition"] !==
      "node --test tests/desen-app-evergreen-product-composition.test.mjs"
  ) {
    fail("SOURCE_POLICY_VIOLATION", "The package-owned evergreen proof contract drifted.");
  }
  return deepFreeze({
    appPackageName: appPackage.name,
    focusedTestCommand: FOCUSED_TEST_COMMAND,
    generatorScript: "generate:desen-app-evergreen-product-composition",
    verifierScript: "verify:desen-app-evergreen-product-composition",
    rootTestScript: "test:desen-app-evergreen-product-composition",
  });
}

function verifyBoundaryAuthority(files) {
  const configuration = decodeUtf8(
    files.get("dependency-cruiser.config.cjs"),
    "dependency-cruiser.config.cjs",
  );
  const fixtureConsumer = decodeUtf8(
    files.get(
      "tests/boundaries/fixtures/allowed-desen-app-browser-e2e-reviewed-imports/apps/desen-app-browser-e2e/proof-application.ts",
    ),
    "tests/boundaries/fixtures/allowed-desen-app-browser-e2e-reviewed-imports/apps/desen-app-browser-e2e/proof-application.ts",
  );
  const fixtureProfile = decodeUtf8(
    files.get(
      "tests/boundaries/fixtures/allowed-desen-app-browser-e2e-reviewed-imports/apps/desen-app/src/reference-sign-in-workspace-profile.ts",
    ),
    "tests/boundaries/fixtures/allowed-desen-app-browser-e2e-reviewed-imports/apps/desen-app/src/reference-sign-in-workspace-profile.ts",
  );
  requireFragments(
    configuration,
    [
      'name: "desen-app-browser-e2e-reviewed-app-source-only"',
      "explicit reference workspace profile",
      "reference-sign-in-workspace-profile\\\\.ts",
    ],
    "dependency-cruiser.config.cjs",
  );
  requireFragments(
    fixtureConsumer,
    [
      'from "../desen-app/src/reference-sign-in-workspace-profile.js"',
      "referenceProfileName",
      "allowedBrowserProofComposition",
    ],
    BOUNDARY_PATHS[1],
  );
  requireFragments(
    fixtureProfile,
    ['referenceProfileName = "reference-sign-in-workspace-profile"'],
    BOUNDARY_PATHS[2],
  );
  return deepFreeze({
    reviewedBrowserHarnessImportOnly: true,
    explicitReferenceProfileEdgeAllowed: true,
    unrelatedAppSourceStillDenied: true,
    positiveBoundaryFixtureCovered: true,
  });
}

async function canonicalArtifactBytes(artifact) {
  return Buffer.from(await format(JSON.stringify(artifact), { parser: "json" }));
}

// The task artifact remains historical evidence. Only the separately displayed current
// projection may contain amended transport receipts; no new byte is assigned an old digest.
async function preserveHistoricalEvidence(currentArtifact, files, workspaceRoot) {
  const artifactBytes = await readRegularAuthority(
    path.join(workspaceRoot, ARTIFACT_RELATIVE_PATH),
    ARTIFACT_RELATIVE_PATH,
  );
  assertPinnedArtifact(artifactBytes);
  const artifact = parseJson(artifactBytes, ARTIFACT_RELATIVE_PATH, "ARTIFACT_DRIFT");
  const transport = getHistoricalArchiveRedactionPin(HISTORICAL_READER_BRIDGE_PATH);
  const historicalBridge = artifact.authority.historicalReaderBridge;
  const expectedCurrentBridge = {
    ...historicalBridge,
    bytes: transport.current.bytes,
    sha256: transport.current.sha256,
    ...(Object.hasOwn(historicalBridge, "uncompressedBytes")
      ? { uncompressedBytes: transport.current.uncompressedBytes }
      : {}),
  };
  if (
    historicalBridge.path !== transport.historical.path ||
    historicalBridge.bytes !== transport.historical.bytes ||
    historicalBridge.sha256 !== transport.historical.sha256 ||
    !isDeepStrictEqual(currentArtifact.authority.historicalReaderBridge, expectedCurrentBridge)
  ) {
    fail("ARTIFACT_DRIFT", "Only the exact approved historical archive transport may change.");
  }

  const comparison = structuredClone(currentArtifact);
  comparison.authority.historicalReaderBridge = historicalBridge;
  const historicalReceipts = artifact.boundary.trackedReceipts;
  const currentReceipts = comparison.boundary.trackedReceipts;
  if (currentReceipts.length !== historicalReceipts.length) {
    fail("ARTIFACT_DRIFT", "The historical receipt inventory changed.");
  }
  const receiptAmendments = [];
  for (let index = 0; index < historicalReceipts.length; index += 1) {
    const historical = historicalReceipts[index];
    const current = currentReceipts[index];
    if (isDeepStrictEqual(current, historical)) continue;
    const bytes = files.get(historical.path);
    if (
      !exactJsonKeys(current, ["path", "bytes", "sha256"]) ||
      (historical.path !== HISTORICAL_READER_BRIDGE_PATH &&
        historical.path !== PROOF_ENTRYPOINT_PATHS[1]) ||
      current.path !== historical.path ||
      bytes === undefined ||
      current.bytes !== bytes.byteLength ||
      current.sha256 !== sha256(bytes) ||
      !matchesAmendedHistoricalReceipt(historical, bytes)
    ) {
      fail("ARTIFACT_DRIFT", "An unapproved historical receipt changed.", {
        relativePath: historical.path,
      });
    }
    receiptAmendments.push({
      pointer: `/boundary/trackedReceipts/${index}`,
      historical,
      current,
    });
    currentReceipts[index] = historical;
  }
  if (!isDeepStrictEqual(comparison, artifact)) {
    fail("ARTIFACT_DRIFT", "The archive amendment cannot change historical technical evidence.");
  }

  const currentArtifactBytes = await canonicalArtifactBytes(currentArtifact);
  return deepFreeze({
    artifact,
    artifactBytes,
    artifactSha256: sha256(artifactBytes),
    currentVerification: {
      profile: "desen.app.historical-archive-redaction-verification.v1",
      amendment: "AR-01",
      historicalArtifact: {
        path: ARTIFACT_RELATIVE_PATH,
        bytes: artifactBytes.byteLength,
        sha256: sha256(artifactBytes),
      },
      artifact: currentArtifact,
      artifactBytes: currentArtifactBytes,
      artifactSha256: sha256(currentArtifactBytes),
      archiveTransport: transport,
      receiptAmendments,
      historicalTechnicalProjectionPreserved: true,
      technicalFilesFreshlyVerified: true,
    },
  });
}
/**
 * Freshly verifies the retained M10-T01C technical projection and its amended archive transport.
 *
 * @remarks The original artifact fields retain their historical identity. Current bytes and
 * receipts are exposed separately in currentVerification; sanitized bytes never acquire old hashes.
 */
export async function buildDesenAppEvergreenProductCompositionEvidence(rawOptions = undefined) {
  const options = captureBuildOptions(rawOptions);
  const inputPendingSuccessor = await authenticateInputPendingFixtureSuccessor(
    options.workspaceRoot,
  );
  const files = await acquireFiles(
    Object.freeze({
      ...options,
      fileOverrides: inputPendingSuccessor.materialize(
        inputPendingSuccessor.successor,
        options.fileOverrides,
      ),
    }),
  );
  const parent = authenticateParent(files.get(PARENT_ARTIFACT_PATH));
  const historicalReaderBridge = authenticateHistoricalReaderBridge(
    files.get(HISTORICAL_READER_BRIDGE_PATH),
  );
  const source = verifyDesenAppEvergreenProductCompositionSourcePolicy(
    Object.fromEntries(
      Object.entries(SOURCE_PATHS).map(([key, relativePath]) => [
        key,
        decodeUtf8(files.get(relativePath), relativePath),
      ]),
    ),
  );
  const focusedTests = verifyTestAuthority(files);
  const packageAuthority = verifyContracts(files);
  const boundaryAuthority = verifyBoundaryAuthority(files);
  const trackedReceipts = Object.freeze(
    TRACKED_PATHS.map((relativePath) => {
      const bytes = files.get(relativePath);
      return Object.freeze({ path: relativePath, bytes: bytes.byteLength, sha256: sha256(bytes) });
    }),
  );
  const artifact = deepFreeze({
    schemaVersion: 1,
    proofId: "desen-app-evergreen-product-composition",
    profile: "desen.app.evergreen-product-composition-proof.v1",
    task: "M10-T01C",
    gate: null,
    result: "PASS",
    prerequisites: [parent],
    claim: {
      taskStatus: "DONE",
      p08Status: "PROVEN",
      p09Status: "PARTIAL",
      authenticatedWorkspaceProfileCovered: true,
      genericReferenceResidueGuardCovered: true,
      nonAuthFullAppCompositionCovered: true,
      multiSurfaceProfileCovered: true,
      multiCatalogSetCovered: true,
      nonEntrySurfacePreviewCovered: true,
      nonEntrySaveAndPublishBaseAuthorityCovered: true,
      exactDocumentAdmissionCovered: true,
      opaqueFixtureInventoryCovered: true,
      publicationControllerProfileBindingCovered: true,
      syntheticRunHostIsolationCovered: true,
      exactProfileMutationRejectionCovered: true,
      referenceSignInPreservedAsExplicitComposition: true,
      m10T02Closed: false,
      m10T03Closed: false,
      m10T04Closed: false,
      productionIntegrationCovered: false,
      remoteDeploymentCovered: false,
      g10Closed: false,
    },
    authority: {
      source,
      focusedTests,
      package: packageAuthority,
      boundary: boundaryAuthority,
      historicalReaderBridge: historicalReaderBridge.summary,
    },
    tests: {
      focusedCommand: FOCUSED_TEST_COMMAND,
      verifierCommand: "node scripts/verify-desen-app-evergreen-product-composition.mjs",
      proofReaderCommand: "node --test tests/desen-app-evergreen-product-composition.test.mjs",
      rootTestNames: DESEN_APP_EVERGREEN_PRODUCT_COMPOSITION_ROOT_TEST_NAMES,
      browserExecutedByVerifier: false,
      deterministicReaderStartsListener: false,
    },
    boundary: {
      trackedFiles: trackedReceipts.length,
      trackedReceipts,
      parentArtifacts: 1,
      historicalReaderBridgeArtifacts: 1,
      immutableInputs: true,
      sourceSymlinksRejected: true,
      checkpointOwnedReaderPaths: [
        "scripts/lib/desen-app-evergreen-product-composition-proof.mjs",
        "tests/desen-app-evergreen-product-composition.test.mjs",
      ],
      artifactTrackedEntrypoints: PROOF_ENTRYPOINT_PATHS,
    },
    nonClaims: [
      "This evidence proves trusted single-profile composition, not untrusted profile loading or arbitrary executable selection from DESEN data.",
      "The non-auth product and multi-Catalog cases prove composition generality, not every Catalog schema or every product workflow.",
      "M10-T02 through M10-T04, production integration, remote deployment, multi-user persistence, and G10 closure remain NOT_PROVEN.",
      "The deterministic reader starts no Chromium, Vite, network listener, or external host.",
      "No hosted-CI pass is inferred from locally generated artifact bytes alone.",
    ],
  });
  return preserveHistoricalEvidence(artifact, files, options.workspaceRoot);
}

function verifyProofDocument(bytes, artifactSha256) {
  const source = decodeUtf8(bytes, PROOF_DOCUMENT_RELATIVE_PATH, "PROOF_DOCUMENT_DRIFT");
  const expectedHeader = [
    "# Desen App evergreen product composition",
    "",
    "Task: M10-T01C",
    "",
    "Status: DONE",
    "",
    "P-08: PROVEN",
    "",
    "P-09: PARTIAL",
    "",
    `Predecessor artifact: \`sha256:${DESEN_APP_EVERGREEN_PRODUCT_COMPOSITION_PARENT_PIN.sha256}\``,
    "",
    `Final artifact: \`sha256:${artifactSha256}\``,
  ].join("\n");
  if (
    !source.startsWith(expectedHeader) ||
    occurrenceCount(source, "Task: M10-T01C") !== 1 ||
    occurrenceCount(source, "Status: DONE") !== 1 ||
    occurrenceCount(source, "Final artifact:") !== 1 ||
    source.includes("sha256:PENDING")
  ) {
    fail("PROOF_DOCUMENT_DRIFT", "The M10-T01C proof report lost its exact authority header.");
  }
}

function assertPinnedArtifact(bytes) {
  const pin = DESEN_APP_EVERGREEN_PRODUCT_COMPOSITION_ARTIFACT_PIN;
  if (
    pin.bytes <= 0 ||
    !/^[0-9a-f]{64}$/u.test(pin.sha256) ||
    bytes.byteLength !== pin.bytes ||
    sha256(bytes) !== pin.sha256
  ) {
    fail("ARTIFACT_DRIFT", "The immutable committed M10-T01C artifact bytes drifted.");
  }
}

function exactJsonKeys(value, expectedKeys) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype ||
    !isDeepStrictEqual(Object.keys(value), expectedKeys)
  ) {
    return false;
  }
  return Reflect.ownKeys(value).every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return (
      typeof key === "string" &&
      descriptor !== undefined &&
      descriptor.enumerable &&
      descriptor.configurable &&
      descriptor.writable &&
      "value" in descriptor
    );
  });
}

function authenticateHistoricalReaderBridge(compressedBytes) {
  const historicalPin = DESEN_APP_T01B_HISTORICAL_READER_BRIDGE_PIN;
  let transport;
  try {
    transport = authenticateRedactedHistoricalArchive(historicalPin.path, compressedBytes);
  } catch (error) {
    fail(
      "HISTORICAL_BRIDGE_DRIFT",
      "The amended historical archive transport was not authenticated.",
      {
        cause: String(error),
      },
    );
  }
  if (
    transport.historical.bytes !== historicalPin.bytes ||
    transport.historical.sha256 !== historicalPin.sha256 ||
    transport.historical.baseCommit !== historicalPin.baseCommit
  ) {
    fail(
      "HISTORICAL_BRIDGE_DRIFT",
      "The archive amendment names a different historical authority.",
    );
  }
  const pin = { ...historicalPin, ...transport.current };
  if (
    compressedBytes.byteLength !== pin.bytes ||
    compressedBytes.byteLength > MAX_HISTORICAL_BRIDGE_BYTES ||
    sha256(compressedBytes) !== pin.sha256
  ) {
    fail("HISTORICAL_BRIDGE_DRIFT", "The exact compressed T01B historical-reader bridge drifted.");
  }
  if (cachedHistoricalBridgeAuthority !== undefined) return cachedHistoricalBridgeAuthority;

  let inflated;
  try {
    inflated = gunzipSync(compressedBytes, {
      maxOutputLength: MAX_HISTORICAL_BRIDGE_INFLATED_BYTES,
    });
  } catch (error) {
    fail("HISTORICAL_BRIDGE_DRIFT", "The T01B historical-reader bridge is not bounded gzip.", {
      cause: String(error),
    });
  }
  if (inflated.byteLength !== pin.uncompressedBytes) {
    fail("HISTORICAL_BRIDGE_DRIFT", "The T01B historical-reader bridge size drifted.");
  }
  let manifest;
  try {
    const source = new TextDecoder("utf-8", { fatal: true }).decode(inflated);
    manifest = JSON.parse(source);
    if (!Buffer.from(`${JSON.stringify(manifest)}\n`, "utf8").equals(inflated)) {
      fail(
        "HISTORICAL_BRIDGE_DRIFT",
        "The T01B historical-reader bridge is not one canonical dense JSON manifest.",
      );
    }
  } catch (error) {
    if (error instanceof DesenAppEvergreenProductCompositionProofError) throw error;
    fail("HISTORICAL_BRIDGE_DRIFT", "The T01B historical-reader bridge JSON is invalid.", {
      cause: String(error),
    });
  }
  if (
    !exactJsonKeys(manifest, [
      "schemaVersion",
      "profile",
      "baseCommit",
      "successorAddedPaths",
      "files",
      "projections",
    ]) ||
    manifest.schemaVersion !== 1 ||
    manifest.profile !== pin.profile ||
    manifest.baseCommit !== pin.baseCommit ||
    !Array.isArray(manifest.successorAddedPaths) ||
    manifest.successorAddedPaths.length !== pin.successorAddedPaths ||
    !exactJsonKeys(manifest.files, Object.keys(manifest.files)) ||
    Object.keys(manifest.files).length !== pin.fileEntries ||
    !exactJsonKeys(manifest.projections, HISTORICAL_READER_PROOF_IDS) ||
    Object.keys(manifest.projections).length !== pin.projections
  ) {
    fail("HISTORICAL_BRIDGE_DRIFT", "The T01B historical-reader bridge identity drifted.");
  }
  const addedPaths = manifest.successorAddedPaths;
  if (
    !isDeepStrictEqual(
      addedPaths,
      [...addedPaths].sort((left, right) => left.localeCompare(right, "en-US")),
    ) ||
    new Set(addedPaths).size !== addedPaths.length ||
    addedPaths.some(
      (relativePath) =>
        typeof relativePath !== "string" ||
        path.isAbsolute(relativePath) ||
        relativePath.includes("\\") ||
        relativePath.split("/").includes(".."),
    )
  ) {
    fail("HISTORICAL_BRIDGE_DRIFT", "The successor-added path manifest is not canonical.");
  }
  const encodedEntries = Object.entries(manifest.files);
  const encodedPaths = encodedEntries.map(([relativePath]) => relativePath);
  if (
    !isDeepStrictEqual(
      encodedPaths,
      [...encodedPaths].sort((left, right) => left.localeCompare(right, "en-US")),
    ) ||
    encodedEntries.some(
      ([relativePath, encoded]) =>
        path.isAbsolute(relativePath) ||
        relativePath.includes("\\") ||
        relativePath.split("/").includes("..") ||
        typeof encoded !== "string" ||
        !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(encoded),
    )
  ) {
    fail("HISTORICAL_BRIDGE_DRIFT", "The task-time file manifest is not canonical.");
  }
  const files = new Map();
  let decodedBytes = 0;
  for (const [relativePath, encoded] of encodedEntries) {
    const bytes = Buffer.from(encoded, "base64");
    if (bytes.toString("base64") !== encoded || bytes.byteLength > MAX_AUTHORITY_BYTES) {
      fail("HISTORICAL_BRIDGE_DRIFT", `The task-time file entry is invalid: ${relativePath}.`);
    }
    decodedBytes += bytes.byteLength;
    if (decodedBytes > MAX_HISTORICAL_BRIDGE_DECODED_FILE_BYTES) {
      fail("HISTORICAL_BRIDGE_DRIFT", "The decoded task-time file authority exceeds its bound.");
    }
    files.set(relativePath, bytes);
  }
  for (const proofId of HISTORICAL_READER_PROOF_IDS) {
    const projection = manifest.projections[proofId];
    if (projection === null || typeof projection !== "object" || Array.isArray(projection)) {
      fail("HISTORICAL_BRIDGE_DRIFT", `The historical projection is invalid: ${proofId}.`);
    }
  }
  cachedHistoricalBridgeAuthority = Object.freeze({
    files,
    projections: deepFreeze(manifest.projections),
    successorAddedPaths: new Set(addedPaths),
    summary: deepFreeze({
      path: pin.path,
      bytes: pin.bytes,
      sha256: pin.sha256,
      baseCommit: pin.baseCommit,
      fileEntries: pin.fileEntries,
      successorAddedPaths: pin.successorAddedPaths,
      projections: pin.projections,
      canonicalDenseManifest: true,
      boundedGzip: true,
    }),
  });
  return cachedHistoricalBridgeAuthority;
}

function historicalBridgeAuthority(successor) {
  if (
    successor === null ||
    typeof successor !== "object" ||
    utilTypes.isProxy(successor) ||
    !HISTORICAL_BRIDGE_AUTHORITIES.has(successor)
  ) {
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      "Historical compatibility requires the exact authenticated M10-T01C successor handle.",
    );
  }
  return HISTORICAL_BRIDGE_AUTHORITIES.get(successor);
}

/** Returns one exact frozen task-time projection after authenticating the M10-T01C successor. */
export function readDesenAppHistoricalReaderProjection(successor, proofId) {
  if (typeof proofId !== "string" || !HISTORICAL_READER_PROOF_IDS.includes(proofId)) {
    fail("OPTIONS_INVALID", "proofId is not one admitted historical reader.");
  }
  return historicalBridgeAuthority(successor).predecessor.projections[proofId];
}

/** Materializes retained technical bytes and redacted archive data, then exact caller mutations. */
export function materializeDesenAppHistoricalReaderFileOverrides(successor, fileOverrides) {
  const authority = historicalBridgeAuthority(successor);
  if (
    !(fileOverrides instanceof Map) ||
    utilTypes.isProxy(fileOverrides) ||
    Object.getPrototypeOf(fileOverrides) !== Map.prototype ||
    Reflect.ownKeys(fileOverrides).length !== 0 ||
    fileOverrides.size > 256
  ) {
    fail("OPTIONS_INVALID", "Historical fileOverrides must be one inert Map.");
  }
  const materialized = new Map(
    [...authority.predecessor.files].map(([relativePath, bytes]) => [
      relativePath,
      Buffer.from(bytes),
    ]),
  );
  for (const [relativePath, bytes] of authority.predecessorGapFiles) {
    materialized.set(relativePath, Buffer.from(bytes));
  }
  let overrideBytes = 0;
  for (const [relativePath, bytes] of Map.prototype.entries.call(fileOverrides)) {
    const bytePrototype = bytes instanceof Uint8Array ? Object.getPrototypeOf(bytes) : null;
    if (
      typeof relativePath !== "string" ||
      relativePath.length === 0 ||
      relativePath.length > 512 ||
      relativePath.includes("\0") ||
      path.isAbsolute(relativePath) ||
      relativePath.includes("\\") ||
      relativePath.split("/").includes("..") ||
      !(bytes instanceof Uint8Array) ||
      utilTypes.isProxy(bytes) ||
      (bytePrototype !== Uint8Array.prototype && bytePrototype !== Buffer.prototype) ||
      Object.getOwnPropertyDescriptor(bytes, "buffer") !== undefined ||
      Object.getOwnPropertyDescriptor(bytes, "byteLength") !== undefined ||
      Object.getOwnPropertyDescriptor(bytes, "byteOffset") !== undefined ||
      (typeof SharedArrayBuffer !== "undefined" && bytes.buffer instanceof SharedArrayBuffer)
    ) {
      fail("OPTIONS_INVALID", "Historical fileOverrides contains unsupported authority.");
    }
    overrideBytes += bytes.byteLength;
    if (bytes.byteLength > MAX_AUTHORITY_BYTES || overrideBytes > MAX_AUTHORITY_BYTES) {
      fail("OPTIONS_INVALID", "Historical fileOverrides exceeds its byte budget.");
    }
    materialized.set(relativePath, Buffer.from(bytes));
  }
  return materialized;
}

/** Removes only exact successor-added paths from a historical reader's discovered inventory. */
export function projectDesenAppHistoricalReaderPathInventory(successor, currentPaths) {
  const authority = historicalBridgeAuthority(successor);
  if (
    !Array.isArray(currentPaths) ||
    utilTypes.isProxy(currentPaths) ||
    Object.getPrototypeOf(currentPaths) !== Array.prototype ||
    currentPaths.length > 4_096 ||
    Reflect.ownKeys(currentPaths).some(
      (key) => key !== "length" && (typeof key !== "string" || !/^(?:0|[1-9][0-9]*)$/u.test(key)),
    )
  ) {
    fail("OPTIONS_INVALID", "Historical path inventory must be one dense array.");
  }
  for (let index = 0; index < currentPaths.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(currentPaths, String(index));
    const relativePath = descriptor?.value;
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      !descriptor.enumerable ||
      typeof relativePath !== "string" ||
      relativePath.length === 0 ||
      relativePath.includes("\0") ||
      path.isAbsolute(relativePath) ||
      relativePath.includes("\\") ||
      relativePath.split("/").includes("..")
    ) {
      fail("OPTIONS_INVALID", "Historical path inventory contains unsupported authority.");
    }
  }
  return authority.t04ProjectPathInventory(
    currentPaths.filter(
      (relativePath) =>
        !authority.predecessor.successorAddedPaths.has(relativePath) &&
        !authority.t01cSuccessorAddedPaths.has(relativePath),
    ),
  );
}

/** Returns retained T01B technical bytes or their explicitly amended non-technical archive data. */
export function readDesenAppHistoricalReaderTaskTimeFile(successor, relativePath) {
  if (typeof relativePath !== "string") fail("OPTIONS_INVALID", "relativePath must be text.");
  const authority = historicalBridgeAuthority(successor);
  const bytes =
    authority.predecessor.files.get(relativePath) ??
    authority.predecessorGapFiles.get(relativePath);
  if (bytes === undefined) {
    fail("OPTIONS_INVALID", "relativePath has no task-time bridge entry.", { relativePath });
  }
  return Buffer.from(bytes);
}

/**
 * Authenticates the exact official M10-T01C successor for historical App proof readers.
 *
 * @remarks This bridge accepts no byte overrides. Historical mutation paths therefore continue
 * through their original task-time policies; only an exact canonical workspace, committed T01C
 * artifact and visible proof association can authorize the reviewed successor.
 */
export async function authenticateDesenAppEvergreenProductCompositionSuccessor(
  rawOptions = undefined,
) {
  const options = exactOwnDataOptions(rawOptions, ["workspaceRoot"], "successor options");
  const workspaceRoot = path.resolve(options.workspaceRoot ?? WORKSPACE_ROOT);
  const verified = await verifyDesenAppEvergreenProductCompositionEvidence({
    artifactPath: path.join(workspaceRoot, ARTIFACT_RELATIVE_PATH),
    proofDocumentPath: path.join(workspaceRoot, PROOF_DOCUMENT_RELATIVE_PATH),
    buildOptions: { workspaceRoot },
  });
  const bridgeAuthority = authenticateHistoricalReaderBridge(
    await readRegularAuthority(
      path.join(workspaceRoot, HISTORICAL_READER_BRIDGE_PATH),
      HISTORICAL_READER_BRIDGE_PATH,
    ),
  );
  const inputPendingSuccessor = await authenticateInputPendingFixtureSuccessor(workspaceRoot);
  const predecessorGapFiles = new Map(
    T01C_PREDECESSOR_GAP_PATHS.map((relativePath) => [
      relativePath,
      inputPendingSuccessor.readTaskTimeFile(inputPendingSuccessor.successor, relativePath),
    ]),
  );
  // The older bridges omitted these unchanged T01A authorities. Only the authenticated T04
  // bridge can supply them; the public materializer still applies caller mutations last.
  const successHostHistorical = await authenticateSuccessHostHistoricalGapFiles(workspaceRoot);
  for (const [relativePath, bytes] of successHostHistorical.files) {
    if (bridgeAuthority.files.has(relativePath) || predecessorGapFiles.has(relativePath)) {
      fail(
        "SUCCESSOR_POLICY_VIOLATION",
        "A reviewed historical gap would replace existing authority.",
      );
    }
    predecessorGapFiles.set(relativePath, bytes);
  }
  const successor = deepFreeze({
    task: "M10-T01C",
    proofId: "desen-app-evergreen-product-composition",
    profile: "desen.app.evergreen-product-composition-proof.v1",
    result: verified.result,
    artifact: {
      path: ARTIFACT_RELATIVE_PATH,
      ...DESEN_APP_EVERGREEN_PRODUCT_COMPOSITION_ARTIFACT_PIN,
      immutable: true,
    },
    predecessor: { ...DESEN_APP_EVERGREEN_PRODUCT_COMPOSITION_PARENT_PIN },
    trackedFiles: verified.trackedFiles,
    currentVerification: verified.currentVerification,
    catalogs: verified.catalogs,
    surfaces: verified.surfaces,
    p08Status: verified.p08Status,
    p09Status: verified.p09Status,
    m10T02Closed: verified.m10T02Closed,
  });
  HISTORICAL_BRIDGE_AUTHORITIES.set(
    successor,
    Object.freeze({
      predecessor: bridgeAuthority,
      predecessorGapFiles,
      t04ProjectPathInventory: successHostHistorical.projectPathInventory,
      t01cSuccessorAddedPaths: new Set(T01C_SUCCESSOR_ADDED_PATHS),
    }),
  );
  return successor;
}

/** Verifies frozen M10-T01C technical evidence and separately reports current AR-01 receipts. */
export async function verifyDesenAppEvergreenProductCompositionEvidence(rawOptions = undefined) {
  const options = exactOwnDataOptions(
    rawOptions,
    ["artifactBytes", "artifactPath", "buildOptions", "proofDocument", "proofDocumentPath"],
    "verify options",
  );
  const built = await buildDesenAppEvergreenProductCompositionEvidence(options.buildOptions);
  const artifactPath =
    options.artifactPath === undefined
      ? DEFAULT_DESEN_APP_EVERGREEN_PRODUCT_COMPOSITION_ARTIFACT_PATH
      : path.resolve(options.artifactPath);
  const artifactBytes =
    options.artifactBytes === undefined
      ? await readRegularAuthority(artifactPath, ARTIFACT_RELATIVE_PATH)
      : captureBytes(options.artifactBytes, "artifactBytes");
  assertPinnedArtifact(artifactBytes);
  if (!artifactBytes.equals(built.artifactBytes)) {
    fail("ARTIFACT_DRIFT", "The committed M10-T01C artifact does not match current authorities.");
  }
  const artifact = parseJson(artifactBytes, ARTIFACT_RELATIVE_PATH, "ARTIFACT_DRIFT");
  if (
    artifact?.task !== "M10-T01C" ||
    artifact?.proofId !== "desen-app-evergreen-product-composition" ||
    artifact?.profile !== "desen.app.evergreen-product-composition-proof.v1" ||
    artifact?.result !== "PASS"
  ) {
    fail("ARTIFACT_DRIFT", "The committed M10-T01C artifact identity drifted.");
  }
  const proofDocumentPath =
    options.proofDocumentPath === undefined
      ? DEFAULT_PROOF_DOCUMENT_PATH
      : path.resolve(options.proofDocumentPath);
  const proofDocument =
    options.proofDocument === undefined
      ? await readRegularAuthority(proofDocumentPath, PROOF_DOCUMENT_RELATIVE_PATH)
      : captureBytes(options.proofDocument, "proofDocument");
  verifyProofDocument(proofDocument, built.artifactSha256);
  return deepFreeze({
    task: artifact.task,
    result: artifact.result,
    artifactBytes: artifactBytes.byteLength,
    artifactSha256: built.artifactSha256,
    currentVerification: {
      profile: built.currentVerification.profile,
      amendment: built.currentVerification.amendment,
      artifactBytes: built.currentVerification.artifactBytes.byteLength,
      artifactSha256: built.currentVerification.artifactSha256,
      archiveTransport: built.currentVerification.archiveTransport,
      trackedReceipts: built.currentVerification.artifact.boundary.trackedReceipts,
      receiptAmendments: built.currentVerification.receiptAmendments,
      historicalTechnicalProjectionPreserved: true,
      technicalFilesFreshlyVerified: true,
    },
    trackedFiles: artifact.boundary.trackedFiles,
    rootTests: artifact.tests.rootTestNames.length,
    focusedCases:
      artifact.authority.focusedTests.evergreenCases + artifact.authority.focusedTests.profileCases,
    catalogs: 2,
    surfaces: 2,
    p08Status: artifact.claim.p08Status,
    p09Status: artifact.claim.p09Status,
    m10T02Closed: artifact.claim.m10T02Closed,
    browserExecutedByVerifier: false,
  });
}

async function canonicalDestinationPath(filePath) {
  const absolutePath = path.resolve(filePath);
  const canonicalParent = await realpath(path.dirname(absolutePath));
  return path.join(canonicalParent, path.basename(absolutePath));
}

/** Atomically writes newly built M10-T01C evidence or refuses unsafe tracked replacement. */
export async function writeDesenAppEvergreenProductCompositionEvidence(rawOptions = undefined) {
  const options = exactOwnDataOptions(
    rawOptions,
    ["artifactPath", "beforeAtomicRename", "buildOptions"],
    "write options",
  );
  if (
    options.beforeAtomicRename !== undefined &&
    (typeof options.beforeAtomicRename !== "function" ||
      utilTypes.isProxy(options.beforeAtomicRename))
  ) {
    fail("OPTIONS_INVALID", "beforeAtomicRename must be one non-Proxy function.");
  }
  const artifactPath =
    options.artifactPath === undefined
      ? DEFAULT_DESEN_APP_EVERGREEN_PRODUCT_COMPOSITION_ARTIFACT_PATH
      : path.resolve(options.artifactPath);
  const built = await buildDesenAppEvergreenProductCompositionEvidence(options.buildOptions);
  let destination;
  try {
    destination = await canonicalDestinationPath(artifactPath);
  } catch (error) {
    fail("ARTIFACT_WRITE_UNSAFE", "The M10-T01C artifact destination is unsafe.", {
      cause: String(error),
    });
  }
  if (
    destination ===
    (await canonicalDestinationPath(DEFAULT_DESEN_APP_EVERGREEN_PRODUCT_COMPOSITION_ARTIFACT_PATH))
  ) {
    try {
      const existing = await readRegularAuthority(destination, ARTIFACT_RELATIVE_PATH);
      if (
        DESEN_APP_EVERGREEN_PRODUCT_COMPOSITION_ARTIFACT_PIN.bytes > 0 &&
        !existing.equals(built.artifactBytes)
      ) {
        fail("ARTIFACT_WRITE_UNSAFE", "Refusing to rewrite the frozen tracked M10-T01C artifact.");
      }
    } catch (error) {
      if (
        error instanceof DesenAppEvergreenProductCompositionProofError &&
        error.code !== "AUTHORITY_UNSAFE"
      ) {
        throw error;
      }
    }
  }
  try {
    await writeAtomicProofArtifact({
      artifactPath: destination,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename: options.beforeAtomicRename,
    });
  } catch (error) {
    if (error instanceof DesenAppEvergreenProductCompositionProofError) throw error;
    fail("ARTIFACT_WRITE_UNSAFE", "M10-T01C artifact write failed safely.", {
      cause: String(error),
    });
  }
  return deepFreeze({
    task: built.artifact.task,
    result: built.artifact.result,
    artifactPath: destination,
    artifactBytes: built.artifactBytes.byteLength,
    artifactSha256: built.artifactSha256,
    trackedFiles: built.artifact.boundary.trackedFiles,
  });
}
