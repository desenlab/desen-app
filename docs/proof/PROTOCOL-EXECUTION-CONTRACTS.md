# DESEN 0.1.0 Execution Contract Evidence Contract

## Status and claim boundary

This document defines the deterministic evidence produced by M02-T11. The tracked artifact is
`docs/proof/artifacts/protocol-0.1.0-execution-contracts.json`. Task completion and its final hash
are recorded separately by the task board, project status, and Proof Matrix owners.

The M02-T11 boundary is cumulative:

```text
T06 structural → T07 semantic foundation → T08 component contracts
               → T09 interaction contracts → T10 binding contracts
               → T11 execution contracts
```

T11 proves statically decidable operation, resource, component-command, navigation, and state
action contracts. It also exposes a detached boundary for validating values after runtime
resolution. It never executes an action, operation, resource, adapter, event, state mutation, or
host policy.

The evidence covers:

- bounded preparation of operation and resource input/output schemas;
- resource declaration policy and statically known input validation;
- surface-scoped resource and operation lifecycle references;
- operation alias consistency and statically known inputs;
- local navigation, resource refresh, and component command targets;
- component command input contracts;
- statically decidable `state.set` and `state.toggle` contracts;
- dynamic execution obligations preserved alongside independent static failures;
- detached resolved-value validation through the exact `validateDesenExecutionValue` API; and
- deterministic, immutable, platform-neutral results and evidence generation.

This evidence does not change any `P-*` status by itself.

## Reviewed ownership

| Evidence class       | Exact ownership                                                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Schema families      | `SC-031` (5), `SC-032` (5), `SC-041` (178), `SC-046` (70), `SC-048` (24), `SC-049` (36), `SC-059` (8), `SC-060` (23), `SC-061` (34) |
| Schema constraints   | 383                                                                                                                                 |
| Prose rules          | `R-042`, `R-043`, `R-055`, `R-073`, `R-074`, `R-075`, `R-076`, `R-077`, `R-079`, `R-080`, `R-120`                                   |
| Invariants           | `A-005`, `A-011`                                                                                                                    |
| Core diagnostics     | `D-016`, `D-024`, `D-025`, `D-027`, `D-028`                                                                                         |
| Conformance rules    | None assigned directly to M02-T11                                                                                                   |
| BCP 14 clauses       | None assigned directly to M02-T11                                                                                                   |
| Official T11 invalid | None in the frozen conformance corpus                                                                                               |

The five T11-owned diagnostic identities are:

| Trace ID | Code                       | T11 use                                      |
| -------- | -------------------------- | -------------------------------------------- |
| `D-016`  | `COMMAND_INPUT_INVALID`    | Resolved or statically known command input   |
| `D-024`  | `OPERATION_INPUT_INVALID`  | Resolved or statically known operation input |
| `D-025`  | `OPERATION_OUTPUT_INVALID` | Resolved operation output                    |
| `D-027`  | `RESOURCE_INPUT_INVALID`   | Policy or resource input                     |
| `D-028`  | `RESOURCE_OUTPUT_INVALID`  | Resolved resource output                     |

T11 narrowly reuses `ENTRY_NOT_FOUND`, `UNKNOWN_COMMAND`, `STATE_WRITE_INVALID`, and
`REFERENCE_UNRESOLVED` at their existing core identities. It uses the project-owned
`run.desen.validator/INVALID_EXECUTION_CONTRACT` only when the protocol diagnostics do not define
an exact identity, such as an incoherent surface alias or an unsafe execution schema.

## Exact prerequisite and trust boundary

1. The complete M02-T10 verifier must pass before T11 evidence can be built.
2. The T11 artifact hashes the exact verified T10 artifact bytes and records the verifier's
   matching hash.
3. Raw Catalog, Source, and Bundle inputs re-enter the cumulative T06 through T10 boundaries.
4. A T09 catalog-set value, even if force-cast to the T11 type, is rejected at the Source, Bundle,
   and detached execution-value entry points and cannot manufacture T11 metadata.
5. A failed validation exposes no trusted document or resolved `value`.
6. Every success, failure, diagnostic, obligation, and returned value is detached and recursively
   frozen.

The direct evidence dependency is:

```text
M02-T11 → M02-T10 → M02-T09 → M02-T08 → {M02-T05, M02-T07 → M02-T06}
```

Metadata that merely resembles a prerequisite is insufficient. Verification executes the T10
verifier and byte-compares its artifact.

## Resource contracts and lifecycle references

Every declared surface resource must resolve to a resource capability in the selected exact
catalog set. T11 checks that its policy is one of the capability's declared policies and applies
the resource input schema to every statically known input member. A dynamic member becomes a
`resource-input` obligation; it does not suppress an independent static mismatch in a peer member.

Resource lifecycle references are surface-scoped and limited to the declared lifecycle fields:

- `resource.<name>.status`;
- `resource.<name>.pending`;
- `resource.<name>.value` and output-schema paths beneath it; and
- `resource.<name>.error.code`.

An unknown instance, lifecycle field, error field, or definitely closed output path reports
`REFERENCE_UNRESOLVED` at the exact `$ref`. A fallback may cover a missing value on a lexically
valid path, but cannot create a resource instance or an undeclared lifecycle field.

## Operation contracts and surface aliases

T11 applies an operation's input schema to each `operation.invoke` action. Dynamic members create
`operation-input` obligations without masking independent static errors.

Operation aliases are indexed across their whole surface before lifecycle references are checked,
so a reference may appear lexically before the invocation that declares its alias. The same alias
may be used repeatedly only for the same exact operation. Reusing it for a different operation is
an incoherent execution contract at `as`.

Operation lifecycle references use the same declared field profile as resources and are scoped to
one surface. Runtime settlement timing is not inferred. A fallback cannot create an undeclared
alias or field.

