# Control Plane API

A local-first control-plane application for editable sources, immutable Bundles, mutable channel
pointers, and durable runtime activation. Publication stays in `@desen/publisher`; this application
stores publication outputs, verifies candidate inputs, prepares active-separated runtime indexes,
and commits or reconstructs an exact preflight-joined candidate against one atomic activation
record. It is proof-environment infrastructure, not the public `desen.run` developer API.

## Status

M07-T01 implements a persistent, revision-addressed store for exact Bundle bytes. M07-T02 adds a
separate synchronous integrity boundary for treating those stored bytes as untrusted input.
M07-T03 consumes only that authenticated authority and independently resolves and fingerprints the
complete installed Web–React package set. M07-T04 consumes only that exact package authority and
preflights its M07-T04 static surface, capability, event, navigation, resource, command, and
operation references under one fixed finite profile. M07-T05 adds the authenticated local
transport and persistent editable-Source/channel metadata while keeping channel discovery separate
from staging and activation. M07-T06 separately consumes the exact M07-T03 package authority,
re-closes its private package snapshots, validates execution contracts, and prepares callback-free
runtime indexes without changing active state. M07-T07 authenticates and joins the independent T04
and T06 private lineages, re-closes the complete Bundle from the same application-owned store, and
commits `{ activeRevision, previousGoodRevision, generation }` as one compare-and-set record before
publishing an in-process activation authority. M07-T08 recovers only that unchanged durable record:
it accepts exact M07-T03 package authorities for the record's active and optional previous-good
roles, internally reruns T04 and T06, recloses every referenced Bundle, and reauthenticates all
three durable fields before reconstructing active authority. Exhaustive fault and race matrices plus
reference-host consumption remain later M07 work.

The current implementation is a local POSIX filesystem profile. The low-level Bundle store treats
validation as a caller precondition; the T05 transport deliberately permits unverified candidate
bytes so later rejection paths remain real. Neither path silently acquires integrity authority: a
caller must pass a read entry through `verifyBundleStoreEntry` before handing its opaque success
authority to later M07 stages.

## Public API

The following is composition pseudocode. `applicationOwnedPackageInventory` represents a
host-owned integration that must supply the exact Catalog and all 80 reviewed Web–React
distribution artifacts. `applicationOwnedRecoveryAuthorities` represents exact M07-T03
authorities rebuilt through the same boundary for the durable record's roles; DESEN deliberately
exposes no package loader or discovery helper.

```ts
import {
  BundleStoreError,
  openBundleStore,
  openBundleRuntimeActivation,
  openLocalControlPlane,
  preflightBundlePackages,
  preflightBundleReferences,
  stageBundleRuntime,
  verifyBundleStoreEntry,
} from "@desen/control-plane-api";

const localApiToken = process.env.DESEN_LOCAL_API_TOKEN;
if (localApiToken === undefined) throw new Error("The local control-plane token is required.");

const localApi = await openLocalControlPlane({
  rootDirectory: "/absolute/application-owned/desen-data",
  apiToken: localApiToken,
  allowedOrigins: ["https://desen.app"],
});

const listener = await localApi.listen(0);
// listener.address is always 127.0.0.1; callers cannot choose a remote bind address.

const store = await openBundleStore({
  rootDirectory: "/absolute/application-owned/desen-data",
});

const activation = await openBundleRuntimeActivation({
  rootDirectory: "/absolute/application-owned/desen-data",
});

const write = await store.putBundle({
  revision: "sha256:<64 lowercase hexadecimal characters>",
  bytes: bundleBytes,
});

const read = await store.getBundle("sha256:<64 lowercase hexadecimal characters>");

if (read.status === "found") {
  const integrity = verifyBundleStoreEntry(read.entry, {
    status: "available",
    sourceBytes,
  });
  if (integrity.status === "verified") {
    const installedPackage = await applicationOwnedPackageInventory.requireExact({
      id: "run.desen.reference.sign-in",
      version: "0.1.0",
      target: "web-react",
    });
    const packagePreflight = preflightBundlePackages(integrity.authority, [
      {
        id: "run.desen.reference.sign-in",
        version: "0.1.0",
        target: "web-react",
        catalog: installedPackage.catalog,
        artifacts: installedPackage.artifacts,
      },
    ]);
    if (packagePreflight.status === "preflighted") {
      const references = preflightBundleReferences(packagePreflight.authority);
      const staging = stageBundleRuntime(packagePreflight.authority);
      if (references.status === "preflighted" && staging.status === "staged") {
        const result = await activation.activate(
          references.authority,
          staging.authority,
          null, // The first commit expects no durable activation record.
        );
        if (result.status === "activated") {
          // result.authority is current only for this open controller lifetime.
        }
      }
    }
  }
}

const restartState = activation.readState();
if (restartState.status === "recovery-required" && restartState.record !== null) {
  // Host-owned composition rebuilds exact M07-T03 package authorities for the two revisions
  // selected by restartState.record. It cannot choose a different revision or pass raw storage.
  const activePackageAuthority = applicationOwnedRecoveryAuthorities.active;
  const previousGoodPackageAuthority = applicationOwnedRecoveryAuthorities.previousGood;
  const recovered = await activation.recover(
    activePackageAuthority,
    previousGoodPackageAuthority, // Must be null when the durable field is null.
  );
  if (recovered.status === "recovered") {
    // recovered.authority is current only for this open controller lifetime.
  }
}
```

