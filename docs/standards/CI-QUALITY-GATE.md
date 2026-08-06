# CI Quality Gate

## Purpose

The hosted CI gate must prove the same safety properties as the cumulative task commands without
restarting identical builds and tests through every historical prerequisite wrapper.

The task-specific `verify:*`, `test:*`, aggregate `test`, and aggregate `check` scripts remain the
reviewed compatibility surface. GitHub Actions first verifies the required-exhaustive contracts,
then invokes `scripts/ci/run-required-exhaustive-quality-gate.mjs` as the official
`REQUIRED + EXHAUSTIVE` authority. `scripts/run-ci-quality-gate.mjs` is retained only behind the
explicit manual `legacy-rollback` workflow mode.

## Single-pass order

The gate runs from a fresh workspace in this order:

1. validate the frozen CI inventory and the orchestrator's own mutation tests;
2. check formatting and lint the complete repository;
3. verify generated structural-validator bytes;
4. build and typecheck the workspace once through a cache-read-disabled Turbo graph;
5. run every package's complete test suite once with controlled concurrency;
6. run all 65 proof verifiers directly in the reviewed order, ending with the M07-T05 local
   control-plane API proof;
7. run all 65 root proof and mutation files as separate fail-fast processes; and
8. run the dependency graph and hostile boundary fixtures.

The current legacy expansion contains 2,209 leaf process invocations but only 215 distinct
workloads. The optimized gate covers all 215 distinct workloads. Repeated prerequisite checks
inside proof builders remain intact because those checks are evidence, not orchestration overhead.
The measurement recursively expands exact root-level `pnpm <script>` references beginning at
`check`; commands with no further local root-script indirection are leaves, and the distinct
inventory is sorted before hashing.

## Fail-closed invariants

The gate refuses to run when any of these conditions changes without an explicit review:

- the 65 task IDs, verifier files, root test files, or their order;
- any of the 423 legacy prerequisite command segments;
- the exact 138-step normalized execution plan;
- a focused package test that is no longer included by its full package suite;
- any drift in the reviewed `test` command of any workspace package, including packages without a
  focused prerequisite;
- any byte or package-glob drift in `pnpm-workspace.yaml`; the reviewed graph roots are exactly
  `apps/*` and `packages/*`;
- a root or app/package `vite.config.*`, `vitest.config.*`, or `vitest.workspace.*` file, or a
  `vitest` field in the root or any workspace package manifest;
- an unknown package, task, prerequisite, executable, or shell expression;
- shell metacharacters, operators, quoting, or escaping hidden inside a workspace package test
  command;
- a generator, writer, changed-file filter, or affected-only shortcut; or
- the tracked working-tree bytes, executable modes, tracked-file count, or Git index object IDs
  before and after the gate.

Proof generators and evidence writers are never CI inputs. Proof output and success are never read
from cache. Timing data is observational and cannot influence pass or fail.

The reviewed live prerequisite inventory is pinned as
`sha256:106b40cbcb85dd63833cdf7da29ca4b87d30e6fdced7d8b6e7ce91742b5e98d1`.
The ordered 2,209-entry legacy leaf-invocation inventory is pinned as
`sha256:a4ca5e101bab7ba21ea56dccc9c2e9306aaad3cb60e3b540ba32d70a0f587b9f`; its sorted
215-entry distinct-workload inventory is pinned as
`sha256:af7be654a83989448ba8db76c8e9f22ba4ce515f46834853f95f4ac14a56cb90`. The retained
plan/projection is pinned as
`sha256:bcf9a4465fe246f547e1254464d6d30f4d3a9e50601655c967e4645e7ba863e1`.
The scheduler-neutral live successor inventory is independently pinned as
`sha256:d26e9fa74f85be06852cd4f667467606735687e851ab03a6ef5611700c9ccc92`.
Its exact live workload-id set is pinned as
`sha256:4d222d3a6f8a37b17473922f2f822c32f9a7f7360cae896a9d763684afd6dc19`, and its ordered
id/label/command/argument equivalence projection is pinned as
`sha256:bb11b9e4d1d1f1223e3b6f01aac88c2560b0b5f6468bcffe976fd5f35c0514d8`.
The preceding M07-T03 retained/neutral workload-set equality receipt remains historically pinned as
`sha256:49977fca154b0bf06639b8e3f0b667d04e060603cc14ec99660c8c434b7f5edb`, and its ordered
projection is pinned as
`sha256:0cf74075304304385594ae6c7def89c76f22a82be3059bc0841f408682f198f8`; it is not the current
M07-T05 live authority. The authority-specific
required plan is pinned as
`sha256:4d26089fc10902513950f0051fb0d860a82c14374e426fd40b3259a43a63b466`; the non-authoritative
shadow form is pinned separately as
`sha256:442f9035b06b5177d6965fc6ec906304329259b04da760da67a5e0a9810159ea`.

