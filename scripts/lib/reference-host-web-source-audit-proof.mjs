import { createHash, randomBytes } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, readdir, realpath, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { isDeepStrictEqual, types as utilTypes } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

import { cruise } from "dependency-cruiser";
import { format } from "prettier";
import ts from "typescript";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const REQUIRE = createRequire(import.meta.url);
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_ARTIFACT_BYTES = 4 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 512 * 1024;
const MAX_SOURCE_FILES = 64;
const MAX_CURRENT_EVIDENCE_NODES = 65_536;
const MAX_CURRENT_EVIDENCE_SCALARS = 65_536;
const MAX_CURRENT_EVIDENCE_KEYS = 65_536;
const MAX_CURRENT_EVIDENCE_STRING_BYTES = MAX_ARTIFACT_BYTES;
const PENDING_SHA256 = "[PENDING_FINAL_ARTIFACT_SHA256]";
const HISTORICAL_ARTIFACT_SHA256 =
  "cb54702266260a6e139950808b520bc139d35cebbde03ea93a187d2340a17e89";
const HISTORICAL_ARTIFACT_BYTES = 59_871;
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype);
const TYPED_ARRAY_BUFFER_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "buffer",
).get;
const TYPED_ARRAY_BYTE_LENGTH_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteLength",
).get;
const TYPED_ARRAY_BYTE_OFFSET_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteOffset",
).get;
const SAFE_REFLECT_APPLY = Reflect.apply;
const SAFE_OBJECT_CREATE = Object.create;
const SAFE_OBJECT_DEFINE_PROPERTY = Object.defineProperty;
const SAFE_OBJECT_ENTRIES = Object.entries;
const SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR = Object.getOwnPropertyDescriptor;
const SAFE_OBJECT_HAS_OWN = Object.hasOwn;
const SAFE_OBJECT_KEYS = Object.keys;
const SAFE_ARRAY_JOIN = Array.prototype.join;
const SAFE_ARRAY_SORT = Array.prototype.sort;
const SAFE_REGEXP_TEST = RegExp.prototype.test;
const SAFE_STRING_INDEX_OF = String.prototype.indexOf;
const SAFE_STRING_SPLIT = String.prototype.split;
const SAFE_BUFFER_FROM = Buffer.from.bind(Buffer);
const SAFE_TEXT_DECODER = TextDecoder;
const SAFE_TEXT_DECODER_DECODE = TextDecoder.prototype.decode;
const SAFE_JSON_PARSE = JSON.parse;
const SAFE_JSON_STRINGIFY = JSON.stringify;

const ARTIFACT_RELATIVE_PATH = "docs/proof/artifacts/reference-host-web-0.1.0-source-audit.json";
const PROOF_DOCUMENT_RELATIVE_PATH = "docs/proof/REFERENCE-HOST-WEB-SOURCE-AUDIT.md";
const PROOF_MATRIX_RELATIVE_PATH = "docs/proof/PROOF-MATRIX.md";
const PROJECT_STATUS_RELATIVE_PATH = "PROJECT-STATUS.md";
const CONTROL_PLANE_PACKAGE_RELATIVE_PATH = "apps/control-plane-api/package.json";
const APPLICATION_SOURCE_DIRECTORY = "apps/reference-host-web/src";
const APPLICATION_ENTRY = `${APPLICATION_SOURCE_DIRECTORY}/main.tsx`;
const HISTORICAL_SOURCE_PATHS = Object.freeze([
  "apps/reference-host-web/src/application.tsx",
  "apps/reference-host-web/src/browser-profile.ts",
  "apps/reference-host-web/src/failure-view.tsx",
  "apps/reference-host-web/src/host-ports.ts",
  "apps/reference-host-web/src/main.tsx",
  "apps/reference-host-web/src/managed-surface.tsx",
  "apps/reference-host-web/src/official-sign-in.ts",
  "apps/reference-host-web/src/recovery-authority.ts",
  "apps/reference-host-web/src/root-policy.ts",
  "apps/reference-host-web/src/root.tsx",
  "apps/reference-host-web/src/sign-in-http-handler.ts",
  "apps/reference-host-web/src/styles.css",
]);
const T09_PROOF_PATHS = Object.freeze([
  "scripts/generate-reference-host-web-source-audit-proof.mjs",
  "scripts/lib/reference-host-web-source-audit-proof.mjs",
  "scripts/verify-reference-host-web-source-audit.mjs",
  "tests/reference-host-web-source-audit.test.mjs",
]);
const CURRENT_AUDIT_COORDINATION_PATHS = Object.freeze([
  "package.json",
  "pnpm-lock.yaml",
  ...T09_PROOF_PATHS,
]);
const CURRENT_AUDIT_COORDINATION_PATH_SET = new Set(CURRENT_AUDIT_COORDINATION_PATHS);
const M07_T06_CONTROL_PLANE_COORDINATION = Object.freeze({
  task: "M07-T06",
  scripts: Object.freeze({
    "generate:control-plane-bundle-store":
      "pnpm verify:publisher-invalid-source-matrix && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:bundle-store && node scripts/generate-control-plane-bundle-store-proof.mjs",
    "verify:control-plane-bundle-store":
      "pnpm verify:publisher-invalid-source-matrix && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:bundle-store && node scripts/verify-control-plane-bundle-store.mjs",
    "test:control-plane-bundle-store":
      "pnpm verify:publisher-invalid-source-matrix && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:bundle-store && node --test tests/control-plane-bundle-store.test.mjs",
    "generate:control-plane-bundle-verification":
      "pnpm verify:control-plane-bundle-store && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:bundle-verification && node scripts/generate-control-plane-bundle-verification-proof.mjs",
    "verify:control-plane-bundle-verification":
      "pnpm verify:control-plane-bundle-store && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:bundle-verification && node scripts/verify-control-plane-bundle-verification.mjs",
    "test:control-plane-bundle-verification":
      "pnpm verify:control-plane-bundle-store && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:bundle-verification && node --test tests/control-plane-bundle-verification.test.mjs",
    "generate:control-plane-package-preflight":
      "pnpm verify:control-plane-bundle-verification && pnpm --filter @desen/reference-catalog-web... build && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api verify:package-preflight-guards && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:package-preflight && node scripts/generate-control-plane-package-preflight-proof.mjs",
    "verify:control-plane-package-preflight":
      "pnpm verify:control-plane-bundle-verification && pnpm --filter @desen/reference-catalog-web... build && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api verify:package-preflight-guards && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:package-preflight && node scripts/verify-control-plane-package-preflight.mjs",
    "test:control-plane-package-preflight":
      "pnpm verify:control-plane-bundle-verification && pnpm --filter @desen/reference-catalog-web... build && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api verify:package-preflight-guards && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:package-preflight && node --test tests/control-plane-package-preflight.test.mjs",
    "generate:control-plane-reference-preflight":
      "pnpm verify:control-plane-package-preflight && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:reference-preflight && node scripts/generate-control-plane-reference-preflight-proof.mjs",
    "verify:control-plane-reference-preflight":
      "pnpm verify:control-plane-package-preflight && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:reference-preflight && node scripts/verify-control-plane-reference-preflight.mjs",
    "test:control-plane-reference-preflight":
      "pnpm verify:control-plane-package-preflight && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:reference-preflight && node --test tests/control-plane-reference-preflight.test.mjs",
    "generate:control-plane-local-api":
      "pnpm verify:control-plane-reference-preflight && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:local-api && node scripts/generate-control-plane-local-api-proof.mjs",
    "verify:control-plane-local-api":
      "pnpm verify:control-plane-reference-preflight && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:local-api && node scripts/verify-control-plane-local-api.mjs",
    "test:control-plane-local-api":
      "pnpm verify:control-plane-reference-preflight && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:local-api && node --test tests/control-plane-local-api.test.mjs",
    "generate:control-plane-runtime-staging":
      "pnpm verify:control-plane-local-api && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:runtime-staging && node scripts/generate-control-plane-runtime-staging-proof.mjs",
    "verify:control-plane-runtime-staging":
      "pnpm verify:control-plane-local-api && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:runtime-staging && node scripts/verify-control-plane-runtime-staging.mjs",
    "test:control-plane-runtime-staging":
      "pnpm verify:control-plane-local-api && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:runtime-staging && node --test tests/control-plane-runtime-staging.test.mjs",
  }),
  packageTest: Object.freeze({
    package: "@desen/control-plane-api",
    path: "apps/control-plane-api/package.json",
    bytes: 2_082,
    sha256: "342be659bad35bcec910a5c5cd97d4b1bde03c63e7d5873d0d8806084aa495d4",
    script: "test:runtime-staging",
    command: "vitest run test/runtime-staging.test.ts",
    rootSegment: "pnpm --filter @desen/control-plane-api test:runtime-staging",
  }),
  aggregateEdges: Object.freeze([
    Object.freeze({
      script: "check",
      commandKind: "verify",
      segments: 72,
      sha256: "f65199c4758bcb19ab859c8f0a055f055059e01f3c770dce17187e4f613bf15a",
      predecessor: "pnpm verify:control-plane-local-api",
      segment: "pnpm verify:control-plane-runtime-staging",
      successor: "pnpm lint",
      normalizedSegments: Object.freeze([
        "pnpm verify:control-plane-bundle-store",
        "pnpm verify:control-plane-bundle-verification",
        "pnpm verify:control-plane-package-preflight",
        "pnpm verify:control-plane-reference-preflight",
        "pnpm verify:control-plane-local-api",
        "pnpm verify:control-plane-runtime-staging",
      ]),
    }),
    Object.freeze({
      script: "test",
      commandKind: "test",
      segments: 67,
      sha256: "e436b3928f624f590e5ecee4bf604c43eaa973d5a0fa3b135ccce7e37d1277ec",
      predecessor: "pnpm test:control-plane-local-api",
      segment: "pnpm test:control-plane-runtime-staging",
      successor: "turbo run test",
      normalizedSegments: Object.freeze([
        "pnpm test:control-plane-bundle-store",
        "pnpm test:control-plane-bundle-verification",
        "pnpm test:control-plane-package-preflight",
        "pnpm test:control-plane-reference-preflight",
        "pnpm test:control-plane-local-api",
        "pnpm test:control-plane-runtime-staging",
      ]),
    }),
  ]),
  lockfileImporter: Object.freeze({
    path: "apps/control-plane-api",
    groups: Object.freeze([
      Object.freeze({
        name: "dependencies",
        packages: Object.freeze([
          Object.freeze({
            name: "@desen/protocol",
            specifier: "workspace:*",
            version: "link:../../packages/protocol",
          }),
          Object.freeze({
            name: "@desen/runtime-core",
            specifier: "workspace:*",
            version: "link:../../packages/runtime-core",
          }),
          Object.freeze({
            name: "@desen/validator",
            specifier: "workspace:*",
            version: "link:../../packages/validator",
          }),
          Object.freeze({
            name: "better-sqlite3",
            specifier: "13.0.3",
            version: "13.0.3",
          }),
          Object.freeze({
            name: "fastify",
            specifier: "5.11.2",
            version: "5.11.2",
          }),
        ]),
      }),
      Object.freeze({
        name: "devDependencies",
        packages: Object.freeze([
          Object.freeze({
            name: "@desen/publisher",
            specifier: "workspace:*",
            version: "link:../../packages/publisher",
          }),
          Object.freeze({
            name: "@types/better-sqlite3",
            specifier: "9.6.0",
            version: "9.6.0",
          }),
          Object.freeze({
            name: "ajv",
            specifier: "8.20.0",
            version: "8.20.0",
          }),
          Object.freeze({
            name: "prettier",
            specifier: "3.9.6",
            version: "3.9.6",
          }),
          Object.freeze({
            name: "vitest",
            specifier: "4.1.10",
            version: "4.1.10(@types/node@24.13.3)(@vitest/coverage-v8@4.1.10)(jsdom@29.1.1)",
          }),
        ]),
      }),
    ]),
  }),
});
const M07_T07_CONTROL_PLANE_COORDINATION = Object.freeze({
  task: "M07-T07",
  scripts: Object.freeze({
    ...M07_T06_CONTROL_PLANE_COORDINATION.scripts,
    "generate:control-plane-runtime-activation":
      "pnpm verify:control-plane-runtime-staging && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:runtime-activation && node scripts/generate-control-plane-runtime-activation-proof.mjs",
    "verify:control-plane-runtime-activation":
      "pnpm verify:control-plane-runtime-staging && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:runtime-activation && node scripts/verify-control-plane-runtime-activation.mjs",
    "test:control-plane-runtime-activation":
      "pnpm verify:control-plane-runtime-staging && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:runtime-activation && node --test tests/control-plane-runtime-activation.test.mjs",
  }),
  packageTest: Object.freeze({
    package: "@desen/control-plane-api",
    path: "apps/control-plane-api/package.json",
    bytes: 2_159,
    sha256: "2511a9dfaba16880d5591a68adb2dcbbd6d84a90298d38218f2434bb06416627",
    script: "test:runtime-activation",
    command: "vitest run test/runtime-activation.test.ts",
    rootSegment: "pnpm --filter @desen/control-plane-api test:runtime-activation",
  }),
  aggregateEdges: Object.freeze([
    Object.freeze({
      script: "check",
      commandKind: "verify",
      segments: 73,
      sha256: "e9397620ac7da8102a4e3602d4ef635a3cc874c99d096f05cb05d71338b9cfc7",
      predecessor: "pnpm verify:control-plane-runtime-staging",
      segment: "pnpm verify:control-plane-runtime-activation",
      successor: "pnpm lint",
      normalizedSegments: Object.freeze([
        "pnpm verify:control-plane-bundle-store",
        "pnpm verify:control-plane-bundle-verification",
        "pnpm verify:control-plane-package-preflight",
        "pnpm verify:control-plane-reference-preflight",
        "pnpm verify:control-plane-local-api",
        "pnpm verify:control-plane-runtime-staging",
        "pnpm verify:control-plane-runtime-activation",
      ]),
    }),
    Object.freeze({
      script: "test",
      commandKind: "test",
      segments: 68,
      sha256: "3ab058666889f4d648854227829ce91d9d3f6ef240142462087d3249f0598c98",
      predecessor: "pnpm test:control-plane-runtime-staging",
      segment: "pnpm test:control-plane-runtime-activation",
      successor: "turbo run test",
      normalizedSegments: Object.freeze([
        "pnpm test:control-plane-bundle-store",
        "pnpm test:control-plane-bundle-verification",
        "pnpm test:control-plane-package-preflight",
        "pnpm test:control-plane-reference-preflight",
        "pnpm test:control-plane-local-api",
        "pnpm test:control-plane-runtime-staging",
        "pnpm test:control-plane-runtime-activation",
      ]),
    }),
  ]),
  lockfileImporter: M07_T06_CONTROL_PLANE_COORDINATION.lockfileImporter,
});
const M07_T08_CONTROL_PLANE_COORDINATION = Object.freeze({
  task: "M07-T08",
  scripts: Object.freeze({
    ...M07_T07_CONTROL_PLANE_COORDINATION.scripts,
    "generate:control-plane-runtime-recovery":
      "pnpm verify:control-plane-runtime-activation && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:runtime-recovery && node scripts/generate-control-plane-runtime-recovery-proof.mjs",
    "verify:control-plane-runtime-recovery":
      "pnpm verify:control-plane-runtime-activation && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:runtime-recovery && node scripts/verify-control-plane-runtime-recovery.mjs",
    "test:control-plane-runtime-recovery":
      "pnpm verify:control-plane-runtime-activation && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:runtime-recovery && node --test tests/control-plane-runtime-recovery.test.mjs",
  }),
  packageTest: Object.freeze({
    package: "@desen/control-plane-api",
    path: "apps/control-plane-api/package.json",
    bytes: 2_232,
    sha256: "b228b200dafda1d319429376b9cc6456fadd4a3db865269ec8c2675eb0e60e8c",
    script: "test:runtime-recovery",
    command: "vitest run test/runtime-recovery.test.ts",
    rootSegment: "pnpm --filter @desen/control-plane-api test:runtime-recovery",
  }),
  aggregateEdges: Object.freeze([
    Object.freeze({
      script: "check",
      commandKind: "verify",
      segments: 74,
      sha256: "8a008847a00507b354a585d1028dc6970b1575dcc4a6b62b1e3f66b746f1c634",
      predecessor: "pnpm verify:control-plane-runtime-activation",
      segment: "pnpm verify:control-plane-runtime-recovery",
      successor: "pnpm lint",
      normalizedSegments: Object.freeze([
        ...M07_T07_CONTROL_PLANE_COORDINATION.aggregateEdges[0].normalizedSegments,
        "pnpm verify:control-plane-runtime-recovery",
      ]),
    }),
    Object.freeze({
      script: "test",
      commandKind: "test",
      segments: 69,
      sha256: "bb8e45448a7a1c85db8e29891af8b7df1c862f72cfd79fdea67d3fb82b779f74",
      predecessor: "pnpm test:control-plane-runtime-activation",
      segment: "pnpm test:control-plane-runtime-recovery",
      successor: "turbo run test",
      normalizedSegments: Object.freeze([
        ...M07_T07_CONTROL_PLANE_COORDINATION.aggregateEdges[1].normalizedSegments,
        "pnpm test:control-plane-runtime-recovery",
      ]),
    }),
  ]),
  lockfileImporter: M07_T07_CONTROL_PLANE_COORDINATION.lockfileImporter,
});
const M07_T09_CONTROL_PLANE_COORDINATION = Object.freeze({
  task: "M07-T09",
  scripts: Object.freeze({
    ...M07_T08_CONTROL_PLANE_COORDINATION.scripts,
    "generate:control-plane-runtime-fault-injection":
      "pnpm verify:control-plane-runtime-recovery && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:runtime-fault-injection && node scripts/generate-control-plane-runtime-fault-injection-proof.mjs",
    "verify:control-plane-runtime-fault-injection":
      "pnpm verify:control-plane-runtime-recovery && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:runtime-fault-injection && node scripts/verify-control-plane-runtime-fault-injection.mjs",
    "test:control-plane-runtime-fault-injection":
      "pnpm verify:control-plane-runtime-recovery && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:runtime-fault-injection && node --test tests/control-plane-runtime-fault-injection.test.mjs",
  }),
  packageTest: Object.freeze({
    package: "@desen/control-plane-api",
    path: "apps/control-plane-api/package.json",
    bytes: 2_319,
    sha256: "5c4495f06ecb1394fee2c14c2e57bc1bf76fe9a99ee1cb56c0ce4ff0874388c3",
    script: "test:runtime-fault-injection",
    command: "vitest run test/runtime-fault-injection.test.ts",
    rootSegment: "pnpm --filter @desen/control-plane-api test:runtime-fault-injection",
  }),
  aggregateEdges: Object.freeze([
    Object.freeze({
      script: "check",
      commandKind: "verify",
      segments: 75,
      sha256: "0c168fb8a3e573791b1e0d4b42fcd9237278ed76f1408e177821505ca204f805",
      predecessor: "pnpm verify:control-plane-runtime-recovery",
      segment: "pnpm verify:control-plane-runtime-fault-injection",
      successor: "pnpm lint",
      normalizedSegments: Object.freeze([
        ...M07_T08_CONTROL_PLANE_COORDINATION.aggregateEdges[0].normalizedSegments,
        "pnpm verify:control-plane-runtime-fault-injection",
      ]),
    }),
    Object.freeze({
      script: "test",
      commandKind: "test",
      segments: 70,
      sha256: "3fa0c66c368ef4b0772d3fbca4780809f72c28ac0901d365210d848ff1da2a55",
      predecessor: "pnpm test:control-plane-runtime-recovery",
      segment: "pnpm test:control-plane-runtime-fault-injection",
      successor: "turbo run test",
      normalizedSegments: Object.freeze([
        ...M07_T08_CONTROL_PLANE_COORDINATION.aggregateEdges[1].normalizedSegments,
        "pnpm test:control-plane-runtime-fault-injection",
      ]),
    }),
  ]),
  lockfileImporter: M07_T08_CONTROL_PLANE_COORDINATION.lockfileImporter,
});
const M07_T10_CONTROL_PLANE_COORDINATION = Object.freeze({
  task: "M07-T10",
  scripts: Object.freeze({
    ...M07_T09_CONTROL_PLANE_COORDINATION.scripts,
    "generate:control-plane-runtime-transition-races":
      "pnpm verify:control-plane-runtime-fault-injection && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:runtime-transition-races && node scripts/generate-control-plane-runtime-transition-races-proof.mjs",
    "verify:control-plane-runtime-transition-races":
      "pnpm verify:control-plane-runtime-fault-injection && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:runtime-transition-races && node scripts/verify-control-plane-runtime-transition-races.mjs",
    "test:control-plane-runtime-transition-races":
      "pnpm verify:control-plane-runtime-fault-injection && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:runtime-transition-races && node --test tests/control-plane-runtime-transition-races.test.mjs",
  }),
  packageTest: Object.freeze({
    package: "@desen/control-plane-api",
    path: "apps/control-plane-api/package.json",
    bytes: 2_408,
    sha256: "a54beedd590df3f2c802f42fc7adf8f703a7a69eb1c34dc67fedbb4c23a982c2",
    script: "test:runtime-transition-races",
    command: "vitest run test/runtime-transition-races.test.ts",
    rootSegment: "pnpm --filter @desen/control-plane-api test:runtime-transition-races",
  }),
  aggregateEdges: Object.freeze([
    Object.freeze({
      script: "check",
      commandKind: "verify",
      segments: 76,
      sha256: "5760178ee6a2f932c2f75b7c04742b63aa8045738546c797bb5961b26200410a",
      predecessor: "pnpm verify:control-plane-runtime-fault-injection",
      segment: "pnpm verify:control-plane-runtime-transition-races",
      successor: "pnpm lint",
      normalizedSegments: Object.freeze([
        ...M07_T09_CONTROL_PLANE_COORDINATION.aggregateEdges[0].normalizedSegments,
        "pnpm verify:control-plane-runtime-transition-races",
      ]),
    }),
    Object.freeze({
      script: "test",
      commandKind: "test",
      segments: 71,
      sha256: "da475a6e944544fc07e9ecf96ccd184cab073e3e4c7799a7526d62b954f321dd",
      predecessor: "pnpm test:control-plane-runtime-fault-injection",
      segment: "pnpm test:control-plane-runtime-transition-races",
      successor: "turbo run test",
      normalizedSegments: Object.freeze([
        ...M07_T09_CONTROL_PLANE_COORDINATION.aggregateEdges[1].normalizedSegments,
        "pnpm test:control-plane-runtime-transition-races",
      ]),
    }),
  ]),
  lockfileImporter: M07_T09_CONTROL_PLANE_COORDINATION.lockfileImporter,
});
const M07_T11_REFERENCE_HOST_COORDINATION = Object.freeze({
  task: "M07-T11",
  scripts: Object.freeze({
    "generate:reference-host-web-channel-consumption":
      "pnpm verify:reference-host-web-source-audit && pnpm verify:control-plane-runtime-transition-races && pnpm --filter @desen/reference-host-web-server... build && pnpm --filter @desen/reference-host-web... build && pnpm --filter @desen/reference-host-web-server typecheck && pnpm --filter @desen/reference-host-web typecheck && pnpm --filter @desen/reference-host-web-server test:channel && pnpm --filter @desen/reference-host-web test:channel && node scripts/generate-reference-host-web-channel-consumption-proof.mjs",
    "verify:reference-host-web-channel-consumption":
      "pnpm verify:reference-host-web-source-audit && pnpm verify:control-plane-runtime-transition-races && pnpm --filter @desen/reference-host-web-server... build && pnpm --filter @desen/reference-host-web... build && pnpm --filter @desen/reference-host-web-server typecheck && pnpm --filter @desen/reference-host-web typecheck && pnpm --filter @desen/reference-host-web-server test:channel && pnpm --filter @desen/reference-host-web test:channel && node scripts/verify-reference-host-web-channel-consumption.mjs",
    "test:reference-host-web-channel-consumption":
      "pnpm verify:reference-host-web-source-audit && pnpm verify:control-plane-runtime-transition-races && pnpm --filter @desen/reference-host-web-server... build && pnpm --filter @desen/reference-host-web... build && pnpm --filter @desen/reference-host-web-server typecheck && pnpm --filter @desen/reference-host-web typecheck && pnpm --filter @desen/reference-host-web-server test:channel && pnpm --filter @desen/reference-host-web test:channel && node --test tests/reference-host-web-channel-consumption.test.mjs",
  }),
  aggregateEdges: Object.freeze([
    Object.freeze({
      script: "check",
      segments: 77,
      sha256: "bcc6db4e4d6d43de0c355138b5763ace23e8f9f43847843315e630821b7f1a67",
      predecessor: "pnpm verify:control-plane-runtime-transition-races",
      segment: "pnpm verify:reference-host-web-channel-consumption",
      successor: "pnpm lint",
    }),
    Object.freeze({
      script: "test",
      segments: 72,
      sha256: "e8e6336d7482bd9eabe52ea1dc9085fdd321c1cc6553cca34d9e7fd3e0f718dc",
      predecessor: "pnpm test:control-plane-runtime-transition-races",
      segment: "pnpm test:reference-host-web-channel-consumption",
      successor: "turbo run test",
    }),
  ]),
  lockfileImporter: Object.freeze({
    path: "apps/reference-host-web-server",
    groups: Object.freeze([
      Object.freeze({
        name: "dependencies",
        packages: Object.freeze([
          Object.freeze({
            name: "@desen/control-plane-api",
            specifier: "workspace:*",
            version: "link:../control-plane-api",
          }),
        ]),
      }),
      Object.freeze({
        name: "devDependencies",
        packages: Object.freeze([
          Object.freeze({
            name: "@desen/protocol",
            specifier: "workspace:*",
            version: "link:../../packages/protocol",
          }),
          Object.freeze({
            name: "vitest",
            specifier: "4.1.10",
            version: "4.1.10(@types/node@24.13.3)(@vitest/coverage-v8@4.1.10)(jsdom@29.1.1)",
          }),
        ]),
      }),
    ]),
  }),
});
const M07_T06_CONTROL_PLANE_LOCKFILE_BLOCK = `  apps/control-plane-api:
    dependencies:
      '@desen/protocol':
        specifier: workspace:*
        version: link:../../packages/protocol
      '@desen/runtime-core':
        specifier: workspace:*
        version: link:../../packages/runtime-core
      '@desen/validator':
        specifier: workspace:*
        version: link:../../packages/validator
      better-sqlite3:
        specifier: 13.0.3
        version: 13.0.3
      fastify:
        specifier: 5.11.2
        version: 5.11.2
    devDependencies:
      '@desen/publisher':
        specifier: workspace:*
        version: link:../../packages/publisher
      '@types/better-sqlite3':
        specifier: 9.6.0
        version: 9.6.0
      ajv:
        specifier: 8.20.0
        version: 8.20.0
      prettier:
        specifier: 3.9.6
        version: 3.9.6
      vitest:
        specifier: 4.1.10
        version: 4.1.10(@types/node@24.13.3)(@vitest/coverage-v8@4.1.10)(jsdom@29.1.1)

`;
const APPROVED_M07_T06_DEPENDENCY_POLICY_SUCCESSOR = Object.freeze({
  referenceHostPackage: Object.freeze({
    path: "apps/reference-host-web/package.json",
    historical: Object.freeze({
      bytes: 1_117,
      sha256: "sha256:9ac859aeb8cd54167c6ef290af97791f3d69bbfad81d9b69301be91700f331b0",
    }),
    successor: Object.freeze({
      bytes: 1_155,
      sha256: "sha256:f8bb387510e1ea1b58ee24fc8e5aea87013f86bef0f0cd666ce29b9419358a79",
    }),
  }),
  // Final normalized lockfile bytes are filled from the reviewed M07-T06 dependency-policy
  // transition after transitive advisory remediation has settled.
  normalizedLockfile: Object.freeze({
    bytes: 125_215,
    sha256: "sha256:7f75d755557b0b4d0741de175986ab22292ea3819cd1f53f384d773b4d6b4cb7",
  }),
  dependencyBoundaryConfig: Object.freeze({
    path: "dependency-cruiser.config.cjs",
    historical: Object.freeze({
      bytes: 7_246,
      sha256: "sha256:ecce08e926a85df2465ebc3caa9dfdb80e700fe1508b0b32403907b7e245714e",
    }),
    successor: Object.freeze({
      bytes: 7_291,
      sha256: "sha256:af3fc624fda5cc839f89969871a1b7218df54c2d925a77f213d086b3f3513fc2",
    }),
  }),
});
const M06_T05_VALIDATOR_SUCCESSOR = Object.freeze({
  task: "M06-T05",
  sourceFiles: Object.freeze([
    Object.freeze({
      path: "packages/validator/src/index.ts",
      bytes: 5_916,
      sha256: "8fb565cd1276386510bef53be5de6bb48803b8d4f6048757e261e6849adfba92",
    }),
    Object.freeze({
      path: "packages/validator/src/binding-contract-validation.ts",
      bytes: 60_596,
      sha256: "a30578fd38c5662b1fdcdd510f7cfa1a07dd7e190df908db2cc18b7be339ea1a",
    }),
    Object.freeze({
      path: "packages/validator/src/execution-contract-validation.ts",
      bytes: 102_812,
      sha256: "000933db59b168dbb27983a8a0d55bb4aa30c6ec3946fb6000ea03dd1ce3a176",
    }),
    Object.freeze({
      path: "packages/validator/src/interaction-contract-validation.ts",
      bytes: 63_591,
      sha256: "559de34751c6ea52716926fffd031e147ed0785abf31708376aa838276172031",
    }),
    Object.freeze({
      path: "packages/validator/src/semantic-validation.ts",
      bytes: 36_879,
      sha256: "b5ae0899b4202b313c6fe864e6a46189ffc3e45fd1fe659e3f2285fd84d1c463",
    }),
    Object.freeze({
      path: "packages/validator/src/structural-validation.ts",
      bytes: 10_705,
      sha256: "8e7d4fb3a69b31bb8f4e3da050088058f53218d4ee4c440b8f631c0c475a1fc8",
    }),
  ]),
  historicalRuntimeResolution: Object.freeze({
    graphSha256: "sha256:243fa72ceee35d624beb9f0444abf73c0224512e5722846b934dd2de1cb1810d",
    backingSnapshotSha256:
      "sha256:0eff527a4ac86d86f24f86fbd833d94241daccfe18e2aef13eaf69751249ab8f",
    staticEdges: 297,
    assertions: 411,
  }),
  successorRuntimeResolution: Object.freeze({
    graphSha256: "sha256:898f4ec8efffdd0c300ba7957b70f2ebd45f10945dae4ba90145ace5f92c241f",
    backingSnapshotSha256:
      "sha256:b4a06b4d18c8d8529effec8f1933986771862c10a49245cba6fa540dbce87c42",
    staticEdges: 298,
    assertions: 412,
  }),
  modules: Object.freeze([
    Object.freeze({
      index: 86,
      id: "packages/validator/dist/binding-contract-validation.js",
      historical: Object.freeze({
        codeBytes: 44_581,
        codeSha256: "sha256:8d0f94f6dc7d3e343813bc1044216ff6f34a80897dbb6664045cb30517d9f9a5",
      }),
      successor: Object.freeze({
        codeBytes: 46_895,
        codeSha256: "sha256:82d2d9ae24ca0283c95c914025e4f708bad7f114879460b5931a25459dc2ad19",
      }),
    }),
    Object.freeze({
      index: 89,
      id: "packages/validator/dist/execution-contract-validation.js",
      historicalImports: Object.freeze([
        "packages/protocol/dist/index.js",
        "packages/validator/dist/binding-contract-validation.js",
        "packages/validator/dist/interaction-contract-validation.js",
        "packages/validator/dist/schema-instance-validation.js",
        "packages/validator/dist/semantic-diagnostics.js",
        "packages/validator/dist/validation-internals.js",
      ]),
      successorImports: Object.freeze([
        "packages/protocol/dist/index.js",
        "packages/validator/dist/binding-contract-validation.js",
        "packages/validator/dist/interaction-contract-validation.js",
        "packages/validator/dist/schema-instance-validation.js",
        "packages/validator/dist/semantic-diagnostics.js",
        "packages/validator/dist/semantic-validation.js",
        "packages/validator/dist/validation-internals.js",
      ]),
      historical: Object.freeze({
        codeBytes: 71_479,
        codeSha256: "sha256:051bab7b3b0d65198bb53c683133227bbde02fc207e5b1d9a5f9c535a4fa3802",
      }),
      successor: Object.freeze({
        codeBytes: 76_906,
        codeSha256: "sha256:2d84bfa71a348bffe94c8c91711b7a5ea683bd89d8e5a0398e00bda3d63fda4f",
      }),
    }),
    Object.freeze({
      index: 91,
      id: "packages/validator/dist/index.js",
      historical: Object.freeze({
        codeBytes: 1_847,
        codeSha256: "sha256:bec613e9ec9c541f0f62d2e65e95b51ccc3e0eab61dddfdb32e8daa79c13d0ef",
      }),
      successor: Object.freeze({
        codeBytes: 1_965,
        codeSha256: "sha256:5009c889ea5eeab437f902057cdee9f84ba39c437239f1f5d222ad2ba5e05ec8",
      }),
    }),
    Object.freeze({
      index: 92,
      id: "packages/validator/dist/interaction-contract-validation.js",
      historical: Object.freeze({
        codeBytes: 49_483,
        codeSha256: "sha256:aa31f1e614b606892a1eb0d4a1632bf12479704ff5f7403ab631aff691500833",
      }),
      successor: Object.freeze({
        codeBytes: 49_673,
        codeSha256: "sha256:431b473b6aa82a5af848faf74cf5459aa4375e2678f936e51c733212c42af331",
      }),
    }),
    Object.freeze({
      index: 95,
      id: "packages/validator/dist/semantic-validation.js",
      historical: Object.freeze({
        codeBytes: 23_365,
        codeSha256: "sha256:7d57f2ed44eb04606701896dbce5c2f5aa1c54e45cc43540caedb5aa790acdc1",
      }),
      successor: Object.freeze({
        codeBytes: 27_165,
        codeSha256: "sha256:1d89f973a8a768771aabf203e55bc9816e1b06365553604c5808318abc483368",
      }),
    }),
    Object.freeze({
      index: 98,
      id: "packages/validator/dist/structural-validation.js",
      historical: Object.freeze({
        codeBytes: 5_187,
        codeSha256: "sha256:f29c203e4e5648b1104395df50e4c9b844ac88dfc9871f958e49e8f19a2fc95a",
      }),
      successor: Object.freeze({
        codeBytes: 6_241,
        codeSha256: "sha256:316c1ea98f96ada1cad6a5cb398538fac5c10e94a03e0efa318f07c8d0459c28",
      }),
    }),
  ]),
});
const M07_T11_REFERENCE_HOST_SUCCESSOR = Object.freeze({
  task: "M07-T11",
  historicalProjectionSha256: "ab644bb509ba7100d920901615d3c9f3d14bdbdbf0c3ba626fed069a1f7d6b9f",
  successorProjectionSha256: "73d202c572124fdb050413c49ed792f2aac520b1aec5486f8f5f9edafb975384",
  sourceFiles: 13,
  executableSourceFiles: 12,
  importDeclarations: 56,
  executableDescriptors: 644,
  executableSurfaceSha256:
    "sha256:aeb0b94d79d096c170cbe903daaea033a89b5889f4675fa3a91ed004446fc88a",
  channelSource: "apps/reference-host-web/src/channel-delivery.ts",
});
const STATIC_TRACKED_PATHS = Object.freeze([
  "apps/reference-host-web/index.html",
  "apps/reference-host-web/package.json",
  "apps/reference-host-web/tsconfig.json",
  "dependency-cruiser.config.cjs",
  "examples/sign-in/official-derived.bundle.desen.json",
  "package.json",
  "packages/reference-catalog-web/catalog.json",
  "pnpm-lock.yaml",
  ...T09_PROOF_PATHS,
]);

