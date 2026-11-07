#!/bin/zsh
set -e
cd -- "$(dirname -- "$0")"
if ! command -v npm >/dev/null 2>&1; then
  print 'Install Node.js 22.18 or newer, then open this file again.'
  read -r '?Press Return to close. '
  exit 1
fi
npm run demo
