# DESEN

This repository contains the Web–React reference implementation of the frozen DESEN 0.1.0
protocol, the Desen App product, and the developer tooling intended for `desen.run`.

## Product boundaries

- **DESEN** is the open, data-only executable design protocol.
- **Desen App** (`desen.app`) is the official visual authoring and publishing product built on
  DESEN. It is not the protocol itself.
- **DESEN Developer Platform** (`desen.run`) is the protocol, SDK, conformance, integration, and
  package documentation home. It is a domain and developer surface, not a second authoring product.
- **`desen` on npm** will become the developer entry package and CLI after the public-alpha proof
  gates pass.

## Current goal

Prove, with repeatable evidence, that a designer-authored surface can be validated, published as
an immutable DESEN bundle, and activated in a separately built host application without a
developer recreating that surface in React.

The first target is exactly `web-react`. Platform-neutral packages must remain free of React,
DOM, CSS, browser, and application dependencies so future native runtimes can implement the same
observable protocol semantics.

## Workspace map

```text
apps/
  desen-app/              Visual authoring and publishing product
  reference-host-web/     Separately built production-like proof host
  control-plane-api/      Source, bundle, and channel service
  desen-run/              Future DESEN Developer Platform site
packages/
  protocol/               Frozen 0.1.0 artifacts, types, diagnostics, digest helpers
  validator/              Structural and semantic validation
  publisher/              Pure source-to-bundle publication
  runtime-core/           Framework-neutral execution semantics
  runtime-react/          React render adapter
  runtime-web/            Browser host ports and last-known-good storage
  catalog-sdk/            Capability registration and manifest tooling
  editor-core/            Framework-neutral source editing commands
  editor-web/             Desen App canvas and inspector
  reference-catalog-web/  Real components shared by editor and host
  testkit/                Fixtures, trace assertions, and conformance helpers
  desen/                   Future public npm facade and CLI
```

## Non-negotiable rules

1. The frozen protocol repository is never silently edited to make the implementation pass.
2. The runtime and publisher are built before the visual editor.
3. The Desen App preview and reference host use the same registered component implementations.
4. The reference host contains no manually duplicated managed-screen component tree.
5. Production bundles contain data, never arbitrary executable code.
6. Unknown or incompatible capabilities fail explicitly; runtimes never guess replacements.
7. A failed activation leaves the last-known-good revision active.
8. Every public export has TSDoc and every package has a maintained README.
9. Comments explain invariants and reasoning, not syntax.
10. No external package or domain is published before the public-alpha release gate.

## Start here

- [Project status](PROJECT-STATUS.md)
- [Master implementation plan](docs/plan/MASTER-PLAN.md)
- [Task board](docs/plan/TASKS.md)
- [Proof matrix](docs/proof/PROOF-MATRIX.md)
- [Architecture](docs/architecture/ARCHITECTURE.md)
- [Technology stack](docs/architecture/TECHNOLOGY-STACK.md)
- [Engineering standards](docs/standards/ENGINEERING-STANDARDS.md)
- [Documentation standards](docs/standards/DOCUMENTATION-STANDARDS.md)
- [Protocol findings](docs/plan/PROTOCOL-FINDINGS.md)

## Local quality commands

```bash
pnpm install
pnpm verify:protocol-snapshot
pnpm check
```

`pnpm proof` and `pnpm test:e2e` deliberately return `NOT_IMPLEMENTED` until their G10 runners
exist; an absent proof runner is never treated as a successful proof.

The exact DESEN 0.1.0 input snapshot is vendored and checksum-enforced; this does not yet claim
validator or runtime semantics. The next implementation task is `M02-T02`, which traces normative
prose and schema constraints before type generation begins.

## License

Apache License 2.0. See [LICENSE](LICENSE).
