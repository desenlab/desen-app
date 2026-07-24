# Runtime Core Value-Resolution Evidence

## Claim

M04-T02 defines one framework-neutral, read-only resolver for DESEN 0.1.0 literal values,
references, and fallbacks. Resolution observes one factory-created atomic snapshot containing the
seven declared namespaces:

```text
state
context
resource
operation
event
item
env
```

The resolver returns an explicit complete outcome: `resolved`, `unresolved`, `invalid`, or
`deferred`. A failed or deferred child rejects its complete containing array or object; no partial
value becomes observable.

This task proves value materialization only. It does not validate a resolved candidate against the
schema of a prop, style property, action input, operation/resource value, or adapter boundary. It
also does not execute lifecycle transitions, actions, host callbacks, tokens, or formatting.

## Reviewed ownership

| Evidence class | Exact M04-T02 ownership                                                 |
| -------------- | ----------------------------------------------------------------------- |
| Pipeline step  | `PIPE-020`                                                              |
| Prose rules    | `R-026`, `R-039`, `R-040`, `R-047`, `R-112`                             |
| Invariant      | `A-006`                                                                 |
| Diagnostics    | `D-009` (`PROP_TYPE_MISMATCH`), `D-020` (`REFERENCE_UNRESOLVED`)        |
| Namespaces     | `state`, `context`, `resource`, `operation`, `event`, `item`, and `env` |

The ownership is deliberately task-scoped:

- `PIPE-020` receives the root value-resolution primitive, not the complete M04-T16
  materialization pipeline.
- `R-026` is exercised directly: missing is distinct from every resolved JSON value.
- `R-039` and `A-006` are exercised by a resolver that only observes its snapshot and has no
  operation, resource, navigation, storage, clock, token, or diagnostic callback.
- `R-040` is exercised by exact state roots and array-free own-property traversal.
- `R-047` is only partly composed here. The resolver controls when fallback is selected; the
  consumer still must validate the selected candidate against its target schema.
- `R-112` is only partly composed here. M04-T02 reports an unresolved value without exposing a
  partial result; M05-T02 and M05-T06 still own optional-prop omission, required-node failure, and
  the proof that no invalid value reaches an adapter.
- `D-020` is the exact core code returned for a well-formed reference that cannot resolve.
- `D-009` remains a consumer-schema diagnostic. M04-T02 never emits it and never retries fallback
  after a resolved candidate later fails consumer validation.

This evidence does not advance a Proof Matrix or normative-coverage status. In particular,
`N-023` remains `PLANNED`; `N-026` retains its existing `TESTED` status; and the hostile dynamic
value evidence supplied here is only one input to the still-planned `N-027` composition.

## Atomic reference snapshot

`createRuntimeResolutionSnapshot` copies all seven namespaces through one bounded data boundary
before returning any of them. The returned object is detached from the caller, recursively frozen,
and accepted by `resolveRuntimeValue` only when it carries the factory's private runtime brand. A
type assertion or a look-alike object cannot bypass that boundary.

Declaration provenance is a trust precondition at this primitive: the runtime composes the maps
from an already validated active surface and current evaluation turn. The factory verifies inert
data, envelope shape, detachment, and map presence; it does not independently reopen a Bundle or
Catalog to prove that the caller supplied every and only declared root. Complete materialization
composition remains M04-T16.

The snapshot shape is exact:

| Namespace   | Snapshot contract                                                                 |
| ----------- | --------------------------------------------------------------------------------- |
| `state`     | Own surface-local state roots and their current JSON values                       |
| `context`   | Host-approved, non-secret JSON context                                            |
| `resource`  | Exact public lifecycle envelope for each declared resource root                   |
| `operation` | Exact public lifecycle envelope for each declared operation alias                 |
| `event`     | Explicit `available` payload or `unavailable` marker for the current handler turn |
| `item`      | Exact active repeat aliases and their current JSON values                         |
| `env`       | Host-supplied reserved and profile-defined environment paths                      |

The resource and operation views expose only one of these four exact envelopes:

```text
{ status: "idle",      pending: false }
{ status: "pending",   pending: true }
{ status: "succeeded", pending: false, value: <JSON> }
{ status: "failed",    pending: false, error: { code: <string> } }
```

No provider exception, transport detail, error message, stale success value, or arbitrary
lifecycle envelope field is exposed beside those exact members. A succeeded `value` is still
untrusted JSON; the envelope cannot classify arbitrary nested text as secret or schema-valid.
These envelopes represent one observation; M04-T08 and M04-T09 still own resource/operation
transitions, settlement, concurrency, refresh, and cancellation behavior.

Event availability is explicit so an unavailable handler scope cannot be confused with an
available payload whose resolved value is JSON `null`, `false`, `0`, an empty string, an empty
array, or an empty object.

The factory never consults platform globals or implicitly fills context or environment fields.
Its `context` documentation and shape require non-secret input, but a generic JSON boundary cannot
classify arbitrary strings as credentials. Host policy and the repository-wide secret audit remain
the owners of that guarantee.

