# Buradan Başla

Bu belge, DESEN reposunda bir çalışma oturumuna teknik tarihçede kaybolmadan başlamak içindir.
Kanonik protokol ve API metinleri İngilizcedir; bu sayfa bilgilendirici Türkçe çalışma rehberidir.

## Bugünkü konum

M10 ve terminal `G10` kapısı tamamen kapandı. Uygulama ilerlemesi 124/176 (%70), M10 12/12,
M10A 3/28 (%11) ve kanıt kapıları 11/14 düzeyindedir. M10A-T01, M10A-T02 ve M10A-T03'ün exact-head PR
kontrolleri, merge'leri ve taze `main` koşuları geçti; M10A-T04'ün yerel kanıt adayı hosted kapanışı
bekliyor. Ayrıntı [Project Status](../../PROJECT-STATUS.md),
[T01 kanıtı](../proof/M10A-T01.md), [T02 kanıtı](../proof/M10A-T02.md) ve
[G10 kanıtında](../proof/DESEN-APP-M10-GATE.md) bulunur.

SC-02 `adapt` kararıyla tamamlandı; M11 başlamadı. Yeni M10A planı 28 geliştirme görevi ve G10A
ekler; tamamlanmış görev sayısı 124 ve M10A sayacı 3/28'dir. `M10A-T01` `DONE`: Base UI 1.8.0
ile Button/Select/Dialog adaptör sınırı kanıtlandı. `M10A-T02` de `DONE`: platformdan bağımsız,
sürümlü project design-system modeli ve typed token resolver kanıtlandı. `M10A-T03` `DONE`: tema/token
authoring, modlar, alias'lar, kayıp-farkındalıklı aktarım ve izole workbench kanıtlandı.
`M10A-T04` `IN_PROGRESS` durumundadır: platformdan bağımsız immutable release kimliği, exact-digest
store portu ve host-profile release referansı için yerel kanıt adayı tamamlandı; exact-head hosted
Quality gate kapanışı bekleniyor.
Bu ürün geliştirme kararı için yeni görüşme/ekip testi gerekmiyor; pilot talebi doğrulanmış sayılmıyor.

