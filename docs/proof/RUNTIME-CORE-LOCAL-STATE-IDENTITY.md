# Runtime Core Local State and Base Node Identity

## Claim

M04-T06 implements a bounded, framework-neutral lifecycle for fresh surface-local state and a
stable repeat-free node-identity primitive over the frozen DESEN 0.1.0 protocol.

Every mounted initial and every accepted write is validated against the complete state-entry schema
with `complete` and `resolved-value` semantics. An invalid declaration or write exposes no partial
state. The identity primitive produces a collision-free structured key and makes preservation,
remount, and replacement eligibility explicit without claiming that an adapter has preserved a
platform instance.

This task changes no frozen protocol byte and adds no persistence, action dispatcher, repeat
materializer, reactive scheduler, framework adapter, browser behavior, or native-platform behavior.

## Reviewed ownership

| Evidence class       | Exact M04-T06 ownership                                                         |
| -------------------- | ------------------------------------------------------------------------------- |
| Pipeline step        | `PIPE-018` headless local-state initialization and lifecycle primitive          |
| Prose rule           | `R-054` runtime state primitive; `R-104` repeat-free base-identity slice        |
| Diagnostic           | `D-019` / `STATE_WRITE_INVALID` runtime rejection                               |
| Normative obligation | `N-024` complete-entry schema validity after every accepted write               |
| Finding              | `PF-019` path ambiguity; `PF-036` deterministic state and base-identity profile |

`R-104` remains shared with M04-T07 and M05-T05 because repeat-instance identity and actual adapter
preservation are not part of this task. Action execution and disposal after successful navigation
remain M04-T10; reactive orchestration remains M04-T15.

No proof-gate status changes. P-17 remains `PARTIAL`.

## Public API

The runtime package root exposes six functions:

```ts
mountRuntimeSurfaceState(input);
readRuntimeSurfaceState(handle);
writeRuntimeSurfaceState(handle, input);
disposeRuntimeSurfaceState(handle);
createRuntimeNodeIdentity(descriptor);
reconcileRuntimeNodeIdentity(previousIdentity, nextDescriptor);
```

Twenty documented public types describe declarations, opaque handles, immutable snapshots,
complete result unions, deterministic issues and rejections, node descriptors, branded
identities, and reconciliation decisions.

Handles and identities are authenticated by factory-private runtime brands and compile-time opaque
members. A same-shaped caller object cannot gain state authority or masquerade as a prior node
identity. The public package exports no mutable store, schema registry, adapter instance, action
callback, or persistence hook.

## Fresh, atomic state mount

`mountRuntimeSurfaceState` accepts one exact surface identifier and a declaration map. The complete
input first crosses the M04-T02 inert snapshot boundary, which rejects executable values,
accessors, promises, symbols, cycles, unsupported prototypes, sparse or decorated arrays,
non-finite numbers, reflection failures, and data beyond the shared runtime limits.

Every declaration has exactly `schema`, `initial`, and optional opaque `extensions`. Before a
handle exists, the runtime:

1. checks the copied schema with the generated Draft 2020-12 meta-schema validator seam;
2. rejects every explicit `$vocabulary` declaration because the interpreter does not claim
   vocabulary-dependent assertion behavior;
3. validates the bounded schema graph without fetching remote references; and
4. applies the schema to the entire initial value in `complete` and `resolved-value` mode.

The `$vocabulary` fence prevents a schema from declaring `format-assertion` while the current
interpreter treats `format` as a Draft 2020-12 annotation. One malformed schema or invalid initial
rejects the whole declaration set, with no handle, snapshot, or partially mounted entry.

A successful mount returns generation zero and a recursively immutable detached value map. It
reads no prior state and shares no live authority with an earlier mount of the same surface. The
map can directly supply the `state` namespace of the existing seven-namespace resolution snapshot.

## Schema-safe writes

`writeRuntimeSurfaceState` accepts only an already resolved inert JSON value and one dot-delimited
path. It does not accept or execute ValueSpecs, guards, toggles, navigation, commands, callbacks, or
action arrays.

Per `PF-019`, the substring before the first dot is always the complete state-entry name. The
runtime performs no longest-prefix search or backtracking lookup, even when a declaration name
itself contains dots. A root-only path replaces the complete entry. A nested path traverses only
existing own object properties; arrays are never indexed and missing intermediate containers are
never invented. The final property may be created only when the resulting complete entry remains
schema-valid.

The candidate is constructed outside live state and validated against the exact prepared entry
schema using `complete` and `resolved-value`. The complete aggregate state then crosses the bounded
snapshot boundary again. Only after all checks pass does one different candidate replace the
current snapshot and advance the generation exactly once.

An invalid candidate returns `STATE_WRITE_INVALID` without exposing or retaining a partial value.
The exact prior snapshot and generation remain current. A canonically identical candidate returns
`unchanged` and does not advance the generation. RFC 8785 canonical equality makes object-member
order and negative zero non-observable while preserving array order and JSON value distinctions.
Property names such as `$ref`, `$token`, `$format`, `__proto__`, and `constructor` remain inert
resolved data and cannot trigger evaluation or prototype mutation.

## Read and disposal lifecycle

