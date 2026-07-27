import { createHash, randomBytes } from "node:crypto";
import { lstat, open, readFile, realpath, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { format } from "prettier";

import { runValidatorDiagnosticMicroVectorSuite } from "../../packages/validator/test/diagnostic-micro-vector-suite.ts";
import {
  DEFAULT_PROTOCOL_BINDING_CONTRACTS_ARTIFACT_PATH,
  verifyProtocolBindingContracts,
} from "./protocol-binding-contracts-proof.mjs";
import {
  DEFAULT_PROTOCOL_COMPONENT_CONTRACTS_ARTIFACT_PATH,
  verifyProtocolComponentContracts,
} from "./protocol-component-contracts-proof.mjs";
import {
  DEFAULT_PROTOCOL_EXECUTION_CONTRACTS_ARTIFACT_PATH,
  verifyProtocolExecutionContracts,
} from "./protocol-execution-contracts-proof.mjs";
import {
  DEFAULT_PROTOCOL_INTERACTION_CONTRACTS_ARTIFACT_PATH,
  verifyProtocolInteractionContracts,
} from "./protocol-interaction-contracts-proof.mjs";
import {
  DEFAULT_PROTOCOL_OFFICIAL_SUITE_PARITY_ARTIFACT_PATH,
  verifyProtocolOfficialSuiteParity,
} from "./protocol-official-suite-parity-proof.mjs";
import {
  DEFAULT_SNAPSHOT_ROOT,
  EXPECTED_PROTOCOL_SNAPSHOT,
  verifyProtocolSnapshot,
} from "./protocol-snapshot-integrity.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const PROTOCOL_API_URL = new URL("../../packages/protocol/dist/index.js", import.meta.url);
const VALIDATOR_API_URL = new URL("../../packages/validator/dist/index.js", import.meta.url);

/** Absolute path to the deterministic M02-T13 evidence artifact. */
export const DEFAULT_PROTOCOL_VALIDATOR_DIAGNOSTIC_MICRO_VECTORS_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/artifacts/protocol-0.1.0-validator-diagnostic-micro-vectors.json",
);
const HISTORICAL_ARTIFACT_SHA256 =
  "3214a26a683d46a3b20c6ca400de44faa2c5e394f706a6e3e8d3d3628da78718";

/** Reviewed trace ledger used to derive the exact validator diagnostic scope. */
export const DEFAULT_PROTOCOL_VALIDATOR_DIAGNOSTIC_MICRO_VECTORS_TRACE_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/protocol-0.1.0-traceability.json",
);

