# @desen/runtime-core

## Responsibility

Framework-neutral state, binding, predicate, action, resource, operation, behavior, lifecycle,
and activation-state semantics. The core consumes verified JSON data and target-independent host
ports, then emits JSON-serializable snapshots, diagnostics, traces, and render plans.

## Host and persistence boundary

The M04-T01 slice exposes navigation, storage, operations, resources, tokens, context,
environment, clock, and diagnostics through explicit ports. Later scheduling, cryptography,
entropy, event/command, and adapter capabilities must likewise use an intentional runtime
boundary; none may fall back to platform globals. The core defines the activation transaction
contract but does not implement IndexedDB, filesystem, network, or native storage.

A durable activation commit contains the active revision, previous-good revision, and generation
guard as one atomic record. The runtime does not expose a staged revision to renderers before that
commit succeeds. Browser-specific persistence belongs to `runtime-web`; a future native runtime
may satisfy the same contract with its platform transaction mechanism.

## M04-T01 host-port API

`createRuntimeHostPorts` captures a stable aggregate of trusted host callbacks. The callback
objects stay outside Source, Bundle, Catalog, fixture, render-plan, diagnostic, and trace data.
Required callbacks are captured by identity without being called, wrapped, or allowed to change
after composition. Because identity is preserved, every callback is explicitly typed with
`this: void`: adapters must pass an arrow function, a receiver-independent function, or a function
that was bound before composition.

| Port          | Current contract                                                                 |
| ------------- | -------------------------------------------------------------------------------- |
| `navigation`  | Synchronous accept/deny decision after the runtime validates a local target      |
| `storage`     | Immutable Bundle bytes plus one atomic active/previous-good/generation record    |
| `operations`  | Trusted effect call returning success, declared public failure, or policy denial |
| `resources`   | Trusted read call with the same controlled settlement envelope                   |
| `tokens`      | Synchronous host-owned token lookup; no DTCG or CSS storage enters the core      |
| `context`     | Atomic non-secret JSON snapshot plus invalidation subscription                   |
| `environment` | Atomic JSON snapshot for reserved and profile-defined `env.*` paths              |
| `clock`       | Injected Unix-epoch millisecond observation; no platform-global time read        |
| `diagnostics` | Safe portable diagnostic observation without `Error`, stack, cause, or payload   |

The context port is explicit even though the task title lists environment only: DESEN 0.1.0
assigns `context.*` to host-provided, profile-defined, non-secret data. Empty context and
environment providers must therefore still be supplied instead of falling back to platform
globals.

```ts
import { createRuntimeHostPorts } from "@desen/runtime-core";

const ports = createRuntimeHostPorts({
  navigation: {
    navigate: ({ targetSurfaceId }) =>
      canOpenManagedSurface(targetSurfaceId) ? { status: "succeeded" } : { status: "denied" },
  },
  storage: {
    getBundle,
    putBundle,
    readActivation,
    commitActivation,
  },
  operations: { invoke: invokeTrustedOperation },
  resources: { load: loadTrustedResource },
  tokens: { resolve: resolveHostToken },
  context: { getSnapshot: readSafeContext, subscribe: subscribeToContext },
  environment: { getSnapshot: readEnvironment, subscribe: subscribeToEnvironment },
  clock: { now: readHostTime },
  diagnostics: { report: reportSafeDiagnostic },
});
```

The example names are application functions, not globals or DESEN-selected code. The aggregate
factory requires exactly the documented top-level ports and own data-property callbacks. It
returns frozen callback snapshots without freezing caller-owned objects.

This exact nine-port aggregate is the M04-T01 integration slice, not a promise that every later
runtime bridge already exists. Allowlisted `event.emit`, component commands, and their generic
adapter bridges remain explicitly assigned to M04-T12 and M04-T14. Adding a future trusted bridge
there requires an intentional, versioned host-contract change rather than an untracked extra key.

## M04-T02 value-resolution API

`createRuntimeResolutionSnapshot` copies all seven reference namespaces as one bounded,
recursively frozen value. The snapshot is factory-branded: a caller cannot substitute a mutable
lookalike and bypass the atomic data boundary.

The runtime must compose those maps from an already validated active surface and the current
evaluation turn. The factory proves data safety, envelope shape, detachment, and map presence; it
does not independently reopen the Bundle to prove that a supplied root was declared.

| Namespace   | Runtime view                                                              |
| ----------- | ------------------------------------------------------------------------- |
| `state`     | Exact surface-local declaration roots and array-free nested object paths  |
| `context`   | Explicit host-approved, non-secret JSON; never a platform-global fallback |
| `resource`  | Declared roots exposing only `status`, `pending`, `value.*`, `error.code` |
| `operation` | Declared aliases with the same public lifecycle allowlist                 |
| `event`     | Payload only during the immediate handler turn                            |
| `item`      | Exact currently active repeat aliases                                     |
| `env`       | Explicit reserved and profile-defined environment paths                   |

