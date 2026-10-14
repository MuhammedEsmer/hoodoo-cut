# HooDoo Cut - istege bagli muzik ayristirma (Demucs) kurulumu.
# Ortam: %LOCALAPPDATA%\HooDooCut\ml\venv (panel "Melodi kaynagi: Piyano kanali / Davulsuz" icin).
# Gerekli: Python 3.10+ (python komutu). Indirilenler: PyTorch CPU (~200 MB), demucs, htdemucs_6s modeli (~53 MB).
# Kullanim: powershell -ExecutionPolicy Bypass -File tools\setup-ml.ps1

$ErrorActionPreference = 'Stop'
$root = Join-Path $env:LOCALAPPDATA 'HooDooCut\ml'
$venv = Join-Path $root 'venv'
$py = Join-Path $venv 'Scripts\python.exe'

New-Item -ItemType Directory -Force $root | Out-Null
if (-not (Test-Path -LiteralPath $py)) {
    Write-Host "Python ortami olusturuluyor: $venv"
    & python -m venv $venv
    if ($LASTEXITCODE -ne 0) { throw 'python -m venv basarisiz (Python 3.10+ kurulu mu?)' }
}
& $py -m pip install --upgrade pip
& $py -m pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu
if ($LASTEXITCODE -ne 0) { throw 'PyTorch kurulamadi' }
& $py -m pip install demucs soundfile
if ($LASTEXITCODE -ne 0) { throw 'demucs kurulamadi' }
# modeli simdiden indir (ilk analiz beklemesin)
& $py -I -c "from demucs.pretrained import get_model; get_model('htdemucs_6s'); print('htdemucs_6s hazir')"
if ($LASTEXITCODE -ne 0) { throw 'htdemucs_6s modeli indirilemedi' }
Write-Host "TAMAM: $py"
