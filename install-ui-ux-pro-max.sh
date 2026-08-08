#!/usr/bin/env bash
# Installs the "UI UX Pro Max" skill for Claude Code into this project.
# Repo: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
#
# Usage:
#   1. Open a terminal in this project folder (light-blue-react-template)
#   2. Run:  bash install-ui-ux-pro-max.sh
#
# Requires: Node.js/npm, and Python 3.x (used by the skill's search scripts).

set -e

echo "==> Checking prerequisites..."
if ! command -v npm >/dev/null 2>&1; then
  echo "npm not found. Install Node.js first: https://nodejs.org"
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 not found. Install Python first: https://www.python.org/downloads/"
  exit 1
fi

echo "==> Installing ui-ux-pro-max-cli globally..."
npm install -g ui-ux-pro-max-cli

echo "==> Initializing the skill for Claude..."
uipro init --ai claude

echo "==> Done. The skill is now in .claude/skills/ui-ux-pro-max/"
echo "    Restart Claude Code / Cowork so it picks up the new skill."
