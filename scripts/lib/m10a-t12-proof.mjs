import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { types as utilTypes } from "node:util";

import { readCheckpointedFrozenArtifact } from "../ci/proof-reader-checkpoints.mjs";
import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const MODULE_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(MODULE_DIRECTORY, "../..");
const ARTIFACT_RELATIVE_PATH = "docs/proof/artifacts/m10a-t12.json";
const M10A_T03_ARTIFACT_RELATIVE_PATH = "docs/proof/artifacts/m10a-t03.json";
const M10A_T09_ARTIFACT_RELATIVE_PATH = "docs/proof/artifacts/m10a-t09.json";
const REPORT_LIMIT = 256 * 1024;
const MAX_AUTHORITY_FILE_BYTES = 4 * 1024 * 1024;

const REQUIRED_STYLE_PROPERTIES = Object.freeze([
  "layoutMode",
  "gap",
  "width",
  "backgroundColor",
  "backgroundGradient",
  "border",
  "borderRadius",
  "boxShadow",
  "typography",
  "position",
  "rotate",
]);

// The frozen T12 evidence captured the browser journey with a 90-second total test budget.
// The exact-head hosted run reached its final persisted-preview assertion at that ceiling, while
// the same complete journey passed locally. The product successor may use only this exact 120s
// budget; its source receipt is projected back to the frozen receipt so the completed evidence
// stays immutable. This is a scheduling allowance, not new authoring or runtime authority.
export const M10A_T12_TIMEOUT_CONFIG_SUCCESSOR = Object.freeze({
  task: "M10A-T12",
  artifact: Object.freeze({
    path: ARTIFACT_RELATIVE_PATH,
    bytes: 11_804,
    sha256: "31f48f192ea6ed4160576e898bc2a422483eaff3a0877f5d015b396630d6389b",
  }),
  path: "apps/desen-app-browser-e2e/t12-playwright.config.ts",
  current: Object.freeze({
    bytes: 1_500,
    sha256: "0dbd8fd484720ef5841c1ea7723961a80c00ca7b3d4aaff23adb329e6af7caeb",
  }),
  predecessor: Object.freeze({
    bytes: 1_499,
    sha256: "005fbe57d80e14cd73361c97683d37b0751f66cb705136b6ab0ffc9263277124",
  }),
  currentTimeoutBlock: "  workers: 1,\n  timeout: 120_000,\n  expect: { timeout: 10_000 },\n",
  predecessorTimeoutBlock: "  workers: 1,\n  timeout: 90_000,\n  expect: { timeout: 10_000 },\n",
});

// M10A-T13 adds only its own root-level package scripts. Project the reviewed additive
// package wiring back to the frozen T12 package receipt before hashing its authorities.
export const M10A_T13_PACKAGE_JSON_SUCCESSOR = Object.freeze({
  task: "M10A-T13",
  path: "package.json",
  current: Object.freeze({
    bytes: 107_129,
    sha256: "04c4936b4d7fb31ef8484a5bb46e951233170b07a667ad0afc0ed3a9d9e723b6",
  }),
  predecessor: Object.freeze({
    bytes: 106_895,
    sha256: "b2dc3856e3e88dcc4dc1a6e59c198a38e6521f41c25ba66e2b8a17db735f434c",
  }),
});

// M10A-T14 adds only its own root-level package scripts and test-chain hooks. Project
// the reviewed additive package wiring back to the frozen T13 package receipt before
// applying the existing T13 projection to the frozen T12 authority.
export const M10A_T14_PACKAGE_JSON_SUCCESSOR = Object.freeze({
  task: "M10A-T14",
  path: "package.json",
  current: Object.freeze({
    bytes: 107_294,
    sha256: "87a422b8a601c5c3553f03b7f390d9168a9ed7fe66a03b66087d037138c69aa2",
  }),
  predecessor: Object.freeze({
    bytes: 107_129,
    sha256: "04c4936b4d7fb31ef8484a5bb46e951233170b07a667ad0afc0ed3a9d9e723b6",
  }),
});

