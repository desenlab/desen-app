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
   184-node, 87-proof-unit workload graph. It owns exact commands, arguments, dependencies, execution
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

The current M09-T06 successor contains 184 workloads and 87 proof pairs. Its legacy projection
contains 649 prerequisite segments, 4,427 ordered leaf invocations, and 293 distinct leaves, pinned
at `sha256:c9f90ee01326cd470d7f3f55518076334070dc29bbeb6282fa635a685584ab00`,
`sha256:e2f99d148a89ac2eb2d61014141519f5e00d435cf25f2dab8a92af42ac0cd853`, and
`sha256:e1d58f02e373a4f7f99c923d63b54f9027ee5908d567667e41f1b1be3310c1b4`. These reviewed local
pins make no required-gate or hosted M09-T06 claim.

The pre-promotion M07-T11 shadow-selector comparison authority was
`sha256:ee0cda5b4871ce2e169a958eefd60299197dbf261c0163335cd759e814067dbf`.
The frozen I07-03 baseline remains historical. I07-04 has independently authenticated `20 / 20`
eligible hosted comparisons with zero false negatives; promotion and hosted cutover are complete.
The I07-04 baseline remains byte-identical and historical. Its verifier authenticates that frozen
promotion receipt first. The exact M08-T10 comparison digest
`sha256:8dc47b6160cbe8e27fc66b2462f27582385a196f2cb839c7184a86562040aafb` remains historical;
the M09-T01–M09-T05 successors also remain historical, while the M09-T06 comparison and
promotion-compatibility receipts are recorded by their live checks.
The historical M08-T05 comparison digest remains
`sha256:41b08d79888fbf3f79f7358ddd02af3bf17d677e9b37c94d58b06d267ad4ced2`.

The current reviewed T06 digest set available at this local task-proof checkpoint is:

- prerequisite inventory:
  `c9f90ee01326cd470d7f3f55518076334070dc29bbeb6282fa635a685584ab00`;
- ordered legacy leaves:
  `e2f99d148a89ac2eb2d61014141519f5e00d435cf25f2dab8a92af42ac0cd853`;
- distinct leaf workloads:
  `e1d58f02e373a4f7f99c923d63b54f9027ee5908d567667e41f1b1be3310c1b4`;
- 16 workspace test scripts:
  `4d7c4232cc0e31519f2f58e9ebeb355405e493594406aee99ed2a78ce0c796ab`;
- retained sequential plan:
  `480dc1ac119e1d939823d969e8e5add34504a7130345528263c8a6e8d59e164f`;
- neutral inventory:
  `68494f504cae698e253966c8f5a4b4917c96c166bdada22a422c0cbe0fe5e38b`;
- workload-id set:
  `f1e9119f3fd1529a0d5fef530401631470dd41d2eb2e2182130f672ff892b7c5`;
- ordered equivalence projection:
  `a0bfb6171496c98c91d98b29f901511561d130b300aec432e679681a10de35d4`;
- selector-only impact graph:
  `a02725aa4c74e553766b561b535e5be44f67fe74abe9c98188f265fd2fb33fb1`;
- M09-T06 connected closure:
  54 proof units and 118 workloads at
  `5ccac855e50f6fe0b3b17f1d36b5dd72ac4657132bf9ee7280f5fe8cf297d5ec`;
- affected ownership:
  1,184 paths at `08fb84419e3e77382cb2a88f1077b3b8804a9ced2759c50b92bff4f0b3644d58`, with
  174 proof-owned reader paths and projection
  `8c2470bb1c835ab1359366960908b2ffc8a8dfa384061c37f511aad6cc91d2ef`;
- ownership categories (`PROOF_UNIT`, `CI_POLICY`, `DEPENDENCY_POLICY`, `FROZEN_INPUT`,
  `PACKAGE_OR_APPLICATION`, `SHARED_PROOF_INFRASTRUCTURE`, `PROJECT_DOCUMENTATION`,
  `REPOSITORY_POLICY`): `174 / 45 / 31 / 131 / 458 / 211 / 123 / 11`;
- required plan:
  `89c68ec52affb10717459bb2dea41cd1608af2b43212db7dc54bdaaab95f1433`;
- shadow plan:
  `82f62e41ac973b45b17cc94fd0ab811807be548610c9b588669ee6bd259e82f6`;
- current selector authority:
  `0fda33f0ea32214f0a20adb666d9abefd57fcdfcc4e5aa03401a6be7d3ecec2a`;
