# DESEN 0.1.0 Validator Diagnostic Micro-Vector Evidence

## Result

`M02-T13` passes when the tracked artifact and complete repository quality gate pass. The built,
platform-neutral validator executes one valid and one invalid project micro-vector for every
diagnostic it currently owns: 28 DESEN Appendix B core diagnostics and all 6 documented
`run.desen.validator/*` extensions.

This is the final internal validator baseline for G02. It adds no public validator API and does not
execute runtime adapters, publish a Source, resolve packages, activate a Bundle, render a surface,
or perform host effects.

## Exact diagnostic scope

The reviewed trace ledger assigns these 28 core entries to M02-T13:

- `D-001` through `D-025`;
- `D-027` and `D-028`; and
- `D-034`.

The micro-vector suite also covers the six validator extensions already documented by protocol
findings and exported from `@desen/validator`:

- `run.desen.validator/INVALID_SEMVER`;
- `run.desen.validator/CATALOG_REQUIREMENT_MISMATCH`;
- `run.desen.validator/INVALID_COMPONENT_CONTRACT`;
- `run.desen.validator/INVALID_INTERACTION_CONTRACT`;
- `run.desen.validator/INVALID_BINDING_CONTRACT`; and
- `run.desen.validator/INVALID_EXECUTION_CONTRACT`.

Namespaced extensions deliberately have no Appendix B `classification`. Core diagnostics retain
the exact registry classification even when they are detected by a different implementation
stage; for example, structural validation detects `UNSUPPORTED_PROTOCOL`, but its normative class
remains `activation`.

Eight core diagnostics remain outside the validator baseline:

| Later-owned code              | Remaining responsibility          |
| ----------------------------- | --------------------------------- |
| `OPERATION_DENIED`            | Runtime host policy               |
| `ACTION_LIMIT_EXCEEDED`       | Runtime action-turn execution     |
| `REVISION_MISMATCH`           | Integrity/activation verification |
| `SOURCE_DIGEST_MISMATCH`      | Publisher and activation          |
| `CATALOG_DIGEST_MISMATCH`     | Publisher and package activation  |
| `CATALOG_VERSION_UNAVAILABLE` | Package resolution and activation |
| `BUNDLE_LIMIT_EXCEEDED`       | Bundle ingress and activation     |
| `ADAPTER_FAILURE`             | Runtime adapter isolation         |

The exact scope statement is therefore: **28 of 36 core diagnostics plus all 6 current validator
extensions are proven; 8 core diagnostics remain with runtime, publisher, or activation owners.**

## Pair contract

Each of the 34 diagnostic identities has an intentionally small pair:

1. The positive member is valid and returns zero diagnostics.
2. The negative member applies one named boundary mutation and returns exactly one diagnostic.
3. Core code, Appendix B classification, RFC 6901 pointer, and every available identity-context
   field must equal the reviewed expectation.
4. Extension code, pointer, and available context must match while `classification` remains absent.
5. A second fresh execution must return the same normalized result.
6. The caller-owned fixture must be byte-equivalent before and after validation.
7. Every returned result and nested diagnostic/context/value graph must be frozen.

The root pointer `""` is retained as a real location and is never confused with an absent pointer.
Diagnostic message text remains explanatory and is not a compatibility key.

## Routes exercised

No test-only production entry point exists. The shared test harness receives and invokes these
built public APIs:

- `validateDesenExecutionCatalogSet`;
- `validateDesenSourceExecutionContracts`;
- `validateDesenEventPayload`; and
- `validateDesenExecutionValue`.

The pairs cover structural, semantic, catalog-set, component, interaction, binding, execution,
resolved-event-payload, and resolved-execution-value failures through their cumulative public
boundaries. The same platform-neutral harness runs against source APIs in Vitest and built
distribution APIs in the root evidence generator.

## Declared validator-scope composition

The artifact does not treat 34 pairs as the validator's only evidence. It independently verifies
the exact T08, T09, T10, T11, and T12 artifacts and then binds them to the M02-T13 trace
responsibilities:

- 61 reviewed schema families and all 989 enumerated constraints through the global schema route;
- 46 prose records;
- `SN-001`, `SN-002`, and `SN-005`;
- `C-003` and `C-024`;
- `A-005` and `A-011`; and
- the exact 28 core diagnostic records.

Each prose, schema-decision, conformance, and invariant responsibility links to concrete M02-T13
vector IDs. Responsibilities shared with future runtime, publisher, activation, capability, or
final-report tasks remain marked `shared-later`; the artifact does not erase those owners.

## Finite-bound contribution

M02-T13 composes the finite validator boundaries already proved through T08–T11:

- bounded contract-schema depth, graph, reference, pattern, and evaluation profiles;
- resolved event/execution JSON depth of 128;
- resolved event/execution JSON node count of 4,096;
- resolved event/execution string size of 1,048,576 UTF-16 code units;
- direct repeat-limit checks; and
- structurally bounded predicate argument arrays.

This is only partial evidence for `N-041` and P-17. The Reference Profile's 2 MiB Bundle ingress,
5,000 materialized nodes, Source/runtime depth 64, 1,000 runtime repeat instances, 64-action turn,
16-level settlement depth, and bounded profile configuration remain with M04, M07, and M12.
Accordingly `N-041` stays `PLANNED`, while P-17 may only become `PARTIAL`.

## Independent and mutation evidence

The root tests reject:

- a one-byte artifact modification;
- removal of T13 trace ownership;
- independent drift in each T08–T12 prerequisite artifact;
- a validator that rejects a positive or admits a negative case;
- changed or missing code, classification, pointer, or context;
- a fabricated classification on a namespaced extension;
- mutable output, caller-input mutation, or repeated-run drift; and
- a symbolic-link artifact destination.

Two full in-memory builds must be byte-identical. The artifact writer resolves a real parent,
creates a same-directory temporary file exclusively, syncs it, and commits with an atomic rename.

## Reproducible evidence

```bash
pnpm generate:protocol-validator-diagnostic-micro-vectors
pnpm verify:protocol-validator-diagnostic-micro-vectors
pnpm test:protocol-validator-diagnostic-micro-vectors
pnpm check
```

- Artifact: `docs/proof/artifacts/protocol-0.1.0-validator-diagnostic-micro-vectors.json`
- Focused package tests: 4
- Independent root evidence and mutation tests: 9
- Positive vectors: 34
- Negative vectors: 34

The artifact hash is recorded in `PROJECT-STATUS.md` and `docs/proof/PROOF-MATRIX.md` only after the
artifact, clean checkout, full quality gate, and remote CI all pass. The evidence contract itself
contains no self-hash.

## Boundaries and limitations

- No frozen DESEN 0.1.0 byte is changed.
- No public validator API, runtime behavior, publisher behavior, or activation behavior is added.
- The official 14-case suite remains the separate M02-T12 parity oracle.
- P-02 can become `PROVEN` only from the combined M02-T12 and M02-T13 evidence.
- G02 can close after this artifact and the complete local/remote quality gates pass.
- The final public Validator conformance target remains `PLANNED` until M12-T01.
