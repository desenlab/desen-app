import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";

import { format } from "prettier";
import ts from "typescript";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";
import { verifyProtocolComponentNormativeCompatibility } from "./protocol-component-contracts-proof.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const RUNTIME_API_URL = new URL("../../packages/runtime-core/dist/index.js", import.meta.url);
const ACTION_TURNS_API_URL = new URL(
  "../../packages/runtime-core/dist/action-turns.js",
  import.meta.url,
);
const ARTIFACT_RELATIVE_PATH = "docs/proof/artifacts/runtime-core-0.1.0-audit-hardening.json";
const ARTIFACT_FILE_NAME = "runtime-core-0.1.0-audit-hardening.json";
const PROOF_DOCUMENT_PATH = "docs/proof/RUNTIME-CORE-AUDIT-HARDENING.md";
const PROOF_MATRIX_PATH = "docs/proof/PROOF-MATRIX.md";
const PENDING_ARTIFACT_SHA256 = "[PENDING_FINAL_ARTIFACT_SHA256]";

/** Absolute path to the deterministic M04-T17 audit-hardening artifact. */
export const DEFAULT_RUNTIME_CORE_AUDIT_HARDENING_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_RELATIVE_PATH,
);

const PREREQUISITES = Object.freeze([
  Object.freeze({
    key: "actionTurns",
    task: "M04-T13",
    path: "docs/proof/artifacts/runtime-core-0.1.0-action-turns.json",
    sha256: "5b2f95b897116fdd9ff5320d8720e104d7b93f148d28bfcaf067c838785f9d87",
  }),
  Object.freeze({
    key: "adapterBridges",
    task: "M04-T14",
    path: "docs/proof/artifacts/runtime-core-0.1.0-adapter-bridges.json",
    sha256: "bfdeddbffd458941464620e0af2013d374bf8e64068ca060d33651ddeb2660c7",
  }),
  Object.freeze({
    key: "reactiveReevaluation",
    task: "M04-T15",
    path: "docs/proof/artifacts/runtime-core-0.1.0-reactive-reevaluation.json",
    sha256: "7e412daf9e2e8f08f40a4b093430775414aa1df4a9b14d690d2bf45966cbec67",
  }),
  Object.freeze({
    key: "headlessSignIn",
    task: "M04-T16",
    path: "docs/proof/artifacts/runtime-core-0.1.0-headless-sign-in.json",
    sha256: "bdda1b2d0c4630a1a6708b2e6bb9a9ecdca0c2efca3615ca4cf69cee871170a4",
  }),
  Object.freeze({
    key: "componentContracts",
    task: "M02-T08",
    path: "docs/proof/artifacts/protocol-0.1.0-component-contracts.json",
    sha256: "71cd73475a1c59f734870051bcd6d26a8a2b7bf83caf9bed3d3882da467014ac",
  }),
]);

const REVIEWED_SHA256 = Object.freeze({
  "packages/runtime-core/src/action-turns.ts":
    "cf956ed10a2cfa1c28a952dd00b0dd8dfae85b4606bfa72600686b4022b89dc5",
  "packages/runtime-core/src/headless-session.ts":
    "4253c59ba928dc3eac9900183dc90412691e284ff61ef6020fbb08c70292fa0d",
  "packages/runtime-core/src/index.ts":
    "193d21d7552d5cd4c0a26f7f08ab1ac9eaa21fac51130bf5a5b40fa33b41afaf",
  "packages/runtime-core/test/action-turns.test.ts":
    "eb20829ec1f551ff4ee512169a2882159215c791c0338d7b7a7d4bdb6ab21904",
  "packages/runtime-core/test/headless-session.test.ts":
    "827f69f51276ff2e87d7b2aa0ebd92cb0463bbcfa5fecfc94190ae2c5aa94c78",
  "packages/runtime-core/test/headless-session.types.ts":
    "bb61a39b1938305a332cf5f2cc863864676bcea1b39a87686087d641f3f20528",
});
const TRANSFERRED_SHA256 = Object.freeze({
  "scripts/lib/runtime-core-action-turns-proof.mjs":
    "87fbf4fbe7d14cd78f722ab82cddc9947cfd4ceffd01ae4b7012d8651bd0b469",
  "tests/runtime-core-action-turns.test.mjs":
    "9bcbab58b536064544192192ac8b7ef5d362736debbd04cede5ff29c18686f88",
  "scripts/lib/runtime-core-adapter-bridges-proof.mjs":
    "bd20ad70b74462c1658aa778331fe467c386cec5f98be5d7c580b8144b11da33",
  "tests/runtime-core-adapter-bridges.test.mjs":
    "1ff5c530e842709f074dea26eee57d17a8cebbc3fc445e0a15e5a653141b97fd",
  "scripts/lib/runtime-core-reactive-reevaluation-proof.mjs":
    "b24b97db0d8f11581a6727512d33422aefa7c6626565be98075f78cfb89ecc50",
  "tests/runtime-core-reactive-reevaluation.test.mjs":
    "969fb1d942840d1311b32b7212d0ea37ff056e7c18e0bd4f768a08e8bde74ff0",
  "scripts/lib/runtime-core-headless-sign-in-proof.mjs":
    "53821a90176802d73f0aa5c39afbe079cfe6635dbfd2b8fbcb29738331ab7948",
  "tests/runtime-core-headless-sign-in.test.mjs":
    "d01ac1d6cf82e315d49acadbbb403e19c1b70ad909d1cd42696d50cdfe8d4e7a",
  "scripts/lib/reference-catalog-web-parity-proof.mjs":
    "5a95fa80171b44a905174d8c16d39b46ceced87759d6ffb2686e32988afbd93a",
  "scripts/lib/protocol-component-contracts-proof.mjs":
    "c63fdce9bfb2a278b8772ea489cb6260852a0fde451ec736db383f3c9d161e3e",
  "tests/protocol-component-contracts.test.mjs":
    "47f9c685d3bc936157c9f4e0746a996607233b7c5ec0f3cc96f1fffd19a0024f",
});
const TRACKED_PATHS = Object.freeze([
  ...Object.keys(REVIEWED_SHA256),
  ...Object.keys(TRANSFERRED_SHA256),
  "scripts/lib/runtime-core-audit-hardening-proof.mjs",
  "scripts/generate-runtime-core-audit-hardening-proof.mjs",
  "scripts/verify-runtime-core-audit-hardening.mjs",
  "tests/runtime-core-audit-hardening.test.mjs",
]);
const RUNTIME_SOURCE_PATHS = Object.freeze([
  "packages/runtime-core/src/action-evaluation.ts",
  "packages/runtime-core/src/action-turns.ts",
  "packages/runtime-core/src/adapter-bridges.ts",
  "packages/runtime-core/src/command-event-actions.ts",
  "packages/runtime-core/src/command-event-ports.ts",
  "packages/runtime-core/src/headless-materialization.ts",
  "packages/runtime-core/src/headless-session.ts",
  "packages/runtime-core/src/host-ports.ts",
  "packages/runtime-core/src/index.ts",
  "packages/runtime-core/src/local-state.ts",
  "packages/runtime-core/src/node-identity.ts",
  "packages/runtime-core/src/operation-lifecycle.ts",
  "packages/runtime-core/src/operation-resource-actions.ts",
  "packages/runtime-core/src/predicate-evaluation.ts",
  "packages/runtime-core/src/reactive-host-ports.ts",
  "packages/runtime-core/src/reactive-reevaluation.ts",
  "packages/runtime-core/src/repeat-materialization.ts",
  "packages/runtime-core/src/resource-lifecycle.ts",
  "packages/runtime-core/src/runtime-json-snapshot.ts",
  "packages/runtime-core/src/state-navigation-actions.ts",
  "packages/runtime-core/src/token-format-resolution.ts",
  "packages/runtime-core/src/value-resolution.ts",
  "packages/runtime-core/src/variant-style-evaluation.ts",
]);
const EXPECTED_TASK_ROWS = Object.freeze([
  Object.freeze({
    id: "M04-T17",
    line: 106,
    sha256: "ff6129b6849409ac02a174fd77cb4e9746171003c3f8024adf4270904ef297ce",
    cells: Object.freeze([
      "M04-T17",
      "DONE",
      "M04-T16",
      "G04 audit hardening: authenticated session-completion notification, generic nested-settlement publication, exact-location proof validation, N-026/N-029 correction migration, and deterministic fault injection",
    ]),
  }),
  Object.freeze({
    id: "G04",
    line: 107,
    sha256: "18c2440d4dd5b732a4e01785c4e9361e19177bb803282d7b675dcfc746643735",
    cells: Object.freeze([
      "G04",
      "DONE",
      "M04-T01–M04-T17",
      "Framework-neutral sign-in runtime and post-audit hardening pass",
    ]),
  }),
]);
const EXPECTED_NORMATIVE_ROWS = Object.freeze([
  Object.freeze({
    id: "N-026",
    line: 65,
    owners: "M02-T08, M04-T02, M05-T02",
    status: "PLANNED",
    date: "2026-07-27",
    sha256: "cab59ebf0a8387e625931e5f178719027ecb043693420c2122abfbeb96d7c7a4",
  }),
  Object.freeze({
    id: "N-028",
    line: 67,
    owners: "M02-T08, M05-T03",
    status: "TESTED",
    date: undefined,
    sha256: "fd324729cd2f61c604a01c78ad7eb295b4ab97feb3438a39131c46a5d47ddca0",
  }),
  Object.freeze({
    id: "N-029",
    line: 68,
    owners: "M02-T08, M05-T03",
    status: "PLANNED",
    date: "2026-07-27",
    sha256: "980b38a99fc536ab20ccbbd41444d6c2b50de1a1818e720a82f718ca084870f8",
  }),
]);
const HISTORICAL_STATUSES = Object.freeze([
  Object.freeze({ id: "N-026", status: "TESTED" }),
  Object.freeze({ id: "N-028", status: "TESTED" }),
  Object.freeze({ id: "N-029", status: "TESTED" }),
]);
const CURRENT_STATUSES = Object.freeze([
  Object.freeze({ id: "N-026", status: "PLANNED" }),
  Object.freeze({ id: "N-028", status: "TESTED" }),
  Object.freeze({ id: "N-029", status: "PLANNED" }),
]);
const PF049_HEADING =
  "## PF-049 — Post-G04 audit corrections require explicit runtime notification and proof migration";
