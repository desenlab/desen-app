# Vibe Coding Oturumu İçin Kısa Talimat

Yeni bir geliştirme oturumunda aşağıdaki metni görev kimliğiyle birlikte kullanabilirsin:

> Önce `AGENTS.md`, `PROJECT-STATUS.md`, `docs/plan/START-HERE.tr.md` ve ilgili paket README'lerini
> oku. Yalnızca `[GÖREV KİMLİĞİ]` görevini uygula. Bağımlılıklarını doğrula, kapsam dışı işleri
> ekleme. Olumlu ve gerekli olumsuz testleri yaz. Public API'leri TSDoc ile, önemli mimari kararları
> nedenleriyle belgele. Donmuş protokolü değiştirme; belirsizlik varsa Protocol Findings'e yaz.
> CI-02'nin sınırlı yerel kontrollerini, göreve özel doğrulayıcıyı ve olumlu/olumsuz testleri çalıştır.
> Tam güncel PR head'inin hosted Quality gate sonucu geçmeden görevi DONE yapma. `pnpm check`
> kapsamlı denetim ve kapı kapanışı içindir. Sonunda neyin kanıtlandığını ve sıradaki tek görevi açıkla.

Aktif M10A görevini sürdürmek için:

> Yukarıdaki kurallarla yalnız `M10A-T04` görevini sürdür ve kapatmaya hazırla. Önce
> M10A-IMPLEMENTATION-PLAN, M10A-TASK-CONTRACTS, ADR 0023 ile tamamlanmış T01–T03 kanıtlarını oku.
> T02'nin sürümlü editable-project ve typed token-resolver sonucunu ile T03'ün authoring/workbench
> sonucunu donmuş predecessor olarak tüket; platformdan bağımsız immutable release kimliği, sonlu
> token/asset/inert-recipe snapshot'ları, content-addressed dependency manifesti, exact host-profile
> release referansı ve mutable `latest` olmadan atomic exact-digest store portu kapsamını aşma. Eşit
> girdinin eşit digest verdiğini, değişen production dependency'nin yeni kimlik ürettiğini, eksik ya
> da kurcalanmış dependency'nin reddedildiğini ve kesintili write sonrasında doğru recovery'yi kanıtla.
> Donmuş DESEN 0.1.0 protokolünü, Runtime Core'u ve tarihsel SC-01 profilini değiştirme. Runtime
> activation, normal App entegrasyonu, durable production storage, Publisher/Core/protokol değişikliği
> veya M11'i dahil etme. T04 yerel uygulama/kanıt adayıyla `IN_PROGRESS` durumundadır; tam güncel PR
> head'inin hosted Quality gate'i geçmeden görevi `DONE` yapma. T05 ve sonrasını T04 aktifken seçme
> veya başlatma.
