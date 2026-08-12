import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { brotliDecompressSync } from "node:zlib";

import * as publisherPublicApi from "../packages/publisher/dist/index.js";
import {
  PUBLISH_EXECUTION_PREFLIGHT_LIMITS,
  preflightPublishExecution,
} from "../packages/publisher/dist/execution-preflight.js";
import * as validatorPublicApi from "../packages/validator/dist/index.js";
import {
  buildPublisherExecutionPreflightEvidence,
  DEFAULT_PUBLISHER_EXECUTION_PREFLIGHT_ARTIFACT_PATH,
  PublisherExecutionPreflightEvidenceError,
  verifyPublisherExecutionPreflightEvidence,
  writePublisherExecutionPreflightEvidence,
} from "../scripts/lib/publisher-execution-preflight-proof.mjs";

const M07_T11_SOURCE_AUDIT_RECONSTRUCTION_PATCH = `
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
`.replaceAll(/\\s/gu, "");

const M07_T11_SOURCE_AUDIT_TEST_RECONSTRUCTION_PATCH = `
G0opAJwFdsP15OaieQ1+FCmbew3SsuLzWqq9z5/XHtfQWKjYKU3pTU4rGNYXPDLSsCjuzZKisNNUlzvLFEVdkExk3/kL20Zb/O+X
fbMzsyEDwiIx+icNTvHvvadv8abfTNGzMxtyE1J6qfttyMESogK7kmgsQmXrv3BrJMJYHkN1v+9tgqioYNCkWTclxHSmYUy6EdRh
8c1LAdkXvRsqH7l8Phr06Ufu+nFX0leKkdpN3KpHs9mEmKQ/HPtBFQ+SunyqaKYjfqPHDR7b2yAWWmo0F1pybG83qNKSX2ur5ceL
GOTFzOfv6WPz8bdqHifqWyJPo891GHflpiaCulEQwIA1Jmw/1o5wIhZErRXRuCHytFsc1sJwIgIk00Akt3wuViyDcuJ3waVGMMTD
hbG0bMiJZy5v/FDzgi+v3+lcbXRxmvFpPpY6+ckcMhxoIv55YoL8Jb1e1UKKxeYNLYSYb8YA87Hhle/BA0zW0nkzbCeP1Ln5fxL/
L1Pi1eMQHHRzldS/rNSy1wBwQ3jhwP4OD7trBGAduufCalg2FXkfA77Sn7jwqNB5NDvhMT8/2OOYEoFk0Y23tc2ZL96iVH64r83X
DgsKsgEk3PNfB2R0dTFLtvRpVAPS5wx74IJQjJFKHbD/1dm38bi9smzFxIQ66UkXYmUaW7Duf43PLabZDvO6U6h1cmdh+SR5o3i6
9T3KaLJmfZJCCeO0iAZaR5HQlZJNsiLqYi7IuHMjyqsdGW5QRr1zTVoRa5k8qnMrq7rae7a9e2pjlVKrclYxj97tGMqshgRwRf2B
A/uNRVmh1EDMx7z4vX3S5WC7tZctazxhCeJrGCUL2Mk7/EnSwh4PfClG9rUUpJ+wV1oy5NGqcWjaCMBwg8yAvxGtaVOO/amDno2V
Q6PgwqiYTZHHqOVUcYaMPrTh85KL878Lwv1PORZfnRDDaN7vqN2nEl5ZQI44a3fC95b8S7Yiff0dMNVd9FIgE6nP0pty79DW/i5C
vyrl/rfjh92uxoSvXOWTdv1bdH3Self2PMWyCGhgkWuMmoerVuSD5q67Pg0QUQ/VHagjp528Csm9VZd7r/bpmpb0bLV+CLtI6uqk
Nv0FIoH8r4pCIgTcuUIkI+nkiiQGQx35i1v679taVQ84KmAZpnz53VYApp0M4j6yHyldrA35WJcaCPG4FG44l15bnxgkqszk2UBZ
au7cFdAz+Skzajy/3ihgR1FM2Ni3zJbOW6rvYBRQ+nJz4fyJ1jl0X4Z9oG3s8IG29TJYpouWsfq3T0L2NwM6Ad6etgDQvXrLtI0l
JuyL2TJxtSK1U9f3eXi7mIV1ubec72a/pk68gAu448hJ0o37HKVDOp3NiTXk9zZM0hYAteCBpso9YnbeczQIT0axzlba5EH9VuLf
PZsp0UQPNRNSIYdTPyHIBdkQUn8uUnoxUHB2tNRviBQ9GXJ4gu5d8tqDFUI8U1vya+uXpC47tLYdh+ypAZiPpf8vit/tO3f7J7/A
Ovz+2Mf+7clhh1XXGRtR1NAkgmkpw8y27616rygt8mYASd0AhEoZft137JA5ldcMilREFZ8aIg7WzCfJLuE280b2X5/hZ5ZVZRww
/Rk7bGtp/K6QqC7ZEGKnDFGjgIysBmv1MsPMvpAlgy7vp7eNoWaIQ5CHShS84xGgkTYsnwaPumGlPH43ZW39vjM9H9ExsNb11Ish
k9DCdT2LmBjK+jO5Lg2Vlp4kUJ8mx53q9gAYRSSAUjOIPHrT/Zmy1fkSW6mX/Jw32vDKlhditcOOeXEQzE/MAcEkwp/iMYhLSnjY
xeQtCRFFVOW/2peYXXnDrClVtrzSB5VYE2DJW+jgIlH/8nw1JF+hLE/UuE77TG9Roak46lgAhtT8avi7m1U1zDjr7/i8E/Prw0K5
2hC6aHmut6g+iUQrFrLTDyy47Rw6YDkvbUlyGXFW7Q3JIB3CzVsrYy1qkLEn416+s6CfDqEnuiiEqB5pYq866rPBqCRpL/C0Md/j
yDUhHTODOsPl1C/Wbf3K/aIH7Oa5q+CnbTw41dWd1tEiqUNnNJtnQh0Scjftjn1lJd6oVL2n3OVBPEDl5xciUy+Ye/6eM/8o9ujH
AppgaCSQGhLkSGccx4h3HnG2Isun0iv5YvK/wC0YvZJLgoD0nE6NicZgVCStgUPnxILYPLZ0mlpYA2ooKicn597cc9SRiTMHPJTy
ZMVydfyBZe+eq/4GfsXc8+92W5b+QlrTQ/KcDx45WXQC8HusIBxe95t7k/1R52U5SOfcYqtBKO3ahKC+mBhmRSGxk5j887hw4IYm
3XmQMZWumEThThHTj3cUxnqGhgzYclGOj/2zOPi/1pN14YWxfVT7OLZMhOOjR3guP+ux3o59+G8pe7q0dwRcW8fnfe26ZW3HwPcA
Q0QI7r+hUZVjKme+eCK3GrAFQAMiKT+RDdnXV+alMSXIxVwKb06JFq5tKfb32gZxalNlbGfmZ07zRxggSUwL2DKPDW0cyxmpkgjU
iCmeiXKVVAkqn3zKxlKFSvo50LwtzNUkfLADiDaxdPxdm1L6BEJXhsEEZLICcYGr3bEnJlgVXXUg8HLZN5hWDx5qOkEeBUbgmIIC
xhpG2Ewke8UlApvLiC89aVPZy5BbH+JmwrozOySVD/AtPwMPA7pDYQtGmbDW6MIem3VZ+5CZZSjIodA7yUKULUh2T7y7m7Lapova
x+te8IjqZbjBCKGQX1UA3359IJv6n8XhsqWV+6TenbPa98TKBFPoSS8L+2gseMTm3auLXz4J81bojus/GOMIClX2yXj/6qKzDAyS
NXYDFnBsHPSWwpCP69adfPEViKg+m/cmz4sTz8XBHZhz/ifuyp3X4QIIGMxOGnOBk1wxftgMwIyQvFait+5oWXl0M9kbj0Pu9Zyh
YeTeYNBtAUkOdCiomEf7FoQo0Jh2lJD5eu6cheBKU/SsSS7uuQnETUgzv1NUdZKaMvh9SSjXEsxwVmo6GIE7xbx28w+XFtOyJ8yC
Yq4OQL6Wey6pUFxYl2zz+2ZJS7GSjkUM5+IgGoli8O6Ic6X0SHFt4ltrUVzPXqMgmvfDQDVZejJE2arSRwpj+a9TQ2HkNdrH4YCN
Hvfr9Sd2t7a6mL/fkyyK4pvC6NPG9mCOgVipEYyiLuzrI42ENpqV7On/L/Q3K9rq1SZVOvlha7KTp/OTHE0+x4JcgJmfMYfGcmZu
6X5z5Td5je0g+8JGW22ekTmQzo38yJO8
`.replaceAll(/\\s/gu, "");

