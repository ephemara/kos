@echo off
REM DocGen CLI Wrapper for Windows
REM Add this file's directory to your PATH to use 'docgen' from anywhere

python "%~dp0docgen.py" %*
