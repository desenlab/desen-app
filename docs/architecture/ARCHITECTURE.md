# Architecture

## System responsibility

The implementation keeps four authorities separate:

1. The protocol defines valid data and observable semantics.
2. Capability packages define trusted component, behavior, operation, and resource contracts.
3. Desen App owns editable design source for managed surfaces.
4. A host application owns executable code, authorization, integrations, and activation policy.

```mermaid
flowchart LR
  C["Capability packages"] --> A["Desen App"]
  A --> S["DESEN Source"]
  S --> P{"Publisher"}
  P -->|"valid"| B["Immutable bundle store"]
  P -->|"invalid"| D["Node-linked diagnostics"]
  B --> CH["Mutable channel pointer"]
  CH --> H["Independent reference host"]
  C --> H
  H --> LKG["Last-known-good cache"]
```

## Dependency direction

Cross-package imports are deny-by-default. A package may use relative imports within itself and
only the internal packages listed below:

| Package                 | Allowed internal dependencies                                                          |
| ----------------------- | -------------------------------------------------------------------------------------- |
| `protocol`              | none                                                                                   |
| `validator`             | `protocol`                                                                             |
| `publisher`             | `protocol`, `validator`                                                                |
| `catalog-sdk`           | `protocol`                                                                             |
| `runtime-core`          | `protocol`, `validator`                                                                |
| `runtime-react`         | `protocol`, `runtime-core`                                                             |
| `runtime-web`           | `protocol`, `validator`, `runtime-core`                                                |
| `editor-core`           | `protocol`, `validator`                                                                |
| `editor-web`            | `protocol`, `validator`, `catalog-sdk`, `editor-core`, `runtime-core`, `runtime-react` |
| `reference-catalog-web` | `protocol`, `catalog-sdk`, `runtime-react`                                             |
| `testkit`               | implementation package public APIs, except the `desen` facade                          |
| `desen`                 | protocol, validation, publication, runtime, catalog, and dedicated test APIs           |

Applications are composition roots but still have explicit allowlists. The reference host cannot
import editor or publisher packages, and the control plane cannot import renderer or editor
packages. Packages never import applications. Production package source never imports `testkit`;
only test code and the future dedicated `desen/test` facade may expose it.

`dependency-cruiser.config.cjs` is the executable authority for this table. Any new edge requires
an architecture review, a matching documentation change, and a negative boundary fixture.

`runtime-core` accepts a verified bundle, exact catalog set, and host ports. It produces
JSON-serializable state snapshots, diagnostics, and render plans. `runtime-react` translates those
plans into registered React components. This keeps protocol execution semantics reusable by a
future native renderer.

`catalog-sdk` owns only framework-neutral catalog documents, manifest builders, schema-derived
types, and contract derivation. A target capability package may publish inert parity metadata, but
a target renderer owns executable adapter registration; `runtime-react` therefore owns React
component adapter types and registries. A catalog package may depend on both, but React types never
cross the `catalog-sdk` public boundary. ADR 0007 records why parity metadata precedes, but never
replaces, the M05 registry.

## Reference capability artifact boundary

M03-T10 packages the exact reference sign-in slice as
`run.desen.reference.sign-in@0.1.0` for `web-react`. Its logical content-addressed artifact contains
the projected canonical Catalog and every regular file in the target package's clean `dist/**`
tree. JavaScript, declarations, and both source-map forms are included by path and exact bytes.
Two isolated builds and the workspace build must expose the same complete inventory and bytes.

The generated `catalog.json` is an inert, explicitly exported package data file. Its
`packageDigest` is calculated over the Catalog projection and distribution inventory; the final
digest and tuple are not embedded in a fingerprinted JavaScript file. The boundary deliberately
does not claim an npm archive, dependency closure, signature, distributor, or activation policy.
Those are later release and runtime responsibilities.

This artifact proves a stable contract-to-bytes identity but does not perform component lookup.
Executable registry construction, render-plan materialization, event bridging, command dispatch,
and operation execution remain owned by M05 and the host composition roots.

## Applications

### Desen App

The visual authoring product. It edits a DESEN Source directly, renders production adapters in the
canvas, provides schema-driven controls, switches between Design and Run modes, and sends valid
sources to the publisher.

### Reference Host Web

A separately built production-like application. It knows no authoring UI and contains no manual
managed-screen composition. It fetches a channel, verifies and stages a bundle, resolves exact
capabilities, then atomically activates it.

### Control Plane API

A small local-first service with three conceptual stores:

- editable sources;
- immutable bundles keyed by revision; and
- mutable channel pointers such as `preview` or `production-proof`.

Storage details are replaceable through repositories. The proof may begin with SQLite and local
immutable files; production storage is intentionally deferred.

### DESEN Developer Platform (`desen.run`)

The future developer documentation application. It will publish versioned protocol snapshots,
SDK guides, API reference, conformance results, compatibility tables, security guidance, and an
App-independent host integration quickstart. It is a developer surface, not a separate visual
authoring product.

## Platform-neutral host ports

The core receives capabilities through explicit interfaces for:

- operations and resources;
- navigation;
- tokens and environment values;
- storage and active-revision persistence;
- clock and scheduling;
- diagnostics; and
- platform adapter lookup.

No core API accepts `ReactNode`, DOM events, selectors, class names, arbitrary HTML, or executable
functions inside a DESEN document.

## Runtime value boundary

