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

## CI-03 and M10-T04 public build-log drafts

Drafts for review after exact-head closure only; not published. No publication day is assigned.

**X (EN, ≤280 characters)**

> Designers can now build a two-page flow and connect Success → Navigate in Desen App. Chromium tests cover fixtures and a real local HTTP operation; faster proof checks retain full coverage. Production auth is not claimed. Inspect github.com/desenlab/desen-app.

**LinkedIn**

> [EN]
>
> A designer can build two pages and connect Success → Navigate without JSON. Chromium checks both
> synthetic fixtures and an explicitly selected local HTTP operation. Proof verification also
> avoids redundant work while retaining every workload and fresh execution. This is a local test
> integration, not production authentication; publishing/activation is the next product proof.
> What would you build with it? Inspect https://github.com/desenlab/desen-app
>
> [TR]
>
> Tasarımcı artık iki sayfa oluşturup JSON yazmadan başarı sonrası sayfa geçişini kurabiliyor.
> Chromium hem sentetik örnekleri hem açıkça seçilen yerel HTTP bağlantısını denetliyor. Kanıt
> doğrulamasında da test kapsamı ve her seferinde taze çalışma korunarak gereksiz tekrarlar
> azaltıldı. Bu yerel test entegrasyonu; production kimlik doğrulaması değil. Sıradaki ürün kanıtı
> yayınlama/aktivasyon. Siz ne tasarlardınız? İnceleyin: https://github.com/desenlab/desen-app
>
> #DesignTools #OpenSource #WebDevelopment
