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
mismatch must not retry a fallback. The M04-T02 entry point deliberately retains its token and
format `deferred` fence; M04-T03 completes those forms through the separate additive API below.
Lifecycle transitions, event lifetime production, and context secret classification remain with
their named later tasks.

## M04-T03 token and format materialization API

`materializeRuntimeValue` completes one `RuntimeValueSpec` without changing
`resolveRuntimeValue`. It receives the same factory-created resolution snapshot and an explicit
trusted token port plus request context. The core never looks up a global provider, owns a token
document, or imports a target-specific token implementation.

```ts
const result = materializeRuntimeValue(spec, snapshot, {
  requestContext,
  tokens: hostPorts.tokens,
});
```

`RuntimeValueMaterializationContext` has exactly those two members. An invalid context throws a
`TypeError` before any token callback runs. The result union reuses the existing `resolved`,
reference-`unresolved`, and `invalid` outcomes, then adds:

- `RuntimeTokenUnresolved`, with `status: "unresolved"`, `REFERENCE_UNRESOLVED`, the exact pointer,
  token name, and `reason: "missing-token"`; and
- `RuntimeTokenProviderFailure`, with `status: "failed"`, redacted `ADAPTER_FAILURE`, the exact
  pointer, and `adapter: "token-provider"`.

For `$token`, the materializer sends the opaque non-empty token name and exact request context to
the synchronous host port. A resolved JSON null is a successful value and remains distinct from
`missing`. One top-level materialization performs at most one lookup for each unique token name;
later occurrences reuse the first detached and immutable success, missing, or failure outcome. The
cache is discarded after that top-level call. A missing token produces a token-specific
`REFERENCE_UNRESOLVED` result. A thrown callback, malformed provider envelope, or unsafe provider
value produces a redacted `ADAPTER_FAILURE` and exposes no raw error, provider response, or partial
value.

For `$format`, the materializer uses the PF-017 single-pass placeholder profile:

- a placeholder is exactly `{name}`, with `name` matching `[A-Za-z_][A-Za-z0-9_]*`;
- repeated placeholders are allowed, but bare, empty, nested, or unmatched braces are invalid;
- DESEN 0.1.0 defines no brace-escape syntax;
- placeholder names and own `values` keys must match exactly; and
- template text never performs expression, property-chain, prototype, locale, markup, or code
  evaluation.

Every mapped value is materialized once in the same snapshot and token context. Repeated
placeholders reuse that result. Raw strings are inserted unchanged; all other resolved JSON values
use RFC 8785 canonical JSON. A nested reference, token, format, or fallback keeps its exact RFC 6901
failure location and fallback flag. One failed child rejects the complete parent without exposing
resolved siblings.

Input, provider output, nested values, and final output share the M04-T02 safety profile. The
materializer therefore detaches and freezes accepted data, preserves deterministic object and array
ordering, and checks the fully expanded string against the same limits before returning it.
Successful materialization still does not prove that the candidate matches its consumer. Exact
prop, style-part, action-input, operation/resource, and adapter schema validation remains M05.

## M04-T04 predicate and conditional-presence API

`evaluateRuntimePredicate` evaluates the closed DESEN 0.1.0 predicate language against one
factory-created `RuntimeResolutionSnapshot`. It accepts exactly thirteen operators:

| Operators                | Runtime behavior                                                                 |
| ------------------------ | -------------------------------------------------------------------------------- |
| `all`, `any`, `not`      | Compose nested predicates or resolved boolean ValueSpecs                         |
| `eq`, `neq`              | Compare any two resolved JSON values by RFC 8785 canonical identity              |
| `gt`, `gte`, `lt`, `lte` | Compare two numbers or two strings of the same type                              |
| `in`, `contains`         | Apply the protocol's array-member or string-substring directions                 |
| `exists`                 | Test whether the original reference resolves, including to JSON `null`           |
| `truthy`                 | Apply DESEN's explicit truth conversion rather than JavaScript object truthiness |

```ts
import { evaluateRuntimeConditionalPresence, evaluateRuntimePredicate } from "@desen/runtime-core";

const canSubmit = evaluateRuntimePredicate(
  {
    op: "all",
    args: [
      { op: "truthy", args: [{ $ref: "state.formValid" }] },
      { op: "not", args: [{ $ref: "operation.signIn.pending" }] },
    ],
  },
  snapshot,
);

const errorPresence = evaluateRuntimeConditionalPresence(
  {
    op: "eq",
    args: [{ $ref: "operation.signIn.error.code" }, "invalidCredentials"],
  },
  snapshot,
);
```

The evaluator first copies and validates the complete predicate, then resolves every operand
against the same immutable snapshot. It evaluates depth-first from left to right without
short-circuiting. `all` and `any` therefore still inspect later arguments after their boolean result
is already known, so dynamic `PREDICATE_TYPE_MISMATCH` diagnostics remain complete and appear in
stable document order. A mismatch makes its current predicate false and carries only its exact
relative JSON Pointer; no resolved operand or partial composite is exposed.

A directly unresolved ValueSpec makes its current predicate false. A nested predicate that
evaluates false is instead an ordinary boolean input to its parent. For example,
`not(missingBooleanReference)` is false because its direct argument is unresolved, while
`not(truthy(missingReference))` is true because the nested `truthy` predicate completed with the
boolean value false. `exists` is narrower still: it accepts a reference, tests the original lookup
without selecting or evaluating its fallback, and returns true when that original value is JSON
`null`.

Equality and array membership use RFC 8785 canonical JSON, so object-member order is irrelevant,
array order remains significant, and `-0` has the same canonical identity as `0`. String ordering
and substring matching use exact UTF-16 code-unit semantics. They perform no locale collation,
case folding, Unicode normalization, expression evaluation, property lookup, or implicit
formatting.

M04-T04 deliberately depends only on the M04-T02 resolver. A `$token` or `$format` operand returns
an exact `deferred` outcome instead of being guessed false. M04-T05 owns the data-only composition
of those operand positions with `materializeRuntimeValue`; the public predicate API accepts no
executable resolver callback.

