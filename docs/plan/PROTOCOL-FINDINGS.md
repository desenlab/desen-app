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
  a behavior and no `behavior.command` semantics are invented. M02-T10 treats `event.*` as lexical
  data available only during the immediate ordered action turn of the component or behavior handler
  that declared the event. Guards and values in that immediate action array may use the event
  payload. An `operation.invoke` action's `onSuccess` and `onFailure` arrays are new settlement turns,
  so they cannot retain the originating `event.*` scope even though they are nested beneath the
  original action in the document. A statically placed settlement reference fails with
  `REFERENCE_UNRESOLVED` at its `$ref` member. This is a document-scope decision only; adapter
  payload lifetime and runtime turn behavior remain with M04-T14. Command declaration validation
  alone does not complete the adapter-implementation obligation in `N-034`.
- Future action: Decide whether to add a behavior-command action and specify event-payload lifetime
  across asynchronous settlement turns in a future protocol revision.

## PF-015 — Lexical references, fallbacks, and conservative schema-path proof are underspecified

- Status: OPEN
- Blocks proof: No; the validator can reject only definite failures and retain explicit runtime
  obligations for values that cannot be proved statically.
- Protocol location: SPEC Sections 10.4, 14.2–14.3, 17.2, and 25.1; Source and Bundle Schema
  `$defs/refSpec` and `$defs/valueSpec`; Appendix B
- Observation: The frozen schemas validate reference syntax and the seven namespace names, but do
  not establish whether a referenced declaration or lexical alias exists, whether a deeper path is
  permitted by an embedded schema, or how unions, open objects, and conditional JSON Schema
  branches affect static path proof. The prose distinguishes a missing value from JSON `null` and
  permits a type-valid fallback, but it does not say whether fallback may authorize an otherwise
  invalid lexical scope or which diagnostic location represents a failed reference.
- Implementation decision: M02-T10 validates only the namespaces whose lexical owners are available
  at this stage: surface-local `state`, active repeat `item`, and the immediate-handler `event`
  scope defined by `PF-014`. Resource and operation lifecycle paths remain M02-T11 work;
  `context`, `env`, and token-provider results remain runtime inputs. A fallback may discharge a
  missing value only after the reference itself is lexically legal. Where a T10-owned consumer has
  a static type requirement, such as a predicate or repeat, that requirement also constrains the
  fallback; general resolved-value compatibility remains M06/runtime work. Fallback cannot create
  an inactive item alias, carry an event into a settlement turn, or legalize an unknown namespace.
  JSON `null` is a resolved value and does not select fallback. Deep schema paths are rejected only
  when every applicable, locally resolvable schema branch proves the path impossible. Open,
  conditional, recursive, or otherwise ambiguous paths are accepted for later validation rather
  than guessed successes or failures. T10 adds no new obligation kind; it preserves the four T09
  resolved-value obligations unchanged. `REFERENCE_UNRESOLVED` points to the exact `$ref` member
  for a definite missing or out-of-scope reference.
- Future action: Define a normative static path-compatibility algorithm, fallback typing rules,
  diagnostic pointers, and the boundary between publisher proof and runtime obligation.

## PF-016 — Predicate argument categories and static type compatibility are underspecified

- Status: OPEN
- Blocks proof: No; M02-T10 can apply a conservative type lattice without executing predicates.
- Protocol location: SPEC Sections 15–15.2; Source and Bundle Schema `$defs/predicateSpec`;
  Appendix B
- Observation: The schema permits each predicate argument to be either a `ValueSpec` or another
  predicate. The operator table defines arity and result semantics but does not fully state which
  operators accept nested predicates, whether `all`, `any`, and `not` implicitly truth-convert
  ordinary values, whether `exists` accepts a non-reference value, or when a schema-derived type is
  sufficiently certain to report a static mismatch.
- Implementation decision: A nested predicate has boolean result type. `all`, `any`, and `not`
  accept nested predicates or ValueSpecs that are statically boolean; they do not silently apply the
  broader `truthy` conversion. `truthy` remains the explicit conversion operator. `exists` accepts
  one reference and tests whether the original reference resolves, including to JSON `null`; a
  fallback does not turn a missing original value into an existing one. `eq` and `neq` permit any
  two resolved JSON values and use canonical JSON equality. Ordering is valid only for two numbers
  or two strings. `in` and `contains` retain the exact array/string operand directions stated in the
  operator table. M02-T10 reports `PREDICATE_TYPE_MISMATCH` only for a definite static
  incompatibility and otherwise defers the dynamic decision to the publisher/runtime. It validates
  structure, scope, and type compatibility but does not evaluate runtime truth, add a predicate
  obligation kind, or perform host effects.
- Future action: Specify a normative predicate type system, nested-predicate grammar, `exists`
  fallback semantics, and diagnostic pointer rules.

## PF-017 — Format placeholder grammar and matching rules are underspecified

- Status: OPEN
- Blocks proof: No; a small deterministic parser can implement the closed 0.1.0 format surface.
- Protocol location: SPEC Section 14.5; Source and Bundle Schema `$defs/formatSpec`
- Observation: DESEN 0.1.0 says placeholders use `{name}` and must match keys in `values`, but it
  does not define escaping, unmatched or nested braces, repeated placeholders, unused value keys,
  prototype-inherited keys, or a diagnostic location for a malformed template. A general-purpose
  template engine would add semantics and executable surface that the protocol does not authorize.
