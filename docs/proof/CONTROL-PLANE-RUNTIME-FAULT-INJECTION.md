# Control-plane runtime boundary fault-injection proof

## Result

M07-T09 passes a closed executable matrix across channel discovery, immutable Bundle fetch,
integrity, installed-package resolution, reference preflight, runtime staging, durable commit, and
restart recovery. Every failure before a certain commit leaves the authenticated A authority and
its complete durable record unchanged. A post-commit outcome that cannot be proven publishes no
candidate authority; only full restart recovery may authenticate the durable winner.

Artifact: `docs/proof/artifacts/control-plane-api-0.1.0-runtime-fault-injection.json`

Final receipt: `sha256:524a9a4be5af6f334dc643272b2268fae63207c6e7bed3f2f688d2e778caf6a1`

Artifact size: 64,493 bytes.

## Exact prerequisite boundary

The evidence directly pins all eight completed M07 predecessors rather than treating a later
summary as their replacement:

- M07-T01 immutable content-addressed Bundle storage;
- M07-T02 finite integrity, protocol, revision, and available-Source verification;
- M07-T03 exact installed-package tuple and artifact-digest admission;
- M07-T04 capability, surface, reference, and finite-profile preflight;
- M07-T05 local editable-source, immutable-Bundle, and mutable-channel API;
- M07-T06 staged runtime indexes and one-shot candidate lifetime;
- M07-T07 atomic active/previous-good/generation commit; and
- M07-T08 complete restart reconstruction without a durable write.

Each prerequisite is authenticated by exact path, byte count, SHA-256 receipt, task identity, and
PASS result. The proof therefore cannot silently substitute a transitive or regenerated ancestor.

## Closed boundary matrix

The application suite owns 19 unique stable case identities and one twentieth inventory guard.
Every case is a direct executable Vitest registration under one exact suite:

1. `channel-invalid-discovery` keeps an invalid mutable-channel candidate outside active authority;
2. `immutable-fetch-missing` stops a disappeared target before integrity authority exists;
3. `integrity-bundle-size` rejects the raw Bundle byte ceiling before parsing;
4. `integrity-bundle-json` rejects malformed immutable bytes before protocol checks;
5. `integrity-unsupported-protocol` rejects forward-version guessing before revision work;
6. `integrity-revision-mismatch` rejects valid Bundle bytes stored beneath a substituted key;
7. `integrity-source-digest-mismatch` rejects independently supplied Source drift;
8. `package-resolution-missing` preserves A when the exact package tuple is unavailable;
9. `package-digest-mismatch` preserves A when installed artifact bytes drift;
10. `reference-capability-unknown` rejects an unknown capability before staging;
11. `reference-depth-limit` rejects depth 65 before runtime indexes;
12. `staging-execution-contract` rejects static contract drift without partial indexes;
13. `commit-definite-precommit` rolls back real SQLite and keeps A current;
14. `commit-postcommit-indeterminate` recovers only the complete durable winner;
15. `recovery-package-authority` rejects swapped durable roles without writing;
16. `recovery-reference-preflight` rejects an externally selected invalid reference lineage;
17. `recovery-runtime-staging` rejects an externally selected invalid execution lineage;
18. `recovery-previous-good-reclosure` publishes neither role when fallback bytes disappear; and
19. `recovery-final-record-drift` lets the final durable observation win.

The inventory guard requires all 19 identities to remain closed and duplicate-free. Exact
test-source receipts plus AST inventories prevent comments, skipped registrations, renamed cases,
or a partial matching subset from satisfying the proof. The verifier also launches the focused
suite in a separate Vitest process and accepts only the exact 20-case all-passed receipt.

## Failure and publication invariant

The matrix begins from a real generation-zero A record created through the public Bundle store,
preflight, staging, and activation APIs. At every naturally reachable precommit boundary, the
candidate produces no activation authority, A remains the controller's authenticated current
authority, and an independent SQLite observation returns the exact unchanged durable A record.

A definite transaction failure is injected inside the real SQLite transaction and proves
rollback. The controlled post-COMMIT observation failure is different: commit may have succeeded,
so the controller publishes neither A nor the candidate as authenticated current state and enters
recovery-required. A newly opened controller independently reconstructs the complete durable
winner through the M07-T08 boundary before publishing authority.

