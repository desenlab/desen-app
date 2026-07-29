import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { format } from "prettier";
import ts from "typescript";

import { canonicalizeJson } from "../../packages/protocol/dist/index.js";
import * as publisherPublicApi from "../../packages/publisher/dist/index.js";
import { preflightPublishExecution } from "../../packages/publisher/dist/execution-preflight.js";
import {
  PUBLISH_SOURCE_PRESERVATION_LIMITS,
  preflightPublishSourcePreservation,
} from "../../packages/publisher/dist/source-preservation.js";
import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");

const ARTIFACT_RELATIVE_PATH = "docs/proof/artifacts/publisher-0.1.0-source-preservation.json";
const PROOF_DOCUMENT_RELATIVE_PATH = "docs/proof/PUBLISHER-SOURCE-PRESERVATION.md";
const PUBLISHER_PACKAGE_RELATIVE_PATH = "packages/publisher/package.json";
const PRESERVATION_SOURCE_RELATIVE_PATH = "packages/publisher/src/source-preservation.ts";
const PRESERVATION_BUILD_RELATIVE_PATH = "packages/publisher/dist/source-preservation.js";
const PRESERVATION_DECLARATION_RELATIVE_PATH = "packages/publisher/dist/source-preservation.d.ts";
const PUBLIC_DECLARATION_RELATIVE_PATH = "packages/publisher/dist/index.d.ts";
const SOURCE_SCHEMA_RELATIVE_PATH =
  "packages/protocol/upstream/0.1.0/snapshot/schemas/desen-source.schema.json";
const BUNDLE_SCHEMA_RELATIVE_PATH =
  "packages/protocol/upstream/0.1.0/snapshot/schemas/desen-bundle.schema.json";

const FIXTURE_PATHS = Object.freeze({
  validSource: "packages/protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json",
  validCatalog: "packages/protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json",
  sortableSource:
    "packages/protocol/upstream/0.1.0/snapshot/examples/sortable-list.source.desen.json",
  storeMapSource: "packages/protocol/upstream/0.1.0/snapshot/examples/store-map.source.desen.json",
});

const PREREQUISITES = Object.freeze([
  Object.freeze({
    task: "M02-T07",
    path: "docs/proof/artifacts/protocol-0.1.0-semantic-foundation.json",
    sha256: "96048882670a6c23629ff686f61e14105a51bc6bcf287fff7ee372045782caa7",
    claim: "opaque detached extension values at the trusted semantic-foundation boundary",
  }),
  Object.freeze({
    task: "M05-T05",
    path: "docs/proof/artifacts/runtime-react-0.1.0-reconciliation-diagnostics.json",
    sha256: "292731d7eff67d5c80bd0de0d0c940c9783e49efd34069c5c11cc9eb4264dbfb",
    claim: "selected Web–React runtime/source identity and one-to-many diagnostic relation",
  }),
  Object.freeze({
    task: "M06-T05",
    path: "docs/proof/artifacts/publisher-0.1.0-execution-preflight.json",
    sha256: "7acad13e8479bc0bc4a9da6c4fa7e9a30b0ec1128eaab9df634eed58acc3e16f",
    claim: "exact complete Source, Catalog, package, alignment, warning, and obligation authority",
  }),
]);

const TRACKED_PATHS = Object.freeze([
  ...Object.values(FIXTURE_PATHS),
  SOURCE_SCHEMA_RELATIVE_PATH,
  BUNDLE_SCHEMA_RELATIVE_PATH,
  "packages/publisher/src/execution-preflight.ts",
  "packages/publisher/src/publish-diagnostics.ts",
  "packages/publisher/src/publish-result.ts",
  PRESERVATION_SOURCE_RELATIVE_PATH,
  "packages/publisher/test/source-preservation.test.ts",
  "packages/publisher/test/source-preservation.types.ts",
  PRESERVATION_BUILD_RELATIVE_PATH,
  PRESERVATION_DECLARATION_RELATIVE_PATH,
  PUBLIC_DECLARATION_RELATIVE_PATH,
  "scripts/lib/atomic-proof-artifact.mjs",
  "scripts/lib/publisher-source-preservation-proof.mjs",
  "scripts/generate-publisher-source-preservation-proof.mjs",
  "scripts/verify-publisher-source-preservation.mjs",
  "tests/publisher-source-preservation.test.mjs",
]);

const ALLOWED_SOURCE_IMPORTS = Object.freeze([
  "@desen/protocol",
  "@desen/validator",
  "./catalog-resolution.js",
  "./execution-preflight.js",
  "./publish-diagnostics.js",
  "./publish-result.js",
]);
const ALLOWED_DECLARATION_IMPORTS = Object.freeze([
  "@desen/protocol",
  "@desen/validator",
  "./catalog-resolution.js",
  "./execution-preflight.js",
  "./publish-result.js",
]);
const FORBIDDEN_PLATFORM_IDENTIFIERS = new Set([
  "Buffer",
  "Bun",
  "Deno",
  "EventSource",
  "SharedWorker",
  "WebSocket",
  "Worker",
  "XMLHttpRequest",
  "__dirname",
  "__filename",
  "caches",
  "chrome",
  "document",
  "fetch",
  "frames",
  "global",
  "globalThis",
  "indexedDB",
  "localStorage",
  "location",
  "module",
  "navigator",
  "parent",
  "process",
  "self",
  "sessionStorage",
  "top",
  "window",
]);
const FORBIDDEN_PARTIAL_FIELDS = Object.freeze([
  "bundle",
  "capabilityPreflighted",
  "catalogSet",
  "executionPreflighted",
  "obligations",
  "packages",
  "phase",
  "preflighted",
  "preservationPrepared",
  "preservedDocument",
  "requirementPackageIndexes",
  "source",
  "sourceCatalogRequirements",
  "sourceNodes",
  "traceability",
  "value",
]);
const EXACT_EXTENSION_POINT_KINDS = Object.freeze([
  "document",
  "action.state.set",
  "action.state.toggle",
  "action.navigate",
  "action.operation.invoke",
  "action.resource.refresh",
  "action.component.command",
  "action.event.emit",
  "variant",
  "behavior",
  "repeat",
  "node",
  "state",
  "resource-instance",
  "surface",
  "source-catalog-requirement",
  "exact-catalog-requirement",
]);
const EXPECTED_SOURCE_ONLY_EXTENSION_DECLARATION =
  "/$defs/sourceCatalogRequirement/properties/extensions";
const EXPECTED_BUNDLE_ONLY_EXTENSION_DECLARATION =
  "/$defs/exactCatalogRequirement/properties/extensions";

/** Absolute destination of the deterministic M06-T06 evidence artifact. */
export const DEFAULT_PUBLISHER_SOURCE_PRESERVATION_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_RELATIVE_PATH,
);

/** Controlled failure emitted by the M06-T06 evidence builder and verifier. */
export class PublisherSourcePreservationEvidenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "PublisherSourcePreservationEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new PublisherSourcePreservationEvidenceError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function isDeepFrozen(value, seen = new Set()) {
  if (value === null || typeof value !== "object" || seen.has(value)) return true;
  seen.add(value);
  if (!Object.isFrozen(value)) return false;
  return Object.values(value).every((child) => isDeepFrozen(child, seen));
}

function captureOptions(value) {
  if (value === undefined) return Object.freeze({});
  const allowed = new Set([
    "artifactBytes",
    "artifactPath",
    "beforeAtomicRename",
    "bundleSchema",
    "ciSource",
    "fixtures",
    "preflight",
    "prerequisiteBytes",
    "preservationDeclaration",
    "preservationSource",
    "proofDocument",
    "publicApi",
    "publicDeclaration",
    "publisherPackage",
    "rootPackage",
    "sourceSchema",
    "verifyPrerequisites",
  ]);
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail("PUBLISHER_PRESERVATION_OPTIONS_INVALID", "Evidence options must be an own-data object.");
  }
  let keys;
  try {
    keys = Reflect.ownKeys(value);
  } catch {
    fail(
      "PUBLISHER_PRESERVATION_OPTIONS_INVALID",
      "Evidence options could not be inspected safely.",
    );
  }
  const captured = Object.create(null);
  for (const key of keys) {
    if (typeof key !== "string" || !allowed.has(key)) {
      fail("PUBLISHER_PRESERVATION_OPTIONS_INVALID", "Evidence options contain an unknown field.");
    }
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      fail(
        "PUBLISHER_PRESERVATION_OPTIONS_INVALID",
        "Evidence options could not be captured safely.",
      );
    }
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      fail(
        "PUBLISHER_PRESERVATION_OPTIONS_INVALID",
        "Evidence options must contain only enumerable own data fields.",
      );
    }
    captured[key] = descriptor.value;
  }
  return Object.freeze(captured);
}

