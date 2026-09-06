# CI-03 — Fresh proof verification performance

Status: Conditional DONE candidate after passing local evidence. Only the exact final PR head's
hosted checks can authorize closure; local measurements are not hosted completion authority.

## Boundary

CI-03 is an explicitly authorized operational interlude before M10-T04 can close. It changes
verification cost, not DESEN semantics or product behavior. M10-T05 is not started. I07-05 still
owns legacy-runner retirement and is not consumed by this work.

The complete workload inventory, fresh positive execution, negative cases, immutable historical
artifacts, append-only checkpoint history, process isolation, cancellation, and exact-head merge
requirements remain mandatory. The exhaustive soft deadline stays 1,110,000 ms; two proof-pair
workers and eleven exclusive barriers remain unchanged. No past passing result, filesystem mtime,
or global memoized proof result may replace a fresh verification.

## Observed blocker

The M10-T04 candidate `ebe7bd223e2dccd8245ebfeef201f882f11a1e8d` passed its local evidence and
all five hosted Chromium journeys, but the required Quality gate did not complete:

| Run                                                                                                  | Result  | Observed boundary                                                    |
| ---------------------------------------------------------------------------------------------------- | ------- | -------------------------------------------------------------------- |
| [PR #74, attempt 1](https://github.com/desenlab/desen-app/actions/runs/33738861358/job/100595806191) | Timeout | Unchanged 18m30s soft deadline                                       |
| [PR #74, attempt 2](https://github.com/desenlab/desen-app/actions/runs/33738861358/job/100603348681) | Timeout | Failed Quality job only; the passing Browser job was not repeated    |
| [Preceding main](https://github.com/desenlab/desen-app/actions/runs/33622328765)                     | PASS    | 1,001.610 seconds inside the gate; historical 214-workload inventory |

In attempt 2, the first App proof reader started approximately 135.8 seconds later than on the
preceding successful main run. The old App-plus-closing region alone needed about 122 seconds,
while only approximately 94 seconds remained. This is not evidence that T04 alone caused the
overrun. The runner OS image matched; differing ephemeral workers, agent versions, and regions do
not establish a hardware cause without resource telemetry.

The successful main receipt shows that the last 53-pair ordinary region already used two workers
almost continuously: 905.884 seconds of work over 453.397 seconds of elapsed time. Increasing
concurrency or removing barriers is not the remedy selected here.

## Implementation contract

1. Normalize each checkpoint once per invocation and use its private digest for both chain and
   reviewed-anchor comparisons. Uniqueness remains enforced, with the original error precedence.
   Public raw inputs still receive full validation and each filesystem call remains fresh.
2. Reject structurally invalid proof documents and unsafe output destinations before expensive
   runtime proof preparation. Well-formed candidates still execute the complete fresh build,
   exact artifact comparison, and final proof-pin checks. Path-based authority is checked again
   after the build; writer admission never replaces the final atomic destination checks.
3. Start the measured long `web-react-package-digest` pair first only within its existing ordinary
   segment. Dependency checks, two-worker concurrency, exclusive barriers, exact command vectors,
   canonical receipt order, and fail-closed cancellation remain unchanged. Previous timing data
   motivates the reviewed order but never chooses or skips runtime workloads.

## Local measurement method

Use the same Node 24.10.0 Apple M1 host and exact focused commands before and after each change.
Microbenchmark medians exclude cold initialization and include ten independent calls. Full
focused-suite timings include initialization and all existing positive and negative cases. These
local measurements cannot predict exact hosted elapsed time.

| Measured operation                                   |    Before |     After | Interpretation                                                                 |
| ---------------------------------------------------- | --------: | --------: | ------------------------------------------------------------------------------ |
| Validate the 69-checkpoint byte chain                | 34.910 ms | 19.128 ms | Warm median; all 6,630 records normalized once rather than three times         |
| Fresh checkpoint-authenticated M07-T01 artifact read | 34.573 ms | 18.196 ms | Warm median; no read or result cache                                           |
| Publisher invalid-source root, 65 cases              |  79.206 s |  59.515 s | Same CPU-profile-enabled root command; all 65 cases still pass                 |
| M08-T01 Source document, 13 cases                    |   9.430 s |   6.942 s | Fresh root suite                                                               |
| M08-T02 stable-ID insertion, 10 cases                |  25.815 s |  12.007 s | Fresh root suite                                                               |
| M08-T03 structural edits, 10 cases                   |  27.218 s |  12.264 s | Fresh root suite                                                               |
| M08-T04 content edits, 10 cases                      |  26.760 s |  15.288 s | Includes intervening proof-symlink and destination-hardlink negatives          |
| M08-T05 state/binding edits, 10 cases                |  26.667 s |  12.234 s | Fresh root suite                                                               |
| M08-T06 event/action edits, 10 cases                 |  35.435 s |  16.497 s | Fresh root suite                                                               |
| M08-T07 authoring round trip, 10 cases               |  47.837 s |  24.601 s | Fresh root suite                                                               |
| Sum of the seven M08 suites, 73 cases                | 199.162 s |  99.833 s | 49.87% less measured elapsed time in these suites; not a whole-gate projection |

Each M08 row uses the same `node --test tests/editor-core-<family>.test.mjs` command before and
after. T01 and T04's final measured root runs precede comment-only TSDoc additions; all seven
normal verifier CLIs passed again after the final comments. The root suites still contain the same
73 runnable top-level tests and retain their frozen AST/registration rules. New assertions within
those tests establish zero build-file acquisition for malformed proofs and unsafe destinations,
fresh work for plausible-but-wrong digests, two separate reads for path-backed proofs, and
post-preflight filesystem-race rejection. All seven frozen artifact byte counts and hashes remain
unchanged. Only the existing current-root-test SHA entries inside T01, T02, and T03 were resealed
for reviewed additional test assertions; no predecessor, package, public-test, or frozen artifact
pin was changed.

The Publisher unsafe-destination case falls from 17.885 seconds to 3.379 ms. A deterministic
child-process spy proves that symbolic links, directories, and missing destination parents are
rejected before runtime execution. Both valid-writer paths still execute the complete fresh
runtime proof. The preflight mirrors the existing writer policy; it does not newly claim rejection
of hardlinks or canonical-parent aliases. When several inputs are invalid, destination admission
may now fail before a later runtime error; the accepted set does not grow.

Replaying the preceding recorded step durations with only the package-digest scheduling change
predicts 19.70 seconds saved for main and approximately 24.34/22.95 seconds for the two failed PR
attempts. This is a fixed-duration counterfactual, not a new hosted measurement. These projected
savings must not be added to reader speedups: two-worker overlap and CPU contention can change the
critical path. The scheduler suite passes 33/33 with exact-set, dependency, barrier-drain, and
cancellation regressions; its normalized plan and inventory identities are unchanged.

The unchanged command inventory contains 216 workloads and 103 verifier/root-test pairs. Its
SHA-256 is `d6d00fb7ec87e41c75ada3ce3d65cb0d3cf9286936c437fa836bbec9eed372cc`; the normalized
required plan remains
`f9a66d3729bea671bfe54405f8c6e4653699d69c38136ed1925cc3a714f3926a`. Scheduling priority changes
only the execution order of independent pairs inside an already validated ordinary segment.
No M03 package-digest reader, shared atomic writer, package source, workflow deadline, or frozen
task artifact is modified by CI-03.

The checkpoint suite passes 97/97, including deterministic work-count, hostile raw-input,
monkeypatched built-in, output-detachment, and same-size file-change regressions. This is local
evidence only. Historical-reader changes require a reviewed checkpoint successor and their own
positive, negative, frozen-artifact, and hosted checks before closure.

## Current-reader authority

Reviewed checkpoint 70 appends to the unchanged 1–69 history, with head
`52e71083e7c6f08986480434b5a327b1de6a2d29487b8f8a7ecbef1ffdb4d4e6`. It preserves all 57
frozen artifacts and the 114-reader inventory. Exactly sixteen live receipts change: the
M06-T11 proof/root pair and the seven M08 proof/root pairs at indexes `[10, 11, 50..63]`.
The canonical manifest is 1,780,768 bytes. This seals reviewed source identity only and cannot
substitute for a fresh passing test.

The M10-T04 artifact remains 22,456 bytes at
`d9d841af06ec9efc51c3f1c74079f0aa4d5e1c7e996f3b97df7e277e4b1f8423`; its historical-reader
bridge and all predecessor artifacts remain unchanged. No product implementation or browser
journey changes are included in CI-03.

The two new documentation paths increase exact-one tracked ownership to 1,411 paths, with 206
proof-owned paths and 143 project-documentation paths. Both additions force exhaustive selection.
The path-set identity is
`333a1ec201b7f9f7af40b7564ee66c6d485b2df1621843054fa3089fc2e98649`; ownership is
`9f94859418b7825ab148702308640919b5e89d12431d1332888eae7cf27e2253`. Promotion verifies current
selector `c834d72acd7ae13d299cb55d8e22ff688d45337ba9441d854b955c26cf638bf7` and runner
authority `b5dca055e427c84fdefa70051a0ae49c0c19e00336d104449923dc54fa3f7861`. Its frozen hosted
campaign remains unchanged; these identities do not grant a passing current execution.

## Closure

The exact six-command ordinary baseline passed: `pnpm format:check`, `pnpm lint`,
`pnpm typecheck`, `pnpm build`, `pnpm boundaries`, and
`node scripts/ci/verify-proof-reader-checkpoints.mjs`. Its configured local Turbo cache for
unchanged package tasks remains non-authoritative feedback; it is not current proof execution.
The changed proof and CI suites run in fresh Node processes. No local full `pnpm check`, App
suite, or Chromium journey was repeated for CI-03; exact-head hosted jobs own that fresh coverage.

Final focused CI verification passes 379/379 across fourteen files: checkpoint/scheduler 131/131
(98 + 33), remaining exhaustive/debt/change/threshold contracts 98/98, and
ownership/promotion/selector/required-affected/impact 150/150. Checkpoint, promotion, and
infrastructure-debt CLIs pass. The retained `scripts/test/ci-quality-gate.test.mjs` compatibility
contract separately passes 28/28. The final M10-T04 verifier and its independent root suite also pass
10/10 while retaining the exact frozen artifact. Independent review confirmed unchanged
checkpoint history and all 171 current artifact/reader byte counts and SHA-256 receipts.

These local results justify a closure candidate, not a merge. CI-03 and M10-T04 become `DONE` only
when both hosted jobs pass on the exact final head of [PR #74](https://github.com/desenlab/desen-app/pull/74).
The PR's check records and closure report must identify that head and its actual hosted timings;
the two historical timeouts and the earlier Browser success cannot authorize it. Main performs a
separate fresh exhaustive run after merge. No next product task starts as part of this interlude.
A failed or unfinished workload is never a passing receipt.

## CI-04 — Fresh-verification headroom

Status: conditional `DONE` closure candidate, explicitly authorized on 2026-09-07. Local evidence
passes; completion still requires exact-final-head PR checks and fresh exhaustive successor main
CI. This separate operational interlude
depends on completed CI-03 and M10-T05 and unblocks SEC-02's final main-validation obligation.
It does not begin M10-T06 or advance implementation-task or proof-gate counts.

SEC-02's exact PR head `169b4be4cff52a6181131fc253aa935491bafd3a` passed both required checks;
the successful Quality retry took 15m15s. It merged as
`fdd1b8d5ecfbca5139d8aafb02324acddf66a4c2`, with identical Git tree
`bd0ea5282c175ed6563c7b35c15dfd2221989f62`. Both fresh main Quality attempts in
[run 34060300431](https://github.com/desenlab/desen-app/actions/runs/34060300431) reached the
closing phase but exceeded the 1,110,000ms deadline; Browser E2E passed in 4m2s. The first main
attempt stopped in boundary fixtures, the second during dependency analysis. Neither is a pass.
All eight remaining GitHub security alerts were independently marked `fixed`; security graph
repair does not by itself resolve this CI timing failure.

CI-04 preserves the exact 220-workload / 105-proof-pair inventory, every existing positive and
negative case, two workers per workspace, eleven exclusive barriers, process isolation, fresh
input reads, frozen artifacts, append-only checkpoint history, cancellation, and the unchanged
18m30s execution deadline. The distributed schedule described below supersedes this interlude's
initial single-workspace proposal; aggregate hosted concurrency increases, not concurrency inside
one shared filesystem. No historical successful run or cached test result authorizes a new run.
Exact-head hosted PR checks and fresh successful main CI remain mandatory.

### Why another small scheduling change is insufficient

Both failed main attempts completed all 105 proof pairs. Prefix work took 320.2 / 326.2 seconds;
the proof region took 769.0 / 775.2 seconds. The passing PR needed 240.8 / 600.9 seconds for these
same phases. Failed-run values are reconstructed from timestamped logs because an interrupted
run has no complete final receipt. They do not establish a specific hosted hardware cause.

Repacking the existing two-worker segments can save at most approximately nine seconds under
fixed observed durations. The eleven drained barriers remain necessary for workspace alias and
source-audit isolation. Shared historical bridge profiling also confirms that each of five
archives is inflated only once in a cold M09 build; repeated decompression is not the bottleneck.
Skipping later current-file authentication would not be a valid optimization.

### Distributed exhaustive execution

Fresh, authenticated routing preserves the existing affected selector for eligible PRs. Main,
manual required runs, and ineligible/unsafe/unknown PR boundaries use three fixed exhaustive
shards. Routing emits only a mode, never PASS; affected execution repeats its own fresh admission.

The exhaustive partition is canonical proof positions 0–52 / 53–76 / 77–104: 53, 24, and 28 complete
verifier/root pairs. Every shard runs all eight prefix workloads on its own checkout. No compiled
outputs, temporary workspace, normalized proof authority, or cached success is shared. Each shard
keeps the original two-worker process runner and filesystem/cancellation guards. All eleven
barriers occur in the first shard and still drain that workspace's worker pool.

The final `Quality gate` always evaluates routing and dependency results. It rejects missing,
failed, skipped, cancelled, foreign-revision, foreign-run, and future-attempt shard authority.
GitHub's current-workflow `needs` results and bounded exact job outputs are the remote authority;
serialized PASS alone is insufficient. Successful jobs retained by a failed-job rerun must belong
to the same run and exact execution/head revisions; their actual producer attempt is recorded.
They are not represented as locally observed child closes. The join freshly builds its own
workspace, then runs both original suffix workloads after all remote prerequisites have passed.
The canonical logical coverage remains 220 workloads. Repeated prefix work and join preparation
are explicitly additional execution, not hidden omissions or fabricated exactly-once claims.

Replaying fixed main-attempt-2 durations estimates shard proof regions of 266.4 / 264.8 / 263.6
seconds. Including repeated prefixes, setup, routing, and the fresh join suggests approximately
14 minutes of critical-path time without queueing, compared with the interrupted 19-minute jobs.
This is a counterfactual estimate, not a hosted result or an assertion about future runner speed.

### Focused pure-work reductions

The private normalized checkpoint graph now freezes by its validated schema, avoiding a second
generic reflective walk. All 7,730 objects in the measured checkpoint-74 graph remain frozen
(7,910 after the checkpoint-75 append), and schema, canonical bytes, digests,
append-only history, reviewed anchors, and fresh filesystem checks remain unchanged. Rotated warm
medians on Node 24.10.0 / Apple M1 measure 20.171 → 18.594 ms for validation and 22.562 → 20.627 ms
for a fresh authenticated file read. These microbenchmarks are not added to projected shard gains.

T05 now rejects malformed path-backed proof requests and unsafe writer destinations before fresh
App/host builds. Admitted requests still build, then reread their path authority; atomic writer
rechecks remain mandatory. Replaying all ten unchanged original root cases measures 18.405 →
15.408 seconds. The expanded suite measures 21.802 seconds because two additional post-admission
race negatives intentionally perform full fresh builds before rejection. This is not claimed as
a net whole-suite speedup. Existing tests are retained, with deterministic no-build rejection,
two-read positive, mutation-after-admission, and writer-race coverage added.

### Local implementation evidence and hosted closure conditions

The exact six-command bounded baseline passes. Dependency boundaries cover 862 modules / 3,689
dependencies and all 30 boundary fixtures; infrastructure debt retains 19 records (one open,
18 closed). The 31 new distributed-runner tests, 105 checkpoint tests, 36 original scheduler
tests, 54 promotion/selector tests, 20 ownership tests, 47 affected-runner tests, and 180 core
CI/security tests all pass without skipping cases. Final T05 verification passes and its expanded
ten-case root suite passes in 19.036 seconds; this final sanity run is not a comparative benchmark.
No full local `pnpm check` was repeated. The unchanged hosted Browser E2E still runs all six journeys.

Checkpoint 75 is 2,011,508 bytes and retains all 74 preceding entries, all 59 immutable artifacts,
and 118 current readers. Only T05's verifier library and root test are resealed. The checkpoint
head is `ed7eea304b03e07112fbeb0b27fd6df82d83d229033c5c3794d0054cc9df2ea1`.
The T05 artifact remains 189,123 bytes at
`80c0b815a813ef462233b48a7fffe7c4d0bbf391aefc68eb9a6174da6bd84bd3`.
Ownership covers 1,452 tracked paths, 210 proof-owned paths, and 48 CI-policy paths. Historical
selector campaigns and their seven compatibility projections remain unchanged; new imported
runner sources have separate fresh byte/mode admission checks.

Current execution identities:

| Authority                  | SHA-256                                                            |
| -------------------------- | ------------------------------------------------------------------ |
| Logical workload inventory | `66ae36cb2ec1c8a7bc7deee1a733e253cc1861d3b9ca1487c9725f437c3abf5a` |
| Original exhaustive plan   | `30799382d92edf70455a42bc01e13973324bf1a916b5b925ad86c429b926fb2a` |
| Distributed plan           | `41f16f539ff346e35c3f9a3d1b301e1b7de1f57c500b0a86cd4a43f4fa50bf24` |
| Selector                   | `af2e37e8ab5ece83b0f33d793837d3fdd9d7325707f8a0cc4af3259fd5e35acb` |
| Runner source              | `0f06360543eab2b0f05a855bd09649b7ab21cdee44abbb3f1e61f6b2364cbc19` |
| Ownership                  | `7ebb6e9d5d01e0753844138d520b0b898fc63dfb20074d086861213ab070d799` |

Each successful exhaustive run must observe 114 / 56 / 64 actual local workload closes in its
three shards and three fresh local join closes: 237 physical executions covering all 220 logical
workloads and 105 proof pairs. The raw summary validator grants only shadow/test authority.
Required join admission instead captures GitHub's injected current-job context with no caller
arguments, validates all four exact `needs` records, and binds local Git state to that revision.
This trusts the GitHub job environment; it does not claim cryptographic authenticity against a
process that can forge its own environment.

The task-board `DONE` candidates for CI-04 and SEC-02 take effect only after the unchanged final
PR head passes both required checks and its merged successor passes fresh main CI. Hosted run
URLs, exact revisions, job outcomes, and measured end-to-end timings belong in the PR closure
receipt. No hosted CI-04 success is claimed by these local results. M10-T06 remains not started.
