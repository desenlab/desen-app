# Control-plane runtime activation proof

## Result

M07-T07 passes the local executable proof for one durable transactional runtime-activation record.
The built Web control plane accepts only an exact private M07-T04 reference authority joined with
an exact private M07-T06 staged authority from the same M07-T03 lineage. It then recloses the
complete Bundle from the same application-owned M07-T01 immutable store and commits
`{activeRevision, previousGoodRevision, generation}` as one repository-derived record before it
publishes any in-process active authority.

Artifact: `docs/proof/artifacts/control-plane-api-0.1.0-runtime-activation.json`

Final receipt: `sha256:3129a8e40c837a1c49d7fe206de794e0f7f7e130dc7e5e90a012b9e38bf07334`

## Exact prerequisite boundary

This proof directly pins only the immutable evidence that M07-T07 consumes:

- M07-T01: the same application-owned content-addressed Bundle store;
- M07-T04: the exact reference-preflight authority branch; and
- M07-T06: the exact staged runtime-index authority branch.

M07-T02 and M07-T03 remain transitive private lineage inside the T04/T06 authorities. The proof
does not add their artifacts as redundant direct prerequisites and does not accept equal visible
revision, document, package, or audit fields as a substitute for object identity.

## Authority join and candidate lifetime

The activation controller reads the package-private T04 and T06 records without inspecting
caller-visible fields. Both records must retain the same `packageAuthority` object and the same
`packageRecord` object. A clone, proxy, forged handle, already consumed handle, or equal-revision
authority from another lineage rejects before Bundle-store I/O.

The captured-attempt discriminator accepts only an own `expectedGeneration` field. Focused
evidence pollutes `Object.prototype` with a complete-looking inherited attempt and proves that a
forged pair still rejects without Bundle-store I/O or a repository commit.

After that exact join succeeds, the T06 handle is synchronously deleted from the staging lifetime
before the first asynchronous store read. The transfer is one-shot:

- a successful activation consumes it;
- a later reclosure failure, stale compare-and-set result, generation exhaustion, or definite
  persistence failure still consumes it;
- a mismatched pair does not consume it; and
- a controller-busy rejection does not consume the waiting candidate.

This closes the implementation decision recorded by PF-075 without claiming a process-wide quota
for staged handles that callers never submit.

## Same-root complete Bundle reclosure

The public factory accepts only one canonical application root. It independently opens the M07-T01
Bundle store and its dedicated activation repository beneath that root; callers cannot inject a
store, repository, database path, active revision, or previous-good revision.

For an admitted candidate, activation rereads the exact staged revision from that immutable store,
repeats the M07-T02 integrity boundary with Source material explicitly unavailable, and requires
the complete canonical Bundle—including `publication`—to equal the T04 and T06 private snapshots.
A missing entry or same-key content that does not reclose rejects before the activation repository
is called and publishes no active authority.

## One atomic record and exact transitions

The public caller supplies only an expected generation and the authenticated candidate revision.
The controller also gives the platform-neutral repository its complete authenticated current
record—or authenticated absence. The repository derives both revision fields inside one
compare-and-set transition:

- missing → A commits `{activeRevision: A, previousGoodRevision: null, generation: 0}`;
- A → B commits `{activeRevision: B, previousGoodRevision: A, generation: 1}`;
- recommitting B advances to generation 2 while preserving previous-good A; and
- B → A advances to generation 3 and preserves B as previous-good.

A stale caller generation returns the actual transactional durable record and performs no write.
If that caller check would permit a write but the durable record differs from the controller's
complete authenticated baseline—including deletion or a same-generation rewrite—the result is
`recovery-required` and no write occurs. `Number.MAX_SAFE_INTEGER` exhaustion also performs no
write. The caller has no API for independently choosing either revision field or the authenticated
baseline, and generation never wraps.

Only a certain durable `activated` result becomes the controller's current in-process authority.
Replacing it revokes the previous private authority. A definite stale CAS loss preserves a matching
current authority; a result that disagrees with the current in-process slot enters recovery instead
of silently authenticating external durable state.

## Web SQLite profile

The first Web implementation uses the application-internal `runtime-activation.sqlite3` adapter.
SQLite is not DESEN protocol data and is not a requirement for future Android or iOS hosts.

The executable and source evidence pins:

- one fixed-key, constrained `STRICT` row and schema version 1;
- lowercase SHA-256 revision constraints and a safe-integer generation constraint;
- WAL journaling, `synchronous=FULL`, `trusted_schema=OFF`, foreign keys, and a fixed 5-second busy
  timeout;
- prepared statements and `BEGIN IMMEDIATE` compare-and-set writes;
- schema-version and exact-schema reauthentication under that writer lock before any DML, plus an
  exact post-commit row/schema observation before authority publication;
