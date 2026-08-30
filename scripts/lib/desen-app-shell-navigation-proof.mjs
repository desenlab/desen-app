import { createHash } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual, types as utilTypes } from "node:util";
import { fileURLToPath } from "node:url";

import ts from "typescript";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-shell-navigation.json";
const PROOF_DOCUMENT_PATH = "docs/proof/DESEN-APP-SHELL-NAVIGATION.md";
const PREREQUISITE_PATH = "docs/proof/artifacts/editor-core-0.1.0-terminal-integration.json";
const MAX_AUTHORITY_BYTES = 16 * 1_024 * 1_024;
const READ_FLAGS =
  fileConstants.O_RDONLY | (fileConstants.O_NOFOLLOW ?? 0) | (fileConstants.O_NONBLOCK ?? 0);
const APP_PATHS = Object.freeze([
  "apps/desen-app/package.json",
  "apps/desen-app/tsconfig.json",
  "apps/desen-app/index.html",
  "apps/desen-app/README.md",
  "apps/desen-app/src/assets/breadcrumb-separator.svg",
  "apps/desen-app/src/assets/desen-logo.svg",
  "apps/desen-app/src/assets/plus.svg",
  "apps/desen-app/src/assets/settings.svg",
  "apps/desen-app/src/assets/theme.svg",
  "apps/desen-app/src/application.tsx",
  "apps/desen-app/src/application.module.css",
  "apps/desen-app/src/main.tsx",
  "apps/desen-app/src/project-data.ts",
  "apps/desen-app/src/project-navigation.ts",
  "apps/desen-app/src/styles.css",
  "apps/desen-app/test/application.test.tsx",
  "apps/desen-app/test/main-lifecycle.test.tsx",
  "apps/desen-app/test/project-navigation.test.ts",
]);
const PROOF_PATHS = Object.freeze([
  "package.json",
  "scripts/lib/atomic-proof-artifact.mjs",
  "scripts/lib/desen-app-shell-navigation-proof.mjs",
  "scripts/generate-desen-app-shell-navigation-proof.mjs",
  "scripts/verify-desen-app-shell-navigation.mjs",
  "tests/desen-app-shell-navigation.test.mjs",
]);
const TRACKED_PATHS = Object.freeze([...APP_PATHS, ...PROOF_PATHS]);
const SOURCE_PATHS = Object.freeze(
  APP_PATHS.filter((relativePath) => /\/src\/(?:.+\.(?:ts|tsx)|.+\.css)$/u.test(relativePath)),
);
const SVG_ASSET_PATHS = Object.freeze(
  APP_PATHS.filter((relativePath) => /\/src\/assets\/.+\.svg$/u.test(relativePath)),
);
const AUTHORING_SOURCE_PATH = "apps/desen-app/src/authoring-data.ts";
const ADAPTER_CANVAS_SOURCE_PATH = "apps/desen-app/src/adapter-canvas.tsx";
const AUTHORING_SELECTION_SOURCE_PATH = "apps/desen-app/src/authoring-selection.ts";
const AUTHORING_INSPECTOR_SOURCE_PATH = "apps/desen-app/src/authoring-inspector.ts";
const AUTHORING_PREVIEW_SOURCE_PATH = "apps/desen-app/src/authoring-preview.ts";
const INSPECTOR_PANEL_SOURCE_PATH = "apps/desen-app/src/inspector-panel.tsx";
const STRUCTURED_JSON_SOURCE_PATH = "apps/desen-app/src/structured-json.ts";
const AUTHORING_SLOT_SOURCE_PATH = "apps/desen-app/src/authoring-slots.ts";
const AUTHORING_STATE_SOURCE_PATH = "apps/desen-app/src/authoring-state.ts";
const STATE_PANEL_SOURCE_PATH = "apps/desen-app/src/state-panel.tsx";
const AUTHORING_EVENT_ACTION_SOURCE_PATH = "apps/desen-app/src/authoring-event-actions.ts";
const EVENT_ACTION_PANEL_SOURCE_PATH = "apps/desen-app/src/event-action-panel.tsx";
const NAMED_SLOT_ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-named-slot-authoring.json";
const FIXTURES_SCENARIOS_ARTIFACT_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-fixtures-scenarios-fidelity.json";
const SOURCE_PERSISTENCE_ARTIFACT_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-source-persistence.json";
const NODE_LINKED_DIAGNOSTICS_ARTIFACT_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-node-linked-diagnostics.json";
const PUBLISH_ACTIVATION_ARTIFACT_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-publish-activation.json";
const APPLICATION_SOURCE_PATH = "apps/desen-app/src/application.tsx";
const AUTHORING_FIXTURES_SOURCE_PATH = "apps/desen-app/src/authoring-fixtures.ts";
const AUTHORING_SCENARIOS_SOURCE_PATH = "apps/desen-app/src/authoring-scenarios.ts";
const PREVIEW_CONTROLS_SOURCE_PATH = "apps/desen-app/src/preview-controls.tsx";
const PREVIEW_FIDELITY_SOURCE_PATH = "apps/desen-app/src/preview-fidelity.ts";
const ADAPTER_CANVAS_TEST_PATH = "apps/desen-app/test/adapter-canvas.test.tsx";
const APPLICATION_TEST_PATH = "apps/desen-app/test/application.test.tsx";
const AUTHORING_FIXTURES_TEST_PATH = "apps/desen-app/test/authoring-fixtures.test.ts";
const AUTHORING_SCENARIOS_TEST_PATH = "apps/desen-app/test/authoring-scenarios.test.ts";
const PREVIEW_CONTROLS_TEST_PATH = "apps/desen-app/test/preview-controls.test.tsx";
const PREVIEW_FIDELITY_TEST_PATH = "apps/desen-app/test/preview-fidelity.test.ts";
const OFFICIAL_SOURCE_PATH = "examples/sign-in/official-derived.source.desen.json";
const OFFICIAL_BUNDLE_PATH = "examples/sign-in/official-derived.bundle.desen.json";
const T12_SUCCESSOR_RECEIPT_PATHS = Object.freeze([
  "package.json",
  "pnpm-lock.yaml",
  "apps/desen-app/package.json",
  "apps/desen-app/src/application.module.css",
  "apps/desen-app/src/application.tsx",
  "apps/desen-app/src/authoring-persistence.ts",
  "apps/desen-app/src/inspector-panel.tsx",
  "apps/desen-app/src/persistence-controls.tsx",
  "apps/desen-app/src/project-navigation.ts",
  "apps/desen-app/src/state-panel.tsx",
  "apps/desen-app/test/application.test.tsx",
  "apps/desen-app/test/authoring-persistence.test.ts",
  "apps/desen-app/test/inspector-panel.test.tsx",
  "apps/desen-app/test/persistence-application.test.tsx",
  "apps/desen-app/test/persistence-controls.test.tsx",
  "apps/desen-app/test/project-navigation.test.ts",
  "apps/desen-app/test/state-panel.test.tsx",
]);
const T13_SUCCESSOR_RECEIPT_PATHS = Object.freeze([
  "package.json",
  "pnpm-lock.yaml",
  "apps/desen-app/package.json",
  "apps/desen-app/src/adapter-canvas.tsx",
  "apps/desen-app/src/application.module.css",
  "apps/desen-app/src/application.tsx",
  "apps/desen-app/src/authoring-diagnostics.ts",
  "apps/desen-app/src/authoring-event-actions.ts",
  "apps/desen-app/src/authoring-inspector.ts",
  "apps/desen-app/src/authoring-persistence.ts",
  "apps/desen-app/src/authoring-slots.ts",
  "apps/desen-app/src/authoring-state.ts",
  "apps/desen-app/src/diagnostics-panel.tsx",
  "apps/desen-app/src/inspector-panel.tsx",
  "apps/desen-app/test/adapter-canvas.test.tsx",
  "apps/desen-app/test/application.test.tsx",
  "apps/desen-app/test/authoring-diagnostics.test.ts",
  "apps/desen-app/test/authoring-event-actions.test.ts",
  "apps/desen-app/test/authoring-inspector.test.ts",
  "apps/desen-app/test/authoring-slots.test.ts",
  "apps/desen-app/test/authoring-state.test.ts",
  "apps/desen-app/test/diagnostics-panel.test.tsx",
  "apps/desen-app/test/persistence-application.test.tsx",
]);
const T14_SUCCESSOR_RECEIPT_PATHS = Object.freeze([
  "package.json",
  "pnpm-lock.yaml",
  "apps/desen-app/package.json",
  "apps/desen-app/src/application.module.css",
  "apps/desen-app/src/application.tsx",
  "apps/desen-app/src/authoring-preview.ts",
  "apps/desen-app/src/authoring-publication.ts",
  "apps/desen-app/src/publication-controls.tsx",
  "apps/desen-app/test/application.test.tsx",
  "apps/desen-app/test/authoring-publication.test.ts",
  "apps/desen-app/test/publication-activation-integration.test.ts",
  "apps/desen-app/test/publication-application.test.tsx",
  "apps/desen-app/test/publication-controls.test.tsx",
  "packages/editor-web/package.json",
  "packages/editor-web/src/index.ts",
  "packages/editor-web/src/local-bundle-channel-publication.ts",
  "packages/editor-web/test/local-bundle-channel-publication.test.ts",
  "packages/editor-web/test/public-package.mjs",
  "packages/editor-web/test/public-package.types.mts",
]);
const T14_PUBLICATION_APPLICATION_TEST_PATH =
  "apps/desen-app/test/publication-application.test.tsx";
