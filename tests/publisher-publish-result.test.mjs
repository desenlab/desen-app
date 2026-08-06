import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { brotliDecompressSync } from "node:zlib";

import {
  PUBLISH_PIPELINE_STAGES,
  PUBLISH_SOURCE_JSON_LIMITS,
  PUBLISHER_DIAGNOSTIC_REGISTRY,
} from "../packages/publisher/dist/index.js";
import {
  buildPublisherPublishResultEvidence,
  DEFAULT_PUBLISHER_PUBLISH_RESULT_ARTIFACT_PATH,
  PublisherPublishResultEvidenceError,
  verifyPublisherPublishResultEvidence,
  writePublisherPublishResultEvidence,
} from "../scripts/lib/publisher-publish-result-proof.mjs";

// Reconstructs exact stale M07-T06 through M07-T03 bytes from the live M07-T07 fixture so rollback
// regression remains cryptographic, deterministic, and independent from Git or child processes.
const M07_T06_SOURCE_AUDIT_RECONSTRUCTION_PATCH =
  "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";
const M07_T05_SOURCE_AUDIT_RECONSTRUCTION_PATCH =
  "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";
const M07_T04_SOURCE_AUDIT_RECONSTRUCTION_PATCH =
  "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";
const M07_T03_SOURCE_AUDIT_RECONSTRUCTION_PATCH = `
H49UICwKbGPh6EE0TsxnDZ/lsPOMNVvJqvySSN9nt4BGP8ptjARZafF5m+qdy+lbXRAQywETYmWsU9em9CFAJGpZT1K2AQG3pfqI
XSLEG+ptJZBJkB4f//u1PhOe/UFQBEp+CpCQMTb77j33bXXPTGeg/iLPAqrgo37dQz8ELFHHR0iUKZ+KkWRj5AL6sFBZxkrbzWed
9tlzQgghhMinp/3iI7sOlF5LAx4w6aagl3XgkYTiipM5r1I4KW3r0DK0W8c3YfinUVtNLVH2W2TTK83Up59Kr7ZLXiMiV32ZUqRe
HMt1XcQ+4eQENKURr+4/Gv76iPTd3sHpfnYnn1znxJETrsjILRjSTo0OYEhf9sSkXjdvGz6jZ/j4JgsonRhznZNDDgetzyo5kSeO
vF4+0cmLOvxjSHuF7lRDSw6H93yy5969E5k9VlpA5JSiq1wiYs8MI8dKtn3suBLFKWfjXOPyG3t+buDzrAOuTWnM3UD5LIPoqk52
QmNkXqvWKh7PODFowPOS/DkEWjVwZq5k+TFXL5/Bt/5ANK8y+qGCZFyvWdggX604BBNH1Qk2LH8SdsFK52Q18uIsR+KbdTUl7G6B
X5Y9dDMOYdBm+ar4K76a+he8ZLRTvCgd1HIDXskRTzH1vL4IY6ORpUH6se/C+Hca/Re0tiU3yp1na+A5GTVAIMx4PO19WIGcRIzW
DCwE3FIft5WKRQB5skoOVtu2vh3bXtB+F1fkFqzr53EecD98tDSdT+WYKIi42GrgRsmHlI+WNqX7U+/ipBVajDw9y/+i3bw4tlRB
NMn/aOPThDa535R1pcWLGBR6jJMary3izTdFPH6O8asbUQ3oWyFs4Se1Hx0rYQx6NyM8Um31FpvgsW0J/iyuFOGqIhGv0afJecDr
0HY77w5yxtO1um3iNwcOAc9j5w8Rkodlk1IzVANoqGBVBhGcAy/+dMyxA3Viux3dFUlBnxejCEOfbchEi7Qg0G7myn7MudoEJQd2
C9fwWC9r4Htrcf4FUiRfnfOqZtrQY8pBkJUgUs84Lb+6Lpa+sH40QueI/pXqj/5w9A2PzX+/kqSgSdF83JuId8ccuOvFPcO5WXqT
VufTWYosdsD2ytowM6w+UGeY6R5TDkJSMYu8iZlj807OHajbEf8eLCBoZthT5RSgn+EnMwcJZEplKZAqdAaOarvk1l+PLUIUKO19
Yj+GbPpWNXOq53KKPMMWed2kc2zocR00v7vNPgc3w7ayalvz4Ma1EDLD20Znin2fKYfOVoRsSn58n2YdB9tRW8wp80nOxYuubmzD
IQTQuGfePTGt0fq6Exw7s47y7Dhn1ocLsVaJXDveO1E4icw6PtlosJ1cFpUcFSVaL5OYT6914xuXXsfSeV8yP7SXownO8lkpn0TL
y35+i6KaY59pxIuuzduW47PHNIMvjpWWkQ+xMGcUg3jx/8Zm73o1qX21WNZO7PK47YbW5Jp33Xli52zZ6+f+JhGiTL3im2ylcENs
a50iUedXhUshK+zHX8fS79ssdydYRVYnvIN8JuuE7DzXWTfkXtEqdxIRXkSFvKknS5SyvoR7Nf6K9/jrJnOr6inlKCxyEYxIK+xE
XSPzhW2xkEhFD3GuwdqYbMTwImeMGOAUpqGWjCn13D7Us/BIuRJOr4GpAP2lV54jVRAsxlT3jrS6kULvJNfeqApyNp5642yg36Om
yqvk09N2TPeo+PmJiI7QVzcR8jxoKrzUOfmc2Y8i0CbvLw0p1xIhyqmMwVdaLNZWm3J0uWZKNlCcQc2mcZiE5EyDW24rfv9vBbA9
QpGVuybY1dS+Ge6q67hzo3G1hexwUNUMPpvRRsnGfDOdfYfwcA+Ehqic6W64WCZw9OMtsJYq5FNT05T9CCk7ygNdbOjM9BGQj4u8
UMkZXR/2rj4tMVILZAfXTcSaVVWmvdsNKFLXZmasquRMkLU5urisLan/WbeNZ44ReRBXCyefS2I2motizeeyycvhzrstxMPBtps4
72C3BO2XQO2o4QVrzOEqdg9jbKFq5iySRm+seRdpafGkgGf6eE3e4A5+lhZurTexUZyfx/ACRn9klXeDuXquQNCpy6U64lBAuR2R
yzW1Lbk1Xfb+IwRU1NsJiflSqTFOtFDtt8JoJpWuhmXJQ1nt1poiwtxgHjl5alJCii+Y/u1p4snyzDxBmgWEeHH3H8OyJ3EOSAuO
2EKDJZ+kr7gHe1Ku2xECKMjuuXYqQCARj6AGCzGBRp02SkyEqiYsZZvlrR5hoCqW2IZBc1mCwmB21aCTpf9qnPLFEb5VnRX9q2WT
w1Q9BsjRlSEcJFIfggN76PD6VVM256pNx1q1Ne+qt/vXMtEIDi4iHFVbJaoJhgI8VXeyNanzI7s7N++6YaEvxqOOjz8vCjlMOpjU
I3ZOks3g2LhS8fsvux3tSv/77p/PP9tLZZrw5js5543RMIQ7yudml17elH1R2gIDkayRpvqMi7WluekdBwSF6owmTPeaNBOksrS8
KhdrnWdCWA0Xw0YUgj3YYERPUt/SPNEnikN44v4pgN3zJhFaepeyM3FUWBRErScfmqoBU8KqjuX2lLYgFD7V9Pr3nAL+rUXDiOiz
bwa7+KUC32FM/HDJEjlqLXbIi4M/XmDgAASvpagbvcplIuJXvAkfK/HgsozQ2ZpS9/yUfolpdJ15c3DPMB6/ZE6QYoo+7ajTjjxB
XvjVu9LnvPi4CmPZz8gf8NABLYimtyhAjVs2GLH4CzbSEv+79WIC5tQccD4TmuLbQh7yNsjW80hloWwIoVhOUu3UQZjdAQq3GGMN
ioNAC3rcT4yUm6JNj/LNmUi5NdNurbxUINMpPRTkwLPVUs9gwhiVUTNNDQ/JGBXH4p9hFgu84CQUpIEYGKSAkZaqZQBLdzm4k+DC
MhgmMYcYAzw0JOyJlyM8tea446cQECdi4iHUCCYQFVHPmAcCY8O/akKIquq+fqY3tg29FRN2MZw/CrBzDzAYwKSwK1Fh0JCcfIyn
ywMZkCKaC9irrfDvUmMb4SsaOCfPbYVi9F8E0ZfRq7u+fPbKcEuqqknPFEir1LR48GPBrxaRATNKgfynGl/vyvjaGPy1j/P0M9lF
/+ouaSw5tSpnGvoyWnD6FD6qP66z9zK4xf3ugLSXLXRoBQmWrhVLnt3aY7qSvQQzYXt8jhXYSYWbFS3wfL9AdAwqJyVJHmhdHm3t
k/WjXAe0NeGgvMyIRt7wRSOFdSB07y610srCXHopsuK3M23dAcXzDiaib5x3wHmHE9WS5puyglQMg3OOc8xQNDnNrQWNsMkQYqG1
hbNuA6bPmSm3qIgBHpvp/1aLZkhpYaN7q+UDeLeEuujVdCgrOmDVPDG2i1p6W8VY1FOxNQkwP5xC8p5P7KfFnezhE8uEwJpEHI8a
WLUYzOmqERL6K+Ai8gJ/zy6R75Y7YJsH6VfgCKHMV6xBgNICRFoqg80KKYuVy7bNklfY7VwGFGKi7jCrEQKj9hbzKZukR7l2HGvS
jypzaXoDOF7YGUpos4lsFpFWNmeDo2uSgU0vI5bY0FQXKSkzmBYfDBl7/NoUX102dQG2E/IrJQU0Qa88g7hhs32ur+0RrQ1CPsw8
V3YQNI4Id6JAKuCkkRTErvzFh/5sBpSfM9v3YN/3ff+HB3LukEledU7ame6ZOj/RNmCcRtqwsvA3P+j4n2ZOFDbZWQ8G54ZzqtrT
NVkyjLvMlCHYhs2OOef3cVLzDR8Hak94eFzAE4WtlQgtTcNBnGkSA+/jTuGa5ktjYwBz7jgzCLjjsKZ3dSfA2YUNdcF9TH/P/y8e
YfjzVRekxPtupxYVmkBnvjjsuTxFVbjjUjE69laLq3oFpunFq4JUpFlJPJBnvVQvr6YjAST/GHZ1IBYulN3xIB7suJ+Y8+5d8HnG
aiJgjyJ0RvCeKnH9c9ifYTnojDJnlgeFLImvcbOWhPTpUJs7FgkJRe1WgvJhLOjfTTXORv53MNxJhx58UVVSCvTHgaA5FXX9Sh0F
RQpO0cWu4IeZaXSSlS0qWFgYon8trW7yY0M4mqXZYQMTqWAV0w85rq6p3kD7jttgHVP7Nxb/DjaQ8H14s1KlsF99sNUULIZTcDSr
08ir6rzjJ/j2SnSKD3K8LkHpKdiBentJWF/IXHWIduzmfei+HxI4d5VKJnpxbkwIx9HdVQ9y6Rh7PgSVRVuERF91DBr9t1+OoSUX
CVtTjuSnjGUnaBneBaYrO/QMiYlgcpoE6MEKlnIDmHvOemwMqRybkX0z7hmEegihPTTErXamUDs1MvYKkRTICY/vdbdjp9YRM2ph
ioKUwstl80f9YkQhCmiLd2a88FfroK7HuOqhdL0y9WesWHJeyoIXLSVGIJcWNtTdnGUMRbpC+nWSYJWCw6gr5SaIjd1QOMBiZw2h
+pJVAyU2hBGUtWrUTYmRa6Z9zXt+1mMqyZcg6WQOxuiOdTj7VONoZNudT5NqZR87OOlP9Z+qfVbZRk6gEVY4xU9nHjQXAegek9Rh
rxb+EHXIWw7xCeyo4EfHjWaNPLtSVDYZQY87sINIagBBDMyKiGj0tlQ77arFjKXHNr6NvVS+ubkgNN0fFqt5bddKhulfoOXDx4uI
EwOUmpi14k0StzCPHJ2NTEM8U1APJu46kXUYhwueD4QWM9yZQjaSnazBNO5QXOKSSE4iTYEdXIIG7V+nWS+BLcGhKR0O2DboDh+r
ArGXQfzQmV/EjSCbYKtwvnNXH/YRzF8HFh4JN+Z3221DKrRWQyQfCsGux06dcU+s5tPN9/nJP3tjjXTZiZ6XFfaZh6HxxKr9dWpR
ixXpdDHOCUT6gMsAH5g+eyO1IbuT046vmqJtlMCdu4UKA0lClonUiNP/RyYbPiAxgoUFn/n9NzJvqdEV+EEjCJwVYc0EyizxlGYZ
eUtF9WPB0KG1qI8cCo2NaaAgwEp8CWRjNNnygDJRj5K4GwGvSCJU9hOzCNBm6HkoCbgBNcbBgG0VBeafyuxJShn4ab3LqKyJ/LIw
w+pQsrN7WViez0qvt+ogXsEJJ7aDq96o5Yehc31VdZ4FERQF5ITg9JL9Hkwvt/kIn7at4E9fvMLGIBSctc9kGee6JYRzqagt7S/B
tpdlDo4TrSZkYFMn93IHliS05RiwBt/ygKeALF0Qgoa6PTNDgcLQQ3OmPoVG5NJmgoRMVspVfMsvv5+87+3CCno4DOjyCwVvT6RN
3VsLdJw61f7YvVVX866b9EXygDmefW4AnVC0Ov4jH3oIk3TuDg/RRNpKR+ykHzSIK7igAnkS7HL+sJMlwCnadBDrOEMOWxyckUP9
Q4QIlezsGt+U7CbIvRJrDgs=
`.replaceAll(/\s/gu, "");

