# Desen App published host update

Task: M10-T05

Status: DONE

P-07: PROVEN

M10-T04 parent: `sha256:d9d841af06ec9efc51c3f1c74079f0aa4d5e1c7e996f3b97df7e277e4b1f8423`

M09-T14 parent: `sha256:6bd2db0ca490f1d0046f145da7c4b7e9b4b25ec0f8295a159529a0e66534b23b`

M05-T09 host audit: `sha256:cb54702266260a6e139950808b520bc139d35cebbde03ea93a187d2340a17e89`

M09-T03 App canvas: `sha256:8f89b237c20d80e83d96f17c31146d251c026977a4fff1ab1d0822e489c63151`

Historical bridge: `sha256:07c33e1086e6de68220b42af1bbf75a1be17978972d344bedba5ad5685dc8470`

Final artifact: `sha256:80c0b815a813ef462233b48a7fffe7c4d0bbf391aefc68eb9a6174da6bd84bd3`

## Scope closed

The normal Desen App product now saves, publishes, and activates two distinct authored Source
revisions through separate fixed loopback authorities. A visible Chromium journey creates a project,
authors a label and layout, publishes revision A, observes it in the separately built reference host,
then publishes revision B and observes the update after reload. The reference-host HTML, JavaScript,
and CSS build fingerprint remains byte-identical across both activations.

Authored Source cannot select the channel, host, endpoint, bearer, activation callback, server
implementation, or executable module. The launcher owns the fixed `preview` channel and
`reference-host-web` destination. Browser publication and server activation use distinct credentials,
omit cookies, bound requests and responses, and project only closed settlement shapes.

## Fresh source and build authority

The deterministic reader inventories every current Desen App, reference-host, and reference-host
server source file. It freshly compiles and audits the complete reference-host source/import policy,
then observes two independent Vite 8.1.5 `build({ write: false })` graphs for both applications.
The authenticated graphs contain 168 App modules with 510 static edges, 104 host modules with 299
static edges, no dynamic or unresolved edges, and 22 byte-identical transformed managed modules
shared by the App and host. No Vite output is written.

## Evidence

- `pnpm --filter @desen/app-web test:local-runtime`
- `pnpm --filter @desen/app-web test:product-bootstrap`
- `pnpm --filter @desen/app-web test:publication`
- `pnpm --filter @desen/reference-host-web-server test:channel`
- `pnpm --filter @desen/app-browser-e2e exec playwright test --config published-host-playwright.config.ts`
- `node scripts/generate-desen-app-published-host-update-proof.mjs`
- `node scripts/verify-desen-app-published-host-update.mjs`
- `node --test tests/desen-app-published-host-update.test.mjs`

The deterministic generator and verifier do not start Chromium, an HTTP listener, an application
server, or an external host. The Chromium journey remains an independently owned CI workload.

## Retained boundaries

This proof covers the local fixed-destination reference composition only. It does not claim remote or
production deployment, production credentials, multi-user persistence, invalid-publication
rejection, last-known-good recovery, or production operations. M10-T06, M10-T07, M10-T08, M10-T09,
N-036, P-12, and G10 remain open under their later owners.