The reviewed workspace package-test inventory contains 14 Vitest commands and is pinned as
`sha256:5f3ee5e9ff2b0f09c06578db7ecf48c7c8a9eafd679c98a6e3af20318c4943c4`. Two
application packages currently have no package-level test command; that absence is part of the
same exact inventory rather than an implicit exemption.

The workspace manifest itself is pinned as
`sha256:6c693fc7e2b55dfc4b2e84a9e267aef0b6aeecb3160a04cdba67ce570f860be9`; this
prevents an otherwise valid package manifest from being omitted from pnpm and Turbo discovery.

At the M07-T01 checkpoint, the frozen inventory contains 61 proofs, 387 prerequisite segments,
1,781 ordered leaf invocations, 202 distinct leaf workloads, and 130 normalized single-pass
steps. Twenty-four independent orchestrator contract tests protect that exact profile. The
prerequisite inventory is pinned as
`sha256:bfce7beb80d98b29a21c43263c422e87218738ed0c040e6a45c60a35fb8f8290`; the other
historical digests remain in the immutable I07-02 baseline and ADR 0011 rather than the live pins
above.

The preceding M07-T04 successor contained 64 proofs and 136 normalized single-pass steps. The
M07-T05 live successor contains 65 proofs, 423 prerequisite segments, 2,209 ordered leaf
invocations, 215 distinct leaf workloads, and 138 normalized single-pass steps. The immutable
I07-02/M07-T01 receipts retain their original 61/130 values; no post-cutover successor rewrites
them. These pins describe the reviewed local/code-owned successor and do not claim a new hosted CI
run has passed.

`SIGINT` and `SIGTERM` become permanent cancellation state, are forwarded to the active process
group, stop later steps, and preserve exit codes 130 and 143. This prevents a superseded workflow
from leaving child or grandchild processes behind or turning cancellation into success.

## GitHub Actions trust boundary

The workflow:

- uses immutable full commit SHAs for GitHub-owned actions;
- grants only read access to repository contents;
- does not persist checkout credentials;
- cancels superseded work for the same branch or pull request;
- prevents external forks from reading or writing the trusted dependency cache;
- allows same-repository pull requests to restore but not save that cache; and
- saves the dependency cache only after a successful `main` push.

The pnpm store is a dependency download cache only. Builds, typechecks, package tests, verifiers,
mutation tests, and boundary checks run fresh.

## Updating the gate

When a proof task or prerequisite is added:

1. keep its task-specific root scripts intact;
2. add its verifier and root test to the frozen proof inventory;
3. classify every prerequisite and prove focused tests remain inside the full package suite;
4. review every workspace package's exhaustive Vitest command and keep test configuration absent;
5. review the normalized plan for generators, writers, filters, duplication, and missing work;
6. intentionally update the prerequisite, leaf-invocation, distinct-workload, workspace-test, and
   plan SHA-256 pins;
7. run the orchestrator contract tests and the complete single-pass gate; and
8. record the hosted run URL and timing before reducing the timeout.

Changing a pinned digest without reviewing the corresponding readable inventory is not an
acceptable update.

## I07 modular migration

### Historical I07-01 checkpoint

I07-01 added a non-authoritative `SHADOW + EXHAUSTIVE` candidate beside this gate. The candidate
imported this gate's validated proof inventory and exact normalized plan rather than maintaining a
second command list. It executed every global step and every verifier/root-test pair from fresh
inputs. Candidate proof pairs could run with concurrency two only while the sequential result
remained authoritative. It did not select by changed paths, read cached proof success, generate
evidence, or write tracked files.

The shadow also validates one hash-chained current-reader checkpoint whose genesis digest is pinned
outside the manifest by the I07-01 baseline. Frozen task artifacts remain the historical claim
authority; the checkpoint records reviewed live proof/test readers that can legitimately receive
security hardening after task completion. The checkpoint never chooses a command. Executable
verifier/test ownership remains in reviewed code.

The existing sequential gate remained the sole pass/fail authority throughout that checkpoint.
The archived I07-01 local and hosted comparisons are historical evidence, not I07-02 cutover
evidence.