Recovery cases independently reject swapped package roles, reference-preflight failure,
runtime-staging failure, a missing previous-good Bundle, and final durable-record drift. No failed
two-lineage recovery publishes either active or fallback authority. A newer final durable
observation wins over stale asynchronous reconstruction.

## Public and private boundary

M07-T09 adds tests and proof infrastructure, not a public fault-injection capability. The proof
pins the unchanged 105-entry TypeScript package-root inventory and the exact 36-key built runtime
module. Internal controller construction, repository opening, SQLite handles, transaction hooks,
fault callbacks, and package loaders remain package-private.

Ten compiler-negative cases prove that callers cannot add commit hooks to opening or activation,
inject a durable record into recovery, substitute T03/T04 authority roles, obtain authority from a
recovery-required or rejected result, or import internal activation and storage seams from the
public package root.

## Deterministic and mutation-resistant evidence

The root proof contains 11 independent mutation classes. They cover exact construction,
determinism, every prerequisite pin, the runtime-suite receipt, public-export and boundary-case
drift, all 22 task assignments plus an extra-assignment mutation, committed artifact bytes,
atomic writing and destination preservation, hostile option records and shared memory, unsafe
filesystem authorities and invalid UTF-8, and recursive immutability with later-task nonclaims.

Every file authority read is byte-bounded, no-follow, single-link, and checked for stable file and
canonical-parent identity. Byte overrides accept only authentic, bounded, non-shared Uint8Array
views. Structured runtime receipts are copied through inert own data descriptors with finite depth
and node budgets, rejecting getters, proxies, exotic prototypes, sparse arrays, cycles, symbols,
and non-finite values. Artifact output is deterministic Prettier JSON committed through the shared
atomic proof writer.

The proof validates executable package scripts, the exact CI and exhaustive-workload tuples, and
the effective shared-state classification. Its verifier runs in isolated OS temporary state with
bounded child-process and reviewed SQLite native-addon authority; the root proof uses the matching
isolated Node test policy.

## Reviewed reader checkpoint

Checkpoint sequence 21 links the exact sequence 20 head
`8ba332b059e508dcb93aec4211edf3dcb10fb497d3a743b61ff7ee7e08c8a28e` to current head
`09dc18bb199058c02542aae4c6121868b39ebb23939c4c906fa04a8b4b6fa19b`. It leaves sequences
1–20 and every predecessor artifact byte unchanged, appends this 64,493-byte artifact, reseals 27
historical compatibility readers, and appends the 54,361-byte proof reader
`sha256:9c4addd96f0f8a6ebc6881294721308203164809749a1b284639fb681a00feb2` plus the 14,927-byte root
reader `sha256:2ca667b80b65557dc0cbbf60b09d503ccb7aee14c36f4743c6798e3e7916a673`. The current chain
authenticates 18 frozen artifacts and 36 readers. This checkpoint is reviewed local-reader
evidence, not a hosted M07-T09 claim. `DEBT-I07-016` assigns the temporary T09 successor bridges to
I07-04 for removal by G07.

## Trace and coverage truth

The evidence authenticates the exact owners and tests arrays of 22 rows assigned to M07-T09:
`PIPE-006`, `PIPE-007`, `PIPE-009` through `PIPE-016`, `R-008`, `R-016`, `R-031`, `R-102`,
`R-126`, `R-127`, `R-138`, `A-008`, `D-030`, `D-031`, `D-034`, and `D-035`. It also rejects any
additional trace row that gains an undeclared M07-T09 assignment.

This task advances N-004 to `TESTED`: the completed T07/T08 implementation plus this closed fault
matrix now executes the required atomic-failure preservation boundary. It deliberately does not
overstate later work:

- P-12 remains `NOT_PROVEN`;
- N-038 and N-041 remain `PLANNED`;
- M07-T10 still owns A to invalid B to valid C, candidate races, concurrent activation, explicit
  journal-mode policy, and restart-race behavior;
- M07-T11 still owns mutable-channel consumption and notification by the separately built
  reference host; and
- G07 remains `NOT_STARTED` until all M07 tasks and I07-04 cleanup complete.

The application-owned local root remains trusted. Without an independent cryptographic or
monotonic anchor, this work makes no tamper-proof, hostile-administrator, or historical rollback
claim. SQLite is the Web persistence adapter; later Android and iOS repositories must preserve the
same observable atomicity and recovery invariants without copying SQLite-specific mechanics.
