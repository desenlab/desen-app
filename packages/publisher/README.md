# @desen/publisher

## Responsibility

Pure, deterministic DESEN Source-to-immutable-Bundle publication orchestration. M06-T01 establishes
the terminal result, staged diagnostic, and strict raw-Source parsing boundaries used by the later
publication stages. M06-T02 adds package-private exact Catalog resolution, Catalog integrity, and
single-namespace gates. M06-T03 composes those boundaries with phased Source validation and
category-aware static references into one package-private nonterminal preflight without exposing
an unfinished Publisher. M06-T04 adds complete static component and interaction contract
preflight plus safe deprecated-capability warnings while preserving that nonterminal boundary.

## Explicit non-responsibilities

No editor UI, runtime execution, storage, network, package discovery transport, signing,
publication metadata policy, or Bundle activation. The package never imports React, DOM, CSS,
Node.js, a host application, or target-specific capability implementations.

## Status

Private and under tracked implementation. The public root currently exposes the stable
`PublishResult` contract, publication-stage vocabulary, Publisher diagnostic registry, and the
finite Source-ingress profile. It intentionally does not expose a partial parser or an unfinished
`publish` function. Exact Catalog resolution and the complete M06-T03 Source preflight are likewise
package-private, as is M06-T04 capability preflight. The real terminal publication entry point is
added only when it can either return a fully validated immutable Bundle or reject with no Bundle.

## Public entry point

Import only from `@desen/publisher`. Private stage modules are implementation details.

```ts
import { getPublisherDiagnosticDefinition, PUBLISH_PIPELINE_STAGES } from "@desen/publisher";

const firstStage = PUBLISH_PIPELINE_STAGES[0]; // "json-parse"
const definition = getPublisherDiagnosticDefinition("run.desen.publisher/INVALID_SOURCE_JSON");
```

`PublishResult` follows the frozen implementation guide:

```ts
import type { PublishResult } from "@desen/publisher";

function consume(result: PublishResult) {
  if (!result.ok) {
    // `result.bundle` does not exist; diagnostics begin with a blocking error.
    return { failedAt: result.stage, diagnostics: result.diagnostics };
  }
  return { bundle: result.bundle, warnings: result.diagnostics };
}
```

Success diagnostics are warnings only. Failure diagnostics are non-empty, begin with an error, and
carry a stable stage, code, safe message, optional RFC 6901 pointer, and available Source identity
context. Core diagnostics retain their Appendix B `classification`; Publisher severity is a
separate local field.

## Strict Source ingress

Raw Source parsing stays package-private so unvalidated JSON cannot be mistaken for publication
success. Before schema validation or hashing, it rejects malformed syntax, duplicate decoded
member names, invalid Unicode, non-finite numeric outcomes, and finite-budget exhaustion. Native
parser errors and Source fragments never enter diagnostics. Accepted pre-schema JSON is detached
and recursively frozen.

The frozen local profile is:

| Budget                         |     Limit |
| ------------------------------ | --------: |
| Raw Source UTF-8 bytes         | 8,388,608 |
| JSON container depth           |       256 |
| JSON value occurrences         |   262,144 |
| Aggregate decoded string units | 4,194,304 |
| One number-token code units    |     1,024 |

These are project-owned finite ingress limits, not universal DESEN constants. `PF-060` records the
reasoning and the protocol gaps they resolve locally.

## Exact Catalog resolution

The resolver accepts only an already validated Source requirement array and a closed array of
target-profile package observations. Matching is exact for `id`, `version`, and the optional
`target`. It never trims, case-folds, normalizes Unicode, resolves a SemVer range, follows
`location`, prefers a newer version, or selects the first candidate. Zero or multiple matches stop
at `catalog-resolution`.

Every uniquely selected Catalog then passes bounded inert capture, the frozen Catalog root and
embedded-schema validator, exact candidate/Catalog identity comparison, exact lowercase SHA-256
digest consistency, and set-wide namespace validation. Duplicate candidates remain ambiguous even
when their Catalog JSON is equal. Duplicate Source requirements retain their one-to-one index
alignment while sharing one unique selected package.

