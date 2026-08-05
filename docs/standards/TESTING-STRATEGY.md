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

I07-02 established the scheduler-neutral 130-node, 61-proof-unit cutover inventory independently
from both schedulers. M07-T04 appended the third post-cutover verifier/root-test pair; M07-T05
appends the fourth for the local control-plane API. The live successor therefore contains 138
nodes and 65 proof units without rewriting that frozen baseline. Contract and hostile-input
tests cover exact ordered ids, labels, commands, arguments,
dependencies, execution classes, and shared-state records; omission, duplication, reorder,
substitution, cycles, unknown classes, shell syntax, writer insertion, and affected-only metadata
must fail closed. A separate rollback-only adapter proves exact equality with the retained
sequential plan and rejects PASS receipts containing missing, duplicated, skipped, not-run,
cancelled, timed-out, failed, or unclosed work.

Shared-state mutation tests cover all seven live exact classes and counts: 6 `GLOBAL_EXCLUSIVE`, 1
`WORKSPACE_OUTPUT_EXCLUSIVE`, 1 `PACKAGE_TEST_EXCLUSIVE`, 68 `PROOF_READ_ONLY`, 51
`PROOF_OS_TEMP_ISOLATED`, 10 `PROOF_TRACKED_ALIAS_EXCLUSIVE`, and 1
`PROOF_WORKSPACE_TEMP_EXCLUSIVE`. They prove that 54 proof pairs are eligible for pair-level overlap
at concurrency two and that the ten tracked-alias pairs plus `reference-host-web-source-audit`
always drain the scheduler as eleven exclusive proof-pair barriers.

The M07-T04 `control-plane-reference-preflight` verifier is an ordinary `PROOF_READ_ONLY` step.
Its root mutation test is `PROOF_OS_TEMP_ISOLATED`: it may write only inside its runner-owned temp
root, receives no workspace-write, port, native-addon, or verifier runtime-probe authority, and
does not introduce a scheduler barrier.

The M07-T05 `control-plane-local-api` verifier and root mutation test are ordinary
`PROOF_OS_TEMP_ISOLATED` steps. Each may use only its runner-owned temp root. They receive no
workspace-write, child-runtime, or port grant and do not introduce a barrier; the exact pair alone
receives the native-addon authority required by the reviewed SQLite binding.

Real isolation probes verify per-step temp ownership, Node filesystem permissions, verifier-side
child-process denial, the exact root-test Node-harness grant, native-addon denial,
inherited-`NODE_OPTIONS` rejection, TCP/UDP listener denial, and identity-checked cleanup. Child
runtime probes are permitted only for the verifier side of
`publisher-catalog-pinning`, `publisher-bundle-publication`, `publisher-official-golden`,
`publisher-invalid-source-matrix`, `control-plane-bundle-store`, and
`control-plane-bundle-verification`. Native-addon authority is permitted only for the exact
`reference-host-web-source-audit` verifier/root-test pair, the `publisher-invalid-source-matrix`
root test, and the exact `control-plane-local-api` verifier/root-test pair. Regression tests prove
that every unlisted step remains denied; the source-audit verifier remains workspace-read-only.
The reviewed production dependency audit for locked Fastify 5.11.2 and better-sqlite3 13.0.3
reports no known vulnerability.

