import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import {
  lstat,
  mkdtemp,
  open,
  readFile,
  readdir,
  realpath,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { format } from "prettier";
import ts from "typescript";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";
import { verifyProofReaderCheckpoints } from "../ci/proof-reader-checkpoints.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ARTIFACT = "docs/proof/artifacts/control-plane-api-0.1.0-bundle-store.json";
const PROOF_DOCUMENT = "docs/proof/CONTROL-PLANE-BUNDLE-STORE.md";
const TRACEABILITY = "docs/proof/protocol-0.1.0-traceability.json";
const SOURCE_FIXTURE =
  "packages/protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json";
const CATALOG_FIXTURE =
  "packages/protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json";
const APP_DIRECTORY = "apps/control-plane-api";
const APP_PACKAGE = `${APP_DIRECTORY}/package.json`;
const APP_INDEX = `${APP_DIRECTORY}/src/index.ts`;
const APP_RUNTIME_TEST = `${APP_DIRECTORY}/test/bundle-store.test.ts`;
const APP_TYPE_TEST = `${APP_DIRECTORY}/test/bundle-store.types.ts`;
const ROOT_PACKAGE = "package.json";
const CI_SOURCE = "scripts/run-ci-quality-gate.mjs";
const GENERATOR = "scripts/generate-control-plane-bundle-store-proof.mjs";
const VERIFIER = "scripts/verify-control-plane-bundle-store.mjs";
const PROOF_LIBRARY = "scripts/lib/control-plane-bundle-store-proof.mjs";
const ATOMIC_WRITER = "scripts/lib/atomic-proof-artifact.mjs";
const ROOT_TEST = "tests/control-plane-bundle-store.test.mjs";
const HISTORICAL_COMPATIBILITY_READERS = Object.freeze([
  "scripts/lib/reference-host-web-source-audit-proof.mjs",
  "tests/reference-host-web-source-audit.test.mjs",
  "scripts/lib/publisher-publish-result-proof.mjs",
  "tests/publisher-publish-result.test.mjs",
  "scripts/lib/publisher-execution-preflight-proof.mjs",
  "tests/publisher-execution-preflight.test.mjs",
  "scripts/lib/publisher-catalog-pinning-proof.mjs",
  "tests/publisher-catalog-pinning.test.mjs",
  "scripts/lib/publisher-bundle-publication-proof.mjs",
  "tests/publisher-bundle-publication.test.mjs",
  "scripts/lib/publisher-invalid-source-matrix-proof.mjs",
  "tests/publisher-invalid-source-matrix.test.mjs",
]);
const HISTORICAL_TRACKED_RECEIPTS = Object.freeze({
  [APP_PACKAGE]: Object.freeze({
    bytes: 861,
    sha256: "470ad074376d5c6835d977cccccb364d5387c2749d63060fdb10045000304c6f",
  }),
  [APP_INDEX]: Object.freeze({
    bytes: 413,
    sha256: "37f02d98716ecb6ff84c57c0c388959a43f4ae499eddc5bcbd9b34b85c59cdee",
  }),
  [PROOF_LIBRARY]: Object.freeze({
    bytes: 73_090,
    sha256: "761dc922a9609510e154c87ad535f7af69b8b4822ef8b01c92109f99c37551a0",
  }),
  [ROOT_TEST]: Object.freeze({
    bytes: 25_988,
    sha256: "b6898c681aa03735d4ff92ad1f9c54106cbe39d15140b288ba96142f253a3190",
  }),
  "scripts/lib/reference-host-web-source-audit-proof.mjs": Object.freeze({
    bytes: 242_844,
    sha256: "ebe063da6cc2eed7138e5d052ec096c75bed43e83ef7c7d3b48a6064432ba046",
  }),
  "tests/reference-host-web-source-audit.test.mjs": Object.freeze({
    bytes: 80_313,
    sha256: "95cc3667f9e512476eb71152f69c10391447f8bcbfe17c6f3c2eb77dda7ac2e2",
  }),
  "scripts/lib/publisher-publish-result-proof.mjs": Object.freeze({
    bytes: 57_168,
    sha256: "932d16f093247b5cbfadc5ccbe0e60c7cf6b5ddcf55fa8c0b28d1aedc2a8d6a8",
  }),
  "tests/publisher-publish-result.test.mjs": Object.freeze({
    bytes: 18_129,
    sha256: "87f8c5cf1977c1c3b12c05626c5c7c60a65907a7afdaf7cdcb7aee590ec562b8",
  }),
  "scripts/lib/publisher-execution-preflight-proof.mjs": Object.freeze({
    bytes: 70_038,
    sha256: "29332971e7a9c0e45e66d145c073dbd1a3b1b7d29dfa021a03a917e6b539a69d",
  }),
  "tests/publisher-execution-preflight.test.mjs": Object.freeze({
    bytes: 17_284,
    sha256: "0dbe37fefa1fccd4efbba954aa8a7e29e15cdfa3a2e2cb9453aa3d423ff35b23",
  }),
  "scripts/lib/publisher-catalog-pinning-proof.mjs": Object.freeze({
    bytes: 102_413,
    sha256: "ea98c9c6b70230aa5cae60ef12c3194872449d73b7e7e48c833096a8f89e341f",
  }),
  "tests/publisher-catalog-pinning.test.mjs": Object.freeze({
    bytes: 38_486,
    sha256: "17c2ab84f2171857c32276e329f989a6e54178f7efab4cb74c9945c1ab5f09f9",
  }),
  "scripts/lib/publisher-bundle-publication-proof.mjs": Object.freeze({
    bytes: 133_811,
    sha256: "9eb7b300a1239e5be3324c24b39e0107d02cd14587b977310d162c4812a3e645",
  }),
  "tests/publisher-bundle-publication.test.mjs": Object.freeze({
    bytes: 62_216,
    sha256: "34190a6f9304ce85acbb5809d4b1422b621d7089300f89eb9d6863839d220060",
  }),
  "scripts/lib/publisher-invalid-source-matrix-proof.mjs": Object.freeze({
    bytes: 159_364,
    sha256: "f8cacd9c94899eaa80582c570aa8a2bee4a1beedabdc4f28679d7b33dc72827b",
  }),
  "tests/publisher-invalid-source-matrix.test.mjs": Object.freeze({
    bytes: 59_559,
    sha256: "178081b9b084c87ae1849b7464efa657900b46c166ab50638c5600168bc5c721",
  }),
});
const APPROVED_M07_T02_TRACKED_RECEIPTS = Object.freeze({
  [APP_PACKAGE]: Object.freeze({
    bytes: 1_285,
    sha256: "734609cdd94f1e93030f75a7009505a0da4988d31d955f7100aee256cb0c2a5b",
  }),
  [APP_INDEX]: Object.freeze({
    bytes: 896,
    sha256: "58fe0462d7d35a1231259b6386006f950600d401113f229debbe057f0120a4df",
  }),
});
const APPROVED_M07_T03_TRACKED_RECEIPTS = Object.freeze({
  [APP_PACKAGE]: Object.freeze({
    bytes: 1_744,
    sha256: "5a9c02445cac83f7ad11c56fbb075a24bd6f6e7d107a4cf22d8b670cdfa3e192",
  }),
  [APP_INDEX]: Object.freeze({
    bytes: 1_595,
    sha256: "42d5c844e108fddce5fb3190fee09e192bef4f12d79d61c4c96c2fae016150b3",
  }),
});
const APPROVED_M07_T04_TRACKED_RECEIPTS = Object.freeze({
  [APP_PACKAGE]: Object.freeze({
    bytes: 1_846,
    sha256: "5934807f1d66f001cf2173e3b1fa0a7b4e5f461df8822b16335cb8f53a83bf94",
  }),
  [APP_INDEX]: Object.freeze({
    bytes: 2_189,
    sha256: "b1081dafc56b43c422e23b8ab14251133bc78295a815d83c12a95122d024fce0",
  }),
});
const APPROVED_M07_T05_TRACKED_RECEIPTS = Object.freeze({
  [APP_PACKAGE]: Object.freeze({
    bytes: 1_972,
    sha256: "fba38ac87e42c58c5965f32433e2391b8a52a10ec2ab4a90bc18a263840398e1",
  }),
  [APP_INDEX]: Object.freeze({
    bytes: 3_343,
    sha256: "f33d36872ebb0b320569c38d29f4397e81d459db085d2d9d92111a2795510e24",
  }),
  "scripts/lib/reference-host-web-source-audit-proof.mjs": Object.freeze({
    bytes: 255_778,
    sha256: "63dda01b718dc75feb12e006cece2ada5c75f951f306c3265f3e1dcf745f164f",
  }),
  "tests/reference-host-web-source-audit.test.mjs": Object.freeze({
    bytes: 85_044,
    sha256: "4d07f2cd62be4f47fd2bad5090ef620e380abb9f822d20889896fb85e0066979",
  }),
  "scripts/lib/publisher-publish-result-proof.mjs": Object.freeze({
    bytes: 58_744,
    sha256: "b3d8e1b500f8e286838cf78b3563e7c2ff01f7328cad5903a3d82afd79401b62",
  }),
  "tests/publisher-publish-result.test.mjs": Object.freeze({
    bytes: 33_936,
    sha256: "77c696b6be56932b23ecbc91b278c822ea7a51a6c28f8b1515c0d71b65f43aac",
  }),
  "scripts/lib/publisher-execution-preflight-proof.mjs": Object.freeze({
    bytes: 71_098,
    sha256: "b01dc90fa150db2a7c00e26ab9fa8aae3e951c341583404e92e35157b7780791",
  }),
  "tests/publisher-execution-preflight.test.mjs": Object.freeze({
    bytes: 17_767,
    sha256: "9b9d9efbd7135668bdf7431925cac8e15e3b37bbf65dfd174de4fdd63e01adea",
  }),
  "scripts/lib/publisher-catalog-pinning-proof.mjs": Object.freeze({
    bytes: 102_413,
    sha256: "ea98c9c6b70230aa5cae60ef12c3194872449d73b7e7e48c833096a8f89e341f",
  }),
  "tests/publisher-catalog-pinning.test.mjs": Object.freeze({
    bytes: 38_530,
    sha256: "bb3038a8c5bb241c863daa6c7f41c1d8ab210da81fdbe52697f33a3c14909116",
  }),
  "scripts/lib/publisher-bundle-publication-proof.mjs": Object.freeze({
    bytes: 137_856,
    sha256: "fc078870e74e58d17ac3479c2d178143721b82e9c7846e0187805e11e6fa54f6",
  }),
  "tests/publisher-bundle-publication.test.mjs": Object.freeze({
    bytes: 63_859,
    sha256: "ae7b688d904b4c77632fd78e0ee23b2264eae1574b4350306b5e2ec1b9974b8d",
  }),
  "scripts/lib/publisher-invalid-source-matrix-proof.mjs": Object.freeze({
    bytes: 166_563,
    sha256: "06eb59602a768c13f19cc83289a574823d191aa3b62ed8fb7149381b326de802",
  }),
  "tests/publisher-invalid-source-matrix.test.mjs": Object.freeze({
    bytes: 60_572,
    sha256: "29b407c2f7f1b17d17bff450185a9304c3186caea4a98973df3f1e3e4f684531",
  }),
});
const APPROVED_M07_T06_TRACKED_RECEIPTS = Object.freeze({
  [APP_PACKAGE]: Object.freeze({
    bytes: 2_082,
    sha256: "342be659bad35bcec910a5c5cd97d4b1bde03c63e7d5873d0d8806084aa495d4",
  }),
  [APP_INDEX]: Object.freeze({
    bytes: 3_968,
    sha256: "113272b4dc95be0c625d30956bfe9cf696cc0dd8a29f8b6c7b40c62497575860",
  }),
  "scripts/lib/reference-host-web-source-audit-proof.mjs": Object.freeze({
    bytes: 257_943,
    sha256: "927201fd9e9067a1d03ca1b274724bb065ca97f47755348338a979e4c2f2f74a",
  }),
  "tests/reference-host-web-source-audit.test.mjs": Object.freeze({
    bytes: 86_740,
    sha256: "ec7aabd8e3446f58ca397e55f0b4580bee193e21e692c46fe89c3f4a60902ac9",
  }),
  "scripts/lib/publisher-publish-result-proof.mjs": Object.freeze({
    bytes: 59_053,
    sha256: "384566b518a86a801228ca8717c2250856b0017d22a78aa3b8ca187e717a9779",
  }),
  "tests/publisher-publish-result.test.mjs": Object.freeze({
    bytes: 39_871,
    sha256: "5584e4b58dffb6221439e8841cc9ee167a7d40e8d27636bad40da682f3dffa84",
  }),
  "scripts/lib/publisher-execution-preflight-proof.mjs": Object.freeze({
    bytes: 71_407,
    sha256: "bd3bfc693676bf5bf4dc5439173d25025042955293616eaf9136780575e4c6d5",
  }),
  "tests/publisher-execution-preflight.test.mjs": Object.freeze({
    bytes: 17_767,
    sha256: "9c2e5b0f71fce28d824b3591c60f83f58dbe78f8f94a1b555b34b07423f86cff",
  }),
  "tests/publisher-catalog-pinning.test.mjs": Object.freeze({
    bytes: 38_554,
    sha256: "3f2e94ca6135d3efa440ad851dccc08ebf28a78227c6b3fcd0aa92b6d0c00a39",
  }),
  "scripts/lib/publisher-bundle-publication-proof.mjs": Object.freeze({
    bytes: 138_164,
    sha256: "3e0492155d08b2d1140adfc5ba78df4b71fbf944717f1b853b5be41bd64fa7e0",
  }),
  "tests/publisher-bundle-publication.test.mjs": Object.freeze({
    bytes: 63_883,
    sha256: "a464849fe555ae4b76ca0644efce0bdbd07044c9468220dbae137a8ab347eeac",
  }),
  "scripts/lib/publisher-invalid-source-matrix-proof.mjs": Object.freeze({
    bytes: 167_031,
    sha256: "3f06521596f5effa5936e9e0c1c22fe1cf7c5f555457ef80c187ae62855cb54d",
  }),
  "tests/publisher-invalid-source-matrix.test.mjs": Object.freeze({
    bytes: 60_596,
    sha256: "bab6d5f50c6de37062741221afed63a72bd73e5c0bdd15f8536af2fea1c8d96f",
  }),
});
const APPROVED_M07_T07_TRACKED_RECEIPTS = Object.freeze({
  [APP_PACKAGE]: Object.freeze({
    bytes: 2_159,
    sha256: "2511a9dfaba16880d5591a68adb2dcbbd6d84a90298d38218f2434bb06416627",
  }),
  [APP_INDEX]: Object.freeze({
    bytes: 4_606,
    sha256: "e7ef3e595fc15b2374cca9d265c2891d1ccf304052f34ec3a706b67608f59d16",
  }),
  "scripts/lib/reference-host-web-source-audit-proof.mjs": Object.freeze({
    bytes: 261_145,
    sha256: "a9e58b3f4c6aa70421121b285e9c576bc0d71dfcaa1ff90a2c37667b9a86cabe",
  }),
  "tests/reference-host-web-source-audit.test.mjs": Object.freeze({
    bytes: 87_748,
    sha256: "62103dfff978ce2a40e5e46875e0b4087d8998d38efd8100da6e009684abd37f",
  }),
  "scripts/lib/publisher-publish-result-proof.mjs": Object.freeze({
    bytes: 59_362,
    sha256: "c6c8bce0f6c38b6508c68d16f1ddd2abc3b83328b3d4f4ba87255c3a4e9585fe",
  }),
  "tests/publisher-publish-result.test.mjs": Object.freeze({
    bytes: 42_492,
    sha256: "d1021ef5236e34b173e4e12031bbcc997ca09f18bfd7fd0cf8bd728652c72246",
  }),
  "scripts/lib/publisher-execution-preflight-proof.mjs": Object.freeze({
    bytes: 71_716,
    sha256: "e1bac338f8b7e27f2747789964b505abfbc1bac5267f397f43b0a90fd8806c28",
  }),
  "tests/publisher-execution-preflight.test.mjs": Object.freeze({
    bytes: 17_767,
    sha256: "adaca2ed4bb6c611af648c223a887893cd998aca4e173fd4feff0987ac469f51",
  }),
  "tests/publisher-catalog-pinning.test.mjs": Object.freeze({
    bytes: 38_566,
    sha256: "48612a4f09a5c9840e71a2e31b6d6349521a3830e28bd8bf6335d110243d7df4",
  }),
  "scripts/lib/publisher-bundle-publication-proof.mjs": Object.freeze({
    bytes: 138_472,
    sha256: "d63a8d2f98131d85cc5b0145e3a851ba182eecbc5ccbf47ed1769049e5e02bcf",
  }),
  "tests/publisher-bundle-publication.test.mjs": Object.freeze({
    bytes: 63_895,
    sha256: "b6f77feceb56f68cfced2556fed990468446d4fc9ab867a0680646f0b25123dc",
  }),
  "scripts/lib/publisher-invalid-source-matrix-proof.mjs": Object.freeze({
    bytes: 168_592,
    sha256: "72e3075cb4837b571791324b28a1fc5cdd723665933bf00079272be734a8cfab",
  }),
  "tests/publisher-invalid-source-matrix.test.mjs": Object.freeze({
    bytes: 62_249,
    sha256: "7b90ccea78c6f2d11607f9257a36445b94409aca62fcc8e8fe904cde61a08c0f",
  }),
});
const APPROVED_M07_T08_TRACKED_RECEIPTS = Object.freeze({
  [APP_PACKAGE]: Object.freeze({
    bytes: 2_232,
    sha256: "b228b200dafda1d319429376b9cc6456fadd4a3db865269ec8c2675eb0e60e8c",
  }),
  [APP_INDEX]: Object.freeze({
    bytes: 4_891,
    sha256: "1295547b6c281ea2678583298648a4ad8287205109d670fa422450146da5031e",
  }),
  "scripts/lib/reference-host-web-source-audit-proof.mjs": Object.freeze({
    bytes: 263_857,
    sha256: "bb8f2dde9a4f63a848003cf7be7b69c1c9681992d56c9a254653dee8cbd7bbe3",
  }),
  "tests/reference-host-web-source-audit.test.mjs": Object.freeze({
    bytes: 89_057,
    sha256: "9442048b8b96f6aec06136b489dc08e01f159c46609eeb225aa2f949c98e3521",
  }),
  "scripts/lib/publisher-publish-result-proof.mjs": Object.freeze({
    bytes: 59_671,
    sha256: "f50e209675cfcd41547bf2b25aeb29e5033384bb7011c3be6b1f3ad74e7ad8f1",
  }),
  "tests/publisher-publish-result.test.mjs": Object.freeze({
    bytes: 45_051,
    sha256: "0ee1761fd1990622cffb7ee225e14c66dc7dfde4e1a221263f0739b7839cf8ec",
  }),
  "scripts/lib/publisher-execution-preflight-proof.mjs": Object.freeze({
    bytes: 72_025,
    sha256: "b4d55e0da2a2992bcc311254bfc47c2c69287f9e049ed8e84bb9b50c8886d2a4",
  }),
  "tests/publisher-execution-preflight.test.mjs": Object.freeze({
    bytes: 17_767,
    sha256: "8ab35ee609d175377ccb2beb679f6d76f93c9c2cf4bc749df0d94a7ff7e47e74",
  }),
  "tests/publisher-catalog-pinning.test.mjs": Object.freeze({
    bytes: 38_558,
    sha256: "93854fbe1861fe7fdda98bbbe909a0b86f0195dbcf3437b5d15824ba0eed9c3e",
  }),
  "scripts/lib/publisher-bundle-publication-proof.mjs": Object.freeze({
    bytes: 138_780,
    sha256: "33e2683251e7bb515e090325b67dd4b2e5ce6be608b32955d9597b426a414cef",
  }),
  "tests/publisher-bundle-publication.test.mjs": Object.freeze({
    bytes: 63_887,
    sha256: "3cad2a4ea3b18ecadd6baa0c46c4e75b28b3bd059efef2ac57fc0f785c4ac5f3",
  }),
  "scripts/lib/publisher-invalid-source-matrix-proof.mjs": Object.freeze({
    bytes: 169_060,
    sha256: "9a5553b24f03f3042cdf5e5270c57d76aba518d58e570366db7dbde173bdb010",
  }),
  "tests/publisher-invalid-source-matrix.test.mjs": Object.freeze({
    bytes: 62_241,
    sha256: "423e720c5740d1a21acd2fcb8e19d80e6801aff631becff52afe4240f05b30f4",
  }),
});
const APPROVED_M07_T09_TRACKED_RECEIPTS = Object.freeze({
  [APP_PACKAGE]: Object.freeze({
    bytes: 2_319,
    sha256: "5c4495f06ecb1394fee2c14c2e57bc1bf76fe9a99ee1cb56c0ce4ff0874388c3",
  }),
  "scripts/lib/reference-host-web-source-audit-proof.mjs": Object.freeze({
    bytes: 266_698,
    sha256: "3e105e24dd9771a578cd43d8e82f884dd0a2ef04fb1dcc7af1d617ed05ec9ffe",
  }),
  "tests/reference-host-web-source-audit.test.mjs": Object.freeze({
    bytes: 90_209,
    sha256: "34427c9fe31f3ec6bca14a661d5ea092058aa2e4d24d93a33e551a604e9bc162",
  }),
  "scripts/lib/publisher-publish-result-proof.mjs": Object.freeze({
    bytes: 59_980,
    sha256: "dcf7dbe1b4bfcda4c83ce3dc93ab2ae41e42893f4ae8ec197b221e494009aa09",
  }),
  "tests/publisher-publish-result.test.mjs": Object.freeze({
    bytes: 50_786,
    sha256: "75145e262363ceacd930806afe3f786b69b0a65910060de239f11b99c3d3cff5",
  }),
  "scripts/lib/publisher-execution-preflight-proof.mjs": Object.freeze({
    bytes: 72_334,
    sha256: "9d1b048513ac4cc0170dae2cc61c5e0befd3ed5c0d4c764e0f5f0199a6a39fea",
  }),
  "tests/publisher-execution-preflight.test.mjs": Object.freeze({
    bytes: 24_873,
    sha256: "5e0e7c2d7362f7a83996ef953ac45c0e4f249f844cc5b64de48a961df12553b1",
  }),
  "tests/publisher-catalog-pinning.test.mjs": Object.freeze({
    bytes: 38_586,
    sha256: "38eff5f01bdb54713446dda1898b87b5ca3da9064bae27937a1ebe9486ad52e5",
  }),
  "scripts/lib/publisher-bundle-publication-proof.mjs": Object.freeze({
    bytes: 139_088,
    sha256: "7680e332fe8c9c5e585022c3b05b885d6d40722a882f67f3a2646554f5413a46",
  }),
  "tests/publisher-bundle-publication.test.mjs": Object.freeze({
    bytes: 74_554,
    sha256: "0919d7a79dd353b23d1491cdec7c50a1fa58ab867a3ba9fc64a337cec2343e25",
  }),
  "scripts/lib/publisher-invalid-source-matrix-proof.mjs": Object.freeze({
    bytes: 170_585,
    sha256: "eb1929fa1ad3f468ee9b38b47fe7727ba7e0202042b63574bd411c93a344c014",
  }),
  "tests/publisher-invalid-source-matrix.test.mjs": Object.freeze({
    bytes: 76_636,
    sha256: "c697bcad81cc36392db37be25f2cc7eda525494023cf78743b4b55331895b97a",
  }),
});
const APPROVED_I07_T03_TRACKED_RECEIPTS = Object.freeze({
  "scripts/lib/publisher-bundle-publication-proof.mjs": Object.freeze({
    bytes: 139_088,
    sha256: "7fa4303bb54205c35f08aca62cbb6b07efaa840cd79706b4c4787f2d7da09462",
  }),
  "scripts/lib/publisher-invalid-source-matrix-proof.mjs": Object.freeze({
    bytes: 170_739,
    sha256: "2fd1e56ae45718f58a30c8eb8293d79e6bd7923d61da12131671964163614a90",
  }),
  "tests/publisher-invalid-source-matrix.test.mjs": Object.freeze({
    bytes: 77_231,
    sha256: "074535d871037e8c082326e7be246290a357b6fae6c318a5c310cbf24c532ac3",
  }),
});
const M07_T10_TRACKED_RECEIPT_BRIDGE = Object.freeze({
  [APP_PACKAGE]: Object.freeze({
    historical: Object.freeze({
      bytes: 2_319,
      sha256: "5c4495f06ecb1394fee2c14c2e57bc1bf76fe9a99ee1cb56c0ce4ff0874388c3",
    }),
    successor: Object.freeze({
      bytes: 2_408,
      sha256: "a54beedd590df3f2c802f42fc7adf8f703a7a69eb1c34dc67fedbb4c23a982c2",
    }),
  }),
  "scripts/lib/reference-host-web-source-audit-proof.mjs": Object.freeze({
    historical: Object.freeze({
      bytes: 266_698,
      sha256: "3e105e24dd9771a578cd43d8e82f884dd0a2ef04fb1dcc7af1d617ed05ec9ffe",
    }),
    successor: Object.freeze({
      bytes: 269_572,
      sha256: "e7c2497ee3aa128dc3d3c6cb297887a94f8d176549e6a4c205c65beeca9f6db4",
    }),
  }),
  "tests/reference-host-web-source-audit.test.mjs": Object.freeze({
    historical: Object.freeze({
      bytes: 90_209,
      sha256: "34427c9fe31f3ec6bca14a661d5ea092058aa2e4d24d93a33e551a604e9bc162",
    }),
    successor: Object.freeze({
      bytes: 91_297,
      sha256: "d7801ea603f72435cf07d55ad74cebf4ac62b0f95128d728d28200cc225afc0e",
    }),
  }),
  "scripts/lib/publisher-publish-result-proof.mjs": Object.freeze({
    historical: Object.freeze({
      bytes: 59_980,
      sha256: "dcf7dbe1b4bfcda4c83ce3dc93ab2ae41e42893f4ae8ec197b221e494009aa09",
    }),
    successor: Object.freeze({
      bytes: 60_289,
      sha256: "828aa1407a6dd790c0b0568d2a4a5c966cb1a43aa5d7aba16ae77c29819776b1",
    }),
  }),
  "tests/publisher-publish-result.test.mjs": Object.freeze({
    historical: Object.freeze({
      bytes: 50_786,
      sha256: "75145e262363ceacd930806afe3f786b69b0a65910060de239f11b99c3d3cff5",
    }),
    successor: Object.freeze({
      bytes: 56_537,
      sha256: "d8f9ffd0798bf3196b5030eab5c389273113359b398cd01597b8d1c8d4374d47",
    }),
  }),
  "scripts/lib/publisher-execution-preflight-proof.mjs": Object.freeze({
    historical: Object.freeze({
      bytes: 72_334,
      sha256: "9d1b048513ac4cc0170dae2cc61c5e0befd3ed5c0d4c764e0f5f0199a6a39fea",
    }),
    successor: Object.freeze({
      bytes: 72_643,
      sha256: "f6b10c50898d95ec737db3cf29091e9d84fbe93a1f4a1cc29cb5427d585ffb09",
    }),
  }),
  "tests/publisher-execution-preflight.test.mjs": Object.freeze({
    historical: Object.freeze({
      bytes: 24_873,
      sha256: "5e0e7c2d7362f7a83996ef953ac45c0e4f249f844cc5b64de48a961df12553b1",
    }),
    successor: Object.freeze({
      bytes: 29_586,
      sha256: "ec40b474e4a424a771acc94952c50546ecea2aefdd07b40da74555dd236d1ac9",
    }),
  }),
  "scripts/lib/publisher-catalog-pinning-proof.mjs": Object.freeze({
    historical: Object.freeze({
      bytes: 102_413,
      sha256: "ea98c9c6b70230aa5cae60ef12c3194872449d73b7e7e48c833096a8f89e341f",
    }),
    successor: Object.freeze({
      bytes: 102_413,
      sha256: "ea98c9c6b70230aa5cae60ef12c3194872449d73b7e7e48c833096a8f89e341f",
    }),
  }),
  "tests/publisher-catalog-pinning.test.mjs": Object.freeze({
    historical: Object.freeze({
      bytes: 38_586,
      sha256: "38eff5f01bdb54713446dda1898b87b5ca3da9064bae27937a1ebe9486ad52e5",
    }),
    successor: Object.freeze({
      bytes: 38_590,
      sha256: "f8644fba6a3ebc17ab09aa8396ee6c20574e7549082cd7f67df4bdc00b349a92",
    }),
  }),
  "scripts/lib/publisher-bundle-publication-proof.mjs": Object.freeze({
    historical: Object.freeze({
      bytes: 139_088,
      sha256: "7fa4303bb54205c35f08aca62cbb6b07efaa840cd79706b4c4787f2d7da09462",
    }),
    successor: Object.freeze({
      bytes: 139_396,
      sha256: "89ff5dc4f35036164dd33f1fcf65220bd086ce02ff04e9068078cbf6713bcb48",
    }),
  }),
  "tests/publisher-bundle-publication.test.mjs": Object.freeze({
    historical: Object.freeze({
      bytes: 74_554,
      sha256: "0919d7a79dd353b23d1491cdec7c50a1fa58ab867a3ba9fc64a337cec2343e25",
    }),
    successor: Object.freeze({
      bytes: 82_563,
      sha256: "4b1eb8e40281c0e12d94786042e34c85ec81737d07836b2e964fa9dc20eae185",
    }),
  }),
  "scripts/lib/publisher-invalid-source-matrix-proof.mjs": Object.freeze({
    historical: Object.freeze({
      bytes: 170_739,
      sha256: "2fd1e56ae45718f58a30c8eb8293d79e6bd7923d61da12131671964163614a90",
    }),
    successor: Object.freeze({
      bytes: 171_863,
      sha256: "82f66664a5099e61367bc6a006f2bb59eec63eaf96c27dc95d207ae0741576bf",
    }),
  }),
  "tests/publisher-invalid-source-matrix.test.mjs": Object.freeze({
    historical: Object.freeze({
      bytes: 77_231,
      sha256: "074535d871037e8c082326e7be246290a357b6fae6c318a5c310cbf24c532ac3",
    }),
    successor: Object.freeze({
      bytes: 88_591,
      sha256: "09e84895310b254ca201aa5b6e87b87b1eadf602293eaaa7545c92eafd49ac51",
    }),
  }),
});
const M07_T11_TRACKED_RECEIPT_BRIDGE = Object.freeze({
  "scripts/lib/reference-host-web-source-audit-proof.mjs": Object.freeze({
    historical:
      M07_T10_TRACKED_RECEIPT_BRIDGE["scripts/lib/reference-host-web-source-audit-proof.mjs"]
        .successor,
    successor: Object.freeze({
      bytes: 279_237,
      sha256: "b7f17df2ac1256217897072ece67e0eb8522521b6e44b80f8d76bce5c01bd08c",
    }),
  }),
  "tests/reference-host-web-source-audit.test.mjs": Object.freeze({
    historical:
      M07_T10_TRACKED_RECEIPT_BRIDGE["tests/reference-host-web-source-audit.test.mjs"].successor,
    successor: Object.freeze({
      bytes: 93_464,
      sha256: "888c1cf5235340bd5e7a27229eedb74250bfefe054078ecd8956e233ce74de70",
    }),
  }),
  "scripts/lib/publisher-publish-result-proof.mjs": Object.freeze({
    historical:
      M07_T10_TRACKED_RECEIPT_BRIDGE["scripts/lib/publisher-publish-result-proof.mjs"].successor,
    successor: Object.freeze({
      bytes: 60_598,
      sha256: "5b2178f6b90a8b830c613cf228512e3e2c6fa7b1545cca0abbe343e45ba2b749",
    }),
  }),
  "tests/publisher-publish-result.test.mjs": Object.freeze({
    historical: M07_T10_TRACKED_RECEIPT_BRIDGE["tests/publisher-publish-result.test.mjs"].successor,
    successor: Object.freeze({
      bytes: 68_032,
      sha256: "b2964ee7a2dedc285fc5da5050732525ed38c4ff6cdba4acc0f668d4462407d2",
    }),
  }),
  "scripts/lib/publisher-execution-preflight-proof.mjs": Object.freeze({
    historical:
      M07_T10_TRACKED_RECEIPT_BRIDGE["scripts/lib/publisher-execution-preflight-proof.mjs"]
        .successor,
    successor: Object.freeze({
      bytes: 72_952,
      sha256: "a0664730afda307e7f513acecba764a2b7c93f4878fa27dbdebf7b20a6cadc70",
    }),
  }),
  "tests/publisher-execution-preflight.test.mjs": Object.freeze({
    historical:
      M07_T10_TRACKED_RECEIPT_BRIDGE["tests/publisher-execution-preflight.test.mjs"].successor,
    successor: Object.freeze({
      bytes: 40_529,
      sha256: "f0282eecd5fa844851fe533eb77122384c61ab58a639d7281aa0edceb2751191",
    }),
  }),
  "scripts/lib/publisher-catalog-pinning-proof.mjs": Object.freeze({
    historical:
      M07_T10_TRACKED_RECEIPT_BRIDGE["scripts/lib/publisher-catalog-pinning-proof.mjs"].successor,
    successor: Object.freeze({
      bytes: 103_727,
      sha256: "4371b3d878564e8d34032b1c7f901b3c17e092dbd8f9acfca1b53687a255e6c8",
    }),
  }),
  "tests/publisher-catalog-pinning.test.mjs": Object.freeze({
    historical:
      M07_T10_TRACKED_RECEIPT_BRIDGE["tests/publisher-catalog-pinning.test.mjs"].successor,
    successor: Object.freeze({
      bytes: 39_954,
      sha256: "e442dc376f4787d35941f2676e78f34a859d7eee9a0374449260dd35328b5502",
    }),
  }),
  "scripts/lib/publisher-bundle-publication-proof.mjs": Object.freeze({
    historical:
      M07_T10_TRACKED_RECEIPT_BRIDGE["scripts/lib/publisher-bundle-publication-proof.mjs"]
        .successor,
    successor: Object.freeze({
      bytes: 139_704,
      sha256: "a61af18578594c589be8ae07ee244fed05c21c2f865f91a53f3ef48f4daf44bd",
    }),
  }),
  "tests/publisher-bundle-publication.test.mjs": Object.freeze({
    historical:
      M07_T10_TRACKED_RECEIPT_BRIDGE["tests/publisher-bundle-publication.test.mjs"].successor,
    successor: Object.freeze({
      bytes: 87_397,
      sha256: "26df77e97181faf11c98ca352cb83ee2b8f2f54cf2e07abc2d0a76df9d1eb813",
    }),
  }),
  "scripts/lib/publisher-invalid-source-matrix-proof.mjs": Object.freeze({
    historical:
      M07_T10_TRACKED_RECEIPT_BRIDGE["scripts/lib/publisher-invalid-source-matrix-proof.mjs"]
        .successor,
    successor: Object.freeze({
      bytes: 172_770,
      sha256: "1aec8cefc757303b5eeb6a9f5f61241f3b3c5b087ecccba9d3edcb45b1dd64de",
    }),
  }),
  "tests/publisher-invalid-source-matrix.test.mjs": Object.freeze({
    historical:
      M07_T10_TRACKED_RECEIPT_BRIDGE["tests/publisher-invalid-source-matrix.test.mjs"].successor,
    successor: Object.freeze({
      bytes: 97_713,
      sha256: "cf5e4ca357b4f6e2aa5c636303e3d6a3b9cd3fcd401d8bce991f33441227644e",
    }),
  }),
});
const MAX_AUTHORITY_BYTES = 16 * 1024 * 1024;
const READ_FLAGS = fileConstants.O_RDONLY | fileConstants.O_NOFOLLOW | fileConstants.O_NONBLOCK;
const execFileAsync = promisify(execFile);
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype);
const TYPED_ARRAY_BUFFER_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "buffer",
)?.get;
const TYPED_ARRAY_BYTE_LENGTH_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteLength",
)?.get;
const TYPED_ARRAY_BYTE_OFFSET_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteOffset",
)?.get;
const TYPED_ARRAY_TAG_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  Symbol.toStringTag,
)?.get;

