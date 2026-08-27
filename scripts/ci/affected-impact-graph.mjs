import { createHash } from "node:crypto";
import { types as utilTypes } from "node:util";

import {
  createExhaustiveWorkloadInventory,
  validateExhaustiveWorkloadInventory,
} from "./exhaustive-workload-inventory.mjs";

const PROFILE = "desen.ci.affected-impact-graph.v1";
const SAFE_ARRAY_IS_ARRAY = Array.isArray;
const SAFE_JSON_STRINGIFY = JSON.stringify;
const SAFE_OBJECT_FREEZE = Object.freeze;
const SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR = Object.getOwnPropertyDescriptor;
const SAFE_OBJECT_GET_PROTOTYPE_OF = Object.getPrototypeOf;
const SAFE_OBJECT_IS_FROZEN = Object.isFrozen;
const SAFE_OBJECT_PROTOTYPE = Object.prototype;
const SAFE_REFLECT_OWN_KEYS = Reflect.ownKeys;
const SAFE_UTIL_IS_PROXY = utilTypes.isProxy;
const ROOT_KEYS = SAFE_OBJECT_FREEZE([
  "schemaVersion",
  "profile",
  "inventorySha256",
  "impactGraphSha256",
  "proofUnitCount",
  "entries",
]);
const ENTRY_KEYS = SAFE_OBJECT_FREEZE(["id", "prerequisites"]);
const PREFIX_NODE_IDS = SAFE_OBJECT_FREEZE([
  "orchestrator-contracts",
  "format",
  "lint",
  "structural-validator-artifacts",
  "workspace-graph",
  "package-tests",
  "editor-core-public-package-contract",
]);
const SUFFIX_NODE_IDS = SAFE_OBJECT_FREEZE(["dependency-boundaries", "boundary-fixtures"]);

// These are semantic proof prerequisites recovered from the reviewed root script graph. They are
// deliberately separate from the exhaustive scheduler's coarse package-tests barrier.
const REVIEWED_PREREQUISITES = SAFE_OBJECT_FREEZE(
  [
    ["reference-catalog-web-components", ["web-react-package-digest"]],
    ["reference-catalog-web-form-feedback", ["reference-catalog-web-components"]],
    ["reference-tokens-and-synthetic-fixtures", ["reference-catalog-web-form-feedback"]],
    ["reference-sign-in-fixtures-and-host-binding", ["reference-tokens-and-synthetic-fixtures"]],
    ["reference-catalog-web-parity", ["reference-sign-in-fixtures-and-host-binding"]],
    [
      "reference-catalog-web-capability-artifact",
      ["catalog-manifest-registration", "reference-catalog-web-parity"],
    ],
    ["runtime-core-host-ports", ["reference-catalog-web-capability-artifact"]],
    ["runtime-core-value-resolution", ["runtime-core-host-ports"]],
    ["runtime-core-token-format-resolution", ["runtime-core-value-resolution"]],
    ["runtime-core-predicate-evaluation", ["runtime-core-value-resolution"]],
    [
      "runtime-core-variant-style-evaluation",
      ["runtime-core-token-format-resolution", "runtime-core-predicate-evaluation"],
    ],
    ["runtime-core-repeat-materialization", ["runtime-core-local-state-identity"]],
    ["runtime-core-resource-lifecycle", ["runtime-core-repeat-materialization"]],
    ["runtime-core-operation-lifecycle", ["runtime-core-resource-lifecycle"]],
    ["runtime-core-state-navigation-actions", ["runtime-core-operation-lifecycle"]],
    ["runtime-core-operation-resource-actions", ["runtime-core-state-navigation-actions"]],
    [
      "runtime-core-action-turns",
      [
        "runtime-core-state-navigation-actions",
        "runtime-core-operation-resource-actions",
        "runtime-core-command-event-actions",
      ],
    ],
    [
      "runtime-core-adapter-bridges",
      ["runtime-core-repeat-materialization", "runtime-core-command-event-actions"],
    ],
    ["reference-host-web-source-audit", ["reference-host-web-shell", "reference-host-web-sign-in"]],
    ["publisher-execution-preflight", ["publisher-capability-preflight"]],
    ["publisher-source-preservation", ["publisher-execution-preflight"]],
    ["publisher-source-normalization", ["publisher-source-preservation"]],
    ["publisher-catalog-pinning", ["publisher-source-normalization"]],
    ["publisher-bundle-publication", ["publisher-catalog-pinning"]],
    ["publisher-official-golden", ["publisher-bundle-publication"]],
    ["publisher-invalid-source-matrix", ["publisher-official-golden"]],
    ["control-plane-bundle-store", ["publisher-invalid-source-matrix"]],
    ["control-plane-bundle-verification", ["control-plane-bundle-store"]],
    ["control-plane-package-preflight", ["control-plane-bundle-verification"]],
    ["control-plane-reference-preflight", ["control-plane-package-preflight"]],
    ["control-plane-local-api", ["control-plane-reference-preflight"]],
    ["control-plane-runtime-staging", ["control-plane-local-api"]],
    ["control-plane-runtime-activation", ["control-plane-runtime-staging"]],
    ["control-plane-runtime-recovery", ["control-plane-runtime-activation"]],
    ["control-plane-runtime-fault-injection", ["control-plane-runtime-recovery"]],
    ["control-plane-runtime-transition-races", ["control-plane-runtime-fault-injection"]],
    [
      "reference-host-web-channel-consumption",
      ["reference-host-web-source-audit", "control-plane-runtime-transition-races"],
    ],
    ["editor-core-source-document", ["protocol-structural-validation"]],
    ["editor-core-stable-id-insert", ["editor-core-source-document"]],
    ["editor-core-structural-edits", ["editor-core-stable-id-insert"]],
    ["editor-core-content-edits", ["editor-core-stable-id-insert", "editor-core-structural-edits"]],
    [
      "editor-core-state-binding-edits",
      ["editor-core-stable-id-insert", "editor-core-content-edits"],
    ],
    ["editor-core-event-action-edits", ["editor-core-state-binding-edits"]],
    ["editor-core-authoring-round-trip", ["editor-core-event-action-edits"]],
    ["editor-core-persistence", ["editor-core-authoring-round-trip"]],
    [
      "editor-core-continuous-validation",
      [
        "editor-core-structural-edits",
        "editor-core-content-edits",
        "editor-core-state-binding-edits",
        "editor-core-event-action-edits",
        "editor-core-authoring-round-trip",
      ],
    ],
  ].map(([id, prerequisites]) => SAFE_OBJECT_FREEZE([id, SAFE_OBJECT_FREEZE([...prerequisites])])),
);

