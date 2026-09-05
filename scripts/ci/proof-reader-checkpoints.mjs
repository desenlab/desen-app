import { createHash } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { types as utilTypes } from "node:util";

const SAFE_ARRAY_IS_ARRAY = Array.isArray;
const SAFE_BUFFER_FROM = Buffer.from.bind(Buffer);
const SAFE_JSON_PARSE = JSON.parse;
const SAFE_JSON_STRINGIFY = JSON.stringify;
const SAFE_MAP = Map;
const SAFE_MAP_GET = Map.prototype.get;
const SAFE_MAP_SET = Map.prototype.set;
const SAFE_NUMBER_IS_SAFE_INTEGER = Number.isSafeInteger;
const SAFE_OBJECT_FREEZE = Object.freeze;
const SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR = Object.getOwnPropertyDescriptor;
const SAFE_OBJECT_GET_PROTOTYPE_OF = Object.getPrototypeOf;
const SAFE_OBJECT_PROTOTYPE = Object.prototype;
const SAFE_REFLECT_APPLY = Reflect.apply;
const SAFE_REFLECT_OWN_KEYS = Reflect.ownKeys;
const SAFE_TEXT_DECODER = TextDecoder;
const SAFE_TEXT_DECODER_DECODE = TextDecoder.prototype.decode;
const SAFE_UINT8_ARRAY = Uint8Array;
const SAFE_UINT8_ARRAY_SET = Uint8Array.prototype.set;
const SAFE_UTIL_IS_PROXY = utilTypes.isProxy;
const SAFE_UTIL_IS_UINT8_ARRAY = utilTypes.isUint8Array;
const TYPED_ARRAY_PROTOTYPE = SAFE_OBJECT_GET_PROTOTYPE_OF(Uint8Array.prototype);
const TYPED_ARRAY_BUFFER_GETTER = SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR(
  TYPED_ARRAY_PROTOTYPE,
  "buffer",
)?.get;
const TYPED_ARRAY_LENGTH_GETTER = SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR(
  TYPED_ARRAY_PROTOTYPE,
  "length",
)?.get;

const MODULE_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(MODULE_DIRECTORY, "../..");
const CHECKPOINT_RELATIVE_PATH = "scripts/ci/proof-reader-checkpoints.json";
const PROFILE = "desen.ci.proof-reader-checkpoints.v1";
const GENESIS_PREDECESSOR_SHA256 = "0".repeat(64);
export const PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256 = SAFE_OBJECT_FREEZE([
  "5fbf737da2edbac5cd88ba5897013cbe213c32c5e3344b585014e65fa1a707e8",
  "95a4ebc5261c98569d0e42320aa300f70ec568d1083af38d869b06c82398368c",
  "f92e879b3a72e75abb07af2b2bcfded62e014b99aa0cbe69c64aee12d5379882",
  "ee2d72c3529d9295945d339fb214c41dbbf906ffa6613a7ad6e766ec79c1bcf5",
  "7df3631d509ed7e65c571566a825d6d3cd52d336e1a74512bf3e8e26920749b3",
  "790ad28b6fd441e6d5f40f277a97e8de36a178a9e50fff3e208e6c27588915fd",
  "d50b5ee4fb265f241bac7652b979af0146d530528ba6db8fc98c8fb3225a5ba5",
  "f707fb4c3338aeda79eb6242b645b5e864ce54b1e3955373e8edebcd7e026b8a",
  "94f48160552a6e0de702f71200e56c23d61bab8692d43f3ac1104dcfa681568b",
  "bd3f5b90656f0e41d7f6aa439fdc01889e9ebeada26cd3caf8624c3ce1db7d07",
  "63b8af4da431f0918c7ea9480564750bd12057af2bc83c294d962113ce7c9be8",
  "85c49a0d79346bf2ea92b716f6b43c5d95d164209e3d67af34871a334686e10e",
  "146b04f1c8209be64168afb451ceee2c422da0cdced116f8d08beafe795c533c",
  "3d2dd7a48ee2573d14fb1dbea18ef8b4e3498c6a26f82d76ea589dba3c821078",
  "b75a2580d1d6820392aa74ba5b7671b01baed1740fe2097c2a78e24663b5e4d5",
  "f9e77791148c7f89e586b6eb8964338185a35c11900b69262a159002af0838cd",
  "cc7227fe73f0b03fa56e18c075de5bc8bb2f87c4425aa669fd437ed2cc09730e",
  "4e9ac8adac57d058444bfe2113fbb5dd364cd24d6052ad5f2cd8910a13c22b45",
  "abf161e5a85053e19ce218127aa3f7d3a3ac8480b68b01a4185618ac732393a3",
  "8ba332b059e508dcb93aec4211edf3dcb10fb497d3a743b61ff7ee7e08c8a28e",
  "ce12c066545e21779abf891898aaf0b09ceb1c0c1b51be382a0adabd5f86e939",
  "aef9881c8fc540873f889a09754e5f2c19adc3c19934ba0fcfcf5e6a12b2da9e",
  "3308da059b521c2b5f5fe75d036303221cace805094445f2d64383384831d45d",
  "f7dcc3f74653e739a46434b8fa746f177a9b33cabb874ad9910747dcd46310de",
  "d6bcdf4a26c4b4fd7ea51c83b92f551ff76a98802381284537516d2969b70137",
  "0027f8c18eb1837e9998a5c5a998072e8eebec54e4e8edef974129b910134f5b",
  "bf21a7a600ca9d569d90a8711e4fe857e91beb933d8a3c7289ebfbf0b8a2d87a",
  "2577962251a9e6fa86993bd0e8bda1ed901f850a3b93678486c0445aed035546",
  "ccd4a58913585da39e71ea360714c69e70a94188e0b5643e521d61bf246f1a2b",
  "f5598749a14e7d5eed27cb07e92a83f2bec28b5404f4480600e687d960f04970",
  "181d5a1e0c012f53cfe02640c2f8d0ddf1e300090a3c3742882bb3722175e42d",
  "9be019b902ee17a57c9e2f13270fa67fe26265d06e360719bd1542643be6a424",
  "64da5390046020ed223da42ce8a24d9fcf971c6a5a0a92fc49d368586414c871",
  "f641e8d20d0f5e94cca809d330e3ad5bb0d7ffe0c3ec5defc14e0b5fca63b674",
  "a2e3ef962ed37e0570cdddef64ae8d0eef2fd3f298cc2580f7ee65d8200f6fa3",
  "4f351f2f535b1fc335876160256a42b1d53c7c7f43db08e0b86bf50c389d1e82",
  "e43b48e2d4873b9212d4d0b1bf3e6fb03f56fcc350f8bc9ad65409891995c310",
  "64f7d6519589a5a8cb564af1215c2a12c44297f8ea855910613ea3b361cee6d0",
  "6a186ee56e9a3c8ffd176b712d54a56e7ca3e73990f46d0fe387c9f52bddf6f7",
  "e19eabc91c56c015b7fec7469d096b09a4bf42f5b6edc907c0207dd8c94feb0e",
  "b36679b7ea3ffd0e019d3051b30312dd96b050e10ae7d5d44cf39eb9d30eeb68",
  "40d7c380cec3a7efd04316959a41abda3c8f71c1604f7f2fb892f18ae4cd2fa5",
  "0bbb101332d7af5dcf7260b6df6961837003571f67a6e3a69232e65e19cded58",
  "f0c5f3bfbc30ccf230c5256b3a5672c29ffa0e884129ae210571895bd063812c",
  "340460237dd173995d4d0fa158f0e4c6c54b76d55958757d742a981466fd213f",
  "f09ec643d1b2756174ca47fae99837a68f6656bec0c6933e566d5075713a0f5f",
  "c28ba9a9f274ac0bc3f7dc7ed6de51df35128b109b374b563f5c0239891f58f7",
  "5ecf9e630e2c91cb97a7c85c60e8318fdf694039711a64bf1797e481aca0ff90",
  "45ed64e604400f18b15b3b4ef44bc35634a6c1567b46174329ec36529168272e",
  "6abea41064a05efe363df0f66d1e7d1b4923af08f819acf4c266b092985192a4",
  "42e88946b598566a46237af8d30587fa765d9d58807e864464fc5525fbc64921",
  "c42b0c0fe010b04128a31f26b25a5875e72b7566fa64403d0223b4dbada478a9",
  "48a1457317c593b846cd4750eb309e846c33248824559d27810441584f0144d8",
  "0772221371ffe1a35fe955b8cad34c725d0f9ae933714f81f10b3451214a6638",
  "f1ac24425ca2372410835a6c5721057763792010aaf77ccc78b8d30636333a17",
  "1a2049082f981614c33fb2f1576cfd8d52e9dbd6dbb44f5177d3cf290064c51a",
  "690c73294f6926822fb1535ac60ea40636545890031db72b7a8d63930a27cc57",
  "08396f779b0c1c63cf56d9a9292dcd0a103228c57fe39e1173d95a4a106a92e5",
  "349a292c9137f0f66c5cd58f384aa2175082613500905fdb723f15b246cbd2e8",
  "8f8d69456575c8780fa394f7c46189ac02bb8cecdf24c1a46d81ec0d1ea2c7a1",
  "a80e008bf0f383ab46d097abfec17710131a47656040ec07dc7cc60f965666fb",
  "15ede557b4167cb7bc0cce89b02cf0e9d9f0f7e92c4c5fdc2d799cb3bcf0be55",
  "7245d3334dfaf801692783ed8a500ecc124ed259291ccf433cbc6fab21c76da7",
  "2590f7ebf99b927ccded490e511748e8e5abcf0a49108f67c78061aa021da5f0",
  "fad195aa82484ec15e347e3681ba6be64e6f1e28d5f724bf1fabeb892a7afe14",
  "3bf2c27ca51f8ab6751dd0d026bbbf461ac2c6acea6fcc3088f7d011ae96fb83",
  "9ee6909c0f11ed7149cb9bf6ce1c7943ed99aac2d2c6f9138caea8f5dd2044b7",
  "e685779412ca17b76c78a56ff545bbff5a7fc5efc8bc564247cc49e7c54eeca8",
  "535a09b42d158f9bdf934924f704f3fb278d68da84a3dcbbfa32e38cee375c61",
  "52e71083e7c6f08986480434b5a327b1de6a2d29487b8f8a7ecbef1ffdb4d4e6",
  "c49ca6eacbc08f18ac6cd5bebb3d0a9c3d21a5b8fe420d92364416a210155bda",
  "bf1f0d80b1af2c82ed8f7f5c0c85790052080bb2ecd19145d68a0b10fc8a4ea1",
]);
export const PROOF_READER_CHECKPOINT_REVIEWED_TASK_COUNTS = SAFE_OBJECT_FREEZE([
  6, 8, 9, 10, 11, 11, 13, 14, 14, 14, 14, 14, 14, 14, 15, 16, 17, 17, 17, 17, 18, 18, 19, 20, 25,
  25, 25, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45,
  46, 47, 48, 49, 49, 49, 49, 50, 51, 51, 52, 52, 52, 52, 53, 53, 54, 55, 56, 57, 57, 58, 59,
]);
export const EXPECTED_GENESIS_CHECKPOINT_SHA256 = PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[0];
const MAX_CHECKPOINT_BYTES = 2 * 1024 * 1024;
const MAX_AUTHORITY_BYTES = 16 * 1024 * 1024;
const READ_FLAGS =
  fileConstants.O_RDONLY | (fileConstants.O_NOFOLLOW ?? 0) | (fileConstants.O_NONBLOCK ?? 0);
