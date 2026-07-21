# ADR 0001: Product and domain boundaries

- Status: Accepted
- Date: 2026-07-21

## Decision

- DESEN is the open protocol.
- Desen App is the official visual product and will use `desen.app`.
- DESEN Developer Platform is the developer, protocol, SDK, and conformance surface at
  `desen.run`; it is a domain-facing integration surface, not a separate authoring product.
- The npm package `desen` is the future developer entry point and must remain usable without
  Desen App.

Desen App is the only current name for the visual authoring product.

## Consequences

Desen App can evolve as a commercial or hosted product without making the open runtime and
protocol App-dependent. Enterprise teams may author sources with their own tools, run the
publisher in CI, and embed runtimes directly.