/** Reviewed digest of the selector-only semantic impact graph. */
export const EXPECTED_AFFECTED_IMPACT_GRAPH_SHA256 =
  "add38e32769ee7c197cb5a6e2d6a1a028382ca5d8fb6e8f9318ebfecfbfa9c9d";

/** Stable failure raised when selector impact ownership is incomplete or ambiguous. */
export class AffectedImpactGraphError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "AffectedImpactGraphError";
    this.code = code;
    this.details = SAFE_OBJECT_FREEZE({ ...details });
  }
}

function fail(code, message, details = {}) {
  throw new AffectedImpactGraphError(code, message, details);
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !SAFE_OBJECT_IS_FROZEN(value)) {
    for (const key of SAFE_REFLECT_OWN_KEYS(value)) deepFreeze(value[key]);
    SAFE_OBJECT_FREEZE(value);
  }
  return value;
}

function exactRecord(value, expectedKeys, label) {
  if (
    value === null ||
    typeof value !== "object" ||
    SAFE_ARRAY_IS_ARRAY(value) ||
    SAFE_UTIL_IS_PROXY(value) ||
    SAFE_OBJECT_GET_PROTOTYPE_OF(value) !== SAFE_OBJECT_PROTOTYPE
  ) {
    fail("AFFECTED_IMPACT_GRAPH_INVALID", `${label} must be one inert plain object.`);
  }
  const keys = SAFE_REFLECT_OWN_KEYS(value);
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key, index) => key !== expectedKeys[index])
  ) {
    fail("AFFECTED_IMPACT_GRAPH_INVALID", `${label} fields drifted.`, {
      expected: expectedKeys,
      actual: keys.map(String),
    });
  }
  const captured = {};
  for (const key of expectedKeys) {
    const descriptor = SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR(value, key);
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
      fail("AFFECTED_IMPACT_GRAPH_INVALID", `${label}.${key} must be inert own data.`);
    }
    captured[key] = descriptor.value;
  }
  return captured;
}

