# Reference-host Web channel-consumption proof

## Result

M07-T11 proves the complete local Web reference-host path from mutable channel discovery to a
separately built browser surface. A separately built Node server reads one host-configured channel
and the selected immutable Bundle over the real bearer-authenticated M07-T05 loopback HTTP API. It
then reruns the public integrity, installed-package, reference, staging, activation, and restart
recovery boundaries before any Bundle is delivered to the browser.

Artifact: `docs/proof/artifacts/reference-host-web-0.1.0-channel-consumption.json`

Final receipt: `sha256:48bd9f85bd2da413fc72c1973a33732cc091796f9afc2863ec1eec15054314e0`

The deterministic artifact was generated only after the independent server and browser builds,
local non-socket executable checks, and the 13-case root mutation suite passed. The complete
socket-backed focused suite remains mandatory in the hosted quality gate. Its verifier parent
cannot bind a listener. Only the spawned Vitest process tree receives a runner-authenticated,
mode-`0600` authority for TCP on literal IPv4 `127.0.0.1` with requested port `0`; it may connect
only to ephemeral ports opened by that same child process. UDP, DNS, hostnames, IPv6, public
addresses, Unix sockets, and fixed ports remain denied. This local receipt alone does not claim a
hosted result.

## Exact prerequisite boundary

The evidence authenticates 13 immutable prerequisite artifacts independently: the M05-T07 shell,
M05-T08 official sign-in, M05-T09 browser-source audit, and every M07-T01 through M07-T10
control-plane artifact. Every prerequisite is pinned by task identity, exact path, byte count,
SHA-256 digest, and `PASS` result. M07-T11 therefore cannot silently replace an ancestor or infer
host consumption merely from the earlier control-plane implementation.

## Separately built composition boundary

The reference host is split into two independently compiled deliverables:

- `@desen/reference-host-web-server` is the Node composition root. It may import only the public
  `@desen/control-plane-api` package root. It owns the bearer secret, loopback origin, fixed channel,
  installed-package path, and durable activation root.
- `@desen/reference-host-web` is the browser application. It receives only the inert public
  `{activation:{generation,revision},bundle}` envelope and its strong ETag from the same-origin
  refresh route. Its production source and built graph cannot import the control plane, SQLite,
  bearer authority, Desen App, editor, publisher, or testkit surfaces.

This is a concrete Web reference-host composition profile. It does not amend the frozen protocol
or make its HTTP route, refresh trigger, or deployment topology normative for other hosts.

## Channel discovery and activation

The server uses one fixed channel from trusted host configuration. A channel record is only a
discovery pointer; `{generation, revision}` is never treated as runtime authority. For a discovered
candidate the server must complete the public chain in order:

1. fetch the exact immutable Bundle bytes through the authenticated loopback API;
2. verify revision and complete Bundle integrity;
3. match the complete host-installed Web–React package candidate;
4. preflight package and reference/capability/limit requirements;
5. stage the runtime package snapshot;
6. atomically activate against the current durable generation; and
7. recover and reauthenticate the exact durable active record before post-restart delivery.

The installed package directory is selected only by server configuration. Its canonical root,
`catalog.json`, and complete `dist/**` inventory are finite and fail closed on symbolic links, hard
links, special files, invalid material, or profile-limit overflow. Bundle data cannot choose an
arbitrary filesystem path or install code.

## Closed executable sequence

The frozen M07-T11 artifact records 46 exact test identities across the server transport, installed-package
inventory, activation controller, HTTP server, browser delivery, production-entry lifecycle, and
delivered-Bundle activator. Nine of those are the closed protocol case identities:

1. `valid-a-activation-delivery`;
2. `invalid-b-preserves-a`;
3. `valid-c-replaces-a`;
4. `restart-recovers-before-delivery`;
5. `stale-refresh-fenced`;
6. `late-refresh-after-close-fenced`;
7. `loopback-bearer-enforced`;
8. `installed-inventory-symlink-rejected`; and
9. `browser-mount-preserves-good`.