`openBundleStore` returns a frozen store with exactly two operations:

- `putBundle({ revision, bytes })` synchronously snapshots the caller's exact nonempty
  `Uint8Array` view before starting filesystem work.
- `getBundle(revision)` returns either `{ status: "missing" }` or a frozen `found` result whose
  entry contains a fresh byte copy. Mutating that returned copy cannot mutate stored content.

The root must already exist as an absolute, application-owned local directory; neither service
creates or chooses that authority for the caller. The package root exports the storage and
integrity values above plus the package, reference, runtime-staging, and runtime-activation
operations, their frozen finite profiles, stable diagnostic constants, the closed local transport,
and documented types.
Filesystem paths, file handles, partially parsed documents, internal authority readers, test fault
hooks, list/delete operations, loaders, repositories, SQLite handles, and executable callbacks do
not cross that root. The complete authenticated Bundle snapshot, accepted Catalogs, staged artifact
copies, runtime obligations, indexes, and live activation identity remain package-private.

## Local Source, Bundle, and channel transport

`openLocalControlPlane` composes three deliberately separate namespaces:

- editable Source records preserve exact strict-JSON bytes and use monotonic generation ETags;
- immutable Bundle records delegate exact first-writer ownership to the M07-T01 store; and
- mutable channels store only `{ channelName, revision, generation }` discovery metadata.

Source and channel creation requires `If-None-Match: *`; an update requires the exact current
`If-Match: "g:<generation>"`. A stale precondition returns `412` without changing state. An
identical value at the current generation is `unchanged` and does not advance the generation.
Channel updates require the target Bundle revision to exist, but do not verify or activate that
Bundle. A channel may therefore point at bytes that a later M07-T02–T04 preflight rejects; this is
intentional and keeps invalid-candidate/last-known-good behavior testable.

The fixed route set is:

| Method        | Route                       | Meaning                                     |
| ------------- | --------------------------- | ------------------------------------------- |
| `PUT` / `GET` | `/v1/sources/:sourceKey`    | CAS edit or exact-byte read of one Source   |
| `PUT` / `GET` | `/v1/bundles/:revision`     | Immutable exact-byte Bundle write or read   |
| `PUT` / `GET` | `/v1/channels/:channelName` | CAS update or read of one discovery pointer |

