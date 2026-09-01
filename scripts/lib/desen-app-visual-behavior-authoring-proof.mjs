import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { types as utilTypes } from "node:util";

import { format } from "prettier";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const ARTIFACT_RELATIVE_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-visual-behavior-authoring.json";
const PROOF_DOCUMENT_RELATIVE_PATH = "docs/proof/DESEN-APP-VISUAL-BEHAVIOR-AUTHORING.md";
const PARENT_ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-user-created-blank-project.json";
const MAX_AUTHORITY_BYTES = 16 * 1_024 * 1_024;
const READ_FLAGS =
  fileConstants.O_RDONLY | (fileConstants.O_NOFOLLOW ?? 0) | (fileConstants.O_NONBLOCK ?? 0);

const SOURCE_PATHS = Object.freeze({
  application: "apps/desen-app/src/application.tsx",
  applicationCss: "apps/desen-app/src/application.module.css",
  behaviorProjection: "apps/desen-app/src/authoring-behavior-projection.ts",
  conditions: "apps/desen-app/src/authoring-conditions.ts",
  connections: "apps/desen-app/src/authoring-connections.ts",
  eventActions: "apps/desen-app/src/authoring-event-actions.ts",
  fixtures: "apps/desen-app/src/authoring-fixtures.ts",
  behaviorControls: "apps/desen-app/src/behavior-controls.tsx",
  eventActionPanel: "apps/desen-app/src/event-action-panel.tsx",
  inspectorPanel: "apps/desen-app/src/inspector-panel.tsx",
  previewControls: "apps/desen-app/src/preview-controls.tsx",
  browserSpec: "apps/desen-app-browser-e2e/empty-project-to-sign-in.pw.ts",
});

const TEST_PATHS = Object.freeze([
  "apps/desen-app/test/application.test.tsx",
  "apps/desen-app/test/authoring-behavior-projection.test.ts",
  "apps/desen-app/test/authoring-conditions.test.ts",
  "apps/desen-app/test/authoring-connections.test.ts",
  "apps/desen-app/test/authoring-event-actions.test.ts",
  "apps/desen-app/test/authoring-fixtures.test.ts",
  "apps/desen-app/test/behavior-controls.test.tsx",
  "apps/desen-app/test/event-action-panel.test.tsx",
  "apps/desen-app/test/persistence-application.test.tsx",
  "apps/desen-app/test/preview-controls.test.tsx",
  "apps/desen-app/test/publication-application.test.tsx",
]);

const CONTRACT_PATHS = Object.freeze([
  ".github/workflows/ci.yml",
  "apps/desen-app/package.json",
  "apps/desen-app-browser-e2e/package.json",
  "packages/reference-catalog-web/catalog.json",
]);

const PROOF_ENTRYPOINT_PATHS = Object.freeze([
  "scripts/lib/atomic-proof-artifact.mjs",
  "scripts/generate-desen-app-visual-behavior-authoring-proof.mjs",
  "scripts/verify-desen-app-visual-behavior-authoring.mjs",
]);

const TRACKED_PATHS = Object.freeze(
  [
    ...Object.values(SOURCE_PATHS),
    ...TEST_PATHS,
    ...CONTRACT_PATHS,
    ...PROOF_ENTRYPOINT_PATHS,
    PARENT_ARTIFACT_PATH,
  ].sort((left, right) => left.localeCompare(right, "en-US")),
);

/** Exact immutable M10-T01A predecessor required by the visual-behavior proof. */
export const DESEN_APP_VISUAL_BEHAVIOR_AUTHORING_PARENT_PIN = Object.freeze({
  task: "M10-T01A",
  gate: null,
  proofId: "desen-app-user-created-blank-project",
  path: PARENT_ARTIFACT_PATH,
  bytes: 20_173,
  sha256: "6277b82f22bf26e92b670164f2f1e2b7f861409f5b37585fb5053d88c4dadd2e",
  profile: "desen.app.user-created-blank-project-proof.v1",
  result: "PASS",
  immutable: true,
});

