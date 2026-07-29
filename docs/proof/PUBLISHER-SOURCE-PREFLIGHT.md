# M06-T03 — Source preflight proof

## Decision

M06-T03 is `PASS` for its bounded claim. The platform-neutral Publisher now composes strict raw
Source JSON ingress, exact Source-root validation, every embedded state schema, intrinsic identity
and entry semantics, M06-T02 Catalog authority, and category-aware static capability references
into one immutable package-private preflight result. Any rejection returns the M06-T01 closed
failure shell and exposes no Source, Catalog set, selected package, requirement alignment, partial
value, or Bundle.

This task does not expose an incomplete public `publish` function and does not emit a Bundle. It
changes no Proof Matrix claim, normative status, or gate status. M06-T04 owns prop, slot, style,
event, command, and behavior contracts next.

## Exact stopped-stage contract

The preflight executes these boundaries in causal order:

1. M06-T01 raw JSON ingress; failures remain at `json-parse`.
2. The exact frozen Source root schema; failures stop at `source-schema`.
3. Every embedded Draft 2020-12 state schema; failures stop at `embedded-schema`.
4. Exact requirement SemVer, entry existence, surface key/identity agreement, and the shared
   surface-local node/behavior identity namespace; failures stop at `source-semantics`.
5. M06-T02 exact Catalog package selection, Catalog structure and digest integrity, and one
   collision-free namespace; its `catalog-resolution`, `catalog-integrity`, and
   `namespace-conflicts` failures pass through unchanged.
6. Exact Source-to-Catalog relation and component, behavior, resource, and nested operation static
   references; failures stop at `source-semantics`.

Catalog candidate input remains completely unobserved through steps 1–4. This is a deliberate
security and diagnostic-precedence property: malformed Source data cannot trigger package
inspection, and a Source-local error cannot be hidden behind an unrelated missing Catalog.

Catalog-backed reference existence necessarily follows trusted Catalog preparation. When a
selected Catalog is itself malformed, inconsistent, or namespace-conflicting, that Catalog failure
wins because invalid authority cannot safely establish whether a capability exists or belongs to
the required category. A valid Catalog plus an unknown or wrong-category reference still reports
`UNKNOWN_CAPABILITY` at the exact Source pointer and retains Source identity context.

## Validator preparation seam

The Validator now provides one additive Source-foundation seam rather than forcing the Publisher
to infer phases from diagnostic messages or duplicate Source traversal rules:

- root and embedded-schema validation share the established generated structural authority;
- intrinsic Source semantics reuse the existing M02-T07 identity walker;
- the exact recursively frozen Source is authenticated by a module-private runtime registry;
- cloning, serialization, or a TypeScript cast cannot reproduce that authority; and
- static references accept only an exact Validator-authenticated Catalog set.

The runtime brand is not serialized into DESEN JSON. Existing structural and semantic Validator
APIs retain their established results and diagnostics; the focused legacy suite remains green.

## Nonterminal authority and atomic failure

Success contains the exact prepared Source, exact M06-T02 Catalog set, selected immutable package
tuples, and requirement-to-package indexes. It deliberately has no terminal `ok` discriminator and
no `bundle`. The Publisher package root and package export map do not expose this intermediate or
its function.

Every failure contains only `ok: false`, the stopped stage, and immutable diagnostics. The
Publisher never returns a parsed Source, trusted Catalog set, selected package, alignment array, or
Bundle alongside a failure. Repeated preflight of the same Source and Catalog observation produces
byte-identical inert JSON.

## Finite diagnostic profile

The task-owned report profile admits at most:

| Budget                                               |     Limit |
| ---------------------------------------------------- | --------: |
| Diagnostics returned by one stopped preflight stage  |     1,024 |
| UTF-16 code units in one diagnostic JSON Pointer     |     4,096 |
| Aggregate diagnostic and identity-context code units | 1,048,576 |

An over-budget report is replaced by one redacted
`run.desen.publisher/SOURCE_PREFLIGHT_LIMIT_EXCEEDED` diagnostic at the same stopped stage.
Accessor, missing, extra, non-enumerable, non-positive, non-integer, and revoked-Proxy limit
profiles fail before Source or candidate observation and never echo caller data.

The wrapper also applies these ceilings to otherwise unchanged T01 and T02 failures. Under-budget
failures preserve their exact object identity and bytes; only an over-budget inherited report is
replaced. The underlying strict JSON, structural, and Catalog profiles retain their independently
proved processing limits.

## Evidence method

The deterministic evidence runner authenticates:

- M02-T06 structural and embedded-schema validation;
- M02-T07 Source identity, exact Catalog relation, and static-reference semantics;
- M06-T01 strict ingress and the closed no-partial failure shell;
- M06-T02 exact Catalog resolution and trusted namespace;
- the current official-derived Source and current Web–React Catalog tuple;
- exact success, detachment, recursive immutability, alignment, and repeat determinism;
- root, embedded, intrinsic identity, and requirement-SemVer stopped-stage vectors;
- zero candidate observation before Source-local acceptance;
- unchanged M06-T02 resolution and integrity failures;
- category-aware static-reference rejection and its Catalog-authority precedence;
- explicit M06-T04 and M06-T05 scope fences;
- exact and exceeded diagnostic budgets;
- package-root privacy and platform-neutral production dependencies; and
- artifact mutation, phase-order mutation, reference-bypass mutation, partial leakage,
  documentation drift, and atomic-write attacks.

The focused Publisher suite contains 10 cases, including table-driven phase, capability-category,
and budget matrices. The Validator adds 4 Source-foundation cases, the compiler-negative suite has
16 cases, and the independent built-distribution suite has 10 proof/mutation cases.

## Evidence artifact

`docs/proof/artifacts/publisher-0.1.0-source-preflight.json`

`sha256:4c8324f87a2da70e2e6c9254b3fd8498a6546093891d008678c7e646e185457c`

## Scope limits

M06-T03 does not validate prop, slot, style, event, command, behavior-attachment, or behavior
conflict contracts; those remain M06-T04. It does not discharge dynamic bindings, state initial
compatibility, lexical references, predicates, repeat semantics, action contracts, or recorded
runtime obligations; those remain M06-T05.

Extension and array-order preservation, source-node traceability, authoring removal, normalization,
Source digest, exact Bundle package pinning, Bundle validation, revision calculation, official
double-publish determinism, and the complete invalid-source matrix remain M06-T06 through M06-T11.

This task also makes no storage, network discovery, package download, activation, Desen App,
editor, rendering, native-runtime, signing, authenticity, npm-publication, or deployment claim.
