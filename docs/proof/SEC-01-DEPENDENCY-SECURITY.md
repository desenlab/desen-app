# SEC-01 — Fastify and fast-uri security maintenance

## Scope

This explicitly authorized operational interlude precedes M10-T06. It changes only the
Fastify/fast-uri dependency inputs, their focused regression coverage, and exact current-reader
compatibility. M10-T06 remains `NOT_STARTED`; implementation-task totals, proof gates, protocol
semantics, editor behavior, production capabilities, and deployment authority do not advance.

| Dependency                    | Previous lock | SEC-01 lock |
| ----------------------------- | ------------- | ----------- |
| Fastify                       | 5.11.2        | 5.12.2      |
| fast-uri, Ajv/compiler branch | 3.1.5         | 3.1.7       |
| fast-uri, serializer branch   | 4.1.2         | 4.1.4       |

The lockfile changes only these three package records, their registry integrity values, and their
references. Both fast-uri major lines remain inside their parents' declared ranges; no forced
override, audit suppression, lifecycle-script grant, unrelated upgrade, or new direct dependency
is introduced. `pnpm install --frozen-lockfile --ignore-scripts` succeeds locally.

## Advisory review

The registry audit is supplemented with upstream disclosures because the current audit response
lags newer security releases:

- [Fastify 5.12.1](https://github.com/fastify/fastify/releases/tag/v5.12.1) fixes root-primitive
  coercion mismatch (`GHSA-w2qp-rph6-63g4`) and numeric proxy-hop trust
  (`GHSA-3m5p-2c4r-xxw2`).
- [Fastify 5.12.2](https://github.com/fastify/fastify/releases/tag/v5.12.2) additionally fixes
  `GHSA-9q9j-q6p8-xq58`, `GHSA-hwr6-493r-vm6h`, `GHSA-p68q-wchp-6fh7`, and
  `GHSA-667r-xxjv-c9mm`. Stopping at the earlier Dependabot proposal, 5.12.1, would not include
  these fixes.
- fast-uri's first patch covers `GHSA-5jgf-p345-68v8`, `GHSA-f65p-4m7j-42xc`,
  `GHSA-fph4-wmhf-6fwf`, and `GHSA-jqff-g426-hqxp` (host/scheme canonicalization and malformed
  IPv6 handling). The [3.1.7](https://github.com/fastify/fast-uri/releases/tag/v3.1.7) and
  [4.1.4](https://github.com/fastify/fast-uri/releases/tag/v4.1.4) releases also fix port authority
  injection (`GHSA-qw65-cvwx-89v3`) and malformed authority brackets
  (`GHSA-58mr-gqgx-xq4g`). The immediately preceding patches are therefore not sufficient.

The application's existing `trustProxy: false`, strict raw-body parsing, disabled Ajv coercion,
exact Host/origin validation, loopback-only listener, and bearer authentication remain unchanged.
These constraints limit exposure; they are not a reason to retain vulnerable dependencies.
fast-uri remains a schema-tooling dependency, not a new application URL-authorization API.

## Local evidence and limits

The 2026-09-05 `pnpm audit --prod --json` response reports zero advisories, down from ten
version-specific records across six advisory IDs. Official disclosures above cover six additional
advisory IDs not present in that response. The full audit still reports eleven development-only
records (six high, five moderate) in brace-expansion, js-yaml, nanoid, PostCSS, and Undici. Those
packages are outside this request; no global vulnerability-free or production-readiness claim is
made.

The installed-graph security suite passes 44/44 across six Fastify and six fast-uri advisory
families. It includes positive compatibility cases and explicit rejected hostile inputs. Retained
old-version probes reproduce the vulnerable behavior; these tests do not merely check a version
string. The complete control-plane suite passes 245/245, including the unchanged local API suite
16/16. Structural validation passes 63/63 and its generated validator verification retains the exact
761,360-byte output at `sha256:d608147be42cfcc683a4427212fe6714c6ff85fba07f031b61b418ddcba019cd`.

The M07-T06, M08-T08, and M10-T05 verifiers pass, and their root suites pass 17/17, 10/10, and
10/10. Checkpoint tests pass 101/101. Checkpoint 73 changes only their six current-reader receipts,
preserving all 59 frozen artifacts and sequences 1–72 at new head
`sha256:27166d8cca9e4ce8eadde335306070b404e1e8f28de3e36dd391430a7884d825`. The persistence
reader authenticates the exact current manifest before an exact inverse version projection; T05
authenticates the exact new lockfile before projecting only its historical receipt. Actual runtime
and independent Vite audits remain fresh. Vulnerable rollback and unrelated edits fail explicitly.

The normal build, lint, typecheck, boundary, formatting, and checkpoint baseline pass. Focused
ownership/selector contracts pass 118/118 while retaining the exact historical ownership sets.
The new test executes within the existing package-wide hosted workload, not through a separate
cached result. No workload, deadline, permission, or concurrency policy is relaxed.

Local evidence is not completion authority. The task-board `DONE` row remains a conditional
closure candidate until fresh `Quality gate` and `Browser E2E` pass on the exact unchanged final
pull-request head. Main must then pass its fresh exhaustive run. M10-T06 stays `NOT_STARTED`.