const SOURCE_REQUIREMENTS = Object.freeze([
  Object.freeze({
    path: "package.json",
    markers: Object.freeze([
      '"verify:m10a-t09": "node scripts/verify-m10a-t09.mjs"',
      '"verify:m10a-t12": "node scripts/verify-m10a-t12.mjs"',
      '"test:m10a-t12": "node --test tests/m10a-t12.test.mjs"',
    ]),
  }),
  Object.freeze({
    path: "scripts/lib/m10a-t09-proof.mjs",
    markers: Object.freeze([
      "HISTORICAL_CAPTURE_RETIRED",
      'readCheckpointedFrozenArtifact("M10A-T09")',
      "successor Catalog tasks own current capture",
    ]),
  }),
  Object.freeze({
    path: "tests/m10a-t09.test.mjs",
    markers: Object.freeze([
      "authenticates its frozen data-display receipt, not the successor Catalog",
      "package wiring does not rebuild or test the successor Catalog as historical proof",
    ]),
  }),
  Object.freeze({
    path: "apps/desen-app/src/starter-neutral-workspace-profile.ts",
    markers: Object.freeze([
      'profileId: "desen-neutral-web"',
      'id: "desen-neutral"',
      'sourceKey: "desen-neutral-source"',
      "publication: null",
    ]),
  }),
  Object.freeze({
    path: "apps/desen-app/src/starter-project.ts",
    markers: Object.freeze([
      "DESEN_NEUTRAL_THEME_DOCUMENT",
      "STARTER_NEUTRAL_TOKEN_SOURCES",
      "designSystem: { tokenSources: STARTER_NEUTRAL_TOKEN_SOURCES, recipes: [], assets: [] }",
    ]),
  }),
  Object.freeze({
    path: "packages/starter-catalog-web/src/contracts.ts",
    markers: Object.freeze([
      'export const STARTER_CATALOG_ID = "run.desen.starter.web"',
      'export const STARTER_CATALOG_VERSION = "0.7.0"',
      "STARTER_COMPONENT_REGISTRATIONS",
    ]),
  }),
  Object.freeze({
    path: "packages/starter-catalog-web/src/visual-style-profile.ts",
    markers: Object.freeze([
      "STARTER_VISUAL_STYLE_PROFILE_BY_CAPABILITY",
      "isStarterCapabilityVisualStyleValue",
      "STARTER_FONT_FAMILIES",
    ]),
  }),
  Object.freeze({
    path: "packages/starter-catalog-web/src/react-adapters.tsx",
    markers: Object.freeze([
      "STARTER_WEB_REACT_ADAPTER_REGISTRY_INPUT",
      "starterVisualStyleProfileForCapability",
      "STARTER_STACK_CAPABILITY_ID",
    ]),
  }),
  Object.freeze({
    path: "packages/starter-catalog-web/package.json",
    markers: Object.freeze(['"test:public-package"', '"./react-adapters"']),
  }),
  Object.freeze({
    path: "packages/starter-catalog-web/test/public-package.mjs",
    markers: Object.freeze([
      "built starter catalog public package exports reviewed members",
      "STARTER_COMPONENT_REGISTRATIONS",
    ]),
  }),
  Object.freeze({
    path: "apps/desen-app/src/starter-workspace-product.tsx",
    markers: Object.freeze([
      "useSyncExternalStore",
      "authoringProjectRecord={project ?? initialProject}",
      "STARTER_NEUTRAL_WORKSPACE_PROFILE",
    ]),
  }),
  Object.freeze({
    path: "apps/desen-app/src/main.tsx",
    markers: Object.freeze([
      "createInjectedDesenAppLocalProjectWorkspaceStoragePort",
      'workspaceKey: "desen-neutral-workspace"',
      "<StarterWorkspaceProduct",
    ]),
  }),
  Object.freeze({
    path: "apps/desen-app/src/project-workspace-authoring-persistence.ts",
    markers: Object.freeze([
      "compareAndSetSource",
      "lifecycle.replaceProjectRecord",
      "const settlement = await lifecycle.save()",
      "sourceGenerationAlias",
      "createsSourceInExistingAggregate",
      'failure("unsafe-storage")',
    ]),
  }),
  Object.freeze({
    path: "apps/desen-app/src/local-project-workspace-persistence.ts",
    markers: Object.freeze([
      "/v1/project-workspaces/${options.workspaceKey}",
      "It has no route to `/v1/sources`",
      "if-none-match",
      "if-match",
    ]),
  }),
  Object.freeze({
    path: "apps/desen-app/src/authoring-design-tokens.ts",
    markers: Object.freeze([
      "resolveDesignTokens({ sources: project.designSystem.tokenSources })",
      "captureJsonLiteral",
      "freezeJsonValue",
      "resolveRuntimeToken",
    ]),
  }),
  Object.freeze({
    path: "apps/desen-app/src/authoring-styles.ts",
    markers: Object.freeze([
      'const RESPONSIVE_VARIANT_EXTENSION = "run.desen.app/t12-responsive"',
      'Object.freeze({ id: "tablet", label: "Tablet", maxWidth: 1_024 })',
      'Object.freeze({ id: "mobile", label: "Mobile", maxWidth: 767 })',
      'kind: "set-literal"',
      'kind: "set-token"',
      'kind: "reset"',
      '"token-incompatible"',
      "maximum widths must be monotonic from wider to narrower: tablet, then mobile",
      "inventory.nonCanonicalOrder",
      "applyAuthoringStyleEdit",
    ]),
  }),
  Object.freeze({
    path: "apps/desen-app/src/authoring-data.ts",
    markers: Object.freeze([
      "INSPECTOR_REGISTRATIONS_BY_MODEL",
      "resolveCatalogComponentInspector",
      "normal canvas/library startup must not eagerly derive",
    ]),
  }),
  Object.freeze({
    path: "apps/desen-app/src/authoring-inspector.ts",
    markers: Object.freeze([
      "resolveCatalogComponentInspector",
      'if (inspector === undefined) return Object.freeze({ status: "rejected" })',
    ]),
  }),
  Object.freeze({
    path: "apps/desen-app/src/preview-fidelity.ts",
    markers: Object.freeze(["component?.previewAdapter", 'previewAdapter, "fidelity"']),
  }),
  Object.freeze({
    path: "apps/desen-app/src/authoring-style-preview-runtime.ts",
    markers: Object.freeze([
      "AUTHORING_STYLE_PREVIEW_VIEWPORTS",
      "width: 1024",
      "width: 390",
      "createAuthoringStylePreviewHostPorts",
      "known responsive viewport",
    ]),
  }),
  Object.freeze({
    path: "apps/desen-app/src/style-panel.tsx",
    markers: Object.freeze([
      "StyleColorControl",
      "StyleGradientControl",
      "StyleBorderControl",
      "StyleShadowControl",
      "StyleTypographyControl",
      "UnsupportedStructuredDisclosure",
      "StyleTokenSelector",
    ]),
  }),
  Object.freeze({
    path: "apps/desen-app/test/authoring-design-tokens.test.ts",
    markers: Object.freeze([
      "uses the persisted DESEN Neutral T02 token sources for both authoring and runtime",
      "fails closed when a persisted project has no admissible token selection",
      "immutable deep canonical clone",
    ]),
  }),
  Object.freeze({
    path: "apps/desen-app/test/authoring-data.test.ts",
    markers: Object.freeze([
      "defers schema-inspector derivation to one exact validator-admitted component",
      'Object.hasOwn(component, "inspector") === false',
      "resolveCatalogComponentInspector",
    ]),
  }),
  Object.freeze({
    path: "apps/desen-app/test/authoring-inspector.test.ts",
    markers: Object.freeze([
      "derives the exact canonical primitive and enum matrix for every reference component",
      "resolveCatalogComponentInspector",
    ]),
  }),
  Object.freeze({
    path: "apps/desen-app/test/preview-fidelity.test.ts",
    markers: Object.freeze([
      "reports the current reference surface as same-fidelity",
      "retains all approximate differences and supplies an explicit empty-declaration fallback",
    ]),
  }),
  Object.freeze({
    path: "apps/desen-app/test/authoring-styles.test.ts",
    markers: Object.freeze([
      "accepts only explicit compatible resolved tokens",
      "creates, edits, and deletes only exact responsive node overrides without reordering existing variants",
      "fails closed when existing owned responsive variants cascade from mobile into tablet",
      "rejects raw dynamic literals and unsealed breakpoint targets",
    ]),
  }),
  Object.freeze({
    path: "apps/desen-app/test/authoring-style-preview-runtime.test.ts",
    markers: Object.freeze([
      "exposes only the selected App-owned responsive viewport and resolved project tokens",
      "refuses unknown viewport identifiers",
      "rejects free-form or non-base preview-frame authority",
    ]),
  }),
  Object.freeze({
    path: "apps/desen-app/test/style-panel.test.tsx",
    markers: Object.freeze([
      "fails closed for an idle selection without exposing a raw style editor",
      "authors typed color and dimension literals, token references, responsive selection, and exact reset",
      "uses bounded visual controls for gradient, border, shadow, and typography composites",
    ]),
  }),
  Object.freeze({
    path: "apps/desen-app/test/starter-neutral-workspace-profile.test.ts",
    markers: Object.freeze([
      "adds a separate reviewed starter workspace without changing reference identities",
      'expect(profile.profileId).toBe("desen-neutral-web")',
      "expect(profile.publication).toBeNull()",
    ]),
  }),
  Object.freeze({
    path: "apps/desen-app/test/project-workspace-authoring-persistence.test.ts",
    markers: Object.freeze([
      "creates and reopens a Source through one persisted aggregate T02 workspace",
      "does not use an unrelated source key as a second storage namespace",
      "creates a missing Source through an existing aggregate generation fence",
      "rejects a malformed aggregate creation generation rather than coercing it to Source generation one",
    ]),
  }),
  Object.freeze({
    path: "apps/desen-app/test/local-project-workspace-persistence.test.ts",
    markers: Object.freeze([
      "writes the complete admitted T02 project registry through only its fixed workspace route",
      "preserves uncertain writes and rejects invalid local identities before issuing a request",
    ]),
  }),
  Object.freeze({
    path: "apps/desen-app-browser-e2e/t12-rich-styling.pw.ts",
    markers: Object.freeze([
      "DESEN_M10A_T12_PROOF_TEMP",
      "browser-proof.json",
      "getComputedStyle",
      "desen-neutral-workspace",
      "authors two component-level visual presentations and ordered responsive overrides through the normal DESEN Neutral product",
    ]),
  }),
  Object.freeze({
    path: "apps/desen-app-browser-e2e/t12-playwright.config.ts",
    markers: Object.freeze(["t12-rich-styling.pw.ts"]),
  }),
  Object.freeze({
    path: "apps/desen-app-browser-e2e/package.json",
    markers: Object.freeze(['"test:m10a-t12"']),
  }),
]);