M07-T02 later appends reviewed current-reader checkpoint sequence 3. Its head
`f92e879b3a72e75abb07af2b2bcfded62e014b99aa0cbe69c64aee12d5379882` authenticates nine frozen
artifacts and eighteen live readers without rewriting either historical checkpoint. M07-T03
appends historical sequence 4; its head
`ee2d72c3529d9295945d339fb214c41dbbf906ffa6613a7ad6e766ec79c1bcf5` authenticates ten frozen
artifacts and twenty live readers without rewriting any predecessor. A corrective M05-T04
current-reader append after M07-T03 established historical sequence 5; its head
`7df3631d509ed7e65c571566a825d6d3cd52d336e1a74512bf3e8e26920749b3` authenticates eleven frozen
artifacts and twenty-two live readers. Sequence 6 only advances the M06-T11 proof/test receipts for
a bounded, explicit 20-second nested Vitest timeout; its then-current head `790ad28b6fd441e6d5f40f277a97e8de36a178a9e50fff3e208e6c27588915fd` still
authenticates eleven frozen artifacts and twenty-two live readers. It changes no coverage,
assertion, concurrency, frozen evidence, workload/proof count, progress, or plan digest, and
sequences 1–5 remain byte- and hash-unchanged.

Reviewed checkpoint sequence 7 links predecessor head
`790ad28b6fd441e6d5f40f277a97e8de36a178a9e50fff3e208e6c27588915fd` to its then-current head
`d50b5ee4fb265f241bac7652b979af0146d530528ba6db8fc98c8fb3225a5ba5`, authenticating 13 frozen
artifacts and 26 live readers. It adds the 34,612-byte M07-T04 artifact
`sha256:29555326d51073c50937519d8706049ad17287079cc3ef4dc7060bb3a3225394`, live T04 proof/root and
current M05-T06 compatibility readers. It seals the exact final receipts of the complete 26-reader
live set after all T04 compatibility bridges and the reviewed CI timeout calibration, including
current M05-T09, M06-T01/T05/T08/T09/T10/T11, and M07-T01/T02/T03 readers. The frozen M05-T06
artifact remains byte-identical and historically
`PARTIAL`; live P-17 is `PROVEN`. Sequences 1–6 remain unchanged. This local reviewed checkpoint
does not claim a new hosted CI run.

Reviewed checkpoint sequence 8 links the exact sequence 7 head
`d50b5ee4fb265f241bac7652b979af0146d530528ba6db8fc98c8fb3225a5ba5` to its then-current head
`f707fb4c3338aeda79eb6242b645b5e864ce54b1e3955373e8edebcd7e026b8a`, authenticating 14 frozen
artifacts and 28 live readers. It adds the 41,945-byte M07-T05 artifact
`sha256:144e8a46b3b41a1f98a022bf4c16dddb9d7415af4e5033322484d4bdd49c55b9`, its 73,915-byte proof
reader `sha256:f66d40863a46dd7ed9e28afb2c78f8afbda8aee964e72d4fba60e65e55a351b3`, and its 17,291-byte root
reader `sha256:490d4f922ea41dc7bca178cc54ab938ab136f0b922d7842af623001eabf60a65`. Prior live receipts,
including current M07-T01 through M07-T04 and reference-host source-audit compatibility readers,
are resealed after the T05 compatibility changes. Sequences 1–7 and all predecessor frozen
artifacts remain unchanged. This local reviewed checkpoint makes no new hosted CI claim; I07-04
still owns removal of the remaining compatibility-reader debt.

Reviewed checkpoint sequence 9 links the exact sequence 8 head
`f707fb4c3338aeda79eb6242b645b5e864ce54b1e3955373e8edebcd7e026b8a` to its then-current head
`94f48160552a6e0de702f71200e56c23d61bab8692d43f3ac1104dcfa681568b` with the same 14 frozen
artifacts and 28 readers. Exactly reader indexes `[16, 17, 18, 19]` change: M07-T02 proof
94,612 bytes / `sha256:4c69fa253ba2d9432a75c6c6aaa2ad69e23c3683c43dae9c92dc73b3208937d9`;
M07-T02 root 20,959 bytes / `sha256:fdcfc8c4868c1ee084b652e42c7dab4750bc569c4c05928dde7136118b4689ed`;
M07-T03 proof 86,174 bytes / `sha256:5624b06d8d0962d18c9a920a34a95b0023f4909d8c7b7812057bedcdc62ab5ab`;
and M07-T03 root 21,119 bytes /
`sha256:10c1a677b88b5c6bd4389e659ce38f11a627ae92de4aafe4ffade0de23790f11`.
The minimal T05 compatibility bridges authenticate the current shared strict-JSON internal
source/distribution and exact T03 → T04 → T05 aggregate adjacency while projecting the unchanged
frozen T02/T03 artifacts. Sequences 1–8 and all frozen artifacts remain unchanged. This is reviewed
local evidence only, not a hosted CI claim; `DEBT-I07-012` cleanup remains owned by I07-04.

