# Editor Core Persistence Proof

## Result

Task: `M08-T08`

Result: `PASS`

Artifact: `docs/proof/artifacts/editor-core-0.1.0-persistence.json` (49,785 bytes)

Final artifact: `sha256:51932d4165afff3c40fae6769527e480f6d0ff355f3fbc6d8ae7c6809e50a6fe`

## Authenticated authority

The proof directly authenticates two frozen predecessor artifacts before it executes current code:

- M07-T05 local Source API, 41,945 bytes at
  `sha256:144e8a46b3b41a1f98a022bf4c16dddb9d7415af4e5033322484d4bdd49c55b9`;
- M08-T07 editor authoring round trip, 62,304 bytes at
  `sha256:33b6f81be62076d304c6daaec5d860e7995fa69ceaf34103469b349a347962db`.

Both are bounded, no-follow, canonical-parent, single-link reads checked against their exact byte
length, SHA-256, proof identity, profile, task, and PASS result. Frozen predecessor bytes are not
rewritten. The current proof also receipts every reviewed source, package test, independent root
test, proof script, lockfile, and emitted `.js` or `.d.ts` file used by the integration.

## Real persistence integration

The evidence opens the public M07-T05 `openLocalControlPlane` over a fresh operating-system
temporary directory and its real `better-sqlite3@13.0.3` database. It does not substitute an
in-memory repository. The Web adapter receives an explicit fetch-shaped shim that dispatches into
the same Fastify route implementation through `inject`; no implicit global fetch and no network
listener are used. `createLocalDesenEditorPersistencePort` binds that transport to the public,
platform-neutral editor-core persistence port.

Through those public package exports, the integration proves:

- an absent Source opens as missing, creates at generation 1, reopens, saves unchanged without a
  generation advance, and updates to generation 2;
- two independently opened control-plane instances and two editor ports observe generation 2,
  then race the same generation-guarded candidate with exactly one generation-3 winner and one
  generation-3 conflict;
- after both instances close, the database is one regular single-link SQLite file; a third fresh
  instance reopens the exact generation-3 Source and an unchanged save remains generation 3;
- the storage key `local-draft` is independent of the protocol Source `id`;
- canonical Source bytes, complete root `authoring`, and all sixteen reachable Source extension
  locations survive the create/update/CAS/close/reopen path as detached recursively frozen parsed
  values.

The fixture covers the Source root, catalog requirement, surface, state declaration, resource
instance, node, behavior, repeat, variant, and all seven closed action variants. Its values include
ordered duplicates, Unicode, null and empty values, prototype-sensitive own keys, and values that
look like core IDs, references, or actions.

## Uncertain and adversarial outcomes

A separate PUT is durably dispatched to the real SQLite route and then has its response hidden.
The port returns `indeterminate`, performs no automatic retry, and a normal reopen resolves the
committed generation-1 Source. Synthetic hostile transport boundaries additionally prove that
malformed UTF-8 reads fail closed, a malformed successful PUT response is indeterminate, wrong
authentication is redacted, invalid local keys are rejected, and implicit fetch configuration is
rejected.

Post-dispatch `STORAGE_IO_FAILURE`, `UNSAFE_STORAGE_PATH`, `METADATA_CORRUPT`, and an unknown local
error envelope are all treated as indeterminate. None is incorrectly reported as a definite
failure after the adapter has handed the complete candidate to storage.

## Honest scope

This is parsed canonical JSON value preservation, not original whitespace, lexical bytes, or input
member-order preservation. Fastify injection proves the shared local route implementation, not
TLS, reverse proxies, remote binding, or public deployment. Node.js, its ESM loader, Fastify,
installed external dependency bytes, the operating system, process environment, and native SQLite
addon remain trusted authorities.

The Web adapter owns no filesystem path, SQLite handle, implicit transport, automatic retry,
merge, list, or delete authority. An indeterminate write is resolved only by reopening. Catalog
semantic diagnostics and invalid-node mapping remain M08-T09; terminal React/DOM integration,
cross-command terminal determinism, and G08 remain M08-T10. Undo/redo, selection and viewport
policy, multi-user synchronization, and remote persistence are outside M08-T08.

## Reproduction

```bash
pnpm generate:editor-core-persistence
pnpm verify:editor-core-persistence
pnpm test:editor-core-persistence
```
