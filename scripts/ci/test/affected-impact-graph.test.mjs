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
]);

function clone(value) {
  return structuredClone(value);
}

test("the reviewed impact graph owns every proof unit exactly once", () => {
  const graph = createAffectedImpactGraph();
  assert.equal(graph.proofUnitCount, 101);
  assert.equal(new Set(graph.entries.map(({ id }) => id)).size, 101);
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
  assert.equal(closure.workloadCount, 148);
});

test("the editor structural edits close over stable insertion and Source admission", () => {
  const closure = createAffectedImpactClosure(["editor-core-structural-edits"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.workloadCount, 148);
});

test("editor content edits close over both immutable T02 and T03 prerequisites", () => {
  const closure = createAffectedImpactClosure(["editor-core-content-edits"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.workloadCount, 148);
});

test("editor state/binding edits close over the formal T02 and current T04 graph", () => {
  const closure = createAffectedImpactClosure(["editor-core-state-binding-edits"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.workloadCount, 148);
});

test("editor event/action edits close over the formal state/binding predecessor", () => {
  const closure = createAffectedImpactClosure(["editor-core-event-action-edits"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.workloadCount, 148);
});

test("editor authoring round-trip closes over the formal event/action predecessor", () => {
  const closure = createAffectedImpactClosure(["editor-core-authoring-round-trip"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.workloadCount, 148);
});

test("editor persistence closes over the complete neutral authoring predecessor", () => {
  const closure = createAffectedImpactClosure(["editor-core-persistence"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.workloadCount, 148);
  assert.equal(closure.nodeIds.includes("editor-web-public-package-contract"), true);
});

test("continuous validation closes over T03-T07 without making persistence a formal parent", () => {
  const closure = createAffectedImpactClosure(["editor-core-continuous-validation"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.workloadCount, 148);
  assert.equal(
    createAffectedImpactGraph()
      .entries.find(({ id }) => id === "editor-core-continuous-validation")
      .prerequisites.includes("editor-core-persistence"),
    false,
  );
  assert.equal(
    closure.impactSha256,
    "84ea9f8f16de2409cf5575cb38c26dacdad1518e9bc95cf189b870493f73c66b",
  );
});

test("terminal integration closes over all M08 predecessors and the frozen P-18 runtime proofs", () => {
  const closure = createAffectedImpactClosure(["editor-core-terminal-integration"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.workloadCount, 148);
  assert.equal(closure.nodeIds.includes("editor-web-public-package-contract"), true);
  assert.equal(
    closure.impactSha256,
    "cd594f416cd0d344731b9751ec14c9a4ea18457a56e1a10930039e4528688a58",
  );
});

test("Desen App shell navigation closes over its terminal parent and catalog-panel dependent", () => {
  const closure = createAffectedImpactClosure(["desen-app-shell-navigation"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitIds.includes("editor-core-terminal-integration"), true);
  assert.equal(closure.workloadCount, 148);
  assert.equal(
    closure.impactSha256,
    "ac966a9c220bf890e641b6920694095007b5e390822cad235613369620af0135",
  );
});

test("Desen App catalog panel closes over exact shell and Catalog parents", () => {
  const closure = createAffectedImpactClosure(["desen-app-catalog-panel-layer-tree"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.workloadCount, 148);
  assert.equal(
    closure.impactSha256,
    "7d49d1b0296a952a35e3a4f5f3f800c7b7e82974a9dd0428e02f0c9ac9508cf8",
  );
});

test("Desen App adapter canvas closes over exact shell and source-audit parents", () => {
  const closure = createAffectedImpactClosure(["desen-app-real-adapter-canvas"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, 69);
  assert.equal(closure.workloadCount, 148);
  assert.equal(
    closure.impactSha256,
    "564d8a5663d366683b80a26a9a053db53189a26a946d634e03a57a129f1bc1d5",
  );
});

test("Desen App selection overlay closes over its exact adapter-canvas parent", () => {
  const closure = createAffectedImpactClosure(["desen-app-selection-overlay"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, 69);
  assert.equal(closure.workloadCount, 148);
  assert.equal(
    closure.impactSha256,
    "62c3ff878cb3f2b88ed323f90410d6608c868d1929f4ba3535fb664313ef74d1",
  );
});

test("Desen App schema inspector closes over exact Catalog, selection, and Publisher parents", () => {
  const closure = createAffectedImpactClosure(["desen-app-schema-inspector"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, 69);
  assert.equal(closure.workloadCount, 148);
  assert.match(closure.impactSha256, /^[0-9a-f]{64}$/u);
});

test("Desen App structured inspector closes over its exact schema-inspector parent", () => {
  const closure = createAffectedImpactClosure(["desen-app-structured-inspector"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, 69);
  assert.equal(closure.workloadCount, 148);
  assert.match(closure.impactSha256, /^[0-9a-f]{64}$/u);
});

test("Desen App named-slot authoring closes over its exact structured-inspector parent", () => {
  const closure = createAffectedImpactClosure(["desen-app-named-slot-authoring"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, 69);
  assert.equal(closure.workloadCount, 148);
  assert.equal(
    closure.impactSha256,
    "aa5dc76ea76f0b9d263ddb853f70dcb4d62152757e807dbf4092e05b46e730ed",
  );
});

test("Desen App state-binding editor closes over exact App, Editor Core, and graph parents", () => {
  const closure = createAffectedImpactClosure(["desen-app-state-binding-editor"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, 69);
  assert.equal(closure.workloadCount, 148);
  assert.equal(
    closure.impactSha256,
    "3a6c3fe2ea6214fcedaa856b1f75b19a3eaef368ed4f31d9863a6c935c2fd034",
  );
});

test("Desen App event/action editor closes over exact App and Editor Core parents", () => {
  const closure = createAffectedImpactClosure(["desen-app-event-action-editor"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, 69);
  assert.equal(closure.workloadCount, 148);
  assert.equal(
    closure.impactSha256,
    "4a51121aef0512e2f97ab27f521c5ae539ad519d3adfc58dfccd322b3cbe91ce",
  );
});

test("Desen App Design/Run closes over the exact canvas, state, and action parents", () => {
  const closure = createAffectedImpactClosure(["desen-app-design-run-modes"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, 69);
  assert.equal(closure.workloadCount, 148);
  assert.equal(
    closure.impactSha256,
    "9f47056f7722e342b3794118f14f88edfbf87fdee03b8276271a1e63adf83587",
  );
});

test("Desen App fixtures/scenarios closes over exact Design/Run, fixture, and parity parents", () => {
  const closure = createAffectedImpactClosure(["desen-app-fixtures-scenarios-fidelity"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, 69);
  assert.equal(closure.workloadCount, 148);
  assert.equal(
    closure.impactSha256,
    "d677693385e06f6e6589f2b94ebdcaa5924405aa2b9d846c7243e1c7ef3eb6a5",
  );
});

test("Desen App persistence closes over exact shell, Editor Core, and T11 parents", () => {
  const closure = createAffectedImpactClosure(["desen-app-source-persistence"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, 69);
  assert.equal(closure.workloadCount, 148);
  assert.equal(closure.nodeIds.includes("verify-desen-app-shell-navigation"), true);
  assert.equal(closure.nodeIds.includes("verify-editor-core-persistence"), true);
  assert.equal(closure.nodeIds.includes("verify-desen-app-fixtures-scenarios-fidelity"), true);
  assert.equal(
    closure.impactSha256,
    "401c64215943b255521ce6b2737cf7206d0aaaa850fee1251be24f23b928f933",
  );
});

test("Desen App diagnostics closes over exact Runtime, Editor Core, and App authoring parents", () => {
  const closure = createAffectedImpactClosure(["desen-app-node-linked-diagnostics"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, 69);
  assert.equal(closure.workloadCount, 148);
  assert.equal(closure.nodeIds.includes("verify-runtime-react-reconciliation-diagnostics"), true);
  assert.equal(closure.nodeIds.includes("verify-editor-core-continuous-validation"), true);
  assert.equal(closure.nodeIds.includes("verify-desen-app-source-persistence"), true);
  assert.equal(
    closure.impactSha256,
    "0aa5bebc7f8064137c1622781c952ab6f41e406f845aebb15122992aae60baeb",
  );
});

test("Desen App publication closes over exact App, Publisher, control-plane, and host parents", () => {
  const closure = createAffectedImpactClosure(["desen-app-publish-activation"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, 69);
  assert.equal(closure.workloadCount, 148);
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
    "cfc6ad1e20eb37fa7e4d7dcd6cb2f4197533b6d39ec7bb40de8a897f4456d373",
  );
});

test("Desen App empty-project browser E2E closes over the published authoring surface", () => {
  const closure = createAffectedImpactClosure(["desen-app-empty-project-browser-e2e"]);
  assert.deepEqual(closure.ownerProofUnitIds, ["desen-app-empty-project-browser-e2e"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, 69);
  assert.equal(closure.workloadCount, 148);
  assert.equal(closure.nodeIds.includes("verify-desen-app-publish-activation"), true);
  assert.equal(
    closure.impactSha256,
    "4ae797c4046509d520473dd42b2b4ac176a47c0fa98353a38e66d3bb208bc1d2",
  );
});

test("Desen App Browser E2E workspace compatibility closes over the historical browser proof", () => {
  const closure = createAffectedImpactClosure(["desen-app-browser-e2e-workspace-compatibility"]);
  assert.deepEqual(closure.ownerProofUnitIds, ["desen-app-browser-e2e-workspace-compatibility"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, 69);
  assert.equal(closure.workloadCount, 148);
  assert.equal(closure.nodeIds.includes("verify-desen-app-empty-project-browser-e2e"), true);
  assert.equal(
    closure.impactSha256,
    "2e5d4867ad59c1e1541e7847c667ec1be940fd956550d9610b82746298a194fe",
  );
});

test("Desen App user-created blank project closes over the immutable Browser E2E proofs", () => {
  const closure = createAffectedImpactClosure(["desen-app-user-created-blank-project"]);
  assert.deepEqual(closure.ownerProofUnitIds, ["desen-app-user-created-blank-project"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, 69);
  assert.equal(closure.workloadCount, 148);
  assert.equal(
    closure.nodeIds.includes("verify-desen-app-browser-e2e-workspace-compatibility"),
    true,
  );
  assert.equal(
    closure.impactSha256,
    "53f913d0f3e00eab21d353b659d8fe058af76fbfb44cbe904ea8cbcc5fdf054b",
  );
});

test("Desen App visual behavior authoring closes over the blank-project predecessor", () => {
  const closure = createAffectedImpactClosure(["desen-app-visual-behavior-authoring"]);
  assert.deepEqual(closure.ownerProofUnitIds, ["desen-app-visual-behavior-authoring"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, 69);
  assert.equal(closure.workloadCount, 148);
  assert.equal(closure.nodeIds.includes("verify-desen-app-user-created-blank-project"), true);
  assert.equal(
    closure.impactSha256,
    "968e12ca07b340c4af699b47b3b0f32ee89b3079d4c5a30c7c05422b2438769d",
  );
});

test("Desen App evergreen composition closes over the visual-behavior predecessor", () => {
  const closure = createAffectedImpactClosure(["desen-app-evergreen-product-composition"]);
  assert.deepEqual(closure.ownerProofUnitIds, ["desen-app-evergreen-product-composition"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, 69);
  assert.equal(closure.workloadCount, 148);
  assert.equal(closure.nodeIds.includes("verify-desen-app-visual-behavior-authoring"), true);
  assert.equal(
    closure.impactSha256,
    "7087d8e51131945f64c776f1282172bc807cea07f7652bf4978c3713fea00cb0",
  );
});

test("Desen App input/pending fixture closes over the evergreen composition predecessor", () => {
  const closure = createAffectedImpactClosure(["desen-app-input-pending-fixture"]);
  assert.deepEqual(closure.ownerProofUnitIds, ["desen-app-input-pending-fixture"]);
  assert.deepEqual(closure.proofUnitIds, DESEN_APP_CONNECTED_PROOF_UNITS);
  assert.equal(closure.proofUnitCount, 69);
  assert.equal(closure.workloadCount, 148);
  assert.equal(closure.nodeIds.includes("verify-desen-app-evergreen-product-composition"), true);
  assert.equal(
    closure.impactSha256,
    "9bfb86e64cf2157c4e82aa1df0dece7cbc3d8c5234f4b934a37f7c19d86842bb",
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