const M07_T10_SOURCE_AUDIT_RECONSTRUCTION_PATCH = `
G0AjICwG3N0Tahz+QFrV97NjD0tUYJCp+1degp6G28nx/xiYqsSx6RJkpcV/bNM7l9Mr0ww+0nrWzI+uwbYA1aRi8O/aUjUujSdY
jCc7dcWDc2L8CaKg83/7fcMtwUYSidBdI6n+f2fuu+eL2SZcZubpmibEJCST0jVWQqGEldBIDd8f2s6Jg3PVHqSQfMIonT7ffFWW
gehPGUQ+SPf7pYr8iHgprLgz536i46NlHWKGxPoaeL1cQ3r1WarsT6TuxsPr12vh3jSYJyRy1ddEgbo9luM4AauenIBwXjV/nMGI
PyO11befjSviW+B7uoV92uVk94j6mJHnozi/CLLyepz+2DLdX1mAL+ZaAOwBSvhqqwrpmNNc32zV/eXcLAvkPFA7caUpQ5LJcDaF
qZ/ojzsaOdYm9/KQgOceBwJOxu96C9rHC4QA9VEirdJ40oeeg2DppdSR0/ZewewZ9oc9qCcjr2dmclIaUv1cQ4I6Yv7iRIXcZzlJ
Up32/ffD5FB5nlf2tsbC3EGWKC17uqFUGx5bIAXFLA2nGrc2AgmYDdr8RoaNci2PrhVW5jJMarRqo0ROWa+FzvAtuBfYHNuwIcy2
odOuvkYiRxfE2cHW5Ab5ptvldeRwqJ8DPinYvRLN0xujhUk1V/1ulB+H6H9ZNTe/u6Gn0yRpgO7UhiuJR3mqtW/WniDZsR19whK9
1YzpJIrqxbKRXDwZDscL52zmah6wmOV+ik6VmQrG6Q74rA0ZIlDywfUmXnbOFrwsMyqVQodsdS4y/UNXljI3GC45ZTHe0Hc7yBWc
4AALgfs11/LxJKnv1winFdnd3DwQLp6wE0Uaysdl7zaphaSpVyDOacDXYa9NNC3aYMQjt7I6NavDbJ6OISiE0N1F+7yiVH3jghfz
GmqZJvI2JA6LcnWFdKEOoTMdCkIXIoL+L0AhskzDBlCq/4Y369t1rL/+RNbDtjdUTXUqiEZX1vGqJEytHQUhLa0VAeww9ut8YDrC
694LhMU2i1Tss/vMZBwNVMfwAc2GhxAwOy2OMljW3oiY9uq2hsPe5MN+30d1/OK+XsAvkNfEeGGmxegbsUr12AKwp4O13bbzXQ9Z
qmGu73ANTl3wziqx1PjUXfWPfBdrqlg9ZYvB4GpvvWd5WW1/LGfDzczK4jp6uxtX2HPFGebqzuSHQ2n0B6ZjXFXFsjw1V3HbJedm
EkgAnjmvtAa1jor6idPz+gs6LDI7B8wi3iBuWKs6GEOcDmS/zqf3ubp6afyP9p8/r+jn/js3psWQGCHUbaaiMOItAVdkC+C7Xn0C
SQ6O7ZqESMcZ4NWhBPh1ir+PVvsiSycE/DjFzLMSjGnBQ2cl1hSMVUSYedJtMEZwaNGfENDQdU1jx4AMt4CuQ6oMgkuiyQXbTpA+
wissFGZYBuK0lRiVxIgL+ChQhv8MnFwMZhMFYW1altW6Kaw8mNiEtyzojeMV7aCmIyV4QA7PD97tzkwgl409Rm2g7GsIgPzPZYf3
KthqTbAIcvvoby/oDhbvfZjR1+wIhMyfktGlT14ZtvsdGlGfVlH6ont4MNLspGmaQE9HXLx0PVNaQ1eYQ/aZMkW9zMhxXxGzNot0
erU4zC5NTmDng/VCaq4rPhr5rG+vsr4JBoVNgbSmDO7szUp/1pX1p+BKuEeZ8hr5zPr55YTAFf97Dxt5bU9XVDhvM8FkjoUg1SG7
3hSNMDPof6lREQKhUicNgC54kxTWpjD9W05028CY+taXKOlz7pKLHmZgidKevXBbqKsrrKl2ibJPjfQMVAcZgmDoIzjeL91jLJA7
H6xHuwI4kET9bEsdwLDxIbyK+0Vh/E8KKh2t/bf79ioqHdtkrcR6zgHvb6qyn/y2gH76Yg7EJIXsX+DY5Qv4tc//3j/mmYh3nfz9
67whxZ7l6nb0LfqQtAw++1/sYNufhD0PfMQftmgvRKmI3V2xtKhAcuHd3s6yqoLDNC6KFdmdCtRQlMjzM+BPKchpTT061Fq4vJU3
P1mIyrT3BBflklz5Tq8P2n+H0EGl21PpkitX5tpyd+hYTzW7zBA0Q0xFu8wQNENNVVMpQtQVYYg7ETmzGElRp9lSFNY0MhuMePB3
FY3SgbrgVG1aiHJZ3DQW3JkFJTa5aqC+QbCCl9JLn/ae+v84UX1W+KaaAKp4iFKqtlhamYtQrcJUYswxrMEoVSpEm/PS6mUjKd5N
m61pszVTw5Pi0GGOUuhkgPmDFSR3DKiiJF9N8Ut2r/o07cvQJw==
`.replaceAll(/\s/gu, "");

