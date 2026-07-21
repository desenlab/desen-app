# Proof Demo Runbook

Status: Planned. Commands and artifact hashes will be filled by M10-T07 and M12-T08.

The final repeatable demonstration must:

1. Reset Desen App, bundle store, channel, and reference host to a known seed.
2. Build the sign-in source visually from an empty project.
3. Exercise pending, failure, and success fixtures in Run Mode.
4. Publish a deterministic bundle.
5. Activate it in the separately built reference host.
6. Change a label and layout property without changing host source code.
7. Publish and observe the new revision in the host.
8. Attempt invalid prop, event, slot, revision, and catalog-package cases.
9. Show that the previous valid revision remains active.
10. Build and publish the Store Map and Sortable Priority surfaces.
11. Produce proof artifacts and the final matrix from one command.

The runbook must work on a clean machine and must not require private credentials or production
services.
