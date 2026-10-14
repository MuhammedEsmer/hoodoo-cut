---
type: moc
title: HooDoo Cut — Ana Sayfa
description: HooDoo Cut Premiere Pro eklentisinin LLM-bakımlı bilgi kasası (Map of Content).
tags: [hoodoo, hoodoo-cut, moc, ana-sayfa]
created: 2026-10-11
updated: 2026-10-11
---

# 🗺️ HooDoo Cut Kasası

Premiere Pro içinde sessiz kısımları otomatik tespit edip kesen eklenti:
CEP paneli (analiz + razor) ve Premiere 26.5+ için UXP toplu silme motoru.
Güncel sürümler `com.hoodoocut/CSXS/manifest.xml` ve
`com.hoodoocut.bulk/manifest.json` içindedir. Bakım kuralları: [[CLAUDE]] ·
değişiklikler: [[log]].

## 🧩 Bilgi notları (`wiki/`)

- [[HooDoo Cut]] — ana not: ne yapar, bileşenler, güncel durum (başla buradan)
- [[HooDoo Cut Mimari]] — CEP panel, ExtendScript host, UXP motor, dosya haritası
- [[HooDoo Cut Analiz Motoru]] — WAV export, RMS dB, otomatik eşik, sessizlik tespiti, şablonlar
- [[HooDoo Cut Kesim Akışı]] — razor, silme/susturma modları, kompaksiyon, güvenlik kontrolleri
- [[HooDoo Cut Toplu Motor]] — UXP yardımcı panel, 127.0.0.1 köprüsü, tek transaction silme
- [[HooDoo Cut Tık Ritmi]] — blok tıklarını ızgaraya oturtma: tespit, hız değiştirme, canlı doğrulama
- [[HooDoo Cut Kurulum ve Dağıtım]] — geliştirici kurulumu, Kur.bat paketi, sürüm yayınlama, otomatik güncelleme
- [[HooDoo Cut Test ve Doğrulama]] — Premiere'siz test paketleri, benchmark'lar, canlı kontrol listesi
- [[HooDoo Cut Sürüm Geçmişi]] — 0.9.0 → 0.9.4.0 / motor 0.9.8 kronolojisi
- [[HooDoo Cut Bilinen Sınırlar]] — sınırlar, açık riskler, yol haritası
- [[HooDoo Cut Sözlük]] — CEP, UXP, QE, razor, kompaksiyon…

## 📑 Raporlar (`reports/`)

- [[reports/2026-10-05-teknik-analiz|2026-10-05 Teknik analiz ve yeniden tasarım önerisi]] (v0.9.3.3 incelemesi, AutoCut karşılaştırması, Yol A/B/C)
- [[reports/2026-10-05-gelistirme|2026-10-05 v0.9.3.4 geliştirme ve doğrulama]] (ölçümler: `2026-10-05-*.json`)
- [[reports/2026-10-06-hotfix|2026-10-06 v0.9.3.5 klip silme dönüşü hotfix]]
- [[reports/2026-10-06-toplu-motor|2026-10-06 v0.9.4.0 toplu silme (UXP 0.9.5)]]
- [[reports/2026-10-06-uxp-network-hotfix|2026-10-06 UXP 0.9.6 bağlantı izni]]
- [[reports/2026-10-07-uxp-permission|2026-10-07 UXP 0.9.7 izin ve eski kurulum kaydı]]
- [[reports/2026-10-07-uxp-path-identity|2026-10-07 UXP 0.9.8 Windows proje yolu kimliği]]
- [[reports/2026-10-14-piyano-melodi-ogrenme|2026-10-14 CEP 0.9.8.0 solo piyanodan melodi tespiti + seçenek (c) donma]]

## 🗂️ Planlar (`plans/`)

- [[plans/2026-10-06-toplu-silme|2026-10-06 Toplu silme tasarımı ve uygulama planı]]
- [[plans/2026-10-14-tik-ritmi|2026-10-14 Tık ritmi modu (blok tıklarını ızgaraya oturtma, setSpeed)]]

## 📄 Repo kökündeki belgeler

- `README.md` — kullanıcıya dönük özellik listesi ve kısa mimari
- `DISTRIBUTION.md` — kurulum/yayın adımları (özeti: [[HooDoo Cut Kurulum ve Dağıtım]])
