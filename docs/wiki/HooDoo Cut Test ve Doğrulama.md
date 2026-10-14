---
type: referans
title: HooDoo Cut Test ve Doğrulama
description: Premiere gerektirmeyen Node test paketleri, benchmark araçları ve canlı Premiere kontrol listesi.
tags: [hoodoo, hoodoo-cut, test, benchmark, doğrulama]
proje: [hoodoo-cut]
sources:
  - tools/
created: 2026-10-11
updated: 2026-10-14
---

# HooDoo Cut Test ve Doğrulama

Testler sistem Node'unda çalışır; Premiere nesneleri ve köprü taklit edilir
(`tools/host-fixture.js`), gerçek analiz/host/panel kodu VM içinde yüklenir.
Gerçek QE davranışı, efekt/transition, gerçek undo **kapsam dışıdır**.

## Test paketleri

```bash
node tools/test-analyzer.js
```

| Dosya | Kapsam |
|---|---|
| `tools/test-analyzer.js` | Sentetik WAV ile eşik + tespit (15) |
| `tools/test-regressions.js` | Ses/host regresyonları (26) |
| `tools/test-panel.js` | Panel ↔ host köprüsü akışı (19) |
| `tools/test-bulk.js` | Toplu motor: kanal karışımı, tek action/transaction, uyuşmazlıklar (17) |
| `tools/test-bulk-host.js` | Host bulk plan/kimlik (2) |
| `tools/test-bulk-bridge.js` | Yerel köprü: origin/token, tek seferlik iş, idempotent onay (3) |
| `tools/test-bulk-network.js` | UXP `network.js`: sabit loopback adresi, redirect/dış URL reddi (2) |
| `tools/test-bulk-companion.js` | Yardımcı panel bağlantı/onay kurtarma (2) |
| `tools/test-tick.js` | Tık ritmi planı, tık tespiti, melodi notaları (perde değişimi, yeniden vuruş, tutulan nota/davul nota değil, ızgara dışı atak, sönüm), (b)/(c) eşleşmesi: fazla tıklar arası bölümler, hafif ağır çekim, kısa donma, uzun donma yerine tık düşürme; Basic Pitch nota seçimi, yeniden örnekleme ve **gerçek paketle** sentetik piyano transkripsiyonu, tık sesinin (karesinin değil) notaya hizalanması (29) |
| `tools/test-tick-host.js` | `ACS_tickRetime`: çakışmasız yeniden zamanlama, silme, donan karenin sesi, kilitli track, hız tavanı, marker'lar (11) |

**2026-10-14 son koşu: 126 PASS, 0 FAIL** (CEP 0.9.9.1, motor 0.9.9).

**Nota doğruluğu ölçümü (geliştirme):** Kong piyano transkripsiyonu (Python, `piano_transcription_inference`)
referans olarak kullanılır; spektral akış referansı zayıf. Ayrıntı:
[[reports/2026-10-14-basic-pitch-entegrasyon|Basic Pitch raporu]]. Basic Pitch paketi:
`cd tools/basicpitch && npm install && node build.js`. Geçici
`test-speed-probe.js` tanı bitince kaldırıldı. Sentetik piyano sesinde aynı tel yeniden vurulunca
önceki titreşim kesilir (üst üste eklenen aynı frekanslı sinüsler birbirini söndürüp testi yanıltıyordu).

## Canlı test düzeneği (2026-10-14)

Kurulu panele `.debug` kopyalanınca CEP hata ayıklama portu (`localhost:8088`)
açılır. Scratchpad'deki sürücülerle Claude Premiere'i kendisi sınar:
`pp.cjs` (ExtendScript'i panelde `evalScript` ile çalıştırır), `pj.cjs` (panel
sayfasında JS — buton tıklama, alan doldurma). Deneyler test projesinde
`ep6`'nın taze kopyası (`HDtest`) üzerinde yapılır. Host değişince
`$.evalFile` **üst seviyede** çağrılmalı (fonksiyon içinde yüklenen tanımlar
global olmaz). Ayrıntı: [[HooDoo Cut Tık Ritmi]].

**2026-10-11 koşusu: 74 geçti, 0 başarısız** (sistem Node'u, UXP 0.9.8 / CEP 0.9.4.0
çalışma ağacı). Sayılar zamanla değişir; güncel sayı için testleri çalıştır.

> [!note]
> `tools/test-bulk-permissions.js` 0.9.6'da eklendi, 0.9.7'de kaldırıldı:
> sabit dize karşılaştırması UXP izin eşleştiricisini doğrulamıyordu.

## Benchmark

JSON'u stdout'a yazar; sonuçlar elle `docs/reports/` altına kaydedildi.

- `tools/benchmark-analyzer.js` (Node CPU + yerel WAV, Premiere export'u yok) → `2026-10-05-analyzer-benchmark.json`
- `tools/benchmark-delete.js` (sahte DOM; `legacy` / `prepared`) → `2026-10-05-delete-{baseline,prepared}.json`

## Canlı Premiere kontrol listesi

[[reports/2026-10-05-gelistirme#Gerçek Premiere doğrulaması|0.9.3.4 raporundaki adımlar]] hâlâ geçerli:
aynı içeriğin ayrı sequence kopyalarında fazları ayrı süreleyerek (export,
analiz, razor, hazırlık, silme) modları sına; linked klip, kilitli track,
seçili bölge, Ctrl+Z ve "analizden sonra sequence değişti" reddini kontrol et.
Toplu motor için ek: panelde `Motor X.Y.Z / Toplu motor hazır`, UPIA `/list all`, kurulu dosya hash'leri.

Her yol en az üç kez, soğuk/sıcak ayrı, medyan + en kötü süre
([[reports/2026-10-05-teknik-analiz|teknik analiz]] §7 benchmark matrisi).