const EXPECTED_CORE_TRACE_IDS = Object.freeze([
  ...Array.from({ length: 25 }, (_, index) => `D-${String(index + 1).padStart(3, "0")}`),
  "D-027",
  "D-028",
  "D-034",
]);
const EXPECTED_LATER_CORE_CODES = Object.freeze([
  "OPERATION_DENIED",
  "ACTION_LIMIT_EXCEEDED",
  "REVISION_MISMATCH",
  "SOURCE_DIGEST_MISMATCH",
  "CATALOG_DIGEST_MISMATCH",
  "CATALOG_VERSION_UNAVAILABLE",
  "BUNDLE_LIMIT_EXCEEDED",
  "ADAPTER_FAILURE",
]);
const EXPECTED_EXTENSION_EXPORTS = Object.freeze({
  INVALID_SEMVER_CODE: "run.desen.validator/INVALID_SEMVER",
  CATALOG_REQUIREMENT_MISMATCH_CODE: "run.desen.validator/CATALOG_REQUIREMENT_MISMATCH",
  INVALID_COMPONENT_CONTRACT_CODE: "run.desen.validator/INVALID_COMPONENT_CONTRACT",
  INVALID_INTERACTION_CONTRACT_CODE: "run.desen.validator/INVALID_INTERACTION_CONTRACT",
  INVALID_BINDING_CONTRACT_CODE: "run.desen.validator/INVALID_BINDING_CONTRACT",
  INVALID_EXECUTION_CONTRACT_CODE: "run.desen.validator/INVALID_EXECUTION_CONTRACT",
});
const EXPECTED_TRACE_IDS = Object.freeze({
  proseRules: Object.freeze([
    "R-014",
    "R-015",
    "R-016",
    "R-017",
    "R-023",
    "R-025",
    "R-026",
    "R-032",
    "R-038",
    "R-039",
    "R-042",
    "R-044",
    "R-045",
    "R-047",
    "R-049",
    "R-051",
    "R-052",
    "R-054",
    "R-055",
    "R-057",
    "R-058",
    "R-060",
    "R-061",
    "R-062",
    "R-064",
    "R-069",
    "R-070",
    "R-071",
    "R-073",
    "R-074",
    "R-075",
    "R-076",
    "R-077",
    "R-079",
    "R-080",
    "R-083",
    "R-085",
    "R-101",
    "R-110",
    "R-111",
    "R-120",
    "R-123",
    "R-138",
    "R-145",
    "R-147",
    "R-148",
  ]),
  schemaNonConstraintDecisions: Object.freeze(["SN-001", "SN-002", "SN-005"]),
  conformanceRules: Object.freeze(["C-003", "C-024"]),
  invariants: Object.freeze(["A-005", "A-011"]),
});
const ALL_VECTORS = Object.freeze(["*"]);
const TRACE_VECTOR_MAP = Object.freeze({
  "R-014": ["schema-invalid", "duplicate-surface-id", "duplicate-node-id"],
  "R-015": ["unknown-capability", "ambiguous-capability"],
  "R-016": ["unsupported-protocol", "invalid-semver"],
  "R-017": ["catalog-requirement-mismatch"],
  "R-023": ["unknown-core-field"],
  "R-025": [
    "schema-invalid",
    "invalid-component-contract",
    "invalid-interaction-contract",
    "invalid-binding-contract",
    "invalid-execution-contract",
  ],
  "R-026": ["reference-unresolved"],
  "R-032": ["schema-invalid"],
  "R-038": ["schema-invalid", "reference-unresolved", "repeat-items-invalid"],
  "R-039": ["reference-unresolved"],
  "R-042": ["reference-unresolved", "resource-output-invalid"],
  "R-044": ["unknown-event", "event-payload-invalid", "reference-unresolved"],
  "R-045": ["invalid-binding-contract", "repeat-key-invalid"],
  "R-047": ["reference-unresolved", "predicate-type-mismatch"],
  "R-049": ["invalid-binding-contract"],
  "R-051": ["predicate-type-mismatch"],
  "R-052": ["predicate-type-mismatch"],
  "R-054": ["invalid-binding-contract"],
  "R-055": ["resource-input-invalid"],
  "R-057": ["prop-type-mismatch"],
  "R-058": ["unknown-slot", "slot-cardinality", "slot-child-rejected"],
  "R-060": ["prop-type-mismatch"],
  "R-061": ["repeat-items-invalid", "repeat-key-invalid", "invalid-binding-contract"],
  "R-062": ["unknown-event", "event-payload-invalid"],
  "R-064": ["unknown-prop", "prop-type-mismatch"],
  "R-069": ["duplicate-node-id"],
  "R-070": ["behavior-attachment-invalid"],
  "R-071": ["behavior-conflict"],
  "R-073": ["schema-invalid"],
  "R-074": ["state-write-invalid"],
  "R-075": ["state-write-invalid"],
  "R-076": ["entry-not-found"],
  "R-077": ["operation-input-invalid", "operation-output-invalid"],
  "R-079": ["reference-unresolved", "resource-input-invalid"],
  "R-080": ["unknown-command", "command-input-invalid"],
  "R-083": ["ambiguous-capability"],
  "R-085": ["slot-child-rejected"],
  "R-101": ["duplicate-node-id", "unknown-prop", "state-write-invalid"],
  "R-110": ALL_VECTORS,
  "R-111": ALL_VECTORS,
  "R-120": [
    "unknown-prop",
    "unknown-event",
    "event-payload-invalid",
    "unknown-command",
    "state-write-invalid",
  ],
  "R-123": [
    "event-payload-invalid",
    "repeat-items-invalid",
    "predicate-type-mismatch",
    "operation-output-invalid",
    "invalid-component-contract",
    "invalid-interaction-contract",
    "invalid-binding-contract",
    "invalid-execution-contract",
  ],
  "R-138": ["unsupported-protocol"],
  "R-145": ALL_VECTORS,
  "R-147": ["unknown-capability"],
  "R-148": ["unknown-prop", "prop-type-mismatch"],
  "SN-001": ["schema-invalid"],
  "SN-002": ["schema-invalid"],
  "SN-005": ["prop-type-mismatch", "state-write-invalid", "operation-input-invalid"],
  "C-003": ["invalid-semver", "catalog-requirement-mismatch"],
  "C-024": ALL_VECTORS,
  "A-005": ["unknown-prop", "unknown-slot", "unknown-event", "unknown-command"],
  "A-011": [
    "event-payload-invalid",
    "command-input-invalid",
    "state-write-invalid",
    "operation-input-invalid",
    "operation-output-invalid",
    "resource-input-invalid",
    "resource-output-invalid",
  ],
});
const FIXED_TRACKED_PATHS = Object.freeze([
  "packages/validator/test/diagnostic-micro-vector-suite.ts",
  "packages/validator/test/diagnostic-micro-vectors.test.ts",
  "docs/proof/PROTOCOL-VALIDATOR-DIAGNOSTIC-MICRO-VECTORS.md",
  "docs/proof/protocol-0.1.0-traceability.json",
  "scripts/lib/protocol-validator-diagnostic-micro-vectors-proof.mjs",
  "scripts/generate-protocol-validator-diagnostic-micro-vectors-proof.mjs",
  "scripts/verify-protocol-validator-diagnostic-micro-vectors.mjs",
  "tests/protocol-validator-diagnostic-micro-vectors.test.mjs",
]);
const PREREQUISITE_SPECS = Object.freeze([
  Object.freeze({
    task: "M02-T08",
    profile: "desen-component-contract-validation-v1",
    defaultPath: DEFAULT_PROTOCOL_COMPONENT_CONTRACTS_ARTIFACT_PATH,
    verify: verifyProtocolComponentContracts,
  }),
  Object.freeze({
    task: "M02-T09",
    profile: "desen-interaction-contract-validation-v1",
    defaultPath: DEFAULT_PROTOCOL_INTERACTION_CONTRACTS_ARTIFACT_PATH,
    verify: verifyProtocolInteractionContracts,
  }),
  Object.freeze({
    task: "M02-T10",
    profile: "desen-binding-contract-validation-v1",
    defaultPath: DEFAULT_PROTOCOL_BINDING_CONTRACTS_ARTIFACT_PATH,
    verify: verifyProtocolBindingContracts,
  }),
  Object.freeze({
    task: "M02-T11",
    profile: "desen-execution-contract-validation-v1",
    defaultPath: DEFAULT_PROTOCOL_EXECUTION_CONTRACTS_ARTIFACT_PATH,
    verify: verifyProtocolExecutionContracts,
  }),
  Object.freeze({
    task: "M02-T12",
    profile: "desen-official-suite-parity-v1",
    defaultPath: DEFAULT_PROTOCOL_OFFICIAL_SUITE_PARITY_ARTIFACT_PATH,
    verify: verifyProtocolOfficialSuiteParity,
  }),
]);

