import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { format } from "prettier";
import ts from "typescript";

import * as publisherPublicApi from "../../packages/publisher/dist/index.js";
import {
  CAPABILITY_PREFLIGHT_LIMIT_EXCEEDED_CODE,
  preflightPublishCapabilities,
} from "../../packages/publisher/dist/capability-preflight.js";
import {
  PUBLISH_SOURCE_PREFLIGHT_LIMITS,
  preflightPublishSource,
} from "../../packages/publisher/dist/source-preflight.js";
import * as validatorPublicApi from "../../packages/validator/dist/index.js";
import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");

const ARTIFACT_RELATIVE_PATH = "docs/proof/artifacts/publisher-0.1.0-capability-preflight.json";
const PROOF_DOCUMENT_RELATIVE_PATH = "docs/proof/PUBLISHER-CAPABILITY-PREFLIGHT.md";
const PUBLISHER_PACKAGE_RELATIVE_PATH = "packages/publisher/package.json";
const CAPABILITY_SOURCE_RELATIVE_PATH = "packages/publisher/src/capability-preflight.ts";
const CAPABILITY_DECLARATION_RELATIVE_PATH = "packages/publisher/dist/capability-preflight.d.ts";
const PUBLIC_DECLARATION_RELATIVE_PATH = "packages/publisher/dist/index.d.ts";

const FIXTURE_PATHS = Object.freeze({
  officialSource: "examples/sign-in/official-derived.source.desen.json",
  referenceCatalog: "packages/reference-catalog-web/catalog.json",
  validSource: "packages/protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json",
  validCatalog: "packages/protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json",
  exampleSignIn: "packages/protocol/upstream/0.1.0/snapshot/examples/sign-in.source.desen.json",
  exampleSortable:
    "packages/protocol/upstream/0.1.0/snapshot/examples/sortable-list.source.desen.json",
  exampleStoreMap: "packages/protocol/upstream/0.1.0/snapshot/examples/store-map.source.desen.json",
  exampleCatalog: "packages/protocol/upstream/0.1.0/snapshot/examples/catalog.web.example.json",
});

const PREREQUISITES = Object.freeze([
  Object.freeze({
    task: "M02-T08",
    path: "docs/proof/artifacts/protocol-0.1.0-component-contracts.json",
    sha256: "71cd73475a1c59f734870051bcd6d26a8a2b7bf83caf9bed3d3882da467014ac",
    claim: "component prop, slot, style, visual-state, and dynamic-obligation contracts",
  }),
  Object.freeze({
    task: "M02-T09",
    path: "docs/proof/artifacts/protocol-0.1.0-interaction-contracts.json",
    sha256: "981e1d59dd68e32639055b1267880cc1e6ebb3a76ad1176298990b28fe048208",
    claim: "behavior, event, command, attachment, and conflict contracts",
  }),
  Object.freeze({
    task: "M02-T13",
    path: "docs/proof/artifacts/protocol-0.1.0-validator-diagnostic-micro-vectors.json",
    sha256: "3214a26a683d46a3b20c6ca400de44faa2c5e394f706a6e3e8d3d3628da78718",
    claim: "exact accepted and rejected Validator diagnostic micro-vectors",
  }),
  Object.freeze({
    task: "M06-T03",
    path: "docs/proof/artifacts/publisher-0.1.0-source-preflight.json",
    sha256: "4c8324f87a2da70e2e6c9254b3fd8498a6546093891d008678c7e646e185457c",
    claim: "exact prepared Source, Catalog package, and requirement-alignment authority",
  }),
]);

const TRACKED_PATHS = Object.freeze([
  ...Object.values(FIXTURE_PATHS),
  PUBLISHER_PACKAGE_RELATIVE_PATH,
  "packages/publisher/src/index.ts",
  "packages/publisher/src/publish-diagnostics.ts",
  "packages/publisher/src/publish-result.ts",
  "packages/publisher/src/source-preflight.ts",
  CAPABILITY_SOURCE_RELATIVE_PATH,
  "packages/publisher/test/capability-preflight.test.ts",
  "packages/publisher/test/capability-preflight.types.ts",
  "packages/publisher/dist/capability-preflight.js",
  CAPABILITY_DECLARATION_RELATIVE_PATH,
  PUBLIC_DECLARATION_RELATIVE_PATH,
  "packages/validator/src/index.ts",
  "packages/validator/src/component-contract-validation.ts",
  "packages/validator/src/interaction-contract-validation.ts",
  "packages/validator/test/component-contracts.test.ts",
  "packages/validator/test/interaction-contracts.test.ts",
  "packages/validator/test/diagnostic-micro-vectors.test.ts",
  "package.json",
  "scripts/run-ci-quality-gate.mjs",
  "scripts/test/ci-quality-gate.test.mjs",
  "scripts/lib/atomic-proof-artifact.mjs",
  "scripts/lib/publisher-capability-preflight-proof.mjs",
  "scripts/generate-publisher-capability-preflight-proof.mjs",
  "scripts/verify-publisher-capability-preflight.mjs",
  "tests/publisher-capability-preflight.test.mjs",
]);

const ALLOWED_CAPABILITY_IMPORTS = Object.freeze([
  "@desen/protocol",
  "@desen/validator",
  "./catalog-resolution.js",
  "./publish-diagnostics.js",
  "./publish-result.js",
  "./source-preflight.js",
]);

const FORBIDDEN_CAPABILITY_PLATFORM_IDENTIFIERS = new Set([
  "Buffer",
  "Bun",
  "Deno",
  "EventSource",
  "Function",
  "SharedWorker",
  "WebSocket",
  "Worker",
  "XMLHttpRequest",
  "__dirname",
  "__filename",
  "document",
  "eval",
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
  "obligations",
  "packages",
  "preflighted",
  "requirementPackageIndexes",
  "resolved",
  "source",
  "value",
]);

const DEPRECATED_CAPABILITY_CODE = "run.desen.publisher/DEPRECATED_CAPABILITY";
const CAPABILITY_STAGE = "capability-contracts";
const FIXED_DEPRECATION_MESSAGE = "Source data uses a deprecated Catalog capability.";

/** Absolute destination of the deterministic M06-T04 evidence artifact. */
export const DEFAULT_PUBLISHER_CAPABILITY_PREFLIGHT_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_RELATIVE_PATH,
);

/** Controlled failure emitted by the M06-T04 evidence builder and verifier. */
export class PublisherCapabilityPreflightEvidenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "PublisherCapabilityPreflightEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new PublisherCapabilityPreflightEvidenceError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function captureOptions(value) {
  if (value === undefined) return Object.freeze({});
  const allowed = new Set([
    "artifactBytes",
    "artifactPath",
    "beforeAtomicRename",
    "capabilityDeclaration",
    "capabilitySource",
    "fixtures",
    "preflight",
    "proofDocument",
    "publicApi",
    "publicDeclaration",
    "publisherPackage",
    "sourcePreflight",
    "validatorApi",
    "verifyPrerequisites",
  ]);
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail("PUBLISHER_CAPABILITY_OPTIONS_INVALID", "Evidence options must be an own-data object.");
  }
  let keys;
  try {
    keys = Reflect.ownKeys(value);
  } catch {
    fail("PUBLISHER_CAPABILITY_OPTIONS_INVALID", "Evidence options could not be inspected safely.");
  }
  const captured = Object.create(null);
  for (const key of keys) {
    if (typeof key !== "string" || !allowed.has(key)) {
      fail("PUBLISHER_CAPABILITY_OPTIONS_INVALID", "Evidence options contain an unknown field.");
    }
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      fail(
        "PUBLISHER_CAPABILITY_OPTIONS_INVALID",
        `Evidence option ${key} could not be inspected safely.`,
      );
    }
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      fail(
        "PUBLISHER_CAPABILITY_OPTIONS_INVALID",
        `Evidence option ${key} must be an enumerable own data property.`,
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
    fail("PUBLISHER_CAPABILITY_FILE_MISSING", `Required file is missing: ${relativePath}`, {
      cause: String(error),
    });
  }
  if (!entry.isFile()) {
    fail(
      "PUBLISHER_CAPABILITY_FILE_INVALID",
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
    fail("PUBLISHER_CAPABILITY_JSON_INVALID", `Required JSON is invalid: ${relativePath}`);
  }
}

