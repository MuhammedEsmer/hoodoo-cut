# HooDoo Cut - kurulum (admin GEREKMEZ, kullanici-seviyesi kurulum)
# Yaptiklari:
#  1. Uzantiyi %APPDATA%\Adobe\CEP\extensions altina junction olarak baglar
#     (kopya degil: D:\PremiereProExtension'daki kod degisince direkt yansir)
#  2. PlayerDebugMode registry anahtarlarini acar (imzasiz uzanti izni)
#  3. WAV export preseti yoksa Adobe sistem presetinden kopyalar

$ErrorActionPreference = 'Stop'
$src = "D:\PremiereProExtension\com.hoodoocut"
$dstDir = "$env:APPDATA\Adobe\CEP\extensions"
$dst = "$dstDir\com.hoodoocut"

if (-not (Test-Path $src)) { throw "Kaynak bulunamadi: $src" }
New-Item -ItemType Directory -Force $dstDir | Out-Null

# Eski junction/klasoru temizle
if (Test-Path $dst) {
    $item = Get-Item $dst -Force
    if ($item.LinkType -eq 'Junction') { $item.Delete() }
    else { Remove-Item -Recurse -Force $dst -Confirm:$false }
}
New-Item -ItemType Junction -Path $dst -Target $src | Out-Null
Write-Host "Junction olusturuldu: $dst -> $src"

# Debug modu (imzasiz uzantilar icin sart)
foreach ($v in 10, 11, 12) {
    $key = "HKCU:\Software\Adobe\CSXS.$v"
    if (-not (Test-Path $key)) { New-Item -Path $key -Force | Out-Null }
    Set-ItemProperty -Path $key -Name PlayerDebugMode -Value '1' -Type String
}
Write-Host "PlayerDebugMode acildi (CSXS 10/11/12)"

# WAV export preseti
$eprDst = "$src\assets\wav48k16.epr"
if (-not (Test-Path $eprDst)) {
    $eprSrc = "C:\Program Files\Adobe\Adobe Media Encoder 2026\MediaIO\systempresets\3F3F3F3F_57415645\Waveform Audio 48kHz 16-bit.epr"
    if (Test-Path $eprSrc) {
        New-Item -ItemType Directory -Force "$src\assets" | Out-Null
        Copy-Item $eprSrc $eprDst
        Write-Host "WAV preseti kopyalandi"
    } else {
        Write-Warning "WAV preseti bulunamadi: $eprSrc"
    }
}

Write-Host ""
Write-Host "KURULUM TAMAM. Premiere Pro'yu (yeniden) baslatin:"
Write-Host "  Window > Extensions > HooDoo Cut"
