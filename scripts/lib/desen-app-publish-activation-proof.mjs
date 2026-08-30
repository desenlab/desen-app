import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual, types as utilTypes } from "node:util";

import ts from "typescript";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-publish-activation.json";
const PROOF_DOCUMENT_PATH = "docs/proof/DESEN-APP-PUBLISH-ACTIVATION.md";
const ROOT_PACKAGE_PATH = "package.json";
const APP_PACKAGE_PATH = "apps/desen-app/package.json";
const EDITOR_WEB_PACKAGE_PATH = "packages/editor-web/package.json";
const LOCKFILE_PATH = "pnpm-lock.yaml";
const APPLICATION_COMPATIBILITY_TEST_PATH = "apps/desen-app/test/application.test.tsx";

const SOURCE_PATHS = Object.freeze({
  authoringPreview: "apps/desen-app/src/authoring-preview.ts",
  authoringPublication: "apps/desen-app/src/authoring-publication.ts",
  publicationControls: "apps/desen-app/src/publication-controls.tsx",
  application: "apps/desen-app/src/application.tsx",
  applicationCss: "apps/desen-app/src/application.module.css",
  editorWebPublication: "packages/editor-web/src/local-bundle-channel-publication.ts",
  editorWebIndex: "packages/editor-web/src/index.ts",
  editorWebPublicPackageTypes: "packages/editor-web/test/public-package.types.mts",
});

const TEST_PATHS = Object.freeze({
  authoringPublication: "apps/desen-app/test/authoring-publication.test.ts",
  publicationControls: "apps/desen-app/test/publication-controls.test.tsx",
  publicationApplication: "apps/desen-app/test/publication-application.test.tsx",
  publicationActivationIntegration:
    "apps/desen-app/test/publication-activation-integration.test.ts",
  editorWebPublication: "packages/editor-web/test/local-bundle-channel-publication.test.ts",
  editorWebPublicPackage: "packages/editor-web/test/public-package.mjs",
});

const PARENT_PATHS = Object.freeze({
  modes: "docs/proof/artifacts/desen-app-0.1.0-design-run-modes.json",
  fixtures: "docs/proof/artifacts/desen-app-0.1.0-fixtures-scenarios-fidelity.json",
  persistence: "docs/proof/artifacts/desen-app-0.1.0-source-persistence.json",
  diagnostics: "docs/proof/artifacts/desen-app-0.1.0-node-linked-diagnostics.json",
  publisherGolden: "docs/proof/artifacts/publisher-0.1.0-official-golden.json",
  publisherBundle: "docs/proof/artifacts/publisher-0.1.0-bundle-publication.json",
  controlPlane: "docs/proof/artifacts/control-plane-api-0.1.0-local-api.json",
  referenceHost: "docs/proof/artifacts/reference-host-web-0.1.0-channel-consumption.json",
  g07: "docs/proof/baselines/i07-04-affected-selector-promotion.json",
});

const PROOF_READER_PATHS = Object.freeze([
  "scripts/lib/atomic-proof-artifact.mjs",
  "scripts/lib/desen-app-publish-activation-proof.mjs",
  "scripts/generate-desen-app-publish-activation-proof.mjs",
  "scripts/verify-desen-app-publish-activation.mjs",
  "tests/desen-app-publish-activation.test.mjs",
]);

const TRACKED_PATHS = Object.freeze([
  ROOT_PACKAGE_PATH,
  APP_PACKAGE_PATH,
  EDITOR_WEB_PACKAGE_PATH,
  LOCKFILE_PATH,
  ...Object.values(SOURCE_PATHS),
  ...Object.values(TEST_PATHS),
  APPLICATION_COMPATIBILITY_TEST_PATH,
  ...Object.values(PARENT_PATHS),
  ...PROOF_READER_PATHS,
]);

const SELF_RESEALED_PATHS = Object.freeze([
  "scripts/lib/desen-app-publish-activation-proof.mjs",
  "tests/desen-app-publish-activation.test.mjs",
]);
const PUBLICATION_APPLICATION_TIMEOUT_SUCCESSOR = Object.freeze({
  relationship: "EXACT_TEST_TIMEOUT_HARDENING_SUCCESSOR",
  path: TEST_PATHS.publicationApplication,
  timeoutMilliseconds: 10_000,
  frozen: Object.freeze({
    bytes: 24_485,
    sha256: "52e29b84745ff331556529612015b95b581bf3007118352ebad796ca9541e0e3",
  }),
  current: Object.freeze({
    bytes: 24_493,
    sha256: "5eba8a2b15cbcf992d0f04d0d7ad719c1a9fc42cdb66635ebc0eab679a221901",
  }),
});
const SUCCESSOR_COMPATIBILITY_PATHS = Object.freeze([
  PUBLICATION_APPLICATION_TIMEOUT_SUCCESSOR.path,
  ...SELF_RESEALED_PATHS,
]);
const RETAINED_HISTORICAL_PATHS = Object.freeze(
  TRACKED_PATHS.filter((relativePath) => !SUCCESSOR_COMPATIBILITY_PATHS.includes(relativePath)),
);
const FROZEN_ARTIFACT_PIN = Object.freeze({
  bytes: 24_763,
  sha256: "6bd2db0ca490f1d0046f145da7c4b7e9b4b25ec0f8295a159529a0e66534b23b",
});

const REQUIRED_TEST_NAMES = Object.freeze({
  [TEST_PATHS.authoringPublication]: Object.freeze([
    "captures only the exact route, snapshot, and two-method trusted-host port",
    "blocks every unsaved, unauthorized, dirty, or stale-preview state before host I/O",
    "reruns the public Publisher and emits no bytes when semantic publication rejects",
    "passes exact canonical fresh Bundle bytes, then activates only the fixed preview receipt",
    "retains every exact durable activation relationship, including identical preservation",
    "preserves conflict generation and never activates after a definite channel rejection",
    "reports host LKG preservation with the already-published channel receipt",
    "contains thrown, explicit-indeterminate, and malformed host activation outcomes",
    "fences synchronous reentrant replacement before a channel callback can authorize activation",
    "fences late activation after replacement and after controller disposal",
  ]),
  [TEST_PATHS.publicationControls]: Object.freeze([
    "publishes only an admitted saved generation and explains transient-data isolation",
    "claims Active only with distinct Source, channel, and durable activation receipts",
    "reports channel conflict without presenting reference-host activation",
    "shows a separately preserved last-known-good revision after activation rejection",
    "blocks blind retry after an indeterminate publication result",
  ]),
  [TEST_PATHS.publicationApplication]: Object.freeze([
    "authors, runs, saves, publishes, and visibly activates one exact edited durable revision",
    "single-dispatches pending work and fences persistence, modes, navigation, and authoring mutation",
    "does not ask the reference host to activate a control-plane conflict",
    "shows a mismatched durable host revision only as last-known-good preservation",
    "does not surface late replaced-port or unmounted settlements as current success",
    "keeps persistence and publication independently unavailable without trusted public ports",
  ]),
  [TEST_PATHS.publicationActivationIntegration]: Object.freeze([
    "keeps exact saved Source, Publisher Bundle, fixed channel, and active revision equal",
    "keeps repeated publication unchanged and preserves the durable active revision",
  ]),
  [TEST_PATHS.editorWebPublication]: Object.freeze([
    "publishes to a missing fixed channel in the exact GET, Bundle PUT, channel CAS order",
    "updates and preserves existing channel generations with exact If-Match CAS",
    "returns the exact channel conflict without retrying or overwriting a concurrent winner",
    "distinguishes pre-mutation read failures from Bundle and channel commit ambiguity",
    "keeps malformed or mismatched post-PUT responses indeterminate",
    "rejects non-loopback, active, weak, dynamic-channel, and implicit-fetch configuration",
  ]),
  [TEST_PATHS.editorWebPublicPackage]: Object.freeze([
    "emitted editor-web root has the exact local adapter runtime surface",
    "emitted publication port keeps its channel fixed in trusted configuration",
  ]),
});

