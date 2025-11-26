@echo off
echo ==================================
echo Installing Node.js dependencies
echo ==================================

npm install express dotenv mysql2 bcrypt express-session express-mysql-session body-parser cors node-cron nodemailer

echo.
echo ==================================
echo Checking Python / pip
echo ==================================

REM Check if pip works
pip --version >nul 2>&1
IF %ERRORLEVEL%==0 (
    echo pip detected!
    set PIPCMD=pip
) ELSE (
    echo pip not detected, trying python -m pip...
    python -m pip --version >nul 2>&1
    IF %ERRORLEVEL%==0 (
        echo Using python -m pip
        set PIPCMD=python -m pip
    ) ELSE (
        echo Trying py -m pip...
        py -m pip --version >nul 2>&1
        IF %ERRORLEVEL%==0 (
            echo Using py -m pip
            set PIPCMD=py -m pip
        ) ELSE (
            echo.
            echo ❌ ERROR: pip is not available!
            echo Install Python from https://www.python.org/
            echo Make sure to check "Add Python to PATH"
            echo.
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

%PIPCMD% install requests beautifulsoup4 playwright

echo.
echo Installing Playwright browsers...

%PIPCMD% install playwright

%PIPCMD% run playwright install

py -m playwright install

echo.
echo ✅ All installations complete!
pause
