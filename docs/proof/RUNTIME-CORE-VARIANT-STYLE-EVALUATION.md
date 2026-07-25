# Runtime Core Variant and Style-Override Evaluation

## Claim

M04-T05 implements DESEN 0.1.0's ordered Variant selection and prop/style override semantics over
one factory-created M04-T02 resolution snapshot.

The evaluator completes every Variant predicate through the M04-T03 token/format materializer and
the M04-T04 prepared-predicate seam, then selects base and matching patch ValueSpecs in exact
document order. Its successful output contains effective raw ValueSpecs and their winning source
provenance. It does not claim that final component props or style values have been materialized,
schema-validated, or delivered to an adapter.

This is a bounded framework-neutral runtime profile over the frozen protocol. It neither changes
the Source or Bundle schema nor invents structural Variant fields, recursive object merging,
deletion semantics, visual-state cascading, or CSS behavior.

## Reviewed ownership

| Evidence class       | Exact M04-T05 ownership                                     |
| -------------------- | ----------------------------------------------------------- |
| Pipeline step        | `PIPE-021` ordered Variant/value/style selection slice      |
| Prose rule           | `R-060`                                                     |
| Normative obligation | Variant-order portion of `N-014`; overall status stays open |
| Finding              | `PF-035` deterministic ordered-override profile             |

M04-T05 proves only the Variant-order portion of `N-014`. N-014 remains `PLANNED` because action
order, publisher preservation, and editor order retain later owners. `PIPE-021` likewise retains
repeat materialization in M04-T07 and complete headless materialization in M04-T16.

No frozen protocol byte or proof-gate status changes.

## Public API

The package root exposes:

```ts
evaluateRuntimeVariantOverrides(
  input: RuntimeVariantEvaluationInput,
  snapshot: RuntimeResolutionSnapshot,
  context: RuntimeValueMaterializationContext,
): RuntimeVariantOverridesEvaluation
```

Nine documented public types describe the accepted base/Variant ValueSpec maps, successful
effective selection, exact source pointers, invalid outcomes, and complete result union:

```text
RuntimePropValueSpecs
RuntimeStyleValueSpecs
RuntimeVariantEvaluationInput
RuntimeVariantOverrideInvalidReason
RuntimeVariantOverrideSpec
RuntimeVariantOverridesEvaluated
RuntimeVariantOverridesEvaluation
RuntimeVariantOverridesInvalid
RuntimeVariantValueSources
```

`RuntimeVariantEvaluationInput` contains only optional base `props`, optional base `style`, and an
optional ordered `variants` array. One Variant contains `when`, at least one of `props` or `style`,
and optional opaque `extensions`. Slots, children, capability identifiers, behaviors, repeats,
handlers, and every other structural node member are absent from the API.

The result is one complete outcome:

| Status      | Meaning                                                                                 |
| ----------- | --------------------------------------------------------------------------------------- |
| `evaluated` | Effective raw ValueSpecs, winning sources, matching indexes, and ordered diagnostics    |
| `invalid`   | Malformed, hostile, over-budget, or incompletely materialized condition; no partial map |
| `failed`    | Redacted trusted token-provider failure at the exact condition operand pointer          |

An invalid snapshot or materialization-context object throws `TypeError` before a token callback
runs, preserving the factory-brand and exact trusted-host boundary of the prerequisite APIs.

## Ordered predicate composition

Variant conditions are prepared and visited in exact array order. Every ordinary operand is
completed with `materializeRuntimeValue` against:

- the same factory-created resolution snapshot;
- one captured immutable request context; and
- one turn-scoped token session.

The session performs at most one host lookup for each unique opaque token name across all sibling
Variant predicates. Resolved, missing, failed, and over-budget observations retain their first
result for that turn. It does not create a cross-turn cache, refresh the runtime snapshot, discover
a global provider, or expose the provider to the predicate plan.

Prepared operands and completed outcomes remain aligned by their exact position. Original-reference
`exists` keeps its fallback-free M04-T04 presence probe. A directly unresolved reference or token
makes its current predicate false; it is not an invalid Variant and does not select an earlier
fallback value. A dynamic mismatch also makes the predicate false and contributes one
`PREDICATE_TYPE_MISMATCH` whose pointer is prefixed beneath
`/variants/{index}/when`. Complete condition evaluation preserves the M04-T04 depth-first,
left-to-right, no-short-circuit diagnostic order.

A malformed predicate, unsafe materialized value, redacted provider failure, or aggregate-budget
crossing returns at its exact ordered source location. The evaluator never returns matching indexes,
diagnostics, or effective maps alongside that terminal.

## Exact merge leaves and provenance

Base prop and style paths are selected first. Each Variant whose predicate completes with `true`
is then applied in original array order. A later matching Variant changes only a leaf it carries:

```text
/props/{name}
/style/{state}/{part}/{property}
```

`/props/{name}` is one indivisible override leaf.
`/style/{state}/{part}/{property}` is one indivisible override leaf. Literal objects and arrays
inside either ValueSpec are replaced as a whole and are never recursively merged.

Omitted paths preserve the prior selection. JSON `null` is an ordinary ValueSpec value, not a
delete instruction. No Variant can remove an earlier path, and style states remain independent
maps rather than implicitly cascading from `base`. Variants cannot add or remove children.

Every selected leaf retains the JSON Pointer of its winning base or Variant declaration. For
example, a winning style token may retain:

```text
/variants/2/style/hover/root/color
```

The result also retains every matching zero-based Variant index in document order. JSON
object-member order is not semantic, including for legal integer-like prop names; callers use the
protocol's RFC 8785 canonicalizer when deterministic bytes are required. Arrays nested inside a
ValueSpec retain their original order. All maps, indexes, pointers, and diagnostics are recursively
immutable and detached from caller ownership.

