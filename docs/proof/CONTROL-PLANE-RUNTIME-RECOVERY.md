# Control-plane runtime restart-recovery proof

## Result

M07-T08 passes the local executable proof for reconstructing in-process runtime authority from one
unchanged durable activation record. A restarted controller accepts only exact M07-T03 package
authorities for the record's active and optional previous-good roles, independently rebuilds both
runtime lineages, recloses every referenced Bundle, and reauthenticates all three durable fields
immediately before publication.

Artifact: `docs/proof/artifacts/control-plane-api-0.1.0-runtime-recovery.json`

Final receipt: `sha256:c65d4f2de1407fffb891b5d3ba2fc8a3a8d4e3f0fb76c8b8f2719be6b310b3f9`

Artifact size: 44,224 bytes.

## Exact prerequisite boundary

The proof directly pins the four immutable task artifacts that recovery consumes:

- M07-T01: the application-owned immutable Bundle store;
- M07-T04: exact reference and finite-profile admission;
- M07-T06: exact runtime-index staging; and
- M07-T07: the atomic `{ activeRevision, previousGoodRevision, generation }` record.

M07-T02 and M07-T03 remain authenticated transitive lineage inside those boundaries. Equal public
revision, package, document, or profile fields cannot replace the exact private authority identity.

## Durable role selection and public authority

Recovery does not accept a raw record or let a caller choose a revision. The controller first
observes its already opened repository and uses that durable record to select the required roles.
The caller supplies one opaque M07-T03 package authority for `activeRevision` and, only when the
record names one, one opaque authority for `previousGoodRevision`.

A missing, extra, swapped, forged, cloned, proxied, or revision-mismatched role rejects before
Bundle-store I/O. Recovery accepts no T04 authority, T06 staged handle, T07 activation authority,
Bundle path, store, package loader, channel, callback, repository, SQLite handle, or caller-provided
record. Rejected recovery exposes only a stable role, stage, and redacted diagnostic; it publishes
no partial authority.

## Complete lineage reconstruction

For each required role, the controller internally reruns M07-T04 reference admission and M07-T06
runtime staging from the exact M07-T03 package authority. It authenticates the package-private
T03/T04/T06 object lineage rather than comparing public summaries. Only after every required role
prepares successfully does it synchronously consume all internally created T06 handles before the
first asynchronous store operation. A caller-supplied or abandoned staged candidate cannot cross
the restart boundary.

The controller then rereads the active Bundle and, when present, the previous-good Bundle from the
same application-owned M07-T01 store. Each role repeats M07-T02 integrity verification with Source
unavailable and must equal the complete Bundle retained by its T03, T04, and T06 records. Missing,
unsafe, corrupt, revision-mismatched, or canonically different bytes publish neither active nor
fallback authority. Closing while active reclosure is pending prevents previous-good I/O from
starting and prevents later publication.

Successful reconstruction publishes only current active authority. The independently rebuilt
previous-good lineage remains package-private for later trusted composition; it grants no public
rollback, loader, or automatic execution authority.

## Final durable reauthentication and no-write rule

After every asynchronous Bundle read finishes, recovery rereads the repository and requires exact
equality of `activeRevision`, `previousGoodRevision`, and `generation` with the record that selected
the roles. Drift in any field, row deletion, or an unresolved read leaves the controller
`recovery-required`. This final durable observation wins even when asynchronous lineage
reconstruction also rejects, so the controller cannot stay pinned to stale restart state.

Successful recovery does not call the repository writer. It performs no compare-and-swap,
generation increment, pointer swap, fallback promotion, or automatic rollback. The durable record
is field-for-field unchanged. A recovered record becomes the exact baseline for the next ordinary
activation transaction.

Generation zero is valid only with `previousGoodRevision: null`; a generation-zero record naming a
fallback is impossible through the T07 writer and rejects as corruption. Recovery at
`Number.MAX_SAFE_INTEGER` succeeds without changing the record, while the next activation remains
generation-exhausted rather than wrapping or resetting.

## Controller-state outcomes

