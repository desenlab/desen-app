# ADR 0013: Commit runtime activation through one durable CAS record

- Status: Accepted
- Date: 2026-08-06
- Decision owner: M07-T07
- Implementation status: Implemented

## Context

DESEN 0.1.0 requires a runtime to stage a revision separately, activate it only after successful
preflight, and preserve the previous compatible revision as last known good. The frozen protocol
does not prescribe a persistence engine, first generation, same-revision behavior, compare-and-swap
conflict result, staged-candidate lifetime, or recovery API.

The preceding M07 boundaries deliberately expose separate evidence:

- M07-T04 proves that one exact M07-T03 package authority passed reference and finite-limit
  admission;
- M07-T06 independently prepares inert runtime indexes from one exact M07-T03 package authority;
  and
- M07-T05 channels remain mutable discovery pointers with no activation authority.

Joining T04 and T06 by visible revision alone would permit two unrelated package observations with
the same Bundle revision to be confused. Treating a T06 handle as reusable after an attempted
commit would also allow a stale or uncertain candidate to cross more than one transaction. Finally,
writing active and previous-good pointers separately would expose a crash window that the protocol
forbids.

## Decision

### Exact authority join and one-shot candidate transfer

The activation boundary authenticates both opaque handles without trusting their visible audit
fields. Their package-private records must contain the same M07-T03 `packageAuthority` object and
the same `packageRecord` object. Revision equality, canonical Bundle equality, or equal public
summaries are necessary consistency facts but are not authority.

Malformed, forged, stale, or mismatched pairs fail before consuming the staged candidate. After an
exact join succeeds, activation synchronously removes the T06 authority from its staged lifetime
before the first asynchronous operation. That transfer is one-shot: a second or concurrent use of
the same handle cannot reach storage. A validly admitted candidate remains consumed after a later
store rejection, compare-and-swap conflict, generation exhaustion, or definite persistence
failure; retry requires a new staging attempt. The controller admits at most one in-flight attempt
per instance, and a busy rejection does not consume another candidate.

The internal captured-attempt branch is selected only by its own `expectedGeneration` field. An
inherited `Object.prototype` field cannot reinterpret a rejected forged pair as an authenticated
T04/T06 join or allow it to reach Bundle-store and repository authority.

The activation composition then rereads the candidate revision from the same application-owned
M07-T01 Bundle store and repeats the M07-T02 integrity boundary with Source material explicitly
unavailable. The complete canonical Bundle, including `publication`, must equal the joined
candidate. This closes the fact that the exact candidate is durably represented in the
application's immutable store; an equal revision attached to different complete Bundle content is
not sufficient.

### One repository-owned activation transition

The durable contract contains exactly one optional record:

```text
{ activeRevision, previousGoodRevision, generation }
```

`activeRevision` is an exact lowercase SHA-256 revision, `previousGoodRevision` is either a
different exact revision or `null`, and `generation` is a safe integer from zero through
`Number.MAX_SAFE_INTEGER`. Generation zero must have `previousGoodRevision: null`; a non-null
previous-good value at generation zero cannot be produced by this transition and is corrupt.
Public callers supply only the expected generation and the exact authenticated candidate. The
controller separately supplies its complete authenticated current record—or authenticated
absence—to the package-private repository. Callers cannot select either revision field or
manufacture that baseline.

The repository calculates the transition inside one immediate transaction:

- a caller expectation that does not identify the transactional durable generation returns
  `precondition-failed` with the actual durable record and performs no write;
- when that caller expectation would permit a write, the complete durable record must also equal
  the controller's authenticated baseline; deletion, insertion, or a same-generation rewrite is
  `recovery-required`, not a fresh or trusted state;
- authenticated absence plus expected generation `null` commits the first candidate at generation
  `0` with `previousGoodRevision: null`;
- an authenticated existing record plus its exact expected generation commits a different
  candidate at the next generation and sets `previousGoodRevision` to the current active revision;
- recommitting the current active revision still advances the generation but preserves the existing
  previous-good revision; and
- baseline drift or exhausted generation performs no write.

Advancing a same-revision commit keeps the generation as an activation-attempt and concurrency
fence, while preserving the real fallback instead of replacing it with the active revision.
Generation never wraps and there is no `unchanged` activation result.

### Platform-neutral contract and app-internal SQLite adapter

The repository interface and observable record are platform-neutral. The first Web implementation
uses a dedicated `runtime-activation.sqlite3` file under the canonical application root; it does
not reuse the M07-T05 Source/channel metadata table. The database has one fixed-key `STRICT` row,
an exact schema version, fixed revision and generation constraints, WAL journaling,
`synchronous=FULL`, `trusted_schema=OFF`, a fixed busy timeout, prepared statements, and
`BEGIN IMMEDIATE` compare-and-swap writes. The adapter reauthenticates schema version and the exact
schema only after acquiring the writer lock and before reading or writing the singleton, so a
trigger or table added after open cannot cross the write boundary. Reads use a consistent read
transaction, and post-commit success is checked against the exact committed row and schema before
authority publication. New database files and their parent directory are flushed, and the adapter
revalidates the database and sidecar identities around operations.

