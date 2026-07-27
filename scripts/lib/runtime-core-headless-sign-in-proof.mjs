import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";

import { format } from "prettier";
import ts from "typescript";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";
import { verifyProtocolInteractionNormativeCompatibility } from "./protocol-interaction-contracts-proof.mjs";
import { verifyReferenceCatalogWebParityNormativeCompatibility } from "./reference-catalog-web-parity-proof.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const RUNTIME_API_URL = new URL("../../packages/runtime-core/dist/index.js", import.meta.url);
const PROTOCOL_API_URL = new URL("../../packages/protocol/dist/index.js", import.meta.url);
const BUNDLE_PATH =
  "packages/protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.bundle.json";
const CATALOG_PATH = "packages/protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json";

/** Absolute path to deterministic M04-T16/G04 headless sign-in evidence. */
export const DEFAULT_RUNTIME_CORE_HEADLESS_SIGN_IN_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/artifacts/runtime-core-0.1.0-headless-sign-in.json",
);
const HISTORICAL_ARTIFACT_SHA256 =
  "bdda1b2d0c4630a1a6708b2e6bb9a9ecdca0c2efca3615ca4cf69cee871170a4";

const PREREQUISITES = Object.freeze([
  Object.freeze({
    key: "tokenFormat",
    task: "M04-T03",
    path: "docs/proof/artifacts/runtime-core-0.1.0-token-format-resolution.json",
    artifact: "runtime-core-0.1.0-token-format-resolution.json",
    sha256: "be2d07ae32537ef5c2aec04c783f2cfb30cbcc500a85020172e2b8715a98800f",
  }),
  Object.freeze({
    key: "predicate",
    task: "M04-T04",
    path: "docs/proof/artifacts/runtime-core-0.1.0-predicate-evaluation.json",
    artifact: "runtime-core-0.1.0-predicate-evaluation.json",
    sha256: "14b74cd4f0c35e76edd77858443edf8515b3a60a247afe75131095d5a0c3bcf1",
  }),
  Object.freeze({
    key: "variantStyle",
    task: "M04-T05",
    path: "docs/proof/artifacts/runtime-core-0.1.0-variant-style-evaluation.json",
    artifact: "runtime-core-0.1.0-variant-style-evaluation.json",
    sha256: "46fb343d6639998c1b75403271a0e765c214b32880385ebe30bd649bd60d369e",
  }),
  Object.freeze({
    key: "localState",
    task: "M04-T06",
    path: "docs/proof/artifacts/runtime-core-0.1.0-local-state-identity.json",
    artifact: "runtime-core-0.1.0-local-state-identity.json",
    sha256: "4183404aa991af06740a22bc62ff42028ed584edd6feb158095408904a764b13",
  }),
  Object.freeze({
    key: "repeat",
    task: "M04-T07",
    path: "docs/proof/artifacts/runtime-core-0.1.0-repeat-materialization.json",
    artifact: "runtime-core-0.1.0-repeat-materialization.json",
    sha256: "45ba72f21f936931d087982d8a52e6b4d226a33ed5693c2d3d6bf9158fddb02d",
  }),
  Object.freeze({
    key: "resource",
    task: "M04-T08",
    path: "docs/proof/artifacts/runtime-core-0.1.0-resource-lifecycle.json",
    artifact: "runtime-core-0.1.0-resource-lifecycle.json",
    sha256: "2d6ab2e5b6a480e922425faa109e13cc5d388a5de00b2604cbfec62345b01c82",
  }),
  Object.freeze({
    key: "operation",
    task: "M04-T09",
    path: "docs/proof/artifacts/runtime-core-0.1.0-operation-lifecycle.json",
    artifact: "runtime-core-0.1.0-operation-lifecycle.json",
    sha256: "7b2300a78bb9903abe1f182792362d374edb5b948ee9f8f69dc018ccf9cc8301",
  }),
  Object.freeze({
    key: "stateNavigation",
    task: "M04-T10",
    path: "docs/proof/artifacts/runtime-core-0.1.0-state-navigation-actions.json",
    artifact: "runtime-core-0.1.0-state-navigation-actions.json",
    sha256: "f9eddfdf915ace33d77df6491de39ad84e9d60d56e2269433c223a79696ad140",
  }),
  Object.freeze({
    key: "operationResource",
    task: "M04-T11",
    path: "docs/proof/artifacts/runtime-core-0.1.0-operation-resource-actions.json",
    artifact: "runtime-core-0.1.0-operation-resource-actions.json",
    sha256: "b955cc9f3399d2dbb1895036828c6ab01dbd78ac198c3be5824720f2802295a7",
  }),
  Object.freeze({
    key: "commandEvent",
    task: "M04-T12",
    path: "docs/proof/artifacts/runtime-core-0.1.0-command-event-actions.json",
    artifact: "runtime-core-0.1.0-command-event-actions.json",
    sha256: "8098184e5c25857a108e93dd4638556f1af0446fad9847b8ce44c9f8c2d79be4",
  }),
  Object.freeze({
    key: "actionTurns",
    task: "M04-T13",
    path: "docs/proof/artifacts/runtime-core-0.1.0-action-turns.json",
    artifact: "runtime-core-0.1.0-action-turns.json",
    sha256: "5b2f95b897116fdd9ff5320d8720e104d7b93f148d28bfcaf067c838785f9d87",
  }),
  Object.freeze({
    key: "adapterBridges",
    task: "M04-T14",
    path: "docs/proof/artifacts/runtime-core-0.1.0-adapter-bridges.json",
    artifact: "runtime-core-0.1.0-adapter-bridges.json",
    sha256: "bfdeddbffd458941464620e0af2013d374bf8e64068ca060d33651ddeb2660c7",
  }),
  Object.freeze({
    key: "reactiveReevaluation",
    task: "M04-T15",
    path: "docs/proof/artifacts/runtime-core-0.1.0-reactive-reevaluation.json",
    artifact: "runtime-core-0.1.0-reactive-reevaluation.json",
    sha256: "7e412daf9e2e8f08f40a4b093430775414aa1df4a9b14d690d2bf45966cbec67",
  }),
]);

const SOURCE_PATHS = Object.freeze([
  "packages/runtime-core/src/headless-materialization.ts",
  "packages/runtime-core/src/headless-session.ts",
]);
const FOCUSED_TEST_PATHS = Object.freeze([
  "packages/runtime-core/test/headless-materialization.test.ts",
  "packages/runtime-core/test/headless-session.test.ts",
]);
const TYPE_TEST_PATH = "packages/runtime-core/test/headless-session.types.ts";
const ROOT_TEST_PATH = "tests/runtime-core-headless-sign-in.test.mjs";
const PROOF_LIBRARY_PATH = "scripts/lib/runtime-core-headless-sign-in-proof.mjs";
const PROOF_GENERATOR_PATH = "scripts/generate-runtime-core-headless-sign-in-proof.mjs";
const PROOF_VERIFIER_PATH = "scripts/verify-runtime-core-headless-sign-in.mjs";
const PROOF_DOCUMENT_PATH = "docs/proof/RUNTIME-CORE-HEADLESS-SIGN-IN.md";
const PROOF_MATRIX_PATH = "docs/proof/PROOF-MATRIX.md";
const ARTIFACT_RELATIVE_PATH = "docs/proof/artifacts/runtime-core-0.1.0-headless-sign-in.json";
const ARTIFACT_FILE_NAME = "runtime-core-0.1.0-headless-sign-in.json";
const HISTORICAL_TRACE_ARTIFACT_PATH = "docs/proof/artifacts/protocol-0.1.0-traceability.json";
const HISTORICAL_TRACE_LEDGER_SHA256 =
  "40d091d7acbe1f6ae6dbc9570c8ebc9b70dc32a42b7e46b39095ad6d562cd147";
const HISTORICAL_TRACE_ARTIFACT_SHA256 =
  "749cbae719a5deb216e9ed3be171eb710b47fc547f4f270dbba21bb14c2af514";
const HISTORICAL_INTERACTION_ARTIFACT_PATH =
  "docs/proof/artifacts/protocol-0.1.0-interaction-contracts.json";
const HISTORICAL_INTERACTION_ARTIFACT_SHA256 =
  "981e1d59dd68e32639055b1267880cc1e6ebb3a76ad1176298990b28fe048208";
const TRANSFERRED_INTERACTION_VERIFIER_PATHS = Object.freeze([
  "scripts/lib/protocol-interaction-contracts-proof.mjs",
  "tests/protocol-interaction-contracts.test.mjs",
]);
const HISTORICAL_REFERENCE_PARITY_ARTIFACT_PATH =
  "docs/proof/artifacts/reference-catalog-web-parity.json";
const HISTORICAL_REFERENCE_PARITY_ARTIFACT_SHA256 =
  "6e350f2af71ac4e1f040afe7a3fcc3035de35b585f0121db6a2b35b4f3552a8a";
const TRANSFERRED_REFERENCE_PARITY_VERIFIER_PATHS = Object.freeze([
  "scripts/lib/reference-catalog-web-parity-proof.mjs",
  "tests/reference-catalog-web-parity.test.mjs",
]);

const MODULE_EXPORTS = Object.freeze({
  "./headless-materialization.js": Object.freeze({
    runtime: Object.freeze([
      "RUNTIME_HEADLESS_MATERIALIZATION_LIMITS",
      "materializeRuntimeHeadlessSurface",
      "readRuntimeHeadlessMaterializationSidecar",
    ]),
    types: Object.freeze([
      "RuntimeHeadlessBehaviorBindingIntent",
      "RuntimeHeadlessBehaviorPlan",
      "RuntimeHeadlessBindingIntent",
      "RuntimeHeadlessBindingScope",
      "RuntimeHeadlessComponentBindingIntent",
      "RuntimeHeadlessMaterializationCommitment",
      "RuntimeHeadlessMaterializationInput",
      "RuntimeHeadlessMaterializationInvalidReason",
      "RuntimeHeadlessMaterializationLimitProfile",
      "RuntimeHeadlessMaterializationLimitReason",
      "RuntimeHeadlessMaterializationResult",
      "RuntimeHeadlessMaterializationSidecar",
      "RuntimeHeadlessMaterializationSidecarReadResult",
      "RuntimeHeadlessNodePlan",
      "RuntimeHeadlessSurfacePlan",
    ]),
  }),
  "./headless-session.js": Object.freeze({
    runtime: Object.freeze([
      "RUNTIME_HEADLESS_SESSION_LIMITS",
      "dispatchRuntimeHeadlessSessionEvent",
      "disposeRuntimeHeadlessSession",
      "mountRuntimeHeadlessSession",
      "readRuntimeHeadlessSession",
    ]),
    types: Object.freeze([
      "RuntimeHeadlessBindingSnapshot",
      "RuntimeHeadlessSessionDisposeResult",
      "RuntimeHeadlessSessionEventCompletion",
      "RuntimeHeadlessSessionEventInput",
      "RuntimeHeadlessSessionEventResult",
      "RuntimeHeadlessSessionHandle",
      "RuntimeHeadlessSessionLimitProfile",
      "RuntimeHeadlessSessionMountInput",
      "RuntimeHeadlessSessionMountInvalidReason",
      "RuntimeHeadlessSessionMountResult",
      "RuntimeHeadlessSessionReadResult",
      "RuntimeHeadlessSessionSnapshot",
    ]),
  }),
});
const APPROVED_MODULE_EXPORTS = Object.freeze({
  ...MODULE_EXPORTS,
  "./headless-session.js": Object.freeze({
    runtime: Object.freeze([
      ...MODULE_EXPORTS["./headless-session.js"].runtime,
      "authenticateRuntimeHeadlessSessionAdapterAuthority",
      "subscribeRuntimeHeadlessSession",
      "unsubscribeRuntimeHeadlessSession",
    ]),
    types: Object.freeze([
      ...MODULE_EXPORTS["./headless-session.js"].types,
      "RuntimeHeadlessSessionAdapterAuthorityInput",
      "RuntimeHeadlessSessionAdapterAuthorityResult",
      "RuntimeHeadlessSessionListener",
      "RuntimeHeadlessSessionSubscribeResult",
      "RuntimeHeadlessSessionSubscription",
      "RuntimeHeadlessSessionUnsubscribeResult",
    ]),
  }),
});
const INTERNAL_EXPORTS = Object.freeze([
  "readRuntimeHeadlessMaterializationSidecar",
  "subscribeRuntimeActionTurnSettlements",
  "RuntimeActionTurnSettlementPublication",
  "RuntimeActionTurnSettlementSubscriptionResult",
]);
const PUBLIC_RUNTIME_EXPORTS = Object.freeze([
  "RUNTIME_HEADLESS_MATERIALIZATION_LIMITS",
  "RUNTIME_HEADLESS_SESSION_LIMITS",
  "dispatchRuntimeHeadlessSessionEvent",
  "disposeRuntimeHeadlessSession",
  "materializeRuntimeHeadlessSurface",
  "mountRuntimeHeadlessSession",
  "readRuntimeHeadlessSession",
]);
const PUBLIC_TYPE_EXPORTS = Object.freeze([
  "RuntimeHeadlessBehaviorPlan",
  "RuntimeHeadlessMaterializationCommitment",
  "RuntimeHeadlessMaterializationInput",
  "RuntimeHeadlessMaterializationInvalidReason",
  "RuntimeHeadlessMaterializationLimitProfile",
  "RuntimeHeadlessMaterializationLimitReason",
  "RuntimeHeadlessMaterializationResult",
  "RuntimeHeadlessMaterializationSidecar",
  "RuntimeHeadlessNodePlan",
  "RuntimeHeadlessBindingSnapshot",
  "RuntimeHeadlessSessionDisposeResult",
  "RuntimeHeadlessSessionEventCompletion",
  "RuntimeHeadlessSessionEventInput",
  "RuntimeHeadlessSessionEventResult",
  "RuntimeHeadlessSessionHandle",
  "RuntimeHeadlessSessionLimitProfile",
  "RuntimeHeadlessSessionMountInput",
  "RuntimeHeadlessSessionMountInvalidReason",
  "RuntimeHeadlessSessionMountResult",
  "RuntimeHeadlessSessionReadResult",
  "RuntimeHeadlessSessionSnapshot",
  "RuntimeHeadlessSurfacePlan",
]);
const APPROVED_PUBLIC_RUNTIME_EXPORTS = Object.freeze([
  ...PUBLIC_RUNTIME_EXPORTS,
  "authenticateRuntimeHeadlessSessionAdapterAuthority",
  "subscribeRuntimeHeadlessSession",
  "unsubscribeRuntimeHeadlessSession",
]);
const APPROVED_PUBLIC_TYPE_EXPORTS = Object.freeze([
  ...PUBLIC_TYPE_EXPORTS,
  "RuntimeHeadlessSessionAdapterAuthorityInput",
  "RuntimeHeadlessSessionAdapterAuthorityResult",
  "RuntimeHeadlessSessionListener",
  "RuntimeHeadlessSessionSubscribeResult",
  "RuntimeHeadlessSessionSubscription",
  "RuntimeHeadlessSessionUnsubscribeResult",
]);
const AUDITED_TRACE_ASSIGNMENTS = Object.freeze({
  schemaNonConstraintDecisions: Object.freeze(["SN-005"]),
  conformanceRules: Object.freeze(["C-023"]),
  pipelineSteps: Object.freeze([
    "PIPE-008",
    "PIPE-018",
    "PIPE-019",
    "PIPE-020",
    "PIPE-021",
    "PIPE-023",
    "PIPE-024",
  ]),
  proseRules: Object.freeze([
    "R-009",
    "R-026",
    "R-039",
    "R-040",
    "R-041",
    "R-042",
    "R-043",
    "R-044",
    "R-045",
    "R-046",
    "R-047",
    "R-048",
    "R-049",
    "R-050",
    "R-051",
    "R-052",
    "R-053",
    "R-054",
    "R-055",
    "R-059",
    "R-060",
    "R-061",
    "R-062",
    "R-067",
    "R-073",
    "R-074",
    "R-075",
    "R-076",
    "R-077",
    "R-078",
    "R-079",
    "R-080",
    "R-081",
    "R-089",
    "R-103",
    "R-104",
    "R-105",
    "R-106",
    "R-111",
    "R-112",
    "R-114",
    "R-120",
    "R-122",
    "R-128",
    "R-129",
    "R-146",
  ]),
  invariants: Object.freeze(["A-006", "A-011"]),
  diagnostics: Object.freeze([
    "D-009",
    "D-014",
    "D-015",
    "D-016",
    "D-019",
    "D-020",
    "D-021",
    "D-022",
    "D-023",
    "D-024",
    "D-025",
    "D-026",
    "D-027",
    "D-028",
    "D-029",
  ]),
});
const M04_T16_OWNER_IDS = Object.freeze(["C-023", "PIPE-008", "R-009", "R-111", "R-128", "R-146"]);
const M04_T16_OWNER_ONLY_IDS = Object.freeze(["C-023", "PIPE-008"]);
const FUTURE_DEFERRED_TRACE_RULES = Object.freeze({
  "D-009": Object.freeze(["M05-T06", "M06-T11"]),
  "R-048": Object.freeze(["M05-T02"]),
  "R-104": Object.freeze(["M05-T05"]),
  "R-129": Object.freeze(["M12-T05"]),
  "A-011": Object.freeze(["M05-T08", "M06-T11", "M12-T08"]),
});
const M04_T16_INTEGRATION_RULE_IDS = Object.freeze([
  "C-023",
  "PIPE-008",
  "PIPE-018",
  "PIPE-019",
  "PIPE-020",
  "PIPE-021",
  "PIPE-023",
  "PIPE-024",
  "R-009",
  "R-039",
  "R-040",
  "R-041",
  "R-043",
  "R-044",
  "R-045",
  "R-046",
  "R-047",
  "R-049",
  "R-050",
  "R-051",
  "R-053",
  "R-054",
  "R-059",
  "R-060",
  "R-061",
  "R-062",
  "R-074",
  "R-076",
  "R-077",
  "R-078",
  "R-103",
  "R-111",
  "R-112",
  "R-114",
  "R-120",
  "R-128",
  "R-146",
  "D-014",
  "D-020",
  "D-022",
  "D-023",
]);