/** Independent root cases owned by the append-only M10-T01B proof family. */
export const DESEN_APP_VISUAL_BEHAVIOR_AUTHORING_ROOT_TEST_NAMES = Object.freeze([
  "[authority] authenticates the exact immutable M10-T01A predecessor",
  "[connection] binds controlled input value and change atomically",
  "[actions] exposes Catalog-aware visual actions with advanced JSON retained",
  "[visibility] authors operation and state predicates through public editor commands",
  "[fixtures] derives generic Run outcomes from Source aliases and Catalog fixtures",
  "[browser] visible UI repairs the bad binding and authors failure visibility",
  "[boundary] keeps planned T02 through T04 closure and real host authority unclaimed",
  "[determinism] builds byte-identical evidence with complete exact receipts",
  "[policy] rejects source, parent, artifact, report, option, and destination drift",
]);

/** Default destination of the deterministic M10-T01B artifact. */
export const DEFAULT_DESEN_APP_VISUAL_BEHAVIOR_AUTHORING_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_RELATIVE_PATH,
);

const DEFAULT_PROOF_DOCUMENT_PATH = path.join(WORKSPACE_ROOT, PROOF_DOCUMENT_RELATIVE_PATH);
const FOCUSED_TEST_COMMAND = "pnpm --filter @desen/app-web test:behavior-authoring";
const BROWSER_COMMAND = "pnpm --filter @desen/app-browser-e2e test:e2e";
const BROWSER_TEST_NAME =
  "authors and saves a valid sign-in Source from the empty project in a real browser";

// Filled only after the detached artifact is generated. This reader and its root test are owned by
// the append-only checkpoint, so neither file is part of the artifact's self-referential receipts.
const IMMUTABLE_ARTIFACT_PIN = Object.freeze({
  bytes: 10_962,
  sha256: "cd7366014a0cb6f056fa78392f81ef7cb4b5be2f523b95e5984c704be3caf0e8",
});

/** Stable fail-closed error raised by the M10-T01B evidence reader. */
export class DesenAppVisualBehaviorAuthoringProofError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "DesenAppVisualBehaviorAuthoringProofError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details = {}) {
  throw new DesenAppVisualBehaviorAuthoringProofError(code, message, details);
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
      fail(
        "AUTHORITY_UNSAFE",
        `Evidence authority is not one bounded regular file: ${relativePath}.`,
      );
    }
    handle = await open(absolutePath, READ_FLAGS);
    const opened = await handle.stat();
    if (!opened.isFile() || opened.size !== metadata.size || opened.size > MAX_AUTHORITY_BYTES) {
      fail("AUTHORITY_UNSAFE", `Evidence authority changed during acquisition: ${relativePath}.`);
    }
    return await handle.readFile();
  } catch (error) {
    if (error instanceof DesenAppVisualBehaviorAuthoringProofError) throw error;
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
    const override = options.fileOverrides.get(relativePath);
    files.set(
      relativePath,
      override ??
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
    if (error instanceof DesenAppVisualBehaviorAuthoringProofError) throw error;
    fail(code, `${relativePath} is not valid JSON.`);
  }
}

function occurrenceCount(source, fragment) {
  return source.split(fragment).length - 1;
}

function requireFragments(source, fragments, label) {
  const missing = fragments.filter((fragment) => !source.includes(fragment));
  if (missing.length > 0) {
    fail("SOURCE_POLICY_VIOLATION", `${label} lost required visual-behavior authority.`, {
      missing,
    });
  }
}

function forbidFragments(source, fragments, label) {
  const present = fragments.filter((fragment) => source.includes(fragment));
  if (present.length > 0) {
    fail("SOURCE_POLICY_VIOLATION", `${label} acquired forbidden authority.`, { present });
  }
}