`evaluateRuntimeConditionalPresence` converts an omitted `when` to `present: true` and a completed
predicate to its exact presence decision. `present: false` means the node and its descendants are
not instantiated; it does not mean that a mounted node should receive hidden CSS. Invalid or
deferred predicates also remain non-instantiated fail-closed, while their distinct status prevents
them from masquerading as a predicate that evaluated false. M04-T15 owns reactive reevaluation,
and M04-T16 owns the complete proof that absent descendants expose no active resources, behaviors,
events, or commands.

Predicate input and all resolved operand occurrences share the runtime's bounded, detached,
recursively immutable data profile. One predicate tree accepts at most 64 predicate nodes (the
root plus 63 nested nodes) and 4,096 aggregate argument occurrences; each `all` or `any` remains
limited to 64 arguments. Hostile objects, accessors, functions, promises, cycles, non-finite
numbers, sparse arrays, reflection failures, and aggregate amplification fail without a partial
boolean result. Operands are resolved and charged sequentially: an earlier invalid/deferred
terminal keeps precedence, while an aggregate overflow stops before later values are copied. The
implementation imports no React, React Native, DOM, CSS, browser, or application API.

## M04-T05 ordered Variant and style-override API

`evaluateRuntimeVariantOverrides` selects effective prop and style ValueSpecs from one base map and
an ordered Variant array:

```ts
import { evaluateRuntimeVariantOverrides } from "@desen/runtime-core";

const responsive = evaluateRuntimeVariantOverrides(
  {
    props: { direction: "horizontal", gap: 12 },
    style: { base: { root: { padding: { $token: "space.container" } } } },
    variants: [
      {
        when: {
          op: "lt",
          args: [{ $ref: "env.viewport.width" }, 640],
        },
        props: { direction: "vertical" },
        style: { base: { root: { padding: 8 } } },
      },
    ],
  },
  snapshot,
  {
    requestContext,
    tokens: hostPorts.tokens,
  },
);
```

Base paths are selected first. Every Variant predicate is then evaluated in original array order;
all matching patches apply, and the later matching value at the same exact leaf wins. The merge
leaves are:

```text
/props/{name}
/style/{state}/{part}/{property}
```

`/props/{name}` is one indivisible override leaf.
`/style/{state}/{part}/{property}` is one indivisible override leaf. Literal objects and arrays
inside either ValueSpec are replaced as a whole and are never recursively merged. An omitted path
preserves its previous selection, while JSON `null` is a value rather than a delete instruction.
Visual-state maps remain independent and do not implicitly cascade from `base`. Variants cannot add
or remove children because the accepted API contains no slots, children, capability, behavior,
repeat, or event fields.

Conditions reuse the M04-T04 prepared-predicate seam and complete token/format operands through
M04-T03 against one factory-created snapshot, one captured request context, and one turn-scoped
token session. Every prepared operand remains paired with its exact materialized position. The
session performs at most one host lookup per unique opaque token name across all sibling Variant
conditions. Directly missing references or tokens make their current predicate false; dynamic
type mismatches likewise produce false plus an ordered source-prefixed
`PREDICATE_TYPE_MISMATCH`. Invalid input, a redacted provider failure, or a finite-budget crossing
fails the complete call without a partial effective map.

An `evaluated` result contains:

- `effectiveProps` and `effectiveStyle`, holding the winning raw ValueSpecs;
- `sources`, holding the exact base or Variant JSON Pointer for every winning leaf;
- `matchingVariantIndices`, preserving zero-based document order; and
- ordered predicate `diagnostics`.

The evaluator returns effective raw ValueSpecs, not final materialized props or styles. A winning
reference, token, format, literal, or JSON `null` remains inert and recursively immutable for the
next runtime stage. This also means an overwritten value cannot trigger an irrelevant token lookup
or unresolved-value failure. Consumer-schema validation and adapter delivery remain M05; active
visual-state selection likewise remains target-adapter work.

Before any provider callback, all raw output candidates and condition operands pass the T02
structural grammar followed by the T03 outer-first format-profile grammar. This two-pass check is
data-only: it does not read referenced snapshot values, call the token provider, or construct a
formatted output.

The complete input, aggregate resolved condition operands, and retained unique token candidates
are bounded. Input uses the shared depth-128, 4,096-JSON-occurrence, and
1,048,576-UTF-16-unit profile; the latter two limits are also applied independently across all
conditions and across the shared token cache. Each condition retains the 64-predicate-node and
64-argument per-operator ceilings. Hostile or malformed shapes fail closed, accepted maps are
detached and recursively immutable, and no React, React Native, DOM, CSS, browser, or application
API enters the implementation. JSON object-member order is not semantic; callers that need stable
bytes use the protocol's RFC 8785 canonicalizer.

## M04-T06 local state and base node identity API

`mountRuntimeSurfaceState` creates one fresh surface-local state lifetime. It copies all state
declarations through the shared inert JSON boundary, validates every schema graph, and applies each
schema to its complete initial value before returning anything. One bad entry rejects the entire
mount; no partial handle or value map escapes.

```ts
import { mountRuntimeSurfaceState, writeRuntimeSurfaceState } from "@desen/runtime-core";

const mounted = mountRuntimeSurfaceState({
  surfaceId: "sign-in",
  state: {
    email: {
      schema: { type: "string" },
      initial: "",
    },
  },
});

if (mounted.status === "mounted") {
  const result = writeRuntimeSurfaceState(mounted.handle, {
    path: "email",
    value: "designer@example.com",
  });
  // result is updated, unchanged, rejected, disposed, or an invalid forged-handle outcome.
  void result;
}
```

The handle is factory-branded and contains no state values. `readRuntimeSurfaceState` returns the
current detached, recursively immutable snapshot; its `values` map can be supplied directly as the
M04-T02 `state` namespace. A different accepted write advances the zero-based generation exactly
once. A canonically identical candidate returns `unchanged` without invalidation. A rejected write
returns `STATE_WRITE_INVALID` and leaves the exact current snapshot and generation unchanged.

