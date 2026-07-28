# SC-01: DESEN 0.1.0 and A2UI 0.9.1 comparison

## Outcome

DESEN and A2UI are complementary protocols, not interchangeable specifications.

A2UI 0.9.1 describes how a server or agent streams a declarative interface to a client and how
that client reports interactions. DESEN 0.1.0 describes how a human-authoritative design source is
validated, published as an immutable target-specific bundle, activated by a host, traced back to
its source, and rolled back safely.

SC-01 therefore selects **`continue`**:

- DESEN remains an independent protocol and M04 remains a DESEN runtime.
- No A2UI dependency enters `runtime-core`, the frozen protocol, or a public package API.
- A proof-only spike admits one deliberately narrow, structurally lossless static layout-and-text
  field projection so that the overlap is measured instead of assumed.
- Every non-equivalent field fails explicitly; the bridge never drops unsupported semantics.
- The decision must be reviewed again when A2UI 1.0 becomes stable or before any bridge becomes a
  supported public API.

The executable receipts are:

- `docs/proof/artifacts/sc-01-a2ui-bridge.json` —
  `sha256:2f927afee4ec50d8191fd2d44db93e35ff89f64856d0ae7bbc4be14193588902`;
  27 focused tests cover a deterministic 1,029-vector positive corpus, 1,029 exact round-trips in
  each direction, 1,029 DESEN Source and 2,058 A2UI message schema validations, and 34 stable
  rejection cases. The ordered positive-corpus receipt is
  `sha256:57b173a684633743c6ab1806e68b00f5b7143fed1f734c32bd7f5afedb7a614e`.
- `docs/proof/artifacts/sc-01-dtcg-compatibility.json` —
  `sha256:1df806e0b56d66e27558bbc2bb2f17e0e261b0103c90ed2658ad1eba4c3bdbc6`;
  20 focused tests preserve the immutable task-time receipt and cover its 26-token reference
  document, 14 unsupported feature families, 16 exact valid-but-unsupported fixtures, seven exact
  negative fixtures, proof-pin integrity, hostile inputs, symlinks, and atomic-copy safety. Current
  successor package bytes are owned independently by M05.

This checkpoint changes no `P-*` status. It proves a positioning and compatibility decision, not a
production runtime, publisher, activation system, or general interoperability layer.

## Version pins

### DESEN

| Item                        | Pin                                                                |
| --------------------------- | ------------------------------------------------------------------ |
| Protocol                    | DESEN 0.1.0                                                        |
| Upstream repository         | `https://github.com/desenlab/desen-protocol`                       |
| Upstream commit             | `b0bd7c4f0f61555b1d90e3a2ceb90d6e3d43daca`                         |
| Upstream tree               | `cd7afa57888095718c4ee82b69b5b282980763c8`                         |
| Snapshot aggregate SHA-256  | `afe8fc359465ce891f4325fcdeca4b2f12bca48f1aa54a34c4f3a97985f7e060` |
| Specification path          | `packages/protocol/upstream/0.1.0/snapshot/SPEC.md`                |
| Specification SHA-256       | `6443aed035cdced68e688402863ae3b7cc77f6dd75c8ad610831483d54b35d9c` |
| Source schema SHA-256       | `5ce5d541991940676ce0d3705e5b0658cd60f31025be8bfb96aec21a3116dba3` |
| Example Web Catalog SHA-256 | `7b9a8bad7b49340dc2a5f818ac008feb403fb43c8c476eecba5e1fcbdf3bf45d` |
| Catalog schema SHA-256      | `51014ab088b6a483502fd6aee5eed9fc4451be55556b6bd6220a5a6a1b610555` |

The local snapshot remains byte-for-byte frozen. SC-01 does not amend it.

### A2UI

The official site identified **v0.9.1** as the current production/stable release on
2026-07-24. A2UI 1.0 was still a candidate. Because the v0.9.1 page is explicitly a living
document, the comparison uses the source repository state below instead of relying on the moving
web page alone.

