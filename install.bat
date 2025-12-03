@echo off
title TAMS Backend Service
cls

echo ======================================================
echo    Checking System Environment...
echo ======================================================

:: 1. Check if Node.js is installed
node -v >nul 2>&1
if %errorlevel% neq 0 (
    color 4f
    echo [ERROR] Node.js is NOT installed!
    echo.
    echo Please install Node.js from: https://nodejs.org/
    echo After installing, please run this file again.
    echo.
    pause
    exit
)

:: 2. Check if libraries are installed (check node_modules folder)
if not exist "node_modules" (
    echo.
    echo [First Run Detected] Installing necessary libraries...
    echo This may take a minute. Please wait...
    echo.
    call npm install
    if %errorlevel% neq 0 (
        color 4f
        echo [ERROR] Installation failed. Please check internet connection.
        pause
        exit
    )
)

:: 3. Start the Server
echo.
echo ======================================================
echo    Starting Server...
echo    Do NOT close this window while using the website.
echo ======================================================
echo.

:: Run the server
node server.js

:: If server crashes or stops, keep window open to see error
echo.
echo ======================================================
echo    Server stopped.
echo ======================================================
pause