const EXPECTED_REVISION = "sha256:43eef0f11f9bcc4c13fc1eb5691ee974859001fbb4aeee8051948e7c8e195601";
const EXPECTED_BUNDLE_BYTES = 2_173;
const EXPECTED_BUNDLE_SHA256 = "fac0ee3d559528af2f4274cdfb21979463cbadd419f2faba584263cc8b4c0247";
const EXPECTED_VARIANT_BYTES = 2_230;
const EXPECTED_VARIANT_SHA256 = "9a8b6e540f69c1bf2ae10d3c4db5c538114db28a45608c8430fe818d6a0955be";
const TRACE_IDS = Object.freeze(["PIPE-005", "PIPE-009", "R-012", "R-125", "A-007"]);
const REQUIRED_ERROR_CODES = Object.freeze([
  "COMMIT_OUTCOME_INDETERMINATE",
  "INVALID_ENTRY",
  "INVALID_REVISION",
  "INVALID_ROOT_DIRECTORY",
  "STORAGE_IO_FAILURE",
  "UNSAFE_STORAGE_PATH",
]);
const EXPECTED_PACKAGE_TEST_NAMES = Object.freeze([
  "stores the public Publisher golden exactly and reads it from a fresh store instance",
  "returns unchanged for byte-identical content without rewriting the inode",
  "reports exact-byte conflicts, including publication-only changes, without replacing the winner",
  "snapshots an exact Uint8Array view synchronously before the first asynchronous step",
  "returns a fresh byte copy for every read",
  "linearizes concurrent byte-identical writes across independent store instances",
  "uses first-writer-wins for concurrent divergent bytes without producing a mixed file",
  "keeps the addressed path absent until the complete temporary file is linked",
  "detects temporary truncation and removes the non-authoritative partial file",
  "reports a post-link fault as indeterminate while preserving a complete retry-safe entry",
  "removes the committed temporary alias safely when a reader overlaps the link window",
  "rejects an unowned hard-link alias instead of accepting mutable revision authority",
  "rejects final symlinks, directories, and FIFOs without following or replacing them",
  "rejects a symlinked shard without writing through it",
  "rejects malformed revision keys before any revision-derived filesystem access",
  "rejects hostile entry shells, accessors, empty bytes, and shared memory before I/O",
  "rejects symlinked and hostile root configuration with redacted failures",
  "exposes only immutable byte storage operations and no channel, activation, list, or delete API",
]);
const EXPECTED_ROOT_TEST_NAMES = Object.freeze([
  "[authority] builds the exact versioned M07-T01 artifact and golden receipt",
  "[determinism] two independent evidence builds produce byte-identical artifacts",
  "[authority] verifies fresh artifact bytes and one exact proof-document pin",
  "[artifact] rejects one changed evidence byte",
  "[proof] rejects pending, wrong, duplicate, or missing final pins",
  "[prerequisites] rejects one changed byte in every direct prerequisite",
  "[implementation] rejects no-clobber, durability, or byte-brand source drift",
  "[registration] rejects package-root, public-export, aggregate, or CI tuple drift",
  "[traceability] rejects owner or identity drift in all five exact rows",
  "[runtime] rejects overwrite, alias, copy, concurrency, or public-boundary fake receipts",
  "[tests] rejects skipped runtime cases or removed compile-time negatives",
  "[filesystem] rejects symlinked artifact and proof-document authority",
  "[writer] atomically writes exact deterministic evidence bytes",
  "[writer] preserves the old destination and removes a tampered temporary",
  "[options] rejects unknown, accessor-backed, shared-memory, or hostile authority",
  "[immutability] freezes the evidence graph and preserves honest later-task nonclaims",
]);
const EXPECTED_TYPE_NEGATIVE_CASES = Object.freeze([
  Object.freeze({
    directive: "// @ts-expect-error Bundle entries are immutable at the contract boundary.",
    statement: 'entry.revision = "sha256:mutated";',
  }),
  Object.freeze({
    directive: "// @ts-expect-error Exact bytes must be a Uint8Array view.",
    statement: 'void store.putBundle({ revision: entry.revision, bytes: "{}" });',
  }),
  Object.freeze({
    directive:
      "// @ts-expect-error The store deliberately exposes no mutable channel API in M07-T01.",
    statement: 'void store.setChannel("preview", entry.revision);',
  }),
  Object.freeze({
    directive: "// @ts-expect-error The store deliberately exposes no deletion API.",
    statement: "void store.deleteBundle(entry.revision);",
  }),
]);
const EXPECTED_PUBLIC_SOURCE_EXPORTS = Object.freeze([
  Object.freeze({
    imported: "BundleStoreError",
    exported: "BundleStoreError",
    module: "./bundle-store-contract.js",
    typeOnly: false,
  }),
  Object.freeze({
    imported: "openBundleStore",
    exported: "openBundleStore",
    module: "./bundle-store.js",
    typeOnly: false,
  }),
  ...[
    "BundleStore",
    "BundleStoreEntry",
    "BundleStoreErrorCode",
    "BundleStorePutResult",
    "BundleStoreReadResult",
    "OpenBundleStoreOptions",
  ].map((name) =>
    Object.freeze({
      imported: name,
      exported: name,
      module: "./bundle-store-contract.js",
      typeOnly: true,
    }),
  ),
]);
const APPROVED_M07_T02_PUBLIC_SOURCE_EXPORTS = Object.freeze([
  Object.freeze({
    imported: "BundleStoreError",
    exported: "BundleStoreError",
    module: "./bundle-store-contract.js",
    typeOnly: false,
  }),
  Object.freeze({
    imported: "BUNDLE_INTEGRITY_LIMITS",
    exported: "BUNDLE_INTEGRITY_LIMITS",
    module: "./bundle-verification-contract.js",
    typeOnly: false,
  }),
  Object.freeze({
    imported: "SOURCE_MATERIAL_LIMIT_EXCEEDED_CODE",
    exported: "SOURCE_MATERIAL_LIMIT_EXCEEDED_CODE",
    module: "./bundle-verification-contract.js",
    typeOnly: false,
  }),
  Object.freeze({
    imported: "verifyBundleStoreEntry",
    exported: "verifyBundleStoreEntry",
    module: "./bundle-verification.js",
    typeOnly: false,
  }),
  Object.freeze({
    imported: "openBundleStore",
    exported: "openBundleStore",
    module: "./bundle-store.js",
    typeOnly: false,
  }),
  ...[
    "BundleIntegrityAuthority",
    "BundleIntegrityDiagnostic",
    "BundleIntegrityDiagnosticCode",
    "BundleIntegrityLimits",
    "BundleIntegrityVerificationResult",
    "BundleIntegrityVerificationStage",
    "BundleSourceMaterial",
  ].map((name) =>
    Object.freeze({
      imported: name,
      exported: name,
      module: "./bundle-verification-contract.js",
      typeOnly: true,
    }),
  ),
  ...[
    "BundleStore",
    "BundleStoreEntry",
    "BundleStoreErrorCode",
    "BundleStorePutResult",
    "BundleStoreReadResult",
    "OpenBundleStoreOptions",
  ].map((name) =>
    Object.freeze({
      imported: name,
      exported: name,
      module: "./bundle-store-contract.js",
      typeOnly: true,
    }),
  ),
]);
const APPROVED_M07_T03_PUBLIC_SOURCE_EXPORTS = Object.freeze([
  Object.freeze({
    imported: "BundleStoreError",
    exported: "BundleStoreError",
    module: "./bundle-store-contract.js",
    typeOnly: false,
  }),
  ...["BUNDLE_INTEGRITY_LIMITS", "SOURCE_MATERIAL_LIMIT_EXCEEDED_CODE"].map((name) =>
    Object.freeze({
      imported: name,
      exported: name,
      module: "./bundle-verification-contract.js",
      typeOnly: false,
    }),
  ),
  ...[
    "BUNDLE_PACKAGE_PREFLIGHT_LIMITS",
    "INVALID_BUNDLE_INTEGRITY_AUTHORITY_CODE",
    "INVALID_INSTALLED_PACKAGE_CODE",
    "PACKAGE_PREFLIGHT_INTERNAL_FAILURE_CODE",
    "PACKAGE_PREFLIGHT_LIMIT_EXCEEDED_CODE",
  ].map((name) =>
    Object.freeze({
      imported: name,
      exported: name,
      module: "./package-preflight-contract.js",
      typeOnly: false,
    }),
  ),
  Object.freeze({
    imported: "preflightBundlePackages",
    exported: "preflightBundlePackages",
    module: "./package-preflight.js",
    typeOnly: false,
  }),
  Object.freeze({
    imported: "verifyBundleStoreEntry",
    exported: "verifyBundleStoreEntry",
    module: "./bundle-verification.js",
    typeOnly: false,
  }),
  Object.freeze({
    imported: "openBundleStore",
    exported: "openBundleStore",
    module: "./bundle-store.js",
    typeOnly: false,
  }),
  ...[
    "BundleIntegrityAuthority",
    "BundleIntegrityDiagnostic",
    "BundleIntegrityDiagnosticCode",
    "BundleIntegrityLimits",
    "BundleIntegrityVerificationResult",
    "BundleIntegrityVerificationStage",
    "BundleSourceMaterial",
  ].map((name) =>
    Object.freeze({
      imported: name,
      exported: name,
      module: "./bundle-verification-contract.js",
      typeOnly: true,
    }),
  ),
  ...[
    "BundlePackagePreflightAuthority",
    "BundlePackagePreflightDiagnostic",
    "BundlePackagePreflightDiagnosticCode",
    "BundlePackagePreflightLimits",
    "BundlePackagePreflightResult",
    "BundlePackagePreflightStage",
    "InstalledPackageArtifact",
    "InstalledPackageCandidate",
    "VerifiedInstalledPackage",
  ].map((name) =>
    Object.freeze({
      imported: name,
      exported: name,
      module: "./package-preflight-contract.js",
      typeOnly: true,
    }),
  ),
  ...[
    "BundleStore",
    "BundleStoreEntry",
    "BundleStoreErrorCode",
    "BundleStorePutResult",
    "BundleStoreReadResult",
    "OpenBundleStoreOptions",
  ].map((name) =>
    Object.freeze({
      imported: name,
      exported: name,
      module: "./bundle-store-contract.js",
      typeOnly: true,
    }),
  ),
]);
const APPROVED_M07_T04_PUBLIC_SOURCE_EXPORTS = Object.freeze([
  Object.freeze({
    imported: "BundleStoreError",
    exported: "BundleStoreError",
    module: "./bundle-store-contract.js",
    typeOnly: false,
  }),
  ...["BUNDLE_INTEGRITY_LIMITS", "SOURCE_MATERIAL_LIMIT_EXCEEDED_CODE"].map((name) =>
    Object.freeze({
      imported: name,
      exported: name,
      module: "./bundle-verification-contract.js",
      typeOnly: false,
    }),
  ),
  ...[
    "BUNDLE_PACKAGE_PREFLIGHT_LIMITS",
    "INVALID_BUNDLE_INTEGRITY_AUTHORITY_CODE",
    "INVALID_INSTALLED_PACKAGE_CODE",
    "PACKAGE_PREFLIGHT_INTERNAL_FAILURE_CODE",
    "PACKAGE_PREFLIGHT_LIMIT_EXCEEDED_CODE",
  ].map((name) =>
    Object.freeze({
      imported: name,
      exported: name,
      module: "./package-preflight-contract.js",
      typeOnly: false,
    }),
  ),
  Object.freeze({
    imported: "preflightBundlePackages",
    exported: "preflightBundlePackages",
    module: "./package-preflight.js",
    typeOnly: false,
  }),
  ...[
    "BUNDLE_REFERENCE_PREFLIGHT_LIMITS",
    "INVALID_BUNDLE_PACKAGE_AUTHORITY_CODE",
    "REFERENCE_PREFLIGHT_INTERNAL_FAILURE_CODE",
  ].map((name) =>
    Object.freeze({
      imported: name,
      exported: name,
      module: "./reference-preflight-contract.js",
      typeOnly: false,
    }),
  ),
  Object.freeze({
    imported: "preflightBundleReferences",
    exported: "preflightBundleReferences",
    module: "./reference-preflight.js",
    typeOnly: false,
  }),
  Object.freeze({
    imported: "verifyBundleStoreEntry",
    exported: "verifyBundleStoreEntry",
    module: "./bundle-verification.js",
    typeOnly: false,
  }),
  Object.freeze({
    imported: "openBundleStore",
    exported: "openBundleStore",
    module: "./bundle-store.js",
    typeOnly: false,
  }),
  ...[
    "BundleIntegrityAuthority",
    "BundleIntegrityDiagnostic",
    "BundleIntegrityDiagnosticCode",
    "BundleIntegrityLimits",
    "BundleIntegrityVerificationResult",
    "BundleIntegrityVerificationStage",
    "BundleSourceMaterial",
  ].map((name) =>
    Object.freeze({
      imported: name,
      exported: name,
      module: "./bundle-verification-contract.js",
      typeOnly: true,
    }),
  ),
  ...[
    "BundlePackagePreflightAuthority",
    "BundlePackagePreflightDiagnostic",
    "BundlePackagePreflightDiagnosticCode",
    "BundlePackagePreflightLimits",
    "BundlePackagePreflightResult",
    "BundlePackagePreflightStage",
    "InstalledPackageArtifact",
    "InstalledPackageCandidate",
    "VerifiedInstalledPackage",
  ].map((name) =>
    Object.freeze({
      imported: name,
      exported: name,
      module: "./package-preflight-contract.js",
      typeOnly: true,
    }),
  ),
  ...[
    "BundleReferencePreflightAuthority",
    "BundleReferencePreflightDiagnostic",
    "BundleReferencePreflightDiagnosticCode",
    "BundleReferencePreflightLimits",
    "BundleReferencePreflightResult",
    "BundleReferencePreflightStage",
    "VerifiedBundleSurfaceReferences",
  ].map((name) =>
    Object.freeze({
      imported: name,
      exported: name,
      module: "./reference-preflight-contract.js",
      typeOnly: true,
    }),
  ),
  ...[
    "BundleStore",
    "BundleStoreEntry",
    "BundleStoreErrorCode",
    "BundleStorePutResult",
    "BundleStoreReadResult",
    "OpenBundleStoreOptions",
  ].map((name) =>
    Object.freeze({
      imported: name,
      exported: name,
      module: "./bundle-store-contract.js",
      typeOnly: true,
    }),
  ),
]);
const APPROVED_M07_T05_PUBLIC_SOURCE_EXPORTS = Object.freeze([
  ...APPROVED_M07_T04_PUBLIC_SOURCE_EXPORTS.filter(({ typeOnly }) => !typeOnly),
  ...[
    "LOCAL_CONTROL_PLANE_ERROR_MESSAGES",
    "LOCAL_CONTROL_PLANE_IDENTIFIER_PATTERN",
    "LOCAL_CONTROL_PLANE_JSON_MEDIA_TYPE",
    "LOCAL_CONTROL_PLANE_LIMITS",
    "LOCAL_CONTROL_PLANE_LOOPBACK_ADDRESS",
    "LocalControlPlaneError",
  ].map((name) =>
    Object.freeze({
      imported: name,
      exported: name,
      module: "./local-control-plane-contract.js",
      typeOnly: false,
    }),
  ),
  Object.freeze({
    imported: "openLocalControlPlane",
    exported: "openLocalControlPlane",
    module: "./local-control-plane.js",
    typeOnly: false,
  }),
  ...APPROVED_M07_T04_PUBLIC_SOURCE_EXPORTS.filter(({ typeOnly }) => typeOnly),
  ...[
    "LocalControlPlane",
    "LocalControlPlaneBundlePutResult",
    "LocalControlPlaneBundleReadResult",
    "LocalControlPlaneBundleRecord",
    "LocalControlPlaneChannelPutBody",
    "LocalControlPlaneChannelPutResult",
    "LocalControlPlaneChannelReadResult",
    "LocalControlPlaneChannelRecord",
    "LocalControlPlaneErrorCode",
    "LocalControlPlaneErrorDetail",
    "LocalControlPlaneErrorEnvelope",
    "LocalControlPlaneHttpStatusCode",
    "LocalControlPlaneInjectMethod",
    "LocalControlPlaneInjectRequest",
    "LocalControlPlaneInjectResponse",
    "LocalControlPlaneLimits",
    "LocalControlPlaneListenResult",
    "LocalControlPlaneSourcePutResult",
    "LocalControlPlaneSourceReadResult",
    "LocalControlPlaneSourceRecord",
    "OpenLocalControlPlaneOptions",
  ].map((name) =>
    Object.freeze({
      imported: name,
      exported: name,
      module: "./local-control-plane-contract.js",
      typeOnly: true,
    }),
  ),
]);
const APPROVED_M07_T05_PUBLIC_RUNTIME_KEYS = Object.freeze(
  APPROVED_M07_T05_PUBLIC_SOURCE_EXPORTS.filter(({ typeOnly }) => !typeOnly)
    .map(({ exported }) => exported)
    .sort(),
);
const RUNTIME_STAGING_VALUE_EXPORTS = Object.freeze([
  ...[
    "BUNDLE_RUNTIME_STAGING_LIMITS",
    "INVALID_RUNTIME_STAGING_PACKAGE_AUTHORITY_CODE",
    "RUNTIME_STAGING_INTERNAL_FAILURE_CODE",
    "RUNTIME_STAGING_LIMIT_EXCEEDED_CODE",
    "RUNTIME_STAGING_PACKAGE_SNAPSHOT_MISMATCH_CODE",
  ].map((name) =>
    Object.freeze({
      imported: name,
      exported: name,
      module: "./runtime-staging-contract.js",
      typeOnly: false,
    }),
  ),
  Object.freeze({
    imported: "stageBundleRuntime",
    exported: "stageBundleRuntime",
    module: "./runtime-staging.js",
    typeOnly: false,
  }),
]);
const RUNTIME_STAGING_TYPE_EXPORTS = Object.freeze(
  [
    "BundleRuntimeStagingAuthority",
    "BundleRuntimeStagingDiagnostic",
    "BundleRuntimeStagingLimits",
    "BundleRuntimeStagingResult",
    "BundleRuntimeStagingStage",
    "StagedRuntimePackageSummary",
    "StagedRuntimeSurfaceSummary",
  ].map((name) =>
    Object.freeze({
      imported: name,
      exported: name,
      module: "./runtime-staging-contract.js",
      typeOnly: true,
    }),
  ),
);
const APPROVED_M07_T06_PUBLIC_SOURCE_EXPORTS = Object.freeze(
  APPROVED_M07_T05_PUBLIC_SOURCE_EXPORTS.flatMap((entry) => {
    if (!entry.typeOnly && entry.exported === "verifyBundleStoreEntry") {
      return [...RUNTIME_STAGING_VALUE_EXPORTS, entry];
    }
    if (entry.typeOnly && entry.exported === "BundleStore") {
      return [...RUNTIME_STAGING_TYPE_EXPORTS, entry];
    }
    return [entry];
  }),
);
const APPROVED_M07_T06_PUBLIC_RUNTIME_KEYS = Object.freeze(
  APPROVED_M07_T06_PUBLIC_SOURCE_EXPORTS.filter(({ typeOnly }) => !typeOnly)
    .map(({ exported }) => exported)
    .sort(),
);
const RUNTIME_ACTIVATION_VALUE_EXPORTS = Object.freeze([
  ...[
    "INVALID_RUNTIME_ACTIVATION_AUTHORITY_CODE",
    "RUNTIME_ACTIVATION_BUNDLE_RECLOSURE_FAILED_CODE",
    "RUNTIME_ACTIVATION_INTERNAL_FAILURE_CODE",
    "RuntimeActivationError",
  ].map((name) =>
    Object.freeze({
      imported: name,
      exported: name,
      module: "./runtime-activation-contract.js",
      typeOnly: false,
    }),
  ),
  Object.freeze({
    imported: "openBundleRuntimeActivation",
    exported: "openBundleRuntimeActivation",
    module: "./runtime-activation.js",
    typeOnly: false,
  }),
]);
const RUNTIME_ACTIVATION_TYPE_EXPORTS = Object.freeze(
  [
    "BundleRuntimeActivation",
    "BundleRuntimeActivationAuthority",
    "BundleRuntimeActivationDiagnostic",
    "BundleRuntimeActivationResult",
    "BundleRuntimeActivationStage",
    "BundleRuntimeActivationState",
    "OpenBundleRuntimeActivationOptions",
    "RuntimeActivationErrorCode",
    "RuntimeActivationRecord",
  ].map((name) =>
    Object.freeze({
      imported: name,
      exported: name,
      module: "./runtime-activation-contract.js",
      typeOnly: true,
    }),
  ),
);
const APPROVED_M07_T07_PUBLIC_SOURCE_EXPORTS = Object.freeze(
  APPROVED_M07_T06_PUBLIC_SOURCE_EXPORTS.flatMap((entry) => {
    if (!entry.typeOnly && entry.exported === "verifyBundleStoreEntry") {
      return [...RUNTIME_ACTIVATION_VALUE_EXPORTS, entry];
    }
    if (entry.typeOnly && entry.exported === "BundleStore") {
      return [...RUNTIME_ACTIVATION_TYPE_EXPORTS, entry];
    }
    return [entry];
  }),
);
const APPROVED_M07_T07_PUBLIC_RUNTIME_KEYS = Object.freeze(
  APPROVED_M07_T07_PUBLIC_SOURCE_EXPORTS.filter(({ typeOnly }) => !typeOnly)
    .map(({ exported }) => exported)
    .sort(),
);
const APPROVED_M07_T08_PUBLIC_SOURCE_EXPORTS = Object.freeze(
  APPROVED_M07_T07_PUBLIC_SOURCE_EXPORTS.flatMap((entry) => {
    if (!entry.typeOnly && entry.exported === "RUNTIME_ACTIVATION_BUNDLE_RECLOSURE_FAILED_CODE") {
      return [
        Object.freeze({
          imported: "INVALID_RUNTIME_RECOVERY_PACKAGE_AUTHORITY_CODE",
          exported: "INVALID_RUNTIME_RECOVERY_PACKAGE_AUTHORITY_CODE",
          module: "./runtime-activation-contract.js",
          typeOnly: false,
        }),
        entry,
      ];
    }
    if (!entry.typeOnly && entry.exported === "RuntimeActivationError") {
      return [
        Object.freeze({
          imported: "RUNTIME_RECOVERY_BUNDLE_RECLOSURE_FAILED_CODE",
          exported: "RUNTIME_RECOVERY_BUNDLE_RECLOSURE_FAILED_CODE",
          module: "./runtime-activation-contract.js",
          typeOnly: false,
        }),
        Object.freeze({
          imported: "RUNTIME_RECOVERY_INTERNAL_FAILURE_CODE",
          exported: "RUNTIME_RECOVERY_INTERNAL_FAILURE_CODE",
          module: "./runtime-activation-contract.js",
          typeOnly: false,
        }),
        entry,
      ];
    }
    if (entry.typeOnly && entry.exported === "OpenBundleRuntimeActivationOptions") {
      return [
        ...[
          "BundleRuntimeRecoveryResult",
          "BundleRuntimeRecoveryRole",
          "BundleRuntimeRecoveryStage",
        ].map((name) =>
          Object.freeze({
            imported: name,
            exported: name,
            module: "./runtime-activation-contract.js",
            typeOnly: true,
          }),
        ),
        entry,
      ];
    }
    return [entry];
  }),
);
const APPROVED_M07_T08_PUBLIC_RUNTIME_KEYS = Object.freeze(
  APPROVED_M07_T08_PUBLIC_SOURCE_EXPORTS.filter(({ typeOnly }) => !typeOnly)
    .map(({ exported }) => exported)
    .sort(),
);