const EXPECTED_TEST_DECLARATION_COUNTS = Object.freeze({
  [TEST_PATHS.authoringPublication]: 15,
  [TEST_PATHS.publicationControls]: 8,
  [TEST_PATHS.publicationApplication]: 6,
  [TEST_PATHS.publicationActivationIntegration]: 2,
  [TEST_PATHS.editorWebPublication]: 10,
  [TEST_PATHS.editorWebPublicPackage]: 4,
});

const MAX_AUTHORITY_BYTES = 16 * 1_024 * 1_024;
const READ_FLAGS =
  fileConstants.O_RDONLY | (fileConstants.O_NOFOLLOW ?? 0) | (fileConstants.O_NONBLOCK ?? 0);

/** Exact immutable authorities directly required by M09-T14/G09. */
export const DESEN_APP_PUBLISH_ACTIVATION_PARENT_PINS = Object.freeze([
  Object.freeze({
    task: "M09-T10",
    proofId: "desen-app-design-run-modes",
    path: PARENT_PATHS.modes,
    bytes: 17_900,
    sha256: "bc5b7ffef0c39737882072f9340bcade86f084db8e7923fcb03aa7364d077334",
    profile: "desen.app.design-run-modes-proof.v1",
    result: "PASS",
    immutable: true,
  }),
  Object.freeze({
    task: "M09-T11",
    proofId: "desen-app-fixtures-scenarios-fidelity",
    path: PARENT_PATHS.fixtures,
    bytes: 29_407,
    sha256: "3f08980e687d48ba267f78c7d4dd1ae1eb59db5cc6bb3401d88705ee0416cc9d",
    profile: "desen.app.fixtures-scenarios-fidelity-proof.v1",
    result: "PASS",
    immutable: true,
  }),
  Object.freeze({
    task: "M09-T12",
    proofId: "desen-app-source-persistence",
    path: PARENT_PATHS.persistence,
    bytes: 27_053,
    sha256: "717d0ddada008edb34909d5defcc4c28e95b36f6dfc0b1abb4d09d9775a6b734",
    profile: "desen.app.source-persistence-proof.v1",
    result: "PASS",
    immutable: true,
  }),
  Object.freeze({
    task: "M09-T13",
    proofId: "desen-app-node-linked-diagnostics",
    path: PARENT_PATHS.diagnostics,
    bytes: 29_208,
    sha256: "8ac4d81d9097e188860757c637673ff406ba9f82b8cd8f379f184ef85138e972",
    profile: "desen.app.node-linked-diagnostics-proof.v1",
    result: "PASS",
    immutable: true,
  }),
  Object.freeze({
    task: "M06-T10",
    proofId: null,
    path: PARENT_PATHS.publisherGolden,
    bytes: 13_179,
    sha256: "a2cde9718894b4af506e750d66ea7577d96da4e8a09649f17afe0f94dada17e2",
    profile: "desen.publisher.official-golden-proof.v1",
    result: "PASS",
    immutable: true,
  }),
  Object.freeze({
    task: "M06-T09",
    proofId: null,
    path: PARENT_PATHS.publisherBundle,
    bytes: 17_320,
    sha256: "2942aa84066354ee7c27557263a900eb8fd3a149d085ab55c7f880dcfca998df",
    profile: "desen.publisher.bundle-publication-proof.v1",
    result: "PASS",
    immutable: true,
  }),
  Object.freeze({
    task: "M07-T05",
    proofId: "control-plane-local-api",
    path: PARENT_PATHS.controlPlane,
    bytes: 41_945,
    sha256: "144e8a46b3b41a1f98a022bf4c16dddb9d7415af4e5033322484d4bdd49c55b9",
    profile: "desen.control-plane.local-api-proof.v1",
    result: "PASS",
    immutable: true,
  }),
  Object.freeze({
    task: "M07-T11",
    proofId: "reference-host-web-channel-consumption",
    path: PARENT_PATHS.referenceHost,
    bytes: 39_307,
    sha256: "48bd9f85bd2da413fc72c1973a33732cc091796f9afc2863ec1eec15054314e0",
    profile: "desen.reference-host-web.channel-consumption-proof.v1",
    result: "PASS",
    immutable: true,
  }),
  Object.freeze({
    task: "I07-04",
    proofId: null,
    path: PARENT_PATHS.g07,
    bytes: 88_341,
    sha256: "76a29908843c0bb9a4ca5ad74b5bc94383c3fa21463ce81e98bf53e8f01d7549",
    profile: "desen.ci.affected-selector-promotion-evidence.v1",
    result: "HOSTED_CUTOVER_VERIFIED",
    immutable: true,
  }),
]);

/** Exact reviewed declarations across the six focused M09-T14 test files. */
export const DESEN_APP_PUBLISH_ACTIVATION_FOCUSED_TEST_DECLARATIONS = 45;

/** Independent root-test names retained in the M09-T14 artifact. */
export const DESEN_APP_PUBLISH_ACTIVATION_ROOT_TEST_NAMES = Object.freeze([
  "[authority] authenticates exact App, Publisher, control-plane, reference-host, and G07 parents",
  "[source] reruns the public Publisher from the exact saved authored Source only",
  "[transients] excludes scenarios, fixtures, operation inputs, and rejected diagnostics",
  "[publication] sends exact Bundle bytes before fixed-channel compare-and-set",
  "[activation] distinguishes Source, channel, and durable activation generations",
  "[containment] preserves last-known-good activation and fences stale or uncertain work",
  "[boundary] keeps Node control-plane and reference-host packages outside browser App imports",
  "[integration] exercises real public control-plane and reference-host channel consumption",
  "[tests] retains exact focused source-level semantic evidence",
  "[determinism] builds byte-identical detached evidence twice",
  "[policy] rejects source, test, package, and linked-path weakening",
  "[verification] rejects parent, artifact, report, destination, and option drift",
]);

/** Default destination for deterministic M09-T14/G09 evidence. */
export const DEFAULT_DESEN_APP_PUBLISH_ACTIVATION_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_PATH,
);

/** Stable fail-closed error raised by the M09-T14 evidence reader. */
export class DesenAppPublishActivationProofError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "DesenAppPublishActivationProofError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details = {}) {
  throw new DesenAppPublishActivationProofError(code, message, details);
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

