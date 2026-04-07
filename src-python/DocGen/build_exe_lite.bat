@echo off
REM Build script for DocGen LITE standalone executable
REM Lightweight version WITHOUT PyTorch, CUDA, LanceDB, or embeddings
REM Just pure LLM-powered README generation - fast builds, small size

echo ========================================
echo DocGen LITE Executable Builder
echo ========================================
echo [INFO] Building lightweight version without ML dependencies
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

REM Create dist directory if it doesn't exist
if not exist "dist" mkdir dist

REM Clean previous builds
echo [INFO] Cleaning previous builds...
if exist "build" rmdir /s /q build
if exist "dist\docgen-lite.exe" del /q dist\docgen-lite.exe
if exist "docgen-lite.spec" del /q docgen-lite.spec

echo [INFO] Building LITE executable (no PyTorch/CUDA/LanceDB)...
echo [INFO] This should be much faster...
echo.

REM Build with minimal dependencies - exclude all ML libraries
pyinstaller ^
    --name=docgen-lite ^
    --onefile ^
    --console ^
    --clean ^
    --noconfirm ^
    --optimize=2 ^
    --strip ^
    --add-data="docgen_config.json;." ^
    --add-data=".env.local;." ^
    --hidden-import=aiohttp ^
    --hidden-import=watchdog ^
    --hidden-import=dotenv ^
    --exclude-module=torch ^
    --exclude-module=transformers ^
    --exclude-module=sentence_transformers ^
    --exclude-module=lancedb ^
    --exclude-module=onnxruntime ^
    --exclude-module=numpy ^
    --exclude-module=scipy ^
    --exclude-module=pandas ^
    --exclude-module=matplotlib ^
    --exclude-module=tensorflow ^
    --exclude-module=keras ^
    --exclude-module=PIL ^
    --exclude-module=cv2 ^
    __main__.py

if errorlevel 1 (
    echo [ERROR] PyInstaller build failed
    exit /b 1
)

REM Check if executable was created
if not exist "dist\docgen-lite.exe" (
    echo [ERROR] Executable not found in dist\docgen-lite.exe
    exit /b 1
)

REM Get executable size
for %%A in (dist\docgen-lite.exe) do set size=%%~zA
set /a size_mb=%size% / 1048576

echo.
echo ========================================
echo Build Complete!
echo ========================================
echo Executable: dist\docgen-lite.exe
echo Size: %size_mb% MB (LITE version)
echo.

echo [SUCCESS] Lightweight executable ready!
echo.
echo Features:
echo   [x] LLM-powered README generation
echo   [x] Change detection
echo   [x] Cost tracking
echo   [ ] Semantic search (disabled)
echo   [ ] Embedding index (disabled)
echo   [ ] GPU acceleration (disabled)
echo.
echo Usage:
echo   docgen-lite generate --path ./my-project
echo   docgen-lite generate --dry-run
echo.
echo Note: This version does NOT support:
echo   - update-index command
echo   - index-stats command
echo   - Semantic similarity search
echo.

REM Test the executable
echo [INFO] Testing executable...
dist\docgen-lite.exe generate --help >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Executable test failed
) else (
    echo [SUCCESS] Executable test passed!
)

echo.
echo ========================================
echo Ready for deployment!
echo ========================================