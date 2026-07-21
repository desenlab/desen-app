# DESEN 0.1.0 Package Validation Report

Date: 2026-07-21  
Status: PASS

## Checks executed

- All three canonical schemas meta-validated as JSON Schema Draft 2020-12.
- All JSON files parsed successfully.
- The conformance manifest produced **14 passed, 0 failed** including public examples.
- Valid source, bundle, and catalog fixtures passed structural and semantic validation.
- Invalid vectors produced their expected stable diagnostic classes and codes.
- Sign-in `sourceDigest` reproduced from the source with top-level `authoring` removed.
- Sign-in bundle `revision` reproduced with top-level `revision` and `publication` removed.
- README-local Markdown links resolved.
- The Python reference validator compiled successfully.

## Covered negative vectors

- unknown closed-core field;
- duplicate node identity;
- unknown capability;
- unknown component event;
- bundle revision mismatch; and
- exact catalog package digest mismatch.

## Important limitation

This report proves package consistency and the included starter conformance behavior. It does not constitute a security certification, a production-runtime certification, or proof of interoperability between independent implementations. Those require the implementation evidence described in `ROADMAP.md`.
