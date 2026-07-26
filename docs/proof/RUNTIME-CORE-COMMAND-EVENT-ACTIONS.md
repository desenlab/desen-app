# Runtime Core Command and Event Action Proof

## Result

M04-T12 is **PASS** for the framework-neutral DESEN 0.1.0 runtime slice.

The proof establishes one deterministic bridge for guarded `component.command` and outbound
`event.emit` actions. Commands can reach only an exact currently registered component instance
through a Catalog-declared, schema-validated command. Events can cross the host boundary only
through an exact allowlisted application contract whose validator accepts the detached payload.
No DOM node, component object, arbitrary method table, raw target, or platform API becomes
protocol-visible.

## What is proved

### Separate synchronous bridge boundary

- Command invocation and outbound host-event emission use a dedicated framework-neutral bridge.
  The already frozen M04-T01 nine-port aggregate is not silently widened.
- Every detached command request receives a private factory-authenticated marker bound to the
  exact normalized host-port owner immediately before the synchronous callback boundary. A trusted
  adapter can consume that marker exactly once only for that owner; replay, direct invocation, or
  reuse of the same callback in a foreign port aggregate fails. A `finally` fence removes every
  unconsumed marker before the callback returns, so authority cannot escape its invocation.
- Every bridge callback is captured from an exact own data property and invoked without a
  receiver.
- Each request first captures its exact own-data envelope, then detaches context, identity strings,
  and the runtime-bounded input or payload independently. The bridge does not charge a second
  command/event request envelope against the JSON-node budget. Event payload host-contract
  validation still occurs afterward at the dedicated validator callback.
- The boundary arithmetic is explicit: the shared M04-T02 snapshot scope consumes nine nodes, so
  an object root plus 4,086 null-valued properties reaches exactly the 4,096-node aggregate and is
  accepted; one additional property reaches 4,097 and is rejected.
- Command results, event validation results, and event emission results use closed synchronous
  envelopes. A thrown exception, Promise-like value, accessor-bearing result, or malformed
  envelope becomes a controlled redacted adapter failure.
- A host denial is a controlled failure and can never be converted into success.
- Request data contains only runtime identity, declared capability/contract identity, and detached
  JSON. Raw component targets, refs, host errors, stack traces, private payloads, and arbitrary
  callback values are never exposed.

### Static authority and live command targets

- Mount binds one exact document, revision, and surface to a factory-authenticated execution
  Catalog set, one complete static source-node-to-component-capability inventory, one outbound
  event allowlist, the token and diagnostic ports, and the command/event bridge.
- Static command authority comes only from the exact Catalog component contract. Caller-provided
  command names or implementation shape cannot add authority.
- The prepared Catalog is checked as the sole generic runtime authority for component commands.
  Reference-web adapter parity from M03-T09 remains complementary semantic evidence, not a byte
  prerequisite of this platform-neutral runtime proof. This proof does not claim that every
  production adapter command is already implemented.
- A live registration carries only the exact source node identifier, its statically fixed
  component capability identifier, and one inert runtime-instance identifier.
- A runtime-instance identifier must be length-bounded and canonical-JSON-string admissible before
  retention or publication; malformed Unicode such as an unpaired surrogate is rejected
  atomically.
- Registration exposes no component object, DOM node, ref, callable, command method, or arbitrary
  target data. The bridge stores only inert identifiers and private callback authority.
- One factory-issued opaque ticket plus a monotonically advancing generation owns unregister
  authority. A forged, foreign, stale, reused, or structurally ABA-equivalent ticket cannot remove
  a current registration.
- The bridge may retain multiple bounded registrations for one static source node, but
  `component.command` dispatches only while exactly one instance is live. Zero or multiple live
  instances are controlled target-unavailable outcomes; the runtime never guesses the first or
  last registration.
- A callback-free registry read returns the exact current immutable snapshot by reference without
  invoking host, token, diagnostic, command, or event code and without advancing any generation.
  Forged handles fail closed and disposed managers remain terminal. This read boundary lets the
  later action-turn coordinator observe a registration transition before the first following
  command rather than intentionally sacrificing one turn to stale-snapshot discovery.
