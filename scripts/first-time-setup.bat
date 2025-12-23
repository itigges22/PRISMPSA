@echo off
REM MovaLab First-Time Setup for Windows
REM This batch file launches the bash script in Git Bash and keeps the window open

echo ========================================
echo MovaLab First-Time Setup (Windows)
echo ========================================
echo.

REM Find Git Bash executable (avoid WSL bash)
set "GIT_BASH="

REM Try common Git Bash installation paths
if exist "%PROGRAMFILES%\Git\bin\bash.exe" (
    set "GIT_BASH=%PROGRAMFILES%\Git\bin\bash.exe"
) else if exist "%PROGRAMFILES(X86)%\Git\bin\bash.exe" (
    set "GIT_BASH=%PROGRAMFILES(X86)%\Git\bin\bash.exe"
) else if exist "%LOCALAPPDATA%\Programs\Git\bin\bash.exe" (
    set "GIT_BASH=%LOCALAPPDATA%\Programs\Git\bin\bash.exe"
) else (
    REM Try to find bash.exe in PATH (last resort)
    where bash.exe >nul 2>nul
    if %errorlevel% equ 0 (
        for /f "tokens=*" %%i in ('where bash.exe ^| findstr /i "Git\\bin\\bash.exe"') do (
            set "GIT_BASH=%%i"
        )
    )
)

REM Check if Git Bash was found
if "%GIT_BASH%"=="" (
    echo ERROR: Git Bash is not installed
    echo.
    echo Please install Git for Windows from:
    echo https://gitforwindows.org/
    echo.
    echo Make sure to use the default installation path.
    echo.
    pause
    exit /b 1
)

echo Found Git Bash: %GIT_BASH%
echo Starting setup...
echo.

REM Run the bash script with Git Bash (not WSL bash)
REM Note: Removed -i flag to avoid "stdout is not a tty" errors in CMD/PowerShell
"%GIT_BASH%" --login "%~dp0first-time-setup.sh"

REM Check if script succeeded
if %errorlevel% neq 0 (
    echo.
    echo ========================================
    echo Setup encountered an error!
    echo ========================================
    echo.
    echo Please check the error messages above.
    echo.
    echo Common fixes:
    echo   1. Make sure Docker Desktop is running
    echo   2. Run this script as Administrator if needed
    echo   3. Check the troubleshooting guide:
    echo      docs/implementation/TESTING-REPORT.md
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo Setup completed successfully!
echo ========================================
echo.
echo Next steps:
echo   1. Run: npm run dev
echo   2. Open: http://localhost:3000
echo   3. Login: superadmin@test.local / Test1234!
echo.
pause
