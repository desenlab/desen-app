# ADR 0022: Repeatable local demo through the normal product

- Status: Accepted
- Date: 2026-09-08
- Decision owner: M10-T08

## Context

The completed M10 tasks prove visual authoring, Synthetic and Integration lifetimes, publication,
invalid-candidate rejection, and cold recovery. Their evidence must also be reproducible by a
person following one coherent local runbook. The Flow workspace supports authored navigation but
previously lacked the Account workspace's publication port. The independent reference host admitted
only the Account document and did not implement its optional local operation endpoint. Joining these
composition boundaries is necessary; inserting a prepared Source or a handwritten screen is not.

## Decision

### One normal product, one reusable demo store

`pnpm demo` starts the existing normal App entry and local launcher on port 5173. `pnpm demo:reset`
starts the same composition after resetting only `.desen/m10-demo/current`. The seed is an empty
durable store: the designer still creates a project and authors all managed content through visible
controls. The normal `.desen/desen-app` store remains untouched. There are no alternate development
checkouts, positive Source imports, browser-injected documents, or hidden reset HTTP endpoints.

The demo root is private, canonical and explicitly marked as application-owned. An exclusive file
lease prevents concurrent startup or reset. Reset admits a finite tree without symbolic links,
hard-linked files, special files, or externally writable descendants, then rotates the current
generation into the fixed `previous` slot. Only the older, separately admitted backup is removed;
there are never accumulating timestamped state roots. A failure creating the new current slot
restores the previous one. A replaced root, marker or lease grants no cleanup authority.

Normal shutdown closes all composed services before releasing the lease. Unknown startup cleanup
and failed shutdown leave ownership locked for inspection. A crash lock is not automatically
reclaimed from an untrusted PID or by killing the process occupying 5173. This is a cooperative
local-development ownership boundary, not resistance to an attacker controlling the same OS user.

The composed launcher owns the editor HTTP transport and uses Vite's public middleware mode,
including the same-server WebSocket connection. Vite must not independently terminate the process
on SIGTERM or stdin closure before other services and the demo lease finish closing. The CLI
handles repeated shutdown signals idempotently and drains an interrupted startup before cleanup.
There is no global signal-handler removal, process-exit monkeypatch or second editor listener.

### Trusted composition connects Flow, not generic editor heuristics

The normal product root supplies the existing fixed publication port to both installed workspace
profiles. Each retains its original Source identity and persistence key; no migration occurs.
The independent host installs a finite reviewed admission inventory for Account and Flow. Bundle
identity may select only an already installed data-admission policy, never a module, endpoint,
credential, callback or dynamically constructed profile. Server admission and browser admission
agree before an Active receipt can be reported. The single `preview` channel displays the latest
valid publication, not multiple simultaneous tenants.

Operation authority remains bound to the exact active document, revision, surface, capability,
effect and valid authored result alias. The Flow example does not require a literal `signIn` alias.
Each profile admits only its own registered destination routes. Runtime Core still executes the
authored settlement and managed navigation; the host supplies no manually recreated sign-in or
result tree. No Runtime Core or frozen protocol change is needed.

### A local test account is an explicitly installed server capability

The standalone reference server keeps `POST /api/sign-in` disabled by default. The trusted local
launcher opts in with the same bounded test-account decision already used by App Integration.
The route is fixed and same-origin, with strict request shape, finite body/time/connection bounds,
declared redacted outcomes and cancellation. Source, Catalog and Bundle data cannot enable it.
The test account remains `designer@example.test` / `local-demo-pass`; successful output is
`local-host-user`, distinct from the Synthetic Catalog fixture. This is not production identity,
remote deployment, user registration or a credential database.

## Verification and limits

The new Chromium journey must use the ordinary New project and visual behavior controls, exercise
Synthetic and explicit Integration, publish the same authored Flow to the independent host, then
change a label and layout property and republish. Two complete reset/authoring cycles compare the
actual Source and Bundle bytes and revisions without removing IDs or normalizing differences away.
The independent host's served HTML/assets remain unchanged between publications within each
startup. Normal startup builds the host afresh; this task does not relabel startup as build reuse.
T07 retains its separate stricter no-host-rebuild cold-recovery evidence.

All eight earlier browser journeys and immutable artifacts remain. Checkpoints authenticate current
identity; they do not replace fresh execution. T09 owns the committed Runtime Core comparison
baseline, G10 owns full closure, and M11/M12 extensions remain outside this decision.
