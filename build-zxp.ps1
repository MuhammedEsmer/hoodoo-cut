# HooDoo Cut - imzali ZXP paketi olustur
# Kullanim:  .\build-zxp.ps1
# Yaptiklari:
#  1. ZXPSignCmd yoksa indirir (tools\)
#  2. Self-signed sertifika yoksa olusturur (tools\hoodoo-cert.p12)
#  3. Eklentiyi staging'e kopyalar, dev artefaktlarini (.debug) cikarir
#  4. Imzalar -> dist\HooDooCut_v<surum>.zxp
# Cikan .zxp'yi GitHub Release'e ek olarak yukleyin; kullanicilar ZXPInstaller
# ile kurar (debug modu GEREKMEZ).

$ErrorActionPreference = 'Stop'
$root = "D:\PremiereProExtension"
$src = "$root\com.hoodoocut"
$tools = "$root\tools"
$dist = "$root\dist"
$staging = "$env:TEMP\hoodoo_staging"

# Surumu manifest'ten oku (tek kaynak)
[xml]$m = Get-Content "$src\CSXS\manifest.xml"
$version = $m.ExtensionManifest.ExtensionBundleVersion
Write-Host "HooDoo Cut surum: $version"

New-Item -ItemType Directory -Force $tools, $dist | Out-Null

# 1) ZXPSignCmd
$signer = "$tools\ZXPSignCmd.exe"
if (-not (Test-Path $signer)) {
    Write-Host "ZXPSignCmd indiriliyor..."
    $url = "https://raw.githubusercontent.com/Adobe-CEP/CEP-Resources/master/ZXPSignCMD/4.1.2/win64/ZXPSignCmd.exe"
    try { curl.exe -sL -o $signer $url } catch {}
}
if ((-not (Test-Path $signer)) -or ((Get-Item $signer).Length -lt 100000)) {
    throw "ZXPSignCmd indirilemedi. Elle indirip '$signer' olarak koyun: https://github.com/Adobe-CEP/CEP-Resources/tree/master/ZXPSignCMD"
}

# 2) Self-signed sertifika
$cert = "$tools\hoodoo-cert.p12"
$pw = "hoodoo"
if (-not (Test-Path $cert)) {
    Write-Host "Self-signed sertifika olusturuluyor..."
    & $signer -selfSignedCert TR Istanbul "HooDoo" "HooDoo Cut" $pw $cert
}

# 3) Staging (dev artefaktlarini cikar)
if (Test-Path $staging) { Remove-Item -Recurse -Force $staging }
New-Item -ItemType Directory -Force $staging | Out-Null
Copy-Item -Recurse "$src\*" $staging
Remove-Item -Force "$staging\.debug" -ErrorAction SilentlyContinue

# 4) Imzala -> .zxp
$out = "$dist\HooDooCut_v$version.zxp"
if (Test-Path $out) { Remove-Item -Force $out }
Write-Host "Imzalaniyor..."
& $signer -sign $staging $out $cert $pw -tsa "http://timestamp.digicert.com"

if (Test-Path $out) {
    $kb = [math]::Round((Get-Item $out).Length / 1KB)
    Write-Host ""
    Write-Host "TAMAM: $out ($kb KB)"
    Write-Host "Bunu GitHub Release'e (tag: v$version) ek olarak yukleyin."
} else {
    throw "Imzalama basarisiz."
}
