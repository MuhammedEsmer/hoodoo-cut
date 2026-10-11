# HooDoo Cut v0.9.3.4 — İlk geliştirme ve doğrulama

Tarih: 5 Ekim 2026. Temel sürüm: `749a6ea`, v0.9.3.3. Hedef ortam:
Premiere Pro 26.5.2. Bu sürüm mevcut CEP motorunu düzeltir; XML/UXP motoru
henüz geliştirilmedi. Kaynak, test ve kurulum paketi hazır; gerçek Premiere
projesi üzerinde çalışma süresi ve çıktı doğruluğu henüz doğrulanmadı.

## Yapılan değişiklikler

1. **Stereo analiz:** Her kanalın ayrı filtre durumu ve pencere enerjisi var.
   En yüksek kanal enerjisi kullanılır. Ters fazlı stereo konuşma birbirini
   iptal etmez; yalnız bir kanaldaki konuşma da 6 dB zayıflatılmaz.
2. **Kesim sınırları:** Başlangıç yukarı, bitiş aşağı tam kareye hizalanır.
   Bitişik/örtüşen aralıklar birleştirilir. Razor, silme, susturma ve boşluk
   kapatma aynı zaman değerlerini kullanır. Silme/susturmadaki 80 ms taşma
   kaldırıldı; yalnız 1 mikro saniyelik sayısal tolerans kaldı.
3. **Tek taramada klip hazırlığı:** Bütün sessizlik aralıkları için hedef
   klipler bir kez bulunur. Sonraki partiler doğrudan klip referanslarıyla
   çalışır. Her hedefin zaman konumu uygulanmadan önce kontrol edilir.
   Aralık sınırını aşan klip varsa silme başlamaz.
4. **Sequence ve yerleşim doğrulaması:** Proje yolu, sequence kimliği,
   timebase, süre, klip kimlikleri, kaynaklar, başlangıç/bitiş, kaynak in/out,
   hız ve mute/lock/disabled durumlarından yapısal bir imza üretilir. Ses
   export'undan önce/sonra ve kesimden önce doğrulanır. Seçim aralıkları aynı
   host çağrısında sequence imzasına bağlanır. Partiler arasında aktif
   sequence değişirse işlem durur.
5. **Taze ses:** Süre ve klip sayısına dayanan eski WAV önbelleği kaldırıldı.
   Her analiz ayrı geçici dosya üretir; bitince temizler. Eksik WAV ve
   geçersiz float örnekleri reddedilir.
6. **Hata yönetimi:** Yedek kopyalama, sequence'e dönüş, track başına razor,
   silme, mute geri yükleme ve kompaksiyon hataları gizlenmez. Başarısız
   işlem tamamlandı olarak gösterilmez. Geri yükleme, başlangıçtaki track
   referanslarını kullanır; başarısız olanlar tekrar denemek için saklanır.
   Okunamayan mute durumu başarı sayılmaz.
7. **Kilitli track:** DOM kilit bilgisini sunmadığında QE üzerinden okunur.
   Belirsiz kilit durumu veya ilgili dolu track'in kilitli olması işlemi
   durdurur. Panel analiz ve kesim işlemlerini aynı anda başlatmaz.
8. **Paketleme:** Sürüm alanları 0.9.3.4 oldu. Kurulum paketleyicisi eski
   `D:\PremiereProExtension` yolu yerine bulunduğu repo klasörünü kullanır.
   Geçici staging klasörü benzersizdir ve dist altında olduğu doğrulanarak
   temizlenir.

## Ölçümler

### Silme motoru

Aynı sentetik iş yükü: 367 sessizlik aralığı, 3 video + 3 ses track'i,
track başına 1.101 klip. Her iki motor da 2.202 hedef klibi siler. Bu
yerleşim kullanıcının gerçek projesinin kopyası değildir.

| Ölçüm | v0.9.3.3 | v0.9.3.4 |
|---|---:|---:|
| Silme aşamasında start/end okumaları | 77.364 | 17.616 |
| Silinen hedef klip | 2.202 | 2.202 |
| Sahte DOM üzerinde 7 koşu medyanı | 7,35 ms | 3,74 ms |

Silme aşamasındaki zaman bilgisi okumaları **%77,2 azaldı**. Sahte DOM
medyanı gerçek Premiere performansı anlamına gelmez. Yapısal imza için
yapılan ek taramalar bu tabloda yoktur; güvenlik kontrollerinin toplam
süreye maliyeti gerçek projede ayrıca ölçülmelidir.

Kanıtlar: [önce](2026-10-05-delete-baseline.json),
[sonra](2026-10-05-delete-prepared.json).

### Ses analiz motoru

Aynı 120 saniyelik 48 kHz, 16 bit stereo WAV, aynı Node süreci ve VM yükleme
sınırı. Bir ısınma koşusu atıldı; beş ölçümde sıra dönüşümlü kullanıldı.

| Ölçüm | v0.9.3.3 | v0.9.3.4 |
|---|---:|---:|
| Okuma + filtre + enerji medyanı | 91,06 ms | 122,57 ms |
| Pencere sayısı | 6.000 | 6.000 |

