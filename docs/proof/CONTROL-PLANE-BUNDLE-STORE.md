# M07-T01 — Immutable content-addressed Bundle store

M07-T01 is `PASS` for local exact-byte Bundle persistence under an immutable revision key.

## Proven boundary

The built `@desen/control-plane-api` package accepts an already validated, revision-closed
`{ revision, bytes }` entry and stores the exact nonempty `Uint8Array` snapshot under one
lowercase SHA-256 revision path:

```text
bundles/sha256/<first 2 hex>/<remaining 62 hex>.bundle
```

The official public Publisher golden is stored and reopened exactly:

- revision:
  `sha256:43eef0f11f9bcc4c13fc1eb5691ee974859001fbb4aeee8051948e7c8e195601`;
- canonical bytes: `2,173`;
- complete-byte SHA-256:
  `fac0ee3d559528af2f4274cdfb21979463cbadd419f2faba584263cc8b4c0247`.

The store snapshots caller bytes before asynchronous work and returns a new byte copy on every
read. A first write returns `stored`; the same bytes at the same revision return `unchanged`
without replacing the inode; different bytes return `conflict` and preserve the first winner.
Because DESEN 0.1.0 excludes root `publication` from the revision projection, a publication-only
variant retains the same protocol revision but still conflicts as a different exact stored
artifact.

## Commit and failure semantics

The local POSIX profile creates an exclusive temporary in the destination shard, writes and
flushes all bytes, changes it to mode `0400`, and verifies both bytes and inode identity. It
publishes with a no-clobber hard link, never a replacing rename. Parent directories are flushed
when the `bundles`, `sha256`, or shard entries are established. Every writer also flushes the
algorithm parent and revalidates the shard before using it, including when another concurrent writer
created that shard first. The shard is flushed around final publication and temporary-link removal
before `stored` is reported.

Concurrent equal writes from independent stores produce exactly one `stored` and the remaining
`unchanged`. Divergent writes produce one complete winner and one `conflict`; no mixed or partial
addressed file is visible. A committed temporary alias left by a crash or overlapping reader is
removed only when it has the exact final inode and owned temporary name. An unowned extra hard
link, symbolic link, special file, changed inode, mutable mode, or unsafe directory identity fails
closed.

Failures expose only the six documented `BundleStoreError` codes with redacted fixed messages.
Before the hard-link commit, failure does not publish the candidate under its revision. After the
commit point, cleanup flushes the shard again and a later failure reports
`COMMIT_OUTCOME_INDETERMINATE`; retrying the same revision and bytes is safe and resolves as
`unchanged` when the commit survived. Every accepted read also flushes the shard before returning,
so an observed committed entry cannot bypass the directory-durability boundary.

## Executable evidence

The evidence imports the built public package through its self-reference, publishes the frozen
official Source through the built public Publisher, and exercises store/reopen, identical retry,
publication-only conflict, synchronous input snapshot, read-copy isolation, and equal/divergent
multi-store concurrency. Eighteen focused package cases additionally cover pre-link visibility,
temporary truncation, post-link uncertainty, committed-alias cleanup, external hard links,
symlinks, directories, FIFOs, path keys, hostile objects, typed-array brands, root authority, and
the deliberately narrow API.

The artifact pins the task-owned source, exact package-root exports, tests, proof machinery,
generated Bundle-store distribution, four direct prerequisite receipts, and exactly five trace
rows: `PIPE-005`, `PIPE-009`, `R-012`, `R-125`, and `A-007`. Its aggregate dependency check keeps
the M06-T11 to M07-T01 edge exact while allowing later proof tasks to follow M07-T01.

It also pins the current proof-reader and root-test pairs that preserve immutable M05 and M06
artifact receipts while authenticating this task's approved successor surfaces. This external
anchor keeps the historical artifacts byte-for-byte unchanged without leaving their updated
compatibility readers outside the current evidence boundary.

`docs/proof/artifacts/control-plane-api-0.1.0-bundle-store.json`

`sha256:698be7d5610d1732ad991bf7e58131e81d2c34ffa888f65ec3c7916334f54795`

## Explicit non-claims

This task does not verify the supplied protocol version, claimed revision, available Source
digest, or final Bundle size; M07-T02 owns that ingress boundary. It does not verify installed
package tuples or capability references, expose editable Sources or mutable channels, activate a
revision, maintain last-known-good state, recover a transaction, or feed the reference host.

`N-010` therefore remains `PLANNED` for M07-T03 installed-package verification and M12-T12 packed
distribution evidence; `N-019` remains `PLANNED` for M07-T05 channel/control-plane integration.
The profile assumes an application-owned local POSIX root. It does not claim protection from
hostile same-UID or privileged mutation, non-POSIX hard-link semantics, or cleanup of an
unaddressed temporary left by an abrupt pre-link process death.

## Reproduction after the final pin

```sh
pnpm verify:publisher-invalid-source-matrix
pnpm --filter @desen/control-plane-api... build
pnpm --filter @desen/control-plane-api typecheck
pnpm --filter @desen/control-plane-api test:bundle-store
node scripts/generate-control-plane-bundle-store-proof.mjs
node scripts/verify-control-plane-bundle-store.mjs
node --test tests/control-plane-bundle-store.test.mjs
```
