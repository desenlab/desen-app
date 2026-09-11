# Technology Stack

Dependencies are added only when their owning task begins. This avoids unused packages and forces
every dependency to have a documented responsibility.

## Installed foundation

- Node.js 24.10.0
- pnpm 11.15.1
- TypeScript 6.0.3 in strict mode
- Turborepo 2.10.5
- ESLint 10.7.0 and Prettier 3.9.6
- Vitest 4.1.10
- React 19.2.8 and React DOM 19.2.8 for `runtime-react`, the Web reference adapters, the independent
  reference host, and the Desen App shell
- Vite 8.1.5 for independent reference-host and Desen App production builds and the reference
  host's programmatic resolved-module-graph audit
- Testing Library React 16.3.2 and jsdom 29.1.1 for user-observable adapter, host, and Desen App
  shell semantics
- Playwright 1.62.1 with its package-pinned Chromium runtime for the isolated Desen App browser
  proof; the browser job executes in parallel with the repository quality gate
- Fastify 5.12.2 for the fixed-loopback, bearer-authenticated local control-plane transport;
  SEC-01 also pins transitive fast-uri 3.1.7 and 4.1.4 in the workspace lockfile
- better-sqlite3 13.0.3 behind the local Source-generation and channel-pointer repositories; its
  native import is isolated to the exact control-plane local-API proof pair
- the browser's injected `fetch` capability for the reference host's fixed same-origin
  `POST /api/sign-in` operation boundary; no transport client dependency is added
- dependency-cruiser 18.1.0
- Changesets 2.31.1, disabled for external publishing during the proof phase
- json-schema-to-typescript 15.0.4, build-only and pinned for protocol type generation

SEC-02's development-tool security maintenance pins transitive Undici 7.29.1, PostCSS 8.5.28,
js-yaml 3.15.2/4.3.2, brace-expansion 5.0.9, and nanoid 3.3.18. Their owning tools and direct
manifests remain unchanged. The full and production registry audits report zero findings on
2026-09-06; this is dated evidence, not a future vulnerability-free guarantee. The
[SEC-02 report](../proof/SEC-02-DEVELOPMENT-DEPENDENCY-SECURITY.md) records upstream review and
fresh compatibility checks.

## Planned implementation choices

| Area                     | Choice                                  | Reason                                                              |
| ------------------------ | --------------------------------------- | ------------------------------------------------------------------- |
| Protocol validation      | Ajv Draft 2020-12                       | Direct execution of canonical JSON Schema without a second contract |
| Protocol type projection | json-schema-to-typescript 15.0.4        | Deterministic build-only declarations from the frozen schema roots  |
| Unit/integration tests   | Vitest                                  | Fast TypeScript-native package tests                                |
| Property tests           | fast-check                              | Determinism, canonicalization, limits, and state-machine invariants |
| React tests              | Testing Library                         | User-observable adapter and editor behavior                         |
| Web styling              | CSS variables/tokens and CSS Modules    | No CSS or DOM implementation detail leaks into capability contracts |
| Immutable artifacts      | Content-addressed local files initially | Bundle bytes can be independently hashed and audited                |
| Browser LKG              | IndexedDB behind a storage port         | Persistent last-known-good across browser restart                   |

Map provider, drag-and-drop adapter, router, query cache, and UI component dependencies are chosen
only by their owning tasks and require an ADR when they affect public capability contracts.

## M10A product foundation — T01 complete, T02 candidate

M10A-T01 pins `@base-ui/react` **1.8.0** behind the private
`@desen/starter-catalog-web` Catalog/adapter package, with DESEN-owned Neutral styles implemented
using CSS Modules and token-backed CSS variables. The completed boundary authenticates the exact
dependency, lockfile integrity, peer range, installed manifest and MIT license, and records
production versus development audit findings separately. It proves only the bounded Button,
Select, and Dialog slice; it is not a complete component library, App migration, package release,
or production deployment.