function applySourceAuditReconstructionPatch(currentBytes, encodedPatch) {
  const patchText = brotliDecompressSync(Buffer.from(encodedPatch, "base64")).toString("utf8");
  const currentLines = currentBytes.toString("utf8").split("\n");
  const patchLines = patchText.split("\n");
  const reconstructedLines = [];
  let currentIndex = 0;
  let patchIndex = 0;

  while (patchIndex < patchLines.length) {
    const header = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/u.exec(patchLines[patchIndex]);
    if (header === null) {
      patchIndex += 1;
      continue;
    }
    const currentStart = Number(header[1]) - 1;
    const expectedCurrentCount = Number(header[2] ?? "1");
    const expectedReconstructedCount = Number(header[4] ?? "1");
    assert.ok(currentStart >= currentIndex);
    reconstructedLines.push(...currentLines.slice(currentIndex, currentStart));
    currentIndex = currentStart;
    patchIndex += 1;
    let currentCount = 0;
    let reconstructedCount = 0;

    while (patchIndex < patchLines.length && !patchLines[patchIndex].startsWith("@@ ")) {
      const patchLine = patchLines[patchIndex];
      if (patchLine === "\\ No newline at end of file") {
        patchIndex += 1;
        continue;
      }
      const marker = patchLine[0];
      const content = patchLine.slice(1);
      if (marker === " ") {
        assert.equal(currentLines[currentIndex], content);
        reconstructedLines.push(content);
        currentIndex += 1;
        currentCount += 1;
        reconstructedCount += 1;
      } else if (marker === "-") {
        assert.equal(currentLines[currentIndex], content);
        currentIndex += 1;
        currentCount += 1;
      } else if (marker === "+") {
        reconstructedLines.push(content);
        reconstructedCount += 1;
      } else {
        break;
      }
      patchIndex += 1;
    }
    assert.equal(currentCount, expectedCurrentCount);
    assert.equal(reconstructedCount, expectedReconstructedCount);
  }

  reconstructedLines.push(...currentLines.slice(currentIndex));
  return Buffer.from(reconstructedLines.join("\n"), "utf8");
}