## Reference lookup profile

A reference must match the frozen seven-namespace lexical grammar. The second segment is always
the complete root identifier for `state`, `resource`, `operation`, and `item`. The resolver does
not use longest-prefix matching, backtracking, escaping, or prototype lookup; the identifier
ambiguities remain recorded in `PF-019` and `PF-023`.

| Namespace   | Resolution behavior                                                                        |
| ----------- | ------------------------------------------------------------------------------------------ |
| `state`     | Require the exact second-segment root, then traverse own object properties                 |
| `context`   | Traverse the host snapshot from the first path segment after `context`                     |
| `resource`  | Require the exact root; expose only `status`, `pending`, `value[.*]`, or `error.code`      |
| `operation` | Require the exact alias; expose only `status`, `pending`, `value[.*]`, or `error.code`     |
| `event`     | Require an available immediate-handler turn, then traverse the payload                     |
| `item`      | Require the exact active second-segment alias, then traverse own object properties         |
| `env`       | Traverse the complete host-supplied environment snapshot without inventing platform values |

Arrays may be returned as complete resolved values, but reference traversal never enters an array.
There is no numeric-index, `length`, prototype, or array-method path. A lookup through a scalar or
array is missing rather than an object traversal.

Reference values obtained from a scope are already-resolved inert JSON. If the data itself looks
like `{ "$ref": "..." }`, `{ "$token": "..." }`, or `{ "$format": ... }`, that shape is returned
unchanged and is never evaluated a second time.

## Missing, JSON null, and fallback

Missing is a lookup outcome; JSON `null` is an ordinary successfully resolved JSON value. The same
is true for every other falsy value. Therefore:

- JSON null remains resolved and never selects fallback
- `false`, `0`, and `""` remain resolved and never select fallback;
- a missing own property beneath a valid active root may select fallback;
- a lifecycle `value` that is not currently succeeded and an `error.code` that is not currently
  failed are missing and may select fallback;
- an unknown state/resource/operation/item root cannot select fallback;
- an inactive event scope cannot select fallback; and
- an unlisted or malformed lifecycle path cannot select fallback.

In short, unknown roots and inactive scopes cannot be legalized by fallback. Fallback can provide a
value only after a lexically legal lookup reaches an existing scope/root and finds that the
requested runtime value is absent.

A selected fallback is evaluated as a normal `RuntimeValueSpec` against the same atomic snapshot.
Nested failures retain their exact RFC 6901 location below `/fallback`. A successful result records
whether any nested member used fallback.

Fallback is not a schema-recovery channel. Once the primary or fallback resolves, a later consumer
must validate that candidate against the exact target schema. If that validation produces
`PROP_TYPE_MISMATCH`, the runtime does not retry or choose a different fallback.

## Literal composition and complete outcomes

Literal scalars, arrays, and objects resolve recursively. Literal object keys are processed in
deterministic text order and arrays preserve their declared order. A key beginning with `$` is
reserved for an exact recognized value form; unknown reserved keys or mixed/extra members return
an `invalid` outcome.

The public result union keeps four states separate:

| Result       | Meaning                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------ |
| `resolved`   | Complete frozen JSON value plus a `usedFallback` flag                                      |
| `unresolved` | `REFERENCE_UNRESOLVED`, exact `$ref` pointer, reference text, and stable lookup reason     |
| `invalid`    | Hostile, malformed, or over-budget ValueSpec data; no protocol prop-schema claim           |
| `deferred`   | A recognized token or format form whose owning implementation task has not materialized it |

`unresolved`, `invalid`, and `deferred` outcomes expose no `value`. A failed member cannot leak a
partially assembled sibling array or object.

## Token and format fence

M04-T02 recognizes the exact outer structure of `$token` and `$format` so these forms cannot be
mistaken for ordinary literal objects. It returns a `deferred` outcome with an exact form and
pointer instead of guessing their values.

Token and format materialization remains deferred to M04-T03.

M04-T03 must perform token lookup and deterministic string formatting using the appropriate trusted
inputs while preserving the same complete-outcome, safety, and no-partial-value properties.

## Consumer type-validation boundary

The resolver has no Catalog or consumer-schema argument. This is intentional: one reference can be
used by different consumers, and resolution cannot decide whether the resulting JSON is valid for
a particular prop, style property, command input, operation/resource contract, or adapter.

The required composition is:

```text
bounded ValueSpec input
  → resolve against one atomic snapshot
  → require a complete resolved value
  → validate against the exact consumer schema
  → pass only the validated detached value to the consumer
```

M02-T11 already supplies the detached resolved-value primitive for its five execution selectors.
M05 owns component/adapter composition, optional-prop omission, required-node failure, and
`PROP_TYPE_MISMATCH` at the final consumer location. None of those later obligations can be
discharged merely because M04-T02 returned `resolved`.

## Bounded data and hostile-input profile

Both the aggregate snapshot input and each `RuntimeValueSpec` are detached before use through the
same explicit limits:

| Limit               | Accepted maximum |
| ------------------- | ---------------- |
| Nesting depth       | 128              |
| JSON nodes          | 4,096            |
| String UTF-16 units | 1,048,576        |

Accepted records must have a null prototype or an Object-constructor-compatible plain-record
prototype. Ordinary prototype-bearing instances, class instances, and promises are rejected.
Only enumerable own data properties are copied; inherited data is never observable. The boundary
also rejects functions, `undefined`, bigint, symbols, accessors, cycles, sparse or extra-property
arrays, non-enumerable own properties, non-finite numbers, reflection failures, and values beyond
any limit. Accessor descriptors are inspected without reading the accessor value, so getters are
not invoked. Outputs are detached and recursively frozen, and caller mutation after snapshot
creation cannot alter later resolution. The complete composed output is detached and checked again
against all three limits; repeated references therefore cannot amplify individually legal
snapshot/spec inputs into an over-budget node, string, or depth result.

This is a data-containment profile, not a general JavaScript membrane. Inspecting an arbitrary
`Proxy` can necessarily execute its reflection traps. Trap exceptions and unsafe reflected shapes
are contained and fail closed, but the implementation does not claim that arbitrary Proxy code
cannot run or that every adversarially spoofed custom prototype is detectable. Callers must not
treat untrusted executable JavaScript objects as inert merely by passing them to this API.

The resolver accepts no host ports and invokes no resource, operation, navigation, storage, token,
clock, diagnostic, or application callback. Its observable operation is limited to detached input
inspection and resolution against the supplied immutable snapshot.

## Public API

The M04-T02 slice contributes:

- `RUNTIME_VALUE_SAFETY_LIMITS`;
- `createRuntimeResolutionSnapshot`;
- `resolveRuntimeValue`;
- the recursive `RuntimeValueSpec` family;
- exact lifecycle, event, snapshot-input, and opaque snapshot types; and
- the complete resolved, unresolved, invalid, and deferred result types.

These are three runtime exports and seventeen type exports. All twenty public declarations carry
TSDoc. The package stays framework-neutral and does not import React, React Native, DOM, CSS,
browser, Node, application code, dynamic execution, or A2UI.

## Deterministic evidence

The task evidence covers:

- literal arrays, objects, scalars, and all seven reference namespaces;
- JSON `null` and every falsy-value/fallback distinction;
- eligible missing paths and ineligible unknown roots, inactive scopes, and invalid lifecycle
  fields;
- exact lifecycle visibility and error-code-only failure data;
- array-free traversal and exact second-segment roots;
- inert second-pass reference-shaped data;
- nested fallback evaluation and exact RFC 6901 failure pointers;
- whole-composite failure with no partial value;
- token and format deferral;
- malformed and hostile ValueSpec rejection;
- exact aggregate snapshot shape, private factory brand, detachment, and recursive immutability;
- accepted safety maxima and rejected `+1` values;
- platform and effect-source fences;
- compile-time negative contracts; and
- exact trace ownership and prerequisite drift.

The executable inventory is 34 focused package tests, 10 compiler-negative cases, 13 independent
root proof/mutation tests, 9 trace assignments, 10 resolution probes, 8 safety probes, and 11
byte-tracked task-owned files.

The artifact depends on the exact verified M04-T01 host-port evidence. Metadata that merely claims
that prerequisite is insufficient; verification executes its verifier and compares the actual
artifact bytes:

```text
docs/proof/artifacts/runtime-core-0.1.0-host-ports.json
sha256:5a53cfc9698339a2e9da72c496c1b204e0da138da3d3c1efdc1fe0b5c0e4f190
```

Run:

```text
pnpm generate:runtime-core-value-resolution
pnpm verify:runtime-core-value-resolution
pnpm test:runtime-core-value-resolution
pnpm check
```

Tracked receipt:

```text
docs/proof/artifacts/runtime-core-0.1.0-value-resolution.json
```

The verifier reports the final M04-T02 receipt SHA-256. `PROJECT-STATUS.md` and
`PROOF-MATRIX.md` record that value.

## Boundaries

M04-T02 does not prove:

- token lookup or deterministic string formatting (`M04-T03`);
- predicate evaluation, conditional presence, or resolved styling (`M04-T04`–`M04-T05`);
- state writes, repeat identity, or repeat limits (`M04-T06`–`M04-T07`);
- resource or operation transitions, settlement, concurrency, cancellation, or refresh
  (`M04-T08`–`M04-T09`);
- action turns, behavior execution, events, commands, diagnostics, or complete materialization
  (`M04-T10`–`M04-T16`);
- consumer-schema validation, optional-prop omission, required-node failure, or adapter isolation
  (`M05`);
- publication, activation, or last-known-good recovery (`M06`–`M07`);
- context-secret classification or the repository-wide secret audit (`M12-T04`); or
- React, browser, iOS, Android, SwiftUI, or Compose adapters.

The frozen DESEN 0.1.0 protocol, frozen examples, schemas, conformance corpus, Proof Matrix
statuses, normative-coverage statuses, and proof-gate count are unchanged.