Reviewed checkpoint sequence 10 links the exact sequence 9 head
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

Reviewed checkpoint sequence 11 links the exact sequence 10 head
`bd3f5b90656f0e41d7f6aa439fdc01889e9ebeada26cd3caf8624c3ce1db7d07` to its then-current head
`63b8af4da431f0918c7ea9480564750bd12057af2bc83c294d962113ce7c9be8` with the same 14 unchanged
frozen artifacts and 28 readers. Only indexes `[26, 27]` change: the M07-T05 proof reader is 77,034
bytes at `sha256:c704e25024eaf7bdf317cc144f6b85922a3fe73a24c9c91e639ede032e22eb6f`,
and its root reader is 17,578 bytes at
`sha256:4871c406390c4c9b36bff1c417a6c8dd22798736ea8daad1c63a3cbd0a978389`. Sequences 1–10 and every
frozen artifact remain unchanged. This is a reviewed local-reader checkpoint and makes no hosted
CI claim.

Reviewed checkpoint sequence 12 links the exact sequence 11 head
`63b8af4da431f0918c7ea9480564750bd12057af2bc83c294d962113ce7c9be8` to its then-current head
`85c49a0d79346bf2ea92b716f6b43c5d95d164209e3d67af34871a334686e10e` with the same 14 unchanged
frozen artifacts and 28 readers. Only indexes `[26, 27]` change: the M07-T05 proof reader is 77,507
bytes at `sha256:e2050408c5bf3e084eacd6e42880310dafbfdf03b79821500cc0567b998f7d66`,
and its root reader is 17,716 bytes at
`sha256:061b40ea20e0f7ee362f26bd54db954c3caea338df5e2f090ce34a4618ac37cc`. This successor authenticates
the exact ADR token-bound documentation update while the M07-T05 artifact and every other frozen
artifact remain unchanged. This is reviewed local-reader evidence; hosted CI has not yet been
claimed, and I07-04 still owns the compatibility-reader debt.

Reviewed checkpoint sequence 13 links the exact sequence 12 head
`85c49a0d79346bf2ea92b716f6b43c5d95d164209e3d67af34871a334686e10e` to current head
`146b04f1c8209be64168afb451ceee2c422da0cdced116f8d08beafe795c533c` with the same 14 unchanged
frozen artifacts and 28 readers. Only index `[9]` changes: the M06-T09
publisher-bundle-publication root reader is 63,859 bytes at
`sha256:ae7b688d904b4c77632fd78e0ee23b2264eae1574b4350306b5e2ec1b9974b8d`. A hosted
required-exhaustive attempt exposed two stale M07 successor/current-receipt assertions in that
reader; after the narrow reader-only correction, its focused root passes 112/112 and the frozen
M06-T09 artifact remains unchanged. This is reviewed local-reader evidence, does not claim hosted
CI success, and leaves the compatibility-reader debt with I07-04.

### I07-02 required-exhaustive architecture and completed cutover

`exhaustive-workload-inventory.mjs` is now the neutral executable authority. It validates the
repository inputs and owns all 138 ids, labels, shell-free command/argument vectors, dependencies,
execution classes, and inert shared-state records without importing either scheduler. The retained
legacy sequential implementation is a rollback mirror. The rollback-only
`required-exhaustive-equivalence.mjs` adapter compares its exact ordered plan against the neutral
inventory, proves set equality and exactly-once ownership, and retains the reviewed plan digest.
It cannot turn either source into executable authority.

The equivalence adapter also normalizes terminal receipts. PASS requires all 138 exact workloads
to report PASS after an observed close and requires the tracked-workspace digest to remain
unchanged. Missing, duplicated, skipped, not-run, cancelled, timed-out, failed, or unclosed work
fails closed. Inventory, workload, workspace, cancellation, and timeout are distinct terminal
authorities; timing and concurrent sibling completion order are observational only.

