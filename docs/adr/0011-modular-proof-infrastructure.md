# ADR 0011: Separate frozen evidence, current checkpoints, and proof execution graphs

- Status: Accepted
- Date: 2026-07-30
- Decision owner: I07-01
- Implementation status: I07-01 is complete historical shadow evidence. I07-02 is complete: its
  neutral inventory, exact rollback-equivalence adapter, shared-state authority, and exhaustive
  runner passed same-revision comparison; the official workflow now runs
  `REQUIRED + EXHAUSTIVE`. The temporary shadow workflow and modular comparison adapter/test are
  removed, closing `DEBT-I07-008`. I07-03 is complete: a separate pull-request-only
  `SHADOW + AFFECTED` observer is frozen at `0 / 20` without changing required authority. Its
  hosted bootstrap passed the authoritative Quality gate, while the shadow conservatively returned
  `NOT_ELIGIBLE` and `EXHAUSTIVE` for `UNSUPPORTED_CHANGE_KIND`; no eligible strict-subset
  observation, affected promotion, current-reader cleanup, or legacy retirement is claimed

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

At decision time, the existing single-pass CI gate already avoided recursively rerunning identical
prerequisite chains. It validates a frozen inventory, executes every distinct reviewed workload
from fresh inputs, rejects writers and shortcuts, and preserves the tracked workspace. It remained
authoritative through I07-01 and the I07-02 equivalence phase. The completed cutover retains it only
as a manual rollback path and does not weaken any proof, root mutation test, boundary check, or
cancellation rule.

## Decision

I07-01 defines modular proof infrastructure with three separate layers:

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
tracked path. I07-01 measured verifier/root-test pairs at concurrency two only in a
non-authoritative exhaustive shadow. I07-02 made that schedule required only after shared-state,
output, port, and temporary-path ownership became code-owned and mutation-tested.

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

During I07-01, the retained legacy gate remained the sole pass/fail authority. The modular
candidate independently loads and validates the current checkpoint, derives its schedule from the
exact legacy plan, and executes all 130 validated workloads from fresh inputs. I07-01 is a derived
schedule, not yet the complete input/dependency graph required for affected selection. Its result
cannot make CI pass.

The exhaustive shadow compares, at minimum:

- complete verifier and root-test ownership;
- exact workload ids, commands, arguments, and pair order;
- package-test and global-step inclusion;
- tracked-workspace before/after identity;
- cancellation and sibling-process closure; and
- deterministic normalized schedule and checkpoint digests.

### Phase 2 — I07-02: `REQUIRED + EXHAUSTIVE`

The modular runner became required only after same-revision local and hosted exhaustive
equivalence passed and shared mutable state was classified in code. The legacy runner remains
available for explicit manual rollback; it was not deleted at this cutover.

Required exhaustive execution preserves the existing fail-fast behavior, every proof and mutation
workload, dependency-boundary checks, tracked-workspace immutability, process-group cancellation,
exit codes, and clean-input requirement. A download cache may supply immutable dependencies, but
build output, test output, proof output, mutation success, checkpoint success, and proof success
are never read from cache.

#### I07-02 implementation checkpoint

The I07-02 neutral inventory is now the code-owned authority for the exact 130 workloads and 61
proof units. It owns stable ids, labels, shell-free command/argument vectors, explicit
dependencies, execution classes, and inert shared-state metadata without importing either
scheduler. Its normalized digest is
`sha256:bc8644fc1147166f98f905ec5fef1e6d81ef6e639008de9bd53e7256825abb94`.

The legacy sequential CI-01 implementation remains available as a rollback mirror. A separate
inert equivalence adapter compares all 130 ids, labels, commands, and argument vectors in exact
order, proves set equality and exactly-once ownership, and retains the reviewed sequential-plan
digest
`sha256:448102bdfc5e0ed331f09038a2c554dcb930300ec560d35ac94469fc89d5897f`.
Its terminal normalization rejects a passing claim for any missing, duplicated, skipped, not-run,
cancelled, timed-out, failed, or unclosed workload and preserves inventory, workload, workspace,
cancellation, and timeout failure authority while ignoring timing and sibling completion order.