/** Verifies the bounded M10-T01B source profile without executing product or browser code. */
export function verifyDesenAppVisualBehaviorAuthoringSourcePolicy(rawInput) {
  const input = exactOwnDataOptions(rawInput, Object.keys(SOURCE_PATHS), "source policy input");
  for (const key of Object.keys(SOURCE_PATHS)) {
    if (typeof input[key] !== "string") {
      fail("SOURCE_POLICY_VIOLATION", `source policy input.${key} must be text.`);
    }
  }

  requireFragments(
    input.connections,
    [
      "export function applyAuthoringInputConnection(",
      'type: "state.set"',
      'value: Object.freeze({ $ref: "event.value" })',
      "value: Object.freeze({ $ref: `state.${capturedRecipe.stateName}` })",
      'return completeValidation(prepared, candidate, "connect-input")',
      "createDesenEditorContinuousValidator",
      "export function applyAuthoringOperationTriggerConnection(",
    ],
    SOURCE_PATHS.connections,
  );
  requireFragments(
    input.conditions,
    [
      "export function applyAuthoringConditionEdit(",
      "setDesenEditorNodeCondition",
      "clearDesenEditorNodeCondition",
      "createDesenEditorContinuousValidator",
    ],
    SOURCE_PATHS.conditions,
  );
  requireFragments(
    input.behaviorProjection,
    [
      "export function projectAuthoringBehaviorControls(",
      'action.type !== "operation.invoke"',
      "MAX_OWNER_OCCURRENCES",
      "MAX_ACTION_OCCURRENCES",
      "conflictedAliases",
    ],
    SOURCE_PATHS.behaviorProjection,
  );
  requireFragments(
    input.behaviorControls,
    [
      "export function InputConnectionControl(",
      "Connects Value to state and writes every change back",
      "export function VisibilityControl(",
      '<option value="advanced">Advanced predicate</option>',
      'aria-label="Visibility predicate JSON"',
      "Apply visibility",
    ],
    SOURCE_PATHS.behaviorControls,
  );
  requireFragments(
    input.eventActionPanel,
    [
      "function VisualActionFields(",
      "Choose from current Source and Catalog references. No code or JSON is required.",
      "<summary>Advanced JSON</summary>",
      'action.type === "operation.invoke"',
    ],
    SOURCE_PATHS.eventActionPanel,
  );
  requireFragments(
    input.eventActions,
    [
      "AuthoringOperationActionReferenceOption",
      "payloadFields: schemaFieldOptions(payloadSchema)",
      "operations: operationOptions(operations)",
      "states: stateOptions(state)",
    ],
    SOURCE_PATHS.eventActions,
  );
  requireFragments(
    input.fixtures,
    [
      "export function prepareAuthoringOperationFixtureModel(",
      "export function createAuthoringOperationFixtureController(",
      "createSyntheticFixtureSnapshot",
      "Request input is deliberately never read or retained.",
      "PREPARED_FIXTURE_MODELS",
    ],
    SOURCE_PATHS.fixtures,
  );
  forbidFragments(
    input.fixtures,
    ["createAuthoringSignInFixtureController", "SIGN_IN_INVOCATION_ALIAS"],
    SOURCE_PATHS.fixtures,
  );
  requireFragments(
    input.previewControls,
    [
      "snapshot.operations.length === 0",
      "Next outcome for {operation.alias}",
      "Complete {operation.alias} fixture",
    ],
    SOURCE_PATHS.previewControls,
  );
  forbidFragments(input.previewControls, ["Next sign-in outcome"], SOURCE_PATHS.previewControls);
  requireFragments(
    input.application,
    [
      "projectAuthoringBehaviorControls",
      "applyAuthoringConditionEdit",
      "applyAuthoringInputConnection",
      "prepareAuthoringOperationFixtureModel",
      "createAuthoringOperationFixtureController",
      "<InputConnectionControl",
      "<VisibilityControl",
    ],
    SOURCE_PATHS.application,
  );
  requireFragments(
    input.inspectorPanel,
    ["readonly behaviorControls?: ReactNode", "{behaviorControls}"],
    SOURCE_PATHS.inspectorPanel,
  );
  requireFragments(
    input.applicationCss,
    [".behaviorControls", ".behaviorCard", ".actionAdvancedEditor"],
    SOURCE_PATHS.applicationCss,
  );
  requireFragments(
    input.browserSpec,
    [
      "async function connectInput(",
      "async function addOperationAction(",
      "async function showOnOperationFailure(",
      'pressSequentially("designer@example.test")',
      'toContainText("Pending")',
      "error:invalidCredentials",
      "Unable to sign in. Check your details and try again.",
    ],
    SOURCE_PATHS.browserSpec,
  );
  if (occurrenceCount(input.browserSpec, `test("${BROWSER_TEST_NAME}"`) !== 1) {
    fail("SOURCE_POLICY_VIOLATION", "The exact browser scenario declaration drifted.");
  }

  return deepFreeze({
    atomicInputConnection: true,
    operationTriggerBoundary: true,
    visualActionComposer: true,
    advancedJsonRetained: true,
    visualConditionalPresence: true,
    sourceAndCatalogDerivedFixtures: true,
    genericRunControls: true,
    requestInputRetained: false,
    browserTestName: BROWSER_TEST_NAME,
    browserTestDeclarations: 1,
    browserExecutionPerformedByReader: false,
  });
}

