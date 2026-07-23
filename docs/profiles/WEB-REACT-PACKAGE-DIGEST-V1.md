# Web–React Package Digest Profile v1

## Status and scope

This document defines the deterministic capability-package digest procedure used by the DESEN
reference implementation for the exact `web-react` target.

It is an implementation profile for DESEN 0.1.0 Section 11.4. It is not a universal DESEN archive
format, npm packing rule, signature format, or native-platform profile. A future native target must
use a separately identified profile so that equal file names on different targets cannot share a
package identity accidentally.

Profile identity:

```text
id      = desen.web-react.package-digest
version = 1
target  = web-react
```

## Inputs

The digest input contains:

1. one DESEN 0.1.0 Catalog whose exact target is `web-react`; and
2. zero or more exact target artifacts represented only by a portable path and `Uint8Array`
   content.

The profile can fingerprint an incomplete package. Adapter completeness, Catalog validity,
manifest-to-implementation parity, and the final reference package inventory are separate
M03-T09/M03-T10 checks.

No filesystem metadata enters the digest. In particular, the procedure does not read or normalize
timestamps, permissions, ownership, symlinks, directories, compression headers, npm metadata, or
host paths.

## Catalog self-reference projection

A final Catalog contains `packageDigest`, while the package digest must cover the Catalog. Hashing
the literal final Catalog would therefore be circular.

The v1 profile resolves that circularity with one explicit projection:

1. before framing, the top-level Catalog `packageDigest` is exactly
   `sha256:0000000000000000000000000000000000000000000000000000000000000000`;
2. every other Catalog member is unchanged;
3. the projected Catalog is encoded as RFC 8785-compatible canonical UTF-8 JSON; and
4. those bytes occupy the reserved `catalog.json` entry.

Calculation accepts only the placeholder form. Publication replaces the placeholder in the
external Catalog with the calculated digest. Verification snapshots the published Catalog,
projects only that field back to the placeholder, recalculates the digest, and requires exact
lowercase equality with the declared value.

Changing only a published Catalog's self-field does not define a second package. It makes that
Catalog fail verification. This is the Web–React reference decision recorded by `PF-026`, not an
unstated DESEN core rule.

## Artifact paths

Artifact paths:

- are relative lowercase ASCII;
- use `/` as the only separator;
- contain between 1 and 240 bytes;
- contain segments beginning and ending in `a-z` or `0-9`;
- may use `a-z`, `0-9`, `.`, `_`, and `-` inside a segment; and
- are unique by exact case-sensitive byte equality.

The profile rejects absolute paths, empty segments, `.`, `..`, backslashes, Unicode, NUL,
percent-encoded alternatives, trailing punctuation, Windows device names (`con`, `prn`, `aux`,
`nul`, `com1`–`com9`, and `lpt1`–`lpt9`, including extensions), duplicate paths, and
caller-supplied `catalog.json`.

Restricting the path alphabet avoids filesystem case-folding and Unicode-normalization ambiguity.
The path is an identity inside the digest profile; it does not authorize reading that path from a
filesystem or loading it as code.

## Canonical entry order

The projected `catalog.json` entry and all supplied artifacts are sorted by ascending path bytes.
Because the accepted path alphabet is ASCII, raw string, UTF-8 byte, and UTF-16 code-unit order are
identical.

Caller array order is not part of package identity. File path and content bytes are.

## Byte framing

All integers are unsigned and big-endian. The complete digest preimage is:

| Field                     | Encoding                                    |
| ------------------------- | ------------------------------------------- |
| profile magic             | ASCII `DESEN-WEB-REACT-PACKAGE-DIGEST-V1\n` |
| entry count               | `uint32be`                                  |
| each entry path length    | `uint16be`                                  |
| each entry path           | exact ASCII bytes                           |
| each entry content length | `uint32be`                                  |
| each entry content        | exact bytes                                 |

Length framing prevents ambiguity between paths, entry boundaries, and content. Text artifacts
receive no newline, Unicode, source-map, minification, or encoding normalization. A one-byte CRLF,
UTF-8 spelling, JavaScript, CSS, asset, or metadata change therefore changes the preimage.

## Digest

```text
packageDigest = "sha256:" + lowercase_hex(SHA-256(complete_framed_preimage))
```

Per-entry SHA-256 values exposed by the audit result explain drift; they are not a Merkle
substitute for the complete framed package digest.

The implementation uses the platform-neutral SHA-256 primitive already proved by M02-T04.

## Immutability and limits

The v1 in-memory implementation applies these deterministic limits:

| Limit                                       | Value   |
| ------------------------------------------- | ------- |
| caller artifacts                            | 1,024   |
| Catalog value depth below the root          | 128     |
| Catalog primitive and container occurrences | 100,000 |
| path bytes                                  | 240     |
| one entry's bytes                           | 16 MiB  |
| complete framed bytes                       | 64 MiB  |

Before canonicalization, the implementation walks the Catalog iteratively through enumerable data
descriptors and creates a bounded inert snapshot. It counts aliases every time they would be
serialized, so a small caller graph cannot expand past the 16 MiB Catalog-entry limit through
repeated references. Accessors, sparse or decorated arrays, non-JSON prototypes, cycles, invalid
Unicode, excessive depth, and excessive node counts are rejected before the recursive
canonicalizer receives the snapshot.

Artifact inputs must be authentic, attached `Uint8Array` views backed by an `ArrayBuffer`.
`SharedArrayBuffer` is rejected because another agent could change it during a synchronous digest
operation. Exact subview offset and length are honored.

Every input view is copied before framing. The encoder returns a fresh byte array on every call and
retains no caller aliases. The higher-level result contains only frozen JSON-like audit metadata;
it contains no byte views or executable values.

## Verification and non-claims

This profile proves deterministic package identity and self-field verification. It does not prove:

- Catalog structural or semantic validity;
- that declared adapters exist or implement their contracts;
- reproducibility of a real production build;
- immutability of a distributor or cache;
- exact package retention or activation behavior;
- authenticity, publisher identity, signatures, or trusted transport; or
- React Native, iOS, Android, or any other target.

Those claims remain assigned to M03-T09/M03-T10, M06, M07, M12, or a future target profile.
