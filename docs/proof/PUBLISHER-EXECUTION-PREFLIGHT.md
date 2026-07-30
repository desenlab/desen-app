# M06-T05 — Execution preflight proof

## Decision

M06-T05 is `PASS` for its bounded claim. The platform-neutral Publisher now runs the complete
M06-T04 boundary internally, upgrades its exact Catalog authority for execution contracts, and
checks the remaining statically decidable publication contracts. A successful nonterminal result
retains the exact authenticated Source, selected Catalog package, requirement alignment, and safe
M06-T04 warnings while adding the complete bounded runtime-obligation handoff.

The boundary remains package-private. It neither exposes a public `publish` API nor emits a Bundle.
M06-T06 owns extension and array-order preservation plus source-node identity traceability.

## Exact predecessor authority

The evidence pins and authenticates three predecessor artifacts:

- M02-T10 for state, predicate, repeat, lexical-reference, format, and binding contracts;
- M02-T11 for resource, operation, action, lifecycle, and receiving-schema contracts;
- M06-T04 for the exact prepared Source, Catalog, package, requirement-alignment, and warning
  authority.

M06-T05 never accepts a caller-created T04-shaped object. It invokes M06-T04 internally. On
success, the Source and execution Catalog set reauthenticate by runtime identity through the
Validator, every selected package points to the exact Catalog object at the same index, and the
requirement-to-package indexes remain valid. A detached Source clone fails the independent proof
because it cannot preserve the authenticated preparation authority.

The inert Source, Catalog, package, alignment, and diagnostic projections are byte-equal to a
direct M06-T04 run. Existing deprecation warnings cross unchanged only when all M06-T05 phases
succeed. If a later execution phase blocks publication, no lower-stage warning is exposed.

## Stage ownership and precedence

One phase-aware Validator walk assigns a phase at each diagnostic emission site. The Publisher
does not guess a stage from diagnostic codes or JSON Pointer text.

| Order | Publisher stage          | Statically decided work                                                     |
| ----: | ------------------------ | --------------------------------------------------------------------------- |
|     8 | `capability-contracts`   | Execution schema safety, resource policy, operation/resource/command inputs |
|     9 | `state-and-control-flow` | State writes, predicates, repeats, navigation, refresh, and command targets |
|    10 | `binding-compatibility`  | Lexical references, formats, lifecycle references, and static bindings      |

The exact simultaneous-error priority is:

```text
capability-contracts → state-and-control-flow → binding-compatibility
```

The proof injects independent defects into all three phases and observes only stage 8. It then
removes the stage-8 defect and observes stage 9 before the remaining stage-10 defect. Separate
vectors cover two failures in each stage. All stopped-stage failures retain the original Validator
code, pointer, and immutable diagnostic context.

## Complete runtime-obligation handoff

A static success emits every unresolved receiving check, not a sample. The exact closed vocabulary
is:

- `behavior-prop`;
- `behavior-style-part-property`;
- `component-command-input`;
- `component-prop`;
- `operation-input`;
- `resource-input`;
- `state-write`;
- `style-part-property`.

The frozen sign-in Source produces an exact seven-entry projection. The official sortable-list and
store-map examples plus one synthetic inert behavior/resource fixture cover all eight kinds.
Obligations are normalized, strictly ordered, deduplicated, deeply frozen, and carry their exact
Source pointer and identity context.

`operation-output` and `resource-output` are deliberately absent. Those values are not dynamic
Source inputs; their exact resolved values cross their owning runtime receiving-schema boundaries.
M06-T05 records obligations but does not resolve or discharge them.

## Finite output profile

| Budget                                                   |   Default |
| -------------------------------------------------------- | --------: |
| Complete runtime obligations                             |     4,096 |
| UTF-16 code units in one obligation JSON Pointer         |     4,096 |
| Aggregate kind, pointer, and identity-context code units | 1,048,576 |

For the seven-obligation sign-in projection, exact test boundaries are seven obligations, 64
pointer code units, and 984 aggregate code units. Every exact boundary succeeds without changing
one obligation byte. Setting each boundary one unit lower rejects the complete publication at
`binding-compatibility` with one redacted
`run.desen.publisher/EXECUTION_PREFLIGHT_LIMIT_EXCEEDED` error. No obligation is truncated and no
partial Source, Catalog set, package list, requirement alignment, obligation list, value, or Bundle
is exposed.

The output budget is checked before the intermediate can cross the Publisher boundary. This task
does not claim that the cumulative Validator walk shares an incremental allocation budget with the
Publisher; its input graph remains independently finite under the earlier Source and schema
profiles.

## Package and platform boundary

The runtime function, limit profile, result types, and task-owned failure codes remain absent from
the package root and from every package export subpath. Independent evidence imports only the built
package-private distribution module.

Both `execution-preflight.ts` and its built declaration undergo a TypeScript-AST audit. The audit
allows only the protocol, Validator, and package-local static edges; requires the exact two
platform-neutral production dependencies; and rejects enumerated browser, DOM, Node, worker,
storage, direct loader, dynamic constructor, ambient runtime, suppression, and triple-slash
reference forms. The audit is a direct-form architecture check, not a JavaScript sandbox.

## Deterministic and mutation evidence

The evidence builder:

- regenerates byte-identical formatted JSON across independent builds;
- authenticates the exact three prerequisite hashes;
- byte-tracks the Publisher source, built JavaScript, built declaration, Validator phase sources,
  focused tests, fixtures, and proof tooling in a sorted unique inventory;
- verifies public-Validator parity for accepted obligations and all stopped phases;
- detects dropped obligations, detached authority, stage remapping, limit bypass, partial failure
  leakage, root export leakage, platform-specific source/declaration forms, fixture drift,
  prerequisite drift, artifact tampering, and proof-document pin drift;
- writes through an exclusive same-directory temporary, rechecks inode and bytes, performs an
  atomic rename, and rejects destination symlinks or pre-rename tampering.

The focused inventory currently contains 14 Publisher runtime cases, 28 compiler-negative cases,
50 Validator binding cases, 50 Validator execution cases, and 15 independent root
proof/mutation cases.

## Evidence artifact

`docs/proof/artifacts/publisher-0.1.0-execution-preflight.json`

`sha256:6127bc2edd417975d4ae311b7934d9f85048928c84b1500ab50af8f42731ca67`

## Scope limits

M06-T05 does not preserve extensions or source-node trace identity, prove array-order retention,
remove authoring data, normalize Source data, calculate a Source digest, pin exact Bundle package
tuples, validate a Bundle, calculate a revision, or emit a Bundle. Those remain M06-T06 through
M06-T11.

It also makes no storage, network discovery, package download, activation, Desen App, editor,
rendering, native-runtime, signing, authenticity, npm-publication, or deployment claim.
