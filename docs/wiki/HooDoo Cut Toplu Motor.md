---
type: konsept
title: HooDoo Cut Toplu Motor
description: Premiere 26.5+ UXP yardımcı paneli — silme hedeflerini tek native action ve tek undo transaction ile siler.
tags: [hoodoo, hoodoo-cut, uxp, toplu-silme, köprü]
proje: [hoodoo-cut]
sources:
  - com.hoodoocut.bulk/manifest.json
  - com.hoodoocut.bulk/engine.js
  - com.hoodoocut.bulk/network.js
  - com.hoodoocut.bulk/main.js
  - com.hoodoocut/client/js/bulk-bridge.js
  - tools/package-bulk.js
created: 2026-10-11
updated: 2026-10-14
---

# HooDoo Cut Toplu Motor

**Plugins → HooDoo Cut Toplu Motor** paneli (`com.hoodoocut.bulk`, sürüm
0.9.8). Silme aşamasını CEP'ten alır: tüm video ve ses hedefleri tek
`TrackItemSelection`'a eklenir, tek
`createRemoveItemsAction(..., false, MediaType.ANY, false)` tek
`executeTransaction` içinde uygulanır. Ripple/overlap kaydırma kapalı;
boşluk kapatma ayrı aşamadır. Undo korunur ve tek adımdır.

**0.9.9'dan itibaren ripple:** "sil + boşlukları kapat" modunda panel plana
`ripple: true` ve kesim aralıklarını (`cuts`) ekler. Motor silmeyi
`createRemoveItemsAction(selection, true, ANY, false)` ile yapar — boşluklar
aynı işlemde kapanır, CEP kompaksiyonu (klip klip `move`) atlanır. Commit'ten
önce **tüm** video/ses track'leri taranır; sonra her kalan klibin başlangıcı
`başlangıç − (o noktadan önce biten kesimlerin toplam süresi)` ile
karşılaştırılır (tolerans 2 ms). Uyuşmazlık → hata, panel "tamamlandı" demez;
tek Ctrl+Z geri alır. Motor `rippled` dönmezse (eski motor) panel klasik
kompaksiyona düşer ve bunu günlüğe yazar.

Canlı ölçüm (2026-10-14, 0.9.4.0, STT EP6, 37 dk, 12 kesim): native silme 9 ms,
UXP hazırlık 41 ms; ardından CEP kompaksiyonu 753 klip / 24.8 sn — ripple bunun
için yapıldı. Ripple'ın canlı sonucu henüz ölçülmedi.

990 kliplik örnekte native silme çağrısı 990 → 1. **Bu çağrı sayısıdır,
süre ölçümü değildir.** Razor hâlâ CEP/QE'dedir.

Plan: [[plans/2026-10-06-toplu-silme|toplu silme planı]] ·
rapor: [[reports/2026-10-06-toplu-motor|0.9.4.0 raporu]].

## Köprü protokolü

CEP paneli (`bulk-bridge.js`) `127.0.0.1:51373`'te HTTP sunucu açar; UXP paneli istemcidir.

| Yol | Ne yapar |
|---|---|
| `GET /hello` | Oturum token'ı verir (her panel açılışında rastgele 32 bayt) |
| `POST /poll` | Bekleyen işi alır (iş **bir kez** alınır) |
| `POST /result` | Sonucu kimlikle bildirir; onay idempotent |

- `Origin` başlığı olan veya `Host` eşleşmeyen istek 403 (CORS yok → tarayıcılar erişemez).
- `x-hoodoo-token` zorunlu; gövde ≤ 1 MB, JSON nesne olmalı.
- UXP tarafı (`network.js`) yalnız bu üç yola, sabit adrese fetch eder; redirect `error`.
- Bağlantı kesilirse native işlem **otomatik tekrarlanmaz**.

## Güvenlik kontrolleri (motor)

Proje yolu, sequence, kanal, klip başlangıç/bitiş ve kaynak in/out eşleşmeli;
tekrar eden hedef, hazırlık sırasında proje/kanal değişikliği event'i,
başarısız action/transaction → silme yok veya başarısız raporlanır. İşlem
sonrası kanal klip sayıları doğrulanır. Tarama, hazırlık ve commit süreleri günlüğe yazılır.

## Sürüm hikâyesi (izin ve kimlik)

| UXP | Sorun | Çözüm |
|---|---|---|
| 0.9.5 | İlk sürüm (CEP 0.9.4.0 ile) | Aynı sürümle yeniden kurulum güncelleme sayılmadığı için patch artırıldı |
| 0.9.6 | `Permission denied ... Manifest entry not found` | `http://127.0.0.1:*` deseni — **işe yaramadı** |
| 0.9.7 | Aynı hata | `requiredPermissions.network.domains: "all"` (kullanıcı geniş izni onayladı); kod tarafında URL kısıtlaması. Eski 0.9.6 kaydı UPIA `/remove` ile silindi |
| 0.9.8 | CEP `C:\...` vs UXP `\\?\C:\...` yolu → "Proje veya sequence değişti" | Windows extended-path önekleri normalize edilir |

Raporlar: [[reports/2026-10-06-uxp-network-hotfix|0.9.6]] ·
[[reports/2026-10-07-uxp-permission|0.9.7]] · [[reports/2026-10-07-uxp-path-identity|0.9.8]].

> [!warning] Kurulum dersi
> UPIA `/install` sonucuna tek başına güvenme: bu makinede aynı adlı farklı
> sürümler yan yana etkin kalabiliyor. `/list all` + kurulu dosya SHA-256 +
> panelde görünen `Motor X.Y.Z` etiketi birlikte kontrol edilmeli.

## Paketleme

```bash
npm install --prefix dist/uxp-packager --ignore-scripts --no-audit --no-fund @adobe/uxp-devtools-core@1.2.0
node tools/package-bulk.js
```

`dist/com.hoodoocut.bulk_premierepro.ccx` üretir; `build-installer.ps1` bunu
ZIP'e koyar, `kurulum.ps1` Adobe UPIA (`UnifiedPluginInstallerAgent.exe /install`) ile kurar.
UXP geliştirici modu açılmaz.

## Doğrulanmamış

Canlı timeline'da hız, gerçek undo, geçişli/nested/multicam sequence davranışı.