const T14_FROZEN_PUBLICATION_APPLICATION_TEST_RECEIPT = Object.freeze({
  bytes: 24_485,
  sha256: "52e29b84745ff331556529612015b95b581bf3007118352ebad796ca9541e0e3",
});
const T14_LIVE_PUBLICATION_APPLICATION_TEST_RECEIPT = Object.freeze({
  bytes: 24_493,
  sha256: "5eba8a2b15cbcf992d0f04d0d7ad719c1a9fc42cdb66635ebc0eab679a221901",
});
const ADDITIVE_SUCCESSOR_SOURCE_PATHS = Object.freeze([
  AUTHORING_SOURCE_PATH,
  ADAPTER_CANVAS_SOURCE_PATH,
  AUTHORING_SELECTION_SOURCE_PATH,
  AUTHORING_INSPECTOR_SOURCE_PATH,
  AUTHORING_PREVIEW_SOURCE_PATH,
  INSPECTOR_PANEL_SOURCE_PATH,
  STRUCTURED_JSON_SOURCE_PATH,
  AUTHORING_SLOT_SOURCE_PATH,
  AUTHORING_STATE_SOURCE_PATH,
  STATE_PANEL_SOURCE_PATH,
  AUTHORING_EVENT_ACTION_SOURCE_PATH,
  EVENT_ACTION_PANEL_SOURCE_PATH,
  AUTHORING_FIXTURES_SOURCE_PATH,
  AUTHORING_SCENARIOS_SOURCE_PATH,
  PREVIEW_CONTROLS_SOURCE_PATH,
  PREVIEW_FIDELITY_SOURCE_PATH,
]);
const CURRENT_TYPESCRIPT_SOURCE_PATHS = Object.freeze([
  ...new Set([
    ...SOURCE_PATHS.filter((entry) => /\.(?:ts|tsx)$/u.test(entry)),
    ...ADDITIVE_SUCCESSOR_SOURCE_PATHS,
    ...T12_SUCCESSOR_RECEIPT_PATHS.filter((entry) => /\/src\/.+\.(?:ts|tsx)$/u.test(entry)),
    ...T13_SUCCESSOR_RECEIPT_PATHS.filter((entry) => /\/src\/.+\.(?:ts|tsx)$/u.test(entry)),
    ...T14_SUCCESSOR_RECEIPT_PATHS.filter((entry) =>
      /^apps\/desen-app\/src\/.+\.(?:ts|tsx)$/u.test(entry),
    ),
  ]),
]);
const TEST_PATHS = Object.freeze(
  APP_PATHS.filter((relativePath) => /\/test\//u.test(relativePath)),
);
const SUCCESSOR_COMPATIBILITY_PATHS = Object.freeze([
  ...T12_SUCCESSOR_RECEIPT_PATHS,
  ...T13_SUCCESSOR_RECEIPT_PATHS,
  ...T14_SUCCESSOR_RECEIPT_PATHS,
  "package.json",
  "apps/desen-app/package.json",
  "apps/desen-app/README.md",
  "apps/desen-app/src/application.tsx",
  "apps/desen-app/src/application.module.css",
  "apps/desen-app/src/styles.css",
  ADAPTER_CANVAS_SOURCE_PATH,
  "apps/desen-app/test/application.test.tsx",
  "apps/desen-app/test/main-lifecycle.test.tsx",
  "scripts/lib/desen-app-shell-navigation-proof.mjs",
  "tests/desen-app-shell-navigation.test.mjs",
]);
const CURRENT_COMPATIBILITY_PATHS = Object.freeze([
  ...new Set([
    ...TRACKED_PATHS,
    ...ADDITIVE_SUCCESSOR_SOURCE_PATHS,
    "pnpm-lock.yaml",
    NAMED_SLOT_ARTIFACT_PATH,
    FIXTURES_SCENARIOS_ARTIFACT_PATH,
    SOURCE_PERSISTENCE_ARTIFACT_PATH,
    NODE_LINKED_DIAGNOSTICS_ARTIFACT_PATH,
    PUBLISH_ACTIVATION_ARTIFACT_PATH,
    ...T12_SUCCESSOR_RECEIPT_PATHS,
    ...T13_SUCCESSOR_RECEIPT_PATHS,
    ...T14_SUCCESSOR_RECEIPT_PATHS,
    ADAPTER_CANVAS_TEST_PATH,
    AUTHORING_FIXTURES_TEST_PATH,
    AUTHORING_SCENARIOS_TEST_PATH,
    PREVIEW_CONTROLS_TEST_PATH,
    PREVIEW_FIDELITY_TEST_PATH,
  ]),
]);
const SELF_RESEALED_PATHS = Object.freeze([
  "scripts/lib/desen-app-shell-navigation-proof.mjs",
  "tests/desen-app-shell-navigation.test.mjs",
]);
const RETAINED_HISTORICAL_PATHS = Object.freeze(
  TRACKED_PATHS.filter((relativePath) => !SUCCESSOR_COMPATIBILITY_PATHS.includes(relativePath)),
);
const FROZEN_ARTIFACT_PIN = Object.freeze({
  bytes: 12_118,
  sha256: "c3189ff9196f0da91311156893ab569a3c9f9c1ee62631b58286647f36d23220",
});
const NAMED_SLOT_ARTIFACT_PIN = Object.freeze({
  task: "M09-T07",
  proofId: "desen-app-named-slot-authoring",
  profile: "desen.app.named-slot-authoring-proof.v1",
  result: "PASS",
  path: NAMED_SLOT_ARTIFACT_PATH,
  bytes: 24_830,
  sha256: "daae817af45d8ead7052fd84df4edefd7d29cdd9ebe9cc1baea5b22b27dae90f",
});
const FIXTURES_SCENARIOS_ARTIFACT_PIN = Object.freeze({
  task: "M09-T11",
  proofId: "desen-app-fixtures-scenarios-fidelity",
  profile: "desen.app.fixtures-scenarios-fidelity-proof.v1",
  result: "PASS",
  path: FIXTURES_SCENARIOS_ARTIFACT_PATH,
  bytes: 29_407,
  sha256: "3f08980e687d48ba267f78c7d4dd1ae1eb59db5cc6bb3401d88705ee0416cc9d",
});
const T11_LIVE_RECEIPT_PATHS = Object.freeze([
  "package.json",
  "apps/desen-app/package.json",
  "pnpm-lock.yaml",
  ADAPTER_CANVAS_SOURCE_PATH,
  "apps/desen-app/src/application.module.css",
  APPLICATION_SOURCE_PATH,
  AUTHORING_FIXTURES_SOURCE_PATH,
  AUTHORING_SCENARIOS_SOURCE_PATH,
  INSPECTOR_PANEL_SOURCE_PATH,
  PREVIEW_CONTROLS_SOURCE_PATH,
  PREVIEW_FIDELITY_SOURCE_PATH,
  ADAPTER_CANVAS_TEST_PATH,
  APPLICATION_TEST_PATH,
  AUTHORING_FIXTURES_TEST_PATH,
  AUTHORING_SCENARIOS_TEST_PATH,
  PREVIEW_CONTROLS_TEST_PATH,
  PREVIEW_FIDELITY_TEST_PATH,
]);

/** Exact immutable G08 prerequisite for the first Desen App task. */
export const DESEN_APP_SHELL_NAVIGATION_PREREQUISITE_PIN = Object.freeze({
  task: "M08-T10",
  gate: "G08",
  path: PREREQUISITE_PATH,
  bytes: 325_549,
  sha256: "5787479d699ab8f53b739e633bf9a88900da00ae4f4c78f96b3e62a73133fa1b",
  proofId: "editor-core-terminal-integration",
  profile: "desen.editor-core.terminal-integration-proof.v1",
  result: "PASS",
});

/** Exact root-test names owned by the M09-T01 proof reader. */
export const DESEN_APP_SHELL_NAVIGATION_ROOT_TEST_NAMES = Object.freeze([
  "[authority] binds M09-T01 to the exact completed G08 artifact",
  "[shell] records the closed route, fixture, guidance, and accessibility profile",
  "[boundary] keeps the first app slice free of editor, renderer, persistence, and publish authority",
  "[determinism] builds byte-identical detached evidence twice",
  "[mutation] rejects prerequisite, route, package, and scope-boundary drift",
  "[verification] rejects artifact and visible proof-pin drift",
  "[writer] atomically writes exact evidence and preserves a destination on tampering",
  "[filesystem] rejects linked prerequisite, artifact, and proof authorities",
]);

/** Default destination for deterministic M09-T01 evidence. */
export const DEFAULT_DESEN_APP_SHELL_NAVIGATION_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_PATH,
);

/** Stable fail-closed error raised by the M09-T01 evidence builder. */
export class DesenAppShellNavigationProofError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "DesenAppShellNavigationProofError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details = {}) {
  throw new DesenAppShellNavigationProofError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function deepFreeze(value) {
  if (ArrayBuffer.isView(value)) return value;
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
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
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== "string" || !allowedKeys.includes(key))) {
    fail("OPTIONS_INVALID", `${label} contains an unknown or symbol field.`);
  }
  const captured = Object.create(null);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
      fail("OPTIONS_INVALID", `${label}.${String(key)} must be enumerable own data.`);
    }
    captured[key] = descriptor.value;
  }
  return Object.freeze(captured);
}

function capturePath(value, label, fallback) {
  const selected = value === undefined ? fallback : value;
  if (typeof selected !== "string" || selected.length === 0 || selected.includes("\0")) {
    fail("OPTIONS_INVALID", `${label} must be one non-empty path.`);
  }
  return path.resolve(selected);
}

function captureBytes(value, label) {
  if (
    value === null ||
    typeof value !== "object" ||
    utilTypes.isProxy(value) ||
    !utilTypes.isUint8Array(value) ||
    utilTypes.isSharedArrayBuffer(value.buffer) ||
    (Object.getPrototypeOf(value) !== Uint8Array.prototype &&
      Object.getPrototypeOf(value) !== Buffer.prototype)
  ) {
    fail("OPTIONS_INVALID", `${label} must be exact non-shared Buffer or Uint8Array bytes.`);
  }
  return Buffer.from(value);
}

function captureOverrides(value) {
  if (value === undefined) return Object.freeze(new Map());
  if (
    !(value instanceof Map) ||
    utilTypes.isProxy(value) ||
    value.size > CURRENT_COMPATIBILITY_PATHS.length
  ) {
    fail("OPTIONS_INVALID", "fileOverrides must be one bounded Map.");
  }
  const captured = new Map();
  for (const [relativePath, bytes] of value) {
    if (!CURRENT_COMPATIBILITY_PATHS.includes(relativePath) || captured.has(relativePath)) {
      fail("OPTIONS_INVALID", "fileOverrides contains an unknown or duplicate path.", {
        path: relativePath,
      });
    }
    captured.set(relativePath, captureBytes(bytes, `fileOverrides[${relativePath}]`));
  }
  return Object.freeze(captured);
}

function captureBuildOptions(rawOptions) {
  const options = exactOwnDataOptions(
    rawOptions,
    ["fileOverrides", "prerequisiteBytes", "prerequisitePath", "workspaceRoot"],
    "build options",
  );
  const workspaceRoot = capturePath(options.workspaceRoot, "workspaceRoot", WORKSPACE_ROOT);
  return Object.freeze({
    workspaceRoot,
    fileOverrides: captureOverrides(options.fileOverrides),
    prerequisiteBytes:
      options.prerequisiteBytes === undefined
        ? undefined
        : captureBytes(options.prerequisiteBytes, "prerequisiteBytes"),
    prerequisitePath: capturePath(
      options.prerequisitePath,
      "prerequisitePath",
      path.join(workspaceRoot, PREREQUISITE_PATH),
    ),
  });
}

async function readRegularAuthority(absolutePath, label) {
  const resolved = path.resolve(absolutePath);
  let canonicalParent;
  try {
    canonicalParent = await realpath(path.dirname(resolved));
  } catch (error) {
    fail("AUTHORITY_UNSAFE", `${label} parent is unavailable.`, { cause: String(error) });
  }
  const canonical = path.join(canonicalParent, path.basename(resolved));
  if (canonical !== resolved) {
    fail("AUTHORITY_UNSAFE", `${label} must not traverse a linked parent.`);
  }
  let before;
  let handle;
  try {
    before = await lstat(canonical);
    if (
      !before.isFile() ||
      before.isSymbolicLink() ||
      before.nlink !== 1 ||
      before.size > MAX_AUTHORITY_BYTES
    ) {
      fail("AUTHORITY_UNSAFE", `${label} must be one bounded regular non-linked file.`);
    }
    handle = await open(canonical, READ_FLAGS);
    const opened = await handle.stat();
    if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino) {
      fail("AUTHORITY_UNSAFE", `${label} changed identity while opening.`);
    }
    const bytes = await handle.readFile();
    if (bytes.byteLength !== before.size || bytes.byteLength > MAX_AUTHORITY_BYTES) {
      fail("AUTHORITY_UNSAFE", `${label} changed size while reading.`);
    }
    return bytes;
  } catch (error) {
    if (error instanceof DesenAppShellNavigationProofError) throw error;
    fail("AUTHORITY_UNSAFE", `${label} could not be read safely.`, { cause: String(error) });
  } finally {
    await handle?.close();
  }
}

function decodeUtf8(bytes, label) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail("UTF8_INVALID", `${label} is not valid UTF-8.`);
  }
}

function parseJson(bytes, label) {
  try {
    return JSON.parse(decodeUtf8(bytes, label));
  } catch (error) {
    if (error instanceof DesenAppShellNavigationProofError) throw error;
    fail("JSON_INVALID", `${label} is not valid JSON.`);
  }
}

function exactTextCount(source, expected) {
  return source.split(expected).length - 1;
}

function requireText(source, expected, label) {
  if (exactTextCount(source, expected) < 1) {
    fail("SHELL_SEMANTIC_DRIFT", `${label} lost required M09-T01 semantics.`, { expected });
  }
}

function rejectText(source, pattern, label) {
  if (pattern.test(source)) {
    fail("SCOPE_BOUNDARY_DRIFT", `${label} crosses the M09-T01 scope boundary.`, {
      pattern: String(pattern),
    });
  }
}

