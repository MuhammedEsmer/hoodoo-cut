@echo off
chcp 65001 >nul
echo ========================================
echo   HooDoo Cut - Kurulum
echo ========================================
echo.
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0kurulum.ps1"
echo.
pause
