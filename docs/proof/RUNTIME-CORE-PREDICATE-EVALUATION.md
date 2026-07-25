# Runtime Core Predicate Evaluation

## Claim

M04-T04 implements DESEN 0.1.0's closed predicate language and a framework-neutral conditional
presence decision over one factory-created M04-T02 runtime snapshot.

The public API returns a complete `evaluated`, `invalid`, or `deferred` outcome. A valid false
predicate is therefore never confused with malformed input, an unsafe value, or a token/format
operand that still requires M04-T05 to compose this evaluator with the completed M04-T03
materializer.

This is a bounded runtime profile over the frozen protocol. It does not add an expression
language, execute host code, instantiate a component, dispose a subtree, or claim complete
reactive lifecycle behavior.

## Reviewed ownership

| Evidence class | Exact M04-T04 ownership                                       |
| -------------- | ------------------------------------------------------------- |
| Pipeline step  | `PIPE-021` predicate stage only                               |
| Prose rules    | `R-050`, `R-051`, `R-052`, `R-053`, `R-059`, and `R-073`      |
| Diagnostic     | `D-021` (`PREDICATE_TYPE_MISMATCH`)                           |
| Finding        | `PF-034` deterministic predicate and conditional-presence API |

The shared owners remain explicit:

- `PIPE-021` still needs ordered variants and repeat instances from M04-T05 and M04-T07.
- `R-053` proves one immutable snapshot here; reactive re-evaluation remains M04-T15.
- `R-059` receives only the presence decision. Subtree lifecycle equivalence remains
  M04-T15/M04-T16.
- `R-073` can consume a false guard decision, but action execution remains with its later owners.
- `D-021` is returned as inert ordered data. Host diagnostic publication remains later runtime
  composition.

No frozen protocol, normative-coverage, Proof Matrix status, or proof-gate status changes.

## Public API and internal composition seam

The package root exposes only:

```ts
evaluateRuntimePredicate(
  predicate: RuntimePredicateSpec,
  snapshot: RuntimeResolutionSnapshot,
): RuntimePredicateEvaluation

evaluateRuntimeConditionalPresence(
  when: RuntimePredicateSpec | undefined,
  snapshot: RuntimeResolutionSnapshot,
): RuntimeConditionalPresence
```

Ten documented public types describe the exact predicate, evaluation, diagnostic, and presence
outcomes.

The source module also exports three `@internal` data-only helpers:

```text
prepareRuntimePredicateEvaluation
resolveRuntimePredicateOperands
evaluatePreparedRuntimePredicate
```

They permit M04-T05 to materialize deferred operands through one shared top-level session without
accepting an executable resolver callback. They are deliberately absent from the package root, so
applications cannot depend on an unfinished plan format or bypass the public snapshot boundary.

## Closed operator semantics

The evaluator recognizes exactly thirteen operators:

| Operator group           | Arity | Runtime rule                                          |
| ------------------------ | ----- | ----------------------------------------------------- |
| `all`, `any`             | 1–64  | Require boolean arguments                             |
| `not`                    | 1     | Require one boolean argument                          |
| `eq`, `neq`              | 2     | RFC 8785 canonical JSON equality or inequality        |
| `gt`, `gte`, `lt`, `lte` | 2     | Two finite numbers or two strings                     |
| `in`                     | 2     | Left member occurs in the right array/string          |
| `contains`               | 2     | Left array/string contains the right member/string    |
| `exists`                 | 1     | Original reference resolves, including to JSON `null` |
| `truthy`                 | 1     | Apply the explicit DESEN truth conversion             |

There is no custom operator registry, function name, path expression, regular-expression
evaluation, locale inference, Unicode normalization, or application callback.

The proof executes both `all` and `any` at every accepted length from 1 through 64. It also rejects
lengths 0 and 65 for those operators, lengths 0 and 2 for every unary operator, and lengths 0, 1,
and 3 for every binary operator. This makes each operator family's exact arity executable rather
than an inventory-only claim.

An argument object is a nested predicate only when its own data properties form one exact closed
predicate with a recognized operator and valid arity. A predicate-shaped literal that is not that
exact form is not partially executed.

## Deterministic evaluation order

Arguments are prepared, resolved, and evaluated depth-first from left to right. Evaluation does
not short-circuit. Later arguments are still inspected after an `all` is already false or an `any`
is already true, so dynamic diagnostics always appear in deterministic document order.

