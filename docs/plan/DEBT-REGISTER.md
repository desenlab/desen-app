# Infrastructure Debt and Cleanup Register

This register tracks temporary compatibility structures registered by I07-01 and later
task-specific successors while immutable task evidence is separated from current-checkpoint
authentication and CI execution orchestration. Sixteen entries remain open; DEBT-I07-008 is closed
with authenticated removal evidence. An open entry records planned removal work and does not claim
that its cleanup has already been implemented.

This is an engineering-maintenance register, not a protocol finding or Proof Matrix. Removing an
entry may not rewrite a frozen artifact, weaken a proof, turn an unknown input into a skipped
check, or treat an earlier successful run as current evidence.

## Status and closure rules

- `OPEN`: the temporary structure is still required by the current implementation.
- `READY_FOR_REMOVAL`: every objective trigger is satisfied, but the legacy structure and its
  tests have not yet been removed.
- `CLOSED`: the legacy structure is absent, the zero-reference rule passes, and closure evidence
  is recorded below.

Every entry records both the task that registered it and the later infrastructure task that owns
its removal. `Must close by` is a hard gate ceiling, not permission to postpone a trigger that has
already become true. The canonical machine-readable inventory and its lifecycle validator live
under `scripts/ci/`; the official required-exhaustive path runs that validator before executing
the full gate. A cleanup is complete only when:

1. the replacement current checkpoint is authenticated from fresh tracked bytes;
2. frozen task artifacts and their task-time projections remain byte-identical;
3. the modular `REQUIRED + EXHAUSTIVE` schedule and the retained legacy gate have met the
   equivalence gates in ADR 0011;
4. the entry-specific focused verifier and mutation tests pass;
5. the entry-specific zero-reference rule passes; and
6. the complete fresh quality gate passes without cached proof success.

## Lifecycle summary

| ID           | Status | Temporary structure                                      | Registered by | Removal owner | Must close by |
| ------------ | ------ | -------------------------------------------------------- | ------------- | ------------- | ------------- |
| DEBT-I07-001 | OPEN   | M06-T01 current G05 receipt ownership                    | I07-01        | I07-04        | G07           |
| DEBT-I07-002 | OPEN   | M06-T05 duplicate current M05 receipts                   | I07-01        | I07-04        | G07           |
| DEBT-I07-003 | OPEN   | M06-T09 predecessor compatibility helpers                | I07-01        | I07-04        | G07           |
| DEBT-I07-004 | OPEN   | M06-T11 current T09/T10 receipts and source markers      | I07-01        | I07-04        | G07           |
| DEBT-I07-005 | OPEN   | M07-T01 historical projection for checkpointed readers   | I07-01        | I07-04        | G07           |
| DEBT-I07-006 | OPEN   | M05-T09 embedded M06-T05 Validator successor description | I07-01        | I07-04        | G07           |
| DEBT-I07-007 | OPEN   | Legacy runner, rollback adapter, and manual workflow     | I07-01        | I07-05        | G12           |
| DEBT-I07-008 | CLOSED | Shadow workflow and legacy-authority adapter             | I07-01        | I07-02        | G07           |
| DEBT-I07-009 | OPEN   | M05-T09 current M07-T06 coordination projection          | I07-01        | I07-04        | G07           |
| DEBT-I07-010 | OPEN   | M05-T04 current M07-T03 P-05 successor projection        | I07-01        | I07-04        | G07           |
| DEBT-I07-011 | OPEN   | M07-T04 current-reader and P-17 successor bridges        | M07-T04       | I07-04        | G07           |
| DEBT-I07-012 | OPEN   | M07-T05 historical control-plane reader bridges          | M07-T05       | I07-04        | G07           |
| DEBT-I07-013 | OPEN   | M07-T06 historical staging reader bridges                | M07-T06       | I07-04        | G07           |
| DEBT-I07-014 | OPEN   | M07-T07 historical activation reader bridges             | M07-T07       | I07-04        | G07           |
| DEBT-I07-015 | OPEN   | M07-T08 historical recovery reader bridges               | M07-T08       | I07-04        | G07           |
| DEBT-I07-016 | OPEN   | M07-T09 historical fault-injection successor bridges     | M07-T09       | I07-04        | G07           |
| DEBT-I07-017 | OPEN   | I07-03 shadow CI and current-reader receipt bridge       | I07-03        | I07-04        | G07           |

## DEBT-I07-001 — M06-T01 current G05 receipts

- Status: `OPEN`
- Registered by infrastructure task: `I07-01`
- Removal owner: `I07-04`
- Exact paths and symbols:
  - `scripts/lib/publisher-publish-result-proof.mjs`
    - `G05_COMPATIBILITY_OWNERSHIP_PATHS`
    - `REVIEWED_G05_COMPATIBILITY_RECEIPT_HISTORY`
    - `TRACKED_FILE_OVERRIDE_PATHS`
    - `reviewedHistory`
    - `latestReviewed`
    - `receiptIsReviewed`
  - `tests/publisher-publish-result.test.mjs`
    - `M07_T03_SOURCE_AUDIT_RECONSTRUCTION_PATCH`
    - `reconstructM07T03SourceAuditProof`
    - `currentCompatibilityBytes`
    - `compatibilityPaths`
    - `reviewedG05CompatibilityReceiptHistory`
    - `PUBLISHER_G05_COMPATIBILITY_READER_DRIFT`
  - current receipt targets:
    - `scripts/lib/reference-host-web-source-audit-proof.mjs`
    - `tests/reference-host-web-source-audit.test.mjs`
- Reason retained: the frozen M06-T01 artifact must preserve its task-time G05 projection while
  the current M05-T09 reader and root test have continued to evolve. M06-T01 therefore carries a
  second, current receipt authority until a separate current checkpoint owns that responsibility.
- Objective removal trigger: the modular current checkpoint authenticates the two current
  M05-T09 files exactly once, M06-T01 reads only its immutable task-time artifact projection, and
  both `SHADOW + EXHAUSTIVE` and `REQUIRED + EXHAUSTIVE` equivalence cover the M06-T01 and M05-T09
  verifier/root-test results.
- Must close by gate: `G07`
- Exact verification and zero-reference rule:
  - `node scripts/verify-publisher-publish-result.mjs`
  - `node --test tests/publisher-publish-result.test.mjs`
  - `node scripts/verify-reference-host-web-source-audit.mjs`
  - `node --test tests/reference-host-web-source-audit.test.mjs`
  - `rg -n "G05_COMPATIBILITY_OWNERSHIP_PATHS|REVIEWED_G05_COMPATIBILITY_RECEIPT_HISTORY|TRACKED_FILE_OVERRIDE_PATHS|reviewedHistory|latestReviewed|receiptIsReviewed|M07_T03_SOURCE_AUDIT_RECONSTRUCTION_PATCH|reconstructM07T03SourceAuditProof|currentCompatibilityBytes|compatibilityPaths|reviewedG05CompatibilityReceiptHistory|PUBLISHER_G05_COMPATIBILITY_READER_DRIFT" scripts/lib/publisher-publish-result-proof.mjs tests/publisher-publish-result.test.mjs`
    must return no matches after removal. Historical path strings inside immutable task-receipt
    projections are not part of this zero-reference rule.
- Closure evidence: `PENDING` — record commit, pull request, replacement checkpoint receipt
  SHA-256, frozen M06-T01 artifact SHA-256, and hosted required-exhaustive equivalence run URL.

## DEBT-I07-002 — M06-T05 duplicate current M05 receipts

- Status: `OPEN`
- Registered by infrastructure task: `I07-01`
- Removal owner: `I07-04`
- Exact paths and symbols:
  - `scripts/lib/publisher-execution-preflight-proof.mjs`
    - `M05_SOURCE_AUDIT_PROOF_RELATIVE_PATH`
    - `M05_SOURCE_AUDIT_TEST_RELATIVE_PATH`
    - `APPROVED_M05_COMPATIBILITY_RECEIPT_HISTORY`
    - `APPROVED_CURRENT_M05_COMPATIBILITY_RECEIPTS`
    - `captureCompatibilitySourceBytes`
    - the current-receipt branch in `fileInventory`
  - `tests/publisher-execution-preflight.test.mjs`
    - `compatibilitySources`
    - `compatibilitySourceBytes`
    - `currentBytes`
    - `currentSha256`
  - duplicated current targets:
    - `scripts/lib/reference-host-web-source-audit-proof.mjs`
    - `tests/reference-host-web-source-audit.test.mjs`
- Reason retained: M06-T05 independently authenticates the same current M05-T09 proof and test
  receipts already carried by M06-T01. The duplicate is fail-closed today but makes every approved
  M05-T09 evolution require multiple historical-reader edits.
- Objective removal trigger: one current-checkpoint record owns the M05-T09 proof/test receipts;
  M06-T05 consumes the checkpoint result without embedding those current bytes or accepting a
  caller-supplied substitute; the M06-T05 artifact remains byte-identical; and shadow plus required
  exhaustive equivalence preserves every compatibility poison test.
- Must close by gate: `G07`
- Exact verification and zero-reference rule:
  - `node scripts/verify-publisher-execution-preflight.mjs`
  - `node --test tests/publisher-execution-preflight.test.mjs`
  - `node scripts/verify-reference-host-web-source-audit.mjs`
  - `rg -n "M05_SOURCE_AUDIT_(PROOF|TEST)_RELATIVE_PATH|APPROVED_M05_COMPATIBILITY_RECEIPT_HISTORY|APPROVED_CURRENT_M05_COMPATIBILITY_RECEIPTS|captureCompatibilitySourceBytes|compatibilitySources|compatibilitySourceBytes|currentBytes|currentSha256" scripts/lib/publisher-execution-preflight-proof.mjs tests/publisher-execution-preflight.test.mjs`
    must return no matches after removal. Immutable historical receipt records may retain their
    exact M05-T09 paths and hashes.
- Closure evidence: `PENDING` — record commit, pull request, replacement checkpoint receipt
  SHA-256, frozen M06-T05 artifact SHA-256, and hosted required-exhaustive equivalence run URL.

## DEBT-I07-003 — M06-T09 predecessor and workflow compatibility helpers

- Status: `OPEN`
- Registered by infrastructure task: `I07-01`
- Removal owner: `I07-04`
- Exact paths and symbols:
  - `scripts/lib/publisher-bundle-publication-proof.mjs`
    - `PUBLISHER_BUNDLE_PUBLICATION_COMPATIBILITY_READERS`
    - `EXECUTION_PREFLIGHT_COMPATIBILITY_READER`
    - `EXECUTION_PREFLIGHT_COMPATIBILITY_ROOT_TEST`
    - `APPROVED_COMPATIBILITY_RECEIPT_HISTORY`
    - `APPROVED_CURRENT_COMPATIBILITY_RECEIPTS`
    - `APPROVED_CURRENT_COMPATIBILITY_PATHS`
    - `assertApprovedCurrentCompatibilityBytes`
    - `authenticateCurrentCompatibilityReaders`
    - `APPROVED_REQUIRED_CI_WORKFLOW_RECEIPT`
    - `matchesReceipt`
    - `authenticateRequiredCiWorkflow`
    - `authenticatedM07T01Prefix`
  - `tests/publisher-bundle-publication.test.mjs`
    - `PUBLISHER_BUNDLE_PUBLICATION_COMPATIBILITY_READERS`
    - `[compatibility] externally tracks every current T02 through T09 proof reader`
    - `[compatibility] detects tamper in each externally anchored T02 through T09 reader`
    - `[compatibility] admits only the exact current execution-preflight root reader`
    - `[ci] admits only the exact required-workflow successor into frozen T09 evidence`
    - `[ci] accepts an append-only M07 successor without rewriting frozen T09 evidence`
- Reason retained: the frozen M06-T09 proof authenticates seven evolving M06-T02 through M06-T08
  readers, embeds the current M06-T05 reader and root-test receipt history, and projects the
  authenticated required-CI successor back to its task-time workflow receipt. These checks protect
  the live edges today but combine immutable T09 evidence, current compatibility, and execution
  coordination in one module.
- Objective removal trigger: the current checkpoint owns the exact seven-reader inventory and
  their current receipts; required-only workflow authority owns current CI authentication; M06-T09
  retains only frozen prerequisite and task-time evidence; all seven tamper cases fail through the
  checkpoint; and required-exhaustive CI preserves the same T02–T09 dependency closure.
