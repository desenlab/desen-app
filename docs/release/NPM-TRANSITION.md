# npm `desen` Transition Plan

## Recorded state on 2026-07-21

- Installable versions: `0.0.1`, `1.0.0-beta.0`, `1.0.0-beta.1`, `1.0.0-beta.2`
- Removed registry records that still cannot be reused: `1.0.0-draft`, `1.0.1-draft`,
  `1.0.2-draft`, `1.0.3-draft`, `1.0.0-draft.1` through `1.0.0-draft.32`,
  `1.0.0-draft.34`, and `1.0.9-draft`
- `latest`: `1.0.0-beta.1`
- `beta`: `1.0.0-beta.2`
- npm maintainer: `selmanay`
- Existing metadata points to the older `desenlabs/desen` repository and `@desenlabs/*`
  dependencies.

No registry mutation was performed during workspace preparation.

## Why the package is not deleted now

npm registry data is immutable. A previously used `package@version` can never be reused, and a
complete unpublish prevents republishing that package name for at least 24 hours. npm recommends
deprecation when deletion is not necessary. See the official
[npm unpublish policy](https://docs.npmjs.com/policies/unpublish/).

The registry's installable `versions` list is not the complete history. Release preparation must
also inspect the registry `time` keys so that removed versions are never selected again.

## New version and dist-tag policy

- The first DESEN 0.1.0-based public package line is `2.0.0-alpha.0`.
- Alpha and beta releases use only the `next` dist-tag.
- `latest` is reserved for a production-supported stable release. Passing G12 does not by itself
  authorize moving `latest`.
- The npm package version is independent from the supported DESEN protocol version. Every release
  publishes an explicit protocol and target compatibility matrix.
- The private workspace placeholder may carry `2.0.0-alpha.0`, but `private: true` remains in
  force until the approved staged release workflow runs.

## Release-time sequence

1. Re-read owners, installable versions, registry `time` keys, dependents, weekly downloads, and
   dist-tags.
2. Audit the old tarballs and package metadata.
3. Deprecate old prototype versions with an explicit migration message.
4. Verify that the approved source repository, homepage, issue URL, author, license, and supported
   engines are real and that no metadata points to `desenlabs/desen` or `@desenlabs/*`.
5. Produce the self-contained `desen` tarball and inspect its exact file and dependency list.
6. Install that tarball in a clean temporary project and test every declared subpath export. Test
   the CLI only after a real CLI and `bin` entry exist.
7. Submit `2.0.0-alpha.0` through the approved staged-publishing workflow under the `next` tag.
8. Verify trusted-publishing provenance, contents, clean installation, docs, and compatibility.
9. Keep `latest` unchanged until a separately approved production-supported stable release.
10. Never reuse an old version number or delete history merely for visual cleanliness.

## Intended public surface

The first public package is a facade and CLI with stable subpath exports. Internal package
separation does not imply immediate public `@desen/*` publication. The public tarball must embed
the compiled code needed by its facade exports and must not depend at runtime on private workspace
packages. A clean install must fail the release gate if any unpublished `@desen/*` dependency or
old `@desenlabs/*` dependency remains.

Do not declare a CLI `bin` until an executable CLI exists and its packed-tarball smoke test passes.
Repository, homepage, and issue metadata are added only after those destinations exist and can be
verified; placeholder URLs are prohibited.

Publishing must use OIDC trusted publishing, provenance, two-person or explicit human approval,
staged publishing, an explicit `next` tag, and a dry-run package-content audit. A generic
`changeset publish` command is not an approved release path. Long-lived npm automation tokens are
not permitted.