export const CONTROL_PLANE_BUNDLE_STORE_PREREQUISITE_PINS = Object.freeze([
  Object.freeze({
    task: "M06-T11",
    path: "docs/proof/artifacts/publisher-0.1.0-invalid-source-matrix.json",
    sha256: "fc5904ea6ec4e6495629fc4de8009fee66155938013068b709dd1ff40c1e98d8",
  }),
  Object.freeze({
    task: "M06-T10",
    path: "docs/proof/artifacts/publisher-0.1.0-official-golden.json",
    sha256: "a2cde9718894b4af506e750d66ea7577d96da4e8a09649f17afe0f94dada17e2",
  }),
  Object.freeze({
    task: "M02-T04",
    path: "docs/proof/artifacts/protocol-0.1.0-canonicalization.json",
    sha256: "8da65b96973ee2a592735a6868f45ac1f1d0d059114902769a390fe7de33dcc6",
  }),
  Object.freeze({
    task: "M04-T01",
    path: "docs/proof/artifacts/runtime-core-0.1.0-host-ports.json",
    sha256: "5a53cfc9698339a2e9da72c496c1b204e0da138da3d3c1efdc1fe0b5c0e4f190",
  }),
]);

const TRACKED_TASK_FILES = Object.freeze([
  APP_PACKAGE,
  APP_INDEX,
  `${APP_DIRECTORY}/src/bundle-store-contract.ts`,
  `${APP_DIRECTORY}/src/bundle-store-internal.ts`,
  `${APP_DIRECTORY}/src/bundle-store.ts`,
  APP_RUNTIME_TEST,
  APP_TYPE_TEST,
  GENERATOR,
  VERIFIER,
  PROOF_LIBRARY,
  ATOMIC_WRITER,
  ROOT_TEST,
  ...HISTORICAL_COMPATIBILITY_READERS,
]);
const DISTRIBUTION_FILES = Object.freeze([
  "bundle-store-contract.d.ts",
  "bundle-store-contract.d.ts.map",
  "bundle-store-contract.js",
  "bundle-store-contract.js.map",
  "bundle-store-internal.d.ts",
  "bundle-store-internal.d.ts.map",
  "bundle-store-internal.js",
  "bundle-store-internal.js.map",
  "bundle-store.d.ts",
  "bundle-store.d.ts.map",
  "bundle-store.js",
  "bundle-store.js.map",
  "index.d.ts",
  "index.d.ts.map",
  "index.js",
  "index.js.map",
]);
const HISTORICAL_INDEX_DISTRIBUTION_RECEIPTS = Object.freeze({
  "index.d.ts": Object.freeze({
    bytes: 434,
    sha256: "03badce6c5e86dd75faae3bd2e228251d9274e4bf0f01025abde47e1159fa2a0",
  }),
  "index.d.ts.map": Object.freeze({
    bytes: 311,
    sha256: "6764987cf45e3a78fd66f4b93eab8cad2a8e17d2e10742835519e2489e748c70",
  }),
  "index.js": Object.freeze({
    bytes: 259,
    sha256: "c99e708f4e15b6ae676f7641998d8253de4351240dd2828b8d005adc148be78f",
  }),
  "index.js.map": Object.freeze({
    bytes: 201,
    sha256: "22a49bfe8d231504f570884637df1f65fe8adfc0d4db49d02a13a85654d4ba87",
  }),
});
const APPROVED_M07_T02_INDEX_DISTRIBUTION_RECEIPTS = Object.freeze({
  "index.d.ts": Object.freeze({
    bytes: 899,
    sha256: "9bf4bef4c690c138df002fdc44c4e83a0ef94c30eb72a925c39f7253eeffa680",
  }),
  "index.d.ts.map": Object.freeze({
    bytes: 539,
    sha256: "ead852d17b09a440050e9c56d456bf403b3b8ff6f7e09910e87dd659f4e68a86",
  }),
  "index.js": Object.freeze({
    bytes: 468,
    sha256: "4adf7d465b29b36ba60fdd03894b0abc08119f18dbf12a361a6f2da3eea44f69",
  }),
  "index.js.map": Object.freeze({
    bytes: 305,
    sha256: "797b2c0d81af06f50abb1bfc52b7e32861c23cb4dfb28023141e76ba76875e67",
  }),
});
const APPROVED_M07_T03_INDEX_DISTRIBUTION_RECEIPTS = Object.freeze({
  "index.d.ts": Object.freeze({
    bytes: 1_570,
    sha256: "9b4ed2ac2abce81b9c08e3d6c0a0b20497ef9dd5f2f1e4c0044c7cc3b7e4dbbd",
  }),
  "index.d.ts.map": Object.freeze({
    bytes: 833,
    sha256: "0e0ab85e46db44dc9b195add77ef575da82d1b59cde707d722a611ab69ef7f78",
  }),
  "index.js": Object.freeze({
    bytes: 810,
    sha256: "5b3651b6126b61cfc5f7f69ac5a95fc122ccd93838a7e9b7f292b8324a356aaa",
  }),
  "index.js.map": Object.freeze({
    bytes: 449,
    sha256: "90a97ad54cc860b414dbda2a3e850dc4853f227413176f43355e5d21ff055e77",
  }),
});
const APPROVED_M07_T04_INDEX_DISTRIBUTION_RECEIPTS = Object.freeze({
  "index.d.ts": Object.freeze({
    bytes: 2_144,
    sha256: "8adfbb8de836417e9c2ccf92e7e20deb6d1afcbc4bb9c1ccfef505e637c90929",
  }),
  "index.d.ts.map": Object.freeze({
    bytes: 1_074,
    sha256: "77d5b7269cde3ae2f06c2fc91aee6aab39194404fb871358e52a2e8a1505260f",
  }),
  "index.js": Object.freeze({
    bytes: 1_087,
    sha256: "1470779fe140073285db0eb38acbd72e302998b293bb33236d646eedac197a71",
  }),
  "index.js.map": Object.freeze({
    bytes: 566,
    sha256: "0060ea89d7c17c22492ddabcdf976661de09da7ea588736d8385a88da1f0c26d",
  }),
});
const APPROVED_M07_T05_INDEX_DISTRIBUTION_RECEIPTS = Object.freeze({
  "index.d.ts": Object.freeze({
    bytes: 3_244,
    sha256: "453e5c2b15d3faed0357193ffe5682e5c518b06b5ab9cf904361e76a785401bd",
  }),
  "index.d.ts.map": Object.freeze({
    bytes: 1_537,
    sha256: "53fd5e67aa7236adf897f443611614c248a99beb436ccf3fdb827651de613428",
  }),
  "index.js": Object.freeze({
    bytes: 1_469,
    sha256: "166709a7330e573bf737e2d985fe0c0761c614215df3cadc71d6bbc783c9e777",
  }),
  "index.js.map": Object.freeze({
    bytes: 723,
    sha256: "16112df85d0fe16f3767b17c28f36d0c8c3bc015f82114d4ab2b718c6d9567db",
  }),
});
const APPROVED_M07_T06_INDEX_DISTRIBUTION_RECEIPTS = Object.freeze({
  "index.d.ts": Object.freeze({
    bytes: 3_845,
    sha256: "2bffa5987fc90b787a4b160dbe1cb5fbf645b18361581457796636c5dfe71555",
  }),
  "index.d.ts.map": Object.freeze({
    bytes: 1_804,
    sha256: "bad847ad240a81f9dae10804c46cdd1b5a16b369ea5c57cf350335d574b5ee6c",
  }),
  "index.js": Object.freeze({
    bytes: 1_812,
    sha256: "2ba6d6a07cf5ebf252accf2f7527e7b60d72a246f33c605e3c49d9855f24839a",
  }),
  "index.js.map": Object.freeze({
    bytes: 866,
    sha256: "e701d456882b7c895652e780c73ba349bc150fc044645d1e872f150a44a34be2",
  }),
});
const APPROVED_M07_T07_INDEX_DISTRIBUTION_RECEIPTS = Object.freeze({
  "index.d.ts": Object.freeze({
    bytes: 4_457,
    sha256: "8911f27f0c5c11d09cd1116f99ea12f323ef37ee56c63693000e119e999f2ecd",
  }),
  "index.d.ts.map": Object.freeze({
    bytes: 2_084,
    sha256: "fd308fb24c1823a6156c7149076c82534f0dcff8517c83aaff02d043a4ad6ce7",
  }),
  "index.js": Object.freeze({
    bytes: 2_093,
    sha256: "037d35f0354064e41a7b8a89361d4c0bc75fd2e830e4bdaea74941bf669bd618",
  }),
  "index.js.map": Object.freeze({
    bytes: 996,
    sha256: "d011e413c2f446114640487305f094642a5a78a4ee635b79ec69f9937d0cf93a",
  }),
});
const APPROVED_M07_T08_INDEX_DISTRIBUTION_RECEIPTS = Object.freeze({
  "index.d.ts": Object.freeze({
    bytes: 4_730,
    sha256: "81ced4650dcf6f1fb05980c00c610923083c4262c231d604cda504f569171d56",
  }),
  "index.d.ts.map": Object.freeze({
    bytes: 2_163,
    sha256: "d10e151ff9124b072a4466c5b33e012c0f24496b900d89547209bb433a63962c",
  }),
  "index.js": Object.freeze({
    bytes: 2_282,
    sha256: "a97d3e83f6319627c78ad38b7d81b6879ac524408c7f8993c5c5f2a53cfbc02a",
  }),
  "index.js.map": Object.freeze({
    bytes: 1_036,
    sha256: "b075210c25f4659befbdeb9620842c2cd28d7f2075b11a99d83606f554330f36",
  }),
});
const ROOT_SCRIPT_COMMANDS = Object.freeze({
  generate:
    "pnpm verify:publisher-invalid-source-matrix && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:bundle-store && node scripts/generate-control-plane-bundle-store-proof.mjs",
  verify:
    "pnpm verify:publisher-invalid-source-matrix && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:bundle-store && node scripts/verify-control-plane-bundle-store.mjs",
  test: "pnpm verify:publisher-invalid-source-matrix && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:bundle-store && node --test tests/control-plane-bundle-store.test.mjs",
});

