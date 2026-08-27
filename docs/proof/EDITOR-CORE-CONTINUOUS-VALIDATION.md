# Editor Core Continuous Validation Proof

Task: `M08-T09`

Status: `DONE`

Profile: `desen.editor-core.continuous-validation-proof.v1`

Artifact: `docs/proof/artifacts/editor-core-0.1.0-continuous-validation.json` (40,099 bytes)

## Frozen prerequisite authority

The proof directly authenticates the five formal M08-T09 prerequisites by exact no-follow bytes:

- `M08-T03` `sha256:0d44f67c316c21ff8b612221d01e81c76d3b24783164bb75a772985bbc7def8b`
- `M08-T04` `sha256:1726d453913c091d30229be02270a0cb4b74bf479f87027c4b9a0da3bb3c7066`
- `M08-T05` `sha256:b85e578ac2bc27897517f12d8d4cf867a089cd61ff9fd1ab0664c819977634f8`
- `M08-T06` `sha256:05a7df153512b8dd0f8289991d12a9d12d79903ed8b3637ef6c8a450ca8a6be7`
- `M08-T07` `sha256:33b6f81be62076d304c6daaec5d860e7995fa69ceaf34103469b349a347962db`

`M08-T08` is deliberately not a formal prerequisite. Its already-main persistence source,
distribution, focused tests, types, exports, and package script are audited only as part of the
current additive package graph. Continuous-validation behavior does not invoke the persistence
port or receive filesystem, network, retry, storage, or durability authority. No live reader or
checkpoint head substitutes for any frozen prerequisite artifact.

## Catalog-bound continuous validation

`createDesenEditorContinuousValidator` independently snapshots and prepares one Catalog array. A
failure returns only frozen Validator diagnostics and no partial validator. A success returns a
frozen synchronous validator with an order-sensitive Catalog-set fingerprint. Later caller
mutation of the original Catalog input cannot change either validation behavior or that
fingerprint.

Each call returns the complete cumulative execution-contract diagnostics and all dynamic
obligations without exposing a trusted Source clone. Obligations remain later validation work and
do not make an otherwise valid Source invalid. The official sign-in Source is valid with seven
obligations spanning `component-prop`, `operation-input`, and `state-write`.

## Invalid-subject mapping

Mapping uses only a diagnostic's explicit `context.surfaceId` and `context.subject`. Pointer text
is never parsed or guessed as identity. The proof covers:

- one critical unknown-capability diagnostic mapped to the exact `sign-in.layout` node and its
  `/surfaces/sign-in/root` occurrence;
- duplicate `sign-in.email` node identity with both exact occurrence pointers returned in stable
  order;
- multiple diagnostics grouped under one subject while their original diagnostic indexes and
  Validator order remain unchanged; and
- a document-level Catalog-requirement mismatch retained as controlled unmapped index `[0]`
  rather than attached to a guessed node.

Diagnostics and obligations remain complete, detached, and recursively frozen. Mappings expose
indexes into the unchanged diagnostic array plus every current occurrence of that exact
surface-local subject identity.

## Fingerprints and determinism

The document fingerprint covers the complete RFC 8785 Source, including root `authoring`.
Otherwise equal Sources whose selection metadata differs therefore produce different document
fingerprints. The Catalog-set fingerprint preserves array order: `[primary, empty]` and
`[empty, primary]` produce different Catalog identities while validation of the same Source stays
valid and keeps the same document fingerprint.

Two fresh proof builds are byte-identical. Repeated validation of one document returns distinct
frozen report objects with byte-equivalent content. The artifact records exact behavior receipts,
tracked authority receipts, and the isolated runtime closure.

## Runtime and platform audit

Behavior executes only after copying the exact receipted package graph into a fresh OS temporary
directory and importing it there. The closure contains ten editor files and twenty-one protocol
and Validator dependency files. Six retained editor runtime modules and every dependency byte are
checked against the frozen M08-T07 authority before import; the current persistence module is
audited without making T08 formal prerequisite authority. Node, the ESM loader, and the process
environment remain trusted.

The emitted editor graph has thirty-six emitted files and twenty-four reviewed static ESM edges.
The current root exposes thirty-five runtime exports and eighty-eight types: T08 contributes its
persistence factory and thirteen types, while T09 contributes exactly one validator factory and
six types. Production dependencies remain
only `@desen/protocol` and `@desen/validator`; the graph has no React, DOM, Node-platform, storage,
network, dynamic-import, or evaluation authority. Every new public declaration retains TSDoc.

## Nonclaims

This task does not prove pointer-derived identity, execute obligations, resolve dynamic values,
load Catalog packages, invoke persistence adapters, add storage or durability authority, provide
undo/redo or viewport policy, or close the terminal React/DOM and G08 boundary. It is not a
hostile-JavaScript sandbox.
`M08-T10` retains terminal integration and G08.

## Reproduction

```text
pnpm --filter @desen/editor-core build
pnpm --filter @desen/editor-core test:persistence
pnpm --filter @desen/editor-core test:continuous-validation
pnpm --filter @desen/editor-core test:public-package
node scripts/generate-editor-core-continuous-validation-proof.mjs
node scripts/verify-editor-core-continuous-validation.mjs
node --test tests/editor-core-continuous-validation.test.mjs
```

Final artifact: `sha256:7739b5143685d613a678c6eca5480f27a5a303b176bf2bf4613a4d6917fe7e5a`
