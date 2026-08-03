# M07-T03 — Exact Installed-Package Preflight

M07-T03 is `PASS` for bounded, fail-closed resolution of every exact installed package required by
one authenticated DESEN 0.1.0 Bundle.

## Proven boundary

The built `@desen/control-plane-api` package accepts only the exact runtime-authenticated
`BundleIntegrityAuthority` created by M07-T02. A forged, copied, cast, stale, or otherwise unknown
shape fails before the installed-package inventory is observed. The public input contains inert
package candidates only: `id`, `version`, `target`, one Catalog value, and exact artifact
`Uint8Array` views. It accepts no caller-selected digest, verifier callback, module specifier,
filesystem or registry location, loader, network source, or target implementation.

Each Bundle requirement is matched by literal package-id code units, exact Semantic Version, and
literal target. Exactly one physical installed candidate must match. Trimming, case folding,
Unicode normalization, ranges, newest/best-match logic, candidate order, sorting, and
deduplication do not grant authority. Duplicate requirements remain separate positional entries
while referring to the same unique verified package. Missing and duplicate candidates both fail
closed with no substitute.

Target dispatch is a static host-owned table. This checkpoint supports exactly `web-react` under
`desen.web-react.package-digest` profile version 1. Unknown targets are unavailable; no dynamic
target discovery or code loading occurs.

## Actual-byte and digest closure

The official requirement resolves exactly to:

- package id `run.desen.reference.sign-in`;
- version `0.1.0`;
- target `web-react`; and
- package digest
  `sha256:acdbbfe9ad4c1fce8093b0b68036bc7f5678e8b2a603357dbe25f2413a3db6f0`.

The implementation independently projects the selected Catalog, sorts the complete portable
artifact inventory, and frames one `catalog.json` entry plus 80 real distribution artifacts. The
current distribution contains 243,175 artifact bytes; the complete 81-entry versioned preimage is
252,072 bytes. Its independently calculated SHA-256 digest must equal both the Bundle requirement
digest and the Catalog's own `packageDigest`.

The proof cross-checks this implementation against the public reference-catalog digest helper but
does not import that package in the production control-plane dependency graph. A historical digest,
changed Catalog identity or self-digest, changed/added/removed/renamed artifact, duplicate path,
reserved `catalog.json` path, or declared/actual byte disagreement fails at the closed package
boundary.

## Finite and hostile-input boundary

The fixed local profile admits at most 256 Bundle requirements, 1,024 installed candidates, 1,024
artifacts per selected package, 240 lowercase-ASCII bytes per portable artifact path, 16 MiB per
entry, and 64 MiB for one or all selected framed package preimages. Identity fields are capped at
4,096 UTF-16 code units. Catalogs have separate 16 MiB per-package/64 MiB aggregate canonical
ceilings plus fixed depth, value, object-member, decoded-string, capability-declaration, and
diagnostic budgets. These are implementation limits for this checkpoint, not new universal DESEN
0.1.0 constants; M07-T04 still owns whole-activation limits.

The suite uses exact/one-over inputs where the boundary is independently reachable and economical:
candidate/identity/path/artifact-count/depth/requirement success boundaries, Catalog
value/string/canonical expansion, artifact-entry rejection, and a direct small-budget framer
exact/over pair. Trusted immutable test ports isolate aggregate Catalog, aggregate capability, and
aggregate framed-preimage enforcement without exposing a caller-controlled limit or allocating a
64 MiB fixture. The Catalog object-member ceiling is defense in depth behind the stricter total
value-occurrence budget for admitted JSON; the diagnostic ceiling equals the requirement ceiling,
and an exact 256-diagnostic result proves that equality. These dominance relations are explicit:
the evidence does not claim that every published ceiling has a separately reachable exact/+1
public input.

Selected Catalogs are captured as inert enumerable own-data JSON projections. Non-enumerable and
Symbol decorations are intentionally ignored and never retained or executed. Accessors, proxies,
custom array prototypes, detached views, shared memory, differently typed arrays, invalid paths,
and unbounded object shapes fail without invoking hostile traps. Exact attached nonshared
`Uint8Array` subviews are copied synchronously, so later caller mutation cannot alter the bytes
verified by this task.

