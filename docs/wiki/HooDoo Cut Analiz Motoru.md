---
type: konsept
title: HooDoo Cut Analiz Motoru
description: Sesin export edilmesi, band-pass + RMS dB, otomatik eşik, histerezis ve sessizlik tespiti; kesim şablonları.
tags: [hoodoo, hoodoo-cut, analiz, ses, dsp]
proje: [hoodoo-cut]
sources:
  - com.hoodoocut/client/js/analyzer.js
  - com.hoodoocut/host/index.jsx
created: 2026-10-11
updated: 2026-11-24
---

# HooDoo Cut Analiz Motoru

## 1. Ses çıkarma

- Analize girmeyen ses track'leri `ACS_muteForAnalysis` ile **geçici mute**
  edilir; export sonrası `ACS_restoreMutes` başlangıçtaki track referanslarına
  geri yükler (başarısız geri yükleme hatadır, gizlenmez).
- `ACS_exportAudio2` → `sequence.exportAsMediaDirect()` ile temp WAV (çoklu
  preset denenir; olmazsa AME kuyruğu yedek plan, `ACS_exportAudioAME`).
- 0.9.3.4'ten beri **her analiz yeni, ayrı WAV** kullanır ve bitince siler.
  0.9.3.3'teki süre+klip sayısına dayalı WAV önbelleği kaldırıldı (timeline
  içeriğini temsil etmiyordu).

## 2. dB çıkarma (`computeWindowDb`)

- WAV stream edilir; ham örnek bellekte tutulmaz (uzun videoda RAM sorunu yok).
- Konuşma bandına **band-pass** (RBJ biquad, `hpHz 120`, `lpHz 5000`) — uğultu/hum elenir.
- **20 ms** pencerelerde RMS dB.
- **Stereo:** her kanal ayrı filtrelenir, en yüksek kanal enerjisi alınır
  (0.9.3.4) → ters fazlı veya tek kanallı konuşma kaybolmaz.
- Float WAV'da sonluluk kontrolü yapılır; PCM'de yapılmaz (performans).

## 3. Otomatik eşik (`autoThresholdDb`)

`gürültü = p15`, `konuşma = p85`; eşik = `gürültü + max(6, 0.35 × (konuşma − gürültü))`.
Hesaplanan değer kaydırıcıya yansır; kaydırıcı elle oynatılırsa otomatik kapanır.

## 4. Tespit (`detectSilences`)

- Eşik altı pencereler sessizlik adayıdır; **histerezis** varsayılan 3 dB
  (çift eşik: girişte/çıkışta farklı seviye, sınırda titremeyi önler).
- `minSpeech`'ten kısa ses patlamaları (klavye tıkı vb.) sessizliğe yedirilir — *click bağışıklığı*.
- `minSilence`'tan kısa sessizlikler atılır; şablonun öncesi/sonrası payları uygulanır.
- Kesim sınırları tam kareye hizalanır: başlangıç yukarı, bitiş aşağı (konuşma korunur).

## 5. Nefesler (0.9.9.6 işaretle, 0.9.9.7 kıs; isteğe bağlı)

"Nefesler" seçimi **Dokunma** (varsayılan) değilse, sessizlik analizinden sonra aynı WAV'da nefesler
aranır.

- **İşaretle:** Her nefesin başına `HooDoo nefes` marker'ı konur; hiçbir şey kesilmez.
- **Kıs:** Kes'e basınca, razor'dan önce, analiz sesi track'lerinde her nefese Volume > Level anahtar karesi konur (`ACS_duckBreaths`).
  - Seviye seçenekleri 6 / 12 / 20 dB ya da tam sessiz (varsayılan tam sessiz).
  - 4 doğrusal kare, 20 ms geçiş. Değer, karenin olduğu andaki mevcut değerle çarpılır; nefes içindeki mevcut kareler de kısılır.
  - Kare zamanı klibin medya zamanında: `inPoint + (t − start) × hız`. Ölçek 10^((dB−15)/20).
  - Kilitli track (müzik) atlanır. Kareler klibe bağlı olduğu için razor ve boşluk kapatmadan sonra parçalarla kayar (canlı doğrulandı).
  - Görüntüye dokunulmaz.
