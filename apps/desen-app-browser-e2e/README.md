# Desen App browser E2E

`@desen/app-browser-e2e` is the isolated real-browser proof workspace for Desen App. It owns the
Playwright, Vite, Chromium, and failure-artifact lifecycle without adding those concerns to the
product App manifest or normal App build.

The original T01 harness imports the production `DesenAppApplication`, its styles, and the admitted
empty reference project directly from `@desen/app-web` source. The later journeys use the ordinary
product entry with temporary instances of its local persistence service. Its package-level
`test:e2e` command first builds the complete product dependency closure and the independent
reference host, then typechecks and builds the harness before running all nine Chromium journeys.
The original in-memory compare-and-set
adapter is test-only and is never imported by the product entry.

Install the package-pinned browser once:

```bash
pnpm --filter @desen/app-browser-e2e exec playwright install chromium
```

Run the complete browser proof:

```bash
pnpm --filter @desen/app-browser-e2e test:e2e
```

Run individual harness checks when diagnosing a failure:

```bash
pnpm --filter @desen/app-browser-e2e lint
pnpm --filter @desen/app-browser-e2e typecheck
pnpm --filter @desen/app-browser-e2e build
```

Playwright writes retained failure traces, screenshots, and video under `test-results/`, with its
HTML report under `playwright-report/`. Both directories and the production proof bundle in
`dist/` are generated outputs and must not be committed.

The nine independently configured journeys cover:

- M10-T01: empty-project visual authoring, authenticated native drag, canonical persistence,
  structural re-admission, and exact Design/Run static parity.
- M10-T01A: the ordinary product's visible new-project, reopen, save, and reload flow.
- M10-T02: visually connected controlled inputs and the real Runtime pending lifecycle.
- M10-T03: declared failure, conditional Alert, retry, and stable frame geometry.
- M10-T04: visual two-surface authoring, synthetic success with zero host requests, and explicit
  Integration through a real local HTTP operation. A real 401 leaves the origin mounted; a real
  200 mounts the authored destination through the same Publisher and Runtime adapters. Run does
  not save transient input, response data, or navigation into Source.
- M10-T05: normal-product blank-project authoring, two visible Save → Publish → Activate cycles,
  and reload of a separately built reference host. The managed Text label, Stack gap, and Bundle
  revision change from A to B while a digest of the host HTML and assets remains identical; a
  second reload preserves B.
- M10-T06: a visually authored and published baseline followed by explicitly advanced Source
  negative-input cases. Invalid component prop, undeclared event, and undeclared slot candidates
  are entered in the normal product's visible Advanced Source editor. Fresh validation rejects
  each candidate with a diagnostic linked to its exact node, while the committed canvas, saved
  Source, channel, and active host remain unchanged. Each repaired candidate is applied, saved,
  and published through the ordinary controls before the independently built host reloads it.
- M10-T07: visibly published A then C establish active C and previous-good A. Explicitly isolated
  transport-negative fixtures place a corrupt-revision Bundle and a self-consistent Bundle with a
  mismatched Catalog digest on the real channel using authenticated public PUT/CAS. For each,
  the ordinary host preserves C before and after complete service-process termination and a new
  PID, while the bad candidate remains on the channel. Fresh browser contexts reopen the saved
  project and recovered host; a final visible valid publication D activates without changing App
  source or rebuilding the host.
- M10-T08: two complete normal demo resets, each starting from empty product inventory and visibly
  authoring the same Flow with native insertion/reordering, connected inputs, an explicitly named
  operation, failed-operation visibility, and success navigation. Each cycle exercises Synthetic
  pending/failure/success and explicit Integration 401/200, then publishes to the independent host,
  interacts with it, and visibly edits the title and Stack gap before republishing. Actual canonical
  Source and Bundle bytes for both publications must be identical across resets, without ID or
  timestamp normalization.

The T04 server uses `product-proof-server.mjs --with-operations` on port 4176. It starts the same
bounded loopback operation service used by the normal developer launcher, with fresh credentials
separate from Source persistence. The test observes requests and responses; it never intercepts or
fulfills them. It authors the operation alias and Success → Navigate action through visible
controls without injected Source or required JSON. The local account service is explicitly a test
binding, not production authentication. Account app remains a separate saved workspace; Flow app
starts from its own blank `start` and `result` surfaces.

The T05 proof uses `published-host-proof-server.mjs`: the ordinary product is built at port 4177
with a fresh local publication profile, while the independently built reference host is served at
port 4178. The browser does not inject Source, fulfill requests, select an endpoint, or mutate the
host. The proof server owns temporary storage and deletes it on shutdown.

