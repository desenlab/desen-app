# Infrastructure Debt and Cleanup Register

This register tracks temporary compatibility structures registered by I07-01 while immutable task
evidence is separated from current-checkpoint authentication and CI execution orchestration. An
entry records planned removal work; it does not claim that the modular proof infrastructure, a
replacement checkpoint, or any cleanup has already been implemented.

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
under `scripts/ci/`; I07-02 must place that validator on the required exhaustive path. A cleanup is
complete only when:

1. the replacement current checkpoint is authenticated from fresh tracked bytes;
2. frozen task artifacts and their task-time projections remain byte-identical;
3. the modular `REQUIRED + EXHAUSTIVE` schedule and the retained legacy gate have met the
   equivalence gates in ADR 0011;
4. the entry-specific focused verifier and mutation tests pass;
5. the entry-specific zero-reference rule passes; and
6. the complete fresh quality gate passes without cached proof success.

## Open-entry summary

| ID           | Status | Temporary structure                                      | Registered by | Removal owner | Must close by |
| ------------ | ------ | -------------------------------------------------------- | ------------- | ------------- | ------------- |
| DEBT-I07-001 | OPEN   | M06-T01 current G05 receipt ownership                    | I07-01        | I07-04        | G07           |
| DEBT-I07-002 | OPEN   | M06-T05 duplicate current M05 receipts                   | I07-01        | I07-04        | G07           |
| DEBT-I07-003 | OPEN   | M06-T09 predecessor compatibility helpers                | I07-01        | I07-04        | G07           |
| DEBT-I07-004 | OPEN   | M06-T11 current T09/T10 receipts and source markers      | I07-01        | I07-04        | G07           |
| DEBT-I07-005 | OPEN   | M07-T01 historical projection for checkpointed readers   | I07-01        | I07-04        | G07           |
| DEBT-I07-006 | OPEN   | M05-T09 embedded M06-T05 Validator successor description | I07-01        | I07-04        | G07           |
| DEBT-I07-007 | OPEN   | Legacy runner, rollback adapter, and manual workflow     | I07-01        | I07-05        | G12           |
| DEBT-I07-008 | OPEN   | Shadow workflow and legacy-authority adapter             | I07-01        | I07-02        | G07           |

## DEBT-I07-001 — M06-T01 current G05 receipts

- Status: `OPEN`
- Registered by infrastructure task: `I07-01`
- Removal owner: `I07-04`
- Exact paths and symbols:
  - `scripts/lib/publisher-publish-result-proof.mjs`
    - `G05_COMPATIBILITY_OWNERSHIP_PATHS`
    - `REVIEWED_CURRENT_G05_RECEIPTS`
    - `TRACKED_FILE_OVERRIDE_PATHS`
  - `tests/publisher-publish-result.test.mjs`
    - `currentCompatibilityBytes`
    - `reviewedCurrentG05Receipts`
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
  - `rg -n "G05_COMPATIBILITY_OWNERSHIP_PATHS|REVIEWED_CURRENT_G05_RECEIPTS|TRACKED_FILE_OVERRIDE_PATHS|currentCompatibilityBytes|reviewedCurrentG05Receipts|PUBLISHER_G05_COMPATIBILITY_READER_DRIFT" scripts/lib/publisher-publish-result-proof.mjs tests/publisher-publish-result.test.mjs`
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
    - `APPROVED_CURRENT_M05_COMPATIBILITY_RECEIPTS`
    - `captureCompatibilitySourceBytes`
    - the current-receipt branch in `fileInventory`
  - `tests/publisher-execution-preflight.test.mjs`
    - `compatibilitySources`
    - `compatibilitySourceBytes`
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
  - `rg -n "APPROVED_CURRENT_M05_COMPATIBILITY_RECEIPTS|captureCompatibilitySourceBytes|compatibilitySourceBytes" scripts/lib/publisher-execution-preflight-proof.mjs tests/publisher-execution-preflight.test.mjs`
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
    - `APPROVED_CURRENT_COMPATIBILITY_RECEIPTS`
    - `APPROVED_CURRENT_COMPATIBILITY_PATHS`
    - `assertApprovedCurrentCompatibilityBytes`
    - `authenticateCurrentCompatibilityReaders`
    - `APPROVED_REQUIRED_CI_WORKFLOW_RECEIPT`
    - `matchesReceipt`
    - `authenticateRequiredCiWorkflow`
  - `tests/publisher-bundle-publication.test.mjs`
    - `PUBLISHER_BUNDLE_PUBLICATION_COMPATIBILITY_READERS`
    - `[compatibility] externally tracks every current T02 through T08 proof reader`
    - `[compatibility] detects tamper in each externally anchored T02 through T08 reader`
    - `[ci] admits only the exact required-workflow successor into frozen T09 evidence`