async function readRegularBytes(relativePath) {
  const absolutePath = path.join(WORKSPACE_ROOT, relativePath);
  let entry;
  try {
    entry = await lstat(absolutePath);
  } catch (error) {
    fail("PUBLISHER_PRESERVATION_FILE_MISSING", `Required file is missing: ${relativePath}`, {
      cause: String(error),
    });
  }
  if (!entry.isFile()) {
    fail(
      "PUBLISHER_PRESERVATION_FILE_INVALID",
      `Required path is not a regular file: ${relativePath}`,
    );
  }
  return readFile(absolutePath);
}

async function readJson(relativePath) {
  const bytes = await readRegularBytes(relativePath);
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch {
    fail("PUBLISHER_PRESERVATION_JSON_INVALID", `Required JSON is invalid: ${relativePath}`);
  }
}

function candidateFor(catalog) {
  return {
    id: catalog.id,
    version: catalog.version,
    target: catalog.target,
    observedPackageDigest: catalog.packageDigest,
    catalog,
  };
}

function callPreflight(preflight, source, catalogs, limits = undefined) {
  try {
    const rawSource = JSON.stringify(source);
    const candidates = catalogs.map(candidateFor).reverse();
    return limits === undefined
      ? preflight(rawSource, candidates)
      : preflight(rawSource, candidates, limits);
  } catch (error) {
    fail(
      "PUBLISHER_PRESERVATION_PREFLIGHT_THROW",
      "Source-preservation preflight threw in a proof vector.",
      { cause: String(error) },
    );
  }
}

function assertNoPartial(result, label) {
  for (const key of FORBIDDEN_PARTIAL_FIELDS) {
    if (Object.hasOwn(result, key)) {
      fail(
        "PUBLISHER_PRESERVATION_PARTIAL_FAILURE",
        `${label} exposed forbidden partial field ${key}.`,
      );
    }
  }
  if (JSON.stringify(Object.keys(result).sort()) !== '["diagnostics","ok","stage"]') {
    fail(
      "PUBLISHER_PRESERVATION_PARTIAL_FAILURE",
      `${label} did not retain the exact closed failure shell.`,
    );
  }
}

function assertFailure(result, expectedCode, label) {
  if (
    result === null ||
    typeof result !== "object" ||
    result.ok !== false ||
    result.stage !== "normalization" ||
    !Array.isArray(result.diagnostics) ||
    result.diagnostics.length !== 1 ||
    result.diagnostics[0]?.code !== expectedCode ||
    result.diagnostics[0]?.pointer !== "" ||
    result.diagnostics[0]?.severity !== "error" ||
    result.diagnostics[0]?.stage !== "normalization"
  ) {
    fail(
      "PUBLISHER_PRESERVATION_FAILURE_VECTOR_FAILED",
      `${label} did not return the exact normalization failure.`,
    );
  }
  assertNoPartial(result, label);
  if (!isDeepFrozen(result)) {
    fail(
      "PUBLISHER_PRESERVATION_FAILURE_VECTOR_FAILED",
      `${label} did not return recursively immutable failure data.`,
    );
  }
}

function assertSuccess(result, label) {
  if (
    result === null ||
    typeof result !== "object" ||
    result.preservationPrepared !== true ||
    Object.hasOwn(result, "ok") ||
    Object.hasOwn(result, "bundle") ||
    result.traceability?.strategy !== "unchanged-node-identifiers" ||
    !Array.isArray(result.traceability?.sourceNodes) ||
    !Array.isArray(result.sourceCatalogRequirements)
  ) {
    fail(
      "PUBLISHER_PRESERVATION_SUCCESS_INVALID",
      `${label} did not return complete nonterminal preservation authority.`,
    );
  }
  if (!isDeepFrozen(result)) {
    fail("PUBLISHER_PRESERVATION_SUCCESS_INVALID", `${label} was not recursively immutable.`);
  }
  return result;
}

function pointerToken(value) {
  return String(value).replaceAll("~", "~0").replaceAll("/", "~1");
}

function appendPointer(pointer, ...segments) {
  return `${pointer}${segments.map((segment) => `/${pointerToken(segment)}`).join("")}`;
}

function valueAtPointer(root, pointer) {
  if (pointer === "") return root;
  return pointer
    .slice(1)
    .split("/")
    .map((token) => token.replaceAll("~1", "/").replaceAll("~0", "~"))
    .reduce((value, segment) => {
      if (value === null || typeof value !== "object") {
        fail(
          "PUBLISHER_PRESERVATION_FIXTURE_DRIFT",
          `Fixture pointer traversed a non-object: ${pointer}`,
        );
      }
      return value[segment];
    }, root);
}

function schemaPointerToken(value) {
  return String(value).replaceAll("~", "~0").replaceAll("/", "~1");
}

function collectDeclaredExtensionPoints(schema) {
  const points = [];
  function visit(value, pointer) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      if (Array.isArray(value)) {
        value.forEach((entry, index) => visit(entry, `${pointer}/${index}`));
      }
      return;
    }
    if (
      value.properties !== null &&
      typeof value.properties === "object" &&
      Object.hasOwn(value.properties, "extensions")
    ) {
      points.push(`${pointer}/properties/extensions`);
    }
    for (const [key, child] of Object.entries(value)) {
      visit(child, `${pointer}/${schemaPointerToken(key)}`);
    }
  }
  visit(schema, "");
  return Object.freeze(points.sort());
}

function resolveSchemaPointer(schema, reference) {
  if (!reference.startsWith("#/")) return undefined;
  let current = schema;
  for (const token of reference
    .slice(2)
    .split("/")
    .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"))) {
    if (current === null || typeof current !== "object" || !Object.hasOwn(current, token)) {
      return undefined;
    }
    current = current[token];
  }
  return current;
}

function collectReachableExtensionPoints(schema) {
  const points = new Set();
  const visited = new Set();

  function visit(value, declarationPointer) {
    if (value === null || typeof value !== "object") return;
    if (visited.has(value)) return;
    visited.add(value);
    if (Array.isArray(value)) {
      value.forEach((entry, index) => visit(entry, `${declarationPointer}/${index}`));
      return;
    }
    if (
      value.properties !== null &&
      typeof value.properties === "object" &&
      Object.hasOwn(value.properties, "extensions")
    ) {
      points.add(`${declarationPointer}/properties/extensions`);
    }
    if (typeof value.$ref === "string") {
      const resolved = resolveSchemaPointer(schema, value.$ref);
      if (resolved === undefined) {
        fail(
          "PUBLISHER_PRESERVATION_SCHEMA_DRIFT",
          "A frozen schema contains an unresolved local reference.",
          { reference: value.$ref },
        );
      }
      visit(resolved, value.$ref.slice(1));
    }
    for (const [key, child] of Object.entries(value)) {
      if (key === "$defs" || key === "$ref") continue;
      visit(child, `${declarationPointer}/${schemaPointerToken(key)}`);
    }
  }

  visit(schema, "");
  return Object.freeze([...points].sort());
}

function extensionSchemaEvidence(sourceSchema, bundleSchema) {
  const sourceDeclared = collectDeclaredExtensionPoints(sourceSchema);
  const bundleDeclared = collectDeclaredExtensionPoints(bundleSchema);
  const sourceReachable = collectReachableExtensionPoints(sourceSchema);
  const bundleReachable = collectReachableExtensionPoints(bundleSchema);
  if (
    sourceDeclared.length !== 17 ||
    bundleDeclared.length !== 17 ||
    JSON.stringify(sourceDeclared) !== JSON.stringify(bundleDeclared) ||
    sourceReachable.length !== 16 ||
    bundleReachable.length !== 16 ||
    sourceReachable.includes(EXPECTED_BUNDLE_ONLY_EXTENSION_DECLARATION) ||
    !sourceReachable.includes(EXPECTED_SOURCE_ONLY_EXTENSION_DECLARATION) ||
    bundleReachable.includes(EXPECTED_SOURCE_ONLY_EXTENSION_DECLARATION) ||
    !bundleReachable.includes(EXPECTED_BUNDLE_ONLY_EXTENSION_DECLARATION)
  ) {
    fail(
      "PUBLISHER_PRESERVATION_SCHEMA_DRIFT",
      "Frozen Source/Bundle extension declarations or reachability drifted.",
      { sourceDeclared, bundleDeclared, sourceReachable, bundleReachable },
    );
  }
  return Object.freeze({
    exactSharedDeclaredPoints: sourceDeclared.length,
    exactReachablePerDocument: sourceReachable.length,
    declaredSchemaPointers: sourceDeclared,
    sourceOnlyReachable: EXPECTED_SOURCE_ONLY_EXTENSION_DECLARATION,
    bundleOnlyReachable: EXPECTED_BUNDLE_ONLY_EXTENSION_DECLARATION,
    sourceAndBundleDeclarationParity: true,
  });
}

function extensionPayload(kind, ordinal) {
  return JSON.parse(
    JSON.stringify({
      "com.example.preservation": {
        kind,
        ordinal,
        ordered: [ordinal, `${kind}:middle`, { tail: true }],
        apparentCore: {
          id: `extension-${ordinal}`,
          use: "com.example.invalid/ExtensionMustRemainInert",
          $ref: "state.extensionMustRemainInert",
          entry: "extension-must-remain-inert",
          version: "999.0.0",
        },
      },
      __proto__: { id: "prototype-looking-extension" },
      constructor: { use: "constructor-looking-extension" },
      prototype: { $ref: "prototype-looking-extension" },
    }).replace(
      '"com.example.preservation"',
      '"__proto__":{"id":"own-proto-extension"},"com.example.preservation"',
    ),
  );
}

