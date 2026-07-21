# Contributing to DESEN

DESEN is currently a Working Draft. Contributions should make the protocol smaller, more testable, more interoperable, or better supported by implementation evidence.

## Contribution principles

1. **Implementation before abstraction.** New core features should include a concrete editor/runtime use case.
2. **No arbitrary code in documents.** Proposals that require eval, scripts, private selectors, or dynamic imports belong outside the core.
3. **Preserve the ownership boundary.** Designers compose public contracts; developers own implementations.
4. **Prefer capability evolution over core primitives.** A library-specific need usually belongs in a component or behavior capability.
5. **Every normative change needs tests.** Add or update conformance vectors.
6. **Keep 0.1 narrow.** Telemetry, governance, voice/XR, and collaboration are intentionally deferred.

## Types of contribution

- specification issue or clarification;
- JSON Schema correction;
- valid or invalid conformance vector;
- editor or runtime implementation report;
- security analysis;
- capability package example;
- digest/canonicalization interoperability test;
- reference implementation patch; or
- migration proposal.

## Proposal format

A protocol proposal should state:

- problem and user impact;
- why a capability contract or profile cannot solve it;
- proposed normative change;
- backward-compatibility impact;
- security and performance impact;
- editor behavior;
- production runtime behavior;
- positive and negative examples; and
- conformance tests.

## Change process

Normative changes move through:

```text
Draft → Review → Implementation evidence → Accepted | Rejected | Deferred
```

Before 1.0, accepted breaking changes may enter a new 0.x minor version with migration notes. After 1.0, Semantic Versioning rules apply strictly.

## Validation

Run:

```bash
python tools/validate.py --suite
```

A change should not be merged while schemas, examples, digests, or expected conformance results fail.

## Editorial style

- Use clear technical English in normative text.
- Use BCP 14 requirement words only when testable.
- Mark examples and rationale as informative.
- Avoid product-marketing claims in normative sections.
- Define a term once and reuse it consistently.
- Link each schema field to prose semantics.

## License

By contributing, you agree that your contribution is licensed under Apache License 2.0.
