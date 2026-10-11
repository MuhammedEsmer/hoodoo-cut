---
type: konsept
title: HooDoo Cut Mimari
description: CEP paneli, ExtendScript host, UXP toplu motor ve aralarındaki köprüler; dosya haritası.
tags: [hoodoo, hoodoo-cut, mimari, cep, uxp, extendscript]
proje: [hoodoo-cut]
sources:
  - com.hoodoocut/CSXS/manifest.xml
  - com.hoodoocut/client/js/main.js
  - com.hoodoocut/host/index.jsx
  - com.hoodoocut/client/js/bulk-bridge.js
  - com.hoodoocut.bulk/
created: 2026-10-11
updated: 2026-10-11
---

# HooDoo Cut Mimari

Üç çalışma ortamı var:

1. **CEP panel (Chromium + Node.js)** — arayüz ve hesaplama. Node açık,
   mixed-context (`manifest.xml`, CSXS 11, PPRO `[22.0,99.9]`).
2. **ExtendScript host** (`host/index.jsx`) — Premiere DOM ve QE üzerinden
   timeline'a dokunan tek yer. Panel `CSInterface.evalScript` ile `ACS_*`
   fonksiyonlarını çağırır.
3. **UXP toplu motor** (`com.hoodoocut.bulk/`) — Premiere 26.5+ UXP paneli;
   silme işini tek native action/transaction ile yapar. CEP'e yerel HTTP ile bağlanır.

```
CEP panel (main.js) ──evalScript──► host/index.jsx (DOM + QE)
      │  analyzer.js (Node, WAV okuma)
      │
      └─ bulk-bridge.js  HTTP sunucu 127.0.0.1:51373
              ▲  /hello → token, /poll → iş, /result → sonuç
              │
        UXP panel (main.js, network.js, engine.js)
```

## Dosya haritası

| Dosya | Görev |
|---|---|
| `com.hoodoocut/client/index.html`, `css/style.css` | Panel arayüzü (Türkçe) |
| `client/js/main.js` | Panel mantığı, JSX köprüsü, parçalı kesim orkestrasyonu, `ACS_VERSION` |
| `client/js/analyzer.js` | WAV stream okuma, band-pass, RMS dB, otomatik eşik, tespit (UMD — Node testlerinde de yüklenir) |
| `client/js/update.js` | GitHub Releases kontrolü ve tek-tık güncelleme |
| `client/js/bulk-bridge.js` | UXP motoru için yerel HTTP iş köprüsü |
| `client/js/CSInterface.js` | Adobe resmi CEP kütüphanesi |
| `host/index.jsx` | Export, razor (QE), silme/susturma, kompaksiyon, yedek, kimlik/plan |
| `assets/wav48k16.epr` | Ses export preseti (48 kHz 16-bit) |
| `.debug` | DevTools portu 8088 (pakete girmez) |
| `com.hoodoocut.bulk/manifest.json` | UXP manifest v5, `premierepro` min 26.5.0, `network.domains: "all"` |
| `com.hoodoocut.bulk/engine.js` | Plan eşleştirme + `createRemoveItemsAction` + transaction |
| `com.hoodoocut.bulk/network.js` | Yalnız 3 yola, sabit adrese fetch; redirect `error` |

## Host fonksiyon grupları (`host/index.jsx`)

- **Ortam/seçim:** `ACS_ping`, `ACS_getEnv`, `ACS_getSelection`, `ACS_getAnalysisContext`
- **Analiz export'u:** `ACS_muteForAnalysis`, `ACS_restoreMutes`, `ACS_exportAudio2` (yedek: `ACS_exportAudioAME`)
- **Razor:** `ACS_razorBatch`, `ACS_razorTracksAtTimecode`, `ACS_frameToTimecode`
- **Düzenleme oturumu:** `ACS_beginEdit`, `ACS_checkEditSequence`, `ACS_endEdit`, `ACS_backupSequence`
- **Klasik silme/susturma:** `ACS_prepareClipAction`, `ACS_applyClipAction`
- **Toplu motor planı:** `ACS_getBulkIdentity`, `ACS_getBulkPlan`
- **Kompaksiyon:** `ACS_compactPrepare`, `ACS_compactApply`
- **Kilit:** `ACS_trackLocked` (DOM vermezse QE'den okur)

> [!note] Eski kod
> `ACS_unlinkAll`, `ACS_relinkBatch`, `ACS_closeGapsBatch`, `ACS_tryRemoveGap`,
> `ACS_findAndRemoveGap`, `ACS_removeBatch` vb. eski yolların kalıntılarıdır;
> aktif kompaksiyon `compactPrepare/compactApply`'dır (teknik analizde doğrulandı).

## İlgili

[[HooDoo Cut Analiz Motoru]] · [[HooDoo Cut Kesim Akışı]] · [[HooDoo Cut Toplu Motor]]
