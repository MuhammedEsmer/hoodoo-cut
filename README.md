# HooDoo Cut — Premiere Pro Sessizlik Kesme Eklentisi

Premiere Pro içinde çalışan, sessiz kısımları otomatik tespit edip kesen CEP paneli.

ffmpeg **gerektirmez**: sesi Premiere'in kendi export motoru çıkarır, analiz panel
içindeki Node.js ile yapılır.

## Özellikler

- **Otomatik eşik (AI):** ses seviyesi dağılımından gürültü tabanı (dip ses,
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
```

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