function authenticateParent(bytes) {
  const pin = DESEN_APP_VISUAL_BEHAVIOR_AUTHORING_PARENT_PIN;
  if (bytes.byteLength !== pin.bytes || sha256(bytes) !== pin.sha256) {
    fail("PARENT_DRIFT", "The exact immutable M10-T01A predecessor drifted.");
  }
  const artifact = parseJson(bytes, pin.path, "PARENT_DRIFT");
  if (
    artifact?.task !== pin.task ||
    artifact?.proofId !== pin.proofId ||
    artifact?.profile !== pin.profile ||
    artifact?.result !== pin.result ||
    artifact?.claim?.taskStatus !== "DONE" ||
    artifact?.claim?.p08Status !== "PROVEN" ||
    artifact?.claim?.runtimeInputAndPendingCovered !== false ||
    artifact?.claim?.invalidCredentialsAndPublicFailureCovered !== false ||
    artifact?.claim?.successNavigationAndHostOperationCovered !== false
  ) {
    fail("PARENT_DRIFT", "The immutable M10-T01A predecessor identity or claim drifted.");
  }
  return deepFreeze({ ...pin });
}

function verifyContracts(files) {
  const appPackage = parseJson(
    files.get("apps/desen-app/package.json"),
    "apps/desen-app/package.json",
  );
  const browserPackage = parseJson(
    files.get("apps/desen-app-browser-e2e/package.json"),
    "apps/desen-app-browser-e2e/package.json",
  );
  const catalog = parseJson(
    files.get("packages/reference-catalog-web/catalog.json"),
    "packages/reference-catalog-web/catalog.json",
  );
  const workflow = decodeUtf8(files.get(".github/workflows/ci.yml"), ".github/workflows/ci.yml");
  if (
    appPackage?.name !== "@desen/app-web" ||
    appPackage?.scripts?.["test:behavior-authoring"] !==
      "vitest run test/authoring-behavior-projection.test.ts test/authoring-conditions.test.ts test/authoring-connections.test.ts test/authoring-event-actions.test.ts test/authoring-fixtures.test.ts test/behavior-controls.test.tsx test/event-action-panel.test.tsx test/preview-controls.test.tsx test/application.test.tsx test/persistence-application.test.tsx test/publication-application.test.tsx" ||
    browserPackage?.name !== "@desen/app-browser-e2e" ||
    browserPackage?.scripts?.["test:e2e"] !==
      "pnpm --filter @desen/app-web... build && pnpm run typecheck && pnpm run build && playwright test --config playwright.config.ts && playwright test --config product-playwright.config.ts" ||
    !workflow.includes("node scripts/verify-desen-app-visual-behavior-authoring.mjs") ||
    !workflow.includes("node --test tests/desen-app-visual-behavior-authoring.test.mjs")
  ) {
    fail("SOURCE_POLICY_VIOLATION", "The package or hosted browser-proof contract drifted.");
  }
  const operation = catalog?.operations?.["com.example.auth/signIn"];
  if (
    catalog?.id !== "run.desen.reference.sign-in" ||
    operation?.effect !== "network" ||
    operation?.authoring?.fixtures?.success?.userId !== "user-1" ||
    typeof operation?.authoring?.fixtures?.errors?.invalidCredentials !== "object"
  ) {
    fail("SOURCE_POLICY_VIOLATION", "The authenticated Catalog fixture authority drifted.");
  }
  return deepFreeze({
    appPackageName: appPackage.name,
    browserPackageName: browserPackage.name,
    focusedTestCommand: FOCUSED_TEST_COMMAND,
    browserCommand: BROWSER_COMMAND,
    exactHeadBrowserExecution: true,
    catalogId: catalog.id,
    operationId: "com.example.auth/signIn",
    operationEffect: operation.effect,
    catalogFixtureOnly: true,
  });
}

