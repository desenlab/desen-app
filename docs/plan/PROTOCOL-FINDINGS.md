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
  M02-T07 now applies a separate exact, non-coercing Semantic Versioning 2.0.0 grammar check while
  retaining the frozen structural behavior.
- Future action: Tighten the canonical schema pattern in the next protocol revision and add
  positive and negative SemVer vectors.

## PF-009 — Semantic version and catalog-requirement failures lack core diagnostics

- Status: OPEN
- Blocks proof: No; the validator must expose the distinction without changing Appendix B.
- Protocol location: SPEC Sections 7.1, 8.3, 8.4, 12.2, 23.9, and 26.1; Appendix B
- Observation: DESEN 0.1.0 requires exact Semantic Versioning and exact catalog requirement
  matching, but Appendix B defines no core diagnostic for an invalid exact version or a resolved
  catalog set that does not match a declared `id`/`version`/`target` tuple. `SCHEMA_INVALID` would
  be inaccurate for values accepted by the frozen schemas, while `CATALOG_VERSION_UNAVAILABLE`
  belongs to later package resolution and activation work.
- Implementation decision: M02-T07 uses the documented implementation-namespaced codes
  `run.desen.validator/INVALID_SEMVER` and
  `run.desen.validator/CATALOG_REQUIREMENT_MISMATCH`. These diagnostics use the shared portable
  diagnostic envelope without an invented Appendix B classification. Core semantic failures keep
  the exact `DUPLICATE_SURFACE_ID`, `DUPLICATE_NODE_ID`, `ENTRY_NOT_FOUND`,
  `UNKNOWN_CAPABILITY`, and `AMBIGUOUS_CAPABILITY` codes. When a resolved catalog-set collision
  has no unique usage site, the validator points deterministically to the later declaration in the
  caller-supplied catalog array and RFC 6901-escapes its capability ID.
- Future action: Define first-class core diagnostics and a normative cross-document pointer model
  in a later protocol revision.

## PF-010 — Slot edge semantics and impossible component contracts are underspecified

- Status: OPEN
- Blocks proof: No; the validator can make the edge behavior explicit without changing the frozen
  documents.
- Protocol location: SPEC Sections 17.3, 21.3, and 26.1; Catalog Schema `$defs/slotSpec`; Appendix B
- Observation: DESEN 0.1.0 names `required`, `minItems`, and `maxItems` as separate slot-cardinality
  inputs but does not state how an omitted `minItems` combines with `required`, whether an explicit
  `minItems: 0` permits an empty required slot, or whether empty-but-present `accepts` and
  `acceptsCategories` arrays mean unrestricted or reject-all. The frozen schema also permits
  `maxItems` below the effective minimum. The informative starter validator treats `required` as an
  implicit minimum of one only when `minItems` is omitted, treats empty acceptance arrays as
  unrestricted, and reports an impossible range as `SCHEMA_INVALID`; these choices are not all
  stated by the normative schema or prose.
- Implementation decision: A required slot must be present. For a present slot,
  `effectiveMin = minItems ?? (required ? 1 : 0)`; therefore an explicit
  `required: true, minItems: 0` accepts an empty-but-present array. When both acceptance fields are
  absent, the slot is unrestricted. When either field is present, the accepted set is the exact OR
  union of the declared capability IDs and categories, so an explicitly empty union rejects every
  child. A component contract with `maxItems < effectiveMin` is rejected with the documented
  implementation-namespaced code `run.desen.validator/INVALID_COMPONENT_CONTRACT` because the
  frozen schema accepts the document and `SCHEMA_INVALID` would make an inaccurate claim. Unknown
  visual states and style parts continue to use the core `UNKNOWN_PROP` code, matching the frozen
  starter behavior rather than inventing additional diagnostic identities.
- Future action: Define slot-presence, effective-minimum, empty-acceptance, impossible-range, and
  diagnostic behavior directly in a future protocol revision and add matching conformance vectors.

## PF-011 — Draft 2020-12 regex execution has no portable complexity bound

- Status: OPEN
- Blocks proof: No; the validator can fail closed under a documented host-safe component-schema
  profile without weakening the frozen protocol.
- Protocol location: SPEC Sections 10.3, 17.2, 18.3, 21.2, 21.6, and 27.8; embedded Draft 2020-12
  schemas; mandatory clause `N-041`
- Observation: A catalog pattern may be valid ECMA-262 syntax and still cause catastrophic
  backtracking in a native JavaScript `RegExp`. DESEN 0.1.0 requires finite runtime and publisher
  limits but does not define a regex engine, a linear-time dialect, or schema-evaluation budgets.
  Syntax validation alone therefore cannot make untrusted component schemas safe to execute on the
  UI thread.
- Implementation decision: M02-T08 keeps T06 Draft 2020-12 syntax validation intact, then admits a
  component prop or style-part schema only through a stricter host-safe preparation boundary.
  Patterns are limited to 256 UTF-16 code units, 128 tokens, quantifiers no greater than 1,024, and
  an expanded fixed width no greater than 4,096. An unanchored fixed-width pattern is limited to 16
  expanded atoms. Groups, alternation, lookaround, backreferences, Unicode-property escapes,
  interior zero-width assertions, and lazy or possessive repetition are rejected. At most one
  variable-width quantifier is allowed, it requires both edge anchors, and it must be the final
  consuming atom; only the terminal `$` may follow. This rejects pathological quantified prefixes
  followed by fixed suffixes before native matching. Each schema is also limited to a maximum
  traversal/evaluation depth of 128, 4,096 schema nodes, 4,096 local-reference edges, 64 patterns,
  4,096 aggregate pattern code units, and a deterministic 50,000-step evaluation budget.
  Unresolved local references, duplicate same-resource anchors, profile violations, and statically
  excessive schema fan-out fail at the exact catalog schema pointer with
  `run.desen.validator/INVALID_COMPONENT_CONTRACT`. The evaluator independently enforces the same
  step ceiling and fails closed at the component prop or style value pointer if input-driven work
  exhausts it. Unsafe patterns are never passed to native `RegExp`. T08 applies this profile only
  to component prop and style-part schemas, preserving the behavior/event/command boundary
  assigned to T09.
- Future action: Standardize a portable linear-time regex and schema-resource-limit profile, or
  adopt a platform-neutral linear-time engine, then add official conformance vectors for safe and
  rejected schemas.
