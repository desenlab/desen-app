# Baseline Evidence

These files distinguish two different starting points:

- `protocol-0.1.0-*` reproduces the clean frozen upstream commit and its official suite.
- `foundation-quality.json` records checks executed on the current local Desen scaffold.

The protocol suite contains 14 cases: 9 entries from `conformance/vectors.json` and 5 public
examples. It must not be described as “14 vectors.”

`tracked-foundation.json` records the Selman-authored local baseline commit and the successful
temporary clean-clone install and quality check before a remote existed. `remote-ci.json` records
the later authorized creation of `desenlab/desen-app` and the first successful `main` CI run. The
historical baseline files retain the state that was true when each check occurred.
`ci-01-single-pass.json` records the successful before/after hosted-run comparison for the
fail-closed single-pass quality gate.
`i07-01-modular-proof-shadow.json` records the same-revision local and hosted comparison for the
non-authoritative exhaustive modular candidate, including its exact legacy inventory, checkpoint
genesis, open cleanup debt, timing, and remaining cutover limitations.
`i07-02-required-exhaustive-equivalence.json` records the accepted local and hosted equivalence
program, the rejected common-drift attempt, exact shared-state ownership, the required-workflow
cutover, the manual-only legacy rollback boundary, the second current-reader checkpoint, and the
three removed temporary comparison targets. It closes no protocol claim and introduces no
affected-path selection.
`i07-03-affected-selector-shadow.json` records the fail-closed `SHADOW + AFFECTED` selector,
complete exact tracked-path ownership, fresh selected-workload rules, frozen promotion threshold,
local 91/91 focused and 203/203 CI-infrastructure results, and exact hosted bootstrap identifiers.
The hosted Quality gate passed authoritatively; the shadow returned `NOT_ELIGIBLE` → `EXHAUSTIVE`
for `UNSUPPORTED_CHANGE_KIND`, so no eligible strict-subset observation was counted. The baseline
therefore remains at `0 / 20`, makes no promotion claim, and leaves I07-04 `NOT_STARTED`. Its full
local gate is `BLOCKED_BY_LOCAL_SANDBOX` because loopback `listen` returned `EPERM` in two
pre-existing TCP lifecycle tests; the hosted gate, not that local environment restriction, is the
authority. It also pins append-only reader checkpoint sequence 22, which preserves sequence 21,
all 18 frozen artifacts, and all 36 reader identities while resealing only indexes
`[8, 10, 11, 12, 14]`.

`i07-04-affected-selector-promotion.json` records the independently authenticated 20/20 hosted
campaign with zero false negatives. Its fixed historical campaign digest binds every run, job,
revision, receipt, threshold, controller, and decision identity; its live authorities prove the
conservative selector transition and fail-closed required runner. The file currently records
`HOSTED_CUTOVER_VERIFIED`. [Cleanup PR #36](https://github.com/desenlab/desen-app/pull/36) passed
fresh `REQUIRED + EXHAUSTIVE` in
[run 31674300000, job 94365383803](https://github.com/desenlab/desen-app/actions/runs/31674300000/job/94365383803),
and its landed `main` revision passed the same authority in
[run 31675234655, job 94368259305](https://github.com/desenlab/desen-app/actions/runs/31675234655/job/94368259305).
The one-file [canary PR #37](https://github.com/desenlab/desen-app/pull/37) passed fresh
`REQUIRED + AFFECTED` in 3m54s in
[run 31676049922, job 94370743935](https://github.com/desenlab/desen-app/actions/runs/31676049922/job/94370743935),
selecting and closing 10 workloads for one proof unit as a strict subset without cached success.
The baseline also binds checkpoint sequence 28 (25 frozen artifacts, 50 current readers) and the
closure of all 17 G07-due debt entries. `DEBT-I07-007` remains `OPEN` for I07-05; I07-04 and G07
are `DONE`.

The baseline's `nonClaims` array belongs to the byte-frozen, pre-cutover campaign projection. Its
conditional statement that G07 and I07-04 remain open _until_ hosted closure passes records that
historical boundary; the verified `cutover` object above proves that the condition has since been
satisfied and is the current status authority.

Evidence files must state the command, scope, source commit when one exists, result, and known
limitations. Generated proof artifacts additionally record SHA-256 hashes at their owning task.
