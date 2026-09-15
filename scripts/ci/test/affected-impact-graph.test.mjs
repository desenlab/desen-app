import assert from "node:assert/strict";
import test from "node:test";

import {
  AffectedImpactGraphError,
  createAffectedImpactClosure,
  createAffectedImpactGraph,
  validateAffectedImpactGraph,
} from "../affected-impact-graph.mjs";

const DESEN_APP_CONNECTED_PROOF_UNITS = Object.freeze([
  "protocol-structural-validation",
  "catalog-manifest-registration",
  "web-react-package-digest",
  "reference-catalog-web-components",
  "reference-catalog-web-form-feedback",
  "reference-tokens-and-synthetic-fixtures",
  "reference-sign-in-fixtures-and-host-binding",
  "reference-catalog-web-parity",
  "reference-catalog-web-capability-artifact",
  "runtime-core-host-ports",
  "runtime-core-value-resolution",
  "runtime-core-token-format-resolution",
  "runtime-core-predicate-evaluation",
  "runtime-core-variant-style-evaluation",
  "runtime-core-headless-sign-in",
  "runtime-core-audit-hardening",
  "runtime-react-reconciliation-diagnostics",
  "reference-host-web-shell",
  "reference-host-web-sign-in",
  "reference-host-web-source-audit",
  "publisher-capability-preflight",
  "publisher-execution-preflight",
  "publisher-source-preservation",
  "publisher-source-normalization",
  "publisher-catalog-pinning",
  "publisher-bundle-publication",
  "publisher-official-golden",
  "publisher-invalid-source-matrix",
  "control-plane-bundle-store",
  "control-plane-bundle-verification",
  "control-plane-package-preflight",
  "control-plane-reference-preflight",
  "control-plane-local-api",
  "control-plane-runtime-staging",
  "control-plane-runtime-activation",
  "control-plane-runtime-recovery",
  "control-plane-runtime-fault-injection",
  "control-plane-runtime-transition-races",
  "reference-host-web-channel-consumption",
  "editor-core-source-document",
  "editor-core-stable-id-insert",
  "editor-core-structural-edits",
  "editor-core-content-edits",
  "editor-core-state-binding-edits",
  "editor-core-event-action-edits",
  "editor-core-authoring-round-trip",
  "editor-core-persistence",
  "editor-core-continuous-validation",
  "editor-core-terminal-integration",
  "desen-app-shell-navigation",
  "desen-app-catalog-panel-layer-tree",
  "desen-app-real-adapter-canvas",
  "desen-app-selection-overlay",
  "desen-app-schema-inspector",
  "desen-app-structured-inspector",
  "desen-app-named-slot-authoring",
  "desen-app-state-binding-editor",
  "desen-app-event-action-editor",
  "desen-app-design-run-modes",
  "desen-app-fixtures-scenarios-fidelity",
  "desen-app-source-persistence",
  "desen-app-node-linked-diagnostics",
  "desen-app-publish-activation",
  "desen-app-empty-project-browser-e2e",
  "desen-app-browser-e2e-workspace-compatibility",
  "desen-app-user-created-blank-project",
  "desen-app-visual-behavior-authoring",
  "desen-app-evergreen-product-composition",
  "desen-app-input-pending-fixture",
  "desen-app-failure-fixture",
  "desen-app-success-host-operation",
  "historical-archive-redaction",
  "desen-app-published-host-update",
  "desen-app-invalid-publication",
  "desen-app-last-known-good-recovery",
  "desen-app-repeatable-demo",
  "runtime-core-baseline",
  "m10-gate",
  "m10a-t01",
  "m10a-t02",
  "m10a-t03",
  "m10a-t04",
  "m10a-t05",
  "m10a-t06",
  "m10a-t07",
  "m10a-t08",
]);

function clone(value) {
  return structuredClone(value);
}

