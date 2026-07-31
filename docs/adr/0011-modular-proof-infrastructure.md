# ADR 0011: Separate frozen evidence, current checkpoints, and proof execution graphs

- Status: Accepted
- Date: 2026-07-30
- Decision owner: I07-01
- Implementation status: I07-01 in progress; its candidate is non-authoritative, and no selector,
  required-CI cutover, compatibility cleanup, or legacy retirement is claimed

## Context

DESEN proof tasks intentionally freeze task-time artifacts and their SHA-256 receipts. Later tasks
must preserve those artifacts while authenticating successor source, tests, package registrations,
and CI coordination. The current repository achieves that fail-closed behavior, but some historical
proof readers now also carry:

- exact receipts for current successor files;
- duplicated live-reader inventories;
- source-string markers describing a successor's implementation;
- current build-graph normalization blocks; and
- knowledge of the sequential CI plan that happens to execute them.

These structures protected every completed proof while the implementation grew. They also mean a
legitimate successor can require coordinated edits in several historical readers even though the
historical artifact itself has not changed. The immutable evidence boundary, the current-code
checkpoint, and the execution scheduler are different authorities and should not continue to be
represented by the same modules.

The existing single-pass CI gate already avoids recursively rerunning identical prerequisite
chains. It validates a frozen inventory, executes every distinct reviewed workload from fresh
inputs, rejects writers and shortcuts, and preserves the tracked workspace. It is the authoritative
gate during this migration. This ADR does not declare a replacement implemented and does not
weaken any current proof, root mutation test, boundary check, or cancellation rule.

## Decision

I07-01 will define modular proof infrastructure with three separate layers:

1. **Frozen evidence** preserves what a completed task proved at task time.
2. **Current checkpoint** authenticates the exact live successor state accepted by the present
   repository.
3. **Execution graph** decides which fresh workloads must run and in which dependency order.

The separation is an authority boundary. A layer may consume a stable result from the layer below,
but may not silently recreate the other layer's authority.

### Frozen evidence

A frozen-evidence reader authenticates only:

- the immutable artifact bytes and SHA-256;
- the task-time prerequisite receipts projected into that artifact;
- the task's exact claims, non-claims, tests, and evidence schema; and
- an explicitly versioned current-checkpoint receipt when a current compatibility decision is
  required.

It does not pin arbitrary current source files, scan current source for required substrings, own
the global CI inventory, or rebuild an old artifact from successor code. Existing frozen artifacts
remain byte-identical. Migration changes readers and their current coordination, never historical
facts.

### Current checkpoint

The current checkpoint is a deterministic, bounded, versioned description of the live repository
state that successor compatibility needs. It owns exact current receipts and structured semantic
compatibility results that are currently duplicated across historical readers.

The checkpoint must:

- enumerate each current reader, test, source, package surface, or semantic successor once;
- authenticate tracked bytes through no-follow, identity-stable reads;
- reject missing, duplicate, reordered, substituted, accessor-backed, symlinked, or unbounded
  inputs;
- expose inert data only, with no callback, process, filesystem handle, or executable authority;
- identify the frozen evidence records that consume each checkpoint field;
- be changed only through an explicit reviewed append procedure and rebuilt in memory by its
  verifier; CI never writes or repairs it;
- fail closed when its schema version, ownership, receipts, or semantic projections are unknown;
  and
- never convert a current-checkpoint pass into a rewritten frozen artifact.

A checkpoint is current evidence, not a cache. Its result must be recomputed from the current
tracked state whenever the quality gate runs.

### Execution graph

The execution graph is a reviewed declaration of fresh workloads and their dependencies. Each node
has a stable id, exact argument-vector command, dependency ids, execution class, and the inputs or
checkpoint records that can affect it. Shell interpretation, hidden writers, affected-only
shortcuts, and unowned nodes remain forbidden.

Graph validation must reject:

- missing or duplicate nodes;
- missing, duplicate, or cyclic edges;
- an executable, argument, workspace package, proof verifier, or root test outside the reviewed
  inventory;
- a proof node whose focused test is no longer covered by its complete package suite;
- a selector input with no exact owner;
- an empty or partial plan caused by an unknown condition; and
- a plan that can report success without executing every selected node from fresh inputs.

Dependencies may run concurrently only when their complete predecessor set has passed and their
execution classes are proven not to race over the same build output, temporary authority, port, or
tracked path. I07-01 may measure verifier/root-test pairs at concurrency two only in a
non-authoritative exhaustive shadow. I07-02 cannot make that schedule required until shared-state,
output, port, and temporary-path ownership is code-owned and mutation-tested.

The runner installs permanent cancellation state before scheduling. On the first `SIGINT`,
`SIGTERM`, timeout, or workload failure, it stops launching nodes, forwards termination to every
active child process group, waits for them to close, preserves the primary failure, and never
starts a dependent node. Cancellation remains failure with the established exit status; it cannot
be transformed into a passing receipt by a later close event or workspace snapshot.

## Migration axes and phases