Activation and recovery share one in-flight guard. A busy controller rejects concurrent work, and
`close()` revokes current authority and prevents pending reconstruction from publishing.

- `empty` or `active` returns `not-required` without inspecting supplied recovery inputs;
- a non-null `recovery-required` record may be reconstructed only through the exact roles above;
- a null indeterminate record remains `recovery-required` without input inspection; and
- the null case requires closing and reopening the same root so a fresh repository observation can
  identify the durable winner.

A post-COMMIT observation failure can therefore recover the actual durable winner without
inventing or rewriting state.

## Executable evidence

The proof authenticates:

- 12 focused application runtime cases;
- 14 compiler-negative public-contract cases;
- 9 independent root proof and mutation classes;
- four exact direct prerequisite artifacts;
- the task-owned source, built public declarations, and runtime distribution;
- deterministic generation, verification, and atomic artifact writing; and
- authority, runtime, implementation, artifact-byte, writer, options, and deep-immutability
  mutation classes.

The final hardening receipt parses exact TypeScript AST structures rather than accepting matching
text. It pins the complete 105-entry public export inventory and digest, rejects private recovery
or storage symbols at that boundary, authenticates executable CI registration tuples and
shared-state mappings, and proves the direct 12-case runtime plus 9-case root registrations.
Code-owned exact source receipts bind those AST inventories to the executable test bodies and
effective CI/shared-state flow, so dead, shadowed, or decoy syntax cannot create a false pass;
semantic token receipts independently bind the four production recovery sources. The proof
separately checks the exact 36-key surface loaded from the built runtime module. Every proof
authority read is byte-bounded and uses a no-follow handle with stable file and canonical-parent
identity checks. The real SQLite probe records the same durable row and the same database bytes
before and after recovery, making the no-write rule executable evidence rather than only a
source-level claim.

The focused matrix covers generation-zero recovery, active/previous-good reconstruction and the
next CAS, same- and different-revision private lineage retention, forged role authorities, missing
or unsafe Bundles, post-COMMIT winner recovery, all three durable-field drifts plus deletion, close
during two-lineage reclosure, T04/T06 rejection, safe-integer maximum, impossible durable state,
busy serialization, and no-op recovery.

## Reviewed reader checkpoint

Reviewed checkpoint sequence 17 links exact sequence 16 head
`f9e77791148c7f89e586b6eb8964338185a35c11900b69262a159002af0838cd` to current head
`cc7227fe73f0b03fa56e18c075de5bc8bb2f87c4425aa669fd437ed2cc09730e`. It authenticates 17 frozen
artifacts and 34 live readers, appends this 44,224-byte artifact at the final receipt above, and
reseals existing reader indexes `[14, 15, 16, 18, 22, 26, 27, 28, 29, 30, 31]` after the narrow
current-reader compatibility projections.

The sequence appends the 84,219-byte proof reader at `[32]`
(`sha256:08f143107430dde90cf1865c21d7ce1ec854897b0c1c4306b96525bdd0d18daa`) and the 24,939-byte root
reader at `[33]` (`sha256:b97e7991e0ac20e7232112594228fdd829a536e81d16d06fd3f909e7e3a02492`).
Sequences 1–16 and all 16 predecessor artifact files remain byte-identical. This is reviewed local
reader evidence and makes no hosted M07-T08 claim. `DEBT-I07-015` records the temporary historical
recovery-reader bridges under I07-04 for removal by G07.

Reviewed checkpoint sequence 18 links exact sequence 17 head
`cc7227fe73f0b03fa56e18c075de5bc8bb2f87c4425aa669fd437ed2cc09730e` to sequence 18 head
`4e9ac8adac57d058444bfe2113fbb5dd364cd24d6052ad5f2cd8910a13c22b45`. It preserves all 17 frozen
artifacts and all 34 reader identities while resealing reader indexes
`[0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 14]` after the final fail-closed T08 compatibility-reader
upgrade. Sequence 17 and every artifact byte remain unchanged. This is reviewed local-reader
evidence and makes no hosted M07-T08 claim; the temporary compatibility bridges remain registered
for I07-04 removal by G07.

