@echo off
chcp 65001 > nul
title Stock Studio - Build Set
cd /d "%~dp0"

rem ASCII only in this file - comments included. See plan chapter 2.

where node > nul 2>&1
if errorlevel 1 (
  echo.
  echo   Node.js not found. Install Node.js v24 first: https://nodejs.org
  echo.
  pause
  exit /b 1
)

if not exist "%~dp0node_modules" (
  echo.
  echo   Preparing for the first run. This happens only once.
  echo.
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo.
    echo   Install failed. Check your network and try again.
    echo.
    pause
    exit /b 1
  )
)

node "%~dp0build.js"

echo.
pause
