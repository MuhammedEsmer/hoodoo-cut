---
type: rapor
title: 2026-11-24 Nefes tespiti araştırması
description: Profesyonel araçlar nefesi nasıl bulur ve işler, ölçülmüş nefes istatistikleri, açık kaynak tespit modelleri; HooDoo Cut için seçilen yön.
tags: [hoodoo, hoodoo-cut, nefes, araştırma]
proje: [hoodoo-cut]
sources:
  - com.hoodoocut/client/js/analyzer.js
created: 2026-11-24
updated: 2026-11-24
---

# Nefes tespiti araştırması (2026-11-24)

İş: [[HooDoo Cut Bilinen Sınırlar#Yapılacaklar (kullanıcı istekleri)|nefes kesme]] 1. adım (marker).
Araştırma iki alt ajanla yapıldı; aşağıdakiler onların kaynaklarıyla birlikte özetidir. "Doğrulanamadı"
yazanlar kaynağa erişilemedi.

## Sorular

1. Profesyonel araçlar nefesi nasıl bulur, ne yapar (sil / kıs), varsayılanları ne?
2. Nefesin ölçülmüş özellikleri (süre, konuşmaya göre seviye, frekans)?
3. Hazır açık kaynak tespit modeli var mı, panelde (JS, CPU) çalışır mı?

## Bulgular

**Araçlar**

- **iZotope RX Breath Control:**
  - Nefesi seviyeden bağımsız, yapısından tanır. RX 12'de sinir ağına geçti
    ([RX9 kılavuzu](https://s3.amazonaws.com/izotopedownloads/docs/rx9/en/breath-control/index.html),
    [RX 12 duyurusu, 2026-05-14](https://www.izotope.com/community/blog/rx-12)).
  - "Gain" modu her nefesi sabit dB kısar (kılavuz: doğal olmayabilir). "Target" modu yalnız eşikten yüksek nefesleri kısar (kılavuz: daha doğal).
  - "Output Breaths Only" ile bulunanlar dinlenir. Varsayılan değerler doğrulanamadı.
- **Waves DeBreath** ([kılavuz](https://assets.wavescdn.com/pdf/plugins/debreath.pdf)):
  - Nefes şablon veritabanı + enerji eşiği (varsayılan −30 dB). Fade 5 ms.
  - "20–40 dB kısma çoğu zaman yeter" diyor. Waves makalesi ([2023-11-08](https://www.waves.com/how-to-debreath-vocals-without-manual-editing)) susturmak yerine birkaç dB kısmayı öneriyor.
- **Auphonic** ([2023-11-29](https://auphonic.com/blog), [2024-05-16](https://auphonic.com/blog)):
  - Nefes sesleriyle eğitilmiş model; nefesi keser değil susturur.
  - Seçenekler 3–100 dB. "100 dB tam silme garip, doğal olmayan duraklamalar yapar" diyor; örneği 12 dB ("orta").
- **Adobe:** Premiere'in metin tabanlı düzenlemesi dolgu kelimeleri ve duraklamaları bulur. Nefese özel bir araç bulunamadı; Enhance Speech'in nefese etkisi doğrulanamadı. Audition'ın sessizlik araçları yalnız seviye ve süreye bakar.
- **Editör tavsiyesi:** Nefesi tamamen silme, insanlar nefes alır; bir kesimden sonra iki nefesi yan yana bırakma; kesimi nefesten sonra yap (KALW eğitimi; Sound On Sound, 2023-01).

**Ölçülmüş nefes özellikleri**

- **[Trouvain, Werner, Möbius 2020](https://doi.org/10.21437/SpeechProsody.2020-161)** (20 konuşmacı, Almanca):
  - Duraklamaların çoğunda nefes var. Nefes ortalama 291–441 ms, çoğu 200–600 ms.
  - Nefesin iki yanında ortalama 23–96 ms sessizlik var.
  - Nefes, önceki ve sonraki 2 sn'lik konuşmadan 16–29 dB kısık. Spektral ağırlık merkezi 2 kHz'in altında.
  - Ünsüz aspirasyonu 60 ms'den kısa ve yalnız 7–13 dB kısık; bu yüzden nefesten ayrılabilir.
- Podcast nefesleri ortalama 0.37–0.40 sn (Székely ve ark., ICASSP 2019).
- BreathBase'deki 5070 nefesin %90'ından fazlası 600 ms'den kısa
  ([Zenodo 3841039](https://zenodo.org/records/3841039), CC BY 4.0).

**Yöntemler**

| Yöntem | Doğruluk |
|---|---|
| Ruinskiy & Lavner 2007: MFCC şablonu + sınır tespiti ([doi](https://doi.org/10.1109/TASL.2006.889750)) | Doğru tanıma %98, özgüllük %96 |
| Interspeech 2019: önce VAD, yalnız konuşma dışında SVM | F1 %94 |
| Yang/Koriyama/Saito, Interspeech 2024, Respiro-en: Conformer + BiLSTM, log-mel + ZCR ([arXiv 2402.00288](https://arxiv.org/abs/2402.00288)) | IoU 0.836, kesinlik 0.924, duyarlılık 0.897 |
| Respiro'nun kural tabanlı etiketleri (sözcük boşluğu + spektral kurallar) | Kesinlik 0.98, duyarlılık **0.45** |

Sonuç: Yalnız kurallarla yapılan tespit çok nefes kaçırıyor.

## Prior art

| Proje | Lisans | Güncel | Bizde yok | Onda yok | Karar |
|---|---|---|---|---|---|
| [Respiro-en](https://github.com/ydqmkkx/Respiro-en) | MIT | 2024-09 | Eğitilmiş model, yayımlanmış ölçüm | Premiere entegrasyonu, Türkçe ölçüm | **Kullan:** hazır [ONNX](https://huggingface.co/pbTechLab/respiro-en-onnx) (MIT, 11.9 MB) panelde onnxruntime-web ile, Basic Pitch gibi |
| [field-debreath](https://github.com/timcarpe/field-debreath) | MIT | 2026-10 | Respiro + spektral kısma | Ölçüm yok, yalnız Python | Örnek al (kısma kısmı, 2. adım) |
| [editto](https://github.com/iwantthesky/editto) | MIT / CC BY 4.0 | 2026-09 | 19 özellikli küçük sınıflandırıcı | Yayımlanmış ölçüm yok | Yedek: model yavaşsa bu tarz hafif sınıflandırıcı |
| [BreathSoundDetection](https://github.com/kmiyasararafath/BreathSoundDetection) | GPL-3.0 | 2024-06 | Silero boşluğu + BiLSTM | Az kullanıcı | Kullanma |

Silero VAD (MIT): Nefesi konuşma sayıp saymadığı belgede yok. Yayımlanmış iki yöntem de nefesi yalnız konuşma dışı boşluklarda arıyor.

## Seçilen yön ve neden

- **Model:** Respiro-en ONNX. Aynı model hem çevrimdışı referans hem panel tespiti olur; iki ayrı yöntem bakımı olmaz.
- **Özellikler:** Modelin girdisi Python'da birebir yazılır (log-mel, ZCR, mel varyansı); sonra JS'e taşınır.
- **Hız:** Panelde modeli tüm 60 dakikaya değil, yalnız konuşma kenarlarındaki adaylara (cümle başı ve sonu ±1 sn) uygulamak hızı kurtarır.
- **Kural yolu:** Bugünkü kural tabanlı taslak (`detectBreaths`) modelle karşılaştırılır. Modele yakın çıkarsa (hızlı ve basit) o kalır.
- **2. adım için not:** Varsayılan işlem silmek değil 12 dB civarı kısmak olmalı; silme isteğe bağlı. Kesimlerde 5–20 ms fade.

## Sonuç: kullanıcının kaydında (2026-11-24)

**Kayıt**

- `Videos\2026-11-24 14-28-13.mkv`, 57 dk. Mikrofon Track 1'de; Track 2 oyun sesi.
- Mikrofon bir gürültü kapısından geçiyor: konuşma dışında tam sıfır (%43 kare). Nefesler genelde cümle sonundan sonra, kapı kapanmadan önce.

**Referans (Python)**

- Özellikler torch CUDA'da hesaplandı, model onnxruntime-gpu 1.23.2 ile çalıştı (1.32 CUDA 13 istiyor; torch CUDA 12).
- 57 dk 14 sn sürdü. 271 nefes; ortanca 0.33 sn (p10 0.26, p90 0.45).

**Kural taslağı ile karşılaştırma**

- Kural 760 aday buldu. Modelin nefeslerinin %97'sini kapsıyor ama adayların yalnız %35'i modelle örtüşüyor.
- Spektrogram örneklerinde kuralın fazlaları: son kelimenin sönümü, ağız şıklatması, konuşmanın içi. Kural bırakıldı.

**Kullanıcı kontrolü**

- 271 nefes içinden eşit aralıklı 40 örnek, önünde 0.5 sn bağlamla, bip ayraçlı bir dinleme dosyasına kondu.
- Kullanıcı: "hepsinde nefes sesi var" (40/40).

**JS hattı** (`analyzer.respiroFeatures` / `detectBreaths`)

- Girdi Python'la aynı: en büyük fark 0.001 dB; 27.5 sn için 74 ms.
- Tam kayıtta 264 nefes (Python 271), 262'si ortak, başlangıç farkı ortanca 0 ms. Farkın kaynağı yeniden örnekleyici.
- Süre (Node 24, tek iş parçacığı): 51.7 sn, bunun 36 sn'si model.

**ONNX Runtime Web panelde**

- CEP 12 = NW.js, Chrome 99, Node 17.7.2; SharedArrayBuffer yok, yani tek iş parçacığı.
- `ort.node.min.js` girişi yükleyiciyi `import()` ile alıyor. Panelde denenince sayfa çöktü ve yeniden yüklendi; Premiere ve proje etkilenmedi.
- Bunun yerine `ort.wasm.bundle.min.mjs` (yükleyici gömülü) esbuild ile CJS'e çevrildi. `.wasm` `env.wasm.wasmBinary` ile, model bayt olarak verildi.
- Taşınabilir Node 17.7.2'de çalışıyor: yükleme 6.6 sn, 27.5 sn ses 0.27 sn, Python ile fark 2e-6.
- **Panelde doğrulanmadı.**

**Paket boyu:** `client/lib/respiro` 25.6 MB (wasm 14.2 MB + model 11.3 MB).

## Açık kalanlar

- Panelde canlı doğrulama (Premiere boşken). Çökme `import()` kaynaklı değilse sebep yeniden aranacak.
- Seçili bölge kapsamında tüm dosya işleniyor; yalnız seçim aralığını işlemek süreyi kısaltır.
- 2. adım (sil / kıs): araştırmaya göre varsayılan kısma (~12 dB), silme isteğe bağlı.