- Must close by gate: `G07`
- Exact verification and zero-reference rule:
  - `node scripts/verify-publisher-bundle-publication.mjs`
  - `node --test tests/publisher-bundle-publication.test.mjs`
  - `node scripts/verify-publisher-execution-preflight.mjs`
  - `rg -n "PUBLISHER_BUNDLE_PUBLICATION_COMPATIBILITY_READERS|EXECUTION_PREFLIGHT_COMPATIBILITY_(READER|ROOT_TEST)|APPROVED_COMPATIBILITY_RECEIPT_HISTORY|APPROVED_CURRENT_COMPATIBILITY_RECEIPTS|APPROVED_CURRENT_COMPATIBILITY_PATHS|assertApprovedCurrentCompatibilityBytes|authenticateCurrentCompatibilityReaders|APPROVED_REQUIRED_CI_WORKFLOW_RECEIPT|matchesReceipt|authenticateRequiredCiWorkflow|authenticatedM07T01Prefix|\[compatibility\] externally tracks every current T02 through T09 proof reader|\[compatibility\] detects tamper in each externally anchored T02 through T09 reader|\[compatibility\] admits only the exact current execution-preflight root reader|\[ci\] admits only the exact required-workflow successor into frozen T09 evidence|\[ci\] accepts an append-only M07 successor without rewriting frozen T09 evidence" scripts/lib/publisher-bundle-publication-proof.mjs tests/publisher-bundle-publication.test.mjs`
    must return no matches after removal. The checkpoint may retain the seven exact paths under new
    checkpoint-owned symbols.
- Closure evidence: `PENDING` — record commit, pull request, seven-reader checkpoint receipt
  SHA-256, frozen M06-T09 artifact SHA-256, and hosted required-exhaustive equivalence run URL.

## DEBT-I07-004 — M06-T11 current T09/T10 receipts and source-string markers

- Status: `OPEN`
- Registered by infrastructure task: `I07-01`
- Removal owner: `I07-04`
- Exact paths and symbols:
  - `scripts/lib/publisher-invalid-source-matrix-proof.mjs`
    - `APPROVED_CURRENT_T09_SUCCESSOR_PATHS`
    - `APPROVED_T09_SUCCESSOR_RECEIPT_HISTORY`
    - `APPROVED_CURRENT_T09_SUCCESSOR_RECEIPTS`
    - `APPROVED_CURRENT_T10_SUCCESSOR_PATHS`
    - `APPROVED_CURRENT_T10_SUCCESSOR_RECEIPTS`
    - `REQUIRED_CURRENT_T09_PROOF_MARKERS`
    - `REQUIRED_CURRENT_T09_TEST_MARKERS`
    - `currentT09SuccessorReceipt`
    - `currentT10SuccessorReceipt`
    - `assertCurrentT10SuccessorBytes`
    - `authenticateLiveCurrentT09Successors`
    - `authenticateCurrentT09TrackedInputs`
    - `authenticateLiveCurrentT10Successors`
    - `authenticateCurrentT10TrackedInputs`
    - `currentT10HistoricalReceipt`
    - `assertCurrentT09CompatibilityMarkers`
  - `tests/publisher-invalid-source-matrix.test.mjs`
    - `[authority] distinguishes semantic coordination drift from frozen surface drift`
    - `BUNDLE_PUBLICATION_PROOF_LIBRARY`
    - `BUNDLE_PUBLICATION_ROOT_TEST`
    - `currentT09ProofBytes`
    - `currentT09RootTestBytes`
    - `currentT10ProofBytes`
    - `currentT10RootTestBytes`
    - `approvedCurrentT09`
    - `unreviewedT09ProofBytes`
    - `[successor] accepts an append-only M07 task without rewriting frozen T11 evidence`
  - `scripts/lib/publisher-official-golden-proof.mjs`
    - `APPROVED_REQUIRED_CI_WORKFLOW_RECEIPT`
    - `matchesReceipt`
    - `authenticateRequiredCiWorkflow`
  - `tests/publisher-official-golden.test.mjs`
    - `[ci] admits only the exact required-workflow successor into frozen T10 evidence`
  - current receipt and marker targets:
    - `scripts/lib/publisher-bundle-publication-proof.mjs`
    - `tests/publisher-bundle-publication.test.mjs`
    - `scripts/lib/publisher-official-golden-proof.mjs`
    - `tests/publisher-official-golden.test.mjs`
- Reason retained: M06-T11 must reject unreviewed current T09 and T10 successors while keeping its
  own artifact frozen. It currently does so with exact current file receipts and, for T09, a list
  of required implementation and test source substrings. The checks are intentionally strict but
  duplicate authority now owned by the append-only current-reader checkpoint. The T10 workflow
  projection is also temporary: required-only workflow authority must ultimately own that current
  receipt without making the frozen proof library a second coordination source.
- Objective removal trigger: the current checkpoint authenticates T09 and T10 proof/test bytes and
  structured compatibility results without source-substring inspection; T11 consumes only those
  results plus its frozen task-time receipts; every current tracked-candidate, caller-override,
  live-worktree, and poison mutation remains rejected; and required-exhaustive CI remains green.
- Must close by gate: `G07`
- Exact verification and zero-reference rule:
  - `node scripts/verify-publisher-invalid-source-matrix.mjs`
  - `node --test tests/publisher-invalid-source-matrix.test.mjs`
  - `node scripts/verify-publisher-bundle-publication.mjs`
  - `node --test tests/publisher-bundle-publication.test.mjs`
  - `node scripts/verify-publisher-official-golden.mjs`
  - `node --test tests/publisher-official-golden.test.mjs`
  - `rg -n "APPROVED_CURRENT_T(09|10)_SUCCESSOR_(PATHS|RECEIPTS)|APPROVED_T09_SUCCESSOR_RECEIPT_HISTORY|REQUIRED_CURRENT_T09_(PROOF|TEST)_MARKERS|currentT(09|10)SuccessorReceipt|assertCurrentT10SuccessorBytes|authenticateLiveCurrentT(09|10)Successors|authenticateCurrentT(09|10)TrackedInputs|currentT10HistoricalReceipt|assertCurrentT09CompatibilityMarkers|\[authority\] distinguishes semantic coordination drift from frozen surface drift|BUNDLE_PUBLICATION_(PROOF_LIBRARY|ROOT_TEST)|currentT(09|10)(Proof|RootTest)Bytes|approvedCurrentT09|unreviewedT09ProofBytes|APPROVED_REQUIRED_CI_WORKFLOW_RECEIPT|matchesReceipt|authenticateRequiredCiWorkflow|\[ci\] admits only the exact required-workflow successor into frozen T10 evidence" scripts/lib/publisher-invalid-source-matrix-proof.mjs tests/publisher-invalid-source-matrix.test.mjs scripts/lib/publisher-official-golden-proof.mjs tests/publisher-official-golden.test.mjs`
    must return no matches after removal.
- Closure evidence: `PENDING` — record commit, pull request, structured T09/T10 checkpoint receipt
  SHA-256, frozen M06-T11 artifact SHA-256, and hosted required-exhaustive equivalence run URL.

## DEBT-I07-005 — M07-T01 inventory of twelve live readers

- Status: `OPEN`
- Registered by infrastructure task: `I07-01`
- Removal owner: `I07-04`
- Exact paths and symbols:
  - `scripts/lib/control-plane-bundle-store-proof.mjs`
    - `HISTORICAL_COMPATIBILITY_READERS`
    - `HISTORICAL_TRACKED_RECEIPTS`
    - `APPROVED_M07_T02_TRACKED_RECEIPTS`
    - `APPROVED_M07_T02_PUBLIC_SOURCE_EXPORTS`
    - `HISTORICAL_INDEX_DISTRIBUTION_RECEIPTS`
    - `APPROVED_M07_T02_INDEX_DISTRIBUTION_RECEIPTS`
    - the twelve-reader expansion inside `TRACKED`
    - `currentReaderPaths`
  - `tests/control-plane-bundle-store.test.mjs`
    - `HISTORICAL_COMPATIBILITY_READERS`
    - `currentReaderPaths`
  - the duplicated twelve paths:
    - `scripts/lib/reference-host-web-source-audit-proof.mjs`
    - `tests/reference-host-web-source-audit.test.mjs`
    - `scripts/lib/publisher-publish-result-proof.mjs`
    - `tests/publisher-publish-result.test.mjs`
    - `scripts/lib/publisher-execution-preflight-proof.mjs`
    - `tests/publisher-execution-preflight.test.mjs`
    - `scripts/lib/publisher-catalog-pinning-proof.mjs`
    - `tests/publisher-catalog-pinning.test.mjs`
    - `scripts/lib/publisher-bundle-publication-proof.mjs`
    - `tests/publisher-bundle-publication.test.mjs`
    - `scripts/lib/publisher-invalid-source-matrix-proof.mjs`
    - `tests/publisher-invalid-source-matrix.test.mjs`
- Reason retained: the append-only checkpoint now authenticates eighteen current readers and M07-T01
  verifies that checkpoint before building. Its frozen artifact still needs the historical
  twelve-reader list and task-time receipt projection, so those compatibility structures remain a
  temporary bridge until the dedicated cleanup task.
- Objective removal trigger: M07-T01 consumes only the checkpoint result while its frozen artifact
  remains unchanged, the historical reader array and receipt projection are absent, and mutations
  prove missing, reordered, duplicated, and substituted checkpoint records fail closed.
- Must close by gate: `G07`
- Exact verification and zero-reference rule:
  - `node scripts/verify-control-plane-bundle-store.mjs`
  - `node --test tests/control-plane-bundle-store.test.mjs`
  - all focused verifiers and root tests named by the twelve paths above
  - `rg -n "HISTORICAL_COMPATIBILITY_READERS|HISTORICAL_TRACKED_RECEIPTS|currentReaderPaths" scripts/lib/control-plane-bundle-store-proof.mjs tests/control-plane-bundle-store.test.mjs`
    must return no matches after removal. The twelve paths may appear once in the replacement
    current-checkpoint manifest and in frozen historical projections.
- Closure evidence: `PENDING` — record commit, pull request, eighteen-reader checkpoint manifest
  SHA-256, frozen M07-T01 artifact SHA-256, and hosted required-exhaustive equivalence run URL.

## DEBT-I07-006 — M05-T09 embedded M06-T05 Validator successor

- Status: `OPEN`
- Registered by infrastructure task: `I07-01`
- Removal owner: `I07-04`
- Exact paths and symbols:
  - `scripts/lib/reference-host-web-source-audit-proof.mjs`
    - `M06_T05_VALIDATOR_SUCCESSOR`
    - `uniqueRuntimeResolutionModule`
    - `assertPinnedRuntimeResolutionDigest`
    - `normalizeReviewedValidatorSuccessor`
    - `verifyReferenceHostWebValidatorSuccessorSources`
    - the M06-T05 branch in `verifyReferenceHostWebCurrentEvidencePolicy`
  - `tests/reference-host-web-source-audit.test.mjs`
    - `verifyReferenceHostWebValidatorSuccessorSources`
    - `admits only the source-pinned M06-T05 Validator runtime successor`
  - embedded successor source paths:
    - `packages/validator/src/index.ts`
    - `packages/validator/src/binding-contract-validation.ts`
    - `packages/validator/src/execution-contract-validation.ts`
    - `packages/validator/src/interaction-contract-validation.ts`
    - `packages/validator/src/semantic-validation.ts`
    - `packages/validator/src/structural-validation.ts`
- Reason retained: the enduring M05-T09 source audit needs to recognize one reviewed Validator
  successor introduced through M06-T05. It currently embeds exact source receipts, six built-module
  transitions, graph digests, backing-snapshot digests, indexes, imports, and counters directly in
  the historical M05 reader.
- Objective removal trigger: the current checkpoint owns the M06-T05 Validator successor and
  produces a structured authenticated projection; M05-T09 returns to immutable task-time evidence
  only; the exact six-source, six-module, graph, backing-snapshot, import, index, and counter
  mutations remain rejected; and both exhaustive authority modes preserve the current source-audit
  result.
