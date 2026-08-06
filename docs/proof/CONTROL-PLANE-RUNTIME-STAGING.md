# M07-T06 — Staged Runtime Indexes and Active/Staged Separation

This document defines the M07-T06 evidence contract for preparing one exact runtime candidate while
keeping every staged value separate from channel metadata and durable active state. It deliberately
makes no atomic-activation, restart-recovery, or last-known-good claim.

## Intended proven boundary

The built `@desen/control-plane-api` package exposes
`stageBundleRuntime(packageAuthority)`. Its sole input is the exact opaque
`BundlePackagePreflightAuthority` created by M07-T03. A forged, copied, cast, Proxy-backed, revoked,
stale, or otherwise unknown shape must stop at `package-authority` before a Bundle, Catalog,
artifact snapshot, Validator port, runtime-core preparation port, or partial index is observed.

The public operation accepts no caller-selected Bundle, Catalog, artifact inventory, digest, path,
module name, loader, callback, target adapter, channel record, reference authority, active record,
durable repository, host port, or limit override. M07-T04 reference admission and M07-T06 execution
staging are parallel branches from the same exact M07-T03 identity; neither branch can manufacture
or substitute the other.

## Exact package-snapshot reclosure

Staging reads the already authenticated M07-T03 package-private snapshots. It copies every retained
artifact into a second candidate lifetime, sorts portable paths, recalculates each artifact SHA-256,
and independently rebuilds the complete Web–React v1 package digest. The recalculated digest,
artifact count, and framed byte length must still match the M07-T03 metadata. Package-private byte
drift therefore rejects at `package-snapshots`; it cannot become a silently changed load plan.

The staged package indexes retain exact Catalog identity, inert copied artifact bytes, per-artifact
digests, and path lookup records. They contain no dynamic import, filesystem lookup, registry
discovery, executable module, or loader callback. Public package summaries reveal only safe identity,
target, digest, counts, and aggregate byte length.

## Execution contracts and immutable indexes

The authenticated Catalog set passes the Validator's execution-Catalog boundary without being
substituted. The complete private Bundle then passes static execution-contract validation against
that exact set. A successful Validator snapshot must remain canonically identical to the M07-T03
Bundle and close to the same revision. A rejection retains only its first stable diagnostic; a
throw, malformed trusted result, snapshot disagreement, or unexpected preparation outcome becomes
one redacted internal failure.

Complete success privately retains:

- capability indexes separated into components, behaviors, operations, and resources, each linked
  to its exact package index and contract;
- one immutable surface index for every Bundle surface, plus the exact entry-surface identity;
- source-node and attached-behavior indexes using their authenticated source identities;
- surface-local state and resource-alias indexes;
- component and behavior handler selectors whose inert action programs were prepared by
  runtime-core before rendering;
- operation aliases discovered throughout nested success/failure programs; and
- the complete sorted dynamic execution-obligation list from the Validator.

Traversal and record construction use deterministic code-unit ordering. Runtime staging performs no
rendering, repeat materialization, host effect, operation/resource invocation, navigation, event
delivery, target-adapter lookup, or executable callback invocation.

## Fixed finite profile

`BUNDLE_RUNTIME_STAGING_LIMITS` is an implementation-owned all-or-nothing profile:

| Staged resource                                          |    Maximum |
| -------------------------------------------------------- | ---------: |
| Exact package snapshots                                  |        256 |
| Artifact entries across package load plans               |    262,144 |
| Artifact bytes across package load plans                 | 67,108,864 |
| Capability contracts across all four categories          |    100,000 |
| Bundle surfaces                                          |        256 |
| Source nodes                                             |     25,000 |
| Surface-local state entries                              |     25,000 |
| Attached behaviors                                       |     25,000 |
| Prepared component/behavior handler programs             |     25,000 |
| Surface resource aliases                                 |     25,000 |
| Distinct operation aliases                               |     25,000 |
| Dynamic runtime validation obligations                   |      4,096 |
| UTF-16 code units in one obligation JSON Pointer         |      4,096 |
| Aggregate obligation kind/pointer/identity-context units |  1,048,576 |

These ceilings do not widen M07-T03 package admission or M07-T04 reference admission and are not new
universal DESEN 0.1.0 constants. No branch truncates artifacts, capabilities, indexes, handlers, or
obligations. Any crossing rejects the complete candidate with
`run.desen.control-plane/RUNTIME_STAGING_LIMIT_EXCEEDED` and no authority.

## Candidate authority and active-state separation

Only complete success returns a frozen `BundleRuntimeStagingAuthority`. Its visible fields contain
the stable staging profile, protocol version, exact `stagedRevision`, document and entry-surface
identifiers, byte-free package/surface summaries, and total runtime-obligation count. It exposes no
Bundle, Catalog, artifact path or bytes, action program, runtime obligation, loader, callback,
adapter, channel operation, active revision, previous-good revision, generation, durable commit,
activation, rollback, recovery, or host authority.

