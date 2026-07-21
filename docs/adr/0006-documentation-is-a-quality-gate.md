# ADR 0006: Documentation is a quality gate

- Status: Accepted
- Date: 2026-07-21

## Decision

Every public export requires TSDoc, every package requires a current README, non-obvious
architectural choices require an ADR, and every proof claim requires linked evidence.

Comments explain invariants, trade-offs, ownership, and failure behavior. They must not merely
translate code syntax into prose.

## Consequences

Documentation changes are part of feature completion, not deferred cleanup. Future generated API
reference can treat source comments as a reliable public contract.
