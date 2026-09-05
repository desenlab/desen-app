# Buradan Başla

Bu dosya, teknik ayrıntılarda kaybolmadan DESEN uygulamasının nasıl geliştirileceğini takip etmek
içindir.

## Üç ayrı kimlik

- **DESEN:** Açık protokolün adı.
- **Desen App:** `desen.app` üzerinde çalışacak görsel ürün.
- **DESEN Developer Platform:** `desen.run` üzerinde bulunacak geliştirici ve entegrasyon merkezi.
  Bu, ayrı bir tasarım ürünü değil; protokolün ve bağımsız entegrasyon araçlarının yayın yüzüdür.

Desen App, DESEN'in tek kullanım yolu değildir. Bir şirket veya bireysel geliştirici Desen App'i
kullanmadan `desen` kütüphanesini kendi ürününe entegre edebilmelidir.

## Her çalışma oturumunda uygulanacak yöntem

1. Kök dizindeki `PROJECT-STATUS.md` dosyasını aç.
2. `docs/plan/TASKS.md` içindeki aktif görev kimliğini bul.
3. Codex'e yalnızca o görevi ver. Örnek: “M02-T03 görevini tamamla ve kanıtını ekle.”
4. Codex görevin testlerini ve belgelerini de tamamlamalı.
5. CI-02'nin sınırlı yerel temel kontrolleri, göreve özel doğrulayıcı ve odaklı pozitif/ilgili
   negatif testler geçmeden görev `DONE` yapılmamalı.
6. Sonraki göreve ancak mevcut görev tamamlandıktan sonra geçilmeli.

Aynı anda yalnızca bir görev `IN_PROGRESS` olabilir. Bu kural, vibe coding sırasında kapsamın
kontrolden çıkmasını engeller.

