# HooDoo Cut - tek-tikla kurulum paketi olustur
# Cikti: dist\HooDooCut-Kurulum-v<surum>.zip  (icinde Kur.bat + kurulum.ps1 + com.hoodoocut)
# Kullanici: ZIP'i indirir, cikarir, Kur.bat'a cift tiklar. Baska arac gerekmez.

$ErrorActionPreference = 'Stop'
$root = "D:\PremiereProExtension"
$src = "$root\com.hoodoocut"
$inst = "$root\installer"
$dist = "$root\dist"
$staging = "$env:TEMP\hoodoo_inst"

[xml]$m = Get-Content "$src\CSXS\manifest.xml"
$version = $m.ExtensionManifest.ExtensionBundleVersion
Write-Host "HooDoo Cut surum: $version"

New-Item -ItemType Directory -Force $dist | Out-Null
if (Test-Path $staging) { Remove-Item -Recurse -Force $staging }
New-Item -ItemType Directory -Force "$staging\com.hoodoocut" | Out-Null

# Eklenti dosyalari (dev artefakti .debug haric)
Copy-Item -Recurse "$src\*" "$staging\com.hoodoocut"
Remove-Item -Force "$staging\com.hoodoocut\.debug" -ErrorAction SilentlyContinue

# Kurucu
Copy-Item "$inst\Kur.bat" $staging
Copy-Item "$inst\kurulum.ps1" $staging

$out = "$dist\HooDooCut-Kurulum-v$version.zip"
if (Test-Path $out) { Remove-Item -Force $out }
Compress-Archive -Path "$staging\*" -DestinationPath $out

if (Test-Path $out) {
    $kb = [math]::Round((Get-Item $out).Length / 1KB)
    Write-Host ""
    Write-Host "TAMAM: $out ($kb KB)"
    Write-Host "Bunu GitHub Release'e (tag: v$version) ek olarak yukleyin."
} else {
    throw "ZIP olusturulamadi."
}
