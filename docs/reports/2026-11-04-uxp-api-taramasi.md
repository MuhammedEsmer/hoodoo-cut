---
type: rapor
title: 2026-11-04 UXP API taraması — HooDoo Cut'a ne yarar
description: Premiere UXP API'sinde razor yok; tık ritmi taşımaları, marker, tık sesi yerleştirme, susturma ve Premiere'in konuşma tanıması UXP'ye alınabilir.
tags: [hoodoo, hoodoo-cut, uxp, araştırma]
proje: [hoodoo-cut]
sources:
  - https://developer.adobe.com/premiere-pro/uxp/ppro-reference/
  - https://developer.adobe.com/premiere-pro/uxp/changelog/
  - com.hoodoocut/host/index.jsx
created: 2026-11-04
updated: 2026-11-04
---

# UXP API taraması (2026-11-04)

Kullanıcı: toplu (UXP) motor "çok iyi çalışıyor"; kesme (razor) adımı da UXP'ye alınabilir mi?
Kaynak: Adobe Premiere UXP başvuru sayfaları ve changelog (son girdi 26.5.0). Kod denemesi yapılmadı;
aşağıdakiler belgelerde yazanlardır.

## Razor: yok

- `SequenceEditor`, `VideoClipTrackItem`, `AudioClipTrackItem`, `TrackItemSelection` ve changelog'da
  klibi bir noktadan bölen komut yok. (`Track` sayfası 404 verdi; doğrulanmadı.)
- Dolaylı yol: `createCloneTrackItemAction` ile kopya + `createSetInPointAction`/`createSetOutPointAction`/
  `createSetStartAction`/`createSetEndAction` ile kırpma. Belgede yazmayanlar: kopyanın aynı işlemde
  kırpılabilmesi (action yeni klibi döndürmüyor), kopyada görüntü–ses bağının korunması.
- **Kullanıcı kararı:** "doğrudan bölen komut yoksa yapmaya gerek yok". Razor CEP/QE'de kalır.

## İşe yarayacaklar

| HooDoo Cut'ta bugün (CEP) | UXP karşılığı | Kazanç | Belirsiz |
|---|---|---|---|
| Tık ritmi: klip klip `move` (87.7 sn videoda 861 taşıma) | `TrackItem.createMoveAction(TickTime)`, `createSetStartAction`/`createSetEndAction` | Tek işlem, tek Ctrl+Z; süre kazancı ölçülmedi | Kare arası (alt kare) konum kabul edilir mi |
| Tık ritmi marker'ları: `seq.markers.createMarker` tek tek | `Markers.getMarkers(seq)` → `createAddMarkerAction(name, type, start, duration, comments)`, `createSetColorByIndexAction` | Tek işlem | — |
| Tık sesi dilimleri: tek tek `overwriteClip` | `SequenceEditor.createOverwriteItemAction(projectItem, time, vIdx, aIdx)` + `ClipProjectItem.createSetInOutPointsAction` (26.5'te düzeltildi) | Tek işlem | Aynı işlemde in/out değiştirip art arda yerleştirme sırası korunur mu |
| Sustur modu: `clip.disabled = true` tek tek | `createSetDisabledAction(true)` | Tek Ctrl+Z | — |
| Konuşma tespiti: ses yüksekliği sezgisi (VAD değil) | `Transcript.transcribeClipProjectItem(clip, {language})`, `exportToJSON(clip)`, `querySupportedLanguages()`, `hasTranscript()` | Premiere'in kendi konuşma tanıması: kelime sınırında kesim, dolgu sesleri ("eee") | JSON'da kelime zamanları var mı yazmıyor; Türkçe dil paketi; kaynak klip bazlı (sequence değil) |
| Kesim yerinde kısa ses geçişi (yol haritası) | `ComponentParam.createAddKeyframeAction` / `createKeyframe` | Fade tek işlemde | Ses seviyesi hangi bileşen, belgede yok; ses geçişi (crossfade) API'si yok |

## İşe yaramayanlar

- **Export:** CEP zaten `exportAsMediaDirect` (Premiere içinde, AME'siz) kullanıyor; UXP
  `EncoderManager.exportSequence(..., ExportType.IMMEDIATELY, ...)` aynı işi yapar, in/out aralığı belgede yok.
- **Yedek sequence:** CEP `seq.clone()` yeterli; UXP `Sequence.createCloneAction()` aynısı.
- **Hız (setSpeed):** UXP'de yok, yalnız `getSpeed()`. Tık ritmindeki hız değişimi CEP/QE'de kalır.
- **Track kilidi:** UXP'de okuma yok (yalnız `LOCK_CHANGED` olayı); CEP `ACS_trackLocked` kalır.
- Not: 26.3'ten beri `create*Action` çağrıları `project.lockedAccess(() => …)` içinde yapılmalı.