function isDeepFrozen(value, seen = new Set()) {
  if (value === null || typeof value !== "object" || seen.has(value)) return true;
  seen.add(value);
  if (!Object.isFrozen(value)) return false;
  return Object.values(value).every((child) => isDeepFrozen(child, seen));
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

function callPreflight(preflight, source, catalog, limits = undefined) {
  try {
    const rawSource = JSON.stringify(source);
    const candidates = [candidateFor(catalog)];
    return limits === undefined
      ? preflight(rawSource, candidates)
      : preflight(rawSource, candidates, limits);
  } catch (error) {
    fail(
      "PUBLISHER_CAPABILITY_PREFLIGHT_THROW",
      "Capability preflight threw during a proof vector.",
      { cause: String(error) },
    );
  }
}

function assertNoPartial(result, label) {
  for (const key of FORBIDDEN_PARTIAL_FIELDS) {
    if (Object.hasOwn(result, key)) {
      fail(
        "PUBLISHER_CAPABILITY_PARTIAL_FAILURE",
        `${label} exposed forbidden partial field ${key}.`,
      );
    }
  }
  if (JSON.stringify(Object.keys(result).sort()) !== '["diagnostics","ok","stage"]') {
    fail(
      "PUBLISHER_CAPABILITY_PARTIAL_FAILURE",
      `${label} did not retain the exact closed failure shell.`,
    );
  }
}

function findDiagnostic(result, expected) {
  return result.diagnostics?.find(
    (entry) =>
      entry?.code === expected.code &&
      entry?.pointer === expected.pointer &&
      entry?.stage === expected.stage &&
      entry?.severity === expected.severity,
  );
}

function assertFailure(result, expected, label) {
  if (
    result === null ||
    typeof result !== "object" ||
    result.ok !== false ||
    result.stage !== expected.stage ||
    !Array.isArray(result.diagnostics) ||
    result.diagnostics.length === 0 ||
    findDiagnostic(result, {
      ...expected,
      severity: "error",
    }) === undefined
  ) {
    fail(expected.failureCode, `${label} did not return the expected terminal failure.`);
  }
  assertNoPartial(result, label);
  if (!isDeepFrozen(result)) {
    fail(expected.failureCode, `${label} did not return recursively immutable failure data.`);
  }
  return Object.freeze({
    stage: result.stage,
    code: expected.code,
    pointer: expected.pointer,
    diagnosticCount: result.diagnostics.length,
    noPartial: true,
    deeplyFrozen: true,
  });
}

function assertCapabilitySuccess(result, label, expectedWarnings = undefined) {
  const exactKeys = [
    "capabilityPreflighted",
    "catalogSet",
    "diagnostics",
    "packages",
    "requirementPackageIndexes",
    "source",
  ];
  if (
    result === null ||
    typeof result !== "object" ||
    result.capabilityPreflighted !== true ||
    JSON.stringify(Object.keys(result).sort()) !== JSON.stringify(exactKeys) ||
    !Array.isArray(result.catalogSet) ||
    !Array.isArray(result.packages) ||
    !Array.isArray(result.requirementPackageIndexes) ||
    !Array.isArray(result.diagnostics) ||
    (expectedWarnings !== undefined && result.diagnostics.length !== expectedWarnings) ||
    Object.hasOwn(result, "ok") ||
    Object.hasOwn(result, "bundle") ||
    Object.hasOwn(result, "obligations") ||
    Object.hasOwn(result, "preflighted") ||
    !isDeepFrozen(result)
  ) {
    fail(
      "PUBLISHER_CAPABILITY_SUCCESS_VECTOR_FAILED",
      `${label} did not return complete immutable nonterminal capability authority.`,
    );
  }
  if (
    result.packages.length !== result.catalogSet.length ||
    result.packages.some((entry, index) => entry.catalog !== result.catalogSet[index])
  ) {
    fail(
      "PUBLISHER_CAPABILITY_SUCCESS_VECTOR_FAILED",
      `${label} broke selected-package/Catalog authority identity.`,
    );
  }
  return result;
}

function validatorDiagnostic(result, expected, label) {
  const diagnostic = result?.diagnostics?.find(
    (entry) => entry?.code === expected.code && entry?.pointer === expected.pointer,
  );
  if (result?.valid !== false || diagnostic === undefined || !isDeepFrozen(result)) {
    fail(
      "PUBLISHER_CAPABILITY_VALIDATOR_PREREQUISITE_FAILED",
      `${label} did not produce the expected public Validator prerequisite diagnostic.`,
    );
  }
  return Object.freeze({ code: diagnostic.code, pointer: diagnostic.pointer });
}

function preparePublicInteractionAuthority(validatorApi, catalog, label) {
  let result;
  try {
    result = validatorApi.validateDesenInteractionCatalogSet([cloneJson(catalog)]);
  } catch (error) {
    fail(
      "PUBLISHER_CAPABILITY_VALIDATOR_PREREQUISITE_FAILED",
      `${label} interaction-Catalog preparation threw.`,
      { cause: String(error) },
    );
  }
  if (result?.valid !== true || !isDeepFrozen(result)) {
    fail(
      "PUBLISHER_CAPABILITY_VALIDATOR_PREREQUISITE_FAILED",
      `${label} interaction-Catalog preparation did not succeed immutably.`,
    );
  }
  return result.value;
}

function validatePublicSourceContracts(validatorApi, source, catalogSet, label) {
  let result;
  try {
    result = validatorApi.validateDesenSourceInteractionContracts(cloneJson(source), catalogSet);
  } catch (error) {
    fail(
      "PUBLISHER_CAPABILITY_VALIDATOR_PREREQUISITE_FAILED",
      `${label} Source interaction validation threw.`,
      { cause: String(error) },
    );
  }
  if (result?.valid !== true || !Array.isArray(result.obligations) || !isDeepFrozen(result)) {
    fail(
      "PUBLISHER_CAPABILITY_VALIDATOR_PREREQUISITE_FAILED",
      `${label} Source interaction validation did not succeed immutably.`,
    );
  }
  return result;
}

function exactAuthorityEvidence(preflight, validatorApi, source, catalog) {
  const sourceInput = cloneJson(source);
  const catalogInput = cloneJson(catalog);
  const result = assertCapabilitySuccess(
    callPreflight(preflight, sourceInput, catalogInput),
    "official-derived Source",
    0,
  );
  const catalogsReauthenticated = validatorApi.validateDesenInteractionCatalogSet(
    result.catalogSet,
  );
  const sourceReauthenticated = validatorApi.validatePreparedDesenSourceReferences(
    result.source,
    result.catalogSet,
  );
  if (
    catalogsReauthenticated?.valid !== true ||
    catalogsReauthenticated.value !== result.catalogSet ||
    sourceReauthenticated?.valid !== true ||
    sourceReauthenticated.value !== result.source ||
    result.source === sourceInput ||
    result.catalogSet[0] === catalogInput
  ) {
    fail(
      "PUBLISHER_CAPABILITY_AUTHORITY_FAILED",
      "Capability preflight did not retain detached, runtime-authenticated exact Source and Catalog authorities.",
    );
  }

  const firstJson = JSON.stringify(result);
  const repeated = assertCapabilitySuccess(
    callPreflight(preflight, cloneJson(source), cloneJson(catalog)),
    "repeated official-derived Source",
    0,
  );
  if (JSON.stringify(repeated) !== firstJson) {
    fail(
      "PUBLISHER_CAPABILITY_DETERMINISM_FAILED",
      "Repeated capability preflight did not return byte-identical inert JSON.",
    );
  }

  sourceInput.entry = "caller-mutated";
  catalogInput.description = "caller-mutated";
  if (
    result.source.entry !== source.entry ||
    result.catalogSet[0]?.description !== catalog.description
  ) {
    fail(
      "PUBLISHER_CAPABILITY_DETACHMENT_FAILED",
      "Caller mutation changed prepared Source or Catalog capability authority.",
    );
  }

  return Object.freeze({
    sourceId: result.source.id,
    catalogs: result.catalogSet.length,
    selectedPackages: result.packages.length,
    requirementPackageIndexes: Object.freeze([...result.requirementPackageIndexes]),
    interactionAuthorityReauthenticatedByIdentity: true,
    sourceReferenceAuthorityReauthenticatedByIdentity: true,
    sourceDetached: true,
    catalogDetached: true,
    dynamicObligationsAbsent: true,
    terminalOkAbsent: true,
    bundleAbsent: true,
    deeplyFrozen: true,
    repeatedJsonByteIdentical: true,
  });
}

function fixtureCorpusEvidence(preflight, validatorApi, fixtures) {
  const pairs = [
    ["official-derived sign-in", fixtures.officialSource, fixtures.referenceCatalog],
    ["frozen valid sign-in", fixtures.validSource, fixtures.validCatalog],
    ["frozen example sign-in", fixtures.exampleSignIn, fixtures.exampleCatalog],
    ["frozen example sortable list", fixtures.exampleSortable, fixtures.exampleCatalog],
    ["frozen example store map", fixtures.exampleStoreMap, fixtures.exampleCatalog],
  ];

  return Object.freeze(
    pairs.map(([id, source, catalog]) => {
      const authority = preparePublicInteractionAuthority(validatorApi, catalog, id);
      const validated = validatePublicSourceContracts(validatorApi, source, authority, id);
      const published = assertCapabilitySuccess(
        callPreflight(preflight, cloneJson(source), cloneJson(catalog)),
        id,
        0,
      );
      if (
        published.source.id !== source.id ||
        Object.hasOwn(published, "obligations") ||
        validated.obligations.length < 1
      ) {
        fail(
          "PUBLISHER_CAPABILITY_FIXTURE_CORPUS_FAILED",
          `${id} did not preserve the M06-T04/M06-T05 obligation boundary.`,
        );
      }
      return Object.freeze({
        id,
        sourceId: source.id,
        publicValidatorAccepted: true,
        publisherAccepted: true,
        publicValidatorDynamicObligations: validated.obligations.length,
        publisherDynamicObligationsExposed: false,
        warnings: 0,
      });
    }),
  );
}

function inheritedT03FailureEvidence(preflight, sourcePreflight, source, catalog) {
  const invalid = cloneJson(source);
  invalid.entry = "missing";
  const rawSource = JSON.stringify(invalid);
  const expected = sourcePreflight(rawSource, [candidateFor(cloneJson(catalog))]);
  const actual = preflight(rawSource, [candidateFor(cloneJson(catalog))]);
  assertNoPartial(actual, "inherited M06-T03 entry failure");
  if (
    JSON.stringify(actual) !== JSON.stringify(expected) ||
    actual?.stage !== "source-semantics" ||
    actual?.diagnostics?.[0]?.code !== "ENTRY_NOT_FOUND"
  ) {
    fail(
      "PUBLISHER_CAPABILITY_T03_PASSTHROUGH_FAILED",
      "Capability preflight remapped or changed an inherited M06-T03 failure.",
    );
  }
  const evidence = assertFailure(
    actual,
    {
      stage: "source-semantics",
      code: "ENTRY_NOT_FOUND",
      pointer: "/entry",
      failureCode: "PUBLISHER_CAPABILITY_T03_PASSTHROUGH_FAILED",
    },
    "inherited M06-T03 entry failure",
  );
  return Object.freeze({ ...evidence, byteEqualToDirectM06T03Result: true });
}

function staticFailureCases(fixtures) {
  const prop = cloneJson(fixtures.validSource);
  prop.surfaces["sign-in"].root.slots.default[4].props.label = 42;

  const slot = cloneJson(fixtures.validSource);
  slot.surfaces["sign-in"].root.slots.unexpected = [];

  const style = cloneJson(fixtures.validSource);
  style.surfaces["sign-in"].root.style = {
    base: { unexpectedPart: { color: "red" } },
  };

  const event = cloneJson(fixtures.validSource);
  event.surfaces["sign-in"].root.on = { unexpectedEvent: [] };

  const command = cloneJson(fixtures.exampleStoreMap);
  command.surfaces.stores.root.slots.default[1].on.press[0].command = "unexpected";

  const behaviorProp = cloneJson(fixtures.exampleSortable);
  behaviorProp.surfaces.tasks.root.behaviors[0].props.axis = "diagonal";

  const attachmentCatalog = cloneJson(fixtures.exampleCatalog);
  attachmentCatalog.behaviors["com.example.interactions/Sortable"].attachTo = {
    categories: ["content"],
  };

  const invalidCatalog = cloneJson(fixtures.validCatalog);
  invalidCatalog.components["com.example.ui/Button"].propsSchema = {
    $ref: "#/$defs/missing",
  };

  return Object.freeze([
    Object.freeze({
      id: "component-prop",
      source: prop,
      catalog: fixtures.validCatalog,
      code: "PROP_TYPE_MISMATCH",
      pointer: "/surfaces/sign-in/root/slots/default/4/props/label",
      catalogPreparationFailure: false,
    }),
    Object.freeze({
      id: "component-slot",
      source: slot,
      catalog: fixtures.validCatalog,
      code: "UNKNOWN_SLOT",
      pointer: "/surfaces/sign-in/root/slots/unexpected",
      catalogPreparationFailure: false,
    }),
    Object.freeze({
      id: "component-style",
      source: style,
      catalog: fixtures.validCatalog,
      code: "UNKNOWN_PROP",
      pointer: "/surfaces/sign-in/root/style/base/unexpectedPart",
      catalogPreparationFailure: false,
    }),
    Object.freeze({
      id: "component-event",
      source: event,
      catalog: fixtures.validCatalog,
      code: "UNKNOWN_EVENT",
      pointer: "/surfaces/sign-in/root/on/unexpectedEvent",
      catalogPreparationFailure: false,
    }),
    Object.freeze({
      id: "component-command",
      source: command,
      catalog: fixtures.exampleCatalog,
      code: "UNKNOWN_COMMAND",
      pointer: "/surfaces/stores/root/slots/default/1/on/press/0/command",
      catalogPreparationFailure: false,
    }),
    Object.freeze({
      id: "behavior-prop",
      source: behaviorProp,
      catalog: fixtures.exampleCatalog,
      code: "PROP_TYPE_MISMATCH",
      pointer: "/surfaces/tasks/root/behaviors/0/props/axis",
      catalogPreparationFailure: false,
    }),
    Object.freeze({
      id: "behavior-attachment",
      source: fixtures.exampleSortable,
      catalog: attachmentCatalog,
      code: "BEHAVIOR_ATTACHMENT_INVALID",
      pointer: "/surfaces/tasks/root/behaviors/0/use",
      catalogPreparationFailure: false,
    }),
    Object.freeze({
      id: "unsafe-component-schema",
      source: fixtures.validSource,
      catalog: invalidCatalog,
      code: "run.desen.validator/INVALID_COMPONENT_CONTRACT",
      pointer: "/0/components/com.example.ui~1Button/propsSchema/$ref",
      catalogPreparationFailure: true,
    }),
  ]);
}

function staticContractFailureEvidence(preflight, validatorApi, fixtures) {
  return Object.freeze(
    staticFailureCases(fixtures).map((testCase) => {
      const catalogResult = validatorApi.validateDesenInteractionCatalogSet([
        cloneJson(testCase.catalog),
      ]);
      if (testCase.catalogPreparationFailure) {
        validatorDiagnostic(catalogResult, testCase, `${testCase.id} Catalog preparation`);
      } else {
        if (catalogResult?.valid !== true) {
          fail(
            "PUBLISHER_CAPABILITY_VALIDATOR_PREREQUISITE_FAILED",
            `${testCase.id} Catalog prerequisite unexpectedly failed.`,
          );
        }
        const sourceResult = validatorApi.validateDesenSourceInteractionContracts(
          cloneJson(testCase.source),
          catalogResult.value,
        );
        validatorDiagnostic(sourceResult, testCase, `${testCase.id} Source validation`);
      }

      const publisher = assertFailure(
        callPreflight(preflight, cloneJson(testCase.source), cloneJson(testCase.catalog)),
        {
          stage: CAPABILITY_STAGE,
          code: testCase.code,
          pointer: testCase.pointer,
          failureCode: "PUBLISHER_CAPABILITY_STATIC_CONTRACT_FAILED",
        },
        testCase.id,
      );
      return Object.freeze({
        id: testCase.id,
        code: publisher.code,
        pointer: publisher.pointer,
        publicValidatorMatched: true,
        publisherStage: publisher.stage,
        noPartial: publisher.noPartial,
      });
    }),
  );
}

function deprecatedFixtures(fixtures) {
  const source = cloneJson(fixtures.exampleSortable);
  const catalog = cloneJson(fixtures.exampleCatalog);
  const behavior = source.surfaces.tasks.root.behaviors[0];
  const operation = behavior.on.reorder[0];
  const nested = cloneJson(operation);
  nested.as = "nestedReorder";
  delete nested.onSuccess;
  delete nested.onFailure;
  operation.onSuccess = [nested];
  behavior.slots = {
    dragPreview: [
      {
        id: "tasks.drag-preview",
        use: "com.example.ui/Text",
        props: { text: "Drag preview", role: "body" },
      },
    ],
  };

  catalog.components["com.example.ui/Stack"].deprecated = true;
  catalog.components["com.example.ui/Stack"].replacement = "com.example.ui/Text";
  catalog.components["com.example.ui/Text"].deprecated = true;
  catalog.behaviors["com.example.interactions/Sortable"].deprecated =
    "PRIVATE BEHAVIOR RETIREMENT TEXT";
  catalog.behaviors["com.example.interactions/Sortable"].replacement =
    "com.example.interactions/Replacement";
  catalog.resources["com.example.tasks/list"].deprecated = true;
  catalog.operations["com.example.tasks/reorder"].deprecated = "PRIVATE OPERATION RETIREMENT TEXT";
  catalog.operations["com.example.tasks/reorder"].replacement = "com.example.tasks/replacement";

  return Object.freeze({ source, catalog });
}

function diagnosticCodeUnits(diagnostic) {
  const context = diagnostic.context;
  return (
    diagnostic.code.length +
    diagnostic.message.length +
    (diagnostic.pointer?.length ?? 0) +
    (context?.documentId?.length ?? 0) +
    (context?.surfaceId?.length ?? 0) +
    (context?.subject?.kind.length ?? 0) +
    (context?.subject?.id.length ?? 0) +
    (context?.capabilityId?.length ?? 0)
  );
}

function warningEvidence(preflight, validatorApi, fixtures) {
  const deprecated = deprecatedFixtures(fixtures);
  const authority = preparePublicInteractionAuthority(
    validatorApi,
    deprecated.catalog,
    "deprecated capability fixture",
  );
  validatePublicSourceContracts(
    validatorApi,
    deprecated.source,
    authority,
    "deprecated capability fixture",
  );

  const first = assertCapabilitySuccess(
    callPreflight(preflight, deprecated.source, deprecated.catalog),
    "deprecated capability fixture",
    7,
  );
  const expectedPointers = [
    "/surfaces/tasks/resources/tasks/use",
    "/surfaces/tasks/root/behaviors/0/on/reorder/0/onSuccess/0/operation",
    "/surfaces/tasks/root/behaviors/0/on/reorder/0/operation",
    "/surfaces/tasks/root/behaviors/0/slots/dragPreview/0/use",
    "/surfaces/tasks/root/behaviors/0/use",
    "/surfaces/tasks/root/slots/default/0/use",
    "/surfaces/tasks/root/use",
  ];
  const pointers = first.diagnostics.map(({ pointer }) => pointer);
  if (
    JSON.stringify(pointers) !== JSON.stringify(expectedPointers) ||
    new Set(pointers).size !== pointers.length ||
    first.diagnostics.some(
      (diagnostic) =>
        diagnostic.code !== DEPRECATED_CAPABILITY_CODE ||
        diagnostic.message !== FIXED_DEPRECATION_MESSAGE ||
        diagnostic.stage !== CAPABILITY_STAGE ||
        diagnostic.severity !== "warning" ||
        Object.hasOwn(diagnostic, "replacement"),
    )
  ) {
    fail(
      "PUBLISHER_CAPABILITY_DEPRECATION_FAILED",
      "Deprecation warnings were incomplete, duplicated, unsorted, blocking, or structurally unsafe.",
    );
  }
  const warningText = JSON.stringify(first.diagnostics);
  for (const forbidden of [
    "PRIVATE BEHAVIOR RETIREMENT TEXT",
    "PRIVATE OPERATION RETIREMENT TEXT",
    "com.example.interactions/Replacement",
    "com.example.tasks/replacement",
  ]) {
    if (warningText.includes(forbidden)) {
      fail(
        "PUBLISHER_CAPABILITY_DEPRECATION_LEAK",
        "A warning disclosed Catalog-controlled deprecation or replacement data.",
      );
    }
  }

  const repeated = assertCapabilitySuccess(
    callPreflight(preflight, cloneJson(deprecated.source), cloneJson(deprecated.catalog)),
    "repeated deprecated capability fixture",
    7,
  );
  if (JSON.stringify(repeated.diagnostics) !== JSON.stringify(first.diagnostics)) {
    fail(
      "PUBLISHER_CAPABILITY_DEPRECATION_DETERMINISM_FAILED",
      "Repeated deprecation discovery changed warning bytes or order.",
    );
  }

  const falseCatalog = cloneJson(deprecated.catalog);
  falseCatalog.components["com.example.ui/Stack"].deprecated = false;
  falseCatalog.components["com.example.ui/Text"].deprecated = false;
  falseCatalog.behaviors["com.example.interactions/Sortable"].deprecated = false;
  falseCatalog.resources["com.example.tasks/list"].deprecated = false;
  falseCatalog.operations["com.example.tasks/reorder"].deprecated = false;
  const falseResult = assertCapabilitySuccess(
    callPreflight(preflight, cloneJson(deprecated.source), falseCatalog),
    "explicit false deprecation fixture",
    0,
  );

  return Object.freeze({
    warningCount: first.diagnostics.length,
    pointers: Object.freeze(pointers),
    componentTrueWarned: pointers.includes("/surfaces/tasks/root/use"),
    nestedComponentWarned: pointers.includes("/surfaces/tasks/root/slots/default/0/use"),
    behaviorStringWarned: pointers.includes("/surfaces/tasks/root/behaviors/0/use"),
    behaviorSlotComponentWarned: pointers.includes(
      "/surfaces/tasks/root/behaviors/0/slots/dragPreview/0/use",
    ),
    resourceTrueWarned: pointers.includes("/surfaces/tasks/resources/tasks/use"),
    operationTopLevelWarned: pointers.includes(
      "/surfaces/tasks/root/behaviors/0/on/reorder/0/operation",
    ),
    operationNestedWarned: pointers.includes(
      "/surfaces/tasks/root/behaviors/0/on/reorder/0/onSuccess/0/operation",
    ),
    explicitFalseWarnings: falseResult.diagnostics.length,
    warningMessageFixed: true,
    catalogProseRedacted: true,
    replacementNotSelectedOrDisclosed: true,
    sortedAndDeduplicated: true,
    repeatedWarningsByteIdentical: true,
    diagnostics: first.diagnostics,
    fixture: deprecated,
  });
}

function withObjectPrototypeData(properties, run) {
  const prior = new Map();
  for (const [key, value] of Object.entries(properties)) {
    prior.set(key, Object.getOwnPropertyDescriptor(Object.prototype, key));
    Object.defineProperty(Object.prototype, key, {
      configurable: true,
      enumerable: false,
      writable: true,
      value,
    });
  }
  try {
    return run();
  } finally {
    for (const [key, descriptor] of prior) {
      if (descriptor === undefined) Reflect.deleteProperty(Object.prototype, key);
      else Object.defineProperty(Object.prototype, key, descriptor);
    }
  }
}

function assertOwnOptionalGuards(source) {
  const requiredFragments = [
    'ownDataValue(result, "preflighted") === true',
    'ownDataValue<NodeSnapshot["on"]>(node, "on")',
    'ownDataValue<NodeSnapshot["slots"]>(node, "slots")',
    'ownDataValue<NodeSnapshot["behaviors"]>(node, "behaviors")',
    'ownDataValue<BehaviorSnapshot["on"]>(behavior, "on")',
    'ownDataValue<BehaviorSnapshot["slots"]>(behavior, "slots")',
    'ownDataValue<OperationActionSnapshot["onSuccess"]>(operation, "onSuccess")',
    'ownDataValue<OperationActionSnapshot["onFailure"]>(operation, "onFailure")',
  ];
  if (
    requiredFragments.some((fragment) => !source.includes(fragment)) ||
    (source.match(/"deprecated",/gu) ?? []).length !== 4
  ) {
    fail(
      "PUBLISHER_CAPABILITY_OWN_DATA_GUARD_DRIFT",
      "Capability preflight no longer guards every optional traversal as own data.",
    );
  }
}

function inheritedOptionalDataEvidence(preflight, sourcePreflight, fixtures, capabilitySource) {
  assertOwnOptionalGuards(capabilitySource);

  const rawInvalid = '{"kind":"desen.source",';
  const candidates = [candidateFor(cloneJson(fixtures.validCatalog))];
  const expected = sourcePreflight(rawInvalid, candidates);
  const actual = withObjectPrototypeData({ preflighted: true }, () =>
    preflight(rawInvalid, candidates),
  );
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(
      "PUBLISHER_CAPABILITY_INHERITED_DATA_FAILED",
      "Inherited preflighted data changed an M06-T03 failure.",
    );
  }

  const inheritedDeprecated = withObjectPrototypeData({ deprecated: true }, () =>
    assertCapabilitySuccess(
      callPreflight(preflight, cloneJson(fixtures.validSource), cloneJson(fixtures.validCatalog)),
      "inherited deprecated marker",
      0,
    ),
  );

  const operationAction = {
    type: "operation.invoke",
    operation: "com.example.tasks/reorder",
    as: "inherited",
    input: {},
    onSuccess: [],
    onFailure: [],
  };

  const operationCatalog = cloneJson(fixtures.validCatalog);
  operationCatalog.operations["com.example.tasks/reorder"].deprecated = true;
  const inheritedEventMap = withObjectPrototypeData({ on: { inherited: [operationAction] } }, () =>
    assertCapabilitySuccess(
      callPreflight(preflight, cloneJson(fixtures.validSource), cloneJson(operationCatalog)),
      "inherited event map",
      0,
    ),
  );

  const slotCatalog = cloneJson(fixtures.validCatalog);
  slotCatalog.components["com.example.maps/Map"].deprecated = true;
  const inheritedSlots = withObjectPrototypeData(
    {
      slots: {
        inherited: [
          {
            id: "inherited.map",
            use: "com.example.maps/Map",
            props: {},
            slots: {},
            behaviors: [],
            on: {},
          },
        ],
      },
    },
    () =>
      assertCapabilitySuccess(
        callPreflight(preflight, cloneJson(fixtures.validSource), cloneJson(slotCatalog)),
        "inherited node slots",
        0,
      ),
  );

  const settlementCatalog = cloneJson(fixtures.exampleCatalog);
  settlementCatalog.operations["com.example.tasks/reorder"].deprecated = true;
  const expectedExistingPointer = "/surfaces/tasks/root/behaviors/0/on/reorder/0/operation";
  for (const key of ["onSuccess", "onFailure"]) {
    const result = withObjectPrototypeData({ [key]: [operationAction] }, () =>
      assertCapabilitySuccess(
        callPreflight(preflight, cloneJson(fixtures.exampleSortable), cloneJson(settlementCatalog)),
        `inherited ${key}`,
        1,
      ),
    );
    if (result.diagnostics[0]?.pointer !== expectedExistingPointer) {
      fail(
        "PUBLISHER_CAPABILITY_INHERITED_DATA_FAILED",
        `Inherited ${key} created a phantom operation warning.`,
      );
    }
  }

  const behaviorCatalog = cloneJson(fixtures.validCatalog);
  behaviorCatalog.behaviors["com.example.interactions/Sortable"].deprecated = true;
  const inheritedBehaviorResult = withObjectPrototypeData(
    {
      behaviors: [
        {
          id: "inherited.sortable",
          use: "com.example.interactions/Sortable",
          props: { axis: "vertical" },
        },
      ],
    },
    () =>
      assertCapabilitySuccess(
        callPreflight(preflight, cloneJson(fixtures.validSource), cloneJson(behaviorCatalog)),
        "inherited node behaviors",
        0,
      ),
  );

  return Object.freeze({
    inheritedPreflightedIgnored: true,
    inheritedDeprecatedIgnored: inheritedDeprecated.diagnostics.length === 0,
    inheritedNodeSlotsIgnored: inheritedSlots.diagnostics.length === 0,
    inheritedNodeBehaviorsIgnored: inheritedBehaviorResult.diagnostics.length === 0,
    inheritedEventMapIgnored: inheritedEventMap.diagnostics.length === 0,
    inheritedSettlementHandlersIgnored: true,
    everyT04OptionalTraversalUsesOwnDataGuard: true,
    optionalPropertiesExercisedOneAtATime: true,
    combinedPrototypePollutionSuccessClaimed: false,
    accessorNonObservationClaimed: false,
  });
}

