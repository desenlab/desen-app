# Baseline Evidence

These files distinguish two different starting points:

- `protocol-0.1.0-*` reproduces the clean frozen upstream commit and its official suite.
- `foundation-quality.json` records checks executed on the current local Desen scaffold.

The protocol suite contains 14 cases: 9 entries from `conformance/vectors.json` and 5 public
examples. It must not be described as “14 vectors.”

`tracked-foundation.json` records the Selman-authored local baseline commit and the successful
temporary clean-clone install and quality check. No remote exists, so it does not claim a remote CI
result. M01-T08 remains the separately authorized remote push/CI step.

Evidence files must state the command, scope, source commit when one exists, result, and known
limitations. Generated proof artifacts additionally record SHA-256 hashes at their owning task.
