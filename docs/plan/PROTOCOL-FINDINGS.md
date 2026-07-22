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

## PF-010 — Slot edge semantics and impossible component or behavior contracts are underspecified

- Status: OPEN
- Blocks proof: No; the validator can make the edge behavior explicit without changing the frozen
  documents.
- Protocol location: SPEC Sections 17.3, 19.4, 21.3, and 26.1; Catalog Schema
  `$defs/slotSpec`; Appendix B
- Observation: DESEN 0.1.0 names `required`, `minItems`, and `maxItems` as separate slot-cardinality
  inputs but does not state how an omitted `minItems` combines with `required`, whether an explicit
  `minItems: 0` permits an empty required slot, or whether empty-but-present `accepts` and
  `acceptsCategories` arrays mean unrestricted or reject-all. The frozen schema also permits
  `maxItems` below the effective minimum. The informative starter validator treats `required` as an
  implicit minimum of one only when `minItems` is omitted, treats empty acceptance arrays as
  unrestricted, and reports an impossible range as `SCHEMA_INVALID`; these choices are not all
  stated by the normative schema or prose.
- Implementation decision: The same profile applies to slots declared by component and behavior
  capabilities. A required slot must be present. For a present slot,
  `effectiveMin = minItems ?? (required ? 1 : 0)`; therefore an explicit
  `required: true, minItems: 0` accepts an empty-but-present array. When both acceptance fields are
  absent, the slot is unrestricted. When either field is present, the accepted set is the exact OR
  union of the declared capability IDs and categories, so an explicitly empty union rejects every
  child. A component contract with `maxItems < effectiveMin` is rejected with
  `run.desen.validator/INVALID_COMPONENT_CONTRACT`; the equivalent behavior contract is rejected
  with `run.desen.validator/INVALID_INTERACTION_CONTRACT`, as recorded below. The frozen schema
  accepts both impossible ranges, so `SCHEMA_INVALID` would make an inaccurate claim. Unknown
  visual states and style parts continue to use the core `UNKNOWN_PROP` code, matching the frozen
  starter behavior rather than inventing additional diagnostic identities.
- Future action: Define slot-presence, effective-minimum, empty-acceptance, impossible-range, and
  diagnostic behavior directly in a future protocol revision and add matching conformance vectors.

## PF-011 — Draft 2020-12 regex execution has no portable complexity bound

- Status: OPEN
- Blocks proof: No; the validator can fail closed under a documented host-safe contract-schema
  profile without weakening the frozen protocol.
- Protocol location: SPEC Sections 10.3, 17.2, 18.3, 19.4, 21.2, 21.4–21.6, and 27.8; embedded
  Draft 2020-12 schemas; mandatory clause `N-041`
- Observation: A catalog pattern may be valid ECMA-262 syntax and still cause catastrophic
  backtracking in a native JavaScript `RegExp`. DESEN 0.1.0 requires finite runtime and publisher
  limits but does not define a regex engine, a linear-time dialect, or schema-evaluation budgets.
  Syntax validation alone therefore cannot make untrusted component, behavior, event, or command
  schemas safe to execute on the UI thread.
- Implementation decision: M02-T08 keeps T06 Draft 2020-12 syntax validation intact, then admits a
  component prop or style-part schema only through a stricter host-safe component-schema profile.
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
  excessive schema fan-out fail at the exact catalog schema pointer. Component prop and style-part
  preparation uses `run.desen.validator/INVALID_COMPONENT_CONTRACT`. T08 applies this profile only
  to component prop and style-part schemas. M02-T09 applies the identical limits to behavior prop
  and style-part schemas and to component/behavior event payload and command input schemas; those
  interaction-owned failures use
  `run.desen.validator/INVALID_INTERACTION_CONTRACT`. The evaluator independently enforces the same
  step ceiling and fails closed at the relevant contract-value pointer if input-driven work
  exhausts it. Unsafe patterns are never passed to native `RegExp`. Extending the safe preparation
  boundary does not by itself prove the adapter obligations in `N-033` or `N-034`.
- Future action: Standardize a portable linear-time regex and schema-resource-limit profile, or
  adopt a platform-neutral linear-time engine, then add official conformance vectors for safe and
  rejected schemas.

## PF-012 — Behavior attachment and conflict edge semantics are underspecified

- Status: OPEN
- Blocks proof: No; one conservative, exact profile can be applied without changing the frozen
  documents.
- Protocol location: SPEC Sections 19.2–19.3; Catalog Schema
  `$defs/behaviorCapability/properties/attachTo` and
  `$defs/behaviorCapability/properties/composition`; Appendix B
