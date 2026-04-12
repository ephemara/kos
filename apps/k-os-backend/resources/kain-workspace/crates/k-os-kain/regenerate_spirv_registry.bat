@echo off
setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..\..") do set "WORKSPACE_ROOT=%%~fI"
set "DOMAINS_DIR=%SCRIPT_DIR%domains"
set "SHARED_BUILD=%DOMAINS_DIR%\build_spirv.bat"

echo [k-os-kain] Rebuilding generated SPIR-V outputs...
for /d %%D in ("%DOMAINS_DIR%\*") do (
    if /I not "%%~nxD"=="generated" (
        echo [k-os-kain] Domain: %%~nxD
        call "%SHARED_BUILD%" "%%~fD"
        if errorlevel 1 exit /b 1
    )
)

echo [k-os-kain] Regenerating Rust/TS/JSON shader registries...
cargo build -p k-os-kain
if errorlevel 1 exit /b 1

echo [k-os-kain] Registry ready:
echo   %SCRIPT_DIR%generated\rust\spv_registry.rs
echo   %SCRIPT_DIR%generated\ts\spv_registry.ts
echo   %SCRIPT_DIR%generated\json\spv_registry.json
