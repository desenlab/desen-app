# Strategic Validation Checkpoints

Last reviewed: 2026-09-04

## Purpose

This document records product and interoperability decisions that must be tested at the point when
the implementation can answer them with evidence. It is not a second implementation task board:
the 148 tasks and 13 proof gates in `TASKS.md` remain the only items counted by the README progress
bar.

The working position is:

> Figma brings code onto the design canvas. A2UI lets agents communicate user interfaces. DESEN
> safely publishes and activates human-authored interface revisions as verified bundles.

DESEN should not compete as another general-purpose visual canvas or claim that declarative JSON
UI is unique. Its proposed value is the complete human-authoring, deterministic publication,
conformance, exact-package resolution, atomic activation, rollback, and traceability lifecycle.

## Existing proof commitments

The following market-validation recommendations are already represented by implementation tasks
and must not be duplicated:

- Complete the exact reference capability package through `M03-T07`–`M03-T10` and `G03`.
- Prove Desen App → Publisher → independent host execution through `M09`, `M10`, and `G10`.
- M10-T05 proves that a label and layout change activate without a host source or build change;
  see the [published-host evidence](../proof/DESEN-APP-PUBLISHED-HOST-UPDATE.md).
- Prove that invalid publication is rejected in `M10-T06`.
- Prove that corrupt or catalog-mismatched revisions preserve the last-known-good surface in
  `M10-T07`.

## SC-01 — Protocol-positioning and interoperability decision

**When:** After `G03` and before `M04-T01`.

**Status:** Complete on 2026-07-24. Recommendation: **`continue`**.

**Why then:** `G03` provides a concrete DESEN Catalog, token contract, artifacts, and exact package
tuple. That is enough evidence for a useful comparison, while the runtime architecture is still
early enough to change without discarding a completed execution engine.

### Decision

DESEN remains an independent protocol and M04 proceeds unchanged. A2UI 0.9.1 is complementary:
it owns agent/server-to-client streamed interfaces, while DESEN owns the human-authoritative
source, deterministic publication, immutable target package identity, atomic activation,
last-known-good behavior, and source-to-runtime traceability.

A proof-only `SC01_STATIC_TEXT_V1` adapter demonstrates that one fixed Stack/Text subset can
round-trip its admitted JSON fields exactly. It is not a renderer-semantic proof, public bridge,
dependency, package-boundary change, or general-interoperability claim. Every field outside that
exact subset fails explicitly.

The current Web token document is recorded as a
`DTCG_2025_10_COMPATIBLE_CLOSED_REFERENCE_PROFILE`, not as a complete DTCG parser or resolver.
Token storage and resolution remain host-owned.

### Required study

Compare the frozen DESEN 0.1.0 model with the then-current stable A2UI specification field by
field:

- intended authority and lifecycle: human-authored persistent revisions versus agent-generated or
  streamed interfaces;
- document, surface, node, catalog, component, data-binding, event, action, and command semantics;
- trusted component lookup and target-specific native rendering;
- state ownership, synchronization, persistence, and asynchronous operation behavior;
- arbitrary-code boundaries, allowlists, schema validation, diagnostics, and resource limits;
- versioning, exact package identity, canonical bytes, digests, conformance, and compatibility;
- authoring, publication, activation, rollback, last-known-good, and source-to-runtime
  traceability; and
- accessibility and observable cross-platform behavior.

Evaluate four outcomes without assuming one in advance:

1. DESEN remains an independent protocol with an explicit scope boundary.
2. DESEN supplies authoring, packaging, conformance, and deployment around A2UI.
3. A lossless bridge maps an approved subset between DESEN and A2UI.
4. No safe interoperation is claimed because the lifecycle or semantics are incompatible.

For any bridge candidate, prove which information round-trips, which information is intentionally
lost, and which semantics must fail explicitly. Do not label a partial translation as
interoperability.

### Token alignment

