# @desen/editor-web

## Responsibility

`@desen/editor-web` contains browser-facing adapters for the framework-neutral editor core and will
later contain the Desen App canvas, inspector, overlays, layer tree, and Design/Run mode UI.

M08-T08 adds `createLocalDesenEditorPersistencePort`. The factory binds the neutral
`DesenEditorPersistencePort` to the M07-T05 loopback Source API through an explicitly injected
transport. It sends and receives complete Source documents, including root `authoring` and
`extensions`, under generation compare-and-set.

M09-T14 adds `createLocalDesenBundleChannelPublicationPort`. This browser-safe trusted-host
adapter stores exact canonical Bundle bytes in the local control plane and advances one configured
channel with compare-and-set. It does not activate a Runtime or reference host; activation remains
a distinct server-owned step observed by Desen App.

## Local persistence profile

- The origin must be exactly `http://127.0.0.1:<port>`; redirects are rejected.
- The bearer token and fetch-like transport are required trusted-host inputs. There is no implicit
  global `fetch` fallback.
- `expectedGeneration: null` creates only when absent. Positive generations update only the exact
  observed generation.
- Canonical Source bytes are produced by `@desen/editor-core`; the Web adapter does not reinterpret
  or selectively remove authoring data.
- The adapter never retries or merges a compare-and-set conflict.
- A rejected transport, malformed response, explicit uncertain outcome, or storage failure that
  may follow a PUT commit is reported as `indeterminate`. The caller must reopen the Source to
  resolve that state. Authentication, precondition, body, and Source-admission rejections that are
  proven to precede persistence remain definite failures.

## Local Bundle and channel publication profile

- The origin, token, explicit transport, redirect, response-size, and finite-byte constraints match
  the conservative loopback adapter boundary; there is no ambient global `fetch` fallback.
- One fixed configured channel is read first, the exact immutable Bundle is written second, and the
  channel is advanced last against that initial generation snapshot.
- A Bundle already stored with identical bytes and a channel already naming the exact revision are
  explicit unchanged successes. A channel compare-and-set conflict is returned with the observed
  generation and is never retried automatically.
- Definite pre-commit failures stay separate from Bundle-write or channel-write uncertainty. An
  uncertain result must be reconciled by inspecting the control plane before another publish.
- Channel discovery is not activation authority. The adapter exposes no reference-host refresh,
  durable-active receipt, Runtime mount, filesystem, or executable binding capability.

## Explicit non-responsibilities

This package does not own SQLite, filesystem durability, storage paths, Source listing/deletion,
automatic conflict resolution, reference-host activation, terminal commands, UI state, duplicate
runtime semantics, or private capability DOM inspection. The control plane remains the local
durability authority.

## Protocol and target support

- Protocol baseline: DESEN 0.1.0
- Initial target: web-react

## Quality

- Focused adapter tests: `pnpm --filter @desen/editor-web test:local-source-persistence`
- Focused publication tests: `pnpm --filter @desen/editor-web test:publication`
- Emitted-package contract: `pnpm --filter @desen/editor-web test:public-package`
- Package checks: `pnpm --filter @desen/editor-web lint && pnpm --filter @desen/editor-web typecheck`
- Final milestone gate: `pnpm check`