export const DEFAULT_CONTROL_PLANE_BUNDLE_STORE_ARTIFACT_PATH = path.join(ROOT, ARTIFACT);

export class ControlPlaneBundleStoreEvidenceError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ControlPlaneBundleStoreEvidenceError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details = {}) {
  throw new ControlPlaneBundleStoreEvidenceError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function byteEqual(left, right) {
  return Buffer.from(left).equals(Buffer.from(right));
}

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function exactOwnDataOptions(value, allowedKeys, label) {
  if (value === undefined) return Object.freeze({});
  try {
    if (
      value === null ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
    ) {
      fail("INVALID_OPTIONS", `${label} must be a plain own-data record.`);
    }
    const result = {};
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string" || !allowedKeys.has(key)) {
        fail("INVALID_OPTIONS", `${label} contains an unsupported option.`);
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
        fail("INVALID_OPTIONS", `${label} options must be enumerable own data.`);
      }
      result[key] = descriptor.value;
    }
    return Object.freeze(result);
  } catch (error) {
    if (error instanceof ControlPlaneBundleStoreEvidenceError) throw error;
    fail("INVALID_OPTIONS", `${label} could not be inspected safely.`);
  }
}

function captureOptionalPath(value, label) {
  if (value === undefined) return undefined;
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.includes("\0") ||
    Buffer.byteLength(value, "utf8") > MAX_AUTHORITY_BYTES
  ) {
    fail("INVALID_OPTIONS", `${label} must be a bounded primitive path string.`);
  }
  return value;
}

function captureBytes(value, label) {
  try {
    if (
      !ArrayBuffer.isView(value) ||
      TYPED_ARRAY_BUFFER_GETTER === undefined ||
      TYPED_ARRAY_BYTE_LENGTH_GETTER === undefined ||
      TYPED_ARRAY_BYTE_OFFSET_GETTER === undefined ||
      TYPED_ARRAY_TAG_GETTER === undefined
    ) {
      throw new TypeError();
    }
    const tag = Reflect.apply(TYPED_ARRAY_TAG_GETTER, value, []);
    const buffer = Reflect.apply(TYPED_ARRAY_BUFFER_GETTER, value, []);
    const byteLength = Reflect.apply(TYPED_ARRAY_BYTE_LENGTH_GETTER, value, []);
    const byteOffset = Reflect.apply(TYPED_ARRAY_BYTE_OFFSET_GETTER, value, []);
    if (
      tag !== "Uint8Array" ||
      Object.getPrototypeOf(buffer) !== ArrayBuffer.prototype ||
      !Number.isSafeInteger(byteLength) ||
      !Number.isSafeInteger(byteOffset) ||
      byteLength < 0 ||
      byteOffset < 0 ||
      byteLength > MAX_AUTHORITY_BYTES
    ) {
      throw new TypeError();
    }
    const exactView = new Uint8Array(buffer, byteOffset, byteLength);
    return Buffer.from(exactView);
  } catch (error) {
    if (error instanceof ControlPlaneBundleStoreEvidenceError) throw error;
    fail("INVALID_OPTIONS", `${label} must be exact unshared Uint8Array bytes.`);
  }
}

function captureByteOverrides(value, allowedPaths, label) {
  if (value === undefined) return Object.freeze({});
  const record = exactOwnDataOptions(value, new Set(allowedPaths), label);
  const result = {};
  for (const [relativePath, bytes] of Object.entries(record)) {
    result[relativePath] = captureBytes(bytes, `${label}.${relativePath}`);
  }
  return Object.freeze(result);
}

function copyInertJson(value, label, active = new Set(), budget = { nodes: 0 }) {
  budget.nodes += 1;
  if (budget.nodes > 20_000) fail("INVALID_OPTIONS", `${label} exceeds the inert-data budget.`);
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return value;
  }
  if (typeof value !== "object") fail("INVALID_OPTIONS", `${label} is not inert JSON data.`);
  if (active.has(value)) fail("INVALID_OPTIONS", `${label} must not contain a cycle.`);
  active.add(value);
  try {
    if (Array.isArray(value)) {
      const keys = Reflect.ownKeys(value);
      const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
      if (
        lengthDescriptor === undefined ||
        !("value" in lengthDescriptor) ||
        !Number.isSafeInteger(lengthDescriptor.value) ||
        lengthDescriptor.value < 0 ||
        lengthDescriptor.value > 20_000
      ) {
        fail("INVALID_OPTIONS", `${label} has an invalid array length.`);
      }
      const length = lengthDescriptor.value;
      if (
        keys.length !== length + 1 ||
        !keys.includes("length") ||
        keys.some((key) => {
          if (key === "length") return false;
          return (
            typeof key !== "string" ||
            !/^(?:0|[1-9]\d*)$/u.test(key) ||
            Number(key) >= length ||
            String(Number(key)) !== key
          );
        })
      ) {
        fail("INVALID_OPTIONS", `${label} contains an unsupported array property.`);
      }
      const output = [];
      for (let index = 0; index < length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
          fail("INVALID_OPTIONS", `${label} arrays must be dense own data.`);
        }
        output.push(copyInertJson(descriptor.value, label, active, budget));
      }
      return output;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      fail("INVALID_OPTIONS", `${label} must contain only plain records.`);
    }
    const output = Object.create(null);
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") fail("INVALID_OPTIONS", `${label} contains a symbol key.`);
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
        fail("INVALID_OPTIONS", `${label} must contain only enumerable own data.`);
      }
      output[key] = copyInertJson(descriptor.value, label, active, budget);
    }
    return output;
  } catch (error) {
    if (error instanceof ControlPlaneBundleStoreEvidenceError) throw error;
    fail("INVALID_OPTIONS", `${label} could not be copied safely.`);
  } finally {
    active.delete(value);
  }
}