function canonicalArtifactBytes(artifact) {
  let text = JSON.stringify(artifact, null, 2);
  const compactArrays = Object.freeze([
    Object.freeze({
      expanded: `        "publicationControls": [
          "react",
          "./application.module.css"
        ],`,
      compact: '        "publicationControls": ["react", "./application.module.css"],',
    }),
    Object.freeze({
      expanded: `        "editorWebPublication": [
          "./local-source-json.js"
        ],`,
      compact: '        "editorWebPublication": ["./local-source-json.js"],',
    }),
    Object.freeze({
      expanded: `        "editorWebPublicPackageTypes": [
          "@desen/editor-web",
          "@desen/editor-web"
        ]`,
      compact: '        "editorWebPublicPackageTypes": ["@desen/editor-web", "@desen/editor-web"]',
    }),
  ]);
  for (const { expanded, compact } of compactArrays) {
    if (text.split(expanded).length !== 2) {
      fail("ARTIFACT_FORMAT_DRIFT", "Expected one reviewed Prettier JSON compaction target.");
    }
    text = text.replace(expanded, compact);
  }
  return Buffer.from(`${text}\n`);
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
    if (typeof key !== "string" || !allowedKeys.includes(key)) {
      fail("OPTIONS_INVALID", `${label} contains an unknown or symbol field.`);
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      fail("OPTIONS_INVALID", `${label}.${key} must be enumerable own data.`);
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
    utilTypes.isSharedArrayBuffer(value.buffer)
  ) {
    fail("OPTIONS_INVALID", `${label} must be exact non-shared bytes.`);
  }
  return Buffer.from(value);
}

function captureOverrides(value) {
  if (value === undefined) return Object.freeze(new Map());
  if (!(value instanceof Map) || utilTypes.isProxy(value) || value.size > TRACKED_PATHS.length) {
    fail("OPTIONS_INVALID", "fileOverrides must be one bounded Map.");
  }
  const captured = new Map();
  for (const [relativePath, bytes] of value) {
    if (!TRACKED_PATHS.includes(relativePath) || captured.has(relativePath)) {
      fail("OPTIONS_INVALID", "fileOverrides contains an unknown or duplicate path.", {
        path: relativePath,
      });
    }
    captured.set(relativePath, captureBytes(bytes, `fileOverrides[${relativePath}]`));
  }
  return Object.freeze(captured);
}

function captureBuildOptions(value) {
  const options = exactOwnDataOptions(value, ["fileOverrides", "workspaceRoot"], "build options");
  return Object.freeze({
    workspaceRoot: capturePath(options.workspaceRoot, "workspaceRoot", WORKSPACE_ROOT),
    fileOverrides: captureOverrides(options.fileOverrides),
  });
}

async function readRegularAuthority(absolutePath, label) {
  let entry;
  try {
    entry = await lstat(absolutePath);
  } catch (error) {
    fail("AUTHORITY_UNREADABLE", `${label} could not be inspected.`, { cause: String(error) });
  }
  if (!entry.isFile() || entry.size > MAX_AUTHORITY_BYTES) {
    fail("AUTHORITY_UNSAFE", `${label} must be one bounded regular file.`);
  }
  let canonical;
  try {
    canonical = await realpath(absolutePath);
  } catch (error) {
    fail("AUTHORITY_UNREADABLE", `${label} could not be resolved.`, { cause: String(error) });
  }
  if (canonical !== absolutePath) {
    fail("AUTHORITY_UNSAFE", `${label} must not resolve through a linked path.`);
  }
  let handle;
  try {
    handle = await open(absolutePath, READ_FLAGS);
    const opened = await handle.stat();
    if (!opened.isFile() || opened.dev !== entry.dev || opened.ino !== entry.ino) {
      fail("AUTHORITY_UNSAFE", `${label} changed identity while opening.`);
    }
    const bytes = await handle.readFile();
    if (bytes.byteLength > MAX_AUTHORITY_BYTES) {
      fail("AUTHORITY_UNSAFE", `${label} exceeded its byte ceiling.`);
    }
    return bytes;
  } catch (error) {
    if (error instanceof DesenAppPublishActivationProofError) throw error;
    fail("AUTHORITY_UNREADABLE", `${label} could not be read safely.`, { cause: String(error) });
  } finally {
    await handle?.close();
  }
}

async function readTrackedFiles(workspaceRoot, overrides) {
  const files = new Map();
  for (const relativePath of TRACKED_PATHS) {
    files.set(
      relativePath,
      overrides.get(relativePath) ??
        (await readRegularAuthority(path.join(workspaceRoot, relativePath), relativePath)),
    );
  }
  return files;
}

function decodeUtf8(bytes, label) {
  const value = Buffer.from(bytes).toString("utf8");
  if (value.includes("\0") || !Buffer.from(value, "utf8").equals(Buffer.from(bytes))) {
    fail("SOURCE_POLICY_VIOLATION", `${label} must be exact UTF-8 text.`);
  }
  return value;
}

function parseJson(bytes, label, code = "SOURCE_POLICY_VIOLATION") {
  try {
    return JSON.parse(decodeUtf8(bytes, label));
  } catch (error) {
    fail(code, `${label} must be exact JSON.`, { cause: String(error) });
  }
}

function assertIncludes(source, markers, label, code = "SOURCE_POLICY_VIOLATION") {
  const missing = markers.filter((marker) => !source.includes(marker));
  if (missing.length !== 0) {
    fail(code, `${label} lost required M09-T14 policy.`, { missing });
  }
}

function assertExcludes(source, markers, label, code = "SOURCE_POLICY_VIOLATION") {
  const present = markers.filter((marker) => source.includes(marker));
  if (present.length !== 0) {
    fail(code, `${label} acquired forbidden M09-T14 authority.`, { present });
  }
}

function parseTypeScript(source, relativePath, code = "SOURCE_POLICY_VIOLATION") {
  const sourceFile = ts.createSourceFile(
    relativePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    relativePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  if (sourceFile.parseDiagnostics.length !== 0) {
    fail(code, `${relativePath} must parse as TypeScript.`);
  }
  return sourceFile;
}

function inspectImports(source, relativePath) {
  const sourceFile = parseTypeScript(source, relativePath);
  const imports = [];
  const visit = (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.push(node.moduleSpecifier.text);
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      fail("SOURCE_POLICY_VIOLATION", `${relativePath} acquired dynamic import authority.`);
    }
    node.forEachChild(visit);
  };
  visit(sourceFile);
  return Object.freeze(imports);
}

function interfaceProperties(source, relativePath, interfaceName) {
  const sourceFile = parseTypeScript(source, relativePath);
  let properties;
  const visit = (node) => {
    if (ts.isInterfaceDeclaration(node) && node.name.text === interfaceName) {
      if (properties !== undefined) {
        fail("SOURCE_POLICY_VIOLATION", `${relativePath} duplicated ${interfaceName}.`);
      }
      properties = node.members.map((member) =>
        member.name !== undefined && ts.isIdentifier(member.name) ? member.name.text : null,
      );
    }
    node.forEachChild(visit);
  };
  visit(sourceFile);
  if (properties === undefined || properties.includes(null)) {
    fail("SOURCE_POLICY_VIOLATION", `${relativePath} lost exact ${interfaceName} fields.`);
  }
  return Object.freeze([...properties].sort());
}

