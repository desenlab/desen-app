# Runtime Core Operation and Resource Action Proof

## Result

M04-T11 is **PASS** for the framework-neutral DESEN 0.1.0 runtime slice.

The proof composes the already proved M04-T08 resource, M04-T09 operation, and M04-T10 guarded
action boundaries. It establishes guarded `operation.invoke` acceptance, deterministic settlement
branch selection behind an opaque acknowledgement ticket, and guarded `resource.refresh`
delegation. It does not claim the bounded multi-action runner owned by M04-T13 or any web, React,
iOS, Android, SwiftUI, or Compose adapter.

## What is proved

### Guard-first closed actions

- One call accepts exactly one closed `operation.invoke` or `resource.refresh` action. No other
  discriminator is guessed or delegated.
- The action's `when` member is captured and evaluated before observing any payload member.
- A false guard skips without reading `type`, `operation`, `as`, `input`, `concurrency`,
  `onSuccess`, `onFailure`, `resource`, or `extensions`. It performs no payload-token lookup,
  operation invocation, resource refresh, or diagnostic callback report.
- Guard observation remains fail-closed. Disposing or changing an owned manager snapshot from a
  guard token callback cannot be returned as an ordinary skip.
- A true operation guard and its named `input` ValueSpecs share one detached action-local
  M04-T10 evaluation session. Each token is observed at most once across both phases.
- `resource.refresh` does not re-materialize the resource declaration's input in this layer. M04-T08
  owns that separate resource-scoped materialization, token cache, schema boundary, and request
  identity after the guarded action has been accepted.
- Host token and diagnostic callbacks are invoked without a receiver. No platform global, clock,
  randomness, dynamic evaluation, framework, or native API is introduced.

### Operation acceptance and settlement ownership

- The closed operation action requires exact own data for `operation`, `as`, and `input`;
  `concurrency`, `onSuccess`, `onFailure`, `when`, and `extensions` are the only optional members.
- The alias and capability assertion are passed to M04-T09 exactly as authored. The action layer
  cannot create or redirect a mounted alias.
- Named operation input is materialized in canonical key order as one synthetic array, rebuilt as
  detached frozen JSON, and then passed to M04-T09's exact Catalog input-schema boundary.
- Omitted concurrency remains M04-T09's normative-schema default of `reject`.
- Both optional settlement-handler arrays are captured, detached, recursively frozen, and bounded
  before an invocation is accepted. Later mutation of the caller's action cannot change settlement
  selection.
- The finite settlement slot and private completion authority are reserved before delegating to
  M04-T09. A synchronous operation host callback that disposes or otherwise reenters M04-T11
  therefore cannot strand an accepted terminal lease or erase its controlled settlement wrapper.
- Started, queued, and staged invocation outcomes return synchronously with their settlement
  promise. The action layer never waits for transport completion inside the originating turn.
- A terminal settlement maps deterministically:
  - `succeeded` selects the captured `onSuccess` array;
  - declared `failed`, `denied`, `invalid-output`, and `adapter-failed` select the captured
    `onFailure` array; and
  - `superseded` and `disposed` select no settlement turn.
- The M04-T09 lifecycle snapshot is already terminal before a handler selection is exposed.
  Handler success or failure cannot retroactively rewrite that operation result.
- The raw M04-T09 acknowledgement lease is never exposed by the public M04-T11 result. A terminal
  handler selection carries only an opaque manager-bound, one-shot ticket backed by private
  authority.
- A future action runner must finalize that ticket from a `finally` path after the selected handler
  turn succeeds, fails, reaches a limit, or terminates by navigation. An absent or empty handler
  still crosses the same explicit safe finalization point.
- M04-T11 does not auto-acknowledge terminal settlements. Queued or staged host work therefore
  cannot cross the settlement-handler boundary before the later M04-T13 runner finalizes the
  ticket.
- Superseded and operation-manager-disposed settlements create neither a handler selection nor
  acknowledgement authority. Foreign, forged, reused, stale, or disposed tickets cannot release a
  gate.
- Pending-handler capacity is released only by explicit safe finalization or by a settlement that
  owns no lease. Merely mapping a terminal result cannot free a still-live ticket and cannot bypass
  the finite retained-authority ceiling.
- Retention is bounded cumulatively across the live compositor, not only per action: at most 64
  pending settlements, 4,096 detached settlement actions, and 1,048,576 canonical handler code
  units by default. A trusted profile may lower but cannot raise these ceilings.
- A second individually valid handler is rejected before token materialization or delegation when
  its addition would overflow either the aggregate retained-action count or aggregate handler
  code-unit budget. No handler is truncated or partially retained.

### Resource refresh integration

- The closed refresh action requires one exact own-data `resource` identifier. No handler arrays
  or operation members are accepted.
- The action delegates the exact current M04-T08 resource snapshot and the supplied
  factory-authenticated resolution snapshot to `refreshRuntimeSurfaceResource`.
- An unknown resource remains the controlled M04-T08 unknown-instance result and never triggers
  input materialization or a host call.
- Accepted refresh returns its pending snapshot and settlement promise without awaiting the
  transport.
- M04-T08 remains the sole owner of current declared-input resolution, complete input-schema
  validation, accepted request identity, supersession, output containment, and stale settlement
  rejection.

### Snapshot, callback, and disposal containment

- The mounted action compositor exclusively claims exact M04-T08 and M04-T09 manager handles and
  captures their snapshots, plus the M04-T10 token and diagnostic ports needed for guard and
  operation-input evaluation.
- Every payload observation, token callback, diagnostic callback, and delegated manager call is
  followed by authority and exact-snapshot checks before the next effect.