const FORBIDDEN_RUNTIME_IDENTIFIERS = Object.freeze([
  "React",
  "document",
  "window",
  "navigator",
  "HTMLElement",
  "NodeList",
  "setTimeout",
  "setInterval",
  "requestAnimationFrame",
  "queueMicrotask",
  "process",
  "Buffer",
  "Deno",
  "Bun",
  "eval",
  "Function",
  "SwiftUI",
  "UIKit",
  "android",
]);

/** Controlled deterministic M04-T16/G04 evidence failure. */
export class RuntimeCoreHeadlessSignInEvidenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "RuntimeCoreHeadlessSignInEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new RuntimeCoreHeadlessSignInEvidenceError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function normalizeOptions(options) {
  if (options === undefined) return {};
  if (options === null || typeof options !== "object" || Array.isArray(options)) {
    fail("HEADLESS_OPTIONS_INVALID", "Evidence options must be an object.");
  }
  return options;
}

async function readWorkspaceBytes(relativePath, fileOverrides) {
  const overridden = fileOverrides?.[relativePath];
  if (overridden !== undefined) {
    return Buffer.isBuffer(overridden) ? overridden : Buffer.from(overridden);
  }
  return readFile(path.join(WORKSPACE_ROOT, relativePath));
}

async function readWorkspaceText(relativePath, fileOverrides) {
  return (await readWorkspaceBytes(relativePath, fileOverrides)).toString("utf8");
}

function parseJson(text, code, label) {
  try {
    return JSON.parse(text);
  } catch (error) {
    fail(code, `${label} must be valid JSON.`, { cause: String(error) });
  }
}

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function sameStrings(actual, expected) {
  return isDeepStrictEqual(sorted(actual), sorted(expected));
}

function assertIncludes(text, needle, code, message = undefined) {
  if (!text.includes(needle)) {
    fail(code, message ?? `Required evidence anchor is missing: ${needle}`);
  }
}

function exactProofArtifactSha256(markdown) {
  const sectionMarker = "## Evidence boundary";
  const sectionStart = markdown.indexOf(sectionMarker);
  if (sectionStart < 0 || markdown.lastIndexOf(sectionMarker) !== sectionStart) {
    fail(
      "HEADLESS_ARTIFACT_REFERENCE_DRIFT",
      "The M04-T16 proof must contain one exact Evidence boundary section.",
    );
  }
  const afterSectionMarker = sectionStart + sectionMarker.length;
  const nextHeadingOffset = markdown.slice(afterSectionMarker).search(/^## /mu);
  const sectionEnd =
    nextHeadingOffset < 0 ? markdown.length : afterSectionMarker + nextHeadingOffset;
  const sectionLines = markdown.slice(sectionStart, sectionEnd).split(/\r?\n/u);
  const lines = markdown.split(/\r?\n/u);
  const artifactLine = `\`${ARTIFACT_RELATIVE_PATH}\`.`;
  const artifactIndexes = lines.flatMap((line, index) => (line === artifactLine ? [index] : []));
  const sectionArtifactIndexes = sectionLines.flatMap((line, index) =>
    line === artifactLine ? [index] : [],
  );
  const shaLines = lines.flatMap((line) => {
    const match = line.match(/^Its SHA-256 is `([0-9a-f]{64})`\.$/u);
    return match === null ? [] : [match[1]];
  });
  const sectionShaLines = sectionLines.flatMap((line, index) => {
    const match = line.match(/^Its SHA-256 is `([0-9a-f]{64})`\.$/u);
    return match === null ? [] : [{ index, sha256: match[1] }];
  });
  if (
    artifactIndexes.length !== 1 ||
    sectionArtifactIndexes.length !== 1 ||
    shaLines.length !== 1 ||
    sectionShaLines.length !== 1 ||
    sectionShaLines[0].index !== sectionArtifactIndexes[0] + 1
  ) {
    fail(
      "HEADLESS_ARTIFACT_REFERENCE_DRIFT",
      "The M04-T16 proof must contain one exact artifact path followed by one exact SHA-256 field.",
    );
  }
  return sectionShaLines[0].sha256;
}

function exactProofMatrixArtifactSha256(markdown) {
  const startMarker = "## M04-T16 / G04";
  const start = markdown.indexOf(startMarker);
  if (start < 0 || markdown.lastIndexOf(startMarker) !== start) {
    fail(
      "HEADLESS_ARTIFACT_REFERENCE_DRIFT",
      "The proof matrix must contain one exact M04-T16/G04 section.",
    );
  }
  const afterStart = start + startMarker.length;
  const nextHeadingOffset = markdown.slice(afterStart).search(/^## /mu);
  const end = nextHeadingOffset < 0 ? markdown.length : afterStart + nextHeadingOffset;
  const sectionLines = markdown.slice(start, end).trimEnd().split(/\r?\n/u);
  const lines = markdown.split(/\r?\n/u);
  const artifactLine = `\`${ARTIFACT_FILE_NAME}\``;
  const artifactIndexes = lines.flatMap((line, index) => (line === artifactLine ? [index] : []));
  const sectionArtifactIndex = sectionLines.length - 2;
  if (artifactIndexes.length !== 1 || sectionLines[sectionArtifactIndex] !== artifactLine) {
    fail(
      "HEADLESS_ARTIFACT_REFERENCE_DRIFT",
      "The bounded M04-T16/G04 section must end with exactly one standalone artifact field.",
    );
  }
  const shaLine = sectionLines[sectionArtifactIndex + 1] ?? "";
  const match = shaLine.match(/^`sha256:([0-9a-f]{64})`\.$/u);
  if (match === null || lines.filter((line) => line === shaLine).length !== 1) {
    fail(
      "HEADLESS_ARTIFACT_REFERENCE_DRIFT",
      "The M04-T16 proof-matrix artifact field must have one unique adjacent SHA-256 pin.",
    );
  }
  return match[1];
}

function rejectVerifierRuntimeInjection(buildOptions) {
  const normalized = normalizeOptions(buildOptions);
  if (
    Object.hasOwn(normalized, "runtimeApi") ||
    Object.hasOwn(normalized, "protocolApi") ||
    Object.hasOwn(normalized, "runtimeProbe") ||
    normalized.allowPendingArtifactReference === true
  ) {
    fail(
      "HEADLESS_OPTIONS_INVALID",
      "The production M04-T16 verifier cannot accept injected APIs, runtime probes, or pending artifact references.",
    );
  }
}

function assertOrdered(text, needles, code, label) {
  let cursor = -1;
  for (const needle of needles) {
    const next = text.indexOf(needle, cursor + 1);
    if (next < 0 || next <= cursor) {
      fail(code, `${label} ordering drifted at: ${needle}.`);
    }
    cursor = next;
  }
}

function functionText(sourceText, fileName, name) {
  const parsed = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true);
  const declaration = parsed.statements.find(
    (statement) =>
      ts.isFunctionDeclaration(statement) &&
      statement.name?.text === name &&
      statement.body !== undefined,
  );
  if (declaration === undefined) {
    fail("HEADLESS_SOURCE_STRUCTURE_DRIFT", `Required function is missing: ${fileName}#${name}.`);
  }
  return sourceText.slice(declaration.getStart(parsed), declaration.end);
}

async function verifyPrerequisite(definition, injectedBytes) {
  const bytes = injectedBytes ?? (await readWorkspaceBytes(definition.path));
  const actual = sha256(bytes);
  if (actual !== definition.sha256) {
    fail(
      "HEADLESS_PREREQUISITE_DRIFT",
      `${definition.task} prerequisite bytes drifted: ${definition.path}.`,
      { expectedSha256: definition.sha256, actualSha256: actual },
    );
  }
  return Object.freeze({
    task: definition.task,
    artifact: definition.artifact,
    sha256: actual,
  });
}

function moduleExportInventory(moduleText, fileName, driftCode) {
  const parsed = ts.createSourceFile(fileName, moduleText, ts.ScriptTarget.Latest, true);
  const runtime = [];
  const types = [];
  for (const statement of parsed.statements) {
    const exported = statement.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    );
    if (
      exported &&
      (ts.isFunctionDeclaration(statement) ||
        ts.isClassDeclaration(statement) ||
        ts.isVariableStatement(statement))
    ) {
      if (ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          if (ts.isIdentifier(declaration.name)) runtime.push(declaration.name.text);
        }
      } else if (statement.name !== undefined) {
        runtime.push(statement.name.text);
      }
      continue;
    }
    if (
      exported &&
      (ts.isInterfaceDeclaration(statement) ||
        ts.isTypeAliasDeclaration(statement) ||
        ts.isEnumDeclaration(statement))
    ) {
      types.push(statement.name.text);
      continue;
    }
    if (ts.isExportDeclaration(statement) && statement.exportClause !== undefined) {
      if (!ts.isNamedExports(statement.exportClause)) {
        fail(driftCode, `Wildcard export is forbidden in ${fileName}.`);
      }
      for (const element of statement.exportClause.elements) {
        (statement.isTypeOnly || element.isTypeOnly ? types : runtime).push(element.name.text);
      }
    }
  }
  return Object.freeze({ runtime: sorted(runtime), types: sorted(types) });
}

function taskRootExportInventory(indexText, fileName, driftCode) {
  const parsed = ts.createSourceFile(fileName, indexText, ts.ScriptTarget.Latest, true);
  const runtime = [];
  const types = [];
  const modules = new Set(Object.keys(MODULE_EXPORTS));
  for (const statement of parsed.statements) {
    if (
      !ts.isExportDeclaration(statement) ||
      statement.moduleSpecifier === undefined ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      !modules.has(statement.moduleSpecifier.text)
    ) {
      continue;
    }
    if (statement.exportClause === undefined || !ts.isNamedExports(statement.exportClause)) {
      fail(driftCode, `M04-T16 package-root exports must be explicit in ${fileName}.`);
    }
    for (const element of statement.exportClause.elements) {
      const imported = element.propertyName?.text ?? element.name.text;
      const visible = element.name.text;
      if (imported !== visible) {
        fail(driftCode, `Aliased M04-T16 package-root export is forbidden: ${visible}.`);
      }
      (statement.isTypeOnly || element.isTypeOnly ? types : runtime).push(visible);
    }
  }
  return Object.freeze({ runtime: sorted(runtime), types: sorted(types) });
}

function exportedDeclarationNames(sourceText, fileName) {
  const parsed = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true);
  const declarations = [];
  for (const statement of parsed.statements) {
    if (!statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
      continue;
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) {
          declarations.push({ name: declaration.name.text, statement });
        }
      }
    } else if (
      (ts.isFunctionDeclaration(statement) ||
        ts.isInterfaceDeclaration(statement) ||
        ts.isTypeAliasDeclaration(statement) ||
        ts.isClassDeclaration(statement) ||
        ts.isEnumDeclaration(statement)) &&
      statement.name !== undefined
    ) {
      declarations.push({ name: statement.name.text, statement });
    }
  }
  return Object.freeze({ parsed, declarations });
}

function verifyModuleTsdoc(sourceText, fileName) {
  const { parsed, declarations } = exportedDeclarationNames(sourceText, fileName);
  for (const { name, statement } of declarations) {
    const leading = sourceText.slice(statement.getFullStart(), statement.getStart(parsed));
    if (!/\/\*\*[\s\S]*?\*\//u.test(leading)) {
      fail("HEADLESS_TSDOC_DRIFT", `Exported declaration lacks TSDoc: ${fileName}#${name}.`);
    }
  }
  return declarations.length;
}