Authority and execution scope are independent:

- authority is `SHADOW` or `REQUIRED`;
- scope is `EXHAUSTIVE` or `AFFECTED`.

`SHADOW` means the result is measured but cannot make CI pass or skip an authoritative workload.
`REQUIRED` means the result participates in the repository pass/fail decision. `EXHAUSTIVE` means
every validated workload runs. `AFFECTED` means a proven selector returns a strict dependency
closure; it never returns a cached success. The phases are ordered, and code existence alone never
promotes authority.

### Phase 1 — I07-01: `SHADOW + EXHAUSTIVE`

The retained legacy gate remains the sole pass/fail authority. The modular candidate independently
loads and validates the current checkpoint, derives its schedule from the exact legacy plan, and
executes all 130 validated workloads from fresh inputs. I07-01 is a derived schedule, not yet the
complete input/dependency graph required for affected selection. Its result cannot make CI pass.

The exhaustive shadow compares, at minimum:

- complete verifier and root-test ownership;
- exact workload ids, commands, arguments, and pair order;
- package-test and global-step inclusion;
- tracked-workspace before/after identity;
- cancellation and sibling-process closure; and
- deterministic normalized schedule and checkpoint digests.

### Phase 2 — I07-02: `REQUIRED + EXHAUSTIVE`

The modular runner may become required only after same-revision local and hosted exhaustive
equivalence passes and shared mutable state is classified in code. The legacy runner remains
available for equivalence and rollback; it is not deleted at this cutover.

Required exhaustive execution preserves the existing fail-fast behavior, every proof and mutation
workload, dependency-boundary checks, tracked-workspace immutability, process-group cancellation,
exit codes, and clean-input requirement. A download cache may supply immutable dependencies, but
build output, test output, proof output, mutation success, checkpoint success, and proof success
are never read from cache.

### Phase 3 — I07-03: `SHADOW + AFFECTED`

The selector may plan a reduced graph only after required exhaustive equivalence is complete. It
maps authenticated changed inputs to the transitive closure of owning nodes and always includes the
global integrity checks required by that graph. Required CI still runs `EXHAUSTIVE` throughout
I07-03.

Before observation begins, I07-03 freezes a promotion threshold: every selector category must have
mutation coverage, unknown cases must choose `EXHAUSTIVE`, false negatives must remain zero, and at
least 20 consecutive same-revision hosted affected/exhaustive comparisons must agree.

The following conditions select `EXHAUSTIVE`:

- an unknown or unowned changed path;
- an absent, shallow, ambiguous, or untrusted comparison base;
- checkpoint, graph, workspace-manifest, package-manifest, or CI-policy drift;
- a missing or ambiguous owner or edge;
- a selector parse, size, traversal, or normalization failure;
- an unsupported change kind, rename, mode change, submodule, symlink, or special file; or
- any other condition not explicitly proven safe to select a strict subset.

Therefore `unknown => EXHAUSTIVE` is a protocol of the infrastructure, not a best-effort fallback.
The selector returns an execution plan, never a success result. Every selected workload still runs
from fresh inputs, and cached proof success remains forbidden.

### Phase 4 — I07-04: `REQUIRED + AFFECTED`

Only eligible pull requests may adopt affected execution after the frozen I07-03 threshold passes.
`main`, releases, and manual audits remain required and exhaustive. I07-04 also removes every
G07-due current-reader compatibility shim after its entry-specific closure checks pass.

### Phase 5 — I07-05: legacy retirement

The sequential runner remains available after selector promotion until Gate E, its rollback
exercise, hosted failure/cancellation evidence, and the G12-due zero-reference rules all pass.

## Equivalence and cleanup gates

The legacy system remains present until all applicable gates below have objective evidence.

### Gate A — checkpoint and graph identity

- Every current proof verifier, root mutation test, package test, boundary check, and global
  integrity check has exactly one graph owner.
- The modular `EXHAUSTIVE` workload set and command vectors equal the complete reviewed legacy
  workload inventory.
- Duplicate current receipts listed in `docs/plan/DEBT-REGISTER.md` are represented once in the
  checkpoint.
- Missing, duplicate, reordered, substituted, symlinked, hostile, and over-budget checkpoint and
  graph mutations fail closed.
- The I07-01 baseline pins the genesis checkpoint digest outside the hash-chained manifest; later
  appends preserve every previously pinned normalized checkpoint digest.

### Gate B — result and failure equivalence

- Separate clean-checkout legacy and modular `REQUIRED + EXHAUSTIVE` runs agree on terminal
  pass/fail status and leave identical tracked-workspace snapshots.
- Representative verifier failure, root-test failure, package-test failure, boundary failure,
  malformed inventory, and changed tracked-file cases fail at the same authority boundary.
- No modular receipt can claim pass when a legacy-required workload is absent, skipped, cancelled,
  timed out, or not observed closing successfully.

### Gate C — cancellation and process equivalence

