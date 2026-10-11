# HooDoo Cut: teknik analiz ve yeniden tasarım önerisi

Tarih: 5 Ekim 2026. İncelenen kaynak: `749a6ea`, sürüm `0.9.3.3`. Kullanıcının bildirdiği Premiere sürümü: `26.5.2`. Karşılaştırma hedefi: AutoCut Silences.

## Sonuç

En büyük hız problemi Premiere timeline'ını yüzlerce ayrı mutasyonla değiştirme yöntemi. Ses analizini daha hızlı bir dile taşımak bu örnekte küçük kazanç sağlar. Büyük kazanç için düzenleme yöntemini değiştirmek gerekir: basit ham kayıtlarda tutulacak parçaları hesaplayıp yeni sequence üretmek; mevcut efektli projelerde daha az mutasyon yapan, sonucu doğrulanan bir yerinde düzenleme yolu kullanmak.

Hızdan önce çözülmesi gereken doğruluk sorunları da var. Ters fazlı stereo sesin sessizlik sayılması ve silme toleransının sessizlik dışındaki kısa klibi de silmesi, mevcut fonksiyonlar üzerinde izole kontrollerle yeniden üretildi.

Bu bir analiz raporudur. Uygulama kodu değiştirilmedi; Premiere'de kullanıcının projesine kesim uygulanmadı. Ticari araçlar aynı proje üzerinde çalıştırılmadı. Önerilen mimarilerin hızları henüz ölçülmedi.

## 1. Verilen logun sayısal değerlendirmesi

Sequence süresi 3.978,1 saniye, yani 66 dakika 18,1 saniye. Analiz 198.903 adet 20 ms pencere üretiyor; bu sayı süreyle uyumlu.

| Aşama | Süre | Ölçülen aşamalar toplamındaki payı |
|---|---:|---:|
| Premiere ses export'u | 37,9 sn | %16,6 |
| Ses analizi | yaklaşık 4 sn | %1,7 |
| 734 kesim sınırını uygulama | 127,0 sn | %55,5 |
| 1.107 klibi silme | 59,8 sn | %26,1 |
| Toplam | yaklaşık 228,7 sn | %100 |

Analiz süresi log satırlarının zaman farkından geliyor; özel bir analiz kronometresi sonucu değil. Toplam, kullanıcı bekleme ve tıklama sürelerini içermez. Kesme/silme toplamı 186,8 saniye ve toplamın %81,7'si. Logda boşluk kapatma çalışmamış; bu örnek üzerinden kompaksiyon performansı hesaplanamaz.

- Razor sınırı başına gözlenen ortalama: yaklaşık 173 ms. Bu, saf API çağrısı maliyeti değildir; partilerin diğer işlerini de kapsar.
- Silinen klip başına gözlenen ortalama: yaklaşık 54 ms. Snapshot okumaları ve diğer silme işleri de bu sürenin içinde.
- `CHUNK_RAZOR=20` nedeniyle 37 razor partisi; `CHUNK_REMOVE=60` nedeniyle 7 silme partisi var.
- Partiler arasındaki 30 ms beklemelerin toplamı yaklaşık 1,32 saniye. Bunları kaldırmak 186,8 saniyelik işi kökten hızlandırmaz.
- `floor seqrazor` zaten hızlı timecode yolunun ve sequence düzeyinde razor'un kullanıldığını gösteriyor. Her sınırda playhead taşıma veya altı track'e ayrı razor çağrısı yapıldığı iddiası bu log için yanlış olur.
- Kalibrasyon her razor partisinde bir kez yapılıyor: bu örnekte yaklaşık 37 playhead taşıması. Bunları azaltmak mümkün; tüm gecikmeyi açıkladığı kanıtlanmış değil.

Kaynaklar: `client/js/main.js:527,606,638`; `host/index.jsx:287,307,349,487`.

## 2. Mevcut yaklaşımda korunmaya değer parçalar

