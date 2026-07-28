# @desen/publisher

## Responsibility

Pure, deterministic DESEN Source-to-immutable-Bundle publication orchestration. M06-T01 establishes
the terminal result, staged diagnostic, and strict raw-Source parsing boundaries used by the later
publication stages.

## Explicit non-responsibilities

No editor UI, runtime execution, storage, network, package discovery transport, signing,
publication metadata policy, or Bundle activation. The package never imports React, DOM, CSS,
Node.js, a host application, or target-specific capability implementations.

## Status

Private and under tracked implementation. The public root currently exposes the stable
`PublishResult` contract, publication-stage vocabulary, Publisher diagnostic registry, and the
finite Source-ingress profile. It intentionally does not expose a partial parser or an unfinished
`publish` function. The real terminal publication entry point is added only when it can either
return a fully validated immutable Bundle or reject with no Bundle.

## Public entry point

Import only from `@desen/publisher`. Private stage modules are implementation details.

```ts
import { getPublisherDiagnosticDefinition, PUBLISH_PIPELINE_STAGES } from "@desen/publisher";

const firstStage = PUBLISH_PIPELINE_STAGES[0]; // "json-parse"
const definition = getPublisherDiagnosticDefinition("run.desen.publisher/INVALID_SOURCE_JSON");
```

`PublishResult` follows the frozen implementation guide:

```ts
import type { PublishResult } from "@desen/publisher";

function consume(result: PublishResult) {
  if (!result.ok) {
    // `result.bundle` does not exist; diagnostics begin with a blocking error.
    return { failedAt: result.stage, diagnostics: result.diagnostics };
  }
  return { bundle: result.bundle, warnings: result.diagnostics };
}
```

Success diagnostics are warnings only. Failure diagnostics are non-empty, begin with an error, and
carry a stable stage, code, safe message, optional RFC 6901 pointer, and available Source identity
context. Core diagnostics retain their Appendix B `classification`; Publisher severity is a
separate local field.

## Strict Source ingress

Raw Source parsing stays package-private so unvalidated JSON cannot be mistaken for publication
success. Before schema validation or hashing, it rejects malformed syntax, duplicate decoded
member names, invalid Unicode, non-finite numeric outcomes, and finite-budget exhaustion. Native
parser errors and Source fragments never enter diagnostics. Accepted pre-schema JSON is detached
and recursively frozen.

The frozen local profile is:

| Budget                         |     Limit |
| ------------------------------ | --------: |
| Raw Source UTF-8 bytes         | 8,388,608 |
| JSON container depth           |       256 |
| JSON value occurrences         |   262,144 |
| Aggregate decoded string units | 4,194,304 |
| One number-token code units    |     1,024 |

These are project-owned finite ingress limits, not universal DESEN constants. `PF-060` records the
reasoning and the protocol gaps they resolve locally.

## Dependencies

- `@desen/protocol` supplies frozen Bundle types, core diagnostics, and RFC 6901 pointers.
- `@desen/validator` supplies recursively immutable document typing and semantic diagnostic codes.

The dependency direction remains `publisher → validator → protocol`; no runtime or editor package
is reachable.

## Failure behavior

- Raw malformed, duplicate-member, invalid-Unicode, or non-finite JSON emits
  `run.desen.publisher/INVALID_SOURCE_JSON`.
- A parser-budget crossing emits `run.desen.publisher/SOURCE_LIMIT_EXCEEDED`.
- Neither path exposes a parsed value, partial Bundle, native exception text, stack, cause, or
  caller Source fragment.
- Schema, Catalog, semantic, normalization, digest, and final-Bundle failures are added by their
  assigned M06 tasks and must relay stable diagnostics through the same closed result.

## Protocol and target support

- Protocol baseline: DESEN 0.1.0
- Initial target: platform-neutral
- First resolved capability target: Web–React, added through Catalog data rather than a framework
  dependency
- Future native targets reuse this package without importing Web or React APIs

## Testing

```bash
pnpm --filter @desen/publisher typecheck
pnpm --filter @desen/publisher lint
pnpm --filter @desen/publisher test:publish-result
pnpm --filter @desen/publisher build
pnpm test:publisher-publish-result
pnpm check
```