const M07_T10_SOURCE_AUDIT_TEST_RECONSTRUCTION_PATCH = `
G/AVIJwHxs3yFiH0RtQogq2PkND8T53uXqZ3f3LgBwDGTCWUBa0Cis6SW84VkJanK/2Manxv4SvPnKMcyBVMzH37NRFNdBopnMd2
Mzv739s7RzSJ6jfUIh6KZ7VUSJEQSfnTiIRYeX/Y//s0CUm8tvtqZY0B85uNyOoE56t7QTCWLfypM4bwdbIolI21qEOsnfYBwo4r
YV7f2cx0DS5/a2Oaxvmi2QAV+cyMxhEnlUoFlesWC3CbeNvyzfkfmAdTqkkGBsrpErg1gkFJj+ZbBTL4Qu2kwuqdswK+lZKAnrrg
lOhgwe+tdWCeOsoE6msnFKpolMYWiIBRB22byL/VF5VbnNDdeuyoJuvto6Cp0evcmfsooU42Rq2IHpXrpq+buaQK2rHnMgC1vog0
YW6MplexP0eWemGMYyEt6AcPNEMh+VAnx3S/gAYi8ArW8bIsnTO6bGTcCHv8atCr9sijfuSeIp7z/USwwBHntwU9XQKkWbMqfiEE
gfEb6g0S3od6o0H2+1YW3tYH5BK6gymqVPwCkH1HHUZovXTA/70+F58X79k6+lsUvn96duW2Vqob8E57qBxohKb6+ZrBGHBaavRt
FstbPZtWWdYp4gynIgchLhh5lY9Av6tGeeE46DTmroKZ/IxgiSRW5z74YY+xQLN51QEwRiUioJk8mtPGMMWlp0TiDGhXJkrdO61b
hVLUx2417zGfTg8zYvojt6sF1Z2Zhpuwe/HaDCONKI6RrdtLJM6d2eTtT7zE5f0gLhqbvq7G6nwEyqxwfJa85UYJIqj1Kr97/lNU
eZeDzbNv0hqZkS+oHFA28Za3zmmFHX0unUXw3GEfujXqqqoToGuu5FxZMnw2C76kKvmgcIBjbYWuFFEEX0aH7hJ4/RnseI6cAnUx
ap1wcljAgPESFv8UpCVMZ/hNYOBYXBAgzy7ECq2qKVJRzkJRR5KaQfW58kZfsUwsGRifsoF3lkq1zKM1QsYxVM7xpnqQgKYTZPHg
c2JEYpXOfFWP0z9yHAsNa56aAhla1AWbxfGYPlDdkD7KJl6+Cr0aKmrgCq8R5J0/gblK5xgLpYN2zHMm0jGXlnmaQvaNNFw0fEV9
/QNN+aad+FvjgaL09IPiGxkcqw7jpjR9M4ofaCTBpkBHGcMUT+4bCQ3wt8FRkHOblai0Od6CyjQCc+FoZGkIId1jYw1MAQF8OGoL
kNn1PfV9ZUkmXvl8VieI8hma5ySRsKVarMihWWl5/g5rQdVsdHLVjaB84qNUiRwlT3yjgEz4K+Wqv59xohXOZ2qmhBLkw0lJREGV
A9rTLqFJ151H6yLl6AVMe7wJA8vg/PrnuCwPS2t0aUMZjUHoDEXMeUyNlFAZPDW8oS2tbu2xyLOz4PvnqIoC8ghj4GgG+ajV0j+G
dhoDRX/cVNLqHGthcGqSRY6dEhjLv9IEQPW4qc+hFGeJcFdYoOPxI5XkpJAzb81lOfXSm/Zua+xoEabpW+PyLsdX52iUusaTIm3R
Awk9HAOo9AZUJxWNc59pDA==
`.replaceAll(/\s/gu, "");

