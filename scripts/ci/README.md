# Proof infrastructure

This directory contains the I07 proof-execution authority. I07-02 completed the exhaustive hosted
cutover, and I07-04 completed required affected promotion: the official `Quality gate` now uses the
required dispatcher defined here. An authenticated eligible same-repository pull request may run
fresh affected scope; every unsafe boundary, plus `main`, release, and manual audit, remains fresh
exhaustive. The CI-01 sequential runner remains available only through explicit manual rollback.

CI-02 adds only a per-task completion policy. Its exact bounded local baseline is documented in
`AGENTS.md` and is non-authoritative; the exact task-specific verifier and focused
positive/relevant negative tests remain mandatory. Merge or a completion report additionally
requires the hosted `Quality gate` to pass on the exact current pull-request head, and a later
commit invalidates that result. Checkpoints and seals authenticate identity and impact, never
cached success, so every selected hosted workload remains fresh. CI-02 adds no local affected
selector, changes no hosted dispatcher or workflow, and leaves I07-05 plus the manual legacy
rollback path unchanged.

## Trust layers

1. Frozen task artifacts preserve the exact task-time claim and nonclaim boundary.
2. `proof-reader-checkpoints.json` records reviewed live reader hardening without rewriting those
   artifacts.
3. `exhaustive-workload-inventory.mjs` is the neutral, code-owned authority for the live exact
   196-node, 93-proof-unit workload graph. It owns exact commands, arguments, dependencies, execution
   classes, and inert shared-state metadata without importing either scheduler.
4. The retained legacy sequential runner is a manual rollback mirror, not the source of the new
   graph.
   `required-exhaustive-equivalence.mjs` compares every id, label, command, and argument vector in
   order, proves set equality and exactly-once ownership, and normalizes fail-closed terminal
   receipts.
5. `infrastructure-debt.json` gives every temporary migration structure a machine-checked removal
   owner, deadline, and scoped zero-reference rule.

The checkpoint is inert data. It cannot name an executable command or cause a verifier or test to
run. Executable ownership remains in reviewed source. The neutral inventory is also inert until a
validated scheduler executes its exact shell-free command vectors.

M07-T02 appends reviewed checkpoint sequence 3 with head
`f92e879b3a72e75abb07af2b2bcfded62e014b99aa0cbe69c64aee12d5379882`, nine frozen artifacts, and
eighteen live readers. M07-T03 appends historical sequence 4; its head
`ee2d72c3529d9295945d339fb214c41dbbf906ffa6613a7ad6e766ec79c1bcf5` authenticates ten frozen
artifacts and twenty live readers while every earlier checkpoint byte and hash remains unchanged.
A corrective M05-T04 current-reader append after M07-T03 established historical sequence 5; its
head `7df3631d509ed7e65c571566a825d6d3cd52d336e1a74512bf3e8e26920749b3` authenticates eleven frozen
artifacts and twenty-two live readers. Sequence 6 only advances the M06-T11 proof/test receipts for
a bounded, explicit 20-second nested Vitest timeout; its then-current head
`790ad28b6fd441e6d5f40f277a97e8de36a178a9e50fff3e208e6c27588915fd` still authenticates eleven
frozen artifacts and twenty-two live readers. It changes no coverage, assertion, concurrency,
frozen evidence, workload/proof count, progress, or plan digest, and sequences 1–5 remain byte- and
hash-unchanged.

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
local-reader checkpoint and does not claim a new hosted CI pass.

Reviewed sequences 8–11 preserve fourteen frozen artifacts and twenty-eight live readers while
appending narrowly scoped M07-T05 compatibility-reader successors. Their then-current heads are,
in order, `f707fb4c3338aeda79eb6242b645b5e864ce54b1e3955373e8edebcd7e026b8a`,
`94f48160552a6e0de702f71200e56c23d61bab8692d43f3ac1104dcfa681568b`,
`bd3f5b90656f0e41d7f6aa439fdc01889e9ebeada26cd3caf8624c3ce1db7d07`, and
`63b8af4da431f0918c7ea9480564750bd12057af2bc83c294d962113ce7c9be8`. Sequence 8 adds the
41,945-byte M07-T05 artifact
`sha256:144e8a46b3b41a1f98a022bf4c16dddb9d7415af4e5033322484d4bdd49c55b9`; sequences 9–11 change
only reviewed live-reader receipts. Every predecessor checkpoint and frozen artifact remains
unchanged, and none of these local-reader appends claims a new hosted CI result.

Reviewed sequence 12 links exact sequence 11 head
`63b8af4da431f0918c7ea9480564750bd12057af2bc83c294d962113ce7c9be8` to its then-current head
`85c49a0d79346bf2ea92b716f6b43c5d95d164209e3d67af34871a334686e10e`. It authenticates the same
fourteen frozen artifacts and twenty-eight live readers. Only indexes `[26, 27]` change: the
M07-T05 proof reader is 77,507 bytes at
`sha256:e2050408c5bf3e084eacd6e42880310dafbfdf03b79821500cc0567b998f7d66`, and its root reader is
17,716 bytes at `sha256:061b40ea20e0f7ee362f26bd54db954c3caea338df5e2f090ce34a4618ac37cc`.
This successor authenticates the exact ADR token-bound documentation update while every frozen
artifact remains unchanged. It is reviewed local-reader evidence and makes no new hosted CI claim.

Reviewed sequence 13 links exact sequence 12 head
`85c49a0d79346bf2ea92b716f6b43c5d95d164209e3d67af34871a334686e10e` to its then-current head
`146b04f1c8209be64168afb451ceee2c422da0cdced116f8d08beafe795c533c`. It authenticates the same
fourteen frozen artifacts and twenty-eight live readers. Only index `[9]` changes: the M06-T09
publisher-bundle-publication root reader is 63,859 bytes at
`sha256:ae7b688d904b4c77632fd78e0ee23b2264eae1574b4350306b5e2ec1b9974b8d`. A hosted
required-exhaustive attempt exposed two stale M07 successor/current-receipt assertions in that
reader; after the narrow reader-only correction, its focused root passes 112/112 and the frozen
M06-T09 artifact remains unchanged. This is reviewed local-reader evidence, does not claim hosted
CI success, and leaves the compatibility-reader debt with I07-04.

Reviewed sequence 14 links exact sequence 13 head
`146b04f1c8209be64168afb451ceee2c422da0cdced116f8d08beafe795c533c` to current head
`3d2dd7a48ee2573d14fb1dbea18ef8b4e3498c6a26f82d76ea589dba3c821078`. It authenticates the same
fourteen frozen artifacts and twenty-eight live readers. Only indexes `[10, 11, 14]` change: the
M06-T11 proof reader is 166,563 bytes at
`sha256:06eb59602a768c13f19cc83289a574823d191aa3b62ed8fb7149381b326de802`, its root reader is
60,572 bytes at `sha256:29b407c2f7f1b17d17bff450185a9304c3186caea4a98973df3f1e3e4f684531`,
and the M07-T01 proof reader is 99,672 bytes at
`sha256:888d5e81bda7ca2cdcc58bb063d49409cad5f5d73bdd9baaa16dc199e566e5c6`. This narrow CI-reader
successor changes no frozen artifact. Subsequent M07-T05 pull-request and `main`
required-exhaustive runs passed in hosted CI; sequence 14 itself remains local-reader evidence, and
I07-04 still owns the compatibility-reader debt.

Reviewed sequence 15 links exact sequence 14 head
`3d2dd7a48ee2573d14fb1dbea18ef8b4e3498c6a26f82d76ea589dba3c821078` to current head
`b75a2580d1d6820392aa74ba5b7671b01baed1740fe2097c2a78e24663b5e4d5`. It authenticates 15 frozen
artifacts and 30 live readers, appends the 47,622-byte M07-T06 artifact
`sha256:d025da5329d5b56b9b46e7292a08883386a151add5e419edf2a9345425319494`, reseals reader indexes
`[0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 14, 15, 16, 17, 18, 19, 22, 23, 26, 27]`, and appends T06
readers `[28, 29]`. Sequences 1–14 remain unchanged. Reader index 14 is the final 105,203-byte
M07-T01 proof reader at
`sha256:fda6c679ce74201a90483f36d26702f5478bc67561ea632315541d542697f80b`; index 15 is the final
27,154-byte M07-T01 root reader at
`sha256:ab25e94ed1880b79dfb22f98a3da67fa5b777fdfaa86b3f02739bed6af29a45c`. Predecessor artifact
bytes remain unchanged. This is reviewed local-reader evidence and claims no hosted M07-T06
result. `DEBT-I07-009` and `DEBT-I07-013` register the temporary compatibility-reader bridges under
I07-04 for removal by G07.

Reviewed sequence 16 links exact sequence 15 head
`b75a2580d1d6820392aa74ba5b7671b01baed1740fe2097c2a78e24663b5e4d5` to current head
`f9e77791148c7f89e586b6eb8964338185a35c11900b69262a159002af0838cd`. It authenticates 16 frozen
artifacts and 32 live readers, appends the 49,892-byte M07-T07 artifact
`sha256:3129a8e40c837a1c49d7fe206de794e0f7f7e130dc7e5e90a012b9e38bf07334`, reseals reader indexes
`[0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 14, 15, 16, 17, 18, 19, 22, 23, 26, 27, 28, 29, 30, 31]`,
and appends T07 readers `[30, 31]`. Sequences 1–15 and predecessor artifact bytes remain unchanged.
This is reviewed local-reader evidence and claims no hosted M07-T07 result. `DEBT-I07-014`
registers the temporary activation-reader bridges under I07-04 for removal by G07.

Reviewed sequence 17 links exact sequence 16 head
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

Reviewed checkpoint sequence 22 preserves sequence 21 and links predecessor head
`ce12c066545e21779abf891898aaf0b09ceb1c0c1b51be382a0adabd5f86e939` to current head
`aef9881c8fc540873f889a09754e5f2c19adc3c19934ba0fcfcf5e6a12b2da9e`. It still authenticates
18 frozen artifacts and 36 reader identities. Every frozen artifact byte is unchanged; only
workflow-dependent reader indexes `[8, 10, 11, 12, 14]` are resealed for I07-03.

The CI contract batch runs a dependency-free one-test M07-T09 Vitest probe through the exact proof
isolation before exhaustive scheduling. The shared launcher uses the current Node executable plus
the repository-local Vitest entrypoint and owner-only package/workspace/config/test files under the
step temp root; it never depends on Corepack, a package-manager shim, `PATH` lookup, or ignored
`dist` output. The inherited permission boundary remains in force, cross-file/cache parallelism is
disabled, and cleanup is unconditional. The full T09 verifier remains an exhaustive workload after
its build-producing dependencies.

The M07-T10 verifier similarly launches the complete transition/race suite with the current Node
executable and repository-local Vitest entrypoint under an owner-only OS-temp config. It disables
cache and file parallelism, fixes one worker, bounds JSON output and execution time, removes
inherited `NODE_PATH`, redacts failures to code-owned identities and size/digest metadata, and
cleans up in `finally`. The full verifier remains an exhaustive workload after its build-producing
dependencies; no package-manager or `PATH`-resolved launcher becomes proof authority.

The final T08 reader validates exact AST structures for executable CI registrations, shared-state
mappings, and direct 12-runtime/14-type/9-root test inventories. Code-owned exact source receipts
bind those structures to their executable bodies and effective flow; bounded identity-safe reads
guard every authority-file input.

## Historical I07-01 checkpoint

I07-01 is the historical `SHADOW + EXHAUSTIVE` checkpoint. Every one of the retained plan's global
steps and proof verifier/root-test pairs ran from fresh inputs. Candidate proof pairs could run
with concurrency two while the sequential result remained authoritative; no changed-file filter,
cached proof success, generator, or evidence writer was admitted. Its removed comparison wrapper
is authenticated by the I07-01 and I07-02 baselines; it is no longer a current command surface.

## I07-02 required-exhaustive architecture

```bash
node --test scripts/ci/test/exhaustive-workload-inventory.test.mjs
node --test scripts/ci/test/exhaustive-gate-boundary.test.mjs
node --test scripts/ci/test/shared-state-authority.test.mjs
node --test scripts/ci/test/required-exhaustive-equivalence.test.mjs
node --test scripts/ci/test/required-exhaustive-quality-gate.test.mjs
node scripts/ci/run-required-exhaustive-quality-gate.mjs
```

The I07-02 authorities establish a single `EXHAUSTIVE` target whose plan factory defaults to
`REQUIRED`; `SHADOW` must be explicit and any other scope fails closed. The official hosted
workflow invokes this exact command without an authority override, so the fail-closed default is
the repository pass/fail authority. The retained sequential workflow is available only through
manual `legacy-rollback`. The temporary shadow workflow and comparison adapter/test were removed
after the accepted same-revision comparison and successful hosted cutover.

