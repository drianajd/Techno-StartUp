@echo off
echo ==================================
echo Installing Playwright Browsers
echo ==================================

REM Try using py
py -m playwright install
IF %ERRORLEVEL%==0 (
    echo ✅ Playwright browsers installed using py
    pause
    exit /b
)

REM Try using python
python -m playwright install
IF %ERRORLEVEL%==0 (
    echo ✅ Playwright browsers installed using python
    pause
    exit /b
)

echo ❌ Failed to install Playwright browsers!
echo.
echo Try running manually:
echo   py -m playwright install
echo or
echo   python -m playwright install
echo.
pause