function captureSourcePolicyInput(rawInput) {
  const keys = Object.keys(SOURCE_PATHS);
  const input = exactOwnDataOptions(rawInput, keys, "source policy input");
  const captured = Object.create(null);
  for (const key of keys) {
    if (typeof input[key] !== "string") {
      fail("OPTIONS_INVALID", `source policy input.${key} must be UTF-8 text.`);
    }
    captured[key] = input[key];
  }
  return Object.freeze(captured);
}

/** Verifies the complete saved-Source-to-active-reference-host M09-T14 boundary. */
export function verifyDesenAppPublishActivationSourcePolicy(rawInput) {
  const input = captureSourcePolicyInput(rawInput);
  const imports = Object.fromEntries(
    Object.entries(SOURCE_PATHS)
      .filter(
        ([, relativePath]) =>
          relativePath.endsWith(".ts") ||
          relativePath.endsWith(".tsx") ||
          relativePath.endsWith(".mts"),
      )
      .map(([key, relativePath]) => [key, inspectImports(input[key], relativePath)]),
  );

  for (const key of [
    "authoringPreview",
    "authoringPublication",
    "publicationControls",
    "application",
  ]) {
    const forbidden = imports[key].filter(
      (specifier) =>
        specifier.startsWith("node:") ||
        specifier === "@desen/control-plane-api" ||
        specifier === "@desen/reference-host-web-server" ||
        specifier === "@desen/reference-host-web" ||
        (specifier.startsWith("@desen/") && specifier.includes("/src/")),
    );
    if (forbidden.length !== 0) {
      fail(
        "SOURCE_POLICY_VIOLATION",
        `${SOURCE_PATHS[key]} crossed the browser/Node composition boundary.`,
        { forbidden },
      );
    }
  }

  assertIncludes(
    input.authoringPreview,
    [
      'import { publishDesenSource } from "@desen/publisher"',
      "createDesenEditorDocument(document)",
      "JSON.stringify(admitted.document)",
      "publishDesenSource(rawSource, REFERENCE_CATALOG_PACKAGES)",
      "bundle: published.bundle",
      "revision: published.bundle.revision",
    ],
    SOURCE_PATHS.authoringPreview,
  );
  assertExcludes(
    input.authoringPreview,
    ["scenarioDocument", "effectiveDocument", "operationInput", "password:"],
    SOURCE_PATHS.authoringPreview,
  );

  assertIncludes(
    input.authoringPublication,
    [
      'export const AUTHORING_PUBLICATION_CHANNEL = "preview" as const',
      'const PORT_KEYS = Object.freeze(["activateReferenceHost", "publishBundleToChannel"])',
      '"savedDocument"',
      '"sourceGeneration"',
      "capturedSnapshot.canonicalDocument !== capturedSnapshot.canonicalSavedDocument",
      "prepareAuthoringPreviewBundle(capturedSnapshot.snapshot.document)",
      "freshPreview.revision !== capturedSnapshot.snapshot.previewRevision",
      "bundleBytes = canonicalizeJsonBytes(freshPreview.bundle)",
      "channelName: AUTHORING_PUBLICATION_CHANNEL",
      "publishBundleToChannel(",
      "activateReferenceHost(",
      "channelGeneration",
      "activationGeneration",
      "operationIsCurrent(token, version)",
      'publicationIndeterminate("control-plane"',
      '"reference-host",',
      '"reference-host-failed",',
      '"reference-host-unavailable",',
      "lastKnownGoodPreserved",
      '"stale-operation"',
    ],
    SOURCE_PATHS.authoringPublication,
  );
  assertExcludes(
    input.authoringPublication,
    ["globalThis.fetch", "window.fetch", "scenarioDocument", "fixtureDocument", "operationInput:"],
    SOURCE_PATHS.authoringPublication,
  );
  const snapshotProperties = interfaceProperties(
    input.authoringPublication,
    SOURCE_PATHS.authoringPublication,
    "AuthoringPublicationSnapshot",
  );
  if (
    !isDeepStrictEqual(snapshotProperties, [
      "document",
      "persistenceAuthority",
      "previewRevision",
      "savedDocument",
      "sourceGeneration",
    ])
  ) {
    fail("SOURCE_POLICY_VIOLATION", "Publication snapshot widened beyond authored Source state.", {
      snapshotProperties,
    });
  }
  const requestProperties = interfaceProperties(
    input.authoringPublication,
    SOURCE_PATHS.authoringPublication,
    "AuthoringControlPlanePublicationRequest",
  );
  if (!isDeepStrictEqual(requestProperties, ["bundleBytes", "revision"])) {
    fail("SOURCE_POLICY_VIOLATION", "Control-plane publication request widened.", {
      requestProperties,
    });
  }

  assertIncludes(
    input.publicationControls,
    [
      'readonly channelName: "preview"',
      'aria-label="Publish saved Source"',
      'aria-label="Publication stages"',
      "Only the exact saved Source is published. Preview scenarios and fixture data stay local.",
      'status.state === "indeterminate"',
      "status.sourceGeneration",
      "status.channelGeneration",
      "status.activationGeneration",
      "preserved",
      "last known good",
    ],
    SOURCE_PATHS.publicationControls,
  );

  assertIncludes(
    input.editorWebPublication,
    [
      "createLocalDesenBundleChannelPublicationPort",
      "readonly channelName: string",
      "readonly bundleBytes: Readonly<Uint8Array>",
      'readonly status: "indeterminate"',
      'phase: "bundle-write"',
      'phase: "channel-write"',
      '"if-none-match": "*"',
      '`"g:${String(expectedGeneration)}"`',
      "`${options.origin}/v1/channels/${options.channelName}`",
      "`${options.origin}/v1/bundles/${revision}`",
      "body: new Uint8Array(request.bundleBytes)",
      "captured.fetch(",
      'status: "conflict"',
    ],
    SOURCE_PATHS.editorWebPublication,
  );
  assertExcludes(
    input.editorWebPublication,
    ["globalThis.fetch", "window.fetch", "fetch.bind", "request.channelName"],
    SOURCE_PATHS.editorWebPublication,
  );
  const adapterRequestProperties = interfaceProperties(
    input.editorWebPublication,
    SOURCE_PATHS.editorWebPublication,
    "LocalDesenBundleChannelPublicationRequest",
  );
  if (!isDeepStrictEqual(adapterRequestProperties, ["bundleBytes", "revision"])) {
    fail("SOURCE_POLICY_VIOLATION", "Editor Web request acquired channel-selection authority.", {
      adapterRequestProperties,
    });
  }

  assertIncludes(
    input.editorWebIndex,
    [
      "createLocalDesenBundleChannelPublicationPort",
      "LocalDesenBundleChannelPublicationPort",
      'from "./local-bundle-channel-publication.js"',
    ],
    SOURCE_PATHS.editorWebIndex,
  );
  assertExcludes(
    input.editorWebIndex,
    ["control-plane-api", "reference-host-web-server"],
    SOURCE_PATHS.editorWebIndex,
  );
  assertIncludes(
    input.editorWebPublicPackageTypes,
    [
      'from "@desen/editor-web"',
      "createLocalDesenBundleChannelPublicationPort",
      "LocalDesenBundleChannelPublicationOptions",
      "LocalDesenBundleChannelPublicationResult",
      "publishBundleToChannel",
      "@ts-expect-error",
    ],
    SOURCE_PATHS.editorWebPublicPackageTypes,
  );

  assertIncludes(
    input.application,
    [
      'import { createAuthoringPublicationController } from "./authoring-publication.js"',
      'import { PublicationControls } from "./publication-controls.js"',
      "readonly publicationPort?: AuthoringPublicationPort | null",
      "publicationPort === null",
      "createAuthoringPublicationController({",
      "publicationController?.subscribe ?? subscribeUnavailablePublication",
      "publicationController?.read ?? readUnavailablePublication",
      "publicationController.replaceSnapshot(readCurrentPublicationSnapshot())",
      "void publicationController.publish()",
      "savedDocument: livePersistence?.savedDocument ?? null",
      "sourceGeneration: livePersistence?.generation ?? null",
      "previewRevision: preview.ok ? preview.revision : UNAVAILABLE_PREVIEW_REVISION",
      'channelName: "preview"',
      'state: "indeterminate"',
      'state: "preserved"',
      'state: "stale"',
      "publicationPending",
      "<PublicationControls",
      "onPublish={publishSavedSource}",
      "publicationPort={publicationPort}",
    ],
    SOURCE_PATHS.application,
  );
  assertIncludes(
    input.applicationCss,
    [
      ".publicationControls",
      ".publicationHeading",
      ".publicationStages",
      ".publicationStatus",
      ".publicationAdmission",
      ".publicationReceipt",
    ],
    SOURCE_PATHS.applicationCss,
  );

  return deepFreeze({
    imports,
    publicPublisherRootOnly: true,
    savedAuthoredSourceOnly: true,
    transientScenarioFixtureOperationAndDiagnosticsExcluded: true,
    publisherRerunBeforePublication: true,
    exactBundleBytesForwarded: true,
    fixedPreviewChannel: true,
    channelCompareAndSet: true,
    sourceChannelAndActivationGenerationsDistinct: true,
    staleOperationFenced: true,
    indeterminateOutcomeBlocksBlindAuthority: true,
    lastKnownGoodActivationPreserved: true,
    browserAppImportsNodeCompositionPackages: false,
    editorWebUsesInjectedFetchOnly: true,
  });
}