The archived I07-02 baseline remains the immutable 130-workload/61-proof cutover receipt. The live
authority is an append-only successor: M07-T02 through M07-T10 each add one verifier/root-test pair
without rewriting that historical baseline. The preceding M07-T05 receipt contained 138 workloads,
65 proof pairs, 423 prerequisite segments, 2,209 ordered leaf invocations, and 215 distinct leaf
workloads. Its inventory was
`sha256:d26e9fa74f85be06852cd4f667467606735687e851ab03a6ef5611700c9ccc92`, and its required plan was
`sha256:4d26089fc10902513950f0051fb0d860a82c14374e426fd40b3259a43a63b466`. The M07-T11 predecessor
contained 150 workloads and 71 proof pairs. The historical M08-T01 successor contained 153
workloads and 72 proof pairs, the historical M08-T02 successor contained 155 workloads and 73 proof
pairs, the historical M08-T03 successor contained 157 workloads and 74 proof pairs, and the
historical M08-T04 successor contained 159 workloads and 75 proof pairs. The historical M08-T05
successor contained 161 workloads, 76 proof pairs, 529 prerequisite segments, 3,293 ordered leaf
invocations, and 254 distinct leaf workloads. Its prerequisite, ordered-leaf, distinct-leaf,
retained-plan, neutral-inventory, workload-set, ordered-projection, required-plan, and shadow-plan
digests were respectively
`sha256:fefcdb176405d3dc66930f01b8b6586e00b5a81ab271add0e5f8aac20ce39a75`,
`sha256:24d534858d325d5a0799c45c0adb9872cb54167adf92a2244ab798a49b57c25e`,
`sha256:c7754b1ca350563560e508916af68882da43bf7c85d27f05648cdaa4a4f47ffd`,
`sha256:74e8fef5c4e998856b3a3027a4fc976c5a96a087c26c6a6e9088442fa633549a`,
`sha256:ae790f14c376a1fb449e34877a08abba164677ef413583248e5f609f3c7bb292`,
`sha256:17630eafb4fb762edde445422935f790cbf89af115a2cae72b3d78a9fa8225e4`,
`sha256:9cce0949084c83c6447da139ab423bc1189a867d0c83f7a10f9a261f6d814faf`,
`sha256:9f7ef05e606afb293b42c650acfcf043d638cd429e07fdee55d01d241f06bf1b`, and
`sha256:5659be49a219445ee559b614ffbcea58d50fe287b954ff2e5f4cdc038519f3ae`. Its selector-only impact
graph was `sha256:9fb786d80ac21bef4dc89c9a77986f91dd50c9ff53dd2d54c7a52d5c4ac8738f`; affected ownership
covered 1,071 paths at `sha256:ae070076003f9ae641a6682aab6280336b7d2ccf6ccd6b96d15b3c10c6cd6c18`, including 152
proof-owned paths, with projection
`sha256:d793913bca281e2127151c83ce570ce415c995da42013226731d030b337fc2c0`.
The historical M08-T07 append-only successor contained 165 workloads and 78 proof pairs. Its
legacy prerequisite, ordered-leaf, distinct-leaf, retained-plan, neutral-inventory, workload-set,
ordered-projection, impact-graph, required-plan, and shadow-plan pins were respectively
`sha256:cff21c5dd6e483906cb70a86fe475cf5df913b8721de199dac2e16135905c98e`,
`sha256:a05490316408114e99a790018bedbfcb8783286883ddbdd47376251273cf0425`,
`sha256:302317ed31512f705377338d780dcc5dd352c81cde37f6ff06f91f0db32693fd`,
`sha256:c6cf645412661a81e2976e88080d23d6fe0fa4889ef4b07432e4a47de684e25d`,
`sha256:8220259aa2a44774d192ea2420f4c2f8423c9dedd93a1fcf9b34340a0ab0dcd3`,
`sha256:9ea3b95ab6f034473765beb9edb1482532bb1a0b4e05f630c403d38d8df0daef`,
`sha256:fc588358d8fa3b2e7c2cd9f3a280715d7db34089a41a2fae2c3484d18c040278`,
`sha256:5aa20b4fb87decc51221bca5a900677d7dfddd1e61c068d5e91420253a3236b2`,
`sha256:5484324b6d22a5e58bce2431f35382aeeb4e97095c96524e5bdb6211f8650a9e`, and
`sha256:4beeca9ed27e2e7942951cf0cf014fb7bebca2bcf2f8f69ff0819580aeff3c87`.
Its 1,088-path ownership, 156-proof-path projection, selector, required-runner, and workspace-script
pins were `sha256:227cb892270c669646eec89a44243af8e3da5a51bfec8f8e560e2d765c0f2e79`,
`sha256:d43335b91aa9f3da0571ed2e32e92ea65da81bbcc5efee1aa32bdac30967217d`,
`sha256:cbd1cce71828ad4ad1c22ede5e6152e5e3130031afebcb1d9c23e32ba55eb7dc`,
`sha256:9da49a38efa09a48ded3290ba9c2ec4ae57a967d325e61320f39be561b93f9a4`, and
`sha256:0faa6116c99d11f6d059a224de6b08a723657b5c5690a3138e6290d240524820`.
Those pins remain historical local authority and make no hosted M08-T07 claim.

The historical M08-T08 successor contained 168 workloads and 79 proof pairs. Its frozen local
receipts remain append-only and make no hosted M08-T08 claim.

The historical M08-T10 successor contained 172 workloads and 81 proof pairs. The M09-T01
successor contains 174 workloads and 82 proof pairs. Its legacy projection contains 601 prerequisite
segments, 4,369 ordered leaf invocations, and 278 distinct
leaves. Its neutral inventory is
`sha256:d4f4493585c1a62a25e01917946bb3d562c3da43ac4ca77a571a00cfebe49859`, and its required plan is
`sha256:cfe691545a5c122e0afb81fe06abcb7c4abdb26d8c3ea35a5c8dfc787769c4aa`. These reviewed local
pins make no required-gate or hosted M09-T01 claim.

The historical M09-T02 successor contained 176 workloads and 83 proof pairs. The historical M09-T03
successor contained 178 workloads and 84 proof pairs. Its legacy projection contains 621 prerequisite
segments, 4,393 ordered leaf invocations, and 284 distinct leaves, pinned at
`sha256:8e1f08ea689d33520b7dd905bc124a3dcb842abf5e40873da254013d9fb2ccbd`,
`sha256:bcb1a99cd6832975955719a794c8c44a154d97f3e784ce9a5775502bfba210e2`, and
`sha256:b5a85ab89e327e828b8ebb5aa2c85b008596eae5e4bfa284d255548de76a53af`. These reviewed local
pins make no required-gate or hosted M09-T03 claim.

The historical M09-T04 successor contains 180 workloads and 85 proof pairs. Its legacy projection
contains 629 prerequisite segments, 4,403 ordered leaf invocations, and 287 distinct leaves, pinned
at `sha256:f0e4f63cbc05222ba64d407206d3c492586b3870f368c28f611af03d1f67e374`,
`sha256:6460c20463ae01924f574a9c01e1515a1446b853bc9cc91205283ce90b715d42`, and
`sha256:b9047beffe348a9bd93d8d089b93b054298a17602e491be8b0c1f837d2930a1b`. These reviewed local
pins make no required-gate or hosted M09-T04 claim.

The historical M09-T05 successor contained 182 workloads and 86 proof pairs. Its legacy projection
contains 641 prerequisite segments, 4,417 ordered leaf invocations, and 290 distinct leaves, pinned
at `sha256:6246c4865e28a737e5990a7204dedaad6cae3e6c989a70a6cd496c84c29d0764`,
`sha256:de50c6186438de2dbd56083de01bc7f39f6492c1d02806a8fc239e6a4edc341d`, and
`sha256:0dfd1eb4210839d739572a943f421026ca40aecc4f285832148f66d242f9970c`. These reviewed local
pins make no required-gate or hosted M09-T05 claim.

The historical M09-T06 successor contains 184 workloads and 87 proof pairs. Its legacy projection
contains 649 prerequisite segments, 4,427 ordered leaf invocations, and 293 distinct leaves, pinned
at `sha256:c9f90ee01326cd470d7f3f55518076334070dc29bbeb6282fa635a685584ab00`,
`sha256:e2f99d148a89ac2eb2d61014141519f5e00d435cf25f2dab8a92af42ac0cd853`, and
`sha256:e1d58f02e373a4f7f99c923d63b54f9027ee5908d567667e41f1b1be3310c1b4`. These reviewed local
pins make no required-gate or hosted M09-T06 claim.

The historical M09-T07 successor contained 186 workloads and 88 proof pairs. Its legacy projection
contained 657 prerequisite segments, 4,437 ordered leaf invocations, and 296 distinct leaves,
pinned at `sha256:0ca9fcc3176df5b6707e2b704d0e3aa4dd4288bc3b7f813461d90ef3397c5d80`,
`sha256:d4cea0955703f00540994ecdaac6d5cdca4f9f1bb3037c7ba038da67d9991e7a`, and
`sha256:ddc6aa4a631dd92edb762c52d06277eec262b89f5e062e9c199a3c15f423304f`. These historical reviewed
local pins make no required-gate or hosted M09-T07 claim.

The historical M09-T08 successor contained 188 workloads and 89 proof pairs. Its legacy projection
contains 669 prerequisite segments, 4,451 ordered leaf invocations, and 299 distinct leaves,
pinned at `sha256:27dc2ee009837434a8d16c5bddebca8d693f1133f8214aa870f94cf482467073`,
`sha256:f75015245b76738433e188edc5171f4fdc22d8a91cfd0bc266f485e42caa1ba5`, and
`sha256:7460545faa6ff0ab3eb46f1631abaaeab8645d7bdd3bfe42fd381256a7848de6`. These historical reviewed local
pins make no required-gate or hosted M09-T08 claim.

The historical M09-T09 successor contained 190 workloads and 90 proof pairs. Its legacy projection
contains 679 prerequisite segments, 4,463 ordered leaf invocations, and 302 distinct leaves,
pinned at `sha256:181d43e958b7eb52c864f72078672a6e73a12bbca1bc07ccfbca82f0bcebee71`,
`sha256:2945c487cb33f055eefe72d859f1b907560a5861e170690ccb98cbebc351b4c4`, and
`sha256:42d43078f6ea3d2d5d5d571c0ef2097d61f6a65dc7a9c03ed9eab8515f1565a3`. These reviewed local
pins make no required-gate or hosted M09-T09 claim.

The historical M09-T10 successor contains 192 workloads and 91 proof pairs. Its legacy projection
contains 691 prerequisite segments, 4,477 ordered leaf invocations, and 305 distinct leaves,
pinned at `sha256:ec52c27dbc9ea1db400cae2fa1ec7ab7b58b468eb83ee396ea7c082107fc06cb`,
`sha256:f167a05bbac9b7959ed6f179e2adacef3382d21a6e6056c568aeddab891a58ec`, and
`sha256:a91f9e647b3a4bfcd8a45e2fe473b0c86a7acd2edc450897eab851e2dca47fc5`. These reviewed local
pins make no required-gate or hosted M09-T10 claim.

The historical M09-T11 successor contained 194 workloads and 92 proof pairs—81 ordinary and 11
barriers. The current M09-T12 successor contains 196 workloads and 93 proof pairs—82 ordinary and
11 barriers. Its exact legacy projection and normalized plan remain machine-generated code-owned
authority and are not inferred from those totals. These reviewed local pins make no required-gate
or hosted M09-T12 claim.

The pre-promotion M07-T11 shadow-selector comparison authority was
`sha256:ee0cda5b4871ce2e169a958eefd60299197dbf261c0163335cd759e814067dbf`.
The frozen I07-03 baseline remains historical. I07-04 has independently authenticated `20 / 20`
eligible hosted comparisons with zero false negatives; promotion and hosted cutover are complete.
The I07-04 baseline remains byte-identical and historical. Its verifier authenticates that frozen
promotion receipt first. The exact M08-T10 comparison digest
`sha256:8dc47b6160cbe8e27fc66b2462f27582385a196f2cb839c7184a86562040aafb` remains historical;
the M09-T01–M09-T11 successors also remain historical, while the M09-T12 comparison and
promotion-compatibility receipts are machine-verified by their live checks.
The historical M08-T05 comparison digest remains
`sha256:41b08d79888fbf3f79f7358ddd02af3bf17d677e9b37c94d58b06d267ad4ced2`.

The historical reviewed T07 digest set retained from its local task-proof checkpoint is:

- prerequisite inventory:
  `0ca9fcc3176df5b6707e2b704d0e3aa4dd4288bc3b7f813461d90ef3397c5d80`;
- ordered legacy leaves:
  `d4cea0955703f00540994ecdaac6d5cdca4f9f1bb3037c7ba038da67d9991e7a`;
- distinct leaf workloads:
  `ddc6aa4a631dd92edb762c52d06277eec262b89f5e062e9c199a3c15f423304f`;
- 16 workspace test scripts:
  `4d7c4232cc0e31519f2f58e9ebeb355405e493594406aee99ed2a78ce0c796ab`;
- retained sequential plan:
  `fc2320e67fab4582f8eb4deead2e7048cd207577c965931440a83daeefb9de79`;
- neutral inventory:
  `67e537ed19f3518561909a342fa79e06d0f9adc49436aaf6c9816be1c840cb6f`;
- workload-id set:
  `2ec8ce76c133230f1f16464ec2c46fff616e0179d480aa601decf34adeb7f4aa`;
- ordered equivalence projection:
  `43cfaf9c54b29a56d2111267cbc923ff5488d3ef2a1112e0cc0aca2990e9feba`;
- selector-only impact graph:
  `905d22e40524d26eac056ca32236f0948910a7ac6049b0d35c644f19e629d668`;
- M09-T07 connected closure:
  55 proof units and 120 workloads at
  `6a7cb544efd2906ccd09db03209c54888a25f366b080b5cf37b87c43edc2651c`;
- affected ownership:
  1,192 paths at `b9e2f0069bb8d0eba4738749245cc309d08cefff5ffe6ca18bd3356fcaa5e3e5`, with
  176 proof-owned reader paths and projection
  `3561ac8305b7b34cfef0975abe5899aa54e637a4747ac0fa76bd39a129ce9f03`;
- ownership categories (`PROOF_UNIT`, `CI_POLICY`, `DEPENDENCY_POLICY`, `FROZEN_INPUT`,
  `PACKAGE_OR_APPLICATION`, `SHARED_PROOF_INFRASTRUCTURE`, `PROJECT_DOCUMENTATION`,
  `REPOSITORY_POLICY`): `176 / 45 / 31 / 132 / 460 / 213 / 124 / 11`;
- required plan:
  `00c0fbb14b15bf898872ba09b61c9a3d8995f60f42cf1bf894a0acb096dc2490`;
- shadow plan:
  `952fd6519a0746c0849716fad300badaa84f2bf5fe4914f97662546cd5a122dc`;
- historical T07 selector authority:
  `5301aedd0f4e7fe44bb07f67d6dd0dfaeea08cbc7ecd431ddf619345805656d0`;
