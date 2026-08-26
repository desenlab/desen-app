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
unauthenticated or incomplete changed-file inputs, cached proof success, or timing output. An
eligible affected selection requires the exact authenticated Git boundary, complete tracked-path
ownership, conservative dependency closure, and the frozen promotion receipt; uncertainty expands
exactly once to exhaustive execution. A change to the legacy prerequisite inventory or exact
execution plan requires an explicit reviewed pin update.

I07 introduces modular execution in evidence-first phases. I07-01's historical
`SHADOW + EXHAUSTIVE` candidate ran every validated workload while the sequential gate remained
authoritative. Its local and hosted results are preserved evidence, not proof of the I07-02
required-workflow cutover.

I07-02 established the scheduler-neutral 130-node, 61-proof-unit cutover inventory independently
from both schedulers. M07-T07 appended the sixth post-cutover verifier/root-test pair for durable
runtime activation; M07-T08 appended the seventh for exact restart recovery; M07-T09 appended the
eighth for its bounded boundary-fault matrix; M07-T10 appended the ninth for ordered transitions
and two-way races; and M07-T11 appended the tenth for separately built host channel consumption.
That historical M07-T11 successor contained 150 workloads, 71 proof pairs, 479 prerequisite
segments, 3,113 ordered leaf invocations, and 236 distinct leaves. M08-T01 appended the direct
editor-core Source-document proof pair plus its serial public-package contract. M08-T02 appended
the stable-ID insertion verifier/root pair behind that same serial predecessor. M08-T03 appended
the structural-edit verifier/root pair behind stable-ID insertion, and M08-T04 appends the
content-edit pair behind both frozen edit prerequisites. The current successor contains 159
workloads and 75 proof pairs without rewriting the frozen cutover, with 519 prerequisite segments,
3,237 ordered leaf invocations, and 251 distinct leaves. The neutral inventory is
`sha256:3879dcd4c9716b7f08746953c62170de7bd33c786f747849b8aed38e0fe1e62c`; the required plan is
`sha256:30a193cbc27316792bd577dcecdc87c10e680e2e033698ceb90787c2cbcf1b51`. These are local
code-owned successor values; no hosted M08-T04 result is claimed. The 15 reviewed workspace test
scripts are pinned by
`sha256:0faa6116c99d11f6d059a224de6b08a723657b5c5690a3138e6290d240524820`. Contract and
hostile-input tests cover exact
ordered ids, labels, commands, arguments,
dependencies, execution classes, and shared-state records; omission, duplication, reorder,
substitution, cycles, unknown classes, shell syntax, writer insertion, and affected-only metadata
must fail closed. A separate rollback-only adapter proves exact equality with the retained
sequential plan and rejects PASS receipts containing missing, duplicated, skipped, not-run,
cancelled, timed-out, failed, or unclosed work.

Shared-state mutation tests cover all seven live exact classes and counts: 6 `GLOBAL_EXCLUSIVE`, 2
`WORKSPACE_OUTPUT_EXCLUSIVE`, 1 `PACKAGE_TEST_EXCLUSIVE`, 69 `PROOF_READ_ONLY`, 70
`PROOF_OS_TEMP_ISOLATED`, 10 `PROOF_TRACKED_ALIAS_EXCLUSIVE`, and 1
`PROOF_WORKSPACE_TEMP_EXCLUSIVE`. They prove that 64 proof pairs are eligible for pair-level overlap
at concurrency two and that the ten tracked-alias pairs plus `reference-host-web-source-audit`
always drain the scheduler as eleven exclusive proof-pair barriers.

The M07-T04 `control-plane-reference-preflight` verifier is an ordinary `PROOF_READ_ONLY` step.
Its root mutation test is `PROOF_OS_TEMP_ISOLATED`: it may write only inside its runner-owned temp
root, receives no workspace-write, port, native-addon, or verifier runtime-probe authority, and
does not introduce a scheduler barrier.

