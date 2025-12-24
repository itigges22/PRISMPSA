@echo off
REM MovaLab First-Time Setup Script (Windows CMD/Batch)
REM This script detects the best shell and runs the appropriate setup script

setlocal enabledelayedexpansion

echo.
echo ========================================
echo MovaLab First-Time Setup
echo ========================================
echo.
echo Detecting best shell environment...
echo.

REM Check if we're in PowerShell (unlikely since this is .cmd)
REM Check if Git Bash is available
where bash >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Found: Git Bash
    set BASH_AVAILABLE=1
) else (
    set BASH_AVAILABLE=0
)

REM Check if PowerShell is available (it always should be on Windows)
where powershell >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Found: PowerShell
    set PS_AVAILABLE=1
) else (
    set PS_AVAILABLE=0
)

echo.

REM Prefer PowerShell for Windows since it's native and handles paths better
if %PS_AVAILABLE% EQU 1 (
    echo Running setup with PowerShell...
    echo.
    powershell -ExecutionPolicy Bypass -File "%~dp0first-time-setup.ps1"
    goto :end
)

REM Fallback to Git Bash if PowerShell not available
if %BASH_AVAILABLE% EQU 1 (
    echo Running setup with Git Bash...
    echo.
    bash "%~dp0first-time-setup.sh"
    goto :end
)

REM No suitable shell found
echo ERROR: Neither PowerShell nor Git Bash found.
echo.
echo Please install one of the following:
echo   - PowerShell (usually pre-installed on Windows)
echo   - Git for Windows (includes Git Bash): https://git-scm.com/download/win
echo.
pause
exit /b 1

:end
echo.
pause