const M07_T09_SOURCE_AUDIT_RECONSTRUCTION_PATCH = `
G/UiQJwFOZnXeEmf810xndTZY4doOORP95ifUT+ntwtQgIcTl6WlYK9BWlYU+o9teudyemXK4GP1rJkfXUNJt1+xpGIg6qbs5dTy
5OryZAdmWDJGkL1aK8OkCMpH+KijfxkgZX97p6erbvfunlmFQCU1vPuEKkDgSUe5SBvLwj8IF+Xi+2P++zcdvk6rEENyCUOc//TL
l1stEP2xRRZh9FTU5SyKR5ZYxXM5D4lMQJs6VFjS6gcQ9toGKmTgWLLvkWreq+P5Daefo+J8EiJXfUXE04NxfN/n66MnJ6Ci0dv8
8cfK/JnG995+Oa4ovtXxvdvCAWec7P27M9L8dhQ3NklV2VDQH1vq/ZUD+PKCEYAegITttapJjwXJdKNXDdYQzKZAPeKpCHNJcMU8
ZVwCSz/lP8FUFFifIsQzAmGoAsgplTAIlXcvFwjxGVAabafxpI+8z1BLTbqWuN8+x7lAfAV3fNgf9mCcTL7yZA9WyPdfSVS2fZ2T
XBvdj15b1ZDDX36R200gWCnop0Vn73ejjRWRBEJQuOLo5DLKnASg5l0ho5hmpwOLpYNBFi0sZ5Y5lBN59PslDEI0gG9BthUbbwTz
ZeiVqzc55OeqBJdnrizIGD2Pd1DDofnIRZTg/El4mC9mC6uNkH4H548zzL9Kzd03L5dq2pB3ZclKndZpsZa0xankTNWn6zuzO6lT
9qLq0kyM0AXUWgqD4FULrmS5dyxGee/lU3ZL4Yu5/5FcCxawULDB3SLeaMHVuawvKnNCd2t1HrH8Q6tHWRI+IjnHFGnomZ0XhkyY
j0W8U0ao2mTS0g8XFzvm1PZqixXJh5uuHpWpvC4rJNC36sNKaI6AsJHVTkkHZEsSr8vKWQJW82oR3kL/BXRi4YRu6nLfemCFty5e
6lzLRlpwlFcrlAo1A81iiIOhQ/TCLxghnqzBAtDUf8O5+iEF/W0UZ8flXsvRUzoUIXfNaapSgEA5ISXYFSfxXW7CdKGYSe5Otz0B
K+4HDB3ZcNJOxtnATEwfqGSeAF8RDjjFsNxchFhWgmQOZ4YP53BfzjHuPa7iF8hVKsRYpk3iu5qszcQmYM/e8lOwC0SdYo+ysb6j
vqw+5r36FVJqSBrO/avYxVonVjX9TVpwF7bZs1yrY3+sZqPdHlaOzDHUo7giex648lvdMfxcsEF/YDu5tXNTdW+zVaUbUPNkBAqA
DyYq3jg2UFnXiGuufnWHO5WiwSridPEgWe2DMeStPQ65N95Xcu0i/odz4W/E9n38boiUCJIchHrKUsQizsgFGtugvu/TF5Di4Dqt
SYd0zQBZLgsg5HZ9X8j6zIub+30Jln5WerHWO3Q88pt1sboHK0KGDcYALiz6BgIYhvCLyAwy2nK6AamyBVTEeuShbSVZI3zABl7G
KhAXrYSopEXcWEcBMvyPvcm0YJsmCGqxB8kcxCrjEpvj9gY9a7KyTdM2TqJ/JuDNLrLPQwjjsovGqR2Uc43wxz71dfiiQi1vTkWM
R0g+XSxFA74EWGnX7Usksl+yylnfA4xG/B0aRF9VYHPRPbywaP8GaFqAZyABXIbes1lTVZdT+IPyRF1eFLuvdLnNIWNhjQ1zS2v6
RY+0kJUb/I8GO/eNUM4bWFDRxKBlsTt+zpz4d1CgX4LZ2hFdLVIUp983r0GKPbHP0bDJ1/40NILrIyHlMVOxwfTYOyk6YQXO/9Kg
ICUS200JHT2wNiasMmEyd08zPeittF6hZLaZR6Z5WOkkKnt1wqx8wyQ4qlyJqq8JyRaITjIkvcIHN8GXiTHjseiRzosDMRTRDEdS
1Dd2AdhVvGwKkn+SWyEo+e/w7VVMBrbJQUnyTADBb6KKnnoq6JOXP19MUSj9DZz73BN/nYy+949FdpFdp/5wnRnUeGI1qefna30o
Wsaf+XfvYDuasN4IfEQfjkIvxKgZu7ta6VFA5MZ7vYMlNYKYRVyb55xqkUKNRIk6u2v9lIDi0qCjIdYjEK18yMimrKt7PKAmtzve
KBlbxtE/I3LQ5o5kU0BltpxvK4d+dZa5xE1BN8UsdImbgm6qWWoqRIimogzyWQDOKo+UqGmcFHW1jCwFE/9hw84o56vLTe0Vk2Vb
dlc0Fp6AghKazDJQfx7YKUvLS59mnc7/cc79TNjhlQCpeFlRqhZX2gGLUHvCRGLmF/Y6VNNlQNuF6PWyLRSfl/U4lffYVuSkKAxY
gBQ6BmD24IRiRlDGSH5YiUv2rvxpG8joJw==
`.replaceAll(/\s/gu, "");

