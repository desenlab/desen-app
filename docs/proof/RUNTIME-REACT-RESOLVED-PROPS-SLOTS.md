# Runtime React Resolved Props and Named Slots Proof

## Result

M05-T02 proves that the Web–React renderer accepts a render plan only through one exact live
headless-session snapshot and that session's exact factory-authenticated execution Catalog set.
Raw plans, copied or stale snapshots, forged sessions, lower-stage Catalog sets, and
structurally-equal Catalog copies fail closed before any adapter executes.

Successful session mount now returns the exact retained validated Catalog set outside the
JSON-only public snapshot. This keeps raw Catalog ingress usable by a real host without
revalidation guessing: the mount-returned reference authenticates, while a separately revalidated
but byte-equal Catalog set does not.

Every materialized component and behavior prop map is validated in `complete` and
`resolved-value` mode against its exact receiving capability schema. Required omissions, unknown
closed properties, type mismatches, and category mismatches return the validator's immutable
diagnostics with stable runtime-node, source-node, capability, channel, and JSON-pointer context.
Only the detached and recursively frozen successful value reaches an adapter; `$ref`, `$token`,
and `$format`-shaped resolved data remains inert and is never resolved a second time.

## Shared receiving budget

One factory-authenticated validation scope is created per render. Props and named slots for every
component and behavior monotonically consume the same bounded counters and prepared-schema
evaluation budget. The schema budget counts actual comparison and Catalog-controlled loop work,
including `uniqueItems`, `enum`, `required`, dependent, object, and array scans. Slot contracts and
acceptance sets are prepared once; required-slot, lookup, and child-acceptance work consumes a
separate shared lower-only counter. Repeating many individually valid calls cannot reset either
ceiling. A limit crossing produces one controlled receiving-limit failure and no partial adapter
execution.

## Named slots and adapter isolation

Named slots are projected from the authenticated, already-materialized public session plan.
Validation applies each component or behavior's declared slot contract to the final direct child
instances after `when` and `repeat` materialization. Exact slot names and child order are preserved;
the delivered map and every child array are frozen.

Adapters receive no raw render plan, behavior-plan collection, Catalog metadata, DOM node,
component instance, or private React structure. Components cannot inspect behavior props or style
through a side channel. Slot construction uses neither `props.children` guessing nor React element
introspection, and no missing or rejected slot is replaced with a fallback.

## Historical compatibility

The following task-time artifacts remain byte-identical:

- M02-T11 execution contracts:
  `sha256:f7dc050b8a9e4e5d9ec2531312ca3ad68d0d03c46bda5c44ebf930884554f505`
- M04-T17 / G04 audit hardening:
  `sha256:cd37e7721f7b89a983a92c405a4c7491cdaf84354a0ae0ab60adbdac815bb5fa`
- M05-T01 adapter registry:
  `sha256:b2e98f5e54471aa3ec227e672e2fa6b0f90a970b4c48046a0b8a8323f33b6b42`

M05-T02 owns current compatibility verification for every T01 path whose renderer contract changed.
It also records the narrow M02-T06 through M02-T13 verifier migration required by the validator's
new receiving scope, plus the corresponding M04-T06, M04-T16, and M04-T17 migrations required by
the new session authority. Those thirty-three generator, verifier, and root-test paths now validate
their immutable task-time receipts instead of rebuilding them from successor source. Together with
the two M05-T01 compatibility paths, the successor artifact inventories the SHA-256 of all
thirty-five migration paths. Historical artifacts continue to describe their task-time boundaries;
none is rebuilt from newer source bytes. The complete successor receipt authenticates 109 task
implementation, distribution, test, boundary, proof-code, CI-wiring, and compatibility files.

## Evidence artifact

`docs/proof/artifacts/runtime-react-0.1.0-resolved-props-slots.json`
`sha256:f668dc0d3d0e9e8edb239323fd82037b8afc2004dbe8eace56dcd4c510ed22e0`.

The production verifier accepts this SHA only in the exact section above and in the exact M05-T02
Proof Matrix section. Pending, moved, duplicated, indented, or mismatched references fail closed.

## Nonclaims

This proof does not claim post-resolution style-part validation, visual-state activation, live
event or command routing, concrete behavior lifecycle, React instance preservation, production
error-boundary UI, reference-host separation, or a non-React target. Those remain assigned to later
M05 tasks.