test("the reviewed impact graph owns every proof unit exactly once", () => {
  const graph = createAffectedImpactGraph();
  assert.equal(graph.proofUnitCount, 118);
  assert.equal(new Set(graph.entries.map(({ id }) => id)).size, 118);
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
  assert.deepEqual(
    graph.entries.find(({ id }) => id === "editor-core-structural-edits")?.prerequisites,
    ["editor-core-stable-id-insert"],
  );
  assert.deepEqual(
    graph.entries.find(({ id }) => id === "editor-core-content-edits")?.prerequisites,
    ["editor-core-stable-id-insert", "editor-core-structural-edits"],
  );
  assert.deepEqual(
    graph.entries.find(({ id }) => id === "editor-core-state-binding-edits")?.prerequisites,
    ["editor-core-stable-id-insert", "editor-core-content-edits"],
  );
  assert.deepEqual(
    graph.entries.find(({ id }) => id === "editor-core-event-action-edits")?.prerequisites,
    ["editor-core-state-binding-edits"],
  );
  assert.deepEqual(
    graph.entries.find(({ id }) => id === "editor-core-authoring-round-trip")?.prerequisites,
    ["editor-core-event-action-edits"],
  );
  assert.deepEqual(
    graph.entries.find(({ id }) => id === "editor-core-persistence")?.prerequisites,
    ["editor-core-authoring-round-trip"],
  );
  assert.deepEqual(
    graph.entries.find(({ id }) => id === "editor-core-continuous-validation")?.prerequisites,
    [
      "editor-core-structural-edits",
      "editor-core-content-edits",
      "editor-core-state-binding-edits",
      "editor-core-event-action-edits",
      "editor-core-authoring-round-trip",
    ],
  );
  assert.deepEqual(
    graph.entries.find(({ id }) => id === "editor-core-terminal-integration")?.prerequisites,
    [
      "runtime-core-headless-sign-in",
      "runtime-core-audit-hardening",
      "editor-core-source-document",
      "editor-core-stable-id-insert",
      "editor-core-structural-edits",
      "editor-core-content-edits",
      "editor-core-state-binding-edits",
      "editor-core-event-action-edits",
      "editor-core-authoring-round-trip",
      "editor-core-persistence",
      "editor-core-continuous-validation",
    ],
  );
  assert.deepEqual(
    graph.entries.find(({ id }) => id === "desen-app-shell-navigation")?.prerequisites,
    ["editor-core-terminal-integration"],
  );
  assert.deepEqual(
    graph.entries.find(({ id }) => id === "desen-app-catalog-panel-layer-tree")?.prerequisites,
    ["desen-app-shell-navigation", "reference-catalog-web-capability-artifact"],
  );
  assert.deepEqual(
    graph.entries.find(({ id }) => id === "desen-app-real-adapter-canvas")?.prerequisites,
    ["desen-app-shell-navigation", "reference-host-web-source-audit"],
  );
  assert.deepEqual(
    graph.entries.find(({ id }) => id === "desen-app-selection-overlay")?.prerequisites,
    ["desen-app-real-adapter-canvas"],
  );
  assert.deepEqual(
    graph.entries.find(({ id }) => id === "desen-app-schema-inspector")?.prerequisites,
    [
      "desen-app-catalog-panel-layer-tree",
      "desen-app-selection-overlay",
      "publisher-official-golden",
    ],
  );
  assert.deepEqual(
    graph.entries.find(({ id }) => id === "desen-app-structured-inspector")?.prerequisites,
    ["desen-app-schema-inspector"],
  );
  assert.deepEqual(
    graph.entries.find(({ id }) => id === "desen-app-named-slot-authoring")?.prerequisites,
    ["desen-app-structured-inspector"],
  );
  assert.deepEqual(
    graph.entries.find(({ id }) => id === "desen-app-state-binding-editor")?.prerequisites,
    [
      "desen-app-schema-inspector",
      "editor-core-state-binding-edits",
      "desen-app-named-slot-authoring",
    ],
  );
  assert.deepEqual(
    graph.entries.find(({ id }) => id === "desen-app-event-action-editor")?.prerequisites,
    ["desen-app-state-binding-editor", "editor-core-event-action-edits"],
  );
  assert.deepEqual(
    graph.entries.find(({ id }) => id === "desen-app-design-run-modes")?.prerequisites,
    [
      "desen-app-real-adapter-canvas",
      "desen-app-state-binding-editor",
      "desen-app-event-action-editor",
    ],
  );
  assert.deepEqual(
    graph.entries.find(({ id }) => id === "desen-app-fixtures-scenarios-fidelity")?.prerequisites,
    [
      "desen-app-design-run-modes",
      "reference-sign-in-fixtures-and-host-binding",
      "reference-catalog-web-parity",
    ],
  );
  assert.deepEqual(
    graph.entries.find(({ id }) => id === "desen-app-source-persistence")?.prerequisites,
    [
      "desen-app-shell-navigation",
      "editor-core-persistence",
      "desen-app-fixtures-scenarios-fidelity",
    ],
  );
  assert.deepEqual(
    graph.entries.find(({ id }) => id === "desen-app-node-linked-diagnostics")?.prerequisites,
    [
      "runtime-react-reconciliation-diagnostics",
      "editor-core-continuous-validation",
      "desen-app-selection-overlay",
      "desen-app-schema-inspector",
      "desen-app-structured-inspector",
      "desen-app-named-slot-authoring",
      "desen-app-state-binding-editor",
      "desen-app-event-action-editor",
      "desen-app-design-run-modes",
      "desen-app-fixtures-scenarios-fidelity",
      "desen-app-source-persistence",
    ],
  );
  assert.deepEqual(
    graph.entries.find(({ id }) => id === "desen-app-publish-activation")?.prerequisites,
    [
      "desen-app-design-run-modes",
      "desen-app-fixtures-scenarios-fidelity",
      "desen-app-source-persistence",
      "desen-app-node-linked-diagnostics",
      "publisher-bundle-publication",
      "publisher-official-golden",
      "control-plane-local-api",
      "reference-host-web-channel-consumption",
    ],
  );
  assert.deepEqual(
    graph.entries.find(({ id }) => id === "desen-app-empty-project-browser-e2e")?.prerequisites,
    ["desen-app-publish-activation"],
  );
  assert.deepEqual(
    graph.entries.find(({ id }) => id === "desen-app-browser-e2e-workspace-compatibility")
      ?.prerequisites,
    ["desen-app-empty-project-browser-e2e"],
  );
  assert.deepEqual(
    graph.entries.find(({ id }) => id === "desen-app-user-created-blank-project")?.prerequisites,
    ["desen-app-browser-e2e-workspace-compatibility"],
  );
  assert.deepEqual(
    graph.entries.find(({ id }) => id === "desen-app-visual-behavior-authoring")?.prerequisites,
    ["desen-app-user-created-blank-project"],
  );
  assert.deepEqual(
    graph.entries.find(({ id }) => id === "desen-app-evergreen-product-composition")?.prerequisites,
    ["desen-app-visual-behavior-authoring"],
  );
  assert.deepEqual(
    graph.entries.find(({ id }) => id === "desen-app-input-pending-fixture")?.prerequisites,
    ["desen-app-evergreen-product-composition"],
  );
  assert.deepEqual(
    graph.entries.find(({ id }) => id === "desen-app-failure-fixture")?.prerequisites,
    ["desen-app-input-pending-fixture"],
  );
  assert.deepEqual(
    graph.entries.find(({ id }) => id === "desen-app-success-host-operation")?.prerequisites,
    ["desen-app-failure-fixture", "reference-sign-in-fixtures-and-host-binding"],
  );
  assert.deepEqual(
    graph.entries.find(({ id }) => id === "desen-app-published-host-update")?.prerequisites,
    [
      "desen-app-success-host-operation",
      "desen-app-publish-activation",
      "reference-host-web-source-audit",
      "desen-app-real-adapter-canvas",
    ],
  );
  assert.deepEqual(graph.entries.find(({ id }) => id === "m10a-t01")?.prerequisites, ["m10-gate"]);
  assert.deepEqual(graph.entries.find(({ id }) => id === "m10a-t02")?.prerequisites, ["m10a-t01"]);
  assert.deepEqual(graph.entries.find(({ id }) => id === "m10a-t03")?.prerequisites, ["m10a-t02"]);
  assert.deepEqual(graph.entries.find(({ id }) => id === "m10a-t04")?.prerequisites, ["m10a-t02"]);
  assert.deepEqual(graph.entries.find(({ id }) => id === "m10a-t05")?.prerequisites, [
    "m10a-t01",
    "m10a-t02",
  ]);
  assert.deepEqual(graph.entries.find(({ id }) => id === "m10a-t06")?.prerequisites, ["m10a-t05"]);
  assert.deepEqual(graph.entries.find(({ id }) => id === "m10a-t07")?.prerequisites, ["m10a-t06"]);
  assert.deepEqual(graph.entries.find(({ id }) => id === "m10a-t08")?.prerequisites, ["m10a-t07"]);
  assert.equal(validateAffectedImpactGraph(graph), graph);
  assert.equal(Object.isFrozen(graph), true);
  assert.equal(Object.isFrozen(graph.entries), true);
});