- historical T07 required-runner authority:
  `7b660497db1d82411a1e6c223d9225c5608ceb1cf25daddc9cc84de49661b559`, independently reviewed
  rather than inferred from selector success;
- historical T07 frozen promotion selection equivalence and observation threshold:
  `97cc1b29553f1bf3d92386e399c76f2f9c21e73a1c8073a15a9465f7c4fcf698` and
  `ca6ee4128f2dbc581d033ebabe8e437268c8f7c5b29d6fbc7f9e3fb031b6c23c`;
- historical sequence-46 proof-reader checkpoint:
  `f09ec643d1b2756174ca47fae99837a68f6656bec0c6933e566d5075713a0f5f` across 42 artifacts and
  84 then-current readers; and
- historical T07 promotion artifact:
  `76a29908843c0bb9a4ca5ad74b5bc94383c3fa21463ce81e98bf53e8f01d7549`.

The historical reviewed T08 digest set available at its local task-proof checkpoint is:

- prerequisite inventory:
  `27dc2ee009837434a8d16c5bddebca8d693f1133f8214aa870f94cf482467073`;
- ordered legacy leaves:
  `f75015245b76738433e188edc5171f4fdc22d8a91cfd0bc266f485e42caa1ba5`;
- distinct leaf workloads:
  `7460545faa6ff0ab3eb46f1631abaaeab8645d7bdd3bfe42fd381256a7848de6`;
- retained sequential plan:
  `cdb0d2b50441bc7f94ad2794c4af88807a87dbef7f886d6dfc6c3414ff29e2b8`;
- neutral inventory:
  `30692cd0f41c54e8c35b219d6aaebdb01c0ede62300ea0cd4ec4ac1d98c08775`;
- workload-id set:
  `5a8af85a59c74762971f81ffcbb4253f7d769d9251a34fc7c30da8f8fded916d`;
- ordered equivalence projection:
  `6c6e83e3f5739842804021666d41d9357c1e9e2292a1b5e732452f6c2c2e502b`;
- selector-only impact graph:
  `d18c797bbdf4905dd7bf0973faf620f972b2c6958fd4797121a9a0503bb66d49`;
- M09-T08 connected closure:
  56 proof units and 122 workloads at
  `b4eff1232ccf34756c0336a868785fb457a2195338e75363a2a14ecae14d3427`;
- affected ownership:
  1,202 paths at `8f3869cb6827d737af60c1ae08b0ecc16d268cbd76852ae3dba93b5af0210332`, with
  178 proof-owned reader paths and projection
  `7ab655b9dfacd9500ca5a6c0166e6ad971fa38ec44957076956db965c40f303e`;
- ownership categories (`PROOF_UNIT`, `CI_POLICY`, `DEPENDENCY_POLICY`, `FROZEN_INPUT`,
  `PACKAGE_OR_APPLICATION`, `SHARED_PROOF_INFRASTRUCTURE`, `PROJECT_DOCUMENTATION`,
  `REPOSITORY_POLICY`): `178 / 45 / 31 / 133 / 464 / 215 / 125 / 11`;
- required plan:
  `86af002c1fc656c397a36e6aae2aae5d99ea30a43ec3d0742053a9ae14ca8d98`;
- shadow plan:
  `e4f13684f3c26f60bd7f5564a32ef4fc4654d098a04f39e4fdd98b6dd32582a7`;
- current selector and required-runner authorities: machine-verified by the live M09-T08 checks;
  no exact digest is asserted here because this task-local reviewed list does not supply one; and
- sequence-47 proof-reader checkpoint:
  `c28ba9a9f274ac0bc3f7dc7ed6de51df35128b109b374b563f5c0239891f58f7` across 43 artifacts and
  86 then-current readers.

The historical reviewed T10 digest set available at its local task-proof checkpoint is:

- prerequisite inventory:
  `ec52c27dbc9ea1db400cae2fa1ec7ab7b58b468eb83ee396ea7c082107fc06cb`;
- ordered legacy leaves:
  `f167a05bbac9b7959ed6f179e2adacef3382d21a6e6056c568aeddab891a58ec`;
- distinct leaf workloads:
  `a91f9e647b3a4bfcd8a45e2fe473b0c86a7acd2edc450897eab851e2dca47fc5`;
- 16 workspace test scripts:
  `4d7c4232cc0e31519f2f58e9ebeb355405e493594406aee99ed2a78ce0c796ab`;
- workspace manifest:
  `6c693fc7e2b55dfc4b2e84a9e267aef0b6aeecb3160a04cdba67ce570f860be9`;
- retained sequential plan:
  `c038b0292d6caadb182862315369448dcd505ec926251e0e2aef8cf90d78b58f`;
- neutral inventory:
  `853175eac4b6da232424cc6f47ad8455db3970ae1a72744bf7324b56403bf59f`;
- workload-id set:
  `997c1d93c209defe69668b4ac913078f7d2e2c7c1d807900e589b54e1af38a43`;
- ordered equivalence projection:
  `d202066339b60259cbb07705702e0cebf1773c8577aa12f2d3328cd515eb0273`;
- selector-only impact graph:
  `4476d5162c2457d991d17c5c9cb450a838c8b084abff634b8fa4195f89465602`;
- M09-T10 connected closure:
  58 proof units and 126 workloads at
  `ac5ba9fad912e6dbbc1bdd14c919a8209163cec49db4477116dc42af35e05b41`;
- affected ownership:
  1,218 paths at `75f780c0c2afdfdaedfdd653cc3f36128dc968639d536085eb9b52a72f5f7de6`, with
  182 proof-owned reader paths and projection
  `eee064ac0466c87d117b4219ad76365fda288a980c61ab701342f0514777c9ab`;
- ownership categories (`PROOF_UNIT`, `CI_POLICY`, `DEPENDENCY_POLICY`, `FROZEN_INPUT`,
  `PACKAGE_OR_APPLICATION`, `SHARED_PROOF_INFRASTRUCTURE`, `PROJECT_DOCUMENTATION`,
  `REPOSITORY_POLICY`): `182 / 45 / 31 / 135 / 468 / 219 / 127 / 11`;
- required plan:
  `cffce400b6a3793d3e42051508425bf81a0c66923b6e579d40ac82b836e8daec`;
- shadow plan:
  `55a04119bc9b6a3041d24ede83d36613ac7dac98cd871cded240387952ce750e`; and
- frozen promotion selection equivalence:
  `97cc1b29553f1bf3d92386e399c76f2f9c21e73a1c8073a15a9465f7c4fcf698`;
- selector authority:
  `2b961ae5105aa1959f7983f37f83b15f9dd030c052cc547069c2acab54ff0761`;
- required promotion-runner authority:
  `bc45f16ec8cec627f13ddda6faa29e3cc4b443618748b2475039490ad50fdb5d`; and
- sequence-49 proof-reader checkpoint:
  `45ed64e604400f18b15b3b4ef44bc35634a6c1567b46174329ec36529168272e` across 45 artifacts and
  90 current readers.

The historical reviewed T11 successor digest set is:

- CI contract script inventory:
  `92bcdb9435a1cb6492c20e5ad82013ac7d65479a15a5f5b5321b8e59351f6014`;
- prerequisite inventory:
  `4c086021423a728182e484e4ca218f419b58ae66a0b1a6607f1c5f4a1d677f09`;
- ordered legacy leaves:
  `3daf978eeb28f95aa523c54f5c1ad19cdb4fe81add9a53a971996f550f33e1cb`;
- distinct leaf workloads:
  `239097eb37432275fe71f5a14d8f6ec8688be5db11a2961cf8e8b503e8bcb175`;
- retained sequential plan:
  `397b9268dfe5e4c0dd22229ab95027f65278f1314eed16dd81fa9b5c66d346a5`;
- neutral inventory:
  `82b41b49abfd3b97f695af068e66168374ad2e994c7100b4442d06984032c7fc`;
- workload-id set:
  `4a33777d8bb5cf515137b6539eaefab36229c5c345848bbc6be1d7a55b132acf`;
- selector-only impact graph:
  `d028537891400c806dff4f7a4d7be3b3e783381369052b7d8079fdfd10759b73`;
- M09-T11 connected closure: 59 proof units and 128 workloads at
  `e0e1843e59db8002aa31ec0e6c2d6c435744d3c6985612373074e0b41312ded1`;
- affected ownership: 1,232 paths at
  `3d77bb0de542b1d153deb9fb87f2ba5adbc45e2153d9b156074026b04a755fff`, with 184 proof-owned
  reader paths and projection
  `86e1d1555580e1496686f11858c1bd4b69ce7b0f84a429b930ee9dc1c0f1f153`;
- ownership categories (`PROOF_UNIT`, `CI_POLICY`, `DEPENDENCY_POLICY`, `FROZEN_INPUT`,
  `PACKAGE_OR_APPLICATION`, `SHARED_PROOF_INFRASTRUCTURE`, `PROJECT_DOCUMENTATION`,
  `REPOSITORY_POLICY`): `184 / 45 / 31 / 136 / 476 / 221 / 128 / 11`;
- required and shadow plans:
  `e0933cb5f272fbc2aba058ac5a6c256a23f14bc4cfe8018c8b919c3851f92cac` and
  `01aadef839eec54e43b252d4bdfea183ac0256806399d3f71c898451fa7a33ff`; and
- selector authority:
  `be2ef9371615a503515df2d111107b8c885c6661b95b24d71ebc56c99991672a`.

The historical T11 independently promoted selector and required-runner authorities are
`b97d10bd27576ed5fc543dfd94fe7981cf2cf7bc2159aa6d431e2100312a6819` and
`a9e640b59786e2ee8f16c7bbd1f14be895d1ec71050f25a8fca6ffbe85104d6e`. Append-only proof-reader
sequence 50 advances exact predecessor
`45ed64e604400f18b15b3b4ef44bc35634a6c1567b46174329ec36529168272e` to
`6abea41064a05efe363df0f66d1e7d1b4923af08f819acf4c266b092985192a4` across 46 frozen
artifacts and 92 current readers; none of these identities is inferred from inventory counts.

The current reviewed T12 successor digest set is:

- CI contract script inventory:
  `92bcdb9435a1cb6492c20e5ad82013ac7d65479a15a5f5b5321b8e59351f6014`;
- prerequisite inventory: 715 segments at
  `2e1232681017a4e580acea5c523c07ee766175b8b1097c7a865ada56a3310a35`;
- ordered legacy leaves: 4,505 invocations at
  `cd11dc7cfac0fcb117572d2cd6a239fa20f3d31b3c1c8ca22f4dc34439aadc0d`;
- distinct leaf workloads: 311 at
  `f90a95cc791a26eb2170f3af27da743223d1458663dfcf3a2f657988cd7db278`;
- retained sequential plan:
  `0cf877430268ce6b4518999361d4867bc69dbffd81637f3935100793b7cf6fa2`;
- neutral inventory:
  `c1d3eb2b4b56e9a97d700f89ac0c0ff9c24bf158c3d18bd8e3d40c9c52b63eb7`;
- workload-id set:
  `ae68e7156d0fcd08ed61ec5820261e175211db3944b496379fdbe5746a759b0e`;
- ordered equivalence projection:
  `8799636c57969e7afebb65ce702dae6f08d9334e6f0a204a15d500b26358ad63`;
- selector-only impact graph:
  `97099a5cb52895eb80d095e99bf18838688d8a0aecf7af49993f0077466558c5`;
- M09-T12 connected closure: 60 proof units and 130 workloads at
  `bc7ef479fb426e6a61d6589c27dd5b3bcb4ff4593e0810f4f01be110650ad0f2`;
- affected ownership: 1,243 paths at
  `f216ba32517fd708d24b9d78035894e20951f5cd420d419a66e5ce0b813881c5`, with 186 proof-owned
  reader paths and projection
  `6511d79ff42cb84dd303f771b821a061cd89c72462dddf2ccd3966397c602983`;
- ownership categories (`PROOF_UNIT`, `CI_POLICY`, `DEPENDENCY_POLICY`, `FROZEN_INPUT`,
  `PACKAGE_OR_APPLICATION`, `SHARED_PROOF_INFRASTRUCTURE`, `PROJECT_DOCUMENTATION`,
  `REPOSITORY_POLICY`): `186 / 45 / 31 / 137 / 481 / 223 / 129 / 11`; and
- required and shadow plans:
  `b67aee6813b36d63dcdfe8c7d2fd9d6b4ee398cce6773b8f9336a03f324e03bb` and
  `230b004ecbd81c0be68456c4ad15326b8473177cf927f5dc330fdc8fdf7c152c`;
- selector authority:
  `ff4cdbac5be5b545843ca1aaf9842630e41e4f96e3cfccfa67d10e62436f93c6`; and
- required promotion-runner authority:
  `727e48f526547f6630d369b53b52da511bb1fb61389bbca1c36a757ad018bf93`.

Append-only proof-reader sequence 51 advances exact predecessor
`6abea41064a05efe363df0f66d1e7d1b4923af08f819acf4c266b092985192a4` to
`42e88946b598566a46237af8d30587fa765d9d58807e864464fc5525fbc64921` across 47 frozen
artifacts and 94 current readers; none of these identities is inferred from inventory counts.

The historical T07 shared-state counts were `6 / 3 / 1 / 75 / 90 / 10 / 1` in the table order
below across 186 workloads. Every current T12 workload has exactly one code-owned shared-state
class:

| Execution class                  | Count | Authority                                            |
| -------------------------------- | ----: | ---------------------------------------------------- |
| `GLOBAL_EXCLUSIVE`               |     6 | Repository-wide integrity and boundary barriers      |
| `WORKSPACE_OUTPUT_EXCLUSIVE`     |     3 | Workspace and public-package output writers          |
| `PACKAGE_TEST_EXCLUSIVE`         |     1 | Complete workspace package-test barrier              |
| `PROOF_READ_ONLY`                |    80 | Proof work with no shared workspace writes           |
| `PROOF_OS_TEMP_ISOLATED`         |    95 | Proof work restricted to a runner-owned OS temp root |
| `PROOF_TRACKED_ALIAS_EXCLUSIVE`  |    10 | Real tracked aliases with a drained scheduler        |
| `PROOF_WORKSPACE_TEMP_EXCLUSIVE` |     1 | The direct source-audit workspace-temp barrier       |

