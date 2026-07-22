# DESEN 0.1.0 Interaction Contract Evidence

## Claim boundary

M02-T09 is the cumulative T06→T07→T08→T09 validation boundary for statically decidable
interaction contracts. Its evidence covers:

- behavior props, slots, visual states, style parts, and dynamic-value obligations;
- exact component/category attachment and the documented empty-union behavior;
- pairwise exclusive-channel conflicts with mutual compatibility;
- declared component and behavior event-handler names;
- declared command names only when the component target is already statically known;
- safe preparation of component/behavior event and command schemas; and
- detached, immutable validation of resolved component and behavior event payloads.

This document and its generator do not by themselves mark M02-T09 complete. Completion requires a
tracked artifact, all focused tests, the full workspace gate, updated project status, and remote CI.

## Reviewed ownership

The deterministic artifact binds implementation behavior to the complete trace-owned T09 route:

| Evidence class       | Exact ownership                                                                                      |
| -------------------- | ---------------------------------------------------------------------------------------------------- |
| Schema families      | `SC-030` (5), `SC-044` (54), `SC-046` (70), `SC-053` (7), `SC-054` (7), `SC-057` (39), `SC-058` (64) |
| Schema constraints   | 246                                                                                                  |
| Prose rules          | `R-044`, `R-062`, `R-069`, `R-070`, `R-071`, `R-080`, `R-120`                                        |
| Core diagnostics     | `D-013`, `D-014`, `D-015`, `D-017`, `D-018`                                                          |
| Mandatory clauses    | `N-033`, `N-034`, both deliberately still `PLANNED`                                                  |
| Official T09 invalid | `invalid/source-unknown-event.json`                                                                  |

Behavior props, slots, and styles reuse `D-008` through `D-012`; the artifact records them as
reused component-surface diagnostics rather than falsely presenting them as T09 trace ownership.
`COMMAND_INPUT_INVALID` (`D-016`) remains assigned to M02-T11 and the runtime.

The owned BCP 14 clauses remain `PLANNED`. T09 can prepare and apply event schemas through a pure
validator primitive, but it cannot prove that a future production adapter always validates every
payload or implements every command it declares. Adapter parity remains M03-T09/M04/M05 work.

## Cumulative trust boundary

1. Unknown Catalog, Source, and Bundle inputs re-enter the exact immutable structural boundary.
2. Exact catalogs, namespaces, identities, and capability categories re-enter M02-T07.
3. Component contracts re-enter M02-T08. A T08 set cast to the T09 type is rejected because T09
   metadata is held in a private runtime registry.
4. Every interaction schema is prepared by the same code-free Draft 2020-12 interpreter and
   host-safe profile used by component contracts.
5. Source and Bundle interaction checks run only with a T09-prepared catalog set.
6. Success and failure results are recursively frozen JSON data. Document failures preserve the
   deterministic dynamic-obligation channel while exposing no trusted document value.

The evidence executes the complete M02-T08 verifier and hashes the exact passing prerequisite
artifact bytes. A metadata-shaped or one-byte-modified predecessor artifact is insufficient.

## Behavior contracts

Project-owned mutation goldens cover literal and dynamic behavior props, declared and rejected
slots, style states/parts/properties, and impossible catalog slot ranges. Behavior slots use the
same `PF-010` edge profile as component slots:

- `effectiveMin = minItems ?? (required ? 1 : 0)`;
- absent acceptance lists mean unrestricted;
- present lists form an exact ID/category OR union; and
- a present empty union rejects every child.

Attachment uses exact, case-sensitive component IDs and categories. Exact-ID and category routes
also form an OR union. A present empty union rejects every attachment.

Exclusive channels are sets. Two attached behaviors sharing a channel are accepted only when both
contracts list the other's exact capability ID. Two instances of one behavior therefore require
explicit self-compatibility. A conflict points to `/use` on the later behavior in document order.
The evidence includes disjoint, shared, unilateral, mutual, self, and three-behavior graph cases.
These project-owned decisions are recorded in `PF-012` and are not presented as official vectors.

## Events and commands

Component and behavior `on` names are checked exactly and case-sensitively. The official unknown
event fails with `UNKNOWN_EVENT` at:

`/surfaces/home/root/slots/default/0/on/teleport`

For `component.command`, T09 checks the name only after the target is already known to be a
component node in the same surface. It reports `UNKNOWN_COMMAND` at the action's `/command`
member. Missing targets, conditional/repeated liveness, resolved input, and
`COMMAND_INPUT_INVALID` remain T11 responsibilities. Behavior command schemas are safely
prepared, but DESEN 0.1.0 defines no `behavior.command` action and the implementation invents none.
This boundary is recorded in `PF-014`.

