@echo off
REM Build script for DocGen standalone executable
REM Creates a single-file executable that can be placed anywhere in PATH
REM Target: Windows 10/11, optimized for universal utility

echo ========================================
echo DocGen Standalone Executable Builder
echo ========================================
echo.

REM Check if PyInstaller is installed
python -c "import PyInstaller" 2>nul
if errorlevel 1 (
    echo [INFO] Installing PyInstaller...
    pip install pyinstaller
    if errorlevel 1 (
        echo [ERROR] Failed to install PyInstaller
        exit /b 1
    )
)

REM Check if required dependencies are installed
echo [INFO] Checking dependencies...
python -c "import lancedb, sentence_transformers, aiohttp, watchdog" 2>nul
if errorlevel 1 (
    echo [INFO] Installing dependencies from requirements.txt...
    pip install -r requirements.txt
    if errorlevel 1 (
        echo [ERROR] Failed to install dependencies
        exit /b 1
    )
)

REM Create dist directory if it doesn't exist
if not exist "dist" mkdir dist

REM Clean previous builds
echo [INFO] Cleaning previous builds...
if exist "build" rmdir /s /q build
if exist "dist\docgen.exe" del /q dist\docgen.exe
if exist "docgen.spec" del /q docgen.spec

echo [INFO] Building executable with PyInstaller...
echo [INFO] This may take several minutes...
echo.

REM Build with optimized settings for universal deployment
pyinstaller ^
    --name=docgen ^
    --onefile ^
    --console ^
    --clean ^
    --noconfirm ^
    --optimize=2 ^
    --strip ^
    --add-data="docgen_config.json;." ^
    --add-data=".env.local;." ^
    --hidden-import=lancedb ^
    --hidden-import=sentence_transformers ^
    --hidden-import=aiohttp ^
    --hidden-import=watchdog ^
    --hidden-import=numpy ^
    --hidden-import=transformers ^
    --hidden-import=torch ^
    --hidden-import=dotenv ^
    --collect-submodules=sentence_transformers ^
    --collect-submodules=transformers ^
    --collect-submodules=torch ^
    --exclude-module=matplotlib ^
    --exclude-module=scipy ^
    --exclude-module=pandas ^
    --exclude-module=jupyter ^
    --exclude-module=notebook ^
    __main__.py

if errorlevel 1 (
    echo [ERROR] PyInstaller build failed
    exit /b 1
)

REM Check if executable was created
if not exist "dist\docgen.exe" (
    echo [ERROR] Executable not found in dist\docgen.exe
    exit /b 1
)

REM Get executable size
for %%A in (dist\docgen.exe) do set size=%%~zA
set /a size_mb=%size% / 1048576

echo.
echo ========================================
echo Build Complete!
echo ========================================
echo Executable: dist\docgen.exe
echo Size: %size_mb% MB
echo.

echo [SUCCESS] Standalone executable ready for deployment!
echo.
echo Usage Examples:
echo   docgen generate --path ./my-project
echo   docgen update-index --full-reindex
echo   docgen index-stats
echo   docgen mcp-server
echo.
echo To add to PATH:
echo   1. Copy dist\docgen.exe to a directory in your PATH
echo   2. Or add the dist\ directory to your PATH environment variable
echo.

REM Test the executable
echo [INFO] Testing executable...
dist\docgen.exe --help >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Executable test failed - may have missing dependencies
) else (
    echo [SUCCESS] Executable test passed!
)

echo.
echo ========================================
echo Ready for universal deployment!
echo ========================================