- current required-runner authority:
  `7ed5299efa270cc8e17c8411827a4370f4128ab955d6ea5da6a6f3fe4f752081`, independently reviewed
  rather than inferred from selector success;
- frozen promotion selection equivalence and observation threshold:
  `97cc1b29553f1bf3d92386e399c76f2f9c21e73a1c8073a15a9465f7c4fcf698` and
  `ca6ee4128f2dbc581d033ebabe8e437268c8f7c5b29d6fbc7f9e3fb031b6c23c`;
- sequence-45 proof-reader checkpoint:
  `340460237dd173995d4d0fa158f0e4c6c54b76d55958757d742a981466fd213f` across 41 artifacts and
  82 current readers; and
- promotion artifact:
  `76a29908843c0bb9a4ca5ad74b5bc94383c3fa21463ce81e98bf53e8f01d7549`.

Every workload has exactly one code-owned shared-state class:

| Execution class                  | Count | Authority                                            |
| -------------------------------- | ----: | ---------------------------------------------------- |
| `GLOBAL_EXCLUSIVE`               |     6 | Repository-wide integrity and boundary barriers      |
| `WORKSPACE_OUTPUT_EXCLUSIVE`     |     3 | Workspace and public-package output writers          |
| `PACKAGE_TEST_EXCLUSIVE`         |     1 | Complete workspace package-test barrier              |
| `PROOF_READ_ONLY`                |    74 | Proof work with no shared workspace writes           |
| `PROOF_OS_TEMP_ISOLATED`         |    89 | Proof work restricted to a runner-owned OS temp root |
| `PROOF_TRACKED_ALIAS_EXCLUSIVE`  |    10 | Real tracked aliases with a drained scheduler        |
| `PROOF_WORKSPACE_TEMP_EXCLUSIVE` |     1 | The direct source-audit workspace-temp barrier       |

Seventy-six proof pairs are eligible for pair-level overlap at concurrency two after all dependencies
pass. Ten real tracked-alias pairs and `reference-host-web-source-audit` are the eleven exclusive
proof-pair barriers. Within every pair, the root test still depends on its verifier.
The exact topology is eight serial prefix workloads, 76 ordinary proof pairs, eleven exclusive
proof-pair barriers, and two serial suffix workloads: `8 + (76 * 2) + (11 * 2) + 2 = 184`. The
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
semantic impact parent is `desen-app-schema-inspector`; the current connected closure contains 54
proof units and 118 workloads at
`sha256:5ccac855e50f6fe0b3b17f1d36b5dd72ac4657132bf9ee7280f5fe8cf297d5ec`. Its verifier is
`PROOF_READ_ONLY`; its root mutation test is `PROOF_OS_TEMP_ISOLATED` and receives only
`NODE_TEST_HARNESS`. Neither side receives workspace-write, listener-port, native-addon,
filesystem-compatibility, or verifier runtime-probe authority. Its local wrapper authenticates the
frozen M09-T05 artifact before the App build, typecheck, structured-Inspector suite, verifier, and
root proof.

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
distribution across all 184 workloads is 166 `NONE`, two `FIXTURE_COPY`, fifteen
`REVIEWED_SYMLINK`, and one `FIXTURE_COPY_AND_REVIEWED_SYMLINK`. Fixture copy accepts only an exact
code-owned source and bounded no-follow destination tree inside the workload temp root. Reviewed
symlinks keep temp targets local and pin fourteen workspace-target workloads to eighteen exact
target-and-kind rules: eight unsafe-input files are mirrored into temp, while ten historical
canonical-path or inode checks retain their exact tracked aliases.

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

A code-owned 17-minute soft complete-gate timeout sits above the 15-minute workload timeouts. Authentic
settlement still awaits child `close`, cleanup, and boundary capture. Phase A therefore wraps the
command in an 18-minute operating-system ceiling with a 30-second kill grace, inside a 25-minute
hosted job. An outer-ceiling failure is never accepted as promotion evidence.

The execution boundary authenticates the repository revision and inventory and compares tracked
bytes, executable modes, tracked-file count, and Git index object ids before and after all 180
steps, including failure paths. The shared-state boundary also seals every reviewed build/Turbo
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
M08-T10, G08, and M09-T01–T06 are `DONE`; proof gates are 10/13, implementation is 101/145,
M08 is 10/10, M09 is 6/14, `N-012`, `N-014`, `N-018`, `N-042`, `S-002`, and `S-003` are `TESTED`,
P-06 and P-18 are `PROVEN`, P-08 remains `NOT_PROVEN`, and M09-T07 is next. The exact 30,014-byte
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
