# Desen App structured-inspector proof

Task: M09-T06

Status: DONE

Proof ID: `desen-app-structured-inspector`

Artifact: `docs/proof/artifacts/desen-app-0.1.0-structured-inspector.json`

Artifact size: 26,133 bytes

Final artifact: `sha256:6ea4eb3f51fdfc39eeca676d7ebafb145d66a9efdfa03af9c33a7aa39aa6aaec`

P-08: NOT_PROVEN

M09-T08: NOT_PROVEN

M09-T10: NOT_PROVEN

M09-T12: NOT_PROVEN

M09-T14: NOT_PROVEN

Direct parent:

- the exact frozen 22,998-byte M09-T05 schema-inspector artifact at
  `sha256:473ab3248ed7b7b4de0e558df47159a74c28c134b46569aa91130745fd69660b`.

## Proven boundary

Desen App now consumes the complete recursive control plan derived by the public Catalog SDK.
Closed-object groups retain canonical child order, qualified labels, and exact RFC 6901 value and
schema pointers, including escaped `/` and `~` property names. Nested edits re-admit the current
route, selection, Source node, capability, descriptor, pointer, requiredness, and value state.
They rebuild only the complete top-level owner prop and invoke the public Editor Core prop
commands. A root fallback diffs the whole props object, ignores unchanged keys, and rejects more
than 256 public prop commands or 32 MiB of aggregate snapshot work before entering Editor Core's
synchronous loop. It deletes obsolete props and applies shrinking replacements before growth so a
valid near-limit endpoint does not fail on a larger private transition. No intermediate document is
exposed. A semantically unchanged root Apply, including reordered object keys, succeeds with the
already validator-admitted normalized document instead of reporting a false edit failure.

Arrays, open objects, multiple types, references, combinators, conditionals, pattern properties,
unsupported shapes, and derivation-limit results remain visible through an explicit structured
JSON textarea and named reason. Catalog control hints remain opaque presentation metadata and
never override `propsSchema`. The controlled reference Catalog has no nested/fallback component;
synthetic Catalog/Source and panel tests therefore exercise this generic App behavior without
changing the frozen reference fixture.

Structured text is scanned before `JSON.parse`. The parser rejects malformed or non-finite JSON,
decoded duplicate member names, unpaired Unicode, and Publisher-limit violations for raw UTF-8
bytes, decoded string code units, number token length, depth, and value occurrences. Every decoded
object key beginning with `$` remains behind M09-T08. Success returns detached recursively frozen
JSON, and deterministic formatting sorts object keys while preserving array order.
When indentation alone would exceed the same Publisher text profile, formatting stops accumulating
pretty chunks at a conservative code-unit ceiling before joining them, then falls back to canonical
compact JSON so an already admitted value remains editable.

Route, selection, and edit commands are captured as exact own enumerable data before authorization.
Structured values are detached through public canonical JSON, and accessors, symbols, extra fields,
invalid pointers, stale identities, unknown controls, schema-invalid values, and dynamic markers fail
closed. Mutation begins from the exact validator-admitted Source snapshot rather than rereading a
hostile caller object. A group containing a dynamic descendant is locked as a whole while literal
siblings retain their own edit authority. Every candidate complete Source passes the public
continuous validator before success; failure returns no partial Source.

After Editor Core success, the App publishes the complete candidate Source through the public
Publisher. `{document, preview}` is committed as one session value only after Publisher success.
Publisher rejection retains the prior document and working preview, and an accepted Bundle
revision replaces and disposes the prior Runtime session.

Inspector chrome remains an App-owned `aside` outside the managed capability subtree. Recursive
groups use named `fieldset`/`legend` semantics; repeated schema titles and an empty property remain
accessibly distinguishable through qualified names. Structured formatting is memoized, successful
numeric drafts canonicalize, and each draft keeps one inline alert plus its described help target.
Stable pointer-keyed fields hand focus to the replacement fieldset, textarea, or primitive control
when an edit changes the value kind. Structured textarea, fallback reason, Apply/Reset/Unset
actions, validation alerts, and live status are App UI only. Neither Inspector source nor CSS
acquires private DOM, React internals, managed-descendant selection, geometry, hit-test,
canvas-picking, adapter, or runtime authority.

## Evidence

- The focused six-file App structured-inspector suite passes 73/73.
- The complete App suite passes 118/118.
- The complete structural CI glob passes 323/323 locally.
- The independent root proof passes 10/10, covering the frozen parent, recursive schema/pointer
  policy, strict JSON limits and bounded compact fallback, bounded/diffed public Editor Core
  mutation, delete/shrink-before-growth order, semantic no-op normalization, continuous validation,
  dynamic lock, value-kind focus handoff, atomic Publisher preview, ownership, hostile source
  mutations, deterministic rebuild, receipt drift, and non-regular filesystem authorities.
- App typecheck, lint, and production build pass locally.
- The artifact records 28 exact tracked-file receipts, one frozen parent, all live App source/test
  inputs, task commands, explicit nonclaims, and proof reader paths.
- These local receipts make no required-gate or hosted-CI claim.

## Explicit nonclaims

- M09-T08 remains unproven: local-state and binding editing are not implemented; dynamic values
  remain visible but locked.
- M09-T10 remains unproven: no Design/Run mode is implemented.
- M09-T12 remains unproven: no save/open or durable persistence UI is implemented.
- M09-T14 remains unproven: a session-local Publisher Bundle is not control-plane publication or
  activation.
- P-08 remains `NOT_PROVEN`; slot, binding, action, mode, persistence, publication, and browser-E2E
  owners remain outstanding.
- No private DOM/native structure, component geometry, hit testing, canvas picking, arbitrary
  future Catalog, native-target, or pixel-fidelity guarantee is claimed.

## Reproduction

```sh
node scripts/verify-desen-app-schema-inspector.mjs
pnpm --filter @desen/app-web lint
pnpm --filter @desen/app-web build
pnpm --filter @desen/app-web typecheck
pnpm --filter @desen/app-web test:structured-inspector
pnpm --filter @desen/app-web test
node --test tests/desen-app-structured-inspector.test.mjs
node scripts/verify-desen-app-structured-inspector.mjs
```