const PF049_LINE = 1704;
const PF049_SHA256 = "04125b2eb2d3bb280b35e23c053c7fce822598e8dc0c058499b5d1f4b4a8b01b";

const ACTION_MODULE_EXPORTS = Object.freeze({
  runtime: Object.freeze([
    "RUNTIME_ACTION_TURN_LIMITS",
    "disposeRuntimeActionTurns",
    "executeRuntimeActionTurn",
    "mountRuntimeActionTurns",
    "prepareRuntimeActionProgram",
    "subscribeRuntimeActionTurnSettlements",
  ]),
  types: Object.freeze([
    "RuntimeActionTurnCompletion",
    "RuntimeActionTurnExecutionResult",
    "RuntimeActionTurnLimitProfile",
    "RuntimeActionTurnProgram",
    "RuntimeActionTurnProgramPreparationResult",
    "RuntimeActionTurnQueued",
    "RuntimeActionTurnRequest",
    "RuntimeActionTurnSettlementPublication",
    "RuntimeActionTurnSettlementSubscriptionResult",
    "RuntimeActionTurnStarted",
    "RuntimeActionTurnStep",
    "RuntimeActionTurnTerminationReason",
    "RuntimeActionTurnsDisposeResult",
    "RuntimeActionTurnsHandle",
    "RuntimeActionTurnsMountInput",
    "RuntimeActionTurnsMountInvalidReason",
    "RuntimeActionTurnsMountResult",
    "RuntimeActionTurnsSnapshot",
  ]),
});
const SESSION_MODULE_EXPORTS = Object.freeze({
  runtime: Object.freeze([
    "RUNTIME_HEADLESS_SESSION_LIMITS",
    "dispatchRuntimeHeadlessSessionEvent",
    "disposeRuntimeHeadlessSession",
    "mountRuntimeHeadlessSession",
    "readRuntimeHeadlessSession",
    "subscribeRuntimeHeadlessSession",
    "unsubscribeRuntimeHeadlessSession",
  ]),
  types: Object.freeze([
    "RuntimeHeadlessBindingSnapshot",
    "RuntimeHeadlessSessionDisposeResult",
    "RuntimeHeadlessSessionEventCompletion",
    "RuntimeHeadlessSessionEventInput",
    "RuntimeHeadlessSessionEventResult",
    "RuntimeHeadlessSessionHandle",
    "RuntimeHeadlessSessionLimitProfile",
    "RuntimeHeadlessSessionListener",
    "RuntimeHeadlessSessionMountInput",
    "RuntimeHeadlessSessionMountInvalidReason",
    "RuntimeHeadlessSessionMountResult",
    "RuntimeHeadlessSessionReadResult",
    "RuntimeHeadlessSessionSnapshot",
    "RuntimeHeadlessSessionSubscribeResult",
    "RuntimeHeadlessSessionSubscription",
    "RuntimeHeadlessSessionUnsubscribeResult",
  ]),
});
const INTERNAL_ACTION_EXPORTS = Object.freeze([
  "subscribeRuntimeActionTurnSettlements",
  "RuntimeActionTurnSettlementPublication",
  "RuntimeActionTurnSettlementSubscriptionResult",
]);
const TSDOC_EXPORTS = Object.freeze([
  ...INTERNAL_ACTION_EXPORTS,
  "subscribeRuntimeHeadlessSession",
  "unsubscribeRuntimeHeadlessSession",
  "RuntimeHeadlessSessionListener",
  "RuntimeHeadlessSessionSubscribeResult",
  "RuntimeHeadlessSessionSubscription",
  "RuntimeHeadlessSessionUnsubscribeResult",
]);
const ROOT_TEST_TITLES = Object.freeze([
  "accepts deterministic pending-reference M04-T17 evidence",
  "builds byte-identical M04-T17 evidence twice",
  "verifies exact in-memory final artifact references",
  "rejects duplicate, moved, or mutated task rows",
  "rejects duplicate, moved, or mutated normative rows",
  "rejects moved or duplicated PF-049 evidence",
  "rejects reviewed runtime source or platform drift",
  "rejects every historical artifact claimed byte-identical",
  "rejects any transferred compatibility verifier or root-test drift",
  "rejects tampered M04-T17 artifact bytes",
  "rejects wrong, relocated, or duplicated artifact SHA pins",
  "rejects unsafe proof-artifact writer destinations",
  "rejects runtime API or probe injection in the production verifier",
]);