The exhaustive plan factory accepts no scope except `EXHAUSTIVE`, defaults to `REQUIRED`, and
requires `SHADOW` to be explicit. The official pull-request and `main` workflow now invokes that
runner without an authority override, so its fail-closed default is `REQUIRED`. The exact 4,994-byte
workflow is pinned as
`sha256:04429211188d351ee720c1e64802d48e34e425348b397c4bb835ba5c1fe4ccf5`.
The retained sequential runner is not an automatic peer: it runs only when a trusted operator
manually dispatches `legacy-rollback`. Event name and mode are part of the concurrency key, so a
rollback exercise cannot cancel a pull-request or `main` authority run.

All 138 workloads have one exact shared-state class:

| Execution class                  | Count | Scheduling rule                                      |
| -------------------------------- | ----: | ---------------------------------------------------- |
| `GLOBAL_EXCLUSIVE`               |     6 | Drained repository-wide barrier                      |
| `WORKSPACE_OUTPUT_EXCLUSIVE`     |     1 | Sole workspace build/typecheck writer                |
| `PACKAGE_TEST_EXCLUSIVE`         |     1 | Drained complete package-test barrier                |
| `PROOF_READ_ONLY`                |    68 | No shared workspace writes                           |
| `PROOF_OS_TEMP_ISOLATED`         |    51 | Writes only to a workload-owned OS temp root         |
| `PROOF_TRACKED_ALIAS_EXCLUSIVE`  |    10 | Real tracked aliases under a drained scheduler       |
| `PROOF_WORKSPACE_TEMP_EXCLUSIVE` |     1 | Direct source-audit workspace-temp root-test barrier |

Fifty-four proof pairs may overlap pair-by-pair at concurrency two after their predecessors pass. A
pair's root test still follows its verifier. Ten real tracked-alias pairs and the
`reference-host-web-source-audit` pair are the eleven exclusive barriers.

The added `control-plane-reference-preflight` pair is ordinary and non-barrier. Its verifier is
`PROOF_READ_ONLY`; its root mutation test is `PROOF_OS_TEMP_ISOLATED` and may write only to the
runner-owned OS temp root. Neither side receives workspace-write, port, or native-addon authority,
and the verifier receives no child-runtime-probe grant.

The added `control-plane-local-api` pair is also ordinary and non-barrier. Both its verifier and
root mutation test are `PROOF_OS_TEMP_ISOLATED`. The verifier receives the exact
`VERIFIER_RUNTIME_PROBE` child-process policy, while the root receives only the ordinary
`NODE_TEST_HARNESS` policy. Neither workload receives workspace-write or port authority. Only
those two exact workloads receive the native-addon grant required to load the reviewed SQLite
binding. Their OS-temp roots remain runner-owned and identity-checked.

Only these verifier proofs receive both runner-owned temp-write and child-runtime-probe authority:

- `publisher-catalog-pinning`;
- `publisher-bundle-publication`;
- `publisher-official-golden`;
- `publisher-invalid-source-matrix`;
- `control-plane-bundle-store`; and
- `control-plane-bundle-verification`; and
- `control-plane-local-api`.

Native-addon authority is limited to the exact `reference-host-web-source-audit`
verifier/root-test pair, the `publisher-invalid-source-matrix` root test, and the exact
`control-plane-local-api` verifier/root-test pair. The Publisher probe loads the reviewed Rolldown
binding; the local-API pair loads the locked SQLite binding. The source-audit verifier remains
workspace-read-only; its root test owns the single exclusive workspace-temp exception.
Fastify 5.11.2 and better-sqlite3 13.0.3 are exact lockfile inputs, and the reviewed production
dependency audit reports no known vulnerability. This is local dependency evidence, not a claim
that the M07-T05 successor has passed hosted CI.

Every proof process gets a fresh, identity-checked temp root and generated Node permissions.
Direct workspace-write grants, child processes, and addons are absent unless the code-owned
workload record grants them. Inherited `NODE_OPTIONS` is rejected, and a mandatory preload denies
TCP and UDP listener binding. The runner authenticates temp identity again before cleanup.

Eighteen root-test records also own an orthogonal schema-v2 Node-permission compatibility policy:
120 workloads are `NONE`, two are `FIXTURE_COPY`, fifteen are `REVIEWED_SYMLINK`, and one is
`FIXTURE_COPY_AND_REVIEWED_SYMLINK`. Fixture copy is limited to the exact code-owned workspace
source, a no-follow destination inside the workload's own temp root, two reviewed recursive option
shapes, bounded regular trees, and matching source/destination fingerprints. Symlink handling
keeps ordinary targets in the same temp root and pins fourteen workspace-target workloads to
eighteen exact target-and-kind rules. Eight unsafe-input targets are mirrored into the caller's
temp root; ten historical canonical-path or inode checks retain their exact tracked alias.