The current compatibility reader also requires the four M10-T05 publication-activation tests,
bringing the live suite to 50 exact identities. They cover exact activation reconciliation,
rejected publication identities, preservation of a different last-known-good revision, and
unavailable or closed server lifetimes. The frozen artifact and its 46-test historical receipt
remain unchanged; the live suite executes all 50 tests and rejects missing, duplicate, or
unexpected test identities.

The remaining exact test identities independently retain the raw Bundle-byte envelope, official
response media types, BOM rejection, bounded-body cleanup, hard-link rejection, fixed `/home`
deep-link serving, BFCache refresh, terminal disposal, and delivered-Bundle policy seam. The
sequence begins with valid A. Its exact response bytes and strong generation/revision ETag
become the last-known-good browser delivery. Invalid B then fails before authority: B does not
change the durable record, server delivery, response bytes, ETag, or mounted browser surface. A
fresh valid C subsequently commits with the correct previous-good lineage and atomically replaces
A. Closing and reopening the server must recover and authenticate the durable winner before the
first delivery is available.

Serialized refreshes and an explicit lifetime epoch fence stale work. A delayed older refresh
cannot overwrite a newer winner, and work completing after close cannot publish. HTTP failures,
invalid envelopes, and unavailable refresh results leave the browser's already mounted good
surface intact; the browser continues to delegate activation to the fixed reviewed host activator
instead of constructing a component tree from Bundle data.

## Deterministic and mutation-resistant evidence

The root proof owns 13 closed mutation-test classes: exact construction, two-build determinism,
all immutable prerequisites, runtime case identity, server boundary, browser boundary, installed
inventory guards, exact trace assignment, artifact bytes, atomic writing, hostile option capture,
unsafe filesystem authority, and recursive immutability/later-scope truth.

Authority reads are bounded, no-follow, single-link, canonical-parent reads with stable file
identity before and after acquisition. Distribution walks reject symbolic links, hard links,
special files, excessive files, and excessive bytes, then record every independently built file by
path, size, and digest. Structured override seams admit only inert own data and copied non-shared
byte views. The focused Vitest process uses the repository-local entry point, one worker, no cache
or file parallelism, bounded time/output, a private temporary config deleted in `finally`, and a
sanitized `NODE_PATH`. Failure summaries disclose only code-owned identities and bounded
size/digest metadata.

## Trace and coverage truth

M07-T11 owns only the exact `PIPE-009` trace row for receiving the immutable Bundle. The evidence
rejects either removal of that assignment or addition of M07-T11 to any other trace row.

The completed M07 chain proves the local Web reference host can consume the control-plane channel
without confusing mutable discovery with activation authority. Later scope stays explicit:

- P-12 remains `NOT_PROVEN` until M10-T07 proves product-level restart preservation in Desen App;
- N-041 remains `PLANNED` until M12-T05 closes the measured whole-system finite-limit profile;
- G07 remains open until I07-04 completes the separately tracked historical-reader cleanup; and
- the reference server deliberately does not implement or proxy the application
  `POST /api/sign-in` backend; deployment authentication integration remains outside M07-T11 and
  form submission fails closed as unavailable; and
- this proof makes no remote/multi-tenant/TLS, credential-lifecycle, signing, hostile-administrator
  tamper-resistance, independently anchored anti-rollback, automatic rollback, arbitrary package
  installation, real-browser performance, Android, iOS, or other native-host conformance claim.

## Reproduction

```bash
pnpm --filter @desen/reference-host-web-server build
pnpm --filter @desen/reference-host-web build
pnpm --filter @desen/reference-host-web-server typecheck
pnpm --filter @desen/reference-host-web typecheck
pnpm --filter @desen/reference-host-web-server test:channel
node scripts/generate-reference-host-web-channel-consumption-proof.mjs
node scripts/verify-reference-host-web-channel-consumption.mjs
node --test tests/reference-host-web-channel-consumption.test.mjs
```
