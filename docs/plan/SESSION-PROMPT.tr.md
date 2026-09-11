# Vibe Coding Oturumu İçin Kısa Talimat

Yeni bir geliştirme oturumunda aşağıdaki metni görev kimliğiyle birlikte kullanabilirsin:

> Önce `AGENTS.md`, `PROJECT-STATUS.md`, `docs/plan/START-HERE.tr.md` ve ilgili paket README'lerini
> oku. Yalnızca `[GÖREV KİMLİĞİ]` görevini uygula. Bağımlılıklarını doğrula, kapsam dışı işleri
> ekleme. Olumlu ve gerekli olumsuz testleri yaz. Public API'leri TSDoc ile, önemli mimari kararları
> nedenleriyle belgele. Donmuş protokolü değiştirme; belirsizlik varsa Protocol Findings'e yaz.
> CI-02'nin sınırlı yerel kontrollerini, göreve özel doğrulayıcıyı ve olumlu/olumsuz testleri çalıştır.
> Tam güncel PR head'inin hosted Quality gate sonucu geçmeden görevi DONE yapma. `pnpm check`
> kapsamlı denetim ve kapı kapanışı içindir. Sonunda neyin kanıtlandığını ve sıradaki tek görevi açıkla.

Sıradaki başlamaya hazır M10A görevi için:

> Yukarıdaki kurallarla yalnız `M10A-T02` görevini uygula. Önce M10A-IMPLEMENTATION-PLAN,
> M10A-TASK-CONTRACTS ve ADR 0023'ü oku. Platformdan bağımsız `@desen/design-system-core`
> paketinde sürümlü editable-project zarfını, tipli token profillerini ve deterministik alias/mode
> çözümünü kanıtla; cycle, eksik veya tip uyuşmaz alias, overflow ve güvensiz değerleri reddet.
> Donmuş protokolü, Runtime Core'u ve tarihsel SC-01 profilini değiştirme. T03 tema editörünü,
> T04 release katmanını, normal App entegrasyonunu, starter genişlemesini veya M11'i bu göreve dahil
> etme. Commit/push ve dış yayın için mevcut yetkiyi doğrula.
