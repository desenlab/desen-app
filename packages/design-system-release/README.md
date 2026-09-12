# `@desen/design-system-release`

Platform-neutral M10A-T04 contracts for turning an admitted design-system draft into an immutable,
content-addressed release. The package has no filesystem, browser, React, App, Publisher, or
Runtime dependency.

`createDesignSystemRelease` validates every production dependency, captures exact token/recipe JSON
and asset bytes, calculates one release digest from the finite dependency manifest, and returns a
recursively immutable snapshot. `createDesignSystemReleaseStore` is an exact-digest store port with
no mutable `latest` lookup. `readDesignSystemRelease` accepts only a host-profile reference that
names one exact release digest.

The release boundary is deliberately detached from editable theme drafts. A release never embeds
unreviewed metadata, loader paths, module names, network destinations, credentials, or executable
values. A host may propose a reference, but complete runtime activation remains a later M10A task.
