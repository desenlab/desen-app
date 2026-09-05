# Testing Strategy

## Historical archive privacy amendments

AR-01 is an operational privacy amendment, not a new product claim. Its dedicated verifier and
nine root cases authenticate four current redacted transports, recursively inspect their nested
copies, verify technical-authority digests and safe generator receipts, and preserve all 57 prior
frozen JSON artifacts plus checkpoint entries 1–70. Positive checks retain the historical App
readers' full technical projections; negatives cover transport and technical drift, mutable or
hostile inputs, same-size file changes, acquisition races, unsafe paths, artifact identity, and
atomic writes. Public artifacts contain receipts only, never decoded private prose.

Current readers accept only the redacted transports and expose actual current receipts separately
from historical hashes. A historical pin or seal never supplies cached PASS. The new proof/root
pair's semantic impact closure selects the affected App proof chain without imposing serial
cross-pair execution; every selected workload still runs fresh and must pass. The exhaustive graph
contains 218 workloads / 104 proof pairs, retaining two workers, eleven barriers, and the existing
deadline. The unchanged
CI-02 bounded baseline and fresh exact-head hosted closure remain required. Git history and old
downloads are not erased. See [AR-01 evidence](../proof/HISTORICAL-ARCHIVE-REDACTION.md).

## Test layers

1. **Protocol vectors:** Frozen official valid/invalid fixtures and exact diagnostic expectations.
2. **Unit tests:** Pure validators, resolvers, predicates, state transitions, actions, and commands.
3. **Property tests:** Determinism, canonicalization, stable identity, limits, and state-machine
   invariants.
4. **Integration tests:** Publisher pipelines, capability registration, exact package resolution,
   activation, and persistence.
5. **Component tests:** React adapters and authoring overlays without implementation leakage.
6. **Browser proof:** Desen App authors and publishes while a separately built host activates.
7. **Source audits:** No manual managed-screen tree, no forbidden imports, no executable document
   content, and no secrets.
8. **Architecture mutation fixtures:** Representative forbidden imports must be rejected by the
   named dependency rule while documented imports continue to pass.

## Evidence hierarchy

The strongest evidence is a deterministic test plus a content-addressed artifact. Manual demos are
used to explain user value and verify ergonomics, not to replace semantic tests.

## M10 browser-proof profile

M10-T01 starts the browser layer with an isolated production Vite build and package-pinned
Chromium. Its bootstrap is an admitted Source containing only the exact reference Catalog, one
surface, and its required empty Stack root. The test authors the sign-in surface exclusively
through visible App controls, uses native browser drag for both Components insertion and Layers
reorder, and proves that a forged `DataTransfer` sequence without App-owned drag intent cannot
mutate Source.

The proof saves through the public Editor Core persistence port, reads back the canonical stored
Source from a test-only isolated harness, and re-admits it through the public document validator.
Design and Run must render the same authored component order and declared `420 × 720` frame. Form
input, pending lifecycle, failure, success, navigation, publication, activation, and a real host
operation remain the explicit M10-T02–M10-T07 owners.

The hosted `Browser E2E` job runs on the exact pull-request head in parallel with `Quality gate`.
Browser installation and production-bundle startup therefore do not consume the bounded required
quality runner's critical path. Local reproduction is
`pnpm --filter @desen/app-browser-e2e test:e2e`; retries are disabled, one
worker is used, and trace, screenshot, and video are retained only on failure.

## Coverage policy

No global percentage is imposed during empty scaffolding. Before public alpha:

- every in-scope protocol branch has a positive or negative vector;
- every stable diagnostic has a test;
- every activation failure path proves last-known-good preservation; and
- every public proof claim maps to at least one automated test.

Activation persistence tests inject failure before every activation stage and at the durable
transaction boundary. They cover transaction abort, storage quota failure, crash immediately
before commit, crash immediately after commit but before in-memory notification, competing stale
writers, and restart recovery. The asserted state is always a complete activation record; tests
must never accept an active pointer whose previous-good pointer was written separately.

## Hosted CI contract

GitHub Actions uses the fail-closed single-pass gate documented in
`docs/standards/CI-QUALITY-GATE.md`. It must preserve every distinct workload in the cumulative
task commands while avoiding orchestration-level replay. Proof builders may still repeat work
internally when that repetition is itself the evidence, such as independent builds, byte
comparison, mutation, or atomic-write checks.

CI must never generate or repair tracked proof artifacts before verifying them. It must not trust
unauthenticated or incomplete changed-file inputs, cached proof success, or timing output. An
eligible affected selection requires the exact authenticated Git boundary, complete tracked-path
ownership, conservative dependency closure, and the frozen promotion receipt; uncertainty expands
exactly once to exhaustive execution. A change to the legacy prerequisite inventory or exact
execution plan requires an explicit reviewed pin update.

I07 introduces modular execution in evidence-first phases. I07-01's historical
`SHADOW + EXHAUSTIVE` candidate ran every validated workload while the sequential gate remained
authoritative. Its local and hosted results are preserved evidence, not proof of the I07-02
required-workflow cutover.

I07-02 established the scheduler-neutral 130-node, 61-proof-unit cutover inventory independently
from both schedulers. M07-T07 appended the sixth post-cutover verifier/root-test pair for durable
runtime activation; M07-T08 appended the seventh for exact restart recovery; M07-T09 appended the
eighth for its bounded boundary-fault matrix; M07-T10 appended the ninth for ordered transitions
and two-way races; and M07-T11 appended the tenth for separately built host channel consumption.
That historical M07-T11 successor contained 150 workloads, 71 proof pairs, 479 prerequisite
segments, 3,113 ordered leaf invocations, and 236 distinct leaves. M08-T01 appended the direct
editor-core Source-document proof pair plus its serial public-package contract. M08-T02 appended
the stable-ID insertion verifier/root pair behind that same serial predecessor. M08-T03 appended
the structural-edit verifier/root pair behind stable-ID insertion, M08-T04 appended the
content-edit pair behind both frozen edit prerequisites, M08-T05 appended the state/binding pair
behind stable-ID insertion plus current content-edit compatibility, M08-T06 appended the
event/action pair behind its sole formal M08-T05 prerequisite, M08-T07 appended the
authoring-round-trip pair behind M08-T06, M08-T08 appended the platform-neutral persistence
port plus explicit loopback Web adapter behind M07-T05, M08-T01, and M08-T07, M08-T09 appended
continuous validation with exact formal impact parents M08-T03 through M08-T07, and M08-T10
appends terminal integration behind every M08-T01–T09 proof plus the frozen
`runtime-core-headless-sign-in` and `runtime-core-audit-hardening` platform proofs. The historical
M08-T05 successor
contained 161 workloads, 76 proof pairs, 529 prerequisite segments, 3,293 ordered leaf invocations,
and 254 distinct leaves. Its neutral inventory, impact graph, and required plan were
`sha256:ae790f14c376a1fb449e34877a08abba164677ef413583248e5f609f3c7bb292`,
`sha256:9fb786d80ac21bef4dc89c9a77986f91dd50c9ff53dd2d54c7a52d5c4ac8738f`, and
`sha256:9f7ef05e606afb293b42c650acfcf043d638cd429e07fdee55d01d241f06bf1b`; its affected ownership
covered 1,071 paths at `sha256:ae070076003f9ae641a6682aab6280336b7d2ccf6ccd6b96d15b3c10c6cd6c18`, including 152
proof-owned paths, with projection
`sha256:d793913bca281e2127151c83ce570ce415c995da42013226731d030b337fc2c0`.

The historical M08-T07 successor contained 165 workloads and 78 proof pairs. Its retained plan,
neutral inventory, impact graph, workload set, ordered projection, required plan, and shadow plan
were respectively
`sha256:c6cf645412661a81e2976e88080d23d6fe0fa4889ef4b07432e4a47de684e25d`,
`sha256:8220259aa2a44774d192ea2420f4c2f8423c9dedd93a1fcf9b34340a0ab0dcd3`,
`sha256:5aa20b4fb87decc51221bca5a900677d7dfddd1e61c068d5e91420253a3236b2`,
`sha256:9ea3b95ab6f034473765beb9edb1482532bb1a0b4e05f630c403d38d8df0daef`,
`sha256:fc588358d8fa3b2e7c2cd9f3a280715d7db34089a41a2fae2c3484d18c040278`,
`sha256:5484324b6d22a5e58bce2431f35382aeeb4e97095c96524e5bdb6211f8650a9e`, and
`sha256:4beeca9ed27e2e7942951cf0cf014fb7bebca2bcf2f8f69ff0819580aeff3c87`.
Its 1,088-path ownership set, 156-proof-path projection, selector, required runner, and 15-script
workspace inventory were
`sha256:227cb892270c669646eec89a44243af8e3da5a51bfec8f8e560e2d765c0f2e79`,
`sha256:d43335b91aa9f3da0571ed2e32e92ea65da81bbcc5efee1aa32bdac30967217d`,
`sha256:cbd1cce71828ad4ad1c22ede5e6152e5e3130031afebcb1d9c23e32ba55eb7dc`,
`sha256:9da49a38efa09a48ded3290ba9c2ec4ae57a967d325e61320f39be561b93f9a4`, and
`sha256:0faa6116c99d11f6d059a224de6b08a723657b5c5690a3138e6290d240524820`.
Those pins remain historical local authority and make no hosted M08-T07 claim.

The historical M08-T10 successor contains 172 workloads and 81 proof pairs without rewriting the
frozen cutover. The historical M09-T01 successor contains 174 workloads and 82 proof pairs. Its
retained quality plan is
`sha256:daee065ac1caf04715b728191cbae6cc8b64783f4633b8c583797883712df3da`; the neutral inventory,
selector-only impact graph, exact workload set, and ordered equivalence projection are respectively
`sha256:d4f4493585c1a62a25e01917946bb3d562c3da43ac4ca77a571a00cfebe49859`,
`sha256:f3b3f8532709f17addf3895357e8e6d5a96b8a149c2aa60cde731f733e58c639`,
`sha256:26622bafd541e95c5cdfd9ef851a234053563ff79fe7941f3394f68727ca2c3d`, and
`sha256:7b2ecea1e6b7c40f93a4b2a45410b089116c3c65419e00ed0f32e1d5e58c1703`. Required and shadow plans
are `sha256:cfe691545a5c122e0afb81fe06abcb7c4abdb26d8c3ea35a5c8dfc787769c4aa` and
`sha256:f5cb39741015bf730f1d36656a057bad691c226870a6105a3f04911ecbc5bb32`.
Its legacy projection contains 601 prerequisite segments, 4,369 ordered leaf invocations, and 278
distinct leaves, pinned respectively at
`sha256:99cd8deb90ca33e409f7c94099c20a561310353b7c9242115fd001aff0c524e5`,
`sha256:f5ec4def7813e640bf0162cabb6614fc1f138fa4127b588285caf2a0dbdd6479`, and
`sha256:b1ed3947955c9309a854296504a8141f805c3a7a63a392a89e427bc992f52e60`.

The historical M09-T02 successor contains 176 workloads and 83 proof pairs. Its retained quality
plan, neutral inventory, selector-only impact graph, workload set, and ordered equivalence
projection are
`sha256:5ef9b46e949c9be14698a57fb5c8a520b04129269b7ca031c720ddaedb464d42`,
`sha256:05df088b3aab34277c60d7cff8f8814b1b8d82e2b4d92170a0c7bf1e34a9365a`,
`sha256:132ee4ef584a3526da0db1d72a39584f5201b1df402e59cec03a2d09d0661a19`,
`sha256:35fbceaf904c8df644fa134a237d41ca0b7c119b43a471e8d067484b3389eef2`, and
`sha256:1d3a522addbb63f8143b73ac726c1960bfa785decc7ef72052de6b98e26fc10c`. Required and shadow
plans are `sha256:8bd3fdc547326cafb23fa61db6dea329b6841742992198c8fa02d70d3a119987` and
`sha256:aa7f46afdb5e67cd315597cadcf0f16b18e070621c198ff89dfa7f06646b18c3`. Its legacy projection
contains 611 prerequisite segments, 4,381 ordered leaf invocations, and 281 distinct leaves, pinned
at `sha256:3edb7d750b1c9bee5b081e46e887c9e9e90ec1bf989aff5745fd0e4dbab492f1`,
`sha256:a8db91b1306dcffdb52eedcb47dcf7d8fa1f60457d0b36ee5af44a0dfa743dec`, and
`sha256:cf36b706947b4fcb4fa60759dc118c3b07faabea84a36ee1c69e10996441294e`.

The historical M09-T03 successor contains 178 workloads and 84 proof pairs. Its retained quality plan,
neutral inventory, selector-only impact graph, workload set, and ordered equivalence projection are
`sha256:264117dbe5e03165997673e2065b459d9e383c66d145431c95feee70e90e372d`,
`sha256:0fdfb9646319a82d8f1a9c73d0533967a98ccb56a3a0df77790d97aaf9f921d1`,
`sha256:2a00d10d248229bbdf0b72f67ee1c4b600fcfa9062b7f45ae1ee41b841937562`,
`sha256:2636e037e8c0b491a4efc49e965a6700bfcfa18e8a8ae904afeb74ff2de219e2`, and
`sha256:f9877607e922699aef358bf2b5fb33b1ecf8bd9f6ef205681b2ec5fb023c7259`. Required and shadow
plans are `sha256:ef2b2dcec3721dbeab30a50a04b02d08b853e07a3f01b5acd793674910cd473f` and
`sha256:1d6faf4a1ab8299e9e400b1588859e9c33c9d1f7e2aea959a44dd50144dce347`. Its legacy projection
contains 621 prerequisite segments, 4,393 ordered leaf invocations, and 284 distinct leaves, pinned
at `sha256:8e1f08ea689d33520b7dd905bc124a3dcb842abf5e40873da254013d9fb2ccbd`,
`sha256:bcb1a99cd6832975955719a794c8c44a154d97f3e784ce9a5775502bfba210e2`, and
`sha256:b5a85ab89e327e828b8ebb5aa2c85b008596eae5e4bfa284d255548de76a53af`.

The historical M09-T04 successor contains 180 workloads and 85 proof pairs. Its retained plan, neutral
inventory, selector-only impact graph, workload set, and ordered equivalence projection are
`sha256:4bb72f5ae537acb91d9778c166f231e406713678ba604183ee925f81a63cb994`,
`sha256:190ed57daddb635c67ebccbb3ff1598398ddc0c909d8c4d6bfce8feae08351cb`,
`sha256:0128377a95a06370aefe85bfcf55f85418ed94463e306c6f447efc5f2a2489c0`,
`sha256:c493f57d227e2138647d5351a8dc5a1735f717321c63f21db2a5017bcc191356`, and
`sha256:7d8fde20bc99befe6b45e1c57db3c4b86fd04a247e59a8e4e10c1c5f54a9594c`. Required and shadow
plans are `sha256:87501744a832912cff725d4fe51cc76ddbcef36e1ddc298deefa3761f1f91399` and
`sha256:93e27cded6c818883560fffb2bdd7ae86c8b33379a27660ce4f994aac8e6f77f`. Its legacy projection
contains 629 prerequisite segments, 4,403 ordered leaf invocations, and 287 distinct leaves, pinned
at `sha256:f0e4f63cbc05222ba64d407206d3c492586b3870f368c28f611af03d1f67e374`,
`sha256:6460c20463ae01924f574a9c01e1515a1446b853bc9cc91205283ce90b715d42`, and
`sha256:b9047beffe348a9bd93d8d089b93b054298a17602e491be8b0c1f837d2930a1b`.