Historically, T08 had 78 ordinary proof pairs, eleven exclusive proof-pair barriers, eight serial
prefix workloads, and two serial suffix workloads: `8 + (78 * 2) + (11 * 2) + 2 = 188`.
Currently, 82 proof pairs are eligible for pair-level overlap at concurrency two after all
dependencies pass. Ten real tracked-alias pairs and `reference-host-web-source-audit` are the
eleven exclusive proof-pair barriers. Within every pair, the root test still depends on its
verifier. The exact T12 topology is eight serial prefix workloads, 82 ordinary proof pairs, eleven
exclusive proof-pair barriers, and two serial suffix workloads:
`8 + (82 * 2) + (11 * 2) + 2 = 196`. The
serial `editor-web-public-package-contract` prefix follows the editor-core public-package contract,
owns the editor-web `dist` write, and closes before the M08-T08 verifier.

The M07-T04 `control-plane-reference-preflight` pair is ordinary and non-barrier. Its verifier is
`PROOF_READ_ONLY`; its root mutation test is `PROOF_OS_TEMP_ISOLATED` and writes only inside its
runner-owned OS temp root. It receives no workspace-write, port, or native-addon authority, and its
verifier receives no child-runtime-probe grant.

The M07-T05 `control-plane-local-api` pair is also ordinary and non-barrier. Both workloads are
`PROOF_OS_TEMP_ISOLATED`. The verifier receives the exact `VERIFIER_RUNTIME_PROBE` child-process
policy, while the root receives only the ordinary `NODE_TEST_HARNESS` policy. Neither receives
workspace-write or port authority. Only those two exact workloads receive the
`CONTROL_PLANE_LOCAL_API_SQLITE` native-addon policy, and both OS-temp roots remain runner-owned
and identity-checked.

The M07-T06 `control-plane-runtime-staging` pair is ordinary and non-barrier. Its verifier is
`PROOF_READ_ONLY`; its root proof/mutation test is `PROOF_OS_TEMP_ISOLATED` and receives only the
ordinary `NODE_TEST_HARNESS` policy. Neither workload receives workspace-write, port, native-addon,
or verifier runtime-probe authority.

The M07-T07 `control-plane-runtime-activation` pair is ordinary and non-barrier. Both workloads are
`PROOF_OS_TEMP_ISOLATED`. The verifier alone receives the exact `VERIFIER_RUNTIME_PROBE`
child-process policy, while the root receives only `NODE_TEST_HARNESS`; both receive the narrow
`CONTROL_PLANE_RUNTIME_ACTIVATION_SQLITE` native-addon policy. Neither receives workspace-write or
port authority.

The M07-T08 `control-plane-runtime-recovery` pair is ordinary and non-barrier. Both workloads are
`PROOF_OS_TEMP_ISOLATED`. The verifier alone receives the exact `VERIFIER_RUNTIME_PROBE`
child-process policy, while the root receives only `NODE_TEST_HARNESS`; both receive the separate
narrow `CONTROL_PLANE_RUNTIME_RECOVERY_SQLITE` native-addon policy. Neither receives
workspace-write or port authority.

The M07-T09 `control-plane-runtime-fault-injection` pair is also ordinary and non-barrier. Both
workloads are `PROOF_OS_TEMP_ISOLATED`; the verifier receives the bounded
`VERIFIER_RUNTIME_PROBE` policy, the root receives `NODE_TEST_HARNESS`, and both receive only the
task-specific `CONTROL_PLANE_RUNTIME_FAULT_INJECTION_SQLITE` native-addon policy. Neither receives
workspace-write or port authority.

The M07-T10 `control-plane-runtime-transition-races` pair is ordinary and non-barrier. Both
workloads are `PROOF_OS_TEMP_ISOLATED`; the verifier receives the bounded
`VERIFIER_RUNTIME_PROBE` policy plus the separate task-specific
`CONTROL_PLANE_RUNTIME_TRANSITION_RACES_SQLITE` native-addon policy. The root receives
`NODE_TEST_HARNESS` and no native-addon authority because it injects the authenticated runtime
receipt. Neither receives workspace-write or port authority.

The M07-T11 `reference-host-web-channel-consumption` pair is ordinary and non-barrier. Both
workloads are `PROOF_OS_TEMP_ISOLATED`. The verifier receives the bounded
`VERIFIER_RUNTIME_PROBE` child policy and its task-specific
`REFERENCE_HOST_WEB_CHANNEL_CONSUMPTION_SQLITE` native-addon authority; the root receives only
`NODE_TEST_HARNESS` and no native-addon authority. Neither receives workspace-write or a fixed or
shared scheduler port. The verifier alone owns the code-registered
`desen.ci.loopback-child-listener-authority.v1` child-network profile. Its parent process
remains under the default listener denial; a mode-`0600`, singly linked, runner-temp authority and
random token activate only the spawned Vitest process tree. That child tree may bind only TCP over
literal IPv4 `127.0.0.1` with requested port `0`, and may connect only to an ephemeral port it
actually opened. Hostnames, IPv6, public addresses, fixed ports, Unix sockets, DNS, and UDP remain
denied. The complete proof pins seven focused-suite files, 46 runtime tests, nine exact end-to-end
case identities, 13 root mutation classes, and two browser type-test files. Real loopback listener
cases require hosted execution because the local sandbox returns `EPERM` on bind.

The M08-T01 `editor-core-source-document` pair is ordinary and non-barrier and follows the semantic
`protocol-structural-validation` predecessor. Both workloads are `PROOF_OS_TEMP_ISOLATED` and write
only inside their separate runner-owned OS temp roots. Neither receives workspace-write, port, or
native-addon authority. The verifier receives no child-runtime-probe grant, while the root receives
only the ordinary `NODE_TEST_HARNESS` policy.
The separate serial `editor-core-public-package-contract` prefix runs the exact package export-map,
compiler, and emitted-runtime contract before that verifier and owns its repeated `dist` write.

The M08-T02 `editor-core-stable-id-insert` pair is also ordinary and non-barrier. Both workloads
are `PROOF_OS_TEMP_ISOLATED`, follow that same serial public-package predecessor, and retain
verifier-before-root ordering. Neither receives workspace-write, port, or native-addon authority;
only the root receives the ordinary `NODE_TEST_HARNESS` child policy.

The M08-T03 `editor-core-structural-edits` pair is ordinary and non-barrier. Both workloads are
`PROOF_OS_TEMP_ISOLATED`, follow stable-ID insertion plus the same serial public-package
predecessor, and retain verifier-before-root ordering. Neither receives workspace-write, port,
native-addon, or verifier runtime-probe authority; only the root receives the ordinary
`NODE_TEST_HARNESS` child policy. It verifies the exact 22,402-byte artifact at
`sha256:0d44f67c316c21ff8b612221d01e81c76d3b24783164bb75a772985bbc7def8b`.

The M08-T04 `editor-core-content-edits` pair is ordinary and non-barrier. Both workloads are
`PROOF_OS_TEMP_ISOLATED`, follow stable-ID insertion and structural edits plus the same serial
public-package predecessor, and retain verifier-before-root ordering. Neither receives
workspace-write, port, native-addon, or verifier runtime-probe authority; only the root receives
the ordinary `NODE_TEST_HARNESS` child policy. It verifies the exact 26,988-byte artifact at
`sha256:1726d453913c091d30229be02270a0cb4b74bf479f87027c4b9a0da3bb3c7066`.

The M08-T05 `editor-core-state-binding-edits` pair is ordinary and non-barrier. Both workloads are
`PROOF_OS_TEMP_ISOLATED`, follow the formal stable-ID insertion prerequisite and the current content
edits graph plus the same serial public-package predecessor, and retain verifier-before-root
ordering. Neither receives workspace-write, port, native-addon, or verifier runtime-probe authority;
only the root receives the ordinary `NODE_TEST_HARNESS` child policy. It verifies the exact
30,014-byte artifact at
`sha256:b85e578ac2bc27897517f12d8d4cf867a089cd61ff9fd1ab0664c819977634f8`.

The M08-T06 `editor-core-event-action-edits` pair is ordinary and non-barrier. Both workloads are
`PROOF_OS_TEMP_ISOLATED`, follow the formal M08-T05 prerequisite plus the same serial public-package
predecessor, and retain verifier-before-root ordering. Neither receives workspace-write, port,
native-addon, or verifier runtime-probe authority; only the root receives the ordinary
`NODE_TEST_HARNESS` child policy. It verifies the exact 31,310-byte artifact at
`sha256:05a7df153512b8dd0f8289991d12a9d12d79903ed8b3637ef6c8a450ca8a6be7`.

The M08-T07 `editor-core-authoring-round-trip` pair is ordinary and non-barrier. Both workloads are
`PROOF_OS_TEMP_ISOLATED`, follow the M08-T06 pair plus the same serial public-package predecessor,
and retain verifier-before-root ordering. Neither receives workspace-write, port, native-addon, or
verifier runtime-probe authority; only the root receives the ordinary `NODE_TEST_HARNESS` child
policy. The verifier independently reauthenticates all six frozen M08-T01 through M08-T06 editor
artifacts before admitting T07 evidence.

The M08-T08 `editor-core-persistence` pair is ordinary and non-barrier. Both workloads are
`PROOF_OS_TEMP_ISOLATED`, follow the serial `editor-web-public-package-contract` predecessor, and
retain verifier-before-root ordering. Both receive the narrow
`EDITOR_CORE_PERSISTENCE_SQLITE` native-addon policy. The verifier receives no child-runtime-probe
grant; only the root receives the ordinary `NODE_TEST_HARNESS` child policy. Neither receives a
shared workspace-write or listener-port grant. The proof opens no listener: an explicit
fetch-shaped loopback adapter dispatches through Fastify injection into the same M07-T05 local
Source route backed by real native SQLite.

The M08-T09 `editor-core-continuous-validation` pair is ordinary and non-barrier. Both workloads
are `PROOF_OS_TEMP_ISOLATED`, follow the editor-core public-package contract, and retain
verifier-before-root ordering. Its exact five formal impact parents are M08-T03 through M08-T07;
M08-T08 persistence is a sibling rather than a formal parent. Neither workload receives
workspace-write, listener-port, native-addon, filesystem-compatibility, or verifier runtime-probe
authority; only the root receives the ordinary `NODE_TEST_HARNESS` child policy.

The M08-T10 `editor-core-terminal-integration` pair is ordinary and non-barrier. Both workloads are
`PROOF_OS_TEMP_ISOLATED`, follow the editor-core public-package contract, retain verifier-before-root
ordering, and close over all M08-T01–T09 proof parents plus the frozen
`runtime-core-headless-sign-in` and `runtime-core-audit-hardening` proofs required by P-18. Neither
receives workspace-write, listener-port, native-addon, filesystem-compatibility, or verifier
runtime-probe authority; only the root receives the ordinary `NODE_TEST_HARNESS` child policy.
The conservative proof graph does not widen editor-core production authority.

The M09-T01 `desen-app-shell-navigation` pair is ordinary and non-barrier behind the exact M08-T10
terminal-integration proof. Its verifier is `PROOF_READ_ONLY`; its root mutation test is
`PROOF_OS_TEMP_ISOLATED` and receives only the standard `NODE_TEST_HARNESS` child policy. Neither
receives workspace-write, listener-port, native-addon, filesystem-compatibility, or verifier
runtime-probe authority. This pair owns only the bounded Desen App shell and navigation evidence;
it cannot make a Catalog, editor mutation, canvas, persistence, diagnostics, Run, or publish claim.

The M09-T02 `desen-app-catalog-panel-layer-tree` pair is ordinary and non-barrier. Its two exact
semantic impact parents are `desen-app-shell-navigation` and
`reference-catalog-web-capability-artifact`, producing the reviewed 66-workload affected closure.
Its verifier is `PROOF_READ_ONLY`; its root mutation test is `PROOF_OS_TEMP_ISOLATED` and receives
only `NODE_TEST_HARNESS`. Neither side receives workspace-write, listener-port, native-addon,
filesystem-compatibility, or verifier runtime-probe authority. The local M09-T02 root wrappers call
the two predecessor artifact verifiers directly, so developer commands authenticate those receipts
without recursively replaying their historical prerequisite chains.

The M09-T03 `desen-app-real-adapter-canvas` pair is ordinary and non-barrier. Its exact semantic
impact parents are `desen-app-shell-navigation` and `reference-host-web-source-audit`; its reviewed
connected graph contains 51 proof units and 112 workloads. Both workloads are
`PROOF_OS_TEMP_ISOLATED`. The verifier receives the bounded `VERIFIER_RUNTIME_PROBE` child policy,
the root receives `NODE_TEST_HARNESS`, and both receive only the
`DESEN_APP_REAL_ADAPTER_CANVAS_VITE` native-addon policy needed by the real Vite/Rollup build.
Neither receives workspace-write, listener-port, or filesystem-compatibility authority.

The M09-T04 `desen-app-selection-overlay` pair is ordinary and non-barrier. Its sole exact semantic
impact parent is `desen-app-real-adapter-canvas`; its T04 connected closure contains 52 proof
units and 114 workloads. Its verifier is `PROOF_READ_ONLY`; its root mutation test is
`PROOF_OS_TEMP_ISOLATED` and receives only `NODE_TEST_HARNESS`. Neither side receives
workspace-write, listener-port, native-addon, filesystem-compatibility, or verifier runtime-probe
authority.