function exactArray(value, label, maximumLength) {
  if (
    !SAFE_ARRAY_IS_ARRAY(value) ||
    SAFE_UTIL_IS_PROXY(value) ||
    SAFE_OBJECT_GET_PROTOTYPE_OF(value) !== Array.prototype ||
    value.length > maximumLength ||
    SAFE_REFLECT_OWN_KEYS(value).length !== value.length + 1
  ) {
    fail("AFFECTED_IMPACT_GRAPH_INVALID", `${label} must be one bounded dense array.`);
  }
  return value.map((entry, index) => {
    const descriptor = SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR(value, String(index));
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
      fail("AFFECTED_IMPACT_GRAPH_INVALID", `${label}[${index}] must be inert own data.`);
    }
    return descriptor.value;
  });
}

function exactString(value, label) {
  if (typeof value !== "string" || !/^[a-z0-9-]{1,128}$/u.test(value)) {
    fail("AFFECTED_IMPACT_GRAPH_INVALID", `${label} must be one bounded stable id.`);
  }
  return value;
}

function normalizedGraph(graph) {
  return {
    schemaVersion: graph.schemaVersion,
    profile: graph.profile,
    inventorySha256: graph.inventorySha256,
    proofUnitCount: graph.proofUnitCount,
    entries: graph.entries.map(({ id, prerequisites }) => ({
      id,
      prerequisites: [...prerequisites],
    })),
  };
}

function calculateGraphSha256(graph) {
  return createHash("sha256")
    .update(SAFE_JSON_STRINGIFY(normalizedGraph(graph)))
    .digest("hex");
}

function captureGraph(candidate) {
  const root = exactRecord(candidate, ROOT_KEYS, "Affected impact graph");
  if (root.schemaVersion !== 1 || root.profile !== PROFILE) {
    fail("AFFECTED_IMPACT_GRAPH_INVALID", "Affected impact graph schema or profile drifted.");
  }
  if (
    !/^[0-9a-f]{64}$/u.test(root.inventorySha256) ||
    !/^[0-9a-f]{64}$/u.test(root.impactGraphSha256)
  ) {
    fail("AFFECTED_IMPACT_GRAPH_INVALID", "Affected impact graph digests are malformed.");
  }
  const entries = exactArray(root.entries, "Affected impact graph entries", 128).map(
    (rawEntry, index) => {
      const entry = exactRecord(rawEntry, ENTRY_KEYS, `Affected impact graph entry ${index}`);
      return {
        id: exactString(entry.id, `Affected impact graph entry ${index}.id`),
        prerequisites: exactArray(
          entry.prerequisites,
          `Affected impact graph entry ${index}.prerequisites`,
          128,
        ).map((id, dependencyIndex) =>
          exactString(id, `Affected impact graph entry ${index}.prerequisites[${dependencyIndex}]`),
        ),
      };
    },
  );
  if (root.proofUnitCount !== entries.length) {
    fail("AFFECTED_IMPACT_GRAPH_INVALID", "Affected impact graph count drifted.");
  }
  const ids = entries.map(({ id }) => id);
  if (new Set(ids).size !== ids.length) {
    fail("AFFECTED_IMPACT_GRAPH_INVALID", "Affected impact graph contains duplicate owners.");
  }
  const idSet = new Set(ids);
  for (const entry of entries) {
    if (
      new Set(entry.prerequisites).size !== entry.prerequisites.length ||
      entry.prerequisites.some((id) => id === entry.id || !idSet.has(id))
    ) {
      fail("AFFECTED_IMPACT_GRAPH_INVALID", `Impact edges for ${entry.id} are invalid.`);
    }
  }
  return { ...root, entries };
}

function buildCanonicalGraph() {
  const inventory = validateExhaustiveWorkloadInventory(createExhaustiveWorkloadInventory());
  const prerequisiteMap = new Map(REVIEWED_PREREQUISITES);
  const entries = inventory.proofUnits.map(({ id }) => ({
    id,
    prerequisites: [...(prerequisiteMap.get(id) ?? [])],
  }));
  const proofIds = new Set(entries.map(({ id }) => id));
  for (const [id, prerequisites] of REVIEWED_PREREQUISITES) {
    if (!proofIds.has(id) || prerequisites.some((dependency) => !proofIds.has(dependency))) {
      fail(
        "AFFECTED_IMPACT_GRAPH_REVIEW_DRIFT",
        "Reviewed impact edge names an unknown proof unit.",
        {
          id,
        },
      );
    }
  }
  const base = {
    schemaVersion: 1,
    profile: PROFILE,
    inventorySha256: inventory.inventorySha256,
    impactGraphSha256: "0".repeat(64),
    proofUnitCount: entries.length,
    entries,
  };
  return deepFreeze({ ...base, impactGraphSha256: calculateGraphSha256(base) });
}

