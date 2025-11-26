@echo off
echo ==================================
echo Installing Playwright Browsers
echo ==================================
echo.

REM Try using py -3.11 
echo Trying: py -3.11 -m playwright install
py -3.11 -m playwright install
IF %ERRORLEVEL%==0 (
    echo.
    echo ✅ Playwright browsers installed successfully using py -3.11
    goto :end
)

REM Try using py
echo.
echo Trying: py -m playwright install
py -m playwright install
IF %ERRORLEVEL%==0 (
    echo.
    echo ✅ Playwright browsers installed successfully using py
    goto :end
)

REM Try using python
echo.
echo Trying: python -m playwright install
python -m playwright install
IF %ERRORLEVEL%==0 (
    echo.
    echo ✅ Playwright browsers installed successfully using python
    goto :end
)

REM Try using playwright directly
echo.
echo Trying: playwright install
playwright install
IF %ERRORLEVEL%==0 (
    echo.
    echo ✅ Playwright browsers installed successfully
    goto :end
)

echo.
echo ❌ Could not install Playwright browsers
echo Please run manually: py -3.11 -m playwright install

:end
echo.
exit /b 0