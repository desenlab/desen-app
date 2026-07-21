# Documentation Standards

## Language

Normative protocol text and public API documentation use English as the canonical source. Turkish
guides may explain the system for Desen App users and must be labeled as informative translations
or onboarding material.

## Required documentation

Every package README includes:

1. responsibility and non-responsibilities;
2. public entry points;
3. dependency boundaries;
4. a minimal usage example once functionality exists;
5. failure behavior;
6. supported protocol versions and targets; and
7. testing instructions.

Every public export has TSDoc. Every architecture decision that changes package ownership,
protocol interpretation, security, compatibility, or release behavior has an ADR.

## Protocol documentation

- Frozen snapshots are immutable.
- Corrections are recorded as errata or a new patch/protocol version.
- Implementation choices not defined by 0.1.0 are labeled as reference profiles.
- Every SDK release publishes a protocol/target compatibility matrix.
- Code snippets on `desen.run` must run in CI.

## Evidence documentation

Each proof claim records:

- claim ID;
- status;
- automated test or command;
- artifact or hash;
- manual demonstration step when useful;
- limitations; and
- last verified date.

Screenshots and videos are explanatory artifacts, never the sole proof.

## Style

- Lead with the outcome and intended reader.
- Explain unfamiliar terminology on first use.
- Prefer short sections and concrete examples.
- Do not overstate production readiness, security, interoperability, or platform support.
- Keep commands copyable and paths repository-relative.