const PREREQUISITES = Object.freeze([
  Object.freeze({
    task: "M05-T07",
    path: "docs/proof/artifacts/reference-host-web-0.1.0-shell.json",
    sha256: "cafaf8e9ec0b8be207344b25e076541b395c83e348f665dc7b97e5c4cb4000f2",
    profile: "desen-reference-host-web-shell-v1",
    result: "PASS",
  }),
  Object.freeze({
    task: "M05-T08",
    path: "docs/proof/artifacts/reference-host-web-0.1.0-sign-in.json",
    sha256: "a7c83d438190ee45dae4714bd092e56282cb3db4c69c72eeaca44e2647683adb",
    profile: "desen-reference-host-web-sign-in-v1",
    result: "PASS",
  }),
]);
const HISTORICAL_PREREQUISITES = Object.freeze([
  Object.freeze({
    ...PREREQUISITES[0],
    bytes: 16_213,
    immutable: true,
  }),
  Object.freeze({
    ...PREREQUISITES[1],
    bytes: 21_847,
    immutable: true,
  }),
]);
const HISTORICAL_CLAIM = Object.freeze({
  productionSourceInventoryClosed: true,
  productionSourceSymlinksRejected: true,
  everyProductionSourceFileReachableFromRealEntry: true,
  semanticTypeScriptCheckerUsed: true,
  realViteRuntimeResolutionObserved: true,
  dependencyCruiserUsedOnlyForPackageBoundary: true,
  exactJsxOwnershipAllowlistEnforced: true,
  directOrHiddenHandwrittenManagedTreesRejected: true,
  publicReferenceReactAdaptersReached: true,
  publicRuntimeReactRenderPlanReached: true,
  sourceOrAuthoringAssetsInRuntimeGraph: false,
  additionalDataAssetsInRuntimeGraph: false,
  dynamicExecutableEdges: false,
  p06Status: "PARTIAL",
  p07Status: "PARTIAL",
  p10Status: "PARTIAL",
  g05Closed: true,
  publisherProducedFixture: false,
  browserE2eClaimed: false,
  nativeRuntimeClaimed: false,
});
const HISTORICAL_NONCLAIMS = Object.freeze([
  "M06 Publisher output or reproducible publication",
  "general proof that arbitrary future host code cannot handwrite managed UI",
  "real-browser end-to-end conformance",
  "channel fetching, package installation, or remote capability loading",
  "Desen App authoring, preview, publishing, or host parity",
  "native, iOS, Android, SwiftUI, or Compose runtime support",
]);

const ALLOWED_EXTERNAL_IMPORTS = new Set([
  "@desen/reference-catalog-web/catalog.json",
  "@desen/reference-catalog-web/host-operations",
  "@desen/reference-catalog-web/react-adapters",
  "@desen/runtime-core",
  "@desen/runtime-react",
  "@desen/runtime-web",
  "react",
  "react-dom/client",
]);
const ALLOWED_EXTERNAL_VALUE_IMPORTS = Object.freeze({
  "@desen/reference-catalog-web/catalog.json": Object.freeze(["default"]),
  "@desen/reference-catalog-web/host-operations": Object.freeze([
    "bindReferenceSignInHostOperation",
  ]),
  "@desen/reference-catalog-web/react-adapters": Object.freeze([
    "REFERENCE_WEB_REACT_ADAPTER_REGISTRY_INPUT",
  ]),
  "@desen/runtime-core": Object.freeze([
    "RUNTIME_VALUE_SAFETY_LIMITS",
    "authenticateRuntimeHeadlessSessionAdapterAuthority",
    "authenticateRuntimeHeadlessSessionHostAuthority",
    "disposeRuntimeHeadlessSession",
    "mountRuntimeHeadlessSession",
    "snapshotRuntimeJsonValue",
  ]),
  "@desen/runtime-react": Object.freeze([
    "RuntimeReactSurfaceBoundary",
    "createRuntimeReactAdapterRegistry",
    "ignoreRuntimeReactRootCaughtError",
    "readRuntimeReactAdapterRegistry",
    "renderRuntimeReactSurface",
    "useRuntimeReactSurface",
  ]),
  "@desen/runtime-web": Object.freeze([
    "authenticateRuntimeWebHostDocumentAuthority",
    "createRuntimeWebBrowserPlatform",
    "createRuntimeWebHostAuthority",
    "disposeRuntimeWebHostAuthority",
    "readRuntimeWebHostAuthority",
  ]),
  react: Object.freeze(["StrictMode", "useCallback"]),
  "react-dom/client": Object.freeze(["createRoot"]),
});
const ALLOWED_DOM_CALLS = Object.freeze({
  "apps/reference-host-web/src/channel-delivery.ts": Object.freeze([
    'new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode',
    "abortController.abort",
    "abortController?.abort",
    "state.input.browser.clearTimeout",
    "state.input.browser.setTimeout",
  ]),
  "apps/reference-host-web/src/browser-profile.ts": Object.freeze([
    "browser.addEventListener",
    "browser.matchMedia",
    "browser.performance.now",
    "browser.removeEventListener",
    "mediaQuery.addEventListener",
    "mediaQuery.removeEventListener",
  ]),
  "apps/reference-host-web/src/main.tsx": Object.freeze([
    "document.getElementById",
    "window.addEventListener",
    "window.fetch",
    "window.removeEventListener",
  ]),
  "apps/reference-host-web/src/official-sign-in.ts": Object.freeze(["browser.history.pushState"]),
  "apps/reference-host-web/src/sign-in-http-handler.ts": Object.freeze([
    'new TextDecoder("utf-8", { fatal: true }).decode',
  ]),
});
const ALLOWED_INTRINSIC_PROTOTYPE_REFERENCES = Object.freeze({
  "apps/reference-host-web/src/official-sign-in.ts": Object.freeze(["Object.prototype"]),
  "apps/reference-host-web/src/recovery-authority.ts": Object.freeze(["Object.prototype"]),
  "apps/reference-host-web/src/root.tsx": Object.freeze(["Object.prototype"]),
  "apps/reference-host-web/src/sign-in-http-handler.ts": Object.freeze([
    "ArrayBuffer.prototype",
    "Object.prototype",
    "Uint8Array.prototype",
  ]),
});
const BROWSER_GLOBAL_AUTHORITIES = Object.freeze(["document", "globalThis", "self", "window"]);
const DYNAMIC_EXECUTABLE_PROPERTIES = Object.freeze([
  "Function",
  "SharedWorker",
  "WebAssembly",
  "Worker",
  "constructor",
  "eval",
  "require",
]);
const DOM_REPLACEMENT_PROPERTIES = Object.freeze([
  "append",
  "appendChild",
  "createContextualFragment",
  "insertAdjacentElement",
  "insertAdjacentHTML",
  "insertAdjacentText",
  "innerHTML",
  "innerText",
  "outerHTML",
  "outerText",
  "parseFromString",
  "prepend",
  "replaceChildren",
  "replaceWith",
  "textContent",
  "write",
  "writeln",
]);
const GLOBAL_AUTHORITY_REFLECTION_METHODS = Object.freeze({
  Object: Object.freeze([
    "entries",
    "getOwnPropertyDescriptor",
    "getOwnPropertyDescriptors",
    "getOwnPropertyNames",
    "getOwnPropertySymbols",
    "getPrototypeOf",
    "keys",
    "values",
  ]),
  Reflect: Object.freeze(["get", "getOwnPropertyDescriptor", "getPrototypeOf", "ownKeys"]),
});
const GRAPH_ENTRY_KEYS = Object.freeze([
  "codeBytes",
  "codeSha256",
  "dynamicImports",
  "id",
  "imports",
]);
const EMPTY_SHA256 = `sha256:${sha256(Buffer.alloc(0))}`;
const EXPECTED_INDEX_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light dark" />
    <title>DESEN Reference Host</title>
  </head>
  <body>
    <div id="desen-reference-host-root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;
const EXPECTED_REFERENCE_HOST_BOUNDARY_RULE = Object.freeze({
  comment: "reference-host-web may import only the packages assigned to its responsibility.",
  from: Object.freeze({ path: "^apps/reference-host-web/" }),
  name: "application-reference-host-web-allowed-dependencies",
  severity: "error",
  to: Object.freeze({
    path: "^packages/",
    pathNot: "^packages/(?:runtime-core|runtime-react|runtime-web|reference-catalog-web)/",
  }),
});
const EXPECTED_EXECUTABLE_SURFACE_SHA256 =
  "aeb0b94d79d096c170cbe903daaea033a89b5889f4675fa3a91ed004446fc88a";
const EXPECTED_INFRASTRUCTURE_CSS_SHA256 =
  "6d82529e07969d9033232aaa72924ec57eae0dd86736ebecdf700680046a7738";
const ALLOWED_DATA_IMPORTS = Object.freeze([
  Object.freeze({
    importer: "apps/reference-host-web/src/main.tsx",
    specifier: "./styles.css",
    resolved: "apps/reference-host-web/src/styles.css",
  }),
  Object.freeze({
    importer: "apps/reference-host-web/src/official-sign-in.ts",
    specifier: "@desen/reference-catalog-web/catalog.json",
    resolved: "packages/reference-catalog-web/catalog.json",
  }),
  Object.freeze({
    importer: "apps/reference-host-web/src/official-sign-in.ts",
    specifier: "../../../examples/sign-in/official-derived.bundle.desen.json",
    resolved: "examples/sign-in/official-derived.bundle.desen.json",
  }),
]);
const EXPECTED_GRAPH_DATA_MODULES = Object.freeze(
  ALLOWED_DATA_IMPORTS.map(({ resolved }) => resolved).sort(),
);
const EXPECTED_JSX = Object.freeze({
  "apps/reference-host-web/src/application.tsx": Object.freeze([
    "main@HostNotice@intrinsic",
    "section@HostNotice@intrinsic",
    "p@HostNotice@intrinsic",
    "h1@HostNotice@intrinsic",
    "p@HostNotice@intrinsic",
    "HostNotice@ReferenceHostApplication@apps/reference-host-web/src/application.tsx",
    "main@ReferenceHostApplication@intrinsic",
    "ReferenceHostManagedSurface@ReferenceHostApplication@apps/reference-host-web/src/managed-surface.tsx",
  ]),
  "apps/reference-host-web/src/failure-view.tsx": Object.freeze([
    "section@ReferenceHostFailureView@intrinsic",
    "p@ReferenceHostFailureView@intrinsic",
    "h1@ReferenceHostFailureView@intrinsic",
    "p@ReferenceHostFailureView@intrinsic",
    "code@ReferenceHostFailureView@intrinsic",
    "button@ReferenceHostFailureView@intrinsic",
  ]),
  "apps/reference-host-web/src/managed-surface.tsx": Object.freeze([
    "ReferenceHostFailureView@renderFailure@apps/reference-host-web/src/failure-view.tsx",
    "RuntimeReactSurfaceBoundary@ReferenceHostManagedSurface@packages/runtime-react/dist/surface-boundary.d.ts",
  ]),
  "apps/reference-host-web/src/root.tsx": Object.freeze([
    "StrictMode@renderCurrent@node_modules/@types/react/index.d.ts",
    "ReferenceHostApplication@renderCurrent@apps/reference-host-web/src/application.tsx",
  ]),
});
const EXPECTED_COMPOSITION_FUNCTIONS = Object.freeze([
  Object.freeze({
    path: "apps/reference-host-web/src/application.tsx",
    name: "HostNotice",
    sha256: "ec6485527af2e9aee1002ad36f7af571e6be84308bc740018ad398665a8875b8",
  }),
  Object.freeze({
    path: "apps/reference-host-web/src/application.tsx",
    name: "ReferenceHostApplication",
    sha256: "526ba75b0a4989d7f2f91bcc0d173c29e9ff6cfa082494bb24f3f51fb7b318e0",
  }),
  Object.freeze({
    path: "apps/reference-host-web/src/failure-view.tsx",
    name: "ReferenceHostFailureView",
    sha256: "ed55c24ecae08dee38b234c097db9ec589fd7923589e4189d950af1800e9701d",
  }),
  Object.freeze({
    path: "apps/reference-host-web/src/managed-surface.tsx",
    name: "ReferenceHostManagedSurface",
    sha256: "4fd8f67663ed4482140ec9137cead37939eb92c1ba0c6a76294cb73dc791b329",
  }),
  Object.freeze({
    path: "apps/reference-host-web/src/root.tsx",
    name: "renderCurrent",
    sha256: "c157df482689063880e3e3efb2abb5c7d56bd76f092a50ee003c52fd34d36302",
  }),
]);
const REQUIRED_RUNTIME_GRAPH_MODULES = Object.freeze([
  "packages/reference-catalog-web/dist/react-adapters/index.js",
  "packages/reference-catalog-web/dist/components/alert.js",
  "packages/reference-catalog-web/dist/components/button.js",
  "packages/reference-catalog-web/dist/components/stack.js",
  "packages/reference-catalog-web/dist/components/text-field.js",
  "packages/reference-catalog-web/dist/components/text.js",
  "packages/runtime-react/dist/index.js",
  "packages/runtime-react/dist/live-surface.js",
  "packages/runtime-react/dist/render-plan.js",
  "packages/runtime-react/dist/session-surface.js",
]);
const HOSTILE_MUTATION_POLICIES = Object.freeze([
  "application-runtime-dependency-allowlist",
  "build-envelope-case-stable-entry-identity",
  "canonical-html-node-and-attribute-allowlist",
  "composition-function-ast-fingerprint",
  "computed-global-access-deny",
  "data-edge-exact-allowlist",
  "dependency-boundary-config-and-version-pin",
  "dom-tree-mutation-deny",
  "dynamic-constructor-chain-deny",
  "dynamic-executable-authority-deny",
  "dynamic-import-deny",
  "fake-react-element-deny",
  "global-authority-reflection-deny",
  "graph-backing-file-snapshot",
  "graph-dynamic-edge-deny",
  "graph-entry-schema-deny",
  "graph-orphan-source-deny",
  "graph-required-public-paths",
  "graph-unresolved-edge-deny",
  "html-entry-and-root-envelope",
  "infrastructure-css-canonical-bytes",
  "jsx-owner-origin-allowlist",
  "package-boundary-deny-by-default",
  "plan-and-source-node-literal-deny",
  "production-re-export-deny",
  "postcss-config-and-manifest-deny",
  "react-element-factory-deny",
  "react-root-single-authority",
  "sensitive-runtime-call-directness",
  "source-internal-symlink-deny",
  "source-unknown-extension-deny",
  "source-or-authoring-asset-deny",
  "surfaces-direct-access-deny",
  "workspace-scoped-evidence-paths",
  "vite-config-injection-deny",
  "vite-backing-final-reauthentication",
]);

/** Stable destination for the deterministic M05-T09 source/import audit receipt. */
export const DEFAULT_REFERENCE_HOST_WEB_SOURCE_AUDIT_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_RELATIVE_PATH,
);

/** Human-readable claim document paired with the M05-T09 receipt. */
export const DEFAULT_REFERENCE_HOST_WEB_SOURCE_AUDIT_PROOF_PATH = path.join(
  WORKSPACE_ROOT,
  PROOF_DOCUMENT_RELATIVE_PATH,
);

/** Proof Matrix location that must contain exact contextual M05-T09 pins. */
export const DEFAULT_REFERENCE_HOST_WEB_SOURCE_AUDIT_PROOF_MATRIX_PATH = path.join(
  WORKSPACE_ROOT,
  PROOF_MATRIX_RELATIVE_PATH,
);

/** Project Status location that must contain the exact M05-T09 evidence pin. */
export const DEFAULT_REFERENCE_HOST_WEB_SOURCE_AUDIT_PROJECT_STATUS_PATH = path.join(
  WORKSPACE_ROOT,
  PROJECT_STATUS_RELATIVE_PATH,
);

/** Exact direct predecessor receipts byte-pinned by the M05-T09 proof. */
export const REFERENCE_HOST_WEB_SOURCE_AUDIT_PREREQUISITE_PATHS = Object.freeze(
  PREREQUISITES.map(({ path: relativePath }) => relativePath),
);

/** Stable controlled failure exposed to hostile-input and mutation tests. */
export class ReferenceHostWebSourceAuditEvidenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "ReferenceHostWebSourceAuditEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new ReferenceHostWebSourceAuditEvidenceError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function normalizeSlashes(value) {
  return value.split(path.sep).join("/");
}

function captureOptions(value, allowedKeys, operation) {
  if (value === undefined) return Object.freeze({});
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    utilTypes.isProxy(value)
  ) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID",
      `M05-T09 ${operation} options must be a plain own-data object.`,
    );
  }
  let prototype;
  let keys;
  try {
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID",
      `M05-T09 ${operation} options could not be captured safely.`,
    );
  }
  if (
    (prototype !== Object.prototype && prototype !== null) ||
    keys.some((key) => typeof key !== "string" || !allowedKeys.includes(key))
  ) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID",
      `M05-T09 ${operation} options contain unknown, inherited, or symbol keys.`,
    );
  }
  const captured = Object.create(null);
  for (const key of keys) {
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      fail(
        "REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID",
        `M05-T09 ${operation} option ${key} could not be captured safely.`,
      );
    }
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      fail(
        "REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID",
        `M05-T09 ${operation} option ${key} must be enumerable own data.`,
      );
    }
    captured[key] = descriptor.value;
  }
  return Object.freeze(captured);
}

function optionalString(value, label) {
  if (
    value !== undefined &&
    (typeof value !== "string" || value.length === 0 || value.includes("\0"))
  ) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID",
      `M05-T09 ${label} must be a non-empty safe string.`,
    );
  }
  return value;
}

function optionalText(value, label) {
  const text = optionalString(value, label);
  if (text !== undefined && Buffer.byteLength(text, "utf8") > MAX_DOCUMENT_BYTES) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID",
      `M05-T09 ${label} exceeds its bounded UTF-8 byte limit.`,
    );
  }
  return text;
}

function optionalCallback(value, label) {
  if (value !== undefined && (typeof value !== "function" || utilTypes.isProxy(value))) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID",
      `M05-T09 ${label} must be a non-Proxy function.`,
    );
  }
  return value;
}

function optionalBytes(value, label) {
  if (value === undefined) return undefined;
  if (
    value === null ||
    typeof value !== "object" ||
    utilTypes.isProxy(value) ||
    !utilTypes.isUint8Array(value)
  ) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID",
      `M05-T09 ${label} must be bounded non-shared non-Proxy bytes.`,
    );
  }
  let prototype;
  let backingBuffer;
  let byteLength;
  let byteOffset;
  try {
    prototype = Object.getPrototypeOf(value);
    if (prototype !== Uint8Array.prototype && prototype !== Buffer.prototype) {
      fail(
        "REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID",
        `M05-T09 ${label} must use the exact Buffer or Uint8Array prototype.`,
      );
    }
    backingBuffer = Reflect.apply(TYPED_ARRAY_BUFFER_GETTER, value, []);
    byteLength = Reflect.apply(TYPED_ARRAY_BYTE_LENGTH_GETTER, value, []);
    byteOffset = Reflect.apply(TYPED_ARRAY_BYTE_OFFSET_GETTER, value, []);
  } catch (error) {
    if (error instanceof ReferenceHostWebSourceAuditEvidenceError) throw error;
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID",
      `M05-T09 ${label} could not be captured safely.`,
    );
  }
  if (utilTypes.isSharedArrayBuffer(backingBuffer) || byteLength > MAX_ARTIFACT_BYTES) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID",
      `M05-T09 ${label} must use bounded non-shared backing memory.`,
    );
  }
  try {
    const captured = new Uint8Array(byteLength);
    captured.set(new Uint8Array(backingBuffer, byteOffset, byteLength));
    return Buffer.from(captured);
  } catch {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID",
      `M05-T09 ${label} backing memory is detached or invalid.`,
    );
  }
}

async function resolveWorkspaceRoot(candidate) {
  const resolved = path.resolve(candidate ?? WORKSPACE_ROOT);
  let entry;
  try {
    entry = await lstat(resolved);
  } catch {
    fail("REFERENCE_HOST_SOURCE_AUDIT_INPUT_UNSAFE", "M05-T09 workspace root is missing.");
  }
  if (!entry.isDirectory() || entry.isSymbolicLink()) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_INPUT_UNSAFE",
      "M05-T09 workspace root must be a real directory.",
    );
  }
  const canonical = await realpath(resolved).catch(() => undefined);
  if (canonical === undefined || canonical !== resolved) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_INPUT_UNSAFE",
      "M05-T09 workspace root must be canonical and symlink-free.",
    );
  }
  return canonical;
}

function sameFileState(left, right) {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
  );
}

function validateRelativePath(relativePath) {
  const components = relativePath.split("/");
  return (
    components.length > 0 &&
    components.every(
      (component) =>
        component.length > 0 &&
        component !== "." &&
        component !== ".." &&
        !component.includes("\0"),
    )
  );
}

async function readRegularFile(workspaceRoot, relativePath, maximumBytes = MAX_FILE_BYTES) {
  if (!validateRelativePath(relativePath)) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_INPUT_UNSAFE",
      `M05-T09 workspace path is unsafe: ${relativePath}`,
    );
  }
  let current = workspaceRoot;
  const ancestorStates = [];
  for (const component of relativePath.split("/").slice(0, -1)) {
    current = path.join(current, component);
    const entry = await lstat(current, { bigint: true }).catch(() => undefined);
    if (entry === undefined) {
      fail(
        "REFERENCE_HOST_SOURCE_AUDIT_INPUT_MISSING",
        `Required M05-T09 ancestor is missing: ${relativePath}`,
      );
    }
    if (!entry.isDirectory() || entry.isSymbolicLink()) {
      fail(
        "REFERENCE_HOST_SOURCE_AUDIT_INPUT_UNSAFE",
        `Required M05-T09 path crosses an unsafe ancestor: ${relativePath}`,
      );
    }
    ancestorStates.push(Object.freeze({ path: current, state: entry }));
  }
  const absolutePath = path.join(workspaceRoot, ...relativePath.split("/"));
  const entry = await lstat(absolutePath, { bigint: true }).catch(() => undefined);
  if (entry === undefined) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_INPUT_MISSING",
      `Required M05-T09 file is missing: ${relativePath}`,
    );
  }
  if (!entry.isFile() || entry.isSymbolicLink() || entry.size > BigInt(maximumBytes)) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_INPUT_UNSAFE",
      `Required M05-T09 file is not a bounded regular file: ${relativePath}`,
    );
  }
  const canonical = await realpath(absolutePath).catch(() => undefined);
  if (canonical !== absolutePath || !absolutePath.startsWith(`${workspaceRoot}${path.sep}`)) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_INPUT_UNSAFE",
      `Required M05-T09 file escapes its workspace: ${relativePath}`,
    );
  }
  let handle;
  try {
    handle = await open(
      absolutePath,
      constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0),
    );
    const before = await handle.stat({ bigint: true });
    if (!before.isFile() || !sameFileState(entry, before)) {
      fail(
        "REFERENCE_HOST_SOURCE_AUDIT_INPUT_UNSAFE",
        `Required M05-T09 file changed before its read: ${relativePath}`,
      );
    }
    const bytes = await handle.readFile();
    const after = await handle.stat({ bigint: true });
    if (
      bytes.length !== Number(before.size) ||
      !sameFileState(before, after) ||
      after.size > BigInt(maximumBytes)
    ) {
      fail(
        "REFERENCE_HOST_SOURCE_AUDIT_INPUT_UNSAFE",
        `Required M05-T09 file changed during its read: ${relativePath}`,
      );
    }
    for (const captured of ancestorStates) {
      const ancestorAfter = await lstat(captured.path, { bigint: true }).catch(() => undefined);
      if (
        ancestorAfter === undefined ||
        !ancestorAfter.isDirectory() ||
        ancestorAfter.isSymbolicLink() ||
        !sameDeviceAndInode(captured.state, ancestorAfter)
      ) {
        fail(
          "REFERENCE_HOST_SOURCE_AUDIT_INPUT_UNSAFE",
          `Required M05-T09 ancestor changed during its read: ${relativePath}`,
        );
      }
    }
    const pathAfter = await lstat(absolutePath, { bigint: true }).catch(() => undefined);
    if (
      pathAfter === undefined ||
      !pathAfter.isFile() ||
      pathAfter.isSymbolicLink() ||
      !sameFileState(entry, pathAfter) ||
      (await realpath(absolutePath).catch(() => undefined)) !== absolutePath
    ) {
      fail(
        "REFERENCE_HOST_SOURCE_AUDIT_INPUT_UNSAFE",
        `Required M05-T09 pathname changed during its read: ${relativePath}`,
      );
    }
    return bytes;
  } catch (error) {
    if (error instanceof ReferenceHostWebSourceAuditEvidenceError) throw error;
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_INPUT_UNSAFE",
      `Required M05-T09 file could not be read safely: ${relativePath}`,
      { cause: String(error) },
    );
  } finally {
    if (handle !== undefined) {
      try {
        await handle.close();
      } catch {
        // A controlled primary result remains authoritative.
      }
    }
  }
}

async function readAbsoluteRegularFile(candidatePath, missingCode, unsafeCode, maximumBytes) {
  const absolutePath = path.resolve(candidatePath);
  let entry;
  try {
    entry = await lstat(absolutePath, { bigint: true });
  } catch (error) {
    if (error?.code === "ENOENT") {
      fail(missingCode, `Required M05-T09 file is missing: ${absolutePath}`);
    }
    fail(unsafeCode, `Required M05-T09 file could not be inspected: ${absolutePath}`);
  }
  if (!entry.isFile() || entry.isSymbolicLink() || entry.size > BigInt(maximumBytes)) {
    fail(unsafeCode, `Required M05-T09 file is not a bounded regular file: ${absolutePath}`);
  }
  const canonical = await realpath(absolutePath).catch(() => undefined);
  if (canonical !== absolutePath) {
    fail(unsafeCode, `Required M05-T09 file crosses a symlinked path: ${absolutePath}`);
  }
  const ancestorStates = [];
  let ancestorPath = path.dirname(absolutePath);
  const fileSystemRoot = path.parse(absolutePath).root;
  while (ancestorPath !== fileSystemRoot) {
    const ancestor = await lstat(ancestorPath, { bigint: true }).catch(() => undefined);
    if (ancestor === undefined || !ancestor.isDirectory() || ancestor.isSymbolicLink()) {
      fail(unsafeCode, `Required M05-T09 file crosses an unsafe ancestor: ${absolutePath}`);
    }
    ancestorStates.push(Object.freeze({ path: ancestorPath, state: ancestor }));
    ancestorPath = path.dirname(ancestorPath);
  }
  let handle;
  try {
    handle = await open(
      absolutePath,
      constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0),
    );
    const before = await handle.stat({ bigint: true });
    if (!before.isFile() || !sameFileState(entry, before)) {
      fail(unsafeCode, `Required M05-T09 file changed before its safe read: ${absolutePath}`);
    }
    const bytes = await handle.readFile();
    const after = await handle.stat({ bigint: true });
    if (
      bytes.length !== Number(before.size) ||
      after.size > BigInt(maximumBytes) ||
      !sameFileState(before, after)
    ) {
      fail(unsafeCode, `Required M05-T09 file changed during its safe read: ${absolutePath}`);
    }
    const pathAfter = await lstat(absolutePath, { bigint: true }).catch(() => undefined);
    if (
      pathAfter === undefined ||
      !pathAfter.isFile() ||
      pathAfter.isSymbolicLink() ||
      !sameFileState(entry, pathAfter) ||
      (await realpath(absolutePath).catch(() => undefined)) !== absolutePath
    ) {
      fail(unsafeCode, `Required M05-T09 pathname changed during its read: ${absolutePath}`);
    }
    for (const captured of ancestorStates) {
      const ancestorAfter = await lstat(captured.path, { bigint: true }).catch(() => undefined);
      if (
        ancestorAfter === undefined ||
        !ancestorAfter.isDirectory() ||
        ancestorAfter.isSymbolicLink() ||
        !sameDeviceAndInode(captured.state, ancestorAfter)
      ) {
        fail(unsafeCode, `Required M05-T09 ancestor changed during its read: ${absolutePath}`);
      }
    }
    return bytes;
  } catch (error) {
    if (error instanceof ReferenceHostWebSourceAuditEvidenceError) throw error;
    fail(unsafeCode, `Required M05-T09 file could not be read safely: ${absolutePath}`, {
      cause: String(error),
    });
  } finally {
    if (handle !== undefined) {
      try {
        await handle.close();
      } catch {
        // A controlled primary result remains authoritative.
      }
    }
  }
}

async function resolveCanonicalWorkspaceFile(workspaceRoot, relativeCandidate, label) {
  const candidate = path.join(workspaceRoot, ...relativeCandidate.split("/"));
  const canonical = await realpath(candidate).catch(() => undefined);
  if (
    canonical === undefined ||
    !canonical.startsWith(`${workspaceRoot}${path.sep}`) ||
    !(await lstat(canonical).catch(() => undefined))?.isFile()
  ) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_INPUT_UNSAFE",
      `M05-T09 ${label} does not resolve to a local workspace file.`,
    );
  }
  return Object.freeze({
    absolutePath: canonical,
    relativePath: normalizeSlashes(path.relative(workspaceRoot, canonical)),
  });
}

async function inventoryApplicationSource(workspaceRoot) {
  const sourceRoot = path.join(workspaceRoot, ...APPLICATION_SOURCE_DIRECTORY.split("/"));
  const rootEntry = await lstat(sourceRoot).catch(() => undefined);
  if (
    rootEntry === undefined ||
    !rootEntry.isDirectory() ||
    rootEntry.isSymbolicLink() ||
    (await realpath(sourceRoot).catch(() => undefined)) !== sourceRoot
  ) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_INPUT_UNSAFE",
      "M05-T09 production source root must be one canonical real directory.",
    );
  }
  const discovered = [];
  async function walk(currentDirectory, relativeDirectory) {
    try {
      const directoryBefore = await lstat(currentDirectory, { bigint: true });
      if (
        !directoryBefore.isDirectory() ||
        directoryBefore.isSymbolicLink() ||
        (await realpath(currentDirectory)) !== currentDirectory
      ) {
        fail(
          "REFERENCE_HOST_SOURCE_AUDIT_INPUT_UNSAFE",
          `M05-T09 source traversal crossed an unsafe directory: ${relativeDirectory}`,
        );
      }
      const entries = await readdir(currentDirectory, { withFileTypes: true });
      for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
        const relativePath = `${relativeDirectory}/${entry.name}`;
        const absolutePath = path.join(currentDirectory, entry.name);
        const status = await lstat(absolutePath);
        if (status.isSymbolicLink()) {
          fail(
            "REFERENCE_HOST_SOURCE_AUDIT_INPUT_UNSAFE",
            `M05-T09 source inventory contains a symlink: ${relativePath}`,
          );
        }
        if (status.isDirectory()) {
          await walk(absolutePath, relativePath);
          continue;
        }
        if (
          !status.isFile() ||
          !/\.(?:css|ts|tsx)$/u.test(entry.name) ||
          /\.d\.ts$/u.test(entry.name)
        ) {
          fail(
            "REFERENCE_HOST_SOURCE_AUDIT_SOURCE_DRIFT",
            `M05-T09 source inventory contains an unsupported production entry: ${relativePath}`,
          );
        }
        discovered.push(relativePath);
        if (discovered.length > MAX_SOURCE_FILES) {
          fail(
            "REFERENCE_HOST_SOURCE_AUDIT_INPUT_UNSAFE",
            "M05-T09 production source inventory exceeds its file bound.",
          );
        }
      }
      const directoryAfter = await lstat(currentDirectory, { bigint: true });
      if (
        !directoryAfter.isDirectory() ||
        directoryAfter.isSymbolicLink() ||
        !sameFileState(directoryBefore, directoryAfter) ||
        (await realpath(currentDirectory)) !== currentDirectory
      ) {
        fail(
          "REFERENCE_HOST_SOURCE_AUDIT_INPUT_UNSAFE",
          `M05-T09 source directory changed during traversal: ${relativeDirectory}`,
        );
      }
    } catch (error) {
      if (error instanceof ReferenceHostWebSourceAuditEvidenceError) throw error;
      fail(
        "REFERENCE_HOST_SOURCE_AUDIT_INPUT_UNSAFE",
        `M05-T09 source directory could not be traversed safely: ${relativeDirectory}`,
        { cause: String(error) },
      );
    }
  }
  await walk(sourceRoot, APPLICATION_SOURCE_DIRECTORY);
  discovered.sort();
  if (!discovered.includes(APPLICATION_ENTRY)) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_SOURCE_DRIFT",
      "M05-T09 production source inventory lost its exact entry module.",
    );
  }
  return Object.freeze(discovered);
}

/** Discovers the production source inventory through the same safe walker used by the proof. */
export async function inspectReferenceHostWebSourceInventory(rawOptions = undefined) {
  const options = captureOptions(rawOptions, ["workspaceRoot"], "inventory");
  const workspaceRoot = await resolveWorkspaceRoot(
    optionalString(options.workspaceRoot, "workspaceRoot"),
  );
  return inventoryApplicationSource(workspaceRoot);
}