The runtime composes one factory-branded, detached, recursively frozen snapshot for `state`,
`context`, `resource`, `operation`, `event`, `item`, and `env`. Those maps come from an already
validated active surface and the current evaluation turn; the snapshot factory enforces inert
data, exact lifecycle/event envelopes, and limits rather than reopening the Bundle or Catalog.

Literal/reference/fallback resolution produces exactly one complete JSON candidate or an explicit
unresolved, invalid, or deferred result. Missing differs from JSON `null`; fallback cannot invent
an absent declaration root or revive an inactive event scope. References traverse own object
properties but never arrays, never trigger writes or host effects, and never evaluate
reference-shaped scope data a second time.

Snapshot input, ValueSpec input, and the final composed output all share the same bounded profile.
The output is detached and budgeted again so repeated references cannot amplify individually legal
values past depth, node-occurrence, or string limits. Exact consumer-schema validation still runs
after resolution and before any value reaches a target adapter.

Token and string-format materialization is an additive layer over that preserved reference
primitive. It receives the branded snapshot together with an explicit trusted token port and
request context; it never discovers a global provider or owns a token document. One top-level
materialization performs one lookup per unique opaque token name in deterministic traversal order,
then reuses the detached immutable outcome. Missing is reported as a token-specific
`REFERENCE_UNRESOLVED`; thrown callbacks, malformed outcomes, and unsafe provider values fail with
a redacted `ADAPTER_FAILURE`.

Formatting uses the closed PF-017 single-pass `{name}` grammar. Nested values materialize in the
same snapshot and token context, raw strings are inserted unchanged, and every other JSON value is
encoded as RFC 8785 canonical JSON. Formatting performs no expression, prototype, locale, markup,
or platform evaluation. Any child failure rejects the complete composite, and the expanded output
is detached and checked against the same safety limits. It remains a candidate until the exact
consumer schema is validated at the M05 adapter boundary.

## Runtime predicate and presence boundary

Predicate evaluation is a data-only layer over the same factory-branded resolution snapshot. The
core recognizes exactly the thirteen DESEN 0.1.0 operators: `all`, `any`, `not`, `eq`, `neq`, `gt`,
`gte`, `lt`, `lte`, `in`, `contains`, `exists`, and `truthy`. It accepts no expression text,
callable resolver, property accessor, capability implementation, or platform object.

Every predicate is detached and validated completely before evaluation. Its operands are then
resolved against one immutable snapshot and evaluated depth-first from left to right without
short-circuiting. This keeps dynamic type diagnostics complete and in stable document order even
when an earlier `all` or `any` argument already determines the boolean result. A direct unresolved
ValueSpec makes its current predicate false; a nested predicate that completed with false remains a
normal boolean operand for its parent. Runtime type mismatches likewise make their current
predicate false and emit `PREDICATE_TYPE_MISMATCH` at the exact argument pointer.

`eq`, `neq`, and array membership use RFC 8785 canonical JSON identity. String ordering and
substring membership use exact UTF-16 code-unit semantics without locale collation, normalization,
or case folding. `exists` probes the original `$ref` without selecting its fallback and treats
resolved JSON `null` as existing.

The M04-T04 entry point remains deliberately T02-only. Token and format operands retain an exact
`deferred` result; they are not coerced to false and they do not introduce an executable resolver
callback. M04-T05 composes those prepared operand positions with the M04-T03 materializer through
package-internal data outcomes.

Conditional presence is an instantiation boundary, not a styling instruction. An omitted `when`
is present, an evaluated false predicate is absent, and invalid or deferred input remains absent
fail-closed under a distinct status. An absent node's descendants must not be mounted. Reactive
reevaluation belongs to M04-T15, while M04-T16 proves that complete headless materialization leaves
no descendant resource, behavior, event, or command active.

Predicate input and the aggregate of resolved operand occurrences share the runtime depth,
JSON-occurrence, and UTF-16 budgets. The tree adds a 64-predicate-node ceiling (root plus 63 nested
nodes) and a 4,096-argument-occurrence ceiling while preserving the protocol's 64-argument
per-operator maximum. Each resolved operand is charged immediately in document order; the first
invalid/deferred terminal retains precedence, and a budget crossing stops before later values are
copied. Results and diagnostics are recursively immutable and expose no partial boolean on
malformed, hostile, deferred, or over-budget input. This layer remains independent of React, React
Native, DOM, CSS, browser APIs, and application code.

## Activation sequence

```text
fetch channel
  → fetch immutable bytes
  → verify protocol and revision
  → resolve exact catalog packages
  → preflight references and limits
  → stage runtime indexes
  → durably store verified immutable bytes
  → atomically commit {active revision, previous-good revision, generation}
  → expose the committed active snapshot in memory
```

The durable activation record and the previous-good pointer are one transaction, not two writes.
The runtime must not expose the staged revision before that transaction commits. A failure or
crash before commit leaves the prior activation record untouched. A crash after commit but before
the in-memory notification recovers the committed revision on restart; it never constructs a
partially updated pointer set.

Concurrent activations use an expected generation or equivalent compare-and-swap guard so a stale
stage cannot overwrite a newer committed revision. Fault-injection tests cover failure before
every stage, transaction abort and quota failure, crash immediately before and after commit, stale
concurrent writers, and restart recovery.

## Mobile expansion

DESEN 0.1.0 proves exactly `web-react`. A future native implementation adds a target-specific
catalog and renderer while reusing protocol-observable trace vectors. It does not assume that Web,
iOS, and Android components are identical or that one source automatically has pixel-identical
output across platforms.