M10A-T02 is `IN_PROGRESS`: its locally passing `@desen/design-system-core` candidate admits the
App-owned v1 envelope and resolves the bounded DTCG 2025.10 profile with deterministic external
source overlays, whole-token aliases, and final literal overrides. It imports only `@desen/protocol`
and `@desen/editor-core`; hosted exact-head closure is pending. T03 UI, persistence, releases, App
integration, materialization, Publisher, and Runtime authority remain later work. See the
[T02 proof](../proof/M10A-T02.md).
The integrated design-system explorer uses Catalog/Source, not executable story files. Visual
capture uses the existing Playwright foundation; M10A-T24 owns exact pixel-diff dependency pins
and hermetic capture configuration. No Storybook, Chromatic, Tailwind or second primitive library
is introduced by this decision. See [ADR 0023](../adr/0023-design-first-authoring-and-design-system-workbench.md)
and the [selection rationale](../plan/M10A-IMPLEMENTATION-PLAN.md#selected-component-foundation).

## Desen App M09-T01 profile

The first Desen App slice uses React's external-store contract over an application-owned History
API helper. It adds no router, query cache, UI kit, icon package, or CSS framework. Routes and inert
fixtures are deliberately finite. Five repository-owned inert SVG assets provide shell icons
without adding an icon-package or executable dependency, and CSS Modules plus `--desen-app-*`
variables keep application chrome separate from future Catalog-rendered canvas tokens. This choice
is internal to the Web application and does not alter a public capability contract.

## Desen App M10-T01A local product profile

The normal local product uses the existing `@desen/control-plane-api` SQLite Source repository and
the public `@desen/editor-web` local persistence adapter. `pnpm --filter @desen/app-web dev` is an
App-owned Node launcher rather than a bare Vite command: it starts both authorities, fixes Vite to
`127.0.0.1:5173`, stores durable developer state under ignored
the repository-level `.desen/desen-app/control-plane` directory outside Vite's served root, and
injects a fresh in-memory runtime credential. Vite additionally denies `.desen` and `/@fs/` state
requests before SPA fallback. The browser
bundle depends only on the Editor Web adapter; Node control-plane and Vite launcher code remain in
the development composition and cannot enter the browser graph.

No router, project database abstraction, IndexedDB layer, localStorage use, modal library, UI kit,
or remote synchronization client is added. The current project inventory is derived from the one
exact admitted Source profile. A future multi-project or hosted profile must introduce its own
authenticated project authority behind an explicit App boundary rather than infer identities from
URLs or reuse this local fixed profile.

## Explicit constraints

- No framework runtime is allowed to reinterpret DESEN semantics.
- No runtime fetches executable component code named by a bundle.
- No schema library becomes an independent source of truth beside JSON Schema.
- No browser or React type crosses a platform-neutral public API.
- Platform-neutral packages compile against ECMAScript libraries only and receive no ambient Node
  or DOM types.
- `runtime-react` receives React JSX types but no DOM library; browser packages extend the separate
  React-Web or browser configuration, and the control plane extends the Node configuration.
- `catalog-sdk` describes data contracts only. React adapter registration belongs to
  `runtime-react`.
- The local control plane binds only to its fixed loopback profile, accepts exact bearer and origin
  configuration, and uses finite 5-second inactivity, 15-second request, and 5-second keep-alive
  timeouts. SQLite is a replaceable repository implementation, not protocol authority.
- Native-addon execution is denied by default in proof isolation and granted only to the reviewed
  local-API verifier/root-test pair. The locked production dependency graph is audited before the
  task artifact is accepted.
- The reference host is Web-only and independently built with Vite's zero-configuration path;
  future native targets own separate renderers and platform hosts rather than importing its React
  root.
- The no-handwritten-managed-tree gate uses TypeScript's semantic checker for source structure,
  Vite's actual `moduleParsed` production graph for runtime resolution, and dependency-cruiser for
  package boundaries. Declaration resolution or source-text substring checks cannot substitute
  for the Vite graph.
- The reference host production entry may compose only the committed official-derived Bundle,
  exact current Catalog, public real adapter registry, and explicit host ports. Its sign-in
  transport performs one request with no retry or credential persistence beyond that request's
  lifetime. A 64 KiB and 1,024-non-empty-chunk streaming ceiling applies before JSON parsing.
  HTTP and transport details collapse into declared operation results before they reach runtime
  semantics.
- Replacement revokes and disposes the exact old session and browser-host authorities so their
  late settlement cannot affect the new surface. This is logical stale containment; the current
  transport does not cancel an already-started fetch, and its loading `Button` suppresses
  same-surface repeated submission while pending.
- The browser activation store commits active and previous-good revision pointers in one IndexedDB
  transaction before notifying renderers.