async function canonicalArtifactBytes(artifact) {
  return Buffer.from(await format(JSON.stringify(artifact), { parser: "json" }));
}

/** Builds detached deterministic M10-T01B evidence from exact current authorities. */
export async function buildDesenAppVisualBehaviorAuthoringEvidence(rawOptions = undefined) {
  const options = captureBuildOptions(rawOptions);
  const files = await acquireFiles(options);
  const parent = authenticateParent(files.get(PARENT_ARTIFACT_PATH));
  const sourceInput = Object.fromEntries(
    Object.entries(SOURCE_PATHS).map(([key, relativePath]) => [
      key,
      decodeUtf8(files.get(relativePath), relativePath),
    ]),
  );
  const source = verifyDesenAppVisualBehaviorAuthoringSourcePolicy(sourceInput);
  const packageAuthority = verifyContracts(files);
  const trackedReceipts = Object.freeze(
    TRACKED_PATHS.map((relativePath) => {
      const bytes = files.get(relativePath);
      return Object.freeze({ path: relativePath, bytes: bytes.byteLength, sha256: sha256(bytes) });
    }),
  );
  const artifact = deepFreeze({
    schemaVersion: 1,
    proofId: "desen-app-visual-behavior-authoring",
    profile: "desen.app.visual-behavior-authoring-proof.v1",
    task: "M10-T01B",
    gate: null,
    result: "PASS",
    prerequisites: [parent],
    claim: {
      taskStatus: "DONE",
      p08Status: "PROVEN",
      p09Status: "PARTIAL",
      visualInputConnectionCovered: true,
      visualOperationActionCovered: true,
      visualConditionalPresenceCovered: true,
      catalogDerivedRunControlsCovered: true,
      advancedJsonRetained: true,
      authoredBrowserSmokeCovered: true,
      m10T02Closed: false,
      m10T03Closed: false,
      m10T04Closed: false,
      realHostOperationCovered: false,
      remoteDeploymentCovered: false,
      g10Closed: false,
    },
    authority: {
      source,
      package: packageAuthority,
      execution: {
        browserSpec: SOURCE_PATHS.browserSpec,
        browserTestName: BROWSER_TEST_NAME,
        browserTestDeclarations: 1,
        browserExecutedByVerifier: false,
        deterministicReaderStartsListener: false,
      },
    },
    tests: {
      focusedCommand: FOCUSED_TEST_COMMAND,
      browserCommand: BROWSER_COMMAND,
      verifierCommand: "node scripts/verify-desen-app-visual-behavior-authoring.mjs",
      proofReaderCommand: "node --test tests/desen-app-visual-behavior-authoring.test.mjs",
      rootTestNames: DESEN_APP_VISUAL_BEHAVIOR_AUTHORING_ROOT_TEST_NAMES,
      browserExecutedByVerifier: false,
    },
    boundary: {
      trackedFiles: trackedReceipts.length,
      trackedReceipts,
      parentArtifacts: 1,
      immutableInputs: true,
      sourceSymlinksRejected: true,
      browserExecutionSeparateFromStaticReader: true,
      checkpointOwnedReaderPaths: [
        "scripts/lib/desen-app-visual-behavior-authoring-proof.mjs",
        "tests/desen-app-visual-behavior-authoring.test.mjs",
      ],
      artifactTrackedEntrypoints: PROOF_ENTRYPOINT_PATHS,
    },
    nonClaims: [
      "The browser smoke validates authoring usability but does not close the separately planned M10-T02 input/pending task.",
      "M10-T03 invalid-credentials closure and M10-T04 success, navigation, and real host-operation closure remain NOT_PROVEN.",
      "Synthetic Catalog fixtures remain transient authoring preview authority and are not production integrations.",
      "Arbitrary project schemas, remote deployment, multi-user persistence, and G10 closure remain NOT_PROVEN.",
      "The deterministic reader never starts Chromium, Vite, or a network listener; exact-head Browser E2E remains separate.",
      "No hosted-CI pass is inferred from locally generated artifact bytes alone.",
    ],
  });
  const artifactBytes = await canonicalArtifactBytes(artifact);
  return deepFreeze({ artifact, artifactBytes, artifactSha256: sha256(artifactBytes) });
}