const DIRECTORY_READ_FLAGS = READ_FLAGS | (fileConstants.O_DIRECTORY ?? 0);
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;

const ROOT_KEYS = SAFE_OBJECT_FREEZE(["schemaVersion", "profile", "headSha256", "checkpoints"]);
const CHECKPOINT_KEYS = SAFE_OBJECT_FREEZE([
  "sequence",
  "predecessorSha256",
  "artifacts",
  "readers",
]);
const ARTIFACT_KEYS = SAFE_OBJECT_FREEZE(["task", "path", "bytes", "sha256"]);
const READER_KEYS = SAFE_OBJECT_FREEZE(["task", "role", "path", "bytes", "sha256"]);
const OPTION_KEYS = SAFE_OBJECT_FREEZE(["beforeAuthorityOpen", "checkpointBytes", "workspaceRoot"]);

function freezeTaskAuthority(task, artifact, proofLibrary, rootTest) {
  return SAFE_OBJECT_FREEZE({
    task,
    artifact: SAFE_OBJECT_FREEZE(artifact),
    readers: SAFE_OBJECT_FREEZE([
      SAFE_OBJECT_FREEZE({ role: "proof-library", path: proofLibrary }),
      SAFE_OBJECT_FREEZE({ role: "root-test", path: rootTest }),
    ]),
  });
}

/**
 * Code-owned task, artifact, reader-path, and reader-role authority.
 *
 * The checkpoint is data only: it cannot invent tasks, choose executable commands, or redirect a
 * reader to another path. A reviewed successor may append a code-owned task generation and update
 * exact reader byte receipts; the genesis generation remains immutable.
 */
