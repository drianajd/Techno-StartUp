@echo off
echo ==================================
echo Installing Node.js dependencies
echo ==================================

npm install express dotenv mysql2 bcrypt express-session express-mysql-session body-parser cors node-cron nodemailer

echo.
echo ==================================
echo Checking Python / pip
echo ==================================

REM Detect pip
pip --version >nul 2>&1
IF %ERRORLEVEL%==0 (
    set PIPCMD=pip
) ELSE (
    python -m pip --version >nul 2>&1
    IF %ERRORLEVEL%==0 (
        set PIPCMD=python -m pip
    ) ELSE (
        py -m pip --version >nul 2>&1
        IF %ERRORLEVEL%==0 (
            set PIPCMD=py -m pip
        ) ELSE (
            echo ❌ ERROR: pip is not available!
            exit /b
        )
    )
)

echo.
echo Installing Python packages using %PIPCMD%...
%PIPCMD% install --upgrade pip
%PIPCMD% install requests beautifulsoup4 playwright

echo.
echo Installing Playwright browsers...
py -m playwright install >nul 2>&1
IF %ERRORLEVEL%==0 goto done
python -m playwright install >nul 2>&1
IF %ERRORLEVEL%==0 goto done

echo ❌ Failed to install Playwright browsers! Try manually:
echo   py -m playwright install
echo or
echo   python -m playwright install
exit /b

:done
echo ✅ All installations complete!