Yeni motor bu örnekte **%34,6 daha fazla süre** kullanıyor. Bunun karşılığı
stereo doğruluğu: iki kanal bağımsız filtrelenir. İlk denemede PCM örneklerine
gereksiz sonluluk kontrolü yapmak büyük yavaşlama yaratmıştı; kontrol yalnız
float WAV'a alınarak giderildi. Bu ölçüm Premiere export'unu ve CEP Node
17.7.2 ortamını kapsamaz. [Ham sonuç](2026-10-05-analyzer-benchmark.json).

Kullanıcının 127 saniyelik razor aşaması hâlâ aynı QE kesim yolunu kullanır.
Bu sürüm için 186,8 saniyenin belirli bir süreye düştüğü iddia edilmiyor.

## Doğrulama

- Mevcut analiz testleri: **15 geçti**.
- Yeni ses/host regresyon testleri: **22 geçti**.
- Panel ve host köprüsü akış testleri: **10 geçti**.
- Toplam: **47 geçti, 0 başarısız**.
- `main.js` sözdizimi ve `git diff --check` başarılı.
- Bağımsız incelemenin bulduğu beş önemli hata düzeltildi; takip incelemesi
  yeni kritik/önemli sorun bildirmedi.
- Kurulum ZIP'indeki **11 dosyanın SHA-256 değerleri** kaynak dosyalarla
  eşleşti. `.debug` paket dışında.

Testler sentetik WAV, gerçek analiz kodu ve VM içinde çalışan gerçek host/
panel kodunu kullanır. Premiere nesneleri ve köprüsü taklit edilir; QE'nin
gerçek davranışı, klip referanslarının bütün link senaryolarındaki ömrü,
efektler, transition'lar ve gerçek undo sonucu bu testlerin kapsamı değildir.

## Paket

`dist/HooDooCut-Kurulum-v0.9.3.4.zip` — 48.974 bayt.

SHA-256:
`A918CD4D8664476E09667EC5B5BD7680585AD953AE5DB0E0C0589EB216EE5AF8`

ZIP'i çıkarıp `Kur.bat` ile kurun. Premiere'i yeniden açınca günlükte
`Sürüm 0.9.3.4` görünmelidir. GitHub yayını ve canlı kurulum yapılmadı.

## Gerçek Premiere doğrulaması

1. Aynı 66 dakika 18 saniyelik içeriğin ayrı sequence kopyalarında aynı
   analiz track'i ve ayarlarla v0.9.3.3 / v0.9.3.4 günlüklerini karşılaştırın.
   Her koşuda aynı orijinal yerleşimden başlayın.
2. Önce “sil, boşluk kalsın” modunda export, analiz, razor, hazırlık ve silme
   sürelerini ayrı kaydedin. Konuşma başı/sonu, stereo ters faz, A/V senkronu
   ve kesim dışında kalan klipleri kontrol edin.
3. Diğer sequence kopyalarında sustur, sadece kes ve boşluk kapat modlarını
   sınayın; linked klipleri, kilitli track'i, seçili bölgeyi ve Ctrl+Z'yi kontrol edin.
4. Analiz ile kesim arasında sequence değiştirerek eski planın reddedildiğini
   doğrulayın. Başarısız işlemde panelin tamamlandı demediğini kontrol edin.

Yapısal imza bütün gain/efekt/keyframe değişikliklerini veya aynı yoldaki
medya dosyasının yeniden yazılmasını izlemiyor. Bunlardan sonra yeniden
analiz gerekir. İşlem sırasında aynı sequence üzerinde elle düzenleme
yapmak tümüyle izlenmez. Uzun AME aktarımında dosya boyutunun sabitlenmesi
hâlâ tamamlanma sinyali olarak kullanılır; geçerli ama kısmi bir WAV bu
korumayı aşabilir. Export tamamlanma olayları ayrı bir geliştirme konusudur.

Bir sonraki mimari adım, [ilk analiz raporundaki](2026-10-05-teknik-analiz.md)
XML/UXP seçeneklerinin efekt ve senkron koruma açısından küçük bir gerçek
Premiere örneğinde doğrulanmasıdır. 734 ayrı razor çağrısının baskın
maliyetini kaldıracak yol henüz bu sürüme dahil edilmedi.

## API dayanakları

- Sayısal `TrackItem.move(delta)` kullanımı
  [Adobe'nin PProPanel örneğinde](https://github.com/Adobe-CEP/Samples/blob/master/PProPanel/jsx/PPRO/Premiere.jsx#L2721-L2723)
  bulunur; taşımadan sonra hedef konum ayrıca kontrol edilir.
- DOM/QE kilit bilgisi farkı için
  [Adobe Community'deki doğrudan geliştirici gözlemi](https://community.adobe.com/questions-729/can-t-find-targeted-track-in-the-dom-1368414)
  kullanıldı. Bu eski gözlem Premiere 26.5.2 çalışma testi yerine geçmez;
  bilinmeyen API sonucu hata olarak ele alınır.

Tekrar çalıştırma:

```powershell
node tools\test-analyzer.js
node tools\test-regressions.js
node tools\test-panel.js
node tools\benchmark-delete.js
node tools\benchmark-delete.js prepared
node tools\benchmark-analyzer.js
.\build-installer.ps1
```