M07-T10 closes the remaining connection-profile race explicitly. The complete profile—database-
level `journal_mode=WAL` plus connection-level `synchronous=FULL`, `foreign_keys=ON`,
`trusted_schema=OFF`, and the fixed busy timeout—is authenticated again inside every read
transaction, immediately after `BEGIN IMMEDIATE` acquires the writer lock and before any singleton
read or DML, and again before post-commit authority publication. A mismatch is corruption: the
adapter rolls back when the outcome is still definite, performs no write or publication, and never
silently repairs a changed PRAGMA. With the pinned SQLite build, a second live connection cannot
move an already used WAL database to rollback journaling and receives `SQLITE_BUSY`/`SQLITE_LOCKED`;
the transaction-local recheck remains required because an external change can otherwise occur
between repository acquisition and its first transaction, and because lock behavior is an adapter
fact rather than a protocol guarantee.

SQLite and `better-sqlite3` are application-internal Web adapter choices, not DESEN document
semantics or a requirement for future Android and iOS hosts. A native host may use another durable
repository only if it preserves the same record, atomicity, compare-and-swap, generation, and
commit-outcome rules.

This profile trusts the canonical local root as application-owned. Its path, schema, identity, and
transaction checks are fail-closed integrity controls, not an external cryptographic anchor. A
fully replaced but internally consistent historical database and matching Bundle store cannot be
distinguished from the latest genuine state without an independently trusted signature, monotonic
sentinel, or equivalent commitment. No tamper-proof or hostile-administrator claim is made.

### Durable state precedes observable active state

The controller never exposes a staged candidate as active. A successful repository commit returns
the complete committed record; only then does the controller synchronously transfer the consumed
runtime indexes into its single in-memory current slot. It invokes no caller callback between the
durable commit and that memory transition. A later successful activation replaces the former
in-memory authority; retaining an old public audit value does not keep it current.

Every admitted attempt snapshots the controller's complete authenticated current record before
Bundle-store I/O. Inside the same writer transaction, the repository compares both the caller's
expected generation and that authenticated baseline against the actual durable record. Therefore
an `expectedGeneration: null` request cannot recreate generation zero after another connection
deletes the singleton, and a valid-looking same-generation rewrite cannot be accepted as the
controller's current state. Ordinary stale caller input still returns the actual durable record as
`precondition-failed`; authenticated-state drift enters recovery instead of publishing a reset.

A definite failure before commit leaves both the durable record and the prior in-memory active
authority unchanged. A commit-phase failure whose outcome cannot be proved is reported separately
as `COMMIT_OUTCOME_INDETERMINATE`; it is never downgraded to a rejection or conflict, and no
candidate is exposed as active. The controller then requires recovery before another activation.

Opening a controller over an existing durable record likewise produces a recovery-required state,
not an active in-memory authority. M07-T08, specified by ADR 0014, revalidates the exact active and
optional previous-good T03 lineages, reruns T04/T06 internally, recloses both required Bundles, and
reauthenticates all three durable fields before reconstructing authority. An abandoned in-process
T06 candidate is never recovery evidence. A null indeterminate outcome requires reopening the same
root before the durable winner can be reconstructed.

After an in-process authority has been published, a definitive disappearance of its durable row is
also recovery-required rather than a new empty database. The controller revokes the in-process
authority, records an unknown durable outcome, and cannot admit a generation-zero activation. The
same rule applies when all three durable fields are externally replaced without changing the
generation. If `readState()` enters recovery while an admitted activation is awaiting Bundle I/O,
that decision is sticky: the pending consumed attempt cannot later commit, replace the known
recovery record, or revive authority. The
SQLite adapter acquires every prepared statement inside the same guarded open block so any partial
acquisition failure closes the native connection before the error crosses the storage boundary.

## Consequences

- Active, previous-good, and generation values cannot tear across separate writes.
- Caller generation conflicts remain distinguishable from complete authenticated-baseline drift.
- Two candidates using the same expected generation can have only one durable winner; the loser is
  consumed and must be staged again.
- Recommitting the same active revision advances concurrency state without destroying the actual
  previous-good revision.
- Mutable channels remain discovery metadata and cannot select or mutate the activation record.
- ADR 0014 adds restart validation and restoration without rewriting this durable transition or
  introducing automatic rollback.
- M07-T09 proves bounded boundary fault injection. M07-T10 proves A → invalid B → valid C,
  same- and different-candidate races, both recovery/activation orderings, exact restart behavior,
  generation fencing, consumed-loser freshness, and the fail-closed `journal_mode` profile
  decision. M07-T11 owns channel consumption by the separately built reference host.
- The boundary grants no module loading, adapter invocation, rendering, host notification, rollback
  policy, signing, network distribution, npm archive, or native-target conformance authority.
