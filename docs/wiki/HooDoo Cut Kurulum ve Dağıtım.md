---
type: kılavuz
title: HooDoo Cut Kurulum ve Dağıtım
description: Geliştirici kurulumu, kullanıcı kurulum paketi, sürüm yayınlama adımları ve GitHub Releases ile otomatik güncelleme.
tags: [hoodoo, hoodoo-cut, kurulum, dağıtım, güncelleme, github]
proje: [hoodoo-cut]
sources:
  - DISTRIBUTION.md
  - install.ps1
  - build-installer.ps1
  - build-zxp.ps1
  - installer/kurulum.ps1
  - installer/Kur.bat
  - com.hoodoocut/client/js/update.js
created: 2026-10-11
updated: 2026-10-11
---

# HooDoo Cut Kurulum ve Dağıtım

Kullanıcıya dönük tam metin: repo kökündeki `DISTRIBUTION.md`.

## Geliştirici kurulumu (`install.ps1`)

- `%APPDATA%\Adobe\CEP\extensions\com.hoodoocut` → kaynak klasöre **junction**
  (kod değişince doğrudan yansır). Admin gerekmez.
- `HKCU:\Software\Adobe\CSXS.{10,11,12}\PlayerDebugMode = 1` (imzasız panel izni).
- WAV preseti yoksa Adobe sistem presetinden kopyalar.
- ⚠️ Kaynak yolu hâlâ `D:\PremiereProExtension\com.hoodoocut` sabit — repo
  `C:\Users\Muhammed\Documents\GitHub\hoodoo-cut` altında. Bkz. [[HooDoo Cut Bilinen Sınırlar]].
- Junction kurulumda otomatik güncelleme bilinçli olarak kapalı; `git pull` kullanılır.
- DevTools: Premiere açıkken `http://localhost:8088`.

## Kullanıcı paketi

`build-installer.ps1` → `dist\HooDooCut-Kurulum-v<ExtensionBundleVersion>.zip`
(Kur.bat + kurulum.ps1 + `com.hoodoocut/` + `com.hoodoocut.bulk_premierepro.ccx`).
Önce `node tools/package-bulk.js` çalışmış olmalı ([[HooDoo Cut Toplu Motor#Paketleme]]).

Kullanıcı: ZIP'i çıkar → `Kur.bat`. `kurulum.ps1`:
1. CCX'i Adobe UPIA ile kurar (Creative Cloud Desktop gerekir).
2. CEP dosyalarını `%APPDATA%\...\com.hoodoocut`'a kopyalar (`.debug` hariç);
   hedef junction ise durur.
3. PlayerDebugMode'u açar.

`build-zxp.ps1` isteğe bağlı imzalı `.zxp` üretir (ZXPSignCmd'yi Adobe-CEP
reposundan indirir; sertifika `tools/hoodoo-cert.p12`, gitignore'da — kaybetme).

## Sürüm yayınlama

1. Sürümü eşitle: `manifest.xml` (`ExtensionBundleVersion` + `Extension Version`)
   ve `main.js` → `ACS_VERSION`. UXP motoru değiştiyse `com.hoodoocut.bulk/manifest.json` → `version`
   (aynı sürümle yeniden kurulum güncelleme sayılmaz).
2. `node tools/package-bulk.js` → `.\build-installer.ps1`.
3. Commit + push; GitHub **Release** (tag `vX.Y.Z`) + ZIP'i ek olarak yükle.
   Yalnız `git push` güncelleme bildirimi üretmez.

Sürüm şeması: parça sayısı serbest (`0.9.3.5` gibi 4 parçalı kullanılıyor);
karşılaştırma sayısal, baştaki `v` yok sayılır.

## Otomatik güncelleme (`update.js`)

- Panel açılışında `api.github.com/repos/MuhammedEsmer/hoodoo-cut/releases/latest`
  token'sız sorgulanır, `tag_name` mevcut sürümle karşılaştırılır.
- Yeni sürüm → yeşil çubuk "Yeni sürüm: vX.Y.Z — Güncelle". Butona basınca
  paket indirilir, çıkarılır, kurulum klasörü güncellenir; "Premiere'i yeniden
  başlatın" denir (v0.9.3.2+). Daha eski sürümlerden ilk güncelleme indirme sayfasını açar.
- (doğrulanmadı) Tek-tık güncellemenin 0.9.4.0'daki CCX/UXP motorunu da kurup kurmadığı kontrol edilmeli.