- **Sil kaldırıldı** (kullanıcı kararı, 2026-11-24): Kullanıcının konuşmasında nefes + çevresindeki sessizlik ortanca 0.41 sn. Sessizlik kesimine katma 264 nefesin yalnız 15'ini yakalıyordu.

- **Model:** Respiro-en (MIT, Conformer + BiLSTM). Panelde ONNX Runtime Web 1.31.1, WASM, tek iş parçacığı (`client/lib/respiro`, 25.6 MB; kaynak `tools/respiro`).
- **Yükleme:** Yükleyici pakete gömülü. `.wasm` ve model bellekten verilir. Dosya yolundan `import()` ile yükleyen giriş CEP 12 panelini çökertti.
- **Girdi** (`respiroFeatures`): 16 kHz, n_fft 400 (karışık tabanlı FFT), hop 160, 128 Slaney mel, dB (ref = parçanın en büyüğü, top_db 80), mel varyansı, sıfır geçiş oranı. Python/librosa tanımıyla fark ≤ 0.001 dB.
- **Parçalama** (`detectBreaths`): 25 sn parça + iki yanda 2.5 sn bağlam, ortadaki kareler alınır; tamamen sessiz parça atlanır.
- **Nefes kuralı** (`breathSegments`): olasılık > 0.064, en az 21 kare (0.21 sn).
- **Süre:** Bitene kadar analiz WAV'ı silinmez ve "Kes" kapalıdır, çünkü marker'lar analiz anındaki zamana konur.
- **Canlı ölçüm** (2026-11-24, 57 dk kayıt, yalnız mikrofon A1): 265 nefes, 55 sn. Kullanıcı eşit aralıklı 40 örneği dinledi: hepsi nefes.
- Ayrıntı: [[reports/2026-11-24-nefes-tespiti-arastirma|nefes raporu]].

## Şablonlar (`MODES`)

| Şablon | min sessizlik | öncesi pay | sonrası pay | min konuşma |
|---|---:|---:|---:|---:|
| Sakin | 0.80 s | 0.40 s | 0.40 s | 0.20 s |
| Ölçülü (varsayılan) | 0.60 | 0.30 | 0.30 | 0.18 |
| Tempolu | 0.45 | 0.20 | 0.20 | 0.15 |
| Enerjik | 0.30 | 0.12 | 0.12 | 0.12 |
| Atlamalı | 0.20 | 0.05 | 0.05 | 0.10 |

Alanlar elle değiştirilirse "özel ayar" olur.

## Plan kimliği

Analiz planı sequence'in **yapısal imzasına** bağlanır (proje yolu, sequence
kimliği, timebase, süre, klip kimlikleri/kaynakları/zamanları, hız,
mute/lock/disabled). Export öncesi/sonrası ve kesimden önce doğrulanır;
uyuşmazsa işlem durur. Gain/efekt/keyframe değişikliklerini izlemez → bunlardan
sonra yeniden analiz gerekir.

## Ölçüm

120 s 48 kHz stereo WAV'da okuma+filtre+enerji medyanı 0.9.3.3: 91 ms →
0.9.3.4: 123 ms (+%35, stereo doğruluğunun bedeli). Kaynak:
[[reports/2026-10-05-gelistirme|0.9.3.4 raporu]].

## Değerlendirilen alternatifler

Silero VAD / WebRTC VAD, 16 kHz mono analiz kopyası, dB önbelleği, worker'da
analiz — bkz. [[reports/2026-10-05-teknik-analiz|teknik analiz]] §5–7 ve
[[HooDoo Cut Bilinen Sınırlar]].