export const PROOF_READER_CHECKPOINT_TASK_AUTHORITY = SAFE_OBJECT_FREEZE([
  freezeTaskAuthority(
    "M05-T09",
    {
      path: "docs/proof/artifacts/reference-host-web-0.1.0-source-audit.json",
      bytes: 59_871,
      sha256: "cb54702266260a6e139950808b520bc139d35cebbde03ea93a187d2340a17e89",
    },
    "scripts/lib/reference-host-web-source-audit-proof.mjs",
    "tests/reference-host-web-source-audit.test.mjs",
  ),
  freezeTaskAuthority(
    "M06-T01",
    {
      path: "docs/proof/artifacts/publisher-0.1.0-publish-result.json",
      bytes: 11_756,
      sha256: "aefed86741562bfa0f4bcbe163af50c8471dd6bf5979b7da36d681728536ff63",
    },
    "scripts/lib/publisher-publish-result-proof.mjs",
    "tests/publisher-publish-result.test.mjs",
  ),
  freezeTaskAuthority(
    "M06-T05",
    {
      path: "docs/proof/artifacts/publisher-0.1.0-execution-preflight.json",
      bytes: 21_310,
      sha256: "6127bc2edd417975d4ae311b7934d9f85048928c84b1500ab50af8f42731ca67",
    },
    "scripts/lib/publisher-execution-preflight-proof.mjs",
    "tests/publisher-execution-preflight.test.mjs",
  ),
  freezeTaskAuthority(
    "M06-T08",
    {
      path: "docs/proof/artifacts/publisher-0.1.0-catalog-pinning.json",
      bytes: 10_688,
      sha256: "de37aa35bcdc67e637d323a559f104160479315f56961c962e00bfdc74459c8f",
    },
    "scripts/lib/publisher-catalog-pinning-proof.mjs",
    "tests/publisher-catalog-pinning.test.mjs",
  ),
  freezeTaskAuthority(
    "M06-T09",
    {
      path: "docs/proof/artifacts/publisher-0.1.0-bundle-publication.json",
      bytes: 17_320,
      sha256: "2942aa84066354ee7c27557263a900eb8fd3a149d085ab55c7f880dcfca998df",
    },
    "scripts/lib/publisher-bundle-publication-proof.mjs",
    "tests/publisher-bundle-publication.test.mjs",
  ),
  freezeTaskAuthority(
    "M06-T11",
    {
      path: "docs/proof/artifacts/publisher-0.1.0-invalid-source-matrix.json",
      bytes: 95_467,
      sha256: "fc5904ea6ec4e6495629fc4de8009fee66155938013068b709dd1ff40c1e98d8",
    },
    "scripts/lib/publisher-invalid-source-matrix-proof.mjs",
    "tests/publisher-invalid-source-matrix.test.mjs",
  ),
  freezeTaskAuthority(
    "M06-T10",
    {
      path: "docs/proof/artifacts/publisher-0.1.0-official-golden.json",
      bytes: 13_179,
      sha256: "a2cde9718894b4af506e750d66ea7577d96da4e8a09649f17afe0f94dada17e2",
    },
    "scripts/lib/publisher-official-golden-proof.mjs",
    "tests/publisher-official-golden.test.mjs",
  ),
  freezeTaskAuthority(
    "M07-T01",
    {
      path: "docs/proof/artifacts/control-plane-api-0.1.0-bundle-store.json",
      bytes: 22_396,
      sha256: "698be7d5610d1732ad991bf7e58131e81d2c34ffa888f65ec3c7916334f54795",
    },
    "scripts/lib/control-plane-bundle-store-proof.mjs",
    "tests/control-plane-bundle-store.test.mjs",
  ),
  freezeTaskAuthority(
    "M07-T02",
    {
      path: "docs/proof/artifacts/control-plane-api-0.1.0-bundle-verification.json",
      bytes: 48_642,
      sha256: "db493445e02a2609274dcfde36e1414f04493be0c829280d89f2fe95637d2e7a",
    },
    "scripts/lib/control-plane-bundle-verification-proof.mjs",
    "tests/control-plane-bundle-verification.test.mjs",
  ),
  freezeTaskAuthority(
    "M07-T03",
    {
      path: "docs/proof/artifacts/control-plane-api-0.1.0-package-preflight.json",
      bytes: 62_743,
      sha256: "79ec5f2d285868ecd7e08b4649b160087810b08346d7741796c09d14749f4628",
    },
    "scripts/lib/control-plane-package-preflight-proof.mjs",
    "tests/control-plane-package-preflight.test.mjs",
  ),
  freezeTaskAuthority(
    "M05-T04",
    {
      path: "docs/proof/artifacts/runtime-react-0.1.0-interactions.json",
      bytes: 52_430,
      sha256: "9bb23cf55d5167300ef19aa6f250795f70c9c1bf500a3466d985f65f51f14ab0",
    },
    "scripts/lib/runtime-react-interactions-proof.mjs",
    "tests/runtime-react-interactions.test.mjs",
  ),
  freezeTaskAuthority(
    "M07-T04",
    {
      path: "docs/proof/artifacts/control-plane-api-0.1.0-reference-preflight.json",
      bytes: 34_612,
      sha256: "29555326d51073c50937519d8706049ad17287079cc3ef4dc7060bb3a3225394",
    },
    "scripts/lib/control-plane-reference-preflight-proof.mjs",
    "tests/control-plane-reference-preflight.test.mjs",
  ),
  freezeTaskAuthority(
    "M05-T06",
    {
      path: "docs/proof/artifacts/runtime-react-0.1.0-failure-boundary.json",
      bytes: 9_534,
      sha256: "3192e4af418a370a65d7d815b1bdbf0140fa42914859f1baa76dd68641818723",
    },
    "scripts/lib/runtime-react-failure-boundary-proof.mjs",
    "tests/runtime-react-failure-boundary.test.mjs",
  ),
  freezeTaskAuthority(
    "M07-T05",
    {
      path: "docs/proof/artifacts/control-plane-api-0.1.0-local-api.json",
      bytes: 41_945,
      sha256: "144e8a46b3b41a1f98a022bf4c16dddb9d7415af4e5033322484d4bdd49c55b9",
    },
    "scripts/lib/control-plane-local-api-proof.mjs",
    "tests/control-plane-local-api.test.mjs",
  ),
  freezeTaskAuthority(
    "M07-T06",
    {
      path: "docs/proof/artifacts/control-plane-api-0.1.0-runtime-staging.json",
      bytes: 47_622,
      sha256: "d025da5329d5b56b9b46e7292a08883386a151add5e419edf2a9345425319494",
    },
    "scripts/lib/control-plane-runtime-staging-proof.mjs",
    "tests/control-plane-runtime-staging.test.mjs",
  ),
  freezeTaskAuthority(
    "M07-T07",
    {
      path: "docs/proof/artifacts/control-plane-api-0.1.0-runtime-activation.json",
      bytes: 49_892,
      sha256: "3129a8e40c837a1c49d7fe206de794e0f7f7e130dc7e5e90a012b9e38bf07334",
    },
    "scripts/lib/control-plane-runtime-activation-proof.mjs",
    "tests/control-plane-runtime-activation.test.mjs",
  ),
  freezeTaskAuthority(
    "M07-T08",
    {
      path: "docs/proof/artifacts/control-plane-api-0.1.0-runtime-recovery.json",
      bytes: 44_224,
      sha256: "c65d4f2de1407fffb891b5d3ba2fc8a3a8d4e3f0fb76c8b8f2719be6b310b3f9",
    },
    "scripts/lib/control-plane-runtime-recovery-proof.mjs",
    "tests/control-plane-runtime-recovery.test.mjs",
  ),
  freezeTaskAuthority(
    "M07-T09",
    {
      path: "docs/proof/artifacts/control-plane-api-0.1.0-runtime-fault-injection.json",
      bytes: 64_493,
      sha256: "9d0f764e35f5400fa662874784fba6f6492a39a0e60557fe1a9c7d7eab5407c9",
    },
    "scripts/lib/control-plane-runtime-fault-injection-proof.mjs",
    "tests/control-plane-runtime-fault-injection.test.mjs",
  ),
  freezeTaskAuthority(
    "M07-T10",
    {
      path: "docs/proof/artifacts/control-plane-api-0.1.0-runtime-transition-races.json",
      bytes: 58_059,
      sha256: "f5f10dd422f9e1fc7ca4445b84bf192280e59fb747d8d2ed40357cba3ebc0f39",
    },
    "scripts/lib/control-plane-runtime-transition-races-proof.mjs",
    "tests/control-plane-runtime-transition-races.test.mjs",
  ),
  freezeTaskAuthority(
    "M07-T11",
    {
      path: "docs/proof/artifacts/reference-host-web-0.1.0-channel-consumption.json",
      bytes: 39_307,
      sha256: "48bd9f85bd2da413fc72c1973a33732cc091796f9afc2863ec1eec15054314e0",
    },
    "scripts/lib/reference-host-web-channel-consumption-proof.mjs",
    "tests/reference-host-web-channel-consumption.test.mjs",
  ),
  freezeTaskAuthority(
    "M06-T02",
    {
      path: "docs/proof/artifacts/publisher-0.1.0-catalog-resolution.json",
      bytes: 10_936,
      sha256: "02c5c567c8603470f0f45515dfd1713e528147bcc15ed72daa580807388015f6",
    },
    "scripts/lib/publisher-catalog-resolution-proof.mjs",
    "tests/publisher-catalog-resolution.test.mjs",
  ),
  freezeTaskAuthority(
    "M06-T03",
    {
      path: "docs/proof/artifacts/publisher-0.1.0-source-preflight.json",
      bytes: 12_499,
      sha256: "07537cc034d99dec3cb887805381f58a550de3a0dcb694564ab6a20ac760a387",
    },
    "scripts/lib/publisher-source-preflight-proof.mjs",
    "tests/publisher-source-preflight.test.mjs",
  ),
  freezeTaskAuthority(
    "M06-T04",
    {
      path: "docs/proof/artifacts/publisher-0.1.0-capability-preflight.json",
      bytes: 20_474,
      sha256: "2c55593b69fd5203d3fe2aeaeb8e59dc70cb4a89c4168605c581c17fd1aad56e",
    },
    "scripts/lib/publisher-capability-preflight-proof.mjs",
    "tests/publisher-capability-preflight.test.mjs",
  ),
  freezeTaskAuthority(
    "M06-T06",
    {
      path: "docs/proof/artifacts/publisher-0.1.0-source-preservation.json",
      bytes: 21_723,
      sha256: "261b820b381a0d0c8005a7baf85e33464f2558bfa2a263b94dcb6fd28ddd38ff",
    },
    "scripts/lib/publisher-source-preservation-proof.mjs",
    "tests/publisher-source-preservation.test.mjs",
  ),
  freezeTaskAuthority(
    "M06-T07",
    {
      path: "docs/proof/artifacts/publisher-0.1.0-source-normalization.json",
      bytes: 8_715,
      sha256: "59cb08f75849ae4831644e746a72186227a9774ceb7bcd8281156ccbc6dd085e",
    },
    "scripts/lib/publisher-source-normalization-proof.mjs",
    "tests/publisher-source-normalization.test.mjs",
  ),
  freezeTaskAuthority(
    "M08-T01",
    {
      path: "docs/proof/artifacts/editor-core-0.1.0-source-document.json",
      bytes: 23_270,
      sha256: "aaa3a2447b71361361f471a822bba78e90a3f97f493b23ad3314f51c62ad4025",
    },
    "scripts/lib/editor-core-source-document-proof.mjs",
    "tests/editor-core-source-document.test.mjs",
  ),
  freezeTaskAuthority(
    "M08-T02",
    {
      path: "docs/proof/artifacts/editor-core-0.1.0-stable-id-insert.json",
      bytes: 19_561,
      sha256: "edc7dc1df296056be0c281ed268d07565b0eca2eed7ba7ba63e69ae6b74f6547",
    },
    "scripts/lib/editor-core-stable-id-insert-proof.mjs",
    "tests/editor-core-stable-id-insert.test.mjs",
  ),
  freezeTaskAuthority(
    "M08-T03",
    {
      path: "docs/proof/artifacts/editor-core-0.1.0-structural-edits.json",
      bytes: 22_402,
      sha256: "0d44f67c316c21ff8b612221d01e81c76d3b24783164bb75a772985bbc7def8b",
    },
    "scripts/lib/editor-core-structural-edits-proof.mjs",
    "tests/editor-core-structural-edits.test.mjs",
  ),
  freezeTaskAuthority(
    "M08-T04",
    {
      path: "docs/proof/artifacts/editor-core-0.1.0-content-edits.json",
      bytes: 26_988,
      sha256: "1726d453913c091d30229be02270a0cb4b74bf479f87027c4b9a0da3bb3c7066",
    },
    "scripts/lib/editor-core-content-edits-proof.mjs",
    "tests/editor-core-content-edits.test.mjs",
  ),
  freezeTaskAuthority(
    "M08-T05",
    {
      path: "docs/proof/artifacts/editor-core-0.1.0-state-binding-edits.json",
      bytes: 30_014,
      sha256: "b85e578ac2bc27897517f12d8d4cf867a089cd61ff9fd1ab0664c819977634f8",
    },
    "scripts/lib/editor-core-state-binding-edits-proof.mjs",
    "tests/editor-core-state-binding-edits.test.mjs",
  ),
  freezeTaskAuthority(
    "M08-T06",
    {
      path: "docs/proof/artifacts/editor-core-0.1.0-event-action-edits.json",
      bytes: 31_310,
      sha256: "05a7df153512b8dd0f8289991d12a9d12d79903ed8b3637ef6c8a450ca8a6be7",
    },
    "scripts/lib/editor-core-event-action-edits-proof.mjs",
    "tests/editor-core-event-action-edits.test.mjs",
  ),
  freezeTaskAuthority(
    "M08-T07",
    {
      path: "docs/proof/artifacts/editor-core-0.1.0-authoring-round-trip.json",
      bytes: 62_304,
      sha256: "33b6f81be62076d304c6daaec5d860e7995fa69ceaf34103469b349a347962db",
    },
    "scripts/lib/editor-core-authoring-round-trip-proof.mjs",
    "tests/editor-core-authoring-round-trip.test.mjs",
  ),
  freezeTaskAuthority(
    "M08-T08",
    {
      path: "docs/proof/artifacts/editor-core-0.1.0-persistence.json",
      bytes: 49_785,
      sha256: "51932d4165afff3c40fae6769527e480f6d0ff355f3fbc6d8ae7c6809e50a6fe",
    },
    "scripts/lib/editor-core-persistence-proof.mjs",
    "tests/editor-core-persistence.test.mjs",
  ),
  freezeTaskAuthority(
    "M08-T09",
    {
      path: "docs/proof/artifacts/editor-core-0.1.0-continuous-validation.json",
      bytes: 40_099,
      sha256: "7739b5143685d613a678c6eca5480f27a5a303b176bf2bf4613a4d6917fe7e5a",
    },
    "scripts/lib/editor-core-continuous-validation-proof.mjs",
    "tests/editor-core-continuous-validation.test.mjs",
  ),
  freezeTaskAuthority(
    "M08-T10",
    {
      path: "docs/proof/artifacts/editor-core-0.1.0-terminal-integration.json",
      bytes: 325_549,
      sha256: "5787479d699ab8f53b739e633bf9a88900da00ae4f4c78f96b3e62a73133fa1b",
    },
    "scripts/lib/editor-core-terminal-integration-proof.mjs",
    "tests/editor-core-terminal-integration.test.mjs",
  ),
  freezeTaskAuthority(
    "M09-T01",
    {
      path: "docs/proof/artifacts/desen-app-0.1.0-shell-navigation.json",
      bytes: 12_118,
      sha256: "c3189ff9196f0da91311156893ab569a3c9f9c1ee62631b58286647f36d23220",
    },
    "scripts/lib/desen-app-shell-navigation-proof.mjs",
    "tests/desen-app-shell-navigation.test.mjs",
  ),
  freezeTaskAuthority(
    "M09-T02",
    {
      path: "docs/proof/artifacts/desen-app-0.1.0-catalog-panel-layer-tree.json",
      bytes: 25_375,
      sha256: "85a310feaf1a0cc3656055cd3a76eeb02e02a278c21d22167853b53c03f1ee61",
    },
    "scripts/lib/desen-app-catalog-panel-layer-tree-proof.mjs",
    "tests/desen-app-catalog-panel-layer-tree.test.mjs",
  ),
  freezeTaskAuthority(
    "M09-T03",
    {
      path: "docs/proof/artifacts/desen-app-0.1.0-real-adapter-canvas.json",
      bytes: 73_111,
      sha256: "8f89b237c20d80e83d96f17c31146d251c026977a4fff1ab1d0822e489c63151",
    },
    "scripts/lib/desen-app-real-adapter-canvas-proof.mjs",
    "tests/desen-app-real-adapter-canvas.test.mjs",
  ),
  freezeTaskAuthority(
    "M09-T04",
    {
      path: "docs/proof/artifacts/desen-app-0.1.0-selection-overlay.json",
      bytes: 11_997,
      sha256: "9a3805545ea49820c744fc07b9c3b0c2919b3e2fb524f9855df1cec9058901b1",
    },
    "scripts/lib/desen-app-selection-overlay-proof.mjs",
    "tests/desen-app-selection-overlay.test.mjs",
  ),
  freezeTaskAuthority(
    "M09-T05",
    {
      path: "docs/proof/artifacts/desen-app-0.1.0-schema-inspector.json",
      bytes: 22_998,
      sha256: "473ab3248ed7b7b4de0e558df47159a74c28c134b46569aa91130745fd69660b",
    },
    "scripts/lib/desen-app-schema-inspector-proof.mjs",
    "tests/desen-app-schema-inspector.test.mjs",
  ),
  freezeTaskAuthority(
    "M09-T06",
    {
      path: "docs/proof/artifacts/desen-app-0.1.0-structured-inspector.json",
      bytes: 26_133,
      sha256: "6ea4eb3f51fdfc39eeca676d7ebafb145d66a9efdfa03af9c33a7aa39aa6aaec",
    },
    "scripts/lib/desen-app-structured-inspector-proof.mjs",
    "tests/desen-app-structured-inspector.test.mjs",
  ),
  freezeTaskAuthority(
    "M09-T07",
    {
      path: "docs/proof/artifacts/desen-app-0.1.0-named-slot-authoring.json",
      bytes: 24_830,
      sha256: "daae817af45d8ead7052fd84df4edefd7d29cdd9ebe9cc1baea5b22b27dae90f",
    },
    "scripts/lib/desen-app-named-slot-authoring-proof.mjs",
    "tests/desen-app-named-slot-authoring.test.mjs",
  ),
  freezeTaskAuthority(
    "M09-T08",
    {
      path: "docs/proof/artifacts/desen-app-0.1.0-state-binding-editor.json",
      bytes: 28_766,
      sha256: "b7298375cba4b82258d1c293ecb66c3ae6641408ae9f5753da121ac44fcf601a",
    },
    "scripts/lib/desen-app-state-binding-editor-proof.mjs",
    "tests/desen-app-state-binding-editor.test.mjs",
  ),
  freezeTaskAuthority(
    "M09-T09",
    {
      path: "docs/proof/artifacts/desen-app-0.1.0-event-action-editor.json",
      bytes: 23_812,
      sha256: "0060ef39273ea36666f1701d5d3fa0f1610b95f40d88304ba980dcdc73cb29ab",
    },
    "scripts/lib/desen-app-event-action-editor-proof.mjs",
    "tests/desen-app-event-action-editor.test.mjs",
  ),
  freezeTaskAuthority(
    "M09-T10",
    {
      path: "docs/proof/artifacts/desen-app-0.1.0-design-run-modes.json",
      bytes: 17_900,
      sha256: "bc5b7ffef0c39737882072f9340bcade86f084db8e7923fcb03aa7364d077334",
    },
    "scripts/lib/desen-app-design-run-modes-proof.mjs",
    "tests/desen-app-design-run-modes.test.mjs",
  ),
  freezeTaskAuthority(
    "M09-T11",
    {
      path: "docs/proof/artifacts/desen-app-0.1.0-fixtures-scenarios-fidelity.json",
      bytes: 29_407,
      sha256: "3f08980e687d48ba267f78c7d4dd1ae1eb59db5cc6bb3401d88705ee0416cc9d",
    },
    "scripts/lib/desen-app-fixtures-scenarios-fidelity-proof.mjs",
    "tests/desen-app-fixtures-scenarios-fidelity.test.mjs",
  ),
  freezeTaskAuthority(
    "M09-T12",
    {
      path: "docs/proof/artifacts/desen-app-0.1.0-source-persistence.json",
      bytes: 27_053,
      sha256: "717d0ddada008edb34909d5defcc4c28e95b36f6dfc0b1abb4d09d9775a6b734",
    },
    "scripts/lib/desen-app-source-persistence-proof.mjs",
    "tests/desen-app-source-persistence.test.mjs",
  ),
  freezeTaskAuthority(
    "M09-T13",
    {
      path: "docs/proof/artifacts/desen-app-0.1.0-node-linked-diagnostics.json",
      bytes: 29_208,
      sha256: "8ac4d81d9097e188860757c637673ff406ba9f82b8cd8f379f184ef85138e972",
    },
    "scripts/lib/desen-app-node-linked-diagnostics-proof.mjs",
    "tests/desen-app-node-linked-diagnostics.test.mjs",
  ),
  freezeTaskAuthority(
    "M09-T14",
    {
      path: "docs/proof/artifacts/desen-app-0.1.0-publish-activation.json",
      bytes: 24_763,
      sha256: "6bd2db0ca490f1d0046f145da7c4b7e9b4b25ec0f8295a159529a0e66534b23b",
    },
    "scripts/lib/desen-app-publish-activation-proof.mjs",
    "tests/desen-app-publish-activation.test.mjs",
  ),
  freezeTaskAuthority(
    "M10-T01",
    {
      path: "docs/proof/artifacts/desen-app-0.1.0-empty-project-browser-e2e.json",
      bytes: 10_259,
      sha256: "959dde63ef28bc7fd25967a9193e39e082c9178bc12f40b83036c5dd6042df77",
    },
    "scripts/lib/desen-app-empty-project-browser-e2e-proof.mjs",
    "tests/desen-app-empty-project-browser-e2e.test.mjs",
  ),
  freezeTaskAuthority(
    "M10-T01-COMPAT",
    {
      path: "docs/proof/artifacts/desen-app-0.1.0-browser-e2e-workspace-compatibility.json",
      bytes: 16_025,
      sha256: "e90378e191fddea1264c8c056e2ff7a72fdfd945d1b1113465c12ddbffb1888d",
    },
    "scripts/lib/desen-app-browser-e2e-workspace-compatibility-proof.mjs",
    "tests/desen-app-browser-e2e-workspace-compatibility.test.mjs",
  ),
  freezeTaskAuthority(
    "M10-T01A",
    {
      path: "docs/proof/artifacts/desen-app-0.1.0-user-created-blank-project.json",
      bytes: 20_173,
      sha256: "6277b82f22bf26e92b670164f2f1e2b7f861409f5b37585fb5053d88c4dadd2e",
    },
    "scripts/lib/desen-app-user-created-blank-project-proof.mjs",
    "tests/desen-app-user-created-blank-project.test.mjs",
  ),
  freezeTaskAuthority(
    "M10-T01B",
    {
      path: "docs/proof/artifacts/desen-app-0.1.0-visual-behavior-authoring.json",
      bytes: 10_962,
      sha256: "cd7366014a0cb6f056fa78392f81ef7cb4b5be2f523b95e5984c704be3caf0e8",
    },
    "scripts/lib/desen-app-visual-behavior-authoring-proof.mjs",
    "tests/desen-app-visual-behavior-authoring.test.mjs",
  ),
  freezeTaskAuthority(
    "M10-T01C",
    {
      path: "docs/proof/artifacts/desen-app-0.1.0-evergreen-product-composition.json",
      bytes: 19_299,
      sha256: "779434ca834b8d770c726d905408f0a3d0a7145abbc6eaf2b81f1e77466b46ac",
    },
    "scripts/lib/desen-app-evergreen-product-composition-proof.mjs",
    "tests/desen-app-evergreen-product-composition.test.mjs",
  ),
  freezeTaskAuthority(
    "M10-T02",
    {
      path: "docs/proof/artifacts/desen-app-0.1.0-input-pending-fixture.json",
      bytes: 14_261,
      sha256: "161202698b013775cbc89625ecea1f6894e9abcd927fb2eb660dff71652ba43d",
    },
    "scripts/lib/desen-app-input-pending-fixture-proof.mjs",
    "tests/desen-app-input-pending-fixture.test.mjs",
  ),
  freezeTaskAuthority(
    "M10-T03",
    {
      path: "docs/proof/artifacts/desen-app-0.1.0-failure-fixture.json",
      bytes: 16_868,
      sha256: "bde909f8dbc4837c70627bab454d3dc5a936bd0abb6d70ec22b9cffbdb0e6a20",
    },
    "scripts/lib/desen-app-failure-fixture-proof.mjs",
    "tests/desen-app-failure-fixture.test.mjs",
  ),
  freezeTaskAuthority(
    "M10-T04",
    {
      path: "docs/proof/artifacts/desen-app-0.1.0-success-host-operation.json",
      bytes: 22_456,
      sha256: "d9d841af06ec9efc51c3f1c74079f0aa4d5e1c7e996f3b97df7e277e4b1f8423",
    },
    "scripts/lib/desen-app-success-host-operation-proof.mjs",
    "tests/desen-app-success-host-operation.test.mjs",
  ),
  freezeTaskAuthority(
    "AR-01",
    {
      path: "docs/proof/artifacts/historical-archive-redaction.json",
      bytes: 33_070,
      sha256: "d0e40a1cabfa241a3232bde4c169836c18ebf6c76bebe3e5733ca02771fd5dcc",
    },
    "scripts/lib/historical-archive-redaction-proof.mjs",
    "tests/historical-archive-redaction.test.mjs",
  ),
  freezeTaskAuthority(
    "M10-T05",
    {
      path: "docs/proof/artifacts/desen-app-0.1.0-published-host-update.json",
      bytes: 189_123,
      sha256: "80c0b815a813ef462233b48a7fffe7c4d0bbf391aefc68eb9a6174da6bd84bd3",
    },
    "scripts/lib/desen-app-published-host-update-proof.mjs",
    "tests/desen-app-published-host-update.test.mjs",
  ),
]);