The historical M09-T05 successor contains 182 workloads and 86 proof pairs. Its retained plan,
neutral inventory, workload set, ordered equivalence projection, and selector-only impact graph are
`sha256:fd764f4e7384a144ccc8d967f9db1363a4150484cf0bae37f6186a4d23daeac7`,
`sha256:d1c1e447dd567ab08e3238eb13fcd45823f2c8e832e6c81ddf201187413f0f71`,
`sha256:35d2046f6997be32a53dfaabd492a14b4d88fbc884cceea28c0ae8dd7fb78e1f`,
`sha256:dd51fc4a5398d612be17d1d90a2bb09aa9036155f5ce8941f3c5e5ce879cb0f7`, and
`sha256:bb20c549f9e61e88384f4d516c8f76225c3c99c7ba7e3d5f24344689b46e0e05`.
Required and shadow plans are
`sha256:ea5c889148f74c40ce6f5450de646f9d69c572142de674752919fc22351bf25d` and
`sha256:31bc4046f7d3344c5e5d85d74d782b993df948cf676cdafef53ba6757ccc936e`. Its legacy projection
contains 641 prerequisite segments, 4,417 ordered leaf invocations, and 290 distinct leaves,
pinned at `sha256:6246c4865e28a737e5990a7204dedaad6cae3e6c989a70a6cd496c84c29d0764`,
`sha256:de50c6186438de2dbd56083de01bc7f39f6492c1d02806a8fc239e6a4edc341d`, and
`sha256:0dfd1eb4210839d739572a943f421026ca40aecc4f285832148f66d242f9970c`.

The historical M09-T06 and M09-T07 successors contain 184 workloads/87 proof pairs and 186
workloads/88 proof pairs respectively. The historical M09-T08 and M09-T09 successors contain 188
workloads/89 proof pairs and 190 workloads/90 proof pairs respectively. The historical M09-T10
successor contains 192 workloads and 91 proof pairs, split into 80 ordinary pairs and 11 barriers.
Its three formal impact parents are `desen-app-real-adapter-canvas`,
`desen-app-state-binding-editor`, and `desen-app-event-action-editor`; the connected closure
contains 58 proof units and 126 workloads. M09-T08's three formal impact parents were
`desen-app-schema-inspector`, `editor-core-state-binding-edits`, and
`desen-app-named-slot-authoring`; the connected closure contains 56 proof units and 122 workloads.
Exact plan, inventory, selector, runner, ownership, and checkpoint digests remain machine-verified
CI authorities rather than values inferred from these counts.

The historical M09-T11 successor contains 194 workloads and 92 proof pairs, split into 81 ordinary
pairs and 11 barriers. Its three formal impact parents are `desen-app-design-run-modes`,
`reference-sign-in-fixtures-and-host-binding`, and `reference-catalog-web-parity`; the connected
closure contains 59 proof units and 128 workloads. Exact plan, inventory, selector, runner,
ownership, and checkpoint digests remain code-owned authorities rather than values inferred from
these counts. The neutral inventory, workload set, and impact graph are
`sha256:82b41b49abfd3b97f695af068e66168374ad2e994c7100b4442d06984032c7fc`,
`sha256:4a33777d8bb5cf515137b6539eaefab36229c5c345848bbc6be1d7a55b132acf`, and
`sha256:d028537891400c806dff4f7a4d7be3b3e783381369052b7d8079fdfd10759b73`; the exact T11 closure
is `sha256:e0e1843e59db8002aa31ec0e6c2d6c435744d3c6985612373074e0b41312ded1`.
Append-only proof-reader sequence 50 advances
`sha256:45ed64e604400f18b15b3b4ef44bc35634a6c1567b46174329ec36529168272e` to
`sha256:6abea41064a05efe363df0f66d1e7d1b4923af08f819acf4c266b092985192a4` across 46 artifacts and
92 readers. The independently promoted selector and runner authorities are
`sha256:b97d10bd27576ed5fc543dfd94fe7981cf2cf7bc2159aa6d431e2100312a6819` and
`sha256:a9e640b59786e2ee8f16c7bbd1f14be895d1ec71050f25a8fca6ffbe85104d6e`.

The current M09-T12 successor contains 196 workloads and 93 proof pairs, split into 82 ordinary
pairs and 11 barriers. Its exact formal impact parents are `desen-app-shell-navigation`,
`editor-core-persistence`, and `desen-app-fixtures-scenarios-fidelity`; the connected closure
contains 60 proof units and 130 workloads. The neutral inventory and impact graph are pinned at
`sha256:c1d3eb2b4b56e9a97d700f89ac0c0ff9c24bf158c3d18bd8e3d40c9c52b63eb7` and
`sha256:97099a5cb52895eb80d095e99bf18838688d8a0aecf7af49993f0077466558c5`. These code-owned
authorities, not totals inferred from prose, define the reviewed workload graph.
The CI contract, 715-segment prerequisite inventory, 4,505-entry ordered leaf inventory,
311-entry distinct leaf inventory, retained plan, workload-id set, ordered equivalence, exact T12
closure, required plan, and shadow plan are respectively pinned at
`sha256:92bcdb9435a1cb6492c20e5ad82013ac7d65479a15a5f5b5321b8e59351f6014`,
`sha256:2e1232681017a4e580acea5c523c07ee766175b8b1097c7a865ada56a3310a35`,
`sha256:cd11dc7cfac0fcb117572d2cd6a239fa20f3d31b3c1c8ca22f4dc34439aadc0d`,
`sha256:f90a95cc791a26eb2170f3af27da743223d1458663dfcf3a2f657988cd7db278`,
`sha256:0cf877430268ce6b4518999361d4867bc69dbffd81637f3935100793b7cf6fa2`,
`sha256:ae68e7156d0fcd08ed61ec5820261e175211db3944b496379fdbe5746a759b0e`,
`sha256:8799636c57969e7afebb65ce702dae6f08d9334e6f0a204a15d500b26358ad63`,
`sha256:bc7ef479fb426e6a61d6589c27dd5b3bcb4ff4593e0810f4f01be110650ad0f2`,
`sha256:b67aee6813b36d63dcdfe8c7d2fd9d6b4ee398cce6773b8f9336a03f324e03bb`, and
`sha256:230b004ecbd81c0be68456c4ad15326b8473177cf927f5dc330fdc8fdf7c152c`.
Append-only proof-reader sequence 51 advances exact sequence-50 predecessor
`sha256:6abea41064a05efe363df0f66d1e7d1b4923af08f819acf4c266b092985192a4` to
`sha256:42e88946b598566a46237af8d30587fa765d9d58807e864464fc5525fbc64921` across 47 frozen
artifacts and 94 current readers. The promoted selector and independent required-runner authorities
are pinned at `sha256:ff4cdbac5be5b545843ca1aaf9842630e41e4f96e3cfccfa67d10e62436f93c6` and
`sha256:727e48f526547f6630d369b53b52da511bb1fb61389bbca1c36a757ad018bf93`.
The exact current Design/Run affected-selection plan is independently pinned at
`sha256:a59b853be95d7c834821d48786c8d3579552cb0eaebc571232cc06b43f4a9f4a`.
The 51-checkpoint manifest reseals changed reader indexes 70–93. Its appended T12 proof library and
root reader are exactly 56,014 bytes at
`sha256:18c759c87011e4ed30b044eaa02b9ccf2cc9e4134c33f7cfd0f292070ffc5add` and 23,578 bytes at
`sha256:baee083f499523e8d5ea47b322f2d1c162097c27b95897946e72dcb25e99f033`.

The historical M08-T10 affected ownership covers 1,119 tracked paths at
`sha256:4755d3f896dc904ea8572bbd84329916000daef09455a9927239e11eab0427a1`, including 162
proof-owned paths; the complete ownership projection is
`sha256:b6e842d5cbaa89af877e4c4e75ee7551160d617385395961d8efe6d49a67a341`. Its selector and
required-runner authorities were
`sha256:8dc47b6160cbe8e27fc66b2462f27582385a196f2cb839c7184a86562040aafb` and
`sha256:14ac4cf625e2dcbe1a209a178027015de78ad07d2db5022dce381f0ffdc93514`; the authenticated
promotion artifact is
`sha256:76a29908843c0bb9a4ca5ad74b5bc94383c3fa21463ce81e98bf53e8f01d7549`. M09-T01 contains
164 proof-owned reader paths. Its 1,140-path set is
`sha256:1d338215b607f3ded5500bd3e382eb6fc685b5dcb9c52d09210d656ed05d6393`, the ownership projection
is `sha256:838aff55123559e2a5db0cbd938f625bcdaa41c5b7eaa5f688592212833622a4`, the selector is
`sha256:c150610d858c8b47f54546c5ebcd004ea4f7c2ce213cdceeff884d889a463223`, and the runner is
`sha256:64379bb92a3a439dbfcf0baf0df2f45a2bd42ccc083450b81cb298bbb3b8e0a7`. The historical M09-T02
authority contains 166 proof-owned paths. Its 1,148-path set is
`sha256:25c23bb06ab9ef11157fa5c058d9fb87866c1adbe08a424855bdc532e51cff8d`, its ownership projection
is `sha256:f806120b86e4cd07fbf4385c86eccb91c686001be3bf8fe2abb8b704fff380a1`, its selector is
`sha256:3e26c1d403404b08830185a3d55d991766188a631b5e00643c23c962439dcaa2`, and its runner is
`sha256:0665acc181249d9d522b79fb1b3a611d88a1be390ace94a1b04e9fd02cf9ad52`. The historical M09-T03
authority contains 168 proof-owned paths. Its 1,156-path set is
`sha256:34be405a152c65ff1e6a7a60a7a582922c15798c26554f37a5bd5f635edc3013`, and its ownership
projection is `sha256:20a323638ad015d4977ef8be127b01288cfc9e67e5ea48fe6076179e421ef87a`.
Its selector and runner authorities are
`sha256:0a4268f0c25cf04de9ecf60f0990c5e2310c30410a8841f96ae4592f9cbad2b6` and
`sha256:299512c107ccef514c76843525cab4ab46f1755c4e6ea5ad193cec8f7d9c866d`. Its ownership-category
counts are `168 / 45 / 31 / 128 / 448 / 205 / 120 / 11`. The historical M09-T04 authority contains
170 proof-owned paths. Its 1,164-path set is
`sha256:ef8b1098d5de27c4a97bdb9c07e5e0557df9519fc0e6876a99df21b78072342e`, and its ownership
projection is `sha256:2b238c2b8b00a74109fafd683f0acd66e5c0123407c95cd8fb999a25dd3fb7ae`.
Its selector and runner authorities are
`sha256:474051960bdeeefb3813cc223ad524062411e9a2ccb464b63847f53a4ba13f4f` and
`sha256:3bdd01905c47bcfbf441d5c273c8c428e90fcb6fe5d39052fda6c4312e8972ce`. Its ownership-category
counts are `170 / 45 / 31 / 129 / 450 / 207 / 121 / 11`. The historical M09-T05 authority contains
172 proof-owned paths. Its 1,175-path set is
`sha256:361ce76e9d9b7480e2bb9ea7c2b889848ab81c89db6b13d298923dde49e68146`, and its ownership
projection is `sha256:d708c590da4a00e36c5f7a96e0e807bc60421aa4561482b6dd73a29bd43f90a2`.
Its selector authority is
`sha256:afc59adf27f4cddf07684f6ac0ef16550c42cdef9002aeb87c9892f5235639ed`; required-runner
authority is independently pinned as
`sha256:9238940f7926a80d40d012208cec63de9fb917e54e604b6b579811f159c8e585` and is not inferred
from selector success. Its ownership-category counts are
`172 / 45 / 31 / 130 / 455 / 209 / 122 / 11`. The historical M09-T06 authority contains 174
proof-owned paths across 1,184 tracked paths. Its ownership-category counts are
`174 / 45 / 31 / 131 / 458 / 211 / 123 / 11`. The historical M09-T07 authority contains 176
proof-owned paths across 1,192 tracked paths. Its ownership-category counts are
`176 / 45 / 31 / 132 / 460 / 213 / 124 / 11`. The historical M09-T08 and M09-T09 authorities
contain 178 proof-owned paths across 1,202 tracked paths and 180 proof-owned paths across 1,212
tracked paths respectively. The historical M09-T10 authority contains 182 proof-owned paths across
1,218 tracked paths. Its exact ownership-category projection is
`182 / 45 / 31 / 135 / 468 / 219 / 127 / 11` for proof unit, CI policy, dependency policy, frozen
input, package/application, shared proof infrastructure, project documentation, and repository
policy respectively. The historical M09-T11 authority contains 184 proof-owned paths across 1,232
tracked paths. Its path-set and ownership-projection digests are
`sha256:3d77bb0de542b1d153deb9fb87f2ba5adbc45e2153d9b156074026b04a755fff` and
`sha256:86e1d1555580e1496686f11858c1bd4b69ce7b0f84a429b930ee9dc1c0f1f153`; exact category counts
are `184 / 45 / 31 / 136 / 476 / 221 / 128 / 11` in the same order.
The current M09-T12 authority contains 186 proof-owned paths across 1,243 tracked paths. Its
path-set and ownership-projection digests are
`sha256:f216ba32517fd708d24b9d78035894e20951f5cd420d419a66e5ce0b813881c5` and
`sha256:6511d79ff42cb84dd303f771b821a061cd89c72462dddf2ccd3966397c602983`; exact category counts
are `186 / 45 / 31 / 137 / 481 / 223 / 129 / 11` for proof unit, CI policy, dependency policy,
frozen input, package/application, shared proof infrastructure, project documentation, and
repository policy.
The 16 reviewed
workspace test scripts are pinned by
`sha256:4d7c4232cc0e31519f2f58e9ebeb355405e493594406aee99ed2a78ce0c796ab`. Contract and
hostile-input tests cover exact
ordered ids, labels, commands, arguments,
dependencies, execution classes, and shared-state records; omission, duplication, reorder,
substitution, cycles, unknown classes, shell syntax, writer insertion, and affected-only metadata
must fail closed. A separate rollback-only adapter proves exact equality with the retained
sequential plan and rejects PASS receipts containing missing, duplicated, skipped, not-run,
cancelled, timed-out, failed, or unclosed work.