function reconstructM07T03SourceAuditProof(currentBytes) {
  const staleM07T06Bytes = applySourceAuditReconstructionPatch(
    currentBytes,
    M07_T06_SOURCE_AUDIT_RECONSTRUCTION_PATCH,
  );
  assert.equal(staleM07T06Bytes.byteLength, 257_943);
  assert.equal(
    createHash("sha256").update(staleM07T06Bytes).digest("hex"),
    "927201fd9e9067a1d03ca1b274724bb065ca97f47755348338a979e4c2f2f74a",
  );
  const staleM07T05Bytes = applySourceAuditReconstructionPatch(
    staleM07T06Bytes,
    M07_T05_SOURCE_AUDIT_RECONSTRUCTION_PATCH,
  );
  assert.equal(staleM07T05Bytes.byteLength, 255_778);
  assert.equal(
    createHash("sha256").update(staleM07T05Bytes).digest("hex"),
    "63dda01b718dc75feb12e006cece2ada5c75f951f306c3265f3e1dcf745f164f",
  );
  const staleM07T04Bytes = applySourceAuditReconstructionPatch(
    staleM07T05Bytes,
    M07_T04_SOURCE_AUDIT_RECONSTRUCTION_PATCH,
  );
  assert.equal(staleM07T04Bytes.byteLength, 252_188);
  assert.equal(
    createHash("sha256").update(staleM07T04Bytes).digest("hex"),
    "94d1d9f02af9d564ebe4dd2c5b36fc0f7bab4d28cad87ca144ddb41756dd1c17",
  );
  return applySourceAuditReconstructionPatch(
    staleM07T04Bytes,
    M07_T03_SOURCE_AUDIT_RECONSTRUCTION_PATCH,
  );
}