function exactLimits(overrides) {
  return Object.freeze({ ...PUBLISH_SOURCE_PREFLIGHT_LIMITS, ...overrides });
}

function finiteDiagnosticEvidence(preflight, warnings) {
  const { source, catalog } = warnings.fixture;
  const diagnostics = warnings.diagnostics;
  const count = diagnostics.length;
  const pointerCodeUnits = Math.max(...diagnostics.map(({ pointer }) => pointer.length));
  const aggregateCodeUnits = diagnostics.reduce(
    (total, diagnostic) => total + diagnosticCodeUnits(diagnostic),
    0,
  );

  const exactCases = [
    ["count", exactLimits({ maxDiagnosticsPerStoppedStage: count })],
    ["pointer", exactLimits({ maxDiagnosticPointerCodeUnits: pointerCodeUnits })],
    ["aggregate", exactLimits({ maxAggregateDiagnosticCodeUnits: aggregateCodeUnits })],
  ];
  for (const [label, limits] of exactCases) {
    assertCapabilitySuccess(
      callPreflight(preflight, cloneJson(source), cloneJson(catalog), limits),
      `exact ${label} warning ceiling`,
      count,
    );
  }

  const overCases = [
    ["count", exactLimits({ maxDiagnosticsPerStoppedStage: count - 1 })],
    ["pointer", exactLimits({ maxDiagnosticPointerCodeUnits: pointerCodeUnits - 1 })],
    ["aggregate", exactLimits({ maxAggregateDiagnosticCodeUnits: aggregateCodeUnits - 1 })],
  ];
  for (const [label, limits] of overCases) {
    assertFailure(
      callPreflight(preflight, cloneJson(source), cloneJson(catalog), limits),
      {
        stage: CAPABILITY_STAGE,
        code: CAPABILITY_PREFLIGHT_LIMIT_EXCEEDED_CODE,
        pointer: "",
        failureCode: "PUBLISHER_CAPABILITY_LIMIT_VECTOR_FAILED",
      },
      `over ${label} warning ceiling`,
    );
  }

  return Object.freeze({
    defaults: PUBLISH_SOURCE_PREFLIGHT_LIMITS,
    exactAccepted: Object.freeze({
      diagnostics: count,
      pointerCodeUnits,
      aggregateCodeUnits,
    }),
    oneBelowExactRejected: Object.freeze(["diagnostics", "pointer", "aggregate"]),
    overBudgetCode: CAPABILITY_PREFLIGHT_LIMIT_EXCEEDED_CODE,
    overBudgetStage: CAPABILITY_STAGE,
    overBudgetPointer: "",
    warningsNeverTruncated: true,
    failuresExposeNoPartialAuthorityOrBundle: true,
  });
}