- Must close by gate: `G07`
- Exact verification and zero-reference rule:
  - `node scripts/verify-reference-host-web-source-audit.mjs`
  - `node --test tests/reference-host-web-source-audit.test.mjs`
  - `node scripts/verify-publisher-execution-preflight.mjs`
  - `rg -n "M06_T05_VALIDATOR_SUCCESSOR|uniqueRuntimeResolutionModule|assertPinnedRuntimeResolutionDigest|normalizeReviewedValidatorSuccessor|verifyReferenceHostWebValidatorSuccessorSources" scripts/lib/reference-host-web-source-audit-proof.mjs tests/reference-host-web-source-audit.test.mjs`
    must return no matches after removal. The replacement checkpoint may retain the exact successor
    records under checkpoint-owned symbols.
- Closure evidence: `PENDING` — record commit, pull request, Validator-successor checkpoint
  receipt SHA-256, frozen M05-T09 artifact SHA-256, and hosted required-exhaustive equivalence run
  URL.

## DEBT-I07-007 — Legacy sequential runner and workflow path

- Status: `OPEN`
- Registered by infrastructure task: `I07-01`
- Removal owner: `I07-05`
- Exact paths and symbols:
  - `scripts/run-ci-quality-gate.mjs`
    - `createQualityGateSteps`
    - `runStepSequence`
    - `executeQualityGate`
    - `executeDefaultQualityGate`
    - `activeChild`
  - `scripts/test/ci-quality-gate.test.mjs`
    - `createQualityGateSteps`
    - `runStepSequence`
    - `executeQualityGate`
    - `executeDefaultQualityGate`
    - `activeChild`
  - `scripts/ci/required-exhaustive-equivalence.mjs`
    - `../run-ci-quality-gate.mjs`
    - `createRetainedSequentialSteps`
    - `validateRetainedSequentialPlan`
    - `EXPECTED_RETAINED_PLAN_SHA256`
    - `verifyRequiredExhaustiveInventoryEquivalence`
  - `scripts/ci/test/required-exhaustive-equivalence.test.mjs`
    - `../../run-ci-quality-gate.mjs`
    - `createRetainedSequentialSteps`
    - `EXPECTED_RETAINED_PLAN_SHA256`
    - `verifyRequiredExhaustiveInventoryEquivalence`
    - `retained-plan omission, reorder, argv substitution, and duplicate fail closed`
    - `RETAINED_LEGACY_COMMAND`
    - `official CI admits only required exhaustive authority and a manual legacy rollback`
  - `tests/publisher-bundle-publication.test.mjs`
    - `createQualityGateSteps`
  - `tests/publisher-catalog-pinning.test.mjs`
    - `createQualityGateSteps`
  - `tests/publisher-invalid-source-matrix.test.mjs`
    - `createQualityGateSteps`
  - `tests/control-plane-bundle-store.test.mjs`
    - `createQualityGateSteps`
  - `.github/workflows/ci.yml`
    - `legacy-rollback`
    - `legacy-pnpm-store`
    - `Legacy rollback`
    - `Run retained legacy rollback`
    - `node scripts/run-ci-quality-gate.mjs`
- Reason retained: the required-exhaustive scheduler is the hosted authority, while the existing
  sequential runner remains available only through an explicitly selected manual rollback job.
  The required-exhaustive equivalence module and its focused test are also rollback-only adapters:
  they import and compare the retained sequential plan but are not required-execution authority.
  Removing these structures before the scheduled rollback exercise would discard the controlled
  recovery path before its retirement evidence exists.
- Objective removal trigger: ADR 0011's exhaustive, affected-selector, and retirement cleanup
  gates all pass; the modular `REQUIRED + EXHAUSTIVE` schedule covers every legacy workload from
  fresh inputs; unknown selection always becomes `EXHAUSTIVE`; no proof success is read from cache;
  hosted pass/fail and cancellation equivalence is archived; and a rollback exercise proves the
  retained legacy path is no longer needed. I07-05 then removes the legacy runner, its tests, the
  hosted legacy invocation, and both rollback-only required-equivalence paths together; any
  enduring required receipt normalization must live under required-only authority with no retained
  sequential import or digest comparison.
- Must close by gate: `G12`
- Exact verification and zero-reference rule:
  - `node --test scripts/test/ci-quality-gate.test.mjs`
  - run the retained legacy gate and modular `REQUIRED + EXHAUSTIVE` gate from separate clean
    checkouts and compare their normalized inventory, workload set, terminal result, and
    tracked-workspace snapshots
  - run selector mutation tests, including unknown path, incomplete diff base, missing owner,
    malformed graph, cancellation, and first-failure cases
  - run the final hosted workflow and archive its URL and timing
  - scoped zero-reference verification must cover every exact DEBT-I07-007 target above and find
    none of its machine-owned symbols after retirement. Both
    `scripts/ci/required-exhaustive-equivalence.mjs` and
    `scripts/ci/test/required-exhaustive-equivalence.test.mjs` must be absent rather than retained
    as adapters after the sequential authority is removed. The `scripts/run-ci-quality-gate.mjs`
    path may remain only if it has become a modular entry point without the legacy symbols;
    aggregate package compatibility commands may remain, but they may not be hosted execution
    authority.
- Closure evidence: `PENDING` — record commit, pull request, legacy/modular equivalence artifact
  SHA-256, hosted exhaustive and affected run URLs, cancellation receipt, and final workflow
  SHA-256.

## DEBT-I07-008 — Shadow workflow and legacy-authority adapter

- Status: `CLOSED`
- Registered by infrastructure task: `I07-01`
- Removal owner: `I07-02`
- Exact paths and symbols:
  - `.github/workflows/ci-v2-shadow.yml`
    - `CI v2 shadow`
    - `modular-shadow`
    - `Exhaustive modular shadow`
    - `Run exhaustive modular shadow`
  - `scripts/ci/run-modular-quality-gate.mjs`
    - `../run-ci-quality-gate.mjs`
    - `PROOF_ENTRIES`
    - `createQualityGateSteps`
    - `executeQualityGate`
    - `validateQualityGatePlan`
  - `scripts/ci/test/modular-quality-gate.test.mjs`
    - `../../run-ci-quality-gate.mjs`
    - `PROOF_ENTRIES`
    - `createQualityGateSteps`
- Closure result: I07-02 recorded same-revision local and hosted equivalence, introduced code-owned
  shared-state/output/port/temp-path classification, and promoted the required-exhaustive runner to
  official CI authority. The shadow workflow, legacy-authority adapter, and its focused adapter
  test were deleted. Their exact target records remain here and in the code-owned manifest so the
  closed zero-reference rule continues to prevent accidental restoration.
- Objective removal trigger: `SATISFIED` — the official workflow runs the exhaustive modular path
  as required authority, the retained sequential runner is available only through the separately
  registered manual rollback in DEBT-I07-007, and no shadow-only execution authority remains.
- Must close by gate: `G07`
- Exact verification and zero-reference rule:
  - the I07-02 required-exhaustive equivalence verifier and mutation tests
  - the hosted required exhaustive workflow from a clean checkout
  - scoped zero-reference verification must cover only the three exact DEBT-I07-008 targets above
    and find none of their machine-owned symbols after the shared neutral inventory replaces the
    adapter. The debt manifest, verifier, tests, and this register are authority records and are
    intentionally outside that target set.
- Closure evidence: `CLOSURE` — authenticated by:
  - cutover commit: `3cf72552ee3ea23a0b5e99f782f837bc6237f78b`
  - pull request: `https://github.com/desenlab/desen-app/pull/16`
  - evidence artifact: `docs/proof/baselines/i07-02-required-exhaustive-equivalence.json`
  - evidence SHA-256: `6b876b09f94517e27098076c9f16e207368ef8d31eb70b0ae2f187b15757345d`
  - hosted required-exhaustive run: `https://github.com/desenlab/desen-app/actions/runs/30699616361`
  - the evidence artifact records the neutral-inventory and retired target receipts, including the
    removed shadow workflow.

## DEBT-I07-009 — M05-T09 current M07-T06 coordination projection

- Status: `OPEN`
- Registered by infrastructure task: `I07-01`
- Removal owner: `I07-04`
- Exact paths and symbols:
  - `scripts/lib/reference-host-web-source-audit-proof.mjs`
    - `M07_T06_CONTROL_PLANE_COORDINATION`
    - `M07_T06_CONTROL_PLANE_LOCKFILE_BLOCK`
    - `APPROVED_M07_T06_DEPENDENCY_POLICY_SUCCESSOR`
    - `normalizeCurrentRootPackageBytes`
    - `inspectExactControlPlaneImporter`
    - `normalizeCurrentLockfileBytes`
  - `tests/reference-host-web-source-audit.test.mjs`
    - `reviewed Publisher and M07-T06 coordination preserve root, package, and lockfile provenance`
- Reason retained: the frozen M05-T09 artifact still projects its task-time root package and
  lockfile bytes, while the live workspace now contains the reviewed M07-T01 through M07-T06
  control-plane commands, runtime-staging package dependency and test script, aggregate edges,
  native-addon policy, Validator/runtime-core importers, and the exact control-plane-only
  dependency-cruiser allowance. The current source-audit successor authenticates that complete
  T06 command and dependency graph while proving the reference-host boundary itself is unchanged.
- Objective removal trigger: the current checkpoint owns the exact M07-T06 root-command,
  aggregate-edge, dependency-policy, boundary-config, and lock-importer receipts; M05-T09 consumes only the
  checkpoint result and returns to its immutable task-time coordination projection; and every
  missing, duplicated, reordered, substituted, quoted, or extra control-plane authority mutation
  remains rejected.
- Must close by gate: `G07`
- Exact verification and zero-reference rule:
  - `node scripts/verify-reference-host-web-source-audit.mjs`
  - `node --test tests/reference-host-web-source-audit.test.mjs`
  - `rg -n "M07_T06_CONTROL_PLANE_(COORDINATION|LOCKFILE_BLOCK)|APPROVED_M07_T06_DEPENDENCY_POLICY_SUCCESSOR|normalizeCurrentRootPackageBytes|inspectExactControlPlaneImporter|normalizeCurrentLockfileBytes|reviewed Publisher and M07-T06 coordination preserve root, package, and lockfile provenance" scripts/lib/reference-host-web-source-audit-proof.mjs tests/reference-host-web-source-audit.test.mjs`
    must return no matches after removal. The replacement checkpoint may retain exact M07-T06
    receipts under checkpoint-owned symbols.
- Closure evidence: `PENDING` — record commit, pull request, replacement coordination-checkpoint
  SHA-256, frozen M05-T09 artifact SHA-256, and hosted required-exhaustive equivalence run URL.

## DEBT-I07-010 — M05-T04 current M07-T03 P-05 successor projection

- Status: `OPEN`
- Registered by infrastructure task: `I07-01`
- Removal owner: `I07-04`
- Exact paths and symbols:
  - `scripts/lib/runtime-react-interactions-proof.mjs`
    - `EXPECTED_CURRENT_P05_SUCCESSOR`
    - `p05HistoricalStatus`
    - `p05CurrentStatus`
    - `p05SuccessorArtifactSha256`
  - `tests/runtime-react-interactions.test.mjs`
    - `SUCCESSOR_SHA256`
    - `SUCCESSOR_ARTIFACT_FILE_NAME`
    - `SUCCESSOR_EVIDENCE_TEXT`
    - `rejects P-05 monotonic M07-T03 successor closure or P-06 historical pin drift`
- Reason retained: the frozen M05-T04 artifact preserves the task-time `P-05: PARTIAL` claim,
  while M07-T03 legitimately closes the live Proof Matrix row as `PROVEN`. The current interaction
  reader must preserve both facts and reject a missing, substituted, downgraded, or falsely
  attributed M07-T03 successor without rewriting the immutable M05-T04 artifact.
- Objective removal trigger: the current checkpoint owns the structured M07-T03 P-05 successor
  projection and exact M05-T04 reader receipts; the historical interaction reader consumes only
  that authenticated checkpoint result plus its immutable task-time evidence; all status, owner,
  evidence-text, artifact-path, and artifact-hash mutations remain rejected; and both frozen
  artifacts remain byte-identical.
