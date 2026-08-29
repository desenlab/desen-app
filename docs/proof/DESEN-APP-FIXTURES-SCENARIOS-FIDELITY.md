# Desen App fixtures, scenarios, and fidelity disclosure

Task: M09-T11

Status: DONE

P-08: NOT_PROVEN
P-09: PARTIAL
P-10: PARTIAL
S-001: TESTED
PF-025: OPEN
PF-028: CLOSED
PF-083: OPEN
PF-089: OPEN
M09-T12: NOT_PROVEN
M09-T13: NOT_PROVEN
M09-T14: NOT_PROVEN

Final artifact: `sha256:3f08980e687d48ba267f78c7d4dd1ae1eb59db5cc6bb3401d88705ee0416cc9d`

## Proven boundary

The controlled sign-in editor now prepares Catalog-declared scenarios as transient, props-only
preview overlays. The authored Source and its publishable preview remain unchanged, while the
selected scenario is bound to the exact current route, node, capability, Source revision, and
preview revision. The authored sentinel and every Catalog scenario have distinct identities;
unsupported scenario state or fixture overrides fail closed instead of being partially applied.

Run mode exposes one explicitly synthetic fixture context over the public testkit projection. The
selectable outcomes are exactly `success:user-1` and the declared `invalidCredentials` public
failure. Starting the real adapter action publishes a real Runtime pending lifecycle before an
explicit fixture settlement. Request input, password data, and executable host bindings never
enter fixture data, logs, or retained controller state. Integration and production contexts remain
visible but unavailable and call no real service.

Cleanup closes request admission synchronously, revokes pending transport, and prevents late
settlement. React StrictMode replay may reactivate only the same still-live controller; preview or
scenario replacement revokes the predecessor and binds a new controller to the new exact preview
identity. Design/Run changes preserve the active scenario and pending lifecycle because they do not
replace Source, Bundle, Runtime session, or fixture authority.

The App also discloses adapter fidelity in persistent App-owned chrome as one of `same`,
`equivalent`, `approximate`, or `undeclared`. Approximate adapters expose every declared
difference, while absent or invalid metadata fails conservatively to `undeclared`. The selected
reference sign-in surface reports the same production adapter path already authenticated by
M03-T09 and M09-T03. This closes the tested M09 slice of N-035 and S-001 without claiming pixel
identity for arbitrary adapters.

The compatibility closure retains one dedicated component drag handle, one global nested-layer
drop projection, stable row-midpoint hysteresis, coordinate-less last-admitted placement, panel-wide
component insertion, insert auto-selection, and the visible guarded Delete action. These are
App-owned authoring affordances and do not turn browser transfer bytes or managed-tree geometry
into mutation authority.

## Verification

- Exact immutable parents: M09-T10 Design/Run
  `sha256:bc5b7ffef0c39737882072f9340bcade86f084db8e7923fcb03aa7364d077334`,
  M03-T08 sign-in fixtures and host binding
  `sha256:b0413687bd907b71509db52d3e22b6eda5a4150509ac323bf51e5f8425f897e2`,
  and M03-T09 reference parity
  `sha256:6e350f2af71ac4e1f040afe7a3fcc3035de35b585f0121db6a2b35b4f3552a8a`.
- Focused App fixture/scenario/fidelity suite: 6 files, 86/86.
- Complete App suite: 19 files, 252/252.
- Independent deterministic proof and negative-mutation suite: 11/11.
- The 29,407-byte artifact binds 28 tracked files and is reproduced byte-for-byte from the current
  sources, focused tests, package wiring, fixtures, Catalog, Source, Bundle, and exact parents.
- The proof reader rejects scenario authority widening, fixture-input observation, missing cleanup
  revocation, static-pending substitution, enabled real contexts, incomplete approximate-fidelity
  disclosure, drag/drop compatibility regression, and report or parent drift.
- Append-only proof-reader sequence 50 advances exact predecessor
  `sha256:45ed64e604400f18b15b3b4ef44bc35634a6c1567b46174329ec36529168272e` to
  `sha256:6abea41064a05efe363df0f66d1e7d1b4923af08f819acf4c266b092985192a4` across 46 frozen
  artifacts and 92 current readers. The checkpoint, promotion, selector plus required-affected,
  ownership, and remaining touched-CI regression suites pass 73/73, 19/19, 56/56, 15/15, and
  127/127 respectively.
- Manual in-app browser inspection confirms the explicit Components target, dedicated grip,
  click-to-add path, immediate Delete control, and stable Layers gaps. Native drag automation was
  unavailable in the browser client and is not claimed.

## Explicit exclusions

M09-T11 does not provide durable save/open (M09-T12), node-linked diagnostic navigation or invalid
placeholders (M09-T13), control-plane publication or channel activation (M09-T14), or automated
real-browser/native-drag E2E (G09/M10). Scenario state and fixture overrides remain unsupported;
integration and production execution remain unavailable. P-08 remains `NOT_PROVEN`; P-09 and P-10
remain `PARTIAL`; N-036 remains `PLANNED` for its repository-wide audit owner. PF-025, PF-083, and
the non-blocking App profile finding PF-089 remain `OPEN`. No required-gate or hosted-CI result is
inferred from this local artifact.