function staticTestName(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return undefined;
}

function inspectTestFile(source, relativePath) {
  const sourceFile = parseTypeScript(source, relativePath, "TEST_POLICY_VIOLATION");
  const names = [];
  const imports = [];
  let declarations = 0;
  const visit = (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.push(node.moduleSpecifier.text);
    }
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      ["it", "test"].includes(node.expression.text)
    ) {
      declarations += 1;
      const name = node.arguments[0] === undefined ? undefined : staticTestName(node.arguments[0]);
      if (name !== undefined) names.push(name);
    }
    node.forEachChild(visit);
  };
  visit(sourceFile);
  return Object.freeze({
    declarations,
    names: Object.freeze(names),
    imports: Object.freeze(imports),
  });
}

function inspectTests(files) {
  const inventories = Object.fromEntries(
    Object.values(TEST_PATHS).map((relativePath) => [
      relativePath,
      inspectTestFile(decodeUtf8(files.get(relativePath), relativePath), relativePath),
    ]),
  );
  for (const [relativePath, requiredNames] of Object.entries(REQUIRED_TEST_NAMES)) {
    const inventory = inventories[relativePath];
    if (inventory.declarations !== EXPECTED_TEST_DECLARATION_COUNTS[relativePath]) {
      fail("TEST_POLICY_VIOLATION", `${relativePath} exact test inventory drifted.`, {
        expected: EXPECTED_TEST_DECLARATION_COUNTS[relativePath],
        actual: inventory.declarations,
      });
    }
    const missing = requiredNames.filter((name) => !inventory.names.includes(name));
    if (missing.length !== 0) {
      fail("TEST_POLICY_VIOLATION", `${relativePath} lost required semantic tests.`, { missing });
    }
  }
  const integration = inventories[TEST_PATHS.publicationActivationIntegration];
  const integrationImports = integration.imports;
  for (const authority of [
    "@desen/control-plane-api",
    "@desen/editor-web",
    "@desen/reference-host-web-server",
  ]) {
    if (!integrationImports.includes(authority)) {
      fail("TEST_POLICY_VIOLATION", "Real integration lost a public package authority.", {
        authority,
      });
    }
  }
  if (
    integrationImports.some(
      (specifier) => specifier.startsWith("@desen/") && specifier.includes("/src/"),
    )
  ) {
    fail("TEST_POLICY_VIOLATION", "Real integration crossed a private package seam.");
  }
  const integrationSource = decodeUtf8(
    files.get(TEST_PATHS.publicationActivationIntegration),
    TEST_PATHS.publicationActivationIntegration,
  );
  assertIncludes(
    integrationSource,
    [
      "openLocalControlPlane",
      "createLocalDesenBundleChannelPublicationPort",
      "openReferenceHostChannelActivationController",
      "AUTHORING_PUBLICATION_CHANNEL",
      "channelGeneration",
      "activationGeneration",
      "activeRevision",
    ],
    TEST_PATHS.publicationActivationIntegration,
    "TEST_POLICY_VIOLATION",
  );
  const declarationCounts = Object.fromEntries(
    Object.entries(inventories).map(([relativePath, inventory]) => [
      relativePath,
      inventory.declarations,
    ]),
  );
  const focusedTestDeclarations = Object.values(declarationCounts).reduce(
    (total, count) => total + count,
    0,
  );
  if (focusedTestDeclarations !== DESEN_APP_PUBLISH_ACTIVATION_FOCUSED_TEST_DECLARATIONS) {
    fail("TEST_POLICY_VIOLATION", "The exact focused M09-T14 declaration count drifted.");
  }
  return deepFreeze({
    command:
      "pnpm --filter @desen/editor-web test:publication && pnpm --filter @desen/editor-web test:public-package && pnpm --filter @desen/app-web test:publication && node --test tests/desen-app-publish-activation.test.mjs",
    focusedFiles: Object.values(TEST_PATHS),
    testDeclarationCounts: declarationCounts,
    focusedTestDeclarations,
    requiredTestNames: REQUIRED_TEST_NAMES,
    rootTestNames: DESEN_APP_PUBLISH_ACTIVATION_ROOT_TEST_NAMES,
    realPublicIntegration: true,
  });
}

