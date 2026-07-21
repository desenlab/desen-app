# ADR 0004: Runtime and publisher precede the visual editor

- Status: Accepted
- Date: 2026-07-21

## Decision

Implement and prove the validator, capability registry, headless runtime, React host, publisher,
and activation manager before building the Desen App canvas and inspector.

## Consequences

The team cannot substitute a convincing editor preview for production execution. The editor will
be forced to consume the same public runtime and capability APIs as an independent host.