Every data request requires a host-supplied 32–256-byte visible-ASCII bearer token. The token is
reduced to a SHA-256 comparison digest before the returned service is created. A real listener
binds only `127.0.0.1`; browser origins are denied by default and CORS admits only exact configured
HTTP(S) origins and route-specific header sets. Data responses for an admitted origin expose only
`ETag`, allowing browser clients to perform the required compare-and-set update after a read or a
stale-write response. Query aliases, percent-encoded identities,
compressed request bodies, media-type parameters, wildcard origins, list/delete routes, and remote
bind options are rejected. Errors use closed codes and fixed messages without paths, SQL, stack,
token, body, or caller values.

The listener permits at most 5 seconds of socket inactivity, 15 seconds to receive one complete
request, and 5 seconds for an idle keep-alive connection. These finite limits ensure that a client
which sends only part of a request body cannot hold service shutdown open indefinitely.

SQLite stores only Source bytes, channel pointers, and their generations in
`control-plane.sqlite3`; Bundle bytes remain under the independent content-addressed tree. The
metadata profile uses strict tables, prepared statements, `BEGIN IMMEDIATE` CAS transactions,
`WAL`, `synchronous=FULL`, a finite busy timeout, an exact schema version, and durable database-file
creation. Importing the package root does not load SQLite's native addon; only
`openLocalControlPlane` dynamically loads the pinned adapter. `close()` first stops admission,
coordinates any listener startup, drains admitted work within the finite transport profile, and
then closes metadata.

## Bundle integrity boundary

`verifyBundleStoreEntry(entry, sourceMaterial)` is synchronous so both genuine `Uint8Array` views
are snapshotted before the caller can mutate them. `sourceMaterial` is an exact closed union:

- `{ status: "not-available" }` permits verification to continue while explicitly recording that
  the Bundle's claimed `sourceDigest` was not independently corroborated;
- `{ status: "available", sourceBytes }` requires the supplied Source JSON to pass the same strict
  ingress rules and its independently recalculated digest to match the Bundle.

The verifier performs these checks in causal order:

1. exact own-data entry capture and a genuine, non-shared byte snapshot;
2. the 2,097,152-byte raw Bundle ceiling, fatal UTF-8 decoding, no BOM, duplicate decoded-key
   rejection, I-JSON number/Unicode rules, and finite parser budgets;
3. explicit DESEN `0.1.0` support before general schema diagnostics;
4. a pre-allocation measurement of the parsed document against the complete Bundle's 2,097,152-byte
   RFC 8785 canonical UTF-8 ceiling;
5. a generated first-issue guard over the exact frozen root and embedded schemas, followed only on
   success by exhaustive structural validation, the same measurement on the accepted immutable
   snapshot, and an exact check against the real canonical bytes;
6. equality of the store key, embedded `revision`, and independently recalculated revision; and
7. when available, strict Source parsing, raw and complete canonical 8 MiB ceilings, guarded exact
   structural validation, and independently recalculated `sourceDigest` equality.

Only complete success returns `{ status: "verified", authority }`. The frozen authority exposes the
independent immutable Bundle, protocol version, closed revision, claimed Source digest, visible
`matched`/`not-available` corroboration status, and stored/canonical byte lengths. It exposes no raw
Bundle byte view or Source material. A clone or TypeScript cast cannot forge its package-private
runtime identity. Rejection returns one closed `stage`, immutable diagnostics, and no partial
authority. Relevant codes include `SCHEMA_INVALID`, `UNKNOWN_CORE_FIELD`,
`UNSUPPORTED_PROTOCOL`, `BUNDLE_LIMIT_EXCEEDED`, `REVISION_MISMATCH`,
`SOURCE_DIGEST_MISMATCH`, and the project-owned
`run.desen.control-plane/SOURCE_MATERIAL_LIMIT_EXCEEDED`.

`BUNDLE_INTEGRITY_LIMITS` documents the fixed project profile. In addition to both 2 MiB Bundle
ceilings, it applies depth, value-count, decoded-string, and number-token budgets to each parsed
document. Available Source JSON has separate 8 MiB raw and complete canonical ceilings matching the
bounded Publisher ingress scale. Source-budget exhaustion uses the namespaced Source-material
diagnostic rather than the protocol's Bundle-only `BUNDLE_LIMIT_EXCEEDED`; neither choice redefines
the final-Bundle size rule.

