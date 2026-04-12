@echo off
setlocal EnableExtensions EnableDelayedExpansion
call "%~dp0..\build_spirv.bat" "%~dp0"
exit /b %errorlevel%
