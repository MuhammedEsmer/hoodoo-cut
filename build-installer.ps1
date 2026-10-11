# HooDoo Cut - tek-tikla kurulum paketi olustur
# Cikti: dist\HooDooCut-Kurulum-v<surum>.zip  (icinde Kur.bat + kurulum.ps1 + com.hoodoocut)
# Kullanici: ZIP'i indirir, cikarir, Kur.bat'a cift tiklar. Baska arac gerekmez.

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$src = "$root\com.hoodoocut"
$inst = "$root\installer"
$dist = "$root\dist"
$staging = Join-Path $dist ("staging-" + [guid]::NewGuid().ToString('N'))

[xml]$m = Get-Content "$src\CSXS\manifest.xml"
$version = $m.ExtensionManifest.ExtensionBundleVersion
Write-Host "HooDoo Cut surum: $version"

New-Item -ItemType Directory -Force $dist | Out-Null
New-Item -ItemType Directory -Path $staging | Out-Null
try {
New-Item -ItemType Directory -Force "$staging\com.hoodoocut" | Out-Null

# Eklenti dosyalari (dev artefakti .debug haric)
Copy-Item -Recurse "$src\*" "$staging\com.hoodoocut"
Remove-Item -Force "$staging\com.hoodoocut\.debug" -ErrorAction SilentlyContinue

# Kurucu
Copy-Item "$inst\Kur.bat" $staging
Copy-Item "$inst\kurulum.ps1" $staging
$bulkPackage = Join-Path $dist 'com.hoodoocut.bulk_premierepro.ccx'
if (-not (Test-Path -LiteralPath $bulkPackage)) {
    throw 'Toplu motor paketi eksik. Once node tools/package-bulk.js calistirin.'
}
Copy-Item -LiteralPath $bulkPackage -Destination $staging

$out = "$dist\HooDooCut-Kurulum-v$version.zip"
if (Test-Path -LiteralPath $out) { Remove-Item -LiteralPath $out -Force }
Compress-Archive -Path "$staging\*" -DestinationPath $out

if (Test-Path $out) {
    $kb = [math]::Round((Get-Item $out).Length / 1KB)
    Write-Host ""
    Write-Host "TAMAM: $out ($kb KB)"
    Write-Host "Bunu GitHub Release'e (tag: v$version) ek olarak yukleyin."
} else {
    throw "ZIP olusturulamadi."
}
} finally {
    $resolvedStaging = (Resolve-Path -LiteralPath $staging).Path
    $resolvedDist = (Resolve-Path -LiteralPath $dist).Path
    if ([IO.Path]::GetDirectoryName($resolvedStaging) -ne $resolvedDist) {
        throw "Gecici paket klasoru dist disinda; temizleme durduruldu."
    }
    Remove-Item -LiteralPath $resolvedStaging -Recurse -Force
}
