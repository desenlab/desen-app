# M07-T04 — Surface, Capability, and Finite-Limit Preflight

M07-T04 is complete. Its deterministic artifact proves the exact pre-staging reference and
finite-profile boundary described here; it is deliberately not an activation or last-known-good
claim.

## Intended proven boundary

The built `@desen/control-plane-api` package accepts only the exact opaque
`BundlePackagePreflightAuthority` created by M07-T03. A forged, copied, cast, stale, or otherwise
unknown shape stops at `package-authority` before any Bundle, Catalog, package snapshot, or staging
authority is exposed. The API accepts no replacement Bundle or Catalog,
caller-selected limit, callback, loader, module name, filesystem location, or network source.

`preflightBundleReferences` reads the already authenticated private Bundle and selected Catalog
set, performs a bounded deterministic whole-Bundle scan, and asks the cumulative semantic
Validator to confirm the same Bundle/Catalog relation. A successful Validator result must be
canonically identical to the authenticated Bundle. A thrown, malformed, or byte-disagreeing
trusted result becomes one redacted `internal` rejection and never yields partial authority.
Execution-contract preparation and runtime-obligation retention deliberately remain M07-T06
staging work.

## Exact reference coverage

The bounded scan covers every surface and every statically declared reference that can affect
activation:

- the Bundle entry and every managed `navigate` target must select an existing surface;
- every node `use` must select a component capability in the authenticated selected Catalog set;
- every behavior attachment must select a behavior capability;
- every surface resource must select a resource capability;
- every `resource.refresh` must select a resource alias declared by that exact surface;
- every `operation.invoke` must select an operation capability;
- every declared component or behavior event must exist on its exact receiving contract;
- every `component.command` target must resolve to exactly one component node and the command must
  be declared by that node's component capability; and
- duplicate surface, node, and behavior identities remain explicit failures rather than
  first/last-wins guesses.

Unknown or wrong-category capability references never fall back to a placeholder, another
category, a similarly spelled identifier, dynamic discovery, or executable code. Traversal order,
failure stage, diagnostic code, and JSON Pointer are deterministic. The bounded local scan runs
before cumulative semantic validation. M07-T02 has already admitted only a bounded, immutable,
structurally valid Bundle graph, so M07-T04 neither reparses attacker bytes nor invents a second
structural parser. Nested predicates are recognized only through the protocol's closed operator,
exact two-field shape, and operator-specific arity; ordinary literal objects that merely contain
`op` and `args` remain values rather than being guessed into predicate accounting.

## Whole-activation finite profile

The immutable implementation-owned profile admits at most:

- 256 surfaces;
- 25,000 source nodes across a Bundle and 5,000 on one surface;
- 5,000 conservatively possible materialized nodes on one surface;
- zero-based source tree depth 64;
- 1,000 instances from one repeat declaration;
- 64 direct actions in one event or settlement program and 25,000 action occurrences overall;
- settlement depth 16;
- 64 predicate arguments, 64 predicate nodes in one expression, and 25,000 predicate-node
  occurrences overall;
- 25,000 surface, capability, event, command, and target reference occurrences.

The public 65-argument negative is structurally unreachable here: the 64-argument predicate ceiling
comes from the frozen Bundle schema and M07-T02 authenticates it before this function can run.
M07-T04 rechecks 64 as defense in depth. The 2 MiB complete Bundle ceiling, bounded JSON graph, and
immutable structural snapshot are likewise inherited from M07-T02. They remain part of cumulative
activation admission without inventing a structurally impossible M07-T04 bypass. Source-document
depth 64 is intentionally distinct from the runtime render-plan implementation's separate internal
depth budget.

Literal repeat arrays contribute their exact length. A dynamic repeat contributes its declared
effective limit, capped at 1,000. The materialized count is therefore a conservative admission
bound, not a claim that activation knows the eventual length of host resource or operation data.
Later runtime stages independently enforce the actual 5,000-node ceiling. Every overflow rejects;
nothing is truncated.

