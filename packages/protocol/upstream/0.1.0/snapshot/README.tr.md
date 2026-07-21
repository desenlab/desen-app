# DESEN: Çalıştırılabilir Tasarım Protokolü

**Tasarım kaynaktır. Uygulama yayımlanmış tasarımı çalıştırır.**

DESEN, tasarımcının statik ekran resmi teslim etmesi yerine ürünün gerçek bileşenleri, davranışları, veri kaynakları ve operasyonlarıyla üretim arayüzü tasarlamasını hedefleyen açık ve yalnızca-veri tabanlı bir protokoldür.

## Temel model

```text
Geliştirici: Capability Package'ları hazırlar
                     ↓
Tasarımcı: DESEN editöründe gerçek capability'lerle tasarlar
                     ↓
            Design Source Document
                     ↓ publish
            Published Design Bundle
                     ↓
        Uygulamadaki DESEN Runtime
                     ↓
              Gerçek ürün arayüzü
```

Tasarımcı şunların sahibidir:

- yüzey yapısı ve bileşen kompozisyonu;
- açık prop ve style-part değerleri;
- responsive/koşullu varyantlar;
- yerel deneyim state'i;
- veri sunumu ve event–action bağlantıları;
- loading, empty, success ve error durumları.

Geliştirici şunların sahibidir:

- bileşenlerin iç implementasyonu;
- harita, drag-and-drop, tablo gibi üçüncü taraf kütüphaneler;
- resource ve operation implementasyonları;
- güvenlik, erişilebilirlik temelleri ve performans;
- platform ve altyapı entegrasyonu.

Bu sınır, geliştiriciyi ortadan kaldırmaz. Geliştiricinin ekranları tasarımdan tekrar yazması yerine yeniden kullanılabilir capability altyapısı geliştirmesini sağlar.

## Neden runtime bundle?

DESEN her tasarım revizyonunda React veya başka bir kaynak kod üretmeyi zorunlu tutmaz. Editördeki kaynak belge publish aşamasında doğrulanır, optimize edilir, tam catalog sürümleriyle pinlenir ve immutable bir runtime bundle'a dönüşür. Uygulama bu bundle'ı kendi güvenilir component implementasyonlarıyla çalıştırır.

Bu model:

- tasarımı managed surface'ler için tek doğruluk kaynağı yapar;
- klasik implementasyon handoff'unu büyük ölçüde kaldırır;
- geliştiricinin tasarımı sessizce yeniden yorumlamasını önler;
- keyfî uzaktan kod indirmeden dinamik tasarım yayınlamayı mümkün kılar;
- yeni tasarım revizyonlarını atomik ve geri alınabilir biçimde aktive eder.

## 0.1.0 kapsamı

İlk sürüm bilinçli olarak dardır:

- görsel ve component tabanlı arayüzler;
- gerçek component/behavior capability sözleşmeleri;
- props, slots, events, commands, style parts ve visual states;
- local state, conditions, variants ve repeat;
- read-oriented resources ve named operations;
- map ve sortable-list örnekleri;
- publish compiler ve production runtime sözleşmesi;
- exact package version/digest pinning;
- conformance şemaları ve test vektörleri.

Şimdilik kapsam dışında:

- telemetry ve deneyler;
- rollout/governance;
- voice, AR ve VR;
- backend üretimi;
- arbitrary JavaScript/expression;
- Figma benzeri vector/illustration araçları;
- zorunlu source-code export;
- gerçek zamanlı multiplayer.

## Dosyalar

- [`SPEC.md`](SPEC.md): İngilizce normatif çalışma taslağı
- [`ROADMAP.md`](ROADMAP.md): uygulama odaklı yol haritası
- [`schemas/`](schemas/): üç temel JSON Schema
- [`examples/`](examples/): giriş, harita ve sortable liste
- [`conformance/`](conformance/): geçerli/geçersiz test vektörleri
- [`tools/validate.py`](tools/validate.py): başlangıç doğrulayıcısı

## Doğrulama

```bash
python tools/validate.py --suite
```

Bu paket henüz 1.0 standardı değildir. En doğru sonraki adım, protokolü büyütmek değil; tek bir React catalog, editör ve runtime ile uçtan uca çalışan bir dikey prototip üretmektir.
