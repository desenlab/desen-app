# DESEN 0.1.0 Diagnostic and JSON Pointer Evidence

## Result

`M02-T05` passes. The platform-neutral protocol package now exposes the exact 36-code DESEN 0.1.0
Appendix B registry, frozen JSON-serializable core diagnostic data, and RFC 6901 JSON Pointer
construction, parsing, append, escaping, and syntax guards.

Last verified: 2026-07-21.

This result establishes shared identities and location primitives for later validators, publishers,
runtimes, activation code, and editor tools. It does not claim that any of those systems emits the
diagnostics yet.

## Stable diagnostic contract

The implementation independently parses frozen `SPEC.md` Appendix B and compares every runtime
registry row in normative order:

| Appendix classification | Code count |
| ----------------------- | ---------: |
| `schema`                |          2 |
| `semantic`              |          3 |
| `catalog`               |         10 |
| `catalog/runtime`       |          1 |
| `runtime`               |         14 |
| `integrity`             |          2 |
| `activation`            |          4 |
| **Total**               |     **36** |

The verifier also checks reviewed trace ownership for `D-001` through `D-036` and prose traces
`R-101`, `R-110`, and `R-145`. Missing, extra, duplicate, reordered, reclassified, or reworded
registry entries fail evidence generation.

Core diagnostics are immutable plain data. They carry:

- a stable core `code`;
- its exact registry `classification`;
- safe human-readable `message` text that is not a compatibility key;
- an RFC 6901 `pointer` when a reliable location is available; and
- available document, surface, node-or-behavior, and capability identity context.

An absent pointer means the location is unavailable. The explicit empty pointer `""` means the
known location is the document root. The factory preserves that distinction and derives the core
classification from the code so callers cannot create a conflicting pair.

## RFC 6901 coverage

The fixed and cross-product tests cover:

- all 12 JSON-string examples in RFC 6901 Section 5 as one exact golden table;
- root `""`, empty-key `"/"`, repeated empty tokens, ordinary object paths, and numeric builder
  segments;
- `~` → `~0` and `/` → `~1`, including the required `~01` → `~1` decode order;
- append behavior from root and already-escaped paths;
- exact preservation of composed/decomposed Unicode, emoji, percent signs, NUL, quotes, and
  backslashes;
- frozen parsed-token arrays and numeric-looking tokens that remain strings; and
- rejection of relative paths, URI-fragment form, malformed `~` escapes, lone surrogates, and
  invalid numeric builder segments.

Pointer resolution against a target document is deliberately not implemented. Consequently,
syntax-only tokens such as `/01` and `/-` remain valid until a future resolver interprets them in
an array context.

## Independent and mutation evidence

The runtime registry is not its own only oracle. The evidence builder compares it with both the
frozen SPEC table and the reviewed trace ledger. Tests then inject:

- a missing registry row;
- a duplicate code;
- a changed classification;
- moved diagnostic-registry and prose-rule trace owners;
- sparse arrays, accessor properties, and a replaced caller-owned array `map`; and
- a one-byte artifact modification.

Every mutation is rejected with a stable evidence failure. Two independent in-memory evidence
builds are byte-identical. Package-level tests additionally verify type guards, dangerous object
prototype names, full context serialization, immutable snapshots of caller data, default core-code
typing, and a lossless implementation-defined namespaced-code example. Accessor inputs are rejected
without invocation, so stateful caller code cannot swap a value after it has been checked.

## Reproducible evidence

```bash
pnpm generate:protocol-diagnostics
pnpm verify:protocol-diagnostics
pnpm test:protocol-diagnostics
pnpm check
```

The generator verifies the frozen 31-file snapshot before writing one tracked artifact. The
read-only verifier rebuilds it in memory, parses Appendix B, checks trace ownership, reruns pointer
goldens, verifies all named runtime and type exports, command/test wiring, the absence of runtime
dependencies, and tracked implementation hashes, and rejects any byte drift.

- Artifact: `docs/proof/artifacts/protocol-0.1.0-diagnostics.json`
- Artifact SHA-256: `c79324b88043b3dcb17248d345f0e65f836b37ca7e0b0268085b1c9b4299fdcd`
- Package tests: 17
- Root evidence and mutation tests: 8

## Boundaries and limitations

- Source, Bundle, Catalog, and embedded-schema validation is implemented by `M02-T06`.
- M02-T07 now emits the five foundation-owned identity/catalog codes and two documented namespaced
  codes. Capability-contract, runtime-reference, and complete diagnostic micro-vectors remain
  assigned to `M02-T08` through `M02-T13`.
- Runtime, publisher, activation, and editor diagnostic emission remains assigned to their later
  owner tasks.
- DESEN 0.1.0 does not define a namespaced diagnostic-code grammar. The generic model preserves a
  caller-documented namespaced string literal without claiming one separator as normative; this is
  recorded in `PF-006`.
- Appendix classification is registry metadata, not the conformance runner's emission-stage outcome
  category; `PF-006` records that distinction.
- URI-fragment JSON Pointers and document resolution are outside this task.
- No Proof Matrix claim changes status from this infrastructure task alone.
