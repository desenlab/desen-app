# Runtime React Interactions Proof

## Result

M05-T04 proves that the Web–React renderer connects real component and behavior adapters to the
exact current headless session without granting render-time, stale, native, or lower-registry
authority. Before it creates a React element, the renderer compares every prepared component and
behavior identity with the authenticated session binding inventory in both directions. Missing,
extra, duplicated, mismatched, or foreign bindings fail as `RUNTIME_BINDING_MISMATCH` with no
adapter execution.

Each successful adapter receives a least-authority interaction port scoped to its exact session,
snapshot, runtime instance, and React commit lifetime. Component and behavior events enter the
existing schema-validating session dispatcher. A component may attach one opaque command owner to
its exact live binding; a behavior never receives that authority.

## Commit-scoped interaction authority

Rendering a React element does not attach a command or authorize an event. A private controller is
activated by a committed layout effect before trusted adapter passive effects. The following
lifetimes therefore remain explicitly unavailable:

- calls before the instance's first commit;
- server rendering;
- abandoned or suspended work that never commits;
- cleaned-up StrictMode simulation;
- an unmounted adapter.

After a commit has existed, an event or new command attachment made through a port whose exact
captured snapshot is no longer current is `rejected` fail-closed rather than classified as
commit-lifetime `unavailable`.

React provides no supported generic signal for detecting a render body caused solely by local
state inside an already committed trusted child. The adapter contract therefore prohibits
side-effecting interaction calls from render bodies; they may occur only in committed effects or
platform event callbacks. The statically reviewed reference adapters and their lifecycle tests
enforce that rule. This proof does not claim a hidden React-internals render-phase detector.

An admitted event contains only the captured session, snapshot, runtime identity, declared event
name, and inert JSON payload. The payload first crosses the bounded runtime JSON snapshot boundary,
then the controller rechecks the same commit epoch before session admission. Native React events,
DOM nodes, refs, Catalog objects, raw plans, and lower action-turn objects never cross the port.
The public completion always settles to `void`; it does not expose or upgrade to a later snapshot,
and lower rejection details remain contained.

## Component command ownership

The headless session creates a stable private command holder alongside each lower component
binding. React attachment changes only that holder; it does not unregister or re-register the
binding and therefore does not change its event ticket or registration generation.

Attachment requires an exact factory-authenticated session handle, current snapshot identity,
component runtime instance, and receiver-independent own-data callback. It returns an opaque
owner-bound generation. A newer owner atomically supersedes its predecessor, and stale cleanup
cannot detach the replacement. Binding replacement, navigation, unmount, and terminal session
disposal revoke surviving authority. An ordinary session snapshot publication that preserves the
same exact binding intentionally preserves its already attached command callback, even though new
events or attachments through the old snapshot-scoped React port are rejected.

The holder denies a call if the callback throws, returns a malformed value, reenters, is
superseded while running, or otherwise loses its exact binding authority. Forged, copied, foreign,
behavior-owned, stale, malformed, accessor-backed, Proxy, and already detached requests fail
closed without exposing the retained callback.

Both layers reduce revoked authorities to inert tombstones. Core clears the callback, binding,
lifetime, and session graph. React clears lower attachments, removes superseded entries from the
controller, and drops the current session/snapshot authority on cleanup. Retaining an old opaque
handle or interaction port therefore retains no live implementation closure or complete session.
Commit epochs are checked after hostile command/result reflection; an attachment created across an
unmount boundary is immediately detached and never returned.

## Static reference adapters

`@desen/reference-catalog-web/react-adapters` is an explicit executable subpath, separate from the
inert package root and Catalog data. It exports exactly five frozen registrations whose
implementations are statically imported:

1. Stack;
2. Text;
3. TextField;
4. Button; and
5. Alert.

Every adapter maps only declared, already validated fields. Stack alone maps the declared
`default` slot. No adapter spreads the runtime prop object, semantic style object, native event,
DOM attribute bag, selector, ref, or arbitrary React prop.

The exact reference Catalog declares one command: TextField `focus`. Its adapter retains only the
narrow private `TextFieldHandle`, attaches after commit, accepts exact empty input, rejects
disabled or stale instances, and detaches its exact opaque attachment on supersession, StrictMode
replay, and unmount. TextField `change` and Button `press` forward fresh frozen inert payloads.
Stack, Text, and Alert add no undeclared interactions. The reference Catalog declares no behavior
capability; generic runtime behavior event and no-command lifecycle are proven with a synthetic
Catalog-owned behavior fixture rather than falsely adding one to the package.