The probes also pin all eighteen exact Node-permission compatibility workloads and their live policy
distribution: 118 `NONE`, two `FIXTURE_COPY`, fifteen `REVIEWED_SYMLINK`, and one combined policy.
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
cannot select executable commands. M07-T02 follows that procedure in checkpoint sequence 3: the
historical head `f92e879b3a72e75abb07af2b2bcfded62e014b99aa0cbe69c64aee12d5379882`
authenticates nine artifacts and eighteen readers. M07-T03 appends historical sequence 4 without
rewriting any predecessor: its head
`ee2d72c3529d9295945d339fb214c41dbbf906ffa6613a7ad6e766ec79c1bcf5` authenticates ten artifacts
and twenty readers. A corrective M05-T04 current-reader append after M07-T03 establishes sequence
5 historically: its head
`7df3631d509ed7e65c571566a825d6d3cd52d336e1a74512bf3e8e26920749b3` authenticates eleven
artifacts and twenty-two readers. Sequence 6 only advances the M06-T11 proof/test receipts for a
bounded, explicit 20-second nested Vitest timeout; its then-current head `790ad28b6fd441e6d5f40f277a97e8de36a178a9e50fff3e208e6c27588915fd` still
authenticates eleven artifacts and twenty-two readers. It changes no coverage, assertion,
concurrency, frozen evidence, workload/proof count, progress, or plan digest, and sequences 1–5
remain byte- and hash-unchanged.

Reviewed sequence 7 links predecessor head
`790ad28b6fd441e6d5f40f277a97e8de36a178a9e50fff3e208e6c27588915fd` to its then-current head
`d50b5ee4fb265f241bac7652b979af0146d530528ba6db8fc98c8fb3225a5ba5`, authenticating 13 frozen
artifacts and 26 live readers. It adds the 34,612-byte M07-T04 artifact
`sha256:29555326d51073c50937519d8706049ad17287079cc3ef4dc7060bb3a3225394`, live T04 proof/root and
current M05-T06 compatibility readers. It seals the exact final receipts of the complete 26-reader
live set after all T04 compatibility bridges and the reviewed CI timeout calibration, including
current M05-T09, M06-T01/T05/T08/T09/T10/T11, and M07-T01/T02/T03 readers. The frozen M05-T06
artifact remains byte-identical with its historical
`PARTIAL` projection; live P-17 is `PROVEN`. Sequences 1–6 remain unchanged. This is a reviewed
local-reader checkpoint, not a new hosted CI result.

Reviewed sequence 8 links the exact sequence 7 head
`d50b5ee4fb265f241bac7652b979af0146d530528ba6db8fc98c8fb3225a5ba5` to its then-current head
`f707fb4c3338aeda79eb6242b645b5e864ce54b1e3955373e8edebcd7e026b8a`, authenticating 14 frozen
artifacts and 28 live readers. It adds the 41,945-byte M07-T05 artifact
`sha256:144e8a46b3b41a1f98a022bf4c16dddb9d7415af4e5033322484d4bdd49c55b9`, its 73,915-byte proof
reader `sha256:f66d40863a46dd7ed9e28afb2c78f8afbda8aee964e72d4fba60e65e55a351b3`, and its 17,291-byte root
reader `sha256:490d4f922ea41dc7bca178cc54ab938ab136f0b922d7842af623001eabf60a65`. Prior live receipts,
including current M07-T01 through M07-T04 and reference-host source-audit compatibility readers,
are resealed after the T05 compatibility changes. Sequences 1–7 and predecessor frozen artifacts
remain unchanged. This is reviewed local-reader evidence, not a new hosted CI result; I07-04 owns
the remaining compatibility-reader debt.

Reviewed sequence 9 links the exact sequence 8 head
`f707fb4c3338aeda79eb6242b645b5e864ce54b1e3955373e8edebcd7e026b8a` to its then-current head
`94f48160552a6e0de702f71200e56c23d61bab8692d43f3ac1104dcfa681568b` with the same 14 frozen
artifacts and 28 readers. Exactly reader indexes `[16, 17, 18, 19]` change: M07-T02 proof
94,612 bytes / `sha256:4c69fa253ba2d9432a75c6c6aaa2ad69e23c3683c43dae9c92dc73b3208937d9`;
M07-T02 root 20,959 bytes / `sha256:fdcfc8c4868c1ee084b652e42c7dab4750bc569c4c05928dde7136118b4689ed`;
M07-T03 proof 86,174 bytes / `sha256:5624b06d8d0962d18c9a920a34a95b0023f4909d8c7b7812057bedcdc62ab5ab`;
and M07-T03 root 21,119 bytes /
`sha256:10c1a677b88b5c6bd4389e659ce38f11a627ae92de4aafe4ffade0de23790f11`.
The minimal T05 compatibility bridges authenticate the current shared strict-JSON internal
source/distribution and exact T03 → T04 → T05 aggregate adjacency while projecting unchanged
frozen T02/T03 artifacts. Sequences 1–8 and all frozen artifacts remain unchanged. This is reviewed
local evidence only, not a hosted CI claim; `DEBT-I07-012` cleanup remains owned by I07-04.

