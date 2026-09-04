# ADR 0020: Fixed-destination local publication and host activation

- Status: Accepted
- Date: 2026-09-04
- Decision owner: M10-T05

## Context

M09-T14 provided the editor-side publication controller, but the normal Desen App composition did
not yet connect that controller to a real channel and independently built host. M10-T05 must prove
that a designer can save, publish, and activate a visible label and layout change from the product
UI while the host application source and build remain unchanged.

Source and Catalog data cannot choose an endpoint, token, channel, host implementation, or module.
Browser publication and server-owned activation also require separate authorities: possession of
the control-plane publication bearer must not grant an arbitrary host-control capability.

## Decision

### The trusted launcher fixes the complete destination

The normal local launcher installs one versioned publication profile for the Account app. It fixes
the control-plane origin, `preview` channel, `reference-host-web` identity, and a separate host
activation origin. Three independently generated in-memory bearer secrets authorize Source and
Bundle persistence, local operations, and host activation. A collision fails before any listener
opens. The browser cannot replace any destination field, and no authority is persisted in Source,
Catalog, Bundle, URL, local storage, log output, or the host's static build.

The browser re-admits the injected profile as an exact closed value and exposes only the existing
`AuthoringPublicationPort` to the editor. Bundle and channel writes use the public Editor Web
publication adapter. Requests are fixed-loopback CORS requests with bounded bodies, response
headers, response bytes, stream fragmentation, time, redirects, and credentials. Missing or malformed configuration
leaves publication unavailable without disabling independent Source persistence.

### Activation remains a server-owned reconciliation

A dedicated loopback bridge authenticates the browser to one exact channel and host. It accepts
only a bounded `POST /v1/activate-published-revision` request carrying the generation and revision
returned by the completed channel compare-and-set. Strict Origin, Host, authorization, media type,
body, duplicate-key, destination, connection, and timeout checks precede the callback.

The bridge delegates to the already-open reference-host server; it does not create a second
activation controller. The host independently reads the fixed channel before and after running its
existing verification and activation chain. It reports Active only when both reads match the
requested channel generation and revision and the controller's active revision is identical.
Unavailability, mismatch, mutation, closure, or uncertain settlement cannot be represented as a
successful activation.

The reference-host server and control plane deliberately share the same application-owned local
state root. The controller therefore consumes the immutable Bundle written by the browser through
the public control-plane API. This is storage composition, not host-source coupling.

### The proof uses the normal product and an independently built host

The dedicated Chromium journey opens the host before publication, creates the normal blank Account
project, inserts two Catalog components, edits through Inspector controls, saves, publishes, and
activates. It then changes both a Text label and Stack gap, saves and publishes again, and observes
the new result after host reload. A digest over the served host HTML and asset bytes must remain
identical across both activations, while the published Bundle revision must change. A second reload
must preserve the activated result.

The proof server imports only reviewed public package roots plus the exact App-owned activation
bridge. Dependency rules reject private reference-host modules, neighboring App dev modules, and
unreviewed browser-proof importers. Source/import audits and mutation tests remain independent from
the browser observation.

## Verification and consequences

The normal local development command now starts the App, its durable local control plane, the
separate activation bridge, and a separately built reference host. The launcher reports the App
and host URLs but never credentials. Shutdown revokes the browser-facing servers before the shared
control plane and is idempotent across partial startup failures.

This closes the Web–React M10-T05 product slice and allows P-07 to become `PROVEN`: the designer's
data-only revision changes the managed host output without a handwritten host component tree or a
host rebuild. It also closes PF-059 for the audited App/reference-host Web graph. The frozen DESEN
protocol, Runtime Core source, reference component implementations, and reference-host browser
source are unchanged.

This decision does not provide remote deployment, multi-user tenancy, production credentials,
arbitrary destinations, signing, native-host parity, invalid-publication diagnostics (M10-T06),
last-known-good corruption recovery (M10-T07), P-12, N-036, or G10 closure.
