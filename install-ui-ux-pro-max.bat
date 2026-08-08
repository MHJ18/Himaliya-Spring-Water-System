@echo off
REM Installs the "UI UX Pro Max" skill for Claude Code into this project.
REM Repo: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
REM
REM Usage:
REM   1. Open Command Prompt in this project folder (light-blue-react-template)
REM   2. Run: install-ui-ux-pro-max.bat
REM
REM Requires: Node.js/npm, and Python 3.x (used by the skill's search scripts).

where npm >nul 2>nul
if errorlevel 1 (
    echo npm not found. Install Node.js first: https://nodejs.org
    exit /b 1
)

where python >nul 2>nul
if errorlevel 1 (
    echo python not found. Install Python first: https://www.python.org/downloads/
    exit /b 1
)

echo ==^> Installing ui-ux-pro-max-cli globally...
call npm install -g ui-ux-pro-max-cli
if errorlevel 1 exit /b 1

echo ==^> Initializing the skill for Claude...
call uipro init --ai claude
if errorlevel 1 exit /b 1

echo ==^> Done. The skill is now in .claude\skills\ui-ux-pro-max\
echo     Restart Claude Code / Cowork so it picks up the new skill.
pause
