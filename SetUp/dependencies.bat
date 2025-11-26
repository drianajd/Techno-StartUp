@echo off
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
            echo Install Python from https://www.python.org/
            echo Make sure to check "Add Python to PATH"
            pause
            exit /b
        )
    )
)

echo.
echo ==================================
echo Installing Python packages
echo Using: %PIPCMD%
echo ==================================

%PIPCMD% install --upgrade pip
%PIPCMD% install requests beautifulsoup4 playwright

echo.
echo ==================================
echo Running Playwright browser installer...
echo ==================================

REM Call the separate Playwright installer batch file
call install_playwright_browsers.bat

echo.
echo ==================================
echo Installing Node.js dependencies
echo ==================================

npm install express dotenv mysql2 bcrypt express-session express-mysql-session body-parser cors node-cron nodemailer

echo.
echo ✅ Node.js dependencies installation complete!
echo.
echo ✅ All installations complete!
pause