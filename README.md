# HooDoo Cut — Premiere Pro Sessizlik Kesme Eklentisi

Premiere Pro içinde çalışan, sessiz kısımları otomatik tespit edip kesen CEP paneli.

**0.9.4.0:** Premiere 26.5+ için **Toplu (UXP)** silme motoru eklendi. Plugins menüsünden
**HooDoo Cut Toplu Motor** panelini açık tutun. Video ve ses hedefleri tek silme
transaction'ında işlenir; undo korunur. Canlı hız ölçümü henüz yapılmadı.
Kurulum paketi CEP paneliyle UXP CCX motorunu birlikte içerir.
[Geliştirme ve doğrulama notları](docs/reports/2026-10-06-toplu-motor.md).

ffmpeg **gerektirmez**: sesi Premiere'in kendi export motoru çıkarır, analiz panel
içindeki Node.js ile yapılır.

## Özellikler

- **Otomatik eşik:** ses seviyesi dağılımından gürültü tabanı (dip ses,
  klavye, click) ile konuşma/oyun sesini ayırıp kesme eşiğini kendisi hesaplar.
  Hesaplanan değer kaydırıcıya yansır; kaydırıcı elle oynatılırsa otomatik
  kapanır ve manuel dB kullanılır.
- **Click bağışıklığı:** `minSpeech` süresinden kısa ses patlamaları (klavye tıkı
  vb.) konuşma sayılmaz, sessizliği bölmez. Panelden ms olarak ayarlanır (0 = kapalı).
- **5 kesme şablonu + manuel alanlar:** Sakin / Ölçülü / Tempolu / Enerjik /
  Atlamalı şablona tıklayınca 4 alan dolar (min sessizlik, min konuşma,
  öncesi/sonrası pay); alanlar elle değiştirilirse özel ayar olur
  ([analyzer.js](com.hoodoocut/client/js/analyzer.js) içindeki `MODES`).
- **Analiz sesi seçimi:** sessizlik tespiti istenen ses track'lerine göre yapılır
  (örn. yalnız A1=konuşma; A2=oyun sesi analize girmez). Seçilmeyenler analiz
  export'u sırasında geçici mute edilir, sonra eski haline döner. Kesim yine
  tüm track'lerde uygulanır.
- **Sessizlik yönetimi (4 mod):** Sil ve boşlukları kapat / Sil boşluk kalsın /
  Sustur (ses klipleri disable edilir, süre değişmez) / Sadece kes.
- **Linkler korunur:** native çok-track razor video+ses parçalarını bağlı keser;
  kompaksiyon idempotent taşımayla senkronu korur (ayrı relink adımı gerekmez).
- **Yedek sequence:** işlemden önce otomatik kopya (kapatılabilir).
- **Kesim haritası:** analiz sonrası yeşil/kırmızı önizleme şeridi.
- **Tık ritmi (0.9.5.0):** Mod → Tık ritmi. Seçili bölgede oyun sesindeki blok
  koyma/kırma tıklarını bulur (marker olarak gösterir), her tıktan sonraki arayı
  hızlandırıp/yavaşlatarak tıkları sabit aralığa (sn ya da BPM) oturtur; tık anı
  normal hızda kalır. Ayrıntı: [docs/wiki/HooDoo Cut Tık Ritmi.md](docs/wiki/HooDoo%20Cut%20Tık%20Ritmi.md).
- **Kapsam seçimi:** tüm sequence ya da sadece timeline'da seçili clipler.
  Bölge bölge farklı şablon: bölgeyi seç → şablon → analiz → kes, tekrarla.
- **Parçalı işleme:** uzun videolarda Premiere kilitlenmez; butonda canlı
  ilerleme görünür. Razor, kalibre edilmiş SMPTE timecode hesabıyla hızlandırılır.

## Kurulum (geliştirme)

```powershell
.\install.ps1   # admin gerekmez
```

Sonra Premiere Pro'yu yeniden başlat → **Window → Extensions → HooDoo Cut**.

## Mimari

```
com.hoodoocut/
├── CSXS/manifest.xml      # CEP manifest (PPRO 22+, Node açık, mixed-context)
├── .debug                 # Chrome DevTools: http://localhost:8088
├── client/
│   ├── index.html         # Panel arayüzü (Türkçe)
│   ├── css/style.css
│   └── js/
│       ├── CSInterface.js # Adobe resmi kütüphane (CEP 12)
│       ├── analyzer.js    # WAV stream okuma + RMS dB + oto eşik + tespit (UMD)
│       └── main.js        # Panel mantığı, JSX köprüsü, parçalı kesim orkestrasyonu
├── host/index.jsx         # ExtendScript: export, razor (QE), silme/susturma, yedek
└── assets/wav48k16.epr    # Premiere ses export preseti (AME sistem presetinden)
```

