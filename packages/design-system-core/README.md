# @desen/design-system-core

Platform-neutral editable-project and design-token contracts for DESEN authoring.

## Editable project

`admitEditableProjectRecord` admits the App-owned, versioned `desen.editable-project` envelope. The
current schema is exactly version `2` and retains:

- one structurally admitted canonical DESEN `Source`;
- ordered inert DTCG token documents;
- historical inert recipe metadata and asset metadata without byte-loading authority;
- a required `designSystem.recipeGraph` for bounded reusable definitions and linked instances; and
- draft connection-intent notes that cannot execute, bind a host, or block design admission.

The envelope is not part of frozen DESEN Protocol `0.1.0`. `migrateEditableProjectRecord` uses a
closed migration registry: exact version 1 converts to version 2 by changing `schemaVersion` and
adding an empty graph. It preserves Source, legacy recipes, tokens, assets, draft intents and
extensions without promoting inert metadata into graph semantics. Its two structured changes and
empty losses describe that conversion; version 2 reports an identity path with no changes. Unknown
versions and malformed envelopes reject without partial output. Direct admission accepts only
version 2; `EditableProjectRecordV1` remains the exact historical type for migration callers.

Successful records are detached and recursively immutable. Safe inert capture precedes version
dispatch, including for future formats. Graph admission validates authoring relationships against
ordinary Source before admitting the complete project. Token documents in a project are preserved
as safe JSON; selecting one for computation
requires separate DTCG admission and never silently strips an unsupported feature.

## Recipe and aggregate-history foundation

The V2 graph stores named definitions, stable nested occurrences, explicit prop/style overrides,
and complete conceptual-owner-to-Source mappings. Admission expands even unused definitions and
requires every linked instance to reproduce its stored ordinary Source subtree, owned state and
resource declarations, and exact definition/materialization digests. Qualified occurrence paths
preserve identities across slot reordering; cycles, missing owners, stale mappings, overlapping
instances and finite-limit overflow reject without a partial record. Instance-owned operation
aliases cannot also be declared outside that instance on the same surface; external reads remain
ordinary wiring. The internal materializer is not a public mutation or publication API.

`createEditableProjectHistory`, `recordEditableProjectHistory`, `undoEditableProjectHistory` and
`redoEditableProjectHistory` retain complete immutable projects, including metadata-only changes.
A canonical no-op preserves redo; foreign project identities and forged history objects reject.
The default is 100 history entries, bounded to 512 entries and 64 MiB of retained canonical project
data. These helpers do not provide Catalog validation, preview admission, persistence or App
integration. The application must validate a complete candidate before publishing any transition.

`prepareEditableProjectRecipeTransaction` accepts an exact observed project digest, a data-only
command and explicit trusted Catalog data. Commands create/capture/update/delete masters and
insert/override/reset/detach/delete instances. `getEditableProjectMasterDefinitionDigest` supplies
the transitive identity required by a master update. Every resulting definition and the complete
Source must satisfy the captured Catalog contracts; stale identities, conflicting structural edits
and surviving references to removed targets reject without partial output. Dynamic host obligations
remain later work. The App must still preflight Publisher and recheck the observed project before
committing, previewing or saving this immutable candidate.

The `source.apply` command reconciles ordinary visual prop/style edits into explicit, occurrence-
scoped overrides. It preserves literal data, inverts only supported local binding references and
requires the final materialization to equal the requested Source. Intact same-surface moves retain
relationships; a complete instance deletion removes its owned declarations only when surviving
wiring remains valid. Structural edits, inherited-field removal, declaration rewrites and implicit
cross-surface detachment reject. Edit the master, reset an override or explicitly detach instead.
Fresh-ID copies remain ordinary detached Source; this command never invents a new relationship.

`validateEditableProjectRecipeContracts` provides the equivalent read-only contract admission for
opening a stored project: it checks the entire Source and every definition, including unused
masters. A valid envelope alone cannot authorize a foreign capability hidden in an unused master.
Successful validation does not repair or rewrite stored Source and does not grant profile,
Publisher, persistence, or Runtime authority.

`createEditableProjectMasterDraft` projects one master onto an isolated ordinary-Source editing
surface. Parent-owned node and binding IDs retain their definition-local identities; nested
occurrences stay linked, including behavior slots and occurrence-root aliases. The projection
starts from definition defaults, never a selected instance's overrides. Existing visual Source
commands can edit it, with nested edits becoming occurrence overrides or explicit detach.
`prepareEditableProjectMasterDraftUpdate` authenticates the draft, original whole-project digest
and Catalog identity, rejects changes outside the selected composition, and prepares one ordinary
`master.update` transaction. Unused state/resources survive; recursive nesting and conflicting
instance overrides reject without changing either input. The App must isolate the draft from
Save/Run/navigation, provide its own preview/history, and preflight before applying the complete
result. This Core boundary alone is not a normal-App master-edit UI or persistence claim.

Capture preserves ordinary Source exactly, including legal equal-spelling identities in separate
node/state/resource/operation namespaces. Existing managed descendants become nested occurrences
with qualified identity mappings, not flattened copies. Unresolved external and cross-occurrence
binding scopes reject explicitly; extensions and literal strings are not scanned as executable
wiring. Capturing inside an existing managed region or inserting into managed structure requires
editing its master instead. A surface-root instance can be detached, but direct instance deletion
cannot leave a surface without a root. These core APIs do not yet claim normal-App UI integration.

## DTCG profile and resolution

The machine-readable `DESIGN_TOKEN_PROFILE` targets DTCG `2025.10` and resolves these exact types:

| Family     | Supported types                              |
| ---------- | -------------------------------------------- |
| color      | `color` in `srgb`                            |
| dimension  | `dimension` in `px` or `rem`                 |
| number     | `number`                                     |
| typography | `typography`                                 |
| border     | `border` with a supported named stroke style |
| shadow     | `shadow`                                     |
| motion     | `duration`, `cubicBezier`, `transition`      |

Modes and contexts are ordered external sources, not invented `$mode` members inside DTCG. A
resolution fully captures and structurally validates every selected source, overlays declarations
in caller order with later declarations winning, resolves whole-token aliases against the completed
overlay, then applies explicit literal overrides as the final layer. An untyped alias in the base
source may therefore infer its type from a target introduced by a later mode source; standalone
document admission still requires its own alias graph to close. Results include declaration origin
and alias provenance and are deterministic, detached, and deeply frozen.

```ts
import { resolveDesignTokens } from "@desen/design-system-core";

const result = resolveDesignTokens({
  sources: [
    { id: "base", document: baseTokens },
    { id: "dark", document: darkModeTokens },
  ],
});
```

The bounded profile rejects alias cycles, missing or type-changing aliases, source type changes,
duplicate sources or overrides, overflow, unsafe JavaScript containers, property-level aliases,
unsupported token types, wide-gamut color spaces, and unsupported complex stroke styles. A safely
captured unsupported document is returned only as rejection context; no partial token map is
authorized.

## Boundary

This package contains no React, DOM, browser, CSS, storage, network, persistence, renderer,
publisher, or runtime authority. App UI and theme authoring start in M10A-T03; project persistence,
asset import, connection execution, release packaging, and App integration remain separate
authorities. The project graph belongs to authoring; Publisher and Runtime consume ordinary Source
and do not depend on this package.

The historical SC-01 artifact remains the closed 26-token color/dimension interoperability proof.
The broader project profile here coexists with it and does not reinterpret or expand that evidence.