- exclusive creation and parent-directory synchronization for a new database;
- canonical parent, regular single-link database, inode, and `-journal`/`-shm`/`-wal` sidecar
  revalidation around operations; and
- redacted corruption, busy, closed, path, and storage failures.

`better-sqlite3` is imported lazily only when the public factory is called. Importing the built
package root does not load the native adapter. Package-private repository, SQLite, and authority
inspection functions are absent from the public package root.

## Commit outcome and recovery boundary

A fault before `COMMIT` rolls back and leaves the singleton record missing or unchanged. A fault
after `COMMIT` may have committed; it returns `recovery-required`, revokes the repository and any
prior in-process current authority, and permits no further activation through that controller.

Opening over a preexisting durable record exposes only a detached
`{status: "recovery-required", record}` observation. It never promotes raw persisted fields into an
authenticated runtime authority. M07-T08 must revalidate the record, reclose its Bundle and package
lineage, and reconstruct runtime authority after restart or an indeterminate commit.

If a record disappears after this process has published an authenticated current authority, the
controller revokes that authority and enters `{status: "recovery-required", record: null}`. It does
not reinterpret the disappearance as a fresh empty database, reset generation to zero, or consume
a candidate while recovery is required. All three prepared statements are also acquired inside the
same guarded SQLite open boundary; an acquisition failure closes the partially opened connection,
returns one redacted storage failure, and permits a clean reopen.

The complete authenticated-current snapshot also guards a direct `expectedGeneration: null`
attempt inside the repository transaction. Executable evidence deletes the durable row, calls
`activate()` without first calling `readState()`, and proves that no generation-zero row or
authority is recreated. Additional focused evidence replaces a durable row with another valid
revision at the same generation, discovers recovery while Bundle I/O is pending, and installs a
SQLite trigger after repository open. The rewrite cannot commit, the pending activation cannot
erase sticky recovery, and the live schema drift is rejected under the writer lock before DML.

## Executable evidence

The proof registers and pins:

- 21 focused application runtime cases;
- 25 compiler-negative public-contract cases;
- 18 independent root proof and mutation classes;
- three exact direct prerequisite artifacts;
- the task-owned source and built activation distribution;
- deterministic generation, verification, and atomic artifact writing;
- symlink, accessor, proxy, shared-memory, hostile byte-view, unknown-option, and changed-byte
  negatives; and
- exact public export, TSDoc, lazy-native-import, package-script, aggregate, modular-CI, child
  process, and native-addon policies.

The independent root classes mutate authority join, one-shot consume, Bundle reclosure, record
transition, SQLite transaction, recovery, public/private exports, tests, registrations,
traceability, coverage truth, proof pins, artifact bytes, filesystem identities, writer behavior,
option capture, runtime receipts, determinism, and recursive immutability.

## Trace and coverage truth

The evidence authenticates the exact M07-T07 owner rows `PIPE-007`, `PIPE-016`, `PIPE-017`,
`R-008`, `R-102`, `R-126`, `A-008`, and `A-009`.

This task proves the implemented transactional slice only:

- P-12 remains `NOT_PROVEN`;
- N-004 remains `PLANNED`: M07-T07 proves one exact preflight-joined,
  complete-Bundle-reclosed atomic record transition, while M07-T09 still owns the complete
  precommit fault matrix required to advance the clause;
- N-038 and N-041 remain `PLANNED`;
- PF-075 and PF-076 remain `OPEN`; and
- G07 remains open.

Those statuses are intentional. M07-T07's atomic-record contribution is real and executable, but
it does not yet prove every invalid precommit boundary across restart, final measured whole-system
limits, or the complete last-known-good product behavior.

## Explicit nonclaims

- M07-T08 still owns restart and indeterminate-commit validation plus reconstruction of active
  runtime authority.
- M07-T09 still owns exhaustive fault injection across fetch, integrity, package, reference,
  staging, durable commit, and recovery boundaries.
- M07-T10 still owns the complete A → invalid B → valid C, concurrent-writer, race, and restart
  matrices.
- M07-T11 still owns mutable-channel consumption and reference-host notification.
- The activation authority exposes no rollback method, package loader, adapter, renderer, channel,
  repository, SQLite handle, host callback, signing, network distribution, or package-publication
  authority.
- Android and iOS remain future target-specific hosts with native repositories that must preserve
  the same observable record, CAS, atomicity, and recovery rules.

## Reproduction

```sh
pnpm verify:control-plane-runtime-staging
pnpm --filter @desen/control-plane-api... build
pnpm --filter @desen/control-plane-api typecheck
pnpm --filter @desen/control-plane-api test:runtime-activation
node scripts/generate-control-plane-runtime-activation-proof.mjs
node scripts/verify-control-plane-runtime-activation.mjs
node --test tests/control-plane-runtime-activation.test.mjs
```
