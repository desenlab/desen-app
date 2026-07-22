# Dependency-boundary fixtures

These fixtures prove that the architecture gate fails for representative forbidden imports and
continues to accept a documented dependency. They are intentionally outside `apps/` and
`packages/`, so the normal workspace cruise does not treat their violations as product code.

The fixture set includes a direct `catalog-sdk` → `runtime-react` edge so the platform-neutral
manifest boundary remains executable rather than documentation-only.

Run them after installing workspace dependencies:

```bash
node scripts/verify-boundary-fixtures.mjs
```

Adding or changing a boundary rule requires one fixture that would fail if that rule disappeared.
