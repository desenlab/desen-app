# Web–React Package Digest Evidence

## Claim

M03-T04 defines a deterministic, target-separated byte profile for DESEN 0.1.0 Web–React
capability packages.

The proof checks:

- a versioned domain-separation header and unambiguous length framing;
- RFC 8785-compatible projected Catalog bytes;
- exact lowercase-ASCII path validation and canonical ordering;
- exact artifact byte preservation, including subviews, CRLF, and UTF-8 spelling;
- SHA-256 agreement with an independent Node.js cryptographic oracle;
- repeatability and single-byte/path/Catalog mutation sensitivity;
- published Catalog self-digest verification;
- caller ownership, detached bytes, and recursively frozen audit output;
- hostile wrapper, descriptor, array, path, byte-view, shared-memory, and limit inputs;
- the exact public runtime/type surface and Web-package boundary; and
- direct ownership of `C-021`, `R-018`, `R-021`, `R-030`, and `R-136`.

The evidence imports the built API through the real bare
`@desen/reference-catalog-web` package specifier. It hashes 17 tracked source/proof inputs,
separately audits 4 emitted JavaScript/declaration files, and requires the root generate, verify,
and test commands to run the package build, its real TypeScript typecheck, and all 18 focused
package tests before accepting evidence.

## Profile

The normative project profile is
[`docs/profiles/WEB-REACT-PACKAGE-DIGEST-V1.md`](../profiles/WEB-REACT-PACKAGE-DIGEST-V1.md).

The encoder does not create or parse tar, zip, or npm archives. It fingerprints one logical
Web–React package file set through an exact binary preimage. The reserved projected
`catalog.json` entry contains every Catalog field, with only its circular top-level
`packageDigest` replaced by the fixed zero placeholder.

## Evidence commands

```text
pnpm generate:web-react-package-digest
pnpm verify:web-react-package-digest
pnpm test:web-react-package-digest
```

Tracked artifact:

```text
docs/proof/artifacts/reference-catalog-web-package-digest-v1.json
```

The verifier reports the final artifact SHA-256. `PROJECT-STATUS.md` records that value without
introducing a hash self-reference into this tracked proof input.

## Boundaries

This evidence makes P-05 `PARTIAL`, not `PROVEN`. It completes the deterministic profile owned by
M03-T04 and tests `N-015`, but does not build the final reference capability package, prove
manifest/adapter parity, operate a distributor, retain exact packages, publish a Bundle, or
activate one. Those responsibilities remain with M03-T09/M03-T10, M06, and M07.

React production and authoring adapters are still absent at M03-T04. The byte API lives in the
target-specific `@desen/reference-catalog-web` package so `@desen/catalog-sdk` remains portable and
future native targets can define separately identified profiles.