T02 kapanışı [PR #92](https://github.com/desenlab/desen-app/pull/92) exact head'i
`d3563f84dd1fa634e4a7a794dc920bc28dd1af61` için
[run 34593058216](https://github.com/desenlab/desen-app/actions/runs/34593058216) ile doğrulandı;
değişmez aday `194b6eb36312f850d8f91ae1bbbf141408195dcd` olarak merge edildi ve aynı merge SHA'sı
[taze `main` run 34594715063](https://github.com/desenlab/desen-app/actions/runs/34594715063) ile geçti.

## Üç ayrı kimlik

- **DESEN:** Açık, veri-temelli yürütülebilir tasarım protokolü.
- **Desen App:** `desen.app` üzerinde çalışacak görsel authoring ve yayınlama ürünü.
- **DESEN Developer Platform:** `desen.run` üzerinde bulunacak protokol, SDK, conformance ve
  entegrasyon merkezi; ikinci bir tasarım ürünü değildir.

Desen App, DESEN'in tek kullanım yolu değildir. Bir geliştirici protokolü ve paketleri kendi host
uygulamasına entegre edebilir; runtime davranışı yine host-onaylı capability paketleri ve açık port
sınırları üzerinden gelir.

## Okuma sırası

1. Kök [AGENTS.md](../../AGENTS.md) kurallarını oku.
2. Güncel durumu [PROJECT-STATUS.md](../../PROJECT-STATUS.md) üzerinden doğrula.
3. [TASKS.md](TASKS.md) içinde yalnızca yetkilendirilmiş görev satırını ve bağımlılıklarını kontrol
   et.
4. İlgili paket veya uygulama README'sini oku.
5. Etkilenen [mimari](../architecture/ARCHITECTURE.md), ADR, protokol bulgusu ve kanıt iddialarını
   incele.

`PROJECT-STATUS.md` kronolojik günlük değildir; yalnızca bugünkü geçişi ve sıradaki otoriteyi
gösterir. `TASKS.md` görev panosudur; görev içi uzun uygulama hikâyesi değildir. Ayrıntılı sonuçlar
göreve ait `docs/proof/**` belgesinde, kararlar `docs/adr/**` altında, belirsizlikler
`PROTOCOL-FINDINGS.md` içinde yaşar.

## Her çalışma oturumunda uygulanacak yöntem

1. Tek bir görev kimliği seç ve tüm bağımlılıklarının `DONE` olduğunu doğrula.
2. Görevin kapsamını, kapsam dışını ve negatif davranışını yazılı kaynaklardan çıkar.
3. En küçük güvenli değişikliği uygula; ilgisiz kullanıcı değişikliklerini koru.
4. Pozitif ve ilgili negatif testleri ekle veya güncelle.
5. Göreve özel doğrulayıcıyı çalıştır.
6. Sınırlı yerel temel kontrolleri çalıştır.
7. Kanıt geçmeden görev, README ilerleme bloğu veya proje durumu değiştirilmez.
8. Ayrıntılı makbuzu canlı başlangıç belgelerine kopyalamak yerine tek kanonik kanıt belgesine yaz.

CI-02'nin sınırlı yerel temel kontrolleri şunlardır:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm build
pnpm boundaries
node scripts/ci/verify-proof-reader-checkpoints.mjs
```

Bu temel kontrol erken ve otorite-olmayan geri bildirimdir. Göreve özel doğrulayıcı ile pozitif ve
ilgili negatif testler ayrıca geçmelidir. `pnpm check`, G kapısı kapanışı, açıkça istenen kapsamlı
yerel denetim veya açık kullanıcı isteği için kullanılır. Hosted `main`, release, manuel denetim ve
güvenilmeyen sınırlar taze kapsamlı çalışma yürütür.

Mühür/checkpoint yalnızca kimlik ve etki otoritesidir; başarıyı önbelleklemez ve seçilen hosted
işler taze çalışır.

Tamamlanan T03, platformdan bağımsız `@desen/design-system-authoring` ile izole workbench'i sınırlar.
Yapılandırılmış tema/mode/token/alias kontrolleri, sRGB ve px/rem değerleri, atomik geçmiş/import ve
deterministik aktarım kapsamdadır. Donmuş SC-01'in 16 geçerli fixture'ı üç T02-destekli normal
edit/preview yolu ve 13 kayıpsız korunup açıklanan desteklenmeyen yol olarak kapsanır; yalnız ilgili
seçili overlay'de kısmi preview engellenir ve yedi geçersiz fixture atomik reddedilir. Ayrı kapalı
T02-tanınan desteklenmeyen matriste altı geçerli fixture korunup açıklanır, altı bozuk fixture atomik
reddedilir. İncelenmemiş veya geçersiz biçimler sessiz kayıp olmadan fail closed reddedilir. Normal App, persistence, release, Publisher, Runtime ve protokol
değişikliği kapsam dışıdır. T04 yerel adayında token/asset/recipe snapshot'ları content-addressed
immutable release olarak ayrıştırılır; runtime activation, persistent production store ve normal App
entegrasyonu kapsam dışıdır.

## Değişmez sınırlar

- Donmuş DESEN 0.1.0 upstream byte'ları test geçirmek için değiştirilmez.
- DESEN belgeleri veridir; keyfi executable code seçemez.
- Platform-bağımsız paketler React, DOM, CSS, browser veya app kodu import edemez.
- Paketler uygulamalara bağımlı olamaz.
- Reference host içinde elle yeniden yazılmış managed-screen component tree bulunamaz.
- Bilinmeyen veya uyumsuz semantic açıkça hata verir.
- Başarısız aktivasyon son-geçerli revizyonu korur.
- Dış yayın, npm publish, release ve domain deployment ayrıca açık kullanıcı yetkisi ister.

## Belge haritası

- [Master Plan](MASTER-PLAN.md): milestone amacı ve gate sırası
- [Task Board](TASKS.md): kanonik görev durumu, bağımlılık ve teslimat
- [Strategic Validation](STRATEGIC-VALIDATION.md): tamamlanan `SC-02 / adapt` kararı
- [M10A Product Plan](M10A-IMPLEMENTATION-PLAN.md): tasarım öncelikli ürün, kapsam ve sıradaki görev
- [M10A Task Contracts](M10A-TASK-CONTRACTS.md): görevlerin kabul ve olumsuz test koşulları
- [Design System Workbench](DESIGN-SYSTEM-WORKBENCH.md): katalog, dokümantasyon ve görsel onay
- [Architecture](../architecture/ARCHITECTURE.md): sistem ve bağımlılık sınırları
- [Proof Matrix](../proof/PROOF-MATRIX.md): iddia → kanıt eşlemesi
- [Protocol Findings](PROTOCOL-FINDINGS.md): donmuş protokol belirsizlikleri
- [Debt Register](DEBT-REGISTER.md): cleanup sahipliği ve son tarihleri
- [Documentation Standards](../standards/DOCUMENTATION-STANDARDS.md): yaşayan belge rolleri ve
  boyut bütçeleri
- [Demo Runbook](DEMO-RUNBOOK.md): tekrarlanabilir M10 ürün akışı

## M11'e geçiş

Önce M10A ve G10A tamamlanır. Sonra Map kolu `M11-T01`, Sortable kolu `M11-T08` ile başlayabilir.
Her iki kol da `packages/runtime-core` ağacını M10'da dondurulan
`3fa3613a3be63c749f40b6a0b55af5b40c675773` kimliğiyle karşılaştırır. İki kol ancak kendi bağımlılıkları
tamamlandıktan sonra `M11-T13` üzerinde birleşir.

## Tarihsel kayıt

M01–M10 boyunca biriken tam anlatı silinmedi. Değişmez ön-toparlama pointer'ı ve geri alma
komutu tek sahibi olan
[dokümantasyon standardında](../standards/DOCUMENTATION-STANDARDS.md#document-lifecycle-and-ownership)
yer alır. Görev ayrıntıları ayrıca ilgili proof ve ADR belgelerinde kalır; Git geçmişi yeniden
yazılmaz.

## Tarihsel CI-02 uyumluluk kaydı

Aşağıdaki paragraf eski CI-02 proof-reader sözleşmesi için aynen korunur; bugünkü durumu anlatmaz.

CI-02'nin bu merge edilmemiş değişiklikteki `DONE` kaydı koşullu bir kapanış adayıdır.
`921fd54c406f22fb6da25b0fdd29598ac8950750` başındaki uygulama adayı, PR #56'nın hosted
`Quality gate` koşusunu
[run 33196876164 / job 98936152886](https://github.com/desenlab/desen-app/actions/runs/33196876164/job/98936152886)
içinde 14 dakika 53 saniyede geçti. Bu makbuz yalnızca önceki head'i kanıtlar ve yeni head'e otorite
vermez. Tam güncel PR head'indeki hosted `Quality gate` geçene kadar kanonik CI-02 durumu
`IN_PROGRESS` kalır; geçerse aynı değişmemiş commit yetkili `DONE` revizyonu olur.

## Şimdilik yapılmayacaklar

- G10A geçmeden M11 capability genişlemesi
- iOS, Android, React Native, SwiftUI veya Compose runtime'ları
- production auth, organization/role/permission ve multiplayer özellikleri
- genel kaynak-kod round trip veya keyfi CSS/DOM inspection
- açık onay olmadan npm/domain/release yayını
