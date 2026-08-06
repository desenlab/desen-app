# M07-T05 — Local Source, Bundle, and Channel API

M07-T05 freezes a local distribution boundary for editable Source material, immutable Bundle
bytes, and mutable channel pointers. Its evidence is intentionally narrower than staging,
activation, recovery, or reference-host consumption.

## Intended proven boundary

The built `@desen/control-plane-api` package exports `openLocalControlPlane`. Opening it requires a
pre-existing application-owned root and an explicit visible-ASCII bearer secret. The returned
wrapper exposes only `inject`, fixed-loopback `listen`, and `close`. Importing the package root does
not load native code; the public factory dynamically loads the pinned SQLite composition only when
an instance is opened.

The same closed Fastify application serves injected and network requests. A listener can bind only
`127.0.0.1`, callers choose only a port, proxy trust and logging are disabled, and the executable
child runtime receipt uses injection without opening a TCP listener. One focused lifecycle case
opens only the fixed loopback listener and proves bounded shutdown for an incomplete request body.
Every data request requires the bearer token. Browser origins are denied by default and, when
configured, match exact `http` or `https` origins. Host, Origin, request-target, media-type,
content-encoding, body, and precondition checks fail closed with fixed redacted error envelopes.

The application retains only a SHA-256 token digest and compares candidate digests with
`timingSafeEqual`. Missing and incorrect credentials produce the same public failure bytes. Errors
contain no token, local path, SQL, stack, cause, request body, or caller-controlled message.

## Three separate persistence responsibilities

Editable Source bytes use local keys matching `^[a-z][a-z0-9-]{0,63}$`. Admission preserves the
exact raw bytes, requires strict interoperable JSON and the `desen.source` / `0.1.0` root schema,
and applies fixed raw, canonical, graph, depth, number-token, and decoded-string limits. The local
key is a storage identity and need not equal the Source document's `id`.

Immutable Bundle bytes continue through the separately proven M07-T01 `BundleStore`. The local API
does not parse, canonicalize, rewrite, or authenticate those bytes during storage. A valid
lowercase SHA-256 storage key can therefore address bytes that M07-T02 later rejects. This is an
intentional distribution boundary: storing or discovering a candidate is not integrity or
activation authority.

Channel metadata lives in SQLite, outside Bundle bytes and outside Bundle `publication`. A channel
contains only a local name, one already stored Bundle revision, and a positive safe-integer
generation. It is a discovery pointer. It contains no staged, active, previous-good, committed, or
recovered revision.

## Compare-and-set behavior

Source and channel creation requires `If-None-Match: *` and succeeds only when the key is absent.
Updates require the exact current `If-Match: "g:<generation>"`. A correct-generation identical
value returns `unchanged` without advancing the generation. A stale generation fails even when its
proposed value matches the winner, and an exhausted generation cannot mutate. Proposed bytes are
not observed before a missing or stale precondition is rejected.

The real built-package probe opens two independent public instances over the same root and native
SQLite database. Two same-generation Source writers receive exactly one update and one stale
failure; two same-generation channel writers do the same. Both use an identical deterministic
proposal so the winner's bytes are stable while the single-winner property remains executable.

Every Source ingress is copied before storage. Every read returns a fresh byte view. Subviews are
copied exactly rather than widening to the backing buffer. Channel updates touch neither the
referenced Bundle bytes nor their inodes.

## SQLite and restart profile

`better-sqlite3@13.0.3` is confined to the package-private SQLite composition. The fixed profile
uses prepared statements, two `STRICT` tables, `user_version = 1`, WAL,
`synchronous = FULL`, foreign keys, `trusted_schema = OFF`, a five-second busy timeout, safe
integer reads, and `BEGIN IMMEDIATE` transactions for every compare-and-set write. Database and
sidecar paths reject symbolic links, non-regular entries, unexpected hard links, and identity
replacement.

The runtime proof closes both independent instances, reopens the public factory, and reads the
exact updated Source, channel revision/generation, and both intentionally invalid Bundle byte
sequences. It also checks that the SQLite file and immutable Bundle files retain their regular,
single-link identities and that channel movement did not replace either Bundle inode.

## Executable evidence contract

The deterministic artifact pins:

- the exact M07-T01 Bundle-store artifact hash;
- the exact official Source bytes and digest;
- built package-root self-reference and the complete public export inventory;
- exact source-code, lockfile, native-policy, ADR, root-command, modular-CI, and built-distribution
  receipts;
- real public-factory Source create/read/unchanged/update, two-instance single-winner CAS, and
  close/reopen receipts;
- two exact content-addressed but structurally invalid Bundle receipts, their M07-T02 rejection,
  a channel moving between them, and Bundle byte/inode preservation;
- fixed-loopback, bearer, Origin, redaction, no-cache, and no-sniff security receipts;
- every focused runtime, compiler-negative, and independent root mutation case by exact name;
- bounded no-follow authority reads, inert override capture, atomic artifact replacement, and
  deterministic fresh-evidence comparison; and
- trace row `R-125`, which keeps content-addressed Bundle immutability separate from mutable
  channels.

Sixteen focused package cases cover the in-memory transport and repository seams, including close
races, bounded incomplete-body shutdown over a real loopback socket, admitted-request drain,
generation exhaustion, defensive subview copies, and stale-input precedence. Eighteen
compiler-negative cases close host selection, token omission, byte-view,
mutation, enumeration, deletion, staging, and activation capabilities. Sixteen independent root
cases protect prerequisites, implementation and distribution receipts, registration, traceability,
the child runtime probe, tests, filesystem authority, atomic writing, inert options, immutability,
and nonclaims.

Artifact: `docs/proof/artifacts/control-plane-api-0.1.0-local-api.json`

Final receipt: `sha256:144e8a46b3b41a1f98a022bf4c16dddb9d7415af4e5033322484d4bdd49c55b9`

## Explicit nonclaims

- M07-T05 distributes stored candidates; it does not authenticate a Bundle for execution.
- A channel is not staged, active, committed, recovered, or previous-good state.
- M07-T06 still owns staged runtime indexes and active/staged state separation.
- M07-T07 still owns the durable atomic `{ activeRevision, previousGoodRevision }` record.
- M07-T08 through M07-T10 still own restart recovery, fault injection, invalid-candidate
  rejection, concurrent activation, and last-known-good behavior.
- M07-T11 still owns channel consumption by the separately built reference host.
- Injection proves the Fastify application boundary, not reverse-proxy, TLS, remote-bind,
  multi-tenant, or public `desen.run` deployment behavior.
- The bearer profile does not define public credential issuance, rotation, or revocation.
- P-12 remains `NOT_PROVEN` until the staging, atomic activation, and recovery chain is complete.
- This is the Web-first application path; native targets still require separately reviewed
  adapters and host integrations.

## Reproduction after final registration

```sh
pnpm verify:control-plane-reference-preflight
pnpm --filter @desen/control-plane-api... build
pnpm --filter @desen/control-plane-api typecheck
pnpm --filter @desen/control-plane-api test:local-api
node scripts/generate-control-plane-local-api-proof.mjs
node scripts/verify-control-plane-local-api.mjs
node --test tests/control-plane-local-api.test.mjs
```
