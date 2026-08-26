# Proof infrastructure

This directory contains the I07 proof-execution authority. I07-02 completed the exhaustive hosted
cutover, and I07-04 completed required affected promotion: the official `Quality gate` now uses the
required dispatcher defined here. An authenticated eligible same-repository pull request may run
fresh affected scope; every unsafe boundary, plus `main`, release, and manual audit, remains fresh
exhaustive. The CI-01 sequential runner remains available only through explicit manual rollback.

## Trust layers

1. Frozen task artifacts preserve the exact task-time claim and nonclaim boundary.
2. `proof-reader-checkpoints.json` records reviewed live reader hardening without rewriting those
   artifacts.
3. `exhaustive-workload-inventory.mjs` is the neutral, code-owned authority for the live exact
   155-node, 73-proof-unit workload graph. It owns exact commands, arguments, dependencies, execution
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
workloads and 72 proof pairs. The current M08-T02 append-only successor contains 155 workloads, 73
proof pairs, 499 prerequisite segments, 3,155 ordered leaf invocations, and 245 distinct leaf
workloads. Its neutral inventory is
`sha256:c834f3d962f11245c3a053c4e31b60d8afb7f92c14d6faa35132cd79e9064e7a`, and its required plan is
`sha256:481fbfa98513a4dec2c04421b6710d09ad6f6bedc35f37a66d1f8b27f902ee22`. These current pins make no
hosted M08-T02 claim.

The pre-promotion M07-T11 shadow-selector comparison authority was
`sha256:ee0cda5b4871ce2e169a958eefd60299197dbf261c0163335cd759e814067dbf`.
The frozen I07-03 baseline remains historical. I07-04 has independently authenticated `20 / 20`
eligible hosted comparisons with zero false negatives; promotion and hosted cutover are complete.
The I07-04 baseline remains byte-identical and historical. Its verifier authenticates that frozen
promotion receipt first, then separately admits only the exact M08-T02 current-authority successor,
whose comparison digest is
`sha256:f40a2f4180ec3ebb48c617ea403008507d71580a8380cf26a12f5e1cce82603b`.

The complete current reviewed digest set is:

- prerequisite inventory:
  `0e4031fb92d5fca303d0e6e6cfa0a175503166ceb8c6426a49c372a62ada317d`;
- ordered legacy leaves:
  `60d2ece0dda9b266a3df259fac1e5977b3da592b265839d8bc58b86f25d29e6f`;
- distinct leaf workloads:
  `4d9b00c2080fd1c9693d8ca9e939bcb1910c20a42e7d50a73f9bd9c2cf053ceb`;
- 15 workspace test scripts:
  `0faa6116c99d11f6d059a224de6b08a723657b5c5690a3138e6290d240524820`;
- retained sequential plan:
  `13d51b2512dd3d10264a7a329f4b4923461c368d71400310647e4adc9933d2c5`;
- neutral inventory:
  `c834f3d962f11245c3a053c4e31b60d8afb7f92c14d6faa35132cd79e9064e7a`;
- workload-id set:
  `1ce7d20e795f5faad84ec0b60bcf3de38283362d1fbf84161856f44b0da3e1f0`;
- ordered equivalence projection:
  `09e0b8b4288f2f03f695f14c6858b0b4f743d7b4b4e560973170b3a47a677add`;
- required plan:
  `481fbfa98513a4dec2c04421b6710d09ad6f6bedc35f37a66d1f8b27f902ee22`; and
- shadow plan:
  `b052a8b14f431a42f2bac9181f9544a1ed0d2af0fdd5022afc56e1a5d050dd09`.

Every workload has exactly one code-owned shared-state class:

| Execution class                  | Count | Authority                                            |
| -------------------------------- | ----: | ---------------------------------------------------- |
| `GLOBAL_EXCLUSIVE`               |     6 | Repository-wide integrity and boundary barriers      |
| `WORKSPACE_OUTPUT_EXCLUSIVE`     |     2 | Workspace and public-package output writers          |
| `PACKAGE_TEST_EXCLUSIVE`         |     1 | Complete workspace package-test barrier              |
| `PROOF_READ_ONLY`                |    69 | Proof work with no shared workspace writes           |
| `PROOF_OS_TEMP_ISOLATED`         |    66 | Proof work restricted to a runner-owned OS temp root |
| `PROOF_TRACKED_ALIAS_EXCLUSIVE`  |    10 | Real tracked aliases with a drained scheduler        |
| `PROOF_WORKSPACE_TEMP_EXCLUSIVE` |     1 | The direct source-audit workspace-temp barrier       |

Sixty-two proof pairs are eligible for pair-level overlap at concurrency two after all dependencies
pass. Ten real tracked-alias pairs and `reference-host-web-source-audit` are the eleven exclusive
proof-pair barriers. Within every pair, the root test still depends on its verifier.

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
- `reference-host-web-channel-consumption`.

Native-addon authority is limited to the exact `reference-host-web-source-audit` verifier/root-test
pair, the `publisher-invalid-source-matrix` root test, and the exact `control-plane-local-api`,
`control-plane-runtime-activation`, `control-plane-runtime-recovery`, and
`control-plane-runtime-fault-injection` verifier/root-test pairs plus only the
`control-plane-runtime-transition-races` and `reference-host-web-channel-consumption` verifiers.
Both root proofs receive no native-addon grant.
The source-audit verifier remains workspace-read-only; its root test is the sole workspace-temp
barrier. The publisher root loads only the reviewed Rolldown binding, and the control-plane pairs
load only their reviewed SQLite binding.

Node 24 requires an orthogonal filesystem-compatibility policy for eighteen exact root tests. The
distribution across all 155 workloads is 137 `NONE`, two `FIXTURE_COPY`, fifteen
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
bytes, executable modes, tracked-file count, and Git index object ids before and after all 155
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
artifacts and 50 readers. The current append-only authority is sequence 30 at
`1887996f51318a3a0f7f753d12c0a78b22df30fb005daaa2a69897999d05b654`, authenticating 27 frozen
artifacts and 54 current readers. [Cleanup PR #36](https://github.com/desenlab/desen-app/pull/36)
passed fresh `REQUIRED + EXHAUSTIVE` in
[run 31674300000, job 94365383803](https://github.com/desenlab/desen-app/actions/runs/31674300000/job/94365383803),
and its landed `main` revision passed the same authority in
[run 31675234655, job 94368259305](https://github.com/desenlab/desen-app/actions/runs/31675234655/job/94368259305).
The one-file [canary PR #37](https://github.com/desenlab/desen-app/pull/37) passed fresh
`REQUIRED + AFFECTED` in 3m54s in
[run 31676049922, job 94370743935](https://github.com/desenlab/desen-app/actions/runs/31676049922/job/94370743935),
selecting and closing 10 workloads for one proof unit as a strict subset without cached success.
All 17 G07-due entries are `CLOSED`; `DEBT-I07-007` remains `OPEN` for I07-05. I07-04 and G07 are
`DONE`; proof gates are 8/13, implementation is 87/145, and M08-T03 is next.
