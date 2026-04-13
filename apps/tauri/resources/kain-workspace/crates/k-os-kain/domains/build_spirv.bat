@echo off
setlocal EnableExtensions EnableDelayedExpansion

if "%~1"=="" (
  set "DOMAIN_DIR=%CD%"
) else (
  set "DOMAIN_DIR=%~1"
)

pushd "%DOMAIN_DIR%" >nul
for %%I in (.) do set "DOMAIN=%%~nxI"
set "ROOT=%CD%"
for %%I in ("%ROOT%\..") do set "DOMAINS_ROOT=%%~fI"
for %%I in ("%DOMAINS_ROOT%\..") do set "CRATE_ROOT=%%~fI"
for %%I in ("%CRATE_ROOT%\..\..") do set "WORKSPACE_ROOT=%%~fI"
set "MANIFEST=%CRATE_ROOT%\manifests\sources.json"
set "GENERATED_ROOT=%CRATE_ROOT%\generated"
set "SPV_ROOT=%GENERATED_ROOT%\spv"
set "OUTDIR=%SPV_ROOT%\%DOMAIN%"
set "LOG=%ROOT%\BUILDLOG.md"
set "TMPDIR=%TEMP%\kain_spirv_%RANDOM%_%RANDOM%"
set "ITEMS_FILE=%TMPDIR%\manifest_items.txt"
mkdir "%TMPDIR%" >nul 2>nul
mkdir "%GENERATED_ROOT%" >nul 2>nul
mkdir "%SPV_ROOT%" >nul 2>nul
mkdir "%OUTDIR%" >nul 2>nul

set "KAIN_EXE="
if exist "M:\Code\Kain\target\release\kain.exe" set "KAIN_EXE=M:\Code\Kain\target\release\kain.exe"
if not defined KAIN_EXE set "KAIN_EXE=kain"
echo [info] using KAIN_EXE=%KAIN_EXE%