T06 reuses that unchanged isolated server in a separate sequential Playwright configuration.
Its negative fixtures deliberately exercise the optional Advanced Source editor; they are not
presented as invalid values authored through ordinary constrained Inspector controls. The browser
never injects an editor document, intercepts or fulfills a request, mutates the host, or reads a
hidden test API. It observes outgoing Source, Bundle, channel, and activation requests, and the
actual host refresh response's active generation/revision. Rejected candidates emit none of those
writes. The previous host's HTML and asset digest remains identical across every rejection and
valid repair. Discarding an unapplied draft also preserves the saved Source and active host.

Run only this slice after building its ordinary product dependency closure:

```bash
pnpm --filter @desen/app-browser-e2e exec playwright test --config invalid-publication-playwright.config.ts
```

T07 uses `restart-recovery-proof-server.mjs`, supervised through a closed Node IPC protocol by
`restart-recovery.pw.ts`, on isolated ports 4179/4180. It starts the normal App entry, public local
control plane, exact App activation bridge, and independently built reference host. Each restart
awaits complete process exit and starts a new child against the same private durable root,
unchanged host build, and supervisor-owned ephemeral loopback credentials. The existing activation
bridge intentionally allocates a fresh port on every start. Only the normal App is rebuilt in the
same private output directory to capture that fresh trusted origin; its source-byte fingerprint
must remain unchanged and each process's App build is recorded separately. No
runtime handle, browser context, editable Source injection, private SQL access, or privileged
HTTP test endpoint crosses the restart. The sole negative writes are explicitly named Bundle
transport fixtures; they are not claimed as normal designer authoring. Public verification
independently identifies `REVISION_MISMATCH` and `CATALOG_DIGEST_MISMATCH`; real Chromium still
must show the preserved/recovered product output. Durable active/previous-good identities,
activation generation, saved Source bytes, App source, and served host fingerprints are checked separately
from the bad channel pointer. Cleanup deletes only the owned temporary root after the child exits.

For this suite, Playwright trace snapshots/network recording, source inclusion, and trace
attachments are disabled. Action timelines and screenshot frames remain, and failed runs retain
videos plus sanitized JSON receipts. Credentials are neither fixture documents nor evidence;
raw IPC boot messages, HTTP headers, response bodies, and generated App configuration are never
attached or logged. Previous suites' trace settings are unchanged.

Run only the cold-restart slice after building the ordinary dependency closure:

```bash
pnpm --filter @desen/app-browser-e2e exec playwright test --config restart-recovery-playwright.config.ts
```

This proves rejection of a bad channel candidate while the durable active/previous-good Bundles
and installed package remain intact. It does not prove automatic rollback after corruption of
those durable good Bundles, hostile-administrator tamper resistance, production identity,
remote deployment, N-036, or G10 closure.

T08 uses `repeatable-demo-proof-server.mjs` only as an IPC-owned wrapper around the same
`startDesenAppLocalDemo` lifecycle used by `pnpm demo:reset`. It owns no alternative product entry,
Source seed, privileged HTTP reset endpoint, or control-plane mutation path. It uses the normal
port 5173 and fixed `.desen/m10-demo/current` namespace; reset retains the previous dataset in
`.desen/m10-demo/previous`. Each browser context closes before the normal host is fully closed and
the next reset begins. An occupied port or active demo lease fails explicitly, without killing an
unrelated server. Stop an existing developer session before running this suite.

The two publication pairs compare the actual captured request bytes as canonical JSON, not a
normalized reconstruction. Synthetic input and response state never becomes saved Source. The
independent host's HTML and assets remain identical between A and B within each cycle. Normal
startup may rebuild the host between cycles, so the suite makes no cross-start build-identity
claim. The nondefault operation alias is authored through the product; the same-origin local
test-account binding is trusted launcher configuration, not an endpoint chosen by Source.

T08 retains the same secret-conscious trace controls as T07: action timelines and screenshots,
but no network snapshots, source files, or attachments in traces. Failure receipts contain only
hashes, finite stage names, and non-secret lifecycle observations. Captured Source/Bundle bytes,
ephemeral credentials, headers, and generated configuration are never attached. The public local
test-account instructions remain visible in the product Run controls.

Run only the repeatable demo after building the ordinary dependency closure:

```bash
pnpm --filter @desen/app-browser-e2e exec playwright test --config repeatable-demo-playwright.config.ts
```

The human walkthrough uses those same normal controls and reset command in
[`DEMO-RUNBOOK.md`](../../docs/plan/DEMO-RUNBOOK.md). This is repeatable local test-account evidence,
not production authentication, deployment, or a claim that the static proof reader runs Chromium.
