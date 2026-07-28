# M05-T08 — Reference-host official sign-in execution

## Decision

M05-T08 is `PASS` for the deliberately bounded Web/React claim: the separately built reference
host loads the controlled official-derived protocol Bundle, authenticates it against the current
reference Catalog, mounts a real runtime-core headless session, creates the real five-component
React adapter registry, and activates the `sign-in` surface through the host boundary introduced
by M05-T07.

This is executable proof that the frozen Desen protocol can drive the official sign-in example
without the application hand-authoring that managed screen as React JSX. It is not yet the final
source/import absence proof; M05-T09 owns that wider AST and resolved-import audit.

## Controlled fixture

The checked-in files
`examples/sign-in/official-derived.source.desen.json` and
`examples/sign-in/official-derived.bundle.desen.json` are controlled derivatives of the frozen
upstream official sign-in example. Their only admitted changes are the exact current reference
Catalog id, version, and digest plus the Source and Bundle identities that must be recalculated
from those changes. The canonical managed surfaces are byte-identical to the upstream example.

The protocol Bundle has no top-level authoring state. This narrow statement does not claim that
the compiled Vite JavaScript contains no inert Catalog authoring metadata: the current Catalog is
intentionally bundled and authenticated at runtime.

## Executed boundary

The host-owned composition fixes the document id, revision, entry and destination surfaces,
operation capability, invocation alias, effect, destination path, and empty navigation
parameters. Callers cannot choose another Bundle, Catalog, adapter registry, capability id,
recovery key, or arbitrary React children.

The React/jsdom integration exercises controlled input editing, pending state, declared failure,
an edited retry, successful rendering, browser navigation, same-surface rapid-press suppression,
redacted rejected handlers, terminal disposal, and same-document host/session replacement with
stale-settlement containment. “DOM integration” here means React rendered into jsdom; it is not a
real-browser end-to-end claim.

The production composition stays active across a persisted `pagehide` (BFCache entry), preserves
its listener, and disposes the root/session/host authorities only on the first final,
non-persisted `pagehide`.

The application-owned HTTP binding makes exactly one fixed same-origin `POST /api/sign-in`
attempt per accepted invocation. It maps only HTTP 401 to `invalidCredentials`; all other HTTP,
network, malformed response, response-stream, parse, and unsafe JSON failures become the generic
`unavailable` result. A successful body is accepted only when it is valid UTF-8 JSON bounded to
64 KiB and at most 1,024 non-empty stream chunks. Overflow cancels and releases the local body
reader as cleanup, but this proof does not claim fetch-level transport cancellation. Runtime-core
remains the sole owner of Catalog-authenticated operation output validation.

## Evidence method

The deterministic receipt directly authenticates immutable M05-T04 interaction evidence and the
immutable task-time M05-T07 host-shell receipt before it interprets successor source. It then:

- validates the exact derived/upstream fixture differences, canonical surfaces, digests,
  revision, Catalog identity, structural validity, cumulative execution validity, and real
  adapter inventory;
- byte-pins the critical production entry, composition, and HTTP boundary so a weakened live
  branch cannot be hidden behind a decoy comment or string;
- checks the closed production import allowlist, absence of dynamic executable loading, root
  scripts, package boundaries, focused test titles, compiler-negative ids, migrated M05-T07
  compatibility tests, and the exact trace assignments;
- runs two isolated Vite builds and requires identical sorted file inventories, byte counts,
  per-file SHA-256 values, and aggregate SHA-256; and
- writes the final receipt atomically and verifies the exact artifact bytes, one unique pin in
  this document and Project Status, and exact pins in the Proof Matrix task section plus its P-06
  and P-10 rows.

## Scope decisions

The evidence strengthens P-06 and P-10 but leaves both `PARTIAL`. P-07 remains `NOT_PROVEN`
pending M05-T09, and P-17 remains `PARTIAL`. N-036 remains `PLANNED`; no normative status changes
are claimed. G05 remains open pending M05-T09.

This task does not claim M06 Publisher output, a real authentication backend, credential storage,
authorization/session policy, timeout, automatic retry, fetch-level transport cancellation,
channel fetching, package installation, IndexedDB activation/recovery, final no-handwritten-tree
proof, real-browser end-to-end conformance, Desen App authoring parity, or native/iOS/Android
runtime support.

## Historical compatibility

M05-T07 remains an immutable task-time artifact. Its generator, verifier, library, and hostile
test suite now read and authenticate those exact historical bytes; they do not silently rebuild
the old shell claim from M05-T08 successor source.

## Evidence artifact

- path: `docs/proof/artifacts/reference-host-web-0.1.0-sign-in.json`
- SHA-256: `sha256:a7c83d438190ee45dae4714bd092e56282cb3db4c69c72eeaca44e2647683adb`
