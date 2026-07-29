# @desen/publisher

## Responsibility

Pure, deterministic DESEN Source-to-immutable-Bundle publication orchestration. M06-T01 establishes
the terminal result, staged diagnostic, and strict raw-Source parsing boundaries used by the later
publication stages. M06-T02 adds package-private exact Catalog resolution, Catalog integrity, and
single-namespace gates. M06-T03 composes those boundaries with phased Source validation and
category-aware static references into one package-private nonterminal preflight without exposing
an unfinished Publisher. M06-T04 adds complete static component and interaction contract
preflight plus safe deprecated-capability warnings while preserving that nonterminal boundary.
M06-T05 completes static execution preflight for resource/operation contracts, state and
control-flow rules, binding compatibility, and the finite runtime-obligation handoff. M06-T06
then preserves the exact parsed Source fields, semantic array order, opaque extensions, and
surface-scoped source-node identity trace. M06-T07 calculates the exact Source digest, removes only
root authoring state, and produces the detached deterministic production-document base in the
protocol's required order. M06-T08 independently authenticates that digest and positionally pins
every Source requirement to its exact selected package tuple without exposing a terminal Bundle.

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
M06-T05 execution preflight and M06-T06 Source preservation also remain package-private and
nonterminal. M06-T07 Source normalization and M06-T08 exact Catalog pinning have the same private,
nonterminal status.

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
`sha256:07537cc034d99dec3cb887805381f58a550de3a0dcb694564ab6a20ac760a387`.

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
`sha256:2c55593b69fd5203d3fe2aeaeb8e59dc70cb4a89c4168605c581c17fd1aad56e`.

## Execution preflight and runtime obligations

M06-T05 runs M06-T04 internally and upgrades its exact Source and selected Catalog authority
through the Validator's execution-contract boundary. Unsafe resource and operation input/output
schemas, unsupported resource policies, and statically invalid resource, operation, or component
command inputs stop at `capability-contracts`. Predicate, repeat, state-write, navigation, refresh,
operation-alias, and command-target failures stop at `state-and-control-flow`. Lexical reference,
format, and lifecycle incompatibilities stop at `binding-compatibility`.

The Validator assigns those phases where each diagnostic is emitted. Publisher does not infer a
stage from a diagnostic code or JSON Pointer. When independent errors coexist, the exact blocking
order is:

1. `capability-contracts`;
2. `state-and-control-flow`; and
3. `binding-compatibility`.

Only a complete success preserves the exact M06-T04 Source, package selection,
requirement-to-package alignment, and warnings. Its Catalog array additionally carries the
Validator's authenticated execution metadata. Values that cannot be proved statically are
recorded as immutable, sorted, de-duplicated obligations of exactly these kinds:

- `behavior-prop`;
- `behavior-style-part-property`;
- `component-command-input`;
- `component-prop`;
- `operation-input`;
- `resource-input`;
- `state-write`; and
- `style-part-property`.

Operation and resource outputs are not publication obligations: each resolved output must later
cross `validateDesenExecutionValue` before lifecycle exposure. M06-T05 does not resolve dynamic
values, execute actions, normalize Source data, calculate a digest or revision, pin a package
tuple into a Bundle, or emit a Bundle.

The complete obligation handoff is fail-closed under this project-owned platform-neutral profile:

| Budget                                           |     Limit |
| ------------------------------------------------ | --------: |
| Runtime-validation obligations                   |     4,096 |
| UTF-16 code units in one obligation JSON Pointer |     4,096 |
| Aggregate obligation and identity-context units  | 1,048,576 |

Crossing any ceiling returns one redacted
`run.desen.publisher/EXECUTION_PREFLIGHT_LIMIT_EXCEEDED` error at
`binding-compatibility`; obligations are never truncated. Every T05 failure uses the same closed
no-partial shell and exposes no Source, Catalog, package tuple, alignment, obligation, partial
value, or Bundle. Successful M06-T04 warnings are carried byte-for-byte only after every T05
blocking phase and obligation bound passes.