/** Controlled deterministic M04-T17 evidence failure. */
export class RuntimeCoreAuditHardeningEvidenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "RuntimeCoreAuditHardeningEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new RuntimeCoreAuditHardeningEvidenceError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function normalizeOptions(options) {
  if (options === undefined) return {};
  if (options === null || typeof options !== "object" || Array.isArray(options)) {
    fail("AUDIT_OPTIONS_INVALID", "M04-T17 evidence options must be an object.");
  }
  return options;
}

async function readWorkspaceBytes(relativePath, fileOverrides) {
  const override = fileOverrides?.[relativePath];
  if (override !== undefined) return Buffer.isBuffer(override) ? override : Buffer.from(override);
  return readFile(path.join(WORKSPACE_ROOT, relativePath));
}

async function readWorkspaceText(relativePath, fileOverrides) {
  return (await readWorkspaceBytes(relativePath, fileOverrides)).toString("utf8");
}

function assertEqual(actual, expected, code, message) {
  if (!isDeepStrictEqual(actual, expected)) fail(code, message, { expected, actual });
}

function markdownCells(row) {
  return row
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());
}

function normalizedMarkdownText(value) {
  return value.trim().replace(/\s+/gu, " ");
}

function markdownHeading(line) {
  const match = line.trim().match(/^(#{1,6})(?:[ \t]+|$)(.*)$/u);
  if (match === null) return undefined;
  const content = match[2].replace(/[ \t]+#+[ \t]*$/u, "");
  return Object.freeze({
    level: match[1].length,
    text: normalizedMarkdownText(content),
  });
}

function headingOccurrences(lines, heading) {
  const expected = markdownHeading(heading);
  if (expected === undefined) {
    fail("AUDIT_INTERNAL_ERROR", `Expected heading is not an ATX heading: ${heading}.`);
  }
  const occurrences = [];
  for (const [index, line] of lines.entries()) {
    const atx = markdownHeading(line);
    if (atx?.level === expected.level && atx.text === expected.text) {
      occurrences.push(Object.freeze({ index, line, kind: "atx" }));
    }
    if (
      (expected.level === 1 || expected.level === 2) &&
      normalizedMarkdownText(line) === expected.text &&
      index + 1 < lines.length &&
      (expected.level === 1 ? /^=+[ \t]*$/u : /^-+[ \t]*$/u).test(lines[index + 1].trim())
    ) {
      occurrences.push(Object.freeze({ index, line, kind: "setext" }));
    }
  }
  return occurrences;
}

function isLevelTwoHeading(lines, index) {
  if (markdownHeading(lines[index])?.level === 2) return true;
  return (
    index + 1 < lines.length &&
    normalizedMarkdownText(lines[index]).length > 0 &&
    /^-+[ \t]*$/u.test(lines[index + 1].trim())
  );
}

function tableRowId(line) {
  const match = line.trim().match(/^\|?[ \t]*([^|]*?)[ \t]*\|/u);
  return match === null ? undefined : match[1].trim();
}

function standaloneCodeSpanValue(line, suffix) {
  const trimmed = line.trim();
  const match = trimmed.match(/^(`+)(.*?)\1(\.)?$/u);
  if (match === null || (match[3] ?? "") !== suffix) return undefined;
  let value = match[2].replace(/[ \t]+/gu, " ");
  if (value.startsWith(" ") && value.endsWith(" ") && value.trim().length > 0) {
    value = value.slice(1, -1);
  }
  return value;
}

function exactHeadingRange(markdown, heading, code) {
  const lines = markdown.split(/\r?\n/u);
  const occurrences = headingOccurrences(lines, heading);
  if (
    occurrences.length !== 1 ||
    occurrences[0].kind !== "atx" ||
    occurrences[0].line !== heading
  ) {
    fail(code, `${heading} must occur exactly once without indentation.`, {
      occurrences: occurrences.length,
    });
  }
  const start = occurrences[0].index;
  const next = lines.findIndex((_, index) => index > start && isLevelTwoHeading(lines, index));
  return Object.freeze({ lines, start, end: next < 0 ? lines.length : next });
}

function exactTableRow(markdown, heading, definition, code) {
  const range = exactHeadingRange(markdown, heading, code);
  const occurrences = range.lines.flatMap((line, index) =>
    tableRowId(line) === definition.id ? [{ line, index }] : [],
  );
  if (
    occurrences.length !== 1 ||
    occurrences[0].index < range.start ||
    occurrences[0].index >= range.end
  ) {
    fail(code, `${definition.id} must occur once in ${heading}.`, {
      occurrences: occurrences.length,
    });
  }
  const occurrence = occurrences[0];
  if (
    occurrence.line !== occurrence.line.trimStart() ||
    occurrence.index + 1 !== definition.line ||
    sha256(occurrence.line) !== definition.sha256
  ) {
    fail(code, `${definition.id} exact row or location drifted.`, {
      expectedLine: definition.line,
      actualLine: occurrence.index + 1,
    });
  }
  return Object.freeze({
    id: definition.id,
    line: occurrence.index + 1,
    cells: Object.freeze(markdownCells(occurrence.line)),
    sha256: sha256(occurrence.line),
  });
}

function verifyTaskLedger(tasksText) {
  const heading = "## M04 — Framework-neutral runtime core";
  const rows = EXPECTED_TASK_ROWS.map((definition) => {
    const row = exactTableRow(tasksText, heading, definition, "AUDIT_TASK_LEDGER_DRIFT");
    assertEqual(
      row.cells,
      definition.cells,
      "AUDIT_TASK_LEDGER_DRIFT",
      `${definition.id} cells drifted.`,
    );
    return row;
  });
  return Object.freeze({ path: "docs/plan/TASKS.md", heading, rows: Object.freeze(rows) });
}

function verifyNormativeLedger(normativeText) {
  const heading = "## Mandatory clauses";
  const rows = EXPECTED_NORMATIVE_ROWS.map((definition) => {
    const row = exactTableRow(normativeText, heading, definition, "AUDIT_NORMATIVE_LEDGER_DRIFT");
    if (
      row.cells[0] !== definition.id ||
      row.cells[3] !== definition.owners ||
      row.cells[4] !== definition.status
    ) {
      fail("AUDIT_NORMATIVE_LEDGER_DRIFT", `${definition.id} id/owner/status cell drifted.`);
    }
    const dates = [...row.cells[5].matchAll(/\b20\d{2}-\d{2}-\d{2}\b/gu)].map((match) => match[0]);
    const expectedDates = definition.date === undefined ? [] : [definition.date];
    assertEqual(
      dates,
      expectedDates,
      "AUDIT_NORMATIVE_LEDGER_DRIFT",
      `${definition.id} correction date drifted.`,
    );
    return Object.freeze({
      ...row,
      owners: definition.owners,
      status: definition.status,
      correctionDate: definition.date ?? null,
    });
  });
  let compatibility;
  try {
    compatibility = verifyProtocolComponentNormativeCompatibility(normativeText);
  } catch (error) {
    fail("AUDIT_COMPONENT_COMPATIBILITY_DRIFT", "M02-T08 compatibility verification failed.", {
      cause: String(error),
    });
  }
  assertEqual(
    compatibility.historicalProjection,
    HISTORICAL_STATUSES,
    "AUDIT_COMPONENT_COMPATIBILITY_DRIFT",
    "Historical M02-T08 statuses drifted.",
  );
  assertEqual(
    compatibility.currentStatuses,
    CURRENT_STATUSES,
    "AUDIT_COMPONENT_COMPATIBILITY_DRIFT",
    "Current PF-049 statuses drifted.",
  );
  return Object.freeze({
    path: "docs/proof/NORMATIVE-COVERAGE.md",
    heading,
    rows: Object.freeze(rows),
    historicalProjection: HISTORICAL_STATUSES,
    currentStatuses: CURRENT_STATUSES,
    corrections: Object.freeze(["N-026:TESTED->PLANNED", "N-029:TESTED->PLANNED"]),
  });
}

function verifyPf049(findingsText) {
  const range = exactHeadingRange(findingsText, PF049_HEADING, "AUDIT_PF049_DRIFT");
  const headings = range.lines.flatMap((line, index) =>
    /^## PF-\d{3} —/u.test(line) ? [{ line, index }] : [],
  );
  const position = headings.findIndex(({ line }) => line === PF049_HEADING);
  if (
    range.start + 1 !== PF049_LINE ||
    position < 1 ||
    !headings[position - 1].line.startsWith("## PF-048 —")
  ) {
    fail("AUDIT_PF049_DRIFT", "PF-049 moved from its exact reviewed ledger location.");
  }
  const section = range.lines.slice(range.start, range.end).join("\n").trimEnd();
  if (sha256(section) !== PF049_SHA256) {
    fail("AUDIT_PF049_DRIFT", "The exact PF-049 section bytes drifted.");
  }
  for (const anchor of [
    "- Status: OPEN",
    "- Blocks proof: No;",
    "factory-authenticated, finite, exactly-once internal",
    "`N-026: TESTED -> PLANNED`",
    "`N-029: TESTED -> PLANNED`",
    "M05-T02 retains final validation and adapter-delivery ownership for N-026",
    "M05-T03 retains final post-resolution style validation and adapter-delivery ownership for N-029",
  ]) {
    if (!section.includes(anchor)) fail("AUDIT_PF049_DRIFT", `PF-049 anchor is missing: ${anchor}`);
  }
  return Object.freeze({
    path: "docs/plan/PROTOCOL-FINDINGS.md",
    heading: PF049_HEADING,
    line: range.start + 1,
    sha256: sha256(section),
  });
}

async function verifyPrerequisite(definition, injectedBytes, fileOverrides) {
  const bytes = injectedBytes ?? (await readWorkspaceBytes(definition.path, fileOverrides));
  const actual = sha256(bytes);
  if (actual !== definition.sha256) {
    fail("AUDIT_PREREQUISITE_DRIFT", `${definition.task} artifact bytes drifted.`, {
      path: definition.path,
      expectedSha256: definition.sha256,
      actualSha256: actual,
    });
  }
  let artifact;
  try {
    artifact = JSON.parse(Buffer.from(bytes).toString("utf8"));
  } catch (error) {
    fail("AUDIT_PREREQUISITE_DRIFT", `${definition.task} artifact is not valid JSON.`, {
      cause: String(error),
    });
  }
  if (artifact.task !== definition.task || artifact.result !== "PASS") {
    fail("AUDIT_PREREQUISITE_DRIFT", `${definition.task} artifact identity drifted.`);
  }
  if (definition.task === "M02-T08") {
    assertEqual(
      artifact.traceability?.mandatoryClauses,
      HISTORICAL_STATUSES,
      "AUDIT_PREREQUISITE_DRIFT",
      "The immutable M02-T08 normative projection drifted.",
    );
  }
  return Object.freeze({
    task: definition.task,
    path: definition.path,
    sha256: actual,
  });
}

function moduleExportInventory(sourceText, fileName) {
  const parsed = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true);
  const runtime = [];
  const types = [];
  for (const statement of parsed.statements) {
    const exported = statement.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    );
    if (!exported) continue;
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) runtime.push(declaration.name.text);
      }
    } else if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) {
      if (statement.name !== undefined) runtime.push(statement.name.text);
    } else if (
      ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement) ||
      ts.isEnumDeclaration(statement)
    ) {
      types.push(statement.name.text);
    }
  }
  return Object.freeze({ runtime: sorted(runtime), types: sorted(types) });
}

function rootModuleInventory(sourceText, fileName, moduleName) {
  const parsed = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true);
  const runtime = [];
  const types = [];
  for (const statement of parsed.statements) {
    if (
      !ts.isExportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== moduleName
    ) {
      continue;
    }
    if (statement.exportClause === undefined || !ts.isNamedExports(statement.exportClause)) {
      fail("AUDIT_ROOT_EXPORT_DRIFT", `Root exports must be explicit: ${fileName}#${moduleName}.`);
    }
    for (const element of statement.exportClause.elements) {
      if (element.propertyName !== undefined) {
        fail("AUDIT_ROOT_EXPORT_DRIFT", `Aliased root export is forbidden: ${element.name.text}.`);
      }
      (statement.isTypeOnly || element.isTypeOnly ? types : runtime).push(element.name.text);
    }
  }
  return Object.freeze({ runtime: sorted(runtime), types: sorted(types) });
}

function verifyNamedTsdoc(sourceText, fileName, names) {
  const parsed = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true);
  const found = new Set();
  for (const statement of parsed.statements) {
    let declarationNames = [];
    if (ts.isVariableStatement(statement)) {
      declarationNames = statement.declarationList.declarations.flatMap((declaration) =>
        ts.isIdentifier(declaration.name) ? [declaration.name.text] : [],
      );
    } else if (
      (ts.isFunctionDeclaration(statement) ||
        ts.isInterfaceDeclaration(statement) ||
        ts.isTypeAliasDeclaration(statement) ||
        ts.isClassDeclaration(statement)) &&
      statement.name !== undefined
    ) {
      declarationNames = [statement.name.text];
    }
    for (const name of declarationNames.filter((candidate) => names.includes(candidate))) {
      const exported = statement.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
      );
      const leading = sourceText.slice(statement.getFullStart(), statement.getStart(parsed));
      if (!exported || !/\/\*\*[\s\S]*?\*\//u.test(leading)) {
        fail("AUDIT_TSDOC_DRIFT", `Exported declaration lacks TSDoc: ${fileName}#${name}.`);
      }
      found.add(name);
    }
  }
  assertEqual(
    sorted(found),
    sorted(names),
    "AUDIT_TSDOC_DRIFT",
    `${fileName} TSDoc export set drifted.`,
  );
  return found.size;
}

function expectedPublicActionExports() {
  return Object.freeze({
    runtime: sorted(
      ACTION_MODULE_EXPORTS.runtime.filter((name) => !INTERNAL_ACTION_EXPORTS.includes(name)),
    ),
    types: sorted(
      ACTION_MODULE_EXPORTS.types.filter((name) => !INTERNAL_ACTION_EXPORTS.includes(name)),
    ),
  });
}

function verifyRuntimeApi(texts) {
  for (const [fileName, sourceText, expected, javascript = false] of [
    ["packages/runtime-core/src/action-turns.ts", texts.actionSource, ACTION_MODULE_EXPORTS],
    [
      "packages/runtime-core/dist/action-turns.d.ts",
      texts.actionDeclaration,
      ACTION_MODULE_EXPORTS,
    ],
    [
      "packages/runtime-core/dist/action-turns.js",
      texts.actionJavaScript,
      ACTION_MODULE_EXPORTS,
      true,
    ],
    ["packages/runtime-core/src/headless-session.ts", texts.sessionSource, SESSION_MODULE_EXPORTS],
    [
      "packages/runtime-core/dist/headless-session.d.ts",
      texts.sessionDeclaration,
      SESSION_MODULE_EXPORTS,
    ],
    [
      "packages/runtime-core/dist/headless-session.js",
      texts.sessionJavaScript,
      SESSION_MODULE_EXPORTS,
      true,
    ],
  ]) {
    const actual = moduleExportInventory(sourceText, fileName);
    const compared = javascript ? { ...expected, types: [] } : expected;
    assertEqual(
      actual,
      { runtime: sorted(compared.runtime), types: sorted(compared.types) },
      "AUDIT_MODULE_EXPORT_DRIFT",
      `${fileName} exports drifted.`,
    );
  }
  const publicAction = expectedPublicActionExports();
  for (const [fileName, sourceText, javascript = false] of [
    ["packages/runtime-core/src/index.ts", texts.sourceIndex],
    ["packages/runtime-core/dist/index.d.ts", texts.indexDeclaration],
    ["packages/runtime-core/dist/index.js", texts.indexJavaScript, true],
  ]) {
    const action = rootModuleInventory(sourceText, fileName, "./action-turns.js");
    const session = rootModuleInventory(sourceText, fileName, "./headless-session.js");
    assertEqual(
      action,
      javascript ? { runtime: publicAction.runtime, types: [] } : publicAction,
      "AUDIT_ROOT_EXPORT_DRIFT",
      `${fileName} action-turn root exports drifted.`,
    );
    assertEqual(
      session,
      javascript
        ? { runtime: sorted(SESSION_MODULE_EXPORTS.runtime), types: [] }
        : {
            runtime: sorted(SESSION_MODULE_EXPORTS.runtime),
            types: sorted(SESSION_MODULE_EXPORTS.types),
          },
      "AUDIT_ROOT_EXPORT_DRIFT",
      `${fileName} session root exports drifted.`,
    );
    const visible = [...action.runtime, ...action.types, ...session.runtime, ...session.types];
    for (const internal of INTERNAL_ACTION_EXPORTS) {
      if (visible.includes(internal)) {
        fail(
          "AUDIT_INTERNAL_EXPORT_LEAK",
          `Internal T13 seam leaked from package root: ${internal}.`,
        );
      }
    }
  }
  const tsdocDeclarations =
    verifyNamedTsdoc(
      texts.actionSource,
      "packages/runtime-core/src/action-turns.ts",
      INTERNAL_ACTION_EXPORTS,
    ) +
    verifyNamedTsdoc(
      texts.sessionSource,
      "packages/runtime-core/src/headless-session.ts",
      TSDOC_EXPORTS.filter((name) => !INTERNAL_ACTION_EXPORTS.includes(name)),
    );
  return Object.freeze({
    publicRuntimeExports: 2,
    publicTypeExports: 4,
    internalModuleExports: 3,
    tsdocDeclarations,
    maxSubscriptions: 256,
  });
}

async function verifyPlatformBoundary(fileOverrides) {
  const entries = await readdir(path.join(WORKSPACE_ROOT, "packages/runtime-core/src"), {
    withFileTypes: true,
  });
  const actualPaths = sorted(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
      .map((entry) => `packages/runtime-core/src/${entry.name}`),
  );
  assertEqual(
    actualPaths,
    RUNTIME_SOURCE_PATHS,
    "AUDIT_PLATFORM_BOUNDARY_DRIFT",
    "Runtime production source inventory drifted.",
  );
  const modules = new Set();
  const forbiddenIdentifiers = new Set([
    "React",
    "window",
    "document",
    "navigator",
    "HTMLElement",
    "localStorage",
    "sessionStorage",
    "indexedDB",
    "WebSocket",
    "requestAnimationFrame",
  ]);
  for (const relativePath of actualPaths) {
    const sourceText = await readWorkspaceText(relativePath, fileOverrides);
    const parsed = ts.createSourceFile(relativePath, sourceText, ts.ScriptTarget.Latest, true);
    const found = new Set();
    const visit = (node) => {
      if (ts.isIdentifier(node) && forbiddenIdentifiers.has(node.text)) found.add(node.text);
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        found.add("dynamic-import");
      }
      ts.forEachChild(node, visit);
    };
    visit(parsed);
    for (const statement of parsed.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
        continue;
      }
      const specifier = statement.moduleSpecifier.text;
      modules.add(specifier);
      if (
        !(
          (specifier.startsWith("./") && specifier.endsWith(".js")) ||
          specifier === "@desen/protocol" ||
          specifier === "@desen/validator" ||
          specifier === "@desen/validator/schema-contract" ||
          specifier === "@desen/validator/schema-contract-syntax"
        ) ||
        /(?:^|[/@-])(react|react-dom|dom|browser)(?:$|[/@-])/iu.test(specifier)
      ) {
        found.add(`import:${specifier}`);
      }
    }
    if (found.size > 0) {
      fail("AUDIT_PLATFORM_BOUNDARY_DRIFT", `Platform coupling entered ${relativePath}.`, {
        found: sorted(found),
      });
    }
  }
  return Object.freeze({
    productionFiles: actualPaths.length,
    modules: Object.freeze(sorted(modules)),
    reactDomBrowserImports: 0,
  });
}

