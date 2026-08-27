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
  "eedd62fc8e56534a032034280e0189b9ab76445bd89ef2dc735aabc14e1d67c0",
]);
export const PROOF_READER_CHECKPOINT_REVIEWED_TASK_COUNTS = SAFE_OBJECT_FREEZE([
  6, 8, 9, 10, 11, 11, 13, 14, 14, 14, 14, 14, 14, 14, 15, 16, 17, 17, 17, 17, 18, 18, 19, 20, 25,
  25, 25, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 35, 36,
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
      bytes: 9_795,
      sha256: "3a7ff5d58815eb4a731ce10271a39bc8567d846e57c1aaf6303beee624465fdb",
    },
    "scripts/lib/desen-app-shell-navigation-proof.mjs",
    "tests/desen-app-shell-navigation.test.mjs",
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
  let left = 0;
  while (left < artifacts.length) {
    let right = left + 1;
    while (right < artifacts.length) {
      if (artifacts[left].task === artifacts[right].task) {
        fail(
          "PROOF_READER_CHECKPOINT_SCHEMA_INVALID",
          "Artifact tasks must be unique inside one checkpoint.",
          { task: artifacts[left].task },
        );
      }
      if (artifacts[left].path === artifacts[right].path) {
        fail(
          "PROOF_READER_CHECKPOINT_SCHEMA_INVALID",
          "Artifact paths must be unique inside one checkpoint.",
          { path: artifacts[left].path },
        );
      }
      right += 1;
    }
    left += 1;
  }
}

function assertUniqueReaderAuthority(readers) {
  let left = 0;
  while (left < readers.length) {
    let right = left + 1;
    while (right < readers.length) {
      if (readers[left].path === readers[right].path) {
        fail(
          "PROOF_READER_CHECKPOINT_SCHEMA_INVALID",
          "Reader paths must be unique inside one checkpoint.",
          { path: readers[left].path },
        );
      }
      if (
        readers[left].task === readers[right].task &&
        readers[left].role === readers[right].role
      ) {
        fail(
          "PROOF_READER_CHECKPOINT_SCHEMA_INVALID",
          "Reader task and role authority must be unique inside one checkpoint.",
          { task: readers[left].task, role: readers[left].role },
        );
      }
      right += 1;
    }
    left += 1;
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

/**
 * Calculates the chain digest for one structurally valid checkpoint.
 *
 * The digest excludes the root `headSha256`, includes the predecessor, and uses compact JSON over
 * an exact key-ordered normalized record. It is therefore deterministic and non-self-referential.
 */
export function calculateProofReaderCheckpointSha256(rawCheckpoint) {
  const checkpoint = normalizeCheckpoint(rawCheckpoint);
  return sha256(SAFE_BUFFER_FROM(SAFE_JSON_STRINGIFY(checkpointDigestPayload(checkpoint)), "utf8"));
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
    predecessor = calculateProofReaderCheckpointSha256(checkpoint);
    checkpoints[checkpointIndex] = checkpoint;
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
    schemaVersion: 1,
    profile: PROFILE,
    headSha256: predecessor,
    checkpoints,
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
  const canonicalText = `${SAFE_JSON_STRINGIFY(normalized, null, 2)}\n`;
  if (text !== canonicalText) {
    fail(
      "PROOF_READER_CHECKPOINT_CANONICAL_DRIFT",
      "Checkpoint bytes are not in their one exact canonical JSON representation.",
    );
  }
  return normalized;
}

function assertReviewedCheckpointPrefix(manifest) {
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
    const actualSha256 = calculateProofReaderCheckpointSha256(
      manifest.checkpoints[checkpointIndex],
    );
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

function assertExactReviewedCheckpointChain(manifest) {
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
  assertReviewedCheckpointPrefix(manifest);
}

/**
 * Parses, canonical-byte-checks, and authenticates the exact code-reviewed live checkpoint chain.
 */
export function validateProofReaderCheckpointBytes(rawBytes) {
  const normalized = normalizeCanonicalCheckpointBytes(rawBytes);
  assertExactReviewedCheckpointChain(normalized);
  return deepFreezeJson(normalized);
}

/**
 * Validates exactly one proposed successor without granting it live-verification authority.
 *
 * A passing candidate must preserve the complete code-reviewed prefix and advance at least one
 * reader with a receipt that has never appeared earlier in the chain. Its returned digest is only
 * an input to human/code review; live verification will reject it until code adopts that digest.
 */
export function validateProofReaderCheckpointAppendCandidateBytes(rawBytes) {
  const normalized = normalizeCanonicalCheckpointBytes(rawBytes);
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
  assertReviewedCheckpointPrefix(normalized);
  const candidate = normalized.checkpoints[reviewedCount];
  const candidateSha256 = calculateProofReaderCheckpointSha256(candidate);
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
