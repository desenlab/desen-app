# Runtime Core Action Turns

## Result

M04-T13 is **PASS** for the framework-neutral DESEN 0.1.0 runtime slice.

The proof covers a bounded prepared-action-program boundary, deterministic ordered turns,
reentrant FIFO admission, current lifecycle snapshots, settlement ancestry, and mandatory
operation-settlement finalization. It does not claim incoming adapter-event integration, complete
seven-namespace provenance, rendering, or a complete application session.

## Frozen claim

The action-turn coordinator composes the exact single-action authorities proved by M04-T10 through
M04-T12:

- `state.set`, `state.toggle`, and local `navigate`;
- `operation.invoke` and `resource.refresh`; and
- `component.command` and allowlisted application-shell `event.emit`.

The coordinator never reimplements an action guard or payload evaluator. Each selected program
slot is delegated to exactly one child executor, preserving the child's single action-local token
session and guard-before-payload contract.

## Prepared programs and private routing

Caller-owned action arrays are not execution authority. `prepareRuntimeActionProgram` creates one
factory-authenticated program before admission:

- the accepted prefix is copied through an inert, accessor-free JSON boundary;
- copied arrays and objects are recursively immutable;
- a forged structural lookalike is rejected;
- action-family routes are retained only in a private `WeakMap`;
- the coordinator never reads a raw action `type`; and
- nested operation settlement branches receive the same prepared-program treatment.

Preparation reads only the first 64 executable indices of a turn. When a source array contains a
65th entry, index 64 and every later entry remain untouched. The prepared program retains the
bounded prefix plus an overflow marker; the turn executes the first 64 slots in order and then
terminates with `ACTION_LIMIT_EXCEEDED`.

An unknown discriminator is retained as an unknown private route. It becomes a controlled
failed-stop result only when its ordered slot is reached. Earlier actions therefore remain
observable, while later action payloads are not inspected.

## Admission and FIFO ownership

`executeRuntimeActionTurn` admits one already prepared program. An idle coordinator returns
`started`; reentry while a turn is active returns `queued`. Both accepted forms contain a native
completion `Promise` that always fulfills with controlled immutable data and never rejects.
The native Promise and one immutable emergency completion are created before queue admission.
Every terminal path—including an unexpected coordinator exception, disposal, transition overflow,
and abandoned-queue reclamation—therefore retains enough authority to fulfill an already accepted
request without depending on later fallible snapshot composition.

Started, reentrant, and asynchronous settlement work share one bounded FIFO:

1. an active turn completes its remaining ordered slots before reentrant work starts;
2. reentrant requests retain their admission order;
3. operation settlement work retains Promise-observation order;
4. no callback recursively dispatches a second turn on the active JavaScript stack; and
5. terminal disposal fulfills every accepted completion instead of abandoning it.

Queued entries and non-droppable future settlement work share finite turn capacity; retained
programs additionally share finite action and canonical-code-unit accounting. An operation effect
cannot cross its child boundary until the coordinator has reserved the future settlement safe
point. Capacity failure therefore prevents the operation effect rather than accepting a ticket
that might later be dropped.

## Ordered dispatch and stopping rules

Every slot uses its private prepared route to call exactly one child:

| Prepared route                          | Child authority                       |
| --------------------------------------- | ------------------------------------- |
| `state.set`, `state.toggle`, `navigate` | M04-T10 state/navigation executor     |
| `operation.invoke`, `resource.refresh`  | M04-T11 operation/resource compositor |
| `component.command`, `event.emit`       | M04-T12 command/event executor        |

The child receives the complete prepared action unchanged. The coordinator does not evaluate
`when`, materialize ValueSpecs, probe a command, select a resource or operation, or call a host
effect itself.

A valid false guard returns `skipped` and execution continues. A successful or accepted child
result also continues. A controlled child failure stops the turn before the next slot is observed.
Effects completed by earlier slots are not retroactively rolled back.

Successful navigation is terminal for the old surface. It stops the current program, terminally
disposes the composed old-surface authorities, and resolves queued old-surface admissions without
dispatching them.

## Current snapshots and no retry

Mount and admission use callback-free reads for the exact state, resource, operation, and
command/event managers. Mount and every slot also authenticate the exact surrendered T10 and T11
child executors through package-internal, root-non-exported reads; T12's public manager read covers
its child and registry authority together. Before every dispatched slot, the coordinator refreshes
all four current snapshots and reconstructs the resolution snapshot while retaining the turn's
lexical `context`, `item`, `env`, and immediate-event view. A component registration accepted after
one admission is therefore visible to the first command slot of the next admission without a
speculative failed dispatch.

An `invalid-snapshot` result is never retried in the same slot. It may represent either preflight
drift or a post-callback time-of-check/time-of-use change; retrying could repeat a command or
operation effect. The coordinator records only an identity-compatible, monotonically newer
snapshot, stops the turn, and performs all four fresh reads at the next admission. Every ordered
slot has at most one child delegation and at most one host effect.

## Action and transition bounds

The default Reference Profile ceilings are:

| Limit                                         |                   Default |
| --------------------------------------------- | ------------------------: |
| Actions per turn                              |                        64 |
| Nested action settlement depth                |                        16 |
| Repeated synchronous transitions in one drain |                        64 |
| Shared queued turns                           |                        64 |
| Retained queued actions                       |                     4,096 |
| Retained canonical action code units          |                 1,048,576 |
| Largest exact turn generation                 | `Number.MAX_SAFE_INTEGER` |

