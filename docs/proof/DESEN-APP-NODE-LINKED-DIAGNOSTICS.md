# Desen App node-linked diagnostics

Task: M09-T13

Status: DONE

## Reviewed boundary

Rejected local authoring candidates now retain the exact immutable Editor Core continuous-validation
report without replacing the last-known-good authored Source or preview. The App fences that report
by its candidate document and Catalog-set fingerprints, exact project/surface route, and the still
current committed-document owner. A successful edit, Open, route change, Catalog change, or
committed Source replacement revokes the transient report and its selection authority.

Only the Validator's explicit `invalidSubjects` context identity can create a selectable node or
behavior target. Diagnostic code, message, JSON pointer, capability, and incidental context text
remain presentation metadata. Duplicate occurrence pointers retain Validator order and distinct
snapshot-bound selection keys. Unmapped and out-of-route diagnostics remain readable but cannot be
selected. The App stores only an opaque selection key and re-admits it from the current projection;
stale report, route, Catalog, Runtime-kind, or committed-owner authority fails closed without a
partial target model.

The current public Runtime React diagnostic index distinguishes a materialized Source identity from
an invalid placeholder. The selected placeholder is App-owned chrome rendered as a sibling outside
the managed Runtime capability subtree, so the last valid preview remains intact. Diagnostics and
placeholders are Design-only. Entering Run hides them, and no panel or placeholder steals focus;
placeholder focus occurs only after an explicit, currently admitted target selection.

Dynamic validation obligations are copied into a closed callback-free visible metadata shape. They
are never resolved or executed. Rejected-candidate diagnostics remain outside committed Source,
canonical dirty-state comparison, persistence generations, and Save requests.

## Local receipts

- Focused diagnostics suite: 9 files, 161/161 tests passed.
- Full Desen App suite: 24 files, 339/339 tests passed.
- Desen App build and typecheck passed in the reviewed product run.
- Independent proof mutation suite: 12/12 tests passed.
- Deterministic proof boundary: 39 tracked files and 11 immutable parent artifacts.
- Deterministic artifact: 27,353 bytes of Prettier-compatible canonical two-space JSON.

The focused inventory is exact: diagnostics projection 7, diagnostics panel 4, Inspector 27, state
13, event/action 13, named slots 28, adapter canvas 10, application 42, and persistence application 17. The full App 24/339 receipt is retained as reviewed local evidence; the focused 9/161 command is
the proof-run authority.

The append-only current-reader checkpoint advances sequence 51 head
`sha256:42e88946b598566a46237af8d30587fa765d9d58807e864464fc5525fbc64921` to sequence 52 head
`sha256:0b2aae1b67d212b4274ad1e75c22053d91ff530055ba8b189d8d9318ef8bd463` across 48 frozen
artifacts and 96 current readers. Promotion pins the selector at
`sha256:36bc9d960f4755fd82ae016bd697182278ff204a77f7065b874b7434ac609683` and the required-affected
runner authority at `sha256:42cf5315ba073bd1748c93a30819d983374823c4295fcdc664aa656d3360b0e1`.
Checkpoint, promotion, selector, required-affected, and CI quality-gate regression suites pass
75/75, 19/19, 22/22, 38/38, and 28/28 locally—182/182 combined. These closure receipts are local;
no required-gate or hosted-CI pass is claimed.

## Frozen parents

- M05-T05 `runtime-react` reconciliation diagnostics: 19,234 bytes,
  `sha256:292731d7eff67d5c80bd0de0d0c940c9783e49efd34069c5c11cc9eb4264dbfb`.
- M08-T09 `editor-core-continuous-validation`: 40,099 bytes,
  `sha256:7739b5143685d613a678c6eca5480f27a5a303b176bf2bf4613a4d6917fe7e5a`.
- M09-T04 `desen-app-selection-overlay`: 11,997 bytes,
  `sha256:9a3805545ea49820c744fc07b9c3b0c2919b3e2fb524f9855df1cec9058901b1`.
- M09-T05 `desen-app-schema-inspector`: 22,998 bytes,
  `sha256:473ab3248ed7b7b4de0e558df47159a74c28c134b46569aa91130745fd69660b`.
- M09-T06 `desen-app-structured-inspector`: 26,133 bytes,
  `sha256:6ea4eb3f51fdfc39eeca676d7ebafb145d66a9efdfa03af9c33a7aa39aa6aaec`.
- M09-T07 `desen-app-named-slot-authoring`: 24,830 bytes,
  `sha256:daae817af45d8ead7052fd84df4edefd7d29cdd9ebe9cc1baea5b22b27dae90f`.
- M09-T08 `desen-app-state-binding-editor`: 28,766 bytes,
  `sha256:b7298375cba4b82258d1c293ecb66c3ae6641408ae9f5753da121ac44fcf601a`.
- M09-T09 `desen-app-event-action-editor`: 23,812 bytes,
  `sha256:0060ef39273ea36666f1701d5d3fa0f1610b95f40d88304ba980dcdc73cb29ab`.
- M09-T10 `desen-app-design-run-modes`: 17,900 bytes,
  `sha256:bc5b7ffef0c39737882072f9340bcade86f084db8e7923fcb03aa7364d077334`.
- M09-T11 `desen-app-fixtures-scenarios-fidelity`: 29,407 bytes,
  `sha256:3f08980e687d48ba267f78c7d4dd1ae1eb59db5cc6bb3401d88705ee0416cc9d`.
- M09-T12 `desen-app-source-persistence`: 27,053 bytes,
  `sha256:717d0ddada008edb34909d5defcc4c28e95b36f6dfc0b1abb4d09d9775a6b734`.

The M09-T13 reader authenticates those exact bytes and reviewed claims before evaluating current
source, tests, and package wiring. Parent proof commands are not nested inside the T13 package
command; the affected-impact graph owns their separate prerequisite workloads, avoiding repeated
long suites without weakening freshness or closure.

## Status register

P-08: NOT_PROVEN

P-16: PROVEN

PF-086: OPEN

PF-089: OPEN

M09-T14: NOT_PROVEN

P-16 is proven for the selected Web–React profile by composing the frozen callback-free Runtime
diagnostic index with explicit Validator subject mapping and snapshot-bound App selection. PF-086
remains open because DESEN 0.1.0 still defines no interoperable diagnostic-index or editor
subscription profile. M09-T13 does not claim publication, activation, a concrete storage adapter,
automated real-browser E2E, a required gate, or a hosted-CI pass.

Final artifact: `sha256:b18cfc2a5999202e0e9641a8efdcdb6972253911372a09bfb73d5b06e1efd12c`