- Implementation decision: M02-T10 uses a single-pass linear parser. A placeholder is exactly an
  ASCII identifier matching `[A-Za-z_][A-Za-z0-9_]*` between one `{` and the next `}`. Bare,
  unmatched, empty, or nested braces are invalid; 0.1.0 invents no brace-escape syntax. Repeating a
  valid placeholder is allowed. The set of placeholder names must exactly equal the own-property
  keys of `values`: a missing value fails at the template and an unused value fails at that value
  member. Each mapped value remains an ordinary recursively validated `ValueSpec`. Parsing performs
  no expression evaluation, property-chain lookup, regex backtracking, code generation, locale
  inference, or prototype lookup. A malformed or mismatched format uses
  `run.desen.validator/INVALID_BINDING_CONTRACT`.
- Future action: Standardize placeholder escaping, Unicode policy, duplicate and unused-key
  behavior, and exact diagnostic locations in a future protocol version.

## PF-018 — Repeat evaluation order, alias scope, key identity, and limit behavior are underspecified

- Status: OPEN
- Blocks proof: No; a lexical, type-sensitive profile can preserve deterministic behavior without
  claiming runtime materialization.
- Protocol location: SPEC Sections 14.2.6 and 17.6; Source and Bundle Schema `$defs/repeatSpec`;
  Appendix B
- Observation: DESEN 0.1.0 requires array items, an introduced alias, unique string or number keys,
  and a limit, but it does not state whether `items` may see its own alias, the precise subtree in
  which an alias is active, whether string and numeric keys with similar spelling collide, or what
  static validation should do when a known item count exceeds an explicit limit. Runtime instance
  encoding and asynchronous alias lifetime are also left open.
- Implementation decision: `items` is evaluated in the incoming outer scope before the new alias
  exists. The alias becomes active for `key` and for the repeated node's props, styles, conditions,
  variants, behaviors, handlers, slots, and descendants. It does not leak to siblings or ancestors.
  A nested repeat may see outer aliases but cannot reuse any active alias, and its own `items` cannot
  refer to the alias it is about to introduce. A statically known non-array produces
  `REPEAT_ITEMS_INVALID`. For statically enumerable items, each key must resolve to a string or
  finite number and be unique under type-sensitive canonical JSON identity; a missing, non-scalar,
  or duplicate key produces `REPEAT_KEY_INVALID`. Because Appendix B limits those two codes to item
  type and key validity, an active-alias collision and a known direct array longer than an explicit
  `limit` use `run.desen.validator/INVALID_BINDING_CONTRACT` at `as` and `limit`, respectively.
  Dynamic item collections, keys, global repeat caps, runtime instance identity, and asynchronous
  lifetime remain M04/M12 responsibilities rather than being guessed by T10.
- Future action: Define repeat evaluation order, lexical extent, key canonicalization, overflow
  behavior, default limits, instance identity, and asynchronous alias lifetime normatively.

## PF-019 — State identifier, reference, and action-path grammars do not align

- Status: OPEN
- Blocks proof: No; the implementation can use the prose's first-segment rule without inventing a
  longest-prefix lookup.
- Protocol location: SPEC Sections 5.1, 14.2.1, 16.1, and 20.1–20.2; Source and Bundle Schema
  `$defs/refSpec`, `$defs/stateSpec`, and the `state.set`/`state.toggle` action branches; Appendix B
- Observation: State identifiers permit `.`, `:`, and `-`, reference segments use a narrower
  grammar, and state action paths reuse the broad identifier pattern while prose says the first
  segment names the state entry. A document may therefore declare a structurally valid state name
  that cannot be addressed unambiguously, especially when both `profile` and `profile.name` exist.
  Appendix B classifies `STATE_WRITE_INVALID` as a runtime write failure, while T10 owns only narrow
  static target evidence and M02-T11 owns the complete state-action semantics.
- Implementation decision: M02-T10 does not perform longest-prefix matching. In `state.<name>`, the
  second reference segment is the complete state-entry name. In a `state.set` or `state.toggle`
  path, the substring before the first `.` is the complete state-entry name and later segments are
  a nested path. A valid declaration that cannot be represented by those segment rules remains
  legal until addressed; an attempted ambiguous or absent target fails deterministically. State
  `initial` is resolved inert JSON, not a `ValueSpec`, and is checked in complete mode against the
  prepared state schema. An unsafe state schema or invalid initial value uses
  `run.desen.validator/INVALID_BINDING_CONTRACT` at the applicable schema or initial-value pointer.
  T10's only state-action check is that the first path segment names a declared state entry; failure
  uses `STATE_WRITE_INVALID` at the action's `/path`. Nested-path compatibility, the resulting
  complete `state.set` value, boolean-only `state.toggle`, runtime writes, and action execution
  remain M02-T11/M04 responsibilities.
- Future action: Align the identifier and path grammars, define an escaping or segment-array form,
  distinguish invalid initial state from invalid runtime writes, and assign exact diagnostics.
