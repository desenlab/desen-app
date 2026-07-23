# Reference Tokens and Synthetic Fixture Evidence

## Claim

M03-T07 adds two bounded foundations required by the remaining reference-catalog work:

- one target-specific Web token provider backed by a Design Tokens Community Group 2025.10
  reference document containing exactly 26 CSS-facing tokens; and
- framework-neutral, authoring-only synthetic operation and resource fixture infrastructure in
  `@desen/testkit`.

The token document remains host-owned data. DESEN `$token` references name values supplied by the
host; DESEN does not define a competing token storage format. The Web provider translates only the
reviewed reference inventory into the package's controlled CSS custom-property boundary. It does
not add CSS, DOM, or React semantics to the protocol or framework-neutral packages.

The fixture infrastructure stores inert, JSON-serializable preview outcomes for declared operation
and resource capabilities. It neither calls a service nor embeds an executable implementation.
Concrete sign-in success and failure fixtures, and their separate trusted host operation binding,
remain M03-T08.

## DTCG 2025.10 reference boundary

The reference token source follows the stable
[DTCG 2025.10 technical report](https://www.designtokens.org/tr/2025.10/). Its 26-token inventory
is version-pinned and reviewed as one reference input rather than exposed as a general token-file
parser.

The evidence must keep these boundaries explicit:

- every accepted reference token has one exact DESEN token identifier, one supported DTCG type and
  value, and one target-specific CSS custom-property name;
- missing, additional, duplicate, unsupported, or ambiguously mapped inventory entries fail
  explicitly instead of receiving a guessed value;
- emitted CSS token data is deterministic, detached from caller-owned objects, and immutable;
- CSS custom-property names and values remain inert strings and cannot introduce selectors,
  declarations outside the registered property, executable markup, or arbitrary stylesheet text;
- the 26-token inventory is sufficient for the current five reference components and their
  documented Web styling boundary; and
- literal style values remain valid because DESEN 0.1.0 prefers tokens but does not require every
  style value to be token-backed.

This task proves the exact reference document and the narrow Web conversion policy it exercises.
It does not claim complete implementation of every DTCG Format, Color, or Resolver feature,
general alias resolution, arbitrary extension handling, themes or modes, token-file discovery, or
compatibility with unreviewed token documents. The post-G03 standards audit remains responsible
for recording the supported DTCG subset, alias policy, type mapping, and unsupported features.

## Synthetic fixture boundary

`@desen/testkit` owns fixture construction because production packages must not acquire a testkit
runtime dependency. The `synthetic` context is an explicit caller classification, not a secret,
credential, or personal-data detector. Callers remain responsible for supplying reviewed
synthetic data; the repository-wide secret and personal-data audit remains M12-T04.

The infrastructure must:

- distinguish operation fixtures from resource fixtures, reject registrations placed in the wrong
  category, and reject one capability id reused across both categories;
- require every operation's public error array instead of silently treating an omitted declaration
  as empty;
- accept only inert JSON-compatible inputs and outcomes;
- copy accepted values so later caller mutation cannot change a registered fixture;
- return recursively immutable fixture records with deterministic identity and ordering;
- reject inputs beyond 64 nested levels or 20,000 traversed values by charging node slots before
  enqueue, preflight raw string and key bytes against the byte budget, and retain an exact
  post-serialization check rejecting more than 1,048,576 canonical UTF-8 bytes, all with stable
  `TypeError` failures;
- allow lookup only against factory-created snapshots and reject non-string lookup names before
  property access or coercion;
- reject executable values, accessors, symbols, non-finite numbers, cycles, unsupported object
  prototypes, and other values that cannot be represented as protocol data;
- provide no network, storage, clock, environment, credential, or host-authorization access; and
- remain usable by later authoring and proof layers without becoming part of a production runtime
  package graph.

The infrastructure is deliberately empty of product-specific sign-in records at M03-T07. It proves
that later fixtures can be represented safely; it does not prove the semantics, schema
compatibility, or host binding of a fixture that M03-T08 has not yet registered.

## Deterministic evidence expectations

The tracked proof is expected to require:

- the M03-T06 verifier and exact predecessor artifact to pass before cumulative M03-T07 evidence
  is built;
- byte-stable provenance for the version-pinned DTCG reference document and the complete
  26-token inventory;
- exact token-identifier, DTCG-type, CSS-property, and CSS-value mapping with collision,
  omission, addition, and mutation detection;
- deterministic output under irrelevant object insertion-order changes and repeated fresh
  construction;
- detached and recursively immutable token-provider output;
- focused positive and negative tests for every supported token value family and every rejected
  mapping shape;
- inert operation and resource fixture construction, deep-copy behavior, recursive immutability,
  JSON serialization, and invalid-value rejection;
- compiler-negative coverage for closed public TypeScript contracts;
- package-boundary checks proving that production packages do not depend on `@desen/testkit`;
- built-package and declaration-surface audits rather than source-only imports; and
- independent proof mutations that reject alternate inputs, path aliases, stale artifacts,
  prerequisite drift, and changes to the reviewed token or fixture inventories.

The artifact may record that the included fixture examples are intentionally synthetic. That
observation is not a repository-wide secret or personal-data audit.

## Evidence commands

```text
pnpm generate:reference-tokens-and-synthetic-fixtures
pnpm verify:reference-tokens-and-synthetic-fixtures
pnpm test:reference-tokens-and-synthetic-fixtures
```

Tracked artifact:

```text
docs/proof/artifacts/reference-tokens-and-synthetic-fixtures.json
```

The verifier reports the artifact SHA-256. `PROJECT-STATUS.md` records that value so this proof
document does not create a self-referential hash.

## Scope and honest non-claims

M03-T07 provides the exact reference-token input, its narrow Web CSS provider, and inert fixture
infrastructure. It does not complete G03 or advance a `P-*` claim.

In particular:

- concrete sign-in pending, success, and failure fixtures and the separate trusted host operation
  binding remain M03-T08;
- complete catalog-to-implementation parity remains M03-T09;
- the final immutable capability artifact and exact package tuple remain M03-T10;
- general DESEN `$token` lookup, fallback, receiving-schema validation, and deterministic runtime
  resolution remain M04-T03 and its later runtime proof;
- authoring scenarios, context labeling, editor integration, fixture exclusion from published
  bundles, and production-host fixture ignorance remain M06, M09, and M10 responsibilities;
- no production resource or operation implementation, authorization policy, network call, side
  effect, or integration-preview mode exists in this task; and
- no cross-platform token rendering or mobile runtime is claimed by a Web CSS provider.

M03-T07 supplies partial evidence toward `N-036` and `N-040` by constraining its own fixtures to
synthetic inert data. Both clauses remain incomplete until the later authoring, publication, host,
secret, and personal-data audits assigned in the normative coverage ledger have passed. This
document must not relabel either clause as fully tested.