`resolveRuntimeValue` returns one explicit result:

- `resolved` contains one complete immutable JSON value and records whether a fallback was used;
- `unresolved` contains `REFERENCE_UNRESOLVED`, the exact `$ref` pointer, reference, and reason;
- `invalid` rejects malformed, executable, accessor-backed, cyclic, or over-budget data; and
- `deferred` fences `$token` and `$format` until M04-T03 rather than guessing their behavior.

```ts
import { createRuntimeResolutionSnapshot, resolveRuntimeValue } from "@desen/runtime-core";

const snapshot = createRuntimeResolutionSnapshot({
  state: { profile: { name: "Selman" } },
  context: { route: { tenant: "desenlab" } },
  resource: {},
  operation: {},
  event: { status: "unavailable" },
  item: {},
  env: { platform: "web" },
});

const title = resolveRuntimeValue({ $ref: "state.profile.name", fallback: "Untitled" }, snapshot);
```

JSON `null`, `false`, `0`, and an empty string are resolved values, so none selects a fallback.
Fallback is evaluated only when a legal active root has a missing value. It cannot create an
unknown state/resource/operation/item root, revive an unavailable event scope, or legalize an
unlisted lifecycle path. Arrays may be returned whole but reference paths never traverse them.
A value obtained from a scope stays inert even if its JSON shape resembles another `$ref`,
`$token`, or `$format`.

The factory and resolver use one shared safety profile: depth 128, 4,096 JSON occurrences, and
1,048,576 combined UTF-16 code units. They copy only enumerable own data properties and reject
accessors, functions, promises, symbols, non-plain class/prototype shapes, sparse or decorated
arrays, cycles, non-finite numbers, and reflection failures. Accepted plain-record-compatible
objects contribute only enumerable own data; inherited fields are never copied. Arbitrary `Proxy`
traps cannot be prevented from running by JavaScript reflection; their exceptions are contained
and the complete input is rejected. A failure or deferred child never exposes a partial composite
value. The complete composed output is detached and checked again against all three limits, so
repeating a legal large reference cannot amplify node, string, or depth cost past the same profile.

Resolution produces a candidate JSON value. Capability prop/style schema validation and
`PROP_TYPE_MISMATCH` still belong to the adapter composition boundary in M05; a later type
mismatch must not retry a fallback. Lifecycle transitions, event lifetime production, context
secret classification, tokens, and formatting remain with their named later tasks.

## Port invariants

- Operation and resource input reaches a host implementation only after runtime resolution and
  schema validation. Returned success values and public error codes remain untrusted until a later
  runtime stage detaches and validates them.
- A policy denial is distinct from a declared public failure and can never be reported as success.
  Thrown or rejected host exceptions are adapter failures; raw errors never become lifecycle data.
- Navigation can target only an existing surface in the active Bundle. Denial cannot substitute a
  different surface, and external URL navigation is not part of the core port.
- Token `missing` is distinct from a resolved JSON `null`. The core never guesses a replacement or
  owns the host's token document.
- Context and environment subscriptions are invalidation signals. The runtime rereads a complete
  snapshot so one action or predicate turn never observes a partial update.
- Bundle storage is content-addressed. The same revision and bytes are idempotent; different bytes
  under the same revision conflict and are never overwritten.
- Active revision, previous-good revision, and generation commit as one compare-and-swap record.
  User-input persistence and arbitrary design-selected storage keys are intentionally absent.
- Requests and controlled results contain JSON-compatible data. Promise-like settlement,
  callbacks, byte storage, and unsubscribe functions are transport mechanisms and never enter a
  protocol-observable JSON trace.
- Host callbacks cannot depend on an object receiver. The factory preserves callable identity and
  does not create wrappers; receiver-dependent methods must be bound by the application first.

## Explicit non-responsibilities

- React, React Native, DOM, CSS, or browser APIs
- Node built-ins or filesystem access
- Storage, network, clock, or cryptography implementations
- Component implementations or framework adapter registration
- Editor UI or application code

## Status

Private proof package. M04-T01 defines host contracts and stable callback composition; M04-T02
defines bounded literal/reference/fallback materialization. Tokens, formatting, state writes,
resource/operation transitions, action execution, rendering, activation implementation,
event/command bridges, and adapters remain assigned to their later tracked tasks.

## Protocol and target support

- Protocol baseline: DESEN 0.1.0
- Target: platform-neutral

## Quality

Use the focused runtime tests and root workspace quality gate:

```bash
pnpm --filter @desen/runtime-core test:host-ports
pnpm --filter @desen/runtime-core test:value-resolution
pnpm verify:runtime-core-host-ports
pnpm verify:runtime-core-value-resolution
pnpm check
```