- WAV bloklar halinde okunuyor; 728 MB sesin tamamı bir JavaScript dizisine yüklenmiyor.
- 20 ms RMS pencereleri, konuşma bandı filtresi ve 3 dB histerezis var. Filtre/histerezis eklemek yeni bir öneri olamaz; zaten mevcut.
- Sequence razor'u varsa kullanılıyor; susturma modunda video gereksiz kesilmiyor.
- Silme sırasında klip referanslarının snapshot'ı alınmış; eski aralık başına DOM tarama yaklaşımı zaten azaltılmış.
- Aktif kompaksiyon yolu önce mutlak hedefleri hazırlayıp mevcut konumdan fark kadar taşıyor. Bağlı partnerin daha önce taşınmış olmasını hesaba katması iyi bir tasarım.

Sorunların bir bölümü bu parçaların yokluğu değil; çalışma kapsamı, doğrulama ve uygulama motorunun maliyeti.

## 3. Somut eksikler ve riskler

### 3.1. Silme toleransı sessizlik dışındaki klibi kapsayabiliyor — öncelik P0

`ACS_removeBatch` içindeki `EPS=0.08`, aralığın iki tarafına da 80 ms tolerans ekliyor. 30 fps'te bu 2,4 kare; 60 fps'te 4,8 kare.

Mevcut fonksiyon Node VM içinde mock track/clip nesneleriyle çalıştırıldı:

```text
Sessizlik aralığı: [1.000000, 2.000000]
Klip:              [0.933333, 1.000000]  (30 fps'te iki kare)
Sonuç: OK|1; clip.remove() çağrıldı.
```

Klip sessizlik başlamadan önce bitmesine rağmen silme listesine giriyor. Bu, gerçek Premiere projesinde yaşandığının kanıtı değildir; eşleştirme mantığının hatasını doğrudan gösterir.

Çözüm: analiz aralıklarını tek sefer kare sınırlarına dönüştürmek; razor, silme ve kompaksiyonun aynı kesin sınırları kullanması. Konuşmayı koruyan başlangıç yukarı/son aşağı yuvarlama politikasını değerlendirmek; sıfır uzunluklu aralıkları elemek. 80 ms genişletilmiş kapsama göre değil, planlanan parçanın kimliği ve gerçek sınırlarına göre silmek. Sınır kesilemediyse silmeye devam etmemek.

Kaynak: `host/index.jsx:495,522,531`.

### 3.2. Ters fazlı stereo analizde iptal oluyor — öncelik P1

Kanallar önce aritmetik ortalamayla mono'ya çevriliyor, sonra enerji hesaplanıyor: `(L+R)/2`. `R=-L` olduğunda enerji sıfırlanıyor.

İki saniyelik 48 kHz stereo 440 Hz sinüs, mevcut analiz motoruna bellekte üretilmiş WAV olarak verildi:

```text
L=R, eşik -40 dB: kesim yok.
L=-R, eşik -40 dB: [0.3,1.7] kesimi; 1.4 saniye kesilecek.
```

Sinüs konuşma örneği değildir; kanal toplama hatasını izole etmek için kullanıldı. Aynı matematik ters fazlı konuşma kanallarına da uygulanır.

Çözüm: kanalları ayrı filtreleyip enerjilerini hesaplamak, sonra maksimum/uygun enerji birleştirmesi kullanmak. Birden fazla analiz track'i için de mümkün olduğunda ayrı değerlendirme ve konuşma bölgelerinin birleşimi tercih edilmeli. Premiere export'u sırasında sesler zaten iptal olmuşsa yalnız WAV okuyucusunu düzeltmek yeterli olmaz.

Kaynak: `client/js/analyzer.js:124-142`.

### 3.3. Önbellek timeline içeriğini temsil etmiyor — öncelik P1