function captureSourceOverrides(value, sourcePaths) {
  if (value === undefined) return new Map();
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    utilTypes.isProxy(value)
  ) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID",
      "M05-T09 sourceOverrides must be a plain own-data record.",
    );
  }
  let prototype;
  let keys;
  try {
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID",
      "M05-T09 sourceOverrides could not be captured safely.",
    );
  }
  if (
    (prototype !== Object.prototype && prototype !== null) ||
    keys.length > MAX_SOURCE_FILES ||
    keys.some(
      (key) =>
        typeof key !== "string" || !sourcePaths.includes(key) || !/\.(?:css|ts|tsx)$/u.test(key),
    )
  ) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID",
      "M05-T09 sourceOverrides contains unknown, inherited, or symbol paths.",
    );
  }
  const captured = new Map();
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      descriptor === undefined ||
      !descriptor.enumerable ||
      !("value" in descriptor) ||
      typeof descriptor.value !== "string" ||
      Buffer.byteLength(descriptor.value, "utf8") > MAX_FILE_BYTES
    ) {
      fail(
        "REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID",
        `M05-T09 source override must be bounded own-data text: ${String(key)}`,
      );
    }
    captured.set(key, descriptor.value);
  }
  return captured;
}

async function readSourceSnapshot(workspaceRoot, sourcePaths, rawOverrides) {
  const overrides = captureSourceOverrides(rawOverrides, sourcePaths);
  const entries = await Promise.all(
    sourcePaths.map(async (relativePath) => {
      const bytes = await readRegularFile(workspaceRoot, relativePath);
      const text = overrides.get(relativePath) ?? bytes.toString("utf8");
      return Object.freeze({
        path: relativePath,
        bytes: Buffer.byteLength(text, "utf8"),
        sha256: `sha256:${sha256(Buffer.from(text, "utf8"))}`,
        text,
      });
    }),
  );
  return new Map(entries.map((entry) => [entry.path, entry]));
}

function parseTsConfig(workspaceRoot) {
  const configPath = path.join(workspaceRoot, "apps/reference-host-web/tsconfig.json");
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error !== undefined) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_COMPILER_FAILED",
      "M05-T09 could not read the reference-host TypeScript configuration.",
    );
  }
  const parsed = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    path.dirname(configPath),
    undefined,
    configPath,
  );
  if (parsed.errors.length > 0) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_COMPILER_FAILED",
      "M05-T09 TypeScript configuration contains errors.",
    );
  }
  return parsed.options;
}

function createSemanticProgram(workspaceRoot, sourcePaths, files) {
  const options = parseTsConfig(workspaceRoot);
  const rootNames = sourcePaths
    .filter((relativePath) => /\.(?:ts|tsx)$/u.test(relativePath))
    .map((relativePath) => path.join(workspaceRoot, ...relativePath.split("/")));
  const originalHost = ts.createCompilerHost(options, true);
  const sourceTextByAbsolutePath = new Map(
    rootNames.map((absolutePath) => {
      const relativePath = normalizeSlashes(path.relative(workspaceRoot, absolutePath));
      return [absolutePath, files.get(relativePath).text];
    }),
  );
  const host = {
    ...originalHost,
    getSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile) {
      const override = sourceTextByAbsolutePath.get(path.resolve(fileName));
      if (override !== undefined) {
        const scriptKind = fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
        return ts.createSourceFile(fileName, override, languageVersion, true, scriptKind);
      }
      return originalHost.getSourceFile(
        fileName,
        languageVersion,
        onError,
        shouldCreateNewSourceFile,
      );
    },
  };
  const program = ts.createProgram({ rootNames, options, host });
  const diagnostics = ts
    .getPreEmitDiagnostics(program)
    .filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
  return Object.freeze({ program, diagnostics: Object.freeze(diagnostics) });
}

function assertion(condition, message, counter, details = undefined) {
  counter.value += 1;
  if (!condition) {
    fail("REFERENCE_HOST_SOURCE_AUDIT_SOURCE_DRIFT", message, details);
  }
}

function exactArray(actual, expected, message, counter) {
  assertion(isDeepStrictEqual(actual, expected), message, counter, { expected, actual });
}

function importBindings(sourceFile) {
  const bindings = new Map();
  const imports = [];
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
      continue;
    }
    const specifier = statement.moduleSpecifier.text;
    const clause = statement.importClause;
    imports.push(
      Object.freeze({
        specifier,
        typeOnly: clause?.isTypeOnly === true,
      }),
    );
    if (clause?.name !== undefined) {
      bindings.set(
        clause.name.text,
        Object.freeze({ imported: "default", specifier, typeOnly: clause.isTypeOnly }),
      );
    }
    const named = clause?.namedBindings;
    if (named !== undefined && ts.isNamespaceImport(named)) {
      bindings.set(
        named.name.text,
        Object.freeze({ imported: "*", specifier, typeOnly: clause.isTypeOnly }),
      );
    } else if (named !== undefined) {
      for (const element of named.elements) {
        bindings.set(
          element.name.text,
          Object.freeze({
            imported: element.propertyName?.text ?? element.name.text,
            specifier,
            typeOnly: clause.isTypeOnly || element.isTypeOnly,
          }),
        );
      }
    }
  }
  return { bindings, imports };
}

function nearestFunctionOwner(node) {
  let current = node.parent;
  while (current !== undefined) {
    if (ts.isFunctionDeclaration(current) && current.name !== undefined) {
      return current.name.text;
    }
    if (
      (ts.isArrowFunction(current) || ts.isFunctionExpression(current)) &&
      ts.isVariableDeclaration(current.parent) &&
      ts.isIdentifier(current.parent.name)
    ) {
      return current.parent.name.text;
    }
    if (
      (ts.isArrowFunction(current) || ts.isFunctionExpression(current)) &&
      ts.isCallExpression(current.parent) &&
      ts.isVariableDeclaration(current.parent.parent) &&
      ts.isIdentifier(current.parent.parent.name)
    ) {
      return current.parent.parent.name.text;
    }
    if (ts.isMethodDeclaration(current) && current.name !== undefined) {
      return current.name.getText();
    }
    current = current.parent;
  }
  return "<module>";
}

function normalizeDeclarationOrigin(workspaceRoot, fileName) {
  const normalized = normalizeSlashes(fileName);
  if (normalized.startsWith(`${normalizeSlashes(workspaceRoot)}/`)) {
    const relative = normalizeSlashes(path.relative(workspaceRoot, fileName));
    const pnpmMarker = "node_modules/.pnpm/";
    if (relative.startsWith(pnpmMarker)) {
      const nested = relative.lastIndexOf("/node_modules/");
      return nested === -1 ? relative : `node_modules/${relative.slice(nested + 14)}`;
    }
    return relative;
  }
  return normalized;
}

function jsxDescriptor(workspaceRoot, checker, node) {
  const name = node.tagName.getText();
  const owner = nearestFunctionOwner(node);
  if (/^[a-z]/u.test(name)) return `${name}@${owner}@intrinsic`;
  const symbol = checker.getSymbolAtLocation(node.tagName);
  if (symbol === undefined) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_SOURCE_DRIFT",
      "M05-T09 JSX component has no compiler-resolved symbol.",
      { name },
    );
  }
  let target = symbol;
  if ((symbol.flags & ts.SymbolFlags.Alias) !== 0) {
    target = checker.getAliasedSymbol(symbol);
  }
  const origins = [
    ...new Set(
      (target.declarations ?? []).map((declaration) =>
        normalizeDeclarationOrigin(workspaceRoot, declaration.getSourceFile().fileName),
      ),
    ),
  ].sort();
  if (origins.length !== 1) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_SOURCE_DRIFT",
      "M05-T09 JSX component origin is missing or ambiguous.",
      { name, origins },
    );
  }
  return `${name}@${owner}@${origins[0]}`;
}

function objectLiteralKeys(node) {
  return node.properties.flatMap((property) => {
    if (
      (ts.isPropertyAssignment(property) ||
        ts.isShorthandPropertyAssignment(property) ||
        ts.isMethodDeclaration(property)) &&
      property.name !== undefined
    ) {
      if (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) {
        return [property.name.text];
      }
      if (ts.isComputedPropertyName(property.name)) {
        const computed = staticStringValue(property.name.expression);
        return computed === undefined ? [] : [computed];
      }
    }
    return [];
  });
}

function callIdentifier(node) {
  return ts.isIdentifier(node.expression) ? node.expression.text : undefined;
}

function importedCallIdentity(bindings, localName) {
  if (localName === undefined) return undefined;
  const binding = bindings.get(localName);
  if (binding === undefined || binding.typeOnly) return undefined;
  return Object.freeze({
    local: localName,
    imported: binding.imported,
    specifier: binding.specifier,
  });
}

function staticStringValue(node) {
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isParenthesizedExpression(node)) return staticStringValue(node.expression);
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = staticStringValue(node.left);
    const right = staticStringValue(node.right);
    return left === undefined || right === undefined ? undefined : `${left}${right}`;
  }
  return undefined;
}

