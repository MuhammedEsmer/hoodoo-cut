# HooDoo Cut 0.9.4.0 — toplu silme

CEP paneli 0.9.4.0, ayrı UXP yardımcı motoru 0.9.5 sürümündedir. Adobe yükleyicisi aynı sürüm numarasıyla yeniden kurulumu güncelleme olarak uygulamadığından yardımcı motorun patch sürümü artırıldı.

CEP analizi, export ve QE razor korunur. Silme aşaması UXP yardımcı paneline aktarılır. V1/A1/A2 dahil hedef video ve ses klipleri tek `TrackItemSelection` içine eklenir, tek `createRemoveItemsAction(..., false, MediaType.ANY, false)` tek undo transaction içinde uygulanır. Ripple ve overlap kaydırma kapalıdır. Boşluk kapatma mevcut ayrı aşamadır.

990 kliplik örnekte native silme çağrısı tasarım gereği 990'dan 1'e iner. Bu sayı farkı süre kazanımı ölçümü değildir. Razor hâlâ ayrı CEP/QE çağrıları kullanır. Undo devre dışı bırakılmaz; yalnız silme aşaması tek undo adımıdır.

## Kullanım

Premiere'de HooDoo Cut CEP panelini yeniden açın; gerekirse projenizi kaydedip Premiere'yi yeniden başlatın. Plugins menüsünden **HooDoo Cut Toplu Motor** panelini açıp açık tutun. Motor "hazır" göstermeli. Analizden sonra silme motoru **Toplu (UXP)** seçili olmalıdır. Eksik yardımcı motor razor öncesinde durdurur. **Klasik (CEP)** yolu elle seçilebilir; otomatik geri dönüş yoktur.

## Doğrulama ve sınırlar

Son doğrulama: 68 test geçti (15 analiz, 24 host regresyonu, 12 CEP panel, 10 toplu motor, 2 host planı, 3 yerel köprü, 2 yardımcı panel bağlantı kurtarma). JavaScript sözdizimi ve git diff whitespace kontrolü geçti. Adobe kurulum kaydı Premiere 26.5.2 için yardımcı motor 0.9.5'i Enabled gösteriyor; kurulu dört UXP dosyası CCX paketiyle, beş CEP dosyası kaynakla SHA-256 üzerinden eşleşti.

Kurulum öncesi CEP dosya yedeği: `dist/bulk-backup-4cc5ce3b37d34d41b9cef82c6f93e4e2`. Dağıtım paketi: `dist/HooDooCut-Kurulum-v0.9.4.0.zip`. Kullanıcıya gösterilen Adobe Genuine Service teklifi eklenti kurulumundan ayrı bir Adobe penceresidir; AGS kurulum komutu çalıştırılmadı.

- Sentetik motor testleri: karışık kanal seçimi, tek native action/transaction, callback ömrü, sequence/medya uyuşmazlığı, tekrar eden hedef, başarısız action/transaction, hazırlık sırasında timeline değişikliği.
- Yerel HTTP testleri: origin/token, tek seferlik iş alma, sonuç kimliği, idempotent sonuç onayı. Köprü yalnız 127.0.0.1:51373'e bağlanır; dosya erişim izni ve internet domain izni istemez.
- CEP panel testleri: yardımcı motor yokken razor başlamaz; toplu mod tekil CEP silme çağrısı yapmaz.
- Kaynak/sequence/klip zamanları eşleştirilir. Hazırlık sırasında proje veya kanal değişikliği event'leri işlemi iptal eder. Native işlem sonrası kanal klip sayıları doğrulanır. Ağ kesintisinde native işlem otomatik tekrarlanmaz.
- Kanala göre tarama, UXP hazırlık ve native commit süreleri günlüğe yazılır. Klasik mod her partinin süresini yazar.
- Canlı timeline'da hız, UXP/CEP sequence kimliklerinin eşleşmesi, gerçek undo ve geçişli/nested/multicam sequence davranışları henüz ölçülmedi. Kaynak eşleştirmesi yapamayan klip işlem başlamadan hata verir. Aktif kullanıcı timeline'ı otomatik değiştirilmedi.

## Paketleme

`npm install --prefix dist/uxp-packager --ignore-scripts --no-audit --no-fund @adobe/uxp-devtools-core@1.2.0`

`node tools/package-bulk.js` Adobe açık kaynak paketleme sınıfını kullanarak CCX üretir. Strict host manifest validation bağlantısı olmadan arşiv oluşturur; Adobe resmi yükleyicisi kurulumu doğrular. `build-installer.ps1` CEP dosyalarıyla CCX paketini birlikte dağıtır. UXP geliştirici modu açılmaz.

API kaynakları: [SequenceEditor](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/sequenceeditor), [TrackItemSelection](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/trackitemselection), [Project](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/project), [Adobe paketleme aracı](https://github.com/adobe-uxp/devtools-cli), [UXP kurulum](https://developer.adobe.com/uxp/guides/how-to/distribution/install/).