function assertPublicPrivacy(publicApi, publisherPackage, publicDeclaration) {
  const forbidden = [
    "CAPABILITY_PREFLIGHT_LIMIT_EXCEEDED_CODE",
    "PublishCapabilityPreflightResult",
    "PublishCapabilityPreflightSuccess",
    "preflightPublishCapabilities",
  ];
  const runtimeExports = Object.keys(publicApi).sort();
  if (
    forbidden.some((name) => runtimeExports.includes(name)) ||
    forbidden.some((name) => publicDeclaration.includes(name))
  ) {
    fail(
      "PUBLISHER_CAPABILITY_PUBLIC_API_EXPOSED",
      "Package-private capability preflight leaked through the Publisher root API.",
    );
  }
  if (
    publicApi.DEPRECATED_CAPABILITY_CODE !== DEPRECATED_CAPABILITY_CODE ||
    publicApi.getPublisherDiagnosticDefinition?.(DEPRECATED_CAPABILITY_CODE)?.defaultStage !==
      CAPABILITY_STAGE ||
    publicApi.getPublisherDiagnosticDefinition?.(DEPRECATED_CAPABILITY_CODE)?.defaultSeverity !==
      "warning"
  ) {
    fail(
      "PUBLISHER_CAPABILITY_WARNING_API_DRIFT",
      "The public deprecation-warning identity or registry definition drifted.",
    );
  }
  if (
    publisherPackage?.exports === null ||
    typeof publisherPackage?.exports !== "object" ||
    Object.keys(publisherPackage.exports).some((key) => key !== ".")
  ) {
    fail(
      "PUBLISHER_CAPABILITY_PUBLIC_API_EXPOSED",
      "Publisher package exports expose a partial capability-preflight subpath.",
    );
  }
  return Object.freeze({
    rootRuntimeExports: Object.freeze(runtimeExports),
    preflightRuntimeExported: false,
    preflightTypeExported: false,
    preflightSubpathExported: false,
    warningCodePublic: true,
    warningRegistryStage: CAPABILITY_STAGE,
    warningRegistrySeverity: "warning",
    packagePrivateDistImportUsedByProof: "packages/publisher/dist/capability-preflight.js",
  });
}

