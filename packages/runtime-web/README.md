# @desen/runtime-web

## Responsibility

Browser-specific composition of the framework-neutral `RuntimeHostPorts` contract. The M05-T07
slice authenticates browser environment/time callbacks, captures trusted application delegates,
asserts active document/revision identity before navigation, and gives the host one terminal
cleanup authority.

## Browser host authority

`createRuntimeWebBrowserPlatform` captures exactly two browser-owned ports without invoking them:

- `environment.getSnapshot` and `environment.subscribe`; and
- `clock.now`.

The factory accepts only exact own-data callback objects. A getter, inherited method, extra
callback, forged handle, or reflection-hostile proxy returns a controlled rejection. The
environment value remains profile-defined JSON: this package does not invent enums for viewport,
pointer, color scheme, locale, or other reserved paths. Each successful read is copied through a
bounded, accessor-free, recursively frozen JSON boundary. Invalid or throwing observations retain
the previous valid snapshot, initially `{}`. Clock observations are finite, non-negative
Unix-epoch milliseconds and can never move backwards; an invalid, decreasing, or throwing sample
retains the previous value, initially `0`.

`createRuntimeWebHostAuthority` combines that authenticated platform with these trusted,
application-injected ports:

- navigation;
- immutable Bundle and activation storage;
- operations;
- resources;
- tokens;
- context; and
- diagnostics.

The factory creates all nine `RuntimeHostPorts` and all fourteen callbacks through
`createRuntimeHostPorts`. Construction invokes none of them. Navigation is delegated only when the
request carries own-data `documentId` and `revision` fields exactly equal to the authority's active
Bundle identity. This check is an additional host assertion; the headless runtime remains
responsible for validating that the target surface is local and active.

`authenticateRuntimeWebHostDocumentAuthority` gives a composition root a status-only join to that
configured identity. It accepts only an exact own-data `{ documentId, revision }` envelope and
returns `authenticated`, `mismatched-document-authority`, `disposed`, `invalid-authority`, or
`malformed-request`. It exposes no host ports or delegates, invokes no callback, and rechecks the
same live authority after hostile request reflection.

```ts
import {
  authenticateRuntimeWebHostDocumentAuthority,
  createRuntimeWebBrowserPlatform,
  createRuntimeWebHostAuthority,
  disposeRuntimeWebHostAuthority,
  readRuntimeWebHostAuthority,
} from "@desen/runtime-web";

const platform = createRuntimeWebBrowserPlatform({
  environment: browserEnvironmentPort,
  clock: browserEpochClockPort,
});

if (platform.status !== "created") {
  throw new Error("The browser platform could not be composed.");
}

const authority = createRuntimeWebHostAuthority({
  platform: platform.handle,
  documentId: activeBundle.documentId,
  revision: activeBundle.revision,
  navigation,
  storage,
  operations,
  resources,
  tokens,
  context,
  diagnostics,
});

if (authority.status !== "created") {
  throw new Error(`The host boundary was rejected: ${authority.reason}`);
}

const documentAuthority = authenticateRuntimeWebHostDocumentAuthority(authority.handle, {
  documentId: activeBundle.documentId,
  revision: activeBundle.revision,
});
if (documentAuthority.status !== "authenticated") {
  throw new Error(`The host identity did not authenticate: ${documentAuthority.status}`);
}

const active = readRuntimeWebHostAuthority(authority.handle);
if (active.status === "active") {
  mountRuntimeWith(active.hostPorts);
}

// Dispose first; then stop the headless session and unmount the React root.
disposeRuntimeWebHostAuthority(authority.handle);
```

The handles are opaque factory identities. Casting or cloning an object cannot make it valid.
`readRuntimeWebHostAuthority` returns exactly one of:

- `{ status: "active", hostPorts }`;
- `{ status: "disposed" }`; or
- `{ status: "invalid-authority" }`.

## Lifetime and failure policy

Every published callback checks the same terminal lifetime before observing caller input or
delegating. After disposal:

- navigation, operations, and resources deny;
- token and storage reads report missing;
- storage writes/commits report conflict;
- context and environment read `{}`;
- the clock retains its last monotonic observation;
- diagnostics and new subscriptions become inert; and
- no trusted application or browser callback is invoked.

Context and environment subscriptions have their own late-notice fences. Authority disposal
unsubscribes every active subscription once, catches cleanup failures without retaining their
values, and returns a frozen `{ status, unsubscribed }` result. Repeated disposal is an inert
`already-disposed` result. Diagnostic reporter exceptions are contained because observation must
never change a runtime transition.

Operation/resource settlement detachment, schema validation, stale-attempt rejection, action
semantics, and coordinated headless-session disposal remain in `@desen/runtime-core`. The
reference host must first dispose this outer authority, then stop its session, and finally unmount
its React root. That authority-first order makes cleanup callbacks observe only terminal,
fail-closed ports.

## Explicit non-responsibilities

- No core execution or protocol semantic rules.
- No React components, adapter registrations, DOM composition, or managed-screen JSX.
- No dynamic import, module selection, or executable loading from Source, Bundle, Catalog, URL, or
  host response data.
- No channel fetching, package installation, IndexedDB activation, last-known-good recovery, or
  restart behavior; those remain M07.
- No generic environment enum or native-runtime policy.
- No production authentication backend, credential storage, or authorization implementation.

## Status

M05-T07 browser host-port layer implemented. The separately built reference-host application owns
its concrete DOM/root wiring; M05-T08 owns real sign-in execution and M05-T09 owns the automated
no-handwritten-managed-screen source/import audit.

## Protocol and target support

- Protocol baseline: DESEN 0.1.0
- Initial target: web-react

## Quality

Run the focused package checks:

```bash
pnpm --filter @desen/runtime-web lint
pnpm --filter @desen/runtime-web typecheck
pnpm --filter @desen/runtime-web test:host-authority
pnpm --filter @desen/runtime-web build
```

Use the root workspace quality gate, `pnpm check`, for cumulative proof.