Evidence:
`docs/proof/artifacts/publisher-0.1.0-execution-preflight.json`.

## Source preservation and identity trace

M06-T06 runs the complete M06-T05 boundary internally and carries its authenticated Source,
execution Catalog, selected packages, requirement alignment, warnings, and runtime obligations by
exact object identity. It exposes a separate frozen projection containing only `desen`, `id`,
`entry`, `surfaces`, and optional root `extensions`; ordered Source Catalog requirements remain
separate for the later exact-tuple replacement step.

No parsed Source value is sorted, deduplicated, reconstructed, or assigned new meaning. Every
Source-reachable extension remains an opaque exact parsed JSON value, and semantic arrays retain
their Source order. Raw JSON whitespace and object-member lexical order are outside this parsed
authority and are not claimed to survive. Top-level `authoring` remains present on the
authenticated Source but is absent from the production-field projection. M06-T07 consumes only
this exact authority to perform actual production-document removal and normalization.

The task also builds one complete immutable component-node trace. Each record contains only the
document id, surface id, unchanged Source node id, capability id, and exact RFC 6901 Source
pointer. Node identities are surface-scoped: the same node id may legally occur on different
surfaces, while each `(surfaceId, sourceNodeId)` pair and Source pointer remains unambiguous.
Behavior ids stay preserved in the Source graph and are not misrepresented as component nodes.
Schema-shaped values inside extension or authoring payloads remain opaque and create no trace
records.

The additional project-owned trace profile is:

| Budget                                            |     Limit |
| ------------------------------------------------- | --------: |
| Complete component-node trace records             |    25,000 |
| UTF-16 code units in one source-node JSON Pointer |     4,096 |
| Aggregate trace identity and pointer UTF-16 units | 4,194,304 |

Crossing any trace ceiling rejects the complete intermediate at `normalization` with one redacted
`run.desen.publisher/SOURCE_PRESERVATION_LIMIT_EXCEEDED` error. Records are never truncated, and a
failure exposes no Source, Catalog, package, alignment, warning, obligation, trace, partial value,
or Bundle. The inherited raw-Source and execution-preflight ceilings continue to bound Source
content; T06 does not invent a separate extension-payload budget.

M06-T06 does not remove authoring data, normalize Source content, calculate a Source digest, pin
exact Bundle package tuples, validate or emit a Bundle, calculate a revision, or prove
double-publish determinism.

Evidence:
`docs/proof/artifacts/publisher-0.1.0-source-preservation.json`.

## Authoring removal and deterministic normalization

M06-T07 runs M06-T06 internally from the raw Source and closed package candidates; it accepts no
caller-created preservation shell. The authenticated Source, execution Catalog, selected packages,
requirement alignment, warnings, obligations, preservation projection, Source Catalog
requirements, and source-node trace cross by exact runtime identity. The original authenticated
Source remains available without mutation. T07 calculates `sourceDigest` from that exact value
before authoring removal and normalization; M06-T08 subsequently authenticates and carries that
same digest while pinning exact Catalog tuples.

Only `normalizedDocument` is new. It is a detached, recursively frozen RFC 8785 round trip whose
root contains exactly `kind: "desen.bundle"`, `desen`, `id`, `entry`, `surfaces`, and optional
`extensions`. Root `authoring`, Source `kind`, loose `catalogs`, discovery `location`, exact
`requires`, `sourceDigest`, `revision`, and `publication` are absent. A nested extension field
named `authoring` remains opaque data and is preserved; removal is never a recursive key-name
filter. `sourceDigest` is a separate immutable field on the nonterminal T07 success rather than a
member of this incomplete production document.

The local 0.1.0 normalization profile deliberately performs only the transformations needed at
this boundary. It applies no schema defaults, removes no empty optional member, builds no hidden
index, sorts or deduplicates no semantic array, and changes no identifier, condition, literal, or
capability id. RFC 8785 makes the serialized representation deterministic; JavaScript object
enumeration order is not promoted to protocol semantics, including for integer-like extension
keys.