function emptySecondaryCatalog(primary) {
  return {
    kind: "desen.catalog",
    desen: "0.1.0",
    id: "com.example.empty-preservation-catalog",
    version: "1.0.0",
    target: primary.target,
    packageDigest: `sha256:${"0".repeat(64)}`,
    description: "Inert second catalog used only to prove Source requirement order.",
    components: {},
    behaviors: {},
    operations: {},
    resources: {},
    extensions: extensionPayload("secondary-catalog", 99),
  };
}

function comprehensivePreservationFixture(fixtures) {
  const source = cloneJson(fixtures.validSource);
  const primaryCatalog = cloneJson(fixtures.validCatalog);
  const secondaryCatalog = emptySecondaryCatalog(primaryCatalog);

  source.catalogs.push({
    id: secondaryCatalog.id,
    version: secondaryCatalog.version,
    target: secondaryCatalog.target,
    extensions: extensionPayload("source-catalog-requirement-secondary", 100),
  });
  source.authoring = {
    preservationProofSentinel: {
      id: "authoring.fake-node",
      use: "com.example.invalid/AuthoringMustRemainOutsideTrace",
      slots: [{ id: "authoring.fake-child" }],
    },
  };
  source.extensions = extensionPayload("document", 0);
  source.catalogs[0].extensions = extensionPayload("source-catalog-requirement", 15);

  const signIn = source.surfaces["sign-in"];
  const home = source.surfaces.home;
  signIn.extensions = extensionPayload("surface", 14);
  signIn.state.enabled = {
    schema: { type: "boolean" },
    initial: false,
    extensions: extensionPayload("state", 12),
  };
  signIn.resources.stores = {
    use: "com.example.stores/list",
    input: {},
    policy: "manual",
    extensions: extensionPayload("resource-instance", 13),
  };
  signIn.root.extensions = extensionPayload("node", 11);
  signIn.root.behaviors = [
    {
      id: "sign-in.sortable",
      use: "com.example.interactions/Sortable",
      props: { axis: "vertical", handle: "item" },
      slots: {
        dragPreview: [
          {
            id: "sign-in.drag-preview",
            use: "com.example.ui/Text",
            props: { text: "Drag preview", role: "body" },
            extensions: extensionPayload("node.behavior-slot", 111),
          },
        ],
      },
      extensions: extensionPayload("behavior", 9),
    },
  ];

  const submit = signIn.root.slots.default[4];
  submit.extensions = extensionPayload("node.submit", 112);
  submit.variants = [
    {
      when: { op: "eq", args: [{ $ref: "state.enabled" }, true] },
      props: { label: "Enabled first", variant: "secondary" },
      extensions: extensionPayload("variant", 8),
    },
    {
      when: { op: "eq", args: [{ $ref: "state.enabled" }, false] },
      props: { label: "Disabled middle", variant: "primary" },
      extensions: extensionPayload("variant.second", 81),
    },
    {
      when: { op: "truthy", args: [{ $ref: "context.preservationProof" }] },
      props: { label: "Context last", variant: "danger" },
      extensions: extensionPayload("variant.third", 82),
    },
  ];

  const operation = cloneJson(submit.on.press[0]);
  operation.extensions = extensionPayload("action.operation.invoke", 4);
  operation.onSuccess[0].extensions = extensionPayload("action.navigate.nested", 31);
  submit.on.press = [
    {
      type: "state.set",
      path: "enabled",
      value: true,
      extensions: extensionPayload("action.state.set", 1),
    },
    {
      type: "state.toggle",
      path: "enabled",
      extensions: extensionPayload("action.state.toggle", 2),
    },
    {
      type: "navigate",
      surface: "home",
      params: { proof: "catalog-before-action-order" },
      extensions: extensionPayload("action.navigate", 3),
    },
    operation,
    {
      type: "resource.refresh",
      resource: "stores",
      extensions: extensionPayload("action.resource.refresh", 5),
    },
    {
      type: "component.command",
      target: "sign-in.map",
      command: "fitBounds",
      input: { bounds: {} },
      extensions: extensionPayload("action.component.command", 6),
    },
    {
      type: "event.emit",
      name: "preservation-proof",
      payload: { ordered: ["first", "middle", "last"] },
      extensions: extensionPayload("action.event.emit", 7),
    },
  ];

  signIn.root.slots.default.push({
    id: "sign-in.map",
    use: "com.example.maps/Map",
    props: {
      center: { latitude: 41.0082, longitude: 28.9784 },
      zoom: 11,
      mapStyle: "light",
      showControls: true,
    },
    extensions: extensionPayload("node.map", 113),
  });

  const repeated = home.root.slots.default[0];
  repeated.id = "sign-in.title";
  repeated.repeat = {
    items: [
      { id: "repeat-first", label: "First" },
      { id: "repeat-middle", label: "Middle" },
      { id: "repeat-last", label: "Last" },
    ],
    as: "proofItem",
    key: { $ref: "item.proofItem.id" },
    limit: 3,
    extensions: extensionPayload("repeat", 10),
  };

  const extensionVectors = Object.freeze([
    Object.freeze({ kind: "document", pointer: "/extensions" }),
    Object.freeze({
      kind: "action.state.set",
      pointer: "/surfaces/sign-in/root/slots/default/4/on/press/0/extensions",
    }),
    Object.freeze({
      kind: "action.state.toggle",
      pointer: "/surfaces/sign-in/root/slots/default/4/on/press/1/extensions",
    }),
    Object.freeze({
      kind: "action.navigate",
      pointer: "/surfaces/sign-in/root/slots/default/4/on/press/2/extensions",
    }),
    Object.freeze({
      kind: "action.operation.invoke",
      pointer: "/surfaces/sign-in/root/slots/default/4/on/press/3/extensions",
    }),
    Object.freeze({
      kind: "action.resource.refresh",
      pointer: "/surfaces/sign-in/root/slots/default/4/on/press/4/extensions",
    }),
    Object.freeze({
      kind: "action.component.command",
      pointer: "/surfaces/sign-in/root/slots/default/4/on/press/5/extensions",
    }),
    Object.freeze({
      kind: "action.event.emit",
      pointer: "/surfaces/sign-in/root/slots/default/4/on/press/6/extensions",
    }),
    Object.freeze({
      kind: "variant",
      pointer: "/surfaces/sign-in/root/slots/default/4/variants/0/extensions",
    }),
    Object.freeze({
      kind: "behavior",
      pointer: "/surfaces/sign-in/root/behaviors/0/extensions",
    }),
    Object.freeze({
      kind: "repeat",
      pointer: "/surfaces/home/root/slots/default/0/repeat/extensions",
    }),
    Object.freeze({ kind: "node", pointer: "/surfaces/sign-in/root/extensions" }),
    Object.freeze({ kind: "state", pointer: "/surfaces/sign-in/state/enabled/extensions" }),
    Object.freeze({
      kind: "resource-instance",
      pointer: "/surfaces/sign-in/resources/stores/extensions",
    }),
    Object.freeze({ kind: "surface", pointer: "/surfaces/sign-in/extensions" }),
    Object.freeze({
      kind: "source-catalog-requirement",
      pointer: "/catalogs/0/extensions",
    }),
  ]);
  if (
    extensionVectors.length !== 16 ||
    extensionVectors.some((entry, index) => entry.kind !== EXACT_EXTENSION_POINT_KINDS[index])
  ) {
    fail(
      "PUBLISHER_PRESERVATION_PROOF_INVARIANT",
      "The comprehensive Source extension-vector inventory drifted.",
    );
  }

  return Object.freeze({
    source,
    catalogs: Object.freeze([primaryCatalog, secondaryCatalog]),
    extensionVectors,
  });
}

function traceEntryCodeUnits(entry) {
  return (
    entry.documentId.length +
    entry.surfaceId.length +
    entry.sourceNodeId.length +
    entry.capabilityId.length +
    entry.sourcePointer.length
  );
}