function inspectPackages(files) {
  const root = parseJson(
    files.get(ROOT_PACKAGE_PATH),
    ROOT_PACKAGE_PATH,
    "PACKAGE_POLICY_VIOLATION",
  );
  const app = parseJson(files.get(APP_PACKAGE_PATH), APP_PACKAGE_PATH, "PACKAGE_POLICY_VIOLATION");
  const editorWeb = parseJson(
    files.get(EDITOR_WEB_PACKAGE_PATH),
    EDITOR_WEB_PACKAGE_PATH,
    "PACKAGE_POLICY_VIOLATION",
  );
  if (app.name !== "@desen/app-web" || editorWeb.name !== "@desen/editor-web") {
    fail("PACKAGE_POLICY_VIOLATION", "The App or Editor Web package identity drifted.");
  }
  if (
    editorWeb.scripts?.["test:publication"] !==
    "vitest run test/local-bundle-channel-publication.test.ts"
  ) {
    fail("PACKAGE_POLICY_VIOLATION", "Editor Web lost its exact publication test command.");
  }
  const appCommand = app.scripts?.["test:publication"];
  if (
    typeof appCommand !== "string" ||
    !Object.values(TEST_PATHS)
      .filter((relativePath) => relativePath.startsWith("apps/desen-app/test/"))
      .every((relativePath) => appCommand.includes(path.basename(relativePath)))
  ) {
    fail("PACKAGE_POLICY_VIOLATION", "Desen App lost the complete publication test command.");
  }
  if (app.dependencies?.["@desen/publisher"] !== "workspace:*") {
    fail("PACKAGE_POLICY_VIOLATION", "Desen App lost public Publisher authority.");
  }
  const rootCommands = Object.freeze({
    generate: root.scripts?.["generate:desen-app-publish-activation"],
    verify: root.scripts?.["verify:desen-app-publish-activation"],
    test: root.scripts?.["test:desen-app-publish-activation"],
  });
  const requiredSuffixes = Object.freeze({
    generate: "node scripts/generate-desen-app-publish-activation-proof.mjs",
    verify: "node scripts/verify-desen-app-publish-activation.mjs",
    test: "node --test tests/desen-app-publish-activation.test.mjs",
  });
  for (const [kind, suffix] of Object.entries(requiredSuffixes)) {
    if (typeof rootCommands[kind] !== "string" || !rootCommands[kind].endsWith(suffix)) {
      fail("PACKAGE_POLICY_VIOLATION", `Root ${kind} publication command drifted.`);
    }
  }
  return deepFreeze({
    appName: app.name,
    appTestCommand: appCommand,
    editorWebName: editorWeb.name,
    editorWebTestCommand: editorWeb.scripts["test:publication"],
    publisherDependency: "workspace:*",
    rootPackageName: root.name,
    rootCommands,
  });
}

function authenticateParent(bytes, pin) {
  if (bytes.byteLength !== pin.bytes || sha256(bytes) !== pin.sha256) {
    fail("PARENT_DRIFT", `The exact frozen ${pin.task} parent authority changed.`);
  }
  const artifact = parseJson(bytes, `frozen ${pin.task} parent`, "PARENT_DRIFT");
  if (
    artifact.task !== pin.task ||
    (artifact.proofId ?? null) !== pin.proofId ||
    artifact.profile !== pin.profile
  ) {
    fail("PARENT_DRIFT", `The frozen ${pin.task} identity drifted.`);
  }
  if (pin.task === "I07-04") {
    if (
      artifact.cutover?.status !== pin.result ||
      artifact.cutover?.cleanup?.status !== "PASS" ||
      artifact.cutover?.main?.status !== "PASS" ||
      artifact.cutover?.affectedCanary?.status !== "PASS" ||
      artifact.cutover?.proofReaderCheckpoint?.liveVerification !== "PASS" ||
      artifact.cutover?.infrastructureDebt?.status !== "CLOSED"
    ) {
      fail("PARENT_DRIFT", "The frozen I07-04/G07 hosted promotion authority drifted.");
    }
    return pin;
  }
  if (artifact.result !== pin.result) {
    fail("PARENT_DRIFT", `The frozen ${pin.task} result drifted.`);
  }
  if (
    pin.task.startsWith("M09-") &&
    (artifact.claim?.taskStatus !== "DONE" || artifact.claim?.publicationClaimed !== false)
  ) {
    fail("PARENT_DRIFT", `The frozen ${pin.task} App predecessor boundary drifted.`);
  }
  if (
    pin.task === "M09-T11" &&
    (artifact.claim?.authoredSourceAndPublishablePreviewUnchanged !== true ||
      artifact.claim?.operationInputOrPasswordRetained !== false)
  ) {
    fail("PARENT_DRIFT", "The frozen fixture/scenario transient boundary drifted.");
  }
  if (
    pin.task === "M09-T12" &&
    (artifact.claim?.authoredSourceOnly !== true ||
      artifact.claim?.completeAuthoredSourceCanonicalDirtyComparison !== true)
  ) {
    fail("PARENT_DRIFT", "The frozen saved authored Source authority drifted.");
  }
  if (
    pin.task === "M09-T13" &&
    (artifact.claim?.rejectedDiagnosticsPersisted !== false ||
      artifact.claim?.lastKnownGoodPreviewPreserved !== true)
  ) {
    fail("PARENT_DRIFT", "The frozen diagnostics containment boundary drifted.");
  }
  if (
    pin.task === "M06-T10" &&
    (artifact.claims?.publicDoublePublication?.comparisons?.firstEqualsOfficialCanonicalBytes !==
      true ||
      artifact.claims?.publicDoublePublication?.privatePublisherSeamsAbsent !== true)
  ) {
    fail("PARENT_DRIFT", "The frozen official Publisher golden authority drifted.");
  }
  if (
    pin.task === "M06-T09" &&
    (artifact.claims?.publicApi?.sourceExports?.[0] !== "publishDesenSource" ||
      artifact.claims?.singleOfficialInputPublicRuntimeProbe?.revisionClosed !== true ||
      artifact.claims?.singleOfficialInputPublicRuntimeProbe?.publicationAbsent !== true)
  ) {
    fail("PARENT_DRIFT", "The frozen public Bundle publication authority drifted.");
  }
  if (
    pin.task === "M07-T05" &&
    (artifact.claims?.publicFactory?.export !== "openLocalControlPlane" ||
      artifact.claims?.immutableBundles?.exactM07T01FirstWriterSemanticsRetained !== true ||
      artifact.claims?.mutableChannel?.activationFieldsAbsent !== true)
  ) {
    fail("PARENT_DRIFT", "The frozen control-plane local API authority drifted.");
  }
  if (
    pin.task === "M07-T11" &&
    (artifact.claims?.compositionBoundary?.serverImportsOnlyPublicControlPlaneRoot !== true ||
      artifact.claims?.compositionBoundary?.browserImportsNoControlPlaneOrSecretAuthority !== true)
  ) {
    fail("PARENT_DRIFT", "The frozen reference-host channel-consumption authority drifted.");
  }
  return pin;
}

function receipts(files) {
  return [...files.entries()]
    .sort(([left], [right]) => left.localeCompare(right, "en-US"))
    .map(([relativePath, bytes]) =>
      Object.freeze({ path: relativePath, bytes: bytes.byteLength, sha256: sha256(bytes) }),
    );
}

