# ADR 0019 — Redact private prose without rewriting technical evidence

Status: Accepted. AR-01 closure requires fresh hosted verification of its exact final PR head.

## Context

Historical App reader bridges captured a task board containing three social-post draft sections.
Base64 inside gzip is recoverable content, not redaction. The T01B transport was then embedded in
three successor transports. Removing the current Markdown sections did not remove these copies.
The user explicitly authorized cleaning the archives before the next product task, without
rewriting Git history.

The task board prose is not an input to the archived technical proof projections. Nevertheless,
changing the archives changes their transport identities, and frozen task artifacts name the old
identities. Quietly substituting new bytes under old receipts would invalidate the evidence model
in [ADR 0011](0011-modular-proof-infrastructure.md).

## Decision

AR-01 is an explicit, bounded privacy amendment, separate from implementation milestones:

- Authenticate each complete original transport before migration. Remove only the exact approved
  task-board span, recursively replace the three named nested transports, and version each
  transport profile as `redacted.v1`. Verify the exact new compressed bytes before writing.
- Preserve every other decoded file, all technical projections, path inventories, base commits,
  and successor declarations. Independently commit their ordered receipts and projections to a
  technical-authority digest. The remaining task-board bytes have a separate exact receipt.
- Keep all 57 existing frozen JSON artifacts and checkpoint entries 1–70 unchanged. Their old
  archive receipts describe historical evidence; they are never presented as current file hashes.
- Admit only the new transports in current readers. Re-run their technical verification and
  compare the complete projection with historical evidence, permitting only the explicitly named
  archive-summary and receipt amendments. Expose actual current receipts separately as
  `currentVerification`; preserve the historical artifact fields for compatibility.
- Require all four current bridge generators to pass their output through the same authenticated
  redaction before publication. A changed original or unrecognized output fails closed. No
  original-byte fallback is allowed in current verification.
- Add one independent AR-01 proof/root pair and one append-only checkpoint successor. Its report
  and artifact contain only technical metadata and hashes, never decoded private content.

The shared redaction leaf has no filesystem, App-reader, scheduler, or browser dependency. The
operational verifier reads current authorities through bounded identity-stable no-follow reads.
The semantic impact graph includes the affected App proof chain whenever AR-01 is selected. This
is selection authority, not a cross-pair execution dependency: AR-01 consumes authenticated bytes,
not another reader's PASS. Its verifier/root pair may run independently after the normal package
prefix, and the gate succeeds only after every selected fresh workload succeeds. No scheduler
policy changes or recursive App-reader execution are needed for this amendment.

## Verification and consequences

Migration checks exact original and new transports, the approved prose-span digest, unchanged
technical files/projections, and every nested current transport. Regression tests reject wrong
transport identities, altered technical content, generator drift, forged receipts, hostile or
mutable inputs, unsafe filesystem authority, and stale proof artifacts. Historical reader tests
retain their positive and mutation checks; seals do not substitute for fresh execution.

This adds no product capability and changes no protocol, public package, UI, task-progress total,
or proof-gate count. CI retains two workers, eleven barriers, the existing deadline, and fresh
execution of every selected workload. The current graph has 218 workloads and 104 proof pairs.

Git history is not rewritten. Old commits, existing clones, and previously downloaded archives
can still contain the original material; erasing those is not claimed or authorized. Current
verification does not reconstruct the original compressed archives or claim possession of their
bytes. Their receipts are retained only as historical provenance for the reviewed migration.

See [AR-01 evidence](../proof/HISTORICAL-ARCHIVE-REDACTION.md).