function verifyPrerequisite(bytes) {
  if (
    bytes.byteLength !== DESEN_APP_SHELL_NAVIGATION_PREREQUISITE_PIN.bytes ||
    sha256(bytes) !== DESEN_APP_SHELL_NAVIGATION_PREREQUISITE_PIN.sha256
  ) {
    fail("PREREQUISITE_DRIFT", "The exact completed G08 artifact changed.");
  }
  const artifact = parseJson(bytes, PREREQUISITE_PATH);
  for (const [key, expected] of [
    ["task", DESEN_APP_SHELL_NAVIGATION_PREREQUISITE_PIN.task],
    ["proofId", DESEN_APP_SHELL_NAVIGATION_PREREQUISITE_PIN.proofId],
    ["profile", DESEN_APP_SHELL_NAVIGATION_PREREQUISITE_PIN.profile],
    ["result", DESEN_APP_SHELL_NAVIGATION_PREREQUISITE_PIN.result],
  ]) {
    if (artifact?.[key] !== expected) {
      fail("PREREQUISITE_DRIFT", `The G08 prerequisite lost its exact ${key}.`);
    }
  }
  if (artifact?.claim?.gateStatus !== "DONE" || artifact?.claim?.p18Status !== "PROVEN") {
    fail("PREREQUISITE_DRIFT", "The G08 prerequisite no longer proves terminal editor closure.");
  }
  return deepFreeze({ ...DESEN_APP_SHELL_NAVIGATION_PREREQUISITE_PIN });
}

function verifyPackage(bytes, rootPackageBytes) {
  const manifest = parseJson(bytes, "apps/desen-app/package.json");
  const rootManifest = parseJson(rootPackageBytes, "package.json");
  const expectedDevDependencies = {
    "@desen/control-plane-api": "workspace:*",
    "@desen/editor-web": "workspace:*",
    "@desen/reference-host-web-server": "workspace:*",
    "@testing-library/dom": "10.4.1",
    "@testing-library/react": "16.3.2",
    "@types/node": "24.13.3",
    "@types/react": "19.2.17",
    "@types/react-dom": "19.2.3",
    jsdom: "29.1.1",
    vite: "8.1.5",
    vitest: "4.1.10",
  };
  const expectedScripts = {
    build: "vite build",
    typecheck: "tsc -p tsconfig.json --noEmit",
    test: "vitest run",
    "test:shell":
      "vitest run test/project-navigation.test.ts test/application.test.tsx test/main-lifecycle.test.tsx",
  };
  const expectedRootScripts = {
    "generate:desen-app-shell-navigation":
      "pnpm verify:editor-core-terminal-integration && pnpm --filter @desen/app-web build && pnpm --filter @desen/app-web typecheck && pnpm --filter @desen/app-web test:shell && node scripts/generate-desen-app-shell-navigation-proof.mjs",
    "verify:desen-app-shell-navigation":
      "pnpm verify:editor-core-terminal-integration && pnpm --filter @desen/app-web build && pnpm --filter @desen/app-web typecheck && pnpm --filter @desen/app-web test:shell && node scripts/verify-desen-app-shell-navigation.mjs",
    "test:desen-app-shell-navigation":
      "pnpm verify:editor-core-terminal-integration && pnpm --filter @desen/app-web build && pnpm --filter @desen/app-web typecheck && pnpm --filter @desen/app-web test:shell && node --test tests/desen-app-shell-navigation.test.mjs",
  };
  const namedSlotTestCommand =
    "vitest run test/authoring-data.test.ts test/authoring-slots.test.ts test/authoring-preview.test.ts test/adapter-canvas.test.tsx test/application.test.tsx";
  const fixturesScenariosTestCommand =
    "vitest run test/authoring-fixtures.test.ts test/authoring-scenarios.test.ts test/preview-fidelity.test.ts test/preview-controls.test.tsx test/adapter-canvas.test.tsx test/application.test.tsx";
  const namedSlotPrefix =
    "node scripts/verify-desen-app-structured-inspector.mjs && pnpm --filter @desen/app-web build && pnpm --filter @desen/app-web typecheck && pnpm --filter @desen/app-web test:named-slots && ";
  const namedSlotRootCommands = {
    "generate:desen-app-named-slot-authoring": `${namedSlotPrefix}node scripts/generate-desen-app-named-slot-authoring-proof.mjs`,
    "verify:desen-app-named-slot-authoring": `${namedSlotPrefix}node scripts/verify-desen-app-named-slot-authoring.mjs`,
    "test:desen-app-named-slot-authoring": `${namedSlotPrefix}node --test tests/desen-app-named-slot-authoring.test.mjs`,
  };
  const dependencyEntries = Object.entries(manifest?.dependencies ?? {});
  const additiveDependencies = dependencyEntries.filter(
    ([name]) => name !== "react" && name !== "react-dom",
  );
  if (
    manifest?.name !== "@desen/app-web" ||
    manifest?.private !== true ||
    manifest?.type !== "module" ||
    !isDeepStrictEqual(
      Object.fromEntries(Object.keys(expectedScripts).map((key) => [key, manifest.scripts?.[key]])),
      expectedScripts,
    ) ||
    manifest?.dependencies?.react !== "19.2.8" ||
    manifest?.dependencies?.["react-dom"] !== "19.2.8" ||
    additiveDependencies.some(
      ([name, version]) => !name.startsWith("@desen/") || version !== "workspace:*",
    ) ||
    dependencyEntries.some(([name]) => /(?:router|icon|(?:^|[-/])ui(?:$|[-/]))/iu.test(name)) ||
    !isDeepStrictEqual(manifest?.devDependencies, expectedDevDependencies) ||
    manifest.scripts?.["test:named-slots"] !== namedSlotTestCommand ||
    manifest.scripts?.["test:fixtures-scenarios"] !== fixturesScenariosTestCommand ||
    !isDeepStrictEqual(
      Object.fromEntries(
        Object.keys(expectedRootScripts).map((key) => [key, rootManifest.scripts?.[key]]),
      ),
      expectedRootScripts,
    ) ||
    Object.entries(namedSlotRootCommands).some(
      ([name, command]) => rootManifest.scripts?.[name] !== command,
    ) ||
    rootManifest?.devDependencies?.typescript !== "6.0.3" ||
    ts.version !== "6.0.3"
  ) {
    fail("PACKAGE_DRIFT", "The private React/Vite Desen App package contract drifted.");
  }
  return deepFreeze({
    name: manifest.name,
    private: manifest.private,
    framework: `react@${manifest.dependencies.react}`,
    buildTool: `vite@${manifest.devDependencies?.vite}`,
    proofParser: `typescript@${ts.version}`,
    additiveWorkspaceDependencies: additiveDependencies
      .map(([name]) => name)
      .sort((left, right) => left.localeCompare(right)),
    routerDependency: false,
    uiKitDependency: false,
    iconDependency: false,
    namedSlotTestCommand,
    fixturesScenariosTestCommand,
    namedSlotRootCommands,
  });
}

