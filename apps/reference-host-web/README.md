# Reference Host Web

A separately built production-like host that activates immutable bundles. It must not contain a
manually authored managed-screen component tree or import Desen App code. It demonstrates the
App-independent integration path documented by the DESEN Developer Platform at `desen.run`.

## Status

M05-T08 runs a controlled official-derived sign-in Source and Bundle through the independent
client-only React 19 and zero-configuration Vite 8 host. Its managed `surfaces` remain canonically
identical to the frozen official example; only the Catalog requirement and the resulting
`sourceDigest` and Bundle `revision` differ. The fixture requires the exact current
`run.desen.reference.sign-in@0.1.0` Catalog digest.

The production entry constructs the real five-adapter registry exported by
`@desen/reference-catalog-web/react-adapters`, mounts the exact Bundle and Catalog through
`runtime-core`, and gives the resulting authenticated `RuntimeReactLiveSurfaceInput` to the T07
root. The shell cannot accept arbitrary managed React children, component registrations,
capability ids, or plan-shaped data. Activation requires the exact session-to-host-port identity,
the exact current snapshot and Catalog authority, the Web host's matching document/revision
authority, and a factory-authenticated runtime-react executable registry.

The application root owns:

- explicit redacted React 19 root-error policy;
- a monotonically increasing recovery authority that cannot be selected by Bundle data;
- a transaction fence against activation, retry, replacement, or disposal reentry;
- terminal session, root, and browser-host cleanup;
- BFCache-aware page lifecycle that preserves a persisted page and disposes only on final
  `pagehide`; and
- accessible boot and controlled-failure infrastructure outside the managed surface.

`@desen/runtime-web` supplies the reusable browser platform and the exact nine-port host
authority. The only production operation binding snapshots bounded own-data credentials and makes
one fixed same-origin `POST /api/sign-in` request. HTTP `401` becomes the declared
`invalidCredentials` result; every other HTTP, network, response, parse, malformed-data, or
response-budget failure becomes the declared `unavailable` result. A successful body is streamed
through a 64 KiB and 1,024-non-empty-chunk ceiling before JSON parsing. The binding does not retry, persist
credentials beyond the request lifetime, or forward raw failures. Successful bounded JSON still
passes through runtime-core's exact operation output-schema validation.

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
build; it does not rewrite the T07 artifact. M05-T09 still owns the exhaustive TypeScript AST and
resolved-import audit. This task does not claim a Publisher, authentication backend, channel
activation, IndexedDB/last-known-good recovery, native runtime, or Desen App integration.

## Local commands

```bash
pnpm --filter @desen/reference-host-web typecheck
pnpm --filter @desen/reference-host-web test:shell
pnpm --filter @desen/reference-host-web test:sign-in
pnpm --filter @desen/reference-host-web build
```