function taskAuthorityForCheckpointSequence(sequence) {
  const reviewedTaskCount = PROOF_READER_CHECKPOINT_REVIEWED_TASK_COUNTS[sequence - 1];
  const taskCount = reviewedTaskCount ?? PROOF_READER_CHECKPOINT_TASK_AUTHORITY.length;
  if (
    !SAFE_NUMBER_IS_SAFE_INTEGER(taskCount) ||
    taskCount <= 0 ||
    taskCount > PROOF_READER_CHECKPOINT_TASK_AUTHORITY.length
  ) {
    fail(
      "PROOF_READER_CHECKPOINT_SCHEMA_INVALID",
      "Code-owned checkpoint task-generation authority is inconsistent.",
      { sequence, taskCount },
    );
  }
  const authority = [];
  let index = 0;
  while (index < taskCount) {
    authority[index] = PROOF_READER_CHECKPOINT_TASK_AUTHORITY[index];
    index += 1;
  }
  return SAFE_OBJECT_FREEZE(authority);
}

export const DEFAULT_PROOF_READER_CHECKPOINT_PATH = path.join(
  WORKSPACE_ROOT,
  CHECKPOINT_RELATIVE_PATH,
);

export class ProofReaderCheckpointError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ProofReaderCheckpointError";
    this.code = code;
    this.details = SAFE_OBJECT_FREEZE({ ...details });
  }
}

