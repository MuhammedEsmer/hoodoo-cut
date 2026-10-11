---
type: referans
title: HooDoo Cut Sözlük
description: Projede geçen Premiere/Adobe ve ses terimlerinin kısa açıklamaları.
tags: [hoodoo, hoodoo-cut, sözlük]
proje: [hoodoo-cut]
created: 2026-10-11
updated: 2026-10-11
---

# HooDoo Cut Sözlük

- **CEP** — Adobe'nin eski panel teknolojisi: Chromium + Node.js; timeline'a ExtendScript üzerinden erişir. Ana panel bu.
- **UXP** — Adobe'nin yeni eklenti platformu; Premiere 25+'ta modern JS API. Toplu motor bu ([[HooDoo Cut Toplu Motor]]).
- **ExtendScript / JSX** — Adobe'nin ES3 tabanlı script dili; `host/index.jsx`.
- **QE DOM** — Premiere'in belgelenmemiş iç API'si (`app.enableQE()`); razor ve kilit okuma için kullanılır.
- **Razor** — klibi bir zaman noktasında bölmek. Çok-track razor tüm track'leri tek çağrıda böler.
- **Kompaksiyon** — silmeden sonra kalan boşlukları klipleri sola kaydırarak kapatmak.
- **Ripple** — silinen yerin sonrasını otomatik kaydıran düzenleme; toplu motorda kapalı.
- **Linked klip** — birlikte hareket eden video+ses parçaları.
- **AME** — Adobe Media Encoder; export için yedek kuyruk.
- **UPIA** — Unified Plugin Installer Agent; CCX'i kuran Adobe aracı (`/install`, `/list all`, `/remove`).
- **CCX** — UXP eklenti paketi.
- **ZXP** — imzalı CEP eklenti paketi (isteğe bağlı).
- **PlayerDebugMode** — imzasız CEP panellerinin yüklenmesine izin veren registry anahtarı.
- **RMS dB** — pencere içindeki ortalama enerjinin desibel değeri.
- **Band-pass** — belirli frekans aralığını (burada ~120–5000 Hz konuşma bandı) geçiren filtre.
- **Histerezis** — giriş ve çıkış için farklı eşik; sınırda açılıp kapanma titremesini önler.
- **p15 / p85** — dB dağılımının %15 ve %85 yüzdelikleri (gürültü tabanı / konuşma seviyesi).
- **VAD** — Voice Activity Detection; ML/istatistik tabanlı konuşma tespiti (Silero, WebRTC).
- **Extended-path (`\\?\`)** — Windows uzun yol öneki; UXP proje yolunu bu biçimde döndürür.