function verifyShellSemantics(files) {
  const application = decodeUtf8(
    files.get("apps/desen-app/src/application.tsx"),
    "application.tsx",
  );
  const navigation = decodeUtf8(
    files.get("apps/desen-app/src/project-navigation.ts"),
    "project-navigation.ts",
  );
  const data = decodeUtf8(files.get("apps/desen-app/src/project-data.ts"), "project-data.ts");
  const main = decodeUtf8(files.get("apps/desen-app/src/main.tsx"), "main.tsx");
  const globalStyles = decodeUtf8(files.get("apps/desen-app/src/styles.css"), "styles.css");
  const moduleStyles = decodeUtf8(
    files.get("apps/desen-app/src/application.module.css"),
    "application.module.css",
  );
  const readme = decodeUtf8(files.get("apps/desen-app/README.md"), "apps/desen-app/README.md");

  const svgAssets = Object.freeze(
    [
      ["apps/desen-app/src/assets/breadcrumb-separator.svg", 12, undefined],
      ["apps/desen-app/src/assets/desen-logo.svg", 24, 'id="Desys"'],
      ["apps/desen-app/src/assets/plus.svg", 12, undefined],
      ["apps/desen-app/src/assets/settings.svg", 24, undefined],
      ["apps/desen-app/src/assets/theme.svg", 24, undefined],
    ].map(([relativePath, size, identity]) => {
      const source = decodeUtf8(files.get(relativePath), relativePath);
      requireText(source, `<svg`, relativePath);
      requireText(source, `viewBox="0 0 ${size} ${size}"`, relativePath);
      requireText(source, 'xmlns="http://www.w3.org/2000/svg"', relativePath);
      if (identity !== undefined) requireText(source, identity, relativePath);
      rejectText(
        source,
        /<(?:script|foreignObject)\b|\s(?:on[a-z][a-z0-9_-]*|href|xlink:href)\s*=|\bjavascript\s*:/iu,
        relativePath,
      );
      return relativePath;
    }),
  );

  for (const required of [
    "useSyncExternalStore",
    "aria-current",
    "Skip to main content",
    "data-route-heading",
    "Capability catalogs",
    "New project",
    "Project creation unlocks with catalog setup.",
  ]) {
    requireText(application, required, "application.tsx");
  }
  for (const required of [
    'kind: "projects"',
    'kind: "project"',
    'kind: "not-found"',
    '"popstate"',
    ".pushState",
    ".replaceState",
    "destination.origin !== window.location.origin",
  ]) {
    requireText(navigation, required, "project-navigation.ts");
  }
  requireText(
    navigation,
    "return `${window.location.pathname}${window.location.search}${window.location.hash}`;",
    "project-navigation.ts",
  );
  requireText(
    navigation,
    'window.location.pathname !== "/" ||\n    window.location.search !== "" ||\n    window.location.hash !== ""',
    "project-navigation.ts",
  );
  for (const required of ['id: "account-app"', 'id: "checkout-pilot"', "Object.freeze("]) {
    requireText(data, required, "project-data.ts");
  }
  for (const required of ["normalizeInitialDesenAppLocation", "StrictMode", '"pagehide"']) {
    requireText(main, required, "main.tsx");
  }
  for (const required of ["--desen-app-", ":focus-visible", "prefers-reduced-motion"]) {
    requireText(globalStyles, required, "styles.css");
  }
  for (const required of ["@media", "var(--desen-app-", ".visuallyHidden"]) {
    requireText(moduleStyles, required, "application.module.css");
  }
  for (const required of ["M09-T06", "History API"]) {
    requireText(readme, required, "apps/desen-app/README.md");
  }

  for (const [relativePath, source] of [
    ["project-navigation.ts", navigation],
    ["project-data.ts", data],
    ["main.tsx", main],
  ]) {
    rejectText(
      source,
      /(?:dangerouslySetInnerHTML|\beval\s*\(|\bnew\s+Function\s*\()/u,
      relativePath,
    );
    rejectText(source, /from\s+["']@desen\//u, relativePath);
  }
  rejectText(
    application,
    /(?:createDesenEditor|useRuntimeReactSurface|activateRevision)\s*\(|(?<!\.)\bpublish\s*\(/u,
    "application.tsx",
  );

  return deepFreeze({
    routes: ["/projects", "/projects/:projectId", "/projects/:projectId/surfaces/:surfaceId"],
    navigationAuthority: "SAME_ORIGIN_HISTORY_API_WITH_POPSTATE_AND_APP_EVENT",
    unknownRoutePolicy: "EXPLICIT_NOT_FOUND",
    fixtureProjects: ["account-app", "checkout-pilot"],
    search: "INERT_FIXED_FIXTURE_FILTER",
    responsiveCss: true,
    reducedMotionHonored: true,
    keyboardFocusVisible: true,
    routeHeadingFocus: true,
    landmarksAndCurrentPageSemantics: true,
    disabledFutureActionsExplained: true,
    appTokenPrefix: "--desen-app-",
    localSvgAssets: svgAssets,
  });
}

function countRegisteredTests(source) {
  return [...source.matchAll(/\b(?:it|test)\s*\(\s*["'`]/gu)].length;
}

function verifyTests(files) {
  const registrations = {};
  for (const relativePath of TEST_PATHS) {
    const source = decodeUtf8(files.get(relativePath), relativePath);
    const count = countRegisteredTests(source);
    if (count < 2) {
      fail("TEST_AUTHORITY_DRIFT", `${relativePath} must retain positive and negative cases.`);
    }
    registrations[path.basename(relativePath)] = count;
  }
  const navigation = decodeUtf8(
    files.get("apps/desen-app/test/project-navigation.test.ts"),
    "project-navigation.test.ts",
  );
  const application = decodeUtf8(
    files.get("apps/desen-app/test/application.test.tsx"),
    "application.test.tsx",
  );
  const mainLifecycle = decodeUtf8(
    files.get("apps/desen-app/test/main-lifecycle.test.tsx"),
    "main-lifecycle.test.tsx",
  );
  for (const required of ["not-found", "cross-origin", "popstate", "pushState"]) {
    requireText(navigation, required, "project-navigation.test.ts");
  }
  for (const required of ["Search projects", "New project", "aria-current", "not found"]) {
    requireText(application, required, "application.test.tsx");
  }
  for (const required of ["normalizes the root", "BFCache", "root container is absent"]) {
    requireText(mainLifecycle, required, "main-lifecycle.test.tsx");
  }
  if (
    registrations["project-navigation.test.ts"] < 8 ||
    exactTextCount(navigation, "it.each(") !== 2 ||
    registrations["application.test.tsx"] < 6 ||
    exactTextCount(application, "it.each(") < 1 ||
    registrations["main-lifecycle.test.tsx"] < 3
  ) {
    fail("TEST_AUTHORITY_DRIFT", "The retained T01 focused Vitest coverage drifted.");
  }
  return deepFreeze({
    files: TEST_PATHS.length,
    registrations,
    historicalRuntimeCases: 43,
    successorRegistrationsAllowed: true,
    positiveAndNegativeCoverage: true,
    executionAuthority: "ROOT_SCRIPT_REQUIRES_SUCCESSFUL_FOCUSED_VITEST_RUN",
  });
}

function resolveTrackedSourceImport(importerPath, specifier) {
  if (
    specifier.includes("\\") ||
    specifier.includes("?") ||
    specifier.includes("#") ||
    !/^(?:\.\.?\/)[a-zA-Z0-9._/-]+$/u.test(specifier)
  ) {
    fail("IMPORT_BOUNDARY_DRIFT", `${importerPath} has an invalid relative import.`, {
      specifier,
    });
  }
  const resolved = path.posix.normalize(
    path.posix.join(path.posix.dirname(importerPath), specifier),
  );
  const extension = path.posix.extname(resolved);
  const candidates =
    extension === ".js"
      ? [`${resolved.slice(0, -3)}.ts`, `${resolved.slice(0, -3)}.tsx`]
      : [".ts", ".tsx", ".css", ".svg", ".json"].includes(extension)
        ? [resolved]
        : [];
  const trackedTargets = candidates.filter(
    (candidate) =>
      SOURCE_PATHS.includes(candidate) ||
      SVG_ASSET_PATHS.includes(candidate) ||
      ADDITIVE_SUCCESSOR_SOURCE_PATHS.includes(candidate) ||
      T12_SUCCESSOR_RECEIPT_PATHS.includes(candidate) ||
      T13_SUCCESSOR_RECEIPT_PATHS.includes(candidate) ||
      T14_SUCCESSOR_RECEIPT_PATHS.includes(candidate) ||
      candidate === OFFICIAL_SOURCE_PATH ||
      candidate === OFFICIAL_BUNDLE_PATH,
  );
  if (trackedTargets.length !== 1) {
    fail(
      "IMPORT_BOUNDARY_DRIFT",
      `${importerPath} imports a relative module outside the exact tracked source authority.`,
      { specifier },
    );
  }
  return trackedTargets[0];
}

function inspectImports(files) {
  const imports = [];
  const exactSuccessorPackageImports = new Map([
    [
      AUTHORING_SOURCE_PATH,
      new Set([
        "@desen/catalog-sdk",
        "@desen/editor-core",
        "@desen/reference-catalog-web/catalog.json",
        "@desen/validator",
      ]),
    ],
    [
      ADAPTER_CANVAS_SOURCE_PATH,
      new Set([
        "@desen/editor-core",
        "@desen/reference-catalog-web/catalog.json",
        "@desen/reference-catalog-web/react-adapters",
        "@desen/reference-catalog-web/tokens",
        "@desen/runtime-core",
        "@desen/runtime-react",
      ]),
    ],
    [
      "apps/desen-app/src/authoring-diagnostics.ts",
      new Set(["@desen/editor-core", "@desen/protocol", "@desen/runtime-react"]),
    ],
    ["apps/desen-app/src/diagnostics-panel.tsx", new Set()],
    [AUTHORING_SELECTION_SOURCE_PATH, new Set(["@desen/runtime-react"])],
    [
      AUTHORING_INSPECTOR_SOURCE_PATH,
      new Set(["@desen/catalog-sdk", "@desen/editor-core", "@desen/protocol"]),
    ],
    [
      AUTHORING_PREVIEW_SOURCE_PATH,
      new Set([
        "@desen/editor-core",
        "@desen/publisher",
        "@desen/reference-catalog-web/catalog.json",
      ]),
    ],
    [INSPECTOR_PANEL_SOURCE_PATH, new Set(["@desen/catalog-sdk"])],
    [
      AUTHORING_SLOT_SOURCE_PATH,
      new Set(["@desen/catalog-sdk", "@desen/editor-core", "@desen/protocol"]),
    ],
    [AUTHORING_STATE_SOURCE_PATH, new Set(["@desen/catalog-sdk", "@desen/editor-core"])],
    [STATE_PANEL_SOURCE_PATH, new Set(["@desen/catalog-sdk"])],
    [
      AUTHORING_EVENT_ACTION_SOURCE_PATH,
      new Set(["@desen/catalog-sdk", "@desen/editor-core", "@desen/protocol"]),
    ],
    [EVENT_ACTION_PANEL_SOURCE_PATH, new Set(["@desen/catalog-sdk"])],
    [
      AUTHORING_FIXTURES_SOURCE_PATH,
      new Set(["@desen/reference-catalog-web/operations", "@desen/runtime-core", "@desen/testkit"]),
    ],
    [AUTHORING_SCENARIOS_SOURCE_PATH, new Set(["@desen/catalog-sdk", "@desen/editor-core"])],
    [PREVIEW_CONTROLS_SOURCE_PATH, new Set()],
    [PREVIEW_FIDELITY_SOURCE_PATH, new Set()],
    [
      "apps/desen-app/src/authoring-persistence.ts",
      new Set(["@desen/editor-core", "@desen/protocol"]),
    ],
    ["apps/desen-app/src/persistence-controls.tsx", new Set()],
    [
      "apps/desen-app/src/authoring-publication.ts",
      new Set(["@desen/editor-core", "@desen/protocol"]),
    ],
    ["apps/desen-app/src/publication-controls.tsx", new Set()],
    ["apps/desen-app/src/project-navigation.ts", new Set()],
    [
      STRUCTURED_JSON_SOURCE_PATH,
      new Set(["@desen/catalog-sdk", "@desen/protocol", "@desen/publisher"]),
    ],
    [
      APPLICATION_SOURCE_PATH,
      new Set([
        "@desen/editor-core",
        "@desen/protocol",
        "@desen/reference-catalog-web/catalog.json",
        "@desen/runtime-core",
      ]),
    ],
  ]);
  const seenSuccessorPackageImports = new Map(
    [...exactSuccessorPackageImports].map(([relativePath]) => [relativePath, new Set()]),
  );
  let publicDiagnosticIndexTypeOnlyImports = 0;
  for (const relativePath of CURRENT_TYPESCRIPT_SOURCE_PATHS) {
    const source = decodeUtf8(files.get(relativePath), relativePath);
    const sourceFile = ts.createSourceFile(
      relativePath,
      source,
      ts.ScriptTarget.Latest,
      true,
      relativePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    if (sourceFile.parseDiagnostics.length > 0) {
      fail("IMPORT_BOUNDARY_DRIFT", `${relativePath} has TypeScript parse diagnostics.`, {
        diagnosticCodes: sourceFile.parseDiagnostics.map(({ code }) => code),
      });
    }
    const recordSpecifier = (moduleSpecifier, kind) => {
      if (!ts.isStringLiteralLike(moduleSpecifier)) {
        fail("IMPORT_BOUNDARY_DRIFT", `${relativePath} has a non-literal module specifier.`);
      }
      const specifier = moduleSpecifier.text;
      if (specifier.startsWith(".")) {
        imports.push({
          kind,
          path: relativePath,
          specifier,
          resolvedPath: resolveTrackedSourceImport(relativePath, specifier),
        });
        return;
      }
      const admittedSuccessorImports = exactSuccessorPackageImports.get(relativePath);
      if (
        specifier !== "react" &&
        specifier !== "react-dom/client" &&
        !admittedSuccessorImports?.has(specifier)
      ) {
        fail("IMPORT_BOUNDARY_DRIFT", `${relativePath} imports an unreviewed package.`, {
          specifier,
        });
      }
      if (admittedSuccessorImports?.has(specifier)) {
        seenSuccessorPackageImports.get(relativePath).add(specifier);
      }
      imports.push({ kind, path: relativePath, specifier, resolvedPath: null });
    };
    const visit = (node) => {
      if (ts.isImportDeclaration(node)) {
        recordSpecifier(node.moduleSpecifier, "import");
        if (
          relativePath === AUTHORING_SELECTION_SOURCE_PATH &&
          ts.isStringLiteralLike(node.moduleSpecifier) &&
          node.moduleSpecifier.text === "@desen/runtime-react"
        ) {
          const clause = node.importClause;
          const bindings = clause?.namedBindings;
          if (
            clause?.isTypeOnly !== true ||
            clause.name !== undefined ||
            bindings === undefined ||
            !ts.isNamedImports(bindings) ||
            bindings.elements.length !== 1 ||
            bindings.elements[0].propertyName !== undefined ||
            bindings.elements[0].name.text !== "RuntimeReactDiagnosticIndex"
          ) {
            fail(
              "IMPORT_BOUNDARY_DRIFT",
              "M09-T04 selection may import only the public diagnostic-index type.",
            );
          }
          publicDiagnosticIndexTypeOnlyImports += 1;
        }
      } else if (ts.isExportDeclaration(node) && node.moduleSpecifier !== undefined) {
        recordSpecifier(node.moduleSpecifier, "re-export");
      } else if (ts.isImportEqualsDeclaration(node) || ts.isImportTypeNode(node)) {
        fail("IMPORT_BOUNDARY_DRIFT", `${relativePath} contains an indirect import declaration.`);
      } else if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) && node.expression.text === "require"))
      ) {
        fail("IMPORT_BOUNDARY_DRIFT", `${relativePath} contains an executable dynamic import.`);
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  for (const [relativePath, expected] of exactSuccessorPackageImports) {
    const seen = seenSuccessorPackageImports.get(relativePath);
    if (seen.size !== expected.size || [...expected].some((specifier) => !seen.has(specifier))) {
      fail(
        "IMPORT_BOUNDARY_DRIFT",
        `${relativePath} lost its exact reviewed successor package-import surface.`,
      );
    }
  }
  if (publicDiagnosticIndexTypeOnlyImports !== 1) {
    fail(
      "IMPORT_BOUNDARY_DRIFT",
      "M09-T04 must retain one type-only RuntimeReactDiagnosticIndex import.",
    );
  }
  const authoringImports = imports.filter(
    ({ path: importer }) => importer === AUTHORING_SOURCE_PATH,
  );
  if (
    authoringImports.filter(({ resolvedPath }) => resolvedPath === OFFICIAL_SOURCE_PATH).length !==
    1
  ) {
    fail("IMPORT_BOUNDARY_DRIFT", "M09-T02 must retain the one exact official Source import.");
  }
  const adapterImports = imports.filter(
    ({ path: importer }) => importer === ADAPTER_CANVAS_SOURCE_PATH,
  );
  if (
    adapterImports.filter(({ resolvedPath }) => resolvedPath === OFFICIAL_BUNDLE_PATH).length !== 1
  ) {
    fail("IMPORT_BOUNDARY_DRIFT", "M09-T03 must retain the one exact official Bundle import.");
  }
  const adapterCanvas = decodeUtf8(
    files.get(ADAPTER_CANVAS_SOURCE_PATH),
    ADAPTER_CANVAS_SOURCE_PATH,
  );
  for (const required of [
    "REFERENCE_WEB_REACT_ADAPTER_REGISTRY_INPUT",
    "REFERENCE_WEB_TOKEN_CSS_PROPERTIES",
    "createRuntimeHostPorts",
    "mountRuntimeHeadlessSession",
    "disposeRuntimeHeadlessSession",
    "createRuntimeReactAdapterRegistry",
    "renderRuntimeReactSurface",
    "useRuntimeReactSurface",
    "RuntimeReactSurfaceBoundary",
    "createRuntimeReactAdapterRegistry(\n  REFERENCE_WEB_REACT_ADAPTER_REGISTRY_INPUT,\n)",
  ]) {
    if (!adapterCanvas.includes(required)) {
      fail("IMPORT_BOUNDARY_DRIFT", "M09-T03 lost its exact public adapter/runtime edge.", {
        required,
      });
    }
  }
  if (
    /<(?:Stack|Text|TextField|Button|Alert|canvas|Inspector|RuntimeCanvas)\b/u.test(
      adapterCanvas,
    ) ||
    /(?:dangerouslySetInnerHTML|\bcreateElement\s*\(|\beval\s*\(|\bnew\s+Function\s*\()/u.test(
      adapterCanvas,
    ) ||
    /\b(?:document|globalThis|navigator|self|window)\b/u.test(adapterCanvas) ||
    /\b(?:insertDesenEditor|moveDesenEditor|deleteDesenEditor|saveDesen|publish(?:Revision|Source)?|activateRevision)\s*\(/u.test(
      adapterCanvas,
    ) ||
    /\b(?:draggable|onDrag(?:End|Enter|Leave|Over|Start)?|onDrop)\s*=/u.test(adapterCanvas)
  ) {
    fail(
      "SCOPE_BOUNDARY_DRIFT",
      "M09-T03 gained a handwritten tree, private DOM, mutation, or publication bypass.",
    );
  }
  const authoringSelection = decodeUtf8(
    files.get(AUTHORING_SELECTION_SOURCE_PATH),
    AUTHORING_SELECTION_SOURCE_PATH,
  );
  if (
    /\b(?:document|globalThis|navigator|self|window)\b/u.test(authoringSelection) ||
    /\b(?:getBoundingClientRect|querySelector(?:All)?|closest|matches|elementFromPoint|elementsFromPoint|MutationObserver|ResizeObserver)\b/u.test(
      authoringSelection,
    ) ||
    /\b(?:cloneElement|createElement)\s*\(|React\.Children\b|\.props\b/u.test(authoringSelection) ||
    /\b(?:insertDesenEditor|moveDesenEditor|deleteDesenEditor|saveDesen|publish(?:Revision|Source)?|activateRevision)\s*\(/u.test(
      authoringSelection,
    )
  ) {
    fail(
      "SCOPE_BOUNDARY_DRIFT",
      "M09-T04 selection gained private DOM, React-tree, mutation, or publication authority.",
    );
  }
  const indexHtml = decodeUtf8(files.get("apps/desen-app/index.html"), "index.html");
  const expectedModuleEntry = '<script type="module" src="/src/main.tsx"></script>';
  const scriptOpenings = [...indexHtml.matchAll(/<script\b/giu)].length;
  const scriptClosings = [...indexHtml.matchAll(/<\/script\s*>/giu)].length;
  if (
    exactTextCount(indexHtml, expectedModuleEntry) !== 1 ||
    scriptOpenings !== 1 ||
    scriptClosings !== 1 ||
    /\s(?:on[a-z][a-z0-9_-]*|srcdoc)\s*=/iu.test(indexHtml) ||
    /\bjavascript\s*:/iu.test(indexHtml) ||
    /<(?:iframe|object|embed)\b/iu.test(indexHtml)
  ) {
    fail(
      "IMPORT_BOUNDARY_DRIFT",
      "index.html must retain one exact module entry and no other executable HTML authority.",
    );
  }
  return deepFreeze({
    method: "TYPESCRIPT_AST_MODULE_SPECIFIER_INVENTORY_WITH_TRACKED_RELATIVE_RESOLUTION",
    imports,
    htmlModuleEntry: "/src/main.tsx",
    desenPackageImports: imports.filter(({ specifier }) => specifier.startsWith("@desen/")).length,
    exactSuccessorPackageImports: Object.fromEntries(
      [...exactSuccessorPackageImports].map(([relativePath, specifiers]) => [
        relativePath,
        [...specifiers],
      ]),
    ),
    exactReferenceAdapterRegistry: true,
    applicationReactDomImports: 0,
    publicDiagnosticIndexTypeOnlyImports,
    handwrittenManagedTreeElements: 0,
    privateDomAccesses: 0,
    unreviewedMutationOrPublicationCalls: 0,
    publicEditorCoreAndPublisherSuccessorEdges: true,
    arbitraryExecutableImports: 0,
    arbitraryExecutableHtmlEntries: 0,
  });
}

async function readTrackedFiles(options) {
  const files = new Map();
  for (const relativePath of CURRENT_COMPATIBILITY_PATHS) {
    const override = options.fileOverrides.get(relativePath);
    const live = await readRegularAuthority(
      path.join(options.workspaceRoot, relativePath),
      relativePath,
    );
    if (
      override !== undefined &&
      SELF_RESEALED_PATHS.includes(relativePath) &&
      !isDeepStrictEqual(override, live)
    ) {
      fail("BOUNDARY_DRIFT", `${relativePath} cannot be substituted by a caller.`);
    }
    files.set(relativePath, override ?? live);
  }
  return files;
}

async function authenticateFrozenArtifact(workspaceRoot) {
  const artifactBytes = await readRegularAuthority(
    path.join(workspaceRoot, ARTIFACT_PATH),
    "frozen M09-T01 proof artifact",
  );
  if (
    artifactBytes.byteLength !== FROZEN_ARTIFACT_PIN.bytes ||
    sha256(artifactBytes) !== FROZEN_ARTIFACT_PIN.sha256
  ) {
    fail("ARTIFACT_DRIFT", "The frozen M09-T01 artifact bytes differ from their exact receipt.");
  }
  const artifact = parseJson(artifactBytes, "frozen M09-T01 proof artifact");
  const trackedReceipts = artifact?.boundary?.trackedReceipts;
  if (
    artifact?.schemaVersion !== 1 ||
    artifact?.proofId !== "desen-app-shell-navigation" ||
    artifact?.profile !== "desen.app.shell-navigation-proof.v1" ||
    artifact?.task !== "M09-T01" ||
    artifact?.result !== "PASS" ||
    artifact?.claim?.taskStatus !== "DONE" ||
    artifact?.claim?.prerequisiteGate !== "G08" ||
    artifact?.claim?.prerequisiteStatus !== "DONE" ||
    artifact?.claim?.shellImplemented !== true ||
    artifact?.claim?.projectNavigationImplemented !== true ||
    artifact?.claim?.directUrlNavigationImplemented !== true ||
    artifact?.claim?.unknownRoutesFailClosed !== true ||
    artifact?.boundary?.trackedFiles !== TRACKED_PATHS.length ||
    !Array.isArray(trackedReceipts) ||
    trackedReceipts.length !== TRACKED_PATHS.length ||
    !isDeepStrictEqual(
      trackedReceipts.map((candidate) => candidate?.path),
      TRACKED_PATHS,
    ) ||
    trackedReceipts.some(
      (candidate) =>
        candidate === null ||
        typeof candidate !== "object" ||
        !Number.isSafeInteger(candidate.bytes) ||
        candidate.bytes < 0 ||
        typeof candidate.sha256 !== "string" ||
        !/^[0-9a-f]{64}$/u.test(candidate.sha256),
    ) ||
    !isDeepStrictEqual(
      artifact?.evidence?.rootTestNames,
      DESEN_APP_SHELL_NAVIGATION_ROOT_TEST_NAMES,
    ) ||
    artifact?.evidence?.tests?.totalRuntimeCases !== 43 ||
    artifact?.nonclaims?.[0] !== "No catalog-driven component panel or layer tree."
  ) {
    fail("ARTIFACT_DRIFT", "The frozen M09-T01 artifact identity or retained claim drifted.");
  }
  return deepFreeze({
    artifact,
    artifactBytes: Buffer.from(artifactBytes),
    artifactSha256: FROZEN_ARTIFACT_PIN.sha256,
  });
}

function assertRetainedHistoricalReceipts(frozenArtifact, files) {
  const taskTimeReceipts = new Map(
    frozenArtifact.boundary.trackedReceipts.map((candidate) => [candidate.path, candidate]),
  );
  for (const relativePath of RETAINED_HISTORICAL_PATHS) {
    const authority = taskTimeReceipts.get(relativePath);
    const bytes = files.get(relativePath);
    if (
      authority === undefined ||
      bytes === undefined ||
      authority.bytes !== bytes.byteLength ||
      authority.sha256 !== sha256(bytes)
    ) {
      fail("BOUNDARY_DRIFT", `A retained M09-T01 task-time receipt drifted: ${relativePath}.`);
    }
  }
}

function authenticateNamedSlotArtifact(bytes) {
  const pin = NAMED_SLOT_ARTIFACT_PIN;
  if (bytes.byteLength !== pin.bytes || sha256(bytes) !== pin.sha256) {
    fail("BOUNDARY_DRIFT", "The exact M09-T07 named-slot artifact receipt drifted.");
  }
  const artifact = parseJson(bytes, NAMED_SLOT_ARTIFACT_PATH);
  if (
    artifact.task !== pin.task ||
    artifact.proofId !== pin.proofId ||
    artifact.profile !== pin.profile ||
    artifact.result !== pin.result ||
    artifact.claim?.completeCatalogDeclaredSlotProjection !== true ||
    artifact.claim?.publicStableIdInsert !== true ||
    artifact.claim?.publicCrossSlotMove !== true ||
    artifact.claim?.publicSameSlotReorder !== true ||
    artifact.claim?.nodeDeletionPreflight !== true ||
    artifact.claim?.deletionPreflightRunsPublicMutationAndValidation !== true ||
    artifact.claim?.publicNestedSubtreeDelete !== true ||
    artifact.claim?.rootDeletionDisabled !== true ||
    artifact.claim?.sourceMinimumDeletionDisabled !== true ||
    artifact.claim?.behaviorOwnedDeletePreservesEmptySlot !== true ||
    artifact.claim?.exactOwnDataRouteSelectionAndEditCapture !== true ||
    artifact.claim?.exactOwnDataDeletionSelectionCapture !== true ||
    artifact.claim?.continuousCompleteSourceRevalidation !== true ||
    artifact.claim?.failedDeletionPreservesCurrentDocument !== true ||
    artifact.claim?.sourceAndPreviewCommitAtomically !== true ||
    artifact.claim?.deletionSourceAndPreviewCommitAtomically !== true ||
    artifact.claim?.deletionFocusManaged !== true ||
    artifact.claim?.browserDataTransferReadsZero !== true ||
    artifact.claim?.expandedDropReadyBoundaries !== true ||
    artifact.claim?.stableNestedDragHover !== true ||
    artifact.claim?.explicitComponentDropTargetGuide !== true ||
    artifact.claim?.keyboardPlacementControl !== true ||
    artifact.claim?.insertionAdmissionCachedPerModelAndExactTarget !== true ||
    artifact.claim?.placementAdmissionCachedPerModelAndExactTarget !== true ||
    artifact.claim?.cachedPlacementBaseMaterializesBoundaryFinalIndex !== true ||
    artifact.claim?.componentPaletteRenderLimit !== 24 ||
    artifact.claim?.activeTabOnlyAuthoringWork !== true ||
    artifact.claim?.slotChromeOutsideManagedCapabilitySubtree !== true
  ) {
    fail("BOUNDARY_DRIFT", "The M09-T07 named-slot artifact identity or claims drifted.");
  }
  return pin;
}

function authenticateSourcePersistenceSuccessor(files) {
  const pin = Object.freeze({
    task: "M09-T12",
    proofId: "desen-app-source-persistence",
    profile: "desen.app.source-persistence-proof.v1",
    result: "PASS",
    path: SOURCE_PERSISTENCE_ARTIFACT_PATH,
    bytes: 27_053,
    sha256: "717d0ddada008edb34909d5defcc4c28e95b36f6dfc0b1abb4d09d9775a6b734",
  });
  const artifactBytes = files.get(SOURCE_PERSISTENCE_ARTIFACT_PATH);
  if (
    artifactBytes?.byteLength !== pin.bytes ||
    sha256(artifactBytes ?? Buffer.alloc(0)) !== pin.sha256
  ) {
    fail("SUCCESSOR_POLICY_VIOLATION", "The exact M09-T12 source-persistence artifact drifted.");
  }
  const artifact = parseJson(artifactBytes, SOURCE_PERSISTENCE_ARTIFACT_PATH);
  const trackedReceipts = artifact.boundary?.trackedReceipts;
  const receiptPaths = Array.isArray(trackedReceipts)
    ? trackedReceipts.map((candidate) => candidate?.path)
    : [];
  const persistenceCommand =
    "vitest run test/authoring-persistence.test.ts test/persistence-controls.test.tsx test/persistence-application.test.tsx test/project-navigation.test.ts test/application.test.tsx";
  const appPackage = parseJson(
    files.get("apps/desen-app/package.json"),
    "apps/desen-app/package.json",
  );
  const persistenceControlsSource = decodeUtf8(
    files.get("apps/desen-app/src/persistence-controls.tsx"),
    "apps/desen-app/src/persistence-controls.tsx",
  );
  if (
    artifact.schemaVersion !== 1 ||
    artifact.task !== pin.task ||
    artifact.proofId !== pin.proofId ||
    artifact.profile !== pin.profile ||
    artifact.result !== pin.result ||
    artifact.claim?.taskStatus !== "DONE" ||
    artifact.claim?.publicEditorCorePersistencePort !== true ||
    artifact.claim?.exactProjectScopedSourceKey !== "account-app-source" ||
    artifact.claim?.authoredSourceOnly !== true ||
    artifact.claim?.sourceKeyIndependentOfDocumentId !== true ||
    artifact.claim?.awaitedSettlementsCapturedAsExactOwnEnumerableData !== true ||
    artifact.claim?.settlementAccessorInvocation !== false ||
    artifact.claim?.validOptionalDiagnosticDataCopiedAndFrozen !== true ||
    artifact.claim?.casGenerationRelationshipsValidated !== true ||
    artifact.claim?.openedDocumentReauthorized !== true ||
    artifact.claim?.failedOrRejectedOpenPreservesDraft !== true ||
    artifact.claim?.malformedOpenRetryableAndDraftPreserved !== true ||
    artifact.claim?.generationExhaustionRequiresReopen !== true ||
    artifact.claim?.automaticRetryOrMerge !== false ||
    artifact.claim?.unexpectedDispatchedSaveIndeterminate !== true ||
    artifact.claim?.malformedSaveIndeterminateAndReopenRequired !== true ||
    artifact.claim?.staleOpenCannotReplaceEditedSession !== true ||
    artifact.claim?.staleLifetimeSettlementIgnored !== true ||
    artifact.claim?.postReflectionAndAdmissionAuthorityRechecked !== true ||
    artifact.claim?.reentrantSettlementCannotPublishRevokedState !== true ||
    artifact.claim?.dirtyOpenRequiresExplicitConfirmation !== true ||
    artifact.claim?.designModeOnlyControls !== true ||
    artifact.claim?.visibleGenerationDirtyAndReopenState !== true ||
    artifact.claim?.completeAuthoredSourceCanonicalDirtyComparison !== true ||
    artifact.claim?.identityOrVersionDirtyAuthority !== false ||
    artifact.claim?.sameCanonicalReplacementRemainsClean !== true ||
    artifact.claim?.canonicalRevertReturnsClean !== true ||
    artifact.claim?.successfulOpenOrSaveEstablishesCanonicalBaseline !== true ||
    artifact.claim?.newerEditRemainsDirtyAfterOlderSave !== true ||
    artifact.claim?.centralizedAuthoringSessionCommit !== true ||
    artifact.claim?.noPortCanonicalBaselineAndCurrentTracked !== true ||
    artifact.claim?.noPortDirtyProjectionRerenderSafe !== true ||
    artifact.claim?.cleanNoPortLabelAccurate !== true ||
    artifact.claim?.pristineNoPortNavigationAdmitted !== true ||
    artifact.claim?.editedNoPortDraftNavigationAndPageExitGuarded !== true ||
    artifact.claim?.openAdmissionAtomic !== true ||
    artifact.claim?.createUpdateUnchangedGenerationCas !== true ||
    artifact.claim?.conflictOrIndeterminateRequiresReopen !== true ||
    artifact.claim?.navigationAndPageExitGuarded !== true ||
    artifact.claim?.scenarioPreviewPersisted !== false ||
    artifact.claim?.runtimeInputOrSecretPersisted !== false ||
    artifact.claim?.concretePersistenceAdapterClaimed !== false ||
    !persistenceControlsSource.includes('return "Local draft unchanged";') ||
    artifact.tests?.focusedTestCases !== 142 ||
    artifact.tests?.fullAppTestFiles !== 22 ||
    artifact.tests?.fullAppTestCases !== 324 ||
    artifact.boundary?.trackedFiles !== 35 ||
    artifact.boundary?.parentArtifacts !== 3 ||
    artifact.boundary?.focusedAppTestCases !== 142 ||
    artifact.boundary?.fullAppTestFiles !== 22 ||
    artifact.boundary?.fullAppTestCases !== 324 ||
    trackedReceipts?.length !== 35 ||
    !isDeepStrictEqual(
      receiptPaths,
      [...receiptPaths].sort((left, right) => left.localeCompare(right, "en-US")),
    ) ||
    appPackage.scripts?.["test:persistence"] !== persistenceCommand
  ) {
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      "The M09-T12 source-persistence identity or claims drifted.",
    );
  }
  const receiptMap = new Map(trackedReceipts.map((candidate) => [candidate.path, candidate]));
  for (const relativePath of T12_SUCCESSOR_RECEIPT_PATHS) {
    if (
      T13_SUCCESSOR_RECEIPT_PATHS.includes(relativePath) ||
      T14_SUCCESSOR_RECEIPT_PATHS.includes(relativePath)
    ) {
      continue;
    }
    const receipt = receiptMap.get(relativePath);
    const bytes = files.get(relativePath);
    if (
      receipt === undefined ||
      bytes === undefined ||
      receipt.bytes !== bytes.byteLength ||
      receipt.sha256 !== sha256(bytes)
    ) {
      fail("SUCCESSOR_POLICY_VIOLATION", `The live M09-T12 receipt drifted: ${relativePath}.`);
    }
  }
  return deepFreeze({
    task: pin.task,
    artifact: pin,
    focusedTestCases: 142,
    fullAppTestFiles: 22,
    fullAppTestCases: 324,
    exactProjectScopedSourceKey: "account-app-source",
    publicEditorCorePersistencePort: true,
    authoredSourceOnly: true,
    sourceKeyIndependentOfDocumentId: true,
    awaitedSettlementsCapturedAsExactOwnEnumerableData: true,
    settlementAccessorInvocation: false,
    validOptionalDiagnosticDataCopiedAndFrozen: true,
    casGenerationRelationshipsValidated: true,
    openedDocumentReauthorized: true,
    failedOrRejectedOpenPreservesDraft: true,
    malformedOpenRetryableAndDraftPreserved: true,
    generationExhaustionRequiresReopen: true,
    automaticRetryOrMerge: false,
    unexpectedDispatchedSaveIndeterminate: true,
    malformedSaveIndeterminateAndReopenRequired: true,
    staleOpenCannotReplaceEditedSession: true,
    staleLifetimeSettlementIgnored: true,
    postReflectionAndAdmissionAuthorityRechecked: true,
    reentrantSettlementCannotPublishRevokedState: true,
    dirtyOpenRequiresExplicitConfirmation: true,
    designModeOnlyControls: true,
    visibleGenerationDirtyAndReopenState: true,
    completeAuthoredSourceCanonicalDirtyComparison: true,
    identityOrVersionDirtyAuthority: false,
    sameCanonicalReplacementRemainsClean: true,
    canonicalRevertReturnsClean: true,
    successfulOpenOrSaveEstablishesCanonicalBaseline: true,
    newerEditRemainsDirtyAfterOlderSave: true,
    centralizedAuthoringSessionCommit: true,
    noPortCanonicalBaselineAndCurrentTracked: true,
    noPortDirtyProjectionRerenderSafe: true,
    cleanNoPortLabelAccurate: true,
    cleanNoPortStatusText: "Local draft unchanged",
    pristineNoPortNavigationAdmitted: true,
    editedNoPortDraftNavigationAndPageExitGuarded: true,
    openAdmissionAtomic: true,
    createUpdateUnchangedGenerationCas: true,
    conflictOrIndeterminateRequiresReopen: true,
    navigationAndPageExitGuarded: true,
    scenarioPreviewPersisted: false,
    runtimeInputOrSecretPersisted: false,
    concretePersistenceAdapterClaimed: false,
    persistenceCommand,
  });
}

function authenticateFixturesScenariosSuccessor(files) {
  const bytes = files.get(FIXTURES_SCENARIOS_ARTIFACT_PATH);
  const pin = FIXTURES_SCENARIOS_ARTIFACT_PIN;
  if (bytes.byteLength !== pin.bytes || sha256(bytes) !== pin.sha256) {
    fail("BOUNDARY_DRIFT", "The exact M09-T11 fixtures/scenarios artifact receipt drifted.");
  }
  const artifact = parseJson(bytes, FIXTURES_SCENARIOS_ARTIFACT_PATH);
  const parent = artifact.prerequisites?.[0];
  const trackedReceipts = artifact.boundary?.trackedReceipts;
  if (
    artifact?.schemaVersion !== 1 ||
    artifact.task !== pin.task ||
    artifact.proofId !== pin.proofId ||
    artifact.profile !== pin.profile ||
    artifact.result !== pin.result ||
    parent?.task !== "M09-T10" ||
    parent?.bytes !== 17_900 ||
    parent?.sha256 !== "bc5b7ffef0c39737882072f9340bcade86f084db8e7923fcb03aa7364d077334" ||
    artifact.claim?.taskStatus !== "DONE" ||
    artifact.claim?.scenarioSourceAndBundleEphemeral !== true ||
    artifact.claim?.authoredSourceAndPublishablePreviewUnchanged !== true ||
    artifact.claim?.publicSyntheticFixtureProjection !== true ||
    artifact.claim?.pendingStaticFixtureClaimed !== false ||
    artifact.claim?.pendingRuntimeLifecycleExercised !== true ||
    artifact.claim?.exactOperationAndPreviewContextAuthorization !== true ||
    artifact.claim?.operationInputOrPasswordRetained !== false ||
    artifact.claim?.stableAppOwnedOperationPort !== true ||
    artifact.claim?.cleanupSynchronouslyRevokesFixtureAdmission !== true ||
    artifact.claim?.pendingRevokedOnPreviewReplacement !== true ||
    !isDeepStrictEqual(artifact.claim?.visibleExecutionContexts, [
      "synthetic",
      "integration",
      "production",
    ]) ||
    artifact.claim?.visibleApproximateFidelityDifferences !== true ||
    artifact.claim?.s001Status !== "TESTED" ||
    artifact.claim?.pf028Status !== "CLOSED" ||
    artifact.tests?.focusedTestCases !== 86 ||
    artifact.tests?.testCaseCounts?.[ADAPTER_CANVAS_TEST_PATH] !== 10 ||
    artifact.tests?.testCaseCounts?.[APPLICATION_TEST_PATH] !== 40 ||
    !Array.isArray(trackedReceipts)
  ) {
    fail("BOUNDARY_DRIFT", "The exact M09-T11 artifact identity or claims drifted.");
  }
  const receiptMap = new Map(trackedReceipts.map((candidate) => [candidate?.path, candidate]));
  for (const relativePath of T11_LIVE_RECEIPT_PATHS) {
    if (
      T12_SUCCESSOR_RECEIPT_PATHS.includes(relativePath) ||
      T13_SUCCESSOR_RECEIPT_PATHS.includes(relativePath) ||
      T14_SUCCESSOR_RECEIPT_PATHS.includes(relativePath)
    ) {
      continue;
    }
    const authority = receiptMap.get(relativePath);
    const liveBytes = files.get(relativePath);
    if (
      authority === undefined ||
      liveBytes === undefined ||
      authority.bytes !== liveBytes.byteLength ||
      authority.sha256 !== sha256(liveBytes)
    ) {
      fail("BOUNDARY_DRIFT", `The live M09-T11 receipt drifted: ${relativePath}.`);
    }
  }
  return deepFreeze({
    task: pin.task,
    artifact: pin,
    exactDesignRunParent: true,
    scenariosEphemeral: true,
    pendingRuntimeLifecycleExercised: true,
    exactOperationAndPreviewContextAuthorization: true,
    operationInputOrPasswordRetained: false,
    stableAppOwnedOperationPort: true,
    fixtureAdmissionRevokedOnCleanupAndReplacement: true,
    visibleExecutionContexts: ["synthetic", "integration", "production"],
    visibleApproximateFidelityDifferences: true,
    focusedTestCases: 86,
    s001Status: "TESTED",
    pf028Status: "CLOSED",
  });
}

function authenticateNodeLinkedDiagnosticsSuccessor(files) {
  const pin = Object.freeze({
    task: "M09-T13",
    proofId: "desen-app-node-linked-diagnostics",
    profile: "desen.app.node-linked-diagnostics-proof.v1",
    result: "PASS",
    path: NODE_LINKED_DIAGNOSTICS_ARTIFACT_PATH,
    bytes: 29_208,
    sha256: "8ac4d81d9097e188860757c637673ff406ba9f82b8cd8f379f184ef85138e972",
  });
  const artifactBytes = files.get(NODE_LINKED_DIAGNOSTICS_ARTIFACT_PATH);
  if (
    artifactBytes?.byteLength !== pin.bytes ||
    sha256(artifactBytes ?? Buffer.alloc(0)) !== pin.sha256
  ) {
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      "The exact M09-T13 node-linked-diagnostics artifact drifted.",
    );
  }
  const artifact = parseJson(artifactBytes, NODE_LINKED_DIAGNOSTICS_ARTIFACT_PATH);
  const trackedReceipts = artifact.boundary?.trackedReceipts;
  const receiptPaths = Array.isArray(trackedReceipts)
    ? trackedReceipts.map((candidate) => candidate?.path)
    : [];
  const diagnosticsCommand =
    "vitest run test/authoring-diagnostics.test.ts test/diagnostics-panel.test.tsx test/authoring-inspector.test.ts test/authoring-state.test.ts test/authoring-event-actions.test.ts test/authoring-slots.test.ts test/adapter-canvas.test.tsx test/application.test.tsx test/persistence-application.test.tsx";
  const appPackage = parseJson(
    files.get("apps/desen-app/package.json"),
    "apps/desen-app/package.json",
  );
  if (
    artifact.schemaVersion !== 1 ||
    artifact.task !== pin.task ||
    artifact.proofId !== pin.proofId ||
    artifact.profile !== pin.profile ||
    artifact.result !== pin.result ||
    artifact.claim?.taskStatus !== "DONE" ||
    artifact.claim?.immutableRejectedCandidateReport !== true ||
    artifact.claim?.explicitContextIdentityMappingOnly !== true ||
    artifact.claim?.diagnosticCodeMessagePointerIdentityInference !== false ||
    artifact.claim?.duplicateOccurrenceOrderPreserved !== true ||
    artifact.claim?.unmappedDiagnosticsVisible !== true ||
    artifact.claim?.unmappedDiagnosticsSelectable !== false ||
    artifact.claim?.reportSnapshotDocumentFingerprintFenced !== true ||
    artifact.claim?.reportSnapshotCatalogFingerprintFenced !== true ||
    artifact.claim?.routeAndSurfaceFenced !== true ||
    artifact.claim?.runtimeKindMismatchFailsClosed !== true ||
    artifact.claim?.committedOwnerFingerprintFenced !== true ||
    artifact.claim?.snapshotBoundSelectionReadmitted !== true ||
    artifact.claim?.invalidPlaceholderAppOwned !== true ||
    artifact.claim?.invalidPlaceholderInsideManagedRuntimeSubtree !== false ||
    artifact.claim?.runModeDiagnosticsVisible !== false ||
    artifact.claim?.automaticFocusSteal !== false ||
    artifact.claim?.explicitSelectionFocusOnly !== true ||
    artifact.claim?.obligationsVisibleMetadataOnly !== true ||
    artifact.claim?.obligationsExecutable !== false ||
    artifact.claim?.rejectedDiagnosticsPersisted !== false ||
    artifact.claim?.rejectedDiagnosticsAffectDirtyState !== false ||
    artifact.claim?.rejectedDiagnosticsIncludedInSave !== false ||
    artifact.claim?.lastKnownGoodPreviewPreserved !== true ||
    artifact.claim?.p16Status !== "PROVEN" ||
    artifact.claim?.pf086Status !== "OPEN" ||
    artifact.tests?.focusedTestCases !== 161 ||
    artifact.tests?.fullAppTestFiles !== 24 ||
    artifact.tests?.fullAppTestCases !== 339 ||
    artifact.tests?.rootTestNames?.length !== 12 ||
    artifact.boundary?.trackedFiles !== 39 ||
    artifact.boundary?.parentArtifacts !== 11 ||
    artifact.boundary?.focusedAppTestCases !== 161 ||
    artifact.boundary?.fullAppTestFiles !== 24 ||
    artifact.boundary?.fullAppTestCases !== 339 ||
    trackedReceipts?.length !== 39 ||
    !isDeepStrictEqual(
      receiptPaths,
      [...receiptPaths].sort((left, right) => left.localeCompare(right, "en-US")),
    ) ||
    appPackage.scripts?.["test:diagnostics"] !== diagnosticsCommand
  ) {
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      "The M09-T13 node-linked-diagnostics identity or claims drifted.",
    );
  }
  const receiptMap = new Map(trackedReceipts.map((candidate) => [candidate.path, candidate]));
  for (const relativePath of T13_SUCCESSOR_RECEIPT_PATHS) {
    if (T14_SUCCESSOR_RECEIPT_PATHS.includes(relativePath)) continue;
    const receipt = receiptMap.get(relativePath);
    const bytes = files.get(relativePath);
    if (
      receipt === undefined ||
      bytes === undefined ||
      receipt.bytes !== bytes.byteLength ||
      receipt.sha256 !== sha256(bytes)
    ) {
      fail("SUCCESSOR_POLICY_VIOLATION", `The live M09-T13 receipt drifted: ${relativePath}.`);
    }
  }
  return deepFreeze({
    task: pin.task,
    artifact: pin,
    focusedTestCases: 161,
    fullAppTestFiles: 24,
    fullAppTestCases: 339,
    trackedFiles: 39,
    parentArtifacts: 11,
    rootTests: 12,
    explicitContextIdentityMappingOnly: true,
    diagnosticCodeMessagePointerIdentityInference: false,
    duplicateOccurrenceOrderPreserved: true,
    unmappedDiagnosticsSelectable: false,
    snapshotAndRouteFenced: true,
    runtimeKindMismatchFailsClosed: true,
    invalidPlaceholderInsideManagedRuntimeSubtree: false,
    runModeDiagnosticsVisible: false,
    automaticFocusSteal: false,
    obligationsExecutable: false,
    rejectedDiagnosticsPersisted: false,
    rejectedDiagnosticsAffectDirtyState: false,
    rejectedDiagnosticsIncludedInSave: false,
    p16Status: "PROVEN",
    pf086Status: "OPEN",
  });
}

function authenticatePublishActivationSuccessor(files) {
  const pin = Object.freeze({
    task: "M09-T14",
    gate: "G09",
    proofId: "desen-app-publish-activation",
    profile: "desen.app.publish-activation-proof.v1",
    result: "PASS",
    path: PUBLISH_ACTIVATION_ARTIFACT_PATH,
    bytes: 24_763,
    sha256: "6bd2db0ca490f1d0046f145da7c4b7e9b4b25ec0f8295a159529a0e66534b23b",
  });
  const artifactBytes = files.get(PUBLISH_ACTIVATION_ARTIFACT_PATH);
  if (
    artifactBytes?.byteLength !== pin.bytes ||
    sha256(artifactBytes ?? Buffer.alloc(0)) !== pin.sha256
  ) {
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      "The exact M09-T14/G09 publish-activation artifact drifted.",
    );
  }
  const artifact = parseJson(artifactBytes, PUBLISH_ACTIVATION_ARTIFACT_PATH);
  const trackedReceipts = artifact.boundary?.trackedReceipts;
  const receiptPaths = Array.isArray(trackedReceipts)
    ? trackedReceipts.map((candidate) => candidate?.path)
    : [];
  if (
    artifact.schemaVersion !== 1 ||
    artifact.task !== pin.task ||
    artifact.gate !== pin.gate ||
    artifact.proofId !== pin.proofId ||
    artifact.profile !== pin.profile ||
    artifact.result !== pin.result ||
    artifact.claim?.taskStatus !== "DONE" ||
    artifact.claim?.gateStatus !== "DONE" ||
    artifact.claim?.savedAuthoredSourceOnly !== true ||
    artifact.claim?.publisherRerunFromSavedSource !== true ||
    artifact.claim?.scenarioPreviewPublished !== false ||
    artifact.claim?.fixtureDataPublished !== false ||
    artifact.claim?.operationInputOrSecretPublished !== false ||
    artifact.claim?.rejectedDiagnosticsPublished !== false ||
    artifact.claim?.exactCanonicalBundleBytesStored !== true ||
    artifact.claim?.fixedPreviewChannelCompareAndSet !== true ||
    artifact.claim?.mutableChannelIsActivationAuthority !== false ||
    artifact.claim?.sourceGenerationDistinct !== true ||
    artifact.claim?.channelGenerationDistinct !== true ||
    artifact.claim?.durableActivationGenerationDistinct !== true ||
    artifact.claim?.activeRevisionRequiresReferenceHostReceipt !== true ||
    artifact.claim?.staleCompletionCanBecomeActive !== false ||
    artifact.claim?.blindRetryAfterIndeterminate !== false ||
    artifact.claim?.conflictActivatesCandidate !== false ||
    artifact.claim?.lastKnownGoodActivationPreserved !== true ||
    artifact.claim?.realPublicControlPlaneAndReferenceHostIntegration !== true ||
    artifact.claim?.browserAppImportsNodeCompositionPackages !== false ||
    artifact.claim?.publicationClaimed !== true ||
    artifact.claim?.activationClaimed !== true ||
    artifact.claim?.browserE2eClaimed !== false ||
    artifact.claim?.p08Status !== "NOT_PROVEN" ||
    artifact.claim?.pf085Status !== "OPEN" ||
    artifact.claim?.pf086Status !== "OPEN" ||
    artifact.claim?.pf089Status !== "OPEN" ||
    artifact.tests?.focusedTestDeclarations !== 45 ||
    artifact.tests?.rootTestNames?.length !== 12 ||
    artifact.tests?.realPublicIntegration !== true ||
    artifact.boundary?.trackedFiles !== 33 ||
    artifact.boundary?.parentArtifacts !== 9 ||
    trackedReceipts?.length !== 33 ||
    !isDeepStrictEqual(
      receiptPaths,
      [...receiptPaths].sort((left, right) => left.localeCompare(right, "en-US")),
    )
  ) {
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      "The M09-T14/G09 publish-activation identity or claims drifted.",
    );
  }
  const receiptMap = new Map(trackedReceipts.map((candidate) => [candidate.path, candidate]));
  for (const relativePath of T14_SUCCESSOR_RECEIPT_PATHS) {
    const receipt = receiptMap.get(relativePath);
    const bytes = files.get(relativePath);
    if (relativePath === T14_PUBLICATION_APPLICATION_TEST_PATH) {
      const liveSource = bytes?.toString("utf8") ?? "";
      const timeoutSuffix = "}, 10_000);";
      const frozenBytes = Buffer.from(liveSource.replace(timeoutSuffix, "});"));
      if (
        receipt?.bytes !== T14_FROZEN_PUBLICATION_APPLICATION_TEST_RECEIPT.bytes ||
        receipt.sha256 !== T14_FROZEN_PUBLICATION_APPLICATION_TEST_RECEIPT.sha256 ||
        bytes?.byteLength !== T14_LIVE_PUBLICATION_APPLICATION_TEST_RECEIPT.bytes ||
        sha256(bytes) !== T14_LIVE_PUBLICATION_APPLICATION_TEST_RECEIPT.sha256 ||
        liveSource.split(timeoutSuffix).length - 1 !== 1 ||
        frozenBytes.byteLength !== T14_FROZEN_PUBLICATION_APPLICATION_TEST_RECEIPT.bytes ||
        sha256(frozenBytes) !== T14_FROZEN_PUBLICATION_APPLICATION_TEST_RECEIPT.sha256
      ) {
        fail("SUCCESSOR_POLICY_VIOLATION", `The live M09-T14 receipt drifted: ${relativePath}.`);
      }
      continue;
    }
    if (
      receipt === undefined ||
      bytes === undefined ||
      receipt.bytes !== bytes.byteLength ||
      receipt.sha256 !== sha256(bytes)
    ) {
      fail("SUCCESSOR_POLICY_VIOLATION", `The live M09-T14 receipt drifted: ${relativePath}.`);
    }
  }
  return deepFreeze({
    task: pin.task,
    gate: pin.gate,
    artifact: pin,
    focusedTestDeclarations: 45,
    trackedFiles: 33,
    parentArtifacts: 9,
    rootTests: 12,
    savedAuthoredSourceOnly: true,
    publisherRerunFromSavedSource: true,
    scenarioPreviewPublished: false,
    fixtureDataPublished: false,
    operationInputOrSecretPublished: false,
    rejectedDiagnosticsPublished: false,
    exactCanonicalBundleBytesStored: true,
    fixedPreviewChannelCompareAndSet: true,
    mutableChannelIsActivationAuthority: false,
    distinctSourceChannelAndActivationGenerations: true,
    activeRevisionRequiresReferenceHostReceipt: true,
    staleCompletionCanBecomeActive: false,
    blindRetryAfterIndeterminate: false,
    conflictActivatesCandidate: false,
    lastKnownGoodActivationPreserved: true,
    realPublicControlPlaneAndReferenceHostIntegration: true,
    browserAppImportsNodeCompositionPackages: false,
    publicationClaimed: true,
    activationClaimed: true,
    browserE2eClaimed: false,
    p08Status: "NOT_PROVEN",
    pf085Status: "OPEN",
    pf086Status: "OPEN",
    pf089Status: "OPEN",
  });
}

/** Authenticates frozen M09-T01 evidence and checks exact additive successors. */
export async function buildDesenAppShellNavigationEvidence(rawOptions = undefined) {
  const options = captureBuildOptions(rawOptions);
  const [frozen, files, prerequisiteBytes] = await Promise.all([
    authenticateFrozenArtifact(options.workspaceRoot),
    readTrackedFiles(options),
    options.prerequisiteBytes ?? readRegularAuthority(options.prerequisitePath, PREREQUISITE_PATH),
  ]);
  const prerequisite = verifyPrerequisite(prerequisiteBytes);
  const packageContract = verifyPackage(
    files.get("apps/desen-app/package.json"),
    files.get("package.json"),
  );
  const shell = verifyShellSemantics(files);
  const tests = verifyTests(files);
  const importBoundary = inspectImports(files);
  const namedSlotArtifact = authenticateNamedSlotArtifact(files.get(NAMED_SLOT_ARTIFACT_PATH));
  const fixturesScenariosSuccessor = authenticateFixturesScenariosSuccessor(files);
  const sourcePersistenceSuccessor = authenticateSourcePersistenceSuccessor(files);
  const nodeLinkedDiagnosticsSuccessor = authenticateNodeLinkedDiagnosticsSuccessor(files);
  const publishActivationSuccessor = authenticatePublishActivationSuccessor(files);
  assertRetainedHistoricalReceipts(frozen.artifact, files);
  if (options.fileOverrides.size !== 0) {
    fail("BOUNDARY_DRIFT", "Mutation overrides cannot issue current compatibility evidence.");
  }
  const currentCompatibility = deepFreeze({
    schemaVersion: 1,
    proofId: "desen-app-shell-navigation",
    profile: "desen.app.shell-navigation-proof.v1",
    task: "M09-T01",
    result: "PASS",
    prerequisite,
    retainedClaim: {
      taskStatus: frozen.artifact.claim.taskStatus,
      shellImplemented: frozen.artifact.claim.shellImplemented,
      projectNavigationImplemented: frozen.artifact.claim.projectNavigationImplemented,
      directUrlNavigationImplemented: frozen.artifact.claim.directUrlNavigationImplemented,
      unknownRoutesFailClosed: frozen.artifact.claim.unknownRoutesFailClosed,
      userProjectCreationImplemented: frozen.artifact.claim.userProjectCreationImplemented,
    },
    application: {
      package: packageContract,
      shell,
    },
    boundary: {
      imports: importBoundary,
      retainedHistoricalReceipts: RETAINED_HISTORICAL_PATHS.length,
      successorCompatibilityPaths: SUCCESSOR_COMPATIBILITY_PATHS.length,
    },
    tests,
    fixturesScenariosSuccessor,
    sourcePersistenceSuccessor,
    nodeLinkedDiagnosticsSuccessor,
    publishActivationSuccessor,
    additiveSuccessor: {
      task: "M09-T07",
      artifact: namedSlotArtifact,
      catalogDrivenAuthoringReadModelAllowed: true,
      exactPublicRuntimeAdapterCanvasAllowed: true,
      stableSourceSelectionOverlayAllowed: true,
      schemaDerivedPrimitiveAndEnumInspectorAllowed: true,
      publicEditorCoreMutationAllowed: true,
      publisherBackedSessionPreviewAllowed: true,
      nestedObjectInspectorAllowed: true,
      honestStructuredJsonFallbackAllowed: true,
      completeNamedSlotProjectionAllowed: true,
      catalogAdmissionAndCardinalityPreflightAllowed: true,
      publicStableIdInsertMoveAndReorderAllowed: true,
      publicValidatedNodeDeletionAllowed: true,
      deletionPreflightRunsPublicMutationAndValidation: true,
      rootAndSourceMinimumDeletionDisabled: true,
      behaviorOwnedDeletePreservesEmptySlot: true,
      exactOwnDataDeletionSelectionCapture: true,
      continuousCompleteSourceRevalidation: true,
      failedDeletionPreservesCurrentDocument: true,
      deletionSourceAndPreviewCommitAtomically: true,
      deletionFocusManaged: true,
      browserDataTransferReadsZero: true,
      expandedDropReadyBoundaries: true,
      stableNestedDragHover: true,
      explicitComponentDropTargetGuide: true,
      keyboardPlacementControl: true,
      insertionAdmissionCachedPerModelAndExactTarget: true,
      placementAdmissionCachedPerModelAndExactTarget: true,
      cachedPlacementBaseMaterializesBoundaryFinalIndex: true,
      componentPaletteRenderLimit: 24,
      activeTabOnlyAuthoringWork: true,
      exactSlotSelectionAndEditCaptureAllowed: true,
      atomicPublisherBackedSlotEditsAllowed: true,
      dynamicValuesRemainLocked: true,
      knownSourceEdges: [...ADDITIVE_SUCCESSOR_SOURCE_PATHS],
      historicalNoCatalogPanelNonclaimAppliedToCurrentApp: false,
      historicalNoRealAdapterCanvasNonclaimAppliedToCurrentApp: false,
      historicalNoSelectionOrInspectorNonclaimAppliedToCurrentApp: false,
      historicalNoSourceMutationNonclaimAppliedToCurrentApp: false,
      persistenceAndControlPlanePublishStillDisallowed: true,
    },
  });
  return deepFreeze({
    artifact: frozen.artifact,
    artifactBytes: frozen.artifactBytes,
    artifactSha256: frozen.artifactSha256,
    currentCompatibility,
  });
}

function verifyProofDocument(proofDocument, artifactSha256) {
  const text = decodeUtf8(proofDocument, PROOF_DOCUMENT_PATH);
  if (
    exactTextCount(text, ARTIFACT_PATH) < 1 ||
    exactTextCount(text, `sha256:${artifactSha256}`) !== 1 ||
    exactTextCount(text, "[PENDING_FINAL_ARTIFACT_SHA256]") !== 0 ||
    exactTextCount(text, "M09-T01") < 1 ||
    !/(?:Status:\s*`?DONE`?|M09-T01\s*\|\s*DONE)/u.test(text)
  ) {
    fail("PROOF_PIN_DRIFT", "The visible M09-T01 proof path, digest, or DONE association drifted.");
  }
}

/** Verifies committed artifact bytes and their visible proof-document association. */
export async function verifyDesenAppShellNavigationEvidence(rawOptions = undefined) {
  const options = exactOwnDataOptions(
    rawOptions,
    ["artifactBytes", "artifactPath", "buildOptions", "proofDocument", "proofDocumentPath"],
    "verify options",
  );
  const built = await buildDesenAppShellNavigationEvidence(options.buildOptions);
  const artifactBytes =
    options.artifactBytes === undefined
      ? await readRegularAuthority(
          capturePath(
            options.artifactPath,
            "artifactPath",
            DEFAULT_DESEN_APP_SHELL_NAVIGATION_ARTIFACT_PATH,
          ),
          ARTIFACT_PATH,
        )
      : captureBytes(options.artifactBytes, "artifactBytes");
  if (!isDeepStrictEqual(artifactBytes, built.artifactBytes)) {
    fail("ARTIFACT_DRIFT", "Committed M09-T01 artifact bytes differ from fresh evidence.");
  }
  const proofDocument =
    options.proofDocument === undefined
      ? await readRegularAuthority(
          capturePath(
            options.proofDocumentPath,
            "proofDocumentPath",
            path.join(WORKSPACE_ROOT, PROOF_DOCUMENT_PATH),
          ),
          PROOF_DOCUMENT_PATH,
        )
      : captureBytes(options.proofDocument, "proofDocument");
  verifyProofDocument(proofDocument, built.artifactSha256);
  return deepFreeze({
    task: built.artifact.task,
    result: built.artifact.result,
    artifactBytes: built.artifactBytes.byteLength,
    artifactSha256: built.artifactSha256,
    trackedFiles: built.artifact.boundary.trackedFiles,
    focusedRuntimeCases: built.artifact.evidence.tests.totalRuntimeCases,
    prerequisiteGate: built.artifact.claim.prerequisiteGate,
    prerequisiteStatus: built.artifact.claim.prerequisiteStatus,
  });
}

/** Atomically writes exact deterministic M09-T01 evidence. */
export async function writeDesenAppShellNavigationEvidence(rawOptions = undefined) {
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
  const artifactPath = capturePath(
    options.artifactPath,
    "artifactPath",
    DEFAULT_DESEN_APP_SHELL_NAVIGATION_ARTIFACT_PATH,
  );
  const built = await buildDesenAppShellNavigationEvidence(options.buildOptions);
  try {
    await writeAtomicProofArtifact({
      artifactPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename: options.beforeAtomicRename,
    });
  } catch (error) {
    fail("ARTIFACT_WRITE_UNSAFE", "Atomic M09-T01 artifact write failed safely.", {
      cause: String(error),
    });
  }
  return deepFreeze({
    task: built.artifact.task,
    result: built.artifact.result,
    artifactPath,
    artifactBytes: built.artifactBytes.byteLength,
    artifactSha256: built.artifactSha256,
    trackedFiles: built.artifact.boundary.trackedFiles,
    focusedRuntimeCases: built.artifact.evidence.tests.totalRuntimeCases,
  });
}
