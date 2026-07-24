# Runtime Core Token and Format Resolution

## Claim

M04-T03 adds a framework-neutral, deterministic materialization layer for the two DESEN 0.1.0
`ValueSpec` forms deliberately deferred by M04-T02: host-owned `$token` lookup and `$format`
placeholder substitution.

This is an implementation profile over the frozen protocol. It does not change the Source or
Bundle schemas, define a token-file format, add a template language, or claim that a materialized
candidate satisfies its eventual consumer schema.

## Preserved lower-level boundary

`resolveRuntimeValue` remains the M04-T02 literal/reference/fallback primitive. It continues to
return an explicit `deferred` outcome when it reaches a structurally valid `$token` or `$format`.
`materializeRuntimeValue` is additive: it consumes those forms while preserving the same
factory-branded snapshot, missing-versus-null semantics, fallback rules, inert second-pass data,
exact RFC 6901 locations, and complete-outcome behavior.

Keeping the APIs separate preserves the earlier proof boundary and lets callers use pure reference
resolution without granting access to a host token provider.

## Public API

The additive runtime export is:

```ts
materializeRuntimeValue(
  spec: RuntimeValueSpec,
  snapshot: RuntimeResolutionSnapshot,
  context: RuntimeValueMaterializationContext,
): RuntimeValueMaterialization
```

`RuntimeValueMaterializationContext` is an exact object containing
`requestContext: RuntimeRequestContext` and `tokens: RuntimeTokenPort`. Missing, extra,
accessor-backed, inherited, or otherwise invalid context members cause a `TypeError` before any
token callback runs.

`RuntimeValueMaterialization` reuses `RuntimeValueResolved`, `RuntimeValueUnresolved`, and
`RuntimeValueInvalid`, then adds:

- `RuntimeTokenUnresolved`: `{ status: "unresolved", code: "REFERENCE_UNRESOLVED", pointer, token,
reason: "missing-token" }`; and
- `RuntimeTokenProviderFailure`: `{ status: "failed", code: "ADAPTER_FAILURE", pointer, adapter:
"token-provider" }`.

Neither added failure shape carries a value, fallback, provider response, raw error, stack, or
arbitrary details object.

## Trusted materialization input

The additive API requires:

- one factory-created `RuntimeResolutionSnapshot`;
- one explicit trusted synchronous `RuntimeTokenPort`; and
- one explicit `RuntimeRequestContext` identifying the active document, revision, surface, and
  deterministic request.

The materializer receives no navigation, storage, resource, operation, environment, clock, or
diagnostic authority. It does not discover a platform global, read a DTCG document, or call the
target-specific reference Web token provider directly. Token document storage, alias resolution,
target projection, and invalidation remain host responsibilities.

## Token materialization

A `$token` member carries one non-empty opaque token name. The runtime does not infer dot-path
semantics or normalize that string.

Within one top-level materialization:

1. object members are visited in deterministic text order and arrays retain declared order;
2. format mappings are visited in deterministic name order;
3. one host lookup occurs per unique token name in one top-level materialization; and
4. every later occurrence reuses the first detached, recursively immutable outcome.

Resolved, missing, and provider-failure outcomes are all memoized. The cache is private to and
discarded after that top-level call, so it does not invent a cross-turn token lifetime.

The host's `resolved` JSON null is a successful value and is never confused with `missing`. A
missing token uses `REFERENCE_UNRESOLVED` in a token-specific result containing the exact `$token`
pointer and token name, with no guessed fallback or partial value.

The port is trusted code, but its settlement is still a runtime data boundary. A thrown callback,
malformed settlement envelope, accessor-backed or executable value, non-finite number, cycle,
hostile reflected shape, or over-budget JSON cannot enter materialized output. Provider failures
use a redacted `ADAPTER_FAILURE`; no thrown value, stack, raw provider response, credential, or
partially assembled sibling value is exposed.

## Deterministic formatting

The materializer shares the PF-017 parser profile already used by static binding validation:

- a placeholder is exactly `{name}`;
- `name` matches `[A-Za-z_][A-Za-z0-9_]*`;
- repeated valid placeholders are allowed;
- bare, empty, nested, or unmatched braces are invalid;
- DESEN 0.1.0 defines no escape syntax; and
- placeholder names must equal the own-property names in `values`.

The parser is a single linear pass, not a general template engine. It performs no expression
evaluation, property-chain traversal from template text, prototype lookup, regular-expression
backtracking, code generation, locale inference, markup interpretation, or platform formatting.

