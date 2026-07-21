# DESEN 0.1.0 Canonicalization and SHA-256 Evidence

## Result

`M02-T04` passes. The platform-neutral protocol package now produces RFC 8785 canonical JSON text
and UTF-8 bytes, calculates SHA-256 without Node or browser APIs, formats exact DESEN digests, and
implements the two DESEN 0.1.0 document projections defined by SPEC Section 11.

Last verified: 2026-07-21.

This result proves the canonicalization, hashing, and projection primitives. It does not prove that
an input is a valid DESEN document, emit stable diagnostics, implement publisher determinism, or
verify a digest during activation.

## Implemented behavior

| Surface                    | Verified invariant                                                                      |
| -------------------------- | --------------------------------------------------------------------------------------- |
| Canonical JSON text        | No whitespace; recursive raw UTF-16 key order; arrays retain their order                |
| Primitive serialization    | ECMAScript finite-number and string serialization; Unicode spelling is preserved        |
| Canonical bytes            | Exact canonical text encoded as UTF-8                                                   |
| SHA-256                    | Pure ECMAScript one-shot implementation returning 32 bytes or lowercase hex             |
| DESEN digest format        | Exactly `sha256:` followed by 64 lowercase hexadecimal characters                       |
| Source digest              | Only top-level `authoring` is omitted; `extensions` remains included                    |
| Bundle revision            | Only top-level `revision` and `publication` are omitted                                 |
| Invalid programmatic input | Non-JSON values, invalid Unicode, sparse arrays, hooks, custom objects, and cycles fail |

Every public export has TSDoc describing its purpose, invariants, failure behavior, and one-shot
lifecycle. The implementation imports no platform API and has no runtime dependency.

## Independent golden coverage

The tests do not rely on the production implementation as their only oracle:

- The [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785.html) canonical example is checked as exact
  text, exact UTF-8 bytes, and SHA-256
  `2d5e01a318d0f0879ab568c4be289c8b1f64ef8921a53c6277d5e069978baacb`.
- All 24 finite number samples from RFC 8785 Appendix B are checked from their IEEE 754 bit
  patterns. `NaN`, positive/negative infinity, and lone surrogates are rejected.
- The RFC UTF-16 property-order vector and prefix-order vector are checked as exact canonical text.
- SHA-256 is checked against the NIST empty, `abc`, and multi-block goldens, five padding
  boundaries, non-zero-offset views, and an independent Node crypto comparison across 262
  deterministic byte sequences. The algorithm is defined by
  [FIPS 180-4](https://doi.org/10.6028/NIST.FIPS.180-4).
- Cross-realm objects and byte arrays work, while spoofed typed arrays and caller-defined byte-view
  hooks cannot change the hashed range or execute during brand detection.

## Frozen DESEN goldens

| Frozen input                               | Projection bytes | Verified result                                                           |
| ------------------------------------------ | ---------------: | ------------------------------------------------------------------------- |
| `examples/sign-in.source.desen.json`       |             1903 | `sha256:40c294047299b521a46b51d8a72bfbeeaad8a69a9b9045a306139830b7674878` |
| `examples/sign-in.bundle.desen.json`       |             2088 | `sha256:43eef0f11f9bcc4c13fc1eb5691ee974859001fbb4aeee8051948e7c8e195601` |
| `examples/sortable-list.source.desen.json` |             1016 | `sha256:52f96e80d8e8b40f379bf4c872cb5abf78383cff0f08f861c1f96ba69472a2be` |
| `examples/store-map.source.desen.json`     |             1515 | `sha256:6ef45d43c603bd1e3fa0ccd4d538869be65a6782d5f51a87e0028a2cc1109990` |

The sign-in Source digest equals the `sourceDigest` stored in the frozen Bundle. The calculated
Bundle revision equals its stored revision. The frozen
`conformance/invalid/bundle-revision-mismatch.json` vector stores an all-`f` revision while its
calculated revision remains the valid sign-in revision, proving the tamper comparison needed by
trace entry `D-030` without defining the future diagnostic model early.

Mutation tests additionally prove:

- changing top-level Source `authoring` does not change `sourceDigest`;
- changing Source `extensions` or a nested member named `authoring` does;
- changing top-level Bundle `revision` or `publication` does not change the calculated revision;
- changing Bundle `sourceDigest`, `extensions`, or nested same-named members does; and
- none of the helpers mutates its input.

## Reproducible evidence

```bash
pnpm generate:protocol-canonicalization
pnpm verify:protocol-canonicalization
pnpm test:protocol-canonicalization
pnpm check
```

The generator verifies the frozen 31-file snapshot before writing one tracked artifact. The
read-only verifier rebuilds the artifact in memory, reruns every fixed golden, compares the
production SHA-256 with independent oracles, checks tracked implementation/test hashes, and rejects
one-byte evidence drift.

- Artifact: `docs/proof/artifacts/protocol-0.1.0-canonicalization.json`
- Artifact SHA-256: `7c96deb2206cec49b312f1a4f385d0c1720aa06924a4268f7b56c3391f79d2aa`
- Package tests: 12
- Root evidence and differential tests: 8

## Boundaries and limitations

- A value-based API cannot recover duplicate object names already discarded by a parser. Parsing
  must enforce I-JSON before canonicalization.
- The Source and Bundle helpers perform only their Section 11 projections; runtime validation is
  still required.
- A raw Catalog JSON hash is not `packageDigest`. The deterministic capability-package archive
  profile remains assigned to `M03-T04`.
- Stable diagnostic objects and JSON Pointers remain assigned to `M02-T05`.
- Official TypeScript suite parity remains assigned to `M02-T12`; publisher determinism remains
  assigned to `M06-T10`; activation verification remains assigned to `M07-T02`.
- No Proof Matrix claim changes status in this task.
