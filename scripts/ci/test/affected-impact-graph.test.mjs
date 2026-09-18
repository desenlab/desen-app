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
  "m10a-t09",
  "m10a-t12",
]);

function clone(value) {
  return structuredClone(value);
}

test("the reviewed impact graph owns every proof unit exactly once", () => {
  const graph = createAffectedImpactGraph();
  assert.equal(graph.proofUnitCount, 121);
  assert.equal(new Set(graph.entries.map(({ id }) => id)).size, 121);
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
  assert.deepEqual(graph.entries.find(({ id }) => id === "m10a-t09")?.prerequisites, [
    "m10a-t05",
    "m10a-t08",
  ]);
  assert.deepEqual(graph.entries.find(({ id }) => id === "m10a-t12")?.prerequisites, [
    "m10a-t03",
    "m10a-t09",
  ]);
  assert.equal(validateAffectedImpactGraph(graph), graph);
  assert.equal(Object.isFrozen(graph), true);
  assert.equal(Object.isFrozen(graph.entries), true);
});

test("M10A-T12 extends the closed M10A chain without weakening its historical closure", () => {
  const historical = createAffectedImpactClosure(["historical-archive-redaction"]);
  assert.equal(historical.proofUnitCount, 88);
  assert.equal(historical.workloadCount, 190);
  assert.equal(historical.proofUnitIds.includes("m10-gate"), true);
  assert.equal(historical.proofUnitIds.includes("m10a-t01"), true);
  assert.equal(historical.proofUnitIds.includes("m10a-t02"), true);
  assert.equal(historical.proofUnitIds.includes("m10a-t03"), true);
  assert.equal(historical.proofUnitIds.includes("m10a-t04"), true);
  assert.equal(historical.proofUnitIds.includes("m10a-t05"), true);
  assert.equal(historical.proofUnitIds.includes("m10a-t06"), true);
  assert.equal(historical.proofUnitIds.includes("m10a-t07"), true);
  assert.equal(historical.proofUnitIds.includes("m10a-t08"), true);
  assert.equal(historical.proofUnitIds.includes("m10a-t09"), true);
  assert.equal(historical.proofUnitIds.includes("m10a-t12"), true);
  assert.equal(
    historical.impactSha256,
    "9f49a7f99fd05a289935c05289785faa45819a9647024272ae32a803c0c76aa2",
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
  assert.equal(successor.nodeIds.includes("verify-m10a-t09"), true);
  assert.equal(successor.nodeIds.includes("verify-m10a-t12"), true);
  assert.equal(
    successor.impactSha256,
    "1305b9f4b6e72caaf96111714b18bc0269751c0dbf0348bcd16746e7f7347fdf",
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
    "a6eb1b5575b14b469dd24b053df33a2f4438478eb9ae429cf961808bd004de39",
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
    "0a1ed50b364153cbac89678b4611fb16d30755cf253c496c2c364a1c751126ca",
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
    "84bf852ff279bcaaf8cf283441144e16cf7f592a4c077f52717a0c7d714105c5",
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
    "98b7c102727998744a86a74ac99005b8ce40f83c8a9c98f5223c71893249b1db",
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
    "6f9807a46596fe5b297f4739bccc828c873ea46e8dbf711f186d538510e1ed6c",
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
    "b0a1b0bee6194dbe2b1b5b29840ddca1e5d3c58b5a8921f1b1a085b9c14ad37f",
  );
});

test("terminal integration closes over all M08 predecessors and the frozen P-18 runtime proofs", () => {
  const closure = createAffectedImpactClosure(["editor-core-terminal-integration"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.workloadCount, 12 + DESEN_APP_CONNECTED_PROOF_UNITS.length * 2 + 2);
  assert.equal(closure.nodeIds.includes("editor-web-public-package-contract"), true);
  assert.equal(
    closure.impactSha256,
    "5e825b69189b22cdf0d61f8cded22c93987fe04ee2e38d3e745f9eb04fd42cd6",
  );
});

test("Desen App shell navigation closes over its terminal parent and catalog-panel dependent", () => {
  const closure = createAffectedImpactClosure(["desen-app-shell-navigation"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitIds.includes("editor-core-terminal-integration"), true);
  assert.equal(closure.workloadCount, 12 + DESEN_APP_CONNECTED_PROOF_UNITS.length * 2 + 2);
  assert.equal(
    closure.impactSha256,
    "27bbc177a869fa2f7a305cb43ff80ea96e063cc9482cce69283eecad11ef5228",
  );
});

test("Desen App catalog panel closes over exact shell and Catalog parents", () => {
  const closure = createAffectedImpactClosure(["desen-app-catalog-panel-layer-tree"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.workloadCount, 12 + DESEN_APP_CONNECTED_PROOF_UNITS.length * 2 + 2);
  assert.equal(
    closure.impactSha256,
    "b294a10089a9252c1e9e779a058c473f25fd2483ffd645ab9030ab7e15e7fdc3",
  );
});

test("Desen App adapter canvas closes over exact shell and source-audit parents", () => {
  const closure = createAffectedImpactClosure(["desen-app-real-adapter-canvas"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, DESEN_APP_CONNECTED_PROOF_UNITS.length);
  assert.equal(closure.workloadCount, 12 + DESEN_APP_CONNECTED_PROOF_UNITS.length * 2 + 2);
  assert.equal(
    closure.impactSha256,
    "b7364557931fe888890a3c5040abe92813abc6f52ef8a53c2249964ed10043fe",
  );
});

test("Desen App selection overlay closes over its exact adapter-canvas parent", () => {
  const closure = createAffectedImpactClosure(["desen-app-selection-overlay"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, DESEN_APP_CONNECTED_PROOF_UNITS.length);
  assert.equal(closure.workloadCount, 12 + DESEN_APP_CONNECTED_PROOF_UNITS.length * 2 + 2);
  assert.equal(
    closure.impactSha256,
    "6513d9ed3146c1bbfb1ddbdc3676581403cbf3b8ada7c5adcdf7867bb1ea6098",
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
    "a3be5e515b44f888e89354709a4f9b9d7836bb22302c3f669b046f7e607df255",
  );
});

test("Desen App state-binding editor closes over exact App, Editor Core, and graph parents", () => {
  const closure = createAffectedImpactClosure(["desen-app-state-binding-editor"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, DESEN_APP_CONNECTED_PROOF_UNITS.length);
  assert.equal(closure.workloadCount, 12 + DESEN_APP_CONNECTED_PROOF_UNITS.length * 2 + 2);
  assert.equal(
    closure.impactSha256,
    "8c3cab21d2fcd8cb5fe2b080cc4da531826e9b8b6dedb656d72c6a9dde0478a3",
  );
});

test("Desen App event/action editor closes over exact App and Editor Core parents", () => {
  const closure = createAffectedImpactClosure(["desen-app-event-action-editor"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, DESEN_APP_CONNECTED_PROOF_UNITS.length);
  assert.equal(closure.workloadCount, 12 + DESEN_APP_CONNECTED_PROOF_UNITS.length * 2 + 2);
  assert.equal(
    closure.impactSha256,
    "2b2e7568d66b8d7fe2944355faf8f107f3fa61ac97b87749f57fd855932fb08d",
  );
});

test("Desen App Design/Run closes over the exact canvas, state, and action parents", () => {
  const closure = createAffectedImpactClosure(["desen-app-design-run-modes"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, DESEN_APP_CONNECTED_PROOF_UNITS.length);
  assert.equal(closure.workloadCount, 12 + DESEN_APP_CONNECTED_PROOF_UNITS.length * 2 + 2);
  assert.equal(
    closure.impactSha256,
    "3c8b5e42f025fdae7c72f40b0e2576786e3659885f4b55d2d403ba46c3287735",
  );
});

test("Desen App fixtures/scenarios closes over exact Design/Run, fixture, and parity parents", () => {
  const closure = createAffectedImpactClosure(["desen-app-fixtures-scenarios-fidelity"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, DESEN_APP_CONNECTED_PROOF_UNITS.length);
  assert.equal(closure.workloadCount, 12 + DESEN_APP_CONNECTED_PROOF_UNITS.length * 2 + 2);
  assert.equal(
    closure.impactSha256,
    "ca0b34d885be883a0ff864934d3a0e31d42c176eb669202e0d4dcbaa50dd415e",
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
    "c71e0e8f6fe9f7e2aceed020c465ddf59fae219ce2beeb6f841aee3b8565c4dc",
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
    "1f46a4605446a9d9aa6cdb60a144587eedf6af555a759cae93054d8b4d1d1255",
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
    "be0152735a7c6f964c47150397c771db014d1cc21e272c039a7e4e3b776c4802",
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
    "c14828dc1b1dc90026dda0f2c1b44693a758b2bc87cf4b37cd60b51272119f05",
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
    "bfb395886fda17996b46f7995d108bd72375c6243ebe98b241f383497e6215db",
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
    "6b8005d09e289a165247afc1256619cd63ada4dacef1a5acc9a66655ee0247d3",
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
    "6fd73745f958d323a3ac502cc1da2a05bcdeaadabd88a445c71fa6c8885e28dc",
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
    "8ebc63cd6ca555bcbe982f48b8746c396eb957af8c249d3ac6f31c9916ef9d08",
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
    "1662c6e89bc17297a61b10afe5f29edbc674e4614561e48c33d86cf0d49702a1",
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
    "815a59c0b7775e3ae92b062d7a83d2815f02d7cbc029c04d5bf64451bd05cad9",
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
    "c36aa370ddf611fbb9194e972cf7a3f13694d6269730f5a3e22a6f8116830afc",
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
    "3172787d66aee447a2f9909df0cbc35f2dd2ede3a16709a53db39554ca6b7bec",
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
