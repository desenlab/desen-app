# CI Quality Gate

## Purpose

The hosted CI gate must prove the same safety properties as the cumulative task commands without
restarting identical builds and tests through every historical prerequisite wrapper.

The task-specific `verify:*`, `test:*`, aggregate `test`, and aggregate `check` scripts remain the
reviewed compatibility surface. GitHub Actions first verifies the required gate contracts, then
invokes `scripts/ci/run-required-affected-quality-gate.mjs` as the official dispatcher. Only an
authenticated eligible same-repository pull request may reach fresh `REQUIRED + AFFECTED`; every
unsafe boundary, plus `main`, release, and manual audit, runs fresh `REQUIRED + EXHAUSTIVE`.
`scripts/run-ci-quality-gate.mjs` is retained only behind the explicit manual `legacy-rollback`
workflow mode.

## Single-pass order

The gate runs from a fresh workspace in this order:

1. validate the frozen CI inventory and the orchestrator's own mutation tests;
2. check formatting and lint the complete repository;
3. verify generated structural-validator bytes;
4. build and typecheck the workspace once through a cache-read-disabled Turbo graph;
5. run every package's complete test suite once with controlled concurrency;
6. run all 75 proof verifiers directly in the reviewed order, ending with the M08-T04 editor-core
   content-edit proof;
7. run all 75 root proof and mutation files as separate fail-fast processes; and
8. run the dependency graph and hostile boundary fixtures.

The current legacy expansion contains 3,237 leaf process invocations but only 251 distinct
workloads. The optimized gate covers all 251 distinct workloads. Repeated prerequisite checks
inside proof builders remain intact because those checks are evidence, not orchestration overhead.
The measurement recursively expands exact root-level `pnpm <script>` references beginning at
`check`; commands with no further local root-script indirection are leaves, and the distinct
inventory is sorted before hashing.

## Fail-closed invariants

The gate refuses to run when any of these conditions changes without an explicit review:

- the 75 task IDs, verifier files, root test files, or their order;
- any of the 519 legacy prerequisite command segments;
- the exact 159-step normalized execution plan;
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
`sha256:415a954a1b05f17f27ad33711c03cd7a3a2ccd86095611437e30083dea75e7b1`.
The ordered 3,237-entry legacy leaf-invocation inventory is pinned as
`sha256:ed766cc0193d06627b6107ff5f4d7a6230dfaa6db21ed301d3d92ec4ea1a4adb`; its sorted
251-entry distinct-workload inventory is pinned as
`sha256:c7fa968c47fc8cc1088b209e5fd89a4e1c86e866b4efac59febddda59cf0fa0b`. The retained
plan/projection is pinned as
`sha256:c8c90a4b9ede0c8a943657e27872fc7e91d0ce6f033a14c82e8fb43f8028b426`.
The scheduler-neutral live successor inventory is independently pinned as
`sha256:3879dcd4c9716b7f08746953c62170de7bd33c786f747849b8aed38e0fe1e62c`.
Its exact live workload-id set is pinned as
`sha256:59590ce000046edaa3235aae6b0662a865a24b4b7019be98825863193982839a`, and its ordered
id/label/command/argument equivalence projection is pinned as
`sha256:0178695219a933b3d195c80bfda6174ad9992c9c5fc32a0f212c3b75475f151f`.
The preceding M07-T03 retained/neutral workload-set equality receipt remains historically pinned as
`sha256:49977fca154b0bf06639b8e3f0b667d04e060603cc14ec99660c8c434b7f5edb`, and its ordered
projection is pinned as
`sha256:0cf74075304304385594ae6c7def89c76f22a82be3059bc0841f408682f198f8`; it is historical, not
the current M08-T04 live authority. The authority-specific required plan is pinned as
`sha256:30a193cbc27316792bd577dcecdc87c10e680e2e033698ceb90787c2cbcf1b51`; the
non-authoritative shadow form is pinned separately as
`sha256:4832ece9c672f678920b6d24f004b882315ab9fe01506e9a53d9801a86ed61ab`.

The reviewed workspace package-test inventory contains 15 test scripts and is pinned as
`sha256:0faa6116c99d11f6d059a224de6b08a723657b5c5690a3138e6290d240524820`. Two
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

