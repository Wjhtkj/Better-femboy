@echo off
setlocal

rem Helper wrapper: run wrangler with the bundled Node.js.
rem Usage:  w.cmd login      w.cmd d1 create nn-score-db      w.cmd pages deploy .

set "NODE_DIR=C:\Users\MOSS\.workbuddy\binaries\node\versions\22.22.2-3"
set "ENTRY=%~dp0node_modules\wrangler\bin\wrangler.js"

if not exist "%NODE_DIR%\node.exe" (
  echo [ERROR] node.exe not found at: %NODE_DIR%
  echo Install Node.js LTS from https://nodejs.org and edit NODE_DIR in this file.
  exit /b 1
)

if not exist "%ENTRY%" (
  echo [ERROR] wrangler entry not found at: %ENTRY%
  echo Run: npm install --save-dev wrangler
  exit /b 1
)

"%NODE_DIR%\node.exe" "%ENTRY%" %*
