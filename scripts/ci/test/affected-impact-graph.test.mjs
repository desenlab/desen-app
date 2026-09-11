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
]);

function clone(value) {
  return structuredClone(value);
}

test("the reviewed impact graph owns every proof unit exactly once", () => {
  const graph = createAffectedImpactGraph();
  assert.equal(graph.proofUnitCount, 113);
  assert.equal(new Set(graph.entries.map(({ id }) => id)).size, 113);
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
  assert.equal(validateAffectedImpactGraph(graph), graph);
  assert.equal(Object.isFrozen(graph), true);
  assert.equal(Object.isFrozen(graph.entries), true);
});

test("M10A-T03 extends the closed M10A chain without weakening its historical closure", () => {
  const historical = createAffectedImpactClosure(["historical-archive-redaction"]);
  assert.equal(historical.proofUnitCount, 81);
  assert.equal(historical.workloadCount, 174);
  assert.equal(historical.proofUnitIds.includes("m10-gate"), true);
  assert.equal(historical.proofUnitIds.includes("m10a-t01"), true);
  assert.equal(historical.proofUnitIds.includes("m10a-t02"), true);
  assert.equal(historical.proofUnitIds.includes("m10a-t03"), true);
  assert.equal(
    historical.impactSha256,
    "7cb0b84b4f6accfa110b8595fd7abaf619ce8bcb59127380693da3ae3e17c870",
  );

  const successor = createAffectedImpactClosure(["m10a-t01"]);
  assert.deepEqual(successor.ownerProofUnitIds, ["m10a-t01"]);
  assert.deepEqual(successor.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(successor.nodeIds.includes("verify-m10-gate"), true);
  assert.equal(successor.nodeIds.includes("test-m10-gate"), true);
  assert.equal(successor.nodeIds.includes("verify-m10a-t02"), true);
  assert.equal(successor.nodeIds.includes("verify-m10a-t03"), true);
  assert.equal(
    successor.impactSha256,
    "ccb3f2a30d9f8e8dd650f23eeb7ddf86142df50863a2efc46ba53e76b07d133a",
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
    "f4c444f93d2dcd5866ebdb1a95d167be6b3588367ca323f04ba861802afb60a3",
  );
  assert.equal(closure.proofUnitCount, 81);
  assert.equal(closure.workloadCount, 174);
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
  assert.equal(closure.proofUnitCount, 81);
  assert.equal(closure.workloadCount, 174);
  assert.equal(
    closure.impactSha256,
    "54bebcf0818b652e9c6ced467906d76e080a55484a35789c434b8f6b6cfcb813",
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
  assert.equal(closure.proofUnitCount, 81);
  assert.equal(closure.workloadCount, 174);
  assert.equal(
    closure.impactSha256,
    "400c28205f9a39dc5153de5a80b7423a16b84e200852b31d00f7d8e46a59362e",
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
    "acd57a05649d9aa37823c83e1a6aa6df9ecc1eaa137fa157ac58010ba4d58553",
  );
  assert.deepEqual(graph.entries.find(({ id }) => id === "runtime-core-baseline")?.prerequisites, [
    "desen-app-repeatable-demo",
  ]);
  const closure = createAffectedImpactClosure(["runtime-core-baseline"]);
  assert.deepEqual(closure.ownerProofUnitIds, ["runtime-core-baseline"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, 81);
  assert.equal(closure.workloadCount, 174);
  assert.equal(
    closure.impactSha256,
    "1e8e97f9ed8dd99dff1b195b414bc4f34a40aa8a5eed39de48726c5456aa5b88",
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
  assert.equal(closure.workloadCount, 10 + closure.proofUnitCount * 2 + 2);
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
  assert.equal(closure.workloadCount, 174);
});

test("the editor structural edits close over stable insertion and Source admission", () => {
  const closure = createAffectedImpactClosure(["editor-core-structural-edits"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.workloadCount, 174);
});

test("editor content edits close over both immutable T02 and T03 prerequisites", () => {
  const closure = createAffectedImpactClosure(["editor-core-content-edits"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.workloadCount, 174);
});

test("editor state/binding edits close over the formal T02 and current T04 graph", () => {
  const closure = createAffectedImpactClosure(["editor-core-state-binding-edits"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.workloadCount, 174);
});

test("editor event/action edits close over the formal state/binding predecessor", () => {
  const closure = createAffectedImpactClosure(["editor-core-event-action-edits"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.workloadCount, 174);
});

test("editor authoring round-trip closes over the formal event/action predecessor", () => {
  const closure = createAffectedImpactClosure(["editor-core-authoring-round-trip"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.workloadCount, 174);
});

test("editor persistence closes over the complete neutral authoring predecessor", () => {
  const closure = createAffectedImpactClosure(["editor-core-persistence"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.workloadCount, 174);
  assert.equal(closure.nodeIds.includes("editor-web-public-package-contract"), true);
});

test("continuous validation closes over T03-T07 without making persistence a formal parent", () => {
  const closure = createAffectedImpactClosure(["editor-core-continuous-validation"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.workloadCount, 174);
  assert.equal(
    createAffectedImpactGraph()
      .entries.find(({ id }) => id === "editor-core-continuous-validation")
      .prerequisites.includes("editor-core-persistence"),
    false,
  );
  assert.equal(
    closure.impactSha256,
    "83b4d5ca2126d715096584f8630da9e8b02560a9b286e294c479a2887254856d",
  );
});

test("terminal integration closes over all M08 predecessors and the frozen P-18 runtime proofs", () => {
  const closure = createAffectedImpactClosure(["editor-core-terminal-integration"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.workloadCount, 174);
  assert.equal(closure.nodeIds.includes("editor-web-public-package-contract"), true);
  assert.equal(
    closure.impactSha256,
    "ae0c3e0f60928b8908d9addae31708317826b2c54126a68c101c77bcef2aa87a",
  );
});

test("Desen App shell navigation closes over its terminal parent and catalog-panel dependent", () => {
  const closure = createAffectedImpactClosure(["desen-app-shell-navigation"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitIds.includes("editor-core-terminal-integration"), true);
  assert.equal(closure.workloadCount, 174);
  assert.equal(
    closure.impactSha256,
    "39be592a067d63ac32a00c2cfdc316e78df1b034388721981e9b50f51d4733a3",
  );
});

test("Desen App catalog panel closes over exact shell and Catalog parents", () => {
  const closure = createAffectedImpactClosure(["desen-app-catalog-panel-layer-tree"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.workloadCount, 174);
  assert.equal(
    closure.impactSha256,
    "f6f6c9d51fe9a0eb4294cbec1293a7d7ec7d1d21f231e880c182875ee4983ac0",
  );
});

test("Desen App adapter canvas closes over exact shell and source-audit parents", () => {
  const closure = createAffectedImpactClosure(["desen-app-real-adapter-canvas"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, 81);
  assert.equal(closure.workloadCount, 174);
  assert.equal(
    closure.impactSha256,
    "27309a49434eefefc471608fc725b45e7c51d80f1437aad82d9cb71a759c18ba",
  );
});

test("Desen App selection overlay closes over its exact adapter-canvas parent", () => {
  const closure = createAffectedImpactClosure(["desen-app-selection-overlay"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, 81);
  assert.equal(closure.workloadCount, 174);
  assert.equal(
    closure.impactSha256,
    "e1f505e66cf5b56c2df5b6c841d91626eb82157c8bbea56f1180afa30f294507",
  );
});

test("Desen App schema inspector closes over exact Catalog, selection, and Publisher parents", () => {
  const closure = createAffectedImpactClosure(["desen-app-schema-inspector"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, 81);
  assert.equal(closure.workloadCount, 174);
  assert.match(closure.impactSha256, /^[0-9a-f]{64}$/u);
});

test("Desen App structured inspector closes over its exact schema-inspector parent", () => {
  const closure = createAffectedImpactClosure(["desen-app-structured-inspector"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, 81);
  assert.equal(closure.workloadCount, 174);
  assert.match(closure.impactSha256, /^[0-9a-f]{64}$/u);
});

test("Desen App named-slot authoring closes over its exact structured-inspector parent", () => {
  const closure = createAffectedImpactClosure(["desen-app-named-slot-authoring"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, 81);
  assert.equal(closure.workloadCount, 174);
  assert.equal(
    closure.impactSha256,
    "ca2260aeb53278e6f3b9d0ac25ee9aea67ca53c1c56c643b1b55e4c64d557011",
  );
});

test("Desen App state-binding editor closes over exact App, Editor Core, and graph parents", () => {
  const closure = createAffectedImpactClosure(["desen-app-state-binding-editor"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, 81);
  assert.equal(closure.workloadCount, 174);
  assert.equal(
    closure.impactSha256,
    "90e4d13d2882b225677fb5d52d0d3743ab572eeeaba0599afef0760f0b0f801f",
  );
});

test("Desen App event/action editor closes over exact App and Editor Core parents", () => {
  const closure = createAffectedImpactClosure(["desen-app-event-action-editor"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, 81);
  assert.equal(closure.workloadCount, 174);
  assert.equal(
    closure.impactSha256,
    "5c2e03f103564c178d3bb99d63948173760a956f1cd7a30f02ffb77eae9ca3ff",
  );
});

test("Desen App Design/Run closes over the exact canvas, state, and action parents", () => {
  const closure = createAffectedImpactClosure(["desen-app-design-run-modes"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, 81);
  assert.equal(closure.workloadCount, 174);
  assert.equal(
    closure.impactSha256,
    "86d36107ae817d9da428d399b85ee57b12ca068b53b9cf47fefa2a7a0b617a91",
  );
});

test("Desen App fixtures/scenarios closes over exact Design/Run, fixture, and parity parents", () => {
  const closure = createAffectedImpactClosure(["desen-app-fixtures-scenarios-fidelity"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, 81);
  assert.equal(closure.workloadCount, 174);
  assert.equal(
    closure.impactSha256,
    "430ffe9607535a1f964974ec1a9f4178306ea1bf20b9b047df095710d813cea0",
  );
});

test("Desen App persistence closes over exact shell, Editor Core, and T11 parents", () => {
  const closure = createAffectedImpactClosure(["desen-app-source-persistence"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, 81);
  assert.equal(closure.workloadCount, 174);
  assert.equal(closure.nodeIds.includes("verify-desen-app-shell-navigation"), true);
  assert.equal(closure.nodeIds.includes("verify-editor-core-persistence"), true);
  assert.equal(closure.nodeIds.includes("verify-desen-app-fixtures-scenarios-fidelity"), true);
  assert.equal(
    closure.impactSha256,
    "a51c1954648360cf5fda92e23695486ed12448c19443dbc0ebcd3e8b48514b46",
  );
});

test("Desen App diagnostics closes over exact Runtime, Editor Core, and App authoring parents", () => {
  const closure = createAffectedImpactClosure(["desen-app-node-linked-diagnostics"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, 81);
  assert.equal(closure.workloadCount, 174);
  assert.equal(closure.nodeIds.includes("verify-runtime-react-reconciliation-diagnostics"), true);
  assert.equal(closure.nodeIds.includes("verify-editor-core-continuous-validation"), true);
  assert.equal(closure.nodeIds.includes("verify-desen-app-source-persistence"), true);
  assert.equal(
    closure.impactSha256,
    "aebf82bf60b6668f6d28bf27db3bb2f2d465de3350cf8f6e4cef8e67abfe4585",
  );
});

test("Desen App publication closes over exact App, Publisher, control-plane, and host parents", () => {
  const closure = createAffectedImpactClosure(["desen-app-publish-activation"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, 81);
  assert.equal(closure.workloadCount, 174);
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
    "83a3511eeeebd4972d5a29c388b9045d9571bdf11dcc6322e0f73961079db72c",
  );
});

test("Desen App empty-project browser E2E closes over the published authoring surface", () => {
  const closure = createAffectedImpactClosure(["desen-app-empty-project-browser-e2e"]);
  assert.deepEqual(closure.ownerProofUnitIds, ["desen-app-empty-project-browser-e2e"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, 81);
  assert.equal(closure.workloadCount, 174);
  assert.equal(closure.nodeIds.includes("verify-desen-app-publish-activation"), true);
  assert.equal(
    closure.impactSha256,
    "4641f1e6c1cbf5ea299bd5b1cb05783035daa51b4f1a1685a4a3aa11bdf970c2",
  );
});

test("Desen App Browser E2E workspace compatibility closes over the historical browser proof", () => {
  const closure = createAffectedImpactClosure(["desen-app-browser-e2e-workspace-compatibility"]);
  assert.deepEqual(closure.ownerProofUnitIds, ["desen-app-browser-e2e-workspace-compatibility"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, 81);
  assert.equal(closure.workloadCount, 174);
  assert.equal(closure.nodeIds.includes("verify-desen-app-empty-project-browser-e2e"), true);
  assert.equal(
    closure.impactSha256,
    "e3b5632d226e7a49934f9bebc428e42940529edcf48189eca838ec8a438405d0",
  );
});

test("Desen App user-created blank project closes over the immutable Browser E2E proofs", () => {
  const closure = createAffectedImpactClosure(["desen-app-user-created-blank-project"]);
  assert.deepEqual(closure.ownerProofUnitIds, ["desen-app-user-created-blank-project"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, 81);
  assert.equal(closure.workloadCount, 174);
  assert.equal(
    closure.nodeIds.includes("verify-desen-app-browser-e2e-workspace-compatibility"),
    true,
  );
  assert.equal(
    closure.impactSha256,
    "211705b5fcd76de15dde007cd850625b00b37e8629b797923b5d2b40ffb10608",
  );
});

test("Desen App visual behavior authoring closes over the blank-project predecessor", () => {
  const closure = createAffectedImpactClosure(["desen-app-visual-behavior-authoring"]);
  assert.deepEqual(closure.ownerProofUnitIds, ["desen-app-visual-behavior-authoring"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, 81);
  assert.equal(closure.workloadCount, 174);
  assert.equal(closure.nodeIds.includes("verify-desen-app-user-created-blank-project"), true);
  assert.equal(
    closure.impactSha256,
    "4f2e56b473efc8fc3c88400474ba2e6d3d6c32f9cf952634d82640e0a3d60c75",
  );
});

test("Desen App evergreen composition closes over the visual-behavior predecessor", () => {
  const closure = createAffectedImpactClosure(["desen-app-evergreen-product-composition"]);
  assert.deepEqual(closure.ownerProofUnitIds, ["desen-app-evergreen-product-composition"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, 81);
  assert.equal(closure.workloadCount, 174);
  assert.equal(closure.nodeIds.includes("verify-desen-app-visual-behavior-authoring"), true);
  assert.equal(
    closure.impactSha256,
    "7da85c4c1c30676c2f747ffa648a741c351acd4dd962dfff14ec5583411eae0a",
  );
});

test("Desen App input/pending fixture closes over the evergreen composition predecessor", () => {
  const closure = createAffectedImpactClosure(["desen-app-input-pending-fixture"]);
  assert.deepEqual(closure.ownerProofUnitIds, ["desen-app-input-pending-fixture"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, 81);
  assert.equal(closure.workloadCount, 174);
  assert.equal(closure.nodeIds.includes("verify-desen-app-evergreen-product-composition"), true);
  assert.equal(
    closure.impactSha256,
    "236df1300ccf885ccb14977310d4f7094b3151bfa476fb834b0c5903a175abc4",
  );
});

test("Desen App failure fixture closes over the input/pending predecessor", () => {
  const closure = createAffectedImpactClosure(["desen-app-failure-fixture"]);
  assert.deepEqual(closure.ownerProofUnitIds, ["desen-app-failure-fixture"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, 81);
  assert.equal(closure.workloadCount, 174);
  assert.equal(closure.nodeIds.includes("verify-desen-app-input-pending-fixture"), true);
  assert.equal(
    closure.impactSha256,
    "35d28218a0ceba962cd164af5859990c91b2600b1ee533e59f1dde581c2e45db",
  );
});

test("Desen App success and real-host operation closes over both historical and executable authority", () => {
  const closure = createAffectedImpactClosure(["desen-app-success-host-operation"]);
  assert.deepEqual(closure.ownerProofUnitIds, ["desen-app-success-host-operation"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, 81);
  assert.equal(closure.workloadCount, 174);
  for (const id of ["desen-app-failure-fixture", "reference-sign-in-fixtures-and-host-binding"]) {
    assert.equal(closure.nodeIds.includes(`verify-${id}`), true);
    assert.equal(closure.nodeIds.includes(`test-${id}`), true);
  }
  assert.equal(
    closure.impactSha256,
    "e2dba5c7978be7d3c95eaf47657c9224de9738873cae45f5504fc0d0faaaa955",
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
  assert.equal(closure.proofUnitCount, 81);
  assert.equal(closure.workloadCount, 174);
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
    "55e04979f4adc04bae65a1533d986704d5e5224e014c7062a5b642a91b7a66f2",
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