function fail(code, message, details = {}) {
  throw new ProofReaderCheckpointError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function arrayContains(values, candidate) {
  let index = 0;
  while (index < values.length) {
    if (values[index] === candidate) return true;
    index += 1;
  }
  return false;
}

function exactOwnDataRecord(value, expectedKeys, label) {
  if (
    typeof value !== "object" ||
    value === null ||
    SAFE_UTIL_IS_PROXY(value) ||
    SAFE_ARRAY_IS_ARRAY(value) ||
    SAFE_OBJECT_GET_PROTOTYPE_OF(value) !== SAFE_OBJECT_PROTOTYPE
  ) {
    fail(
      "PROOF_READER_CHECKPOINT_SCHEMA_INVALID",
      `${label} must be one exact ordinary own-data record.`,
    );
  }
  const keys = SAFE_REFLECT_OWN_KEYS(value);
  if (keys.length !== expectedKeys.length) {
    fail("PROOF_READER_CHECKPOINT_SCHEMA_INVALID", `${label} has an unexpected field count.`, {
      expectedKeys,
      actualKeys: keys,
    });
  }
  let keyIndex = 0;
  while (keyIndex < keys.length) {
    const key = keys[keyIndex];
    if (typeof key !== "string" || !arrayContains(expectedKeys, key)) {
      fail("PROOF_READER_CHECKPOINT_SCHEMA_INVALID", `${label} contains an unsupported field.`, {
        key: typeof key === "string" ? key : String(key),
      });
    }
    const descriptor = SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR(value, key);
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      fail(
        "PROOF_READER_CHECKPOINT_SCHEMA_INVALID",
        `${label} must contain only enumerable own data.`,
        { key },
      );
    }
    keyIndex += 1;
  }
  return value;
}

function exactAllowedOwnDataRecord(value, allowedKeys, label) {
  if (
    typeof value !== "object" ||
    value === null ||
    SAFE_UTIL_IS_PROXY(value) ||
    SAFE_ARRAY_IS_ARRAY(value) ||
    SAFE_OBJECT_GET_PROTOTYPE_OF(value) !== SAFE_OBJECT_PROTOTYPE
  ) {
    fail(
      "PROOF_READER_CHECKPOINT_OPTIONS_INVALID",
      `${label} must be one ordinary own-data record.`,
    );
  }
  const keys = SAFE_REFLECT_OWN_KEYS(value);
  if (keys.length > allowedKeys.length) {
    fail("PROOF_READER_CHECKPOINT_OPTIONS_INVALID", `${label} contains too many fields.`);
  }
  let keyIndex = 0;
  while (keyIndex < keys.length) {
    const key = keys[keyIndex];
    const descriptor = SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR(value, key);
    if (
      typeof key !== "string" ||
      !arrayContains(allowedKeys, key) ||
      descriptor === undefined ||
      !descriptor.enumerable ||
      !("value" in descriptor)
    ) {
      fail(
        "PROOF_READER_CHECKPOINT_OPTIONS_INVALID",
        `${label} contains an unsupported or active field.`,
        { key: typeof key === "string" ? key : String(key) },
      );
    }
    keyIndex += 1;
  }
  return value;
}

function exactDenseArray(value, label, maximumLength) {
  if (
    typeof value !== "object" ||
    value === null ||
    SAFE_UTIL_IS_PROXY(value) ||
    !SAFE_ARRAY_IS_ARRAY(value) ||
    SAFE_OBJECT_GET_PROTOTYPE_OF(value) !== Array.prototype ||
    !SAFE_NUMBER_IS_SAFE_INTEGER(value.length) ||
    value.length < 0 ||
    value.length > maximumLength
  ) {
    fail("PROOF_READER_CHECKPOINT_SCHEMA_INVALID", `${label} must be one bounded dense array.`);
  }
  const keys = SAFE_REFLECT_OWN_KEYS(value);
  if (keys.length !== value.length + 1 || !arrayContains(keys, "length")) {
    fail(
      "PROOF_READER_CHECKPOINT_SCHEMA_INVALID",
      `${label} must contain only its exact dense indexes.`,
    );
  }
  let index = 0;
  while (index < value.length) {
    const descriptor = SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR(value, String(index));
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      fail(
        "PROOF_READER_CHECKPOINT_SCHEMA_INVALID",
        `${label} contains a sparse or accessor-backed entry.`,
        { index },
      );
    }
    index += 1;
  }
  return value;
}

function assertSha256(value, label) {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) {
    fail(
      "PROOF_READER_CHECKPOINT_SCHEMA_INVALID",
      `${label} must be one lowercase SHA-256 digest.`,
    );
  }
  return value;
}

function assertPositiveBytes(value, label) {
  if (!SAFE_NUMBER_IS_SAFE_INTEGER(value) || value <= 0 || value > MAX_AUTHORITY_BYTES) {
    fail(
      "PROOF_READER_CHECKPOINT_SCHEMA_INVALID",
      `${label} must be one positive bounded byte count.`,
    );
  }
  return value;
}

function normalizeArtifact(rawArtifact, expected, index) {
  const artifact = exactOwnDataRecord(rawArtifact, ARTIFACT_KEYS, `artifact ${index}`);
  if (
    artifact.task !== expected.task ||
    artifact.path !== expected.artifact.path ||
    artifact.bytes !== expected.artifact.bytes ||
    artifact.sha256 !== expected.artifact.sha256
  ) {
    fail(
      "PROOF_READER_CHECKPOINT_ARTIFACT_DRIFT",
      "A frozen artifact receipt differs from its code-owned task authority.",
      {
        index,
        expectedTask: expected.task,
        expectedPath: expected.artifact.path,
        actualTask: artifact.task,
        actualPath: artifact.path,
      },
    );
  }
  assertPositiveBytes(artifact.bytes, `artifact ${index} bytes`);
  assertSha256(artifact.sha256, `artifact ${index} SHA-256`);
  return {
    task: artifact.task,
    path: artifact.path,
    bytes: artifact.bytes,
    sha256: artifact.sha256,
  };
}

function readerAuthorityAt(index, taskAuthority) {
  const taskIndex = Math.floor(index / 2);
  const roleIndex = index % 2;
  const task = taskAuthority[taskIndex];
  const reader = task?.readers[roleIndex];
  return task === undefined || reader === undefined
    ? undefined
    : { task: task.task, role: reader.role, path: reader.path };
}

function normalizeReader(rawReader, expected, index) {
  const reader = exactOwnDataRecord(rawReader, READER_KEYS, `reader ${index}`);
  if (
    expected === undefined ||
    reader.task !== expected.task ||
    reader.role !== expected.role ||
    reader.path !== expected.path
  ) {
    fail(
      "PROOF_READER_CHECKPOINT_READER_DRIFT",
      "A reader task, role, path, or fixed order differs from code-owned authority.",
      {
        index,
        expectedTask: expected?.task,
        expectedRole: expected?.role,
        expectedPath: expected?.path,
        actualTask: reader.task,
        actualRole: reader.role,
        actualPath: reader.path,
      },
    );
  }
  assertPositiveBytes(reader.bytes, `reader ${index} bytes`);
  assertSha256(reader.sha256, `reader ${index} SHA-256`);
  return {
    task: reader.task,
    role: reader.role,
    path: reader.path,
    bytes: reader.bytes,
    sha256: reader.sha256,
  };
}

function assertUniqueArtifactAuthority(artifacts) {
  const taskIndexes = new SAFE_MAP();
  const pathIndexes = new SAFE_MAP();
  let duplicate;
  let index = artifacts.length;
  // Retain the original leftmost-pair error precedence without comparing every pair.
  while (index > 0) {
    index -= 1;
    const artifact = artifacts[index];
    const nextTask = SAFE_REFLECT_APPLY(SAFE_MAP_GET, taskIndexes, [artifact.task]);
    const nextPath = SAFE_REFLECT_APPLY(SAFE_MAP_GET, pathIndexes, [artifact.path]);
    if (nextTask !== undefined && (nextPath === undefined || nextTask <= nextPath)) {
      duplicate = {
        message: "Artifact tasks must be unique inside one checkpoint.",
        details: { task: artifact.task },
      };
    } else if (nextPath !== undefined) {
      duplicate = {
        message: "Artifact paths must be unique inside one checkpoint.",
        details: { path: artifact.path },
      };
    }
    SAFE_REFLECT_APPLY(SAFE_MAP_SET, taskIndexes, [artifact.task, index]);
    SAFE_REFLECT_APPLY(SAFE_MAP_SET, pathIndexes, [artifact.path, index]);
  }
  if (duplicate !== undefined) {
    fail("PROOF_READER_CHECKPOINT_SCHEMA_INVALID", duplicate.message, duplicate.details);
  }
}

