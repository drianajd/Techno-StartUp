@echo off
setlocal
cd /d "%~dp0"

rem Relaunch hidden (no cmd window). Output goes to run-log.txt / run-err.txt.
if /i not "%~1"=="child" (
    powershell -NoProfile -Command "Start-Process cmd.exe -ArgumentList '/c','%~f0','child' -WindowStyle Hidden -RedirectStandardOutput '%~dp0run-log.txt' -RedirectStandardError '%~dp0run-err.txt'"
    exit /b 0
)

set "WAMP_EXE=C:\wamp64\wampmanager.exe"
set "RADMIN_EXE=C:\Program Files (x86)\Radmin VPN\RvRvpnGui.exe"

echo ==========================================
echo Techno-StartUp
echo ==========================================
echo.

if not exist "%WAMP_EXE%" goto :wamp_missing
if not exist "%RADMIN_EXE%" goto :radmin_missing

echo Stopping any previous instance...
powershell -NoProfile -Command "$me=$PID; $pp=(Get-CimInstance Win32_Process -Filter \"ProcessId=$me\").ParentProcessId; Get-NetTCPConnection -LocalPort 5500 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { $c=Get-CimInstance Win32_Process -Filter \"ProcessId=$($_.OwningProcess)\"; $par=$c.ParentProcessId; Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue; $pc=Get-CimInstance Win32_Process -Filter \"ProcessId=$par\" -ErrorAction SilentlyContinue; while($pc -and $pc.Name -in 'cmd.exe','node.exe','npm.cmd') { if($pc.ProcessId -eq $pp){break}; $next=$pc.ParentProcessId; Stop-Process -Id $pc.ProcessId -Force -ErrorAction SilentlyContinue; $pc=Get-CimInstance Win32_Process -Filter \"ProcessId=$next\" -ErrorAction SilentlyContinue } }"
timeout /t 2 /nobreak >nul
echo.

echo Starting WampServer...
start "" "%WAMP_EXE%"
echo Starting Radmin VPN...
start "" "%RADMIN_EXE%"
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or is not on PATH.
    echo Install Node.js LTS, then reopen this file.
    goto :failed
)

where npm >nul 2>&1
if errorlevel 1 (
    echo ERROR: npm is not installed or is not on PATH.
    echo Install Node.js LTS, then reopen this file.
    goto :failed
)

if not exist ".env" (
    echo ERROR: The .env configuration file was not found.
    echo Copy .env.example to .env and configure the database and session secret.
    goto :failed
)

echo Waiting for WampServer MySQL on port 3306...
powershell -NoProfile -Command "$deadline = (Get-Date).AddSeconds(60); do { $client = New-Object System.Net.Sockets.TcpClient; try { $result = $client.BeginConnect('127.0.0.1', 3306, $null, $null); if ($result.AsyncWaitHandle.WaitOne(1000) -and $client.Connected) { $client.Close(); exit 0 } } catch {} finally { $client.Close() }; Start-Sleep -Seconds 2 } while ((Get-Date) -lt $deadline); exit 1"
if errorlevel 1 (
    echo ERROR: MySQL did not start on port 3306 within 60 seconds.
    echo Check the WampServer tray icon and confirm its MySQL service is running.
    goto :failed
)

if not exist "node_modules\express" (
    echo Installing project dependencies for the first run...
    call npm ci
    if errorlevel 1 (
        echo.
        echo ERROR: Dependency installation failed.
        goto :failed
    )
)

if not exist "node_modules\nodemailer" (
    echo Installing project dependencies for the first run...
    call npm ci
    if errorlevel 1 (
        echo.
        echo ERROR: Dependency installation failed.
        goto :failed
    )
)

echo Starting the server. Keep this window open while using the app.
echo On this PC: http://localhost:5500
echo Over Radmin VPN: http://26.205.99.251:5500
echo.
call npm start

echo.
echo The server has stopped. Review any errors shown above.

:failed
echo.
exit /b 1

:wamp_missing
echo ERROR: WampServer was not found at:
echo %WAMP_EXE%
echo Edit WAMP_EXE near the top of run.bat if it is installed elsewhere.
goto :failed

:radmin_missing
echo ERROR: Radmin VPN was not found at:
echo %RADMIN_EXE%
echo Edit RADMIN_EXE near the top of run.bat if it is installed elsewhere.
goto :failed
