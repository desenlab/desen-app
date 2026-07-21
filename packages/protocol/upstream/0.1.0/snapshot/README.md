# DESEN: Executable Design Protocol

**Design is the source. The application executes the published design.**

DESEN is an open, data-only protocol for authoring production interfaces with real application capabilities instead of handing static design representations to developers for reimplementation.

A DESEN-compatible editor composes components, behaviors, resources, and operations declared by immutable Capability Packages. A publisher validates the editable Design Source Document and emits a Published Design Bundle. The host application loads that bundle at runtime and realizes it through its own trusted, version-pinned capability implementations.

## Why this exists

Conventional handoff creates two editable truths: the design and the frontend implementation. DESEN establishes one authority for managed surfaces:

```text
Capability Packages → DESEN Editor → Design Source → Published Bundle → App Runtime
```

The designer owns the surface composition and experience behavior. The developer owns component internals, third-party integrations, resources, operations, security, and performance.

## 0.1.0 scope

The Working Draft covers:

- component-backed visual authoring;
- props, slots, style parts, and visual states;
- local state and conditional variants;
- resource bindings and named operations;
- event-to-action orchestration;
- complex component contracts such as maps;
- behavior contracts such as sortable drag-and-drop;
- publish-time validation and immutable runtime bundles;
- exact capability package pinning; and
- atomic runtime activation with last-known-good fallback.

It intentionally excludes telemetry, experimentation, deployment governance, voice/XR, arbitrary executable expressions, backend generation, and mandatory source-code export.

## Repository map

```text
SPEC.md                         Normative Working Draft
schemas/                        JSON Schema Draft 2020-12 schemas
examples/                       Sign-in, map, and sortable-list examples
conformance/                    Valid/invalid vectors and expectations
tools/validate.py               Reference structural/semantic validator
tools/jcs.mjs                   RFC 8785-style canonicalizer used by tests
ROADMAP.md                      Implementation-first roadmap
CONTRIBUTING.md                 Contribution process
README.tr.md                    Turkish overview
```

## Validate the package

Requirements: Python 3.11+, `jsonschema`, and Node.js 18+.

```bash
python tools/validate.py --suite
```

The reference validator is deliberately small. It validates the included schemas, the example documents, digest rules, and starter semantic vectors. It is not yet a complete production runtime.

## Start here

1. Read the plain-language summary and scope in [`SPEC.md`](SPEC.md).
2. Inspect [`examples/sign-in.source.desen.json`](examples/sign-in.source.desen.json).
3. Inspect the corresponding [`examples/sign-in.bundle.desen.json`](examples/sign-in.bundle.desen.json).
4. Review the map and sortable capability examples.
5. Run the conformance suite.
6. Build one editor/runtime vertical slice before expanding the protocol.

## Status

DESEN 0.1.0 is a **Working Draft**, not a stable standard. The schemas and terminology are expected to evolve through implementation feedback.

## License

Apache License 2.0. See [`LICENSE`](LICENSE).
