# Proof infrastructure

This directory contains the I07 proof-execution authority. I07-02 completed the hosted cutover:
the official `Quality gate` now executes the required exhaustive runner defined here, while the
CI-01 sequential runner remains available only through explicit manual rollback.

## Trust layers

1. Frozen task artifacts preserve the exact task-time claim and nonclaim boundary.
2. `proof-reader-checkpoints.json` records reviewed live reader hardening without rewriting those
   artifacts.
3. `exhaustive-workload-inventory.mjs` is the neutral, code-owned authority for the live exact
   138-node, 65-proof-unit workload graph. It owns exact commands, arguments, dependencies, execution
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
successor changes no frozen artifact. The latest hosted run remains failed, so this is local-reader
evidence rather than hosted CI success; I07-04 still owns the compatibility-reader debt.

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
authority is an append-only successor: M07-T02 through M07-T05 each add one verifier/root-test pair
without rewriting that historical baseline. The preceding M07-T04 then-current receipt contained
136 workloads, 64 proof pairs, 415 prerequisite segments, 2,089 ordered leaf invocations, and 212
distinct leaf workloads. Its inventory was
`sha256:c4ee9d861f263757b6240a448b062896dcf358c42d499d338bc39d442750314e`, and its required plan is
historically pinned as
`sha256:6ca8631e4d3622c31259ffce82e1a29092789496a8c8479ba12d629efec63ed5`. The current M07-T05
successor contains 138 workloads, 65 proof pairs, 423 prerequisite segments, 2,209 ordered leaf
invocations, and 215 distinct leaf workloads. Its inventory is
`sha256:d26e9fa74f85be06852cd4f667467606735687e851ab03a6ef5611700c9ccc92`, and its required plan is
`sha256:4d26089fc10902513950f0051fb0d860a82c14374e426fd40b3259a43a63b466`. These are reviewed
local/code-owned successor pins; they do not claim a new hosted CI run has passed.

Every workload has exactly one code-owned shared-state class:

| Execution class                  | Count | Authority                                            |
| -------------------------------- | ----: | ---------------------------------------------------- |
| `GLOBAL_EXCLUSIVE`               |     6 | Repository-wide integrity and boundary barriers      |
| `WORKSPACE_OUTPUT_EXCLUSIVE`     |     1 | Workspace build/typecheck output writer              |
| `PACKAGE_TEST_EXCLUSIVE`         |     1 | Complete workspace package-test barrier              |
| `PROOF_READ_ONLY`                |    68 | Proof work with no shared workspace writes           |
| `PROOF_OS_TEMP_ISOLATED`         |    51 | Proof work restricted to a runner-owned OS temp root |
| `PROOF_TRACKED_ALIAS_EXCLUSIVE`  |    10 | Real tracked aliases with a drained scheduler        |
| `PROOF_WORKSPACE_TEMP_EXCLUSIVE` |     1 | The direct source-audit workspace-temp barrier       |

Fifty-four proof pairs are eligible for pair-level overlap at concurrency two after all dependencies
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

The only verifier runtime-probe exceptions, each with isolated temp and child-process authority,
are:

- `publisher-catalog-pinning`;
- `publisher-bundle-publication`;
- `publisher-official-golden`;
- `publisher-invalid-source-matrix`; and
- `control-plane-bundle-store`;
- `control-plane-bundle-verification`; and
- `control-plane-local-api`.

Native-addon authority is limited to the exact `reference-host-web-source-audit` verifier/root-test
pair, the `publisher-invalid-source-matrix` root test, and the exact `control-plane-local-api`
verifier/root-test pair. The source-audit verifier remains workspace-read-only; its root test is the
sole workspace-temp barrier. The publisher root loads only the reviewed Rolldown binding, and the
local-API pair loads only the reviewed SQLite binding.

Node 24 requires an orthogonal schema-v2 compatibility policy for eighteen exact root tests. The
distribution across all 138 workloads is 120 `NONE`, two `FIXTURE_COPY`, fifteen
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
denies TCP and UDP listener binding. Cleanup authenticates the temp directory identity before
removing it.

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
bytes, executable modes, tracked-file count, and Git index object ids before and after all 138
steps, including failure paths. The shared-state boundary also seals every reviewed build/Turbo
output root across the proof phase and compares non-ignored untracked state across the complete
execution region. A dependency download cache may save network time; no build, test, checkpoint,
mutation, or proof pass is reusable authority.

## Completed promotion boundary

I07-02 recorded exact workload equality, exactly-once coverage, matching outcomes, clean
tracked-workspace parity, safe cancellation, shared-state classification, and local plus hosted
evidence before completing the workflow cutover. The accepted evidence is
`docs/proof/baselines/i07-02-required-exhaustive-equivalence.json`. I07-02 implements no
affected-path selector. Its promotion closed `DEBT-I07-008` by removing the temporary shadow
workflow and modular comparison adapter/test. I07-03 may calculate `AFFECTED` plans only in shadow;
any unknown or ambiguous input expands to `EXHAUSTIVE`. I07-04 owns selector promotion and G07-due
reader cleanup. `DEBT-I07-007` keeps the sequential runner, equivalence adapter, and other
rollback-only paths until I07-05 proves their removal gates.
