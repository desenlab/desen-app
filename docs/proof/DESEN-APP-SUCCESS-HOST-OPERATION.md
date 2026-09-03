# Desen App success and local host operation

Task: M10-T04

Status: DONE

P-09: PROVEN

P-10: PROVEN

Predecessor artifact: `sha256:bde909f8dbc4837c70627bab454d3dc5a936bd0abb6d70ec22b9cffbdb0e6a20`

Host binding artifact: `sha256:b0413687bd907b71509db52d3e22b6eda5a4150509ac323bf51e5f8425f897e2`

Historical bridge: `sha256:64f76eaeac8369a9f7ae00086dac914adc3c84979d53c770d2ebe0082576005f`

Final artifact: `sha256:d9d841af06ec9efc51c3f1c74079f0aa4d5e1c7e996f3b97df7e277e4b1f8423`

## Scope and product entry

This local closure record is merge-eligible only after the hosted Quality gate and Browser E2E
both pass for the exact current pull-request head. It does not itself record hosted success.

M10-T04 closes authored success, managed-surface navigation, and an explicitly selected real local
HTTP operation. The ordinary product now offers an additive authenticated Flow app workspace with
two empty, declared 420 × 720 surfaces, Start and Result. It reuses the trusted reference Catalog,
registry and tokens without inheriting executable Integration authority. Its independent Source
identity and storage key do not rewrite or invalidate the existing Account app Source.

A designer selects Flow app in the visible workspace chooser, creates its blank project, opens
Result through the normal project/surface navigation, and inserts its destination Text. On Start,
the designer inserts the controlled fields, Button and conditional critical Alert, connects the
Catalog operation with the deliberately non-default result name `submitCredentials`, and adds
a Navigate action under its Success group, targeting Result. The whole flow uses normal visible
controls, not Advanced JSON, a proof-only route, seeded Source, browser script injection, or direct
network mutation. Workspace changes honor the existing dirty-draft navigation guard.

## Synthetic and explicit Integration evidence

The first Run remains Synthetic. Full typed input reaches the controlled state, explicit Catalog
fixture completion enters success, and the authored Navigate action mounts Result. There are zero
real operation HTTP calls, no Source write, and no browser-route change.

After Restart run, selecting Integration explicitly activates an independently authenticated
App-owned binding. Fixture controls disappear; Production remains disabled. Its endpoint is fixed
in trusted local composition rather than read from DESEN Source. The same authored input/action
tree reaches the real loopback HTTP service through the existing reference host-operation
binding.

The visible local test account is `designer@example.test` / `local-demo-pass`. These are
documented test-only values, not production credentials or an authentication service. A wrong
password receives HTTP 401 and the declared public failure; the managed origin and typed values
remain, and Result does not mount. A valid retry receives HTTP 200 with
`{ "userId": "local-host-user" }`, deliberately different from the Catalog success fixture
`{ "userId": "user-1" }`. Runtime validates that host candidate before the authored success
action mounts Result. The browser observes exactly two real HTTP operation calls across those
Integration attempts.

Source generation, captured PUT count and exact Source bytes stay unchanged throughout both Run
contexts. Neither typed credentials nor host output appear in saved Source. The frame geometry
stays identical across Synthetic success, Integration failure and Integration success. Restart
run and Design restore the authored origin; reload reopens the saved design with blank Runtime
input, not a persisted simulation state.

## Least-authority and negative coverage

Integration handles are factory-authenticated and bound to the exact opaque workspace profile,
admitted document, content-derived revision, surface, authored invocation alias, capability and
effect. Admission never creates executable authority from route strings or Source metadata.
Inactive, foreign, forged, replayed, mismatched and unbound requests fail closed before host I/O.
Input is defensively detached; the bounded replay ledger, pending AbortSignal and lifetime epoch
fence cancellation, reentrancy and late settlements. Only Runtime owns accepted output-schema and
public-error interpretation; an adapter response is not itself an accepted operation success.

Managed navigation is a revocable App-owned port. It checks the exact active Run origin and permits
only admitted in-document destination surfaces with detached bounded JSON parameters. It never
grants browser navigation, durable storage, publication, resource loading, tokens, or production
environment authority. Policy callbacks cannot reenter or revive a revoked transition.

The local operation listener validates its loopback host, exact browser origin and independent
bearer. Persistence and operation credentials cannot be reused. Client input is bounded at
16 KiB, response at 64 KiB and 1,024 chunks, with one 15-second timeout and no retry. The listener
bounds input at 16 KiB / 1,024 chunks / 10 seconds and caps concurrent connections. Unexpected
transport failures are redacted; request credentials are neither logged nor stored. Generic editor
and Integration modules contain no sign-in endpoint, reference user, public error-code, or
fixture-success fallback branch.

## Reproduction and verification

The deterministic reader only checks committed authorities and bytes. It starts no Chromium,
Vite, network listener, host callback, or external request. The dedicated browser workload remains
a fresh execution of the normal product and separate local HTTP host:

```bash
pnpm --filter @desen/app-web exec vitest run test/local-workspaces.test.tsx test/reference-flow-workspace-profile.test.ts test/authoring-integration.test.ts test/local-operation-binding.test.ts test/authoring-run-navigation.test.ts test/success-host-navigation.test.tsx dev/local-operation-host.test.mjs dev/local-dev-host.test.mjs
pnpm --filter @desen/runtime-core exec vitest run test/operation-lifecycle.test.ts
pnpm --filter @desen/app-browser-e2e exec playwright test --config success-host-playwright.config.ts
node scripts/verify-desen-app-success-host-operation.mjs
node --test tests/desen-app-success-host-operation.test.mjs
```

