# ADR 0021: Detached Source drafts and publication rejection

- Status: Accepted
- Date: 2026-09-08
- Decision owner: M10-T06

## Context

Visual authoring prevents many invalid component edits before they reach Source. Imported or
advanced Source can nevertheless contain invalid properties, events, or slots. The product must
explain those failures without saving invalid data, publishing a partial Bundle, changing the
active host, or replacing the designer's last valid canvas. Testing only an injected Publisher
failure would not exercise this product boundary.

## Decision

Source & release includes an optional Advanced Source draft. Normal component, Inspector, state,
and action authoring remains visual; JSON is never required for the ordinary designer journey.
The draft is detached text, not an editor document or publication authority. The existing bounded
inert JSON parser rejects duplicate keys and unsafe or excessive input. The public Publisher and
continuous editor validator inspect the candidate using the current trusted workspace Catalogs.

A candidate must retain the current Source identity, surface set, entry, and Catalog composition.
The exact workspace, route, and baseline fingerprint are checked before applying it. A foreign
invalid document cannot borrow current layer IDs to create misleading diagnostic links. Only the
continuous validator's explicit invalid subjects can authorize node links; the editor maps those
links to genuine existing layers, including nested behavior slots.

While a draft is open, Save, Publish, Run, and visual mutations are paused. Pending persistence or
publication prevents draft review. Rejection returns public diagnostics only; it exposes neither
an applicable candidate document nor a Bundle. The canvas and ordinary authoring document remain
unchanged. Discard removes the detached draft. A repaired candidate becomes only a local valid
document; the designer must still use the existing Save source and Publish actions. Fixed
destination, compare-and-set publication, and server-owned activation remain ADR 0020 authority.

## Verification and consequences

Focused product tests exercise valid replacement, invalid prop/event/slot, workspace and stale
baseline rejection, bounded parsing, pending-operation guards, genuine layer links, and discard.
An independent Chromium journey authors and publishes a valid baseline through visible product
controls, rejects each invalid draft, checks node-linked diagnostics, and verifies zero persistence,
Bundle, channel, or activation requests during rejection. Each repaired draft passes through the
ordinary save/publication workflow. The previously activated host stays unchanged on rejection;
its served static bytes remain identical through repaired publication.

The deterministic T06 reader separately calls the public Publisher and continuous validator and
performs fresh App/reference-host graph builds. It does not claim to execute the browser journey
or the focused test declarations that it inventories. Historical T05 bytes remain frozen; an exact
T06 successor receipt admits the reviewed current source changes and reports fresh graph counts
separately from historical counts. A checkpoint authenticates reader identity, never cached success.

This does not introduce arbitrary code, network destinations, Catalog migration, multi-user draft
collaboration, remote deployment, or a new protocol semantic. Corrupt revision and Catalog mismatch
recovery remain M10-T07; this decision alone does not close G10.