The detached document is bounded by 2,097,152 canonical UTF-8 bytes. The exact ceiling passes; a
crossing rejects the whole intermediate at `normalization` with one redacted
`run.desen.publisher/SOURCE_NORMALIZATION_LIMIT_EXCEEDED` error. A zero-byte ceiling is valid
profile input and deterministically rejects every nonempty normalized document. Later Bundle
fields still consume bytes, so M06-T09 must enforce the complete final-Bundle limit again. No T07
failure exposes inherited warnings, Source, Catalog, package, alignment, obligation, projection,
trace, normalized document, partial value, or Bundle.

M06-T07 pins no exact Bundle requirement, validates or emits no complete Bundle, calculates no
revision, and grants no runtime, host, adapter, storage, signing, or publication authority.

Evidence:
`docs/proof/artifacts/publisher-0.1.0-source-normalization.json`.

## Source-digest authentication and exact Catalog pinning

M06-T08 runs M06-T07 internally exactly once from the raw Source and closed package inventory. It
accepts no caller-created normalization shell. Before building a requirement tuple, it
independently recalculates the digest from the same authenticated pre-normalization Source,
requires exact lowercase SHA-256 syntax, and compares that value byte-for-byte with the M06-T07
authority. A malformed, thrown, or mismatched digest stops at `source-digest`; the new value is
never substituted silently.

Each Source requirement position maps through M06-T02's exact
`requirementPackageIndexes`. The selected immutable package supplies `id`, `version`, `target`,
and `packageDigest`, which becomes tuple `digest`. Source order and duplicate positions remain
unchanged, and each position retains its exact optional opaque extensions. An omitted target is
filled only from that selected package. No range, newest-version, candidate-order, location,
case-folding, trimming, Unicode normalization, sorting, or deduplication rule can select or alter
a tuple.

Top-level Source requirement `location` remains part of the authenticated Source and therefore
affects `sourceDigest`, but it is never copied into `requires.catalogs`. A nested extension member
named `location` remains opaque data. The recursively immutable `pinnedDocument` adds only the
authenticated Source digest and exact requirements to the normalized production base. It remains
package-private and has no `revision`, `publication`, terminal success, signing, runtime, host,
adapter, activation, storage, or deployment authority.

Evidence:
`docs/proof/artifacts/publisher-0.1.0-catalog-pinning.json`.

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
- Execution-contract failures retain their exact capability, state/control-flow, or binding stage;
  no T05 failure exposes runtime obligations or any lower-stage authority.
- Source-preservation authority or trace-limit failures stop at `normalization`; no T06 failure
  exposes a partial projection, trace, inherited warning, or lower-stage authority.
- Source-digest authority failures stop at `source-digest`; normalization-authority or
  canonical-byte-limit failures stop at `normalization`. No T07 failure exposes a digest,
  normalized document, inherited warning, or lower-stage authority.
- M06-T08 digest reauthentication failures stop at `source-digest`; requirement/package authority
  drift stops at `catalog-pinning`. Neither path exposes inherited warnings, a pinned document, or
  lower-stage authority.
- Final-Bundle validation and revision failures remain assigned to M06-T09 and must relay stable
  diagnostics through the closed result.

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
pnpm --filter @desen/publisher test:execution-preflight
pnpm --filter @desen/publisher test:source-preservation
pnpm --filter @desen/publisher test:source-normalization
pnpm --filter @desen/publisher test:catalog-pinning
pnpm --filter @desen/publisher build
pnpm test:publisher-publish-result
pnpm test:publisher-catalog-resolution
pnpm test:publisher-source-preflight
pnpm test:publisher-capability-preflight
pnpm test:publisher-execution-preflight
pnpm test:publisher-source-preservation
pnpm test:publisher-source-normalization
pnpm test:publisher-catalog-pinning
pnpm check
```