function unwrapTypeScriptExpression(node) {
  let current = node;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isNonNullExpression(current) ||
    ts.isSatisfiesExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function expressionReferencesBrowserGlobal(node, checker, visitedSymbols = new Set()) {
  const expression = unwrapTypeScriptExpression(node);
  if (ts.isIdentifier(expression)) {
    if (BROWSER_GLOBAL_AUTHORITIES.includes(expression.text)) return true;
    const symbol = checker.getSymbolAtLocation(expression);
    if (symbol === undefined || visitedSymbols.has(symbol)) return false;
    visitedSymbols.add(symbol);
    return (symbol.declarations ?? []).some(
      (declaration) =>
        ts.isVariableDeclaration(declaration) &&
        declaration.initializer !== undefined &&
        expressionReferencesBrowserGlobal(declaration.initializer, checker, visitedSymbols),
    );
  }
  let referencesGlobal = false;
  ts.forEachChild(expression, (child) => {
    if (
      !referencesGlobal &&
      expressionReferencesBrowserGlobal(child, checker, new Set(visitedSymbols))
    ) {
      referencesGlobal = true;
    }
  });
  return referencesGlobal;
}

function expressionHasDomType(node, checker) {
  const type = checker.getTypeAtLocation(unwrapTypeScriptExpression(node));
  const candidates = type.isUnionOrIntersection() ? type.types : [type];
  return candidates.some((candidate) =>
    [candidate.aliasSymbol, candidate.getSymbol()]
      .filter((symbol) => symbol !== undefined)
      .some((symbol) =>
        (symbol.declarations ?? []).some((declaration) =>
          normalizeSlashes(declaration.getSourceFile().fileName).endsWith("/lib.dom.d.ts"),
        ),
      ),
  );
}

function expressionHasCallableType(node, checker) {
  const type = checker.getTypeAtLocation(unwrapTypeScriptExpression(node));
  const candidates = type.isUnionOrIntersection() ? type.types : [type];
  return candidates.some((candidate) => candidate.getCallSignatures().length > 0);
}

function isExactAllowedDomMethodGuard(node, sourceFile, relativePath) {
  if (
    relativePath !== "apps/reference-host-web/src/browser-profile.ts" ||
    node.getText(sourceFile) !== "browser.matchMedia" ||
    !ts.isTypeOfExpression(node.parent) ||
    node.parent.expression !== node ||
    !ts.isBinaryExpression(node.parent.parent) ||
    node.parent.parent.left !== node.parent ||
    node.parent.parent.operatorToken.kind !== ts.SyntaxKind.EqualsEqualsEqualsToken
  ) {
    return false;
  }
  const right = node.parent.parent.right;
  return ts.isStringLiteral(right) && right.text === "function";
}

function hasExactImportedBinding(bindings, name, specifier, imported = name) {
  const binding = bindings.get(name);
  return (
    binding !== undefined &&
    binding.specifier === specifier &&
    binding.imported === imported &&
    binding.typeOnly === false
  );
}

function exactIdentifierImport(checker, node, specifier, imported) {
  if (!ts.isIdentifier(node)) return false;
  const symbol = checker.getSymbolAtLocation(node);
  const declarations = symbol?.declarations ?? [];
  if (declarations.length !== 1) return false;
  const declaration = declarations[0];
  let importDeclaration;
  let importedName;
  if (ts.isImportSpecifier(declaration)) {
    importDeclaration = declaration.parent.parent.parent;
    importedName = declaration.propertyName?.text ?? declaration.name.text;
  } else if (ts.isImportClause(declaration) && declaration.name !== undefined) {
    importDeclaration = declaration.parent;
    importedName = "default";
  } else {
    return false;
  }
  return (
    ts.isImportDeclaration(importDeclaration) &&
    ts.isStringLiteral(importDeclaration.moduleSpecifier) &&
    importDeclaration.moduleSpecifier.text === specifier &&
    importedName === imported
  );
}

function objectProperty(node, name) {
  if (!ts.isObjectLiteralExpression(node)) return undefined;
  const matches = node.properties.filter(
    (property) =>
      ts.isPropertyAssignment(property) &&
      (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) &&
      property.name.text === name,
  );
  return matches.length === 1 ? matches[0].initializer : undefined;
}

function auditDangerousSyntax(sourceFile, relativePath, bindings, checker, counter) {
  let directRenderCalls = 0;
  let registryCalls = 0;
  let renderPreflightCalls = 0;
  let mountCalls = 0;
  let managedHookCalls = 0;
  let reactRootCalls = 0;
  function visit(node) {
    const staticValue = staticStringValue(node);
    if (
      staticValue !== undefined &&
      staticValue.trimStart().toLowerCase().startsWith("javascript:")
    ) {
      assertion(false, `${relativePath} constructs an executable javascript URL.`, counter);
    }
    if (ts.isCallExpression(node)) {
      const identifier = callIdentifier(node);
      const importedCall = importedCallIdentity(bindings, identifier);
      assertion(
        node.expression.kind !== ts.SyntaxKind.ImportKeyword,
        `${relativePath} contains a dynamic import.`,
        counter,
      );
      assertion(
        identifier !== "require" && identifier !== "eval" && identifier !== "Function",
        `${relativePath} contains a dynamic executable primitive.`,
        counter,
      );
      if (
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === "render"
      ) {
        directRenderCalls += 1;
        assertion(
          relativePath === "apps/reference-host-web/src/root.tsx" &&
            node.expression.expression.getText(sourceFile) === "state.root",
          "A production module directly renders outside the one audited React root seam.",
          counter,
        );
      }
      if (ts.isElementAccessExpression(node.expression)) {
        assertion(
          false,
          `${relativePath} invokes a computed method outside the closed call graph.`,
          counter,
        );
      }
      if (ts.isIdentifier(node.expression)) {
        const symbol = checker.getSymbolAtLocation(node.expression);
        const declarations = symbol?.declarations ?? [];
        const fromDom = declarations.some((declaration) =>
          normalizeSlashes(declaration.getSourceFile().fileName).endsWith("/lib.dom.d.ts"),
        );
        assertion(
          !fromDom,
          `${relativePath} invokes a global DOM executable outside the closed allowlist.`,
          counter,
          { call: node.expression.text },
        );
      }
      if (ts.isPropertyAccessExpression(node.expression)) {
        const symbol = checker.getSymbolAtLocation(node.expression.name);
        const declarations = symbol?.declarations ?? [];
        const fromDom = declarations.some((declaration) =>
          normalizeSlashes(declaration.getSourceFile().fileName).endsWith("/lib.dom.d.ts"),
        );
        if (fromDom) {
          assertion(
            ALLOWED_DOM_CALLS[relativePath]?.includes(node.expression.getText(sourceFile)) === true,
            `${relativePath} invokes a DOM method outside the exact infrastructure allowlist.`,
            counter,
            { call: node.expression.getText(sourceFile) },
          );
        }
      }
      if (
        ts.isPropertyAccessExpression(node.expression) &&
        [
          "assign",
          "create",
          "defineProperties",
          "defineProperty",
          "entries",
          "get",
          "getOwnPropertyDescriptor",
          "getOwnPropertyDescriptors",
          "getOwnPropertyNames",
          "getOwnPropertySymbols",
          "getPrototypeOf",
          "keys",
          "ownKeys",
          "set",
          "values",
        ].includes(node.expression.name.text)
      ) {
        const reflectionOwner = node.expression.expression.getText(sourceFile);
        if (
          Object.hasOwn(GLOBAL_AUTHORITY_REFLECTION_METHODS, reflectionOwner) &&
          GLOBAL_AUTHORITY_REFLECTION_METHODS[reflectionOwner].includes(
            node.expression.name.text,
          ) &&
          node.arguments[0] !== undefined
        ) {
          assertion(
            !expressionReferencesBrowserGlobal(node.arguments[0], checker),
            `${relativePath} enumerates or reflects a browser global authority.`,
            counter,
            {
              call: node.expression.getText(sourceFile),
              target: node.arguments[0].getText(sourceFile),
            },
          );
        }
        if (
          ["Object", "Reflect"].includes(reflectionOwner) &&
          [
            "get",
            "getOwnPropertyDescriptor",
            "getOwnPropertyDescriptors",
            "getOwnPropertyNames",
            "getOwnPropertySymbols",
            "getPrototypeOf",
            "ownKeys",
          ].includes(node.expression.name.text) &&
          node.arguments[0] !== undefined
        ) {
          assertion(
            !expressionHasDomType(node.arguments[0], checker),
            `${relativePath} reflects a DOM instance or prototype authority.`,
            counter,
            {
              call: node.expression.getText(sourceFile),
              target: node.arguments[0].getText(sourceFile),
            },
          );
        }
        if (
          ["Object", "Reflect"].includes(reflectionOwner) &&
          node.expression.name.text === "getOwnPropertyDescriptors"
        ) {
          assertion(
            false,
            `${relativePath} introspects an open-ended prototype or descriptor collection.`,
            counter,
            { call: node.expression.getText(sourceFile) },
          );
        }
        if (
          ["Object", "Reflect"].includes(reflectionOwner) &&
          [
            "entries",
            "getOwnPropertyDescriptor",
            "getOwnPropertyNames",
            "getOwnPropertySymbols",
            "getPrototypeOf",
            "keys",
            "ownKeys",
            "values",
          ].includes(node.expression.name.text) &&
          node.arguments[0] !== undefined
        ) {
          assertion(
            !expressionHasCallableType(node.arguments[0], checker),
            `${relativePath} reflects or enumerates a callable authority.`,
            counter,
            { call: node.expression.getText(sourceFile) },
          );
        }
        if (
          reflectionOwner === "Object" &&
          ["assign", "defineProperties", "defineProperty"].includes(node.expression.name.text)
        ) {
          assertion(
            false,
            `${relativePath} contains an open-ended object mutation or descriptor surface.`,
            counter,
          );
        }
        if (
          reflectionOwner === "Object" &&
          node.expression.name.text === "create" &&
          node.arguments.length > 1
        ) {
          assertion(
            false,
            `${relativePath} creates an object with injected property descriptors.`,
            counter,
          );
        }
        if (reflectionOwner === "Reflect" && node.expression.name.text === "set") {
          assertion(
            false,
            `${relativePath} contains an open-ended Reflect.set mutation surface.`,
            counter,
          );
        }
        const sensitiveKey = node.arguments
          .map((argument) => staticStringValue(argument))
          .find((value) =>
            [
              "$$typeof",
              ...DYNAMIC_EXECUTABLE_PROPERTIES,
              "render",
              "srcdoc",
              "style",
              "surfaces",
              ...DOM_REPLACEMENT_PROPERTIES,
            ].includes(value),
          );
        assertion(
          sensitiveKey === undefined,
          `${relativePath} reaches a sensitive executable or tree property indirectly.`,
          counter,
          { sensitiveKey },
        );
        if (
          node.expression.expression.getText(sourceFile) === "Reflect" &&
          ["defineProperty", "get", "set"].includes(node.expression.name.text)
        ) {
          assertion(
            staticStringValue(node.arguments[1]) !== undefined,
            `${relativePath} uses a dynamic Reflect property key.`,
            counter,
          );
        }
        if (
          node.expression.expression.getText(sourceFile) === "Object" &&
          ["getOwnPropertyDescriptor", "getOwnPropertyDescriptors"].includes(
            node.expression.name.text,
          ) &&
          node.arguments[0] !== undefined &&
          ["document", "globalThis", "self", "window"].includes(
            node.arguments[0].getText(sourceFile),
          )
        ) {
          assertion(
            node.arguments.length === 1 || staticStringValue(node.arguments[1]) !== undefined,
            `${relativePath} reflects a browser global with a dynamic property key.`,
            counter,
          );
        }
      }
      if (
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isMetaProperty(node.expression.expression) &&
        node.expression.name.text === "glob"
      ) {
        assertion(false, `${relativePath} contains import.meta.glob.`, counter);
      }
      if (
        ts.isPropertyAccessExpression(node.expression) &&
        ["cloneElement", "createElement", "createFactory"].includes(node.expression.name.text)
      ) {
        assertion(false, `${relativePath} contains a React element-factory escape.`, counter);
      }
      if (
        identifier !== undefined &&
        ["cloneElement", "createElement", "createFactory", "jsx", "jsxs", "jsxDEV"].includes(
          identifier,
        )
      ) {
        assertion(
          false,
          `${relativePath} contains a direct JSX/createElement runtime escape.`,
          counter,
        );
      }
      if (
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === "createElement" &&
        node.arguments[0] !== undefined &&
        ts.isStringLiteral(node.arguments[0]) &&
        node.arguments[0].text.toLowerCase() === "script"
      ) {
        assertion(false, `${relativePath} creates an executable script element.`, counter);
      }
      if (importedCall?.imported === "createRuntimeReactAdapterRegistry") {
        registryCalls += 1;
        assertion(
          importedCall.local === "createRuntimeReactAdapterRegistry" &&
            relativePath === "apps/reference-host-web/src/official-sign-in.ts" &&
            hasExactImportedBinding(bindings, identifier, "@desen/runtime-react") &&
            exactIdentifierImport(
              checker,
              node.expression,
              "@desen/runtime-react",
              "createRuntimeReactAdapterRegistry",
            ) &&
            node.arguments.length === 1 &&
            exactIdentifierImport(
              checker,
              node.arguments[0],
              "@desen/reference-catalog-web/react-adapters",
              "REFERENCE_WEB_REACT_ADAPTER_REGISTRY_INPUT",
            ),
          "The official composition lost its public reference-adapter registry path.",
          counter,
        );
      }
      if (importedCall?.imported === "renderRuntimeReactSurface") {
        renderPreflightCalls += 1;
        assertion(
          importedCall.local === "renderRuntimeReactSurface" &&
            relativePath === "apps/reference-host-web/src/official-sign-in.ts" &&
            hasExactImportedBinding(bindings, identifier, "@desen/runtime-react") &&
            exactIdentifierImport(
              checker,
              node.expression,
              "@desen/runtime-react",
              "renderRuntimeReactSurface",
            ) &&
            node.arguments.length === 1 &&
            ts.isObjectLiteralExpression(node.arguments[0]) &&
            isDeepStrictEqual(objectLiteralKeys(node.arguments[0]).sort(), [
              "catalogSet",
              "registry",
              "session",
              "snapshot",
            ]),
          "The delivered Bundle preflight lost its exact public runtime-react render path.",
          counter,
        );
      }
      if (importedCall?.imported === "mountRuntimeHeadlessSession") {
        mountCalls += 1;
        assertion(
          importedCall.local === "mountRuntimeHeadlessSession" &&
            relativePath === "apps/reference-host-web/src/official-sign-in.ts" &&
            hasExactImportedBinding(bindings, identifier, "@desen/runtime-core") &&
            exactIdentifierImport(
              checker,
              node.expression,
              "@desen/runtime-core",
              "mountRuntimeHeadlessSession",
            ) &&
            node.arguments.length === 1 &&
            ts.isObjectLiteralExpression(node.arguments[0]),
          "The official composition lost its public headless-session mount path.",
          counter,
        );
        if (node.arguments[0] !== undefined && ts.isObjectLiteralExpression(node.arguments[0])) {
          const keys = objectLiteralKeys(node.arguments[0]).sort();
          exactArray(
            keys,
            ["bundle", "catalogs", "hostPorts"],
            "The official session mount input drifted.",
            counter,
          );
          const bundle = objectProperty(node.arguments[0], "bundle");
          const catalogs = objectProperty(node.arguments[0], "catalogs");
          assertion(
            (exactIdentifierImport(
              checker,
              bundle,
              "../../../examples/sign-in/official-derived.bundle.desen.json",
              "default",
            ) ||
              bundle?.getText(sourceFile) === "bundlePolicy.bundle") &&
              ts.isArrayLiteralExpression(catalogs) &&
              catalogs.elements.length === 1 &&
              exactIdentifierImport(
                checker,
                catalogs.elements[0],
                "@desen/reference-catalog-web/catalog.json",
                "default",
              ),
            "The official session mount no longer consumes only the controlled Bundle and Catalog.",
            counter,
          );
        }
      }
      if (importedCall?.imported === "useRuntimeReactSurface") {
        managedHookCalls += 1;
        assertion(
          importedCall.local === "useRuntimeReactSurface" &&
            relativePath === "apps/reference-host-web/src/managed-surface.tsx" &&
            hasExactImportedBinding(bindings, identifier, "@desen/runtime-react") &&
            exactIdentifierImport(
              checker,
              node.expression,
              "@desen/runtime-react",
              "useRuntimeReactSurface",
            ) &&
            node.arguments.length === 1 &&
            node.arguments[0].getText(sourceFile) === "input",
          "The managed surface lost its public runtime-react plan path.",
          counter,
        );
      }
      if (importedCall?.imported === "createRoot") {
        reactRootCalls += 1;
        assertion(
          importedCall.local === "createRoot" &&
            importedCall.specifier === "react-dom/client" &&
            exactIdentifierImport(checker, node.expression, "react-dom/client", "createRoot") &&
            relativePath === "apps/reference-host-web/src/root.tsx" &&
            node.arguments.length === 2 &&
            node.arguments[0].getText(sourceFile) === "captured.container" &&
            node.arguments[1].getText(sourceFile).startsWith("createReferenceHostRootOptions("),
          "The host React root creation seam drifted or was aliased.",
          counter,
        );
      }
    }
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression)) {
      assertion(
        !["Function", "Worker", "SharedWorker"].includes(node.expression.text),
        `${relativePath} contains a dynamic worker or executable constructor.`,
        counter,
      );
    }
    if (
      ts.isIdentifier(node) &&
      ["Function", "SharedWorker", "WebAssembly", "Worker", "eval", "require"].includes(node.text)
    ) {
      assertion(
        false,
        `${relativePath} contains a dynamic executable authority reference.`,
        counter,
        { identifier: node.text },
      );
    }
    if (
      ts.isPropertyAccessExpression(node) &&
      DYNAMIC_EXECUTABLE_PROPERTIES.includes(node.name.text)
    ) {
      assertion(
        false,
        `${relativePath} contains a property-based dynamic executable authority or constructor chain.`,
        counter,
        { property: node.name.text },
      );
    }
    if (
      ts.isPropertyAccessExpression(node) &&
      (node.name.text === "__proto__" ||
        (node.name.text === "prototype" &&
          ALLOWED_INTRINSIC_PROTOTYPE_REFERENCES[relativePath]?.includes(
            node.getText(sourceFile),
          ) !== true))
    ) {
      assertion(false, `${relativePath} reaches an open-ended prototype authority.`, counter, {
        property: node.name.text,
      });
    }
    if (ts.isPropertyAccessExpression(node)) {
      const symbol = checker.getSymbolAtLocation(node.name);
      const declarations = symbol?.declarations ?? [];
      const domMethod = declarations.some(
        (declaration) =>
          normalizeSlashes(declaration.getSourceFile().fileName).endsWith("/lib.dom.d.ts") &&
          (ts.isMethodDeclaration(declaration) || ts.isMethodSignature(declaration)),
      );
      if (domMethod) {
        assertion(
          (ts.isCallExpression(node.parent) &&
            node.parent.expression === node &&
            ALLOWED_DOM_CALLS[relativePath]?.includes(node.getText(sourceFile)) === true) ||
            isExactAllowedDomMethodGuard(node, sourceFile, relativePath),
          `${relativePath} captures or invokes a DOM method outside the exact infrastructure allowlist.`,
          counter,
          { method: node.getText(sourceFile) },
        );
      }
    }
    if (
      ts.isPropertyAccessExpression(node) &&
      ((node.expression.getText(sourceFile) === "window" && node.name.text === "location") ||
        ["href", "innerText", "outerText", "textContent"].includes(node.name.text) ||
        ["className", "cssText", "hidden", "style"].includes(node.name.text) ||
        /^on[a-z]/u.test(node.name.text))
    ) {
      assertion(
        false,
        `${relativePath} reaches an executable URL, event-handler, or DOM text property.`,
        counter,
        { property: node.name.text },
      );
    }
    if (
      ts.isElementAccessExpression(node) &&
      node.argumentExpression !== undefined &&
      staticStringValue(node.argumentExpression) !== undefined &&
      DYNAMIC_EXECUTABLE_PROPERTIES.includes(staticStringValue(node.argumentExpression))
    ) {
      assertion(
        false,
        `${relativePath} contains an indexed dynamic executable authority.`,
        counter,
        { property: staticStringValue(node.argumentExpression) },
      );
    }
    if (
      ts.isElementAccessExpression(node) &&
      node.argumentExpression !== undefined &&
      ["__proto__", "prototype"].includes(staticStringValue(node.argumentExpression))
    ) {
      assertion(false, `${relativePath} reaches an indexed prototype authority.`, counter, {
        property: staticStringValue(node.argumentExpression),
      });
    }
    if (ts.isPropertyAccessExpression(node) && node.name.text === "render") {
      assertion(
        ts.isCallExpression(node.parent) &&
          node.parent.expression === node &&
          relativePath === "apps/reference-host-web/src/root.tsx" &&
          node.expression.getText(sourceFile) === "state.root",
        `${relativePath} captures or reaches a render method outside the exact root call.`,
        counter,
      );
    }
    if (
      ts.isPropertyAccessExpression(node) &&
      DOM_REPLACEMENT_PROPERTIES.includes(node.name.text)
    ) {
      assertion(
        false,
        `${relativePath} contains a handwritten DOM replacement or mutation sink.`,
        counter,
        { property: node.name.text },
      );
    }
    if (
      ts.isPropertyAccessExpression(node) &&
      node.expression.getText(sourceFile) === "document" &&
      ["body", "documentElement"].includes(node.name.text)
    ) {
      assertion(false, `${relativePath} reaches a global document replacement root.`, counter);
    }
    if (
      ts.isElementAccessExpression(node) &&
      node.argumentExpression !== undefined &&
      DOM_REPLACEMENT_PROPERTIES.includes(staticStringValue(node.argumentExpression))
    ) {
      assertion(
        false,
        `${relativePath} contains an indexed handwritten DOM replacement or mutation sink.`,
        counter,
        { property: staticStringValue(node.argumentExpression) },
      );
    }
    if (
      ts.isElementAccessExpression(node) &&
      node.argumentExpression !== undefined &&
      staticStringValue(node.argumentExpression) === "render"
    ) {
      assertion(false, `${relativePath} reaches a computed render method.`, counter);
    }
    if (
      ts.isElementAccessExpression(node) &&
      ["document", "globalThis", "self", "window"].includes(node.expression.getText(sourceFile))
    ) {
      assertion(
        false,
        `${relativePath} uses computed access on a browser global authority.`,
        counter,
      );
    }
    if (ts.isPropertyAccessExpression(node) && node.name.text === "surfaces") {
      assertion(
        false,
        `${relativePath} reaches Bundle.surfaces or a surfaces-shaped escape directly.`,
        counter,
      );
    }
    if (
      ts.isElementAccessExpression(node) &&
      node.argumentExpression !== undefined &&
      staticStringValue(node.argumentExpression) === "surfaces"
    ) {
      assertion(false, `${relativePath} reaches a surfaces-shaped escape directly.`, counter);
    }
    if (ts.isObjectLiteralExpression(node)) {
      const keys = new Set(objectLiteralKeys(node));
      const fakeReactElement =
        keys.has("$$typeof") ||
        (keys.has("type") && keys.has("key") && keys.has("props")) ||
        (keys.has("type") && keys.has("props") && keys.has("children"));
      const planShaped =
        keys.has("capabilityId") ||
        keys.has("componentId") ||
        (keys.has("component") && (keys.has("props") || keys.has("children"))) ||
        (keys.has("nodeId") && (keys.has("children") || keys.has("slots")));
      const domMutationShaped = [...keys].some(
        (key) =>
          [
            "cssText",
            "innerHTML",
            "innerText",
            "outerHTML",
            "outerText",
            "srcdoc",
            "style",
            "textContent",
          ].includes(key) || /^on[a-z]/u.test(key),
      );
      assertion(
        !fakeReactElement,
        `${relativePath} contains a fake React-element-shaped literal.`,
        counter,
      );
      assertion(
        !planShaped,
        `${relativePath} contains a plan, capability, or Source-node-shaped literal.`,
        counter,
      );
      assertion(
        !domMutationShaped,
        `${relativePath} contains a DOM/event/style mutation-shaped object literal.`,
        counter,
      );
    }
    if (ts.isIdentifier(node)) {
      const sensitiveBinding = bindings.get(node.text);
      if (
        sensitiveBinding !== undefined &&
        sensitiveBinding.typeOnly === false &&
        [
          "createRuntimeReactAdapterRegistry",
          "createRoot",
          "mountRuntimeHeadlessSession",
          "useRuntimeReactSurface",
        ].includes(sensitiveBinding.imported)
      ) {
        let importAncestor = node.parent;
        while (
          importAncestor !== undefined &&
          !ts.isImportDeclaration(importAncestor) &&
          !ts.isSourceFile(importAncestor)
        ) {
          importAncestor = importAncestor.parent;
        }
        const exactDirectCall =
          ts.isCallExpression(node.parent) &&
          node.parent.expression === node &&
          node.text === sensitiveBinding.imported;
        assertion(
          ts.isImportDeclaration(importAncestor) || exactDirectCall,
          `${relativePath} aliases or captures a sensitive public runtime call.`,
          counter,
          { imported: sensitiveBinding.imported, local: node.text },
        );
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  if (relativePath === "apps/reference-host-web/src/root.tsx") {
    assertion(
      directRenderCalls === 1,
      "The root module must contain exactly one audited React render call.",
      counter,
    );
  } else {
    assertion(
      directRenderCalls === 0,
      `${relativePath} must not directly render a React tree.`,
      counter,
    );
  }
  assertion(
    reactRootCalls === (relativePath === "apps/reference-host-web/src/root.tsx" ? 1 : 0),
    `${relativePath} contains an unexpected React root construction count.`,
    counter,
  );
  assertion(
    renderPreflightCalls ===
      (relativePath === "apps/reference-host-web/src/official-sign-in.ts" ? 1 : 0),
    `${relativePath} contains an unexpected delivered-Bundle render-preflight count.`,
    counter,
  );
  return { registryCalls, renderPreflightCalls, mountCalls, managedHookCalls, reactRootCalls };
}

function auditImports(sourceFile, relativePath, counter) {
  const { bindings, imports } = importBindings(sourceFile);
  const dataImports = [];
  for (const statement of sourceFile.statements) {
    if (ts.isExportDeclaration(statement) && statement.moduleSpecifier !== undefined) {
      assertion(false, `${relativePath} contains a production re-export edge.`, counter, {
        specifier: ts.isStringLiteral(statement.moduleSpecifier)
          ? statement.moduleSpecifier.text
          : statement.moduleSpecifier.getText(sourceFile),
      });
      continue;
    }
    if (ts.isImportEqualsDeclaration(statement)) {
      assertion(false, `${relativePath} contains an ImportEquals production edge.`, counter);
      continue;
    }
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const specifier = statement.moduleSpecifier.text;
      assertion(
        !["react/jsx-runtime", "react/jsx-dev-runtime"].includes(specifier),
        `${relativePath} imports a JSX runtime directly.`,
        counter,
      );
      if (!specifier.startsWith(".")) {
        assertion(
          ALLOWED_EXTERNAL_IMPORTS.has(specifier),
          `${relativePath} imports an unapproved production dependency.`,
          counter,
          { specifier },
        );
      } else {
        const allowedExternalDataEdge = ALLOWED_DATA_IMPORTS.some(
          (entry) => entry.importer === relativePath && entry.specifier === specifier,
        );
        assertion(
          !specifier.startsWith("../") || allowedExternalDataEdge,
          `${relativePath} escapes the production source directory through a relative import.`,
          counter,
          { specifier },
        );
      }
      if (/\.(?:css|json)$/u.test(specifier)) {
        dataImports.push(Object.freeze({ importer: relativePath, specifier }));
      }
      if (statement.importClause?.namedBindings !== undefined) {
        assertion(
          !ts.isNamespaceImport(statement.importClause.namedBindings),
          `${relativePath} uses a namespace import that can hide component authority.`,
          counter,
          { specifier },
        );
      }
      for (const [localName, binding] of bindings) {
        if (binding.specifier !== specifier) continue;
        if (!specifier.startsWith(".") && binding.typeOnly === false) {
          assertion(
            ALLOWED_EXTERNAL_VALUE_IMPORTS[specifier]?.includes(binding.imported) === true,
            `${relativePath} imports an unapproved external runtime value.`,
            counter,
            { specifier, imported: binding.imported, localName },
          );
        }
        if (
          binding.specifier === "react" &&
          binding.typeOnly === false &&
          ["cloneElement", "createElement", "createFactory"].includes(binding.imported)
        ) {
          assertion(
            false,
            `${relativePath} imports a React element factory directly or by alias.`,
            counter,
            { localName, imported: binding.imported },
          );
        }
      }
    }
  }
  return { bindings, imports, dataImports };
}

function auditSourceLiterals(sourceFile, relativePath, counter) {
  function visit(node) {
    if (ts.isStringLiteralLike(node)) {
      const value = node.text;
      assertion(
        !["$$typeof", "react.element", "react.transitional.element"].includes(value),
        `${relativePath} contains a fake React-element marker.`,
        counter,
      );
      assertion(
        !value.trimStart().toLowerCase().startsWith("javascript:"),
        `${relativePath} contains an executable javascript URL.`,
        counter,
      );
      assertion(
        !value.includes(".source.desen.json") &&
          !value.includes("official-derived.source") &&
          !value.includes("sign-in.source"),
        `${relativePath} references forbidden Source/authoring data.`,
        counter,
      );
      assertion(
        !value.includes("@desen/editor") &&
          !value.includes("@desen/publisher") &&
          !value.includes("@desen/testkit") &&
          !value.includes("@desen/app-web"),
        `${relativePath} references a forbidden authoring, publisher, test, or app layer.`,
        counter,
      );
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
}

function auditCompositionFunctionFingerprints(workspaceRoot, program, counter) {
  const printer = ts.createPrinter({
    newLine: ts.NewLineKind.LineFeed,
    removeComments: true,
  });
  const fingerprints = [];
  for (const expected of EXPECTED_COMPOSITION_FUNCTIONS) {
    const sourceFile = program.getSourceFile(path.join(workspaceRoot, ...expected.path.split("/")));
    assertion(
      sourceFile !== undefined,
      `The semantic program omitted composition source ${expected.path}.`,
      counter,
    );
    const declarations =
      sourceFile?.statements.filter(
        (statement) =>
          ts.isFunctionDeclaration(statement) && statement.name?.text === expected.name,
      ) ?? [];
    assertion(
      declarations.length === 1,
      `Composition function ${expected.name} is missing or ambiguous.`,
      counter,
    );
    const declaration = declarations[0];
    if (sourceFile === undefined || declaration === undefined) continue;
    const normalized = printer.printNode(ts.EmitHint.Unspecified, declaration, sourceFile);
    const actualSha256 = sha256(Buffer.from(normalized, "utf8"));
    assertion(
      actualSha256 === expected.sha256,
      `Composition function ${expected.name} semantic fingerprint drifted.`,
      counter,
      { expected: expected.sha256, actual: actualSha256 },
    );
    fingerprints.push(
      Object.freeze({
        path: expected.path,
        name: expected.name,
        sha256: `sha256:${actualSha256}`,
        normalization: "TypeScript Printer(removeComments=true, LF)",
      }),
    );
  }
  return Object.freeze(fingerprints);
}

function executableSymbolOrigins(workspaceRoot, checker, expression) {
  const symbolNode = ts.isPropertyAccessExpression(expression) ? expression.name : expression;
  let symbol = checker.getSymbolAtLocation(symbolNode);
  if (symbol !== undefined && (symbol.flags & ts.SymbolFlags.Alias) !== 0) {
    symbol = checker.getAliasedSymbol(symbol);
  }
  const origins = [
    ...new Set(
      (symbol?.declarations ?? []).map((declaration) =>
        normalizeDeclarationOrigin(workspaceRoot, declaration.getSourceFile().fileName),
      ),
    ),
  ].sort();
  return origins.length === 0 ? Object.freeze(["<unresolved>"]) : Object.freeze(origins);
}

function auditExecutableAuthoritySurface(workspaceRoot, program, sourcePaths, counter) {
  const printer = ts.createPrinter({
    newLine: ts.NewLineKind.LineFeed,
    removeComments: true,
  });
  const checker = program.getTypeChecker();
  const descriptors = [];
  const assignmentOperators = new Set([
    ts.SyntaxKind.AmpersandAmpersandEqualsToken,
    ts.SyntaxKind.AmpersandEqualsToken,
    ts.SyntaxKind.AsteriskAsteriskEqualsToken,
    ts.SyntaxKind.AsteriskEqualsToken,
    ts.SyntaxKind.BarBarEqualsToken,
    ts.SyntaxKind.BarEqualsToken,
    ts.SyntaxKind.CaretEqualsToken,
    ts.SyntaxKind.EqualsToken,
    ts.SyntaxKind.GreaterThanGreaterThanEqualsToken,
    ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken,
    ts.SyntaxKind.LessThanLessThanEqualsToken,
    ts.SyntaxKind.MinusEqualsToken,
    ts.SyntaxKind.PercentEqualsToken,
    ts.SyntaxKind.PlusEqualsToken,
    ts.SyntaxKind.QuestionQuestionEqualsToken,
    ts.SyntaxKind.SlashEqualsToken,
  ]);
  for (const relativePath of sourcePaths) {
    if (relativePath.endsWith(".css")) continue;
    const sourceFile = program.getSourceFile(path.join(workspaceRoot, ...relativePath.split("/")));
    if (sourceFile === undefined) continue;
    function record(kind, node, authorityExpression) {
      descriptors.push(
        Object.freeze({
          path: relativePath,
          owner: nearestFunctionOwner(node),
          kind,
          authority: printer.printNode(ts.EmitHint.Expression, authorityExpression, sourceFile),
          origins: executableSymbolOrigins(workspaceRoot, checker, authorityExpression),
          syntax: printer.printNode(ts.EmitHint.Unspecified, node, sourceFile),
        }),
      );
    }
    function visit(node) {
      if (ts.isCallExpression(node)) {
        record("call", node, node.expression);
      } else if (ts.isNewExpression(node)) {
        record("construct", node, node.expression);
      } else if (ts.isTaggedTemplateExpression(node)) {
        record("tagged-template", node, node.tag);
      } else if (
        ts.isBinaryExpression(node) &&
        assignmentOperators.has(node.operatorToken.kind) &&
        (ts.isPropertyAccessExpression(node.left) || ts.isElementAccessExpression(node.left))
      ) {
        record("property-write", node, node.left);
      } else if (
        (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
        [ts.SyntaxKind.MinusMinusToken, ts.SyntaxKind.PlusPlusToken].includes(node.operator) &&
        (ts.isPropertyAccessExpression(node.operand) || ts.isElementAccessExpression(node.operand))
      ) {
        record("property-update", node, node.operand);
      } else if (
        ts.isDeleteExpression(node) &&
        (ts.isPropertyAccessExpression(node.expression) ||
          ts.isElementAccessExpression(node.expression))
      ) {
        record("property-delete", node, node.expression);
      }
      ts.forEachChild(node, visit);
    }
    visit(sourceFile);
  }
  const actualSha256 = sha256(Buffer.from(JSON.stringify(descriptors), "utf8"));
  assertion(
    actualSha256 === EXPECTED_EXECUTABLE_SURFACE_SHA256,
    "The closed executable call/property-write authority surface drifted.",
    counter,
    {
      expected: EXPECTED_EXECUTABLE_SURFACE_SHA256,
      actual: actualSha256,
      descriptors: descriptors.length,
    },
  );
  return Object.freeze({
    descriptors: descriptors.length,
    sha256: `sha256:${actualSha256}`,
    normalization:
      "TypeScript checker origins + Printer(removeComments=true, LF) call/construct/write descriptors",
  });
}

function auditInfrastructureCss(files, counter) {
  const css = files.get("apps/reference-host-web/src/styles.css").text;
  const withoutComments = css
    .replace(/\/\*[\s\S]*?\*\//gu, "")
    .replace(/\\([0-9a-f]{1,6})\s?/giu, (_match, hex) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/\\(.)/gu, "$1");
  const forbidden = [
    Object.freeze({ pattern: /@import\b/iu, policy: "imports" }),
    Object.freeze({ pattern: /\bcontent\s*:/iu, policy: "generated content" }),
    Object.freeze({ pattern: /::(?:after|before)\b/iu, policy: "generated pseudo-element" }),
    Object.freeze({ pattern: /\bdisplay\s*:\s*none\b/iu, policy: "hidden host" }),
    Object.freeze({ pattern: /\bvisibility\s*:\s*hidden\b/iu, policy: "hidden host" }),
    Object.freeze({ pattern: /\bopacity\s*:\s*0(?:\D|$)/iu, policy: "transparent host" }),
    Object.freeze({ pattern: /\bposition\s*:\s*fixed\b/iu, policy: "viewport overlay" }),
    Object.freeze({ pattern: /\burl\s*\(/iu, policy: "external visual asset" }),
    Object.freeze({
      pattern: /\b(?:(?:-webkit-)?image-set|image)\s*\(/iu,
      policy: "generated image function",
    }),
    Object.freeze({ pattern: /\bdata\s*:/iu, policy: "embedded data payload" }),
    Object.freeze({
      pattern:
        /\b(?:conic|linear|radial|repeating-conic|repeating-linear|repeating-radial)-gradient\s*\(/iu,
      policy: "generated gradient image",
    }),
    Object.freeze({
      pattern: /(?:^|[;{}])\s*(?:-webkit-)?mask(?:-[a-z-]+)?\s*:/imu,
      policy: "masking",
    }),
    Object.freeze({
      pattern: /(?:^|[;{}])\s*(?:backdrop-)?filter\s*:/imu,
      policy: "filtering",
    }),
    Object.freeze({
      pattern: /(?:^|[;{}])\s*transform\s*:/imu,
      policy: "transform",
    }),
    Object.freeze({
      pattern: /(?:^|[;{}])\s*scale\s*:/imu,
      policy: "scale",
    }),
    Object.freeze({
      pattern: /(?:^|[;{}])\s*clip(?:-path)?\s*:/imu,
      policy: "clipping",
    }),
  ];
  for (const entry of forbidden) {
    assertion(
      !entry.pattern.test(withoutComments),
      `Host infrastructure CSS contains forbidden ${entry.policy}.`,
      counter,
    );
  }
  const actualSha256 = sha256(Buffer.from(css, "utf8"));
  assertion(
    actualSha256 === EXPECTED_INFRASTRUCTURE_CSS_SHA256,
    "Host infrastructure CSS bytes drifted from the frozen canonical stylesheet.",
    counter,
    {
      expected: EXPECTED_INFRASTRUCTURE_CSS_SHA256,
      actual: actualSha256,
    },
  );
  return Object.freeze({
    path: "apps/reference-host-web/src/styles.css",
    sha256: `sha256:${actualSha256}`,
    forbiddenVisualSubstitutionPolicies: forbidden.map(({ policy }) => policy),
  });
}

function auditSemanticSource(workspaceRoot, sourcePaths, files) {
  const { program, diagnostics } = createSemanticProgram(workspaceRoot, sourcePaths, files);
  const checker = program.getTypeChecker();
  const counter = { value: 0 };
  const actualDataImports = [];
  const jsxByFile = Object.create(null);
  let registryCalls = 0;
  let renderPreflightCalls = 0;
  let mountCalls = 0;
  let managedHookCalls = 0;
  let reactRootCalls = 0;
  let importCount = 0;
  for (const relativePath of sourcePaths) {
    if (relativePath.endsWith(".css")) continue;
    const absolutePath = path.join(workspaceRoot, ...relativePath.split("/"));
    const sourceFile = program.getSourceFile(absolutePath);
    assertion(sourceFile !== undefined, `The semantic program omitted ${relativePath}.`, counter);
    if (sourceFile === undefined) continue;
    const importAudit = auditImports(sourceFile, relativePath, counter);
    importCount += importAudit.imports.length;
    actualDataImports.push(...importAudit.dataImports);
    auditSourceLiterals(sourceFile, relativePath, counter);
    const syntax = auditDangerousSyntax(
      sourceFile,
      relativePath,
      importAudit.bindings,
      checker,
      counter,
    );
    registryCalls += syntax.registryCalls;
    renderPreflightCalls += syntax.renderPreflightCalls;
    mountCalls += syntax.mountCalls;
    managedHookCalls += syntax.managedHookCalls;
    reactRootCalls += syntax.reactRootCalls;
    const descriptors = [];
    function visit(node) {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        descriptors.push(jsxDescriptor(workspaceRoot, checker, node));
      }
      ts.forEachChild(node, visit);
    }
    visit(sourceFile);
    jsxByFile[relativePath] = Object.freeze(descriptors);
    exactArray(
      descriptors,
      EXPECTED_JSX[relativePath] ?? [],
      `${relativePath} JSX ownership or inventory drifted.`,
      counter,
    );
  }
  exactArray(
    actualDataImports.map(({ importer, specifier }) => `${importer} -> ${specifier}`).sort(),
    ALLOWED_DATA_IMPORTS.map(({ importer, specifier }) => `${importer} -> ${specifier}`).sort(),
    "The production source data-import allowlist drifted.",
    counter,
  );
  assertion(
    registryCalls === 1,
    "Production source must create exactly one public reference-adapter registry.",
    counter,
  );
  assertion(
    renderPreflightCalls === 1,
    "Production source must preflight exactly one delivered Bundle through runtime-react.",
    counter,
  );
  assertion(
    mountCalls === 1,
    "Production source must mount exactly one controlled headless session path.",
    counter,
  );
  assertion(
    managedHookCalls === 1,
    "Production source must expose exactly one runtime-react managed plan hook.",
    counter,
  );
  assertion(
    reactRootCalls === 1,
    "Production source must create exactly one audited React root.",
    counter,
  );
  const compositionFunctions = auditCompositionFunctionFingerprints(
    workspaceRoot,
    program,
    counter,
  );
  const executableAuthoritySurface = auditExecutableAuthoritySurface(
    workspaceRoot,
    program,
    sourcePaths,
    counter,
  );
  const css = auditInfrastructureCss(files, counter);
  const managedSource = files.get("apps/reference-host-web/src/managed-surface.tsx").text;
  assertion(
    /<RuntimeReactSurfaceBoundary[\s\S]*\bresult=\{result\}[\s\S]*\/>/u.test(managedSource),
    "The runtime-react result no longer reaches the public surface boundary directly.",
    counter,
  );
  if (diagnostics.length > 0) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_COMPILER_FAILED",
      "M05-T09 semantic TypeScript program rejected the production source snapshot.",
      {
        diagnostics: diagnostics
          .slice(0, 8)
          .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")),
      },
    );
  }
  return deepFreeze({
    compiler: `typescript@${ts.version}`,
    compilerAuthority: "TypeScript Program and TypeChecker",
    sourceFiles: sourcePaths.length,
    executableSourceFiles: sourcePaths.filter((entry) => !entry.endsWith(".css")).length,
    importDeclarations: importCount,
    jsxElements: Object.values(jsxByFile).reduce((total, entries) => total + entries.length, 0),
    jsxByFile,
    dataImports: ALLOWED_DATA_IMPORTS,
    compositionFunctions,
    executableAuthoritySurface,
    css,
    publicAdapterRegistryCalls: registryCalls,
    publicRuntimeReactRenderPreflightCalls: renderPreflightCalls,
    publicHeadlessMountCalls: mountCalls,
    publicRuntimeReactSurfaceCalls: managedHookCalls,
    publicReactRootCalls: reactRootCalls,
    assertions: counter.value,
  });
}

function normalizeGraphId(workspaceRoot, rawId) {
  let id = rawId;
  let prefix = "";
  if (id.startsWith("\0")) {
    prefix = "virtual:";
    id = id.slice(1);
  }
  const queryIndex = id.indexOf("?");
  const query = queryIndex === -1 ? "" : id.slice(queryIndex);
  const base = queryIndex === -1 ? id : id.slice(0, queryIndex);
  if (path.isAbsolute(base)) {
    const relative = normalizeSlashes(path.relative(workspaceRoot, base));
    if (!relative.startsWith("../") && relative !== "..") {
      const nested = relative.lastIndexOf("/node_modules/");
      const normalized =
        relative.startsWith("node_modules/.pnpm/") && nested !== -1
          ? `node_modules/${relative.slice(nested + 14)}`
          : relative;
      return `${prefix}${normalized}${query}`;
    }
  }
  return `${prefix}${normalizeSlashes(base)}${query}`;
}

async function runObservedViteBuild(workspaceRoot) {
  const viteModulePath = path.join(
    workspaceRoot,
    "apps/reference-host-web/node_modules/vite/dist/node/index.js",
  );
  const vite = await import(pathToFileURL(viteModulePath).href);
  if (vite.version !== "8.1.5" || typeof vite.build !== "function") {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_BUILD_FAILED",
      "M05-T09 requires the pinned Vite 8.1.5 programmatic build API.",
    );
  }
  const observed = [];
  try {
    await vite.build({
      root: path.join(workspaceRoot, "apps/reference-host-web"),
      configFile: false,
      logLevel: "silent",
      build: { write: false },
      plugins: [
        {
          name: "desen-reference-host-source-audit-observer",
          enforce: "post",
          moduleParsed(moduleInfo) {
            if (
              typeof moduleInfo.code !== "string" ||
              Buffer.byteLength(moduleInfo.code, "utf8") > MAX_FILE_BYTES
            ) {
              fail(
                "REFERENCE_HOST_SOURCE_AUDIT_GRAPH_DRIFT",
                "The Vite observer received missing or oversized transformed module code.",
              );
            }
            observed.push(
              Object.freeze({
                id: moduleInfo.id,
                imports: Object.freeze([...moduleInfo.importedIds]),
                dynamicImports: Object.freeze([...moduleInfo.dynamicallyImportedIds]),
                codeBytes: Buffer.byteLength(moduleInfo.code, "utf8"),
                codeSha256: `sha256:${sha256(Buffer.from(moduleInfo.code, "utf8"))}`,
              }),
            );
          },
        },
      ],
    });
  } catch (error) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_BUILD_FAILED",
      "The real Vite 8 programmatic build failed under the M05-T09 observer.",
      { cause: String(error) },
    );
  }
  const normalizedWithBackingCandidates = observed.map((module) => {
    const id = normalizeGraphId(workspaceRoot, module.id);
    const queryIndex = module.id.indexOf("?");
    const rawBase = queryIndex === -1 ? module.id : module.id.slice(0, queryIndex);
    return Object.freeze({
      module: Object.freeze({
        id,
        imports: Object.freeze(
          module.imports.map((entry) => normalizeGraphId(workspaceRoot, entry)).sort(),
        ),
        dynamicImports: Object.freeze(
          module.dynamicImports.map((entry) => normalizeGraphId(workspaceRoot, entry)).sort(),
        ),
        codeBytes: module.codeBytes,
        codeSha256: module.codeSha256,
      }),
      rawBase,
    });
  });
  const graph = normalizedWithBackingCandidates
    .map(({ module }) => module)
    .sort((left, right) => left.id.localeCompare(right.id));
  const backingModules = [];
  for (const { module, rawBase } of normalizedWithBackingCandidates) {
    if (module.id.startsWith("virtual:")) continue;
    if (!path.isAbsolute(rawBase)) {
      fail(
        "REFERENCE_HOST_SOURCE_AUDIT_GRAPH_DRIFT",
        "A non-virtual Vite graph module has no local absolute backing file.",
        { module: module.id },
      );
    }
    const canonical = await realpath(rawBase).catch(() => undefined);
    if (canonical === undefined || !canonical.startsWith(`${workspaceRoot}${path.sep}`)) {
      fail(
        "REFERENCE_HOST_SOURCE_AUDIT_GRAPH_DRIFT",
        "A Vite graph backing module escapes the audited workspace.",
        { module: module.id },
      );
    }
    backingModules.push(
      Object.freeze({
        id: module.id,
        path: normalizeSlashes(path.relative(workspaceRoot, canonical)),
      }),
    );
  }
  backingModules.sort((left, right) => left.id.localeCompare(right.id));
  return Object.freeze({
    graph: Object.freeze(graph),
    backingModules: Object.freeze(backingModules),
  });
}

function findGraphModule(graph, id) {
  return graph.find((entry) => entry.id === id);
}

const ALLOWED_RUNTIME_PACKAGE_EDGES = Object.freeze({
  "catalog-sdk": Object.freeze(["catalog-sdk", "protocol"]),
  protocol: Object.freeze(["protocol"]),
  "reference-catalog-web": Object.freeze([
    "catalog-sdk",
    "protocol",
    "reference-catalog-web",
    "runtime-react",
  ]),
  "runtime-core": Object.freeze(["protocol", "runtime-core", "validator"]),
  "runtime-react": Object.freeze(["protocol", "runtime-core", "runtime-react", "validator"]),
  "runtime-web": Object.freeze(["protocol", "runtime-core", "runtime-web", "validator"]),
  validator: Object.freeze(["protocol", "validator"]),
});

function runtimePackageName(moduleId) {
  const match = /^packages\/([^/]+)\//u.exec(moduleId);
  return match?.[1];
}

function auditViteGraph(graph, sourcePaths) {
  const counter = { value: 0 };
  const graphIds = graph.map(({ id }) => id);
  assertion(
    new Set(graphIds).size === graphIds.length,
    "The normalized Vite graph contains ambiguous duplicate module identifiers.",
    counter,
  );
  const graphIdSet = new Set(graphIds);
  const dynamicEdges = graph.reduce((total, module) => total + module.dynamicImports.length, 0);
  assertion(dynamicEdges === 0, "The Vite runtime graph contains a dynamic import edge.", counter);
  const unresolvedEdges = graph.flatMap((module) =>
    [...module.imports, ...module.dynamicImports]
      .filter((imported) => !graphIdSet.has(imported))
      .map((imported) => `${module.id} -> ${imported}`),
  );
  exactArray(
    unresolvedEdges,
    [],
    "The Vite moduleParsed graph contains an unresolved or externalized runtime edge.",
    counter,
  );
  for (const module of graph) {
    const allowedModule =
      module.id === "apps/reference-host-web/index.html" ||
      module.id.startsWith(`${APPLICATION_SOURCE_DIRECTORY}/`) ||
      EXPECTED_GRAPH_DATA_MODULES.includes(module.id) ||
      module.id === "virtual:vite/modulepreload-polyfill.js" ||
      /^node_modules\/(?:react|react-dom|scheduler)\//u.test(module.id) ||
      Object.hasOwn(ALLOWED_RUNTIME_PACKAGE_EDGES, runtimePackageName(module.id));
    assertion(
      allowedModule,
      "The Vite graph contains a module outside the closed transitive runtime envelope.",
      counter,
      { module: module.id },
    );
    const sourcePackage = runtimePackageName(module.id);
    if (sourcePackage !== undefined) {
      for (const imported of module.imports) {
        const targetPackage = runtimePackageName(imported);
        if (targetPackage === undefined) continue;
        assertion(
          ALLOWED_RUNTIME_PACKAGE_EDGES[sourcePackage]?.includes(targetPackage) === true,
          "A transitive workspace-package edge violates the closed runtime architecture.",
          counter,
          { importer: module.id, imported },
        );
      }
    }
  }
  const sourceModules = sourcePaths.filter(
    (relativePath) => relativePath.endsWith(".css") || /\.(?:ts|tsx)$/u.test(relativePath),
  );
  exactArray(
    graphIds.filter((id) => id.startsWith(`${APPLICATION_SOURCE_DIRECTORY}/`)).sort(),
    [...sourceModules].sort(),
    "The real Vite graph has an orphan or unexpected production source module.",
    counter,
  );
  for (const required of REQUIRED_RUNTIME_GRAPH_MODULES) {
    assertion(
      graphIds.includes(required),
      "The real runtime graph lost a required public adapter or runtime-react module.",
      counter,
      { required },
    );
  }
  exactArray(
    graphIds.filter((id) => /\.(?:css|json)(?:\?|$)/u.test(id)).sort(),
    [...EXPECTED_GRAPH_DATA_MODULES].sort(),
    "The real runtime graph data-asset inventory drifted.",
    counter,
  );
  const entry = findGraphModule(graph, APPLICATION_ENTRY);
  assertion(entry !== undefined, "The real Vite graph lost the application entry.", counter);
  const reachable = new Set();
  const pending = entry === undefined ? [] : [entry.id];
  while (pending.length > 0) {
    const id = pending.pop();
    if (reachable.has(id)) continue;
    reachable.add(id);
    const module = findGraphModule(graph, id);
    if (module === undefined) continue;
    for (const imported of module.imports) {
      if (!reachable.has(imported)) pending.push(imported);
    }
  }
  for (const relativePath of sourcePaths) {
    assertion(
      reachable.has(relativePath),
      "A production source file is not reachable from the real Vite entry.",
      counter,
      { relativePath },
    );
  }
  for (const module of graph.filter(({ id }) =>
    id.startsWith(`${APPLICATION_SOURCE_DIRECTORY}/`),
  )) {
    for (const imported of module.imports) {
      assertion(
        imported.startsWith(`${APPLICATION_SOURCE_DIRECTORY}/`) ||
          imported.startsWith("node_modules/react/") ||
          imported.startsWith("node_modules/react-dom/") ||
          imported.startsWith("packages/reference-catalog-web/") ||
          imported.startsWith("packages/runtime-core/") ||
          imported.startsWith("packages/runtime-react/") ||
          imported.startsWith("packages/runtime-web/") ||
          imported === "examples/sign-in/official-derived.bundle.desen.json",
        "An application source module resolves to a forbidden runtime dependency.",
        counter,
        { importer: module.id, imported },
      );
    }
  }
  const official = findGraphModule(graph, "apps/reference-host-web/src/official-sign-in.ts");
  assertion(
    official?.imports.includes("packages/reference-catalog-web/dist/react-adapters/index.js") ===
      true && official.imports.includes("packages/runtime-react/dist/index.js") === true,
    "The official production module no longer resolves through both public adapter and runtime-react entrypoints.",
    counter,
  );
  const managed = findGraphModule(graph, "apps/reference-host-web/src/managed-surface.tsx");
  assertion(
    managed?.imports.includes("packages/runtime-react/dist/index.js") === true,
    "The managed surface no longer resolves through the public runtime-react entrypoint.",
    counter,
  );
  const runtimeReact = findGraphModule(graph, "packages/runtime-react/dist/index.js");
  assertion(
    runtimeReact?.imports.includes("packages/runtime-react/dist/render-plan.js") === true &&
      runtimeReact.imports.includes("packages/runtime-react/dist/live-surface.js") === true,
    "The public runtime-react entrypoint no longer reaches its render-plan/live-surface path.",
    counter,
  );
  const adapters = findGraphModule(
    graph,
    "packages/reference-catalog-web/dist/react-adapters/index.js",
  );
  for (const component of ["alert", "button", "stack", "text", "text-field"]) {
    assertion(
      adapters?.imports.includes(
        `packages/reference-catalog-web/dist/components/${component}.js`,
      ) === true,
      "The public reference adapter registry lost a controlled component implementation.",
      counter,
      { component },
    );
  }
  const staticEdges = graph.reduce((total, module) => total + module.imports.length, 0);
  return deepFreeze({
    tool: `vite@8.1.5`,
    authority: "programmatic build({ write: false }) Plugin.moduleParsed",
    write: false,
    observer: "moduleParsed",
    moduleCount: graph.length,
    staticEdges,
    dynamicEdges,
    unresolvedEdges: 0,
    reachableProductionSourceFiles: sourcePaths.length,
    dataModules: EXPECTED_GRAPH_DATA_MODULES,
    graphSha256: `sha256:${sha256(Buffer.from(JSON.stringify(graph)))}`,
    modules: graph,
    assertions: counter.value,
  });
}

function captureDenseArray(value, label, maximumEntries, captureEntry) {
  if (
    !Array.isArray(value) ||
    utilTypes.isProxy(value) ||
    Object.getPrototypeOf(value) !== Array.prototype
  ) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID",
      `M05-T09 ${label} must be an exact dense intrinsic Array.`,
    );
  }
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  if (
    lengthDescriptor === undefined ||
    !("value" in lengthDescriptor) ||
    !Number.isSafeInteger(lengthDescriptor.value) ||
    lengthDescriptor.value < 0 ||
    lengthDescriptor.value > maximumEntries
  ) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID",
      `M05-T09 ${label} has an invalid or oversized length.`,
    );
  }
  const length = lengthDescriptor.value;
  const expectedKeys = Array.from({ length }, (_, index) => String(index)).concat("length");
  const keys = Reflect.ownKeys(value);
  if (!isDeepStrictEqual(keys, expectedKeys)) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID",
      `M05-T09 ${label} contains holes, accessors, symbols, or extra properties.`,
    );
  }
  const captured = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      fail(
        "REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID",
        `M05-T09 ${label} entries must be enumerable own data.`,
      );
    }
    captured.push(captureEntry(descriptor.value, index));
  }
  return Object.freeze(captured);
}

function captureStringArray(value, label, maximumEntries) {
  return captureDenseArray(value, label, maximumEntries, (entry) => {
    if (
      typeof entry !== "string" ||
      entry.length === 0 ||
      entry.length > 4_096 ||
      entry.includes("\0")
    ) {
      fail(
        "REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID",
        `M05-T09 ${label} contains an unsafe string.`,
      );
    }
    return entry;
  });
}

/**
 * Applies the exact production Vite-graph policy to a bounded captured graph snapshot.
 *
 * @remarks This seam lets hostile-mutation tests exercise the same closed policy that the real
 * `moduleParsed` observer invokes; it is not an alternate source of runtime-resolution evidence.
 */
export function verifyReferenceHostWebSourceGraphPolicy(rawGraph, rawSourcePaths) {
  const sourcePaths = captureStringArray(rawSourcePaths, "sourcePaths", MAX_SOURCE_FILES);
  const graph = captureDenseArray(rawGraph, "graph", 512, (entry) => {
    if (
      entry === null ||
      typeof entry !== "object" ||
      Array.isArray(entry) ||
      utilTypes.isProxy(entry)
    ) {
      fail(
        "REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID",
        "M05-T09 graph entry must be a plain own-data object.",
      );
    }
    const prototype = Object.getPrototypeOf(entry);
    const keys = Reflect.ownKeys(entry);
    if (
      (prototype !== Object.prototype && prototype !== null) ||
      !isDeepStrictEqual(keys.filter((key) => typeof key === "string").sort(), GRAPH_ENTRY_KEYS) ||
      keys.some((key) => typeof key !== "string")
    ) {
      fail(
        "REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID",
        "M05-T09 graph entry contains unknown, inherited, or symbol keys.",
      );
    }
    const values = Object.create(null);
    for (const key of GRAPH_ENTRY_KEYS) {
      const descriptor = Object.getOwnPropertyDescriptor(entry, key);
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
        fail(
          "REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID",
          "M05-T09 graph entry fields must be enumerable own data.",
        );
      }
      values[key] = descriptor.value;
    }
    if (
      !Number.isSafeInteger(values.codeBytes) ||
      values.codeBytes < 0 ||
      values.codeBytes > MAX_FILE_BYTES ||
      typeof values.codeSha256 !== "string" ||
      !/^sha256:[0-9a-f]{64}$/u.test(values.codeSha256) ||
      (values.codeBytes === 0 && values.codeSha256 !== EMPTY_SHA256)
    ) {
      fail(
        "REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID",
        "M05-T09 graph entry codeBytes/codeSha256 evidence is malformed.",
      );
    }
    return Object.freeze({
      id: captureStringArray([values.id], "graph.id", 1)[0],
      imports: captureStringArray(values.imports, "graph.imports", 1_024),
      dynamicImports: captureStringArray(values.dynamicImports, "graph.dynamicImports", 1_024),
      codeBytes: values.codeBytes,
      codeSha256: values.codeSha256,
    });
  });
  return auditViteGraph(graph, sourcePaths);
}

const BACKING_SNAPSHOT_KEYS = Object.freeze([
  "bytes",
  "ctimeNs",
  "dev",
  "id",
  "ino",
  "mtimeNs",
  "path",
  "sha256",
  "size",
]);