function hasEvidenceCode(expectedCode) {
  return (error) => {
    assert.ok(error instanceof PublisherPublishResultEvidenceError);
    assert.equal(error.code, expectedCode);
    return true;
  };
}

test("accepts exact deterministic M06-T01 Publisher result evidence", async () => {
  const result = await verifyPublisherPublishResultEvidence();

  assert.equal(result.result, "PASS");
  assert.equal(result.reviewedRuntimeExports, 7);
  assert.equal(result.reviewedTypeExports, 15);
  assert.equal(result.pipelineStages, 16);
  assert.equal(result.publisherDiagnosticCodes, 2);
  assert.equal(result.packageTests, 13);
  assert.equal(result.compilerNegativeCases, 9);
  assert.equal(result.rootMutationTests, 12);
  assert.equal(result.parseRejectionVectors, 5);
  assert.equal(result.trackedFiles, 10);
  assert.match(result.artifactSha256, /^[0-9a-f]{64}$/u);
});

test("two independent Publisher evidence builds are byte-identical", async () => {
  const first = await buildPublisherPublishResultEvidence();
  const second = await buildPublisherPublishResultEvidence();

  assert.equal(first.artifactBytes.toString("hex"), second.artifactBytes.toString("hex"));
  assert.equal(first.artifactSha256, second.artifactSha256);
  assert.equal(
    first.artifactSha256,
    "aefed86741562bfa0f4bcbe163af50c8471dd6bf5979b7da36d681728536ff63",
  );
  assert.equal(first.artifact.prerequisite.historicalArtifactRewritten, false);
  assert.deepEqual(first.artifact.prerequisite.currentCompatibilityOwnershipPaths, [
    "scripts/generate-reference-host-web-source-audit-proof.mjs",
    "scripts/lib/reference-host-web-source-audit-proof.mjs",
    "scripts/verify-reference-host-web-source-audit.mjs",
    "tests/reference-host-web-source-audit.test.mjs",
  ]);

  const currentCompatibilityBytes = Object.fromEntries(
    await Promise.all(
      [
        "scripts/lib/reference-host-web-source-audit-proof.mjs",
        "tests/reference-host-web-source-audit.test.mjs",
      ].map(async (relativePath) => [
        relativePath,
        await readFile(new URL(`../${relativePath}`, import.meta.url)),
      ]),
    ),
  );
  const projected = await buildPublisherPublishResultEvidence({
    verifySnapshot: false,
    trackedFileBytes: currentCompatibilityBytes,
  });
  assert.deepEqual(projected.artifactBytes, first.artifactBytes);

  const sourceAuditProofPath = "scripts/lib/reference-host-web-source-audit-proof.mjs";
  const staleM07T03Bytes = reconstructM07T03SourceAuditProof(
    currentCompatibilityBytes[sourceAuditProofPath],
  );
  assert.equal(staleM07T03Bytes.byteLength, 246_554);
  assert.equal(
    createHash("sha256").update(staleM07T03Bytes).digest("hex"),
    "2bf728948372d8366f7badc7f2d7a36f6b8799b0dcc45baef92c29c90bdd2114",
  );
  await assert.rejects(
    buildPublisherPublishResultEvidence({
      verifySnapshot: false,
      trackedFileBytes: { [sourceAuditProofPath]: staleM07T03Bytes },
    }),
    hasEvidenceCode("PUBLISHER_G05_COMPATIBILITY_READER_DRIFT"),
  );

  const compatibilityPaths = Object.keys(currentCompatibilityBytes);
  for (const [relativePath, bytes] of Object.entries(currentCompatibilityBytes)) {
    await assert.rejects(
      buildPublisherPublishResultEvidence({
        verifySnapshot: false,
        trackedFileBytes: { [relativePath]: Buffer.alloc(0) },
      }),
      hasEvidenceCode("PUBLISHER_G05_COMPATIBILITY_READER_DRIFT"),
    );
    const substitutedPath = compatibilityPaths.find((candidate) => candidate !== relativePath);
    assert.notEqual(substitutedPath, undefined);
    await assert.rejects(
      buildPublisherPublishResultEvidence({
        verifySnapshot: false,
        trackedFileBytes: { [relativePath]: currentCompatibilityBytes[substitutedPath] },
      }),
      hasEvidenceCode("PUBLISHER_G05_COMPATIBILITY_READER_DRIFT"),
    );
    const tampered = Buffer.from(bytes);
    tampered[Math.floor(tampered.byteLength / 2)] ^= 1;
    await assert.rejects(
      buildPublisherPublishResultEvidence({
        verifySnapshot: false,
        trackedFileBytes: { [relativePath]: tampered },
      }),
      hasEvidenceCode("PUBLISHER_G05_COMPATIBILITY_READER_DRIFT"),
    );
    await assert.rejects(
      buildPublisherPublishResultEvidence({
        verifySnapshot: false,
        trackedFileBytes: {
          [relativePath]: Buffer.concat([bytes, Buffer.from("\n// unreviewed successor\n")]),
        },
      }),
      hasEvidenceCode("PUBLISHER_G05_COMPATIBILITY_READER_DRIFT"),
    );
  }

  await assert.rejects(
    buildPublisherPublishResultEvidence({
      verifySnapshot: false,
      reviewedG05CompatibilityReceiptHistory: {},
    }),
    hasEvidenceCode("PUBLISHER_OPTIONS_INVALID"),
  );
  await assert.rejects(
    buildPublisherPublishResultEvidence({
      verifySnapshot: false,
      reviewedG05CompatibilityReceiptHistory: {
        "scripts/lib/reference-host-web-source-audit-proof.mjs": [
          {
            task: "caller-substitution",
            bytes:
              currentCompatibilityBytes["scripts/lib/reference-host-web-source-audit-proof.mjs"]
                .byteLength,
            sha256: "0".repeat(64),
          },
        ],
      },
    }),
    hasEvidenceCode("PUBLISHER_OPTIONS_INVALID"),
  );
  await assert.rejects(
    buildPublisherPublishResultEvidence({
      verifySnapshot: false,
      trackedFileBytes: {
        "scripts/lib/publisher-publish-result-proof.mjs": Buffer.from("caller authority"),
      },
    }),
    hasEvidenceCode("PUBLISHER_OPTIONS_INVALID"),
  );
  const accessorOptions = { verifySnapshot: false };
  Object.defineProperty(accessorOptions, "trackedFileBytes", {
    enumerable: true,
    get() {
      return currentCompatibilityBytes;
    },
  });
  await assert.rejects(
    buildPublisherPublishResultEvidence(accessorOptions),
    hasEvidenceCode("PUBLISHER_OPTIONS_INVALID"),
  );

  const compatibilityPath = "scripts/lib/reference-host-web-source-audit-proof.mjs";
  const poisonedCandidate = Buffer.from(currentCompatibilityBytes[compatibilityPath]);
  poisonedCandidate[Math.floor(poisonedCandidate.byteLength / 3)] ^= 1;
  const originalEntries = Object.entries;
  try {
    Object.entries = (value) => {
      if (
        Object.getPrototypeOf(value) === null &&
        Object.keys(value).length === 1 &&
        Object.hasOwn(value, compatibilityPath)
      ) {
        return [[compatibilityPath, currentCompatibilityBytes[compatibilityPath]]];
      }
      return originalEntries(value);
    };
    await assert.rejects(
      buildPublisherPublishResultEvidence({
        verifySnapshot: false,
        trackedFileBytes: { [compatibilityPath]: poisonedCandidate },
      }),
      hasEvidenceCode("PUBLISHER_G05_COMPATIBILITY_READER_DRIFT"),
    );
  } finally {
    Object.entries = originalEntries;
  }

  const originalFreeze = Object.freeze;
  let freezeSubstitutions = 0;
  try {
    Object.freeze = (value) => {
      if (
        value !== null &&
        typeof value === "object" &&
        Object.getPrototypeOf(value) === null &&
        Object.hasOwn(value, compatibilityPath)
      ) {
        freezeSubstitutions += 1;
        return { [compatibilityPath]: currentCompatibilityBytes[compatibilityPath] };
      }
      return originalFreeze(value);
    };
    await assert.rejects(
      buildPublisherPublishResultEvidence({
        verifySnapshot: false,
        trackedFileBytes: { [compatibilityPath]: poisonedCandidate },
      }),
      hasEvidenceCode("PUBLISHER_G05_COMPATIBILITY_READER_DRIFT"),
    );
    assert.equal(freezeSubstitutions, 0);
  } finally {
    Object.freeze = originalFreeze;
  }
});

