@echo off
REM MovaLab First-Time Setup for Windows
REM This batch file launches the bash script in Git Bash and keeps the window open

echo ========================================
echo MovaLab First-Time Setup (Windows)
echo ========================================
echo.

REM Check if Git Bash is installed
where bash >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Git Bash is not installed or not in PATH
    echo.
    echo Please install Git for Windows from:
    echo https://gitforwindows.org/
    echo.
    echo Make sure to check "Add Git Bash to PATH" during installation.
    echo.
    pause
    exit /b 1
)

echo Found Git Bash! Starting setup...
echo.

REM Run the bash script with Git Bash and keep window open
bash --login -i "%~dp0first-time-setup.sh"

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
