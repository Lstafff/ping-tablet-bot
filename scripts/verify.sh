#!/usr/bin/env sh
set -eu

PYTHONPYCACHEPREFIX="${PYTHONPYCACHEPREFIX:-/private/tmp/tennis-bot-pyc}" \
  python3 -m unittest discover -s tests

node web/primitives/scripts/check-color-tokens.mjs
node web/primitives/scripts/check-typography-tokens.mjs
node web/primitives/scripts/generate-layout-tokens.mjs --check
node web/primitives/scripts/generate-react-icons.mjs --check

cd web
npm run build
