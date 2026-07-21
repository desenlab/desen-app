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

## PF-006 — Diagnostic extension syntax and emission categories are not normative

- Status: OPEN
- Blocks proof: No
- Protocol location: SPEC Sections 23.9 and 26.1, Appendix B
- Observation: DESEN 0.1.0 permits namespaced implementation diagnostic codes but does not define
  their grammar. It also defines Appendix B `Class` metadata while the frozen conformance runner
  separately uses stage-oriented outcomes such as `catalog_error`; those vocabularies are not a
  one-to-one mapping. The exact diagnostic object field names and applicability rules are likewise
  not specified.
- Implementation decision: Preserve the 36 core codes and exact Appendix classifications in an
  immutable registry. Use a portable data model with stable `code`, optional RFC 6901 `pointer`,
  safe human `message`, and optional identity context. Derive classification only for core
  diagnostics and do not interpret it as an emission stage. Preserve caller-documented namespaced
  string literals without enforcing an invented universal grammar.
- Future action: Consider standardizing the extension-code grammar, diagnostic envelope, severity,
  ordering, and localization keys in a later protocol version.

## PF-007 — Embedded-schema dialect and external-reference loading are underspecified

- Status: OPEN
- Blocks proof: No
- Protocol location: SPEC Sections 7.2 and 8.3
- Observation: DESEN 0.1.0 requires embedded schemas to use JSON Schema Draft 2020-12, but the
  frozen examples omit `$schema` and the protocol does not define whether an implementation may
  fetch external `$ref` targets, which registries are trusted, or how custom vocabularies are
  distributed.
- Implementation decision: Treat an omitted `$schema` as Draft 2020-12 because the containing
  protocol contract fixes that dialect. Accept the exact Draft 2020-12 URI, reject an explicitly
  different dialect, reject non-local `$ref` and `$dynamicRef`, and never fetch schema content from
  the network during document validation. Unknown annotation keywords remain valid JSON Schema
  keywords and receive no invented DESEN semantics.
- Future action: Define a portable embedded-schema resource and vocabulary profile in a future
  protocol version if interoperable external references become necessary.

## PF-008 — Frozen schema version patterns are broader than Semantic Versioning 2.0.0

- Status: OPEN
- Blocks proof: No; structural validation must execute the frozen schema exactly.
- Protocol location: SPEC Section 5.2 and the three canonical root schemas
- Observation: The frozen regular expressions accept some prerelease and build strings that the
  Semantic Versioning 2.0.0 grammar rejects, including leading-zero numeric prerelease identifiers
  and empty dot-separated identifiers.
- Implementation decision: M02-T06 applies the frozen patterns without silently rewriting them.
  M02-T07 owns the stricter semantic version check required by the prose contract.
- Future action: Tighten the canonical schema pattern in the next protocol revision and add
  positive and negative SemVer vectors.
