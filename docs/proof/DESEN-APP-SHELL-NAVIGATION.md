# Desen App shell and navigation

Task: M09-T01

Status: DONE

Artifact: `docs/proof/artifacts/desen-app-0.1.0-shell-navigation.json`

Final artifact: `sha256:3a7ff5d58815eb4a731ce10271a39bc8567d846e57c1aaf6303beee624465fdb`

## Claim boundary

M09-T01 introduces the first React 19 and Vite 8 Desen App slice. It owns a guided projects home,
project and surface shell navigation, fixed inert project fixtures, fixture search, responsive
presentation, and accessibility behavior. Its closed route profile is:

- `/projects`;
- `/projects/:projectId`; and
- `/projects/:projectId/surfaces/:surfaceId`.

The bare `/` entry is replaced with `/projects`. App-owned links use same-origin History API
transitions and a private navigation event, while `popstate` preserves browser traversal. Route
segments are bounded lowercase kebab-case values. Unknown, ambiguous, encoded-alias, over-limit,
cross-origin, credential-bearing, query-bearing, and fragment-bearing app transitions fail closed.
Unknown projects and surfaces render explicit recovery guidance without substituting another
fixture.

The projects home searches only the exact two fixture projects, exposes an explicit zero-result
state, and explains why project creation and capability connection are unavailable. The project
shell exposes only exact fixture surface selection and an honest workspace placeholder. It does not
present disabled future work as completed editor behavior.

## User-observable profile

The shell uses native links, buttons, headings, lists, and document landmarks. It includes a skip
link, `aria-current` navigation state, described disabled actions, visible `:focus-visible` styling,
route-heading focus after client navigation, deterministic document titles, reduced-motion
handling, and layouts that collapse without hiding navigation or recovery paths.

The Figma M09 UX wireframe supplied information architecture and product-language input. It is not
an evidence artifact, semantic oracle, runtime dependency, or executable source. The implementation
uses repository-owned React, TypeScript, CSS Modules, and application-specific CSS variables.

## Exact prerequisite authority

The evidence builder is designed to authenticate the completed M08-T10/G08 terminal editor artifact
at `docs/proof/artifacts/editor-core-0.1.0-terminal-integration.json`, 325,549 bytes and
`sha256:5787479d699ab8f53b739e633bf9a88900da00ae4f4c78f96b3e62a73133fa1b`. A live reader,
checkpoint head, Figma node, fixture label, or caller-supplied status cannot substitute for that
frozen prerequisite.

## Deterministic local evidence

The task-local evidence reader records the exact application and proof-source receipts, closed
route profile, fixture identities, accessibility assertions, package boundary, and explicit
nonclaims. The focused Vitest inventory contains 43 cases: 30 navigation cases, ten application
cases, and three lifecycle cases. The independent root suite is designed to mutation-test the G08
pin, route semantics, package identity, forbidden scope widening, deterministic evidence bytes,
visible proof pin, atomic writing, and linked-file authorities.

The application build, typecheck, and lint commands pass locally, and the focused application suite
passes 43/43. Deterministic regeneration after the tracked root-test correction produced the exact
9,795-byte artifact pinned above, recording 19 tracked task files and 43 runtime cases. These
observed receipts make no independent root-suite, reader checkpoint, required-gate, or hosted CI
claim by inference. The independent root mutation suite subsequently passes 8/8. Append-only reader
checkpoint sequence 40 passes its 63/63 suite and closes at
`sha256:eedd62fc8e56534a032034280e0189b9ab76445bd89ef2dc735aabc14e1d67c0`, authenticating 36
frozen artifacts and 72 live readers. It preserves sequences 1–39 and all 35 predecessor artifact
receipts byte-exact, appends the M09-T01 artifact at index 35 and its proof/root readers at indexes
`[70, 71]`, advances the live T09/T10 source readers at `[66, 67, 68]` for current README bytes,
and reauthenticates the unchanged T10 root receipt at `[69]`. No required-gate or hosted CI result
is claimed; those authorities must be recorded separately only after their own execution.

## Honest remaining scope

M09-T01 does not implement or claim a Catalog-driven component panel, layer tree, real adapter
canvas, selection or inspector state, Source mutation, undo/redo, continuous diagnostics,
persistence UI, user-created projects, Design/Run execution, publication, channel activation,
multi-user collaboration, or browser E2E. It changes no frozen DESEN 0.1.0 byte and advances no
`P-*`, `N-*`, or `S-*` claim by itself.

## Verification commands

```bash
pnpm --filter @desen/app-web build
pnpm --filter @desen/app-web typecheck
pnpm --filter @desen/app-web lint
pnpm --filter @desen/app-web test:shell
node scripts/generate-desen-app-shell-navigation-proof.mjs
node scripts/verify-desen-app-shell-navigation.mjs
node --test tests/desen-app-shell-navigation.test.mjs
```

The generator command is a deliberate local write. Hosted CI must verify the already tracked
artifact and must never generate or repair it.
