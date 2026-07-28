# Reference Host Web

A separately built production-like host that activates immutable bundles. It must not contain a
manually authored managed-screen component tree or import Desen App code. It demonstrates the
App-independent integration path documented by the DESEN Developer Platform at `desen.run`.

## Status

M05-T07 implements the independent client-only React 19 and zero-configuration Vite 8 shell. The
shell accepts only an authenticated `RuntimeReactLiveSurfaceInput`; it cannot accept arbitrary
managed React children, component registrations, capability ids, or plan-shaped data. Activation
requires the exact session-to-host-port identity, the exact current snapshot and Catalog
authority, the Web host's matching document/revision authority, and a factory-authenticated
runtime-react executable registry.

The application root owns:

- explicit redacted React 19 root-error policy;
- a monotonically increasing recovery authority that cannot be selected by Bundle data;
- a transaction fence against activation, retry, replacement, or disposal reentry;
- terminal session, root, and browser-host cleanup; and
- accessible boot and controlled-failure infrastructure outside the managed surface.

`@desen/runtime-web` supplies the reusable browser platform and the exact nine-port host
authority. Channel fetching, IndexedDB activation storage, last-known-good recovery, and restart
semantics remain assigned to M07. The official-derived sign-in execution begins at M05-T08, and
the complete source/import audit remains M05-T09.

## Local commands

```bash
pnpm --filter @desen/reference-host-web typecheck
pnpm --filter @desen/reference-host-web test:shell
pnpm --filter @desen/reference-host-web build
```
