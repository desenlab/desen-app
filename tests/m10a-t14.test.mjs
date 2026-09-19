import assert from "node:assert/strict";
import test from "node:test";

import {
  M10A_T14_FOCUSED_COMMANDS,
  M10AT14ProofError,
  captureM10AT14Evidence,
  validateM10AT14EvidenceValue,
  verifyM10AT14Evidence,
} from "../scripts/lib/m10a-t14-proof.mjs";

test("M10A-T14 captures bounded history and identity-safe reuse", async () => {
  const evidence = await captureM10AT14Evidence();
  assert.equal(evidence.result, "PASS");
  assert.equal(evidence.claims.fullyImmutableHistoryEntries, true);
  assert.equal(evidence.claims.independentlyAdmittedHistorySnapshots, true);
  assert.equal(evidence.claims.forgedHistoryAuthorityRejected, true);
  assert.equal(evidence.claims.immutableDiagnostics, true);
  assert.equal(evidence.claims.projectScopedCrossSurfaceClipboard, true);
  assert.equal(evidence.claims.opaqueWorkspaceClipboardIsolation, true);
  assert.equal(evidence.claims.sourceOrderedMultiSelectionReuse, true);
  assert.equal(evidence.claims.freshIdentityRemapping, true);
  assert.equal(evidence.claims.nestedBindingReferenceRemapping, true);
  assert.equal(evidence.claims.transitiveStateResourceDependencyRemapping, true);
  assert.equal(evidence.claims.freshOperationAliasRemapping, true);
  assert.equal(evidence.claims.schemaOwnedBindingRewriteOnly, true);
  assert.equal(evidence.claims.externalComponentTargetRejectionAtomic, true);
  assert.equal(evidence.claims.unresolvedBindingRejectionAtomic, true);
  assert.equal(evidence.claims.multiRootReferenceRemapping, true);
  assert.equal(evidence.claims.maxLengthIdentityAllocation, true);
  assert.equal(evidence.claims.opaqueExtensionPreservation, true);
  assert.equal(evidence.claims.hostileClipboardRejectedAtomically, true);
  assert.equal(evidence.claims.hostileClipboardWrappersRejected, true);
  assert.equal(evidence.claims.ambiguousSourceIdentitiesRejected, true);
  assert.equal(evidence.claims.rejectedDuplicateCannotReuseClipboard, true);
  assert.equal(evidence.claims.runtimePublisherProtocolUnchanged, true);
});

test("M10A-T14 rejects a mutated claim or focused-command receipt", async () => {
  const evidence = await captureM10AT14Evidence();
  const mutatedClaim = structuredClone(evidence);
  mutatedClaim.claims.projectScopedCrossSurfaceClipboard = false;
  await assert.rejects(validateM10AT14EvidenceValue(mutatedClaim), (error) => {
    assert.ok(error instanceof M10AT14ProofError);
    assert.equal(error.code, "M10A_T14_ARTIFACT_CONTENT_INVALID");
    return true;
  });

  const mutatedCommand = structuredClone(evidence);
  mutatedCommand.focusedCommands[1] = "pnpm exec true";
  await assert.rejects(validateM10AT14EvidenceValue(mutatedCommand), (error) => {
    assert.ok(error instanceof M10AT14ProofError);
    assert.equal(error.code, "M10A_T14_ARTIFACT_CONTENT_INVALID");
    return true;
  });
});

test("M10A-T14 rejects artifact source drift", async () => {
  const observed = [];
  assert.deepEqual(
    await verifyM10AT14Evidence({
      runChild: async (command, args) => {
        observed.push({ command, args });
        return { code: 0, signal: null, output: Buffer.alloc(0) };
      },
    }),
    {
      status: "PASS",
      task: "M10A-T14",
      profile: "desen.m10a-t14.history-identity-safe-reuse.v1",
      sourceFiles: 6,
      focusedCommands: 2,
      focusedExecutedByVerifier: true,
    },
  );
  assert.deepEqual(observed, M10A_T14_FOCUSED_COMMANDS);
});

test("M10A-T14 verifier fails closed when a focused behavior suite fails", async () => {
  const observed = [];
  await assert.rejects(
    verifyM10AT14Evidence({
      runChild: async (command, args) => {
        observed.push({ command, args });
        return { code: 1, signal: null, output: Buffer.from("forced failure") };
      },
    }),
    (error) => {
      assert.ok(error instanceof M10AT14ProofError);
      assert.equal(error.code, "M10A_T14_FOCUSED_EXECUTION_FAILED");
      return true;
    },
  );
  assert.deepEqual(observed, [M10A_T14_FOCUSED_COMMANDS[0]]);
});

test("M10A-T14 reports a focused child start failure without hiding its cause", async () => {
  await assert.rejects(
    verifyM10AT14Evidence({
      runChild: async () => ({
        code: null,
        signal: null,
        error: new Error("child process denied"),
        output: Buffer.alloc(0),
      }),
    }),
    (error) => {
      assert.ok(error instanceof M10AT14ProofError);
      assert.equal(error.code, "M10A_T14_FOCUSED_EXECUTION_FAILED");
      assert.match(error.message, /child process denied/u);
      return true;
    },
  );
});
