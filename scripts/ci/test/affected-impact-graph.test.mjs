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
]);

function clone(value) {
  return structuredClone(value);
}

test("the reviewed impact graph owns every proof unit exactly once", () => {
  const graph = createAffectedImpactGraph();
  assert.equal(graph.proofUnitCount, 108);
  assert.equal(new Set(graph.entries.map(({ id }) => id)).size, 108);
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
  assert.equal(validateAffectedImpactGraph(graph), graph);
  assert.equal(Object.isFrozen(graph), true);
  assert.equal(Object.isFrozen(graph.entries), true);
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
    "8a9889204386d6e20ba28e4ac01aee8caeb6184a7d8e96cbfb3dd06af5174646",
  );
  assert.equal(closure.proofUnitCount, 76);
  assert.equal(closure.workloadCount, 162);
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
  assert.equal(closure.proofUnitCount, 76);
  assert.equal(closure.workloadCount, 162);
  assert.equal(
    closure.impactSha256,
    "2301d33429ee0ec698dddf10a465f80d510e53c2f1903e82f88f4cf1d380b0d4",
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
  assert.equal(closure.proofUnitCount, 76);
  assert.equal(closure.workloadCount, 162);
  assert.equal(
    closure.impactSha256,
    "b56afb58921dc32deb54b327d4735e029941117d97287cc070b58c719ffc786c",
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
  assert.equal(closure.workloadCount, 8 + closure.proofUnitCount * 2 + 2);
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
  assert.equal(closure.workloadCount, 162);
});

test("the editor structural edits close over stable insertion and Source admission", () => {
  const closure = createAffectedImpactClosure(["editor-core-structural-edits"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.workloadCount, 162);
});

test("editor content edits close over both immutable T02 and T03 prerequisites", () => {
  const closure = createAffectedImpactClosure(["editor-core-content-edits"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.workloadCount, 162);
});

test("editor state/binding edits close over the formal T02 and current T04 graph", () => {
  const closure = createAffectedImpactClosure(["editor-core-state-binding-edits"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.workloadCount, 162);
});

test("editor event/action edits close over the formal state/binding predecessor", () => {
  const closure = createAffectedImpactClosure(["editor-core-event-action-edits"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.workloadCount, 162);
});

test("editor authoring round-trip closes over the formal event/action predecessor", () => {
  const closure = createAffectedImpactClosure(["editor-core-authoring-round-trip"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.workloadCount, 162);
});

test("editor persistence closes over the complete neutral authoring predecessor", () => {
  const closure = createAffectedImpactClosure(["editor-core-persistence"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.workloadCount, 162);
  assert.equal(closure.nodeIds.includes("editor-web-public-package-contract"), true);
});

test("continuous validation closes over T03-T07 without making persistence a formal parent", () => {
  const closure = createAffectedImpactClosure(["editor-core-continuous-validation"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.workloadCount, 162);
  assert.equal(
    createAffectedImpactGraph()
      .entries.find(({ id }) => id === "editor-core-continuous-validation")
      .prerequisites.includes("editor-core-persistence"),
    false,
  );
  assert.equal(
    closure.impactSha256,
    "65e64ceabe34114c3525fdbef7c33889a6b189c92bef41f020c77c099fc5e6f7",
  );
});

test("terminal integration closes over all M08 predecessors and the frozen P-18 runtime proofs", () => {
  const closure = createAffectedImpactClosure(["editor-core-terminal-integration"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.workloadCount, 162);
  assert.equal(closure.nodeIds.includes("editor-web-public-package-contract"), true);
  assert.equal(
    closure.impactSha256,
    "b6e3095a1427777adc355ff09e2ac373e2410c02981a16def9119215df812d10",
  );
});

test("Desen App shell navigation closes over its terminal parent and catalog-panel dependent", () => {
  const closure = createAffectedImpactClosure(["desen-app-shell-navigation"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitIds.includes("editor-core-terminal-integration"), true);
  assert.equal(closure.workloadCount, 162);
  assert.equal(
    closure.impactSha256,
    "f2752bfea0382967dc13f0e0e46580f1b7e9e717b42dd688995814baf9ba4ce3",
  );
});

test("Desen App catalog panel closes over exact shell and Catalog parents", () => {
  const closure = createAffectedImpactClosure(["desen-app-catalog-panel-layer-tree"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.workloadCount, 162);
  assert.equal(
    closure.impactSha256,
    "c4b84ddd012f3b02b31bfadfc26305b151d5abe570c594e2f8c5b6482e566364",
  );
});

test("Desen App adapter canvas closes over exact shell and source-audit parents", () => {
  const closure = createAffectedImpactClosure(["desen-app-real-adapter-canvas"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, 76);
  assert.equal(closure.workloadCount, 162);
  assert.equal(
    closure.impactSha256,
    "1fddcada4226bf69e16bd6aaa1bd68903d422d6fa250f736280e462ff4d58944",
  );
});

test("Desen App selection overlay closes over its exact adapter-canvas parent", () => {
  const closure = createAffectedImpactClosure(["desen-app-selection-overlay"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, 76);
  assert.equal(closure.workloadCount, 162);
  assert.equal(
    closure.impactSha256,
    "f3b73d1b315905b833356e248a3c9a8257990a8a7461990a223441f326b0debf",
  );
});

test("Desen App schema inspector closes over exact Catalog, selection, and Publisher parents", () => {
  const closure = createAffectedImpactClosure(["desen-app-schema-inspector"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, 76);
  assert.equal(closure.workloadCount, 162);
  assert.match(closure.impactSha256, /^[0-9a-f]{64}$/u);
});

test("Desen App structured inspector closes over its exact schema-inspector parent", () => {
  const closure = createAffectedImpactClosure(["desen-app-structured-inspector"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, 76);
  assert.equal(closure.workloadCount, 162);
  assert.match(closure.impactSha256, /^[0-9a-f]{64}$/u);
});

test("Desen App named-slot authoring closes over its exact structured-inspector parent", () => {
  const closure = createAffectedImpactClosure(["desen-app-named-slot-authoring"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, 76);
  assert.equal(closure.workloadCount, 162);
  assert.equal(
    closure.impactSha256,
    "c97be4f58610f9514b1f1a114ee655e73c19c09e223e25bdd06052c96101491b",
  );
});

test("Desen App state-binding editor closes over exact App, Editor Core, and graph parents", () => {
  const closure = createAffectedImpactClosure(["desen-app-state-binding-editor"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, 76);
  assert.equal(closure.workloadCount, 162);
  assert.equal(
    closure.impactSha256,
    "8ddcd6a8610b8f1900198c45e6dbc1e314e3740a87e8c099afebaf552cdb9363",
  );
});

test("Desen App event/action editor closes over exact App and Editor Core parents", () => {
  const closure = createAffectedImpactClosure(["desen-app-event-action-editor"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, 76);
  assert.equal(closure.workloadCount, 162);
  assert.equal(
    closure.impactSha256,
    "d7777b855dac67c5253229f766cf9d4920c8897242fccbbd787ce9066c010773",
  );
});

test("Desen App Design/Run closes over the exact canvas, state, and action parents", () => {
  const closure = createAffectedImpactClosure(["desen-app-design-run-modes"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, 76);
  assert.equal(closure.workloadCount, 162);
  assert.equal(
    closure.impactSha256,
    "ad15f2417de9a8d42247a9ccad976c7fe9c1f48efbd140870c48bfeec2f96067",
  );
});

test("Desen App fixtures/scenarios closes over exact Design/Run, fixture, and parity parents", () => {
  const closure = createAffectedImpactClosure(["desen-app-fixtures-scenarios-fidelity"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, 76);
  assert.equal(closure.workloadCount, 162);
  assert.equal(
    closure.impactSha256,
    "6689d50d608bdc5c439edd94f71fb64688575c24dae6c55a9e5f33aa3243f5d7",
  );
});

test("Desen App persistence closes over exact shell, Editor Core, and T11 parents", () => {
  const closure = createAffectedImpactClosure(["desen-app-source-persistence"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, 76);
  assert.equal(closure.workloadCount, 162);
  assert.equal(closure.nodeIds.includes("verify-desen-app-shell-navigation"), true);
  assert.equal(closure.nodeIds.includes("verify-editor-core-persistence"), true);
  assert.equal(closure.nodeIds.includes("verify-desen-app-fixtures-scenarios-fidelity"), true);
  assert.equal(
    closure.impactSha256,
    "c5e7351763f1aefa0d2e4ad1eebcbfb0ef5f03ed8efe4fb8495004a8d0505d9a",
  );
});

test("Desen App diagnostics closes over exact Runtime, Editor Core, and App authoring parents", () => {
  const closure = createAffectedImpactClosure(["desen-app-node-linked-diagnostics"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, 76);
  assert.equal(closure.workloadCount, 162);
  assert.equal(closure.nodeIds.includes("verify-runtime-react-reconciliation-diagnostics"), true);
  assert.equal(closure.nodeIds.includes("verify-editor-core-continuous-validation"), true);
  assert.equal(closure.nodeIds.includes("verify-desen-app-source-persistence"), true);
  assert.equal(
    closure.impactSha256,
    "9afa39dc9a0f40baf05313a1b5684f7e47491a08efdd0e7da60be2cac91bc1af",
  );
});

test("Desen App publication closes over exact App, Publisher, control-plane, and host parents", () => {
  const closure = createAffectedImpactClosure(["desen-app-publish-activation"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, 76);
  assert.equal(closure.workloadCount, 162);
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
    "8b3d7972fbad7c8ecb5c68d82530f662cdaa2fdb06ce6d1de77b98fd405514c8",
  );
});

test("Desen App empty-project browser E2E closes over the published authoring surface", () => {
  const closure = createAffectedImpactClosure(["desen-app-empty-project-browser-e2e"]);
  assert.deepEqual(closure.ownerProofUnitIds, ["desen-app-empty-project-browser-e2e"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, 76);
  assert.equal(closure.workloadCount, 162);
  assert.equal(closure.nodeIds.includes("verify-desen-app-publish-activation"), true);
  assert.equal(
    closure.impactSha256,
    "3f511e3199a6f7ad2b5df1858ab6c65cdfc41238b946f6030025dcf7b55403a1",
  );
});

test("Desen App Browser E2E workspace compatibility closes over the historical browser proof", () => {
  const closure = createAffectedImpactClosure(["desen-app-browser-e2e-workspace-compatibility"]);
  assert.deepEqual(closure.ownerProofUnitIds, ["desen-app-browser-e2e-workspace-compatibility"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, 76);
  assert.equal(closure.workloadCount, 162);
  assert.equal(closure.nodeIds.includes("verify-desen-app-empty-project-browser-e2e"), true);
  assert.equal(
    closure.impactSha256,
    "cd15114855d539e0d86f1f5346853964c0998c6cd82bb01c3fc4e2bbef7584d4",
  );
});

test("Desen App user-created blank project closes over the immutable Browser E2E proofs", () => {
  const closure = createAffectedImpactClosure(["desen-app-user-created-blank-project"]);
  assert.deepEqual(closure.ownerProofUnitIds, ["desen-app-user-created-blank-project"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, 76);
  assert.equal(closure.workloadCount, 162);
  assert.equal(
    closure.nodeIds.includes("verify-desen-app-browser-e2e-workspace-compatibility"),
    true,
  );
  assert.equal(
    closure.impactSha256,
    "0a146c661ebe98eb34dac4166b26fbce56f5c47bcfeb6e0ab9e77418c5b27292",
  );
});

test("Desen App visual behavior authoring closes over the blank-project predecessor", () => {
  const closure = createAffectedImpactClosure(["desen-app-visual-behavior-authoring"]);
  assert.deepEqual(closure.ownerProofUnitIds, ["desen-app-visual-behavior-authoring"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, 76);
  assert.equal(closure.workloadCount, 162);
  assert.equal(closure.nodeIds.includes("verify-desen-app-user-created-blank-project"), true);
  assert.equal(
    closure.impactSha256,
    "64f55de7acecdfc3465806f078b98b38c8feda31dff440a8d434c13f95b34973",
  );
});

test("Desen App evergreen composition closes over the visual-behavior predecessor", () => {
  const closure = createAffectedImpactClosure(["desen-app-evergreen-product-composition"]);
  assert.deepEqual(closure.ownerProofUnitIds, ["desen-app-evergreen-product-composition"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, 76);
  assert.equal(closure.workloadCount, 162);
  assert.equal(closure.nodeIds.includes("verify-desen-app-visual-behavior-authoring"), true);
  assert.equal(
    closure.impactSha256,
    "5e0608d4dd641713dcab8bae97ef27032c37094cb110c829ad9a28d0136d2bd2",
  );
});

test("Desen App input/pending fixture closes over the evergreen composition predecessor", () => {
  const closure = createAffectedImpactClosure(["desen-app-input-pending-fixture"]);
  assert.deepEqual(closure.ownerProofUnitIds, ["desen-app-input-pending-fixture"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, 76);
  assert.equal(closure.workloadCount, 162);
  assert.equal(closure.nodeIds.includes("verify-desen-app-evergreen-product-composition"), true);
  assert.equal(
    closure.impactSha256,
    "0c78cc751b5711f6ff1419fd6a580c75e4cd11b1c976f3fa24ac515da778682f",
  );
});

test("Desen App failure fixture closes over the input/pending predecessor", () => {
  const closure = createAffectedImpactClosure(["desen-app-failure-fixture"]);
  assert.deepEqual(closure.ownerProofUnitIds, ["desen-app-failure-fixture"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, 76);
  assert.equal(closure.workloadCount, 162);
  assert.equal(closure.nodeIds.includes("verify-desen-app-input-pending-fixture"), true);
  assert.equal(
    closure.impactSha256,
    "f6616aff91197f8ef870c9e9a2f8ac085e1b360347d1ee0cb40f0bcb233aa08b",
  );
});

test("Desen App success and real-host operation closes over both historical and executable authority", () => {
  const closure = createAffectedImpactClosure(["desen-app-success-host-operation"]);
  assert.deepEqual(closure.ownerProofUnitIds, ["desen-app-success-host-operation"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, 76);
  assert.equal(closure.workloadCount, 162);
  for (const id of ["desen-app-failure-fixture", "reference-sign-in-fixtures-and-host-binding"]) {
    assert.equal(closure.nodeIds.includes(`verify-${id}`), true);
    assert.equal(closure.nodeIds.includes(`test-${id}`), true);
  }
  assert.equal(
    closure.impactSha256,
    "60c880fe50e6bf6ce193bcfaa85c1b609c6269c52e03535aad09b5ebefdea29a",
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
  assert.equal(closure.proofUnitCount, 76);
  assert.equal(closure.workloadCount, 162);
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
    "2db7c1dc15fda2390e96d323c6e1c14fe00b731db9c29a7aa88d3ea4f80d4066",
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
