@echo off
setlocal
set ROOT=%~dp0

echo Installing backend...
cd /d "%ROOT%backend" && npm install

echo Installing frontend...
cd /d "%ROOT%frontend" && npm install

echo.
echo Starting backend on port 3001...
start "Backend" cmd /k "cd /d "%ROOT%backend" && node server.js"

timeout /t 3 >nul

echo Starting frontend on port 5173...
start "Frontend" cmd /k "cd /d "%ROOT%frontend" && npx vite --port 5173"

timeout /t 4 >nul

echo Opening browser...
start http://localhost:5173

echo.
echo ================================================
echo  App:  http://localhost:5173
echo  API:  http://localhost:3001
echo  Close the two terminal windows to stop.
echo ================================================
pause