async function authenticateFrozenArtifact(workspaceRoot) {
  const artifactBytes = await readRegularAuthority(
    path.join(workspaceRoot, ARTIFACT_PATH),
    "frozen M09-T14/G09 proof artifact",
  );
  if (
    artifactBytes.byteLength !== FROZEN_ARTIFACT_PIN.bytes ||
    sha256(artifactBytes) !== FROZEN_ARTIFACT_PIN.sha256
  ) {
    fail(
      "ARTIFACT_DRIFT",
      "The frozen M09-T14/G09 artifact bytes differ from their exact receipt.",
    );
  }
  const artifact = parseJson(artifactBytes, "frozen M09-T14/G09 proof artifact", "ARTIFACT_DRIFT");
  const trackedReceipts = artifact.boundary?.trackedReceipts;
  const receiptPaths = Array.isArray(trackedReceipts)
    ? trackedReceipts.map((candidate) => candidate?.path)
    : [];
  if (
    artifact.schemaVersion !== 1 ||
    artifact.proofId !== "desen-app-publish-activation" ||
    artifact.profile !== "desen.app.publish-activation-proof.v1" ||
    artifact.task !== "M09-T14" ||
    artifact.gate !== "G09" ||
    artifact.result !== "PASS" ||
    artifact.claim?.taskStatus !== "DONE" ||
    artifact.claim?.gateStatus !== "DONE" ||
    artifact.claim?.savedAuthoredSourceOnly !== true ||
    artifact.claim?.publisherRerunFromSavedSource !== true ||
    artifact.claim?.exactCanonicalBundleBytesStored !== true ||
    artifact.claim?.fixedPreviewChannelCompareAndSet !== true ||
    artifact.claim?.activeRevisionRequiresReferenceHostReceipt !== true ||
    artifact.claim?.staleCompletionCanBecomeActive !== false ||
    artifact.claim?.blindRetryAfterIndeterminate !== false ||
    artifact.claim?.conflictActivatesCandidate !== false ||
    artifact.claim?.lastKnownGoodActivationPreserved !== true ||
    artifact.tests?.focusedTestDeclarations !==
      DESEN_APP_PUBLISH_ACTIVATION_FOCUSED_TEST_DECLARATIONS ||
    artifact.tests?.rootTestNames?.length !== DESEN_APP_PUBLISH_ACTIVATION_ROOT_TEST_NAMES.length ||
    artifact.boundary?.trackedFiles !== TRACKED_PATHS.length ||
    artifact.boundary?.parentArtifacts !== DESEN_APP_PUBLISH_ACTIVATION_PARENT_PINS.length ||
    trackedReceipts?.length !== TRACKED_PATHS.length ||
    !isDeepStrictEqual(
      receiptPaths,
      [...receiptPaths].sort((left, right) => left.localeCompare(right, "en-US")),
    ) ||
    !isDeepStrictEqual(artifact.prerequisites, DESEN_APP_PUBLISH_ACTIVATION_PARENT_PINS) ||
    !isDeepStrictEqual(artifact.tests?.rootTestNames, DESEN_APP_PUBLISH_ACTIVATION_ROOT_TEST_NAMES)
  ) {
    fail("ARTIFACT_DRIFT", "The frozen M09-T14/G09 identity or retained claims drifted.");
  }
  return deepFreeze({
    artifact,
    artifactBytes: Buffer.from(artifactBytes),
    artifactSha256: FROZEN_ARTIFACT_PIN.sha256,
  });
}

function assertRetainedHistoricalReceipts(frozenArtifact, files) {
  const receiptMap = new Map(
    frozenArtifact.boundary.trackedReceipts.map((candidate) => [candidate.path, candidate]),
  );
  for (const relativePath of RETAINED_HISTORICAL_PATHS) {
    const receipt = receiptMap.get(relativePath);
    const bytes = files.get(relativePath);
    if (
      receipt === undefined ||
      bytes === undefined ||
      receipt.bytes !== bytes.byteLength ||
      receipt.sha256 !== sha256(bytes)
    ) {
      fail("BOUNDARY_DRIFT", `A retained M09-T14 task-time receipt drifted: ${relativePath}.`);
    }
  }
}

function authenticatePublicationApplicationTimeoutSuccessor(frozenArtifact, files) {
  const policy = PUBLICATION_APPLICATION_TIMEOUT_SUCCESSOR;
  const frozenReceipt = frozenArtifact.boundary.trackedReceipts.find(
    (candidate) => candidate.path === policy.path,
  );
  if (
    frozenReceipt?.bytes !== policy.frozen.bytes ||
    frozenReceipt?.sha256 !== policy.frozen.sha256
  ) {
    fail(
      "ARTIFACT_DRIFT",
      "The frozen publication-application test receipt differs from the reviewed predecessor.",
    );
  }
  const currentBytes = files.get(policy.path);
  if (
    currentBytes?.byteLength !== policy.current.bytes ||
    sha256(currentBytes ?? Buffer.alloc(0)) !== policy.current.sha256
  ) {
    fail(
      "TEST_TIMEOUT_SUCCESSOR_DRIFT",
      "The live publication-application timeout hardening differs from its exact successor receipt.",
    );
  }
  const currentSource = decodeUtf8(currentBytes, policy.path);
  const currentMarker = "  }, 10_000);\n";
  const frozenMarker = "  });\n";
  if (currentSource.split(currentMarker).length !== 2) {
    fail(
      "TEST_TIMEOUT_SUCCESSOR_DRIFT",
      "The live publication-application test must contain one exact reviewed timeout boundary.",
    );
  }
  const projectedFrozenBytes = Buffer.from(currentSource.replace(currentMarker, frozenMarker));
  if (
    projectedFrozenBytes.byteLength !== policy.frozen.bytes ||
    sha256(projectedFrozenBytes) !== policy.frozen.sha256
  ) {
    fail(
      "TEST_TIMEOUT_SUCCESSOR_DRIFT",
      "Removing the reviewed timeout boundary did not reconstruct the frozen test bytes.",
    );
  }
  return deepFreeze({
    relationship: policy.relationship,
    path: policy.path,
    timeoutMilliseconds: policy.timeoutMilliseconds,
    frozenReceipt: policy.frozen,
    currentReceipt: policy.current,
    exactFrozenProjection: true,
  });
}