The first substring before `.` is always the complete state entry name. There is no longest-prefix
lookup for dotted declarations. Root paths replace a complete entry; nested paths traverse only
existing own object properties. Missing intermediate containers and array indexing are rejected.
The final property may be created only when the complete resulting entry validates against its
exact schema. Validation uses `complete` plus `resolved-value`, so `$ref`, `$token`, and `$format`
names inside state are ordinary inert JSON rather than executable bindings. The validator seam is
exposed only through the first-party `@desen/validator/schema-contract-syntax` and
`@desen/validator/schema-contract` package subpaths; M04 uses only the generated
`validateDraft202012` named export from the narrow typed syntax seam, and the validator root API
remains unchanged. Explicit `$vocabulary` declarations fail closed because this runtime does not
claim vocabulary-dependent assertion support.

`disposeRuntimeSurfaceState` ends the handle lifetime idempotently, releases its live schemas and
current snapshot, and prevents later writes. A caller may still retain a previously returned
immutable historical snapshot; secure erasure of caller-owned JavaScript data is not claimed. A
new mount always starts from the exact declared initials and never reads persistence or writes back
to the Source or Bundle.

`createRuntimeNodeIdentity` and `reconcileRuntimeNodeIdentity` define the repeat-free headless
identity base. The stable key is the exact structured document/surface/node tuple. Revision, tree
position, capability, props, and style do not change that key. The same tuple and same `use` is
`preserve-eligible`; a changed `use` is `remount-required`; and a changed document, surface, or
node is `replace-required`. Actual adapter preservation, remount-required prop policy, repeat keys,
reactive mount/unmount, and action dispatch remain M05-T05, M04-T07, M04-T15, and M04-T10.

State declarations, candidates, snapshots, and identity descriptors use the shared depth-128,
4,096-occurrence, and 1,048,576-UTF-16-unit safety boundary. Accessors, executable values,
promises, symbols, cycles, non-finite numbers, sparse or decorated arrays, reflection failures,
forged authorities, and over-budget data fail closed without a partial state. No host callback,
storage port, framework, DOM, CSS, browser, or native-platform API enters either primitive.

## M04-T07 repeat materialization and repeated identity API

`createRuntimeRepeatRootScope` starts a lexical repeat lifetime from a factory-created M04-T02
snapshot whose `item` namespace is empty. `materializeRuntimeRepeat` then resolves `items` before
introducing the new alias, evaluates every key inside an isolated child scope, and exposes
instances only after the complete repeat passes.

```ts
import {
  createRuntimeRepeatRootScope,
  createRuntimeResolutionSnapshotForRepeatScope,
  materializeRuntimeRepeat,
} from "@desen/runtime-core";

const rootScope = createRuntimeRepeatRootScope(snapshot);
const repeated = materializeRuntimeRepeat(rootScope, {
  items: { $ref: "resource.tasks.value" },
  as: "task",
  key: { $ref: "item.task.id" },
  limit: 100,
});

if (repeated.status === "materialized") {
  const first = repeated.instances[0];
  if (first !== undefined) {
    const childSnapshot = createRuntimeResolutionSnapshotForRepeatScope(first.scope);
    // childSnapshot.item.task is active only for this isolated instance scope.
    void childSnapshot;
  }
}
```

Nested scopes retain outer aliases and append keys outer-to-inner. Reusing an active alias fails,
while disjoint sibling repeats may reuse the same name. Child scopes cannot mutate or leak into
their parent or siblings. The successful result preserves original item order and never sorts by
key.

Keys must resolve to strings or finite numbers. Their identities use exact RFC 8785 canonical JSON:
numeric `1` and string `"1"` remain distinct, while `-0` and `0` collide. A missing, non-scalar, or
duplicate key rejects the whole subtree with no partial instances. A resolved non-array produces
`REPEAT_ITEMS_INVALID`; an unresolved item reference retains `REFERENCE_UNRESOLVED`. Token and
format items or keys remain explicit `deferred` outcomes for M04-T16 composition.

The effective ceiling is `min(repeat.limit ?? 1_000, 1_000)`. Exact-boundary input succeeds and
overflow returns `run.desen.runtime/REPEAT_LIMIT_EXCEEDED`; the runtime never truncates the
subtree. The whole-surface 5,000-node limit requires full tree composition and remains M04-T16
work.

Repeat scopes retain one shared base snapshot plus only their active aliases and ordered key path.
`createRuntimeResolutionSnapshotForRepeatScope` creates a full standard snapshot on demand, so a
1,000-item result does not retain 1,000 copies of unrelated state, context, resource, operation,
event, and environment data.

`createRuntimeRepeatedNodeIdentity` and `reconcileRuntimeRepeatedNodeIdentity` compose the T06
document/surface/source-node base with the complete repeat-key path. Alias names, array indexes,
item contents, revision, props, and styles do not enter identity. Reordering equal keys preserves
the exact prior identity; an own or ancestor key change requires replacement; and a capability
change on the same path requires a remount generation. Platform-instance preservation remains
M05-T05.

## M04-T08 resource lifecycle and refresh API

`mountRuntimeSurfaceResources` authenticates the prepared Catalog set, captures the host ports,
and publishes every declared resource as one idle generation without calling the host. Initial
`mount` and `once` policies start together; `manual` remains idle until an explicit refresh.

```ts
import {
  createRuntimeResolutionSnapshot,
  mountRuntimeSurfaceResources,
  refreshRuntimeSurfaceResource,
  startRuntimeSurfaceResources,
} from "@desen/runtime-core";

const mounted = mountRuntimeSurfaceResources({
  documentId,
  revision,
  surfaceId,
  resources,
  catalogSet,
  hostPorts,
});

if (mounted.status === "mounted") {
  const resolution = createRuntimeResolutionSnapshot({
    state,
    context,
    resource: mounted.snapshot.lifecycles,
    operation,
    event,
    item,
    env,
  });
  const started = startRuntimeSurfaceResources(mounted.handle, resolution, mounted.snapshot);

  if (started.status === "started") {
    refreshRuntimeSurfaceResource(mounted.handle, {
      instanceId: "stores",
      resourceSnapshot: started.snapshot,
      snapshot: createRuntimeResolutionSnapshot({
        state,
        context,
        resource: started.snapshot.lifecycles,
        operation,
        event,
        item,
        env,
      }),
    });
  }
}
```

