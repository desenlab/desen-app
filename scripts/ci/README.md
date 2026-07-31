# Modular proof infrastructure

This directory contains the I07 migration layer. It is deliberately separate from the frozen
CI-01 runner while coverage and failure parity are measured.

## Trust layers

1. Frozen task artifacts preserve the exact task-time claim and nonclaim boundary.
2. `proof-reader-checkpoints.json` records reviewed live reader hardening without rewriting those
   artifacts.
3. `run-modular-quality-gate.mjs` imports the legacy runner's validated workload universe and
   changes scheduling only. It does not maintain a second command inventory.
4. `infrastructure-debt.json` gives every temporary migration structure a machine-checked removal
   owner, deadline, and scoped zero-reference rule.

The checkpoint is inert data. It cannot name an executable command or cause a verifier or test to
run. Executable ownership remains in reviewed source.

## I07-01 commands

```bash
node scripts/ci/verify-proof-reader-checkpoints.mjs
node --test scripts/ci/test/proof-reader-checkpoints.test.mjs
node scripts/ci/verify-infrastructure-debt.mjs
node --test scripts/ci/test/infrastructure-debt.test.mjs
node --test scripts/ci/test/modular-quality-gate.test.mjs
node scripts/ci/run-modular-quality-gate.mjs
```

The modular candidate is `SHADOW + EXHAUSTIVE` in I07-01. Every one of the legacy plan's global
steps and proof verifier/root-test pairs runs from fresh inputs. Candidate proof pairs may run with
concurrency two while the legacy result remains authoritative, but no changed-file filter, cached
proof success, generator, or evidence writer is admitted.

## Promotion boundary

The legacy gate remains authoritative until I07-02 records exact workload equality, exactly-once
coverage, matching outcomes, clean tracked-workspace parity, safe cancellation, shared-state
classification, and local plus hosted timing evidence. I07-03 may calculate `AFFECTED` plans only
in shadow; any unknown or ambiguous input expands to `EXHAUSTIVE`. I07-04 owns selector promotion
and G07-due reader cleanup; I07-05 owns eventual sequential-runner retirement.