- Cancellation before scheduling starts no workload.
- Cancellation between nodes starts no later node.
- Cancellation with multiple active nodes reaches every child and grandchild process group.
- A first workload failure stops scheduling, terminates active siblings, and starts no dependent.
- Repeated signals, `ESRCH`, close/error races, and cancellation during the final workspace
  snapshot cannot produce success.
- `SIGINT` and `SIGTERM` retain exit codes 130 and 143.

### Gate D — selector safety

- A path-to-owner mutation matrix proves the complete affected transitive closure for every
  selector category.
- Every unknown, missing, malformed, ambiguous, or unsupported case demonstrably selects
  `EXHAUSTIVE`.
- A selected run cannot use a previous checkpoint, build, test, mutation, or proof pass.
- `main`, release, and manual-audit `EXHAUSTIVE` runs remain required after selector rollout.
- Every selector category has mutation evidence, false negatives remain zero, and at least 20
  consecutive same-revision hosted affected/exhaustive comparisons agree.

### Gate E — legacy retirement

- Gates A through D have archived local and hosted evidence.
- Every relevant entry in `docs/plan/DEBT-REGISTER.md` is `READY_FOR_REMOVAL` or `CLOSED`.
- The legacy path has completed one rollback exercise after modular exhaustive execution became
  authoritative.
- Removing legacy code and workflow wiring passes the entry-specific zero-reference rules, the
  modular `EXHAUSTIVE` gate, and a hosted run from a clean checkout.

Only Gate E permits deletion of the legacy sequential implementation or its workflow authority.
Frozen artifacts and task-specific compatibility commands are not deleted merely because the
legacy scheduler retires.

## Cache and trust boundary

The dependency-download cache remains the only accepted CI cache. It cannot contain or authorize:

- current-checkpoint success;
- a selected graph;
- build or typecheck success;
- package, verifier, root-test, mutation, or boundary success;
- a Proof Matrix status;
- a frozen-artifact verification result; or
- a tracked-workspace snapshot result.

Cache hit or miss may affect download time only. It cannot affect selection, node ownership,
terminal status, or whether a required workload executes.

Current-checkpoint and graph inputs are repository-controlled tracked data. Pull requests from
untrusted forks may not write trusted caches or provide an authoritative comparison base. A
selector that cannot establish its base and complete changed-path set runs `EXHAUSTIVE`.

## Consequences

### Positive

- Completed task artifacts remain genuinely immutable.
- Current successor receipts have one explicit authority instead of several historical owners.
- The execution scheduler can evolve without rewriting proof semantics.
- Selective CI can be introduced behind measured equivalence rather than assumed coverage.
- Unknown changes, cancellation, and cache state remain fail-closed.
- Temporary legacy structures have named owners, triggers, deadlines, and zero-reference checks.

### Costs

- The migration temporarily retains both modular and legacy infrastructure.
- Shadow and equivalence runs add implementation and hosted-CI work before selection can save time.
- The checkpoint and graph need hostile-input, mutation, cancellation, and drift tests of their
  own.
- Some current historical readers remain larger until their debt entries reach their removal
  triggers.

### Non-claims

This ADR does not claim:

- that I07-01 is implemented or complete;
- that I07-01 is complete or its exhaustive shadow is authoritative;
- that `REQUIRED + EXHAUSTIVE` or either `AFFECTED` mode currently exists;
- that any debt-register entry is ready for removal;
- that the present proof count, execution plan, or hosted timing has changed;
- that selective CI is safe before Gate D;
- that a cached proof result is acceptable;
- that any frozen artifact may be regenerated from current source; or
- that M07-T02 or any protocol claim has advanced.

## Alternatives considered

### Continue adding current receipts to historical readers

Rejected as the long-term model. It is fail-closed but distributes current authority across
completed tasks and increases the number of historical modules changed by each legitimate
successor.

### Rewrite frozen artifacts at each successor

Rejected. This would erase task-time evidence and make a historical claim depend on code that did
not exist when the task completed.

### Enable path selection immediately

Rejected. Without checkpoint and graph equivalence, an incomplete mapping can silently omit a
required proof. Unknown inputs must first be proven to select `EXHAUSTIVE`.

### Treat a prior passing run as a reusable proof cache

Rejected. Repository state, tool behavior, generated output, and proof dependencies must be
re-observed in the current run. Only dependency downloads may be cached.

### Delete the legacy runner when modular exhaustive execution first passes

Rejected. One passing run does not prove failure, cancellation, selector, or hosted equivalence.
The legacy system remains until Gate E.

## Review triggers

Reopen this ADR when:

- a new proof layer cannot be expressed as frozen evidence, current checkpoint, or execution
  graph;
- a proposed cache would contain a pass/fail or selection authority;
- a selector category cannot conservatively route unknown state to `EXHAUSTIVE`;
- parallel execution requires shared mutable output without a proven execution-class boundary;
- the legacy retirement criteria need to weaken an existing proof or cancellation invariant; or
- a protocol task would need to rewrite a frozen artifact to consume the current checkpoint.
