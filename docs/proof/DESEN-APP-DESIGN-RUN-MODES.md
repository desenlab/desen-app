# Desen App Design and Run modes

Task: M09-T10

Status: DONE

P-08: NOT_PROVEN
P-09: PARTIAL
PF-025: OPEN
PF-028: OPEN
PF-083: OPEN
M09-T11: NOT_PROVEN
M09-T12: NOT_PROVEN
M09-T13: NOT_PROVEN
M09-T14: NOT_PROVEN

Final artifact: `sha256:bc5b7ffef0c39737882072f9340bcade86f084db8e7923fcb03aa7364d077334`

## Proven boundary

The controlled sign-in surface now exposes one accessible App-owned Design/Run control over the
same immutable `{ document, preview }` authoring session. The mode value is absent from the Runtime
mount-effect identity, so a toggle retains the same Source revision, Bundle revision, Runtime
session, managed capability subtree, and Runtime local state.

Design keeps exact adapter controls disabled, renders the App-owned selection overlay, and admits
selection and authoring callbacks. Run removes selection chrome, keeps the authoring and Inspector
views mounted but hidden, and rejects every retained authoring callback through the central
`isDesignMode()` boundary. The exact Email adapter event flows through public Runtime React and
Runtime Core, executes the Source `state.set` action, and rerenders the same managed subtree without
a remount or disposal.

The canvas host-port set remains fail-closed: navigation, operations, and resources are denied;
storage writes conflict; storage/token reads are missing; diagnostics, clock, context, and
environment stay bounded to their existing inert local implementations. The control uses a named
group, pressed-state buttons, focus recovery, and one live mode-safety status.

## Verification

- Exact immutable parents: M09-T03 real adapter canvas
  `sha256:8f89b237c20d80e83d96f17c31146d251c026977a4fff1ab1d0822e489c63151`,
  M09-T08 state/binding editor
  `sha256:b7298375cba4b82258d1c293ecb66c3ae6641408ae9f5753da121ac44fcf601a`,
  and M09-T09 event/action editor
  `sha256:0060ef39273ea36666f1701d5d3fa0f1610b95f40d88304ba980dcdc73cb29ab`.
- Focused App Design/Run suite: 2 files, 44/44.
- Complete App suite: 15 files, 210/210.
- Independent deterministic proof and negative-mutation suite: 10/10.
- The proof reader rejects mode union widening/removal, mode-dependent Runtime mounting, enabled
  Design controls, host-port widening, mode transitions that mutate the authoring session, missing
  Run guards, selection leakage, hidden-Inspector drift, and missing Run presentation.

## Explicit exclusions

M09-T10 does not provide fixtures or scenarios (M09-T11), durable save/open or persistence
(M09-T12), node-linked diagnostics navigation or invalid placeholders (M09-T13), control-plane
publication or channel activation (M09-T14), or real-browser E2E. P-09 is only `PARTIAL`: the
controlled `state.set` path is proven, while operation lifecycle remains with later owners. No
required-gate or hosted-CI result is inferred from this local artifact.
