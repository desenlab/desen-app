# ADR 0017: Explicit App Integration and transient managed navigation

- Status: Accepted
- Date: 2026-09-03
- Decision owner: M10-T04

## Context

The first end-to-end proof requires both a Catalog success fixture and a real host operation to
drive navigation from Desen App Run Mode. The editor must not infer executable bindings from an
operation name, grant its product ports to synthetic fixtures, or manufacture a sign-in-specific
navigation path. The existing local Account app profile has one surface and an independently
persisted Source; silently adding another surface would invalidate its exact admission contract.

## Decision

### Composition installs workspaces and connections; documents select neither

The normal product root installs a finite, authenticated local-workspace inventory. The original
`reference-sign-in-web` profile and `account-app-source` remain unchanged. The additive
`reference-flow-web` profile owns a separate `flow-app-source` with empty `start` and `result`
surfaces. Its Stack roots, explicit `420 × 720` frames, exact Catalog, registry and tokens are
trusted bootstrap inputs; all children, states and actions are authored in the ordinary editor.

The workspace chooser can select only installed opaque profile handles, checks duplicate
identities, and uses the existing dirty-Source navigation guard. A deep link selects only an
already installed workspace; it cannot construct a profile, install code or enable Integration.
There is no implicit migration, fixture fallback, overwrite or merging of persisted Sources.

An `AuthoringIntegrationBindingHandle` is a separate, opaque, host-created authority bound to one
exact workspace handle. Its fixed operation callbacks must match that profile's authenticated
Catalog capability and effect. Generic editor modules contain no reference sign-in identity,
endpoint, credential, expected output or fallback handler. Only the normal composition root
installs the local reference account-service binding.

### Synthetic and Integration are separate lifetimes

Every workspace starts in Synthetic. Its fixture controller retains the existing no-input-read,
Catalog-declared, explicit-completion contract and never calls an Integration callback. Run
controls enable Integration only when an exact-profile binding exists. The designer must select
it explicitly. Switching context restarts transient Runtime state; returning to Design revokes
Integration and restores Synthetic. Production is unavailable.

The Integration controller re-admits Source against the profile, republishes the selected-surface
preview, and requires the exact revision. Requests must match document, surface, revision,
authored alias, capability and effect. Per-alias pending/replay limits and an activation epoch
prevent stale or duplicate authority. Deactivation aborts pending transport and makes late
settlements inert. The status projection retains no input, credential, output or implementation
error. A host response is not labelled Runtime success: Runtime Core still owns output-schema
validation, public-error admission, pending cleanup and settlement actions.

### Navigation changes the managed preview, not the authored Source

The App supplies a narrowly scoped, revocable navigation port rather than its browser router.
It accepts only existing surfaces in the same admitted Source and exact current preview context.
One accepted transition terminally revokes the originating navigation lifetime. The target is
mounted through the same Publisher, Runtime Core, Runtime React and registered adapters.

The App changes only a transient preview candidate's entry to mount the target. It never changes
the authored entry, saved generation, publication candidate or editor URL. Destination parameters
are detached bounded JSON available only under `context.params`; they are not saved. The frame
uses the target's explicit authoring dimensions and remains centered. Restart run restores the
design origin with fresh transient state; Design restores the authoring panels and Source.

Storage, resources, token callbacks, diagnostics and real environment ports remain inert in both
Run contexts. The host composition's unrelated runtime ports are never inherited.

### The local reference connection is real HTTP, not production authentication

The trusted local launcher starts an independent loopback account service with its own fresh
bearer, separate from Source persistence. The fixed `/api/sign-in` transport requires exact
Origin, Host, authorization, POST and bounded strict JSON; redirects, cookies, arbitrary URLs and
logging of input are absent. Browser and server bodies, timeouts and connections are bounded.
The operation binding uses the public `@desen/reference-catalog-web/host-operations` seam.

The visible demo account is `designer@example.test` / `local-demo-pass`. The actual handler checks
that pair, returns HTTP 401 for a mismatch, and returns `{ "userId": "local-host-user" }` on success.
This deliberately differs from the Catalog's `user-1` fixture. Both the UI and documentation label
the service as a local test account, not a production identity provider. No production credential
or user database is supplied, and the service is never selected by Source or Catalog data.

## Verification and consequences

The browser proof server reuses the exact App-owned `dev/local-operation-host.mjs` listener rather
than implementing a second test substitute. Its dependency exception is anchored to that importer
and that one file. Other browser entries, neighboring App dev modules, application source roots and
private control-plane modules remain forbidden. Positive and negative boundary fixtures enforce
this distinction against the real repository configuration.

The dedicated Chromium journey builds the ordinary product entry, creates the two-surface blank
project through visible controls, authors both pages and a non-default operation result alias,
adds a visual Success → Navigate action, and saves. Synthetic success mounts the target with zero
host requests. Explicit Integration observes a real 401 without navigation, then a real 200 and
the managed target. Source PUT count and bytes remain unchanged across Run; reloading restores
the saved design with empty input state. Focused tests cover generic non-auth operations,
fixture-free capabilities, forged/mismatched authority, output rejection, cancellation and replay.

This closes M10-T04's local success/navigation/host-operation proof. It does not claim remote or
multi-tenant deployment, production authentication, N-036 secret classification, arbitrary project
or surface creation, T05 publish/activate without host edits, T07 last-known-good recovery, or G10.
Those responsibilities retain their existing plan owners. Runtime Core and frozen protocol bytes
are unchanged.
