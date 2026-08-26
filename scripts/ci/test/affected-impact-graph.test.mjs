import assert from "node:assert/strict";
import test from "node:test";

import {
  AffectedImpactGraphError,
  createAffectedImpactClosure,
  createAffectedImpactGraph,
  validateAffectedImpactGraph,
} from "../affected-impact-graph.mjs";

function clone(value) {
  return structuredClone(value);
}

test("the reviewed impact graph owns every proof unit exactly once", () => {
  const graph = createAffectedImpactGraph();
  assert.equal(graph.proofUnitCount, 73);
  assert.equal(new Set(graph.entries.map(({ id }) => id)).size, 73);
  assert.deepEqual(
    graph.entries.find(({ id }) => id === "control-plane-runtime-transition-races")?.prerequisites,
    ["control-plane-runtime-fault-injection"],
  );
  assert.deepEqual(
    graph.entries.find(({ id }) => id === "reference-host-web-channel-consumption")?.prerequisites,
    ["reference-host-web-source-audit", "control-plane-runtime-transition-races"],
  );
  assert.deepEqual(
    graph.entries.find(({ id }) => id === "editor-core-source-document")?.prerequisites,
    ["protocol-structural-validation"],
  );
  assert.deepEqual(
    graph.entries.find(({ id }) => id === "editor-core-stable-id-insert")?.prerequisites,
    ["editor-core-source-document"],
  );
  assert.equal(validateAffectedImpactGraph(graph), graph);
  assert.equal(Object.isFrozen(graph), true);
  assert.equal(Object.isFrozen(graph.entries), true);
});

test("impact closure includes prerequisites, dependents, and exact global barriers", () => {
  const closure = createAffectedImpactClosure(["control-plane-runtime-recovery"]);
  assert.deepEqual(closure.ownerProofUnitIds, ["control-plane-runtime-recovery"]);
  assert.equal(closure.proofUnitIds.includes("publisher-publish-result"), false);
  assert.equal(closure.proofUnitIds.includes("publisher-invalid-source-matrix"), true);
  assert.equal(closure.proofUnitIds.includes("control-plane-runtime-fault-injection"), true);
  assert.equal(closure.proofUnitIds.includes("control-plane-runtime-transition-races"), true);
  assert.deepEqual(closure.nodeIds.slice(0, 7), [
    "orchestrator-contracts",
    "format",
    "lint",
    "structural-validator-artifacts",
    "workspace-graph",
    "package-tests",
    "editor-core-public-package-contract",
  ]);
  assert.deepEqual(closure.nodeIds.slice(-2), ["dependency-boundaries", "boundary-fixtures"]);
  assert.equal(closure.workloadCount, 7 + closure.proofUnitCount * 2 + 2);
  assert.match(closure.impactSha256, /^[0-9a-f]{64}$/u);
});

test("independent proof units remain a strict subset", () => {
  const closure = createAffectedImpactClosure(["protocol-canonicalization"]);
  assert.deepEqual(closure.proofUnitIds, ["protocol-canonicalization"]);
  assert.equal(closure.workloadCount, 11);
});

test("the editor stable-ID insert closes over its Source and structural predecessors", () => {
  const closure = createAffectedImpactClosure(["editor-core-stable-id-insert"]);
  assert.deepEqual(closure.proofUnitIds, [
    "protocol-structural-validation",
    "editor-core-source-document",
    "editor-core-stable-id-insert",
  ]);
  assert.equal(closure.workloadCount, 15);
});

test("unknown, duplicate, empty, proxy, and sparse owner inputs fail closed", () => {
  for (const owners of [
    [],
    ["unknown-proof"],
    ["protocol-types", "protocol-types"],
    new Proxy(["protocol-types"], {}),
    Array(1),
  ]) {
    assert.throws(() => createAffectedImpactClosure(owners), AffectedImpactGraphError);
  }
});

test("missing, duplicate, unknown, reordered, and accessor-backed graph mutations fail closed", () => {
  const mutations = [];
  const missing = clone(createAffectedImpactGraph());
  missing.entries.pop();
  missing.proofUnitCount -= 1;
  mutations.push(missing);

  const duplicate = clone(createAffectedImpactGraph());
  duplicate.entries[1].id = duplicate.entries[0].id;
  mutations.push(duplicate);

  const unknownEdge = clone(createAffectedImpactGraph());
  unknownEdge.entries[0].prerequisites = ["unknown-proof"];
  mutations.push(unknownEdge);

  const reordered = clone(createAffectedImpactGraph());
  [reordered.entries[0], reordered.entries[1]] = [reordered.entries[1], reordered.entries[0]];
  mutations.push(reordered);

  for (const mutation of mutations) {
    assert.throws(() => validateAffectedImpactGraph(mutation), AffectedImpactGraphError);
  }

  const accessor = clone(createAffectedImpactGraph());
  Object.defineProperty(accessor.entries[0], "id", {
    enumerable: true,
    get: () => "protocol-snapshot",
  });
  assert.throws(() => validateAffectedImpactGraph(accessor), AffectedImpactGraphError);
});