function verifyRuntimeProbe(probe) {
  const expected = {
    internalModuleObserver: "function",
    internalRootLeaks: [],
    maxSubscriptions: 256,
    publicSessionFunctions: [
      "subscribeRuntimeHeadlessSession",
      "unsubscribeRuntimeHeadlessSession",
    ],
  };
  assertEqual(probe, expected, "AUDIT_RUNTIME_PROBE_DRIFT", "Built runtime export probe drifted.");
  return Object.freeze(expected);
}

async function probeRuntime(runtimeApi, actionTurnsApi) {
  return verifyRuntimeProbe({
    internalModuleObserver: typeof actionTurnsApi.subscribeRuntimeActionTurnSettlements,
    internalRootLeaks: INTERNAL_ACTION_EXPORTS.filter((name) => Object.hasOwn(runtimeApi, name)),
    maxSubscriptions: runtimeApi.RUNTIME_HEADLESS_SESSION_LIMITS?.maxSubscriptions,
    publicSessionFunctions: [
      "subscribeRuntimeHeadlessSession",
      "unsubscribeRuntimeHeadlessSession",
    ].filter((name) => typeof runtimeApi[name] === "function"),
  });
}

async function verifyBytePins(fileOverrides) {
  for (const [relativePath, expected] of Object.entries(REVIEWED_SHA256)) {
    const actual = sha256(await readWorkspaceBytes(relativePath, fileOverrides));
    if (actual !== expected) {
      fail(
        "AUDIT_SOURCE_BYTE_DRIFT",
        `Reviewed runtime source/test bytes drifted: ${relativePath}.`,
        {
          expected,
          actual,
        },
      );
    }
  }
  for (const [relativePath, expected] of Object.entries(TRANSFERRED_SHA256)) {
    const actual = sha256(await readWorkspaceBytes(relativePath, fileOverrides));
    if (actual !== expected) {
      fail(
        "AUDIT_TRANSFERRED_VERIFIER_DRIFT",
        `Transferred compatibility verifier/test bytes drifted: ${relativePath}.`,
        { expected, actual },
      );
    }
  }
}

