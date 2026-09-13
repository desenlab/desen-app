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
]);

function clone(value) {
  return structuredClone(value);
}

test("the reviewed impact graph owns every proof unit exactly once", () => {
  const graph = createAffectedImpactGraph();
  assert.equal(graph.proofUnitCount, 116);
  assert.equal(new Set(graph.entries.map(({ id }) => id)).size, 116);
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
  assert.equal(validateAffectedImpactGraph(graph), graph);
  assert.equal(Object.isFrozen(graph), true);
  assert.equal(Object.isFrozen(graph.entries), true);
});

test("M10A-T06 extends the closed M10A chain without weakening its historical closure", () => {
  const historical = createAffectedImpactClosure(["historical-archive-redaction"]);
  assert.equal(historical.proofUnitCount, 84);
  assert.equal(historical.workloadCount, 182);
  assert.equal(historical.proofUnitIds.includes("m10-gate"), true);
  assert.equal(historical.proofUnitIds.includes("m10a-t01"), true);
  assert.equal(historical.proofUnitIds.includes("m10a-t02"), true);
  assert.equal(historical.proofUnitIds.includes("m10a-t03"), true);
  assert.equal(historical.proofUnitIds.includes("m10a-t04"), true);
  assert.equal(historical.proofUnitIds.includes("m10a-t05"), true);
  assert.equal(historical.proofUnitIds.includes("m10a-t06"), true);
  assert.equal(
    historical.impactSha256,
    "c08457906c21ceb2ff88240d0ed584acccfb1068963705676baeca3b036483c4",
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
  assert.equal(
    successor.impactSha256,
    "49f9ce97ed93f302dbf42d37040b721c7d43671a7242230a2c4105e4db6ae92a",
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
    "cd562b9d1377147fedb85a79b03c2596463a6a07960a015350542499d1e4009c",
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
    "d36ff36172f0c973eab2d0a5f42778a90051bc8002e61ba5af2237a8964afc12",
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
    "82cec18fcaf5adbed9ca33d3b0865d044bc9fa706ce073060d027a145d1b9179",
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
    "fe4800e59fb8a0b6c2d968df7f72cbbda3e17845445c3a9e0815d18ae7c0a669",
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
    "2f974e810c6466967e52cdf601aceee5e7845b354d7da47511be95062bafb58b",
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
    "d6f38893525f91dd692f8b4c7ba9a1b82564c05b51c8903add8be938c7f72dd8",
  );
});

test("terminal integration closes over all M08 predecessors and the frozen P-18 runtime proofs", () => {
  const closure = createAffectedImpactClosure(["editor-core-terminal-integration"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.workloadCount, 12 + DESEN_APP_CONNECTED_PROOF_UNITS.length * 2 + 2);
  assert.equal(closure.nodeIds.includes("editor-web-public-package-contract"), true);
  assert.equal(
    closure.impactSha256,
    "af2f456170530564c1c9c5c82454ba8d367989dd7608e3f827b1a436919e7fdf",
  );
});

test("Desen App shell navigation closes over its terminal parent and catalog-panel dependent", () => {
  const closure = createAffectedImpactClosure(["desen-app-shell-navigation"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitIds.includes("editor-core-terminal-integration"), true);
  assert.equal(closure.workloadCount, 12 + DESEN_APP_CONNECTED_PROOF_UNITS.length * 2 + 2);
  assert.equal(
    closure.impactSha256,
    "1d5d07a5728f2f90f5dbc86f6518a95a9b13d3c5e17f9aa9d524d66c9ca11aa2",
  );
});

test("Desen App catalog panel closes over exact shell and Catalog parents", () => {
  const closure = createAffectedImpactClosure(["desen-app-catalog-panel-layer-tree"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.workloadCount, 12 + DESEN_APP_CONNECTED_PROOF_UNITS.length * 2 + 2);
  assert.equal(
    closure.impactSha256,
    "c80c86ee37c66c040f778b545cfa75a01ecccae31c2870c6b545b991fddd76d9",
  );
});

test("Desen App adapter canvas closes over exact shell and source-audit parents", () => {
  const closure = createAffectedImpactClosure(["desen-app-real-adapter-canvas"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, DESEN_APP_CONNECTED_PROOF_UNITS.length);
  assert.equal(closure.workloadCount, 12 + DESEN_APP_CONNECTED_PROOF_UNITS.length * 2 + 2);
  assert.equal(
    closure.impactSha256,
    "b93e4203e12242fbba05b06e739ddca774caf8cb88ba68b3bfdac8c3ceebfe0c",
  );
});

test("Desen App selection overlay closes over its exact adapter-canvas parent", () => {
  const closure = createAffectedImpactClosure(["desen-app-selection-overlay"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, DESEN_APP_CONNECTED_PROOF_UNITS.length);
  assert.equal(closure.workloadCount, 12 + DESEN_APP_CONNECTED_PROOF_UNITS.length * 2 + 2);
  assert.equal(
    closure.impactSha256,
    "de28a09f6d637464f1f0268e5319089b6d1870cc8866cad9e4c9fc3e237099c7",
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
    "9658bdbd6a3f165d245a35511e6245708405bcf6cb72cf05c9a693df3f886c29",
  );
});

test("Desen App state-binding editor closes over exact App, Editor Core, and graph parents", () => {
  const closure = createAffectedImpactClosure(["desen-app-state-binding-editor"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, DESEN_APP_CONNECTED_PROOF_UNITS.length);
  assert.equal(closure.workloadCount, 12 + DESEN_APP_CONNECTED_PROOF_UNITS.length * 2 + 2);
  assert.equal(
    closure.impactSha256,
    "388d212d540e81f846ba5c9673cdcc023db547e230f16c0a1fd9fa7dff11c0a9",
  );
});

test("Desen App event/action editor closes over exact App and Editor Core parents", () => {
  const closure = createAffectedImpactClosure(["desen-app-event-action-editor"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, DESEN_APP_CONNECTED_PROOF_UNITS.length);
  assert.equal(closure.workloadCount, 12 + DESEN_APP_CONNECTED_PROOF_UNITS.length * 2 + 2);
  assert.equal(
    closure.impactSha256,
    "0f38977b1a77e4663b21425bbc08ec1c367c2319b831c608eb126ef4202b4573",
  );
});

test("Desen App Design/Run closes over the exact canvas, state, and action parents", () => {
  const closure = createAffectedImpactClosure(["desen-app-design-run-modes"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, DESEN_APP_CONNECTED_PROOF_UNITS.length);
  assert.equal(closure.workloadCount, 12 + DESEN_APP_CONNECTED_PROOF_UNITS.length * 2 + 2);
  assert.equal(
    closure.impactSha256,
    "16a12b51c687cb6eddbee6771c17b54f3583a564088a4821db910d409a2b2356",
  );
});

test("Desen App fixtures/scenarios closes over exact Design/Run, fixture, and parity parents", () => {
  const closure = createAffectedImpactClosure(["desen-app-fixtures-scenarios-fidelity"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, DESEN_APP_CONNECTED_PROOF_UNITS.length);
  assert.equal(closure.workloadCount, 12 + DESEN_APP_CONNECTED_PROOF_UNITS.length * 2 + 2);
  assert.equal(
    closure.impactSha256,
    "b9d43cd2fa04509ad874e434b7b3c4a0b13f1219aa8106ca6810a596d3a62dc3",
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
    "10a889bfa62ed5a4b415c003574661d7681a53a9883fab32acaaf8a6b46ec5e1",
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
    "9074bad488dc6dadca2a74aa09428d02faf8649917df63befc1e28c5010fe97a",
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
    "680d21af587da6be7a20ce5247d6d909e89a765b997b5c46e4c9cc8912118ebe",
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
    "ae97a3f111b4bbe6f0c5c3e7a9ee8bcc310894dee650da40f29c76f47b887243",
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
    "08f68d7a9775eb5883cb87cdb86d7e90969faabbcf9491b8a0075f4e75a94ecf",
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
    "341f278ff86568862e6a5b6a44973a861585a9062c3b535425ee00448b515e80",
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
    "dcd1eb429c9e1a6ea4ff2d1e411d9a16d0d7ea2dd5f7ef07eea9df0d2b9f5fd8",
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
    "9ca386fb0f96782fd65b5b3c69a0381403b9dee70761e3a1d795afce55093805",
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
    "0182b2be6cb54f9086987d5a5318aa7f1a24f8197c77d0f1df889582c2231c2d",
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
    "a004485ebffb221b5d8a3da3a51a9724a3257b82baf8c6f69aef3c9a64755bd4",
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
    "0ad602abb497e0a29e183a274377465b89284511c062cfbb58b12e9fcf5453ee",
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
    "71d3687996e65dfd8c8c368ad7203f5c945924e0603127e582f250dcb72fd6c1",
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