- Must close by gate: `G07`
- Exact verification and zero-reference rule:
  - `node scripts/verify-runtime-react-interactions.mjs`
  - `node --test tests/runtime-react-interactions.test.mjs`
  - `node scripts/ci/verify-proof-reader-checkpoints.mjs`
  - `rg -n "EXPECTED_CURRENT_P05_SUCCESSOR|p05HistoricalStatus|p05CurrentStatus|p05SuccessorArtifactSha256|SUCCESSOR_SHA256|SUCCESSOR_ARTIFACT_FILE_NAME|SUCCESSOR_EVIDENCE_TEXT|rejects P-05 monotonic M07-T03 successor closure or P-06 historical pin drift" scripts/lib/runtime-react-interactions-proof.mjs tests/runtime-react-interactions.test.mjs`
    must return no matches after removal. The replacement checkpoint may retain the exact M07-T03
    semantic successor and M05-T04 reader receipts under checkpoint-owned symbols.
- Closure evidence: `PENDING` — record commit, pull request, replacement semantic-checkpoint
  SHA-256, frozen M05-T04 and M07-T03 artifact SHA-256 values, and hosted required-exhaustive
  equivalence run URL.

## DEBT-I07-011 — M07-T04 current-reader and P-17 successor bridges

- Status: `OPEN`
- Registered by infrastructure task: `M07-T04`
- Removal owner: `I07-04`
- Exact paths and symbols:
  - `scripts/lib/runtime-react-failure-boundary-proof.mjs`
    - `EXPECTED_CURRENT_P17_SUCCESSOR`
    - `p17HistoricalStatus`
    - `p17CurrentStatus`
    - `p17SuccessorArtifactSha256`
  - `tests/runtime-react-failure-boundary.test.mjs`
    - `SUCCESSOR_SHA256`
    - `SUCCESSOR_ARTIFACT_FILE_NAME`
    - `SUCCESSOR_EVIDENCE_TEXT`
    - `rejects N-037, monotonic P-17 successor, and PF-055 current-closure drift`
  - `scripts/lib/control-plane-bundle-store-proof.mjs`
    - `APPROVED_M07_T04_TRACKED_RECEIPTS`
    - `APPROVED_M07_T04_PUBLIC_SOURCE_EXPORTS`
    - `APPROVED_M07_T04_INDEX_DISTRIBUTION_RECEIPTS`
    - `approvedM07T04`
  - `tests/control-plane-bundle-store.test.mjs`
    - `changedPackageByte`
    - `indexWithAppendedTail`
  - `scripts/lib/control-plane-bundle-verification-proof.mjs`
    - `APPROVED_M07_T04_PUBLIC_SOURCE_EXPORTS`
    - `APPROVED_M07_T04_PUBLIC_RUNTIME_KEYS`
    - `APPROVED_M07_T04_TRACKED_RECEIPTS`
    - `APPROVED_M07_T04_INDEX_DISTRIBUTION_RECEIPTS`
    - `approvedM07T04`
    - `approvedM07T04Keys`
    - `reviewedSuccessor`
  - `tests/control-plane-bundle-verification.test.mjs`
    - `APP_INDEX`
    - `indexWithAppendedTail`
  - `scripts/lib/control-plane-package-preflight-proof.mjs`
    - `APPROVED_M07_T04_PUBLIC_SOURCE_EXPORTS`
    - `APPROVED_M07_T04_PUBLIC_RUNTIME_KEYS`
    - `APPROVED_M07_T04_TRACKED_RECEIPTS`
    - `APPROVED_M07_T04_INDEX_DISTRIBUTION_RECEIPTS`
    - `approvedM07T04`
    - `taskTimeTail`
    - `successorIndex`
    - `reviewedSuccessor`
    - `reviewedSuccessorTail`
    - `pnpm verify:control-plane-reference-preflight`
    - `pnpm test:control-plane-reference-preflight`
  - `tests/control-plane-package-preflight.test.mjs`
    - `indexWithAppendedTail`
    - `unreviewed successor tail`
- Reason retained: the frozen M05-T06 artifact truthfully preserves its task-time `P-17: PARTIAL`
  projection and its exact M07-T04 remainder, while M07-T04 legitimately closes the live Proof
  Matrix row as `PROVEN`. The current failure-boundary reader must preserve both facts and reject a
  missing, substituted, downgraded, or falsely attributed M07-T04 successor without rewriting the
  immutable 9,534-byte M05-T06 artifact. The frozen M07-T01 through M07-T03 readers must likewise
  project their task-time package roots while admitting only the exact M07-T04 package, export,
  distribution, and runtime receipts; their six proof/test reader files therefore carry temporary
  successor branches until I07-04 moves current authentication fully into the checkpoint.
- Objective removal trigger: the current checkpoint owns the structured M07-T04 P-17 successor,
  the exact M07-T04 artifact, current M05-T06 proof/test receipts, and the M07-T01 through M07-T04
  control-plane package/export/distribution transition. Historical readers consume only that
  authenticated checkpoint plus immutable task-time evidence; every receipt, export, runtime-key,
  status, owner, evidence-text, artifact-path, and artifact-hash mutation remains rejected; and all
  frozen artifacts remain byte-identical.
- Must close by gate: `G07`
- Exact verification and zero-reference rule:
  - `node scripts/verify-runtime-react-failure-boundary.mjs`
  - `node --test tests/runtime-react-failure-boundary.test.mjs`
  - `node scripts/verify-control-plane-bundle-store.mjs`
  - `node --test tests/control-plane-bundle-store.test.mjs`
  - `node scripts/verify-control-plane-bundle-verification.mjs`
  - `node --test tests/control-plane-bundle-verification.test.mjs`
  - `node scripts/verify-control-plane-package-preflight.mjs`
  - `node --test tests/control-plane-package-preflight.test.mjs`
  - `node scripts/ci/verify-proof-reader-checkpoints.mjs`
  - `rg -n "EXPECTED_CURRENT_P17_SUCCESSOR|p17HistoricalStatus|p17CurrentStatus|p17SuccessorArtifactSha256|SUCCESSOR_SHA256|SUCCESSOR_ARTIFACT_FILE_NAME|SUCCESSOR_EVIDENCE_TEXT|rejects N-037, monotonic P-17 successor, and PF-055 current-closure drift|APPROVED_M07_T04_(TRACKED_RECEIPTS|PUBLIC_SOURCE_EXPORTS|PUBLIC_RUNTIME_KEYS|INDEX_DISTRIBUTION_RECEIPTS)|approvedM07T04(Keys)?|taskTimeTail|successorIndex|reviewedSuccessor(Tail)?|pnpm (verify|test):control-plane-reference-preflight|changedPackageByte|indexWithAppendedTail|APP_INDEX|unreviewed successor tail" scripts/lib/runtime-react-failure-boundary-proof.mjs tests/runtime-react-failure-boundary.test.mjs scripts/lib/control-plane-bundle-store-proof.mjs tests/control-plane-bundle-store.test.mjs scripts/lib/control-plane-bundle-verification-proof.mjs tests/control-plane-bundle-verification.test.mjs scripts/lib/control-plane-package-preflight-proof.mjs tests/control-plane-package-preflight.test.mjs`
    must return no matches after removal. The replacement checkpoint may retain the exact M07-T04
    semantic successor, M05-T06 reader receipts, and control-plane transition under
    checkpoint-owned symbols.
- Closure evidence: `PENDING` — record commit, pull request, replacement semantic-checkpoint
  SHA-256, frozen M05-T06 plus M07-T01 through M07-T04 artifact SHA-256 values, and hosted
  required-exhaustive equivalence run URL.

## DEBT-I07-012 — M07-T05 historical control-plane reader bridges

- Status: `OPEN`
- Registered by infrastructure task: `M07-T05`
- Removal owner: `I07-04`
- Exact paths and symbols:
  - `scripts/lib/control-plane-bundle-store-proof.mjs`
    - `APPROVED_M07_T05_TRACKED_RECEIPTS`
    - `APPROVED_M07_T05_PUBLIC_SOURCE_EXPORTS`
    - `APPROVED_M07_T05_PUBLIC_RUNTIME_KEYS`
    - `APPROVED_M07_T05_INDEX_DISTRIBUTION_RECEIPTS`
  - `scripts/lib/control-plane-bundle-verification-proof.mjs`
    - `APPROVED_M07_T05_TRACKED_RECEIPTS`
    - `APPROVED_M07_T05_PUBLIC_SOURCE_EXPORTS`
    - `APPROVED_M07_T05_PUBLIC_RUNTIME_KEYS`
    - `APPROVED_M07_T05_INDEX_DISTRIBUTION_RECEIPTS`
    - `M07_T05_BUNDLE_VERIFICATION_INTERNAL_TRACKED_RECEIPT_BRIDGE`
    - `M07_T05_BUNDLE_VERIFICATION_INTERNAL_DISTRIBUTION_RECEIPT_BRIDGE`
  - `tests/control-plane-bundle-verification.test.mjs`
    - `APP_BUNDLE_VERIFICATION_INTERNAL`
    - `relativePath === APP_BUNDLE_VERIFICATION_INTERNAL`
  - `scripts/lib/control-plane-package-preflight-proof.mjs`
    - `APPROVED_M07_T05_TRACKED_RECEIPTS`
    - `APPROVED_M07_T05_PUBLIC_SOURCE_EXPORTS`
    - `APPROVED_M07_T05_PUBLIC_RUNTIME_KEYS`
    - `APPROVED_M07_T05_INDEX_DISTRIBUTION_RECEIPTS`
    - `M07_T05_AGGREGATE_SUCCESSOR_COMMANDS`
  - `tests/control-plane-package-preflight.test.mjs`
    - `pnpm verify:control-plane-reference-preflight && pnpm verify:control-plane-local-api`
  - `scripts/lib/control-plane-reference-preflight-proof.mjs`
    - `APPROVED_M07_T05_TRACKED_RECEIPTS`
    - `APPROVED_M07_T05_PUBLIC_SOURCE_EXPORTS`
    - `APPROVED_M07_T05_PUBLIC_RUNTIME_KEYS`
    - `APPROVED_M07_T05_INDEX_DISTRIBUTION_RECEIPTS`
    - `HISTORICAL_M07_T04_TRACKED_RECEIPTS`
    - `HISTORICAL_M07_T04_INDEX_DISTRIBUTION_RECEIPTS`
  - `tests/control-plane-bundle-store.test.mjs`
    - `[registration] rejects package-root, public-export, aggregate, or CI tuple drift`
    - `REGISTRATION_DRIFT`
  - `tests/publisher-catalog-pinning.test.mjs`
    - `appendValidRootSuccessor`
  - `scripts/lib/control-plane-local-api-proof.mjs`
    - `M07_T05_STRICT_JSON_FORMATTING_TRACKED_RECEIPT_BRIDGE`
    - `M07_T05_STRICT_JSON_FORMATTING_DISTRIBUTION_RECEIPT_BRIDGE`
    - `M07_T05_FORMATTING_READER_RECEIPT_PROJECTION`
    - `M07_T05_ADR_TOKEN_BOUNDS_TRACKED_RECEIPT_BRIDGE`
  - `tests/control-plane-local-api.test.mjs`
    - `APP_STRICT_JSON`
    - `ADR`
    - `[implementation] rejects transport, repository, SQLite, or public-factory source drift`
- Reason retained: the frozen M07-T01 through M07-T04 readers preserve their task-time package,
  public-export, runtime-key, and distribution projections. M07-T05 legitimately adds the local
  control-plane API and its public surface, so each historical reader carries a narrowly pinned
  successor branch. The M07-T04 reader additionally retains explicit task-time receipts while it
  authenticates the exact M07-T05 transition. The frozen M06-T08 Catalog-pinning root test retains
  one bounded append-only successor helper. The M07-T01 bundle-store test retains its scoped
  registration-drift boundary, while its later T06 aggregate successor and the Catalog helper's
  current command literals are separately owned by DEBT-I07-013. The frozen M07-T05 reader
  additionally bridges the formatting-only strict-JSON receipt change and the ADR token-bound
  receipt change, keeping both sources inside the existing implementation-drift root case.