The generated grant list still adds no workspace-write, shared-parent, or sibling-temp path. This
adapter is defense in depth for fixed trusted repository tests, not a security sandbox for
adversarial JavaScript or child processes. Its real tracked aliases are covered by reviewed test
behavior, exclusive scheduling, and the complete gate's closing tracked-workspace seal. Unlisted
workloads, sources, workspace targets, target kinds, symlink-parent traversal, and copy options
fail closed.

`REQUIRED` rejects injected success observations and every injected runner, Git reader, workspace
capture, guard, process, environment, signal, or timeout seam. Those seams exist only for
non-authoritative contract tests. Its opening clean-input proof binds HEAD to the authenticated
revision and requires empty porcelain-v2 status, including staged, unstaged, non-ignored untracked,
and submodule state. The hosted `SHADOW` candidate uses the same real clean-input proof; only
focused non-authoritative tests may inject that boundary.

One first-terminal record is shared by the host handlers, scheduler, and child-process registry.
The first timeout, process error, nonzero close, execution error, SIGINT, or SIGTERM fixes the
primary reason and exit code, immediately terminates every active group, and prevents later
launches. Later signals may escalate but cannot replace that record. Every active child `close` and
isolation cleanup is still awaited before the gate settles.

The runner owns a 17-minute soft complete-gate deadline, 15-minute per-workload deadlines, and a
five-second child-termination grace.
Because authentic settlement still awaits child `close`, cleanup, and boundary capture, the Phase A
command also has an 18-minute operating-system ceiling with a 30-second kill grace. GitHub's
25-minute job ceiling remains outside both. An outer-ceiling failure is red and cannot serve as
promotion evidence; setup, contract checks, receipt emission, and hosted variance retain their own
headroom.

The required execution design layers three closing guards:

- a no-follow seal across the 33 reviewed build and Turbo output roots around the proof phase;
- a bounded digest of every non-ignored untracked entry around the full 138-step region; and
- a tracked-workspace boundary covering bytes, executable modes, file count, and Git index object
  ids around the full run, including failure and cancellation paths.

No proof-result cache is admitted. The pnpm store may cache immutable dependency downloads only;
every build, test, verifier, mutation, checkpoint, and boundary result is recomputed.

I07-02 promoted execution to hosted `REQUIRED + EXHAUSTIVE` only after the same revision proved:

- exact plan and workload-set equality;
- exactly-once coverage for every global step and proof pair;
- identical pass/fail outcomes with no tracked-byte or index drift;
- safe cancellation and sibling-process termination;
- code-owned shared-state, build-output, port, and temporary-path classification; and
- a recorded local and hosted timing comparison.

The accepted pre-cutover comparison at commit
`077560fe81d0fcf4560554dd7511413bad5bc30e` passed the 130-workload required runner and retained
legacy runner on the same pull-request revision. The official cutover at commit
`3cf72552ee3ea23a0b5e99f782f837bc6237f78b` passed hosted run
[`30699616361`](https://github.com/desenlab/desen-app/actions/runs/30699616361): the required
`Quality gate` completed in 10 minutes 33 seconds, the manual rollback job was skipped, and no
shadow workflow ran. The exact program, including an earlier rejected common-drift attempt, is
archived in
[`i07-02-required-exhaustive-equivalence.json`](../proof/baselines/i07-02-required-exhaustive-equivalence.json).

I07-03 may calculate an `AFFECTED` plan only in shadow. Unknown paths, statuses, file modes,
dependency or policy changes, missing Git authority, and any ambiguous classification must expand
to `EXHAUSTIVE`. Promotion is reserved for I07-04 after ADR 0011's frozen threshold passes.
`EXHAUSTIVE` fresh execution remains mandatory on `main`, release candidates, and manual audits.
I07-02 implements no affected selector. Its completed promotion closed `DEBT-I07-008` by removing
the temporary shadow workflow and modular comparison adapter/test. The current-reader bridges
remain owned by I07-04. `DEBT-I07-007` keeps the sequential runner, rollback-only equivalence
adapter, and other rollback references under I07-05 until their exact machine-checked removal
conditions in `docs/plan/DEBT-REGISTER.md` are satisfied.