The M07-T05 `control-plane-local-api` verifier and root mutation test are ordinary
`PROOF_OS_TEMP_ISOLATED` steps. Each may use only its runner-owned temp root. The verifier receives
the exact `VERIFIER_RUNTIME_PROBE` child-process policy, while the root receives only the ordinary
`NODE_TEST_HARNESS` policy. Neither receives workspace-write or port authority, and neither
introduces a barrier. Only those two exact workloads receive the native-addon authority required
by the reviewed SQLite binding.

The M07-T06 `control-plane-runtime-staging` verifier is an ordinary `PROOF_READ_ONLY` step. Its root
proof/mutation test is `PROOF_OS_TEMP_ISOLATED`, receives only the ordinary `NODE_TEST_HARNESS`
child policy, and introduces no scheduler barrier. Neither workload receives workspace-write,
port, native-addon, or verifier runtime-probe authority.

The M07-T07 `control-plane-runtime-activation` verifier and root are ordinary
`PROOF_OS_TEMP_ISOLATED` steps. The verifier receives the exact `VERIFIER_RUNTIME_PROBE` child
policy and the root receives only `NODE_TEST_HARNESS`; both receive the narrow
`CONTROL_PLANE_RUNTIME_ACTIVATION_SQLITE` native-addon policy. Neither receives workspace-write or
port authority, and the pair introduces no scheduler barrier.

The M07-T08 `control-plane-runtime-recovery` verifier and root are ordinary
`PROOF_OS_TEMP_ISOLATED` steps. The verifier receives the exact `VERIFIER_RUNTIME_PROBE` child
policy and the root receives only `NODE_TEST_HARNESS`; both receive the separate narrow
`CONTROL_PLANE_RUNTIME_RECOVERY_SQLITE` native-addon policy. Neither receives workspace-write or
port authority, and the pair introduces no scheduler barrier.

The M07-T09 `control-plane-runtime-fault-injection` verifier and root are ordinary
`PROOF_OS_TEMP_ISOLATED` steps. The verifier receives the bounded `VERIFIER_RUNTIME_PROBE` child
policy and the root receives only `NODE_TEST_HARNESS`; both receive the task-specific
`CONTROL_PLANE_RUNTIME_FAULT_INJECTION_SQLITE` native-addon policy. Neither receives
workspace-write or port authority, and the pair introduces no scheduler barrier.

The M07-T10 `control-plane-runtime-transition-races` verifier and root are ordinary
`PROOF_OS_TEMP_ISOLATED` steps. The verifier receives the bounded `VERIFIER_RUNTIME_PROBE` child
policy plus the separate task-specific `CONTROL_PLANE_RUNTIME_TRANSITION_RACES_SQLITE`
native-addon policy. The root receives only `NODE_TEST_HARNESS` and no native-addon authority
because it injects the authenticated runtime-suite receipt. Neither receives workspace-write or
port authority, and the pair introduces no scheduler barrier.

The M07-T11 `reference-host-web-channel-consumption` verifier and root are ordinary
`PROOF_OS_TEMP_ISOLATED` steps. Both use runner-owned OS-temp roots and receive only the bounded
child/runtime and native SQLite policies assigned by the code-owned authority. Neither receives a
shared workspace-write or fixed/shared listener-port grant from the scheduler, and the pair
introduces no barrier. Its verifier alone owns the code-registered
`desen.ci.loopback-child-listener-authority.v1` child-network profile. The verifier parent
stays listener-denied; a runner-created mode-`0600`, singly linked authority plus random token is
delegated only to its Vitest process tree through the unchanged guarded `NODE_OPTIONS`. That tree
may bind only TCP on literal IPv4 `127.0.0.1` with requested port `0` and connect only to a port it
opened. UDP, DNS, hostnames, IPv6, public addresses, Unix sockets, and fixed ports remain denied.
Hosted CI is required for the real loopback-listener cases because the local sandbox returns
`EPERM` on `127.0.0.1` bind.