- Objective removal trigger: the current checkpoint owns the exact M07-T05 package, tracked-file,
  public-export, runtime-key, and distribution receipts plus the M07-T04 task-time receipts;
  historical readers, formatting bridges, and test-only compatibility fixtures consume only that
  checkpoint and immutable task evidence; every missing, substituted, reordered, or appended
  transition remains rejected; and all frozen artifacts stay byte-identical.
- Must close by gate: `G07`
- Exact verification and zero-reference rule:
  - `node scripts/verify-control-plane-bundle-store.mjs`
  - `node --test tests/control-plane-bundle-store.test.mjs`
  - `node scripts/verify-control-plane-bundle-verification.mjs`
  - `node --test tests/control-plane-bundle-verification.test.mjs`
  - `node scripts/verify-control-plane-package-preflight.mjs`
  - `node --test tests/control-plane-package-preflight.test.mjs`
  - `node scripts/verify-control-plane-reference-preflight.mjs`
  - `node --test tests/control-plane-reference-preflight.test.mjs`
  - `node scripts/verify-publisher-catalog-pinning.mjs`
  - `node --test tests/publisher-catalog-pinning.test.mjs`
  - `node scripts/verify-control-plane-local-api.mjs`
  - `node --test tests/control-plane-local-api.test.mjs`
  - `node scripts/ci/verify-proof-reader-checkpoints.mjs`
  - `rg -n "APPROVED_M07_T05_(TRACKED_RECEIPTS|PUBLIC_SOURCE_EXPORTS|PUBLIC_RUNTIME_KEYS|INDEX_DISTRIBUTION_RECEIPTS)|M07_T05_BUNDLE_VERIFICATION_INTERNAL_(TRACKED|DISTRIBUTION)_RECEIPT_BRIDGE|M07_T05_AGGREGATE_SUCCESSOR_COMMANDS|APP_BUNDLE_VERIFICATION_INTERNAL|relativePath === APP_BUNDLE_VERIFICATION_INTERNAL|pnpm verify:control-plane-reference-preflight && pnpm verify:control-plane-local-api|HISTORICAL_M07_T04_(TRACKED_RECEIPTS|INDEX_DISTRIBUTION_RECEIPTS)|appendValidRootSuccessor|pnpm (verify|test):control-plane-local-api|M07_T05_STRICT_JSON_FORMATTING_(TRACKED|DISTRIBUTION)_RECEIPT_BRIDGE|M07_T05_FORMATTING_READER_RECEIPT_PROJECTION|M07_T05_ADR_TOKEN_BOUNDS_TRACKED_RECEIPT_BRIDGE|APP_STRICT_JSON|ADR|\[implementation\] rejects transport, repository, SQLite, or public-factory source drift" scripts/lib/control-plane-bundle-store-proof.mjs scripts/lib/control-plane-bundle-verification-proof.mjs tests/control-plane-bundle-verification.test.mjs scripts/lib/control-plane-package-preflight-proof.mjs tests/control-plane-package-preflight.test.mjs scripts/lib/control-plane-reference-preflight-proof.mjs tests/control-plane-bundle-store.test.mjs tests/publisher-catalog-pinning.test.mjs scripts/lib/control-plane-local-api-proof.mjs tests/control-plane-local-api.test.mjs`
    must return no matches after removal. The replacement checkpoint may retain these exact
    transition receipts under checkpoint-owned symbols. The bundle-store registration error is
    scoped to the named registration test above; unrelated error taxonomies are not part of this
    entry.
- Closure evidence: `PENDING` — record commit, pull request, replacement reader-checkpoint
  SHA-256, frozen M07-T01 through M07-T05 artifact SHA-256 values, and hosted required-exhaustive
  equivalence run URL.

## DEBT-I07-013 — M07-T06 historical staging reader bridges

- Status: `OPEN`
- Registered by infrastructure task: `M07-T06`
- Removal owner: `I07-04`
- Exact paths and symbols:
  - `scripts/lib/control-plane-bundle-store-proof.mjs`
    - `RUNTIME_STAGING_VALUE_EXPORTS`
    - `RUNTIME_STAGING_TYPE_EXPORTS`
    - `APPROVED_M07_T06_PUBLIC_SOURCE_EXPORTS`
    - `APPROVED_M07_T06_PUBLIC_RUNTIME_KEYS`
    - `APPROVED_M07_T06_TRACKED_RECEIPTS`
    - `APPROVED_M07_T06_INDEX_DISTRIBUTION_RECEIPTS`
  - `tests/control-plane-bundle-store.test.mjs`
    - `stageBundleRuntimeChanged`
    - `unreviewedRuntimeSuccessor`
    - `export { stageBundleRuntime } from "./runtime-staging.js";`
  - `scripts/lib/control-plane-bundle-verification-proof.mjs`
    - `APPROVED_M07_T06_PUBLIC_SOURCE_EXPORTS`
    - `APPROVED_M07_T06_PUBLIC_RUNTIME_KEYS`
    - `APPROVED_M07_T06_TRACKED_RECEIPTS`
    - `APPROVED_M07_T06_INDEX_DISTRIBUTION_RECEIPTS`
  - `tests/control-plane-bundle-verification.test.mjs`
    - `changedStagingExport`
    - `stageBundleRuntimeChanged`
    - `unreviewedRuntimeSuccessor`
  - `scripts/lib/control-plane-package-preflight-proof.mjs`
    - `APPROVED_M07_T06_PUBLIC_SOURCE_EXPORTS`
    - `APPROVED_M07_T06_PUBLIC_RUNTIME_KEYS`
    - `APPROVED_M07_T06_TRACKED_RECEIPTS`
    - `APPROVED_M07_T06_INDEX_DISTRIBUTION_RECEIPTS`
    - `M07_T06_AGGREGATE_SUCCESSOR_COMMANDS`
  - `tests/control-plane-package-preflight.test.mjs`
    - `stageBundleRuntimeChanged`
    - `pnpm verify:control-plane-runtime-staging-decoy`
    - `unreviewedRuntimeSuccessor`
  - `scripts/lib/control-plane-reference-preflight-proof.mjs`
    - `APPROVED_M07_T06_PUBLIC_SOURCE_EXPORTS`
    - `APPROVED_M07_T06_PUBLIC_RUNTIME_KEYS`
    - `APPROVED_M07_T06_TRACKED_RECEIPTS`
    - `APPROVED_M07_T06_INDEX_DISTRIBUTION_RECEIPTS`
    - `reviewedLaterSuccessor`
  - `tests/control-plane-reference-preflight.test.mjs`
    - `stageBundleRuntimeChanged`
    - `pnpm verify:control-plane-runtime-staging-decoy`
    - `unreviewedRuntimeSuccessor`
  - `scripts/lib/control-plane-local-api-proof.mjs`
    - `M07_T06_TRACKED_RECEIPT_BRIDGE`
    - `M07_T06_INDEX_DISTRIBUTION_RECEIPT_BRIDGE`
    - `APPROVED_M07_T06_PUBLIC_SOURCE_EXPORTS`
    - `APPROVED_M07_T06_PUBLIC_RUNTIME_KEYS`
  - `tests/control-plane-local-api.test.mjs`
    - `runControlPlaneLocalApiProbe`
    - `LOCKFILE`
    - `SHARED_STATE_AUTHORITY`
    - `liveRuntimeReceipt`
    - `successorBuild`
    - `successorKeyMutations`
    - `stageBundleRuntimeUnsafe`
    - `unreviewedRuntimeExport`
- Reason retained: the frozen M07-T01 through M07-T05 readers preserve task-time package,
  public-export, runtime-key, aggregate, distribution, and CI projections. M07-T06 legitimately
  adds the runtime-staging boundary and its `@desen/runtime-core` dependency to the same application,
  so each historical reader carries one narrowly pinned T05-to-T06 successor branch while its
  frozen artifact remains byte-identical. The superseded T06 Catalog-pinning command-tail markers
  have moved forward under DEBT-I07-014 rather than remaining falsely listed as live T06
  references. Reviewed sequence 15 owns the exact current receipts; the remaining reader-local bridges
  remain temporary until I07-04 centralizes current authentication.
- Objective removal trigger: sequence 15 or its reviewed replacement authenticates the exact
  M07-T06 package, tracked files, public exports, runtime keys, generated distribution, aggregate
  tails, and all ten historical control-plane readers; T01 through T05 consume those checkpoint
  receipts without reader-local successor allowlists; every substituted, reordered, missing, or
  appended transition remains fail-closed; and all six M07-T01 through M07-T06 artifacts stay
  byte-identical.
- Must close by gate: `G07`
- Exact verification and zero-reference rule:
  - `node scripts/verify-control-plane-bundle-store.mjs`
  - `node --test tests/control-plane-bundle-store.test.mjs`
  - `node scripts/verify-control-plane-bundle-verification.mjs`
  - `node --test tests/control-plane-bundle-verification.test.mjs`
  - `node scripts/verify-control-plane-package-preflight.mjs`
  - `node --test tests/control-plane-package-preflight.test.mjs`
  - `node scripts/verify-control-plane-reference-preflight.mjs`
  - `node --test tests/control-plane-reference-preflight.test.mjs`
  - `node scripts/verify-control-plane-local-api.mjs`
  - `node --test tests/control-plane-local-api.test.mjs`
  - `node scripts/verify-control-plane-runtime-staging.mjs`
  - `node --test tests/control-plane-runtime-staging.test.mjs`
  - `node scripts/ci/verify-proof-reader-checkpoints.mjs`
  - `rg -n "RUNTIME_STAGING_(VALUE|TYPE)_EXPORTS|APPROVED_M07_T06_(PUBLIC_SOURCE_EXPORTS|PUBLIC_RUNTIME_KEYS|TRACKED_RECEIPTS|INDEX_DISTRIBUTION_RECEIPTS)|M07_T06_AGGREGATE_SUCCESSOR_COMMANDS|reviewedLaterSuccessor|M07_T06_(TRACKED_RECEIPT_BRIDGE|INDEX_DISTRIBUTION_RECEIPT_BRIDGE)|changedStagingExport|stageBundleRuntimeChanged|unreviewedRuntimeSuccessor|control-plane-successor|pnpm (verify|test):control-plane-runtime-staging|pnpm verify:control-plane-runtime-staging-decoy|runControlPlaneLocalApiProbe|SHARED_STATE_AUTHORITY|liveRuntimeReceipt|successorBuild|successorKeyMutations|stageBundleRuntimeUnsafe|unreviewedRuntimeExport" scripts/lib/control-plane-bundle-store-proof.mjs tests/control-plane-bundle-store.test.mjs scripts/lib/control-plane-bundle-verification-proof.mjs tests/control-plane-bundle-verification.test.mjs scripts/lib/control-plane-package-preflight-proof.mjs tests/control-plane-package-preflight.test.mjs scripts/lib/control-plane-reference-preflight-proof.mjs tests/control-plane-reference-preflight.test.mjs scripts/lib/control-plane-local-api-proof.mjs tests/control-plane-local-api.test.mjs tests/publisher-catalog-pinning.test.mjs`
    must return no matches after removal. The replacement checkpoint may retain exact receipts under
    checkpoint-owned symbols; production M07-T06 staging names outside these scoped historical
    reader files are not part of this zero-reference rule.
- Closure evidence: `PENDING` — record commit, pull request, replacement reader-checkpoint SHA-256,
  frozen M07-T01 through M07-T06 artifact SHA-256 values, and hosted required-exhaustive
  equivalence run URL.

## DEBT-I07-014 — M07-T07 historical activation reader bridges

