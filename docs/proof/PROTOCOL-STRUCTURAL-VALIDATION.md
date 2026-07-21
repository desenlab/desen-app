# DESEN 0.1.0 Structural-Validation Evidence

## Result

`M02-T06` passes. The platform-neutral validator now accepts untrusted programmatic input, creates
an independent immutable JSON snapshot, and validates it against the exact frozen DESEN 0.1.0
Source, Bundle, or Catalog root. After the root passes, the validator checks every protocol-defined
embedded schema as JSON Schema Draft 2020-12.

Last verified: 2026-07-21.

This proves runtime structural validation and structural diagnostic emission. It does not prove
semantic validity, publication correctness, runtime behavior, or activation safety.

## What “structural” proves

Structural validation is the document's shape check. It proves that required fields, value types,
closed core objects, constants, enumerations, patterns, property names, alternatives, and
cardinality rules match the complete frozen schema selected by the caller. The three roots contain
989 traced schema constraints across 61 constraint families; the implementation compiles the roots
directly rather than maintaining a handwritten partial copy.

The selected target is explicit:

| Target  | Frozen schema ID                                          | Public wrapper         |
| ------- | --------------------------------------------------------- | ---------------------- |
| Source  | `https://schemas.desen.dev/0.1/desen-source.schema.json`  | `validateDesenSource`  |
| Bundle  | `https://schemas.desen.dev/0.1/desen-bundle.schema.json`  | `validateDesenBundle`  |
| Catalog | `https://schemas.desen.dev/0.1/desen-catalog.schema.json` | `validateDesenCatalog` |

The generic `validateDesenStructure` API exposes the same behavior with an explicit `source`,
`bundle`, or `catalog` target. The frozen schema identities, titles, Draft 2020-12 dialect, and
SHA-256 input hashes are pinned by code generation; changing any of them fails before output is
written.

## Embedded-schema proof

DESEN documents can carry JSON Schemas as data. M02-T06 finds them at 13 generic locator patterns:

| Owner         | Locator patterns                                                                                     |
| ------------- | ---------------------------------------------------------------------------------------------------- |
| Source/Bundle | `/surfaces/*/state/*/schema`                                                                         |
| Components    | `propsSchema`, every event `payloadSchema`, command `inputSchema`, and style-part `propertiesSchema` |
| Behaviors     | `propsSchema`, every event `payloadSchema`, command `inputSchema`, and style-part `propertiesSchema` |
| Operations    | `inputSchema` and `outputSchema`                                                                     |
| Resources     | `inputSchema` and `outputSchema`                                                                     |

The exact frozen valid conformance triplet contains 44 embedded schemas: 2 reached through its
Source document, 2 through its Bundle document, and 40 through its Catalog document. Evidence walks
those real schemas and separately injects an invalid schema into every locator family so a missing
traversal branch cannot pass unnoticed.

Each embedded object is checked by the ahead-of-time Draft 2020-12 meta-schema validator. A safe
schema walk additionally rejects invalid Unicode-aware regular expressions, an explicitly foreign
`$schema`, malformed RFC 3986 `$id`/reference/vocabulary identifiers, and external `$ref` or
`$dynamicRef` values. An omitted `$schema` inherits Draft 2020-12 from DESEN 0.1.0; the exact Draft
2020-12 URI is accepted. Empty or fragment (`#...`) references remain local to the embedded
document. The validator never fetches a schema from the network or filesystem.

This check proves that the embedded schemas are structurally usable under the reference profile.
Applying them to state, props, style values, payloads, command inputs, operation data, or resource
data remains assigned to M02-T08 through M02-T11.

## Immutable input boundary

The public API accepts `unknown`; it does not cast an arbitrary caller object into a trusted DESEN
type. Before a generated validator reads the document, the implementation:

1. canonicalizes the value under the existing RFC 8785-compatible inert-JSON rules;
2. parses that canonical JSON text into a new plain JSON tree; and
3. recursively freezes the new tree.

Consequently, successful validation returns a snapshot that shares no mutable object or array with
the caller. Later caller mutations cannot change it, and validation never mutates the input.
Accessor properties, serialization hooks, sparse arrays, cycles, custom prototypes, non-finite
numbers, unsupported JavaScript values, and invalid Unicode fail as `SCHEMA_INVALID` at the root
without invoking caller-defined accessors.

The success and failure shapes make the trust decision explicit:

- success is `{ valid: true, target, value, diagnostics: [] }`, where `value` is recursively frozen;
- failure is `{ valid: false, target, diagnostics }` and exposes no trusted value.

## Stable diagnostic mapping

M02-T06 owns exactly three Appendix B codes:

