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

Do not open a public issue for a suspected vulnerability. A private reporting channel is not yet
operational, so this repository must not be presented as public-alpha ready. Before any public
release, the owner must either enable GitHub private vulnerability reporting or publish and test a
monitored security address. The chosen channel must be recorded in the release checklist.

## Supported versions

No version is production-supported during the proof phase. A support table will be published on
`desen.run` before the first public alpha.