async function captureNoFollowParentAuthority(absolute) {
  const root = path.parse(absolute).root;
  const parent = path.dirname(absolute);
  const relativeParent = path.relative(root, parent);
  const segments =
    relativeParent === "" ? [] : relativeParent.split(path.sep).filter((segment) => segment !== "");
  const authority = [];
  let current = root;
  for (const segment of segments) {
    current = path.join(current, segment);
    let entry;
    try {
      entry = await lstat(current, { bigint: true });
    } catch {
      fail("FILE_AUTHORITY_INVALID", "An evidence input parent could not be inspected.");
    }
    if (!entry.isDirectory() || entry.isSymbolicLink()) {
      fail("FILE_AUTHORITY_INVALID", "An evidence input has a symlinked or invalid parent.");
    }
    authority.push(Object.freeze({ path: current, dev: entry.dev, ino: entry.ino }));
  }
  return Object.freeze(authority);
}

async function assertNoFollowParentAuthority(authority) {
  for (const expected of authority) {
    let entry;
    try {
      entry = await lstat(expected.path, { bigint: true });
    } catch {
      fail("FILE_AUTHORITY_INVALID", "An evidence input parent changed while it was read.");
    }
    if (
      !entry.isDirectory() ||
      entry.isSymbolicLink() ||
      entry.dev !== expected.dev ||
      entry.ino !== expected.ino
    ) {
      fail("FILE_AUTHORITY_INVALID", "An evidence input parent changed while it was read.");
    }
  }
}

async function safeReadAbsolute(filePath, rejectSymlinkedParents = false) {
  const absolute = path.resolve(filePath);
  const parentAuthority = rejectSymlinkedParents
    ? await captureNoFollowParentAuthority(absolute)
    : undefined;
  let pathEntry;
  try {
    pathEntry = await lstat(absolute, { bigint: true });
  } catch {
    fail("FILE_AUTHORITY_INVALID", "An evidence input could not be opened.");
  }
  if (!pathEntry.isFile() || pathEntry.isSymbolicLink()) {
    fail("FILE_AUTHORITY_INVALID", "An evidence input is not a regular no-follow file.");
  }
  if (pathEntry.size < 0n || pathEntry.size > BigInt(MAX_AUTHORITY_BYTES)) {
    fail("FILE_AUTHORITY_INVALID", "An evidence input exceeds the bounded file profile.");
  }
  let handle;
  try {
    handle = await open(absolute, READ_FLAGS);
    const before = await handle.stat({ bigint: true });
    if (
      !before.isFile() ||
      before.dev !== pathEntry.dev ||
      before.ino !== pathEntry.ino ||
      before.size !== pathEntry.size
    ) {
      fail("FILE_AUTHORITY_INVALID", "An evidence input changed before it was read.");
    }
    if (parentAuthority !== undefined) {
      await assertNoFollowParentAuthority(parentAuthority);
    }
    const bytes = await handle.readFile();
    const after = await handle.stat({ bigint: true });
    const namedAfter = await lstat(absolute, { bigint: true });
    if (
      !after.isFile() ||
      !namedAfter.isFile() ||
      namedAfter.isSymbolicLink() ||
      after.dev !== namedAfter.dev ||
      after.ino !== namedAfter.ino ||
      before.dev !== after.dev ||
      before.ino !== after.ino ||
      before.size !== after.size ||
      before.mtimeNs !== after.mtimeNs ||
      before.ctimeNs !== after.ctimeNs ||
      BigInt(bytes.byteLength) !== after.size
    ) {
      fail("FILE_AUTHORITY_INVALID", "An evidence input changed while it was read.");
    }
    if (parentAuthority !== undefined) {
      await assertNoFollowParentAuthority(parentAuthority);
    }
    return Buffer.from(bytes);
  } catch (error) {
    if (error instanceof ControlPlaneBundleStoreEvidenceError) throw error;
    fail("FILE_AUTHORITY_INVALID", "An evidence input could not be read safely.");
  } finally {
    if (handle !== undefined) await handle.close().catch(() => undefined);
  }
}

async function authorityBytes(relativePath, overrides = {}) {
  if (Object.hasOwn(overrides, relativePath)) return Buffer.from(overrides[relativePath]);
  return safeReadAbsolute(path.join(ROOT, relativePath));
}

function fatalText(bytes, label) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail("FILE_AUTHORITY_INVALID", `${label} is not valid UTF-8.`);
  }
}

function parseJsonBytes(bytes, label) {
  try {
    return JSON.parse(fatalText(bytes, label));
  } catch (error) {
    if (error instanceof ControlPlaneBundleStoreEvidenceError) throw error;
    fail("FILE_AUTHORITY_INVALID", `${label} is not valid JSON.`);
  }
}

function parseTypescript(source, relativePath, errorCode = "TEST_AUTHORITY_DRIFT") {
  const sourceFile = ts.createSourceFile(
    relativePath,
    source,
    ts.ScriptTarget.ESNext,
    true,
    relativePath.endsWith(".js") || relativePath.endsWith(".mjs")
      ? ts.ScriptKind.JS
      : ts.ScriptKind.TS,
  );
  if (sourceFile.parseDiagnostics.length > 0) {
    fail(errorCode, "A proof-owned source file is not syntactically valid.", {
      path: relativePath,
    });
  }
  return sourceFile;
}

function registeredTestNames(source, relativePath, functionName) {
  const sourceFile = parseTypescript(source, relativePath);
  const names = [];
  const isDirectRegistration = (call) => {
    if (!ts.isExpressionStatement(call.parent)) return false;
    if (functionName === "test") return call.parent.parent === sourceFile;
    const block = call.parent.parent;
    if (!ts.isBlock(block)) return false;
    const callback = block.parent;
    if (
      (!ts.isArrowFunction(callback) && !ts.isFunctionExpression(callback)) ||
      callback.body !== block
    ) {
      return false;
    }
    const describeCall = callback.parent;
    return (
      ts.isCallExpression(describeCall) &&
      ts.isIdentifier(describeCall.expression) &&
      describeCall.expression.text === "describe" &&
      describeCall.arguments.includes(callback) &&
      ts.isExpressionStatement(describeCall.parent) &&
      describeCall.parent.parent === sourceFile
    );
  };
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === functionName
    ) {
      fail(
        "TEST_AUTHORITY_DRIFT",
        "Skipped, conditional, or modified test registrations are forbidden.",
        {
          path: relativePath,
        },
      );
    }
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === functionName
    ) {
      const [title, implementation] = node.arguments;
      if (
        !isDirectRegistration(node) ||
        title === undefined ||
        !ts.isStringLiteralLike(title) ||
        implementation === undefined ||
        (!ts.isArrowFunction(implementation) && !ts.isFunctionExpression(implementation))
      ) {
        fail("TEST_AUTHORITY_DRIFT", "Tests must be direct literal registrations with a body.", {
          path: relativePath,
        });
      }
      names.push(title.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return names;
}

function compilerNegativeCases(source, relativePath) {
  const sourceFile = parseTypescript(source, relativePath);
  const directives = (sourceFile.commentDirectives ?? []).filter(
    ({ type }) => type === ts.CommentDirectiveType.ExpectError,
  );
  const cases = directives.map(({ range }) => {
    const statement = sourceFile.statements.find(
      (candidate) => candidate.getStart(sourceFile) >= range.end,
    );
    if (
      statement === undefined ||
      !/^\s*$/u.test(source.slice(range.end, statement.getStart(sourceFile)))
    ) {
      fail(
        "TEST_AUTHORITY_DRIFT",
        "Every compiler-negative directive must bind the next statement.",
        {
          path: relativePath,
        },
      );
    }
    return Object.freeze({
      directive: source.slice(range.pos, range.end).trim(),
      statement: statement.getText(sourceFile),
    });
  });
  if (JSON.stringify(cases) !== JSON.stringify(EXPECTED_TYPE_NEGATIVE_CASES)) {
    fail("TEST_AUTHORITY_DRIFT", "The exact compiler-negative case inventory drifted.", {
      path: relativePath,
    });
  }
  return cases;
}

function publicExportInventory(source, relativePath) {
  const sourceFile = parseTypescript(source, relativePath, "REGISTRATION_DRIFT");
  const exports = [];
  for (const statement of sourceFile.statements) {
    if (
      !ts.isExportDeclaration(statement) ||
      statement.exportClause === undefined ||
      !ts.isNamedExports(statement.exportClause) ||
      statement.moduleSpecifier === undefined ||
      !ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      fail("REGISTRATION_DRIFT", "The package root may contain only explicit named re-exports.");
    }
    for (const element of statement.exportClause.elements) {
      exports.push(
        Object.freeze({
          imported: element.propertyName?.text ?? element.name.text,
          exported: element.name.text,
          module: statement.moduleSpecifier.text,
          typeOnly: statement.isTypeOnly || element.isTypeOnly,
        }),
      );
    }
  }
  const taskTime = JSON.stringify(exports) === JSON.stringify(EXPECTED_PUBLIC_SOURCE_EXPORTS);
  const approvedM07T02 =
    JSON.stringify(exports) === JSON.stringify(APPROVED_M07_T02_PUBLIC_SOURCE_EXPORTS);
  const approvedM07T03 =
    JSON.stringify(exports) === JSON.stringify(APPROVED_M07_T03_PUBLIC_SOURCE_EXPORTS);
  const approvedM07T04 =
    JSON.stringify(exports) === JSON.stringify(APPROVED_M07_T04_PUBLIC_SOURCE_EXPORTS);
  const approvedM07T05 =
    JSON.stringify(exports) === JSON.stringify(APPROVED_M07_T05_PUBLIC_SOURCE_EXPORTS);
  const approvedM07T06 =
    JSON.stringify(exports) === JSON.stringify(APPROVED_M07_T06_PUBLIC_SOURCE_EXPORTS);
  const approvedM07T07 =
    JSON.stringify(exports) === JSON.stringify(APPROVED_M07_T07_PUBLIC_SOURCE_EXPORTS);
  const approvedM07T08 =
    JSON.stringify(exports) === JSON.stringify(APPROVED_M07_T08_PUBLIC_SOURCE_EXPORTS);
  if (
    !taskTime &&
    !approvedM07T02 &&
    !approvedM07T03 &&
    !approvedM07T04 &&
    !approvedM07T05 &&
    !approvedM07T06 &&
    !approvedM07T07 &&
    !approvedM07T08
  ) {
    fail("REGISTRATION_DRIFT", "The exact public package-root export inventory drifted.");
  }
  // M07-T01 owns only its task-time exports. Reviewed successors are authenticated while this
  // historical reader projects the original inventory into the frozen T01 artifact.
  return EXPECTED_PUBLIC_SOURCE_EXPORTS;
}

function ciProofTupleProjection(source, relativePath) {
  const sourceFile = parseTypescript(source, relativePath, "REGISTRATION_DRIFT");
  const isObjectFreezeCall = (node) =>
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === "Object" &&
    node.expression.name.text === "freeze";
  const declarations = sourceFile.statements.flatMap((statement) => {
    if (!ts.isVariableStatement(statement)) return [];
    return statement.declarationList.declarations.filter(
      (declaration) =>
        ts.isIdentifier(declaration.name) && declaration.name.text === "PROOF_ENTRIES",
    );
  });
  const planDeclarations = sourceFile.statements.flatMap((statement) => {
    if (!ts.isVariableStatement(statement)) return [];
    return statement.declarationList.declarations.filter(
      (declaration) =>
        ts.isIdentifier(declaration.name) && declaration.name.text === "QUALITY_GATE_PLAN_SHA256",
    );
  });
  if (declarations.length !== 1) {
    fail("REGISTRATION_DRIFT", "The single-pass CI proof inventory declaration drifted.");
  }
  const planInitializer =
    planDeclarations.length === 1 ? planDeclarations[0].initializer : undefined;
  if (
    planInitializer === undefined ||
    !ts.isStringLiteral(planInitializer) ||
    !/^[0-9a-f]{64}$/u.test(planInitializer.text)
  ) {
    fail("REGISTRATION_DRIFT", "The single-pass CI plan digest declaration drifted.");
  }
  const initializer = declarations[0].initializer;
  const frozenArgument =
    initializer !== undefined && isObjectFreezeCall(initializer)
      ? initializer.arguments[0]
      : undefined;
  const mapAccess =
    frozenArgument !== undefined && ts.isCallExpression(frozenArgument)
      ? frozenArgument.expression
      : undefined;
  const inventory =
    mapAccess !== undefined &&
    ts.isPropertyAccessExpression(mapAccess) &&
    mapAccess.name.text === "map" &&
    ts.isArrayLiteralExpression(mapAccess.expression)
      ? mapAccess.expression
      : undefined;
  const mapCallback =
    frozenArgument !== undefined && ts.isCallExpression(frozenArgument)
      ? frozenArgument.arguments[0]
      : undefined;
  const exactMapCallback =
    mapCallback !== undefined &&
    ts.isArrowFunction(mapCallback) &&
    (mapCallback.modifiers?.length ?? 0) === 0 &&
    mapCallback.typeParameters === undefined &&
    mapCallback.type === undefined &&
    mapCallback.parameters.length === 1 &&
    (mapCallback.parameters[0].modifiers?.length ?? 0) === 0 &&
    mapCallback.parameters[0].dotDotDotToken === undefined &&
    mapCallback.parameters[0].questionToken === undefined &&
    mapCallback.parameters[0].type === undefined &&
    mapCallback.parameters[0].initializer === undefined
      ? mapCallback
      : undefined;
  const callbackParameter =
    exactMapCallback === undefined ? undefined : exactMapCallback.parameters[0].name;
  const callbackBindings =
    callbackParameter !== undefined && ts.isArrayBindingPattern(callbackParameter)
      ? callbackParameter.elements.map((element) =>
          ts.isBindingElement(element) &&
          element.dotDotDotToken === undefined &&
          element.propertyName === undefined &&
          element.initializer === undefined &&
          ts.isIdentifier(element.name)
            ? element.name.text
            : undefined,
        )
      : [];
  const callbackResult = exactMapCallback === undefined ? undefined : exactMapCallback.body;
  const callbackProperties =
    callbackResult !== undefined &&
    isObjectFreezeCall(callbackResult) &&
    callbackResult.arguments.length === 1 &&
    ts.isObjectLiteralExpression(callbackResult.arguments[0])
      ? callbackResult.arguments[0].properties.map((property) =>
          ts.isShorthandPropertyAssignment(property) ? property.name.text : undefined,
        )
      : [];
  if (
    inventory === undefined ||
    initializer.arguments.length !== 1 ||
    frozenArgument.arguments.length !== 1 ||
    JSON.stringify(callbackBindings) !== JSON.stringify(["id", "verifierFile", "rootTestFile"]) ||
    JSON.stringify(callbackProperties) !== JSON.stringify(["id", "verifierFile", "rootTestFile"])
  ) {
    fail("REGISTRATION_DRIFT", "The executable single-pass CI proof inventory shape drifted.");
  }
  const entries = inventory.elements.map((element) => {
    if (
      !ts.isArrayLiteralExpression(element) ||
      element.elements.length !== 3 ||
      !element.elements.every((value) => ts.isStringLiteral(value))
    ) {
      fail("REGISTRATION_DRIFT", "The single-pass CI contains a nonliteral proof tuple.");
    }
    return Object.freeze({
      id: element.elements[0].text,
      verifierFile: element.elements[1].text,
      rootTestFile: element.elements[2].text,
    });
  });
  for (const field of ["id", "verifierFile", "rootTestFile"]) {
    const values = entries.map((entry) => entry[field]);
    if (new Set(values).size !== values.length) {
      fail("REGISTRATION_DRIFT", "The single-pass CI contains duplicate proof authority.", {
        field,
      });
    }
  }
  const matches = entries.filter(({ id }) => id === "control-plane-bundle-store");
  const expected = {
    id: "control-plane-bundle-store",
    verifierFile: VERIFIER,
    rootTestFile: ROOT_TEST,
  };
  const observed = matches.length === 1 ? matches[0] : undefined;
  if (matches.length !== 1 || JSON.stringify(observed) !== JSON.stringify(expected)) {
    fail("REGISTRATION_DRIFT", "The exact executable single-pass CI proof tuple drifted.");
  }
  return deepFreeze({
    entries,
    planSha256: planInitializer.text,
    tuple: expected,
  });
}

const DETACHED_CI_PLAN_PREFIX = "DESEN_M07_CANDIDATE_CI_PLAN:";
const DETACHED_CI_PLAN_PROBE = [
  "const intrinsicApply = Reflect.apply;",
  "const intrinsicArrayIsArray = Array.isArray;",
  "const intrinsicBuffer = Buffer;",
  "const intrinsicBufferFrom = Buffer.from;",
  "const intrinsicBufferToString = Buffer.prototype.toString;",
  "const intrinsicEvery = Array.prototype.every;",
  "const intrinsicIsFrozen = Object.isFrozen;",
  "const intrinsicJson = JSON;",
  "const intrinsicStringify = JSON.stringify;",
  "const intrinsicStdout = process.stdout;",
  "const intrinsicStdoutWrite = process.stdout.write;",
  "const candidate = await import(process.argv[2]);",
  "const entries = candidate.PROOF_ENTRIES;",
  "const steps = candidate.createQualityGateSteps();",
  "const validation = candidate.validateQualityGatePlan(steps);",
  "const every = (array, predicate) => intrinsicApply(intrinsicEvery, array, [predicate]);",
  "const payload = intrinsicApply(intrinsicStringify, intrinsicJson, [{",
  "  entries,",
  "  entriesAreFrozenRecords:",
  "    intrinsicArrayIsArray(entries) && every(entries, (entry) => intrinsicIsFrozen(entry)),",
  "  inventoryFrozen: intrinsicIsFrozen(entries),",
  "  stepArgumentsFrozen:",
  "    intrinsicArrayIsArray(steps) && every(steps, (step) => intrinsicIsFrozen(step.args)),",
  "  stepRecordsFrozen:",
  "    intrinsicArrayIsArray(steps) && every(steps, (step) => intrinsicIsFrozen(step)),",
  "  steps,",
  "  stepsFrozen: intrinsicIsFrozen(steps),",
  "  validation,",
  "}]);",
  'const payloadBytes = intrinsicApply(intrinsicBufferFrom, intrinsicBuffer, [payload, "utf8"]);',
  'const encoded = intrinsicApply(intrinsicBufferToString, payloadBytes, ["base64"]);',
  `intrinsicApply(intrinsicStdoutWrite, intrinsicStdout, [${JSON.stringify(DETACHED_CI_PLAN_PREFIX)} + encoded]);`,
].join("\n");

const FIXED_CI_PLAN_PREFIX = Object.freeze([
  Object.freeze({
    id: "orchestrator-contracts",
    command: "node",
    args: Object.freeze(["--test", "scripts/test/ci-quality-gate.test.mjs"]),
  }),
  Object.freeze({
    id: "format",
    command: "pnpm",
    args: Object.freeze(["exec", "prettier", ".", "--check"]),
  }),
  Object.freeze({
    id: "lint",
    command: "pnpm",
    args: Object.freeze(["exec", "eslint", ".", "--max-warnings=0"]),
  }),
  Object.freeze({
    id: "structural-validator-artifacts",
    command: "node",
    args: Object.freeze(["packages/validator/scripts/verify-structural-validators.mjs"]),
  }),
  Object.freeze({
    id: "workspace-graph",
    command: "pnpm",
    args: Object.freeze(["exec", "turbo", "run", "build", "typecheck", "--force", "--ui=stream"]),
  }),
  Object.freeze({
    id: "package-tests",
    command: "pnpm",
    args: Object.freeze([
      "--recursive",
      "--workspace-concurrency=1",
      "--if-present",
      "run",
      "test",
    ]),
  }),
]);

const FIXED_CI_PLAN_SUFFIX = Object.freeze([
  Object.freeze({
    id: "dependency-boundaries",
    command: "pnpm",
    args: Object.freeze([
      "exec",
      "depcruise",
      "--config",
      "dependency-cruiser.config.cjs",
      "apps",
      "packages",
    ]),
  }),
  Object.freeze({
    id: "boundary-fixtures",
    command: "node",
    args: Object.freeze(["scripts/verify-boundary-fixtures.mjs"]),
  }),
]);

function exactJsonRecord(value, expectedKeys) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype &&
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expectedKeys].sort())
  );
}