function sortedOwnKeys(value) {
  return Object.keys(value).sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

function expectedSourceNodeTrace(source) {
  const output = [];

  function visitNode(node, documentId, surfaceId, pointer) {
    output.push({
      documentId,
      surfaceId,
      sourceNodeId: node.id,
      capabilityId: node.use,
      sourcePointer: pointer,
    });
    for (const [behaviorIndex, behavior] of (node.behaviors ?? []).entries()) {
      for (const slotName of sortedOwnKeys(behavior.slots ?? {})) {
        for (const [nodeIndex, child] of behavior.slots[slotName].entries()) {
          visitNode(
            child,
            documentId,
            surfaceId,
            appendPointer(pointer, "behaviors", behaviorIndex, "slots", slotName, nodeIndex),
          );
        }
      }
    }
    for (const slotName of sortedOwnKeys(node.slots ?? {})) {
      for (const [nodeIndex, child] of node.slots[slotName].entries()) {
        visitNode(
          child,
          documentId,
          surfaceId,
          appendPointer(pointer, "slots", slotName, nodeIndex),
        );
      }
    }
  }

  for (const surfaceKey of sortedOwnKeys(source.surfaces)) {
    const surface = source.surfaces[surfaceKey];
    visitNode(
      surface.root,
      source.id,
      surface.id,
      appendPointer("", "surfaces", surfaceKey, "root"),
    );
  }
  return output;
}

function semanticOrderProjection(source) {
  const signIn = source.surfaces["sign-in"];
  const home = source.surfaces.home;
  const submit = signIn.root.slots.default.find((node) => node.id === "sign-in.submit");
  const operation = submit.on.press.find((action) => action.type === "operation.invoke");
  return Object.freeze({
    catalogs: Object.freeze(source.catalogs.map((entry) => entry.id)),
    rootSlots: Object.freeze(signIn.root.slots.default.map((node) => node.id)),
    behaviorAttachments: Object.freeze(signIn.root.behaviors.map((behavior) => behavior.id)),
    behaviorSlots: Object.freeze(signIn.root.behaviors[0].slots.dragPreview.map((node) => node.id)),
    actions: Object.freeze(submit.on.press.map((action) => action.type)),
    settlementActions: Object.freeze(operation.onSuccess.map((action) => action.type)),
    variants: Object.freeze(submit.variants.map((variant) => variant.props.label)),
    repeatItems: Object.freeze(home.root.slots.default[0].repeat.items.map((item) => item.id)),
  });
}

function exactAuthorityEvidence(preflight, fixture) {
  const result = assertSuccess(
    callPreflight(preflight, fixture.source, fixture.catalogs),
    "comprehensive preservation fixture",
  );
  if (
    result.preservedDocument.surfaces !== result.source.surfaces ||
    result.preservedDocument.extensions !== result.source.extensions ||
    result.sourceCatalogRequirements !== result.source.catalogs ||
    result.packages.length !== result.catalogSet.length ||
    !result.packages.every((entry, index) => entry.catalog === result.catalogSet[index]) ||
    result.requirementPackageIndexes.length !== result.source.catalogs.length ||
    result.traceability.strategy !== "unchanged-node-identifiers"
  ) {
    fail(
      "PUBLISHER_PRESERVATION_AUTHORITY_FAILED",
      "M06-T06 did not retain exact cumulative runtime authority.",
    );
  }

  const execution = preflightPublishExecution(
    JSON.stringify(fixture.source),
    fixture.catalogs.map(candidateFor).reverse(),
  );
  if (
    !Object.hasOwn(execution, "executionPreflighted") ||
    canonicalizeJson({
      source: execution.source,
      catalogs: execution.catalogSet,
      packageIds: execution.packages.map((entry) => entry.id),
      requirementPackageIndexes: execution.requirementPackageIndexes,
      diagnostics: execution.diagnostics,
      obligations: execution.obligations,
    }) !==
      canonicalizeJson({
        source: result.source,
        catalogs: result.catalogSet,
        packageIds: result.packages.map((entry) => entry.id),
        requirementPackageIndexes: result.requirementPackageIndexes,
        diagnostics: result.diagnostics,
        obligations: result.obligations,
      })
  ) {
    fail(
      "PUBLISHER_PRESERVATION_AUTHORITY_FAILED",
      "M06-T06 changed the inert M06-T05 authority projection.",
    );
  }

  return Object.freeze({
    documentId: result.source.id,
    catalogRequirements: result.sourceCatalogRequirements.length,
    selectedPackages: result.packages.length,
    requirementPackageIndexes: result.requirementPackageIndexes,
    t05ProjectionCanonicalJsonEqual: true,
    sourceAuthorityDetachedFromRawCaller: result.source !== fixture.source,
    preservedSurfacesExactRuntimeReference: true,
    preservedRootExtensionsExactRuntimeReference: true,
    sourceCatalogRequirementsExactRuntimeReference: true,
    selectedCatalogsRetainPackageIdentity: true,
    authoringRetainedOnlyOnAuthenticatedSource:
      Object.hasOwn(result.source, "authoring") &&
      !Object.hasOwn(result.preservedDocument, "authoring"),
    sourceKindExcludedFromPreservedProjection:
      Object.hasOwn(result.source, "kind") && !Object.hasOwn(result.preservedDocument, "kind"),
    terminalOkAbsent: !Object.hasOwn(result, "ok"),
    bundleAbsent: !Object.hasOwn(result, "bundle"),
    deeplyFrozen: true,
  });
}

function extensionPreservationEvidence(preflight, fixture) {
  const result = assertSuccess(
    callPreflight(preflight, fixture.source, fixture.catalogs),
    "extension preservation fixture",
  );
  const preservedKinds = [];
  for (const vector of fixture.extensionVectors) {
    const callerValue = valueAtPointer(fixture.source, vector.pointer);
    const sourceValue = valueAtPointer(result.source, vector.pointer);
    const preservedValue = vector.pointer.startsWith("/catalogs/")
      ? valueAtPointer(result.sourceCatalogRequirements, vector.pointer.slice("/catalogs".length))
      : vector.pointer === "/extensions"
        ? result.preservedDocument.extensions
        : valueAtPointer(result.preservedDocument, vector.pointer);
    if (
      canonicalizeJson(callerValue) !== canonicalizeJson(sourceValue) ||
      sourceValue !== preservedValue ||
      !Object.hasOwn(sourceValue, "__proto__") ||
      !Object.hasOwn(sourceValue, "constructor") ||
      !Object.hasOwn(sourceValue, "prototype")
    ) {
      fail(
        "PUBLISHER_PRESERVATION_EXTENSION_FAILED",
        `Extension value drifted or gained interpretation at ${vector.pointer}.`,
      );
    }
    preservedKinds.push(vector.kind);
  }
  if (JSON.stringify(preservedKinds) !== JSON.stringify(EXACT_EXTENSION_POINT_KINDS.slice(0, 16))) {
    fail(
      "PUBLISHER_PRESERVATION_EXTENSION_FAILED",
      "Not every Source-reachable extension kind was exercised.",
    );
  }
  const fakeIds = new Set(result.traceability.sourceNodes.map((entry) => entry.sourceNodeId));
  if (
    fakeIds.has("extension-0") ||
    fakeIds.has("prototype-looking-extension") ||
    result.packages.length !== 2 ||
    result.obligations.some(
      (obligation) => obligation.context?.capabilityId === "ExtensionMustRemainInert",
    )
  ) {
    fail(
      "PUBLISHER_PRESERVATION_EXTENSION_INTERPRETED",
      "Core publication behavior interpreted an opaque extension payload.",
    );
  }
  return Object.freeze({
    sourceReachableKinds: Object.freeze(preservedKinds),
    exactDetachedCanonicalJsonValues: true,
    exactRuntimeReferencesAcrossT06: true,
    dangerousOwnKeysPreserved: Object.freeze(["__proto__", "constructor", "prototype"]),
    apparentCoreFieldsRemainInert: Object.freeze(["$ref", "entry", "id", "use", "version"]),
    changesPackageSelection: false,
    changesRuntimeObligations: false,
    createsSourceNodeTraceEntries: false,
    rawWhitespaceOrMemberLexicalOrderClaim: false,
  });
}

function orderPreservationEvidence(preflight, fixture) {
  const result = assertSuccess(
    callPreflight(preflight, fixture.source, fixture.catalogs),
    "semantic order fixture",
  );
  const callerProjection = semanticOrderProjection(fixture.source);
  const sourceProjection = semanticOrderProjection(result.source);
  const preservedProjection = semanticOrderProjection({
    ...result.preservedDocument,
    catalogs: result.sourceCatalogRequirements,
  });
  if (
    canonicalizeJson(callerProjection) !== canonicalizeJson(sourceProjection) ||
    canonicalizeJson(sourceProjection) !== canonicalizeJson(preservedProjection)
  ) {
    fail(
      "PUBLISHER_PRESERVATION_ORDER_FAILED",
      "A semantic Source array changed order across the preservation boundary.",
    );
  }
  const repeated = callPreflight(preflight, fixture.source, fixture.catalogs);
  if (
    !Object.hasOwn(repeated, "preservationPrepared") ||
    canonicalizeJson(semanticOrderProjection(repeated.source)) !==
      canonicalizeJson(sourceProjection)
  ) {
    fail(
      "PUBLISHER_PRESERVATION_ORDER_FAILED",
      "Repeated preservation changed a semantic array projection.",
    );
  }
  return Object.freeze({
    exactProjection: callerProjection,
    arraysCovered: Object.freeze([
      "catalog requirements",
      "component slots",
      "behavior attachments",
      "behavior-owned slots",
      "event actions",
      "operation settlement actions",
      "variants",
      "literal repeat items",
    ]),
    noSorting: true,
    noDeduplication: true,
    noRepeatMaterialization: true,
    repeatedInputProjectionCanonicalJsonEqual: true,
  });
}

function traceabilityEvidence(preflight, fixture) {
  const result = assertSuccess(
    callPreflight(preflight, fixture.source, fixture.catalogs),
    "source-node trace fixture",
  );
  const expected = expectedSourceNodeTrace(result.source);
  if (
    canonicalizeJson(result.traceability.sourceNodes) !== canonicalizeJson(expected) ||
    new Set(result.traceability.sourceNodes.map((entry) => entry.sourcePointer)).size !==
      expected.length ||
    new Set(
      result.traceability.sourceNodes.map(
        (entry) => `${entry.surfaceId}\u0000${entry.sourceNodeId}`,
      ),
    ).size !== expected.length
  ) {
    fail(
      "PUBLISHER_PRESERVATION_TRACE_FAILED",
      "Source-node traceability was incomplete, reordered, duplicated, or changed.",
    );
  }
  const forbiddenFragments = [
    "authoring",
    "behaviors",
    "catalogSet",
    "diagnostics",
    "extensions",
    "obligations",
    "packages",
    "props",
    "slots",
    "style",
  ];
  const serializedTrace = JSON.stringify(result.traceability.sourceNodes);
  if (
    forbiddenFragments.some((fragment) => serializedTrace.includes(`"${fragment}"`)) ||
    result.traceability.sourceNodes.some(
      (entry) =>
        Object.keys(entry).sort().join(",") !==
        "capabilityId,documentId,sourceNodeId,sourcePointer,surfaceId",
    )
  ) {
    fail(
      "PUBLISHER_PRESERVATION_TRACE_FAILED",
      "The trace retained data or authority beyond its closed five-string record.",
    );
  }
  return Object.freeze({
    strategy: result.traceability.strategy,
    sourceNodeEntries: expected.length,
    exactEntries: Object.freeze(expected),
    completeForSchemaDefinedComponentNodes: true,
    uniqueSourcePointers: true,
    uniqueSurfaceAndSourceIdPairs: true,
    sourceNodeIdsMayRepeatAcrossSurfaces:
      result.traceability.sourceNodes.filter((entry) => entry.sourceNodeId === "sign-in.title")
        .length === 2,
    behaviorIdsRemainInPreservedSourceOnly: true,
    authoringAndExtensionNodeShapesIgnored: true,
    closedFiveStringRecords: true,
    executableOrPlatformAuthorityRetained: false,
  });
}

function exactPreservationLimits(overrides) {
  return Object.freeze({ ...PUBLISH_SOURCE_PRESERVATION_LIMITS, ...overrides });
}

function finiteTraceEvidence(preflight, fixture) {
  const baseline = assertSuccess(
    callPreflight(preflight, fixture.source, fixture.catalogs),
    "finite trace baseline",
  );
  const sourceNodes = baseline.traceability.sourceNodes;
  const exact = Object.freeze({
    entries: sourceNodes.length,
    pointerCodeUnits: Math.max(...sourceNodes.map((entry) => entry.sourcePointer.length)),
    aggregateCodeUnits: sourceNodes.reduce((total, entry) => total + traceEntryCodeUnits(entry), 0),
  });
  const exactProfile = exactPreservationLimits({
    maxSourceNodeTraceEntries: exact.entries,
    maxSourceNodePointerCodeUnits: exact.pointerCodeUnits,
    maxAggregateSourceNodeTraceCodeUnits: exact.aggregateCodeUnits,
  });
  const exactResult = assertSuccess(
    callPreflight(preflight, fixture.source, fixture.catalogs, exactProfile),
    "exact trace ceilings",
  );
  if (canonicalizeJson(exactResult.traceability.sourceNodes) !== canonicalizeJson(sourceNodes)) {
    fail(
      "PUBLISHER_PRESERVATION_LIMIT_VECTOR_FAILED",
      "Exact trace ceilings changed the complete trace.",
    );
  }

  const belowProfiles = [
    ["entries", exactPreservationLimits({ maxSourceNodeTraceEntries: exact.entries - 1 })],
    [
      "pointer",
      exactPreservationLimits({
        maxSourceNodePointerCodeUnits: exact.pointerCodeUnits - 1,
      }),
    ],
    [
      "aggregate",
      exactPreservationLimits({
        maxAggregateSourceNodeTraceCodeUnits: exact.aggregateCodeUnits - 1,
      }),
    ],
  ];
  for (const [label, limits] of belowProfiles) {
    assertFailure(
      callPreflight(preflight, fixture.source, fixture.catalogs, limits),
      "run.desen.publisher/SOURCE_PRESERVATION_LIMIT_EXCEEDED",
      `one-below ${label} trace ceiling`,
    );
  }
  return Object.freeze({
    defaults: Object.freeze({
      maxSourceNodeTraceEntries: PUBLISH_SOURCE_PRESERVATION_LIMITS.maxSourceNodeTraceEntries,
      maxSourceNodePointerCodeUnits:
        PUBLISH_SOURCE_PRESERVATION_LIMITS.maxSourceNodePointerCodeUnits,
      maxAggregateSourceNodeTraceCodeUnits:
        PUBLISH_SOURCE_PRESERVATION_LIMITS.maxAggregateSourceNodeTraceCodeUnits,
    }),
    exactAccepted: exact,
    oneBelowExactRejected: Object.freeze(["entries", "pointer", "aggregate"]),
    overBudgetCode: "run.desen.publisher/SOURCE_PRESERVATION_LIMIT_EXCEEDED",
    overBudgetStage: "normalization",
    overBudgetPointer: "",
    traceNeverTruncated: true,
    extensionsUseInheritedRawSourceLimits: true,
    failuresExposeNoPartialAuthorityOrBundle: true,
  });
}

function assertPublicPrivacy(publicApi, publisherPackage, publicDeclaration) {
  const forbiddenRuntime = [
    "PUBLISH_SOURCE_PRESERVATION_LIMITS",
    "SOURCE_PRESERVATION_AUTHORITY_INVALID_CODE",
    "SOURCE_PRESERVATION_LIMIT_EXCEEDED_CODE",
    "normalizePublishSourcePreservationLimits",
    "preflightPublishSourcePreservation",
  ];
  const forbiddenDeclarationFragments = [
    "PublishPreservedSourceDocument",
    "PublishSourceNodeTraceEntry",
    "PublishSourcePreservationLimits",
    "PublishSourcePreservationResult",
    "PublishSourcePreservationSuccess",
    "PublishSourceTraceability",
    "preservationPrepared",
    "preflightPublishSourcePreservation",
  ];
  if (
    forbiddenRuntime.some((name) => Object.hasOwn(publicApi, name)) ||
    forbiddenDeclarationFragments.some((fragment) => publicDeclaration.includes(fragment)) ||
    Object.hasOwn(publisherPackage.exports ?? {}, "./source-preservation")
  ) {
    fail(
      "PUBLISHER_PRESERVATION_PUBLIC_API_EXPOSED",
      "The package-private preservation boundary leaked through the Publisher package root.",
    );
  }
  const exportKeys = Object.keys(publisherPackage.exports ?? {});
  if (JSON.stringify(exportKeys) !== '["."]') {
    fail(
      "PUBLISHER_PRESERVATION_PUBLIC_API_EXPOSED",
      "The Publisher package exposes an unreviewed package subpath.",
      { exportKeys },
    );
  }
  return Object.freeze({
    rootRuntimeExports: Object.freeze(Object.keys(publicApi).sort()),
    preservationRuntimeExported: false,
    preservationTypeExported: false,
    preservationSubpathExported: false,
    packagePrivateDistImportUsedByProof: "packages/publisher/dist/source-preservation.js",
  });
}

function moduleSpecifierText(node) {
  return ts.isStringLiteralLike(node) ? node.text : undefined;
}

function hasModifier(node, kind) {
  if (!ts.canHaveModifiers(node)) return false;
  return (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === kind);
}

function declarationName(node, sourceFile) {
  if (node.name === undefined) return "<anonymous>";
  return ts.isIdentifier(node.name) || ts.isStringLiteralLike(node.name)
    ? node.name.text
    : node.name.getText(sourceFile);
}

function ambientRuntimeDeclaration(node, sourceFile) {
  if (ts.isNamespaceExportDeclaration(node)) {
    return `namespace-export:${node.name.text}`;
  }
  if (
    !hasModifier(node, ts.SyntaxKind.DeclareKeyword) ||
    hasModifier(node, ts.SyntaxKind.ExportKeyword)
  ) {
    return undefined;
  }
  if (ts.isVariableStatement(node)) {
    return `variable:${node.declarationList.declarations
      .map((declaration) => declarationName(declaration, sourceFile))
      .join(",")}`;
  }
  if (ts.isFunctionDeclaration(node)) {
    return `function:${declarationName(node, sourceFile)}`;
  }
  if (ts.isClassDeclaration(node)) {
    return `class:${declarationName(node, sourceFile)}`;
  }
  if (ts.isEnumDeclaration(node)) {
    return `enum:${declarationName(node, sourceFile)}`;
  }
  if (ts.isModuleDeclaration(node)) {
    return `module:${declarationName(node, sourceFile)}`;
  }
  return undefined;
}

function auditTypeScriptBoundary(source, relativePath, allowedImports, kind) {
  const sourceFile = ts.createSourceFile(
    relativePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    relativePath.endsWith(".d.ts") ? ts.ScriptKind.TS : ts.ScriptKind.TS,
  );
  if (sourceFile.parseDiagnostics.length > 0) {
    fail(
      "PUBLISHER_PRESERVATION_TARGET_BOUNDARY_DRIFT",
      `TypeScript could not parse ${relativePath}.`,
    );
  }
  const imports = [];
  const platformIdentifiers = new Set();
  const directLoaderForms = [];
  const ambientRuntimeDeclarations = [];

  function inspect(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier !== undefined
    ) {
      const specifier = moduleSpecifierText(node.moduleSpecifier);
      if (specifier !== undefined) imports.push(specifier);
    }
    if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteralLike(node.argument.literal)
    ) {
      imports.push(node.argument.literal.text);
    }
    if (ts.isIdentifier(node) && FORBIDDEN_PLATFORM_IDENTIFIERS.has(node.text)) {
      platformIdentifiers.add(node.text);
    }
    const ambientDeclaration = ambientRuntimeDeclaration(node, sourceFile);
    if (ambientDeclaration !== undefined) {
      ambientRuntimeDeclarations.push(ambientDeclaration);
    }
    if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        directLoaderForms.push("import()");
      } else if (
        ts.isIdentifier(node.expression) &&
        ["eval", "require"].includes(node.expression.text)
      ) {
        directLoaderForms.push(`${node.expression.text}()`);
      }
    }
    if (
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      ["Function", "Worker", "SharedWorker"].includes(node.expression.text)
    ) {
      directLoaderForms.push(`new ${node.expression.text}()`);
    }
    ts.forEachChild(node, inspect);
  }
  inspect(sourceFile);

  const allowed = new Set(allowedImports);
  const unexpectedImports = imports.filter((specifier) => !allowed.has(specifier));
  const diagnosticSuppressions =
    source.match(/@ts-(?:check|ignore|nocheck|expect-error)|eslint-disable/gu) ?? [];
  const tripleSlashReferences = source.match(/^\s*\/\/\/\s*<reference\b.*$/gmu) ?? [];
  if (
    unexpectedImports.length > 0 ||
    platformIdentifiers.size > 0 ||
    directLoaderForms.length > 0 ||
    ambientRuntimeDeclarations.length > 0 ||
    diagnosticSuppressions.length > 0 ||
    tripleSlashReferences.length > 0
  ) {
    fail(
      "PUBLISHER_PRESERVATION_TARGET_BOUNDARY_DRIFT",
      `Package-private preservation ${kind} crossed the target-neutral boundary.`,
      {
        relativePath,
        unexpectedImports,
        platformIdentifiers: [...platformIdentifiers].sort(),
        directLoaderForms,
        ambientRuntimeDeclarations,
        diagnosticSuppressions,
        tripleSlashReferences,
      },
    );
  }
  return Object.freeze({
    kind,
    imports: Object.freeze([...imports].sort()),
    unexpectedStaticImports: Object.freeze([]),
    enumeratedPlatformIdentifiersObserved: Object.freeze([]),
    directLoaderFormsObserved: Object.freeze([]),
    ambientRuntimeDeclarationsObserved: Object.freeze([]),
    diagnosticSuppressionDirectivesObserved: Object.freeze([]),
    tripleSlashReferenceDirectivesObserved: Object.freeze([]),
  });
}