Cache anahtarı proje adı, sequence adı, süre, ses klibi sayıları ve analiz track seçimine dayanıyor. Kaynak dosyası, klip başlangıcı, source in/out, gain, efekt, mute ve video klibi sayıları anahtarda yok. Aynı sayıda/sürede kliplerle sesi değiştirmek export'u atlatabilir. `done()` cache'i geçersizleştirmiyor; boşluk bırakarak silmenin süreyi koruması bu açıdan önemli.

Çözüm: proje/sequence kimliği, klip kimlikleri, kaynak sürümü ve zaman eşlemesi üzerinden fingerprint. İşlem sonrası invalidate. Analiz ölçümlerini ses verisinden ayrı cache'lemek; eşik/padding değişince mevcut ölçümlerden sonuç üretmek. Track efektlerinin fingerprint'i güvenilir alınamıyorsa konservatif invalidate veya açık yeniden export seçeneği kullanmak.

Kaynak: `client/js/main.js:371-380,727`; `host/index.jsx:49-55`.

### 3.4. Analiz planı belirli sequence/revizyona bağlanmıyor — öncelik P1

`state.lastCuts` zaman aralıklarını tutuyor. `cut()` başlangıcında planlanan sequence kimliği ve içeriği tekrar doğrulanmıyor. Host operasyonları o anda aktif sequence'i kullanıyor. Analizden sonra sequence değişirse, eski aralıkların yeni sequence'e uygulanması mümkün. Parti aralarında veya AME beklerken de bağlam değişebilir.

Çözüm: çalışma planına sequence kimliği ve fingerprint koymak. Her aşamada aynı bağlamı doğrulamak; değişmişse yeniden analiz istemek. İşlem devam ederken ikinci analiz/kesimi önlemek. Mute geri yüklemesini de başlangıçtaki sequence/track referanslarına bağlamak.

Kaynak: `client/js/main.js:488,540-553`; `host/index.jsx:289,489,137`.

### 3.5. Kısmi hata başarı gibi raporlanabiliyor — öncelik P1

- Silmede `remove()` exception'ları boş catch ile yutuluyor.
- Razor hataları sayılıyor fakat sonraki silme aşaması yine başlayabiliyor.
- Kompaksiyon hazırlığı/uygulaması hata döndürdüğünde bazı dallar `done()` çağırıyor.
- `done()` koşulsuz `showResult(true, ...)` kullanıyor.
- Mute geri yükleme yanıtı istemcide doğrulanmadan “eski haline döndürüldü” yazılıyor.
- Yedek oluşturulamadığında uyarıyla düzenlemeye devam ediliyor; yedek kimliği yerine adı kontrol ediliyor.

Çözüm: başarılı, kısmi ve başarısız sonuçlarını ayırmak; başarısız sınırlar için silmeyi durdurmak; planlanan/gerçek düzenlemeyi karşılaştırmak. Yedek istenmişse yedeğin oluşmasını işleme önkoşul yapmak. Taşıma sonrası gerçek hedefi kontrol etmek. Sayım, medyanın doğru kesildiğini tek başına kanıtlamaz.

Kaynak: `host/index.jsx:531,454,135,807`; `client/js/main.js:362,596,623,683,700,727`.

### 3.6. “Konuşma tespiti” gerçekte enerji sezgisi

Otomatik eşik p15/p85 dağılımından hesaplanıyor; öğrenilmiş konuşma modeli yok. Band-pass uğultuyu azaltır ama klavye, müzik ve oyun sesini konuşmadan güvenilir ayıramaz. Sabit global eşik, mikrofon/gürültü seviyesi kayıt boyunca değişince zorlanır.

`minSpeech` iki sessizlik arasındaki kısa yüksek enerjili bölgeyi siler. İzole kontrolde 120 ms yüksek enerjili bölge, varsayılan 180 ms ayarda sessizliğe katıldı. Bu mevcut tasarımın beklenen davranışıdır; kısa gerçek kelimelerin korunacağı anlamına gelmez.

