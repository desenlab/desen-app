# Runtime Core Operation Lifecycle Proof

## Result

M04-T09 is **PASS** for the framework-neutral DESEN 0.1.0 runtime slice.

The proof establishes one bounded surface-local operation lifetime: atomic alias publication,
resolved inert input validation, deterministic invocation identity, exact `reject`, `replace`, and
`queue` behavior, contained terminal settlement, and an explicit acknowledgement seam before
queued work can advance. It does not claim that a web, React, iOS, Android, SwiftUI, or Compose
adapter already dispatches actions or renders operation-backed UI.

## What is proved

### Atomic mount and alias authority

- The complete alias inventory mounts atomically as a recursively frozen generation-zero
  lifecycle snapshot.
- Every predeclared alias begins as `{ status: "idle", pending: false }`; mount never calls the
  host.
- Alias identifiers publish in canonical lexical order and remain scoped to one mounted surface.
- One malformed alias, unknown capability, forged Catalog set, unsafe caller object, or
  over-budget lifecycle map rejects the entire mount without exposing a partial handle.
- Each alias is fixed to one exact capability for its lifetime. Invocation cannot create an alias
  or change its capability.
- Every invocation carries a required operation capability assertion. It must exactly match the
  mounted alias, but it never selects or replaces that mounted authority. A mismatch reports
  `run.desen.runtime/OPERATION_CAPABILITY_MISMATCH` without applying the Catalog input schema,
  allocating identity, changing lifecycle, or calling the operation host. The closed request
  envelope is still detached through the shared bounded JSON safety boundary first.
- A live JavaScript request that omits this required assertion is malformed and likewise consumes
  no identity, lifecycle generation, or host authority.
- Input/output schemas, public error codes, and the descriptive effect class come only from the
  exact factory-authenticated M02-T11 execution Catalog set.

### Resolved input and deterministic acceptance

- M04-T09 accepts a fully resolved inert input object. It detaches the object and applies the exact
  Catalog `operation-input` schema before allocating identity, publishing pending, or calling the
  host.
- Invalid input cannot call the host and consumes no attempt generation.
- ValueSpec, token, and format materialization are deliberate non-claims here. M04-T11 owns that
  action composition boundary before this primitive is called.
- Each accepted started or queued invocation receives `operation:` plus RFC 8785 canonical JSON of
  `[alias, zeroBasedAttemptGeneration]`.
- Caller input mutation after invocation cannot affect the frozen host request.
- The request carries the mounted document, revision, surface, deterministic request ID, fixed
  alias/capability, resolved input, and exact Catalog effect.
- The operation and diagnostic callbacks are invoked without a receiver.
- Pending is published before the operation callback. Even a synchronous host value reaches
  terminal settlement only in a later Promise microtask.
- Invocation requires the exact current snapshot object issued by that manager. Stale, foreign,
  and structurally ABA-equal copies fail closed.

### Exact concurrency

- An omitted concurrency member defaults to `reject`.
- `reject` refuses a request while the alias is pending and consumes neither identity nor host
  authority.
- `replace` first detaches and validates the replacement input. Only a valid replacement
  supersedes the active attempt and every accepted queued attempt for that alias.
- Superseded attempts settle as `superseded`, receive no acknowledgement lease, and cannot inspect
  a later hostile transport envelope.
- `queue` accepts invocations in FIFO order and assigns identity immediately.
- The queue is surface-global and finite; its default maximum is 64 accepted queued invocations,
  not 64 per alias.
- At most 64 underlying host transports are active by default. A trusted host profile may lower
  the finite attempt, snapshot, aggregate queue, and transport ceilings but cannot raise them.
- Every accepted invocation reserves all future pending and terminal snapshot transitions before
  acceptance. Exhaustion returns a controlled limit result; no value or queue is silently
  truncated.

### Settlement containment

- A successful host output is detached, checked against the exact Catalog `operation-output`
  schema, recursively frozen, and only then exposed through the alias lifecycle.
- A failed host envelope becomes public `failed` only for an exact Catalog-declared error code.
- Host denial reports `OPERATION_DENIED` and never fabricates success.
- Invalid output reports `OPERATION_OUTPUT_INVALID`; invalid resolved input reports
  `OPERATION_INPUT_INVALID`.
- An undeclared error, malformed envelope, thrown or rejected adapter, or hostile accessor becomes
  a redacted `ADAPTER_FAILURE`.
- Technical failures return the public lifecycle to `idle`; they never invent a Catalog-declared
  public error.
- Attacker-controlled output member names and raw adapter errors do not enter public diagnostics.
- If an otherwise valid declared failure or successful output would overflow the aggregate
  retained lifecycle map, it is contained as `invalid-output` with
  `run.desen.runtime/OPERATION_RETAINED_LIMIT_EXCEEDED`. Its terminal reservation is released, so
  acknowledgement permits a later deterministic attempt.
- Stale, superseded, or disposed authority is checked before the transport envelope is inspected.

### Settlement acknowledgement and action-turn boundary

- Every succeeded, declared-failed, denied, invalid-output, or adapter-failed terminal settlement
  publishes its terminal lifecycle before returning an opaque, manager-bound, one-shot
  acknowledgement lease.
