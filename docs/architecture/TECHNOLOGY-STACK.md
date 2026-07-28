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
- React 19.2.8 and React DOM 19.2.8 for `runtime-react`, the Web reference adapters, and the
  independent reference host
- Vite 8.1.5 for the independent reference host's zero-configuration production build
- Testing Library React 16.3.2 and jsdom 29.1.1 for user-observable component semantics
- dependency-cruiser 18.1.0
- Changesets 2.31.1, disabled for external publishing during the proof phase
- json-schema-to-typescript 15.0.4, build-only and pinned for protocol type generation

## Planned implementation choices

| Area                     | Choice                                  | Reason                                                              |
| ------------------------ | --------------------------------------- | ------------------------------------------------------------------- |
| Desen App client         | React 19 and Vite 8                     | Client-heavy editor with a simple, explicit Web build               |
| Protocol validation      | Ajv Draft 2020-12                       | Direct execution of canonical JSON Schema without a second contract |
| Protocol type projection | json-schema-to-typescript 15.0.4        | Deterministic build-only declarations from the frozen schema roots  |
| API                      | Fastify 5                               | Small typed control plane with replaceable repositories             |
| Unit/integration tests   | Vitest                                  | Fast TypeScript-native package tests                                |
| Property tests           | fast-check                              | Determinism, canonicalization, limits, and state-machine invariants |
| React tests              | Testing Library                         | User-observable adapter and editor behavior                         |
| Browser proof            | Playwright                              | Cross-application Desen App-to-host evidence                        |
| Web styling              | CSS variables/tokens and CSS Modules    | No CSS or DOM implementation detail leaks into capability contracts |
| Local metadata           | SQLite behind repositories              | Repeatable local proof without premature cloud infrastructure       |
| Immutable artifacts      | Content-addressed local files initially | Bundle bytes can be independently hashed and audited                |
| Browser LKG              | IndexedDB behind a storage port         | Persistent last-known-good across browser restart                   |

Map provider, drag-and-drop adapter, router, query cache, and UI component dependencies are chosen
only by their owning tasks and require an ADR when they affect public capability contracts.

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
- The reference host is Web-only and independently built with Vite's zero-configuration path;
  future native targets own separate renderers and platform hosts rather than importing its React
  root.
- The browser activation store commits active and previous-good revision pointers in one IndexedDB
  transaction before notifying renderers.
