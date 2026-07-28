# M06-T02 — Exact Catalog resolution proof

## Decision

M06-T02 is `PASS` for its bounded claim. The platform-neutral Publisher can now resolve each
already validated Source Catalog requirement to exactly one caller-supplied package observation,
validate the selected Catalogs and their tuple consistency, and construct one trusted immutable
Catalog namespace. Any missing, ambiguous, malformed, inconsistent, or namespace-conflicting path
returns the closed M06-T01 failure shell and emits no Bundle.

This task does not expose an incomplete `publish` function and changes no Proof Matrix claim,
normative status, or gate status. M06-T03 owns Source preflight next.

## Exact resolution contract

Matching uses exact code-unit equality for `id`, `version`, and the optional Source `target`.
`location` is never read as authority. The resolver has no network, filesystem, registry, loader,
callback, target-framework, or application dependency. It never:

- trims or case-folds an identity;
- normalizes Unicode;
- accepts a SemVer range;
- chooses a newer or first candidate;
- follows a discovery location; or
- treats equal Catalog JSON as proof that two package authorities are identical.

An omitted target succeeds only when the exact `id` and `version` have one candidate across all
targets and digests. Multiple candidates fail even when their full tuple and Catalog JSON are
equal. Duplicate Source requirements preserve their original one-to-one alignment while sharing
the one uniquely selected package.

## Integrity and namespace gates

Every uniquely selected Catalog passes these boundaries in order:

1. bounded inert JSON inspection and canonical capture;
2. the frozen DESEN 0.1.0 Catalog root and embedded-schema validator;
3. exact Semantic Version, envelope `id`/`version`/`target`, and Catalog identity comparison;
4. exact lowercase SHA-256 `observedPackageDigest` and `catalog.packageDigest` consistency; and
5. the Validator's branded, detached, recursively immutable single-namespace Catalog-set
   construction.

Resolution input, finite-profile, missing-candidate, and ambiguity errors stop at
`catalog-resolution` with `run.desen.publisher/INVALID_CATALOG_INPUT`,
`run.desen.publisher/CATALOG_LIMIT_EXCEEDED`, or `CATALOG_VERSION_UNAVAILABLE`. Selected Catalog
structure, identity, profile, or digest errors stop at `catalog-integrity` with the exact Validator
diagnostic, `run.desen.publisher/INVALID_CATALOG_INPUT`,
`run.desen.publisher/CATALOG_LIMIT_EXCEEDED`, or `CATALOG_DIGEST_MISMATCH`. Capability collisions
stop at `namespace-conflicts` with `AMBIGUOUS_CAPABILITY`; an excessive namespace-diagnostic set
stops there with `run.desen.publisher/CATALOG_LIMIT_EXCEEDED`.

Diagnostics point to the affected Source `/catalogs/{index}` requirement rather than leaking an
internal candidate-array index or an invented Catalog subtree inside Source. Namespace diagnostics
also retain the stable `capabilityId`. A failure contains no selected Catalog set, tuple projection,
requirement index, parsed candidate, partial Source, or Bundle.

## Package-observation trust boundary

`observedPackageDigest` must come from the applicable target-specific package-byte profile before
the data-only resolver is called. Equality with `catalog.packageDigest` proves exact tuple
consistency; it does not prove that an arbitrary caller actually hashed package artifacts. The
proof pins the existing M03-T04 Web–React package-digest evidence but does not import Web–React
implementation code into `@desen/publisher`.

M06-T08 will pin selected tuples into the Bundle. M07-T03 will independently verify installed
package bytes before activation. Distributor immutability, authenticity, signing, and publisher
identity remain later responsibilities.

## Finite local profile

The task-owned profile admits at most:

| Budget                                     |      Limit |
| ------------------------------------------ | ---------: |
| Source Catalog requirements                |        256 |
| Closed package candidates                  |      1,024 |
| Canonical bytes per selected Catalog       | 16,777,216 |
| Aggregate selected Catalog canonical bytes | 67,108,864 |
| Catalog container depth                    |        128 |
| JSON values per selected Catalog           |    100,000 |
| Decoded string code units per Catalog      |  4,194,304 |
| Selected capability declarations           |    100,000 |
| Code units in one identity field           |      4,096 |
| Diagnostics from one stopped Catalog stage |      1,024 |

These are project-owned limits rather than universal DESEN constants. Accessors are rejected
without invocation and reflection exceptions are converted to controlled redacted failure. A
general JavaScript `Proxy` may execute a reflection trap before it throws; this proof makes no
impossible side-effect-free Proxy-detection claim.

## Evidence method

The deterministic evidence runner authenticates:

- the M06-T01 closed result prerequisite;
- the M03-T04 target-specific Web–React package-digest profile;
- the M05-T04 current Web–React package tuple and exact artifact-entry observation;
- the M02-T07 semantic Catalog-set foundation;
- `PIPE-029` through `PIPE-031` and their M06-T02 ownership;
- the current official-derived Source requirement and current reference Catalog;
- the package-private source and built implementation;
- exact success, duplicate and different-digest ambiguity, location non-authority, integrity
  mismatch, namespace collision, finite-limit, detachment, immutability, and no-Bundle vectors;
- package-root privacy and the platform-neutral dependency boundary; and
- byte-identical evidence generation plus atomic-write rejection cases.

The package suite contains 22 focused runtime tests and 10 compiler-negative cases. The independent
root suite contains 8 proof/mutation cases against the built distribution. Later Publisher tasks may
add private stage modules without rewriting this task-time semantic slice.

## Evidence artifact

The tracked report is:

`docs/proof/artifacts/publisher-0.1.0-catalog-resolution.json`

`sha256:0ad7d3cf0563bb2c44070b59aed682df27ce9f0a1e96032ddeb9a6a4ba0016c5`

## Scope limits

This task does not yet validate a complete Source, capability contracts, state and control flow,
binding compatibility, runtime obligations, extension/order preservation, authoring removal,
normalization, Source digest, Bundle tuple pinning, Bundle validation, revision calculation,
official double-publication determinism, or the complete invalid-source matrix. Those remain
M06-T03 through M06-T11.

It also makes no storage, network, activation, Desen App, editor, rendering, adapter-parity,
native-runtime, registry-distribution, npm-publication, signing, authenticity, or deployment
claim.