function assertTargetNeutralBoundary(
  preservationSource,
  preservationDeclaration,
  publisherPackage,
) {
  const sourceAudit = auditTypeScriptBoundary(
    preservationSource,
    PRESERVATION_SOURCE_RELATIVE_PATH,
    ALLOWED_SOURCE_IMPORTS,
    "source",
  );
  const declarationAudit = auditTypeScriptBoundary(
    preservationDeclaration,
    PRESERVATION_DECLARATION_RELATIVE_PATH,
    ALLOWED_DECLARATION_IMPORTS,
    "declaration",
  );
  const dependencies = Object.keys(publisherPackage.dependencies ?? {}).sort();
  if (JSON.stringify(dependencies) !== '["@desen/protocol","@desen/validator"]') {
    fail(
      "PUBLISHER_PRESERVATION_TARGET_BOUNDARY_DRIFT",
      "Publisher production dependencies crossed the platform-neutral boundary.",
      { dependencies },
    );
  }
  return Object.freeze({
    source: sourceAudit,
    declaration: declarationAudit,
    productionDependencies: Object.freeze(dependencies),
    inspectionMethod: "TypeScript AST direct-form source/declaration audit",
    inspectionScope: Object.freeze([
      "static import, re-export, and import-type specifiers",
      "exact production dependency names",
      "enumerated direct platform identifiers",
      "direct dynamic-loader and constructor forms",
      "ambient runtime value declarations",
      "TypeScript and ESLint diagnostic-suppression directives",
      "triple-slash reference directives",
    ]),
    exhaustiveJavaScriptSandboxClaim: false,
  });
}

