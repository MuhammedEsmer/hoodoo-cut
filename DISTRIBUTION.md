# HooDoo Cut — Dağıtım ve Güncelleme

## Kullanıcılar için: kurulum (.zxp)

1. [Releases](https://github.com/YOUR_GITHUB_USERNAME/hoodoo-cut/releases) sayfasından
   en son `HooDooCut_vX.Y.Z.zxp` dosyasını indir.
2. Bir ZXP yükleyici kur (biri yeterli):
   - **Anastasiy's Extension Manager** — https://install.anastasiy.com/
   - veya **ZXPInstaller** — https://zxpinstaller.com/
3. `.zxp` dosyasını yükleyiciye sürükle (ya da çift tıkla). Kurar.
4. Premiere Pro'yu (yeniden) başlat → **Window → Extensions → HooDoo Cut**.

> Debug modu / registry ayarı **gerekmez**; paket imzalıdır.

## Güncelleme (kullanıcı)

Panel her açılışta GitHub'daki en son sürümü kontrol eder. Yeni sürüm varsa
üstte yeşil bir çubukta **"Yeni sürüm: vX.Y.Z — İndir"** görünür. İndir'e basınca
Releases sayfası açılır; yeni `.zxp`'yi indirip aynı şekilde kurarsın (üzerine yazar).

---

## Maintainer (sen) için: yeni sürüm yayınlama

### Tek seferlik kurulum
- `git` kurulu olmalı (var).
- GitHub'da **public** bir repo aç: `hoodoo-cut` (kaynağı gizli tutmak istersen
  yalnız Release barındıran ayrı public repo da olur).
- `com.hoodoocut/client/js/update.js` içinde `OWNER`'ı GitHub kullanıcı adınla değiştir.
- İlk gönderim:
  ```powershell
  cd D:\PremiereProExtension
  git init
  git add .
  git commit -m "HooDoo Cut ilk sürüm"
  git branch -M main
  git remote add origin https://github.com/<KULLANICI>/hoodoo-cut.git
  git push -u origin main
  ```

### Her yeni sürümde
1. **Sürümü artır** (iki yerde aynı olmalı):
   - `com.hoodoocut/CSXS/manifest.xml` → `ExtensionBundleVersion` ve `Extension Version`
   - `com.hoodoocut/client/js/main.js` → `ACS_VERSION`
2. **Paketle + imzala:**
   ```powershell
   .\build-zxp.ps1
   ```
   → `dist\HooDooCut_vX.Y.Z.zxp` oluşur.
3. **Kodu push'la** ve **GitHub Release** oluştur:
   ```powershell
   git add -A; git commit -m "vX.Y.Z"; git push
   ```
   GitHub web'de **Releases → Draft a new release** → tag `vX.Y.Z` → `dist\HooDooCut_vX.Y.Z.zxp`
   dosyasını ek olarak yükle → Publish.
4. Kullanıcıların paneli bir sonraki açılışta güncellemeyi görür.

> **Önemli:** `tools\hoodoo-cert.p12` (imza sertifikan) `.gitignore`'da; repoya
> girmez ve sende kalır. Aynı sertifikayla imzalamaya devam et (kaybetme).
> Kaybedersen yeni sertifika üretilir, kullanıcılar yeni paketi sorunsuz kurar
> ama "aynı yayıncı" sürekliliği kopar.

## Sürüm numarası kuralı (semver)

`X.Y.Z` — düzeltme = Z, yeni özellik = Y, büyük/uyumsuz = X. Güncelleme kontrolü
bu sayıları karşılaştırır (tag'deki baştaki `v` yok sayılır).