The exact current manager-issued resource snapshot is an identity lease: stale, foreign, and
structurally ABA-equal snapshots fail closed. M04-T16 still owns provenance across the other
state/context/operation/event/item/environment managers.

Input member names are sorted, their ValueSpecs are materialized as one array through M04-T03, and
the resolved members are reconstructed before exact Catalog input validation. This keeps
dollar-prefixed parameter names as data while sharing one atomic token cache across the whole
request. Successful output is detached and validated before exposure. Undeclared failures,
malformed envelopes, host exceptions, and policy denial expose only redacted controlled results;
attacker-controlled output keys never enter public diagnostics.

Request IDs are deterministic per instance and accepted generation. Invalid input consumes no
generation. Refresh is latest-wins, stale settlements are ignored before envelope inspection, and
disposal is terminal. Each accepted pending transition reserves room for its terminal snapshot.
Hosts may lower the attempt, snapshot, and active-transport ceilings; at most 64 host loads run
concurrently by default, with later attempts held in a bounded replacement queue. No retry,
timeout, cache, persistence, or physical transport-cancellation policy is invented.

## M04-T09 operation lifecycle and concurrency API

`mountRuntimeSurfaceOperations` publishes the complete validated alias inventory as immutable
`idle` lifecycles. Each alias is permanently bound to one Catalog operation. Invocation supplies
the protocol action's operation identifier only as an assertion; it cannot select a different
capability, effect, schema, or public-error contract.

```ts
import {
  acknowledgeRuntimeOperationSettlement,
  invokeRuntimeOperation,
  mountRuntimeSurfaceOperations,
} from "@desen/runtime-core";

const mounted = mountRuntimeSurfaceOperations({
  documentId,
  revision,
  surfaceId,
  aliases: { signIn: { operation: "com.example.auth/signIn" } },
  catalogSet,
  hostPorts,
});

if (mounted.status === "mounted") {
  const invocation = invokeRuntimeOperation(mounted.handle, {
    alias: "signIn",
    operation: "com.example.auth/signIn",
    input: resolvedInput,
    concurrency: "reject",
    operationSnapshot: mounted.snapshot,
  });

  if (
    invocation.status === "started" ||
    invocation.status === "queued" ||
    invocation.status === "staged"
  ) {
    const settlement = await invocation.settlement;
    if ("lease" in settlement) {
      acknowledgeRuntimeOperationSettlement(mounted.handle, settlement.lease);
    }
  }
}
```

Input must already be fully materialized by the later action layer; this manager detaches it again
and applies the exact Catalog input schema before accepting identity or host authority. Accepted
request IDs are deterministic. Successful output is detached, schema-validated, and frozen;
declared public errors are the only codes exposed through a failed lifecycle. Policy denial uses
the exact core `OPERATION_DENIED` diagnostic, while malformed, thrown, rejected, undeclared, and
invalid-output results remain redacted controlled settlements.

Omitted concurrency defaults to `reject`. `replace` validates first and then supersedes the active
attempt plus its alias backlog; `queue` preserves FIFO order under one surface-global bound. A
terminal settlement returns an opaque manager-bound lease. A same-alias handler invocation may
publish `pending` as `staged`, but neither it nor queued work reaches the host until the predecessor
lease is acknowledged. Attempt, snapshot, aggregate queue, retained-data, and active-transport
limits are finite and may only be lowered. Disposal is terminal, and stale results are rejected
before their envelopes are inspected.

## M04-T10 guarded state and navigation action API

`mountRuntimeStateNavigationActions` binds exactly one active local-state lifetime to the trusted
complete same-Bundle surface inventory and framework-neutral host boundary. The executor accepts
one `state.set`, `state.toggle`, or managed-surface `navigate` action at a time; ordered action
arrays and settlement turns are composed by the later M04-T13 API documented below.

```ts
import {
  executeRuntimeStateNavigationAction,
  mountRuntimeStateNavigationActions,
} from "@desen/runtime-core";

const mounted = mountRuntimeStateNavigationActions({
  documentId,
  revision,
  surfaceId,
  surfaceIds: ["signIn", "account"],
  stateHandle,
  stateSnapshot,
  hostPorts,
});

if (mounted.status === "mounted") {
  const result = executeRuntimeStateNavigationAction(
    mounted.handle,
    {
      type: "state.set",
      path: "email",
      value: { $token: "form.email" },
      when: { op: "truthy", args: [{ $ref: "state.enabled" }] },
    },
    resolutionSnapshot,
    stateSnapshot,
  );
}
```

The optional guard is captured and fully evaluated before the action discriminator or any
type-specific payload is inspected. A valid false guard therefore cannot observe a hostile path,
value, target, parameter, extension, or payload token. Guard and payload share one detached,
bounded token cache; individually unsafe provider values preserve M04-T03's redacted
`ADAPTER_FAILURE`, while aggregate retention of otherwise valid results fails as a runtime-safety
`invalid` outcome.

Every hostile reflection, token, diagnostic, and navigation boundary is followed by a lifetime and
exact-state check. A callback or Proxy that disposes the executor wins over an apparent success,
and state drift returns `invalid-snapshot` before any stale effect. `state.set` and `state.toggle`
delegate complete-entry validation and atomic publication to M04-T06; toggle accepts only an exact
boolean leaf.

Navigation authorizes the local target before parameter materialization. Parameters are sorted,
materialized as one atomic named map, detached, and frozen before the host call. Unknown targets
return core `ENTRY_NOT_FOUND` at `/surface`; current host-policy denial reports
`run.desen.runtime/NAVIGATION_DENIED`; thrown, Promise-like, accessor-backed, or malformed host
results become redacted `ADAPTER_FAILURE`. Accepted request identities are deterministic.
Successful navigation, including same-surface navigation, terminally disposes both this executor
and its captured local-state lifetime; a minimal tombstone preserves deterministic late-call
results without retaining live authority.

The package-internal `readRuntimeStateNavigationActions` seam returns the executor's exact
document, revision, surface, and currently published lower state snapshot without invoking host,
token, diagnostic, navigation, or state-write code. It is deliberately absent from the package
root: M04-T13 uses it only to authenticate surrendered child authority and obtain a fresh
composition snapshot.

