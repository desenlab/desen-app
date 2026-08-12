# DESEN

This repository contains the Web–React reference implementation of the frozen DESEN 0.1.0
protocol, the Desen App product, and the developer tooling intended for `desen.run`.

## Implementation progress

<!-- task-progress:start -->
<!-- Source: docs/plan/TASKS.md. Update this block in the same commit whenever a task status changes. Milestone gates are tracked separately and excluded from task counts. -->

**Overall:** `███████████████░░░░░░░░░░` **85 / 145 tasks complete (59%)**

**M02 complete:** `█████████████` **13 / 13 tasks complete (100%)**

**M03 complete:** `██████████` **10 / 10 tasks complete (100%)**

**M04 complete:** `█████████████████` **17 / 17 tasks complete (100%)**

**M05 complete:** `█████████` **9 / 9 tasks complete (100%)**

**M06 complete:** `███████████` **11 / 11 tasks complete (100%)**

**M07 complete:** `███████████` **11 / 11 tasks complete (100%)**

**Proof gates:** **7 / 13 complete** · **Next infrastructure:** `I07-04` (observation `0 / 20`) · **G07:** `NOT_STARTED` until I07-04 completes

[View the detailed task board](docs/plan/TASKS.md)

<!-- task-progress:end -->

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
`sha256:e0296a7b3e3fb2a512742f7cabadee3a7131ecb1a914da012bcc2f6e0a385426`. This local Web proof does
not claim remote or native deployment,
real-browser performance, product-level restart, hostile-admin concurrent-root mutation
resistance, or an external anti-rollback anchor. P-12 remains `NOT_PROVEN` until M10-T07 and N-041
remains `PLANNED` until M12-T05.

**I07-02 infrastructure checkpoint:** the cutover froze and proved the code-owned 130-workload,
61-proof-pair plan as `REQUIRED + EXHAUSTIVE`. The historical M07-T09 successor contained 146
workloads and 69 proof pairs. The current M07-T11 successor contains 150 workloads and 71 proof
pairs: 60 ordinary pairs and 11 exclusive barriers. Its retained legacy projection expands to 479
prerequisite segments and 3,113 ordered leaf invocations covering 236 distinct leaves. Exact
shared-state classes, cancellation behavior,
tracked/untracked workspace guards, and same-revision equality with the retained sequential runner
passed locally and in hosted CI at the frozen cutover. The cutover run passed in 10
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

The exact `REQUIRED + EXHAUSTIVE` runner remains the sole pass/fail authority. I07-03 adds a
separate pull-request-only `SHADOW + AFFECTED` observation job with complete exact tracked-path
ownership. Unknown, ambiguous, untrusted, policy, dependency, frozen-input, or unsupported changes
expand to `EXHAUSTIVE`; a strict subset still executes every selected workload from fresh inputs
and cannot reuse cached proof success. The frozen I07-03 baseline selector remains pinned at
`sha256:20a78069ed829649ab9198cad68b5d7fede22dc3b6ec391ed84f5dd1f0afa86f` across the 20 sources in
its historical comparison authority; the current M07-T11 successor selector digest is
`sha256:ee0cda5b4871ce2e169a958eefd60299197dbf261c0163335cd759e814067dbf`. Promotion requires zero
false negatives, mutation coverage for every selector category, and at least 20 consecutive
eligible same-revision hosted strict-subset comparisons.
The hosted bootstrap succeeded, but the shadow correctly returned `NOT_ELIGIBLE → EXHAUSTIVE`
with `UNSUPPORTED_CHANGE_KIND`; therefore it produced no eligible strict-subset observation and
the count remains `0 / 20`. The authoritative hosted Quality gate passed. Locally, the focused
I07-03 contract suite passed 91/91 and the complete CI-infrastructure suite passed 203/203. The
full local `REQUIRED + EXHAUSTIVE` run is recorded as `BLOCKED_BY_LOCAL_SANDBOX`, because the
sandbox denied `127.0.0.1` listening with `EPERM` in two pre-existing control-plane TCP lifecycle
cases; the hosted gate proves the repository path itself passes. The pure ledger can measure the
threshold but cannot authorize promotion, so I07-04 remains `NOT_STARTED` and must additionally
authenticate the exact hosted run, job, revision, and receipt provenance. `main`, release, and
manual-audit execution stays exhaustive. The
[I07-03 baseline](docs/proof/baselines/i07-03-affected-selector-shadow.json) records the exact run
and job identifiers. Shadow-only cleanup is open as `DEBT-I07-017`, owned by I07-04 for removal by
G07; all M07 compatibility-reader entries, including the T11 successor bridge, remain assigned to
the same I07-04/G07 cleanup, and legacy retirement remains owned by I07-05. Implementation
progress is now 85/145; all 11 M07 implementation tasks are complete, while G07 remains open until
I07-04 satisfies its frozen observation and cleanup requirements.

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
pnpm verify:protocol-snapshot
pnpm check
```

`pnpm proof` and `pnpm test:e2e` deliberately return `NOT_IMPLEMENTED` until their G10 runners
exist; an absent proof runner is never treated as a successful proof.

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
