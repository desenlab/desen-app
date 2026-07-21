import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  EXPECTED_PROTOCOL_SNAPSHOT,
  verifyProtocolSnapshot,
} from "./protocol-snapshot-integrity.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");

/** Absolute path to the canonical M02-T02 traceability ledger. */
export const DEFAULT_TRACEABILITY_LEDGER_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/protocol-0.1.0-traceability.json",
);

/** Absolute path to the deterministic M02-T02 evidence artifact. */
export const DEFAULT_TRACEABILITY_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/artifacts/protocol-0.1.0-traceability.json",
);

const DEFAULT_SPEC_PATH = path.join(
  WORKSPACE_ROOT,
  "packages/protocol/upstream/0.1.0/snapshot/SPEC.md",
);
const DEFAULT_SCHEMA_DIRECTORY = path.join(
  WORKSPACE_ROOT,
  "packages/protocol/upstream/0.1.0/snapshot/schemas",
);
const DEFAULT_TASKS_PATH = path.join(WORKSPACE_ROOT, "docs/plan/TASKS.md");
const DEFAULT_BCP14_LEDGER_PATH = path.join(WORKSPACE_ROOT, "docs/proof/NORMATIVE-COVERAGE.md");

const CONSTRAINT_KEYWORDS = new Map([
  ["$ref", "reference"],
  ["additionalProperties", "applicator"],
  ["allOf", "applicator"],
  ["anyOf", "applicator"],
  ["const", "assertion"],
  ["contains", "applicator"],
  ["dependentRequired", "assertion"],
  ["dependentSchemas", "applicator"],
  ["else", "applicator"],
  ["enum", "assertion"],
  ["exclusiveMaximum", "assertion"],
  ["exclusiveMinimum", "assertion"],
  ["if", "applicator"],
  ["items", "applicator"],
  ["maxContains", "assertion"],
  ["maxItems", "assertion"],
  ["maxLength", "assertion"],
  ["maxProperties", "assertion"],
  ["maximum", "assertion"],
  ["minContains", "assertion"],
  ["minItems", "assertion"],
  ["minLength", "assertion"],
  ["minProperties", "assertion"],
  ["minimum", "assertion"],
  ["multipleOf", "assertion"],
  ["not", "applicator"],
  ["oneOf", "applicator"],
  ["pattern", "assertion"],
  ["patternProperties", "applicator"],
  ["prefixItems", "applicator"],
  ["properties", "applicator"],
  ["propertyNames", "applicator"],
  ["required", "assertion"],
  ["then", "applicator"],
  ["type", "assertion"],
  ["unevaluatedItems", "applicator"],
  ["unevaluatedProperties", "applicator"],
  ["uniqueItems", "assertion"],
]);

const SUBSCHEMA_MAP_KEYWORDS = new Set([
  "$defs",
  "dependentSchemas",
  "patternProperties",
  "properties",
]);
const SUBSCHEMA_ARRAY_KEYWORDS = new Set(["allOf", "anyOf", "oneOf", "prefixItems"]);
const SUBSCHEMA_SINGLE_KEYWORDS = new Set([
  "additionalProperties",
  "contains",
  "else",
  "if",
  "items",
  "not",
  "propertyNames",
  "then",
  "unevaluatedItems",
  "unevaluatedProperties",
]);

const NON_CONSTRAINT_KEYWORDS = new Set([
  "$anchor",
  "$comment",
  "$defs",
  "$dynamicAnchor",
  "$dynamicRef",
  "$id",
  "$schema",
  "$vocabulary",
  "contentEncoding",
  "contentMediaType",
  "contentSchema",
  "default",
  "deprecated",
  "description",
  "examples",
  "format",
  "readOnly",
  "title",
  "writeOnly",
]);

const BCP14_MARKER =
  /\*\*(?:MUST(?: NOT)?|SHOULD(?: NOT)?|REQUIRED|SHALL(?: NOT)?|RECOMMENDED|NOT RECOMMENDED|MAY|OPTIONAL)\*\*/;
const TRACE_COLLECTIONS = [
  "conformanceRules",
  "pipelineSteps",
  "proseRules",
  "invariants",
  "diagnostics",
  "schemaRegistry",
];