The M09-T05 `desen-app-schema-inspector` pair is ordinary and non-barrier. Its exact semantic
impact parents are `desen-app-catalog-panel-layer-tree`, `desen-app-selection-overlay`, and
`publisher-official-golden`; its reviewed T05 connected closure contains 53 proof units and 116
workloads. Its verifier is `PROOF_READ_ONLY`; its root mutation test is
`PROOF_OS_TEMP_ISOLATED` and receives only `NODE_TEST_HARNESS`. Neither side receives
workspace-write, listener-port, native-addon, filesystem-compatibility, or verifier runtime-probe
authority. Its local wrapper authenticates the three direct predecessor artifacts before the App
build, typecheck, focused Inspector suite, verifier, and root proof.

The M09-T06 `desen-app-structured-inspector` pair is ordinary and non-barrier. Its sole exact
semantic impact parent is `desen-app-schema-inspector`; its reviewed T06 connected closure contains 54
proof units and 118 workloads at
`sha256:5ccac855e50f6fe0b3b17f1d36b5dd72ac4657132bf9ee7280f5fe8cf297d5ec`. Its verifier is
`PROOF_READ_ONLY`; its root mutation test is `PROOF_OS_TEMP_ISOLATED` and receives only
`NODE_TEST_HARNESS`. Neither side receives workspace-write, listener-port, native-addon,
filesystem-compatibility, or verifier runtime-probe authority. Its local wrapper authenticates the
frozen M09-T05 artifact before the App build, typecheck, structured-Inspector suite, verifier, and
root proof.

The historical M09-T07 `desen-app-named-slot-authoring` pair is ordinary and non-barrier. Its sole
exact semantic impact parent is `desen-app-structured-inspector`; its connected closure contained
55 proof units and 120 workloads at
`sha256:6a7cb544efd2906ccd09db03209c54888a25f366b080b5cf37b87c43edc2651c`. Its verifier is
`PROOF_READ_ONLY`; its root mutation test is `PROOF_OS_TEMP_ISOLATED` and receives only
`NODE_TEST_HARNESS`. Neither side receives workspace-write, listener-port, native-addon,
filesystem-compatibility, or verifier runtime-probe authority. Its local wrapper authenticates the
frozen M09-T06 artifact before the App build, typecheck, focused named-slot suite, verifier, and
root proof.

The historical M09-T08 `desen-app-state-binding-editor` pair is ordinary and non-barrier. Its exact
semantic impact parents are `desen-app-schema-inspector`, `editor-core-state-binding-edits`, and
`desen-app-named-slot-authoring`; its connected closure contains 56 proof units and 122 workloads
at `sha256:b4eff1232ccf34756c0336a868785fb457a2195338e75363a2a14ecae14d3427`. Its verifier is
`PROOF_READ_ONLY`; its root mutation test is `PROOF_OS_TEMP_ISOLATED` and receives only
`NODE_TEST_HARNESS`. Neither side receives workspace-write, listener-port, native-addon,
filesystem-compatibility, or verifier runtime-probe authority. Its local wrapper authenticates the
three direct predecessor artifacts before the App build, typecheck, focused state-binding suite,
verifier, and root proof.

The historical M09-T09 `desen-app-event-action-editor` pair is ordinary and non-barrier. Its exact
semantic impact parents are `desen-app-state-binding-editor` and `editor-core-event-action-edits`;
its connected closure contains 57 proof units and 124 workloads at
`sha256:8b6cc878b91a9211d356b8432d716e631fdbf59f6b0647755562d0d06dad708e`. Its verifier is
`PROOF_READ_ONLY`; its root mutation test is `PROOF_OS_TEMP_ISOLATED` and receives only
`NODE_TEST_HARNESS`. Neither side receives workspace-write, listener-port, native-addon,
filesystem-compatibility, or verifier runtime-probe authority. Its local wrapper authenticates the
two direct predecessor artifacts before the App build, typecheck, focused event-action suite,
verifier, and root proof.

The historical M09-T10 `desen-app-design-run-modes` pair is ordinary and non-barrier. Its exact
semantic impact parents are `desen-app-real-adapter-canvas`, `desen-app-state-binding-editor`, and
`desen-app-event-action-editor`; its connected closure contains 58 proof units and 126 workloads at
`sha256:ac5ba9fad912e6dbbc1bdd14c919a8209163cec49db4477116dc42af35e05b41`. Its verifier is
`PROOF_READ_ONLY`; its root mutation test is `PROOF_OS_TEMP_ISOLATED` and receives only
`NODE_TEST_HARNESS`. Neither side receives workspace-write, listener-port, native-addon,
filesystem-compatibility, or verifier runtime-probe authority. Its local wrapper authenticates the
three direct predecessor artifacts before the App build, typecheck, focused Design/Run suite,
verifier, and root proof.

The historical M09-T11 `desen-app-fixtures-scenarios-fidelity` pair is ordinary and non-barrier. Its
exact semantic impact parents are `desen-app-design-run-modes`,
`reference-sign-in-fixtures-and-host-binding`, and `reference-catalog-web-parity`; its connected
closure contains 59 proof units and 128 workloads. Its verifier is `PROOF_READ_ONLY`; its root
mutation test is `PROOF_OS_TEMP_ISOLATED` and receives only `NODE_TEST_HARNESS`. Neither side
receives workspace-write, listener-port, native-addon, filesystem-compatibility, or verifier
runtime-probe authority. Its local wrapper authenticates the three exact parents before the App
typecheck/build, 86-case focused suite, verifier, and 11-case root proof.

The current M09-T12 `desen-app-source-persistence` pair is ordinary and non-barrier. Its exact
semantic impact parents are `desen-app-shell-navigation`, `editor-core-persistence`, and
`desen-app-fixtures-scenarios-fidelity`; its connected closure contains 60 proof units and 130
workloads at `sha256:bc7ef479fb426e6a61d6589c27dd5b3bcb4ff4593e0810f4f01be110650ad0f2`.
Its verifier is `PROOF_READ_ONLY`; its root mutation test is `PROOF_OS_TEMP_ISOLATED` and receives
only `NODE_TEST_HARNESS`. Neither side receives workspace-write, listener-port, native-addon,
filesystem-compatibility, or verifier runtime-probe authority. Its local wrapper authenticates the
three exact parents before the App build, typecheck, five-file/135-case focused persistence suite,
verifier, and root proof.

The only verifier runtime-probe exceptions, each with isolated temp and child-process authority,
are:

- `publisher-catalog-pinning`;
- `publisher-bundle-publication`;
- `publisher-official-golden`;
- `publisher-invalid-source-matrix`; and
- `control-plane-bundle-store`;
- `control-plane-bundle-verification`; and
- `control-plane-local-api`; and
- `control-plane-runtime-activation`; and
- `control-plane-runtime-recovery`; and
- `control-plane-runtime-fault-injection`; and
- `control-plane-runtime-transition-races`; and
- `reference-host-web-channel-consumption`; and
- `desen-app-real-adapter-canvas`.

Native-addon authority is limited to the exact `reference-host-web-source-audit` verifier/root-test
pair, the `publisher-invalid-source-matrix` root test, and the exact `control-plane-local-api`,
`control-plane-runtime-activation`, `control-plane-runtime-recovery`, and
`control-plane-runtime-fault-injection` verifier/root-test pairs plus only the
`control-plane-runtime-transition-races` and `reference-host-web-channel-consumption` verifiers,
and the exact `editor-core-persistence` verifier/root-test pair, plus the exact
`desen-app-real-adapter-canvas` verifier/root-test pair. The transition-races and
channel-consumption roots receive no native-addon grant. These grants cover seventeen exact steps;
all unlisted steps remain denied.
The source-audit verifier remains workspace-read-only; its root test is the sole workspace-temp
barrier. The publisher root loads only the reviewed Rolldown binding, and the control-plane pairs
load only their reviewed SQLite binding. The adapter-canvas pair loads the reviewed Vite/Rollup
build binding while its verifier child process remains temp-isolated.

Node 24 requires an orthogonal filesystem-compatibility policy for eighteen exact root tests. The
historical T07 distribution across 186 workloads was 168 `NONE`, two `FIXTURE_COPY`, fifteen
`REVIEWED_SYMLINK`, and one `FIXTURE_COPY_AND_REVIEWED_SYMLINK`; the historical T10 distribution
across 192 workloads is 174 `NONE`, two `FIXTURE_COPY`, fifteen `REVIEWED_SYMLINK`, and one
`FIXTURE_COPY_AND_REVIEWED_SYMLINK`. Fixture copy accepts only an exact code-owned source and
bounded no-follow destination tree inside the workload temp root. Reviewed
symlinks keep temp targets local and pin fourteen workspace-target workloads to eighteen exact
target-and-kind rules: eight unsafe-input files are mirrored into temp, while ten historical
canonical-path or inode checks retain their exact tracked aliases.

The current T12 distribution across 196 workloads is 178 `NONE`, two `FIXTURE_COPY`, fifteen
`REVIEWED_SYMLINK`, and one `FIXTURE_COPY_AND_REVIEWED_SYMLINK`; the new verifier/root pair requires
no filesystem compatibility widening.

The generated permissions add no shared-parent, sibling-temp, or workspace-write path. The preload
is a trusted-repository-code compatibility adapter, not an adversarial OS sandbox; every root test
already requires child-process authority. Static target/kind regressions, permission-bound temp
identity, exclusive scheduling for real aliases, and the closing tracked workspace seal provide
the enforcement appropriate to this CI boundary.

Each proof process receives a fresh authenticated temp root and generated Node permission policy.
Direct workspace-write grants, child processes, and native addons are denied unless the exact
workload classification grants them; inherited `NODE_OPTIONS` is rejected. A required preload
denies TCP and UDP listener binding by default. The sole authenticated M07-T11 Vitest child-policy
exception is the loopback port-zero boundary above; it leaves UDP and external networking denied.
Cleanup authenticates the temp directory identity before removing it.

Required authority cannot be fabricated through the injected callbacks used by the focused test
harness. Only the default shell-free process runner can emit an accepted required close receipt;
injected Git readers, workspace captures, guards, process functions, environments, signals, and
timeouts are rejected. The opening boundary binds clean porcelain-v2 state to the authenticated
revision before any workload starts. Hosted `SHADOW` measurement uses this same real boundary;
only focused non-authoritative tests may inject it.

The host signal handlers, scheduler, and active process registry share one first-terminal record.
The first timeout, child error, nonzero close, execution error, SIGINT, or SIGTERM fixes the reason
and exit code, immediately terminates all active groups, and prevents new launches. Later signals
may escalate to SIGKILL but cannot replace the winner. Settlement still waits for every child
`close` and isolation cleanup.

The code-owned affected timeout remains 17 minutes, while exhaustive execution owns an 18-minute
soft complete-gate timeout above the 15-minute workload timeouts. Authentic settlement still
awaits child `close`, cleanup, and boundary capture. Phase A therefore wraps the command in a
19-minute operating-system ceiling with a 30-second kill grace, inside a 25-minute hosted job. An
outer-ceiling failure is never accepted as promotion evidence. The frozen I07-04 artifact retains
its historical 17-minute soft and 18-minute process ceilings; live successor authority separately
authenticates the current 17-minute affected, 18-minute exhaustive, and 19-minute process limits.

The execution boundary authenticates the repository revision and inventory and compares tracked
bytes, executable modes, tracked-file count, and Git index object ids before and after all 184
current T09 steps, including failure paths; the corresponding historical T08 count was 182. The
shared-state boundary also seals every reviewed build/Turbo
output root across the proof phase and compares non-ignored untracked state across the complete
execution region. A dependency download cache may save network time; no build, test, checkpoint,
mutation, or proof pass is reusable authority.

## I07-03 shadow-affected observation

I07-03 leaves `run-required-exhaustive-quality-gate.mjs` unchanged as the sole pass/fail authority.
A separate pull-request-only job invokes `run-shadow-affected-quality-gate.mjs` with
`SHADOW + AFFECTED`; it cannot make CI pass, skip an authoritative workload, or publish cached
proof success.

The selector authenticates the exact tracked-path set, the same-repository merge boundary, path
ownership, and the affected dependency closure. Unknown, ambiguous, untrusted, policy, dependency,
frozen-input, unowned, incomplete-diff, unsupported-kind, or unsupported-mode changes select
`EXHAUSTIVE`. A strict subset is only a plan: every selected workload still runs from fresh inputs
under the same isolation and closing guards. `main` and manual-audit execution—including the
release process routed through them—remains `REQUIRED + EXHAUSTIVE`.

Only exact process-local boundary receipts may reach the selector; clones and self-digested
lookalikes fail closed. At the I07-03 checkpoint, the then-current successor selector digest
`sha256:010ef43efb4f4414d315ef4702324ae111c4666c38b3290f1a4891bebb3b98ea` seals 20 exact boundary,
selector, graph, ownership, threshold, shadow-runner, required-oracle, workflow, and toolchain
sources, so algorithm drift resets observation continuity. The frozen I07-03 bootstrap baseline
retains its historical `sha256:20a78069ed829649ab9198cad68b5d7fede22dc3b6ec391ed84f5dd1f0afa86f`
receipt. The affected suffix uses an explicit `SELECTED_ROOT_BARRIER`: only roots that genuinely
ran satisfy its ordering barrier.

At that checkpoint, promotion was frozen behind zero false negatives, mutation coverage for every selector category,
and at least 20 consecutive eligible same-revision hosted strict-subset affected/exhaustive
comparisons. The initial observation count was `0 / 20` and promotion was false; I07-04 was
`NOT_STARTED`. The pure ledger never grants promotion from supplied
records; I07-04 must separately pin exact authenticated hosted run/job/revision/receipt evidence.
The hosted bootstrap passed the authoritative Quality gate. Its shadow outcome was
`NOT_ELIGIBLE` → `EXHAUSTIVE` for `UNSUPPORTED_CHANGE_KIND`; no strict subset ran, so the result
did not count and the counter remained `0 / 20` then. I07-04 later authenticated `20 / 20`
eligible comparisons with zero false negatives and completed hosted cutover. The exact bootstrap run/job/revision/receipt
identifiers are in
[`i07-03-affected-selector-shadow.json`](../../docs/proof/baselines/i07-03-affected-selector-shadow.json).
Focused local contracts passed 91/91 and all CI infrastructure tests passed 203/203. At that
historical checkpoint, the full local gate was `BLOCKED_BY_LOCAL_SANDBOX` because loopback
`listen` returned `EPERM` in two pre-existing TCP lifecycle tests. That environment limitation was
not a product regression; the hosted Quality gate remained authoritative. `DEBT-I07-017` assigns
the shadow-only job, wrapper, and test wiring to
I07-04 for removal by G07.