The structural guard is deterministic build output from the exact frozen Source, Bundle, and Draft
2020-12 schemas under pinned Ajv/Prettier versions. It uses fail-fast generated validators plus a
first-issue mirror of the established embedded-schema profile. Runtime code never compiles a
schema, loads executable code dynamically, resolves schema files, or accesses a network. Only a
guard-successful document reaches the established exhaustive Validator, preventing invalid node or
schema fan-out from allocating an input-proportional diagnostic report.

## Installed-package preflight boundary

`preflightBundlePackages(integrityAuthority, installedPackages)` is synchronous and accepts only a
live M07-T02 integrity authority. A copied object or TypeScript cast fails before the package
inventory is observed. The closed inventory consists only of inert candidate envelopes carrying an
exact `id`, exact Semantic Version, literal target, Catalog data, and complete target artifact
bytes. The public operation accepts no observed digest, callback, loader, registry, location,
resolver, mutable limit, or executable module.

Input snapshots use the enumerable own-data JSON surface only. Accessors, sparse arrays, custom or
Proxy-backed array prototypes, and unexpected enumerable string fields fail closed without invoking
caller code. Non-enumerable and Symbol decorations are deliberately ignored and never retained;
they cannot affect tuple resolution, Catalog validation, package bytes, or authority.

Checks run in this causal order:

1. authenticate the exact integrity-authority object;
2. capture a bounded dense package inventory without invoking accessors;
3. require exactly one literal `id`/`version`/`target` candidate for every positional Bundle
   requirement—without ranges, normalization, newest-version preference, best matching, or silent
   substitution;
4. snapshot only selected Catalogs as bounded inert JSON, validate the frozen Catalog schema, and
   close candidate/Catalog identity;
5. snapshot every selected artifact from a genuine non-shared `Uint8Array`, enforce portable
   lowercase-ASCII paths and the Web–React v1 entry limits, and independently rebuild the complete
   versioned digest framing;
6. require the Bundle requirement digest, Catalog self-digest, and calculated SHA-256 digest to be
   identical; and
7. validate all selected Catalogs as one non-ambiguous capability namespace.

The digest input is exactly the Web–React v1 magic value, a big-endian entry count, and sorted
length-framed `catalog.json` plus target artifacts. Only the top-level Catalog `packageDigest` is
projected to the reserved all-zero placeholder before RFC 8785 canonicalization. Artifact order and
Catalog object-key order therefore grant no identity; every Catalog value, artifact path, artifact
byte, and inventory shape does. Production code implements this verifier independently and does not
import the reference Catalog package.

Before the historical exhaustive Validator runs, a separate deterministic Catalog guard generated
from the exact frozen DESEN 0.1.0 Catalog schema stops at the first root issue with Ajv
`allErrors: false`. A sorted first-issue walk then applies the same Draft 2020-12 meta-schema and
custom dialect, URI, local-reference, vocabulary, and Unicode-regexp profile to every component or
behavior props/event/command/style schema and every operation or resource input/output schema.
Runtime code performs no schema compilation or dynamic loading. Namespace duplication is likewise
stopped by a fixed-category, sorted-key Set before the exhaustive Catalog-set consistency fence, so
neither structural nor ambiguity fan-out can allocate caller-proportional diagnostic reports.

Complete success returns one frozen runtime-authenticated `BundlePackagePreflightAuthority`. Its
public surface contains only the verified Bundle revision, safe byte-free package audit metadata,
and the positional requirement-to-package mapping. Catalogs and copied artifact bytes remain in
private authority state for later trusted stages. A failure returns one terminal stage and frozen
redacted diagnostics with no partial package or Catalog authority.

