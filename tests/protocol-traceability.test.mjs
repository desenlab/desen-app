import assert from "node:assert/strict";
import test from "node:test";

import {
  ProtocolTraceabilityError,
  loadProtocolTraceabilityLedger,
  verifyProtocolTraceability,
} from "../scripts/lib/protocol-traceability.mjs";

const { ledger: canonicalLedger } = await loadProtocolTraceabilityLedger();

function cloneLedger() {
  return structuredClone(canonicalLedger);
}

function hasTraceabilityCode(expectedCode) {
  return (error) => {
    assert.ok(error instanceof ProtocolTraceabilityError);
    assert.equal(error.code, expectedCode);
    return true;
  };
}

async function verifyMutatedLedger(ledger) {
  return verifyProtocolTraceability({
    ledger,
    verifyArtifact: false,
    verifySnapshot: false,
  });
}

test("accepts the complete frozen protocol trace", async () => {
  const { evidence } = await verifyMutatedLedger(cloneLedger());

  assert.equal(evidence.result, "PASS");
  assert.equal(evidence.counts.schemaConstraints, 989);
  assert.equal(evidence.counts.schemaFamilies, 61);
  assert.equal(evidence.counts.diagnosticCodes, 36);
  assert.equal(evidence.coverage.assignedSchemaConstraintsPercent, 100);
});

test("rejects a schema constraint family that becomes unowned", async () => {
  const ledger = cloneLedger();
  ledger.schemaFamilies.pop();

  await assert.rejects(verifyMutatedLedger(ledger), hasTraceabilityCode("TRACE_SCHEMA_UNCOVERED"));
});

test("rejects a schema constraint assigned to two families", async () => {
  const ledger = cloneLedger();
  const duplicate = structuredClone(ledger.schemaFamilies.at(-1));
  duplicate.id = "SC-999";
  ledger.schemaFamilies.push(duplicate);

  await assert.rejects(verifyMutatedLedger(ledger), hasTraceabilityCode("TRACE_SCHEMA_DUPLICATE"));
});

test("rejects an unknown implementation owner task", async () => {
  const ledger = cloneLedger();
  ledger.proseRules[0].owners = ["M99-T99"];

  await assert.rejects(verifyMutatedLedger(ledger), hasTraceabilityCode("TRACE_TASK_UNKNOWN"));
});

test("rejects a duplicate prose trace ID", async () => {
  const ledger = cloneLedger();
  ledger.proseRules[1].id = ledger.proseRules[0].id;

  await assert.rejects(verifyMutatedLedger(ledger), hasTraceabilityCode("TRACE_ID_DUPLICATE"));
});

test("rejects a stale prose source anchor", async () => {
  const ledger = cloneLedger();
  ledger.proseRules[0].anchor = "text that is not in the frozen specification";

  await assert.rejects(verifyMutatedLedger(ledger), hasTraceabilityCode("TRACE_ANCHOR_MISMATCH"));
});

test("rejects an informative Section 32 line mislabeled as normative Section 31", async () => {
  const ledger = cloneLedger();
  const entry = ledger.proseRules.find((candidate) => candidate.id === "R-144");
  entry.line = 1694;
  entry.anchor = "maps capability ids to registered React adapters";

  await assert.rejects(verifyMutatedLedger(ledger), hasTraceabilityCode("TRACE_SECTION_MISMATCH"));
});

test("rejects a prose rule without a future test owner", async () => {
  const ledger = cloneLedger();
  ledger.proseRules[0].tests = [];

  await assert.rejects(verifyMutatedLedger(ledger), hasTraceabilityCode("TRACE_TASK_PLAN_MISSING"));
});

test("rejects a justified exclusion without its rationale", async () => {
  const ledger = cloneLedger();
  delete ledger.pipelineSteps.find((entry) => entry.id === "PIPE-041").rationale;

  await assert.rejects(verifyMutatedLedger(ledger), hasTraceabilityCode("TRACE_RATIONALE_MISSING"));
});

test("rejects an overlapping BCP 14 line without a cross-link", async () => {
  const ledger = cloneLedger();
  delete ledger.proseRules.find((entry) => entry.id === "R-004").bcp14;

  await assert.rejects(
    verifyMutatedLedger(ledger),
    hasTraceabilityCode("TRACE_BCP14_RELATION_MISSING"),
  );
});

test("rejects an unreviewed normative section", async () => {
  const ledger = cloneLedger();
  ledger.sectionDispositions = ledger.sectionDispositions.filter((entry) => entry.section !== "31");

  await assert.rejects(
    verifyMutatedLedger(ledger),
    hasTraceabilityCode("TRACE_SECTION_UNREVIEWED"),
  );
});