function assertTargetNeutralBoundary(source, publisherPackage) {
  const sourceFile = ts.createSourceFile(
    CAPABILITY_SOURCE_RELATIVE_PATH,
    source,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.TS,
  );
  if (sourceFile.parseDiagnostics.length > 0) {
    fail(
      "PUBLISHER_CAPABILITY_TARGET_BOUNDARY_DRIFT",
      "Capability preflight no longer parses as TypeScript for target-boundary inspection.",
      {
        diagnostics: sourceFile.parseDiagnostics.map(({ messageText }) => String(messageText)),
      },
    );
  }

  const imports = [];
  const ambientRuntimeDeclarations = new Set();
  const diagnosticSuppressionDirectives = new Set();
  const forbiddenPlatformIdentifiers = new Set();
  const tripleSlashReferenceDirectives = new Set();
  const directLoaderForms = new Set();

  for (const directive of sourceFile.commentDirectives ?? []) {
    diagnosticSuppressionDirectives.add(
      directive.type === ts.CommentDirectiveType.ExpectError ? "@ts-expect-error" : "@ts-ignore",
    );
  }
  if (sourceFile.checkJsDirective?.enabled === false) {
    diagnosticSuppressionDirectives.add("@ts-nocheck");
  }
  if (sourceFile.referencedFiles.length > 0) tripleSlashReferenceDirectives.add("path");
  if (sourceFile.typeReferenceDirectives.length > 0) tripleSlashReferenceDirectives.add("types");
  if (sourceFile.libReferenceDirectives.length > 0) tripleSlashReferenceDirectives.add("lib");
  if (sourceFile.amdDependencies.length > 0 || sourceFile.amdModuleName !== undefined) {
    tripleSlashReferenceDirectives.add("amd");
  }

  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier !== undefined
    ) {
      if (!ts.isStringLiteral(node.moduleSpecifier)) {
        directLoaderForms.add("non-literal static module specifier");
      } else {
        imports.push(node.moduleSpecifier.text);
      }
    }
    if (ts.isImportEqualsDeclaration(node)) {
      directLoaderForms.add("import-equals");
    }
    if (ts.isImportTypeNode(node)) {
      directLoaderForms.add("import-type");
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      directLoaderForms.add("dynamic import");
    }
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      (node.expression.text === "require" || node.expression.text === "eval")
    ) {
      directLoaderForms.add(node.expression.text);
    }
    if (
      (ts.isCallExpression(node) || ts.isNewExpression(node)) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "Function"
    ) {
      directLoaderForms.add("Function");
    }
    if (
      (ts.isPropertyAccessExpression(node) && node.name.text === "constructor") ||
      (ts.isElementAccessExpression(node) &&
        (ts.isStringLiteral(node.argumentExpression) ||
          ts.isNoSubstitutionTemplateLiteral(node.argumentExpression)) &&
        node.argumentExpression.text === "constructor") ||
      (ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        node.expression.expression.text === "Reflect" &&
        node.expression.name.text === "get" &&
        node.arguments.length >= 2 &&
        (ts.isStringLiteral(node.arguments[1]) ||
          ts.isNoSubstitutionTemplateLiteral(node.arguments[1])) &&
        node.arguments[1].text === "constructor")
    ) {
      directLoaderForms.add("dynamic constructor access");
    }
    if (node.modifiers?.some(({ kind }) => kind === ts.SyntaxKind.DeclareKeyword)) {
      if (ts.isVariableStatement(node)) ambientRuntimeDeclarations.add("variable");
      if (ts.isFunctionDeclaration(node)) ambientRuntimeDeclarations.add("function");
      if (ts.isClassDeclaration(node)) ambientRuntimeDeclarations.add("class");
      if (ts.isEnumDeclaration(node)) ambientRuntimeDeclarations.add("enum");
      if (ts.isModuleDeclaration(node)) ambientRuntimeDeclarations.add("module");
    }
    if (ts.isIdentifier(node) && FORBIDDEN_CAPABILITY_PLATFORM_IDENTIFIERS.has(node.text)) {
      forbiddenPlatformIdentifiers.add(node.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  imports.sort();

  if (
    imports.some((specifier) => !ALLOWED_CAPABILITY_IMPORTS.includes(specifier)) ||
    ambientRuntimeDeclarations.size > 0 ||
    diagnosticSuppressionDirectives.size > 0 ||
    forbiddenPlatformIdentifiers.size > 0 ||
    tripleSlashReferenceDirectives.size > 0 ||
    directLoaderForms.size > 0
  ) {
    fail(
      "PUBLISHER_CAPABILITY_TARGET_BOUNDARY_DRIFT",
      "Capability preflight acquired a disallowed static edge or direct platform/loader form.",
      {
        ambientRuntimeDeclarations: [...ambientRuntimeDeclarations].sort(),
        diagnosticSuppressionDirectives: [...diagnosticSuppressionDirectives].sort(),
        directLoaderForms: [...directLoaderForms].sort(),
        forbiddenPlatformIdentifiers: [...forbiddenPlatformIdentifiers].sort(),
        imports,
        tripleSlashReferenceDirectives: [...tripleSlashReferenceDirectives].sort(),
      },
    );
  }
  const dependencies = Object.keys(publisherPackage?.dependencies ?? {}).sort();
  if (JSON.stringify(dependencies) !== JSON.stringify(["@desen/protocol", "@desen/validator"])) {
    fail(
      "PUBLISHER_CAPABILITY_TARGET_BOUNDARY_DRIFT",
      "Publisher production dependencies are no longer target-neutral.",
    );
  }
  return Object.freeze({
    imports: Object.freeze(imports),
    productionDependencies: Object.freeze(dependencies),
    inspectionMethod: "TypeScript AST direct-form audit",
    inspectionScope: Object.freeze([
      "static import and re-export specifiers",
      "exact production dependency names",
      "enumerated direct platform identifiers",
      "direct dynamic-loader and constructor forms",
      "ambient runtime value declarations",
      "TypeScript diagnostic-suppression directives",
      "triple-slash reference directives",
    ]),
    unexpectedStaticImports: Object.freeze([]),
    enumeratedPlatformIdentifiersObserved: Object.freeze([]),
    directLoaderFormsObserved: Object.freeze([]),
    ambientRuntimeDeclarationsObserved: Object.freeze([]),
    diagnosticSuppressionDirectivesObserved: Object.freeze([]),
    tripleSlashReferenceDirectivesObserved: Object.freeze([]),
    exhaustiveJavaScriptSandboxClaim: false,
  });
}

async function verifyPrerequisitePins(enabled) {
  const evidence = [];
  for (const prerequisite of PREREQUISITES) {
    const bytes = await readRegularBytes(prerequisite.path);
    const actual = sha256(bytes);
    if (enabled && actual !== prerequisite.sha256) {
      fail(
        "PUBLISHER_CAPABILITY_PREREQUISITE_DRIFT",
        `Pinned prerequisite drifted: ${prerequisite.task}`,
        { expected: prerequisite.sha256, actual },
      );
    }
    evidence.push(
      Object.freeze({
        ...prerequisite,
        verifiedSha256: actual,
        matchesPin: actual === prerequisite.sha256,
      }),
    );
  }
  return Object.freeze(evidence);
}

async function fileInventory() {
  const inventory = [];
  for (const relativePath of [...new Set(TRACKED_PATHS)].sort()) {
    const bytes = await readRegularBytes(relativePath);
    inventory.push(
      Object.freeze({
        path: relativePath,
        bytes: bytes.byteLength,
        sha256: sha256(bytes),
      }),
    );
  }
  return Object.freeze(inventory);
}

async function testInventory() {
  const [packageTest, typeTest, rootTest, componentTest, interactionTest, microTest] =
    await Promise.all([
      readRegularBytes("packages/publisher/test/capability-preflight.test.ts").then((bytes) =>
        bytes.toString("utf8"),
      ),
      readRegularBytes("packages/publisher/test/capability-preflight.types.ts").then((bytes) =>
        bytes.toString("utf8"),
      ),
      readRegularBytes("tests/publisher-capability-preflight.test.mjs").then((bytes) =>
        bytes.toString("utf8"),
      ),
      readRegularBytes("packages/validator/test/component-contracts.test.ts").then((bytes) =>
        bytes.toString("utf8"),
      ),
      readRegularBytes("packages/validator/test/interaction-contracts.test.ts").then((bytes) =>
        bytes.toString("utf8"),
      ),
      readRegularBytes("packages/validator/test/diagnostic-micro-vectors.test.ts").then((bytes) =>
        bytes.toString("utf8"),
      ),
    ]);
  return Object.freeze({
    publisherRuntimeCases: (packageTest.match(/^\s*it\("/gmu) ?? []).length,
    compilerNegativeCases: (typeTest.match(/@ts-expect-error/gu) ?? []).length,
    validatorComponentCases: (componentTest.match(/^\s*it\("/gmu) ?? []).length,
    validatorInteractionCases: (interactionTest.match(/^\s*it\("/gmu) ?? []).length,
    validatorDiagnosticMicroVectorCases: (microTest.match(/^\s*it\("/gmu) ?? []).length,
    rootMutationCases: (rootTest.match(/^test\("/gmu) ?? []).length,
  });
}

function countExactOccurrences(text, value) {
  return text.split(value).length - 1;
}

function assertProofDocumentPin(proofDocument, artifactSha256) {
  if (typeof proofDocument !== "string") {
    fail(
      "PUBLISHER_CAPABILITY_PROOF_DOCUMENT_INVALID",
      "The capability-preflight proof document must be text.",
    );
  }
  const expectedHash = `sha256:${artifactSha256}`;
  const digestPins = proofDocument.match(/sha256:[0-9a-f]{64}/gu) ?? [];
  if (
    countExactOccurrences(proofDocument, `\`${ARTIFACT_RELATIVE_PATH}\``) !== 1 ||
    countExactOccurrences(proofDocument, `\`${expectedHash}\``) !== 1 ||
    digestPins.length !== 1 ||
    digestPins[0] !== expectedHash ||
    proofDocument.includes("PENDING_M06_T04_ARTIFACT_SHA256")
  ) {
    fail(
      "PUBLISHER_CAPABILITY_PROOF_DOCUMENT_DRIFT",
      "The capability-preflight proof document does not uniquely pin the artifact and hash.",
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
  const pairs = [
    [fixtures.officialSource, fixtures.referenceCatalog],
    [fixtures.validSource, fixtures.validCatalog],
    [fixtures.exampleSignIn, fixtures.exampleCatalog],
    [fixtures.exampleSortable, fixtures.exampleCatalog],
    [fixtures.exampleStoreMap, fixtures.exampleCatalog],
  ];
  for (const [source, catalog] of pairs) {
    const requirement = source?.catalogs?.[0];
    if (
      !source?.id ||
      !requirement ||
      requirement.id !== catalog?.id ||
      requirement.version !== catalog?.version ||
      requirement.target !== catalog?.target ||
      typeof catalog?.packageDigest !== "string"
    ) {
      fail(
        "PUBLISHER_CAPABILITY_FIXTURE_DRIFT",
        "A tracked Source/Catalog pair no longer carries the expected exact tuple.",
      );
    }
  }
}

/**
 * Builds deterministic M06-T04 evidence from public Validator prerequisites and the shipped
 * package-private Publisher capability preflight.
 */
export async function buildPublisherCapabilityPreflightEvidence(rawOptions = undefined) {
  const options = captureOptions(rawOptions);
  const [
    fixturesDefault,
    publisherPackageDefault,
    capabilitySourceDefault,
    capabilityDeclarationDefault,
    publicDeclarationDefault,
  ] = await Promise.all([
    defaultFixtures(),
    readJson(PUBLISHER_PACKAGE_RELATIVE_PATH),
    readRegularBytes(CAPABILITY_SOURCE_RELATIVE_PATH).then((bytes) => bytes.toString("utf8")),
    readRegularBytes(CAPABILITY_DECLARATION_RELATIVE_PATH).then((bytes) => bytes.toString("utf8")),
    readRegularBytes(PUBLIC_DECLARATION_RELATIVE_PATH).then((bytes) => bytes.toString("utf8")),
  ]);

  const fixtures = cloneJson(options.fixtures ?? fixturesDefault);
  const publisherPackage = cloneJson(options.publisherPackage ?? publisherPackageDefault);
  const capabilitySource = options.capabilitySource ?? capabilitySourceDefault;
  const capabilityDeclaration = options.capabilityDeclaration ?? capabilityDeclarationDefault;
  const publicDeclaration = options.publicDeclaration ?? publicDeclarationDefault;
  const preflight = options.preflight ?? preflightPublishCapabilities;
  const sourcePreflight = options.sourcePreflight ?? preflightPublishSource;
  const validatorApi = options.validatorApi ?? validatorPublicApi;
  const publicApi = options.publicApi ?? publisherPublicApi;

  if (
    typeof preflight !== "function" ||
    typeof sourcePreflight !== "function" ||
    typeof capabilitySource !== "string" ||
    typeof capabilityDeclaration !== "string" ||
    typeof publicDeclaration !== "string" ||
    typeof validatorApi?.validateDesenInteractionCatalogSet !== "function" ||
    typeof validatorApi?.validateDesenSourceInteractionContracts !== "function" ||
    typeof validatorApi?.validatePreparedDesenSourceReferences !== "function"
  ) {
    fail("PUBLISHER_CAPABILITY_OPTIONS_INVALID", "Evidence overrides have invalid types.");
  }

  assertFixtureIdentity(fixtures);
  const prerequisites = await verifyPrerequisitePins(options.verifyPrerequisites !== false);
  const exactAuthority = exactAuthorityEvidence(
    preflight,
    validatorApi,
    fixtures.officialSource,
    fixtures.referenceCatalog,
  );
  const fixtureCorpus = fixtureCorpusEvidence(preflight, validatorApi, fixtures);
  const inheritedT03 = inheritedT03FailureEvidence(
    preflight,
    sourcePreflight,
    fixtures.validSource,
    fixtures.validCatalog,
  );
  const staticFailures = staticContractFailureEvidence(preflight, validatorApi, fixtures);
  const warnings = warningEvidence(preflight, validatorApi, fixtures);
  const finiteProfile = finiteDiagnosticEvidence(preflight, warnings);
  const inheritedOptionalData = inheritedOptionalDataEvidence(
    preflight,
    sourcePreflight,
    fixtures,
    capabilitySource,
  );
  const apiPrivacy = assertPublicPrivacy(publicApi, publisherPackage, publicDeclaration);
  const targetNeutralBoundary = assertTargetNeutralBoundary(capabilitySource, publisherPackage);

  if (
    !capabilityDeclaration.includes("PublishCapabilityPreflightSuccess") ||
    !capabilityDeclaration.includes("DesenValidatedInteractionCatalogSet") ||
    !capabilityDeclaration.includes("PublishCapabilityPreflightResult") ||
    !capabilityDeclaration.includes("PublishWarningDiagnostic")
  ) {
    fail(
      "PUBLISHER_CAPABILITY_DECLARATION_DRIFT",
      "Built package-private declarations no longer document exact static authority and warnings.",
    );
  }

  const artifact = Object.freeze({
    schemaVersion: 1,
    profile: "desen.publisher.capability-preflight-proof.v1",
    task: "M06-T04",
    result: "PASS",
    summary:
      "The built package-private Publisher capability preflight reuses public Validator component and interaction contracts, retains exact M06-T03 authority, emits safe deterministic deprecation warnings, and exposes no Bundle or dynamic obligations.",
    prerequisites,
    fixtures: Object.freeze({
      paths: FIXTURE_PATHS,
      accepted: fixtureCorpus,
    }),
    claims: Object.freeze({
      exactNonterminalAuthority: exactAuthority,
      inheritedM06T03FailurePassThrough: inheritedT03,
      publicValidatorAndPublisherStaticFailureMatrix: staticFailures,
      safeDeterministicDeprecationWarnings: Object.freeze({
        warningCount: warnings.warningCount,
        pointers: warnings.pointers,
        componentTrueWarned: warnings.componentTrueWarned,
        nestedComponentWarned: warnings.nestedComponentWarned,
        behaviorStringWarned: warnings.behaviorStringWarned,
        behaviorSlotComponentWarned: warnings.behaviorSlotComponentWarned,
        resourceTrueWarned: warnings.resourceTrueWarned,
        operationTopLevelWarned: warnings.operationTopLevelWarned,
        operationNestedWarned: warnings.operationNestedWarned,
        explicitFalseWarnings: warnings.explicitFalseWarnings,
        warningMessageFixed: warnings.warningMessageFixed,
        catalogProseRedacted: warnings.catalogProseRedacted,
        replacementNotSelectedOrDisclosed: warnings.replacementNotSelectedOrDisclosed,
        sortedAndDeduplicated: warnings.sortedAndDeduplicated,
        repeatedWarningsByteIdentical: warnings.repeatedWarningsByteIdentical,
      }),
      exactAndOverDiagnosticCeilings: finiteProfile,
      inheritedOptionalDataIgnored: inheritedOptionalData,
      failuresExposeNoPartialAuthorityOrBundle: true,
      dynamicObligationsNotExposed: true,
      rootApiPrivacy: apiPrivacy,
      targetNeutralDependencyBoundary: targetNeutralBoundary,
    }),
    pipelineOwnership: Object.freeze({
      trace: "PIPE-032",
      publicationStep: 8,
      m06T04ComponentAndInteractionSlice: "COMPLETE",
      includes: Object.freeze([
        "component props, slots, styles, visual states, events, and statically known commands",
        "behavior props, slots, styles, events, attachment rules, and conflicts",
        "safe Catalog contract-schema preparation",
        "non-blocking deprecated capability warnings",
      ]),
      m06T05ResourceAndOperationContractSlice: "DEFERRED",
      m06T05DynamicBindingCompatibilityAndRuntimeObligations: "DEFERRED",
      rationale:
        "M06-T04 proves only component and interaction contracts that are statically knowable; resource/operation receiving schemas and dynamic values require M06-T05 compatibility analysis and explicit runtime obligations.",
    }),
    nonclaims: Object.freeze([
      "M06-T04 remains package-private and nonterminal; it does not expose a public publish function or emit a Bundle.",
      "M06-T04 does not discharge or expose dynamic binding, state, predicate, repeat, action, resource, operation, or runtime validation obligations assigned to M06-T05.",
      "M06-T04 does not validate resource/operation input, output, error, policy, effect, lifecycle, or settlement contracts assigned to M06-T05 and later runtime owners.",
      "Deprecation warnings do not select or follow replacement capabilities and do not claim removal compatibility.",
      "M06-T04 does not normalize Source data, calculate digests, pin Bundle tuples, validate a Bundle, calculate a revision, or emit a Bundle.",
      "The target-boundary source audit is not a JavaScript sandbox and does not claim exhaustive detection of intentionally obfuscated reflection, metaprogramming, or runtime code generation.",
      "M06-T04 performs no network discovery, package download, activation, rendering, signing, npm publication, or deployment.",
    ]),
    tests: await testInventory(),
    trackedFiles: await fileInventory(),
    reproduction: Object.freeze([
      "pnpm --filter @desen/validator build",
      "pnpm --filter @desen/validator test:component-contracts",
      "pnpm --filter @desen/validator test:interaction-contracts",
      "pnpm --filter @desen/publisher build",
      "pnpm --filter @desen/publisher typecheck",
      "pnpm --filter @desen/publisher test:capability-preflight",
      "node scripts/generate-publisher-capability-preflight-proof.mjs",
      "node scripts/verify-publisher-capability-preflight.mjs",
      "node --test tests/publisher-capability-preflight.test.mjs",
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
export async function verifyPublisherCapabilityPreflightEvidence(rawOptions = undefined) {
  const options = captureOptions(rawOptions);
  const built = await buildPublisherCapabilityPreflightEvidence(options);
  const artifactBytes =
    options.artifactBytes === undefined
      ? await readRegularBytes(ARTIFACT_RELATIVE_PATH)
      : Buffer.from(options.artifactBytes);
  if (!artifactBytes.equals(built.artifactBytes)) {
    fail(
      "PUBLISHER_CAPABILITY_ARTIFACT_DRIFT",
      "Tracked capability-preflight evidence differs from a fresh deterministic build.",
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
    proofVectors: 11,
    trackedFiles: built.artifact.trackedFiles.length,
    tests: built.artifact.tests,
    acceptedFixtures: built.artifact.fixtures.accepted.length,
    staticFailureVectors:
      built.artifact.claims.publicValidatorAndPublisherStaticFailureMatrix.length,
    warningVectors: built.artifact.claims.safeDeterministicDeprecationWarnings.warningCount,
    proofDocumentPinned: true,
  });
}

/** Atomically writes exact deterministic M06-T04 evidence bytes. */
export async function writePublisherCapabilityPreflightEvidence(rawOptions = undefined) {
  const options = captureOptions(rawOptions);
  const built = await buildPublisherCapabilityPreflightEvidence(options);
  const artifactPath = options.artifactPath ?? DEFAULT_PUBLISHER_CAPABILITY_PREFLIGHT_ARTIFACT_PATH;
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