function assertUniqueReaderAuthority(readers) {
  const pathIndexes = new SAFE_MAP();
  const identityIndexes = new SAFE_MAP();
  let duplicate;
  let index = readers.length;
  while (index > 0) {
    index -= 1;
    const reader = readers[index];
    // Both fields have already matched code-owned values, which cannot contain this separator.
    const identity = `${reader.task}\0${reader.role}`;
    const nextPath = SAFE_REFLECT_APPLY(SAFE_MAP_GET, pathIndexes, [reader.path]);
    const nextIdentity = SAFE_REFLECT_APPLY(SAFE_MAP_GET, identityIndexes, [identity]);
    if (nextPath !== undefined && (nextIdentity === undefined || nextPath <= nextIdentity)) {
      duplicate = {
        message: "Reader paths must be unique inside one checkpoint.",
        details: { path: reader.path },
      };
    } else if (nextIdentity !== undefined) {
      duplicate = {
        message: "Reader task and role authority must be unique inside one checkpoint.",
        details: { task: reader.task, role: reader.role },
      };
    }
    SAFE_REFLECT_APPLY(SAFE_MAP_SET, pathIndexes, [reader.path, index]);
    SAFE_REFLECT_APPLY(SAFE_MAP_SET, identityIndexes, [identity, index]);
  }
  if (duplicate !== undefined) {
    fail("PROOF_READER_CHECKPOINT_SCHEMA_INVALID", duplicate.message, duplicate.details);
  }
}

function normalizeCheckpoint(rawCheckpoint) {
  const checkpoint = exactOwnDataRecord(rawCheckpoint, CHECKPOINT_KEYS, "checkpoint");
  if (!SAFE_NUMBER_IS_SAFE_INTEGER(checkpoint.sequence) || checkpoint.sequence <= 0) {
    fail(
      "PROOF_READER_CHECKPOINT_SCHEMA_INVALID",
      "Checkpoint sequence must be one positive safe integer.",
    );
  }
  assertSha256(checkpoint.predecessorSha256, "checkpoint predecessor");
  const taskAuthority = taskAuthorityForCheckpointSequence(checkpoint.sequence);

  const rawArtifacts = exactDenseArray(
    checkpoint.artifacts,
    "checkpoint artifacts",
    taskAuthority.length,
  );
  if (rawArtifacts.length !== taskAuthority.length) {
    fail(
      "PROOF_READER_CHECKPOINT_SCHEMA_INVALID",
      "A checkpoint must contain its exact code-owned frozen-artifact generation.",
      { expected: taskAuthority.length, actual: rawArtifacts.length },
    );
  }
  const artifacts = [];
  let artifactIndex = 0;
  while (artifactIndex < rawArtifacts.length) {
    artifacts[artifactIndex] = normalizeArtifact(
      rawArtifacts[artifactIndex],
      taskAuthority[artifactIndex],
      artifactIndex,
    );
    artifactIndex += 1;
  }
  assertUniqueArtifactAuthority(artifacts);

  const expectedReaderCount = taskAuthority.length * 2;
  const rawReaders = exactDenseArray(checkpoint.readers, "checkpoint readers", expectedReaderCount);
  if (rawReaders.length !== expectedReaderCount) {
    fail(
      "PROOF_READER_CHECKPOINT_SCHEMA_INVALID",
      "A checkpoint must contain its exact code-owned current-reader generation.",
      { expected: expectedReaderCount, actual: rawReaders.length },
    );
  }
  const readers = [];
  let readerIndex = 0;
  while (readerIndex < rawReaders.length) {
    readers[readerIndex] = normalizeReader(
      rawReaders[readerIndex],
      readerAuthorityAt(readerIndex, taskAuthority),
      readerIndex,
    );
    readerIndex += 1;
  }
  assertUniqueReaderAuthority(readers);

  return {
    sequence: checkpoint.sequence,
    predecessorSha256: checkpoint.predecessorSha256,
    artifacts,
    readers,
  };
}

function checkpointDigestPayload(checkpoint) {
  return {
    schemaVersion: 1,
    profile: PROFILE,
    checkpoint,
  };
}

// Only this invocation's privately normalized records reach this helper. Public raw inputs
// still pass normalizeCheckpoint; no previous call's validation or filesystem result is reused.
function normalizedCheckpointSha256(checkpoint) {
  return sha256(SAFE_BUFFER_FROM(SAFE_JSON_STRINGIFY(checkpointDigestPayload(checkpoint)), "utf8"));
}

/**
 * Calculates the chain digest for one structurally valid checkpoint.
 *
 * The digest excludes the root `headSha256`, includes the predecessor, and uses compact JSON over
 * an exact key-ordered normalized record. It is therefore deterministic and non-self-referential.
 */
export function calculateProofReaderCheckpointSha256(rawCheckpoint) {
  const checkpoint = normalizeCheckpoint(rawCheckpoint);
  return normalizedCheckpointSha256(checkpoint);
}

function assertReaderHistoryIsAppendOnly(history, checkpoint, checkpointIndex) {
  if (checkpointIndex === 0) {
    let readerIndex = 0;
    while (readerIndex < checkpoint.readers.length) {
      history[readerIndex] = [
        `${checkpoint.readers[readerIndex].bytes}:${checkpoint.readers[readerIndex].sha256}`,
      ];
      readerIndex += 1;
    }
    return;
  }

  let changed = false;
  let readerIndex = 0;
  while (readerIndex < checkpoint.readers.length) {
    const reader = checkpoint.readers[readerIndex];
    const previous = history[readerIndex];
    const receipt = `${reader.bytes}:${reader.sha256}`;
    if (previous === undefined) {
      history[readerIndex] = [receipt];
      changed = true;
      readerIndex += 1;
      continue;
    }
    const latest = previous[previous.length - 1];
    if (receipt === latest) {
      readerIndex += 1;
      continue;
    }
    if (arrayContains(previous, receipt)) {
      fail(
        "PROOF_READER_CHECKPOINT_CHAIN_DRIFT",
        "A successor checkpoint rolls back to a prior reader receipt.",
        { checkpoint: checkpoint.sequence, path: reader.path },
      );
    }
    previous[previous.length] = receipt;
    changed = true;
    readerIndex += 1;
  }
  if (!changed) {
    fail(
      "PROOF_READER_CHECKPOINT_CHAIN_DRIFT",
      "A successor checkpoint must advance at least one reader receipt.",
      { checkpoint: checkpoint.sequence },
    );
  }
}

function normalizeManifest(rawManifest) {
  const manifest = exactOwnDataRecord(rawManifest, ROOT_KEYS, "checkpoint manifest");
  if (manifest.schemaVersion !== 1 || manifest.profile !== PROFILE) {
    fail(
      "PROOF_READER_CHECKPOINT_SCHEMA_INVALID",
      "Checkpoint schema version or profile drifted.",
      { schemaVersion: manifest.schemaVersion, profile: manifest.profile },
    );
  }
  assertSha256(manifest.headSha256, "manifest head");
  if (
    PROOF_READER_CHECKPOINT_REVIEWED_TASK_COUNTS.length !==
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256.length
  ) {
    fail(
      "PROOF_READER_CHECKPOINT_HISTORY_UNANCHORED",
      "Every reviewed checkpoint digest must pin one immutable task-generation size.",
    );
  }
  const rawCheckpoints = exactDenseArray(manifest.checkpoints, "manifest checkpoints", 1_024);
  if (rawCheckpoints.length === 0) {
    fail(
      "PROOF_READER_CHECKPOINT_SCHEMA_INVALID",
      "The checkpoint chain must contain one genesis checkpoint.",
    );
  }

  const checkpoints = [];
  const checkpointDigests = [];
  const history = [];
  let predecessor = GENESIS_PREDECESSOR_SHA256;
  let checkpointIndex = 0;
  while (checkpointIndex < rawCheckpoints.length) {
    const checkpoint = normalizeCheckpoint(rawCheckpoints[checkpointIndex]);
    if (
      checkpoint.sequence !== checkpointIndex + 1 ||
      checkpoint.predecessorSha256 !== predecessor
    ) {
      fail(
        "PROOF_READER_CHECKPOINT_CHAIN_DRIFT",
        "Checkpoint sequence or predecessor digest breaks the append-only chain.",
        {
          index: checkpointIndex,
          expectedSequence: checkpointIndex + 1,
          actualSequence: checkpoint.sequence,
          expectedPredecessorSha256: predecessor,
          actualPredecessorSha256: checkpoint.predecessorSha256,
        },
      );
    }
    assertReaderHistoryIsAppendOnly(history, checkpoint, checkpointIndex);
    predecessor = normalizedCheckpointSha256(checkpoint);
    checkpoints[checkpointIndex] = checkpoint;
    checkpointDigests[checkpointIndex] = predecessor;
    checkpointIndex += 1;
  }
  if (manifest.headSha256 !== predecessor) {
    fail(
      "PROOF_READER_CHECKPOINT_CHAIN_DRIFT",
      "Manifest head does not equal the final checkpoint digest.",
      { expectedHeadSha256: predecessor, actualHeadSha256: manifest.headSha256 },
    );
  }
  return {
    manifest: {
      schemaVersion: 1,
      profile: PROFILE,
      headSha256: predecessor,
      checkpoints,
    },
    checkpointDigests,
  };
}

