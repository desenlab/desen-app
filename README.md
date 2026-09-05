# DESEN

This repository contains the Web–React reference implementation of the frozen DESEN 0.1.0
protocol, the Desen App product, and the developer tooling intended for `desen.run`.

## Implementation progress

<!-- task-progress:start -->
<!-- Source: docs/plan/TASKS.md. Update this block in the same commit whenever a task status changes. Milestone gates are tracked separately and excluded from task counts. -->

**Overall:** `████████████████████░░░░░` **117 / 148 tasks complete (79%)**

**M02 complete:** `█████████████` **13 / 13 tasks complete (100%)**

**M03 complete:** `██████████` **10 / 10 tasks complete (100%)**

**M04 complete:** `█████████████████` **17 / 17 tasks complete (100%)**

**M05 complete:** `█████████` **9 / 9 tasks complete (100%)**

**M06 complete:** `███████████` **11 / 11 tasks complete (100%)**

**M07 complete:** `███████████` **11 / 11 tasks complete (100%)**

**M08 complete:** `██████████` **10 / 10 tasks complete (100%)**

**M09 complete:** `██████████████` **14 / 14 tasks complete (100%)**

**M10:** `████████░░░░` **8 / 12 tasks complete (67%)**

**Proof gates:** **11 / 13 complete** · **I07-04:** `DONE` (`20 / 20`, zero false negatives) · **G09:** `DONE` · **AR-01:** `DONE` (PR #76 and main CI passed) · **M10-T05:** `DONE` closure candidate pending exact-head hosted checks · **P-07:** `PROVEN` · **PF-059:** `CLOSED` · **Next product task:** `M10-T06` (not started)

[View the detailed task board](docs/plan/TASKS.md)

<!-- task-progress:end -->

[AR-01](docs/proof/HISTORICAL-ARCHIVE-REDACTION.md) closed in
[PR #76](https://github.com/desenlab/desen-app/pull/76). Its exact head
`bde3ea81f261a9839a2b61ecb242d4824083ee2c` passed both hosted checks in
[run 33762532123](https://github.com/desenlab/desen-app/actions/runs/33762532123), merged as
`33b922e6746365510c0549ddbf3b08469e58dc11`, and passed
[fresh main CI](https://github.com/desenlab/desen-app/actions/runs/33764464871). Four nested
historical transports remain redacted without changing their technical projections or rewriting Git
history. I07-05 retains the separate legacy-runner retirement scope.

The reviewed CI-02 checkpoint retains this exact conditional-closure contract; it is a historical
policy record, not an additional active task:

**CI-02:** conditional `DONE` on this exact PR head's hosted `Quality gate`; canonical status remains `IN_PROGRESS` while it is pending

**G06 checkpoint:** the built public Publisher deterministically publishes the official valid
Source and rejects all 127 reviewed task-owned invalid cases at their exact earliest stage with no
Bundle or partial authority. The [public invalid-Source proof](docs/proof/PUBLISHER-INVALID-SOURCE-MATRIX.md)
is pinned by `sha256:fc5904ea6ec4e6495629fc4de8009fee66155938013068b709dd1ff40c1e98d8`.
Signing, verified storage ingress, activation, runtime consumption, and deployment remain later
milestones.

**M07-T01 checkpoint:** the built `@desen/control-plane-api` package now stores the official
2,173-byte Bundle exactly once under its revision. Identical retries preserve the winner, different
exact bytes conflict, and concurrent writers cannot replace or mix that winner; unsafe filesystem
paths fail closed. Channels, activation, last-known-good recovery, and G07 remain later work.

**M07-T02 checkpoint:** the separate built-package verifier now treats stored Bundle and available
Source bytes as untrusted input. It applies bounded strict JSON, exact raw and canonical 2 MiB
Bundle ceilings, a generated fail-fast guard over the frozen 0.1.0 schemas, triple revision
equality, and—when supplied—raw/canonical 8 MiB Source ceilings plus independent validation and
digest calculation over real Source bytes. Only complete success yields a frozen,
runtime-authenticated integrity authority; it still grants no package, channel, staging, or
activation power. The [executable integrity proof](docs/proof/CONTROL-PLANE-BUNDLE-VERIFICATION.md)
is pinned by `sha256:db493445e02a2609274dcfde36e1414f04493be0c829280d89f2fe95637d2e7a`.

**M07-T03 checkpoint:** the built control-plane API now accepts only an authenticated M07-T02
integrity authority, resolves every required package by literal id, exact version, and literal
target, and requires exactly one physical installed candidate. For the current static Web–React
profile it snapshots the selected Catalog and all 80 real distribution artifacts, independently
reframes 81 entries, and closes Bundle requirement digest = Catalog self-digest = calculated
package digest before returning an opaque immutable package authority. Missing, duplicate, newer,
case/Unicode/whitespace-aliased, stale-digest, mutated-byte, hostile, or over-limit inputs fail
closed without partial package, staging, channel, or activation power. That authority feeds the
separate M07-T04 reference/finite-profile boundary below. The
[executable package-preflight proof](docs/proof/CONTROL-PLANE-PACKAGE-PREFLIGHT.md) is pinned by
`sha256:79ec5f2d285868ecd7e08b4649b160087810b08346d7741796c09d14749f4628`.

**M07-T04 checkpoint:** the control-plane now accepts only that exact package authority and walks
the complete immutable Bundle under one fixed 13-field Reference Profile before staging. Entry,
surface, component, behavior, resource, operation, event, navigation, refresh, command, nested
settlement, predicate, repeat, and aggregate-work boundaries fail closed without substitution or
truncation. Only a bounded-scan success that independently agrees with the cumulative semantic
Validator yields a second opaque authority; it carries no Bundle, Catalog, obligation, runtime
index, channel, commit, or activation power. All 13 limits have executable boundary or dominance
evidence. P-17 is now `PROVEN`; P-12 remains `NOT_PROVEN`, and N-038/N-041 remain `PLANNED` for
their later transactional and measured owners. The
[executable reference-preflight proof](docs/proof/CONTROL-PLANE-REFERENCE-PREFLIGHT.md) is pinned by
`sha256:29555326d51073c50937519d8706049ad17287079cc3ef4dc7060bb3a3225394`.

**M07-T05 checkpoint:** the built control-plane package now exposes a fixed-loopback,
bearer-authenticated Fastify API for three deliberately separate responsibilities. Editable
Source bytes use SQLite-backed compare-and-swap generations; immutable Bundle writes delegate to
the already proved M07-T01 first-writer-wins repository; mutable channels expose discovery
pointers only and grant no staging or activation power. Exact allowed origins can read `ETag`,
while every other origin fails closed. The service bounds inactive connections at 5 seconds,
complete requests at 15 seconds, and keep-alive at 5 seconds. Sixteen focused runtime cases, 18
compiler-negative cases, and 16 independent root cases prove the boundary. N-019 is now `TESTED`;
P-12 remains `NOT_PROVEN`, G07 remains open, and `PF-074` remains `OPEN`. The
[executable local-API proof](docs/proof/CONTROL-PLANE-LOCAL-API.md) is pinned by the 41,945-byte
artifact `sha256:144e8a46b3b41a1f98a022bf4c16dddb9d7415af4e5033322484d4bdd49c55b9`.

**M07-T06 checkpoint:** the built control-plane package now turns only an authentic M07-T03
package authority into a bounded, immutable runtime-staging candidate. It independently recloses
the package bytes, validates execution contracts, prepares inert handler programs, and builds
deterministic package, capability, surface, state, resource, operation-alias, and obligation indexes
without loading code or changing any channel, staged slot, active revision, previous-good revision,
or durable record. All 14 staging limits have executable evidence. Thirteen focused runtime cases,
13 compiler-negative cases, and 17 independent root proof/mutation cases pass. P-12 remains
`NOT_PROVEN`; N-038 and N-041 remain `PLANNED`; G07 and `PF-075` remain open. The
[executable runtime-staging proof](docs/proof/CONTROL-PLANE-RUNTIME-STAGING.md) is pinned by
`sha256:d025da5329d5b56b9b46e7292a08883386a151add5e419edf2a9345425319494`.

**M07-T07 checkpoint:** the built control-plane now accepts only the exact private M07-T04
reference authority joined to the exact private M07-T06 staging authority. After that join, it
consumes the staging candidate before the first await or I/O, recloses the complete Bundle from the
same-root BundleStore, and requires full Bundle equality before committing. One durable atomic
compare-and-swap record owns `activeRevision`, `previousGoodRevision`, and `generation`: the first
commit starts at generation 0, later commits preserve the true previous-good revision, and the
counter cannot wrap past the safe-integer ceiling. The Web adapter uses a separate SQLite database
with lazy native loading. A pre-existing or indeterminate record fails into explicit
recovery-required state instead of being trusted. A durable row that disappears after publication
also revokes the live authority and blocks generation reset. The transaction separately verifies
the caller generation and the controller's complete authenticated current record, so a
same-generation external rewrite cannot masquerade as the current state. Recovery discovered
while Bundle I/O is pending remains sticky. Exact schema/version checks run under the writer lock,
so a trigger added after open is rejected before DML; statement-acquisition failure closes the
partial SQLite open before returning a redacted error. Twenty-one focused runtime cases, 25
compiler-negative cases, and 18 independent root proof/mutation cases pass. P-12 remains
`NOT_PROVEN`; N-004, N-038, and N-041 remain `PLANNED`; fault injection, activation matrices, and
host consumption remain M07-T09 through M07-T11. The
[executable runtime-activation proof](docs/proof/CONTROL-PLANE-RUNTIME-ACTIVATION.md) is pinned by
the 49,892-byte artifact
`sha256:3129a8e40c837a1c49d7fe206de794e0f7f7e130dc7e5e90a012b9e38bf07334`.

**M07-T08 checkpoint:** a restarted controller no longer treats the three durable fields as
runtime authority. Recovery accepts only the exact M07-T03 package authority for the durable
active revision and, when recorded, the exact authority for previous-good. It internally reruns
M07-T04 reference admission and M07-T06 staging for every required role, consumes those internal
staging handles before asynchronous work, recloses every durable Bundle from the same immutable
store, and rereads all three durable fields immediately before publication. Success reconstructs
only the active in-process authority, keeps the validated fallback lineage private, and leaves the
record and generation byte-for-byte unchanged. Missing, unsafe, drifted, corrupt, or mismatched
lineages publish neither active nor fallback authority; an indeterminate null record must be
resolved by reopening the same root. Twelve focused runtime cases, 14 compiler-negative cases, and
9 independent root proof/mutation cases pass. P-12 remains `NOT_PROVEN`; N-004, N-038, and N-041
remain `PLANNED`; G07 remains open. The application-owned local root is trusted: without an
external cryptographic anchor, recovery makes no tamper-proof, hostile-administrator, or
anti-rollback claim. The [executable restart-recovery proof](docs/proof/CONTROL-PLANE-RUNTIME-RECOVERY.md)
is pinned by the 44,224-byte artifact
`sha256:c65d4f2de1407fffb891b5d3ba2fc8a3a8d4e3f0fb76c8b8f2719be6b310b3f9`.
The final evidence pins the exact AST structures for the complete 105-entry package-root export
inventory, executable CI registrations, shared-state mappings, and the direct 12-case runtime plus
9-case root test inventories. Code-owned exact source receipts bind the executable test bodies and
effective CI/shared-state flow, so dead or decoy syntax cannot satisfy the proof. It checks the
exact 36-key built runtime module surface, reads proof authorities through bounded no-follow
handles with stable file and parent identity, and proves that recovery leaves both the durable
record and SQLite bytes unchanged.

**M07-T09 checkpoint:** the control-plane's immutable-fetch, integrity, package, reference,
staging, durable-commit, and restart-recovery boundaries now have one closed, named fault matrix.
Nineteen fault cases prove that every rejection before `COMMIT` preserves the authenticated
baseline and publishes no partial authority; a fault after a certain `COMMIT` instead enters the
explicit indeterminate recovery path, where the committed winner must be reauthenticated before
publication. Recovery faults publish no lineage, and a final external durable-record drift remains
authoritative rather than being overwritten. Twenty focused runtime cases, 10 compiler-negative
cases, and 11 independent root proof/mutation cases pass. N-004 is now `TESTED`; P-12 remains
`NOT_PROVEN`, and the remaining ordered fault sequences/races and host-consumption proof belong to
M07-T10 and M07-T11. This bounded matrix does not claim every possible fault ordering, hostile
administrator resistance, or an external anti-rollback anchor. The
[executable runtime fault-injection proof](docs/proof/CONTROL-PLANE-RUNTIME-FAULT-INJECTION.md) is
pinned by the 64,493-byte artifact
`sha256:9d0f764e35f5400fa662874784fba6f6492a39a0e60557fe1a9c7d7eab5407c9`.

**M07-T10 checkpoint:** the activation controller now reauthenticates the complete SQLite
connection profile—WAL journal mode, `synchronous=FULL`, foreign keys enabled, trusted schema
disabled, and the exact busy timeout—after acquiring the writer lock and again after commit before
publication. A profile drift fails closed without silently repairing the database. Fifteen named
transition cases cover A → invalid B → valid C, same- and different-candidate races, activation and
recovery orderings, restart, a real journal transition, and deterministic writer-profile drift.
The evidence passes 16 runtime tests, 9 compiler-negative tests, 12 independent root mutation
classes, 9 predecessor checks, and 15 ordered trace rows. N-038 is now `TESTED`; N-041 remains
`PLANNED`, P-12 remains `NOT_PROVEN`, and G07 remains open. The root proof has no native-addon
authority and proves a real `ERR_DLOPEN_DISABLED` denial; only the verifier receives the narrow
SQLite authority it needs. The proof binds the single public `.` package export and exact captured
CI/distribution bytes to digest-checked pre/post live equality, and rejects receipt-only overrides.
It makes no tamper-proof, anti-rollback, hosted T10, host-channel, or native-conformance claim. The
[executable runtime-transition proof](docs/proof/CONTROL-PLANE-RUNTIME-TRANSITION-RACES.md) is
pinned by the 58,059-byte artifact
`sha256:f5f10dd422f9e1fc7ca4445b84bf192280e59fb747d8d2ed40357cba3ebc0f39`.

**M07-T11 checkpoint:** the separately compiled Web reference host now consumes one fixed mutable
channel through a server-owned boundary instead of trusting discovery data in the browser. The
server reads the real bearer-authenticated loopback API, reruns integrity, installed-package,
reference, staging, activation, and restart-recovery checks, then exposes only the authenticated
active Bundle and a strong generation/revision ETag through one same-origin refresh route. Valid A
is delivered, invalid B leaves A byte-for-byte mounted, valid C atomically replaces A, restart
reauthenticates the durable winner before delivery, and stale or post-close refreshes cannot
publish. The browser imports no control-plane, SQLite, bearer, filesystem, Desen App, Publisher, or
testkit authority. The [channel-consumption proof](docs/proof/REFERENCE-HOST-WEB-CHANNEL-CONSUMPTION.md)
pins seven focused-suite files, 46 runtime tests, nine exact end-to-end case identities, 13 root
mutation classes, and two browser type-test files. Its 39,307-byte artifact is
`sha256:48bd9f85bd2da413fc72c1973a33732cc091796f9afc2863ec1eec15054314e0`. This local Web proof does
not claim remote or native deployment,
real-browser performance, product-level restart, hostile-admin concurrent-root mutation
resistance, or an external anti-rollback anchor. P-12 remains `NOT_PROVEN` until M10-T07 and N-041
remains `PLANNED` until M12-T05.

**I07-02 infrastructure checkpoint:** the cutover froze and proved the code-owned 130-workload,
61-proof-pair plan as `REQUIRED + EXHAUSTIVE`. The historical M07-T09 successor contained 146
workloads and 69 proof pairs. The historical pre-M08 M07-T11 successor contained 150 workloads and
71 proof pairs, 479 prerequisite segments, 3,113 ordered leaf invocations, and 236 distinct leaves.
The historical M08-T01 successor contained 153 workloads and 72 proof pairs, the historical
M08-T02 successor contained 155 workloads and 73 proof pairs, and the historical M08-T03 successor
contained 157 workloads and 74 proof pairs. The historical M08-T04 successor contained 159
workloads and 75 proof pairs: 64 ordinary pairs and 11 exclusive barriers. Its retained legacy projection
expands to 519 prerequisite segments and 3,237 ordered leaf invocations covering 251 distinct
leaves. Its shared-state counts were exactly 6
`GLOBAL_EXCLUSIVE`, 2 `WORKSPACE_OUTPUT_EXCLUSIVE`, 1 `PACKAGE_TEST_EXCLUSIVE`, 69
`PROOF_READ_ONLY`, 70 `PROOF_OS_TEMP_ISOLATED`, 10 `PROOF_TRACKED_ALIAS_EXCLUSIVE`, and 1
`PROOF_WORKSPACE_TEMP_EXCLUSIVE`; filesystem compatibility was exactly 141 `NONE`, 2
`FIXTURE_COPY`, 15 `REVIEWED_SYMLINK`, and 1 combined policy. Its 15 workspace test scripts were
pinned by
`sha256:0faa6116c99d11f6d059a224de6b08a723657b5c5690a3138e6290d240524820`. The neutral inventory was
`sha256:3879dcd4c9716b7f08746953c62170de7bd33c786f747849b8aed38e0fe1e62c`, and the required plan was
`sha256:30a193cbc27316792bd577dcecdc87c10e680e2e033698ceb90787c2cbcf1b51`. These historical M08-T04
successor pins are local code-owned authority and make no hosted M08-T04 claim. The historical
M08-T05 successor contains 161 workloads and 76 proof pairs: 65 ordinary pairs and 11 exclusive
barriers. Its shared-state counts are 6/2/1/69/72/10/1, filesystem-policy counts are 143/2/15/1,
and 15 workspace packages expose a `test` script. Its scheduler-neutral inventory is
`sha256:ae790f14c376a1fb449e34877a08abba164677ef413583248e5f609f3c7bb292`, and its required plan is
`sha256:9f7ef05e606afb293b42c650acfcf043d638cd429e07fdee55d01d241f06bf1b`. This is local code-owned
authority and makes no hosted M08-T05 claim. The historical M08-T07 successor contains 165 workloads
and 78 proof pairs: 67 ordinary pairs and 11 exclusive barriers. Its 549 prerequisite segments,
3,435 ordered leaf invocations, and 260 distinct leaves retain the exact quality plan
`sha256:c6cf645412661a81e2976e88080d23d6fe0fa4889ef4b07432e4a47de684e25d`. The scheduler-neutral
inventory is `sha256:8220259aa2a44774d192ea2420f4c2f8423c9dedd93a1fcf9b34340a0ab0dcd3`, the selector-only impact
graph is `sha256:5aa20b4fb87decc51221bca5a900677d7dfddd1e61c068d5e91420253a3236b2`, the exact workload set is
`sha256:9ea3b95ab6f034473765beb9edb1482532bb1a0b4e05f630c403d38d8df0daef`, and the ordered
equivalence projection is
`sha256:fc588358d8fa3b2e7c2cd9f3a280715d7db34089a41a2fae2c3484d18c040278`. Required and shadow plans
are respectively `sha256:5484324b6d22a5e58bce2431f35382aeeb4e97095c96524e5bdb6211f8650a9e` and
`sha256:4beeca9ed27e2e7942951cf0cf014fb7bebca2bcf2f8f69ff0819580aeff3c87`. Affected ownership covers
1,088 tracked paths at `sha256:227cb892270c669646eec89a44243af8e3da5a51bfec8f8e560e2d765c0f2e79`, including 156
proof-owned paths, with complete projection
`sha256:d43335b91aa9f3da0571ed2e32e92ea65da81bbcc5efee1aa32bdac30967217d`. The current selector and
required-runner authorities are
`sha256:cbd1cce71828ad4ad1c22ede5e6152e5e3130031afebcb1d9c23e32ba55eb7dc` and
`sha256:9da49a38efa09a48ded3290ba9c2ec4ae57a967d325e61320f39be561b93f9a4`; the authenticated
promotion artifact remains
`sha256:76a29908843c0bb9a4ca5ad74b5bc94383c3fa21463ce81e98bf53e8f01d7549`. For the frozen
130-workload I07-02 cutover, the then-current exact shared-state classes, cancellation behavior,
tracked/untracked workspace guards, and same-revision equality with the retained sequential runner
passed locally and in hosted CI. The cutover run passed in 10
minutes 33 seconds; the legacy job was correctly skipped because rollback was not requested. The
historical reviewed checkpoint sequence 4 contains ten frozen artifacts and twenty live readers at
`ee2d72c3529d9295945d339fb214c41dbbf906ffa6613a7ad6e766ec79c1bcf5`. A corrective M05-T04
current-reader append after M07-T03 established historical sequence 5; its head
`7df3631d509ed7e65c571566a825d6d3cd52d336e1a74512bf3e8e26920749b3` authenticates eleven frozen
artifacts and twenty-two live readers. Sequence 6 only advances the M06-T11 proof/test receipts for
a bounded, explicit 20-second nested Vitest timeout; its then-current head `790ad28b6fd441e6d5f40f277a97e8de36a178a9e50fff3e208e6c27588915fd` still
authenticates eleven frozen artifacts and twenty-two live readers. It changes no coverage,
assertion, concurrency, frozen evidence, workload/proof count, progress, or plan digest, and
sequences 1–5 remain byte- and hash-unchanged. Reviewed sequence 7 links exactly from sequence 6
head `790ad28b6fd441e6d5f40f277a97e8de36a178a9e50fff3e208e6c27588915fd` to
`d50b5ee4fb265f241bac7652b979af0146d530528ba6db8fc98c8fb3225a5ba5` and authenticates thirteen
frozen artifacts and twenty-six live readers. It adds the 34,612-byte M07-T04 artifact
`sha256:29555326d51073c50937519d8706049ad17287079cc3ef4dc7060bb3a3225394`, its live proof/root
readers, and current M05-T06 P-17 compatibility readers. It seals the exact final receipts of the
complete twenty-six-reader live set after all T04 compatibility bridges and the reviewed CI timeout
calibration, including current M05-T09, M06-T01/T05/T08/T09/T10/T11, and M07-T01/T02/T03 readers.
The frozen M05-T06 artifact remains
byte-identical and historically `PARTIAL`; only live P-17 is now `PROVEN`. Sequences 1–6 are
unchanged. This is a reviewed local-reader checkpoint and does not claim a new hosted CI pass. The
reviewed sequence 8 append links the exact sequence 7 head
`d50b5ee4fb265f241bac7652b979af0146d530528ba6db8fc98c8fb3225a5ba5` to
`f707fb4c3338aeda79eb6242b645b5e864ce54b1e3955373e8edebcd7e026b8a` and authenticates fourteen
frozen artifacts plus twenty-eight live readers. It adds the 41,945-byte M07-T05 artifact
`sha256:144e8a46b3b41a1f98a022bf4c16dddb9d7415af4e5033322484d4bdd49c55b9`, the 73,915-byte proof
reader `sha256:f66d40863a46dd7ed9e28afb2c78f8afbda8aee964e72d4fba60e65e55a351b3`, and the 17,291-byte
root reader `sha256:490d4f922ea41dc7bca178cc54ab938ab136f0b922d7842af623001eabf60a65`.
Prior live receipts—including current M07-T01 through M07-T04 and reference-host source-audit
compatibility readers—are resealed after the T05 compatibility changes; sequences 1–7 and all
predecessor frozen artifact bytes remain unchanged. This is a reviewed local-reader checkpoint,
not a new hosted CI result. Remaining compatibility-reader debt stays owned by I07-04. Reviewed
sequence 9 links the exact sequence 8 head
`f707fb4c3338aeda79eb6242b645b5e864ce54b1e3955373e8edebcd7e026b8a` to
`94f48160552a6e0de702f71200e56c23d61bab8692d43f3ac1104dcfa681568b` with the same fourteen
frozen artifacts and twenty-eight readers. Exactly reader indexes 16–19 change: the M07-T02
94,612-byte proof reader `sha256:4c69fa253ba2d9432a75c6c6aaa2ad69e23c3683c43dae9c92dc73b3208937d9`,
20,959-byte root reader `sha256:fdcfc8c4868c1ee084b652e42c7dab4750bc569c4c05928dde7136118b4689ed`,
M07-T03 86,174-byte proof reader
`sha256:5624b06d8d0962d18c9a920a34a95b0023f4909d8c7b7812057bedcdc62ab5ab`, and 21,119-byte root
reader `sha256:10c1a677b88b5c6bd4389e659ce38f11a627ae92de4aafe4ffade0de23790f11`.
These minimal T05 compatibility bridges authenticate the current shared strict-JSON internal
source/distribution and exact T03 → T04 → T05 aggregate adjacency while still projecting the
unchanged frozen T02/T03 artifacts. Sequences 1–8 and all frozen artifacts remain unchanged. This
is reviewed local evidence only, not a hosted CI claim; `DEBT-I07-012` cleanup remains owned by
I07-04. Reviewed sequence 10 links the exact sequence 9 head
`94f48160552a6e0de702f71200e56c23d61bab8692d43f3ac1104dcfa681568b` to
`bd3f5b90656f0e41d7f6aa439fdc01889e9ebeada26cd3caf8624c3ce1db7d07` with the same fourteen
frozen artifacts and twenty-eight readers. Exactly reader indexes `[7, 14, 15]` change: the
M06-T08 catalog root `tests/publisher-catalog-pinning.test.mjs` is 38,530 bytes at
`sha256:bb3038a8c5bb241c863daa6c7f41c1d8ab210da81fdbe52697f33a3c14909116`; the M07-T01 proof reader
is 99,672 bytes at `sha256:d9d9edd6379357dde229999ce461a0dc66bf58dc0d7900eb6f5ece177a9b3fba`;
and its root reader is 26,679 bytes at
`sha256:6b3a7869962046a3594a788095faad640c76fec660a59aee7b26844e831851ff`. These minimal test-fixture
successors recognize the local-API aggregate tail and updated catalog-root receipt while the frozen
catalog and T01 artifacts remain unchanged. The strictly sequential local catalog and T01 checks
pass 51/51 and 16/16 respectively. Sequences 1–9 remain immutable. This is reviewed local evidence
only, not a hosted CI claim; `DEBT-I07-012` cleanup remains owned by I07-04. The
reviewed sequence 11 append links the exact sequence 10 head
`bd3f5b90656f0e41d7f6aa439fdc01889e9ebeada26cd3caf8624c3ce1db7d07` to
`63b8af4da431f0918c7ea9480564750bd12057af2bc83c294d962113ce7c9be8` with the same fourteen
unchanged frozen artifacts and twenty-eight readers. Only indexes `[26, 27]` change: the M07-T05
proof reader is 77,034 bytes at
`sha256:c704e25024eaf7bdf317cc144f6b85922a3fe73a24c9c91e639ede032e22eb6f`, and its root reader is
17,578 bytes at `sha256:4871c406390c4c9b36bff1c417a6c8dd22798736ea8daad1c63a3cbd0a978389`.
Sequences 1–10 and every frozen artifact remain unchanged. This is a reviewed local-reader
checkpoint and makes no hosted CI claim. The
reviewed sequence 12 append links the exact sequence 11 head
`63b8af4da431f0918c7ea9480564750bd12057af2bc83c294d962113ce7c9be8` to its then-current head
`85c49a0d79346bf2ea92b716f6b43c5d95d164209e3d67af34871a334686e10e` with the same fourteen
unchanged frozen artifacts and twenty-eight readers. Only indexes `[26, 27]` change: the M07-T05
proof reader is 77,507 bytes at
`sha256:e2050408c5bf3e084eacd6e42880310dafbfdf03b79821500cc0567b998f7d66`, and its root reader is
17,716 bytes at `sha256:061b40ea20e0f7ee362f26bd54db954c3caea338df5e2f090ce34a4618ac37cc`.
This successor authenticates the exact ADR token-bound documentation update while the M07-T05
artifact and every other frozen artifact remain unchanged. This is reviewed local-reader evidence;
hosted CI has not yet been claimed, and I07-04 still owns the compatibility-reader debt. The
reviewed sequence 13 append links exact sequence 12 head
`85c49a0d79346bf2ea92b716f6b43c5d95d164209e3d67af34871a334686e10e` to its then-current head
`146b04f1c8209be64168afb451ceee2c422da0cdced116f8d08beafe795c533c` with the same fourteen
unchanged frozen artifacts and twenty-eight readers. Only index `[9]` changes: the M06-T09
publisher-bundle-publication root reader is 63,859 bytes at
`sha256:ae7b688d904b4c77632fd78e0ee23b2264eae1574b4350306b5e2ec1b9974b8d`. A hosted
required-exhaustive attempt exposed two stale M07 successor/current-receipt assertions in that
reader; after the narrow reader-only correction, its focused root passes 112/112 and the frozen
M06-T09 artifact remains unchanged. This is reviewed local-reader evidence, does not claim hosted
CI success, and leaves the compatibility-reader debt with I07-04. The reviewed sequence 14 append
links exact sequence 13 head
`146b04f1c8209be64168afb451ceee2c422da0cdced116f8d08beafe795c533c` to current head
`3d2dd7a48ee2573d14fb1dbea18ef8b4e3498c6a26f82d76ea589dba3c821078` with the same fourteen
unchanged frozen artifacts and twenty-eight readers. Only indexes `[10, 11, 14]` change: the
M06-T11 proof reader is 166,563 bytes at
`sha256:06eb59602a768c13f19cc83289a574823d191aa3b62ed8fb7149381b326de802`, its root reader is
60,572 bytes at `sha256:29b407c2f7f1b17d17bff450185a9304c3186caea4a98973df3f1e3e4f684531`,
and the M07-T01 proof reader is 99,672 bytes at
`sha256:888d5e81bda7ca2cdcc58bb063d49409cad5f5d73bdd9baaa16dc199e566e5c6`. This narrow CI-reader
successor changes no frozen artifact. Subsequent M07-T05 pull-request and `main`
required-exhaustive runs passed in hosted CI; sequence 14 itself remains local-reader evidence and
I07-04 still owns the compatibility-reader debt. Reviewed sequence 15 links exact sequence 14 head
`3d2dd7a48ee2573d14fb1dbea18ef8b4e3498c6a26f82d76ea589dba3c821078` to current head
`b75a2580d1d6820392aa74ba5b7671b01baed1740fe2097c2a78e24663b5e4d5`, authenticating fifteen
frozen artifacts and thirty live readers. It appends the 47,622-byte M07-T06 artifact
`sha256:d025da5329d5b56b9b46e7292a08883386a151add5e419edf2a9345425319494`, reseals reader indexes
`[0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 14, 15, 16, 17, 18, 19, 22, 23, 26, 27]`, and appends the T06
proof/root readers at `[28, 29]`.
Sequences 1–14 and predecessor artifact bytes remain unchanged. This is local-reader evidence and
claims no hosted M07-T06 result. `DEBT-I07-009` records the M05 source-audit successor bridge and
`DEBT-I07-013` records the historical staging-reader bridges under I07-04 for removal by G07. The
reviewed sequence 16 append links exact sequence 15 head
`b75a2580d1d6820392aa74ba5b7671b01baed1740fe2097c2a78e24663b5e4d5` to current head
`f9e77791148c7f89e586b6eb8964338185a35c11900b69262a159002af0838cd`, authenticating sixteen
frozen artifacts and thirty-two live readers. It appends the 49,892-byte M07-T07 artifact
`sha256:3129a8e40c837a1c49d7fe206de794e0f7f7e130dc7e5e90a012b9e38bf07334`, reseals reader indexes
`[0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 14, 15, 16, 17, 18, 19, 22, 23, 26, 27, 28, 29, 30, 31]`,
and appends the T07 proof/root readers at `[30, 31]`. Sequences 1–15 and every predecessor frozen
artifact remain unchanged. This is reviewed local-reader evidence and claims no hosted M07-T07
result; the historical activation-reader bridges remain owned by I07-04 for removal by G07. The
reviewed sequence 17 append links exact sequence 16 head
`f9e77791148c7f89e586b6eb8964338185a35c11900b69262a159002af0838cd` to current head
`cc7227fe73f0b03fa56e18c075de5bc8bb2f87c4425aa669fd437ed2cc09730e`, authenticating seventeen
frozen artifacts and thirty-four live readers. It appends the 44,224-byte M07-T08 artifact
`sha256:c65d4f2de1407fffb891b5d3ba2fc8a3a8d4e3f0fb76c8b8f2719be6b310b3f9`, reseals reader indexes
`[14, 15, 16, 18, 22, 26, 27, 28, 29, 30, 31]`, and appends the 84,219-byte T08 proof reader at
`[32]` (`sha256:08f143107430dde90cf1865c21d7ce1ec854897b0c1c4306b96525bdd0d18daa`) plus the 24,939-byte
T08 root reader at `[33]`
(`sha256:b97e7991e0ac20e7232112594228fdd829a536e81d16d06fd3f909e7e3a02492`). Sequences 1–16 and all
sixteen predecessor artifact files remain byte-identical. This is reviewed local-reader evidence
and makes no hosted M07-T08 claim; `DEBT-I07-015` assigns the temporary historical recovery-reader
bridges to I07-04 for removal by G07.

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
`abf161e5a85053e19ce218127aa3f7d3a3ac8480b68b01a4185618ac732393a3` to sequence 20 head
`8ba332b059e508dcb93aec4211edf3dcb10fb497d3a743b61ff7ee7e08c8a28e`. It preserves all 17 frozen
artifacts and all 34 reader identities while resealing only reader index `[30]` to 106,509 bytes
(`sha256:d322bf867930215d0f9e0f532bdacbea4ba50145dfa5df38f2e559102cc080ef`). The fail-closed T07
activation reader exposed stale T08 successor receipts after terminal close-race hardening changed
the runtime-activation-internal source, focused tests, and generated JavaScript/source map. The
exact successor receipts were repaired; the activation verifier and 18/18 root tests pass, and
this receipt repair changed no production behavior. Sequences 1–19 and every artifact byte remain
unchanged. This is reviewed local-reader evidence and makes no hosted M07-T08 claim; the temporary
compatibility bridges remain `DEBT-I07-015`, owned by I07-04 for removal by G07.

Reviewed checkpoint sequence 21 links the exact sequence 20 head
`8ba332b059e508dcb93aec4211edf3dcb10fb497d3a743b61ff7ee7e08c8a28e` to its then-current head
`ce12c066545e21779abf891898aaf0b09ceb1c0c1b51be382a0adabd5f86e939`. It preserves sequences
1–20 and every predecessor artifact byte, appends the 64,493-byte M07-T09 artifact
`sha256:9d0f764e35f5400fa662874784fba6f6492a39a0e60557fe1a9c7d7eab5407c9`, reseals 27 historical
compatibility readers, and appends the 64,932-byte proof reader
`sha256:da3fed33227c78eef872d06a3aedaf98a4e87e91de12893a21aceb5a9365216f` plus the 17,341-byte root
reader `sha256:f50017b668eb7f4a60d596a2d87a7e5b067989a9e1fe9a00270e685c44a4b8f6`. The chain now
authenticates 18 frozen artifacts and 36 current readers. This is reviewed local-reader evidence,
not a hosted M07-T09 claim; `DEBT-I07-016` records the temporary successor bridges for I07-04
removal by G07.

Reviewed checkpoint sequence 22 links that exact sequence 21 head
`ce12c066545e21779abf891898aaf0b09ceb1c0c1b51be382a0adabd5f86e939` to its then-current head
`aef9881c8fc540873f889a09754e5f2c19adc3c19934ba0fcfcf5e6a12b2da9e`. It preserves all 18
frozen artifacts and all 36 reader identities while resealing only workflow-dependent reader
indexes `[8, 10, 11, 12, 14]`; every frozen artifact remains byte-identical. This append records
the exact I07-03 CI-workflow receipt propagation without changing any proof claim.

Reviewed checkpoint sequence 23 links that exact sequence 22 head
`aef9881c8fc540873f889a09754e5f2c19adc3c19934ba0fcfcf5e6a12b2da9e` to current head
`3308da059b521c2b5f5fe75d036303221cace805094445f2d64383384831d45d`. It preserves sequences
1–22 and every predecessor artifact byte, appends the exact 58,059-byte M07-T10 artifact, and
authenticates 19 frozen artifacts plus 38 live readers. The M07-T10 proof/root readers are the two
new reader identities. Historical reader bridges needed by the append are registered as
`DEBT-I07-018`, owned by I07-04 for removal no later than G07. This is reviewed local-reader
evidence and makes no hosted M07-T10 claim.

At the I07-03 checkpoint, the exact `REQUIRED + EXHAUSTIVE` runner remained the sole pass/fail
authority and I07-03 added a separate pull-request-only `SHADOW + AFFECTED` observation job with complete exact tracked-path
ownership. Unknown, ambiguous, untrusted, policy, dependency, frozen-input, or unsupported changes
expand to `EXHAUSTIVE`; a strict subset still executes every selected workload from fresh inputs
and cannot reuse cached proof success. The frozen I07-03 baseline selector remains pinned at
`sha256:20a78069ed829649ab9198cad68b5d7fede22dc3b6ec391ed84f5dd1f0afa86f` across the 20 sources in
its historical comparison authority; the then-current M07-T11 successor selector digest was
`sha256:ee0cda5b4871ce2e169a958eefd60299197dbf261c0163335cd759e814067dbf`. Promotion requires zero
false negatives, mutation coverage for every selector category, and at least 20 consecutive
eligible same-revision hosted strict-subset comparisons.
The original hosted bootstrap remained a historical `0 / 20` starting point, but I07-04 has now
authenticated 20 consecutive same-revision hosted comparisons with zero false negatives. The
[I07-04 promotion baseline](docs/proof/baselines/i07-04-affected-selector-promotion.json) pins the
exact run/job/revision/receipt campaign, its immutable historical digest, the conservative selector
equivalence, and the fail-closed required runner. Eligible same-repository pull requests may use
fresh `REQUIRED + AFFECTED`; authority drift and every unsafe case expand exactly once to fresh
`REQUIRED + EXHAUSTIVE`, while `main`, release, and manual audit always remain exhaustive. The
[cleanup PR #36](https://github.com/desenlab/desen-app/pull/36) passed fresh
`REQUIRED + EXHAUSTIVE` in [run 31674300000, job 94365383803](https://github.com/desenlab/desen-app/actions/runs/31674300000/job/94365383803),
and landed on `main` as `6d87889bc088e45e219f430ee67e10c901c1a2fb`; that revision passed the
same authority in [run 31675234655, job 94368259305](https://github.com/desenlab/desen-app/actions/runs/31675234655/job/94368259305).
The one-file [canary PR #37](https://github.com/desenlab/desen-app/pull/37) then passed fresh
`REQUIRED + AFFECTED` in 3m54s in
[run 31676049922, job 94370743935](https://github.com/desenlab/desen-app/actions/runs/31676049922/job/94370743935):
10 workloads, one proof unit, 10 observed closes, a strict subset, and no cached success. All 17
G07-due debt entries are `CLOSED`; `DEBT-I07-007` deliberately remains `OPEN` for I07-05. The
historical I07-04/G07 closure checkpoint was sequence 28 at
`2577962251a9e6fa86993bd0e8bda1ed901f850a3b93678486c0445aed035546`, authenticating 25 frozen
artifacts and 50 readers. Historical sequence 30 remains pinned at
`f5598749a14e7d5eed27cb07e92a83f2bec28b5404f4480600e687d960f04970`; historical sequence 31 is
`181d5a1e0c012f53cfe02640c2f8d0ddf1e300090a3c3742882bb3722175e42d`. The historical M08-T04
append-only successor is sequence 32 at
`9be019b902ee17a57c9e2f13270fa67fe26265d06e360719bd1542643be6a424`, authenticating 29 frozen
artifacts and 58 readers. Historical M08-T05 sequence 33 remains
`64da5390046020ed223da42ce8a24d9fcf971c6a5a0a92fc49d368586414c871`, authenticating 30 frozen
artifacts and 60 then-current readers while preserving every sequence-32 and earlier byte; its
dedicated checkpoint suite passes 56/56. Historical M08-T06 sequence 34 remains byte-identical at
`f641e8d20d0f5e94cca809d330e3ad5bb0d7ffe0c3ec5defc14e0b5fca63b674`, authenticating 31 frozen
artifacts and 62 then-current readers. Historical M08-T07 sequence 35 at
`a2e3ef962ed37e0570cdddef64ae8d0eef2fd3f298cc2580f7ee65d8200f6fa3` authenticates 32 frozen
artifacts and 64 current readers while preserving sequence 34 and every earlier byte. It reseals
the twelve changed historical readers at `[50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61]`,
appends the T07 proof/root readers at `[62, 63]`, and passes its dedicated checkpoint suite 58/58.
Current M08-T08 sequence 36 authenticates 33 frozen artifacts and 66 current readers while
preserving every sequence-35 and earlier artifact byte. Historical M08-T01–M08-T07 artifact hashes
remain unchanged.
M08-T03's delete/move/reorder proof is the exact 22,402-byte
`docs/proof/artifacts/editor-core-0.1.0-structural-edits.json` at
`sha256:0d44f67c316c21ff8b612221d01e81c76d3b24783164bb75a772985bbc7def8b`. It closes `N-014` as
`TESTED`. M08-T04's fourteen immutable prop, style, condition, and ordered-variant commands are
proved by the 26,988-byte
[`editor-core-0.1.0-content-edits.json`](docs/proof/artifacts/editor-core-0.1.0-content-edits.json)
at `sha256:1726d453913c091d30229be02270a0cb4b74bf479f87027c4b9a0da3bb3c7066`; the reviewed report is
[`EDITOR-CORE-CONTENT-EDITS.md`](docs/proof/EDITOR-CORE-CONTENT-EDITS.md). `N-014` remains `TESTED`.
The tested command boundary rejects inherited, accessor, symbol, extra-field, function,
own-`toJSON`, sparse/decorated-array, malformed-Unicode, and unsafe-index shapes; accessor getters
and `toJSON` hooks are not invoked. Necessary reflection may execute arbitrary `Proxy` traps, and
an admissible forwarding `Proxy` may be accepted, so this is neither a hostile-JavaScript sandbox
nor a no-code-execution membrane. M08-T05's eight immutable state declaration, schema/initial,
repeat, and resource-input commands are proved by the 30,014-byte
[`editor-core-0.1.0-state-binding-edits.json`](docs/proof/artifacts/editor-core-0.1.0-state-binding-edits.json)
at `sha256:b85e578ac2bc27897517f12d8d4cf867a089cd61ff9fd1ab0664c819977634f8`; the reviewed report is
[`EDITOR-CORE-STATE-BINDING-EDITS.md`](docs/proof/EDITOR-CORE-STATE-BINDING-EDITS.md). The focused
suite passes 14/14 with 14 compiler-negative assertions, the public-package suite passes 38/38
with 48 public compiler-negative assertions, and the independent root proof passes 10/10.
M08-T06's six immutable event-handler and closed-action commands are proved by the 31,310-byte
[`editor-core-0.1.0-event-action-edits.json`](docs/proof/artifacts/editor-core-0.1.0-event-action-edits.json)
at `sha256:05a7df153512b8dd0f8289991d12a9d12d79903ed8b3637ef6c8a450ca8a6be7`; the reviewed report is
[`EDITOR-CORE-EVENT-ACTION-EDITS.md`](docs/proof/EDITOR-CORE-EVENT-ACTION-EDITS.md). The package
exposes 33 runtime and 69 type exports; T06 contributes twenty TSDoc-covered declarations. The
focused suite passes 16/16 with nineteen compiler-negative assertions, the cumulative editor suite
passes 85/85, the public-package suite passes 44/44 with 69 compiler-negative assertions, and the
independent root proof passes 10/10. The proof authenticates only frozen M08-T05, records 81
receipts, imports a 29-file isolated graph, and verifies seventeen static ESM edges. M08-T07 retains
authoring isolation and unknown-extension preservation; M08-T08 retains persistence; M08-T09
retains semantics and continuous diagnostics; M08-T10 retains the terminal React/DOM boundary.
G08 is not yet proven.

M08-T07's exact 62,304-byte
[`editor-core-0.1.0-authoring-round-trip.json`](docs/proof/artifacts/editor-core-0.1.0-authoring-round-trip.json)
is pinned at `sha256:33b6f81be62076d304c6daaec5d860e7995fa69ceaf34103469b349a347962db`;
the reviewed report is
[`EDITOR-CORE-AUTHORING-ROUND-TRIP.md`](docs/proof/EDITOR-CORE-AUTHORING-ROUND-TRIP.md). It adds no
runtime API or export. The existing factory and all 32 immutable commands preserve
root `authoring` as detached recursively immutable producer-owned parsed data and preserve unknown
extensions at all 16 Source-reachable positions without assigning core semantics. Otherwise
identical Sources with distinct root authoring retain equal authoring-excluded projections and
Source digests, while a root extension differential changes the digest. Recommended reverse-domain
and legal non-namespaced keys are both preserved; the naming recommendation remains guidance, not
hard validation. Fake authoring/extension IDs and actions do not enter allocator, identity, or
action scans; root authoring counts toward the full 8 MiB Source limit. Insert-supplied markers
enter, move/reorder carry them, delete removes only the target, and whole replacement replaces the
target's old extension while unrelated markers survive. Deliberately deleted or replaced owners
are outside the preservation claim. The focused suite passes 33/33 with six compiler negatives;
the cumulative public-package suite passes 46/46 with 75 compiler negatives; and the independent
root proof passes 10/10. The proof authenticates 95 tracked receipts and an isolated 29-file graph
with 17 static edges. `N-012`, `N-018`, and `S-003` are now `TESTED`. M08-T08 retains storage I/O,
save/open durability, and the persistence adapter. The full current CI infrastructure suite passes
265/265; checkpoint, required-affected, promotion, and retained legacy-gate suites separately pass
58/58, 27/27, 19/19, and 25/25. These are local code-owned receipts, not hosted M08-T07 evidence.

M08-T08 adds a platform-neutral persistence port to `@desen/editor-core`. Its adapter boundary
reads one Source and performs generation-guarded compare-and-set saves; the public port opens and
saves without browser, React, DOM, Node, filesystem, SQLite, or transport imports. Save canonicalizes
the complete Source—including root `authoring` and all extension values—enforces the 8 MiB ceiling,
re-admits bytes, and exposes detached recursively frozen results. Created, unchanged, updated,
conflict, exhausted, definite-failure, and indeterminate outcomes remain explicit; an uncertain
write is resolved by reopening and is never retried or merged automatically.

The `@desen/editor-web` local adapter requires the exact lexical origin
`http://127.0.0.1:<port>`, a bearer token, redirect rejection, and an explicitly injected
fetch-shaped callback. It has no implicit global-fetch, filesystem, or SQLite authority. The
existing M07-T05 control-plane implementation remains the unchanged durability owner. A real
OS-temporary native SQLite integration opens two control-plane instances, proves exactly one
generation-3 CAS winner and one conflict, closes both, and reopens the exact canonical winner from
a fresh instance. Root authoring and all 16 Source-reachable extension locations survive the
create/update/CAS/restart path. A durably dispatched PUT whose response is hidden returns
`indeterminate`; reopening resolves it.

The exact 49,785-byte
[`editor-core-0.1.0-persistence.json`](docs/proof/artifacts/editor-core-0.1.0-persistence.json) is
pinned at `sha256:51932d4165afff3c40fae6769527e480f6d0ff355f3fbc6d8ae7c6809e50a6fe`;
the reviewed report is
[`EDITOR-CORE-PERSISTENCE.md`](docs/proof/EDITOR-CORE-PERSISTENCE.md). Core persistence passes
10/10; cumulative core public-package cases pass 49/49 with 96 compiler-negative assertions; Web
focused cases pass 12/12; Web public-package cases pass 3/3 with six compiler-negative assertions;
and the independent root proof passes 10/10. The proof authenticates 218 tracked receipts,
including 180 emitted distribution receipts. The current CI successor contains 168 workloads and
79 proof pairs. Sequence 36 authenticates 33 frozen artifacts and 66 current readers while keeping
historical T01–T07 artifact hashes unchanged. These are local code-owned receipts, not hosted
M08-T08 evidence. `N-012`, `N-018`, and `S-003` remain `TESTED`; P-18 remains `PARTIAL`, and no
proof-gate or other normative status changes.

M08-T09 adds `createDesenEditorContinuousValidator` to `@desen/editor-core`. The pure synchronous
factory snapshots one Catalog set; each validation pass admits one immutable Source snapshot and
returns complete cumulative diagnostics, dynamic obligations, an authoring-sensitive document
fingerprint, and an order-sensitive Catalog fingerprint. Invalid-node mapping trusts only explicit
Validator surface and subject context. It retains every matching node or behavior occurrence,
keeps cross-kind identities separate, and leaves subjectless or non-occurring diagnostics
controlled and unmapped instead of guessing from pointers.

The focused suite passes 12/12 with nine compiler-negative assertions; the cumulative editor-core
suite passes 140/140; the public package passes 50/50 with 102 compiler-negative assertions; and
the independent root proof passes 8/8. Exact evidence is recorded in
[`EDITOR-CORE-CONTINUOUS-VALIDATION.md`](docs/proof/EDITOR-CORE-CONTINUOUS-VALIDATION.md) and
the exact 40,099-byte
[`editor-core-0.1.0-continuous-validation.json`](docs/proof/artifacts/editor-core-0.1.0-continuous-validation.json)
at `sha256:7739b5143685d613a678c6eca5480f27a5a303b176bf2bf4613a4d6917fe7e5a`.
The proof authenticates frozen M08-T03–M08-T07; persistence remains a current-package compatibility
sibling, not a formal prerequisite. The current CI successor contains 170 workloads and 80 proof
pairs, and sequence 37 authenticates 34 frozen artifacts plus 68 readers without changing any
historical artifact. The API adds no React, DOM, timer, worker, persistence, storage, network, or
obligation-execution authority.

M08-T10 closes the framework-neutral editor-core milestone and G08 without adding a production
helper or public export. Two independently copied emitted ESM graphs run the same ordered 32-step
command transcript. Insertion adds only `sign-in.terminal`, deletion removes only the prepared
`sign-in.terminal-delete` subtree, every other successful transition preserves the complete
node/behavior identity multiset, and an interleaved controlled failure exposes no partial document
before the transcript resumes. The terminal Source passes the M08-T09 validator with zero
diagnostics and seven retained dynamic obligations, then survives an injected M08-T08
generation-one save/open round trip with exact canonical bytes.

The focused terminal suite passes 4/4; the full editor-core package passes 144/144; the public
package remains 50/50 with 102 compiler-negative assertions; and the independent root proof passes
10/10 with its exact verifier. TypeScript AST inspection covers all nine editor-core source files,
all nine emitted JavaScript files, and all nine emitted declaration files. It finds no React,
ReactDOM, DOM/browser, Node-platform, CSS, dynamic-import, `eval`, or function-constructor
authority. The complete callback-free trace survives exact JSON and RFC 8785 round trip. Exact
evidence is recorded in
[`EDITOR-CORE-TERMINAL-INTEGRATION.md`](docs/proof/EDITOR-CORE-TERMINAL-INTEGRATION.md) and the
325,549-byte
[`editor-core-0.1.0-terminal-integration.json`](docs/proof/artifacts/editor-core-0.1.0-terminal-integration.json)
at `sha256:5787479d699ab8f53b739e633bf9a88900da00ae4f4c78f96b3e62a73133fa1b`.

M08-T10 and G08 remain `DONE`; `S-002` is `TESTED`, P-18 is `PROVEN`, and proof gates remain 9/13.
Legacy retirement remains owned by I07-05.

M09-T01 adds the first React/Vite Desen App shell: a full-viewport project gallery, project-level
surface galleries, a centered inert surface frame, exact project and surface routes, same-origin
History API navigation, fixed inert fixture search, explicit not-found recovery, responsive
presentation, and keyboard/accessibility behavior. The M09 UX wireframe informed information
architecture and task boundaries, while the earlier Desen product exploration informed the visual
language. Neither Figma source is executable input or proof authority.

The focused application suite passes 43/43 and the independent mutation suite passes 8/8. Exact
evidence is the 12,118-byte
[`desen-app-0.1.0-shell-navigation.json`](docs/proof/artifacts/desen-app-0.1.0-shell-navigation.json)
at `sha256:c3189ff9196f0da91311156893ab569a3c9f9c1ee62631b58286647f36d23220`; sequence 40 closes at
`sha256:e19eabc91c56c015b7fec7469d096b09a4bf42f5b6edc907c0207dd8c94feb0e` with 36 frozen
artifacts and 72 readers. Its historical M09-T01 CI successor contained 174 workloads and 82 proof
pairs, split into 71 ordinary pairs and 11 barriers. These are local receipts, not a required-gate
or hosted-CI result. This slice does not claim a Catalog panel, layer tree, real adapter canvas,
Source editing, persistence, Design/Run execution, publication, or activation.

M09-T01 is `DONE`; implementation progress is 96/145 (66%), M09 is 1/14, and M09-T02 is next.

M09-T02 adds the first Catalog-driven authoring surface without widening that shell into an editor.
The read-only Components tab projects the exact five-component library and authoring metadata from
`@desen/reference-catalog-web/catalog.json`; the Layers tab projects the exact validated `home` and
`sign-in` Source trees, including named slots, child order, attached behaviors, and conditional
markers. The app validates the cumulative Catalog set first and the official Source against that
accepted set second. Any Catalog rejection, Source rejection, or bounded-projection failure returns
no authoring model, and a surface without an exact Source tree reports the absence instead of
substituting the sign-in hierarchy.

The focused authoring suite passes 18/18 and the independent root proof passes 8/8. Exact evidence
is the 25,375-byte
[`desen-app-0.1.0-catalog-panel-layer-tree.json`](docs/proof/artifacts/desen-app-0.1.0-catalog-panel-layer-tree.json)
at `sha256:85a310feaf1a0cc3656055cd3a76eeb02e02a278c21d22167853b53c03f1ee61`.
The live local M09-T02 CI authority contains 176 workloads and 83 proof pairs, split into 72
ordinary pairs and 11 barriers. Checkpoint sequence 41 passes 64/64 at
`sha256:b36679b7ea3ffd0e019d3051b30312dd96b050e10ae7d5d44cf39eb9d30eeb68`, authenticating 37
frozen artifacts and 74 readers while preserving exact sequence 40 at
`sha256:e19eabc91c56c015b7fec7469d096b09a4bf42f5b6edc907c0207dd8c94feb0e` and every predecessor.
These are local task and CI-infrastructure receipts; they make no required-gate or hosted-CI claim.
The first hosted PR run exposed that Node's permission model denied the isolation fixture's
workspace-target symlink. The resealed fixture now uses only absolute runner-temporary targets and
its exact isolation suite passes 8/8 without widening permissions; a hosted pass is not yet claimed.
M09-T02 adds no real adapter canvas, selection, inspector, insertion, drag/drop, Source mutation,
persistence, Design/Run execution, diagnostics, publication, or activation. It is `DONE` without a
`P-*`, `N-*`, `S-*`, `G*`, or proof-gate status change; implementation progress is 97/145 (67%),
M09 is 2/14, proof gates remain 9/13, and M09-T03 is next.

M09-T03 replaces the inert sign-in placeholder with one exact managed Web–React canvas. Desen App
mounts the controlled official-derived Bundle through the public Runtime Core session APIs,
preflights the exact public static reference-adapter registry, and renders the live surface through
the public Runtime React hook and boundary. The exact `account-app` / `sign-in` tuple,
`com.example.account-app` document, and
`sha256:2dc98d276a3b4102c2891de1519bda86ea2978f5429fd8ea91831f36f8b73ffb` revision are required.
The design preview keeps its managed controls disabled behind inert
all-deny host ports; unsupported tuples neither mount nor substitute sign-in, and route replacement,
Strict Mode replay, and final unmount dispose the exact session.

The focused canvas suite passes 20/20, the complete App suite passes 56/56, the independent root
proof passes 11/11, and App typecheck, lint, and production build pass locally. Exact evidence is
the 73,111-byte
[`desen-app-0.1.0-real-adapter-canvas.json`](docs/proof/artifacts/desen-app-0.1.0-real-adapter-canvas.json)
at `sha256:8f89b237c20d80e83d96f17c31146d251c026977a4fff1ab1d0822e489c63151`.
Two deterministic Vite `write:false` builds observe the same 102-module graph with 290 static
imports, no dynamic or unresolved imports, and 101 backing files. The managed slice shares exactly
19 transformed runtime/component module identities with the frozen reference-host audit and
reaches all five real components.

The live local M09-T03 CI authority contains 178 workloads and 84 proof pairs, split into 73
ordinary pairs and 11 barriers. Its exact formal parents are the M09-T01 shell and M05-T09
reference-host source audit, producing an affected closure of 51 proof units and 112 workloads.
Checkpoint sequence 42 passes 65/65 at
`sha256:40d7c380cec3a7efd04316959a41abda3c8f71c1604f7f2fb892f18ae4cd2fa5`, authenticating 38
frozen artifacts and 76 readers while preserving exact sequence 41 at
`sha256:b36679b7ea3ffd0e019d3051b30312dd96b050e10ae7d5d44cf39eb9d30eeb68`. These are local task
and CI-infrastructure receipts; no required-gate or hosted-CI pass is claimed.

M09-T03 is `DONE`; P-06 is `PROVEN`, implementation progress is 98/145 (68%), M09 is 3/14, and
proof gates are 10/13. `S-001` remains `PLANNED` for the visible approximate-fidelity disclosure in
M09-T11; PF-059 remains `OPEN` and P-07 remains `PARTIAL` pending M10-T05 browser E2E. Selection,
private-DOM overlays, inspector editing, mutation, Design/Run mode, persistence, diagnostics,
publication, and activation remain later tasks. M09-T04 is next.

M09-T04 adds a route-local Source-identity selection model and keeps its authoring chrome outside
the exact managed capability subtree. Selection is minted only from the validated authoring model
and projected through the public callback-free Runtime React diagnostic index. Repeated component
instances remain distinct, attached behavior identities are excluded, conditional absence is
reported honestly, and unknown, stale, cross-route, or forged identities produce no overlay.

The managed runtime remains inside its disabled fieldset; Desen App renders one compact
pointer-inert identity/status card as a DOM sibling with no managed child, DOM/native handle,
private React value, callback, hit-test, or geometry authority. Native layer buttons provide
Select/Deselect names, pressed state, conditional context, wrapped keyboard navigation, and live
feedback, while route replacement resets selection synchronously. Desktop and mobile interaction
checks confirmed the product behavior manually without constituting browser E2E.

The focused App selection suite passes 27/27, the independent root proof passes 10/10, and App
typecheck, lint, and production build pass locally. Exact evidence is the 11,997-byte
[`desen-app-0.1.0-selection-overlay.json`](docs/proof/artifacts/desen-app-0.1.0-selection-overlay.json)
at `sha256:9a3805545ea49820c744fc07b9c3b0c2919b3e2fb524f9855df1cec9058901b1`, directly authenticated
against the 73,111-byte M09-T03 parent at
`sha256:8f89b237c20d80e83d96f17c31146d251c026977a4fff1ab1d0822e489c63151`. The live local CI
authority contains 180 workloads and 85 proof pairs—74 ordinary and 11 barriers—with a
52-proof-unit/114-workload selection-overlay closure and complete ownership over 1,164 tracked
paths, including 170 proof-owned paths. Sequence 43 passes 66/66 at
`sha256:0bbb101332d7af5dcf7260b6df6961837003571f67a6e3a69232e65e19cded58`, preserving sequence 42
and all 38 predecessor artifacts while appending the T04 artifact at index 38, resealing readers
`[70, 71, 72, 73, 74, 75]`, and appending T04 readers `[76, 77]`. The chain now contains 39
artifacts and 78 readers, and the complete structural CI suite passes 317/317 locally. No
required-gate or hosted-CI pass is claimed.

M09-T04 is `DONE`; `N-042` is `TESTED` for the exact controlled Web–React profile, P-06 remains
`PROVEN`, and P-07/P-16 remain `PARTIAL`. Implementation progress is 99/145 (68%), M09 is 4/14,
and proof gates remain 10/13. Component geometry, hit testing, canvas picking, inspector or Source
mutation, insertion/cardinality/drag-drop, state/action authoring, Design/Run, diagnostics
navigation/placeholders, persistence, browser E2E, publication, and activation remain later work.
M09-T05 is next.

M09-T05 adds one App-owned Inspector for the exact selected Source component. Its controls derive
from the validator-admitted Catalog `propsSchema` through the public Catalog SDK: string, boolean,
number, integer, and primitive-enum values receive native controls, while dynamic `$ref` values and
group/structured descriptors remain visible but locked for M09-T08 and M09-T06 respectively.

Edit commands are reduced to exact own enumerable data before authorization. Proxy-backed commands
are consumed through captured own data without invoking property getters; accessor, extra-field,
and symbol-bearing shapes fail closed. The App re-derives route, selection, node, capability,
control, requiredness, current value kind, and primitive type from the current immutable Source and
Catalog. Public Editor Core set/delete commands may produce a candidate only after those checks,
and the complete candidate must pass the public continuous validator.

An Editor Core success is still provisional until the public Publisher accepts the complete Source
against the exact reference Catalog package candidate. The App then replaces `{document, preview}`
as one session update. Publisher rejection keeps both the prior Source and prior working preview;
an accepted Bundle revision replaces the Runtime session and disposes its predecessor. The
Inspector remains an App-owned `aside` outside the disabled managed fieldset and capability
subtree, with no private DOM/native, geometry, hit-test, canvas-picking, registry, session, or
runtime-callback authority.

The focused Inspector suite passes 41/41, the complete App suite passes 86/86, the independent root
proof passes 10/10, and App typecheck, lint, and production build pass locally. Exact evidence is
the 22,998-byte
[`desen-app-0.1.0-schema-inspector.json`](docs/proof/artifacts/desen-app-0.1.0-schema-inspector.json)
at `sha256:473ab3248ed7b7b4de0e558df47159a74c28c134b46569aa91130745fd69660b`, authenticated against
the exact M09-T02 Catalog-panel, M09-T04 selection-overlay, and M06-T10 Publisher official-golden
parents. The live local CI inventory registers 182 workloads and 86 proof pairs—75 ordinary and
11 barriers—with a 53-proof-unit/116-workload connected closure and ownership over 1,175 tracked
paths, including 172 proof-owned paths. Sequence 44 passes 67/67 at
`sha256:f0c5f3bfbc30ccf230c5256b3a5672c29ffa0e884129ae210571895bd063812c`, preserving the first
43 checkpoints while extending the chain to 40 artifacts and 80 readers. The complete structural
CI suite passes 320/320 locally. No required-gate or hosted-CI pass is claimed.

M09-T05 is `DONE`; implementation progress is 100/145 (69%), M09 is 5/14 (36%), and proof gates
remain 10/13. P-08 remains `NOT_PROVEN`: nested-object/structured-JSON editing, state/binding and
event/action authoring, Design/Run, persistence, browser E2E, control-plane publication, and
activation remain later work. M09-T06 is next.

M09-T06 completes recursive closed-object Inspector controls and an honest structured-JSON
fallback. Present closed groups expose canonical child order, qualified accessible names, and exact
RFC 6901 value and schema pointers, including escaped `/` and `~` names. An absent optional group is
staged as one complete JSON object and committed atomically. Arrays, open objects, unions,
references, combinators, conditionals, pattern properties, unsupported schemas, and
derivation-limit results remain editable through an explicit textarea with a visible reason and
Apply, Reset, and eligible Unset actions.

Structured input is scanned under the Publisher Source JSON profile before parsing. Malformed or
non-finite JSON, decoded duplicate members, unpaired Unicode, limit violations, and every decoded
object key beginning with `$` fail closed. Successful values are detached and recursively frozen.
Object formatting is deterministic while array order remains significant; when pretty indentation
would exceed the admitted profile, formatting stops early and uses compact canonical JSON.

Route, selection, edit command, validator-admitted Source, and Catalog authority are captured
exactly before mutation. Nested edits rebuild only the complete top-level owner prop through public
Editor Core commands. Root fallback counts only changed props, permits at most 256 transitions and
32 MiB of aggregate snapshot work, and deletes obsolete props and applies shrinking replacements
before growth so a valid near-limit endpoint does not fail on a larger private transition. Every
candidate still passes continuous validation and Publisher preflight before `{document, preview}`
changes.

The focused structured-Inspector suite passes 73/73, the complete App suite passes 118/118, the
independent root proof passes 10/10, and the complete structural CI glob passes 323/323. Exact
evidence is the 26,133-byte
[`desen-app-0.1.0-structured-inspector.json`](docs/proof/artifacts/desen-app-0.1.0-structured-inspector.json)
at `sha256:6ea4eb3f51fdfc39eeca676d7ebafb145d66a9efdfa03af9c33a7aa39aa6aaec`.
The local CI authority contains 184 workloads and 87 proof pairs—76 ordinary and 11 barriers—with
a 54-proof-unit/118-workload closure and ownership over 1,184 tracked paths, including 174
proof-owned paths. Sequence 45 contains 41 artifacts and 82 readers. These are local receipts; no
required-gate or hosted-CI pass is claimed.

M09-T06 is `DONE`; implementation progress is 101/145 (70%), M09 is 6/14 (43%), and proof gates
remain 10/13. P-08 remains `NOT_PROVEN`; slot/cardinality UI, state/binding and event/action
authoring, Design/Run, persistence, browser E2E, control-plane publication, and activation remain
later work. PF-025 remains `OPEN`, dynamic `$` values stay locked for M09-T08, and M09-T07 is next.

M09-T07 adds App-owned named-slot insertion, move, reorder, and deletion. Its compatibility patch
uses non-overlapping insertion boundaries plus whole-row top/bottom targets so narrow gaps are not
the only drop surface. Components retains one sticky owner/slot/cardinality/position target, and a
successful insert auto-selects the new component so the existing safe Delete action is visible.
Click and keyboard placement remain available, and browser transfer data is only an inert hint.

Every operation re-authorizes the exact current route, Source node, Catalog capability, slot
contract, acceptance, minimum/maximum, and placement. Accepted candidates use public Editor Core
commands, pass complete continuous validation, and require Publisher preflight before an atomic
`{document, preview}` replacement. Root or stale deletion and source-minimum violations fail
without partial Source; a successful delete clears selection and returns focus to Layers, while a
rejected delete preserves selection, preview, and focus.

The focused named-slot suite passes 70/70, the complete App suite passes 151/151, the independent
root proof passes 9/9, and the complete structural CI glob passes 329/329. Exact evidence is the 24,830-byte
[`desen-app-0.1.0-named-slot-authoring.json`](docs/proof/artifacts/desen-app-0.1.0-named-slot-authoring.json)
at `sha256:daae817af45d8ead7052fd84df4edefd7d29cdd9ebe9cc1baea5b22b27dae90f`. The local CI
authority contains 186 workloads and 88 proof pairs—77 ordinary pairs and 11 barriers—with a
55-proof-unit/120-workload closure and 1,192 tracked/176 proof-owned paths. Sequence 46 passes
69/69 at `sha256:f09ec643d1b2756174ca47fae99837a68f6656bec0c6933e566d5075713a0f5f` with 42 artifacts and
84 readers.

In-app-browser inspection covered the target guide, selected target, click/keyboard insertion,
delete affordance, root-delete explanation, and clean console. Native drag automation and
real-browser E2E remain unclaimed. M09-T07 is `DONE`; implementation progress is 102/145 (70%),
M09 is 7/14 (50%), and proof gates remain 10/13. P-08 remains `NOT_PROVEN`; state/binding and
event/action authoring, Design/Run, durable save/open, browser E2E, publication, and activation
remain. PF-025 remains `OPEN`; this closure handed off to M09-T08.

M09-T08 adds a surface-local state and binding editor for directly addressable primitive state.
The State panel lists declarations deterministically and supports bounded add, initial-value update,
usage-aware delete, and explicit read-only treatment for unsupported declaration shapes. Usage is a
conservative bounded scan: referenced state cannot be deleted, and every edit is revalidated against
the current Source rather than trusting a stale UI projection.

The Inspector can attach a compatible property to one exact direct local-state reference, change
that reference, or detach it back to the declaration's validated initial value. Runtime namespaces,
fallbacks, tokens, formats, nested references, and other advanced dynamic bindings stay read-only.
Accepted changes use public Editor Core commands, complete continuous validation, and Publisher
preflight before one atomic session-local `{document, preview}` replacement.

The focused state/binding suite passes 109/109. Final structural receipt is
`278/278`; exact evidence is the
`28,766`-byte
[`desen-app-0.1.0-state-binding-editor.json`](docs/proof/artifacts/desen-app-0.1.0-state-binding-editor.json)
at `sha256:b7298375cba4b82258d1c293ecb66c3ae6641408ae9f5753da121ac44fcf601a`. The local CI authority contains 188 workloads and 89 proof
pairs—78 ordinary pairs and 11 barriers—with a 56-proof-unit/122-workload closure and 1,202
tracked/178 proof-owned paths. Append-only sequence 47 authenticates 43 artifacts and 86 readers at
`sha256:c28ba9a9f274ac0bc3f7dc7ed6de51df35128b109b374b563f5c0239891f58f7`.

M09-T08 is `DONE`; implementation progress is 103/145 (71%), M09 is 8/14 (57%), and proof gates
remain 10/13. P-08 remains `NOT_PROVEN`, PF-025 remains `OPEN`, and event/action authoring,
Design/Run, durable save/open, real-browser E2E, publication, and activation remain. The T07 native
real-browser drag E2E receipt also remains open. M09-T09 is next.

M09-T09 adds one component-only Events & Actions view for the exact selected Source component.
Only events declared by that component's authenticated Catalog contract are projected, with
absent, present-empty, and present-nonempty handler states kept distinct; forged behavior
selections fail closed and behavior-owner UI is not claimed. Six public Editor Core mutations cover
handler insert/delete and action insert/replace/delete/reorder through exact canonical escaped
owner-relative pointers.

The editor covers all seven closed action types—`component.command`, `event.emit`, `navigate`,
`operation.invoke`, `resource.refresh`, `state.set`, and `state.toggle`—plus recursively
addressable operation success and failure lists. Whole-action JSON drafts stay inert and local
until explicit Apply. Every accepted endpoint passes complete continuous Source validation and
Publisher preflight before one atomic session-local `{document, preview}` replacement; a failed
edit or preview preflight preserves the prior Source, event projection, and canvas.

The focused event/action suite passes 84/84, the complete App suite passes 202/202, and the
independent root proof passes 10/10. Exact evidence is the `23,812`-byte
[`desen-app-0.1.0-event-action-editor.json`](docs/proof/artifacts/desen-app-0.1.0-event-action-editor.json)
at `sha256:0060ef39273ea36666f1701d5d3fa0f1610b95f40d88304ba980dcdc73cb29ab`; the reviewed report is
[`DESEN-APP-EVENT-ACTION-EDITOR.md`](docs/proof/DESEN-APP-EVENT-ACTION-EDITOR.md). The live local CI
authority contains 190 workloads and 90 proof pairs—79 ordinary and 11 barriers—with a
57-proof-unit/124-workload closure and 1,212 tracked/180 proof-owned paths. Sequence 48 contains 44
artifacts and 88 readers at
`sha256:5ecf9e630e2c91cb97a7c85c60e8318fdf694039711a64bf1797e481aca0ff90`.

M09-T09 is `DONE`; implementation progress is 104/145 (72%), M09 is 9/14 (64%), and proof gates
remain 10/13. P-08 remains `NOT_PROVEN`; PF-025 and PF-083 remain `OPEN`. Action execution,
Design/Run, durable save/open, real-browser E2E, publication, and activation remain unclaimed.
M09-T10 is next.

M09-T10 adds one accessible App-owned Design/Run control to the controlled sign-in surface. Both
modes retain the same immutable session-local `{document, preview}`, Source revision, Bundle
revision, Runtime session, and managed Runtime React subtree because mode is excluded from Runtime
mount identity. A toggle therefore preserves Runtime local state, Source selection, the active
authoring view and search, and unapplied Inspector drafts; it clears only transient drag intent. A
new surface route starts in Design.

Design keeps the exact adapter controls disabled and admits App-owned selection and authoring. Run
hides the authoring panels and selection overlay, centrally rejects every retained authoring
callback, enables the real adapter, and proves the exact adapter event → Runtime React → Runtime
Core → closed `state.set` → same-subtree rerender path. Navigation, operation, and resource ports
remain denied; storage and token ports remain missing, conflicting, or inert.

The T10 closure retains the M09-T07 UX hardening: Components drag uses a root-safe default target
and an explicit target-change action; Layers uses enlarged drop lanes and retains the last valid
row projection through drop; and the selected layer exposes a visible Delete action plus guarded
Delete/Backspace shortcuts outside editable controls. Named-slot, cardinality, and validator
authority remain unchanged. This is not an arbitrary canvas geometry, hit-testing, or drop claim.

The adapter and application suites pass 9/9 and 35/35, the local focused Design/Run suite passes
44/44, the complete App suite passes 210/210, and the independent root proof passes 10/10. Exact
evidence is the `17,900`-byte
[`desen-app-0.1.0-design-run-modes.json`](docs/proof/artifacts/desen-app-0.1.0-design-run-modes.json)
at `sha256:bc5b7ffef0c39737882072f9340bcade86f084db8e7923fcb03aa7364d077334`; the reviewed report is
[`DESEN-APP-DESIGN-RUN-MODES.md`](docs/proof/DESEN-APP-DESIGN-RUN-MODES.md). Its frozen proof and
root readers are 53,346 bytes/
`sha256:ff4226241630daded979263dcd0a7fdb071591efbf789d1e7d2d4f4641779dfe` and 15,787 bytes/
`sha256:d27307b0763132e5c21f45c146d3773ab9dbf02371f850dca3d03e11a759f601`. The live local CI
authority contains 192 workloads and 91 proof pairs—80 ordinary and 11 barriers—with a
58-proof-unit/126-workload closure and 1,218 tracked/182 proof-owned paths. Sequence 49 contains
45 artifacts and 90 readers at
`sha256:45ed64e604400f18b15b3b4ef44bc35634a6c1567b46174329ec36529168272e`. The checkpoint,
promotion, and complete serial structural suites pass 72/72, 19/19, and 339/339.

Manual browser QA exercised the mode switch and Run interaction plus the automatic default
placement target, visible Delete action, editable-control Backspace guard, and successful Delete
shortcut, but it is not automated real-browser or native-drag E2E evidence. M09-T10 is `DONE`;
implementation progress is 105/145 (72%), M09 is 10/14 (71%), and proof gates remain 10/13. P-09
advances only to `PARTIAL` for the exact controlled `state.set` path. P-08 remains `NOT_PROVEN`,
S-001 remains `PLANNED`, and PF-025, PF-028, and PF-083 remain `OPEN`. Fixtures, scenarios, visible
approximate-fidelity disclosure, durable save/open, diagnostics navigation, publication,
activation, and automated real-browser E2E remain unclaimed. M09-T11 is next.

M09-T11 adds transient Catalog-declared props-only scenarios, exact synthetic sign-in fixture
settlement, and persistent adapter-fidelity disclosure without changing the authored Source or its
publishable preview. Scenario authority is tied to the exact route, node, capability, Source, and
preview identities. The real adapter publishes Runtime pending before the user explicitly settles
the exact success or declared `invalidCredentials` result; request input and password data are
never observed or retained. Integration and production remain visible but unavailable.

Cleanup synchronously revokes request admission and pending transport, while preview replacement
cannot publish a late predecessor result. Fidelity is reported conservatively as `same`,
`equivalent`, `approximate`, or `undeclared`, with every known approximate difference visible. The
compatibility closure also gives Components a real drag handle and panel-wide insertion target,
Layers one stable global nested-slot projection, and newly inserted components an immediately
visible guarded Delete action.

The focused App suite passes 86/86, the complete App suite passes 252/252, and the independent root
proof passes 11/11. Exact evidence is
the `29,407`-byte
[`desen-app-0.1.0-fixtures-scenarios-fidelity.json`](docs/proof/artifacts/desen-app-0.1.0-fixtures-scenarios-fidelity.json)
at `sha256:3f08980e687d48ba267f78c7d4dd1ae1eb59db5cc6bb3401d88705ee0416cc9d`; the reviewed report is
[`DESEN-APP-FIXTURES-SCENARIOS-FIDELITY.md`](docs/proof/DESEN-APP-FIXTURES-SCENARIOS-FIDELITY.md).
The live local CI authority contains 194 workloads and 92 proof pairs—81 ordinary and 11 barriers—
with a 59-proof-unit/128-workload closure and ownership over 1,232 tracked/184 proof-owned paths.
Append-only proof-reader sequence 50 advances
`sha256:45ed64e604400f18b15b3b4ef44bc35634a6c1567b46174329ec36529168272e` to
`sha256:6abea41064a05efe363df0f66d1e7d1b4923af08f819acf4c266b092985192a4` across 46 artifacts and
92 readers. Its checkpoint, promotion, selector plus required-affected, ownership, and remaining
touched-CI regression suites pass 73/73, 19/19, 56/56, 15/15, and 127/127 locally.
M09-T11 is `DONE`; implementation progress is 106/145 (73%), M09 is 11/14 (79%), and proof gates
remain 10/13. N-035 and S-001 are `TESTED`; P-08 remains `NOT_PROVEN`, P-09 and P-10 remain
`PARTIAL`, N-036 remains `PLANNED`, PF-028 is `CLOSED`, and PF-025, PF-083, and PF-089 remain
`OPEN`. Durable save/open, diagnostics, publication/activation, and automated real-browser E2E
remain unclaimed. M09-T12 is next.

M09-T12 adds Design-only Open/Save controls over a trusted-host-injected public Editor Core
`DesenEditorPersistencePort`. The exact `account-app/sign-in` route owns one fixed
`account-app-source` storage identity independently of `Source.id`. Open reauthorizes the complete
stored document, Catalog projection, surface, and publishable preview before replacing the current
authored session atomically. Failed, missing, wrong-document, and stale opens preserve the current
draft.

Awaited Open/Save settlements are captured only from exact own enumerable data descriptors without
invoking accessors. Valid optional diagnostic pointers, contexts, and subjects are copied into fresh
frozen data, and every CAS outcome must match the dispatched expected-generation relationship. A
malformed Open becomes a controlled retryable failure that retains the draft; a malformed Save is
indeterminate and requires reopen. Operation authority is rechecked after settlement reflection and
opened-document admission, so a reentrant edit or disposal cannot publish stale state.

Save sends only the controller's immutable authored Source snapshot with its exact expected
generation. Create, update, and unchanged remain distinct CAS outcomes; conflict, exhausted
generation, and indeterminate commit require an explicit reopen, with no automatic retry or merge.
A complete admitted authored Source canonical value—not object identity or document version—is the
dirty authority. Same-value replacements and canonical reverts are clean; successful Open and Save
establish the baseline, and Save settlement compares current canonical content with the dispatched
snapshot so newer edits stay dirty. `reopenRequired` continues to override canonical cleanliness
until an admitted Open. Stale work cannot publish after an edit, route unmount, StrictMode replay,
trusted-host replacement, or disposal. Catalog scenarios, fixtures, Runtime input, and secrets never
enter the persistence request.

Dirty Open requires explicit inline confirmation. One centralized authored-session commit path
updates surface-owned canonical baseline/current refs and a rerender-safe no-port dirty projection.
The current surface/controller guard admits pristine no-port navigation. Its exact clean label is
`Local draft unchanged`. Edited no-port and port-backed dirty drafts require admission across App
links and browser traversal, while `beforeunload` protects dirty page exit. Generation, dirty, pending,
conflict/uncertainty, and reopen-required states stay visible without color-only meaning. The App
deliberately supplies no concrete storage adapter; the trusted host owns that separate platform
boundary.

The retained authoring UX gives each compatible Components card a dedicated dotted native-drag
grip and keeps click insertion on a separate `Add` button. The complete authenticated Components
panel accepts the drop for the highlighted target; the sticky `Add to` card remains a persistent
target summary rather than the only narrow release surface. Layers starts movement only from a
dedicated dotted grip, fences the innermost nested-slot owner and drag epoch, applies midpoint
hysteresis, keeps compact insertion lanes layout-stable while each visible row projects its
before/after half, shows accepted and current-position feedback, and retains the last admitted
placement through coordinate-less or rejected release drift. A successful insert switches to
Layers, focuses the new node, and exposes the guarded `Remove layer` control plus Delete/Backspace
shortcuts.

The focused persistence suite passes 142/142 across five files, the complete App suite passes
324/324 across twenty-two files, and the independent root mutation proof passes 12/12. Exact
evidence is the 27,053-byte
[`desen-app-0.1.0-source-persistence.json`](docs/proof/artifacts/desen-app-0.1.0-source-persistence.json)
at `sha256:717d0ddada008edb34909d5defcc4c28e95b36f6dfc0b1abb4d09d9775a6b734`; the reviewed 5,009-byte
report is [`DESEN-APP-SOURCE-PERSISTENCE.md`](docs/proof/DESEN-APP-SOURCE-PERSISTENCE.md) at
`sha256:63d5d115e719ccdd91ecf68eea91bcd6f8c68c6513a8fbdea3bfd9f855637821`. The artifact
authenticates exact M09-T01, M08-T08, and M09-T11 parents and binds 35 current files without
tracking historical App readers.

The live local CI authority contains 196 workloads and 93 proof pairs—82 ordinary and 11 barriers—
with a 60-proof-unit/130-workload connected closure. Ownership covers 1,243 tracked paths,
including 186 proof-owned paths. Its neutral inventory, impact graph, path set, and ownership
projection are pinned at `sha256:c1d3eb2b4b56e9a97d700f89ac0c0ff9c24bf158c3d18bd8e3d40c9c52b63eb7`,
`sha256:97099a5cb52895eb80d095e99bf18838688d8a0aecf7af49993f0077466558c5`,
`sha256:f216ba32517fd708d24b9d78035894e20951f5cd420d419a66e5ce0b813881c5`, and
`sha256:6511d79ff42cb84dd303f771b821a061cd89c72462dddf2ccd3966397c602983`.
Append-only proof-reader sequence 51 advances exact sequence-50 predecessor
`sha256:6abea41064a05efe363df0f66d1e7d1b4923af08f819acf4c266b092985192a4` to
`sha256:42e88946b598566a46237af8d30587fa765d9d58807e864464fc5525fbc64921` across 47 frozen
artifacts and 94 current readers. Checkpoint, promotion, selector plus required-affected,
ownership, and remaining touched-CI suites pass 74/74, 19/19, 58/58 (21 + 37), 15/15, and
128/128—294/294 combined.

M09-T12 is `DONE`; implementation progress is 107/145 (74%), M09 is 12/14 (86%), and proof gates
remain 10/13. `N-012`, `N-018`, and `S-003` remain `TESTED` with App-consumption evidence; P-08
remains `NOT_PROVEN`, P-09 and P-10 remain `PARTIAL`, and PF-085/PF-089 remain `OPEN`.
Node-linked diagnostics, publication/activation, a concrete App storage adapter, and automated
real-browser E2E remain unproven. M09-T13 is next.

M09-T13 keeps a rejected candidate outside authored Source, publishable preview, managed Runtime,
dirty state, Save requests, and persistence generations. Only its exact frozen continuous-
validation report is retained as transient App state. Candidate document and Catalog-set
fingerprints, exact project/surface route, the still-current committed-document owner, and the live
Runtime React diagnostic index fence every projection; stale or inconsistent authority returns no
partial navigation model.

Selectable targets come only from `context.surfaceId` plus explicit `subject.kind` and
`subject.id` mappings in `invalidSubjects`. Diagnostic code, message, pointer, capability, and
incidental context text remain presentation metadata and never infer identity. Original diagnostic
order, duplicate occurrence pointers, distinct node/behavior identities, visible unmapped and
out-of-route diagnostics, and inert dynamic obligations are preserved. Selection stores only an
opaque snapshot-bound key and re-admits it from the current projection.

The compact Inspector diagnostics section uses native target buttons, announces its count, marks
the current target with `aria-current`, and provides explicit dismissal without autofocus. An
admitted target renders an App-owned invalid-change placeholder as a sibling outside the managed
Runtime subtree while the current valid preview remains visible. The surface is Design-only: Run
hides and inerts diagnostics, returning to Design does not steal focus, and a successful edit or
session replacement revokes the rejected report.

The focused nine-file diagnostics suite passes 161/161, the complete twenty-four-file App suite
passes 339/339, and the independent root mutation proof passes 12/12. Exact evidence is the
29,208-byte [`desen-app-0.1.0-node-linked-diagnostics.json`](docs/proof/artifacts/desen-app-0.1.0-node-linked-diagnostics.json)
at `sha256:8ac4d81d9097e188860757c637673ff406ba9f82b8cd8f379f184ef85138e972`. It binds 39 current
files and eleven exact Runtime, Editor Core, and App proof parents.

The live local CI authority now contains 198 workloads and 94 proof pairs—83 ordinary and eleven
barriers—with a 62-proof-unit/134-workload connected closure. Complete ownership covers 1,253
tracked paths, including 188 proof-owned paths. The neutral inventory, impact graph, path set, and
ownership projection are pinned at `sha256:d3b479cc998d6c84d53b9b0d64e6121033d94bbf9b502fcb9e7adc2487b3d908`,
`sha256:b6fae5194e9dd837d05e1ce44808d6b8054742b564420b42901a39e23d4581b1`,
`sha256:372a30ee1f8db5b7d1a35e7fd0b46335513724c59bdfa0540513be2e1938d492`, and
`sha256:7d5a90e56b4b32e2d7e1a0306b09669855642b30558155dba9a07f1ccf7da7a3`.
These are local receipts and claim no required-gate or hosted-CI result. M09-T13 is `DONE`, P-16 is
`PROVEN`, PF-086 remains `OPEN`, proof gates remain 10/13, implementation progress is 108/145
(74%), M09 is 13/14 (93%), and M09-T14 is next.

M09-T14 closes the fixed `account-app/sign-in` publication path without turning an editor preview
into deployment authority. Publish is admitted only when the current authored Source is clean and
canonically identical to its last successfully saved Source generation. The App reruns the public
Publisher from that exact Source, requires the fresh Bundle revision to match the current
publishable-preview revision, and sends only the exact canonical Bundle bytes plus revision through
an injected trusted-host port.

The Editor Web adapter stores those immutable bytes by revision and advances only the fixed
`preview` channel through compare-and-set. Channel movement remains separate from activation: the
App reports Active only after a distinct server-owned reference-host receipt names that same
revision and its durable generation. Conflict, stale, failed, mismatched, or indeterminate outcomes
never become active and preserve the last-known-good revision. Synchronous external-store delivery
keeps the visible stage current, while a same-tick host-port replacement revokes the predecessor
lifetime before late channel or activation settlements can reach the new UI. Scenario projections,
fixtures, Runtime inputs, secrets, and rejected-candidate diagnostics are excluded from
publication. Browser production code imports neither Node control-plane composition nor the
reference-host server.

The same closure retains the user-requested authoring compatibility repair. Dedicated Layers and
Components grips are enlarged to `28 × 32 px` and `32 × 32 px`, respectively, without shifting
layout. Layers exposes stable, non-overlapping, full-width `20 px` insertion lanes that directly
own boundary events, with row-half fallback and innermost-slot fencing. The sticky Components
`Drop target` directly owns the drop while the authenticated panel remains a same-target fallback.
`Add` immediately selects the inserted node, leaving the existing visible guarded `Remove layer`
and Delete/Backspace paths available.

The focused App publication suite passes 31/31 across four files, including 2/2 real public
control-plane → fixed-channel → reference-host integration cases. The Editor Web publication and
emitted public-package suites pass 10/10 and 4/4, and the independent root mutation proof passes
12/12. Exact evidence is the 24,763-byte
[`desen-app-0.1.0-publish-activation.json`](docs/proof/artifacts/desen-app-0.1.0-publish-activation.json)
at `sha256:6bd2db0ca490f1d0046f145da7c4b7e9b4b25ec0f8295a159529a0e66534b23b`; it authenticates nine
exact parents, 33 current tracked receipts, and 45 focused declarations. The local exhaustive
authority contains 200 workloads and 95 proof pairs—84 ordinary and 11 barriers—with a
63-proof-unit/136-workload T14 closure and ownership over 1,267 tracked paths, including 190
proof-owned paths. Its neutral inventory, impact graph, path set, and ownership projection are
pinned at `sha256:c6655119e0b24594bced92b6b916917e0f336351c19cf338ee21d3b8d141f684`,
`sha256:4a2e2d7d4d15a8f3d563aee7b248b14bba6ce44c27b464773a825d9c44fc58bf`,
`sha256:e8e1841e828a63bf84d57e457047ffaef7e6ca1998b6e7c89201758d44dec5f5`, and
`sha256:18497e4c50dd0dfa8f8dd7adaf9b6130779db7c0799798ef99e3de8bcf764486`.
Append-only sequence 53 historically advances exact sequence-52 head
`sha256:c42b0c0fe010b04128a31f26b25a5875e72b7566fa64403d0223b4dbada478a9` to
`sha256:48a1457317c593b846cd4750eb309e846c33248824559d27810441584f0144d8` across 49 artifacts
and 98 current readers. Compatibility sequence 54 is the immutable predecessor: it preserves
those 49 frozen artifacts and 98 reader identities, advances that exact sequence-53 head to
`sha256:0772221371ffe1a35fe955b8cad34c725d0f9ae933714f81f10b3451214a6638`, and reseals only
M08-T08 proof-library/root-test readers `[64, 65]`. The frozen 49,785-byte M08-T08 artifact remains
`sha256:51932d4165afff3c40fae6769527e480f6d0ff355f3fbc6d8ae7c6809e50a6fe`. Sequence 55
preserves the same 49 frozen artifacts and 98 reader identities, links that exact sequence-54
predecessor head to `sha256:f1ac24425ca2372410835a6c5721057763792010aaf77ccc78b8d30636333a17`,
and reseals only M09-T01–T14 proof-library/root-test reader indexes `[70..97]`. The current T14
readers authenticate the exact `10,000 ms` per-test timeout successor at
`sha256:5eba8a2b15cbcf992d0f04d0d7ad719c1a9fc42cdb66635ebc0eab679a221901`; reversing that one
edit reproduces the frozen 24,485-byte test receipt, while the frozen T14 artifact remains
`sha256:6bd2db0ca490f1d0046f145da7c4b7e9b4b25ec0f8295a159529a0e66534b23b` unchanged. Checkpoint,
promotion, selector, and fourteen M09 root reader suites pass 78/78, 20/20, 23/23, and 179/179.
Promotion pins the selector at
`sha256:2855cbeedb55ede5d9db18a6b186ac07796afbc4d512f5a0aa9197bc5f177fd1`, the required-affected
runner at `sha256:b77b35a81915ec41554ab3505895fe98c0a4299ec9bf7d680dec320bbf3fb744`, and the T10 affected
plan at `sha256:e3cced8e1a9cbe6f1f5c296aa3992b07ef030c81ac9267c2deff714953ce0e39`. The integrated CI
policy regression passes 330/330. These local receipts make no required-gate or hosted-CI claim.

The corrective M09 compatibility successor keeps the route-sized editor workplane, the single
Source-declared page frame, and identical Design/Run geometry while preventing a conditionally
materialized Alert from widening its bounded Stack. The current Web–React package digest is
`sha256:d4a4e7e2ea2d68ab8bff085d90e093f2d31b784f0f2fb089c6422ce33914b051`: 80 regular
distribution files total 243,740 bytes, and the projected Catalog plus those files form 81 framed
entries totaling 252,637 bytes. The resulting official-derived Bundle revision is
`sha256:6e539a76ddd0bc9b4eff82e73508b62a3980ae5dbc73dd85ccf0c1cae6957e13`; the Source digest
remains `sha256:b8e2d6bac855fb307aaeb0636becf93834f6faeda5464bdbfbc1e8d52f379635`.
Compatibility checkpoint sequence 56 advances the exact sequence-55 head to
`sha256:1a2049082f981614c33fb2f1576cfd8d52e9dbd6dbb44f5177d3cf290064c51a`, preserving all 49
frozen artifacts and 98 reader identities. Historical package/Bundle tuples and proof pins remain
unchanged. This is corrective compatibility work, not an M10 completion: M10 remains 0/9 and
M10-T01 remains next.

M09-T14 and G09 are `DONE`; implementation progress is 109/145 (75%), M09 is 14/14, and proof gates
are 11/13. P-07, P-09, and P-10 remain `PARTIAL`; P-08 remains `NOT_PROVEN`; P-12 remains
`NOT_PROVEN` until M10-T07; N-036 remains `PLANNED`; and PF-085, PF-086, and PF-089 remain `OPEN`.
Automated real-browser E2E and native drag are not proven by this compatibility evidence; M10-T01
is next.

**M10-T01 checkpoint:** the dedicated `@desen/app-browser-e2e` workspace builds an isolated
production browser-proof bundle from an explicitly empty, structurally admitted Source/project and
authors the sign-in surface through the visible Desen App UI. Playwright, Chromium, the harness,
and failure artifacts remain outside the root and product App manifests. The passing local Chromium
scenario covers native Components and Layers drag, rejects forged
`DataTransfer` mutation, and proves the full canonical and real-persistence before/after boundary:
the exact empty Source is Generation 1, the forged drop leaves its document, save count, and
disabled Save state identical, and the completed authored Source is Generation 2. It re-admits the
stored canonical Source and requires exact managed static subtree plus `420 × 720` frame parity in
Design and Run.
The complete App suite passes 377/377 and the separately discovered browser scenario passes 1/1.
The immutable task-time proof remains the 10,259-byte historical artifact at
`sha256:959dde63ef28bc7fd25967a9193e39e082c9178bc12f40b83036c5dd6042df77`; reader checkpoint
sequence 57 records that generation among 50 artifacts and 100 readers at
`sha256:690c73294f6926822fb1535ac60ea40636545890031db72b7a8d63930a27cc57`. P-08 is `PROVEN`;
P-07, P-09, and P-10 remain `PARTIAL`. M10 is 1/9, implementation progress is 110/145 (76%),
proof gates remain 11/13, and M10-T02 is next. Input/pending, failure, success/navigation, and a
real host operation remain unproven, G10 stays open, and no exact-head hosted-CI success is claimed
by these local receipts.

The corrective `M10-T01-COMPAT` receipt is append-only and is not another plan task. Its separate
16,025-byte artifact authenticates 32 current harness, package, workflow, and boundary files at
`sha256:e90378e191fddea1264c8c056e2ff7a72fdfd945d1b1113465c12ddbffb1888d`; its independent reader
passes 11/11. The explicit browser-workspace boundary fixtures pass 19/19, and the full boundary
run passes across 808 modules and 3,319 dependencies. Append-only reader checkpoint sequence 58
preserves sequences 1–57 and advances the exact sequence-57 head to
`sha256:08396f779b0c1c63cf56d9a9292dcd0a103228c57fe39e1173d95a4a106a92e5` across 51 frozen
artifacts and 102 current readers. The permission-model fixture correction preserves sequences
1–58 and appends sequence 59 at
`sha256:349a292c9137f0f66c5cd58f384aa2175082613500905fdb723f15b246cbd2e8`, resealing only the
changed M10-T01 root-test reader while retaining the same 51 artifacts and 102 reader identities;
the dedicated checkpoint suite passes 82/82. These corrective authorities do not add another plan
task or claim an exact-head hosted result.

**M10-T01A checkpoint:** the normal Desen App now starts from an honest zero-project state and
offers one visible, exact blank sign-in profile. Creating it persists Generation 1 through the real
loopback control-plane adapter, opens the ordinary editor, and reuses the same compare-and-set
controller for later saves. The product never injects a proof document or silently substitutes the
old fixture. Local state lives outside Vite's served root, every direct or encoded `.desen` and
`/@fs/` state path is denied before SPA fallback, and lifecycle, conflict, indeterminate-save, and
discard paths fail closed.

The normal-product Chromium scenario uses only visible controls for New project, native Components
and Layers drag, state, bindings, actions, order, deletion, Generation 2 save, hard reload, and
Projects-card reopen. The complete App suite passes 407/407; product/lifecycle and local-runtime
suites pass 16/16 and 17/17; the historical and normal-product browser scenarios each pass 1/1.
The immutable 20,173-byte task artifact carries 43 exact receipts and is
`sha256:6277b82f22bf26e92b670164f2f1e2b7f861409f5b37585fb5053d88c4dadd2e`, and its independent
reader passes 11/11. Reader checkpoint sequence 61 preserves sequences 1–60 and advances the exact
sequence-60 head to
`sha256:a80e008bf0f383ab46d097abfec17710131a47656040ec07dc7cc60f965666fb` across 52 frozen
artifacts and 104 readers. Sequence 62 preserves sequences 1–61 and advances that exact head to
`sha256:15ede557b4167cb7bc0cce89b02cf0e9d9f0f7e92c4c5fdc2d799cb3bcf0be55` by resealing only the
M10-T01-COMPAT root reader for runner-owned temp isolation; the checkpoint suite passes 85/85. The
current CI universe contains 206 workloads and 98 proof units; M10-T01A's affected closure contains
66 proof units and 142 workloads.
The boundary graph covers 818 modules and 3,373 dependencies with no violation; all 23 fixtures
pass. Ownership covers 1,323 tracked paths and 196 proof-owned paths.
M10-T01A is `DONE`, implementation progress is 111/146 (76%), M10 is 2/10, and M10-T02 is next.
Typed input/pending, invalid credentials, success/navigation, remote deployment, multi-user
persistence, and G10 remain unproven. These local receipts make no exact-head hosted claim.

**M10-T01B checkpoint:** the normal editor now authors behavior without a JSON-first workflow.
Text fields connect their controlled value and canonical change write atomically; visual controls
cover the closed action union and conditional component presence; and Run mode derives generic
operation fixtures from the authored Source and Catalog rather than a sign-in-specific branch.
Advanced JSON remains available for expert use. The real Chromium flow starts with the visible
blank-project product route, repairs text-field connections, types complete values, authors a
button operation plus failure-visible Alert, observes pending state, and completes the Catalog
error fixture.

Focused behavior tests pass 135/135, the current App suite passes 427/427, and Chromium passes 1/1.
The immutable 10,962-byte artifact carries 31 exact receipts at
`sha256:cd7366014a0cb6f056fa78392f81ef7cb4b5be2f523b95e5984c704be3caf0e8`.
Reader checkpoint sequence 64 freezes 53 artifacts and 106 readers at
`sha256:2590f7ebf99b927ccded490e511748e8e5abcf0a49108f67c78061aa021da5f0`.
The hosted-browser compatibility correction keeps those artifacts and reader identities, updates
the retained journey to the visible atomic **Connect input** flow, and reseals only reader indexes
`[70..97, 102, 103]`. Corrective sequence 65 closes at
`sha256:fad195aa82484ec15e347e3681ba6be64e6f1e28d5f724bf1fabeb892a7afe14`; the exact two-config
Chromium command passes 1/1 + 1/1 locally, but no hosted exact-head success is inferred.
M10-T01B is `DONE`; implementation progress is 112/147 (76%), M10 is 3/11, and M10-T02 remains
`NOT_STARTED` and next. Dedicated M10-T02/T03 lifecycle matrices, M10-T04 real-host operation
evidence, remote deployment, multi-user persistence, and G10 remain open.

**M10-T02 checkpoint:** the normal product now proves complete controlled input and one real
unresolved Runtime pending lifecycle through visible no-code controls. The operation recipe maps
Catalog inputs from compatible local state, chooses a collision-free result alias and explicit
concurrency, and writes the Button Loading reference atomically. It suggests a state automatically
only when the state and input names match exactly. Repair preserves unrelated
actions, settlement branches, guards, and extensions; absent optional inputs stay absent, while an
advanced value that visual controls cannot represent blocks Repair instead of losing data.

The dedicated Chromium journey starts from the visible blank-project flow, uses **Set Secure** and
checks the rendered password input is native `type=password`, types both values in multiple chunks,
selects the Catalog-derived synthetic outcome, and observes the unresolved Promise through Runtime
pending and accessible Button loading. It confirms the
default repeat policy, selects queue so a leaked activation would remain observable, presses Enter
while the focused Button is busy, and preserves both values and pending state across Design/Run.
Explicit completion stays terminal across two animation frames, then clears loading without
asserting an Alert or navigation. Focused coverage
passes 82/82, Chromium passes 1/1, and the independent root reader passes 10/10.

The deterministic 14,261-byte / 25-receipt artifact is
`docs/proof/artifacts/desen-app-0.1.0-input-pending-fixture.json` at
`sha256:161202698b013775cbc89625ecea1f6894e9abcd927fb2eb660dff71652ba43d`. Its bounded
2,307,407-byte historical bridge is pinned at
`sha256:16f6ec332fb03368e617563560b9930a7608594907ce61d5d15554be4dc7523d` without rewriting the
immutable M10-T01C predecessor. The neutral CI universe contains 212 workloads / 101 proof units;
the App closure contains 69 proof units / 148 workloads, and exact-one ownership covers 1,366
tracked paths / 202 proof-owned paths. Checkpoint sequence 67 preserves sequences 1–66 and closes
the 55-artifact / 110-reader chain at
`sha256:9ee6909c0f11ed7149cb9bf6ce1c7943ed99aac2d2c6f9138caea8f5dd2044b7` with 90/90 passing
cases. M10-T02 is `DONE`; progress is 114/148 (77%), M10 is 5/12
(42%), and M10-T03 is next. P-09 and P-10 remain `PARTIAL`; visible failure remains M10-T03,
success/navigation and a separately authorized real host operation remain M10-T04, and G10 stays
open. Local receipts do not imply a hosted exact-head `Quality gate` pass.

**M10-T03 checkpoint:** the normal product now proves its dedicated visible public-failure slice in
Chromium. Starting from the current authenticated profile's visible blank project, the designer
authors controlled email and secure-password state, connects the Button to the Catalog operation,
and adds a critical Alert conditioned on the operation's `failed` status. The journey uses neither
raw JSON nor direct DOM or network mutation.

The Alert is absent while idle and while the Runtime call is genuinely pending. Explicitly settling
the exact Catalog-declared `invalidCredentials` fixture reveals the managed critical Alert, clears
accessible Button Loading, preserves both complete input values, and leaves the route unchanged. A
real retry hides the Alert while pending, restores Loading, and reveals the same public failure after
the second declared settlement. The `420 × 720` frame and horizontal document geometry remain stable
through idle, pending, failure, and retry.

The deterministic reader binds 139 focused `it`/`it.each` declaration sites, while actual focused
Vitest execution passes 144/144 (App 52, reference components 11, Runtime 81). The dedicated
Chromium scenario passes 1/1, and the independent root reader passes 10/10. The deterministic
16,868-byte / 34-receipt artifact is
`docs/proof/artifacts/desen-app-0.1.0-failure-fixture.json` at
`sha256:bde909f8dbc4837c70627bab454d3dc5a936bd0abb6d70ec22b9cffbdb0e6a20`. Its bounded
2,491,742-byte T02 historical bridge is pinned at
`sha256:a3ef969f87441e2d8079dc7cd27db3a759acbb645441d206c3b35adc3149ec10` without rewriting the
immutable predecessor.

The neutral CI inventory contains 214 workloads / 102 proof units; the M10-T03 closure contains 70
proof units / 150 workloads, and exact-one ownership covers 1,377 tracked paths / 204 proof-owned
paths. Checkpoint sequence 68 preserves sequences 1–67 and closes 56 artifacts / 112 readers at
`sha256:e685779412ca17b76c78a56ff545bbff5a7fc5efc8bc564247cc49e7c54eeca8` with 91/91 passing
cases.

M10-T03 is `DONE`; implementation progress is 115/148 (78%) and M10 is 6/12 (50%). P-09 and P-10
remain `PARTIAL`; success, navigation, and a separately authorized real host operation remain
M10-T04. Integration, Production, N-036, and G10 remain open, and local receipts do not imply a
hosted exact-head `Quality gate` pass. M10-T04 is next.

**M10-T04 checkpoint:** the ordinary product now offers an additive blank Flow app workspace with
Start and Result surfaces, leaving existing Account app Sources untouched. A designer authors both
pages and a Success → Navigate action through visible controls. Synthetic success mounts the
authored target without a host request. Explicit Integration uses a separately authenticated local
HTTP service: a real 401 preserves the origin and its authored Alert; a real 200 mounts the target
through the same Publisher and Runtime adapters. Saved Source bytes, generation and editor URL
stay unchanged during Run. Restart run and Design restore the authoring origin.

The host binding is opaque and exact-profile-bound; documents never choose an endpoint, credential,
handler or executable module. The local account service is a test binding, **not production
authentication**. Generic non-authentication and fixture-free operations, cancellation, replay,
invalid output and stale authority have focused negative coverage. Production remains disabled.

The complete App suite passes 611/611, all five Chromium journeys pass, and the focused T04 slice
passes 177/177 (App 141, Runtime 36). The independent task reader passes 10/10 over the 22,456-byte,
51-receipt artifact at
`sha256:d9d841af06ec9efc51c3f1c74079f0aa4d5e1c7e996f3b97df7e277e4b1f8423`.
[The success/host proof](docs/proof/DESEN-APP-SUCCESS-HOST-OPERATION.md) records the exact evidence;
[ADR 0017](docs/adr/0017-desen-app-explicit-integration-and-run-navigation.md) records the authority
and navigation decisions. P-09 and P-10 advance to `PROVEN`; P-07, N-036 and G10 retain their later
owners. M10-T05, publication and activation without host source edits, is next and remains
`NOT_STARTED`. The `DONE` entry is a closure candidate until this exact PR head's hosted
`Quality gate` passes; local evidence alone never authorizes merge.

**M10-T05 checkpoint:** the normal product now performs two visible Save → Publish → Activate
cycles from a blank Account project. A separately built reference host first mounts revision A,
then shows revision B's changed Text label and Stack gap after reload; a second reload preserves B.
The host HTML, JavaScript, CSS, and source identities remain unchanged. Authored Source never selects
the fixed channel, host, endpoint, bearer, activation callback, server implementation, or executable
module.

The task verifier passes, the independent root reader passes 10/10, focused suites pass 74/74,
18/18, 35/35, and 31/31, and the dedicated Chromium journey passes 1/1. Fresh Vite audits contain
168 App modules / 510 static edges and 104 host modules / 299 static edges, no dynamic or unresolved
edges, and 22 byte-identical managed modules shared by both builds. Dependency boundaries pass over
861 modules / 3,685 dependencies.

The 189,123-byte, 116-receipt artifact is
[`desen-app-0.1.0-published-host-update.json`](docs/proof/artifacts/desen-app-0.1.0-published-host-update.json)
at `sha256:80c0b815a813ef462233b48a7fffe7c4d0bbf391aefc68eb9a6174da6bd84bd3`.
Checkpoint sequence 72 preserves sequences 1–71 and authenticates 59 frozen artifacts / 118
current readers at
`sha256:1e1fee6eefa05a75954ae5b19cc53cb0057abc232f6820117972399ef422f747`.
[The T05 proof](docs/proof/DESEN-APP-PUBLISHED-HOST-UPDATE.md) and
[ADR 0020](docs/adr/0020-desen-app-fixed-destination-publication-and-host-activation.md) record the
evidence and authority boundary. P-07 advances to `PROVEN`, PF-059 closes, implementation progress
becomes 117/148 (79%), and M10 becomes 8/12 (67%); proof gates remain 11/13. M10-T06 is next.
Invalid publication, last-known-good recovery, production identity, remote or multi-user deployment,
native targets, P-12, N-036, and G10 remain open. T05's `DONE` entry remains a closure candidate
until fresh hosted `Quality gate` and `Browser E2E` pass for its exact final PR head.

**Strategic checkpoint:** `SC-01` is complete with the recommendation **`continue`**. DESEN
remains independent; A2UI is complementary, with only a deliberately narrow fail-closed bridge
spike retained as evidence.

## Product boundaries

- **DESEN** is the open, data-only executable design protocol.
- **Desen App** (`desen.app`) is the official visual authoring and publishing product built on
  DESEN. It is not the protocol itself.
- **DESEN Developer Platform** (`desen.run`) is the protocol, SDK, conformance, integration, and
  package documentation home. It is a domain and developer surface, not a second authoring product.
- **`desen` on npm** will become the developer entry package and CLI after the public-alpha proof
  gates pass.

## Current goal

Prove, with repeatable evidence, that a designer-authored surface can be validated, published as
an immutable DESEN bundle, and activated in a separately built host application without a
developer recreating that surface in React.

The first target is exactly `web-react`. Platform-neutral packages must remain free of React,
DOM, CSS, browser, and application dependencies so future native runtimes can implement the same
observable protocol semantics.

## Workspace map

```text
apps/
  desen-app/              Visual authoring and publishing product
  reference-host-web/     Separately built production-like proof host
  control-plane-api/      Source, bundle, and channel service
  desen-run/              Future DESEN Developer Platform site
packages/
  protocol/               Frozen 0.1.0 artifacts, types, diagnostics, digest helpers
  validator/              Structural and semantic validation
  publisher/              Pure source-to-bundle publication
  runtime-core/           Framework-neutral execution semantics
  runtime-react/          React render adapter
  runtime-web/            Browser host ports and last-known-good storage
  catalog-sdk/            Capability registration and manifest tooling
  editor-core/            Framework-neutral source editing commands
  editor-web/             Desen App canvas and inspector
  reference-catalog-web/  Real components shared by editor and host
  testkit/                Fixtures, trace assertions, and conformance helpers
  desen/                   Future public npm facade and CLI
```

## Non-negotiable rules

1. The frozen protocol repository is never silently edited to make the implementation pass.
2. The runtime and publisher are built before the visual editor.
3. The Desen App preview and reference host use the same registered component implementations.
4. The reference host contains no manually duplicated managed-screen component tree.
5. Production bundles contain data, never arbitrary executable code.
6. Unknown or incompatible capabilities fail explicitly; runtimes never guess replacements.
7. A failed activation leaves the last-known-good revision active.
8. Every public export has TSDoc and every package has a maintained README.
9. Comments explain invariants and reasoning, not syntax.
10. No external package or domain is published before the public-alpha release gate.

## Start here

- [Project status](PROJECT-STATUS.md)
- [Master implementation plan](docs/plan/MASTER-PLAN.md)
- [Task board](docs/plan/TASKS.md)
- [Infrastructure debt and cleanup register](docs/plan/DEBT-REGISTER.md)
- [Strategic validation checkpoints](docs/plan/STRATEGIC-VALIDATION.md)
- [SC-01 DESEN–A2UI comparison](docs/proof/SC-01-DESEN-A2UI-COMPARISON.md)
- [DTCG 2025.10 compatibility profile](docs/profiles/DTCG-2025.10-COMPATIBILITY.md)
- [ADR 0009: protocol positioning and interoperability](docs/adr/0009-sc-01-protocol-positioning-and-interoperability.md)
- [ADR 0011: modular proof infrastructure](docs/adr/0011-modular-proof-infrastructure.md)
- [Proof matrix](docs/proof/PROOF-MATRIX.md)
- [Structural-validation proof](docs/proof/PROTOCOL-STRUCTURAL-VALIDATION.md)
- [Semantic-foundation proof](docs/proof/PROTOCOL-SEMANTIC-FOUNDATION.md)
- [Component-contract proof](docs/proof/PROTOCOL-COMPONENT-CONTRACTS.md)
- [Interaction-contract proof](docs/proof/PROTOCOL-INTERACTION-CONTRACTS.md)
- [Binding-contract proof](docs/proof/PROTOCOL-BINDING-CONTRACTS.md)
- [Execution-contract proof](docs/proof/PROTOCOL-EXECUTION-CONTRACTS.md)
- [Official-suite parity proof](docs/proof/PROTOCOL-OFFICIAL-SUITE-PARITY.md)
- [Validator diagnostic micro-vector proof](docs/proof/PROTOCOL-VALIDATOR-DIAGNOSTIC-MICRO-VECTORS.md)
- [Catalog registration and derivation proof](docs/proof/CATALOG-MANIFEST-REGISTRATION.md)
- [Web–React package digest proof](docs/proof/WEB-REACT-PACKAGE-DIGEST.md)
- [Reference Web component proof](docs/proof/REFERENCE-CATALOG-WEB-COMPONENTS.md)
- [Reference Web form and feedback proof](docs/proof/REFERENCE-CATALOG-WEB-FORM-FEEDBACK.md)
- [Reference token and synthetic fixture proof](docs/proof/REFERENCE-TOKENS-AND-SYNTHETIC-FIXTURES.md)
- [Reference sign-in fixture and host-binding proof](docs/proof/REFERENCE-SIGN-IN-FIXTURES-AND-HOST-BINDING.md)
- [Reference Web implementation-parity proof](docs/proof/REFERENCE-CATALOG-WEB-PARITY.md)
- [Reference Web capability-artifact proof](docs/proof/REFERENCE-CATALOG-WEB-CAPABILITY-ARTIFACT.md)
- [Publisher result and strict Source-ingress proof](docs/proof/PUBLISHER-PUBLISH-RESULT.md)
- [Publisher exact Catalog-resolution proof](docs/proof/PUBLISHER-CATALOG-RESOLUTION.md)
- [Publisher Source-preflight proof](docs/proof/PUBLISHER-SOURCE-PREFLIGHT.md)
- [Publisher capability-preflight proof](docs/proof/PUBLISHER-CAPABILITY-PREFLIGHT.md)
- [Publisher execution-preflight proof](docs/proof/PUBLISHER-EXECUTION-PREFLIGHT.md)
- [Publisher Source-preservation proof](docs/proof/PUBLISHER-SOURCE-PRESERVATION.md)
- [Publisher Source-digest and normalization proof](docs/proof/PUBLISHER-SOURCE-NORMALIZATION.md)
- [Publisher Source-digest authentication and Catalog-pinning proof](docs/proof/PUBLISHER-CATALOG-PINNING.md)
- [Publisher complete Bundle publication proof](docs/proof/PUBLISHER-BUNDLE-PUBLICATION.md)
- [Publisher official Source-to-Bundle golden](docs/proof/PUBLISHER-OFFICIAL-GOLDEN.md)
- [Publisher public invalid-Source no-Bundle matrix](docs/proof/PUBLISHER-INVALID-SOURCE-MATRIX.md)
- [Control-plane immutable Bundle-store proof](docs/proof/CONTROL-PLANE-BUNDLE-STORE.md)
- [Runtime core host-port proof](docs/proof/RUNTIME-CORE-HOST-PORTS.md)
- [Runtime core value-resolution proof](docs/proof/RUNTIME-CORE-VALUE-RESOLUTION.md)
- [Runtime core token and format-resolution proof](docs/proof/RUNTIME-CORE-TOKEN-FORMAT-RESOLUTION.md)
- [Runtime core predicate-evaluation proof](docs/proof/RUNTIME-CORE-PREDICATE-EVALUATION.md)
- [Runtime core Variant and style-override proof](docs/proof/RUNTIME-CORE-VARIANT-STYLE-EVALUATION.md)
- [Runtime core local-state and base-identity proof](docs/proof/RUNTIME-CORE-LOCAL-STATE-IDENTITY.md)
- [Runtime core repeat-materialization proof](docs/proof/RUNTIME-CORE-REPEAT-MATERIALIZATION.md)
- [Runtime core resource-lifecycle proof](docs/proof/RUNTIME-CORE-RESOURCE-LIFECYCLE.md)
- [Runtime core operation-lifecycle proof](docs/proof/RUNTIME-CORE-OPERATION-LIFECYCLE.md)
- [Runtime core state and navigation-action proof](docs/proof/RUNTIME-CORE-STATE-NAVIGATION-ACTIONS.md)
- [Runtime core operation and resource-action proof](docs/proof/RUNTIME-CORE-OPERATION-RESOURCE-ACTIONS.md)
- [Runtime core command and host-event action proof](docs/proof/RUNTIME-CORE-COMMAND-EVENT-ACTIONS.md)
- [Runtime core bounded action-turn proof](docs/proof/RUNTIME-CORE-ACTION-TURNS.md)
- [Runtime core generic adapter-bridge proof](docs/proof/RUNTIME-CORE-ADAPTER-BRIDGES.md)
- [Runtime core reactive reevaluation proof](docs/proof/RUNTIME-CORE-REACTIVE-REEVALUATION.md)
- [Runtime core headless sign-in and G04 proof](docs/proof/RUNTIME-CORE-HEADLESS-SIGN-IN.md)
- [Runtime core G04 audit-hardening proof](docs/proof/RUNTIME-CORE-AUDIT-HARDENING.md)
- [React adapter registry and render-plan proof](docs/proof/RUNTIME-REACT-ADAPTER-REGISTRY.md)
- [Reference-host official sign-in execution proof](docs/proof/REFERENCE-HOST-WEB-SIGN-IN.md)
- [Reference-host source and resolved-import audit](docs/proof/REFERENCE-HOST-WEB-SOURCE-AUDIT.md)
- [ADR 0010: React runtime and independent host boundaries](docs/adr/0010-m05-react-runtime-and-reference-host-boundaries.md)
- [Architecture](docs/architecture/ARCHITECTURE.md)
- [Technology stack](docs/architecture/TECHNOLOGY-STACK.md)
- [Engineering standards](docs/standards/ENGINEERING-STANDARDS.md)
- [Documentation standards](docs/standards/DOCUMENTATION-STANDARDS.md)
- [Protocol findings](docs/plan/PROTOCOL-FINDINGS.md)

## Local quality commands

```bash
pnpm install
pnpm --filter @desen/app-browser-e2e exec playwright install chromium
pnpm verify:protocol-snapshot
pnpm --filter @desen/app-browser-e2e test:e2e
pnpm check
```

The filtered Playwright install command is a one-time local browser setup. The dedicated workspace
command then builds the product dependency closure and isolated M10 proof application before it
runs package-pinned Chromium. Root `pnpm test:e2e` stays reserved for the future G10 runner.
`pnpm proof` deliberately returns `NOT_IMPLEMENTED` until the complete G10 runner exists; an
absent proof runner is never treated as a successful proof.

The exact DESEN 0.1.0 input snapshot is vendored and checksum-enforced. Schema-derived types,
canonical JSON and SHA-256 primitives, the 36-code diagnostic registry, and RFC 6901 JSON Pointer
support are implemented. Structural validation now checks unknown input against the exact frozen
Source, Bundle, and Catalog roots and validates all protocol-defined embedded JSON Schema locations.
It returns an independent immutable snapshot and stable pointer diagnostics; runtime validation
does not compile document schemas, evaluate document content, or access the network.

The M02-T07 semantic foundation now adds strict Semantic Versioning, exact declared-catalog
matching, entry and identity rules, one catalog capability namespace, category-aware component,
behavior, resource, and operation existence, and opaque extension preservation. Trusted catalog
pools may contain extra packages, but an undeclared package never authorizes a document capability.

The M02-T08 component-contract stage now validates statically knowable component props and Variant
patches, slot declarations and children, visual states, style parts, and style properties. Dynamic
ValueSpecs remain inert and become explicit later-validation obligations. Component schemas pass a
documented host-safe preparation profile before the code-free interpreter can apply them.

The M02-T09 interaction stage extends that boundary to behavior props, slots, styles, attachment
and exclusive-channel conflicts; declared component and behavior events; and command names for
already-known component targets. Its separate resolved-event API copies and freezes adapter
payloads, applies explicit depth/size limits, and validates them as ordinary JSON rather than DESEN
bindings. Event-reference resolution, command targets and inputs, and resource/operation contracts
are completed by the later T10/T11 validator boundaries; digests, publication, adapters, and
runtime execution remain later tasks. The first product proof is still `web-react`, while the
protocol and validator packages remain independent of React, DOM, and browser APIs so future iOS
and Android runtimes can reuse the same contract.

The M02-T10 binding stage now validates each surface's state schema and inert initial value,
surface-local `state.*`, lexical `item.*`, and immediate-turn `event.*` references, exact `$format`
placeholders, statically decidable predicate operand types, and repeat item/alias/key contracts. It
preserves every unresolved component and behavior obligation from T09 instead of guessing dynamic
host values. T11 now consumes that binding foundation; runtime predicate evaluation and dynamic
repeat materialization remain deliberately assigned to the runtime.

The M02-T11 execution-contract stage now prepares bounded operation/resource schemas; validates
resource policies and inputs, operation inputs and surface-scoped aliases, lifecycle references,
navigation and refresh targets, component-command targets and inputs, and statically decidable
state writes; and preserves four new dynamic execution obligations alongside the four inherited
binding obligations. Its detached five-kind resolved-value API checks command input and
operation/resource input or output as immutable inert JSON. This proves the validator handoff, not
host authorization, mounted-component liveness, adapter invocation, lifecycle settlement, or
action-turn execution.

M02-T12 proves built TypeScript parity with the frozen DESEN 0.1.0 starter suite: all 9 official
conformance vectors and all 5 public examples produce the outcomes required by the manifest, just
as the archived Python baseline passes 14/14. M02-T13 closes the declared validator scope with one
positive and one negative project micro-vector for each of 28 emitted core diagnostics and 6
validator-namespaced extension diagnostics. All 68 executions pass with exact code,
classification, pointer, and context checks where those fields apply, without adding a public API.
P-02 is now `PROVEN` and G02 is `DONE`. P-17 advances only to `PARTIAL`: M04-T13 now covers the
action-turn slice, while remaining materialization, Bundle-ingress, adapter, and activation limits
stay assigned to later milestones.

M03-T04 now defines the target-separated Web–React package digest profile. It commits a projected
canonical Catalog and exact artifact bytes through versioned, length-delimited framing, then hashes
that preimage with SHA-256. Its 18 package tests and 16 independent proof tests cover 269 pinned
mutation vectors, Catalog self-reference verification, caller ownership, immutable audit output,
portable paths, hostile inputs, and an independent cryptographic oracle. This makes P-05
`PARTIAL`; the complete artifact inventory, reproducible final tuple, distribution, and activation
remain later tasks.

M03-T05 now implements the first real reference capabilities. The frozen official Stack and Text
manifests are exposed with schema-derived React props; Stack preserves slot/reading order without
inventing ARIA semantics, while Text emits native paragraph, heading, or caption elements and
escapes markup-like strings as inert text. The deterministic evidence checks exact manifest
equality, closed public props, validator acceptance, negative contract cases, built-package
semantics, 420 pinned Stack cross-product vectors, 56 Text/escaping vectors, exact source-shape
checks, 5 focused component tests, 7 compiler-negative cases, and 18 independent proof/mutation
tests. Its proof remains the verified prerequisite for the later component slices.

M03-T06 now adds the official TextField, Button, and Alert capabilities without widening their
closed Catalog contracts. TextField uses a real label/input relationship and exact frozen change
payloads; Button preserves native non-submit activation and suppresses disabled/loading presses;
Alert maps critical feedback to `role="alert"` and ordinary feedback to `role="status"`. A narrow
TextField focus handle exposes no DOM node. The cumulative evidence validates a five-component
Catalog and controlled Source through all six validator layers, executes 256 server-rendered and
23 real React interaction vectors, fixes 11 component tests, 22 compiler-negative cases, and 18
independent mutation tests, and records the frozen prose/Catalog tone conflict as `PF-027`.

M03-T07 now adds a DTCG 2025.10-backed reference Web token provider and framework-neutral
synthetic fixture infrastructure. The provider resolves an exact 26-token inventory to 26 existing
CSS custom properties without adding a DOM wrapper or generic runtime token policy. Testkit
projects only inert `manifest.authoring.fixtures`, enforces operation/resource category and
bounded-data rules, and permits lookups only on factory-created snapshots. Its deterministic
evidence covers exact component fallback parity, real React host-style application, 19 package
tests, 20 compiler-negative cases, and 16 independent proof/mutation tests.

M03-T08 now adds the exact official sign-in operation and controlled authoring outcomes. Its
success fixture is `{ userId: "user-1" }`; `invalidCredentials` has an empty synthetic failure
payload, while `unavailable` deliberately has no invented fixture. `pending` remains runtime
lifecycle state, not static fixture data. Inert operation data and executable host code live behind
separate package subpaths. The host binding fixes the operation id and preserves only an
application-supplied callable by identity; its return stays opaque so M04 can define validation,
settlement, concurrency, and diagnostics without an early result envelope. Five focused package
tests, 10 compiler-negative cases, and 14 independent proof/mutation tests cover official-manifest
equality, successful-output schema validation, immutable/detached fixtures, missing outcomes,
binding exclusion, exact exports, source boundaries, and deterministic evidence. P-10 advances
only to `PARTIAL`; real reference-host execution remains M10-T04.

M03-T09 now proves complete Catalog-to-implementation parity for the deliberately narrow sign-in
reference slice: five exact official component entries and the explicitly delegated sign-in
operation. Canonical frozen metadata covers every declared prop, slot, event, command, style part,
visual state, real component export, and trusted component-side binding without carrying a module
selector, React value, or host handler. The cumulative suite passes 26 package tests, 10
compiler-negative cases, and 14 independent proof/mutation tests, including exact event and focus
schemas, native accessibility semantics, hostile DOM-prop exclusion, same-identity authoring and
production exports, public-subpath boundaries, and prerequisite drift. S-004 is `TESTED`; P-06 is
only `PARTIAL`. Generic runtime bridging, resolved style application, Desen App, and the final
immutable tuple remain later work.

M04-T01 now defines the first framework-neutral runtime integration boundary: nine exact ports and
fourteen stable callbacks for navigation, immutable Bundle/activation storage, operations,
resources, tokens, context, environment, clock, and diagnostics. The factory captures
receiver-independent callables without executing or wrapping them, rejects accessor, inherited,
extra, missing, and reflection-hostile shapes. Its task-scoped API contributes one runtime export
and thirty documented types while allowing later runtime-core exports to grow deliberately. Ten
focused package tests, nine compiler-negative cases, and ten independent proof/mutation tests
protect the exact M04-T01 source/distribution subset, platform neutrality, direct test registration,
package entry points, prerequisite integrity, and safe atomic evidence writes across eleven tracked
files. This is a reference implementation profile, not a new frozen-protocol transport.

M04-T02 now adds the bounded, read-only value resolver used by the future runtime. It takes one
immutable snapshot of `state`, `context`, `resource`, `operation`, `event`, `item`, and `env`;
keeps missing distinct from `null`, `false`, `0`, and empty text; applies fallback only when the
primary reference is missing; and never executes host callbacks or reinterprets resolved data as a
second reference. Hostile, cyclic, executable, accessor-backed, malformed, or over-budget values
fail closed without exposing a partial result. Token and string-format forms are recognized but
remain deliberately deferred to M04-T03. The task contributes three runtime exports and seventeen
types with complete TSDoc. Its evidence passes 34 package tests, 10 compiler-negative cases, 13
independent proof/mutation tests, 9 trace assignments, and 11 byte-tracked files. No Proof Matrix,
normative-coverage, or proof-gate status changes.

M04-T03 now completes the two value forms deliberately deferred by that primitive. Tokens resolve
only through one explicit host port, with one lookup per unique token in each top-level call;
missing, resolved JSON `null`, and redacted provider failure remain distinct. Formatting accepts
only the closed PF-017 `{name}` grammar: strings are inserted unchanged and every other JSON value
uses RFC 8785 canonical text, with no expression, locale, markup, or platform evaluation. Nested
reference, fallback, token, and format values preserve exact pointers, complete-result behavior,
and the same safety limits. The additive API contributes one runtime export and four types with
complete TSDoc. Its evidence passes 7 focused package tests, 7 compiler-negative cases, 13
independent proof/mutation tests, 2 direct trace assignments, and 11 byte-tracked files. Consumer
schema validation remains M05; no Proof Matrix, normative-coverage, or proof-gate status changes.

M04-T04 now evaluates the protocol's thirteen closed predicate operators over one immutable
seven-namespace snapshot and converts an optional `when` into an explicit instantiation decision.
It processes arguments left-to-right and never short-circuits a completed boolean evaluation,
preserves ordered dynamic type diagnostics, uses RFC 8785 equality and exact UTF-16 string
semantics, and keeps a direct unresolved operand distinct from a nested predicate that evaluated
false. Resolved operands are charged to one shared budget immediately, so the first terminal keeps
document order and later values cannot amplify retained copies. `exists` performs a status-only
original-reference probe, including JSON `null`, without evaluating fallback or copying a large
referenced value. At the M04-T04 checkpoint, token and format operands were deferred for M04-T05
composition. The public API adds two functions and ten types; 53 focused tests, 13 compiler-negative
cases, and 14 independent proof/mutation tests protect exact arities, the 64-predicate-node bound,
true conditional absence, platform neutrality, and eleven tracked files. P-17 remains `PARTIAL`;
no proof-gate status changes.

M04-T05 now applies base props and style first, evaluates every Variant condition in document
order, and lets each later matching Variant replace only the exact prop or style-property leaf it
declares. All sibling conditions share the same immutable snapshot and one turn-scoped token
session, while matching indexes and winning source pointers preserve ordered provenance. The
selected ValueSpecs remain raw and inert for M05 materialization and receiving-schema validation;
M04-T05 does not claim adapter delivery, CSS behavior, or child-tree mutation. Hostile,
over-budget, or incompletely materialized conditions fail closed without exposing partial maps.
The public API adds one function and nine types with ten complete TSDoc declarations. Evidence
passes 30 focused package tests, 25 compiler-negative cases, and 14 root proof/mutation tests,
including 13 artifact-independent mutation checks, two direct trace assignments, and eleven
tracked files; the cumulative runtime-core suite passes 134/134. P-17 remains `PARTIAL`, N-014
remains `PLANNED`, and no proof-gate status changes.

M04-T06 now mounts fresh surface-local state atomically, validates every initial and complete
post-write entry against its prepared Draft 2020-12 schema, and exposes values only through
immutable generation snapshots behind an opaque handle. Invalid writes return
`STATE_WRITE_INVALID` without partial state; canonical no-ops keep the exact snapshot and
generation. Explicit unsupported schema vocabularies fail closed. A separate repeat-free node
identity primitive uses the exact document/surface/node tuple, preserves compatible identities by
reference, and classifies capability changes as remounts and tuple changes as replacements.
Evidence passes 33 focused package tests, 7 compiler-negative cases, and 13 root proof/mutation
tests across 23 task-owned source and distribution files; the cumulative runtime-core suite passes
167/167. N-024 is now `TESTED`; repeat keys, action execution, reactivity, and actual adapter
instance preservation remain later work. P-17 stays `PARTIAL`, and no proof-gate status changes.

M04-T07 now materializes repeats through lexical, isolated alias scopes without duplicating the
complete runtime snapshot for every item. Items remain in source order; string and finite-number
keys use type-sensitive RFC 8785 identity, with duplicate, missing, malformed, or over-budget
inputs rejecting the whole repeated subtree without truncation or partial output. The Reference
Profile's exact 1,000-instance limit is executable. Repeated node identity composes the complete
outer-to-inner key path onto M04-T06's document/surface/node identity, preserving reorder-stable
instances while classifying key changes as replacements and capability changes as remounts.
Evidence passes 34 focused package tests, 7 compiler-negative cases, and 15 root proof/mutation
tests across 11 task-owned files; the cumulative runtime-core suite passes 201/201. N-014 and
N-041 gain executable repeat evidence but remain `PLANNED` for their other owners. P-17 stays
`PARTIAL`, and no proof-gate status changes.

M04-T08 now gives every declared resource one atomic, immutable lifecycle. `mount` and `once`
requests start from one pre-start snapshot, `manual` waits for explicit refresh, and every input
is materialized through the shared token/format resolver before exact Catalog schema validation.
Refresh accepts only the current manager-issued snapshot, so stale, foreign, and structurally
ABA-equal views fail closed. Output, public errors, adapter failures, policy denial, supersession,
and disposal remain separated without exposing hostile values or raw exceptions. Terminal
snapshot capacity is reserved before a request starts, active host transports are capped at 64,
and later work waits in a bounded replacement queue. Evidence passes 52 focused package tests,
9 compiler-negative cases, and 23 root proof/mutation tests across 11 task-owned files; the
cumulative runtime-core suite passes 253/253. N-041 gains resource-limit evidence but remains
`PLANNED`; full cross-manager snapshot provenance remains M04-T16. P-17 stays `PARTIAL`, and no
proof-gate status changes.

M04-T09 now gives every predeclared operation alias one Catalog-authoritative lifecycle. Resolved
input and successful output cross exact schema boundaries; only declared public error codes are
exposed, and host denial uses the exact core `OPERATION_DENIED` diagnostic. Accepted identities are
deterministic, omitted concurrency defaults to `reject`, replacement is validated before
newest-wins supersession, and FIFO queueing is bounded across the whole surface. Terminal
settlements publish before an opaque acknowledgement lease is issued. A settlement handler may
start the same alias as a visible staged `pending` invocation, but its host transport cannot begin
until the predecessor turn acknowledges the lease. Evidence passes 36 focused package tests, 10
compiler-negative cases, and 19 root proof/mutation tests across 11 task-owned files; the
cumulative runtime-core suite passes 289/289. N-041 gains operation queue/transport evidence but
remains `PLANNED`; action dispatch and ordered turns are now proved through M04-T13, P-17 stays
`PARTIAL`, and no proof-gate status changes.

M04-T10 now executes one guarded state or managed-surface navigation action against the exact
current M04-T06 state lifetime. The optional guard is evaluated before action-specific payload
observation; a true guard and its payload share one detached, bounded token session. Every hostile
reflection, token, diagnostic, and navigation boundary rechecks lifetime and exact state
authority. Set and toggle reuse complete-entry schema validation, toggle accepts only an exact
boolean, and unknown navigation targets fail before parameters. Host denial remains distinct from
redacted adapter failure. Successful navigation, including same-surface success, terminally
disposes the old executor and local state and leaves only a minimal tombstone. A callback-free
current-authority read remains package-internal: the package root stays at four runtime exports and
eighteen types while one runtime export and one type support trusted composition. Evidence passes
44 focused package tests, 14 compiler-negative cases, and 20 root proof/mutation tests across 16
task-owned files; the cumulative runtime-core suite passes 333/333. N-041 remains `PLANNED`;
ordered turns and settlement dispatch are now composed by M04-T11–M04-T13, full provenance remains
M04-T16, P-17 stays `PARTIAL`, and no proof-gate status changes.

M04-T11 now composes guarded `operation.invoke` and `resource.refresh` actions without blocking the
originating turn. Operation success and declared-failure handlers are selected and detached at
acceptance time, then exposed only through an immutable settlement descriptor and opaque one-shot
finalization ticket; raw lifecycle leases never enter the public API. Resource refresh preserves
the exact current lifecycle authority. False guards observe no action-specific payload, and true
guards share one bounded token session with the selected input. The package root remains four
runtime exports and sixteen types; two internal runtime exports and three internal types provide
the callback-free current compositor read and one-shot settlement finalizer. Evidence passes 89
focused package tests, 26 compiler-negative cases, and 20 root proof/mutation tests across 11
task-owned files; the cumulative runtime-core suite passes 422/422. M04-T13 now proves ordered
settlement turns and mandatory finalization; full joint provenance remains M04-T16, P-17 stays
`PARTIAL`, and no proof-gate status changes.

M04-T12 now routes Catalog-authorized component commands only to one unambiguous live runtime
instance and validates allowlisted application-shell events before emission through a separate
synchronous host bridge. Registration exposes only inert identity under opaque generation
tickets—never a DOM node, component object, ref, method table, or callback. Unknown commands and
events fail before hostile payload observation; valid command input and event payload are detached
under the same bounded resolution rules, and adapter failures remain redacted. Exact finite
registry, request, generation, reentry, disposal, and shared 4,096-node boundaries are executable.
The callback-free current registry read is part of the package root, which exposes eight runtime
exports and twenty-six types. Seven runtime exports and three types remain internal composition
helpers, including exact Catalog/port/snapshot authority reads and owner-bound, one-shot normalized
command authentication. Direct, replayed, foreign-port, and post-callback command attempts fail
closed. Evidence passes 58 focused package tests, 27 compiler-negative cases, and 21 root
proof/mutation tests across 16 task-owned files; the cumulative runtime-core suite passes 480/480.
N-031 is now `TESTED`; incoming adapter events remain M04-T14, production adapter parity remains
M05, P-17 stays `PARTIAL`, and no proof-gate status changes.

M04-T13 now composes those seven action kinds into deterministic, ordered runtime turns without
reimplementing any child action authority. Prepared programs are detached, immutable, privately
routed, and bounded before admission; reentrant turns and asynchronous operation-settlement work
share one finite FIFO. Every accepted operation settlement runs as a distinct event-free turn and
finalizes its opaque M04-T11 ticket through one ticket-keyed attempt from a `finally` path,
including controlled failure, overflow, navigation, disposal, and unexpected internal failure.
Native completion Promises always fulfill, and operation/resource Promise callbacks cannot leak an
internal throw or rejection. The 64-action, 16-settlement-depth, and 64-repeated-transition
Reference Profile limits are executable and report the stable `ACTION_LIMIT_EXCEEDED` diagnostic
without silent truncation. The package root adds five runtime exports and sixteen types with 21/21
documented declarations. Evidence passes 43 focused package tests, 11 compiler-negative cases,
and 32 root proof/mutation tests across 11 task-owned files; the cumulative runtime-core suite
passes 523/523. N-032 is now `TESTED`; N-014 and N-041 remain `PLANNED`, P-17 stays `PARTIAL`,
incoming adapter events remain M04-T14, and no proof-gate status changes.

M04-T14 now connects generic component and behavior adapters to the exact M04-T12 Catalog and
command registry without exposing framework objects. Direct, replayed, foreign-port, stale, and
reentrant command attempts fail closed; an adapter receives only the declared command and detached
input. Incoming events require an exact current opaque ticket and owner, a declared Catalog event,
and one successful payload validation before a detached selector-only request can reach the later
turn coordinator. Behavior `attachTo`, repeat identity, ABA-safe ticket generations, aggregate
scope budgets, future-unregister snapshot reservation, busy reentry fences, same-origin lower
cleanup, revocation, and terminal tombstones are executable under finite lower-only limits. The
package root adds 8 runtime exports and 27 types with all 35 public declarations documented.
Evidence passes 28 focused package tests, 11 compiler-negative cases, and 21 root proof/mutation
tests across 11 task-owned files; the cumulative runtime-core suite passes 551/551. N-033 is now
`TESTED`; N-034 remains `PLANNED`, P-17 stays `PARTIAL`, M04-T15 owns reactive protection, and
M04-T16 owns the exact selector-to-action-program join and full sign-in trace.

M04-T15 now adds one framework-neutral whole-surface reactive publication boundary over exact
current state/resource/operation generations plus complete context/environment snapshots. A
separately branded host-port wrapper adopts operation and resource settlements into native
Promises, detaches their closed envelopes before lower lifecycle managers can observe them, and
lets those managers reject an older result after hostile reflection reentry starts a newer
attempt. Reevaluation rereads all seven value namespaces, double-samples every lower authority,
batches reentrant notices through a bounded synchronous dirty-bit drain, and discards stale
candidates before and after hostile result reflection. Byte-identical output preserves the exact
observable snapshot; current failures publish an explicit inactive result rather than leaving old
output semantically active. Mount, invalidation, generation, transition, subscription, and
disposal behavior are finite, factory-authenticated, and platform-neutral. Evidence passes 54
focused package tests, 11 compiler-negative cases, and 30 root proof/mutation tests across 17
task-owned files; the cumulative runtime-core suite passes 605/605. At the T15 boundary, P-17
remained `PARTIAL`, while N-003 and P-18 stayed assigned to M04-T16. T16 now proves the same wrapped
host aggregate across every manager, the exact selector-to-action-program join, full sign-in
materialization, coordinated disposal, and a deterministic JSON trace. Indexed invalidation
optimization and React/DOM instance behavior remain explicit later work.

M04-T16 produced the initial G04 sign-in proof with a complete framework-neutral headless session
over the frozen Bundle. Unknown Bundle and Catalog inputs cross cumulative execution validation
and exact revision verification before one shared reactive host aggregate mounts state, resources,
operations, actions, adapter bridges, and reevaluation. Complete bounded materialization applies
conditional presence, repeats, tokens, formats, ordered variants, props, styles, behaviors, slots,
and stable identities without activating descendants of an absent node. T15 publishes only
canonical plan and binding commitments; an evaluation-bound private sidecar retains inert handler
selectors and exact item/repeat scope. Current T14 tickets then join one selector to one prepared
T13 program over all seven authenticated namespaces. The official trace proves edits, pending
state, declared failure, retry, stale-replacement fencing, successful navigation, independent home
materialization, coordinated disposal, and exact JSON round trips. Success/navigation,
failure/retry, and stale-replacement scenarios each run in two independent sessions, for six
sessions total; every pair and their combined trace have byte-identical canonical output. Evidence
passes 34 focused tests, 11 compiler-negative cases, 24 root proof/mutation tests, and the
cumulative 639/639 runtime-core suite.

M04-T17 recloses G04 after hardening the five broader boundaries found by the post-gate audit.
Every accepted nested operation or resource settlement now produces one bounded,
factory-authenticated internal completion notice and automatically republishes the current
headless-session observation without recognizing the sign-in operation. Public session
subscriptions are finite, revocable, reentry-safe, and callback-failure contained. Exact-location
proof checks reject moved, duplicated, nearby, or wrong-owner claims; N-026 and N-029 correctly
remain `PLANNED` for their M05 receiving boundaries while historical M02-T08 and M04-T13 through
M04-T16 artifacts remain byte-identical. Deterministic rollback and publication-failure tests join
same-tick ordering, stale replacement, finalization, disposal, and limit coverage. The focused
audit inventory passes 77/77 cases and the cumulative runtime-core suite passes 649/649. N-003
remains `TESTED`; P-17 and P-18 remain `PARTIAL`, because concrete production adapters, the M08
artifact round trip, React/DOM behavior, and future Android/iOS adapters are not yet proved.

## License

Apache License 2.0. See [LICENSE](LICENSE).