`BUNDLE_PACKAGE_PREFLIGHT_LIMITS` fixes the local work profile: at most 256 requirements, 1,024
candidates, 1,024 artifacts per selected package, 16 MiB per Catalog or artifact entry, 64 MiB of
aggregate Catalog bytes, and 64 MiB of aggregate framed package material, with additional published
identity, path, depth, value, string, capability, and diagnostic ceilings. These values reproduce
the initial target profile where applicable; they are implementation limits rather than new
universal DESEN 0.1.0 constants.

## Surface and capability reference preflight

`preflightBundleReferences(packageAuthority)` accepts exactly one live M07-T03 authority. It never
accepts a caller-selected Bundle, Catalog, package list, resolver, callback, loader, path, network
location, or limit override. A copied, cast, Proxy-backed, revoked, or stale public shape fails
before the private Bundle or Validator port is observed.

The implementation first performs one deterministic bounded walk over the already immutable
M07-T02 Bundle and the exact M07-T03 Catalog snapshots. The walk checks entry and surface identity,
the surface-wide node/behavior identity namespace, category-correct component/behavior/resource/
operation capabilities, declared component and behavior events, managed navigation targets,
surface resource refresh aliases, component command targets/names, and nested operation references.
It visits component and behavior slot trees in stable code-unit order and follows every operation
success/failure program without executing any action or dynamic value.

The same pass enforces the Reference Profile before staging: root depth is zero and depth 64 is the
last accepted source-tree level; one event or settlement turn admits at most 64 direct actions;
settlement nesting stops at 16; predicates admit at most 64 arguments and use a fixed per-expression
and whole-Bundle work budget. Repeat materialization uses the runtime-consistent effective bound
`min(declared limit ?? 1,000, 1,000)`. Literal repeat arrays use their real length; unresolved
dynamic repeat values use that conservative effective maximum. Saturating ancestor multiplication
counts conditional nodes as possibly present and rejects a surface whose maximum possible
materialization exceeds 5,000 nodes. No limit silently truncates a Bundle.

Only a guard-successful Bundle reaches `validateDesenBundleSemantics`, whose independent immutable
snapshot must have identical RFC 8785 canonical content. The exhaustive semantic fence cannot
amplify untrusted structure: M07-T02 already bounded and validated the complete graph, M07-T03
authenticated its Catalog set, and the T04 walk has already stopped every task-owned reference
issue. A disagreement or throw is redacted as an internal failure rather than exposing private
state.

Success returns a frozen, runtime-authenticated `BundleReferencePreflightAuthority` containing only
the exact revision, stable profile identity, and safe per-surface counts. The package authority,
Bundle, Catalogs, artifact bytes, and reference relation remain private. The handle grants no
execution-contract, runtime-index, staging, channel, activation, durable-commit, recovery, or
adapter authority; M07-T06 independently owns staging. M07-T07 now performs the required exact
private-identity join between those two branches before a durable commit; an equal visible revision
is not a substitute.

## Runtime-index staging boundary

`stageBundleRuntime(packageAuthority)` is the parallel M07-T06 branch from the exact M07-T03
authority. It does not accept an integrity authority, reference authority, channel record,
caller-selected Bundle or Catalog, loader, callback, package path, network location, active record,
or limit override. A copied, cast, Proxy-backed, revoked, or unknown public shape fails before any
staging port is observed.

The operation copies the already verified private artifact snapshots into a new candidate lifetime
and independently recalculates every Web–React package digest. It then authenticates the execution
Catalog set, validates the Bundle's complete static execution contracts, retains the sorted dynamic
runtime obligations, and prepares component and behavior action programs through runtime-core.
Private immutable indexes cover exact package artifacts, capabilities by category, surfaces, source
nodes, behaviors, state entries, resource aliases, handler selectors, operation aliases, and the
entry surface. Artifact bytes remain inert data; staging performs no dynamic import, target-adapter
lookup, render, host effect, or callback execution.

