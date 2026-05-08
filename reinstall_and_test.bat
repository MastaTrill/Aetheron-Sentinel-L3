@echo off
REM Automated script for dependency reinstall and Hardhat test run
REM Ensure you have installed Node.js v20.x before running this script

REM Remove node_modules and package-lock.json for a clean install
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del /q package-lock.json

REM Install dependencies with legacy peer deps
npm install --legacy-peer-deps
if %errorlevel% neq 0 (
    echo [ERROR] npm install failed. Exiting.
    exit /b %errorlevel%
)

REM Run Hardhat tests
npx hardhat test
if %errorlevel% neq 0 (
    echo [ERROR] Hardhat tests failed.
    exit /b %errorlevel%
)

echo [SUCCESS] Dependencies installed and tests passed!