const CANONICAL_GRAPH = buildCanonicalGraph();
if (CANONICAL_GRAPH.impactGraphSha256 !== EXPECTED_AFFECTED_IMPACT_GRAPH_SHA256) {
  throw new AffectedImpactGraphError(
    "AFFECTED_IMPACT_GRAPH_REVIEW_DRIFT",
    `The affected impact graph digest drifted: ${CANONICAL_GRAPH.impactGraphSha256}.`,
    {
      expected: EXPECTED_AFFECTED_IMPACT_GRAPH_SHA256,
      actual: CANONICAL_GRAPH.impactGraphSha256,
    },
  );
}

/** Returns the single reviewed selector-only semantic impact graph. */
export function createAffectedImpactGraph() {
  return CANONICAL_GRAPH;
}

/** Revalidates injected graph data and admits only the exact reviewed authority. */
export function validateAffectedImpactGraph(candidate) {
  const captured = captureGraph(candidate);
  const calculated = calculateGraphSha256(captured);
  if (
    captured.impactGraphSha256 !== calculated ||
    calculated !== EXPECTED_AFFECTED_IMPACT_GRAPH_SHA256 ||
    SAFE_JSON_STRINGIFY(normalizedGraph(captured)) !==
      SAFE_JSON_STRINGIFY(normalizedGraph(CANONICAL_GRAPH))
  ) {
    fail("AFFECTED_IMPACT_GRAPH_DRIFT", "Affected impact graph was omitted or substituted.", {
      expected: EXPECTED_AFFECTED_IMPACT_GRAPH_SHA256,
      actual: calculated,
    });
  }
  return CANONICAL_GRAPH;
}

/**
 * Expands proof owners through both prerequisite and dependent edges, then projects the exact
 * shadow workload identities. The required exhaustive graph remains untouched.
 */
export function createAffectedImpactClosure(ownerProofUnitIds) {
  const graph = validateAffectedImpactGraph(CANONICAL_GRAPH);
  const owners = exactArray(ownerProofUnitIds, "Affected proof owners", 128).map((id, index) =>
    exactString(id, `Affected proof owners[${index}]`),
  );
  if (owners.length === 0 || new Set(owners).size !== owners.length) {
    fail("AFFECTED_IMPACT_OWNER_INVALID", "Affected proof owners must be nonempty and unique.");
  }
  const graphIds = new Set(graph.entries.map(({ id }) => id));
  if (owners.some((id) => !graphIds.has(id))) {
    fail("AFFECTED_IMPACT_OWNER_UNKNOWN", "Affected proof owners contain an unknown proof unit.");
  }
  const affected = new Set(owners);
  let changed = true;
  while (changed) {
    changed = false;
    for (const entry of graph.entries) {
      const connected =
        affected.has(entry.id) ||
        entry.prerequisites.some((dependency) => affected.has(dependency));
      if (!connected) continue;
      for (const id of [entry.id, ...entry.prerequisites]) {
        if (!affected.has(id)) {
          affected.add(id);
          changed = true;
        }
      }
    }
  }
  const inventory = createExhaustiveWorkloadInventory();
  const proofUnitIds = graph.entries.map(({ id }) => id).filter((id) => affected.has(id));
  const conditionalPrefixNodeIds = proofUnitIds.includes("editor-core-persistence")
    ? ["editor-web-public-package-contract"]
    : [];
  const selected = new Set([
    ...PREFIX_NODE_IDS,
    ...conditionalPrefixNodeIds,
    ...proofUnitIds.flatMap((id) => [`verify-${id}`, `test-${id}`]),
    ...SUFFIX_NODE_IDS,
  ]);
  const nodeIds = inventory.nodes.map(({ id }) => id).filter((id) => selected.has(id));
  if (
    nodeIds.length !==
    PREFIX_NODE_IDS.length +
      conditionalPrefixNodeIds.length +
      proofUnitIds.length * 2 +
      SUFFIX_NODE_IDS.length
  ) {
    fail("AFFECTED_IMPACT_PROJECTION_INVALID", "Affected workload projection is incomplete.");
  }
  return deepFreeze({
    ownerProofUnitIds: [...owners],
    proofUnitIds,
    nodeIds,
    proofUnitCount: proofUnitIds.length,
    workloadCount: nodeIds.length,
    impactSha256: createHash("sha256")
      .update(SAFE_JSON_STRINGIFY({ owners, proofUnitIds, nodeIds }))
      .digest("hex"),
  });
}

export { PREFIX_NODE_IDS, PROFILE, SUFFIX_NODE_IDS };