The fixed `BUNDLE_RUNTIME_STAGING_LIMITS` profile bounds package and artifact retention, aggregate
artifact bytes, capability entries, surfaces, source nodes, state entries, behaviors, prepared
handler programs, resource and operation aliases, and dynamic obligations. A limit crossing rejects
the whole candidate rather than returning a truncated index. Package-byte drift, trusted-validator
disagreement, failed action-program preparation, and unexpected internal errors likewise return one
closed redacted rejection with no partial staged authority.

Only complete success returns a frozen `BundleRuntimeStagingAuthority`. Its visible surface contains
the candidate revision, profile identity, document/entry identifiers, byte-free package and surface
audit summaries, and obligation count. A package-private identity retains the exact staged data for
later trusted composition. Every call creates an independent candidate; no mutable process-global
`staged` slot exists. The handle exposes no active revision, previous-good revision, generation,
channel, commit, rollback, recovery, adapter, loader, or host authority. M07-T04 reference admission
and M07-T06 runtime staging intentionally remain parallel; the M07-T07 activation boundary
authenticates and joins both exact identities before changing the durable activation record, then
consumes the staged identity before its first asynchronous store read.

Each candidate is finite and package-private state is weakly owned by its public handle, so an
unreachable candidate can be reclaimed. M07-T06 does not impose a process-wide count on handles an
application deliberately retains. Activation orchestration must not use abandoned candidates as a
cache; M07-T07 implements a one-shot consume/reject lifetime for each joined candidate.

## Durable runtime activation boundary

`openBundleRuntimeActivation({ rootDirectory })` opens the M07-T07 controller over the same
application-owned root as the immutable Bundle store and a separate internal
`runtime-activation.sqlite3` repository. It accepts no injected store, repository, database path,
active revision, previous-good revision, package loader, adapter, renderer, channel, or callback.
Importing the package root does not load the native SQLite adapter; opening this service loads it
lazily.

`activate(referenceAuthority, stagingAuthority, expectedGeneration)` authenticates both opaque
handles and requires their package-private M07-T03 authority and record identities to match. A
forged, copied, consumed, or mismatched pair fails before Bundle-store I/O and does not consume a
valid waiting candidate. Once the exact join succeeds, the staged authority is synchronously
consumed before the first asynchronous read. A later Bundle reclosure rejection, stale
compare-and-set result, generation exhaustion, or definite storage failure cannot reuse it.
Captured attempts are recognized only through an own discriminator field, so inherited
`Object.prototype` pollution cannot turn a forged-pair rejection into repository authority.

The controller then rereads the staged revision from the same immutable store, runs the integrity
boundary with Source explicitly unavailable, and requires equality with the complete private T04
and T06 Bundle snapshots, including `publication`. Only then may the repository derive and commit
one record:

```text
{ activeRevision, previousGoodRevision, generation }
```

The first commit requires `expectedGeneration: null` and produces generation `0` with no
previous-good revision. A later exact-generation commit increments the generation, moves a
different former active revision to `previousGoodRevision`, and preserves the existing
previous-good value for a same-revision recommit. Stale expectations and generation exhaustion do
not write; generations are safe integers and never wrap. The caller cannot independently choose
either revision field.

The controller separately binds every admitted attempt to its complete authenticated current
record before Bundle I/O. The SQLite transaction checks caller generation first, then requires that
full baseline to match before any write. A normal stale caller receives the actual durable record;
a deleted, inserted, or same-generation externally rewritten record requires recovery and cannot
reset or silently replace activation state. Recovery discovered while Bundle I/O is pending is
sticky and the consumed attempt cannot revive the controller.

The Web adapter reauthenticates schema version and exact schema under its `BEGIN IMMEDIATE` writer
lock before DML, then checks the exact committed row and schema before authority publication. A
trigger or table added after repository open therefore cannot manufacture a false successful
activation. Future Android and iOS repositories must preserve the same observable atomicity and
recovery rules without inheriting this SQLite implementation choice.