Çözüm: enerji modunu koruyup ayrıca konuşma VAD modu eklemek. VAD eşiği, konuşma bitiş beklemesi ve payları etiketlenmiş Türkçe kayıtlarda ayarlamak. VAD oyun içindeki diğer insan seslerini de konuşma sayabilir; yorumcu/diğer ses ayrımı için ayrı mikrofon track'i çok daha değerlidir. Salt sessizlik kesimi için tam transkripsiyon zorunlu değil.

Kaynak: `client/js/analyzer.js:175,214,268`.

### 3.7. Seçili kısa bölge de tüm sequence'i export ettiriyor

Seçim bilgisi export kapsamını daraltmıyor; tüm sequence export/analiz edildikten sonra kesimler seçimle kesiştiriliyor. Uzun projede kısa bölgeyle çalışmak gereksiz maliyetli.

Çözüm: seçili ses aralıklarını analiz etmek ve çıktıyı timeline koordinatına eşlemek. Basit dosya/normal hız kliplerinde kaynak sesini doğrudan çözmek. Efektli, remap edilmiş veya nested seslerde Premiere render'ına geri dönmek.

Kaynak: `client/js/main.js:340,354,483`; `host/index.jsx:169`.

### 3.8. Analiz panelin ana iş parçacığında senkron çalışıyor

`setTimeout(...,50)` yalnız başlangıçta UI'ı boyatır; `analyzeFile()` ve senkron dosya okumalarını arka plana taşımaz. Büyük kayıt boyunca panel analiz süresince yanıt veremeyebilir. Razor partisi de bu logdaki ortalamayla yaklaşık 3,4 saniyelik host işi yapıyor. Parti başına 20 sınır, kısa blok garantisi vermiyor.

Çözüm: CEP'te uygun worker/yardımcı süreçte ses analizi, ilerleme ve iptal. Host mutasyonlarını paralelleştirmeden, süre bütçesine göre parti boyutu seçmek. Arka plan analizi panel tepkisini iyileştirir; tek başına 186,8 saniyelik timeline işini çözmez.

Kaynak: `client/js/main.js:461,465,529`.

### 3.9. Export ve geçici dosya yaşam döngüsü kırılgan

Sabit `acs_audio.wav` adı oturumları ayırmıyor. Direkt export'ta yalnız dosya varlığı/boyutu kontrol ediliyor. AME'de iki ardışık aynı boyut gözlemi, 1,5 saniyelik polling ile tamamlanmış sayılıyor; yaklaşık üç saniyelik yazma duraklaması tamamlanma değildir. Mute snapshot'ı başlangıç sequence kimliğiyle saklanmıyor.

Çözüm: iş kimliğine özel temp dizini, encoder completion/error olayları, WAV başlığı/veri uzunluğu ve beklenen süre doğrulaması. Başarısız işte temizleme ve başlangıç durumuna geri dönüş.

Kaynak: `client/js/main.js:289,377,410,439`; `host/index.jsx:154,187,135`.

### 3.10. Önizleme ve test kapsamı ürün kalitesini sınırlıyor

Önizleme yalnız renkli HTML şerit. Adayı dinleme, tek tek kabul/ret, timeline marker'ları, kesimden önce/sonra karşılaştırmalı dinleme ve canlı ayar önizlemesi yok. Kesim aralıkları arasında minimum çalışma alanı ve ses geçişleri için ayrı politika bulunmuyor.

Mevcut testler sentetik mono WAV ve hum senaryolarına odaklı. Gerçek konuşma kesilmesi, ters faz, sequence değiştirme, yanlış silme toleransı, kilitli/sparse track, linked hareket, nested klip, farklı kare hızları ve hata sonrası geri yükleme doğrulanmıyor. Manifestte `[22.0,99.9]` yazması bu sürümlerin test edilmiş olduğu anlamına gelmez.

Kaynak: `client/js/main.js:757`; `tools/test-analyzer.js`; `CSXS/manifest.xml`.

