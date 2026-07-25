# Runtime Core Resource Lifecycle Proof

## Result

M04-T08 is **PASS** for the framework-neutral DESEN 0.1.0 runtime slice.

The proof establishes one deterministic surface-local lifetime for declared resources: atomic
mount, policy-aware initial start, input and output schema boundaries, explicit refresh,
supersession, technical-failure containment, and terminal disposal. It does not claim that a web,
React, iOS, Android, SwiftUI, or Compose adapter already renders resource-backed UI.

## What is proved

### Atomic mount and Catalog authority

- One surface resource map mounts atomically as a recursively frozen generation-zero lifecycle
  snapshot.
- Every instance begins as `{ status: "idle", pending: false }`.
- Instance identifiers are published in canonical lexical order.
- Mount never calls the resource host.
- One malformed declaration, unknown capability, unsupported policy, forged Catalog set, unsafe
  caller object, or unbounded retained snapshot rejects the whole mount without a partial handle.
- Policies and public error codes come only from the exact factory-authenticated M02-T11 execution
  Catalog set. Callers cannot add either contract by shape.
- A trusted host profile may lower the finite attempt-generation, snapshot-generation, and active
  transport ceilings, but cannot raise them or install accessors.
- Declarations and host callbacks are captured across an inert detached boundary rather than
  retained as mutable caller authority.

### Initial start and input preparation

- `mount` and `once` start automatically; `manual` stays idle until an explicit refresh.
- Start requires both the exact current resource snapshot object issued by that manager and a
  factory-created resolution snapshot whose `resource` namespace has the same lifecycle data.
  Foreign, stale, and structurally ABA-equal resource snapshot objects fail closed.
- Parameter names are sorted, their ValueSpecs are materialized as one synthetic array through
  M04-T03, and the resolved values are reconstructed under their original names. This gives the
  complete input one atomic failure boundary and one single input-wide token cache while keeping a
  protocol-legal dollar-prefixed parameter as ordinary data.
- The candidate request identifier is visible to token lookup, but is consumed only after the
  complete input materializes and schema-validates. A rejected candidate can therefore retry with
  the same deterministic generation.
- Unresolved, deferred, malformed, or schema-invalid input never allocates a request identifier and
  never calls the host.
- Accepted requests are allocated and published as one pending batch before any host callback,
  diagnostic callback, or synchronous settlement can reenter the lifetime.
- Host calls occur in canonical instance-id order. Reentrant disposal prevents later queued calls
  from crossing the revoked boundary.
- Token-provider and diagnostic reentry observe a closed transition (`busy` or already started),
  and disposal stops later token-provider or diagnostic callbacks in the same transition.
- Resource, token, and diagnostic host callbacks are invoked without a receiver.
- A synchronous host return still settles in a later Promise microtask, leaving `pending`
  observably true for the start caller.

### Settlement containment

- A successful value is validated against the exact resource output schema, detached, bounded,
  frozen, and only then exposed through the lifecycle root.
- Aggregate retained lifecycle data is bounded even when each individual output is schema-valid.
- A declared failure exposes only its exact public error code.
- Host denial becomes `run.desen.runtime/RESOURCE_DENIED`.
- Invalid output becomes `RESOURCE_OUTPUT_INVALID`.
- Output-schema diagnostics are replaced by one frozen, root-pointing public diagnostic, so
  attacker-controlled output member names and values cannot escape through validator detail.
- Malformed envelopes, undeclared error codes, thrown exceptions, and rejected promises become
  `ADAPTER_FAILURE`.
- Technical failures return the instance to idle and cannot publish raw exceptions, private server
  data, or partial output.
- A throwing diagnostic sink is observational only and cannot change lifecycle semantics.
- Every accepted settlement promise fulfills with controlled inert data; it does not reject.

### Refresh, supersession, identity, and disposal

- Any declared policy can be refreshed explicitly.
- Refresh requires the exact current lifecycle snapshot and a known instance.
- Input resolution and schema validation finish before a live attempt can be superseded.
- An accepted refresh publishes a fresh pending generation, resolves the previous attempt as
  `superseded`, and treats every later result from that attempt as stale.
- Stale and disposed results are rejected before their hostile settlement envelope is inspected.
- Accepted request identifiers are deterministic per instance:
  `resource:` followed by RFC 8785 canonical JSON of `[instanceId, attemptGeneration]`.
- Rejected input consumes no attempt generation.
- A pending request is accepted only if a later terminal snapshot generation is already reserved.
  The inclusive attempt and snapshot ceilings therefore fail before an unfinishable request can
  cross the host boundary.