Only a certain durable commit publishes a current in-process
`BundleRuntimeActivationAuthority`. `readState()` returns `active` only for authority created by
that open controller. A preexisting durable record or an indeterminate commit returns
`recovery-required`; raw persisted fields are never promoted to runtime authority. M07-T08 proves
the separate revalidation and reconstruction boundary below, and M07-T09 proves the bounded,
closed pre- and post-commit boundary-fault matrix. M07-T10 retains ownership of the remaining
ordered fault-sequence and race matrix.

## Restart-recovery boundary

`recover(activePackageAuthority, previousGoodPackageAuthority)` operates only while `readState()`
is recovery-required with a non-null record. Its two arguments are exact opaque M07-T03 package
authorities rebuilt from application-approved installed package material. The active authority
must match the durable `activeRevision`; the second must match `previousGoodRevision`, or must be
`null` when that durable field is null. Missing, extra, swapped, copied, forged, proxied, or
revision-mismatched roles reject before Bundle-store I/O. A raw record, caller-selected revision,
T04 authority, T06 staged handle, path, store, loader, channel, callback, repository, SQLite handle,
or activation authority is not accepted as a substitute.

For every required role, recovery internally reruns `preflightBundleReferences` and
`stageBundleRuntime` over the authenticated package authority. It verifies the exact private
T03/T04/T06 lineage and synchronously consumes every internally created staging handle before the
first asynchronous store operation. It then rereads the active Bundle and, when present, the
previous-good Bundle from the same immutable store, repeats integrity verification with Source
unavailable, and requires complete equality with all retained snapshots. Both roles must succeed;
the controller never publishes active alone as a fallback for failed previous-good validation.

After those asynchronous reads, recovery rereads the repository and requires exact equality of
`activeRevision`, `previousGoodRevision`, and `generation` with the record that selected the roles.
Only then does it reconstruct current active authority. The validated previous-good lineage stays
package-private and grants no public rollback or loader. Recovery performs no durable write,
generation increment, pointer swap, or automatic fallback promotion. Closing the controller or
drift in any durable field prevents publication. Activation and recovery share one in-flight guard.

An empty or already active controller returns `not-required` without inspecting the supplied
inputs. An indeterminate `{ status: "recovery-required", record: null }` result cannot be guessed;
the caller must close and reopen the same root, observe the durable winner, and then supply its
exact package authority or authorities. A generation-zero record with a non-null previous-good
revision is corrupt because the T07 writer cannot produce it. Recovery at
`Number.MAX_SAFE_INTEGER` is valid and unchanged; only a later activation is generation-exhausted.

## Storage layout

An exact revision `sha256:<64 hex>` maps only to:

```text
<root>/bundles/sha256/<first 2 hex>/<remaining 62 hex>.bundle
```

The revision parser accepts only the exact lowercase SHA-256 digest form, so caller input cannot
add path components or aliases. Store-created writes use an exclusive same-directory temporary,
initially mode `0600`, and change it to read-only mode `0400` before commit.

## Immutable write outcomes

Each revision has first-writer ownership of one exact complete byte sequence:

- `stored`: this call committed the entry and completed the durability/read-back checks.
- `unchanged`: the revision already contains byte-identical content. The existing file is not
  rewritten.
- `conflict`: the revision already contains different exact bytes. The winner remains untouched.

Equality is deliberately byte-for-byte, not semantic JSON equality. DESEN 0.1.0 excludes
`publication` from the Bundle revision projection, but the immutable storage rule still forbids
changing the exact artifact under an existing revision. A publication-only byte change therefore
returns `conflict`; publication metadata that must vary belongs outside this immutable entry.

There is no overwrite, delete, mutable alias, or channel operation in the M07-T01 API.

## Commit and concurrency model

The writer creates a random exclusive temporary in the destination shard, writes every byte,
flushes it, and verifies its bytes and file identity. It then commits with a POSIX hard link to the
final path. Hard-link creation fails if that path already exists, so the implementation never uses
a replacing rename and concurrent writers cannot clobber the first winner.