/** Builds detached deterministic M09-T14/G09 publication and activation evidence. */
export async function buildDesenAppPublishActivationEvidence(rawOptions = undefined) {
  const options = captureBuildOptions(rawOptions);
  const workspaceRoot = await realpath(options.workspaceRoot);
  const [frozen, files] = await Promise.all([
    authenticateFrozenArtifact(workspaceRoot),
    readTrackedFiles(workspaceRoot, options.fileOverrides),
  ]);
  const parents = DESEN_APP_PUBLISH_ACTIVATION_PARENT_PINS.map((pin) =>
    authenticateParent(files.get(pin.path), pin),
  );
  const source = verifyDesenAppPublishActivationSourcePolicy(
    Object.fromEntries(
      Object.entries(SOURCE_PATHS).map(([key, relativePath]) => [
        key,
        decodeUtf8(files.get(relativePath), relativePath),
      ]),
    ),
  );
  const tests = inspectTests(files);
  const packageContract = inspectPackages(files);
  const trackedReceipts = receipts(files);
  const currentProjection = deepFreeze({
    schemaVersion: 1,
    proofId: "desen-app-publish-activation",
    profile: "desen.app.publish-activation-proof.v1",
    task: "M09-T14",
    gate: "G09",
    protocol: "0.1.0",
    target: "web-react",
    prerequisites: parents,
    claim: {
      taskStatus: "DONE",
      gateStatus: "DONE",
      savedAuthoredSourceOnly: true,
      publisherRerunFromSavedSource: true,
      scenarioPreviewPublished: false,
      fixtureDataPublished: false,
      operationInputOrSecretPublished: false,
      rejectedDiagnosticsPublished: false,
      exactCanonicalBundleBytesStored: true,
      fixedPreviewChannelCompareAndSet: true,
      mutableChannelIsActivationAuthority: false,
      sourceGenerationDistinct: true,
      channelGenerationDistinct: true,
      durableActivationGenerationDistinct: true,
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
    },
    authority: {
      source,
      protocolProfiles: {
        input:
          "one exact clean persisted authored Source generation, never an effective scenario preview, fixture, operation input, or rejected diagnostic candidate",
        publisher:
          "fresh public publishDesenSource execution through the App preview helper with the exact reference Catalog",
        publication:
          "exact canonical Bundle bytes stored by immutable revision before one fixed preview-channel compare-and-set",
        activation:
          "server-owned reference-host channel consumption with a distinct durable activation generation and exact active revision",
        containment:
          "stale, conflict, failed, and indeterminate outcomes never claim the candidate active and preserve last-known-good authority",
      },
    },
    application: {
      package: packageContract,
      flow: [
        "admit only a ready persisted snapshot whose current and saved authored Source canonical forms match",
        "rerun the public Publisher from that exact authored Source and require the current preview revision",
        "canonicalize and forward the resulting exact Bundle bytes with its closed revision",
        "store immutable Bundle bytes before moving the fixed preview channel with compare-and-set",
        "ask the server-owned reference host to consume that exact channel generation and revision",
        "claim Active only after an exact durable activation receipt for the same revision",
        "preserve last-known-good activation and expose conflict, failure, stale, or indeterminate outcomes without blind retry",
      ],
      ownership: {
        authoredSourceAndGeneration: "Desen App persistence session",
        bundleAndRevision: "public Publisher",
        immutableBundleAndChannelCas: "public Editor Web adapter over local control-plane API",
        activationAndActiveRevision: "server-owned reference-host channel controller",
        presentation: "Desen App Design-mode publication controls",
      },
    },
    tests,
    boundary: {
      trackedFiles: TRACKED_PATHS.length,
      trackedReceipts,
      proofReaderPaths: PROOF_READER_PATHS,
      parentArtifacts: parents.length,
      immutableInputs: true,
      sourceSymlinksRejected: true,
      historicalArtifactsReadOnly: true,
      realPublicIntegration: tests.realPublicIntegration,
    },
    result: "PASS",
    nonclaims: [
      "M09-T14/G09 proves only saved authored Source publication through the local preview channel and reference-host activation.",
      "Scenario projections, fixtures, operation inputs, secrets, and rejected diagnostic candidates remain transient and unpublished.",
      "A mutable channel remains discovery metadata and never becomes activation authority.",
      "A concrete browser E2E and remote deployment path remain NOT_PROVEN.",
      "P-08 remains NOT_PROVEN; PF-085, PF-086, and PF-089 remain OPEN.",
      "No required-gate or hosted-CI pass is inferred from this local evidence.",
    ],
  });
  const currentProjectionBytes = canonicalArtifactBytes(currentProjection);
  const publicationApplicationTimeoutSuccessor = authenticatePublicationApplicationTimeoutSuccessor(
    frozen.artifact,
    files,
  );
  assertRetainedHistoricalReceipts(frozen.artifact, files);
  const currentCompatibility = deepFreeze({
    schemaVersion: 1,
    proofId: "desen-app-publish-activation",
    profile: "desen.app.publish-activation-proof.v1",
    task: "M09-T14",
    gate: "G09",
    result: "PASS",
    projection: currentProjection,
    projectionBytes: currentProjectionBytes.byteLength,
    projectionSha256: sha256(currentProjectionBytes),
    boundary: {
      retainedHistoricalReceipts: RETAINED_HISTORICAL_PATHS.length,
      successorCompatibilityPaths: SUCCESSOR_COMPATIBILITY_PATHS.length,
      selfResealedPaths: SELF_RESEALED_PATHS,
      currentPathReceipts: trackedReceipts,
    },
    publicationApplicationTimeoutSuccessor,
  });
  return deepFreeze({
    artifact: frozen.artifact,
    artifactBytes: frozen.artifactBytes,
    artifactSha256: frozen.artifactSha256,
    currentCompatibility,
  });
}

function verifyProofDocument(bytes, artifactSha256) {
  const text = decodeUtf8(bytes, PROOF_DOCUMENT_PATH);
  for (const required of [
    "Task: M09-T14",
    "Gate: G09",
    "Status: DONE",
    "P-08: NOT_PROVEN",
    "PF-085: OPEN",
    "PF-086: OPEN",
    "PF-089: OPEN",
    `Final artifact: \`sha256:${artifactSha256}\``,
  ]) {
    if (!text.includes(required)) {
      fail("PROOF_DOCUMENT_DRIFT", `Proof document is missing ${required}.`);
    }
  }
}

/** Verifies committed M09-T14/G09 bytes and the visible report digest. */
export async function verifyDesenAppPublishActivationEvidence(rawOptions = undefined) {
  const options = exactOwnDataOptions(
    rawOptions,
    ["artifactBytes", "artifactPath", "buildOptions", "proofDocument", "proofDocumentPath"],
    "verify options",
  );
  const built = await buildDesenAppPublishActivationEvidence(options.buildOptions);
  const artifactBytes =
    options.artifactBytes === undefined
      ? await readRegularAuthority(
          capturePath(
            options.artifactPath,
            "artifactPath",
            DEFAULT_DESEN_APP_PUBLISH_ACTIVATION_ARTIFACT_PATH,
          ),
          ARTIFACT_PATH,
        )
      : captureBytes(options.artifactBytes, "artifactBytes");
  if (!isDeepStrictEqual(artifactBytes, built.artifactBytes)) {
    fail("ARTIFACT_DRIFT", "Committed M09-T14/G09 artifact bytes differ from fresh evidence.");
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
    gate: built.artifact.gate,
    result: built.artifact.result,
    artifactBytes: built.artifactBytes.byteLength,
    artifactSha256: built.artifactSha256,
    prerequisites: built.artifact.prerequisites.length,
    trackedFiles: built.artifact.boundary.trackedFiles,
    rootTests: built.artifact.tests.rootTestNames.length,
    focusedTestDeclarations: built.artifact.tests.focusedTestDeclarations,
    p08Status: built.artifact.claim.p08Status,
    pf085Status: built.artifact.claim.pf085Status,
    pf086Status: built.artifact.claim.pf086Status,
    pf089Status: built.artifact.claim.pf089Status,
  });
}

/** Atomically writes exact deterministic M09-T14/G09 proof bytes. */
export async function writeDesenAppPublishActivationEvidence(rawOptions = undefined) {
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
    DEFAULT_DESEN_APP_PUBLISH_ACTIVATION_ARTIFACT_PATH,
  );
  const built = await buildDesenAppPublishActivationEvidence(options.buildOptions);
  try {
    await writeAtomicProofArtifact({
      artifactPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename: options.beforeAtomicRename,
    });
  } catch (error) {
    fail("ARTIFACT_WRITE_UNSAFE", "Atomic M09-T14/G09 artifact write failed safely.", {
      cause: String(error),
    });
  }
  return deepFreeze({
    task: built.artifact.task,
    gate: built.artifact.gate,
    result: built.artifact.result,
    artifactPath,
    artifactBytes: built.artifactBytes.byteLength,
    artifactSha256: built.artifactSha256,
    trackedFiles: built.artifact.boundary.trackedFiles,
  });
}
