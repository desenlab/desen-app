# @desen/protocol

## Responsibility

Frozen protocol artifacts, derived types, stable diagnostics, and deterministic digest primitives.
The complete upstream 0.1.0 Git tree is vendored as opaque input under
`upstream/0.1.0/snapshot/` and protected by byte-level integrity tests.

## Explicit non-responsibilities

No editor, runtime, React, DOM, network, or application behavior.

## Status

The exact upstream snapshot, integrity gate, and complete protocol traceability inventory are
implemented. Derived types, validation, diagnostics, and digest APIs remain unimplemented until
their tracked tasks.

## Protocol and target support

- Protocol baseline: DESEN 0.1.0
- Initial target: platform-neutral unless explicitly adapted

## Quality

Use the root workspace quality gate: `pnpm check`.

Snapshot-specific commands:

```bash
pnpm verify:protocol-snapshot
pnpm test:protocol-snapshot
```

Protocol traceability commands:

```bash
pnpm verify:protocol-traceability
pnpm test:protocol-traceability
```

Traceability proves that every reviewed prose rule and every normative schema constraint has a
future implementation and test owner. It does not claim that validation or runtime semantics are
implemented yet.

The verifier is root build tooling rather than platform-neutral package runtime code; Node file
system or crypto APIs never enter this package's public surface.
