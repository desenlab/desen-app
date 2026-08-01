# Testing Strategy

## Test layers

1. **Protocol vectors:** Frozen official valid/invalid fixtures and exact diagnostic expectations.
2. **Unit tests:** Pure validators, resolvers, predicates, state transitions, actions, and commands.
3. **Property tests:** Determinism, canonicalization, stable identity, limits, and state-machine
   invariants.
4. **Integration tests:** Publisher pipelines, capability registration, exact package resolution,
   activation, and persistence.
5. **Component tests:** React adapters and authoring overlays without implementation leakage.
6. **Browser proof:** Desen App authors and publishes while a separately built host activates.
7. **Source audits:** No manual managed-screen tree, no forbidden imports, no executable document
   content, and no secrets.
8. **Architecture mutation fixtures:** Representative forbidden imports must be rejected by the
   named dependency rule while documented imports continue to pass.

## Evidence hierarchy

The strongest evidence is a deterministic test plus a content-addressed artifact. Manual demos are
used to explain user value and verify ergonomics, not to replace semantic tests.

## Coverage policy

No global percentage is imposed during empty scaffolding. Before public alpha:

- every in-scope protocol branch has a positive or negative vector;
- every stable diagnostic has a test;
- every activation failure path proves last-known-good preservation; and
- every public proof claim maps to at least one automated test.

Activation persistence tests inject failure before every activation stage and at the durable
transaction boundary. They cover transaction abort, storage quota failure, crash immediately
before commit, crash immediately after commit but before in-memory notification, competing stale
writers, and restart recovery. The asserted state is always a complete activation record; tests
must never accept an active pointer whose previous-good pointer was written separately.

## Hosted CI contract

GitHub Actions uses the fail-closed single-pass gate documented in
`docs/standards/CI-QUALITY-GATE.md`. It must preserve every distinct workload in the cumulative
task commands while avoiding orchestration-level replay. Proof builders may still repeat work
internally when that repetition is itself the evidence, such as independent builds, byte
comparison, mutation, or atomic-write checks.

CI must never generate or repair tracked proof artifacts before verifying them. It must not trust
changed-file filters, cached proof success, or timing output. A change to the legacy prerequisite
inventory or exact execution plan requires an explicit reviewed pin update.

I07 introduces modular execution in evidence-first phases. I07-01's historical
`SHADOW + EXHAUSTIVE` candidate ran every validated workload while the sequential gate remained
authoritative. Its local and hosted results are preserved evidence, not proof of the I07-02
required-workflow cutover.

I07-02 established the scheduler-neutral 130-node, 61-proof-unit inventory independently from both
schedulers. Contract and hostile-input tests cover exact ordered ids, labels, commands, arguments,
dependencies, execution classes, and shared-state records; omission, duplication, reorder,
substitution, cycles, unknown classes, shell syntax, writer insertion, and affected-only metadata
must fail closed. A separate rollback-only adapter proves exact equality with the retained
sequential plan and rejects PASS receipts containing missing, duplicated, skipped, not-run,
cancelled, timed-out, failed, or unclosed work.

Shared-state mutation tests cover all seven exact classes and counts: 6 `GLOBAL_EXCLUSIVE`, 1
`WORKSPACE_OUTPUT_EXCLUSIVE`, 1 `PACKAGE_TEST_EXCLUSIVE`, 66 `PROOF_READ_ONLY`, 45
`PROOF_OS_TEMP_ISOLATED`, 10 `PROOF_TRACKED_ALIAS_EXCLUSIVE`, and 1
`PROOF_WORKSPACE_TEMP_EXCLUSIVE`. They prove that 50 proof pairs are eligible for pair-level overlap
at concurrency two and that the ten tracked-alias pairs plus `reference-host-web-source-audit`
always drain the scheduler as eleven exclusive proof-pair barriers.