- Status: `OPEN`
- Registered by infrastructure task: `M07-T07`
- Removal owner: `I07-04`
- Exact paths and symbols:
  - `scripts/lib/reference-host-web-source-audit-proof.mjs`
    - `M07_T07_CONTROL_PLANE_COORDINATION`
  - `scripts/lib/control-plane-bundle-store-proof.mjs`
    - `RUNTIME_ACTIVATION_VALUE_EXPORTS`
    - `RUNTIME_ACTIVATION_TYPE_EXPORTS`
    - `APPROVED_M07_T07_TRACKED_RECEIPTS`
    - `APPROVED_M07_T07_PUBLIC_SOURCE_EXPORTS`
    - `APPROVED_M07_T07_PUBLIC_RUNTIME_KEYS`
    - `APPROVED_M07_T07_INDEX_DISTRIBUTION_RECEIPTS`
  - `tests/control-plane-bundle-store.test.mjs`
    - `openBundleRuntimeActivationChanged`
  - `scripts/lib/control-plane-bundle-verification-proof.mjs`
    - `APPROVED_M07_T07_PUBLIC_SOURCE_EXPORTS`
    - `APPROVED_M07_T07_PUBLIC_RUNTIME_KEYS`
    - `APPROVED_M07_T07_TRACKED_RECEIPTS`
    - `APPROVED_M07_T07_INDEX_DISTRIBUTION_RECEIPTS`
  - `tests/control-plane-bundle-verification.test.mjs`
    - `changedActivationExport`
  - `scripts/lib/control-plane-package-preflight-proof.mjs`
    - `APPROVED_M07_T07_PUBLIC_SOURCE_EXPORTS`
    - `APPROVED_M07_T07_PUBLIC_RUNTIME_KEYS`
    - `APPROVED_M07_T07_TRACKED_RECEIPTS`
    - `APPROVED_M07_T07_INDEX_DISTRIBUTION_RECEIPTS`
    - `M07_T07_AGGREGATE_SUCCESSOR_COMMANDS`
  - `tests/control-plane-package-preflight.test.mjs`
    - `openBundleRuntimeActivationChanged`
    - `pnpm verify:control-plane-runtime-activation-decoy`
  - `scripts/lib/control-plane-reference-preflight-proof.mjs`
    - `APPROVED_M07_T07_PUBLIC_SOURCE_EXPORTS`
    - `APPROVED_M07_T07_PUBLIC_RUNTIME_KEYS`
    - `APPROVED_M07_T07_TRACKED_RECEIPTS`
    - `APPROVED_M07_T07_INDEX_DISTRIBUTION_RECEIPTS`
  - `tests/control-plane-reference-preflight.test.mjs`
    - `openBundleRuntimeActivationChanged`
    - `pnpm verify:control-plane-runtime-activation-decoy`
  - `scripts/lib/control-plane-local-api-proof.mjs`
    - `M07_T07_TRACKED_RECEIPT_BRIDGE`
    - `M07_T07_INDEX_DISTRIBUTION_RECEIPT_BRIDGE`
    - `APPROVED_M07_T07_PUBLIC_SOURCE_EXPORTS`
    - `APPROVED_M07_T07_PUBLIC_RUNTIME_KEYS`
  - `tests/control-plane-local-api.test.mjs`
    - `openBundleRuntimeActivationUnsafe`
    - `successorBuild`
  - `scripts/lib/control-plane-runtime-staging-proof.mjs`
    - `APPROVED_M07_T07_ACTIVATION_SOURCE_EXPORTS`
    - `APPROVED_M07_T07_PUBLIC_RUNTIME_KEYS`
    - `M07_T07_NORMATIVE_COVERAGE_SUCCESSOR_RECEIPTS`
    - `M07_T07_TRACKED_RECEIPT_BRIDGE`
    - `M07_T07_INDEX_DISTRIBUTION_RECEIPT_BRIDGE`
    - `normalizedSuccessorLine`
    - `reviewedM07T07Successor`
    - `historicalRow`
  - `scripts/lib/publisher-publish-result-proof.mjs`
    - `REVIEWED_G05_COMPATIBILITY_RECEIPT_HISTORY`
  - `tests/publisher-publish-result.test.mjs`
    - `M07_T06_SOURCE_AUDIT_RECONSTRUCTION_PATCH`
    - `reconstructM07T03SourceAuditProof`
  - `scripts/lib/publisher-execution-preflight-proof.mjs`
    - `APPROVED_M05_COMPATIBILITY_RECEIPT_HISTORY`
    - `APPROVED_CURRENT_M05_COMPATIBILITY_RECEIPTS`
  - `tests/publisher-execution-preflight.test.mjs`
    - `compatibilitySources`
  - `scripts/lib/publisher-bundle-publication-proof.mjs`
    - `APPROVED_COMPATIBILITY_RECEIPT_HISTORY`
    - `APPROVED_CURRENT_COMPATIBILITY_RECEIPTS`
  - `tests/publisher-bundle-publication.test.mjs`
    - `appendValidRootSuccessor`
  - `tests/publisher-catalog-pinning.test.mjs`
    - `appendValidRootSuccessor`
  - `scripts/lib/publisher-invalid-source-matrix-proof.mjs`
    - `APPROVED_T09_SUCCESSOR_RECEIPT_HISTORY`
    - `APPROVED_CURRENT_T09_SUCCESSOR_RECEIPTS`
    - `REQUIRED_CURRENT_T09_PROOF_MARKERS`
    - `HISTORICAL_PACKAGE_TEST_RECEIPT`
    - `APPROVED_CURRENT_PACKAGE_TEST_RECEIPT`
    - `HISTORICAL_RUNTIME_PROBE_PROGRAM_BYTES`
    - `APPROVED_CURRENT_RUNTIME_PROBE_PROGRAM_BYTES`
    - `historicalRuntimeProbeTransportClaim`
  - `tests/publisher-invalid-source-matrix.test.mjs`
    - `appendValidRootSuccessor`
    - `[authority] authenticates the bounded focused-suite timeout successor`
- Reason retained: M07-T07 legitimately advances the public package surface, aggregate tails,
  runtime receipts, generated distribution, normative-coverage pins, source-audit coordination,
  and Publisher compatibility receipts while every M07-T01 through M07-T06 artifact remains
  immutable. These reader-local successor branches are exact and fail closed, but they duplicate
  the current-receipt authority now authenticated by proof-reader checkpoint sequence 16. The
  same bridge also authenticates a 60-second focused-suite timeout successor after the 20-second
  task-time envelope proved vulnerable to wall-clock contention: all 127 invalid cases, eight
  positive guards, inputs, two-run determinism checks, and pass criteria remain unchanged, while
  the frozen M06-T11 artifact retains its historical package-test and embedded-program receipts.
- Objective removal trigger: sequence 16 or its reviewed replacement is the sole current-byte
  authority for all 32 readers and the M07-T07 artifact; the historical readers consume the
  checkpoint result without embedding T07 receipt histories, public-export allowlists, aggregate
  successors, reconstruction patches, source markers, or parallel historical/current timeout
  receipts; the focused package and built-root suites retain their explicit 60-second test timeout
  under one current authority; all transition poison tests remain fail-closed; and the seven
  M07-T01 through M07-T07 artifacts remain byte-identical.
- Must close by gate: `G07`
- Exact verification and zero-reference rule:
  - `node scripts/verify-reference-host-web-source-audit.mjs`
  - `node scripts/verify-control-plane-bundle-store.mjs`
  - `node --test tests/control-plane-bundle-store.test.mjs`
  - `node scripts/verify-control-plane-bundle-verification.mjs`
  - `node --test tests/control-plane-bundle-verification.test.mjs`
  - `node scripts/verify-control-plane-package-preflight.mjs`
  - `node --test tests/control-plane-package-preflight.test.mjs`
  - `node scripts/verify-control-plane-reference-preflight.mjs`
  - `node --test tests/control-plane-reference-preflight.test.mjs`
  - `node scripts/verify-control-plane-local-api.mjs`
  - `node --test tests/control-plane-local-api.test.mjs`
  - `node scripts/verify-control-plane-runtime-staging.mjs`
  - `node --test tests/control-plane-runtime-staging.test.mjs`
  - `node scripts/verify-publisher-publish-result.mjs`
  - `node --test tests/publisher-publish-result.test.mjs`
  - `node scripts/verify-publisher-execution-preflight.mjs`
  - `node --test tests/publisher-execution-preflight.test.mjs`
  - `node scripts/verify-publisher-bundle-publication.mjs`
  - `node --test tests/publisher-bundle-publication.test.mjs`
  - `node --test tests/publisher-catalog-pinning.test.mjs`
  - `node scripts/verify-publisher-invalid-source-matrix.mjs`
  - `pnpm --filter @desen/publisher test:invalid-source-matrix`
  - `node --test tests/publisher-invalid-source-matrix.test.mjs`
  - `node scripts/ci/verify-proof-reader-checkpoints.mjs`
  - `rg -n "M07_T07_CONTROL_PLANE_COORDINATION|RUNTIME_ACTIVATION_(VALUE|TYPE)_EXPORTS|APPROVED_M07_T07_(TRACKED_RECEIPTS|PUBLIC_SOURCE_EXPORTS|PUBLIC_RUNTIME_KEYS|INDEX_DISTRIBUTION_RECEIPTS|ACTIVATION_SOURCE_EXPORTS)|M07_T07_(AGGREGATE_SUCCESSOR_COMMANDS|TRACKED_RECEIPT_BRIDGE|INDEX_DISTRIBUTION_RECEIPT_BRIDGE|NORMATIVE_COVERAGE_SUCCESSOR_RECEIPTS)|changedActivationExport|openBundleRuntimeActivation(Changed|Unsafe)|normalizedSuccessorLine|reviewedM07T07Successor|historicalRow" scripts/lib/reference-host-web-source-audit-proof.mjs scripts/lib/control-plane-bundle-store-proof.mjs tests/control-plane-bundle-store.test.mjs scripts/lib/control-plane-bundle-verification-proof.mjs tests/control-plane-bundle-verification.test.mjs scripts/lib/control-plane-package-preflight-proof.mjs tests/control-plane-package-preflight.test.mjs scripts/lib/control-plane-reference-preflight-proof.mjs tests/control-plane-reference-preflight.test.mjs scripts/lib/control-plane-local-api-proof.mjs tests/control-plane-local-api.test.mjs scripts/lib/control-plane-runtime-staging-proof.mjs`
    must return no matches after removal.
  - `rg -n "REVIEWED_G05_COMPATIBILITY_RECEIPT_HISTORY|M07_T06_SOURCE_AUDIT_RECONSTRUCTION_PATCH|reconstructM07T03SourceAuditProof|APPROVED_M05_COMPATIBILITY_RECEIPT_HISTORY|APPROVED_CURRENT_M05_COMPATIBILITY_RECEIPTS|compatibilitySources|APPROVED_COMPATIBILITY_RECEIPT_HISTORY|APPROVED_CURRENT_COMPATIBILITY_RECEIPTS|APPROVED_T09_SUCCESSOR_RECEIPT_HISTORY|APPROVED_CURRENT_T09_SUCCESSOR_RECEIPTS|REQUIRED_CURRENT_T09_PROOF_MARKERS|HISTORICAL_PACKAGE_TEST_RECEIPT|APPROVED_CURRENT_PACKAGE_TEST_RECEIPT|HISTORICAL_RUNTIME_PROBE_PROGRAM_BYTES|APPROVED_CURRENT_RUNTIME_PROBE_PROGRAM_BYTES|historicalRuntimeProbeTransportClaim|appendValidRootSuccessor|\[authority\] authenticates the bounded focused-suite timeout successor" scripts/lib/publisher-publish-result-proof.mjs tests/publisher-publish-result.test.mjs scripts/lib/publisher-execution-preflight-proof.mjs tests/publisher-execution-preflight.test.mjs scripts/lib/publisher-bundle-publication-proof.mjs tests/publisher-bundle-publication.test.mjs tests/publisher-catalog-pinning.test.mjs scripts/lib/publisher-invalid-source-matrix-proof.mjs tests/publisher-invalid-source-matrix.test.mjs`
    must return no matches after removal. Immutable task-time receipt fields may remain only in
    frozen artifact bytes; the replacement checkpoint may retain current receipts under
    checkpoint-owned symbols.
- Closure evidence: `PENDING` — record commit, pull request, sequence-16 replacement checkpoint
  SHA-256, all seven frozen M07 artifact SHA-256 values, and hosted required-exhaustive equivalence
  run URL.

## DEBT-I07-015 — M07-T08 historical recovery reader bridges

