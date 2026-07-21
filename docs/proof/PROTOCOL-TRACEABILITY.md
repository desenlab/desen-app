# DESEN 0.1.0 Complete Protocol Traceability

Baseline commit: `b0bd7c4f0f61555b1d90e3a2ceb90d6e3d43daca`

Canonical machine ledger: `docs/proof/protocol-0.1.0-traceability.json`

## What this proves

M02-T02 answers one preparation question: if DESEN 0.1.0 states a rule that is relevant to the
planned implementation, which future task owns it and where will its evidence come from?

The ledger records:

- every reviewed non-BCP-14 normative prose unit in SPEC sections 3–31 and Appendices A–C;
- all conformance-target bullet obligations;
- every ordered ecosystem, activation, materialization, and publication pipeline step;
- every Appendix A invariant;
- all 36 Appendix B diagnostic codes, separating registry ownership from emission ownership;
- all three Appendix C canonical schema entries; and
- every validation-bearing keyword occurrence in the three normative JSON Schemas.

It does **not** prove that the validator, publisher, runtime, editor, or host implements those rules.
Those claims remain planned under their named tasks and gates.

## Verified result

| Review surface                   | Verified count |
| -------------------------------- | -------------: |
| Normative headings reviewed      |            196 |
| Prose-side trace entries         |            269 |
| Conformance obligations          |             24 |
| Ordered pipeline steps           |             41 |
| Other normative prose groups     |            151 |
| Appendix A invariants            |             14 |
| Appendix B diagnostic codes      |             36 |
| Appendix C schema entries        |              3 |
| Explicit excluded source classes |              8 |
| JSON Schema constraint families  |             61 |
| JSON Schema constraint instances |            989 |

The 989 schema constraints consist of 586 assertions, 291 applicators, and 112 local `$ref`
occurrences. All 112 references resolve to an existing local `$defs` target.

## Why the schema count is trustworthy

The verifier walks Draft 2020-12 schemas as schemas, not as generic JSON objects. This distinction
matters: an instance property named `type`, `required`, `items`, or `$ref` is not itself a schema
keyword. A generic recursive search would overcount those names.

The walker explicitly distinguishes:

- assertions such as `type`, `required`, `pattern`, and `minItems`;
- applicators such as `properties`, `items`, `oneOf`, and `if`/`then`;
- local `$ref` occurrences;
- dialect, identifier, definition-container, and annotation keywords; and
- an unknown keyword, which fails the audit instead of being silently ignored.

The complete discovered set must map to exactly one of 61 reviewed families. Missing assignments,
duplicate assignments, empty selectors, unresolved references, source/bundle shared-definition
drift, changed counts, and unreviewed keywords all fail verification.

`default` is tracked as an annotation, not treated as validation-time mutation. Its four uses are
routed to the later slot, operation-concurrency, and publisher-normalization tasks.

## How prose completeness is handled honestly

Natural-language semantics cannot be proven complete by a keyword search alone. The review instead
uses all 196 normative headings as its denominator. Every heading has either:

- one or more exact frozen line anchors with owner and test tasks;
- a link to the existing `N-*` or `S-*` BCP 14 ledger entry;
- a container-only disposition; or
- a justified informative/example disposition.

Each prose entry must retain its exact section, line range, frozen text fragment, owner tasks,
future test tasks, and evidence assertion. An entry overlapping an uppercase BCP 14 line must link
to the matching `N-*` or `S-*` item so the two ledgers cannot silently diverge.

The eight explicit exclusions cover sections 1–2, the global informative-example rule, remaining
non-operative scope material, sections 32–34, Appendix D, and editorial/reference material. Each
exclusion has a written reason. Conditional signing, SSR/native precomposition, optional exports,
and protocol-version authoring are retained as justified non-claims rather than silently dropped.

## Ownership model

Schema constraints share these staged owners:

| Responsibility                               | Task(s)   |
| -------------------------------------------- | --------- |
| Schema-derived or mechanically checked types | `M02-T03` |
| Stable diagnostic model and JSON Pointer     | `M02-T05` |
| Structural and embedded-schema validation    | `M02-T06` |
| Official suite parity                        | `M02-T12` |
| Positive/negative branch micro-vectors       | `M02-T13` |

Each family also points to its semantic owner in M02 or the later package, runtime, publisher, or
editor milestone.

Appendix B codes use two responsibilities deliberately:

- `M02-T05` owns the stable shared diagnostic registry and pointer-capable model.
- The validator, runtime, React adapter, publisher, or activation task that can actually observe
  the failure owns emission and tests for that code.

Therefore “supports Appendix B” is not misreported as “the static validator emits all 36 codes.”

## Verification

```bash
pnpm verify:protocol-traceability
pnpm test:protocol-traceability
```

The first command verifies the frozen snapshot, ledger, source anchors, owner/test task IDs,
section review, schema inventory, local references, family assignment, and deterministic evidence
artifact. The second command proves the verifier fails for uncovered/duplicate schema constraints,
unknown task owners, stale prose anchors, missing tests, missing exclusion rationale, missing BCP 14
cross-links, and unreviewed normative sections.

The root `pnpm check` gate runs both commands.