The preceding M07-T08 successor contained 68 proofs and 144 normalized single-pass steps. The
historical M07-T09 working-tree successor contained 69 proofs, 455 prerequisite segments, 2,769
ordered leaf invocations, 227 distinct leaf workloads, and 146 normalized single-pass steps. The
historical M08-T01 successor contained 72 proof pairs, 489 prerequisite segments, 3,129 ordered leaf
invocations, 242 distinct leaves, and 153 normalized single-pass steps. The historical M08-T02
successor contained 73 proof pairs, 499 prerequisite segments, 3,155 ordered leaf invocations, 245
distinct leaves, and 155 normalized single-pass steps. The historical M08-T03 successor contained
74 proof pairs, 509 prerequisite segments, 3,191 ordered leaf invocations, 248 distinct leaves, and
157 normalized single-pass steps. The current M08-T04 successor contains 75 proof pairs, 519
prerequisite segments, 3,237 ordered leaf invocations, 251 distinct leaves, and 159 normalized
single-pass steps. The immutable
I07-02/M07-T01 and M07-T09 receipts retain their original values; no post-cutover successor
rewrites them. These current M08-T04 pins are local code-owned authority and make no hosted
M08-T04 claim.

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
`85c49a0d79346bf2ea92b716f6b43c5d95d164209e3d67af34871a334686e10e` to its then-current head
`146b04f1c8209be64168afb451ceee2c422da0cdced116f8d08beafe795c533c` with the same 14 unchanged
frozen artifacts and 28 readers. Only index `[9]` changes: the M06-T09
publisher-bundle-publication root reader is 63,859 bytes at
`sha256:ae7b688d904b4c77632fd78e0ee23b2264eae1574b4350306b5e2ec1b9974b8d`. A hosted
required-exhaustive attempt exposed two stale M07 successor/current-receipt assertions in that
reader; after the narrow reader-only correction, its focused root passes 112/112 and the frozen
M06-T09 artifact remains unchanged. This is reviewed local-reader evidence, does not claim hosted
CI success, and leaves the compatibility-reader debt with I07-04.

Reviewed checkpoint sequence 14 links the exact sequence 13 head
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
`[32]` (`sha256:08f143107430dde90cf1865c21d7ce1ec854897b0c1c4306b96525bdd0d18daa`) plus the 24,939-byte root
reader at `[33]` (`sha256:b97e7991e0ac20e7232112594228fdd829a536e81d16d06fd3f909e7e3a02492`).
Sequences 1–16 and all 16 predecessor artifact files remain byte-identical. This reviewed local
reader checkpoint makes no hosted M07-T08 claim. `DEBT-I07-015` assigns the temporary historical
recovery-reader bridges to I07-04 for removal by G07.

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

Reviewed checkpoint sequence 22 preserves sequence 21 as immutable history and links predecessor
head `ce12c066545e21779abf891898aaf0b09ceb1c0c1b51be382a0adabd5f86e939` to current head
`aef9881c8fc540873f889a09754e5f2c19adc3c19934ba0fcfcf5e6a12b2da9e`. It continues to
authenticate the same 18 frozen artifacts and 36 reader identities. Every frozen artifact byte is
unchanged; only workflow-dependent reader indexes `[8, 10, 11, 12, 14]` are resealed for I07-03.
This append is current-reader compatibility evidence, not a rewritten historical proof.

The contract preflight now executes a dependency-free one-test M07-T09 Vitest probe under the
production proof-step isolation. The shared launcher invokes the repository-local Vitest CLI with
`process.execPath`, writes owner-only package/workspace/config/test files only inside the step temp
root, preserves the scheduler-owned Node permission boundary, and performs unconditional cleanup.
This catches package-manager lookup, permission, and config-discovery regressions before ignored
build outputs exist. The full T09 verifier remains in the 146-workload exhaustive phase after its
build-producing prerequisites.

The T08 proof reader authenticates exact AST structures for both executable CI registrations and
shared-state mappings, then binds their effective flow with code-owned exact source receipts. It
uses the same exact-receipt rule for the direct 12-case runtime, 14-case compiler-negative, and
9-case root sources; all authority-file inputs cross bounded identity-safe reads.

### I07-02 required-exhaustive architecture and completed cutover

`exhaustive-workload-inventory.mjs` is now the neutral executable authority. It validates the
repository inputs and owns all 159 ids, labels, shell-free command/argument vectors, dependencies,
execution classes, and inert shared-state records without importing either scheduler. The retained
legacy sequential implementation is a rollback mirror. The rollback-only
`required-exhaustive-equivalence.mjs` adapter compares its exact ordered plan against the neutral
inventory, proves set equality and exactly-once ownership, and retains the reviewed plan digest.
It cannot turn either source into executable authority.

The equivalence adapter also normalizes terminal receipts. PASS requires all 159 exact workloads
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

All 159 workloads have one exact shared-state class:

