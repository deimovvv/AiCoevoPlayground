@echo off
REM ─────────────────────────────────────────────────────────────
REM Coevo Studio - doble-click launcher (Windows)
REM Abre el backend (:8000) y el frontend (:5173) en dos ventanas.
REM Cerra las dos ventanas para frenar los servidores.
REM Requisito (una sola vez): venv del backend + npm install (ver docs\setup.md).
REM ─────────────────────────────────────────────────────────────
cd /d "%~dp0"

start "Coevo Backend" cmd /k "cd backend && (if exist .venv\Scripts\activate.bat call .venv\Scripts\activate.bat) && python -m uvicorn main:app --reload --port 8000"
start "Coevo Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo   Backend   -^> http://localhost:8000
echo   Frontend  -^> http://localhost:5173
echo.
echo   Se abrieron dos ventanas (backend y frontend).
echo   Cerralas para frenar los servidores.
echo.
pause