## M04-T11 guarded operation and resource action API

`mountRuntimeOperationResourceActions` composes one exact current M04-T08 resource manager and one
exact current M04-T09 operation manager. The trusted composition root surrenders those lower-level
handles to this lifetime; a second live compositor cannot claim either handle. Because JavaScript
cannot revoke a lower-level handle already retained by a caller, every composed effect still
rechecks both exact manager snapshots and fails closed after direct lower-level drift.

```ts
import {
  executeRuntimeOperationResourceAction,
  mountRuntimeOperationResourceActions,
} from "@desen/runtime-core";

const mounted = mountRuntimeOperationResourceActions({
  documentId,
  revision,
  surfaceId,
  operations: { signIn: { operation: "com.example.auth/signIn" } },
  resourceHandle,
  resourceSnapshot,
  operationHandle,
  operationSnapshot,
  hostPorts,
});

if (mounted.status === "mounted") {
  const result = executeRuntimeOperationResourceAction(
    mounted.handle,
    {
      type: "operation.invoke",
      operation: "com.example.auth/signIn",
      as: "signIn",
      input: {
        email: { $ref: "state.email" },
        password: { $ref: "state.password" },
      },
      concurrency: "replace",
      onSuccess: [{ type: "navigate", surface: "home" }],
    },
    resolutionSnapshot,
    resourceSnapshot,
    operationSnapshot,
  );
  void result;
}
```

The guard is completed before any discriminator or payload member is observed. A true operation
guard and its input share one bounded action-local token cache. Alias and capability authorization
precede input and settlement-handler capture. Handler arrays are detached, frozen, and charged
against finite pending-settlement, retained-action, and retained-string budgets before M04-T09 may
accept the invocation.

Started, queued, and staged effects return synchronously; their mapped settlement remains a
Promise and never blocks the originating action turn. Success selects the acceptance-time
`onSuccess` snapshot. Declared failure, denial, invalid output, and adapter failure select
`onFailure`; superseded and disposed attempts select no turn. A lease-bearing settlement exposes
an opaque ticket rather than M04-T09's raw lease. Only the package-internal M04-T13 runner may
finalize that ticket after its new event-unavailable action turn, from a `finally` path. Empty
handlers cross the same safe point, and handler failure cannot rewrite the already-published
operation lifecycle.

`resource.refresh` authorizes the instance and delegates to M04-T08 using the exact current
resource and resolution snapshots. The resource manager independently resolves the declaration's
current input under its own request identity and token session; the action guard cannot memoize or
poison refresh input. Disposal terminally closes the compositor plus both surrendered managers,
invalidates settlement tickets, and leaves no live operation queue gate. Physical cancellation,
retry, timeout, caching, and cross-manager provenance outside the two exact lifecycle namespaces
remain later-profile work.

The package-internal `readRuntimeOperationResourceActions` seam observes the compositor's exact
document, revision, surface, and current lower resource and operation snapshots without host,
token, diagnostic, action, effect, or generation work. Forged and disposed handles fail closed;
reentrant observation returns `busy`. The seam is not exported from the package root before
M04-T16's joint runtime contract.

## M04-T12 command and outbound host-event action API

`createRuntimeCommandEventHostPorts` captures a separate synchronous, receiver-independent bridge
for generic component commands and application-shell events. It does not change M04-T01's frozen
nine-port host contract. Thrown, Promise-like, accessor-backed, or malformed results become a
controlled adapter failure; requests and results contain no component object, ref, DOM node,
framework value, error, or arbitrary method.

`mountRuntimeCommandEventActions` binds one exact document, revision, surface, authenticated
execution Catalog set, static source-node-to-component-capability inventory, host event allowlist,
host ports, and command/event bridge. Component instances register only an inert runtime-instance
identifier under an opaque generation ticket. Multiple bounded instances may coexist for one
repeated source node, but `component.command` dispatches only when exactly one is live. Zero or
multiple instances return a controlled unavailable result without choosing the first or last
registration.

`readRuntimeCommandEventActions` returns the exact current immutable registry snapshot by
reference. It is callback-free, receiver-independent, and generation-neutral, so a composition
root can observe registration changes before the first following command without invoking a host
or deliberately failing one stale turn.

Trusted adapter composition additionally uses package-internal, package-root-hidden seams. They
read the manager's exact validated Catalog set, captured command/event port authority, and current
registry snapshot; authenticate the aggregate port's exact component-command callback; and let an
adapter consume exactly once the private factory marker attached to a normalized component-command
request for that exact port owner. Replay, a foreign aggregate reusing the same callback, and
authority retained beyond the synchronous callback all fail. Together these seams prevent a bridge
from substituting Catalog or port authority, or calling its public structural command callback
directly to bypass T12 command selection and input validation.

```ts
import {
  createRuntimeCommandEventHostPorts,
  executeRuntimeCommandEventAction,
  mountRuntimeCommandEventActions,
  registerRuntimeComponentCommandTarget,
} from "@desen/runtime-core";

const commandEventPorts = createRuntimeCommandEventHostPorts({
  commands: {
    invoke(request) {
      return hostCommands.invoke(request);
    },
  },
  events: {
    validate(request) {
      return hostEventContracts.validate(request);
    },
    emit(request) {
      return hostEvents.emit(request);
    },
  },
});

const mounted = mountRuntimeCommandEventActions({
  documentId,
  revision,
  surfaceId,
  staticComponents: { email: "run.desen.reference.web/TextField" },
  hostEvents: { "shell.signInSubmitted": "app.shell/sign-in-submitted@1" },
  catalogSet,
  hostPorts,
  commandEventPorts,
});

if (mounted.status === "mounted") {
  const registered = registerRuntimeComponentCommandTarget(mounted.handle, {
    sourceNodeId: "email",
    capabilityId: "run.desen.reference.web/TextField",
    runtimeInstanceId: "component:email:0",
    snapshot: mounted.snapshot,
  });
  if (registered.status === "registered") {
    executeRuntimeCommandEventAction(
      mounted.handle,
      { type: "component.command", target: "email", command: "focus" },
      resolutionSnapshot,
      registered.snapshot,
    );
  }
}
```

