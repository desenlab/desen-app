# M05-T09 — Reference-host source and resolved-import audit

## Decision

M05-T09 is `PASS` for the bounded Web–React source claim: the complete production source of the
separately built reference host contains no handwritten replacement for its DESEN-managed screen,
and the real Vite production graph reaches the generic runtime renderer and shared reference
adapter factory through their public package exports.

Together with the executable M05-T01–M05-T08 evidence, this closes G05. P-07 advances from
`NOT_PROVEN` to `PARTIAL`; M10-T05 still owns the Desen App host E2E slice before that broader
claim can become `PROVEN`. P-06 and P-10 remain `PARTIAL` while gaining the final
independent-host source/import evidence; Desen App registry identity remains M09-T03 and Run Mode
operation execution remains M10-T04. P-17 remains `PARTIAL`, N-036 remains `PLANNED`, and this
task changes no normative status.

## Complete production graph

The audit discovers every regular production file below `apps/reference-host-web/src` rather than
trusting a fixed complete source inventory. Every discovered TypeScript, TSX, and CSS source plus
each separately admitted JSON data module must be reachable from the production entry through
Vite's actual resolved graph. Orphaned source, symbolic links, unresolved imports, unexpected
assets, forbidden transitive workspace packages, and graph substitutions fail closed. Every
observed local graph module is also reauthenticated by byte and filesystem identity across the
audit. The few approved composition sites are then governed by a separate exact semantic
allowlist.

TypeScript's parser and checker resolve JSX tags, imports, aliases, namespace access, and symbol
origins. The complete-source JSX policy and exact composition fingerprints separately reject
helper-hidden trees. A second closed semantic fingerprint pins the current executable-call and
property-write authority surface, so a newly extracted local callable or mutation cannot bypass
the policy merely by avoiding a forbidden spelling. The exact allowed JSX is host infrastructure:

- the root connects React `StrictMode` to `ReferenceHostApplication`;
- the application renders its fixed host notice and exactly one `ManagedSurface`;
- the managed-surface layer selects only the controlled failure view or
  `RuntimeReactSurfaceBoundary`; and
- the failure view renders only its fixed host-owned recovery interface.

Every other production module has zero JSX. The managed branch reaches components only through the
public `@desen/runtime-react` render path and the public
`@desen/reference-catalog-web/react-adapters` registry factory. No reference component is directly
imported, instantiated, or selected by host source.

## Executable-selection boundary

The semantic audit rejects direct, aliased, namespace, and helper-hidden component trees;
`createElement` and JSX-runtime bypasses; forged React-element objects; structural render plans;
capability or source-node literals used as component selection; direct Bundle-surface rendering;
and equivalent handwritten managed composition.

Production source also cannot use `import()`, `require`, `eval`, `Function`,
`import.meta.glob`, script injection, workers, WebAssembly, or another document-to-code loading
path. The only admitted non-code graph inputs are the controlled official-derived Bundle, the
exact current Catalog, and the host stylesheet. The authoring Source, synthetic fixtures, test
assets, Desen App, editor, publisher, testkit, and the broad `desen` facade remain outside the
production graph.

The Vite build envelope admits one canonical `index.html` node-and-attribute tree. It rejects
public directories, environment files, local Vite/Rollup configuration, every PostCSS
auto-discovery filename at the application, `apps`, and workspace levels, and `postcss` fields in
the corresponding package manifests. This prevents build-time HTML or CSS injection from
substituting visible managed content before the runtime graph is inspected. The committed host
stylesheet is separately pinned to its canonical bytes, with image, generated-content, mask,
filter, transform, clipping, and equivalent visual-substitution sinks rejected in depth.

## Evidence method

Three independent views cover different failure modes:

1. a TypeScript AST/checker pass proves semantic symbol origin, source structure, and the closed
   executable-call/property-write authority surface;
2. a programmatic Vite 8 production build observes `moduleParsed` records and resolved static
   edges, which are the authority for the actual production build's resolved module graph, while
   two observations and local backing-file snapshots prove the graph stayed stable; and
3. dependency-cruiser retains the package-level application and framework boundary only after
   the exact loaded rule schema and installed tool version are authenticated.

Hostile mutation tests add direct and aliased JSX, namespace and helper trees, React factory
bypasses, plan-shaped objects, indirect callable extraction, DOM setters, dynamic loaders,
forbidden direct and transitive packages, forbidden data inputs, HTML attributes, PostCSS
configuration, stylesheet visual substitutes, unresolved imports, orphan modules, symbolic links,
graph substitutions, and hostile option containers. Each mutation must make the audit fail;
source-text substring matching or TypeScript declaration resolution alone is not accepted as
runtime-graph proof.

