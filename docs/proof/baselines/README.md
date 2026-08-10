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

Evidence files must state the command, scope, source commit when one exists, result, and known
limitations. Generated proof artifacts additionally record SHA-256 hashes at their owning task.
