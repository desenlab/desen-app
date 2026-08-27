# @desen/editor-web

## Responsibility

`@desen/editor-web` contains browser-facing adapters for the framework-neutral editor core and will
later contain the Desen App canvas, inspector, overlays, layer tree, and Design/Run mode UI.

M08-T08 adds `createLocalDesenEditorPersistencePort`. The factory binds the neutral
`DesenEditorPersistencePort` to the M07-T05 loopback Source API through an explicitly injected
transport. It sends and receives complete Source documents, including root `authoring` and
`extensions`, under generation compare-and-set.

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

## Explicit non-responsibilities

This package does not own SQLite, filesystem durability, storage paths, Source listing/deletion,
automatic conflict resolution, terminal commands, UI state, duplicate runtime semantics, or private
capability DOM inspection. The control plane remains the local durability authority.

## Protocol and target support

- Protocol baseline: DESEN 0.1.0
- Initial target: web-react

## Quality

- Focused adapter tests: `pnpm --filter @desen/editor-web test:local-source-persistence`
- Emitted-package contract: `pnpm --filter @desen/editor-web test:public-package`
- Package checks: `pnpm --filter @desen/editor-web lint && pnpm --filter @desen/editor-web typecheck`
- Final milestone gate: `pnpm check`