function validateDetachedCiPlan(receipt, sourceProjection) {
  const receiptKeys = [
    "entries",
    "entriesAreFrozenRecords",
    "inventoryFrozen",
    "stepArgumentsFrozen",
    "stepRecordsFrozen",
    "steps",
    "stepsFrozen",
    "validation",
  ];
  if (
    !exactJsonRecord(receipt, receiptKeys) ||
    !Array.isArray(receipt.entries) ||
    !Array.isArray(receipt.steps) ||
    !exactJsonRecord(receipt.validation, ["planSha256", "stepCount"]) ||
    receipt.inventoryFrozen !== true ||
    receipt.entriesAreFrozenRecords !== true ||
    receipt.stepsFrozen !== true ||
    receipt.stepRecordsFrozen !== true ||
    receipt.stepArgumentsFrozen !== true
  ) {
    fail(
      "REGISTRATION_DRIFT",
      "The detached CI candidate did not expose one exact recursively frozen plan authority.",
    );
  }
  if (
    !receipt.entries.every(
      (entry) =>
        exactJsonRecord(entry, ["id", "verifierFile", "rootTestFile"]) &&
        typeof entry.id === "string" &&
        typeof entry.verifierFile === "string" &&
        typeof entry.rootTestFile === "string",
    ) ||
    JSON.stringify(receipt.entries) !== JSON.stringify(sourceProjection.entries)
  ) {
    fail(
      "REGISTRATION_DRIFT",
      "The detached CI candidate exports different proof tuples than its exact source bytes.",
    );
  }
  if (
    !receipt.steps.every(
      (step) =>
        exactJsonRecord(step, ["args", "command", "id", "label"]) &&
        typeof step.id === "string" &&
        typeof step.label === "string" &&
        typeof step.command === "string" &&
        Array.isArray(step.args) &&
        step.args.every((argument) => typeof argument === "string"),
    )
  ) {
    fail("REGISTRATION_DRIFT", "The detached CI candidate produced a malformed plan step.");
  }

  const expectedPlan = [
    ...FIXED_CI_PLAN_PREFIX,
    ...sourceProjection.entries.map(({ id, verifierFile }) => ({
      id: `verify-${id}`,
      command: "node",
      args: [verifierFile],
    })),
    ...sourceProjection.entries.map(({ id, rootTestFile }) => ({
      id: `test-${id}`,
      command: "node",
      args: ["--test", "--test-concurrency=1", rootTestFile],
    })),
    ...FIXED_CI_PLAN_SUFFIX,
  ];
  const observedPlan = receipt.steps.map(({ id, command, args }) => ({ id, command, args }));
  const independentlyCalculatedPlanSha256 = sha256(
    Buffer.from(JSON.stringify(observedPlan), "utf8"),
  );
  if (
    JSON.stringify(observedPlan) !== JSON.stringify(expectedPlan) ||
    receipt.validation.stepCount !== observedPlan.length ||
    receipt.validation.planSha256 !== independentlyCalculatedPlanSha256 ||
    independentlyCalculatedPlanSha256 !== sourceProjection.planSha256
  ) {
    fail(
      "REGISTRATION_DRIFT",
      "The detached CI candidate does not execute the complete exact append-only quality-gate plan.",
    );
  }
}

async function executeDetachedCiPlan(ciSourceBytes, sourceProjection) {
  const generatedDirectory = await mkdtemp(path.join(os.tmpdir(), "desen-m07-ci-candidate-"));
  const candidatePath = path.join(generatedDirectory, "run-ci-quality-gate.mjs");
  try {
    await writeFile(candidatePath, ciSourceBytes, { flag: "wx", mode: 0o600 });
    const canonicalCandidatePath = await realpath(candidatePath);
    const authenticatedBytes = await safeReadAbsolute(canonicalCandidatePath);
    if (!byteEqual(authenticatedBytes, ciSourceBytes)) {
      fail(
        "REGISTRATION_DRIFT",
        "The detached CI candidate changed before executable observation.",
      );
    }

    const candidateUrl = pathToFileURL(canonicalCandidatePath);
    candidateUrl.searchParams.set("desen-proof-sha256", sha256(authenticatedBytes));
    let stdout;
    let stderr;
    try {
      ({ stdout, stderr } = await execFileAsync(
        process.execPath,
        [
          "--max-old-space-size=128",
          "--permission",
          `--allow-fs-read=${canonicalCandidatePath}`,
          "--input-type=module",
          "--eval",
          DETACHED_CI_PLAN_PROBE,
          "desen-m07-ci-plan-probe",
          candidateUrl.href,
        ],
        {
          cwd: ROOT,
          detached: process.platform !== "win32",
          encoding: "utf8",
          env: {},
          maxBuffer: 1_048_576,
          timeout: 5_000,
        },
      ));
    } catch (error) {
      fail(
        "REGISTRATION_DRIFT",
        "The detached CI candidate could not derive and validate its executable plan.",
        {
          exitCode:
            typeof error === "object" && error !== null && Object.hasOwn(error, "code")
              ? String(error.code)
              : "unknown",
          signal:
            typeof error === "object" && error !== null && Object.hasOwn(error, "signal")
              ? String(error.signal)
              : "none",
          stderr:
            typeof error === "object" && error !== null && Object.hasOwn(error, "stderr")
              ? String(error.stderr).slice(-4_096)
              : "",
        },
      );
    }

    const afterBytes = await safeReadAbsolute(canonicalCandidatePath);
    if (!byteEqual(authenticatedBytes, afterBytes) || stderr !== "") {
      fail(
        "REGISTRATION_DRIFT",
        "The detached CI candidate changed during observation or emitted unexpected stderr.",
      );
    }
    if (typeof stdout !== "string" || !stdout.startsWith(DETACHED_CI_PLAN_PREFIX)) {
      fail("REGISTRATION_DRIFT", "The detached CI candidate returned no isolated plan receipt.");
    }
    const encoded = stdout.slice(DETACHED_CI_PLAN_PREFIX.length);
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(encoded)) {
      fail("REGISTRATION_DRIFT", "The detached CI candidate returned a malformed plan receipt.");
    }
    let receipt;
    try {
      receipt = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
    } catch {
      fail("REGISTRATION_DRIFT", "The detached CI candidate plan receipt is not valid JSON.");
    }
    validateDetachedCiPlan(receipt, sourceProjection);
  } finally {
    await rm(generatedDirectory, { force: true, recursive: true });
  }
}

function commandSegments(value) {
  return typeof value === "string"
    ? value
        .split(/\s*&&\s*/u)
        .map((segment) => segment.trim())
        .filter(Boolean)
    : [];
}

function assertSuccessorSafeAggregateEdge(script, predecessor, current, terminal) {
  const segments = commandSegments(script);
  const predecessorIndexes = segments.flatMap((segment, index) =>
    segment === predecessor ? [index] : [],
  );
  const currentIndexes = segments.flatMap((segment, index) => (segment === current ? [index] : []));
  const terminalIndexes = segments.flatMap((segment, index) =>
    segment === terminal ? [index] : [],
  );
  if (
    predecessorIndexes.length !== 1 ||
    currentIndexes.length !== 1 ||
    terminalIndexes.length !== 1 ||
    predecessorIndexes[0] + 1 !== currentIndexes[0] ||
    currentIndexes[0] >= terminalIndexes[0]
  ) {
    fail("REGISTRATION_DRIFT", "The aggregate proof dependency edge drifted.");
  }
}