The M08-T01 `editor-core-source-document` verifier and independent root mutation test are ordinary
`PROOF_OS_TEMP_ISOLATED` steps after the semantic `protocol-structural-validation` predecessor.
Each writes only inside its separate runner-owned OS temp root. Neither receives workspace-write,
port, or native-addon authority. The verifier receives no child-runtime-probe grant, while the root
receives only the ordinary `NODE_TEST_HARNESS` policy.
The separate serial `editor-core-public-package-contract` prefix owns the repeated `dist` write and
runs the exact package export-map, compiler, and emitted-runtime contract before the verifier.

The M08-T02 `editor-core-stable-id-insert`, M08-T03 `editor-core-structural-edits`, and M08-T04
`editor-core-content-edits` verifier/root pairs are ordinary and non-barrier. Each follows the same
serial public-package contract; structural edits also follows stable-ID insertion, while content
edits follows both frozen edit prerequisites. All six workloads are
`PROOF_OS_TEMP_ISOLATED` with separate runner-owned roots and verifier-before-root ordering.
Neither pair receives workspace-write, port, native-addon, or verifier runtime-probe authority;
only each root receives the ordinary `NODE_TEST_HARNESS` child policy.

Real isolation probes verify per-step temp ownership, Node filesystem permissions, verifier-side
child-process denial, the exact root-test Node-harness grant, native-addon denial,
inherited-`NODE_OPTIONS` rejection, default TCP/UDP listener denial, the sole authenticated T11
Vitest-child exception, and identity-checked cleanup. Child
runtime probes are permitted only for the verifier side of
`publisher-catalog-pinning`, `publisher-bundle-publication`, `publisher-official-golden`,
`publisher-invalid-source-matrix`, `control-plane-bundle-store`, and
`control-plane-bundle-verification`, `control-plane-local-api`, and
`control-plane-runtime-activation`, `control-plane-runtime-recovery`, and
`control-plane-runtime-fault-injection`, and `control-plane-runtime-transition-races`.
Native-addon authority is
permitted only for the exact
`reference-host-web-source-audit` verifier/root-test pair, the `publisher-invalid-source-matrix`
root test, and the exact `control-plane-local-api` and `control-plane-runtime-activation`
verifier/root-test pairs plus the exact `control-plane-runtime-recovery` and
`control-plane-runtime-fault-injection` pairs plus only the
`control-plane-runtime-transition-races` and `reference-host-web-channel-consumption` verifiers.
Both roots are explicitly denied native-addon authority.
Regression tests prove
that every unlisted step remains denied; the source-audit verifier remains workspace-read-only.
The reviewed production dependency audit for locked Fastify 5.11.2 and better-sqlite3 13.0.3
reports no known vulnerability.

The probes also pin all eighteen exact Node-permission compatibility workloads and their live policy
distribution across the 159 workloads: 141 `NONE`, two `FIXTURE_COPY`, fifteen
`REVIEWED_SYMLINK`, and one combined policy.
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

I07-03 adds a separate pull-request-only `SHADOW + AFFECTED` observer while leaving the exact
`REQUIRED + EXHAUSTIVE` runner as the sole pass/fail authority. Its tests prove complete exact
tracked-path ownership, authenticated change boundaries, reverse dependency closure, and
fail-closed expansion of unknown, ambiguous, untrusted, policy, dependency, frozen-input,
incomplete-diff, or unsupported changes to `EXHAUSTIVE`. A strict-subset plan must still execute
every selected workload from fresh inputs; no phase may trust cached build, test, mutation,
checkpoint, or proof success. Only immutable dependency downloads may be cached.

Mutation and race coverage additionally reject fabricated or cloned Git-boundary receipts, source
authority drift, multi-proof ordering mismatches, absent-root dependency fabrication, cancellation
at every region boundary, and replacement of a primary execution failure by a closing-guard error.

