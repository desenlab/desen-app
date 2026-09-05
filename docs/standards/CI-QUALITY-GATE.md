# CI Quality Gate

## Purpose

The hosted CI gate must prove the same safety properties as the cumulative task commands without
restarting identical builds and tests through every historical prerequisite wrapper.

The task-specific `verify:*`, `test:*`, aggregate `test`, and aggregate `check` scripts remain the
reviewed compatibility surface. GitHub Actions first verifies the required gate contracts, then
invokes `scripts/ci/run-required-affected-quality-gate.mjs` as the official dispatcher. Only an
authenticated eligible same-repository pull request may reach fresh `REQUIRED + AFFECTED`; every
unsafe boundary, plus `main`, release, and manual audit, runs fresh `REQUIRED + EXHAUSTIVE`.
`scripts/run-ci-quality-gate.mjs` is retained only behind the explicit manual `legacy-rollback`
workflow mode.

## CI-02 per-task completion contract

CI-02 is an explicitly user-authorized operational task. For an ordinary `T` task, its bounded
local baseline is exactly:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm build
pnpm boundaries
node scripts/ci/verify-proof-reader-checkpoints.mjs
```

The baseline is deliberately non-authoritative early feedback. It never replaces the exact
task-specific verifier or focused positive and relevant negative tests, and it cannot authorize a
merge or completion report. That authority requires an observed hosted `Quality gate` pass for the
exact current pull-request head; any new commit invalidates the earlier result.

`pnpm check` remains the local exhaustive compatibility and gate-closure command for G closure, an
explicit local manual audit, or an explicit request. Hosted `main`, release, manual audit, and
unsafe or untrusted boundaries remain fresh exhaustive runs. The hosted dispatcher still chooses
fresh affected scope only for an authenticated eligible same-repository pull request and otherwise
falls back to fresh exhaustive scope. A frozen artifact, current checkpoint, or seal is identity
and impact authority, never cached success; every selected verifier, test, build, and boundary
workload remains fresh.

CI-02 does not add a local affected selector. The hosted dispatcher and workflow are unchanged.
I07-05 and the legacy rollback path remain unchanged.

## Single-pass order

The gate runs from a fresh workspace in this order:

1. validate the frozen CI inventory and the orchestrator's own mutation tests;
2. check formatting and lint the complete repository;
3. verify generated structural-validator bytes;
4. build and typecheck the workspace once through a cache-read-disabled Turbo graph;
5. run every package's complete test suite once with controlled concurrency;
6. run all 105 proof verifiers directly in the reviewed order, ending with the M10-T05 Desen App
   published-host-update proof;
7. run all 105 root proof and mutation files as separate fail-fast processes; and
8. run the dependency graph and hostile boundary fixtures.

The historical M09-T07 legacy expansion contains 4,437 leaf process invocations and 296 distinct
leaves. The historical M09-T10 expansion contains 691 prerequisite segments, 4,477 ordered leaf
process invocations, and 305 distinct leaves. The current M09-T12 optimized gate contains all 196
registered workloads. Its exact legacy expansion remains machine-generated authority. Repeated prerequisite
checks inside proof builders remain intact because those checks are evidence, not orchestration
overhead.
The current M10-T05 expansion contains 735 prerequisite segments, 4,539 ordered leaf invocations,
329 distinct leaves, and 220 registered workloads.
The measurement recursively expands exact root-level `pnpm <script>` references beginning at
`check`; commands with no further local root-script indirection are leaves, and the distinct
inventory is sorted before hashing.

## Fail-closed invariants

The gate refuses to run when any of these conditions changes without an explicit review:

- the 105 task IDs, verifier files, root test files, or their order;
- any of the 735 legacy prerequisite command segments;
- the exact 220-step normalized execution plan;
- a focused package test that is no longer included by its full package suite;
- any drift in the reviewed `test` command of any workspace package, including packages without a
  focused prerequisite;
- any byte or package-glob drift in `pnpm-workspace.yaml`; the reviewed graph roots are exactly
  `apps/*` and `packages/*`;
- a root or app/package `vite.config.*`, `vitest.config.*`, or `vitest.workspace.*` file, or a
  `vitest` field in the root or any workspace package manifest;
- an unknown package, task, prerequisite, executable, or shell expression;
- shell metacharacters, operators, quoting, or escaping hidden inside a workspace package test
  command;
- a generator, writer, changed-file filter, or affected-only shortcut; or
- the tracked working-tree bytes, executable modes, tracked-file count, or Git index object IDs
  before and after the gate.

Proof generators and evidence writers are never CI inputs. Proof output and success are never read
from cache. Timing data is observational and cannot influence pass or fail.

The historical M09-T07 prerequisite inventory is pinned as
`sha256:0ca9fcc3176df5b6707e2b704d0e3aa4dd4288bc3b7f813461d90ef3397c5d80`.
The ordered 4,437-entry legacy leaf-invocation inventory is pinned as
`sha256:d4cea0955703f00540994ecdaac6d5cdca4f9f1bb3037c7ba038da67d9991e7a`; its sorted
296-entry distinct-workload inventory is pinned as
`sha256:ddc6aa4a631dd92edb762c52d06277eec262b89f5e062e9c199a3c15f423304f`. The retained
plan/projection is pinned as
`sha256:fc2320e67fab4582f8eb4deead2e7048cd207577c965931440a83daeefb9de79`.
The scheduler-neutral historical M09-T07 successor inventory is independently pinned as
`sha256:67e537ed19f3518561909a342fa79e06d0f9adc49436aaf6c9816be1c840cb6f`.
Its exact workload-id set is pinned as
`sha256:2ec8ce76c133230f1f16464ec2c46fff616e0179d480aa601decf34adeb7f4aa`, and its ordered
id/label/command/argument equivalence projection is pinned as
`sha256:43cfaf9c54b29a56d2111267cbc923ff5488d3ef2a1112e0cc0aca2990e9feba`.
The historical M09-T10 prerequisite inventory is pinned as
`sha256:ec52c27dbc9ea1db400cae2fa1ec7ab7b58b468eb83ee396ea7c082107fc06cb`. Its ordered 4,477-entry
legacy leaf-invocation inventory and sorted 305-entry distinct-leaf inventory are pinned at
`sha256:f167a05bbac9b7959ed6f179e2adacef3382d21a6e6056c568aeddab891a58ec` and
`sha256:a91f9e647b3a4bfcd8a45e2fe473b0c86a7acd2edc450897eab851e2dca47fc5`. The retained quality
plan is pinned at `sha256:c038b0292d6caadb182862315369448dcd505ec926251e0e2aef8cf90d78b58f`, while the
scheduler-neutral inventory is pinned at
`sha256:853175eac4b6da232424cc6f47ad8455db3970ae1a72744bf7324b56403bf59f` and the semantic impact
graph at `sha256:4476d5162c2457d991d17c5c9cb450a838c8b084abff634b8fa4195f89465602`.
The historical M09-T11 prerequisite, ordered-leaf, distinct-leaf, retained-plan, neutral-inventory,
workload-set, and impact-graph authorities are respectively
`sha256:4c086021423a728182e484e4ca218f419b58ae66a0b1a6607f1c5f4a1d677f09`,
`sha256:3daf978eeb28f95aa523c54f5c1ad19cdb4fe81add9a53a971996f550f33e1cb`,
`sha256:239097eb37432275fe71f5a14d8f6ec8688be5db11a2961cf8e8b503e8bcb175`,
`sha256:397b9268dfe5e4c0dd22229ab95027f65278f1314eed16dd81fa9b5c66d346a5`,
`sha256:82b41b49abfd3b97f695af068e66168374ad2e994c7100b4442d06984032c7fc`,
`sha256:4a33777d8bb5cf515137b6539eaefab36229c5c345848bbc6be1d7a55b132acf`, and
`sha256:d028537891400c806dff4f7a4d7be3b3e783381369052b7d8079fdfd10759b73`.
The current M09-T12 neutral inventory and semantic impact graph are pinned at
`sha256:c1d3eb2b4b56e9a97d700f89ac0c0ff9c24bf158c3d18bd8e3d40c9c52b63eb7` and
`sha256:97099a5cb52895eb80d095e99bf18838688d8a0aecf7af49993f0077466558c5`. The full prerequisite,
leaf, retained-plan, workload-set, selector, and runner projections remain machine-owned
authorities and are not inferred from these two digests or aggregate counts.
The exact current CI contract, prerequisite, ordered-leaf, distinct-leaf, retained-plan,
workload-id, ordered-equivalence, T12-closure, required-plan, and shadow-plan authorities are
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
artifacts and 94 current readers. The promoted selector and independently verified required runner
are pinned at `sha256:ff4cdbac5be5b545843ca1aaf9842630e41e4f96e3cfccfa67d10e62436f93c6` and
`sha256:727e48f526547f6630d369b53b52da511bb1fb61389bbca1c36a757ad018bf93`.
The exact current Design/Run affected-selection plan is independently pinned at
`sha256:a59b853be95d7c834821d48786c8d3579552cb0eaebc571232cc06b43f4a9f4a`.
The 51-checkpoint manifest reseals changed reader indexes 70–93. Its appended T12 proof library and
root reader are exactly 56,014 bytes at
`sha256:18c759c87011e4ed30b044eaa02b9ccf2cc9e4134c33f7cfd0f292070ffc5add` and 23,578 bytes at
`sha256:baee083f499523e8d5ea47b322f2d1c162097c27b95897946e72dcb25e99f033`.
The historical M09-T07 selector-only semantic impact graph is pinned independently as
`sha256:905d22e40524d26eac056ca32236f0948910a7ac6049b0d35c644f19e629d668`.
The historical M09-T07 successor contains 176 proof-owned reader paths across 1,192 tracked paths.
Its exact path set is
`sha256:b9e2f0069bb8d0eba4738749245cc309d08cefff5ffe6ca18bd3356fcaa5e3e5`, and its complete
ownership projection is `sha256:3561ac8305b7b34cfef0975abe5899aa54e637a4747ac0fa76bd39a129ce9f03`.
The eight ownership-category counts are `176 / 45 / 31 / 132 / 460 / 213 / 124 / 11` for
`PROOF_UNIT`, `CI_POLICY`, `DEPENDENCY_POLICY`, `FROZEN_INPUT`, `PACKAGE_OR_APPLICATION`,
`SHARED_PROOF_INFRASTRUCTURE`, `PROJECT_DOCUMENTATION`, and `REPOSITORY_POLICY`, respectively.
The historical M09-T08 and M09-T09 successors contain 178 proof-owned reader paths across 1,202
tracked paths and 180 proof-owned reader paths across 1,212 tracked paths respectively. The
historical M09-T10 successor contains 182 proof-owned reader paths across 1,218 tracked paths. Its eight
ownership-category counts are `182 / 45 / 31 / 135 / 468 / 219 / 127 / 11` for
`PROOF_UNIT`, `CI_POLICY`, `DEPENDENCY_POLICY`, `FROZEN_INPUT`, `PACKAGE_OR_APPLICATION`,
`SHARED_PROOF_INFRASTRUCTURE`, `PROJECT_DOCUMENTATION`, and `REPOSITORY_POLICY`, respectively.
Its exact path set and ownership projection are pinned at
`sha256:75f780c0c2afdfdaedfdd653cc3f36128dc968639d536085eb9b52a72f5f7de6` and
`sha256:eee064ac0466c87d117b4219ad76365fda288a980c61ab701342f0514777c9ab`.
Its exact path set, category projection, selector, and runner digests remain machine-verified CI
authorities rather than values inferred from those totals. The historical M09-T11 successor contains
184 proof-owned reader paths across 1,232 tracked paths. Its path set and ownership projection are
`sha256:3d77bb0de542b1d153deb9fb87f2ba5adbc45e2153d9b156074026b04a755fff` and
`sha256:86e1d1555580e1496686f11858c1bd4b69ce7b0f84a429b930ee9dc1c0f1f153`; category counts are
`184 / 45 / 31 / 136 / 476 / 221 / 128 / 11` in the order above. The prior M08-T10 and
M09-T01–M09-T10 ownership receipts remain historical rather than being presented as the M09-T11
successor. The current M09-T12 successor contains 186 proof-owned reader paths across 1,243
tracked paths. Its path set and ownership projection are
`sha256:f216ba32517fd708d24b9d78035894e20951f5cd420d419a66e5ce0b813881c5` and
`sha256:6511d79ff42cb84dd303f771b821a061cd89c72462dddf2ccd3966397c602983`; category counts are
`186 / 45 / 31 / 137 / 481 / 223 / 129 / 11` in the order above.
The preceding M07-T03 retained/neutral workload-set equality receipt remains historically pinned as
`sha256:49977fca154b0bf06639b8e3f0b667d04e060603cc14ec99660c8c434b7f5edb`, and its ordered
projection is pinned as
`sha256:0cf74075304304385594ae6c7def89c76f22a82be3059bc0841f408682f198f8`; it is historical, not
the historical M08-T10 authority. The historical M09-T07 authority-specific required plan is pinned as
`sha256:00c0fbb14b15bf898872ba09b61c9a3d8995f60f42cf1bf894a0acb096dc2490`; the
non-authoritative shadow form is pinned separately as
`sha256:952fd6519a0746c0849716fad300badaa84f2bf5fe4914f97662546cd5a122dc`.
The historical M08-T10 selector and required-runner authorities remain authenticated by the frozen
I07-04 promotion artifact. The historical M09-T07 selector is
`sha256:5301aedd0f4e7fe44bb07f67d6dd0dfaeea08cbc7ecd431ddf619345805656d0`; its required-runner
authority is independently pinned as
`sha256:7b660497db1d82411a1e6c223d9225c5608ceb1cf25daddc9cc84de49661b559` and is not inferred
from selector success. The frozen promotion baseline's selection-equivalence receipt remains
`sha256:97cc1b29553f1bf3d92386e399c76f2f9c21e73a1c8073a15a9465f7c4fcf698`, and its observation
threshold remains
`sha256:ca6ee4128f2dbc581d033ebabe8e437268c8f7c5b29d6fbc7f9e3fb031b6c23c`.
The historical M09-T10 selector and required promotion-runner authorities are independently pinned at
`sha256:2b961ae5105aa1959f7983f37f83b15f9dd030c052cc547069c2acab54ff0761` and
`sha256:bc45f16ec8cec627f13ddda6faa29e3cc4b443618748b2475039490ad50fdb5d`; neither is inferred
from the other's success.
The historical M09-T11 required plan, shadow plan, and selector authorities are independently pinned
at `sha256:e0933cb5f272fbc2aba058ac5a6c256a23f14bc4cfe8018c8b919c3851f92cac`,
`sha256:01aadef839eec54e43b252d4bdfea183ac0256806399d3f71c898451fa7a33ff`, and
`sha256:be2ef9371615a503515df2d111107b8c885c6661b95b24d71ebc56c99991672a`; the required runner
remains an independent machine-verified authority and is not inferred from selector success.
The independently promoted M09-T11 selector and required-runner authorities are
`sha256:b97d10bd27576ed5fc543dfd94fe7981cf2cf7bc2159aa6d431e2100312a6819` and
`sha256:a9e640b59786e2ee8f16c7bbd1f14be895d1ec71050f25a8fca6ffbe85104d6e`; neither is inferred
from the other's success.

The reviewed workspace package-test inventory contains 16 test scripts and is pinned as
`sha256:4d7c4232cc0e31519f2f58e9ebeb355405e493594406aee99ed2a78ce0c796ab`. One
application package currently has no package-level test command; that absence is part of the
same exact inventory rather than an implicit exemption.

The workspace manifest itself is pinned as
`sha256:6c693fc7e2b55dfc4b2e84a9e267aef0b6aeecb3160a04cdba67ce570f860be9`; this
prevents an otherwise valid package manifest from being omitted from pnpm and Turbo discovery.

At the M07-T01 checkpoint, the frozen inventory contains 61 proofs, 387 prerequisite segments,
1,781 ordered leaf invocations, 202 distinct leaf workloads, and 130 normalized single-pass
steps. Twenty-four independent orchestrator contract tests protect that exact profile. The
prerequisite inventory is pinned as
`sha256:bfce7beb80d98b29a21c43263c422e87218738ed0c040e6a45c60a35fb8f8290`; the other
historical digests remain in the immutable I07-02 baseline and ADR 0011 rather than the live pins
above.

The preceding M07-T08 successor contained 68 proofs and 144 normalized single-pass steps. The
historical M07-T09 working-tree successor contained 69 proofs, 455 prerequisite segments, 2,769
ordered leaf invocations, 227 distinct leaf workloads, and 146 normalized single-pass steps. The
historical M08-T01 successor contained 72 proof pairs, 489 prerequisite segments, 3,129 ordered leaf
invocations, 242 distinct leaves, and 153 normalized single-pass steps. The historical M08-T02
successor contained 73 proof pairs, 499 prerequisite segments, 3,155 ordered leaf invocations, 245
distinct leaves, and 155 normalized single-pass steps. The historical M08-T03 successor contained
74 proof pairs, 509 prerequisite segments, 3,191 ordered leaf invocations, 248 distinct leaves, and
157 normalized single-pass steps. The historical M08-T04 successor contained 75 proof pairs, 519
prerequisite segments, 3,237 ordered leaf invocations, 251 distinct leaves, and 159 normalized
single-pass steps. The historical M08-T05 successor contained 76 proof pairs, 529 prerequisite
segments, 3,293 ordered leaf invocations, 254 distinct leaves, and 161 normalized single-pass
steps. Its historical prerequisite, ordered-leaf, distinct-leaf, and retained-plan pins were
`sha256:fefcdb176405d3dc66930f01b8b6586e00b5a81ab271add0e5f8aac20ce39a75`,
`sha256:24d534858d325d5a0799c45c0adb9872cb54167adf92a2244ab798a49b57c25e`,
`sha256:c7754b1ca350563560e508916af68882da43bf7c85d27f05648cdaa4a4f47ffd`, and
`sha256:74e8fef5c4e998856b3a3027a4fc976c5a96a087c26c6a6e9088442fa633549a`; its neutral inventory,
workload set, ordered projection, impact graph, required plan, and shadow plan were
`sha256:ae790f14c376a1fb449e34877a08abba164677ef413583248e5f609f3c7bb292`,
`sha256:17630eafb4fb762edde445422935f790cbf89af115a2cae72b3d78a9fa8225e4`,
`sha256:9cce0949084c83c6447da139ab423bc1189a867d0c83f7a10f9a261f6d814faf`,
`sha256:9fb786d80ac21bef4dc89c9a77986f91dd50c9ff53dd2d54c7a52d5c4ac8738f`,
`sha256:9f7ef05e606afb293b42c650acfcf043d638cd429e07fdee55d01d241f06bf1b`, and
`sha256:5659be49a219445ee559b614ffbcea58d50fe287b954ff2e5f4cdc038519f3ae`. Its affected ownership
covered 1,071 paths at `sha256:ae070076003f9ae641a6682aab6280336b7d2ccf6ccd6b96d15b3c10c6cd6c18`, including 152
proof-owned paths, with projection
`sha256:d793913bca281e2127151c83ce570ce415c995da42013226731d030b337fc2c0`. The historical M08-T06
successor contains 77 proof pairs, 539 prerequisite segments, 3,359
ordered leaf invocations, 257 distinct leaves, and 163 normalized single-pass steps. The immutable
I07-02/M07-T01 and M07-T09 receipts retain their original values; no post-cutover successor
rewrites them. These M08-T06 pins are local code-owned historical authority and make no hosted
M08-T06 claim.

The historical M08-T07 successor contained 78 proof pairs, 549 prerequisite segments, 3,435
ordered leaf invocations, 260 distinct leaves, and 165 normalized single-pass steps. Its
prerequisite, ordered-leaf, distinct-leaf, retained-plan, neutral-inventory, workload-set,
ordered-projection, impact-graph, required-plan, and shadow-plan pins were respectively
`sha256:cff21c5dd6e483906cb70a86fe475cf5df913b8721de199dac2e16135905c98e`,
`sha256:a05490316408114e99a790018bedbfcb8783286883ddbdd47376251273cf0425`,
`sha256:302317ed31512f705377338d780dcc5dd352c81cde37f6ff06f91f0db32693fd`,
`sha256:c6cf645412661a81e2976e88080d23d6fe0fa4889ef4b07432e4a47de684e25d`,
`sha256:8220259aa2a44774d192ea2420f4c2f8423c9dedd93a1fcf9b34340a0ab0dcd3`,
`sha256:9ea3b95ab6f034473765beb9edb1482532bb1a0b4e05f630c403d38d8df0daef`,
`sha256:fc588358d8fa3b2e7c2cd9f3a280715d7db34089a41a2fae2c3484d18c040278`,
`sha256:5aa20b4fb87decc51221bca5a900677d7dfddd1e61c068d5e91420253a3236b2`,
`sha256:5484324b6d22a5e58bce2431f35382aeeb4e97095c96524e5bdb6211f8650a9e`, and
`sha256:4beeca9ed27e2e7942951cf0cf014fb7bebca2bcf2f8f69ff0819580aeff3c87`.
Its 1,088-path ownership set, 156-proof-path projection, selector, required runner, and workspace
script pins were
`sha256:227cb892270c669646eec89a44243af8e3da5a51bfec8f8e560e2d765c0f2e79`,
`sha256:d43335b91aa9f3da0571ed2e32e92ea65da81bbcc5efee1aa32bdac30967217d`,
`sha256:cbd1cce71828ad4ad1c22ede5e6152e5e3130031afebcb1d9c23e32ba55eb7dc`,
`sha256:9da49a38efa09a48ded3290ba9c2ec4ae57a967d325e61320f39be561b93f9a4`, and
`sha256:0faa6116c99d11f6d059a224de6b08a723657b5c5690a3138e6290d240524820`.
These historical pins remain local authority and make no hosted M08-T07 claim.

The historical M08-T08 successor contained 79 proof pairs, 571 prerequisite segments, 3,651 ordered
leaf invocations, 267 distinct leaves, and 168 normalized single-pass steps. Its frozen local
receipts remain append-only and make no hosted M08-T08 claim.

The historical M08-T09 successor contained 80 proof pairs, 581 prerequisite segments, 3,737 ordered
leaf invocations, 270 distinct leaves, and 170 normalized single-pass steps. The historical M08-T10
successor contained 81 proof pairs, 593 prerequisite segments, 4,049 ordered leaf invocations, 273
distinct leaves, and 172 normalized single-pass steps. The M09-T01 successor contains 82
proof pairs, 601 prerequisite segments, 4,369 ordered leaf invocations, 278 distinct leaves, and 174
normalized single-pass steps. Its reviewed receipts remain historical and make no hosted M09-T01
pass claim. The historical M09-T02 successor contained 83 proof pairs, 611 prerequisite segments,
4,381 ordered leaf invocations, 281 distinct leaves, and 176 normalized single-pass steps. The
historical M09-T03 successor contained 84 proof pairs, 621 prerequisite segments, 4,393 ordered leaf
invocations, 284 distinct leaves, and 178 normalized single-pass steps. The historical M09-T04
successor contains 85 proof pairs, 629 prerequisite segments, 4,403 ordered leaf invocations, 287
distinct leaves, and 180 normalized single-pass steps. Its reviewed inventory and plan pins are the
historical authorities above; they make no hosted M09-T04 pass claim. The historical M09-T05 successor
contains 86 proof pairs, 641 prerequisite segments, 4,417 ordered leaf invocations, 290 distinct
leaves, and 182 normalized single-pass steps. Its reviewed receipts remain historical and make no
hosted M09-T05 pass claim. The historical M09-T06 successor contains 87 proof pairs, 649
prerequisite segments, 4,427 ordered leaf invocations, 293 distinct leaves, and 184 normalized
single-pass steps. The historical M09-T07 successor contains 88 proof pairs, 657 prerequisite
segments, 4,437 ordered leaf invocations, 296 distinct leaves, and 186 normalized single-pass steps.
The historical M09-T08 and M09-T09 successors contain 89 proof pairs/188 workloads and 90 proof
pairs/190 workloads respectively. The historical M09-T10 successor contains 91 proof pairs and 192
normalized single-pass workloads, split into 80 ordinary pairs and 11 barriers. Its exact
prerequisite and leaf expansion remains a machine-generated authority and is not inferred from
those counts. Its required, shadow, workload-set, and ordered-equivalence projections are pinned at
`sha256:cffce400b6a3793d3e42051508425bf81a0c66923b6e579d40ac82b836e8daec`,
`sha256:55a04119bc9b6a3041d24ede83d36613ac7dac98cd871cded240387952ce750e`,
`sha256:997c1d93c209defe69668b4ac913078f7d2e2c7c1d807900e589b54e1af38a43`, and
`sha256:d202066339b60259cbb07705702e0cebf1773c8577aa12f2d3328cd515eb0273`. These local receipts
make no hosted M09-T10 pass claim. The historical M09-T11 successor contains 92 proof pairs and 194
normalized single-pass workloads, split into 81 ordinary pairs and 11 barriers; its exact
projections remain code-owned and are not inferred from those totals.
The current M09-T12 successor contains 93 proof pairs and 196 normalized single-pass workloads,
split into 82 ordinary pairs and 11 barriers. Its connected closure contains 60 proof units and
130 workloads; exact projections remain code-owned and are not inferred from these totals.

`SIGINT` and `SIGTERM` become permanent cancellation state, are forwarded to the active process
group, stop later steps, and preserve exit codes 130 and 143. This prevents a superseded workflow
from leaving child or grandchild processes behind or turning cancellation into success.

## GitHub Actions trust boundary

The workflow:

- uses immutable full commit SHAs for GitHub-owned actions;
- grants only read access to repository contents;
- does not persist checkout credentials;
- cancels superseded work for the same branch or pull request;
- prevents external forks from reading or writing the trusted dependency cache;
- allows same-repository pull requests to restore but not save that cache; and
- saves the dependency cache only after a successful `main` push.

The pnpm store is a dependency download cache only. Builds, typechecks, package tests, verifiers,
mutation tests, and boundary checks run fresh.

## Updating the gate

When a proof task or prerequisite is added:

1. keep its task-specific root scripts intact;
2. add its verifier and root test to the frozen proof inventory;
3. classify every prerequisite and prove focused tests remain inside the full package suite;
4. review every workspace package's exhaustive Vitest command and keep test configuration absent;
5. review the normalized plan for generators, writers, filters, duplication, and missing work;
6. intentionally update the prerequisite, leaf-invocation, distinct-workload, workspace-test, and
   plan SHA-256 pins;
7. run the orchestrator contract tests and the complete single-pass gate; and
8. record the hosted run URL and timing before reducing the timeout.

Changing a pinned digest without reviewing the corresponding readable inventory is not an
acceptable update.

## I07 modular migration

### Historical I07-01 checkpoint

I07-01 added a non-authoritative `SHADOW + EXHAUSTIVE` candidate beside this gate. The candidate
imported this gate's validated proof inventory and exact normalized plan rather than maintaining a
second command list. It executed every global step and every verifier/root-test pair from fresh
inputs. Candidate proof pairs could run with concurrency two only while the sequential result
remained authoritative. It did not select by changed paths, read cached proof success, generate
evidence, or write tracked files.

The shadow also validates one hash-chained current-reader checkpoint whose genesis digest is pinned
outside the manifest by the I07-01 baseline. Frozen task artifacts remain the historical claim
authority; the checkpoint records reviewed live proof/test readers that can legitimately receive
security hardening after task completion. The checkpoint never chooses a command. Executable
verifier/test ownership remains in reviewed code.

The existing sequential gate remained the sole pass/fail authority throughout that checkpoint.
The archived I07-01 local and hosted comparisons are historical evidence, not I07-02 cutover
evidence.

M07-T02 later appends reviewed current-reader checkpoint sequence 3. Its head
`f92e879b3a72e75abb07af2b2bcfded62e014b99aa0cbe69c64aee12d5379882` authenticates nine frozen
artifacts and eighteen live readers without rewriting either historical checkpoint. M07-T03
appends historical sequence 4; its head
`ee2d72c3529d9295945d339fb214c41dbbf906ffa6613a7ad6e766ec79c1bcf5` authenticates ten frozen
artifacts and twenty live readers without rewriting any predecessor. A corrective M05-T04
current-reader append after M07-T03 established historical sequence 5; its head
`7df3631d509ed7e65c571566a825d6d3cd52d336e1a74512bf3e8e26920749b3` authenticates eleven frozen
artifacts and twenty-two live readers. Sequence 6 only advances the M06-T11 proof/test receipts for
a bounded, explicit 20-second nested Vitest timeout; its then-current head `790ad28b6fd441e6d5f40f277a97e8de36a178a9e50fff3e208e6c27588915fd` still
authenticates eleven frozen artifacts and twenty-two live readers. It changes no coverage,
assertion, concurrency, frozen evidence, workload/proof count, progress, or plan digest, and
sequences 1–5 remain byte- and hash-unchanged.

Reviewed checkpoint sequence 7 links predecessor head
`790ad28b6fd441e6d5f40f277a97e8de36a178a9e50fff3e208e6c27588915fd` to its then-current head
`d50b5ee4fb265f241bac7652b979af0146d530528ba6db8fc98c8fb3225a5ba5`, authenticating 13 frozen
artifacts and 26 live readers. It adds the 34,612-byte M07-T04 artifact
`sha256:29555326d51073c50937519d8706049ad17287079cc3ef4dc7060bb3a3225394`, live T04 proof/root and
current M05-T06 compatibility readers. It seals the exact final receipts of the complete 26-reader
live set after all T04 compatibility bridges and the reviewed CI timeout calibration, including
current M05-T09, M06-T01/T05/T08/T09/T10/T11, and M07-T01/T02/T03 readers. The frozen M05-T06
artifact remains byte-identical and historically
`PARTIAL`; live P-17 is `PROVEN`. Sequences 1–6 remain unchanged. This local reviewed checkpoint
does not claim a new hosted CI run.

Reviewed checkpoint sequence 8 links the exact sequence 7 head
`d50b5ee4fb265f241bac7652b979af0146d530528ba6db8fc98c8fb3225a5ba5` to its then-current head
`f707fb4c3338aeda79eb6242b645b5e864ce54b1e3955373e8edebcd7e026b8a`, authenticating 14 frozen
artifacts and 28 live readers. It adds the 41,945-byte M07-T05 artifact
`sha256:144e8a46b3b41a1f98a022bf4c16dddb9d7415af4e5033322484d4bdd49c55b9`, its 73,915-byte proof
reader `sha256:f66d40863a46dd7ed9e28afb2c78f8afbda8aee964e72d4fba60e65e55a351b3`, and its 17,291-byte root
reader `sha256:490d4f922ea41dc7bca178cc54ab938ab136f0b922d7842af623001eabf60a65`. Prior live receipts,
including current M07-T01 through M07-T04 and reference-host source-audit compatibility readers,
are resealed after the T05 compatibility changes. Sequences 1–7 and all predecessor frozen
artifacts remain unchanged. This local reviewed checkpoint makes no new hosted CI claim; I07-04
still owns removal of the remaining compatibility-reader debt.

Reviewed checkpoint sequence 9 links the exact sequence 8 head
`f707fb4c3338aeda79eb6242b645b5e864ce54b1e3955373e8edebcd7e026b8a` to its then-current head
`94f48160552a6e0de702f71200e56c23d61bab8692d43f3ac1104dcfa681568b` with the same 14 frozen
artifacts and 28 readers. Exactly reader indexes `[16, 17, 18, 19]` change: M07-T02 proof
94,612 bytes / `sha256:4c69fa253ba2d9432a75c6c6aaa2ad69e23c3683c43dae9c92dc73b3208937d9`;
M07-T02 root 20,959 bytes / `sha256:fdcfc8c4868c1ee084b652e42c7dab4750bc569c4c05928dde7136118b4689ed`;
M07-T03 proof 86,174 bytes / `sha256:5624b06d8d0962d18c9a920a34a95b0023f4909d8c7b7812057bedcdc62ab5ab`;
and M07-T03 root 21,119 bytes /
`sha256:10c1a677b88b5c6bd4389e659ce38f11a627ae92de4aafe4ffade0de23790f11`.
The minimal T05 compatibility bridges authenticate the current shared strict-JSON internal
source/distribution and exact T03 → T04 → T05 aggregate adjacency while projecting the unchanged
frozen T02/T03 artifacts. Sequences 1–8 and all frozen artifacts remain unchanged. This is reviewed
local evidence only, not a hosted CI claim; `DEBT-I07-012` cleanup remains owned by I07-04.

Reviewed checkpoint sequence 10 links the exact sequence 9 head
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

Reviewed checkpoint sequence 11 links the exact sequence 10 head
`bd3f5b90656f0e41d7f6aa439fdc01889e9ebeada26cd3caf8624c3ce1db7d07` to its then-current head
`63b8af4da431f0918c7ea9480564750bd12057af2bc83c294d962113ce7c9be8` with the same 14 unchanged
frozen artifacts and 28 readers. Only indexes `[26, 27]` change: the M07-T05 proof reader is 77,034
bytes at `sha256:c704e25024eaf7bdf317cc144f6b85922a3fe73a24c9c91e639ede032e22eb6f`,
and its root reader is 17,578 bytes at
`sha256:4871c406390c4c9b36bff1c417a6c8dd22798736ea8daad1c63a3cbd0a978389`. Sequences 1–10 and every
frozen artifact remain unchanged. This is a reviewed local-reader checkpoint and makes no hosted
CI claim.

Reviewed checkpoint sequence 12 links the exact sequence 11 head
`63b8af4da431f0918c7ea9480564750bd12057af2bc83c294d962113ce7c9be8` to its then-current head
`85c49a0d79346bf2ea92b716f6b43c5d95d164209e3d67af34871a334686e10e` with the same 14 unchanged
frozen artifacts and 28 readers. Only indexes `[26, 27]` change: the M07-T05 proof reader is 77,507
bytes at `sha256:e2050408c5bf3e084eacd6e42880310dafbfdf03b79821500cc0567b998f7d66`,
and its root reader is 17,716 bytes at
`sha256:061b40ea20e0f7ee362f26bd54db954c3caea338df5e2f090ce34a4618ac37cc`. This successor authenticates
the exact ADR token-bound documentation update while the M07-T05 artifact and every other frozen
artifact remain unchanged. This is reviewed local-reader evidence; hosted CI has not yet been
claimed, and I07-04 still owns the compatibility-reader debt.

Reviewed checkpoint sequence 13 links the exact sequence 12 head
`85c49a0d79346bf2ea92b716f6b43c5d95d164209e3d67af34871a334686e10e` to its then-current head
`146b04f1c8209be64168afb451ceee2c422da0cdced116f8d08beafe795c533c` with the same 14 unchanged
frozen artifacts and 28 readers. Only index `[9]` changes: the M06-T09
publisher-bundle-publication root reader is 63,859 bytes at
`sha256:ae7b688d904b4c77632fd78e0ee23b2264eae1574b4350306b5e2ec1b9974b8d`. A hosted
required-exhaustive attempt exposed two stale M07 successor/current-receipt assertions in that
reader; after the narrow reader-only correction, its focused root passes 112/112 and the frozen
M06-T09 artifact remains unchanged. This is reviewed local-reader evidence, does not claim hosted
CI success, and leaves the compatibility-reader debt with I07-04.

Reviewed checkpoint sequence 14 links the exact sequence 13 head
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
`[32]` (`sha256:08f143107430dde90cf1865c21d7ce1ec854897b0c1c4306b96525bdd0d18daa`) plus the 24,939-byte root
reader at `[33]` (`sha256:b97e7991e0ac20e7232112594228fdd829a536e81d16d06fd3f909e7e3a02492`).
Sequences 1–16 and all 16 predecessor artifact files remain byte-identical. This reviewed local
reader checkpoint makes no hosted M07-T08 claim. `DEBT-I07-015` assigns the temporary historical
recovery-reader bridges to I07-04 for removal by G07.

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

Reviewed checkpoint sequence 22 preserves sequence 21 as immutable history and links predecessor
head `ce12c066545e21779abf891898aaf0b09ceb1c0c1b51be382a0adabd5f86e939` to current head
`aef9881c8fc540873f889a09754e5f2c19adc3c19934ba0fcfcf5e6a12b2da9e`. It continues to
authenticate the same 18 frozen artifacts and 36 reader identities. Every frozen artifact byte is
unchanged; only workflow-dependent reader indexes `[8, 10, 11, 12, 14]` are resealed for I07-03.
This append is current-reader compatibility evidence, not a rewritten historical proof.

The contract preflight now executes a dependency-free one-test M07-T09 Vitest probe under the
production proof-step isolation. The shared launcher invokes the repository-local Vitest CLI with
`process.execPath`, writes owner-only package/workspace/config/test files only inside the step temp
root, preserves the scheduler-owned Node permission boundary, and performs unconditional cleanup.
This catches package-manager lookup, permission, and config-discovery regressions before ignored
build outputs exist. The full T09 verifier remains in the 146-workload exhaustive phase after its
build-producing prerequisites.

The T08 proof reader authenticates exact AST structures for both executable CI registrations and
shared-state mappings, then binds their effective flow with code-owned exact source receipts. It
uses the same exact-receipt rule for the direct 12-case runtime, 14-case compiler-negative, and
9-case root sources; all authority-file inputs cross bounded identity-safe reads.

### I07-02 required-exhaustive architecture and completed cutover

`exhaustive-workload-inventory.mjs` is now the neutral executable authority. It validates the
repository inputs and owns all 192 ids, labels, shell-free command/argument vectors, dependencies,
execution classes, and inert shared-state records without importing either scheduler. The retained
legacy sequential implementation is a rollback mirror. The rollback-only
`required-exhaustive-equivalence.mjs` adapter compares its exact ordered plan against the neutral
inventory, proves set equality and exactly-once ownership, and retains the reviewed plan digest.
It cannot turn either source into executable authority.

The equivalence adapter also normalizes terminal receipts. PASS requires all 192 exact workloads
to report PASS after an observed close and requires the tracked-workspace digest to remain
unchanged. Missing, duplicated, skipped, not-run, cancelled, timed-out, failed, or unclosed work
fails closed. Inventory, workload, workspace, cancellation, and timeout are distinct terminal
authorities; timing and concurrent sibling completion order are observational only.

The exhaustive plan factory accepts no scope except `EXHAUSTIVE`, defaults to `REQUIRED`, and
requires `SHADOW` to be explicit. The official pull-request and `main` workflow now invokes that
runner without an authority override, so its fail-closed default is `REQUIRED`. The exact 4,994-byte
workflow is pinned as
`sha256:04429211188d351ee720c1e64802d48e34e425348b397c4bb835ba5c1fe4ccf5`.
The retained sequential runner is not an automatic peer: it runs only when a trusted operator
manually dispatches `legacy-rollback`. Event name and mode are part of the concurrency key, so a
rollback exercise cannot cancel a pull-request or `main` authority run.

All 194 workloads have one exact shared-state class:

| Execution class                  | Count | Scheduling rule                                      |
| -------------------------------- | ----: | ---------------------------------------------------- |
| `GLOBAL_EXCLUSIVE`               |     6 | Drained repository-wide barrier                      |
| `WORKSPACE_OUTPUT_EXCLUSIVE`     |     3 | Workspace and public-package output writers          |
| `PACKAGE_TEST_EXCLUSIVE`         |     1 | Drained complete package-test barrier                |
| `PROOF_READ_ONLY`                |    79 | No shared workspace writes                           |
| `PROOF_OS_TEMP_ISOLATED`         |    94 | Writes only to a workload-owned OS temp root         |
| `PROOF_TRACKED_ALIAS_EXCLUSIVE`  |    10 | Real tracked aliases under a drained scheduler       |
| `PROOF_WORKSPACE_TEMP_EXCLUSIVE` |     1 | Direct source-audit workspace-temp root-test barrier |

Eighty-one proof pairs may overlap pair-by-pair at concurrency two after their predecessors pass. A
pair's root test still follows its verifier. Ten real tracked-alias pairs and the
`reference-host-web-source-audit` pair are the eleven exclusive barriers.
The normalized topology contains eight serial prefix workloads, 81 ordinary proof pairs, eleven
exclusive proof-pair barriers, and two serial suffix workloads: `8 + (81 * 2) + (11 * 2) + 2 =
194`. The serial `editor-web-public-package-contract` prefix owns the editor-web `dist`
writer after the editor-core public-package contract and before the M08-T08 verifier.

The added `control-plane-reference-preflight` pair is ordinary and non-barrier. Its verifier is
`PROOF_READ_ONLY`; its root mutation test is `PROOF_OS_TEMP_ISOLATED` and may write only to the
runner-owned OS temp root. Neither side receives workspace-write, port, or native-addon authority,
and the verifier receives no child-runtime-probe grant.

The added `control-plane-local-api` pair is also ordinary and non-barrier. Both its verifier and
root mutation test are `PROOF_OS_TEMP_ISOLATED`. The verifier receives the exact
`VERIFIER_RUNTIME_PROBE` child-process policy, while the root receives only the ordinary
`NODE_TEST_HARNESS` policy. Neither workload receives workspace-write or port authority. Only
those two exact workloads receive the native-addon grant required to load the reviewed SQLite
binding. Their OS-temp roots remain runner-owned and identity-checked.

The added `control-plane-runtime-staging` pair is ordinary and non-barrier. Its verifier is
`PROOF_READ_ONLY`; its root proof/mutation test is `PROOF_OS_TEMP_ISOLATED` and receives only the
ordinary `NODE_TEST_HARNESS` child policy. Neither workload receives workspace-write, port,
native-addon, or verifier runtime-probe authority.

The added `control-plane-runtime-activation` pair is ordinary and non-barrier. Both workloads are
`PROOF_OS_TEMP_ISOLATED`. The verifier receives the exact `VERIFIER_RUNTIME_PROBE` policy and the
root receives only `NODE_TEST_HARNESS`; both receive the narrow
`CONTROL_PLANE_RUNTIME_ACTIVATION_SQLITE` native-addon policy. Neither receives workspace-write or
port authority.

The added `control-plane-runtime-recovery` pair is ordinary and non-barrier. Both workloads are
`PROOF_OS_TEMP_ISOLATED`. The verifier receives the exact `VERIFIER_RUNTIME_PROBE` policy and the
root receives only `NODE_TEST_HARNESS`; both receive the separate narrow
`CONTROL_PLANE_RUNTIME_RECOVERY_SQLITE` native-addon policy. Neither receives workspace-write or
port authority.

The added `control-plane-runtime-fault-injection` pair is ordinary and non-barrier. Both workloads
are `PROOF_OS_TEMP_ISOLATED`. The verifier receives the bounded `VERIFIER_RUNTIME_PROBE` policy,
the root receives only `NODE_TEST_HARNESS`, and both receive the task-specific
`CONTROL_PLANE_RUNTIME_FAULT_INJECTION_SQLITE` native-addon policy. Neither receives
workspace-write or port authority.

The `control-plane-runtime-transition-races` pair is ordinary and non-barrier. Both workloads are
`PROOF_OS_TEMP_ISOLATED`; the verifier receives the bounded `VERIFIER_RUNTIME_PROBE` policy and
its task-specific SQLite native-addon policy. The root receives only `NODE_TEST_HARNESS` and no
native-addon authority. Neither receives workspace-write or port authority.

The `reference-host-web-channel-consumption` pair is ordinary and non-barrier. Both workloads are
`PROOF_OS_TEMP_ISOLATED`; the verifier alone receives the bounded runtime-probe, task-specific
SQLite, and authenticated loopback-child policies. Its root receives only `NODE_TEST_HARNESS`.
Neither receives workspace-write or a fixed/shared port grant.

The M08-T01 `editor-core-source-document` pair is ordinary and non-barrier after
`protocol-structural-validation`. Both workloads are `PROOF_OS_TEMP_ISOLATED` with separate
runner-owned roots. The verifier receives no child-runtime-probe grant, while the root receives only
the ordinary `NODE_TEST_HARNESS` policy. Neither receives workspace-write, port, or native-addon
authority. The separate serial `editor-core-public-package-contract` prefix owns its repeated
`dist` write and must close before the verifier.

The M08-T02 `editor-core-stable-id-insert` pair is also ordinary and non-barrier. Both workloads
are `PROOF_OS_TEMP_ISOLATED`, follow the same serial `editor-core-public-package-contract`
predecessor, and retain verifier-before-root ordering. Neither receives workspace-write, port, or
native-addon authority; only the root receives the ordinary `NODE_TEST_HARNESS` child policy.

The M08-T03 `editor-core-structural-edits` pair is ordinary and non-barrier. Both workloads are
`PROOF_OS_TEMP_ISOLATED`, follow `editor-core-stable-id-insert` plus the same serial public-package
predecessor, and retain verifier-before-root ordering. Neither receives workspace-write, port,
native-addon, or verifier runtime-probe authority; only the root receives the ordinary
`NODE_TEST_HARNESS` child policy. The pair verifies the exact 22,402-byte structural-edit artifact
at `sha256:0d44f67c316c21ff8b612221d01e81c76d3b24783164bb75a772985bbc7def8b`.

The M08-T04 `editor-core-content-edits` pair is ordinary and non-barrier. Both workloads are
`PROOF_OS_TEMP_ISOLATED`, follow the stable-ID and structural-edit prerequisites plus the serial
public-package predecessor, and retain verifier-before-root ordering. Neither receives
workspace-write, port, native-addon, or verifier runtime-probe authority; only the root receives
the ordinary `NODE_TEST_HARNESS` child policy. The pair verifies the exact 26,988-byte content-edit
artifact at `sha256:1726d453913c091d30229be02270a0cb4b74bf479f87027c4b9a0da3bb3c7066`.

The M08-T05 `editor-core-state-binding-edits` pair is ordinary and non-barrier. Both workloads are
`PROOF_OS_TEMP_ISOLATED`, follow stable-ID insertion plus current content-edit compatibility and
the serial public-package predecessor, and retain verifier-before-root ordering. Neither receives
workspace-write, port, native-addon, or verifier runtime-probe authority; only the root receives
the ordinary `NODE_TEST_HARNESS` child policy. The pair verifies the exact 30,014-byte
state-and-binding-edit artifact at
`sha256:b85e578ac2bc27897517f12d8d4cf867a089cd61ff9fd1ab0664c819977634f8`.

The M08-T06 `editor-core-event-action-edits` pair is ordinary and non-barrier. Both workloads are
`PROOF_OS_TEMP_ISOLATED`, follow the formal M08-T05 prerequisite plus the serial public-package
predecessor, and retain verifier-before-root ordering. Neither receives workspace-write, port,
native-addon, or verifier runtime-probe authority; only the root receives the ordinary
`NODE_TEST_HARNESS` child policy. The pair verifies the exact 31,310-byte event/action-edit
artifact at `sha256:05a7df153512b8dd0f8289991d12a9d12d79903ed8b3637ef6c8a450ca8a6be7`.

The M08-T07 `editor-core-authoring-round-trip` pair is ordinary and non-barrier. Both workloads
are `PROOF_OS_TEMP_ISOLATED`, follow the formal M08-T06 prerequisite plus the serial public-package
predecessor, and retain verifier-before-root ordering. Neither receives workspace-write, port,
native-addon, or verifier runtime-probe authority; only the root receives the ordinary
`NODE_TEST_HARNESS` child policy. The verifier independently reauthenticates all six frozen M08-T01
through M08-T06 editor artifacts before admitting the T07 round-trip evidence.

The M08-T08 `editor-core-persistence` pair is ordinary and non-barrier. Both workloads are
`PROOF_OS_TEMP_ISOLATED`, follow the serial `editor-web-public-package-contract` predecessor, and
retain verifier-before-root ordering. Both receive the narrow
`EDITOR_CORE_PERSISTENCE_SQLITE` native-addon policy. The verifier receives no child-runtime-probe
grant; only the root receives the ordinary `NODE_TEST_HARNESS` child policy. Neither receives a
shared workspace-write or listener-port grant. The proof opens no network listener: an explicit
fetch-shaped adapter dispatches loopback requests through Fastify injection into the same M07-T05
local Source route used by the real native SQLite authority.

The M08-T09 `editor-core-continuous-validation` pair is ordinary and non-barrier. Both workloads
are `PROOF_OS_TEMP_ISOLATED`, follow the serial editor-core public-package contract, and retain
verifier-before-root ordering. The exact five semantic impact parents are M08-T03 through M08-T07;
M08-T08 persistence is a sibling, not a formal parent. Neither workload receives workspace-write,
listener-port, native-addon, filesystem-compatibility, or verifier runtime-probe authority; only
the root receives the ordinary `NODE_TEST_HARNESS` child policy.

The M08-T10 `editor-core-terminal-integration` pair is ordinary and non-barrier. Both workloads are
`PROOF_OS_TEMP_ISOLATED`, follow the serial editor-core public-package contract, retain
verifier-before-root ordering, and close over every formal M08-T01–T09 proof parent plus the frozen
M04 `runtime-core-headless-sign-in` and `runtime-core-audit-hardening` proofs required by P-18.
Neither workload receives workspace-write, listener-port, native-addon,
filesystem-compatibility, or verifier runtime-probe authority; only the root receives the ordinary
`NODE_TEST_HARNESS` child policy. The conservative proof graph does not widen editor-core
production authority.

The M09-T01 `desen-app-shell-navigation` pair is ordinary and non-barrier and has the exact
M08-T10 terminal-integration proof as its sole semantic impact parent. Its verifier is
`PROOF_READ_ONLY`; its root mutation test is `PROOF_OS_TEMP_ISOLATED` and receives only the ordinary
`NODE_TEST_HARNESS` child policy. Neither workload receives workspace-write, listener-port,
native-addon, filesystem-compatibility, or verifier runtime-probe authority. The pair authenticates
only the bounded Desen App shell/navigation artifact; it does not grant editor, renderer,
persistence, diagnostics, Catalog, or publication authority.

The M09-T02 `desen-app-catalog-panel-layer-tree` pair is ordinary and non-barrier. Its exact formal
impact parents are `desen-app-shell-navigation` and
`reference-catalog-web-capability-artifact`; that conservative connected graph produces a
66-workload affected closure. Its verifier is `PROOF_READ_ONLY`; its root mutation test is
`PROOF_OS_TEMP_ISOLATED` and receives only `NODE_TEST_HARNESS`. Neither workload receives
workspace-write, listener-port, native-addon, filesystem-compatibility, or verifier runtime-probe
authority. The local root wrappers invoke both predecessor artifact verifiers directly so
developer commands authenticate the required receipts without recursively replaying either
predecessor's historical prerequisite chain.

The M09-T03 `desen-app-real-adapter-canvas` pair is ordinary and non-barrier. Its exact formal
impact parents are `desen-app-shell-navigation` and `reference-host-web-source-audit`; its T03
checkpoint graph contained 51 proof units and 112 workloads. Both workloads are
`PROOF_OS_TEMP_ISOLATED`. The verifier receives the bounded `VERIFIER_RUNTIME_PROBE` child policy,
the root receives `NODE_TEST_HARNESS`, and both receive only the
`DESEN_APP_REAL_ADAPTER_CANVAS_VITE` native-addon policy required by the real Vite/Rollup build.
Neither workload receives workspace-write, listener-port, or filesystem-compatibility authority.

The M09-T04 `desen-app-selection-overlay` pair is ordinary and non-barrier. Its sole exact formal
impact parent is `desen-app-real-adapter-canvas`; its T04 connected closure contains 52 proof
units and 114 workloads at
`sha256:bc441ea24854f3842089c0e101defca3b807236c7e6fc531801d4d42b8a0d4fb`. Its verifier is
`PROOF_READ_ONLY`; its root mutation test is `PROOF_OS_TEMP_ISOLATED` and receives only
`NODE_TEST_HARNESS`. Neither workload receives workspace-write, listener-port, native-addon,
filesystem-compatibility, or verifier runtime-probe authority.

The M09-T05 `desen-app-schema-inspector` pair is ordinary and non-barrier. Its exact formal impact
parents are `desen-app-catalog-panel-layer-tree`, `desen-app-selection-overlay`, and
`publisher-official-golden`; its reviewed T05 connected closure contains 53 proof units and 116
workloads. Its verifier is `PROOF_READ_ONLY`; its root mutation test is `PROOF_OS_TEMP_ISOLATED`
and receives only `NODE_TEST_HARNESS`. Neither workload receives workspace-write, listener-port,
native-addon, filesystem-compatibility, or verifier runtime-probe authority. Its local wrapper
directly authenticates the three prerequisite artifacts before App build, typecheck, focused
Inspector tests, artifact verification, and the root proof.

The M09-T06 `desen-app-structured-inspector` pair is ordinary and non-barrier. Its sole exact
formal impact parent is `desen-app-schema-inspector`; its reviewed T06 connected closure contains 54
proof units and 118 workloads at
`sha256:5ccac855e50f6fe0b3b17f1d36b5dd72ac4657132bf9ee7280f5fe8cf297d5ec`. Its verifier is
`PROOF_READ_ONLY`; its root mutation test is `PROOF_OS_TEMP_ISOLATED` and receives only
`NODE_TEST_HARNESS`. Neither workload receives workspace-write, listener-port, native-addon,
filesystem-compatibility, or verifier runtime-probe authority. Its local wrapper directly
authenticates the frozen M09-T05 artifact before the App build, typecheck, structured-Inspector
suite, artifact verification, and root proof.

The M09-T07 `desen-app-named-slot-authoring` pair is ordinary and non-barrier. Its sole exact
formal impact parent is `desen-app-structured-inspector`; the current connected closure contains 55
proof units and 120 workloads at
`sha256:6a7cb544efd2906ccd09db03209c54888a25f366b080b5cf37b87c43edc2651c`. Its verifier is
`PROOF_READ_ONLY`; its root mutation test is `PROOF_OS_TEMP_ISOLATED` and receives only
`NODE_TEST_HARNESS`. Neither workload receives workspace-write, listener-port, native-addon,
filesystem-compatibility, or verifier runtime-probe authority. Its local wrapper directly
authenticates the frozen M09-T06 artifact before the App build, typecheck, focused named-slot suite,
artifact verification, and root proof.

The M09-T08 `desen-app-state-binding-editor` pair is ordinary and non-barrier. Its exact formal
impact parents are `desen-app-schema-inspector`, `editor-core-state-binding-edits`, and
`desen-app-named-slot-authoring`; the current connected closure contains 56 proof units and 122
workloads. Its verifier is `PROOF_READ_ONLY`; its root mutation test is
`PROOF_OS_TEMP_ISOLATED` and receives only `NODE_TEST_HARNESS`. Neither workload receives
workspace-write, listener-port, native-addon, filesystem-compatibility, or verifier runtime-probe
authority. Its local wrapper directly authenticates all three frozen parents before App build,
typecheck, the 109-case focused state/binding suite, artifact verification, and root proof.

The M09-T09 `desen-app-event-action-editor` pair is ordinary and non-barrier. Its exact formal
impact parents are `desen-app-state-binding-editor` and `editor-core-event-action-edits`; the
historical connected closure contains 57 proof units and 124 workloads. Its verifier is
`PROOF_READ_ONLY`; its root mutation test is `PROOF_OS_TEMP_ISOLATED` and receives only
`NODE_TEST_HARNESS`. Neither workload receives workspace-write, listener-port, native-addon,
filesystem-compatibility, or verifier runtime-probe authority. Its local wrapper directly
authenticates both frozen parents before App build, typecheck, the 84-case focused event/action
suite, artifact verification, and root proof.

The M09-T10 `desen-app-design-run-modes` pair is ordinary and non-barrier. Its exact formal impact
parents are `desen-app-real-adapter-canvas`, `desen-app-state-binding-editor`, and
`desen-app-event-action-editor`; the historical connected closure contains 58 proof units and 126
workloads at `sha256:ac5ba9fad912e6dbbc1bdd14c919a8209163cec49db4477116dc42af35e05b41`. Its
verifier is `PROOF_READ_ONLY`; its root mutation test is `PROOF_OS_TEMP_ISOLATED` and receives only
`NODE_TEST_HARNESS`. Neither workload receives workspace-write, listener-port, native-addon,
filesystem-compatibility, or verifier runtime-probe authority. Its local wrapper directly
authenticates all three frozen parents before App build, typecheck, the 44-case focused Design/Run
suite, artifact verification, and root proof.

The M09-T11 `desen-app-fixtures-scenarios-fidelity` pair is ordinary and non-barrier. Its exact
formal impact parents are `desen-app-design-run-modes`, `reference-sign-in-fixtures-and-host-binding`,
and `reference-catalog-web-parity`; the historical connected closure contains 59 proof units and 128
workloads. Its verifier is `PROOF_READ_ONLY`; its root mutation test is
`PROOF_OS_TEMP_ISOLATED` and receives only `NODE_TEST_HARNESS`. Neither workload receives
workspace-write, listener-port, native-addon, filesystem-compatibility, or verifier runtime-probe
authority. Its local wrapper authenticates all three exact parents before App typecheck/build, the
86-case focused suite, artifact verification, and the 11-case root proof.

The M09-T12 `desen-app-source-persistence` pair is ordinary and non-barrier. Its exact formal impact
parents are `desen-app-shell-navigation`, `editor-core-persistence`, and
`desen-app-fixtures-scenarios-fidelity`; the current connected closure contains 60 proof units and
130 workloads. Its verifier is `PROOF_READ_ONLY`; its root mutation test is
`PROOF_OS_TEMP_ISOLATED` and receives only `NODE_TEST_HARNESS`. Neither workload receives
workspace-write, listener-port, native-addon, filesystem-compatibility, or verifier runtime-probe
authority. Its local wrapper authenticates all three exact parents before App build, typecheck, the
136-case focused persistence suite, artifact verification, and the 12-case root mutation proof.

Only these verifier proofs receive both runner-owned temp-write and child-runtime-probe authority:

- `publisher-catalog-pinning`;
- `publisher-bundle-publication`;
- `publisher-official-golden`;
- `publisher-invalid-source-matrix`;
- `control-plane-bundle-store`; and
- `control-plane-bundle-verification`; and
- `control-plane-local-api`; and
- `control-plane-runtime-activation`; and
- `control-plane-runtime-recovery`; and
- `control-plane-runtime-fault-injection`; and
- `control-plane-runtime-transition-races`; and
- `reference-host-web-channel-consumption`; and
- `desen-app-real-adapter-canvas`.

Native-addon authority is limited to the exact `reference-host-web-source-audit`
verifier/root-test pair, the `publisher-invalid-source-matrix` root test, and the exact
`control-plane-local-api`, `control-plane-runtime-activation`,
`control-plane-runtime-recovery`, and `control-plane-runtime-fault-injection` verifier/root-test
pairs plus only the `control-plane-runtime-transition-races` and
`reference-host-web-channel-consumption` verifiers, and the exact `editor-core-persistence`
verifier/root-test pair, plus the exact `desen-app-real-adapter-canvas` and
`desen-app-published-host-update` verifier/root-test pairs. The
transition-races and channel-consumption roots are denied native-addon authority. These grants total
nineteen exact native-addon steps; every unlisted step
remains denied.
The Publisher probe loads the reviewed Rolldown binding; the control-plane pairs load the locked
SQLite binding; and the adapter-canvas pair loads the reviewed Vite/Rollup build binding. The
source-audit verifier
remains workspace-read-only; its root test owns the single exclusive workspace-temp exception.
Fastify 5.11.2 and better-sqlite3 13.0.3 are exact lockfile inputs, and the reviewed production
dependency audit reports no known vulnerability. That dependency statement remains local evidence;
M07-T05 and M07-T06 subsequently passed hosted CI. No hosted M07-T09 result is claimed here.

Every proof process gets a fresh, identity-checked temp root and generated Node permissions.
Direct workspace-write grants, child processes, and addons are absent unless the code-owned
workload record grants them. Inherited `NODE_OPTIONS` is rejected, and a mandatory preload denies
TCP and UDP listener binding. The runner authenticates temp identity again before cleanup.

Eighteen root-test records also own an orthogonal schema-v2 Node-permission compatibility policy:
168 workloads are `NONE`, two are `FIXTURE_COPY`, fifteen are `REVIEWED_SYMLINK`, and one is
`FIXTURE_COPY_AND_REVIEWED_SYMLINK`. Fixture copy is limited to the exact code-owned workspace
source, a no-follow destination inside the workload's own temp root, two reviewed recursive option
shapes, bounded regular trees, and matching source/destination fingerprints. Symlink handling
keeps ordinary targets in the same temp root and pins fourteen workspace-target workloads to
eighteen exact target-and-kind rules. Eight unsafe-input targets are mirrored into the caller's
temp root; ten historical canonical-path or inode checks retain their exact tracked alias.

The generated grant list still adds no workspace-write, shared-parent, or sibling-temp path. This
adapter is defense in depth for fixed trusted repository tests, not a security sandbox for
adversarial JavaScript or child processes. Its real tracked aliases are covered by reviewed test
behavior, exclusive scheduling, and the complete gate's closing tracked-workspace seal. Unlisted
workloads, sources, workspace targets, target kinds, symlink-parent traversal, and copy options
fail closed.

`REQUIRED` rejects injected success observations and every injected runner, Git reader, workspace
capture, guard, process, environment, signal, or timeout seam. Those seams exist only for
non-authoritative contract tests. Its opening clean-input proof binds HEAD to the authenticated
revision and requires empty porcelain-v2 status, including staged, unstaged, non-ignored untracked,
and submodule state. The hosted `SHADOW` candidate uses the same real clean-input proof; only
focused non-authoritative tests may inject that boundary.

One first-terminal record is shared by the host handlers, scheduler, and child-process registry.
The first timeout, process error, nonzero close, execution error, SIGINT, or SIGTERM fixes the
primary reason and exit code, immediately terminates every active group, and prevents later
launches. Later signals may escalate but cannot replace that record. Every active child `close` and
isolation cleanup is still awaited before the gate settles.

Affected execution owns a 17-minute soft complete-gate deadline; exhaustive execution owns an
18-minute 30-second soft complete-gate deadline. Both retain 15-minute per-workload deadlines and
a five-second child-termination grace. Because authentic settlement still awaits child `close`,
cleanup, and boundary capture, the Phase A command also has a 19-minute operating-system ceiling
with a 30-second kill grace. GitHub's 25-minute job ceiling remains outside both. An outer-ceiling
failure is red and cannot serve as promotion evidence; setup, contract checks, receipt emission,
and hosted variance retain their own headroom. The frozen I07-04 promotion artifact preserves its
historical 17-minute soft and 18-minute process ceilings; live successor authority authenticates
the current 17-minute affected, 18-minute 30-second exhaustive, and 19-minute process boundaries
separately.

The required execution design layers three closing guards:

- a no-follow seal across the 33 reviewed build and Turbo output roots around the proof phase;
- a bounded digest of every non-ignored untracked entry around the full 146-step region; and
- a tracked-workspace boundary covering bytes, executable modes, file count, and Git index object
  ids around the full run, including failure and cancellation paths.

No proof-result cache is admitted. The pnpm store may cache immutable dependency downloads only;
every build, test, verifier, mutation, checkpoint, and boundary result is recomputed.

I07-02 promoted execution to hosted `REQUIRED + EXHAUSTIVE` only after the same revision proved:

- exact plan and workload-set equality;
- exactly-once coverage for every global step and proof pair;
- identical pass/fail outcomes with no tracked-byte or index drift;
- safe cancellation and sibling-process termination;
- code-owned shared-state, build-output, port, and temporary-path classification; and
- a recorded local and hosted timing comparison.

The accepted pre-cutover comparison at commit
`077560fe81d0fcf4560554dd7511413bad5bc30e` passed the 130-workload required runner and retained
legacy runner on the same pull-request revision. The official cutover at commit
`3cf72552ee3ea23a0b5e99f782f837bc6237f78b` passed hosted run
[`30699616361`](https://github.com/desenlab/desen-app/actions/runs/30699616361): the required
`Quality gate` completed in 10 minutes 33 seconds, the manual rollback job was skipped, and no
shadow workflow ran. The exact program, including an earlier rejected common-drift attempt, is
archived in
[`i07-02-required-exhaustive-equivalence.json`](../proof/baselines/i07-02-required-exhaustive-equivalence.json).

### I07-03 shadow-affected observation

At the I07-03 checkpoint, a separate pull-request-only `SHADOW + AFFECTED` job was added. The exact
`run-required-exhaustive-quality-gate.mjs` command remains unchanged as the sole pass/fail
authority; the observer cannot make CI pass or suppress required work.

The selector authenticates the same-repository revision boundary, complete exact tracked-path
ownership, and affected dependency closure. Unknown paths, statuses, modes, owners, bases, or
edges—and every ambiguous, untrusted, policy, dependency, frozen-input, incomplete-diff, or
unsupported condition—expand to `EXHAUSTIVE`. A strict subset is only a plan: every selected
workload executes from fresh inputs under the real isolation and closing guards. Cached build,
test, mutation, checkpoint, or proof success remains forbidden.

Only an opaque receipt minted by the real Git boundary may authorize selection. A composite digest
binds the exact boundary, selector, impact, ownership, threshold, shadow-runner, required-oracle,
workflow, and toolchain sources across observations. Its frozen selector digest is
`sha256:20a78069ed829649ab9198cad68b5d7fede22dc3b6ec391ed84f5dd1f0afa86f` across 20 exact
comparison-authority sources. Multi-proof execution validates every pair, and the explicit
selected-root suffix barrier cannot treat an absent exhaustive root as completed.

At that checkpoint, promotion was reserved for I07-04 after every selector category was mutation-covered, false
negatives remain zero, and at least 20 consecutive eligible same-revision hosted strict-subset
affected/exhaustive comparisons agreed. Observation started at `0 / 20`, promotion was false, and
I07-04 was `NOT_STARTED`. Fresh `EXHAUSTIVE` execution remained mandatory on `main` and manual
audits, including the release process routed through those authorities. The hosted bootstrap passed the authoritative Quality gate. Its
shadow result was `NOT_ELIGIBLE` → `EXHAUSTIVE` for `UNSUPPORTED_CHANGE_KIND`, so it was not an
eligible strict-subset comparison and the observation count remained `0 / 20` then. The exact hosted
run/job/revision/receipt identifiers are pinned by the
[`i07-03-affected-selector-shadow.json`](../proof/baselines/i07-03-affected-selector-shadow.json)
baseline. Focused local contracts passed 91/91 and all CI infrastructure tests passed 203/203. At
that historical checkpoint, the full local gate was `BLOCKED_BY_LOCAL_SANDBOX` because loopback
`listen` returned `EPERM` in two pre-existing TCP lifecycle tests; this was not a product
regression, and the hosted Quality gate was authoritative. The pure I07-03 ledger cannot
authenticate hosted provenance or grant promotion
even when supplied records satisfy 20/20; I07-04 must pin an exact GitHub
run/job/revision/receipt review authority. `DEBT-I07-017` assigns the shadow-only job, wrapper, and
test wiring to I07-04 for removal by G07.

I07-04 has now satisfied that separate requirement: 20 consecutive hosted comparisons are
authenticated with zero false negatives in
`docs/proof/baselines/i07-04-affected-selector-promotion.json`. The required dispatcher admits
affected execution only for one exact same-repository pull-request boundary and one verified
promotion receipt. Any path-set, ownership, policy, provenance, or diff uncertainty produces
`NOT_ELIGIBLE` and exactly one fresh exhaustive fallback. `main` and manual execution, including
the release process routed through those authorities,
remain unconditionally fresh exhaustive. [Cleanup PR #36](https://github.com/desenlab/desen-app/pull/36)
passed fresh `REQUIRED + EXHAUSTIVE` in
[run 31674300000, job 94365383803](https://github.com/desenlab/desen-app/actions/runs/31674300000/job/94365383803),
and its landed `main` revision `6d87889bc088e45e219f430ee67e10c901c1a2fb` passed again in
[run 31675234655, job 94368259305](https://github.com/desenlab/desen-app/actions/runs/31675234655/job/94368259305).
The one-file [canary PR #37](https://github.com/desenlab/desen-app/pull/37) passed fresh
`REQUIRED + AFFECTED` in 3m54s in
[run 31676049922, job 94370743935](https://github.com/desenlab/desen-app/actions/runs/31676049922/job/94370743935):
10 selected workloads, one proof unit, 10 observed closes, `strictSubset: true`,
`freshExecution: true`, and `cachedSuccessRead: false`.

I07-02's completed promotion closed `DEBT-I07-008` by removing its temporary shadow workflow and
modular comparison adapter/test. I07-04 closed all 17 G07-due bridge entries and completed G07.
Historical closure checkpoint sequence 28 head
`2577962251a9e6fa86993bd0e8bda1ed901f850a3b93678486c0445aed035546` authenticates 25 frozen
artifacts and 50 readers. Historical sequence 30 remains pinned at
`f5598749a14e7d5eed27cb07e92a83f2bec28b5404f4480600e687d960f04970`. Historical sequence 31 is
`181d5a1e0c012f53cfe02640c2f8d0ddf1e300090a3c3742882bb3722175e42d`. Historical append-only
successor sequence 32 is
`9be019b902ee17a57c9e2f13270fa67fe26265d06e360719bd1542643be6a424`, authenticating 29 frozen
artifacts and 58 then-current readers. The historical M08-T05 append-only successor is sequence 33 at
`64da5390046020ed223da42ce8a24d9fcf971c6a5a0a92fc49d368586414c871`, authenticating 30 frozen
artifacts and 60 then-current readers while preserving sequence 32 and every predecessor artifact
byte. Its dedicated checkpoint suite passes 56/56. Historical M08-T06 sequence 34 remains
byte-identical at
`f641e8d20d0f5e94cca809d330e3ad5bb0d7ffe0c3ec5defc14e0b5fca63b674`, authenticating 31 frozen
artifacts and 62 then-current readers. Historical M08-T07 sequence 35 at
`a2e3ef962ed37e0570cdddef64ae8d0eef2fd3f298cc2580f7ee65d8200f6fa3` authenticates 32 frozen
artifacts and 64 then-current readers while preserving sequence 34 and every earlier byte. It reseals
the twelve changed live historical readers at indexes `[50, 51, 52, 53, 54, 55, 56, 57, 58, 59,
60, 61]` and appends the T07 proof/root readers at `[62, 63]`. Historical M08-T08 sequence 36 at
`4f351f2f535b1fc335876160256a42b1d53c7c7f43db08e0b86bf50c389d1e82` authenticates 33 frozen
artifacts and 66 then-current readers while preserving sequence 35 and every earlier byte. It reseals
reader indexes `[50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63]`, appends the T08
proof/root readers at `[64, 65]`, and remains immutable history. Historical M08-T09 sequence 37 at
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
The dedicated checkpoint suite passes 62/62.
The exact 30,014-byte M08-T05 artifact is
`docs/proof/artifacts/editor-core-0.1.0-state-binding-edits.json` at
`sha256:b85e578ac2bc27897517f12d8d4cf867a089cd61ff9fd1ab0664c819977634f8`; its reviewed report is
`docs/proof/EDITOR-CORE-STATE-BINDING-EDITS.md`; it remains the frozen sole direct prerequisite for
M08-T06. The exact 31,310-byte M08-T06 artifact is
`docs/proof/artifacts/editor-core-0.1.0-event-action-edits.json` at
`sha256:05a7df153512b8dd0f8289991d12a9d12d79903ed8b3637ef6c8a450ca8a6be7`, with reviewed report
`docs/proof/EDITOR-CORE-EVENT-ACTION-EDITS.md`. The exact 62,304-byte M08-T07 artifact is
`docs/proof/artifacts/editor-core-0.1.0-authoring-round-trip.json` at
`sha256:33b6f81be62076d304c6daaec5d860e7995fa69ceaf34103469b349a347962db`, with reviewed report
`docs/proof/EDITOR-CORE-AUTHORING-ROUND-TRIP.md`. The exact 49,785-byte M08-T08 artifact is
`docs/proof/artifacts/editor-core-0.1.0-persistence.json` at
`sha256:51932d4165afff3c40fae6769527e480f6d0ff355f3fbc6d8ae7c6809e50a6fe`, with reviewed report
`docs/proof/EDITOR-CORE-PERSISTENCE.md`. The exact 40,099-byte M08-T09 artifact is
`docs/proof/artifacts/editor-core-0.1.0-continuous-validation.json` at
`sha256:7739b5143685d613a678c6eca5480f27a5a303b176bf2bf4613a4d6917fe7e5a`, with reviewed report
`docs/proof/EDITOR-CORE-CONTINUOUS-VALIDATION.md`. Its 62,890-byte proof reader is pinned at
`sha256:f3b27812aae9b3e4a3d74ccb9cda7aac7749c560257f33003eb66d5041dd1b5f` and its 10,840-byte
root reader at `sha256:f1b415d0dc41f755649f1ddd345ba1454e8695b9971e0afbc4032fc7d348d2b5`.
The exact 325,549-byte M08-T10 artifact is
`docs/proof/artifacts/editor-core-0.1.0-terminal-integration.json` at
`sha256:5787479d699ab8f53b739e633bf9a88900da00ae4f4c78f96b3e62a73133fa1b`, with reviewed report
`docs/proof/EDITOR-CORE-TERMINAL-INTEGRATION.md`. Historical sequence 38 pins its initial 84,005-byte proof reader at
`sha256:46354aae84ddf65314ad3cd8cfbefc33245e4de495ecda577ca296185f749ca2` and its 13,088-byte
root reader at `sha256:f1cd04fbccbba01469bfbacad3154c2ba99e130745dbbd1bcf0397230982dff9`.
The exact 12,118-byte M09-T01 task artifact is
`docs/proof/artifacts/desen-app-0.1.0-shell-navigation.json` at
`sha256:c3189ff9196f0da91311156893ab569a3c9f9c1ee62631b58286647f36d23220`, with task report
`docs/proof/DESEN-APP-SHELL-NAVIGATION.md`. Append-only checkpoint sequence 40 closes at
`sha256:e19eabc91c56c015b7fec7469d096b09a4bf42f5b6edc907c0207dd8c94feb0e` with 36 frozen
artifacts and 72 readers. It preserves sequences 1–39 and all 35 predecessor artifact receipts,
appends the M09 artifact at index 35 and readers at `[70, 71]`, advances only live source-reader
indexes `[66, 67, 68]`, and reauthenticates unchanged reader `[69]`.
The exact 25,375-byte M09-T02 task artifact is
`docs/proof/artifacts/desen-app-0.1.0-catalog-panel-layer-tree.json` at
`sha256:85a310feaf1a0cc3656055cd3a76eeb02e02a278c21d22167853b53c03f1ee61`, with task report
`docs/proof/DESEN-APP-CATALOG-PANEL-LAYER-TREE.md`. Append-only checkpoint sequence 41 closes at
`sha256:b36679b7ea3ffd0e019d3051b30312dd96b050e10ae7d5d44cf39eb9d30eeb68` with 37 frozen
artifacts and 74 readers. It preserves sequences 1–40 and all 36 predecessor artifact receipts,
appends the T02 artifact at index 36 and readers at `[72, 73]`, and advances only the live T01
readers at `[70, 71]`.
The exact 73,111-byte M09-T03 task artifact is
`docs/proof/artifacts/desen-app-0.1.0-real-adapter-canvas.json` at
`sha256:8f89b237c20d80e83d96f17c31146d251c026977a4fff1ab1d0822e489c63151`, with task report
`docs/proof/DESEN-APP-REAL-ADAPTER-CANVAS.md`. Its 73,183-byte proof reader is pinned at
`sha256:e6ff92ffd774edab9cd38a852be67145fa048df79dcf38ff8740d94b522b1f18` and its 22,347-byte root
reader at `sha256:03a61e2e2ab976f090e258210ac3851d06c8a0b067d46ebb109426b21aa66946`.
Append-only checkpoint sequence 42 closes at
`sha256:40d7c380cec3a7efd04316959a41abda3c8f71c1604f7f2fb892f18ae4cd2fa5` with 38 frozen
artifacts and 76 readers. It preserves sequences 1–41 and all 37 predecessor artifact receipts,
then appends the T03 artifact at index 37 and readers at `[74, 75]`.
The exact 11,997-byte M09-T04 task artifact is
`docs/proof/artifacts/desen-app-0.1.0-selection-overlay.json` at
`sha256:9a3805545ea49820c744fc07b9c3b0c2919b3e2fb524f9855df1cec9058901b1`, with task report
`docs/proof/DESEN-APP-SELECTION-OVERLAY.md`. Its 42,521-byte proof reader is pinned at
`sha256:cfa1c0b4d04b7d15ca746fd7b46b1d947a08b48dee5b7637ca4e99fcd3ab1d37` and its 10,506-byte
root reader at `sha256:ce59437c2dcfbfb58bf3b6c641ed08021d77bde024371784eeb17cd57af6e9b2`.
Append-only checkpoint sequence 43 closes at
`sha256:0bbb101332d7af5dcf7260b6df6961837003571f67a6e3a69232e65e19cded58` with 39 frozen
artifacts and 78 readers. It preserves sequences 1–42 and all 38 predecessor artifact receipts,
appends the T04 artifact at index 38, reseals App compatibility readers `[70, 71, 72, 73, 74, 75]`,
and appends the T04 readers at `[76, 77]`.
The exact 22,998-byte M09-T05 task artifact is
`docs/proof/artifacts/desen-app-0.1.0-schema-inspector.json` at
`sha256:473ab3248ed7b7b4de0e558df47159a74c28c134b46569aa91130745fd69660b`, with task report
`docs/proof/DESEN-APP-SCHEMA-INSPECTOR.md`. Its exact M09-T02 Catalog-panel, M09-T04
selection-overlay, and M06-T10 Publisher official-golden parents are verified directly before the
41-case focused Inspector suite, 86-case complete App suite, and 10-case root proof. Append-only
checkpoint sequence 44 remains pinned at
`sha256:f0c5f3bfbc30ccf230c5256b3a5672c29ffa0e884129ae210571895bd063812c` with 40 artifacts and
80 readers. Reader-checkpoint receipts remain a separate authority and are not inferred from
task-proof success.
The exact 26,133-byte M09-T06 task artifact is
`docs/proof/artifacts/desen-app-0.1.0-structured-inspector.json` at
`sha256:6ea4eb3f51fdfc39eeca676d7ebafb145d66a9efdfa03af9c33a7aa39aa6aaec`, with task report
`docs/proof/DESEN-APP-STRUCTURED-INSPECTOR.md`. Its exact frozen M09-T05 parent is verified directly
before the 73-case focused structured-Inspector suite, 118-case complete App suite, and 10-case root
proof. Its 59,817-byte proof reader is pinned at
`sha256:9075433fd20436f6ae79075470722fe8e23ee65fe82f2347ac151ef25667d729`, and its 23,934-byte root
reader at `sha256:835162247f14fe5183a31ec9c806cd23f0c3dfeb43515afe622b539637c9970e`.
Append-only checkpoint sequence 45 links the exact sequence-44 head to
`sha256:340460237dd173995d4d0fa158f0e4c6c54b76d55958757d742a981466fd213f`. It preserves sequences
1–44 and all 40 predecessor artifact receipts, appends the T06 artifact at index 40, reseals App
reader indexes `[70, 71, 72, 73, 74, 75, 76, 77, 78, 79]`, and appends the T06 readers at
`[80, 81]`; that chain authenticates 41 artifacts and 82 readers.
The exact 24,830-byte M09-T07 task artifact is
`docs/proof/artifacts/desen-app-0.1.0-named-slot-authoring.json` at
`sha256:daae817af45d8ead7052fd84df4edefd7d29cdd9ebe9cc1baea5b22b27dae90f`, with task report
`docs/proof/DESEN-APP-NAMED-SLOT-AUTHORING.md`. Its exact frozen M09-T06 parent is verified directly
before the 70-case focused named-slot suite, 151-case complete App suite, and 9-case root proof.
Its App compatibility patch uses non-overlapping boundaries, whole-row top/bottom targets, a sticky
Components target, and insert auto-selection exposing the existing safe Delete; native
real-browser drag E2E remains open.
Append-only checkpoint sequence 46 links the exact sequence-45 head to
`sha256:f09ec643d1b2756174ca47fae99837a68f6656bec0c6933e566d5075713a0f5f`. It preserves sequences
1–45 and all 41 predecessor artifact receipts, appends the T07 artifact at index 41, reseals App
reader indexes `[70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81]`, and appends the T07 readers at
`[82, 83]`; that historical chain authenticates 42 artifacts and 84 readers.
The exact `28,766`-byte M09-T08 task artifact is
`docs/proof/artifacts/desen-app-0.1.0-state-binding-editor.json` at
`sha256:b7298375cba4b82258d1c293ecb66c3ae6641408ae9f5753da121ac44fcf601a`, with task report
`docs/proof/DESEN-APP-STATE-BINDING-EDITOR.md`. Its exact frozen M09-T05, M08-T05, and M09-T07
parents are verified directly before the 109-case focused state/binding suite, artifact
verification, and root proof. Append-only checkpoint sequence 47 preserves sequences 1–46 and all
42 predecessor artifact receipts, appends the T08 artifact at index 42, and extends the current
chain to 43 artifacts and 86 readers at `sha256:c28ba9a9f274ac0bc3f7dc7ed6de51df35128b109b374b563f5c0239891f58f7`. Reader-checkpoint receipts
remain separate authority and are not inferred from task-proof success.
The exact `23,812`-byte M09-T09 task artifact is
`docs/proof/artifacts/desen-app-0.1.0-event-action-editor.json` at
`sha256:0060ef39273ea36666f1701d5d3fa0f1610b95f40d88304ba980dcdc73cb29ab`, with task report
`docs/proof/DESEN-APP-EVENT-ACTION-EDITOR.md`. Its exact frozen M09-T08 and M08-T06 parents are
verified directly before the 84-case focused event/action suite, artifact verification, and
10-case root proof. Append-only checkpoint sequence 48 preserves sequences 1–47 and all 43
predecessor artifact receipts, appends the T09 artifact at index 43, reseals the live App readers,
and extends the current chain to 44 artifacts and 88 readers at
`sha256:5ecf9e630e2c91cb97a7c85c60e8318fdf694039711a64bf1797e481aca0ff90`. Reader-checkpoint
receipts remain separate authority and are not inferred from task-proof success.
The exact `17,900`-byte M09-T10 task artifact is
`docs/proof/artifacts/desen-app-0.1.0-design-run-modes.json` at
`sha256:bc5b7ffef0c39737882072f9340bcade86f084db8e7923fcb03aa7364d077334`, with task report
`docs/proof/DESEN-APP-DESIGN-RUN-MODES.md`. Its exact frozen M09-T03, M09-T08, and M09-T09 parents
are verified directly before the 44-case focused Design/Run suite, artifact verification, and
10-case root proof. The proof and root readers are pinned at 53,346 bytes/
`sha256:ff4226241630daded979263dcd0a7fdb071591efbf789d1e7d2d4f4641779dfe` and 15,787 bytes/
`sha256:d27307b0763132e5c21f45c146d3773ab9dbf02371f850dca3d03e11a759f601`.
Append-only checkpoint sequence 49 preserves sequences 1–48 and all 44 predecessor artifact
receipts, appends the T10 artifact at index 44, advances only reviewed live reader indexes
`[72, 73, 74, 75, 76, 77, 78, 80, 82, 84, 86, 87, 88, 89]`, and extends the current chain to 45 artifacts
and 90 readers at
`sha256:45ed64e604400f18b15b3b4ef44bc35634a6c1567b46174329ec36529168272e`. Reader-checkpoint
receipts remain separate authority and are not inferred from task-proof success.
The first hosted PR run exposed an isolation-fixture workspace-target symlink denied by Node's
permission model. The resealed fixture uses only absolute runner-temporary targets, and the exact
isolation suite passes 8/8 without permission widening. This correction remains local and does not
claim a hosted pass.
The historical T07-integrated full CI infrastructure suite
passed 265/265; its dedicated checkpoint, required-affected, promotion, and retained legacy-gate
suites passed 58/58, 27/27, 19/19, and 25/25 respectively. The M08-T10-integrated CI infrastructure suite
passes 302/302; the terminal-integration root proof and checkpoint suites pass 10/10 and 62/62.
Those local code-owned receipts make no hosted M08-T10 claim. The M09-T01 application build,
typecheck, and lint pass locally; its focused suite passes 43/43, its independent root suite passes
8/8, and the sequence-40 checkpoint suite passes 63/63. No M09-T01 required-gate or hosted result is
claimed in this standard. The M09-T02 focused authoring suite passes 18/18, its independent root
proof passes 8/8, and the sequence-41 checkpoint suite passes 64/64. No M09-T02 required-gate or
hosted result is claimed in this standard. The M09-T03 focused canvas suite passes 20/20, its
independent root proof passes 11/11, and the sequence-42 checkpoint suite passes 65/65. No M09-T03
required-gate or hosted result is claimed in this standard. The focused M09-T03 CI infrastructure
suite passes 196/196 and the complete structural CI glob passed 314/314 under its historical local
authority. The M09-T04 focused App suite passes 27/27, its independent root proof passes 10/10,
the sequence-43 checkpoint suite passes 66/66, and its historical complete structural CI glob passes
317/317 locally. No M09-T04 required-gate or hosted result is claimed in this standard.
The M09-T05 focused Inspector, complete App, independent root, sequence-44 checkpoint, and complete
structural-CI suites pass 41/41, 86/86, 10/10, 67/67, and 320/320. Sequence 44 is pinned at
`sha256:f0c5f3bfbc30ccf230c5256b3a5672c29ffa0e884129ae210571895bd063812c` with 40 artifacts and
80 readers. No M09-T05 required-gate or hosted result is claimed in this standard.
The M09-T06 focused structured-Inspector, complete App, independent root, and sequence-45
checkpoint suites pass 73/73, 118/118, 10/10, and 68/68 locally. The CI-policy sub-suite passes
270/270, and the complete structural glob passes 323/323. Sequence 45 is pinned at
`sha256:340460237dd173995d4d0fa158f0e4c6c54b76d55958757d742a981466fd213f` with 41 artifacts and
82 readers. No M09-T06 required-gate or hosted result is claimed in this standard.
The M09-T07 focused named-slot, complete App, independent root, and sequence-46 checkpoint suites
pass 70/70, 151/151, 9/9, and 69/69 locally. The complete structural glob passes 329/329. Sequence
46 is pinned at `sha256:f09ec643d1b2756174ca47fae99837a68f6656bec0c6933e566d5075713a0f5f`
with 42 artifacts and 84 readers. No M09-T07 required-gate or hosted result is claimed in this
standard.
The M09-T08 focused state/binding suite passes 109/109 locally. Its final complete structural
receipt is `278/278`. Sequence 47 is pinned at
`sha256:c28ba9a9f274ac0bc3f7dc7ed6de51df35128b109b374b563f5c0239891f58f7` with 43 artifacts and 86 readers. No M09-T08 required-gate,
hosted-CI, native-drag, or real-browser E2E result is claimed in this standard. P-08 remains
`NOT_PROVEN`, PF-025 remains `OPEN`, implementation progress is 103/145 (71%), M09 is 8/14 (57%),
and M09-T09 is next.
The M09-T09 pure projection, panel, focused event/action, complete App, and independent root suites
pass 12/12, 7/7, 84/84, 202/202, and 10/10 locally. The complete structural CI receipt passes
282/282; the sequence-48 checkpoint suite passes 71/71. Sequence 48 is pinned at
`sha256:5ecf9e630e2c91cb97a7c85c60e8318fdf694039711a64bf1797e481aca0ff90` with 44 artifacts and 88
readers. No M09-T09 required-gate, hosted-CI, action-execution, or real-browser E2E result is
claimed in this standard. P-08 remains `NOT_PROVEN`, PF-025 and PF-083 remain `OPEN`, implementation
progress is 104/145 (72%), M09 is 9/14 (64%), and M09-T10 is next.
The M09-T10 adapter, application, focused Design/Run, complete App, and independent root suites pass
9/9, 35/35, 44/44, 210/210, and 10/10 locally. The application receipt includes the retained
root-safe default placement target, explicit target change, enlarged drop lanes, last valid row
projection, visible selected-layer Delete control, and editable-control-safe Delete/Backspace
shortcuts; it makes no arbitrary canvas geometry or native-drag E2E claim. The checkpoint,
promotion, selector, required-affected, equivalence, exhaustive, and complete serial structural
suites pass 72/72, 19/19, 19/19, 35/35, 8/8, 30/30, and 339/339. A concurrent cleanup observed a
process-kill
`EPERM` flake; the same repository bytes passed the authoritative serial 339/339 aggregate, so this
is recorded as a process-cleanup flake rather than a product or proof failure. Sequence 49 is pinned
at `sha256:45ed64e604400f18b15b3b4ef44bc35634a6c1567b46174329ec36529168272e` with 45 artifacts and 90
readers. No M09-T10 required-gate, hosted-CI, fixtures/scenarios, persistence, diagnostics,
publication, activation, or automated real-browser/native-drag E2E result is claimed in this
standard. P-09 is only `PARTIAL`; P-08 remains `NOT_PROVEN`; S-001 remains `PLANNED`; PF-025,
PF-028, and PF-083 remain `OPEN`; implementation progress is 105/145 (72%); M09 is 10/14 (71%);
and M09-T11 is next.
The M09-T11 focused fixtures/scenarios/fidelity, complete App, and independent root suites pass
86/86, 252/252, and 11/11 locally. The task artifact is exactly 29,407 bytes at
`sha256:3f08980e687d48ba267f78c7d4dd1ae1eb59db5cc6bb3401d88705ee0416cc9d`. The live exhaustive
authority contains 194 workloads and 92 proof pairs—81 ordinary and 11 barriers—with a
59-proof-unit/128-workload connected closure and ownership over 1,232 tracked paths, including 184
proof-owned paths. No required-gate, hosted-CI, durable save/open, diagnostics,
publication/activation, or automated real-browser/native-drag E2E result is claimed in this
standard. Sequence 50 advances exact predecessor
`sha256:45ed64e604400f18b15b3b4ef44bc35634a6c1567b46174329ec36529168272e` to
`sha256:6abea41064a05efe363df0f66d1e7d1b4923af08f819acf4c266b092985192a4` across 46 frozen
artifacts and 92 current readers. Checkpoint, promotion, selector plus required-affected,
ownership, and remaining touched-CI suites pass 73/73, 19/19, 56/56, 15/15, and 127/127 locally.
N-035 and S-001 are `TESTED`; PF-028 is `CLOSED`; P-08 remains `NOT_PROVEN`, P-09 and
P-10 remain `PARTIAL`, N-036 remains `PLANNED`, and PF-025, PF-083, and PF-089 remain `OPEN`;
implementation progress is 106/145 (73%), M09 is 11/14 (79%), and M09-T12 is next.
The M09-T12 focused five-file persistence, complete App, and independent root mutation suites pass
142/142, 324/324, and 12/12 locally. The task artifact is exactly 27,053 bytes at
`sha256:717d0ddada008edb34909d5defcc4c28e95b36f6dfc0b1abb4d09d9775a6b734`. The task proof also pins
complete canonical Source dirty authority rather than identity/version, same-value/revert
cleanliness, successful Open/Save baselines, current-vs-dispatched-save-snapshot settlement, and
centralized commits. Its rerender-safe no-port projection admits pristine navigation. The exact
clean label is `Local draft unchanged`. Edited no-port and port-backed dirty drafts are guarded for
the current surface/controller lifetime. The proof also pins exact own-enumerable settlement
capture without accessor invocation, fresh frozen copies of valid optional diagnostics, exact CAS
generation validation, retryable draft-retaining malformed Open, indeterminate reopen-locked
malformed Save, and post-reflection/admission authority fences against reentrant stale publication.
The live exhaustive
authority contains 196 workloads and 93 proof pairs—82 ordinary and 11 barriers—with a
60-proof-unit/130-workload connected closure and ownership over 1,243 tracked paths, including 186
proof-owned paths. Its neutral inventory, semantic impact graph, path set, and ownership projection
are pinned at `sha256:c1d3eb2b4b56e9a97d700f89ac0c0ff9c24bf158c3d18bd8e3d40c9c52b63eb7`,
`sha256:97099a5cb52895eb80d095e99bf18838688d8a0aecf7af49993f0077466558c5`,
`sha256:f216ba32517fd708d24b9d78035894e20951f5cd420d419a66e5ce0b813881c5`, and
`sha256:6511d79ff42cb84dd303f771b821a061cd89c72462dddf2ccd3966397c602983`.
No required-gate, hosted-CI, concrete App storage adapter, diagnostics, publication/activation, or
automated real-browser E2E result is claimed in this standard. M09-T12 is `DONE`; `N-012`,
`N-018`, and `S-003` remain `TESTED` with App-consumption evidence; P-08 remains `NOT_PROVEN`,
P-09/P-10 remain `PARTIAL`, and PF-085/PF-089 remain `OPEN`; implementation progress is 107/145
(74%), M09 is 12/14 (86%), proof gates remain 10/13, and M09-T13 is next.
Sequence 51 advances exact sequence-50 predecessor
`sha256:6abea41064a05efe363df0f66d1e7d1b4923af08f819acf4c266b092985192a4` to
`sha256:42e88946b598566a46237af8d30587fa765d9d58807e864464fc5525fbc64921` across 47 artifacts and
94 readers. Checkpoint, promotion, selector plus required-affected, ownership, and remaining
touched-CI suites pass 74/74, 19/19, 58/58 (21 + 37), 15/15, and 128/128—294/294 combined.
Global progress and next-task ownership remain in the project status documents.
`DEBT-I07-007` keeps the sequential runner, rollback-only equivalence adapter, and other rollback
references under I07-05 until their exact machine-checked removal conditions in
`docs/plan/DEBT-REGISTER.md` are satisfied.

M09-T13 appends `desen-app-node-linked-diagnostics` as proof pair 94 without nesting its eleven
parent verifiers inside the task package script. Fresh parent authority belongs only to the
affected impact graph, which closes over 62 proof units and 134 workloads because the M05-T05
Runtime diagnostic index joins the prior App-connected graph. The exhaustive authority is 198
workloads: eight serial prefix workloads, 83 ordinary proof pairs, eleven barrier pairs, and two
serial suffix workloads. Required and shadow exhaustive plan identities are
`sha256:1262f64954e55a9e45dfe05474ead238109c3cc02d0da030e082cf865668407f` and
`sha256:e34aad7f0c153f9157d6b4447bdc1a863cca662451c66c0209a14fa8cec17588`.

The neutral inventory, semantic impact graph, tracked-path set, and ownership projection are
`sha256:d3b479cc998d6c84d53b9b0d64e6121033d94bbf9b502fcb9e7adc2487b3d908`,
`sha256:b6fae5194e9dd837d05e1ce44808d6b8054742b564420b42901a39e23d4581b1`,
`sha256:372a30ee1f8db5b7d1a35e7fd0b46335513724c59bdfa0540513be2e1938d492`, and
`sha256:7d5a90e56b4b32e2d7e1a0306b09669855642b30558155dba9a07f1ccf7da7a3`.
Ownership covers 1,253 tracked paths, including 188 proof-owned paths, split into 188 proof-unit,
45 CI-policy, 31 dependency-policy, 138 frozen-input, 485 package/application, 225 shared-proof-
infrastructure, 130 project-documentation, and eleven repository-policy paths. These are local
authority receipts and make no required-gate or hosted-CI claim.

The corrective M09 compatibility successor records the current Web–React package digest as
`sha256:d4a4e7e2ea2d68ab8bff085d90e093f2d31b784f0f2fb089c6422ce33914b051` for 80 regular
distribution files/243,740 bytes and 81 framed entries/252,637 framed bytes. The matching
official-derived Bundle revision is
`sha256:6e539a76ddd0bc9b4eff82e73508b62a3980ae5dbc73dd85ccf0c1cae6957e13`, while the Source
digest remains `sha256:b8e2d6bac855fb307aaeb0636becf93834f6faeda5464bdbfbc1e8d52f379635`.
Append-only reader checkpoint sequence 56 advances the exact sequence-55 head to
`sha256:1a2049082f981614c33fb2f1576cfd8d52e9dbd6dbb44f5177d3cf290064c51a`, preserving all 49
frozen artifacts and 98 reader identities. It rewrites no historical artifact or pin, makes no
hosted Quality-gate claim, and leaves M10 at 0/9.

M10-T01 later appends sequence 57 at
`sha256:690c73294f6926822fb1535ac60ea40636545890031db72b7a8d63930a27cc57` with 50 frozen
artifacts and 100 readers. The corrective `M10-T01-COMPAT` authority preserves sequences 1–57 and
appends sequence 58 at
`sha256:08396f779b0c1c63cf56d9a9292dcd0a103228c57fe39e1173d95a4a106a92e5` with 51 frozen
artifacts and 102 current readers. The permission-model fixture correction preserves sequences
1–58 and appends sequence 59 at
`sha256:349a292c9137f0f66c5cd58f384aa2175082613500905fdb723f15b246cbd2e8`, resealing only the
changed M10-T01 root-test reader while retaining the same 51 artifacts and 102 reader identities.
Its dedicated checkpoint suite passes 82/82. These are local reader-authority receipts; they do not
add a plan task or infer an exact-head hosted result.

M10-T01B adds `desen-app-visual-behavior-authoring` as an ordinary proof pair and registers its
verifier and root mutation suite in the exhaustive inventory, shared-state authority, ownership,
semantic impact graph, affected selector, required runners, and hosted Quality gate. Its immutable
artifact authenticates the M10-T01A prerequisite plus the exact visual connection/action/condition,
generic fixture, Run-control, focused-test, and Chromium receipts. Checkpoint sequence 64 preserves
all sequences 1–63 and appends the new artifact and both reader identities without modifying a
historical artifact.

Corrective checkpoint sequence 65 preserves the same 53 artifacts and 106 reader identities. It
reseals only `[70..97, 102, 103]` after the Browser E2E spec moved from the removed JSON-first
action UI to the visible atomic **Connect input** flow. Fifteen historical reader families bind the
exact 15,143-byte spec at
`sha256:5fcdc7f312bb2ef45e747499e50bf31f2dfae8e1c1b82963176d99eb8bb8395b`; their combined suites
pass 233/233, the exact two-config Chromium command passes 1/1 + 1/1 locally, and the checkpoint
suite passes 88/88 at
`sha256:fad195aa82484ec15e347e3681ba6be64e6f1e28d5f724bf1fabeb892a7afe14`. This append-only
correction changes no plan status and makes no hosted exact-head success claim.

Local focused and real-browser success is not a hosted exact-head claim. Merge authority for this
corrective head requires both hosted `Quality gate` and `Browser E2E`, followed by the merged main
head's hosted workflows; this requirement does not reopen the already completed M10-T01B task. The
fixed-port local-launcher test may remain excluded while the user's deliberate port-5173 product
session is active; this environmental exclusion is not allowed on the clean hosted runner.

## M10-T02 input/pending CI authority

M10-T02 registers `desen-app-input-pending-fixture` as an ordinary proof pair and adds its dedicated
Chromium configuration to the existing Browser E2E package command. The hosted workflow executes
the browser journey and then runs the passive deterministic verifier and independent root mutation
suite. Integration and Production remain unavailable in that journey; no CI registration grants a
real host-operation authority or closes M10-T03/M10-T04.

The neutral exhaustive authority contains 212 workloads / 101 proof units, 4,533 leaf invocations,
and 323 distinct leaves at
`sha256:ed6bf5f52f7d6d077e0aa126f16ff88aff21d4d95f512e2274b7d4382f02e41f`. Its semantic impact
graph is `sha256:2f7840677851aed7c0e282a0b18bf36fc2f624cf0d051f7c5f7d1e4cf9a41c9f`; the App/T02 closure
contains 69 proof units / 148 workloads. Exact-one ownership covers 1,366 tracked paths, including
202 proof-owned paths, at path-set
`sha256:7c0ac5595f62da961a40b7a96b74373a0060427c45ddfa66fb30165696964108` and authority
`sha256:84d6dc6c09ea316ea93b41bb407d1d8972a3ad4312f0423d8ca7262e443f95b3`.

Reviewed checkpoint sequence 67 preserves sequences 1–66 and all 54 predecessor artifacts, adds
the 14,261-byte M10-T02 artifact at
`sha256:161202698b013775cbc89625ecea1f6894e9abcd927fb2eb660dff71652ba43d`, reseals only the
T01C proof/root readers `[106, 107]`, and appends the T02 proof/root readers `[108, 109]`. The
resulting 55-artifact / 110-reader authority closes at
`sha256:9ee6909c0f11ed7149cb9bf6ce1c7943ed99aac2d2c6f9138caea8f5dd2044b7` and passes 90/90.
Promotion pins the affected selector at
`sha256:2d83c5824bfe19b645ca5f05c3e38340e2079785d2945e444996f5712d6e14a3` and the
required-affected runner at
`sha256:70e92b42d05a3745ffca73394ea6a9d001af47e92132532abc0d5d2eb8e11a08`.

Shared-state metadata remains explicit for every workload: 90 ordinary and eleven barrier proof
units, 90 OS-temporary roots, 88 read-only proof units, and 103 OS-temporary-isolated proof units.
M10-T02 removes no workload, barrier, timeout, isolation rule, closing guard, or fresh hosted
execution. Local checkpoint and selector receipts are identity/impact authority only; merge still
requires the hosted `Quality gate` for the exact pull-request head, and the browser claim still
requires the hosted `Browser E2E` job for that same head.

## M10-T03 failure-fixture CI authority

M10-T03 registers `desen-app-failure-fixture` as ordinary proof pair 102, with
`scripts/verify-desen-app-failure-fixture.mjs` and
`tests/desen-app-failure-fixture.test.mjs`. Browser E2E now runs base, product, input/pending, and
failure Playwright configurations, and the frozen hosted workflow names the T03 pair explicitly.

The neutral authority contains 214 workloads / 102 proof units, 735 prerequisite segments, 4,535
leaf invocations, and 325 distinct leaves. Inventory, prerequisite, leaf-invocation, and
distinct-leaf digests are
`sha256:c1cec82a944152060e00caa1ad6f500c7f7e391d7056fe84f61967aef62ef947`,
`sha256:c1e1319ae65ec34b30f5b8817f5e6396271756bbdd95d4a964b858d7f7dd3c95`,
`sha256:752e23e301be0554677726de380410fca522ef97ad3e72dbbe37321985d58de8`, and
`sha256:2ef89a9ee2dc93cd70edfa71be2cda15628094bb03da8ac56a4e310d6870c0dd`.
The impact graph is
`sha256:91645dd903e4ade7f10f54dd6b07c65a49b355921a35946ee305ee9782aad0ee`;
the exact T03 closure is 70 proof units / 150 workloads at
`sha256:52619a1053d46d20e6efedc7e5e1b17dee372fe63c5438dd14c768ac7ff25cfa`.

Exact-one ownership covers 1,377 tracked / 204 proof-owned paths. Its path-set and authority are
`sha256:c7c9fe627f39e1fc10ccb5e6aec133ede0eb3f19c6bb7df89caa9023e9d1b48e` and
`sha256:903c1fabc314e2558e05aff85b810d279b045efdfd52494c2f08b281808533db`.
All workloads retain one shared-state class: six global, three workspace-output, one package-test,
89 proof-read-only, 104 proof-OS-temp-isolated, ten tracked-alias, and one workspace-temp. The 102
pairs remain 91 ordinary / eleven barriers with 91 OS-temporary roots.

Required/shadow exhaustive plans are
`sha256:f815d05c7edbe293b77b3819982d0076619bdd035e5eebac2112329bad06f904` and
`sha256:ac389e5063b153586f49303ec14a1228e8ef5605f337700d133884e8069fdb82`;
rollback equivalence retains plan
`sha256:e8de24915998a744d1abd6c6efced84059c37e46cf2f23c99ae2cd2b5e5b3e8b`
and workload set
`sha256:f709ed72c15555422717ee905fe9a8795ea9a4982e0df043966028420e433a89`.

Checkpoint sequence 68 adds the 16,868-byte artifact at
`sha256:bde909f8dbc4837c70627bab454d3dc5a936bd0abb6d70ec22b9cffbdb0e6a20`,
reseals only T02 readers `[108, 109]`, appends T03 readers `[110, 111]`, and closes 56 artifacts /
112 readers at
`sha256:e685779412ca17b76c78a56ff545bbff5a7fc5efc8bc564247cc49e7c54eeca8`.
The 91-test checkpoint suite passes. Selector and required-affected runner authorities are
`sha256:cb0638a65d9ba9bfcfecb780921a195da4c19de5af9512fb2a5169ecbf18fb2f`
and `sha256:ba00d7c81ca4392d50b0fc869434d531acd82a949cde376de051f93261e6f723`.
No local receipt claims exact-head hosted success or M10-T04 success/navigation/real-host authority.

## M10-T04 success and real-host-operation CI authority

M10-T04 registers `desen-app-success-host-operation` as ordinary proof pair 103. The exact
historical T03 proof and executable reference host-binding proof are both formal impact parents.
The neutral inventory is 216 workloads / 103 proof units at
`sha256:d6d00fb7ec87e41c75ada3ce3d65cb0d3cf9286936c437fa836bbec9eed372cc`;
the impact graph is
`sha256:ae57b2b84f3ba3077ecf589b1444d413213b8e54f9f4058368e8a11cc706c28b`.
The T04 closure is exactly 71 proof units / 152 workloads at
`sha256:548dcbecc29444b1ba8973a664459980fbbcbfe40b058bc8f624b78b2a69a065`.

Required/shadow exhaustive plans are
`sha256:f9a66d3729bea671bfe54405f8c6e4653699d69c38136ed1925cc3a714f3926a` and
`sha256:29ded9551d8adcba5f7b86819f344e1619441990c29f5e8ca63d4140530d87ab`.
Rollback equivalence retains plan
`sha256:d776a2dae959f391cbae65b761cc967278218a4ddd2666d60f810deda544c479`
and workload set
`sha256:f78a0d48096356f50ccda938cda60ca4703387d58ae29e4bfc4c412e420f2118`.
All 216 workloads retain one shared-state class: six global, three workspace-output, one
package-test, 90 proof-read-only, 105 proof-OS-temp-isolated, ten tracked-alias, and one
workspace-temp. The 103 pairs remain 92 ordinary / eleven barriers with 92 OS-temporary roots.

The fifth dedicated Playwright configuration owns the success/navigation and separately
authorized host-operation execution. Both new deterministic readers remain passive, with no
listener or external-network grants. The hosted workflow runs their exact verifier/root pair
after Browser E2E. No workload, barrier, timeout, isolation rule, closing guard, or fresh hosted
execution requirement is removed. A local receipt never grants exact-head hosted completion.

The product proof server's local-operation listener import is an anchored, exact source/target
exception, not a directory allowlist. Three boundary fixtures prove the admitted edge, reject an
unreviewed dev target, and reject the same target from a non-product-server entry. The six fixture
files remain shared proof infrastructure and therefore force exhaustive selection.

Exact-one ownership covers 1,409 tracked / 206 proof-owned paths. Its path-set and complete
authority are
`sha256:0895c89babc16970f34499279b1e791b1d42a4f0280e6d6dc9a4b523673aa6ef` and
`sha256:168ce27d3922269d3e51c485108c1acdbafdbbe74175d76d5d20c471162f8fc1`.
Only the two exact new verifier/root-test paths select the T04 closure; new application,
architecture, artifact, and shared proof implementation paths remain conservative exhaustive
inputs. The exact 32-path T04 extension preserves earlier ownership, and the cumulative inverse
successor delta preserves the frozen I07-04 promotion evidence.

Checkpoint sequence 69 preserves sequences 1–68 and all 56 predecessor artifacts. It adds the
22,456-byte artifact at
`sha256:d9d841af06ec9efc51c3f1c74079f0aa4d5e1c7e996f3b97df7e277e4b1f8423`, reseals the T01A/T01C
proof-library readers and T03 proof/root pair `[102, 106, 110, 111]`, appends T04 readers
`[112, 113]`, and closes 57 artifacts / 114 readers at
`sha256:535a09b42d158f9bdf934924f704f3fb278d68da84a3dcbbfa32e38cee375c61`.
Selector and required-affected runner authorities are
`sha256:ceb46eba37c63e46743fb03d4389a188928b7bedf13cab7190b276313210eae8` and
`sha256:a6734be24611dd476051db3c93d8672e2892afe9a1276d154e67127d6c10ea35`.
These are reviewed identity/impact receipts only; every selected hosted workload still executes
fresh before the exact current head may merge.

## M10-T05 published-host-update authority

M10-T05 registers `desen-app-published-host-update` as ordinary proof pair 105. The deterministic
verifier owns a runner-scoped OS-temporary Vite build authority; its independent root reader is
passive and read-only. The sixth Browser E2E configuration separately owns Chromium, the product
listener, control-plane listener, activation bridge, and reference host. The browser package builds
the Desen App, reference-host server, and reference-host client before running the six explicit
Playwright configurations. The hosted Browser E2E step invokes the T05 verifier/root pair only
after the real browser journey.

The 220-workload / 105-proof-unit inventory is
`sha256:66ae36cb2ec1c8a7bc7deee1a733e253cc1861d3b9ca1487c9725f437c3abf5a`.
It retains 735 prerequisite segments, 4,539 leaf invocations, and 329 distinct leaves. The exact
four-parent semantic graph is
`sha256:50ca74533c82b6a02977281f912cc4a37484c22aea7bfa60d343197f1ee81620`;
the T05 closure contains 73 proof units / 156 workloads at
`sha256:38923448f33f9c7e42b9d09641574ffc0e2c403c1080d7a42eaa56e5f0cd12d2`.
Shared-state authority contains 94 ordinary and eleven barrier pairs, 93 OS-temporary roots, 92
read-only proof workloads, and 107 OS-temporary-isolated proof workloads. The T05 verifier receives
only its exact Vite/runtime-probe class. Both verifier and root receive the exact
`DESEN_APP_PUBLISHED_HOST_UPDATE_VITE` native-addon policy because both perform fresh Vite builds.
The root keeps its ordinary Node test harness and isolated temporary directory, with no workspace
write, listener, or external-network authority.

The exact T05 verifier/root pair is prioritized only inside its existing ordinary segment to avoid
a final single-worker tail. All exclusive barriers, dependency checks, two-worker bounds, canonical
receipts, cancellation/closing guards, fresh executions, and time limits remain unchanged. The
selection does not add a cached-success path or omit any workload.

Exact-one ownership covers 1,446 tracked / 210 proof-owned paths. The path-set and ownership
digests are
`sha256:9cc6e2ebb16b60cc804ca2b7380bf1710d4aa960a363ec606b0574c641fbd53c`
and `sha256:dc6d534f81fa551fc37ca045a88b2424f10d5fc935cdc56f99aaa55a5efbcbc6`.
Application, browser, boundary, architecture, artifact, and shared proof inputs remain exhaustive;
only the exact T05 verifier/root files select the T05 closure.

Required/shadow exhaustive plans are
`sha256:30799382d92edf70455a42bc01e13973324bf1a916b5b925ad86c429b926fb2a`
and `sha256:0cb43b3c983e0e7ef6fb7536e08a90a9ce21a811eff22aab5767367c76b12641`.
Rollback equivalence retains plan
`sha256:f88698910808b705712c06d7c35c94b9f679df5f13e9f20d7af2d01c295dfad1`
and exact workload set
`sha256:39331deb57f2d8526e292a56aa031711bc1ca714631c3967f32f19dc5ff5d42f`.
Promotion pins selector and runner authorities at
`sha256:3fef221a77c9f222259774f9f8feaeedccedd7f8574cf3da5bd147cfe52b3680`
and `sha256:add4dbf618e7f019a76831799df3184e1ee0ca6638f1fa1ee2ac58c86a0f6eba`.

Checkpoint sequence 72 preserves all earlier checkpoints and 58 predecessor artifacts, adds the
189,123-byte T05 artifact at
`sha256:80c0b815a813ef462233b48a7fffe7c4d0bbf391aefc68eb9a6174da6bd84bd3`,
reseals M07-T11 readers `[38, 39]`, T01A readers `[102, 103]`, evergreen T01C readers `[106, 107]`, and T04 readers
`[112, 113]`, appends T05 readers `[116, 117]`, and closes 59 artifacts / 118
readers at
`sha256:2db218584d8ef0497f1da57a6e001e73e85b35c3c7eb02b48e049348d429d249`.
This seal authenticates current reader identity only. Every selected workload must execute fresh,
and merge still requires hosted `Quality gate` plus `Browser E2E` success for the exact current
head. G10 and later invalid-publication/recovery owners remain open.
