# Editor Core Terminal Integration Proof

Status: DONE

Final artifact: `sha256:ded38f53d63626daddaa7c9448c3e2b49c5427b83ee102b8176662db27effe29`

## Claim

M08-T10 closes the framework-neutral editor-core milestone without adding a production helper or
public export. The proof authenticates every exact frozen M08-T01 through M08-T09 artifact plus the
M01-T05, M04-T16, and M04-T17 platform/JSON-trace authorities that jointly own P-18. It then copies
the exact emitted editor-core, protocol, and validator bytes into two independent temporary ESM
graphs. Neither graph resolves editor-core through the workspace module cache.

Each graph independently runs the same ordered 32-step transcript: the insert command; the three
structural commands; all fourteen content commands; all eight state/binding commands; and all six
event/action commands. Every successful step returns a fresh recursively frozen direct Source and
leaves the previous canonical Source unchanged. An exact identity ledger proves that insertion
adds only `sign-in.terminal`, deletion removes only the prepared
`sign-in.terminal-delete` subtree, and the other thirty transitions preserve the complete
node/behavior identity multiset. One interleaved missing-target structural command returns only a
controlled diagnostic, exposes no partial document, leaves the resume snapshot byte-exact, and is
followed by the next successful transition.

The terminal Source passes the frozen M08-T09 Catalog-bound validator with zero diagnostics and
retained dynamic obligations. An injected in-memory compare-and-set adapter exercises the M08-T08
port through generation-one save and detached open with exact canonical Source bytes. Two Sources
that differ only in root `authoring` keep the same protocol Source digest while receiving distinct
M08-T09 complete-document fingerprints. The two independent graphs produce detached but
byte-identical terminal Sources, identity ledgers, validation results, persistence receipts, and
callback-free JSON traces.

## Platform boundary

The proof parses all nine editor-core TypeScript source files, all nine emitted JavaScript files,
and all nine emitted declaration files with the TypeScript AST. Static module specifiers,
identifier references, dynamic imports, direct `eval`, and `Function` construction are inspected
without comment/string regex authority. The accepted graph has only relative, `@desen/protocol`,
and `@desen/validator` edges; it contains zero React/ReactDOM, DOM/browser, Node builtin/global,
CSS, dynamic-import, eval, or function-constructor authority. Runtime execution still trusts
Node.js, its ESM loader, and the process environment; this is not a hostile-JavaScript sandbox.

The complete terminal trace contains only JSON data. `JSON.stringify`/`JSON.parse` reproduces its
exact parsed value, and both sides produce byte-identical RFC 8785 canonical bytes and SHA-256
commitments. Together with the exact M01/M04 prerequisites, this supplies M08-T10's independent
editor-core half of P-18.

## Honest boundaries

This proof does not add or exercise a React renderer, component instance, DOM element, CSS output,
selection/viewport/undo policy, multi-user synchronization, concrete durable filesystem/database
adapter, network transport, or dynamic-obligation execution. Necessary JavaScript reflection may
still execute Proxy traps. The fixed editor limits remain canonical post-admission limits rather
than streaming or preallocation memory-DoS guarantees.

## Reproduction

```bash
pnpm --filter @desen/editor-core build
pnpm --filter @desen/editor-core test:terminal-integration
pnpm --filter @desen/editor-core test:public-package
node scripts/generate-editor-core-terminal-integration-proof.mjs
node scripts/verify-editor-core-terminal-integration.mjs
node --test tests/editor-core-terminal-integration.test.mjs
```