**AR-01 — Arşivlerdeki özel metinlerin temizliği**,
[PR #76](https://github.com/desenlab/desen-app/pull/76) ile kapandı. Tam head
`bde3ea81f261a9839a2b61ecb242d4824083ee2c`,
[33762532123 numaralı koşuda](https://github.com/desenlab/desen-app/actions/runs/33762532123)
`Quality gate` ve `Browser E2E` kontrollerini geçti. Değişiklik
`33b922e6746365510c0549ddbf3b08469e58dc11` olarak main'e alındı ve
[taze main CI](https://github.com/desenlab/desen-app/actions/runs/33764464871) başarılı oldu. Teknik
kanıtlar ve tarihsel kimlikler korunuyor; Git geçmişi yeniden yazılmadı.
[Kapsam ve kanıt](../proof/HISTORICAL-ARCHIVE-REDACTION.md). I07-05'in eski runner'ı kaldırma
kapsamı değişmedi.

**SEC-01 — Fastify / fast-uri güvenlik düzeltmesi**, kullanıcı isteğiyle M10-T06'dan önce gelir.
Fastify 5.12.2 ve fast-uri 3.1.7/4.1.4 kullanılır. Güvenlik testleri 44/44, kontrol düzleminin tüm
testleri 245/245 geçer; üretim bağımlılıkları audit'i sıfır açık bildirir. Geliştirme araçlarındaki
kapsam dışı bulgular ayrı tutulur. Yerel kanıt geçen `DONE` kaydı koşullu kapanış adayıdır;
tam son PR head'inde taze `Quality gate` ve `Browser E2E` geçmeden merge veya tamamlanma iddiası
yapılamaz. **M10-T06 başlamaz; bu güvenlik işi kapanınca beklenir.**
[Kapsam ve kanıt](../proof/SEC-01-DEPENDENCY-SECURITY.md).

**M10-T05 — Yayınlanan değişikliğin aynı host'ta görünmesi**,
[PR #77](https://github.com/desenlab/desen-app/pull/77) ile kapandı. Main revizyonu
`e95c8ceb1601e832dcad53158add10ec03e7951a`,
[taze CI koşusunu](https://github.com/desenlab/desen-app/actions/runs/33986719329) geçti.
Normal ürün içinde iki görünür Save → Publish → Activate döngüsüyle önce
A, sonra etiket ve aralığı değiştirilmiş B revizyonu yayımlanır. Ayrı derlenen referans host iki
revizyon arasında yeniden derlenmez; yenilemede B'yi, ikinci yenilemede yine B'yi gösterir. P-07
`PROVEN`, PF-059 `CLOSED` olur; toplam ilerleme 117/148 (%79), M10 8/12 (%67), kanıt kapıları ise
11/13'tür. SEC-01 bu ilerleme sayılarını değiştirmez ve M10-T06'yı başlatmaz.

Sıradan bir `T` görevinin hızlı yerel geri bildirimi; `pnpm format:check`, `pnpm lint`,
`pnpm typecheck`, `pnpm build`, `pnpm boundaries` ve
`node scripts/ci/verify-proof-reader-checkpoints.mjs` komutlarından oluşur. Bu temel kontrol
yetkili bir tamamlama kanıtı değildir; göreve özel doğrulayıcıyı ve testleri kaldırmaz. Merge veya
tamamlandı raporu için GitHub'daki `Quality gate`, pull request'in tam güncel head commit'inde
geçmelidir; yeni commit önceki sonucu geçersiz kılar. `pnpm check`, G kapanışı, açıkça istenen
yerel manuel denetim veya açık istek için yerel kapsamlı uyumluluk komutu olarak kalır. Hosted
`main`, release, manuel denetim ve güvenli olmayan/güvenilmeyen sınırlar taze kapsamlı çalışır.
Mühür/checkpoint yalnızca kimlik ve etki otoritesidir; başarıyı önbelleklemez ve seçilen hosted
işler taze çalışır.

`I07-01` ve `I07-02` tamamlandı. Açık kullanıcı yetkisiyle eklenen CI-02'nin bu merge edilmemiş
değişiklikteki `DONE` kaydı koşullu bir kapanış adayıdır.
`921fd54c406f22fb6da25b0fdd29598ac8950750` başındaki uygulama adayı, PR #56'nın hosted
`Quality gate` koşusunu
[run 33196876164 / job 98936152886](https://github.com/desenlab/desen-app/actions/runs/33196876164/job/98936152886)
içinde 14 dakika 53 saniyede geçti. Bu makbuz yalnızca önceki head'i kanıtlar ve yeni head'e otorite
vermez. Tam güncel PR head'indeki hosted `Quality gate` geçene kadar kanonik CI-02 durumu
`IN_PROGRESS` kalır; geçerse aynı değişmemiş commit yetkili `DONE` revizyonu olur. O zamana kadar
merge ve tamamlandı raporu blokludur. CI-02 yerel bir affected-selector eklemedi, hosted
dispatcher/workflow'u değiştirmedi ve I07-05'in legacy rollback sorumluluğunu aynen korudu. I07-02
geçiş anındaki 130 iş ve 61 kanıt çiftini değişmez tarihsel temel olarak saklar. M07-T09 checkpoint'i 146 iş ve 69 kanıt
çiftiydi. M07-T10 eklendikten sonra çalışma alanındaki güncel zorunlu plan 148 işin ve 70 kanıt
çiftinin tamamını yeni sistemle çalıştırır: 59 normal çift ve 11 özel bariyer. Eski planın aynı
kapsamdaki açılımı 463 önkoşul parçası, 2.929 sıralı yaprak çağrısı ve 230 farklı yaprak iştir.
Ortak dosya, çıktı, port ve geçici-dizin kullanımı kodla
sınıflandırılmıştır; eski ve yeni yollar aynı sürümde
başarılı olmuş, ardından resmi geçiş koşusu da 10 dakika 33 saniyede geçmiştir. Eski sıralı sistem
otomatik çalışmaz; yalnızca acil durumda elle seçilen `legacy-rollback` seçeneği olarak korunur.
Tarihsel okuyucu checkpoint'i sıra 4, on değişmez kanıt eserini ve yirmi canlı okuyucuyu
`ee2d72c3529d9295945d339fb214c41dbbf906ffa6613a7ad6e766ec79c1bcf5` zincir başında doğrular.
M07-T03 sonrasındaki düzeltici M05-T04 güncel-okuyucu eki tarihsel sıra 5'i kurdu; zincir başı
`7df3631d509ed7e65c571566a825d6d3cd52d336e1a74512bf3e8e26920749b3`, on bir değişmez kanıt
eserini ve yirmi iki canlı okuyucuyu doğrular. Sıra 6 yalnızca M06-T11 kanıt/test alındılarını
sınırlı ve açık 20 saniyelik iç içe Vitest zaman aşımı için ilerletir; o aşamadaki zincir başı
`790ad28b6fd441e6d5f40f277a97e8de36a178a9e50fff3e208e6c27588915fd` yine on bir değişmez kanıt eserini ve yirmi iki canlı okuyucuyu
doğrular. Kapsam, assertion, eşzamanlılık, dondurulmuş kanıt, iş yükü/kanıt sayısı, ilerleme
veya plan digest'i değişmez; sıra 1–5 bayt ve hash olarak aynı kalır.
İncelenmiş sıra 7, sıra 6'nın
`790ad28b6fd441e6d5f40f277a97e8de36a178a9e50fff3e208e6c27588915fd` başından yeni
`d50b5ee4fb265f241bac7652b979af0146d530528ba6db8fc98c8fb3225a5ba5` başına birebir bağlanır;
13 değişmez kanıt eserini ve 26 canlı okuyucuyu doğrular. Bu ek; 34.612 baytlık M07-T04 eserini
(`sha256:29555326d51073c50937519d8706049ad17287079cc3ef4dc7060bb3a3225394`), canlı T04 kanıt/kök
okuyucularını ve güncel M05-T06 P-17 uyumluluk okuyucularını kapsar. Tüm T04 uyumluluk köprüleri ve
incelenmiş CI zaman aşımı kalibrasyonu sonrasında M05-T09, M06-T01/T05/T08/T09/T10/T11 ve
M07-T01/T02/T03 dahil 26 canlı okuyucunun kesin son alındılarını mühürler. Dondurulmuş M05-T06 eseri
bayt olarak aynıdır ve tarihsel kaydında `PARTIAL`
kalır; güncel canlı P-17 ise `PROVEN` durumundadır. Sıra 1–6 değişmemiştir ve bu yerel inceleme
kaydı yeni bir hosted CI başarısı iddia etmez.
İncelenmiş sıra 8, sıra 7'nin
`d50b5ee4fb265f241bac7652b979af0146d530528ba6db8fc98c8fb3225a5ba5` başından yeni
`f707fb4c3338aeda79eb6242b645b5e864ce54b1e3955373e8edebcd7e026b8a` başına birebir bağlanır;
14 değişmez kanıt eserini ve 28 canlı okuyucuyu doğrular. Bu ek; 41.945 baytlık M07-T05 eserini
(`sha256:144e8a46b3b41a1f98a022bf4c16dddb9d7415af4e5033322484d4bdd49c55b9`), 73.915 baytlık kanıt
okuyucusunu (`sha256:f66d40863a46dd7ed9e28afb2c78f8afbda8aee964e72d4fba60e65e55a351b3`) ve 17.291 baytlık kök
okuyucusunu (`sha256:490d4f922ea41dc7bca178cc54ab938ab136f0b922d7842af623001eabf60a65`) kapsar. Güncel M07-T01–T04
ve reference-host source-audit uyumluluk okuyucuları dahil önceki canlı alındılar T05 uyumluluk
değişikliklerinden sonra yeniden mühürlenmiştir. Sıra 1–7 ve önceki değişmez kanıt eserleri aynıdır.
Bu yerel inceleme kaydı yeni bir hosted CI başarısı iddia etmez; kalan uyumluluk okuyucusu borcunun
sahibi I07-04'tür.
İncelenmiş sıra 9, sıra 8'in
`f707fb4c3338aeda79eb6242b645b5e864ce54b1e3955373e8edebcd7e026b8a` başından yeni
`94f48160552a6e0de702f71200e56c23d61bab8692d43f3ac1104dcfa681568b` başına bağlanır; yine 14
değişmez eser ve 28 okuyucuyu doğrular. Yalnızca `[16, 17, 18, 19]` indeksli okuyucular değişir:
M07-T02 kanıt 94.612 bayt / `sha256:4c69fa253ba2d9432a75c6c6aaa2ad69e23c3683c43dae9c92dc73b3208937d9`;
M07-T02 kök 20.959 bayt / `sha256:fdcfc8c4868c1ee084b652e42c7dab4750bc569c4c05928dde7136118b4689ed`;
M07-T03 kanıt 86.174 bayt / `sha256:5624b06d8d0962d18c9a920a34a95b0023f4909d8c7b7812057bedcdc62ab5ab`;
M07-T03 kök 21.119 bayt / `sha256:10c1a677b88b5c6bd4389e659ce38f11a627ae92de4aafe4ffade0de23790f11`.
Bu küçük T05 uyumluluk köprüleri güncel ortak strict-JSON iç kaynak/dağıtım baytlarını ve kesin
T03 → T04 → T05 toplu komşuluğunu doğrularken değişmemiş dondurulmuş T02/T03 eserlerini yansıtmaya
devam eder. Sıra 1–8 ve bütün dondurulmuş eserler değişmemiştir. Bu yalnızca incelenmiş yerel
kanıttır, hosted CI iddiası değildir; `DEBT-I07-012` temizliğinin sahibi I07-04'tür.
İncelenmiş sıra 10, sıra 9'un
`94f48160552a6e0de702f71200e56c23d61bab8692d43f3ac1104dcfa681568b` başından yeni
`bd3f5b90656f0e41d7f6aa439fdc01889e9ebeada26cd3caf8624c3ce1db7d07` başına bağlanır; yine 14
değişmez eser ve 28 okuyucuyu doğrular. Yalnızca `[7, 14, 15]` indeksli okuyucular değişir:
M06-T08 katalog kökü `tests/publisher-catalog-pinning.test.mjs` 38.530 bayt /
`sha256:bb3038a8c5bb241c863daa6c7f41c1d8ab210da81fdbe52697f33a3c14909116`; M07-T01 kanıt okuyucusu
99.672 bayt / `sha256:d9d9edd6379357dde229999ce461a0dc66bf58dc0d7900eb6f5ece177a9b3fba`;
M07-T01 kök okuyucusu 26.679 bayt /
`sha256:6b3a7869962046a3594a788095faad640c76fec660a59aee7b26844e831851ff`. Bu küçük test-fixture
ardılları yerel API kanıtının toplu zincirdeki son halkasını ve güncel katalog-kök alındısını tanırken dondurulmuş katalog ve
T01 eserleri değişmez. Tam sıralı yerel katalog ve T01 kontrolleri sırasıyla 51/51 ve 16/16 geçer.
Sıra 1–9 değişmezdir. Bu yalnızca incelenmiş yerel kanıttır, hosted CI iddiası değildir;
`DEBT-I07-012` temizliğinin sahibi I07-04'tür.
İncelenmiş sıra 11, sıra 10'un
`bd3f5b90656f0e41d7f6aa439fdc01889e9ebeada26cd3caf8624c3ce1db7d07` başından yeni
`63b8af4da431f0918c7ea9480564750bd12057af2bc83c294d962113ce7c9be8` başına bağlanır; yine
değişmemiş 14 dondurulmuş eseri ve 28 okuyucuyu doğrular. Yalnızca `[26, 27]` indeksleri değişir:
M07-T05 kanıt okuyucusu 77.034 bayt /
`sha256:c704e25024eaf7bdf317cc144f6b85922a3fe73a24c9c91e639ede032e22eb6f`; kök okuyucusu 17.578 bayt /
`sha256:4871c406390c4c9b36bff1c417a6c8dd22798736ea8daad1c63a3cbd0a978389`. Sıra 1–10 ve bütün
dondurulmuş eserler değişmemiştir. Bu incelenmiş yerel okuyucu kaydı hosted CI iddiası taşımaz.
İncelenmiş sıra 12, sıra 11'in
`63b8af4da431f0918c7ea9480564750bd12057af2bc83c294d962113ce7c9be8` başından o zamanki
`85c49a0d79346bf2ea92b716f6b43c5d95d164209e3d67af34871a334686e10e` başına bağlanır; yine
değişmemiş 14 dondurulmuş eseri ve 28 okuyucuyu doğrular. Yalnızca `[26, 27]` indeksleri değişir:
M07-T05 kanıt okuyucusu 77.507 bayt /
`sha256:e2050408c5bf3e084eacd6e42880310dafbfdf03b79821500cc0567b998f7d66`; kök okuyucusu 17.716 bayt /
`sha256:061b40ea20e0f7ee362f26bd54db954c3caea338df5e2f090ce34a4618ac37cc`. Bu ardıl, ADR'deki kesin
token sınırı belge düzeltmesini doğrular; M07-T05 eseri ve diğer bütün dondurulmuş eserler değişmez.
Bu yalnızca incelenmiş yerel okuyucu kanıtıdır; henüz hosted CI iddiası yoktur ve uyumluluk okuyucusu
borcunun sahibi I07-04'tür.
İncelenmiş sıra 13, sıra 12'nin
`85c49a0d79346bf2ea92b716f6b43c5d95d164209e3d67af34871a334686e10e` başından o zamanki
`146b04f1c8209be64168afb451ceee2c422da0cdced116f8d08beafe795c533c` başına bağlanır; aynı 14
değişmemiş dondurulmuş eseri ve 28 okuyucuyu doğrular. Yalnızca `[9]` indeksi değişir: M06-T09
publisher-bundle-publication kök okuyucusu 63.859 bayt /
`sha256:ae7b688d904b4c77632fd78e0ee23b2264eae1574b4350306b5e2ec1b9974b8d`. Bir hosted
required-exhaustive denemesi bu okuyucuda M07 ardılı/güncel makbuzuna ilişkin iki eskimiş iddiayı
ortaya çıkardı; dar okuyucu düzeltmesinden sonra odaklı kök test dizisi 112/112 geçiyor ve
dondurulmuş M06-T09 eseri değişmedi. Bu incelenmiş yerel okuyucu kanıtıdır, henüz hosted CI başarı
iddiası değildir ve uyumluluk okuyucusu borcunun sahibi I07-04 olarak kalır.
İncelenmiş sıra 14, sıra 13'ün
`146b04f1c8209be64168afb451ceee2c422da0cdced116f8d08beafe795c533c` başından güncel
`3d2dd7a48ee2573d14fb1dbea18ef8b4e3498c6a26f82d76ea589dba3c821078` başına bağlanır; aynı 14
değişmemiş dondurulmuş eseri ve 28 okuyucuyu doğrular. Yalnızca `[10, 11, 14]` indeksleri değişir:
M06-T11 kanıt okuyucusu 166.563 bayt /
`sha256:06eb59602a768c13f19cc83289a574823d191aa3b62ed8fb7149381b326de802`, kök okuyucusu 60.572
bayt / `sha256:29b407c2f7f1b17d17bff450185a9304c3186caea4a98973df3f1e3e4f684531` ve M07-T01 kanıt
okuyucusu 99.672 bayt /
`sha256:888d5e81bda7ca2cdcc58bb063d49409cad5f5d73bdd9baaa16dc199e566e5c6` olur. Bu dar CI-okuyucu
ardılı hiçbir dondurulmuş eseri değiştirmez. Daha sonra M07-T05 pull request ve `main`
required-exhaustive çalışmaları hosted CI'da geçti; sıra 14'ün kendisi yine yerel okuyucu kanıtıdır
ve uyumluluk okuyucusu borcunun sahibi I07-04 olarak kalır.
İncelenmiş sıra 15, sıra 14'ün
`3d2dd7a48ee2573d14fb1dbea18ef8b4e3498c6a26f82d76ea589dba3c821078` başından güncel
`b75a2580d1d6820392aa74ba5b7671b01baed1740fe2097c2a78e24663b5e4d5` başına bağlanır; 15
değişmez eseri ve 30 canlı okuyucuyu doğrular. 47.622 baytlık M07-T06 eserini
(`sha256:d025da5329d5b56b9b46e7292a08883386a151add5e419edf2a9345425319494`) ekler, okuyucu
indeksleri `[0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 14, 15, 16, 17, 18, 19, 22, 23, 26, 27]` için
güncel
alındıları yeniden mühürler ve T06 kanıt/kök okuyucularını `[28, 29]` olarak ekler. Sıra 1–14 ve
önceki eser baytları değişmez. Bu incelenmiş yerel okuyucu kanıtıdır; hosted M07-T06 başarısı iddia
etmez. Geçici M05 kaynak-denetim ve tarihsel staging okuyucusu köprüleri `DEBT-I07-009` ve
`DEBT-I07-013` olarak I07-04'e, en geç G07'de kaldırılmak üzere kaydedilmiştir.
İncelenmiş sıra 16, sıra 15'in
`b75a2580d1d6820392aa74ba5b7671b01baed1740fe2097c2a78e24663b5e4d5` başından güncel
`f9e77791148c7f89e586b6eb8964338185a35c11900b69262a159002af0838cd` başına bağlanır; 16
değişmez eseri ve 32 canlı okuyucuyu doğrular. 49.892 baytlık M07-T07 eserini
(`sha256:3129a8e40c837a1c49d7fe206de794e0f7f7e130dc7e5e90a012b9e38bf07334`) ekler, okuyucu
indeksleri `[0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 14, 15, 16, 17, 18, 19, 22, 23, 26, 27, 28, 29,
30, 31]` için güncel alındıları yeniden mühürler ve T07 kanıt/kök okuyucularını `[30, 31]`
olarak ekler. Sıra 1–15 ve önceki dondurulmuş eser baytları değişmez. Bu incelenmiş yerel okuyucu
kanıtıdır; hosted M07-T07 başarısı iddia etmez. Tarihsel aktivasyon-okuyucusu uyumluluk köprülerini
en geç G07'de kaldırma sorumluluğu I07-04'tedir.
İncelenmiş sıra 17, sıra 16'nın
`f9e77791148c7f89e586b6eb8964338185a35c11900b69262a159002af0838cd` başından güncel
`cc7227fe73f0b03fa56e18c075de5bc8bb2f87c4425aa669fd437ed2cc09730e` başına bağlanır; 17 değişmez
eseri ve 34 canlı okuyucuyu doğrular. 44.224 baytlık M07-T08 eserini
(`sha256:c65d4f2de1407fffb891b5d3ba2fc8a3a8d4e3f0fb76c8b8f2719be6b310b3f9`) ekler, okuyucu
indeksleri `[14, 15, 16, 18, 22, 26, 27, 28, 29, 30, 31]` için güncel alındıları yeniden mühürler
ve 84.219 baytlık T08 kanıt okuyucusunu `[32]`
(`sha256:08f143107430dde90cf1865c21d7ce1ec854897b0c1c4306b96525bdd0d18daa`), 24.939 baytlık T08 kök
okuyucusunu `[33]` (`sha256:b97e7991e0ac20e7232112594228fdd829a536e81d16d06fd3f909e7e3a02492`)
olarak ekler. Sıra 1–16 ile önceki 16 eser dosyası bayt olarak aynıdır. Bu incelenmiş yerel okuyucu
kanıtıdır; hosted M07-T08 sonucu iddia etmez. Geçici tarihsel kurtarma-okuyucusu köprüleri
`DEBT-I07-015` olarak I07-04'e, en geç G07'de kaldırılmak üzere kaydedilmiştir.

İncelenmiş sıra 18, sıra 17'nin
`cc7227fe73f0b03fa56e18c075de5bc8bb2f87c4425aa669fd437ed2cc09730e` başından sıra 18'in
`4e9ac8adac57d058444bfe2113fbb5dd364cd24d6052ad5f2cd8910a13c22b45` başına bağlanır. 17
değişmez eserin ve 34 okuyucu kimliğinin tamamını korur; son fail-closed T08
uyumluluk-okuyucusu yükseltmesinden sonra `[0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 14]`
indekslerini yeniden mühürler. Sıra 17 ile tüm eser baytları değişmez. Bu yalnızca incelenmiş
yerel okuyucu kanıtıdır; hosted M07-T08 sonucu iddia etmez. Geçici uyumluluk köprüleri G07'de
kaldırılmak üzere I07-04'e kayıtlı kalır.

İncelenmiş sıra 19, sıra 18'in
`4e9ac8adac57d058444bfe2113fbb5dd364cd24d6052ad5f2cd8910a13c22b45` başından sıra 19'un
`abf161e5a85053e19ce218127aa3f7d3a3ac8480b68b01a4185618ac732393a3` başına bağlanır. 17
değişmez eserin ve 34 okuyucu kimliğinin tamamını korurken yalnızca `[28]` okuyucu indeksini
93.916 bayt ve
`sha256:d0b6ec50df131066283619a01fa41fffdbb2a68c409d3c8d1a816f625f658521` olarak yeniden mühürler.
Fail-closed staging doğrulayıcısı, son T08 N-038/N-041 normatif metninin bayt uzunlukları eşit
olmasına rağmen anlamsal hash'lerinin eski kaldığını yakalamıştır; sıra 19 düzeltilmiş okuyucu
alındısını kaydeder. Sıra 1–18 ve tüm eser baytları değişmez. Bu yalnızca incelenmiş yerel
okuyucu kanıtıdır; hosted M07-T08 sonucu iddia etmez. Geçici uyumluluk köprüleri
`DEBT-I07-015` olarak I07-04'e, G07'de kaldırılmak üzere kayıtlı kalır.

İncelenmiş sıra 20, sıra 19'un
`abf161e5a85053e19ce218127aa3f7d3a3ac8480b68b01a4185618ac732393a3` başından sıra 20'nin
`8ba332b059e508dcb93aec4211edf3dcb10fb497d3a743b61ff7ee7e08c8a28e` başına bağlanır. 17
değişmez eserin ve 34 okuyucu kimliğinin tamamını korurken yalnızca `[30]` okuyucu indeksini
106.509 bayt ve
`sha256:d322bf867930215d0f9e0f532bdacbea4ba50145dfa5df38f2e559102cc080ef` olarak yeniden mühürler.
Fail-closed T07 aktivasyon okuyucusu, terminal close-race sağlamlaştırması
runtime-activation-internal kaynağını, odaklı testleri ve üretilmiş JavaScript/source map'i
değiştirdikten sonra eski kalmış T08 ardıl alındılarını ortaya çıkardı. Kesin ardıl alındıları
onarıldı; aktivasyon doğrulayıcısı ile 18/18 kök testi geçer ve bu alındı onarımı üretim
davranışını değiştirmedi. Sıra 1–19 ve tüm eser baytları değişmez. Bu yalnızca incelenmiş
yerel okuyucu kanıtıdır; hosted M07-T08 sonucu iddia etmez. Geçici uyumluluk köprüleri
`DEBT-I07-015` olarak I07-04'e, G07'de kaldırılmak üzere kayıtlı kalır.

İncelenmiş sıra 21, sıra 20'nin
`8ba332b059e508dcb93aec4211edf3dcb10fb497d3a743b61ff7ee7e08c8a28e` başından o zamanki
`ce12c066545e21779abf891898aaf0b09ceb1c0c1b51be382a0adabd5f86e939` başına bağlanır. Sıra
1–20'yi ve önceki tüm eser baytlarını aynen korur; 64.493 baytlık M07-T09 eserini
(`sha256:9d0f764e35f5400fa662874784fba6f6492a39a0e60557fe1a9c7d7eab5407c9`) ekler, 27 tarihsel
uyumluluk okuyucusunu yeniden mühürler ve 64.932 baytlık kanıt okuyucusunu
(`sha256:da3fed33227c78eef872d06a3aedaf98a4e87e91de12893a21aceb5a9365216f`) ile 17.341 baytlık kök
okuyucusunu (`sha256:f50017b668eb7f4a60d596a2d87a7e5b067989a9e1fe9a00270e685c44a4b8f6`) ekler. Zincir artık
18 değişmez eseri ve 36 güncel okuyucuyu doğrular. Bu incelenmiş yerel okuyucu kanıtıdır, hosted
M07-T09 iddiası değildir; geçici ardıl köprüleri G07'de I07-04 tarafından kaldırılmak üzere
`DEBT-I07-016` kaydındadır.

İncelenmiş sıra 22, kesin sıra 21 başı
`ce12c066545e21779abf891898aaf0b09ceb1c0c1b51be382a0adabd5f86e939` değerini
`aef9881c8fc540873f889a09754e5f2c19adc3c19934ba0fcfcf5e6a12b2da9e` o zamanki başına bağlar. 18
değişmez eserin tamamı ve 36 okuyucu kimliği korunur; yalnızca iş akışına bağımlı
`[8, 10, 11, 12, 14]` okuyucu indeksleri yeniden mühürlenir ve hiçbir dondurulmuş eser baytı
değişmez. Bu ek, I07-03 CI iş akışı alındılarının kesin yayılımını kaydeder; yeni bir kanıt iddiası
oluşturmaz.

İncelenmiş sıra 23, kesin sıra 22 başı
`aef9881c8fc540873f889a09754e5f2c19adc3c19934ba0fcfcf5e6a12b2da9e` değerini güncel
`3308da059b521c2b5f5fe75d036303221cace805094445f2d64383384831d45d` başına bağlar. Sıra
1–22 ile önceki tüm eser baytlarını korur, 58.059 baytlık M07-T10 eserini ekler ve toplam 19
değişmez eser ile 38 canlı okuyucuyu doğrular. T10 kanıt/kök okuyucuları iki yeni okuyucu
kimliğidir. Bu ek için gereken tarihsel köprüler `DEBT-I07-018` olarak I07-04'e, en geç G07'de
kaldırılmak üzere atanmıştır. Bu incelenmiş yerel okuyucu kanıtıdır; hosted M07-T10 sonucu iddia
etmez.

Kesin `REQUIRED + EXHAUSTIVE` çalıştırıcı tek geçme/kalma otoritesi olarak aynen korunur. I07-03,
yalnızca pull request'lerde çalışan ayrı bir `SHADOW + AFFECTED` gözlem işi ekler. İzlenen tüm
yolların sahipliği kesindir; bilinmeyen, belirsiz, güvenilmeyen, politika, bağımlılık, dondurulmuş
girdi veya desteklenmeyen değişiklikler tam `EXHAUSTIVE` çalışmaya genişler. Dar bir seçim yapılırsa
da seçilen tüm işler taze girdilerden gerçekten çalışır; önbellekteki kanıt başarısı kullanılmaz.
I07-03'ün tarihsel baseline seçicisi 20 kaynaklı karşılaştırma otoritesiyle
`sha256:20a78069ed829649ab9198cad68b5d7fede22dc3b6ec391ed84f5dd1f0afa86f` değerine sabitlenmiştir;
M07-T10 çalışma alanındaki güncel seçici digest'i ise
`sha256:010ef43efb4f4414d315ef4702324ae111c4666c38b3290f1a4891bebb3b98ea` değeridir.
Teknik karar ve sınırlar [`ADR 0011`](../adr/0011-modular-proof-infrastructure.md), kesin yerel ve
hosted kanıt ise [`I07-03 baseline`](../proof/baselines/i07-03-affected-selector-shadow.json) içinde
kayıtlıdır. Hosted başlangıç başarıyla çalıştı; shadow sonucu
`NOT_ELIGIBLE → EXHAUSTIVE / UNSUPPORTED_CHANGE_KIND` olduğu için uygun bir dar-alt-küme gözlemi
oluşmadı ve sayaç `0 / 20` kaldı. Yetkili hosted Quality gate geçti. Yerelde odaklı sözleşmeler
91/91, CI altyapı testleri 203/203 geçti. Tam yerel `REQUIRED + EXHAUSTIVE` çalışması ise iki
önceden var olan control-plane TCP yaşam döngüsü vakasında sandbox'ın `127.0.0.1` dinlemesini
`EPERM` ile reddetmesi nedeniyle `BLOCKED_BY_LOCAL_SANDBOX` olarak kaydedildi; aynı depo otoritesi
hosted gate'te geçti. Kesin run ve job kimlikleri baseline'dadır.
`DEBT-I07-017`, yalnızca shadow'a ait iş, sarmalayıcı ve test bağlantılarını I07-04'e, en geç G07'de
kaldırılmak üzere atar.
`M07-T07` tamamlandı: sistem M07-T04'ün referans kanıtı ile M07-T06'nın hazırlanmış adayını yalnızca
aynı paket ve Bundle kimliğine aitlerse birleştiriyor. Bu birleşimden sonra staging adayını ilk
bekleme veya disk işleminden önce tek kullanımlık hale getiriyor, aynı BundleStore kökünden Bundle'ı
yeniden okuyup tamamını karşılaştırıyor. Ardından `activeRevision`, `previousGoodRevision` ve
`generation` değerlerini tek atomik kayıt olarak yazıyor. İlk nesil 0'dan başlıyor, gerçek önceki
iyi sürüm korunuyor ve sayaç güvenli tam sayı sınırını aşıp başa dönemiyor. Web adaptörü ayrı bir
SQLite veritabanı kullanıyor ve native bağımlılığı yalnızca gerektiğinde yüklüyor. Önceden var
olan veya sonucu belirsiz bir kayıt otomatik olarak güvenilir sayılmıyor; açıkça kurtarma gerekiyor
durumuna geçiyor. Aktif kayıt sonradan kaybolursa sistem bunu yeni ve boş bir başlangıç saymıyor;
canlı yetkiyi iptal edip kurtarma istiyor, böylece nesil sayacı sıfırlanamıyor. Normal bir eski
nesil isteği ile sistemin son doğruladığı tam kaydın silinmesi veya aynı nesil numarasıyla
değiştirilmesi birbirinden ayrılıyor. Bundle okunurken fark edilen kurtarma durumu kalıcı kalıyor;
bekleyen işlem sistemi yeniden aktif yapamıyor. SQLite şeması ve sürümü yazma kilidi altında tekrar
doğrulandığı için sonradan eklenen bir trigger yazmadan önce reddediliyor. SQLite sorgularının
hazırlanması da aynı güvenli açılış ve temizlik sınırı içinde kalıyor. 21 uygulama testi, 25
derleyici-negatif testi ve 18 bağımsız kök
kanıt/mutasyon testi geçti. Kanıt eseri 49.892 bayt ve
`sha256:3129a8e40c837a1c49d7fe206de794e0f7f7e130dc7e5e90a012b9e38bf07334` ile sabittir. P-12 hâlâ
`NOT_PROVEN`; N-004, N-038 ve N-041 `PLANNED`; G07 açıktır. Bu T07 checkpoint'i için hosted başarı
iddia edilmemektedir.

`M07-T08` tamamlandı: uygulama yeniden açıldığında diskteki aktif, önceki-iyi ve nesil alanları
doğrudan güvenilir sayılmıyor. Sistem, kayıttaki aktif sürüm için ve kayıt gerektiriyorsa önceki-iyi
sürüm için tam olarak eşleşen M07-T03 paket yetkilerini istiyor. Her iki rol için M07-T04 referans
kontrolünü ve M07-T06 runtime hazırlığını içeride yeniden çalıştırıyor; kendi oluşturduğu hazırlık
yetkilerini disk okumadan önce tek kullanımlık hale getiriyor. Ardından kayıtta bulunan Bundle'ları
aynı değişmez depodan yeniden okuyup tam içeriklerini kapatıyor ve en son adımda diskteki üç alanın
hiçbirinin değişmediğini tekrar doğruluyor.

Başarılı kurtarma yalnızca aktif sürümün uygulama-içi yetkisini yeniden kuruyor. Önceki-iyi sürümün
doğrulanmış zinciri içeride saklanıyor ama otomatik geri dönüş, çalıştırma veya herkese açık yükleme
yetkisi vermiyor. Kurtarma diskte hiçbir şey yazmıyor; nesli artırmıyor, aktif ve önceki-iyi
alanlarını değiştirmiyor. Eksik, güvensiz, bozuk, farklı veya işlem sırasında değişen herhangi bir
zincirde ne aktif ne de yedek yetki yayınlanıyor. Sonucu belirsiz ve kaydı `null` olan durum tahmin
edilmiyor; aynı kök yeniden açılarak gerçek kalıcı kayıt tekrar okunmalı.

12 uygulama testi, 14 derleyici-negatif testi ve 9 bağımsız kök kanıt/mutasyon testi geçti. Kanıt
eseri 44.224 bayt ve
`sha256:c65d4f2de1407fffb891b5d3ba2fc8a3a8d4e3f0fb76c8b8f2719be6b310b3f9` ile sabittir. P-12 hâlâ
`NOT_PROVEN`; N-004, N-038 ve N-041 `PLANNED`; G07 açıktır. Yerel kökün uygulamaya ait ve güvenilir
olduğu varsayılır: dışarıda tutulan kriptografik bir çıpa olmadığından bu görev kurcalamaya karşı
mutlak koruma, kötü niyetli yönetici veya eski sürüme zorlamayı engelleme iddiası taşımaz.

`M07-T09` tamamlandı: 19 benzersiz hata vakası ve bir kapsam koruması; channel'ın gösterdiği
geçersiz adaydan değişmez fetch'e, bütünlük ve paket çözümünden referans/staging sınırlarına,
kalıcı commit ve yeniden başlatma kurtarmasına kadar gerçek üretim zincirini çalıştırıyor. Kesin
pre-commit hatalarının hiçbiri aday yetkisi yayınlamıyor ve diskteki A kaydını değiştirmiyor.
COMMIT sonrasındaki belirsizlik ayrı sınıflandırılıyor: yeni kazanan diske yazılmış olabilir ama
yeniden açılan controller tam kurtarma yapana kadar hiçbir aday aktif yetkisi yayınlanmıyor.
Kurtarma hataları iki rolün hiçbirini kısmi olarak yayınlamıyor ve son kalıcı kayıt gözlemi kazanıyor.

20 uygulama testi, 10 derleyici-negatif testi ve 11 bağımsız kök kanıt/mutasyon testi geçti. Kanıt
eseri 64.493 bayt ve
`sha256:9d0f764e35f5400fa662874784fba6f6492a39a0e60557fe1a9c7d7eab5407c9` ile sabittir. Son kanıt;
105 öğelik public dışa aktarım envanterini, 36 anahtarlık derlenmiş runtime yüzeyini, çalıştırılabilir
CI/ortak-durum kayıtlarını, sekiz önceki M07 eserini ve göreve atanmış 22 trace satırını kesin
olarak doğrular. Public fault hook, repository, SQLite handle veya yükleyici eklenmedi. N-004 artık
`TESTED`; P-12 `NOT_PROVEN`, N-038 ve N-041 `PLANNED`, G07 ise açıktır. Bu çalışma alanı kanıtıdır;
henüz hosted M07-T09 sonucu iddia edilmez.

`M07-T10` tamamlandı: sistem artık A sürümü çalışırken geçersiz B'nin araya girmesini, ardından
geçerli C'ye geçişi; aynı veya farklı adayların yarışmasını; aktivasyon ile kurtarmanın farklı
sıralarını; yeniden başlatmayı ve gerçek SQLite journal değişimini adlandırılmış vakalarla sınar.
Yazma kilidi alındıktan sonra ve commit sonrasında yayınlamadan önce SQLite'ın WAL,
`synchronous=FULL`, foreign-key, trusted-schema ve busy-timeout ayarlarının tamamı yeniden
doğrulanır. Bir ayar dışarıdan değiştirilmişse sistem onu gizlice düzeltmez; güvenli biçimde durur.
15 geçiş vakası, 16 uygulama testi, 9 derleyici-negatif test, 12 bağımsız kök mutasyon sınıfı, 9
önkoşul ve 15 sıralı trace satırı geçer. Kök kanıt native SQLite açamaz ve gerçek
`ERR_DLOPEN_DISABLED` reddini gösterir; yalnızca doğrulayıcı gereken dar native yetkiyi alır.
58.059 baytlık eser
`sha256:f5f10dd422f9e1fc7ca4445b84bf192280e59fb747d8d2ed40357cba3ebc0f39` ile sabittir. N-038 artık
`TESTED`; N-041 `PLANNED`, P-12 `NOT_PROVEN` ve G07 açıktır. Bu kanıt kurcalamaya karşı mutlak
koruma, eski sürüme döndürmeyi engelleme, hosted T10, host-channel veya native-conformance iddiası
taşımaz.

`M07-T11` tamamlandı: tarayıcı artık değiştirilebilir channel kaydını doğrudan yetki saymıyor.
Ayrı derlenen Node host sunucusu sabit channel'ı gerçek bearer-korumalı loopback API üzerinden
okuyor; Bundle bütünlüğünü, kurulu paketi, referansları, staging'i, aktivasyonu ve yeniden başlatma
kurtarmasını baştan doğruluyor. Tarayıcıya yalnızca doğrulanmış etkin Bundle ile dayanıklı
generation/revision kimliği veriliyor. Geçerli A gösteriliyor; geçersiz B A'yı değiştiremiyor;
geçerli C doğru previous-good kaydıyla A'nın yerini alıyor; yeniden açılışta kalıcı kazanan ilk
teslimden önce doğrulanıyor. Eski kalan veya kapandıktan sonra biten yenilemeler yayınlanamıyor ve
başarısız bir yenileme tarayıcıdaki son iyi yüzeyi koruyor. Dokuz adlandırılmış çalışma vakası ve
13 bağımsız mutasyon sınıfı bu zinciri bağlıyor.

Bu, yerel Web kanıtıdır. Uzak/multi-tenant/TLS dağıtımı, gerçek tarayıcı performansı, Desen App ürün
yeniden başlatması, kötü niyetli yöneticinin eşzamanlı kök değiştirmesine direnç, bağımsız
anti-rollback, Android veya iOS conformance iddiası taşımaz. P-12 M10-T07'ye kadar `NOT_PROVEN`,
N-041 M12-T05'e kadar `PLANNED` kalır.

I07-04 kampanyası artık 20 ardışık uygun hosted karşılaştırmanın tamamını sıfır yanlış negatifle
doğruladı. Kesin GitHub run, job, revizyon ve receipt kimlikleri; değiştirilemez tarihsel kampanya
özeti; seçici eşdeğerliği ve required-runner yetkisi I07-04 baseline'ında sabittir. Uygun ve aynı
repodaki pull request yalnız kendi gerçek dar kapsamını taze `REQUIRED + AFFECTED` olarak
çalıştırabilir. İzlenen dosya kümesi değişirse veya herhangi bir belirsizlik oluşursa sistem hata
gizlemez; bir kez `REQUIRED + EXHAUSTIVE` çalışmaya genişler. `main`, sürüm ve manuel denetim daima
tam çalışır. [Temizlik PR #36](https://github.com/desenlab/desen-app/pull/36)
`REQUIRED + EXHAUSTIVE` olarak geçti; `main`e inen
`6d87889bc088e45e219f430ee67e10c901c1a2fb` revizyonu da aynı tam kapsamla yeşil kaldı. Tek dosyalı
[canary PR #37](https://github.com/desenlab/desen-app/pull/37),
[run 31676049922 / job 94370743935](https://github.com/desenlab/desen-app/actions/runs/31676049922/job/94370743935)
içinde 3 dakika 54 saniyede taze `REQUIRED + AFFECTED` geçti: 10 iş yükü, bir kanıt birimi ve 10
kapanış; dar kapsam gerçekti ve önbellekten başarı okunmadı. On yedi G07 borcu `CLOSED` oldu;
`DEBT-I07-007` I07-05 için `OPEN` kalır. I07-04/G07 kapanışındaki tarihsel sequence 28,
`2577962251a9e6fa86993bd0e8bda1ed901f850a3b93678486c0445aed035546` başıyla 25 donmuş
artifact/50 güncel reader doğrular. I07-04 ve G07 artık `DONE`; kanıt kapıları 8/13, uygulama
ilerlemesi bu kapanış noktasında 85/145 görevdir (%59).

M08-T01 tamamlandı. `@desen/editor-core`, bilinmeyen inert JSON'u donmuş Source ve gömülü şema
yapısal doğrulayıcısından geçirir; başarıda sarmalayıcı, gizli AST veya düğüm dizini eklemeden
doğrudan ayrık ve özyinelemeli değişmez `desen.source` kökünü verir. Başarısızlık kısmi belge
yetkisi vermez. Bu dar sınırın exact kanıtı
[`EDITOR-CORE-SOURCE-DOCUMENT.md`](../proof/EDITOR-CORE-SOURCE-DOCUMENT.md) ve izlenen artifact'ta
korunur.

M08-T02 de tamamlandı. `insertDesenEditorNode`, seçili surface içindeki ortak node/behavior kimlik
alanında exact tabanı veya en düşük boş `-2`, `-3`, ... son ekini seçer; node ya da behavior'a ait
slot'un istenen sıralı sınırına yalnız `{id, use}` yaprağı ekler. Başarı yeni ayrık ve tamamen
donmuş doğrudan Source'u, hata ise kısmi belge ya da ayrılmış kimlik vermeyen donmuş tanıyı döndürür.
16/16 odak paket testi, 22/22 public-package testi ve 10/10 bağımsız kök kanıtı geçti. 19.561 baytlık
artifact `sha256:edc7dc1df296056be0c281ed268d07565b0eca2eed7ba7ba63e69ae6b74f6547`
ile sabittir. Güncel append-only okuyucu ardılı sequence 30'dur;
`f5598749a14e7d5eed27cb07e92a83f2bec28b5404f4480600e687d960f04970` başıyla 27 donmuş artifact
ve 54 güncel reader doğrular; tarihsel sequence 29 değişmez. Bu sonuç silme, taşıma ve yeniden
sıralamayı, kalan authoring komutlarını, persistence'ı, sürekli semantik doğrulamayı veya terminal
React/DOM sınırını kanıtlamaz. Bunlar M08-T03–M08-T10'da kalır. Genel ilerleme 87/145 (%60), M08
ilerlemesi 2/10, kanıt kapıları 8/13'tür; sıradaki iş M08-T03'tür.

M08-T03 de tamamlandı. `deleteDesenEditorNode` seçilen kök-olmayan alt ağacı silerken boşalan slot
anahtarını `[]` olarak korur; `moveDesenEditorNode` alt ağacı yalnız farklı sahip ya da slot'a
taşır; `reorderDesenEditorNode` aynı slot içinde silme-sonrası nihai indeksi uygular. Sağ kalan tüm
kimlikler ve semantik dizi sırası değişmeden kalır. Node/behavior hedefleri, prototype ile çakışan
slot adları, çözümlenmemiş yapısal semantik, exact no-op, sabit limit tavanları ve atomik
root/cycle/ambiguity/missing reddi kanıtlandı. 16/16 odak paket testi, kümülatif 26/26
public-package testi ve 10/10 bağımsız kök kanıtı geçti. 22.402 baytlık artifact
`sha256:0d44f67c316c21ff8b612221d01e81c76d3b24783164bb75a772985bbc7def8b` ile sabittir. Güncel
CI ardılı 157 iş yükü ve 74 kanıt çiftinden oluşur: 63 sıradan çift ve 11 bariyer. Güncel
append-only okuyucu ardılı sequence 31'dir;
`181d5a1e0c012f53cfe02640c2f8d0ddf1e300090a3c3742882bb3722175e42d` başıyla 28 donmuş artifact
ve 56 reader doğrular; tarihsel sequence 30 değişmez. `N-014` artık `TESTED`,
`S-002` ise terminal M08-T10 entegrasyonu beklediği için `PLANNED` kalır. Genel ilerleme 88/145
(%61), M08 ilerlemesi 3/10, kanıt kapıları 8/13'tür; sıradaki iş M08-T04'tür.

M08-T04 de tamamlandı. Paket; node/behavior prop'ları ve temel stil yaprakları ile node koşulları
ve sıralı varyantlar için on dört atomik, immutable komut sunar. Komutlar alakasız anlamsal sırayı,
bilerek boş bırakılan own container'ları, Catalog çözümü bekleyen yapısal olarak geçerli içeriği ve
mevcut bütün kimlikleri korur. Altı content-edit tanısı ile değişmeden aktarılan yapısal tanılar;
eksik veya belirsiz hedefleri, eksik yolları, geçersiz konumları, bozuk Unicode'u ve sabit 8 MiB /
25.000 kimlik / derinlik 64 sınır aşımlarını kısmi Source vermeden reddeder. Komut alanları kesin
enumerable own-data descriptor olmak zorundadır; inherited, accessor, symbol, extra-field,
function, own-`toJSON`, sparse/decorated-array ve unsafe-index şekilleri reddedilir, accessor
getter'ları ile `toJSON` hook'ları çağrılmaz. Gerekli JavaScript reflection işlemleri arbitrary
`Proxy` trap'lerini çalıştırabilir ve uygun şekli ileten bir `Proxy` kabul edilebilir; hostile-JS
veya no-code-execution membrane iddiası yoktur. Kümülatif paket testleri 55/55 (odaklı content-edit
16/16), public-package testleri 32/32 ve bağımsız kök kanıtı 10/10 geçer. İncelenen rapor
[`EDITOR-CORE-CONTENT-EDITS.md`](../proof/EDITOR-CORE-CONTENT-EDITS.md), 26.988 baytlık artifact ise
[`editor-core-0.1.0-content-edits.json`](../proof/artifacts/editor-core-0.1.0-content-edits.json)
dosyasıdır ve
`sha256:1726d453913c091d30229be02270a0cb4b74bf479f87027c4b9a0da3bb3c7066` ile sabittir. Kanıt,
donmuş M08-T02 ve M08-T03 artifact'larını doğrudan doğrular; 67 güncel dosya receipt'i toplar ve
davranışı 27 dosyalık izole ESM grafında çalıştırır.

Güncel yerel kod-otoriteli CI ardılı 159 iş yükü ve 75 kanıt çiftidir: 64 sıradan çift ve 11
bariyer; tutulan projeksiyon 519 önkoşul segmenti, 3.237 sıralı leaf çağrısı ve 251 farklı leaf'ten
oluşur. Nötr envanter
`sha256:3879dcd4c9716b7f08746953c62170de7bd33c786f747849b8aed38e0fe1e62c`, zorunlu plan ise
`sha256:30a193cbc27316792bd577dcecdc87c10e680e2e033698ceb90787c2cbcf1b51` ile sabittir. Append-only
okuyucu ardılı sequence 32,
`9be019b902ee17a57c9e2f13270fa67fe26265d06e360719bd1542643be6a424` başıyla 29 donmuş artifact
ve 58 reader doğrular; tarihsel sequence 31 ve bütün öncül artifact baytları değişmez. Bunlar yerel
kod-otoriteli güncel kanıttır; hosted M08-T04 başarısı iddia edilmez. `N-014` `TESTED`, `S-002`
`PLANNED` kalır; hiçbir `P-*`, `N-*`, `S-*` veya kanıt-kapısı statüsü değişmez. Genel ilerleme
89/145 (%61), M08 ilerlemesi 4/10, kanıt kapıları 8/13'tür; sıradaki iş M08-T05 state declaration
ve binding düzenleme komutlarıdır.

M08-T05 de tamamlandı. Paket; state tanımı ekleme/silme, state schema ve başlangıç değeri değiştirme,
var olan repeat'in items/key alanlarını değiştirme ve adlandırılmış resource input ekleme/silme için
sekiz atomik, immutable komut sunar. State silme, referansları veya action'ları otomatik olarak
yeniden yazmaz ve zorunlu boş state map'ini korur. Repeat düzenlemeleri alias, limit ve extension
verilerini; resource-input silme ise zorunlu boş input map'ini korur. Noktalı state adları,
prototype ile çakışan adlar, schema'lar, başlangıç değerleri ve binding'ler değerlendirilmeden veri
olarak kalır. Başarı yeni, ayrık ve tamamen donmuş doğrudan Source verir; hata kısmi belge vermeden
atomik olarak kapanır.

Komut alanları kesin enumerable own-data descriptor olmalıdır. Accessor ve own-`toJSON` hook'ları
çalıştırılmadan reddedilir. Gerekli reflection arbitrary `Proxy` trap'lerini çalıştırabilir; uygun
bir forwarding `Proxy` kabul edilebilir ve hata atan trap kontrollü komut hatasına çevrilir. Bu,
hostile-JavaScript veya no-code-execution membrane kanıtı değildir. 14/14 odak vaka ve 14
derleyici-negatif doğrulama, 38/38 public-package vakası ve 48 public derleyici-negatif doğrulama,
ayrıca 10/10 bağımsız kök kanıtı geçer. 30.014 baytlık artifact
[`editor-core-0.1.0-state-binding-edits.json`](../proof/artifacts/editor-core-0.1.0-state-binding-edits.json)
dosyasıdır ve
`sha256:b85e578ac2bc27897517f12d8d4cf867a089cd61ff9fd1ab0664c819977634f8` ile sabittir; incelenen
rapor [`EDITOR-CORE-STATE-BINDING-EDITS.md`](../proof/EDITOR-CORE-STATE-BINDING-EDITS.md) içindedir.
Son mühürlü M08-T05 yerel CI ardılı 161 iş yükü ve 76 kanıt çiftinden oluşur: 65 sıradan çift ve
11 bariyer. Sequence 33 checkpoint'i
`64da5390046020ed223da42ce8a24d9fcf971c6a5a0a92fc49d368586414c871` başında 30 değişmez
artifact ile 60 güncel okuyucuyu doğrular; sequence 32 ve önceki tüm baytlar korunur.

Yapısal kabul geçersiz bir Draft 2020-12 state schema'sını şimdiden reddeder; initial/schema
uyumluluğu, noktalı state erişilebilirliği, repeat semantiği, Catalog resource-input sözleşmeleri ve
sürekli invalid-node tanıları M08-T09'da; terminal
React/DOM sınırı ve G08 ise M08-T10/G08'de kalır. Hiçbir `P-*`, `N-*`, `S-*` veya kanıt-kapısı
statüsü değişmez. Genel ilerleme 90/145 (%62), M08 ilerlemesi 5/10, kanıt kapıları 8/13'tür;
sıradaki iş M08-T06 event ve kapalı action düzenleme komutlarıdır.

M08-T06 da tamamlandı. Paket; event handler ekleme/silme ile action ekleme/değiştirme/silme/yeniden
sıralama için altı atomik ve immutable komut sunar. Komutlar yüzey içinde tekil bir node veya
behavior sahibini hedefler. Kök event listeleri ve iç içe `operation.invoke`
`onSuccess`/`onFailure` listeleri canonical, owner-relative RFC 6901 pointer'larıyla adreslenir;
yeniden sıralama, çıkarma sonrası son indeksi kullanır. Son handler veya action silinse bile boş
event map'leri, action dizileri ve settlement dizileri korunur. Yedi DESEN 0.1.0 action çeşidinin
tamamı; guard'lar, parametreler, input'lar, payload'lar, iç içe action'lar ve extension'larla
birlikte çalıştırılmadan ve semantik olarak çözümlenmeden bütün veri olarak taşınır.

Komut alanları kesin enumerable own-data descriptor olmalıdır. Accessor ve own-`toJSON` hook'ları
çalıştırılmadan reddedilir; gerekli JavaScript reflection arbitrary `Proxy` trap'lerini
çalıştırabilir, uygun forwarding `Proxy` kabul edilebilir ve hata atan trap kontrollü komut
hatasına çevrilir. Başarı yeni, ayrık ve tamamen donmuş doğrudan Source verir; hata kısmi belge
vermeden atomik kapanır. Sabit profil 8.388.608 canonical Source baytı, seçili yüzey başına 25.000
kimlik, seçili sahip başına 25.000 action occurrence, kökü sıfır sayılan 64 Source derinliği ve
kök action'ları sıfır sayılan 64 action nesting derinliğidir.

16/16 odak runtime vakası ile 19 derleyici-negatif doğrulama, kümülatif 85/85 editor vakası,
44/44 public-package vakası ile 69 public derleyici-negatif doğrulama ve 10/10 bağımsız kök kanıtı
geçer. Public paket 33 runtime ve 69 type export taşır; M08-T06 altı runtime komutuyla 14 public
type, toplam 20 task-owned declaration ekler. 31.310 baytlık artifact
[`editor-core-0.1.0-event-action-edits.json`](../proof/artifacts/editor-core-0.1.0-event-action-edits.json)
dosyasıdır ve
`sha256:05a7df153512b8dd0f8289991d12a9d12d79903ed8b3637ef6c8a450ca8a6be7` ile sabittir; incelenen
rapor [`EDITOR-CORE-EVENT-ACTION-EDITS.md`](../proof/EDITOR-CORE-EVENT-ACTION-EDITS.md) içindedir.
Kanıtın tek doğrudan resmi önkoşulu donmuş M08-T05 artifact'ıdır; 81 exact receipt toplar ve
davranışı 8 editor ile 21 dependency dosyasından oluşan 29 dosyalık izole ESM grafında, 17 exact
statik kenarla çalıştırır.

Tarihsel M08-T06 CI ardılı 163 iş yükü ve 77 kanıt çiftidir: 66 sıradan çift ve 11 bariyer. O
zamanki tutulan
quality plan `sha256:bc3a2cdc47a430b8c08fc80714fc043a877ced3a0cc62b13ce14743e0d66401d`; nötr envanter,
impact graph, workload set ve ordered projection sırasıyla
`sha256:e9ec8cad80932a2e1ced17f72525c3e36351fc020eca342791feb0d02cfc1f53`,
`sha256:f7be1ee5bc35a7b0ea2cdcdabacf13f4525fcdabeb97e8854513ed4343e4aab3`,
`sha256:56c04c534906197d7597c7854ba792d0c96001612f13346a1a104371910fc22a` ve
`sha256:868d2a59cdf5e95badd7d0cce601003e26280609f44167c831e251595779e6e4` ile sabittir. Required ve
shadow plan'ları `sha256:7e6afbee5323e174f7507827a69785d8189cb27c1c99fb64b3def258111b3ff3` ve
`sha256:533bdab2a511433e0c1bdb4fab1be27430914489d722918d7d789bdf294d4caf` değerlerindedir.

Affected authority, 1.080 tracked path'i
`sha256:6ea7a544be7ed7817c59b1d723f3a7f4d584e0c8a37def99ed70c375276cd9b8` ile mühürler; bunların
154'ü proof-owned'dır ve ownership projection
`sha256:53d18a28d028ea98406e4ded063f42e408e39bfd692761a8ca53c73c9177d828` değerindedir. O zamanki
selector ve required-runner authority değerleri
`sha256:19d0f2c281bccf26e941c9440e18a7015d281224eed8bdf71c92ee0b5a497975` ve
`sha256:6aef41c5155e041d3fd3f9f0343b1a8aefc66d530378b6e6f402f503cec4fe6d`; promotion artifact
`sha256:76a29908843c0bb9a4ca5ad74b5bc94383c3fa21463ce81e98bf53e8f01d7549` değerindedir. Sequence
34, `f641e8d20d0f5e94cca809d330e3ad5bb0d7ffe0c3ec5defc14e0b5fca63b674` başında 31 donmuş
artifact ve 62 o-zamanki reader doğrular; sequence 33 ve önceki bütün baytları korur, mevcut reader
index'leri `[50, 51, 52, 53, 54, 56, 58]` için yeniden mühürler ve yeni reader'ları `[60, 61]`
index'lerine ekler. Checkpoint 57/57, hedef CI altyapı testleri 235/235, required-affected 27/27 ve
promotion testleri 19/19 geçer.

M08-T07 de tamamlandı ve yeni runtime komutu ya da public export eklemeden mevcut factory ile 32
immutable komutun authoring/extension sınırını kanıtladı. Kök `authoring`, her başarılı geçişte
ayrık ve tamamen donmuş producer-owned parsed veri olarak korunur. Yalnız kök authoring'i farklı
iki Source'un authoring hariç projeksiyonları ve protokol Source digest'leri aynıdır; kök extension
değerindeki değişiklik ise digest'i değiştirir. Böylece dışlama sınırı yalnız kök authoring olarak
kalır.

Source'tan erişilebilen 16 extension konumunun tamamındaki unknown parsed değerler; önerilen
reverse-domain key ile yasal non-namespaced key'ler, iç içe dizi/nesneler ve görünüşte core alanlar
dahil, birebir ve inert veri olarak korunur. Editor bunları yorumlamaz, çözmez, normalize etmez ve
yalnız isimleri nedeniyle reddetmez. Bu garanti parsed JSON value round-trip'idir; lexical
whitespace veya object-member byte order garantisi değildir. 33/33 odak runtime vakası, 6 odak
compiler-negatif doğrulama, kümülatif 46/46 public-package vakası, 75 public compiler-negatif
doğrulama ve bağımsız kök kanıtı geçer. Authoring/extension içindeki sahte kimlikler ve action'lar
allocator/identity/action taramalarına girmez; kök authoring tam 8 MiB Source limitine dahildir.
Insert marker'ı ekler, move/reorder onu taşır, delete yalnız hedefle birlikte siler, whole-value
replace hedefin eski extension'ını yenisiyle değiştirir ve unrelated marker'lar korunur. Bilerek
silinen veya değiştirilen owner extension'ı için preservation iddiası yoktur. `N-012`, `N-018` ve
`S-003` artık `TESTED`'dır;
reverse-domain adlandırma hard validation değil rehberlik olarak kalır.

Exact M08-T07 artifact'ı 62.304 bayttır:
[`editor-core-0.1.0-authoring-round-trip.json`](../proof/artifacts/editor-core-0.1.0-authoring-round-trip.json)
`sha256:33b6f81be62076d304c6daaec5d860e7995fa69ceaf34103469b349a347962db`. Bağımsız kök kanıtı
10/10 geçer; verifier 95 tracked receipt, 29 dosyalık izole graph ve 17 statik kenarı doğrular.
Güncel CI ardılı 165 iş yükü, 78 kanıt çifti, 549 prerequisite segment, 3.435 ordered leaf ve 260
distinct leaf taşır. Sequence 35,
`a2e3ef962ed37e0570cdddef64ae8d0eef2fd3f298cc2580f7ee65d8200f6fa3` başında 32 donmuş artifact
ve 64 güncel reader doğrular; sequence 34 ve daha eski bütün baytlar aynıdır. On iki değişen canlı
tarihsel reader `[50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61]`, T07 proof/root reader'ları
`[62, 63]` index'lerinde mühürlenir ve
checkpoint 58/58 geçer. Güncel tam CI altyapı suite'i 265/265; required-affected, promotion ve
tutulan legacy-gate suite'leri ayrıca 27/27, 19/19 ve 25/25 geçer. Bunlar yerel code-owned
kayıtlardır; hosted M08-T07 iddiası değildir.

M08-T08 de tamamlandı. `@desen/editor-core`, storage adapter'ında `readSource` ve generation-guarded
compare-and-set yazmayı tanımlayan, dışarıya ise platformdan bağımsız open/save işlemleri veren
persistence port'unu taşır. Core; browser, React, DOM, Node, filesystem, SQLite veya transport
yetkisi almaz. Her save, kök `authoring` ve bütün extension değerleri dahil tam Source'u kanonik
baytlara çevirir, 8 MiB sınırını uygular, baytları yeniden admit eder ve yalnız ayrık/recursive
donmuş sonuç döndürür. Created, unchanged, updated, conflict, exhausted, kesin hata ve
`indeterminate` sonuçları ayrıdır; belirsiz yazma otomatik retry veya merge edilmez, yalnız reopen
ile çözülür.

`@desen/editor-web` local adapter'ı exact lexical `http://127.0.0.1:<port>` origin, bearer token,
redirect reddi ve açıkça enjekte edilmiş fetch-shaped callback ister. Global fetch fallback'i,
filesystem veya SQLite yetkisi yoktur. Mevcut M07-T05 `openLocalControlPlane` SQLite/filesystem
uygulaması değiştirilmeden durability otoritesi olarak kalır. OS-temp native SQLite üzerinde iki
bağımsız control-plane instance ve iki editor port, aynı generation için tek generation-3 kazananı
ve bir conflict'i; close/reopen sonrasında exact generation-3 Source'u; kök authoring ile
Source'tan erişilebilen 16 extension konumunun tamamını kanıtlar. Gerçek route'a kalıcı olarak
ulaştırılıp cevabı saklanan PUT `indeterminate` döner, retry yapmaz ve sonraki reopen committed
generation'ı çözer.

Exact M08-T08 artifact'ı 49.785 bayttır:
[`editor-core-0.1.0-persistence.json`](../proof/artifacts/editor-core-0.1.0-persistence.json)
`sha256:51932d4165afff3c40fae6769527e480f6d0ff355f3fbc6d8ae7c6809e50a6fe`. Core persistence
10/10; kümülatif core public-package 49/49 ve 96 compiler-negatif; Web odak suite'i 12/12; Web
public-package 3/3 ve 6 compiler-negatif; bağımsız kök kanıtı 10/10 geçer. Verifier 218 tracked
receipt'i, bunların içinde 180 emitted distribution receipt'ini doğrular. Güncel CI ardılı 168 iş
yükü ve 79 kanıt çifti taşır. Sequence 36, önceki bütün artifact baytlarını koruyarak 33 donmuş
artifact ve 66 güncel reader doğrular; tarihsel M08-T01–M08-T07 hash'leri değişmez. Bunlar yerel
code-owned kayıtlardır; hosted M08-T08 iddiası değildir. `N-012`, `N-018` ve `S-003` `TESTED`
kalır; kanıt kapısı veya başka normatif statü değişmez.

M08-T09 sürekli semantik diagnostic/invalid-node mapping'ini; M08-T10 ise terminal React/DOM sınırı,
cross-command determinizm ve G08'i taşır. Genel ilerleme 93/145 (%64), M08 ilerlemesi 8/10, kanıt
kapıları 8/13'tür; sıradaki iş M08-T09'dur.

M08-T09 da tamamlandı. `createDesenEditorContinuousValidator`, bir Catalog set'ini ayrık ve donmuş
snapshot olarak yakalar; Catalog admission başarısızsa kısmi validator vermez. Her senkron doğrulama
çağrısı doğrudan editor Source'unu yalnız bir kez yeniden admit eder ve aynı immutable snapshot'tan
kümülatif execution-contract diagnostic'lerini, bütün dinamik obligation'ları, kök `authoring` dahil
document fingerprint'ini ve Catalog array sırasına duyarlı Catalog-set fingerprint'ini üretir.

Invalid-node eşlemesi yalnız Validator'ın açık `context.surfaceId` ve `context.subject` alanlarını
otorite kabul eder. Pointer, diagnostic code/message veya capability kimliği üzerinden tahmin
yapılmaz. Aynı node ya da behavior kimliğinin bütün occurrence'ları kararlı sırada korunur; node ve
behavior türleri metinleri aynı olsa da birleşmez; açık ve mevcut subject'i olmayan diagnostic'ler
kontrollü unmapped index olarak kalır. Obligation bulunması tek başına Source'u invalid yapmaz. API
timer, worker, subscription, React, DOM, persistence generation, storage, network veya obligation
execution yetkisi almaz.

Odak suite 12/12 ve dokuz compiler-negatif; kümülatif editor-core 140/140; public package 50/50 ve
102 compiler-negatif; bağımsız kök kanıtı 8/8 geçer. Exact kanıt
[`EDITOR-CORE-CONTINUOUS-VALIDATION.md`](../proof/EDITOR-CORE-CONTINUOUS-VALIDATION.md) ve
40,099 baytlık
[`editor-core-0.1.0-continuous-validation.json`](../proof/artifacts/editor-core-0.1.0-continuous-validation.json)
dosyalarındadır; artifact
`sha256:7739b5143685d613a678c6eca5480f27a5a303b176bf2bf4613a4d6917fe7e5a` ile pinlenir. Resmi
donmuş önkoşullar M08-T03–M08-T07'dir; M08-T08 persistence mevcut paket
uyumluluğu olarak doğrulanır fakat resmi önkoşul değildir. CI ardılı 170 iş yükü ve 80 kanıt çifti;
sequence 37 ise önceki artifact baytlarını koruyarak 34 artifact ve 68 reader taşır.

`N-012`, `N-014`, `N-018` ve `S-003` `TESTED` kalır; `S-002` terminal entegrasyon için `PLANNED`,
`P-18` `PARTIAL` ve kanıt kapıları 8/13 kalır. Genel ilerleme 94/145 (%65), M08 ilerlemesi 9/10'dur;
sıradaki iş M08-T10 terminal React/DOM sınırı, cross-command determinizm ve G08 kapanışıdır.

M08-T10 ve G08 de tamamlandı. Terminal kanıt yeni bir production helper veya public export
eklemeden, donmuş M08-T01–M08-T09 artifact'larının tamamını ve P-18'in M01-T05/M04-T16/M04-T17
platform/JSON-trace önkoşullarını doğrular. Exact emitted editor-core graph'ı iki bağımsız geçici
ESM graph'ına kopyalanır ve her ikisinde aynı sıralı 32-adımlı komut transcript'i çalıştırılır:
insert, üç structural, on dört content, sekiz state/binding ve altı event/action komutu. Her başarılı
geçiş yeni recursively frozen doğrudan Source döndürür ve önceki Source'u değiştirmez. Insert yalnız
`sign-in.terminal` kimliğini ekler, delete yalnız hazırlanmış `sign-in.terminal-delete` alt ağacını
çıkarır, diğer otuz geçiş bütün node/behavior kimlik multiset'ini korur. Araya yerleştirilen bir
missing-target komutu kısmi belge vermeden kontrollü başarısız olur; sonraki geçerli komut byte-exact
snapshot'tan devam eder.

Terminal Source, M08-T09 validator'ından sıfır diagnostic, yedi korunmuş dynamic obligation ve sıfır
invalid/unmapped subject ile geçer. Enjekte edilen in-memory compare-and-set adapter, M08-T08 portunu
generation-one save/open ve exact canonical Source baytlarıyla doğrular. Yalnız kök `authoring`
alanında farklı iki Source aynı protocol Source digest'ini korurken farklı complete-document
fingerprint'leri alır. İki bağımsız graph terminal Source, kimlik ledger'ı, validation sonucu,
persistence receipt'leri ve callback-free JSON/RFC 8785 trace commitment'lerinde byte-identical
sonuç verir.

Odak terminal suite 4/4, bütün editor-core paketi 144/144, public package 50/50 ve 102
compiler-negatif, bağımsız kök kanıtı 10/10 ve exact verifier PASS'tir. TypeScript AST denetimi dokuz
source, dokuz emitted JavaScript ve dokuz emitted declaration dosyasının tamamını kapsar; kabul
edilen graph React, ReactDOM, DOM/browser, Node-platform, CSS, dynamic-import, `eval` veya
function-constructor yetkisi taşımaz. Exact kanıt 325,549 baytlık
[`editor-core-0.1.0-terminal-integration.json`](../proof/artifacts/editor-core-0.1.0-terminal-integration.json)
artifact'ıdır ve
`sha256:5787479d699ab8f53b739e633bf9a88900da00ae4f4c78f96b3e62a73133fa1b` ile pinlenir; incelenen
rapor [`EDITOR-CORE-TERMINAL-INTEGRATION.md`](../proof/EDITOR-CORE-TERMINAL-INTEGRATION.md)'dir.

Bu kapanışla `S-002` `TESTED`, `P-18` `PROVEN`, G08 `DONE` ve kanıt kapıları 9/13 olur. Genel
ilerleme 95/145 (%66), M08 ilerlemesi 10/10'dur; sıradaki iş M09-T01 Desen App shell ve proje
navigation'dır. React renderer/DOM davranışı, selection/viewport/undo politikası, multi-user
senkronizasyon, somut durable storage/network adapter'ı, dynamic obligation execution,
hostile-JavaScript sandbox'ı ve streaming/preallocation memory-DoS sınırı bu kanıtın dışındadır.

M09-T01 artık `DONE`'dır. İlk React/Vite Desen App kabuğu; tam ekran proje galerisini, proje
seviyesindeki surface galerilerini, ortalanmış inert surface çerçevesini, kapalı `/projects`,
`/projects/:projectId` ve `/projects/:projectId/surfaces/:surfaceId` rota profilini, aynı origin
History API geçişlerini, sabit ve inert fixture aramasını, açık not-found geri dönüşünü, responsive
yerleşimi ve klavye/erişilebilirlik davranışını sağlar. M09 UX wireframe'i bilgi mimarisi ve görev
sınırlarını, daha önceki Desen ürün keşfi ise görsel dili besler. İki Figma kaynağı da
çalıştırılabilir kaynak veya kanıt otoritesi değildir.

Uygulama build, typecheck ve lint kontrolleri yerelde geçer; odak uygulama suite'i 43/43, bağımsız
mutasyon suite'i 8/8 geçer. Exact kanıt, beş repository-owned SVG asset dahil 24 tracked dosyayı ve
43 runtime case'i kaydeden 12.118 baytlık
[`desen-app-0.1.0-shell-navigation.json`](../proof/artifacts/desen-app-0.1.0-shell-navigation.json)
artifact'ıdır ve
`sha256:c3189ff9196f0da91311156893ab569a3c9f9c1ee62631b58286647f36d23220` ile pinlenir. Sequence 40
63/63 geçer ve 36 donmuş artifact ile 72 reader'ı
`sha256:e19eabc91c56c015b7fec7469d096b09a4bf42f5b6edc907c0207dd8c94feb0e` başında doğrular.
M09-T01'in tarihsel CI successor'ı 174 workload ve 82 proof pair içerir; dağılım 71 ordinary pair
ve 11 barrier'dır. Bunlar yerel makbuzlardır; required gate veya hosted-CI başarısı çıkarımı
yapılmaz.

Bu dilim Catalog tabanlı panel/layer tree, gerçek adapter canvas'ı, Source düzenleme, diagnostics,
persistence, Design/Run, publish veya activation davranışı eklemez. Genel ilerleme 96/145 (%66),
M09 ilerlemesi 1/14, kanıt kapıları 9/13'tür; sıradaki iş M09-T02 Catalog tabanlı component panel ve
layer tree'dir.

M09-T02 artık `DONE`'dır. Read-only Components sekmesi, exact
`@desen/reference-catalog-web/catalog.json` içindeki beş component'ı Catalog-owned adları ve
authoring kategorileriyle gösterir. Layers sekmesi doğrulanmış official Source içindeki exact
`home` ve `sign-in` ağaçlarını; component/behavior kimliklerini, named slot'ları, koşul işaretlerini
ve child-array sırasını koruyarak yansıtır. Yerel component filtresi inert'tir; ekleme veya mutation
yapmaz. Katman görünümü de interactive tree ya da selection semantiği iddia etmez.

Uygulama önce `validateDesenInteractionCatalogSet` ile kümülatif Catalog setini doğrular, sonra
kabul edilen set karşısında `validateDesenSourceInteractionContracts` ile official Source'u
doğrular. Catalog reddi, Source reddi veya bounded projection limiti hiçbir kısmi authoring model
üretmez. Exact Source ağacı bulunmayan surface bu yokluğu açıkça gösterir ve `sign-in` ağacını
yerine koymaz. Exact kanıt 25.375 baytlık
[`desen-app-0.1.0-catalog-panel-layer-tree.json`](../proof/artifacts/desen-app-0.1.0-catalog-panel-layer-tree.json)
artifact'ıdır ve
`sha256:85a310feaf1a0cc3656055cd3a76eeb02e02a278c21d22167853b53c03f1ee61` ile pinlenir. Odak app
authoring suite'i 18/18, bağımsız kök kanıt 8/8 geçer.

Canlı yerel M09-T02 CI otoritesi 176 workload ve 83 proof pair içerir; bunlar 72 ordinary pair ile
11 barrier'a ayrılır. Sequence 41, 64/64 geçer ve 37 donmuş artifact ile 74 reader'ı
`sha256:b36679b7ea3ffd0e019d3051b30312dd96b050e10ae7d5d44cf39eb9d30eeb68` başında doğrularken exact
sequence 40 başını
`sha256:e19eabc91c56c015b7fec7469d096b09a4bf42f5b6edc907c0207dd8c94feb0e` ve bütün öncülleri korur.
İlk hosted PR koşusu, Node permission modelinin workspace'i hedefleyen isolation-fixture symlink'ini
reddettiğini gösterdi. Yeniden mühürlenen fixture yalnızca runner geçici alanındaki absolute
target'ları kullanır; exact isolation suite'i izin genişletmeden 8/8 geçer. Bu yerel task ve
CI-infrastructure makbuzları henüz required gate veya hosted-CI başarısı iddia etmez.

Bu dilim gerçek adapter canvas'ı, selection, inspector, insert/drag-drop, Source mutation,
persistence, Design/Run, diagnostics, publish veya activation eklemez. `P-*`, `N-*`, `S-*`, `G*`
ve kanıt-kapısı durumları değişmez. Genel ilerleme 97/145 (%67), M09 ilerlemesi 2/14, kanıt
kapıları 9/13'tür; sıradaki iş M09-T03 exact React adapter canvas'ıdır.

M09-T03 artık `DONE`'dır. Desen App, kontrollü official-derived Bundle'ı public Runtime Core
session API'leriyle mount eder, exact public static reference-adapter registry'sini preflight eder
ve commit edilmiş canlı surface'i public Runtime React hook/boundary üzerinden render eder. Yalnızca
exact `account-app` / `sign-in` tuple'ı, `com.example.account-app` document'ı ve
`sha256:2dc98d276a3b4102c2891de1519bda86ea2978f5429fd8ea91831f36f8b73ffb` revision'ı kabul
edilir. Design preview içindeki managed kontroller inert all-deny host port'ları arkasında disabled kalır.
Desteklenmeyen tuple sign-in yerine koymaz ve runtime session mount etmez; rota değişimi, React
Strict Mode replay'i ve final unmount exact session'ı dispose eder.

Odak canvas suite'i 20/20, tam App suite'i 56/56 ve bağımsız kök kanıt 11/11 geçer; App
typecheck, lint ve production build de yerelde geçer. Exact kanıt 73.111 baytlık
[`desen-app-0.1.0-real-adapter-canvas.json`](../proof/artifacts/desen-app-0.1.0-real-adapter-canvas.json)
artifact'ıdır ve
`sha256:8f89b237c20d80e83d96f17c31146d251c026977a4fff1ab1d0822e489c63151` ile pinlenir. İki
deterministik Vite `build({ write: false })` gözlemi de 102 modül, 290 static import, sıfır dynamic
ve unresolved import ile 101 backing file üretir. Kontrollü managed dilim, donmuş reference-host
source audit'indeki exact 19 transformed runtime/component modül kimliğini paylaşır ve beş gerçek
component'ın tamamına ulaşır.

Canlı yerel M09-T03 CI otoritesi 178 workload ve 84 proof pair içerir; bunlar 73 ordinary pair ile
11 barrier'a ayrılır. Formal impact parent'ları exact M09-T01 shell ve M05-T09 reference-host
source audit'idir; affected closure 51 proof unit ve 112 workload'dur. Sequence 42, 65/65 geçer;
38 donmuş artifact ile 76 reader'ı
`sha256:40d7c380cec3a7efd04316959a41abda3c8f71c1604f7f2fb892f18ae4cd2fa5` başında doğrular ve
exact sequence 41 başı
`sha256:b36679b7ea3ffd0e019d3051b30312dd96b050e10ae7d5d44cf39eb9d30eeb68` ile bütün öncülleri
korur. Bunlar yerel task ve CI-infrastructure makbuzlarıdır; required gate veya hosted-CI başarısı
iddia edilmez.

Bu kapanışla P-06 `PROVEN`, genel ilerleme 98/145 (%68), M09 ilerlemesi 3/14 ve kanıt kapıları
10/13 olur. `S-001`, M09-T11'deki görünür approximate-fidelity disclosure için `PLANNED` kalır;
PF-059 `OPEN`, P-07 ise M10-T05 browser E2E beklerken `PARTIAL` kalır. Selection/private-DOM
overlay, inspector editing, mutation, Design/Run, persistence, diagnostics, publish ve activation
bu dilimin dışındadır; sıradaki iş M09-T04'tür.

M09-T04 artık `DONE`'dır. Route-local seçim, yalnız doğrulanmış authoring model içindeki exact
project, surface, Source-node, capability, display ve conditional primitive'lerinden üretilir.
Runtime eşlemesi yalnız public, callback-free Runtime React diagnostic index'ini okur; tekrar eden
component instance'larını ayrı tutar, attached behavior kimliklerini eler, materialize olmayan
seçimi yalnız Source'ta açıkça conditional olan component için dürüstçe gösterir ve unknown, stale,
cross-route veya forged kimlikleri overlay vermeden reddeder.

Managed Runtime React ağacı disabled fieldset içinde kalır. Desen App'in kompakt, pointer-inert
identity/status kartı bu fieldset'in ve işaretli capability subtree'nin DOM kardeşidir; managed
child, DOM/native handle, private React değeri, registry, session, callback, hit-test veya geometry
yetkisi almaz. Native layer button'ları Select/Deselect erişilebilir adlarını, `aria-pressed`
durumunu, conditional bağlamı, sarmalanan klavye geçişini ve canlı panel geri bildirimini taşır.
Route değişimi seçimi senkron sıfırlar. Desktop ve mobil etkileşimleri manuel doğrulanmıştır; bu
browser E2E iddiası değildir.

Odak App selection suite'i 27/27, bağımsız kök kanıt 10/10 geçer; App typecheck, lint ve production
build de yerelde geçer. Exact kanıt 11.997 baytlık
[`desen-app-0.1.0-selection-overlay.json`](../proof/artifacts/desen-app-0.1.0-selection-overlay.json)
artifact'ıdır ve
`sha256:9a3805545ea49820c744fc07b9c3b0c2919b3e2fb524f9855df1cec9058901b1` ile pinlenir. Tek doğrudan
parent, 73.111 baytlık M09-T03 artifact'ıdır:
`sha256:8f89b237c20d80e83d96f17c31146d251c026977a4fff1ab1d0822e489c63151`. Canlı yerel CI otoritesi
180 workload ve 85 proof pair taşır; bunlar 74 ordinary pair ve 11 barrier'dır. Selection-overlay
connected closure 52 proof unit/114 workload, ownership ise 1.164 tracked path/170 proof-owned path
içerir. Sequence 43, 66/66 geçer ve
`sha256:0bbb101332d7af5dcf7260b6df6961837003571f67a6e3a69232e65e19cded58` başında sequence 42 ile
38 predecessor artifact'ın tamamını korur; T04 artifact'ını index 38'e ekler, predecessor
compatibility reader'ları `[70, 71, 72, 73, 74, 75]` index'lerinde yeniden mühürler ve T04
proof/root reader'larını `[76, 77]` index'lerine ekler. Güncel zincir 39 artifact/78 reader taşır;
structural CI suite 317/317 geçer. Bunlar yerel makbuzlardır; required gate veya hosted CI pass'i
iddia edilmez.

Bu kapanışla `N-042` exact kontrollü Web–React profili için `TESTED` olur. P-06 `PROVEN`, P-07 ve
P-16 `PARTIAL`, kanıt kapıları 10/13 kalır. Genel ilerleme 99/145 (%68), M09 ilerlemesi 4/14'tür.
Component geometry/hit testing/canvas picking, inspector veya Source mutation,
insert/cardinality/drag-drop, state/action authoring, Design/Run, diagnostics navigation/placeholder,
persistence, browser E2E, publish ve activation kanıtlanmaz; sıradaki iş M09-T05'tir.

M09-T05 artık `DONE`'dır. Seçili exact Source component'ı için tek App-owned Inspector,
validator tarafından kabul edilen Catalog `propsSchema`'sını public Catalog SDK ile kontrol
planına dönüştürür. String, boolean, number, integer ve primitive-enum değerleri native
kontroller alır. Dynamic `$ref` değerleri M09-T08'e, group/structured descriptor'lar M09-T06'ya
kadar görünür ama kilitli kalır; etiket ve açıklamalar şema otoritesinin yerini almaz.

Her edit komutu yetkilendirmeden önce exact own-enumerable data snapshot'ına indirgenir.
Proxy-backed komutlar property getter çağırmadan yalnız yakalanmış own data üzerinden
tüketilir; accessor, extra-field ve symbol içeren şekiller reddedilir. Route, selection, Source
node, capability, control, requiredness, mevcut değer türü ve primitive tip güncel immutable
Source ile Catalog'dan yeniden türetilir. Yalnız bundan sonra public Editor Core set/delete komutu
aday üretebilir ve tam aday Source public continuous Catalog validator'dan geçmeden başarı
dönmez.

Editor Core başarısı da public Publisher tam aday Source'u exact reference Catalog package
candidate karşısında kabul edene kadar geçicidir. App, `{document, preview}` durumunu yalnız bu
preflight'tan sonra tek session update'i olarak değiştirir. Publisher reddi önceki Source ve
çalışan preview'yu birlikte korur; kabul edilen Bundle revision'ı exact Runtime session'ı
değiştirir ve öncülünü dispose eder. Inspector disabled managed fieldset ve capability
subtree dışında bir App-owned `aside`'dır; private DOM/native, geometry, hit-test, canvas-picking,
registry, session veya runtime callback yetkisi almaz.

Odak Inspector suite'i 41/41, tam App suite'i 86/86 ve bağımsız kök kanıt 10/10 geçer; App
typecheck, lint ve production build de yerelde geçer. Exact kanıt 22.998 baytlık
[`desen-app-0.1.0-schema-inspector.json`](../proof/artifacts/desen-app-0.1.0-schema-inspector.json)
artifact'ıdır ve
`sha256:473ab3248ed7b7b4de0e558df47159a74c28c134b46569aa91130745fd69660b` ile pinlenir. Doğrudan
parent'lar exact M09-T02 Catalog paneli, M09-T04 selection overlay'i ve M06-T10 Publisher official
golden artifact'ıdır. Canlı yerel CI envanteri 182 workload ve 86 proof pair kaydeder; bunlar 75
ordinary pair ve 11 barrier'dır. Connected closure 53 proof unit/116 workload, ownership ise 1.175
tracked path/172 proof-owned path'tir. Sequence 44,
`sha256:f0c5f3bfbc30ccf230c5256b3a5672c29ffa0e884129ae210571895bd063812c` başında 67/67 geçer;
ilk 43 checkpoint'i koruyarak zinciri 40 artifact ve 80 reader'a çıkarır. Tam structural CI suite'i
yerelde 320/320 geçer. Bunlar yerel task/CI makbuzlarıdır; required gate veya hosted-CI başarısı
iddia edilmez.

P-08 `NOT_PROVEN` ve kanıt kapıları 10/13 kalır. Genel ilerleme 100/145 (%69), M09 ilerlemesi
5/14'tür (%36). Nested-object/structured-JSON edit, state/binding ve event/action authoring,
Design/Run, persistence, browser E2E, control-plane publish ve activation daha sonraki sahiplerde
kalır; sıradaki iş M09-T06'dır.

M09-T06 artık `DONE`'dır. Inspector, kapalı nesne şemalarını canonical çocuk sırası ve exact
RFC 6901 pointer'larıyla recursive alan gruplarına dönüştürür. Mevcut gruplar native alt
kontrollerle düzenlenir; bulunmayan optional grup tek bir complete JSON object olarak atomik
oluşturulur. Array, open object, union, reference, combinator, conditional, pattern-property,
desteklenmeyen şekil ve derivation-limit sonuçları görünür bir gerekçe taşıyan structured-JSON
fallback'inda kalır.

Structured JSON, parse edilmeden önce Publisher Source JSON limitleriyle taranır. Malformed veya
non-finite JSON, decoded duplicate member, unpaired Unicode, limit aşımı ve `$` ile başlayan her
decoded object key kısmi değer vermeden reddedilir. Başarılı değer detached ve recursively frozen
olur. Pretty format limit büyümesini erken durdurup gerektiğinde canonical compact JSON'a döner.

Route, selection, edit, validator-admitted Source ve Catalog snapshot'ları yetkilendirmeden önce
exact olarak yakalanır. Nested edit yalnız complete top-level owner prop'u public Editor Core
üzerinden yeniden kurar. Root fallback yalnız değişen prop'ları sayar; 256 transition ve 32 MiB
toplam snapshot-work sınırını uygular, delete ve shrink işlemlerini growth'tan önce yapar. Tam aday
Source continuous validation ve Publisher preflight geçmeden document/preview değişmez.

Odak suite 73/73, tam App suite 118/118, bağımsız kök kanıt 10/10 ve tam structural CI glob 323/323
geçer. Exact artifact 26.133 bayttır ve
`sha256:6ea4eb3f51fdfc39eeca676d7ebafb145d66a9efdfa03af9c33a7aa39aa6aaec` ile pinlenir. Yerel CI
184 workload/87 proof pair, closure 54 proof unit/118 workload ve ownership 1.184
tracked/174 proof-owned path'tir. Sequence 45, 41 artifact ve 82 reader içerir. Bunlar required-gate
veya hosted-CI iddiası değildir.

P-08 `NOT_PROVEN`, PF-025 `OPEN` ve kanıt kapıları 10/13 kalır. Genel ilerleme 101/145 (%70),
M09 ilerlemesi 6/14'tür (%43). Dynamic `$` edit M09-T08'de; slot/cardinality UI ise sıradaki
M09-T07'dedir.

M09-T07 artık `DONE`'dır. Uyumluluk düzeltmesi, Layers'taki komşu named-slot sınırlarını çakışmasız
hale getirir ve her satırın üst/alt yarısını bitişik deterministik sınıra bağlar; böylece dar satır
aralığı tek bırakma yüzeyi olmaz. Components görünümündeki seçili owner/slot, cardinality ve sonraki
konumu gösteren hedef kalıcıdır. Başarılı ekleme yeni bileşeni otomatik seçerek mevcut güvenli Delete
eylemini görünür kılar. Click/klavye `Place` alternatifi korunur; browser `DataTransfer` yalnız inert
bir ipucudur, mutation otoritesi değildir.

Insert, farklı slota move, aynı slotta reorder ve seçili subtree delete işlemleri; güncel rota,
Source yerleşimi, Catalog capability kimliği, kabul kuralı ve effective minimum/maximum üzerinden
her seferinde yeniden yetkilendirilir. Aday yalnız public Editor Core komutuyla üretilir; complete
continuous validation ve Publisher preflight geçmeden `{document, preview}` atomik olarak değişmez.
Root/stale delete, source-slot minimum ihlali, cycle, geçersiz sınır veya reddedilen child kısmi
Source üretmez. Başarılı silme selection'ı temizleyip odağı Layers'a taşır; ret selection, preview
ve odağı korur.

Odak named-slot suite'i 70/70, tam App suite'i 151/151, bağımsız kök kanıt 9/9 ve tam structural CI
glob'u 329/329 geçer. Exact kanıt
24.830 baytlık
[`desen-app-0.1.0-named-slot-authoring.json`](../proof/artifacts/desen-app-0.1.0-named-slot-authoring.json)
artifact'ıdır ve
`sha256:daae817af45d8ead7052fd84df4edefd7d29cdd9ebe9cc1baea5b22b27dae90f` ile pinlenir. Yerel CI
186 workload/88 proof pair, 55 proof unit/120 workload closure ve 1.192 tracked/176 proof-owned
path içerir. Sequence 46, 69/69 geçer; 42 artifact ile 84 reader'ı
`sha256:f09ec643d1b2756174ca47fae99837a68f6656bec0c6933e566d5075713a0f5f` başında doğrular.

In-app browser incelemesi hedefsiz yönlendirmeyi, seçili-slot hedefini, click/klavye eklemeyi,
delete kontrolünü, root-delete açıklamasını ve temiz console'u doğrulamıştır. Native drag
otomasyonu gözlemlenmediği için gerçek-browser E2E iddiası açıkça yapılmaz. P-08 `NOT_PROVEN`,
PF-025 `OPEN` ve kanıt kapıları 10/13 kalır. Genel ilerleme 102/145 (%70), M09 ilerlemesi 7/14'tür
(%50); bu kapanış M09-T08'e devredilmiştir.

M09-T08 artık `DONE`'dır. State paneli doğrudan adreslenebilen surface-local primitive state
bildirimlerini deterministik biçimde listeler; string, boolean, number ve integer state için ekleme,
initial değer güncelleme ve kullanılmayan state'i silme sağlar. Sınırlı ve muhafazakâr kullanım
taraması referans sayısını gösterir, kullanılan state'in silinmesini engeller ve uygulama anında
güncel Source'u yeniden denetler. Desteklenmeyen veya preset dışı şema şekilleri tahmin edilmez;
görünür ama salt okunur kalır.

Inspector, uyumlu bir prop'u yalnız exact direct `state.<name>` referansına bağlayabilir, bu bağı
değiştirebilir veya declaration'ın doğrulanmış primitive initial değerine geri ayırabilir. Uyum
authenticated Catalog `propsSchema` üzerinden belirlenir. Operation/context/event/item/env/resource
referansları; fallback, token, format, nested ve diğer advanced dynamic binding şekilleri salt
okunur kalır. State schema ve initial alanları inert JSON'dur; `$` biçimli üyeler `ValueSpec`
otoritesi gibi yorumlanmaz.

Kabul edilen değişiklikler public Editor Core komutlarını, complete continuous validation'ı ve
Publisher preflight'ı geçmeden session-local `{document, preview}` değerini atomik olarak
değiştirmez. Odak `test:state-bindings` suite'i 109/109 geçer. Son structural receipt
`278/278`; exact kanıt
`28.766` baytlık
[`desen-app-0.1.0-state-binding-editor.json`](../proof/artifacts/desen-app-0.1.0-state-binding-editor.json)
artifact'ıdır ve `sha256:b7298375cba4b82258d1c293ecb66c3ae6641408ae9f5753da121ac44fcf601a` ile pinlenir.

Yerel CI otoritesi 188 workload ve 89 proof pair içerir: 78 ordinary pair ile 11 barrier. Connected
closure 56 proof unit/122 workload, ownership 1.202 tracked/178 proof-owned path'tir. Append-only
sequence 47, 43 artifact ve 86 reader'ı `sha256:c28ba9a9f274ac0bc3f7dc7ed6de51df35128b109b374b563f5c0239891f58f7` başında doğrular. Bunlar
required-gate, hosted-CI veya real-browser E2E iddiası değildir; T07 native drag E2E kanıtı da açık
kalır.

P-08 `NOT_PROVEN`, PF-025 `OPEN` ve kanıt kapıları 10/13 kalır. Genel ilerleme 103/145 (%71), M09
ilerlemesi 8/14'tür (%57). Event/action authoring, Design/Run, durable save/open, gerçek-browser E2E,
publication ve activation sonraki sahiplerde kalır; sıradaki iş M09-T09'dur.

M09-T09 artık `DONE`'dır. Dördüncü Events & Actions görünümü yalnızca seçili Source component'inin
doğrulanmış Catalog sözleşmesinde ilan edilen event'leri gösterir; behavior-owner UI iddiası yoktur
ve sahte behavior seçimi fail-closed kalır. Handler'ın absent, present-empty ve present-nonempty
hâlleri ayrıdır. Component event handler ekleme/silme ile complete action ekleme, değiştirme,
sıralama ve silme işlemleri canonical escaped owner-relative pointer'larla yapılır.

Kapalı action birliği `component.command`, `event.emit`, `navigate`, `operation.invoke`,
`resource.refresh`, `state.set` ve `state.toggle` üyelerinden oluşur. Yalnızca
`operation.invoke` success/failure listelerini recursive olarak taşır. Whole-action JSON taslağı
explicit Apply'e kadar inert ve panel-lokaldir; bu görünüm action çalıştırmaz. Her kabul edilen edit
public Editor Core geçişi, complete Source revalidation ve Publisher preview preflight sonrasında
tek bir session-local `{document, preview}` değişimiyle commit edilir. Edit ya da preflight reddi
önceki handler projection'ını, canvas'ı, selection overlay'i ve managed capability subtree'yi korur.

Pure projection 12/12, panel 7/7, focused `test:event-actions` 84/84, complete App 202/202,
independent root proof 10/10 ve complete structural CI 282/282 geçer. Exact artifact 23.812 byte'tır:
`docs/proof/artifacts/desen-app-0.1.0-event-action-editor.json`,
`sha256:0060ef39273ea36666f1701d5d3fa0f1610b95f40d88304ba980dcdc73cb29ab`.

Yerel CI authority 190 workload/90 proof pair (79 ordinary + 11 barrier), connected closure 57 proof
unit/124 workload ve ownership 1.212 tracked/180 proof-owned path'tir. Append-only sequence 48,
44 artifact ve 88 reader'ı
`sha256:5ecf9e630e2c91cb97a7c85c60e8318fdf694039711a64bf1797e481aca0ff90` başında doğrular;
checkpoint suite 71/71 geçer. Bunlar required-gate, hosted-CI, action-execution veya gerçek-browser
E2E sonucu değildir.

P-08 `NOT_PROVEN`, PF-025 ve PF-083 `OPEN`, kanıt kapıları 10/13 kalır. Genel ilerleme 104/145
(%72), M09 ilerlemesi 9/14'tür (%64). Design/Run, durable save/open, diagnostics navigation,
publication, activation ve gerçek-browser E2E sonraki sahiplerde kalır; sıradaki iş M09-T10'dur.

M09-T10 artık `DONE`'dır. Kontrollü sign-in yüzeyi tek bir App-owned Design/Run kontrolü kullanır;
iki mod da aynı immutable session-local `{document, preview}` çiftini, Source ve Bundle revision'ını,
Runtime session'ını ve managed Runtime React subtree'sini paylaşır. Mode, Runtime mount identity'ye
girmez; dolayısıyla geçiş remount/dispose üretmez ve Runtime local state'i korur. Source selection,
aktif authoring görünümü ve araması ile uygulanmamış Inspector taslakları da korunur; yalnızca geçici
drag intent temizlenir. Yeni bir surface route Design modunda başlar.

Design modunda gerçek adapter kontrolleri disabled kalır ve App-owned selection/authoring açıktır.
Run modunda authoring panelleri ile selection overlay gizlenir, elde tutulmuş yedi authoring callback
merkezî mode guard'ı tarafından reddedilir ve gerçek adapter etkileşimi açılır. Kanıtlanan yürütme
yolu yalnızca gerçek adapter event'i → Runtime React → Runtime Core → kapalı `state.set` action'ı →
aynı managed subtree'nin yeniden render edilmesidir. Navigation, operation ve resource port'ları
deny-only; storage/token sınırları missing, conflict veya inert kalır. Source ya da Bundle revision'ı
değişmez.

T10 kapanışı M09-T07 authoring UX sağlamlaştırmasını da korur: Components sürüklemesi güvenli root
varsayılan hedefi ve açık Layers hedef-değiştirme eylemini kullanır; Layers daha geniş bırakma
aralıkları gösterir ve drop anında koordinat yoksa son geçerli satır projeksiyonunu korur; seçili
layer görünür Delete eylemi ile editable kontroller dışında korumalı Delete/Backspace kısayollarını
sunur. Named-slot, cardinality ve continuous-validator authority değişmez. Bu, arbitrary canvas
geometry, hit-testing veya drop kanıtı değildir.

Adapter 9/9, application 35/35, focused `test:design-run` 44/44, complete App 210/210 ve independent
root proof 10/10 geçer. Exact artifact 17.900 byte'tır:
`docs/proof/artifacts/desen-app-0.1.0-design-run-modes.json`,
`sha256:bc5b7ffef0c39737882072f9340bcade86f084db8e7923fcb03aa7364d077334`. Yerel CI authority 192
workload/91 proof pair'dir (80 ordinary + 11 barrier); connected closure 58 proof unit/126 workload,
ownership 1.218 tracked/182 proof-owned path'tir. Append-only sequence 49, 45 artifact ve 90
reader'ı `sha256:45ed64e604400f18b15b3b4ef44bc35634a6c1567b46174329ec36529168272e`
başında doğrular. Checkpoint, promotion ve complete serial structural suite'ler sırasıyla 72/72,
19/19 ve 339/339 geçer.

Yerel browser'da mode geçişi ve Run etkileşimi ile otomatik varsayılan yerleştirme hedefi, görünür
Delete eylemi, editable-control Backspace guard'ı ve başarılı Delete kısayolu manuel olarak kontrol
edildi; bu, otomatik gerçek-browser veya native-drag E2E kanıtı değildir. P-09 yalnızca kontrollü
`state.set` yolu için `PARTIAL` olur; P-08 `NOT_PROVEN`, S-001 `PLANNED`, PF-025, PF-028 ve PF-083
`OPEN`, kanıt kapıları 10/13 kalır. Genel ilerleme 105/145 (%72), M09 ilerlemesi 10/14'tür (%71).
Fixture, scenario, görünür approximate-fidelity disclosure, durable save/open, diagnostics
navigation/placeholders, publication, activation ve otomatik gerçek-browser E2E sonraki sahiplerde
kalır; sıradaki iş M09-T11'dir.

M09-T11 artık `DONE`'dır. Catalog'da tanımlı scenario'lar, exact route/node/capability ile Source ve
preview revision authority'si yeniden doğrulandıktan sonra yalnızca ayrı, geçici bir Source ve
Publisher preview Bundle üzerinde props-only overlay olarak uygulanır. Authored değerler ile
`catalog:<scenarioId>` kimlikleri ayrıdır; asıl Source ve publish edilebilir preview değişmez.
Scenario state veya fixture override'ı desteklenmez ve kısmi uygulama yerine fail-closed davranır.

Run chrome yalnızca public testkit projection'ındaki exact synthetic success ve tanımlı
`invalidCredentials` sonuçlarını sunar. Gerçek adapter action'ı explicit settlement öncesinde
Runtime pending lifecycle'ı üretir. Request input ve password verisi okunmaz ya da tutulmaz;
Integration ve Production bağlamları görünür fakat unavailable'dır. Effect cleanup admission'ı ve
pending transport'u senkron olarak kapatır; StrictMode yalnızca aynı canlı controller'ı tekrar
aktive edebilir, preview değişimi ise önceki controller'ın geç sonucunu yayınlamasını engeller.

Kalıcı App-owned chrome fidelity'yi `same`, `equivalent`, `approximate` veya `undeclared` olarak
gösterir ve bilinen bütün approximate farkları listeler. Eksik/geçersiz metadata güvenli biçimde
`undeclared` olur; controlled sign-in yüzeyi daha önce doğrulanmış production adapter'ını raporlar.
Uyumluluk düzeltmesi ayrıca Components için gerçek bir drag handle ve panel-wide insert hedefi,
Layers için nested slot'lar arasında tek global projection ve midpoint hysteresis, yeni eklenen
bileşen için de hemen görünür korumalı Delete eylemi sağlar. Native transfer bytes veya managed
geometry mutation authority değildir.

Focused altı dosyalı suite 86/86, complete 19 dosyalı App suite 252/252 ve independent root proof
11/11 geçer. Exact artifact 29.407 byte'tır:
`docs/proof/artifacts/desen-app-0.1.0-fixtures-scenarios-fidelity.json`,
`sha256:3f08980e687d48ba267f78c7d4dd1ae1eb59db5cc6bb3401d88705ee0416cc9d`. Bunlar yerel task
receipt'leridir; required-gate, hosted-CI, durable persistence, diagnostics, publication/activation
veya otomatik gerçek-browser/native-drag E2E sonucu değildir.

Yerel CI authority 194 workload/92 proof pair'dir (81 ordinary + 11 barrier); connected closure 59
proof unit/128 workload ve ownership 1.232 tracked/184 proof-owned path'tir. Bu inventory
receipt'leri hosted-CI sonucu değildir.

Append-only proof-reader sequence 50,
`sha256:45ed64e604400f18b15b3b4ef44bc35634a6c1567b46174329ec36529168272e` predecessor'ından
`sha256:6abea41064a05efe363df0f66d1e7d1b4923af08f819acf4c266b092985192a4` başına 46 artifact ve
92 reader ile ilerler. Checkpoint, promotion, selector + required-affected, ownership ve kalan
touched-CI regression suite'leri yerelde sırasıyla 73/73, 19/19, 56/56, 15/15 ve 127/127 geçer.

N-035 ve S-001 `TESTED`, PF-028 `CLOSED` olur. P-08 `NOT_PROVEN`, P-09/P-10 `PARTIAL`, N-036
`PLANNED`, PF-025/PF-083/PF-089 `OPEN` kalır; kanıt kapıları 10/13'tür. Genel ilerleme 106/145
(%73), M09 ilerlemesi 11/14'tür (%79). Sıradaki iş, public editor persistence port'u üzerinden
save/open UI ekleyen M09-T12'dir.

M09-T12 artık `DONE`'dır. Desen App, yalnızca trusted host'un enjekte ettiği public Editor Core
`DesenEditorPersistencePort` üzerinden Design-mode Open/Save sunar. Exact `account-app/sign-in`
route'u, `Source.id`'den bağımsız tek `account-app-source` anahtarını seçer. App concrete Editor Web,
control-plane, browser/native storage ya da filesystem adapter'ı sahiplenmez.

Open sonucu, complete stored Source, exact document identity, Catalog projection, surface ve
publishable preview birlikte kabul edilmeden authored session'ı değiştiremez. Missing, failed,
rejected, wrong-document, edit sırasında eskiyen, dispose edilen veya stale-lifetime sonuçları
mevcut taslağı korur. Save yalnızca controller'ın immutable authored Source snapshot'ını exact
expected generation ile gönderir. Create/update/unchanged ayrıdır; conflict, generation exhaustion
ve indeterminate commit açık bir reopen gerektirir, otomatik retry veya merge yoktur. Dirty kararı
object identity veya document version'dan değil, admit edilmiş complete authored Source'un canonical
content'inden çıkar. Same-value replacement ve saved canonical content'e dönüş clean'dir;
başarılı Open/Save baseline kurar, settlement current canonical content'i dispatched save snapshot
ile karşılaştırır ve `reopenRequired` admission'a kadar güvenlik kilidi olarak kalır.

Await edilen Open/Save settlement'ları accessor çalıştırmadan yalnızca exact own enumerable data
descriptor'larından capture edilir. Geçerli optional diagnostic pointer/context/subject alanları
fresh frozen veriye kopyalanır ve her CAS sonucu dispatched expected-generation ilişkisini
sağlamalıdır. Malformed Open taslağı koruyan retryable controlled failure, malformed Save ise
indeterminate/reopen-required olur. Settlement reflection ve opened-document admission sonrasında
token yeniden kontrol edildiği için reentrant edit/dispose stale state yayımlayamaz.

Dirty Open için iptal edilebilir açık inline onay gerekir. Tek merkezi authored-session commit yolu,
surface-owned canonical baseline/current ref'lerini ve rerender-safe no-port dirty projection'ını
günceller. Güncel surface/controller guard, pristine no-port navigation'ı kabul eder. Exact clean
etiketi `Local draft unchanged`'dır. Edited no-port ve port-backed dirty taslaklar App
navigation/browser traversal boyunca admission gerektirir. Owner-safe cleanup daha yeni surface'i kaldıramaz ve
`beforeunload` dirty page exit'i korur. Generation, dirty, pending, definite failure,
conflict/uncertainty, exhaustion ve reopen-required durumları yalnızca renge bağlı olmadan
görünürdür. Scenario preview, fixture lifecycle, Runtime input ve secret verileri persistence
isteğine girmez.

Güncel authoring UX'te uyumlu her Components kartı ayrı noktalı bir native-drag tutamacı ve `Add`
düğmesi sunar. Drop, sticky `Add to` kartının özetlediği hedef için authenticated Components
panelinin tamamında kabul edilir. Layers hareketi yalnızca ayrı noktalı tutamacından başlatır, en
içteki nested-slot owner'ını ve drag epoch'unu fence eder; midpoint hysteresis uygular, kompakt
insertion aralıklarını layout-stable tutarken her görünür satırı before/after yarısına projekte eder,
accepted/current-position feedback'i gösterir ve koordinatsız ya da rejected release drift'inde son
kabul edilen placement'ı korur. Başarılı insert Layers'a geçer, yeni node'a odaklanır ve güvenli
`Remove layer` eylemiyle Delete/Backspace kısayollarını hemen erişilebilir kılar.

Focused beş dosyalı persistence suite 142/142, complete yirmi iki dosyalı App suite 324/324 ve
independent root mutation proof 12/12 geçer. Exact artifact 27.053 byte'tır:
`docs/proof/artifacts/desen-app-0.1.0-source-persistence.json`,
`sha256:717d0ddada008edb34909d5defcc4c28e95b36f6dfc0b1abb4d09d9775a6b734`. Üç exact parent'ı
doğrular, 35 current dosyayı bağlar ve historical App reader'larını takip etmez.

Yerel CI inventory 196 workload/93 proof pair'dir (82 ordinary + 11 barrier); connected closure 60
proof unit/130 workload ve ownership 1.243 tracked/186 proof-owned path'tir. Bunlar local
receipt'lerdir; required-gate veya hosted-CI sonucu değildir.

Append-only proof-reader sequence 51, sequence-50'nin exact
`sha256:6abea41064a05efe363df0f66d1e7d1b4923af08f819acf4c266b092985192a4` başından
`sha256:42e88946b598566a46237af8d30587fa765d9d58807e864464fc5525fbc64921` başına 47 frozen
artifact ve 94 current reader ile ilerler. Checkpoint, promotion, selector + required-affected,
ownership ve remaining touched-CI suite'leri sırasıyla 74/74, 19/19, 58/58 (21 + 37), 15/15 ve
128/128; birlikte 294/294 geçer.

`N-012`, `N-018` ve `S-003`, App-consumption evidence ile `TESTED` kalır. P-08 `NOT_PROVEN`,
P-09/P-10 `PARTIAL`, PF-085/PF-089 `OPEN` kalır; kanıt kapıları 10/13'tür. Genel ilerleme 107/145
(%74), M09 ilerlemesi 12/14'tür (%86). Diagnostics navigation/invalid placeholders,
publication/activation, concrete App storage adapter ve otomatik gerçek-browser E2E kanıtlanmış
değildir. Sıradaki iş M09-T13'tür.

M09-T13, reddedilen bir edit adayından yalnızca exact frozen continuous-validation report'unu App
transient state'inde tutar. Geçersiz aday authored Source, publishable preview, managed Runtime,
dirty state, Save request veya persistence generation içine hiç girmez. Candidate document ve
Catalog-set fingerprint'leri, exact project/surface route'u, hâlâ güncel committed-document owner'ı
ve canvas tarafındaki live Runtime React diagnostic index bütün projection'ları fence eder; stale
ya da tutarsız otorite partial navigation modeli üretmeden kapanır.

Seçilebilir hedefi yalnızca `invalidSubjects` içindeki explicit `context.surfaceId` +
`subject.kind` + `subject.id` eşlemesi oluşturur. Diagnostic pointer/code/message/capability ve
context içindeki rastlantısal metinler identity tahmini değildir. Original diagnostic sırası,
duplicate occurrence pointer'ları, node/behavior ayrımı, unmapped ve başka route'a ait diagnostics
korunur; dynamic obligations görünür ama inert metadata'dır ve yürütülmez. Seçim yalnızca opaque
snapshot-bound key tutar ve güncel ready projection'dan yeniden admit edilir.

Compact App-owned Inspector bölümü mapped occurrence'ları native button olarak sunar, sayıyı canlı
duyurur, seçimi `aria-current` ile belirtir ve autofocus yapmadan açık dismiss sunar. Seçilen
occurrence, mevcut geçerli preview'ı koruyarak managed Runtime subtree dışında App-owned invalid-
change placeholder gösterir. Diagnostics ve placeholder etkileşimi yalnızca Design mode'dadır;
Run bunları gizleyip inert yapar, Design'a dönüş focus çalmaz ve başarılı edit ya da session
replacement reddedilen report'u temizler.

Dokuz dosyalık odaklı diagnostics suite 161/161, 24 dosyalık tam App suite 339/339 ve bağımsız root
mutation proof 12/12 geçer. Exact kanıt, 39 güncel dosyayı ve on bir exact proof parent'ını bağlayan
27.353-byte `docs/proof/artifacts/desen-app-0.1.0-node-linked-diagnostics.json` dosyasıdır;
`sha256:8ac4d81d9097e188860757c637673ff406ba9f82b8cd8f379f184ef85138e972`. Yerel CI otoritesi
198 workload ve 94 proof pair'dir: 83 ordinary + 11 barrier. Connected T13 closure 62 proof unit /
134 workload, ownership ise 1.253 tracked path / 188 proof-owned path'tir. M09-T13 `DONE`, P-16
`PROVEN`, PF-086 `OPEN`, proof gate sayısı 10/13, genel ilerleme 108/145 (%74), M09 13/14 (%93)
ve sıradaki iş M09-T14'tür. Bu yerel receipt'ler required-gate veya hosted-CI sonucu değildir.

M09-T14 ve G09 artık `DONE`'dır. Publish yalnızca güncel authored Source, son başarılı kayıt
generation'ındaki Source ile canonical olarak birebir aynı ve clean olduğunda açılır. App bu exact
Source'tan public Publisher'ı yeniden çalıştırır, taze Bundle revision'ının güncel publishable
preview revision'ıyla eşit olmasını ister ve trusted-host port'una yalnızca canonical Bundle
byte'ları ile revision'ı geçirir. Scenario projection'ı, synthetic fixture, Runtime operation
input'u, secret ve reddedilmiş candidate diagnostics publication snapshot/request alanı değildir.

Public Editor Web adapter exact revision altındaki immutable Bundle'ı saklar ve yalnızca sabit
`preview` channel'ını compare-and-set ile ilerletir. Channel discovery ile activation authority
ayrıdır: Active ancak aynı revision'ı ve durable activation generation'ını taşıyan ayrı,
server-owned reference-host receipt'inden sonra görünür. Conflict activation başlatmaz; failed,
mismatched, stale veya indeterminate sonuçlar current success olmaz ve last-known-good revision'ı
korur. Synchronous external-store teslimi görünür aşamayı güncel tutar; aynı tick içindeki host-port
değişimi ise geç channel/activation sonucunun yeni UI'a ulaşmasından önce predecessor lifetime'ı
iptal eder. Browser App production graph'ı Node control-plane composition veya reference-host
server import etmez.

Kullanıcının istediği authoring uyumluluk düzeltmesi, layout'u kaydırmadan ayrı Layers ve
Components tutamaçlarını sırasıyla `28 × 32 px` ve `32 × 32 px` boyutlarına büyütür. Stable,
çakışmayan ve tam genişlikteki `20 px` Layers aralıkları boundary event'lerini doğrudan sahiplenir;
row-half fallback ve en içteki slot fencing'i korunur. Sticky Components `Drop target` drop'u
doğrudan sahiplenir, authenticated panel ise aynı hedef için fallback kalır. `Add` yeni node'u
hemen seçer; mevcut görünür ve guarded `Remove layer` ile Delete/Backspace yolları kullanılabilir
kalır.

Dört dosyalık focused App publication suite 31/31 geçer; bunun içinde gerçek public control-plane →
fixed channel → reference-host entegrasyonu 2/2'dir. Editor Web publication 10/10, emitted public
package runtime yüzeyi 4/4 ve independent root mutation proof 12/12 geçer. Exact artifact dokuz
parent, 33 current tracked receipt ve 45 focused declaration bağlayan 24.763-byte
`docs/proof/artifacts/desen-app-0.1.0-publish-activation.json` dosyasıdır;
`sha256:6bd2db0ca490f1d0046f145da7c4b7e9b4b25ec0f8295a159529a0e66534b23b`. Yerel exhaustive
authority 200 workload ve 95 proof pair'dir: 84 ordinary + 11 barrier. T14 connected closure 63
proof unit / 136 workload, ownership ise 1.267 tracked path / 190 proof-owned path'tir. Tarihsel
append-only sequence 53, exact sequence-52 başı
`sha256:c42b0c0fe010b04128a31f26b25a5875e72b7566fa64403d0223b4dbada478a9` değerini 49 artifact ve
98 current reader ile
`sha256:48a1457317c593b846cd4750eb309e846c33248824559d27810441584f0144d8` değerine ilerletir.
Compatibility sequence 54 değişmez predecessor'dır: bu 49 frozen artifact ve 98 reader kimliğini
korur, exact sequence-53 başını
`sha256:0772221371ffe1a35fe955b8cad34c725d0f9ae933714f81f10b3451214a6638` değerine ilerletir ve
yalnızca M08-T08 proof-library/root-test reader'larını `[64, 65]` yeniden mühürler. Frozen
49.785-byte M08-T08 artifact'ı
`sha256:51932d4165afff3c40fae6769527e480f6d0ff355f3fbc6d8ae7c6809e50a6fe` olarak değişmeden
kalır. Current sequence 55 aynı 49 frozen artifact ve 98 reader kimliğini korur, bu exact
sequence-54 predecessor başını
`sha256:f1ac24425ca2372410835a6c5721057763792010aaf77ccc78b8d30636333a17` değerine ilerletir ve
yalnızca M09-T01–T14 proof-library/root-test reader indexlerini `[70..97]` yeniden mühürler. Current
T14 reader'ları exact `10.000 ms` per-test timeout successor'ını full live
`sha256:5eba8a2b15cbcf992d0f04d0d7ad719c1a9fc42cdb66635ebc0eab679a221901` hash'iyle doğrular;
bu tek değişikliğin ters projeksiyonu frozen 24.485-byte test receipt'ini üretirken frozen T14
artifact'ı `sha256:6bd2db0ca490f1d0046f145da7c4b7e9b4b25ec0f8295a159529a0e66534b23b` olarak değişmeden
kalır. Checkpoint 78/78, promotion 20/20, selector 23/23 ve on dört M09 root reader suite'i 179/179
geçer. Promotion selector'ı
`sha256:2855cbeedb55ede5d9db18a6b186ac07796afbc4d512f5a0aa9197bc5f177fd1`, required-affected
runner'ı `sha256:b77b35a81915ec41554ab3505895fe98c0a4299ec9bf7d680dec320bbf3fb744` ve T10 affected plan'i
`sha256:e3cced8e1a9cbe6f1f5c296aa3992b07ef030c81ac9267c2deff714953ce0e39` olarak pinler.
Integrated CI policy regression 330/330 geçer. Bunlar yerel receipt'lerdir; required-gate veya
hosted-CI sonucu değildir.

Genel ilerleme 109/145 (%75), M09 14/14 ve proof gate sayısı 11/13'tür. P-07/P-09/P-10 `PARTIAL`,
P-08 `NOT_PROVEN`, P-12 M10-T07'ye kadar `NOT_PROVEN`, N-036 `PLANNED` ve
PF-085/PF-086/PF-089 `OPEN` kalır. Otomatik gerçek-browser E2E ve native drag bu uyumluluk
kanıtıyla kanıtlanmamıştır; sıradaki iş M10-T01'dir.

M10-T01A `DONE` durumundadır. Normal Desen App artık sıfır projeyle açılır; görünür **New project**
akışındaki tek desteklenen boş sign-in profili gerçek yerel control-plane üzerinden Generation 1
olarak kaydedilir ve normal editörde açılır. Kullanıcı görünür arayüzden bileşen, layer, state,
binding ve action düzenleyebilir; Generation 2 kaydı, tam sayfa yenileme ve Projects kartından
yeniden açma gerçek Chromium senaryosunda doğrulanmıştır. Yerel Source verisi Vite'ın servis ettiği
kökün dışındadır; çakışma, belirsiz veya devam eden kayıt ve bozuk storage durumları fixture'a
düşmeden güvenli kapanır.

Değişmez görev eseri 20.173 bayt ve 43 kesin dosya kaydıdır;
`sha256:6277b82f22bf26e92b670164f2f1e2b7f861409f5b37585fb5053d88c4dadd2e` ile sabittir. Okuyucu
checkpoint sıra 62, önceki 61 checkpoint'i değiştirmeden 52 eser ve 104 okuyucuyu
`sha256:15ede557b4167cb7bc0cce89b02cf0e9d9f0f7e92c4c5fdc2d799cb3bcf0be55` başında doğrular; yalnız
M10-T01-COMPAT kök okuyucusunun runner'a ait geçici alan izolasyonu yeniden mühürlenmiştir.
Mimari sınır grafiğinde 818 modül / 3.373 bağımlılık ihlalsizdir ve 23 fixture'ın tamamı geçer.
Genel ilerleme 111/146 (%76), M10 2/10'dur; sıradaki görev M10-T02'dir ve henüz
`NOT_STARTED` durumundadır. Yazılı girdi/pending, invalid credentials, başarı/navigasyon, uzak ve
çok kullanıcılı deployment ile G10 kapanışı bu ara görevin kapsamı değildir.

M10-T01B `DONE` durumundadır. TextField için **Input connection** artık `Value` state binding'i ile
`change → state.set(event.value)` aksiyonunu tek doğrulanan işlemde kurar; başka state'e yeniden
bağlama eski kesin yazımı değiştirir ve yarım bağlantı “Connected” diye gösterilmez. Yeni ve mevcut
yedi aksiyon türü görsel alanlarla düzenlenebilir, ileri kullanıcılar için Advanced JSON korunur.
Katman görünürlüğü local state veya yüzeyde gerçekten yazılmış operation result status'una
bağlanabilir. Run paneli sign-in'e özel seçenek üretmez; kesin Source operation alias'larını ve
doğrulanmış Catalog fixture'larını genel operation kartlarına dönüştürür.

Gerçek Chromium akışı iki TextField'a tam metin girildiğini, Button operation eşlemesini, gerçek
pending Promise'i ve explicit Catalog hata settlement'ından sonra koşullu Alert'i görünür
arayüzden doğrular. Bu bir authoring-usability önkoşuludur; M10-T02'nin özel input/pending matrisi,
M10-T03'ün failure matrisi ve M10-T04'ün gerçek host success/navigation kanıtı kapanmış sayılmaz.
Bu checkpoint'te genel ilerleme 112/147 (%76), M10 3/11'dir; ardından evergreen kompozisyon
boşluğunu kapatmak için M10-T01C ara görevi eklenmiştir.

M10-T01C `DONE` durumundadır. Desen App'in güvenilen ürün kökü artık fabrika tarafından
doğrulanmış bir `ProjectWorkspaceProfile` seçmek zorundadır. Bu profil proje envanterini, birbirinden
ayrı App route slug'ı ile Source surface id'sini, kesin belge/storage kimliğini, Catalog seti ve
paketlerini, runtime adapter/token/port yetkisini ve varsa publication channel/host bağını birlikte
taşır. Normal ürün kökü referans sign-in profilini açıkça seçer; genel editör, preview, fixture,
scenario, persistence, publication, runtime-canvas ve product-bootstrap yollarında account/sign-in
varsayımı kalmaz.

Odaklı kanıt, route slug'ları Source id'lerinden farklı olan, iki surface ve iki Catalog içeren
auth-dışı feedback profilini kabul eder; feedback yüzeyini de normal App, authoring model, gerçek
adapter canvas ve layer ağacı üzerinden açar. Sahte profil, route/Source kayması, eksik Catalog
paketi, sahte adapter registry, başka profile ait persistence route'u ve uyuşmayan publication host
bağı downstream yetki verilmeden reddedilir. Kanıt eseri
`docs/proof/artifacts/desen-app-0.1.0-evergreen-product-composition.json`, doğrulayıcısı
`scripts/verify-desen-app-evergreen-product-composition.mjs` yolundadır. Bu ara görev M10-T02'nin
input/pending, M10-T03'ün failure veya M10-T04'ün gerçek host success/navigation kanıtını kapatmaz.
Genel ilerleme 113/148 (%76), M10 4/12'dir; M10-T02 `NOT_STARTED` ve sıradaki görevdir.

M10-T02 `DONE` durumundadır. Normal ürün arayüzünde boş projeden başlayarak iki kontrollü
TextField'ın tam değeri local state'e bağlanır ve Button, JSON yazmadan Catalog'da tanımlı bir
operation'a eşlenir. Tek doğrulanan tarif; uyumlu input eşlemelerini, çakışmayan result alias'ını,
seçilen concurrency davranışını ve `operation.<alias>.pending` Loading bağını birlikte yazar. State
yalnızca input adıyla birebir eşleştiğinde otomatik önerilir; sadece şema uyumu tasarımcı adına
eşleme tahmin etmek için kullanılmaz.
Mevcut operation onarılırken ilgisiz aksiyonlar, success/failure dalları, guard ve extension'lar
korunur; boş optional input boş kalır, görsel alanın temsil edemediği gelişmiş değer ise veri
kaybına yol açmadan Repair'i durdurur.

Gerçek Chromium senaryosu görünür **Set Secure** kontrolünü kullanır, seçimin etkin ve çıktıdaki
şifre input'unun native `type=password` olduğunu doğrular, iki değeri de parça parça yazar ve
çözülmemiş gerçek Runtime Promise'ini pending olarak gözlemler. Button erişilebilir busy/disabled
durumuna geçer, tekrar aktivasyon engellenir ve değerler ile pending Design → Run geçişinde
korunur. Explicit fixture completion iki animation frame boyunca terminal kalır ve yalnızca genel
temizliği kanıtlar: Loading kalkar, fakat Alert veya navigasyon iddiası yapılmaz. Odaklı testler
82/82, Chromium 1/1 ve bağımsız kök okuyucu 10/10 geçer. 25 kesin kayıt taşıyan 14.261 baytlık kanıt
`sha256:161202698b013775cbc89625ecea1f6894e9abcd927fb2eb660dff71652ba43d`, 2.307.407 baytlık
sınırlı tarihsel köprü ise
`sha256:16f6ec332fb03368e617563560b9930a7608594907ce61d5d15554be4dc7523d` ile sabittir.
Eklemeli checkpoint sequence 67, sequence 1–66'yı korur ve 55 artifact / 110 reader zincirini
`sha256:9ee6909c0f11ed7149cb9bf6ce1c7943ed99aac2d2c6f9138caea8f5dd2044b7` ile kapatır; 90/90
kontrol geçer.

P-09 ve P-10 `PARTIAL` kalır. Görünür hata M10-T03'ün; başarı, navigasyon ve ayrı yetkilendirilmiş
gerçek host operation M10-T04'ün kapsamıdır. Integration, Production, N-036 ve G10 hâlâ açıktır.
Genel ilerleme 114/148 (%77), M10 5/12 (%42) olur; sıradaki görev M10-T03'tür. Yerel kanıtlar bu
head için hosted `Quality gate` başarısı anlamına gelmez.

M10-T03 `DONE` durumundadır. Güncel doğrulanmış profilin görünür boş-proje akışı içinden, JSON
yazmadan ve doğrudan DOM ya da network değişikliği kullanmadan kontrollü e-posta/şifre state'i,
Catalog operation'ı ve `operation.signIn.status == "failed"` koşulunu izleyen kritik Alert yazılır.
Gerçek Chromium yolculuğunda Alert idle ve çözülmemiş Runtime pending durumlarında görünmez; exact
Catalog `invalidCredentials` fixture'ı tamamlandığında public failure olarak görünür. Retry yeni bir
gerçek invocation başlatır, pending sırasında önceki Alert'i gizleyip Loading'i geri getirir ve ikinci
tanımlı settlement sonrasında Alert'i yeniden gösterir.

Bu akış route'u, iki tam kontrollü değeri, accessible Loading temizliğini, `420 × 720` frame'i ve
yatay document geometry'sini idle, pending, failure ve retry boyunca korur. Deterministik okuyucu
139 odaklı `it`/`it.each` declaration site'ını bağlar; gerçek odaklı Vitest yürütümü 144/144 (App
52, reference components 11, Runtime 81), Chromium 1/1 ve bağımsız kök okuyucu 10/10 geçer. 34
kesin kayıt taşıyan 16.868 baytlık artifact
`sha256:bde909f8dbc4837c70627bab454d3dc5a936bd0abb6d70ec22b9cffbdb0e6a20`, 2.491.742 baytlık
sınırlı T02 tarihsel köprüsü ise
`sha256:a3ef969f87441e2d8079dc7cd27db3a759acbb645441d206c3b35adc3149ec10` ile sabittir.

Nötr CI envanteri 214 workload / 102 proof unit, M10-T03 closure'ı 70 proof unit / 150 workload ve
exact-one ownership 1.377 tracked path / 204 proof-owned path içerir. Checkpoint sequence 68,
sequence 1–67'yi koruyup 56 artifact / 112 reader zincirini
`sha256:e685779412ca17b76c78a56ff545bbff5a7fc5efc8bc564247cc49e7c54eeca8` ile kapatır; suite
91/91 geçer.

M10-T03 yalnız görünür failure matrisini kapatır. P-09 ve P-10 `PARTIAL` kalır; success, navigation
ve ayrı yetkilendirilmiş gerçek host operation M10-T04'ün kapsamıdır. Integration, Production,
N-036 ve G10 hâlâ açıktır. Genel ilerleme 115/148 (%78), M10 6/12 (%50) olur; sıradaki görev
M10-T04'tür. Yerel kanıtlar bu head için hosted `Quality gate` başarısı anlamına gelmez.

M10-T04'ün yerel kanıtı geçti. Normal uygulamada **Workspace → Flow app → New project** yoluyla
iki boş sayfalı bağımsız bir çalışma alanı açılır; mevcut Account app tasarımları değiştirilmez.
Tasarımcı iki sayfayı, kontrollü alanları, operation bağlantısını, koşullu Alert'i ve **Success →
Navigate → Result** eylemini görünür kontrollerden, JSON yazmadan kurabilir.

Gerçek Chromium testi önce Synthetic başarı fixture'ının hiç host isteği yapmadan tasarlanan hedef
sayfayı açtığını doğrular. Açıkça seçilen Integration, ayrı yetkilendirilmiş gerçek yerel HTTP
servisini çağırır: 401 durumunda kaynak sayfa ve tasarlanan hata görünür kalır; 200 durumunda
Catalog fixture'ından farklı `local-host-user` sonucu gelir ve aynı Publisher/Runtime adaptörleri
hedef sayfayı açar. Bu servis **yerel test hesabıdır; production kimlik doğrulaması değildir**.

Run sırasında girilen değerler, cevaplar ve navigasyon Source'a kaydedilmez; kayıt baytları, nesil,
giriş sayfası ve editör adresi değişmez. Restart run başlangıca döner; Design bağlantı yetkisini
kapatır; yenileme kayıtlı boş input state'ini geri getirir. Genel editör sign-in'e özel endpoint veya
sonuç varsaymaz; farklı operation türleri ve fixture'sız bağlantılar da odaklı testlerden geçer.

Tam App paketi 611/611, beş Chromium yolculuğunun tamamı, odaklı T04 kapsamı 177/177 ve bağımsız kök
okuyucu 10/10 geçer. 51 kesin kayıt içeren 22.456 baytlık artifact
`sha256:d9d841af06ec9efc51c3f1c74079f0aa4d5e1c7e996f3b97df7e277e4b1f8423` ile sabittir.
Ayrıntılar: [T04 kanıtı](../proof/DESEN-APP-SUCCESS-HOST-OPERATION.md) ve
[ADR 0017](../adr/0017-desen-app-explicit-integration-and-run-navigation.md).

P-09/P-10 `PROVEN` olur; genel ilerleme 116/148 (%78), M10 7/12 (%58), sıradaki görev M10-T05'tir.
T05 henüz başlamadı. Publish/activation, recovery, Production, N-036 ve G10 açık kalır. T04'ün
`DONE` kaydı, yalnız bu PR'ın kesin güncel head'i hosted `Quality gate` geçince kesinleşir; yerel
kanıt tek başına merge veya tamamlandı beyanı değildir.

M10-T05'in yerel kanıtı geçti. Tasarımcı normal uygulamada boş Account projesi oluşturur; görünür
Inspector kontrolleriyle Text etiketi ve Stack aralığını düzenler; iki ayrı Save → Publish →
Activate döngüsü tamamlar. Ayrı derlenen referans host önce A revizyonunu gösterir. Etiket ve aralık
değiştirildikten sonra aynı host yenilemeyle B'yi, ikinci yenilemeyle yine B'yi gösterir. Host'un
HTML, JavaScript, CSS ve kaynak kimlikleri bu sırada değişmez. Source; kanal, host, adres, anahtar,
aktivasyon callback'i, sunucu uygulaması veya çalıştırılabilir modül seçemez.

Görev doğrulayıcısı geçer; bağımsız kök okuyucu 10/10, odaklı test grupları 74/74, 18/18, 35/35 ve
31/31, özel Chromium yolculuğu 1/1 başarılıdır. Taze Vite gözlemleri App tarafında 168 modül / 510
statik bağlantı, host tarafında 104 modül / 299 statik bağlantı içerir; dinamik veya çözülemeyen
bağlantı yoktur ve iki grafikte 22 yönetilen modül bayt düzeyinde aynıdır. Mimari sınırlar 861 modül /
3.685 bağlantı üzerinde geçer.

116 kesin kayıt içeren 189.123 baytlık artifact
`docs/proof/artifacts/desen-app-0.1.0-published-host-update.json`,
`sha256:80c0b815a813ef462233b48a7fffe7c4d0bbf391aefc68eb9a6174da6bd84bd3` ile sabittir. Ayrıntılar
[T05 kanıtında](../proof/DESEN-APP-PUBLISHED-HOST-UPDATE.md) ve
[ADR 0020'de](../adr/0020-desen-app-fixed-destination-publication-and-host-activation.md) kayıtlıdır.
Eklemeli checkpoint sequence 72, sequence 1–71'i korur ve 59 artifact / 118 reader zincirini
`sha256:2db218584d8ef0497f1da57a6e001e73e85b35c3c7eb02b48e049348d429d249` ile doğrular.
P-07 `PROVEN`, PF-059 `CLOSED` olur; genel ilerleme 117/148 (%79), M10 8/12 (%67), kanıt kapıları
11/13'tür. M10-T06 sıradadır. Hatalı yayın, son çalışan sürümü koruma, production kimliği, uzak veya
çok kullanıcılı dağıtım, native hedefler, P-12, N-036 ve G10 açık kalır. T05'in `DONE` kaydı tam son
PR head'inde taze hosted `Quality gate` ve `Browser E2E` geçene kadar koşullu kapanış adayıdır.

Pazar ve ürün varsayımlarının unutulmaması için
[`STRATEGIC-VALIDATION.md`](STRATEGIC-VALIDATION.md) içindeki iki sayılmayan kontrol noktası da
uygulanır: `G03` sonrasında A2UI/DTCG karşılaştırması, `G10` sonrasında ise en az 10 gerçek ekip
görüşmesi ve iki pilot hedefi. Bunlar 148 görevlik ilerleme sayacını değiştirmez.

## Büyük aşamalar

| Aşama | Anlamı                         | Sonunda göreceğimiz şey                                      |
| ----- | ------------------------------ | ------------------------------------------------------------ |
| M00   | Protokolü ve kanıtları kilitle | Neyi uyguladığımız tartışmasız olur                          |
| M01   | Profesyonel proje temeli       | Tek komutla kontrol edilen temiz kod tabanı                  |
| M02   | Şema ve validator              | Hatalı DESEN belgelerini yakalayan TypeScript çekirdeği      |
| M03   | Capability sistemi             | Gerçek bileşenleri DESEN'e tanıtabilme                       |
| M04   | Headless runtime               | React olmadan protokol davranışlarını çalıştırma             |
| M05   | React runtime ve ayrı host     | Bundle'ın gerçek React uygulamasında çalışması               |
| M06   | Publisher                      | Source belgesini güvenli bundle'a çevirme                    |
| M07   | Güvenli aktivasyon             | Hatalı sürümde eski çalışan yüzeyi koruma                    |
| M08   | Editor core                    | Arayüzden bağımsız tasarım düzenleme komutları               |
| M09   | Desen App Web                  | Görsel düzenleme ve yayınlama ürünü                          |
| M10   | İlk tam kanıt                  | Sign-in akışının baştan sona kanıtlanması                    |
| M11   | Ayrıştırıcı kanıt              | Map ve Sortable'ın core değişmeden eklenmesi                 |
| M12   | Public alpha hazırlığı         | Tekrar edilebilir rapor, entegrasyon rehberi ve yayın kapısı |

## En önemli sıra

Desen App'in görsel ekranlarını hemen yapmayacağız. Önce sırasıyla:

```text
Validator → Capability sistemi → Runtime core → React host → Publisher → Desen App
```

Bu sayede güzel görünen fakat protokolü gerçekten çalıştırmayan bir demo üretmeyiz.

## Mobil konusunda bugünkü karar

İlk hedef yalnızca `web-react`. iOS ve Android şimdi yapılmayacak. Ancak React, DOM, CSS ve
tarayıcı kodu `runtime-core` içine giremeyecek. Gelecekte SwiftUI veya Compose runtime yazıldığında
aynı protokol davranış testlerini kullanabilmesi hedeflenecek.

Bu, aynı tasarımın bütün platformlarda piksel piksel aynı olacağı sözü değildir. Platformlar kendi
capability catalog'larına sahip olacaktır.

## Bir görev ne zaman bitmiş sayılır?

- İstenen davranış çalışıyor.
- Olumlu ve gerekli olumsuz testler var.
- Format, lint, typecheck, test ve mimari sınır kontrolleri geçiyor.
- Dışarı açılan kodlar TSDoc ile belgelenmiş.
- Paket README'si güncellenmiş.
- İlgili kanıt satırına test veya artifact bağlanmış.
- Donmuş protokol değiştirilmemiş; belirsizlik varsa Findings dosyasına yazılmış.

## Şimdilik yapılmayacaklar

iOS/Android runtime, multiplayer, plugin mağazası, Figma benzeri çizim motoru, gerçek auth
backend'i, AI ile production capability kodu, A/B testleri, code-to-design round trip ve genel
amaçlı web sitesi oluşturucu bu kanıtın kapsamında değildir.
