# Editor Core Stable-ID Insert Proof

## Result

Task: `M08-T02`

Result: `PASS`

Artifact: `docs/proof/artifacts/editor-core-0.1.0-stable-id-insert.json`

Final artifact: `sha256:edc7dc1df296056be0c281ed268d07565b0eca2eed7ba7ba63e69ae6b74f6547`

## Direct frozen prerequisite

The proof authenticates the frozen 23,270-byte M08-T01 Source-document artifact directly at
`sha256:aaa3a2447b71361361f471a822bba78e90a3f97f493b23ad3314f51c62ad4025`. The read is bounded,
no-follow, canonical-parent, single-link, and checked for file-identity stability before and after
acquisition. No live proof-reader checkpoint—and specifically no sequence-29 head artifact—is an
input to this successor claim.

## Stable allocation and insert boundary

The emitted `insertDesenEditorNode` command allocates within the selected surface's shared node and
behavior identity namespace. It selects the preferred base when free, otherwise the lowest free
`-2`, `-3`, and later ordinal while truncating only enough to retain the 128-character identifier
limit. Identity comparison remains case-sensitive and surface-local.

One minimal `{ id, use }` leaf is inserted at the exact requested boundary of a named slot. Both
component nodes and behavior instances can own the target slot. Existing semantic array order and
all prior identities remain unchanged; an absent slot is created only at index zero. Structurally
valid names that overlap `Object.prototype`, such as `constructor`, are treated as absent unless
they are own slot data and are created as own data without inherited lookup. Unresolved capability
or slot semantics remain representable because M08-T09, not this task, owns catalog-backed
continuous diagnostics.

## Atomicity, diagnostics, and fixed limits

Success yields a fresh detached recursively frozen direct Source plus the allocated identity.
Failure yields a frozen diagnostic result with neither a partial document nor an allocated
identity. Runtime probes cover all five editor insert diagnostic codes and the unchanged
`SCHEMA_INVALID` structural pass-through.

The proof exercises both the exact ceiling and a one-unit crossing for the fixed implementation
profile: 4,096 capability-id code units, an 8,388,608-byte canonical post-insert Source, 25,000
node/behavior identity occurrences in the target surface, and component depth 64 with the surface
root at depth zero. These are canonical admission/output limits. They are not a claim of streaming
or preallocation memory-DoS resistance.

## Public package and platform boundary

The evidence records 53 exact receipts for the manifest, source, emitted JavaScript and declarations,
source maps, package and public tests, compiler-negative assertions, proof harness, official fixture,
and the complete runtime dependency closure. It requires exactly two runtime exports, ten reviewed
type exports, seven documented insert declarations, the one-root export map, and only
`@desen/protocol` plus `@desen/validator` as production dependencies.

The reviewed three-module emitted graph has five known static ESM edges and no unknown static edge.
It contains no React, DOM, browser-global, dynamic-import, or executable-evaluation authority. The
behavior probes do not import that graph from the workspace. Only after all receipts are acquired,
the proof copies the four exact editor package/runtime files and 21 exact dependency files—two
package manifests plus 19 protocol/validator modules—into a fresh isolated 25-file ESM graph. Every
dependency copy must match its corresponding byte receipt inside the directly authenticated frozen
M08-T01 artifact. The isolated entry is then imported without using a workspace module-cache entry.
The focused insert suite contains 16 cases, while the built public package contains 15 runtime
contract cases plus seven fail-closed proof-core cases.

The claim is limited to this exact platform-neutral emitted boundary. Node, its ESM loader, and the
process environment remain trusted authorities. This authenticated-byte-copy isolation closes an
import-before-receipt or workspace-cache substitution path; it is not a general hostile-JavaScript
sandbox.

## Deterministic fail-closed evidence

Generation serializes one deterministic JSON value, writes it through an exclusive same-directory
temporary, syncs and rechecks the open inode and bytes, then atomically renames and verifies the
committed result. A failed pre-rename hook preserves the previous complete destination. Existing
symlink, hard-link, or non-file destinations fail closed.

Verification independently rebuilds the evidence, compares exact artifact bytes, and requires this
document to contain one and only one exact final SHA-256 pin. Build and verifier options accept only
own enumerable data properties; unknown, inherited, accessor, symbol, Proxy, and shared-byte
authority is rejected. A caller-supplied runtime is rejected before any supplied function executes.

## Honest remaining scope

This closes only M08-T02 stable-ID allocation and one-node insertion. It does not claim M08-T03
delete, move, or ordered reorder operations. Selection and viewport policy remain later authoring
scope, outside both M08-T02 and M08-T03. The M08-T04 through M08-T08 authoring and persistence
commands, M08-T09 catalog semantics and continuous diagnostics, and the M08-T10/G08 terminal UI
boundary also remain open. This proof advances neither P-18 nor G08 and changes no frozen DESEN
0.1.0 byte.

## Reproduction

```bash
pnpm --filter @desen/editor-core build
pnpm --filter @desen/editor-core test:stable-id-insert
pnpm --filter @desen/editor-core test:public-package
node scripts/generate-editor-core-stable-id-insert-proof.mjs
node scripts/verify-editor-core-stable-id-insert.mjs
node --test tests/editor-core-stable-id-insert.test.mjs
```