/** Stable failure raised when deterministic M02-T13 evidence cannot be established. */
export class ProtocolValidatorDiagnosticMicroVectorsEvidenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "ProtocolValidatorDiagnosticMicroVectorsEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new ProtocolValidatorDiagnosticMicroVectorsEvidenceError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function authenticateHistoricalArtifact(artifactPath, suppliedBytes) {
  let bytes;
  if (suppliedBytes === undefined) {
    let entry;
    try {
      entry = await lstat(artifactPath);
    } catch (error) {
      fail("DIAGNOSTIC_VECTOR_ARTIFACT_DRIFT", "Immutable M02-T13 evidence is missing.", {
        cause: String(error),
      });
    }
    if (!entry.isFile() || entry.isSymbolicLink()) {
      fail(
        "DIAGNOSTIC_VECTOR_ARTIFACT_UNSUPPORTED_ENTRY",
        "Immutable M02-T13 evidence must be a regular non-symlink file.",
      );
    }
    bytes = await readFile(artifactPath);
  } else {
    bytes = Buffer.from(suppliedBytes);
  }
  const actualSha256 = sha256(bytes);
  if (actualSha256 !== HISTORICAL_ARTIFACT_SHA256) {
    fail(
      "DIAGNOSTIC_VECTOR_ARTIFACT_DRIFT",
      "Immutable task-time M02-T13 evidence bytes changed.",
      {
        expectedSha256: HISTORICAL_ARTIFACT_SHA256,
        actualSha256,
      },
    );
  }

  let artifact;
  try {
    artifact = JSON.parse(bytes.toString("utf8"));
  } catch {
    fail("DIAGNOSTIC_VECTOR_ARTIFACT_DRIFT", "Immutable M02-T13 evidence is not valid JSON.");
  }
  const traceResponsibilities = Object.values(
    artifact.declaredValidatorScope?.traceability?.responsibilities ?? {},
  ).flat().length;
  if (
    artifact.schemaVersion !== 1 ||
    artifact.task !== "M02-T13" ||
    artifact.result !== "PASS" ||
    artifact.profile !== "desen-validator-diagnostic-micro-vectors-v1" ||
    artifact.protocolVersion !== "0.1.0" ||
    artifact.microVectors?.summary?.diagnosticCodes !== 34 ||
    artifact.microVectors?.summary?.core !== 28 ||
    artifact.microVectors?.summary?.extensions !== 6 ||
    artifact.microVectors?.summary?.positiveVectors !== 34 ||
    artifact.microVectors?.summary?.negativeVectors !== 34 ||
    artifact.microVectors?.summary?.passingPairs !== 34 ||
    artifact.microVectors?.summary?.pass !== true ||
    traceResponsibilities !== 53 ||
    artifact.declaredValidatorScope?.traceability?.schemaRoute?.schemaFamilies !== 61 ||
    artifact.declaredValidatorScope?.traceability?.schemaRoute?.schemaConstraints !== 989
  ) {
    fail(
      "DIAGNOSTIC_VECTOR_ARTIFACT_DRIFT",
      "Immutable M02-T13 evidence no longer has its reviewed identity, inventory, or semantics.",
    );
  }
  return Object.freeze({
    artifact,
    artifactBytes: Buffer.from(bytes),
    artifactSha256: HISTORICAL_ARTIFACT_SHA256,
  });
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function assertJsonEqual(actual, expected, label, code = "DIAGNOSTIC_VECTOR_CONTRACT_DRIFT") {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(code, `${label} changed.`, { expected, actual });
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function loadPublicApis() {
  const cacheKey = `${String(Date.now())}-${randomBytes(4).toString("hex")}`;
  const [protocolApi, validatorApi] = await Promise.all([
    import(`${PROTOCOL_API_URL.href}?proof=${cacheKey}`),
    import(`${VALIDATOR_API_URL.href}?proof=${cacheKey}`),
  ]);
  return { protocolApi, validatorApi };
}

function verifyPublicApis(protocolApi, validatorApi) {
  if (!Array.isArray(protocolApi?.CORE_DIAGNOSTIC_REGISTRY)) {
    fail("DIAGNOSTIC_VECTOR_PUBLIC_API_DRIFT", "The built core diagnostic registry is missing.");
  }
  const usedValidatorFunctions = [
    "validateDesenExecutionCatalogSet",
    "validateDesenSourceExecutionContracts",
    "validateDesenEventPayload",
    "validateDesenExecutionValue",
  ];
  for (const name of usedValidatorFunctions) {
    if (typeof validatorApi?.[name] !== "function") {
      fail("DIAGNOSTIC_VECTOR_PUBLIC_API_DRIFT", `The built validator API is missing ${name}.`);
    }
  }
  for (const [name, value] of Object.entries(EXPECTED_EXTENSION_EXPORTS)) {
    if (validatorApi?.[name] !== value) {
      fail("DIAGNOSTIC_VECTOR_PUBLIC_API_DRIFT", `${name} changed.`, {
        expected: value,
        actual: validatorApi?.[name],
      });
    }
  }
  const eventLimits = validatorApi.EVENT_PAYLOAD_SAFETY_LIMITS;
  const executionLimits = validatorApi.EXECUTION_VALUE_SAFETY_LIMITS;
  assertJsonEqual(
    eventLimits,
    { maxDepth: 128, maxJsonNodes: 4096, maxStringCodeUnits: 1_048_576 },
    "EVENT_PAYLOAD_SAFETY_LIMITS",
    "DIAGNOSTIC_VECTOR_LIMIT_DRIFT",
  );
  assertJsonEqual(
    executionLimits,
    eventLimits,
    "EXECUTION_VALUE_SAFETY_LIMITS",
    "DIAGNOSTIC_VECTOR_LIMIT_DRIFT",
  );
  return Object.freeze({
    protocol: Object.freeze(["CORE_DIAGNOSTIC_REGISTRY"]),
    validator: Object.freeze(usedValidatorFunctions),
    extensionConstants: EXPECTED_EXTENSION_EXPORTS,
    finiteResolvedJsonLimits: Object.freeze({ ...eventLimits }),
  });
}

async function verifyCommandWiring() {
  const [root, validatorPackage, turbo] = await Promise.all([
    readJson(path.join(WORKSPACE_ROOT, "package.json")),
    readJson(path.join(WORKSPACE_ROOT, "packages/validator/package.json")),
    readJson(path.join(WORKSPACE_ROOT, "turbo.json")),
  ]);
  const expected = {
    "generate:protocol-validator-diagnostic-micro-vectors":
      "pnpm --filter @desen/validator... build && node scripts/generate-protocol-validator-diagnostic-micro-vectors-proof.mjs",
    "verify:protocol-validator-diagnostic-micro-vectors":
      "pnpm --filter @desen/validator... build && node scripts/verify-protocol-validator-diagnostic-micro-vectors.mjs",
    "test:protocol-validator-diagnostic-micro-vectors":
      "pnpm --filter @desen/validator... build && pnpm --filter @desen/validator test:diagnostic-micro-vectors && node --test tests/protocol-validator-diagnostic-micro-vectors.test.mjs",
  };
  for (const [name, command] of Object.entries(expected)) {
    if (root.scripts?.[name] !== command) {
      fail("DIAGNOSTIC_VECTOR_COMMAND_WIRING_DRIFT", `${name} wiring changed.`, {
        expected: command,
        actual: root.scripts?.[name],
      });
    }
  }
  for (const [scriptName, required] of [
    ["test", "pnpm test:protocol-validator-diagnostic-micro-vectors"],
    ["check", "pnpm verify:protocol-validator-diagnostic-micro-vectors"],
  ]) {
    if (!root.scripts?.[scriptName]?.includes(required)) {
      fail("DIAGNOSTIC_VECTOR_COMMAND_WIRING_DRIFT", `${scriptName} omits ${required}.`);
    }
  }
  if (
    validatorPackage.scripts?.["test:diagnostic-micro-vectors"] !==
    "vitest run test/diagnostic-micro-vectors.test.ts"
  ) {
    fail("DIAGNOSTIC_VECTOR_COMMAND_WIRING_DRIFT", "The validator focused test command changed.");
  }
  const requiredTurboInputs = [
    "../../scripts/lib/protocol-validator-diagnostic-micro-vectors-proof.mjs",
    "../../tests/protocol-validator-diagnostic-micro-vectors.test.mjs",
  ];
  for (const task of ["test", "test:coverage"]) {
    for (const input of requiredTurboInputs) {
      if (!turbo.tasks?.[task]?.inputs?.includes(input)) {
        fail("DIAGNOSTIC_VECTOR_COMMAND_WIRING_DRIFT", `${task} omits ${input}.`);
      }
    }
  }
  return Object.freeze({
    root: Object.freeze(expected),
    package: Object.freeze({
      "test:diagnostic-micro-vectors": "vitest run test/diagnostic-micro-vectors.test.ts",
    }),
  });
}

function idsAssignedToTask(entries, task) {
  return entries
    .filter(({ owners = [], tests = [] }) => owners.includes(task) || tests.includes(task))
    .map(({ id }) => id);
}

function laterTasks(entry) {
  return [...new Set([...(entry.owners ?? []), ...(entry.tests ?? [])])]
    .filter((task) => task !== "M02-T13" && !/^M0[012]-/u.test(task))
    .sort(compareText);
}

function expandVectorIds(ids, allVectorIds) {
  return ids.length === 1 && ids[0] === "*" ? allVectorIds : ids;
}

function traceResponsibilityRecords(trace, section, expectedIds, allVectorIds) {
  const actualIds = idsAssignedToTask(trace[section], "M02-T13");
  assertJsonEqual(
    actualIds,
    expectedIds,
    `${section} M02-T13 responsibilities`,
    "DIAGNOSTIC_VECTOR_TRACE_DRIFT",
  );
  return Object.freeze(
    actualIds.map((id) => {
      const entry = trace[section].find((candidate) => candidate.id === id);
      const mapped = TRACE_VECTOR_MAP[id];
      if (entry === undefined || mapped === undefined) {
        fail("DIAGNOSTIC_VECTOR_TRACE_DRIFT", `${id} has no reviewed vector mapping.`);
      }
      const vectorIds = expandVectorIds(mapped, allVectorIds);
      for (const vectorId of vectorIds) {
        if (!allVectorIds.includes(vectorId)) {
          fail("DIAGNOSTIC_VECTOR_TRACE_DRIFT", `${id} maps to unknown vector ${vectorId}.`);
        }
      }
      const remaining = laterTasks(entry);
      return Object.freeze({
        id,
        vectorIds: Object.freeze([...vectorIds]),
        status: remaining.length === 0 ? "covered-now" : "shared-later",
        remainingTasks: Object.freeze(remaining),
      });
    }),
  );
}

async function verifyTraceability(tracePath, transcript, protocolApi) {
  const trace = await readJson(tracePath);
  const allVectorIds = transcript.cases.map(({ id }) => id);
  if (new Set(allVectorIds).size !== allVectorIds.length) {
    fail("DIAGNOSTIC_VECTOR_SUITE_DRIFT", "Diagnostic vector IDs are not unique.");
  }

  const diagnosticEntries = trace.diagnostics.filter(({ tests = [] }) => tests.includes("M02-T13"));
  assertJsonEqual(
    diagnosticEntries.map(({ id }) => id),
    EXPECTED_CORE_TRACE_IDS,
    "core diagnostic trace scope",
    "DIAGNOSTIC_VECTOR_TRACE_DRIFT",
  );
  const coreCases = transcript.cases.filter(({ scope }) => scope === "core");
  assertJsonEqual(
    coreCases.map(({ traceId }) => traceId),
    EXPECTED_CORE_TRACE_IDS,
    "core vector trace IDs",
    "DIAGNOSTIC_VECTOR_SUITE_DRIFT",
  );
  assertJsonEqual(
    diagnosticEntries.map(({ anchor }) => anchor),
    coreCases.map(({ expected }) => expected.code),
    "core diagnostic code order",
    "DIAGNOSTIC_VECTOR_TRACE_DRIFT",
  );

  const registry = protocolApi.CORE_DIAGNOSTIC_REGISTRY;
  if (registry.length !== 36) {
    fail("DIAGNOSTIC_VECTOR_REGISTRY_DRIFT", "The core registry no longer has 36 entries.");
  }
  for (const vector of coreCases) {
    const definition = registry.find(({ code }) => code === vector.expected.code);
    if (definition === undefined || definition.classification !== vector.expected.classification) {
      fail(
        "DIAGNOSTIC_VECTOR_REGISTRY_DRIFT",
        `${vector.expected.code} disagrees with the core registry.`,
      );
    }
  }
  const laterCore = registry
    .filter(({ code }) => !coreCases.some(({ expected }) => expected.code === code))
    .map(({ code }) => code);
  assertJsonEqual(
    laterCore,
    EXPECTED_LATER_CORE_CODES,
    "later-owner core diagnostic scope",
    "DIAGNOSTIC_VECTOR_REGISTRY_DRIFT",
  );
  assertJsonEqual(
    transcript.excludedCoreDiagnostics,
    EXPECTED_LATER_CORE_CODES,
    "micro-vector excluded core diagnostics",
    "DIAGNOSTIC_VECTOR_SUITE_DRIFT",
  );

  if (!trace.schemaRoute?.tests?.includes("M02-T13")) {
    fail("DIAGNOSTIC_VECTOR_TRACE_DRIFT", "The global schema route lost M02-T13.");
  }
  const schemaFamilies = trace.schemaFamilies.length;
  const schemaConstraints = trace.schemaFamilies.reduce(
    (sum, family) => sum + family.expectedConstraints,
    0,
  );
  if (schemaFamilies !== 61 || schemaConstraints !== 989) {
    fail("DIAGNOSTIC_VECTOR_TRACE_DRIFT", "The declared schema route changed.", {
      schemaFamilies,
      schemaConstraints,
    });
  }

  const responsibilities = {};
  for (const [section, expectedIds] of Object.entries(EXPECTED_TRACE_IDS)) {
    responsibilities[section] = traceResponsibilityRecords(
      trace,
      section,
      expectedIds,
      allVectorIds,
    );
  }
  return Object.freeze({
    path: path.relative(WORKSPACE_ROOT, tracePath),
    schemaRoute: Object.freeze({
      schemaFamilies,
      schemaConstraints,
      evidence:
        "verified T08-T12 artifacts plus positive/negative vectors for every emitted validator diagnostic",
    }),
    diagnostics: Object.freeze(
      diagnosticEntries.map((entry, index) =>
        Object.freeze({ id: entry.id, code: entry.anchor, vectorId: coreCases[index].id }),
      ),
    ),
    responsibilities: Object.freeze(responsibilities),
  });
}

async function verifyPrerequisite(spec, artifactPath) {
  let verification;
  try {
    verification = await spec.verify({ artifactPath });
  } catch (error) {
    fail("DIAGNOSTIC_VECTOR_PREREQUISITE_DRIFT", `${spec.task} verification failed.`, {
      task: spec.task,
      predecessorCode: typeof error?.code === "string" ? error.code : "UNEXPECTED_ERROR",
    });
  }
  const bytes = await readFile(artifactPath);
  const artifact = JSON.parse(bytes);
  for (const [key, value] of Object.entries({
    task: spec.task,
    profile: spec.profile,
    protocolVersion: "0.1.0",
    result: "PASS",
  })) {
    if (artifact[key] !== value) {
      fail("DIAGNOSTIC_VECTOR_PREREQUISITE_DRIFT", `${spec.task} metadata changed.`, {
        key,
        expected: value,
        actual: artifact[key],
      });
    }
  }
  const digest = sha256(bytes);
  if (verification.artifactSha256 !== digest) {
    fail("DIAGNOSTIC_VECTOR_PREREQUISITE_DRIFT", `${spec.task} bytes disagree with its verifier.`);
  }
  return Object.freeze({
    task: spec.task,
    profile: spec.profile,
    result: "PASS",
    bytes: bytes.length,
    sha256: digest,
    verifier: spec.verify.name,
  });
}

async function verifyPrerequisites(paths) {
  const results = [];
  for (const spec of PREREQUISITE_SPECS) {
    results.push(await verifyPrerequisite(spec, paths[spec.task] ?? spec.defaultPath));
  }
  return Object.freeze(results);
}

async function trackedFiles() {
  const entries = [];
  for (const relativePath of FIXED_TRACKED_PATHS) {
    const bytes = await readFile(path.join(WORKSPACE_ROOT, relativePath));
    entries.push({ path: relativePath, bytes: bytes.length, sha256: sha256(bytes) });
  }
  return Object.freeze(entries.sort((left, right) => compareText(left.path, right.path)));
}

function extensionScope(transcript) {
  const extensions = transcript.cases.filter(({ scope }) => scope === "extension");
  assertJsonEqual(
    extensions.map(({ expected }) => expected.code),
    Object.values(EXPECTED_EXTENSION_EXPORTS),
    "namespaced diagnostic scope",
    "DIAGNOSTIC_VECTOR_SUITE_DRIFT",
  );
  for (const vector of extensions) {
    if (Object.hasOwn(vector.expected, "classification")) {
      fail(
        "DIAGNOSTIC_VECTOR_SUITE_DRIFT",
        `${vector.expected.code} invented a core classification.`,
      );
    }
  }
  return Object.freeze(
    extensions.map(({ id, expected }) =>
      Object.freeze({ id, code: expected.code, classificationPresent: false }),
    ),
  );
}

function verifySuiteTranscript(transcript) {
  if (!Array.isArray(transcript?.cases) || transcript.cases.length !== 34) {
    fail("DIAGNOSTIC_VECTOR_SUITE_FAILED", "The validator micro-vector case set is incomplete.", {
      cases: transcript?.cases?.length,
    });
  }

  for (const vector of transcript.cases) {
    const expected = vector?.expected;
    const positive = vector?.positive;
    const negative = vector?.negative;
    const expectedKeys =
      expected !== null && typeof expected === "object" ? Object.keys(expected) : [];
    const expectedOwnKeys =
      expected !== null && typeof expected === "object" ? Reflect.ownKeys(expected) : [];
    const allowedExpectedKeys =
      vector?.scope === "core"
        ? ["code", "classification", "pointer", "context"]
        : ["code", "pointer", "context"];
    const expectedShapeValid =
      (vector?.scope === "core" || vector?.scope === "extension") &&
      typeof expected?.code === "string" &&
      typeof expected?.pointer === "string" &&
      (vector.scope !== "core" || typeof expected?.classification === "string") &&
      expectedOwnKeys.length === expectedKeys.length &&
      expectedKeys.every((key) => allowedExpectedKeys.includes(key));
    const observationContractPasses =
      expectedShapeValid &&
      positive?.valid === true &&
      Array.isArray(positive?.diagnostics) &&
      positive.diagnostics.length === 0 &&
      positive?.deepFrozen === true &&
      positive?.inputUnchanged === true &&
      positive?.repeatable === true &&
      negative?.valid === false &&
      Array.isArray(negative?.diagnostics) &&
      negative.diagnostics.length === 1 &&
      JSON.stringify(negative.diagnostics[0]) === JSON.stringify(expected) &&
      negative?.deepFrozen === true &&
      negative?.inputUnchanged === true &&
      negative?.repeatable === true;

    if (!observationContractPasses || vector?.pass !== true) {
      fail(
        "DIAGNOSTIC_VECTOR_SUITE_FAILED",
        `Diagnostic micro-vector ${String(vector?.id)} did not satisfy its pair contract.`,
        {
          id: vector?.id,
          declaredPass: vector?.pass,
          observationContractPasses,
        },
      );
    }
  }

  const core = transcript.cases.filter(({ scope }) => scope === "core").length;
  const extensions = transcript.cases.filter(({ scope }) => scope === "extension").length;
  const summary = {
    diagnosticCodes: transcript.cases.length,
    core,
    extensions,
    positiveVectors: transcript.cases.length,
    negativeVectors: transcript.cases.length,
    passingPairs: transcript.cases.filter(({ pass }) => pass === true).length,
    pass: transcript.cases.every(({ pass }) => pass === true),
  };
  assertJsonEqual(
    transcript.summary,
    summary,
    "validator micro-vector derived summary",
    "DIAGNOSTIC_VECTOR_SUITE_FAILED",
  );
}

async function assertArtifactDestinationEntry(artifactPath) {
  try {
    const entry = await lstat(artifactPath);
    if (!entry.isFile() || entry.isSymbolicLink()) {
      fail(
        "DIAGNOSTIC_VECTOR_ARTIFACT_UNSUPPORTED_ENTRY",
        "The M02-T13 artifact destination must be absent or a regular file.",
      );
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

async function resolveWritableArtifactPath(artifactPath) {
  const absolute = path.resolve(artifactPath);
  const parent = path.dirname(absolute);
  const parentEntry = await lstat(parent);
  if (parentEntry.isSymbolicLink() || !parentEntry.isDirectory()) {
    fail(
      "DIAGNOSTIC_VECTOR_ARTIFACT_UNSUPPORTED_ENTRY",
      "The M02-T13 artifact parent must be a real directory.",
    );
  }
  const resolvedParent = await realpath(parent);
  const resolvedArtifactPath = path.join(resolvedParent, path.basename(absolute));
  await assertArtifactDestinationEntry(resolvedArtifactPath);
  return Object.freeze({ resolvedArtifactPath, resolvedParent });
}

async function openExclusiveTemporary(parent, basename) {
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const temporaryPath = path.join(
      parent,
      `.${basename}.${String(process.pid)}.${randomBytes(8).toString("hex")}.tmp`,
    );
    try {
      return { handle: await open(temporaryPath, "wx", 0o600), temporaryPath };
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
    }
  }
  fail(
    "DIAGNOSTIC_VECTOR_ARTIFACT_TEMPORARY_CREATE_FAILED",
    "Could not reserve a temporary M02-T13 artifact.",
  );
}

async function removeTemporary(temporaryPath) {
  try {
    await unlink(temporaryPath);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

/** Builds deterministic M02-T13 validator diagnostic micro-vector evidence in memory. */
export async function buildProtocolValidatorDiagnosticMicroVectorsEvidence({
  suiteRoot = DEFAULT_SNAPSHOT_ROOT,
  tracePath = DEFAULT_PROTOCOL_VALIDATOR_DIAGNOSTIC_MICRO_VECTORS_TRACE_PATH,
  prerequisiteArtifactPaths = {},
  protocolApi,
  validatorApi,
  suiteRunner = runValidatorDiagnosticMicroVectorSuite,
  verifySnapshot = true,
} = {}) {
  const snapshot = verifySnapshot
    ? await verifyProtocolSnapshot(suiteRoot)
    : EXPECTED_PROTOCOL_SNAPSHOT;
  const loadedApis =
    protocolApi === undefined || validatorApi === undefined ? await loadPublicApis() : undefined;
  const activeProtocolApi = protocolApi ?? loadedApis.protocolApi;
  const activeValidatorApi = validatorApi ?? loadedApis.validatorApi;
  const publicApi = verifyPublicApis(activeProtocolApi, activeValidatorApi);
  const [validCatalog, validSource] = await Promise.all([
    readJson(path.join(suiteRoot, "conformance/valid/web.catalog.json")),
    readJson(path.join(suiteRoot, "conformance/valid/sign-in.source.json")),
  ]);
  const transcript = suiteRunner(activeValidatorApi, Object.freeze({ validCatalog, validSource }));
  if (
    transcript?.profile !== "desen-validator-diagnostic-micro-vectors-v1" ||
    transcript?.protocolVersion !== "0.1.0"
  ) {
    fail("DIAGNOSTIC_VECTOR_SUITE_FAILED", "The validator micro-vector suite did not pass.", {
      summary: transcript?.summary,
      failedCases: transcript?.cases?.filter(({ pass }) => !pass).map(({ id }) => id),
    });
  }
  verifySuiteTranscript(transcript);
  const extensions = extensionScope(transcript);
  const traceability = await verifyTraceability(tracePath, transcript, activeProtocolApi);
  const commandWiring = await verifyCommandWiring();
  const prerequisites = await verifyPrerequisites(prerequisiteArtifactPaths);
  const files = await trackedFiles();

  const artifact = {
    schemaVersion: 1,
    task: "M02-T13",
    profile: "desen-validator-diagnostic-micro-vectors-v1",
    protocolVersion: "0.1.0",
    result: "PASS",
    frozenInput: {
      sourceCommit: snapshot.sourceCommit,
      sourceTree: snapshot.sourceTree,
      aggregateSha256: snapshot.aggregateSha256,
      fixtures: [
        "packages/protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json",
        "packages/protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json",
      ],
    },
    prerequisites,
    diagnosticScope: {
      coreRegistry: {
        total: 36,
        validatorOwned: 28,
        laterOwned: 8,
        coveredTraceIds: EXPECTED_CORE_TRACE_IDS,
        excludedLaterCodes: EXPECTED_LATER_CORE_CODES,
      },
      namespacedExtensions: extensions,
      totalValidatorEmissions: 34,
      statement:
        "28 of 36 core diagnostics plus all 6 current validator namespaced diagnostics are covered; 8 core diagnostics remain with runtime, publisher, or activation owners.",
    },
    microVectors: transcript,
    declaredValidatorScope: {
      traceability,
      prerequisiteComposition: {
        tasks: prerequisites.map(({ task }) => task),
        purpose:
          "retain T08-T12 branch, safety, official-suite, and finite-bound evidence without duplicating lower-stage implementations",
      },
      finiteBoundsContribution: {
        proofStatus: "PARTIAL",
        bcp14Clause: "N-041",
        normativeCoverageStatus: "PLANNED",
        validatedNow: [
          "bounded component, interaction, state, operation, and resource contract-schema profiles",
          "resolved event and execution JSON maxDepth=128",
          "resolved event and execution JSON maxJsonNodes=4096",
          "resolved event and execution JSON maxStringCodeUnits=1048576",
          "direct repeat limits and structurally bounded predicate argument arrays",
        ],
        sharedLater: [
          "2 MiB Bundle ingress and activation byte limits",
          "5,000 materialized nodes per surface",
          "Source tree depth 64 across runtime materialization",
          "1,000 runtime repeat instances per repeat",
          "64 actions per event turn",
          "nested settlement depth 16",
          "profile configuration cannot become unbounded",
        ],
        remainingTasks: ["M04-T07", "M04-T13", "M07-T04", "M12-T05"],
      },
    },
    implementation: {
      packages: ["@desen/protocol", "@desen/validator"],
      publicApi,
      newPublicValidatorApi: false,
      trackedFiles: files,
    },
    verification: {
      commands: [
        "pnpm generate:protocol-validator-diagnostic-micro-vectors",
        "pnpm verify:protocol-validator-diagnostic-micro-vectors",
        "pnpm test:protocol-validator-diagnostic-micro-vectors",
        "pnpm check",
      ],
      commandWiring,
      guarantees: [
        "one valid zero-diagnostic vector and one exact single-diagnostic vector per code",
        "exact core code, Appendix B classification, RFC 6901 pointer, and available context",
        "namespaced diagnostics remain classification-free",
        "fresh inputs, caller-input isolation, deep-frozen results, and repeated-run equality",
        "built public APIs and five independently verified prerequisite artifacts",
      ],
      artifactWriter: {
        parentResolution: "realpath",
        temporaryFile: "same-directory exclusive create",
        durabilityBeforeCommit: "file sync",
        commit: "atomic rename",
        failureCleanup: "temporary file removed",
      },
    },
    limitations: [
      "No runtime adapter, publisher, package resolver, activation, rendering, or host effect executes in this proof.",
      "OPERATION_DENIED, ACTION_LIMIT_EXCEEDED, integrity diagnostics, package-resolution diagnostics, BUNDLE_LIMIT_EXCEEDED, and ADAPTER_FAILURE remain with later owners.",
      "N-041 remains PLANNED; P-17 is only PARTIAL because runtime materialization, action-turn, Bundle-ingress, and activation limits are not complete.",
      "The validator conformance target still awaits the final M12-T01 report even though the internal G02 baseline can close.",
      "Diagnostic message text is explanatory and is not treated as a compatibility key.",
    ],
  };
  const artifactText = await format(JSON.stringify(artifact), {
    parser: "json",
    endOfLine: "lf",
    printWidth: 100,
    tabWidth: 2,
  });
  const artifactBytes = Buffer.from(artifactText);
  return Object.freeze({ artifact, artifactBytes, artifactSha256: sha256(artifactBytes) });
}

/** Writes current evidence only outside the immutable tracked M02-T13 artifact path. */
export async function writeProtocolValidatorDiagnosticMicroVectorsEvidence({
  artifactPath = DEFAULT_PROTOCOL_VALIDATOR_DIAGNOSTIC_MICRO_VECTORS_ARTIFACT_PATH,
  beforeAtomicRename,
} = {}) {
  if (
    path.resolve(artifactPath) ===
    path.resolve(DEFAULT_PROTOCOL_VALIDATOR_DIAGNOSTIC_MICRO_VECTORS_ARTIFACT_PATH)
  ) {
    return authenticateHistoricalArtifact(artifactPath);
  }
  const { resolvedArtifactPath, resolvedParent } = await resolveWritableArtifactPath(artifactPath);
  const result = await buildProtocolValidatorDiagnosticMicroVectorsEvidence();
  const { handle, temporaryPath } = await openExclusiveTemporary(
    resolvedParent,
    path.basename(resolvedArtifactPath),
  );
  let openHandle = handle;
  try {
    await openHandle.writeFile(result.artifactBytes);
    await openHandle.sync();
    await openHandle.close();
    openHandle = undefined;
    if (beforeAtomicRename !== undefined) {
      await beforeAtomicRename(
        Object.freeze({ artifactPath: resolvedArtifactPath, temporaryPath }),
      );
    }
    await assertArtifactDestinationEntry(resolvedArtifactPath);
    await rename(temporaryPath, resolvedArtifactPath);
    return result;
  } catch (error) {
    if (openHandle !== undefined) {
      try {
        await openHandle.close();
      } catch {
        // Preserve the primary writer failure.
      }
    }
    try {
      await removeTemporary(temporaryPath);
    } catch (cleanupError) {
      fail(
        "DIAGNOSTIC_VECTOR_ARTIFACT_TEMPORARY_CLEANUP_FAILED",
        "M02-T13 evidence failed and its temporary file could not be removed.",
        {
          writerError: error instanceof Error ? error.message : String(error),
          cleanupError: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
        },
      );
    }
    throw error;
  }
}

/** Authenticates immutable task-time M02-T13 evidence without rebuilding successor source. */
export async function verifyProtocolValidatorDiagnosticMicroVectors({
  artifactPath = DEFAULT_PROTOCOL_VALIDATOR_DIAGNOSTIC_MICRO_VECTORS_ARTIFACT_PATH,
  artifactBytes,
} = {}) {
  const result = await authenticateHistoricalArtifact(artifactPath, artifactBytes);
  return Object.freeze({
    result: "PASS",
    compatibilityMode: "immutable-task-time-artifact",
    diagnostics: result.artifact.microVectors.summary.diagnosticCodes,
    core: result.artifact.microVectors.summary.core,
    extensions: result.artifact.microVectors.summary.extensions,
    positiveVectors: result.artifact.microVectors.summary.positiveVectors,
    negativeVectors: result.artifact.microVectors.summary.negativeVectors,
    traceResponsibilities: Object.values(
      result.artifact.declaredValidatorScope.traceability.responsibilities,
    ).flat().length,
    schemaFamilies: result.artifact.declaredValidatorScope.traceability.schemaRoute.schemaFamilies,
    schemaConstraints:
      result.artifact.declaredValidatorScope.traceability.schemaRoute.schemaConstraints,
    artifactSha256: result.artifactSha256,
  });
}
