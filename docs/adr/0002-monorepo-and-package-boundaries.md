# ADR 0002: Monorepo and package boundaries

- Status: Accepted
- Date: 2026-07-21

## Decision

Use one pnpm/Turborepo workspace for the reference implementation, Desen App, reference host,
developer site, control-plane API, shared packages, examples, and proof tests.

The normative protocol remains in the separate `desenlab/desen-protocol` repository. This
workspace vendors an exact checksum-verified snapshot for repeatable builds.

## Consequences

Cross-package changes and proof tests can be reviewed atomically. Automated dependency rules
prevent applications and Web adapters from leaking into platform-neutral cores. Packages remain
private until the public-alpha release gate.
