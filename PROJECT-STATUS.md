# Project Status

Last updated: 2026-07-22

## Plain-language status

Local implementation preparation is complete and the private GitHub repository is active at
`desenlab/desen-app`. M02-T01 proved that the implementation consumes an exact, checksum-enforced
DESEN 0.1.0 input snapshot. M02-T02 then assigned all 269 reviewed prose entries and all 989
machine-enumerated JSON Schema constraints to future implementation and test owners. M02-T03 now
derives the Source, Bundle, and Catalog TypeScript roots deterministically from those frozen
schemas. M02-T04 now provides RFC 8785 canonical JSON, platform-neutral SHA-256, and the exact
Source-digest and Bundle-revision projections. M02-T05 now provides the exact 36-code core
diagnostic registry, inert shared diagnostic data, and RFC 6901 JSON Pointer primitives. M02-T06
now provides exact frozen-root structural validation for Source, Bundle, Catalog, and all 13
embedded-schema locator families, returning an independent immutable snapshot. M02-T07 now adds
the platform-neutral semantic foundation: strict SemVer, exact declared-catalog matching, entry and
identity namespaces, set-wide capability uniqueness, category-aware capability existence, and
opaque extension preservation. Component contracts and runtime behavior have not started and are
not claimed as proven.

## Current milestone

- Completed gates: `G00`, `G01` (`G01` is explicitly local-only)
- Completed preparation tasks: `M01-T07 — Local tracked baseline`, `M01-T08 — Remote and CI`
- Current milestone: `M02 — Protocol package and validator`
- Completed implementation tasks: `M02-T01 — Frozen snapshot and checksum enforcement`,
  `M02-T02 — Complete protocol traceability`, `M02-T03 — Schema-derived types`,
  `M02-T04 — RFC 8785-compatible canonicalization and SHA-256 golden tests`,
  `M02-T05 — Stable diagnostic model and JSON Pointer support`,
  `M02-T06 — Structural validation`,
  `M02-T07 — Identity, SemVer, entry, catalog namespace, extension, and reference validation`
- Active task: None
- Ready next task: `M02-T08 — Component prop, slot, style-part, and visual-state contract validation`
- Status: `READY_TO_START`

## Completed preparation

- Product naming and domain responsibilities are defined.
- Web-first and future-native architecture boundaries are defined.
- The current npm `desen` package state is recorded without destructive changes.
- The workspace quality toolchain, exact lockfile, and package boundaries work locally.
- The local baseline commit is authored and committed only as Selman Ay, and a temporary clean clone
  passes the locked install and full quality gate.
- The private `desenlab/desen-app` remote is configured and its first `main` CI run passed.
- The implementation milestones, exact `web-react` conformance targets, clause owners, and proof
  claims are defined.
- The frozen protocol baseline was rerun with 14/14 suite cases passing: 9 vectors + 5 examples.
- The complete protocol trace reviews 196 normative headings, assigns 269 prose entries, and maps
  all 989 schema constraints exactly once across 61 families; 11 verifier mutation tests pass.
- Three schema-root declarations are generated with a pinned build-only tool, exposed as three
  documented package types, and protected by 10 deterministic drift tests plus strict compile-time
  positive and negative fixtures.
- RFC 8785 canonicalization, UTF-8 encoding, pure ECMAScript SHA-256, exact digest formatting,
  Source authoring exclusion, and Bundle revision/publication exclusion pass 12 package tests and
  8 root evidence/differential tests. All 24 finite RFC number samples, 8 SHA-256 goldens, and 5
  frozen DESEN documents are content-addressed in the M02-T04 artifact.
- All 36 Appendix B diagnostic definitions, their exact classifications and meanings, portable
  frozen diagnostic data, and RFC 6901 JSON Pointer primitives pass 17 package tests and 8 root
  evidence/mutation tests. The complete 12-example RFC table, hostile caller-owned inputs, public
  exports, command wiring, and tracked implementation hashes are covered by the M02-T05 artifact.
- The three exact DESEN roots and all 44 embedded schemas in the frozen valid corpus pass
  structural validation. All 13 generic embedded-schema locator families are guarded by 14
  mutation cases; 63 package tests and 8 root evidence/mutation tests also cover immutable input
  isolation, stable diagnostics, malformed URI references, no external resolution, deterministic
  standalone generation, and the built platform-neutral distribution.
- The semantic foundation passes 85 focused package tests and 9 independent evidence/mutation
  tests. It covers 19 reviewed schema-owner families with 201 constraints, 28 strict SemVer
  goldens, exact requirement and target matching, entry and shared identity namespaces, all four
  capability categories, undeclared-catalog isolation, extension opacity, the two official T07
  invalid vectors, and explicit T08–T11 scope fences.
- The foundation passes formatting, lint, strict typecheck, build, protocol integrity tests,
  protocol traceability and type-generation tests, remaining scaffold test runners, and
  dependency-boundary checks.

## Current blocker

No technical blocker. The following release-hygiene item remains and does not block implementation:

- The upstream repository still lacks a `v0.1.0` Git tag, but the exact commit and checksum are
  sufficient for deterministic local work. Tag creation remains release hygiene under `PF-004`.

## Next task

Begin only `M02-T08`: apply component prop schemas and validate slot names, cardinality, accepted
children, style parts, and visual states. Keep event/action, state/binding, resource/operation,
publication, and runtime responsibilities in their later assigned tasks.

M02-T02 evidence:

- `docs/proof/artifacts/protocol-0.1.0-traceability.json`
- artifact SHA-256: `749cbae719a5deb216e9ed3be171eb710b47fc547f4f270dbba21bb14c2af514`

M02-T03 evidence:

- `docs/proof/PROTOCOL-TYPES.md`
- `docs/proof/artifacts/protocol-0.1.0-types.json`
- artifact SHA-256: `e21826f5d171aefbed2e3fd833e6f0dc10de1bac71e7b74f51a255f43bb37971`

M02-T04 evidence:

- `docs/proof/PROTOCOL-CANONICALIZATION.md`
- `docs/proof/artifacts/protocol-0.1.0-canonicalization.json`
- artifact SHA-256: `8da65b96973ee2a592735a6868f45ac1f1d0d059114902769a390fe7de33dcc6`

M02-T05 evidence:

- `docs/proof/PROTOCOL-DIAGNOSTICS.md`
- `docs/proof/artifacts/protocol-0.1.0-diagnostics.json`
- artifact SHA-256: `866878161013463a296da5a2e36b88d1162291fb781fb0706b94a12f263b414e`

M02-T06 evidence:

- `docs/proof/PROTOCOL-STRUCTURAL-VALIDATION.md`
- `docs/proof/artifacts/protocol-0.1.0-structural-validation.json`
- artifact SHA-256: `bcd4d25168e9d65fa4b5568cd027131799d7d6b953687fbe125ad37f4e82996a`
- generated validator SHA-256: `d608147be42cfcc683a4427212fe6714c6ff85fba07f031b61b418ddcba019cd`

M02-T07 evidence:

- `docs/proof/PROTOCOL-SEMANTIC-FOUNDATION.md`
- `docs/proof/artifacts/protocol-0.1.0-semantic-foundation.json`
- artifact SHA-256: `5a588238f697decfdce82063643adab77b46ec0494b89d5897345e446c41f221`

## Status vocabulary

- `NOT_STARTED`
- `IN_PROGRESS`
- `BLOCKED`
- `DONE`

Only one implementation task may be `IN_PROGRESS` at a time.