- Status: `OPEN`
- Registered by infrastructure task: `M07-T08`
- Removal owner: `I07-04`
- Exact paths and symbols:
  - `scripts/lib/reference-host-web-source-audit-proof.mjs`
    - `M07_T08_CONTROL_PLANE_COORDINATION`
  - `tests/publisher-publish-result.test.mjs`
    - `M07_T08_SOURCE_AUDIT_RECONSTRUCTION_PATCH`
  - `scripts/lib/control-plane-bundle-store-proof.mjs`
    - `APPROVED_M07_T08_TRACKED_RECEIPTS`
    - `APPROVED_M07_T08_PUBLIC_SOURCE_EXPORTS`
    - `APPROVED_M07_T08_PUBLIC_RUNTIME_KEYS`
    - `APPROVED_M07_T08_INDEX_DISTRIBUTION_RECEIPTS`
    - `approvedM07T08`
  - `tests/control-plane-bundle-store.test.mjs`
    - `pnpm verify:control-plane-runtime-recovery && pnpm verify:control-plane-successor && pnpm lint`
    - `pnpm test:control-plane-runtime-recovery && pnpm test:control-plane-successor && turbo run test`
  - `scripts/lib/control-plane-bundle-verification-proof.mjs`
    - `APPROVED_M07_T08_PUBLIC_SOURCE_EXPORTS`
    - `APPROVED_M07_T08_PUBLIC_RUNTIME_KEYS`
    - `APPROVED_M07_T08_TRACKED_RECEIPTS`
    - `APPROVED_M07_T08_INDEX_DISTRIBUTION_RECEIPTS`
    - `approvedM07T08`
    - `approvedM07T08Keys`
  - `scripts/lib/control-plane-package-preflight-proof.mjs`
    - `APPROVED_M07_T08_PUBLIC_SOURCE_EXPORTS`
    - `APPROVED_M07_T08_PUBLIC_RUNTIME_KEYS`
    - `APPROVED_M07_T08_TRACKED_RECEIPTS`
    - `APPROVED_M07_T08_INDEX_DISTRIBUTION_RECEIPTS`
    - `M07_T08_AGGREGATE_SUCCESSOR_COMMANDS`
    - `approvedM07T08`
  - `scripts/lib/control-plane-reference-preflight-proof.mjs`
    - `APPROVED_M07_T08_PUBLIC_SOURCE_EXPORTS`
    - `APPROVED_M07_T08_PUBLIC_RUNTIME_KEYS`
    - `APPROVED_M07_T08_TRACKED_RECEIPTS`
    - `APPROVED_M07_T08_INDEX_DISTRIBUTION_RECEIPTS`
    - `approvedM07T08`
  - `scripts/lib/control-plane-local-api-proof.mjs`
    - `M07_T08_TRACKED_RECEIPT_BRIDGE`
    - `M07_T08_INDEX_DISTRIBUTION_RECEIPT_BRIDGE`
    - `APPROVED_M07_T08_PUBLIC_SOURCE_EXPORTS`
    - `APPROVED_M07_T08_PUBLIC_RUNTIME_KEYS`
    - `currentSuccessorIndex`
    - `reviewedCurrentSuccessorTail`
    - `m07T08Bridge`
  - `tests/control-plane-local-api.test.mjs`
    - `pnpm verify:control-plane-runtime-activation && pnpm verify:control-plane-runtime-recovery`
    - `pnpm verify:control-plane-runtime-recovery`
  - `scripts/lib/control-plane-runtime-staging-proof.mjs`
    - `APPROVED_M07_T08_ACTIVATION_SOURCE_EXPORTS`
    - `APPROVED_M07_T08_PUBLIC_RUNTIME_KEYS`
    - `M07_T08_NORMATIVE_COVERAGE_SUCCESSOR_RECEIPTS`
    - `M07_T08_TRACKED_RECEIPT_BRIDGE`
    - `M07_T08_READER_RECEIPT_PROJECTION`
    - `M07_T08_INDEX_DISTRIBUTION_RECEIPT_BRIDGE`
    - `reviewedM07T08Activation`
    - `reviewedM07T08Tail`
    - `m07T08Bridge`
    - `m07T08SuccessorReceipt`
    - `reviewedM07T08Successor`
  - `tests/control-plane-runtime-staging.test.mjs`
    - `INVALID_RUNTIME_RECOVERY_AUTHORITY_CODE_CHANGED`
    - `pnpm verify:control-plane-runtime-recovery-decoy`
    - `recoverySuccessorReceipt`
    - `recoverySuccessorBuild`
    - `unreviewedRecoverySuccessor`
  - `scripts/lib/control-plane-runtime-activation-proof.mjs`
    - `M07_T08_RUNTIME_TEST_NAMES`
    - `M07_T07_DOCUMENTED_ACTIVATION_SOURCE_EXPORTS`
    - `M07_T08_DOCUMENTED_ACTIVATION_SOURCE_EXPORTS`
    - `M07_T08_TRACKED_RECEIPT_BRIDGE`
    - `M07_T08_READER_RECEIPT_PROJECTION`
    - `M07_T08_ACTIVATION_DISTRIBUTION_RECEIPT_BRIDGE`
    - `M07_T08_INDEX_DISTRIBUTION_RECEIPT_BRIDGE`
    - `M07_T07_ACTIVATION_PUBLIC_EXPORTS`
    - `M07_T08_RECOVERY_PUBLIC_EXPORTS`
    - `M07_T08_ACTIVATION_PUBLIC_EXPORTS`
    - `M07_T08_RECOVERY_PUBLIC_EXPORT_NAMES`
    - `function assertAdjacent(`
    - `M07_T07_PUBLIC_RUNTIME_KEYS`
    - `M07_T08_PUBLIC_RUNTIME_KEYS`
    - `M07_T07_ACTIVATION_SERVICE_KEYS`
    - `M07_T08_ACTIVATION_SERVICE_KEYS`
  - `tests/control-plane-runtime-activation.test.mjs`
    - `INVALID_RECOVERY_AUTHORITY_CODE`
    - `pnpm verify:control-plane-runtime-activation && pnpm verify:control-plane-runtime-recovery`
    - `pnpm verify:control-plane-runtime-recovery && pnpm verify:control-plane-runtime-activation`
- Reason retained: M07-T08 adds source-audit coordination, recovery exports, package and
  distribution receipts, aggregate tails, runtime keys, normative rows, and current root-test
  mutations while the historical
  M07-T01 through M07-T07 artifacts remain immutable. The seven historical proof readers must
  temporarily recognize that reviewed successor and project their own task-time bytes. These
  exact, fail-closed bridges duplicate current-byte authority already intended for the append-only
  checkpoint rather than weakening any historical artifact.
- Objective removal trigger: proof-reader checkpoint sequence 20 is
  the sole current-byte authority for all 34 readers and all 17 artifacts; each historical reader
  consumes that checkpoint result without embedding M07-T08 receipt maps, public-export
  allowlists, aggregate successors, distribution projections, normative-row receipts, or recovery
  mutation aliases; the eight M07-T01 through M07-T08 artifacts remain byte-identical; every
  successor and poison mutation stays fail-closed; and a fresh hosted `REQUIRED + EXHAUSTIVE` run
  authenticates the resulting current state.
- Must close by gate: `G07`
- Exact verification and zero-reference rule:
  - `node scripts/verify-control-plane-bundle-store.mjs`
  - `node --test tests/control-plane-bundle-store.test.mjs`
  - `node scripts/verify-control-plane-bundle-verification.mjs`
  - `node --test tests/control-plane-bundle-verification.test.mjs`
  - `node scripts/verify-control-plane-package-preflight.mjs`
  - `node --test tests/control-plane-package-preflight.test.mjs`
  - `node scripts/verify-control-plane-reference-preflight.mjs`
  - `node --test tests/control-plane-reference-preflight.test.mjs`
  - `node scripts/verify-control-plane-local-api.mjs`
  - `node --test tests/control-plane-local-api.test.mjs`
  - `node scripts/verify-control-plane-runtime-staging.mjs`
  - `node --test tests/control-plane-runtime-staging.test.mjs`
  - `node scripts/verify-control-plane-runtime-activation.mjs`
  - `node --test tests/control-plane-runtime-activation.test.mjs`
  - `node scripts/verify-control-plane-runtime-recovery.mjs`
  - `node --test tests/control-plane-runtime-recovery.test.mjs`
  - `node scripts/ci/verify-proof-reader-checkpoints.mjs`
  - `rg -n "M07_T08_(CONTROL_PLANE_COORDINATION|SOURCE_AUDIT_RECONSTRUCTION_PATCH)|APPROVED_M07_T08_(TRACKED_RECEIPTS|PUBLIC_SOURCE_EXPORTS|PUBLIC_RUNTIME_KEYS|INDEX_DISTRIBUTION_RECEIPTS|ACTIVATION_SOURCE_EXPORTS)|M07_T08_(AGGREGATE_SUCCESSOR_COMMANDS|TRACKED_RECEIPT_BRIDGE|INDEX_DISTRIBUTION_RECEIPT_BRIDGE|NORMATIVE_COVERAGE_SUCCESSOR_RECEIPTS|READER_RECEIPT_PROJECTION|ACTIVATION_DISTRIBUTION_RECEIPT_BRIDGE|RUNTIME_TEST_NAMES|DOCUMENTED_ACTIVATION_SOURCE_EXPORTS|RECOVERY_PUBLIC_EXPORTS|ACTIVATION_PUBLIC_EXPORTS|RECOVERY_PUBLIC_EXPORT_NAMES|PUBLIC_RUNTIME_KEYS|ACTIVATION_SERVICE_KEYS)|M07_T07_(DOCUMENTED_ACTIVATION_SOURCE_EXPORTS|ACTIVATION_PUBLIC_EXPORTS|PUBLIC_RUNTIME_KEYS|ACTIVATION_SERVICE_KEYS)|approvedM07T08(Keys)?|m07T08Bridge|m07T08SuccessorReceipt|reviewedM07T08(Activation|Tail|Successor)|currentSuccessorIndex|reviewedCurrentSuccessorTail|function assertAdjacent\(" scripts/lib/reference-host-web-source-audit-proof.mjs tests/publisher-publish-result.test.mjs scripts/lib/control-plane-bundle-store-proof.mjs scripts/lib/control-plane-bundle-verification-proof.mjs scripts/lib/control-plane-package-preflight-proof.mjs scripts/lib/control-plane-reference-preflight-proof.mjs scripts/lib/control-plane-local-api-proof.mjs scripts/lib/control-plane-runtime-staging-proof.mjs scripts/lib/control-plane-runtime-activation-proof.mjs`
    must return no matches after removal.
  - `rg -n "INVALID_RUNTIME_RECOVERY_AUTHORITY_CODE_CHANGED|INVALID_RECOVERY_AUTHORITY_CODE|recoverySuccessor(Receipt|Build)|unreviewedRecoverySuccessor|pnpm verify:control-plane-runtime-recovery-decoy|pnpm (verify|test):control-plane-runtime-recovery && pnpm (verify|test):control-plane-successor|pnpm verify:control-plane-runtime-recovery && pnpm verify:control-plane-runtime-activation" tests/control-plane-bundle-store.test.mjs tests/control-plane-local-api.test.mjs tests/control-plane-runtime-staging.test.mjs tests/control-plane-runtime-activation.test.mjs`
    must return no matches after removal. Production recovery APIs, focused M07-T08 evidence, and
    checkpoint-owned current receipts outside these scoped historical reader/test files are not
    part of this zero-reference rule.
- Closure evidence: `PENDING` — record commit, pull request, sequence-20 checkpoint
  SHA-256, all eight frozen M07-T01 through M07-T08 artifact SHA-256 values, zero-reference output,
  and hosted required-exhaustive run URL.

## DEBT-I07-016 — M07-T09 historical fault-injection successor bridges

