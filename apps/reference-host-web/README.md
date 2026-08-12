# Reference Host Web

A separately built production-like host that activates immutable bundles. It must not contain a
manually authored managed-screen component tree or import Desen App code. It demonstrates the
App-independent integration path documented by the DESEN Developer Platform at `desen.run`.

## Status

G05 is complete, and M07-T11 adds browser consumption of the separately built reference-host
server's durably activated channel. M05-T08 still tracks the controlled official-derived sign-in
Source and Bundle, but the production browser entry no longer activates that static fixture as a
fallback. It waits for one authenticated delivery from the fixed same-origin refresh endpoint.
The historical wrapper remains only for compatibility tests.

The production entry issues only a bodyless and cookieless
`POST /__desen/runtime/refresh`. A successful response must be unredirected, same-origin,
unencoded JSON with the exact `{ activation: { generation, revision }, bundle }` envelope and a
matching strong durable-identity ETag. The browser streams at most 2 MiB plus a fixed 4 KiB
envelope allowance across at most 1,024 chunks and fences every request after 15 seconds. It then
constructs the real five-adapter registry exported by
`@desen/reference-catalog-web/react-adapters`, mounts the delivered Bundle with the fixed Catalog
through `runtime-core`, and gives the authenticated `RuntimeReactLiveSurfaceInput` to the T07
root. Malformed, stale, failed, timed-out, or late deliveries preserve the current surface.

The application root owns:

- explicit redacted React 19 root-error policy;
- one serialized asynchronous refresh with a disposal and late-response fence;
- a monotonically increasing recovery authority that cannot be selected by Bundle data;
- a transaction fence against activation, retry, replacement, or disposal reentry;
- terminal session, root, and browser-host cleanup;
- BFCache-aware page lifecycle that refreshes on restored `pageshow`, preserves a persisted page,
  and disposes only on final `pagehide`; and
- accessible boot and controlled-failure infrastructure outside the managed surface.

`@desen/runtime-web` supplies the reusable browser platform and the exact nine-port host
authority. The only production operation binding snapshots bounded own-data credentials and makes
one fixed same-origin `POST /api/sign-in` request. HTTP `401` becomes the declared
`invalidCredentials` result; every other HTTP, network, response, parse, malformed-data, or
response-budget failure becomes the declared `unavailable` result. A successful body is streamed
through a 64 KiB and 1,024-non-empty-chunk ceiling before JSON parsing. The binding does not retry, persist
credentials beyond the request lifetime, or forward raw failures. Successful bounded JSON still
passes through runtime-core's exact operation output-schema validation.

The M07-T11 standalone reference server deliberately does not supply or proxy this
application-level authentication backend. It proves channel consumption and mounted-surface
delivery; until a later deployment composition supplies `POST /api/sign-in`, submissions fail
closed as `unavailable`.

Tests exercise user-visible pending, declared failure, edited retry, success, and navigation
through the real `TextField`, `Button`, `Alert`, `Stack`, and `Text` adapters. The loading
`Button` suppresses additional clicks while one attempt is pending. A separate replacement
scenario replaces the exact session, registry, Catalog, and Web-host authorities; the T07 root
disposes the old owned session and host, and a late settlement from the revoked operation cannot
change or navigate the new surface. This is logical stale-authority containment, not cancellation
of an already-started HTTP request.

The immutable M05-T07 artifact remains historical evidence for the shell as it existed at that
task, and its generator/verifier now serves only as a compatibility reader for that pinned
task-time evidence. M05-T08 owns verification of the current official-derived composition and
build; it does not rewrite the T07 artifact. M05-T09 now discovers the complete production source
set, resolves JSX and aliases with the TypeScript checker, and observes the actual Vite production
graph. It proves that exact host-owned boot/failure infrastructure is the only handwritten JSX
and that the managed branch reaches components only through the public generic runtime renderer
and shared public adapter factory. Direct or hidden component trees, plan-shaped substitutes,
dynamic code selection, private package paths, forbidden packages, authoring Source data, orphan
modules, symbolic links, and unreviewed assets fail closed. This closes G05 and advances P-07 only
to `PARTIAL`; Desen App E2E remains M10-T05.

The completed browser slice does not expose a control-plane token, upstream origin, channel name,
installed-package path, previous-good revision, or executable-module selector. M07-T11 remains a
local Web/loopback composition proof; it does not claim remote deployment, hostile-admin
resistance, native runtime, real-browser E2E, or Desen App product restart recovery.

## Local commands

```bash
pnpm --filter @desen/reference-host-web typecheck
pnpm --filter @desen/reference-host-web test:channel
pnpm --filter @desen/reference-host-web test:shell
pnpm --filter @desen/reference-host-web test:sign-in
pnpm --filter @desen/reference-host-web build
pnpm verify:reference-host-web-source-audit
```
