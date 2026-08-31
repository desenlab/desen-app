# ADR 0016: Bootstrap local Desen App projects through the normal product boundary

- Status: Accepted
- Date: 2026-08-31
- Decision owner: M10-T01A
- Implementation status: Complete

## Context

M10-T01 proved the visual authoring workflow in real Chromium, but its isolated proof application
supplied both an empty Source document and an editor route directly. That was valid evidence for
the editor controls, persistence contract, native drag behavior, and Design/Run parity, yet it did
not make the same workflow reachable by a person entering the normal Desen App.

The product entry also had no durable browser composition. Mounting a fixture document when a
storage authority is absent would make the editor appear usable while silently discarding the
user's work. Using browser storage as an alternate authority would bypass the generation-guarded
Editor Core port and the existing local control-plane boundary. Letting a project dialog advertise
arbitrary names or templates while persisting one fixed internal Source identity would be equally
misleading.

## Decision

### The normal entry owns one explicit product bootstrap

`apps/desen-app/src/main.tsx` mounts `DesenAppProduct`, not the browser-proof application. The
product bootstrap receives a host-composed `DesenEditorPersistencePort`, opens the exact supported
`account-app/sign-in` Source before mounting an editor session, and presents one of three honest
states:

- an opening or controlled unavailable screen while storage authority is unresolved;
- an empty Projects view with an enabled **New project** action when no Source exists;
- the admitted saved project and its surface when a stored Source opens successfully.

The visible creation dialog offers one accurately named **Blank sign-in project** profile. It
creates the already admitted empty reference Source through the generation-CAS persistence
controller. Only a successful create, update, or unchanged settlement navigates into the editor.
Conflict, indeterminate, exhausted-generation, and failed settlements remain visible and never
overwrite or substitute a document.

This task deliberately does not pretend to support arbitrary project identities, surface schemas,
targets, or templates. Those capabilities require a later generalized identity and Catalog design.

### Local development composes the existing public persistence boundary

The application-owned launcher starts the public local control plane on a system-selected
fixed-loopback port, generates a fresh 256-bit bearer secret in memory, and injects the exact
versioned runtime configuration into Vite. Browser requests are restricted to the admitted
`http://127.0.0.1:<port>` origin, omit ambient credentials and referrers, reject redirects, use a
finite timeout, and bound response headers and bodies before the public Editor Web adapter sees
them.

The durable development Source store lives under the repository-local, private, non-symlink
`.desen/desen-app/control-plane` directory, outside Vite's served App root. As a second boundary,
the launcher preserves Vite's default secret-file deny set, adds `.desen`, and rejects direct,
encoded, case-varying, and `/@fs/` state requests with `403` before SPA fallback. The bearer secret
is not read from source, environment files, URL state, browser storage, or checked-in
configuration. A missing or malformed runtime authority fails closed in a fixture-free unavailable
screen.

### Product E2E uses production composition and visible controls only

The M10-T01A Chromium scenario builds the normal product entry, starts a real temporary local
control plane, and opens `/`. It does not import the proof application, inject a Source document,
or force an editor route. The scenario begins with zero projects; uses **New project**, the visible
blank template, and **Create project**; observes generation 1; authors the sign-in screen with the
same real editor controls; saves generation 2; hard-reloads; and reopens the project and surface
through visible navigation.

The test-only server owns only process composition and an isolated temporary storage directory.
Product behavior remains in the normal application modules. The deterministic proof reader never
starts Chromium, Vite, or a listener; exact-head CI runs the browser scenario separately.

## Consequences

- A person and the browser proof now enter the same normal product composition.
- The project list reflects durable Source existence rather than a fixture inventory.
- Creation and subsequent authoring share one generation-guarded persistence controller, so a
  reload or a new navigation path reopens the exact saved Source.
- M10-T01 and M10-T01-COMPAT artifacts remain immutable historical evidence; M10-T01A is their
  append-only product-reachability successor.
- The local runtime remains a development composition. Remote deployment, TLS, multi-user
  tenancy, credential lifecycle, arbitrary project/template creation, M10-T02 runtime pending,
  M10-T03 public failure, M10-T04 success/host operation, and G10 closure remain outside this
  decision.
