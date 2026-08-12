# ADR 0015: Consume mutable channels through a server-owned activation boundary

- Status: Accepted
- Date: 2026-08-12
- Decision owner: M07-T11
- Implementation status: Complete

## Context

The separately built Web reference host must consume a mutable M07-T05 channel without turning
that discovery record into runtime authority. The existing reference host is a client-only Vite
application. Importing `@desen/control-plane-api` into its browser graph would expose Node,
filesystem, Fastify, SQLite, and bearer-secret concerns to untrusted client code and would break
the M05-T09 independent-host boundary.

The M07-T07 through M07-T10 activation service already owns the durable
`{ activeRevision, previousGoodRevision, generation }` transaction and restart reconstruction.
M07-T11 must compose those public boundaries rather than implement a second activation record or
let the browser decide which revision is active.

## Decision

### A separately built Node host server owns channel consumption

`apps/reference-host-web-server` is a distinct Node composition root. It may import only the
public `@desen/control-plane-api` package root and the dependencies explicitly assigned to this
host-server responsibility. It may not import control-plane private paths, Desen App, `desen.run`,
editor code, Publisher, `testkit`, the broad `desen` facade, or reference-host browser source.

This is one reviewed application-composition edge. It does not make general app-to-app imports
legal. Packages still never import applications, and the browser application still imports no
application package.

The server reads the configured fixed channel and its immutable Bundle through the real
bearer-authenticated M07-T05 loopback HTTP surface. It then runs the public T02 integrity, T03
installed-package, T04 reference, T06 staging, and T07/T08 activation or recovery boundaries in
their required order. A channel record is only bounded activation intent. Matching its revision
and generation does not authenticate the Bundle, package, references, staging result, durable
record, or active runtime authority.

The T05 response framing is exact and route-specific: a channel response must be
`application/json; charset=utf-8`, while an immutable Bundle response must be
`application/json`. Redirected, encoded, BOM-prefixed, oversized, or differently typed bodies
fail closed.

### Installed package material is host-owned and inert

The server receives one fixed application-owned installed-package directory in its trusted
configuration. A bounded loader reads `catalog.json` and the complete `dist/**` inventory without
following symbolic links or accepting hard links, special files, aliases, traversal, dynamic
module selectors, callbacks, or network locations. It rejects file or canonical-parent identity
drift observed during acquisition and supplies copied inert bytes to M07-T03. Bundle data cannot
select the package root, module, export, adapter, or executable code.

### Durable activation precedes browser delivery

The server exposes one same-origin browser endpoint:

```text
POST /__desen/runtime/refresh
```

The request has no body, query, cookie, bearer token, control-plane origin, or channel selector.
The server owns the configured channel, both upstream bearer secrets, the installed package root,
and the activation database. Only a successfully activated or completely recovered current
authority may produce an exact Bundle response. The response identity derives from the durable
activation generation and active revision, never from channel generation alone.

If candidate B fails integrity, package, reference, staging, commit, or recovery, the server keeps
the last authenticated A delivery byte-for-byte and ETag-for-ETag unchanged. A later valid C may
replace A only after its own fresh complete chain commits. Restart exposes no active Bundle until
the durable active and optional previous-good roles have both completed M07-T08 reconstruction.
Previous-good validation grants no automatic rollback or public fallback loader.

The browser receives only exact Bundle bytes and closed delivery metadata. It never receives a
control-plane token, upstream origin, filesystem path, SQL detail, package inventory, previous-good
revision, staging handle, or activation operation. It independently mounts the Bundle through the
fixed reference Catalog, fixed five-adapter registry, fixed sign-in host operation, and ordinary
runtime validation before replacing the current React surface. A failed delivery or mount leaves
the current surface intact.

### Finite and serialized delivery

Channel refresh, upstream response bodies, installed-package inventory, static assets, browser
Bundle reads, and retained delivery state use fixed lower-only limits. One server instance admits
one refresh at a time. One browser delivery handle likewise admits one fetch at a time and fences
late results after disposal. Static assets and the Node server are built independently; the server
serves only a reviewed immutable Vite output inventory from its configured root. Exact `/` and
`/home` requests alias its canonical `index.html`; every other unknown path remains `404`.

The local Web profile keeps scripts and stylesheet elements same-origin. The reviewed React
Catalog currently emits component presentation through DOM `style` attributes, so the CSP admits
inline style attributes only via `style-src-attr 'unsafe-inline'`; it does not admit inline script,
inline stylesheet elements, evaluation, data scripts, or remote code origins.

This task proves channel-to-mounted-surface composition, not an application authentication
deployment. The reference server deliberately does not implement or proxy the browser binding's
`POST /api/sign-in` route. Until a later application composition supplies that backend, submission
fails closed as unavailable; no synthetic credential success path is introduced here.

## Consequences

- Mutable channel generation and durable activation generation remain separate identities.
- Browser code contains no bearer secret, control-plane implementation, native addon, or package
  loader.
- The reference host proves a real Desen App-independent integration path while retaining the
  exact M05 renderer and adapter boundaries.
- M07-T11 proves local Web/loopback channel consumption only. It does not prove remote or
  multi-tenant deployment, TLS and credential lifecycle, signing, hostile-admin resistance,
  anti-rollback, automatic rollback, arbitrary package installation, real-browser E2E, Desen App
  product restart, Android, or iOS conformance. The configured build and installed-package roots
  are application-owned and must not be concurrently mutated by a hostile administrator; stronger
  race resistance requires immutable installation or native descriptor-relative acquisition.
- M10-T07 remains responsible for the product-level last-known-good restart proof, and M12-T05
  remains responsible for the final measured whole-system limit profile.