## Raw ValueSpec boundary

The evaluator returns effective raw ValueSpecs, not final materialized props or styles.

Only Variant predicate operands are materialized during M04-T05. A winning `$ref`, `$token`,
`$format`, literal object, array, scalar, or JSON `null` remains an inert ValueSpec in
`effectiveProps` or `effectiveStyle`. Its winning pointer lets the later consumer report a failure
against the actual Source/Bundle declaration rather than against a synthetic merged object.
Before any provider call, raw output candidates and predicate operands pass the same T02
structural-shape and T03 outer-first format-profile grammar in two data-only passes. Those passes do
not read the runtime snapshot, call the token provider, or construct formatted output.

This separation prevents a value that is later overridden from producing an irrelevant token
lookup or unresolved-value failure. It also prevents M04-T05 from guessing whether a missing
dynamic prop may be omitted, whether a final resolved value satisfies the component `propsSchema`
or style-part `propertiesSchema`, or which production visual state is active.

Consumer-schema validation and adapter delivery remain M05. M05 must materialize the selected
ValueSpecs, apply the exact capability schemas, preserve source provenance in diagnostics, and
prevent invalid values from reaching an adapter.

## Bounds and hostile input

The complete input is copied through the shared runtime safety profile before evaluation:

| Limit               | Accepted maximum |
| ------------------- | ---------------- |
| Nesting depth       | 128              |
| JSON occurrences    | 4,096            |
| String UTF-16 units | 1,048,576        |

Because the frozen schemas set no direct maximum Variant count, the 4,096-occurrence input bound
provides the finite M04-T05 ceiling. Each prepared condition also retains the M04-T04 maximum of 64
predicate nodes, 4,096 argument occurrences, and 64 arguments per `all` or `any`.

Resolved predicate operands across the complete Variant list share one additional 4,096-occurrence
and 1,048,576-UTF-16-unit budget. The shared token session independently applies the same aggregate
retention limits to unique resolved token candidates. Status-only `exists` does not copy or charge
the referenced value graph.

Accessors, executable values, promises, symbols, cycles, non-finite numbers, sparse/decorated
arrays, unsupported prototypes, reflection failures, malformed closed objects, invalid style
names, and over-budget input fail without a partial result. Accepted input and output are detached
and recursively frozen. Opaque extensions receive no core semantics and are omitted from the
effective prop/style result.

The package imports no React, React Native, DOM, CSS, browser, Node, application, locale, A2UI, or
dynamic-evaluation dependency.

## Deterministic evidence

Evidence covers:

- base-only, empty, false-only, and multiple matching Variant selections;
- exact base-first and later-matching precedence for prop and style leaves;
- whole-value replacement for nested literal objects and arrays;
- no deletion through JSON `null`, omission, or empty patches;
- independent visual-state maps with no implicit `base` cascade;
- exact matching indexes and winning RFC 6901 source pointers;
- legal integer-like prop names with complete immutable values and provenance but no key-order
  semantics;
- hostile but structurally legal prop names without prototype pollution;
- structural rejection of child, slot, capability, behavior, repeat, and event fields;
- Variant predicate reference, token, format, nested-predicate, `exists`, and fallback behavior;
- one shared token observation per unique name across sibling conditions;
- exact prepared-operand position pairing and prefixed dynamic mismatch diagnostics;
- first-terminal ordering, token-provider redaction, and no partial effective maps;
- complete input, aggregate predicate-output, and retained-token budget boundaries;
- detached and recursively frozen input-independent results;
- platform-neutral imports, public exports, built declarations, and TSDoc;
- direct `PIPE-021`, `R-060`, `N-014`, and `PF-035` traceability; and
- prerequisite drift, deterministic receipt bytes, and safe atomic evidence writes.

The frozen examples and conformance corpus contain no node with a `variants` member. Every
precedence and failure vector in this task is therefore a project-owned golden, never an official
DESEN 0.1.0 conformance vector.

The artifact depends on the exact verified M04-T03 and M04-T04 evidence:

```text
docs/proof/artifacts/runtime-core-0.1.0-token-format-resolution.json
sha256:be2d07ae32537ef5c2aec04c783f2cfb30cbcc500a85020172e2b8715a98800f

docs/proof/artifacts/runtime-core-0.1.0-predicate-evaluation.json
sha256:14b74cd4f0c35e76edd77858443edf8515b3a60a247afe75131095d5a0c3bcf1
```

Run:

```text
pnpm generate:runtime-core-variant-style-evaluation
pnpm verify:runtime-core-variant-style-evaluation
pnpm test:runtime-core-variant-style-evaluation
pnpm check
```

Tracked receipt:

```text
docs/proof/artifacts/runtime-core-0.1.0-variant-style-evaluation.json
```

## Explicit non-claims

M04-T05 does not prove:

- materialization of the selected prop or style ValueSpecs;
- component `propsSchema` or style-part `propertiesSchema` validation;
- optional-prop omission, required-node failure, adapter gating, or diagnostic publication;
- active visual-state selection, visual-state cascading, CSS projection, or accessibility effects;
- node conditional-presence lifecycle, repeat scopes, state writes, resources, operations, actions,
  events, commands, or behaviors;
- reactive reevaluation or stale asynchronous-result protection;
- render plans, React adapters, browser rendering, iOS, Android, SwiftUI, or Compose integration;
- the complete M04-T16 headless sign-in trace;
- publication-time preservation, editor ordering, activation, persistence, or last-known-good
  recovery; or
- a protocol-wide closure of `N-014`, `P-17`, or G04.