function functionDeclaration(sourceFile, name) {
  const declarations = sourceFile.statements.filter(
    (statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === name,
  );
  if (declarations.length !== 1 || declarations[0].body === undefined) {
    fail("IMPLEMENTATION_DRIFT", "A required immutable-store implementation boundary drifted.");
  }
  return declarations[0];
}

function nodeTextCount(sourceFile, root, predicate, expectedText) {
  let count = 0;
  const visit = (node) => {
    if (predicate(node) && node.getText(sourceFile) === expectedText) count += 1;
    ts.forEachChild(node, visit);
  };
  visit(root);
  return count;
}

async function implementationProjection(overrides) {
  const relativePath = `${APP_DIRECTORY}/src/bundle-store-internal.ts`;
  const source = fatalText(await authorityBytes(relativePath, overrides), relativePath);
  const sourceFile = parseTypescript(source, relativePath, "IMPLEMENTATION_DRIFT");
  const checks = [
    {
      functionName: "putNewEntry",
      predicate: ts.isAwaitExpression,
      text: "await link(temporary.path, finalPath)",
      claim: "same-directory hard-link commit",
    },
    {
      functionName: "establishShardParentDurability",
      predicate: ts.isAwaitExpression,
      text: "await syncDirectory(authority.algorithm)",
      claim: "algorithm-directory durability",
    },
    {
      functionName: "captureBytes",
      predicate: ts.isBinaryExpression,
      text: 'tag !== "Uint8Array"',
      claim: "exact Uint8Array brand",
    },
    {
      functionName: "readRegularFile",
      predicate: ts.isBinaryExpression,
      text: "before.nlink !== 1n",
      claim: "single-link read authority",
    },
  ];
  for (const check of checks) {
    const declaration = functionDeclaration(sourceFile, check.functionName);
    if (nodeTextCount(sourceFile, declaration.body, check.predicate, check.text) !== 1) {
      fail("IMPLEMENTATION_DRIFT", `The ${check.claim} implementation authority drifted.`);
    }
  }
  return deepFreeze({
    noClobberCommit: "putNewEntry:await link(temporary.path, finalPath)",
    parentDurability: "establishShardParentDurability:await syncDirectory(authority.algorithm)",
    byteBrand: 'captureBytes:tag !== "Uint8Array"',
    singleLinkRead: "readRegularFile:before.nlink !== 1n",
  });
}

function collectTraceRows(value, found = []) {
  if (Array.isArray(value)) {
    for (const entry of value) collectTraceRows(entry, found);
    return found;
  }
  if (value !== null && typeof value === "object") {
    if (typeof value.id === "string" && TRACE_IDS.includes(value.id)) found.push(value);
    for (const child of Object.values(value)) collectTraceRows(child, found);
  }
  return found;
}

async function trackedFileReceipts(overrides) {
  let historicalSuccessorState = false;
  let currentSuccessorState = false;
  let m07T11HistoricalState = false;
  let m07T11CurrentState = false;
  const receipts = [];
  for (const relativePath of TRACKED_TASK_FILES) {
    const bytes = await authorityBytes(relativePath, overrides);
    const overridden = Object.hasOwn(overrides, relativePath);
    const historical = overridden ? undefined : HISTORICAL_TRACKED_RECEIPTS[relativePath];
    const taskTime = HISTORICAL_TRACKED_RECEIPTS[relativePath];
    const approvedM07T02 = APPROVED_M07_T02_TRACKED_RECEIPTS[relativePath];
    const approvedM07T03 = APPROVED_M07_T03_TRACKED_RECEIPTS[relativePath];
    const approvedM07T04 = APPROVED_M07_T04_TRACKED_RECEIPTS[relativePath];
    const approvedM07T05 = APPROVED_M07_T05_TRACKED_RECEIPTS[relativePath];
    const approvedM07T06 = APPROVED_M07_T06_TRACKED_RECEIPTS[relativePath];
    const approvedM07T07 = APPROVED_M07_T07_TRACKED_RECEIPTS[relativePath];
    const approvedM07T08 = APPROVED_M07_T08_TRACKED_RECEIPTS[relativePath];
    const approvedM07T09 = APPROVED_M07_T09_TRACKED_RECEIPTS[relativePath];
    const approvedI07T03 = APPROVED_I07_T03_TRACKED_RECEIPTS[relativePath];
    const m07T10Bridge = M07_T10_TRACKED_RECEIPT_BRIDGE[relativePath];
    const m07T11Bridge = M07_T11_TRACKED_RECEIPT_BRIDGE[relativePath];
    const observedSha256 = sha256(bytes);
    if (m07T11Bridge !== undefined) {
      const historicalMatch =
        bytes.byteLength === m07T11Bridge.historical.bytes &&
        observedSha256 === m07T11Bridge.historical.sha256;
      const successorMatch =
        bytes.byteLength === m07T11Bridge.successor.bytes &&
        observedSha256 === m07T11Bridge.successor.sha256;
      if (!historicalMatch && !successorMatch) {
        fail("REGISTRATION_DRIFT", "A reviewed M07-T11 tracked successor receipt drifted.", {
          path: relativePath,
        });
      }
      if (historicalMatch && !successorMatch) m07T11HistoricalState = true;
      if (successorMatch && !historicalMatch) m07T11CurrentState = true;
      // Either reviewed T11 generation is already on the M07-T10 successor side of the older
      // bridge. Preserve that older coherence signal even after this path gains a newer bridge.
      if (m07T10Bridge !== undefined && (historicalMatch || successorMatch)) {
        currentSuccessorState = true;
      }
    } else if (m07T10Bridge !== undefined) {
      const historicalMatch =
        bytes.byteLength === m07T10Bridge.historical.bytes &&
        observedSha256 === m07T10Bridge.historical.sha256;
      const successorMatch =
        bytes.byteLength === m07T10Bridge.successor.bytes &&
        observedSha256 === m07T10Bridge.successor.sha256;
      if (!historicalMatch && !successorMatch) {
        fail("REGISTRATION_DRIFT", "A reviewed M07-T10 tracked successor receipt drifted.", {
          path: relativePath,
        });
      }
      if (historicalMatch && !successorMatch) historicalSuccessorState = true;
      if (successorMatch && !historicalMatch) currentSuccessorState = true;
    } else if (
      (approvedM07T02 !== undefined ||
        approvedM07T03 !== undefined ||
        approvedM07T04 !== undefined ||
        approvedM07T05 !== undefined ||
        approvedM07T06 !== undefined ||
        approvedM07T07 !== undefined ||
        approvedM07T08 !== undefined ||
        approvedM07T09 !== undefined ||
        approvedI07T03 !== undefined) &&
      !(
        (bytes.byteLength === taskTime?.bytes && observedSha256 === taskTime.sha256) ||
        (approvedM07T02 !== undefined &&
          bytes.byteLength === approvedM07T02.bytes &&
          observedSha256 === approvedM07T02.sha256) ||
        (approvedM07T03 !== undefined &&
          bytes.byteLength === approvedM07T03.bytes &&
          observedSha256 === approvedM07T03.sha256) ||
        (approvedM07T04 !== undefined &&
          bytes.byteLength === approvedM07T04.bytes &&
          observedSha256 === approvedM07T04.sha256) ||
        (approvedM07T05 !== undefined &&
          bytes.byteLength === approvedM07T05.bytes &&
          observedSha256 === approvedM07T05.sha256) ||
        (approvedM07T06 !== undefined &&
          bytes.byteLength === approvedM07T06.bytes &&
          observedSha256 === approvedM07T06.sha256) ||
        (approvedM07T07 !== undefined &&
          bytes.byteLength === approvedM07T07.bytes &&
          observedSha256 === approvedM07T07.sha256) ||
        (approvedM07T08 !== undefined &&
          bytes.byteLength === approvedM07T08.bytes &&
          observedSha256 === approvedM07T08.sha256) ||
        (approvedM07T09 !== undefined &&
          bytes.byteLength === approvedM07T09.bytes &&
          observedSha256 === approvedM07T09.sha256) ||
        (approvedI07T03 !== undefined &&
          bytes.byteLength === approvedI07T03.bytes &&
          observedSha256 === approvedI07T03.sha256)
      )
    ) {
      fail("REGISTRATION_DRIFT", "The reviewed package successor bytes drifted.", {
        path: relativePath,
      });
    }
    receipts.push(
      Object.freeze({
        path: relativePath,
        bytes: historical?.bytes ?? bytes.byteLength,
        sha256: historical?.sha256 ?? observedSha256,
      }),
    );
  }
  if (historicalSuccessorState && currentSuccessorState) {
    fail("REGISTRATION_DRIFT", "The reviewed M07-T10 tracked successor set is incoherent.");
  }
  if (m07T11HistoricalState && m07T11CurrentState) {
    fail("REGISTRATION_DRIFT", "The reviewed M07-T11 tracked successor set is incoherent.");
  }
  return Object.freeze(receipts);
}

async function distributionReceipts() {
  const distDirectory = path.join(ROOT, APP_DIRECTORY, "dist");
  const observed = (await readdir(distDirectory))
    .filter((fileName) => fileName.startsWith("bundle-store") || fileName.startsWith("index."))
    .sort();
  if (JSON.stringify(observed) !== JSON.stringify(DISTRIBUTION_FILES)) {
    fail("DISTRIBUTION_DRIFT", "The task-owned generated distribution inventory drifted.", {
      observed,
    });
  }
  return Object.freeze(
    await Promise.all(
      observed.map(async (fileName) => {
        const relativePath = `${APP_DIRECTORY}/dist/${fileName}`;
        const bytes = await safeReadAbsolute(path.join(ROOT, relativePath));
        const historical = HISTORICAL_INDEX_DISTRIBUTION_RECEIPTS[fileName];
        const approvedM07T02 = APPROVED_M07_T02_INDEX_DISTRIBUTION_RECEIPTS[fileName];
        const approvedM07T03 = APPROVED_M07_T03_INDEX_DISTRIBUTION_RECEIPTS[fileName];
        const approvedM07T04 = APPROVED_M07_T04_INDEX_DISTRIBUTION_RECEIPTS[fileName];
        const approvedM07T05 = APPROVED_M07_T05_INDEX_DISTRIBUTION_RECEIPTS[fileName];
        const approvedM07T06 = APPROVED_M07_T06_INDEX_DISTRIBUTION_RECEIPTS[fileName];
        const approvedM07T07 = APPROVED_M07_T07_INDEX_DISTRIBUTION_RECEIPTS[fileName];
        const approvedM07T08 = APPROVED_M07_T08_INDEX_DISTRIBUTION_RECEIPTS[fileName];
        const observedSha256 = sha256(bytes);
        if (
          historical !== undefined &&
          !(
            (bytes.byteLength === historical.bytes && observedSha256 === historical.sha256) ||
            (approvedM07T02 !== undefined &&
              bytes.byteLength === approvedM07T02.bytes &&
              observedSha256 === approvedM07T02.sha256) ||
            (approvedM07T03 !== undefined &&
              bytes.byteLength === approvedM07T03.bytes &&
              observedSha256 === approvedM07T03.sha256) ||
            (approvedM07T04 !== undefined &&
              bytes.byteLength === approvedM07T04.bytes &&
              observedSha256 === approvedM07T04.sha256) ||
            (approvedM07T05 !== undefined &&
              bytes.byteLength === approvedM07T05.bytes &&
              observedSha256 === approvedM07T05.sha256) ||
            (approvedM07T06 !== undefined &&
              bytes.byteLength === approvedM07T06.bytes &&
              observedSha256 === approvedM07T06.sha256) ||
            (approvedM07T07 !== undefined &&
              bytes.byteLength === approvedM07T07.bytes &&
              observedSha256 === approvedM07T07.sha256) ||
            (approvedM07T08 !== undefined &&
              bytes.byteLength === approvedM07T08.bytes &&
              observedSha256 === approvedM07T08.sha256)
          )
        ) {
          fail("DISTRIBUTION_DRIFT", "The reviewed package-root distribution drifted.", {
            path: relativePath,
          });
        }
        return Object.freeze({
          path: relativePath,
          bytes: historical?.bytes ?? bytes.byteLength,
          sha256: historical?.sha256 ?? observedSha256,
        });
      }),
    ),
  );
}

async function prerequisiteReceipts(overrides) {
  const receipts = [];
  for (const pin of CONTROL_PLANE_BUNDLE_STORE_PREREQUISITE_PINS) {
    const bytes = await authorityBytes(pin.path, overrides);
    const observed = sha256(bytes);
    if (observed !== pin.sha256) {
      fail("PREREQUISITE_DRIFT", "A direct prerequisite artifact drifted.", {
        task: pin.task,
        path: pin.path,
        expectedSha256: pin.sha256,
        observedSha256: observed,
      });
    }
    receipts.push(Object.freeze({ ...pin, verifiedSha256: observed }));
  }
  return Object.freeze(receipts);
}

async function registrationProjection(overrides) {
  const [appPackageBytes, appIndexBytes, rootPackageBytes, ciSourceBytes] = await Promise.all([
    authorityBytes(APP_PACKAGE, overrides),
    authorityBytes(APP_INDEX, overrides),
    authorityBytes(ROOT_PACKAGE, overrides),
    authorityBytes(CI_SOURCE, overrides),
  ]);
  const appPackage = parseJsonBytes(appPackageBytes, APP_PACKAGE);
  const rootPackage = parseJsonBytes(rootPackageBytes, ROOT_PACKAGE);
  const appIndex = fatalText(appIndexBytes, APP_INDEX);
  const ciSource = fatalText(ciSourceBytes, CI_SOURCE);
  const expectedAppProjection = {
    name: "@desen/control-plane-api",
    main: "./dist/index.js",
    types: "./dist/index.d.ts",
    exportKeys: ["."],
    exports: {
      types: "./dist/index.d.ts",
      import: "./dist/index.js",
    },
    packageTest: "vitest run test/bundle-store.test.ts",
    protocolDependency: "workspace:*",
  };
  const observedAppProjection = {
    name: appPackage.name,
    main: appPackage.main,
    types: appPackage.types,
    exportKeys:
      appPackage.exports !== null && typeof appPackage.exports === "object"
        ? Object.keys(appPackage.exports).sort()
        : [],
    exports: appPackage.exports?.["."],
    packageTest: appPackage.scripts?.["test:bundle-store"],
    protocolDependency: appPackage.dependencies?.["@desen/protocol"],
  };
  if (JSON.stringify(observedAppProjection) !== JSON.stringify(expectedAppProjection)) {
    fail("REGISTRATION_DRIFT", "The M07-T01 package registration projection drifted.");
  }
  const publicExports = publicExportInventory(appIndex, APP_INDEX);
  const observedRootScripts = {
    generate: rootPackage.scripts?.["generate:control-plane-bundle-store"],
    verify: rootPackage.scripts?.["verify:control-plane-bundle-store"],
    test: rootPackage.scripts?.["test:control-plane-bundle-store"],
  };
  if (JSON.stringify(observedRootScripts) !== JSON.stringify(ROOT_SCRIPT_COMMANDS)) {
    fail("REGISTRATION_DRIFT", "The root Bundle-store proof commands drifted.");
  }
  assertSuccessorSafeAggregateEdge(
    rootPackage.scripts?.check,
    "pnpm verify:publisher-invalid-source-matrix",
    "pnpm verify:control-plane-bundle-store",
    "pnpm lint",
  );
  assertSuccessorSafeAggregateEdge(
    rootPackage.scripts?.test,
    "pnpm test:publisher-invalid-source-matrix",
    "pnpm test:control-plane-bundle-store",
    "turbo run test",
  );
  const ciProjection = ciProofTupleProjection(ciSource, CI_SOURCE);
  if (Object.hasOwn(overrides, CI_SOURCE)) {
    await executeDetachedCiPlan(ciSourceBytes, ciProjection);
  }
  const ciTuple = ciProjection.tuple;
  return deepFreeze({
    app: expectedAppProjection,
    rootScripts: ROOT_SCRIPT_COMMANDS,
    aggregateImmediatePredecessor: "publisher-invalid-source-matrix",
    aggregateSuccessorExtensionSafe: true,
    ci: { ...ciTuple, tupleExact: true },
    publicSourceExports: {
      inventory: publicExports,
      requiredRuntime: publicExports
        .filter(({ typeOnly }) => !typeOnly)
        .map(({ exported }) => exported),
      requiredTypes: publicExports
        .filter(({ typeOnly }) => typeOnly)
        .map(({ exported }) => exported),
      internalFactoryAbsent: true,
    },
  });
}

async function traceProjection(overrides) {
  const trace = parseJsonBytes(await authorityBytes(TRACEABILITY, overrides), TRACEABILITY);
  const rows = collectTraceRows(trace).sort(
    (left, right) => TRACE_IDS.indexOf(left.id) - TRACE_IDS.indexOf(right.id),
  );
  if (
    rows.length !== TRACE_IDS.length ||
    rows.some((row, index) => row.id !== TRACE_IDS[index] || !row.owners?.includes("M07-T01"))
  ) {
    fail("TRACEABILITY_DRIFT", "The exact M07-T01 trace projection drifted.");
  }
  return deepFreeze(copyInertJson(rows, "trace rows"));
}

async function packageTestProjection(overrides) {
  const [runtimeTestBytes, typeTestBytes, rootTestBytes] = await Promise.all([
    authorityBytes(APP_RUNTIME_TEST, overrides),
    authorityBytes(APP_TYPE_TEST, overrides),
    authorityBytes(ROOT_TEST, overrides),
  ]);
  const runtimeTest = fatalText(runtimeTestBytes, APP_RUNTIME_TEST);
  const typeTest = fatalText(typeTestBytes, APP_TYPE_TEST);
  const rootTest = fatalText(rootTestBytes, ROOT_TEST);
  const names = registeredTestNames(runtimeTest, APP_RUNTIME_TEST, "it");
  if (JSON.stringify(names) !== JSON.stringify(EXPECTED_PACKAGE_TEST_NAMES)) {
    fail("TEST_AUTHORITY_DRIFT", "The exact focused Bundle-store test inventory drifted.");
  }
  const typeNegativeCases = compilerNegativeCases(typeTest, APP_TYPE_TEST);
  const rootNames = registeredTestNames(rootTest, ROOT_TEST, "test");
  if (JSON.stringify(rootNames) !== JSON.stringify(EXPECTED_ROOT_TEST_NAMES)) {
    fail("TEST_AUTHORITY_DRIFT", "The exact root mutation-test inventory drifted.");
  }
  return deepFreeze({
    packageRuntimeCases: names.length,
    packageRuntimeCaseNames: names,
    compileTimeNegativeCases: typeNegativeCases.length,
    rootMutationCases: rootNames.length,
    rootMutationCaseNames: rootNames,
  });
}

function bundleRelativePath(revision) {
  const hexadecimal = revision.slice("sha256:".length);
  return path.join("bundles", "sha256", hexadecimal.slice(0, 2), `${hexadecimal.slice(2)}.bundle`);
}

async function probePackageSelfReference() {
  const program = [
    'import("@desen/control-plane-api")',
    "  .then((module) => process.stdout.write(JSON.stringify({",
    '    error: typeof module.BundleStoreError === "function",',
    '    open: typeof module.openBundleStore === "function",',
    '    internal: Object.hasOwn(module, "openBundleStoreInternal"),',
    "    keys: Object.keys(module).sort()",
    "  })))",
    "  .catch((error) => { process.stderr.write(String(error)); process.exitCode = 1; });",
  ].join("\n");
  const environment = { ...process.env, NODE_OPTIONS: "" };
  delete environment.NODE_PATH;
  try {
    const { stdout } = await execFileAsync(
      process.execPath,
      ["--no-warnings", "--input-type=module", "-e", program],
      {
        cwd: path.join(ROOT, APP_DIRECTORY),
        encoding: "utf8",
        env: environment,
        maxBuffer: 64 * 1024,
        timeout: 30_000,
      },
    );
    return parseJsonBytes(Buffer.from(stdout, "utf8"), "package self-reference probe");
  } catch {
    fail("RUNTIME_PROBE_MISMATCH", "The built public package root is not self-importable.");
  }
}

export async function runControlPlaneBundleStoreProbe() {
  const [controlPlane, publisher, protocol, sourceBytes, catalogBytes, selfReference] =
    await Promise.all([
      import(pathToFileURL(path.join(ROOT, APP_DIRECTORY, "dist/index.js")).href),
      import(pathToFileURL(path.join(ROOT, "packages/publisher/dist/index.js")).href),
      import(pathToFileURL(path.join(ROOT, "packages/protocol/dist/index.js")).href),
      safeReadAbsolute(path.join(ROOT, SOURCE_FIXTURE)),
      safeReadAbsolute(path.join(ROOT, CATALOG_FIXTURE)),
      probePackageSelfReference(),
    ]);
  const source = parseJsonBytes(sourceBytes, SOURCE_FIXTURE);
  const catalog = parseJsonBytes(catalogBytes, CATALOG_FIXTURE);
  const published = publisher.publishDesenSource(JSON.stringify(source), [
    {
      id: catalog.id,
      version: catalog.version,
      target: catalog.target,
      observedPackageDigest: catalog.packageDigest,
      catalog,
    },
  ]);
  if (!published.ok) {
    fail("RUNTIME_PROBE_MISMATCH", "The official Source did not publish for the storage probe.");
  }
  const officialBytes = protocol.canonicalizeJsonBytes(published.bundle);
  const publicationVariant = structuredClone(published.bundle);
  publicationVariant.publication = { pipeline: "m07-t01-publication-variant" };
  const variantBytes = protocol.canonicalizeJsonBytes(publicationVariant);
  const revision = published.bundle.revision;
  const roots = [];
  const makeRoot = async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "desen-m07-t01-proof-"));
    roots.push(root);
    return root;
  };
  try {
    const primaryRoot = await makeRoot();
    const store = await controlPlane.openBundleStore({ rootDirectory: primaryRoot });
    const before = await store.getBundle(revision);
    const stored = await store.putBundle({ revision, bytes: officialBytes });
    const finalPath = path.join(primaryRoot, bundleRelativePath(revision));
    const firstStats = await stat(finalPath, { bigint: true });
    const reopened = await controlPlane.openBundleStore({ rootDirectory: primaryRoot });
    const reopenedRead = await reopened.getBundle(revision);
    const unchanged = await reopened.putBundle({
      revision,
      bytes: new Uint8Array(officialBytes),
    });
    const unchangedStats = await stat(finalPath, { bigint: true });
    const conflict = await reopened.putBundle({ revision, bytes: variantBytes });
    const afterConflictBytes = await readFile(finalPath);

    const firstRead = await reopened.getBundle(revision);
    if (firstRead.status !== "found") {
      fail("RUNTIME_PROBE_MISMATCH", "The first copy-isolation read was missing.");
    }
    firstRead.entry.bytes.fill(0);
    const secondRead = await reopened.getBundle(revision);

    const snapshotRoot = await makeRoot();
    const snapshotStore = await controlPlane.openBundleStore({ rootDirectory: snapshotRoot });
    const backing = new Uint8Array(officialBytes.byteLength + 4);
    backing.set(officialBytes, 2);
    const exactView = backing.subarray(2, backing.byteLength - 2);
    const pendingSnapshot = snapshotStore.putBundle({ revision, bytes: exactView });
    backing.fill(0);
    const snapshotResult = await pendingSnapshot;
    const snapshotRead = await snapshotStore.getBundle(revision);

    const equalRoot = await makeRoot();
    const equalStores = await Promise.all(
      Array.from({ length: 8 }, () => controlPlane.openBundleStore({ rootDirectory: equalRoot })),
    );
    const equalResults = await Promise.all(
      equalStores.map((candidateStore) =>
        candidateStore.putBundle({ revision, bytes: officialBytes }),
      ),
    );

    const divergentRoot = await makeRoot();
    const divergentStores = await Promise.all([
      controlPlane.openBundleStore({ rootDirectory: divergentRoot }),
      controlPlane.openBundleStore({ rootDirectory: divergentRoot }),
    ]);
    const divergentResults = await Promise.all([
      divergentStores[0].putBundle({ revision, bytes: officialBytes }),
      divergentStores[1].putBundle({ revision, bytes: variantBytes }),
    ]);
    const divergentBytes = await readFile(path.join(divergentRoot, bundleRelativePath(revision)));
    const primaryShardEntries = await readdir(path.dirname(finalPath));

    let invalidRevisionCode;
    try {
      await store.getBundle(`sha256:${"A".repeat(64)}`);
    } catch (error) {
      invalidRevisionCode = error?.code;
    }

    return deepFreeze({
      requiredRuntimeExportsPresent:
        typeof controlPlane.BundleStoreError === "function" &&
        typeof controlPlane.openBundleStore === "function",
      privateInternalExportAbsent: !Object.hasOwn(controlPlane, "openBundleStoreInternal"),
      publicModuleKeys: Object.keys(controlPlane).sort(),
      packageSelfReference: selfReference,
      storeKeys: Object.keys(store).sort(),
      storeFrozen: Object.isFrozen(store),
      revision,
      official: {
        bytes: officialBytes.byteLength,
        sha256: sha256(officialBytes),
      },
      publicationVariant: {
        revision: protocol.calculateDesenBundleRevision(publicationVariant),
        bytes: variantBytes.byteLength,
        sha256: sha256(variantBytes),
      },
      relativePath: bundleRelativePath(revision),
      beforeStatus: before.status,
      storedStatus: stored.status,
      reopenedStatus: reopenedRead.status,
      reopenedBytesExact:
        reopenedRead.status === "found" && byteEqual(reopenedRead.entry.bytes, officialBytes),
      unchangedStatus: unchanged.status,
      unchangedInode:
        firstStats.dev === unchangedStats.dev && firstStats.ino === unchangedStats.ino,
      unchangedMtime: firstStats.mtimeNs === unchangedStats.mtimeNs,
      storedMode: Number(firstStats.mode & 0o777n),
      storedLinks: Number(unchangedStats.nlink),
      conflictStatus: conflict.status,
      conflictPreservedWinner: byteEqual(afterConflictBytes, officialBytes),
      freshReadCopies:
        firstRead.status === "found" &&
        secondRead.status === "found" &&
        firstRead.entry.bytes !== secondRead.entry.bytes &&
        byteEqual(secondRead.entry.bytes, officialBytes),
      snapshotStatus: snapshotResult.status,
      snapshotExact:
        snapshotRead.status === "found" && byteEqual(snapshotRead.entry.bytes, officialBytes),
      equalConcurrency: {
        writers: equalResults.length,
        stored: equalResults.filter(({ status }) => status === "stored").length,
        unchanged: equalResults.filter(({ status }) => status === "unchanged").length,
        conflict: equalResults.filter(({ status }) => status === "conflict").length,
      },
      divergentConcurrency: {
        statuses: divergentResults.map(({ status }) => status).sort(),
        completeWinner:
          byteEqual(divergentBytes, officialBytes) || byteEqual(divergentBytes, variantBytes),
      },
      temporaryArtifacts: primaryShardEntries.filter((name) => name.endsWith(".tmp")).length,
      invalidRevisionCode,
      resultsFrozen:
        Object.isFrozen(before) &&
        Object.isFrozen(stored) &&
        Object.isFrozen(reopenedRead) &&
        Object.isFrozen(unchanged) &&
        Object.isFrozen(conflict),
    });
  } finally {
    await Promise.all(roots.map((root) => rm(root, { force: true, recursive: true })));
  }
}