- At most 64 host resource transports are active by default. Later accepted attempts wait in
  canonical order; when the same instance is refreshed again before its queued transport launches,
  the newer accepted attempt replaces the older queued attempt.
- Disposal is terminal and idempotent. It fulfills every pending attempt as `disposed`, revokes
  reads and refreshes, clears retained records and the queue, replaces the handle authority with a
  small sentinel, and ignores all later host results without claiming transport cancellation or
  secure erasure.
- This primitive invents no retry, timeout, cache, clock, random, network, framework, or platform
  policy.

### Snapshot provenance boundary

M04-T08 proves only the resource manager authority it owns: exact current manager resource
snapshot identity plus a supplied factory snapshot whose resource namespace matches it. The
trusted compositor must supply state, context, operation, event, item, and environment namespaces
from the same current turn. M04-T16 owns proof of that full-turn provenance and complete composed
session; this task deliberately does not claim cross-manager provenance for those namespaces.

## Evidence boundary

The deterministic artifact is
`docs/proof/artifacts/runtime-core-0.1.0-resource-lifecycle.json`.

Generation refuses to proceed unless all three reviewed prerequisites match their exact bytes:

- M04-T03 token and format materialization:
  `be2d07ae32537ef5c2aec04c783f2cfb30cbcc500a85020172e2b8715a98800f`

- M04-T07 repeat materialization:
  `45ba72f21f936931d087982d8a52e6b4d226a33ed5693c2d3d6bf9158fddb02d`
- M02-T11 execution contracts:
  `f7dc050b8a9e4e5d9ec2531312ca3ad68d0d03c46bda5c44ebf930884554f505`

The byte-owned evidence set contains only the resource-lifecycle source, focused tests,
compiler-negative tests, four resource-lifecycle distribution outputs, three task proof scripts,
and the root mutation suite. Shared package manifests, source and distribution indexes,
traceability ledgers, findings, status files, and this explanatory document are verified
semantically but are deliberately not byte-owned by M04-T08.

The evidence builder derives the 52 focused cases from test syntax, including every `it.each` row,
and derives nine compiler-negative cases from described `@ts-expect-error` directives. It also
checks:

- six runtime and twenty-two type exports in source, declarations, distribution, and package
  indexes;
- TSDoc on all twenty-eight public declarations;
- exact source import and package test boundaries;
- framework, browser, Node-host, native-host, clock, randomness, and dynamic-evaluation absence;
- byte-identical artifact generation and atomic artifact replacement;
- hostile mutations of mount atomicity, exact manager snapshot/ABA identity, M04-T03 token-format
  cache and candidate identity, policy ordering, pending publication, terminal reservation,
  lowered finite limits, active transport queueing, queued replacement, input validation, output
  containment and diagnostic redaction, receiver independence, public-error redaction, denial,
  supersession, stale-envelope inspection, disposal sentinel cleanup, exports, TSDoc, portability,
  and test inventory.

## Trace ownership

M04-T08 directly verifies its exact ownership in:

- `PIPE-019` — initialize resource lifecycles;
- `PIPE-024` — start `mount` and `once` resources;
- `R-042` — lifecycle references expose only declared fields and schema-permitted output;
- `R-055` — `manual`, `mount`, and `once` have fixed Catalog-supported behavior;
- `R-079` — refresh reloads one declared instance from current resolved input;
- `R-090` — resources remain read-oriented; domain mutation belongs to operations;
- `R-114` — failures expose only declared public error codes;
- `R-122` — every resource request remains subject to current host policy;
- `D-027` — `RESOURCE_INPUT_INVALID`; and
- `D-028` — `RESOURCE_OUTPUT_INVALID`.

PF-038 remains **OPEN** because the frozen protocol does not normatively define every runtime
ordering, supersession, technical-failure, retained-data, and stale-settlement edge chosen by this
deterministic implementation profile.

## Deliberate non-claims

This proof does not yet establish:

- operation invocation lifetime and public failure behavior;
- action dispatch integration with `resource.refresh`;
- reactive dependency discovery or automatic resource refresh;
- conditional or repeated subtree teardown;
- adapter rendering, layout, focus, animation, accessibility, or native lifecycle behavior;
- transport cancellation, retry, timeout, cache, persistence, or offline policy;
- secure erasure of already retained caller or transport data;
- same-turn provenance of state, context, operation, event, item, and environment before M04-T16;
- the complete observable sign-in flow;
- a normative resolution of PF-038 in a future protocol release.

Those boundaries keep a headless resource primitive from being presented as a completed
cross-platform application runtime.