| Execution class                  | Count | Scheduling rule                                      |
| -------------------------------- | ----: | ---------------------------------------------------- |
| `GLOBAL_EXCLUSIVE`               |     6 | Drained repository-wide barrier                      |
| `WORKSPACE_OUTPUT_EXCLUSIVE`     |     2 | Workspace and public-package output writers          |
| `PACKAGE_TEST_EXCLUSIVE`         |     1 | Drained complete package-test barrier                |
| `PROOF_READ_ONLY`                |    69 | No shared workspace writes                           |
| `PROOF_OS_TEMP_ISOLATED`         |    70 | Writes only to a workload-owned OS temp root         |
| `PROOF_TRACKED_ALIAS_EXCLUSIVE`  |    10 | Real tracked aliases under a drained scheduler       |
| `PROOF_WORKSPACE_TEMP_EXCLUSIVE` |     1 | Direct source-audit workspace-temp root-test barrier |

Sixty-four proof pairs may overlap pair-by-pair at concurrency two after their predecessors pass. A
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

The added `control-plane-runtime-staging` pair is ordinary and non-barrier. Its verifier is
`PROOF_READ_ONLY`; its root proof/mutation test is `PROOF_OS_TEMP_ISOLATED` and receives only the
ordinary `NODE_TEST_HARNESS` child policy. Neither workload receives workspace-write, port,
native-addon, or verifier runtime-probe authority.

The added `control-plane-runtime-activation` pair is ordinary and non-barrier. Both workloads are
`PROOF_OS_TEMP_ISOLATED`. The verifier receives the exact `VERIFIER_RUNTIME_PROBE` policy and the
root receives only `NODE_TEST_HARNESS`; both receive the narrow
`CONTROL_PLANE_RUNTIME_ACTIVATION_SQLITE` native-addon policy. Neither receives workspace-write or
port authority.

The added `control-plane-runtime-recovery` pair is ordinary and non-barrier. Both workloads are
`PROOF_OS_TEMP_ISOLATED`. The verifier receives the exact `VERIFIER_RUNTIME_PROBE` policy and the
root receives only `NODE_TEST_HARNESS`; both receive the separate narrow
`CONTROL_PLANE_RUNTIME_RECOVERY_SQLITE` native-addon policy. Neither receives workspace-write or
port authority.

The added `control-plane-runtime-fault-injection` pair is ordinary and non-barrier. Both workloads
are `PROOF_OS_TEMP_ISOLATED`. The verifier receives the bounded `VERIFIER_RUNTIME_PROBE` policy,
the root receives only `NODE_TEST_HARNESS`, and both receive the task-specific
`CONTROL_PLANE_RUNTIME_FAULT_INJECTION_SQLITE` native-addon policy. Neither receives
workspace-write or port authority.

The `control-plane-runtime-transition-races` pair is ordinary and non-barrier. Both workloads are
`PROOF_OS_TEMP_ISOLATED`; the verifier receives the bounded `VERIFIER_RUNTIME_PROBE` policy and
its task-specific SQLite native-addon policy. The root receives only `NODE_TEST_HARNESS` and no
native-addon authority. Neither receives workspace-write or port authority.

The `reference-host-web-channel-consumption` pair is ordinary and non-barrier. Both workloads are
`PROOF_OS_TEMP_ISOLATED`; the verifier alone receives the bounded runtime-probe, task-specific
SQLite, and authenticated loopback-child policies. Its root receives only `NODE_TEST_HARNESS`.
Neither receives workspace-write or a fixed/shared port grant.

The M08-T01 `editor-core-source-document` pair is ordinary and non-barrier after
`protocol-structural-validation`. Both workloads are `PROOF_OS_TEMP_ISOLATED` with separate
runner-owned roots. The verifier receives no child-runtime-probe grant, while the root receives only
the ordinary `NODE_TEST_HARNESS` policy. Neither receives workspace-write, port, or native-addon
authority. The separate serial `editor-core-public-package-contract` prefix owns its repeated
`dist` write and must close before the verifier.

The M08-T02 `editor-core-stable-id-insert` pair is also ordinary and non-barrier. Both workloads
are `PROOF_OS_TEMP_ISOLATED`, follow the same serial `editor-core-public-package-contract`
predecessor, and retain verifier-before-root ordering. Neither receives workspace-write, port, or
native-addon authority; only the root receives the ordinary `NODE_TEST_HARNESS` child policy.

The M08-T03 `editor-core-structural-edits` pair is ordinary and non-barrier. Both workloads are
`PROOF_OS_TEMP_ISOLATED`, follow `editor-core-stable-id-insert` plus the same serial public-package
predecessor, and retain verifier-before-root ordering. Neither receives workspace-write, port,
native-addon, or verifier runtime-probe authority; only the root receives the ordinary
`NODE_TEST_HARNESS` child policy. The pair verifies the exact 22,402-byte structural-edit artifact
at `sha256:0d44f67c316c21ff8b612221d01e81c76d3b24783164bb75a772985bbc7def8b`.