async function captureViteBackingSnapshot(workspaceRoot, backingModules) {
  return Object.freeze(
    await Promise.all(
      backingModules.map(async ({ id, path: relativePath }) => {
        const absolutePath = path.join(workspaceRoot, ...relativePath.split("/"));
        const before = await lstat(absolutePath, { bigint: true }).catch(() => undefined);
        if (
          before === undefined ||
          !before.isFile() ||
          before.isSymbolicLink() ||
          before.size > BigInt(MAX_FILE_BYTES)
        ) {
          fail(
            "REFERENCE_HOST_SOURCE_AUDIT_INPUT_UNSAFE",
            `Vite backing module is not a bounded regular file: ${relativePath}`,
          );
        }
        const bytes = await readRegularFile(workspaceRoot, relativePath);
        const after = await lstat(absolutePath, { bigint: true }).catch(() => undefined);
        if (after === undefined || !after.isFile() || !sameFileState(before, after)) {
          fail(
            "REFERENCE_HOST_SOURCE_AUDIT_INPUT_UNSAFE",
            `Vite backing module changed while snapshotting: ${relativePath}`,
          );
        }
        return Object.freeze({
          id,
          path: relativePath,
          dev: before.dev.toString(),
          ino: before.ino.toString(),
          size: before.size.toString(),
          mtimeNs: before.mtimeNs.toString(),
          ctimeNs: before.ctimeNs.toString(),
          bytes: bytes.length,
          sha256: `sha256:${sha256(bytes)}`,
        });
      }),
    ),
  );
}

function captureBackingSnapshot(value, label) {
  return captureDenseArray(value, label, 512, (entry) => {
    if (
      entry === null ||
      typeof entry !== "object" ||
      Array.isArray(entry) ||
      utilTypes.isProxy(entry) ||
      (Object.getPrototypeOf(entry) !== Object.prototype && Object.getPrototypeOf(entry) !== null)
    ) {
      fail(
        "REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID",
        `M05-T09 ${label} entry must be a plain own-data object.`,
      );
    }
    const keys = Reflect.ownKeys(entry);
    if (
      keys.some((key) => typeof key !== "string") ||
      !isDeepStrictEqual(
        keys.filter((key) => typeof key === "string").sort(),
        BACKING_SNAPSHOT_KEYS,
      )
    ) {
      fail("REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID", `M05-T09 ${label} entry schema drifted.`);
    }
    const values = Object.create(null);
    for (const key of BACKING_SNAPSHOT_KEYS) {
      const descriptor = Object.getOwnPropertyDescriptor(entry, key);
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
        fail(
          "REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID",
          `M05-T09 ${label} fields must be enumerable own data.`,
        );
      }
      values[key] = descriptor.value;
    }
    for (const key of ["ctimeNs", "dev", "ino", "mtimeNs", "size"]) {
      if (typeof values[key] !== "string" || !/^\d+$/u.test(values[key])) {
        fail(
          "REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID",
          `M05-T09 ${label} file-state fields are malformed.`,
        );
      }
    }
    if (
      !Number.isSafeInteger(values.bytes) ||
      values.bytes < 0 ||
      values.bytes > MAX_FILE_BYTES ||
      BigInt(values.size) !== BigInt(values.bytes) ||
      typeof values.sha256 !== "string" ||
      !/^sha256:[0-9a-f]{64}$/u.test(values.sha256)
    ) {
      fail(
        "REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID",
        `M05-T09 ${label} byte evidence is malformed.`,
      );
    }
    return Object.freeze({
      id: captureStringArray([values.id], `${label}.id`, 1)[0],
      path: captureStringArray([values.path], `${label}.path`, 1)[0],
      dev: values.dev,
      ino: values.ino,
      size: values.size,
      mtimeNs: values.mtimeNs,
      ctimeNs: values.ctimeNs,
      bytes: values.bytes,
      sha256: values.sha256,
    });
  });
}

function assertViteBackingSnapshotsEqual(before, after) {
  if (!isDeepStrictEqual(before, after)) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_GRAPH_NONDETERMINISTIC",
      "A local Vite backing module changed across the second graph observation.",
    );
  }
}

/** Applies the production three-observation backing-file identity policy to snapshots. */
export function verifyReferenceHostWebBackingSnapshotPolicy(
  rawBefore,
  rawAfter,
  rawFinal = rawAfter,
) {
  const before = captureBackingSnapshot(rawBefore, "backingSnapshotBefore");
  const after = captureBackingSnapshot(rawAfter, "backingSnapshotAfter");
  const final = captureBackingSnapshot(rawFinal, "backingSnapshotFinal");
  assertViteBackingSnapshotsEqual(before, after);
  assertViteBackingSnapshotsEqual(after, final);
  return Object.freeze({
    result: "PASS",
    backingFiles: before.length,
    observations: 3,
    finalReauthenticated: true,
  });
}

async function buildViteGraphEvidence(workspaceRoot, sourcePaths) {
  const first = await runObservedViteBuild(workspaceRoot);
  auditViteGraph(first.graph, sourcePaths);
  const backingBefore = await captureViteBackingSnapshot(workspaceRoot, first.backingModules);
  const second = await runObservedViteBuild(workspaceRoot);
  if (
    !isDeepStrictEqual(first.graph, second.graph) ||
    !isDeepStrictEqual(first.backingModules, second.backingModules)
  ) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_GRAPH_NONDETERMINISTIC",
      "Two real Vite 8 observer builds produced different normalized graphs.",
    );
  }
  const backingAfter = await captureViteBackingSnapshot(workspaceRoot, second.backingModules);
  assertViteBackingSnapshotsEqual(backingBefore, backingAfter);
  const backingEvidence = backingAfter.map(({ id, bytes, sha256: digest }) =>
    Object.freeze({ id, bytes, sha256: digest }),
  );
  return Object.freeze({
    evidence: deepFreeze({
      ...auditViteGraph(first.graph, sourcePaths),
      backingFiles: backingEvidence.length,
      backingSnapshotSha256: `sha256:${sha256(
        Buffer.from(JSON.stringify(backingEvidence), "utf8"),
      )}`,
      backingModulesStableAcrossSecondObservation: true,
      independentBuilds: 2,
      deterministic: true,
    }),
    backingModules: second.backingModules,
    backingSnapshot: backingAfter,
  });
}

function boundaryDrift(message, details = undefined) {
  fail("REFERENCE_HOST_SOURCE_AUDIT_BOUNDARY_DRIFT", message, details);
}

function captureBoundaryRuleRecord(value, expectedKeys, label) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    utilTypes.isProxy(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
  ) {
    boundaryDrift(`${label} must be a plain own-data object.`);
  }
  const keys = Reflect.ownKeys(value);
  if (
    keys.some((key) => typeof key !== "string") ||
    !isDeepStrictEqual(
      keys.filter((key) => typeof key === "string").sort(),
      [...expectedKeys].sort(),
    )
  ) {
    boundaryDrift(`${label} own-key schema drifted.`);
  }
  const captured = Object.create(null);
  for (const key of expectedKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      boundaryDrift(`${label} fields must be enumerable own data.`);
    }
    captured[key] = descriptor.value;
  }
  return captured;
}

function assertReferenceHostBoundaryConfiguration(configuration) {
  const top = captureBoundaryRuleRecord(
    configuration,
    ["forbidden", "options"],
    "Dependency-cruiser configuration",
  );
  const forbidden = captureDenseArray(top.forbidden, "dependencyCruiser.forbidden", 256, (rule) => {
    if (
      rule === null ||
      typeof rule !== "object" ||
      Array.isArray(rule) ||
      utilTypes.isProxy(rule) ||
      (Object.getPrototypeOf(rule) !== Object.prototype && Object.getPrototypeOf(rule) !== null)
    ) {
      boundaryDrift("Dependency-cruiser forbidden rules must be plain objects.");
    }
    const name = Object.getOwnPropertyDescriptor(rule, "name");
    if (
      name === undefined ||
      !name.enumerable ||
      !("value" in name) ||
      typeof name.value !== "string"
    ) {
      boundaryDrift("Dependency-cruiser forbidden rule names must be own data.");
    }
    return Object.freeze({ name: name.value, rule });
  });
  const matches = forbidden.filter(
    ({ name }) => name === EXPECTED_REFERENCE_HOST_BOUNDARY_RULE.name,
  );
  if (matches.length !== 1) {
    boundaryDrift("The exact reference-host dependency boundary rule is missing or duplicated.", {
      matches: matches.length,
    });
  }
  const rule = captureBoundaryRuleRecord(
    matches[0].rule,
    ["comment", "from", "name", "severity", "to"],
    "Reference-host dependency boundary rule",
  );
  const from = captureBoundaryRuleRecord(
    rule.from,
    ["path"],
    "Reference-host dependency boundary from-clause",
  );
  const to = captureBoundaryRuleRecord(
    rule.to,
    ["path", "pathNot"],
    "Reference-host dependency boundary to-clause",
  );
  const normalized = {
    comment: rule.comment,
    from: { path: from.path },
    name: rule.name,
    severity: rule.severity,
    to: { path: to.path, pathNot: to.pathNot },
  };
  if (!isDeepStrictEqual(normalized, EXPECTED_REFERENCE_HOST_BOUNDARY_RULE)) {
    boundaryDrift("The exact reference-host dependency boundary rule schema drifted.", {
      expected: EXPECTED_REFERENCE_HOST_BOUNDARY_RULE,
      actual: normalized,
    });
  }
  return Object.freeze(normalized);
}

/** Authenticates the exact dependency-cruiser rule consumed by production evidence. */
export function verifyReferenceHostWebDependencyBoundaryConfiguration(configuration) {
  const rule = assertReferenceHostBoundaryConfiguration(configuration);
  return Object.freeze({ result: "PASS", rule });
}

async function readPinnedDependencyCruiserVersion(workspaceRoot) {
  const packageFile = await resolveCanonicalWorkspaceFile(
    workspaceRoot,
    "node_modules/dependency-cruiser/package.json",
    "dependency-cruiser package metadata",
  );
  const metadata = parseJson(
    await readRegularFile(workspaceRoot, packageFile.relativePath),
    "dependency-cruiser package metadata",
    "REFERENCE_HOST_SOURCE_AUDIT_BOUNDARY_FAILED",
  );
  const workspaceManifest = parseJson(
    await readRegularFile(workspaceRoot, "package.json"),
    "workspace package manifest",
    "REFERENCE_HOST_SOURCE_AUDIT_BOUNDARY_FAILED",
  );
  if (
    metadata.name !== "dependency-cruiser" ||
    metadata.version !== "18.1.0" ||
    workspaceManifest.devDependencies?.["dependency-cruiser"] !== "18.1.0"
  ) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_BOUNDARY_FAILED",
      "M05-T09 requires the installed and declared dependency-cruiser 18.1.0.",
    );
  }
  return metadata.version;
}

async function buildDependencyCruiserEvidence(workspaceRoot) {
  let configuration;
  try {
    configuration = REQUIRE(path.join(workspaceRoot, "dependency-cruiser.config.cjs"));
  } catch (error) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_BOUNDARY_FAILED",
      "M05-T09 could not load the dependency-cruiser boundary configuration.",
      { cause: String(error) },
    );
  }
  const boundaryRule = assertReferenceHostBoundaryConfiguration(configuration);
  const toolVersion = await readPinnedDependencyCruiserVersion(workspaceRoot);
  let result;
  try {
    result = await cruise(
      ["apps/reference-host-web/src"],
      {
        baseDir: workspaceRoot,
        outputType: "json",
        tsConfig: { fileName: "apps/reference-host-web/tsconfig.json" },
        doNotFollow: { path: "node_modules" },
        exclude: "node_modules",
      },
      configuration,
    );
  } catch (error) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_BOUNDARY_FAILED",
      "M05-T09 dependency-cruiser package-boundary audit failed safely.",
      { cause: String(error) },
    );
  }
  let output;
  try {
    output = JSON.parse(result.output);
  } catch {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_BOUNDARY_FAILED",
      "M05-T09 dependency-cruiser returned malformed evidence.",
    );
  }
  if (
    result.exitCode !== 0 ||
    output.summary?.error !== 0 ||
    !Array.isArray(output.summary?.violations) ||
    output.summary.violations.length !== 0 ||
    !Array.isArray(output.modules)
  ) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_BOUNDARY_DRIFT",
      "The reference host violates its deny-by-default package boundary.",
    );
  }
  const unresolved = output.modules.flatMap((module) =>
    (module.dependencies ?? []).filter((dependency) => dependency.couldNotResolve === true),
  );
  return deepFreeze({
    tool: `dependency-cruiser@${toolVersion}`,
    authority: "package-boundary evidence only; not runtime resolution authority",
    rule: boundaryRule.name,
    ruleSchema: boundaryRule,
    violations: 0,
    unresolvedDeclarationsIgnoredForRuntimeResolution: unresolved.length,
    modules: output.summary.totalCruised,
    dependencies: output.summary.totalDependenciesCruised,
  });
}

function captureBuildEnvelopeEntryNames(entryNames, scope, counter) {
  const entries = entryNames.map((name) =>
    Object.freeze({
      name,
      normalized: name.toLowerCase(),
    }),
  );
  assertion(
    entries.every(
      ({ name }) => /^[\x20-\x7e]+$/u.test(name) && !name.includes("/") && !name.includes("\\"),
    ),
    `The ${scope} contains a non-ASCII or path-shaped build-envelope entry.`,
    counter,
  );
  assertion(
    new Set(entries.map(({ normalized }) => normalized)).size === entries.length,
    `The ${scope} contains a case-colliding build-envelope entry.`,
    counter,
  );
  return entries;
}

function assertPackageJsonEntryIdentity(entries, scope, required, counter) {
  const aliases = entries.filter(({ normalized }) => normalized === "package.json");
  assertion(
    aliases.length === (required ? 1 : aliases.length) &&
      aliases.length <= 1 &&
      aliases.every(({ name }) => name === "package.json"),
    `The ${scope} package.json identity is missing, case-aliased, or ambiguous.`,
    counter,
  );
}

function assertApplicationRootEntryPolicy(entryNames, counter) {
  const entries = captureBuildEnvelopeEntryNames(
    entryNames,
    "reference-host application root",
    counter,
  );
  assertPackageJsonEntryIdentity(entries, "reference-host application root", true, counter);
  const configurationFiles = entries
    .filter(({ normalized }) => /^(?:rollup|vite)\.config(?:\.|$)/u.test(normalized))
    .map(({ name }) => name)
    .sort();
  exactArray(
    configurationFiles,
    [],
    "The reference host contains a local Vite/Rollup configuration injection surface.",
    counter,
  );
  assertion(
    !entries.some(
      ({ normalized }) =>
        normalized === "public" || normalized === ".env" || normalized.startsWith(".env."),
    ),
    "The reference host contains an unaudited Vite public or environment surface.",
    counter,
  );
  return configurationFiles;
}

function isPostCssConfigurationEntry(name) {
  return /^postcss\.config(?:\.|$)/u.test(name) || /^\.postcssrc(?:\.|$)/u.test(name);
}

function assertPostCssBuildEnvelopePolicy(
  entryNames,
  manifest,
  scope,
  packageJsonRequired,
  counter,
) {
  const entries = captureBuildEnvelopeEntryNames(entryNames, scope, counter);
  assertPackageJsonEntryIdentity(entries, scope, packageJsonRequired, counter);
  assertion(
    !entries.some(({ normalized }) => isPostCssConfigurationEntry(normalized)),
    `The ${scope} contains an unaudited PostCSS configuration file surface.`,
    counter,
  );
  assertion(
    manifest !== null &&
      typeof manifest === "object" &&
      !Array.isArray(manifest) &&
      !Object.hasOwn(manifest, "postcss"),
    `The ${scope} package manifest contains an unaudited PostCSS configuration field.`,
    counter,
  );
}

/** Applies the exact application-root entry policy used by the real build envelope audit. */
export function verifyReferenceHostWebBuildEnvelopeEntryPolicy(rawEntryNames) {
  const entryNames = captureStringArray(rawEntryNames, "applicationRootEntries", 256);
  const counter = { value: 0 };
  assertApplicationRootEntryPolicy(entryNames, counter);
  assertPostCssBuildEnvelopePolicy(
    entryNames,
    {},
    "reference-host application root",
    true,
    counter,
  );
  return Object.freeze({ result: "PASS", assertions: counter.value });
}

/** Applies the exact PostCSS file/manifest deny policy used at all three audited search roots. */
export function verifyReferenceHostWebPostCssBuildEnvelopePolicy(
  rawEntryNames,
  rawPackageJsonText,
  rawOptions = undefined,
) {
  const options = captureOptions(rawOptions, ["packageJsonOptional", "scope"], "PostCSS policy");
  const scope = optionalString(options.scope, "PostCSS scope") ?? "build root";
  if (
    options.packageJsonOptional !== undefined &&
    typeof options.packageJsonOptional !== "boolean"
  ) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID",
      "M05-T09 packageJsonOptional must be a boolean.",
    );
  }
  const entryNames = captureStringArray(rawEntryNames, "PostCSS root entries", 256);
  const packageJsonText = optionalText(rawPackageJsonText, "PostCSS packageJsonText");
  if (packageJsonText === undefined) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID",
      "M05-T09 PostCSS policy requires bounded package JSON text.",
    );
  }
  const manifest = parseJson(
    Buffer.from(packageJsonText),
    `${scope} package manifest`,
    "REFERENCE_HOST_SOURCE_AUDIT_SOURCE_DRIFT",
  );
  const counter = { value: 0 };
  assertPostCssBuildEnvelopePolicy(
    entryNames,
    manifest,
    scope,
    options.packageJsonOptional !== true,
    counter,
  );
  return Object.freeze({ result: "PASS", assertions: counter.value });
}

function exactHtmlAttributes(element, expected, label, counter) {
  const actual = [...element.attributes].map(({ name, value }) => Object.freeze([name, value]));
  exactArray(actual, expected, `The host HTML ${label} attribute allowlist drifted.`, counter);
}

async function loadPinnedJSDOM(workspaceRoot) {
  const packageFile = await resolveCanonicalWorkspaceFile(
    workspaceRoot,
    "apps/reference-host-web/node_modules/jsdom/package.json",
    "jsdom package metadata",
  );
  const packageMetadata = parseJson(
    await readRegularFile(workspaceRoot, packageFile.relativePath),
    "jsdom package metadata",
    "REFERENCE_HOST_SOURCE_AUDIT_BUILD_FAILED",
  );
  if (packageMetadata.name !== "jsdom" || packageMetadata.version !== "29.1.1") {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_BUILD_FAILED",
      "M05-T09 requires the pinned jsdom 29.1.1 HTML parser.",
    );
  }
  const apiFile = await resolveCanonicalWorkspaceFile(
    workspaceRoot,
    "apps/reference-host-web/node_modules/jsdom/lib/api.js",
    "jsdom parser API",
  );
  await readRegularFile(workspaceRoot, apiFile.relativePath);
  const jsdom = await import(pathToFileURL(apiFile.absolutePath).href);
  if (typeof jsdom.JSDOM !== "function") {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_BUILD_FAILED",
      "M05-T09 could not authenticate the pinned jsdom parser API.",
    );
  }
  return jsdom.JSDOM;
}

async function auditCanonicalIndexHtml(workspaceRoot, indexText, counter) {
  assertion(
    indexText === EXPECTED_INDEX_HTML,
    "The host HTML bytes drifted from the exact canonical entry document.",
    counter,
  );
  const JSDOM = await loadPinnedJSDOM(workspaceRoot);
  let parsed;
  try {
    parsed = new JSDOM(indexText, { url: "https://desen.invalid/" });
  } catch (error) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_SOURCE_DRIFT",
      "The canonical host HTML could not be parsed safely.",
      { cause: String(error) },
    );
  }
  try {
    const { document, NodeFilter } = parsed.window;
    const documentChildren = [...document.childNodes];
    assertion(
      documentChildren.length === 2 &&
        documentChildren[0].nodeType === 10 &&
        documentChildren[0].nodeName.toLowerCase() === "html" &&
        documentChildren[0].publicId === "" &&
        documentChildren[0].systemId === "" &&
        documentChildren[1] === document.documentElement,
      "The host HTML doctype/document node inventory drifted.",
      counter,
    );
    const elements = [...document.querySelectorAll("*")];
    exactArray(
      elements.map(({ localName }) => localName),
      ["html", "head", "meta", "meta", "meta", "title", "body", "div", "script"],
      "The host HTML element inventory drifted.",
      counter,
    );
    const [html, head, charset, viewport, colorScheme, title, body, root, script] = elements;
    exactHtmlAttributes(html, [["lang", "en"]], "html", counter);
    exactHtmlAttributes(head, [], "head", counter);
    exactHtmlAttributes(charset, [["charset", "UTF-8"]], "charset meta", counter);
    exactHtmlAttributes(
      viewport,
      [
        ["name", "viewport"],
        ["content", "width=device-width, initial-scale=1.0"],
      ],
      "viewport meta",
      counter,
    );
    exactHtmlAttributes(
      colorScheme,
      [
        ["name", "color-scheme"],
        ["content", "light dark"],
      ],
      "color-scheme meta",
      counter,
    );
    exactHtmlAttributes(title, [], "title", counter);
    exactHtmlAttributes(body, [], "body", counter);
    exactHtmlAttributes(root, [["id", "desen-reference-host-root"]], "root", counter);
    exactHtmlAttributes(
      script,
      [
        ["type", "module"],
        ["src", "/src/main.tsx"],
      ],
      "module script",
      counter,
    );
    assertion(
      title.childNodes.length === 1 &&
        title.firstChild?.nodeType === 3 &&
        title.textContent === "DESEN Reference Host" &&
        root.childNodes.length === 0 &&
        script.childNodes.length === 0,
      "The host HTML contains non-canonical visible or root content.",
      counter,
    );
    const comments = document.createTreeWalker(document, NodeFilter.SHOW_COMMENT);
    assertion(
      comments.nextNode() === null,
      "The host HTML contains an unaudited comment node.",
      counter,
    );
    const textWalker = document.createTreeWalker(document, NodeFilter.SHOW_TEXT);
    const nonWhitespaceText = [];
    let textNode = textWalker.nextNode();
    while (textNode !== null) {
      if (textNode.nodeValue?.trim().length > 0) {
        nonWhitespaceText.push(textNode.nodeValue);
      }
      textNode = textWalker.nextNode();
    }
    exactArray(
      nonWhitespaceText,
      ["DESEN Reference Host"],
      "The host HTML text-node inventory drifted.",
      counter,
    );
  } finally {
    parsed.window.close();
  }
  return "jsdom@29.1.1 exact canonical AST";
}

/** Applies the exact canonical HTML parser policy used by the production build envelope. */
export async function verifyReferenceHostWebHtmlEnvelopePolicy(indexText, rawOptions = undefined) {
  const options = captureOptions(rawOptions, ["workspaceRoot"], "HTML policy");
  const workspaceRoot = await resolveWorkspaceRoot(
    optionalString(options.workspaceRoot, "workspaceRoot"),
  );
  const text = optionalText(indexText, "indexHtmlText");
  if (text === undefined) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID",
      "M05-T09 HTML policy requires bounded document text.",
    );
  }
  const counter = { value: 0 };
  const parser = await auditCanonicalIndexHtml(workspaceRoot, text, counter);
  return Object.freeze({ result: "PASS", parser, assertions: counter.value });
}

async function auditApplicationBuildEnvelope(workspaceRoot) {
  const counter = { value: 0 };
  const applicationRoot = path.join(workspaceRoot, "apps/reference-host-web");
  let entries;
  try {
    entries = await readdir(applicationRoot, { withFileTypes: true });
  } catch (error) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_INPUT_UNSAFE",
      "M05-T09 could not inventory the application build envelope.",
      { cause: String(error) },
    );
  }
  const configurationFiles = assertApplicationRootEntryPolicy(
    entries.map(({ name }) => name),
    counter,
  );
  let applicationsEntries;
  let workspaceEntries;
  try {
    [applicationsEntries, workspaceEntries] = await Promise.all([
      readdir(path.join(workspaceRoot, "apps"), { withFileTypes: true }),
      readdir(workspaceRoot, { withFileTypes: true }),
    ]);
  } catch (error) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_INPUT_UNSAFE",
      "M05-T09 could not inventory the workspace-root build envelope.",
      { cause: String(error) },
    );
  }
  const applicationsEntryNames = applicationsEntries.map(({ name }) => name);
  const workspaceEntryNames = workspaceEntries.map(({ name }) => name);
  const applicationsEnvelopeEntries = captureBuildEnvelopeEntryNames(
    applicationsEntryNames,
    "applications root",
    counter,
  );
  assertPackageJsonEntryIdentity(applicationsEnvelopeEntries, "applications root", false, counter);
  const workspaceEnvelopeEntries = captureBuildEnvelopeEntryNames(
    workspaceEntryNames,
    "workspace root",
    counter,
  );
  assertPackageJsonEntryIdentity(workspaceEnvelopeEntries, "workspace root", true, counter);
  const applicationsManifestExists = applicationsEntries.some(
    ({ name }) => name === "package.json",
  );
  const [indexBytes, manifestBytes, applicationsManifestBytes, workspaceManifestBytes] =
    await Promise.all([
      readRegularFile(workspaceRoot, "apps/reference-host-web/index.html"),
      readRegularFile(workspaceRoot, "apps/reference-host-web/package.json"),
      applicationsManifestExists
        ? readRegularFile(workspaceRoot, "apps/package.json")
        : Promise.resolve(Buffer.from("{}")),
      readRegularFile(workspaceRoot, "package.json"),
    ]);
  const indexText = indexBytes.toString("utf8");
  const manifest = parseJson(
    manifestBytes,
    "reference-host package manifest",
    "REFERENCE_HOST_SOURCE_AUDIT_SOURCE_DRIFT",
  );
  const workspaceManifest = parseJson(
    workspaceManifestBytes,
    "workspace package manifest",
    "REFERENCE_HOST_SOURCE_AUDIT_SOURCE_DRIFT",
  );
  const applicationsManifest = parseJson(
    applicationsManifestBytes,
    "applications-root package manifest",
    "REFERENCE_HOST_SOURCE_AUDIT_SOURCE_DRIFT",
  );
  assertPostCssBuildEnvelopePolicy(
    entries.map(({ name }) => name),
    manifest,
    "reference-host application root",
    true,
    counter,
  );
  assertPostCssBuildEnvelopePolicy(
    applicationsEntryNames,
    applicationsManifest,
    "applications root",
    false,
    counter,
  );
  assertPostCssBuildEnvelopePolicy(
    workspaceEntryNames,
    workspaceManifest,
    "workspace root",
    true,
    counter,
  );
  const htmlParser = await auditCanonicalIndexHtml(workspaceRoot, indexText, counter);
  assertion(
    manifest.name === "@desen/reference-host-web" &&
      manifest.private === true &&
      manifest.type === "module" &&
      manifest.devDependencies?.jsdom === "29.1.1" &&
      manifest.devDependencies?.vite === "8.1.5",
    "The reference-host package build identity drifted.",
    counter,
  );
  exactArray(
    manifest.scripts,
    {
      build: "vite build",
      dev: "vite",
      lint: "eslint src test --max-warnings=0",
      test: "vitest run",
      "test:channel": "vitest run test/channel-delivery.test.tsx test/main-lifecycle.test.tsx",
      "test:shell":
        "vitest run test/host-ports.test.ts test/root-policy.test.ts test/recovery-authority.test.ts test/root-lifecycle.test.tsx test/root-security.test.tsx",
      "test:sign-in":
        "vitest run test/sign-in-http-handler.test.ts test/official-sign-in.test.tsx test/main-lifecycle.test.tsx",
      typecheck: "tsc -p tsconfig.json --noEmit",
    },
    "The reference-host script allowlist or lifecycle build path drifted.",
    counter,
  );
  exactArray(
    manifest.dependencies,
    {
      "@desen/reference-catalog-web": "workspace:*",
      "@desen/runtime-core": "workspace:*",
      "@desen/runtime-react": "workspace:*",
      "@desen/runtime-web": "workspace:*",
      react: "19.2.8",
      "react-dom": "19.2.8",
    },
    "The reference-host production dependency allowlist drifted.",
    counter,
  );
  assertion(
    !["alias", "browser", "exports", "imports", "resolutions"].some((key) =>
      Object.hasOwn(manifest, key),
    ),
    "The reference-host package contains an alternate resolution surface.",
    counter,
  );
  return deepFreeze({
    viteConfigFile: false,
    htmlParser,
    localViteOrRollupConfigs: configurationFiles,
    postCssSearchRoots: Object.freeze(["apps/reference-host-web", "apps", "."]),
    workspacePostCssConfigs: [],
    htmlEntry: "/src/main.tsx",
    htmlRoot: "desen-reference-host-root",
    visibleStaticText: "DESEN Reference Host",
    productionDependencies: Object.keys(manifest.dependencies).sort(),
    assertions: counter.value,
  });
}

function parseJson(bytes, label, code) {
  try {
    const decoder = new SAFE_TEXT_DECODER("utf-8", { fatal: true });
    return SAFE_JSON_PARSE(SAFE_REFLECT_APPLY(SAFE_TEXT_DECODER_DECODE, decoder, [bytes]));
  } catch {
    fail(code, `${label} is not valid JSON.`);
  }
}

async function assertPrerequisites(workspaceRoot) {
  return Promise.all(
    PREREQUISITES.map(async (expected) => {
      const bytes = await readRegularFile(workspaceRoot, expected.path, MAX_ARTIFACT_BYTES);
      const actualSha256 = sha256(bytes);
      if (actualSha256 !== expected.sha256) {
        fail(
          "REFERENCE_HOST_SOURCE_AUDIT_PREREQUISITE_DRIFT",
          `M05-T09 ${expected.task} prerequisite bytes drifted.`,
          { expected: expected.sha256, actual: actualSha256 },
        );
      }
      const artifact = parseJson(
        bytes,
        `${expected.task} prerequisite`,
        "REFERENCE_HOST_SOURCE_AUDIT_PREREQUISITE_DRIFT",
      );
      if (
        artifact.task !== expected.task ||
        artifact.profile !== expected.profile ||
        artifact.result !== expected.result
      ) {
        fail(
          "REFERENCE_HOST_SOURCE_AUDIT_PREREQUISITE_DRIFT",
          `M05-T09 ${expected.task} prerequisite semantics drifted.`,
        );
      }
      if (expected.task === "M05-T08") {
        for (const dataPath of EXPECTED_GRAPH_DATA_MODULES.filter((entry) =>
          entry.endsWith(".json"),
        )) {
          const pinned = artifact.evidence?.trackedFiles?.filter(
            (entry) => entry.path === dataPath,
          );
          if (
            !Array.isArray(pinned) ||
            pinned.length !== 1 ||
            typeof pinned[0].sha256 !== "string" ||
            typeof pinned[0].bytes !== "number"
          ) {
            fail(
              "REFERENCE_HOST_SOURCE_AUDIT_PREREQUISITE_DRIFT",
              `M05-T08 does not uniquely pin runtime data ${dataPath}.`,
            );
          }
          const dataBytes = await readRegularFile(workspaceRoot, dataPath);
          if (
            pinned[0].bytes !== dataBytes.length ||
            pinned[0].sha256 !== `sha256:${sha256(dataBytes)}`
          ) {
            fail(
              "REFERENCE_HOST_SOURCE_AUDIT_PREREQUISITE_DRIFT",
              `Runtime data ${dataPath} drifted from the immutable M05-T08 receipt.`,
            );
          }
        }
      }
      return Object.freeze({
        ...expected,
        bytes: bytes.length,
        immutable: true,
      });
    }),
  );
}

async function readTrackedFiles(workspaceRoot, sourcePaths) {
  const paths = [...new Set([...sourcePaths, ...STATIC_TRACKED_PATHS])].sort();
  return Object.freeze(
    await Promise.all(
      paths.map(async (relativePath) => {
        const bytes = await readRegularFile(workspaceRoot, relativePath);
        return Object.freeze({
          path: relativePath,
          bytes: bytes.length,
          sha256: `sha256:${sha256(bytes)}`,
        });
      }),
    ),
  );
}

async function captureAuditPathStates(workspaceRoot, sourcePaths) {
  const paths = [
    ...new Set([
      ...sourcePaths,
      ...STATIC_TRACKED_PATHS,
      ...REFERENCE_HOST_WEB_SOURCE_AUDIT_PREREQUISITE_PATHS,
      ".",
      "apps",
      "apps/reference-host-web",
      "apps/reference-host-web/src",
      "examples/sign-in",
      "packages/reference-catalog-web",
    ]),
  ].sort();
  return Object.freeze(
    await Promise.all(
      paths.map(async (relativePath) => {
        const absolutePath = path.join(workspaceRoot, ...relativePath.split("/"));
        const state = await lstat(absolutePath, { bigint: true }).catch(() => undefined);
        if (
          state === undefined ||
          state.isSymbolicLink() ||
          (!state.isFile() && !state.isDirectory())
        ) {
          fail(
            "REFERENCE_HOST_SOURCE_AUDIT_INPUT_UNSAFE",
            `M05-T09 snapshot path is missing or unsafe: ${relativePath}`,
          );
        }
        return Object.freeze({
          path: relativePath,
          kind: state.isDirectory() ? "directory" : "file",
          dev: state.dev.toString(),
          ino: state.ino.toString(),
          size: state.size.toString(),
          mtimeNs: state.mtimeNs.toString(),
          ctimeNs: state.ctimeNs.toString(),
        });
      }),
    ),
  );
}

async function serializeArtifact(artifact) {
  const formatted = await format(JSON.stringify(artifact), {
    endOfLine: "lf",
    parser: "json",
    printWidth: 100,
    tabWidth: 2,
  });
  return Buffer.from(formatted, "utf8");
}

function createArtifact({
  prerequisites,
  trackedFiles,
  semantic,
  viteGraph,
  packageBoundary,
  buildEnvelope,
  snapshotConsistency,
}) {
  return deepFreeze({
    schemaVersion: 1,
    task: "M05-T09",
    result: "PASS",
    profile: "desen-reference-host-web-source-audit-v1",
    protocol: "0.1.0",
    target: "web-react",
    prerequisites,
    claim: HISTORICAL_CLAIM,
    sourceAudit: semantic,
    buildEnvelope,
    runtimeResolution: viteGraph,
    packageBoundary,
    evidence: {
      trackedFiles,
      snapshotConsistency,
      hostileMutationPolicies: HOSTILE_MUTATION_POLICIES,
      hostileMutationPolicyCount: HOSTILE_MUTATION_POLICIES.length,
      proofClaims: {
        "P-06": "PARTIAL",
        "P-07": "PARTIAL",
        "P-10": "PARTIAL",
      },
      proofClaimStatusChanges: [
        Object.freeze({ claim: "P-07", from: "NOT_PROVEN", to: "PARTIAL" }),
      ],
      normativeStatusChanges: [],
      gate: "G05_DONE",
      historicalArtifactsRewritten: false,
    },
    nonclaims: HISTORICAL_NONCLAIMS,
  });
}

