# Public Alpha Release Checklist

No item in this checklist is authorized merely because the file exists. External publication
requires explicit approval after G12.

- [ ] All G00–G12 gates required for the declared alpha scope are passed.
- [ ] Protocol baseline, conformance report, and compatibility matrix are current.
- [ ] `pnpm check`, coverage, browser E2E, proof, and package audits pass from a clean checkout.
- [ ] Deterministic bundle and last-known-good tests pass.
- [ ] Public API TSDoc and package READMEs are complete.
- [ ] Secrets, fixtures, licenses, vulnerabilities, and package contents are audited.
- [ ] All external claims match actual proof statuses and limitations.
- [ ] Existing npm installable versions, removed-version `time` keys, owners, and dist-tags are
      re-read immediately before mutation.
- [ ] The first public line is `2.0.0-alpha.0` under `next`; no alpha or beta is tagged `latest`.
- [ ] npm prototype deprecation message and migration path are approved.
- [ ] The public `desen` artifact has no runtime dependency on private `@desen/*` packages or old
      `@desenlabs/*` packages.
- [ ] `npm pack` contents are audited and the tarball installs in a clean temporary project; every
      declared subpath export passes its smoke test.
- [ ] Package metadata contains only verified destinations and identities; no old repository URL,
      placeholder URL, or unimplemented CLI `bin` remains.
- [ ] Trusted publishing, provenance, an explicit `next` tag, and staged human approval are
      configured and tested without long-lived write tokens.
- [ ] The DESEN Developer Platform (`desen.run`) publishes a byte-identical, checksum-verified
      protocol snapshot and versioned docs.
- [ ] The `desen.run` snapshot is labeled as a mirror and preserves the frozen
      `https://schemas.desen.dev/...` schema identifiers unchanged.
- [ ] `desen.app` deployment is labeled as an alpha reference product.
- [ ] Rollback procedures for sites, tags, releases, and dist-tags are tested.
- [ ] Final human approval is recorded.
