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
  not present it as a universal 0.1.0 rule. M03-T04 implements the versioned binary framing and
  exact verification procedure; `PF-026` records the necessary Catalog self-field projection.
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

## PF-004 — Upstream `v0.1.0` release provenance

- Status: RESOLVED on 2026-07-24
- Blocks proof: No; the exact commit is recorded.
- Observation: When the implementation baseline was frozen on 2026-07-21, commit
  `b0bd7c4f0f61555b1d90e3a2ceb90d6e3d43daca` was clean and published but had no version tag.
- Resolution: Annotated tag `v0.1.0`, tag object
  `5ce0e4ab93cbd8bb5009a7664fddc5449edd359e`, now points to that exact commit. The public
  [DESEN Protocol 0.1.0 release](https://github.com/desenlab/desen-protocol/releases/tag/v0.1.0)
  is marked as a pre-release because the frozen specification remains a Working Draft. Tagging
  changed no protocol, schema, example, conformance, or checksum byte.
- Future action: Publish later protocol versions under new immutable tags and sibling baseline
  directories instead of rewriting 0.1.0.

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
  boundary does not by itself prove the adapter obligations in `N-033` or `N-034`. M02-T11 extends
  the identical profile to all operation and resource `inputSchema` and `outputSchema` locations;
  those execution-owned preparation failures use
  `run.desen.validator/INVALID_EXECUTION_CONTRACT`. The detached execution-value boundary applies
  only schemas already admitted through this profile.
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
- Blocks proof: No; T09–T11 can preserve the closed boundary without inventing a new action or
  claiming runtime liveness.
- Protocol location: SPEC Sections 14.2.5, 19.4, 20.4, 20.6, and 21.5; Source and Bundle Schema
  `$defs/actionSpec` and Catalog Schema `$defs/behaviorCapability`; Appendix B
- Observation: Behavior capabilities may declare commands, but DESEN 0.1.0 defines only the
  `component.command` action and describes its target as a component node. The protocol therefore
  provides no data-only action for invoking a behavior command. It also says `event.*` is scoped to
  the current component or behavior event while operation settlement handlers execute in a new
  action turn, without stating whether the original event payload survives into that turn.
- Implementation decision: M02-T09 validates a command name only after its target is already known
  to be a component node and reports an undeclared name with `UNKNOWN_COMMAND` at the action's
  `/command` member. M02-T11 indexes component nodes per surface. A missing, behavior, or
  cross-surface target reports `UNKNOWN_COMMAND` at `/target`; the action is never redirected to a
  behavior and no `behavior.command` semantics are invented. A declared component remains a valid
  static target even when its `when` or `repeat` means the runtime may not currently have a mounted
  instance. M02-T11 applies the selected command's `inputSchema` to statically known input members
  and emits `component-command-input` obligations for dynamic members. The runtime must resolve and
  validate the final input and select a live repeated instance before adapter invocation.
  M02-T10 treats `event.*` as lexical data available only during the immediate ordered action turn
  of the component or behavior handler that declared the event. Guards and values in that immediate
  action array may use the event payload. An `operation.invoke` action's `onSuccess` and `onFailure`
  arrays are new settlement turns, so they cannot retain the originating `event.*` scope even though
  they are nested beneath the original action in the document. A statically placed settlement
  reference fails with `REFERENCE_UNRESOLVED` at its `$ref` member. These are static contract and
  document-scope decisions only; adapter payload lifetime, mounted-instance liveness, and runtime
  turn behavior remain with M04. Command validation alone does not complete the adapter
  implementation obligation in `N-034`.
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
- Implementation decision: M02-T10 validates surface-local `state`, active repeat `item`, and the
  immediate-handler `event` scope defined by `PF-014`. M02-T11 adds surface-declared `resource`
  instances and surface-wide `operation` aliases. Both lifecycle namespaces admit only `status`,
  `pending`, `value[.<path>...]`, and `error.code`; paths under `value` are inspected
  conservatively against the selected output schema. Resource status/pending are statically
  present; operation lifecycle fields and both value/error branches may be absent until the
  applicable runtime transition. `context`, `env`, and token-provider results remain runtime
  inputs. A fallback may discharge a missing value only after the reference root is lexically
  legal. It cannot create an unknown resource, operation alias, inactive item alias, carry an event
  into a settlement turn, or legalize an unknown namespace. Where a consumer has a static type
  requirement, such as a predicate or repeat, that requirement also constrains the fallback;
  general resolved-value compatibility remains runtime work. JSON `null` is a resolved value and
  does not select fallback. Deep schema paths are rejected only when every applicable, locally
  resolvable schema branch proves the path impossible. Open, conditional, recursive, or otherwise
  ambiguous paths are accepted for later validation rather than guessed successes or failures.
  T10 preserves the four T09 obligations; T11 adds command, operation, resource input, and state
  write obligations. `REFERENCE_UNRESOLVED` points to the exact `$ref` member for a definite missing
  or out-of-scope reference.
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
- Protocol location: SPEC Sections 8.1, 14.2.1, 16.1, and 20.1–20.2; Source and Bundle Schema
  `$defs/refSpec`, `$defs/stateSpec`, and the `state.set`/`state.toggle` action branches; Appendix B
- Observation: State identifiers permit `.`, `:`, and `-`, reference segments use a narrower
  grammar, and state action paths reuse the broad identifier pattern while prose says the first
  segment names the state entry. A document may therefore declare a structurally valid state name
  that cannot be addressed unambiguously, especially when both `profile` and `profile.name` exist.
  Appendix B classifies `STATE_WRITE_INVALID` as a runtime write failure, while T10/T11 can prove
  only the subset decidable without the current runtime state.
- Implementation decision: M02-T10 and M02-T11 do not perform longest-prefix matching. In
  `state.<name>`, the second reference segment is the complete state-entry name. In a `state.set` or
  `state.toggle` path, the substring before the first `.` is the complete state-entry name and later
  segments are a nested path. A structurally valid dotted declaration therefore remains legal but
  is not addressable as one state name; if a prefix state also exists, the same text addresses that
  prefix's nested path. State `initial` is resolved inert JSON, not a `ValueSpec`, and is checked in
  complete mode against the prepared state schema. An unsafe state schema or invalid initial value
  uses `run.desen.validator/INVALID_BINDING_CONTRACT` at the applicable schema or initial-value
  pointer. T10 establishes the declared first segment. T11 rejects a definitely missing nested path
  and a statically incompatible `state.set` value, and rejects a `state.toggle` path whose only
  possible type is non-boolean. Dynamic values become `state-write` obligations. Every accepted
  toggle and nested patch also retains a `state-write` obligation when the complete post-write value
  requires current runtime state or conditional-schema evaluation. M04 owns mutation, atomicity,
  final post-write validation, and action execution.
- Future action: Align the identifier and path grammars, define an escaping or segment-array form,
  distinguish invalid initial state from invalid runtime writes, and assign exact diagnostics.

## PF-020 — Operation alias reuse and lifecycle ownership are underspecified

- Status: OPEN
- Blocks proof: No; a deterministic surface-local profile can reject only conflicting ownership.
- Protocol location: SPEC Sections 14.2.4 and 20.4; Source and Bundle Schema
  `$defs/actionSpec` `operation.invoke` branch
- Observation: DESEN 0.1.0 says an operation alias owns one observable lifecycle and is scoped to
  its surface, but neither prose nor schema requires alias uniqueness or defines whether two
  invocations may intentionally share that lifecycle. It also does not say what happens when the
  same alias names different operation capabilities in separate handlers or settlement turns.
- Implementation decision: M02-T11 indexes aliases across every action in one surface before
  validating lifecycle references, so textual order does not change reference validity. Reusing an
  alias for the same exact operation shares one static lifecycle contract and is accepted. Reusing
  it for a different operation is rejected at the later action's `/as` with
  `run.desen.validator/INVALID_EXECUTION_CONTRACT`. Aliases in different surfaces remain isolated.
  This establishes schema identity only; the runtime still owns concurrency, invocation identity,
  stale settlement, queueing, cancellation, and lifecycle transitions.
- Future action: Specify alias uniqueness or intentional sharing, collision diagnostics, and the
  relationship between alias ownership, concurrency modes, nested settlement turns, and invocation
  identity.

## PF-021 — Several action failures have no action-specific diagnostic mapping

- Status: OPEN
- Blocks proof: No; the frozen starter mappings are deterministic and do not add new core codes.
- Protocol location: SPEC Sections 16.2, 20.3, 20.5, and 20.6; Appendix B; frozen
  `tools/validate.py`
- Observation: Appendix B describes `ENTRY_NOT_FOUND` as an entry-surface error,
  `REFERENCE_UNRESOLVED` as a required-value error, `UNKNOWN_COMMAND` as an undeclared command, and
  `RESOURCE_INPUT_INVALID` as an input-schema error. DESEN 0.1.0 assigns no narrower code for a
  missing navigation surface, missing refresh instance, missing/wrong-kind command target, or a
  structurally valid resource policy unsupported by its capability.
- Implementation decision: M02-T11 preserves the frozen starter behavior: an unsupported resource
  policy uses `RESOURCE_INPUT_INVALID` at `/policy`; a missing core navigation target uses
  `ENTRY_NOT_FOUND` at `/surface`; a missing `resource.refresh` instance uses
  `REFERENCE_UNRESOLVED` at `/resource`; and a missing, behavior, or cross-surface
  `component.command` target uses `UNKNOWN_COMMAND` at `/target`. A declared component with an
  unknown command continues to use `UNKNOWN_COMMAND` at `/command`. No new core diagnostic identity
  or classification is invented.
- Future action: Add normative action-target and unsupported-policy diagnostics, or explicitly
  standardize these reused codes and their exact pointer locations.

## PF-022 — Resolved execution inputs and outputs have no normative detached-value boundary

- Status: OPEN
- Blocks proof: No; one inert boundary can be shared by publishers, runtimes, and adapters.
- Protocol location: SPEC Sections 20.4, 20.6, 21.5, and 22.1–22.2; Catalog Schema
  operation/resource `inputSchema` and `outputSchema` locations; Appendix B diagnostics
  `COMMAND_INPUT_INVALID`, `OPERATION_INPUT_INVALID`, `OPERATION_OUTPUT_INVALID`,
  `RESOURCE_INPUT_INVALID`, and `RESOURCE_OUTPUT_INVALID`
- Observation: Dynamic command, operation, and resource inputs must be checked after ValueSpec
  resolution, while operation/resource outputs do not exist inside the Source or Bundle and have no
  document-relative JSON Pointer. The protocol requires output validation before exposure but does
  not define a portable API envelope, safety limits, pointer base, or mandatory adapter/runtime
  handoff.
- Implementation decision: M02-T11 exposes `validateDesenExecutionValue` with five exact selector
  kinds: component-command input, operation input/output, and resource input/output. Selector and
  value are copied through the same bounded inert JSON snapshot used by event payloads, recursively
  frozen, and checked in complete `resolved-value` mode against a T11-prepared schema. Diagnostic
  pointers are relative to the detached value root, including `""` for a root failure. ValueSpec-like
  property names remain ordinary data and create no obligation. Document validation emits input
  obligations for unresolved members; it does not invent operation-output or resource-output
  obligations for values that do not yet exist. The runtime must call the detached boundary before
  invoking a command/capability or exposing a successful output. The API proves the primitive, not
  that every production adapter uses it.
- Future action: Standardize the external execution-value envelope, limits, pointer base, selector
  identity, and mandatory pre-invocation/post-settlement validation points.

## PF-023 — Lifecycle root identifier and reference-segment grammars do not align

- Status: OPEN
- Blocks proof: No; the validator can use the frozen segment rule without guessing an escape
  convention.
- Protocol location: SPEC Sections 8.1, 14.2.3–14.2.4, 16.2, and 20.4; Source and Bundle Schema
  `$defs/refSpec`, surface `resources` property names, and `operation.invoke.as`
- Observation: Resource-instance and operation-alias identifiers use the local-identifier grammar,
  which permits `.` and `:`, while `$ref` encodes namespaces and paths as unescaped dot-separated
  segments whose grammar excludes `:`. A structurally valid resource named `store.list` or alias
  named `save.profile` therefore cannot be distinguished from root `store`/`save` followed by a
  lifecycle path. A root such as `store:list` cannot appear in a structurally valid reference at
  all. This is the same grammar mismatch recorded for state in `PF-019`.
- Implementation decision: M02-T11 follows the frozen starter and `PF-019` profile: the second
  segment after `resource` or `operation` is the complete root identifier. No longest-prefix
  matching, backtracking, or implicit escaping is invented. Dotted and colon-bearing declarations
  remain structurally legal but are unaddressable as one root through core lifecycle references;
  when a dotted prefix declaration exists, the text addresses that prefix and the remaining
  segments are interpreted as lifecycle/path segments. Refresh actions still name a resource
  directly and are not parsed as `$ref` paths.
- Future action: Align local-identifier and reference grammars, forbid dot/colon separators for
  lifecycle roots, or add a normative escaped or segment-array reference form with unambiguous
  diagnostic behavior.

## PF-024 — Manifest registration and executable host binding APIs are distinct

- Status: OPEN
- Blocks proof: No; the reference implementation can keep the data and executable boundaries
  separate.
- Protocol location: SPEC Sections 7.4 and 22.4; informative IMPLEMENTATION-GUIDE Section 3;
  Catalog Schema behavior, operation, and resource capability definitions
- Observation: The informative guide sketches one host registration API whose component entry
  carries production and authoring adapters and whose operation/resource entries carry `execute`
  and `read` functions. The normative Catalog schema contains only inert manifests and defines no
  executable binding field. Section 7.4 also allows application-supplied bindings but defines no
  Catalog marker for that choice. A single `register*` name can therefore ambiguously mean manifest
  authoring or trusted host-code binding.
- Implementation decision: `@desen/catalog-sdk` uses `registerComponent`, `registerBehavior`,
  `registerOperation`, and `registerResource` only for exact `{ id, manifest }` JSON snapshots.
  Executable component and behavior adapters remain renderer-owned, while operation and resource
  implementations remain host-owned. M03-T08 exposes the exact inert sign-in contract only from
  `@desen/reference-catalog-web/operations` and exposes its application-supplied executable
  delegation only from the separate `@desen/reference-catalog-web/host-operations` subpath. The
  binding factory fixes the capability id and retains a trusted handler without executing,
  wrapping, or globally registering it. Generic host ports and runtime registries remain M04/M05
  work; DESEN documents and Catalog manifests never select code, endpoints, SDK calls, database
  queries, or authentication mechanisms.
- Future action: Name manifest and host-binding APIs distinctly in a later implementation guide
  revision and standardize an inert application-supplied binding declaration if interoperability
  requires one.

## PF-025 — Authoring control hints have no normative vocabulary

- Status: OPEN
- Blocks proof: No; a reference profile can derive conservative metadata from `propsSchema` while
  preserving hints as opaque presentation data.
- Protocol location: SPEC Sections 21.7 and 23.4; Catalog Schema
  `$defs/authoringSpec/properties/controls`; informative IMPLEMENTATION-GUIDE Section 4.3
- Observation: DESEN 0.1.0 defines `authoring.controls` only as an open JSON object. It does not
  define hint keys, values, nesting, precedence, or a deterministic mapping from JSON Schema
  features to editor widgets. The frozen example Catalog contains no `authoring.controls` example.
  Treating an implementation-specific hint vocabulary as normative would create a second,
  undocumented contract beside `propsSchema`.
- Implementation decision: M03-T03 derives framework-neutral inspector metadata only from the
  literal `propsSchema`. It preserves the complete authoring object, including control hints, as
  detached opaque JSON, but hints cannot change property existence, required state, value type, or
  enum options. The reference profile maps primitive and closed-object schemas conservatively and
  emits an explicit `structured-json` fallback for every unsupported, open, ambiguous, or
  over-budget subtree. Actual widgets and hint interpretation remain editor responsibilities.
- Future action: Define a versioned control-hint vocabulary and deterministic precedence rules in
  a later protocol or profile revision, with `propsSchema` remaining the validity authority.

## PF-026 — A package digest cannot literally include its final Catalog self-field

- Status: OPEN
- Blocks proof: No; one explicit target-profile projection removes the circular definition.
- Protocol location: SPEC Sections 7.4, 8.5, and 11.4; Catalog Schema `packageDigest`
- Observation: Section 11.4 says the package digest includes its Catalog and target adapters, while
  the Catalog itself requires that final `packageDigest`. Hashing the literal final Catalog would
  require finding a SHA-256 fixed point and does not define an implementable packaging procedure.
  DESEN 0.1.0 does not state which Catalog view participates in the digest.
- Implementation decision: The Web–React v1 profile includes canonical Catalog bytes with only the
  top-level `packageDigest` replaced by the reserved all-zero SHA-256 placeholder. Calculation
  requires that template value. Verification projects a published Catalog in the same way and then
  requires its declared digest to equal the calculated package digest. Changing only the published
  self-field therefore invalidates the package instead of defining different valid bytes under the
  same identity. All other Catalog fields and every exact target-artifact byte remain committed by
  the versioned framing. This is explicitly a Web–React ecosystem rule, not a retroactive DESEN
  0.1.0 core requirement.
- Future action: A later portable package/distribution profile should normatively define the
  Catalog self-field projection, byte container, verification order, and signature relationship.

## PF-027 — The abbreviated sign-in Alert tone conflicts with the authoritative Catalog

- Status: OPEN
- Blocks proof: No; the exact Catalog and complete sign-in fixtures agree on one spelling.
- Protocol location: SPEC Section 33 abbreviated sign-in example; frozen example Catalog
  `com.example.ui/Alert` props schema; complete sign-in Source and Bundle examples
- Observation: The abbreviated prose example uses `tone: "danger"` for Alert, while the
  authoritative Catalog schema and both complete sign-in fixtures use `tone: "critical"`.
  `danger` is valid only as a Button variant in that Catalog. Accepting both spellings would widen
  the closed Alert contract and make the reference capability disagree with the validator.
- Implementation decision: M03-T06 copies the frozen Catalog manifest exactly, accepts
  `info | success | warning | critical`, and rejects Alert `danger` at both compile-time and
  validation boundaries. The complete fixtures remain unchanged and no alias or migration is
  invented inside the Web–React component.
- Future action: Correct the abbreviated prose example through a versioned erratum or later
  protocol release without rewriting the frozen DESEN 0.1.0 snapshot.

## PF-028 — Pending is lifecycle state, not a static operation fixture payload

- Status: OPEN
- Blocks proof: No; the exact Catalog shape and normative lifecycle text support one conservative
  implementation.
- Protocol location: SPEC Sections 20.4, 22.3, and 23.3; Catalog Schema
  `$defs/operationAuthoringSpec`; informative IMPLEMENTATION-GUIDE Section 9
- Observation: The informative MVP checklist says operation fixtures cover pending, success, and
  failure, while the normative Catalog fixture shape permits only `success` and error-code entries.
  Section 20.4 separately says invocation enters `pending` synchronously before settlement. A
  literal `pending` fixture would therefore violate the frozen Catalog schema and conflate
  lifecycle state with a result payload.
- Implementation decision: M03-T08 preserves the exact official sign-in fixtures:
  `success: { userId: "user-1" }` and `errors.invalidCredentials: {}`. It does not invent a
  `pending` fixture key. M04-T09 owns the runtime transition into pending, and later Run Mode
  evidence must show that state while a controlled fixture or trusted host result is unresolved.
- Future action: Clarify the implementation guide so “pending fixture coverage” means exercising
  runtime pending state during fixture-backed execution, not adding a third static fixture shape.

## PF-029 — The M03 sign-in package is an exact Catalog slice, not the complete example Catalog

- Status: OPEN
- Blocks proof: No; the reference package can use a distinct Catalog identity and exact digest.
- Protocol location: Frozen Web Catalog example; SPEC Sections 7.4, 8.5, 11.4, and 22.4
- Observation: The frozen Web Catalog contains Map, Sortable, two additional operations, and two
  resources besides the five UI components and sign-in operation implemented by M03. Reusing
  `com.example.web-catalog@1.0.0` for only the sign-in capabilities would make a partial package
  look like the complete example contract and would conflict with the example's pinned digest.
- Implementation decision: M03-T09 proves exact entry-level equality only for Stack, Text,
  TextField, Button, Alert, and `com.example.auth/signIn`. Its parity metadata identifies the scope
  as `reference-sign-in-slice`, declares no behavior or resource, and contains no placeholder
  implementation. M03-T10 assigns the slice the distinct
  `run.desen.reference.sign-in@0.1.0` identity for `web-react`, composes only those six entries, and
  calculates its digest from the complete clean distribution inventory. Later controlled Source
  and Bundle fixtures must pin that exact tuple rather than claiming the original example package.
- Future action: Keep Map and Sortable in their M11 extension packages and document how multiple
  exact catalogs compose without mutating or impersonating the frozen example Catalog.

## PF-030 — The M03 tuple identifies a logical capability artifact, not an npm archive

- Status: OPEN
- Blocks proof: No; the M03-T04 profile already defines an exact deterministic logical file set.
- Protocol location: SPEC Sections 7.4, 8.5, 11.4, and 28.2
- Observation: DESEN 0.1.0 requires an immutable target-specific package tuple but deliberately
  leaves ecosystem archive encoding, metadata, signatures, dependency closure, and transport to
  the implementation. Claiming reproducible npm package bytes from only Catalog and adapter
  outputs would silently widen the proven boundary.
- Implementation decision: M03-T10 fingerprints the projected canonical `catalog.json` entry and
  every regular file in the clean `packages/reference-catalog-web/dist/**` tree, including
  JavaScript, declarations, and both source-map forms. It rejects stale, extra, missing,
  non-regular, or byte-different outputs. The exported on-disk Catalog is verified separately.
  `package.json`, source, dependency bytes, filesystem metadata, and npm/tar envelopes are explicit
  non-claims.
- Future action: Before public npm release, M12 must define and test the actual packed-file
  inventory, dependency and integrity policy, provenance/signature model, and archive
  reproducibility expectations without changing the meaning of this existing tuple.

## PF-031 — Host-port transport and persistence envelopes are implementation profiles

- Status: OPEN
- Blocks proof: No; a narrow fail-closed reference profile keeps the transport outside frozen
  document semantics.
- Protocol location: SPEC Sections 14.2.2, 14.2.7, 14.4, 20.3–20.5, 22, 24.1, 24.3, 24.5–24.6,
  27.6–27.7, and 28.2–28.3; Appendix B
- Observation: DESEN 0.1.0 assigns context, environment, navigation, token, operation, resource,
  authorization, diagnostics, immutable Bundle storage, and activation responsibilities to the
  host, but it does not define a TypeScript port API or an external settlement transport. Context
  schema/update policy and navigation-parameter lifecycle are explicitly profile-defined;
  environment paths have no normative value types; clock and scheduling semantics are absent;
  navigation/resource denial have no dedicated core diagnostics; and the repository's activation
  generation guard is not a frozen Bundle field. `PF-006`, `PF-020`, `PF-022`, and `PF-023` retain
  the related diagnostic, lifecycle, detached-value, and identifier ambiguities.
- Implementation decision: M04-T01 defines a platform-neutral reference API, not new protocol
  semantics. Operations and resources return only candidate success JSON, a candidate declared
  public error code, or policy denial; thrown/rejected implementations remain adapter failures.
  Navigation makes a synchronous accept/deny decision only after the runtime verifies a local
  active-Bundle target. Token, context, environment, clock, and diagnostic ports remain
  synchronous at their read/report boundaries. Token lookup distinguishes missing from resolved
  JSON `null`; context and environment expose atomic snapshots plus invalidation callbacks without
  inventing environment enums. Storage accepts only content-addressed immutable Bundle bytes and
  one atomic `{activeRevision, previousGoodRevision, generation}` compare-and-swap record, never
  arbitrary design-selected keys or user-input state. The host callback factory captures own data
  properties without invoking them; adapters therefore supply receiver-independent or pre-bound
  callables under an explicit `this: void` contract. The exact M04-T01 aggregate covers this
  integration slice only: allowlisted `event.emit`, component commands, and their generic bridges
  remain assigned to M04-T12/M04-T14 and require an intentional host-contract revision instead of
  an untracked extra port. Later tasks must detach and validate every request and settlement at
  runtime because TypeScript is not a trust boundary.
- Future action: A later versioned runtime/host profile should standardize transport cancellation,
  technical failures, resource/navigation denial diagnostics, environment value types, clock and
  cache semantics, diagnostic ordering, and activation persistence independently of the frozen
  Source/Bundle/Catalog schemas.

## PF-032 — Runtime value resolution uses a bounded atomic snapshot profile

- Status: OPEN
- Blocks proof: No; one narrow fail-closed runtime profile can resolve the frozen value forms
  without claiming a universal JavaScript object or host-lifecycle model.
- Protocol location: SPEC Sections 10.4, 14, 17.2, 20.4, 24.2, and 26.3; Appendix A read-only
  bindings; Appendix B `PROP_TYPE_MISMATCH` and `REFERENCE_UNRESOLVED`
- Observation: DESEN 0.1.0 defines seven read-only reference namespaces and distinguishes a missing
  value from JSON `null`, but it does not define a runtime snapshot API, atomicity mechanism,
  JavaScript hostile-object boundary, portable safety budgets, lifecycle observation envelope, or
  result union. It also leaves context content and updates profile-defined, assigns
  resource/operation transitions to later runtime behavior, and requires a fallback to be
  target-valid without making reference resolution itself aware of every eventual consumer
  schema. The protocol cannot guarantee that arbitrary caller-supplied strings contain no secrets,
  and JavaScript reflection over an arbitrary `Proxy` may execute its traps.
- Implementation decision: M04-T02 creates one detached, recursively frozen, factory-branded
  snapshot containing exact `state`, `context`, `resource`, `operation`, `event`, `item`, and `env`
  views before any namespace becomes observable. The snapshot and each ValueSpec share the
  resolved-data limits of depth 128, 4,096 JSON nodes, and 1,048,576 UTF-16 string units. Accessors,
  functions, promises, symbols, cycles, sparse or decorated arrays, non-finite numbers, reflection
  exceptions, and over-budget data fail closed. Accepted records must have a null prototype or an
  Object-constructor-compatible plain-record prototype. Ordinary prototype-bearing or class
  instances are rejected, only enumerable own data properties are copied, and inherited data is
  never observable; the profile does not claim that every adversarially spoofed custom prototype
  is detectable. Accessors are rejected without invoking getters. Arbitrary Proxy traps may run
  during necessary reflection, but thrown traps are contained and cannot expose a partial snapshot
  or resolved value; this profile does not claim a no-code-execution membrane for Proxy inputs.
  State, resource, operation, and item use exactly the second segment as the root; paths traverse
  own object properties and never arrays. Scope values shaped like another ValueSpec remain inert
  and are not evaluated again. The complete composed result is detached and checked again against
  all three budgets, preventing repeated legal references from amplifying node, string, or depth
  cost beyond the profile. Lifecycle views expose only exact idle, pending,
  succeeded-with-value, or failed-with-public-code envelopes, and event scope uses an explicit
  available/unavailable marker. Fallback is considered only for a missing path beneath a valid
  active scope/root. A selected value is still only a candidate: the exact consumer schema must
  validate it before adapter use, and a later `PROP_TYPE_MISMATCH` never causes fallback retry.
  Context-secret classification and the repository-wide secret audit remain planned; consumer type
  validation and adapter omission/failure composition remain M05; resource and operation
  transitions, concurrency, and settlement remain M04-T08/M04-T09. The task proof anchors these
  exact profile rules:
  - JSON null remains resolved and never selects fallback
  - unknown roots and inactive scopes cannot be legalized by fallback
  - token and format materialization remains deferred to M04-T03
    Snapshot map provenance is a runtime-composition precondition: the factory checks inert data,
    exact envelopes, detachment, and map presence, but does not independently reopen a Bundle or
    Catalog to prove declaration membership. M04-T16 retains that complete composition proof.
- Future action: A later versioned runtime profile should standardize cross-language snapshot and
  lifecycle envelopes, portable safety limits, cancellation/update atomicity, consumer-validation
  composition, context classification and redaction, and whether executable-language proxy-like
  inputs are categorically forbidden at public integration boundaries.

## PF-033 — Token and string-format materialization require a deterministic runtime profile

- Status: OPEN
- Blocks proof: No; one additive fail-closed materialization layer can complete the frozen token and
  format forms without changing the M04-T02 reference-resolution primitive or inventing a template
  language.
- Protocol location: SPEC Sections 14.4–14.5, 18.3–18.4, 26.3, and 27.2; Source and Bundle Schema
  `$defs/tokenSpec` and `$defs/formatSpec`; Appendix B `PROP_TYPE_MISMATCH`,
  `REFERENCE_UNRESOLVED`, and `ADAPTER_FAILURE`
- Observation: DESEN 0.1.0 requires host-owned token resolution and deterministic placeholder
  substitution, but it does not define a TypeScript materialization API, token-provider call
  ordering or reuse, provider-failure envelope, missing-token result shape, or conversion from a
  resolved non-string JSON value to placeholder text. The schema permits every format mapping to
  contain any recursively valid `ValueSpec`, including numbers, booleans, null, arrays, objects,
  nested formats, and tokens. JavaScript's implicit string conversion would introduce
  implementation-dependent object/array behavior and is therefore not an acceptable protocol
  profile.
- Implementation decision: M04-T03 adds `materializeRuntimeValue` as a new layer over the preserved
  M04-T02 `resolveRuntimeValue` API. The earlier API continues to return `deferred` for `$token` and
  `$format`; the additive API consumes those forms using the same factory-branded resolution
  snapshot plus an explicit trusted token port and request context. It reads no global provider and
  does not own, parse, or normalize a token document. Token names remain non-empty opaque strings.
  Object members use deterministic text order, arrays retain declared order, and format mappings use
  deterministic name order. Within one top-level call, one host lookup occurs per unique token name
  in one top-level materialization; later occurrences reuse the first detached, immutable outcome.
  A resolved JSON null is a successful token value, while a missing token uses
  `REFERENCE_UNRESOLVED` in a token-specific unresolved result and exposes no fallback or partial
  value. A thrown callback, malformed provider envelope, or unsafe/unbounded provider value fails
  closed; provider failures use a redacted `ADAPTER_FAILURE` without exposing the thrown value,
  stack, provider response, or a partial result.

  Formatting reuses the PF-017 single-pass ASCII placeholder grammar. Each distinct mapped
  `ValueSpec` is materialized once in the same snapshot and trusted token context before
  substitution. Repeated placeholders reuse that result. For substitution, raw strings are
  inserted unchanged; all other resolved JSON values use RFC 8785 canonical JSON. There is no
  locale inference, property lookup from template text, expression evaluation, markup execution,
  brace escaping, or implicit platform formatting. Nested materialization propagates exact RFC 6901
  pointers and fallback use; any unresolved, invalid, or adapter-failed child rejects the complete
  enclosing value. The final output is detached, recursively immutable, and checked again against
  the M04-T02 depth, JSON-occurrence, and UTF-16 string budgets.

  A successfully materialized token or formatted string is still only a candidate value. The exact
  target prop, style-part, command, operation, resource, or adapter schema must validate it before
  use; consumer-schema validation remains M05, and a later `PROP_TYPE_MISMATCH` does not retry token
  lookup, choose another value, or reinterpret formatting.

- Future action: A later versioned runtime profile should standardize cross-language canonical
  placeholder conversion, token-snapshot consistency and invalidation, provider technical-failure
  taxonomy, cache lifetime, request-context allocation, and whether a future protocol adds explicit
  locale-aware formatting capabilities.

## PF-034 — Runtime predicate and conditional-presence evaluation requires a deterministic profile

- Status: OPEN
- Blocks proof: No; one bounded, fail-closed evaluation profile can preserve the frozen operator
  results and conditional-presence distinction without claiming complete subtree lifecycle
  execution.
- Protocol location: SPEC Sections 14, 15–15.2, 17.4, 24.2–24.3, 26.3, and 27.8; Source and Bundle
  Schema `$defs/predicateSpec`, `$defs/valueSpec`, and `$defs/nodeSpec`; Appendix B
  `REFERENCE_UNRESOLVED` and `PREDICATE_TYPE_MISMATCH`
- Observation: DESEN 0.1.0 fixes thirteen predicate operators and their one-, two-, or 1–64-argument
  arities, the explicit truth conversion, canonical JSON equality, a consistent read snapshot,
  dynamic-mismatch-as-false behavior, and true conditional absence. It does not define nested
  predicate recognition within the overlapping `ValueSpec | PredicateSpec` argument grammar,
  short-circuit or diagnostic order, exact portable string comparison and membership algorithms,
  the effect of direct unresolved values beneath boolean composition, an aggregate predicate-tree
  budget, or a runtime result that distinguishes a valid false condition from invalid or deferred
  evaluation. The prose also does not define an API that composes the M04-T02 snapshot with M04-T03
  token and format materialization without creating a new snapshot or cache for each operand.
- Implementation decision: M04-T04 uses the frozen operator set and arities without extension:
  `all` and `any` accept 1–64 arguments; `not`, `exists`, and `truthy` accept one; and `eq`, `neq`,
  `gt`, `gte`, `lt`, `lte`, `in`, and `contains` accept two. At a predicate-argument position, an
  object is a nested predicate only when its own data properties form the exact closed
  `PredicateSpec`, its `op` is one of those thirteen names, and its `args` satisfy that operator's
  arity. An exact nested predicate has a resolved boolean result; another predicate-shaped JSON
  object remains a ValueSpec when structurally permitted and is never partially interpreted as a
  predicate.

  Evaluation is recursive left-to-right by argument position and does not short-circuit. Every
  argument is evaluated against the same snapshot, even after the operator's boolean result is
  known, so dynamic diagnostics and materialization observations have one deterministic order. A
  direct unresolved operand makes the current predicate false before that operator is applied. A
  nested predicate that has already evaluated false is instead an ordinary resolved boolean
  operand, so its parent may negate or combine that false value. A dynamically incompatible
  operand likewise makes its current predicate false and emits `PREDICATE_TYPE_MISMATCH` (`D-021`)
  at the exact incompatible argument pointer; complete left-to-right evaluation continues to
  collect later diagnostics.

  `truthy` is false exactly for JSON `null`, `false`, numeric zero, the empty string, an empty
  array, and an empty object; every other resolved JSON value is true. `eq` compares complete RFC
  8785 canonical JSON and `neq` is its inverse only after both operands resolve. Array forms of
  `in` and `contains` compare members with the same canonical JSON equality. Ordered strings use
  exact lexicographic UTF-16 code-unit order, while string membership uses an exact contiguous
  UTF-16 code-unit substring with no locale inference or Unicode normalization. Ordered numbers
  remain finite JSON numbers, and mixed string/number ordering is a dynamic mismatch.

  `exists` accepts one original reference, bypasses and does not evaluate its fallback, returns
  true when that reference resolves including to JSON `null`, and returns false when the otherwise
  valid reference is missing. This requires a reference-presence probe distinct from ordinary
  complete-value materialization.

  One top-level predicate uses the same factory-branded M04-T02 snapshot and its depth-128,
  4,096-JSON-occurrence, and 1,048,576-UTF-16-unit value limits. Because every nested predicate
  contributes both an object and an `args` array to that raw JSON depth, the predicate tree
  additionally permits at most 64 total predicate nodes (the root plus 63 nested nodes) and 4,096
  aggregate argument occurrences while retaining the frozen per-operator maximum of 64 arguments.
  A shared top-level complete-value resolution session preserves the snapshot, pointers, and
  materialization observations across every operand; operand-local snapshot or session recreation
  is forbidden. Resolution processes operands in document order and charges each completed value
  to the shared budget immediately. The first invalid or deferred terminal keeps its exact ordered
  precedence; otherwise a budget crossing returns before later operands can amplify retained
  copies. Boolean no-short-circuit behavior applies only after operand resolution completes.
  M04-T02 `deferred` token or format outcomes are not boolean false and are propagated as deferred
  evaluation. M04-T03 remains the owner of token/provider and format truth tables; T03 and T04
  composition is first consumed by M04-T05 and receives complete end-to-end proof in M04-T16. The
  package-internal seam brands the prepared plan and checks the outcome count; M04-T05 must
  additionally prove that every materialized outcome stays paired with its exact prepared operand
  position.

  Conditional presence returns only a decision. An omitted node `when` is present, evaluated true
  is present, and evaluated false is absent. Invalid or deferred evaluation prevents
  instantiation fail-closed but remains an explicit failure or deferred outcome, not a valid false
  condition. M04-T04 does not instantiate, dispose, subscribe, or prove inactivity of descendant
  resources, behaviors, events, commands, or adapters; reactive reevaluation and complete subtree
  lifecycle equivalence remain M04-T15/M04-T16.

- Future action: A later protocol revision should standardize nested-predicate disambiguation,
  complete evaluation and diagnostic order, unresolved composition, canonical membership, string
  ordering and substring behavior, aggregate predicate and raw-JSON depth limits, token-snapshot
  composition, conditional result envelopes, and the exact lifecycle effects of an absent subtree
  across platforms.

## PF-035 — Ordered variants and style overrides require a deterministic merge profile

- Status: OPEN
- Blocks proof: No; a bounded data-only selection layer can preserve document order and exact
  override precedence without materializing final component values or entering a framework
  adapter.
- Protocol location: SPEC Sections 5.6, 10.2, 10.5, 14–15.2, 17.5, 18–18.4, 24.2–24.3, 25.2, and
  27.8; Source and Bundle Schema `$defs/nodeSpec`, `$defs/variantSpec`, `$defs/styleSpec`,
  `$defs/predicateSpec`, and `$defs/valueSpec`; `N-014`, `PIPE-021`, and `R-060`
- Observation: DESEN 0.1.0 requires base props and style to apply first, every matching Variant to
  apply in array order, and the later matching value at one property path to win. It also fixes the
  three-level style hierarchy and prohibits structural child changes through variants. The frozen
  text does not define whether a prop's nested literal object is recursively merged, whether a
  visual-state map cascades from `base`, how token and format operands share one observation
  session across sibling conditions, how a failure in one condition affects the complete merge,
  how source provenance survives later overrides, or a direct maximum variant count. The frozen
  examples and conformance vectors contain no actual `variants` member, so runtime precedence
  evidence must be identified as project goldens rather than official vectors.
- Implementation decision: M04-T05 adds `evaluateRuntimeVariantOverrides`. It accepts only base
  `props`, base `style`, and the ordered `variants` array; the closed variant members remain
  `when`, `props`, `style`, and opaque `extensions`. The input is detached and checked against the
  shared depth-128, 4,096-JSON-occurrence, and 1,048,576-UTF-16-unit safety profile before any
  predicate or token callback runs. This finite aggregate input budget also bounds the otherwise
  schema-unbounded number of variants. Unknown extension data is detached and checked by the
  copied input boundary but receives no core meaning and does not enter the effective output.
  Raw output candidates and predicate operands then pass the T02 structural grammar followed by
  the T03 outer-first format-profile grammar without reading the runtime snapshot, invoking the
  token provider, or constructing formatted output.

  Variant predicates are prepared and evaluated in exact array order against one factory-created
  resolution snapshot, one captured request context, and one turn-scoped token session. The session
  caches the first detached resolved, missing, or failed observation for each unique opaque token
  name across all sibling predicates. Every materialized operand remains paired with its exact
  prepared position. Directly missing references or tokens make only their current predicate false;
  dynamic type mismatches likewise make that predicate false and append
  `PREDICATE_TYPE_MISMATCH` at its source-prefixed pointer. Malformed input, provider failure, or a
  finite-budget crossing terminates the complete evaluation in document order without exposing
  partial effective maps. `exists` retains the M04-T04 original-reference and fallback-bypass
  behavior.

  Base paths are selected first and every true variant then replaces only the paths it explicitly
  carries. `/props/{name}` is one indivisible override leaf.
  `/style/{state}/{part}/{property}` is one indivisible override leaf. Literal objects and arrays
  inside either ValueSpec are replaced as a whole and are never recursively merged. JSON `null` is
  a value, not a delete instruction; omitted paths leave the previous selection unchanged; and
  style state maps never cascade into one another. Variants cannot add or remove children. The
  accepted API has no capability, slot, child, behavior, repeat, handler, or other structural node
  field through which it could do so.

  A successful result contains detached, recursively immutable `effectiveProps` and
  `effectiveStyle` maps, every matching zero-based variant index in document order, ordered
  predicate diagnostics, and the exact winning Source/Bundle JSON Pointer for every leaf. JSON
  object-member order carries no protocol meaning; callers that need canonical bytes use the
  protocol's RFC 8785 serializer, including for legal integer-like prop names. The evaluator
  returns effective raw ValueSpecs, not final materialized props or styles. A winning reference,
  token, format, literal object, array, scalar, or JSON `null` therefore remains inert data with its
  source provenance intact. Consumer-schema validation and adapter delivery remain M05. Active
  visual-state selection also remains with the target adapter; M04-T05 neither materializes winning
  style values nor interprets CSS, DOM state, selectors, or component internals.

  M04-T05 proves the variant-order portion of `N-014`, but `N-014` remains `PLANNED` until its
  action, publication, and editor-order owners are complete. Reactive reevaluation remains
  M04-T15, and complete surface materialization remains M04-T16.

- Future action: A later protocol revision should standardize override-leaf granularity, variant
  failure and diagnostic order, cross-condition token-session lifetime, source provenance, an
  explicit variant-count limit, visual-state composition, and whether a future version introduces
  an explicit deletion form.

## PF-036 — Runtime local-state lifecycle and base node identity require a deterministic profile

- Status: OPEN
- Blocks proof: No; one bounded, handle-owned lifecycle and a repeat-free base identity can make
  the frozen state invariant executable without claiming later action, repeat, reactivity, or
  adapter behavior.
- Protocol location: SPEC Sections 8.1, 14.2.1, 16.1, 17.8, 20.1–20.2, 24.2–24.5, and 27.8;
  Source and Bundle Schema `$defs/stateSpec`, `$defs/actionSpec`, `$defs/nodeSpec`, and
  `$defs/repeatSpec`; `N-024`, `R-054`, `R-104`, `PIPE-018`, `D-019`, and `PF-019`
- Observation: DESEN 0.1.0 requires fresh surface-local ephemeral state, schema-valid initials,
  complete post-write validity, disposal on navigation away unless a future profile preserves
  state, and stable node identity across compatible reevaluation. It does not define a runtime
  handle/snapshot API, whether canonically identical writes create a new generation, whether a
  nested write may create containers or traverse arrays, the exact disposal visibility of a
  previously returned snapshot, or the repeat-free portion of a node-instance key. The frozen
  path grammar also admits dotted state declaration names and empty-looking dot boundaries that
  conflict with the prose's first-segment rule recorded in `PF-019`.
- Implementation decision: M04-T06 adds `mountRuntimeSurfaceState`,
  `readRuntimeSurfaceState`, `writeRuntimeSurfaceState`, and `disposeRuntimeSurfaceState`.
  Mount copies the complete declaration set through the M04-T02 bounded inert JSON boundary,
  checks every prepared schema against the generated Draft 2020-12 meta-schema, graph-checks it,
  and validates every initial with `complete` plus `resolved-value` semantics before exposing any
  handle or snapshot. An explicit `$vocabulary` declaration fails closed because the current
  interpreter does not claim vocabulary-dependent assertion support; otherwise a schema could
  declare `format-assertion` while the interpreter correctly treats `format` only as an
  annotation. One invalid declaration rejects the entire mount. Every successful mount is fresh,
  starts at generation zero, shares no live authority with an earlier mount, reads no persistence
  port, mutates no Source or Bundle byte, and retains state values only behind one factory-branded
  handle.

  A read returns one detached, recursively immutable complete value map that can directly become
  the `state` namespace of the M04-T02 resolution snapshot. A handle itself exposes no values.
  Dispose is terminal and idempotent: it removes the live schemas and current snapshot from the
  handle and prevents later writes. A previously returned immutable snapshot may remain as a
  historical caller-owned observation; secure erasure of an already returned JavaScript value is
  not claimed. Reopening the same surface creates the exact declared initials again. Deciding
  whether a successful or denied navigation triggers disposal belongs to M04-T10.

  `writeRuntimeSurfaceState` accepts only one already resolved inert JSON value and one path. It
  does not accept a guard, ValueSpec evaluator, toggle, navigation command, or action array. Per
  `PF-019`, the substring before the first `.` is the complete state-entry name and no
  longest-prefix or backtracking lookup occurs. A root-only path replaces the complete entry.
  Nested paths traverse only existing own object properties: arrays are never indexed, and missing
  intermediate containers are never invented. The final property may be absent and is created
  only when the resulting complete entry validates against its exact schema. Empty segments are
  rejected. Numeric-looking, colon, hyphen, `constructor`, and `__proto__` property names remain
  ordinary inert data without prototype mutation.

  Every candidate is detached and bounded before use. The runtime constructs it without changing
  the current snapshot, applies the exact prepared schema to the complete candidate using
  `complete` and `resolved-value`, rechecks the aggregate state budget, and swaps the current
  snapshot only after every check passes. A rejection returns `STATE_WRITE_INVALID` with no
  candidate or partial state; the current snapshot and generation remain identical. `$ref`,
  `$token`, and `$format` property names inside resolved state are ordinary JSON. JSON `null`,
  `false`, numeric zero, and the empty string remain values. A canonically identical candidate is
  `unchanged` and does not advance generation; a different accepted candidate advances generation
  exactly once.

  M04-T06 also adds one repeat-free `RuntimeNodeIdentity` whose stable structured key is the exact
  `{documentId, surfaceId, nodeId}` tuple. Revision, tree position, `use`, props, style, and adapter
  state are not part of that base key. Strings are compared exactly without trimming, case
  folding, or Unicode normalization. Reconciliation of the same tuple and same `use` returns the
  exact prior identity as `preserve-eligible`; this is eligibility, not a promise that an adapter
  can preserve its platform instance. The same tuple with a changed `use` is
  `remount-required` with a new mount generation. A changed document, surface, or node tuple is
  `replace-required` with a fresh base identity. Capability identifiers are checked by a bounded
  linear parser that accepts the exact frozen pattern language without evaluating its
  backtracking-prone redundant dotted group as a JavaScript regular expression. Repeat-key
  discrimination remains exclusively M04-T07, adapter preservation and remount-required property
  policy remain M05-T05, and reactive mount/unmount orchestration remains M04-T15.

  The shared runtime limits remain depth 128, 4,096 JSON occurrences, and 1,048,576 UTF-16 code
  units. Accessors, executable values, promises, symbols, cycles, non-finite numbers, sparse or
  decorated arrays, unsupported prototypes, reflection failures, forged handles/identities, and
  over-budget inputs fail closed. The implementation imports no React, React Native, DOM, CSS,
  browser, Node, application, locale, or dynamic-evaluation dependency.

- Future action: A later protocol revision should align state declaration and action-path
  grammars; standardize nested property creation, array addressing, no-op generations, snapshot
  retention, preservation profiles, and disposal timing; and define a cross-platform instance key
  that composes source-node identity, repeat identity, capability compatibility, and
  adapter-declared remount policy. Validator hardening must also replace direct execution of the
  frozen capability-ID regular expression with an equivalent linear matcher while preserving the
  frozen schema bytes and official validation language.

## PF-037 — Runtime repeat materialization and instance identity require a deterministic fail-closed profile

- Status: OPEN
- Blocks proof: No; one lexical, type-sensitive, non-truncating runtime profile can make the
  frozen repeat requirements executable without claiming full surface materialization or adapter
  preservation.
- Protocol location: SPEC Sections 14.2.6, 17.6, 24.2, 24.4, and 27.8; Source and Bundle Schema
  `$defs/repeatSpec`; `PIPE-021`, `R-045`, `R-061`, `R-104`, `R-123`, `D-022`, `D-023`, and
  `PF-018`
- Observation: DESEN 0.1.0 requires array items, one lexical alias, unique string or number keys,
  bounded materialization, stable repeated identity, and source-array order. It does not define a
  runtime scope API, whether overflow truncates or rejects, whether alias names or indexes enter
  instance identity, how nested key paths compose, or how a T02-only evaluator handles token and
  format forms. Retaining one complete resolution snapshot for every accepted item would also
  multiply unrelated state, context, resource, operation, event, and environment data by as many
  as 1,000 instances.
- Implementation decision: M04-T07 adds one factory-branded root repeat scope over a genuine
  M04-T02 snapshot whose `item` namespace is empty. A scope retains one shared base snapshot plus
  only its immutable active-alias map and ordered repeat-key path. A standard resolution snapshot
  is created on demand, preventing the successful result from retaining 1,000 copies of the full
  runtime snapshot.

  `items` resolves against the incoming parent scope before the new alias exists. Each item then
  receives an isolated child alias map for key evaluation and later node-body evaluation. Nested
  repeats see outer aliases but cannot reuse any active alias; disjoint siblings may reuse an
  alias because neither child scope mutates or leaks into its parent or sibling. Scalar items are
  valid and can be addressed directly through `item.<alias>`.

  Every key must resolve to a string or finite number. Its identity is exact RFC 8785 canonical
  JSON, so numeric `1` and string `"1"` are distinct while negative zero and zero collide. Items
  remain in original array order and are never key-sorted. One missing, non-scalar, or duplicate
  key rejects the complete repeated subtree with `REPEAT_KEY_INVALID`; a resolved non-array rejects
  it with `REPEAT_ITEMS_INVALID`. Unresolved item references preserve `REFERENCE_UNRESOLVED`, while
  token or format work remains an explicit `deferred` outcome rather than being mislabeled as an
  invalid repeat. M04-T16 owns composition with the already completed T03 materializer.

  The effective per-repeat ceiling is
  `min(repeat.limit ?? 1_000, 1_000)`. Exact-boundary materialization succeeds; overflow returns
  the documented project-owned `run.desen.runtime/REPEAT_LIMIT_EXCEEDED` outcome and never silently
  truncates. The global 5,000-node surface ceiling requires complete tree composition and remains
  M04-T16/M12-T05 work, so M04-T07 does not close `N-041`.

  Repeated identity is created from a fresh factory-authenticated T06 descriptor plus the complete
  outer-to-inner key path. Its canonical key contains the exact document, surface, source-node,
  and key-path tuple. Alias names, array indexes, item content, revision, props, and styles do not
  enter identity. Reordering equal keys preserves the exact prior identity; changing an own or
  ancestor key requires replacement; changing `use` on the same path requires a remount generation.
  Actual platform-instance preservation remains M05-T05.

  Repeat input crosses the existing bounded inert JSON boundary. Accessors, executable values,
  promises, symbols, cycles, non-finite numbers, sparse or decorated arrays, unsupported
  prototypes, forged scopes or identities, malformed closed objects, and over-budget input fail
  closed without partial instances. The module imports no React, React Native, DOM, CSS, browser,
  Node, application, locale, timer, random, or dynamic-evaluation dependency.

- Future action: A later protocol revision should standardize repeat overflow behavior, the
  token/format composition point, nested key-path encoding, whether aliases are diagnostic-only,
  the relationship between per-repeat and whole-surface limits, and the exact adapter
  preservation/remount contract.

## PF-038 — Resource lifecycle start, refresh, technical failures, and stale settlement require a deterministic runtime profile

- Status: OPEN
- Blocks proof: No; one surface-local, validation-first, latest-wins profile can execute the frozen
  lifecycle without inventing cache, retry, timeout, or transport-cancellation semantics.
- Protocol location: SPEC Sections 16.2, 17.4, 17.6, 24.2, 24.6, and 27.8;
  `PIPE-019`, `PIPE-024`, `R-042`, `R-055`, `R-079`, `R-090`, `R-114`, `R-122`, `D-027`, and
  `D-028`
- Observation: DESEN 0.1.0 defines surface-local resource declarations, `mount`, `once`, and
  `manual` policies, a four-state public lifecycle, explicit refresh, input/output schema checks,
  and Catalog-declared public errors. It does not define a framework-neutral manager API, whether
  declarations become visible before automatic loading, whether automatic resources observe each
  other's newly pending state, how request identities are allocated, what happens when refresh
  overlaps a pending request, or how denial and adapter failure map into a lifecycle whose failed
  state may expose only declared public error codes. Catalog cache hints likewise do not define a
  normative runtime cache, retry, timeout, or stale-while-revalidate algorithm.
- Implementation decision: M04-T08 atomically mounts the complete resource map as immutable
  `idle` lifecycles without invoking the host. A separate one-shot start evaluates every `mount`
  and `once` input against the same pre-start runtime snapshot, publishes all accepted requests as
  one pending generation, leaves `manual` resources idle, and then invokes host bindings in exact
  UTF-16 instance-ID order. A synchronous host result still settles through a Promise microtask,
  making the pending state observable. `once` limits only this automatic start; explicit refresh
  remains valid for every policy.

  Resource input is a map of named ValueSpecs, not one literal-object ValueSpec. M04-T08 sorts the
  parameter names, materializes their ValueSpecs as one synthetic array through M04-T03, then maps
  the resolved members back to their exact names before the complete object passes
  `validateDesenExecutionValue` in `resource-input` mode. This preserves protocol-legal parameter
  names beginning with `$` as ordinary keys, gives the whole request one atomic token cache, and
  subjects both the materialized array and reconstructed candidate to the shared depth-128,
  4,096-occurrence, and 1,048,576-UTF-16-unit boundary. A candidate request ID is visible to token
  lookup while input is prepared but is consumed only by an accepted resource attempt; a rejected
  preparation may therefore reuse the same deterministic candidate ID on its next explicit
  refresh.

  Capability policy and public-error membership are copied only from the exact
  factory-authenticated execution Catalog set. A caller cannot supply either. Successful host
  output is detached and checked in `resource-output` mode before lifecycle exposure; a failed
  envelope becomes public `failed` only when its code is an exact declared Catalog code.
  Undeclared codes and malformed, thrown, or rejected host results become redacted
  `ADAPTER_FAILURE` settlements. Host policy denial uses the documented project diagnostic
  `run.desen.runtime/RESOURCE_DENIED`. Because neither technical outcome may invent a declared
  public error, both return the public lifecycle to `idle` rather than exposing false success or a
  fabricated `error.code`. `RESOURCE_OUTPUT_INVALID` likewise exposes no candidate value.

  Each accepted request receives `resource:` plus RFC 8785 canonical JSON of
  `[instanceId, zeroBasedAttemptGeneration]`. Invalid or unresolved input consumes no attempt
  identity. Start and refresh require the exact current resource snapshot object issued by the
  same manager, so stale, foreign, and structurally ABA-equal lifecycle views fail closed. The
  broader state, context, operation, event, item, and environment namespaces still rely on a
  trusted compositor until M04-T16 proves them inside one complete session turn; M04-T08 does not claim
  cross-manager provenance for those namespaces. A valid overlapping refresh first materializes
  and schema-validates its input; only then does it logically supersede the prior attempt and
  publish a new pending generation. A stale or disposed settlement is rejected before its result
  envelope is inspected, so accessors and undeclared codes cannot create diagnostics or state.
  Disposal is terminal, replaces the retained handle authority with a small sentinel, and does not
  claim physical transport cancellation or secure erasure.

  Every immutable lifecycle map must itself fit the shared JSON boundary and remain directly
  usable as M04-T02's `resource` namespace. An individually valid output that would overflow the
  aggregate retained map is not exposed and produces
  `run.desen.runtime/RESOURCE_RETAINED_LIMIT_EXCEEDED`; no value is truncated or partially
  retained. The host may lower the exact attempt-generation, snapshot-generation, and active
  transport ceilings. A pending transition is accepted only when a terminal snapshot slot is
  reserved. At most 64 host loads are retained concurrently by default; later accepted attempts
  wait in a canonical finite queue, and a newer refresh replaces an older queued attempt for the
  same instance. Underlying transports that never settle remain uncancellable, but they cannot
  create an unbounded number of retained settlement closures. Cache hints, TTL,
  stale-while-revalidate, deduplication, retry, timeout, persistence, and cross-surface reuse are
  deliberate non-claims.

- Future action: A later protocol revision should standardize automatic-start snapshot timing,
  request identity, overlapping-refresh and cancellation behavior, technical-failure lifecycle
  visibility, aggregate retention and transport limits, full turn-snapshot provenance, and any
  normative cache-hint execution profile.

## PF-039 — Operation concurrency and settlement acknowledgement require a deterministic runtime profile

- Status: OPEN
- Blocks proof: No; one bounded surface-local profile can preserve the protocol's observable
  lifecycle and action-turn ordering without claiming physical transport cancellation.
- Protocol location: SPEC Sections 14.2.4, 17.7, 20.4, 22.1, 24.6, 26.5, 26.7, and 27.7;
  `SN-005`, `R-043`, `R-062`, `R-077`, `R-078`, `R-089`, `R-106`, `R-114`, `R-115`, `R-122`,
  `A-006`, `D-024`, `D-025`, and `D-026`; related findings `PF-020`, `PF-022`, and `PF-031`
- Observation: DESEN 0.1.0 gives one surface-scoped alias an observable lifecycle and defines
  `reject`, `replace`, and `queue`, but it does not define a runtime manager API, request identity,
  queue capacity, how queued work interacts with replacement, whether a completed transport may
  promote the queue before settlement actions finish, or how technical failures appear when the
  public lifecycle may expose only Catalog-declared error codes. Logical supersession is required
  to ignore stale settlement, while physical cancellation is explicitly optional.
- Implementation decision: M04-T09 atomically mounts the complete whole-surface alias inventory as
  immutable `idle` lifecycles. Every alias is fixed to one exact operation capability from the
  factory-authenticated execution Catalog set; invocation cannot create an alias or change that
  capability. The invocation carries the protocol action's operation identifier only as an exact
  assertion against that mounted alias; a mismatch consumes no identity or lifecycle generation
  and cannot call the host. The mounted Catalog record remains the sole authority for capability,
  effect, schemas, and public errors. The primitive accepts only a fully materialized inert input
  object. M04-T11 owns ValueSpec, token, and format composition, while M04-T09 independently
  detaches the candidate and applies the exact Catalog `operation-input` schema before any host
  call.

  An omitted concurrency member means `reject`. Invalid input and concurrency rejection consume no
  attempt generation. Every accepted started or queued invocation receives `operation:` plus RFC
  8785 canonical JSON of `[alias, zeroBasedAttemptGeneration]`. `reject` refuses a new invocation
  while the alias is pending. `replace` validates the new input first, then logically supersedes
  the active invocation and every accepted queued invocation for that alias before publishing the
  replacement as pending. `queue` accepts work in request order and promotes one invocation at a
  time. Stale and disposed transports are rejected before their result envelope is inspected.

  Successful output is detached and checked against the exact Catalog `operation-output` schema;
  only exact declared public error codes may enter a failed lifecycle. Host denial,
  malformed/undeclared results, thrown or rejected adapters, and invalid output produce redacted
  controlled settlements and return the public lifecycle to `idle` rather than fabricating a
  declared error. The Catalog effect class is descriptive request data only and never bypasses
  current host policy.

  A terminal settlement publishes `succeeded`, declared `failed`, or the controlled technical
  outcome before returning an opaque one-shot acknowledgement lease. A same-alias invocation
  accepted from the settlement handler may publish its own `pending` lifecycle synchronously, but
  its host transport remains staged behind the predecessor lease. Pre-existing FIFO work may
  likewise become the staged logical head without crossing the host boundary. No staged or queued
  host invocation starts until M04-T11/M04-T13 finishes the settlement handler's new action turn
  and explicitly acknowledges that lease. Handler failure therefore cannot retroactively change
  the operation result, and a synchronously returned host value still settles through a Promise
  microtask. Superseded and disposed attempts have no settlement-action lease.

  Attempt generations, snapshot generations, aggregate queued invocations, active underlying host
  transports, and retained lifecycle data are finite and may be lowered by a trusted host profile.
  Snapshot capacity for every future pending and terminal transition is reserved before an
  invocation is accepted. Underlying replaced transports may remain uncancellable, but the active
  transport ceiling bounds their retained settlement closures. Disposal is terminal, invalidates
  outstanding leases, resolves unfinished attempts as disposed, and does not claim secure erasure.

- Future action: A later protocol revision should standardize alias ownership, request identity,
  replacement-versus-queue interaction, finite queue and transport limits, technical-failure
  lifecycle visibility, settlement acknowledgement, cancellation, and complete turn provenance.

## PF-040 — State and navigation actions require a deterministic guard, snapshot, and terminal-lifetime profile

- Status: OPEN
- Blocks proof: No; one fail-closed action primitive can preserve the protocol's state and
  same-Bundle navigation semantics without claiming the later multi-action turn.
- Protocol location: SPEC Sections 17.7, 20, 20.1–20.3, 24.3, 24.5, 26.5, and 27.7; `R-073`,
  `R-074`, `R-075`, `R-076`, `R-105`, and `R-122`; related findings `PF-017`, `PF-019`, `PF-031`,
  and `PF-039`
- Observation: DESEN 0.1.0 says a false `when` guard skips an action without error, state writes
  leave their complete declared entry schema-valid, toggle accepts only a boolean target, and
  navigation targets another surface in the same Bundle through host policy. It does not define
  the runtime executor API, the exact observation order between a guard and hostile action
  members, whether guard and payload token reads share one observation session, how state and
  resolution snapshots prove same-turn authority, navigation request identity, the public shape of
  denied or failed navigation, or which managers become terminal after successful navigation.
- Implementation decision: M04-T10 executes exactly one `state.set`, `state.toggle`, or `navigate`
  action. Ordered arrays, batching, repeated synchronous transition limits, and nested settlement
  turns remain M04-T13. The executor captures one document, revision, current surface, complete
  same-Bundle surface inventory, state authority, and host boundary. Each call requires the exact
  current manager-issued state snapshot plus a factory snapshot whose state namespace is equal;
  M04-T16 still owns full cross-manager turn provenance.

  A package-internal callback-free executor read returns the exact document, revision, surface,
  and currently published lower state snapshot without host, token, diagnostic, navigation,
  state-write, effect, or generation work. It remains absent from the package root. M04-T13 uses
  this seam only to authenticate the surrendered child handle and obtain a fresh turn snapshot;
  full cross-namespace provenance remains M04-T16 work.

  The executor reads and evaluates `when` before inspecting any type-specific payload. A false
  guard therefore cannot observe a hostile path, value, target, params, extension, token,
  navigation, or diagnostic callback. Predicate operands are prepared through M04-T04 and
  materialized through M04-T03. One action-local memoizing token boundary is retained when a true
  guard proceeds to its payload, so repeated token names have one deterministic observation while
  a false guard still prevents payload inspection.

  `state.set` materializes one candidate and delegates the complete schema-safe write to M04-T06.
  `state.toggle` reads the exact current nested path, accepts only a boolean leaf, and delegates the
  inverse through the same M04-T06 write boundary. Neither action invents partial state or bypasses
  the complete entry schema.

  `navigate` rejects an unknown, external, or non-local target before materializing parameters.
  Parameter names are sorted, materialized as one synthetic array, reconstructed as inert JSON,
  and detached into the host request. A host denial reports
  `run.desen.runtime/NAVIGATION_DENIED` without substituting a target. A thrown, Promise-like, or
  malformed result becomes a redacted `ADAPTER_FAILURE`. Success is terminal for this
  surface-action executor and its local-state lifetime, including same-surface navigation. M04-T13
  later composes the T10–T12 action, resource, operation, command, and event lifetimes into ordered
  turns. Node and behavior bridges, reactive lifetimes, and complete session disposal remain
  distributed across M04-T14–M04-T16, with the final coordinator owned by M04-T16. No external URL,
  retry, redirect, history, persistence, animation, or platform routing policy is invented.

- Future action: A later protocol revision should standardize guard/payload observation order,
  action-scoped token sessions, snapshot provenance, navigation request identity and parameter
  lifetime, denial/failure visibility, same-surface navigation, and the exact terminal disposal
  boundary.

## PF-041 — Operation and resource actions require deterministic settlement ownership

- Status: OPEN
- Blocks proof: No; one bounded action-composition profile can preserve nonblocking operation
  settlement, current-input resource refresh, and the later action-turn acknowledgement boundary.
- Protocol location: SPEC Sections 14.2.3–14.2.4, 17.7, 20.4–20.5, 24.2, 26.3, and 27.7;
  `R-078` and `R-079`; related findings `PF-014`, `PF-020`, `PF-022`, `PF-031`, `PF-039`, and
  `PF-040`
- Observation: DESEN 0.1.0 does not define when operation settlement handlers are detached,
  which technical terminal outcomes select `onFailure`, whether an absent or empty handler still
  crosses an acknowledgement safe point, whether a guard and operation input share token
  observations, whether a resource refresh shares that cache, how exact resource and operation
  manager snapshots prove one action observation, how much unsettled handler data may be retained,
  or how disposal and late settlement interact with the queue gate.
- Implementation decision: M04-T11 composes one exact current M04-T08 resource authority and one
  exact current M04-T09 operation authority under a trusted exclusive-ownership profile. A
  factory-issued compositor prevents those handles from being claimed by a second live M04-T11
  compositor. JavaScript callers can still retain the independently public lower-level handles, so
  exclusivity is a composition-root surrender rule rather than an unprovable revocation claim;
  exact manager snapshots are re-read around hostile observation and direct lower-level mutation
  makes the next composed action fail closed.

  A package-internal callback-free compositor read returns the exact document, revision, surface,
  and current resource and operation snapshots without invoking host, token, diagnostic, action,
  or effect code and without advancing a generation. It remains absent from the package root until
  M04-T16 owns the public joint-snapshot contract. M04-T13 uses the read only to authenticate the
  surrendered child handle and take a fresh turn snapshot; it does not claim full handler,
  source-instance, or cross-namespace origin provenance before M04-T16.

  `when` is captured and evaluated before any discriminator or payload member. A true operation
  guard and its named input ValueSpecs share one bounded action-local token session. Both
  settlement branches are copied as inert frozen data before M04-T09 accepts the invocation, and
  finite pending-settlement, retained-action, and retained-string ceilings are reserved before the
  host boundary. The originating turn never awaits the transport. `succeeded` selects the captured
  `onSuccess` array; declared `failed`, host `denied`, invalid output, and adapter failure select
  `onFailure`; superseded or disposed attempts create no handler turn.

  A lease-bearing terminal result exposes only an opaque M04-T11 settlement ticket, never the raw
  M04-T09 lease. M04-T11 does not acknowledge that ticket. M04-T13 must start a new turn with
  `event.*` unavailable and finalize the ticket from a `finally` path after success, failure,
  navigation termination, or a limit. An absent or empty branch crosses the same safe point.
  Handler execution cannot rewrite the already-published operation lifecycle, and same-alias
  queued or staged host work cannot start before acknowledgement.

  `resource.refresh` delegates the exact current resource instance and resolution snapshot to
  M04-T08 without awaiting settlement or inventing handlers. Its declared current input uses the
  independent M04-T08 resource request and token session; sharing the guard cache could otherwise
  memoize stale input under the action request context. T11 disposal is terminal and disposes both
  lower-level managers, invalidating their outstanding leases without leaving a live operation
  gate behind. Physical cancellation, retry, timeout, cache, persistence, and full seven-namespace
  turn provenance remain explicit non-claims.

- Future action: A later protocol revision should standardize handler capture timing, technical
  settlement branch mapping, token-cache scopes, cross-manager snapshot provenance, finite
  settlement retention, private acknowledgement authority, disposal and late-settlement behavior,
  and the exact safe point that promotes queued operation work.

## PF-042 — Command target liveness and outbound host-event contracts require a deterministic bridge profile

- Status: OPEN
- Blocks proof: No; one additive, fail-closed bridge can preserve declared component commands and
  application-owned outbound event contracts without exposing platform objects or inventing
  adapter event semantics.
- Protocol location: SPEC Sections 17.7, 20.6–20.7, 24.6, and 27.5–27.7; `R-080`, `R-106`,
  `R-120`, `R-122`, `D-015`, `D-016`, and `N-031`; related findings `PF-015`, `PF-017`,
  `PF-031`, `PF-040`, and `PF-041`
- Observation: DESEN 0.1.0 requires a component command to address a declared command on a
  currently instantiated component and validate its resolved input, but it does not define how a
  framework adapter proves that liveness without exposing a DOM node, component object, or
  arbitrary method table. It also requires the host to allowlist outbound `event.emit` names and
  validate their payloads under an application contract, while leaving that contract registry,
  policy result envelopes, request identity, reentry behavior, and finite registry limits to the
  host profile. Catalog-declared component and behavior events travel in the opposite direction
  and therefore cannot safely be reused as shell-event contracts.
- Implementation decision: M04-T12 adds a separate synchronous command/event host boundary rather
  than changing M04-T01's frozen nine-port aggregate. Its factory captures receiver-independent
  own-data callbacks and normalizes throws, Promise-like values, and malformed envelopes into a
  redacted adapter failure. The outbound event profile has distinct validate and emit stages. A
  host event crosses the effect boundary only after its exact allowlisted name and opaque
  application contract identifier have been selected, its resolved payload has been detached and
  accepted by the validator stage, and the lifetime still matches after every potentially
  reentrant callback.

  One mounted action manager binds an exact document, revision, surface, factory-authenticated
  execution Catalog set, static source-node-to-component-capability inventory, host event
  allowlist, token/diagnostic ports, and command/event boundary. A live component registration
  carries only the exact source node, capability identifier, and an inert runtime-instance
  identifier. It exposes no target object, ref, DOM node, callable, or command method. A
  factory-issued opaque registration ticket plus monotonically advancing generation prevents
  foreign, stale, and ABA-equivalent unregister operations. Multiple bounded live instances may
  register for one repeated source node, but a source action is dispatchable only while exactly one
  instance is live. Zero or multiple instances produce one controlled unavailable result without
  selecting the first or last registration. An explicit repeated-instance addressing contract
  remains M04-T14/M04-T16 rather than being guessed here.

  The manager also exposes one callback-free current-snapshot read. It returns the exact immutable
  registry snapshot by reference without invoking host, token, diagnostic, command, or event code
  and without consuming a generation. This additive observation boundary lets M04-T13 compose a
  registration transition into the first following action turn; intentionally failing one command
  merely to discover a stale snapshot would not be an acceptable integration contract.

  The Catalog remains the sole command authority. Before reading a command input, the runtime
  performs an inert empty-object selector probe that distinguishes `UNKNOWN_COMMAND` from a
  declared command whose schema merely requires other input. It then materializes the real input
  through the same action-local token session as a true guard, validates the detached value against
  the exact `component-command-input` selector, rechecks the live target snapshot, and delegates
  only the capability ID, command name, runtime-instance ID, and validated JSON. A missing live
  target, host denial, invalid input, and adapter failure cannot be converted into success or
  redirected to an arbitrary method.

  `event.emit` selects its allowlisted name and contract before observing a hostile payload.
  Omitted payload becomes an empty object; an unknown name observes no payload or host callback.
  Guard evaluation always precedes either action-specific discriminator and payload. A false guard
  therefore produces no target lookup, payload read, token observation, effect, or diagnostic
  callback. Action identities, live registrations, host-event entries, retained identifiers, and
  generation counters are finite and may only be lowered by the trusted host profile. Disposal is
  terminal and leaves only minimal tombstones; no callback can revive the manager.

- Future action: A later protocol revision should standardize command-target instance identity,
  repeated-target addressing, adapter registration parity, shell-event contract discovery,
  validate-versus-emit policy separation, controlled denial codes, finite bridge limits, and
  cross-manager provenance. M04-T14 still owns generic incoming component/behavior events and
  adapter command registration, while M04-T16 owns the complete coordinator and deterministic
  trace.

## PF-043 — Action turns require deterministic admission, queueing, depth, and finalization ownership

- Status: OPEN
- Blocks proof: No; one bounded, fail-closed Reference Profile can compose the already proved
  single-action authorities without inventing platform event or rendering semantics.
- Protocol location: SPEC Sections 17.7, 20, 20.8, 24.2–24.6, 26.3, and 27.7; `R-062`, `R-078`,
  `R-081`, `R-123`, `D-029`, and `N-032`; related findings `PF-014`, `PF-031`, `PF-039`,
  `PF-040`, `PF-041`, and `PF-042`
- Observation: DESEN 0.1.0 fixes source-array order, asynchronous settlement turns, a default
  action/depth bound, and `ACTION_LIMIT_EXCEEDED`, but it does not define an executable turn
  authority, hostile-array capture, reentrant admission order, whether event and settlement work
  share one queue, which child outcomes continue, how current manager snapshots are adopted,
  whether an `invalid-snapshot` effect may be retried, when settlement capacity is reserved, or
  which exit owns the mandatory one-shot operation finalization.
- Implementation decision: M04-T13 prepares caller-owned action arrays into opaque programs before
  admission. Preparation reads own data descriptors for indices 0 through 63 only, copies that
  bounded prefix into recursively immutable JSON, and stores family routes in a private `WeakMap`.
  A declared 65th entry is represented only by an overflow marker; its descriptor and every later
  suffix remain unobserved. During execution the coordinator never re-reads a raw discriminator,
  guard, or payload and delegates each reached slot exactly once to its one M04-T10, M04-T11, or
  M04-T12 owner. `skipped` and true accepted outcomes continue; every controlled failure stops
  without rolling back earlier accepted effects. Navigation is terminal.

  Mount authenticates exact lower T06/T08/T09 snapshots and the exact T10/T11/T12 child
  authorities twice around host-port capture, then claims the three surrendered child handles.
  Before every reached slot it performs callback-free current reads, requires matching document,
  revision, surface, child, and lower-snapshot identities, adopts only identical or monotonically
  newer snapshots, and rebuilds the seven-namespace resolution view from current lifecycle data
  plus the turn's lexical scope. An `invalid-snapshot` outcome is recorded once and never retried;
  retry could duplicate an effect that crossed a hostile callback before drift became visible.
  Full joint origin provenance for context, event, item, environment, source instances, and
  settlement handlers remains M04-T16 work.

  Event admissions and operation settlements use one finite FIFO. Idle admission returns
  `started`; reentry returns `queued`; both expose a native Promise that always fulfills with a
  controlled immutable completion. Active and queued programs remain charged against aggregate
  action and canonical-code-unit retention until their work leaves the FIFO. An operation effect
  cannot start until a non-droppable future settlement slot and turn generation have been
  reserved. Ticket-bearing settlement descriptors retain their exact parent depth and create a
  distinct turn with `event.*` unavailable. Depth 16 is executable; work that would require depth
  17 crosses no operation effect and reports the core limit diagnostic.

  Every observed operation ticket is finalized exactly once from a `finally`-owned path after an
  empty, successful, skipped, failed, limited, navigated, or disposed handler turn. Settlement
  navigation disposes M04-T11 before finalization so staged or queued old-surface operations cannot
  promote. Late descriptors and queued settlement items still make one contained finalization
  attempt after disposal. Child disposal happens synchronously, while accepted event completions
  preserve FIFO observability: the active completion is fulfilled before discarded queued events.
  Default limits are 64 actions, 16 settlement levels, 64 queued or reserved turns, 64 synchronous
  drain transitions, 4,096 retained queued actions, 1,048,576 retained canonical code units, and a
  largest exact turn generation of `Number.MAX_SAFE_INTEGER`; trusted profiles may only lower
  them.

- Future action: A later protocol revision should standardize prepared-program authority,
  continuation outcomes, reentrant event and settlement FIFO semantics, snapshot adoption and
  retry prohibition, settlement-capacity reservation, depth ancestry, exactly-once finalization,
  terminal navigation ordering, and finite aggregate retention. M04-T14 still owns incoming
  component and behavior bridges, M04-T15 owns reactive re-evaluation, and M04-T16 owns complete
  seven-namespace provenance, coordinated session disposal, and the deterministic end-to-end
  trace.

## PF-044 — Adapter lifetimes require exact command provenance and bounded incoming-event ownership

- Status: OPEN
- Blocks proof: No; one bounded, fail-closed Reference Profile can connect generic adapters to the
  already proved Catalog, repeat identity, command-target, and event-turn authorities without
  introducing platform semantics.
- Protocol location: SPEC Sections 14.2.5, 17.7, 20.6, 21.3–21.5, 24.2–24.6, and Appendix B;
  `R-044`, `R-062`, `D-014`, `N-033`, and `N-034`; related findings `PF-031`, `PF-037`,
  `PF-042`, and `PF-043`
- Observation: DESEN 0.1.0 requires an adapter to validate or guarantee declared event payloads
  and requires component commands to reach a currently instantiated component. It does not define
  how a generic runtime proves that an incoming event belongs to an exact live component or
  behavior generation, how behavior `attachTo` authority follows its component owner, how an
  adapter command proves it originated from the exact normalized runtime port rather than a
  direct, replayed, or foreign callback invocation, or how snapshots, retained repeat scope,
  reentry, finite registries, and cross-manager disposal compose.
- Implementation decision: M04-T14 uses a two-phase bridge. The factory runs before M04-T12 so one
  command callback can be captured by the T12 port aggregate; bind succeeds afterward only for the
  exact same Catalog object, current registry snapshot, port owner, callback owner, document,
  revision, and surface. M04-T12 attaches a private request-to-port `WeakMap` marker immediately
  around the synchronous normalized callback. M04-T14 consumes that marker exactly once for its
  captured port owner. Direct calls, replay, a second port owner sharing the callback, and late use
  after the producer's `finally` cleanup fail closed. The concrete adapter receives only the
  declared command and detached input.

  Component registration derives runtime identity from the exact M04-T06/M04-T07 factory identity
  and scope. Each component or behavior generation owns an opaque ticket stored in a private
  owner-and-generation `WeakMap`, so forged, foreign, stale, and structurally ABA-equivalent
  tickets cannot act. Behavior registration requires the Catalog capability and an `attachTo`
  match by exact owner capability or category; it shares its owner's detached item/repeat-key
  projection and disappears when that owner leaves.

  Incoming event admission checks the current bridge snapshot, exact ticket and owner, current T12
  authority, and Catalog declaration before observing the payload. It invokes the Catalog payload
  validator once, then rechecks authority, snapshots, binding identity, and behavior ownership
  before passing a detached payload and inert handler selector to the event-turn sink. The request
  is sink-only; public outcomes reveal no callback authority or retained scope. Nested event
  admission remains available for M04-T16 FIFO composition, while mutations and disposal remain
  busy throughout hostile reflection, validation, command invocation, and event dispatch.

  Aggregate binding, handler, identifier, scope-occurrence, scope-code-unit, instance-identifier,
  generation, and snapshot limits are finite and lower-only. Registration reserves its own
  publication plus future unregister capacity. Disposal may adopt only a newer same-origin T12
  snapshot for cleanup, tolerates an already disposed lower manager, marks the former local
  authority revoked, tombstones all tickets, clears retained graphs, and replaces the handle entry
  with a minimal terminal tombstone.

- Future action: A later protocol revision should standardize adapter registration provenance,
  normalized command authentication, repeated-instance command addressing, behavior-lifetime
  ownership, incoming-event ticket identity, post-validation authority rechecks, public denial
  envelopes, finite bridge budgets, and cross-manager disposal rules. M04-T16 still owns the join
  from the inert event selector to one prepared action program and immediate event scope. M05
  still owns concrete production Web–React adapter parity; Android and iOS adapters should reuse
  the same observable contract rather than platform objects entering protocol data.

## PF-045 — Reactive invalidation requires explicit snapshot, generation, batching, and scheduler ownership

- Status: OPEN
- Blocks proof: No; one bounded whole-surface Reference Profile can produce the required
  observable equivalence without inventing a dependency-index format or platform scheduler.
- Protocol location: SPEC Sections 14.2.7, 15.2, 17.4, 24.3–24.4, and 28.6; `PIPE-023`, `R-046`,
  `R-053`, `R-059`, `R-103`, and `R-129`; related findings `PF-035`, `PF-037`, `PF-038`,
  `PF-039`, `PF-043`, and `PF-044`
- Observation: DESEN 0.1.0 requires state, context, resource, operation, and environment changes
  to invalidate dependent observable values; one action turn must expose a consistent snapshot;
  and an older asynchronous generation must never overwrite a newer one. It deliberately permits
  either dependency indexing or whole-surface reevaluation, but does not define the runtime
  invalidation authority, subscription handshake, batching boundary, snapshot-generation
  ownership, scheduler, reentry behavior, result-reflection ordering, or finite drain limits.
  Checking an attempt only before reflecting a hostile host result is insufficient: a Proxy trap
  can start a replacement while that result is being copied and make the earlier precheck stale.
- Implementation decision: M04-T15 uses two explicit phases. Before resource and operation
  managers mount, `createRuntimeReactiveHostPorts` captures the nine-port aggregate and replaces
  only `resources.load` and `operations.invoke`. Synchronous and promise-like settlements are
  adopted into native Promises, copied through the existing bounded JSON boundary, reduced to an
  exact immutable success, candidate public-failure (`failed`), or denial envelope, and delivered
  without any raw throw or rejection reason. Catalog declaration of a candidate error code remains
  the M04-T08/M04-T09 lifecycle manager's job. If reflection reenters and starts a refresh or
  replacement, the lower manager sees that newer attempt before it receives the now-inert earlier
  envelope and drops the stale settlement. A private factory brand prevents a structurally cast
  aggregate from claiming this boundary.

  After the lower managers mount, one surface-local coordinator authenticates exact current state,
  resource, and operation snapshots and subscribes once to context and environment. Subscription
  callbacks are notices only; payloads are never trusted. An explicit exact-snapshot invalidation
  represents the completion of one state, resource, operation, or whole action turn. Notices that
  arrive during evaluation coalesce into one dirty bit and a bounded synchronous drain; no timer,
  task queue, DOM primitive, framework scheduler, or platform global decides publication.

  Each attempt rereads complete detached context and environment values, samples exact lower
  snapshots twice, creates one factory-authenticated seven-namespace resolution snapshot with
  `event` unavailable and `item` empty, and invokes a synchronous whole-surface evaluator. The
  evaluator receives no mutation handle or general host aggregate—only the immutable resolution
  view and the token-only materialization port under a deterministic request identity. Before
  inspecting the raw result and again after bounded detachment, the coordinator rechecks the
  invalidation generation, lower snapshot identities, and complete host snapshot bytes. Drift
  discards the candidate; a current throw or invalid result publishes an inactive outcome rather
  than retaining an older subtree as semantically active. Byte-identical output preserves the
  exact observable snapshot. Evaluation, snapshot, and synchronous transition generations are
  finite and lower-only. Disposal revokes first, unsubscribes both notices once, clears retained
  authorities, and leaves a terminal tombstone. Because the frozen 0.1.0 token port has no
  subscription, token changes alone cannot announce invalidation; token values refresh only on
  another admitted reevaluation.

- Future action: A later protocol revision should standardize invalidation provenance, batching
  and scheduling ownership, dependency-index equivalence, consistent host snapshot handshakes,
  stale-result reflection ordering, controlled inactive outcomes, and finite drain limits.
  T15 also cannot authenticate that separately mounted M04-T08/M04-T09 managers captured the same
  wrapped aggregate. M04-T16 proves that composed join together with complete validated-tree
  materialization, selector-to-action-program joining, all seven namespace origins, conditional
  descendant inactivity, coordinated session disposal, the whole-surface observable reference
  oracle, and the deterministic JSON sign-in trace. Dependency-index equivalence, optimization,
  and performance comparison remain M12-T05. M05 still owns concrete React reconciliation,
  adapter-specific remount-required properties, DOM behavior, accessibility, focus, and production
  Web–React parity; future Android and iOS adapters must reuse the same observable contract.

## PF-046 — A complete headless session requires explicit plan, binding, and lifecycle ownership

- Status: OPEN
- Blocks proof: No; M04-T16 can define one bounded platform-neutral Reference Profile for the
  frozen sign-in Bundle while keeping the plan, adapter bindings, and observable trace outside
  protocol data.
- Protocol location: SPEC Sections 5.1, 9, 14–17, 20, 24, 28.3, and 28.6; `PIPE-023`, `R-005`,
  `R-046`, `R-053`, `R-059`, `R-079`, `R-103`, and `R-129`; related findings `PF-035` through
  `PF-045`
- Observation: DESEN 0.1.0 defines inert documents and protocol-observable behavior but does not
  define a headless materialized-plan schema, selector-to-action-program index, evaluation-wide
  token-cache owner, plan/binding transaction, global tree/depth/retained-plan limits, navigation
  handoff order, settlement-turn completion notification, or JSON evidence-trace schema. The
  protocol's permission to use whole-surface reevaluation also does not say how an implementation
  may retain a complete 5,000-node logical plan when the shared hostile JSON return boundary has a
  smaller 4,096-occurrence ceiling.
- Implementation decision: M04-T16 treats the public headless plan and trace as implementation
  evidence, never as a new DESEN document kind. One T15 evaluator produces only an immutable
  commitment containing plan and binding digests. The corresponding complete immutable plan,
  immediate item/repeat scope, stable identities, and desired adapter registrations remain in a
  bounded private sidecar keyed by the evaluation id. A candidate commits only when the exact T15
  publication repeats that evaluation id and both digests; stale or unmatched candidates are
  discarded without registering a component, behavior, event, or command.

  The session validates unknown Catalog and Bundle inputs cumulatively, verifies the Bundle
  revision and exact Catalog requirements, creates one reactive host aggregate, and passes that
  same object to resource, operation, and reactive managers. Event handlers are prepared once and
  indexed by exact component/behavior selectors. A current T14 event ticket selects one program
  and one retained repeat/item scope, constructs all seven runtime namespaces, admits one T13
  turn, then requests one T15 invalidation after the complete synchronous turn. The official
  sign-in operation's exposed settlement Promise provides the deterministic completion point for
  failure, retry, success navigation, and reactive publication. T13 does not expose completion of
  every internally nested settlement turn, so the G04 claim remains the official sign-in profile
  rather than silently claiming generic nested-settlement notification.

  Reconciliation computes the complete desired binding set before mutation, removes obsolete
  children in reverse order, preserves compatible identities, registers new components in source
  order and behaviors after their owners, and publishes only a complete result. Unexpected partial
  failure terminally disposes the surface. A current non-active or terminal T15 result also
  terminally disposes the session instead of presenting an indefinitely stale snapshot as live;
  last-known-good revision preservation belongs to the later M07 activation boundary. Normal
  disposal revokes T15 first, lets T14 remove its mirrored T12 targets while T12 remains live, then
  lets T13 dispose its surrendered child managers. Navigation mounts the target surface as an
  independent lifetime under the same public session handle.

- Future action: M04-T17 owns the implementation-level authenticated settlement-completion notice
  and generic session publication required to reclose G04; that project profile must not be
  presented as new protocol text. A later protocol revision should standardize an optional
  observable-plan/trace profile, selector provenance, settlement-completion notification,
  binding-transaction behavior, navigation handoff, and measured global limits if
  cross-implementation interoperability needs them. M05 still owns resolved prop/style validation
  at the concrete adapter boundary,
  reconciliation with real framework instances, DOM/CSS/accessibility/focus behavior, and
  production adapter parity. The frozen example Catalog's digest is explicitly illustrative, so
  M04-T16 proves exact contract consumption rather than package-byte integrity or activation.

## PF-047 — Frozen planning assignments require task-local applicability classification

- Status: OPEN
- Blocks proof: No; the M04-T16 verifier can preserve the byte-owned M02 planning baseline while
  explicitly separating rules that this task proves from rules whose complete executable evidence
  belongs to later milestones.
- Protocol location: M02-T02 traceability baseline for DESEN 0.1.0; M04-T16 applicability review;
  related findings `PF-045` and `PF-046`
- Observation: The frozen M02 traceability ledger assigns M04-T16 to 6 owner entries and 70 test
  entries, or 72 unique records. Five test assignments are broader than the actual G04 headless
  boundary. `R-048` requires receiving-schema validation, `R-104` requires concrete adapter
  preservation and remount behavior, `R-129` requires comparison with a dependency-indexed
  strategy, `A-011` spans design-to-capability boundaries that are not all present at G04, and
  `D-009` requires a resolved-property mismatch at a receiving boundary. Rewriting the historical
  ledger would invalidate the byte-owned M02 evidence chain and every later artifact that
  deliberately consumes it.
- Implementation decision: The M02 ledger remains the immutable 72-record planning baseline.
  M04-T16 inventories every assigned record, pins the five over-broad assignments as explicit
  future-deferred corrections, and proves the remaining 6 owner entries plus 65 test entries, or
  67 unique applicable records. The deterministic T16 artifact and verifier reject an omitted,
  duplicated, renamed, or silently reclassified baseline entry, so preserving historical evidence
  cannot be mistaken for claiming those five rules complete.
- Future action: `R-048` remains with M05-T02; `R-104` with M05-T05; `R-129` with M12-T05;
  `A-011` with M05-T08, M06-T11, and M12-T08; and `D-009` with M05-T06 and M06-T11. Each future
  owner must replace the applicable deferred classification with executable evidence before its
  own gate closes. A later traceability format should separate immutable assignment history from
  current evidence applicability so corrections do not require rewriting prior proof artifacts.

## PF-048 — Historical proof progression requires explicit verifier ownership transfer

- Status: OPEN
- Blocks proof: No; M04-T16 can preserve the immutable M02-T09 and M03-T09 artifacts while
  explicitly owning and mutation-testing the compatibility verifiers and historical root tests
  that read current normative status.
- Protocol location: M02-T09 interaction-contract evidence, M03-T09 reference-parity evidence,
  N-033 and N-034 normative coverage, M04-T14 N-033 completion, and M04-T16/G04
  historical-verifier compatibility
- Observation: The byte-owned M02-T09 and M03-T09 artifacts truthfully record N-033 as `PLANNED`
  at their task-time boundaries; M02-T09 also records N-034 as `PLANNED`. M04-T14 later advanced
  N-033 to `TESTED`. Re-running either historical verifier against only the latest status column
  rejected that valid monotonic progression; simply regenerating either artifact would rewrite
  history and cascade new hashes through every later artifact that consumes it.
- Implementation decision: Both historical artifacts remain byte-identical. Their current
  verifiers retain the exact historical ownership and scope boundaries, admit only the exact
  N-033 `PLANNED` to `TESTED` progression, reject unknown or regressive status, and return their
  task-time `PLANNED` projections when reconstructing the historical artifacts. Each artifact
  retains its exact task-time verifier and root-test records. M04-T16 explicitly byte-owns both
  current compatibility-verifier and historical-test pairs, pins both unchanged artifacts,
  records all four ownership transfers in its evidence, and applies hostile mutations to their
  boundaries.
- Future action: A later proof format should store versioned task-time semantic inputs separately
  from current monotonic completion state. Once that format exists, historical verifiers can
  consume a declared snapshot without a task-local ownership transfer.

## PF-049 — Post-G04 audit corrections require explicit runtime notification and proof migration

- Status: OPEN
- Blocks proof: No; M04-T17 proved the hardened implementation boundary and reclosed G04. The
  immutable M02-T08 and M04-T13 through M04-T16 artifacts remain valid evidence for their exact
  task-time profiles and were not rewritten or retroactively relabeled.
- Protocol location: SPEC Sections 17.2, 18.3, 20.4, 24, and 28.3; `N-026`, `N-029`, `R-048`,
  `D-009`, `PF-046`, `PF-047`, and `PF-048`
- Observation: M04-T16 observes the frozen sign-in operation's exposed settlement promise, while
  T13 exposes no universal completion notice for action programs created by internally nested
  settlement turns. The resulting trace is correct for the proved sign-in scenario but cannot
  support a generic claim that every future nested settlement automatically triggers current
  session publication.

  The current BCP 14 ledger also marked N-026 and N-029 `TESTED` after M02-T08. That task proved
  declared names, statically knowable values, and dynamic obligations; M04 later materialized
  dynamic prop and style values. Neither boundary validates the complete resolved prop object or
  resolved style-part property object against the receiving capability schema. The old statuses
  therefore overstated the complete obligations. This is a ledger correction, not evidence that
  previously working runtime behavior regressed.

  Immutable task-time artifacts truthfully contain the status bytes accepted when they were
  generated. Updating only the current ledger to `PLANNED` can consequently look like an
  unexplained historical regression to compatibility verifiers. A safe migration must distinguish
  task-time evidence from current completion truth and must bind every exception to its exact
  location; accepting a nearby phrase, duplicate row, moved heading, or arbitrary status downgrade
  would weaken the proof instead of correcting it.

- Implementation decision: M04-T17 added a factory-authenticated, finite, exactly-once internal
  completion notice after every accepted T13 settlement turn reaches finalization. The headless
  session consumes that notice, requests the current T15 invalidation/publication path, and no
  longer depends on knowledge of the official sign-in operation promise. The notice remains an
  implementation authority and never enters a DESEN document or public JSON observation.

  Its proof parser binds the completion claim and both corrected normative rows to exact files,
  headings, table rows, columns, IDs, and owners. The migration record pins the exact
  `N-026: TESTED -> PLANNED` and `N-029: TESTED -> PLANNED` corrections, their date, rationale,
  historical artifact identities, and future owners; it rejects every unlisted downgrade or
  relocation. M04-T17 owns the current compatibility verifiers and hostile tests for the affected
  boundaries, while the M02-T08 and M04-T13 through M04-T16 task-time artifacts remain
  byte-identical.

  Deterministic fault injection covers completion notification before and after finalization,
  nested success and declared failure, replacement and stale settlement, callback reentry,
  duplicate/late notification, disposal, publication failure, and generation/retention limits.
  The hardened cases expose no partial snapshot, publish no settlement twice, revive no disposed
  authority, and strand no lower queue acknowledgement.

- Future action: M05-T02 supplied the complete receiving-boundary evidence for N-026 and M05-T03
  supplied the complete post-resolution style-validation and adapter-delivery evidence for N-029;
  both rows are now `TESTED`. A future protocol revision may standardize settlement-completion
  notification and versioned evidence snapshots; M04-T17 defines only the bounded 0.1.0 reference
  implementation profile.

## PF-050 — React adapter selection requires a static registry and bounded all-or-nothing preflight

- Status: OPEN
- Blocks proof: No; M05-T01 defines one Web–React implementation profile without changing the
  frozen Bundle or headless-plan formats.
- Protocol location: SPEC Sections 16.3, 17, 19, 24.2, and 26; `PIPE-022`, `R-056`, `R-147`, and
  related findings `PF-024`, `PF-029`, `PF-044`, `PF-046`, and `PF-049`
- Observation: DESEN requires ordinary surface roots and descendants to resolve through declared
  capabilities, and prohibits silent substitution, but does not define a React registry API,
  executable lookup authority, hostile public-plan reflection order, React tree preflight, or
  renderer-wide node, depth, slot, behavior, and identifier ceilings. Treating a capability id as
  a module/export selector would let inert Bundle data choose executable code. Rendering while
  recursively discovering adapters would also allow a deep unknown capability to execute an
  ancestor before the complete surface is known to be renderable.
- Implementation decision: M05-T01 adds a factory-authenticated `runtime-react` registry populated
  only with statically imported trusted component and behavior adapters. Registry creation captures
  exact capability ids and executable identities without invoking them; the public immutable
  snapshot exposes only canonical sorted id inventories. Duplicate cross-category ids, malformed
  own-data registrations, invalid lower-only profiles, registry counts, and retained identifier
  limits reject the entire factory call.

  `renderRuntimeReactSurface` receives only the public M04 headless plan and opaque registry
  handle. It reflects own data without invoking accessors, walks the complete root/slot/behavior
  graph under finite limits, rejects duplicate runtime identities, and resolves every exact
  component and behavior id before creating a React element. A surface root follows the same
  registry lookup as a descendant. Any malformed plan, forged handle, missing adapter, or limit
  crossing returns one callback-free identity-linked failure and no placeholder element; no
  adapter component executes during preflight. Named-slot entries and names, JSON occurrences,
  JSON depth, and retained string units consume aggregate lower-only budgets. All props, styles,
  and inert behavior plans cross an accessor-free detached deeply frozen JSON snapshot before
  entering a React element. A private result discriminator prevents any legal slot name from
  colliding with renderer control flow. Revoked proxies produce controlled failures. React
  elements receive only public semantic adapter inputs rather than DOM nodes, native events,
  selectors, or private component structure. Behavior wrappers retain declared source order with
  the first declared behavior as the outermost wrapper; two non-commutative wrappers prove the
  observable profile.

  The standalone renderer authenticates the registry, not the provenance of an otherwise valid
  structural public plan. The G05 production host must obtain its plan from the exact current
  authenticated headless session; M05-T04 binds interactions to that session and M05-T09 audits
  the host source/import graph. This keeps the pure compiler reusable without overstating T01.

- Future action: M05-T02 authenticates the exact session/Catalog pair and validates resolved props
  and named slots through one bounded receiving scope; `PF-051` records that implementation
  profile. M05-T03 now validates and delivers resolved styles through that same scope; `PF-052`
  records the semantic-style profile. M05-T04 activates the deliberately unavailable event/command
  seams and proves behavior lifecycle. M05-T05 proves concrete React instance reconciliation and
  source diagnostics. M05-T06 now composes committed adapter exceptions and controlled preflight
  failures without a guessed capability or placeholder; `PF-055` records that containment profile.
  Future SwiftUI and Compose renderers should reuse the observable headless vectors but define
  independent static target registries rather than importing React concepts into `runtime-core`.

## PF-051 — Resolved adapter receiving requires exact Catalog authority and one shared finite scope

- Status: OPEN
- Blocks proof: No; M05-T02 defines a Web–React receiving profile without changing frozen Source,
  Bundle, Catalog, or headless-plan formats.
- Protocol location: SPEC Sections 17.2, 17.3, 18.3, 24.2, and 26.3; `N-026`, `N-027`, `N-042`,
  `C-019`, `R-006`, `R-112`, and related findings `PF-010`, `PF-022`, `PF-046`, `PF-049`, and
  `PF-050`
- Observation: DESEN requires final resolved values to satisfy the receiving capability schema and
  slot contract, but it does not define how a framework renderer proves that a public plan belongs
  to the same live session and Catalog set, whether schemas may be prepared once, how repeated
  adapter validations share a finite work budget, or which public projection represents final
  materialized named slots without exposing React or DOM internals. A stateless validation helper
  would let a wide tree reset its schema budget for every node; accepting a raw plan beside an
  unrelated Catalog would permit structurally valid but unauthorized receiving contracts.
- Implementation decision: M05-T02 adds one exact-reference authority check to the headless session.
  The React renderer accepts only `{registry, session, snapshot, catalogSet, limits?}` and consumes
  only the authenticated current snapshot's public plan. A copied/stale snapshot, lower validator
  brand, structurally equal Catalog clone, forged handle, hostile own-data envelope, or disposed
  generation fails before an adapter executes. Successful mount returns its exact retained
  validated Catalog set outside the JSON-only snapshot, so both raw and prevalidated Catalog
  ingress produce a usable real-host authority without revalidation guessing.

  The execution validator prepares component and behavior prop schemas and style-part property
  schemas once when it authenticates the Catalog set. Each render creates one opaque
  factory-authenticated receiving scope with monotonically consumed prop, slot, style, slot-entry,
  slot-contract-work, string, detached-JSON, and prepared-schema evaluation budgets. Schema
  evaluation charges actual comparison and Catalog-controlled loop work, not merely recursive
  interpreter entries. Slot metadata and acceptance sets are prepared once; required-slot,
  contract-lookup, and child-acceptance work still consumes the shared scope. The profile may only
  lower finite ceilings. Counters are not refunded after invalid attempts and no stateless Catalog
  overload can reset them.

  Complete component and behavior prop maps cross an accessor-free detached JSON boundary and are
  evaluated in `complete` and `resolved-value` mode. Named slots cross a separate bounded projection
  containing only slot names and child component capability identifiers. Required presence,
  effective minimum and maximum cardinality, exact-id/category acceptance unions, explicit empty
  reject-all unions, and unknown child capabilities are checked against the final materialized
  owner instance. Exact names and child order are retained, and successful maps are recursively
  immutable. A deep prop or slot failure produces an identity-linked frozen diagnostic result and
  no React element, adapter call, fallback, or partial value.

  Component adapters no longer receive raw behavior plans. Neither component nor behavior adapters
  receive the session, Catalog, raw plan, DOM/native objects, private React fields, or a guessed
  `children` fallback. This is a target-specific receiving profile; the shared validator and
  session authority remain framework-neutral.

- Future action: M05-T03 now delivers only schema-valid resolved visual-state/style-part maps.
  M05-T04 binds event and command lifetimes to the exact current session generation. M05-T06 now
  composes receiving failures and adapter exceptions into the production safe-boundary policy;
  `PF-055` records its conservative attribution and recovery rules.
  M06-T05 still owns publisher-side recording of dynamic validation obligations, so `N-027`
  remains `PLANNED`. M09-T04 still owns editor overlay/private-structure isolation, so `N-042`
  remains `PLANNED`. A later protocol revision may standardize a target-neutral receiving-scope
  envelope and aggregate-budget terminology if independent runtimes need byte-level parity.

## PF-052 — Semantic React style delivery preserves capability-owned state activation

- Status: OPEN
- Blocks proof: No; M05-T03 defines one exact Web–React semantic-style receiving profile without
  adding CSS, DOM, selector, or active-state semantics to the frozen protocol.
- Protocol location: SPEC Sections 17.2, 18.3, 24.2, and 26.3; `N-028`, `N-029`, `C-019`,
  `R-006`, `R-064`, `R-065`, `R-066`, `R-148`, and related findings `PF-035`, `PF-049`,
  `PF-050`, and `PF-051`
- Observation: The headless runtime materializes the complete visual-state → style-part →
  property hierarchy, and the validator can check that hierarchy against exact Catalog contracts.
  M05-T02 deliberately stopped before calling the style receiving API. Passing its detached but
  unchecked style map to a React adapter would leave dynamically resolved property values outside
  their receiving `propertiesSchema`. Conversely, having the generic renderer choose or merge an
  active visual state would move capability-owned platform behavior into a framework-wide policy
  that the protocol never defines.
- Implementation decision: M05-T03 calls `validateDesenResolvedAdapterStyle` for every component
  and behavior after complete prop validation and before named-slot delivery or React element
  creation. The call uses the same exact Catalog-authenticated, monotonically consumed scope as
  props and slots. Catalog preparation caches declared visual-state identities and style-part
  schemas once. Each final style map is detached, bounded, and checked as state → part → complete
  resolved property object. Unknown states, parts, or properties and schema-invalid dynamic values
  produce stable identity-linked style failures. A receiving-budget crossing retains the shared
  limit classification. No adapter executes and no partial tree is returned after any failure.

  Successful component and behavior adapters receive only an independent, recursively immutable
  semantic hierarchy. The public type names the state, part, and property layers but gives no CSS
  selector, class, DOM/native handle, ref, query API, or implementation option. `runtime-react`
  neither selects a state nor merges `base` with another state, interprets property names, creates
  CSS, or inspects the component implementation. A trusted capability adapter receives the same
  complete map regardless of which production state it later decides is active.

  The immutable M05-T02 artifact remains byte-identical. Its current verifier is transferred to a
  strict task-time compatibility reader, while the M05-T03 successor artifact owns the current
  renderer, validator, test, documentation, and migration paths.

- Future action: M05-T04 binds interactions without widening the semantic-style authority.
  M05-T06 contains committed adapter exceptions without exposing raw values or guessing identity.
  N-030 remains `PLANNED`: real reference
  adapter styling and hostile accessibility-preservation tests remain with M09/M12 rather than
  being inferred from schema-valid delivery alone. A later multi-target revision may standardize
  a renderer-neutral semantic-style receiving envelope, but target state activation remains
  capability-owned.

## PF-053 — React interaction authority is commit-scoped and package executables require a successor digest

- Status: OPEN
- Blocks proof: No; M05-T04 defines one Web–React interaction and package-migration profile without
  changing the frozen DESEN protocol, Source, Bundle, Catalog schema, or framework-neutral render
  plan.
- Protocol location: SPEC Sections 7.4, 17.3, 19.4, 22, 23.4, 24.2, and 26.3; `C-017`, `C-019`,
  `PIPE-022`, `R-006`, `R-072`, `R-149`, `N-033`, `N-034`, and related findings `PF-026`,
  `PF-029`, `PF-046`, `PF-050`, `PF-051`, and `PF-052`
- Observation: M04 authenticates and validates generic event and command routing, while M05-T03
  produces schema-valid React adapter values. Neither boundary defines when a concrete React
  instance may acquire imperative command authority, how an abandoned or replayed React lifetime
  loses it, or how the public render plan is proven equal to the session binding inventory before
  executable adapters are instantiated. Registering the concrete callback directly in render
  would authorize SSR and abandoned Suspense work. Re-registering the lower adapter binding on
  every mount would also change event tickets and command generations. Finally, adding executable
  reference adapters changes bytes covered by the M03 logical package digest; retaining the old
  tuple would falsely identify new code as the historical inert artifact.
- Implementation decision: M05-T04 creates a stable private component-command holder when the
  headless session first registers a component binding. The public attach call accepts only an
  exact current factory-authenticated session snapshot, runtime component identity, and
  receiver-independent own-data callback. It returns one opaque owner-bound attachment. A new
  owner atomically supersedes the previous generation, while cleanup for an old generation cannot
  clear its replacement. Binding replacement, navigation, session disposal, callback reentry,
  callback failure, malformed output, or an authority change while invoking all fail closed. The
  lower binding is never unregistered merely to attach React, preserving its event ticket and
  registration identity. Behavior bindings cannot use this component-command seam.

  Before React element creation, the renderer compares every prepared component and behavior with
  the authenticated snapshot bindings in both directions, including behavior capability, id, and
  exact owner identity. Missing, duplicated, extra, or mismatched bindings return
  `RUNTIME_BINDING_MISMATCH` with no adapter execution. Each adapter element then owns a private
  controller activated only by a committed layout effect. Pre-commit, SSR, never-committed
  Suspense, stale-snapshot, and unmounted calls remain unavailable. React has no supported generic
  render-phase signal for a child-local rerender of an already committed trusted adapter, so
  conformance forbids side-effecting interaction calls from render bodies and permits them only in
  committed effects or platform callbacks. Reference source and lifecycle tests enforce this rule
  without React internals. Events use the exact captured session, snapshot, runtime identity, name,
  and inert JSON payload. Their public completion resolves only to `void` and exposes no newer
  snapshot or lower action-turn result.

  Payloads first cross the bounded runtime JSON snapshot boundary and the exact commit epoch is
  rechecked after hostile reflection. Command capture performs the same epoch check before and
  after lower attachment; a lower owner created across cleanup is immediately detached and never
  exposed. Core revocation clears its callback, binding, lifetime, and session references. React
  cleanup tombstones lower attachments, removes superseded controller entries, and drops current
  session/snapshot authority. Retained stale handles or ports therefore do not retain a live
  component closure or complete session graph.

  The reference package exposes a separate, opt-in `./react-adapters` subpath containing exactly
  five frozen, statically imported registrations. Explicit field and slot mappings prevent
  arbitrary React prop, style-map, native-event, and DOM leakage. TextField implements the exact
  declared `focus` command through its narrow private handle; TextField `change` and Button
  `press` forward fresh inert payloads. The other adapters add no undeclared interaction.

  The current reference Catalog therefore moves from the immutable M03 package digest
  `sha256:4ebfc6209d4874f3798009c72c634d2f65e60f8b59d4a517f269380a8cec6d9e`
  to the successor digest
  `sha256:acdbbfe9ad4c1fce8093b0b68036bc7f5678e8b2a603357dbe25f2413a3db6f0`.
  The successor frames the projected Catalog plus every one of 80 regular `dist/**` files, for 81
  entries and 252,072 bytes. M03 proof bytes and their old tuple remain unchanged behind strict
  task-time compatibility readers; M05-T04 owns the current package inventory.

- Future action: M05-T05 proves stable React reconciliation keys and runtime-to-source diagnostics
  without widening an adapter's authority. M05-T06 contains committed adapter exceptions under
  the whole-surface profile recorded by `PF-055`. M05-T08 exercises the complete official-derived
  sign-in path through these exact
  reference adapters, while M05-T09 proves the separate production host cannot replace the
  bundle-driven tree or executable registry with handwritten composition. M09/M12 still own
  concrete semantic style application and accessibility preservation. Native renderers should
  reuse the observable event/command vectors but define independent lifecycle attachment
  profiles instead of importing React effects into `runtime-core`.

## PF-054 — Stable adapter identity is session-scoped and source diagnostics are one-to-many

- Status: OPEN
- Blocks proof: No; M05-T05 defines the selected Web–React reconciliation and diagnostic profile
  without changing frozen protocol data or moving React policy into `runtime-core`.
- Protocol location: SPEC Sections 17.6, 24.4, and 25.2; `R-061`, `R-104`, `N-021`, proof claim
  `P-16`, and related findings `PF-035`, `PF-050`, `PF-051`, and `PF-053`
- Observation: Stable runtime ids and repeat keys are necessary but insufficient to preserve a
  real React instance safely. Using only a source id collapses repeated nodes. Using every prop
  remounts on ordinary resolved-value changes and destroys local platform state. Ignoring
  capability compatibility or a small adapter-owned set of constructor-like props can preserve an
  incompatible instance. A key that survives a factory-created session switch can also leak
  adapter `useState`, refs, effects, or platform instances between otherwise separate runtime
  authorities. Separately, an error carrying only one source id cannot select all materialized
  repeat or behavior instances, while exposing props, React elements, the registry, or session
  callbacks through a diagnostic index would widen authority and retention.
- Implementation decision: M05-T05 gives each trusted component and behavior registration an
  optional `remountOnProps` list. Registry creation captures it as dense enumerable own data,
  rejects duplicates and invalid Unicode, sorts it by exact UTF-16 code units, freezes it, and
  applies explicit per-adapter and aggregate limits. Bundle and Catalog data cannot provide or
  override this metadata. After exact receiving validation, the renderer creates an RFC 8785
  canonical key from the runtime id, exact capability id, and a presence-aware projection of only
  those declared prop names. Missing differs from explicit `null`; semantic object member order
  does not. Ordinary props, styles, and slots remain outside the key. Components, behavior
  wrappers, capability changes, repeat reorder, and removal are exercised with real React state
  and mount lifecycles.

  `useRuntimeReactSessionSurface` observes the headless runtime only through its
  factory-authenticated read/subscribe/unsubscribe API. Snapshot result references are stable,
  subscriptions begin after commit, exact tickets are cleaned up under StrictMode, and SSR or
  abandoned Suspense work acquires no subscription. `useRuntimeReactSurface` re-authenticates every
  exact publication with the same host registry and Catalog set. The public renderer allocates a
  private stable root-boundary type per exact session-and-registry pair, so direct and live
  renderer consumers share the same isolation without double wrapping: generations inside one
  trusted host configuration preserve compatible adapters, while a handle or executable-registry
  change remounts the complete managed tree. Old ports and queued notices cannot restore or act
  through the replaced authority.

  After complete preparation and exact two-way binding parity, the renderer atomically builds a
  null-prototype, recursively frozen index from runtime ids to component/behavior identity and
  from source or behavior ids to sorted one-to-many runtime-id lists. Its 25,000-binding and
  115,000-identifier-occurrence ceilings cover the renderer maximum. It retains only immutable
  identity strings: no props, style, slots, React value, platform object, session, Catalog,
  registry, or callback. Any malformed ownership or lower-limit crossing returns
  `DIAGNOSTIC_INDEX_FAILED` before element creation.

- Future action: M05-T06 now supplies the explicit production adapter error boundary without
  converting unknown capabilities into guessed placeholders; `PF-055` records its honest
  attribution limit. M09-T13 must connect the immutable
  index to end-to-end Desen App diagnostic selection before P-16 can become `PROVEN`. M06-T06 now
  proves the Publisher-side protocol behavior/source identity relationship recorded by `PF-065`,
  so the composed evidence advances N-021 to `TESTED`. Native renderers should reuse the observable
  identity rules but define their own platform instance-compatibility boundary rather than
  importing React keys.

## PF-055 — React failure containment is whole-surface when exact origin is unavailable

- Status: OPEN
- Blocks proof: No; M05-T06 defines one conservative Web–React failure profile without changing
  frozen protocol data or claiming unsafe node-local isolation.
- Protocol location: SPEC Sections 24.2, 26.3, and 26.4; `R-112`, `R-113`, `R-115`, `A-012`,
  `D-009`, `N-037`, proof claim `P-17`, and related findings `PF-047`, `PF-050`, `PF-051`,
  `PF-053`, and `PF-054`
- Observation: React error boundaries can contain render and commit-lifecycle exceptions, but the
  public API does not reliably identify which removed child, behavior wrapper, or live ancestor
  originated an arbitrary cleanup failure. Treating the nearest catching boundary as the exact
  adapter would create false diagnostics. Keeping siblings alive would also overclaim safe
  isolation when a failed adapter may have shared effects or command authority. React 19 root
  `onCaughtError` may observe the original thrown value before boundary recovery.
- Implementation decision: M05-T06 uses one explicit, statically host-owned
  `RuntimeReactSurfaceBoundary` around a completely preflighted surface. Unknown component or
  behavior capabilities remain controlled renderer failures and create no React element,
  fallback, or guessed placeholder. A safely isolated leaf DESEN component failure emits a deeply
  frozen redacted `ADAPTER_FAILURE` with exact diagnostic identity. Behavior, non-leaf,
  descendant-removal, and other ambiguous failures emit the same code with every identity field
  `null`; the public union exposes only variants that this implementation can actually produce.

  Containment is whole-surface. Two always-mounted sibling boundaries distinguish managed-tree
  lifecycle from host failure-UI lifecycle while switching branches. Cleanup revokes the failed
  tree's event and command authority. Host failure UI that throws during render, effect, or removal
  crosses outer and nested DESEN boundaries in a fresh private carrier with the exact host-thrown
  value only as `cause` while a containing boundary remains mounted; it never becomes
  `ADAPTER_FAILURE`. Private carriers are branded by
  `WeakSet` rather than `instanceof`, so hostile thrown proxies cannot trigger prototype traps, and
  reusing the same raw `Error` later in an adapter cannot inherit host provenance.

  Adapter failure is sticky until the host changes an explicit `recoveryKey`. Bundle publication,
  ordinary prop or reconciliation-key changes, and a structurally equivalent registry do not
  silently retry executable code. A dedicated DESEN root may pass
  `ignoreRuntimeReactRootCaughtError` to React root creation to suppress raw caught-error
  telemetry; shared-root telemetry, `onUncaughtError`, and `onRecoverableError` remain host policy.
  Event callbacks, arbitrary asynchronous failures, SSR, and cleanup during complete React-root
  removal are explicit host-policy nonclaims. The boundary accepts trusted runtime results rather
  than attacker-constructed props. Nested surfaces in one React tree require one deduplicated
  `runtime-react` module instance; omitted `recoveryKey` deliberately means never retry.

- Future action: M05-T07 now wires the dedicated reference-host root policy and derives recovery
  epochs only from explicit retry or exact session, registry, Catalog, and host-authority
  replacement; `PF-056` records that browser-host boundary. M05-T08 now exercises the official
  sign-in path and exact authority replacement through that boundary; `PF-058` records the
  distinction between stale containment and transport cancellation. M05-T09 now proves the
  current independent host cannot bypass it with a handwritten managed tree. M06-T11 still owns the remaining
  invalid-publication slice of `D-009`, and M07-T04 owns activation-time finite preflight before
  P-17 can become `PROVEN`. Future native runtimes must define their own platform-specific
  containment evidence rather than importing React's boundary limitations.

## PF-056 — Reference-host recovery follows executable authority, not document publication

- Status: OPEN
- Blocks proof: No; M05-T07 defines one conservative Web–React host composition profile without
  changing frozen protocol data or advancing a normative or proof-claim status.
- Protocol location: SPEC Sections 9.1 and 24.5 and Appendix A; `R-019`, `R-105`, `A-013`, and
  related finding `PF-055`
- Observation: A dedicated browser root needs stronger ownership than structurally compatible
  host callbacks. Pairing a live session with reconstructed ports could cross application
  authority, while deriving adapter recovery from a Bundle revision, snapshot, or render result
  would let ordinary or hostile publication retry failed executable code. React root callbacks
  can also expose raw failures unless the host selects an explicit no-inspection policy, and a
  failed root unmount leaves the container's actual React ownership uncertain.
- Implementation decision: M05-T07 builds `apps/reference-host-web` independently with React 19
  and zero-configuration Vite 8. Its dependency boundary has no Desen App, editor, publisher,
  `testkit`, or broad `desen` facade production import, and its root input cannot carry arbitrary
  React or a caller-created managed tree. `@desen/runtime-web` captures exactly nine ports and
  fourteen callbacks through `createRuntimeHostPorts` without invocation, wraps them in one opaque
  terminal authority, applies the active document/revision assertion to navigation, preserves the
  last valid bounded browser environment observation, supplies a finite nondecreasing epoch clock,
  and attempts every subscription cleanup independently.

  Root activation accepts only the closed `RuntimeReactLiveSurfaceInput` and an opaque Web host
  authority. `runtime-core` authenticates by exact object identity that this headless session was
  mounted with this factory-created host-port aggregate and returns only a frozen status. A
  separate core check authenticates the exact current snapshot and Catalog set, and a status-only
  `runtime-web` check requires its document id and revision to match the host authority's configured
  pair. A transition fence rejects synchronous activation, replacement, retry, or disposal
  reentry. The root uses `ignoreRuntimeReactRootCaughtError`; recoverable failures emit only a
  fixed redacted diagnostic, while uncaught failure first terminally fences the session and host
  and then emits its fixed diagnostic. Raw thrown values and React error information are never
  inspected, forwarded, or retained.

  Recovery advances only after an explicit host/user retry or replacement of the exact session,
  executable registry, Catalog set, or host authority. Bundle identity, revision, URL,
  server/current snapshot, renderer result, and ordinary session publication are absent from that
  authority. Terminal disposal reduces the root, host, and session authorities to inert tombstones
  and clears retained recovery identities, severing the executable graph. A confirmed root unmount
  releases its container; an exception or otherwise uncertain unmount keeps a weak container claim
  and prevents unsafe root reuse.

- Future action: M05-T08 now runs the official-derived sign-in path through this exact host,
  operation, adapter, failure, and recovery composition; `PF-058` records its precise
  stale-settlement nonclaim. M05-T09 now completes the TypeScript AST and resolved-import audit
  and closes the independent-host slice of G05. M07 still owns channel retrieval,
  persistent activation, restart recovery, and last-known-good behavior. Future native targets
  must define independent registries, renderers, platform hosts, and lifecycle evidence while
  reusing only framework-neutral protocol and headless semantics.

## PF-057 — Wide binding materialization needs an explicit performance benchmark

- Status: OPEN
- Blocks proof: No; the existing M04 capacity vector still passes and this finding does not change
  a protocol rule, runtime limit, or current proof status.
- Protocol location: M04-T14/M04-T16 binding reconciliation and headless activation evidence;
  proof claim `P-17`; future measurement owner M12-T05
- Observation: The 1,365-node regression vector intentionally crosses the former 4,096 aggregate
  scope-occurrence bottleneck. It normally completes in about one to two seconds, but concurrent
  CPU pressure can push it beyond Vitest's generic five-second default. Inspection also identified
  a possible production optimization: wide binding registration repeatedly materializes complete
  adapter-registry snapshots, so the current construction cost may approach quadratic growth.
  The existing test is a semantic capacity proof, not a declared performance SLA.
- Implementation decision: Keep the complete 1,365-node vector and give only that test an explicit,
  finite 15-second budget. Do not raise the global timeout, reduce the vector, change workspace
  test coverage, or patch production reconciliation behavior without a benchmark and preserved
  atomicity evidence.
- Future action: M12-T05 must measure binding materialization across increasing node and binding
  counts, publish a reproducible time/memory profile, and define an explicit regression budget.
  If the repeated-snapshot cost is confirmed, optimize it behind the existing exact authority,
  rollback, publication, and immutable-snapshot contracts, then rerun the M04-T14/M04-T16 evidence
  before claiming the improvement.

## PF-058 — Logical stale-authority containment is distinct from transport cancellation

- Status: OPEN
- Blocks proof: No; M05-T08 proves the official-derived Web–React execution profile without
  changing frozen protocol data or claiming a general transport-cancellation rule.
- Protocol location: SPEC Sections 9.1, 15, 20, and 24.5 and Appendix A; `R-019`, `R-071`,
  `R-105`, `A-011`, `A-013`, and related findings `PF-039`, `PF-041`, `PF-053`, and `PF-056`
- Observation: The official sign-in composition needs two different pending-operation guarantees
  to remain explicit. In one live surface, the real loading `Button` suppresses repeated presses,
  so its UI does not create a second pending submission. Separately, replacing the complete host
  composition while an operation is pending must revoke the old session's authority even if its
  underlying transport later settles. A late result that cannot affect current state or
  navigation does not imply that the already-started network request was physically cancelled.
- Implementation decision: M05-T08 keeps the frozen official managed `surfaces` canonically exact
  in committed official-derived Source and Bundle fixtures, changing only the Catalog requirement
  and consequent digests. The independent reference host composes that Bundle with the exact
  current Catalog, the public real five-adapter registry, and a fixed same-origin
  `POST /api/sign-in` binding. The binding snapshots bounded own-data credentials, performs one
  request without retry or persistence beyond the request lifetime, maps only HTTP `401` to
  `invalidCredentials`, maps all other HTTP/transport/parse/response-budget failures to
  `unavailable`, streams successful bodies through a 64 KiB and 1,024-non-empty-chunk ceiling
  before parsing, and leaves the resulting JSON to runtime-core's exact output-schema validation.

  Tests drive pending, declared failure, edited retry, success, and navigation through the real
  adapters. A separate case replaces the exact session, registry, Catalog, and Web-host authority.
  T07 root ownership transfer disposes the old session and host, and detached events plus the late
  old settlement cannot alter or navigate the replacement surface. No `AbortController` or other
  started-transport cancellation is claimed. The production entry also preserves the composition
  and listener on persisted `pagehide` for BFCache restoration, then disposes on the first final
  non-persisted `pagehide`; this is React/jsdom evidence rather than a real-browser BFCache claim.
  The immutable T07 proof remains historical task-time evidence; T08 owns the changed current
  composition and build verification.

- Future action: M05-T09 now supplies the exhaustive TypeScript AST and real Vite resolved-import
  audit for the current independent host, closing G05 and advancing P-07 only to `PARTIAL`. M06
  still owns Publisher provenance, M07 owns channel retrieval and persistent atomic activation,
  M10-T05 owns the corresponding Desen App host E2E slice, and future backend,
  timeout/cancellation, and native-host policies require their own explicit contracts and
  evidence.

## PF-059 — Runtime module resolution is distinct from TypeScript declaration resolution

- Status: OPEN
- Blocks proof: No; M05-T09 resolves the mismatch for the current independent Web–React host and
  closes G05 without changing protocol semantics.
- Protocol location: SPEC Sections 9.1 and 24.5 and Appendix A; proof claims `P-06`, `P-07`, and
  `P-10`; ADR 0010
- Observation: TypeScript commonly resolves a workspace package import to its declaration entry,
  while the browser build resolves the same specifier to executable JavaScript and its transitive
  dependencies. Treating the TypeScript graph as the shipped runtime graph could therefore miss a
  forbidden executable edge. Plain source-text searches are also insufficient because aliases,
  namespaces, helper modules, React factories, and generated JSX-runtime calls can express the
  same handwritten tree without the expected spelling.
- Implementation decision: M05-T09 uses three non-substitutable authorities. TypeScript's parser
  and checker resolve JSX, import aliases, namespace access, and symbol origins. A
  complete-source JSX policy and exact approved-composition fingerprints reject helper-hidden
  trees.
  Two programmatic Vite 8 `write:false` production builds observe and compare the real
  `moduleParsed` graph. Dependency-cruiser separately enforces package-level application
  boundaries. The source inventory is discovered recursively; every production file must be a
  regular reachable module, and symbolic links, orphans, unresolved imports, unknown assets, and
  unreviewed data edges fail closed.

  The allowed handwritten JSX is limited to exact host boot, notice, failure, recovery, and
  managed-boundary infrastructure. The managed branch must cross the public
  `@desen/runtime-react` renderer and public
  `@desen/reference-catalog-web/react-adapters` factory. Direct, aliased, namespace, helper-hidden,
  factory-created, plan-shaped, capability/source-node-selected, or dynamically loaded managed
  alternatives are hostile mutation cases. The exact admitted data edges are the controlled
  official-derived Bundle, current Catalog, and host CSS; the authoring Source is not a production
  dependency.

- Future action: M09-T03 and M10-T05 must apply corresponding registry-identity, source/import, and
  browser E2E evidence to Desen App before P-06 or P-07 can become `PROVEN`. Any legitimate future
  reference-host infrastructure change must update the semantic allowlist and mutation suite.
  Native hosts require target-specific executable registries and graph audits rather than
  inheriting this Web–React proof.

## PF-060 — Raw Source parsing needs an explicit interoperable JSON and finite-ingress profile

- Status: OPEN
- Blocks proof: No; M06-T01 can close the first publication stage without changing frozen protocol
  bytes or claiming that its project-owned ceilings are universal DESEN constants.
- Protocol location: SPEC Sections 11, 25.1, 26.1, and 27.8; Appendix B; IMPLEMENTATION-GUIDE
  Section 5; related findings `PF-006` and `PF-007`
- Observation: DESEN 0.1.0 requires JSON parsing before schema validation and later hashes parsed
  values through RFC 8785 canonicalization. A value-based canonicalizer cannot recover duplicate
  object member names that a permissive parser already discarded. The frozen protocol does not
  assign a raw-JSON diagnostic code, a Source-ingress size ceiling, decoded-string or value-count
  budgets, or a diagnostic severity field. Appendix B `SCHEMA_INVALID` describes a parsed document
  failing its normative schema, not bytes that never became an interoperable document. The
  Reference Profile's 2 MiB limit applies to a final Bundle rather than an authoring Source.
- Implementation decision: M06-T01 keeps raw parsing package-private and exposes no incomplete
  public publisher. Before any value reaches schema validation or hashing, a deterministic
  platform-neutral scanner rejects malformed syntax, duplicate member names after JSON escape
  decoding, unpaired Unicode surrogates, non-finite numeric outcomes, and finite-budget
  exhaustion. Duplicate diagnostics point to the decoded RFC 6901 member path when available;
  native parser messages and Source fragments never cross the boundary. Accepted values are
  detached and recursively frozen.

  The local profile permits at most 8,388,608 UTF-8 Source bytes, 256 JSON container levels,
  262,144 JSON value occurrences, 4,194,304 aggregate decoded string code units, and 1,024 code
  units in one numeric token. The Source ceiling is four times the Reference Profile's final
  Bundle ceiling so authoring and discovery data have bounded room before removal. Publisher-owned
  codes `run.desen.publisher/INVALID_SOURCE_JSON` and
  `run.desen.publisher/SOURCE_LIMIT_EXCEEDED` distinguish raw ingress from normative schema
  diagnostics. The Publisher result adds a local `error`/`warning` severity while preserving an
  Appendix B core diagnostic's independent `classification`.

  The public terminal contract follows the frozen guide's `ok` union: success contains only a
  fully validated immutable Bundle plus warnings; failure contains a first blocking error, its
  stage, and structurally no `bundle` member. The sixteen required Section 25.1 stages have stable
  local identifiers. Optional signing and publication metadata remain outside M06 and retain their
  existing M12 ownership.

- Future action: M06-T11 must exercise malformed, duplicate, non-interoperable, and finite-limit
  failures through the complete public Publisher and prove that none emits a Bundle. Later
  protocol work should define interoperable raw-JSON requirements, Source-ingress limits,
  diagnostic severity, and standard codes. G06 must remain conservative about full Publisher
  conformance until all Section 27.8 limits relevant to the complete pipeline are evidenced.

## PF-061 — Catalog discovery hints do not authenticate package observations

- Status: OPEN
- Blocks proof: No; M06-T02 can prove exact, deterministic Catalog selection and tuple consistency
  without claiming that a data-only resolver independently authenticated target-specific package
  bytes.
- Protocol location: SPEC Sections 8.3–8.5, 11.4, 25.1, and 27.3; `PIPE-029`–`PIPE-031`,
  `R-033`, `R-083`, `R-143`, `D-032`, and `D-033`; related findings `PF-007` and `PF-026`
- Observation: A Source Catalog requirement contains exact `id` and `version`, an optional exact
  `target`, and an optional `location` discovery hint. It contains no package digest. Multiple
  targets or package observations may therefore satisfy the same target-omitted requirement.
  The frozen protocol does not define a registry API, authenticated package-observation handle,
  or a cross-document JSON Pointer convention for reporting a resolved Catalog failure against
  its Source requirement. Equal canonical Catalog JSON also does not prove equal capability
  package artifact bytes: the target-specific package digest profile includes the projected
  Catalog plus exact implementation artifacts.
- Implementation decision: M06-T02 keeps resolution package-private and data-only. The caller
  supplies a closed array of package observations whose `observedPackageDigest` must already have
  been calculated by the applicable target profile. The resolver performs no filesystem, network,
  registry, loader, or callback operation. It compares strings by exact code-unit equality only;
  it never trims, normalizes Unicode, folds case, resolves a SemVer range, prefers a newer version,
  follows `location`, or selects the first candidate.

  A requirement succeeds only when exactly one candidate matches `id`, `version`, and the optional
  exact `target`. Multiple candidates are ambiguous even if their tuple and canonical Catalog JSON
  are identical, because Catalog equality cannot authenticate one physical package authority.
  Duplicate Source requirements preserve a one-to-one requirement-index projection while sharing
  the one uniquely selected package. Selected Catalogs pass an inert bounded snapshot, the frozen
  Catalog root and embedded-schema validator, exact envelope/Catalog identity comparison, exact
  lowercase SHA-256 digest consistency, and the trusted single-namespace Catalog-set validator in
  that order. Resolution, integrity, and namespace failures stop at their first normative stage
  and expose no Catalog authority or Bundle. Catalog diagnostics are mapped to the corresponding
  Source `/catalogs/{index}` requirement; namespace diagnostics also retain the stable
  `capabilityId`.

  The local profile admits at most 256 Source requirements, 1,024 candidates, 16 MiB canonical
  bytes per selected Catalog, 64 MiB in aggregate, 128 container levels, 100,000 JSON values,
  4,194,304 decoded string code units per Catalog, and 100,000 selected capability declarations.
  One identity field is limited to 4,096 code units and one stopped Catalog stage to 1,024
  diagnostics. These are project limits rather than universal DESEN constants. JavaScript
  reflection failures are contained and accessors are never invoked, but a general `Proxy` may
  run a reflection trap before throwing; no impossible side-effect-free Proxy-detection claim is
  made.

- Future action: M06-T08 now pins every selected tuple positionally into its nonterminal
  production document without adopting discovery hints. M06-T11 must still drive missing,
  ambiguous, malformed, digest-mismatched, namespace-conflicting, and finite-limit cases through
  the complete public Publisher. M07-T03 must verify installed package bytes and exact tuples
  before activation. A later protocol revision should standardize the resolver authority,
  target-omission ambiguity policy, diagnostic pointer profile, and package-observation
  authentication boundary. Signing, distributor immutability, and publisher identity remain M12
  responsibilities.

## PF-062 — Source-local checks and Catalog-backed references require distinct causal authority

- Status: OPEN
- Blocks proof: No; M06-T03 defines and proves one deterministic local ordering without changing
  frozen protocol bytes or claiming that its project-owned diagnostic limits are universal DESEN
  constants.
- Protocol location: SPEC Sections 8.1–8.5, 16–21, and 25.1; `PIPE-004`,
  `PIPE-026`–`PIPE-031`, `R-025`, and related findings `PF-009`, `PF-060`, and `PF-061`
- Observation: Publication step 4 groups source-level identifier and reference validation before
  steps 5–7 resolve, validate, and deconflict Catalogs. Entry existence, surface identity,
  exact requirement SemVer, and the surface-local node/behavior identity namespace are
  Catalog-independent. Whether a component, behavior, resource, or nested operation exists exactly
  once in the expected category is not: deciding that fact requires a structurally valid,
  digest-consistent, namespace-clean Catalog authority. DESEN 0.1.0 does not state whether an
  invalid Catalog or an otherwise unknown Source capability should win, whether package candidates
  may be observed before Source-local failure, or how a Publisher should preserve the logical
  `source-semantics` diagnostic stage when reference finalization causally follows Catalog stages.
- Implementation decision: M06-T03 splits the logical source-level step without duplicating
  Validator semantics. Strict JSON, the Source root, embedded state schemas, exact requirement
  versions, entry, surface identity, and the shared surface-local node/behavior identity namespace
  complete before any Catalog-candidate observation. The package-private Publisher then obtains
  M06-T02 exact Catalog authority. Only that exact runtime-authenticated Catalog set may finalize
  the Source-to-Catalog relation and category-aware component, behavior, resource, and nested
  operation references. A Catalog resolution, integrity, or namespace failure therefore wins over
  an indeterminate reference; with valid Catalog authority, an unknown or wrong-category reference
  reports `UNKNOWN_CAPABILITY` at its Source pointer and retains the `source-semantics` stage.

  The Validator seam authenticates the exact recursively frozen prepared Source through
  module-private runtime metadata and requires the existing trusted Catalog-set authority. A
  clone, serialization round trip, structural lookalike, or TypeScript cast cannot recreate either
  authority. The Publisher success is a frozen package-private immediate-composition shell
  containing those authorities, selected packages, and requirement alignment; the outer shell is
  not itself runtime branded. Later stages must not accept a caller-supplied or reconstructed shell.
  They must authenticate exact result identity or revalidate the coherence of every carried
  authority before relying on it.

  One task-owned report profile permits 1,024 diagnostics per stopped stage, 4,096 UTF-16 code
  units in one pointer, and 1,048,576 aggregate diagnostic and identity-context code units.
  Under-budget M06-T01 and M06-T02 failures pass through unchanged. An inherited or task-owned
  over-budget report becomes one redacted
  `run.desen.publisher/SOURCE_PREFLIGHT_LIMIT_EXCEEDED` error at the same stopped stage. Every
  failure exposes no Source, Catalog set, selected package, alignment, partial value, or Bundle.

  M06-T03 remains nonterminal and package-private. It does not validate M06-T04 prop, slot, style,
  event, command, or behavior contracts; discharge M06-T05 dynamic binding, state, predicate,
  repeat, action, or runtime obligations; normalize or hash Source data; pin, validate, revise, or
  emit a Bundle; or claim discovery, download, activation, rendering, native-runtime behavior,
  signing, npm publication, or deployment.

  Evidence: `docs/proof/artifacts/publisher-0.1.0-source-preflight.json`
  `sha256:07537cc034d99dec3cb887805381f58a550de3a0dcb694564ab6a20ac760a387`.

- Future action: A later protocol revision should separate Catalog-independent Source validation
  from Catalog-backed reference finalization, define their diagnostic-stage and failure-precedence
  rules, and add conformance vectors for candidate non-observation plus simultaneous Catalog and
  reference failure. M06-T04 and M06-T05 must consume only the exact in-process preflight authority
  under the guardrail above; M06-T11 must prove the complete invalid-source matrix still emits no
  Bundle.

## PF-063 — Static component contracts and dynamic execution contracts need separate Publisher seams

- Status: OPEN
- Blocks proof: No; M06-T04 and M06-T05 now prove the two deliberately separated static and
  cumulative execution slices without misrepresenting either task boundary.
- Protocol location: SPEC Sections 17–21, 25.1, and 26.3; `PIPE-032`, `N-026`, `N-027`, `R-057`,
  `R-058`, `R-060`, `R-064`, `R-085`, `R-120`, and `R-148`; related findings `PF-010`, `PF-051`,
  and `PF-062`
- Observation: Publication step 8 requires capability contract validation for components,
  behaviors, resources, operations, props, slots, events, commands, styles, and related schemas.
  The implementation plan deliberately assigns statically knowable component and interaction
  contracts to M06-T04, then dynamic binding compatibility and recorded runtime validation
  obligations to M06-T05. The current Validator interaction seam cleanly proves the first slice.
  Its cumulative execution seam also prepares resource and operation schemas, but necessarily
  composes state, binding, predicate, action, lifecycle, and runtime obligations. Calling that
  cumulative seam in M06-T04 would silently absorb M06-T05 and make the task boundary and evidence
  false; omitting resource and operation contracts without recording the split would overclaim
  complete publication-step coverage.
- Implementation decision: M06-T04 runs M06-T03 internally and accepts no reconstructed stage
  shell. It upgrades the exact selected Catalog array through the public interaction-contract
  preparation authority, then validates the exact prepared Source for component props and Variant
  props, slot presence/cardinality/accepted children, style parts and visual states, component and
  behavior events, statically known commands, behavior props/slots/styles, attachment, and
  conflicts. Unsafe Catalog contract schemas fail before Source capability values are observed.
  The Validator's cloned Source and dynamic-obligation projection are not accepted or exposed.

  Blocking failures retain exact Validator identity and stop at `capability-contracts`; they expose
  no Source, Catalog, selected package, requirement alignment, obligation, partial value, or
  Bundle. Static success retains the exact M06-T03 authority and may emit only fixed, deterministic
  `run.desen.publisher/DEPRECATED_CAPABILITY` warnings for exact Source use sites whose selected
  Catalog declaration has an own `deprecated` value of `true` or a string. Catalog prose and
  replacement hints are never disclosed or selected. The common finite report profile permits
  1,024 diagnostics, 4,096 pointer code units, and 1,048,576 aggregate diagnostic/context code
  units; a crossing becomes one redacted error rather than a truncated warning set.

  Review also found that inherited optional Source fields and success discriminators could be read
  through JavaScript's prototype chain in the shared semantic/interaction traversal. The Publisher
  and Validator now require own data properties for the affected optional fields and stage
  discriminators. Focused regressions cover inherited target, behaviors, event maps, slots,
  settlement handlers, deprecation flags, and lower-stage success markers one at a time. This is
  an inert-data guarantee, not a claim that an arbitrary Proxy or inherited accessor can be
  detected without any observable reflection.

  Evidence: `docs/proof/artifacts/publisher-0.1.0-capability-preflight.json`
  `sha256:2c55593b69fd5203d3fe2aeaeb8e59dc70cb4a89c4168605c581c17fd1aad56e`.

  M06-T05 now runs M06-T04 internally, re-authenticates the exact prepared Source and execution
  Catalog set, prepares resource and operation input/output schemas, checks all statically
  decidable resource, operation, state, predicate, repeat, navigation, refresh, command-target,
  lifecycle, and binding contracts, and records the complete normalized dynamic-obligation set.
  It never evaluates a runtime value. Capability, state/control-flow, and binding diagnostics
  retain emission-site phase ownership and fail in that exact order. A failure exposes no Source,
  Catalog, selected package, alignment, warning, obligation, partial value, or Bundle. Success
  preserves the exact upstream authorities and warnings, adds only the exact execution Catalog
  authority and bounded obligations, and remains package-private and nonterminal.

  The local finite envelope admits at most 4,096 obligations, 4,096 UTF-16 code units in one
  obligation pointer, and 1,048,576 aggregate obligation/identity-context units. A crossing rejects
  the complete intermediate at `binding-compatibility`; it never truncates obligations. This
  completes the Publisher's `PIPE-032` resource/operation and dynamic-obligation slice and supplies
  the missing publisher-side part of the composed `N-027` evidence.

  The M02 traceability artifact remains an immutable historical ownership ledger: its `PIPE-032`
  row names M06-T04 as the primary implementation owner and M06-T11 as the terminal matrix owner.
  It does not encode every successor subtask needed to complete that broad step. This finding and
  the T05 receipt record the required completion dependency without retroactively rewriting the
  already-proven M02 artifact.

  Evidence: `docs/proof/artifacts/publisher-0.1.0-execution-preflight.json`
  `sha256:6127bc2edd417975d4ae311b7934d9f85048928c84b1500ab50af8f42731ca67`.

- Future action: M06-T11 must drive both T04/T05 slices through the terminal public Publisher and
  prove every invalid case emits no Bundle. A future protocol revision should expose explicit
  publication substage ownership and a standard aggregate runtime-obligation envelope if
  independent publishers require byte-identical failure behavior.

## PF-064 — Publication stage provenance belongs at diagnostic emission sites

- Status: OPEN
- Blocks proof: No; M06-T05 defines a deterministic project-owned stage profile without changing
  DESEN 0.1.0 diagnostic identities.
- Protocol location: SPEC Sections 25.1 and 26.3; publication steps 8–10; `PIPE-032`, `PIPE-033`,
  `PIPE-034`, `R-052`, and `R-057`; related findings `PF-010`, `PF-051`, and `PF-063`
- Observation: The cumulative M02-T10/T11 Validator correctly returns all static execution
  diagnostics, but a Publisher must stop separately at capability contracts, state/control flow,
  and binding compatibility. Several diagnostic codes can arise in more than one conceptual
  phase, and JSON Pointer shape is not normative phase metadata. Running the cumulative API once
  per Publisher stage repeats prerequisite work and can change simultaneous-error precedence;
  classifying the final array by code or pointer is brittle and not justified by the frozen
  protocol.
- Implementation decision: Validator emission sites now attach private phase provenance to each
  T10/T11 diagnostic. `validateDesenPreparedSourcePublicationContracts` authenticates the exact
  prepared Source and exact execution Catalog authority, performs one document analysis, and
  returns only the earliest non-empty phase in the order `capability-contracts`,
  `state-and-control-flow`, then `binding-compatibility`. Existing cumulative Validator APIs keep
  their previous normalized diagnostics. Publisher consumes this phase-aware result directly and
  never reconstructs a T04 shell or infers stage ownership.

  Lower-stage deprecation warnings cross only a complete T05 success. A later blocking failure is
  error-only, because warnings from an unpublished intermediate are not terminal publication
  output. Runtime obligations may be discovered internally during a failed analysis, but Publisher
  exposes them only after every blocking phase and the complete finite envelope pass. The envelope
  is an output admission bound; it does not claim incremental Validator allocation accounting.

  Evidence: `docs/proof/artifacts/publisher-0.1.0-execution-preflight.json`
  `sha256:6127bc2edd417975d4ae311b7934d9f85048928c84b1500ab50af8f42731ca67`.

- Future action: A future DESEN revision should standardize explicit diagnostic-to-publication-stage
  ownership, simultaneous-error precedence, whether nonblocking warnings survive a later blocking
  phase, and an interoperable obligation-report limit. M06-T11 must preserve the same precedence
  through terminal `publish` failures.

## PF-065 — Publication preservation is parsed-value exact and broader than the named array list

- Status: OPEN
- Blocks proof: No; M06-T06 defines and proves one bounded lossless intermediate without changing
  frozen protocol bytes or claiming that raw JSON lexical spelling survives parsing.
- Protocol location: SPEC Sections 10.2, 10.5, 13.5, and 25.1; `R-037`, `R-107`, `N-012`,
  `N-014`, and `N-021`; related findings `PF-054`, `PF-060`, `PF-062`, and `PF-064`
- Observation: Section 10.5 explicitly names slots, actions, variants, Catalog requirements, and
  repeated output as semantically ordered arrays. The complete Source graph also contains ordered
  behavior attachments, predicate arguments, nested settlement actions, ValueSpec arrays, and
  extension-owned arrays whose order cannot be reconstructed safely once discarded. Separately,
  unknown-extension preservation applies to the parsed source document; DESEN 0.1.0 does not
  require preservation of raw whitespace, escape spelling, number-token spelling, or object-member
  lexical order after JSON parsing. Finally, node ids are unique only within a surface, so a
  publication trace that incorrectly requires global node-id uniqueness would reject valid
  multi-surface Sources.
- Implementation decision: M06-T06 invokes M06-T05 internally from raw Source JSON and closed
  package candidates. It accepts no caller-created predecessor shell. The exact authenticated
  Source, execution Catalog, selected packages, requirement indexes, warnings, and obligations
  cross by runtime identity. A separate frozen projection retains `desen`, `id`, `entry`,
  `surfaces`, and optional root `extensions`; ordered Source Catalog requirements remain separate
  for M06-T08 exact-tuple pinning. Every nested production value, every Source-reachable extension,
  and every semantic array therefore remains the exact parsed Source reference. Extension payloads
  stay opaque even when they contain core-looking keys or node-shaped values.

  Top-level `authoring` remains present on the authenticated Source and is absent only from the
  separate projection. This is not yet authoring removal or normalization. M06-T07 owns those
  transformations and must consume only this exact T06 authority.

  One iterative schema-edge walk emits a complete immutable five-string record for each reachable
  component node: document id, surface id, unchanged Source node id, capability id, and exact RFC
  6901 pointer. Map traversal uses deterministic UTF-16 key order and arrays retain Source index
  order. Trace identity is the surface-scoped `(surfaceId, sourceNodeId)` relation plus its exact
  pointer; equal node ids on different surfaces remain valid. Behavior ids remain preserved in the
  Source graph but are not falsely reclassified as component nodes. Extension and authoring
  payloads never create trace records.

  The project-owned output envelope admits 25,000 trace records, 4,096 UTF-16 code units in one
  pointer, and 4,194,304 aggregate identity/pointer units. Exact ceilings pass; a one-below
  crossing rejects the complete intermediate at `normalization` with one redacted error and no
  inherited warning, partial authority, or Bundle. Opaque extension and state-schema content remain
  bounded by the inherited raw-Source profile rather than a new T06 payload limit.

  Evidence: `docs/proof/artifacts/publisher-0.1.0-source-preservation.json`
  `sha256:261b820b381a0d0c8005a7baf85e33464f2558bfa2a263b94dcb6fd28ddd38ff`.

- Future action: M06-T07 now calculates the Source digest first, removes only top-level
  `authoring`, and normalizes without dropping, reordering, or interpreting preserved values.
  M06-T08 now authenticates and carries the same digest, observable data, and unchanged node ids
  into its exact pinned document. M06-T09 and M06-T10 must carry them through a valid deterministic
  Bundle, while M06-T11 must prove all invalid preservation cases emit no Bundle. M08-T03 and
  M08-T07 retain editor reorder and save/open round-trip ownership. A later protocol revision
  should state the complete semantic array inventory, the parsed-value versus raw-lexical
  preservation boundary, and the surface-scoped node-identity rule directly.

## PF-066 — Deterministic normalization requires one explicit minimal Publisher profile

- Status: OPEN
- Blocks proof: No; M06-T07 defines and proves one conservative deterministic profile without
  changing frozen protocol bytes or claiming that every conforming Publisher must choose the same
  optional transformations.
- Protocol location: SPEC Sections 10.2, 10.5, 11.2, 12.4, 13.5, 25.1, 25.2, and 27.8;
  `SN-005`, `C-005`, `C-015`, `PIPE-036`, `PIPE-037`, `R-034`, `R-099`, `R-107`, `R-124`, and
  `N-018`; related findings `PF-060`, `PF-062`, `PF-064`, and `PF-065`
- Observation: Section 25.2 permits schema-default application, redundant-empty removal,
  canonical non-semantic map ordering, dependency pre-indexing, discovery-to-exact requirement
  resolution, and post-revision publication metadata, but it does not require any one optional
  transform or define a single interoperable normalized byte representation. Section 11.2 also
  requires the Source digest before publication-specific normalization. An implementation that
  hashes the normalized projection, recursively deletes every key named `authoring`, treats
  JavaScript object enumeration as RFC 8785 order, or spends the complete final-Bundle byte budget
  before later tuple and digest fields are added would silently strengthen or violate the frozen
  protocol.
- Implementation decision: M06-T07 invokes M06-T06 internally from raw Source JSON and closed
  package candidates. It accepts no caller-created preservation shell. The authenticated
  pre-normalization Source, execution Catalog set, selected packages, requirement alignment,
  warnings, obligations, preservation projection, loose requirements, and node trace cross by
  exact runtime identity. T07 calculates `sourceDigest` from that exact unchanged Source through
  the frozen Section 11.2 helper before any authoring removal or normalization. Root authoring
  changes leave the digest unchanged, while nested extension changes remain digest-significant.
  M06-T08 now independently authenticates and carries this value into exact Catalog pinning
  without recomputing a post-normalization digest.

  A new detached, recursively frozen production-document base contains exactly Bundle `kind`,
  `desen`, `id`, `entry`, `surfaces`, and optional root `extensions`. Producing this base completes
  actual top-level authoring removal. Source `kind`, loose Catalog requirements, discovery
  locations, exact `requires`, `sourceDigest`, `revision`, and `publication` remain absent from
  this document. `sourceDigest` is instead a separate immutable field on the nonterminal success.
  A nested extension member named `authoring` is preserved as opaque data; no substring or
  recursive name filter is used.

  The local 0.1.0 profile chooses the smallest permitted normalization: one RFC 8785
  serialization/parse round trip. It applies no schema default, removes no empty optional member,
  builds no hidden index, and never sorts or deduplicates a semantic array. Identifiers,
  conditions, literals, capability ids, extension values, and trace relations retain their parsed
  meaning. Repeated and differently inserted object members produce equal canonical bytes, while
  in-memory JavaScript own-key enumeration—especially for integer-like keys—is explicitly
  non-authoritative.

  The normalized base admits at most 2,097,152 canonical UTF-8 bytes. Exact capacity passes and a
  one-byte crossing rejects the complete intermediate at `normalization` with one redacted error,
  no inherited warning, and no partial authority. Invalid digest authority rejects earlier at
  `source-digest` under the same rule. Zero is valid for this new output ceiling and
  deterministically rejects any nonempty normalized document. The limit is an early Publisher
  envelope, not proof that the final Bundle fits after exact requirements, digests, and revision
  are added.

  Evidence: `docs/proof/artifacts/publisher-0.1.0-source-normalization.json`
  `sha256:59cb08f75849ae4831644e746a72186227a9774ceb7bcd8281156ccbc6dd085e`.

- Future action: M06-T08 now authenticates and carries T07's exact `sourceDigest` while pinning
  exact Catalog tuples. M06-T09 must validate the complete Bundle, enforce the final Reference
  Profile byte limit, and calculate revision from the exact normative projection. M06-T10 must
  prove official golden and double-publish determinism; M06-T11 must prove every invalid case
  emits no Bundle. A later protocol revision should either standardize a canonical normalization
  profile or make byte-level interoperability expectations explicitly profile-scoped.

## PF-067 — Exact Catalog pinning is positional and discovery hints remain Source-only authority

- Status: OPEN
- Blocks proof: No; M06-T08 defines and proves one conservative exact-pinning boundary without
  changing frozen protocol bytes or assigning runtime activation authority.
- Protocol location: SPEC Sections 8.4, 8.5, 11.2, 11.5, 12.2, 13.3, and 25.1; `C-013`, `C-014`,
  `PIPE-035`, `PIPE-038`, `R-018`, `R-028`, `R-033`, `R-034`, `R-136`, `R-139`, `A-004`,
  `D-031`, `N-016`, and `N-020`; related findings `PF-060`, `PF-061`, `PF-065`, and `PF-066`
- Observation: M06-T02 deliberately deduplicates selected packages while preserving a positional
  `requirementPackageIndexes` array. Building Bundle requirements from `packages[i]`, a map keyed
  only by package identity, or a `Set` would therefore lose repeated Source positions and their
  distinct extensions. Source requirement `location` creates a second subtle boundary: it is an
  authenticated Source field and correctly affects the Source digest, but the protocol assigns it
  discovery—not production-selection—semantics. Recursively deleting every `location` would also
  corrupt opaque extensions.
- Implementation decision: M06-T08 invokes M06-T07 internally exactly once from raw Source JSON
  and the closed package-candidate inventory. It accepts no caller-created T07 result. The exact
  Source digest is independently recalculated from the same authenticated pre-normalization
  Source, checked for SHA-256 syntax, and compared byte-for-byte with T07's carried value before
  any tuple is constructed. A mismatch or digest-helper failure returns the closed
  `source-digest` failure and never silently substitutes the new value.

  Each Source requirement position then resolves through
  `requirementPackageIndexes[requirementIndex]`. The exact selected package supplies `id`,
  `version`, `target`, and `packageDigest`; output renames the final field to `digest`. A Source
  target, when present, must already match exactly. When absent, only the selected package target
  fills it. The implementation applies no range, newest-version, best-match, trimming, case-folding,
  Unicode-normalization, candidate-order, sorting, or deduplication policy.

  Requirement `extensions` cross by exact frozen identity and remain opaque. Top-level
  requirement `location` is never read or copied into the tuple, while nested extension fields
  with that spelling remain data. The proof exercises `A, B, A` requirements with positional
  indexes `0, 1, 0`, reversed candidate allocation, omitted target, two discovery locations,
  duplicate package adoption, package-digest change, root-authoring independence, and hostile
  authority shells.

  The package-private result carries all T07 authority by runtime identity and adds only one
  recursively immutable pinned document. That document remains nonterminal: it has no revision,
  final Bundle validation, publication metadata, signing, runtime, host, adapter, activation,
  storage, or deployment authority.

  Evidence: `docs/proof/artifacts/publisher-0.1.0-catalog-pinning.json`
  `sha256:de37aa35bcdc67e637d323a559f104160479315f56961c962e00bfdc74459c8f`.

- Future action: M06-T09 must enforce the complete Bundle schema, semantic validation, final
  Reference Profile byte ceiling, and exact revision closure over this pinned document. M06-T10
  must prove the official source-to-bundle golden and double-publication determinism. M06-T11 must
  drive location, duplicate, digest, tuple, and all predecessor failures through the public
  Publisher and prove that none emits a Bundle. M07-T03 must independently verify installed package
  bytes against these exact tuples before activation. A later protocol revision should standardize
  the target-omission ambiguity policy and make positional requirement-to-package evidence explicit.

## PF-068 — Terminal revision closure needs a bootstrap profile and a concrete byte metric

- Status: OPEN
- Blocks proof: No; M06-T09 defines one deterministic local profile without changing frozen
  protocol bytes, signing policy, or activation authority.
- Protocol location: SPEC Sections 11.2, 11.3, 11.5, 13.1–13.3, 24.1, and 25.1; `SC-019`,
  `C-012`, `C-014`, `PIPE-005`, `PIPE-039`, `PIPE-040`, `R-007`, `R-012`, `R-029`, `R-031`,
  `R-035`, `R-036`, `D-030`, `D-035`, `R-123`, `N-016`, `N-018`, and `N-041`; related findings
  `PF-060`, `PF-066`, and `PF-067`
- Observation: the frozen Bundle schema requires `revision`, while the normative revision
  projection excludes `revision` itself. A Validator cannot accept the otherwise complete Bundle
  before some revision is present, but hashing a placeholder and trusting it would leave no
  closure proof. The Reference Profile separately limits an uncompressed Bundle to 2 MiB without
  naming a transport encoding or defining whether an implementation should count an in-memory
  object, source text, or canonical bytes.
- Implementation decision: M06-T09 consumes only the exact M06-T08 authority. It first calculates
  a provisional revision over the pinned revision-free document through the frozen protocol
  helper. It constructs a candidate by explicitly copying the permitted Bundle members and adding
  only that revision; no object spread, default, `publication`, authoring state, or task-local
  metadata can enter.

  The Publisher interprets “2 MiB uncompressed” for this deterministic 0.1.0 profile as at most
  2,097,152 bytes of RFC 8785 canonical UTF-8 for the complete Bundle represented at the current
  boundary. It measures the candidate before Validator work and the Validator snapshot afterward.
  Exact capacity passes; a one-byte crossing rejects atomically at `bundle-validation`. If a later
  owner adds optional `publication` metadata, that owner must repeat the complete measurement.

  The exact candidate and exact M06-T08 Catalog set cross
  `validateDesenBundleExecutionContracts` once. A valid result may retain unresolved runtime
  obligations; those do not invalidate a structurally and semantically publishable Bundle and do
  not cross the public result. The result must be an authenticated ordinary frozen shell whose
  `value` is an independent recursively immutable graph. Its canonical bytes must equal the
  candidate byte-for-byte. The Publisher then recalculates revision over that exact snapshot and
  requires provisional, embedded, and closing values to match.

  Public success returns only the Validator's exact Bundle snapshot plus M06-T08's exact warnings.
  Every inherited or task-owned failure retains the closed no-Bundle result. Malformed predecessor
  or Validator shells, mutable or shared graphs, forged diagnostics, non-byte canonicalization
  output, helper throws, byte divergence, overflow, and revision mismatch expose no Source,
  Catalog set, obligation, warning, candidate, partial value, or Bundle.

  Evidence: `docs/proof/artifacts/publisher-0.1.0-bundle-publication.json`
  `sha256:2942aa84066354ee7c27557263a900eb8fd3a149d085ab55c7f880dcfca998df`.

- Future action: M06-T10 must compare two independent public publishes with each other and with the
  official publication-free Bundle bytes, making P-03 and P-11 terminally provable. M06-T11 must
  drive the complete invalid-source matrix only through the public entry point and prove exact
  no-Bundle precedence. M07-T02 must independently verify stored Bundle revision, Source digest,
  and final bytes before activation. A later protocol revision should standardize both the
  provisional-to-closure procedure and the precise byte metric if cross-implementation byte-limit
  parity is required.

## PF-069 — Public rejection completeness is causal, not one negative per named stage

- Status: OPEN
- Blocks proof: No; M06-T11 defines and proves one conservative task-owned public rejection
  profile without changing frozen protocol bytes or manufacturing unreachable failures.
- Protocol location: SPEC Sections 7.3, 10.2, 11.2–11.5, 24.1, 25.1, 25.2, and 27.8; `C-011`,
  `C-012`, `PIPE-004`, `PIPE-025`–`PIPE-041`, `R-018`, `R-028`, `R-034`, `R-035`, `R-036`,
  `R-123`, `A-011`, `D-009`, `N-016`, `N-018`, and `N-041`; related findings `PF-047`,
  `PF-060`–`PF-068`
- Observation: the frozen publication pipeline names deterministic transformation and closure
  stages alongside input-validation stages, but it does not imply that every stage has a natural
  invalid value at the fixed public two-argument boundary. Once an authenticated predecessor has
  succeeded, `source-digest`, `authoring-removal`, exact Catalog pinning, and revision closure are
  deterministic internal work. Inventing a public failure for each name would require a private
  seam, forged authority, or case-specific implementation branch and would weaken rather than
  strengthen the public proof.

  Rejection completeness is instead causal: each reviewed invalid input must stop at the earliest
  stage that can decide it, blocking diagnostics must precede warnings, and no stopped path may
  expose a Bundle or lower publication authority. The same rule applies to finite limits. A broad
  count-limit example cannot stand in for independently enforced pointer, aggregate, warning,
  obligation, trace, normalized-byte, and final-Bundle envelopes. Discovery `location` also cannot
  turn a missing or digest-inconsistent package observation into trusted Catalog authority.

- Implementation decision: M06-T11 imports only the built public
  `packages/publisher/dist/index.js` root in an isolated process. Its 127 task-owned invalid cases
  call only `publishDesenSource(rawSource, catalogPackages)`. Every failure has exactly
  `{ diagnostics, ok, stage }`, is recursively immutable, begins with an error, reports the same
  stage on its first diagnostic, and exposes no Bundle, Source, Catalog, selected package,
  requirement index, obligation, trace, normalized document, digest, revision, publication, or
  other partial authority.

  Stage-eight capability errors outrank simultaneous stage-nine and stage-ten errors; stage nine
  outranks stage ten; and a stage-ten error suppresses an already discoverable deprecation warning.
  Dynamic runtime obligations remain valid publication successes at their exact public count,
  pointer, and aggregate boundaries. The remaining five positive guards preserve the official
  golden, exact complete-Bundle admission, sanitized warnings, and deterministic repeated output,
  for 135 focused cases total.

  The matrix independently crosses every reviewed naturally reachable default-limit branch across
  raw Source parsing, Catalog resolution/integrity, inherited and task-owned error reports,
  deprecation-warning reports, execution obligations, Source-node trace output, normalized bytes,
  and final Bundle bytes. The complete ordered Publisher registry contains all 14 project-owned
  diagnostic codes with exact default stage and severity metadata.

  Evidence authority is one-way. The receipt pins exact frozen fixtures, M06-T03 through M06-T10
  prerequisites, built public files, 12 trace rows, 31 exact task-applicability records, two
  task-local PF-047 applicability records, and the current successor surfaces that register T11.
  Earlier historical receipts do not depend back on this task and are not rewritten. Sixty-seven
  independent root proof/mutation cases protect the artifact, and the complete Publisher suite
  passes 292/292.

  Evidence: `docs/proof/artifacts/publisher-0.1.0-invalid-source-matrix.json`
  `sha256:fc5904ea6ec4e6495629fc4de8009fee66155938013068b709dd1ff40c1e98d8`.

- Future action: M07 must independently verify stored Bundle bytes, installed package tuples, and
  activation authority rather than treating Publisher success as storage or runtime trust. M12-T01
  and M12-T08 must retain the task-owned qualifier, measure the remaining whole-system limits, and
  keep Publisher conformance `PLANNED` until all assigned evidence is complete. A later protocol
  revision should state causal diagnostic precedence and distinguish total deterministic stages
  from stages that admit public invalid-data vectors.

## PF-070 — One protocol revision may describe multiple publication byte sequences

- Status: OPEN
- Blocks proof: No; M07-T01 defines a conservative exact-byte ownership rule for the local POSIX
  repository without changing the frozen revision projection or granting activation authority.
- Protocol location: SPEC Sections 11.3, 13.2, 24.1, and 28.2; `PIPE-005`, `PIPE-009`, `R-012`,
  `R-125`, `A-007`, and `N-019`; related findings `PF-068` and `PF-069`
- Observation: DESEN 0.1.0 excludes root `publication` from the Bundle revision projection, while
  its immutability rules prohibit replacing the bytes or content associated with a revision.
  Consequently, two complete Bundles may have the same normative revision while differing in
  exact canonical bytes only because of publication metadata. Treating revision equality as
  permission to rewrite the stored artifact would violate immutability; treating semantic JSON
  equality as storage identity would also invent a non-normative equivalence rule.
- Implementation decision: M07-T01 gives the first successfully committed complete byte sequence
  exclusive ownership of its revision path. A byte-identical retry returns `unchanged` without
  replacing the inode; any different sequence, including the proven publication-only variant,
  returns `conflict` and preserves the winner. Mutable publication metadata therefore belongs
  outside this immutable entry in the local profile.

  The POSIX implementation snapshots the caller's exact `Uint8Array` before asynchronous work,
  writes an exclusive same-shard temporary, changes it to mode `0400`, flushes and re-reads it,
  and commits with a no-clobber hard link. Every writer flushes the algorithm parent and
  revalidates the shard before use, even when a concurrent writer created that shard. It flushes
  newly established parent-directory entries and the final shard before reporting `stored`.
  Readers accept only one read-only regular-file link, flush the shard before returning, remove
  only an exact owned committed-temporary alias, return fresh copies, and reject unowned hard
  links, symbolic links, special files, replaced identities, and mutable modes. Commit-aware
  cleanup flushes the shard again after a post-link failure, so explicit uncertainty remains
  retry-safe.

  This is a local storage profile, not a new protocol digest. It assumes an application-owned
  POSIX root and does not claim defense against hostile same-UID or privileged mutation between
  Node.js path operations. An abrupt pre-link death may leave an unaddressed temporary with no
  revision authority; later recovery/maintenance work owns its lifecycle. M07-T02 still must
  parse stored bytes and independently verify protocol version, revision, available Source
  digest, and complete size before any activation path can trust them.

  Evidence: `docs/proof/artifacts/control-plane-api-0.1.0-bundle-store.json`
  `sha256:698be7d5610d1732ad991bf7e58131e81d2c34ffa888f65ec3c7916334f54795`.

- Future action: M07-T05 keeps mutable channel metadata outside revision artifacts. M07-T06 through
  M07-T10 now preserve the same first-writer and retry semantics through staging, activation,
  crash recovery, bounded fault injection, ordered invalid candidates, and concurrent races.
  M07-T11 must retain that separation while the separately built host consumes discovery. A later
  protocol revision should decide
  whether publication metadata receives a separate artifact identifier, is always stored outside
  the revision-closed Bundle, or becomes part of a newly specified complete-byte identity.

## PF-071 — Integrity ingress distinguishes stored bytes, canonical Bundle size, and Source material

- Status: OPEN
- Blocks proof: No; M07-T02 freezes a fail-closed local verification profile without changing any
  DESEN 0.1.0 protocol byte, digest projection, or schema.
- Protocol location: SPEC Sections 11.3, 13.2, 24.1, and 28.2; `PIPE-010`, `PIPE-011`, `R-007`,
  `R-031`, `R-138`, `D-030`, `D-031`, `D-034`, and `D-035`; related findings `PF-068`–`PF-070`
- Observation: the 0.1.0 Reference Profile states a 2 MiB uncompressed Bundle limit but does not
  define whether that metric means received JSON bytes, RFC 8785 canonical bytes, or both. JCS
  identity does not require a stored JSON document itself to be canonical, and compact exponent
  notation can expand substantially when canonicalized. Likewise, a caller-supplied digest string
  is not independent evidence that available Source material matches the Bundle.
- Implementation decision: M07-T02 snapshots and limits the exact stored Bundle view to 2,097,152
  bytes, then performs bounded fatal UTF-8 and strict interoperable-JSON parsing. Before structural
  validation can allocate its inert snapshot, it measures the parsed document against the
  2,097,152-byte RFC 8785 ceiling; after validation it repeats that measurement on the immutable
  accepted Bundle and checks it against the real canonical bytes. Noncanonical whitespace is
  accepted and is not rewritten in storage; both raw and canonical limits must pass. Fixed depth,
  value-count, decoded-string, and number-token budgets prevent a compact input from bypassing the
  allocation boundary.

  Exact root and embedded-schema admission is protected by a task-local standalone guard generated
  from the frozen Source, Bundle, and Draft 2020-12 schemas with pinned Ajv and Prettier versions.
  The guard stops at the first structural issue, and its embedded-schema profile stops at the first
  dialect, identifier, reference, vocabulary, or regular-expression issue. Only guard-successful
  data reaches the established exhaustive Validator, preventing untrusted arrays or schema maps
  from amplifying one rejected document into an unbounded diagnostic list. Runtime verification
  performs no schema compilation, dynamic code loading, filesystem resolution, or network access.

  The verifier then requires the outer storage key, embedded `revision`, and independently
  recalculated revision to be exactly equal. When Source material is available, the caller must
  provide its real raw bytes, bounded to 8,388,608 bytes and subjected to the same strict parser.
  Its complete canonical form is independently bounded to 8,388,608 bytes before validation and
  rechecked on the accepted immutable snapshot, preventing compact numeric input from expanding
  inside validation or digest calculation. The exact Source schema then passes before the digest is
  independently recalculated. Absence is represented explicitly as `not-available`; it is never
  reported as a successful digest match. Source-only resource exhaustion uses the project-owned
  `run.desen.control-plane/SOURCE_MATERIAL_LIMIT_EXCEEDED` code rather than redefining a protocol
  diagnostic.

  Success returns one frozen, factory-authenticated integrity authority containing the immutable
  validated Bundle and safe metadata but no raw Bundle or Source bytes. A copied or cast object
  has no runtime authority. A publication-bearing Bundle may legitimately keep the same revision
  because the frozen revision projection excludes root `publication`; the verifier preserves and
  validates that complete Bundle while still enforcing its complete canonical size.

- Future action: M07-T03 consumes only authenticated integrity authority for exact installed
  package preflight. M07-T04 adds reference and activation-limit checks; M07-T05 owns Source and
  channel storage/API; and M07-T06 through M07-T10 now prove staging, activation, recovery,
  bounded faults, ordered invalid candidates, concurrent winners, and exact restart behavior.
  M07-T11 must preserve this ingress order in separately built host consumption. A later protocol
  revision should define the normative Bundle-size metric explicitly.
  If the same hostile-JSON boundary is needed elsewhere, extract the reviewed parser as a shared
  internal primitive without altering the frozen M06 Publisher evidence or weakening its limits.

## PF-072 — Verified package bytes need an explicit snapshot-to-staging TOCTOU boundary

- Status: OPEN
- Blocks proof: No; M07-T03 closes its local installed-package verification boundary without
  changing a DESEN 0.1.0 protocol byte or claiming that staging and activation are complete.
- Protocol location: SPEC package-selection, exact-digest, preflight, and activation requirements;
  `PIPE-006`, `PIPE-012`, `PIPE-013`, `R-005`, `R-017`, `R-018`, `R-021`, `R-118`, `R-127`,
  `R-139`, `A-003`, `A-004`, `A-012`, `D-032`, and `D-033`; related findings `PF-061`, `PF-067`,
  and `PF-071`; related decision `ADR 0008`
- Observation: checking a caller-provided digest does not prove which implementation bytes were
  inspected. Even after recalculating a digest, retaining caller-owned mutable byte views would
  allow those bytes to change between package preflight and later staging. DESEN 0.1.0 defines the
  exact required tuple and digest relation, but it does not prescribe a host packaging store or
  the lifecycle that carries verified bytes across this time-of-check/time-of-use boundary.
- Implementation decision: M07-T03 accepts only an authenticated M07-T02 integrity authority. It
  synchronously captures the selected candidate's inert enumerable own-data Catalog projection
  and exact attached, nonshared `Uint8Array` subviews into independent private snapshots, then
  independently recalculates the Web–React v1 digest. It binds the successful result to a
  package-private `WeakMap`; the frozen public authority exposes only byte-free metadata and
  positional indexes, with no loader, module specifier, filesystem location, staging operation,
  channel mutation, or activation operation. Caller mutation therefore cannot alter the bytes
  verified by M07-T03. Those copied arrays are nevertheless trusted package-private process state,
  not an immutable external package store, and M07-T03 neither stages nor activates them.
- Future action: M07-T04 consumes only the authenticated M07-T03 authority when checking
  surface and capability references. M07-T06 now stages from the private verified snapshots, copies
  artifact bytes into an independently closed candidate lifetime, recalculates their package
  digests, and binds the resulting indexes to a new opaque identity. M07-T07 through M07-T10 now
  prove that stale, failed, restarted, raced, or otherwise modified material cannot become active;
  a concurrent loser is consumed and requires a fresh staging authority before retry.
  If a later implementation moves installation across processes or into a persistent package
  store, it needs an authenticated installed-package store/handle rather than arbitrary caller
  callbacks or paths.

## PF-073 — Activation reference admission needs a conservative dynamic-limit projection

- Status: OPEN
- Blocks proof: No; M07-T04 can define one deterministic Reference Profile projection without
  changing frozen protocol bytes, resolving dynamic values early, or claiming staging authority.
- Protocol location: SPEC Sections 5.7, 17.6–17.7, 20, 24.1, and 27.8; `PIPE-007`, `PIPE-014`,
  `R-008`, `R-123`, and `D-035`; related findings `PF-037`, `PF-043`, `PF-071`, and `PF-072`
- Observation: DESEN 0.1.0 requires finite activation limits and names 5,000 nodes per surface
  after repeats, source depth 64, 1,000 instances per repeat, 64 actions per turn, settlement depth
  16, and 64 predicate arguments. It does not define whether the source root has depth zero or one,
  how activation preflight should bound a repeat whose item array is still dynamic, or whether a
  declared repeat limit above the active runtime profile is rejected or clamped. Activation step 6
  also names surface/capability reference preflight separately from step 7 runtime-index staging;
  treating T04 as execution-contract or staging authority would collapse that trust separation.
- Implementation decision: M07-T04 accepts only the exact live M07-T03 package authority. Before
  invoking an exhaustive semantic agreement fence, it performs one deterministic iterative walk
  over the private immutable Bundle and selected Catalog snapshots. The walk checks entry and
  surface identity, the complete surface-wide node/behavior identity namespace, category-correct
  component/behavior/resource/operation capabilities, declared handler events, navigation
  surfaces, resource-refresh aliases, component-command targets and names, and recursively nested
  operation references. Fixed aggregate node, action, predicate, and reference budgets prevent the
  walk or retained audit output from becoming unbounded.

  The source root has depth zero, so depth 64 passes and 65 fails. Repeat admission uses the same
  effective bound as the proved runtime: `min(declared limit ?? 1,000, 1,000)`. A literal item array
  uses its actual length and fails when that length exceeds the effective bound; a dynamic item
  value conservatively contributes the effective maximum. Saturating ancestor multiplication
  treats conditions as possibly true and includes component children nested in behavior slots.
  A surface whose maximum possible materialized-node count exceeds 5,000 fails atomically with
  `BUNDLE_LIMIT_EXCEEDED`; no branch truncates nodes or actions.

  Only a successful bounded scan reaches `validateDesenBundleSemantics`. Its independent immutable
  result must have the same RFC 8785 canonical content as the authenticated Bundle. M07-T02 already
  bounds and validates the complete structural graph, and M07-T03 authenticates the exact Catalog
  set, so the agreement call receives no caller-owned graph and every task-owned semantic
  reference issue has already passed the first-issue scan. A throw, invalid disagreement, or
  different success snapshot becomes one redacted internal rejection.

  Success exposes only a frozen profile/revision/per-surface audit handle backed by package-private
  identity. It carries no Bundle, Catalog, artifacts, dynamic obligations, runtime indexes,
  callbacks, staging operation, channel mutation, commit, or activation power. M07-T06 separately
  owns execution-contract preparation and staged indexes; M07-T07 must authenticate and join the
  exact T04 and T06 branches before any durable activation record can change.

- Future action: M07-T06 stages from the exact private package snapshots and independently owns
  runtime execution contracts, sorted dynamic obligations, and bounded callback-free runtime
  indexes. M07-T07 through M07-T10 now prove that every reference or limit failure remains
  pre-commit, preserves the exact active/previous-good record, and does not prevent a later valid
  candidate from activating and recovering. M12-T05 must measure the complete
  cross-system limit profile, including real materialized node counts, before N-041 can leave
  `PLANNED`. A later protocol revision should standardize the depth convention and dynamic
  activation projection if cross-implementation parity is required.

## PF-074 — Mutable control-plane channels are discovery pointers, not activation records

- Status: OPEN
- Blocks proof: No; M07-T05 defines a bounded local repository and HTTP profile without changing
  frozen protocol bytes or granting staging and activation authority.
- Protocol location: SPEC Sections 13.2, 24.1, 28.2, and 28.3; `R-125` and `N-019`; related
  findings `PF-070`–`PF-073`; related decision `ADR 0012`
- Observation: DESEN 0.1.0 permits a mutable channel to point at a current revision while requiring
  the revision artifact itself to remain immutable. It does not define a channel-name grammar,
  repository identity, optimistic-concurrency token, HTTP security profile, or relationship
  between a distribution channel and the separately staged/active/previous-good records. Calling
  a mutable channel “active” would bypass the specified preflight and atomic activation stages.
- Implementation decision: M07-T05 keeps three distinct namespaces. Editable Source bytes use a
  local key and monotonic compare-and-set generation. Bundle bytes continue through M07-T01's
  exact first-writer-wins store. A channel stores only a strict local name, one existing immutable
  revision, and a generation in separate SQLite metadata. Create requires an absent-record
  precondition; update requires the exact current generation; stale and exhausted generations
  make no change. Byte-identical Source writes and identical channel targets at the current
  generation are idempotent and do not advance the generation.

  Channel selection proves only that the exact revision exists in the immutable store. It may
  deliberately point at bytes later rejected by M07-T02 through M07-T04, because discovery is not
  integrity or activation. No T05 result contains an active revision, previous-good revision,
  staged index, authority handle, callback, loader, or activation operation. Source writes do not
  publish or move a channel; Bundle writes do not move a channel; channel writes do not touch the
  referenced Bundle inode or bytes.

  The local Fastify transport binds only loopback through its closed listener, authenticates every
  data route with a host-supplied bearer token, denies browser origins by default, and accepts only
  exact configured origins for fixed CORS preflight. Source and Bundle ingress preserve exact raw
  bytes under fixed limits; channel input is one closed JSON envelope. Errors are stable and
  redacted. SQLite remains behind replaceable repository contracts and stores only Source/channel
  metadata; the content-addressed Bundle tree remains authoritative for immutable artifacts.

- Future action: M07-T06 stages independently from authenticated M07-T03 package snapshots and
  neither reads nor mutates channel metadata; M07-T07 commits active and previous-good revisions
  as one separate durable record after authenticating the T04 and T06 branches. M07-T09 now proves
  that an invalid revision discovered through a channel fails before authority and preserves the
  exact durable active record. M07-T10 now proves the complete A → invalid B → valid C and race
  matrix without granting the discovery pointer any activation role. M07-T11 must consume the
  channel from the separately built
  reference host without treating it as activation evidence. A later protocol revision should
  standardize channel identity and concurrency only if cross-implementation transport
  interoperability is required.

## PF-075 — A staged runtime index is candidate authority, not an active-state slot

- Status: OPEN
- Blocks proof: No; M07-T06 can close one implementation-owned staging lifetime without changing
  frozen protocol bytes or claiming atomic activation, recovery, or last-known-good behavior.
- Protocol location: SPEC Sections 6.3, 24.1, 28.1, 28.3, and 28.4; `PIPE-006`, `PIPE-015`, `R-124`,
  `R-126`, and `R-127`; related findings `PF-071`–`PF-074`
- Observation: DESEN 0.1.0 orders runtime-index staging before atomic activation and requires users
  not to observe a half-applied Bundle. It does not define whether a host keeps one mutable global
  “staged revision,” creates an independent candidate per attempt, or how an in-process staging
  result proves its exact package-byte and execution-contract identity to the later commit owner.
  A mutable global slot could let concurrent or retried work replace the candidate that reference
  preflight actually admitted, while exposing active-style fields on a staging result would collapse
  the required pre-commit boundary.
- Implementation decision: M07-T06 accepts only the exact live M07-T03 package authority and creates
  an independent opaque authority for every complete attempt. Package bytes are copied into the new
  lifetime and re-digested; the exact execution Catalog set, canonically identical execution-valid
  Bundle, sorted dynamic obligations, prepared inert action programs, and immutable runtime indexes
  remain package-private. The visible result is recursively frozen, callback-free audit metadata.
  It has an explicit `stagedRevision` but no active revision, previous-good revision, generation,
  channel, loader, adapter, commit, activation, rollback, recovery, or host-effect authority. Two
  deterministic attempts can expose equal audit summaries while retaining distinct private
  identities, so neither silently overwrites a process-global staged or active record.
- Future action: M07-T07's accepted design authenticates the exact M07-T04 reference authority and
  M07-T06 staging authority through their shared M07-T03 object identities. A successfully joined
  T06 handle transfers synchronously and one-shot out of the staged lifetime before asynchronous
  store work; invalid, mismatched, or controller-busy attempts do not consume it. Once admitted, a
  store rejection, compare-and-swap conflict, generation exhaustion, or definite persistence
  failure still requires a fresh staging attempt. This bounds controller-admitted work but does not
  create a process-wide quota for T06 handles that callers never submit. M07-T09 now injects the
  reviewed staging and durable-boundary faults and proves that failed candidates cannot become
  active. M07-T10 now proves stale-candidate and concurrent race behavior: exactly one writer wins,
  every admitted loser is consumed, and only a fresh T06 lifetime may retry. M07-T08 recovers only
  durable committed authority, never an abandoned in-process candidate. A later protocol revision should standardize staged candidate
  identity and lifetime only if cross-implementation activation interoperability needs more than
  the current observable atomicity rules.

## PF-076 — Durable activation needs an explicit identity, CAS, and recovery profile

- Status: OPEN
- Blocks proof: No; M07-T07 can define one fail-closed local persistence profile without changing
  frozen protocol bytes or claiming restart recovery, exhaustive fault behavior, or host
  consumption.
- Protocol location: SPEC Sections 5.7, 6.3, 24.1, 26.6, and 28.3; Appendix A invariants 8 and 9;
  `PIPE-007`, `PIPE-016`, `PIPE-017`, `R-008`, `R-102`, `R-126`, `A-008`, and `A-009`; related
  findings `PF-031` and `PF-072`–`PF-075`; related decisions `ADR 0012`, `ADR 0013`, and `ADR 0014`
- Observation: DESEN 0.1.0 requires an atomic active-pointer switch and preservation of a
  last-known-good revision, but it does not define the persistent record schema, first generation,
  same-revision transition, compare-and-swap conflict result, commit-indeterminate outcome, or
  relationship between an in-process staged handle and restart recovery. Letting the caller choose
  `previousGoodRevision`, or treating a persisted revision as reconstructed runtime authority,
  would silently bypass those missing lifecycle decisions.
- Implementation decision: M07-T07 uses one repository-owned
  `{activeRevision, previousGoodRevision, generation}` record. The activation boundary first joins
  exact T04 and T06 authorities by shared M07-T03 object identity, consumes the staged handle
  one-shot, and recloses its complete Bundle against the same application-owned immutable store.
  Callers provide only an expected generation. The controller separately provides its complete
  authenticated current record or authenticated absence. The repository derives both revision
  fields inside one atomic transaction: the first commit is generation zero with no previous-good
  revision; a different successor preserves the current active revision as previous-good; and a
  same-revision successor advances generation while retaining the real previous-good revision. A
  stale caller generation returns the actual durable record without writing. Deletion, insertion,
  or a same-generation rewrite against the authenticated baseline requires recovery; exhausted
  generations also make no write.

  The Web implementation uses a dedicated app-internal `runtime-activation.sqlite3` adapter with
  one constrained `STRICT` row, WAL, full synchronous durability, fixed schema and busy bounds, and
  immediate transactions. Exact schema and version are reauthenticated under the writer lock
  before DML, and the committed row is checked before authority publication. SQLite is not part of
  the protocol-observable contract: future Android and iOS hosts may use a native repository that
  preserves the same atomic record and CAS rules. In-memory active authority changes only after the
  durable commit. A commit whose outcome cannot be proven exposes no active candidate and moves the
  controller to recovery-required state; recovery observed during Bundle I/O is sticky.

  M07-T08 recovery accepts only the exact T03 package authority for the durable active revision and
  the optional exact T03 authority selected by `previousGoodRevision`. It rebuilds T04 and T06
  internally, consumes every internally created T06 lifetime before asynchronous work, recloses
  both required Bundles, and requires a final exact match of all three durable fields before
  authority publication. The previous-good lineage remains private. Recovery neither writes the
  record nor increments generation or performs automatic rollback. Generation zero with a
  non-null previous-good revision is corrupt, while a null indeterminate record requires reopening
  the same root before the winner can be observed.

  The persistence contract remains platform-neutral; SQLite is only the first Web adapter. The
  local profile trusts its canonical root as application-owned. Without an independently trusted
  signature, monotonic sentinel, or equivalent cryptographic commitment, an internally consistent
  historical database or fully replaced valid-looking database and Bundle set cannot be
  distinguished from the genuine latest state. The implementation makes no tamper-proof or
  hostile-administrator claim.

- Future action: M07-T09 injects bounded faults across discovery, fetch, integrity, package,
  reference, staging, definite pre-commit, post-commit indeterminate, and recovery boundaries. The
  exact durable winner remains the only recovery authority and N-004 is `TESTED`. M07-T10 now
  proves A → invalid B → valid C, same- and different-candidate races, generation fencing, both
  recovery/activation orderings, and exact-winner restart. It requires the complete SQLite profile
  to be reauthenticated inside the writer transaction before record access or DML and fails closed
  without silently repairing `journal_mode` drift; the pinned adapter also proves that a second
  live connection cannot change an already used WAL database. M07-T11 must consume a mutable
  channel from the separately built reference host without
  treating that discovery pointer as activation evidence. A later protocol revision should
  standardize persistence and recovery only if cross-implementation lifecycle interoperability
  requires more than the observable atomicity and last-known-good invariants.

## PF-077 — A channel snapshot is activation intent, not host runtime authority

- Status: OPEN
- Blocks proof: No; M07-T11 can define one local Web host composition profile without changing
  frozen protocol bytes or claiming a universal transport and notification contract.
- Protocol location: SPEC Sections 13.2, 24.1, 28.2, and 28.3; `PIPE-009`; related findings
  `PF-074`–`PF-076`; related decision `ADR 0015`
- Observation: DESEN 0.1.0 orders channel fetch before immutable Bundle verification, package and
  reference preflight, staging, and atomic activation, but it does not define how a separately
  built host obtains channel metadata, authenticates a notification, serializes overlapping
  refreshes, or delivers a newly committed Bundle to a browser process. Treating a channel GET or
  matching `{generation, revision}` pair as active authority would skip every later boundary and
  could let an invalid or stale candidate replace the last-known-good surface.
- Implementation decision: M07-T11 uses a separately built Node reference-host server. The server
  reads one fixed channel and its exact Bundle bytes through the authenticated M07-T05 loopback
  transport, then composes the public T02, T03, T04, T06, T07, and T08 boundaries. Its installed
  package root, channel name, upstream origin, and bearer secret are host-owned configuration;
  Bundle data selects none of them. Only a certain durable activation or complete restart recovery
  can update the server's immutable delivery snapshot. The browser receives that exact Bundle
  through a fixed same-origin endpoint and independently mounts it with the static reference
  Catalog and adapter registry. Invalid, stale, malformed, oversized, failed, or late candidates
  preserve the current server delivery and browser surface.
- Future action: M10-T07 must prove the same last-known-good property through the Desen App product
  restart path before P-12 can become `PROVEN`. M12-T05 must measure the complete cross-system
  limits before N-041 can leave `PLANNED`. A later protocol revision should standardize channel
  notification and host-delivery interoperability only if independent implementations need a
  shared transport contract beyond the observable activation invariants.