## 4. AutoCut karşılaştırması

Resmî kaynaklarda AutoCut; canlı önizleme, minimum kesimler arası mesafe ve J/L-cut, overlap, Constant Power seçenekleri sunuyor. Mevcut panel temel eşik, pacing, pay ve dört işlem modunu zaten kapsıyor; fark, sonucu inceleme/düzeltme ve ses geçişlerinde belirgin. [AutoCut rehberi](https://www.autocut.com/en/blogs/how-to-remove-silences-in-1-minute-with-autocut-update/), [özellik sayfası](https://www.autocut.com/en/autocutsilences/).

9 Temmuz 2026 yazısındaki hız iddiası ses analizinde 9 kata, transkripsiyonda 59 kata kadar iyileşme. Bunlar üreticinin iddiaları; HooDoo Cut'a karşı aynı projeyle ölçülmüş sonuçlar değil. Kesme fazının 59 kat hızlandığı şeklinde kullanılamaz. Kaynaklar AutoCut'ın iç düzenleme algoritmasını açıklamıyor; XML, native SDK veya belirli bir VAD kullandığı doğrulanamadı.

Adil ölçüm iki ayrı deney olmalı: aynı kesim listesiyle yalnız uygulama motoru karşılaştırması; ardından her aracın kendi analizini kullandığı uçtan uca kalite/hız karşılaştırması. Modların aynı olması önemli: boşluk bırakma, kapatma ve geçiş ekleme eşdeğer işler değil.

## 5. Açık kaynak seçenekleri

| Proje | HooDoo Cut için yararı | Sınırı |
|---|---|---|
| [auto-editor](https://github.com/WyattBlue/auto-editor) | En güçlü yeni düzenleme yöntemi referansı: analizden Premiere'e aktarılabilir XML timeline üretme | Ham medya girişinden mevcut Premiere efektlerini otomatik koruma sonucu çıkmaz |
| [Silero VAD](https://github.com/snakers4/silero-vad) | Konuşma olasılığı/timestamp; 8/16 kHz, ONNX ve yerel işlem | Enerji analizinden mutlaka hızlı değildir; hedef doğruluk |
| [DeadAir](https://github.com/Alx8g/deadair-premiere) | CEP, doğrudan kaynak sesini çözme, marker önizlemesi, bir kez referans toplama örneği | Aynı QE razor/remove maliyet sınıfında; track başına tüm boşlukları kapatma heterojen track'lerde güvenli varsayım değil |
| [WebRTC VAD](https://github.com/wiseman/py-webrtcvad) | Hafif VAD karşılaştırma adayı; 10/20/30 ms mono PCM | Gürültülü hedef kayıtlarında Silero'ya karşı ölçülmeli; Python wrapper zorunlu seçim değil |
| [OpenTimelineIO](https://github.com/AcademySoftwareFoundation/OpenTimelineIO) | Timeline/aralık/source mapping ve değişim formatı modellemesi | Ses analizi ve Premiere mutasyon motoru değil; tek platformda ilk adım için gereksiz bağımlılık olabilir |
| [Adobe UXP örnekleri](https://github.com/AdobeDocs/uxp-premiere-pro-samples) | Resmî transaction ve API kullanım örnekleri | Örnekler hız veya tüm klip özelliklerini koruma garantisi değil |

### auto-editor: alınacak mimari fikir

Exporter kaynağında timeline `start/end`, kaynak `in/out`, medya tanımları ve kare hızı bilgileri XML'e yazılıyor. Tutulacak parçaları dışarıda hesaplayıp yeni sequence'i import etmek, her sınırda aktif timeline'ı kesip sonra parçaları silme ihtiyacını kaldırabilir. [FCP7 exporter kaynağı](https://github.com/WyattBlue/auto-editor/blob/master/src/exports/fcp7.nim).

Kaynak kod Unlicense; dağıtılan binary bağımlılıkları ayrıca kontrol edilmeli. [Kaynak lisansı](https://github.com/WyattBlue/auto-editor/blob/master/LICENSE).

### Silero: doğruluk için öncelikli deney

MIT lisanslı konuşma VAD; ONNX ile yerel çalışma mümkün. Üreticinin kısa chunk performansı bu 66 dakikalık proje için ölçüm sayılmaz. GPU şart değil. 16 kHz mono konuşma proxy'si, enerjiye göre yanlış pozitifleri azaltmak için iyi aday. Kısa kelimelerin korunması ve konuşma uçlarının payları Türkçe kayıtlarla ölçülmeli. [Silero](https://github.com/snakers4/silero-vad), [giriş/çıktı ve durum sınırlamaları](https://github.com/snakers4/silero-vad/wiki/FAQ).

### DeadAir: sınırlı referans

Kaynak, klip referanslarını toplama ve `remove(false,false)` yaklaşımını gösteriyor. HooDoo zaten benzer yöntemin önemli kısmını uyguluyor. Daha yararlı fark, kaynağı FFmpeg pipe ile çözmesi ve markers-only önizlemesi. README'deki küçük proje süreleri bu 66 dakikalık projeyle karşılaştırılamaz. Track'lerin önceden var olan boşluklarını da kapatan cursor sweep'i doğrudan alınmamalı. [Host kaynağı](https://github.com/Alx8g/deadair-premiere/blob/master/host/deadair.jsx).

### FFmpeg: çözümleme ve bağımsız doğrulama aracı

Kaynak dosyadan seçili audio stream'i çözmek, resample etmek ve `silencedetect` ile enerji analizi için bağımsız referans üretmek mümkün. `silencedetect` semantik konuşma tespiti değildir; timeline'a kesim uygulamaz. Efektli Premiere miksini kaynak dosyanın ham sesiyle eşdeğer saymamak gerekir. [Filtre belgesi](https://ffmpeg.org/ffmpeg-filters.html#silencedetect). Paketlenecek binary'nin etkin lisansı build seçeneklerine bağlıdır. [FFmpeg dağıtım bilgisi](https://ffmpeg.org/legal.html).

## 6. Sıfırdan nasıl tasarlardım?

### Ortak çekirdek

1. Sequence kimliği ve içeriğini snapshot al.
2. Analiz track'leri ile kesimin uygulanacağı track'leri ayrı tanımla. Kilitler, linkler ve önceden var olan boşluklar planın parçası olsun.
3. Basit normal hız kaynağını doğrudan çöz; Premiere efektlerini yansıtmak gerektiğinde render kullan.
4. Enerji veya VAD'den konuşma/koruma aralıkları çıkar.
5. Padding ve minimum mesafe politikalarını uygula; bütün zamanları tek kare/tick politikasına dönüştür.
6. Medya source in/out ile timeline aralıklarını eşleyip tutulacak parçaların planını oluştur.
7. Marker/dinleme önizlemesi ve adayları hariç tutma olanağı sun.
8. Uygun uygulama yoluyla yeni sequence veya doğrulanan yerinde düzenleme üret.
9. Planlanan/gerçek source mapping, A/V senkronu, süre ve korunacak parçaları karşılaştır; ancak sonra başarılı göster.

Klipte sabit hız varsa source zamanına dönüşüm başlangıç ve source in noktasından hızla hesaplanabilir. Speed ramp, reverse, multicam/nest ve efektlerde bu basit dönüşüm yeterli değildir. Bunlar ilk sürümde açıkça destek kapsamı dışında kalmalı veya güvenilir Premiere render/yerinde düzenleme yoluna yönlenmeli.

### Yol A — basit ham kayıtlar için XML ile yeni sequence

Kaynak kayıt, ekran+mikrofon ve normal hız multiclip senaryolarında önce bunu denerdim. Tutulacak parçalar bellekte hesaplanır; medya tekrar video encode edilmeden XML ile yeni sequence import edilir. Boşluk kalsın modunda kaynak timeline başlangıçları korunur; boşluk kapatma modunda ortak zaman dönüşümü kullanılır. Tüm track'lerde aynı çıkarılan zaman aralıkları uygulanmalı; track başına bağımsız boşluk temizliği yapılmamalı.

En büyük hız potansiyeli burada. Import/conform ve büyük XML maliyetleri yine var; kullanıcı makinesinde ölçüm şart. Mevcut keyframe, efekt, caption, MOGRT, adjustment layer ve nested yapıları eksiksiz taşıdığı varsayılmamalı. Adobe de XML dönüşümünde efekt/geçiş ve ses ayarlarının aktarım sınırlarını belgeliyor. [Adobe XML sınırları](https://helpx.adobe.com/premiere/desktop/render-and-export/export-files/export-a-project-as-a-final-cut-pro-xml-file.html).

### Yol B — mevcut efektli timeline için CEP motorunu iyileştirme

Kesim sınırlarını tekilleştir ve klip sınırında zaten bulunan gereksiz kesimleri ele. Kalibrasyonu sequence başına önbellekle, ayar değişiminde geçersizleştir. Silinecek parçaları tüm aralıklar için bir kez hazırla, sonra iş listesini partiler halinde uygula. Bugünkü silme işi her 60 aralıkta tüm track'lerin klip snapshot'ını yeniden okuyor; bu örnekte yedi tur.

Yüzlerce `remove()` çağrısı devam edeceği için büyük hız garantisi verilemez. DOM okuma, razor çağrısı, remove çağrısı ve UI/undo maliyetlerini ayrı ölçmek gerekir. Çalışma sadece yedek/kopya sequence üzerinde yapılsın; yarım kalan sonucu orijinalin yerine koyma.

### Yol C — Premiere 26.5.2 için UXP prototipi

Resmî API'de `createRemoveItemsAction`, clone/trim işlemleri ve undoable `executeTransaction` var. Çok sayıda klibi bir seçim/transaction ile silmek ve yerinde işlemlerin geri alınmasını düzenlemek için güçlü deney alanı. [SequenceEditor](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/sequenceeditor), [Project transactions](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/project).

Ancak incelenen resmî SequenceEditor referansı genel bir razor/split action göstermiyor. Clone+trim yöntemiyle bölme prototipi; efekt/keyframe, kaynak in/out, nested ve link davranışlarını doğrulamadan mevcut motorun yerine geçmemeli. UXP'ye port etmek kendi başına hız kanıtı değil. API kullanılabilirliği kullanıcının 26.5.2 kurulumunda doğrulanmalı. UXP ayrıca CEP'in Node/DOM ortamıyla aynı değil; mevcut `require('fs')`, CEF ve ExtendScript köprüsü aynen taşınamaz.

### Ses yolunun küçültülmesi

Preset gerçekten 48 kHz, iki kanal. Logdaki 728 MB, 66 dakika 18 saniyelik 16-bit stereo PCM hesabına uyuyor. 16 kHz 16-bit mono aynı süre için yaklaşık 121,4 MiB: veri miktarı altıda bire iner. Bu yalnız analiz kopyasıdır; orijinal medya değiştirilmez. Kanal/faz hatasını önce çözmek gerekir. Export süresinin altıda bire ineceği söylenemez; decode/efekt hesabı devam eder.

Mevcut analiz çıktısının yaklaşık 199 bin dB değeri var. Typed float dizide yaklaşık 0,76 MiB; bunları cache'lemek, pacing/eşik değiştirirken 728 MB WAV'ı tekrar okumayı önler. Worker/yardımcı süreç paneli açık tutar. CEP Node v17.7.2 logu, sisteme yeni Node kurmanın panel runtime'ını değiştirdiğini göstermez.

## 7. Uygulama önceliği ve kabul ölçütleri

| Sıra | İş | Kabul ölçütü |
|---|---|---|
| 1 | Kare bazlı kesin sınırlar; stereo enerji; sequence/revizyon kontrolü; kısmi hata yönetimi | İzole hatalar giderilir; yanlış klip/sequence üzerinde mutasyon yok |
| 2 | Aynı proje kopyasında faz bazlı ölçüm | Export, analiz, host okuma, razor, silme, import ve kapatma ayrı sürelenir |
| 3 | XML ve UXP küçük prototiplerini aynı kesim listesiyle karşılaştırma | Aynı korunacak parçalar; source mapping ve A/V eşleşmesi; toplam süre ve bellek ölçümü |
| 4 | Doğrudan ses çözme, küçük proxy ve ölçüm cache'i | Efektli/ham ses farkı açık; değişiklikte invalidate; tekrar analiz export gerektirmez |
| 5 | Silero/WebRTC/enerji kalite karşılaştırması | Etiketli Türkçe seslerde konuşma kaybı, yanlış koruma ve sınır hatası ölçülür |
| 6 | Önizleme, dinleme, iptal ve kısa fade | Kullanıcı yanlış adayı düzenleme öncesi bulup çıkarabilir |

Benchmark: 3/15/66 dakika; 1V1A ve 3V3A; 100/367/1.000 kesim; sparse/locked track, linked/unlinked klip; normal hız, farklı kaynak in noktaları, efektli ses, nested klip; 23.976/25/29.97 DF/30/59.94 DF/60 fps. Her yol aynı temiz proje kopyasında en az üç kez; soğuk/sıcak cache ayrı, medyan ve en kötü süre raporlanmalı. Analiz motorlarını değiştirirken kesim sayısı değişirse uygulama performansı ayrı değerlendirilmelidir.

Kalite kabulü: korunacak kliplerin source in/out'u doğru, sessizlik dışı parça silinmiyor, linked ses/video aynı dönüşümü izliyor, önceden var olan boşluk politikası korunuyor, seçilmeyen/kilitli track davranışı belirli, başarısız iş orijinali bırakıyor. Geçişler için kaynak handle ve kısa klip sınırları test edilmeli; daha sonra J/L-cut gibi daha büyük özellikler değerlendirilebilir.

Henüz ölçülmüş bir “10 kat hız” sonucu yok. Başarı hedefi, aynı projede aynı veya daha iyi konuşma korunmasıyla uçtan uca sürenin anlamlı düşmesi ve yanlış kesimlerin ortadan kalkması olmalı.

## 8. Yapılan doğrulamalar

- `node tools/test-analyzer.js`: 15 PASS, 0 FAIL, exit code 0. Sistem Node'u üzerinde çalıştırıldı; Premiere içindeki CEP runtime testi değil.
- Mevcut analiz fonksiyonunda bellekte WAV ile ters faz kontrolü: yukarıdaki hata yeniden üretildi.
- Mevcut host silme fonksiyonunda Node VM/mock klip ile 80 ms kapsama kontrolü: sessizlik dışı klip için `remove()` çağrısı yeniden üretildi.
- Mevcut `detectSilences` fonksiyonunda 120 ms ses bölgesi kontrolü: bölge varsayılan kısa-ses filtresiyle sessizliğe katıldı.
- Kodun aktif compactPrepare/compactApply yolu incelendi; dosyadaki eski kompaksiyon fonksiyonuyla karıştırılmadı.
- AutoCut resmî ürün/rehber sayfaları, Adobe UXP/XML belgeleri ve alternatiflerin kaynakları incelendi.
- Uygulama kaynakları, kurulu eklenti veya Premiere projesi değiştirilmedi. Yalnız bu rapor eklendi.

Canlı Premiere performansı, mevcut kullanıcı projesindeki gerçek yanlış kesimler, XML round-trip efekt sadakati ve UXP prototipinin 26.5.2 davranışı henüz doğrulanmadı.