`observedPackageDigest` is deliberately an input from the applicable target-specific package-byte
profile. Comparing it with `catalog.packageDigest` proves exact tuple consistency; the data-only
resolver does not claim that it independently authenticated arbitrary caller bytes. M07 verifies
installed package bytes again before activation. `PF-061` records this authority boundary.

The local Catalog profile is:

| Budget                                     |      Limit |
| ------------------------------------------ | ---------: |
| Source Catalog requirements                |        256 |
| Closed package candidates                  |      1,024 |
| Canonical bytes per selected Catalog       | 16,777,216 |
| Aggregate selected Catalog canonical bytes | 67,108,864 |
| Catalog container depth                    |        128 |
| JSON values per selected Catalog           |    100,000 |
| Decoded string units per selected Catalog  |  4,194,304 |
| Selected capability declarations           |    100,000 |
| Code units in one identity field           |      4,096 |
| Diagnostics from one stopped Catalog stage |      1,024 |

These ceilings are project-owned and platform-neutral. Resolution performs no filesystem,
network, registry, loader, or callback operation. A failure exposes no Catalog authority,
candidate index, observed package data, partial Source, or Bundle.

## Phased Source preflight

M06-T03 composes the existing strict boundaries in causal order:

1. raw JSON ingress stops at `json-parse`;
2. the frozen Source root stops at `source-schema`;
3. embedded Draft 2020-12 state schemas stop at `embedded-schema`;
4. exact requirement SemVer, entry, surface identity, and the surface-local node/behavior identity
   namespace stop at `source-semantics`;
5. M06-T02 exact selection, Catalog integrity, and namespace checks retain
   `catalog-resolution`, `catalog-integrity`, or `namespace-conflicts`; and
6. the exact Source-to-Catalog relation plus category-aware component, behavior, resource, and
   nested-operation references stop at `source-semantics`.

Catalog candidates are completely unobserved through step 4. Catalog-backed reference existence
runs only after a structurally valid, digest-consistent, namespace-clean Catalog authority exists.
Consequently an invalid Catalog wins over a still-indeterminate reference, while a valid Catalog
plus an unknown or wrong-category reference reports `UNKNOWN_CAPABILITY` at the exact Source
pointer. `PF-062` records why the protocol's source-level validation step needs this internal
authority split.

A success contains the exact Validator-prepared Source, exact M06-T02 Catalog set, immutable
selected package tuples, requirement-to-package indexes, and an empty diagnostics array. It is a
nonterminal intermediate with neither `ok` nor `bundle`. A failure contains only `ok: false`, its
stopped stage, and immutable diagnostics; it exposes no parsed or prepared Source, Catalog set,
package tuple, alignment array, partial value, or Bundle.

The common stopped-stage report profile is:

| Budget                                               |     Limit |
| ---------------------------------------------------- | --------: |
| Diagnostics from one stopped preflight stage         |     1,024 |
| UTF-16 code units in one diagnostic JSON Pointer     |     4,096 |
| Aggregate diagnostic and identity-context code units | 1,048,576 |

Under-budget M06-T01 and M06-T02 failures pass through unchanged. If an inherited or task-owned
report exceeds this common profile, it is replaced by one redacted
`run.desen.publisher/SOURCE_PREFLIGHT_LIMIT_EXCEEDED` error at the same stopped stage. The
underlying raw-JSON and Catalog processing limits remain independently enforced.

This preflight does not validate prop, slot, style, event, command, behavior, dynamic binding,
state, predicate, repeat, or action contracts; normalize Source data; calculate digests or a
revision; pin a Bundle; or emit a Bundle. It performs no package discovery, download, activation,
rendering, signing, npm publication, or deployment.

Evidence:
`docs/proof/artifacts/publisher-0.1.0-source-preflight.json`
`sha256:cc4f7010b38243d8395ebe833e09ec5fce6709a3d8dc31ebc5cdd5dedc3f83fd`.

