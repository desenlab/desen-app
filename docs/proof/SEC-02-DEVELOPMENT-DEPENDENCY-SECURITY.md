# SEC-02 — Development dependency security maintenance

## Scope and starting evidence

This explicitly authorized operational follow-up does not start M10-T06. SEC-01 closed in
[PR #78](https://github.com/desenlab/desen-app/pull/78); its merged revision passed
[main CI](https://github.com/desenlab/desen-app/actions/runs/33992215073).

The subsequent [Undici updater](https://github.com/desenlab/desen-app/actions/runs/33992223649)
and [PostCSS updater](https://github.com/desenlab/desen-app/actions/runs/33992222298) failed with
`security_update_not_possible`, not application-test failures. They reported latest-resolvable
7.28.0 / 8.5.20 versus first-fixed 7.29.0 / 8.5.23. Both dependencies are transitive: jsdom 29.1.1
declares Undici `^7.25.0` and Vite 8.1.5 declares PostCSS `^8.5.17`, so those ranges admit the
fixes. The updater reported no conflicting dependency. Its logs do not establish the precise
internal resolver failure; a missing-lockfile auditor message is not evidence that the repository
lacks its committed pnpm lockfile.

The 2026-09-06 full registry audit reports eleven development-only version-specific records in
Undici, PostCSS, brace-expansion, js-yaml, and nanoid. GitHub separately reports eight open alerts
in Undici, PostCSS, and js-yaml. Production audit findings remain separate from build/test-tool
findings; a clean production audit does not establish a vulnerability-free development graph.

## Corrective dependency update

| Dependency                         | Previous | SEC-02 |
| ---------------------------------- | -------- | ------ |
| Undici                             | 7.28.0   | 7.29.1 |
| PostCSS                            | 8.5.20   | 8.5.28 |
| js-yaml, Changesets reader         | 3.15.0   | 3.15.2 |
| js-yaml, schema/Changesets tooling | 4.3.0    | 4.3.2  |
| brace-expansion                    | 5.0.7    | 5.0.9  |
| nanoid                             | 3.3.16   | 3.3.18 |

The six package records remain inside their parents' declared ranges. There are no direct
manifest additions, major upgrades, forced overrides, advisory dismissals, audit suppressions,
build-script grants, or unrelated dependency updates. The exact 132,006-byte lockfile SHA-256 is
`0f968b0c6622f6bfe732d5ec9a2b6a49268e171a64fae6caf9501f6d25f8f074`.

In [pnpm 11.15.1's update implementation](https://github.com/pnpm/pnpm/blob/v11.15.1/pnpm11/installing/commands/src/update/index.ts),
transitive `updateMatching` is enabled only for selectors without a version suffix. The failed
PostCSS job ran `pnpm update postcss@8.5.28 --lockfile-only --no-save -r`, which does not enter that
transitive-update path. The local bare-name operation below updated PostCSS and the other tool
dependencies, but still left Undici unchanged; therefore it is not claimed as a complete automatic
remedy for every transitive case:

```bash
pnpm update -r undici postcss js-yaml brace-expansion nanoid --lockfile-only --no-save --ignore-scripts
```

Undici's one exact dependency-free package record and its references were separately advanced to
the official 7.29.1 registry integrity. `pnpm install --frozen-lockfile --ignore-scripts` then
accepted the full graph, including all 421 supply-chain policy checks. No package-manager guard
was bypassed. This resolves the vulnerable inputs in this repository; it does not modify or claim
to repair GitHub's upstream Dependabot implementation. Alerts and new jobs must be checked after
merge. Historical failed updater runs remain historical records and are not deleted or disguised
as passing runs.

## Upstream security review

Registry audit alone was insufficient. [Undici 7.29.1](https://github.com/nodejs/undici/releases/tag/v7.29.1)
contains additional security fixes after the alerts' first-fixed 7.29.0, including TLS callback,
WebSocket, shared-cache, decompression, and response-framing boundaries. The
[js-yaml 3.15.2 changelog](https://github.com/nodeca/js-yaml/blob/3.15.2/CHANGELOG.md) and
[4.3.2 changelog](https://github.com/nodeca/js-yaml/blob/4.3.2/CHANGELOG.md) additionally limit merge
sequence work, including empty mappings; the earlier audit-clearing patch is not the complete
current security maintenance release. PostCSS 8.5.28 stays in Vite's admitted maintenance range.
brace-expansion 5.0.9 covers both expansion-allocation advisories; nanoid 3.3.18 fixes the zero-size
custom-generator infinite loop.

## Verification status

The 2026-09-06 full registry audit reports zero advisories across 421 dependencies; the separate
production audit reports zero across 54 dependencies. This is a dated observation, not a guarantee
against future disclosures.

The existing orchestrator-contract suite passes 43/43, including 15 new installed-consumer tests.
Four ordinary compatibility cases also pass against retained vulnerable versions; all eleven
security-negative or mixed cases reject those versions. The regressions cover both js-yaml lines,
brace expansion output and intermediate work bounds, Nano ID zero-size completion, PostCSS map
containment, and Undici bounded decompression/recovery and atomic cookie rejection. Potentially
nonterminating probes run in killable 128 MiB / 5-second child processes, with tiny inputs and no
network. These are representative regressions, not reproductions of every Undici advisory.

The T05 verifier and root tests pass 10/10 with fresh Vite observations. Its exact frozen
189,123-byte artifact (`80c0b815a813ef462233b48a7fffe7c4d0bbf391aefc68eb9a6174da6bd84bd3`)
is unchanged: 168 App modules, 104 reference-host modules, and 22 shared managed modules.
No generated HTML, JavaScript, CSS, or observed graph identity is projected away. The current lock
receipt is authenticated before a separate historical receipt is compared. Prior SEC-01 lock,
individual vulnerable rollbacks, same-size drift, and unrelated dependency edits are rejected.

Checkpoint 74 preserves all 59 frozen artifacts and entries 1–73, resealing only readers 116/117.
Its SHA-256 is `da57d8ddad552e2d0ce5ebc7f990aa6d90c722f8af1ae3a31f4247d11a43e308`; checkpoint
tests pass 102/102. Current ownership is 1,449 tracked paths / 210 proof-owned paths, with exact
path-set hash `6fc4ae57156724abb4b42d88fb84e00d70ce15e2c6787e5850b079492d8bd828` and ownership
hash `c8836a58038204386135eadc7cba83453f95c03dde11ea98b70fba516360afce`. The added evidence
document is explicitly excluded only from historical inventory projection; it has a conservative
current owner. Independent predecessor checks retain the exact SEC-01 and I07-04 inventories.
The 220 workloads, 105 proof units, two workers, eleven barriers, and all execution limits remain
unchanged. Dependency changes select fresh exhaustive hosted validation.

Local typecheck, build, lint, dependency boundaries, checkpoint verification, and formatting pass.
The hosted-contract preflight passes 394/394, including unchanged required-affected execution
tests 47/47; fail-closed fallback, historical ownership, cancellation, and deadline guards remain
intact. The task-board `DONE` row is a conditional closure candidate after local evidence: fresh hosted
`Quality gate` and `Browser E2E` must pass on the exact unchanged final PR head before merge or a
completion report, followed by fresh main CI. M10-T06 stays `NOT_STARTED`.
