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
5. Bütün kontroller geçmeden görev `DONE` yapılmamalı.
6. Sonraki göreve ancak mevcut görev tamamlandıktan sonra geçilmeli.

Aynı anda yalnızca bir görev `IN_PROGRESS` olabilir. Bu kural, vibe coding sırasında kapsamın
kontrolden çıkmasını engeller.

`I07-01` ve `I07-02` tamamlandı; aktif bir altyapı görevi yoktur. I07-02 geçiş anındaki 130 iş ve
61 kanıt çiftini değişmez tarihsel temel olarak saklar. M07-T09 checkpoint'i 146 iş ve 69 kanıt
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

M08-T01 de tamamlandı. `@desen/editor-core`, bilinmeyen inert JSON'u donmuş Source ve gömülü
şema yapısal doğrulayıcısından geçirir; başarıda sarmalayıcı, gizli AST veya düğüm dizini
eklemeden doğrudan ayrık ve özyinelemeli değişmez `desen.source` kökünü verir. Başarısızlık
kısmi belge yetkisi vermez. Yedi odak davranış testi ile on built public-runtime vakası, iki
ayrı beşer compiler-negative grubu, yedi public proof-core vakası ve 47 izlenen dosya receipt'ini
doğrulayan 13 vakalı bağımsız root kanıtı bu dar kapsamı korur. Receipt'ler, üç manifest ile 21
statik ESM modülünden oluşan exact 24 dosyalık runtime kapanışını da içerir; 19 bağımlılık modülü
import öncesinde 11 güncel M02-T11 receipt'i ve ayrık 8 M08 successor receipt'iyle doğrulanır. Exact
bağımlılık baytları, Node runtime, loader ve process güvenilen otoritelerdir; genel bir hostile
JavaScript sandbox sonucu iddia edilmez. Kanıt
[`EDITOR-CORE-SOURCE-DOCUMENT.md`](../proof/EDITOR-CORE-SOURCE-DOCUMENT.md) ve izlenen artifact'ta
sabittir. Güncel append-only reader ardılı sequence 29'dur;
`ccd4a58913585da39e71ea360714c69e70a94188e0b5643e521d61bf246f1a2b` başıyla 26 donmuş
artifact ve 52 güncel reader doğrular. Bu sonuç düzenleme komutlarını, authoring izolasyonunu,
bilinmeyen extension korumasını, persistence'ı, sürekli semantik doğrulamayı veya M08 terminal
React/DOM sınırını kanıtlamaz; bu sahiplikler sırasıyla M08-T02–T06, M08-T07, M08-T08, M08-T09 ve
M08-T10'da kalır. Genel ilerleme 86/145 (%59), M08 ilerlemesi 1/10, kanıt kapıları 8/13'tür;
sıradaki iş M08-T02'dir.

Pazar ve ürün varsayımlarının unutulmaması için
[`STRATEGIC-VALIDATION.md`](STRATEGIC-VALIDATION.md) içindeki iki sayılmayan kontrol noktası da
uygulanır: `G03` sonrasında A2UI/DTCG karşılaştırması, `G10` sonrasında ise en az 10 gerçek ekip
görüşmesi ve iki pilot hedefi. Bunlar 145 görevlik ilerleme sayacını değiştirmez.

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
