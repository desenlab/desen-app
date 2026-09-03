# Historical archive privacy amendment

Task: AR-01

This operational amendment removes three private social-post draft sections from the historical
task-board copy and every nested archive copy. It does not implement M10-T05, change the product,
or advance an implementation milestone or proof gate.

## Scope and preservation

The affected transports are the T01B, T01C, T02, and T03 historical App reader bridges under
`docs/proof/artifacts/`. Each original transport is authenticated in full before migration. The
T01B task-board redaction removes exactly three prose sections: 109 lines and 5,766 UTF-8 bytes.
Its remaining 193,102 bytes are authenticated independently at
`sha256:225873dc0e0dc0bf74be0a5ff52a291195cb38a324620eab31d441472c73f8d7`.

The other three archives replace only their named nested predecessor transport. All four change
their transport profile to the explicit `redacted.v1` version. Their 207 other decoded file entries,
all stored technical projections, path inventories, base commits, and successor declarations are
unchanged. The technical-authority digests commit the original ordered file receipts and complete
projections, excluding only the approved prose entry or named nested archive.

| Archive | Current compressed bytes | Current transport SHA-256                                          | Other file entries preserved |
| ------- | -----------------------: | ------------------------------------------------------------------ | ---------------------------: |
| T01B    |                1,822,971 | `8aa5c5a8b6d01c22dffbec93615f729680a0161046e9031583293e40c646ca59` |                           75 |
| T01C    |                2,304,433 | `35f7ae4c8717c1dbd8f06d07dc80329fb0fb2c7ff82435fa4c75d20018e8e441` |                           67 |
| T02     |                2,488,718 | `2682d586857a74d887c86b25aeeb804149e55db7c71e655077989c9630f9aaab` |                           24 |
| T03     |                2,766,770 | `7e992dbad2e371b937ef30c2406c12d05ee10ccb155f2a7177a67c3a2543e301` |                           41 |

All 57 existing frozen JSON artifacts and checkpoint entries 1–70 are preserved. Their historical
archive identities remain historical facts, not hashes of the redacted files now in the checkout.
The new independent artifact records both identities and the exact generator-code amendments.
Current App readers freshly verify technical inputs and expose actual current receipts in
`currentVerification`; complete comparison with historical evidence permits only the named
transport-summary and receipt changes. Existing mutation rejection remains active.

## Recurrence prevention

The four current bridge generators must call `redactHistoricalArchiveForPublication` before
writing any archive. That leaf accepts only each exact original transport as migration input,
performs the bounded redaction, and authenticates the exact final redacted transport. An unknown,
altered, or unsanitized candidate cannot be emitted through those generators. Current readers
accept only redacted transports, never either-old-or-new fallback authority.

Public reports and the AR-01 artifact contain only metadata, byte counts, digests, and technical
scope. They never serialize decoded archive files or removed prose. See
[ADR 0019](../adr/0019-historical-archive-privacy-amendment.md).

## Evidence and closure

Final artifact: `sha256:d0e40a1cabfa241a3232bde4c169836c18ebf6c76bebe3e5733ca02771fd5dcc`

Artifact: [`historical-archive-redaction.json`](artifacts/historical-archive-redaction.json),
33,070 bytes. Reproduce the archive proof with
`node scripts/verify-historical-archive-redaction.mjs` and its focused regression tests with
`node --test tests/historical-archive-redaction.test.mjs`.

The four affected App verifiers pass. Their existing 40 root tests pass with zero skipped or
cancelled cases, including fresh deterministic projections, actual current receipts, exact no-op
overrides, and unapproved source-byte mutations. The independent AR-01 suite passes 9/9, including
hostile/mutable inputs, same-size drift, unsafe filesystem authorities and acquisition races,
artifact/report drift, and atomic-write failures. An independent original-versus-current comparison
also verifies all 207 preserved file entries and unchanged technical projections.

All four original-to-redacted transformations match their exact final transport pins. The actual
current T01C/T02/T03 generator CLIs also reproduce byte-identical redacted archives in isolated
temporary outputs. T01B's shared redactor is exercised against its exact original transport; the
old detached-worktree proof-generation chain is not rerun or claimed as fresh execution here.

AR-01 adds one proof/root pair to required CI. Its semantic impact closure also selects the
affected App proof chain; it does not consume a prior reader's PASS or require serial cross-pair
execution. The gate must observe every selected fresh workload succeed. The graph becomes 218
workloads and 104 proof pairs without changing the two-worker limit, eleven
barriers, 18m30s exhaustive deadline, or fresh-execution requirement. Checkpoint 71 adds the AR-01
artifact/readers and reseals only the eight affected App readers, at
`sha256:c49ca6eacbc08f18ac6cd5bebb3d0a9c3d21a5b8fe420d92364416a210155bda`:
58 artifacts and 116 readers, with all previous entries preserved.

The six-command bounded local baseline passes: format, lint, typecheck, build, dependency
boundaries (854 modules, 3,644 edges, and 26 fixtures), and the current checkpoint verifier. This
is local feedback, not a new exhaustive run or hosted PASS. The CI contract tests pass 408/408
with no skipped cases: 355 changed/connected cases plus 53 boundary/threshold/debt cases. They
cover inventory, impact, ownership, checkpoint, selector, promotion, exhaustive/affected execution,
cancellation, and the retained manual rollback contract. The task board's `DONE` row is a
conditional closure candidate. Final closure
requires fresh hosted `Quality gate` and `Browser E2E` success for the exact final PR head; any new
commit invalidates an earlier result. Main receives a separate fresh exhaustive run after merge.

## Explicit limits

Git history is not rewritten. Prior commits, existing clones, previously published downloads,
and external copies are not erased. Original compressed archives are not reconstructed by normal
verification or represented as present-day authority; the migration's exact original receipts are
historical provenance only. Recovering old copies from Git history remains possible.

This proof does not execute Chromium, alter production behavior, remove technical test coverage,
or claim M10-T05, G10, public-alpha readiness, or a new hosted pass from local evidence.
