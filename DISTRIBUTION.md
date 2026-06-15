# HooDoo Cut — Dağıtım ve Güncelleme

## Kullanıcılar için: kurulum (tek tıkla)

1. [Releases](https://github.com/MuhammedEsmer/hoodoo-cut/releases) sayfasından
   en son **`HooDooCut-Kurulum-vX.Y.Z.zip`** dosyasını indir.
2. ZIP'e sağ tık → **"Tümünü ayıkla" (Extract All)** ile bir klasöre çıkar.
   (Önemli: ZIP'in içinden çalıştırma; önce çıkar.)
3. Çıkan klasördeki **`Kur.bat`** dosyasına **çift tıkla**.
   - Windows "korudu" uyarısı çıkarsa: **More info → Run anyway**.
4. "KURULUM TAMAM" yazınca Premiere Pro'yu kapatıp aç →
   **Window → Extensions → HooDoo Cut**.

> Başka bir program (ZXPInstaller vb.) gerekmez. `Kur.bat` dosyaları doğru yere
> kopyalar ve gerekli ayarı (CEP debug modu) açar. Admin yetkisi gerekmez.

## Güncelleme (kullanıcı)

Panel her açılışta GitHub'daki en son sürümü kontrol eder. Yeni sürüm varsa
üstte yeşil çubukta **"Yeni sürüm: vX.Y.Z — İndir"** görünür. İndir → yeni
`Kurulum.zip`'i indirip aynı şekilde `Kur.bat`'a çift tıkla (üzerine yazar).

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
2. **Kurulum paketini oluştur:**
   ```powershell
   .\build-installer.ps1
   ```
   → `dist\HooDooCut-Kurulum-vX.Y.Z.zip` oluşur (Kur.bat + dosyalar).
   *(İstersen ek olarak imzalı `.zxp` için `.\build-zxp.ps1` de çalıştırabilirsin —
   ZXPInstaller kullanmak isteyenler için; zorunlu değil.)*
3. **Kodu push'la** ve **GitHub Release** oluştur:
   ```powershell
   git add -A; git commit -m "vX.Y.Z"; git push
   ```
   GitHub web'de **Releases → Draft a new release** → tag `vX.Y.Z` →
   `dist\HooDooCut-Kurulum-vX.Y.Z.zip` dosyasını ek olarak yükle → Publish.
4. Kullanıcıların paneli bir sonraki açılışta güncellemeyi görür.

> **Önemli:** `tools\hoodoo-cert.p12` (imza sertifikan) `.gitignore`'da; repoya
> girmez ve sende kalır. Aynı sertifikayla imzalamaya devam et (kaybetme).
> Kaybedersen yeni sertifika üretilir, kullanıcılar yeni paketi sorunsuz kurar
> ama "aynı yayıncı" sürekliliği kopar.

## Sürüm numarası kuralı (semver)

`X.Y.Z` — düzeltme = Z, yeni özellik = Y, büyük/uyumsuz = X. Güncelleme kontrolü
bu sayıları karşılaştırır (tag'deki baştaki `v` yok sayılır).
