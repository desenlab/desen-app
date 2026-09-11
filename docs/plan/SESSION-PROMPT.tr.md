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

> Yukarıdaki kurallarla yalnız `M10A-T03` görevini sürdür ve kapatmaya hazırla. Önce
> M10A-IMPLEMENTATION-PLAN, M10A-TASK-CONTRACTS, ADR 0023 ile tamamlanmış T01 ve T02 kanıtlarını
> oku. T02'nin sürümlü editable-project ve typed token-resolver sonucunu donmuş predecessor olarak
> tüket; platformdan bağımsız authoring paketi, izole workbench, yapılandırılmış tema/mode/token/
> alias kontrolleri, sRGB ve px/rem değerleri, atomik geçmiş/import ve loss-aware transfer kapsamını
> aşma. Donmuş SC-01'in 16 geçerli fixture'ını üç T02-destekli normal edit/preview yolu ile 13
> kayıpsız korunup açıklanan desteklenmeyen yol olarak kapsa; yalnız ilgili seçili overlay'de kısmi
> preview'i engelle ve yedi geçersiz fixture'ı atomik reddet. Ayrı kapalı T02-tanınan desteklenmeyen
> matriste altı geçerli fixture'ı koruyup açıkla, altı bozuk fixture'ı atomik reddet. İncelenmemiş
> veya geçersiz biçimleri sessiz kayıp olmadan fail closed reddet. Donmuş DESEN 0.1.0
> protokolünü, Runtime Core'u ve tarihsel SC-01 profilini değiştirme. T04 ve sonrasını,
> persistence'ı, normal App entegrasyonunu, Runtime değişikliğini ya da M11'i dahil etme. T03
> yerel uygulama/kanıt adayıyla `IN_PROGRESS` durumundadır; normal App/persistence/release kapsamı
> ekleme ve tam güncel PR head'inin hosted Quality gate'i geçmeden görevi `DONE` yapma. T04 bağımlılık
> açısından hazır olsa da T03 aktifken onu seçme veya başlatma.
