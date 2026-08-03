# Control Plane API

A local-first control-plane application for editable sources, immutable Bundles, and mutable
channel pointers. Publication stays in `@desen/publisher`; this application stores publication
outputs and will later coordinate verification and activation. It is proof-environment
infrastructure, not the public `desen.run` developer API.

## Status

M07-T01 implements a persistent, revision-addressed store for exact Bundle bytes. M07-T02 adds a
separate synchronous integrity boundary for treating those stored bytes as untrusted input.
M07-T03 consumes only that authenticated authority and independently resolves and fingerprints the
complete installed Web–React package set. Editable-source persistence, channel pointers,
surface/capability reference preflight, staging, and activation remain later M07 work.

The current implementation is a local POSIX filesystem profile. It deliberately accepts only
already validated, revision-closed Bundle entries as a trusted caller precondition. The store does
not silently acquire integrity authority: a caller must pass a read entry through
`verifyBundleStoreEntry` before handing its opaque success authority to later M07 stages.

## Public API

```ts
import {
  BundleStoreError,
  openBundleStore,
  preflightBundlePackages,
  verifyBundleStoreEntry,
} from "@desen/control-plane-api";

const store = await openBundleStore({
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
    const packagePreflight = preflightBundlePackages(integrity.authority, [
      {
        id: "run.desen.reference.sign-in",
        version: "0.1.0",
        target: "web-react",
        catalog: installedCatalog,
        artifacts: [{ path: "dist/index.js", bytes: installedIndexBytes }],
      },
    ]);
    if (packagePreflight.status === "preflighted") {
      // Only this opaque authority may enter M07-T04 reference preflight.
    }
  }
}
```

`openBundleStore` returns a frozen store with exactly two operations:

- `putBundle({ revision, bytes })` synchronously snapshots the caller's exact nonempty
  `Uint8Array` view before starting filesystem work.
- `getBundle(revision)` returns either `{ status: "missing" }` or a frozen `found` result whose
  entry contains a fresh byte copy. Mutating that returned copy cannot mutate stored content.

The root must already exist as an absolute, application-owned local directory; the store does not
create or choose that authority for the caller. The package root exports the storage and integrity
values above plus `preflightBundlePackages`, `BUNDLE_PACKAGE_PREFLIGHT_LIMITS`, the four stable
package-preflight diagnostic constants, and their documented types. Filesystem paths, file handles,
raw or partially parsed documents, byte snapshots, Source material, internal authority readers,
test fault hooks, list/delete operations, loaders, executable callbacks, and mutable channel
operations do not cross that root. The complete immutable Bundle snapshot is carried only by an
authenticated integrity success; accepted Catalogs and artifact snapshots remain package-private.

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

## Explicitly deferred

M07-T01 through M07-T03 prove immutable exact-byte persistence, Bundle integrity, and exact
installed-package preflight. They do not yet provide:

- M07-T04 surface/capability reference and finite-limit preflight;
- M07-T05 editable-source storage, mutable channel pointers, or a control-plane transport API;
- M07-T06 through M07-T10 staging, transactional activation, last-known-good state, recovery, and
  fault matrices; or
- M07-T11 reference-host channel consumption.

Callers must not treat a successful M07-T01 write as integrity verification, an M07-T02 integrity
authority as package authority, or an M07-T03 package authority as reference, staging, channel, or
activation authority.