Package-private consumers authenticate the exact public object through a `WeakMap`. Copying its
visible fields cannot create authority. Repeating deterministic staging creates equal public audit
metadata but distinct public and private identities; there is no mutable process-global staged slot
and no active-state write. M07-T07 must independently authenticate this exact authority together
with the exact M07-T04 reference authority before one durable activation transaction may publish the
candidate.

Every failure is a frozen closed result at one of `package-authority`, `package-snapshots`,
`execution-catalogs`, `execution-contracts`, `runtime-indexes`, or `internal`. Diagnostics are stable
and redacted, and no rejected result carries a partial authority, index, package byte, active value,
or commit operation.

## Official candidate audit

The final executable evidence must close the official two-surface sign-in candidate to revision
`sha256:2dc98d276a3b4102c2891de1519bda86ea2978f5429fd8ea91831f36f8b73ffb` and retain this byte-free
audit:

- one exact `run.desen.reference.sign-in@0.1.0` Web–React package with 80 artifacts, 243,175
  artifact bytes, five component contracts, one operation contract, and no behavior or resource
  contracts;
- `home`: two source nodes and no behavior, handler, state, resource, or operation-alias entries;
- `sign-in`: six source nodes, three prepared handler programs, two state entries, one operation
  alias, and no behavior or resource entries; and
- seven complete sorted dynamic runtime obligations retained privately.

The staged package digest must remain
`sha256:acdbbfe9ad4c1fce8093b0b68036bc7f5678e8b2a603357dbe25f2413a3db6f0`.

## Executable evidence contract

The final deterministic artifact must pin:

- the exact M07-T03 package-preflight artifact and its private snapshot-to-staging identity;
- the exact Validator/runtime-core prerequisites used to validate execution contracts and prepare
  inert action programs;
- official package byte reclosure, package/surface index summaries, and dynamic obligations;
- forged-authority precedence, private byte-drift rejection, execution-Catalog and Bundle-contract
  rejection, trusted-port disagreement, and redacted internal failure;
- deterministic independent candidates with no mutable staged or active slot;
- every public finite-profile field through an exact/one-over vector or explicit executable
  dominance evidence;
- public immutability and compiler-negative exclusion of active, previous-good, generation, bytes,
  paths, loaders, commit, and activation authority;
- source, built-distribution, public-export, package-script, root-command, aggregate-tail, and
  modular-CI receipts;
- deterministic regeneration, no-follow reads, bounded inert options, atomic writes, and hostile
  mutation rejection; and
- exact trace rows `PIPE-006`, `PIPE-015`, `R-124`, `R-126`, and `R-127`, plus the task-owned
  `PLANNED` contributions and final evidence pins in normative rows `N-038` and `N-041`.

The registered suites pass 13 focused runtime cases, 13 compiler-negative cases, and 17 independent
root proof/mutation cases.

Artifact: `docs/proof/artifacts/control-plane-api-0.1.0-runtime-staging.json`

Final receipt:
`sha256:d025da5329d5b56b9b46e7292a08883386a151add5e419edf2a9345425319494`

## Explicit nonclaims

- M07-T04 reference authority and M07-T06 staging authority remain independent pre-commit evidence;
  neither alone can activate a revision.
- M07-T07 still owns the durable atomic `{ activeRevision, previousGoodRevision, generation }`
  record and the authenticated join of both branches.
- M07-T08 through M07-T10 still own restart recovery, fault injection, invalid-candidate behavior,
  concurrent activation, and last-known-good preservation.
- M07-T11 still owns channel consumption by the separately built reference host.
- Staged artifact copies are inert loading-plan data; this task does not load or execute package
  code, render a surface, or invoke a target adapter.
- A successful staging result is not a channel pointer, durable commit, active snapshot,
  previous-good record, recovered generation, rollback result, or host notification.
- Each candidate is individually bounded and its private state is weakly owned by its public
  authority, but M07-T06 imposes no process-wide count on caller-retained candidate authorities.
  M07-T07 must define the consume/reject lifetime used by activation orchestration; callers must not
  retain abandoned candidates as an application-level cache.
- P-12 remains `NOT_PROVEN`; N-038 and N-041 retain later owners and remain `PLANNED`.
- M12-T05 still owns final measured cross-system limits, and M12-T12 still owns packed
  external-consumer integrity.
- This checkpoint supports the authenticated Web–React package profile; native targets require
  separately reviewed target packages and adapters.

## Reproduction after final registration

```sh
pnpm verify:control-plane-local-api
pnpm --filter @desen/control-plane-api... build
pnpm --filter @desen/control-plane-api typecheck
pnpm --filter @desen/control-plane-api test:runtime-staging
node scripts/generate-control-plane-runtime-staging-proof.mjs
node scripts/verify-control-plane-runtime-staging.mjs
node --test tests/control-plane-runtime-staging.test.mjs
```
