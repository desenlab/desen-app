# Control-plane runtime transition and race proof

## Result

M07-T10 passes a closed executable matrix for valid A → invalid B → valid C, same- and
different-candidate compare-and-swap races, both recovery/activation interleavings, restart from
the exact durable winner, and SQLite connection-profile drift. Invalid B never becomes in-memory
or durable authority, concurrent work produces one durable winner, and no race-specific public API
is added.

Artifact: `docs/proof/artifacts/control-plane-api-0.1.0-runtime-transition-races.json`

Final receipt: `sha256:f5f10dd422f9e1fc7ca4445b84bf192280e59fb747d8d2ed40357cba3ebc0f39`

Artifact size: 58,059 bytes.

This is reviewed local working-tree evidence. It does not claim a hosted M07-T10 run.

## Exact prerequisite boundary

The evidence directly authenticates the immutable artifacts for every completed predecessor from
M07-T01 through M07-T09. Each pin includes the exact path, byte count, SHA-256 receipt, task
identity, and `PASS` result. The transition proof therefore cannot substitute a regenerated
ancestor or infer the earlier storage, verification, package, reference, staging, activation,
recovery, or fault-injection boundaries transitively.

## Closed transition matrix

The focused suite owns 15 unique case identities and one sixteenth inventory guard:

1. `ordered-unsupported-protocol`;
2. `ordered-revision-mismatch`;
3. `ordered-source-digest-mismatch`;
4. `ordered-package-missing`;
5. `ordered-package-digest-mismatch`;
6. `ordered-reference-capability`;
7. `ordered-reference-limit`;
8. `ordered-staging-contract`;
9. `same-candidate-race`;
10. `different-candidate-race`;
11. `recovery-activation-race`;
12. `activation-recovery-race`;
13. `restart-stale-reconstruction`;
14. `journal-mode-external-transition`; and
15. `journal-mode-writer-reauthentication`.

The inventory guard requires the list to remain exact, ordered, duplicate-free, and closed. Each
of the first 15 test titles begins with its corresponding stable identity. AST checks, exact source
receipts, and the isolated Vitest receipt reject a missing, renamed, disabled, duplicated, or
additional case.

## A → invalid B → valid C

Each of the first eight cases starts from a real generation-zero A authority committed through the
public Bundle-store, integrity, package, reference, staging, and activation boundaries. B then
fails at one exact admission stage: protocol, revision, Source digest, package availability,
package digest, capability reference, finite reference depth, or execution contract.

After every B rejection:

- no B activation authority exists;
- the controller still exposes the exact authenticated A authority;
- an independent SQLite observation returns the byte-for-byte equivalent durable A record; and
- the same controller remains usable rather than entering a poisoned partial state.

A fresh valid C staging authority then commits generation 1 with `activeRevision=C` and
`previousGoodRevision=A`. After close and restart, recovery independently reconstructs exactly
that durable C-over-A lineage. The invalid B attempt never contributes an active pointer,
previous-good pointer, generation, runtime index, or reusable staging authority.

## Concurrent activation and recovery

The same-candidate and different-candidate cases use independent controllers over the same local
root. Exactly one compare-and-swap attempt commits. The loser receives the exact current durable
record, observes recovery-required state, and cannot replay its consumed staging authority. A safe
retry requires a fresh staging authority and the new generation.

Two deterministic rendezvous cases cover both directions of the recovery/activation race:

- activation commits C while stale recovery of A is waiting, so final-record equality rejects the
  stale reconstruction; and
- recovery first publishes A while a delayed C activation is in flight, then the controller's
  subsequent state read detects the durable C record and revokes stale A authority.

Closing and reopening after each race publishes only the exact final durable winner. No partial
active/previous-good record, stale generation, or losing runtime authority survives restart.

## SQLite `journal_mode` decision

The Web adapter establishes WAL once, but it does not treat the opening check as permanent
authority. The complete connection profile is reauthenticated:

1. inside the read transaction;
2. immediately after `BEGIN IMMEDIATE` and before any writer observation or DML; and
3. after `COMMIT` but before in-process authority publication.

A real second SQLite connection is unable to switch the managed live database away from WAL under
the exercised lock profile. A deterministic package-private drift seam separately proves the
important invariant: if any complete-profile field differs at the writer boundary, activation
fails closed before DML, preserves A, and never silently repairs or normalizes the drift. This is a
Web storage-adapter decision, not a protocol requirement that native hosts use SQLite.

## Public and private boundary