## Completed promotion boundary

I07-02 recorded exact workload equality, exactly-once coverage, matching outcomes, clean
tracked-workspace parity, safe cancellation, shared-state classification, and local plus hosted
evidence before completing the workflow cutover. The accepted evidence is
`docs/proof/baselines/i07-02-required-exhaustive-equivalence.json`. I07-02 implements no
affected-path selector. Its promotion closed `DEBT-I07-008` by removing the temporary shadow
workflow and modular comparison adapter/test. At its checkpoint, I07-03 calculated `AFFECTED` plans
only in the separate non-authoritative observer; any unproven input expanded to `EXHAUSTIVE`. Its
frozen threshold started at `0 / 20`, so I07-04 owned both later selector promotion and G07-due reader and
shadow-only cleanup. `DEBT-I07-007` keeps the sequential runner, equivalence adapter, and other
rollback-only paths until I07-05 proves their removal gates.

## I07-04 promotion complete

The independent I07-04 campaign subsequently reached 20/20 hosted same-revision comparisons with
zero false negatives. `affected-selector-promotion-evidence.mjs` pins the immutable historical
campaign, derives one same-read current comparison authority, proves the exact conservative
ownership/selector transition, and seals the required dispatcher. The dispatcher runs a strict
subset only for an authenticated eligible same-repository PR; every uncertain or drifted boundary
falls back exactly once to fresh exhaustive execution. `main`, releases, and manual audits remain
fresh exhaustive. All 17 G07-due compatibility/shadow targets are locally absent. Historical
closure checkpoint sequence 28 at
`2577962251a9e6fa86993bd0e8bda1ed901f850a3b93678486c0445aed035546` authenticates 25 frozen
artifacts and 50 readers. Historical sequence 30 remains pinned at
`f5598749a14e7d5eed27cb07e92a83f2bec28b5404f4480600e687d960f04970`. Historical sequence 31 is
`181d5a1e0c012f53cfe02640c2f8d0ddf1e300090a3c3742882bb3722175e42d`, and historical sequence 32 is
`9be019b902ee17a57c9e2f13270fa67fe26265d06e360719bd1542643be6a424`. Historical M08-T05
authority is sequence 33 at
`64da5390046020ed223da42ce8a24d9fcf971c6a5a0a92fc49d368586414c871`, authenticating 30 frozen
artifacts and 60 then-current readers. Historical M08-T06 authority remains sequence 34 at
`f641e8d20d0f5e94cca809d330e3ad5bb0d7ffe0c3ec5defc14e0b5fca63b674`, authenticating 31 frozen
artifacts and 62 then-current readers. Historical M08-T07 authority is sequence 35 at
`a2e3ef962ed37e0570cdddef64ae8d0eef2fd3f298cc2580f7ee65d8200f6fa3`, authenticating 32 frozen
artifacts and 64 then-current readers while preserving sequence 34 and every earlier byte. The twelve
changed historical readers occupy indexes `[50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61]`,
and the T07 proof/root readers occupy `[62, 63]`. Historical M08-T08 authority is sequence 36 at
`4f351f2f535b1fc335876160256a42b1d53c7c7f43db08e0b86bf50c389d1e82`, authenticating 33 frozen
artifacts and 66 then-current readers while preserving sequence 35 and every earlier byte. The fourteen
resealed editor readers occupy indexes `[50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62,
63]`, and the T08 proof/root readers occupy `[64, 65]`. Historical M08-T09 authority is sequence 37 at
`e43b48e2d4873b9212d4d0b1bf3e6fb03f56fcc350f8bc9ad65409891995c310`, authenticating 34 frozen
artifacts and 68 then-current readers while preserving sequence 36 and every earlier byte. The sixteen
resealed editor readers occupy indexes `[50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62,
63, 64, 65]`, and the T09 proof/root readers occupy `[66, 67]`. Historical M08-T10 authority is
sequence 38 at `64f7d6519589a5a8cb564af1215c2a12c44297f8ea855910613ea3b361cee6d0`, authenticating 35 frozen
artifacts and 70 then-current readers while preserving sequence 37 and every predecessor artifact
byte. The eighteen resealed live editor readers occupy indexes `[50, 51, 52, 53, 54, 55, 56, 57,
58, 59, 60, 61, 62, 63, 64, 65, 66, 67]`, and the T10 proof/root readers occupy `[68, 69]`.
Current corrective reader authority is sequence 39 at
`6a186ee56e9a3c8ffd176b712d54a56e7ca3e73990f46d0fe387c9f52bddf6f7`. It preserves sequence 38,
all 35 frozen artifact receipts, and all 70 reader identities while advancing only indexes `[66, 67,
68, 69]`: T09 proof 71,087 bytes / `sha256:df665c264cea2c33a937c0fc74b6250ede8acae2032b75f2f24c1f8dc69affdb`,
T09 root 15,066 bytes / `sha256:574467231c3dbf4fd60b350da7f39c008d39072d935f461c50e059c609cc4d2a`,
T10 proof 90,708 bytes / `sha256:53942712a9a1c40a1076b46912d13feb247eda59405790f4f211c495c44e895c`,
and T10 root 14,830 bytes / `sha256:9cc2fb35ddb5d4b15371f8edcba07837e02a605169a609ef5eeb5da7e3ef0431`.
M09-T01 appends sequence 40 at
`e19eabc91c56c015b7fec7469d096b09a4bf42f5b6edc907c0207dd8c94feb0e`. It preserves
sequences 1–39 and all 35 predecessor artifact receipts byte-exact, appends the 12,118-byte
M09-T01 artifact at index 35 and its proof/root readers at `[70, 71]`, advances live T09/T10
source-reader indexes `[66, 67, 68]` for current README-bound source bytes, and reauthenticates the
byte-exact unchanged T10 root receipt at `[69]`. The chain now authenticates 36 frozen artifacts
and 72 current readers. The dedicated checkpoint suite passes 63/63; this local reader authority
makes no required-gate or hosted M09-T01 claim.
M09-T02 appends sequence 41 at
`b36679b7ea3ffd0e019d3051b30312dd96b050e10ae7d5d44cf39eb9d30eeb68`. It preserves sequences
1–40 and all 36 predecessor artifact receipts byte-exact, appends the 25,375-byte M09-T02 artifact
at index 36 and its proof/root readers at `[72, 73]`, and advances only the live M09-T01 readers at
`[70, 71]`. The chain now authenticates 37 frozen artifacts and 74 current readers. The dedicated
checkpoint suite passes 64/64; this local reader authority makes no required-gate or hosted M09-T02
claim.
M09-T03 appends sequence 42 at
`40d7c380cec3a7efd04316959a41abda3c8f71c1604f7f2fb892f18ae4cd2fa5`. It preserves sequences
1–41 and all 37 predecessor artifact receipts byte-exact, appends the 73,111-byte M09-T03 artifact
at index 37 and its proof/root readers at `[74, 75]`. The chain now authenticates 38 frozen
artifacts and 76 current readers. The dedicated checkpoint suite passes 65/65; this local reader
authority makes no required-gate or hosted M09-T03 claim.
M09-T04 appends sequence 43 at
`0bbb101332d7af5dcf7260b6df6961837003571f67a6e3a69232e65e19cded58`. It preserves sequences
1–42 and all 38 predecessor artifact receipts byte-exact, appends the 11,997-byte M09-T04 artifact
at index 38, reseals App compatibility readers `[70, 71, 72, 73, 74, 75]`, and appends its
proof/root readers at `[76, 77]`. The chain now authenticates 39 frozen artifacts and 78 current
readers. The dedicated checkpoint suite passes 66/66; this local reader authority makes no
required-gate or hosted M09-T04 claim.
M09-T05 appends historical sequence 44 at
`f0c5f3bfbc30ccf230c5256b3a5672c29ffa0e884129ae210571895bd063812c`. It preserves sequences
1–43 and all 39 predecessor artifact receipts byte-exact, appends the 22,998-byte M09-T05 artifact
at index 39, reseals App compatibility readers `[70, 71, 72, 73, 74, 75, 76, 77]`, and appends its
proof/root readers at `[78, 79]`. That historical chain authenticates 40 frozen artifacts and 80
then-current readers. The dedicated checkpoint suite passed 67/67; this local reader authority
makes no required-gate or hosted M09-T05 claim.
M09-T06 appends sequence 45 at
`340460237dd173995d4d0fa158f0e4c6c54b76d55958757d742a981466fd213f`. It preserves sequences
1–44 and all 40 predecessor artifact receipts byte-exact, appends the 26,133-byte M09-T06 artifact
at index 40, reseals App reader indexes `[70, 71, 72, 73, 74, 75, 76, 77, 78, 79]`, and appends
its proof/root readers at `[80, 81]`. The chain now authenticates 41 frozen artifacts and 82 current
readers. The dedicated checkpoint suite passes 68/68; this local reader authority makes no
required-gate or hosted M09-T06 claim.
M09-T07 appends sequence 46 at
`f09ec643d1b2756174ca47fae99837a68f6656bec0c6933e566d5075713a0f5f`. It preserves sequences
1–45 and all 41 predecessor artifact receipts byte-exact, appends the 24,830-byte M09-T07 artifact
at index 41, reseals App compatibility readers `[70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80,
81]`, and appends its proof/root readers at `[82, 83]`. That historical chain authenticates 42
frozen artifacts and 84 then-current readers. The dedicated checkpoint suite passed 69/69; this
historical local reader authority makes no required-gate or hosted M09-T07 claim.
M09-T08 appends sequence 47 at
`c28ba9a9f274ac0bc3f7dc7ed6de51df35128b109b374b563f5c0239891f58f7`. It preserves sequence 46,
all earlier checkpoint bytes, and all 42 predecessor artifact receipts, appends the 28,766-byte
M09-T08 artifact, and records the machine-verified live T08 proof/root reader receipts. The chain
then authenticated 43 frozen artifacts and 86 current readers. This historical local reader authority makes no
required-gate or hosted M09-T08 claim.
M09-T09 appends sequence 48 at
`5ecf9e630e2c91cb97a7c85c60e8318fdf694039711a64bf1797e481aca0ff90`. It preserves sequences
1–47 and all 43 predecessor artifact receipts byte-exact, appends the 23,812-byte M09-T09 artifact
at `sha256:0060ef39273ea36666f1701d5d3fa0f1610b95f40d88304ba980dcdc73cb29ab`, reseals exact live
reader indexes `[70, 71, 72, 73, 74, 75, 78, 79, 80, 81, 82, 84, 85]`, and appends its proof/root
readers at `[86, 87]`. The chain now authenticates 44 frozen artifacts and 88 current readers. The dedicated
checkpoint suite passes 71/71; this local reader authority makes no required-gate or hosted
M09-T09 claim.
M09-T10 appends sequence 49 at
`45ed64e604400f18b15b3b4ef44bc35634a6c1567b46174329ec36529168272e`. It preserves sequences
1–48 and all 44 predecessor artifact receipts byte-exact, appends the 17,900-byte M09-T10 artifact
at `sha256:bc5b7ffef0c39737882072f9340bcade86f084db8e7923fcb03aa7364d077334`, reseals exact live
reader indexes `[72, 73, 74, 75, 76, 77, 78, 80, 82, 84, 86, 87]`, and appends its proof/root readers at
`[88, 89]`. The final readers are 53,346 bytes at
`sha256:ff4226241630daded979263dcd0a7fdb071591efbf789d1e7d2d4f4641779dfe` and 15,787 bytes at
`sha256:d27307b0763132e5c21f45c146d3773ab9dbf02371f850dca3d03e11a759f601`. The chain now
authenticates 45 frozen artifacts and 90 current readers. The dedicated checkpoint suite passes
72/72; this local reader authority makes no required-gate or hosted M09-T10 claim.
The first hosted PR run exposed an isolation-fixture workspace-target symlink denied by Node's
permission model. The resealed fixture uses only absolute runner-temporary targets, and the exact
isolation suite passes 8/8 without permission widening. This correction does not claim a hosted
pass yet.
[Cleanup PR #36](https://github.com/desenlab/desen-app/pull/36)
passed fresh `REQUIRED + EXHAUSTIVE` in
[run 31674300000, job 94365383803](https://github.com/desenlab/desen-app/actions/runs/31674300000/job/94365383803),
and its landed `main` revision passed the same authority in
[run 31675234655, job 94368259305](https://github.com/desenlab/desen-app/actions/runs/31675234655/job/94368259305).
The one-file [canary PR #37](https://github.com/desenlab/desen-app/pull/37) passed fresh
`REQUIRED + AFFECTED` in 3m54s in
[run 31676049922, job 94370743935](https://github.com/desenlab/desen-app/actions/runs/31676049922/job/94370743935),
selecting and closing 10 workloads for one proof unit as a strict subset without cached success.
All 17 G07-due entries are `CLOSED`; `DEBT-I07-007` remains `OPEN` for I07-05. I07-04, G07,
M08-T10, G08, and M09-T01–T08 are `DONE`; proof gates are 10/13, implementation is 103/145,
M08 is 10/10, M09 is 8/14, `N-012`, `N-014`, `N-018`, `N-042`, `S-002`, and `S-003` are `TESTED`,
P-06 and P-18 are `PROVEN`, P-08 remains `NOT_PROVEN`. M09-T09 through M09-T14 and G09 are also
`DONE`; implementation is 109/145, M09 is 14/14, proof gates are 11/13, `N-012`, `N-018`,
`N-035`, `S-001`, and `S-003` are `TESTED`, PF-028 is `CLOSED`, P-07/P-09/P-10 remain `PARTIAL`,
P-08/P-12 remain `NOT_PROVEN`, N-036 remains `PLANNED`, and PF-085/PF-086/PF-089 remain `OPEN`.
M10-T01 is next. The exact 30,014-byte
M08-T05 artifact is
`docs/proof/artifacts/editor-core-0.1.0-state-binding-edits.json` at
`sha256:b85e578ac2bc27897517f12d8d4cf867a089cd61ff9fd1ab0664c819977634f8`, with reviewed report
`docs/proof/EDITOR-CORE-STATE-BINDING-EDITS.md`; it remains M08-T06's sole direct prerequisite. The
exact 31,310-byte M08-T06 artifact is
`docs/proof/artifacts/editor-core-0.1.0-event-action-edits.json` at
`sha256:05a7df153512b8dd0f8289991d12a9d12d79903ed8b3637ef6c8a450ca8a6be7`, with reviewed report
`docs/proof/EDITOR-CORE-EVENT-ACTION-EDITS.md`. The exact 62,304-byte M08-T07 artifact is
`docs/proof/artifacts/editor-core-0.1.0-authoring-round-trip.json` at
`sha256:33b6f81be62076d304c6daaec5d860e7995fa69ceaf34103469b349a347962db`, with reviewed report
`docs/proof/EDITOR-CORE-AUTHORING-ROUND-TRIP.md`. The exact 49,785-byte M08-T08 artifact is
`docs/proof/artifacts/editor-core-0.1.0-persistence.json` at
`sha256:51932d4165afff3c40fae6769527e480f6d0ff355f3fbc6d8ae7c6809e50a6fe`, with reviewed report
`docs/proof/EDITOR-CORE-PERSISTENCE.md`. The exact 40,099-byte M08-T09 artifact is
`docs/proof/artifacts/editor-core-0.1.0-continuous-validation.json` at
`sha256:7739b5143685d613a678c6eca5480f27a5a303b176bf2bf4613a4d6917fe7e5a`, with reviewed report
`docs/proof/EDITOR-CORE-CONTINUOUS-VALIDATION.md`. Its 62,890-byte proof reader is pinned at
`sha256:f3b27812aae9b3e4a3d74ccb9cda7aac7749c560257f33003eb66d5041dd1b5f` and its 10,840-byte
root reader at `sha256:f1b415d0dc41f755649f1ddd345ba1454e8695b9971e0afbc4032fc7d348d2b5`.
The exact 325,549-byte M08-T10 artifact is
`docs/proof/artifacts/editor-core-0.1.0-terminal-integration.json` at
`sha256:5787479d699ab8f53b739e633bf9a88900da00ae4f4c78f96b3e62a73133fa1b`, with reviewed report
`docs/proof/EDITOR-CORE-TERMINAL-INTEGRATION.md`. Historical sequence 38 pins its initial 84,005-byte proof reader at
`sha256:46354aae84ddf65314ad3cd8cfbefc33245e4de495ecda577ca296185f749ca2` and its 13,088-byte
root reader at `sha256:f1cd04fbccbba01469bfbacad3154c2ba99e130745dbbd1bcf0397230982dff9`.
The exact 12,118-byte M09-T01 artifact is
`docs/proof/artifacts/desen-app-0.1.0-shell-navigation.json` at
`sha256:c3189ff9196f0da91311156893ab569a3c9f9c1ee62631b58286647f36d23220`, with reviewed report
`docs/proof/DESEN-APP-SHELL-NAVIGATION.md`. It records 24 tracked task files, including five
repository-owned SVG assets, and 43 runtime cases. The focused application suite passes 43/43 and
the independent root mutation suite passes 8/8. These local task receipts and sequence 40 make no
required-gate or hosted M09-T01 claim.
The exact 25,375-byte M09-T02 artifact is
`docs/proof/artifacts/desen-app-0.1.0-catalog-panel-layer-tree.json` at
`sha256:85a310feaf1a0cc3656055cd3a76eeb02e02a278c21d22167853b53c03f1ee61`, with reviewed report
`docs/proof/DESEN-APP-CATALOG-PANEL-LAYER-TREE.md`. The focused authoring suite passes 18/18 and the
independent root proof passes 8/8. These local task receipts and sequence 41 make no required-gate
or hosted M09-T02 claim.
The exact 73,111-byte M09-T03 artifact is
`docs/proof/artifacts/desen-app-0.1.0-real-adapter-canvas.json` at
`sha256:8f89b237c20d80e83d96f17c31146d251c026977a4fff1ab1d0822e489c63151`, with reviewed report
`docs/proof/DESEN-APP-REAL-ADAPTER-CANVAS.md`. Its 73,183-byte proof reader is pinned at
`sha256:e6ff92ffd774edab9cd38a852be67145fa048df79dcf38ff8740d94b522b1f18` and its 22,347-byte root
reader at `sha256:03a61e2e2ab976f090e258210ac3851d06c8a0b067d46ebb109426b21aa66946`. The focused canvas suite
passes 20/20 and the independent root proof passes 11/11. These local task receipts and sequence 42
make no required-gate or hosted M09-T03 claim.
The exact 11,997-byte M09-T04 artifact is
`docs/proof/artifacts/desen-app-0.1.0-selection-overlay.json` at
`sha256:9a3805545ea49820c744fc07b9c3b0c2919b3e2fb524f9855df1cec9058901b1`, with reviewed report
`docs/proof/DESEN-APP-SELECTION-OVERLAY.md`. The focused selection suite passes 27/27 and the
independent root proof passes 10/10. These local task receipts and sequence 43 make no required-gate
or hosted M09-T04 claim.
The exact 22,998-byte M09-T05 artifact is
`docs/proof/artifacts/desen-app-0.1.0-schema-inspector.json` at
`sha256:473ab3248ed7b7b4de0e558df47159a74c28c134b46569aa91130745fd69660b`, with reviewed report
`docs/proof/DESEN-APP-SCHEMA-INSPECTOR.md`. The focused Inspector suite passes 41/41, the complete
App suite passes 86/86, and the independent root proof passes 10/10. These local task receipts make
no reader-checkpoint, required-gate, or hosted M09-T05 claim.
The exact 26,133-byte M09-T06 structured-Inspector artifact is
`docs/proof/artifacts/desen-app-0.1.0-structured-inspector.json` at
`sha256:6ea4eb3f51fdfc39eeca676d7ebafb145d66a9efdfa03af9c33a7aa39aa6aaec`, with reviewed report
`docs/proof/DESEN-APP-STRUCTURED-INSPECTOR.md`. Its 59,817-byte proof reader is pinned at
`sha256:9075433fd20436f6ae79075470722fe8e23ee65fe82f2347ac151ef25667d729`, and its 23,934-byte root
reader at `sha256:835162247f14fe5183a31ec9c806cd23f0c3dfeb43515afe622b539637c9970e`.
The focused structured-Inspector suite passes 73/73, the complete App suite passes 118/118, and the
independent root proof passes 10/10. These local task receipts make no required-gate or hosted
M09-T06 claim.
The exact 24,830-byte M09-T07 named-slot-authoring artifact is
`docs/proof/artifacts/desen-app-0.1.0-named-slot-authoring.json` at
`sha256:daae817af45d8ead7052fd84df4edefd7d29cdd9ebe9cc1baea5b22b27dae90f`, with reviewed report
`docs/proof/DESEN-APP-NAMED-SLOT-AUTHORING.md`. The focused named-slot suite passes 70/70, the
complete App suite passes 151/151, and the independent root proof passes 9/9. Dynamic state/binding
and event/action authoring, Design/Run, durable save/open, browser E2E, publication, and activation
remain unproven; P-08 remains `NOT_PROVEN`. These local task receipts make no required-gate or
hosted M09-T07 claim.
The exact 28,766-byte M09-T08 state-binding-editor artifact is
`docs/proof/artifacts/desen-app-0.1.0-state-binding-editor.json` at
`sha256:b7298375cba4b82258d1c293ecb66c3ae6641408ae9f5753da121ac44fcf601a`, with reviewed report
`docs/proof/DESEN-APP-STATE-BINDING-EDITOR.md`. The focused state-binding suite passes 109/109, the
complete App suite passes 181/181, the independent root proof passes 9/9, and the final structural
suite passes 278/278. Event/action authoring, Design/Run, durable save/open, real-browser E2E,
publication, and activation remain unproven; P-08 remains `NOT_PROVEN`. These local task receipts
and sequence 47 make no required-gate or hosted M09-T08 claim.
The exact 23,812-byte M09-T09 event-action-editor artifact is
`docs/proof/artifacts/desen-app-0.1.0-event-action-editor.json` at
`sha256:0060ef39273ea36666f1701d5d3fa0f1610b95f40d88304ba980dcdc73cb29ab`, with reviewed report
`docs/proof/DESEN-APP-EVENT-ACTION-EDITOR.md`. The pure projection, panel, focused event/action,
complete App, and independent root suites pass 12/12, 7/7, 84/84, 202/202, and 10/10. The complete
structural CI receipt passes 282/282. Action execution, Design/Run, durable save/open, real-browser
E2E, publication, and activation remain unproven; P-08 remains `NOT_PROVEN`. These local task
receipts and sequence 48 make no required-gate or hosted M09-T09 claim.
The exact 17,900-byte M09-T10 Design/Run modes artifact is
`docs/proof/artifacts/desen-app-0.1.0-design-run-modes.json` at
`sha256:bc5b7ffef0c39737882072f9340bcade86f084db8e7923fcb03aa7364d077334`, with reviewed report
`docs/proof/DESEN-APP-DESIGN-RUN-MODES.md`. The focused Design/Run, complete App, independent root,
checkpoint, and complete structural suites pass 44/44, 210/210, 10/10, 72/72, and 339/339.
Fixtures/scenarios, durable persistence, diagnostics, publication/activation, and real-browser E2E
remain explicitly unproven; P-08 remains `NOT_PROVEN`. These local task receipts and sequence 49
make no required-gate or hosted M09-T10 claim.
The exact 29,407-byte M09-T11 fixtures/scenarios/fidelity artifact is
`docs/proof/artifacts/desen-app-0.1.0-fixtures-scenarios-fidelity.json` at
`sha256:3f08980e687d48ba267f78c7d4dd1ae1eb59db5cc6bb3401d88705ee0416cc9d`, with reviewed report
`docs/proof/DESEN-APP-FIXTURES-SCENARIOS-FIDELITY.md`. The focused fixtures/scenarios/fidelity,
complete App, and independent root suites pass 86/86, 252/252, and 11/11. Durable persistence,
diagnostics, publication/activation, automated real-browser E2E, and native-drag automation remain
explicitly unproven. P-08 remains `NOT_PROVEN`, P-09/P-10 remain `PARTIAL`, N-036 remains
`PLANNED`, and PF-025/PF-083/PF-089 remain `OPEN`. These local task receipts make no required-gate
or hosted M09-T11 claim. Sequence 50 advances
`45ed64e604400f18b15b3b4ef44bc35634a6c1567b46174329ec36529168272e` to
`6abea41064a05efe363df0f66d1e7d1b4923af08f819acf4c266b092985192a4` across 46 artifacts and
92 readers. The checkpoint, promotion, selector plus required-affected, ownership, and remaining
touched-CI regression suites pass 73/73, 19/19, 56/56, 15/15, and 127/127 locally.

M09-T13 registers `desen-app-node-linked-diagnostics` as the 94th proof pair. Its package-level
generate/verify/test prefix runs only the App build, App typecheck, and focused diagnostics suite;
the eleven frozen Runtime, Editor Core, and App parent verifiers are not nested and repeated there.
Their fresh authority is represented only by the affected impact graph. Because the M05-T05
Runtime diagnostic index joins the prior App-connected graph, the exact T13 closure is 62 proof
units and 134 workloads at
`sha256:9cb1af988b5a6c400ebe8e2123bb9c1bbbac3ac529621cee697ce3f93a0bea9d`.

The current exhaustive authority contains 198 workloads and 94 proof pairs—83 ordinary and eleven
barriers. The neutral inventory is
`sha256:d3b479cc998d6c84d53b9b0d64e6121033d94bbf9b502fcb9e7adc2487b3d908`; the retained sequential
plan is `sha256:5dbd8f1365a731846ece0e64888b69eb9607540c09dfb4444e990b8ff030d502`;
the semantic impact graph is
`sha256:b6fae5194e9dd837d05e1ce44808d6b8054742b564420b42901a39e23d4581b1`.
The canonical required workload set and ordered projection are
`sha256:a130f30f92d68b5d2b7a5d738fd5c7a47dc568e43356c19dc8986e1e7ef443e5` and
`sha256:dcac647bc7ac839e9a54cfcd246f24aab8fc1b83404114f9ec2d32a9fb1b7c7c`.

Ownership covers 1,253 tracked paths, including 188 proof-owned paths. The path-set and ownership
pins are `sha256:372a30ee1f8db5b7d1a35e7fd0b46335513724c59bdfa0540513be2e1938d492`
and `sha256:7d5a90e56b4b32e2d7e1a0306b09669855642b30558155dba9a07f1ccf7da7a3`.
Category counts are 188 proof-unit, 45 CI-policy, 31 dependency-policy, 138 frozen-input, 485
package/application, 225 shared-proof-infrastructure, 130 project-documentation, and eleven
repository-policy paths. The focused inventory, impact, shared-state, equivalence, exhaustive,
ownership, and selector suites pass 9/9, 27/27, 27/27, 8/8, 30/30, 15/15, and 22/22. The
append-only current-reader checkpoint advances sequence 51 head
`sha256:42e88946b598566a46237af8d30587fa765d9d58807e864464fc5525fbc64921` to sequence 52 head
`sha256:c42b0c0fe010b04128a31f26b25a5875e72b7566fa64403d0223b4dbada478a9` across 48 frozen
artifacts and 96 current readers. Promotion pins the selector at
`sha256:872a061aeea1afe9f82f7578f0fa3cbcfe037a982fde40116e2c88c7e366e2e7` and the required-affected
runner authority at `sha256:1e08a5db4dc33d684a1e119a88dc5bd4f99e5b98cd0e468a81327c709c3ac2bb`.
Checkpoint, promotion, selector, required-affected, and CI quality-gate regression suites pass
75/75, 20/20, 22/22, 38/38, and 28/28 locally—183/183 combined. These are local-authority receipts
and make no required-gate or hosted-CI claim.

The exact 29,208-byte task artifact is
`docs/proof/artifacts/desen-app-0.1.0-node-linked-diagnostics.json` at
`sha256:8ac4d81d9097e188860757c637673ff406ba9f82b8cd8f379f184ef85138e972`, with reviewed report
`docs/proof/DESEN-APP-NODE-LINKED-DIAGNOSTICS.md`. Focused diagnostics, complete App, and root
mutation suites pass 161/161, 339/339, and 12/12. P-16 is `PROVEN`; PF-086 remains `OPEN`;
implementation progress is 108/145 (74%), M09 is 13/14 (93%), proof gates remain 10/13, and
M09-T14 is next.

M09-T14 registers `desen-app-publish-activation` as the 95th proof pair. Its package-level prefix
runs only the public Editor Web build, typecheck, publication, and emitted-package checks followed
by the App build, typecheck, and focused publication suite; its nine frozen parents are represented
by the affected impact graph instead of being recursively replayed inside the wrapper. The exact
T14 connected closure is 63 proof units and 136 workloads.

The current exhaustive authority contains 200 workloads and 95 proof pairs—84 ordinary and eleven
barriers. The neutral inventory is
`sha256:c6655119e0b24594bced92b6b916917e0f336351c19cf338ee21d3b8d141f684`; the retained sequential
plan is `sha256:beeda57842e1a9bdee6a13cd7be323b48a722ce4352319d085886b7fc76bfefe`;
the semantic impact graph is
`sha256:4a2e2d7d4d15a8f3d563aee7b248b14bba6ce44c27b464773a825d9c44fc58bf`. The canonical required
workload set and ordered projection are
`sha256:0eb90130ebcf32072ba7188ce6937fc65e1d2d11ffb5dceefb1e9cb2a0066813` and
`sha256:4006f34222b00bfa6095bf7019fb7fef194f9b3a30f67f5b3ecefe599729e45a`. Required and shadow
plans are pinned at `sha256:cd96c112e64d37beaba7ffb75e45beb91280ffa917f3b1916d5aa059346fcaea`
and `sha256:a65b567ab999136e2018d970809b94e9e054ed57dc2ad8855267acc0f2b07b3c`.

Ownership covers 1,267 tracked paths, including 190 proof-owned paths. The path-set and ownership
pins are `sha256:e8e1841e828a63bf84d57e457047ffaef7e6ca1998b6e7c89201758d44dec5f5` and
`sha256:18497e4c50dd0dfa8f8dd7adaf9b6130779db7c0799798ef99e3de8bcf764486`.
Category counts are 190 proof-unit, 45 CI-policy, 31 dependency-policy, 139 frozen-input, 493
package/application, 227 shared-proof-infrastructure, 131 project-documentation, and eleven
repository-policy paths.

The historical append-only sequence 53 checkpoint advances sequence 52 head
`sha256:c42b0c0fe010b04128a31f26b25a5875e72b7566fa64403d0223b4dbada478a9` to
`sha256:48a1457317c593b846cd4750eb309e846c33248824559d27810441584f0144d8` across 49 frozen
artifacts and 98 current readers. Compatibility sequence 54 is the immutable predecessor: it
preserves those artifact and reader identities, advances the exact sequence-53 head to
`sha256:0772221371ffe1a35fe955b8cad34c725d0f9ae933714f81f10b3451214a6638`, and reseals only
M08-T08 proof-library/root-test readers `[64, 65]`. Its frozen 49,785-byte artifact remains
`sha256:51932d4165afff3c40fae6769527e480f6d0ff355f3fbc6d8ae7c6809e50a6fe`. Sequence 55
preserves the same 49 frozen artifacts and 98 reader identities, links that exact sequence-54
predecessor head to `sha256:f1ac24425ca2372410835a6c5721057763792010aaf77ccc78b8d30636333a17`,
and reseals only M09-T01–T14 proof-library/root-test reader indexes `[70..97]`. The current T14
readers authenticate the exact `10,000 ms` per-test timeout successor at
`sha256:5eba8a2b15cbcf992d0f04d0d7ad719c1a9fc42cdb66635ebc0eab679a221901`; reversing that one
edit reproduces the frozen 24,485-byte test receipt, while the frozen T14 artifact remains
`sha256:6bd2db0ca490f1d0046f145da7c4b7e9b4b25ec0f8295a159529a0e66534b23b` unchanged. Checkpoint,
promotion, selector, and fourteen M09 root reader suites pass 78/78, 20/20, 23/23, and 179/179.
Promotion pins the selector at
`sha256:2855cbeedb55ede5d9db18a6b186ac07796afbc4d512f5a0aa9197bc5f177fd1`, the
required-affected runner authority at
`sha256:b77b35a81915ec41554ab3505895fe98c0a4299ec9bf7d680dec320bbf3fb744`, and the T10 affected
plan at `sha256:e3cced8e1a9cbe6f1f5c296aa3992b07ef030c81ac9267c2deff714953ce0e39`. The integrated
legacy, inventory, impact, ownership, selector, shared-state, equivalence, required-affected,
required-exhaustive, promotion, and checkpoint policy suite passes 330/330; the checkpoint and
promotion CLI verifiers also pass.

The exact 24,763-byte task artifact is
`docs/proof/artifacts/desen-app-0.1.0-publish-activation.json` at
`sha256:6bd2db0ca490f1d0046f145da7c4b7e9b4b25ec0f8295a159529a0e66534b23b`, with reviewed report
`docs/proof/DESEN-APP-PUBLISH-ACTIVATION.md`. Focused App publication, Editor Web publication,
emitted public-package runtime, and independent root mutation suites pass 31/31, 10/10, 4/4, and
12/12. The same closure records the user-requested authoring compatibility repair: dedicated Layers
and Components grips are `28 × 32 px` and `32 × 32 px` without layout shift; stable,
non-overlapping, full-width `20 px` Layers lanes directly own boundary events with row-half fallback
and innermost-slot fencing; the sticky Components `Drop target` directly owns drop while the
authenticated panel remains a same-target fallback; and `Add` immediately selects the new node so
the visible guarded `Remove layer` and Delete/Backspace paths remain available. This is not
automated native-drag or real-browser E2E evidence; those remain M10-T01 work. These local authority
receipts make no required-gate or hosted-CI claim. M09-T14 and G09 are `DONE`; implementation
progress is 109/145 (75%), M09 is 14/14, proof gates are 11/13, and M10-T01 is next.

M09-T12 focused persistence, complete App, and root mutation suites pass 5 files/142 cases,
22 files/324 cases, and 12/12 locally. The current exhaustive authority contains 196 workloads and
93 proof pairs—82 ordinary and 11 barriers—with a 60-proof-unit/130-workload closure and ownership
over 1,243 tracked paths, including 186 proof-owned paths. These are local-authority receipts and do
not claim a required gate or hosted result. Sequence 51 advances exact predecessor
`6abea41064a05efe363df0f66d1e7d1b4923af08f819acf4c266b092985192a4` to
`42e88946b598566a46237af8d30587fa765d9d58807e864464fc5525fbc64921` across 47 artifacts and
94 readers. The checkpoint, promotion, selector plus required-affected, ownership, and remaining
touched-CI regression suites pass 74/74, 19/19, 58/58, 15/15, and 128/128 locally (294/294
combined).
The exact 27,053-byte M09-T12 Source-persistence artifact is
`docs/proof/artifacts/desen-app-0.1.0-source-persistence.json` at
`sha256:717d0ddada008edb34909d5defcc4c28e95b36f6dfc0b1abb4d09d9775a6b734`, with reviewed report
`docs/proof/DESEN-APP-SOURCE-PERSISTENCE.md`. The focused persistence, complete App, and independent
root mutation suites pass 5 files/142 cases, 22 files/324 cases, and 12/12 tests. The App consumes
only the trusted-host-injected public Editor Core port; a concrete adapter, publication/activation,
node-linked diagnostics, and automated real-browser E2E remain unproven. These local task receipts
make no required-gate or hosted M09-T12 claim.
The historical T07-integrated CI infrastructure suite
passed 265/265; its dedicated checkpoint, required-affected, promotion, and retained legacy-gate
suites passed 58/58, 27/27, 19/19, and 25/25 respectively. The M08-T10-integrated CI infrastructure suite
passes 302/302; the terminal-integration root proof and checkpoint suites pass 10/10 and 62/62.
Those T10-integrated local receipts make no hosted M08-T10 claim. The M09-T01 commit-tree CI suites
pass 136/136 and their shared-state/root-gate units pass 52/52; required-gate and hosted results
remain unclaimed until observed. The M09-T03 focused CI infrastructure suite passed 196/196 and
the complete structural CI glob passed 314/314 under its historical local authority. The historical
M09-T04 complete structural CI glob passes 317/317. M09-T05-focused Inspector, complete App, root,
sequence-44 checkpoint, and complete structural suites pass 41/41, 86/86, 10/10, 67/67, and
320/320. Sequence 44 is pinned at
`f0c5f3bfbc30ccf230c5256b3a5672c29ffa0e884129ae210571895bd063812c` with 40 artifacts and 80
readers. These are local authority receipts and do not claim a required gate or hosted result.
M09-T06-focused structured-Inspector, complete App, root, and sequence-45 checkpoint suites pass
73/73, 118/118, 10/10, and 68/68 locally. The CI-policy sub-suite passes 270/270, and the complete
structural glob passes 323/323. These are local authority receipts and do not claim a required gate
or hosted result. Sequence 45 is pinned at
`340460237dd173995d4d0fa158f0e4c6c54b76d55958757d742a981466fd213f` with 41 artifacts and 82
readers.
Historical M09-T07-focused named-slot, complete App, root, and sequence-46 checkpoint suites passed
70/70, 151/151, 9/9, and 69/69 locally. The historical complete structural glob passed 329/329.
These are historical local-authority receipts and do not claim a required gate or hosted result.
Sequence 46 remains pinned at
`f09ec643d1b2756174ca47fae99837a68f6656bec0c6933e566d5075713a0f5f` with 42 artifacts and 84
readers.
Historical M09-T08-focused state-binding, complete App, and root suites pass 109/109, 181/181, and 9/9
locally. The final structural suite passes 278/278. These are local-authority receipts and do not
claim a required gate or hosted result. Sequence 47 is pinned at
`c28ba9a9f274ac0bc3f7dc7ed6de51df35128b109b374b563f5c0239891f58f7` with 43 artifacts and 86
readers.
M09-T09 pure projection, panel, focused event/action, complete App, root, checkpoint, and structural
suites pass 12/12, 7/7, 84/84, 202/202, 10/10, 71/71, and 282/282 locally. These are
local-authority receipts and do not claim a required gate or hosted result. Sequence 48 is pinned
at `5ecf9e630e2c91cb97a7c85c60e8318fdf694039711a64bf1797e481aca0ff90` with 44 artifacts and 88
readers.
M09-T10 focused Design/Run, complete App, root proof, checkpoint, required-affected,
required-exhaustive-equivalence, required-exhaustive-runner, promotion, selector, and complete
structural suites pass 44/44, 210/210, 10/10, 72/72, 35/35, 8/8, 30/30, 19/19, 19/19, and
339/339 locally. These are local-authority receipts and do not claim a required gate or hosted
result. Sequence 49 is pinned at
`45ed64e604400f18b15b3b4ef44bc35634a6c1567b46174329ec36529168272e` with 45 artifacts and 90
readers.
M09-T11 focused fixtures/scenarios/fidelity, complete App, and root proof suites pass 86/86,
252/252, and 11/11 locally. The then-current exhaustive authority contained 194 workloads and 92 proof
pairs—81 ordinary and 11 barriers—with a 59-proof-unit/128-workload closure and ownership over
1,232 tracked paths, including 184 proof-owned paths. These are local-authority receipts and do not
claim a required gate or hosted result. Sequence 50 advances exact predecessor
`45ed64e604400f18b15b3b4ef44bc35634a6c1567b46174329ec36529168272e` to
`6abea41064a05efe363df0f66d1e7d1b4923af08f819acf4c266b092985192a4` across 46 artifacts and
92 readers. The checkpoint, promotion, selector plus required-affected, ownership, and remaining
touched-CI regression suites pass 73/73, 19/19, 56/56, 15/15, and 127/127 locally.

The corrective M09 compatibility successor updates the current Web–React package digest to
`sha256:d4a4e7e2ea2d68ab8bff085d90e093f2d31b784f0f2fb089c6422ce33914b051` for 80 regular
distribution files/243,740 bytes and 81 framed entries/252,637 framed bytes. The current
official-derived Bundle revision is
`sha256:6e539a76ddd0bc9b4eff82e73508b62a3980ae5dbc73dd85ccf0c1cae6957e13`; the Source digest
remains `sha256:b8e2d6bac855fb307aaeb0636becf93834f6faeda5464bdbfbc1e8d52f379635`.
Append-only sequence 56 advances the exact sequence-55 head to
`sha256:1a2049082f981614c33fb2f1576cfd8d52e9dbd6dbb44f5177d3cf290064c51a` while preserving all
49 frozen artifacts and 98 reader identities. This reseal rewrites no historical artifact or pin,
makes no hosted-CI claim, and does not advance M10 beyond 0/9.
