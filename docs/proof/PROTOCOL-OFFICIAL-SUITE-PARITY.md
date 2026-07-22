# DESEN 0.1.0 Official Suite Parity Evidence Contract

## Status and claim boundary

This document defines the deterministic evidence produced by M02-T12. The tracked artifact is
`docs/proof/artifacts/protocol-0.1.0-official-suite-parity.json`. Task completion and the final
artifact hash are recorded separately in `PROJECT-STATUS.md` and `docs/proof/PROOF-MATRIX.md`.

The archived normalized Python reference transcript and the built TypeScript proof runner both
record a passing result for the same exact frozen corpus:

| Evidence source                                 | Vectors | Examples | Result |
| ----------------------------------------------- | ------: | -------: | -----: |
| Archived normalized Python reference transcript |       9 |        5 |  14/14 |
| Built TypeScript M02-T12 runner                 |       9 |        5 |  14/14 |

The archived baseline contains pinned metadata followed by a normalized transcript. Parity compares
only its 14 PASS lines, blank separator, and final summary with the normalized TypeScript
transcript; it does not treat the baseline file as raw `tools/validate.py` standard output. The
Python runner is not re-executed by `pnpm check`; the validation and checksum baselines remain a
hermetic oracle.

This is parity with the frozen DESEN 0.1.0 **starter suite**, not full protocol certification. It
proves that the TypeScript implementation produces every outcome required by the official
manifest and accepts all five public examples. It does not prove every branch of every
validator-owned diagnostic; M02-T13 owns those project micro-vectors.

M02-T12 adds no public validator API. Its runner is proof-only composition over the built protocol
and validator packages. The production validator boundaries and their public responsibilities
remain those documented through M02-T11.

## Exact frozen inputs

The TypeScript suite reads only these checksum-enforced inputs beneath
`packages/protocol/upstream/0.1.0/snapshot`:

- `conformance/vectors.json`;
- the nine referenced files beneath `conformance/valid` and `conformance/invalid`;
- the manifest-selected `conformance/valid/web.catalog.json`;
- all five JSON files in `examples` selected by the frozen starter runner.

Parity verification separately reads the pinned normalized validation transcript at
`docs/proof/baselines/protocol-0.1.0-validation.txt` and its checksum transcript at
`docs/proof/baselines/protocol-0.1.0-checksums.txt`. The checksum evidence covers the frozen
`tools/validate.py` bytes, but the TypeScript proof does not execute that Python tool.

The proof does not rewrite or normalize those frozen files. It verifies their recorded hashes
before interpreting a result.

## Official manifest contract

The nine vectors run in manifest order. A Catalog vector receives no external catalog. Every
Source or Bundle vector receives the manifest's exact default Catalog.

|   # | Frozen vector                                 | Target    | Manifest expectation                       |
| --: | --------------------------------------------- | --------- | ------------------------------------------ |
|   1 | `valid/sign-in.source.json`                   | `source`  | `valid`                                    |
|   2 | `valid/sign-in.bundle.json`                   | `bundle`  | `valid`                                    |
|   3 | `valid/web.catalog.json`                      | `catalog` | `valid`                                    |
|   4 | `invalid/source-unknown-core-field.json`      | `source`  | `schema_error/UNKNOWN_CORE_FIELD`          |
|   5 | `invalid/source-duplicate-node-id.json`       | `source`  | `semantic_error/DUPLICATE_NODE_ID`         |
|   6 | `invalid/source-unknown-capability.json`      | `source`  | `catalog_error/UNKNOWN_CAPABILITY`         |
|   7 | `invalid/source-unknown-event.json`           | `source`  | `catalog_error/UNKNOWN_EVENT`              |
|   8 | `invalid/bundle-revision-mismatch.json`       | `bundle`  | `integrity_error/REVISION_MISMATCH`        |
|   9 | `invalid/bundle-catalog-digest-mismatch.json` | `bundle`  | `activation_error/CATALOG_DIGEST_MISMATCH` |

The manifest's compatibility rule is exact:

- a `valid` case passes only with zero diagnostics; and
- an invalid case passes when at least one diagnostic has both the declared category and code.

The manifest does not declare an expected pointer, message, diagnostic count, or diagnostic order.
For review, the revised artifact retains only each observed TypeScript diagnostic's code, registry
classification, mapped suite category, and pointer. It does not retain diagnostic messages or
assert pointer, multiplicity, or order parity. The parity keys remain the manifest's category and
code. In particular, the unknown-capability case would still pass if an additional
`SLOT_CHILD_REJECTED` were present because the required `UNKNOWN_CAPABILITY` remains present.

## Public examples

Examples use the exact `examples/catalog.web.example.json` Catalog chosen by the frozen runner.