The plan factory accepts only `EXHAUSTIVE`, defaults its authority to `REQUIRED`, and requires
`SHADOW` to be explicit. The runner executes the dependency-derived prefix, ordinary proof-pair
segments at concurrency two, ten drained tracked-alias pairs, the drained source-audit pair, and
the suffix. The accepted clean comparison at commit
`077560fe81d0fcf4560554dd7511413bad5bc30e` and hosted cutover at commit
`3cf72552ee3ea23a0b5e99f782f837bc6237f78b` completed that promotion. The official workflow now
executes this target as `REQUIRED + EXHAUSTIVE`; the retained sequential workflow decides status
only when a trusted operator explicitly dispatches `legacy-rollback`.

The hosted cutover run
[`30699616361`](https://github.com/desenlab/desen-app/actions/runs/30699616361) passed its required
job in 10 minutes 33 seconds. The manual rollback job was skipped and no shadow workflow triggered.
The exact evidence is archived in
[`i07-02-required-exhaustive-equivalence.json`](../proof/baselines/i07-02-required-exhaustive-equivalence.json).
The current-reader chain has two checkpoints and authenticates eight frozen artifacts plus sixteen
live readers at head
`95a4ebc5261c98569d0e42320aa300f70ec568d1083af38d869b06c82398368c`.

The shared-state authority classifies all 130 workloads exactly once:

| Execution class                  | Count |
| -------------------------------- | ----: |
| `GLOBAL_EXCLUSIVE`               |     6 |
| `WORKSPACE_OUTPUT_EXCLUSIVE`     |     1 |
| `PACKAGE_TEST_EXCLUSIVE`         |     1 |
| `PROOF_READ_ONLY`                |    66 |
| `PROOF_OS_TEMP_ISOLATED`         |    45 |
| `PROOF_TRACKED_ALIAS_EXCLUSIVE`  |    10 |
| `PROOF_WORKSPACE_TEMP_EXCLUSIVE` |     1 |

Fifty proof pairs are eligible for pair-level overlap at concurrency two. Their verifier and root
test remain dependency-ordered within the pair. Eleven pairs drain the scheduler: ten root tests
that deliberately create a real tracked alias plus `reference-host-web-source-audit`, whose root
test requires bounded workspace-temp authority.

Only five verifier proofs may create child runtime probes and write to their runner-owned temp
root: `publisher-catalog-pinning`, `publisher-bundle-publication`,
`publisher-official-golden`, `publisher-invalid-source-matrix`, and
`control-plane-bundle-store`. Native-addon authority is limited to three exact steps: the
`reference-host-web-source-audit` verifier/root-test pair and the
`publisher-invalid-source-matrix` root test, whose nested programmatic probe loads the reviewed
Rolldown binding. The source-audit verifier remains workspace-read-only.

Every proof step receives a fresh authenticated OS temp root and a generated Node permission
policy. Direct workspace-write grants, child processes, and native addons are absent unless its
exact classification grants them; inherited `NODE_OPTIONS` is rejected, and a required preload
denies TCP and UDP listener binding. Temp cleanup verifies directory identity before removal.

Node 24's asynchronous `fs.cp` implementation reads destination ancestors outside an otherwise
authorized step temp root, while its permission model rejects reviewed symlink calls whose target
is outside that root. Eighteen exact root-test records therefore carry an orthogonal schema-v2
compatibility policy: 112 workloads remain `NONE`, two are `FIXTURE_COPY`, fifteen are
`REVIEWED_SYMLINK`, and one is `FIXTURE_COPY_AND_REVIEWED_SYMLINK`. The ten real-alias workloads
are separated into `PROOF_TRACKED_ALIAS_EXCLUSIVE`; the other policies remain orthogonal to
scheduling.

Fixture copying accepts only one code-owned source root per workload, an absent or empty
no-follow destination under that workload's own temp root, and the exact recursive option shape.
It rejects symlinked or special source entries, bounds depth, entries, and bytes, and compares
source and destination fingerprints. Reviewed symlink handling keeps temp-to-temp links inside the
same authenticated temp root. Fourteen workloads additionally own eighteen exact workspace-target
rules: eight unsafe-input probes receive exact-byte files mirrored into their own temp root, while
ten canonical-path or inode probes retain their exact tracked target alias. Every workspace target,
target kind, destination parent, and resulting link is authenticated without following an
unreviewed path.

The generated permission list adds no workspace-write path, shared OS-temp parent, or sibling-temp
path. The compatibility preload is nevertheless a trusted-repository-code adapter, not an
adversarial operating-system sandbox: root tests already require child-process authority, and ten
historical checks intentionally exercise a real tracked alias. Those fixed tests perform no write
through the aliases; the complete gate's closing tracked-byte, mode, file-count, and Git-index seal
still rejects any persistent workspace mutation. The ten real-alias pairs also run only after the
parallel pool drains. Other workloads cannot claim the policy, and the historical proof tests and
artifacts remain byte-unchanged.

Required authority accepts only close observations emitted by the non-injected shell-free process
runner. Injected step, Git-reader, workspace-capture, guard, environment, spawn, signal, or timeout
seams are rejected before execution; those seams remain available only to non-authoritative
`SHADOW` contract tests. The hosted `SHADOW` candidate uses the real clean-input authority: before
the first workload, the checked-out HEAD must equal the authenticated revision and porcelain-v2
status must contain no staged, unstaged, non-ignored untracked, or submodule change. The later
hosted `REQUIRED` cutover must retain that same authority.

One monotonic terminal authority is shared from the host signal handlers through the scheduler and
all active process groups. The first timeout, process error, nonzero close, execution error, SIGINT,
or SIGTERM fixes the failure and exit code, stops new scheduling, and synchronously requests
termination for every registered group. Later signals may escalate to SIGKILL but cannot replace
the first cause. Results settle only after every active child emits `close` and isolation cleanup is
awaited.

I07-02 established a 15-minute soft terminal deadline. After the live inventory grew from 130 to
136 workloads, M07-T04 recalibrated only the complete-runner deadline to 17 minutes while retaining
the 15-minute per-workload timeout. The runner still awaits child `close`, cleanup, and boundary
capture rather than fabricating a completed receipt. The hosted command therefore keeps its
18-minute process ceiling with a 30-second kill grace, inside a 25-minute job ceiling. An
uncooperative hang is stopped by that outer process boundary and cannot qualify as promotion
evidence; dependency setup and contract checks retain separate hosted headroom.

Three independent closing guards remain mandatory for the required runner:

- a bounded no-follow seal over all reviewed build and Turbo output roots around the proof phase;
- a bounded digest of all non-ignored untracked entries around the complete 130-step execution;
  and
- the neutral gate boundary's tracked-byte, executable-mode, tracked-file-count, and Git-index
  identity comparison around the complete execution, including failure and cancellation paths.

These authorities do not implement affected selection and do not retire the sequential path.
`DEBT-I07-007` governs the rollback-only structures and their equivalence references; I07-05 may
remove them only after Gate E passes.

### Phase 3 — I07-03: `SHADOW + AFFECTED`

The selector plans a reduced graph only after required exhaustive equivalence is complete. It
maps authenticated changed inputs to the transitive closure of owning nodes and always includes the
global integrity checks required by that graph. Required CI still runs `EXHAUSTIVE` throughout
I07-03.

I07-03 freezes the promotion threshold before observation: every selector category must have
mutation coverage, unknown cases must choose `EXHAUSTIVE`, false negatives must remain zero, and at
least 20 consecutive eligible same-revision hosted strict-subset affected/exhaustive comparisons
must agree.

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

Boundary receipts carry process-local opaque provenance, so a caller-created or cloned record
cannot mint a selection. One comparison-authority digest seals the exact boundary, ownership,
impact, threshold, selector, shadow-runner, required-oracle, workflow, and toolchain sources; any
such source change resets later observation continuity. The affected graph explicitly projects the
exhaustive all-root suffix barrier to the exact selected roots and validates every selected proof
pair before execution. The frozen selector digest is
`sha256:20a78069ed829649ab9198cad68b5d7fede22dc3b6ec391ed84f5dd1f0afa86f` and binds 20 exact
comparison-authority sources.

The implemented observer owns the complete exact tracked-path set and runs only as a separate
pull-request shadow job. The exact `REQUIRED + EXHAUSTIVE` runner remains unchanged and solely
authoritative. The initial observation state is honestly `0 / 20`; promotion is false, so I07-04
remains `NOT_STARTED` until Gate D's threshold passes. `main` and manual-audit execution, including
the release process routed through those authorities,
remain exhaustive. In the hosted bootstrap, the authoritative Quality gate passed and the shadow
job returned `NOT_ELIGIBLE` → `EXHAUSTIVE` because the bootstrap contained
`UNSUPPORTED_CHANGE_KIND`. It therefore supplied no eligible strict-subset comparison and left the
counter at `0 / 20`. Exact run, job, revision, and receipt identifiers are archived in
[`i07-03-affected-selector-shadow.json`](../proof/baselines/i07-03-affected-selector-shadow.json);
the baseline makes no promotion claim. Focused local contracts passed 91/91 and the complete CI
infrastructure suite passed 203/203. The full local gate is
`BLOCKED_BY_LOCAL_SANDBOX`: loopback `listen` returned `EPERM` in two pre-existing TCP lifecycle
tests. That environment restriction is not a product regression; the passing hosted Quality gate
remains authoritative. `DEBT-I07-017` assigns the shadow-only job, wrapper, and test wiring to
I07-04 for removal by G07.

I07-03 also appends reviewed current-reader checkpoint sequence 22 without rewriting sequence 21.
It links predecessor head `ce12c066545e21779abf891898aaf0b09ceb1c0c1b51be382a0adabd5f86e939`
to `aef9881c8fc540873f889a09754e5f2c19adc3c19934ba0fcfcf5e6a12b2da9e`, retains the same 18
frozen artifacts and 36 reader identities, and reseals only workflow-dependent indexes
`[8, 10, 11, 12, 14]`. Every frozen artifact byte remains unchanged.

The I07-03 ledger is deliberately non-authoritative. It can report whether supplied observations
meet the 20/20 arithmetic, but it always returns promotion false because inert caller data cannot
prove hosted provenance. I07-04 must add and pin an independent exact GitHub run, job, revision,
and receipt review authority before required affected execution can be considered.

### Phase 4 — I07-04: `REQUIRED + AFFECTED`

Only eligible pull requests may adopt affected execution after the frozen I07-03 threshold passes.
`main` and manual audits, including the release process routed through them, remain required and
exhaustive. I07-04 also removes every
G07-due current-reader compatibility shim after its entry-specific closure checks pass.

The authenticated campaign reached 20/20 with zero false negatives. Promotion is bound to the
fixed historical campaign digest, one same-read current comparison snapshot, an exact tracked-tree
ownership delta, and a code-owned runner authority. A changed tracked tree cannot inherit affected
authority: it produces `NOT_ELIGIBLE` and exactly one exhaustive fallback. The local cleanup and
append-only checkpoint are complete; Phase 4 remains active until PR and post-merge hosted evidence
are pinned and every G07-due debt entry advances from `REMOVED_PENDING_HOSTED_PROOF` to `CLOSED`.

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
- `main` and manual-audit `EXHAUSTIVE` runs—including the release process routed through those
  authorities—remain required after selector rollout.
- Every selector category has mutation evidence, false negatives remain zero, and at least 20
  consecutive eligible same-revision hosted strict-subset affected/exhaustive comparisons agree.

### Gate E — legacy retirement

- Gates A through D have archived local and hosted evidence.
- Every relevant entry in `docs/plan/DEBT-REGISTER.md` is `READY_FOR_REMOVAL`,
  `REMOVED_PENDING_HOSTED_PROOF`, or `CLOSED`; the intermediate state already requires zero scoped
  references and exists only to capture the cleanup commit's hosted evidence.
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

- that I07-01's exhaustive shadow is authoritative;
- that its first same-revision comparison completes I07-02's required equivalence program;
- that the shadow `AFFECTED` observer is authoritative or that required affected mode currently
  exists;
- that any debt-register entry other than `DEBT-I07-008` is closed by this cutover;
- that the retained sequential runner or rollback-equivalence adapter may be removed before
  I07-05 and Gate E;
- that the protocol task count, proof-gate count, or protocol claims have changed;
- that selective CI is safe before Gate D;
- that I07-03's hosted bootstrap is an eligible strict-subset comparison or has advanced beyond
  `0 / 20` observations;
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
