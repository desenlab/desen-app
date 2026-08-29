# Desen App Source persistence

Task: M09-T12

Status: DONE

## Reviewed boundary

The Desen App now exposes Design-mode Open/Save controls over one trusted-host-injected public
Editor Core `DesenEditorPersistencePort`. The fixed `account-app/sign-in` route owns the exact
`account-app-source` key independently of `Source.id`; the App itself neither implements nor claims
a concrete storage adapter.

Only the controller's immutable authored Source snapshot crosses the save boundary. Catalog
scenario overlays, fixture lifecycle state, Runtime form input, and secrets are excluded. Open
reauthorizes the stored document id, Catalog projection, surface, and publishable preview before it
atomically replaces the current authored Source session.

Awaited Open/Save settlements are captured only from exact own enumerable data descriptors without
invoking accessors. Recognized diagnostics copy a valid optional JSON pointer, context, and
node/behavior subject into fresh frozen data. Created, updated, unchanged, conflict, and exhausted
settlements must satisfy their exact relationship to the dispatched expected generation. A
malformed Open becomes a controlled retryable failure that preserves the draft; a malformed Save
becomes indeterminate and requires reopen.

Create, update, and unchanged settlements retain exact generation compare-and-set semantics. Dirty
state is derived from complete admitted authored Source canonical content, never object identity or
document version. A same-value replacement and a revert to the saved canonical Source are clean;
`reopenRequired` preserves the safety lock until a successful or missing Open. Successful Open and
Save establish canonical baselines, while Save settlement compares the current canonical Source
with the dispatched snapshot so a newer edit remains dirty and a canonical revert settles clean.
Conflict, exhausted generation, and indeterminate commit outcomes require an explicit reopen; the
App has no automatic retry or merge authority. Stale open/save work is ignored after edits, route
unmount, StrictMode replay, host authority replacement, or disposal.

The operation token remains held and is rechecked after settlement reflection, and Open rechecks it
again after stored-document admission. Reentrant edits or disposal therefore cannot publish a
stale or revoked settlement.

Dirty Open requires explicit inline confirmation. Every authored-session replacement flows through
one centralized commit path that updates surface-owned canonical baseline/current refs and a
rerender-safe in-memory dirty projection. Successful Open and Save update that baseline. The
navigation guard is owned by the current surface/controller lifetime: without an injected port,
pristine navigation remains admitted and is labeled `Local draft unchanged`, while an edited
in-memory draft requires confirmation across links and browser traversal, and dirty page exit is
protected through `beforeunload`. Port-backed dirty sessions use the same surface guard.
Generation, dirty, pending, conflict/uncertainty, and reopen-required states remain visible without
depending on color.

## Local receipts

- Focused persistence suite: 5 files, 142/142 tests passed.
- Full Desen App suite: 22 files, 324/324 tests passed.
- Desen App typecheck and lint passed in the reviewed product run.
- Independent proof mutation suite: 12/12 tests passed.
- Deterministic proof boundary: 35 tracked files and 3 immutable parent artifacts.
- Deterministic artifact: 27,053 bytes of Prettier-compatible JSON. The two reviewed short import
  arrays are compact exactly once; their expanded forms and any compaction-target format drift are
  rejected.

The focused case inventory is exact: authoring persistence 30, persistence controls 22,
persistence application 16, project navigation 32, and application compatibility 42. The full App
22/324 receipt is retained as reviewed local evidence; the focused 5/142 command is the proof-run
authority.

## Frozen parents

- M09-T01 `desen-app-shell-navigation`: 12,118 bytes,
  `sha256:c3189ff9196f0da91311156893ab569a3c9f9c1ee62631b58286647f36d23220`.
- M08-T08 `editor-core-persistence`: 49,785 bytes,
  `sha256:51932d4165afff3c40fae6769527e480f6d0ff355f3fbc6d8ae7c6809e50a6fe`.
- M09-T11 `desen-app-fixtures-scenarios-fidelity`: 29,407 bytes,
  `sha256:3f08980e687d48ba267f78c7d4dd1ae1eb59db5cc6bb3401d88705ee0416cc9d`.

The M09-T12 artifact authenticates those exact bytes before evaluating current source, tests, and
package wiring. Historical T01-T11 proof readers are deliberately not tracked by the new artifact.

## Status register

P-08: NOT_PROVEN

N-012: TESTED

N-018: TESTED

S-003: TESTED

PF-085: OPEN

PF-089: OPEN

M09-T13: NOT_PROVEN

M09-T14: NOT_PROVEN

M09-T12 does not claim publication, activation, node-linked diagnostics, a concrete persistence
adapter, automated real-browser E2E, a required gate, or a hosted-CI pass.

Final artifact: `sha256:717d0ddada008edb34909d5defcc4c28e95b36f6dfc0b1abb4d09d9775a6b734`