/** Exact task-owned M10A-T12 proof-artifact destination. */
export const M10A_T12_ARTIFACT_PATH = path.join(WORKSPACE_ROOT, ARTIFACT_RELATIVE_PATH);

/** Exact real-browser command that owns the normal-product T12 observation. */
export const M10A_T12_BROWSER_COMMAND = Object.freeze({
  command: "pnpm",
  args: Object.freeze(["--filter", "@desen/app-browser-e2e", "run", "test:m10a-t12"]),
});

/** Exact focused App command required before a live T12 capture or verification. */
export const M10A_T12_FOCUSED_APP_COMMAND = Object.freeze({
  command: "pnpm",
  args: Object.freeze([
    "--filter",
    "@desen/app-web",
    "exec",
    "vitest",
    "run",
    "test/authoring-data.test.ts",
    "test/authoring-inspector.test.ts",
    "test/preview-fidelity.test.ts",
    "test/authoring-design-tokens.test.ts",
    "test/authoring-styles.test.ts",
    "test/authoring-style-preview-runtime.test.ts",
    "test/style-panel.test.tsx",
    "test/starter-neutral-workspace-profile.test.ts",
    "test/project-workspace-authoring-persistence.test.ts",
    "test/local-project-workspace-persistence.test.ts",
    "test/main-lifecycle.test.tsx",
  ]),
});

/** Exact browser journey title whose passed observation is required for T12 evidence. */
export const M10A_T12_BROWSER_TEST_TITLES = Object.freeze([
  "authors two component-level visual presentations and ordered responsive overrides through the normal DESEN Neutral product",
]);

/** All browser claims which the real normal-product journey must explicitly attest. */
export const M10A_T12_BROWSER_ASSERTION_NAMES = Object.freeze([
  "aggregateWorkspacePersistence",
  "desktopPreview",
  "distinctComponentBrandPresentations",
  "literalBrandPresentation",
  "mobilePreview",
  "noJsxCssJsonAuthoring",
  "normalStarterProfile",
  "resetInheritance",
  "resolvedTokenBrandPresentation",
  "responsiveOverrideOrder",
  "tabletPreview",
]);

/** Focused application suites whose source and browser authorities are bound into T12 evidence. */
export const M10A_T12_FOCUSED_APP_TEST_FILES = Object.freeze([
  "apps/desen-app/test/authoring-data.test.ts",
  "apps/desen-app/test/authoring-inspector.test.ts",
  "apps/desen-app/test/preview-fidelity.test.ts",
  "apps/desen-app/test/authoring-design-tokens.test.ts",
  "apps/desen-app/test/authoring-styles.test.ts",
  "apps/desen-app/test/authoring-style-preview-runtime.test.ts",
  "apps/desen-app/test/style-panel.test.tsx",
  "apps/desen-app/test/starter-neutral-workspace-profile.test.ts",
  "apps/desen-app/test/project-workspace-authoring-persistence.test.ts",
  "apps/desen-app/test/local-project-workspace-persistence.test.ts",
  "apps/desen-app/test/main-lifecycle.test.tsx",
]);

/** Root mutation-test declarations embedded in the eventual T12 artifact. */
export const M10A_T12_ROOT_TEST_NAMES = Object.freeze([
  "M10A-T12 binds the normal Starter profile, closed visual Catalog, and focused application authorities",
  "M10A-T12 authenticates only a passed normal-product browser observation",
  "M10A-T12 rejects missing source semantics, malformed observations, and artifact drift",
  "M10A-T12 writer is atomic and does not invent named-theme management authority",
]);