const M07_T09_SOURCE_AUDIT_TEST_RECONSTRUCTION_PATCH = `
GzAVIJwHmZueZodSvBETkZWdv1ZT5H9TddcyvfuTJPvLvY+e0ioSkOCCOYGT3isgLTFtutDPKOJ/SQtwwJwrPJULmL9fa8ksMSRi
OI353vtvP/P31BKQRGTXUYl4F8ueGEqzWkh5L7QLkZAqz6HufwWsiGiIfXtaGq3B/GYC8hrDRWpBEExlL3+qnCEMZ3GWJmQO72R2
3HkIP3IkvH6zWjdczptlmtMDDnp9QfUzZjIuOKpUKqQ8N5+DWyyPk3eB7+D3eEw1ySBAJb4EaY1gUNOj+VaBAj6prFbYuTXq8H0U
BfTUBadEB+v84ayBeWqUCczXbshXUU9GHoiB0QbtkCi/zRf1e1zUbj06Dma9fRQ0NXoDJ283R8ijCUFJpkfjOvvKzSNV0Na/lwnU
/ypqw9sYT29jfvYs9cIYx0JasA4eWIZC8qEmxyw/gQUiyArWeFmLKhlfjpX97EXelsbVOPFoH3miCKdyuxgsSMTVbUDbC4A0a1bF
L4Q4MH5DY0HCOV9zGme37WPhTG1ALqEdTFHl4neA/DsoP0TzpbXz2+dL8XnxfpqGH5F//6i1atpdmM6VjE+/o5q9tXnMqxt1e7gz
OJkzja4OevW0762Hq0S0IIS4YOyVH4I+tw/PwkrQZ1iL8yGwsbu8WuGHFNbANv5h9jXA31ZT88/E1KXBUzUSzNamsCd+vJocxWu9
R0vReGWncoqjsrurhnukbB95qw9j5HS/GW5T9cGa6IUXpGyWHJsQPu5xccBqC38wE40933BtVDkEZU44/krh1CmBAjNe/dfQfwrK
dyTFOnvHlyh8It7EgLKFj5yxVkls8b00YnAJcQRti8pV8wHEJkfHYtHgs1nuxavg48ICrvEtoBSQgiuTQzsEYXcEP6GDZEDbiz4r
bKEq/0HQEhX/GMQJJlP8RihwHQ8EFCfrQwVWxwSxKFehasO1ZDB1Lt6oUsPEQmBJUzLwzSTJThmMFkUYQeUSTuVGCplFkMVDyEnw
iGXKilQDTt+oSyhy2/XUBMTQX1uwRxwO8QPXTeumPyzkrcDZUVEDZ3jMImfdEcxVONeYS+WVFZZLkXKlnsEgIilVocBGLk4N4aL+
/IFtfPdW/I0OQio+fqAYR5nGKsCkX2mKZqQfaLTAVAjSJSLFE3onUfG3g/LhroWalaBM2b+CyiQC89myyAYSPRZGxQ6YwGHg9xWA
x7xGnnq1slHjXPVM1SqAyuwrtFRQP1+1XvFAj1TF6bsTC6pLo4Nc+wkKIVtolHOJnsI3TElv61snyhHrw4xTpnA1k9/0cIDuhMJj
CCoUyINJyYr7O3owNrCK+bDMJpcw+wQJ5VJBqgRiOom0UuYg1nMTqo2rmPykh5fgbvxCzk26DIRzmZ+U2DKhKmoSCc6gzbeshmM8
gEpEBrlmhZXGpc48KCGbETVcjra1LOO0Gc8RdOQ9mBnoKCcpEh2/8o7m7UxWlQwrR+ajNhfnfmFSfuQEWhtjvDWb5sIkH0iR4Kih
0hiJW1zUbHumEQ==
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

const FIXTURE_PATHS = {
  validSource: "../packages/protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json",
  validCatalog: "../packages/protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json",
  exampleSortable:
    "../packages/protocol/upstream/0.1.0/snapshot/examples/sortable-list.source.desen.json",
  exampleStoreMap:
    "../packages/protocol/upstream/0.1.0/snapshot/examples/store-map.source.desen.json",
  exampleCatalog: "../packages/protocol/upstream/0.1.0/snapshot/examples/catalog.web.example.json",
};

function hasCode(code) {
  return (error) => {
    assert.ok(error instanceof PublisherExecutionPreflightEvidenceError);
    assert.equal(error.code, code);
    return true;
  };
}

async function readFixtures() {
  return Object.fromEntries(
    await Promise.all(
      Object.entries(FIXTURE_PATHS).map(async ([key, relativePath]) => [
        key,
        JSON.parse(await readFile(new URL(relativePath, import.meta.url), "utf8")),
      ]),
    ),
  );
}

function deepFreeze(value, seen = new Set()) {
  if (value === null || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

test("accepts real deterministic M06-T05 execution-preflight evidence", async () => {
  const result = await verifyPublisherExecutionPreflightEvidence();

  assert.equal(result.result, "PASS");
  assert.equal(result.prerequisitePins, 3);
  assert.equal(result.acceptedFixtures, 4);
  assert.equal(result.obligationKinds, 8);
  assert.equal(result.stageFailureVectors, 6);
  assert.equal(result.simultaneousPrecedenceVectors, 2);
  assert.equal(result.finiteLimitVectors, 6);
  assert.equal(result.proofDocumentPinned, true);
  assert.equal(result.tests.publisherRuntimeCases, 14);
  assert.ok(result.tests.compilerNegativeCases >= 20);
  assert.ok(result.tests.validatorBindingCases > 20);
  assert.ok(result.tests.validatorExecutionCases > 20);
  assert.equal(result.tests.rootMutationCases, 15);
});

test("two independent evidence builds are byte-identical and retain stages 8, 9, and 10", async () => {
  const first = await buildPublisherExecutionPreflightEvidence();
  const second = await buildPublisherExecutionPreflightEvidence();

  assert.deepEqual(first.artifactBytes, second.artifactBytes);
  assert.equal(first.artifactSha256, second.artifactSha256);
  assert.equal(
    first.artifactSha256,
    "6127bc2edd417975d4ae311b7934d9f85048928c84b1500ab50af8f42731ca67",
  );
  const compatibilitySources = [
    {
      path: "scripts/lib/reference-host-web-source-audit-proof.mjs",
      url: new URL("../scripts/lib/reference-host-web-source-audit-proof.mjs", import.meta.url),
      historicalBytes: 228_873,
      historicalSha256: "5f3ee52f48e19e8ccefc6f64b07e73e2fe04aa8edb17deb389f0bfbaf4def2d1",
      predecessors: [
        {
          bytes: 269_572,
          sha256: "e7c2497ee3aa128dc3d3c6cb297887a94f8d176549e6a4c205c65beeca9f6db4",
          patch: M07_T11_SOURCE_AUDIT_RECONSTRUCTION_PATCH,
        },
        {
          bytes: 266_698,
          sha256: "3e105e24dd9771a578cd43d8e82f884dd0a2ef04fb1dcc7af1d617ed05ec9ffe",
          patch: M07_T10_SOURCE_AUDIT_RECONSTRUCTION_PATCH,
        },
        {
          bytes: 263_857,
          sha256: "bb8f2dde9a4f63a848003cf7be7b69c1c9681992d56c9a254653dee8cbd7bbe3",
          patch: M07_T09_SOURCE_AUDIT_RECONSTRUCTION_PATCH,
        },
      ],
      currentBytes: 279_237,
      currentSha256: "b7f17df2ac1256217897072ece67e0eb8522521b6e44b80f8d76bce5c01bd08c",
    },
    {
      path: "tests/reference-host-web-source-audit.test.mjs",
      url: new URL("./reference-host-web-source-audit.test.mjs", import.meta.url),
      historicalBytes: 70_344,
      historicalSha256: "268d8ccec567fb05f07a24746d227ddd76d672525768c2b92faff747a870575f",
      predecessors: [
        {
          bytes: 91_297,
          sha256: "d7801ea603f72435cf07d55ad74cebf4ac62b0f95128d728d28200cc225afc0e",
          patch: M07_T11_SOURCE_AUDIT_TEST_RECONSTRUCTION_PATCH,
        },
        {
          bytes: 90_209,
          sha256: "34427c9fe31f3ec6bca14a661d5ea092058aa2e4d24d93a33e551a604e9bc162",
          patch: M07_T10_SOURCE_AUDIT_TEST_RECONSTRUCTION_PATCH,
        },
        {
          bytes: 89_057,
          sha256: "9442048b8b96f6aec06136b489dc08e01f159c46609eeb225aa2f949c98e3521",
          patch: M07_T09_SOURCE_AUDIT_TEST_RECONSTRUCTION_PATCH,
        },
      ],
      currentBytes: 93_464,
      currentSha256: "888c1cf5235340bd5e7a27229eedb74250bfefe054078ecd8956e233ce74de70",
    },
  ];
  for (const [index, compatibilitySource] of compatibilitySources.entries()) {
    const currentBytes = await readFile(compatibilitySource.url);
    assert.equal(currentBytes.byteLength, compatibilitySource.currentBytes);
    assert.equal(
      createHash("sha256").update(currentBytes).digest("hex"),
      compatibilitySource.currentSha256,
    );
    const predecessorByteGenerations = [];
    let predecessorInput = currentBytes;
    for (const predecessor of compatibilitySource.predecessors) {
      const predecessorBytes = applySourceAuditReconstructionPatch(
        predecessorInput,
        predecessor.patch,
      );
      assert.equal(predecessorBytes.byteLength, predecessor.bytes);
      assert.equal(createHash("sha256").update(predecessorBytes).digest("hex"), predecessor.sha256);
      predecessorByteGenerations.push(predecessorBytes);
      predecessorInput = predecessorBytes;
    }
    const approved = await buildPublisherExecutionPreflightEvidence({
      compatibilitySourceBytes: {
        [compatibilitySource.path]: currentBytes,
      },
    });
    assert.deepEqual(approved.artifactBytes, first.artifactBytes);
    assert.deepEqual(
      approved.artifact.trackedFiles.find(
        ({ path: trackedPath }) => trackedPath === compatibilitySource.path,
      ),
      {
        path: compatibilitySource.path,
        bytes: compatibilitySource.historicalBytes,
        sha256: compatibilitySource.historicalSha256,
      },
    );

    const oneByteDrift = Buffer.from(currentBytes);
    oneByteDrift[0] ^= 1;
    await assert.rejects(
      buildPublisherExecutionPreflightEvidence({
        compatibilitySourceBytes: {
          [compatibilitySource.path]: oneByteDrift,
        },
      }),
      hasCode("PUBLISHER_EXECUTION_COMPATIBILITY_DRIFT"),
    );
    await assert.rejects(
      buildPublisherExecutionPreflightEvidence({
        compatibilitySourceBytes: {
          [compatibilitySource.path]: Buffer.concat([
            currentBytes,
            Buffer.from("\n// unreviewed successor\n"),
          ]),
        },
      }),
      hasCode("PUBLISHER_EXECUTION_COMPATIBILITY_DRIFT"),
    );
    for (const predecessorBytes of predecessorByteGenerations) {
      await assert.rejects(
        buildPublisherExecutionPreflightEvidence({
          compatibilitySourceBytes: {
            [compatibilitySource.path]: predecessorBytes,
          },
        }),
        hasCode("PUBLISHER_EXECUTION_COMPATIBILITY_DRIFT"),
      );
    }
    if (index === 0) {
      await assert.rejects(
        verifyPublisherExecutionPreflightEvidence({
          compatibilitySourceBytes: {
            [compatibilitySource.path]: currentBytes,
          },
        }),
        hasCode("PUBLISHER_EXECUTION_OPTIONS_INVALID"),
      );
      await assert.rejects(
        writePublisherExecutionPreflightEvidence({
          compatibilitySourceBytes: {
            [compatibilitySource.path]: currentBytes,
          },
        }),
        hasCode("PUBLISHER_EXECUTION_OPTIONS_INVALID"),
      );
    }
  }

  const poisonedPath = compatibilitySources[0].path;
  const approvedBytes = await readFile(compatibilitySources[0].url);
  const poisonedBytes = Buffer.from(approvedBytes);
  poisonedBytes[Math.floor(poisonedBytes.byteLength / 2)] ^= 1;
  const originalMapGet = Map.prototype.get;
  try {
    Map.prototype.get = function (key) {
      if (key === poisonedPath) return approvedBytes;
      return Reflect.apply(originalMapGet, this, [key]);
    };
    await assert.rejects(
      buildPublisherExecutionPreflightEvidence({
        compatibilitySourceBytes: { [poisonedPath]: poisonedBytes },
      }),
      hasCode("PUBLISHER_EXECUTION_COMPATIBILITY_DRIFT"),
    );
  } finally {
    Map.prototype.get = originalMapGet;
  }

  const originalObjectCreate = Object.create;
  let poisonedCreateCalls = 0;
  try {
    Object.create = function (prototype, ...arguments_) {
      if (prototype === null) {
        poisonedCreateCalls += 1;
        const injected = originalObjectCreate(null);
        injected.compatibilitySourceBytes = { [poisonedPath]: approvedBytes };
        return injected;
      }
      return originalObjectCreate(prototype, ...arguments_);
    };
    await assert.rejects(
      verifyPublisherExecutionPreflightEvidence({
        compatibilitySourceBytes: { [poisonedPath]: poisonedBytes },
      }),
      hasCode("PUBLISHER_EXECUTION_OPTIONS_INVALID"),
    );
    assert.equal(poisonedCreateCalls, 0);
  } finally {
    Object.create = originalObjectCreate;
  }

  const originalObjectFreeze = Object.freeze;
  let poisonedFreezeCalls = 0;
  try {
    Object.freeze = function (value) {
      const stack = new Error().stack ?? "";
      if (stack.includes("captureOptions") || stack.includes("captureCompatibilitySourceBytes")) {
        poisonedFreezeCalls += 1;
        return { compatibilitySourceBytes: { [poisonedPath]: approvedBytes } };
      }
      return originalObjectFreeze(value);
    };
    await assert.rejects(
      verifyPublisherExecutionPreflightEvidence({
        compatibilitySourceBytes: { [poisonedPath]: poisonedBytes },
      }),
      hasCode("PUBLISHER_EXECUTION_OPTIONS_INVALID"),
    );
    assert.equal(poisonedFreezeCalls, 0);
  } finally {
    Object.freeze = originalObjectFreeze;
  }

  assert.deepEqual(first.artifact.pipelineOwnership.exactPrecedence, [
    "capability-contracts",
    "state-and-control-flow",
    "binding-compatibility",
  ]);
  assert.deepEqual(first.artifact.claims.runtimeObligations.exactKinds, [
    "behavior-prop",
    "behavior-style-part-property",
    "component-command-input",
    "component-prop",
    "operation-input",
    "resource-input",
    "state-write",
    "style-part-property",
  ]);
  assert.match(first.artifact.nonclaims.join("\n"), /does not .*emit a Bundle/u);
});

test("rejects one-byte artifact tampering", async () => {
  const built = await buildPublisherExecutionPreflightEvidence();
  const tampered = Buffer.from(built.artifactBytes);
  tampered[tampered.length - 2] ^= 1;

  await assert.rejects(
    verifyPublisherExecutionPreflightEvidence({
      artifactBytes: tampered,
      proofDocument: "",
    }),
    hasCode("PUBLISHER_EXECUTION_ARTIFACT_DRIFT"),
  );
});

test("rejects one-byte drift in every exact prerequisite class", async () => {
  for (const relativePath of [
    "../docs/proof/artifacts/protocol-0.1.0-binding-contracts.json",
    "../docs/proof/artifacts/protocol-0.1.0-execution-contracts.json",
    "../docs/proof/artifacts/publisher-0.1.0-capability-preflight.json",
  ]) {
    const url = new URL(relativePath, import.meta.url);
    const bytes = await readFile(url);
    const tampered = Buffer.from(bytes);
    tampered[0] ^= 1;
    const workspacePath = relativePath.slice(3);
    await assert.rejects(
      buildPublisherExecutionPreflightEvidence({
        prerequisiteBytes: { [workspacePath]: tampered },
      }),
      hasCode("PUBLISHER_EXECUTION_PREREQUISITE_DRIFT"),
    );
  }
});

test("rejects Source and Catalog tuple mutation instead of changing the proof corpus", async () => {
  const fixtures = await readFixtures();
  fixtures.exampleSortable.catalogs[0].version = "1.0.1";

  await assert.rejects(
    buildPublisherExecutionPreflightEvidence({ fixtures }),
    hasCode("PUBLISHER_EXECUTION_FIXTURE_DRIFT"),
  );
});

test("rejects a public Validator prerequisite that bypasses one emission-site phase", async () => {
  const validatorApi = {
    ...validatorPublicApi,
    validateDesenPreparedSourcePublicationContracts(source, catalogSet) {
      if (source?.surfaces?.["sign-in"]?.root?.when?.op === "gt") {
        return deepFreeze({
          valid: true,
          target: "source-publication-contracts",
          value: source,
          diagnostics: [],
          obligations: [],
        });
      }
      return validatorPublicApi.validateDesenPreparedSourcePublicationContracts(source, catalogSet);
    },
  };

  await assert.rejects(
    buildPublisherExecutionPreflightEvidence({ validatorApi }),
    hasCode("PUBLISHER_EXECUTION_VALIDATOR_PREREQUISITE_FAILED"),
  );
});

test("rejects a Publisher preflight that drops one required runtime obligation", async () => {
  function obligationDroppingPreflight(...args) {
    const result = preflightPublishExecution(...args);
    if (!Object.hasOwn(result, "executionPreflighted")) return result;
    return deepFreeze({ ...result, obligations: result.obligations.slice(1) });
  }

  await assert.rejects(
    buildPublisherExecutionPreflightEvidence({ preflight: obligationDroppingPreflight }),
    hasCode("PUBLISHER_EXECUTION_OBLIGATION_FAILED"),
  );
});

test("rejects a detached Source clone that cannot retain exact runtime authority", async () => {
  function clonedSourcePreflight(...args) {
    const result = preflightPublishExecution(...args);
    if (!Object.hasOwn(result, "executionPreflighted")) return result;
    return deepFreeze({ ...result, source: JSON.parse(JSON.stringify(result.source)) });
  }

  await assert.rejects(
    buildPublisherExecutionPreflightEvidence({ preflight: clonedSourcePreflight }),
    hasCode("PUBLISHER_EXECUTION_AUTHORITY_FAILED"),
  );
});

test("rejects Publisher stage remapping instead of preserving Validator phase provenance", async () => {
  function remappedPreflight(...args) {
    const result = preflightPublishExecution(...args);
    if (result?.ok !== false || result.stage !== "state-and-control-flow") return result;
    return deepFreeze({
      ...result,
      stage: "binding-compatibility",
      diagnostics: result.diagnostics.map((diagnostic) => ({
        ...diagnostic,
        stage: "binding-compatibility",
      })),
    });
  }

  await assert.rejects(
    buildPublisherExecutionPreflightEvidence({ preflight: remappedPreflight }),
    hasCode("PUBLISHER_EXECUTION_STAGE_FAILED"),
  );
});

test("rejects any failure that leaks partial Source, Catalog authority, obligations, or Bundle", async () => {
  function partialFailurePreflight(...args) {
    const result = preflightPublishExecution(...args);
    if (Object.hasOwn(result, "executionPreflighted")) return result;
    return deepFreeze({
      ...result,
      bundle: {},
      source: {},
      catalogSet: [],
      packages: [],
      requirementPackageIndexes: [],
      obligations: [],
    });
  }

  await assert.rejects(
    buildPublisherExecutionPreflightEvidence({ preflight: partialFailurePreflight }),
    hasCode("PUBLISHER_EXECUTION_PARTIAL_FAILURE"),
  );
});

test("rejects a preflight that ignores exact obligation ceilings", async () => {
  function unboundedPreflight(rawSource, candidates) {
    return preflightPublishExecution(rawSource, candidates, PUBLISH_EXECUTION_PREFLIGHT_LIMITS);
  }

  await assert.rejects(
    buildPublisherExecutionPreflightEvidence({ preflight: unboundedPreflight }),
    hasCode("PUBLISHER_EXECUTION_LIMIT_VECTOR_FAILED"),
  );
});

test("rejects root preflight exposure and a package export subpath", async () => {
  await assert.rejects(
    buildPublisherExecutionPreflightEvidence({
      publicApi: {
        ...publisherPublicApi,
        preflightPublishExecution,
      },
    }),
    hasCode("PUBLISHER_EXECUTION_PUBLIC_API_EXPOSED"),
  );

  const publisherPackage = JSON.parse(
    await readFile(new URL("../packages/publisher/package.json", import.meta.url), "utf8"),
  );
  publisherPackage.exports["./execution-preflight"] = "./dist/execution-preflight.js";
  await assert.rejects(
    buildPublisherExecutionPreflightEvidence({ publisherPackage }),
    hasCode("PUBLISHER_EXECUTION_PUBLIC_API_EXPOSED"),
  );
});

test("rejects target-specific source and declaration forms", async () => {
  const source = await readFile(
    new URL("../packages/publisher/src/execution-preflight.ts", import.meta.url),
    "utf8",
  );
  await assert.rejects(
    buildPublisherExecutionPreflightEvidence({
      executionSource: `${source}\nvoid document.createElement("div");\n`,
    }),
    hasCode("PUBLISHER_EXECUTION_TARGET_BOUNDARY_DRIFT"),
  );

  const declaration = await readFile(
    new URL("../packages/publisher/dist/execution-preflight.d.ts", import.meta.url),
    "utf8",
  );
  await assert.rejects(
    buildPublisherExecutionPreflightEvidence({
      executionDeclaration: `${declaration}\ndeclare const window: unknown;\n`,
    }),
    hasCode("PUBLISHER_EXECUTION_TARGET_BOUNDARY_DRIFT"),
  );
});

test("rejects a missing, stale, duplicated, or pending proof-document artifact pin", async () => {
  const built = await buildPublisherExecutionPreflightEvidence();
  const validDocument = [
    "# Proof",
    "",
    "`docs/proof/artifacts/publisher-0.1.0-execution-preflight.json`",
    "",
    `\`sha256:${built.artifactSha256}\``,
    "",
  ].join("\n");

  for (const proofDocument of [
    validDocument.replace("publisher-0.1.0-execution-preflight.json", "wrong.json"),
    validDocument.replace(built.artifactSha256, "0".repeat(64)),
    `${validDocument}\n\`sha256:${built.artifactSha256}\`\n`,
    `${validDocument}\nPENDING_M06_T05_ARTIFACT_SHA256\n`,
  ]) {
    await assert.rejects(
      verifyPublisherExecutionPreflightEvidence({
        artifactBytes: built.artifactBytes,
        proofDocument,
      }),
      hasCode("PUBLISHER_EXECUTION_PROOF_DOCUMENT_DRIFT"),
    );
  }
});

test("atomic evidence writer rejects destination symlinks and pre-rename byte tampering", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-execution-preflight-proof-"));
  t.after(() => rm(directory, { force: true, recursive: true }));

  const symlinkTarget = path.join(directory, "target.json");
  const symlinkPath = path.join(directory, "artifact-link.json");
  await writeFile(symlinkTarget, "{}\n");
  await symlink(symlinkTarget, symlinkPath);
  await assert.rejects(
    writePublisherExecutionPreflightEvidence({ artifactPath: symlinkPath }),
    TypeError,
  );

  const tamperedPath = path.join(directory, "tampered.json");
  await assert.rejects(
    writePublisherExecutionPreflightEvidence({
      artifactPath: tamperedPath,
      beforeAtomicRename: async ({ temporaryPath }) => {
        await writeFile(temporaryPath, "tampered\n");
      },
    }),
    TypeError,
  );
  await assert.rejects(readFile(tamperedPath), { code: "ENOENT" });

  assert.equal(
    path.basename(DEFAULT_PUBLISHER_EXECUTION_PREFLIGHT_ARTIFACT_PATH),
    "publisher-0.1.0-execution-preflight.json",
  );
});
