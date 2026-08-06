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
61 kanıt çiftini değişmez tarihsel temel olarak saklar. M07-T05 eklendikten sonra güncel zorunlu
plan 138 işin ve 65 kanıt çiftinin tamamını yeni sistemle çalıştırır. Ortak dosya, çıktı, port ve
geçici-dizin kullanımı kodla sınıflandırılmıştır; eski ve yeni yollar aynı sürümde
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
`85c49a0d79346bf2ea92b716f6b43c5d95d164209e3d67af34871a334686e10e` başından güncel
`146b04f1c8209be64168afb451ceee2c422da0cdced116f8d08beafe795c533c` başına bağlanır; aynı 14
değişmemiş dondurulmuş eseri ve 28 okuyucuyu doğrular. Yalnızca `[9]` indeksi değişir: M06-T09
publisher-bundle-publication kök okuyucusu 63.859 bayt /
`sha256:ae7b688d904b4c77632fd78e0ee23b2264eae1574b4350306b5e2ec1b9974b8d`. Bir hosted
required-exhaustive denemesi bu okuyucuda M07 ardılı/güncel makbuzuna ilişkin iki eskimiş iddiayı
ortaya çıkardı; dar okuyucu düzeltmesinden sonra odaklı kök test dizisi 112/112 geçiyor ve
dondurulmuş M06-T09 eseri değişmedi. Bu incelenmiş yerel okuyucu kanıtıdır, henüz hosted CI başarı
iddiası değildir ve uyumluluk okuyucusu borcunun sahibi I07-04 olarak kalır.
Geçici shadow iş akışı ve karşılaştırma adaptörü kaldırılmıştır. Bu aşama seçmeli CI yapmaz: bilinmeyen
bir değişiklik için daha az test çalıştırma işi I07-03 ve I07-04'e aittir. Kalan geçici blokların
kaldırma sahibi ve son tarihi [`DEBT-REGISTER.md`](DEBT-REGISTER.md) içinde makine tarafından
kontrol edilir. Teknik karar, güvenlik kapıları ve kesin kanıt
[`ADR 0011`](../adr/0011-modular-proof-infrastructure.md) ile
[`I07-02 baseline`](../proof/baselines/i07-02-required-exhaustive-equivalence.json) içinde kayıtlıdır.
`M07-T05` tamamlandı: yalnızca bilgisayarın kendi sabit yerel adresinde çalışan ve bearer anahtarı
isteyen Fastify API'si düzenlenebilir Source'ları, değişmez Bundle'ları ve değişebilir channel
pointer'larını birbirinden ayırıyor. Source değişiklikleri SQLite içinde nesil numarasıyla güvenli
karşılaştırma yapıyor; eski bir düzenleme yenisini ezemiyor. Bundle yazımı daha önce kanıtlanan
M07-T01 deposuna gidiyor. Channel yalnızca hangi revision'ın keşfedileceğini söylüyor; staging,
commit veya aktivasyon yetkisi vermiyor. Doğru origin `ETag` değerini okuyabiliyor; bağlantı,
istek ve keep-alive süreleri sırasıyla 5, 15 ve 5 saniyeyle sınırlı. `N-019` artık `TESTED`, fakat
P-12 hâlâ `NOT_PROVEN`, G07 açık ve PF-074 `OPEN`. Sıradaki görev `M07-T06`: doğrulanmış paket
snapshot'larından staged runtime index'lerini kurup staged ve active durumlarını kesin olarak ayrı
tutacağız. Güncel ilerleme 79/145 görev (%54), M07 içinde 5/11 görev (%45) ve kanıt kapılarında
7/13'tür.

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