## Resolved event payloads

`validateDesenEventPayload(payload, event, catalogSet)` selects an exact component or behavior
event and validates a detached resolved payload. Successful output shares no object with the
caller and is recursively frozen. Diagnostics use pointers relative to the payload root; `""`
means the resolved payload root.

`$ref`, `$token`, and `$format` keys in resolved event data are ordinary JSON members, not DESEN
bindings. A dedicated regression requires `{ "$ref": "..." }` to fail when the payload schema
requires that member to be a number. This prevents a ValueSpec-shaped payload from bypassing its
contract. Accessors are not invoked; cycles, custom prototypes, non-finite values, unsafe schemas,
and limit exhaustion fail closed.

The exact public payload limits are:

| Limit                       |     Value |
| --------------------------- | --------: |
| Maximum JSON depth          |       128 |
| Maximum JSON nodes          |     4,096 |
| Aggregate string code units | 1,048,576 |

The proof exercises both sides of every boundary. These limits and the external-value pointer
profile are project-owned `PF-013` decisions, not universal DESEN 0.1.0 limits.

A separate shared-container DAG regression expands one binary array through 30 levels. It must
fail with `EVENT_PAYLOAD_INVALID` at the payload root while performing fewer than 4,096 container
inspections. The source audit also requires this bounded traversal to occur before canonical
serialization, preventing a compact shared input from expanding into unbounded intermediate data.
Wide arrays and objects exercise the same 4,096-node boundary. A 128-level wide-array regression
also proves that child occurrences reserve the node budget before work is queued, so a rejected
payload cannot build an oversized pending frontier first.

Catalog snapshots are treated as own data, not as extensions of JavaScript's mutable object
prototype. Goldens inject inherited event and command maps after catalog construction and require
both document validation and direct payload selection to reject them as undeclared. The same
own-field rule protects omitted slot, style-part, visual-state, attachment, category, and
composition fields.

## Schema and platform safety

T09 applies the verified `PF-011` schema profile to behavior props/style parts and component or
behavior event payload/command input schemas. It retains the reviewed limits: depth 128, 4,096
schema nodes, 4,096 local-reference edges, 64 patterns, 256 code units and 128 tokens per pattern,
quantifier 1,024, expanded width 4,096, unanchored fixed width 16, aggregate pattern code units
4,096, and a 50,000-step evaluation budget.

Unsafe patterns are rejected before native regular-expression execution. Public catalog-set
goldens inject an unsafe schema independently into all six T09-owned schema channels, preventing a
forgotten preparation branch from passing because another channel was safe.

The source and built distributions of `@desen/validator` and its transitive `@desen/protocol`
runtime are inventoried one-to-one. Production modules allow only relative imports plus the exact
validator dependency on `@desen/protocol`. The audit rejects Node built-ins, unapproved packages,
runtime `require`, `eval`, `Function`, dynamic import, browser network APIs, frozen-upstream access,
and workspace-absolute paths.

## Scope fences

The evidence intentionally accepts:

- invalid or unresolved `event.*` paths, owned by M02-T10;
- missing component-command targets and schema-invalid resolved command inputs, owned by M02-T11;
- navigation, resource, operation, refresh, and remaining action semantics, owned by M02-T11;
- asynchronous event lifetime and adapter bridges, owned by M04;
- Bundle revision and catalog-digest mismatches, owned by M06/M07; and
- full official-suite parity and exhaustive diagnostic micro-vectors, owned by M02-T12/T13.

No publication, adapter execution, activation, G02, or Proof Matrix `P-*` status follows from this
artifact alone.

## Reproducible evidence

The tracked artifact destination is:

`docs/proof/artifacts/protocol-0.1.0-interaction-contracts.json`

Generate and verify it with:

```bash
pnpm generate:protocol-interaction-contracts
pnpm verify:protocol-interaction-contracts
pnpm test:protocol-interaction-contracts
pnpm check
```

Generation is the only writer. It resolves a real parent directory, rejects symlink and special
destinations, writes and syncs an exclusive same-directory temporary file, and atomically renames
it only after all evidence passes. Every failure path removes the temporary file. Verification
rebuilds the artifact in memory and rejects prerequisite, trace, BCP 14, finding, public API,
payload-limit, frozen-vector, mutation-golden, dispatcher, scope-fence, command-wiring,
distribution, platform, tracked-file, or artifact-byte drift.