## Authority semantics

Only complete success returns a frozen `BundleReferencePreflightAuthority`. Its visible fields are
the exact protocol and revision, the fixed profile identity, and immutable per-surface audit
counts. It exposes no Bundle, Catalog, package artifact, prepared execution graph, runtime
obligation, runtime index, callback, staging operation, channel mutation, durable commit, active
pointer, or activation operation.

Package-private consumers authenticate exact object identity through a `WeakMap`. Private state
retains the exact predecessor authority, its authenticated Bundle snapshot, and immutable surface
metrics for later staging work. It does not create or retain M07-T06 execution indexes or runtime
obligations. Copying visible fields cannot create that authority.

## Executable evidence contract

The final generated artifact will pin:

- the exact M07-T03 authority prerequisite and the semantic, runtime-limit, diagnostic, and
  no-guess capability prerequisites that this boundary composes;
- the official two-surface sign-in Bundle result, including exact per-surface counts;
- forged-authority precedence and exact unknown-component, unknown-operation, and unknown-surface
  rejections;
- every focused runtime and compiler-negative case by exact registered name;
- source, built-distribution, public-export, package-script, root-command, aggregate-tail, and
  modular-CI receipts;
- deterministic regeneration, no-follow reads, bounded inert options, atomic writes, and hostile
  mutation rejection; and
- exact trace rows `PIPE-007`, `PIPE-014`, `R-008`, `R-123`, and `D-035`.

Twenty-two focused runtime cases give every public finite-profile field either an exact/one-over
boundary or an explicit executable dominance proof. Twelve compiler-negative cases close the
public authority and immutability boundary. Sixteen independent root cases protect the artifact,
prerequisites, source/distribution receipts, registrations, trace rows, runtime probe, test
inventory, filesystem reads, atomic writer, inert options, and nonclaims.

The official Bundle's expected audit is:

| Surface   | Source nodes | Conservative materialized nodes | Depth | Capability refs | Actions | Predicate nodes | Settlement depth |
| --------- | -----------: | ------------------------------: | ----: | --------------: | ------: | --------------: | ---------------: |
| `home`    |            2 |                               2 |     1 |               2 |       0 |               0 |                0 |
| `sign-in` |            6 |                               6 |     1 |               7 |       4 |               1 |                1 |

Artifact: `docs/proof/artifacts/control-plane-api-0.1.0-reference-preflight.json`

Final receipt: `sha256:29555326d51073c50937519d8706049ad17287079cc3ef4dc7060bb3a3225394`

## Explicit nonclaims

- M07-T05 still owns editable Source integration, immutable Bundle persistence integration,
  mutable channel pointers, and local transport behavior.
- M07-T06 still owns staged runtime indexes and active/staged state separation.
- M07-T07 through M07-T11 still own durable activation, last-known-good state, restart recovery,
  fault injection, concurrency, and separately built reference-host channel consumption.
- A successful M07-T04 result is preflight evidence only; it cannot stage, commit, activate, or
  notify a host.
- Dynamic repeat cardinality and runtime-resolved values are not predicted during static
  preflight; M07-T06 and the runtime retain their separately bounded responsibilities.
- P-12 remains `NOT_PROVEN`; N-038 and N-041 retain later owners and therefore remain `PLANNED`.
- M12-T05 still owns the final measured cross-system limit profile, and M12-T12 still owns packed
  external-consumer integrity.
- The current implementation supports the authenticated Web–React package profile; native targets
  require separately reviewed target packages and adapters.

## Reproduction after final registration

```sh
pnpm verify:control-plane-package-preflight
pnpm --filter @desen/control-plane-api... build
pnpm --filter @desen/control-plane-api typecheck
pnpm --filter @desen/control-plane-api test:reference-preflight
node scripts/generate-control-plane-reference-preflight-proof.mjs
node scripts/verify-control-plane-reference-preflight.mjs
node --test tests/control-plane-reference-preflight.test.mjs
```