A deterministic standalone first-issue Catalog guard generated from the frozen 0.1.0 Catalog root
and Draft 2020-12 schema profile runs before the established exhaustive Validator. A separate
capability-namespace ambiguity precheck runs before exhaustive Catalog-set validation. Structural
or namespace fan-outs containing 10,000 declarations stop with bounded diagnostics and no digest
or exhaustive-validation amplification.

## Authority and rejection semantics

Only complete success returns a frozen `BundlePackagePreflightAuthority`. Its public fields contain
the inherited protocol/revision, immutable byte-free package metadata, and the positional mapping
from every requirement to a unique package. It exposes no Catalog or artifact bytes, callback,
loader, module specifier, path, staging operation, channel mutation, or activation operation.
Package-private consumers authenticate exact object identity through a `WeakMap`; copying visible
fields cannot create authority.

Private state retains independent Catalog and artifact snapshots for M07-T04 and later staging
owners. M07-T03 does not make those bytes active. Every rejection has one stable stage and redacted
immutable diagnostics with no raw Catalog value, artifact path or bytes, digest detail, executable
field, or partial authority.

## Executable evidence

Thirty-four runtime cases and five generated-guard cases cover exact success, candidate-order
independence, positional duplicates, all reviewed substitution forms, digest and artifact drift,
empty/zero-byte artifacts, exact subviews and caller mutation, authority forgery, hostile memory
and records, representative exact/one-over boundaries, branch-isolating aggregate tests, and
explicit dominance evidence for every finite ceiling, 10,000-entry fan-outs, enumerable-data
projection, capability ambiguity, redaction, and failure precedence. Nine compiler-negative cases
close the public type boundary.

Sixteen independent root proof/mutation cases protect deterministic artifact construction,
prerequisite pins, production implementation receipts, registration and aggregate scripts,
modular-CI registration, all focused and type tests, filesystem authority, atomic writing, and
scope-preserving nonclaims. The artifact pins five direct prerequisite artifacts and these 15
exact trace rows: `PIPE-006`, `PIPE-012`, `PIPE-013`, `R-005`, `R-017`, `R-018`, `R-021`, `R-118`,
`R-127`, `R-139`, `A-003`, `A-004`, `A-012`, `D-032`, and `D-033`.

The live required-exhaustive CI successor contains 63 proof pairs and 134 workloads. The immutable
I07-02 cutover baseline remains 61/130.

Evidence: `docs/proof/artifacts/control-plane-api-0.1.0-package-preflight.json`
`sha256:79ec5f2d285868ecd7e08b4649b160087810b08346d7741796c09d14749f4628`.

## Explicit nonclaims

- M07-T04 still owns surface/capability reference preflight and whole-activation limits.
- M07-T05 still owns editable Source integration, immutable Bundle persistence integration,
  mutable channel pointers, and local transport behavior.
- M07-T06 through M07-T11 still own staging, transactional activation, last-known-good state,
  recovery, fault injection, concurrency, and separately built reference-host channel consumption.
- M12-T12 still owns npm-packed distribution, dependency-tree, and clean external-consumer
  integrity.
- Publication signatures, publisher authenticity, registry transport, discovery, download,
  upgrade negotiation, and dependency installation are not verified here.
- Native targets require separately reviewed static profiles; this task supports only Web–React.

P-05 is `PROVEN`, and N-011/N-020 are `TESTED`. N-010, N-038, and N-041 remain `PLANNED`. P-12
remains `NOT_PROVEN`, G07 remains open, and no activation authority exists at this checkpoint.

## Reproduction

```sh
pnpm verify:control-plane-bundle-verification
pnpm --filter @desen/reference-catalog-web... build
pnpm --filter @desen/control-plane-api... build
pnpm --filter @desen/control-plane-api verify:package-preflight-guards
pnpm --filter @desen/control-plane-api typecheck
pnpm --filter @desen/control-plane-api test:package-preflight
node scripts/generate-control-plane-package-preflight-proof.mjs
node scripts/verify-control-plane-package-preflight.mjs
node --test tests/control-plane-package-preflight.test.mjs
```