function countExactOccurrences(text, value) {
  return text.split(value).length - 1;
}

function assertCiRegistration(rootPackage, publisherPackage, ciSource) {
  const expected = Object.freeze({
    focusedPackageScript: "vitest run test/source-preservation.test.ts",
    generate:
      "pnpm verify:publisher-execution-preflight && pnpm --filter @desen/publisher... build && pnpm --filter @desen/publisher typecheck && pnpm --filter @desen/publisher test:source-preservation && node scripts/generate-publisher-source-preservation-proof.mjs",
    verify:
      "pnpm verify:publisher-execution-preflight && pnpm --filter @desen/publisher... build && pnpm --filter @desen/publisher typecheck && pnpm --filter @desen/publisher test:source-preservation && node scripts/verify-publisher-source-preservation.mjs",
    test: "pnpm verify:publisher-execution-preflight && pnpm --filter @desen/publisher... build && pnpm --filter @desen/publisher typecheck && pnpm --filter @desen/publisher test:source-preservation && node --test tests/publisher-source-preservation.test.mjs",
    checkEntry: "pnpm verify:publisher-source-preservation",
    testEntry: "pnpm test:publisher-source-preservation",
    proofTuple: Object.freeze([
      "publisher-source-preservation",
      "scripts/verify-publisher-source-preservation.mjs",
      "tests/publisher-source-preservation.test.mjs",
    ]),
  });
  const scripts = rootPackage.scripts ?? {};
  const checkCommands = typeof scripts.check === "string" ? scripts.check.split(" && ") : [];
  const testCommands = typeof scripts.test === "string" ? scripts.test.split(" && ") : [];
  const tupleText = [
    "[",
    '      "publisher-source-preservation",',
    '      "scripts/verify-publisher-source-preservation.mjs",',
    '      "tests/publisher-source-preservation.test.mjs",',
    "    ],",
  ].join("\n");
  if (
    publisherPackage.scripts?.["test:source-preservation"] !== expected.focusedPackageScript ||
    scripts["generate:publisher-source-preservation"] !== expected.generate ||
    scripts["verify:publisher-source-preservation"] !== expected.verify ||
    scripts["test:publisher-source-preservation"] !== expected.test ||
    checkCommands.filter((entry) => entry === expected.checkEntry).length !== 1 ||
    testCommands.filter((entry) => entry === expected.testEntry).length !== 1 ||
    countExactOccurrences(ciSource, tupleText) !== 1
  ) {
    fail(
      "PUBLISHER_PRESERVATION_CI_REGISTRATION_DRIFT",
      "Selected M06-T06 package, root, or single-pass CI registration drifted.",
      {
        focusedPackageScript: publisherPackage.scripts?.["test:source-preservation"],
        generate: scripts["generate:publisher-source-preservation"],
        verify: scripts["verify:publisher-source-preservation"],
        test: scripts["test:publisher-source-preservation"],
        checkOccurrences: checkCommands.filter((entry) => entry === expected.checkEntry).length,
        testOccurrences: testCommands.filter((entry) => entry === expected.testEntry).length,
        proofTupleOccurrences: countExactOccurrences(ciSource, tupleText),
      },
    );
  }
  const executionCheckIndex = checkCommands.indexOf("pnpm verify:publisher-execution-preflight");
  const preservationCheckIndex = checkCommands.indexOf(expected.checkEntry);
  const executionTestIndex = testCommands.indexOf("pnpm test:publisher-execution-preflight");
  const preservationTestIndex = testCommands.indexOf(expected.testEntry);
  if (
    executionCheckIndex < 0 ||
    preservationCheckIndex !== executionCheckIndex + 1 ||
    executionTestIndex < 0 ||
    preservationTestIndex !== executionTestIndex + 1
  ) {
    fail(
      "PUBLISHER_PRESERVATION_CI_REGISTRATION_DRIFT",
      "M06-T06 is not the exact immediate successor of M06-T05 in legacy root registration.",
    );
  }
  return Object.freeze({
    ...expected,
    checkRegisteredExactlyOnceAfterM06T05: true,
    testRegisteredExactlyOnceAfterM06T05: true,
    ciProofTupleRegisteredExactlyOnce: true,
    successorAdditionsExcludedFromByteInventory: true,
  });
}