The deterministic receipt authenticates the immutable M05-T07 shell artifact and immutable
M05-T08 official sign-in artifact before evaluating successor source. It records the discovered
source inventory, semantic findings, actual Vite module/edge inventory, public renderer and
adapter authorities, hostile-mutation inventory, authenticated dependency rule, and two identical
normalized production-build graph observations including transformed-module code hashes and
stable local backing-file identities.

## Scope decisions

This evidence proves the current checked-in, independently built Web–React reference host. It does
not claim that arbitrary future host changes are safe without rerunning the audit, that the
controlled fixture is M06 Publisher output, or that a browser can dynamically install capability
code. It does not add a backend, channel fetching, package installation, persistent activation,
restart recovery, real-browser E2E, Desen App authoring/preview parity, deployment-security proof,
or native/iOS/Android runtime.

The AST rule deliberately allows honest host-owned boot, error, recovery, navigation, and
accessibility infrastructure outside the managed surface. It proves absence of a handwritten
managed-screen substitute, not absence of all React JSX in the host.

## Historical compatibility

M05-T07 and M05-T08 remain immutable task-time artifacts. Their compatibility readers authenticate
the exact historical bytes and reviewed semantics without rebuilding those prior claims from
M05-T09 successor source.

At the M05→M06 boundary, M05-T09 follows the same rule. Its committed G05 receipt is now read as an
immutable task-time record: verification authenticates its exact byte digest, byte length,
identity, predecessor receipts, claim and nonclaim inventory, semantic TypeScript slice, build
envelope, real Vite graph, dependency boundary, tracked-file inventory, mutation-policy inventory,
claim-status transitions, and documentation pins. Historical build and write APIs reject
workspace roots, source overrides, proof-text regeneration, and other successor-state injection.
The default writer performs no write; an alternate in-workspace destination receives only an
atomic copy of the already authenticated historical bytes.

Current host safety remains independently executable. A separately named current audit reruns the
complete source inventory, semantic checker, two observed Vite builds with backing-file
reauthentication, build-envelope checks, and dependency-cruiser boundary. It then compares every
enduring M05 field with the historical receipt. The four migrated M05 proof implementation/test
paths are the only records excluded outright from successor raw-byte equality.

The root `package.json` and `pnpm-lock.yaml` instead use narrow coordination projections. Their
current raw byte lengths and hashes must first equal the tracked records produced by the live
audit. The canonical root manifest may then remove only Publisher-namespaced
generate/verify/test script keys and exact Publisher verify/test pipeline segments; the complete
remaining bytes must equal the historical length and hash. The lockfile may replace only its
unique `packages/publisher` importer block with the historical empty importer; every other byte
must equal the historical length and hash. Root tool versions and scripts, package snapshots,
integrity and patch metadata, lock settings, and every non-Publisher importer therefore retain
task-time provenance.

Before that projection, the complete current lockfile must pass a bounded parser for pnpm's
canonical lockfile YAML subset. It requires strict UTF-8 and LF framing, canonical indentation,
rejection of YAML-forbidden C0/C1 control code points, one exact root-section inventory,
structurally valid mappings/sequences and balanced flow collections, and unique mapping keys. YAML
aliases, anchors, tags, merge keys, block scalars, directives, comments, duplicate block or flow
keys, ambiguous plain scalars, and excessive line/nesting/token input fail closed. The unique
Publisher importer must be either the exact empty mapping or dependency groups whose entries each
contain exactly one genuine plain or quoted `specifier` and `version`. Each field must resolve
under pnpm's YAML schema to a bounded, non-empty, control-free, well-formed string rather than a
null, boolean, number, timestamp, flow mapping, or sequence. Decoded dependency names must also
match the bounded npm package-name domain. Unquoted values and mapping keys reject YAML-reserved
leading indicators—including `%`, `@`, and backtick—while properly quoted string equivalents
remain valid. Malformed Publisher bytes cannot disappear through projection, and diagnostics
expose only controlled classifications rather than rejected lockfile content.

All six coordination paths are still captured before and after the live audit, and every
host-relevant semantic effect remains in the compared build envelope, tool-version checks,
resolved graph, backing snapshots, boundary, claims, and nonclaims. Current-evidence normalization
also preserves hostile `__proto__` keys, requires exact tracked-record fields, rejects decorated or
duplicate records, and applies aggregate node, scalar, key, and string-byte budgets. No host
source, host manifest, Catalog/Bundle data, configuration, graph module, semantic result, toolchain
input, lockfile input outside the Publisher importer, or unlisted tracked path can drift silently.

## Evidence artifact

- path: `docs/proof/artifacts/reference-host-web-0.1.0-source-audit.json`
- SHA-256: `sha256:cb54702266260a6e139950808b520bc139d35cebbde03ea93a187d2340a17e89`