Promotion remains false until every selector category is mutation-covered, false negatives remain
zero, and at least 20 consecutive eligible same-revision hosted strict-subset affected/exhaustive
comparisons agree. Observation starts at `0 / 20`; I07-04 is `NOT_STARTED` until the frozen
threshold passes and exact hosted provenance is independently authenticated. The pure ledger can
report threshold arithmetic but always returns promotion false. Even after promotion, `main`,
release, and manual-audit runs remain exhaustive.
The hosted bootstrap passed the authoritative Quality gate, while the shadow returned
`NOT_ELIGIBLE` → `EXHAUSTIVE` for `UNSUPPORTED_CHANGE_KIND`. Because no strict subset ran, that
result is not an eligible observation and the counter remains `0 / 20`. Exact hosted identifiers
are pinned in the
[`i07-03-affected-selector-shadow.json`](../proof/baselines/i07-03-affected-selector-shadow.json)
baseline. Focused local contracts pass 91/91 and the full CI infrastructure suite passes 203/203.
At that historical checkpoint, the full local gate was `BLOCKED_BY_LOCAL_SANDBOX`: loopback
`listen` returned `EPERM` in two pre-existing TCP lifecycle tests. This was an environment
restriction, not a product regression; the passing hosted Quality gate was authoritative.
`DEBT-I07-017` assigns the shadow-only job,
wrapper, and test wiring to I07-04 for removal by G07.