The eight focused App suites pass 141/141 and Runtime operation lifecycle passes 36/36:
177/177 combined. The reader records 125 `it` / `it.each` declaration sites, explicitly not
the expanded execution count. The complete App suite passes 45 files / 611 tests. The dedicated
success/host Chromium journey passes 1/1; the complete browser command passes all five independent
T01, T01A, T02, T03 and T04 journeys.
The independent T04 root mutation reader passes 10/10, and the unchanged historical T01C, T02
and T03 evidence each passes its verifier and 10-case root suite: 40/40 root cases combined.

## Immutable authority and historical compatibility

The 22,456-byte T04 artifact contains 51 exact tracked receipts. It directly authenticates both the
frozen T03 failure artifact and the M03-T08 reference host-binding artifact; it does not invoke
their readers or reinterpret their historical claims.

The separately pinned 2,769,997-byte canonical gzip bridge contains 34 T03 task-time files plus
eight exact T01A/T01B predecessor-gap files, one T03 projection and exactly 16 successor-added
product/browser paths. Bounded decompression yields 4,385,030 bytes from exact base
`a1d26905aec6ee3d4bcb73ca17b02187e7b57420`. Old readers continue using authenticated task-time
inputs while caller-provided mutation cases remain effective. Historical artifact bytes are never
rewritten. The current T04 reader and independent root mutation test remain checkpoint-owned.

All eight gap bytes match immutable T01A/T01B receipts and the exact T03 base commit. Historical
materialization and the late T01A compatibility checks use the same authenticated baseline, with
caller mutations applied last. An unchanged eight-gap override passes; three negative controls
identify the intentionally changed successor artifact, behavior receipt or hosted-browser receipt
by their exact error messages. Unrelated current package or boundary bytes cannot mask a probe.
Historical path projection removes only the sixteen exact T04 additions after authenticating
their current receipts. Unreviewed or renamed paths remain visible to the complete-inventory
policy; forged, accessor-backed, duplicate or escaping inventories are rejected. The four
affected M09 adapter-canvas mutations pass, followed by its full 18-case reader and T04's ten
cases (28/28). The preceding 22-family passive audit retained 300 passing cases; it was not a
product/browser rerun or the exhaustive local gate command.

Nine receipts bind the actual dependency-boundary configuration, fixture verifier, boundary
runbook and six files for three precise edge cases. Only the anchored product proof-server entry
may load the exact normal developer listener. Adjacent dev modules and other browser importers
remain forbidden; the prior public-Control-Plane-only edge remains intact. This is explicit reuse
of the normal host, not a browser-only substitute. The actual `pnpm boundaries` command passes
854 modules / 3,644 dependencies and all 26 positive/negative fixtures. The passive proof reader
binds and mutation-tests those authorities without executing dependency-cruiser.

## CI successor authority

The neutral inventory contains 216 workloads / 103 proof units at
`sha256:d6d00fb7ec87e41c75ada3ce3d65cb0d3cf9286936c437fa836bbec9eed372cc`, with 92 ordinary
and eleven barrier pairs. Its 735 prerequisite segments bind 4,537 leaf invocations and 327
distinct leaves. The new ordinary pair has both T03 and the genuine reference host-binding proof
as semantic parents; its closure contains 71 proof units / 152 workloads at
`sha256:548dcbecc29444b1ba8973a664459980fbbcbfe40b058bc8f624b78b2a69a065`. The complete graph
is `sha256:ae57b2b84f3ba3077ecf589b1444d413213b8e54f9f4058368e8a11cc706c28b`.

Exact-one ownership covers 1,409 tracked / 206 proof-owned paths. The path set is
`sha256:0895c89babc16970f34499279b1e791b1d42a4f0280e6d6dc9a4b523673aa6ef`; its authority is
`sha256:168ce27d3922269d3e51c485108c1acdbafdbbe74175d76d5d20c471162f8fc1`. All 32 new
paths are explicitly assigned; new product and shared-proof files remain conservative exhaustive
inputs rather than receiving an artificially narrow proof-only owner.

Checkpoint sequence 69 preserves sequences 1–68 and all 56 predecessor artifacts. It reseals the
T01A and T01C libraries and T03 pair at indexes `[102, 106, 110, 111]`, appends T04 readers
`[112, 113]`, and closes 57 artifacts / 114 readers at
`sha256:535a09b42d158f9bdf934924f704f3fb278d68da84a3dcbbfa32e38cee375c61`.
The checkpoint suite passes 92/92. The ten focused CI policy suites pass 252/252, for 344/344
combined. After the final checkpoint-only pin update, the selector/promotion subset passes
52/52. Promotion binds selector
`sha256:ceb46eba37c63e46743fb03d4389a188928b7bedf13cab7190b276313210eae8` and runner
`sha256:a6734be24611dd476051db3c93d8672e2892afe9a1276d154e67127d6c10ea35`. No workload,
barrier, timeout, isolation rule or fresh exact-head hosted gate requirement is removed.

## Explicit nonclaims

P-09 and P-10 close only their authored behavior and host-code/document separation claims for
the established reference slice. This test-only local Integration endpoint is not production
authentication, a remote deployment, arbitrary endpoint authoring, or multi-user persistence.
It does not close N-036, N-040, the later publication/activation tasks or G10, and it does not
advance their existing normative statuses. The frozen T03 artifact continues to record its
then-partial success/host scope. Local focused, artifact and Chromium results do not imply a
hosted exact-current-head Quality gate pass.
