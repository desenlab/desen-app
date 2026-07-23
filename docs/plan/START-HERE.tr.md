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

Pazar ve ürün varsayımlarının unutulmaması için
[`STRATEGIC-VALIDATION.md`](STRATEGIC-VALIDATION.md) içindeki iki sayılmayan kontrol noktası da
uygulanır: `G03` sonrasında A2UI/DTCG karşılaştırması, `G10` sonrasında ise en az 10 gerçek ekip
görüşmesi ve iki pilot hedefi. Bunlar 144 görevlik ilerleme sayacını değiştirmez.

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
