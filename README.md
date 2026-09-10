# DESEN

DESEN is a data-only executable design protocol. This repository contains its Web–React reference
implementation, the Desen App visual authoring product, and the proof infrastructure used to make
bounded, reproducible claims about both.

> M10 and the terminal G10 gate are complete. SC-02 is the next decision checkpoint; M11 has not
> started. This is a working-draft reference implementation, not a production certification.

## Implementation progress

<!-- task-progress:start -->
<!-- Source: docs/plan/TASKS.md. Update this block in the same commit whenever a task status changes. Milestone gates are tracked separately and excluded from task counts. -->

**Overall:** `████████████████████░░░░░` **121 / 148 tasks complete (82%)**

**M02 complete:** `█████████████` **13 / 13 tasks complete (100%)**

**M03 complete:** `██████████` **10 / 10 tasks complete (100%)**

**M04 complete:** `█████████████████` **17 / 17 tasks complete (100%)**

**M05 complete:** `█████████` **9 / 9 tasks complete (100%)**

**M06 complete:** `███████████` **11 / 11 tasks complete (100%)**

**M07 complete:** `███████████` **11 / 11 tasks complete (100%)**

**M08 complete:** `██████████` **10 / 10 tasks complete (100%)**

**M09 complete:** `██████████████` **14 / 14 tasks complete (100%)**

**M10 complete:** `████████████` **12 / 12 tasks complete (100%)**

**Proof gates:** **11 / 13 complete** · **G10:** `DONE` · **Runtime Core baseline:** frozen ·
**Next decision:** `SC-02` · **M11:** `NOT_STARTED`

[View the canonical task board](docs/plan/TASKS.md)

<!-- task-progress:end -->

## What M10 proves

The completed [G10 terminal gate](docs/proof/DESEN-APP-M10-GATE.md) joins nine independent
Chromium journeys with the exhaustive proof graph. Within the declared Web–React profile, a
designer can author, validate, publish, activate, update, reject, and recover a managed surface
without a developer recreating that surface in the host's React tree.

The proof includes:

- visible authoring through the normal Desen App product;
- deterministic Source-to-Bundle publication;
- an independently built host consuming the active revision;
- label and layout updates without host source or asset changes;
- invalid-publication rejection without replacing the valid design;
- last-known-good recovery across complete process restarts; and
- a committed Runtime Core tree baseline for the M11 comparison.

It does not prove native runtimes, production security, remote multi-user deployment, arbitrary
capability interoperability, or public-alpha release readiness.

## Quick start

Requirements: Node.js 24 or newer and pnpm 11.15 or newer. Exact versions are recorded in
`.node-version` and `package.json`.

```bash
pnpm install --frozen-lockfile
pnpm --filter @desen/app-browser-e2e exec playwright install chromium
pnpm demo:reset
```

`pnpm demo:reset` starts a clean, dedicated local M10 demo workspace. Use `pnpm demo` to resume it.
The [demo runbook](docs/plan/DEMO-RUNBOOK.md) explains the authoring, test, publish, update, and
recovery journey.

## Architecture at a glance

```text
Desen App -> DESEN Source -> Publisher -> immutable Bundle -> Control Plane
                                                             |
                                                             v
                                                     separate Host
                                                             |
                                          Runtime Core + target adapters
```

The protocol, validator, publisher, Runtime Core, and Editor Core are platform-neutral. React,
DOM, CSS, and browser concerns enter only through target-specific adapters and applications.

## Workspace map

```text
apps/
  desen-app/                   Visual authoring and publishing product
  desen-app-browser-e2e/       Independent Chromium product journeys
  reference-host-web/          Separately built proof host
  reference-host-web-server/   Local host/control-plane bridge
  control-plane-api/           Local Source, Bundle, channel, and activation service
  desen-run/                   Future developer-platform surface
packages/
  protocol/               Frozen 0.1.0 inputs and portable primitives
  validator/              Structural and semantic validation
  publisher/              Deterministic Source-to-Bundle publication
  runtime-core/           Framework-neutral execution semantics
  runtime-react/          React adapter integration
  runtime-web/            Browser host ports and recovery storage
  catalog-sdk/            Capability registration and manifest tooling
  editor-core/            Framework-neutral authoring commands
  editor-web/             Web canvas and inspector integration
  reference-catalog-web/  Reference components and adapters
  testkit/                Fixtures and conformance helpers
  desen/                   Future public facade and CLI
```

## Non-negotiable boundaries

1. Frozen DESEN 0.1.0 upstream bytes are never edited to make implementation tests pass.
2. DESEN documents contain data and never select arbitrary executable code.
3. Packages never depend on applications; platform-neutral packages never import platform code.
4. Desen App preview and the reference host resolve the same registered capabilities.
5. The reference host contains no handwritten managed-screen component tree.
6. Unknown or incompatible semantics fail explicitly.
7. Failed activation preserves the last-known-good revision.
8. Public exports require TSDoc, and implementation choices outside the protocol are labeled as
   reference profiles.

## Documentation map

- [Current project status](PROJECT-STATUS.md) — current transition and verified closure only
- [Turkish start guide](docs/plan/START-HERE.tr.md) — contributor reading and execution order
- [Task board](docs/plan/TASKS.md) — canonical status, dependencies, deliverables, and evidence
- [Master plan](docs/plan/MASTER-PLAN.md) — milestone intent and gates
- [Architecture](docs/architecture/ARCHITECTURE.md) — system boundaries and dependency direction
- [ADRs](docs/adr/) — decisions and their consequences
- [Proof Matrix](docs/proof/PROOF-MATRIX.md) — claim-to-evidence authority
- [Protocol Findings](docs/plan/PROTOCOL-FINDINGS.md) — frozen-spec ambiguities and profiles
- [Debt Register](docs/plan/DEBT-REGISTER.md) — explicit cleanup ownership and deadlines
- [Documentation Standards](docs/standards/DOCUMENTATION-STANDARDS.md) — document lifecycle and size
  budgets

## Quality commands

Use the bounded baseline for ordinary task feedback:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm build
pnpm boundaries
node scripts/ci/verify-proof-reader-checkpoints.mjs
```

Run `pnpm check` for an exhaustive local audit or gate closure. Run `pnpm test:e2e` for the complete
nine-journey Chromium suite. Hosted completion still requires the task's exact-head CI contract.

## Next decision

Before either M11 branch starts, [SC-02](docs/plan/STRATEGIC-VALIDATION.md) requires real workflow
interviews and at least two credible bounded pilot commitments. If that checkpoint authorizes
continuation, Map (`M11-T01`) and Sortable (`M11-T08`) may begin independently while preserving the
frozen Runtime Core tree.

## Historical record

The chronological archive and immutable pre-consolidation pointer are owned by the
[documentation standard](docs/standards/DOCUMENTATION-STANDARDS.md#document-lifecycle-and-ownership).
Task results remain in task-owned proof documents. This living README intentionally does not
duplicate chronological receipts.

The following line is an immutable CI-02 compatibility pin describing its historical pre-merge
state, not current status:

**CI-02:** conditional `DONE` on this exact PR head's hosted `Quality gate`; canonical status remains `IN_PROGRESS` while it is pending

## Contributing, security, and license

Read [CONTRIBUTING.md](CONTRIBUTING.md) before changing code. Report vulnerabilities through the
private process in [SECURITY.md](SECURITY.md), never through a public issue.

Apache License 2.0. See [LICENSE](LICENSE).