- Once M04-T09 or M04-T08 accepts an effect, that controlled accepted result takes precedence over
  callback-driven compositor drift. When a delegated call performs no effect, a diagnostic callback
  that disposes or changes an owned snapshot is rechecked and reported as disposed or
  invalid-snapshot rather than returning a stale rejection.
- For each claimed primitive handle, stale, foreign, forged, structurally ABA-equal, or
  asynchronously changed snapshots fail closed.
- M04-T11 proves exact handle-to-snapshot identity and equality of the supplied resource and
  operation namespaces. It does not invent a hidden joint-origin nonce capable of distinguishing
  two independently mounted but otherwise compatible T08/T09 manager pairs; complete cross-manager
  provenance remains M04-T16/PF-041 work.
- A malformed handler, accessor-bearing payload, unsafe token result, aggregate retention
  overflow, thrown diagnostic sink, or reentrant call produces controlled inert data. Raw host
  exceptions, stack traces, secret response values, and private acknowledgement leases are never
  exposed.
- Mount exclusively claims the supplied M04-T08 resource and M04-T09 operation handles against a
  second live M04-T11 compositor. The trusted compositor profile must surrender direct use of those
  still-public primitive handles; M04-T11 cannot make the separately exported T08/T09 APIs
  inaccessible to a caller that violates that profile contract.
- Disposal is terminal and idempotent for the M04-T11 compositor. It terminally disposes both
  exclusively owned managers, invalidates private tickets, and therefore cannot strand a live
  M04-T09 settlement gate after ticket authority is revoked.

## Evidence boundary

The deterministic artifact is
`docs/proof/artifacts/runtime-core-0.1.0-operation-resource-actions.json`.

Generation refuses to proceed unless all four reviewed prerequisites match their exact bytes:

- M04-T08 resource lifecycle:
  `2d6ab2e5b6a480e922425faa109e13cc5d388a5de00b2604cbfec62345b01c82`
- M04-T09 operation lifecycle:
  `7b2300a78bb9903abe1f182792362d374edb5b948ee9f8f69dc018ccf9cc8301`
- M04-T10 state/navigation actions:
  `9ad1492a5eb9cc4916b5cadf02d2f45d009df261f9bdcd49b997d2af88dbdf67`
- M02-T11 execution contracts:
  `f7dc050b8a9e4e5d9ec2531312ca3ad68d0d03c46bda5c44ebf930884554f505`

The byte-owned evidence set contains only the operation/resource action source, focused tests,
compiler-negative tests, four distribution outputs, three task proof scripts, and the root
mutation suite. The shared action-evaluation seam is semantically inherited through the exact
M04-T10 prerequisite rather than re-owned. Shared package manifests and indexes, traceability,
findings, and this explanatory document are verified semantically but are not byte-owned by
M04-T11.

The evidence builder derives focused cases from test syntax, including every static `it.each` row,
and derives compiler-negative cases from described `@ts-expect-error` directives. It also checks:

- exact source, declaration, distribution, and package-index exports;
- TSDoc on every public declaration and package-internal non-leakage of ticket finalization;
- exact source imports and focused package-test wiring;
- framework, browser, Node-host, native-host, clock, randomness, and dynamic-evaluation absence;
- byte-identical artifact generation and atomic artifact replacement;
- live hostile probes for guard-first non-observation, one shared operation token session,
  handler detachment, nonblocking invocation and refresh, exact settlement mapping, lease hiding,
  explicit safe finalization, queue gating, snapshot drift, receiver independence, raw-host
  redaction, disposal, and late settlement containment; and
- root hostile mutations of payload reads, false-guard effects, raw-host leakage, source ordering,
  task-owned bytes, artifact tampering, exports, portability, and test inventory.

## Trace ownership

M04-T11 directly verifies exactly:

- `R-078` — operation lifecycle settlement selects a deterministic captured branch while the
  acknowledgement gate remains closed for the later bounded action turn; and
- `R-079` — `resource.refresh` delegates one declared current instance to M04-T08 using its current
  resolved input.

No guard, state, navigation, command, event, behavior, reactive, or complete-session trace rule is
reassigned to M04-T11.

PF-041 remains **OPEN** because DESEN 0.1.0 does not normatively define handler capture timing,
technical-failure branch selection, token-cache scope, exact multi-manager provenance, handler
retention limits, disposal and late-settlement interaction, private acknowledgement authority, or
the precise safe point that releases queued operation work. The proof preserves the related OPEN
boundaries in PF-014, PF-020, PF-022, PF-031, PF-039, and PF-040.

## Deliberate non-claims

This proof does not establish:

- ordered execution of settlement arrays, the 64-action turn ceiling, the nested settlement-depth
  ceiling, the complete runner, or its mandatory `finally` behavior, all owned by M04-T13;
- `component.command` or allowlisted `event.emit`, owned by M04-T12;
- generic component/behavior event bridges or event-payload provenance, owned by M04-T14;
- reactive dependency discovery, reevaluation, or stale asynchronous-result protection, owned by
  M04-T15;
- full seven-namespace same-turn provenance, complete composed disposal, the headless sign-in
  session, or its observable deterministic trace, owned by M04-T16;
- physical transport cancellation, retry, timeout, cache, persistence, or offline policy;
- adapter rendering, layout, focus, animation, accessibility, history, deep links, or native
  lifecycle behavior; or
- normative closure of PF-014, PF-020, PF-022, PF-031, PF-039, PF-040, or PF-041 in a future
  protocol release.

Those boundaries keep deterministic action composition from being presented as a completed
multi-action or cross-platform application runtime.