## Successor package identity

Adding the executable subpath changes the complete logical package inventory. The immutable M03
artifact and tuple remain unchanged historical evidence:

- M03-T10 artifact:
  `sha256:4ddeee8d33ff718e1907a6402b7c2d10ef0769c872832a4cb056231441ae65e0`
- historical package digest:
  `sha256:4ebfc6209d4874f3798009c72c634d2f65e60f8b59d4a517f269380a8cec6d9e`

M05-T04 owns the current exact successor tuple:

- id: `run.desen.reference.sign-in`
- version: `0.1.0`
- target: `web-react`
- package digest:
  `sha256:acdbbfe9ad4c1fce8093b0b68036bc7f5678e8b2a603357dbe25f2413a3db6f0`

The digest frames the projected Catalog plus every regular file under `dist/**`: 80 distribution
files, 81 framed entries including `catalog.json`, and 252,072 total framed bytes. Sorted
recursive inventory, two isolated interpretations, and the public calculation and verification
APIs reject omission, addition, byte mutation, path drift, symlinks, special files, and reuse of
the historical digest.

## Historical compatibility

The following prerequisites remain byte-identical:

- M03-T10 reference capability artifact:
  `sha256:4ddeee8d33ff718e1907a6402b7c2d10ef0769c872832a4cb056231441ae65e0`
- M04-T17 final G04 audit:
  `sha256:cd37e7721f7b89a983a92c405a4c7491cdaf84354a0ae0ab60adbdac815bb5fa`
- M05-T03 resolved semantic styles:
  `sha256:2b0e03e58116d161484cd3c309370ff1ee5003ee6158d4e941749faf0d6797eb`

M05-T04 transfers current ownership from every historical verifier whose task-time source or
package inventory changed. Each predecessor now authenticates only its exact artifact bytes,
reviewed semantics, and unique proof pins; it rejects successor source, runtime, build, or
prerequisite injection. Default historical writers preserve their committed bytes rather than
rebuilding old claims from current code. This immutable-reader boundary covers SC-01 DTCG,
M04-T06 local state and node identity, M04-T12 command/event actions, and M04-T15 reactive
reevaluation.

## Evidence coverage

Focused and cumulative tests cover:

- exact two-way component and behavior binding parity before React element creation;
- first commit, render-time denial, SSR, abandoned Suspense, StrictMode replay, and unmount;
- exact component and behavior event dispatch with inert payloads and a void completion;
- component-only command attachment, supersession, idempotent cleanup, and forged-owner rejection;
- binding replacement, navigation, disposal, reentry, throwing callbacks, malformed results, and
  hostile result reflection, tombstone retention, and lower ticket stability;
- the real TextField focus primitive and real Button/TextField event primitives;
- all five frozen static reference registrations and public subpath consumption;
- no arbitrary prop, style, DOM, native event, dynamic loader, or undeclared command leakage;
- compiler-negative opaque authority and inert JSON boundaries;
- deterministic successor package inventory and digest; and
- hostile proof options, artifact mutation, symlink paths, atomic writes, and exact proof pins.

N-034 advances to `TESTED` for the selected production Web–React profile. N-033 remains `TESTED`
with new concrete adapter evidence. No P-claim or proof gate changes at this task.

## Evidence artifact

`docs/proof/artifacts/runtime-react-0.1.0-interactions.json`
`sha256:9bb23cf55d5167300ef19aa6f250795f70c9c1bf500a3466d985f65f51f14ab0`.

The production verifier rejects a pending, moved, duplicated, or mismatched reference and requires
the same exact SHA in the M05-T04 Proof Matrix section.

## Nonclaims

This proof does not claim stable React reconciliation across changing snapshots, a runtime-to-
source diagnostic lookup API, committed adapter exception containment, concrete semantic style
application, host accessibility preservation, a separately built reference host, the complete
official-derived sign-in execution, a source/import audit, or a non-React implementation. Those
remain assigned to M05-T05 through M05-T09, M09, M11, and M12.
