@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..\..") do set "WORKSPACE_ROOT=%%~fI"
set "MANIFEST=%SCRIPT_DIR%manifests\runtime_apps.json"
set "TMPDIR=%TEMP%\kain_runtime_%RANDOM%_%RANDOM%"
set "ITEMS_FILE=%TMPDIR%\runtime_outputs.txt"
mkdir "%TMPDIR%" >nul 2>nul

set "KAIN_EXE="
if exist "M:\Code\Kain\target\release\kain.exe" set "KAIN_EXE=M:\Code\Kain\target\release\kain.exe"
if not defined KAIN_EXE set "KAIN_EXE=kain"

echo [k-os-kain] Preparing runtime output roots...
for %%D in (wasm js ts ks hybrid) do (
  mkdir "%SCRIPT_DIR%generated\runtime\%%D" >nul 2>nul
)

echo [k-os-kain] Materializing runtime outputs from %MANIFEST%...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$items = Get-Content -Raw '%MANIFEST%' | ConvertFrom-Json;" ^
  "$items | ForEach-Object { $source = $_.source_path; foreach ($out in $_.outputs) { '{0}|{1}|{2}|{3}' -f $_.id, $source, $out.target, $out.path } }" ^
  > "%ITEMS_FILE%"
if errorlevel 1 (
  echo [error] failed to read runtime manifest: %MANIFEST%
  rd /s /q "%TMPDIR%" >nul 2>nul
  exit /b 1
)

set "TOTAL=0"
for /f "usebackq delims=" %%L in ("%ITEMS_FILE%") do (
  if not "%%~L"=="" set /a TOTAL+=1
)

set "PASS=0"
set "FAIL=0"
for /f "usebackq tokens=1-4 delims=|" %%A in ("%ITEMS_FILE%") do (
  if not "%%~A"=="" (
    set "APP_ID=%%~A"
    set "SOURCE_REL=%%~B"
    set "TARGET=%%~C"
    set "OUTPUT_REL=%%~D"
    set "SOURCE_PATH=%WORKSPACE_ROOT%\!SOURCE_REL:/=\!"
    set "OUTPUT_PATH=%WORKSPACE_ROOT%\!OUTPUT_REL:/=\!"
    echo [build] !APP_ID! -> !TARGET!
    for %%I in ("!OUTPUT_PATH!") do mkdir "%%~dpI" >nul 2>nul
    "%KAIN_EXE%" "!SOURCE_PATH!" -t !TARGET! -o "!OUTPUT_PATH!"
    if errorlevel 1 (
      echo [error] failed: !APP_ID! -> !TARGET!
      set /a FAIL+=1
    ) else (
      set /a PASS+=1
    )
  )
)

if not "%FAIL%"=="0" (
  echo [error] runtime materialization failed [%PASS% ok, %FAIL% failed]
  rd /s /q "%TMPDIR%" >nul 2>nul
  exit /b 1
)

echo [k-os-kain] Regenerating runtime registries...
cargo build -p k-os-kain
if errorlevel 1 (
  rd /s /q "%TMPDIR%" >nul 2>nul
  exit /b 1
)

rd /s /q "%TMPDIR%" >nul 2>nul
echo [k-os-kain] Runtime outputs materialized [%PASS%/%TOTAL%]
echo [k-os-kain] Runtime registry ready:
echo   %SCRIPT_DIR%generated\rust\runtime_registry.rs
echo   %SCRIPT_DIR%generated\ts\runtime_registry.ts
echo   %SCRIPT_DIR%generated\json\runtime_registry.json