function verifyProofDocument(bytes, artifactSha256) {
  const source = decodeUtf8(bytes, PROOF_DOCUMENT_RELATIVE_PATH, "PROOF_DOCUMENT_DRIFT");
  const expectedHeader = [
    "# Desen App visual behavior authoring",
    "",
    "Task: M10-T01B",
    "",
    "Status: DONE",
    "",
    "P-08: PROVEN",
    "",
    "P-09: PARTIAL",
    "",
    `Predecessor artifact: \`sha256:${DESEN_APP_VISUAL_BEHAVIOR_AUTHORING_PARENT_PIN.sha256}\``,
    "",
    `Final artifact: \`sha256:${artifactSha256}\``,
  ].join("\n");
  if (
    !source.startsWith(expectedHeader) ||
    occurrenceCount(source, "Task: M10-T01B") !== 1 ||
    occurrenceCount(source, "Status: DONE") !== 1 ||
    occurrenceCount(source, "P-08: PROVEN") !== 1 ||
    occurrenceCount(source, "P-09: PARTIAL") !== 1 ||
    occurrenceCount(source, "Final artifact:") !== 1 ||
    source.includes("sha256:PENDING")
  ) {
    fail("PROOF_DOCUMENT_DRIFT", "The M10-T01B proof report lost its exact authority header.");
  }
}

function assertPinnedArtifact(bytes) {
  if (
    IMMUTABLE_ARTIFACT_PIN.bytes <= 0 ||
    !/^[0-9a-f]{64}$/u.test(IMMUTABLE_ARTIFACT_PIN.sha256) ||
    bytes.byteLength !== IMMUTABLE_ARTIFACT_PIN.bytes ||
    sha256(bytes) !== IMMUTABLE_ARTIFACT_PIN.sha256
  ) {
    fail("ARTIFACT_DRIFT", "The immutable committed M10-T01B artifact bytes drifted.");
  }
}