New `bundles`, `sha256`, and shard entries are flushed through their parent directories. Before any
writer uses a shard, it flushes the `sha256` parent and revalidates the shard even when another
concurrent writer created it first. After linking, the store flushes the shard directory, removes
the temporary link, flushes the directory again, and reads the final entry back before reporting
`stored`. Readers accept only a read-only single-link final file and flush the shard before returning
accepted bytes. If a crash or overlapping reader leaves the exact owned committed temporary alias,
a reader removes that alias and flushes the shard; an unowned extra hard link fails closed. Readers
therefore see either no addressed entry or one complete regular file; the partial temporary is
never the addressed path. Concurrent identical writers produce one `stored` result and `unchanged`
results, while divergent writers produce one winner and `conflict` results without constructing
mixed bytes.

## Failure model

All public failures are `BundleStoreError` values with a stable `code` and fixed redacted message.
They do not expose local paths, operating-system details, caller values, or a raw cause:

- `INVALID_ROOT_DIRECTORY`
- `INVALID_REVISION`
- `INVALID_ENTRY`
- `UNSAFE_STORAGE_PATH`
- `STORAGE_IO_FAILURE`
- `COMMIT_OUTCOME_INDETERMINATE`

Before the final hard link succeeds, a failed call has not published the candidate as the addressed
entry. Once the link succeeds, a later flush, cleanup, hook, or read-back failure cannot honestly
claim that the entry is absent. Commit-aware cleanup flushes the shard again before the store reports
`COMMIT_OUTCOME_INDETERMINATE`. Retrying the exact same revision and bytes is safe: a durable prior
commit resolves as `unchanged`.

Reads and writes reject symbolic links, directories, FIFOs, replaced directory identities, and
other unsafe entries rather than following or replacing them. An owned partial temporary is
removed on a pre-commit failure when its identity can still be established.

An abrupt process death before the hard-link commit can leave an unaddressed temporary. It has no
revision authority and is never returned as a Bundle; long-term orphan maintenance belongs to the
later M07 recovery policy.

## Trust and platform boundary

This profile assumes a POSIX filesystem with same-directory hard-link and directory-flush
semantics. The configured root is local, absolute, and exclusively controlled by the application.
The store checks canonical directories, symbolic links, file types, and device/inode identity
around filesystem operations, but hostile same-UID or privileged mutation between separate
path-based Node.js system calls is outside M07-T01. Remote/object storage requires another
repository implementation with equivalent no-clobber and durability semantics.

Recovery preserves that trust boundary. Filesystem, SQLite, Bundle, package-lineage, and final-row
checks detect the specified drift and corruption classes, but the local root is not an external
authenticity anchor. Without a separately stored signature, monotonic sentinel, or equivalent
cryptographic commitment, an internally consistent historical or fully replaced database plus
matching Bundles cannot be distinguished from legitimate historical state. M07-T08 therefore
makes no tamper-proof, hostile-administrator, or anti-rollback claim.

## Explicitly deferred

M07-T01 through M07-T09 establish immutable exact-byte persistence, Bundle integrity, exact
installed-package preflight, bounded surface/capability reference preflight, authenticated local
Source/Bundle/channel transport, active-separated runtime-index staging, and one durable atomic
activation-record transition, exact restart reconstruction of an unchanged record, and a bounded
19-case fault matrix across discovery through recovery. They do not yet provide:

- M07-T10 complete A → invalid B → valid C, concurrent activation, and restart race matrices; or
- M07-T11 reference-host channel consumption.

Callers must not treat a successful M07-T01/T05 Bundle write or a channel pointer as integrity
verification, an M07-T02 integrity authority as package authority, an M07-T03 package authority as
reference authority, an M07-T04 reference authority as staging authority, or an M07-T06 staged
authority as committed or active state. A raw durable T07 record is not recovered runtime
authority. T09 proves the reviewed fault boundaries, but only T10 owns the complete ordered
activation and concurrency matrix.