Audit the reference token contract against the then-current stable Design Tokens Community Group
format. DESEN must continue to treat token storage as host-owned and must not create a competing
token-file standard. Record any supported DTCG subset, alias behavior, type mapping, and
unsupported feature explicitly.

### Exit evidence

- a version-pinned DESEN–A2UI semantic comparison matrix;
- a version-pinned DTCG compatibility note;
- at least one executable bridge spike if a lossless subset appears credible;
- a documented `continue`, `adapt`, `bridge`, or `stop` recommendation; and
- a new ADR before any conclusion changes package boundaries, runtime responsibilities, or public
  APIs.

Completed evidence:

- [Version-pinned DESEN–A2UI comparison](../proof/SC-01-DESEN-A2UI-COMPARISON.md)
- [DTCG 2025.10 compatibility profile](../profiles/DTCG-2025.10-COMPATIBILITY.md)
- [ADR 0009](../adr/0009-sc-01-protocol-positioning-and-interoperability.md)
- `docs/proof/artifacts/sc-01-a2ui-bridge.json` —
  `sha256:2f927afee4ec50d8191fd2d44db93e35ff89f64856d0ae7bbc4be14193588902`;
  27 tests cover 1,029 deterministic positive vectors, 1,029 exact round-trips in each direction,
  2,058 A2UI message schema validations, and 34 stable rejection cases.
- `docs/proof/artifacts/sc-01-dtcg-compatibility.json` —
  `sha256:1df806e0b56d66e27558bbc2bb2f17e0e261b0103c90ed2658ad1eba4c3bdbc6`;
  20 tests preserve the immutable task-time receipt and cover 26 tokens, 14 unsupported feature
  families, 16 exact valid-but-unsupported fixtures, seven exact negative fixtures, proof pins,
  hostile inputs, symlinks, and atomic-copy safety. Successor package bytes are not inputs to this
  historical checkpoint.

Selected primary references:

- [A2UI 0.9.1 specification](https://a2ui.org/specification/v0.9.1-a2ui/)
- [A2UI roadmap](https://a2ui.org/roadmap/)
- [DTCG Format 2025.10](https://www.w3.org/community/reports/design-tokens/CG-FINAL-format-20251028/)
- [DTCG Color 2025.10](https://www.w3.org/community/reports/design-tokens/CG-FINAL-color-20251028/)
- [DTCG Resolver 2025.10](https://www.w3.org/community/reports/design-tokens/CG-FINAL-resolver-20251028/)
- [Figma Code Layers](https://www.figma.com/blog/code-on-the-figma-canvas/)

## SC-02 — Problem and pilot validation

**When:** After `G10` and before `M11-T01` or `M11-T08`.

**Why then:** `G10` produces a repeatable demonstration of the actual claim instead of asking
teams to react to a protocol document or mockup. `M11` would otherwise expand the capability
surface before product demand is known.

### Required validation

- Interview at least 10 people responsible for design systems, frontend platforms, or product UI
  infrastructure across multiple organizations.
- Demonstrate the complete sign-in publication, rejection, activation, and last-known-good flow.
- Ask about their existing workflow, failure cost, security constraints, ownership boundaries, and
  integration objections before presenting DESEN as the answer.
- Record anonymized evidence without credentials, personal data, customer secrets, or invented
  interest.
- Seek at least two concrete pilot commitments in which a team is willing to map its own
  components and evaluate the workflow in a non-production environment.

### Go/no-go rule

- **Continue:** at least two credible pilot teams confirm the production-surface ownership and
  controlled-deployment problem and agree to a bounded evaluation.
- **Adapt:** the problem is confirmed but the preferred integration point, buyer, or relationship
  with A2UI differs materially; update positioning and write an ADR before M11.
- **Pause or stop protocol expansion:** fewer than two credible pilots emerge, the problem ranks
  below teams' active priorities, or existing tools solve it without the deployment guarantees
  DESEN adds.

GitHub interest, npm downloads, social engagement, task completion, and test volume are useful
signals but do not satisfy this gate. Only observed workflow evidence and real pilot willingness
count as product validation.