| Item                               | Pin                                                                |
| ---------------------------------- | ------------------------------------------------------------------ |
| Protocol                           | A2UI 0.9.1                                                         |
| Status on review date              | Current production/stable                                          |
| Official specification             | `https://a2ui.org/specification/v0.9.1-a2ui/`                      |
| Official repository                | `https://github.com/a2ui-project/a2ui`                             |
| Reviewed repository commit         | `d4723f29254520e1214d5004cb555d83eaafb828`                         |
| Commit timestamp                   | 2026-07-23T23:24:09Z                                               |
| `specification/v0_9_1` tree        | `c7bbfeea1e6d62b0f24af4c83231c2d9fd55aa89`                         |
| Protocol source path               | `specification/v0_9_1/docs/a2ui_protocol.md`                       |
| Protocol source SHA-256            | `1c120662ed0751d4e60ce0b8aea9ed94b568080272146cecf2defd6917284f5e` |
| Server-envelope schema SHA-256     | `2ba29dbcb57611225c96d3e064d05cf97e9d8224b293c8b20d37b93922a2d30d` |
| Common-types schema SHA-256        | `ac79788e95e5bdf0a39808953593a53c1bc9fcdcdb55480f4610613c6591e94c` |
| Client-envelope schema SHA-256     | `f049f8a554296a603cd3c1cef37dd6811006dc90e3ff52ce845d1674cd00a6b7` |
| Client-capabilities schema SHA-256 | `917ff302b883c8c50475f0fafa836c17620078e7e2089392b322dc5df01de78f` |
| Basic Catalog schema SHA-256       | `4c694b68ee51e0e5716add4bcfddafb6311089df07314832f27decaca319c0d3` |

Primary sources:

- [A2UI v0.9.1 protocol](https://a2ui.org/specification/v0.9.1-a2ui/)
- [A2UI roadmap](https://a2ui.org/roadmap/)
- [A2UI Catalog validation and graceful-degradation guidance](https://a2ui.org/catalogs/)
- [Pinned A2UI source tree](https://github.com/a2ui-project/a2ui/tree/d4723f29254520e1214d5004cb555d83eaafb828/specification/v0_9_1)

The repository has no `v0.9.1` Git tag at this checkpoint; only the immutable commit/tree is
claimed. The pinned v0.9.1 schemas deliberately retain `/v0_9/` schema identifiers and accept both
`v0.9` and `v0.9.1` envelope values. The Basic Catalog's own exact `catalogId` is
`https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json`, while the v0.9.1 prose examples
show a `/v0_9_1/` URL. The spike uses the schema's declared Catalog ID and exact `v0.9.1` envelope;
it does not invent alias equivalence between those two strings.

## Classification

| Class             | Meaning                                                                                  |
| ----------------- | ---------------------------------------------------------------------------------------- |
| `EQUIVALENT`      | The reviewed fields have the same observable meaning inside the stated subset.           |
| `LOSSLESS_SUBSET` | A strict subset of data fields can round-trip, but either protocol has additional forms. |
| `LOSSY`           | A translation can be written only by discarding or inventing information.                |
| `INCOMPATIBLE`    | The lifecycle or observable semantics conflict and must not be translated.               |
| `NOT_APPLICABLE`  | One protocol intentionally does not own this concern.                                    |

“Lossless” below means exact JSON structural field round-trip only. It does not mean visual,
accessibility-tree, HTML-element, native-widget, default-behavior, or renderer-semantic equality.
The spike rejects fields it cannot preserve and records renderer semantics as a separate unproven
boundary.

## Semantic comparison matrix

| Area                                      | DESEN 0.1.0                                                                                                                   | A2UI 0.9.1                                                                                                        | Class             | Bridge consequence                                                                                                                     |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Primary authority                         | A design source is the human-authoritative managed-surface definition (§§2.2, 5.1, 9.1).                                      | A server/agent generates and updates the client UI through a message stream (Introduction, protocol overview).    | `INCOMPATIBLE`    | Authority is never translated. The spike accepts only a fixed inert snapshot.                                                          |
| Primary lifecycle                         | Source → validate → publish → immutable Bundle → activate (§§6.3, 24, 25).                                                    | `createSurface` → component/data updates → optional `deleteSurface`.                                              | `INCOMPATIBLE`    | A2UI messages cannot stand in for DESEN publication or activation.                                                                     |
| Top-level artifact                        | Persistent Source, immutable Bundle, and Catalog are distinct normative artifacts (§6.1).                                     | Each JSON object is one framed stream message; Catalog schemas are agreed separately.                             | `LOSSY`           | Only a Source projection is admitted; Bundle and Catalog documents are rejected.                                                       |
| Transport                                 | Artifact transport is host/product policy rather than a wire protocol.                                                        | Ordered reliable delivery and message framing are part of the transport contract.                                 | `NOT_APPLICABLE`  | No A2UI transport enters the DESEN core.                                                                                               |
| Surface identity                          | A Source/Bundle contains named surfaces and one entry surface (§§12–13, 16).                                                  | A session surface is addressed by `surfaceId`, created and deleted over time.                                     | `LOSSLESS_SUBSET` | The spike requires one Source whose `id`, `entry`, surface map key, and surface `id` are equal.                                        |
| Root                                      | Any valid stable local node ID can identify a nested root (§§16.3, 17.8).                                                     | A flattened component set must contain the special component ID `root`.                                           | `LOSSLESS_SUBSET` | The spike requires the DESEN root ID to be exactly `root`.                                                                             |
| Tree representation                       | Nodes are nested through named, contract-checked slots (§17.3).                                                               | Components form a flat adjacency list through `ComponentId`/`ChildList`.                                          | `LOSSLESS_SUBSET` | Depth-first flattening and reconstruction are exact for the admitted Stack/Text tree.                                                  |
| Node identity                             | IDs are stable within the document and support source/runtime traceability (§17.8).                                           | Component IDs are unique references inside one surface.                                                           | `LOSSLESS_SUBSET` | IDs round-trip; no publication provenance is inferred from them.                                                                       |
| Catalog identity                          | A requirement includes `id`, SemVer, target and, in Bundles, exact package digest (§§8.2–8.5, 13.3).                          | `catalogId` is an agreed string; supported IDs/inline catalogs travel in transport metadata.                      | `LOSSY`           | The spike accepts one fixed DESEN Catalog requirement and the pinned A2UI Basic Catalog only.                                          |
| Catalog scope                             | Components, behaviors, operations, and resources share a checked namespace (§21).                                             | A Catalog defines components, registered functions, and theme shape.                                              | `LOSSY`           | Behaviors, operations, resources, and themes are rejected.                                                                             |
| Trusted lookup                            | The host resolves an exact target package tuple to trusted adapters (§§8.5, 22.4, 24.6).                                      | The client renders only components/functions from a supported Catalog.                                            | `LOSSLESS_SUBSET` | Both are allowlists, but A2UI `catalogId` is not treated as a DESEN package digest.                                                    |
| Native rendering                          | Target packages own real platform capabilities; portability does not promise one lowest-common-denominator UI (§§5.2, 5.8).   | Clients render declarative component descriptions with their native component libraries.                          | `EQUIVALENT`      | This shared strategy does not prove renderer, DOM, accessibility, or pixel parity.                                                     |
| Component contract                        | JSON Schema props plus slots, events, commands, style parts, visual states and authoring metadata (§21.2–21.8).               | Catalog JSON Schema defines component fields and structural child references.                                     | `LOSSLESS_SUBSET` | Only shared Stack/Column-or-Row and literal Text fields are admitted.                                                                  |
| Static layout fields                      | Reference Stack supplies vertical/horizontal direction and cross-axis alignment.                                              | Basic Catalog supplies Column/Row and matching `align` values.                                                    | `LOSSLESS_SUBSET` | Explicit direction and alignment fields round-trip; gap, max width, `justify`, and renderer defaults fail or remain outside the claim. |
| Static text fields                        | Reference Text accepts inert text and `body`/`heading`/`caption`; its Web adapter currently uses `h2` for heading.            | Basic Text accepts dynamic/simple-Markdown text and `body`, `caption`, `h1`–`h5`; `variant` is a base-style hint. | `LOSSLESS_SUBSET` | Plain literal data maps `body↔body`, `heading↔h2`, `caption↔caption`; equivalent heading/accessibility rendering is not claimed.       |
| Styling                                   | Token-aware base/state/style-part patches are public capability contracts (§18).                                              | The Basic Catalog exposes component hints and a small theme object.                                               | `LOSSY`           | All DESEN style, style-part, visual-state and token references are rejected.                                                           |
| Accessibility                             | Catalogs/adapters must preserve declared accessible semantics and observable behavior (§§18.5, 21.7, 23.1).                   | Common types expose label/description; broader first-class guidance remains on the roadmap.                       | `LOSSY`           | The spike carries no accessibility field and makes no general parity claim.                                                            |
| Literal binding                           | Literal JSON is one admitted DESEN ValueSpec form (§14).                                                                      | Dynamic types admit literal values.                                                                               | `EQUIVALENT`      | The spike uses only literal plain text and literal layout props.                                                                       |
| Data binding                              | Typed references cover state, context, resource, operation, event, item, environment and tokens (§14).                        | Dynamic values use JSON Pointer paths or registered function calls.                                               | `LOSSY`           | Every DESEN reference and every A2UI path/function value is rejected.                                                                  |
| Local state                               | State has a schema, inert initial value and controlled write actions (§§16.1, 20.1–20.2).                                     | The client owns a reactive data model that server messages and input bindings update.                             | `LOSSY`           | Non-empty state is rejected.                                                                                                           |
| State synchronization                     | DESEN defines observable runtime evaluation; network synchronization is host policy.                                          | `updateDataModel` and optional full-model action metadata define client/server convergence.                       | `NOT_APPLICABLE`  | A2UI data-model messages are outside the static bridge.                                                                                |
| State persistence                         | Source/Bundle state declarations persist; live-state persistence belongs to the host.                                         | The protocol defines session data updates, not durable persistence.                                               | `NOT_APPLICABLE`  | No persistence claim is transferred.                                                                                                   |
| Repeat                                    | Repeat has collection, item alias, key and stable instance rules (§17.6).                                                     | `ChildList` can instantiate a component template over a data path.                                                | `LOSSY`           | Repeat/template children are rejected.                                                                                                 |
| Predicates                                | A closed predicate language controls presence and variants (§15, §17.4).                                                      | Registered functions/checks evaluate bindings; structural change can also arrive from the server.                 | `LOSSY`           | Conditions, variants and checks are rejected.                                                                                          |
| Component event                           | Declared event payload schemas dispatch ordered closed action lists (§§17.7, 21.4).                                           | A component action sends one named server event or calls one local registered function.                           | `LOSSY`           | All events/actions are rejected by the static bridge.                                                                                  |
| Action language                           | Seven closed action forms cover state, navigation, operation, resource, command and event transitions (§20).                  | A server event or registered local `FunctionCall` is attached by the component Catalog.                           | `LOSSY`           | No action is guessed or collapsed into an A2UI function.                                                                               |
| Commands                                  | Capability-declared commands have schema-checked inputs and mounted-target rules (§§20.6, 21.5).                              | v0.9.1 has no equivalent general component-command contract.                                                      | `INCOMPATIBLE`    | Any command declaration or invocation fails.                                                                                           |
| Operations                                | Typed host operations define input/output/errors, lifecycle, concurrency and settlement actions (§§20.4, 22.1).               | Asynchronous work belongs to the agent/server and later UI/data messages.                                         | `INCOMPATIBLE`    | Operations are never encoded as A2UI actions.                                                                                          |
| Resources                                 | Typed resources define input/output/error contracts and mount/once/manual refresh policy (§§16.2, 20.5, 22.2).                | Media components and the data model do not define an equivalent resource lifecycle.                               | `INCOMPATIBLE`    | Non-empty resources fail.                                                                                                              |
| Arbitrary document code                   | Source and Bundle are data-only and cannot select arbitrary executable code (§§5.3, 27.2).                                    | Messages are declarative; named components/functions are implemented by the trusted client Catalog.               | `EQUIVALENT`      | The bridge remains data-only and contains no loader.                                                                                   |
| Host code boundary                        | Trusted capability code and host operations remain outside documents (§§22.4, 27.3, 27.7).                                    | Trusted renderers/functions remain client-side; the stream names only Catalog-defined forms.                      | `EQUIVALENT`      | No module, URL loader, handler or executable value is admitted.                                                                        |
| Structural validation                     | Exact frozen schemas validate Source, Bundle, Catalog and embedded schemas.                                                   | Modular JSON Schemas validate envelopes, common types and the selected Catalog.                                   | `LOSSLESS_SUBSET` | Both original and mapped values are checked against pinned shapes.                                                                     |
| Semantic validation                       | Cross-document references, capability contracts and lifecycle invariants have stable diagnostics (§§23.9, 26; Appendix B).    | A standard `VALIDATION_FAILED` response carries surface, pointer and message.                                     | `LOSSY`           | Bridge failures use separate stable spike codes; codes are not translated.                                                             |
| Unknown or unavailable runtime capability | An unknown/incompatible capability is an explicit failure; a runtime must not silently substitute behavior (§§24.7, 26).      | Catalog guidance permits a safe placeholder, text fallback, or skipping a node as graceful degradation.           | `INCOMPATIBLE`    | The spike accepts only its exact known component set and rejects every fallback case before conversion.                                |
| Resource limits                           | Hosts must enforce explicit byte/node/depth/repeat/predicate/action/settlement limits (§27.8).                                | v0.9.1 does not define an equivalent normative limit profile.                                                     | `INCOMPATIBLE`    | The bridge bounds its own input and never infers A2UI runtime safety.                                                                  |
| Protocol versioning                       | Protocol and package compatibility use SemVer and exact requirements (§30).                                                   | Every envelope carries a protocol-family version; v0.9.1 is a living current release.                             | `LOSSY`           | Only exact `0.1.0` ↔ `v0.9.1` is admitted by this spike.                                                                               |
| Canonical bytes                           | RFC 8785-compatible projections and SHA-256 define source, revision and package identity (§11).                               | v0.9.1 does not define canonical message bytes or content-addressed UI identity.                                  | `INCOMPATIBLE`    | No DESEN digest is derived from an A2UI stream.                                                                                        |
| Package identity                          | `{id, version, target, packageDigest}` identifies an immutable package (§8.5).                                                | `catalogId` identifies an agreed Catalog but does not attest package bytes.                                       | `INCOMPATIBLE`    | The bridge fixes both catalogs independently; it does not equate their identities.                                                     |
| Conformance                               | Seven explicit conformance targets partition producer, editor, publisher, package, runtimes and validator (§7).               | Schema-valid clients/servers/renderers implement the stream; broader certification is roadmap work.               | `LOSSY`           | Passing the spike is not A2UI renderer or DESEN runtime conformance.                                                                   |
| Publication                               | Deterministic normalization and validation either emit one Bundle or no Bundle (§25).                                         | Prompt/generate/validate sends live messages; no publication artifact is defined.                                 | `NOT_APPLICABLE`  | A2UI cannot replace M06.                                                                                                               |
| Activation                                | Integrity, package resolution and complete preflight precede an atomic active-revision swap (§24.1).                          | `createSurface` and updates affect a live session.                                                                | `INCOMPATIBLE`    | A2UI cannot replace M07 activation.                                                                                                    |
| Rollback / LKG                            | Failed activation preserves the last-known-good revision (§§5.7, 26.6).                                                       | No durable rollback or last-known-good protocol is defined.                                                       | `INCOMPATIBLE`    | No rollback claim crosses the bridge.                                                                                                  |
| Source-to-runtime trace                   | Derived artifacts retain stable node identity; diagnostics map to source (§§9.4, 17.8, 25.2).                                 | Actions identify a source component in the current surface, not an authoring/publication lineage.                 | `LOSSY`           | Component IDs round-trip, but publication provenance does not.                                                                         |
| Human authoring                           | Design/Run modes, schema controls, slots, scenarios and side-effect safety are normative editor concerns (§23).               | Prompt-first generation and tools such as Composer are ecosystem workflows, not equivalent source authority.      | `NOT_APPLICABLE`  | A2UI does not replace Desen App’s editor model.                                                                                        |
| Authoring-only data                       | Source `authoring` data is excluded from production Bundle identity (§§12.4, 13.4).                                           | No equivalent source-versus-production member split exists.                                                       | `NOT_APPLICABLE`  | Any `authoring` member is rejected.                                                                                                    |
| Cross-platform behavior                   | Target-specific Catalogs may differ; shared observable semantics are explicit and pixel equality is not promised (§§5.8, 32). | One declarative stream can target Web, Flutter and other native renderers, with renderer-specific presentation.   | `LOSSY`           | Static child order and role/variant field names round-trip, but cross-renderer observable semantics are not proven.                    |
| Compatibility negotiation                 | Exact protocol and Catalog requirements must be satisfied or fail (§§30.4–30.5).                                              | Supported Catalog IDs and optional inline Catalogs are exchanged through transport metadata.                      | `LOSSY`           | No automatic negotiation is added to DESEN.                                                                                            |

## Executable bridge boundary

The proof-only profile is named `SC01_STATIC_TEXT_V1`. It exists only under `scripts/`, `tests/`,
and the proof artifact. It is not a public package or an implementation commitment.

### Admitted DESEN Source

The encoder accepts a value only when all of these conditions hold:

1. `kind` is `desen.source` and `desen` is `0.1.0`.
2. There is one Catalog requirement:
   `com.example.web-catalog@1.0.0 / web-react`.
3. There is one surface, and Source `id`, `entry`, surface map key, and surface `id` are equal.
4. Surface `state` and `resources` are empty.
5. Root ID is exactly `root`.
6. Every node is either:
   - `com.example.ui/Stack`, with explicit `vertical` or `horizontal` and explicit shared `align`,
     no `gap` or `maxWidth`, and only the `default` slot; or
   - `com.example.ui/Text`, with safe literal plain text, explicit
     `body`/`heading`/`caption`, and no slot.
7. Authoring, bindings, styles, variants, conditions, repeat, behaviors, events, actions,
   extensions, operations, resources, tokens, commands, and executable selectors are absent or
   the exact fixed empty form required by the profile.
8. Inputs use ordinary JSON object/array shapes and stay within 256 components, a maximum node
   depth of 32 from the root (`root` depth is 0), and 4,096 UTF-16 code units per text value.

### Exact field mapping

| DESEN                           | A2UI                                                       |
| ------------------------------- | ---------------------------------------------------------- |
| Source/surface shared ID        | `createSurface.surfaceId` and `updateComponents.surfaceId` |
| Fixed DESEN Catalog requirement | Fixed pinned A2UI Basic Catalog ID                         |
| Vertical Stack                  | `Column`                                                   |
| Horizontal Stack                | `Row`                                                      |
| Stack `default` slot order      | A2UI `children` ID order                                   |
| Stack `align`                   | A2UI `align`                                               |
| Text                            | `Text`                                                     |
| `body`                          | `body`                                                     |
| `heading`                       | `h2`                                                       |
| `caption`                       | `caption`                                                  |
| Node ID                         | Component ID                                               |

The stream contains exactly `createSurface` followed by `updateComponents`. The decoder accepts
only that exact snapshot form. It does not accept a general A2UI session transcript.

### Round-trip rule

For every admitted DESEN Source:

```text
decode(encode(source)) === source
```

For every admitted A2UI stream:

```text
encode(decode(stream)) === stream
```

The bounded universal claim follows the admitted tree grammar: literal Text and empty Stack are the
base cases; an ordered Stack preserves the exact IDs and child order when each child subtree does;
and the inverse accepts only one rooted, reachable, acyclic tree with exactly one parent per
non-root node. All enum mappings are bijections over primitive strings, never caller-coerced keys.
The induction is finite at 256 components and maximum depth 32 from root depth 0.

The executable positive corpus makes those invariants concrete with Text-root, empty Stack, every
2 × 4 × 3 direction/alignment/role mapping, accepted depth and component limits, Unicode and
prototype-named IDs, and 1,000 deterministic trees generated with seed `20260724`. It records 1,029
exact round-trips in each direction and schema-validates all 1,029 Sources and all 2,058 A2UI
messages. Depth 33 and component 257 are rejected in both directions.

There is no intentional JSON field loss inside the admitted subset. A field that would be lost is
rejected before conversion. This is why the spike may be called a structurally lossless subset
bridge, but not renderer-semantic equivalence or general DESEN–A2UI interoperability.

The proof validates both A2UI messages against the exact pinned offline schemas and validates the
sample and decoded Sources against the frozen DESEN Source schema. It also validates the complete
frozen example Catalog against the frozen Catalog schema, verifies its checksum-ledger entries,
and checks the exact Stack/Text fields, enums, and defaults before applying the stricter bridge
profile.

## Rejected semantics

The negative matrix must keep at least these families explicit:

- more than one surface or Catalog;
- Source/surface identity that cannot round-trip;
- non-empty state or resources;
- authoring or non-empty extensions;
- non-Stack/Text capabilities;
- gap, maximum width, styles, tokens, style parts or visual states;
- bindings, data-model paths, functions, checks or dynamic children;
- conditions, variants, repeat or behavior attachments;
- events, actions, operations, navigation, refresh, commands or async settlement;
- A2UI theme, `sendDataModel`, data-model updates, deletion, accessibility additions or unknown
  fields;
- Markdown-bearing or otherwise non-profile text;
- duplicate/dangling component IDs, multiple parents, cycles or unreachable components; and
- exotic JavaScript objects/arrays, oversized component trees or oversized text; and
- any protocol version or Catalog ID other than the two exact pins.

## Decision impact

M04 may proceed unchanged after this checkpoint. It should implement the frozen DESEN runtime
semantics, not an A2UI renderer.

Any future supported bridge should be a separate adapter package after the end-to-end DESEN proof
exists. Before that package can be public it must:

- select and pin a then-current stable A2UI release;
- define a versioned bridge profile rather than silently widening this spike;
- validate both protocols with offline schemas;
- preserve unknown data or reject it;
- publish a complete loss and failure matrix;
- prove renderer and accessibility semantics separately from structural data round-trip;
- add resource limits and compatibility tests; and
- receive a new ADR if it changes runtime, Catalog, package, or activation ownership.

## Limitations

- The spike does not execute an A2UI renderer or transport.
- It does not prove heading semantics, default layout behavior, pixel, CSS, Markdown,
  accessibility-tree, HTML-element, or native-widget equality.
- It does not bridge the official DESEN sign-in surface because that surface intentionally uses
  state, bindings, operations, conditional presence, navigation, loading and error lifecycles.
- It does not prove that A2UI streams can be published as DESEN Bundles or activated with DESEN
  last-known-good guarantees.
- A2UI 1.0 was not stable at the review date and is not evaluated as the selected comparison
  target.

Checkpoint created: 2026-07-24. Immutable DTCG compatibility reader last verified: 2026-07-28.
