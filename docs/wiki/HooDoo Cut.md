---
type: proje
title: HooDoo Cut
description: Premiere Pro içinde sessizlikleri otomatik tespit edip kesen eklenti — ana not.
tags: [hoodoo, hoodoo-cut, premiere, cep, uxp]
proje: [hoodoo-cut]
sources:
  - README.md
  - com.hoodoocut/CSXS/manifest.xml
  - com.hoodoocut.bulk/manifest.json
created: 2026-10-11
updated: 2026-10-11
---

# HooDoo Cut

Premiere Pro'da sessiz kısımları bulup kesen eklenti. Hedef: konuşma/oyun
videolarında elle yapılan "boşluk temizleme"yi tek tıka indirmek. Ticari
karşılaştırma hedefi AutoCut Silences'tır
([[reports/2026-10-05-teknik-analiz|teknik analiz]]).

- **Repo:** https://github.com/MuhammedEsmer/hoodoo-cut (public; Releases otomatik güncellemenin kaynağı)
- **Hedef ortam:** Windows, Premiere Pro 26.5.2 (CEP paneli PPRO 22+ destekler)
- **ffmpeg gerekmez:** ses Premiere'in kendi export motoruyla çıkarılır, analiz panelin Node.js'inde yapılır.

## Bileşenler

| Bileşen | Klasör | Sürüm (2026-10-11) | Görevi |
|---|---|---|---|
| CEP paneli | `com.hoodoocut/` | 0.9.4.0 | Arayüz, ses analizi, razor, klasik silme, kompaksiyon |
| UXP toplu motor | `com.hoodoocut.bulk/` | 0.9.8 | Silme aşamasını tek native transaction'da yapar (Premiere 26.5+) |
| Kurulum paketi | `installer/`, `build-installer.ps1` | — | `HooDooCut-Kurulum-vX.Y.Z.zip` (Kur.bat + CEP + CCX) |

Ayrıntı: [[HooDoo Cut Mimari]].

## Kullanıcı akışı

1. Panelde kapsam (tüm sequence / seçili klipler), analiz edilecek ses
   track'leri ve şablon seçilir.
2. **Analiz:** ses temp WAV'a export edilir → dB çıkarılır → otomatik eşik →
   sessizlik aralıkları → yeşil/kırmızı kesim haritası. Bkz. [[HooDoo Cut Analiz Motoru]].
3. **Kes:** (ops.) yedek sequence → çok-track razor → moda göre sil / boşluk
   bırak / sustur / sadece kes → boşluk kapatma. Bkz. [[HooDoo Cut Kesim Akışı]].
4. Silme motoru **Toplu (UXP)** ise silme [[HooDoo Cut Toplu Motor]]'a gider;
   **Klasik (CEP)** elle seçilebilir, otomatik geri dönüş yoktur.

## Güncel durum (2026-10-11)

- 0.9.3.4 doğruluk düzeltmeleri, 0.9.3.5 hotfix, 0.9.4.0 toplu motor ve UXP
  0.9.5→0.9.8 düzeltmeleri `85002f9` ile commit edildi.
- **GitHub Release bilinçli olarak yok** — bu sürüm kullanıcılara otomatik
  güncelleme olarak gitmeyecek (kullanıcı kararı, 2026-10-11).
- UXP ↔ CEP el sıkışması canlı Premiere 26.5.2'de doğrulandı (`Motor 0.9.8 / Toplu motor hazır`).
- **Ölçülmedi:** gerçek timeline'da toplu silme süresi, gerçek undo, nested/multicam davranışı.
  Bkz. [[HooDoo Cut Bilinen Sınırlar]].

## İlgili

[[HooDoo Cut Sürüm Geçmişi]] · [[HooDoo Cut Kurulum ve Dağıtım]] ·
[[HooDoo Cut Test ve Doğrulama]] · [[HooDoo Cut Sözlük]]
