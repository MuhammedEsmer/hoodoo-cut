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
updated: 2026-10-11
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