Shared-state mutation tests cover all seven live exact classes and counts: 6 `GLOBAL_EXCLUSIVE`, 3
`WORKSPACE_OUTPUT_EXCLUSIVE`, 1 `PACKAGE_TEST_EXCLUSIVE`, 77 `PROOF_READ_ONLY`, 92
`PROOF_OS_TEMP_ISOLATED`, 10 `PROOF_TRACKED_ALIAS_EXCLUSIVE`, and 1
`PROOF_WORKSPACE_TEMP_EXCLUSIVE`. They prove that 79 proof pairs are eligible for pair-level overlap
at concurrency two and that the ten tracked-alias pairs plus `reference-host-web-source-audit`
always drain the scheduler as eleven exclusive proof-pair barriers.
The normalized topology is eight serial prefix workloads, 79 ordinary proof pairs, eleven
exclusive proof-pair barriers, and two serial suffix workloads: `8 + (79 * 2) + (11 * 2) + 2 =
190`.

The M07-T04 `control-plane-reference-preflight` verifier is an ordinary `PROOF_READ_ONLY` step.
Its root mutation test is `PROOF_OS_TEMP_ISOLATED`: it may write only inside its runner-owned temp
root, receives no workspace-write, port, native-addon, or verifier runtime-probe authority, and
does not introduce a scheduler barrier.

The M07-T05 `control-plane-local-api` verifier and root mutation test are ordinary
`PROOF_OS_TEMP_ISOLATED` steps. Each may use only its runner-owned temp root. The verifier receives
the exact `VERIFIER_RUNTIME_PROBE` child-process policy, while the root receives only the ordinary
`NODE_TEST_HARNESS` policy. Neither receives workspace-write or port authority, and neither
introduces a barrier. Only those two exact workloads receive the native-addon authority required
by the reviewed SQLite binding.

The M07-T06 `control-plane-runtime-staging` verifier is an ordinary `PROOF_READ_ONLY` step. Its root
proof/mutation test is `PROOF_OS_TEMP_ISOLATED`, receives only the ordinary `NODE_TEST_HARNESS`
child policy, and introduces no scheduler barrier. Neither workload receives workspace-write,
port, native-addon, or verifier runtime-probe authority.

The M07-T07 `control-plane-runtime-activation` verifier and root are ordinary
`PROOF_OS_TEMP_ISOLATED` steps. The verifier receives the exact `VERIFIER_RUNTIME_PROBE` child
policy and the root receives only `NODE_TEST_HARNESS`; both receive the narrow
`CONTROL_PLANE_RUNTIME_ACTIVATION_SQLITE` native-addon policy. Neither receives workspace-write or
port authority, and the pair introduces no scheduler barrier.

The M07-T08 `control-plane-runtime-recovery` verifier and root are ordinary
`PROOF_OS_TEMP_ISOLATED` steps. The verifier receives the exact `VERIFIER_RUNTIME_PROBE` child
policy and the root receives only `NODE_TEST_HARNESS`; both receive the separate narrow
`CONTROL_PLANE_RUNTIME_RECOVERY_SQLITE` native-addon policy. Neither receives workspace-write or
port authority, and the pair introduces no scheduler barrier.

The M07-T09 `control-plane-runtime-fault-injection` verifier and root are ordinary
`PROOF_OS_TEMP_ISOLATED` steps. The verifier receives the bounded `VERIFIER_RUNTIME_PROBE` child
policy and the root receives only `NODE_TEST_HARNESS`; both receive the task-specific
`CONTROL_PLANE_RUNTIME_FAULT_INJECTION_SQLITE` native-addon policy. Neither receives
workspace-write or port authority, and the pair introduces no scheduler barrier.

The M07-T10 `control-plane-runtime-transition-races` verifier and root are ordinary
`PROOF_OS_TEMP_ISOLATED` steps. The verifier receives the bounded `VERIFIER_RUNTIME_PROBE` child
policy plus the separate task-specific `CONTROL_PLANE_RUNTIME_TRANSITION_RACES_SQLITE`
native-addon policy. The root receives only `NODE_TEST_HARNESS` and no native-addon authority
because it injects the authenticated runtime-suite receipt. Neither receives workspace-write or
port authority, and the pair introduces no scheduler barrier.

The M07-T11 `reference-host-web-channel-consumption` verifier and root are ordinary
`PROOF_OS_TEMP_ISOLATED` steps. Both use runner-owned OS-temp roots and receive only the bounded
child/runtime and native SQLite policies assigned by the code-owned authority. Neither receives a
shared workspace-write or fixed/shared listener-port grant from the scheduler, and the pair
introduces no barrier. Its verifier alone owns the code-registered
`desen.ci.loopback-child-listener-authority.v1` child-network profile. The verifier parent
stays listener-denied; a runner-created mode-`0600`, singly linked authority plus random token is
delegated only to its Vitest process tree through the unchanged guarded `NODE_OPTIONS`. That tree
may bind only TCP on literal IPv4 `127.0.0.1` with requested port `0` and connect only to a port it
opened. UDP, DNS, hostnames, IPv6, public addresses, Unix sockets, and fixed ports remain denied.
Hosted CI is required for the real loopback-listener cases because the local sandbox returns
`EPERM` on `127.0.0.1` bind.

The M08-T01 `editor-core-source-document` verifier and independent root mutation test are ordinary
`PROOF_OS_TEMP_ISOLATED` steps after the semantic `protocol-structural-validation` predecessor.
Each writes only inside its separate runner-owned OS temp root. Neither receives workspace-write,
port, or native-addon authority. The verifier receives no child-runtime-probe grant, while the root
receives only the ordinary `NODE_TEST_HARNESS` policy.
The separate serial `editor-core-public-package-contract` prefix owns the repeated `dist` write and
runs the exact package export-map, compiler, and emitted-runtime contract before the verifier.

The M08-T02 `editor-core-stable-id-insert`, M08-T03 `editor-core-structural-edits`, M08-T04
`editor-core-content-edits`, M08-T05 `editor-core-state-binding-edits`, M08-T06
`editor-core-event-action-edits`, and M08-T07 `editor-core-authoring-round-trip` verifier/root pairs
are ordinary and non-barrier. Each follows the
same serial public-package contract. Structural edits also follow stable-ID insertion; content edits
follow both frozen edit prerequisites; state and binding edits follow stable-ID insertion plus
current content-edit compatibility; event/action edits follow the sole formal M08-T05 prerequisite;
authoring round-trip follows M08-T06 and independently reauthenticates all six prior editor artifacts.
All twelve workloads are `PROOF_OS_TEMP_ISOLATED` with separate runner-owned roots and
verifier-before-root ordering.
No pair receives workspace-write, port, native-addon, or verifier runtime-probe authority; only
each root receives the ordinary `NODE_TEST_HARNESS` child policy.

The M08-T08 `editor-core-persistence` verifier/root pair is ordinary and non-barrier. Both
workloads are `PROOF_OS_TEMP_ISOLATED`, follow the new serial
`editor-web-public-package-contract` prefix, retain verifier-before-root ordering, and receive the
narrow `EDITOR_CORE_PERSISTENCE_SQLITE` native-addon policy. The verifier receives no child-runtime
probe; the root receives only the ordinary `NODE_TEST_HARNESS` child policy. Neither receives a
shared workspace-write or listener-port grant. The proof uses an explicit fetch-shaped loopback
adapter over Fastify injection, opens no network listener, and exercises the real M07-T05 local
Source route and native SQLite store through the platform-neutral editor-core persistence port.

The M08-T09 `editor-core-continuous-validation` verifier/root pair is ordinary and non-barrier.
Both workloads are `PROOF_OS_TEMP_ISOLATED`, follow the editor-core public-package contract, and
retain verifier-before-root ordering. Its exact formal impact parents are M08-T03 through M08-T07;
M08-T08 persistence remains a sibling rather than a direct parent. Neither workload receives
workspace-write, listener-port, native-addon, filesystem-compatibility, or verifier runtime-probe
authority; only the root receives the ordinary `NODE_TEST_HARNESS` child policy.

The M08-T10 `editor-core-terminal-integration` verifier/root pair is ordinary and non-barrier.
Both workloads are `PROOF_OS_TEMP_ISOLATED`, follow the editor-core public-package contract, retain
verifier-before-root ordering, and close over every formal M08-T01–T09 proof parent plus the frozen
M04 `runtime-core-headless-sign-in` and `runtime-core-audit-hardening` proofs required by P-18.
Neither workload receives workspace-write, listener-port, native-addon,
filesystem-compatibility, or verifier runtime-probe authority; only the root receives the ordinary
`NODE_TEST_HARNESS` child policy. This conservative graph affects proof scheduling only and does not
widen editor-core production authority.

The M09-T01 `desen-app-shell-navigation` verifier/root pair is ordinary and non-barrier behind the
exact M08-T10 terminal-integration proof. The verifier is `PROOF_READ_ONLY`; the root is
`PROOF_OS_TEMP_ISOLATED` and receives only `NODE_TEST_HARNESS`. Neither receives workspace-write,
listener-port, native-addon, filesystem-compatibility, or verifier runtime-probe authority. The
focused application inventory separates 30 navigation cases, ten application cases, and three
lifecycle cases. The observed application build, typecheck, and lint pass, and those focused cases
pass 43/43. Root proof, reader-checkpoint, required-gate, and hosted results remain separate
authorities and are not inferred from the focused receipt.

The M09-T02 `desen-app-catalog-panel-layer-tree` verifier/root pair is ordinary and non-barrier. Its
formal impact parents are exactly `desen-app-shell-navigation` and
`reference-catalog-web-capability-artifact`, producing a 66-workload affected closure. The verifier
is `PROOF_READ_ONLY`; the root is `PROOF_OS_TEMP_ISOLATED` and receives only `NODE_TEST_HARNESS`.
The local root wrappers call both predecessor artifact verifiers directly so developer commands do
not recursively replay their prerequisite chains. The focused authoring suite passes 18/18 and the
independent root proof passes 8/8; required-gate and hosted outcomes remain separate authorities.

The M09-T03 `desen-app-real-adapter-canvas` verifier/root pair is ordinary and non-barrier. Its
formal impact parents are exactly `desen-app-shell-navigation` and
`reference-host-web-source-audit`; M09-T02 remains a compatible sibling rather than a direct
parent. At its T03 checkpoint this produced a 51-proof-unit, 112-workload affected closure pinned at
`sha256:10e111f92714a9ecb65a7430300b312fd9d14f47605d0c07979c23e55fa43608`. Both workloads are
`PROOF_OS_TEMP_ISOLATED`. The verifier receives `VERIFIER_RUNTIME_PROBE`; the root receives only
`NODE_TEST_HARNESS`. Both receive the exact `DESEN_APP_REAL_ADAPTER_CANVAS_VITE` native-addon
policy because their reviewed Vite build path loads its locked native tooling. Neither receives
workspace-write, listener-port, or filesystem-compatibility authority. The local wrappers verify
the two direct predecessor artifacts without recursively replaying their prerequisite chains.

The M09-T04 `desen-app-selection-overlay` verifier/root pair is ordinary and non-barrier. Its sole
formal impact parent is `desen-app-real-adapter-canvas`; its T04 connected closure contains 52
proof units and 114 workloads and is pinned at
`sha256:bc441ea24854f3842089c0e101defca3b807236c7e6fc531801d4d42b8a0d4fb`. The verifier is
`PROOF_READ_ONLY`; the root is `PROOF_OS_TEMP_ISOLATED` and receives only `NODE_TEST_HARNESS`.
Neither receives workspace-write, listener-port, native-addon, filesystem-compatibility, or
verifier runtime-probe authority. The focused App selection suite passes 27/27 and the independent
root proof passes 10/10; required-gate and hosted outcomes remain separate authorities.

The M09-T05 `desen-app-schema-inspector` verifier/root pair is ordinary and non-barrier. Its exact
formal impact parents are `desen-app-catalog-panel-layer-tree`, `desen-app-selection-overlay`, and
`publisher-official-golden`; the connected closure contains 53 proof units and 116 workloads. The
verifier is `PROOF_READ_ONLY`; the root is `PROOF_OS_TEMP_ISOLATED` and receives only
`NODE_TEST_HARNESS`. Neither receives workspace-write, listener-port, native-addon,
filesystem-compatibility, or verifier runtime-probe authority. The task wrapper verifies all three
direct predecessor artifacts before App build, typecheck, the 41-case focused Inspector suite,
artifact verification, and the independent 10-case root proof. Required-gate and hosted outcomes
remain separate authorities.

The M09-T06 `desen-app-structured-inspector` verifier/root pair is ordinary and non-barrier. Its
sole formal impact parent is `desen-app-schema-inspector`; the connected closure contains 54 proof
units and 118 workloads. The verifier is `PROOF_READ_ONLY`; the root is
`PROOF_OS_TEMP_ISOLATED` and receives only `NODE_TEST_HARNESS`. Neither receives workspace-write,
listener-port, native-addon, filesystem-compatibility, or verifier runtime-probe authority. The
task wrapper authenticates the frozen T05 parent before App build, typecheck, the 73-case focused
suite, artifact verification, and the independent 10-case root proof. Required-gate and hosted
outcomes remain separate authorities.

The M09-T07 `desen-app-named-slot-authoring` verifier/root pair is ordinary and non-barrier. Its
sole formal impact parent is `desen-app-structured-inspector`; the connected closure contains 55
proof units and 120 workloads at
`sha256:6a7cb544efd2906ccd09db03209c54888a25f366b080b5cf37b87c43edc2651c`. The verifier is
`PROOF_READ_ONLY`; the root is `PROOF_OS_TEMP_ISOLATED` and receives only `NODE_TEST_HARNESS`.
Neither receives workspace-write, listener-port, native-addon, filesystem-compatibility, or
verifier runtime-probe authority. The task wrapper authenticates the frozen T06 parent before App
build, typecheck, the 70-case focused named-slot suite, artifact verification, and the independent
9-case root proof. Required-gate and hosted outcomes remain separate authorities.

The M09-T08 `desen-app-state-binding-editor` verifier/root pair is ordinary and non-barrier. Its
exact formal impact parents are `desen-app-schema-inspector`, `editor-core-state-binding-edits`, and
`desen-app-named-slot-authoring`; the connected closure contains 56 proof units and 122 workloads.
The verifier is `PROOF_READ_ONLY`; the root is `PROOF_OS_TEMP_ISOLATED` and receives only
`NODE_TEST_HARNESS`. Neither receives workspace-write, listener-port, native-addon,
filesystem-compatibility, or verifier runtime-probe authority. The task wrapper authenticates all
three frozen parents before App build, typecheck, the 109-case focused state/binding suite, artifact
verification, and the independent root proof. Required-gate and hosted outcomes remain separate
authorities.

The M09-T09 `desen-app-event-action-editor` verifier/root pair is ordinary and non-barrier. Its
exact formal impact parents are `desen-app-state-binding-editor` and
`editor-core-event-action-edits`; the connected closure contains 57 proof units and 124 workloads.
The verifier is `PROOF_READ_ONLY`; the root is `PROOF_OS_TEMP_ISOLATED` and receives only
`NODE_TEST_HARNESS`. Neither receives workspace-write, listener-port, native-addon,
filesystem-compatibility, or verifier runtime-probe authority. The task wrapper authenticates both
frozen parents before App build, typecheck, the 84-case focused event/action suite, artifact
verification, and the independent 10-case root proof. Required-gate and hosted outcomes remain
separate authorities.