- Reason retained: the frozen M06-T09 proof authenticates seven evolving M06-T02 through M06-T08
  readers, embeds the current M06-T05 reader receipt, and projects the authenticated required-CI
  successor back to its task-time workflow receipt. These checks protect the live edges today but
  combine immutable T09 evidence, current compatibility, and execution coordination in one module.
- Objective removal trigger: the current checkpoint owns the exact seven-reader inventory and
  their current receipts; required-only workflow authority owns current CI authentication; M06-T09
  retains only frozen prerequisite and task-time evidence; all seven tamper cases fail through the
  checkpoint; and required-exhaustive CI preserves the same T02–T09 dependency closure.
- Must close by gate: `G07`
- Exact verification and zero-reference rule:
  - `node scripts/verify-publisher-bundle-publication.mjs`
  - `node --test tests/publisher-bundle-publication.test.mjs`
  - `node scripts/verify-publisher-execution-preflight.mjs`
  - `rg -n "PUBLISHER_BUNDLE_PUBLICATION_COMPATIBILITY_READERS|APPROVED_CURRENT_COMPATIBILITY_RECEIPTS|APPROVED_CURRENT_COMPATIBILITY_PATHS|assertApprovedCurrentCompatibilityBytes|authenticateCurrentCompatibilityReaders|APPROVED_REQUIRED_CI_WORKFLOW_RECEIPT|matchesReceipt|authenticateRequiredCiWorkflow|\[ci\] admits only the exact required-workflow successor into frozen T09 evidence" scripts/lib/publisher-bundle-publication-proof.mjs tests/publisher-bundle-publication.test.mjs`
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
  - `rg -n "APPROVED_CURRENT_T(09|10)_SUCCESSOR_(PATHS|RECEIPTS)|REQUIRED_CURRENT_T09_(PROOF|TEST)_MARKERS|currentT(09|10)SuccessorReceipt|assertCurrentT10SuccessorBytes|authenticateLiveCurrentT(09|10)Successors|authenticateCurrentT(09|10)TrackedInputs|currentT10HistoricalReceipt|assertCurrentT09CompatibilityMarkers|\[authority\] distinguishes semantic coordination drift from frozen surface drift|BUNDLE_PUBLICATION_(PROOF_LIBRARY|ROOT_TEST)|currentT(09|10)(Proof|RootTest)Bytes|approvedCurrentT09|unreviewedT09ProofBytes|APPROVED_REQUIRED_CI_WORKFLOW_RECEIPT|matchesReceipt|authenticateRequiredCiWorkflow|\[ci\] admits only the exact required-workflow successor into frozen T10 evidence" scripts/lib/publisher-invalid-source-matrix-proof.mjs tests/publisher-invalid-source-matrix.test.mjs scripts/lib/publisher-official-golden-proof.mjs tests/publisher-official-golden.test.mjs`
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
- Reason retained: the append-only checkpoint now authenticates sixteen current readers and M07-T01
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
- Closure evidence: `PENDING` — record commit, pull request, twelve-reader checkpoint manifest
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

- Status: `OPEN`
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
- Reason retained: the active Phase A candidate now executes all 130 steps from the neutral
  inventory through the required-exhaustive runner, but it remains visibly non-authoritative while
  same-revision equivalence is measured. The former modular runner and its tests remain only as a
  temporary comparison and rollback adapter; keeping those exact targets explicit prevents their
  accidental survival after required authority is proven.
- Objective removal trigger: I07-02 records same-revision local and hosted equivalence, introduces
  code-owned shared-state/output/port/temp-path classification, promotes the exhaustive modular
  path to required authority, and either removes this workflow or renames and rewires it so no
  shadow-only authority remains. The exhaustive runner may continue to consume a shared neutral
  inventory, but it may no longer import scheduling authority from a legacy sequential runner.
- Must close by gate: `G07`
- Exact verification and zero-reference rule:
  - the I07-02 required-exhaustive equivalence verifier and mutation tests
  - the hosted required exhaustive workflow from a clean checkout
  - scoped zero-reference verification must cover only the three exact DEBT-I07-008 targets above
    and find none of their machine-owned symbols after the shared neutral inventory replaces the
    adapter. The debt manifest, verifier, tests, and this register are authority records and are
    intentionally outside that target set.
- Closure evidence: `PENDING` — record the I07-02 commit, pull request, required workflow URL,
  neutral-inventory SHA-256, and removed shadow-workflow SHA-256.
