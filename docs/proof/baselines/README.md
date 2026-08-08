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
`i07-03-affected-selector-shadow.json` records the local fail-closed `SHADOW + AFFECTED` selector,
complete exact tracked-path ownership, fresh selected-workload execution, frozen promotion
threshold, and initial `0 / 20` observation state. It makes no hosted comparison or promotion claim;
the exact `REQUIRED + EXHAUSTIVE` runner remains authoritative, and I07-04 remains `NOT_STARTED`.

Evidence files must state the command, scope, source commit when one exists, result, and known
limitations. Generated proof artifacts additionally record SHA-256 hashes at their owning task.