Every optional guard is completed before the action discriminator or any type-specific property is
observed. A valid false guard therefore reads no target, command, event name, payload, token,
effect, or diagnostic callback. For a true guard, command input or event payload shares the same
bounded token session.

The prepared Catalog remains the sole command authority. Static target and command declaration
checks, plus exact live-target selection, happen before command input is inspected. Resolved input
is detached and validated through the exact `component-command-input` contract before the generic
dispatcher receives only inert identity and JSON data. Host denial is distinct from success, and
an undeclared command can never become arbitrary method access.

`event.emit` selects an exact allowlisted name and opaque application contract before payload
observation. Omitted payload becomes `{}`. The bridge validates the detached payload under that
contract before calling emit; invalid, denied, and adapter-failed outcomes never become success.
These shell events are intentionally separate from Catalog-declared component and behavior events,
which now travel from an adapter into DESEN through the M04-T14 boundary below.

Registration, action, and snapshot generations; total live targets; static components; host event
contracts; and retained identifier lengths are finite and may only be lowered by a trusted host
profile. Snapshot capacity is reserved so every accepted registration ticket retains a future
unregister transition. Hostile reflection and every callback boundary recheck the exact manager
snapshot and lifetime. Disposal wins over a callback result, revokes all tickets, and leaves only
minimal tombstones.

## M04-T13 bounded action-turn API

`prepareRuntimeActionProgram` detaches and recursively freezes the accepted action prefix before
admission. A private route maps each prepared slot to exactly one M04-T10, M04-T11, or M04-T12
child executor; callers cannot forge a runnable program or select a child through a structural
lookalike. The preparation boundary observes at most 64 executable indices and records an overflow
marker without touching the 65th entry or any later suffix.

`mountRuntimeActionTurns` claims the exact current state, resource, operation, and command/event
authorities for one surface-local coordinator. Child action executors are surrendered exclusively,
so direct use or drift fails closed. `executeRuntimeActionTurn` admits a prepared depth-zero event
turn and returns either a `started` or reentrant `queued` result with a native completion Promise
that always fulfills with controlled immutable data. The coordinator refreshes all four current
snapshots before every ordered slot while preserving the turn's lexical context, item,
environment, and immediate event payload.

Started turns, reentrant admissions, and asynchronous operation settlements share one finite FIFO.
A false guard records `skipped` and continues; a controlled child failure stops before observing
the next action. Successful navigation terminally ends the old surface and resolves queued
old-surface work without dispatching it. Each operation settlement becomes a distinct turn at its
captured ancestry depth with `event` unavailable. Its selected success or failure program cannot
rewrite the already published operation result.

Every observed M04-T11 settlement ticket crosses exactly one finalization attempt from a `finally`
path, including empty handlers, controlled failure, overflow, navigation, disposal, and unexpected
internal failure. A private ticket-keyed one-shot guard is recorded before the lower finalizer
call. Native completion Promises and immutable emergency values are reserved at admission, while
operation and resource settlement callbacks contain synchronous throws, returned-Promise
rejections, and attachment failures. The default Reference Profile accepts the 64th action, 16th
settlement level, and 64th synchronous transition; the next one stops with the stable
`ACTION_LIMIT_EXCEEDED` diagnostic. Trusted profiles may lower queue, retained-action,
retained-code-unit, generation, action, depth, and transition ceilings but cannot raise or remove
them. `disposeRuntimeActionTurns` terminally closes the coordinator and every surrendered child
authority while fulfilling all previously accepted event-turn completions.

## M04-T14 generic adapter-bridge API

`createRuntimeAdapterBridgePorts` creates an opaque bridge handle and one generic component-command
port before M04-T12 mounts. `bindRuntimeAdapterBridges` then accepts only the exact current M04-T12
Catalog, snapshot, port owner, callback owner, document, revision, and surface. The two phases
prevent a caller from substituting a structurally equal Catalog or reusing the same callback under
a foreign command/event port owner.

`registerRuntimeAdapterBinding` registers either a component with its exact factory identity and
repeat scope or a behavior attached to one exact current component ticket. Behaviors must satisfy
their Catalog `attachTo` capability-or-category rule. Every ticket is opaque and generation-bound;
forged, foreign, stale, and ABA-equivalent values fail closed. Scope aliases and repeat keys are
detached under aggregate occurrence/code-unit budgets, and behaviors share their owner's immutable
projection without double charging it. Registration also reserves enough snapshot capacity for
all accepted live bindings to unregister.

`receiveRuntimeAdapterEvent` proves current snapshot, ticket, behavior owner, M04-T12 authority,
and Catalog event declaration before observing a payload. It invokes the exact Catalog payload
validator once and rechecks every authority afterward. A handled event reaches the supplied turn
port only as detached JSON plus an inert handler selector; raw action arrays, component targets,
callbacks, and platform objects never enter the request. `unregisterRuntimeAdapterBinding`
cascades owned behaviors, while `disposeRuntimeAdapterBridges` cleans current same-origin M04-T12
targets, revokes the former authority, tombstones tickets, clears retained graphs, and publishes a
minimal terminal handle tombstone.

The default bridge profile bounds live bindings, handler names, generations, retained identifiers,
retained scope occurrences and code units, and runtime-instance identifier length. Trusted
profiles may lower but cannot raise these limits. Transition, active-command, event-reflection, and
event-dispatch fences keep mutation and disposal busy around hostile callbacks while nested event
admission remains available for M04-T16 FIFO composition.

## M04-T15 reactive reevaluation and stale-settlement API

`createRuntimeReactiveHostPorts` must be called before resource and operation managers mount. It
captures the complete host aggregate, preserves every non-settlement callback by identity, and
replaces only resource loading and operation invocation with a stale-safe settlement boundary.
Synchronous and promise-like host outcomes are adopted into native Promises, copied through the
shared bounded JSON profile, and reduced to one exact frozen success, candidate public-failure
(`failed`), or denial envelope. Throws, rejections, malformed shapes, accessors, cycles, reflection
failures, and unsafe values expose no raw reason. The wrapper does not decide whether a candidate
error code is Catalog-declared; the M04-T08/M04-T09 lifecycle manager performs that validation. If
a Proxy or thenable reenters and starts a refresh or replacement while an older result is being
copied, the lower manager observes that newer attempt before the now-inert old envelope can arrive,
so the old result cannot overwrite it.