async function verifyPrerequisitePins(enabled, prerequisiteBytes) {
  const results = [];
  for (const prerequisite of PREREQUISITES) {
    const bytes =
      prerequisiteBytes?.[prerequisite.path] === undefined
        ? await readRegularBytes(prerequisite.path)
        : Buffer.from(prerequisiteBytes[prerequisite.path]);
    const actual = sha256(bytes);
    if (enabled && actual !== prerequisite.sha256) {
      fail(
        "PUBLISHER_PRESERVATION_PREREQUISITE_DRIFT",
        `Exact prerequisite drifted: ${prerequisite.task}.`,
        { path: prerequisite.path, expected: prerequisite.sha256, actual },
      );
    }
    results.push(
      Object.freeze({
        ...prerequisite,
        verifiedSha256: actual,
        matchesPin: actual === prerequisite.sha256,
      }),
    );
  }
  return Object.freeze(results);
}

async function fileInventory() {
  const sorted = [...TRACKED_PATHS].sort();
  if (new Set(sorted).size !== sorted.length) {
    fail(
      "PUBLISHER_PRESERVATION_TRACKED_FILE_DRIFT",
      "Tracked preservation evidence paths contain duplicates.",
    );
  }
  return Object.freeze(
    await Promise.all(
      sorted.map(async (relativePath) =>
        Object.freeze({
          path: relativePath,
          sha256: sha256(await readRegularBytes(relativePath)),
        }),
      ),
    ),
  );
}

