# Frozen upstream baseline

This directory records and contains the exact DESEN 0.1.0 protocol baseline. `snapshot/` is the
complete 31-file Git tree from commit `b0bd7c4f0f61555b1d90e3a2ceb90d6e3d43daca` and tree
`cd7afa57888095718c4ee82b69b5b282980763c8`; only `.git` is absent.

The snapshot is opaque, checksum-enforced input. Do not edit, format, lint, or reinterpret its
files to make the implementation pass. Any implementation discovery belongs in
`docs/plan/PROTOCOL-FINDINGS.md`. A future protocol release receives a sibling version directory
instead of changing these bytes.

Run `pnpm verify:protocol-snapshot` from the workspace root to verify the pinned manifest hash,
all 30 manifest-owned files, the exact 31-file inventory, aggregate digest, and POSIX executable
modes. `pnpm test:protocol-snapshot` proves that byte changes, coordinated manifest tampering,
missing or extra files, symlinks, duplicate entries, and path traversal are rejected.