- Observation: DESEN 0.1.0 does not explicitly state how capability and category attachment lists
  combine, whether an explicitly empty list means unrestricted or rejects all attachments, whether
  `exclusiveChannels` is a list or set for conflict purposes, whether `compatibleWith` is unilateral
  or mutual, or where a pairwise conflict diagnostic points. The schema also permits duplicate
  channel and compatibility entries and references to capability IDs absent from the resolved
  catalog set.
- Implementation decision: Attachment matching is exact and case-sensitive. A behavior may attach
  when the parent component capability ID occurs in `attachTo.capabilities` **or** its declared
  category occurs in `attachTo.categories`. The two routes form an OR union; an explicitly present
  empty union rejects every attachment. `exclusiveChannels` is interpreted as a set. Conflicts are
  evaluated independently for every behavior pair attached to the same component node, and a
  shared exclusive channel is allowed only when each behavior contract lists the other's exact
  capability ID in `compatibleWith`. Two instances of the same behavior capability therefore
  require that capability to list itself. The deterministic `BEHAVIOR_CONFLICT` diagnostic points
  to `/use` on the later behavior in document order; an attachment failure points to that
  behavior's `/use`. Dangling `attachTo.capabilities` or `compatibleWith` entries receive no
  invented core meaning and no new `UNKNOWN_CAPABILITY` failure: they simply cannot authorize an
  attachment or compatibility relationship that is not present in the resolved pair.
- Future action: Standardize attachment-union, empty-list, channel-set, mutual-compatibility,
  self-compatibility, referential-integrity, and pairwise diagnostic-location rules in a future
  protocol revision.

## PF-013 — Event payload data and diagnostic locations are underspecified

- Status: OPEN
- Blocks proof: No; the validator and runtime can share a documented inert-payload profile.
- Protocol location: SPEC Sections 14.2.5, 17.7, and 21.4; Appendix B
- Observation: An adapter-emitted payload is not stored at a Source or Bundle JSON Pointer, while
  `EVENT_PAYLOAD_INVALID` does not define a pointer model for external data. DESEN value forms also
  use objects containing `$ref`, `$token`, or `$format`, but the protocol does not say that an event
  payload object with one of those ordinary property names becomes an executable binding.
- Implementation decision: A resolved event payload enters validation as a detached, immutable,
  inert JSON snapshot and is checked in complete mode against the declared `payloadSchema`.
  `$ref`, `$token`, and `$format` inside that resolved payload are ordinary JSON members and never
  produce binding obligations. `EVENT_PAYLOAD_INVALID` uses an RFC 6901 pointer relative to the
  payload root, including the empty pointer for a root failure, plus the available stable
  node/behavior and capability context. Unsafe or otherwise inadmissible payload schemas fail
  catalog preparation at their exact catalog schema pointer with
  `run.desen.validator/INVALID_INTERACTION_CONTRACT`. This validator primitive is preparation for
  `N-033`; adapter parity and runtime enforcement remain assigned to M03-T09 and M04-T14, so M02-T09
  does not claim that mandatory clause complete.
- Future action: Define a normative external-value diagnostic envelope, payload pointer base, and
  explicit separation between resolved JSON data and authoring-time ValueSpec forms.

## PF-014 — Behavior command reachability and asynchronous event scope are underspecified

- Status: OPEN
- Blocks proof: No; M02-T09 can preserve the closed boundary without inventing a new action.
- Protocol location: SPEC Sections 14.2.5, 19.4, 20.4, 20.6, and 21.5; Source and Bundle Schema
  `$defs/actionSpec` and Catalog Schema `$defs/behaviorCapability`; Appendix B
- Observation: Behavior capabilities may declare commands, but DESEN 0.1.0 defines only the
  `component.command` action and describes its target as a component node. The protocol therefore
  provides no data-only action for invoking a behavior command. It also says `event.*` is scoped to
  the current component or behavior event while operation settlement handlers execute in a new
  action turn, without stating whether the original event payload survives into that turn.
- Implementation decision: M02-T09 validates a command name only after its target is already known
  to be a component node and reports an undeclared name with `UNKNOWN_COMMAND` at the action's
  `/command` member. Target existence and kind, conditional/repeated liveness, resolved input, and
  `COMMAND_INPUT_INVALID` remain M02-T11 responsibilities. Behavior command schemas are prepared
  through the interaction-contract safety boundary, but `component.command` is never redirected to
  a behavior and no `behavior.command` semantics are invented. Static `event.*` path and settlement
  scope validation remains with M02-T10, and runtime lifetime behavior remains with M04-T14. Command
  declaration validation alone does not complete the adapter-implementation obligation in `N-034`.
- Future action: Decide whether to add a behavior-command action and specify event-payload lifetime
  across asynchronous settlement turns in a future protocol revision.
