---
type: referans
title: HooDoo Cut Sürüm Geçmişi
description: CEP paneli ve UXP toplu motor sürümlerinin kronolojisi.
tags: [hoodoo, hoodoo-cut, sürüm, changelog]
proje: [hoodoo-cut]
sources:
  - com.hoodoocut/CSXS/manifest.xml
  - com.hoodoocut.bulk/manifest.json
  - README.md
created: 2026-10-11
updated: 2026-10-11
---

# HooDoo Cut Sürüm Geçmişi

En yeni en üstte. Ekim 2026 işleri (0.9.3.4 → 0.9.4.0 / motor 0.9.8) tek
commit'te toplandı: `85002f9` (2026-10-11).

> [!important] Release yok
> 0.9.4.0 için GitHub **Release bilinçli olarak oluşturulmadı** (kullanıcı
> kararı, 2026-10-11): kullanıcılara otomatik güncelleme gitmesin. Release
> açılmadıkça panel güncelleme bildirimi göstermez.

| Tarih | CEP | UXP motor | Commit | Özet |
|---|---|---|---|---|
| 2026-10-14 | 0.9.9.2 | 0.9.9 | `fcee826` | **Tık sesleri ayrı** (tam hız, notaya örnek hassasiyetiyle, yeni ses track'i; asıl oyun sesi silinir); **vuruşa hızlanarak gir** (tıktan önceki 0.1 sn normal); **Demucs** seçeneği (piyano/davulsuz kanal, `tools/setup-ml.ps1`); tık atağı 1 ms çözünürlük. Canlı piyano: tık sesi-nota medyan 0.0 ms, Kong'a göre 10 ms içinde %82. Paket `HooDooCut-Kurulum-v0.9.9.2.zip` (SHA-256 `D56AE15C…3EC18F30`). Release yok |
| 2026-10-14 | 0.9.9.1 | 0.9.9 | `d11a769` | Tık **sesi** notaya hizalanır (kare içi kayma; tek yuvarlama): piyano medyan hata 8.8 → 5.7 ms, 10 ms içinde %62 → %76; In the End %99. Dosya sonrası sessizlik analiz edilmez (25.5 → 10.2 sn). Paket `HooDooCut-Kurulum-v0.9.9.1.zip` (SHA-256 `DAA327F5…9DBB7AB`). Canlı doğrulandı. Release yok |
| 2026-10-14 | 0.9.9.0 | 0.9.9 | `9694c2b` | **Melodi notaları Spotify Basic Pitch ile** (panelde TF.js WASM, `client/lib/basicpitch`, 4.2 MB; eski DSP yedek). Kong referansıyla solo piyano F1 0.85 → 0.97, zaman hatası 9.9 → 4.4 ms. Canlı: piyano donma 1.1 sn, In the End 4.1 sn, görünür fazla blok yok. Paket `HooDooCut-Kurulum-v0.9.9.0.zip` (1.2 MB, SHA-256 `DE7F604C…466006`). Release yok |
| 2026-10-14 | 0.9.8.1 | 0.9.9 | `6d33228` | **Donma azaltıldı:** donma pahalı (DP tık düşürüp keser), fazla tıklar arası temiz bölümler kullanılır, hafif ağır çekim (≥ %70), kesim fazla tıktan 1 kare önce / 175 ms sonra. Canlı: piyano donma 27.5 → 6.5 sn, In the End 35.7 → 5.4 sn, görünür fazla blok yok. Paket `HooDooCut-Kurulum-v0.9.8.1.zip` (SHA-256 `AEAC1E08…28AE77`). Release yok |
| 2026-10-14 | 0.9.8.0 | 0.9.9 | `2d42efd` | Melodi notası solo piyano ile ayarlandı (atağa taşıma, sönüm eleme, yeniden vuruş, dB tabanı); **seçenek (c)**: uzun nota aralarında donma, donan karenin sesi silinir, fazla tık kuyruğu (150 ms) atlanır. Paket `HooDooCut-Kurulum-v0.9.8.0.zip` (SHA-256 `0EFC6A05…ECEB68`). Canlı doğrulandı (HDpiano). Release yok |
| 2026-10-14 | 0.9.7.0 | 0.9.9 | `6f9b613` | Melodi hedefi yeniden: riff notaları (sekizlik takip + perde değişimi), seçenek (b) fazla tıkları kesme, host'ta silme. HPSS ve riff filtresi kaldırıldı. Release yok |
| 2026-10-14 | 0.9.6.1 | 0.9.9 | `28fb7b1` | Melodi hedefi piyano riff'ine odaklı: sönüm ağırlığı + riff (tekrar) filtresi. Release yok |
| 2026-10-14 | 0.9.6.0 | 0.9.9 | `949eff0` | **Tık ritmi hedefi: Müzik melodisi** — HPSS nota tespiti (`detectNotes`) + DP tık→nota eşleşmesi (`alignToNotes`), bölge başı da ayarlanır. Release yok |
| 2026-10-14 | 0.9.5.2 | 0.9.9 | `db59c4e` | Tık ritmi: kilitli track'ler (müzik) işlem dışı; Premiere'in yüksek hız tavanı kabul edilip raporlanıyor, track'ler arası hız farkı senkron hatası. Release yok |
| 2026-10-14 | 0.9.5.1 | 0.9.9 | `dc3c08c` | Tık tespiti tepe tabanlı, tam bant: marker'lar tıkın atağında (eskiden 12–62 ms erken); doğal tık aralığı + uyarı; en kısa aralık ≥100 ms. Release yok |
| 2026-10-14 | 0.9.5.0 | 0.9.9 | `0e024ee` | **Tık ritmi modu** ([[HooDoo Cut Tık Ritmi]]); razor tam kare tick'iyle seek (tam sayı olmayan fps'te 1 kare erken kesme düzeldi); ES3 ayrılmış kelime regresyon testi; geçici hız testi kaldırıldı. Release yok |
| 2026-10-14 | 0.9.4.7 | 0.9.9 | — | Hız testine `b` eki (önce end, sonra hız) + kaynak in/out raporu. Release yok |
| 2026-10-14 | 0.9.4.6 | 0.9.9 | — | Hız testine `e` eki (DOM end ile süre ayarı). Release yok |
| 2026-10-14 | 0.9.4.5 | 0.9.9 | — | Hız testine `d` eki (p1 = hedef süre timecode). Release yok |
| 2026-10-14 | 0.9.4.4 | 0.9.9 | — | Hız testi tüm linkli parçalara uygular, `r` = ripple adayı. Release yok |
| 2026-10-14 | 0.9.4.3 | 0.9.9 | `026b0b1` | Hız testi linkli seçimi (V+A) kabul eder, tüm parçaları raporlar. Release yok |
| 2026-10-14 | 0.9.4.2 | 0.9.9 | `1c8f1e7` | Geçici "🧪 Hız testi" butonu: QE `setSpeed` imza/davranış tanısı ([[plans/2026-10-14-tik-ritmi\|tık ritmi planı]]). Release yok |
| 2026-10-14 | 0.9.4.1 | 0.9.9 | `90a7552` | **Ripple ile boşluk kapatma:** "sil + boşlukları kapat" + Toplu modda silme `ripple=true` ile tek native işlemde; tüm track'lerde konum doğrulaması. Eski motor ripple dönmezse CEP kompaksiyonuna düşer. Release yok |
| 2026-10-07 | 0.9.4.0 | 0.9.8 | `85002f9` | Windows `\\?\` extended-path proje/medya yolu normalize ([[reports/2026-10-07-uxp-path-identity\|rapor]]) |
| 2026-10-07 | 0.9.4.0 | 0.9.7 | `85002f9` | Ağ izni `domains: "all"` + kodda URL kısıtı; eski 0.9.6 kaydı kaldırıldı ([[reports/2026-10-07-uxp-permission\|rapor]]) |
| 2026-10-06 | 0.9.4.0 | 0.9.6 | `85002f9` | `127.0.0.1:*` izin denemesi — başarısız ([[reports/2026-10-06-uxp-network-hotfix\|rapor]]) |
| 2026-10-06 | 0.9.4.0 | 0.9.5 | `85002f9` | **Toplu (UXP) silme motoru**; kurulum paketi CCX içerir ([[reports/2026-10-06-toplu-motor\|rapor]]) |
| 2026-10-06 | 0.9.3.5 | — | `85002f9` | Premiere 26.5.2 klip silme `true` dönüşü başarı ([[reports/2026-10-06-hotfix\|rapor]]) |
| 2026-10-05 | 0.9.3.4 | — | `85002f9` | Stereo kanal ayrı filtre, kare hizalı sınırlar, 80 ms taşma kaldırıldı, tek tarama hazırlık, yapısal plan imzası, WAV önbelleği kaldırıldı, hata gizleme yok ([[reports/2026-10-05-gelistirme\|rapor]]) |
| 2026-06-25 | 0.9.3.3 | — | `749a6ea` | Konuşma bandı band-pass, histerezis çift-eşik, WAV önbelleği |
| 2026-06-16 | 0.9.3.2 | — | `574b37f` | Tek-tık otomatik güncelleme (junction'da kapalı) |
| 2026-06-15 | 0.9.3.1 | — | `cb293cd` | Modern UI + sürüm şeması düzeltmesi |
| 2026-06-15 | (0.9.4.0) | — | `4cc73e7` | Beat özelliği tamamen kaldırıldı |
| 2026-06-15 | 0.9.3.0 | — | `e51cc06` | CSV'den BPM entegrasyonu |
| 2026-06-15 | 0.9.2.0 | — | `ff4680a` | Tap tempo + manuel BPM ile faz-kilitli ritim |
| 2026-06-15 | — | — | `b22b955` | Test müziği üreteci |
| 2026-06-15 | 0.9.1.0 | — | `2470b95` | Müzik ritmi tespiti + 4 parçalı sürüm şeması |
| 2026-06-15 | — | — | `2f1df71` | Tek-tık kurulum (Kur.bat) + güncelleme kontrolü düzeltmeleri |
| 2026-06-15 | 0.9.0 | — | `b7975ea` | İlk sürüm |

> [!note] Sürüm numarası çakışması
> `4cc73e7` commit'i "v0.9.4.0" etiketini beat kaldırma için kullandı; hemen
> ardından `cb293cd` şemayı düzeltip 0.9.3.1'e döndü. Ekim 2026'daki toplu
> motor sürümü 0.9.4.0 ayrı bir sürümdür. GitHub'da `v0.9.4.0` tag'i varsa
> hangisini gösterdiği kontrol edilmeli (doğrulanmadı).

> [!info] Beat/BPM dönemi
> 0.9.1–0.9.3.0 arasında müzik ritmine göre kesim denendi; 2026-06-15'te tamamen kaldırıldı.
