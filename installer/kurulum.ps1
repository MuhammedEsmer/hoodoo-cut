# HooDoo Cut - kullanici kurulumu (Kur.bat bunu cagirir)
# Admin GEREKMEZ. Yaptiklari:
#  1. Eklenti dosyalarini %APPDATA%\Adobe\CEP\extensions\com.hoodoocut altina kopyalar
#  2. CEP debug modunu acar (imzasiz panel yuklensin)
# Ayni Kur.bat tekrar calistirilirsa GUNCELLEME gibi davranir (uzerine yazar).

$ErrorActionPreference = 'Stop'
try {
    $here = Split-Path -Parent $MyInvocation.MyCommand.Path
    $srcExt = Join-Path $here 'com.hoodoocut'
    $dst = Join-Path $env:APPDATA 'Adobe\CEP\extensions\com.hoodoocut'

    if (-not (Test-Path $srcExt)) {
        throw "com.hoodoocut klasoru bulunamadi. ZIP'i ONCE bir klasore cikarin, sonra Kur.bat'a cift tiklayin (ZIP'in icinden calistirmayin)."
    }

    Write-Host "Dosyalar kopyalaniyor..."
    if (Test-Path $dst) {
        $item = Get-Item $dst -Force
        if ($item.LinkType -eq 'Junction') { $item.Delete() }
        else { Remove-Item -Recurse -Force $dst }
    }
    New-Item -ItemType Directory -Force (Split-Path $dst) | Out-Null
    Copy-Item -Recurse $srcExt $dst
    Remove-Item -Force (Join-Path $dst '.debug') -ErrorAction SilentlyContinue

    Write-Host "CEP debug modu aciliyor..."
    foreach ($v in 10, 11, 12) {
        $k = "HKCU:\Software\Adobe\CSXS.$v"
        if (-not (Test-Path $k)) { New-Item -Path $k -Force | Out-Null }
        Set-ItemProperty -Path $k -Name PlayerDebugMode -Value '1' -Type String
    }

    Write-Host ""
    Write-Host "============================================"
    Write-Host "  KURULUM TAMAM!"
    Write-Host "  Premiere Pro'yu kapatip yeniden acin."
    Write-Host "  Window > Extensions > HooDoo Cut"
    Write-Host "============================================"
} catch {
    Write-Host ""
    Write-Host "HATA: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Yardim icin gelistiriciye bu mesaji iletin."
    exit 1
}
