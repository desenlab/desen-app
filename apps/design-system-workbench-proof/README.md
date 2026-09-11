# DESEN Design-System Workbench Proof

This package is the bounded browser harness for M10A-T03 theme and token authoring. It renders an
editable DESEN Neutral foundation against `@desen/design-system-authoring` and proves light/dark
selection, named theme and mode operations, literal-token and alias creation, exact sRGB channels,
unit-aware atomic typography with deterministic named-weight CSS projection, live preview,
undo/redo over the package-bounded in-memory history, and loss-aware import/export behavior. A
selected mode outside the frozen T02 preview profile is visibly blocked; the harness never
substitutes a partial or fallback preview for preserved unsupported data.

It is deliberately not Desen App integration. The bundle receipt rejects Desen App, Editor,
Publisher, Runtime, and starter-catalog modules so this proof cannot silently become a product
composition root or begin T04+ work.

Run the complete browser proof with:

```sh
pnpm --filter @desen/design-system-workbench-proof test:e2e
```

For manual inspection after dependencies are installed:

```sh
pnpm --filter @desen/design-system-workbench-proof dev
```

The manual workbench listens only on `127.0.0.1:4188`. The proof stores no data and performs no
network requests.