Every distinct mapped `ValueSpec` is materialized once in the same snapshot, request context, and
top-level token lookup cache. Repeated placeholders reuse that mapped outcome. Nested references,
tokens, formats, arrays, objects, and selected fallbacks are therefore supported without a second
host snapshot or a partial parent result.

Substitution has one closed conversion rule:

| Resolved mapped value | Inserted text                    |
| --------------------- | -------------------------------- |
| String                | Exact raw string                 |
| Every other JSON type | RFC 8785 canonical JSON encoding |

Therefore raw strings are inserted unchanged; all other resolved JSON values use RFC 8785 canonical
JSON. This covers JSON null, booleans, finite numbers, arrays, and objects without JavaScript
implicit coercion or locale-dependent output.

## Complete outcomes and limits

The complete materializer result remains discriminated and fail closed:

- success exposes one detached, recursively immutable JSON value and the aggregate fallback flag;
- an unresolved reference or token exposes its stable code and exact pointer, never a value;
- malformed or unsafe ValueSpec input exposes an invalid result, never a value; and
- a token-provider technical failure exposes only a redacted `ADAPTER_FAILURE`.

Nested failures preserve their location below the owning object, array, format mapping, or fallback.
A failed child rejects the complete enclosing format or composite and cannot leak resolved
siblings.

Snapshot input, ValueSpec input, provider output, intermediate materialization, and final composed
output are governed by the same public profile:

| Limit               | Accepted maximum |
| ------------------- | ---------------- |
| Nesting depth       | 128              |
| JSON occurrences    | 4,096            |
| String UTF-16 units | 1,048,576        |

The final expanded string is detached and checked again, so repeated placeholders or token reuse
cannot amplify individually accepted input past an output limit.

## Consumer validation boundary

Materialization returns a candidate, not permission to deliver that value to a component or host
effect. Consumer-schema validation remains M05. The exact prop, style-part, component-command,
operation, resource, action, or adapter contract must validate the detached candidate before use.

A later `PROP_TYPE_MISMATCH` does not retry a token lookup, select another value, invoke locale
formatting, or reinterpret the template.

## Deterministic evidence

The task evidence covers:

- exact token request identity, receiver-independent callback invocation, one lookup per unique
  token, and top-level cache isolation;
- missing token, resolved JSON `null`, thrown provider, Promise, malformed envelope, accessor,
  hostile reflection, and over-budget provider outcomes;
- detached, recursively immutable token data with no second-pass ValueSpec evaluation;
- the complete PF-017 placeholder grammar, exact key-set matching, repeated placeholders, raw
  string insertion, and RFC 8785 conversion of every other JSON type;
- deterministic nested reference, fallback, token, and format composition with exact RFC 6901
  pointers and aggregate fallback use;
- complete failure without partial sibling values and bounded final expansion;
- exact materialization-context shape, request detachment, and callback containment;
- platform, import, dynamic-evaluation, public-export, TSDoc, package-entry, and compiler-negative
  contracts; and
- direct `R-048`/`R-049` trace ownership, PF-033, prerequisite drift, deterministic bytes, and safe
  atomic evidence writes.

The executable inventory is 7 focused package tests, 7 compiler-negative cases, 13 independent
root proof/mutation tests, 7 token probes, 8 format probes, 4 safety probes, 2 direct trace
assignments, and 11 byte-tracked task-owned files.

The artifact depends on the exact verified M04-T02 value-resolution evidence. Metadata that merely
claims that prerequisite is insufficient; verification executes its verifier and compares the
actual artifact bytes:

```text
docs/proof/artifacts/runtime-core-0.1.0-value-resolution.json
sha256:73e4c3d7640eaefd0b45b04b006df3211f0338fafa77293414d43c1052536fea
```

Run:

```text
pnpm generate:runtime-core-token-format-resolution
pnpm verify:runtime-core-token-format-resolution
pnpm test:runtime-core-token-format-resolution
pnpm check
```

Tracked receipt:

```text
docs/proof/artifacts/runtime-core-0.1.0-token-format-resolution.json
```

The verifier reports the final M04-T03 receipt SHA-256. `PROJECT-STATUS.md` and
`PROOF-MATRIX.md` record that value.

## Explicit non-claims

M04-T03 does not prove:

- DTCG parsing, token storage, token-document publication, or target-specific CSS projection;
- token-provider invalidation, cross-turn cache lifetime, or a cross-language token snapshot API;
- locale-aware date, number, currency, plural, or message formatting;
- consumer-schema validation or adapter omission/failure composition;
- predicate, variant, style-order, state-write, repeat, resource, operation, or action behavior;
- React, React Native, DOM, CSS, browser, iOS, Android, SwiftUI, or Compose integration; or
- the complete headless sign-in runtime reserved for M04-T16.