- A valid same-alias invocation made by a settlement handler is accepted as `staged` and publishes
  its pending snapshot synchronously. Its host call remains gated by the predecessor lease, so the
  handler can observe the new pending lifecycle without reentering transport execution.
- When a settlement handler appends queue work behind an existing FIFO backlog, the existing FIFO
  head may likewise become the staged pending invocation. The newly appended request remains at
  the back; accepted order is preserved.
- No staged or queued host invocation is sent to the host until the predecessor lease is
  acknowledged.
- M04-T11 owns settlement-handler selection and calls acknowledgement only after that handler's
  new action turn completes.
- M04-T13 owns the bounded action-program turn, safe-point reentrancy, and failure handling around
  this seam.
- A lease from another manager or a shaped object has no authority. Reusing an acknowledged lease
  is controlled.
- Superseded and disposed attempts have no settlement-action lease.
- Disposal is terminal and idempotent: it resolves unfinished work as disposed, invalidates
  outstanding leases, clears retained aliases and queues, and rejects every late result.
- Physical transport cancellation and secure erasure are not claimed.

## Evidence boundary

The deterministic artifact is
`docs/proof/artifacts/runtime-core-0.1.0-operation-lifecycle.json`.

Generation refuses to proceed unless both reviewed prerequisites match their exact bytes:

- M04-T02 value resolution:
  `73e4c3d7640eaefd0b45b04b006df3211f0338fafa77293414d43c1052536fea`
- M02-T11 execution contracts:
  `f7dc050b8a9e4e5d9ec2531312ca3ad68d0d03c46bda5c44ebf930884554f505`

The byte-owned evidence set contains only the operation-lifecycle source, focused tests,
compiler-negative tests, four operation-lifecycle distribution outputs, three task proof scripts,
and the root mutation suite. Shared package manifests, source and distribution indexes,
traceability ledgers, findings, status files, and this explanatory document are verified
semantically but deliberately are not byte-owned by M04-T09.

The evidence builder derives focused cases from test syntax, including every `it.each` row, and
derives compiler-negative cases from described `@ts-expect-error` directives. It also checks:

- exact runtime and type exports in source, declarations, distribution, and package indexes;
- TSDoc on every public declaration;
- the exact source import and package test boundaries;
- framework, browser, Node-host, native-host, clock, randomness, and dynamic-evaluation absence;
- byte-identical artifact generation and atomic artifact replacement;
- live hostile probes for alias atomicity, Catalog authority, exact snapshot identity, accepted-only
  IDs, resolved-input and output validation, effect propagation, default reject, replacement,
  FIFO queueing, acknowledgement-gated promotion, cross-manager lease isolation, aggregate queue
  and transport bounds, snapshot reservations, live missing-assertion rejection, aggregate
  retained-output containment and reservation release, declared errors, denial, adapter
  containment, receiver independence, transition reentry, stale envelopes, and disposal; and
- root hostile mutations of the implementation, public exports, portability, and test inventory.

## Trace ownership

M04-T09 directly verifies its exact ownership in:

- `SN-005` — omitted operation concurrency uses its schema default without validator mutation;
- `R-043` — each alias owns one surface-scoped public lifecycle;
- `R-062` — asynchronous settlement does not block or reenter the originating action turn;
- `R-077` — resolved input validates before invocation and output validates before exposure;
- `R-078` — lifecycle, reject/replace/queue, public errors, and settlement turns are deterministic;
- `R-089` — operation contracts declare schemas, errors, and effect while host policy remains
  authoritative;
- `R-106` — denial is controlled failure, never fabricated success;
- `R-114` — only exact declared public errors enter a failed lifecycle;
- `R-115` — adapter crashes cannot become success;
- `R-122` — every operation remains subject to current host policy;
- `A-006` — external mutation uses named operations rather than writable references;
- `D-024` — `OPERATION_INPUT_INVALID`;
- `D-025` — `OPERATION_OUTPUT_INVALID`; and
- `D-026` — `OPERATION_DENIED`.

PF-039 remains **OPEN** because DESEN 0.1.0 does not normatively define the complete manager API,
request identity, finite limits, replacement-versus-queue interaction, acknowledgement seam, or
technical-failure lifecycle selected by this implementation profile. The proof also preserves the
related OPEN boundaries in PF-020, PF-022, and PF-031.

## Deliberate non-claims

This proof does not yet establish:

- ValueSpec, token, and format materialization for `operation.invoke`;
- settlement `onSuccess` or `onFailure` handler dispatch;
- the complete M04-T11 action dispatcher;
- bounded multi-action and nested settlement turns owned by M04-T13;
- component-command, event-emission, behavior, or resource-refresh action integration;
- complete same-turn provenance and the observable sign-in session owned by M04-T16;
- adapter rendering, focus, animation, accessibility, or native lifecycle behavior;
- physical cancellation, retry, timeout, persistence, or offline policy;
- secure erasure of caller or transport data already retained elsewhere; or
- normative resolution of PF-020, PF-022, PF-031, or PF-039 in a future protocol release.

Those boundaries keep a headless operation primitive from being presented as a completed
cross-platform application runtime.
