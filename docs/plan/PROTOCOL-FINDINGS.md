# Protocol Findings

This file records implementation discoveries without changing the frozen DESEN 0.1.0 protocol.

## Finding format

- ID and status
- Protocol location
- Observation
- Implementation decision, if safe
- Whether it blocks the 0.1.0 proof
- Candidate future protocol action

## PF-001 — Capability package archive digest procedure is not normative

- Status: OPEN
- Blocks proof: No
- Observation: DESEN 0.1.0 requires exact package digests but does not standardize a universal
  package archive layout and digest procedure.
- Implementation decision: Define and document a deterministic Web–React reference profile. Do
  not present it as a universal 0.1.0 rule.
- Future action: Consider a signed package/distribution profile after implementation evidence.

## PF-002 — Canonical schema identifiers use `schemas.desen.dev`

- Status: OPEN
- Blocks proof: No; JSON Schema identifiers need not be fetched during local validation.
- Observation: Frozen 0.1.0 schema `$id` values use `https://schemas.desen.dev/...`, while the
  currently designated public developer domain is `desen.run`.
- Implementation decision: Do not rewrite frozen schema identifiers. Record the identifiers in
  compatibility documentation. A `desen.run` mirror may publish the snapshot without pretending
  to replace canonical IDs.
- Future action: Confirm domain ownership and decide any canonical-domain change only in a future
  protocol version.

## PF-003 — Map data binding belongs to the capability contract

- Status: OPEN
- Blocks proof: No
- Observation: The example map contract demonstrates the complex capability shape but a
  production store-map needs an explicit marker-data property or equivalent resource binding.
- Implementation decision: Add a schema-defined semantic `markers` property to the reference Web
  catalog and bind it to the store resource. This is a capability decision, not a core change.

## PF-004 — Upstream repository has no `v0.1.0` Git tag

- Status: OPEN
- Blocks proof: No; the exact commit is recorded.
- Observation: Commit `b0bd7c4f0f61555b1d90e3a2ceb90d6e3d43daca` is clean and published,
  but no version tag exists locally as of 2026-07-21.
- Implementation decision: Pin the commit and SHA256 manifest now. Create the upstream tag during
  release preparation without modifying content.

## PF-005 — Existing npm history predates the frozen protocol

- Status: OPEN
- Blocks proof: No
- Observation: The owned `desen` package already contains `0.0.1` and `1.0.0-beta.*` test releases
  and outdated repository metadata.
- Implementation decision: Do not delete or publish during the proof phase. Follow the npm
  transition runbook after G12.
