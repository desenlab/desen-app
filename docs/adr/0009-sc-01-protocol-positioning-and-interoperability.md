# ADR 0009: Continue DESEN independently and keep A2UI interoperation fail-closed

- Status: Accepted
- Date: 2026-07-24
- Decision: `continue`
- Owners: SC-01

## Context

G03 produced enough concrete DESEN evidence to compare protocols rather than compare product
descriptions: a frozen Source/Bundle/Catalog model, a real Web–React capability package, a strict
host-owned token provider, and one exact logical package tuple.

At this checkpoint, A2UI 0.9.1 is the current production/stable A2UI family and A2UI 1.0 is still a
candidate. A2UI 0.9.1 is a JSON message protocol for agent/server-driven, progressively updated
client surfaces. DESEN 0.1.0 is a persistent design-authority and deployment lifecycle covering
human authoring, deterministic publication, immutable target packages, activation, rollback,
last-known-good state, and source-to-runtime traceability.

Both protocols use declarative data, trusted client capabilities and native rendering. Their
overlap creates a credible narrow conversion opportunity, but their authority, state, asynchronous
execution, integrity, failure, publication and activation semantics are not equivalent.

The complete evidence is:

- `docs/proof/SC-01-DESEN-A2UI-COMPARISON.md`
- `docs/profiles/DTCG-2025.10-COMPATIBILITY.md`
- `docs/proof/artifacts/sc-01-a2ui-bridge.json`
- `docs/proof/artifacts/sc-01-dtcg-compatibility.json`

## Decision

Continue DESEN as an independent protocol with its existing scope and package boundaries.

Specifically:

1. M04 implements the frozen DESEN framework-neutral runtime. It does not become an A2UI renderer,
   agent client, transport, or compatibility wrapper.
2. No A2UI dependency enters `runtime-core`, the frozen protocol, or a public package API at SC-01.
3. A proof-only `SC01_STATIC_TEXT_V1` spike measures an exact JSON structural field round-trip for
   a static Stack/Text overlap. It is not a supported bridge product, renderer-semantic proof, or
   full-interoperability claim.
4. Unsupported fields fail before translation. The spike never drops state, binding, action,
   operation, resource, command, style, authoring, publication, activation, rollback, traceability
   or accessibility semantics.
5. DESEN does not define a competing token-file format. DTCG storage and resolution remain
   host-owned; the current Web package is documented only as a
   `DTCG_2025_10_COMPATIBLE_CLOSED_REFERENCE_PROFILE`.
6. This decision is reviewed when A2UI 1.0 becomes stable, before a public A2UI adapter is
   proposed, or if SC-02 pilot evidence identifies agent-driven surfaces as the preferred
   integration boundary.

## Why `continue`

`continue` describes the project direction. The existence of a narrow bridge spike does not make
`bridge` the product architecture.

DESEN still has a distinct falsifiable claim to prove:

> A human-authored managed interface can be validated, published as an exact immutable
> target-specific artifact, activated in an independent host, and changed or rolled back without
> recreating the screen in host source code.

A2UI 0.9.1 does not specify that lifecycle. Replacing the planned DESEN runtime/publisher/activation
work with A2UI would discard the differentiating claim before it is tested.

At the same time, refusing all interoperation would ignore a real shared declarative component
boundary. The spike therefore remains as evidence about the boundary, not as the center of the
architecture.

## Alternatives considered

### `adapt`: put DESEN authoring and deployment around A2UI

Rejected at this checkpoint.

This would require A2UI messages or surfaces to become the production artifact beneath Desen App.
A2UI 0.9.1 does not preserve DESEN state schemas, closed ordered actions, operation/resource
lifecycle, exact target package bytes, deterministic revision identity, atomic activation,
last-known-good state, or source-to-runtime traceability. Recreating those as a proprietary shell
would still require most of DESEN while weakening its exact semantics.

### `bridge`: make DESEN–A2UI conversion the primary architecture

Rejected as the project direction, while retaining the proof-only spike.

The admitted static field projection is structurally lossless, but renderer defaults, heading
semantics, accessibility output, and the official DESEN sign-in surface are outside it. Sign-in
depends on state, bindings, operation concurrency and settlement, conditional error presentation,
loading state and navigation. Calling that full surface interoperable would require silent loss or
invented behavior.

### `stop`: treat A2UI as a complete replacement

Rejected.

A2UI is stronger and more mature for agent-to-client streaming and renderer reach, but it does not
make the DESEN publication/activation hypothesis redundant. The correct response is to prove or
disprove that remaining hypothesis through G10 and SC-02.

### Claim no safe overlap

Rejected.

A strictly bounded single-surface literal Stack/Text projection can preserve all admitted JSON
fields in both directions. The executable spike provides a more honest boundary than either a
blanket compatibility claim or a blanket incompatibility claim.

## Consequences

### Positive

- M04 can begin without architecture churn.
- DESEN positioning no longer depends on claiming declarative JSON UI as unique.
- A2UI is treated as a complementary ecosystem rather than an unnamed competitor.
- A tested rejection boundary prevents future “almost compatible” marketing.
- DTCG remains the external token exchange standard while DESEN remains storage-neutral.
- Future native runtimes keep the current platform-neutral core boundary.

### Costs

- DESEN must still prove the difficult runtime, publisher, activation and independent-host claims.
- A future A2UI adapter will require explicit version profiles and maintenance as A2UI evolves.
- The static spike has intentionally low product utility; it is evidence, not a shortcut to G10.
- The reference token provider remains narrower than general DTCG 2025.10 import/export.

### Non-claims

SC-01 does not claim:

- full DESEN–A2UI interoperability;
- official A2UI conformance or renderer certification;
- that an A2UI stream is a DESEN Bundle;
- that A2UI gains DESEN publication, digest, activation, rollback or LKG semantics;
- that DESEN gains A2UI transport, agent generation or progressive streaming semantics;
- pixel-equivalent, CSS-equivalent or accessibility-tree-equivalent rendering;
- equivalent HTML/native-widget elements, heading semantics, or renderer defaults;
- complete DTCG Format, Color or Resolver support; or
- production readiness for any bridge.

## Future integration hypotheses

Two hypotheses may be evaluated later without changing this decision now:

1. A separately versioned adapter package could import/export a wider, still fail-closed A2UI
   subset after G10. A new ADR must approve its public API and ownership.
2. A trusted complex capability could host an explicitly agent-managed ephemeral A2UI sub-surface
   inside an outer DESEN-managed revision. The user and authoring UI would need to disclose that
   the inner subtree is not DESEN-authoritative. This requires pilot evidence and is not part of
   M04.

## Review triggers

Reopen this ADR when any of the following occurs:

- A2UI 1.0 becomes stable;
- a public A2UI adapter or A2UI-hosting capability is proposed;
- A2UI adds a standard persistent publication/activation/integrity lifecycle materially
  overlapping DESEN;
- G10 shows that DESEN's end-to-end claim cannot be implemented as specified; or
- SC-02 pilot evidence favors a materially different integration point.