- Status: `OPEN`
- Registered by infrastructure task: `M07-T09`
- Removal owner: `I07-04`
- Exact paths and symbols:
  - `scripts/lib/control-plane-bundle-store-proof.mjs`
    - `APPROVED_M07_T09_TRACKED_RECEIPTS`
    - `approvedM07T09`
  - `tests/control-plane-bundle-store.test.mjs`
    - `test/runtime-fault-injection-decoy.test.ts`
  - `scripts/lib/control-plane-bundle-verification-proof.mjs`
    - `APPROVED_M07_T09_TRACKED_RECEIPTS`
    - `approvedM07T09`
  - `tests/control-plane-bundle-verification.test.mjs`
    - `faultInjectionScriptDrift`
    - `faultInjectionAggregateDrift`
    - `control-plane-runtime-fault-injection-decoy`
  - `scripts/lib/control-plane-package-preflight-proof.mjs`
    - `APPROVED_M07_T09_TRACKED_RECEIPTS`
    - `M07_T09_AGGREGATE_SUCCESSOR_COMMANDS`
    - `approvedM07T09`
    - `reviewedFaultInjectionSuccessor`
  - `tests/control-plane-package-preflight.test.mjs`
    - `test/runtime-fault-injection-decoy.test.ts`
    - `control-plane-runtime-fault-injection-decoy`
  - `scripts/lib/control-plane-reference-preflight-proof.mjs`
    - `APPROVED_M07_T09_TRACKED_RECEIPTS`
    - `approvedM07T09`
    - `reviewedFaultInjectionSuccessor`
  - `tests/control-plane-reference-preflight.test.mjs`
    - `test/runtime-fault-injection-decoy.test.ts`
    - `control-plane-runtime-fault-injection-decoy`
  - `scripts/lib/control-plane-local-api-proof.mjs`
    - `M07_T09_TRACKED_RECEIPT_BRIDGE`
    - `m07T09Bridge`
    - `faultInjectionSuccessor`
    - `reviewedFaultInjectionSuccessorTail`
  - `tests/control-plane-local-api.test.mjs`
    - `test/runtime-fault-injection-decoy.test.ts`
    - `control-plane-runtime-fault-injection-decoy`
  - `scripts/lib/control-plane-runtime-staging-proof.mjs`
    - `M07_T09_TRACKED_RECEIPT_BRIDGE`
    - `M07_T09_NORMATIVE_COVERAGE_SUCCESSOR_RECEIPTS`
    - `m07T09Bridge`
    - `reviewedM07T09Tail`
    - `reviewedM07T09Successor`
  - `tests/control-plane-runtime-staging.test.mjs`
    - `test/runtime-fault-injection-decoy.test.ts`
    - `control-plane-runtime-fault-injection-decoy`
    - `M07-T09 claims`
  - `scripts/lib/control-plane-runtime-activation-proof.mjs`
    - `M07_T09_TRACKED_RECEIPT_BRIDGE`
    - `M07_T09_N004_SUCCESSOR_RECEIPT`
    - `faultInjectionBridge`
    - `approvedFaultInjectionCurrent`
    - `approvedM07T09N004`
  - `tests/control-plane-runtime-activation.test.mjs`
    - `test/runtime-fault-injection-decoy.test.ts`
    - `control-plane-runtime-fault-injection-decoy`
    - `| IMPLEMENTED |`
  - `scripts/lib/control-plane-runtime-recovery-proof.mjs`
    - `M07_T09_REGISTRATION_AUTHORITY_RECEIPTS`
    - `M07_T09_TEST_AUTHORITY_RECEIPTS`
    - `M07_T09_TRACKED_RECEIPT_BRIDGE`
    - `M07_T09_READER_RECEIPT_PROJECTION`
    - `trackedFileReceipts`
    - `reviewed M07-T09 CI registration set`
  - `tests/control-plane-runtime-recovery.test.mjs`
    - `test/runtime-fault-injection-decoy.test.ts`
    - `control-plane-runtime-fault-injection-decoy`
    - `M07-T09 claims without proof`
- Reason retained: M07-T09 adds the exact fault-injection proof pair and changes the control-plane
  package registration, root aggregate scripts, quality-gate runner, exhaustive inventory,
  shared-state authority, ADR 0014, and normative N-004, N-038, and N-041 rows while the eight
  M07-T01 through M07-T08 artifacts remain immutable. Their historical readers therefore need
  temporary, fail-closed bridges that authenticate only the exact reviewed M07-T09 successor and
  project each reader's task-time receipts without weakening its frozen artifact.
- Objective removal trigger: proof-reader checkpoint sequence 21 is the sole current-byte
  authority for all 36 readers and all 18 artifacts; I07-04 removes every reader-local M07-T09
  receipt map, successor branch, projection, and mutation alias listed above; all nine M07-T01
  through M07-T09 artifacts remain byte-identical; successor and poison mutations remain
  fail-closed; and a fresh hosted `REQUIRED + EXHAUSTIVE` run authenticates the resulting state.
- Must close by gate: `G07`
- Exact verification and zero-reference rule:
  - `node scripts/verify-control-plane-bundle-store.mjs`
  - `node --test tests/control-plane-bundle-store.test.mjs`
  - `node scripts/verify-control-plane-bundle-verification.mjs`
  - `node --test tests/control-plane-bundle-verification.test.mjs`
  - `node scripts/verify-control-plane-package-preflight.mjs`
  - `node --test tests/control-plane-package-preflight.test.mjs`
  - `node scripts/verify-control-plane-reference-preflight.mjs`
  - `node --test tests/control-plane-reference-preflight.test.mjs`
  - `node scripts/verify-control-plane-local-api.mjs`
  - `node --test tests/control-plane-local-api.test.mjs`
  - `node scripts/verify-control-plane-runtime-staging.mjs`
  - `node --test tests/control-plane-runtime-staging.test.mjs`
  - `node scripts/verify-control-plane-runtime-activation.mjs`
  - `node --test tests/control-plane-runtime-activation.test.mjs`
  - `node scripts/verify-control-plane-runtime-recovery.mjs`
  - `node --test tests/control-plane-runtime-recovery.test.mjs`
  - `node scripts/ci/verify-proof-reader-checkpoints.mjs`
  - `rg -n "APPROVED_M07_T09_TRACKED_RECEIPTS|M07_T09_(AGGREGATE_SUCCESSOR_COMMANDS|TRACKED_RECEIPT_BRIDGE|NORMATIVE_COVERAGE_SUCCESSOR_RECEIPTS|N004_SUCCESSOR_RECEIPT|REGISTRATION_AUTHORITY_RECEIPTS|TEST_AUTHORITY_RECEIPTS|READER_RECEIPT_PROJECTION)|approvedM07T09(N004)?|reviewedFaultInjectionSuccessor(Tail)?|faultInjection(ScriptDrift|AggregateDrift|Successor|Bridge)|m07T09Bridge|reviewedM07T09(Tail|Successor)|approvedFaultInjectionCurrent|trackedFileReceipts|reviewed M07-T09 CI registration set|test/runtime-fault-injection-decoy\.test\.ts|control-plane-runtime-fault-injection-decoy|M07-T09 claims( without proof)?|\| IMPLEMENTED \|" scripts/lib/control-plane-bundle-store-proof.mjs tests/control-plane-bundle-store.test.mjs scripts/lib/control-plane-bundle-verification-proof.mjs tests/control-plane-bundle-verification.test.mjs scripts/lib/control-plane-package-preflight-proof.mjs tests/control-plane-package-preflight.test.mjs scripts/lib/control-plane-reference-preflight-proof.mjs tests/control-plane-reference-preflight.test.mjs scripts/lib/control-plane-local-api-proof.mjs tests/control-plane-local-api.test.mjs scripts/lib/control-plane-runtime-staging-proof.mjs tests/control-plane-runtime-staging.test.mjs scripts/lib/control-plane-runtime-activation-proof.mjs tests/control-plane-runtime-activation.test.mjs scripts/lib/control-plane-runtime-recovery-proof.mjs tests/control-plane-runtime-recovery.test.mjs`
    must return no matches after removal. The M07-T09 proof implementation, focused evidence,
    frozen artifact bytes, and checkpoint-owned current receipts outside these scoped historical
    reader and test files are not part of this zero-reference rule.
- Closure evidence: `PENDING` — record commit, pull request, sequence-21 checkpoint SHA-256, all
  nine frozen M07-T01 through M07-T09 artifact SHA-256 values, zero-reference output, and hosted
  required-exhaustive run URL.

## DEBT-I07-017 — I07-03 affected-selector shadow CI and current-reader bridge

- Status: `OPEN`
- Registered by infrastructure task: `I07-03`
- Removal owner: `I07-04`
- Exact paths and symbols:
  - `.github/workflows/ci.yml`
    - `affected-shadow`
    - `Affected shadow observation`
    - `Verify shadow affected contracts`
    - `Run non-authoritative affected shadow`
    - `DESEN_CI_BASE_SHA`
    - `DESEN_CI_HEAD_SHA`
    - `DESEN_CI_SAME_REPOSITORY`
    - `scripts/ci/run-shadow-affected-quality-gate.mjs`
  - `scripts/ci/run-shadow-affected-quality-gate.mjs`
    - `SHADOW_AFFECTED_RECEIPT_PROFILE`
    - `runShadowAffectedQualityGate`
    - `executeShadowAffectedQualityGate`
    - `printShadowAffectedReceipt`
  - `scripts/ci/test/shadow-affected-quality-gate.test.mjs`
    - `runs every selected command fresh and closes one exact strict subset`
    - `exhaustive fallback executes no duplicate shadow workload`
    - `a selected failure stops later work and remains non-authoritative`
  - `scripts/lib/control-plane-bundle-store-proof.mjs`
    - `APPROVED_I07_T03_TRACKED_RECEIPTS`
    - `approvedI07T03`
- Reason retained: I07-03 must collect real same-revision affected/exhaustive observations while
  the official quality gate remains `REQUIRED + EXHAUSTIVE`. The separate pull-request job,
  execution wrapper, receipt printer, and focused shadow assertions are deliberately
  non-authoritative migration structures. Updating that workflow also changes exact bytes read by
  the immutable M07-T01 control-plane proof, so `APPROVED_I07_T03_TRACKED_RECEIPTS` temporarily
  authenticates only the reviewed I07-03 successor until checkpoint sequence 22 is the sole
  current-byte authority. The sequence-22 record and its reviewed-chain wiring are append-only
  evidence, not removable debt targets. The affected selector, tracked-path ownership, impact
  graph, frozen threshold, and their hostile-input contracts are enduring safety authorities and
  are intentionally outside this cleanup entry.
- Objective removal trigger: the frozen zero-of-twenty observation threshold reaches at least 20
  consecutive eligible hosted same-revision `AFFECTED`/`EXHAUSTIVE` comparisons with zero false
  negatives and complete selector plus ownership-category coverage; I07-04 then promotes affected
  selection only for eligible pull requests. The shadow-only job, wrapper, receipt printer, and
  named focused-test markers above are removed or replaced by required eligible-PR authority. At
  the same time, sequence 22 must remain the authenticated append-only current checkpoint while
  the reader-local `APPROVED_I07_T03_TRACKED_RECEIPTS` branch and alias are removed. `main`,
  release, and manual-audit execution remain fresh `REQUIRED + EXHAUSTIVE`.
- Must close by gate: `G07`
- Exact verification and zero-reference rule:
  - `node scripts/ci/verify-infrastructure-debt.mjs`
  - `node --test scripts/ci/test/infrastructure-debt.test.mjs`
  - `node --test scripts/ci/test/affected-observation-threshold.test.mjs`
  - `node --test scripts/ci/test/affected-workload-ownership.test.mjs`
  - `node --test scripts/ci/test/affected-impact-graph.test.mjs`
  - `node --test scripts/ci/test/affected-change-boundary.test.mjs`
  - `node --test scripts/ci/test/affected-workload-selector.test.mjs`
  - `node --test scripts/ci/test/shadow-affected-quality-gate.test.mjs`
  - `node scripts/verify-control-plane-bundle-store.mjs`
  - `node --test tests/control-plane-bundle-store.test.mjs`
  - `node scripts/ci/verify-proof-reader-checkpoints.mjs`
  - `node --test scripts/ci/test/proof-reader-checkpoints.test.mjs`
  - scoped zero-reference verification must inspect the four exact targets above, treating a
    removed target as absent, and find none of the registered symbols after I07-04 promotion. The
    append-only sequence-22 checkpoint and enduring selector, ownership, graph, threshold,
    change-boundary, and required exhaustive authorities are outside this zero-reference scope.
- Closure evidence: `PENDING` — record the I07-04 commit and pull request, the frozen I07-03
  threshold SHA-256, the sequence-22 checkpoint SHA-256, the 20 qualifying hosted comparison run
  pairs, category-coverage and zero-false-negative receipts, exact zero-reference output, and the
  final hosted required exhaustive `main` run URL.