The later I07-04 campaign reached `20 / 20` with zero false negatives. Its independent baseline
binds the exact hosted identities, the immutable historical campaign digest, the conservative
selector transition, and the required-runner authority. Local cleanup removed all 17 G07-due
bridge families. Historical closure sequence 28 authenticates 25 frozen artifacts and 50 readers;
historical sequence 30 authenticates 27 frozen artifacts and 54 readers. Historical sequence 31 at
`181d5a1e0c012f53cfe02640c2f8d0ddf1e300090a3c3742882bb3722175e42d` authenticates 28 frozen
artifacts and 56 then-current readers. The current append-only sequence 32 at
`112e966b350b019557274e1f76a915db15c04109793429b3b885ff7d18843574` authenticates 29 frozen
artifacts and 58 current readers.
These are joined to the hosted closure evidence. [Cleanup PR #36](https://github.com/desenlab/desen-app/pull/36)
and its landed `main` revision passed fresh `REQUIRED + EXHAUSTIVE`. The exact one-file
[canary PR #37](https://github.com/desenlab/desen-app/pull/37) passed fresh
`REQUIRED + AFFECTED` in 3m54s in
[run 31676049922, job 94370743935](https://github.com/desenlab/desen-app/actions/runs/31676049922/job/94370743935),
selecting and closing 10 workloads for one proof unit as a strict subset without cached success.
All 17 G07-due debt entries are `CLOSED`; `DEBT-I07-007` remains `OPEN` for I07-05. I07-04 and G07
are `DONE`; proof gates are 8/13, implementation progress is 89/145, M08 is 4/10, `N-014` remains
`TESTED`, `S-002` remains `PLANNED`, and M08-T05 is next. The exact 26,988-byte M08-T04 artifact is
`docs/proof/artifacts/editor-core-0.1.0-content-edits.json` at
`sha256:1726d453913c091d30229be02270a0cb4b74bf479f87027c4b9a0da3bb3c7066`; the report is
`docs/proof/EDITOR-CORE-CONTENT-EDITS.md`. These T04 results are local code-owned/current evidence
and make no hosted M08-T04 claim; no `P-*`, `N-*`, `S-*`, or proof-gate status changes.

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
`63b8af4da431f0918c7ea9480564750bd12057af2bc83c294d962113ce7c9be8` to its then-current head
`85c49a0d79346bf2ea92b716f6b43c5d95d164209e3d67af34871a334686e10e` with the same 14 unchanged
frozen artifacts and 28 readers. Only indexes `[26, 27]` change: the M07-T05 proof reader is 77,507
bytes at `sha256:e2050408c5bf3e084eacd6e42880310dafbfdf03b79821500cc0567b998f7d66`,
and its root reader is 17,716 bytes at
`sha256:061b40ea20e0f7ee362f26bd54db954c3caea338df5e2f090ce34a4618ac37cc`. This successor authenticates
the exact ADR token-bound documentation update while the M07-T05 artifact and every other frozen
artifact remain unchanged. This is reviewed local-reader evidence; hosted CI has not yet been
claimed, and I07-04 still owns the compatibility-reader debt.

Reviewed sequence 13 links the exact sequence 12 head
`85c49a0d79346bf2ea92b716f6b43c5d95d164209e3d67af34871a334686e10e` to its then-current head
`146b04f1c8209be64168afb451ceee2c422da0cdced116f8d08beafe795c533c` with the same 14 unchanged
frozen artifacts and 28 readers. Only index `[9]` changes: the M06-T09
publisher-bundle-publication root reader is 63,859 bytes at
`sha256:ae7b688d904b4c77632fd78e0ee23b2264eae1574b4350306b5e2ec1b9974b8d`. A hosted
required-exhaustive attempt exposed two stale M07 successor/current-receipt assertions in that
reader; after the narrow reader-only correction, its focused root passes 112/112 and the frozen
M06-T09 artifact remains unchanged. This is reviewed local-reader evidence, does not claim hosted
CI success, and leaves the compatibility-reader debt with I07-04.

Reviewed sequence 14 links the exact sequence 13 head
`146b04f1c8209be64168afb451ceee2c422da0cdced116f8d08beafe795c533c` to current head
`3d2dd7a48ee2573d14fb1dbea18ef8b4e3498c6a26f82d76ea589dba3c821078` with the same 14 unchanged
frozen artifacts and 28 readers. Only indexes `[10, 11, 14]` change: the M06-T11 proof reader is
166,563 bytes at `sha256:06eb59602a768c13f19cc83289a574823d191aa3b62ed8fb7149381b326de802`,
its root reader is 60,572 bytes at
`sha256:29b407c2f7f1b17d17bff450185a9304c3186caea4a98973df3f1e3e4f684531`, and the M07-T01 proof
reader is 99,672 bytes at
`sha256:888d5e81bda7ca2cdcc58bb063d49409cad5f5d73bdd9baaa16dc199e566e5c6`. This narrow CI-reader
successor changes no frozen artifact. Subsequent M07-T05 pull-request and `main`
required-exhaustive runs passed in hosted CI; sequence 14 itself remains local-reader evidence, and
I07-04 still owns the compatibility-reader debt.

Reviewed checkpoint sequence 15 links exact sequence 14 head
`3d2dd7a48ee2573d14fb1dbea18ef8b4e3498c6a26f82d76ea589dba3c821078` to current head
`b75a2580d1d6820392aa74ba5b7671b01baed1740fe2097c2a78e24663b5e4d5`. It authenticates 15 frozen
artifacts and 30 live readers, appends the 47,622-byte M07-T06 artifact
`sha256:d025da5329d5b56b9b46e7292a08883386a151add5e419edf2a9345425319494`, reseals reader indexes
`[0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 14, 15, 16, 17, 18, 19, 22, 23, 26, 27]`, and appends T06
readers `[28, 29]`. Sequences 1–14 and predecessor artifact bytes remain unchanged. This is
reviewed local-reader evidence and claims no hosted M07-T06 result. `DEBT-I07-009` and
`DEBT-I07-013` register the temporary compatibility-reader bridges under I07-04 for removal by G07.

Reviewed checkpoint sequence 16 links exact sequence 15 head
`b75a2580d1d6820392aa74ba5b7671b01baed1740fe2097c2a78e24663b5e4d5` to current head
`f9e77791148c7f89e586b6eb8964338185a35c11900b69262a159002af0838cd`. It authenticates 16 frozen
artifacts and 32 live readers, appends the 49,892-byte M07-T07 artifact
`sha256:3129a8e40c837a1c49d7fe206de794e0f7f7e130dc7e5e90a012b9e38bf07334`, reseals reader indexes
`[0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 14, 15, 16, 17, 18, 19, 22, 23, 26, 27, 28, 29, 30, 31]`,
and appends T07 readers `[30, 31]`. Sequences 1–15 and predecessor artifact bytes remain unchanged.
This is reviewed local-reader evidence and claims no hosted M07-T07 result. `DEBT-I07-014`
registers the temporary activation-reader bridges under I07-04 for removal by G07.

Reviewed checkpoint sequence 17 links exact sequence 16 head
`f9e77791148c7f89e586b6eb8964338185a35c11900b69262a159002af0838cd` to current head
`cc7227fe73f0b03fa56e18c075de5bc8bb2f87c4425aa669fd437ed2cc09730e`. It authenticates 17 frozen
artifacts and 34 live readers, appends the 44,224-byte M07-T08 artifact
`sha256:c65d4f2de1407fffb891b5d3ba2fc8a3a8d4e3f0fb76c8b8f2719be6b310b3f9`, reseals reader indexes
`[14, 15, 16, 18, 22, 26, 27, 28, 29, 30, 31]`, and appends the 84,219-byte T08 proof reader at
`[32]` (`sha256:08f143107430dde90cf1865c21d7ce1ec854897b0c1c4306b96525bdd0d18daa`) and the 24,939-byte T08
root reader at `[33]` (`sha256:b97e7991e0ac20e7232112594228fdd829a536e81d16d06fd3f909e7e3a02492`).
Sequences 1–16 and all 16 predecessor artifact files remain byte-identical. This local-reader
checkpoint makes no hosted M07-T08 claim. `DEBT-I07-015` records the temporary historical
recovery-reader bridges under I07-04 for removal by G07.

Reviewed checkpoint sequence 18 links exact sequence 17 head
`cc7227fe73f0b03fa56e18c075de5bc8bb2f87c4425aa669fd437ed2cc09730e` to sequence 18 head
`4e9ac8adac57d058444bfe2113fbb5dd364cd24d6052ad5f2cd8910a13c22b45`. It preserves all 17 frozen
artifacts and all 34 reader identities while resealing reader indexes
`[0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 14]` after the final fail-closed T08 compatibility-reader
upgrade. Sequence 17 and every artifact byte remain unchanged. This is reviewed local-reader
evidence and makes no hosted M07-T08 claim; the temporary compatibility bridges remain registered
for I07-04 removal by G07.

Reviewed checkpoint sequence 19 links exact sequence 18 head
`4e9ac8adac57d058444bfe2113fbb5dd364cd24d6052ad5f2cd8910a13c22b45` to sequence 19 head
`abf161e5a85053e19ce218127aa3f7d3a3ac8480b68b01a4185618ac732393a3`. It preserves all 17 frozen
artifacts and all 34 reader identities while resealing only reader index `[28]` to 93,916 bytes
(`sha256:d0b6ec50df131066283619a01fa41fffdbb2a68c409d3c8d1a816f625f658521`). The fail-closed staging
verifier caught equal-length final T08 N-038/N-041 normative wording with stale semantic hashes;
sequence 19 records the corrected reader receipt. Sequences 1–18 and every artifact byte remain
unchanged. This is reviewed local-reader evidence and makes no hosted M07-T08 claim; the temporary
compatibility bridges remain `DEBT-I07-015`, owned by I07-04 for removal by G07.

Reviewed checkpoint sequence 20 links exact sequence 19 head
`abf161e5a85053e19ce218127aa3f7d3a3ac8480b68b01a4185618ac732393a3` to sequence 20 head
`8ba332b059e508dcb93aec4211edf3dcb10fb497d3a743b61ff7ee7e08c8a28e`. It preserves all 17 frozen
artifacts and all 34 reader identities while resealing only reader index `[30]` to 106,509 bytes
(`sha256:d322bf867930215d0f9e0f532bdacbea4ba50145dfa5df38f2e559102cc080ef`). The fail-closed T07
activation reader exposed stale T08 successor receipts after terminal close-race hardening changed
the runtime-activation-internal source, focused tests, and generated JavaScript/source map. The
exact successor receipts were repaired; the activation verifier and 18/18 root tests pass, and
this receipt repair changed no production behavior. Sequences 1–19 and every artifact byte remain
unchanged. This is reviewed local-reader evidence and makes no hosted M07-T08 claim; the temporary
compatibility bridges remain `DEBT-I07-015`, owned by I07-04 for removal by G07.

Reviewed checkpoint sequence 21 links the exact sequence 20 head
`8ba332b059e508dcb93aec4211edf3dcb10fb497d3a743b61ff7ee7e08c8a28e` to current head
`ce12c066545e21779abf891898aaf0b09ceb1c0c1b51be382a0adabd5f86e939`. It preserves sequences
1–20 and every predecessor artifact byte, appends the 64,493-byte M07-T09 artifact
`sha256:9d0f764e35f5400fa662874784fba6f6492a39a0e60557fe1a9c7d7eab5407c9`, reseals 27 historical
compatibility readers, and appends the 64,932-byte proof reader
`sha256:da3fed33227c78eef872d06a3aedaf98a4e87e91de12893a21aceb5a9365216f` plus the 17,341-byte root
reader `sha256:f50017b668eb7f4a60d596a2d87a7e5b067989a9e1fe9a00270e685c44a4b8f6`. The chain now
authenticates 18 frozen artifacts and 36 current readers. This is reviewed local-reader evidence,
not a hosted M07-T09 claim; `DEBT-I07-016` records the temporary successor bridges for I07-04
removal by G07.

Reviewed checkpoint sequence 22 keeps sequence 21 intact and links predecessor head
`ce12c066545e21779abf891898aaf0b09ceb1c0c1b51be382a0adabd5f86e939` to current head
`aef9881c8fc540873f889a09754e5f2c19adc3c19934ba0fcfcf5e6a12b2da9e`. The inventory remains
18 frozen artifacts and 36 reader identities. Only workflow-dependent reader indexes
`[8, 10, 11, 12, 14]` are resealed; every frozen artifact and every predecessor checkpoint remains
unchanged.

M07-T09's child Vitest launcher also has a build-independent CI-contract preflight. It uses
`process.execPath`, the repository-local Vitest entrypoint, and owner-only package/workspace/config
and one-test files under the exact step temp root while retaining the scheduler-owned Node
permission policy. No package-manager, `PATH`, or ignored `dist` output is involved; file/cache
parallelism is disabled and cleanup is unconditional. The full T09 verifier still runs
authoritatively in required-exhaustive execution after the dependency graph builds its inputs.

M07-T10's full verifier launches its focused suite with `process.execPath` and the repository-local
Vitest entrypoint under an owner-only temporary config. It disables cache and file parallelism,
fixes one worker, bounds JSON-reporter output and execution time, removes inherited `NODE_PATH`,
redacts failure output to code-owned identities and size/digest metadata, and deletes temporary
state in `finally`. This is an authoritative exhaustive workload after its build prerequisites,
not a package-manager or `PATH`-resolved shortcut.

The final T08 reader does not infer coverage from matching strings. Exact AST structures identify
the executable CI registrations, shared-state mappings, and direct 12-runtime/9-root test
inventories, while code-owned exact source receipts bind their executable bodies and effective
flow. All proof-authority inputs use bounded identity-safe reads. The compiler-negative inventory
remains exactly 14 cases.