function rootTestTitles(sourceText) {
  return [...sourceText.matchAll(/\btest\(\s*"([^"]+)"/gu)].map((match) => match[1]);
}

function focusedTestInventory(sourceText, fileName) {
  const parsed = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true);
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
        const table = node.expression.arguments[0];
        if (table === undefined || !ts.isArrayLiteralExpression(table)) {
          fail("AUDIT_FOCUSED_TEST_DRIFT", `Dynamic focused-test table is forbidden: ${fileName}.`);
        }
        registrations += 1;
        cases += table.elements.length;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(parsed);
  return Object.freeze({ registrations, cases });
}

function verifyTestAndScripts({ actionTests, sessionTests, typeTests, rootTests, manifestText }) {
  const manifest = JSON.parse(manifestText);
  const common =
    "pnpm --filter @desen/runtime-core... build && pnpm --filter @desen/runtime-core typecheck && pnpm --filter @desen/runtime-core test:action-turns && pnpm --filter @desen/runtime-core test:headless-sign-in";
  const expectedScripts = {
    "generate:runtime-core-audit-hardening": `${common} && node scripts/generate-runtime-core-audit-hardening-proof.mjs`,
    "verify:runtime-core-audit-hardening": `${common} && node scripts/verify-runtime-core-audit-hardening.mjs`,
    "test:runtime-core-audit-hardening": `${common} && node --test tests/runtime-core-audit-hardening.test.mjs`,
  };
  for (const [name, command] of Object.entries(expectedScripts)) {
    if (manifest.scripts?.[name] !== command) {
      fail("AUDIT_COMMAND_WIRING_DRIFT", `Root package script drifted: ${name}.`);
    }
  }
  assertEqual(
    rootTestTitles(rootTests),
    ROOT_TEST_TITLES,
    "AUDIT_ROOT_TEST_DRIFT",
    "M04-T17 hostile root-test inventory drifted.",
  );
  const actionInventory = focusedTestInventory(actionTests, "action-turns.test.ts");
  const sessionInventory = focusedTestInventory(sessionTests, "headless-session.test.ts");
  const focusedRegistrations = actionInventory.registrations + sessionInventory.registrations;
  const focusedTests = actionInventory.cases + sessionInventory.cases;
  const compilerNegativeCases = (typeTests.match(/@ts-expect-error/gu) ?? []).length;
  if (focusedRegistrations !== 69 || focusedTests !== 77 || compilerNegativeCases !== 14) {
    fail("AUDIT_FOCUSED_TEST_DRIFT", "Focused runtime/type-test inventory drifted.", {
      focusedRegistrations,
      focusedTests,
      compilerNegativeCases,
    });
  }
  for (const title of [
    "delivers two same-tick operation completions as two ordered internal notices",
    "delivers both mixed-kind completions in their observed same-tick order",
    "provides a reentrancy-safe snapshot-store subscription with terminal fan-out",
    "publishes a generic recursively nested operation settlement without polling",
    "terminally disposes the complete session after an injected T13 resource publication fault",
  ]) {
    if (!actionTests.includes(title) && !sessionTests.includes(title)) {
      fail("AUDIT_FOCUSED_TEST_DRIFT", `Required fault-injection test is missing: ${title}.`);
    }
  }
  return Object.freeze({
    focusedRegistrations,
    focusedTests,
    compilerNegativeCases,
    rootMutationTests: ROOT_TEST_TITLES.length,
    scripts: Object.freeze(Object.keys(expectedScripts)),
  });
}

