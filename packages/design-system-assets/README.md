# `@desen/design-system-assets`

This package is the platform-neutral T13 admission boundary for local design assets. It accepts
only bounded PNG/JPEG/WebP images, inert SVG icons and WOFF2 fonts. Admission checks the declared
media type against magic bytes, rejects active SVG/HTML content, absolute/traversal source names,
oversized decoded images and oversized fonts, then returns an opaque `desen-asset-<sha256>` handle.

The package never fetches a URL, creates a Blob URL, installs a `FontFace`, or executes an asset.
The App owns those browser concerns through its IndexedDB CAS adapter. Project records retain only
the inert `extensions["desen.asset"]` reference, so a missing asset remains a visible diagnostic
instead of silently falling back to a remote path or another file.

`createDesignSystemImagePresentation` provides the bounded `cover`/`contain`/`fill`/`none`/
`scale-down` fit modes and normalized crop rectangle used by later Inspector controls. It does not
accept arbitrary CSS. `@fontsource-variable/inter@5.3.0` is the bundled DESEN Neutral default; its
package metadata and included `LICENSE` are SIL Open Font License 1.1 (`OFL-1.1`).