Reviewed checkpoint sequence 19 links exact sequence 18 head
`4e9ac8adac57d058444bfe2113fbb5dd364cd24d6052ad5f2cd8910a13c22b45` to sequence 19 head
`abf161e5a85053e19ce218127aa3f7d3a3ac8480b68b01a4185618ac732393a3`. It preserves all 17 frozen
artifacts and all 34 reader identities while resealing only reader index `[28]` to 93,916 bytes
(`sha256:d0b6ec50df131066283619a01fa41fffdbb2a68c409d3c8d1a816f625f658521`). The fail-closed staging
verifier caught equal-length final T08 N-038/N-041 normative wording with stale semantic hashes;
sequence 19 records the corrected reader receipt. Sequences 1–18 and every artifact byte remain
unchanged. This is reviewed local-reader evidence and makes no hosted M07-T08 claim; the temporary
compatibility bridges remain `DEBT-I07-015`, owned by I07-04 for removal by G07.

Reviewed checkpoint sequence 20 links exact sequence 19 head
`abf161e5a85053e19ce218127aa3f7d3a3ac8480b68b01a4185618ac732393a3` to current head
`8ba332b059e508dcb93aec4211edf3dcb10fb497d3a743b61ff7ee7e08c8a28e`. It preserves all 17 frozen
artifacts and all 34 reader identities while resealing only reader index `[30]` to 106,509 bytes
(`sha256:d322bf867930215d0f9e0f532bdacbea4ba50145dfa5df38f2e559102cc080ef`). The fail-closed T07
activation reader exposed stale T08 successor receipts after terminal close-race hardening changed
the runtime-activation-internal source, focused tests, and generated JavaScript/source map. The
exact successor receipts were repaired; the activation verifier and 18/18 root tests pass, and
this receipt repair changed no production behavior. Sequences 1–19 and every artifact byte remain
unchanged. This is reviewed local-reader evidence and makes no hosted M07-T08 claim; the temporary
compatibility bridges remain `DEBT-I07-015`, owned by I07-04 for removal by G07.

## Trace and coverage truth

The evidence authenticates the M07-T08 owner rows `PIPE-017` and `A-009`.

This task proves exact restart reconstruction only:

- P-12 remains `NOT_PROVEN`;
- N-004 remains `PLANNED` until M07-T09 proves the complete precommit fault matrix;
- N-038 and N-041 remain `PLANNED` for their remaining invalid-input and measured-limit owners;
- G07 remains open; and
- M07-T09 is the next implementation task.

## Trust boundary and explicit nonclaims

The canonical local root is application-owned and trusted. Path identity, SQLite schema and record
constraints, content-addressed Bundle verification, exact package lineage, and final row
reauthentication detect the specified corruption and replacement classes. They are not an external
authenticity anchor.

Without a key-backed signature, independently stored monotonic sentinel, or equivalent external
cryptographic commitment, recovery cannot distinguish an internally consistent historical
database—or a fully replaced valid-looking database plus matching Bundles—from legitimate
historical state. M07-T08 therefore makes no tamper-proof, rollback-attack-resistant, or hostile
administrator claim.

Further nonclaims remain explicit:

- M07-T09 owns exhaustive fault injection across fetch, integrity, package, reference, staging,
  durable commit, and recovery boundaries.
- M07-T10 owns A → invalid B → valid C, concurrent activation, restart races, and the remaining
  `journal_mode` decision.
- M07-T11 owns channel consumption and separately built reference-host notification.
- Recovery never promotes previous-good automatically or exposes a fallback loader.
- SQLite is the Web adapter only; future Android and iOS repositories must preserve the same
  observable record and recovery invariants without inheriting SQLite.

## Reproduction

```sh
pnpm verify:control-plane-runtime-activation
pnpm --filter @desen/control-plane-api... build
pnpm --filter @desen/control-plane-api typecheck
pnpm --filter @desen/control-plane-api test:runtime-recovery
node scripts/generate-control-plane-runtime-recovery-proof.mjs
node scripts/verify-control-plane-runtime-recovery.mjs
node --test tests/control-plane-runtime-recovery.test.mjs
```