Every ordinary operand resolves through the same factory-branded snapshot. No operand can refresh
context, environment, state, resource, operation, event, or repeat scope independently.

A direct unresolved operand makes its current predicate false without creating a type diagnostic.
A nested predicate that evaluated false is an ordinary resolved boolean for its parent, so `not`
can invert it and `all`/`any` can combine it.

Ordinary operands resolve sequentially into one shared aggregate budget. Each resolved value is
charged immediately and an overflow returns a frozen root `invalid` before that outcome is retained
or a later operand is materialized. An earlier invalid or deferred terminal is returned first, so
a later overflow cannot overwrite document order; conversely, an earlier overflow cannot be
displaced by a later terminal. The independent prepared-evaluation seam repeats the aggregate
defense for M04-T05-provided outcomes.

Malformed, hostile, or over-budget input returns `invalid`. A `$token` or `$format` operand
returns `deferred`; it is not guessed false. Neither result exposes a partial boolean or resolved
sibling values.

## Truth, equality, ordering, and membership

`truthy` is false exactly for:

```text
null
false
numeric zero
empty string
empty array
empty object
```

Every other resolved JSON value is true.

`eq` and `neq` compare complete RFC 8785 canonical JSON. Array membership for `in` and `contains`
uses the same canonical identity, so object key insertion order cannot change the result.

String order is exact lexicographic UTF-16 code-unit order. String membership is an exact
contiguous UTF-16 code-unit substring. The core performs no locale comparison, collation,
normalization, case folding, grapheme conversion, or regular-expression matching.

Ordering accepts two numbers or two strings only. String/number mixtures and other resolved types
produce false plus one `PREDICATE_TYPE_MISMATCH` at the exact incompatible argument pointer.
Evaluation continues left-to-right to retain later diagnostics.

## Original-reference existence

`exists` is distinct from ordinary value resolution. It accepts an original `$ref`, checks that
reference without evaluating its fallback, and returns true when the reference resolves even when
the result is JSON `null`.

A valid missing reference returns false. Its fallback cannot turn missing into existing, trigger a
token provider, execute a nested format, or hide the original absence.

## Conditional presence

`evaluateRuntimeConditionalPresence` returns one exact decision:

| Input/result        | Status      | `present` | Meaning                                  |
| ------------------- | ----------- | --------- | ---------------------------------------- |
| Omitted `when`      | `evaluated` | `true`    | Node may be instantiated                 |
| Predicate true      | `evaluated` | `true`    | Node may be instantiated                 |
| Predicate false     | `evaluated` | `false`   | Node is absent, not visually hidden      |
| Deferred evaluation | `deferred`  | `false`   | Fail closed; not a valid false predicate |
| Invalid evaluation  | `invalid`   | `false`   | Fail closed; not a valid false predicate |

This task produces only the presence decision. It does not instantiate or dispose components,
resources, operations, behaviors, event listeners, commands, subscriptions, or adapters.
M04-T15/M04-T16 retain that complete subtree and reactive-lifecycle proof.

## Bounds and hostile inputs

The evaluator inherits the M04-T02 value profile:

| Limit               | Accepted maximum |
| ------------------- | ---------------- |
| JSON occurrences    | 4,096            |
| String UTF-16 units | 1,048,576        |
| Value depth         | 128              |

Because every nested predicate contributes both an object and an `args` array to raw JSON depth,
the predicate tree additionally permits at most 64 total predicate nodes—the root plus 63 nested
nodes—4,096 aggregate argument occurrences, and the frozen per-operator maximum of 64 arguments.

Predicate input is copied through an inert data boundary before evaluation. Accessors, functions,
promises, symbols, cycles, non-finite numbers, sparse/decorated arrays, reflection failures, and
over-budget shapes fail closed. Accepted output and diagnostics are detached and recursively
frozen.

The package imports no React, React Native, DOM, CSS, browser, Node, application, A2UI, locale, or
dynamic-evaluation dependency. Its syntax audit rejects direct or aliased `Math`/`RegExp`,
`WebAssembly`, derived callable `.constructor` access, `FunctionConstructor`, and runtime
`RegExp(...)` or `new RegExp(...)` construction in both source and built JavaScript. It also rejects the reviewed
`Object`/`Reflect` calls—including reflective constructor lookup—and assignment, update, or
deletion rooted at a built-in prototype. The required static read of `Function.prototype.toString`
remains allowed.
The two reviewed regular-expression literals validate the frozen `$ref` and format-name grammar;
they remain allowed because their pattern and flags are fixed source data. Predicate string
comparison and membership never perform regular-expression matching or call `localeCompare`,
`toLocaleLowerCase`, `toLocaleUpperCase`, or `toLocaleString`.

