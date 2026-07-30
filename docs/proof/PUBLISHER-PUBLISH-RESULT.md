# M06-T01 — Publisher result and strict Source-ingress proof

## Decision

M06-T01 is `PASS` for its bounded contract claim. The platform-neutral Publisher now has one
closed terminal result: success contains a complete immutable Bundle and warnings, while failure
contains a non-empty error-first diagnostic report, identifies the first failed publication
stage, and structurally has no `bundle` member.

This task does not expose an unfinished `publish` function and does not emit a Bundle. It defines
and proves the boundary that M06-T02 through M06-T11 must use. No Proof Matrix `P-*` claim,
normative-coverage row, or proof gate changes status at this checkpoint.

## Terminal contract

`PublishResult` uses the frozen implementation guide's `ok` discriminator. A successful result
can carry only warning diagnostics and an `ImmutableJson<DesenBundle>`. A failed result derives
its public stage from the first blocking diagnostic, rejects empty or cross-stage error
collections, and cannot carry partial output.

Publisher severity remains separate from the frozen Appendix B diagnostic `classification`.
Core and Validator diagnostics retain their original code, classification, pointer, message, and
available identity context. The Publisher adds only its local stage and blocking category.
Diagnostics are detached, frozen, de-duplicated, and ordered by error before warning, normative
pipeline stage, pointer, code, context, and message.

At M06-T01 task time, the public package root exposes only the reviewed contract, stage
vocabulary, Publisher diagnostic registry, and finite Source-ingress limits through the built ESM
and declaration entries. The raw parser and its pre-schema value/result types remain
package-private, including through aliases, subpaths, and wildcard-export mutations. The
compatibility verifier later permits unrelated successor-module exports and diagnostic
definitions without rewriting this historical semantic slice; every such addition requires its
own later-task proof and is not covered by M06-T01.

## Strict raw Source boundary

The first package-private stage accepts a raw JSON string and rejects before schema validation or
hashing when it observes:

- malformed JSON or a non-string input;
- duplicate object member names after JSON escape decoding;
- unpaired Unicode surrogates;
- a numeric token whose parsed result is not finite; or
- any finite Source-ingress budget crossing.

The local profile permits at most 8,388,608 UTF-8 Source bytes, 256 container levels, 262,144 JSON
value occurrences, 4,194,304 aggregate decoded string code units, and 1,024 code units in one
number token. These are documented project limits, not universal DESEN constants.

Malformed and non-interoperable input emits
`run.desen.publisher/INVALID_SOURCE_JSON`; budget exhaustion emits
`run.desen.publisher/SOURCE_LIMIT_EXCEEDED`. Failures retain no parsed value, Bundle, Source
fragment, native parser message, stack, or cause. Successful pre-schema values are detached and
recursively frozen.

The scanner constructs JSON Pointer paths lazily so a long ancestor name with many siblings does
not repeatedly rebuild the complete path. Hostile limit profiles, accessors, `NaN`, infinity,
unexpected or missing keys, and revoked Proxies fail closed without invoking caller getters or
escaping a native exception.

## Evidence method

The deterministic proof authenticates the immutable G05 prerequisite and frozen protocol
snapshot, then checks C-011 and PIPE-025 ownership, the implementation guide, the earlier
canonicalization precondition, and PF-060. The G05 artifact remains byte-identical while M06-T01
also takes byte-level ownership of the four compatibility-reader paths that separate its
task-time receipt from a live current-host audit. It independently verifies:

The current M05 reader and root test must match either their exact task-time receipts or the exact
approved M07-T01 successor receipts. The builder then emits only the original M06-T01 receipt
projection, so this artifact and its SHA remain unchanged. M07-T01 separately pins the current
M06-T01 reader and root-test bytes, closing the updated-reader authority without rewriting
historical evidence.

1. the sixteen required Section 25.1 stages in exact order;
2. the two M06-T01 diagnostic definitions, registry immutability, lookup identity, and collision
   resistance;
3. the source and built declaration export slices plus the package root export map;
4. the platform-neutral dependency and production-source boundary;
5. valid detached parsing and controlled malformed, duplicate-name, Unicode, non-finite-number,
   and finite-limit rejection vectors; and
6. exact root command wiring, test inventory, artifact bytes, documentation pins, and atomic
   evidence writing.

The focused package suite has 13 runtime cases and 9 compiler-negative cases. Twelve independent
root proof and mutation cases cover deterministic double builds, artifact and documentation
tampering, stage/registry/limit drift, trace drift, partial-publication exports, declaration and
package-entry drift, platform dependencies, partial output, prerequisite and command drift,
forward-compatible future additions, derived test counts, symbolic-link destinations, and
pre-rename byte tampering.

## Scope limits

Catalog discovery and resolution, Source and embedded-schema validation, semantic and capability
preflight, dynamic binding obligations, extension and array-order preservation, authoring removal,
normalization, source digest, package pinning, Bundle validation, revision calculation, official
goldens, and the complete invalid-source matrix remain M06-T02 through M06-T11.

Optional signing and publication metadata retain M12 ownership. This evidence makes no storage,
network, activation, editor, Desen App, Web–React rendering, native-runtime, authenticity, npm
publication, or deployment claim.

## Evidence artifact

`docs/proof/artifacts/publisher-0.1.0-publish-result.json`
`sha256:aefed86741562bfa0f4bcbe163af50c8471dd6bf5979b7da36d681728536ff63`