### Akış

1. (İstenirse) seçilmeyen ses track'leri geçici mute edilir.
2. `ACS_exportAudio2` → `sequence.exportAsMediaDirect()` ile ses temp WAV'a
   yazılır (çoklu preset denenir; olmazsa AME kuyruğu yedek plan).
3. `analyzer.js` WAV'ı stream ederek 20 ms pencerelerde RMS dB çıkarır
   (ham örnek tutulmaz → uzun videolarda RAM sorunu yok).
4. Otomatik eşik: p15 (gürültü) ile p85 (konuşma) arasına `gürültü + max(6, %35·fark)`.
5. Tespit: eşik altı bölgeler; `minSpeech`ten kısa blipler sessizliğe yedirilir;
   `minSilence` filtresi; şablon paddingleri.
6. İşlem (parçalı, v0.7): (ops.) yedek → **çok-track razor** (`qeSequence.razor()`
   tek çağrıda tüm track'leri böler, linkleri korur) → moda göre silme / susturma →
   boşluk kapatma = **link-güvenli kompaksiyon** (önce her klibin hedefi hesaplanır,
   sonra her klip mevcut konumuna göre göreli taşınır — idempotent, çift kayma
   imkansız). Unlink/relink YOK: native razor linkleri koruduğu için gerek kalmaz.

## Test (Premiere gerekmez)

```powershell
node tools\test-analyzer.js
node tools\test-regressions.js
node tools\test-panel.js
node tools\test-tick.js
node tools\test-tick-host.js
```

### v0.9.3.5

- Premiere 26.5.2'nin klip silmede dondurdugu `true` basari kabul edilir.
  `0` ve eski host'lardaki `undefined` destegi korunur; `false` ve diger
  hata degerleri islemi durdurur.

### v0.9.3.4

- Stereo kanallar ayrı filtrelenir; en yüksek kanal enerjisi kullanılır.
  Ters fazlı veya tek kanallı konuşma kaybolmaz.
- Kesimler konuşmayı koruyacak şekilde tam karelere hizalanır. Silme ve
  susturma yalnız aralığın içindeki klipleri etkiler; 80 ms taşma kaldırıldı.
- Silinecek/susturulacak klipler bütün aralıklar için bir kez hazırlanır.
- Analiz planı sequence kimliği ve klip yerleşimine bağlanır. Sequence
  değiştirilirse işlem durur. Her analiz yeni, ayrı bir WAV kullanır.
- Yedek, razor, mute geri yükleme ve kompaksiyon hataları işlemi durdurur.
  Mute durumları analiz yapılan track referanslarına geri yüklenir.

İlk doğrulama raporu: [geliştirme ve ölçümler](docs/reports/2026-10-05-gelistirme.md).
Premiere 26.5.2 içinde gerçek proje performansı henüz ölçülmedi. Efekt/gain
değişiklikleri yapıldığında yeniden analiz edin; yapısal kimlik bütün ses
efektlerini ve harici medya dosyası değişikliklerini izlemiyor.

## Bilinen sınırlar / yol haritası

- Boşluk kapatma resmi API kompaksiyonuyla yapılır (QE Empty.remove "Unknown
  error" verdiği için terk edildi). v0.7'de unlink/relink kaldırıldı; kompaksiyon
  idempotent göreli taşımayla çift kaymayı önler.
- **Undo kapatma/temizleme:** ExtendScript'te API'si yok; mümkün değil. Hız
  yalnızca işlem sayısını azaltarak iyileştirilebilir (yapıldı).
- **Performans tavanı:** Premiere'in scripting API'si tek-thread ve işlem başına
  maliyeti yüksek (Adobe'nin kendi mühendisi "kök yavaşlık" diyor). Optimizasyonlar
  bunu azaltır ama sıfırlayamaz; çok uzun videoda silme fazı yine duraksayabilir.
- Çoklu track senaryolarında (bir track'te ses varken diğerinde boşluk)
  boşluk kapatma kısmı sınırlı; "boşluk kalsın" ve "sustur" modları her
  durumda güvenli.

## Hata ayıklama

- Panel DevTools: Premiere açıkken tarayıcıda `http://localhost:8088`
- Panel içi "Günlük" kartı her adımı yazar; Kopyala butonuyla alınabilir.