## Static capability preflight

M06-T04 runs M06-T03 internally, then prepares the exact selected Catalog array through the
Validator's interaction-contract authority before checking the exact prepared Source. It blocks
statically knowable violations for component props and Variants, slots and accepted children,
styles and visual states, events and commands, behavior props and slots, behavior styles and
events, attachment, and conflicts. Unsafe component, behavior, event, command, or style schemas
fail before Source capability values are observed.

Every blocking diagnostic stops at `capability-contracts`, retains its Validator identity and
pointer, and returns the same closed no-partial failure shell. A successful intermediate preserves
the exact Source, Catalog, package, and requirement-alignment authorities, but contains neither
terminal `ok`, `bundle`, nor dynamic `obligations`.

After static success only, exact uses of Catalog capabilities whose own `deprecated` field is
`true` or a string emit `run.desen.publisher/DEPRECATED_CAPABILITY`. The warning points to the
Source `use` or operation field, uses fixed Publisher text, never copies Catalog deprecation prose,
and never follows a `replacement`. Warnings are immutable, sorted, deduplicated, deterministic,
and non-blocking.

The stage shares the M06-T03 finite diagnostic profile. Crossing its count, pointer, or aggregate
ceiling returns one redacted
`run.desen.publisher/CAPABILITY_PREFLIGHT_LIMIT_EXCEEDED` error instead of a truncated warning set.
Optional traversal fields and lower-stage discriminators are accepted only as own data
properties, so inherited prototype data cannot fabricate Source structure, warnings, or success.

M06-T04 completes only the static component/interaction slice of publication step 8. M06-T05 owns
resource and operation receiving contracts, dynamic binding compatibility, and explicit runtime
validation obligations.

Evidence:
`docs/proof/artifacts/publisher-0.1.0-capability-preflight.json`
`sha256:05636f61dfdea2984ac96238da1eb47e8c36118383293aaecb7f5d385803485d`.

## Dependencies

- `@desen/protocol` supplies frozen Bundle types, core diagnostics, and RFC 6901 pointers.
- `@desen/validator` supplies recursively immutable document typing, runtime-authenticated Source
  and Catalog authorities, and semantic diagnostic codes.

The dependency direction remains `publisher → validator → protocol`; no runtime or editor package
is reachable.

## Failure behavior

- Raw malformed, duplicate-member, invalid-Unicode, or non-finite JSON emits
  `run.desen.publisher/INVALID_SOURCE_JSON`.
- A parser-budget crossing emits `run.desen.publisher/SOURCE_LIMIT_EXCEEDED`.
- Neither path exposes a parsed value, partial Bundle, native exception text, stack, cause, or
  caller Source fragment.
- Root, embedded-schema, intrinsic Source, Catalog, and static-reference failures now retain the
  causal stages documented above and the same closed no-partial result.
- Static component and interaction contract failures stop at `capability-contracts`; deprecation
  warnings are emitted only after a complete static success.
- Normalization, digest, and final-Bundle failures remain assigned to later M06 tasks and must
  relay stable diagnostics through that result.

## Protocol and target support

- Protocol baseline: DESEN 0.1.0
- Initial target: platform-neutral
- First resolved capability target: Web–React, added through Catalog data rather than a framework
  dependency
- Future native targets reuse this package without importing Web or React APIs

## Testing

```bash
pnpm --filter @desen/publisher typecheck
pnpm --filter @desen/publisher lint
pnpm --filter @desen/publisher test:publish-result
pnpm --filter @desen/publisher test:catalog-resolution
pnpm --filter @desen/publisher test:source-preflight
pnpm --filter @desen/publisher test:capability-preflight
pnpm --filter @desen/publisher build
pnpm test:publisher-publish-result
pnpm test:publisher-catalog-resolution
pnpm test:publisher-source-preflight
pnpm test:publisher-capability-preflight
pnpm check
```
