# Runtime Core Repeat Materialization Proof

## Result

M04-T07 is **PASS** for the framework-neutral DESEN 0.1.0 runtime slice.

The proof establishes deterministic lexical repeat scope, ordered and atomic instance
materialization, bounded expansion, and repeated node identity. It does not claim that a web,
React, iOS, Android, SwiftUI, or Compose adapter already renders those instances.

## What is proved

### Evaluation and lexical scope

- `items` resolves in the incoming scope before the repeat's own alias exists.
- The alias becomes active while evaluating each item key and remains active in that item's child
  scope.
- A nested repeat can read an outer alias.
- A nested repeat cannot shadow an active alias.
- Disjoint sibling repeats may reuse the same alias without sharing state.
- Prototype-sensitive names are copied as ordinary isolated JSON data, never as executable object
  behavior.

These choices complete the runtime part of the open PF-018 profile without changing the frozen
protocol text.

### Ordering, keys, and failure atomicity

- Successful instances remain in source-array order; the runtime does not sort by key.
- Every key is a string or finite number.
- Key identity is type-sensitive RFC 8785 canonical JSON. The number `1` and string `"1"` are
  distinct.
- RFC 8785 represents negative zero with the same identity as zero, so `-0` and `0` are a duplicate
  pair.
- A missing, non-scalar, or duplicate key rejects the whole repeat with `REPEAT_KEY_INVALID`.
- A non-array item value rejects the whole repeat with `REPEAT_ITEMS_INVALID`.
- An invalid item or key produces no partial instance list, even if earlier items were valid.
- Token and format forms remain explicit deferred results for later runtime composition.

### Bounds

The Reference Profile accepts at most 1,000 instances from one repeat declaration. A smaller valid
declaration limit becomes the effective limit. Overflow never truncates a subtree: it returns
`run.desen.runtime/REPEAT_LIMIT_EXCEEDED` with the effective limit and observed item count.

Input snapshots and accumulated nested alias scopes remain under the existing finite M04-T02 JSON
safety budget. Budget exhaustion is a controlled result rather than an exception or partial
subtree.

### Stable repeated identity

One repeated instance identity contains:

1. document identity;
2. surface identity;
3. source node identity; and
4. the complete type-sensitive outer-to-inner repeat-key path.

The array index, alias spelling, item contents, revision, props, and styles are excluded. Reordering
an item therefore preserves its exact identity object. Changing its own key requires replacement.
An ancestor repeat key is equally identity-bearing. Changing only the component capability on the
same key path requires a remount. A key-path replacement starts from a fresh generation zero
identity.

## Evidence boundary

The deterministic artifact is
`docs/proof/artifacts/runtime-core-0.1.0-repeat-materialization.json`.

Generation refuses to proceed unless both frozen prerequisites match their reviewed bytes:

- M04-T02 value resolution:
  `73e4c3d7640eaefd0b45b04b006df3211f0338fafa77293414d43c1052536fea`
- M04-T06 local state and base identity:
  `4183404aa991af06740a22bc62ff42028ed584edd6feb158095408904a764b13`

The evidence builder derives the focused test count from the test syntax, including every row of
`it.each`, and derives compiler-negative cases from described `@ts-expect-error` directives. It
also checks:

- the explicit public source, declaration, distribution, and package-index exports;
- TSDoc on every public repeat declaration;
- framework, browser, Node-host, clock, randomness, and dynamic-evaluation absence;
- package test wiring;
- byte hashes for every tracked proof input;
- byte-identical generation;
- mutation resistance for alias timing and shadowing, source order, key coercion and negative zero,
  limit truncation, partial results, array-index identity, and ancestor-key identity.

## Trace ownership

M04-T07 directly checks its ownership in:

- `PIPE-021` — conditions, repeats, and variants are evaluated during materialization;
- `R-045` — nested aliases extend scope and cannot shadow an active alias;
- `R-061` — repeat items, keys, bounds, scope, and identity;
- `R-104` — compatible instances persist by stable node identity and repeat keys;
- `R-123` — finite Reference Profile limits;
- `D-022` — `REPEAT_ITEMS_INVALID`;
- `D-023` — `REPEAT_KEY_INVALID`.

The broader N-041 limit rule stays planned because it also covers bundle bytes, depth, action
settlement, and other limits owned by later tasks.

## Deliberate non-claims

This proof does not yet establish:

- conditional subtree teardown or reactive dependency reevaluation;
- resource or operation lifecycle behavior inside repeated scopes;
- real adapter instance preservation;
- host rendering, layout, focus, animation, or accessibility behavior;
- the complete observable sign-in flow;
- a normative resolution of PF-018 in a future protocol release.

Those boundaries prevent a headless primitive from being presented as a completed cross-platform
application runtime.
