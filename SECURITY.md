# Security Policy

DESEN 0.1.0 and this reference implementation are working-draft software. They are not a security
certification and must not yet be used to process production secrets or sensitive personal data.

## Security invariants

- DESEN source and bundle documents are data-only.
- Runtime code comes only from host-approved capability packages.
- Bundles never select arbitrary remote code.
- Resources and operations are bound by the host application.
- Fixtures contain synthetic data only.
- Activation verifies protocol version, revision, exact packages, and capability compatibility.
- Failed staging never changes the active revision.
- Diagnostics never expose secrets, raw internal errors, or private response bodies.

## Reporting

Do not open a public issue for a suspected vulnerability. Use GitHub's private vulnerability
reporting flow from this repository's **Security** tab instead. Private vulnerability reporting was
enabled on 2026-07-24.

The existence of a reporting channel does not make this working draft public-alpha or
production-ready. Release readiness still requires the later security audit and release checklist.

## Supported versions

No version is production-supported during the proof phase. A support table will be published on
`desen.run` before the first public alpha.