Reviewed sequence 10 links the exact sequence 9 head
`94f48160552a6e0de702f71200e56c23d61bab8692d43f3ac1104dcfa681568b` to its then-current head
`bd3f5b90656f0e41d7f6aa439fdc01889e9ebeada26cd3caf8624c3ce1db7d07` with the same 14 frozen
artifacts and 28 readers. Exactly reader indexes `[7, 14, 15]` change: the M06-T08 catalog root
`tests/publisher-catalog-pinning.test.mjs` is 38,530 bytes at
`sha256:bb3038a8c5bb241c863daa6c7f41c1d8ab210da81fdbe52697f33a3c14909116`; the M07-T01 proof reader
is 99,672 bytes at `sha256:d9d9edd6379357dde229999ce461a0dc66bf58dc0d7900eb6f5ece177a9b3fba`;
and its root reader is 26,679 bytes at
`sha256:6b3a7869962046a3594a788095faad640c76fec660a59aee7b26844e831851ff`. These minimal test-fixture
successors recognize the local-API aggregate tail and updated catalog-root receipt while the frozen
catalog and T01 artifacts remain unchanged. The final strictly sequential local catalog and T01
checks pass 51/51 and 16/16. Sequences 1–9 remain immutable. This is reviewed local evidence only,
not a hosted CI claim; `DEBT-I07-012` cleanup remains owned by I07-04.

Reviewed sequence 11 links the exact sequence 10 head
`bd3f5b90656f0e41d7f6aa439fdc01889e9ebeada26cd3caf8624c3ce1db7d07` to its then-current head
`63b8af4da431f0918c7ea9480564750bd12057af2bc83c294d962113ce7c9be8` with the same 14 unchanged
frozen artifacts and 28 readers. Only indexes `[26, 27]` change: the M07-T05 proof reader is 77,034
bytes at `sha256:c704e25024eaf7bdf317cc144f6b85922a3fe73a24c9c91e639ede032e22eb6f`,
and its root reader is 17,578 bytes at
`sha256:4871c406390c4c9b36bff1c417a6c8dd22798736ea8daad1c63a3cbd0a978389`. Sequences 1–10 and every
frozen artifact remain unchanged. This is a reviewed local-reader checkpoint and makes no hosted
CI claim.

Reviewed sequence 12 links the exact sequence 11 head
`63b8af4da431f0918c7ea9480564750bd12057af2bc83c294d962113ce7c9be8` to current head
`85c49a0d79346bf2ea92b716f6b43c5d95d164209e3d67af34871a334686e10e` with the same 14 unchanged
frozen artifacts and 28 readers. Only indexes `[26, 27]` change: the M07-T05 proof reader is 77,507
bytes at `sha256:e2050408c5bf3e084eacd6e42880310dafbfdf03b79821500cc0567b998f7d66`,
and its root reader is 17,716 bytes at
`sha256:061b40ea20e0f7ee362f26bd54db954c3caea338df5e2f090ce34a4618ac37cc`. This successor authenticates
the exact ADR token-bound documentation update while the M07-T05 artifact and every other frozen
artifact remain unchanged. This is reviewed local-reader evidence; hosted CI has not yet been
claimed, and I07-04 still owns the compatibility-reader debt.
