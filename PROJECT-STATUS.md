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
opaque extension preservation. M02-T08 now applies component prop and Variant schemas, slot
contracts, accepted-child rules, visual states, and style-part contracts while preserving dynamic
values as explicit later-validation obligations. M02-T09 now adds behavior prop/slot/style
contracts, attachment and conflict rules, declared event and known-target command names, plus a
bounded resolved-event-payload validator. Runtime adapter execution has not started and is not
claimed as proven.

## Current milestone

- Completed gates: `G00`, `G01` (`G01` is explicitly local-only)
- Completed preparation tasks: `M01-T07 — Local tracked baseline`, `M01-T08 — Remote and CI`
- Current milestone: `M02 — Protocol package and validator`
- Completed implementation tasks: `M02-T01 — Frozen snapshot and checksum enforcement`,
  `M02-T02 — Complete protocol traceability`, `M02-T03 — Schema-derived types`,
  `M02-T04 — RFC 8785-compatible canonicalization and SHA-256 golden tests`,
  `M02-T05 — Stable diagnostic model and JSON Pointer support`,
  `M02-T06 — Structural validation`,
  `M02-T07 — Identity, SemVer, entry, catalog namespace, extension, and reference validation`,
  `M02-T08 — Component prop, slot, style-part, and visual-state contract validation`,
  `M02-T09 — Event, command, behavior attachment, conflict, and payload-contract validation`
- Active task: None
- Ready next task: `M02-T10 — State, predicate, repeat, alias, and static binding validation`
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
- The component-contract layer passes 58 focused package tests and 21 independent evidence/mutation
  tests over 7 reviewed schema families with 191 constraints. It checks base and Variant props,
  slot presence/cardinality/acceptance, visual states, style parts, dynamic obligations,
  dispatcher parity, immutable results, depth and regex safety boundaries, and explicit T09–T11
  fences. A separate post-fix review reran all four safety/semantics reproducers and found no
  remaining P1/P2 issue.
- The cumulative interaction-contract layer passes 114 focused package tests and 10 independent
  evidence/mutation tests over 7 T09-owned schema families with 246 constraints. It covers 15
  behavior, 6 attachment, 7 conflict, 8 schema-safety, and 10 payload-safety goldens; the official
  T09 unknown-event vector; R-069 behavior identity; private trust branding; exact diagnostic
  pointers; prototype-inherited declaration rejection; and explicit T10/T11 scope fences.
- The cumulative implementation passes formatting, lint, strict typecheck, build, protocol
  integrity tests, protocol traceability and type-generation tests, remaining scaffold test
  runners, and dependency-boundary checks.

## Current blocker

No technical blocker. The following release-hygiene item remains and does not block implementation:

- The upstream repository still lacks a `v0.1.0` Git tag, but the exact commit and checksum are
  sufficient for deterministic local work. Tag creation remains release hygiene under `PF-004`.

## Next task

Begin only `M02-T10`: validate state, predicate, repeat, alias, and statically decidable binding and
event-reference rules. Keep resource/operation/action targets, command input, publication, adapter,
and runtime responsibilities in their later assigned tasks.

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
- artifact SHA-256: `48a3b2d7d5ac336a70f4c58d9ef485a5340305528b5ba777af612703a0df7bb5`

M02-T06 evidence:

- `docs/proof/PROTOCOL-STRUCTURAL-VALIDATION.md`
- `docs/proof/artifacts/protocol-0.1.0-structural-validation.json`
- artifact SHA-256: `1abb36f0a9f7ff233bf7077f818135a912b3b87999a359cf9b51233df590eafc`
- generated validator SHA-256: `d608147be42cfcc683a4427212fe6714c6ff85fba07f031b61b418ddcba019cd`

M02-T07 evidence:

- `docs/proof/PROTOCOL-SEMANTIC-FOUNDATION.md`
- `docs/proof/artifacts/protocol-0.1.0-semantic-foundation.json`
- artifact SHA-256: `df0bb50f1a8ac6a4e071458e13deccb2693db19cbed0c8514ac3560caee97561`

M02-T08 evidence:

- `docs/proof/PROTOCOL-COMPONENT-CONTRACTS.md`
- `docs/proof/artifacts/protocol-0.1.0-component-contracts.json`
- artifact SHA-256: `75d6fad78b763ab74182f4bdfdac034d6dce382f5c842856dbedf1de1b6ce3b5`

M02-T09 evidence:

- `docs/proof/PROTOCOL-INTERACTION-CONTRACTS.md`
- `docs/proof/artifacts/protocol-0.1.0-interaction-contracts.json`
- artifact SHA-256: `e9de90164dd7c80a7cb49568b96276771de7c14c9fa5bf2f4e26101458a286fe`

## Status vocabulary

- `NOT_STARTED`
- `IN_PROGRESS`
- `BLOCKED`
- `DONE`

Only one implementation task may be `IN_PROGRESS` at a time.