set "HAS_SPIRV_VAL=0"
set "SPIRV_VAL_EXE="
for /f "delims=" %%P in ('where spirv-val 2^>nul') do if not defined SPIRV_VAL_EXE set "SPIRV_VAL_EXE=%%P"
if defined SPIRV_VAL_EXE set "HAS_SPIRV_VAL=1"
if "%HAS_SPIRV_VAL%"=="1" (
  echo [info] spirv-val found - validation enabled
) else (
  echo [info] spirv-val not found - validation skipped
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$manifest = Get-Content -Raw '%MANIFEST%' | ConvertFrom-Json;" ^
  "$manifest | Where-Object { $_.target -eq 'spirv' -and $_.domain -eq '%DOMAIN%' } | ForEach-Object { '{0}|{1}|{2}' -f $_.id, $_.source_path, $_.compiled_path }" ^
  > "%ITEMS_FILE%"
if errorlevel 1 (
  echo [error] failed to read manifest: %MANIFEST%
  rd /s /q "%TMPDIR%" >nul 2>nul
  popd >nul
  exit /b 1
)

set "TOTAL=0"
for /f "usebackq delims=" %%L in ("%ITEMS_FILE%") do (
  if not "%%~L"=="" set /a TOTAL+=1
)

set "PASS=0"
set "FAIL=0"
set "COMPILE_FAIL=0"
set "VALIDATION_FAIL=0"
set "VALIDATION_SKIP=0"
set "IDX=0"
set "FAIL_LIST="
set "DATESTAMP=%DATE% %TIME%"
> "%LOG%" echo # SPIR-V Build Log
>> "%LOG%" echo.
>> "%LOG%" echo - **Domain:** `%DOMAIN%`
>> "%LOG%" echo - **Folder:** `%ROOT%`
>> "%LOG%" echo - **Manifest:** `%MANIFEST%`
>> "%LOG%" echo - **Generated:** `%DATESTAMP%`
>> "%LOG%" echo - **KAIN:** `%KAIN_EXE%`
>> "%LOG%" echo - **Output Root:** `%OUTDIR%`
if "%HAS_SPIRV_VAL%"=="1" (
  >> "%LOG%" echo - **spirv-val:** `%SPIRV_VAL_EXE%`
) else (
  >> "%LOG%" echo - **spirv-val:** `not found`
)
>> "%LOG%" echo - **Shader files discovered:** `%TOTAL%`
>> "%LOG%" echo.

echo ============================================================================
echo K_OS KAIN Domain: %DOMAIN%
echo Found %TOTAL% shader files
echo Output: %OUTDIR%
echo ============================================================================
echo.

if "%TOTAL%"=="0" (
  echo [warn] no .kn files found in %ROOT%
  >> "%LOG%" echo ## Summary
  >> "%LOG%" echo.
  >> "%LOG%" echo - **Status:** SKIPPED
  >> "%LOG%" echo - **Reason:** No `.kn` files found in `%ROOT%`
  rd /s /q "%TMPDIR%" >nul 2>nul
  popd >nul
  exit /b 0
)

for /f "usebackq tokens=1-3 delims=|" %%A in ("%ITEMS_FILE%") do (
  if not "%%~A"=="" (
    set /a IDX+=1
    set "NAME=%%~A"
    set "SOURCE_REL=%%~B"
    set "COMPILED_REL=%%~C"
    set "SOURCE_PATH=%WORKSPACE_ROOT%\!SOURCE_REL:/=\!"
    set "SPV=%WORKSPACE_ROOT%\!COMPILED_REL:/=\!"
    set "COMPILE_LOG=%TMPDIR%\!NAME!_compile.log"
    set "VALIDATE_LOG=%TMPDIR%\!NAME!_validate.log"
    set "FILE_STATUS=PASS"
    echo [!IDX!/%TOTAL%] !NAME!.kn

    for %%I in ("!SPV!") do mkdir "%%~dpI" >nul 2>nul
    if exist "!SPV!" del /f /q "!SPV!" >nul 2>nul
    > "!COMPILE_LOG!" 2>&1 "%KAIN_EXE%" "!SOURCE_PATH!" -t spirv -o "!SPV!"
    if errorlevel 1 (
      echo [error] compile failed: !NAME!.kn
      set /a FAIL+=1
      set /a COMPILE_FAIL+=1
      set "FILE_STATUS=COMPILE_FAILED"
      set "FAIL_LIST=!FAIL_LIST! !NAME!.kn"
    ) else (
      if not exist "!SPV!" (
        echo [error] output missing: !SPV!
        set /a FAIL+=1
        set /a COMPILE_FAIL+=1
        set "FILE_STATUS=OUTPUT_MISSING"
        set "FAIL_LIST=!FAIL_LIST! !NAME!.kn"
      ) else (
        if "%HAS_SPIRV_VAL%"=="1" (
          > "!VALIDATE_LOG!" 2>&1 "%SPIRV_VAL_EXE%" "!SPV!"
          if errorlevel 1 (
            echo [error] spirv-val rejected: !SPV!
            set /a FAIL+=1
            set /a VALIDATION_FAIL+=1
            set "FILE_STATUS=VALIDATION_FAILED"
            set "FAIL_LIST=!FAIL_LIST! !NAME!.kn"
          ) else (
            set /a PASS+=1
          )
        ) else (
          set /a PASS+=1
          set /a VALIDATION_SKIP+=1
          set "FILE_STATUS=PASS_NO_VALIDATION"
        )
      )
    )

    >> "%LOG%" echo ## !NAME!.kn
    >> "%LOG%" echo.
    >> "%LOG%" echo - **Source:** `!SOURCE_PATH!`
    >> "%LOG%" echo - **Status:** !FILE_STATUS!
    >> "%LOG%" echo - **Output:** `!SPV!`
    >> "%LOG%" echo.
    >> "%LOG%" echo ### Compile Output
    >> "%LOG%" echo.
    >> "%LOG%" echo ```text
    type "!COMPILE_LOG!" >> "%LOG%"
    >> "%LOG%" echo ```
    >> "%LOG%" echo.
    if "%HAS_SPIRV_VAL%"=="1" (
      >> "%LOG%" echo ### spirv-val Output
      >> "%LOG%" echo.
      >> "%LOG%" echo ```text
      if exist "!VALIDATE_LOG!" (
        type "!VALIDATE_LOG!" >> "%LOG%"
      )
      >> "%LOG%" echo ```
      >> "%LOG%" echo.
    )
  )
)

>> "%LOG%" echo ## Summary
>> "%LOG%" echo.
if "%FAIL%"=="0" (
  >> "%LOG%" echo - **Status:** SUCCESS
) else (
  >> "%LOG%" echo - **Status:** FAILED
)
>> "%LOG%" echo - **Total:** `%TOTAL%`
>> "%LOG%" echo - **Passed:** `%PASS%`
>> "%LOG%" echo - **Failed:** `%FAIL%`
>> "%LOG%" echo - **Compile Failures:** `%COMPILE_FAIL%`
>> "%LOG%" echo - **Validation Failures:** `%VALIDATION_FAIL%`
>> "%LOG%" echo - **Validation Skipped:** `%VALIDATION_SKIP%`
if not "%FAIL_LIST%"=="" (
  >> "%LOG%" echo - **Failed Files:** `%FAIL_LIST%`
)

rd /s /q "%TMPDIR%" >nul 2>nul
echo.
if "%FAIL%"=="0" (
  echo [ok] SPIR-V build success [%PASS%/%TOTAL%]
  popd >nul
  exit /b 0
) else (
  echo [error] SPIR-V build failed [%PASS% ok, %FAIL% failed]
  popd >nul
  exit /b 1
)