`mountRuntimeReactiveReevaluation` authenticates exact current state, resource, and operation
snapshots and subscribes once to context and environment invalidation notices. It deliberately
uses the whole-surface strategy permitted by DESEN 0.1.0. Every evaluation rereads and twice
confirms complete host snapshots and lower-manager identities, creates one factory-authenticated
seven-namespace resolution snapshot, and calls one synchronous evaluator. The evaluator receives
immutable data plus the token-only materialization port; it receives no state handle, lifecycle
handle, complete host aggregate, framework target, or platform object.

`invalidateRuntimeReactiveReevaluation` represents one complete trusted mutation or action-turn
batch and requires the exact current observable snapshot. Reentrant notices coalesce into a single
dirty bit under a finite synchronous drain. Before inspecting an evaluator result and again after
bounded detachment, the coordinator rechecks invalidation generation, lower snapshot identity, and
context/environment bytes. Stale candidates are discarded; a current throw or invalid result
publishes an inactive outcome instead of retaining an old subtree. Byte-identical output retains
the exact existing snapshot. The final configured snapshot generation is reserved for a terminal
limit outcome, so generations never wrap or represent two different observable states.
`disposeRuntimeReactiveReevaluation` revokes first, unsubscribes both notices exactly once, clears
retained authorities, and leaves late callbacks inert.

This API has two explicit trusted-composition preconditions that M04-T16 proves end to end: the
lower resource and operation managers must have been mounted with the same reactive host aggregate,
and their state/settlement/action-turn changes must produce one explicit invalidation. T15 does not
claim complete validated-tree materialization, event or item provenance, selector-to-program
joining, conditional descendant cleanup, or coordinated session disposal. Observable
whole-surface execution is now the M04-T16 reference oracle; dependency-index equivalence,
optimization, and performance comparison remain M12-T05. Concrete React reconciliation,
remount-required properties, DOM, focus, accessibility, and production adapter parity remain M05.
The frozen 0.1.0 token port has no subscription, so token values refresh only when another admitted
invalidation causes reevaluation.

## M04-T16 complete headless session API

`materializeRuntimeHeadlessSurface` converts one execution-validated immutable surface into a
complete framework-neutral plan. It applies conditional presence before descendant work, expands
repeats through authenticated item scopes, evaluates ordered variants, materializes props and
styles, and derives stable component and behavior identities. The plan contains JSON only and is
bounded by lower-only node, depth, repeat, occurrence, and UTF-16 ceilings.

The materializer returns canonical plan and binding digests together with an opaque private
sidecar. Only the compact commitment crosses the M04-T15 evaluator boundary. The sidecar retains
the exact evaluation id, item/repeat scope, and inert handler selectors needed by the trusted
session compositor; its internal reader is deliberately absent from the package root.

`mountRuntimeHeadlessSession` accepts unknown Bundle and Catalog values, performs cumulative
execution validation, recalculates the Bundle revision, and mounts the entry surface through one
shared reactive host aggregate. It prepares every handler as a bounded M04-T13 program before
publishing adapter bindings. A plan becomes observable only after the exact T15 evaluation id and
both commitment digests authenticate the sidecar and binding reconciliation succeeds.

A successful mount returns `handle`, the generation-zero JSON-only `snapshot`, and `catalogSet`.
`catalogSet` is the exact validated execution-Catalog authority retained by the session: raw
Catalog callers do not need to validate a second time, while callers that supplied an already
validated set receive that same reference back. Framework adapters must use this returned reference
because a separately revalidated byte-equal Catalog set is intentionally a different authority.
The Catalog set never becomes part of the serializable session snapshot, and adapter
authentication still returns only the current public snapshot.

`dispatchRuntimeHeadlessSessionEvent` requires the exact current factory-created session snapshot
and runtime binding. T14 validates the declared event payload and supplies the component or
behavior origin; the session then selects one prepared program and constructs state, context,
resource, operation, event, item, and environment namespaces from their current authenticated
owners. The caller cannot inject any of those namespaces. The returned completion promise contains
only a terminal JSON observation, never a lower-manager ticket or callback authority.

`readRuntimeHeadlessSession` exposes one recursively immutable JSON snapshot with the verified
revision, active surface, monotonic generation, evaluation id, plan/binding commitments, complete
plan, lifecycle namespaces, and inert binding summaries. Equivalent frozen sign-in inputs and
event sequences produce byte-identical canonical traces across independent sessions.
`subscribeRuntimeHeadlessSession` adds a framework-neutral external-store notification boundary:
it performs no initial callback, invokes argument-free listeners only after the publishing stack
unwinds, and may coalesce synchronous changes because consumers always reread the exact snapshot.
The factory-created subscription authority is revoked explicitly with
`unsubscribeRuntimeHeadlessSession`; revocation is idempotent and safe inside a listener. A hostile
listener cannot block another, and every still-live listener receives the terminal disposal
change. This is directly compatible with React `useSyncExternalStore` while keeping the snapshot
itself callback-free and independent of React.
`disposeRuntimeHeadlessSession` revokes reactive work, adapter bridges, the action coordinator, and
its surrendered children in dependency order; repeated disposal and late settlements are inert.
Disposal requested reentrantly from an adapter or host callback finishes T14-before-T13 cleanup
after the callback unwinds. A current non-active or terminal T15 result also ends the complete
session instead of leaving an indefinitely stale snapshot publicly marked live.

T13 publishes every generic operation and resource settlement to the trusted session compositor
after recursive settlement work and mandatory ticket finalization leave the synchronous FIFO.
Each asynchronous effect reserves finite publication capacity before it starts; completed
settlements enter an ordered internal FIFO and produce exactly one internal notice each, including
multiple same-kind completions observed in one tick. Only the public external-store layer may
coalesce those notices because its consumers reread the exact latest snapshot.
The compositor authenticates the still-current surface before reevaluation, so a late old-surface
completion cannot publish into a replacement surface. An unexpected T13 self-disposal is also
forwarded terminally; the complete session then fails closed instead of leaving an old public
snapshot marked live.

