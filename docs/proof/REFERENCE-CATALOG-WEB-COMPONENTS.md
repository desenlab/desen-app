# Reference Web Component Evidence

## Claim

M03-T05 implements the frozen DESEN 0.1.0 Web Catalog's foundational
`com.example.ui/Stack` and `com.example.ui/Text` capabilities as real Web–React components.

The tracked proof requires:

- both immutable manifests to equal the official Catalog example exactly;
- both public `propsSchema` objects to set `additionalProperties: false`;
- one composed two-component Catalog to pass structural, semantic, and component-set validation;
- one controlled Source to satisfy the exact Stack prop, default-slot, and Text prop contracts;
- an undeclared Stack prop and a missing required Text prop to fail at exact JSON Pointers;
- Stack to preserve DOM and reading order, emit no fabricated ARIA role or focus behavior, and map
  only the declared layout values;
- Text to use native `p`, `h2`, and `small` semantics and render markup-like input as an escaped
  text node;
- the component subpath, React peer boundary, declarations, documentation, focused tests, and
  compiler-negative cases to remain fixed; and
- an independent server-rendering oracle to exercise 56 pinned Text vectors and 420 Stack vectors
  crossing every enum/default value with four representative positive `maxWidth` values through
  the built public component package.

The verifier parses declaration and test sources through the TypeScript syntax tree instead of
counting text patterns. Production evidence accepts only own, plain, fixed-default options; any
explicit API, path, or prerequisite override is labeled `injected-test` and cannot verify or write
the tracked artifact. This keeps mutation tests useful without letting an injected renderer claim
production provenance. Component source audits close the reviewed top-level declaration inventory,
native JSX shape, and Stack style maps/calculation. The package audit permits only the reviewed
`types` and `import` component export conditions and rejects alternate browser mappings.

The proof uses the official example identifiers because the frozen sign-in Source and Bundle refer
to those exact capabilities. It does not introduce a Desen-specific alias that would make the
official fixture require translation.

## Component boundary

The public entry point is:

```text
@desen/reference-catalog-web/components
```

Catalog properties remain inert JSON and derive from each literal `propsSchema`. Stack's React
`children` are the target-specific representation of the declared `default` slot; their origin is
not enforced by the component itself, and `children` are not a Catalog prop. Text is a leaf
capability and has no React-child or raw-HTML surface.

The component manifests declare style parts, but M03-T05 does not claim the later adapter-parity
work. Applying resolved style parts without weakening accessibility remains assigned to M03-T09
and the React adapter layer remains assigned to M05.

## Accessibility interpretation

- Stack is a neutral `div`, because layout alone does not justify an ARIA landmark, group, or
  focus target.
- Stack never uses reverse flex directions or CSS ordering, so visual and assistive reading order
  follow the declared slot order.
- Text maps `body` to `p`, `heading` to `h2` beneath the host application's top-level heading, and
  `caption` to `small`.
- Text renders the required string through a React text node. It never parses HTML and never uses
  `dangerouslySetInnerHTML`.

Automated semantics and escaping checks are evidence for this narrow component surface; they are
not a universal accessibility certification. The 56 Text vectors cross every role/default with 14
pinned ordinary, empty, hostile, Unicode, and multiline samples. The 420 Stack vectors cross every
enum/default value with four positive width samples; exact source-shape checks cover the continuous
width behavior between samples. Full style/accessibility parity remains M03-T09.

## Evidence commands

```text
pnpm generate:reference-catalog-web-components
pnpm verify:reference-catalog-web-components
pnpm test:reference-catalog-web-components
```

Tracked artifact:

```text
docs/proof/artifacts/reference-catalog-web-components.json
```

The verifier reports the artifact SHA-256. `PROJECT-STATUS.md` records that value so this proof
document does not create a self-referential hash.

## Scope

This task supplies two real components and their exact contracts. It does not complete G03,
advance a `P-*` claim, or claim a final package tuple. M03-T06 now extends this prerequisite
through a separate cumulative proof for TextField, Button, and Alert. Tokens and fixtures remain
M03-T07/M03-T08; complete manifest/implementation parity remains M03-T09; and the immutable final
package inventory remains M03-T10.