Trusted profiles may lower these values but cannot raise them or make them unbounded. Explicit
`null`, negative, fractional, non-finite, unsafe-integer, and above-default values fail mount
without widening a limit.

The 64th action and 16th settlement level are accepted. The 65th action, 17th settlement level, or
65th repeated synchronous transition terminates controlled work and emits exactly one
`ACTION_LIMIT_EXCEEDED` core diagnostic. No overflow path truncates silently or fabricates success.

## Settlement turns and ancestry

An accepted operation action never blocks its originating turn. At acceptance, the coordinator
binds the future settlement to the exact parent depth and event-free lexical base. A ticket-bearing
settlement creates a distinct FIFO turn at `parentDepth + 1`; the depth cannot be reset by
reentrancy or delayed Promise observation.

Settlement turns always reconstruct resolution with:

```text
event = { status: "unavailable" }
```

The original event payload cannot be revived through `onSuccess`, `onFailure`, nested settlement
actions, fallback, or a queued reentrant turn. Current state, resource, and operation lifecycle
namespaces are refreshed before the settlement program executes.

Success selects the captured `onSuccess` program. Declared failure, denial, invalid output, and
adapter failure select the captured `onFailure` program. Superseded and disposed attempts carry no
ticket and create no handler turn.

## Mandatory finalization

Every observed opaque M04-T11 settlement ticket crosses exactly one finalization attempt. A
private ticket-keyed `WeakSet` records the attempt before the lower finalizer is called, so even an
unexpected lower-layer throw cannot trigger a second call:

```text
try {
  execute the selected bounded settlement program
} finally {
  finalize the exact ticket once
}
```

The `finally` path applies after:

- successful or skipped handler completion;
- a controlled handler failure;
- an empty selected branch;
- an unexpected internal throw;
- action, transition, or settlement-depth overflow;
- navigation termination; and
- coordinator or lower-authority disposal.

Settlement navigation disposes M04-T11 before ticket finalization. No queued operation is promoted
onto the terminated surface. A same-alias invocation accepted inside a settlement turn remains
staged until the finalization safe point; only then may the lower FIFO promote it.

The already published operation lifecycle is never rewritten by a handler outcome. An unexpected
non-terminal finalizer response causes terminal containment rather than a second finalizer call or
a stranded queue gate.

Operation and resource Promise observers contain four distinct failure surfaces: fulfillment
callback throws, rejection callback throws, a Promise returned by either callback rejecting, and
thenable attachment itself throwing. Each path releases reserved retention, attempts required
ticket finalization once, and terminally contains the coordinator without allowing an accepted
completion Promise to reject.

## Diagnostic contract

Every action, transition, or settlement-depth overflow uses the frozen DESEN 0.1.0 core registry:

- code: `ACTION_LIMIT_EXCEEDED`;
- classification: `runtime`; and
- canonical meaning: `Action turn exceeded configured bound`.

The coordinator constructs the diagnostic through the protocol factory, reports it without a
receiver, exposes no `Error`, stack, cause, provider response, or arbitrary details, and does not
allow diagnostic callback behavior to turn failure into success.

## Traceability

M04-T13 directly verifies:

- `R-062` — ordered immediate-event actions use one fixed event payload while asynchronous
  settlement does not block the originating turn;
- `R-078` — settlement handlers form a distinct deterministic turn and cannot retroactively alter
  the operation result;
- `R-081` and `N-032` — the 64-action default, repeated-transition bound, stable overflow code,
  and terminated turn state;
- `R-123` and the M04-T13 portion of `N-041` — finite, lower-only action, depth, queue, retention,
  and generation limits; and
- `D-029` — live runtime emission of `ACTION_LIMIT_EXCEEDED`.

`N-032` becomes `TESTED`. M04-T13 adds executable action-order evidence to `N-014`, but that clause
remains `PLANNED` for slot, catalog, publication, and editor owners. `N-041` remains `PLANNED` for
the remaining Bundle-ingress, activation, adapter, and final measured-limit work. P-17 remains
`PARTIAL`.

## Deterministic evidence

The tracked artifact is
`docs/proof/artifacts/runtime-core-0.1.0-action-turns.json`. Its builder performs live behavior
probes independently of the focused test implementation and combines them with:

- exact M04-T10, M04-T11, and M04-T12 prerequisite hashes;
- public and package-internal export inventories;
- declaration and TSDoc parity;
- focused runtime and compiler-negative inventories;
- hostile runtime substitutions covering all security-significant paths;
- AST-based source invariants and hostile mutations proving process catch/finally placement,
  ticket-keyed one-shot finalization, operation/resource Promise callback fences, drain-level
  emergency reclamation, and all accepted-completion resolution paths;
- exact trace, normative, finding, and proof-document expectations;
- task-owned source, declaration, build, test, and proof-file digests; and
- byte-identical double generation.

Proof generation is a local maintenance action. CI runs the verifier and never rewrites evidence.

## Explicit deferrals

M04-T13 does not claim:

- generic incoming component or behavior events, owned by M04-T14;
- reactive dependency composition, owned by M04-T15;
- full joint provenance across all seven namespaces, coordinated surface disposal, and the final
  deterministic session trace, owned by M04-T16;
- platform rendering, adapter batching, transitions, animation, history, persistence, retry,
  timeout, cancellation, telemetry, or offline policy;
- final Bundle-ingress, activation, and measured profile closure of N-041/P-17; or
- closure of PF-043 in the frozen protocol text.