/**
 * Performs the semantic TypeScript/JSX audit against the complete dynamic production inventory.
 *
 * @remarks `sourceOverrides` exists only for bounded hostile-mutation proof tests. It can replace
 * text for an already discovered TypeScript file but cannot add, remove, or rename inventory.
 */
export async function inspectReferenceHostWebSourceAudit(rawOptions = undefined) {
  const options = captureOptions(rawOptions, ["workspaceRoot", "sourceOverrides"], "inspect");
  const workspaceRoot = await resolveWorkspaceRoot(
    optionalString(options.workspaceRoot, "workspaceRoot"),
  );
  const sourcePaths = await inventoryApplicationSource(workspaceRoot);
  const files = await readSourceSnapshot(workspaceRoot, sourcePaths, options.sourceOverrides);
  return auditSemanticSource(workspaceRoot, sourcePaths, files);
}

/**
 * Builds a current-state host observation using the complete M05 semantic, Vite, build-envelope,
 * and dependency-boundary audit.
 *
 * @remarks This is deliberately separate from the immutable M05-T09 task-time receipt reader.
 * It may observe successor workspace coordination files, but those files never redefine history.
 */
export async function buildCurrentReferenceHostWebSourceAuditEvidence(rawOptions = undefined) {
  const options = captureOptions(rawOptions, ["workspaceRoot"], "current audit build");
  const workspaceRoot = await resolveWorkspaceRoot(
    optionalString(options.workspaceRoot, "workspaceRoot"),
  );
  const sourcePaths = await inventoryApplicationSource(workspaceRoot);
  const files = await readSourceSnapshot(workspaceRoot, sourcePaths, undefined);
  const snapshotBefore = await captureAuditPathStates(workspaceRoot, sourcePaths);
  const trackedBefore = await readTrackedFiles(workspaceRoot, sourcePaths);
  for (const relativePath of sourcePaths) {
    const captured = files.get(relativePath);
    const tracked = trackedBefore.find((entry) => entry.path === relativePath);
    if (
      captured === undefined ||
      tracked === undefined ||
      captured.bytes !== tracked.bytes ||
      captured.sha256 !== tracked.sha256
    ) {
      fail(
        "REFERENCE_HOST_SOURCE_AUDIT_INPUT_UNSAFE",
        `M05-T09 source snapshot changed before the complete audit: ${relativePath}`,
      );
    }
  }
  const prerequisites = await assertPrerequisites(workspaceRoot);
  const semantic = auditSemanticSource(workspaceRoot, sourcePaths, files);
  const buildEnvelope = await auditApplicationBuildEnvelope(workspaceRoot);
  const viteGraphBuild = await buildViteGraphEvidence(workspaceRoot, sourcePaths);
  const packageBoundary = await buildDependencyCruiserEvidence(workspaceRoot);
  const trackedFiles = await readTrackedFiles(workspaceRoot, sourcePaths);
  const snapshotAfter = await captureAuditPathStates(workspaceRoot, sourcePaths);
  if (
    !isDeepStrictEqual(trackedBefore, trackedFiles) ||
    !isDeepStrictEqual(snapshotBefore, snapshotAfter)
  ) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_INPUT_UNSAFE",
      "M05-T09 source, proof, data, or build-envelope state changed across the complete audit.",
    );
  }
  const finalBackingSnapshot = await captureViteBackingSnapshot(
    workspaceRoot,
    viteGraphBuild.backingModules,
  );
  assertViteBackingSnapshotsEqual(viteGraphBuild.backingSnapshot, finalBackingSnapshot);
  const viteGraph = deepFreeze({
    ...viteGraphBuild.evidence,
    backingSnapshotObservations: 3,
    finalBackingReauthenticatedAfterDependencyBoundary: true,
  });
  const artifact = createArtifact({
    prerequisites,
    trackedFiles,
    semantic,
    viteGraph,
    packageBoundary,
    buildEnvelope,
    snapshotConsistency: Object.freeze({
      checkedPaths: snapshotBefore.length,
      prePostIdentityMatched: true,
      sourceAndEnvelopeStableAcrossAudit: true,
    }),
  });
  const artifactBytes = await serializeArtifact(artifact);
  return Object.freeze({
    artifact,
    artifactBytes,
    artifactSha256: sha256(artifactBytes),
  });
}

function exactKeySet(value, expectedKeys, label) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    !isDeepStrictEqual(Object.keys(value).sort(), [...expectedKeys].sort())
  ) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_ARTIFACT_DRIFT",
      `Immutable M05-T09 ${label} key inventory drifted.`,
    );
  }
}

function inspectHistoricalTrackedFiles(artifact) {
  const trackedFiles = artifact.evidence?.trackedFiles;
  const expectedPaths = [...new Set([...HISTORICAL_SOURCE_PATHS, ...STATIC_TRACKED_PATHS])].sort();
  if (
    !Array.isArray(trackedFiles) ||
    trackedFiles.length !== expectedPaths.length ||
    !isDeepStrictEqual(
      trackedFiles.map(({ path: relativePath }) => relativePath),
      expectedPaths,
    ) ||
    new Set(trackedFiles.map(({ path: relativePath }) => relativePath)).size !== trackedFiles.length
  ) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_ARTIFACT_DRIFT",
      "Immutable M05-T09 tracked-file inventory drifted.",
    );
  }
  for (const entry of trackedFiles) {
    exactKeySet(entry, ["path", "bytes", "sha256"], `tracked file ${String(entry?.path)}`);
    if (
      typeof entry.path !== "string" ||
      !validateRelativePath(entry.path) ||
      !Number.isSafeInteger(entry.bytes) ||
      entry.bytes <= 0 ||
      typeof entry.sha256 !== "string" ||
      !/^sha256:[0-9a-f]{64}$/u.test(entry.sha256)
    ) {
      fail(
        "REFERENCE_HOST_SOURCE_AUDIT_ARTIFACT_DRIFT",
        `Immutable M05-T09 tracked file ${String(entry?.path)} is malformed.`,
      );
    }
  }
  return trackedFiles;
}

function inspectHistoricalArtifact(rawBytes) {
  const bytes = Buffer.from(rawBytes);
  const actualSha256 = sha256(bytes);
  if (bytes.length !== HISTORICAL_ARTIFACT_BYTES || actualSha256 !== HISTORICAL_ARTIFACT_SHA256) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_ARTIFACT_DRIFT",
      "Immutable M05-T09 task-time artifact bytes changed.",
      {
        expected: HISTORICAL_ARTIFACT_SHA256,
        actual: actualSha256,
        expectedBytes: HISTORICAL_ARTIFACT_BYTES,
        actualBytes: bytes.length,
      },
    );
  }
  const artifact = parseJson(
    bytes,
    "immutable M05-T09 task-time artifact",
    "REFERENCE_HOST_SOURCE_AUDIT_ARTIFACT_DRIFT",
  );
  exactKeySet(
    artifact,
    [
      "schemaVersion",
      "task",
      "result",
      "profile",
      "protocol",
      "target",
      "prerequisites",
      "claim",
      "sourceAudit",
      "buildEnvelope",
      "runtimeResolution",
      "packageBoundary",
      "evidence",
      "nonclaims",
    ],
    "top-level artifact",
  );
  if (
    artifact.schemaVersion !== 1 ||
    artifact.task !== "M05-T09" ||
    artifact.result !== "PASS" ||
    artifact.profile !== "desen-reference-host-web-source-audit-v1" ||
    artifact.protocol !== "0.1.0" ||
    artifact.target !== "web-react" ||
    !isDeepStrictEqual(artifact.prerequisites, HISTORICAL_PREREQUISITES) ||
    !isDeepStrictEqual(artifact.claim, HISTORICAL_CLAIM) ||
    !isDeepStrictEqual(artifact.nonclaims, HISTORICAL_NONCLAIMS)
  ) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_ARTIFACT_DRIFT",
      "Immutable M05-T09 identity, prerequisites, claim, or nonclaims drifted.",
    );
  }

  exactKeySet(
    artifact.sourceAudit,
    [
      "compiler",
      "compilerAuthority",
      "sourceFiles",
      "executableSourceFiles",
      "importDeclarations",
      "jsxElements",
      "publicReactRootCalls",
      "publicHeadlessMountCalls",
      "publicAdapterRegistryCalls",
      "publicRuntimeReactSurfaceCalls",
      "compositionFunctions",
      "executableAuthoritySurface",
      "dataImports",
      "jsxByFile",
      "css",
      "assertions",
    ],
    "source-audit",
  );
  if (
    artifact.sourceAudit.compiler !== "typescript@6.0.3" ||
    artifact.sourceAudit.compilerAuthority !== "TypeScript Program and TypeChecker" ||
    artifact.sourceAudit.sourceFiles !== 12 ||
    artifact.sourceAudit.executableSourceFiles !== 11 ||
    artifact.sourceAudit.importDeclarations !== 52 ||
    artifact.sourceAudit.jsxElements !== 18 ||
    artifact.sourceAudit.publicReactRootCalls !== 1 ||
    artifact.sourceAudit.publicHeadlessMountCalls !== 1 ||
    artifact.sourceAudit.publicAdapterRegistryCalls !== 1 ||
    artifact.sourceAudit.publicRuntimeReactSurfaceCalls !== 1 ||
    artifact.sourceAudit.compositionFunctions?.length !== 5 ||
    artifact.sourceAudit.executableAuthoritySurface?.descriptors !== 413 ||
    artifact.sourceAudit.executableAuthoritySurface?.sha256 !==
      "sha256:25d2f89263aca58e14f1328f0b12cb49225624afee69a577b116f72cb286ff8a" ||
    artifact.sourceAudit.dataImports?.length !== 3 ||
    Object.keys(artifact.sourceAudit.jsxByFile ?? {}).length !== 11 ||
    artifact.sourceAudit.css?.sha256 !==
      "sha256:6d82529e07969d9033232aaa72924ec57eae0dd86736ebecdf700680046a7738" ||
    artifact.sourceAudit.assertions !== 3_719
  ) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_ARTIFACT_DRIFT",
      "Immutable M05-T09 semantic source-audit slice drifted.",
    );
  }

  exactKeySet(
    artifact.buildEnvelope,
    [
      "viteConfigFile",
      "htmlParser",
      "localViteOrRollupConfigs",
      "postCssSearchRoots",
      "workspacePostCssConfigs",
      "htmlEntry",
      "htmlRoot",
      "visibleStaticText",
      "productionDependencies",
      "assertions",
    ],
    "build-envelope",
  );
  if (
    artifact.buildEnvelope.viteConfigFile !== false ||
    artifact.buildEnvelope.htmlParser !== "jsdom@29.1.1 exact canonical AST" ||
    artifact.buildEnvelope.htmlEntry !== "/src/main.tsx" ||
    artifact.buildEnvelope.htmlRoot !== "desen-reference-host-root" ||
    artifact.buildEnvelope.visibleStaticText !== "DESEN Reference Host" ||
    !isDeepStrictEqual(artifact.buildEnvelope.localViteOrRollupConfigs, []) ||
    !isDeepStrictEqual(artifact.buildEnvelope.workspacePostCssConfigs, []) ||
    !isDeepStrictEqual(artifact.buildEnvelope.postCssSearchRoots, [
      "apps/reference-host-web",
      "apps",
      ".",
    ]) ||
    !isDeepStrictEqual(artifact.buildEnvelope.productionDependencies, [
      "@desen/reference-catalog-web",
      "@desen/runtime-core",
      "@desen/runtime-react",
      "@desen/runtime-web",
      "react",
      "react-dom",
    ]) ||
    artifact.buildEnvelope.assertions !== 45
  ) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_ARTIFACT_DRIFT",
      "Immutable M05-T09 build-envelope slice drifted.",
    );
  }

  exactKeySet(
    artifact.runtimeResolution,
    [
      "tool",
      "authority",
      "observer",
      "write",
      "independentBuilds",
      "deterministic",
      "moduleCount",
      "staticEdges",
      "dynamicEdges",
      "unresolvedEdges",
      "reachableProductionSourceFiles",
      "dataModules",
      "modules",
      "graphSha256",
      "backingFiles",
      "backingSnapshotSha256",
      "backingModulesStableAcrossSecondObservation",
      "backingSnapshotObservations",
      "finalBackingReauthenticatedAfterDependencyBoundary",
      "assertions",
    ],
    "runtime-resolution",
  );
  if (
    artifact.runtimeResolution.tool !== "vite@8.1.5" ||
    artifact.runtimeResolution.authority !==
      "programmatic build({ write: false }) Plugin.moduleParsed" ||
    artifact.runtimeResolution.observer !== "moduleParsed" ||
    artifact.runtimeResolution.write !== false ||
    artifact.runtimeResolution.independentBuilds !== 2 ||
    artifact.runtimeResolution.deterministic !== true ||
    artifact.runtimeResolution.moduleCount !== 103 ||
    artifact.runtimeResolution.modules?.length !== 103 ||
    artifact.runtimeResolution.staticEdges !== 297 ||
    artifact.runtimeResolution.dynamicEdges !== 0 ||
    artifact.runtimeResolution.unresolvedEdges !== 0 ||
    artifact.runtimeResolution.reachableProductionSourceFiles !== 12 ||
    !isDeepStrictEqual(artifact.runtimeResolution.dataModules, [
      "apps/reference-host-web/src/styles.css",
      "examples/sign-in/official-derived.bundle.desen.json",
      "packages/reference-catalog-web/catalog.json",
    ]) ||
    artifact.runtimeResolution.graphSha256 !==
      "sha256:243fa72ceee35d624beb9f0444abf73c0224512e5722846b934dd2de1cb1810d" ||
    artifact.runtimeResolution.backingFiles !== 102 ||
    artifact.runtimeResolution.backingSnapshotSha256 !==
      "sha256:0eff527a4ac86d86f24f86fbd833d94241daccfe18e2aef13eaf69751249ab8f" ||
    artifact.runtimeResolution.backingModulesStableAcrossSecondObservation !== true ||
    artifact.runtimeResolution.backingSnapshotObservations !== 3 ||
    artifact.runtimeResolution.finalBackingReauthenticatedAfterDependencyBoundary !== true ||
    artifact.runtimeResolution.assertions !== 411
  ) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_ARTIFACT_DRIFT",
      "Immutable M05-T09 real-build resolution slice drifted.",
    );
  }

  exactKeySet(
    artifact.packageBoundary,
    [
      "tool",
      "authority",
      "rule",
      "ruleSchema",
      "modules",
      "dependencies",
      "violations",
      "unresolvedDeclarationsIgnoredForRuntimeResolution",
    ],
    "package-boundary",
  );
  if (
    artifact.packageBoundary.tool !== "dependency-cruiser@18.1.0" ||
    artifact.packageBoundary.authority !==
      "package-boundary evidence only; not runtime resolution authority" ||
    artifact.packageBoundary.rule !== "application-reference-host-web-allowed-dependencies" ||
    !isDeepStrictEqual(
      artifact.packageBoundary.ruleSchema,
      EXPECTED_REFERENCE_HOST_BOUNDARY_RULE,
    ) ||
    artifact.packageBoundary.modules !== 19 ||
    artifact.packageBoundary.dependencies !== 27 ||
    artifact.packageBoundary.violations !== 0 ||
    artifact.packageBoundary.unresolvedDeclarationsIgnoredForRuntimeResolution !== 13
  ) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_ARTIFACT_DRIFT",
      "Immutable M05-T09 dependency-boundary slice drifted.",
    );
  }

  exactKeySet(
    artifact.evidence,
    [
      "trackedFiles",
      "snapshotConsistency",
      "hostileMutationPolicies",
      "hostileMutationPolicyCount",
      "proofClaims",
      "proofClaimStatusChanges",
      "normativeStatusChanges",
      "gate",
      "historicalArtifactsRewritten",
    ],
    "evidence",
  );
  inspectHistoricalTrackedFiles(artifact);
  if (
    !isDeepStrictEqual(artifact.evidence.snapshotConsistency, {
      checkedPaths: 32,
      prePostIdentityMatched: true,
      sourceAndEnvelopeStableAcrossAudit: true,
    }) ||
    !isDeepStrictEqual(artifact.evidence.hostileMutationPolicies, HOSTILE_MUTATION_POLICIES) ||
    artifact.evidence.hostileMutationPolicyCount !== HOSTILE_MUTATION_POLICIES.length ||
    !isDeepStrictEqual(artifact.evidence.proofClaims, {
      "P-06": "PARTIAL",
      "P-07": "PARTIAL",
      "P-10": "PARTIAL",
    }) ||
    !isDeepStrictEqual(artifact.evidence.proofClaimStatusChanges, [
      { claim: "P-07", from: "NOT_PROVEN", to: "PARTIAL" },
    ]) ||
    !isDeepStrictEqual(artifact.evidence.normativeStatusChanges, []) ||
    artifact.evidence.gate !== "G05_DONE" ||
    artifact.evidence.historicalArtifactsRewritten !== false
  ) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_ARTIFACT_DRIFT",
      "Immutable M05-T09 evidence and claim-status slice drifted.",
    );
  }
  return deepFreeze(artifact);
}

function resolveHistoricalArtifactPath(candidate) {
  if (candidate === undefined) return DEFAULT_REFERENCE_HOST_WEB_SOURCE_AUDIT_ARTIFACT_PATH;
  return path.isAbsolute(candidate)
    ? path.resolve(candidate)
    : path.resolve(WORKSPACE_ROOT, candidate);
}

/**
 * Reads only the exact immutable M05-T09/G05 task-time artifact and its reviewed semantic slice.
 *
 * @remarks Current workspace builds, source overrides, and successor inputs are intentionally
 * rejected. Use `buildCurrentReferenceHostWebSourceAuditEvidence` for a live host observation.
 */
export async function buildReferenceHostWebSourceAuditEvidence(rawOptions = undefined) {
  const options = captureOptions(rawOptions, ["artifactPath", "artifactBytes"], "historical build");
  const artifactPath = optionalString(options.artifactPath, "artifactPath");
  const injectedArtifactBytes = optionalBytes(options.artifactBytes, "artifactBytes");
  if (artifactPath !== undefined && injectedArtifactBytes !== undefined) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID",
      "Historical M05-T09 build accepts either artifactPath or artifactBytes, not both.",
    );
  }
  const artifactBytes =
    injectedArtifactBytes ??
    (await readAbsoluteRegularFile(
      resolveHistoricalArtifactPath(artifactPath),
      "REFERENCE_HOST_SOURCE_AUDIT_ARTIFACT_MISSING",
      "REFERENCE_HOST_SOURCE_AUDIT_ARTIFACT_UNSAFE",
      MAX_ARTIFACT_BYTES,
    ));
  const artifact = inspectHistoricalArtifact(artifactBytes);
  return Object.freeze({
    artifact,
    artifactBytes: Buffer.from(artifactBytes),
    artifactSha256: HISTORICAL_ARTIFACT_SHA256,
  });
}

function consumeCurrentEvidenceBudget(state, kind, amount = 1) {
  state[kind] += amount;
  const limit =
    kind === "nodes"
      ? MAX_CURRENT_EVIDENCE_NODES
      : kind === "scalars"
        ? MAX_CURRENT_EVIDENCE_SCALARS
        : kind === "keys"
          ? MAX_CURRENT_EVIDENCE_KEYS
          : MAX_CURRENT_EVIDENCE_STRING_BYTES;
  if (state[kind] > limit) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT",
      `Current M05 host evidence exceeds its aggregate ${kind} budget.`,
    );
  }
}

function normalizeAuditedJsonDomain(
  value,
  state = {
    nodes: 0,
    scalars: 0,
    keys: 0,
    stringBytes: 0,
    active: new WeakSet(),
  },
  depth = 0,
) {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    consumeCurrentEvidenceBudget(state, "scalars");
    if (typeof value === "string") {
      consumeCurrentEvidenceBudget(state, "stringBytes", Buffer.byteLength(value, "utf8"));
    }
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    consumeCurrentEvidenceBudget(state, "scalars");
    return value;
  }
  if (
    typeof value !== "object" ||
    utilTypes.isProxy(value) ||
    depth > 256 ||
    state.active.has(value)
  ) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT",
      "Current M05 host evidence left the bounded acyclic JSON domain.",
    );
  }
  consumeCurrentEvidenceBudget(state, "nodes");
  state.active.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype) {
        fail(
          "REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT",
          "Current M05 host evidence contains a hostile array prototype.",
        );
      }
      const keys = Reflect.ownKeys(value);
      if (
        keys.some((key) => typeof key !== "string") ||
        keys.filter((key) => key !== "length").length !== value.length
      ) {
        fail(
          "REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT",
          "Current M05 host evidence contains a sparse or decorated array.",
        );
      }
      consumeCurrentEvidenceBudget(state, "keys", value.length);
      return Array.from({ length: value.length }, (_, index) => {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
          fail(
            "REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT",
            "Current M05 host evidence contains a non-data array entry.",
          );
        }
        return normalizeAuditedJsonDomain(descriptor.value, state, depth + 1);
      });
    }
    const prototype = Object.getPrototypeOf(value);
    const keys = Reflect.ownKeys(value);
    if (
      (prototype !== Object.prototype && prototype !== null) ||
      keys.some((key) => typeof key !== "string")
    ) {
      fail(
        "REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT",
        "Current M05 host evidence contains a hostile object shape.",
      );
    }
    consumeCurrentEvidenceBudget(state, "keys", keys.length);
    const normalized = {};
    for (const key of keys) {
      consumeCurrentEvidenceBudget(state, "stringBytes", Buffer.byteLength(key, "utf8"));
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
        fail(
          "REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT",
          "Current M05 host evidence contains a non-data object property.",
        );
      }
      Object.defineProperty(normalized, key, {
        configurable: true,
        enumerable: true,
        writable: true,
        value: normalizeAuditedJsonDomain(descriptor.value, state, depth + 1),
      });
    }
    return normalized;
  } finally {
    state.active.delete(value);
  }
}

function validateCurrentTrackedFiles(trackedFiles) {
  if (!Array.isArray(trackedFiles)) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT",
      "Current M05 host observation lost its tracked-file inventory.",
    );
  }
  for (const entry of trackedFiles) {
    if (
      entry === null ||
      typeof entry !== "object" ||
      Array.isArray(entry) ||
      !isDeepStrictEqual(Object.keys(entry).sort(), ["bytes", "path", "sha256"]) ||
      typeof entry.path !== "string" ||
      !validateRelativePath(entry.path) ||
      !Number.isSafeInteger(entry.bytes) ||
      entry.bytes <= 0 ||
      typeof entry.sha256 !== "string" ||
      !/^sha256:[0-9a-f]{64}$/u.test(entry.sha256)
    ) {
      fail(
        "REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT",
        "Current M05 host observation contains a malformed tracked-file record.",
      );
    }
  }
  const paths = trackedFiles.map(({ path: relativePath }) => relativePath);
  if (new Set(paths).size !== paths.length) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT",
      "Current M05 host observation contains duplicate tracked paths.",
    );
  }
  return paths;
}

function currentEnduringEvidenceProjection(rawArtifact) {
  const artifact = normalizeAuditedJsonDomain(rawArtifact);
  const trackedFiles = artifact?.evidence?.trackedFiles;
  const paths = validateCurrentTrackedFiles(trackedFiles);
  for (const relativePath of CURRENT_AUDIT_COORDINATION_PATHS) {
    if (paths.filter((candidate) => candidate === relativePath).length !== 1) {
      fail(
        "REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT",
        `Current M05 host observation must contain one coordination path: ${relativePath}.`,
      );
    }
  }
  return deepFreeze({
    ...artifact,
    evidence: {
      ...artifact.evidence,
      trackedFiles: trackedFiles.filter(
        ({ path: relativePath }) => !CURRENT_AUDIT_COORDINATION_PATH_SET.has(relativePath),
      ),
    },
  });
}

function uniqueRuntimeResolutionModule(runtimeResolution, id, observation) {
  const modules = runtimeResolution?.modules;
  if (!Array.isArray(modules)) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT",
      `The ${observation} M05 runtime observation lost its module inventory.`,
    );
  }
  const matches = modules.filter((module) => module?.id === id);
  if (matches.length !== 1) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT",
      `The ${observation} M05 runtime observation must contain one reviewed module: ${id}.`,
    );
  }
  return matches[0];
}

function assertPinnedRuntimeResolutionDigest(runtimeResolution, expected, observation) {
  if (!Array.isArray(runtimeResolution?.modules)) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT",
      `The ${observation} M05 runtime observation lost its module inventory.`,
    );
  }
  const observedGraphSha256 = `sha256:${sha256(
    Buffer.from(JSON.stringify(runtimeResolution.modules)),
  )}`;
  if (
    runtimeResolution?.graphSha256 !== expected.graphSha256 ||
    runtimeResolution.graphSha256 !== observedGraphSha256 ||
    runtimeResolution?.backingSnapshotSha256 !== expected.backingSnapshotSha256
  ) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT",
      `The ${observation} M05 runtime observation is outside the reviewed M06-T05 successor.`,
    );
  }
}

function normalizeReviewedValidatorSuccessor(historical, current) {
  assertPinnedRuntimeResolutionDigest(
    historical.runtimeResolution,
    M06_T05_VALIDATOR_SUCCESSOR.historicalRuntimeResolution,
    "historical",
  );
  assertPinnedRuntimeResolutionDigest(
    current.runtimeResolution,
    M06_T05_VALIDATOR_SUCCESSOR.successorRuntimeResolution,
    "current",
  );

  const normalized = normalizeAuditedJsonDomain(current);
  const reviewedSuccessorReceipts = [
    APPROVED_M07_T06_DEPENDENCY_POLICY_SUCCESSOR.referenceHostPackage,
    APPROVED_M07_T06_DEPENDENCY_POLICY_SUCCESSOR.dependencyBoundaryConfig,
  ];
  for (const reviewed of reviewedSuccessorReceipts) {
    const historicalRecord = uniqueCurrentTrackedRecord(historical, reviewed.path);
    const currentRecord = uniqueCurrentTrackedRecord(current, reviewed.path);
    const normalizedRecord = uniqueCurrentTrackedRecord(normalized, reviewed.path);
    if (
      historicalRecord.bytes !== reviewed.historical.bytes ||
      historicalRecord.sha256 !== reviewed.historical.sha256 ||
      currentRecord.bytes !== reviewed.successor.bytes ||
      currentRecord.sha256 !== reviewed.successor.sha256
    ) {
      fail(
        "REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT",
        `The reviewed M07-T06 dependency-policy receipt drifted: ${reviewed.path}.`,
      );
    }
    normalizedRecord.bytes = historicalRecord.bytes;
    normalizedRecord.sha256 = historicalRecord.sha256;
  }
  if (
    historical.runtimeResolution.staticEdges !==
      M06_T05_VALIDATOR_SUCCESSOR.historicalRuntimeResolution.staticEdges ||
    historical.runtimeResolution.assertions !==
      M06_T05_VALIDATOR_SUCCESSOR.historicalRuntimeResolution.assertions ||
    current.runtimeResolution.staticEdges !==
      M06_T05_VALIDATOR_SUCCESSOR.successorRuntimeResolution.staticEdges ||
    current.runtimeResolution.assertions !==
      M06_T05_VALIDATOR_SUCCESSOR.successorRuntimeResolution.assertions
  ) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT",
      "The reviewed M06-T05 Validator runtime graph counters drifted.",
    );
  }
  normalized.runtimeResolution.graphSha256 = historical.runtimeResolution.graphSha256;
  normalized.runtimeResolution.backingSnapshotSha256 =
    historical.runtimeResolution.backingSnapshotSha256;
  normalized.runtimeResolution.staticEdges = historical.runtimeResolution.staticEdges;
  normalized.runtimeResolution.assertions = historical.runtimeResolution.assertions;

  for (const reviewed of M06_T05_VALIDATOR_SUCCESSOR.modules) {
    const historicalModule = uniqueRuntimeResolutionModule(
      historical.runtimeResolution,
      reviewed.id,
      "historical",
    );
    const currentModule = uniqueRuntimeResolutionModule(
      current.runtimeResolution,
      reviewed.id,
      "current",
    );
    if (
      historical.runtimeResolution.modules[reviewed.index] !== historicalModule ||
      current.runtimeResolution.modules[reviewed.index] !== currentModule ||
      historicalModule.codeBytes !== reviewed.historical.codeBytes ||
      historicalModule.codeSha256 !== reviewed.historical.codeSha256 ||
      currentModule.codeBytes !== reviewed.successor.codeBytes ||
      currentModule.codeSha256 !== reviewed.successor.codeSha256
    ) {
      fail(
        "REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT",
        `The reviewed M06-T05 Validator module bytes drifted: ${reviewed.id}.`,
      );
    }
    const normalizedModule = uniqueRuntimeResolutionModule(
      normalized.runtimeResolution,
      reviewed.id,
      "normalized current",
    );
    if (normalized.runtimeResolution.modules[reviewed.index] !== normalizedModule) {
      fail(
        "REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT",
        `The reviewed M06-T05 Validator module index drifted: ${reviewed.id}.`,
      );
    }
    normalizedModule.codeBytes = historicalModule.codeBytes;
    normalizedModule.codeSha256 = historicalModule.codeSha256;
    if (
      reviewed.historicalImports !== undefined &&
      (!isDeepStrictEqual(historicalModule.imports, reviewed.historicalImports) ||
        !isDeepStrictEqual(currentModule.imports, reviewed.successorImports))
    ) {
      fail(
        "REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT",
        `The reviewed M06-T05 Validator module imports drifted: ${reviewed.id}.`,
      );
    }
    if (reviewed.historicalImports !== undefined) {
      normalizedModule.imports = normalizeAuditedJsonDomain(historicalModule.imports);
    }
  }
  return deepFreeze(normalized);
}

/**
 * Authenticates the exact M06-T05 Validator sources that produced the reviewed runtime successor.
 *
 * @remarks Direct source pins avoid a circular proof dependency: this enduring M05 verifier is
 * itself tracked by earlier Publisher receipts. The current Vite graph and backing snapshot are
 * independently pinned by {@link verifyReferenceHostWebCurrentEvidencePolicy}.
 */
export function verifyReferenceHostWebValidatorSuccessorSources(rawSourceBytes) {
  const captured = captureDenseArray(
    rawSourceBytes,
    "M06-T05 Validator successor sources",
    M06_T05_VALIDATOR_SUCCESSOR.sourceFiles.length,
    (entry, index) => {
      const bytes = optionalBytes(entry, `M06-T05 Validator source ${index}`);
      if (bytes === undefined) {
        fail(
          "REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID",
          "M05-T09 current compatibility requires every M06-T05 Validator source.",
        );
      }
      return bytes;
    },
  );
  if (captured.length !== M06_T05_VALIDATOR_SUCCESSOR.sourceFiles.length) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID",
      "M05-T09 current compatibility requires the exact M06-T05 Validator source inventory.",
    );
  }
  const sources = captured.map((bytes, index) => {
    const expected = M06_T05_VALIDATOR_SUCCESSOR.sourceFiles[index];
    const actualSha256 = sha256(bytes);
    if (bytes.length !== expected.bytes || actualSha256 !== expected.sha256) {
      fail(
        "REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT",
        `The reviewed M06-T05 Validator source drifted: ${expected.path}.`,
        {
          path: expected.path,
          expectedBytes: expected.bytes,
          actualBytes: bytes.length,
          expectedSha256: expected.sha256,
          actualSha256,
        },
      );
    }
    return Object.freeze({
      path: expected.path,
      bytes: bytes.length,
      sha256: actualSha256,
    });
  });
  return Object.freeze({
    result: "PASS",
    task: M06_T05_VALIDATOR_SUCCESSOR.task,
    sources: Object.freeze(sources),
  });
}

function enduringProjectionSha256(artifact) {
  return sha256(SAFE_BUFFER_FROM(SAFE_JSON_STRINGIFY(artifact), "utf8"));
}

function normalizeReviewedReferenceHostChannelSuccessor(historical, current) {
  const historicalSha256 = enduringProjectionSha256(historical);
  const successorSha256 = enduringProjectionSha256(current);
  const source = current.sourceAudit;
  const channelRecords = current.evidence.trackedFiles.filter(
    ({ path: relativePath }) => relativePath === M07_T11_REFERENCE_HOST_SUCCESSOR.channelSource,
  );
  if (
    historicalSha256 !== M07_T11_REFERENCE_HOST_SUCCESSOR.historicalProjectionSha256 ||
    successorSha256 !== M07_T11_REFERENCE_HOST_SUCCESSOR.successorProjectionSha256 ||
    source.sourceFiles !== M07_T11_REFERENCE_HOST_SUCCESSOR.sourceFiles ||
    source.executableSourceFiles !== M07_T11_REFERENCE_HOST_SUCCESSOR.executableSourceFiles ||
    source.importDeclarations !== M07_T11_REFERENCE_HOST_SUCCESSOR.importDeclarations ||
    source.executableAuthoritySurface?.descriptors !==
      M07_T11_REFERENCE_HOST_SUCCESSOR.executableDescriptors ||
    source.executableAuthoritySurface?.sha256 !==
      M07_T11_REFERENCE_HOST_SUCCESSOR.executableSurfaceSha256 ||
    source.publicRuntimeReactRenderPreflightCalls !== 1 ||
    channelRecords.length !== 1
  ) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT",
      "Current reference-host evidence is outside the exact reviewed M07-T11 channel successor.",
      { historicalSha256, successorSha256 },
    );
  }
  return historical;
}

/**
 * Compares two already-audited observations across every enduring M05 host claim and input.
 *
 * @remarks Only root package coordination, the workspace lockfile, and the four migrated M05
 * proof implementation paths are excluded from raw-byte equality. The sole runtime successor is
 * the exact six-module Validator build proven through M06-T05; its source bytes, module bytes,
 * complete graph digest, and complete backing snapshot are all independently pinned. The one
 * execution-to-semantic authority import and its two derived graph counters are separately
 * exact-pinned and normalized for historical comparison; every other import, module identity,
 * module byte, and enduring host claim remains byte-for-byte equal.
 */
