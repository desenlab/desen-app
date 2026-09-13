# Vibe Coding Oturumu İçin Kısa Talimat

Yeni bir geliştirme oturumunda aşağıdaki metni görev kimliğiyle birlikte kullanabilirsin:

> Önce `AGENTS.md`, `PROJECT-STATUS.md`, `docs/plan/START-HERE.tr.md` ve ilgili paket README'lerini
> oku. Yalnızca `[GÖREV KİMLİĞİ]` görevini uygula. Bağımlılıklarını doğrula, kapsam dışı işleri
> ekleme. Olumlu ve gerekli olumsuz testleri yaz. Public API'leri TSDoc ile, önemli mimari kararları
> nedenleriyle belgele. Donmuş protokolü değiştirme; belirsizlik varsa Protocol Findings'e yaz.
> CI-02'nin sınırlı yerel kontrollerini, göreve özel doğrulayıcıyı ve olumlu/olumsuz testleri çalıştır.
> Tam güncel PR head'inin hosted Quality gate sonucu geçmeden görevi DONE yapma. `pnpm check`
> kapsamlı denetim ve kapı kapanışı içindir. Sonunda neyin kanıtlandığını ve sıradaki tek görevi açıkla.

Bağımlılığı tamamlanmış M10A-T07 görevini başlatmak için:

> Yukarıdaki kurallarla yalnız `M10A-T07` görevini uygula. Önce M10A-IMPLEMENTATION-PLAN,
> M10A-TASK-CONTRACTS, ADR 0023 ve tamamlanmış T01–T06 kanıtlarını oku. T06'nın kapanmış private
> form-control Catalog/harness sınırını donmuş predecessor olarak tüket. Mevcut Select'i genişleterek
> yalnız Select, Combobox, Tabs, Slider ve NumberField için veri-temelli seçenekler, public content
> slotları, sınırlı filtreleme ve kararlı seçili kimlikler uygula. Canvas/host içinde klavye/typeahead,
> boş/devre dışı durumlar, tab seçimi ve sayısal sınırlar için olumlu ve olumsuz kanıt ekle. T08 ve
> sonraki görevleri, Runtime activation'ı, normal App entegrasyonu/persistence'ını,
> Publisher/Core/protokol değişikliğini veya M11'i dahil etme. T07 `NOT_STARTED` ve yalnız bağımlılığa
> hazırdır; kapsamı genişletme. Tam güncel PR head'inin hosted Quality gate'i geçmeden görevi `DONE`
> yapma.