- A separate package-internal adapter-bridge read returns that same exact snapshot together with
  the manager's exact validated Catalog set and captured command/event port authority by
  reference. It cannot substitute, clone, or independently select Catalog or port authority, and
  it is deliberately absent from the package-root API.
- Removing the exact second-generation ticket restores the unique first target. Repeated-instance
  selector semantics remain explicit M04-T14/M04-T16 work.

### Guard-first observation and one token session

- Every action evaluates `when` before observing the action discriminator or any command/event
  payload member.
- A false guard performs no target lookup, payload read, token lookup, command/event callback, or
  diagnostic callback report.
- A true command guard and its named command input share one bounded detached action-local token
  session. A true event guard and its payload use the same rule.
- Each repeated token name is observed at most once across that action's guard and payload.
  Aggregate token retention remains bounded and fails closed.
- Exact authority and generation are rechecked after every hostile reflection, token callback,
  diagnostic callback, validation callback, and immediately before each effect.

### Declared command authorization before input

- `component.command` first captures and authorizes the exact static target, exact Catalog
  capability, declared command name, and current live registration.
- An unknown static target, absent live target, capability mismatch, or undeclared command is
  rejected before command input observation or token materialization.
- The runtime performs an inert empty-object selector probe against the exact
  `component-command-input` Catalog selector. This distinguishes `UNKNOWN_COMMAND` from a declared
  command whose schema legitimately requires a non-empty input.
- Only after command authority is proved are named input ValueSpecs materialized in canonical key
  order through one synthetic array and rebuilt as detached frozen JSON.
- The complete resolved input must pass the exact Catalog command input schema before the command
  callback is invoked. Invalid input uses `COMMAND_INPUT_INVALID`; it cannot cross the effect
  boundary.
- A successful command request contains only the capability identifier, command name,
  runtime-instance identifier, deterministic request context, and validated input.

### Allowlisted outbound events

- `event.emit` selects an exact allowlisted name and its opaque application contract identifier
  before observing the optional payload.
- An unknown event name observes no payload, invokes neither validation nor emission, and cannot
  be redirected to another contract.
- Omitted payload becomes one detached empty object. A present payload is materialized and detached
  through the same action-local session as a true guard.
- Validation and emission are separate host-policy stages. The exact selected contract validates
  the detached payload before the emitter can run.
- Rejected or malformed validation prevents emission. A successful validation cannot bypass a
  later current host emission denial.
- Catalog-declared component/behavior events travel from adapter to runtime and are not reused as
  outbound shell-event contracts.

### TOCTOU, finite bounds, and disposal

- Target liveness, target generation, manager authority, event contract selection, and request
  identity are checked around every potentially reentrant callback.
- Register and unregister acquire the transition lock before observing hostile request proxies.
  Every finite snapshot/generation preflight completes before a ticket, registry entry, or counter
  can change, so a rejected or nested transition leaves no partial state.
- Reentry from reflection, token resolution, command invocation, event validation, event emission,
  or diagnostics sees a closed transition and cannot duplicate an effect.
- Every command invocation, event validation, and event emission callback is followed by a current
  authority/snapshot recheck. Callback-driven disposal or registry drift wins over the callback's
  returned envelope, including a nominal success.
- Action identity, target registration generation, live targets, event allowlist entries, retained
  identifiers, token results, and bridge requests remain under finite ceilings. Trusted profiles
  may lower but cannot raise those ceilings.
- Snapshot capacity is reserved conservatively: a registration is accepted only when the current
  snapshot transition and one later exact-ticket unregister transition both fit. A lowered ceiling
  therefore cannot strand an accepted live registration.
- Pre-delegation action rejections consume no accepted request generation, and rejected
  registrations consume no ticket or registration generation. A host validation call is itself an
  accepted bounded request even when its selected contract rejects the payload. No rejection path
  creates a partial target, contract, snapshot, or retained payload.
- Disposal is terminal and idempotent. Live registrations and private target authority are
  replaced by minimal tombstones; late callbacks cannot revive the manager or inspect a stale raw
  target.

## Evidence boundary

The deterministic artifact is
`docs/proof/artifacts/runtime-core-0.1.0-command-event-actions.json`.

Generation refuses to proceed unless all reviewed prerequisites match their exact bytes:

- M04-T10 state/navigation actions:
  `f9eddfdf915ace33d77df6491de39ad84e9d60d56e2269433c223a79696ad140`
- M02-T11 execution contracts:
  `f7dc050b8a9e4e5d9ec2531312ca3ad68d0d03c46bda5c44ebf930884554f505`
- M02-T09 interaction contracts:
  `981e1d59dd68e32639055b1267880cc1e6ebb3a76ad1176298990b28fe048208`

The final byte-owned set is derived from the exact implementation layout after both source modules
and their focused/type tests exist. Shared package manifests and indexes, traceability, normative
coverage, findings, the reference Catalog, and this explanatory document are verified
semantically but are not claimed as task-owned bytes.

The evidence builder also checks:

- exact source, declaration, distribution, and package-index exports;
- TSDoc on every exported declaration and package-internal non-leakage of raw target authority or
  the trusted adapter-bridge Catalog seam;
- exact source imports and focused package-test wiring;
- synthetic prepared-Catalog command authority plus semantic compatibility with the independently
  tracked M03-T09 reference-web adapter parity;
- byte-identical artifact generation and atomic artifact replacement;
- hostile live probes for guard-first non-observation, shared token sessions,
  authorization-before-materialization, exact command selector/schema validation, outbound event
  allowlisting and validation-before-emission, receiver independence, owner-bound one-shot
  normalized command request authority and synchronous lifetime cleanup, target ticket
  generations, ABA/foreign/stale behavior, exact current callback-free registry reads, exact
  Catalog, command/event-port, and snapshot identity at the package-internal adapter seam, exact
  4,096-versus-4,097 standalone JSON boundaries without a second request-envelope tax, TOCTOU and
  reentry, denial, adapter redaction, finite bounds, disposal, and late callback containment;
- hostile source/runtime mutations of the same semantics, task-owned byte drift, prerequisite
  drift, and artifact tampering; and
- absence of browser, Node-host, native-host, framework, clock, randomness, dynamic evaluation, or
  A2UI dependencies.

## Trace and normative ownership

M04-T12 directly verifies exactly:

- `R-080` — component commands address a declared command on one current live target and validate
  its complete input;
- `R-106` — host denial is controlled failure, never fabricated success;
- `R-120` — commands and outbound events remain declared, schema-bound least-authority channels;
- `R-122` — a valid command or event action never bypasses current host policy;
- `D-015` — `UNKNOWN_COMMAND` for an undeclared command;
- `D-016` — `COMMAND_INPUT_INVALID` for a resolved input that fails its exact command schema; and
- `N-031` — the host allowlists outbound event names and validates payloads before emission.

`N-031` becomes **TESTED** only for this outbound shell-event action boundary. `N-034` remains
**PLANNED** because complete production-adapter implementation of every declared command still
requires M05 and later adapter parity evidence.

PF-042 remains **OPEN** because DESEN 0.1.0 does not normatively define command-target instance
identity, opaque registration authority, repeated-target addressing, outbound application contract
discovery, validation-versus-emission separation, controlled bridge result envelopes, finite
registry limits, or complete cross-manager provenance. The proof preserves the related OPEN
boundaries in PF-015, PF-017, PF-031, PF-040, and PF-041.

## Deliberate non-claims

This proof does not establish:

- ordered multi-action execution, the 64-action turn ceiling, settlement depth, or the complete
  runner owned by M04-T13;
- generic incoming component/behavior event bridges, adapter command registration parity,
  repeated-instance target disambiguation, or event-payload provenance owned by M04-T14;
- reactive target/subtree lifecycle and stale asynchronous-result protection owned by M04-T15;
- full seven-namespace same-turn provenance, complete coordinated disposal, sign-in execution, or
  observable deterministic trace owned by M04-T16;
- complete production-adapter implementation of every Catalog command (`N-034`);
- event analytics, telemetry, persistence, retry, timeout, offline, external URL, or cross-Bundle
  policy;
- DOM, React, browser, iOS, Android, SwiftUI, Compose, focus, animation, or accessibility adapter
  behavior; or
- normative closure of PF-015, PF-017, PF-031, PF-040, PF-041, or PF-042 in a future protocol
  release.

Those boundaries keep a safe outbound bridge from being presented as a complete adapter or
cross-platform application runtime.