function deepFreezeJson(value) {
  if (value !== null && typeof value === "object") {
    if (SAFE_ARRAY_IS_ARRAY(value)) {
      let index = 0;
      while (index < value.length) {
        deepFreezeJson(value[index]);
        index += 1;
      }
    } else {
      const keys = SAFE_REFLECT_OWN_KEYS(value);
      let index = 0;
      while (index < keys.length) {
        deepFreezeJson(value[keys[index]]);
        index += 1;
      }
    }
    SAFE_OBJECT_FREEZE(value);
  }
  return value;
}

function captureInertBytes(value, label, maximumBytes) {
  if (
    typeof value !== "object" ||
    value === null ||
    SAFE_UTIL_IS_PROXY(value) ||
    !SAFE_UTIL_IS_UINT8_ARRAY(value) ||
    (SAFE_OBJECT_GET_PROTOTYPE_OF(value) !== Uint8Array.prototype &&
      SAFE_OBJECT_GET_PROTOTYPE_OF(value) !== Buffer.prototype) ||
    TYPED_ARRAY_BUFFER_GETTER === undefined ||
    TYPED_ARRAY_LENGTH_GETTER === undefined
  ) {
    fail(
      "PROOF_READER_CHECKPOINT_OPTIONS_INVALID",
      `${label} must be exact inert Buffer or Uint8Array bytes.`,
    );
  }
  let byteLength;
  let buffer;
  try {
    byteLength = SAFE_REFLECT_APPLY(TYPED_ARRAY_LENGTH_GETTER, value, []);
    buffer = SAFE_REFLECT_APPLY(TYPED_ARRAY_BUFFER_GETTER, value, []);
  } catch {
    fail(
      "PROOF_READER_CHECKPOINT_OPTIONS_INVALID",
      `${label} byte authority could not be captured.`,
    );
  }
  if (
    !SAFE_NUMBER_IS_SAFE_INTEGER(byteLength) ||
    byteLength <= 0 ||
    byteLength > maximumBytes ||
    SAFE_OBJECT_GET_PROTOTYPE_OF(buffer) !== ArrayBuffer.prototype
  ) {
    fail("PROOF_READER_CHECKPOINT_OPTIONS_INVALID", `${label} exceeds its inert byte authority.`);
  }
  const captured = new SAFE_UINT8_ARRAY(byteLength);
  SAFE_REFLECT_APPLY(SAFE_UINT8_ARRAY_SET, captured, [value]);
  return captured;
}

function strictUtf8(bytes) {
  try {
    const decoder = new SAFE_TEXT_DECODER("utf-8", { fatal: true });
    return SAFE_REFLECT_APPLY(SAFE_TEXT_DECODER_DECODE, decoder, [bytes]);
  } catch {
    fail("PROOF_READER_CHECKPOINT_UTF8_INVALID", "Checkpoint bytes must be strict UTF-8.");
  }
}

function normalizeCanonicalCheckpointBytes(rawBytes) {
  const bytes = captureInertBytes(rawBytes, "checkpoint", MAX_CHECKPOINT_BYTES);
  const text = strictUtf8(bytes);
  let parsed;
  try {
    parsed = SAFE_JSON_PARSE(text);
  } catch {
    fail(
      "PROOF_READER_CHECKPOINT_JSON_INVALID",
      "Checkpoint bytes must contain one valid JSON document.",
    );
  }
  const normalized = normalizeManifest(parsed);
  const canonicalText = `${SAFE_JSON_STRINGIFY(normalized.manifest, null, 2)}\n`;
  if (text !== canonicalText) {
    fail(
      "PROOF_READER_CHECKPOINT_CANONICAL_DRIFT",
      "Checkpoint bytes are not in their one exact canonical JSON representation.",
    );
  }
  return normalized;
}

function assertReviewedCheckpointPrefix(manifest, checkpointDigests) {
  if (manifest.checkpoints.length < PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256.length) {
    fail(
      "PROOF_READER_CHECKPOINT_HISTORY_UNANCHORED",
      "The checkpoint chain omits part of its code-owned reviewed history.",
      {
        reviewedCheckpoints: PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256.length,
        actualCheckpoints: manifest.checkpoints.length,
      },
    );
  }
  let checkpointIndex = 0;
  while (checkpointIndex < PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256.length) {
    const actualSha256 = checkpointDigests[checkpointIndex];
    const expectedSha256 = PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[checkpointIndex];
    if (actualSha256 !== expectedSha256) {
      fail(
        "PROOF_READER_CHECKPOINT_HISTORY_UNANCHORED",
        "A reviewed checkpoint differs from its exact code-owned history anchor.",
        {
          sequence: checkpointIndex + 1,
          expectedSha256,
          actualSha256,
        },
      );
    }
    checkpointIndex += 1;
  }
}

function assertExactReviewedCheckpointChain(manifest, checkpointDigests) {
  if (manifest.checkpoints.length !== PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256.length) {
    fail(
      "PROOF_READER_CHECKPOINT_HISTORY_UNANCHORED",
      "Live verification accepts only the exact code-owned reviewed checkpoint chain.",
      {
        reviewedCheckpoints: PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256.length,
        actualCheckpoints: manifest.checkpoints.length,
      },
    );
  }
  assertReviewedCheckpointPrefix(manifest, checkpointDigests);
}

/**
 * Parses, canonical-byte-checks, and authenticates the exact code-reviewed live checkpoint chain.
 */
export function validateProofReaderCheckpointBytes(rawBytes) {
  const { manifest, checkpointDigests } = normalizeCanonicalCheckpointBytes(rawBytes);
  assertExactReviewedCheckpointChain(manifest, checkpointDigests);
  return deepFreezeJson(manifest);
}

/**
 * Validates exactly one proposed successor without granting it live-verification authority.
 *
 * A passing candidate must preserve the complete code-reviewed prefix and advance at least one
 * reader with a receipt that has never appeared earlier in the chain. Its returned digest is only
 * an input to human/code review; live verification will reject it until code adopts that digest.
 */
export function validateProofReaderCheckpointAppendCandidateBytes(rawBytes) {
  const { manifest: normalized, checkpointDigests } = normalizeCanonicalCheckpointBytes(rawBytes);
  const reviewedCount = PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256.length;
  if (normalized.checkpoints.length !== reviewedCount + 1) {
    fail(
      "PROOF_READER_CHECKPOINT_APPEND_CANDIDATE_INVALID",
      "An append candidate must contain the reviewed chain plus exactly one successor.",
      {
        reviewedCheckpoints: reviewedCount,
        actualCheckpoints: normalized.checkpoints.length,
      },
    );
  }
  assertReviewedCheckpointPrefix(normalized, checkpointDigests);
  const candidate = normalized.checkpoints[reviewedCount];
  const candidateSha256 = checkpointDigests[reviewedCount];
  return SAFE_OBJECT_FREEZE({
    status: "REVIEW_REQUIRED",
    profile: PROFILE,
    anchoredCheckpoints: reviewedCount,
    candidateSequence: candidate.sequence,
    predecessorSha256: candidate.predecessorSha256,
    candidateSha256,
  });
}

function captureOptions(rawOptions) {
  if (rawOptions === undefined) return {};
  const options = exactAllowedOwnDataRecord(rawOptions, OPTION_KEYS, "checkpoint verifier options");
  const captured = {};
  let index = 0;
  while (index < OPTION_KEYS.length) {
    const key = OPTION_KEYS[index];
    const descriptor = SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR(options, key);
    if (descriptor !== undefined) captured[key] = descriptor.value;
    index += 1;
  }
  if (captured.workspaceRoot !== undefined) {
    if (
      typeof captured.workspaceRoot !== "string" ||
      !path.isAbsolute(captured.workspaceRoot) ||
      captured.workspaceRoot.includes("\0")
    ) {
      fail(
        "PROOF_READER_CHECKPOINT_OPTIONS_INVALID",
        "workspaceRoot must be one absolute non-NUL path.",
      );
    }
  }
  if (captured.checkpointBytes !== undefined) {
    captured.checkpointBytes = captureInertBytes(
      captured.checkpointBytes,
      "checkpoint",
      MAX_CHECKPOINT_BYTES,
    );
  }
  if (
    captured.beforeAuthorityOpen !== undefined &&
    (typeof captured.beforeAuthorityOpen !== "function" ||
      SAFE_UTIL_IS_PROXY(captured.beforeAuthorityOpen))
  ) {
    fail(
      "PROOF_READER_CHECKPOINT_OPTIONS_INVALID",
      "beforeAuthorityOpen must be one non-proxy test callback.",
    );
  }
  return captured;
}

async function canonicalWorkspaceRoot(candidate) {
  const resolved = path.resolve(candidate ?? WORKSPACE_ROOT);
  let before;
  let canonical;
  try {
    before = await lstat(resolved);
    canonical = await realpath(resolved);
  } catch {
    fail(
      "PROOF_READER_CHECKPOINT_FILE_UNSAFE",
      "Checkpoint workspace root is missing or unreadable.",
    );
  }
  if (!before.isDirectory() || before.isSymbolicLink() || canonical !== resolved) {
    fail(
      "PROOF_READER_CHECKPOINT_FILE_UNSAFE",
      "Checkpoint workspace root must be one canonical non-symbolic directory.",
    );
  }
  return resolved;
}

function sameDirectoryIdentity(left, right) {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.mode === right.mode &&
    left.nlink === right.nlink &&
    left.size === right.size
  );
}

async function openCanonicalDirectory(directoryPath, relativePath, label) {
  let before;
  let canonical;
  let handle;
  try {
    before = await lstat(directoryPath);
    canonical = await realpath(directoryPath);
    if (!before.isDirectory() || before.isSymbolicLink() || canonical !== directoryPath) {
      fail(
        "PROOF_READER_CHECKPOINT_FILE_UNSAFE",
        `${label} must be one canonical non-symbolic directory.`,
        { relativePath },
      );
    }
    handle = await open(directoryPath, DIRECTORY_READ_FLAGS);
    const opened = await handle.stat();
    if (!opened.isDirectory() || !sameDirectoryIdentity(before, opened)) {
      fail("PROOF_READER_CHECKPOINT_FILE_UNSAFE", `${label} changed identity while opening.`, {
        relativePath,
      });
    }
    return { path: directoryPath, handle, opened, label, relativePath };
  } catch (error) {
    await handle?.close().catch(() => undefined);
    if (error instanceof ProofReaderCheckpointError) throw error;
    fail("PROOF_READER_CHECKPOINT_FILE_UNSAFE", `${label} could not be opened safely.`, {
      relativePath,
    });
  }
}