test("rejects stale or one-byte-tampered Publisher evidence and documentation pins", async () => {
  const pristine = await buildPublisherPublishResultEvidence();
  const tampered = Buffer.from(pristine.artifactBytes);
  tampered[tampered.length - 2] ^= 1;

  await assert.rejects(
    verifyPublisherPublishResultEvidence({ artifactBytes: tampered }),
    hasEvidenceCode("PUBLISHER_ARTIFACT_DRIFT"),
  );

  const proofText = await readFile(
    new URL("../docs/proof/PUBLISHER-PUBLISH-RESULT.md", import.meta.url),
    "utf8",
  );
  await assert.rejects(
    verifyPublisherPublishResultEvidence({
      proofText: proofText.replace(pristine.artifactSha256, "0".repeat(64)),
    }),
    hasEvidenceCode("PUBLISHER_PROOF_PIN_DRIFT"),
  );
});

test("rejects pipeline, diagnostic-registry, and finite-limit drift", async () => {
  await assert.rejects(
    buildPublisherPublishResultEvidence({
      verifySnapshot: false,
      pipelineStages: [...PUBLISH_PIPELINE_STAGES].reverse(),
    }),
    hasEvidenceCode("PUBLISHER_STAGE_ORDER_DRIFT"),
  );

  await assert.rejects(
    buildPublisherPublishResultEvidence({
      verifySnapshot: false,
      registry: Object.freeze(PUBLISHER_DIAGNOSTIC_REGISTRY.slice(1)),
    }),
    hasEvidenceCode("PUBLISHER_DIAGNOSTIC_REGISTRY_DRIFT"),
  );

  await assert.rejects(
    buildPublisherPublishResultEvidence({
      verifySnapshot: false,
      sourceLimits: { ...PUBLISH_SOURCE_JSON_LIMITS, maxJsonDepth: 255 },
    }),
    hasEvidenceCode("PUBLISHER_LIMIT_PROFILE_DRIFT"),
  );
});

