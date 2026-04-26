@echo off
setlocal

REM Launch the PowerShell startup script without requiring users to change
REM their machine-wide execution policy.
powershell -ExecutionPolicy Bypass -File "%~dp0start-postgres.ps1"