The TypeScript package-root inventory remains exactly 105 exports with receipt
`sha256:c3daff8c4df98edc5beaa3f64cb8805613ed5cb29b55aed771346ba3b8949e43`; the built runtime module
remains exactly 36 keys. The package manifest remains private and exposes only the exact `.` entry
to `dist/index.js` and `dist/index.d.ts`; no SQLite or alternate activation subpath is admitted.
Repository opening, the native SQLite handle, connection-profile checks, transaction hooks,
rendezvous seams, durable-record selection, and staging reset remain private.

Nine compiler-negative cases prove that callers cannot choose a concurrency shortcut, submit a
durable record, bypass reference preflight with package authority, inject recovery generation,
substitute staging for recovery authority, add a profile hook to public opening, import the private
repository or native database, or reset a consumed staging authority.

## Deterministic and mutation-resistant evidence

The root proof contains 12 independent classes covering exact construction, two-build byte
determinism, all nine prerequisite artifacts, runtime receipt and case-inventory drift, production
profile-guard removal and public-export growth, exact binding of all three captured CI byte sources
to their executable authority, all 15 missing trace assignments plus one extra assignment,
artifact-byte mutation, atomic-write failure with destination preservation, hostile
options/proxies/cycles/shared memory, unsafe symlinks and invalid UTF-8, and recursive freezing of
the complete evidence graph.

The evidence binds exact production, runtime-test, support, compiler-negative, and root-test source
receipts. Authority reads are byte-bounded, no-follow, single-link, and checked across stable file
and canonical-parent identity. Structured overrides accept only finite inert own data and authentic
non-shared byte views. Output is deterministic formatted JSON committed through the shared atomic
proof writer.

The focused runtime suite launches with `process.execPath` and the repository-local Vitest
entrypoint. Its owner-only temporary config disables cache and file parallelism, fixes one worker,
uses a bounded JSON reporter process, removes inherited `NODE_PATH`, limits time and output, and is
deleted in `finally`. Failure reports expose only code-owned case identities and bounded
size/digest metadata, never arbitrary paths or stacks.

## CI registration

The proof authenticates its root package scripts, focused app script, exact quality-gate and
neutral-inventory tuples, and effective shared-state classification. Both workloads are ordinary
non-barrier `PROOF_OS_TEMP_ISOLATED` steps. The verifier receives only
`VERIFIER_RUNTIME_PROBE` plus the narrow `CONTROL_PLANE_RUNTIME_TRANSITION_RACES_SQLITE`
native-addon policy. The root receives only `NODE_TEST_HARNESS` and no native-addon authority
because its mutation cases inject the authenticated runtime-suite receipt. Neither workload
receives workspace-write or port authority.

Captured CI, inventory, shared-state, and built distribution bytes are checked against the live
workspace before and after semantic module loading. Dynamic imports are keyed by the captured
SHA-256 receipt, so cached module behavior cannot be paired with a different recorded byte source.

M07-T10 appends one verifier/root-test pair to the I07-02 baseline without rewriting it. The live
successor contains 148 workloads and 70 proof units, with 463 retained prerequisite segments,
2,929 ordered legacy leaf invocations, and 230 distinct legacy leaves. These are code-owned local
successor values, not hosted evidence.

## Trace and coverage truth

The artifact authenticates exactly 15 assigned trace rows: `C-023`, `PIPE-005`, `PIPE-007`,
`PIPE-011`, `PIPE-016`, `PIPE-017`, `R-007`, `R-008`, `R-012`, `R-102`, `R-125`, `R-126`,
`A-007`, `A-008`, and `A-009`.

The complete M07-T02–T10 chain now advances N-038 to `TESTED`: invalid protocol, revision, Source
digest, installed-package availability/digest, capability/reference, finite reference-profile,
and execution-contract candidates fail before activation; the ordered sequence proves that each
rejection preserves A and does not prevent later valid C activation, while concurrent/restart
cases preserve the exact durable winner.

Later scope remains explicit:

- N-041 stays `PLANNED` until M12-T05 supplies the final measured whole-system finite-limit
  profile;
- P-12 stays `NOT_PROVEN` until M07-T11 proves separately built host consumption and M10-T07 proves
  product-level restart preservation;
- G07 remains open until M07-T11 and I07-04 are complete; and
- this task makes no hosted, mutable-channel-consumption, separately built host, native
  conformance, rollback API, tamper-proof, hostile-administrator, or independently anchored
  anti-rollback claim.

## Reproduction

```bash
pnpm --filter @desen/control-plane-api... build
pnpm --filter @desen/control-plane-api typecheck
pnpm --filter @desen/control-plane-api test:runtime-transition-races
node scripts/generate-control-plane-runtime-transition-races-proof.mjs
node scripts/verify-control-plane-runtime-transition-races.mjs
node --test tests/control-plane-runtime-transition-races.test.mjs
```