function parseArtifactReference(markdown, heading, allowPending, allowMissingSection = false) {
  const lines = markdown.split(/\r?\n/u);
  const artifactLine = `\`${ARTIFACT_RELATIVE_PATH}\``;
  const shaPattern = /^sha256:([0-9a-f]{64}|\[PENDING_FINAL_ARTIFACT_SHA256\])$/u;
  const sectionHeadings = headingOccurrences(lines, heading);
  if (sectionHeadings.length === 0 && allowMissingSection && allowPending) {
    if (
      lines.some((line) => standaloneCodeSpanValue(line, "") === ARTIFACT_RELATIVE_PATH) ||
      lines.some(
        (line) =>
          line.includes(ARTIFACT_FILE_NAME) &&
          (line.includes("sha256:") || shaPattern.test(standaloneCodeSpanValue(line, ".") ?? "")),
      )
    ) {
      fail("AUDIT_ARTIFACT_REFERENCE_DRIFT", "Pending Proof Matrix references are misplaced.");
    }
    return Object.freeze({ sha256: PENDING_ARTIFACT_SHA256, normalizedText: markdown });
  }
  if (
    sectionHeadings.length !== 1 ||
    sectionHeadings[0].kind !== "atx" ||
    sectionHeadings[0].line !== heading
  ) {
    fail(
      "AUDIT_ARTIFACT_REFERENCE_DRIFT",
      `${heading} must occur exactly once without indentation.`,
    );
  }
  const start = sectionHeadings[0].index;
  const next = lines.findIndex((_, index) => index > start && isLevelTwoHeading(lines, index));
  const end = next < 0 ? lines.length : next;
  const artifactOccurrences = lines.flatMap((line, index) =>
    standaloneCodeSpanValue(line, "") === ARTIFACT_RELATIVE_PATH ? [{ index, line }] : [],
  );
  const sectionArtifactOccurrences = artifactOccurrences.filter(
    ({ index }) => index > start && index < end,
  );
  const shaMatches = lines.flatMap((line, index) => {
    const value = standaloneCodeSpanValue(line, ".");
    const match = value?.match(shaPattern) ?? null;
    return match === null ? [] : [{ index, line, value: match[1] }];
  });
  const sectionShaMatches = shaMatches.filter(({ index }) => index > start && index < end);
  if (
    artifactOccurrences.length !== 1 ||
    artifactOccurrences[0].line !== artifactLine ||
    sectionArtifactOccurrences.length !== 1 ||
    sectionShaMatches.length !== 1 ||
    sectionShaMatches[0].line !== `\`sha256:${sectionShaMatches[0].value}\`.` ||
    sectionShaMatches[0].index !== sectionArtifactOccurrences[0].index + 1 ||
    lines.filter(
      (line) => standaloneCodeSpanValue(line, ".") === `sha256:${sectionShaMatches[0].value}`,
    ).length !== 1
  ) {
    fail(
      "AUDIT_ARTIFACT_REFERENCE_DRIFT",
      `${heading} must contain one unique adjacent path/SHA field.`,
    );
  }
  const value = sectionShaMatches[0].value;
  if (!allowPending && value === PENDING_ARTIFACT_SHA256) {
    fail("AUDIT_ARTIFACT_REFERENCE_DRIFT", "Production verification rejects pending SHA fields.");
  }
  const normalized = [...lines];
  normalized[sectionShaMatches[0].index] = "`sha256:[NORMALIZED_ARTIFACT_SHA256]`.";
  return Object.freeze({ sha256: value, normalizedText: normalized.join("\n") });
}