export function verifyReferenceHostWebCurrentEvidencePolicy(
  historicalArtifact,
  currentArtifact,
  successorSourceBytes = undefined,
) {
  const historical = currentEnduringEvidenceProjection(historicalArtifact);
  const current = currentEnduringEvidenceProjection(currentArtifact);
  const alreadyHistorical = isDeepStrictEqual(historical, current);
  const successorSources = alreadyHistorical
    ? null
    : verifyReferenceHostWebValidatorSuccessorSources(successorSourceBytes);
  let successorTask = null;
  let comparedCurrent = current;
  if (!alreadyHistorical) {
    if (
      enduringProjectionSha256(current) ===
      M07_T11_REFERENCE_HOST_SUCCESSOR.successorProjectionSha256
    ) {
      comparedCurrent = normalizeReviewedReferenceHostChannelSuccessor(historical, current);
      successorTask = M07_T11_REFERENCE_HOST_SUCCESSOR.task;
    } else {
      comparedCurrent = normalizeReviewedValidatorSuccessor(historical, current);
      successorTask = M06_T05_VALIDATOR_SUCCESSOR.task;
    }
  }
  if (!isDeepStrictEqual(historical, comparedCurrent)) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT",
      "Current reference-host evidence differs from the enduring M05 host evidence.",
    );
  }
  return Object.freeze({
    result: "PASS",
    comparedTrackedFiles: historical.evidence.trackedFiles.length,
    excludedCoordinationPaths: CURRENT_AUDIT_COORDINATION_PATHS,
    successorSources,
    admittedSuccessor: alreadyHistorical
      ? null
      : successorTask === M07_T11_REFERENCE_HOST_SUCCESSOR.task
        ? Object.freeze({
            task: M07_T11_REFERENCE_HOST_SUCCESSOR.task,
            channelSource: M07_T11_REFERENCE_HOST_SUCCESSOR.channelSource,
            predecessor: M06_T05_VALIDATOR_SUCCESSOR.task,
          })
        : Object.freeze({
            task: M06_T05_VALIDATOR_SUCCESSOR.task,
            sourceFiles: Object.freeze(
              M06_T05_VALIDATOR_SUCCESSOR.sourceFiles.map(({ path: relativePath }) => relativePath),
            ),
            modules: Object.freeze(M06_T05_VALIDATOR_SUCCESSOR.modules.map(({ id }) => id)),
          }),
  });
}

function strictUtf8(bytes, label) {
  try {
    const decoder = new SAFE_TEXT_DECODER("utf-8", { fatal: true });
    return SAFE_REFLECT_APPLY(SAFE_TEXT_DECODER_DECODE, decoder, [bytes]);
  } catch {
    fail("REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT", `Current M05 ${label} is not strict UTF-8.`);
  }
}

function safeStringIndexOf(value, search, fromIndex = 0) {
  return SAFE_REFLECT_APPLY(SAFE_STRING_INDEX_OF, value, [search, fromIndex]);
}

async function formatCanonicalJson(value) {
  return SAFE_BUFFER_FROM(
    await format(SAFE_JSON_STRINGIFY(value), {
      endOfLine: "lf",
      parser: "json-stringify",
      printWidth: 100,
      tabWidth: 2,
    }),
    "utf8",
  );
}

async function inspectCurrentControlPlanePackageBytes(rawBytes) {
  const bytes = SAFE_BUFFER_FROM(rawBytes);
  const text = strictUtf8(bytes, "control-plane package manifest");
  const manifest = parseJson(
    bytes,
    "current control-plane package manifest",
    "REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT",
  );
  if (
    manifest === null ||
    typeof manifest !== "object" ||
    Array.isArray(manifest) ||
    manifest.scripts === null ||
    typeof manifest.scripts !== "object" ||
    Array.isArray(manifest.scripts) ||
    manifest.dependencies === null ||
    typeof manifest.dependencies !== "object" ||
    Array.isArray(manifest.dependencies)
  ) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT",
      "Current M05 control-plane package manifest lost its package, scripts, or dependency shape.",
    );
  }
  const canonicalCurrent = await formatCanonicalJson(manifest);
  if (!canonicalCurrent.equals(bytes) || canonicalCurrent.toString("utf8") !== text) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT",
      "Current M05 control-plane package manifest is not canonical JSON.",
    );
  }
  const expected = M07_T10_CONTROL_PLANE_COORDINATION.packageTest;
  const packageTestDescriptor = SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR(
    manifest.scripts,
    expected.script,
  );
  const validatorDescriptor = SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR(
    manifest.dependencies,
    "@desen/validator",
  );
  const runtimeCoreDescriptor = SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR(
    manifest.dependencies,
    "@desen/runtime-core",
  );
  if (
    bytes.length !== expected.bytes ||
    sha256(bytes) !== expected.sha256 ||
    manifest.name !== expected.package ||
    packageTestDescriptor === undefined ||
    !packageTestDescriptor.enumerable ||
    !("value" in packageTestDescriptor) ||
    packageTestDescriptor.value !== expected.command ||
    validatorDescriptor === undefined ||
    !validatorDescriptor.enumerable ||
    !("value" in validatorDescriptor) ||
    validatorDescriptor.value !== "workspace:*" ||
    runtimeCoreDescriptor === undefined ||
    !runtimeCoreDescriptor.enumerable ||
    !("value" in runtimeCoreDescriptor) ||
    runtimeCoreDescriptor.value !== "workspace:*"
  ) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT",
      "Current M05 control-plane package lost the exact M07-T10 test or dependency authority.",
    );
  }
  return Object.freeze({
    path: expected.path,
    bytes: bytes.length,
    rawSha256: `sha256:${sha256(bytes)}`,
    testScript: expected.script,
    testCommand: expected.command,
    validatorSpecifier: validatorDescriptor.value,
    runtimeCoreSpecifier: runtimeCoreDescriptor.value,
  });
}

async function normalizeCurrentRootPackageBytes(rawBytes) {
  const bytes = SAFE_BUFFER_FROM(rawBytes);
  const text = strictUtf8(bytes, "root package manifest");
  const manifest = parseJson(
    bytes,
    "current root package manifest",
    "REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT",
  );
  if (
    manifest === null ||
    typeof manifest !== "object" ||
    Array.isArray(manifest) ||
    manifest.scripts === null ||
    typeof manifest.scripts !== "object" ||
    Array.isArray(manifest.scripts)
  ) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT",
      "Current M05 root package manifest lost its object and scripts shape.",
    );
  }
  const canonicalCurrent = await formatCanonicalJson(manifest);
  if (!canonicalCurrent.equals(bytes) || canonicalCurrent.toString("utf8") !== text) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT",
      "Current M05 root package manifest is not canonical JSON.",
    );
  }
  const expectedControlPlaneScripts = SAFE_OBJECT_ENTRIES(
    M07_T10_CONTROL_PLANE_COORDINATION.scripts,
  );
  const observedControlPlaneScriptKeys = [];
  const expectedControlPlaneScriptKeys = [];
  const manifestScriptKeys = SAFE_OBJECT_KEYS(manifest.scripts);
  let index = 0;
  while (index < manifestScriptKeys.length) {
    const scriptName = manifestScriptKeys[index];
    if (
      SAFE_REFLECT_APPLY(
        SAFE_REGEXP_TEST,
        /^(?:generate|test|verify):control-plane(?:-[a-z0-9]+)*$/u,
        [scriptName],
      )
    ) {
      observedControlPlaneScriptKeys[observedControlPlaneScriptKeys.length] = scriptName;
    }
    index += 1;
  }
  index = 0;
  while (index < expectedControlPlaneScripts.length) {
    const scriptName = expectedControlPlaneScripts[index][0];
    const command = expectedControlPlaneScripts[index][1];
    expectedControlPlaneScriptKeys[expectedControlPlaneScriptKeys.length] = scriptName;
    const descriptor = SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR(manifest.scripts, scriptName);
    if (
      descriptor === undefined ||
      !descriptor.enumerable ||
      !("value" in descriptor) ||
      descriptor.value !== command
    ) {
      fail(
        "REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT",
        "Current M05 root package lost the exact reviewed M07-T10 control-plane commands.",
      );
    }
    index += 1;
  }
  SAFE_REFLECT_APPLY(SAFE_ARRAY_SORT, observedControlPlaneScriptKeys, []);
  SAFE_REFLECT_APPLY(SAFE_ARRAY_SORT, expectedControlPlaneScriptKeys, []);
  if (!isDeepStrictEqual(observedControlPlaneScriptKeys, expectedControlPlaneScriptKeys)) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT",
      "Current M05 root package lost the exact reviewed M07-T10 control-plane commands.",
    );
  }
  const packageTestRootSegment = M07_T10_CONTROL_PLANE_COORDINATION.packageTest.rootSegment;
  const packageTestRootScripts = [
    "generate:control-plane-runtime-transition-races",
    "verify:control-plane-runtime-transition-races",
    "test:control-plane-runtime-transition-races",
  ];
  let packageTestScriptIndex = 0;
  while (packageTestScriptIndex < packageTestRootScripts.length) {
    const scriptName = packageTestRootScripts[packageTestScriptIndex];
    const segments = SAFE_REFLECT_APPLY(SAFE_STRING_SPLIT, manifest.scripts[scriptName], [" && "]);
    let occurrences = 0;
    let packageTestSegmentIndex = 0;
    while (packageTestSegmentIndex < segments.length) {
      if (segments[packageTestSegmentIndex] === packageTestRootSegment) occurrences += 1;
      packageTestSegmentIndex += 1;
    }
    if (occurrences !== 1) {
      fail(
        "REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT",
        "Current M05 root package lost the exact M07-T10 package-test segment.",
      );
    }
    packageTestScriptIndex += 1;
  }
  let edgeIndex = 0;
  while (edgeIndex < M07_T10_CONTROL_PLANE_COORDINATION.aggregateEdges.length) {
    const historicalEdge = M07_T10_CONTROL_PLANE_COORDINATION.aggregateEdges[edgeIndex];
    const successorEdge = M07_T11_REFERENCE_HOST_COORDINATION.aggregateEdges[edgeIndex];
    const commandDescriptor = SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR(
      manifest.scripts,
      historicalEdge.script,
    );
    if (
      commandDescriptor === undefined ||
      !commandDescriptor.enumerable ||
      !("value" in commandDescriptor) ||
      typeof commandDescriptor.value !== "string"
    ) {
      fail(
        "REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT",
        `Current M05 root ${historicalEdge.script} coordination script is missing.`,
      );
    }
    const command = commandDescriptor.value;
    const segments = SAFE_REFLECT_APPLY(SAFE_STRING_SPLIT, command, [" && "]);
    let malformed = false;
    index = 0;
    while (index < segments.length) {
      if (segments[index].length === 0) malformed = true;
      index += 1;
    }
    const matchesEdge = (edge) => {
      const segmentIndex = segments.indexOf(edge.segment);
      return (
        segments.length === edge.segments &&
        sha256(command) === edge.sha256 &&
        segmentIndex >= 1 &&
        segments.lastIndexOf(edge.segment) === segmentIndex &&
        segments[segmentIndex - 1] === edge.predecessor &&
        segments[segmentIndex + 1] === edge.successor
      );
    };
    if (malformed || (!matchesEdge(historicalEdge) && !matchesEdge(successorEdge))) {
      fail(
        "REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT",
        `Current M05 root ${historicalEdge.script} lost the exact reviewed M07-T10/T11 aggregate edge.`,
      );
    }
    edgeIndex += 1;
  }
  const normalizedScripts = SAFE_OBJECT_CREATE(null);
  const currentScriptEntries = SAFE_OBJECT_ENTRIES(manifest.scripts);
  index = 0;
  while (index < currentScriptEntries.length) {
    const scriptName = currentScriptEntries[index][0];
    const command = currentScriptEntries[index][1];
    if (
      !SAFE_REFLECT_APPLY(
        SAFE_REGEXP_TEST,
        /^(?:generate|test|verify):publisher(?:-[a-z0-9]+)*$/u,
        [scriptName],
      ) &&
      !SAFE_OBJECT_HAS_OWN(M07_T10_CONTROL_PLANE_COORDINATION.scripts, scriptName) &&
      !SAFE_OBJECT_HAS_OWN(M07_T11_REFERENCE_HOST_COORDINATION.scripts, scriptName)
    ) {
      SAFE_OBJECT_DEFINE_PROPERTY(normalizedScripts, scriptName, {
        configurable: true,
        enumerable: true,
        writable: true,
        value: command,
      });
    }
    index += 1;
  }
  manifest.scripts = normalizedScripts;
  const aggregateScripts = [
    ["check", "verify"],
    ["test", "test"],
  ];
  let aggregateIndex = 0;
  while (aggregateIndex < aggregateScripts.length) {
    const scriptName = aggregateScripts[aggregateIndex][0];
    const commandKind = aggregateScripts[aggregateIndex][1];
    const commandDescriptor = SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR(manifest.scripts, scriptName);
    if (
      commandDescriptor === undefined ||
      !commandDescriptor.enumerable ||
      !("value" in commandDescriptor) ||
      typeof commandDescriptor.value !== "string"
    ) {
      fail(
        "REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT",
        `Current M05 root ${scriptName} coordination script is missing.`,
      );
    }
    const segments = SAFE_REFLECT_APPLY(SAFE_STRING_SPLIT, commandDescriptor.value, [" && "]);
    const normalizedSegments = [];
    const publisherSegment =
      commandKind === "verify"
        ? /^pnpm verify:publisher(?:-[a-z0-9]+)*$/u
        : /^pnpm test:publisher(?:-[a-z0-9]+)*$/u;
    index = 0;
    while (index < segments.length) {
      const segment = segments[index];
      if (segment.length === 0) {
        fail(
          "REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT",
          `Current M05 root ${scriptName} coordination script is malformed.`,
        );
      }
      let isControlPlaneSegment = false;
      edgeIndex = 0;
      while (edgeIndex < M07_T10_CONTROL_PLANE_COORDINATION.aggregateEdges.length) {
        const edge = M07_T10_CONTROL_PLANE_COORDINATION.aggregateEdges[edgeIndex];
        if (edge.script === scriptName) {
          let normalizedSegmentIndex = 0;
          while (normalizedSegmentIndex < edge.normalizedSegments.length) {
            if (edge.normalizedSegments[normalizedSegmentIndex] === segment) {
              isControlPlaneSegment = true;
            }
            normalizedSegmentIndex += 1;
          }
        }
        edgeIndex += 1;
      }
      const t11Edge = M07_T11_REFERENCE_HOST_COORDINATION.aggregateEdges.find(
        ({ script: edgeScript }) => edgeScript === scriptName,
      );
      if (t11Edge?.segment === segment) isControlPlaneSegment = true;
      if (
        !SAFE_REFLECT_APPLY(SAFE_REGEXP_TEST, publisherSegment, [segment]) &&
        !isControlPlaneSegment
      ) {
        normalizedSegments[normalizedSegments.length] = segment;
      }
      index += 1;
    }
    SAFE_OBJECT_DEFINE_PROPERTY(manifest.scripts, scriptName, {
      configurable: true,
      enumerable: true,
      writable: true,
      value: SAFE_REFLECT_APPLY(SAFE_ARRAY_JOIN, normalizedSegments, [" && "]),
    });
    aggregateIndex += 1;
  }
  return formatCanonicalJson(manifest);
}

function failCurrentLockfile(message) {
  fail("REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT", `Current M05 lockfile ${message}.`);
}

function scanYamlToken(text, label) {
  const stack = [];
  let quote;
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quote === "'") {
      if (character === "'" && text[index + 1] === "'") {
        index += 1;
      } else if (character === "'") {
        quote = undefined;
      }
      continue;
    }
    if (quote === '"') {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        quote = undefined;
      }
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    const previous = index === 0 ? undefined : text[index - 1];
    const tokenBoundary =
      index === 0 || previous === " " || previous === "\t" || previous === "[" || previous === "{";
    if ((character === "&" || character === "!" || character === "*") && tokenBoundary) {
      failCurrentLockfile(`${label} uses a forbidden YAML anchor, alias, or tag`);
    }
    if (character === "#" && (index === 0 || previous === " ")) {
      failCurrentLockfile(`${label} uses an unquoted YAML comment`);
    }
    if (character === "[" || character === "{") {
      stack.push(character);
    } else if (character === "]" || character === "}") {
      const expected = character === "]" ? "[" : "{";
      if (stack.pop() !== expected) {
        failCurrentLockfile(`${label} has an unbalanced flow collection`);
      }
    }
  }
  if (quote !== undefined || escaped || stack.length !== 0) {
    failCurrentLockfile(`${label} has an unterminated quote or flow collection`);
  }
}

function splitYamlFlowEntries(text, label) {
  const entries = [];
  let start = 0;
  const stack = [];
  let quote;
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quote === "'") {
      if (character === "'" && text[index + 1] === "'") {
        index += 1;
      } else if (character === "'") {
        quote = undefined;
      }
      continue;
    }
    if (quote === '"') {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') quote = undefined;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
    } else if (character === "[" || character === "{") {
      stack.push(character);
    } else if (character === "]" || character === "}") {
      stack.pop();
    } else if (character === "," && stack.length === 0) {
      entries.push(text.slice(start, index).trim());
      start = index + 1;
    }
  }
  entries.push(text.slice(start).trim());
  if (entries.some((entry) => entry.length === 0)) {
    failCurrentLockfile(`${label} has an empty flow entry`);
  }
  return entries;
}

function findYamlMappingColon(text) {
  const stack = [];
  let quote;
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quote === "'") {
      if (character === "'" && text[index + 1] === "'") index += 1;
      else if (character === "'") quote = undefined;
      continue;
    }
    if (quote === '"') {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') quote = undefined;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
    } else if (character === "[" || character === "{") {
      stack.push(character);
    } else if (character === "]" || character === "}") {
      stack.pop();
    } else if (
      character === ":" &&
      stack.length === 0 &&
      (index === text.length - 1 || text[index + 1] === " ")
    ) {
      return index;
    }
  }
  return -1;
}

function decodeYamlKey(rawKey, label) {
  const key = rawKey.trim();
  if (key.length === 0 || key === "<<" || /^[&*!?[\]{},#|>@`]/u.test(key)) {
    failCurrentLockfile(`${label} has an unsafe mapping key`);
  }
  scanYamlToken(key, `${label} key`);
  if (key.startsWith("'")) {
    if (!key.endsWith("'") || key.length < 2) {
      failCurrentLockfile(`${label} has an invalid single-quoted key`);
    }
    return key.slice(1, -1).replaceAll("''", "'");
  }
  if (key.startsWith('"')) {
    try {
      const decoded = JSON.parse(key);
      if (typeof decoded !== "string") throw new TypeError("not a string");
      return decoded;
    } catch {
      failCurrentLockfile(`${label} has an invalid double-quoted key`);
    }
  }
  if (key.includes(": ")) {
    failCurrentLockfile(`${label} has an ambiguous plain mapping key`);
  }
  validateYamlPlainScalar(key, `${label} key`);
  return key;
}

function validateYamlPlainScalar(value, label) {
  const first = value[0];
  if ([",", "]", "}", "#", "&", "*", "!", "|", ">", "%", "@", "`"].includes(first)) {
    failCurrentLockfile(`${label} begins with a forbidden plain-scalar indicator`);
  }
  if (
    ["-", "?", ":"].includes(first) &&
    (value.length === 1 || value[1] === " " || value[1] === "\t")
  ) {
    failCurrentLockfile(`${label} begins with an ambiguous plain-scalar indicator`);
  }
  if (value.endsWith(":") || value.includes(": ") || value.includes(" #")) {
    failCurrentLockfile(`${label} has an ambiguous plain scalar`);
  }
}

const PNPM_YAML_FLOAT_PATTERN =
  /^(?:[-+]?(?:0|[1-9][0-9_]*)(?:\.[0-9_]*)?(?:[eE][-+]?[0-9]+)?|\.[0-9_]+(?:[eE][-+]?[0-9]+)?|[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*|[-+]?\.(?:inf|Inf|INF)|\.(?:nan|NaN|NAN))$/u;
const PNPM_YAML_DATE_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/u;
const PNPM_YAML_TIMESTAMP_PATTERN =
  /^[0-9]{4}-[0-9]{1,2}-[0-9]{1,2}(?:[Tt]|[ \t]+)[0-9]{1,2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]*)?(?:[ \t]*(?:Z|[-+][0-9]{1,2}(?::[0-9]{2})?))?$/u;

function isPnpmYamlImplicitNonString(value) {
  if (/^(?:~|null|Null|NULL|true|True|TRUE|false|False|FALSE)$/u.test(value)) return true;
  if (
    /^[-+]?0b[01_]+$/u.test(value) ||
    /^[-+]?0x[0-9a-fA-F_]+$/u.test(value) ||
    /^[-+]?0[0-7_]+$/u.test(value) ||
    /^[-+]?[1-9][0-9_]*(?::[0-5]?[0-9])+$/u.test(value) ||
    /^[-+]?0o[0-7_]+$/u.test(value)
  ) {
    return !value.endsWith("_");
  }
  return (
    (PNPM_YAML_FLOAT_PATTERN.test(value) && !value.endsWith("_")) ||
    PNPM_YAML_DATE_PATTERN.test(value) ||
    PNPM_YAML_TIMESTAMP_PATTERN.test(value)
  );
}

function validatePublisherStringScalar(value, label) {
  let decoded;
  if (value.startsWith("'")) {
    decoded = value.slice(1, -1).replaceAll("''", "'");
  } else if (value.startsWith('"')) {
    decoded = JSON.parse(value);
  } else {
    if (isPnpmYamlImplicitNonString(value)) {
      failCurrentLockfile(`${label} must not resolve to a non-string YAML scalar`);
    }
    decoded = value;
  }
  if (
    decoded.length === 0 ||
    decoded.length > 4_096 ||
    decoded !== decoded.trim() ||
    !decoded.isWellFormed() ||
    containsForbiddenYamlControl(decoded, false)
  ) {
    failCurrentLockfile(`${label} must be a bounded control-free string scalar`);
  }
  return decoded;
}

function validatePublisherDependencyName(value) {
  if (
    value.length > 214 ||
    !/^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/u.test(value) ||
    value === "node_modules" ||
    value === "favicon.ico"
  ) {
    failCurrentLockfile("has an invalid Publisher dependency name");
  }
}

function validateYamlScalar(rawValue, label) {
  const value = rawValue.trim();
  if (
    value.length === 0 ||
    value === "-" ||
    value === "?" ||
    value === ":" ||
    value.startsWith("|") ||
    value.startsWith(">") ||
    value.startsWith("%") ||
    value === "---" ||
    value === "..."
  ) {
    failCurrentLockfile(`${label} has an unsafe or empty scalar`);
  }
  scanYamlToken(value, label);
  if (value.startsWith("'")) {
    if (!value.endsWith("'") || value.length < 2) {
      failCurrentLockfile(`${label} has an invalid single-quoted scalar`);
    }
    return "scalar";
  } else if (value.startsWith('"')) {
    try {
      if (typeof JSON.parse(value) !== "string") throw new TypeError("not a string");
    } catch {
      failCurrentLockfile(`${label} has an invalid double-quoted scalar`);
    }
    return "scalar";
  } else if (value.startsWith("{")) {
    if (!value.endsWith("}")) failCurrentLockfile(`${label} has an invalid flow mapping`);
    const inner = value.slice(1, -1).trim();
    if (inner.length > 0) {
      const keys = new Set();
      for (const entry of splitYamlFlowEntries(inner, label)) {
        const colon = findYamlMappingColon(entry);
        if (colon < 0) failCurrentLockfile(`${label} has a malformed flow mapping entry`);
        const key = decodeYamlKey(entry.slice(0, colon), label);
        if (keys.has(key)) failCurrentLockfile(`${label} has a duplicate flow mapping key`);
        keys.add(key);
        validateYamlScalar(entry.slice(colon + 1), label);
      }
    }
    return "flow-mapping";
  } else if (value.startsWith("[")) {
    if (!value.endsWith("]")) failCurrentLockfile(`${label} has an invalid flow sequence`);
    const inner = value.slice(1, -1).trim();
    if (inner.length > 0) {
      for (const entry of splitYamlFlowEntries(inner, label)) {
        validateYamlScalar(entry, label);
      }
    }
    return "flow-sequence";
  }
  validateYamlPlainScalar(value, label);
  return "scalar";
}

function parseYamlMappingLine(content, label) {
  const colon = findYamlMappingColon(content);
  if (colon < 0) failCurrentLockfile(`${label} is not a mapping entry`);
  const key = decodeYamlKey(content.slice(0, colon), label);
  const rawValue = content.slice(colon + 1);
  if (rawValue.length > 0 && !rawValue.startsWith(" ")) {
    failCurrentLockfile(`${label} lacks canonical mapping whitespace`);
  }
  const value = rawValue.trim();
  const valueKind = value.length > 0 ? validateYamlScalar(value, `${label} value`) : "empty";
  return Object.freeze({
    key,
    opensContainer: value.length === 0,
    value,
    valueKind,
  });
}

function validateCompletePnpmLockfileYaml(lines) {
  if (lines.length > 100_000) failCurrentLockfile("exceeds its line budget");
  const contexts = new Map([[0, { type: "mapping", keys: new Set(), path: [] }]]);
  const topLevelKeys = [];
  let previous;
  let tokens = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.length > 65_536) failCurrentLockfile("exceeds its line-length budget");
    if (line.includes("\t") || line.endsWith(" ")) {
      failCurrentLockfile("contains tabs or trailing whitespace");
    }
    if (line.length === 0) continue;
    const indentation = line.length - line.trimStart().length;
    if (indentation % 2 !== 0 || indentation > 64) {
      failCurrentLockfile("contains invalid or excessive indentation");
    }
    const content = line.slice(indentation);
    if (previous === undefined && indentation !== 0) {
      failCurrentLockfile("does not begin with a root mapping");
    }
    if (previous !== undefined && indentation > previous.indentation) {
      if (indentation !== previous.indentation + 2 || !previous.opensContainer) {
        failCurrentLockfile("contains an invalid indentation transition");
      }
      contexts.set(indentation, {
        type: content.startsWith("- ") ? "sequence" : "mapping",
        keys: new Set(),
        path: previous.childPath,
      });
    } else {
      for (const depth of [...contexts.keys()]) {
        if (depth > indentation) contexts.delete(depth);
      }
    }
    const context = contexts.get(indentation);
    if (context === undefined) failCurrentLockfile("contains an orphan indentation level");
    tokens += 1;
    if (tokens > 200_000) failCurrentLockfile("exceeds its token budget");
    if (content.startsWith("- ")) {
      if (context.type !== "sequence") failCurrentLockfile("mixes sequence and mapping entries");
      validateYamlScalar(content.slice(2), `line ${index + 1}`);
      previous = {
        indentation,
        opensContainer: false,
        childPath: context.path,
      };
      continue;
    }
    if (context.type !== "mapping") failCurrentLockfile("mixes mapping and sequence entries");
    const entry = parseYamlMappingLine(content, `line ${index + 1}`);
    if (context.keys.has(entry.key)) failCurrentLockfile(`has duplicate key at line ${index + 1}`);
    context.keys.add(entry.key);
    if (indentation === 0) topLevelKeys.push(entry.key);
    previous = {
      indentation,
      opensContainer: entry.opensContainer,
      childPath: [...context.path, entry.key],
    };
  }
  if (previous?.opensContainer === true) failCurrentLockfile("ends with an empty container");
  if (
    !isDeepStrictEqual(topLevelKeys, [
      "lockfileVersion",
      "settings",
      "importers",
      "packages",
      "snapshots",
    ])
  ) {
    failCurrentLockfile("has an unexpected root section inventory");
  }
}

function validatePublisherImporterShape(lines, start, end) {
  const header = lines[start];
  const body = lines.slice(start + 1, end).filter((line) => line.length > 0);
  if (header === "  packages/publisher: {}") {
    if (body.length !== 0) failCurrentLockfile("has content after an empty Publisher importer");
    return;
  }
  if (header !== "  packages/publisher:" || body.length === 0) {
    failCurrentLockfile("has an invalid Publisher importer shape");
  }
  const allowedGroups = new Set([
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "peerDependencies",
  ]);
  const groups = new Set();
  let index = 0;
  while (index < body.length) {
    const groupLine = body[index];
    if (!groupLine.startsWith("    ") || groupLine.startsWith("      ")) {
      failCurrentLockfile("has an invalid Publisher dependency group");
    }
    const group = parseYamlMappingLine(groupLine.slice(4), "Publisher dependency group");
    if (!group.opensContainer || !allowedGroups.has(group.key) || groups.has(group.key)) {
      failCurrentLockfile("has an unknown or duplicate Publisher dependency group");
    }
    groups.add(group.key);
    index += 1;
    let packages = 0;
    while (index < body.length && body[index].startsWith("      ")) {
      if (body[index].startsWith("        ")) {
        failCurrentLockfile("has an orphan Publisher dependency field");
      }
      const dependency = parseYamlMappingLine(body[index].slice(6), "Publisher dependency");
      if (!dependency.opensContainer) {
        failCurrentLockfile("has a non-mapping Publisher dependency");
      }
      validatePublisherDependencyName(dependency.key);
      packages += 1;
      index += 1;
      const fields = [];
      while (index < body.length && body[index].startsWith("        ")) {
        const field = parseYamlMappingLine(body[index].slice(8), "Publisher dependency field");
        if (
          field.opensContainer ||
          field.valueKind !== "scalar" ||
          !["specifier", "version"].includes(field.key)
        ) {
          failCurrentLockfile("has an invalid Publisher dependency field");
        }
        validatePublisherStringScalar(field.value, `Publisher ${field.key}`);
        fields.push(field.key);
        index += 1;
      }
      if (!isDeepStrictEqual(fields, ["specifier", "version"])) {
        failCurrentLockfile("must pin Publisher specifier and version exactly once");
      }
    }
    if (packages === 0) failCurrentLockfile("has an empty Publisher dependency group");
  }
}

function inspectExactReviewedImporter(lines, start, end, expected, label) {
  const body = lines.slice(start + 1, end).filter((line) => line.length > 0);
  if (lines[start] !== `  ${expected.path}:` || body.length === 0) {
    failCurrentLockfile(`lost the reviewed ${label} importer`);
  }
  const groups = [];
  let index = 0;
  while (index < body.length) {
    const groupLine = body[index];
    if (!groupLine.startsWith("    ") || groupLine.startsWith("      ")) {
      failCurrentLockfile(`has an invalid ${label} dependency group`);
    }
    const group = parseYamlMappingLine(groupLine.slice(4), `${label} dependency group`);
    if (!group.opensContainer) {
      failCurrentLockfile(`has a non-mapping ${label} dependency group`);
    }
    index += 1;
    const packages = [];
    while (index < body.length && body[index].startsWith("      ")) {
      if (body[index].startsWith("        ")) {
        failCurrentLockfile(`has an orphan ${label} dependency field`);
      }
      const dependency = parseYamlMappingLine(body[index].slice(6), `${label} dependency`);
      if (!dependency.opensContainer) {
        failCurrentLockfile(`has a non-mapping ${label} dependency`);
      }
      validatePublisherDependencyName(dependency.key);
      index += 1;
      const fields = {};
      const fieldKeys = [];
      while (index < body.length && body[index].startsWith("        ")) {
        const field = parseYamlMappingLine(body[index].slice(8), `${label} dependency field`);
        if (
          field.opensContainer ||
          field.valueKind !== "scalar" ||
          !["specifier", "version"].includes(field.key)
        ) {
          failCurrentLockfile(`has an invalid ${label} dependency field`);
        }
        SAFE_OBJECT_DEFINE_PROPERTY(fields, field.key, {
          configurable: true,
          enumerable: true,
          writable: true,
          value: validatePublisherStringScalar(field.value, `${label} ${field.key}`),
        });
        fieldKeys.push(field.key);
        index += 1;
      }
      if (!isDeepStrictEqual(fieldKeys, ["specifier", "version"])) {
        failCurrentLockfile(`must pin each ${label} specifier and version exactly once`);
      }
      packages.push({
        name: dependency.key,
        specifier: fields.specifier,
        version: fields.version,
      });
    }
    groups.push({ name: group.key, packages });
  }
  if (!isDeepStrictEqual(groups, expected.groups)) {
    failCurrentLockfile(`changed the exact reviewed ${label} importer`);
  }
}

function inspectExactControlPlaneImporter(lines, start, end) {
  inspectExactReviewedImporter(
    lines,
    start,
    end,
    M07_T06_CONTROL_PLANE_COORDINATION.lockfileImporter,
    "M07-T06 control-plane",
  );
}

function inspectExactReferenceHostServerImporter(lines, start, end) {
  inspectExactReviewedImporter(
    lines,
    start,
    end,
    M07_T11_REFERENCE_HOST_COORDINATION.lockfileImporter,
    "M07-T11 reference-host server",
  );
}

function containsForbiddenYamlControl(text, allowLineFeed = true) {
  for (const character of text) {
    const codePoint = character.codePointAt(0);
    if (
      (codePoint >= 0x00 && codePoint <= 0x1f && (!allowLineFeed || codePoint !== 0x0a)) ||
      (codePoint >= 0x7f && codePoint <= 0x9f)
    ) {
      return true;
    }
  }
  return false;
}

