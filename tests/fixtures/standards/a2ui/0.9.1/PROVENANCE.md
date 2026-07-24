# A2UI 0.9.1 pinned schema provenance

These files are unmodified upstream JSON Schema bytes used only by the SC-01
executable bridge spike and its offline tests.

- Repository: `https://github.com/a2ui-project/a2ui`
- Commit: `d4723f29254520e1214d5004cb555d83eaafb828`
- `specification/v0_9_1` tree: `c7bbfeea1e6d62b0f24af4c83231c2d9fd55aa89`
- Retrieved: 2026-07-24
- Upstream license: Apache License 2.0 (`LICENSE` at the pinned repository commit)

| Local file              | Upstream path                                      | Git blob SHA-1                             | File SHA-256                                                       |
| ----------------------- | -------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------ |
| `server_to_client.json` | `specification/v0_9_1/json/server_to_client.json`  | `dcf138a1776b2039c8035aa263b7fa0ba244ab4e` | `2ba29dbcb57611225c96d3e064d05cf97e9d8224b293c8b20d37b93922a2d30d` |
| `common_types.json`     | `specification/v0_9_1/json/common_types.json`      | `51c5b036bcba83631aad780f5b6b78dad6b552f8` | `ac79788e95e5bdf0a39808953593a53c1bc9fcdcdb55480f4610613c6591e94c` |
| `basic-catalog.json`    | `specification/v0_9_1/catalogs/basic/catalog.json` | `cefc2b98bb475d4399e1ebbcb5b81fa547ec5e1e` | `4c694b68ee51e0e5716add4bcfddafb6311089df07314832f27decaca319c0d3` |

The versioned prose directory is `v0_9_1`, while the pinned Basic Catalog
schema's actual `$id` and `catalogId` are both
`https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json`. The bridge
therefore emits that exact schema-owned Catalog ID and emits message
`version: "v0.9.1"`. It does not invent a `/v0_9_1/` Catalog alias.

The official pinned test runner resolves `server_to_client.json`'s relative
`catalog.json` reference by making an in-memory/file-copy alias whose `$id` is
`https://a2ui.org/specification/v0_9/catalog.json`. The SC-01 verifier mirrors
that schema-resolution operation in memory without changing these pinned
bytes. Upstream runner:
`specification/v0_9_1/test/run_tests.py` at blob
`324b8e479c4ef5d63f5dfb975a66f6ca608b053e`.