The default complete-session profile separately bounds active component nodes, component-plus-
behavior bindings, and handled-event declarations at 5,000 each, plus 256 live external-store
subscriptions. Tree depth, surface transitions, observable generations, retained plan occurrences,
and retained plan code units have independent lower-only ceilings; a trusted host may lower but
never widen any of them. An unsubscribe immediately releases its subscription slot.

The official sign-in profile covers editing, loading, declared failure, retry, stale replacement,
success navigation, independent home-surface materialization, and a recursively nested generic
operation settlement. The API does not render React, DOM, CSS, accessibility, focus, or native UI;
concrete adapter reconciliation remains M05.

## Port invariants

- Operation and resource input reaches a host implementation only after runtime resolution and
  schema validation. M04-T08 and M04-T09 detach and validate resource and operation output and
  public error codes before exposure.
- A policy denial is distinct from a declared public failure and can never be reported as success.
  Thrown or rejected host exceptions are adapter failures; raw errors never become lifecycle data.
- Navigation can target only an existing surface in the active Bundle. Denial cannot substitute a
  different surface, and external URL navigation is not part of the core port.
- Token `missing` is distinct from a resolved JSON `null`. The core never guesses a replacement or
  owns the host's token document. Token technical failures are redacted `ADAPTER_FAILURE` outcomes.
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
defines bounded literal/reference/fallback resolution; and M04-T03 adds token and deterministic
string-format materialization without changing the earlier deferral primitive. M04-T04 adds the
closed predicate evaluator and fail-closed conditional-presence decision. M04-T05 now composes its
prepared positions with M04-T03 for ordered Variant conditions, then returns effective raw prop and
style ValueSpecs with exact winning provenance. M04-T06 adds fresh atomic surface-local state,
complete schema-safe writes, terminal disposal, and repeat-free base node identity. M04-T07 adds
lexically isolated repeat scopes, ordered atomic materialization, type-sensitive keys, bounded
non-truncating overflow, and repeated instance identity. M04-T08 adds atomic resource mount/start,
token-aware input materialization, schema-safe settlement, bounded transport scheduling,
latest-wins refresh, and terminal disposal. M04-T09 adds Catalog-authoritative operation aliases,
exact input/output validation, deterministic reject/replace/FIFO queue behavior, bounded
transports, and settlement acknowledgement. M04-T10 adds guard-first one-action state mutation and
same-Bundle navigation with shared token observation, exact snapshot authorization, hostile
callback containment, and terminal navigation disposal. M04-T11 adds nonblocking guarded operation
and resource actions, acceptance-time settlement branches, bounded handler retention, and opaque
acknowledgement tickets without exposing raw leases. M04-T12 adds Catalog-authorized generic
component commands, ambiguity-safe live-target registration, and allowlisted application-event
validation/emission through a separate synchronous bridge. M04-T13 adds immutable prepared
programs, deterministic ordered action turns, reentrant and settlement FIFO admission, exact
settlement ancestry and one-shot finalization, and finite action, depth, transition, queue,
retention, and generation bounds. M04-T14 adds exact T12-bound generic component/behavior
registrations, one-shot command provenance, Catalog payload validation, owner-bound behaviors,
bounded scope retention, reentry containment, and terminal cross-manager cleanup. Reactive
composition now adds a stale-safe host settlement boundary, whole-surface consistent snapshots,
explicit batched invalidation, pre/post-reflection generation checks, current-failure
deactivation, finite synchronous draining, and exact-once subscription disposal in M04-T15.
M04-T16 now composes those boundaries into one validated, bounded headless session with complete
JSON-only materialization, authenticated selector-to-program dispatch, deterministic sign-in
traces, independent surface navigation, and coordinated disposal. Rendering, concrete framework
reconciliation, and activation remain assigned to later tracked tasks.

## Protocol and target support

- Protocol baseline: DESEN 0.1.0
- Target: platform-neutral

## Quality

Use the focused runtime tests and root workspace quality gate:

```bash
pnpm --filter @desen/runtime-core test:host-ports
pnpm --filter @desen/runtime-core test:value-resolution
pnpm --filter @desen/runtime-core test:token-format-resolution
pnpm --filter @desen/runtime-core test:predicate-evaluation
pnpm --filter @desen/runtime-core test:variant-style-evaluation
pnpm --filter @desen/runtime-core test:local-state-identity
pnpm --filter @desen/runtime-core test:repeat-materialization
pnpm --filter @desen/runtime-core test:resource-lifecycle
pnpm --filter @desen/runtime-core test:operation-lifecycle
pnpm --filter @desen/runtime-core test:state-navigation-actions
pnpm --filter @desen/runtime-core test:operation-resource-actions
pnpm --filter @desen/runtime-core test:command-event-actions
pnpm --filter @desen/runtime-core test:action-turns
pnpm --filter @desen/runtime-core test:adapter-bridges
pnpm --filter @desen/runtime-core test:reactive-reevaluation
pnpm --filter @desen/runtime-core test:headless-sign-in
pnpm verify:runtime-core-host-ports
pnpm verify:runtime-core-value-resolution
pnpm verify:runtime-core-token-format-resolution
pnpm verify:runtime-core-predicate-evaluation
pnpm verify:runtime-core-variant-style-evaluation
pnpm verify:runtime-core-local-state-identity
pnpm verify:runtime-core-repeat-materialization
pnpm verify:runtime-core-resource-lifecycle
pnpm verify:runtime-core-operation-lifecycle
pnpm verify:runtime-core-state-navigation-actions
pnpm verify:runtime-core-operation-resource-actions
pnpm verify:runtime-core-command-event-actions
pnpm verify:runtime-core-action-turns
pnpm verify:runtime-core-adapter-bridges
pnpm verify:runtime-core-reactive-reevaluation
pnpm verify:runtime-core-headless-sign-in
pnpm check
```