The M08-T04 `editor-core-content-edits` pair is ordinary and non-barrier. Both workloads are
`PROOF_OS_TEMP_ISOLATED`, follow the stable-ID and structural-edit prerequisites plus the serial
public-package predecessor, and retain verifier-before-root ordering. Neither receives
workspace-write, port, native-addon, or verifier runtime-probe authority; only the root receives
the ordinary `NODE_TEST_HARNESS` child policy. The pair verifies the exact 26,382-byte content-edit
artifact at `sha256:eb79a60f2454f8a15044abd920fc87b24b068b6b42088c39b5af2c7214594e34`.

Only these verifier proofs receive both runner-owned temp-write and child-runtime-probe authority:

- `publisher-catalog-pinning`;
- `publisher-bundle-publication`;
- `publisher-official-golden`;
- `publisher-invalid-source-matrix`;
- `control-plane-bundle-store`; and
- `control-plane-bundle-verification`; and
- `control-plane-local-api`; and
- `control-plane-runtime-activation`; and
- `control-plane-runtime-recovery`; and
- `control-plane-runtime-fault-injection`; and
- `control-plane-runtime-transition-races`; and
- `reference-host-web-channel-consumption`.

Native-addon authority is limited to the exact `reference-host-web-source-audit`
verifier/root-test pair, the `publisher-invalid-source-matrix` root test, and the exact
`control-plane-local-api`, `control-plane-runtime-activation`,
`control-plane-runtime-recovery`, and `control-plane-runtime-fault-injection` verifier/root-test
pairs plus only the `control-plane-runtime-transition-races` and
`reference-host-web-channel-consumption` verifiers. Both roots are denied native-addon authority.
The Publisher probe loads the reviewed Rolldown binding; the control-plane pairs load the locked
SQLite binding. The source-audit verifier
remains workspace-read-only; its root test owns the single exclusive workspace-temp exception.
Fastify 5.11.2 and better-sqlite3 13.0.3 are exact lockfile inputs, and the reviewed production
dependency audit reports no known vulnerability. That dependency statement remains local evidence;
M07-T05 and M07-T06 subsequently passed hosted CI. No hosted M07-T09 result is claimed here.

Every proof process gets a fresh, identity-checked temp root and generated Node permissions.
Direct workspace-write grants, child processes, and addons are absent unless the code-owned
workload record grants them. Inherited `NODE_OPTIONS` is rejected, and a mandatory preload denies
TCP and UDP listener binding. The runner authenticates temp identity again before cleanup.

Eighteen root-test records also own an orthogonal schema-v2 Node-permission compatibility policy:
141 workloads are `NONE`, two are `FIXTURE_COPY`, fifteen are `REVIEWED_SYMLINK`, and one is
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
- a bounded digest of every non-ignored untracked entry around the full 146-step region; and
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

### I07-03 shadow-affected observation

At the I07-03 checkpoint, a separate pull-request-only `SHADOW + AFFECTED` job was added. The exact
`run-required-exhaustive-quality-gate.mjs` command remains unchanged as the sole pass/fail
authority; the observer cannot make CI pass or suppress required work.

The selector authenticates the same-repository revision boundary, complete exact tracked-path
ownership, and affected dependency closure. Unknown paths, statuses, modes, owners, bases, or
edges—and every ambiguous, untrusted, policy, dependency, frozen-input, incomplete-diff, or
unsupported condition—expand to `EXHAUSTIVE`. A strict subset is only a plan: every selected
workload executes from fresh inputs under the real isolation and closing guards. Cached build,
test, mutation, checkpoint, or proof success remains forbidden.

Only an opaque receipt minted by the real Git boundary may authorize selection. A composite digest
binds the exact boundary, selector, impact, ownership, threshold, shadow-runner, required-oracle,
workflow, and toolchain sources across observations. Its frozen selector digest is
`sha256:20a78069ed829649ab9198cad68b5d7fede22dc3b6ec391ed84f5dd1f0afa86f` across 20 exact
comparison-authority sources. Multi-proof execution validates every pair, and the explicit
selected-root suffix barrier cannot treat an absent exhaustive root as completed.