/** Stable error class raised at the bounded M10A-T12 proof boundary. */
export class M10AT12ProofError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "M10AT12ProofError";
    this.code = `M10A_T12_${code}`;
  }
}

function fail(code, message) {
  throw new M10AT12ProofError(code, message);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Admits only the reviewed hosted-CI timeout successor and returns the immutable T12 receipt
 * represented by the frozen artifact. Callers never supply a path or receipt.
 */
export function projectM10AT12TimeoutConfigSuccessor(bytes) {
  if (!Buffer.isBuffer(bytes)) {
    fail("CONFIG_SUCCESSOR_DRIFT", "The T12 timeout successor must receive exact file bytes.");
  }
  const successor = M10A_T12_TIMEOUT_CONFIG_SUCCESSOR;
  if (bytes.byteLength !== successor.current.bytes || sha256(bytes) !== successor.current.sha256) {
    fail("CONFIG_SUCCESSOR_DRIFT", "The reviewed M10A-T12 browser timeout successor drifted.");
  }
  const source = bytes.toString("utf8");
  const timeoutOffset = source.indexOf(successor.currentTimeoutBlock);
  if (
    timeoutOffset < 0 ||
    timeoutOffset !== source.lastIndexOf(successor.currentTimeoutBlock) ||
    source.includes(successor.predecessorTimeoutBlock)
  ) {
    fail("CONFIG_SUCCESSOR_DRIFT", "The T12 timeout successor has no one exact inverse edit.");
  }
  const projected = Buffer.from(
    `${source.slice(0, timeoutOffset)}${successor.predecessorTimeoutBlock}${source.slice(
      timeoutOffset + successor.currentTimeoutBlock.length,
    )}`,
    "utf8",
  );
  if (
    projected.byteLength !== successor.predecessor.bytes ||
    sha256(projected) !== successor.predecessor.sha256
  ) {
    fail("CONFIG_SUCCESSOR_DRIFT", "The T12 timeout successor did not restore its frozen receipt.");
  }
  return projected;
}

/** Admits only the reviewed M10A-T13 package-script additions and restores T12 bytes. */
export function projectM10AT13PackageJsonSuccessor(bytes) {
  if (!Buffer.isBuffer(bytes)) {
    fail("PACKAGE_SUCCESSOR_DRIFT", "The T13 package successor must receive exact file bytes.");
  }
  const successor = M10A_T13_PACKAGE_JSON_SUCCESSOR;
  if (bytes.byteLength !== successor.current.bytes || sha256(bytes) !== successor.current.sha256) {
    fail("PACKAGE_SUCCESSOR_DRIFT", "The reviewed M10A-T13 package successor drifted.");
  }
  let source = bytes.toString("utf8");
  const replacements = [
    ['    "generate:m10a-t13": "node scripts/generate-m10a-t13-proof.mjs",\n', ""],
    ['    "verify:m10a-t13": "node scripts/verify-m10a-t13.mjs",\n', ""],
    ['    "test:m10a-t13": "node --test tests/m10a-t13.test.mjs",\n', ""],
    [" && pnpm test:m10a-t13", ""],
    [" && pnpm verify:m10a-t13", ""],
  ];
  for (const [current, predecessor] of replacements) {
    const offset = source.indexOf(current);
    if (offset < 0 || offset !== source.lastIndexOf(current)) {
      fail("PACKAGE_SUCCESSOR_DRIFT", "The T13 package successor has no exact inverse edit.");
    }
    source = `${source.slice(0, offset)}${predecessor}${source.slice(offset + current.length)}`;
  }
  const projected = Buffer.from(source, "utf8");
  if (
    projected.byteLength !== successor.predecessor.bytes ||
    sha256(projected) !== successor.predecessor.sha256
  ) {
    fail(
      "PACKAGE_SUCCESSOR_DRIFT",
      "The T13 package successor did not restore its frozen receipt.",
    );
  }
  return projected;
}

/** Admits only the reviewed M10A-T14 package-script additions and restores T13 bytes. */
export function projectM10AT14PackageJsonSuccessor(bytes) {
  if (!Buffer.isBuffer(bytes)) {
    fail("PACKAGE_SUCCESSOR_DRIFT", "The T14 package successor must receive exact file bytes.");
  }
  const successor = M10A_T14_PACKAGE_JSON_SUCCESSOR;
  if (bytes.byteLength !== successor.current.bytes || sha256(bytes) !== successor.current.sha256) {
    fail("PACKAGE_SUCCESSOR_DRIFT", "The reviewed M10A-T14 package successor drifted.");
  }
  let source = bytes.toString("utf8");
  const replacements = [
    ['    "verify:m10a-t14": "node scripts/verify-m10a-t14.mjs",\n', ""],
    ['    "test:m10a-t14": "node --test tests/m10a-t14.test.mjs",\n', ""],
    [" && pnpm test:m10a-t14", ""],
    [" && pnpm verify:m10a-t14", ""],
  ];
  for (const [current, predecessor] of replacements) {
    const offset = source.indexOf(current);
    if (offset < 0 || offset !== source.lastIndexOf(current)) {
      fail("PACKAGE_SUCCESSOR_DRIFT", "The T14 package successor has no exact inverse edit.");
    }
    source = `${source.slice(0, offset)}${predecessor}${source.slice(offset + current.length)}`;
  }
  const projected = Buffer.from(source, "utf8");
  if (
    projected.byteLength !== successor.predecessor.bytes ||
    sha256(projected) !== successor.predecessor.sha256
  ) {
    fail(
      "PACKAGE_SUCCESSOR_DRIFT",
      "The T14 package successor did not restore the reviewed T13 receipt.",
    );
  }
  return projected;
}

function exactOptions(raw, allowed, label) {
  if (raw === undefined) return {};
  if (
    raw === null ||
    typeof raw !== "object" ||
    Array.isArray(raw) ||
    utilTypes.isProxy(raw) ||
    Object.getPrototypeOf(raw) !== Object.prototype
  ) {
    fail("OPTIONS_INVALID", `${label} must be one inert plain object.`);
  }
  const keys = Object.keys(raw);
  if (keys.some((key) => !allowed.includes(key))) {
    fail("OPTIONS_INVALID", `${label} contains an unknown option.`);
  }
  return Object.fromEntries(keys.map((key) => [key, raw[key]]));
}

function resolveWorkspaceRoot(rawWorkspaceRoot) {
  const workspaceRoot = rawWorkspaceRoot ?? WORKSPACE_ROOT;
  if (
    typeof workspaceRoot !== "string" ||
    workspaceRoot.length === 0 ||
    workspaceRoot.includes("\0") ||
    !path.isAbsolute(workspaceRoot) ||
    path.resolve(workspaceRoot) !== workspaceRoot ||
    utilTypes.isProxy(workspaceRoot)
  ) {
    fail("OPTIONS_INVALID", "workspaceRoot must be one canonical absolute path.");
  }
  return workspaceRoot;
}

function exactPlainRecord(raw, expectedKeys, label, code) {
  if (
    raw === null ||
    typeof raw !== "object" ||
    Array.isArray(raw) ||
    utilTypes.isProxy(raw) ||
    Object.getPrototypeOf(raw) !== Object.prototype
  ) {
    fail(code, `${label} must be one inert plain object.`);
  }
  const keys = Object.keys(raw).sort();
  const expected = [...expectedKeys].sort();
  if (
    keys.length !== expected.length ||
    keys.some((key, index) => key !== expected[index]) ||
    expected.some((key) => !Object.hasOwn(raw, key))
  ) {
    fail(code, `${label} fields drifted.`);
  }
  return raw;
}

function exactPassingTests(raw) {
  if (!Array.isArray(raw) || raw.length !== M10A_T12_BROWSER_TEST_TITLES.length) {
    fail("BROWSER_OBSERVATION_INVALID", "T12 browser test inventory drifted.");
  }
  const titles = raw
    .map((test, index) => {
      const captured = exactPlainRecord(
        test,
        ["result", "title"],
        `T12 browser test ${String(index)}`,
        "BROWSER_OBSERVATION_INVALID",
      );
      if (captured.result !== "PASS" || typeof captured.title !== "string") {
        fail("BROWSER_OBSERVATION_INVALID", "T12 browser test contains a non-passing case.");
      }
      return captured.title;
    })
    .sort();
  if (
    titles.some((title, index) => title !== M10A_T12_BROWSER_TEST_TITLES[index]) ||
    new Set(titles).size !== titles.length
  ) {
    fail("BROWSER_OBSERVATION_INVALID", "T12 browser test titles drifted.");
  }
  return Object.freeze(
    M10A_T12_BROWSER_TEST_TITLES.map((title) => Object.freeze({ title, result: "PASS" })),
  );
}

/** Parses one dynamically produced normal-product browser observation. */
export function parseM10AT12BrowserObservation(raw) {
  const observation = exactPlainRecord(
    raw,
    ["assertions", "profile", "result", "tests"],
    "T12 browser observation",
    "BROWSER_OBSERVATION_INVALID",
  );
  if (observation.profile !== "desen.m10a-t12.browser-proof.v1" || observation.result !== "PASS") {
    fail("BROWSER_OBSERVATION_INVALID", "T12 browser receipt identity drifted.");
  }
  const assertions = exactPlainRecord(
    observation.assertions,
    M10A_T12_BROWSER_ASSERTION_NAMES,
    "T12 browser assertions",
    "BROWSER_OBSERVATION_INVALID",
  );
  if (M10A_T12_BROWSER_ASSERTION_NAMES.some((name) => assertions[name] !== true)) {
    fail("BROWSER_OBSERVATION_INVALID", "T12 browser receipt contains a non-passing assertion.");
  }
  return Object.freeze({
    profile: "desen.m10a-t12.browser-proof.v1",
    result: "PASS",
    tests: exactPassingTests(observation.tests),
    assertions: Object.freeze(
      Object.fromEntries(M10A_T12_BROWSER_ASSERTION_NAMES.map((name) => [name, true])),
    ),
  });
}

async function readWorkspaceFile(workspaceRoot, relativePath, missingCode = "SOURCE_MISSING") {
  const candidate = path.resolve(workspaceRoot, relativePath);
  const relative = path.relative(workspaceRoot, candidate);
  if (relative === "" || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    fail("OPTIONS_INVALID", `T12 authority path escaped the workspace: ${relativePath}`);
  }
  let entry;
  try {
    entry = await lstat(candidate);
  } catch (error) {
    if (error?.code === "ENOENT")
      fail(missingCode, `Required T12 authority is missing: ${relativePath}`);
    throw error;
  }
  if (!entry.isFile() || entry.isSymbolicLink() || entry.size > MAX_AUTHORITY_FILE_BYTES) {
    fail(
      "SOURCE_UNSAFE",
      `Required T12 authority is not one bounded regular file: ${relativePath}`,
    );
  }
  return Buffer.from(await readFile(candidate));
}

async function collectSourceAuthorities(workspaceRoot) {
  if (
    SOURCE_REQUIREMENTS.filter(
      ({ path: relativePath }) => relativePath === M10A_T12_TIMEOUT_CONFIG_SUCCESSOR.path,
    ).length !== 1 ||
    SOURCE_REQUIREMENTS.filter(
      ({ path: relativePath }) => relativePath === M10A_T13_PACKAGE_JSON_SUCCESSOR.path,
    ).length !== 1 ||
    SOURCE_REQUIREMENTS.filter(
      ({ path: relativePath }) => relativePath === M10A_T14_PACKAGE_JSON_SUCCESSOR.path,
    ).length !== 1
  ) {
    fail("CONFIG_SUCCESSOR_DRIFT", "The T12 successor authority inventory drifted.");
  }
  const files = [];
  for (const requirement of SOURCE_REQUIREMENTS) {
    const bytes = await readWorkspaceFile(workspaceRoot, requirement.path);
    const text = bytes.toString("utf8");
    if (requirement.markers.some((marker) => !text.includes(marker))) {
      fail(
        "SOURCE_SEMANTICS_INVALID",
        `Required T12 source semantics drifted: ${requirement.path}`,
      );
    }
    let artifactBytes = bytes;
    if (requirement.path === M10A_T12_TIMEOUT_CONFIG_SUCCESSOR.path) {
      artifactBytes = projectM10AT12TimeoutConfigSuccessor(artifactBytes);
    } else if (requirement.path === M10A_T14_PACKAGE_JSON_SUCCESSOR.path) {
      artifactBytes = projectM10AT14PackageJsonSuccessor(artifactBytes);
      artifactBytes = projectM10AT13PackageJsonSuccessor(artifactBytes);
    } else if (requirement.path === M10A_T13_PACKAGE_JSON_SUCCESSOR.path) {
      artifactBytes = projectM10AT13PackageJsonSuccessor(artifactBytes);
    }
    files.push(
      Object.freeze({
        path: requirement.path,
        bytes: artifactBytes.byteLength,
        sha256: sha256(artifactBytes),
      }),
    );
  }
  return Object.freeze(files);
}

function plainRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireStyleProperty(schema, property) {
  if (!plainRecord(schema)) return false;
  const properties = schema.properties;
  const definitions = schema.$defs;
  if (!plainRecord(properties) || !plainRecord(definitions)) return false;
  const entry = properties[property];
  return (
    plainRecord(entry) &&
    typeof entry.$ref === "string" &&
    /^#\/\$defs\/[A-Za-z0-9_-]+$/u.test(entry.$ref) &&
    Object.hasOwn(definitions, entry.$ref.slice("#/$defs/".length))
  );
}

function parseStarterCatalog(bytes) {
  let catalog;
  try {
    catalog = JSON.parse(bytes.toString("utf8"));
  } catch {
    fail("CATALOG_INVALID", "T12 starter Catalog must remain valid UTF-8 JSON.");
  }
  if (
    !plainRecord(catalog) ||
    catalog.id !== "run.desen.starter.web" ||
    catalog.version !== "0.7.0" ||
    catalog.target !== "web-react" ||
    !plainRecord(catalog.components)
  ) {
    fail("CATALOG_INVALID", "Starter Catalog identity is not the reviewed T12 visual profile.");
  }
  const stack = catalog.components["run.desen.starter/Stack"];
  const rootSchema =
    plainRecord(stack) && plainRecord(stack.styleParts)
      ? stack.styleParts.root?.propertiesSchema
      : undefined;
  if (REQUIRED_STYLE_PROPERTIES.some((property) => !requireStyleProperty(rootSchema, property))) {
    fail("CATALOG_INVALID", "Starter Stack lacks one closed T12 visual style property.");
  }
  const componentIds = Object.keys(catalog.components).sort();
  if (componentIds.length < 32) {
    fail(
      "CATALOG_INVALID",
      "Starter Catalog no longer contains the reviewed capability inventory.",
    );
  }
  return Object.freeze({
    id: catalog.id,
    version: catalog.version,
    target: catalog.target,
    sha256: sha256(bytes),
    bytes: bytes.byteLength,
    componentCount: componentIds.length,
    stackRootProperties: Object.freeze([...REQUIRED_STYLE_PROPERTIES]),
  });
}

function parseFrozenPredecessor(bytes, label) {
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch {
    fail("PREDECESSOR_INVALID", `${label} must remain valid UTF-8 JSON.`);
  }
}

async function readFrozenM10AT03Predecessor(workspaceRoot) {
  const frozen = await readCheckpointedFrozenArtifact("M10A-T03", { workspaceRoot });
  if (
    frozen.path !== M10A_T03_ARTIFACT_RELATIVE_PATH ||
    frozen.byteLength !== 80_054 ||
    frozen.sha256 !== "530efe5d80d78a722c1832ad5b95086c2fd97bc2f1a4bd275b9a1924394b1e2b"
  ) {
    fail("PREDECESSOR_INVALID", "Checkpointed M10A-T03 receipt identity drifted.");
  }
  const artifact = exactPlainRecord(
    parseFrozenPredecessor(Buffer.from(frozen.bytes), "Checkpointed M10A-T03 receipt"),
    [
      "authoring",
      "claim",
      "frozenAuthorities",
      "nonClaims",
      "profile",
      "proofId",
      "publicPackage",
      "result",
      "schemaVersion",
      "task",
      "tests",
      "workbench",
    ],
    "Checkpointed M10A-T03 receipt",
    "PREDECESSOR_INVALID",
  );
  if (
    artifact.schemaVersion !== 1 ||
    artifact.task !== "M10A-T03" ||
    artifact.proofId !== "m10a-t03" ||
    artifact.profile !== "desen.theme-token-authoring.proof.v1" ||
    artifact.result !== "PASS"
  ) {
    fail("PREDECESSOR_INVALID", "Checkpointed M10A-T03 receipt fields drifted.");
  }
  const authoring = exactPlainRecord(
    artifact.authoring,
    ["editing", "kind", "limits", "neutral", "schemaVersion", "transfer"],
    "Checkpointed M10A-T03 authoring receipt",
    "PREDECESSOR_INVALID",
  );
  const neutral = exactPlainRecord(
    authoring.neutral,
    [
      "accessibility",
      "baseSourceId",
      "canonicalBytes",
      "darkCanvas",
      "darkSourceIds",
      "defaultSelection",
      "id",
      "lightCanvas",
      "lightSourceIds",
      "modes",
      "name",
      "recursivelyImmutable",
      "tokenCount",
      "tokenPaths",
    ],
    "Checkpointed M10A-T03 DESEN Neutral receipt",
    "PREDECESSOR_INVALID",
  );
  const selection = exactPlainRecord(
    neutral.defaultSelection,
    ["modeId", "themeId"],
    "Checkpointed M10A-T03 DESEN Neutral selection",
    "PREDECESSOR_INVALID",
  );
  if (
    authoring.kind !== "desen.theme-authoring" ||
    authoring.schemaVersion !== 1 ||
    neutral.id !== "desen-neutral" ||
    neutral.baseSourceId !== "neutral.base" ||
    selection.themeId !== "desen-neutral" ||
    selection.modeId !== "light" ||
    !Array.isArray(neutral.lightSourceIds) ||
    neutral.lightSourceIds.length !== 2 ||
    neutral.lightSourceIds[0] !== "neutral.base" ||
    neutral.lightSourceIds[1] !== "neutral.light"
  ) {
    fail("PREDECESSOR_INVALID", "Checkpointed M10A-T03 DESEN Neutral provenance drifted.");
  }
  return Object.freeze({
    artifact: Object.freeze({
      path: frozen.path,
      bytes: frozen.byteLength,
      sha256: frozen.sha256,
    }),
    profile: artifact.profile,
    neutral: Object.freeze({
      id: neutral.id,
      baseSourceId: neutral.baseSourceId,
      lightSourceIds: Object.freeze([...neutral.lightSourceIds]),
      defaultSelection: Object.freeze({ themeId: selection.themeId, modeId: selection.modeId }),
    }),
  });
}

async function readFrozenM10AT09Predecessor(workspaceRoot) {
  const frozen = await readCheckpointedFrozenArtifact("M10A-T09", { workspaceRoot });
  if (
    frozen.path !== M10A_T09_ARTIFACT_RELATIVE_PATH ||
    frozen.byteLength !== 5_584 ||
    frozen.sha256 !== "7fecf6a1b5eebb4a132f55e9641b6137b772bd1bb0df7fb380ef9c1f68289d09"
  ) {
    fail("PREDECESSOR_INVALID", "Checkpointed M10A-T09 receipt identity drifted.");
  }
  const artifact = exactPlainRecord(
    parseFrozenPredecessor(Buffer.from(frozen.bytes), "Checkpointed M10A-T09 receipt"),
    [
      "browser",
      "capabilities",
      "claims",
      "historical",
      "nonClaims",
      "package",
      "profile",
      "proofId",
      "result",
      "schemaVersion",
      "task",
      "tests",
    ],
    "Checkpointed M10A-T09 receipt",
    "PREDECESSOR_INVALID",
  );
  const packageReceipt = exactPlainRecord(
    artifact.package,
    ["catalog", "digestProfile", "distBytes", "distFiles", "name", "packageDigest"],
    "Checkpointed M10A-T09 package receipt",
    "PREDECESSOR_INVALID",
  );
  const catalog = exactPlainRecord(
    packageReceipt.catalog,
    ["bytes", "id", "sha256", "target", "version"],
    "Checkpointed M10A-T09 Catalog receipt",
    "PREDECESSOR_INVALID",
  );
  if (
    artifact.schemaVersion !== 1 ||
    artifact.task !== "M10A-T09" ||
    artifact.proofId !== "m10a-t09" ||
    artifact.profile !== "desen.m10a-t09.data-display-feedback.v1" ||
    artifact.result !== "PASS" ||
    packageReceipt.name !== "@desen/starter-catalog-web" ||
    packageReceipt.packageDigest !==
      "sha256:88a1fac65d43d166cbc31dceb890468950f677395ab93a62a382955e16b0c709" ||
    catalog.id !== "run.desen.starter.web" ||
    catalog.version !== "0.6.0" ||
    catalog.target !== "web-react" ||
    catalog.sha256 !== "4e59de0135e7d445bc8c6e029506369bf8b38e40d5df5a57a39f81a799a42a69" ||
    catalog.bytes !== 585_861
  ) {
    fail("PREDECESSOR_INVALID", "Checkpointed M10A-T09 starter Catalog provenance drifted.");
  }
  return Object.freeze({
    artifact: Object.freeze({
      path: frozen.path,
      bytes: frozen.byteLength,
      sha256: frozen.sha256,
    }),
    profile: artifact.profile,
    catalog: Object.freeze({
      id: catalog.id,
      version: catalog.version,
      target: catalog.target,
      sha256: catalog.sha256,
      bytes: catalog.bytes,
      packageDigest: packageReceipt.packageDigest,
    }),
  });
}

async function currentAuthority(workspaceRoot) {
  const [files, catalogBytes, m10aT03, m10aT09] = await Promise.all([
    collectSourceAuthorities(workspaceRoot),
    readWorkspaceFile(workspaceRoot, "packages/starter-catalog-web/catalog.json"),
    readFrozenM10AT03Predecessor(workspaceRoot),
    readFrozenM10AT09Predecessor(workspaceRoot),
  ]);
  return Object.freeze({
    files,
    catalog: parseStarterCatalog(catalogBytes),
    predecessors: Object.freeze({ m10aT03, m10aT09 }),
  });
}

function buildArtifact(authority, browser) {
  return Object.freeze({
    schemaVersion: 1,
    task: "M10A-T12",
    proofId: "m10a-t12",
    profile: "desen.m10a-t12.rich-styling-responsive.v1",
    result: "PASS",
    source: authority,
    browser,
    focusedTests: {
      appFiles: M10A_T12_FOCUSED_APP_TEST_FILES,
      appCommand: `${M10A_T12_FOCUSED_APP_COMMAND.command} ${M10A_T12_FOCUSED_APP_COMMAND.args.join(" ")}`,
      browserCommand: `${M10A_T12_BROWSER_COMMAND.command} ${M10A_T12_BROWSER_COMMAND.args.join(" ")}`,
      rootTestNames: M10A_T12_ROOT_TEST_NAMES,
    },
    claims: {
      normalStarterProfile: true,
      closedVisualCatalog: true,
      typedTokenOrLiteralControls: true,
      resetAndInheritanceIndicators: true,
      boundedResponsivePreviews: true,
      orderedResponsiveOverrides: true,
      normalAggregatePersistence: true,
      twoComponentLevelVisualPresentations: true,
      noJsxCssJsonAuthoring: true,
      unsupportedUnsafeValuesRejected: true,
      namedThemeManagementClaimed: false,
      runtimeCoreChanged: false,
    },
    nonClaims: [
      "T12 proves two component-level visual presentations, not named-theme CRUD, switching, or persistence management.",
      "T12 does not add arbitrary CSS/JSX/JSON authoring, private capability DOM inspection, Runtime activation, Publisher authority, Core/protocol changes, G10A, or M11 behavior.",
      "Local evidence does not substitute for exact-head hosted Quality gate and fresh-main closure.",
    ],
  });
}

async function executeProofCommand(command, workspaceRoot, environment) {
  return new Promise((resolvePromise) => {
    const child = spawn(command.command, command.args, {
      cwd: workspaceRoot,
      env: environment,
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const output = [];
    child.stdout.on("data", (chunk) => output.push(chunk));
    child.stderr.on("data", (chunk) => output.push(chunk));
    child.on("close", (code, signal) =>
      resolvePromise({ code, signal, output: Buffer.concat(output) }),
    );
  });
}

async function runFocusedAppProof(workspaceRoot) {
  const result = await executeProofCommand(
    M10A_T12_FOCUSED_APP_COMMAND,
    workspaceRoot,
    process.env,
  );
  if (result.code !== 0) {
    fail(
      "FOCUSED_APP_EXECUTION_FAILED",
      `T12 focused App proof failed: ${result.output.toString("utf8").slice(-REPORT_LIMIT)}`,
    );
  }
}

async function runBrowserProof(workspaceRoot) {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "desen-m10a-t12-proof-"));
  try {
    const result = await executeProofCommand(M10A_T12_BROWSER_COMMAND, workspaceRoot, {
      ...process.env,
      DESEN_M10A_T12_PROOF_TEMP: temporaryRoot,
    });
    if (result.code !== 0) {
      fail(
        "BROWSER_EXECUTION_FAILED",
        `T12 browser proof failed: ${result.output.toString("utf8").slice(-REPORT_LIMIT)}`,
      );
    }
    const receipt = await readWorkspaceFile(
      temporaryRoot,
      "browser-proof.json",
      "BROWSER_OBSERVATION_MISSING",
    );
    try {
      return parseM10AT12BrowserObservation(JSON.parse(receipt.toString("utf8")));
    } catch (error) {
      if (error instanceof M10AT12ProofError) throw error;
      fail("BROWSER_OBSERVATION_INVALID", "T12 browser proof did not emit valid JSON evidence.");
    }
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

/** Builds deterministic current T12 evidence from source authorities and one passing browser run. */
export async function buildM10AT12Evidence(rawOptions) {
  const options = exactOptions(
    rawOptions,
    ["browserObservation", "workspaceRoot"],
    "M10A-T12 evidence options",
  );
  if (options.browserObservation === undefined) {
    fail("OPTIONS_INVALID", "M10A-T12 evidence requires one browser observation.");
  }
  const workspaceRoot = resolveWorkspaceRoot(options.workspaceRoot);
  const [authority, browser] = await Promise.all([
    currentAuthority(workspaceRoot),
    Promise.resolve(parseM10AT12BrowserObservation(options.browserObservation)),
  ]);
  const artifact = buildArtifact(authority, browser);
  const artifactBytes = Buffer.from(`${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  return Object.freeze({
    artifact,
    artifactBytes,
    artifactSha256: sha256(artifactBytes),
    authority,
  });
}

/** Writes newly captured T12 evidence through one exact atomic destination. */
export async function writeM10AT12Evidence(rawOptions = undefined) {
  const options = exactOptions(
    rawOptions,
    ["artifactPath", "beforeAtomicRename", "browserObservation", "workspaceRoot"],
    "M10A-T12 writer options",
  );
  const workspaceRoot = resolveWorkspaceRoot(options.workspaceRoot);
  if (
    options.beforeAtomicRename !== undefined &&
    (typeof options.beforeAtomicRename !== "function" ||
      utilTypes.isProxy(options.beforeAtomicRename))
  ) {
    fail("OPTIONS_INVALID", "beforeAtomicRename must be one non-Proxy function.");
  }
  const artifactPath = options.artifactPath ?? path.join(workspaceRoot, ARTIFACT_RELATIVE_PATH);
  if (
    typeof artifactPath !== "string" ||
    !path.isAbsolute(artifactPath) ||
    path.resolve(artifactPath) !== artifactPath ||
    artifactPath.includes("\0")
  ) {
    fail("OPTIONS_INVALID", "artifactPath must be one canonical absolute path.");
  }
  const browser =
    options.browserObservation === undefined
      ? await (async () => {
          await runFocusedAppProof(workspaceRoot);
          return runBrowserProof(workspaceRoot);
        })()
      : parseM10AT12BrowserObservation(options.browserObservation);
  const built = await buildM10AT12Evidence({ browserObservation: browser, workspaceRoot });
  try {
    await writeAtomicProofArtifact({
      artifactPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename: options.beforeAtomicRename,
    });
  } catch (error) {
    const detail = error instanceof Error ? `: ${error.message}` : `: ${String(error)}`;
    fail("ARTIFACT_WRITE_UNSAFE", `Atomic T12 evidence write failed${detail}`);
  }
  return Object.freeze({
    artifactPath,
    artifactBytes: built.artifactBytes.byteLength,
    artifactSha256: built.artifactSha256,
    catalogSha256: built.artifact.source.catalog.sha256,
  });
}

/** Rebuilds current T12 evidence and authenticates an exact generated artifact. */
export async function verifyM10AT12Evidence(rawOptions = undefined) {
  const options = exactOptions(
    rawOptions,
    ["artifactBytes", "browserObservation", "workspaceRoot"],
    "M10A-T12 verifier options",
  );
  const workspaceRoot = resolveWorkspaceRoot(options.workspaceRoot);
  const browser =
    options.browserObservation === undefined
      ? await (async () => {
          await runFocusedAppProof(workspaceRoot);
          return runBrowserProof(workspaceRoot);
        })()
      : parseM10AT12BrowserObservation(options.browserObservation);
  const built = await buildM10AT12Evidence({ browserObservation: browser, workspaceRoot });
  const artifactBytes =
    options.artifactBytes ??
    (await readWorkspaceFile(workspaceRoot, ARTIFACT_RELATIVE_PATH, "ARTIFACT_MISSING"));
  if (!Buffer.isBuffer(artifactBytes) || !artifactBytes.equals(built.artifactBytes)) {
    fail("ARTIFACT_DRIFT", "Generated T12 evidence differs from current authorities.");
  }
  return Object.freeze({
    status: "PASS",
    task: "M10A-T12",
    artifactBytes: built.artifactBytes.byteLength,
    artifactSha256: built.artifactSha256,
    catalogSha256: built.artifact.source.catalog.sha256,
    browserTests: built.artifact.browser.tests,
    browserExecutedByVerifier: options.browserObservation === undefined,
    focusedAppExecutedByVerifier: options.browserObservation === undefined,
  });
}
