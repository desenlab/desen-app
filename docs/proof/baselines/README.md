# Baseline Evidence

These files distinguish two different starting points:

- `protocol-0.1.0-*` reproduces the clean frozen upstream commit and its official suite.
- `foundation-quality.json` records checks executed on the current local Desen scaffold.

The protocol suite contains 14 cases: 9 entries from `conformance/vectors.json` and 5 public
examples. It must not be described as “14 vectors.”

The Desen scaffold currently has no local baseline commit or remote. Its local quality result
therefore does not prove a clean checkout or remote CI. M01-T07 creates the Selman-authored local
baseline and verifies a temporary clean clone. M01-T08 remains the separately authorized remote
push/CI step.

Evidence files must state the command, scope, source commit when one exists, result, and known
limitations. Generated proof artifacts additionally record SHA-256 hashes at their owning task.
