# ADR 0014: Reconstruct runtime authority from an unchanged durable record

- Status: Accepted
- Date: 2026-08-07
- Decision owner: M07-T08
- Implementation status: Implemented

## Context

ADR 0013 makes one complete `{activeRevision, previousGoodRevision, generation}` record the durable
activation authority. A process restart, or a restart after an indeterminate commit outcome, has
that inert record but no authenticated T03 package lineage, T04 reference admission, T06 runtime
indexes, or in-process activation authority. Promoting the three stored fields directly would skip
the same package, reference, finite-limit, staging, and immutable-Bundle boundaries required before
the original commit.

Recovery also cannot use an abandoned T06 handle as evidence. A staged handle belongs to one
in-process candidate lifetime; surviving JavaScript object identity is neither a durable commit nor
restart proof. Conversely, asking a caller to choose a recovered revision or rewrite the durable
record would let input replace the repository-owned activation decision.

## Decision

### Recovery accepts only the exact durable T03 lineages

The public recovery operation accepts one opaque M07-T03 package authority for the durable active
revision and, only when the record names one, one opaque M07-T03 package authority for the durable
previous-good revision. The controller selects both required revision roles from its already read
durable record. A missing, unexpected, forged, cloned, swapped, or revision-mismatched authority
rejects before Bundle-store I/O and creates no recovered authority.

Recovery accepts no raw record, caller-selected revision, T04 authority, T06 staged handle, Bundle
path, package loader, channel pointer, callback, repository, or database handle. The supplied T03
authorities are evidence about exact host-approved package snapshots; they do not by themselves
select durable state.

### Both runtime lineages are rebuilt inside the boundary

For each required role, recovery reruns M07-T04 reference and finite-limit preflight and M07-T06
runtime-index staging from the exact T03 authority. It authenticates the private T03/T04/T06 object
lineage rather than trusting equal visible summaries. Only after every required role has prepared
successfully does recovery synchronously consume each internally created T06 handle before its
first asynchronous operation. No caller-supplied or abandoned staged candidate crosses the
restart boundary.

The controller then independently rereads the active Bundle and, when present, the previous-good
Bundle from the same application-owned immutable Bundle store. Each entry repeats the M07-T02
integrity boundary with Source material unavailable and must equal the complete Bundle retained by
its T03, T04, and T06 records. A missing, unsafe, corrupt, revision-mismatched, or canonically
different entry publishes neither active nor fallback authority.

Successful reconstruction retains the active runtime lineage as the public authenticated current
authority. The independently rebuilt previous-good lineage remains package-private so a later
trusted host composition can prove which fallback was validated. Recovery exposes no fallback
loader and does not promote or execute the previous-good revision automatically.

### Recovery authenticates but does not rewrite the durable decision

After all required asynchronous Bundle reads succeed, the controller rereads the repository and
requires exact equality of `activeRevision`, `previousGoodRevision`, and `generation` with the
record that selected the recovery roles. Missing state or drift in any one field remains
`recovery-required`; no reconstructed authority is published. The recovered authority carries the
unchanged complete record.

Recovery performs no durable write, compare-and-swap transition, generation increment, pointer
swap, or automatic rollback. Rollback remains host policy under DESEN 0.1.0 rather than an implicit
consequence of opening the application. A generation-zero record is valid only with
`previousGoodRevision: null`; a generation-zero record that already names a previous-good revision
is logically impossible through the transactional writer and is classified as
`ACTIVATION_CORRUPT`.

One controller serializes activation and recovery through the same in-flight guard. Closing the
controller prevents a pending recovery from publishing authority. An indeterminate state whose
record is `null` cannot be guessed or treated as an empty generation-zero database. The
application closes and reopens the same local root so a fresh repository observation can identify
the durable winner, then supplies the exact T03 authority or authorities for that observed record.

### Persistence remains platform-neutral and locally trusted

The observable recovery contract depends on the three-field record, exact package and Bundle
lineages, all-or-nothing authority publication, and unchanged generation. It does not depend on
SQLite. The Web implementation uses the ADR 0013 SQLite adapter; Android and iOS hosts may use
native repositories only if they preserve the same record validation, exact final
reauthentication, and fail-closed recovery semantics.

The current profile assumes the canonical local root is exclusively application-owned. File
identity, schema, constraints, transaction mode, and content-addressed Bundle checks detect the
specified corruption and replacement classes, but they are not an external authenticity anchor.
Without a key-backed signature, trusted external monotonic sentinel, or another independently
stored cryptographic commitment, recovery cannot distinguish an internally consistent historical
database—or a fully replaced, valid-looking database plus matching Bundles—from the genuine latest
application state. M07-T08 therefore makes no tamper-proof, rollback-attack-resistant, or hostile
administrator claim.

## Consequences

- Restarted runtime indexes are reconstructed only from the exact durable revision roles and fresh
  T04/T06 work.
- Active and previous-good lineages either both pass their required recovery boundaries or no
  authority is published.
- The durable record remains field-for-field and generation-for-generation unchanged by successful
  recovery.
- Private previous-good lineage retention does not grant public rollback or loading authority.
- A null indeterminate outcome requires a fresh repository open rather than a guessed winner.
- SQLite remains one Web storage adapter, not protocol syntax or a native-platform requirement.
- M07-T09 still owns exhaustive fault injection; M07-T10 still owns A → invalid B → valid C,
  concurrent-writer, restart, and storage-profile race matrices, including the pending
  `journal_mode` decision; and M07-T11 still owns separately built reference-host channel
  consumption.
