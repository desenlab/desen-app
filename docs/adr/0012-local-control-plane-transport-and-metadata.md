# ADR 0012: Keep channel discovery separate from activation authority

- Status: Accepted
- Date: 2026-08-05
- Decision owner: M07-T05
- Implementation status: Complete

## Context

The local control plane needs to expose three kinds of state with different mutation rules:

1. editable Source material;
2. immutable Bundle bytes addressed by a DESEN revision; and
3. mutable channel pointers such as `preview` or `production-proof`.

DESEN 0.1.0 states that a mutable channel may point at a revision, but does not define a transport,
repository key grammar, optimistic-concurrency model, authentication profile, or metadata schema.
It separately requires staging and atomic activation before an active revision changes. Treating a
channel pointer as an active-revision record would therefore collapse the M07-T05 distribution
boundary into the later M07-T06 and M07-T07 authorities.

The control plane is a local proof service rather than the future public `desen.run` API. It still
accepts untrusted HTTP input and must not rely on “localhost” as an authentication mechanism.

## Decision

### Three separate persistence responsibilities

- Source material is stored as exact, bounded JSON bytes under a local `sourceKey` and a monotonic
  generation. It may be an unpublished draft. The ingress requires strict interoperable JSON, a
  `desen.source` / `0.1.0` root envelope, and the fixed 8 MiB raw and canonical limits, but does not
  run Publisher, Catalog-backed semantic validation, or publication.
- Bundle bytes are delegated unchanged to the M07-T01 `BundleStore`. The HTTP boundary preserves
  its exact `stored`, `unchanged`, and `conflict` outcomes. It does not run M07-T02 integrity,
  M07-T03 package, or M07-T04 reference preflight.
- Channel metadata is stored outside Bundle bytes and outside the Bundle `publication` member. A
  channel contains only a local name, one existing immutable revision, and a generation. It is a
  discovery pointer, not a staged, active, or previous-good record.

Source keys and channel names use the exact lowercase grammar `^[a-z][a-z0-9-]{0,63}$`. They are
storage identities and need not equal a Source document's protocol `id`. No trimming, case folding,
Unicode normalization, percent-decoding fallback, path interpretation, list, delete, or alias
selection is provided.

### Compare-and-set mutation

Source and channel writes require an HTTP precondition:

- `If-None-Match: *` creates generation 1 only when the record is absent;
- `If-Match: "g:<generation>"` updates only that exact positive safe-integer generation; and
- missing, wildcard update, stale, malformed, or exhausted generations perform no write.

An identical value at the correct generation returns `unchanged` without incrementing the
generation. A stale precondition fails even when the proposed value is byte-identical. This avoids
lost updates and keeps one deterministic winner across independent service instances.

A channel may point only at a revision already present in the immutable Bundle store. Since the
M07-T01 API has no delete operation, an accepted pointer cannot become dangling through this API.
The referenced bytes may nevertheless fail later integrity or preflight. That is intentional:
channel discovery grants no activation authority, and later M07 stages must reject the candidate
without changing last-known-good state.

### Local HTTP security profile

The public factory owns a Fastify 5 application behind a closed Desen wrapper. Network listening
binds only `127.0.0.1`; callers select only a port. Every data route requires one host-supplied
visible-ASCII bearer token of exactly 32–256 bytes. The implementation retains only its SHA-256 digest
and compares fixed-length digests in constant time. Tokens and request bodies are redacted from
logs and errors.

Browser origins are denied by default. A caller may configure exact `http` or `https` origins;
wildcards, `null`, paths, credentials, suffix matches, and implicit port equivalence are rejected.
Preflight admits only the fixed routes, methods, and headers and does not itself grant data access.
For an admitted browser origin, data responses expose only `ETag` so the client can carry the
current generation into an exact compare-and-set write after either a read or a stale rejection.
Proxy trust is disabled. Responses use fixed error envelopes and never expose local paths, SQL,
stack traces, causes, tokens, or caller data.

Socket inactivity is limited to 5 seconds, receipt of a complete request is limited to 15 seconds,
and idle keep-alive connections are limited to 5 seconds. Shutdown drains admitted network work
within those finite transport bounds, so an incomplete or slowly trickled body cannot retain the
service indefinitely.

Source and Bundle bodies cross exact buffer content parsers so parsing cannot reserialize or hide
duplicate JSON keys. Source accepts at most 8,388,608 bytes and Bundle at most 2,097,152 bytes.
Channel JSON is a closed `{ revision }` envelope with a small independent limit. Content encoding
other than absent or `identity`, unknown query parameters, unsupported media types, and extra
fields fail closed.

### SQLite behind a replaceable repository

Editable Source and channel metadata use SQLite behind package-private repository contracts.
Immutable Bundle bytes remain in the established content-addressed POSIX repository. The SQLite
profile uses prepared statements, `STRICT` tables, fixed schema versioning, foreign keys,
`trusted_schema=OFF`, WAL, `synchronous=FULL`, a fixed busy timeout, and explicit immediate
transactions for compare-and-set writes.

The pinned implementation is `better-sqlite3@13.0.3`. Unlike the exact Node 24.10.0 built-in
`node:sqlite`, it is not an experimental API. This version includes signed, provenance-attested
prebuilt native artifacts and has no consumer install lifecycle script. Its module is loaded only
inside the SQLite composition path. Ordinary package-root imports and repository-injected Fastify
tests do not load native code; only the exact SQLite proof workloads receive Node native-addon
permission.

Most transport behavior is tested without a real TCP listener through Fastify `inject()`. One
loopback TCP case deliberately leaves an authenticated body incomplete and proves that shutdown is
blocked while the request is active but resolves after the finite inactivity limit. This proves the
local listener lifecycle, not reverse-proxy or public deployment behavior.

## Consequences

- Updating a channel never rewrites, canonicalizes, touches, or republishes Bundle bytes.
- Source storage never publishes a Bundle or changes a channel.
- Bundle storage never changes a channel.
- M07-T05 returns records and concurrency metadata only; it creates no opaque integrity, package,
  reference, staging, commit, activation, recovery, runtime, or host authority.
- M07-T06 remains responsible for staged runtime indexes, M07-T07 for the transactional
  `{activeRevision, previousGoodRevision}` record, and M07-T11 for host channel consumption.
- A remote or multi-tenant service, TLS termination, public credential lifecycle, browser
  deployment, and `desen.run` remain outside this local profile.