| Frozen example                    | Target    | Catalog routing            | Expected result  |
| --------------------------------- | --------- | -------------------------- | ---------------- |
| `catalog.web.example.json`        | `catalog` | none                       | zero diagnostics |
| `sign-in.source.desen.json`       | `source`  | `catalog.web.example.json` | zero diagnostics |
| `sign-in.bundle.desen.json`       | `bundle`  | `catalog.web.example.json` | zero diagnostics |
| `store-map.source.desen.json`     | `source`  | `catalog.web.example.json` | zero diagnostics |
| `sortable-list.source.desen.json` | `source`  | `catalog.web.example.json` | zero diagnostics |

The example Catalog, sign-in Source, and sign-in Bundle are byte-for-byte equal to the three valid
conformance files. They remain separate suite cases because the official runner deliberately
checks both public distribution paths.

## TypeScript composition

The TypeScript proof runner composes already-built, platform-neutral implementation boundaries:

1. T11 supplies the cumulative T06 through T11 Catalog, Source, and Bundle validation result.
2. T04 supplies the exact frozen Bundle revision projection and SHA-256 primitive.
3. The proof layer compares a Bundle's exact required Catalog digest with the supplied frozen
   Catalog package digest.
4. The proof layer maps the resulting diagnostics to the starter runner's five category labels and
   evaluates only the manifest contract described above.

The two proof-layer checks are intentionally narrow. They make the official revision- and
catalog-digest-negative vectors observable without adding an integrity or activation method to the
public validator API. Publisher determinism remains M06 work; installed-package resolution and
activation verification remain M07 work.

The runner consumes built package distributions rather than importing TypeScript source directly.
This demonstrates that the tracked distributable implementation, not a test-only source path,
produces the 14 official outcomes.

## Prerequisite evidence

M02-T12 has two direct proof prerequisites:

| Prerequisite | Role in this proof                                                        |
| ------------ | ------------------------------------------------------------------------- |
| M02-T04      | Canonical Bundle revision projection and platform-neutral SHA-256         |
| M02-T11      | Complete cumulative static validator boundary through execution contracts |

The parity artifact records and verifies both prerequisite artifact hashes. Metadata that merely
resembles those prerequisites is insufficient: verification runs their existing verifiers and
compares the tracked bytes.

The complete dependency chain remains:

```text
M02-T12 → {M02-T04, M02-T11}
M02-T11 → M02-T10 → M02-T09 → M02-T08 → {M02-T05, M02-T07 → M02-T06}
```

## Traceability contribution

M02-T12 is a test/evidence owner, not a new normative semantic owner. The trace ledger assigns its
official-suite evidence to `SN-003`, `C-016`, `C-024`, `R-001`, `R-032`, `R-035`, `R-082`,
`R-142`, and `SR-001` through `SR-003`. No BCP 14 clause assigns M02-T12 sole implementation
ownership.

This M02-T12 artifact alone leaves P-02 `PARTIAL`: the official TypeScript suite report is present,
while the separate M02-T13 evidence owns positive and negative project micro-vectors for every
validator-owned diagnostic. M02-T13 now supplies that evidence, so the combined result closes P-02
and G02; neither status is claimed from the T12 artifact by itself.

## Explicit non-claims

M02-T12 does not claim:

- exhaustive diagnostic branch, pointer, message, order, or cardinality coverage;
- full DESEN protocol conformance or an external certification program;
- publisher output, publication determinism, or Bundle production;
- installed package acquisition, trust, digest verification, or atomic activation;
- runtime action, adapter, operation, resource, state, navigation, or rendering behavior;
- finite runtime transition limits; or
- any iOS, Android, React, DOM, browser, filesystem, or network implementation.

Those boundaries remain with the separate M02-T13 evidence and the later publisher, activation,
runtime, adapter, and release tasks named in the trace ledger.

## Deterministic artifact and commands

The artifact contains no timestamp or machine-specific path. It records the exact frozen inputs,
normalized reference baseline, built-package inputs, prerequisite evidence, case routing, expected
outcomes, the reviewed TypeScript diagnostic fields listed above, and the final 14/14 summary.
Verification rebuilds the report in memory and rejects frozen-byte drift, prerequisite drift,
case-set or order drift, incorrect catalog routing, weakened outcome matching,
built-public-API drift, and non-deterministic bytes.

Run:

```sh
pnpm generate:protocol-official-suite-parity
pnpm verify:protocol-official-suite-parity
pnpm test:protocol-official-suite-parity
pnpm check
```

Two independent builds must be byte-identical. Generation is the only command that writes the
tracked artifact; verification and tests fail closed without changing it. The final evidence passes
4 focused package tests and 11 independent root proof and mutation tests.
