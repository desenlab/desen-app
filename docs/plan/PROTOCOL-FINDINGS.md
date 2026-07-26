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