| Condition                                                     | Code                   | Pointer behavior                        |
| ------------------------------------------------------------- | ---------------------- | --------------------------------------- |
| General root/input or embedded-schema violation               | `SCHEMA_INVALID`       | Exact failing keyword/property location |
| `additionalProperties` failure in a closed DESEN core object  | `UNKNOWN_CORE_FIELD`   | Includes the offending property name    |
| Present string `desen` value other than the supported `0.1.0` | `UNSUPPORTED_PROTOCOL` | Exactly `/desen`                        |

Required, additional, and property-name failures append Ajv's named property to the instance path.
Every appended segment uses RFC 6901 escaping, including `~` → `~0` and `/` → `~1`. Diagnostics are
then sorted and de-duplicated by stable protocol fields, so callers do not depend on Ajv's internal
error order. `code` plus `pointer` is the machine contract; message wording remains human-facing.

## Ahead-of-time validator evidence

Pinned Ajv 8.20.0 compiles the three exact frozen roots and the Draft 2020-12 meta-schema into one
tracked standalone ESM module. The build process:

- verifies the three exact schema files, identities, dialect, and input hashes;
- generates exactly four named validator exports;
- replaces Ajv's two CommonJS helper requests with two reviewed, platform-neutral local helpers and
  permits exactly one relative ESM import to that helper module;
- regenerates twice and requires byte-identical output;
- compares the tracked generated module with a fresh in-memory build; and
- rejects schema drift, tool drift, unexpected exports/imports, symlinks, path escape, or one-byte
  output drift.

The generated runtime is audited to contain no `eval`, `new Function`, CommonJS `require`, dynamic
import, or absolute workspace path. Document validation does not compile the embedded schemas and
does not perform network or filesystem access. The Ajv compiler and Node filesystem code run only
in the explicit development-time generator, not in the public validation path.

This proves that the M02-T06 validation path does not execute document content. It does not claim
that this task alone detects every executable-looking string or every future extension encoding;
the complete prohibited-executable-content claim remains a later cross-cutting conformance proof.

## Frozen-corpus and scope-fence evidence

All five frozen examples and the three valid conformance documents pass structural and embedded
schema validation. The invalid `source-unknown-core-field` vector fails with
`UNKNOWN_CORE_FIELD` at its exact pointer.

Five other frozen vectors are intentionally invalid for semantic reasons and therefore pass this
structural stage:

- duplicate node ID;
- unknown capability;
- unknown event;
- Bundle revision mismatch; and
- Catalog digest mismatch.

Keeping those vectors structurally valid is positive evidence for the task boundary: M02-T06 does
not silently absorb identity, catalog, reference, or integrity rules assigned to later stages.
M02-T07 now consumes the first two vectors as semantic-foundation failures while deliberately
leaving the other three to their later owners. Root-invalid inputs also stop before embedded
traversal, preventing secondary errors from an untrusted outer shape.

Tests additionally cover deterministic ordering and de-duplication, RFC 6901 escaping, unsupported
protocol mapping, input non-mutation, immutable snapshots, foreign dialects, local and external
references, malformed regular expressions, generated-output tampering, schema-byte mutations,
tool/export/import allowlists, safe output paths, command wiring, and loading the built package
without source-tree imports.

## Reproducible evidence

```bash
pnpm generate:protocol-structural-validation
pnpm verify:protocol-structural-validation
pnpm test:protocol-structural-validation
pnpm check
```

The generator is the only writer. The verifier regenerates both the standalone validators and the
proof data in memory and compares their bytes with tracked outputs. The focused test command covers
package behavior plus independent root-level evidence and mutation checks; `pnpm check` runs the
entire workspace quality gate. The current focused pass contains 63 package tests and 8 independent
root evidence/mutation tests.

The machine-readable evidence artifact is
`docs/proof/artifacts/protocol-0.1.0-structural-validation.json`. The generated-module and tracked
input digests are recorded inside it; the evidence artifact's own digest is returned by the
generator and verifier because a file cannot contain its own ordinary SHA-256 digest.

## Boundaries and limitations

- Duplicate JSON object names cannot be recovered after a permissive parser has discarded them;
  an eventual raw-text ingestion boundary must enforce I-JSON parsing behavior.
- Local embedded references are allowed structurally, but reference existence, cycle policy, and
  instance application belong to later tasks.
- Unknown JSON Schema annotation keywords are accepted and receive no invented DESEN semantics.
- The frozen version patterns are executed exactly even where they are broader than strict Semantic
  Versioning 2.0.0; the separate M02-T07 semantic foundation now enforces the stricter prose rule.
- Entry existence, map-key/ID equality, node/behavior identities, catalog namespaces, extension
  opacity, and category-aware capability existence are implemented only by the next semantic
  layer, not by this structural API.
- ValueSpec reference resolution, capability contracts, digest comparison, and runtime-value
  checks remain later tasks.
- No publication, runtime, activation, editor, or public npm readiness is claimed by this task.
- The implementation is platform-neutral. `web-react` is the first proof target, not a constraint
  on future iOS, Android, or other native consumers.
