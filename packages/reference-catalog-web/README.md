# @desen/reference-catalog-web

## Responsibility

Target-specific Web–React capability packaging, followed by the accessible real components and
exact capability manifests shared by Desen App and the reference host.

## Web–React package digest profile

M03-T04 defines the versioned `desen.web-react.package-digest` profile here rather than in the
framework-neutral Catalog SDK. The public API:

- exposes the fixed profile metadata and Catalog digest placeholder;
- encodes one deterministic binary preimage from a projected canonical `catalog.json` entry and
  exact target-artifact bytes;
- calculates the DESEN-formatted SHA-256 package digest; and
- verifies a published Catalog by rebuilding the same preimage and comparing its declared digest.

`encodeWebReactPackageDigestPreimage` and `createWebReactPackageDigest` accept
`WebReactPackageDigestCalculationInput`, whose Catalog carries the placeholder.
`verifyWebReactPackageDigest` accepts the separate
`WebReactPackageDigestVerificationInput`, whose Catalog carries the published digest. This keeps
the two operations named explicitly in the public type surface. Because both inputs contain the
protocol-wide `DesenCatalog` type, the placeholder-versus-published distinction is enforced at
runtime rather than claimed as a compile-time refinement.

The preimage starts with a versioned Web–React domain-separation header. It then frames the
canonically ordered entries with explicit big-endian path and content lengths. Artifact paths use
a restricted lowercase-ASCII relative-path grammar and reject Windows device names, while artifact
contents receive no text, newline, minification, source-map, compression, or archive normalization.
Caller array order and Catalog object insertion order do not affect the result; every accepted
path, every Catalog value other than the projected self-digest field, and every artifact byte
does.

A Catalog contains the digest of the package that also contains that Catalog, so hashing its
literal published bytes would be circular. Under the documented `PF-026` decision, calculation
requires a fixed zero-digest placeholder. Verification replaces only a published Catalog's
top-level `packageDigest` with that placeholder before rebuilding the preimage, then requires the
declared value to equal the result. This is a DESEN reference-project profile for the exact
`web-react` target, not a universal DESEN 0.1.0 archive rule.

The implementation copies caller byte views, rejects shared mutable backing memory, returns fresh
preimage bytes, and exposes only detached, recursively frozen audit metadata. Its deterministic
limits are 1,024 target artifacts, 128 Catalog value levels below the root, 100,000 Catalog value
occurrences, 240 path bytes, 16 MiB per entry, and 64 MiB for the complete framed preimage. An
iterative descriptor-based Catalog snapshot enforces depth, node, and canonical-byte budgets
before canonicalization; repeated aliases are counted at every serialized occurrence.

The focused evidence comprises 18 package tests, 5 compiler-negative API cases, 16 independent
root proof/mutation tests, and 269 fixed mutation vectors. It compares the complete preimage with
an independent Node.js framing and SHA-256 oracle.

## Explicit non-responsibilities

- Runtime-core changes, application screens, or protocol extensions
- Tar, zip, npm archive, signature, authenticity, or remote-code-loading formats
- Catalog/adapter parity or proof that a supplied artifact inventory is complete
- Distributor immutability, exact-package retention, publication, resolution, or activation
- Native package profiles

## Status

Private proof-phase package. The deterministic Web–React package digest profile is implemented.
Real reference components, adapters, controlled fixtures, parity checks, and the final package
tuple remain assigned to M03-T05 through M03-T10.

## Protocol and target support

- Protocol baseline: DESEN 0.1.0
- Implemented digest-profile target: `web-react`
- Future native targets: separate, explicitly versioned profiles

## Quality

```bash
pnpm --filter @desen/reference-catalog-web typecheck
pnpm --filter @desen/reference-catalog-web test:package-digest-profile
pnpm verify:web-react-package-digest
pnpm test:web-react-package-digest
pnpm check
```