test("rejects C-011 or PIPE-025 trace ownership drift", async () => {
  const trace = JSON.parse(
    await readFile(
      new URL("../docs/proof/protocol-0.1.0-traceability.json", import.meta.url),
      "utf8",
    ),
  );
  trace.pipelineSteps.find(({ id }) => id === "PIPE-025").owners = ["M06-T99"];

  await assert.rejects(
    buildPublisherPublishResultEvidence({ verifySnapshot: false, trace }),
    hasEvidenceCode("PUBLISHER_TRACE_DRIFT"),
  );
});

test("rejects a public partial parser or wildcard export", async () => {
  const indexSource = await readFile(
    new URL("../packages/publisher/src/index.ts", import.meta.url),
    "utf8",
  );

  await assert.rejects(
    buildPublisherPublishResultEvidence({
      verifySnapshot: false,
      indexSource: `${indexSource}\nexport * from "./source-json.js";\n`,
    }),
    hasEvidenceCode("PUBLISHER_PARTIAL_API_EXPOSED"),
  );

  await assert.rejects(
    buildPublisherPublishResultEvidence({
      verifySnapshot: false,
      indexSource: `import { parseSourceJson as hiddenParser } from "./source-json.js";\n${indexSource}\nexport { hiddenParser as publishRaw };\n`,
    }),
    hasEvidenceCode("PUBLISHER_PARTIAL_API_EXPOSED"),
  );

  const declarationIndexSource = await readFile(
    new URL("../packages/publisher/dist/index.d.ts", import.meta.url),
    "utf8",
  );
  await assert.rejects(
    buildPublisherPublishResultEvidence({
      verifySnapshot: false,
      indexSource: `${indexSource}\nexport { publishRaw } from "./source-json.js";\n`,
      declarationIndexSource: `${declarationIndexSource}\nexport { publishRaw } from "./source-json.js";\n`,
    }),
    hasEvidenceCode("PUBLISHER_PARTIAL_API_EXPOSED"),
  );

  await assert.rejects(
    buildPublisherPublishResultEvidence({
      verifySnapshot: false,
      indexSource: `${indexSource}\nexport { createPublishFailure } from "./publish-diagnostics.js";\n`,
      declarationIndexSource: `${declarationIndexSource}\nexport { createPublishFailure } from "./publish-diagnostics.js";\n`,
    }),
    hasEvidenceCode("PUBLISHER_PARTIAL_API_EXPOSED"),
  );

  await assert.rejects(
    buildPublisherPublishResultEvidence({
      verifySnapshot: false,
      declarationIndexSource: declarationIndexSource.replace(
        "PublishResult,",
        "ChangedPublishResult,",
      ),
    }),
    hasEvidenceCode("PUBLISHER_PUBLIC_API_DRIFT"),
  );
});