/** Error raised when the frozen protocol trace no longer satisfies its completeness contract. */
export class ProtocolTraceabilityError extends Error {
  /**
   * @param {string} code Stable internal verification code.
   * @param {string} message Human-readable failure description.
   * @param {Record<string, unknown>} [details] Structured diagnostic details.
   */
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ProtocolTraceabilityError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProtocolTraceabilityError(code, message, details);
}

function escapePointerSegment(segment) {
  return segment.replaceAll("~", "~0").replaceAll("/", "~1");
}

function decodePointerSegment(segment) {
  return segment.replaceAll("~1", "/").replaceAll("~0", "~");
}

function pointerFromSegments(segments) {
  return `/${segments.map(escapePointerSegment).join("/")}`;
}

function resolveJsonPointer(document, pointer) {
  if (pointer === "") return document;
  if (!pointer.startsWith("/")) return undefined;
  let value = document;
  for (const rawSegment of pointer.slice(1).split("/")) {
    const segment = decodePointerSegment(rawSegment);
    if (value === null || typeof value !== "object" || !(segment in value)) return undefined;
    value = value[segment];
  }
  return value;
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function walkSchema(schema, schemaFile, segments, inventory, nonConstraints) {
  if (typeof schema === "boolean") {
    // The parent applicator keyword is the constraint occurrence; recursing into
    // its boolean value would count the same assertion twice.
    return;
  }
  if (schema === null || typeof schema !== "object" || Array.isArray(schema)) {
    fail("TRACE_SCHEMA_NODE_INVALID", "A schema position is not an object or boolean schema.", {
      schema: schemaFile,
      pointer: pointerFromSegments(segments),
    });
  }

  for (const [keyword, value] of Object.entries(schema)) {
    const keywordSegments = [...segments, keyword];
    const pointer = pointerFromSegments(keywordSegments);
    const classification = CONSTRAINT_KEYWORDS.get(keyword);
    if (classification !== undefined) {
      inventory.push({ schema: schemaFile, pointer, keyword, classification });
    } else if (NON_CONSTRAINT_KEYWORDS.has(keyword)) {
      nonConstraints.push({ schema: schemaFile, pointer, keyword });
    } else {
      fail(
        "TRACE_SCHEMA_KEYWORD_UNKNOWN",
        "A schema keyword has no explicit traceability policy.",
        {
          schema: schemaFile,
          pointer,
          keyword,
        },
      );
    }

    if (SUBSCHEMA_MAP_KEYWORDS.has(keyword)) {
      if (value === null || typeof value !== "object" || Array.isArray(value)) {
        fail("TRACE_SCHEMA_CONTAINER_INVALID", "A schema map keyword has an invalid value.", {
          schema: schemaFile,
          pointer,
        });
      }
      for (const [name, childSchema] of Object.entries(value)) {
        walkSchema(childSchema, schemaFile, [...keywordSegments, name], inventory, nonConstraints);
      }
    } else if (SUBSCHEMA_ARRAY_KEYWORDS.has(keyword)) {
      if (!Array.isArray(value)) {
        fail("TRACE_SCHEMA_CONTAINER_INVALID", "A schema array keyword has an invalid value.", {
          schema: schemaFile,
          pointer,
        });
      }
      value.forEach((childSchema, index) =>
        walkSchema(
          childSchema,
          schemaFile,
          [...keywordSegments, String(index)],
          inventory,
          nonConstraints,
        ),
      );
    } else if (
      SUBSCHEMA_SINGLE_KEYWORDS.has(keyword) &&
      (typeof value === "boolean" || (value !== null && typeof value === "object"))
    ) {
      walkSchema(value, schemaFile, keywordSegments, inventory, nonConstraints);
    }
  }
}

async function discoverSchemaInventory(schemaDirectory) {
  const schemaFiles = (await readdir(schemaDirectory))
    .filter((fileName) => fileName.endsWith(".schema.json"))
    .sort();
  const schemas = new Map();
  const constraints = [];
  const nonConstraints = [];

  for (const schemaFile of schemaFiles) {
    const schema = JSON.parse(await readFile(path.join(schemaDirectory, schemaFile), "utf8"));
    schemas.set(schemaFile, schema);
    walkSchema(schema, schemaFile, [], constraints, nonConstraints);
  }

  constraints.sort((left, right) =>
    `${left.schema}#${left.pointer}`.localeCompare(`${right.schema}#${right.pointer}`),
  );
  nonConstraints.sort((left, right) =>
    `${left.schema}#${left.pointer}`.localeCompare(`${right.schema}#${right.pointer}`),
  );
  return { constraints, nonConstraints, schemas };
}

function parseTaskIds(tasksText) {
  return new Set(
    [...tasksText.matchAll(/\|\s*((?:M\d{2}-T\d{2})|G\d{2})\s*\|/g)].map((match) => match[1]),
  );
}

function parseBcp14Ids(ledgerText) {
  const records = new Map();
  const rowPattern = /\|\s*([NS]-\d{3})\s*\|[^\n]*?#L(\d+)\)/g;
  for (const match of ledgerText.matchAll(rowPattern)) records.set(match[1], Number(match[2]));
  return records;
}

function parseNormativeSections(specLines) {
  const allHeadings = [];
  for (let index = 0; index < specLines.length; index += 1) {
    const text = specLines[index];
    const numbered = text.match(
      /^(#{2,4})\s+((?:[1-9]|[12]\d|3[0-4])(?:\.\d+(?:\.\d+)?)?)\.?(?:\s|$)/,
    );
    const appendix = text.match(/^#\s+Appendix\s+([A-D])\s+[—-]/);
    if (numbered) {
      allHeadings.push({ key: numbered[2], level: numbered[1].length, line: index + 1 });
    } else if (appendix) {
      allHeadings.push({ key: `Appendix ${appendix[1]}`, level: 1, line: index + 1 });
    }
  }

  for (let index = 0; index < allHeadings.length; index += 1) {
    const heading = allHeadings[index];
    const nextHeading = allHeadings
      .slice(index + 1)
      .find((candidate) => candidate.level <= heading.level);
    heading.endLine = nextHeading === undefined ? specLines.length : nextHeading.line - 1;
  }

  const normativeHeadings = allHeadings.filter((heading) => {
    if (heading.key.startsWith("Appendix ")) return /^Appendix [ABC]$/.test(heading.key);
    const sectionNumber = Number(heading.key.split(".")[0]);
    return sectionNumber >= 3 && sectionNumber <= 31;
  });
  return new Map(normativeHeadings.map((heading) => [heading.key, heading]));
}

function validateTasks(taskIds, values, field, id) {
  if (!Array.isArray(values) || values.length === 0) {
    fail("TRACE_TASK_PLAN_MISSING", "A trace entry has no owning or evidence task.", { id, field });
  }
  for (const taskId of values) {
    if (!taskIds.has(taskId)) {
      fail("TRACE_TASK_UNKNOWN", "A trace entry refers to an unknown task ID.", {
        id,
        field,
        taskId,
      });
    }
    if (taskId === "M02-T02") {
      fail(
        "TRACE_SELF_OWNERSHIP",
        "M02-T02 may route rules but may not own their implementation.",
        {
          id,
          field,
        },
      );
    }
  }
}

function validateUniqueIds(records, code) {
  const seenIds = new Set();
  for (const record of records) {
    if (typeof record.id !== "string" || record.id === "") {
      fail("TRACE_ENTRY_INVALID", "A traceability record is missing its ID.", { record });
    }
    if (seenIds.has(record.id)) {
      fail(code, "A traceability record ID is duplicated.", { id: record.id });
    }
    seenIds.add(record.id);
  }
}

function validateTraceEntry(entry, context) {
  const { bcp14Records, sections, specLines, taskIds } = context;
  if (typeof entry.id !== "string" || typeof entry.summary !== "string" || entry.summary === "") {
    fail("TRACE_ENTRY_INVALID", "A prose trace entry is missing its ID or summary.", { entry });
  }
  if (!Number.isInteger(entry.line) || !Number.isInteger(entry.endLine ?? entry.line)) {
    fail("TRACE_ANCHOR_INVALID", "A prose trace entry has an invalid line range.", {
      id: entry.id,
    });
  }
  const endLine = entry.endLine ?? entry.line;
  if (entry.line < 1 || endLine < entry.line || endLine > specLines.length) {
    fail("TRACE_ANCHOR_INVALID", "A prose trace line range is outside SPEC.md.", { id: entry.id });
  }
  const section = sections.get(entry.section);
  if (section === undefined || entry.line < section.line || endLine > section.endLine) {
    fail("TRACE_SECTION_MISMATCH", "A prose anchor is not inside its declared normative section.", {
      id: entry.id,
      section: entry.section,
    });
  }
  const excerpt = specLines.slice(entry.line - 1, endLine).join("\n");
  if (typeof entry.anchor !== "string" || !excerpt.includes(entry.anchor)) {
    fail("TRACE_ANCHOR_MISMATCH", "A prose anchor no longer matches the frozen SPEC text.", {
      id: entry.id,
      line: entry.line,
    });
  }
  validateTasks(taskIds, entry.owners, "owners", entry.id);
  validateTasks(taskIds, entry.tests, "tests", entry.id);
  if (typeof entry.evidence !== "string" || entry.evidence === "") {
    fail("TRACE_EVIDENCE_MISSING", "A trace entry has no future evidence assertion.", {
      id: entry.id,
    });
  }
  if (
    entry.status === "JUSTIFIED_NA" &&
    (typeof entry.rationale !== "string" || entry.rationale === "")
  ) {
    fail("TRACE_RATIONALE_MISSING", "A justified exclusion has no rationale.", { id: entry.id });
  }
  const bcpIds = entry.bcp14 ?? [];
  if (BCP14_MARKER.test(excerpt) && bcpIds.length === 0) {
    fail(
      "TRACE_BCP14_RELATION_MISSING",
      "A prose entry overlaps a BCP 14 line without cross-linking it.",
      {
        id: entry.id,
      },
    );
  }
  for (const bcpId of bcpIds) {
    const bcpLine = bcp14Records.get(bcpId);
    if (bcpLine === undefined) {
      fail("TRACE_BCP14_UNKNOWN", "A prose entry cross-links an unknown BCP 14 item.", {
        id: entry.id,
        bcpId,
      });
    }
    if (bcpLine < entry.line || bcpLine > endLine) {
      fail(
        "TRACE_BCP14_LINE_MISMATCH",
        "A BCP 14 cross-link does not share the prose source range.",
        {
          id: entry.id,
          bcpId,
        },
      );
    }
  }
}

function selectorMatches(constraint, selector) {
  if (constraint.schema !== selector.schema) return false;
  if (selector.kind === "ROOT") return constraint.pointer.split("/").length === 2;
  return constraint.pointer.startsWith(`${selector.prefix}/`);
}

function countBy(records, selector) {
  const counts = {};
  for (const record of records) {
    const key = selector(record);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function assertExactCounts(actual, expected, code, label) {
  if (stableJson(actual) !== stableJson(expected)) {
    fail(code, `${label} differs from the pinned traceability inventory.`, { expected, actual });
  }
}

function validateSchemaFamilies(ledger, inventory, taskIds) {
  const families = ledger.schemaFamilies;
  if (!Array.isArray(families) || families.length === 0) {
    fail("TRACE_SCHEMA_FAMILIES_MISSING", "The schema constraint family ledger is empty.");
  }
  validateUniqueIds(families, "TRACE_SCHEMA_FAMILY_ID_DUPLICATE");
  validateTasks(taskIds, ledger.schemaRoute.owners, "schemaRoute.owners", "schemaRoute");
  validateTasks(taskIds, ledger.schemaRoute.tests, "schemaRoute.tests", "schemaRoute");

  const assigned = new Map();
  for (const family of families) {
    if (!Array.isArray(family.selectors) || family.selectors.length === 0) {
      fail("TRACE_SCHEMA_SELECTOR_MISSING", "A schema family has no selector.", { id: family.id });
    }
    validateTasks(taskIds, family.semanticOwners, "semanticOwners", family.id);
    let familyCount = 0;
    const familyPointers = [];
    for (const constraint of inventory.constraints) {
      if (family.selectors.some((selector) => selectorMatches(constraint, selector))) {
        familyCount += 1;
        familyPointers.push(`${constraint.schema}#${constraint.pointer}`);
        const key = `${constraint.schema}#${constraint.pointer}`;
        const previous = assigned.get(key);
        if (previous !== undefined) {
          fail(
            "TRACE_SCHEMA_DUPLICATE",
            "A schema constraint is assigned to more than one family.",
            {
              constraint: key,
              families: [previous, family.id],
            },
          );
        }
        assigned.set(key, family.id);
      }
    }
    if (familyCount === 0) {
      fail("TRACE_SCHEMA_FAMILY_EMPTY", "A schema family selector covers no constraints.", {
        id: family.id,
      });
    }
    if (familyCount !== family.expectedConstraints) {
      fail("TRACE_SCHEMA_FAMILY_COUNT", "A schema family count differs from its reviewed value.", {
        id: family.id,
        expected: family.expectedConstraints,
        actual: familyCount,
        pointers: familyPointers,
      });
    }
  }

  const unassigned = inventory.constraints.filter(
    (constraint) => !assigned.has(`${constraint.schema}#${constraint.pointer}`),
  );
  if (unassigned.length > 0) {
    fail("TRACE_SCHEMA_UNCOVERED", "One or more schema constraints have no owning family.", {
      unassigned: unassigned.slice(0, 20),
      total: unassigned.length,
    });
  }
  return assigned;
}

function validateInternalReferences(inventory) {
  for (const reference of inventory.constraints.filter((record) => record.keyword === "$ref")) {
    const schema = inventory.schemas.get(reference.schema);
    const value = resolveJsonPointer(schema, reference.pointer);
    if (typeof value !== "string" || !value.startsWith("#/")) {
      fail(
        "TRACE_SCHEMA_REF_EXTERNAL",
        "The frozen schemas contain an unreviewed non-local $ref.",
        {
          schema: reference.schema,
          pointer: reference.pointer,
          value,
        },
      );
    }
    if (resolveJsonPointer(schema, value.slice(1)) === undefined) {
      fail("TRACE_SCHEMA_REF_UNRESOLVED", "A local schema $ref target does not exist.", {
        schema: reference.schema,
        pointer: reference.pointer,
        value,
      });
    }
  }
}

function validateSharedDefinitions(inventory, ledger) {
  const source = inventory.schemas.get("desen-source.schema.json");
  const bundle = inventory.schemas.get("desen-bundle.schema.json");
  for (const definitionName of ledger.sharedSourceBundleDefinitions) {
    const sourceDefinition = source?.$defs?.[definitionName];
    const bundleDefinition = bundle?.$defs?.[definitionName];
    if (sourceDefinition === undefined || bundleDefinition === undefined) {
      fail(
        "TRACE_SHARED_DEFINITION_MISSING",
        "A declared shared source/bundle definition is absent.",
        {
          definitionName,
        },
      );
    }
    if (stableJson(sourceDefinition) !== stableJson(bundleDefinition)) {
      fail(
        "TRACE_SHARED_DEFINITION_DRIFT",
        "A combined source/bundle schema family is no longer equal.",
        {
          definitionName,
        },
      );
    }
  }
}

function validateNonConstraints(ledger, inventory, taskIds) {
  const decisions = ledger.schemaNonConstraintDecisions;
  validateUniqueIds(decisions, "TRACE_SCHEMA_DECISION_ID_DUPLICATE");
  const decisionKeywords = new Set();
  for (const decision of decisions) {
    if (decisionKeywords.has(decision.keyword)) {
      fail(
        "TRACE_SCHEMA_DECISION_DUPLICATE",
        "A non-constraint schema keyword has duplicate policy.",
        {
          keyword: decision.keyword,
        },
      );
    }
    decisionKeywords.add(decision.keyword);
    if (decision.status === "JUSTIFIED_NA" && !decision.rationale) {
      fail("TRACE_RATIONALE_MISSING", "A schema annotation exclusion has no rationale.", {
        id: decision.id,
      });
    }
    validateTasks(taskIds, decision.owners, "owners", decision.id);
    validateTasks(taskIds, decision.tests, "tests", decision.id);
  }
  const actual = countBy(inventory.nonConstraints, (record) => record.keyword);
  const expected = Object.fromEntries(
    decisions.map((decision) => [decision.keyword, decision.expectedOccurrences]),
  );
  assertExactCounts(
    actual,
    expected,
    "TRACE_SCHEMA_NON_CONSTRAINT_COUNT",
    "Schema annotation/control inventory",
  );
}

function buildEvidence(ledger, ledgerSha256, inventory, sectionCount, traceEntries) {
  const constraintsByClass = countBy(inventory.constraints, (record) => record.classification);
  const diagnostics = ledger.diagnostics.length;
  return {
    schemaVersion: 1,
    claim:
      "M02-T02 protocol traceability inventory is complete for the frozen DESEN 0.1.0 review scope",
    result: "PASS",
    protocol: EXPECTED_PROTOCOL_SNAPSHOT.protocol,
    sourceCommit: EXPECTED_PROTOCOL_SNAPSHOT.sourceCommit,
    sourceTree: EXPECTED_PROTOCOL_SNAPSHOT.sourceTree,
    ledger: "docs/proof/protocol-0.1.0-traceability.json",
    ledgerSha256,
    counts: {
      normativeSectionsReviewed: sectionCount,
      proseTraceEntries: traceEntries.length,
      conformanceRules: ledger.conformanceRules.length,
      pipelineSteps: ledger.pipelineSteps.length,
      normativeProseGroups: ledger.proseRules.length,
      appendixInvariants: ledger.invariants.length,
      diagnosticCodes: diagnostics,
      schemaRegistryEntries: ledger.schemaRegistry.length,
      explicitExclusions: ledger.explicitExclusions.length,
      schemaFamilies: ledger.schemaFamilies.length,
      schemaConstraints: inventory.constraints.length,
      schemaAssertions: constraintsByClass.assertion ?? 0,
      schemaApplicators: constraintsByClass.applicator ?? 0,
      schemaReferences: constraintsByClass.reference ?? 0,
      schemaNonConstraintKeywords: inventory.nonConstraints.length,
    },
    coverage: {
      reviewedNormativeSectionsPercent: 100,
      assignedProseEntriesPercent: 100,
      assignedSchemaConstraintsPercent: 100,
      missingSchemaConstraints: 0,
      duplicateSchemaAssignments: 0,
      unresolvedLocalSchemaReferences: 0,
    },
    limitations: [
      "This artifact proves reviewed scope and future owner/test assignment, not validator or runtime conformance.",
      "Natural-language completeness is a human section-by-section review backed by frozen line anchors; schema constraint completeness is machine-enumerated.",
      "Informative material and conditional features excluded by the ledger remain outside the current Web-React proof claim.",
    ],
    verificationCommand: "pnpm verify:protocol-traceability",
  };
}

/**
 * Loads the canonical machine-readable DESEN 0.1.0 traceability ledger.
 *
 * @param {string} [ledgerPath] Absolute ledger path.
 * @returns {Promise<{ledger: Record<string, any>, raw: string}>} Parsed ledger and exact bytes.
 */
export async function loadProtocolTraceabilityLedger(
  ledgerPath = DEFAULT_TRACEABILITY_LEDGER_PATH,
) {
  const raw = await readFile(ledgerPath, "utf8");
  return { ledger: JSON.parse(raw), raw };
}

/**
 * Verifies prose anchors, task routing, normative-section review, and complete JSON Schema coverage.
 *
 * @param {object} [options] Verification overrides used by negative tests.
 * @param {Record<string, any>} [options.ledger] In-memory ledger override.
 * @param {string} [options.ledgerRaw] Exact serialized ledger used for hashing.
 * @param {boolean} [options.verifySnapshot] Whether to enforce the frozen upstream snapshot first.
 * @param {boolean} [options.verifyArtifact] Whether to compare the deterministic evidence artifact.
 * @returns {Promise<{evidence: Record<string, any>, inventory: Record<string, any>}>} Verified evidence and inventory.
 */
export async function verifyProtocolTraceability(options = {}) {
  const verifySnapshotFirst = options.verifySnapshot ?? true;
  if (verifySnapshotFirst) await verifyProtocolSnapshot();

  const loaded =
    options.ledger === undefined
      ? await loadProtocolTraceabilityLedger()
      : {
          ledger: options.ledger,
          raw: options.ledgerRaw ?? `${JSON.stringify(options.ledger, null, 2)}\n`,
        };
  const ledger = loaded.ledger;
  if (
    ledger.protocol?.sourceCommit !== EXPECTED_PROTOCOL_SNAPSHOT.sourceCommit ||
    ledger.protocol?.sourceTree !== EXPECTED_PROTOCOL_SNAPSHOT.sourceTree
  ) {
    fail(
      "TRACE_PROTOCOL_BASELINE_MISMATCH",
      "The trace ledger does not target the frozen snapshot.",
    );
  }

  const [specText, tasksText, bcp14Text, inventory] = await Promise.all([
    readFile(DEFAULT_SPEC_PATH, "utf8"),
    readFile(DEFAULT_TASKS_PATH, "utf8"),
    readFile(DEFAULT_BCP14_LEDGER_PATH, "utf8"),
    discoverSchemaInventory(DEFAULT_SCHEMA_DIRECTORY),
  ]);
  const specLines = specText.split(/\r?\n/);
  const taskIds = parseTaskIds(tasksText);
  const bcp14Records = parseBcp14Ids(bcp14Text);
  const sections = parseNormativeSections(specLines);

  const traceEntries = TRACE_COLLECTIONS.flatMap((collection) => ledger[collection] ?? []);
  validateUniqueIds(traceEntries, "TRACE_ID_DUPLICATE");
  for (const entry of traceEntries) {
    validateTraceEntry(entry, { bcp14Records, sections, specLines, taskIds });
  }

  const reviewedSections = new Set(traceEntries.map((entry) => entry.section));
  for (const review of ledger.sectionDispositions) {
    if (!sections.has(review.section)) {
      fail("TRACE_SECTION_UNKNOWN", "A section disposition refers to a non-normative heading.", {
        section: review.section,
      });
    }
    if (reviewedSections.has(review.section)) {
      fail(
        "TRACE_SECTION_DUPLICATE_REVIEW",
        "A normative section has both entries and an empty disposition.",
        {
          section: review.section,
        },
      );
    }
    if (!review.rationale) {
      fail("TRACE_RATIONALE_MISSING", "A section disposition has no review rationale.", {
        section: review.section,
      });
    }
    for (const bcpId of review.bcp14 ?? []) {
      const bcpLine = bcp14Records.get(bcpId);
      if (bcpLine === undefined) {
        fail("TRACE_BCP14_UNKNOWN", "A section disposition links an unknown BCP 14 entry.", {
          section: review.section,
          bcpId,
        });
      }
      const section = sections.get(review.section);
      if (bcpLine < section.line || bcpLine > section.endLine) {
        fail(
          "TRACE_BCP14_LINE_MISMATCH",
          "A section disposition cross-links a BCP 14 item from another section.",
          { section: review.section, bcpId, bcpLine },
        );
      }
    }
    reviewedSections.add(review.section);
  }
  const missingSections = [...sections.keys()].filter((section) => !reviewedSections.has(section));
  if (missingSections.length > 0) {
    fail(
      "TRACE_SECTION_UNREVIEWED",
      "One or more normative SPEC sections have no review disposition.",
      {
        missingSections,
      },
    );
  }

  if (!Array.isArray(ledger.explicitExclusions) || ledger.explicitExclusions.length !== 8) {
    fail(
      "TRACE_EXCLUSION_SET_INVALID",
      "The informative/excluded source-range review must contain eight decisions.",
    );
  }
  validateUniqueIds(ledger.explicitExclusions, "TRACE_EXCLUSION_ID_DUPLICATE");
  for (const exclusion of ledger.explicitExclusions) {
    if (!exclusion.rationale) {
      fail("TRACE_RATIONALE_MISSING", "An explicit source exclusion has no rationale.", {
        id: exclusion.id,
      });
    }
  }

  validateInternalReferences(inventory);
  validateSharedDefinitions(inventory, ledger);
  validateNonConstraints(ledger, inventory, taskIds);
  validateSchemaFamilies(ledger, inventory, taskIds);

  assertExactCounts(
    countBy(inventory.constraints, (record) => record.schema),
    ledger.expectedSchemaInventory.byFile,
    "TRACE_SCHEMA_FILE_COUNT",
    "Per-file schema constraint inventory",
  );
  assertExactCounts(
    countBy(inventory.constraints, (record) => record.keyword),
    ledger.expectedSchemaInventory.byKeyword,
    "TRACE_SCHEMA_KEYWORD_COUNT",
    "Per-keyword schema constraint inventory",
  );
  if (inventory.constraints.length !== ledger.expectedSchemaInventory.totalConstraints) {
    fail(
      "TRACE_SCHEMA_TOTAL_COUNT",
      "The total schema constraint count differs from the reviewed inventory.",
      {
        expected: ledger.expectedSchemaInventory.totalConstraints,
        actual: inventory.constraints.length,
      },
    );
  }

  const evidence = buildEvidence(
    ledger,
    sha256(loaded.raw),
    inventory,
    sections.size,
    traceEntries,
  );
  if (options.verifyArtifact ?? true) {
    const artifact = JSON.parse(await readFile(DEFAULT_TRACEABILITY_ARTIFACT_PATH, "utf8"));
    if (stableJson(artifact) !== stableJson(evidence)) {
      fail("TRACE_ARTIFACT_MISMATCH", "The stored traceability artifact is stale.", {
        expected: evidence,
        actual: artifact,
      });
    }
  }
  return { evidence, inventory };
}