async function assertCanonicalDirectoryUnchanged(capture) {
  let handleAfter;
  let namedAfter;
  let canonicalAfter;
  try {
    [handleAfter, namedAfter, canonicalAfter] = await Promise.all([
      capture.handle.stat(),
      lstat(capture.path),
      realpath(capture.path),
    ]);
  } catch {
    fail(
      "PROOF_READER_CHECKPOINT_FILE_UNSAFE",
      `${capture.label} became unavailable during the authority read.`,
      { relativePath: capture.relativePath },
    );
  }
  if (
    !handleAfter.isDirectory() ||
    !sameDirectoryIdentity(capture.opened, handleAfter) ||
    !namedAfter.isDirectory() ||
    namedAfter.isSymbolicLink() ||
    !sameDirectoryIdentity(capture.opened, namedAfter) ||
    canonicalAfter !== capture.path
  ) {
    fail(
      "PROOF_READER_CHECKPOINT_FILE_UNSAFE",
      `${capture.label} changed identity or canonicality during the authority read.`,
      { relativePath: capture.relativePath },
    );
  }
}

async function readRegularAuthority(
  workspaceRoot,
  relativePath,
  maximumBytes,
  beforeAuthorityOpen,
) {
  const absolutePath = path.resolve(workspaceRoot, relativePath);
  const relative = path.relative(workspaceRoot, absolutePath);
  if (
    relative === "" ||
    relative.startsWith(`..${path.sep}`) ||
    relative === ".." ||
    path.isAbsolute(relative)
  ) {
    fail(
      "PROOF_READER_CHECKPOINT_FILE_UNSAFE",
      "A checkpoint authority path escaped the workspace root.",
      { relativePath },
    );
  }
  let rootCapture;
  let parentCapture;
  let before;
  let handle;
  try {
    rootCapture = await openCanonicalDirectory(
      workspaceRoot,
      relativePath,
      "Checkpoint workspace root",
    );
    parentCapture = await openCanonicalDirectory(
      path.dirname(absolutePath),
      relativePath,
      "Checkpoint authority parent",
    );
    before = await lstat(absolutePath);
    if (
      !before.isFile() ||
      before.isSymbolicLink() ||
      before.nlink !== 1 ||
      before.size <= 0 ||
      before.size > maximumBytes
    ) {
      fail(
        "PROOF_READER_CHECKPOINT_FILE_UNSAFE",
        "A checkpoint authority must be one nonempty bounded regular non-symbolic file.",
        { relativePath },
      );
    }
    await beforeAuthorityOpen?.({ absolutePath, relativePath });
    handle = await open(absolutePath, READ_FLAGS);
    const opened = await handle.stat();
    if (
      !opened.isFile() ||
      opened.dev !== before.dev ||
      opened.ino !== before.ino ||
      opened.nlink !== 1 ||
      opened.size !== before.size ||
      opened.mode !== before.mode
    ) {
      fail(
        "PROOF_READER_CHECKPOINT_FILE_UNSAFE",
        "A checkpoint authority changed identity before it was read.",
        { relativePath },
      );
    }
    const capacity = Math.min(opened.size, maximumBytes) + 1;
    const bounded = Buffer.alloc(capacity);
    let offset = 0;
    while (offset < capacity) {
      const { bytesRead } = await handle.read(bounded, offset, capacity - offset, null);
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    if (offset > maximumBytes) {
      fail(
        "PROOF_READER_CHECKPOINT_FILE_UNSAFE",
        "A checkpoint authority exceeded its byte budget while being read.",
        { relativePath },
      );
    }
    const bytes = bounded.subarray(0, offset);
    const after = await handle.stat();
    const namedAfter = await lstat(absolutePath);
    if (
      !after.isFile() ||
      after.dev !== opened.dev ||
      after.ino !== opened.ino ||
      after.nlink !== 1 ||
      after.size !== bytes.byteLength ||
      after.size !== opened.size ||
      after.mode !== opened.mode ||
      !namedAfter.isFile() ||
      namedAfter.isSymbolicLink() ||
      namedAfter.dev !== opened.dev ||
      namedAfter.ino !== opened.ino ||
      namedAfter.nlink !== 1 ||
      namedAfter.size !== opened.size ||
      namedAfter.mode !== opened.mode
    ) {
      fail(
        "PROOF_READER_CHECKPOINT_FILE_UNSAFE",
        "A checkpoint authority changed identity or size while it was read.",
        { relativePath },
      );
    }
    await assertCanonicalDirectoryUnchanged(parentCapture);
    await assertCanonicalDirectoryUnchanged(rootCapture);
    return bytes;
  } catch (error) {
    if (error instanceof ProofReaderCheckpointError) throw error;
    fail(
      "PROOF_READER_CHECKPOINT_FILE_UNSAFE",
      "A checkpoint authority could not be opened safely.",
      { relativePath },
    );
  } finally {
    await handle?.close().catch(() => undefined);
    await parentCapture?.handle.close().catch(() => undefined);
    await rootCapture?.handle.close().catch(() => undefined);
  }
}

function assertLiveReceipt(bytes, receipt, code, kind) {
  const actualBytes = bytes.byteLength;
  const actualSha256 = sha256(bytes);
  if (actualBytes !== receipt.bytes || actualSha256 !== receipt.sha256) {
    fail(code, `A current ${kind} differs from its exact checkpoint receipt.`, {
      task: receipt.task,
      path: receipt.path,
      expectedBytes: receipt.bytes,
      expectedSha256: receipt.sha256,
      actualBytes,
      actualSha256,
    });
  }
}

/**
 * Verifies the canonical checkpoint and every artifact and reader in its current reviewed head.
 */
export async function verifyProofReaderCheckpoints(rawOptions = undefined) {
  const options = captureOptions(rawOptions);
  const workspaceRoot = await canonicalWorkspaceRoot(options.workspaceRoot);
  const checkpointBytes =
    options.checkpointBytes ??
    (await readRegularAuthority(
      workspaceRoot,
      CHECKPOINT_RELATIVE_PATH,
      MAX_CHECKPOINT_BYTES,
      options.beforeAuthorityOpen,
    ));
  const manifest = validateProofReaderCheckpointBytes(checkpointBytes);
  const head = manifest.checkpoints[manifest.checkpoints.length - 1];

  let artifactIndex = 0;
  while (artifactIndex < head.artifacts.length) {
    const receipt = head.artifacts[artifactIndex];
    const bytes = await readRegularAuthority(
      workspaceRoot,
      receipt.path,
      MAX_AUTHORITY_BYTES,
      options.beforeAuthorityOpen,
    );
    assertLiveReceipt(bytes, receipt, "PROOF_READER_CHECKPOINT_ARTIFACT_DRIFT", "frozen artifact");
    artifactIndex += 1;
  }

  let readerIndex = 0;
  while (readerIndex < head.readers.length) {
    const receipt = head.readers[readerIndex];
    const bytes = await readRegularAuthority(
      workspaceRoot,
      receipt.path,
      MAX_AUTHORITY_BYTES,
      options.beforeAuthorityOpen,
    );
    assertLiveReceipt(bytes, receipt, "PROOF_READER_CHECKPOINT_READER_DRIFT", "proof reader");
    readerIndex += 1;
  }

  return SAFE_OBJECT_FREEZE({
    status: "PASS",
    profile: manifest.profile,
    headSha256: manifest.headSha256,
    checkpoints: manifest.checkpoints.length,
    frozenArtifacts: head.artifacts.length,
    currentReaders: head.readers.length,
  });
}

/**
 * Authenticates the reviewed checkpoint and returns one immutable frozen-artifact projection.
 * Historical readers use this instead of carrying reader-local task-time receipt maps.
 */
export async function readCheckpointedFrozenArtifact(task, rawOptions = undefined) {
  if (typeof task !== "string" || task.length === 0) {
    fail("PROOF_READER_CHECKPOINT_OPTIONS_INVALID", "Frozen artifact task must be non-empty.");
  }
  const options = captureOptions(rawOptions);
  const workspaceRoot = await canonicalWorkspaceRoot(options.workspaceRoot);
  const checkpointBytes =
    options.checkpointBytes ??
    (await readRegularAuthority(
      workspaceRoot,
      CHECKPOINT_RELATIVE_PATH,
      MAX_CHECKPOINT_BYTES,
      options.beforeAuthorityOpen,
    ));
  const manifest = validateProofReaderCheckpointBytes(checkpointBytes);
  const head = manifest.checkpoints[manifest.checkpoints.length - 1];
  const matches = head.artifacts.filter((receipt) => receipt.task === task);
  if (matches.length !== 1) {
    fail(
      "PROOF_READER_CHECKPOINT_ARTIFACT_IDENTITY_DRIFT",
      `Checkpoint must own one frozen artifact for task "${task}".`,
      { task, matches: matches.length },
    );
  }
  const receipt = matches[0];
  const bytes = await readRegularAuthority(
    workspaceRoot,
    receipt.path,
    MAX_AUTHORITY_BYTES,
    options.beforeAuthorityOpen,
  );
  assertLiveReceipt(bytes, receipt, "PROOF_READER_CHECKPOINT_ARTIFACT_DRIFT", "frozen artifact");
  return SAFE_OBJECT_FREEZE({
    task: receipt.task,
    path: receipt.path,
    bytes: captureInertBytes(bytes, "frozen artifact", MAX_AUTHORITY_BYTES),
    byteLength: receipt.bytes,
    sha256: receipt.sha256,
    checkpointHeadSha256: manifest.headSha256,
  });
}
