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

`204` means no authenticated active runtime is available. A refresh failure preserves an already
authenticated delivery; `503` is returned only when no safe delivery can be produced. The bearer
token, control-plane origin, package filesystem paths, previous-good revision, private authorities,
and diagnostics are never returned or embedded in the browser build.

Production code imports the control plane only through the public `@desen/control-plane-api` root.
The installed package inventory is selected by the host configuration, never by Bundle data, and
rejects symbolic links, hard links, non-regular entries, and file or canonical-parent identity
drift observed during acquisition. Static delivery admits only the independently loaded build
inventory, plus exact `/` and `/home` aliases to its canonical `index.html`; every other unknown
path stays `404`. This local profile assumes the configured build and installed-package roots are
application-owned and not concurrently mutated by a hostile administrator. It does not claim
hostile-admin filesystem race resistance; such a profile would require a stronger immutable
installation or native descriptor-relative acquisition boundary.

The response CSP keeps scripts and stylesheet elements same-origin. Because the reviewed React
Catalog currently renders component presentation through DOM `style` attributes, only style
attributes receive `style-src-attr 'unsafe-inline'`; inline scripts, inline stylesheet elements,
evaluation, data scripts, and remote code origins remain forbidden.

This server proves control-plane channel consumption and mounted-surface delivery only. It does
not implement or proxy the browser's application-level `POST /api/sign-in` binding; a deployment
must supply that backend in a later composition, and submission otherwise fails closed as
unavailable.
