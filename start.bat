@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [SQL Sandbox] Node.js не найден.
  echo Установите Node.js LTS версии 22: https://nodejs.org/
  echo После установки закройте это окно и запустите start.bat снова.
  pause
  exit /b 1
)

for /f %%v in ('node -p "process.versions.node.split('.')[0]"') do set NODE_MAJOR=%%v
if not "%NODE_MAJOR%"=="22" (
  echo [SQL Sandbox] Найдена Node.js major-версии %NODE_MAJOR%, а нужна 22 LTS.
  echo Установите Node.js 22 LTS: https://nodejs.org/
  pause
  exit /b 1
)

if not exist node_modules (
  echo [SQL Sandbox] Первый запуск: устанавливаю зависимости...
  call npm install
  if errorlevel 1 (
    echo [SQL Sandbox] npm install завершился с ошибкой. Текст ошибки выше.
    pause
    exit /b 1
  )
)

echo [SQL Sandbox] Запускаю приложение. Браузер откроется автоматически.
call npm run dev -- --open
if errorlevel 1 pause
