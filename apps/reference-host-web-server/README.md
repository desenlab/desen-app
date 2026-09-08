# Reference Host Web Server

This private application is the Node.js half of the DESEN Web reference host. It reads one fixed
channel from the real loopback control-plane HTTP API, reruns the public T02–T08 verification and
activation chain, and exposes only the resulting active Bundle to the separately built browser
host.

The browser refresh boundary is `POST /__desen/runtime/refresh`. It accepts no query or request
body. A successful response has exact `application/json` media type, a maximum size of 2,101,248
bytes (the public 2 MiB Bundle ceiling plus a fixed 4 KiB envelope allowance), a strong ETag of
`"desen-active:g:<generation>:<revision>"`, and this closed shape:

```json
{
  "activation": {
    "generation": 0,
    "revision": "sha256:..."
  },
  "bundle": {}
}
```

The server retains the exact verified stored Bundle byte sequence and places it unchanged after
the fixed activation prefix; it does not reserialize the Bundle object. Its T05 reader pins the
actual route contracts independently: channel reads require exact
`application/json; charset=utf-8`, while immutable Bundle reads require exact `application/json`.
Redirected, encoded, BOM-prefixed, over-limit, or differently typed responses fail closed.

The trusted server handle also exposes `activatePublishedRevision` for the fixed local
publication composition. It accepts only this server's configured channel plus the positive
channel generation and immutable revision returned by publication. Before and after invoking the
existing channel-activation controller, it independently reads the channel through the public
control-plane client. An Active settlement requires both reads and the controller delivery to
agree with the requested identity. The method is not an HTTP route, does not expose the bearer to
the browser, and does not create an alternate activation controller.

`204` means no authenticated active runtime is available. A refresh failure preserves an already
authenticated delivery; `503` is returned only when no safe delivery can be produced. The bearer
token, control-plane origin, package filesystem paths, previous-good revision, private authorities,
and diagnostics are never returned or embedded in the browser build.

Production code imports the control plane only through the public `@desen/control-plane-api` root.
The installed package inventory is selected by the host configuration, never by Bundle data, and
rejects symbolic links, hard links, non-regular entries, and file or canonical-parent identity
drift observed during acquisition. Static delivery admits only the independently loaded build
inventory, plus exact `/`, `/home` and `/result` aliases to its canonical `index.html`; every other unknown
path stays `404`. This local profile assumes the configured build and installed-package roots are
application-owned and not concurrently mutated by a hostile administrator. It does not claim
hostile-admin filesystem race resistance; such a profile would require a stronger immutable
installation or native descriptor-relative acquisition boundary.

The response CSP keeps scripts and stylesheet elements same-origin. Because the reviewed React
Catalog currently renders component presentation through DOM `style` attributes, only style
attributes receive `style-src-attr 'unsafe-inline'`; inline scripts, inline stylesheet elements,
evaluation, data scripts, and remote code origins remain forbidden.

Before either candidate activation or recovery, the server admits only the same finite Account
and Flow document/entry/surface identities installed in the browser. The entry is required; the
registered destination is optional unless the authored document references it. Unsupported documents or
routes preserve the authenticated delivery and cannot be reported Active for the rejected
revision. The fixed Catalog and full public integrity/package/reference/staging/recovery chain
remain mandatory.

M10-T08 adds an optional trusted `signIn` callback for the fixed `POST /api/sign-in` route.
Omission retains the original disabled behavior. The opt-in route requires exact same-origin
Origin and Host, rejects cookies/bearers/encoded or ambiguous bodies, and accepts only two bounded
credential strings in at most 16 KiB and 1,024 chunks. Each server admits at most sixteen concurrent
operation requests, each with a ten-second deadline. Disconnect, deadline and close abort the supplied
signal and fence late results. Successful output contains only a bounded `userId`; declared
invalid credentials return 401, while unknown/malformed/thrown results fail closed without raw
error data. Credentials are never logged or persisted by the server.

The normal local launcher supplies the same explicit test-account decision used by the editor's
Integration service. This proves a trusted local operation composition, not production login,
remote deployment, credential management or a guarantee that an arbitrary callback cooperates
with cancellation.
