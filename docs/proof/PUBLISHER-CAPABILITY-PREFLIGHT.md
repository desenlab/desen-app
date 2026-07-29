# M06-T04 — Capability preflight proof

## Decision

M06-T04 is `PASS` for its bounded claim. The platform-neutral Publisher now consumes the exact
M06-T03 Source and Catalog authorities, prepares the existing Validator component and interaction
contracts, and rejects every statically knowable prop, slot, style, visual-state, event, command,
behavior-attachment, and behavior-conflict violation at `capability-contracts`. Any blocking
failure uses the closed M06-T01 shell and exposes no Source, Catalog set, selected package,
requirement alignment, dynamic obligation, partial value, or Bundle.

The stage remains package-private and nonterminal. It does not expose a public `publish` function
or emit a Bundle. M06-T05 owns resource and operation receiving contracts, dynamic binding
compatibility, and the explicit runtime obligations that cannot be decided from static Source data.

## Exact capability boundary

The preflight executes in this order:

1. M06-T03 completes unchanged, including raw Source ingress, phased Source validation, exact
   Catalog selection and integrity, namespace uniqueness, and category-aware static references.
2. The exact selected Catalog array is upgraded through the Validator's interaction-contract
   preparation authority. Unsafe component, behavior, event, command, or style schemas fail before
   Source capability values are observed.
3. The exact M06-T03 prepared Source is checked against those contracts for:
   - component props and Variant props;
   - component slots, cardinality, accepted child IDs or categories, styles, and visual states;
   - component events and statically known command names;
   - behavior props, slots, styles, visual states, and events;
   - behavior attachment and exclusive-channel conflict rules.
4. Only after the complete static contract result succeeds does the Publisher collect
   non-blocking deprecated-capability warnings.

The Publisher deliberately ignores the Validator's cloned output document and its dynamic
obligation projection. Success retains the exact M06-T03 Source, selected packages,
requirement-to-package indexes, and Catalog values; the Catalog array additionally carries the
Validator's private interaction-contract authority. The same Source and Catalog identities can be
reauthenticated, while clones, serialized values, casts, or reconstructed outer shells cannot
replace them.

## Static failure and warning semantics

Every blocking diagnostic is annotated with `capability-contracts` while retaining its original
Validator code, pointer, message, and available identity context. Static failures suppress all
deprecation discovery, and inherited M06-T03 failures pass through without stage remapping. A
failure structurally contains only `ok: false`, its stopped stage, and immutable diagnostics.

`run.desen.publisher/DEPRECATED_CAPABILITY` is a public, stable warning code. A warning is emitted
only when an exactly selected component, behavior, resource, or operation declares
`deprecated: true` or a string. `false` and absence do not warn. Each diagnostic points to the
exact Source `use` or operation field and carries the available document, surface, subject, and
capability identity.

The warning message is fixed Publisher text. Catalog-controlled deprecation prose and replacement
hints are never copied into diagnostics, and a replacement is never selected automatically.
Warnings are deterministic, sorted, deduplicated, deeply frozen, and non-blocking.

## Finite and hostile-data profile

M06-T04 shares the M06-T03 stopped-stage report limits:

| Budget                                               |     Limit |
| ---------------------------------------------------- | --------: |
| Diagnostics returned by one stopped preflight stage  |     1,024 |
| UTF-16 code units in one diagnostic JSON Pointer     |     4,096 |
| Aggregate diagnostic and identity-context code units | 1,048,576 |

Exact boundaries succeed. Crossing the count, pointer, or aggregate ceiling replaces the complete
report with one redacted
`run.desen.publisher/CAPABILITY_PREFLIGHT_LIMIT_EXCEEDED` error; warnings are never truncated into
a misleading partial report. Warning collection maintains its aggregate budget incrementally, so
a caller-lowered high-count profile does not introduce quadratic rescanning.

Optional Source and Catalog fields used by this boundary are read only from own data properties.
Inherited `deprecated`, node/behavior slots, behaviors, event maps, settlement handlers, and lower
stage discriminators cannot fabricate a capability use or success. The same hardening closes
inherited optional-field reads in the shared semantic and interaction walkers. The proof exercises
one inherited data property at a time; it does not make an impossible general claim that arbitrary
JavaScript Proxy or inherited accessor traps can be detected without observation.

## Pipeline ownership decision

DESEN publication step 8 is broader than the safe M06-T04 task boundary. This task completes the
component and interaction slice only. Pulling the cumulative execution validator into M06-T04
would also consume state, binding, action, resource, operation, and runtime-obligation work
assigned to M06-T05 and would make the task evidence misleading.

M06-T05 therefore depends on M06-T04 and closes the remaining resource/operation receiving-schema
slice together with dynamic compatibility and recorded runtime obligations. `PIPE-032` remains
partially complete until that task; M06-T11 will finally prove the composed public Publisher
rejects the complete invalid-source matrix without emitting a Bundle.

## Evidence method

The deterministic evidence runner authenticates:

- the exact M02-T08 component, M02-T09 interaction, M02-T13 diagnostic-vector, and M06-T03
  prerequisite artifacts;
- exact Source, Catalog, selected-package, and requirement-alignment identity preservation;
- public Validator parity for component prop, slot, style, event, command, behavior, attachment,
  schema-safety, and conflict failures;
- safe warnings for top-level and nested component, behavior-slot component, resource, and nested
  operation uses;
- fixed warning text, deprecation-prose redaction, no replacement selection, deterministic order,
  and explicit-false behavior;
- exact and exceeded finite-report boundaries with no truncation or partial authority;
- inherited optional-data and discriminator rejection;
- the immutable M05-T09 reference-host receipt still compares equal after admitting only the exact
  four-module, four-source Validator successor accumulated through M06-T04;
- package-root privacy, built-declaration privacy, exact static imports and production dependencies,
  plus AST rejection of enumerated direct platform identifiers, loader forms, ambient runtime
  declarations, TypeScript diagnostic suppressions, and triple-slash references;
- deterministic regeneration, proof-document pinning, atomic writes, and fifteen independent root
  proof/mutation cases.

The focused evidence contains 14 Publisher runtime cases, 20 compiler-negative cases, 32
Validator component cases, 49 Validator interaction cases, 4 diagnostic micro-vector cases, and
15 independent root proof/mutation cases. Thirty-three current files are byte-tracked.

## Evidence artifact

`docs/proof/artifacts/publisher-0.1.0-capability-preflight.json`

`sha256:c3fa32564cd8c4928132ca6877bcb3fa2ae379aa4ba6909f47ce7a2b2cc5a9e3`

## Scope limits

M06-T04 does not validate resource or operation input, output, public-error, policy, effect,
lifecycle, or settlement contracts. It does not discharge or expose dynamic prop, style, state,
predicate, formatting, repeat, action, resource, operation, or receiving-schema obligations.
Those remain M06-T05.

Extension and array-order preservation, source-node traceability, authoring removal, normalization,
Source digest, exact Bundle package pinning, Bundle validation, revision calculation, official
double-publish determinism, and the complete invalid-source matrix remain M06-T06 through M06-T11.

This task also makes no storage, network discovery, package download, activation, Desen App,
editor, rendering, native-runtime, signing, authenticity, npm-publication, or deployment claim.
The source audit is not a JavaScript sandbox and does not claim exhaustive detection of
intentionally obfuscated reflection, metaprogramming, or runtime code generation.