test("M10A-T08 extends the closed M10A chain without weakening its historical closure", () => {
  const historical = createAffectedImpactClosure(["historical-archive-redaction"]);
  assert.equal(historical.proofUnitCount, 86);
  assert.equal(historical.workloadCount, 186);
  assert.equal(historical.proofUnitIds.includes("m10-gate"), true);
  assert.equal(historical.proofUnitIds.includes("m10a-t01"), true);
  assert.equal(historical.proofUnitIds.includes("m10a-t02"), true);
  assert.equal(historical.proofUnitIds.includes("m10a-t03"), true);
  assert.equal(historical.proofUnitIds.includes("m10a-t04"), true);
  assert.equal(historical.proofUnitIds.includes("m10a-t05"), true);
  assert.equal(historical.proofUnitIds.includes("m10a-t06"), true);
  assert.equal(historical.proofUnitIds.includes("m10a-t07"), true);
  assert.equal(historical.proofUnitIds.includes("m10a-t08"), true);
  assert.equal(
    historical.impactSha256,
    "7f2745e3e4ca515aef8c727172ee14cd7e76be4de800d6b0745e94470c4a9268",
  );

  const successor = createAffectedImpactClosure(["m10a-t01"]);
  assert.deepEqual(successor.ownerProofUnitIds, ["m10a-t01"]);
  assert.deepEqual(successor.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(successor.nodeIds.includes("verify-m10-gate"), true);
  assert.equal(successor.nodeIds.includes("test-m10-gate"), true);
  assert.equal(successor.nodeIds.includes("verify-m10a-t02"), true);
  assert.equal(successor.nodeIds.includes("verify-m10a-t03"), true);
  assert.equal(successor.nodeIds.includes("verify-m10a-t04"), true);
  assert.equal(successor.nodeIds.includes("verify-m10a-t05"), true);
  assert.equal(successor.nodeIds.includes("verify-m10a-t06"), true);
  assert.equal(successor.nodeIds.includes("verify-m10a-t07"), true);
  assert.equal(successor.nodeIds.includes("verify-m10a-t08"), true);
  assert.equal(
    successor.impactSha256,
    "5b328c71d020e7edab2e0c6f5854ce8e327b3063d5706120e8a3c7b26c6e64c4",
  );
});

test("invalid publication has exactly the publication, diagnostics, and public invalid-matrix parents", () => {
  const graph = createAffectedImpactGraph();
  const parents = [
    "desen-app-published-host-update",
    "desen-app-node-linked-diagnostics",
    "publisher-invalid-source-matrix",
  ];
  assert.deepEqual(
    graph.entries.find(({ id }) => id === "desen-app-invalid-publication")?.prerequisites,
    parents,
  );
  const closure = createAffectedImpactClosure(["desen-app-invalid-publication"]);
  assert.deepEqual(closure.ownerProofUnitIds, ["desen-app-invalid-publication"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(
    closure.impactSha256,
    "2e8c6bfdba2908bdcb3cbdbeb068904adf11ef135237ef09d5bbf0a9876bc06d",
  );
  assert.equal(closure.proofUnitCount, DESEN_APP_CONNECTED_PROOF_UNITS.length);
  assert.equal(closure.workloadCount, 12 + DESEN_APP_CONNECTED_PROOF_UNITS.length * 2 + 2);
  for (const id of parents) {
    assert.equal(closure.nodeIds.includes(`verify-${id}`), true);
    assert.equal(closure.nodeIds.includes(`test-${id}`), true);
    assert.equal(
      createAffectedImpactClosure([id]).proofUnitIds.includes("desen-app-invalid-publication"),
      true,
    );
  }
  for (const omitted of parents) {
    const changed = clone(graph);
    changed.entries.find(({ id }) => id === "desen-app-invalid-publication").prerequisites =
      parents.filter((id) => id !== omitted);
    assert.throws(() => validateAffectedImpactGraph(changed), AffectedImpactGraphError);
  }
});

test("last-known-good recovery has exactly its four reviewed product and durable-runtime parents", () => {
  const graph = createAffectedImpactGraph();
  const parents = [
    "desen-app-published-host-update",
    "desen-app-invalid-publication",
    "control-plane-runtime-recovery",
    "reference-host-web-channel-consumption",
  ];
  assert.deepEqual(
    graph.entries.find(({ id }) => id === "desen-app-last-known-good-recovery")?.prerequisites,
    parents,
  );
  const closure = createAffectedImpactClosure(["desen-app-last-known-good-recovery"]);
  assert.deepEqual(closure.ownerProofUnitIds, ["desen-app-last-known-good-recovery"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, DESEN_APP_CONNECTED_PROOF_UNITS.length);
  assert.equal(closure.workloadCount, 12 + DESEN_APP_CONNECTED_PROOF_UNITS.length * 2 + 2);
  assert.equal(
    closure.impactSha256,
    "44668f2786955ceb8cabc42e2aca6f92044aca9be2f4a4bba4c8066b066f8733",
  );
  for (const parent of parents) {
    assert.equal(
      createAffectedImpactClosure([parent]).proofUnitIds.includes(
        "desen-app-last-known-good-recovery",
      ),
      true,
    );
    const omitted = clone(graph);
    omitted.entries.find(({ id }) => id === "desen-app-last-known-good-recovery").prerequisites =
      parents.filter((id) => id !== parent);
    assert.throws(() => validateAffectedImpactGraph(omitted), AffectedImpactGraphError);
  }
  const circular = clone(graph);
  circular.entries
    .find(({ id }) => id === "desen-app-published-host-update")
    .prerequisites.push("desen-app-last-known-good-recovery");
  assert.throws(() => validateAffectedImpactGraph(circular), AffectedImpactGraphError);
});

test("repeatable demo includes its exact recovery, Integration, and independent-host parents", () => {
  const graph = createAffectedImpactGraph();
  const parents = [
    "desen-app-last-known-good-recovery",
    "desen-app-success-host-operation",
    "reference-host-web-source-audit",
  ];
  assert.deepEqual(
    graph.entries.find(({ id }) => id === "desen-app-repeatable-demo")?.prerequisites,
    parents,
  );
  const closure = createAffectedImpactClosure(["desen-app-repeatable-demo"]);
  assert.deepEqual(closure.ownerProofUnitIds, ["desen-app-repeatable-demo"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, DESEN_APP_CONNECTED_PROOF_UNITS.length);
  assert.equal(closure.workloadCount, 12 + DESEN_APP_CONNECTED_PROOF_UNITS.length * 2 + 2);
  assert.equal(
    closure.impactSha256,
    "bc091215852deca469ab071f079cc54e898ecd20235e4fc63fddbf387678e382",
  );
  for (const parent of parents) {
    assert.equal(
      createAffectedImpactClosure([parent]).proofUnitIds.includes("desen-app-repeatable-demo"),
      true,
    );
    const omitted = clone(graph);
    omitted.entries.find(({ id }) => id === "desen-app-repeatable-demo").prerequisites =
      parents.filter((id) => id !== parent);
    assert.throws(() => validateAffectedImpactGraph(omitted), AffectedImpactGraphError);
  }
  const cycle = clone(graph);
  cycle.entries
    .find(({ id }) => id === "desen-app-last-known-good-recovery")
    .prerequisites.push("desen-app-repeatable-demo");
  assert.throws(() => validateAffectedImpactGraph(cycle), AffectedImpactGraphError);
});

test("Runtime Core baseline has exactly its repeatable-demo predecessor and complete connected closure", () => {
  const graph = createAffectedImpactGraph();
  assert.equal(
    graph.impactGraphSha256,
    "0d127d443a4f9ae5114f203621855c6c1cbf936889d8883422e01ab6678df56f",
  );
  assert.deepEqual(graph.entries.find(({ id }) => id === "runtime-core-baseline")?.prerequisites, [
    "desen-app-repeatable-demo",
  ]);
  const closure = createAffectedImpactClosure(["runtime-core-baseline"]);
  assert.deepEqual(closure.ownerProofUnitIds, ["runtime-core-baseline"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, DESEN_APP_CONNECTED_PROOF_UNITS.length);
  assert.equal(closure.workloadCount, 12 + DESEN_APP_CONNECTED_PROOF_UNITS.length * 2 + 2);
  assert.equal(
    closure.impactSha256,
    "0192331e904c3b1ae3210dc78719c4f1ebf0a19479f823e63ff9b55644899f17",
  );
  assert.equal(closure.nodeIds.includes("verify-runtime-core-baseline"), true);
  assert.equal(closure.nodeIds.includes("test-runtime-core-baseline"), true);
  assert.equal(
    createAffectedImpactClosure(["desen-app-repeatable-demo"]).proofUnitIds.includes(
      "runtime-core-baseline",
    ),
    true,
  );
  for (const prerequisites of [[], ["desen-app-invalid-publication"], ["runtime-core-baseline"]]) {
    const changed = clone(graph);
    changed.entries.find(({ id }) => id === "runtime-core-baseline").prerequisites = prerequisites;
    assert.throws(() => validateAffectedImpactGraph(changed), AffectedImpactGraphError);
  }
  const cycle = clone(graph);
  cycle.entries
    .find(({ id }) => id === "desen-app-repeatable-demo")
    .prerequisites.push("runtime-core-baseline");
  assert.throws(() => validateAffectedImpactGraph(cycle), AffectedImpactGraphError);
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
  assert.equal(closure.nodeIds[7], "editor-web-public-package-contract");
  assert.equal(closure.workloadCount, 12 + closure.proofUnitCount * 2 + 2);
  assert.match(closure.impactSha256, /^[0-9a-f]{64}$/u);
});

test("independent proof units remain a strict subset", () => {
  const closure = createAffectedImpactClosure(["protocol-canonicalization"]);
  assert.deepEqual(closure.proofUnitIds, ["protocol-canonicalization"]);
  assert.equal(closure.workloadCount, 11);
});

test("the editor stable-ID insert closes over its Source predecessor and structural successor", () => {
  const closure = createAffectedImpactClosure(["editor-core-stable-id-insert"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.workloadCount, 12 + DESEN_APP_CONNECTED_PROOF_UNITS.length * 2 + 2);
});

test("the editor structural edits close over stable insertion and Source admission", () => {
  const closure = createAffectedImpactClosure(["editor-core-structural-edits"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.workloadCount, 12 + DESEN_APP_CONNECTED_PROOF_UNITS.length * 2 + 2);
});

test("editor content edits close over both immutable T02 and T03 prerequisites", () => {
  const closure = createAffectedImpactClosure(["editor-core-content-edits"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.workloadCount, 12 + DESEN_APP_CONNECTED_PROOF_UNITS.length * 2 + 2);
});

test("editor state/binding edits close over the formal T02 and current T04 graph", () => {
  const closure = createAffectedImpactClosure(["editor-core-state-binding-edits"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.workloadCount, 12 + DESEN_APP_CONNECTED_PROOF_UNITS.length * 2 + 2);
});

test("editor event/action edits close over the formal state/binding predecessor", () => {
  const closure = createAffectedImpactClosure(["editor-core-event-action-edits"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.workloadCount, 12 + DESEN_APP_CONNECTED_PROOF_UNITS.length * 2 + 2);
});

test("editor authoring round-trip closes over the formal event/action predecessor", () => {
  const closure = createAffectedImpactClosure(["editor-core-authoring-round-trip"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.workloadCount, 12 + DESEN_APP_CONNECTED_PROOF_UNITS.length * 2 + 2);
});

test("editor persistence closes over the complete neutral authoring predecessor", () => {
  const closure = createAffectedImpactClosure(["editor-core-persistence"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.workloadCount, 12 + DESEN_APP_CONNECTED_PROOF_UNITS.length * 2 + 2);
  assert.equal(closure.nodeIds.includes("editor-web-public-package-contract"), true);
});

test("continuous validation closes over T03-T07 without making persistence a formal parent", () => {
  const closure = createAffectedImpactClosure(["editor-core-continuous-validation"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.workloadCount, 12 + DESEN_APP_CONNECTED_PROOF_UNITS.length * 2 + 2);
  assert.equal(
    createAffectedImpactGraph()
      .entries.find(({ id }) => id === "editor-core-continuous-validation")
      .prerequisites.includes("editor-core-persistence"),
    false,
  );
  assert.equal(
    closure.impactSha256,
    "89fb53b727c4555d781d83f5574f427d718e8ded018ced96343e601c2f981ea7",
  );
});

test("terminal integration closes over all M08 predecessors and the frozen P-18 runtime proofs", () => {
  const closure = createAffectedImpactClosure(["editor-core-terminal-integration"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.workloadCount, 12 + DESEN_APP_CONNECTED_PROOF_UNITS.length * 2 + 2);
  assert.equal(closure.nodeIds.includes("editor-web-public-package-contract"), true);
  assert.equal(
    closure.impactSha256,
    "2ee98dfb34fe3cc03d4a98d9f6a48f72dda9d8555d12bd2152f5b9aaf68d01e7",
  );
});

test("Desen App shell navigation closes over its terminal parent and catalog-panel dependent", () => {
  const closure = createAffectedImpactClosure(["desen-app-shell-navigation"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitIds.includes("editor-core-terminal-integration"), true);
  assert.equal(closure.workloadCount, 12 + DESEN_APP_CONNECTED_PROOF_UNITS.length * 2 + 2);
  assert.equal(
    closure.impactSha256,
    "eeb9e1b33251837f041807c0d15c904912bad5b0d00af589d3ba53144f70e1d5",
  );
});

test("Desen App catalog panel closes over exact shell and Catalog parents", () => {
  const closure = createAffectedImpactClosure(["desen-app-catalog-panel-layer-tree"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.workloadCount, 12 + DESEN_APP_CONNECTED_PROOF_UNITS.length * 2 + 2);
  assert.equal(
    closure.impactSha256,
    "ba165ea7845dea6f6e2f2ed0fcb3aca04e0db29497412143170f7798df8c7aba",
  );
});

test("Desen App adapter canvas closes over exact shell and source-audit parents", () => {
  const closure = createAffectedImpactClosure(["desen-app-real-adapter-canvas"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, DESEN_APP_CONNECTED_PROOF_UNITS.length);
  assert.equal(closure.workloadCount, 12 + DESEN_APP_CONNECTED_PROOF_UNITS.length * 2 + 2);
  assert.equal(
    closure.impactSha256,
    "d9e9dda60820e4e98d0f9b9e603ed507ba316b6c93826c04086e8ea155d3f956",
  );
});

test("Desen App selection overlay closes over its exact adapter-canvas parent", () => {
  const closure = createAffectedImpactClosure(["desen-app-selection-overlay"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, DESEN_APP_CONNECTED_PROOF_UNITS.length);
  assert.equal(closure.workloadCount, 12 + DESEN_APP_CONNECTED_PROOF_UNITS.length * 2 + 2);
  assert.equal(
    closure.impactSha256,
    "095fa7bdfe37cbcacc66edab61af2c1cf0c5dc8750191e1d0936758f5eaace53",
  );
});

test("Desen App schema inspector closes over exact Catalog, selection, and Publisher parents", () => {
  const closure = createAffectedImpactClosure(["desen-app-schema-inspector"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, DESEN_APP_CONNECTED_PROOF_UNITS.length);
  assert.equal(closure.workloadCount, 12 + DESEN_APP_CONNECTED_PROOF_UNITS.length * 2 + 2);
  assert.match(closure.impactSha256, /^[0-9a-f]{64}$/u);
});

test("Desen App structured inspector closes over its exact schema-inspector parent", () => {
  const closure = createAffectedImpactClosure(["desen-app-structured-inspector"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, DESEN_APP_CONNECTED_PROOF_UNITS.length);
  assert.equal(closure.workloadCount, 12 + DESEN_APP_CONNECTED_PROOF_UNITS.length * 2 + 2);
  assert.match(closure.impactSha256, /^[0-9a-f]{64}$/u);
});

test("Desen App named-slot authoring closes over its exact structured-inspector parent", () => {
  const closure = createAffectedImpactClosure(["desen-app-named-slot-authoring"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, DESEN_APP_CONNECTED_PROOF_UNITS.length);
  assert.equal(closure.workloadCount, 12 + DESEN_APP_CONNECTED_PROOF_UNITS.length * 2 + 2);
  assert.equal(
    closure.impactSha256,
    "53ce62a7391f10bc0edff9f7f71459f9bc78fdc049d37fde7c170d51dec0a961",
  );
});

test("Desen App state-binding editor closes over exact App, Editor Core, and graph parents", () => {
  const closure = createAffectedImpactClosure(["desen-app-state-binding-editor"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, DESEN_APP_CONNECTED_PROOF_UNITS.length);
  assert.equal(closure.workloadCount, 12 + DESEN_APP_CONNECTED_PROOF_UNITS.length * 2 + 2);
  assert.equal(
    closure.impactSha256,
    "395d9ec627e1bceff403b355c249fe58568371d4103b27992332ff79604b3677",
  );
});

test("Desen App event/action editor closes over exact App and Editor Core parents", () => {
  const closure = createAffectedImpactClosure(["desen-app-event-action-editor"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, DESEN_APP_CONNECTED_PROOF_UNITS.length);
  assert.equal(closure.workloadCount, 12 + DESEN_APP_CONNECTED_PROOF_UNITS.length * 2 + 2);
  assert.equal(
    closure.impactSha256,
    "74b211a30a092a1a4766e32a9f0ae5b714a3199e71900ef72c71f2b26728bd58",
  );
});

test("Desen App Design/Run closes over the exact canvas, state, and action parents", () => {
  const closure = createAffectedImpactClosure(["desen-app-design-run-modes"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, DESEN_APP_CONNECTED_PROOF_UNITS.length);
  assert.equal(closure.workloadCount, 12 + DESEN_APP_CONNECTED_PROOF_UNITS.length * 2 + 2);
  assert.equal(
    closure.impactSha256,
    "56d8e32d4643536003d917cd6ff5a7a4c558ce67529fdf751635f8bc9a06f1e9",
  );
});

test("Desen App fixtures/scenarios closes over exact Design/Run, fixture, and parity parents", () => {
  const closure = createAffectedImpactClosure(["desen-app-fixtures-scenarios-fidelity"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, DESEN_APP_CONNECTED_PROOF_UNITS.length);
  assert.equal(closure.workloadCount, 12 + DESEN_APP_CONNECTED_PROOF_UNITS.length * 2 + 2);
  assert.equal(
    closure.impactSha256,
    "0f41b7b26e88bc9a56404af2cf24b572a0e4df911f34756f1b3ad192d704bc55",
  );
});

test("Desen App persistence closes over exact shell, Editor Core, and T11 parents", () => {
  const closure = createAffectedImpactClosure(["desen-app-source-persistence"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, DESEN_APP_CONNECTED_PROOF_UNITS.length);
  assert.equal(closure.workloadCount, 12 + DESEN_APP_CONNECTED_PROOF_UNITS.length * 2 + 2);
  assert.equal(closure.nodeIds.includes("verify-desen-app-shell-navigation"), true);
  assert.equal(closure.nodeIds.includes("verify-editor-core-persistence"), true);
  assert.equal(closure.nodeIds.includes("verify-desen-app-fixtures-scenarios-fidelity"), true);
  assert.equal(
    closure.impactSha256,
    "7fe3a5d95d9b9b4860589f3705d08d964ff3abb5b8cbe70c65b2fe3d27d44950",
  );
});

test("Desen App diagnostics closes over exact Runtime, Editor Core, and App authoring parents", () => {
  const closure = createAffectedImpactClosure(["desen-app-node-linked-diagnostics"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, DESEN_APP_CONNECTED_PROOF_UNITS.length);
  assert.equal(closure.workloadCount, 12 + DESEN_APP_CONNECTED_PROOF_UNITS.length * 2 + 2);
  assert.equal(closure.nodeIds.includes("verify-runtime-react-reconciliation-diagnostics"), true);
  assert.equal(closure.nodeIds.includes("verify-editor-core-continuous-validation"), true);
  assert.equal(closure.nodeIds.includes("verify-desen-app-source-persistence"), true);
  assert.equal(
    closure.impactSha256,
    "e0ded56dd17f21447f40d65f7a9ba3e61b4e5ddd32f362266c3031635cb44c8c",
  );
});

test("Desen App publication closes over exact App, Publisher, control-plane, and host parents", () => {
  const closure = createAffectedImpactClosure(["desen-app-publish-activation"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, DESEN_APP_CONNECTED_PROOF_UNITS.length);
  assert.equal(closure.workloadCount, 12 + DESEN_APP_CONNECTED_PROOF_UNITS.length * 2 + 2);
  for (const proofId of [
    "desen-app-design-run-modes",
    "desen-app-fixtures-scenarios-fidelity",
    "desen-app-source-persistence",
    "desen-app-node-linked-diagnostics",
    "publisher-bundle-publication",
    "publisher-official-golden",
    "control-plane-local-api",
    "reference-host-web-channel-consumption",
  ]) {
    assert.equal(closure.nodeIds.includes(`verify-${proofId}`), true);
  }
  assert.equal(
    closure.impactSha256,
    "3cb643fc08968668a319a0fafcbc7355c4a90f8c9f970ba63f282780b9ce25a9",
  );
});

test("Desen App empty-project browser E2E closes over the published authoring surface", () => {
  const closure = createAffectedImpactClosure(["desen-app-empty-project-browser-e2e"]);
  assert.deepEqual(closure.ownerProofUnitIds, ["desen-app-empty-project-browser-e2e"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, DESEN_APP_CONNECTED_PROOF_UNITS.length);
  assert.equal(closure.workloadCount, 12 + DESEN_APP_CONNECTED_PROOF_UNITS.length * 2 + 2);
  assert.equal(closure.nodeIds.includes("verify-desen-app-publish-activation"), true);
  assert.equal(
    closure.impactSha256,
    "1f6eca061448af3447924274882029b21277e71b3bc9bd1c920a63a67058ae72",
  );
});

test("Desen App Browser E2E workspace compatibility closes over the historical browser proof", () => {
  const closure = createAffectedImpactClosure(["desen-app-browser-e2e-workspace-compatibility"]);
  assert.deepEqual(closure.ownerProofUnitIds, ["desen-app-browser-e2e-workspace-compatibility"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, DESEN_APP_CONNECTED_PROOF_UNITS.length);
  assert.equal(closure.workloadCount, 12 + DESEN_APP_CONNECTED_PROOF_UNITS.length * 2 + 2);
  assert.equal(closure.nodeIds.includes("verify-desen-app-empty-project-browser-e2e"), true);
  assert.equal(
    closure.impactSha256,
    "b3938540966daeca4b72a86f95e57e618ccefe182701b06fef523b67e1abc86d",
  );
});

test("Desen App user-created blank project closes over the immutable Browser E2E proofs", () => {
  const closure = createAffectedImpactClosure(["desen-app-user-created-blank-project"]);
  assert.deepEqual(closure.ownerProofUnitIds, ["desen-app-user-created-blank-project"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, DESEN_APP_CONNECTED_PROOF_UNITS.length);
  assert.equal(closure.workloadCount, 12 + DESEN_APP_CONNECTED_PROOF_UNITS.length * 2 + 2);
  assert.equal(
    closure.nodeIds.includes("verify-desen-app-browser-e2e-workspace-compatibility"),
    true,
  );
  assert.equal(
    closure.impactSha256,
    "3ad7f5cd37ce4707965015118b96fc60e645fb03b8c625b7f22449c7367c7148",
  );
});

test("Desen App visual behavior authoring closes over the blank-project predecessor", () => {
  const closure = createAffectedImpactClosure(["desen-app-visual-behavior-authoring"]);
  assert.deepEqual(closure.ownerProofUnitIds, ["desen-app-visual-behavior-authoring"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, DESEN_APP_CONNECTED_PROOF_UNITS.length);
  assert.equal(closure.workloadCount, 12 + DESEN_APP_CONNECTED_PROOF_UNITS.length * 2 + 2);
  assert.equal(closure.nodeIds.includes("verify-desen-app-user-created-blank-project"), true);
  assert.equal(
    closure.impactSha256,
    "dfc0c3227163a30612c95bed6e1e820e77f3139fe3ff783e3591afbf4797625a",
  );
});

test("Desen App evergreen composition closes over the visual-behavior predecessor", () => {
  const closure = createAffectedImpactClosure(["desen-app-evergreen-product-composition"]);
  assert.deepEqual(closure.ownerProofUnitIds, ["desen-app-evergreen-product-composition"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, DESEN_APP_CONNECTED_PROOF_UNITS.length);
  assert.equal(closure.workloadCount, 12 + DESEN_APP_CONNECTED_PROOF_UNITS.length * 2 + 2);
  assert.equal(closure.nodeIds.includes("verify-desen-app-visual-behavior-authoring"), true);
  assert.equal(
    closure.impactSha256,
    "d2c698fcd780852eff27c6d873bf5199e95ce35af8ad13169640300660d53145",
  );
});

test("Desen App input/pending fixture closes over the evergreen composition predecessor", () => {
  const closure = createAffectedImpactClosure(["desen-app-input-pending-fixture"]);
  assert.deepEqual(closure.ownerProofUnitIds, ["desen-app-input-pending-fixture"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, DESEN_APP_CONNECTED_PROOF_UNITS.length);
  assert.equal(closure.workloadCount, 12 + DESEN_APP_CONNECTED_PROOF_UNITS.length * 2 + 2);
  assert.equal(closure.nodeIds.includes("verify-desen-app-evergreen-product-composition"), true);
  assert.equal(
    closure.impactSha256,
    "897bda0dfb6e8264eba83a4c86787295fe33cf981fa9fa4ccd4576c6dd7ae644",
  );
});

test("Desen App failure fixture closes over the input/pending predecessor", () => {
  const closure = createAffectedImpactClosure(["desen-app-failure-fixture"]);
  assert.deepEqual(closure.ownerProofUnitIds, ["desen-app-failure-fixture"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, DESEN_APP_CONNECTED_PROOF_UNITS.length);
  assert.equal(closure.workloadCount, 12 + DESEN_APP_CONNECTED_PROOF_UNITS.length * 2 + 2);
  assert.equal(closure.nodeIds.includes("verify-desen-app-input-pending-fixture"), true);
  assert.equal(
    closure.impactSha256,
    "fa987521d4641184022a49f32b748dfff589f8e09c31fe4ae4ad6702b2bc42f7",
  );
});

test("Desen App success and real-host operation closes over both historical and executable authority", () => {
  const closure = createAffectedImpactClosure(["desen-app-success-host-operation"]);
  assert.deepEqual(closure.ownerProofUnitIds, ["desen-app-success-host-operation"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, DESEN_APP_CONNECTED_PROOF_UNITS.length);
  assert.equal(closure.workloadCount, 12 + DESEN_APP_CONNECTED_PROOF_UNITS.length * 2 + 2);
  for (const id of ["desen-app-failure-fixture", "reference-sign-in-fixtures-and-host-binding"]) {
    assert.equal(closure.nodeIds.includes(`verify-${id}`), true);
    assert.equal(closure.nodeIds.includes(`test-${id}`), true);
  }
  assert.equal(
    closure.impactSha256,
    "64e1ce3eb7aef7ca0108d68785302b165406636a4758fda9cbeed32c2ea8a02a",
  );
  const missingBinding = clone(createAffectedImpactGraph());
  missingBinding.entries
    .find(({ id }) => id === "desen-app-success-host-operation")
    .prerequisites.pop();
  assert.throws(() => validateAffectedImpactGraph(missingBinding), AffectedImpactGraphError);
});

test("Desen App published-host update closes over exact T04, publication, host, and canvas parents", () => {
  const closure = createAffectedImpactClosure(["desen-app-published-host-update"]);
  assert.deepEqual(closure.ownerProofUnitIds, ["desen-app-published-host-update"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, DESEN_APP_CONNECTED_PROOF_UNITS.length);
  assert.equal(closure.workloadCount, 12 + DESEN_APP_CONNECTED_PROOF_UNITS.length * 2 + 2);
  for (const id of [
    "desen-app-success-host-operation",
    "desen-app-publish-activation",
    "reference-host-web-source-audit",
    "desen-app-real-adapter-canvas",
  ]) {
    assert.equal(closure.nodeIds.includes(`verify-${id}`), true);
    assert.equal(closure.nodeIds.includes(`test-${id}`), true);
  }
  assert.equal(
    closure.impactSha256,
    "ef93fc1a489e4ad375104a1ed180441602f2843cf88c1f2ed61fa4c6a6223a67",
  );
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
