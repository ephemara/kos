@echo off
REM DocGen Quick Launcher
REM Usage: run_docgen.bat <command> [options]
REM Example: run_docgen.bat update-index --path M:\K_OS\src-mocap\features

cd /d "%~dp0"
python __main__.py %*
