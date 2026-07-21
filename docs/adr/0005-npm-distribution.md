# ADR 0005: npm distribution through `desen`

- Status: Accepted
- Date: 2026-07-21

## Decision

Retain the owned unscoped `desen` package as the eventual public facade and CLI. Expose focused
APIs through subpath exports such as:

```text
desen/protocol
desen/validator
desen/publisher
desen/runtime
desen/react
desen/catalog
desen/test
```

Internal workspace packages use clear boundaries but remain private during the proof phase. An
`@desen/*` public package strategy is deferred until npm scope ownership and independent package
versioning are intentionally established.

The first new public line is `2.0.0-alpha.0` under the `next` dist-tag. This creates an explicit
boundary after the unrelated prototype history. Alpha and beta releases never move `latest`;
`latest` is reserved for a separately approved, production-supported stable release. npm package
versions and DESEN protocol versions are independent and are joined by a published compatibility
matrix.

Because the internal `@desen/*` packages remain private, the public `desen` artifact must embed
the compiled implementation needed by its exports. It must not declare runtime dependencies on
private workspace packages. Release evidence includes a packed-tarball content audit and an
installation test in a clean project.

Publication metadata may name only destinations and entry points that exist and are verifiable.
In particular, a CLI `bin` is not declared until the CLI exists and passes its packed-artifact
smoke test.

Do not delete or republish the existing test package during preparation. Follow the transition
runbook only after the public-alpha gate. Generic publishing commands remain disabled until an
explicitly approved OIDC and staged-publishing workflow is in place.