async function countVitestCases(relativePath) {
  const text = (await readRegularBytes(relativePath)).toString("utf8");
  return (text.match(/\b(?:it|test)\s*\(/gu) ?? []).length;
}

async function testInventory() {
  const [runtimeCases, typeText, rootText] = await Promise.all([
    countVitestCases("packages/publisher/test/source-preservation.test.ts"),
    readRegularBytes("packages/publisher/test/source-preservation.types.ts").then((bytes) =>
      bytes.toString("utf8"),
    ),
    readRegularBytes("tests/publisher-source-preservation.test.mjs").then((bytes) =>
      bytes.toString("utf8"),
    ),
  ]);
  const compilerNegativeCases = (typeText.match(/@ts-expect-error/gu) ?? []).length;
  const rootMutationCases = (rootText.match(/\btest\s*\(/gu) ?? []).length;
  if (runtimeCases < 10 || compilerNegativeCases < 10 || rootMutationCases < 12) {
    fail(
      "PUBLISHER_PRESERVATION_TEST_INVENTORY_DRIFT",
      "Focused preservation evidence no longer has the reviewed minimum breadth.",
      { runtimeCases, compilerNegativeCases, rootMutationCases },
    );
  }
  return Object.freeze({
    publisherRuntimeCases: runtimeCases,
    compilerNegativeCases,
    rootMutationCases,
  });
}

function assertProofDocumentPin(proofDocument, artifactSha256) {
  if (typeof proofDocument !== "string") {
    fail(
      "PUBLISHER_PRESERVATION_PROOF_DOCUMENT_DRIFT",
      "The source-preservation proof document is not text.",
    );
  }
  const expectedHash = `sha256:${artifactSha256}`;
  const digestPins = proofDocument.match(/sha256:[0-9a-f]{64}/gu) ?? [];
  if (
    countExactOccurrences(proofDocument, `\`${ARTIFACT_RELATIVE_PATH}\``) !== 1 ||
    countExactOccurrences(proofDocument, `\`${expectedHash}\``) !== 1 ||
    digestPins.length !== 1 ||
    digestPins[0] !== expectedHash ||
    proofDocument.includes("PENDING_M06_T06_ARTIFACT_SHA256")
  ) {
    fail(
      "PUBLISHER_PRESERVATION_PROOF_DOCUMENT_DRIFT",
      "The source-preservation proof document does not uniquely pin the artifact and hash.",
      { expectedArtifactPath: ARTIFACT_RELATIVE_PATH, expectedHash },
    );
  }
}

async function defaultFixtures() {
  return Object.freeze(
    Object.fromEntries(
      await Promise.all(
        Object.entries(FIXTURE_PATHS).map(async ([key, relativePath]) => [
          key,
          await readJson(relativePath),
        ]),
      ),
    ),
  );
}

function assertFixtureIdentity(fixtures) {
  for (const source of [fixtures.validSource, fixtures.sortableSource, fixtures.storeMapSource]) {
    const requirement = source?.catalogs?.[0];
    if (
      source?.kind !== "desen.source" ||
      source?.desen !== "0.1.0" ||
      !source?.id ||
      !requirement ||
      requirement.id !== fixtures.validCatalog?.id ||
      requirement.version !== fixtures.validCatalog?.version ||
      requirement.target !== fixtures.validCatalog?.target
    ) {
      fail(
        "PUBLISHER_PRESERVATION_FIXTURE_DRIFT",
        "A tracked Source/Catalog fixture no longer carries the expected exact tuple.",
      );
    }
  }
}

/**
 * Builds deterministic M06-T06 evidence from exact M02-T07, M05-T05, and M06-T05 prerequisites
 * plus the shipped package-private Publisher preservation boundary.
 */
export async function buildPublisherSourcePreservationEvidence(rawOptions = undefined) {
  const options = captureOptions(rawOptions);
  const [
    fixturesDefault,
    sourceSchemaDefault,
    bundleSchemaDefault,
    rootPackageDefault,
    publisherPackageDefault,
    ciSourceDefault,
    preservationSourceDefault,
    preservationDeclarationDefault,
    publicDeclarationDefault,
  ] = await Promise.all([
    defaultFixtures(),
    readJson(SOURCE_SCHEMA_RELATIVE_PATH),
    readJson(BUNDLE_SCHEMA_RELATIVE_PATH),
    readJson("package.json"),
    readJson(PUBLISHER_PACKAGE_RELATIVE_PATH),
    readRegularBytes("scripts/run-ci-quality-gate.mjs").then((bytes) => bytes.toString("utf8")),
    readRegularBytes(PRESERVATION_SOURCE_RELATIVE_PATH).then((bytes) => bytes.toString("utf8")),
    readRegularBytes(PRESERVATION_DECLARATION_RELATIVE_PATH).then((bytes) =>
      bytes.toString("utf8"),
    ),
    readRegularBytes(PUBLIC_DECLARATION_RELATIVE_PATH).then((bytes) => bytes.toString("utf8")),
  ]);

  const fixtures = cloneJson(options.fixtures ?? fixturesDefault);
  const sourceSchema = cloneJson(options.sourceSchema ?? sourceSchemaDefault);
  const bundleSchema = cloneJson(options.bundleSchema ?? bundleSchemaDefault);
  const rootPackage = cloneJson(options.rootPackage ?? rootPackageDefault);
  const publisherPackage = cloneJson(options.publisherPackage ?? publisherPackageDefault);
  const ciSource = options.ciSource ?? ciSourceDefault;
  const preservationSource = options.preservationSource ?? preservationSourceDefault;
  const preservationDeclaration = options.preservationDeclaration ?? preservationDeclarationDefault;
  const publicDeclaration = options.publicDeclaration ?? publicDeclarationDefault;
  const preflight = options.preflight ?? preflightPublishSourcePreservation;
  const publicApi = options.publicApi ?? publisherPublicApi;
  if (
    typeof preflight !== "function" ||
    typeof ciSource !== "string" ||
    typeof preservationSource !== "string" ||
    typeof preservationDeclaration !== "string" ||
    typeof publicDeclaration !== "string" ||
    publicApi === null ||
    typeof publicApi !== "object"
  ) {
    fail("PUBLISHER_PRESERVATION_OPTIONS_INVALID", "Evidence overrides have invalid types.");
  }

  assertFixtureIdentity(fixtures);
  const prerequisites = await verifyPrerequisitePins(
    options.verifyPrerequisites !== false,
    options.prerequisiteBytes,
  );
  const schemaEvidence = extensionSchemaEvidence(sourceSchema, bundleSchema);
  const comprehensiveFixture = comprehensivePreservationFixture(fixtures);
  const authority = exactAuthorityEvidence(preflight, comprehensiveFixture);
  const extensions = extensionPreservationEvidence(preflight, comprehensiveFixture);
  const semanticOrder = orderPreservationEvidence(preflight, comprehensiveFixture);
  const traceability = traceabilityEvidence(preflight, comprehensiveFixture);
  const finiteProfile = finiteTraceEvidence(preflight, comprehensiveFixture);
  const apiPrivacy = assertPublicPrivacy(publicApi, publisherPackage, publicDeclaration);
  const targetNeutralBoundary = assertTargetNeutralBoundary(
    preservationSource,
    preservationDeclaration,
    publisherPackage,
  );
  const ciRegistration = assertCiRegistration(rootPackage, publisherPackage, ciSource);

  for (const fragment of [
    "PublishPreservedSourceDocument",
    "PublishSourceNodeTraceEntry",
    "PublishSourcePreservationLimits",
    "PublishSourcePreservationResult",
    "PublishSourcePreservationSuccess",
    "PublishSourceTraceability",
    "preservationPrepared",
    "unchanged-node-identifiers",
  ]) {
    if (!preservationDeclaration.includes(fragment)) {
      fail(
        "PUBLISHER_PRESERVATION_DECLARATION_DRIFT",
        "Built package-private declarations no longer document exact preservation authority.",
        { missing: fragment },
      );
    }
  }

  const artifact = Object.freeze({
    schemaVersion: 1,
    profile: "desen.publisher.source-preservation-proof.v1",
    task: "M06-T06",
    result: "PASS",
    summary:
      "The built package-private Publisher preservation boundary retains exact M06-T05 authority, preserves all 16 Source-reachable opaque extension locations and every semantic Source array by exact parsed runtime reference, and emits one complete bounded five-string component-node trace under the unchanged-node-identifiers strategy without emitting a Bundle.",
    prerequisites,
    frozenSchemas: Object.freeze({
      source: SOURCE_SCHEMA_RELATIVE_PATH,
      bundle: BUNDLE_SCHEMA_RELATIVE_PATH,
      extensions: schemaEvidence,
    }),
    fixtures: Object.freeze({
      paths: FIXTURE_PATHS,
      comprehensiveSourceId: comprehensiveFixture.source.id,
      comprehensiveCatalogRequirements: comprehensiveFixture.source.catalogs.length,
    }),
    claims: Object.freeze({
      exactNonterminalAuthority: authority,
      opaqueExtensionPreservation: extensions,
      semanticArrayOrderPreservation: semanticOrder,
      sourceNodeTraceability: traceability,
      exactAndOverTraceCeilings: finiteProfile,
      authoringScope: Object.freeze({
        authenticatedSourceRetainsExactAuthoringValue: true,
        preservedDocumentStructurallyHasNoAuthoringMember: true,
        authoringValueInspectedOrTransformed: false,
        authoringNodeShapesCreateTraceEntries: false,
        removalOrNormalizationClaim: false,
        rationale:
          "M06-T06 exposes a separate exact-field projection; it does not mutate or remove authoring from the authenticated M06-T05 Source authority.",
      }),
      failuresExposeNoPartialAuthorityOrBundle: true,
      rootApiPrivacy: apiPrivacy,
      targetNeutralDependencyBoundary: targetNeutralBoundary,
      selectedCiRegistration: ciRegistration,
      deterministicEvidenceBuild: Object.freeze({
        canonicalJsonFormatting: "Prettier JSON parser, LF",
        extensionComparison: "RFC 8785 canonical JSON after raw Source parsing",
        trackedFileInventorySortedAndUnique: true,
        successorRegistrationSemanticallyAuthenticatedNotByteTracked: true,
        builtJavaScriptByteTracked: PRESERVATION_BUILD_RELATIVE_PATH,
        builtDeclarationByteTracked: PRESERVATION_DECLARATION_RELATIVE_PATH,
        repeatedBuildCheckedByRootEvidence: true,
        atomicWriter: "scripts/lib/atomic-proof-artifact.mjs",
      }),
    }),
    ownership: Object.freeze({
      traceRules: Object.freeze(["R-037", "R-107"]),
      normativeClauses: Object.freeze(["N-014", "N-021"]),
      taskStatus: "COMPLETE",
      stageUsedForControlledT06Failure: "normalization",
      normalizationStageCompletionClaim: false,
      includes: Object.freeze([
        "all frozen Source/Bundle extension declaration and reachability classes",
        "opaque parsed extension-value preservation without core interpretation",
        "semantic Source array reference and order preservation",
        "complete deterministic component-node identity traceability",
      ]),
      rationale:
        "Preservation is established before later normalization can transform any publication projection; T06 failures use the existing normalization stage without claiming that T07 normalization is complete.",
    }),
    nonclaims: Object.freeze([
      "M06-T06 remains package-private and nonterminal; it does not expose a public publish function or emit a Bundle.",
      "Raw Source whitespace and JSON object-member lexical order are outside the parsed M06-T05 authority and are not claimed to survive.",
      "The preserved-document projection omits authoring but does not remove, mutate, inspect, or normalize authoring on the authenticated Source; M06-T07 owns removal and normalization.",
      "M06-T06 preserves repeat declarations and ordered Source values but does not materialize runtime repeat instances.",
      "M06-T06 does not calculate a Source digest, pin exact Bundle package tuples, validate a Bundle, calculate a revision, or prove double-publish determinism.",
      "The five-string trace grants no runtime instance, adapter, host, executable, callback, Catalog, prop, style, slot, action, extension, or authoring authority.",
      "The target-boundary source/declaration audit is not a JavaScript sandbox and does not claim exhaustive detection of intentionally obfuscated reflection, metaprogramming, or runtime code generation.",
      "M06-T06 performs no editor save/open round trip, network discovery, package download, activation, rendering, signing, npm publication, or deployment.",
    ]),
    tests: await testInventory(),
    trackedFiles: await fileInventory(),
    reproduction: Object.freeze([
      "pnpm verify:publisher-execution-preflight",
      "pnpm --filter @desen/publisher build",
      "pnpm --filter @desen/publisher typecheck",
      "pnpm --filter @desen/publisher test:source-preservation",
      "node scripts/generate-publisher-source-preservation-proof.mjs",
      "node scripts/verify-publisher-source-preservation.mjs",
      "node --test tests/publisher-source-preservation.test.mjs",
    ]),
  });

  const artifactText = await format(JSON.stringify(artifact), {
    parser: "json",
    printWidth: 100,
    tabWidth: 2,
    endOfLine: "lf",
  });
  const artifactBytes = Buffer.from(artifactText, "utf8");
  return Object.freeze({
    artifact,
    artifactBytes,
    artifactSha256: sha256(artifactBytes),
  });
}

/** Verifies tracked or injected evidence against a fresh deterministic build. */
export async function verifyPublisherSourcePreservationEvidence(rawOptions = undefined) {
  const options = captureOptions(rawOptions);
  const built = await buildPublisherSourcePreservationEvidence(options);
  const artifactBytes =
    options.artifactBytes === undefined
      ? await readRegularBytes(ARTIFACT_RELATIVE_PATH)
      : Buffer.from(options.artifactBytes);
  if (!artifactBytes.equals(built.artifactBytes)) {
    fail(
      "PUBLISHER_PRESERVATION_ARTIFACT_DRIFT",
      "Tracked source-preservation evidence differs from a fresh deterministic build.",
      {
        expectedSha256: built.artifactSha256,
        actualSha256: sha256(artifactBytes),
      },
    );
  }
  const proofDocument =
    options.proofDocument === undefined
      ? await readRegularBytes(PROOF_DOCUMENT_RELATIVE_PATH).then((bytes) => bytes.toString("utf8"))
      : options.proofDocument;
  assertProofDocumentPin(proofDocument, built.artifactSha256);
  return Object.freeze({
    result: "PASS",
    artifactSha256: built.artifactSha256,
    prerequisitePins: built.artifact.prerequisites.length,
    sharedDeclaredExtensionPoints:
      built.artifact.frozenSchemas.extensions.exactSharedDeclaredPoints,
    reachableExtensionPointsPerDocument:
      built.artifact.frozenSchemas.extensions.exactReachablePerDocument,
    exercisedSourceExtensionKinds:
      built.artifact.claims.opaqueExtensionPreservation.sourceReachableKinds.length,
    semanticArrayClasses: built.artifact.claims.semanticArrayOrderPreservation.arraysCovered.length,
    sourceNodeTraceEntries: built.artifact.claims.sourceNodeTraceability.sourceNodeEntries,
    finiteLimitVectors: 6,
    trackedFiles: built.artifact.trackedFiles.length,
    tests: built.artifact.tests,
    proofDocumentPinned: true,
  });
}

/** Atomically writes exact deterministic M06-T06 evidence bytes. */
export async function writePublisherSourcePreservationEvidence(rawOptions = undefined) {
  const options = captureOptions(rawOptions);
  const built = await buildPublisherSourcePreservationEvidence(options);
  const artifactPath = options.artifactPath ?? DEFAULT_PUBLISHER_SOURCE_PRESERVATION_ARTIFACT_PATH;
  await writeAtomicProofArtifact({
    artifactPath,
    artifactBytes: built.artifactBytes,
    ...(options.beforeAtomicRename === undefined
      ? {}
      : { beforeAtomicRename: options.beforeAtomicRename }),
  });
  return Object.freeze({
    artifactPath: path.resolve(artifactPath),
    artifactSha256: built.artifactSha256,
    artifactBytes: built.artifactBytes,
  });
}