function verifyDocumentation(proofText, proofMatrixText, allowPending) {
  for (const anchor of [
    "subscribeRuntimeActionTurnSettlements",
    "subscribeRuntimeHeadlessSession",
    "unsubscribeRuntimeHeadlessSession",
    "N-026 `PLANNED`, N-028 `TESTED`, and N-029 `PLANNED`",
    "M05-T02 for N-026 and M05-T03 for N-029",
    "no React, DOM, or browser module",
  ]) {
    if (!proofText.includes(anchor)) {
      fail("AUDIT_DOCUMENTATION_DRIFT", `M04-T17 proof anchor is missing: ${anchor}.`);
    }
  }
  const proof = parseArtifactReference(proofText, "## Evidence artifact", allowPending);
  const matrix = parseArtifactReference(
    proofMatrixText,
    "## M04-T17 / G04 audit hardening",
    allowPending,
    true,
  );
  return Object.freeze({
    normalizedProofDocumentSha256: sha256(proof.normalizedText),
    proofReferenceSha256: proof.sha256,
    matrixReferenceSha256: matrix.sha256,
  });
}

async function trackedFiles(fileOverrides) {
  return Object.freeze(
    await Promise.all(
      TRACKED_PATHS.map(async (relativePath) => {
        const bytes = await readWorkspaceBytes(relativePath, fileOverrides);
        return Object.freeze({ path: relativePath, bytes: bytes.length, sha256: sha256(bytes) });
      }),
    ),
  );
}

/**
 * Builds deterministic M04-T17 evidence in memory.
 *
 * @remarks `allowPendingArtifactReference` is a generator-only staging seam. Production
 * verification rejects it and requires both exact final SHA locations.
 */
export async function buildRuntimeCoreAuditHardeningEvidence(options = undefined) {
  const normalized = normalizeOptions(options);
  const fileOverrides = normalized.fileOverrides;
  const prerequisiteBytes = normalized.prerequisiteBytes ?? {};
  const [
    prerequisites,
    tasksText,
    normativeText,
    findingsText,
    proofText,
    proofMatrixText,
    actionSource,
    sessionSource,
    sourceIndex,
    actionDeclaration,
    actionJavaScript,
    sessionDeclaration,
    sessionJavaScript,
    indexDeclaration,
    indexJavaScript,
    actionTests,
    sessionTests,
    typeTests,
    rootTests,
    manifestText,
    tracked,
    platformBoundary,
  ] = await Promise.all([
    Promise.all(
      PREREQUISITES.map((definition) =>
        verifyPrerequisite(definition, prerequisiteBytes[definition.key], fileOverrides),
      ),
    ),
    readWorkspaceText("docs/plan/TASKS.md", fileOverrides),
    readWorkspaceText("docs/proof/NORMATIVE-COVERAGE.md", fileOverrides),
    readWorkspaceText("docs/plan/PROTOCOL-FINDINGS.md", fileOverrides),
    readWorkspaceText(PROOF_DOCUMENT_PATH, fileOverrides),
    readWorkspaceText(PROOF_MATRIX_PATH, fileOverrides),
    readWorkspaceText("packages/runtime-core/src/action-turns.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/src/headless-session.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/src/index.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/action-turns.d.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/action-turns.js", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/headless-session.d.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/headless-session.js", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/index.d.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/index.js", fileOverrides),
    readWorkspaceText("packages/runtime-core/test/action-turns.test.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/test/headless-session.test.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/test/headless-session.types.ts", fileOverrides),
    readWorkspaceText("tests/runtime-core-audit-hardening.test.mjs", fileOverrides),
    readWorkspaceText("package.json", fileOverrides),
    trackedFiles(fileOverrides),
    verifyPlatformBoundary(fileOverrides),
  ]);
  await verifyBytePins(fileOverrides);
  const taskLedger = verifyTaskLedger(tasksText);
  const normativeMigration = verifyNormativeLedger(normativeText);
  const finding = verifyPf049(findingsText);
  const publicApi = verifyRuntimeApi({
    actionSource,
    sessionSource,
    sourceIndex,
    actionDeclaration,
    actionJavaScript,
    sessionDeclaration,
    sessionJavaScript,
    indexDeclaration,
    indexJavaScript,
  });
  const tests = verifyTestAndScripts({
    actionTests,
    sessionTests,
    typeTests,
    rootTests,
    manifestText,
  });
  const documentation = verifyDocumentation(
    proofText,
    proofMatrixText,
    normalized.allowPendingArtifactReference === true,
  );
  const [runtimeApi, actionTurnsApi] = await Promise.all([
    normalized.runtimeApi ?? import(RUNTIME_API_URL.href),
    normalized.actionTurnsApi ?? import(ACTION_TURNS_API_URL.href),
  ]);
  const runtimeProbe = verifyRuntimeProbe(
    normalized.runtimeProbe ?? (await probeRuntime(runtimeApi, actionTurnsApi)),
  );
  const artifact = Object.freeze({
    schemaVersion: 1,
    task: "M04-T17",
    gate: "G04",
    result: "PASS",
    profile: "desen-runtime-core-audit-hardening-v1",
    claim: Object.freeze({
      summary:
        "Factory-authenticated settlement completion drives generic bounded headless-session publication while exact-location migration evidence preserves immutable historical artifacts.",
      taskStatus: "DONE",
      gateStatus: "DONE",
    }),
    prerequisites: Object.freeze(prerequisites),
    runtime: Object.freeze({
      publicApi,
      probe: runtimeProbe,
      platformBoundary,
      settlementNotification:
        "finite pre-reserved FIFO; exactly once after finalization; no same-tick coalescing loss",
    }),
    migration: Object.freeze({
      taskLedger,
      normative: normativeMigration,
      finding,
      transferredOwnership: Object.freeze(
        Object.entries(TRANSFERRED_SHA256).map(([filePath, digest]) =>
          Object.freeze({ ownerTask: "M04-T17", path: filePath, sha256: digest }),
        ),
      ),
    }),
    evidence: Object.freeze({
      tests,
      trackedFiles: tracked,
      normalizedProofDocumentSha256: documentation.normalizedProofDocumentSha256,
      finalArtifactReferences:
        "normalized outside artifact bytes; exact proof and Proof Matrix sections are verified separately",
    }),
    deferred: Object.freeze([
      "N-026 receiving prop-schema validation and adapter delivery remain M05-T02.",
      "N-029 post-resolution style-schema validation and adapter delivery remain M05-T03.",
      "React, DOM, accessibility, focus, and concrete framework reconciliation remain M05.",
    ]),
  });
  const artifactText = await format(JSON.stringify(artifact), {
    parser: "json",
    endOfLine: "lf",
    printWidth: 100,
    tabWidth: 2,
  });
  const artifactBytes = Buffer.from(artifactText);
  return Object.freeze({ artifact, artifactBytes, artifactSha256: sha256(artifactBytes) });
}

