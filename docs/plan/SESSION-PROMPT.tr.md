# Vibe Coding Oturumu İçin Kısa Talimat

Yeni bir geliştirme oturumunda aşağıdaki metni görev kimliğiyle birlikte kullanabilirsin:

> Önce `AGENTS.md`, `PROJECT-STATUS.md`, `docs/plan/START-HERE.tr.md` ve ilgili paket README'lerini
> oku. Yalnızca `[GÖREV KİMLİĞİ]` görevini uygula. Bağımlılıklarını doğrula, kapsam dışı işleri
> ekleme. Olumlu ve gerekli olumsuz testleri yaz. Public API'leri TSDoc ile, önemli mimari kararları
> nedenleriyle belgele. Donmuş protokolü değiştirme; belirsizlik varsa Protocol Findings'e yaz.
> CI-02'nin sınırlı yerel kontrollerini, göreve özel doğrulayıcıyı ve olumlu/olumsuz testleri çalıştır.
> Tam güncel PR head'inin hosted Quality gate sonucu geçmeden görevi DONE yapma. `pnpm check`
> kapsamlı denetim ve kapı kapanışı içindir. Sonunda neyin kanıtlandığını ve sıradaki tek görevi açıkla.

Sıradaki uygun M10A görevini başlatmak için:

> Yukarıdaki kurallarla yalnız `M10A-T05` görevini uygula. Önce M10A-IMPLEMENTATION-PLAN,
> M10A-TASK-CONTRACTS, ADR 0023 ve tamamlanmış T01–T04 kanıtlarını oku. T01'in Base UI adaptör
> sınırını, T02'nin sürümlü editable-project/token resolver sonucunu, T03'ün authoring/workbench
> sonucunu ve T04'ün immutable release kimliğini donmuş predecessor olarak tüket. Box, Stack, Grid,
> Text/Heading, Image, Icon ve Separator için yalnız T05 kapsamını uygula; T06 ve sonraki görevleri,
> Runtime activation'ı, normal App persistence'ını, Publisher/Core/protokol değişikliğini veya M11'i
> dahil etme. T05 şu anda dependency-ready `NOT_STARTED` durumundadır; işe başlatan açık görev ataması
> olmadan durumunu değiştirme. Başlatıldığında tam güncel PR head'inin hosted Quality gate'i geçmeden
> görevi `DONE` yapma.