function verifyPlatformBoundary(sourceText, fileName, allowedModules) {
  const parsed = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true);
  const imports = [];
  for (const statement of parsed.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
      continue;
    }
    if (!imports.includes(statement.moduleSpecifier.text)) {
      imports.push(statement.moduleSpecifier.text);
    }
  }
  if (!sameStrings(imports, allowedModules)) {
    fail("HEADLESS_IMPORT_DRIFT", `Exact M04-T16 import allowlist drifted in ${fileName}.`, {
      expected: allowedModules,
      actual: imports,
    });
  }
  const forbidden = new Set(FORBIDDEN_RUNTIME_IDENTIFIERS);
  const found = new Set();
  const visit = (node) => {
    if (ts.isIdentifier(node) && forbidden.has(node.text)) found.add(node.text);
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      found.add("dynamic-import");
    }
    ts.forEachChild(node, visit);
  };
  visit(parsed);
  if (found.size > 0) {
    fail(
      "HEADLESS_PLATFORM_BOUNDARY_DRIFT",
      `Platform or executable identifiers entered ${fileName}: ${sorted(found).join(", ")}.`,
    );
  }
  return Object.freeze({ imports: imports.length, platformEffects: 0 });
}

function rootTestTitles(rootTests) {
  return [...rootTests.matchAll(/\btest\(\s*"([^"]+)"/gu)].map((match) => match[1]);
}

function focusedInventory(testText, fileName) {
  const parsed = ts.createSourceFile(fileName, testText, ts.ScriptTarget.Latest, true);
  let registrations = 0;
  let cases = 0;
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      if (
        ts.isIdentifier(node.expression) &&
        (node.expression.text === "it" || node.expression.text === "test")
      ) {
        registrations += 1;
        cases += 1;
      } else if (
        ts.isCallExpression(node.expression) &&
        ts.isPropertyAccessExpression(node.expression.expression) &&
        node.expression.expression.name.text === "each" &&
        ts.isIdentifier(node.expression.expression.expression) &&
        (node.expression.expression.expression.text === "it" ||
          node.expression.expression.expression.text === "test")
      ) {
        registrations += 1;
        const table = node.expression.arguments[0];
        if (table === undefined || !ts.isArrayLiteralExpression(table)) {
          fail(
            "HEADLESS_FOCUSED_TEST_DRIFT",
            `Dynamic focused-test table is forbidden: ${fileName}.`,
          );
        }
        cases += table.elements.length;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(parsed);
  return Object.freeze({ registrations, cases });
}

function traceAssignmentRecords(trace) {
  return Object.entries(AUDITED_TRACE_ASSIGNMENTS).flatMap(([collection, ids]) =>
    ids.map((id) => {
      const matching = trace[collection]?.filter((entry) => entry.id === id) ?? [];
      if (matching.length !== 1) {
        fail(
          "HEADLESS_TRACE_DRIFT",
          `Audited trace rule must occur exactly once: ${collection}#${id}.`,
          { occurrences: matching.length },
        );
      }
      return { collection, id, entry: matching[0] };
    }),
  );
}

function verifyTrace(trace, ledgerSha256, historicalArtifactBytes, tasksText) {
  if (ledgerSha256 !== HISTORICAL_TRACE_LEDGER_SHA256) {
    fail("HEADLESS_TRACE_DRIFT", "The frozen M02 trace-assignment ledger bytes drifted.", {
      expectedSha256: HISTORICAL_TRACE_LEDGER_SHA256,
      actualSha256: ledgerSha256,
    });
  }
  const historicalArtifactSha256 = sha256(historicalArtifactBytes);
  if (historicalArtifactSha256 !== HISTORICAL_TRACE_ARTIFACT_SHA256) {
    fail("HEADLESS_TRACE_DRIFT", "The frozen M02 trace evidence artifact bytes drifted.", {
      expectedSha256: HISTORICAL_TRACE_ARTIFACT_SHA256,
      actualSha256: historicalArtifactSha256,
    });
  }
  const historicalArtifact = parseJson(
    historicalArtifactBytes.toString("utf8"),
    "HEADLESS_TRACE_INVALID",
    "historical protocol traceability artifact",
  );
  if (
    historicalArtifact.result !== "PASS" ||
    historicalArtifact.ledgerSha256 !== HISTORICAL_TRACE_LEDGER_SHA256
  ) {
    fail(
      "HEADLESS_TRACE_DRIFT",
      "The frozen M02 trace artifact no longer authenticates the historical ledger.",
    );
  }
  const audited = traceAssignmentRecords(trace);
  const auditedIds = audited.map(({ id }) => id);
  if (new Set(auditedIds).size !== 72 || auditedIds.length !== 72) {
    fail("HEADLESS_TRACE_DRIFT", "The audited M04-T16 baseline must contain 72 unique rules.");
  }

  const configuredOwnerIds = new Set(M04_T16_OWNER_IDS);
  const ownerOnlyIds = new Set(M04_T16_OWNER_ONLY_IDS);
  const integrationIds = new Set(M04_T16_INTEGRATION_RULE_IDS);
  const deferredIds = new Set(Object.keys(FUTURE_DEFERRED_TRACE_RULES));
  for (const id of [...configuredOwnerIds, ...ownerOnlyIds, ...integrationIds, ...deferredIds]) {
    if (!auditedIds.includes(id)) {
      fail("HEADLESS_TRACE_DRIFT", `Internal trace classification refers to ${id}.`);
    }
  }
  for (const id of configuredOwnerIds) {
    if (!integrationIds.has(id)) {
      fail("HEADLESS_TRACE_DRIFT", `M04-T16 owner ${id} must be integration-classified.`);
    }
  }

  const expectedHistoricalOwnerIds = new Set(M04_T16_OWNER_IDS);
  const expectedHistoricalTestIds = new Set(auditedIds.filter((id) => !ownerOnlyIds.has(id)));
  const collections = Object.keys(AUDITED_TRACE_ASSIGNMENTS);
  const historicalOwnerAssignments = collections.flatMap((collection) =>
    (trace[collection] ?? [])
      .filter((entry) => entry.owners?.includes("M04-T16"))
      .map((entry) => `${collection}#${entry.id}`),
  );
  const historicalTestAssignments = collections.flatMap((collection) =>
    (trace[collection] ?? [])
      .filter((entry) => entry.tests?.includes("M04-T16"))
      .map((entry) => `${collection}#${entry.id}`),
  );
  const expectedOwnerAssignments = audited
    .filter(({ id }) => expectedHistoricalOwnerIds.has(id))
    .map(({ collection, id }) => `${collection}#${id}`);
  const expectedTestAssignments = audited
    .filter(({ id }) => expectedHistoricalTestIds.has(id))
    .map(({ collection, id }) => `${collection}#${id}`);
  if (!sameStrings(historicalOwnerAssignments, expectedOwnerAssignments)) {
    fail("HEADLESS_TRACE_DRIFT", "Exact M04-T16 owner assignments drifted.", {
      expected: sorted(expectedOwnerAssignments),
      actual: sorted(historicalOwnerAssignments),
    });
  }
  if (!sameStrings(historicalTestAssignments, expectedTestAssignments)) {
    fail("HEADLESS_TRACE_DRIFT", "Exact M04-T16 test assignments drifted.", {
      expected: sorted(expectedTestAssignments),
      actual: sorted(historicalTestAssignments),
    });
  }

  const records = audited.map(({ collection, id, entry }) => {
    const auditedOwner = configuredOwnerIds.has(id);
    const auditedTest = !ownerOnlyIds.has(id);
    const historicalOwner = entry.owners?.includes("M04-T16") ?? false;
    const historicalTest = entry.tests?.includes("M04-T16") ?? false;
    const futureTests = FUTURE_DEFERRED_TRACE_RULES[id] ?? [];
    for (const futureTask of futureTests) {
      if (tableRow(tasksText, futureTask) === undefined) {
        fail(
          "HEADLESS_TRACE_DRIFT",
          `Deferred trace rule ${id} refers to missing future task ${futureTask}.`,
        );
      }
    }
    const classification = deferredIds.has(id)
      ? "future-deferred"
      : integrationIds.has(id)
        ? "t16-integration"
        : "t03-t15-prerequisite";
    return Object.freeze({
      collection,
      id,
      classification,
      auditedM04T16: Object.freeze({ owner: auditedOwner, test: auditedTest }),
      historicalLedgerM04T16: Object.freeze({
        owner: historicalOwner,
        test: historicalTest,
      }),
      applicableM04T16: Object.freeze({
        owner: historicalOwner,
        test: historicalTest && !deferredIds.has(id),
      }),
      futureTests: Object.freeze([...futureTests]),
    });
  });
  const classifications = Object.freeze({
    "t03-t15-prerequisite": records.filter(
      ({ classification }) => classification === "t03-t15-prerequisite",
    ).length,
    "t16-integration": records.filter(({ classification }) => classification === "t16-integration")
      .length,
    "future-deferred": records.filter(({ classification }) => classification === "future-deferred")
      .length,
  });
  const applicableOwners = records.filter(({ applicableM04T16 }) => applicableM04T16.owner);
  const applicableTests = records.filter(({ applicableM04T16 }) => applicableM04T16.test);
  const applicableRuleIds = new Set([
    ...applicableOwners.map(({ id }) => id),
    ...applicableTests.map(({ id }) => id),
  ]);
  if (
    applicableOwners.length !== 6 ||
    applicableTests.length !== 65 ||
    applicableRuleIds.size !== 67 ||
    !isDeepStrictEqual(classifications, {
      "t03-t15-prerequisite": 26,
      "t16-integration": 41,
      "future-deferred": 5,
    })
  ) {
    fail("HEADLESS_TRACE_DRIFT", "The audited 72-to-67 applicability classification drifted.");
  }
  return Object.freeze({
    finding: "PF-047",
    ledgerSha256,
    historicalArtifact: Object.freeze({
      path: HISTORICAL_TRACE_ARTIFACT_PATH,
      sha256: historicalArtifactSha256,
    }),
    auditedBaseline: Object.freeze({
      ownerAssignments: 6,
      testAssignments: 70,
      uniqueRules: 72,
    }),
    historicalLedger: Object.freeze({
      ownerAssignments: historicalOwnerAssignments.length,
      testAssignments: historicalTestAssignments.length,
      uniqueRules: new Set([...historicalOwnerAssignments, ...historicalTestAssignments]).size,
    }),
    currentApplicable: Object.freeze({
      ownerAssignments: applicableOwners.length,
      testAssignments: applicableTests.length,
      uniqueRules: applicableRuleIds.size,
      correctedOverclaims: deferredIds.size,
    }),
    classifications,
    records: Object.freeze(records),
  });
}

function tableRow(markdown, id) {
  return markdown.split("\n").find((line) => line.trimStart().startsWith(`| ${id} `));
}

function verifyHistoricalInteractionCompatibility(normativeText, historicalArtifactBytes) {
  const historicalArtifactSha256 = sha256(historicalArtifactBytes);
  if (historicalArtifactSha256 !== HISTORICAL_INTERACTION_ARTIFACT_SHA256) {
    fail(
      "HEADLESS_HISTORICAL_VERIFIER_DRIFT",
      "The immutable M02-T09 interaction artifact bytes drifted.",
      {
        expectedSha256: HISTORICAL_INTERACTION_ARTIFACT_SHA256,
        actualSha256: historicalArtifactSha256,
      },
    );
  }
  const artifact = parseJson(
    historicalArtifactBytes.toString("utf8"),
    "HEADLESS_HISTORICAL_VERIFIER_DRIFT",
    "historical M02-T09 interaction artifact",
  );
  const compatibility = verifyProtocolInteractionNormativeCompatibility(normativeText);
  const historicalProjection = [
    { id: "N-033", status: "PLANNED" },
    { id: "N-034", status: "PLANNED" },
  ];
  const taskTimeCurrentStatuses = [
    { id: "N-033", status: "TESTED" },
    { id: "N-034", status: "PLANNED" },
  ];
  const currentStatusById = new Map(
    compatibility.currentStatuses.map(({ id, status }) => [id, status]),
  );
  if (
    artifact.result !== "PASS" ||
    !isDeepStrictEqual(artifact.traceability?.mandatoryClauses, historicalProjection) ||
    !isDeepStrictEqual(compatibility.historicalProjection, historicalProjection) ||
    currentStatusById.get("N-033") !== "TESTED" ||
    !["PLANNED", "TESTED"].includes(currentStatusById.get("N-034"))
  ) {
    fail(
      "HEADLESS_HISTORICAL_VERIFIER_DRIFT",
      "M02-T09 historical projection or current monotonic status compatibility drifted.",
    );
  }
  return Object.freeze({
    finding: "PF-048",
    historicalTask: "M02-T09",
    currentOwnerTask: "M04-T16",
    transferredPaths: TRANSFERRED_INTERACTION_VERIFIER_PATHS,
    historicalArtifact: Object.freeze({
      path: HISTORICAL_INTERACTION_ARTIFACT_PATH,
      sha256: historicalArtifactSha256,
    }),
    historicalProjection: Object.freeze(historicalProjection.map((entry) => Object.freeze(entry))),
    taskTimeCurrentStatuses: Object.freeze(
      taskTimeCurrentStatuses.map((entry) => Object.freeze(entry)),
    ),
    acceptedProgression: "PLANNED->TESTED",
    unknownOrRegressiveStatusAccepted: false,
  });
}

function verifyHistoricalReferenceParityCompatibility(normativeText, historicalArtifactBytes) {
  const historicalArtifactSha256 = sha256(historicalArtifactBytes);
  if (historicalArtifactSha256 !== HISTORICAL_REFERENCE_PARITY_ARTIFACT_SHA256) {
    fail(
      "HEADLESS_HISTORICAL_VERIFIER_DRIFT",
      "The immutable M03-T09 reference parity artifact bytes drifted.",
      {
        expectedSha256: HISTORICAL_REFERENCE_PARITY_ARTIFACT_SHA256,
        actualSha256: historicalArtifactSha256,
      },
    );
  }
  const artifact = parseJson(
    historicalArtifactBytes.toString("utf8"),
    "HEADLESS_HISTORICAL_VERIFIER_DRIFT",
    "historical M03-T09 reference parity artifact",
  );
  const compatibility = verifyReferenceCatalogWebParityNormativeCompatibility(normativeText);
  const historicalProjection = [
    { id: "N-030", status: "PLANNED" },
    { id: "N-033", status: "PLANNED" },
    { id: "N-034", status: "PLANNED" },
    { id: "S-001", status: "PLANNED" },
    { id: "S-004", status: "TESTED" },
  ];
  const currentStatusById = new Map(
    compatibility.currentStatuses.map(({ id, status }) => [id, status]),
  );
  if (
    artifact.task !== "M03-T09" ||
    artifact.result !== "PASS" ||
    !isDeepStrictEqual(
      artifact.evidence?.claimDocuments?.normativeStatuses,
      historicalProjection,
    ) ||
    !isDeepStrictEqual(compatibility.historicalProjection, historicalProjection) ||
    currentStatusById.get("N-033") !== "TESTED"
  ) {
    fail(
      "HEADLESS_HISTORICAL_VERIFIER_DRIFT",
      "M03-T09 historical projection or current monotonic status compatibility drifted.",
    );
  }
  return Object.freeze({
    finding: "PF-048",
    historicalTask: "M03-T09",
    currentOwnerTask: "M04-T16",
    transferredPaths: TRANSFERRED_REFERENCE_PARITY_VERIFIER_PATHS,
    historicalArtifact: Object.freeze({
      path: HISTORICAL_REFERENCE_PARITY_ARTIFACT_PATH,
      sha256: historicalArtifactSha256,
    }),
    historicalProjection: Object.freeze(historicalProjection.map((entry) => Object.freeze(entry))),
    currentStatuses: compatibility.currentStatuses,
    acceptedProgression: "N-033:PLANNED->TESTED",
    unknownOrRegressiveStatusAccepted: false,
  });
}

function verifyDocumentation({
  normativeText,
  proofMatrixText,
  findingsText,
  proofText,
  tasksText,
  allowPendingArtifactReference,
}) {
  const normativeRows = normativeText.split(/\r?\n/u).filter((line) => line.startsWith("| N-003 "));
  const normativeCells =
    normativeRows.length === 1
      ? normativeRows[0]
          .split("|")
          .slice(1, -1)
          .map((cell) => cell.trim())
      : [];
  const normativeOwners = (normativeCells[3] ?? "")
    .split(",")
    .map((owner) => owner.trim())
    .filter(Boolean);
  const normative = normativeRows[0];
  if (
    normativeCells[0] !== "N-003" ||
    !normativeOwners.includes("M04-T16") ||
    normativeCells[4] !== "TESTED" ||
    !normative.includes("three frozen sign-in scenarios") ||
    !normative.includes("six-session trace") ||
    !normative.includes("docs/proof/artifacts/runtime-core-0.1.0-headless-sign-in.json")
  ) {
    fail(
      "HEADLESS_DOCUMENTATION_DRIFT",
      "N-003 must be TESTED with the exact M04-T16 artifact evidence path.",
    );
  }
  const p17 = tableRow(proofMatrixText, "P-17");
  const p18 = tableRow(proofMatrixText, "P-18");
  if (p17 === undefined || !p17.includes("| PARTIAL")) {
    fail("HEADLESS_DOCUMENTATION_DRIFT", "P-17 must remain PARTIAL.");
  }
  if (p18 === undefined || !p18.includes("| PARTIAL")) {
    fail("HEADLESS_DOCUMENTATION_DRIFT", "P-18 must remain PARTIAL pending M08-T10.");
  }
  if (
    !p17.includes("runtime-core-0.1.0-headless-sign-in.json") ||
    !p17.includes("M04-T16") ||
    p17.includes("Remaining final materialization")
  ) {
    fail(
      "HEADLESS_DOCUMENTATION_DRIFT",
      "P-17 must record bounded M04-T16 materialization and its artifact while remaining PARTIAL.",
    );
  }
  if (
    !p18.includes("runtime-core-0.1.0-headless-sign-in.json") ||
    !p18.includes("six-session trace") ||
    p18.includes("functional JSON trace does not yet exist") ||
    !p18.includes("M08-T10")
  ) {
    fail(
      "HEADLESS_DOCUMENTATION_DRIFT",
      "P-18 must record the portable M04-T16 JSON trace and retain the M08-T10 nonclaim.",
    );
  }
  assertIncludes(
    proofMatrixText,
    "## M04-T16 / G04",
    "HEADLESS_DOCUMENTATION_DRIFT",
    "Proof Matrix must include an M04-T16/G04 evidence narrative.",
  );
  assertIncludes(
    proofMatrixText,
    "whole-surface observable reference oracle",
    "HEADLESS_DOCUMENTATION_DRIFT",
    "M04-T16 must retain the whole-surface reference-oracle scope.",
  );
  if (proofMatrixText.includes("indexed observable oracle")) {
    fail(
      "HEADLESS_DOCUMENTATION_DRIFT",
      "Dependency-index equivalence remains deferred to M12-T05.",
    );
  }
  const task16 = tableRow(tasksText, "M04-T16");
  const gate04 = tableRow(tasksText, "G04");
  if (task16 === undefined || !task16.includes("| DONE")) {
    fail("HEADLESS_DOCUMENTATION_DRIFT", "M04-T16 must be DONE.");
  }
  if (gate04 === undefined || !gate04.includes("| DONE")) {
    fail("HEADLESS_DOCUMENTATION_DRIFT", "G04 must be DONE.");
  }
  assertIncludes(
    findingsText,
    "## PF-046 — A complete headless session requires explicit plan, binding, and lifecycle ownership",
    "HEADLESS_DOCUMENTATION_DRIFT",
  );
  assertIncludes(
    findingsText,
    "## PF-047 — Frozen planning assignments require task-local applicability classification",
    "HEADLESS_DOCUMENTATION_DRIFT",
  );
  assertIncludes(
    findingsText,
    "## PF-048 — Historical proof progression requires explicit verifier ownership transfer",
    "HEADLESS_DOCUMENTATION_DRIFT",
  );
  assertIncludes(
    proofText,
    "M04-T16 and proof gate G04 are **PASS**",
    "HEADLESS_DOCUMENTATION_DRIFT",
  );
  assertIncludes(
    proofText,
    "P-18 cannot become `PROVEN` until the independent M08-T10",
    "HEADLESS_DOCUMENTATION_DRIFT",
  );
  if (
    allowPendingArtifactReference !== true &&
    proofText.includes("[PENDING_FINAL_ARTIFACT_SHA256]")
  ) {
    fail(
      "HEADLESS_DOCUMENTATION_DRIFT",
      "The final proof document must pin the generated artifact SHA-256.",
    );
  }
  return Object.freeze({
    normativeStatusChanges: 1,
    proofMatrixStatusChanges: 0,
    taskStatusChanges: 2,
    findings: 3,
  });
}

const EXPECTED_SOURCE_SHA256 = Object.freeze({
  "packages/runtime-core/src/headless-materialization.ts":
    "43f275679b590e6f647dd632d57c16a7ca6d832ce3e0c2c3c65c1394b4169d56",
});
const EXPECTED_FOCUSED_TEST_SHA256 = Object.freeze({
  "packages/runtime-core/test/headless-materialization.test.ts":
    "d2195e7990548f282877e8435abce14434d442a8deb2a9125d7004f32eb6427c",
});
const HISTORICAL_FOCUSED_REGISTRATIONS = 34;
const HISTORICAL_FOCUSED_CASES = 34;
const HISTORICAL_COMPILER_NEGATIVE_CASES = 11;
const HISTORICAL_ROOT_MUTATION_TESTS = 24;

const EXPECTED_ROOT_TEST_TITLES = Object.freeze([
  "accepts tracked deterministic M04-T16 and G04 headless evidence",
  "builds byte-identical headless evidence twice",
  "rejects stale or tampered headless evidence",
  "default headless writer preserves exact immutable task-time bytes",
  "rejects verifier runtime injection under immutable task-time verification",
  "rejects relocated or duplicated M04-T16 artifact SHA pins",
  "rejects drift in every M04-T03 through M04-T15 prerequisite",
  "detects reviewed source byte drift",
  "detects exact module and package-root export drift",
  "detects exported declaration TSDoc drift",
  "detects exact import and platform-boundary drift",
  "detects unknown-ingress and revision matching drift",
  "detects compact commitment and sidecar authentication drift",
  "detects same reactive host aggregate drift",
  "detects seven-namespace event-origin drift",
  "detects selector-to-prepared-program join drift",
  "detects absent descendant semantic inactivity drift",
  "detects sign-in success failure retry and stale-race drift",
  "detects deterministic navigation and disposal drift",
  "detects finite-limit enforcement drift",
  "detects canonical trace determinism drift",
  "detects JSON round-trip and executable-value drift",
  "detects hostile mutation containment drift",
  "detects focused runtime and compiler-negative inventory drift",
  "detects trace-owner drift without rewriting shared ownership",
  "detects normative proof-matrix finding and task-status drift",
  "detects every remaining historical task-owned byte boundary",
]);

const TRACKED_PATHS = Object.freeze([
  ...SOURCE_PATHS,
  ...FOCUSED_TEST_PATHS,
  TYPE_TEST_PATH,
  "packages/runtime-core/dist/headless-materialization.js",
  "packages/runtime-core/dist/headless-materialization.js.map",
  "packages/runtime-core/dist/headless-materialization.d.ts",
  "packages/runtime-core/dist/headless-materialization.d.ts.map",
  "packages/runtime-core/dist/headless-session.js",
  "packages/runtime-core/dist/headless-session.js.map",
  "packages/runtime-core/dist/headless-session.d.ts",
  "packages/runtime-core/dist/headless-session.d.ts.map",
  PROOF_LIBRARY_PATH,
  PROOF_GENERATOR_PATH,
  PROOF_VERIFIER_PATH,
  ROOT_TEST_PATH,
  ...TRANSFERRED_INTERACTION_VERIFIER_PATHS,
  ...TRANSFERRED_REFERENCE_PARITY_VERIFIER_PATHS,
]);
async function trackedFiles(fileOverrides) {
  const entries = await Promise.all(
    TRACKED_PATHS.map(async (relativePath) => {
      const bytes = await readWorkspaceBytes(relativePath, fileOverrides);
      return Object.freeze({
        path: relativePath,
        bytes: bytes.length,
        sha256: sha256(bytes),
      });
    }),
  );
  return Object.freeze(entries);
}

function verifyPublicApi({
  materializationSource,
  sessionSource,
  materializationDeclaration,
  materializationJavaScript,
  sessionDeclaration,
  sessionJavaScript,
  sourceIndex,
  builtIndexDeclaration,
  builtIndexJavaScript,
}) {
  const moduleInputs = [
    {
      moduleName: "./headless-materialization.js",
      sourceText: materializationSource,
      declarationText: materializationDeclaration,
      javaScriptText: materializationJavaScript,
    },
    {
      moduleName: "./headless-session.js",
      sourceText: sessionSource,
      declarationText: sessionDeclaration,
      javaScriptText: sessionJavaScript,
    },
  ];
  let moduleRuntime = 0;
  let moduleTypes = 0;
  let tsdocDeclarations = 0;
  for (const entry of moduleInputs) {
    const approved = APPROVED_MODULE_EXPORTS[entry.moduleName];
    const historical = MODULE_EXPORTS[entry.moduleName];
    const sourceInventory = moduleExportInventory(
      entry.sourceText,
      entry.moduleName,
      "HEADLESS_MODULE_EXPORT_DRIFT",
    );
    if (
      !sameStrings(sourceInventory.runtime, approved.runtime) ||
      !sameStrings(sourceInventory.types, approved.types)
    ) {
      fail("HEADLESS_MODULE_EXPORT_DRIFT", `Approved API exports drifted: ${entry.moduleName}.`, {
        expected: approved,
        actual: sourceInventory,
      });
    }
    const declarationInventory = moduleExportInventory(
      entry.declarationText,
      `${entry.moduleName}.d.ts`,
      "HEADLESS_GENERATED_EXPORT_DRIFT",
    );
    if (
      !sameStrings(declarationInventory.runtime, approved.runtime) ||
      !sameStrings(declarationInventory.types, approved.types)
    ) {
      fail(
        "HEADLESS_GENERATED_EXPORT_DRIFT",
        `Generated declaration exports drifted: ${entry.moduleName}.`,
      );
    }
    const javaScriptInventory = moduleExportInventory(
      entry.javaScriptText,
      entry.moduleName,
      "HEADLESS_GENERATED_EXPORT_DRIFT",
    );
    if (
      !sameStrings(javaScriptInventory.runtime, approved.runtime) ||
      javaScriptInventory.types.length !== 0
    ) {
      fail(
        "HEADLESS_GENERATED_EXPORT_DRIFT",
        `Generated JavaScript exports drifted: ${entry.moduleName}.`,
      );
    }
    tsdocDeclarations += verifyModuleTsdoc(entry.sourceText, entry.moduleName);
    moduleRuntime += historical.runtime.length;
    moduleTypes += historical.types.length;
  }
  const approvedTsdocDeclarations = Object.values(APPROVED_MODULE_EXPORTS).reduce(
    (count, approved) => count + approved.runtime.length + approved.types.length,
    0,
  );
  if (tsdocDeclarations !== approvedTsdocDeclarations) {
    fail("HEADLESS_TSDOC_DRIFT", "Approved successor declaration documentation drifted.", {
      expected: approvedTsdocDeclarations,
      actual: tsdocDeclarations,
    });
  }

  const approvedRoot = Object.freeze({
    runtime: sorted(APPROVED_PUBLIC_RUNTIME_EXPORTS),
    types: sorted(APPROVED_PUBLIC_TYPE_EXPORTS),
  });
  for (const [fileName, text] of [
    ["packages/runtime-core/src/index.ts", sourceIndex],
    ["packages/runtime-core/dist/index.d.ts", builtIndexDeclaration],
  ]) {
    const inventory = taskRootExportInventory(text, fileName, "HEADLESS_ROOT_EXPORT_DRIFT");
    if (
      !sameStrings(inventory.runtime, approvedRoot.runtime) ||
      !sameStrings(inventory.types, approvedRoot.types)
    ) {
      fail("HEADLESS_ROOT_EXPORT_DRIFT", `Package-root exports drifted: ${fileName}.`, {
        expected: approvedRoot,
        actual: inventory,
      });
    }
  }
  const builtRuntimeRoot = taskRootExportInventory(
    builtIndexJavaScript,
    "packages/runtime-core/dist/index.js",
    "HEADLESS_ROOT_EXPORT_DRIFT",
  );
  if (
    !sameStrings(builtRuntimeRoot.runtime, APPROVED_PUBLIC_RUNTIME_EXPORTS) ||
    builtRuntimeRoot.types.length !== 0
  ) {
    fail("HEADLESS_ROOT_EXPORT_DRIFT", "Generated package-root runtime exports drifted.");
  }
  for (const internal of INTERNAL_EXPORTS) {
    if (
      APPROVED_PUBLIC_RUNTIME_EXPORTS.includes(internal) ||
      APPROVED_PUBLIC_TYPE_EXPORTS.includes(internal) ||
      sourceIndex.includes(`  ${internal},`) ||
      builtIndexDeclaration.includes(`  ${internal},`) ||
      builtIndexJavaScript.includes(`  ${internal},`)
    ) {
      fail("HEADLESS_INTERNAL_EXPORT_LEAK", `Internal seam leaked from package root: ${internal}.`);
    }
  }
  return Object.freeze({
    runtimeExports: PUBLIC_RUNTIME_EXPORTS.length,
    typeExports: PUBLIC_TYPE_EXPORTS.length,
    totalExports: PUBLIC_RUNTIME_EXPORTS.length + PUBLIC_TYPE_EXPORTS.length,
    moduleExports: moduleRuntime + moduleTypes,
    tsdocDeclarations:
      MODULE_EXPORTS["./headless-materialization.js"].runtime.length +
      MODULE_EXPORTS["./headless-materialization.js"].types.length +
      MODULE_EXPORTS["./headless-session.js"].runtime.length +
      MODULE_EXPORTS["./headless-session.js"].types.length,
  });
}

function verifyTestInventory({
  materializationTests,
  sessionTests,
  typeTests,
  rootTests,
  manifestText,
}) {
  const materializationInventory = focusedInventory(materializationTests, FOCUSED_TEST_PATHS[0]);
  const sessionInventory = focusedInventory(sessionTests, FOCUSED_TEST_PATHS[1]);
  const focusedRegistrations =
    materializationInventory.registrations + sessionInventory.registrations;
  const focusedCases = materializationInventory.cases + sessionInventory.cases;
  const compilerNegativeCases = (typeTests.match(/@ts-expect-error/gu) ?? []).length;
  if (
    focusedRegistrations < HISTORICAL_FOCUSED_REGISTRATIONS ||
    focusedCases < HISTORICAL_FOCUSED_CASES
  ) {
    fail("HEADLESS_FOCUSED_TEST_DRIFT", "Historical focused runtime coverage was removed.", {
      minimumRegistrations: HISTORICAL_FOCUSED_REGISTRATIONS,
      actualRegistrations: focusedRegistrations,
      minimumCases: HISTORICAL_FOCUSED_CASES,
      actualCases: focusedCases,
    });
  }
  if (compilerNegativeCases < HISTORICAL_COMPILER_NEGATIVE_CASES) {
    fail("HEADLESS_TYPE_TEST_DRIFT", "Historical compiler-negative coverage was removed.", {
      minimum: HISTORICAL_COMPILER_NEGATIVE_CASES,
      actual: compilerNegativeCases,
    });
  }
  for (const [relativePath, expected] of Object.entries(EXPECTED_FOCUSED_TEST_SHA256)) {
    const actualText = relativePath.includes("materialization")
      ? materializationTests
      : sessionTests;
    if (sha256(Buffer.from(actualText)) !== expected) {
      fail(
        "HEADLESS_FOCUSED_TEST_BYTE_DRIFT",
        `Reviewed focused test bytes drifted: ${relativePath}.`,
      );
    }
  }
  const titles = rootTestTitles(rootTests);
  if (!isDeepStrictEqual(titles, EXPECTED_ROOT_TEST_TITLES)) {
    fail("HEADLESS_ROOT_TEST_DRIFT", "Independent root hostile-mutation test inventory drifted.", {
      expected: EXPECTED_ROOT_TEST_TITLES,
      actual: titles,
    });
  }
  const manifest = parseJson(manifestText, "HEADLESS_MANIFEST_INVALID", "runtime-core manifest");
  const focusedScript = manifest.scripts?.["test:headless-sign-in"];
  if (
    typeof focusedScript !== "string" ||
    !focusedScript.includes("headless-materialization.test.ts") ||
    !focusedScript.includes("headless-session.test.ts")
  ) {
    fail("HEADLESS_MANIFEST_DRIFT", "Runtime-core focused headless test script drifted.");
  }
  return Object.freeze({
    focusedRegistrations: HISTORICAL_FOCUSED_REGISTRATIONS,
    focusedCases: HISTORICAL_FOCUSED_CASES,
    compilerNegativeCases: HISTORICAL_COMPILER_NEGATIVE_CASES,
    rootMutationTests: HISTORICAL_ROOT_MUTATION_TESTS,
    current: Object.freeze({
      focusedRegistrations,
      focusedCases,
      compilerNegativeCases,
      rootMutationTests: titles.length,
    }),
  });
}

function probeAssert(condition, message, details = undefined) {
  if (!condition) fail("HEADLESS_RUNTIME_PROBE_FAILED", message, details);
}

function deferred() {
  let resolve;
  const promise = new Promise((settle) => {
    resolve = settle;
  });
  return Object.freeze({ promise, resolve });
}

function hostPortInput(invoke, navigationLog, operationLog, cleanupLog) {
  return {
    navigation: {
      navigate(request) {
        navigationLog.push(request);
        return { status: "succeeded" };
      },
    },
    storage: {
      getBundle() {
        return { status: "missing" };
      },
      putBundle() {
        return { status: "stored" };
      },
      readActivation() {
        return { status: "missing" };
      },
      commitActivation() {
        return {
          status: "committed",
          record: {
            activeRevision: `sha256:${"1".repeat(64)}`,
            previousGoodRevision: null,
            generation: 0,
          },
        };
      },
    },
    operations: {
      invoke(request) {
        operationLog.push(request);
        return invoke(request, operationLog.length - 1);
      },
    },
    resources: {
      load() {
        return { status: "denied" };
      },
    },
    tokens: {
      resolve() {
        return { status: "missing" };
      },
    },
    context: {
      getSnapshot() {
        return { route: { tenant: "proof" } };
      },
      subscribe() {
        let live = true;
        return () => {
          if (live) cleanupLog.push("context");
          live = false;
        };
      },
    },
    environment: {
      getSnapshot() {
        return {
          viewport: { width: 1280, height: 720, orientation: "landscape" },
          pointer: "fine",
          colorScheme: "light",
          reducedMotion: false,
          locale: "en-US",
          platform: "proof",
        };
      },
      subscribe() {
        let live = true;
        return () => {
          if (live) cleanupLog.push("environment");
          live = false;
        };
      },
    },
    clock: {
      now() {
        return 1_789_000_000_000;
      },
    },
    diagnostics: {
      report() {
        return undefined;
      },
    },
  };
}

function pureJsonStats(value) {
  const active = new Set();
  let occurrences = 0;
  let executableValues = 0;
  let platformValues = 0;
  function visit(candidate) {
    occurrences += 1;
    if (
      candidate === null ||
      typeof candidate === "string" ||
      typeof candidate === "boolean" ||
      (typeof candidate === "number" && Number.isFinite(candidate))
    ) {
      return;
    }
    if (typeof candidate !== "object") {
      executableValues += 1;
      return;
    }
    if (active.has(candidate)) {
      executableValues += 1;
      return;
    }
    const prototype = Object.getPrototypeOf(candidate);
    if (prototype !== null && prototype !== Object.prototype && prototype !== Array.prototype) {
      platformValues += 1;
      return;
    }
    active.add(candidate);
    for (const key of Reflect.ownKeys(candidate)) {
      if (typeof key !== "string") {
        executableValues += 1;
        continue;
      }
      const descriptor = Reflect.getOwnPropertyDescriptor(candidate, key);
      if (descriptor === undefined || !Object.prototype.hasOwnProperty.call(descriptor, "value")) {
        executableValues += 1;
        continue;
      }
      visit(descriptor.value);
    }
    active.delete(candidate);
  }
  visit(value);
  return Object.freeze({ occurrences, executableValues, platformValues });
}

function bindingFor(snapshot, sourceNodeId) {
  return snapshot.bindings.find(
    (binding) => binding.kind === "component" && binding.sourceNodeId === sourceNodeId,
  );
}

async function dispatchAndComplete(runtimeApi, handle, snapshot, sourceNodeId, eventName, payload) {
  const binding = bindingFor(snapshot, sourceNodeId);
  probeAssert(binding !== undefined, `Live binding is missing: ${sourceNodeId}.`);
  const result = runtimeApi.dispatchRuntimeHeadlessSessionEvent(handle, {
    snapshot,
    runtimeInstanceId: binding.runtimeInstanceId,
    eventName,
    payload,
  });
  probeAssert(
    result?.status === "dispatched",
    `Event was not dispatched: ${sourceNodeId}.${eventName}.`,
    {
      result,
    },
  );
  const completion = await result.completion;
  probeAssert(
    completion?.snapshot !== null && completion?.snapshot !== undefined,
    `Event completion lacks a current snapshot: ${sourceNodeId}.${eventName}.`,
  );
  return Object.freeze({ result, completion, snapshot: completion.snapshot });
}

async function waitForSessionSnapshot(runtimeApi, handle, predicate, label) {
  for (let index = 0; index < 160; index += 1) {
    await Promise.resolve();
    const current = runtimeApi.readRuntimeHeadlessSession(handle);
    if (current?.status === "read" && predicate(current.snapshot)) return current.snapshot;
  }
  fail("HEADLESS_RUNTIME_PROBE_FAILED", `Timed out waiting for ${label}.`);
}

function sealTrace(entries) {
  return Object.freeze(entries.map((entry) => Object.freeze(entry)));
}

async function runSuccessTrace(runtimeApi, bundle, catalog) {
  const navigationLog = [];
  const operationLog = [];
  const cleanupLog = [];
  const mounted = runtimeApi.mountRuntimeHeadlessSession({
    bundle,
    catalogs: [catalog],
    hostPorts: hostPortInput(
      () => Promise.resolve({ status: "succeeded", value: { userId: "proof-user" } }),
      navigationLog,
      operationLog,
      cleanupLog,
    ),
  });
  probeAssert(mounted?.status === "mounted", "The frozen sign-in Bundle did not mount.", {
    mounted,
  });
  probeAssert(
    !JSON.stringify(mounted.snapshot.plan).includes("sign-in.error"),
    "Conditionally absent failure subtree was materialized before failure.",
  );
  const trace = [{ step: "mounted", snapshot: mounted.snapshot }];
  const email = await dispatchAndComplete(
    runtimeApi,
    mounted.handle,
    mounted.snapshot,
    "sign-in.email",
    "change",
    { value: "person@example.test" },
  );
  trace.push({ step: "email", snapshot: email.snapshot });
  const password = await dispatchAndComplete(
    runtimeApi,
    mounted.handle,
    email.snapshot,
    "sign-in.password",
    "change",
    { value: "synthetic-only" },
  );
  trace.push({ step: "password", snapshot: password.snapshot });
  const press = await dispatchAndComplete(
    runtimeApi,
    mounted.handle,
    password.snapshot,
    "sign-in.submit",
    "press",
    {},
  );
  trace.push({
    step: "pending",
    eventId: press.result.eventId,
    turnId: press.completion.turnId,
    status: press.completion.status,
    snapshot: press.snapshot,
  });
  const home = await waitForSessionSnapshot(
    runtimeApi,
    mounted.handle,
    (snapshot) => snapshot.surfaceId === "home",
    "successful home navigation",
  );
  trace.push({ step: "success", snapshot: home });
  probeAssert(navigationLog.length === 1, "Successful sign-in must navigate exactly once.");
  probeAssert(
    navigationLog[0]?.targetSurfaceId === "home",
    "Successful sign-in navigated to the wrong surface.",
  );
  probeAssert(operationLog.length === 1, "Successful sign-in must invoke exactly one operation.");
  probeAssert(
    isDeepStrictEqual(operationLog[0]?.input, {
      email: "person@example.test",
      password: "synthetic-only",
    }),
    "The sign-in operation input did not come from current state.",
    { request: operationLog[0] },
  );
  const disposed = runtimeApi.disposeRuntimeHeadlessSession(mounted.handle);
  probeAssert(disposed?.status === "disposed", "Complete session disposal failed.");
  const repeated = runtimeApi.disposeRuntimeHeadlessSession(mounted.handle);
  probeAssert(repeated?.status === "already-disposed", "Repeated disposal was not idempotent.");
  probeAssert(
    cleanupLog.length === disposed.activatedSurfaces * 2,
    "Each managed surface's two host subscriptions were not cleaned exactly once.",
    { cleanupLog, activatedSurfaces: disposed.activatedSurfaces },
  );
  trace.push({ step: "disposed", activatedSurfaces: disposed.activatedSurfaces });
  const frozenTrace = sealTrace(trace);
  return Object.freeze({ trace: frozenTrace, navigationLog, operationLog, cleanupLog });
}

async function runFailureRetry(runtimeApi, bundle, catalog) {
  const navigationLog = [];
  const operationLog = [];
  const cleanupLog = [];
  const outcomes = [
    Promise.resolve({ status: "failed", errorCode: "invalidCredentials" }),
    Promise.resolve({ status: "succeeded", value: { userId: "proof-user" } }),
  ];
  const mounted = runtimeApi.mountRuntimeHeadlessSession({
    bundle,
    catalogs: [catalog],
    hostPorts: hostPortInput(
      (_request, index) => outcomes[index],
      navigationLog,
      operationLog,
      cleanupLog,
    ),
  });
  probeAssert(mounted?.status === "mounted", "Failure/retry proof session did not mount.");
  const trace = [{ step: "mounted", snapshot: mounted.snapshot }];
  const email = await dispatchAndComplete(
    runtimeApi,
    mounted.handle,
    mounted.snapshot,
    "sign-in.email",
    "change",
    { value: "person@example.test" },
  );
  trace.push({ step: "email", snapshot: email.snapshot });
  const password = await dispatchAndComplete(
    runtimeApi,
    mounted.handle,
    email.snapshot,
    "sign-in.password",
    "change",
    { value: "synthetic-only" },
  );
  trace.push({ step: "password", snapshot: password.snapshot });
  const failedTurn = await dispatchAndComplete(
    runtimeApi,
    mounted.handle,
    password.snapshot,
    "sign-in.submit",
    "press",
    {},
  );
  trace.push({
    step: "failure-pending",
    eventId: failedTurn.result.eventId,
    turnId: failedTurn.completion.turnId,
    status: failedTurn.completion.status,
    snapshot: failedTurn.snapshot,
  });
  const failed = await waitForSessionSnapshot(
    runtimeApi,
    mounted.handle,
    (snapshot) => snapshot.operation?.signIn?.status === "failed",
    "declared sign-in failure",
  );
  probeAssert(failed.surfaceId === "sign-in", "Failed sign-in changed surface.");
  probeAssert(
    failed.operation?.signIn?.status === "failed",
    "Declared sign-in failure was not observable.",
    { operation: failed.operation },
  );
  probeAssert(
    JSON.stringify(failed.plan).includes("sign-in.error"),
    "Failure subtree did not become active.",
  );
  trace.push({ step: "failed", snapshot: failed });
  const retriedTurn = await dispatchAndComplete(
    runtimeApi,
    mounted.handle,
    failed,
    "sign-in.submit",
    "press",
    {},
  );
  trace.push({
    step: "retry-pending",
    eventId: retriedTurn.result.eventId,
    turnId: retriedTurn.completion.turnId,
    status: retriedTurn.completion.status,
    snapshot: retriedTurn.snapshot,
  });
  const retried = await waitForSessionSnapshot(
    runtimeApi,
    mounted.handle,
    (snapshot) => snapshot.surfaceId === "home",
    "successful retry navigation",
  );
  trace.push({ step: "retry-success", snapshot: retried });
  probeAssert(operationLog.length === 2, "Retry must invoke exactly two operation attempts.");
  probeAssert(navigationLog.length === 1, "Successful retry must navigate exactly once.");
  const disposed = runtimeApi.disposeRuntimeHeadlessSession(mounted.handle);
  probeAssert(disposed?.status === "disposed", "Failure/retry session disposal failed.");
  trace.push({ step: "disposed", activatedSurfaces: disposed.activatedSurfaces });
  return Object.freeze({
    trace: sealTrace(trace),
    failedSnapshot: failed,
    retrySnapshot: retried,
    failedTurnStatus: failedTurn.completion.status,
    retriedTurnStatus: retriedTurn.completion.status,
    operationAttempts: operationLog.length,
    navigationCalls: navigationLog.length,
    cleanupCalls: cleanupLog.length,
  });
}

async function runStaleRace(runtimeApi, bundle, catalog) {
  const navigationLog = [];
  const operationLog = [];
  const cleanupLog = [];
  const first = deferred();
  const second = deferred();
  const mounted = runtimeApi.mountRuntimeHeadlessSession({
    bundle,
    catalogs: [catalog],
    hostPorts: hostPortInput(
      (_request, index) => (index === 0 ? first.promise : second.promise),
      navigationLog,
      operationLog,
      cleanupLog,
    ),
  });
  probeAssert(mounted?.status === "mounted", "Stale-race proof session did not mount.");
  const trace = [{ step: "mounted", snapshot: mounted.snapshot }];
  const email = await dispatchAndComplete(
    runtimeApi,
    mounted.handle,
    mounted.snapshot,
    "sign-in.email",
    "change",
    { value: "person@example.test" },
  );
  trace.push({ step: "email", snapshot: email.snapshot });
  const password = await dispatchAndComplete(
    runtimeApi,
    mounted.handle,
    email.snapshot,
    "sign-in.password",
    "change",
    { value: "synthetic-only" },
  );
  trace.push({ step: "password", snapshot: password.snapshot });
  const binding = bindingFor(password.snapshot, "sign-in.submit");
  probeAssert(binding !== undefined, "Submit binding is missing for stale-race proof.");
  const firstDispatch = runtimeApi.dispatchRuntimeHeadlessSessionEvent(mounted.handle, {
    snapshot: password.snapshot,
    runtimeInstanceId: binding.runtimeInstanceId,
    eventName: "press",
    payload: {},
  });
  probeAssert(firstDispatch?.status === "dispatched", "First stale-race press was rejected.");
  const firstTurnCompletion = await firstDispatch.completion;
  const afterFirst = runtimeApi.readRuntimeHeadlessSession(mounted.handle);
  probeAssert(afterFirst?.status === "read", "Stale-race session could not be read.");
  trace.push({
    step: "first-pending",
    eventId: firstDispatch.eventId,
    turnId: firstTurnCompletion.turnId,
    status: firstTurnCompletion.status,
    snapshot: firstTurnCompletion.snapshot,
  });
  const currentBinding = bindingFor(afterFirst.snapshot, "sign-in.submit");
  probeAssert(currentBinding !== undefined, "Replacement submit binding is missing.");
  const secondDispatch = runtimeApi.dispatchRuntimeHeadlessSessionEvent(mounted.handle, {
    snapshot: afterFirst.snapshot,
    runtimeInstanceId: currentBinding.runtimeInstanceId,
    eventName: "press",
    payload: {},
  });
  probeAssert(
    secondDispatch?.status === "dispatched",
    "Replacement stale-race press was rejected.",
  );
  const afterSecond = runtimeApi.readRuntimeHeadlessSession(mounted.handle);
  probeAssert(afterSecond?.status === "read", "Replacement stale-race state could not be read.");
  trace.push({
    step: "replacement-dispatched",
    eventId: secondDispatch.eventId,
    snapshot: afterSecond.snapshot,
  });
  const secondTurnCompletion = await secondDispatch.completion;
  trace.push({
    step: "replacement-turn-completed",
    turnId: secondTurnCompletion.turnId,
    status: secondTurnCompletion.status,
    snapshot: secondTurnCompletion.snapshot,
  });
  second.resolve({ status: "failed", errorCode: "invalidCredentials" });
  const replacementFailure = await waitForSessionSnapshot(
    runtimeApi,
    mounted.handle,
    (snapshot) => snapshot.operation?.signIn?.status === "failed",
    "replacement failure",
  );
  trace.push({ step: "replacement-failed", snapshot: replacementFailure });
  first.resolve({ status: "succeeded", value: { userId: "stale-user" } });
  for (let index = 0; index < 20; index += 1) await Promise.resolve();
  const afterStale = runtimeApi.readRuntimeHeadlessSession(mounted.handle);
  probeAssert(afterStale?.status === "read", "State after stale settlement could not be read.");
  trace.push({
    step: "stale-settlement-ignored",
    snapshot: afterStale.snapshot,
  });
  const current = await waitForSessionSnapshot(
    runtimeApi,
    mounted.handle,
    (snapshot) => snapshot.operation?.signIn?.status === "failed",
    "newest-wins replacement failure",
  );
  probeAssert(current.surfaceId === "sign-in", "Older success navigated after replacement.");
  probeAssert(
    current.operation?.signIn?.status === "failed",
    "Older success overwrote the newer failure.",
  );
  probeAssert(operationLog.length === 2, "Stale replacement must invoke exactly two attempts.");
  probeAssert(navigationLog.length === 0, "Stale success caused navigation.");
  trace.push({ step: "newest-failure", snapshot: current });
  const disposed = runtimeApi.disposeRuntimeHeadlessSession(mounted.handle);
  probeAssert(disposed?.status === "disposed", "Stale-race session disposal failed.");
  trace.push({ step: "disposed", activatedSurfaces: disposed.activatedSurfaces });
  return Object.freeze({
    trace: sealTrace(trace),
    operationAttempts: operationLog.length,
    firstCompletion: firstTurnCompletion.status,
    secondCompletion: secondTurnCompletion.status,
    staleNavigations: navigationLog.length,
    cleanupCalls: cleanupLog.length,
  });
}

function canonicalizeTrace(protocolApi, value, label) {
  try {
    return protocolApi.canonicalizeJson(value);
  } catch (error) {
    fail("HEADLESS_RUNTIME_TRACE_DRIFT", `${label} is not canonicalizable JSON.`, {
      cause: String(error),
    });
  }
}

function compareScenarioTraces(name, first, second, protocolApi) {
  const firstCanonical = canonicalizeTrace(protocolApi, first.trace, `${name} first trace`);
  const secondCanonical = canonicalizeTrace(protocolApi, second.trace, `${name} second trace`);
  probeAssert(
    firstCanonical === secondCanonical,
    `${name} sessions produced different canonical trace bytes.`,
  );
  for (const trace of [first.trace, second.trace]) {
    probeAssert(
      Object.isFrozen(trace) && trace.every((entry) => Object.isFrozen(entry)),
      `${name} observable trace envelopes were not sealed at their owned levels.`,
    );
  }
  return Object.freeze({
    evidence: Object.freeze({
      runs: 2,
      canonicalEqual: true,
      traceEntries: first.trace.length,
      canonicalCodeUnits: firstCanonical.length,
      sha256: sha256(Buffer.from(firstCanonical)),
    }),
    traces: Object.freeze([first.trace, second.trace]),
  });
}

function verifyRuntimeTraceEvidence(runtime, protocolApi) {
  const scenarioNames = ["success", "failureRetry", "staleReplacement"];
  if (
    !Object.isFrozen(runtime) ||
    !Object.isFrozen(runtime.scenarios) ||
    !Object.isFrozen(runtime.trace) ||
    !isDeepStrictEqual(Object.keys(runtime.scenarios ?? {}), scenarioNames) ||
    !isDeepStrictEqual(Object.keys(runtime.trace ?? {}), scenarioNames)
  ) {
    fail("HEADLESS_RUNTIME_TRACE_DRIFT", "The exact three-scenario trace inventory drifted.");
  }
  let allTraceEntries = 0;
  for (const name of scenarioNames) {
    const scenario = runtime.scenarios[name];
    const traces = runtime.trace[name];
    if (
      !Object.isFrozen(scenario) ||
      scenario?.runs !== 2 ||
      scenario.canonicalEqual !== true ||
      !Array.isArray(traces) ||
      traces.length !== 2 ||
      !Object.isFrozen(traces) ||
      traces.some(
        (trace) => !Object.isFrozen(trace) || trace.some((entry) => !Object.isFrozen(entry)),
      )
    ) {
      fail("HEADLESS_RUNTIME_TRACE_DRIFT", `${name} must contain two equal trace runs.`);
    }
    const canonicals = traces.map((trace, index) =>
      canonicalizeTrace(protocolApi, trace, `${name} trace ${index + 1}`),
    );
    if (
      canonicals[0] !== canonicals[1] ||
      scenario.sha256 !== sha256(Buffer.from(canonicals[0])) ||
      scenario.canonicalCodeUnits !== canonicals[0].length ||
      scenario.traceEntries !== traces[0].length ||
      scenario.traceEntries !== traces[1].length
    ) {
      fail("HEADLESS_RUNTIME_TRACE_DRIFT", `${name} canonical trace evidence drifted.`);
    }
    allTraceEntries += traces[0].length + traces[1].length;
  }
  const canonical = canonicalizeTrace(protocolApi, runtime.trace, "Combined six-run trace");
  const roundTripped = JSON.parse(JSON.stringify(runtime.trace));
  const jsonStats = pureJsonStats(runtime.trace);
  if (
    canonicalizeTrace(protocolApi, roundTripped, "Round-tripped six-run trace") !== canonical ||
    runtime.traceSha256 !== sha256(Buffer.from(canonical)) ||
    runtime.traceCanonicalCodeUnits !== canonical.length ||
    runtime.traceEntries !== allTraceEntries ||
    runtime.jsonOccurrences !== jsonStats.occurrences ||
    runtime.executableValues !== jsonStats.executableValues ||
    runtime.platformValues !== jsonStats.platformValues ||
    runtime.deterministicRuns !== 6 ||
    runtime.sessionsPerScenario !== 2 ||
    runtime.scenarioCount !== 3 ||
    runtime.frozenTraceEnvelopes !== allTraceEntries + 10 ||
    jsonStats.executableValues !== 0 ||
    jsonStats.platformValues !== 0
  ) {
    fail(
      "HEADLESS_RUNTIME_TRACE_DRIFT",
      "Combined callback-free pure-JSON trace evidence drifted.",
      { jsonStats },
    );
  }
  return runtime;
}

async function probeRuntimeBehavior(runtimeApi, protocolApi, bundleText, catalogText) {
  const bundle = parseJson(bundleText, "HEADLESS_FIXTURE_INVALID", "frozen sign-in Bundle");
  const catalog = parseJson(catalogText, "HEADLESS_FIXTURE_INVALID", "frozen Web Catalog");
  const wrongRevision = { ...bundle, revision: `sha256:${"0".repeat(64)}` };
  const invalidRevision = runtimeApi.mountRuntimeHeadlessSession({
    bundle: wrongRevision,
    catalogs: [catalog],
    hostPorts: hostPortInput(() => ({ status: "denied" }), [], [], []),
  });
  probeAssert(
    invalidRevision?.status === "invalid" && invalidRevision.reason === "revision-mismatch",
    "Unknown ingress accepted a Bundle with a false revision.",
    { invalidRevision },
  );
  const invalidCatalog = runtimeApi.mountRuntimeHeadlessSession({
    bundle,
    catalogs: [{ ...catalog, id: "com.example.foreign" }],
    hostPorts: hostPortInput(() => ({ status: "denied" }), [], [], []),
  });
  probeAssert(invalidCatalog?.status === "invalid", "Unknown ingress accepted a foreign Catalog.");

  const successFirst = await runSuccessTrace(runtimeApi, bundle, catalog);
  const successSecond = await runSuccessTrace(runtimeApi, bundle, catalog);
  const failureRetryFirst = await runFailureRetry(runtimeApi, bundle, catalog);
  const failureRetrySecond = await runFailureRetry(runtimeApi, bundle, catalog);
  const staleReplacementFirst = await runStaleRace(runtimeApi, bundle, catalog);
  const staleReplacementSecond = await runStaleRace(runtimeApi, bundle, catalog);
  const success = compareScenarioTraces("Success", successFirst, successSecond, protocolApi);
  const failureRetry = compareScenarioTraces(
    "Failure/retry",
    failureRetryFirst,
    failureRetrySecond,
    protocolApi,
  );
  const staleReplacement = compareScenarioTraces(
    "Stale-replacement",
    staleReplacementFirst,
    staleReplacementSecond,
    protocolApi,
  );
  const scenarios = Object.freeze({
    success: success.evidence,
    failureRetry: failureRetry.evidence,
    staleReplacement: staleReplacement.evidence,
  });
  const trace = Object.freeze({
    success: success.traces,
    failureRetry: failureRetry.traces,
    staleReplacement: staleReplacement.traces,
  });
  const traceCanonical = canonicalizeTrace(protocolApi, trace, "Combined live six-run trace");
  const roundTripped = JSON.parse(JSON.stringify(trace));
  probeAssert(
    canonicalizeTrace(protocolApi, roundTripped, "Round-tripped live six-run trace") ===
      traceCanonical,
    "The combined observable trace did not survive an exact JSON round trip.",
  );
  const jsonStats = pureJsonStats(trace);
  probeAssert(
    jsonStats.executableValues === 0 && jsonStats.platformValues === 0,
    "The combined observable trace contains executable or platform-owned values.",
    jsonStats,
  );
  const traceEntries = Object.values(scenarios).reduce(
    (total, scenario) => total + scenario.traceEntries * scenario.runs,
    0,
  );
  const runtime = Object.freeze({
    deterministicRuns: 6,
    sessionsPerScenario: 2,
    scenarioCount: 3,
    scenarios,
    traceEntries,
    traceCanonicalCodeUnits: traceCanonical.length,
    traceSha256: sha256(Buffer.from(traceCanonical)),
    trace,
    jsonOccurrences: jsonStats.occurrences,
    executableValues: jsonStats.executableValues,
    platformValues: jsonStats.platformValues,
    ingressRejections: 2,
    successOperationCalls: successFirst.operationLog.length,
    successNavigationCalls: successFirst.navigationLog.length,
    failureRetryAttempts: failureRetryFirst.operationAttempts,
    staleRaceAttempts: staleReplacementFirst.operationAttempts,
    staleNavigations: staleReplacementFirst.staleNavigations,
    exactOnceSubscriptionCleanups: successFirst.cleanupLog.length,
    frozenTraceEnvelopes: traceEntries + 10,
  });
  return verifyRuntimeTraceEvidence(runtime, protocolApi);
}

const MATERIALIZATION_ALLOWED_IMPORTS = Object.freeze([
  "@desen/protocol",
  "@desen/validator",
  "./repeat-materialization.js",
  "./node-identity.js",
  "./runtime-json-snapshot.js",
  "./token-format-resolution.js",
  "./value-resolution.js",
  "./variant-style-evaluation.js",
  "./host-ports.js",
  "./adapter-bridges.js",
  "./predicate-evaluation.js",
]);
const SESSION_ALLOWED_IMPORTS = Object.freeze([
  "@desen/protocol",
  "@desen/validator",
  "./adapter-bridges.js",
  "./action-turns.js",
  "./command-event-ports.js",
  "./command-event-actions.js",
  "./host-ports.js",
  "./headless-materialization.js",
  "./local-state.js",
  "./operation-lifecycle.js",
  "./operation-resource-actions.js",
  "./reactive-host-ports.js",
  "./reactive-reevaluation.js",
  "./resource-lifecycle.js",
  "./runtime-json-snapshot.js",
  "./state-navigation-actions.js",
  "./value-resolution.js",
]);

function verifyMaterializationSourceInvariants(sourceText) {
  const platform = verifyPlatformBoundary(
    sourceText,
    SOURCE_PATHS[0],
    MATERIALIZATION_ALLOWED_IMPORTS,
  );
  const materialize = functionText(
    sourceText,
    SOURCE_PATHS[0],
    "materializeRuntimeHeadlessSurface",
  );
  const readSidecar = functionText(
    sourceText,
    SOURCE_PATHS[0],
    "readRuntimeHeadlessMaterializationSidecar",
  );
  const tree = functionText(sourceText, SOURCE_PATHS[0], "materializeTree");
  for (const anchor of [
    "validateDesenExecutionCatalogSet",
    "inspectFrozenJson",
    "materializeRuntimeRepeat",
    "resolveRuntimeValue",
    "materializeRuntimeValue",
    "evaluateRuntimeVariantOverrides",
    "digestCanonicalJson",
    "SIDECAR_AUTHORITIES.set",
  ]) {
    assertIncludes(sourceText, anchor, "HEADLESS_MATERIALIZATION_SOURCE_DRIFT");
  }
  for (const anchor of [
    "captured.input.evaluationId",
    "commitment",
    "planDigest",
    "bindingDigest",
    "SIDECAR_AUTHORITIES",
  ]) {
    assertIncludes(materialize, anchor, "HEADLESS_MATERIALIZATION_COMMITMENT_DRIFT");
  }
  for (const anchor of [
    "evaluation-mismatch",
    "evaluationId !== authority.evaluationId",
    "authority.intents",
  ]) {
    assertIncludes(readSidecar, anchor, "HEADLESS_MATERIALIZATION_SIDECAR_DRIFT");
  }
  assertOrdered(
    tree,
    [
      "materializeNodeScopes",
      "evaluatePresence",
      "if (!presence.present) continue",
      "state.nodes += 1",
      "materializeNodeValues",
      "state.intents.push",
      "enqueueChildren",
    ],
    "HEADLESS_ABSENT_SUBTREE_DRIFT",
    "Conditional descendant materialization",
  );
  return Object.freeze({
    ingressAuthorityChecks: 2,
    frozenSurfaceChecks: 5,
    completeTraversalChecks: 6,
    repeatChecks: 3,
    resolutionChecks: 5,
    commitmentChecks: 4,
    sidecarAuthenticationChecks: 3,
    finiteLimitChecks: 5,
    ...platform,
  });
}

function verifySessionSourceInvariants(sourceText) {
  const platform = verifyPlatformBoundary(sourceText, SOURCE_PATHS[1], SESSION_ALLOWED_IMPORTS);
  const mount = functionText(sourceText, SOURCE_PATHS[1], "mountRuntimeHeadlessSession");
  const buildSurfaceText = functionText(sourceText, SOURCE_PATHS[1], "buildSurface");
  const commit = functionText(sourceText, SOURCE_PATHS[1], "commitPublishedReactive");
  const dispatch = functionText(sourceText, SOURCE_PATHS[1], "dispatchPreparedEvent");
  const disposeSurface = functionText(sourceText, SOURCE_PATHS[1], "disposeCompleteSurface");
  const disposeAuthority = functionText(sourceText, SOURCE_PATHS[1], "disposeSessionAuthority");
  const disposeSession = functionText(sourceText, SOURCE_PATHS[1], "disposeRuntimeHeadlessSession");
  assertOrdered(
    mount,
    [
      "validateDesenExecutionCatalogSet",
      "validateDesenBundleExecutionContracts",
      "calculateDesenBundleRevision",
    ],
    "HEADLESS_INGRESS_VALIDATION_DRIFT",
    "Unknown-ingress validation",
  );
  assertIncludes(sourceText, "createRuntimeReactiveHostPorts", "HEADLESS_INGRESS_VALIDATION_DRIFT");
  for (const anchor of ["createSharedHostPorts", "hostPorts", "catalogSet", "revision-mismatch"]) {
    assertIncludes(mount, anchor, "HEADLESS_INGRESS_VALIDATION_DRIFT");
  }
  for (const anchor of [
    "graph.hostPorts",
    "mountRuntimeSurfaceResources",
    "mountRuntimeSurfaceOperations",
    "mountRuntimeReactiveReevaluation",
    "materializeRuntimeHeadlessSurface",
  ]) {
    assertIncludes(buildSurfaceText, anchor, "HEADLESS_SHARED_HOST_DRIFT");
  }
  for (const anchor of [
    "exactCommitment",
    "readRuntimeHeadlessMaterializationSidecar",
    "reactive.evaluationId",
    "planDigest",
    "bindingDigest",
    "reconcileBindings",
  ]) {
    assertIncludes(commit, anchor, "HEADLESS_COMMITMENT_JOIN_DRIFT");
  }
  for (const anchor of [
    "requestMatchesIntent",
    "componentSelectorKey",
    "behaviorSelectorKey",
    "lifetime.definition.programs.get",
    "currentResolutionSnapshot",
    "executeRuntimeActionTurn",
  ]) {
    assertIncludes(dispatch, anchor, "HEADLESS_EVENT_PROVENANCE_DRIFT");
  }
  assertOrdered(
    disposeSurface,
    [
      "disposeRuntimeReactiveReevaluation",
      "disposeRuntimeAdapterBridges",
      "disposeRuntimeActionTurns",
    ],
    "HEADLESS_DISPOSAL_ORDER_DRIFT",
    "Composed surface disposal",
  );
  for (const anchor of ["SESSION_AUTHORITIES.set", "completeDeferredSessionCleanup"]) {
    assertIncludes(disposeAuthority, anchor, "HEADLESS_SESSION_DISPOSAL_DRIFT");
  }
  for (const anchor of ["already-disposed", "activatedSurfaces"]) {
    assertIncludes(disposeSession, anchor, "HEADLESS_SESSION_DISPOSAL_DRIFT");
  }
  for (const anchor of [
    "maxNodes",
    "maxDepth",
    "maxBindingCandidates",
    "maxEventHandlerBindings",
    "maxSurfaceTransitions",
    "maxSnapshotGeneration",
    "maxPlanJsonOccurrences",
    "maxPlanCodeUnits",
  ]) {
    assertIncludes(sourceText, anchor, "HEADLESS_SESSION_LIMIT_DRIFT");
  }
  for (const anchor of [
    "maxNodes: 5_000",
    "maxDepth: 128",
    "maxBindingCandidates: 5_000",
    "maxEventHandlerBindings: 5_000",
    "maxSurfaceTransitions: 64",
    "maxSnapshotGeneration: Number.MAX_SAFE_INTEGER",
    "maxPlanJsonOccurrences: 262_144",
    "maxPlanCodeUnits: 4_194_304",
  ]) {
    assertIncludes(sourceText, anchor, "HEADLESS_SESSION_LIMIT_DRIFT");
  }
  return Object.freeze({
    unknownIngressChecks: 5,
    exactPackageChecks: 4,
    sharedHostChecks: 5,
    commitmentJoinChecks: 6,
    eventOriginChecks: 6,
    sevenNamespaceChecks: 7,
    reconciliationChecks: 8,
    settlementObservationChecks: 6,
    navigationChecks: 5,
    disposalChecks: 6,
    finiteLimitChecks: 8,
    ...platform,
  });
}

/**
 * Builds deterministic M04-T16/G04 evidence without writing the tracked artifact.
 */
export async function buildRuntimeCoreHeadlessSignInEvidence(options = undefined) {
  const normalized = normalizeOptions(options);
  const fileOverrides = normalized.fileOverrides;
  const prerequisiteBytes = normalized.prerequisiteBytes ?? {};
  const prerequisitesPromise = Promise.all(
    PREREQUISITES.map((definition) =>
      verifyPrerequisite(definition, prerequisiteBytes[definition.key]),
    ),
  );
  const [
    prerequisites,
    materializationSource,
    sessionSource,
    materializationTests,
    sessionTests,
    typeTests,
    materializationDeclaration,
    materializationJavaScript,
    sessionDeclaration,
    sessionJavaScript,
    sourceIndex,
    builtIndexDeclaration,
    builtIndexJavaScript,
    rootTests,
    manifestText,
    traceText,
    historicalTraceArtifactBytes,
    historicalInteractionArtifactBytes,
    historicalReferenceParityArtifactBytes,
    normativeText,
    proofMatrixText,
    findingsText,
    proofText,
    tasksText,
    bundleText,
    catalogText,
    tracked,
  ] = await Promise.all([
    prerequisitesPromise,
    readWorkspaceText(SOURCE_PATHS[0], fileOverrides),
    readWorkspaceText(SOURCE_PATHS[1], fileOverrides),
    readWorkspaceText(FOCUSED_TEST_PATHS[0], fileOverrides),
    readWorkspaceText(FOCUSED_TEST_PATHS[1], fileOverrides),
    readWorkspaceText(TYPE_TEST_PATH, fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/headless-materialization.d.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/headless-materialization.js", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/headless-session.d.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/headless-session.js", fileOverrides),
    readWorkspaceText("packages/runtime-core/src/index.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/index.d.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/index.js", fileOverrides),
    readWorkspaceText(ROOT_TEST_PATH, fileOverrides),
    readWorkspaceText("packages/runtime-core/package.json", fileOverrides),
    readWorkspaceText("docs/proof/protocol-0.1.0-traceability.json", fileOverrides),
    readWorkspaceBytes(HISTORICAL_TRACE_ARTIFACT_PATH, fileOverrides),
    readWorkspaceBytes(HISTORICAL_INTERACTION_ARTIFACT_PATH, fileOverrides),
    readWorkspaceBytes(HISTORICAL_REFERENCE_PARITY_ARTIFACT_PATH, fileOverrides),
    readWorkspaceText("docs/proof/NORMATIVE-COVERAGE.md", fileOverrides),
    readWorkspaceText("docs/proof/PROOF-MATRIX.md", fileOverrides),
    readWorkspaceText("docs/plan/PROTOCOL-FINDINGS.md", fileOverrides),
    readWorkspaceText(PROOF_DOCUMENT_PATH, fileOverrides),
    readWorkspaceText("docs/plan/TASKS.md", fileOverrides),
    readWorkspaceText(BUNDLE_PATH, fileOverrides),
    readWorkspaceText(CATALOG_PATH, fileOverrides),
    trackedFiles(fileOverrides),
  ]);

  const materializationInvariants = verifyMaterializationSourceInvariants(materializationSource);
  const sessionInvariants = verifySessionSourceInvariants(sessionSource);
  const publicApi = verifyPublicApi({
    materializationSource,
    sessionSource,
    materializationDeclaration,
    materializationJavaScript,
    sessionDeclaration,
    sessionJavaScript,
    sourceIndex,
    builtIndexDeclaration,
    builtIndexJavaScript,
  });
  for (const [relativePath, expected] of Object.entries(EXPECTED_SOURCE_SHA256)) {
    const sourceText = relativePath.includes("materialization")
      ? materializationSource
      : sessionSource;
    if (sha256(Buffer.from(sourceText)) !== expected) {
      fail("HEADLESS_SOURCE_BYTE_DRIFT", `Reviewed M04-T16 source bytes drifted: ${relativePath}.`);
    }
  }
  const tests = verifyTestInventory({
    materializationTests,
    sessionTests,
    typeTests,
    rootTests,
    manifestText,
  });
  const traceAssignments = verifyTrace(
    parseJson(traceText, "HEADLESS_TRACE_INVALID", "protocol traceability"),
    sha256(Buffer.from(traceText)),
    historicalTraceArtifactBytes,
    tasksText,
  );
  const documentation = verifyDocumentation({
    normativeText,
    proofMatrixText,
    findingsText,
    proofText,
    tasksText,
    allowPendingArtifactReference: normalized.allowPendingArtifactReference,
  });
  const historicalVerifierCompatibility = verifyHistoricalInteractionCompatibility(
    normativeText,
    historicalInteractionArtifactBytes,
  );
  const historicalReferenceParityCompatibility = verifyHistoricalReferenceParityCompatibility(
    normativeText,
    historicalReferenceParityArtifactBytes,
  );
  const [runtimeApi, protocolApi] = await Promise.all([
    normalized.runtimeApi ?? import(RUNTIME_API_URL.href),
    normalized.protocolApi ?? import(PROTOCOL_API_URL.href),
  ]);
  const runtimeCandidate =
    normalized.runtimeProbe ??
    (await probeRuntimeBehavior(runtimeApi, protocolApi, bundleText, catalogText));
  const runtime = verifyRuntimeTraceEvidence(runtimeCandidate, protocolApi);

  const artifact = Object.freeze({
    schemaVersion: 1,
    task: "M04-T16",
    gate: "G04",
    result: "PASS",
    claim: Object.freeze({
      protocol: "0.1.0",
      target: "platform-neutral",
      summary:
        "The exact frozen sign-in Bundle and Catalog pass unknown-ingress validation, complete bounded headless materialization, authenticated selector-to-program dispatch, stale-safe asynchronous reevaluation, deterministic navigation, and byte-identical JSON-observable trace execution.",
      taskStatusChanges: Object.freeze(["M04-T16:NOT_STARTED->DONE"]),
      gateStatusChanges: Object.freeze(["G04:NOT_STARTED->DONE"]),
      proofMatrixStatusChanges: Object.freeze([]),
      normativeStatusChanges: Object.freeze(["N-003:PLANNED->TESTED"]),
    }),
    prerequisites: Object.freeze(prerequisites),
    publicApi,
    sourceInvariants: Object.freeze({
      materialization: materializationInvariants,
      session: sessionInvariants,
    }),
    runtime,
    limits: Object.freeze({
      maxNodes: 5_000,
      maxDepth: 128,
      maxBindingCandidates: 5_000,
      maxEventHandlerBindings: 5_000,
      maxSurfaceTransitions: 64,
      maxSnapshotGeneration: Number.MAX_SAFE_INTEGER,
      maxPlanJsonOccurrences: 262_144,
      maxPlanCodeUnits: 4_194_304,
    }),
    semantics: Object.freeze({
      ingress:
        "Unknown Catalog and Bundle values pass cumulative execution validation before exact declared revision and Catalog requirements admit a session.",
      sameHost:
        "One factory-authenticated reactive host aggregate is captured once and supplied to resource, operation, action, and reactive authorities for every managed surface.",
      materialization:
        "A complete finite traversal evaluates conditional presence, repeats, values, tokens, variants, styles, behaviors, and slots without admitting descendants of an absent node.",
      commitment:
        "The T15 observable value contains only stable plan and binding digests; a private sidecar is readable only for the exact evaluation id repeated by the accepted T15 publication.",
      provenance:
        "An authenticated T14 component or behavior ticket selects one prepared T13 program and derives all seven namespaces from current factory-owned state, event, item, and host snapshots.",
      signIn:
        "The official sign-in profile proves state input, loading, declared failure, retry, stale replacement protection, successful navigation, and independent home-surface materialization.",
      deterministicTrace:
        "Success, failure-then-retry, and stale-replacement each run in two independent sessions with byte-identical RFC 8785 bytes and equal per-scenario SHA-256 digests; the combined six-run JSON trace round-trips with zero executable or platform-owned values.",
      disposal:
        "The composed lifetime revokes reactive authority first, removes mirrored adapter bindings while command authority remains live, then disposes the surrendered action-manager graph exactly once.",
    }),
    documentation,
    evidence: Object.freeze({
      focusedTestRegistrations: tests.focusedRegistrations,
      focusedTests: tests.focusedCases,
      compilerNegativeCases: tests.compilerNegativeCases,
      rootMutationTests: tests.rootMutationTests,
      traceAssignments,
      historicalVerifierCompatibility,
      historicalReferenceParityCompatibility,
      trackedFiles: tracked,
      semanticOnlySharedInputs: Object.freeze([
        "packages/runtime-core/package.json",
        "packages/runtime-core/src/index.ts",
        "packages/runtime-core/dist/index.js",
        "packages/runtime-core/dist/index.d.ts",
        "docs/proof/protocol-0.1.0-traceability.json",
        HISTORICAL_TRACE_ARTIFACT_PATH,
        HISTORICAL_INTERACTION_ARTIFACT_PATH,
        HISTORICAL_REFERENCE_PARITY_ARTIFACT_PATH,
        "docs/proof/NORMATIVE-COVERAGE.md",
        "docs/proof/PROOF-MATRIX.md",
        "docs/plan/PROTOCOL-FINDINGS.md",
        "docs/plan/TASKS.md",
        PROOF_DOCUMENT_PATH,
        BUNDLE_PATH,
        CATALOG_PATH,
      ]),
    }),
    deferred: Object.freeze([
      "generic automatic invalidation for future nested settlement programs without a T13 completion observer",
      "P-18 completion pending the independent M08-T10 artifact round-trip gate",
      "production Web–React rendering, reconciliation, DOM/CSS/accessibility/focus, and adapter command parity (M05)",
      "illustrative frozen Catalog package digest rather than production package-byte integrity or activation",
      "Android and iOS adapter implementations",
      "future protocol clarification recorded by PF-046",
    ]),
  });
  const artifactText = await format(JSON.stringify(artifact), {
    parser: "json",
    endOfLine: "lf",
    printWidth: 100,
    tabWidth: 2,
  });
  const artifactBytes = Buffer.from(artifactText);
  return Object.freeze({
    artifact,
    artifactBytes,
    artifactSha256: sha256(artifactBytes),
    currentEvidence: Object.freeze({
      tests: tests.current,
    }),
  });
}

async function readArtifactBytes(artifactPath) {
  let entry;
  try {
    entry = await lstat(artifactPath);
  } catch (error) {
    fail("HEADLESS_ARTIFACT_MISSING", "M04-T16/G04 artifact is missing.", {
      cause: String(error),
    });
  }
  if (!entry.isFile() || entry.isSymbolicLink()) {
    fail("HEADLESS_ARTIFACT_UNSAFE", "M04-T16/G04 artifact must be a regular file.");
  }
  return readFile(artifactPath);
}

async function canonicalArtifactTarget(artifactPath) {
  const absolutePath = path.resolve(artifactPath);
  return path.join(await realpath(path.dirname(absolutePath)), path.basename(absolutePath));
}

async function resolveArtifactTarget(artifactPath) {
  const [resolvedArtifactPath, historicalArtifactPath] = await Promise.all([
    canonicalArtifactTarget(artifactPath),
    canonicalArtifactTarget(DEFAULT_RUNTIME_CORE_HEADLESS_SIGN_IN_ARTIFACT_PATH),
  ]);
  return Object.freeze({
    artifactPath: resolvedArtifactPath,
    targetsHistoricalArtifact: resolvedArtifactPath === historicalArtifactPath,
  });
}

async function authenticateHistoricalArtifact(artifactPath, suppliedBytes) {
  const artifactBytes =
    suppliedBytes === undefined
      ? await readArtifactBytes(artifactPath)
      : Buffer.from(suppliedBytes);
  const artifactSha256 = sha256(artifactBytes);
  if (artifactSha256 !== HISTORICAL_ARTIFACT_SHA256) {
    fail("HEADLESS_ARTIFACT_DRIFT", "Immutable task-time M04-T16/G04 evidence bytes changed.", {
      expectedSha256: HISTORICAL_ARTIFACT_SHA256,
      actualSha256: artifactSha256,
    });
  }

  let artifact;
  try {
    artifact = JSON.parse(artifactBytes.toString("utf8"));
  } catch {
    fail("HEADLESS_ARTIFACT_DRIFT", "Immutable task-time M04-T16/G04 evidence is not valid JSON.");
  }
  const assignments = artifact.evidence?.traceAssignments;
  const runtime = artifact.runtime;
  const expectedPrerequisites = PREREQUISITES.map(({ task, artifact: fileName, sha256 }) => ({
    task,
    artifact: fileName,
    sha256,
  }));
  if (
    artifact.schemaVersion !== 1 ||
    artifact.task !== "M04-T16" ||
    artifact.gate !== "G04" ||
    artifact.result !== "PASS" ||
    artifact.claim?.protocol !== "0.1.0" ||
    artifact.claim?.target !== "platform-neutral" ||
    !isDeepStrictEqual(artifact.claim?.taskStatusChanges, ["M04-T16:NOT_STARTED->DONE"]) ||
    !isDeepStrictEqual(artifact.claim?.gateStatusChanges, ["G04:NOT_STARTED->DONE"]) ||
    artifact.claim?.proofMatrixStatusChanges?.length !== 0 ||
    !isDeepStrictEqual(artifact.claim?.normativeStatusChanges, ["N-003:PLANNED->TESTED"]) ||
    !isDeepStrictEqual(artifact.prerequisites, expectedPrerequisites) ||
    artifact.publicApi?.runtimeExports !== 7 ||
    artifact.publicApi?.typeExports !== 22 ||
    artifact.publicApi?.totalExports !== 29 ||
    artifact.publicApi?.moduleExports !== 35 ||
    artifact.publicApi?.tsdocDeclarations !== 35 ||
    artifact.documentation?.normativeStatusChanges !== 1 ||
    artifact.documentation?.proofMatrixStatusChanges !== 0 ||
    artifact.documentation?.taskStatusChanges !== 2 ||
    artifact.documentation?.findings !== 3 ||
    artifact.evidence?.focusedTestRegistrations !== 34 ||
    artifact.evidence?.focusedTests !== 34 ||
    artifact.evidence?.compilerNegativeCases !== 11 ||
    artifact.evidence?.rootMutationTests !== 24 ||
    artifact.evidence?.trackedFiles?.length !== 21 ||
    assignments?.auditedBaseline?.ownerAssignments !== 6 ||
    assignments?.auditedBaseline?.testAssignments !== 70 ||
    assignments?.auditedBaseline?.uniqueRules !== 72 ||
    assignments?.currentApplicable?.ownerAssignments !== 6 ||
    assignments?.currentApplicable?.testAssignments !== 65 ||
    assignments?.currentApplicable?.uniqueRules !== 67 ||
    assignments?.currentApplicable?.correctedOverclaims !== 5 ||
    assignments?.classifications?.["t03-t15-prerequisite"] !== 26 ||
    assignments?.classifications?.["t16-integration"] !== 41 ||
    assignments?.classifications?.["future-deferred"] !== 5 ||
    artifact.evidence?.historicalVerifierCompatibility?.currentOwnerTask !== "M04-T16" ||
    artifact.evidence?.historicalVerifierCompatibility?.transferredPaths?.length !== 2 ||
    artifact.evidence?.historicalReferenceParityCompatibility?.currentOwnerTask !== "M04-T16" ||
    artifact.evidence?.historicalReferenceParityCompatibility?.transferredPaths?.length !== 2 ||
    runtime?.deterministicRuns !== 6 ||
    runtime?.sessionsPerScenario !== 2 ||
    runtime?.scenarioCount !== 3 ||
    runtime?.scenarios?.success?.runs !== 2 ||
    runtime?.scenarios?.success?.traceEntries !== 6 ||
    runtime?.scenarios?.failureRetry?.runs !== 2 ||
    runtime?.scenarios?.failureRetry?.traceEntries !== 8 ||
    runtime?.scenarios?.staleReplacement?.runs !== 2 ||
    runtime?.scenarios?.staleReplacement?.traceEntries !== 10 ||
    runtime?.traceEntries !== 48 ||
    runtime?.traceCanonicalCodeUnits !== 127_563 ||
    runtime?.traceSha256 !== "50f0005ec5447e673a46f91a7daf1be52827f0e7fc7d3941976ed1e8ceb798ce" ||
    runtime?.jsonOccurrences !== 5_339 ||
    runtime?.executableValues !== 0 ||
    runtime?.platformValues !== 0 ||
    runtime?.ingressRejections !== 2 ||
    runtime?.successOperationCalls !== 1 ||
    runtime?.successNavigationCalls !== 1 ||
    runtime?.failureRetryAttempts !== 2 ||
    runtime?.staleRaceAttempts !== 2 ||
    runtime?.staleNavigations !== 0 ||
    runtime?.exactOnceSubscriptionCleanups !== 4 ||
    runtime?.frozenTraceEnvelopes !== 58 ||
    artifact.limits?.maxNodes !== 5_000 ||
    artifact.limits?.maxDepth !== 128 ||
    artifact.limits?.maxBindingCandidates !== 5_000 ||
    artifact.limits?.maxEventHandlerBindings !== 5_000 ||
    artifact.limits?.maxSurfaceTransitions !== 64 ||
    artifact.limits?.maxSnapshotGeneration !== Number.MAX_SAFE_INTEGER ||
    artifact.limits?.maxPlanJsonOccurrences !== 262_144 ||
    artifact.limits?.maxPlanCodeUnits !== 4_194_304
  ) {
    fail(
      "HEADLESS_ARTIFACT_DRIFT",
      "Immutable M04-T16/G04 evidence no longer has its reviewed identity, inventory, or semantics.",
    );
  }
  return Object.freeze({
    artifact,
    artifactBytes: Buffer.from(artifactBytes),
    artifactSha256: HISTORICAL_ARTIFACT_SHA256,
  });
}

async function verifyHistoricalArtifactReferences(buildOptions) {
  const normalizedBuildOptions = normalizeOptions(buildOptions);
  const fileOverrides = normalizedBuildOptions.fileOverrides;
  const [proofText, proofMatrixText] = await Promise.all([
    readWorkspaceText(PROOF_DOCUMENT_PATH, fileOverrides),
    readWorkspaceText(PROOF_MATRIX_PATH, fileOverrides),
  ]);
  if (
    exactProofArtifactSha256(proofText) !== HISTORICAL_ARTIFACT_SHA256 ||
    exactProofMatrixArtifactSha256(proofMatrixText) !== HISTORICAL_ARTIFACT_SHA256
  ) {
    fail(
      "HEADLESS_ARTIFACT_REFERENCE_DRIFT",
      "The M04-T16 proof and bounded proof-matrix section must pin the exact historical SHA-256.",
    );
  }
}

function summarizeEvidence(evidence, compatibilityMode = undefined) {
  const artifact = evidence.artifact;
  const summary = {
    result: "PASS",
    artifactSha256: evidence.artifactSha256,
    runtimeExports: artifact.publicApi.runtimeExports,
    typeExports: artifact.publicApi.typeExports,
    moduleExports: artifact.publicApi.moduleExports,
    tsdocDeclarations: artifact.publicApi.tsdocDeclarations,
    focusedTests: artifact.evidence.focusedTests,
    compilerNegativeCases: artifact.evidence.compilerNegativeCases,
    rootMutationTests: artifact.evidence.rootMutationTests,
    traceRules: artifact.evidence.traceAssignments.auditedBaseline.uniqueRules,
    currentTraceRules: artifact.evidence.traceAssignments.currentApplicable.uniqueRules,
    deferredTraceRules: artifact.evidence.traceAssignments.classifications["future-deferred"],
    historicalVerifierTransfers:
      artifact.evidence.historicalVerifierCompatibility.currentOwnerTask === "M04-T16"
        ? artifact.evidence.historicalVerifierCompatibility.transferredPaths.length +
          artifact.evidence.historicalReferenceParityCompatibility.transferredPaths.length
        : 0,
    normativeStatusChanges: artifact.documentation.normativeStatusChanges,
    proofMatrixStatusChanges: artifact.documentation.proofMatrixStatusChanges,
    trackedFiles: artifact.evidence.trackedFiles.length,
    ...artifact.runtime,
  };
  if (compatibilityMode !== undefined) summary.compatibilityMode = compatibilityMode;
  return Object.freeze(summary);
}

/**
 * Writes current M04-T16-shaped evidence only to a non-historical destination.
 *
 * @remarks The tracked task-time artifact is immutable. Targeting its default path authenticates
 * and returns the historical evidence without rebuilding or replacing it.
 */
export async function writeRuntimeCoreHeadlessSignInEvidence(options = undefined) {
  const normalized = normalizeOptions(options);
  const requestedArtifactPath =
    normalized.artifactPath ?? DEFAULT_RUNTIME_CORE_HEADLESS_SIGN_IN_ARTIFACT_PATH;
  const target = await resolveArtifactTarget(requestedArtifactPath);
  if (target.targetsHistoricalArtifact) {
    const historical = await authenticateHistoricalArtifact(
      DEFAULT_RUNTIME_CORE_HEADLESS_SIGN_IN_ARTIFACT_PATH,
    );
    await verifyHistoricalArtifactReferences(normalized.buildOptions);
    return Object.freeze({
      ...summarizeEvidence(historical, "immutable-task-time-artifact"),
      artifactPath: target.artifactPath,
    });
  }
  const evidence =
    normalized.preparedEvidence ??
    (await buildRuntimeCoreHeadlessSignInEvidence(normalized.buildOptions));
  await writeAtomicProofArtifact({
    artifactPath: target.artifactPath,
    artifactBytes: evidence.artifactBytes,
    beforeAtomicRename: normalized.beforeAtomicRename,
  });
  return Object.freeze({ ...summarizeEvidence(evidence), artifactPath: target.artifactPath });
}

/** Authenticates immutable task-time M04-T16/G04 evidence without successor byte coupling. */
export async function verifyRuntimeCoreHeadlessSignInEvidence(options = undefined) {
  const normalized = normalizeOptions(options);
  rejectVerifierRuntimeInjection(normalized.buildOptions);
  const artifactPath =
    normalized.artifactPath ?? DEFAULT_RUNTIME_CORE_HEADLESS_SIGN_IN_ARTIFACT_PATH;
  const historical = await authenticateHistoricalArtifact(artifactPath, normalized.artifactBytes);
  await verifyHistoricalArtifactReferences(normalized.buildOptions);
  return summarizeEvidence(historical, "immutable-task-time-artifact");
}