The same audit inventories only directly exported identifier-named declarations. Destructured
export bindings, named export lists, default exports, export-equals, export-star, and other
re-export declarations fail closed in source, built JavaScript, and built declarations. Namespace
exports, global declarations, and ambient module augmentations also fail closed; the declaration
emitter's empty `export {}` module marker is the sole non-semantic exception.

## Deterministic evidence

Evidence covers:

- all thirteen operators, every accepted `all`/`any` length, and every family's rejected arities;
- every explicit false value and nested-false behavior;
- original-reference `exists`, resolved JSON `null`, missing references, and fallback bypass;
- aggregate string-code-unit accounting across both operands while status-only `exists` avoids
  charging resolved payload bytes;
- direct internal-helper and source-structure checks that pin sequential charge-before-retain
  aggregate cutoff and earlier-terminal precedence;
- both deferred-before-overflow and overflow-before-deferred terminal precedence orders;
- canonical object equality and array membership;
- exact UTF-16 string order and substring membership;
- canonical-equivalent but code-unit-distinct strings and case-sensitive membership negatives;
- direct unresolved, deferred token/format, invalid, and over-budget outcomes;
- recursive freezing of direct evaluated, invalid, token-deferred, and format-deferred outcomes;
- dynamic mismatch result, exact pointer, complete left-to-right evaluation, and diagnostic order;
- omitted, explicit true, false, invalid, and deferred conditional-presence outcomes;
- one branded snapshot with no host effect or platform dependency;
- source and distribution mutations for nondeterministic randomness, dynamic regular-expression
  construction, locale-sensitive calls, global mutators, and built-in prototype mutation while preserving fixed
  regular-expression literals;
- exact source exports versus the narrower package-root exports;
- fail-closed source, distribution, and declaration mutations for named-list, default, export-star,
  and re-export forms;
- complete TSDoc, built declarations, distribution, package wiring, and compile-time negatives;
- exact descriptions for all 13 compiler-negative contracts, preventing unrelated expected errors
  from preserving only the count;
- canonical unaliased Vitest and `node:test`/strict-assertion harness provenance, including
  shadowing, registry/assertion mutation, and skipped-suite option rejection;
- eight direct trace assignments, PF-034, deterministic artifact bytes, and prerequisite drift;
  and
- safe atomic evidence writes with symlink and temporary-byte tamper rejection.

The receipt tracks eleven task-owned source, test, distribution, and proof files. The executable
inventory is 53 focused package tests, 13 compiler-negative cases, 14 independent root
proof/mutation tests, 8 direct trace assignments, 13 closed-operator probes, 162 exact-arity probes,
6 explicit false-value probes, 4 existence probes, 5 UTF-16 probes, 2 ordered mismatch diagnostics,
4 limit probes, 1 direct early-cutoff probe, 2 terminal-precedence probes, and 5 conditional
presence probes. The verifier derives those inventories from direct registrations and records the
final artifact hash.

The artifact depends on the exact verified M04-T02 evidence:

```text
docs/proof/artifacts/runtime-core-0.1.0-value-resolution.json
sha256:73e4c3d7640eaefd0b45b04b006df3211f0338fafa77293414d43c1052536fea
```

Run:

```text
pnpm generate:runtime-core-predicate-evaluation
pnpm verify:runtime-core-predicate-evaluation
pnpm test:runtime-core-predicate-evaluation
pnpm check
```

Tracked receipt:

```text
docs/proof/artifacts/runtime-core-0.1.0-predicate-evaluation.json
```

## Explicit non-claims

M04-T04 does not prove:

- token-provider or deterministic-format operand composition;
- ordered variant and style override application;
- state writes, repeat identity, resources, operations, actions, events, commands, or behaviors;
- reactive re-evaluation or complete absent-subtree lifecycle behavior;
- consumer-schema validation, render plans, component adapters, or renderer omission;
- the complete M04-T16 headless sign-in trace;
- publication, activation, persistence, or last-known-good recovery; or
- Web, React, browser, iOS, Android, SwiftUI, or Compose integration.