At that checkpoint, promotion was reserved for I07-04 after every selector category was mutation-covered, false
negatives remain zero, and at least 20 consecutive eligible same-revision hosted strict-subset
affected/exhaustive comparisons agreed. Observation started at `0 / 20`, promotion was false, and
I07-04 was `NOT_STARTED`. Fresh `EXHAUSTIVE` execution remained mandatory on `main` and manual
audits, including the release process routed through those authorities. The hosted bootstrap passed the authoritative Quality gate. Its
shadow result was `NOT_ELIGIBLE` → `EXHAUSTIVE` for `UNSUPPORTED_CHANGE_KIND`, so it was not an
eligible strict-subset comparison and the observation count remained `0 / 20` then. The exact hosted
run/job/revision/receipt identifiers are pinned by the
[`i07-03-affected-selector-shadow.json`](../proof/baselines/i07-03-affected-selector-shadow.json)
baseline. Focused local contracts passed 91/91 and all CI infrastructure tests passed 203/203. At
that historical checkpoint, the full local gate was `BLOCKED_BY_LOCAL_SANDBOX` because loopback
`listen` returned `EPERM` in two pre-existing TCP lifecycle tests; this was not a product
regression, and the hosted Quality gate was authoritative. The pure I07-03 ledger cannot
authenticate hosted provenance or grant promotion
even when supplied records satisfy 20/20; I07-04 must pin an exact GitHub
run/job/revision/receipt review authority. `DEBT-I07-017` assigns the shadow-only job, wrapper, and
test wiring to I07-04 for removal by G07.

I07-04 has now satisfied that separate requirement: 20 consecutive hosted comparisons are
authenticated with zero false negatives in
`docs/proof/baselines/i07-04-affected-selector-promotion.json`. The required dispatcher admits
affected execution only for one exact same-repository pull-request boundary and one verified
promotion receipt. Any path-set, ownership, policy, provenance, or diff uncertainty produces
`NOT_ELIGIBLE` and exactly one fresh exhaustive fallback. `main` and manual execution, including
the release process routed through those authorities,
remain unconditionally fresh exhaustive. [Cleanup PR #36](https://github.com/desenlab/desen-app/pull/36)
passed fresh `REQUIRED + EXHAUSTIVE` in
[run 31674300000, job 94365383803](https://github.com/desenlab/desen-app/actions/runs/31674300000/job/94365383803),
and its landed `main` revision `6d87889bc088e45e219f430ee67e10c901c1a2fb` passed again in
[run 31675234655, job 94368259305](https://github.com/desenlab/desen-app/actions/runs/31675234655/job/94368259305).
The one-file [canary PR #37](https://github.com/desenlab/desen-app/pull/37) passed fresh
`REQUIRED + AFFECTED` in 3m54s in
[run 31676049922, job 94370743935](https://github.com/desenlab/desen-app/actions/runs/31676049922/job/94370743935):
10 selected workloads, one proof unit, 10 observed closes, `strictSubset: true`,
`freshExecution: true`, and `cachedSuccessRead: false`.

I07-02's completed promotion closed `DEBT-I07-008` by removing its temporary shadow workflow and
modular comparison adapter/test. I07-04 closed all 17 G07-due bridge entries and completed G07.
Historical closure checkpoint sequence 28 head
`2577962251a9e6fa86993bd0e8bda1ed901f850a3b93678486c0445aed035546` authenticates 25 frozen
artifacts and 50 readers. Historical sequence 30 remains pinned at
`f5598749a14e7d5eed27cb07e92a83f2bec28b5404f4480600e687d960f04970`. Historical sequence 31 is
`181d5a1e0c012f53cfe02640c2f8d0ddf1e300090a3c3742882bb3722175e42d`. The current append-only
successor is sequence 32 at
`ef02e9a20725159352950131c8e9a575a7b4185a55968fd1ec22f42a85571aee`, authenticating 29 frozen
artifacts and 58 current readers. The exact 26,382-byte M08-T04 artifact is
`docs/proof/artifacts/editor-core-0.1.0-content-edits.json` at
`sha256:eb79a60f2454f8a15044abd920fc87b24b068b6b42088c39b5af2c7214594e34`; its reviewed report is
`docs/proof/EDITOR-CORE-CONTENT-EDITS.md`. These are local code-owned/current receipts and make no
hosted M08-T04 claim. Implementation progress is 89/145, M08 is 4/10, proof gates remain 8/13,
`N-014` is `TESTED`, `S-002` remains `PLANNED`, no `P-*`, `N-*`, `S-*`, or proof-gate status
changes, and M08-T05 is next.
`DEBT-I07-007` keeps the sequential runner, rollback-only equivalence adapter, and other rollback
references under I07-05 until their exact machine-checked removal conditions in
`docs/plan/DEBT-REGISTER.md` are satisfied.