The M08-T05 focused package layer passes 14/14 runtime cases and 14 compiler-negative assertions.
The cumulative package suite passes 69/69. The emitted public-package layer passes 38/38 runtime
cases and 48 consumer compiler-negative assertions over 27 runtime exports, 55 type exports, and
23 task declarations with TSDoc. The independent root proof passes 10/10 and authenticates 74
tracked receipts plus an isolated 28-file ESM graph with fourteen closed static edges. Its exact
30,014-byte artifact is
`docs/proof/artifacts/editor-core-0.1.0-state-binding-edits.json` at
`sha256:b85e578ac2bc27897517f12d8d4cf867a089cd61ff9fd1ab0664c819977634f8`.

The previously deferred full M08-T05 local run is now recorded. `pnpm check` ran from a clean
`/Users/selmanay/Documents/desen-devs/desen-m08-t05` worktree at exact HEAD
`b9f9aeb2ef0a8caff5dfdc821b004246021451c6` (`M08-T05: add immutable state and binding edits`). It
started at 2026-08-27 02:35:39 +03, was last observed still running at 04:45:22, and was first
observed complete at 04:48:56 with exit 0; every stage, including tests and boundaries, passed. The
2h13m17s interval from start to first observed completion is an observation upper bound, not an
exact runtime: the actual finish occurred within 04:45:22–04:48:56. This local record makes no
hosted M08-T05 claim.

The M08-T06 focused package layer passes 16/16 runtime cases and 19 compiler-negative assertions.
The cumulative editor suite passes 85/85. The emitted public-package layer passes 44/44 runtime
cases and 69 consumer compiler-negative assertions over 33 runtime exports, 69 type exports, and
20 T06-owned declarations with TSDoc. The independent root proof passes 10/10 and authenticates 81
tracked receipts plus an isolated 29-file ESM graph—eight editor and 21 dependency files—with 17
closed static edges. Its exact 31,310-byte artifact is
`docs/proof/artifacts/editor-core-0.1.0-event-action-edits.json` at
`sha256:05a7df153512b8dd0f8289991d12a9d12d79903ed8b3637ef6c8a450ca8a6be7`.

The M08-T07 focused package layer passes 33/33 runtime cases and six compiler-negative assertions.
The emitted public-package layer passes 46/46 runtime/root cases and 75 consumer compiler-negative
assertions while retaining 33 runtime and 69 type exports. The independent proof covers root
authoring isolation, digest differential invariance, all 16 Source-reachable unknown-extension
positions, allocator/identity/action scan isolation, the full 8 MiB Source limit, and
command-aware extension lifecycle. Recommended reverse-domain and legal non-namespaced keys are
both preserved without becoming hard validation. Deliberately deleted or whole-replaced owners are
outside the preservation claim; storage I/O and durability were deferred to M08-T08.

The M08-T08 focused layers pass 10/10 editor-core runtime cases, 21 editor-core
compiler-negative assertions, and 12/12 editor-web runtime cases. The emitted public-package
contracts pass 49/49 editor-core runtime cases with 96 consumer compiler-negative assertions and
3/3 editor-web runtime cases with six consumer compiler-negative assertions. The independent root
proof passes 10/10. It authenticates real OS-temp `better-sqlite3@13.0.3` create/open/unchanged,
generation-guarded update and two-instance CAS, close/reopen durability, complete root authoring
and all sixteen reachable extension locations, lost-response indeterminacy without automatic
retry, malformed transport rejection, and redacted authentication failure. Its exact 49,785-byte
artifact is `docs/proof/artifacts/editor-core-0.1.0-persistence.json` at
`sha256:51932d4165afff3c40fae6769527e480f6d0ff355f3fbc6d8ae7c6809e50a6fe`.

Real isolation probes verify per-step temp ownership, Node filesystem permissions, verifier-side
child-process denial, the exact root-test Node-harness grant, native-addon denial,
inherited-`NODE_OPTIONS` rejection, default TCP/UDP listener denial, the sole authenticated T11
Vitest-child exception, and identity-checked cleanup. Child
runtime probes are permitted only for the verifier side of
`publisher-catalog-pinning`, `publisher-bundle-publication`, `publisher-official-golden`,
`publisher-invalid-source-matrix`, `control-plane-bundle-store`, and
`control-plane-bundle-verification`, `control-plane-local-api`, and
`control-plane-runtime-activation`, `control-plane-runtime-recovery`, and
`control-plane-runtime-fault-injection`, and `control-plane-runtime-transition-races`.
The `desen-app-real-adapter-canvas` and `desen-app-published-host-update` verifiers receive the
same bounded verifier runtime-probe authority for their reviewed Vite build paths.
Native-addon authority is
permitted only for the exact
`reference-host-web-source-audit` verifier/root-test pair, the `publisher-invalid-source-matrix`
root test, and the exact `control-plane-local-api` and `control-plane-runtime-activation`
verifier/root-test pairs plus the exact `control-plane-runtime-recovery` and
`control-plane-runtime-fault-injection` pairs plus only the
`control-plane-runtime-transition-races` and `reference-host-web-channel-consumption` verifiers,
the exact `editor-core-persistence` verifier/root pair, and the exact
`desen-app-real-adapter-canvas` and `desen-app-published-host-update` verifier/root pairs. The transition-races and
channel-consumption roots are explicitly denied native-addon authority. These assignments total
nineteen exact native-addon steps; every unlisted workload remains denied.
Regression tests prove
that every unlisted step remains denied; the source-audit verifier remains workspace-read-only.
The reviewed production dependency audit for locked Fastify 5.11.2 and better-sqlite3 13.0.3
reports no known vulnerability.

The probes also pin all eighteen exact Node-permission compatibility workloads and their live policy
distribution across the 180 workloads: 162 `NONE`, two `FIXTURE_COPY`, fifteen
`REVIEWED_SYMLINK`, and one combined policy.
They prove exact fixture sources and recursive option shapes, bounded no-follow tree copies,
matching copy fingerprints, own-temp destination ownership, and rejection of sibling-temp,
external-source, symlink-parent, unreviewed-workspace-target, and unsupported-option escapes.
Eight unsafe-input workspace files are mirrored into the workload temp root; ten canonical-path or
inode cases retain only their exact reviewed tracked aliases and execute exclusively. Tests also
prove that the generated permission list grants neither the shared OS-temp parent nor a direct
workspace-write path, and that rebinding temp environment variables cannot redirect the adapter.
This is a trusted-code compatibility contract rather than an adversarial OS sandbox; the outer
tracked workspace seal remains the mutation authority.

Mutation tests must also prove that build or Turbo output drift fails the proof-phase seal,
non-ignored untracked residue fails the complete-execution guard, and tracked byte, executable
mode, file-count, or Git-index drift fails the outer gate boundary even when a workload already
failed or cancellation was requested. Ignored build outputs are covered by their dedicated seal,
not silently accepted as proof state.

Authority tests prove that structurally plausible fake close receipts, injected runners, and
injected repository or guard seams cannot produce `REQUIRED` PASS; the same fakes remain usable
only with explicit `SHADOW`. Clean-input fixtures cover staged, unstaged, non-ignored untracked,
and revision-mismatch rejection before any workload starts; the exact porcelain command also
includes submodule state in the opening authority.

First-terminal race tests cover timeout, child `error`, nonzero `close`, delayed cleanup, SIGINT,
SIGTERM, one-signal graceful shutdown, synchronous close during signal forwarding, repeated-signal
escalation, and the complete-gate deadline. The first event must retain its reason and exit code,
every active sibling must receive termination in that event, no dependent workload may start, and
the result may settle only after all active children close and cleanup completes.

The plan factory defaults to `REQUIRED + EXHAUSTIVE`, and GitHub Actions now invokes that default as
the official pull-request and `main` authority. The accepted same-revision required/legacy
comparison and subsequent hosted cutover are archived in the I07-02 baseline. The retained
sequential runner executes only through explicit manual `legacy-rollback`; a rollback dispatch
cannot cancel an authoritative event because mode and event are part of the concurrency key.
I07-02 adds no `AFFECTED` selector. Its completed promotion closed `DEBT-I07-008` by deleting the
temporary shadow workflow and modular comparison adapter/test. Under `DEBT-I07-007`, the retained
sequential runner and rollback-equivalence adapter remain test targets until I07-05 proves their
exact removal conditions.

I07-03 adds a separate pull-request-only `SHADOW + AFFECTED` observer while leaving the exact
`REQUIRED + EXHAUSTIVE` runner as the sole pass/fail authority. Its tests prove complete exact
tracked-path ownership, authenticated change boundaries, reverse dependency closure, and
fail-closed expansion of unknown, ambiguous, untrusted, policy, dependency, frozen-input,
incomplete-diff, or unsupported changes to `EXHAUSTIVE`. A strict-subset plan must still execute
every selected workload from fresh inputs; no phase may trust cached build, test, mutation,
checkpoint, or proof success. Only immutable dependency downloads may be cached.

Mutation and race coverage additionally reject fabricated or cloned Git-boundary receipts, source
authority drift, multi-proof ordering mismatches, absent-root dependency fabrication, cancellation
at every region boundary, and replacement of a primary execution failure by a closing-guard error.

Promotion remains false until every selector category is mutation-covered, false negatives remain
zero, and at least 20 consecutive eligible same-revision hosted strict-subset affected/exhaustive
comparisons agree. Observation starts at `0 / 20`; I07-04 is `NOT_STARTED` until the frozen
threshold passes and exact hosted provenance is independently authenticated. The pure ledger can
report threshold arithmetic but always returns promotion false. Even after promotion, `main`,
release, and manual-audit runs remain exhaustive.
The hosted bootstrap passed the authoritative Quality gate, while the shadow returned
`NOT_ELIGIBLE` → `EXHAUSTIVE` for `UNSUPPORTED_CHANGE_KIND`. Because no strict subset ran, that
result is not an eligible observation and the counter remains `0 / 20`. Exact hosted identifiers
are pinned in the
[`i07-03-affected-selector-shadow.json`](../proof/baselines/i07-03-affected-selector-shadow.json)
baseline. Focused local contracts pass 91/91 and the full CI infrastructure suite passes 203/203.
At that historical checkpoint, the full local gate was `BLOCKED_BY_LOCAL_SANDBOX`: loopback
`listen` returned `EPERM` in two pre-existing TCP lifecycle tests. This was an environment
restriction, not a product regression; the passing hosted Quality gate was authoritative.
`DEBT-I07-017` assigns the shadow-only job,
wrapper, and test wiring to I07-04 for removal by G07.