test("rejects forbidden platform edges and dependency drift", async () => {
  await assert.rejects(
    buildPublisherPublishResultEvidence({
      verifySnapshot: false,
      productionSource: 'import "node:fs";\nexport const value = process.cwd();\n',
    }),
    hasEvidenceCode("PUBLISHER_PLATFORM_BOUNDARY_DRIFT"),
  );

  const publisherPackage = JSON.parse(
    await readFile(new URL("../packages/publisher/package.json", import.meta.url), "utf8"),
  );
  publisherPackage.dependencies.react = "19.2.4";
  await assert.rejects(
    buildPublisherPublishResultEvidence({ verifySnapshot: false, publisherPackage }),
    hasEvidenceCode("PUBLISHER_DEPENDENCY_DRIFT"),
  );

  const brokenEntry = structuredClone(publisherPackage);
  delete brokenEntry.dependencies.react;
  brokenEntry.exports["."].types = "./dist/missing.d.ts";
  await assert.rejects(
    buildPublisherPublishResultEvidence({
      verifySnapshot: false,
      publisherPackage: brokenEntry,
    }),
    hasEvidenceCode("PUBLISHER_PACKAGE_ENTRY_DRIFT"),
  );

  const publicParserSubpath = structuredClone(brokenEntry);
  publicParserSubpath.exports["."].types = "./dist/index.d.ts";
  publicParserSubpath.exports["./source-json"] = {
    types: "./dist/source-json.d.ts",
    import: "./dist/source-json.js",
  };
  await assert.rejects(
    buildPublisherPublishResultEvidence({
      verifySnapshot: false,
      publisherPackage: publicParserSubpath,
    }),
    hasEvidenceCode("PUBLISHER_PACKAGE_ENTRY_DRIFT"),
  );
});

test("rejects a parser that exposes partial data or a Bundle on failure", async () => {
  const parser = () =>
    Object.freeze({
      ok: false,
      stage: "json-parse",
      bundle: Object.freeze({}),
      value: Object.freeze({}),
      diagnostics: Object.freeze([]),
    });

  await assert.rejects(
    buildPublisherPublishResultEvidence({ verifySnapshot: false, parser }),
    hasEvidenceCode("PUBLISHER_PARSE_VECTOR_FAILED"),
  );
});