function assertRuntimeReceipt(receipt) {
  const taskTimeExpected = {
    requiredRuntimeExportsPresent: true,
    privateInternalExportAbsent: true,
    publicModuleKeys: ["BundleStoreError", "openBundleStore"],
    packageSelfReference: {
      error: true,
      open: true,
      internal: false,
      keys: ["BundleStoreError", "openBundleStore"],
    },
    storeKeys: ["getBundle", "putBundle"],
    storeFrozen: true,
    revision: EXPECTED_REVISION,
    official: { bytes: EXPECTED_BUNDLE_BYTES, sha256: EXPECTED_BUNDLE_SHA256 },
    publicationVariant: {
      revision: EXPECTED_REVISION,
      bytes: EXPECTED_VARIANT_BYTES,
      sha256: EXPECTED_VARIANT_SHA256,
    },
    relativePath: bundleRelativePath(EXPECTED_REVISION),
    beforeStatus: "missing",
    storedStatus: "stored",
    reopenedStatus: "found",
    reopenedBytesExact: true,
    unchangedStatus: "unchanged",
    unchangedInode: true,
    unchangedMtime: true,
    storedMode: 0o400,
    storedLinks: 1,
    conflictStatus: "conflict",
    conflictPreservedWinner: true,
    freshReadCopies: true,
    snapshotStatus: "stored",
    snapshotExact: true,
    equalConcurrency: { writers: 8, stored: 1, unchanged: 7, conflict: 0 },
    divergentConcurrency: { statuses: ["conflict", "stored"], completeWinner: true },
    temporaryArtifacts: 0,
    invalidRevisionCode: "INVALID_REVISION",
    resultsFrozen: true,
  };
  const approvedM07T02 = {
    ...taskTimeExpected,
    publicModuleKeys: [
      "BUNDLE_INTEGRITY_LIMITS",
      "BundleStoreError",
      "SOURCE_MATERIAL_LIMIT_EXCEEDED_CODE",
      "openBundleStore",
      "verifyBundleStoreEntry",
    ],
    packageSelfReference: {
      ...taskTimeExpected.packageSelfReference,
      keys: [
        "BUNDLE_INTEGRITY_LIMITS",
        "BundleStoreError",
        "SOURCE_MATERIAL_LIMIT_EXCEEDED_CODE",
        "openBundleStore",
        "verifyBundleStoreEntry",
      ],
    },
  };
  const approvedM07T03 = {
    ...taskTimeExpected,
    publicModuleKeys: [
      "BUNDLE_INTEGRITY_LIMITS",
      "BUNDLE_PACKAGE_PREFLIGHT_LIMITS",
      "BundleStoreError",
      "INVALID_BUNDLE_INTEGRITY_AUTHORITY_CODE",
      "INVALID_INSTALLED_PACKAGE_CODE",
      "PACKAGE_PREFLIGHT_INTERNAL_FAILURE_CODE",
      "PACKAGE_PREFLIGHT_LIMIT_EXCEEDED_CODE",
      "SOURCE_MATERIAL_LIMIT_EXCEEDED_CODE",
      "openBundleStore",
      "preflightBundlePackages",
      "verifyBundleStoreEntry",
    ],
    packageSelfReference: {
      ...taskTimeExpected.packageSelfReference,
      keys: [
        "BUNDLE_INTEGRITY_LIMITS",
        "BUNDLE_PACKAGE_PREFLIGHT_LIMITS",
        "BundleStoreError",
        "INVALID_BUNDLE_INTEGRITY_AUTHORITY_CODE",
        "INVALID_INSTALLED_PACKAGE_CODE",
        "PACKAGE_PREFLIGHT_INTERNAL_FAILURE_CODE",
        "PACKAGE_PREFLIGHT_LIMIT_EXCEEDED_CODE",
        "SOURCE_MATERIAL_LIMIT_EXCEEDED_CODE",
        "openBundleStore",
        "preflightBundlePackages",
        "verifyBundleStoreEntry",
      ],
    },
  };
  const approvedM07T04 = {
    ...taskTimeExpected,
    publicModuleKeys: [
      "BUNDLE_INTEGRITY_LIMITS",
      "BUNDLE_PACKAGE_PREFLIGHT_LIMITS",
      "BUNDLE_REFERENCE_PREFLIGHT_LIMITS",
      "BundleStoreError",
      "INVALID_BUNDLE_INTEGRITY_AUTHORITY_CODE",
      "INVALID_BUNDLE_PACKAGE_AUTHORITY_CODE",
      "INVALID_INSTALLED_PACKAGE_CODE",
      "PACKAGE_PREFLIGHT_INTERNAL_FAILURE_CODE",
      "PACKAGE_PREFLIGHT_LIMIT_EXCEEDED_CODE",
      "REFERENCE_PREFLIGHT_INTERNAL_FAILURE_CODE",
      "SOURCE_MATERIAL_LIMIT_EXCEEDED_CODE",
      "openBundleStore",
      "preflightBundlePackages",
      "preflightBundleReferences",
      "verifyBundleStoreEntry",
    ],
    packageSelfReference: {
      ...taskTimeExpected.packageSelfReference,
      keys: [
        "BUNDLE_INTEGRITY_LIMITS",
        "BUNDLE_PACKAGE_PREFLIGHT_LIMITS",
        "BUNDLE_REFERENCE_PREFLIGHT_LIMITS",
        "BundleStoreError",
        "INVALID_BUNDLE_INTEGRITY_AUTHORITY_CODE",
        "INVALID_BUNDLE_PACKAGE_AUTHORITY_CODE",
        "INVALID_INSTALLED_PACKAGE_CODE",
        "PACKAGE_PREFLIGHT_INTERNAL_FAILURE_CODE",
        "PACKAGE_PREFLIGHT_LIMIT_EXCEEDED_CODE",
        "REFERENCE_PREFLIGHT_INTERNAL_FAILURE_CODE",
        "SOURCE_MATERIAL_LIMIT_EXCEEDED_CODE",
        "openBundleStore",
        "preflightBundlePackages",
        "preflightBundleReferences",
        "verifyBundleStoreEntry",
      ],
    },
  };
  const approvedM07T05 = {
    ...taskTimeExpected,
    publicModuleKeys: APPROVED_M07_T05_PUBLIC_RUNTIME_KEYS,
    packageSelfReference: {
      ...taskTimeExpected.packageSelfReference,
      keys: APPROVED_M07_T05_PUBLIC_RUNTIME_KEYS,
    },
  };
  const approvedM07T06 = {
    ...taskTimeExpected,
    publicModuleKeys: APPROVED_M07_T06_PUBLIC_RUNTIME_KEYS,
    packageSelfReference: {
      ...taskTimeExpected.packageSelfReference,
      keys: APPROVED_M07_T06_PUBLIC_RUNTIME_KEYS,
    },
  };
  const approvedM07T07 = {
    ...taskTimeExpected,
    publicModuleKeys: APPROVED_M07_T07_PUBLIC_RUNTIME_KEYS,
    packageSelfReference: {
      ...taskTimeExpected.packageSelfReference,
      keys: APPROVED_M07_T07_PUBLIC_RUNTIME_KEYS,
    },
  };
  const approvedM07T08 = {
    ...taskTimeExpected,
    publicModuleKeys: APPROVED_M07_T08_PUBLIC_RUNTIME_KEYS,
    packageSelfReference: {
      ...taskTimeExpected.packageSelfReference,
      keys: APPROVED_M07_T08_PUBLIC_RUNTIME_KEYS,
    },
  };
  const serialized = JSON.stringify(receipt);
  if (
    serialized !== JSON.stringify(taskTimeExpected) &&
    serialized !== JSON.stringify(approvedM07T02) &&
    serialized !== JSON.stringify(approvedM07T03) &&
    serialized !== JSON.stringify(approvedM07T04) &&
    serialized !== JSON.stringify(approvedM07T05) &&
    serialized !== JSON.stringify(approvedM07T06) &&
    serialized !== JSON.stringify(approvedM07T07) &&
    serialized !== JSON.stringify(approvedM07T08)
  ) {
    fail("RUNTIME_PROBE_MISMATCH", "The immutable Bundle-store runtime receipt drifted.");
  }
  if (serialized === JSON.stringify(taskTimeExpected)) return deepFreeze(receipt);
  return deepFreeze({
    ...receipt,
    publicModuleKeys: taskTimeExpected.publicModuleKeys,
    packageSelfReference: taskTimeExpected.packageSelfReference,
  });
}

export async function buildControlPlaneBundleStoreEvidence(options) {
  const captured = exactOwnDataOptions(
    options,
    new Set(["prerequisiteBytes", "runtimeReceipt", "trackedFileBytes"]),
    "build options",
  );
  await verifyProofReaderCheckpoints();
  const trackedFileBytes = captureByteOverrides(
    captured.trackedFileBytes,
    [...TRACKED_TASK_FILES, APP_PACKAGE, APP_INDEX, ROOT_PACKAGE, CI_SOURCE, TRACEABILITY],
    "trackedFileBytes",
  );
  const prerequisiteBytes = captureByteOverrides(
    captured.prerequisiteBytes,
    CONTROL_PLANE_BUNDLE_STORE_PREREQUISITE_PINS.map(
      ({ path: prerequisitePath }) => prerequisitePath,
    ),
    "prerequisiteBytes",
  );
  const runtimeReceipt = assertRuntimeReceipt(
    captured.runtimeReceipt === undefined
      ? await runControlPlaneBundleStoreProbe()
      : deepFreeze(copyInertJson(captured.runtimeReceipt, "runtimeReceipt")),
  );
  const [
    prerequisites,
    trackedFiles,
    distribution,
    registrations,
    implementation,
    traceRows,
    tests,
  ] = await Promise.all([
    prerequisiteReceipts(prerequisiteBytes),
    trackedFileReceipts(trackedFileBytes),
    distributionReceipts(),
    registrationProjection(trackedFileBytes),
    implementationProjection(trackedFileBytes),
    traceProjection(trackedFileBytes),
    packageTestProjection(trackedFileBytes),
  ]);
  const artifact = deepFreeze({
    schemaVersion: 1,
    profile: "desen.control-plane.bundle-store-proof.v1",
    task: "M07-T01",
    result: "PASS",
    summary:
      "Exact Bundle bytes are persisted once under one revision with no-clobber, retry-safe, fail-closed local POSIX semantics.",
    prerequisites,
    claims: {
      officialBundle: {
        revision: runtimeReceipt.revision,
        canonicalBytes: runtimeReceipt.official.bytes,
        canonicalSha256: runtimeReceipt.official.sha256,
      },
      address: {
        algorithm: "sha256",
        layout: "bundles/sha256/<first-2-hex>/<remaining-62-hex>.bundle",
        officialRelativePath: runtimeReceipt.relativePath,
        callerPathsAccepted: false,
      },
      publicBoundary: {
        requiredRuntimeExports: registrations.publicSourceExports.requiredRuntime,
        requiredTypeExports: registrations.publicSourceExports.requiredTypes,
        storeMethods: runtimeReceipt.storeKeys,
        storeFrozen: runtimeReceipt.storeFrozen,
        testFaultSeamPublic: !runtimeReceipt.privateInternalExportAbsent,
        errorCodes: REQUIRED_ERROR_CODES,
      },
      immutableWrite: {
        commitPrimitive: "same-directory POSIX hard-link with existing-destination failure",
        implementationAuthority: implementation,
        inputSnapshotBeforeAsyncWork: runtimeReceipt.snapshotExact,
        initialWrite: runtimeReceipt.storedStatus,
        reopenedRead: runtimeReceipt.reopenedStatus,
        exactReopenedBytes: runtimeReceipt.reopenedBytesExact,
        byteIdenticalRetry: runtimeReceipt.unchangedStatus,
        retryPreservedInode: runtimeReceipt.unchangedInode,
        retryPreservedMtime: runtimeReceipt.unchangedMtime,
        publicationOnlyChange: runtimeReceipt.conflictStatus,
        conflictPreservedWinner: runtimeReceipt.conflictPreservedWinner,
        storedFileMode: runtimeReceipt.storedMode,
        storedFileLinks: runtimeReceipt.storedLinks,
        temporaryArtifactsAfterSuccess: runtimeReceipt.temporaryArtifacts,
      },
      publicationProjectionBoundary: {
        sameProtocolRevision: runtimeReceipt.publicationVariant.revision,
        differentExactBytes: runtimeReceipt.publicationVariant.bytes,
        differentExactSha256: runtimeReceipt.publicationVariant.sha256,
        outcome: runtimeReceipt.conflictStatus,
      },
      concurrency: {
        equalWriters: runtimeReceipt.equalConcurrency,
        divergentWriters: runtimeReceipt.divergentConcurrency,
      },
      readIsolation: {
        freshCopies: runtimeReceipt.freshReadCopies,
        resultsFrozen: runtimeReceipt.resultsFrozen,
      },
      historicalCompatibility: {
        currentReaderPaths: HISTORICAL_COMPATIBILITY_READERS,
        historicalArtifactsRewritten: false,
      },
      registrations,
      traceRows,
    },
    trackedFiles,
    distribution,
    tests,
    nonclaims: [
      "M07-T02 still owns protocol version, claimed revision, available source digest, and complete Bundle-size verification.",
      "M07-T03 and M07-T04 still own exact package and capability preflight.",
      "M07-T05 still owns editable Sources, mutable channel pointers, and the local transport API.",
      "M07-T06 through M07-T11 still own staging, activation, last-known-good state, crash recovery, fault matrices, and host consumption.",
      "N-010 remains PLANNED for M07-T03 installed-package verification and M12-T12 packed-distribution evidence; N-019 remains PLANNED for M07-T05 channel/control-plane integration.",
      "The POSIX profile assumes an application-owned local root; hostile same-UID or privileged mutation and non-POSIX filesystems are outside this task.",
      "An abrupt pre-link process death may leave an unaddressed temporary; it has no revision authority and maintenance/recovery policy remains later M07 work.",
    ],
    reproduction: [
      "pnpm verify:publisher-invalid-source-matrix",
      "pnpm --filter @desen/control-plane-api... build",
      "pnpm --filter @desen/control-plane-api typecheck",
      "pnpm --filter @desen/control-plane-api test:bundle-store",
      "node scripts/generate-control-plane-bundle-store-proof.mjs",
      "node scripts/verify-control-plane-bundle-store.mjs",
      "node --test tests/control-plane-bundle-store.test.mjs",
    ],
  });
  const artifactText = await format(JSON.stringify(artifact), {
    parser: "json",
    printWidth: 100,
  });
  const artifactBytes = Buffer.from(artifactText, "utf8");
  return Object.freeze({
    artifact,
    artifactBytes,
    artifactSha256: sha256(artifactBytes),
    runtimeReceipt,
  });
}

function proofDocumentHasExactPin(document, artifactSha256) {
  const artifactMentions = [
    ...document.matchAll(new RegExp(ARTIFACT.replaceAll(".", "\\."), "gu")),
  ];
  const hashMentions = [...document.matchAll(new RegExp(`sha256:${artifactSha256}`, "gu"))];
  return (
    artifactMentions.length === 1 &&
    hashMentions.length === 1 &&
    !document.includes("sha256:PENDING")
  );
}

function captureProofDocument(value) {
  if (typeof value !== "string" || Buffer.byteLength(value, "utf8") > MAX_AUTHORITY_BYTES) {
    fail("INVALID_OPTIONS", "proofDocument must be a bounded primitive string.");
  }
  return value;
}

export async function verifyControlPlaneBundleStoreEvidence(options) {
  const captured = exactOwnDataOptions(
    options,
    new Set([
      "artifactBytes",
      "artifactPath",
      "prerequisiteBytes",
      "proofDocument",
      "proofDocumentPath",
      "runtimeReceipt",
      "trackedFileBytes",
    ]),
    "verify options",
  );
  const artifactPath = captureOptionalPath(captured.artifactPath, "artifactPath");
  const proofDocumentPath = captureOptionalPath(captured.proofDocumentPath, "proofDocumentPath");
  const built = await buildControlPlaneBundleStoreEvidence({
    prerequisiteBytes: captured.prerequisiteBytes,
    runtimeReceipt: captured.runtimeReceipt,
    trackedFileBytes: captured.trackedFileBytes,
  });
  const artifactBytes =
    captured.artifactBytes === undefined
      ? await safeReadAbsolute(
          artifactPath === undefined
            ? DEFAULT_CONTROL_PLANE_BUNDLE_STORE_ARTIFACT_PATH
            : artifactPath,
          true,
        )
      : captureBytes(captured.artifactBytes, "artifactBytes");
  if (!byteEqual(artifactBytes, built.artifactBytes)) {
    fail("ARTIFACT_DRIFT", "The committed M07-T01 evidence artifact is not reproducible.");
  }
  const proofDocument =
    captured.proofDocument === undefined
      ? fatalText(
          await safeReadAbsolute(
            proofDocumentPath === undefined ? path.join(ROOT, PROOF_DOCUMENT) : proofDocumentPath,
            true,
          ),
          PROOF_DOCUMENT,
        )
      : captureProofDocument(captured.proofDocument);
  if (!proofDocumentHasExactPin(proofDocument, built.artifactSha256)) {
    fail(
      "PROOF_DOCUMENT_DRIFT",
      "The proof document does not contain one exact final artifact pin.",
    );
  }
  return Object.freeze({
    result: "PASS",
    task: "M07-T01",
    artifactSha256: built.artifactSha256,
    revision: EXPECTED_REVISION,
    canonicalBytes: EXPECTED_BUNDLE_BYTES,
    packageRuntimeCases: built.artifact.tests.packageRuntimeCases,
    rootMutationCases: built.artifact.tests.rootMutationCases,
  });
}

export async function writeControlPlaneBundleStoreEvidence(options) {
  const captured = exactOwnDataOptions(
    options,
    new Set(["artifactPath", "beforeAtomicRename"]),
    "write options",
  );
  const requestedArtifactPath = captureOptionalPath(captured.artifactPath, "artifactPath");
  if (
    captured.beforeAtomicRename !== undefined &&
    typeof captured.beforeAtomicRename !== "function"
  ) {
    fail("INVALID_OPTIONS", "beforeAtomicRename must be a function.");
  }
  const built = await buildControlPlaneBundleStoreEvidence();
  const artifactPath =
    requestedArtifactPath === undefined
      ? DEFAULT_CONTROL_PLANE_BUNDLE_STORE_ARTIFACT_PATH
      : requestedArtifactPath;
  try {
    await writeAtomicProofArtifact({
      artifactPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename: captured.beforeAtomicRename,
    });
  } catch {
    fail(
      "ARTIFACT_WRITE_FAILED",
      "The M07-T01 evidence artifact could not be committed atomically.",
    );
  }
  return Object.freeze({
    artifactPath: path.resolve(artifactPath),
    artifactSha256: built.artifactSha256,
    result: "PASS",
  });
}
