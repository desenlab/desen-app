# Desen App named-slot authoring

Task: M09-T07

Status: DONE

P-08: NOT_PROVEN

M09-T08: NOT_PROVEN
M09-T09: NOT_PROVEN
M09-T10: NOT_PROVEN
M09-T12: NOT_PROVEN
M09-T14: NOT_PROVEN

## Scope

This closure adds Catalog-declared named-slot projection and Desen App-owned placement and deletion controls on top of the exact frozen M09-T06 structured-inspector receipt. It covers component insertion, cross-slot moves, same-slot reordering, and exact nested-subtree deletion through public Editor Core commands. The selected Source route, component identity, named slot, and edit are reauthorized against the current validator-admitted Source before mutation.

PF-010 supplies effective minimum cardinality and acceptance semantics. PF-080 supplies destination-boundary coordinates for move and final-position coordinates for same-slot reorder. Declared-but-absent slots remain distinct from present empty slots. Source minima, destination maxima, absent-destination minima, root deletion, and deletion across an owning-slot minimum fail closed before mutation. Deleting from a behavior-owned slot retains the exact own empty slot key.

Catalog `defaultProps` are staged deterministically through public prop commands with explicit transition and aggregate snapshot-work ceilings. Every insertion, placement, and deletion candidate is completely revalidated. Failed mutation or publication keeps the prior Source and preview session without a partial document. Node identity is retained for moves and reorders, while root placements, stale or cross-route selections, and invalid cycles fail closed. The deletion path is also exercised against a 1,024-sibling slot to pin finite traversal.

Repeated admission checks are bounded by immutable-model caches. Insertion and placement results are keyed by the exact model, target slot identity, and subject identity; boundary indices remain request-local. Placement caches retain an index-independent base and materialize PF-080 `finalIndex` and no-op status for each boundary. Only the active authoring tab performs tree or palette work. The component palette renders at most 24 filtered matches while retaining the complete match and Catalog totals in its status text.

The browser drag payload is an inert hint and is never read for authority. Drop-ready slot boundaries expand and overlap their narrow visual line, while depth-counted hover state remains stable across nested descendants. Components exposes one explicit compatible target, or a disabled slotless guide that directs the user back to Layers. Authoritative drag intent, named-slot chrome, keyboard placement controls, deletion controls, and selection state remain Desen App-owned siblings outside the managed Runtime React capability subtree.

Preview remains a session-local Publisher Bundle and commits atomically with Source. A successful deletion clears the now-stale selection and returns focus to Layers. Rejected deletion or Publisher failure preserves the prior document, preview, selection, and focus.

## Evidence

- `pnpm --filter @desen/app-web build`
- `pnpm --filter @desen/app-web typecheck`
- `pnpm --filter @desen/app-web exec vitest run test/authoring-slots.test.ts` — 1 file, 27/27 tests passed
- `pnpm --filter @desen/app-web test:named-slots` — 5 files, 70/70 tests passed
- `pnpm --filter @desen/app-web test` — 11 files, 151/151 tests passed
- `node --test tests/desen-app-named-slot-authoring.test.mjs` — 1 file, 9/9 tests passed
- `node scripts/verify-desen-app-named-slot-authoring.mjs`

The artifact authenticates the exact M09-T06 parent, production policy surfaces, focused App tests, package commands, proof readers, fixtures, and lockfile. Counts in this report are intentionally limited to the measured local commands above; no global or hosted-CI result is inferred.

## Explicit nonclaims

M09-T08 local-state and binding editing, M09-T09 event/action editing, M09-T10 Design/Run mode, M09-T12 durable save/open, and M09-T14 control-plane publication or activation are outside this closure. P-08 remains `NOT_PROVEN` until its remaining visual authoring and browser-E2E owners pass. Components whose insertion requires materializing a private required child subtree fail closed.

Final artifact: `sha256:daae817af45d8ead7052fd84df4edefd7d29cdd9ebe9cc1baea5b22b27dae90f`