function normalizeCurrentLockfileBytes(rawBytes) {
  const bytes = SAFE_BUFFER_FROM(rawBytes);
  const text = strictUtf8(bytes, "workspace lockfile");
  if (containsForbiddenYamlControl(text) || !text.endsWith("\n")) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT",
      "Current M05 workspace lockfile must retain canonical control-free LF framing.",
    );
  }
  const exactControlPlaneBlock = safeStringIndexOf(text, M07_T06_CONTROL_PLANE_LOCKFILE_BLOCK);
  const duplicateExactControlPlaneBlock =
    exactControlPlaneBlock < 0
      ? -1
      : safeStringIndexOf(
          text,
          M07_T06_CONTROL_PLANE_LOCKFILE_BLOCK,
          exactControlPlaneBlock + M07_T06_CONTROL_PLANE_LOCKFILE_BLOCK.length,
        );
  const controlPlaneHeader = "  apps/control-plane-api:";
  let headerCount = 0;
  let headerIndex = safeStringIndexOf(text, controlPlaneHeader);
  while (headerIndex >= 0) {
    headerCount += 1;
    headerIndex = safeStringIndexOf(
      text,
      controlPlaneHeader,
      headerIndex + controlPlaneHeader.length,
    );
  }
  if (exactControlPlaneBlock < 0 || duplicateExactControlPlaneBlock >= 0 || headerCount !== 1) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT",
      "Current M05 workspace lockfile changed the exact reviewed M07-T06 control-plane importer.",
    );
  }
  const lines = text.split("\n");
  validateCompletePnpmLockfileYaml(lines);
  const importersIndex = lines.indexOf("importers:");
  const packagesIndex = lines.findIndex(
    (line, index) => index > importersIndex && line === "packages:",
  );
  const importerRange = (relativePath, allowEmpty) => {
    const header = `  ${relativePath}:`;
    const matches = lines.flatMap((line, index) =>
      line === header || (allowEmpty && line === `${header} {}`) ? [index] : [],
    );
    if (
      matches.length !== 1 ||
      importersIndex < 0 ||
      packagesIndex < 0 ||
      matches[0] <= importersIndex ||
      matches[0] >= packagesIndex
    ) {
      fail(
        "REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT",
        `Current M05 workspace lockfile lost its unique ${relativePath} importer.`,
      );
    }
    const start = matches[0];
    let end = start + 1;
    while (end < lines.length && (lines[end].length === 0 || lines[end].startsWith("    "))) {
      end += 1;
    }
    return Object.freeze({ relativePath, start, end });
  };
  const publisher = importerRange("packages/publisher", true);
  const controlPlane = importerRange(
    M07_T06_CONTROL_PLANE_COORDINATION.lockfileImporter.path,
    false,
  );
  const referenceHostServer = importerRange(
    M07_T11_REFERENCE_HOST_COORDINATION.lockfileImporter.path,
    false,
  );
  validatePublisherImporterShape(lines, publisher.start, publisher.end);
  inspectExactControlPlaneImporter(lines, controlPlane.start, controlPlane.end);
  inspectExactReferenceHostServerImporter(
    lines,
    referenceHostServer.start,
    referenceHostServer.end,
  );
  const normalized = [...lines];
  for (const range of [publisher, controlPlane, referenceHostServer].sort(
    (left, right) => right.start - left.start,
  )) {
    if (range === referenceHostServer) {
      normalized.splice(range.start, range.end - range.start);
    } else {
      normalized.splice(range.start, range.end - range.start, `  ${range.relativePath}: {}`, "");
    }
  }
  return Buffer.from(normalized.join("\n"), "utf8");
}

function uniqueCurrentTrackedRecord(artifact, relativePath) {
  const trackedFiles = artifact?.evidence?.trackedFiles;
  validateCurrentTrackedFiles(trackedFiles);
  const matches = trackedFiles.filter(({ path: candidate }) => candidate === relativePath);
  if (matches.length !== 1) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT",
      `Current M05 evidence must contain one tracked record for ${relativePath}.`,
    );
  }
  return matches[0];
}

function assertCurrentRawRecord(record, bytes) {
  const actualSha256 = `sha256:${sha256(bytes)}`;
  if (record.bytes !== bytes.length || record.sha256 !== actualSha256) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT",
      `Current M05 tracked bytes do not match ${record.path}.`,
      {
        path: record.path,
        expectedBytes: record.bytes,
        actualBytes: bytes.length,
        expectedSha256: record.sha256,
        actualSha256,
      },
    );
  }
}

function assertHistoricalCoordinationProjection(
  record,
  normalizedBytes,
  approvedSuccessors = undefined,
) {
  const actualSha256 = `sha256:${sha256(normalizedBytes)}`;
  const historical = record.bytes === normalizedBytes.length && record.sha256 === actualSha256;
  const reviewed =
    approvedSuccessors === undefined
      ? []
      : Array.isArray(approvedSuccessors)
        ? approvedSuccessors
        : [approvedSuccessors];
  const reviewedSuccessor = reviewed.some(
    (approvedSuccessor) =>
      approvedSuccessor.bytes === normalizedBytes.length &&
      approvedSuccessor.sha256 === actualSha256,
  );
  if (!historical && !reviewedSuccessor) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_CURRENT_DRIFT",
      `Current M05 ${record.path} changed outside the reviewed successor projection.`,
      {
        path: record.path,
        expectedBytes: record.bytes,
        actualBytes: normalizedBytes.length,
        expectedSha256: record.sha256,
        actualSha256,
      },
    );
  }
}

/**
 * Preserves root toolchain and lockfile provenance while admitting reviewed successor coordination.
 */
export async function verifyReferenceHostWebCurrentCoordinationPolicy(rawOptions = undefined) {
  const options = captureOptions(
    rawOptions,
    [
      "historicalArtifact",
      "currentArtifact",
      "rootPackageBytes",
      "lockfileBytes",
      "controlPlanePackageBytes",
    ],
    "current coordination policy",
  );
  if (options.historicalArtifact === undefined || options.currentArtifact === undefined) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID",
      "Current M05 coordination policy requires historical and current audited artifacts.",
    );
  }
  const rootPackageBytes = optionalBytes(options.rootPackageBytes, "rootPackageBytes");
  const lockfileBytes = optionalBytes(options.lockfileBytes, "lockfileBytes");
  const controlPlanePackageBytes = optionalBytes(
    options.controlPlanePackageBytes,
    "controlPlanePackageBytes",
  );
  if (
    rootPackageBytes === undefined ||
    lockfileBytes === undefined ||
    controlPlanePackageBytes === undefined
  ) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID",
      "Current M05 coordination policy requires bounded root, lockfile, and control-plane package bytes.",
    );
  }
  const historicalArtifact = normalizeAuditedJsonDomain(options.historicalArtifact);
  const currentArtifact = normalizeAuditedJsonDomain(options.currentArtifact);
  const historicalRootRecord = uniqueCurrentTrackedRecord(historicalArtifact, "package.json");
  const historicalLockRecord = uniqueCurrentTrackedRecord(historicalArtifact, "pnpm-lock.yaml");
  const currentRootRecord = uniqueCurrentTrackedRecord(currentArtifact, "package.json");
  const currentLockRecord = uniqueCurrentTrackedRecord(currentArtifact, "pnpm-lock.yaml");
  assertCurrentRawRecord(currentRootRecord, rootPackageBytes);
  assertCurrentRawRecord(currentLockRecord, lockfileBytes);
  const normalizedRootPackage = await normalizeCurrentRootPackageBytes(rootPackageBytes);
  const normalizedLockfile = normalizeCurrentLockfileBytes(lockfileBytes);
  const controlPlanePackage =
    await inspectCurrentControlPlanePackageBytes(controlPlanePackageBytes);
  assertHistoricalCoordinationProjection(historicalRootRecord, normalizedRootPackage);
  assertHistoricalCoordinationProjection(
    historicalLockRecord,
    normalizedLockfile,
    APPROVED_M07_T06_DEPENDENCY_POLICY_SUCCESSOR.normalizedLockfile,
  );
  return Object.freeze({
    result: "PASS",
    rootPackageRawSha256: currentRootRecord.sha256,
    lockfileRawSha256: currentLockRecord.sha256,
    rootPackageHistoricalSha256: historicalRootRecord.sha256,
    lockfileHistoricalSha256: historicalLockRecord.sha256,
    normalizedPublisherScriptKeys: true,
    normalizedPublisherPipelineSegments: true,
    normalizedPublisherLockfileImporter: true,
    admittedControlPlaneCoordination: M07_T10_CONTROL_PLANE_COORDINATION.task,
    admittedReferenceHostCoordination: M07_T11_REFERENCE_HOST_COORDINATION.task,
    normalizedControlPlaneScriptKeys: true,
    normalizedControlPlanePipelineSegments: true,
    normalizedControlPlaneLockfileImporter: true,
    controlPlanePackage,
    normalizedControlPlanePackageTestScript: true,
    normalizedControlPlaneValidatorImporter: true,
  });
}

/**
 * Runs the full current semantic/Vite/build/boundary audit and compares all enduring M05 evidence.
 */
export async function verifyCurrentReferenceHostWebSourceAuditEvidence(rawOptions = undefined) {
  const options = captureOptions(
    rawOptions,
    ["workspaceRoot", "artifactPath", "artifactBytes"],
    "current audit verify",
  );
  const workspaceRoot = optionalString(options.workspaceRoot, "workspaceRoot");
  const artifactPath = optionalString(options.artifactPath, "artifactPath");
  const artifactBytes = optionalBytes(options.artifactBytes, "artifactBytes");
  if (artifactPath !== undefined && artifactBytes !== undefined) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID",
      "Current M05 host verification accepts either artifactPath or artifactBytes, not both.",
    );
  }
  const historical = await buildReferenceHostWebSourceAuditEvidence({
    ...(artifactPath === undefined ? {} : { artifactPath }),
    ...(artifactBytes === undefined ? {} : { artifactBytes }),
  });
  const resolvedWorkspaceRoot = await resolveWorkspaceRoot(workspaceRoot);
  const current = await buildCurrentReferenceHostWebSourceAuditEvidence({
    workspaceRoot: resolvedWorkspaceRoot,
  });
  const successorSourceBytes = await Promise.all(
    M06_T05_VALIDATOR_SUCCESSOR.sourceFiles.map(({ path: relativePath }) =>
      readRegularFile(resolvedWorkspaceRoot, relativePath),
    ),
  );
  const policy = verifyReferenceHostWebCurrentEvidencePolicy(
    historical.artifact,
    current.artifact,
    successorSourceBytes,
  );
  const [rootPackageBytes, lockfileBytes, controlPlanePackageBytes] = await Promise.all([
    readRegularFile(resolvedWorkspaceRoot, "package.json"),
    readRegularFile(resolvedWorkspaceRoot, "pnpm-lock.yaml"),
    readRegularFile(resolvedWorkspaceRoot, CONTROL_PLANE_PACKAGE_RELATIVE_PATH),
  ]);
  const coordination = await verifyReferenceHostWebCurrentCoordinationPolicy({
    historicalArtifact: historical.artifact,
    currentArtifact: current.artifact,
    rootPackageBytes,
    lockfileBytes,
    controlPlanePackageBytes,
  });
  return Object.freeze({
    result: "PASS",
    historicalArtifactSha256: historical.artifactSha256,
    currentObservationSha256: current.artifactSha256,
    trackedFiles: current.artifact.evidence.trackedFiles.length,
    comparedTrackedFiles: policy.comparedTrackedFiles,
    excludedCoordinationPaths: policy.excludedCoordinationPaths,
    admittedSuccessor: policy.admittedSuccessor,
    successorSources: policy.successorSources,
    coordination,
    sourceFiles: current.artifact.sourceAudit.sourceFiles,
    sourceAssertions: current.artifact.sourceAudit.assertions,
    jsxElements: current.artifact.sourceAudit.jsxElements,
    graphModules: current.artifact.runtimeResolution.moduleCount,
    graphStaticEdges: current.artifact.runtimeResolution.staticEdges,
    graphDynamicEdges: current.artifact.runtimeResolution.dynamicEdges,
    graphSha256: current.artifact.runtimeResolution.graphSha256,
    packageBoundaryViolations: current.artifact.packageBoundary.violations,
  });
}

function uniqueSection(text, startPredicate, nextSectionPredicate, label) {
  const lines = text.split(/\r?\n/u);
  const starts = lines.flatMap((line, index) => (startPredicate(line) ? [index] : []));
  if (starts.length !== 1) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_DOCUMENTATION_DRIFT",
      `M05-T09 ${label} section is missing or ambiguous.`,
    );
  }
  const start = starts[0];
  const end = lines.findIndex((line, index) => index > start && nextSectionPredicate(line));
  return lines.slice(start, end === -1 ? lines.length : end).join("\n");
}

function uniqueTableRow(text, claimId) {
  const prefix = `| ${claimId} |`;
  const rows = text.split(/\r?\n/u).filter((line) => line.startsWith(prefix));
  if (rows.length !== 1) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_DOCUMENTATION_DRIFT",
      `M05-T09 Proof Matrix ${claimId} row is missing or ambiguous.`,
    );
  }
  return rows[0];
}

function verifyUniquePin(section, pathReference, shaReference, associationReference, label) {
  const pathCount = section.split(pathReference).length - 1;
  const shaCount = section.split(shaReference).length - 1;
  const associationCount = section.split(associationReference).length - 1;
  if (pathCount !== 1 || shaCount !== 1 || associationCount !== 1) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_DOCUMENTATION_DRIFT",
      `M05-T09 ${label} lost its unique contextual artifact and SHA pin.`,
      { pathCount, shaCount, associationCount },
    );
  }
}

function validateDocumentationDigest(artifactSha256, allowPending) {
  if (
    typeof artifactSha256 !== "string" ||
    (!/^[0-9a-f]{64}$/u.test(artifactSha256) &&
      !(allowPending && artifactSha256 === PENDING_SHA256))
  ) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID",
      "M05-T09 documentation verification requires one lowercase SHA-256 or the generation sentinel.",
    );
  }
}

function verifyProofDocument(text, artifactSha256) {
  verifyUniquePin(
    uniqueSection(
      text,
      (line) => line === "## Evidence artifact",
      (line) => line.startsWith("## "),
      "proof-document Evidence artifact",
    ),
    `\`${ARTIFACT_RELATIVE_PATH}\``,
    `\`sha256:${artifactSha256}\``,
    `- path: \`${ARTIFACT_RELATIVE_PATH}\`\n- SHA-256: \`sha256:${artifactSha256}\``,
    "proof document",
  );
}

function verifyDocumentation(proofText, matrixText, projectStatusText, artifactSha256) {
  verifyProofDocument(proofText, artifactSha256);
  const artifactReference = `\`${path.basename(ARTIFACT_RELATIVE_PATH)}\``;
  const shaReference = `\`sha256:${artifactSha256}\``;
  for (const claimId of ["P-06", "P-07", "P-10"]) {
    verifyUniquePin(
      uniqueTableRow(matrixText, claimId),
      artifactReference,
      shaReference,
      `${artifactReference} ${shaReference}`,
      `Proof Matrix ${claimId} row`,
    );
  }
  verifyUniquePin(
    uniqueSection(
      matrixText,
      (line) => line === "## M05-T09",
      (line) => line.startsWith("## "),
      "Proof Matrix M05-T09",
    ),
    artifactReference,
    shaReference,
    `${artifactReference}\n${shaReference}`,
    "Proof Matrix M05-T09",
  );
  verifyUniquePin(
    uniqueSection(
      projectStatusText,
      (line) => line === "M05-T09 evidence:",
      (line) => /^M\d{2}-T\d{2} evidence:$/u.test(line) || line.startsWith("## "),
      "Project Status M05-T09",
    ),
    `\`${ARTIFACT_RELATIVE_PATH}\``,
    `\`${artifactSha256}\``,
    `- \`${ARTIFACT_RELATIVE_PATH}\`\n- artifact SHA-256:\n  \`${artifactSha256}\``,
    "Project Status M05-T09",
  );
}

/** Verifies the proof document with either a final digest or the exact generation sentinel. */
export function verifyReferenceHostWebSourceAuditProofDocument(
  text,
  artifactSha256,
  rawOptions = undefined,
) {
  const options = captureOptions(rawOptions, ["allowPending"], "proof-document");
  const allowPending = options.allowPending === true;
  if (options.allowPending !== undefined && typeof options.allowPending !== "boolean") {
    fail("REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID", "M05-T09 allowPending must be a boolean.");
  }
  optionalText(text, "proofDocumentText");
  if (typeof text !== "string") {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID",
      "M05-T09 proofDocumentText must be bounded text.",
    );
  }
  validateDocumentationDigest(artifactSha256, allowPending);
  verifyProofDocument(text, artifactSha256);
  return Object.freeze({ result: "PASS", exactReferences: 2 });
}

/** Verifies twelve contextual M05-T09 references across the three status documents. */
export function verifyReferenceHostWebSourceAuditDocumentation(
  proofText,
  matrixText,
  projectStatusText,
  artifactSha256,
) {
  for (const [text, label] of [
    [proofText, "proofDocumentText"],
    [matrixText, "proofMatrixText"],
    [projectStatusText, "projectStatusText"],
  ]) {
    optionalText(text, label);
    if (typeof text !== "string") {
      fail("REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID", `M05-T09 ${label} must be bounded text.`);
    }
  }
  validateDocumentationDigest(artifactSha256, false);
  verifyDocumentation(proofText, matrixText, projectStatusText, artifactSha256);
  return Object.freeze({ result: "PASS", exactReferences: 12 });
}

function scopedWorkspacePath(workspaceRoot, candidate, relativeDefault, label) {
  const resolved =
    candidate === undefined
      ? path.join(workspaceRoot, ...relativeDefault.split("/"))
      : path.isAbsolute(candidate)
        ? path.resolve(candidate)
        : path.resolve(workspaceRoot, candidate);
  const relative = path.relative(workspaceRoot, resolved);
  if (
    relative.length === 0 ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID",
      `M05-T09 ${label} must remain inside the resolved workspace root.`,
    );
  }
  return resolved;
}

function resolveWorkspaceEvidencePaths(workspaceRoot, candidates = {}) {
  return Object.freeze({
    workspaceRoot,
    artifactPath: scopedWorkspacePath(
      workspaceRoot,
      candidates.artifactPath,
      ARTIFACT_RELATIVE_PATH,
      "artifactPath",
    ),
    proofPath: scopedWorkspacePath(
      workspaceRoot,
      candidates.proofPath,
      PROOF_DOCUMENT_RELATIVE_PATH,
      "proofPath",
    ),
    proofMatrixPath: scopedWorkspacePath(
      workspaceRoot,
      candidates.proofMatrixPath,
      PROOF_MATRIX_RELATIVE_PATH,
      "proofMatrixPath",
    ),
    projectStatusPath: scopedWorkspacePath(
      workspaceRoot,
      candidates.projectStatusPath,
      PROJECT_STATUS_RELATIVE_PATH,
      "projectStatusPath",
    ),
  });
}

/** Resolves every default or explicit evidence path under one canonical workspace authority. */
export async function resolveReferenceHostWebSourceAuditWorkspacePaths(rawOptions = undefined) {
  const options = captureOptions(
    rawOptions,
    ["workspaceRoot", "artifactPath", "proofPath", "proofMatrixPath", "projectStatusPath"],
    "workspace evidence paths",
  );
  const workspaceRoot = await resolveWorkspaceRoot(
    optionalString(options.workspaceRoot, "workspaceRoot"),
  );
  const candidates = {};
  for (const key of ["artifactPath", "proofPath", "proofMatrixPath", "projectStatusPath"]) {
    const value = optionalString(options[key], key);
    if (value !== undefined) candidates[key] = value;
  }
  return resolveWorkspaceEvidencePaths(workspaceRoot, candidates);
}

async function assertSafeScopedArtifactOutput(workspaceRoot, artifactPath) {
  const parent = path.dirname(artifactPath);
  const canonicalParent = await realpath(parent).catch(() => undefined);
  if (
    canonicalParent !== parent ||
    !parent.startsWith(`${workspaceRoot}${path.sep}`) ||
    !(await lstat(parent).catch(() => undefined))?.isDirectory()
  ) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_ARTIFACT_UNSAFE",
      "M05-T09 artifact output parent must be a canonical in-workspace directory.",
    );
  }
  const target = await lstat(artifactPath).catch((error) =>
    error?.code === "ENOENT" ? undefined : null,
  );
  if (target === null || (target !== undefined && (!target.isFile() || target.isSymbolicLink()))) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_ARTIFACT_UNSAFE",
      "M05-T09 artifact output target is not a safe regular file destination.",
    );
  }
}

function sameDeviceAndInode(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

async function inspectWorkspaceScopedAtomicParent(
  workspaceRoot,
  lexicalParent,
  expectedIdentity = undefined,
) {
  if (
    path.resolve(lexicalParent) !== lexicalParent ||
    !lexicalParent.startsWith(`${workspaceRoot}${path.sep}`)
  ) {
    throw new TypeError("M05-T09 atomic parent escapes the resolved workspace.");
  }
  const before = await lstat(lexicalParent, { bigint: true });
  if (!before.isDirectory() || before.isSymbolicLink()) {
    throw new TypeError("M05-T09 atomic parent is not a real directory.");
  }
  const canonical = await realpath(lexicalParent);
  const after = await lstat(lexicalParent, { bigint: true });
  if (
    canonical !== lexicalParent ||
    !after.isDirectory() ||
    after.isSymbolicLink() ||
    !sameDeviceAndInode(before, after) ||
    (expectedIdentity !== undefined && !sameDeviceAndInode(expectedIdentity, after))
  ) {
    throw new TypeError("M05-T09 atomic parent identity or canonical path changed.");
  }
  return after;
}

async function inspectOptionalAtomicDestination(artifactPath) {
  const entry = await lstat(artifactPath, { bigint: true }).catch((error) => {
    if (error?.code === "ENOENT") return undefined;
    throw error;
  });
  if (entry !== undefined && (!entry.isFile() || entry.isSymbolicLink())) {
    throw new TypeError("M05-T09 atomic destination must be absent or a regular non-symlink file.");
  }
  return entry;
}

async function readExactOpenHandleBytes(handle, expectedLength) {
  const bytes = Buffer.alloc(expectedLength);
  let offset = 0;
  while (offset < expectedLength) {
    const { bytesRead } = await handle.read(bytes, offset, expectedLength - offset, offset);
    if (bytesRead === 0) break;
    offset += bytesRead;
  }
  const trailing = Buffer.alloc(1);
  const { bytesRead: trailingBytes } = await handle.read(trailing, 0, 1, expectedLength);
  if (offset !== expectedLength || trailingBytes !== 0) {
    throw new TypeError("M05-T09 open temporary byte length changed.");
  }
  return bytes;
}

async function removeTrustedAtomicTemporary({
  workspaceRoot,
  lexicalParent,
  parentIdentity,
  temporaryPath,
  temporaryIdentity,
}) {
  try {
    await inspectWorkspaceScopedAtomicParent(workspaceRoot, lexicalParent, parentIdentity);
  } catch {
    // Never unlink through a replaced, symlinked, or identity-lost lexical parent.
    return;
  }
  const entry = await lstat(temporaryPath, { bigint: true }).catch((error) => {
    if (error?.code === "ENOENT") return undefined;
    return null;
  });
  if (
    entry === undefined ||
    entry === null ||
    !entry.isFile() ||
    entry.isSymbolicLink() ||
    !sameDeviceAndInode(entry, temporaryIdentity)
  ) {
    return;
  }
  await unlink(temporaryPath).catch(() => undefined);
}

async function writeWorkspaceScopedAtomicArtifact({
  workspaceRoot,
  artifactPath,
  artifactBytes,
  beforeAtomicRename,
}) {
  if (
    path.resolve(workspaceRoot) !== workspaceRoot ||
    path.resolve(artifactPath) !== artifactPath
  ) {
    throw new TypeError(
      "M05-T09 atomic writer requires exact resolved workspace and artifact paths.",
    );
  }
  const lexicalParent = path.dirname(artifactPath);
  const parentIdentity = await inspectWorkspaceScopedAtomicParent(workspaceRoot, lexicalParent);
  await inspectOptionalAtomicDestination(artifactPath);
  const temporaryPath = path.join(
    lexicalParent,
    `.${path.basename(artifactPath)}.${randomBytes(12).toString("hex")}.tmp`,
  );
  const expectedBytes = Buffer.from(artifactBytes);
  const handle = await open(
    temporaryPath,
    constants.O_CREAT | constants.O_EXCL | constants.O_RDWR | (constants.O_NOFOLLOW ?? 0),
    0o600,
  );
  let handleOpen = true;
  let temporaryIdentity;
  try {
    temporaryIdentity = await handle.stat({ bigint: true });
    if (!temporaryIdentity.isFile()) {
      throw new TypeError("M05-T09 atomic temporary is not a regular file.");
    }
    await handle.writeFile(expectedBytes);
    await handle.sync();
    if (beforeAtomicRename !== undefined) {
      await beforeAtomicRename(
        Object.freeze({
          artifactPath,
          temporaryPath,
          workspaceRoot,
        }),
      );
    }

    await inspectWorkspaceScopedAtomicParent(workspaceRoot, lexicalParent, parentIdentity);
    const [handleEntry, pathEntry, temporaryBytes] = await Promise.all([
      handle.stat({ bigint: true }),
      lstat(temporaryPath, { bigint: true }),
      readExactOpenHandleBytes(handle, expectedBytes.length),
    ]);
    if (
      !handleEntry.isFile() ||
      !pathEntry.isFile() ||
      pathEntry.isSymbolicLink() ||
      !sameDeviceAndInode(temporaryIdentity, handleEntry) ||
      !sameDeviceAndInode(handleEntry, pathEntry) ||
      handleEntry.size !== BigInt(expectedBytes.length) ||
      !temporaryBytes.equals(expectedBytes)
    ) {
      throw new TypeError("M05-T09 atomic temporary identity or bytes changed before rename.");
    }
    await inspectWorkspaceScopedAtomicParent(workspaceRoot, lexicalParent, parentIdentity);
    await inspectOptionalAtomicDestination(artifactPath);
    await inspectWorkspaceScopedAtomicParent(workspaceRoot, lexicalParent, parentIdentity);
    await handle.close();
    handleOpen = false;
    await rename(temporaryPath, artifactPath);

    await inspectWorkspaceScopedAtomicParent(workspaceRoot, lexicalParent, parentIdentity);
    const committedEntry = await lstat(artifactPath, { bigint: true });
    const committedCanonical = await realpath(artifactPath);
    if (
      !committedEntry.isFile() ||
      committedEntry.isSymbolicLink() ||
      !sameDeviceAndInode(temporaryIdentity, committedEntry) ||
      committedCanonical !== artifactPath
    ) {
      throw new TypeError("M05-T09 committed artifact identity or canonical path changed.");
    }
    const committedBytes = await readAbsoluteRegularFile(
      artifactPath,
      "REFERENCE_HOST_SOURCE_AUDIT_ARTIFACT_MISSING",
      "REFERENCE_HOST_SOURCE_AUDIT_ARTIFACT_UNSAFE",
      MAX_ARTIFACT_BYTES,
    );
    await inspectWorkspaceScopedAtomicParent(workspaceRoot, lexicalParent, parentIdentity);
    if (!committedBytes.equals(expectedBytes)) {
      throw new TypeError("M05-T09 committed artifact bytes differ from input.");
    }
    return Object.freeze({ artifactPath: committedCanonical });
  } catch (error) {
    if (handleOpen) {
      try {
        await handle.close();
      } catch {
        // Preserve the controlled primary writer error.
      }
    }
    if (temporaryIdentity !== undefined) {
      await removeTrustedAtomicTemporary({
        workspaceRoot,
        lexicalParent,
        parentIdentity,
        temporaryPath,
        temporaryIdentity,
      });
    }
    throw error;
  }
}

function historicalEvidenceSummary(built, exactDocumentationReferences = undefined) {
  const summary = {
    result: built.artifact.result,
    artifactSha256: built.artifactSha256,
    artifactBytes: built.artifactBytes.length,
    trackedFiles: built.artifact.evidence.trackedFiles.length,
    sourceFiles: built.artifact.sourceAudit.sourceFiles,
    sourceAssertions: built.artifact.sourceAudit.assertions,
    jsxElements: built.artifact.sourceAudit.jsxElements,
    graphModules: built.artifact.runtimeResolution.moduleCount,
    graphStaticEdges: built.artifact.runtimeResolution.staticEdges,
    graphDynamicEdges: built.artifact.runtimeResolution.dynamicEdges,
    graphSha256: built.artifact.runtimeResolution.graphSha256,
    packageBoundaryViolations: built.artifact.packageBoundary.violations,
    compatibilityMode: "immutable-task-time-artifact",
  };
  if (exactDocumentationReferences !== undefined) {
    summary.exactDocumentationReferences = exactDocumentationReferences;
  }
  return Object.freeze(summary);
}

function resolveCompatibilityDocumentPath(candidate, defaultPath) {
  if (candidate === undefined) return defaultPath;
  return path.isAbsolute(candidate)
    ? path.resolve(candidate)
    : path.resolve(WORKSPACE_ROOT, candidate);
}

/** Verifies exact immutable M05-T09/G05 bytes, semantics, inventory, and documentation pins. */
export async function verifyReferenceHostWebSourceAuditEvidence(rawOptions = undefined) {
  const options = captureOptions(
    rawOptions,
    [
      "artifactPath",
      "artifactBytes",
      "proofPath",
      "proofDocumentText",
      "proofMatrixPath",
      "proofMatrixText",
      "projectStatusPath",
      "projectStatusText",
    ],
    "historical verify",
  );
  const artifactPath = optionalString(options.artifactPath, "artifactPath");
  const injectedArtifactBytes = optionalBytes(options.artifactBytes, "artifactBytes");
  const proofPath = optionalString(options.proofPath, "proofPath");
  const proofDocumentText = optionalText(options.proofDocumentText, "proofDocumentText");
  const proofMatrixPath = optionalString(options.proofMatrixPath, "proofMatrixPath");
  const proofMatrixText = optionalText(options.proofMatrixText, "proofMatrixText");
  const projectStatusPath = optionalString(options.projectStatusPath, "projectStatusPath");
  const projectStatusText = optionalText(options.projectStatusText, "projectStatusText");
  if (artifactPath !== undefined && injectedArtifactBytes !== undefined) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID",
      "M05-T09 verification accepts either artifactPath or artifactBytes, not both.",
    );
  }
  for (const [pathValue, textValue, label] of [
    [proofPath, proofDocumentText, "proof"],
    [proofMatrixPath, proofMatrixText, "Proof Matrix"],
    [projectStatusPath, projectStatusText, "Project Status"],
  ]) {
    if (pathValue !== undefined && textValue !== undefined) {
      fail(
        "REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID",
        `M05-T09 verification accepts either ${label} path or injected text, not both.`,
      );
    }
  }
  const built = await buildReferenceHostWebSourceAuditEvidence({
    ...(artifactPath === undefined ? {} : { artifactPath }),
    ...(injectedArtifactBytes === undefined ? {} : { artifactBytes: injectedArtifactBytes }),
  });
  const [proofText, matrixText, statusText] = await Promise.all([
    proofDocumentText ??
      readAbsoluteRegularFile(
        resolveCompatibilityDocumentPath(
          proofPath,
          DEFAULT_REFERENCE_HOST_WEB_SOURCE_AUDIT_PROOF_PATH,
        ),
        "REFERENCE_HOST_SOURCE_AUDIT_DOCUMENTATION_MISSING",
        "REFERENCE_HOST_SOURCE_AUDIT_DOCUMENTATION_UNSAFE",
        MAX_DOCUMENT_BYTES,
      ).then((bytes) => bytes.toString("utf8")),
    proofMatrixText ??
      readAbsoluteRegularFile(
        resolveCompatibilityDocumentPath(
          proofMatrixPath,
          DEFAULT_REFERENCE_HOST_WEB_SOURCE_AUDIT_PROOF_MATRIX_PATH,
        ),
        "REFERENCE_HOST_SOURCE_AUDIT_DOCUMENTATION_MISSING",
        "REFERENCE_HOST_SOURCE_AUDIT_DOCUMENTATION_UNSAFE",
        MAX_DOCUMENT_BYTES,
      ).then((bytes) => bytes.toString("utf8")),
    projectStatusText ??
      readAbsoluteRegularFile(
        resolveCompatibilityDocumentPath(
          projectStatusPath,
          DEFAULT_REFERENCE_HOST_WEB_SOURCE_AUDIT_PROJECT_STATUS_PATH,
        ),
        "REFERENCE_HOST_SOURCE_AUDIT_DOCUMENTATION_MISSING",
        "REFERENCE_HOST_SOURCE_AUDIT_DOCUMENTATION_UNSAFE",
        MAX_DOCUMENT_BYTES,
      ).then((bytes) => bytes.toString("utf8")),
  ]).catch((error) => {
    if (error instanceof ReferenceHostWebSourceAuditEvidenceError) throw error;
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_DOCUMENTATION_MISSING",
      "M05-T09 documentation could not be read.",
    );
  });
  verifyDocumentation(proofText, matrixText, statusText, HISTORICAL_ARTIFACT_SHA256);
  return historicalEvidenceSummary(built, 12);
}

/**
 * Preserves the default immutable receipt or atomically copies its exact authenticated bytes.
 *
 * @remarks The committed task-time artifact is never regenerated from successor source.
 */
export async function writeReferenceHostWebSourceAuditEvidence(rawOptions = undefined) {
  const options = captureOptions(
    rawOptions,
    ["sourceArtifactPath", "artifactBytes", "artifactPath", "beforeAtomicRename"],
    "historical write",
  );
  const sourceArtifactPath = optionalString(options.sourceArtifactPath, "sourceArtifactPath");
  const injectedArtifactBytes = optionalBytes(options.artifactBytes, "artifactBytes");
  const requestedArtifactPath = optionalString(options.artifactPath, "artifactPath");
  const beforeAtomicRename = optionalCallback(options.beforeAtomicRename, "beforeAtomicRename");
  if (sourceArtifactPath !== undefined && injectedArtifactBytes !== undefined) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_OPTIONS_INVALID",
      "Historical M05-T09 write accepts either sourceArtifactPath or artifactBytes, not both.",
    );
  }
  const built = await buildReferenceHostWebSourceAuditEvidence({
    ...(sourceArtifactPath === undefined ? {} : { artifactPath: sourceArtifactPath }),
    ...(injectedArtifactBytes === undefined ? {} : { artifactBytes: injectedArtifactBytes }),
  });
  const artifactPath =
    requestedArtifactPath === undefined
      ? DEFAULT_REFERENCE_HOST_WEB_SOURCE_AUDIT_ARTIFACT_PATH
      : scopedWorkspacePath(
          WORKSPACE_ROOT,
          requestedArtifactPath,
          ARTIFACT_RELATIVE_PATH,
          "artifactPath",
        );
  if (artifactPath === DEFAULT_REFERENCE_HOST_WEB_SOURCE_AUDIT_ARTIFACT_PATH) {
    await buildReferenceHostWebSourceAuditEvidence();
    return Object.freeze({
      ...historicalEvidenceSummary(built),
      artifactPath,
      preserved: true,
    });
  }
  await assertSafeScopedArtifactOutput(WORKSPACE_ROOT, artifactPath);
  let committed;
  try {
    committed = await writeWorkspaceScopedAtomicArtifact({
      workspaceRoot: WORKSPACE_ROOT,
      artifactPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename,
    });
  } catch (error) {
    fail(
      "REFERENCE_HOST_SOURCE_AUDIT_ARTIFACT_UNSAFE",
      "Atomic M05-T09 artifact write failed safely.",
      { cause: String(error) },
    );
  }
  return Object.freeze({
    ...historicalEvidenceSummary(built),
    artifactPath: committed.artifactPath,
    preserved: false,
  });
}