`readRuntimeSurfaceState` returns the exact current immutable snapshot for an active authentic
handle. Values never appear on the handle itself.

`disposeRuntimeSurfaceState` is terminal and idempotent. The first call removes the live schemas
and current snapshot behind the handle; later reads and writes report disposal, and a later dispose
reports `already-disposed`. A fresh mount begins again from the declared initials at generation
zero.

A caller-retained old snapshot remains an immutable historical observation. Secure erasure of an
already returned JavaScript value is not claimed. Deciding whether navigation succeeded and should
trigger disposal belongs to the later action-turn implementation.

## Stable repeat-free node identity

`createRuntimeNodeIdentity` copies and validates the exact data-only descriptor:

```text
documentId
surfaceId
nodeId
use
```

The stable structured key is the RFC 8785 canonical byte representation of the exact
`[documentId, surfaceId, nodeId]` tuple. Revision, tree position, component capability, props,
style, and adapter state do not enter this base key. Exact strings are never trimmed, case-folded,
or Unicode-normalized.

Capability identifiers are recognized by a bounded linear parser equivalent to the frozen
capability-ID pattern. The runtime does not directly execute the pattern's redundant dotted group,
which can cause catastrophic backtracking in a JavaScript regular-expression engine.

Reconciliation has three successful decisions:

| Decision            | Meaning                                                                  |
| ------------------- | ------------------------------------------------------------------------ |
| `preserve-eligible` | Same tuple and same `use`; returns the exact prior identity by reference |
| `remount-required`  | Same tuple but changed `use`; increments the mount generation            |
| `replace-required`  | Changed document, surface, or node tuple; creates a fresh base identity  |

Eligibility is a headless compatibility decision, not proof that a framework preserved a
component instance. Repeat keys and aliases remain M04-T07. Adapter-declared remount policy and
actual platform-instance preservation remain M05-T05.

## Bounds and hostile input

State declarations, write candidates, snapshots, and node descriptors retain the shared M04-T02
limits:

| Limit               | Accepted maximum |
| ------------------- | ---------------- |
| Nesting depth       | 128              |
| JSON occurrences    | 4,096            |
| String UTF-16 units | 1,048,576        |

Schema interpretation additionally retains its bounded graph and evaluation profile. Malformed
Draft syntax, unsupported schema dialects and vocabularies, external references, unresolved
schema obligations, hostile property names, over-budget candidates, forged handles or identities,
and identity-generation overflow all fail closed.

The runtime implementation imports no React, React Native, DOM, CSS, browser, Node, application,
locale, A2UI, dynamic-code evaluator, or persistence dependency.

## Deterministic evidence

Evidence covers:

- all-or-nothing mount, fresh lifetimes, generation-zero values, and M04-T02 resolver composition;
- malformed schema syntax, unsupported dialect and vocabulary declarations, graph failures, and
  invalid initials before handle creation;
- complete root replacements, nested writes, schema-approved final-property creation, and exact
  `PF-019` first-segment behavior;
- missing parents, array traversal, unknown roots, malformed paths, and hostile requests without
  partial state;
- complete post-write conditional-schema validation in `resolved-value` mode;
- byte-identical state after rejection and reference-identical snapshots after canonical no-ops;
- terminal idempotent disposal, caller-retained historical snapshots, and fresh remounts;
- factory authentication, immutable results, and compiler-negative opaque-authority cases;
- structured base keys, exact-string identity, preservation, capability-change remount, and tuple
  replacement;
- linear capability parsing against a frozen-pattern backtracking adversary;
- public exports, built declarations, TSDoc, package seams, and platform-neutral imports;
- direct `PIPE-018`, `R-054`, `R-104`, `D-019`, `N-024`, `PF-019`, and `PF-036` traceability; and
- prerequisite drift, deterministic receipt bytes, mutation detection, and safe atomic writes.

The artifact depends on the exact verified M04-T02 evidence:

```text
docs/proof/artifacts/runtime-core-0.1.0-value-resolution.json
sha256:73e4c3d7640eaefd0b45b04b006df3211f0338fafa77293414d43c1052536fea
```

Run:

```text
pnpm generate:runtime-core-local-state-identity
pnpm verify:runtime-core-local-state-identity
pnpm test:runtime-core-local-state-identity
pnpm check
```

Tracked receipt:

```text
docs/proof/artifacts/runtime-core-0.1.0-local-state-identity.json
```

## Explicit non-claims

M04-T06 does not prove:

- execution of `state.set`, `state.toggle`, navigation, guards, or action arrays;
- repeat scopes, aliases, repeat keys, duplicate-key handling, or repeated instance identity;
- resource or operation lifecycles, settlement actions, events, commands, or behaviors;
- reactive reevaluation, stale asynchronous-result protection, or conditional mount orchestration;
- complete node-tree materialization or the M04-T16 headless sign-in trace;
- adapter registration, actual component-instance preservation, React reconciliation, DOM
  rendering, CSS projection, accessibility effects, iOS, Android, SwiftUI, or Compose behavior;
- persistence, navigation success policy, activation, rollback, or last-known-good recovery;
- secure erasure of snapshots already returned to callers;
- assertion semantics for explicitly declared JSON Schema vocabularies; or
- protocol-wide closure of P-17 or G04.
