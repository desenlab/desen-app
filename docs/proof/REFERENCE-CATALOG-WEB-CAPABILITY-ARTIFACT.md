# Reference Web Capability Artifact Evidence

## Claim

M03-T10 builds one exact DESEN 0.1.0 Web–React capability artifact for the reference sign-in
slice. Its immutable identity is:

```text
run.desen.reference.sign-in@0.1.0
target: web-react
```

The published Catalog contains exactly the five real component registrations proved by M03-T09:
Stack, Text, TextField, Button, and Alert. It also contains the exact
`com.example.auth/signIn` operation registration, no behavior, and no resource. The Catalog uses a
Desen-owned package identity so it cannot be confused with either the complete frozen example
Catalog or M03-T09's proof-only scope identifier.

The resulting package identity is the exact:

```text
{ id, version, target, packageDigest }
```

tuple. The tuple and generated Catalog are data. They do not select a renderer, register React
components, or carry an operation handler.

## Real build inventory

The artifact uses every regular file emitted under `packages/reference-catalog-web/dist/**`.
JavaScript, source maps, declarations, and declaration maps are all included without extension
filtering or byte normalization. Package-relative paths are represented as lowercase portable
`dist/...` paths and enter the versioned Web–React digest profile beside its reserved canonical
`catalog.json` entry.

The proof snapshots the complete compiler input set once and builds it in two separately created
temporary mini-workspaces. Both preserve the real repository-relative source layout so source-map
bytes remain comparable. The two clean outputs must be byte-for-byte identical to one another and
to the checked workspace `dist/**` tree. Missing, extra, renamed, stale, symbolic-link, and
non-regular outputs fail instead of being silently ignored or deleted.

The pinned TypeScript executable is launched through the current Node executable without a shell,
global compiler, or `PATH` lookup. Temporary roots are proof-owned, are removed in `finally`, and
cannot redirect writes into the repository.

## Catalog and digest construction

The proof composes the placeholder Catalog through the built `createCatalogManifest` API and the
six authoritative registrations. The built validator must accept it structurally, semantically,
and as an execution Catalog set before digest construction.

`createWebReactPackageDigest` receives the placeholder Catalog and the exhaustive fresh build
inventory. The final Catalog replaces only its top-level placeholder with the calculated digest,
then `verifyWebReactPackageDigest` must reproduce the same value from the same inventory. An
independent frame reader and Node SHA-256 calculation verify the exact encoded entry paths,
contents, ordering, length boundaries, and final digest.

The generated `packages/reference-catalog-web/catalog.json` file must match the deterministic
published Catalog representation exactly. The digest profile canonicalizes the semantic Catalog,
so arbitrary JSON whitespace is not claimed to create a different digest; noncanonical on-disk
Catalog bytes are nevertheless rejected by the package verifier. Every tested semantic Catalog
mutation and every selected target-artifact byte, path, or inventory mutation changes the
calculated package digest or fails profile validation.

The calculated digest and final tuple are never embedded in a TypeScript or JavaScript output that
they fingerprint. They remain authoritative in the published Catalog and deterministic evidence
receipt, avoiding a second self-reference cycle.

## Evidence coverage

The proof verifies:

- the exact distinct Catalog identity, target, version, four capability maps, and self-digest;
- exact built-registration agreement with the already verified M03-T09 official-entry parity
  prerequisite;
- structural, semantic, Catalog-set, component, interaction, and execution Catalog acceptance;
- complete agreement with M03-T09 parity metadata and its separately delegated sign-in binding
  evidence;
- two independent clean builds plus byte-equality with the workspace distribution;
- exhaustive inventory and an independent parse of the versioned digest preimage;
- repeat calculation, artifact-order invariance, and exact tuple stability;
- byte mutations across every emitted file, plus add, remove, rename, and path mutations;
- valid Catalog identity, version, target, description, manifest, and inventory mutations;
- published self-digest tampering, unsafe paths, symbolic links, stale outputs, and artifact drift;
- root generate, verify, test, and complete quality-gate wiring; and
- atomic generated-Catalog and proof-artifact writes with substitution detection.

This evidence strengthens the content-addressed package portion of `C-016`, `C-021`, `PIPE-001`,
`R-009`, `R-013`, `R-018`, `R-021`, `R-030`, `R-082`, `R-125`, `R-136`, and `A-007`. It does not
rewrite the frozen trace ledger.

## Evidence commands

```text
pnpm generate:reference-catalog-web-capability-artifact
pnpm verify:reference-catalog-web-capability-artifact
pnpm test:reference-catalog-web-capability-artifact
```

Generated package Catalog:

```text
packages/reference-catalog-web/catalog.json
```

Tracked evidence:

```text
docs/proof/artifacts/reference-catalog-web-capability-artifact.json
```

The verifier reports the Catalog digest, exact tuple, inventory size, total target bytes, and proof
artifact SHA-256. `PROJECT-STATUS.md` records that final proof hash without introducing a
self-reference into this document.

## Boundaries

This is a deterministic logical capability artifact: projected canonical Catalog data plus every
real `dist/**` file and its exact path and bytes. It does not claim:

- a reproducible npm tarball, archive metadata, file modes, timestamps, or package-manager
  envelope;
- cryptographic authenticity, signing, public registry publication, or distributor retention;
- closure over the bytes of external React, protocol, or Catalog SDK dependencies;
- a runtime package registry, component lookup, render plan, event bridge, command dispatcher, or
  operation executor;
- Desen App or independently built reference-host consumption;
- package activation, compatibility selection, rollback, or last-known-good behavior; or
- native-platform parity.

Those responsibilities remain in M05–M12. `P-05`, `P-06`, and `P-10` therefore remain `PARTIAL`.
`N-010` and `N-011` remain `PLANNED` until distributor retention and activation behavior are
implemented. M03-T10 supplies the exact package prerequisite needed to close G03 without moving the
M05 React adapter registry earlier.
