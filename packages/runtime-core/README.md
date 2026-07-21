# @desen/runtime-core

## Responsibility

Framework-neutral state, binding, predicate, action, resource, operation, behavior, lifecycle,
and activation-state semantics. The core consumes verified JSON data and target-independent host
ports, then emits JSON-serializable snapshots, diagnostics, traces, and render plans.

## Host and persistence boundary

Navigation, storage, operations, resources, tokens, environment, clock, scheduling, diagnostics,
cryptography, entropy, and adapter lookup enter through explicit ports. The core defines the
activation transaction contract but does not implement IndexedDB, filesystem, network, or native
storage.

A durable activation commit contains the active revision, previous-good revision, and generation
guard as one atomic record. The runtime does not expose a staged revision to renderers before that
commit succeeds. Browser-specific persistence belongs to `runtime-web`; a future native runtime
may satisfy the same contract with its platform transaction mechanism.

## Explicit non-responsibilities

- React, React Native, DOM, CSS, or browser APIs
- Node built-ins or filesystem access
- Storage, network, clock, or cryptography implementations
- Component implementations or framework adapter registration
- Editor UI or application code

## Status

Scaffolded and private. Functional APIs will be added only by their tracked implementation tasks.

## Protocol and target support

- Protocol baseline: DESEN 0.1.0
- Target: platform-neutral

## Quality

Use the root workspace quality gate and boundary fixture audit:

```bash
pnpm check
node scripts/verify-boundary-fixtures.mjs
```