The later I07-04 campaign reached `20 / 20` with zero false negatives. Its independent baseline
binds the exact hosted identities, the immutable historical campaign digest, the conservative
selector transition, and the required-runner authority. Local cleanup removed all 17 G07-due
bridge families. Historical closure sequence 28 authenticates 25 frozen artifacts and 50 readers;
historical sequence 30 authenticates 27 frozen artifacts and 54 readers. Historical sequence 31 at
`181d5a1e0c012f53cfe02640c2f8d0ddf1e300090a3c3742882bb3722175e42d` authenticates 28 frozen
artifacts and 56 then-current readers. Historical append-only sequence 32 at
`9be019b902ee17a57c9e2f13270fa67fe26265d06e360719bd1542643be6a424` authenticates 29 frozen
artifacts and 58 then-current readers. Historical M08-T05 sequence 33 at
`64da5390046020ed223da42ce8a24d9fcf971c6a5a0a92fc49d368586414c871` authenticates 30 frozen
artifacts and 60 then-current readers while preserving sequence 32 and every predecessor artifact
byte. Its dedicated checkpoint suite passes 56/56. Historical M08-T06 sequence 34 remains at
`f641e8d20d0f5e94cca809d330e3ad5bb0d7ffe0c3ec5defc14e0b5fca63b674` authenticates 31 frozen
artifacts and 62 then-current readers. Historical M08-T07 sequence 35 at
`a2e3ef962ed37e0570cdddef64ae8d0eef2fd3f298cc2580f7ee65d8200f6fa3` authenticates 32 frozen
artifacts and 64 then-current readers while preserving sequence 34 and every earlier byte. It reseals
changed live historical reader indexes `[50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61]` and
appends the T07 proof/root readers at `[62, 63]`. Historical M08-T08 sequence 36 at
`4f351f2f535b1fc335876160256a42b1d53c7c7f43db08e0b86bf50c389d1e82` authenticates 33 frozen
artifacts and 66 then-current readers while preserving sequence 35 and every earlier byte. It reseals
the fourteen live editor-reader indexes `[50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62,
63]` and appends the T08 proof/root readers at `[64, 65]`. Historical M08-T09 sequence 37 at
`e43b48e2d4873b9212d4d0b1bf3e6fb03f56fcc350f8bc9ad65409891995c310` authenticates 34 frozen
artifacts and 68 then-current readers while preserving sequence 36 and every earlier byte. It reseals
the sixteen changed editor readers at indexes `[50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61,
62, 63, 64, 65]` and appends the T09 proof/root readers at `[66, 67]`. Historical M08-T10 sequence
38 at `64f7d6519589a5a8cb564af1215c2a12c44297f8ea855910613ea3b361cee6d0` authenticates 35 frozen
artifacts and 70 then-current readers while preserving sequence 37 and every predecessor artifact
byte. It reseals the eighteen changed live editor readers at indexes `[50, 51, 52, 53, 54, 55, 56,
57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67]` and appends the T10 proof/root readers at `[68, 69]`.
Current corrective reader authority is sequence 39 at
`6a186ee56e9a3c8ffd176b712d54a56e7ca3e73990f46d0fe387c9f52bddf6f7`. It preserves sequence 38,
all 35 frozen artifact receipts, and all 70 reader identities while advancing only indexes `[66, 67,
68, 69]`: T09 proof 71,087 bytes / `sha256:df665c264cea2c33a937c0fc74b6250ede8acae2032b75f2f24c1f8dc69affdb`,
T09 root 15,066 bytes / `sha256:574467231c3dbf4fd60b350da7f39c008d39072d935f461c50e059c609cc4d2a`,
T10 proof 90,708 bytes / `sha256:53942712a9a1c40a1076b46912d13feb247eda59405790f4f211c495c44e895c`,
and T10 root 14,830 bytes / `sha256:9cc2fb35ddb5d4b15371f8edcba07837e02a605169a609ef5eeb5da7e3ef0431`.
M09-T01 appends sequence 40 at
`e19eabc91c56c015b7fec7469d096b09a4bf42f5b6edc907c0207dd8c94feb0e`. It preserves
sequences 1–39 and all 35 predecessor artifact receipts byte-exact, appends the M09 artifact at
index 35 and proof/root readers at `[70, 71]`, advances current README-bound source-reader indexes
`[66, 67, 68]`, and reauthenticates unchanged reader `[69]`. The chain contains 36 frozen artifacts
and 72 current readers. Its dedicated checkpoint suite passes 63/63; this local reader authority
makes no required-gate or hosted M09-T01 claim.
M09-T02 appends sequence 41 at
`b36679b7ea3ffd0e019d3051b30312dd96b050e10ae7d5d44cf39eb9d30eeb68`. It preserves sequences
1–40 and all 36 predecessor artifact receipts byte-exact, appends the T02 artifact at index 36 and
proof/root readers at `[72, 73]`, and advances only the live T01 readers at `[70, 71]`. The chain
contains 37 frozen artifacts and 74 current readers. Its dedicated checkpoint suite passes 64/64;
this local reader authority makes no required-gate or hosted M09-T02 claim.
M09-T03 appends sequence 42 at
`40d7c380cec3a7efd04316959a41abda3c8f71c1604f7f2fb892f18ae4cd2fa5`. It preserves sequences
1–41 and all 37 predecessor artifact receipts byte-exact, appends the T03 artifact at index 37 and
proof/root readers at `[74, 75]`. The chain contains 38 frozen artifacts and 76 current readers. Its
dedicated checkpoint suite passes 65/65; this local reader authority makes no required-gate or
hosted M09-T03 claim.
M09-T04 appends sequence 43 at
`0bbb101332d7af5dcf7260b6df6961837003571f67a6e3a69232e65e19cded58`. It preserves sequences
1–42 and all 38 predecessor artifact receipts byte-exact, appends the T04 artifact at index 38,
reseals App compatibility readers `[70, 71, 72, 73, 74, 75]`, and appends the T04 proof/root readers
at `[76, 77]`. The chain contains 39 frozen artifacts and 78 current readers. Its dedicated
checkpoint suite passes 66/66; this local reader authority makes no required-gate or hosted
M09-T04 claim.
M09-T05 appends sequence 44 at
`f0c5f3bfbc30ccf230c5256b3a5672c29ffa0e884129ae210571895bd063812c`. It preserves sequences
1–43 and all 39 predecessor artifact receipts byte-exact, appends the T05 artifact at index 39,
reseals the live App readers at `[70, 71, 72, 73, 74, 75, 76, 77]`, and appends T05 proof/root
readers at `[78, 79]`. The chain contains 40 frozen artifacts and 80 current readers. Its dedicated
checkpoint suite passes 67/67; this local reader authority makes no required-gate or hosted
M09-T05 claim.
M09-T06 appends sequence 45 while preserving sequences 1–44 and all 40 predecessor artifact
receipts byte-exact. It appends the T06 artifact at index 40 and its proof/root readers at
`[80, 81]`; the chain contains 41 frozen artifacts and 82 current readers. This local reader
authority makes no required-gate or hosted M09-T06 claim.
M09-T07 appends sequence 46 at
`f09ec643d1b2756174ca47fae99837a68f6656bec0c6933e566d5075713a0f5f`. It preserves sequences
1–45 and all 41 predecessor artifact receipts byte-exact, appends the T07 artifact at index 41,
reseals App compatibility readers `[70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81]`, and appends
the T07 proof/root readers at `[82, 83]`. The chain contains 42 frozen artifacts and 84 current
readers. This local reader authority makes no required-gate or hosted M09-T07 claim.
M09-T08 appends sequence 47 at `c28ba9a9f274ac0bc3f7dc7ed6de51df35128b109b374b563f5c0239891f58f7`. It preserves sequences 1–46 and all 42
predecessor artifact receipts byte-exact, appends the T08 artifact at index 42, and extends the chain
to 43 frozen artifacts and 86 current readers. This local reader authority makes no required-gate
or hosted M09-T08 claim.
M09-T09 appends sequence 48 at
`5ecf9e630e2c91cb97a7c85c60e8318fdf694039711a64bf1797e481aca0ff90` without rewriting sequences
1–47 or any of the 43 predecessor artifacts. It appends the T09 artifact at index 43, reseals the
live App compatibility readers, and extends the chain to 44 frozen artifacts and 88 current
readers. This local reader authority makes no required-gate or hosted M09-T09 claim.
M09-T10 appends sequence 49 at
`45ed64e604400f18b15b3b4ef44bc35634a6c1567b46174329ec36529168272e` without rewriting sequences
1–48 or any of the 44 predecessor artifacts. It appends the T10 artifact at index 44, advances only
reviewed live readers at indexes `[72, 73, 74, 75, 76, 77, 78, 80, 82, 84, 86, 87, 88, 89]`, and extends
the chain to 45 frozen artifacts and 90 current readers. Its checkpoint suite passes 72/72. This
local reader authority makes no required-gate or hosted M09-T10 claim.
These are joined to the hosted closure evidence. [Cleanup PR #36](https://github.com/desenlab/desen-app/pull/36)
and its landed `main` revision passed fresh `REQUIRED + EXHAUSTIVE`. The exact one-file
[canary PR #37](https://github.com/desenlab/desen-app/pull/37) passed fresh
`REQUIRED + AFFECTED` in 3m54s in
[run 31676049922, job 94370743935](https://github.com/desenlab/desen-app/actions/runs/31676049922/job/94370743935),
selecting and closing 10 workloads for one proof unit as a strict subset without cached success.
All 17 G07-due debt entries are `CLOSED`; `DEBT-I07-007` remains `OPEN` for I07-05. I07-04, G07,
M08-T10, G08, and M09-T01–T12 are `DONE`; proof gates are 10/13, implementation progress is
107/145, M08 is 10/10, M09 is 12/14, `N-012`, `N-014`, `N-018`, `N-035`, `N-042`, `S-001`,
`S-002`, and `S-003` are `TESTED`, P-06 and P-18 are `PROVEN`, P-09 and P-10 are `PARTIAL`, P-08
remains `NOT_PROVEN`, N-036 remains `PLANNED`, PF-028 is `CLOSED`, PF-025, PF-083, PF-085, and
PF-089 remain `OPEN`, and M09-T13 is next. The
exact 30,014-byte M08-T05 artifact is
`docs/proof/artifacts/editor-core-0.1.0-state-binding-edits.json` at
`sha256:b85e578ac2bc27897517f12d8d4cf867a089cd61ff9fd1ab0664c819977634f8`; the report is
`docs/proof/EDITOR-CORE-STATE-BINDING-EDITS.md` and it remains M08-T06's sole direct prerequisite.
The exact 31,310-byte M08-T06 artifact is
`docs/proof/artifacts/editor-core-0.1.0-event-action-edits.json` at
`sha256:05a7df153512b8dd0f8289991d12a9d12d79903ed8b3637ef6c8a450ca8a6be7`; the report is
`docs/proof/EDITOR-CORE-EVENT-ACTION-EDITS.md`. The exact 62,304-byte M08-T07 artifact is
`docs/proof/artifacts/editor-core-0.1.0-authoring-round-trip.json` at
`sha256:33b6f81be62076d304c6daaec5d860e7995fa69ceaf34103469b349a347962db`; the report is
`docs/proof/EDITOR-CORE-AUTHORING-ROUND-TRIP.md`. The exact 49,785-byte M08-T08 artifact is
`docs/proof/artifacts/editor-core-0.1.0-persistence.json` at
`sha256:51932d4165afff3c40fae6769527e480f6d0ff355f3fbc6d8ae7c6809e50a6fe`; the report is
`docs/proof/EDITOR-CORE-PERSISTENCE.md`. The exact 40,099-byte M08-T09 artifact is
`docs/proof/artifacts/editor-core-0.1.0-continuous-validation.json` at
`sha256:7739b5143685d613a678c6eca5480f27a5a303b176bf2bf4613a4d6917fe7e5a`; the report is
`docs/proof/EDITOR-CORE-CONTINUOUS-VALIDATION.md`. Its 62,890-byte proof reader is pinned at
`sha256:f3b27812aae9b3e4a3d74ccb9cda7aac7749c560257f33003eb66d5041dd1b5f` and its 10,840-byte
root reader at `sha256:f1b415d0dc41f755649f1ddd345ba1454e8695b9971e0afbc4032fc7d348d2b5`.
The exact 325,549-byte M08-T10 artifact is
`docs/proof/artifacts/editor-core-0.1.0-terminal-integration.json` at
`sha256:5787479d699ab8f53b739e633bf9a88900da00ae4f4c78f96b3e62a73133fa1b`; the report is
`docs/proof/EDITOR-CORE-TERMINAL-INTEGRATION.md`. Historical sequence 38 pins its initial 84,005-byte proof reader at
`sha256:46354aae84ddf65314ad3cd8cfbefc33245e4de495ecda577ca296185f749ca2` and its 13,088-byte
root reader at `sha256:f1cd04fbccbba01469bfbacad3154c2ba99e130745dbbd1bcf0397230982dff9`.
The exact 12,118-byte M09-T01 artifact is
`docs/proof/artifacts/desen-app-0.1.0-shell-navigation.json` at
`sha256:c3189ff9196f0da91311156893ab569a3c9f9c1ee62631b58286647f36d23220`; the report is
`docs/proof/DESEN-APP-SHELL-NAVIGATION.md`. It records 24 tracked task files, including five
repository-owned SVG assets, and 43 runtime cases. The application build, typecheck, and lint pass
locally; the focused application suite passes 43/43 and the independent root mutation suite passes
8/8.
The exact 25,375-byte M09-T02 artifact is
`docs/proof/artifacts/desen-app-0.1.0-catalog-panel-layer-tree.json` at
`sha256:85a310feaf1a0cc3656055cd3a76eeb02e02a278c21d22167853b53c03f1ee61`; the report is
`docs/proof/DESEN-APP-CATALOG-PANEL-LAYER-TREE.md`. Its focused authoring suite passes 18/18 and its
independent root proof passes 8/8. These are local task receipts, not a required-gate or hosted CI
claim.
The exact 73,111-byte M09-T03 artifact is
`docs/proof/artifacts/desen-app-0.1.0-real-adapter-canvas.json` at
`sha256:8f89b237c20d80e83d96f17c31146d251c026977a4fff1ab1d0822e489c63151`; the report is
`docs/proof/DESEN-APP-REAL-ADAPTER-CANVAS.md`. Its 73,183-byte proof reader is pinned at
`sha256:e6ff92ffd774edab9cd38a852be67145fa048df79dcf38ff8740d94b522b1f18` and its 22,347-byte root
reader at `sha256:03a61e2e2ab976f090e258210ac3851d06c8a0b067d46ebb109426b21aa66946`. Its focused canvas suite
passes 20/20 and its independent root proof passes 11/11. These are local task receipts, not a
required-gate or hosted CI claim.
The exact 22,998-byte M09-T05 artifact is
`docs/proof/artifacts/desen-app-0.1.0-schema-inspector.json` at
`sha256:473ab3248ed7b7b4de0e558df47159a74c28c134b46569aa91130745fd69660b`; the report is
`docs/proof/DESEN-APP-SCHEMA-INSPECTOR.md`. Its focused Inspector suite passes 41/41, its complete
App suite passes 86/86, and its independent root proof passes 10/10. Dynamic and structured values remain locked, P-08 remains
`NOT_PROVEN`, and these are local task receipts rather than a required-gate or hosted-CI claim.
The exact 26,133-byte M09-T06 artifact is
`docs/proof/artifacts/desen-app-0.1.0-structured-inspector.json` at
`sha256:6ea4eb3f51fdfc39eeca676d7ebafb145d66a9efdfa03af9c33a7aa39aa6aaec`; the report is
`docs/proof/DESEN-APP-STRUCTURED-INSPECTOR.md`. Its focused structured-Inspector suite passes 73/73,
its complete App suite passes 118/118, and its independent root proof passes 10/10. The artifact
records 28 exact tracked-file receipts. Dynamic `$` values remain locked, P-08 remains
`NOT_PROVEN`, PF-025 remains `OPEN`, and these are local task receipts rather than a required-gate
or hosted-CI claim.
The exact 24,830-byte M09-T07 artifact is
`docs/proof/artifacts/desen-app-0.1.0-named-slot-authoring.json` at
`sha256:daae817af45d8ead7052fd84df4edefd7d29cdd9ebe9cc1baea5b22b27dae90f`; the report is
`docs/proof/DESEN-APP-NAMED-SLOT-AUTHORING.md`. Its focused named-slot suite passes 70/70, its
complete App suite passes 151/151, and its independent root proof passes 9/9. The artifact records
23 exact tracked-file receipts. Dynamic state/binding and event/action authoring, Design/Run,
durable save/open, browser E2E, publication, and activation remain unproven; P-08 remains
`NOT_PROVEN`. The compatibility patch covers non-overlapping boundaries, whole-row top/bottom
targets, a sticky Components target, and insert auto-selection exposing the existing safe Delete;
native real-browser drag E2E remains open. These are local task receipts rather than a required-gate
or hosted-CI claim.
The exact `28,766`-byte M09-T08 artifact is
`docs/proof/artifacts/desen-app-0.1.0-state-binding-editor.json` at
`sha256:b7298375cba4b82258d1c293ecb66c3ae6641408ae9f5753da121ac44fcf601a`; the report is
`docs/proof/DESEN-APP-STATE-BINDING-EDITOR.md`. Its focused state/binding suite passes 109/109; the
final complete structural receipt is `278/278`. It covers
surface-local primitive state list/add/update/delete, bounded conservative usage protection, exact
direct compatible local-state binding change/detach, and Publisher-atomic preview. Runtime and
advanced dynamic bindings remain read-only; P-08 remains `NOT_PROVEN` and PF-025 remains `OPEN`.
These are local task receipts rather than a required-gate or hosted-CI claim.
The exact `23,812`-byte M09-T09 artifact is
`docs/proof/artifacts/desen-app-0.1.0-event-action-editor.json` at
`sha256:0060ef39273ea36666f1701d5d3fa0f1610b95f40d88304ba980dcdc73cb29ab`; the report is
`docs/proof/DESEN-APP-EVENT-ACTION-EDITOR.md`. Its pure projection, panel, focused event/action,
complete App, and independent root suites pass 12/12, 7/7, 84/84, 202/202, and 10/10. It covers
Catalog-declared component events, exact handler lifecycle, canonical bounded action pointers, all
six public Editor Core mutations, the closed seven-action union, recursively nested operation
settlements, and Publisher-atomic preview. Behavior-owner UI and action execution are not claimed;
P-08 remains `NOT_PROVEN`, while PF-025 and PF-083 remain `OPEN`. These are local task receipts
rather than a required-gate or hosted-CI claim.
The exact `17,900`-byte M09-T10 artifact is
`docs/proof/artifacts/desen-app-0.1.0-design-run-modes.json` at
`sha256:bc5b7ffef0c39737882072f9340bcade86f084db8e7923fcb03aa7364d077334`; the report is
`docs/proof/DESEN-APP-DESIGN-RUN-MODES.md`. Its frozen proof and root readers are 53,346 bytes at
`sha256:ff4226241630daded979263dcd0a7fdb071591efbf789d1e7d2d4f4641779dfe` and 15,787 bytes at
`sha256:d27307b0763132e5c21f45c146d3773ab9dbf02371f850dca3d03e11a759f601`. It proves the exact
same-session Design/Run boundary and controlled adapter → Runtime React/Core → `state.set` path,
while P-09 remains only `PARTIAL`; P-08 remains `NOT_PROVEN`; S-001 remains `PLANNED`; and PF-025,
PF-028, and PF-083 remain `OPEN`. These are local task receipts rather than a required-gate or
hosted-CI claim.
The exact `29,407`-byte M09-T11 artifact is
`docs/proof/artifacts/desen-app-0.1.0-fixtures-scenarios-fidelity.json` at
`sha256:3f08980e687d48ba267f78c7d4dd1ae1eb59db5cc6bb3401d88705ee0416cc9d`; the report is
`docs/proof/DESEN-APP-FIXTURES-SCENARIOS-FIDELITY.md`. Its focused fixtures/scenarios/fidelity,
complete App, and independent root suites pass 86/86, 252/252, and 11/11. It proves props-only
transient scenarios, exact synthetic pending/success/declared-failure lifecycle, synchronous
cleanup revocation, visible unavailable real contexts, and complete conservative fidelity
disclosure. Durable persistence, diagnostics, publication/activation, and automated
real-browser/native-drag E2E remain unproven. These are local task receipts rather than a
required-gate or hosted-CI claim.
The exact `27,053`-byte M09-T12 artifact is
`docs/proof/artifacts/desen-app-0.1.0-source-persistence.json` at
`sha256:717d0ddada008edb34909d5defcc4c28e95b36f6dfc0b1abb4d09d9775a6b734`; the report is
`docs/proof/DESEN-APP-SOURCE-PERSISTENCE.md`, exactly 5,009 bytes at
`sha256:63d5d115e719ccdd91ecf68eea91bcd6f8c68c6513a8fbdea3bfd9f855637821`. Its focused five-file
persistence, complete App, and independent root mutation suites pass 142/142, 324/324, and 12/12.
It authenticates exact M09-T01, M08-T08, and M09-T11 parents and binds 35 current files without
tracking historical App readers. It proves route-owned generation-guarded authored Source
Open/Save, all-or-nothing open admission, stale-lifetime isolation, and complete canonical Source
dirty authority rather than identity or version. It covers same-value/revert cleanliness,
successful Open/Save baselines, current-vs-dispatched-save-snapshot settlement, centralized
commits, rerender-safe no-port projection with the exact `Local draft unchanged` clean label,
edited no-port and port-backed dirty-draft protection, and exclusion of
scenario/fixture/Runtime-secret state. Settlement tests pin exact own-enumerable capture without
accessor invocation, fresh frozen copies of valid optional diagnostics, exact CAS generation
validation, retryable draft-retaining malformed Open, indeterminate reopen-locked malformed Save,
and post-reflection/admission reentrant authority fences. A concrete App storage adapter,
diagnostics,
publication/activation, and automated real-browser E2E remain unproven. These are local task
receipts rather than a required-gate or hosted-CI claim.
The first hosted PR run exposed an isolation-fixture workspace-target symlink denied by Node's
permission model. The resealed fixture uses only absolute runner-temporary targets, and the exact
isolation suite passes 8/8 without permission widening. This is a corrective local receipt, not a
hosted pass.
The historical T07-integrated full CI infrastructure suite
passed 265/265; its dedicated checkpoint, required-affected, promotion, and retained legacy-gate
suites passed 58/58, 27/27, 19/19, and 25/25 respectively. The M08-T10-integrated CI infrastructure suite
passes 302/302; the terminal-integration root proof and checkpoint suites pass 10/10 and 62/62.
Those T10-integrated local receipts make no hosted M08-T10 claim. The M09-T01 commit-tree CI suites
pass 136/136 and their shared-state/root-gate units pass 52/52; required-gate and hosted results
remain unclaimed until observed. The historical M09-T04 complete structural CI glob passes
317/317. M09-T05-focused Inspector, complete App, root, sequence-44 checkpoint, and complete
structural suites pass 41/41, 86/86, 10/10, 67/67, and 320/320. Required-gate and hosted results
remain unclaimed until observed. M09-T06-focused structured Inspector, complete App, root, and
complete structural CI suites pass 73/73, 118/118, 10/10, and 323/323. The M09-T07 focused
named-slot, complete App, independent root, and complete structural CI suites pass 70/70, 151/151,
9/9, and 329/329. Sequence 46 closes at
`sha256:f09ec643d1b2756174ca47fae99837a68f6656bec0c6933e566d5075713a0f5f` with 42 artifacts and
84 readers. The M09-T08 focused state/binding suite passes 109/109; its final complete structural
receipt is `278/278`. Sequence 47 closes at
`sha256:c28ba9a9f274ac0bc3f7dc7ed6de51df35128b109b374b563f5c0239891f58f7` with 43 artifacts and 86 readers. No required-gate or hosted-CI
result is inferred from those local receipts.
The M09-T09 pure projection, panel, focused event/action, complete App, and independent root suites
pass 12/12, 7/7, 84/84, 202/202, and 10/10; the complete structural CI receipt passes 282/282.
Sequence 48's checkpoint suite passes 71/71 and closes at
`sha256:5ecf9e630e2c91cb97a7c85c60e8318fdf694039711a64bf1797e481aca0ff90` with 44 artifacts and 88
readers. No required-gate, hosted-CI, action-execution, or real-browser E2E result is inferred from
those local receipts.
The M09-T10 adapter, application, focused Design/Run, complete App, and independent root suites pass
9/9, 35/35, 44/44, 210/210, and 10/10. The application coverage includes the retained M09-T07
root-safe default placement target, explicit target change, enlarged drop lanes, last valid row
projection, visible selected-layer Delete control, and editable-control-safe Delete/Backspace
shortcuts. It does not claim arbitrary canvas geometry or native-browser drag E2E. The checkpoint,
promotion, and complete serial structural suites pass 72/72, 19/19, and 339/339. Sequence 49 closes
at `sha256:45ed64e604400f18b15b3b4ef44bc35634a6c1567b46174329ec36529168272e` with 45 artifacts and 90
readers. No required-gate, hosted-CI, fixtures/scenarios, persistence, diagnostics, publication,
activation, or automated real-browser E2E result is inferred from those local receipts.
The M09-T11 focused fixtures/scenarios/fidelity, complete App, and independent root suites pass
86/86, 252/252, and 11/11. The historical exhaustive authority contains 194 workloads and 92 proof
pairs—81 ordinary and 11 barriers—with a 59-proof-unit/128-workload closure and ownership over
1,232 tracked paths, including 184 proof-owned paths. Sequence 50 advances
`sha256:45ed64e604400f18b15b3b4ef44bc35634a6c1567b46174329ec36529168272e` to
`sha256:6abea41064a05efe363df0f66d1e7d1b4923af08f819acf4c266b092985192a4` across 46 artifacts and
92 readers; checkpoint, promotion, selector plus required-affected, ownership, and remaining
touched-CI suites pass 73/73, 19/19, 56/56, 15/15, and 127/127 locally. No required-gate, hosted-CI, durable
persistence, diagnostics, publication/activation, or automated real-browser/native-drag E2E result
is inferred from those local receipts.
The M09-T12 focused five-file persistence, complete App, and independent root mutation suites pass
142/142, 324/324, and 12/12. The current exhaustive authority contains 196 workloads and 93 proof
pairs—82 ordinary and 11 barriers—with a 60-proof-unit/130-workload closure and ownership over
1,243 tracked paths, including 186 proof-owned paths. No required-gate, hosted-CI, concrete App
storage adapter, diagnostics, publication/activation, or automated real-browser E2E result is
inferred from those local receipts.
Sequence 51 advances exact sequence-50 predecessor
`sha256:6abea41064a05efe363df0f66d1e7d1b4923af08f819acf4c266b092985192a4` to
`sha256:42e88946b598566a46237af8d30587fa765d9d58807e864464fc5525fbc64921` across 47 artifacts and
94 readers. Checkpoint, promotion, selector plus required-affected, ownership, and remaining
touched-CI suites pass 74/74, 19/19, 58/58 (21 + 37), 15/15, and 128/128—294/294 combined.

Current reader compatibility is distinct from frozen task evidence. Security hardening may advance
one or more live readers through the reviewed checkpoint append procedure only when every previously pinned
checkpoint digest, frozen artifact, claim/nonclaim scope, and historical projection remains
unchanged and the full existing plus new regression suite passes. The checkpoint is inert data and
cannot select executable commands. M07-T02 follows that procedure in checkpoint sequence 3: the
historical head `f92e879b3a72e75abb07af2b2bcfded62e014b99aa0cbe69c64aee12d5379882`
authenticates nine artifacts and eighteen readers. M07-T03 appends historical sequence 4 without
rewriting any predecessor: its head
`ee2d72c3529d9295945d339fb214c41dbbf906ffa6613a7ad6e766ec79c1bcf5` authenticates ten artifacts
and twenty readers. A corrective M05-T04 current-reader append after M07-T03 establishes sequence
5 historically: its head
`7df3631d509ed7e65c571566a825d6d3cd52d336e1a74512bf3e8e26920749b3` authenticates eleven
artifacts and twenty-two readers. Sequence 6 only advances the M06-T11 proof/test receipts for a
bounded, explicit 20-second nested Vitest timeout; its then-current head `790ad28b6fd441e6d5f40f277a97e8de36a178a9e50fff3e208e6c27588915fd` still
authenticates eleven artifacts and twenty-two readers. It changes no coverage, assertion,
concurrency, frozen evidence, workload/proof count, progress, or plan digest, and sequences 1–5
remain byte- and hash-unchanged.

Reviewed sequence 7 links predecessor head
`790ad28b6fd441e6d5f40f277a97e8de36a178a9e50fff3e208e6c27588915fd` to its then-current head
`d50b5ee4fb265f241bac7652b979af0146d530528ba6db8fc98c8fb3225a5ba5`, authenticating 13 frozen
artifacts and 26 live readers. It adds the 34,612-byte M07-T04 artifact
`sha256:29555326d51073c50937519d8706049ad17287079cc3ef4dc7060bb3a3225394`, live T04 proof/root and
current M05-T06 compatibility readers. It seals the exact final receipts of the complete 26-reader
live set after all T04 compatibility bridges and the reviewed CI timeout calibration, including
current M05-T09, M06-T01/T05/T08/T09/T10/T11, and M07-T01/T02/T03 readers. The frozen M05-T06
artifact remains byte-identical with its historical
`PARTIAL` projection; live P-17 is `PROVEN`. Sequences 1–6 remain unchanged. This is a reviewed
local-reader checkpoint, not a new hosted CI result.

Reviewed sequence 8 links the exact sequence 7 head
`d50b5ee4fb265f241bac7652b979af0146d530528ba6db8fc98c8fb3225a5ba5` to its then-current head
`f707fb4c3338aeda79eb6242b645b5e864ce54b1e3955373e8edebcd7e026b8a`, authenticating 14 frozen
artifacts and 28 live readers. It adds the 41,945-byte M07-T05 artifact
`sha256:144e8a46b3b41a1f98a022bf4c16dddb9d7415af4e5033322484d4bdd49c55b9`, its 73,915-byte proof
reader `sha256:f66d40863a46dd7ed9e28afb2c78f8afbda8aee964e72d4fba60e65e55a351b3`, and its 17,291-byte root
reader `sha256:490d4f922ea41dc7bca178cc54ab938ab136f0b922d7842af623001eabf60a65`. Prior live receipts,
including current M07-T01 through M07-T04 and reference-host source-audit compatibility readers,
are resealed after the T05 compatibility changes. Sequences 1–7 and predecessor frozen artifacts
remain unchanged. This is reviewed local-reader evidence, not a new hosted CI result; I07-04 owns
the remaining compatibility-reader debt.

Reviewed sequence 9 links the exact sequence 8 head
`f707fb4c3338aeda79eb6242b645b5e864ce54b1e3955373e8edebcd7e026b8a` to its then-current head
`94f48160552a6e0de702f71200e56c23d61bab8692d43f3ac1104dcfa681568b` with the same 14 frozen
artifacts and 28 readers. Exactly reader indexes `[16, 17, 18, 19]` change: M07-T02 proof
94,612 bytes / `sha256:4c69fa253ba2d9432a75c6c6aaa2ad69e23c3683c43dae9c92dc73b3208937d9`;
M07-T02 root 20,959 bytes / `sha256:fdcfc8c4868c1ee084b652e42c7dab4750bc569c4c05928dde7136118b4689ed`;
M07-T03 proof 86,174 bytes / `sha256:5624b06d8d0962d18c9a920a34a95b0023f4909d8c7b7812057bedcdc62ab5ab`;
and M07-T03 root 21,119 bytes /
`sha256:10c1a677b88b5c6bd4389e659ce38f11a627ae92de4aafe4ffade0de23790f11`.
The minimal T05 compatibility bridges authenticate the current shared strict-JSON internal
source/distribution and exact T03 → T04 → T05 aggregate adjacency while projecting unchanged
frozen T02/T03 artifacts. Sequences 1–8 and all frozen artifacts remain unchanged. This is reviewed
local evidence only, not a hosted CI claim; `DEBT-I07-012` cleanup remains owned by I07-04.

Reviewed sequence 10 links the exact sequence 9 head
`94f48160552a6e0de702f71200e56c23d61bab8692d43f3ac1104dcfa681568b` to its then-current head
`bd3f5b90656f0e41d7f6aa439fdc01889e9ebeada26cd3caf8624c3ce1db7d07` with the same 14 frozen
artifacts and 28 readers. Exactly reader indexes `[7, 14, 15]` change: the M06-T08 catalog root
`tests/publisher-catalog-pinning.test.mjs` is 38,530 bytes at
`sha256:bb3038a8c5bb241c863daa6c7f41c1d8ab210da81fdbe52697f33a3c14909116`; the M07-T01 proof reader
is 99,672 bytes at `sha256:d9d9edd6379357dde229999ce461a0dc66bf58dc0d7900eb6f5ece177a9b3fba`;
and its root reader is 26,679 bytes at
`sha256:6b3a7869962046a3594a788095faad640c76fec660a59aee7b26844e831851ff`. These minimal test-fixture
successors recognize the local-API aggregate tail and updated catalog-root receipt while the frozen
catalog and T01 artifacts remain unchanged. The final strictly sequential local catalog and T01
checks pass 51/51 and 16/16. Sequences 1–9 remain immutable. This is reviewed local evidence only,
not a hosted CI claim; `DEBT-I07-012` cleanup remains owned by I07-04.

Reviewed sequence 11 links the exact sequence 10 head
`bd3f5b90656f0e41d7f6aa439fdc01889e9ebeada26cd3caf8624c3ce1db7d07` to its then-current head
`63b8af4da431f0918c7ea9480564750bd12057af2bc83c294d962113ce7c9be8` with the same 14 unchanged
frozen artifacts and 28 readers. Only indexes `[26, 27]` change: the M07-T05 proof reader is 77,034
bytes at `sha256:c704e25024eaf7bdf317cc144f6b85922a3fe73a24c9c91e639ede032e22eb6f`,
and its root reader is 17,578 bytes at
`sha256:4871c406390c4c9b36bff1c417a6c8dd22798736ea8daad1c63a3cbd0a978389`. Sequences 1–10 and every
frozen artifact remain unchanged. This is a reviewed local-reader checkpoint and makes no hosted
CI claim.

Reviewed sequence 12 links the exact sequence 11 head
`63b8af4da431f0918c7ea9480564750bd12057af2bc83c294d962113ce7c9be8` to its then-current head
`85c49a0d79346bf2ea92b716f6b43c5d95d164209e3d67af34871a334686e10e` with the same 14 unchanged
frozen artifacts and 28 readers. Only indexes `[26, 27]` change: the M07-T05 proof reader is 77,507
bytes at `sha256:e2050408c5bf3e084eacd6e42880310dafbfdf03b79821500cc0567b998f7d66`,
and its root reader is 17,716 bytes at
`sha256:061b40ea20e0f7ee362f26bd54db954c3caea338df5e2f090ce34a4618ac37cc`. This successor authenticates
the exact ADR token-bound documentation update while the M07-T05 artifact and every other frozen
artifact remain unchanged. This is reviewed local-reader evidence; hosted CI has not yet been
claimed, and I07-04 still owns the compatibility-reader debt.

Reviewed sequence 13 links the exact sequence 12 head
`85c49a0d79346bf2ea92b716f6b43c5d95d164209e3d67af34871a334686e10e` to its then-current head
`146b04f1c8209be64168afb451ceee2c422da0cdced116f8d08beafe795c533c` with the same 14 unchanged
frozen artifacts and 28 readers. Only index `[9]` changes: the M06-T09
publisher-bundle-publication root reader is 63,859 bytes at
`sha256:ae7b688d904b4c77632fd78e0ee23b2264eae1574b4350306b5e2ec1b9974b8d`. A hosted
required-exhaustive attempt exposed two stale M07 successor/current-receipt assertions in that
reader; after the narrow reader-only correction, its focused root passes 112/112 and the frozen
M06-T09 artifact remains unchanged. This is reviewed local-reader evidence, does not claim hosted
CI success, and leaves the compatibility-reader debt with I07-04.

Reviewed sequence 14 links the exact sequence 13 head
`146b04f1c8209be64168afb451ceee2c422da0cdced116f8d08beafe795c533c` to current head
`3d2dd7a48ee2573d14fb1dbea18ef8b4e3498c6a26f82d76ea589dba3c821078` with the same 14 unchanged
frozen artifacts and 28 readers. Only indexes `[10, 11, 14]` change: the M06-T11 proof reader is
166,563 bytes at `sha256:06eb59602a768c13f19cc83289a574823d191aa3b62ed8fb7149381b326de802`,
its root reader is 60,572 bytes at
`sha256:29b407c2f7f1b17d17bff450185a9304c3186caea4a98973df3f1e3e4f684531`, and the M07-T01 proof
reader is 99,672 bytes at
`sha256:888d5e81bda7ca2cdcc58bb063d49409cad5f5d73bdd9baaa16dc199e566e5c6`. This narrow CI-reader
successor changes no frozen artifact. Subsequent M07-T05 pull-request and `main`
required-exhaustive runs passed in hosted CI; sequence 14 itself remains local-reader evidence, and
I07-04 still owns the compatibility-reader debt.

Reviewed checkpoint sequence 15 links exact sequence 14 head
`3d2dd7a48ee2573d14fb1dbea18ef8b4e3498c6a26f82d76ea589dba3c821078` to current head
`b75a2580d1d6820392aa74ba5b7671b01baed1740fe2097c2a78e24663b5e4d5`. It authenticates 15 frozen
artifacts and 30 live readers, appends the 47,622-byte M07-T06 artifact
`sha256:d025da5329d5b56b9b46e7292a08883386a151add5e419edf2a9345425319494`, reseals reader indexes
`[0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 14, 15, 16, 17, 18, 19, 22, 23, 26, 27]`, and appends T06
readers `[28, 29]`. Sequences 1–14 and predecessor artifact bytes remain unchanged. This is
reviewed local-reader evidence and claims no hosted M07-T06 result. `DEBT-I07-009` and
`DEBT-I07-013` register the temporary compatibility-reader bridges under I07-04 for removal by G07.

Reviewed checkpoint sequence 16 links exact sequence 15 head
`b75a2580d1d6820392aa74ba5b7671b01baed1740fe2097c2a78e24663b5e4d5` to current head
`f9e77791148c7f89e586b6eb8964338185a35c11900b69262a159002af0838cd`. It authenticates 16 frozen
artifacts and 32 live readers, appends the 49,892-byte M07-T07 artifact
`sha256:3129a8e40c837a1c49d7fe206de794e0f7f7e130dc7e5e90a012b9e38bf07334`, reseals reader indexes
`[0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 14, 15, 16, 17, 18, 19, 22, 23, 26, 27, 28, 29, 30, 31]`,
and appends T07 readers `[30, 31]`. Sequences 1–15 and predecessor artifact bytes remain unchanged.
This is reviewed local-reader evidence and claims no hosted M07-T07 result. `DEBT-I07-014`
registers the temporary activation-reader bridges under I07-04 for removal by G07.

Reviewed checkpoint sequence 17 links exact sequence 16 head
`f9e77791148c7f89e586b6eb8964338185a35c11900b69262a159002af0838cd` to current head
`cc7227fe73f0b03fa56e18c075de5bc8bb2f87c4425aa669fd437ed2cc09730e`. It authenticates 17 frozen
artifacts and 34 live readers, appends the 44,224-byte M07-T08 artifact
`sha256:c65d4f2de1407fffb891b5d3ba2fc8a3a8d4e3f0fb76c8b8f2719be6b310b3f9`, reseals reader indexes
`[14, 15, 16, 18, 22, 26, 27, 28, 29, 30, 31]`, and appends the 84,219-byte T08 proof reader at
`[32]` (`sha256:08f143107430dde90cf1865c21d7ce1ec854897b0c1c4306b96525bdd0d18daa`) and the 24,939-byte T08
root reader at `[33]` (`sha256:b97e7991e0ac20e7232112594228fdd829a536e81d16d06fd3f909e7e3a02492`).
Sequences 1–16 and all 16 predecessor artifact files remain byte-identical. This local-reader
checkpoint makes no hosted M07-T08 claim. `DEBT-I07-015` records the temporary historical
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
`8ba332b059e508dcb93aec4211edf3dcb10fb497d3a743b61ff7ee7e08c8a28e` to current head
`ce12c066545e21779abf891898aaf0b09ceb1c0c1b51be382a0adabd5f86e939`. It preserves sequences
1–20 and every predecessor artifact byte, appends the 64,493-byte M07-T09 artifact
`sha256:9d0f764e35f5400fa662874784fba6f6492a39a0e60557fe1a9c7d7eab5407c9`, reseals 27 historical
compatibility readers, and appends the 64,932-byte proof reader
`sha256:da3fed33227c78eef872d06a3aedaf98a4e87e91de12893a21aceb5a9365216f` plus the 17,341-byte root
reader `sha256:f50017b668eb7f4a60d596a2d87a7e5b067989a9e1fe9a00270e685c44a4b8f6`. The chain now
authenticates 18 frozen artifacts and 36 current readers. This is reviewed local-reader evidence,
not a hosted M07-T09 claim; `DEBT-I07-016` records the temporary successor bridges for I07-04
removal by G07.

Reviewed checkpoint sequence 22 keeps sequence 21 intact and links predecessor head
`ce12c066545e21779abf891898aaf0b09ceb1c0c1b51be382a0adabd5f86e939` to current head
`aef9881c8fc540873f889a09754e5f2c19adc3c19934ba0fcfcf5e6a12b2da9e`. The inventory remains
18 frozen artifacts and 36 reader identities. Only workflow-dependent reader indexes
`[8, 10, 11, 12, 14]` are resealed; every frozen artifact and every predecessor checkpoint remains
unchanged.

M07-T09's child Vitest launcher also has a build-independent CI-contract preflight. It uses
`process.execPath`, the repository-local Vitest entrypoint, and owner-only package/workspace/config
and one-test files under the exact step temp root while retaining the scheduler-owned Node
permission policy. No package-manager, `PATH`, or ignored `dist` output is involved; file/cache
parallelism is disabled and cleanup is unconditional. The full T09 verifier still runs
authoritatively in required-exhaustive execution after the dependency graph builds its inputs.

M07-T10's full verifier launches its focused suite with `process.execPath` and the repository-local
Vitest entrypoint under an owner-only temporary config. It disables cache and file parallelism,
fixes one worker, bounds JSON-reporter output and execution time, removes inherited `NODE_PATH`,
redacts failure output to code-owned identities and size/digest metadata, and deletes temporary
state in `finally`. This is an authoritative exhaustive workload after its build prerequisites,
not a package-manager or `PATH`-resolved shortcut.

The final T08 reader does not infer coverage from matching strings. Exact AST structures identify
the executable CI registrations, shared-state mappings, and direct 12-runtime/9-root test
inventories, while code-owned exact source receipts bind their executable bodies and effective
flow. All proof-authority inputs use bounded identity-safe reads. The compiler-negative inventory
remains exactly 14 cases.

M09-T13 adds a nine-file focused diagnostics suite with 161 passing cases, a twenty-four-file
complete App suite with 339 passing cases, and an independent 12/12 root mutation proof. Coverage
includes rejected-candidate non-admission, exact transient report capture, all fingerprint/route/
owner/live-index fences, explicit node/behavior occurrence mapping, preserved order and duplicates,
readable unmapped/out-of-route diagnostics, inert obligations, opaque selection re-admission,
native selectable controls, dismissal, live count, `aria-current`, no autofocus, placeholder
separation from the managed Runtime subtree, Design/Run inertness, and no Run-to-Design focus theft.

The deterministic 29,208-byte artifact is
`docs/proof/artifacts/desen-app-0.1.0-node-linked-diagnostics.json` at
`sha256:8ac4d81d9097e188860757c637673ff406ba9f82b8cd8f379f184ef85138e972`. It binds 39 current
files and eleven exact Runtime, Editor Core, and App parents. Structural CI owns 198 workloads and
94 proof pairs—83 ordinary and eleven barriers—with a 62-proof-unit/134-workload affected closure
and ownership over 1,253 tracked paths, including 188 proof-owned paths. These local test receipts
make no required-gate, hosted-CI, publication/activation, or automated real-browser E2E claim.
P-16 is `PROVEN`, PF-086 remains `OPEN`, and proof gates remain 10/13.

## M10-T01A normal-product bootstrap testing

The proof-only M10-T01 harness remains an independent historical test. M10-T01A adds a second
browser scenario against the normal `apps/desen-app/index.html` and `src/main.tsx` production
entry. Its server builds that entry with a fresh, closed local-runtime configuration, starts the
real control-plane API over an owner-only temporary SQLite root, serves the production output on a
fixed loopback origin, and removes its temporary state during teardown. It must not inject
`initialDocument`, mutate browser history to skip product navigation, or expose the old
`window.__DESEN_BROWSER_PROOF__` readback bridge.

The scenario begins at `/`, creates the supported blank project through the visible modal, proves
the Generation 1 empty Source, authors the sign-in structure through the same Components, Layers,
Inspector, State, and Actions controls available to a person, and saves Generation 2. It then hard
reloads the production entry, verifies the stored state/bindings/actions/layer order, returns to
Projects, and reopens the project through visible cards. Browser assertions are paired with
focused Vitest coverage for StrictMode single-open behavior, missing/existing/failing storage,
exact create requests, CAS conflicts, explicit reopen, unavailable host composition, and late
settlement revocation. Local-runtime tests separately cover closed config capture, transport
limits, random credentials, private state roots, startup rollback, and idempotent shutdown.

The normal-product scenario also protects Inspector replacement-focus geometry at a deliberately
short `1600 × 840` desktop viewport. Immediately before and after setting the optional second
TextField `Secure` property—and again after checking its switch—it compares the exact vertical
bounds of the command bar, authoring shell, canvas, Inspector, and page frame, while requiring zero
window, document, and editor scroll and no editor scroll-height growth. Component tests separately
prove both Set and Unset hand focus to the replacement control with `preventScroll`; the browser
path uses the native switch hit area without forced interaction.

## M10-T01B visual behavior-authoring testing

M10-T01B keeps unit, integration, and browser responsibilities distinct. Unit suites exercise
atomic input connection/reconnection, half-connection disclosure, schema-compatible visual action
choices, rejection of a second or conditional/extended write to the bound input state, exact
structured-schema matching, object-versus-array rejection, advanced-only structured literals,
visual replacement of existing actions, Runtime-safe operation aliases, complete condition
set/clear, conflicting aliases, a non-auth operation with a distinct effect/error inventory,
hostile input objects, exact Runtime context fencing, and pre-copy traversal limits.
Application tests retain Source, persistence, publication, Inspector, and Design/Run composition.

The isolated Chromium scenario remains the visible empty-project flow. It first constructs the
reported incorrect placeholder-only binding and proves that successive keystrokes replace the
placeholder rather than a controlled value. It then repairs both TextFields through **Input
connection**, creates the Button's Catalog operation action and Alert's operation-failure
visibility through visual controls, types complete email and password strings, observes pending,
settles the selected Catalog error, and observes the conditional Alert. It also asserts that the
generic operation outcome control remains a grid and its completion action retains the intended
editor styling after the Run controls moved into per-operation fieldsets.

The task proof authenticates exact product sources, tests, browser spec, prerequisite artifact, and
closed nonclaims. The browser smoke is authoring-usability evidence only: it does not replace the
dedicated M10-T02 typed-input/pending matrix, M10-T03 failure-state matrix, or M10-T04 real-host
success/navigation proof. The local launcher test that binds fixed port 5173 may be executed only
when that product port is free; an occupied developer session is preserved rather than terminated,
and hosted CI supplies the clean-host execution.

## M10-T01C evergreen product-composition testing

M10-T01C separates profile admission, generic composition, and existing product regression. The
`project-workspace-profile` suite exercises an explicit reference profile and an auth-independent,
two-surface, two-Catalog feedback profile. It proves route slug/Source-id separation, complete
Catalog matching independent of caller order, detached immutable snapshots, and rejection of
accessor-backed inputs, route drift, incomplete package candidates, forged adapter registries, and
forged profile handles. Current-document cases additionally reject entry drift, hidden/extra,
missing, or substituted surfaces, and changed complete Catalog requirements after profile creation.
Persistence and application cases prove that a prepared controller and editor lifetime remain bound
to the exact opaque handle even when two profiles expose identical public ids and routes.

The `evergreen-product-composition` suite combines a source audit with a complete App render. The
audit requires generic editor, preview, persistence, publication, fixture/scenario, canvas, and
product-bootstrap modules to remain free of account, sign-in, reference-Catalog, and example
defaults. The jsdom integration creates a separate feedback profile, opens the ordinary route,
renders the real managed feedback canvas and Source layer hierarchy, and proves the sign-in heading
is absent. Existing App, persistence, publication, and activation suites receive the explicit
reference profile and preserve their previous behavior; focused negative cases keep cross-profile
routes, invalid profile handles, incomplete Catalog authority, and wrong host binding from reaching
storage, Publisher, or host activation.

The inert-inventory suite authenticates a separately created `ProjectInventoryFixtureHandle`,
proves capture detachment and bounds, and rejects forged handles, accessors, proxies, sparse or
extended arrays, subclasses, symbols, and non-exact records. Application coverage proves fixture
routes render metadata only and refuse Source, persistence, publication, mutation, and
project-creation authority.

Synthetic Run isolation replaces every one of the nine profile host-port families and asserts that
none of their callbacks is called; only the explicit local Catalog fixture operation controller may
settle an operation. Multi-surface application coverage opens a non-entry surface and proves the
canvas renders that selected surface from a transient preview Bundle while Save still sends the
authored entry document and Publish still uses its base revision and publishes its original entry.
Fixed-destination publication cases authenticate the port's private channel/host pair, reject
unbranded and mismatched ports before I/O, and prove publish bytes, publish requests, and activation
requests are validated, cloned, and reconstructed rather than forwarded as caller-owned objects.

The task-specific artifact is
`docs/proof/artifacts/desen-app-0.1.0-evergreen-product-composition.json` and the independent
verifier is `scripts/verify-desen-app-evergreen-product-composition.mjs`. These checks establish the
composition seam only. They do not substitute for M10-T02's browser input/pending matrix, M10-T03's
failure-state matrix, M10-T04's separately authorized real-host flow, or the hosted exact-head
`Quality gate` required before merge and completion reporting.

Reviewed reader checkpoint sequence 66 preserves the exact sequence-65 head and all 53 predecessor
artifacts, then adds the 19,299-byte M10-T01C artifact at
`sha256:779434ca834b8d770c726d905408f0a3d0a7145abbc6eaf2b81f1e77466b46ac`. It reseals only
reader indexes `[70..97, 102, 103, 104, 105]`, appends the T01C proof/root readers at `[106, 107]`,
and closes at `sha256:3bf2c27ca51f8ab6751dd0d026bbbf461ac2c6acea6fcc3088f7d011ae96fb83`
with 54 frozen artifacts and 108 current readers. The checkpoint suite passes 89/89, while the
sixteen exact historical App reader/root pairs pass 242/242. This is local reader authority and
makes no hosted exact-head claim.

## M10-T02 input and pending fixture testing

M10-T02 keeps visual recipe, shared component, Runtime lifecycle, browser, and deterministic-proof
responsibilities independently observable. The focused 82-case slice contains 9
authoring-connection cases, 11 behavior-control cases, 15 synthetic fixture cases, 11 shared
interactive-component cases, and 36 Runtime operation-lifecycle cases.

Connection tests prove one atomic operation/Loading mutation, explicit reject/replace/queue values,
exact repair position, preservation of unrelated actions, settlement programs, guard, and
extensions, and no mutation for multiple ambiguous root invocations. Control tests cover semantic
rerendering, collision-free aliases across the whole surface, manually reserved alias rejection,
exact-name-only automatic state suggestion, optional-input absence, and loss-prevention for both
declared and additional advanced input values.
Fixture tests derive outcomes from Catalog authority, keep request inputs opaque, and revoke pending
work on deactivation, replacement, and disposal. Shared component and Runtime tests separately
prove complete plain/secure input emission, focus-preserving accessible Loading, activation
suppression, synchronous pending publication, and reject concurrency.

The dedicated Chromium configuration runs one normal-product scenario from the visible zero-project
state. It creates the blank project, states, two TextFields, and a Button; uses visible **Set
Secure**, requires the authored toggle to be checked and the rendered field to be native
`type=password`; uses visual input and operation controls; and types both values in multiple
chunks. It verifies that only Synthetic is
available, selects one exact Catalog-derived declared error, and observes an unresolved Promise
through Runtime pending, disabled outcome selection, enabled explicit completion, and Button
busy/disabled/loading attributes. After confirming the default reject choice, it deliberately sets
queue before activation and presses Enter while the focused Button is busy. Any leaked Press would
therefore become a second pending invocation after settlement and fail terminal assertions rather
than disappearing behind reject behavior.

The browser keeps complete input values and pending state across Design → Run, then explicitly
completes the fixture and waits two animation frames before requiring terminal Loading cleanup.
That delay makes a queued invocation observable; no Alert visibility or navigation is asserted. The
scenario passes 1/1. The deterministic verifier remains passive, and its independent
root mutation suite passes 10/10; neither starts Chromium, Vite, a listener, or an external host.

The 14,261-byte / 25-receipt artifact
`docs/proof/artifacts/desen-app-0.1.0-input-pending-fixture.json` is pinned at
`sha256:161202698b013775cbc89625ecea1f6894e9abcd927fb2eb660dff71652ba43d`. A bounded canonical
gzip bridge separately authenticates the M10-T01C historical task-time inputs: its 2,307,407 bytes
are pinned at `sha256:16f6ec332fb03368e617563560b9930a7608594907ce61d5d15554be4dc7523d`
before decompression and defensive projection. The current neutral inventory contains 212
workloads / 101 proof units; the App closure contains 69 proof units / 148 workloads, and ownership
covers 1,366 tracked paths / 202 proof-owned paths.

Checkpoint sequence 67 preserves sequences 1–66 and closes 55 artifacts / 110 readers at
`sha256:9ee6909c0f11ed7149cb9bf6ce1c7943ed99aac2d2c6f9138caea8f5dd2044b7`; its dedicated suite
passes 90/90. This authenticates reader identity and impact only; it does not cache a workload pass.

These checks close only M10-T02. P-09 and P-10 remain `PARTIAL`; M10-T03 still owns visible public
failure, M10-T04 owns success/navigation and a separately authorized real host operation, and G10
remains open. A local result never substitutes for the hosted exact-head `Quality gate` required
before merge.

## M10-T03 visible failure fixture testing

M10-T03 independently observes product projection, Catalog fixture authority, managed conditional
rendering, controlled reference components, Runtime lifecycle, and Chromium. Focused Vitest passes
144/144 (52 App, eleven reference-component, and 81 Runtime cases); the dedicated browser scenario
passes 1/1 and the independent root mutation reader passes 10/10. The browser proves a public
failure Alert is absent before/during pending, appears after exact `invalidCredentials` settlement,
hides during real retry pending, and reappears after the second settlement while inputs, Loading,
route, and 420 × 720 geometry remain stable.

The 16,868-byte / 34-receipt artifact is
`sha256:bde909f8dbc4837c70627bab454d3dc5a936bd0abb6d70ec22b9cffbdb0e6a20`.
Its bounded 2,491,742-byte M10-T02 historical bridge is
`sha256:a3ef969f87441e2d8079dc7cd27db3a759acbb645441d206c3b35adc3149ec10`.
The passive verifier starts no browser, server, listener, network request, or external host.

CI contains 214 workloads / 102 proof units at inventory
`sha256:c1cec82a944152060e00caa1ad6f500c7f7e391d7056fe84f61967aef62ef947`.
The impact graph is
`sha256:91645dd903e4ade7f10f54dd6b07c65a49b355921a35946ee305ee9782aad0ee`;
the T03 closure is 70 proof units / 150 workloads at
`sha256:52619a1053d46d20e6efedc7e5e1b17dee372fe63c5438dd14c768ac7ff25cfa`.
Ownership covers 1,377 tracked / 204 proof-owned paths at
`sha256:903c1fabc314e2558e05aff85b810d279b045efdfd52494c2f08b281808533db`.
Shared state remains 91 ordinary / eleven barriers with 91 OS-temporary roots.

Checkpoint sequence 68 closes 56 artifacts / 112 readers at
`sha256:e685779412ca17b76c78a56ff545bbff5a7fc5efc8bc564247cc49e7c54eeca8`
and passes 91/91. Selector and required-affected runner authorities are
`sha256:cb0638a65d9ba9bfcfecb780921a195da4c19de5af9512fb2a5169ecbf18fb2f`
and `sha256:ba00d7c81ca4392d50b0fc869434d531acd82a949cde376de051f93261e6f723`.
These checks close only M10-T03 visible failure. P-09/P-10 remain `PARTIAL`; M10-T04 still owns
success, navigation, and separately authorized real-host operation. Local results do not imply
hosted exact-head `Quality gate` or `Browser E2E` success.

## M10-T04 success, navigation, and host-operation testing

The dedicated `success-host-playwright.config.ts` runs alongside, rather than replacing, the four
earlier browser configurations. Browser execution owns real UI and host effects; the new
`desen-app-success-host-operation` deterministic verifier and root mutation test remain passive
proof readers. Their ordinary shared-state class grants no listener, application-selected code,
or external-network authority. Test-only runner seams are not production completion authority.

CI contains 216 workloads / 103 proof units at inventory
`sha256:d6d00fb7ec87e41c75ada3ce3d65cb0d3cf9286936c437fa836bbec9eed372cc`.
The impact graph explicitly binds both the frozen T03 failure proof and executable reference
host-operation proof; it is
`sha256:ae57b2b84f3ba3077ecf589b1444d413213b8e54f9f4058368e8a11cc706c28b`.
The T04 closure contains 71 proof units / 152 workloads at
`sha256:548dcbecc29444b1ba8973a664459980fbbcbfe40b058bc8f624b78b2a69a065`.
Shared state remains 92 ordinary / eleven barrier pairs with 92 OS-temporary roots. Positive
tests pin both real parents and passive classification; negative tests reject omitted binding
authority, missing or substituted workloads, widened listener grants, stale checkpoints, and
unauthenticated promotion input. Existing failure, input/pending, and historical proof tests
remain required. The ordinary-T bounded baseline remains unchanged; these local checks never
substitute for exact-head hosted `Quality gate` and `Browser E2E` results.

The Browser E2E server may import only the exact local-operation listener via its anchored
dependency-rule exception. One positive and two negative boundary fixtures cover the permitted
edge, an unreviewed dev target, and the permitted target from an unauthorized browser-proof
entry. Their six files are conservative shared proof inputs; the passive proof pair still gains
no listener permission.

The final tracked set contains 1,409 paths / 206 proof-owned paths at ownership
`sha256:168ce27d3922269d3e51c485108c1acdbafdbbe74175d76d5d20c471162f8fc1`.
The two exact new verifier/root files select T04; the remaining new product, architecture,
artifact, and shared proof files force exhaustive coverage. The exact 32-path extension,
cumulative historical projection, and both formal parents are independently asserted by the CI
contract tests.

The 22,456-byte / 51-receipt artifact is
`sha256:d9d841af06ec9efc51c3f1c74079f0aa4d5e1c7e996f3b97df7e277e4b1f8423`.
Checkpoint sequence 69 preserves the preceding history and closes 57 artifacts / 114 readers at
`sha256:535a09b42d158f9bdf934924f704f3fb278d68da84a3dcbbfa32e38cee375c61`.
The T01A/T01C proof-library readers and T03 proof/root pair `[102, 106, 110, 111]` are resealed;
the immutable T03 and earlier artifacts remain unchanged. Selector and required-affected runner
authorities are
`sha256:ceb46eba37c63e46743fb03d4389a188928b7bedf13cab7190b276313210eae8` and
`sha256:a6734be24611dd476051db3c93d8672e2892afe9a1276d154e67127d6c10ea35`.
This still authenticates only identity and impact, never a cached execution result.

## M10-T05 published-host update testing

The sixth dedicated Playwright configuration starts the normal Desen App product, an isolated
local control plane, a separately built reference-host client/server, and an independently
credentialed activation bridge. Through visible controls it creates a project, authors two Text
layers, saves and publishes revision A, and observes that exact output in the reference host. It
then changes both visible text and Stack gap, saves and publishes revision B, reloads the host, and
observes the update. The host HTML, JavaScript, and CSS fingerprint remains byte-identical across
both activations, so the changed result is published Source data rather than a rebuilt host.

Focused product coverage keeps channel, host, endpoint, credentials, callbacks, and executable
modules outside authored Source. Browser publication and server activation use distinct fixed
loopback authorities, bounded bodies, closed exact-own-data shapes, and no cookies. The trusted
reference-host handle uses its single existing controller, independently reads the fixed channel
before and after refresh, requires the exact positive channel generation and SHA revision, and
returns `active` only when the controller's active revision equals the requested revision. Closed,
unavailable, failed, or uncertain paths settle fail-closed without exposing credentials.

The deterministic proof inventories 116 current source receipts and 66 focused declaration sites.
Fresh in-memory Vite audits cover 168 App modules / 510 static edges and 104 host modules / 299
static edges, including 22 byte-identical transformed managed modules shared by both graphs. They
contain no unresolved or dynamic edge and write no build output. The verifier starts no Chromium,
listener, product server, or external host; the independent root mutation reader has ten cases and
remains passive.

The CI isolation contract explicitly admits the existing T05 Vite native-addon policy for both
the verifier and the root mutation test. The root is also exercised through that generated
restricted environment, retaining workspace-read-only and listener-denial checks.

Supplied artifact and report bytes are defensively captured and authenticated before compiling
current sources. Invalid supplied identities fail before source acquisition; accepted identities
still require all fresh host and App build observations and exact evidence equality. Regression
controls use an empty workspace to distinguish early rejection from successful verification and
mutate nested build options after invocation to retain call-time snapshot guarantees.

The 189,123-byte artifact is
`docs/proof/artifacts/desen-app-0.1.0-published-host-update.json` at
`sha256:80c0b815a813ef462233b48a7fffe7c4d0bbf391aefc68eb9a6174da6bd84bd3`.
Its 3,111,833-byte authenticated T04 historical-reader bridge is
`sha256:07c33e1086e6de68220b42af1bbf75a1be17978972d344bedba5ad5685dc8470`
and inflates to 4,884,471 bytes.
Checkpoint sequence 72 closes 59 artifacts / 118 current readers at
`sha256:2db218584d8ef0497f1da57a6e001e73e85b35c3c7eb02b48e049348d429d249`;
the dedicated checkpoint suite passes 100/100.

The CI inventory contains 220 workloads / 105 proof units at
`sha256:66ae36cb2ec1c8a7bc7deee1a733e253cc1861d3b9ca1487c9725f437c3abf5a`.
The four-parent T05 impact closure contains 73 proof units / 156 workloads, and ownership covers
1,446 tracked / 210 proof-owned paths. These tests prove only the fixed-destination local reference
composition and P-07. Remote deployment, production credentials, multi-user persistence,
invalid-publication rejection, last-known-good recovery, P-12, and G10 remain under later owners.
Local success never substitutes for fresh hosted exact-head `Quality gate` and `Browser E2E`
results.