/** Verifies the frozen M10-T01B artifact against freshly acquired exact authorities. */
export async function verifyDesenAppVisualBehaviorAuthoringEvidence(rawOptions = undefined) {
  const options = exactOwnDataOptions(
    rawOptions,
    ["artifactBytes", "artifactPath", "buildOptions", "proofDocument", "proofDocumentPath"],
    "verify options",
  );
  const built = await buildDesenAppVisualBehaviorAuthoringEvidence(options.buildOptions);
  const artifactPath =
    options.artifactPath === undefined
      ? DEFAULT_DESEN_APP_VISUAL_BEHAVIOR_AUTHORING_ARTIFACT_PATH
      : path.resolve(options.artifactPath);
  const artifactBytes =
    options.artifactBytes === undefined
      ? await readRegularAuthority(artifactPath, ARTIFACT_RELATIVE_PATH)
      : captureBytes(options.artifactBytes, "artifactBytes");
  assertPinnedArtifact(artifactBytes);
  if (!artifactBytes.equals(built.artifactBytes)) {
    fail("ARTIFACT_DRIFT", "The committed M10-T01B artifact does not match current authorities.");
  }
  const artifact = parseJson(artifactBytes, ARTIFACT_RELATIVE_PATH, "ARTIFACT_DRIFT");
  if (
    artifact?.task !== "M10-T01B" ||
    artifact?.proofId !== "desen-app-visual-behavior-authoring" ||
    artifact?.profile !== "desen.app.visual-behavior-authoring-proof.v1" ||
    artifact?.result !== "PASS"
  ) {
    fail("ARTIFACT_DRIFT", "The committed M10-T01B artifact identity drifted.");
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
    trackedFiles: artifact.boundary.trackedFiles,
    rootTests: artifact.tests.rootTestNames.length,
    browserTestDeclarations: artifact.authority.execution.browserTestDeclarations,
    p08Status: artifact.claim.p08Status,
    p09Status: artifact.claim.p09Status,
    m10T02Closed: artifact.claim.m10T02Closed,
    m10T03Closed: artifact.claim.m10T03Closed,
    m10T04Closed: artifact.claim.m10T04Closed,
    browserExecutedByVerifier: false,
  });
}

async function canonicalDestinationPath(filePath) {
  const absolutePath = path.resolve(filePath);
  const canonicalParent = await realpath(path.dirname(absolutePath));
  return path.join(canonicalParent, path.basename(absolutePath));
}

/** Atomically writes newly built M10-T01B evidence or refuses unsafe tracked replacement. */
export async function writeDesenAppVisualBehaviorAuthoringEvidence(rawOptions = undefined) {
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
      ? DEFAULT_DESEN_APP_VISUAL_BEHAVIOR_AUTHORING_ARTIFACT_PATH
      : path.resolve(options.artifactPath);
  const built = await buildDesenAppVisualBehaviorAuthoringEvidence(options.buildOptions);
  let destination;
  try {
    destination = await canonicalDestinationPath(artifactPath);
  } catch (error) {
    fail("ARTIFACT_WRITE_UNSAFE", "The M10-T01B artifact destination is unsafe.", {
      cause: String(error),
    });
  }
  if (
    destination ===
    (await canonicalDestinationPath(DEFAULT_DESEN_APP_VISUAL_BEHAVIOR_AUTHORING_ARTIFACT_PATH))
  ) {
    try {
      const existing = await readRegularAuthority(destination, ARTIFACT_RELATIVE_PATH);
      if (IMMUTABLE_ARTIFACT_PIN.bytes > 0 && !existing.equals(built.artifactBytes)) {
        fail("ARTIFACT_WRITE_UNSAFE", "Refusing to rewrite the frozen tracked M10-T01B artifact.");
      }
    } catch (error) {
      if (
        error instanceof DesenAppVisualBehaviorAuthoringProofError &&
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
    if (error instanceof DesenAppVisualBehaviorAuthoringProofError) throw error;
    fail("ARTIFACT_WRITE_UNSAFE", "M10-T01B artifact write failed safely.", {
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