Real isolation probes verify per-step temp ownership, Node filesystem permissions, verifier-side
child-process denial, the exact root-test Node-harness grant, native-addon denial,
inherited-`NODE_OPTIONS` rejection, TCP/UDP listener denial, and identity-checked cleanup. Child
runtime probes are permitted only for the verifier side of
`publisher-catalog-pinning`, `publisher-bundle-publication`, `publisher-official-golden`,
`publisher-invalid-source-matrix`, and `control-plane-bundle-store`. Native-addon authority is
permitted only for the exact `reference-host-web-source-audit` verifier/root-test pair and the
`publisher-invalid-source-matrix` root test. Regression tests prove that its verifier and every
other unlisted step remain denied; the source-audit verifier remains workspace-read-only.

The probes also pin all eighteen exact Node-permission compatibility workloads and their policy
distribution: 112 `NONE`, two `FIXTURE_COPY`, fifteen `REVIEWED_SYMLINK`, and one combined policy.
They prove exact fixture sources and recursive option shapes, bounded no-follow tree copies,
matching copy fingerprints, own-temp destination ownership, and rejection of sibling-temp,
external-source, symlink-parent, unreviewed-workspace-target, and unsupported-option escapes.
Eight unsafe-input workspace files are mirrored into the workload temp root; ten canonical-path or
inode cases retain only their exact reviewed tracked aliases and execute exclusively. Tests also
prove that the generated permission list grants neither the shared OS-temp parent nor a direct
workspace-write path, and that rebinding temp environment variables cannot redirect the adapter.
This is a trusted-code compatibility contract rather than an adversarial OS sandbox; the outer
tracked workspace seal remains the mutation authority.

Mutation tests must also prove that build or Turbo output drift fails the proof-phase seal,
non-ignored untracked residue fails the complete-execution guard, and tracked byte, executable
mode, file-count, or Git-index drift fails the outer gate boundary even when a workload already
failed or cancellation was requested. Ignored build outputs are covered by their dedicated seal,
not silently accepted as proof state.

Authority tests prove that structurally plausible fake close receipts, injected runners, and
injected repository or guard seams cannot produce `REQUIRED` PASS; the same fakes remain usable
only with explicit `SHADOW`. Clean-input fixtures cover staged, unstaged, non-ignored untracked,
and revision-mismatch rejection before any workload starts; the exact porcelain command also
includes submodule state in the opening authority.

First-terminal race tests cover timeout, child `error`, nonzero `close`, delayed cleanup, SIGINT,
SIGTERM, one-signal graceful shutdown, synchronous close during signal forwarding, repeated-signal
escalation, and the complete-gate deadline. The first event must retain its reason and exit code,
every active sibling must receive termination in that event, no dependent workload may start, and
the result may settle only after all active children close and cleanup completes.

The plan factory defaults to `REQUIRED + EXHAUSTIVE`, and GitHub Actions now invokes that default as
the official pull-request and `main` authority. The accepted same-revision required/legacy
comparison and subsequent hosted cutover are archived in the I07-02 baseline. The retained
sequential runner executes only through explicit manual `legacy-rollback`; a rollback dispatch
cannot cancel an authoritative event because mode and event are part of the concurrency key.
I07-02 adds no `AFFECTED` selector. Its completed promotion closed `DEBT-I07-008` by deleting the
temporary shadow workflow and modular comparison adapter/test. Under `DEBT-I07-007`, the retained
sequential runner and rollback-equivalence adapter remain test targets until I07-05 proves their
exact removal conditions.

Later `AFFECTED` planning cannot become a required shortcut until it has complete tracked-path
ownership, reverse dependency closure, exact exhaustive comparison, and fail-closed
unknown-to-exhaustive behavior. Even after promotion, `main`, release, and manual-audit runs remain
exhaustive. No phase may trust cached build, test, mutation, checkpoint, or proof success; only
immutable dependency downloads may be cached.

Current reader compatibility is distinct from frozen task evidence. Security hardening may advance
one live reader through the reviewed checkpoint append procedure only when every previously pinned
checkpoint digest, frozen artifact, claim/nonclaim scope, and historical projection remains
unchanged and the full existing plus new regression suite passes. The checkpoint is inert data and
cannot select executable commands.
