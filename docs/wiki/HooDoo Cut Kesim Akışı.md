---
type: konsept
title: HooDoo Cut Kesim Akışı
description: Yedek, çok-track razor, silme/susturma modları, link-güvenli kompaksiyon ve güvenlik kontrolleri.
tags: [hoodoo, hoodoo-cut, kesim, razor, extendscript]
proje: [hoodoo-cut]
sources:
  - com.hoodoocut/client/js/main.js
  - com.hoodoocut/host/index.jsx
created: 2026-10-11
updated: 2026-10-11
---

# HooDoo Cut Kesim Akışı

Kesim **parçalı** (partiler halinde) yürür; Premiere kilitlenmez, butonda canlı
ilerleme görünür. Sıra:

1. **Ön kontrol:** plan kimliği ([[HooDoo Cut Analiz Motoru#Plan kimliği]]),
   kilitli track (`ACS_trackLocked`; belirsizse durur), toplu mod seçiliyse
   UXP motorunun bağlı ve aynı proje/sequence'i görmesi. Bu kontroller **razor'dan önce** yapılır.
2. **Yedek sequence** (`ACS_backupSequence`, kapatılabilir). Hata → işlem durur.
3. **Çok-track razor:** `qeSequence.razor()` tek çağrıda tüm track'leri böler,
   linkleri korur. Kalibre SMPTE timecode hesabıyla hızlandırılmıştır.
   Hâlâ baskın maliyettir (kullanıcı logunda 734 çağrı / ~127 s).
4. **Hazırlık:** tüm sessizlik aralıkları için hedef klipler **bir kez**
   bulunur (`ACS_prepareClipAction`); aralığı aşan klip varsa silme başlamaz.
   0.9.3.4'te silme aşamasındaki start/end okumaları %77 azaldı.
5. **Uygulama (moda göre):**
   - *Sil ve boşlukları kapat* · *Sil, boşluk kalsın* · *Sustur* (ses klipleri
     disable, süre değişmez) · *Sadece kes*.
   - Silme motoru: **Toplu (UXP)** → [[HooDoo Cut Toplu Motor]]; **Klasik (CEP)** → partiler halinde `ACS_applyClipAction`.
6. **Boşluk kapatma = link-güvenli kompaksiyon** (`ACS_compactPrepare` /
   `ACS_compactApply`): önce her klibin hedefi hesaplanır, sonra her klip
   mevcut konumuna göre göreli taşınır — idempotent, çift kayma imkânsız.
   Unlink/relink yok (v0.7'de kaldırıldı).

## Kararlar

- **QE `Empty.remove` terk edildi** — "Unknown error" veriyordu; resmi API kompaksiyonu kullanılır.
- **Silme toleransı 80 ms → 1 µs** (0.9.3.4): eski tolerans sessizlik dışı kısa klibi de siliyordu.
- **Kısmi hata başarı sayılmaz:** yedek, razor, mute geri yükleme, kompaksiyon hataları işlemi durdurur.
- **Silme dönüşü:** `0`, `undefined` ve Premiere 26.5.2'nin döndürdüğü `true`
  başarıdır; `false`/diğer değer/exception durdurur (0.9.3.5, [[reports/2026-10-06-hotfix|hotfix]]).
- **Undo kapatılamaz/temizlenemez** — ExtendScript'te API yok; hız yalnız işlem sayısını azaltarak artar.

## Kapsam

Tüm sequence ya da timeline'da seçili klipler. Bölge bölge farklı şablon:
bölgeyi seç → şablon → analiz → kes, tekrarla. Analiz track'i seçimi yalnız
tespiti etkiler; kesim tüm track'lerde uygulanır.
