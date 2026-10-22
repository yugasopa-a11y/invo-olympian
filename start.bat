@echo off
title INVO RADAR - Live Trade Feed & TP/SL Alert System
cd /d "%~dp0"
cls

echo ===============================================================================
echo                INVO TRADE RADAR ^| LIVE FEED & ALERT SYSTEM
echo ===============================================================================
echo.
echo   [*] Checking Node.js environment...
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not found in your system PATH!
    echo Please install Node.js 18+ from https://nodejs.org
    pause
    exit /b 1
)

echo   [+] Node.js found:
node -v
echo.
echo   [*] Launching Invo Radar Server on http://localhost:3300 ...
echo   [*] Auto-discovering Invo refresh token from invo-sentinel/bin/data/sentinel.db...
echo.

start "" "http://localhost:3300"
node server.mjs

pause