function rejectProductionInjection(buildOptions) {
  const normalized = normalizeOptions(buildOptions);
  if (
    normalized.allowPendingArtifactReference === true ||
    Object.hasOwn(normalized, "runtimeApi") ||
    Object.hasOwn(normalized, "actionTurnsApi") ||
    Object.hasOwn(normalized, "runtimeProbe")
  ) {
    fail(
      "AUDIT_OPTIONS_INVALID",
      "Production verification rejects pending references and injected runtime APIs/probes.",
    );
  }
}

async function readArtifactBytes(artifactPath) {
  let entry;
  try {
    entry = await lstat(artifactPath);
  } catch (error) {
    fail("AUDIT_ARTIFACT_MISSING", "M04-T17 artifact is missing.", { cause: String(error) });
  }
  if (!entry.isFile() || entry.isSymbolicLink()) {
    fail("AUDIT_ARTIFACT_UNSAFE", "M04-T17 artifact must be a regular non-symlink file.");
  }
  return readFile(artifactPath);
}

async function verifyFinalReferences(artifactSha256, buildOptions) {
  const fileOverrides = normalizeOptions(buildOptions).fileOverrides;
  const [proofText, proofMatrixText] = await Promise.all([
    readWorkspaceText(PROOF_DOCUMENT_PATH, fileOverrides),
    readWorkspaceText(PROOF_MATRIX_PATH, fileOverrides),
  ]);
  const proof = parseArtifactReference(proofText, "## Evidence artifact", false);
  const matrix = parseArtifactReference(proofMatrixText, "## M04-T17 / G04 audit hardening", false);
  if (proof.sha256 !== artifactSha256 || matrix.sha256 !== artifactSha256) {
    fail(
      "AUDIT_ARTIFACT_REFERENCE_DRIFT",
      "Both exact labeled sections must pin the tracked M04-T17 artifact SHA-256.",
    );
  }
}

/** Atomically writes deterministic M04-T17 evidence without requiring final circular SHA pins. */
export async function writeRuntimeCoreAuditHardeningEvidence(options = undefined) {
  const normalized = normalizeOptions(options);
  const artifactPath =
    normalized.artifactPath ?? DEFAULT_RUNTIME_CORE_AUDIT_HARDENING_ARTIFACT_PATH;
  const buildOptions = {
    ...normalizeOptions(normalized.buildOptions),
    allowPendingArtifactReference: true,
  };
  const evidence =
    normalized.preparedEvidence ?? (await buildRuntimeCoreAuditHardeningEvidence(buildOptions));
  try {
    await writeAtomicProofArtifact({
      artifactPath,
      artifactBytes: evidence.artifactBytes,
      beforeAtomicRename: normalized.beforeAtomicRename,
    });
  } catch (error) {
    fail("AUDIT_ARTIFACT_UNSAFE", "Atomic M04-T17 artifact write failed safely.", {
      cause: String(error),
    });
  }
  return Object.freeze({
    result: "PASS",
    artifactPath: path.resolve(artifactPath),
    artifactSha256: evidence.artifactSha256,
    trackedFiles: evidence.artifact.evidence.trackedFiles.length,
  });
}

/** Rebuilds and byte-compares final M04-T17 evidence without accepting injected runtime state. */
export async function verifyRuntimeCoreAuditHardeningEvidence(options = undefined) {
  const normalized = normalizeOptions(options);
  rejectProductionInjection(normalized.buildOptions);
  const artifactPath =
    normalized.artifactPath ?? DEFAULT_RUNTIME_CORE_AUDIT_HARDENING_ARTIFACT_PATH;
  const expected = await buildRuntimeCoreAuditHardeningEvidence(normalized.buildOptions);
  await verifyFinalReferences(expected.artifactSha256, normalized.buildOptions);
  const actual = normalized.artifactBytes ?? (await readArtifactBytes(artifactPath));
  if (!Buffer.from(actual).equals(expected.artifactBytes)) {
    fail("AUDIT_ARTIFACT_DRIFT", "Tracked M04-T17 artifact differs from fresh evidence.", {
      expectedSha256: expected.artifactSha256,
      actualSha256: sha256(actual),
    });
  }
  return Object.freeze({
    result: "PASS",
    artifactSha256: expected.artifactSha256,
    trackedFiles: expected.artifact.evidence.trackedFiles.length,
    rootMutationTests: expected.artifact.evidence.tests.rootMutationTests,
    focusedTests: expected.artifact.evidence.tests.focusedTests,
    compilerNegativeCases: expected.artifact.evidence.tests.compilerNegativeCases,
    publicRuntimeExports: expected.artifact.runtime.publicApi.publicRuntimeExports,
    publicTypeExports: expected.artifact.runtime.publicApi.publicTypeExports,
    internalModuleExports: expected.artifact.runtime.publicApi.internalModuleExports,
    normativeCorrections: expected.artifact.migration.normative.corrections.length,
  });
}