test("rejects root command-wiring and G05 prerequisite drift", async () => {
  const workspacePackage = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );
  workspacePackage.scripts["verify:publisher-publish-result"] = "echo skipped";
  await assert.rejects(
    buildPublisherPublishResultEvidence({ verifySnapshot: false, workspacePackage }),
    hasEvidenceCode("PUBLISHER_COMMAND_WIRING_DRIFT"),
  );

  const publisherPackage = JSON.parse(
    await readFile(new URL("../packages/publisher/package.json", import.meta.url), "utf8"),
  );
  for (const script of ["build", "typecheck"]) {
    const changed = structuredClone(publisherPackage);
    changed.scripts[script] = 'node --eval "void 0"';
    await assert.rejects(
      buildPublisherPublishResultEvidence({
        verifySnapshot: false,
        publisherPackage: changed,
      }),
      hasEvidenceCode("PUBLISHER_COMMAND_WIRING_DRIFT"),
    );
  }

  const publisherTsconfig = JSON.parse(
    await readFile(new URL("../packages/publisher/tsconfig.json", import.meta.url), "utf8"),
  );
  const withoutTestInclude = structuredClone(publisherTsconfig);
  withoutTestInclude.include = withoutTestInclude.include.filter(
    (pattern) => !pattern.startsWith("test/"),
  );
  const excludingTests = structuredClone(publisherTsconfig);
  excludingTests.exclude = ["test/**/*"];
  const withoutTypeChecking = structuredClone(publisherTsconfig);
  withoutTypeChecking.compilerOptions.noCheck = true;
  for (const changed of [withoutTestInclude, excludingTests, withoutTypeChecking]) {
    await assert.rejects(
      buildPublisherPublishResultEvidence({
        verifySnapshot: false,
        publisherTsconfig: changed,
      }),
      hasEvidenceCode("PUBLISHER_COMPILER_CONFIGURATION_DRIFT"),
    );
  }

  const publisherBuildTsconfig = JSON.parse(
    await readFile(new URL("../packages/publisher/tsconfig.build.json", import.meta.url), "utf8"),
  );
  publisherBuildTsconfig.compilerOptions.rootDir = ".";
  await assert.rejects(
    buildPublisherPublishResultEvidence({
      verifySnapshot: false,
      publisherBuildTsconfig,
    }),
    hasEvidenceCode("PUBLISHER_COMPILER_CONFIGURATION_DRIFT"),
  );

  const prerequisite = await readFile(
    new URL("../docs/proof/artifacts/reference-host-web-0.1.0-source-audit.json", import.meta.url),
  );
  prerequisite[0] ^= 1;
  await assert.rejects(
    buildPublisherPublishResultEvidence({
      verifySnapshot: false,
      prerequisiteBytes: prerequisite,
    }),
    hasEvidenceCode("PUBLISHER_PREREQUISITE_DRIFT"),
  );
});

test("keeps T01 evidence byte-stable for later unrelated exports and diagnostics", async () => {
  const [indexSource, declarationIndexSource] = await Promise.all([
    readFile(new URL("../packages/publisher/src/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../packages/publisher/dist/index.d.ts", import.meta.url), "utf8"),
  ]);
  const baseline = await buildPublisherPublishResultEvidence({ verifySnapshot: false });
  const futureDefinition = Object.freeze({
    code: "run.desen.publisher/FUTURE_WARNING",
    meaning: "A later Publisher task warning.",
    defaultStage: "source-semantics",
    defaultSeverity: "warning",
  });
  const registry = Object.freeze([...PUBLISHER_DIAGNOSTIC_REGISTRY, futureDefinition]);
  const lookup = (code) => registry.find((definition) => definition.code === code);
  const guard = (code) => lookup(code) !== undefined;
  const future = await buildPublisherPublishResultEvidence({
    verifySnapshot: false,
    indexSource: `${indexSource}\nexport { futurePublisherEntry } from "./publisher.js";\n`,
    declarationIndexSource: `${declarationIndexSource}\nexport { futurePublisherEntry } from "./publisher.js";\n`,
    registry,
    lookup,
    guard,
  });

  assert.deepEqual(future.artifactBytes, baseline.artifactBytes);
});

test("derives and enforces focused runtime, compiler, and root-test inventory", async () => {
  const [packageTestSource, compilerTypeSource, rootTestSource] = await Promise.all([
    readFile(new URL("../packages/publisher/test/publish-result.test.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../packages/publisher/test/publish-result.types.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("./publisher-publish-result.test.mjs", import.meta.url), "utf8"),
  ]);
  for (const override of [
    { packageTestSource: packageTestSource.replace("  it(", "  untrackedCase(") },
    {
      compilerTypeSource: compilerTypeSource.replace("@ts-expect-error", "@untracked-type-error"),
    },
    { rootTestSource: rootTestSource.replace("\ntest(", "\nuntrackedTest(") },
  ]) {
    await assert.rejects(
      buildPublisherPublishResultEvidence({ verifySnapshot: false, ...override }),
      hasEvidenceCode("PUBLISHER_TEST_INVENTORY_DRIFT"),
    );
  }
});

test("atomic evidence writer rejects destination symlinks and pre-rename byte tampering", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-publisher-proof-"));
  t.after(() => rm(directory, { force: true, recursive: true }));

  const symlinkTarget = path.join(directory, "target.json");
  const symlinkPath = path.join(directory, "artifact-link.json");
  await writeFile(symlinkTarget, "{}\n");
  await symlink(symlinkTarget, symlinkPath);
  await assert.rejects(
    writePublisherPublishResultEvidence({ artifactPath: symlinkPath }),
    TypeError,
  );

  const tamperedPath = path.join(directory, "tampered.json");
  await assert.rejects(
    writePublisherPublishResultEvidence({
      artifactPath: tamperedPath,
      beforeAtomicRename: async ({ temporaryPath }) => {
        await writeFile(temporaryPath, "tampered\n");
      },
    }),
    TypeError,
  );
  await assert.rejects(readFile(tamperedPath), { code: "ENOENT" });

  assert.equal(
    path.basename(DEFAULT_PUBLISHER_PUBLISH_RESULT_ARTIFACT_PATH),
    "publisher-0.1.0-publish-result.json",
  );
});