## Action targets and component commands

Core `navigate.surface` is always a local DESEN surface identifier. An external-looking string is
not redirected to a URL handler. A missing local destination reports `ENTRY_NOT_FOUND` at
`surface`.

`resource.refresh.resource` names one resource declaration on the current surface. A missing
instance reports `REFERENCE_UNRESOLVED` at `resource`.

`component.command.target` names a component node on the same surface. It cannot target a node on
another surface or redirect to a behavior instance. A missing or wrong-kind target reports
`UNKNOWN_COMMAND` at `target`. Once the target and command resolve, T11 applies the command input
schema. Omitted input is the empty object.

A target that exists syntactically beneath a condition or repeat is accepted. Whether that target
is mounted at the exact runtime turn is deliberately deferred to runtime; static T11 validation
does not pretend to prove liveness.

## State action contracts

T11 extends T10's first-segment state-name fence:

- `state.set` validates a complete root replacement or a conservative nested patch where the
  schema path is statically reachable;
- `state.toggle` rejects a definitely missing or definitely non-boolean path; and
- dynamic or condition-dependent writes produce `state-write` obligations.

Nested writes retain an obligation when complete post-write validity depends on surrounding state.
Open or ambiguous schema paths are deferred rather than guessed.

## Detached resolved-value API

The reviewed runtime boundary is named exactly:

```ts
validateDesenExecutionValue(value, selector, catalogSet);
```

It selects exactly one prepared schema through one of five selector kinds:

| Selector kind             | Diagnostic on mismatch     |
| ------------------------- | -------------------------- |
| `component-command-input` | `COMMAND_INPUT_INVALID`    |
| `operation-input`         | `OPERATION_INPUT_INVALID`  |
| `operation-output`        | `OPERATION_OUTPUT_INVALID` |
| `resource-input`          | `RESOURCE_INPUT_INVALID`   |
| `resource-output`         | `RESOURCE_OUTPUT_INVALID`  |

The input is already resolved. Property names such as `$ref`, `$token`, and `$format` are ordinary
inert JSON and cannot trigger binding evaluation. Unknown capabilities and commands fail closed;
the API does not guess another channel.

Resolved values share the audited inert-data boundary used by adapter event payloads:

| Limit               | Accepted maximum |
| ------------------- | ---------------- |
| Nesting depth       | 128              |
| JSON nodes          | 4,096            |
| String UTF-16 units | 1,048,576        |

The proof covers both accepted maxima and rejected `+1` values for arrays, objects, strings, and
depth. It also covers shared-container DAG expansion and nested-wide traversal-frontier
reservation before canonicalization. Accessors are rejected without invocation; cycles, custom
prototypes, and non-finite numbers are rejected.

## Obligation contract

T11 preserves four inherited kinds and adds exactly four execution kinds:

| Origin    | Kinds                                                                                    |
| --------- | ---------------------------------------------------------------------------------------- |
| Inherited | `component-prop`, `style-part-property`, `behavior-prop`, `behavior-style-part-property` |
| T11       | `component-command-input`, `operation-input`, `resource-input`, `state-write`            |

The exact total is eight. Obligations are retained even when an independent static diagnostic
causes the document result to fail. Output obligations are unnecessary because operation and
resource outputs enter directly through `validateDesenExecutionValue` after runtime production.

## Required project mutation goldens

The deterministic artifact records 42 functional negative mutations with exact core or project
diagnostic identities and RFC 6901 pointers. They cover:

- unsupported resource policy, static input shape/type, and dynamic-peer independence;
- unknown resource/operation aliases, lifecycle fields, cross-surface aliases, and closed output
  paths;
- operation input requirements, extras, dynamic-peer independence, and conflicting aliases;
- missing/local navigation, refresh, and component-command target fences;
- omitted, invalid, extra, and dynamic component-command inputs;
- root/nested state writes and boolean toggle requirements; and
- all five detached resolved-value channels plus ValueSpec-shaped inert output data.

Schema-safety mutations are counted separately: one accepted maximum and five rejections. Resolved
value safety is also counted separately: four accepted maxima and six bounded graph rejections.
The builder additionally executes four hostile-value rejections—accessor without invocation,
cycle, custom prototype, and non-finite number—and three forged lower-stage catalog entry-point
rejections. Seven targeted injected-API mutation cases prove that these boundaries cannot be
silently weakened while the artifact still reports `PASS`. This keeps behavioral diagnostic
evidence distinct from containment evidence.

No negative is mislabeled as an official T11 conformance vector.

## Frozen positive corpus and later-task fences

The exact frozen valid Catalog, Source, Bundle, and all five examples must pass. T06 through T10
failures must remain byte-equivalent at the result boundary. Bundle revision and catalog-digest
mismatches remain assigned to their later integrity owners.

T11 deliberately does not enforce or execute:

- host event allowlists;
- operation concurrency, cancellation, retry, transport, or caching policy;
- runtime action-turn limits;
- adapter or application code;
- publication, activation, or catalog-lock integrity; or
- mounted target liveness and reactive lifecycle behavior.

## Deterministic artifact and commands

The artifact is formatted with pinned Prettier, contains no time or machine path, and hashes every
reviewed implementation, distribution, test, and evidence input. Generation writes an exclusive
temporary file in the destination directory, flushes it, and commits with one atomic rename. A
symlink, directory, special file, or symlink parent is rejected.

Run:

```sh
pnpm generate:protocol-execution-contracts
pnpm verify:protocol-execution-contracts
pnpm test:protocol-execution-contracts
pnpm check
```

Two independent builds must be byte-identical. One-byte artifact drift, one-field prerequisite
drift, ownership drift, implementation-profile drift, API weakening, obligation removal, and unsafe
writer destinations must all fail closed.
