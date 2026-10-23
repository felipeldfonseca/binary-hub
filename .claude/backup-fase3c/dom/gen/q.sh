#!/usr/bin/env bash
# Runs one SQL file on the throwaway cluster of gen/ (port 25432). Never the hosted project.
#   bash q.sh <file.sql>
set -euo pipefail
export LC_ALL=C LANG=C PGOPTIONS='-c timezone=UTC'
exec /opt/homebrew/opt/postgresql@15/bin/psql postgres://postgres@127.0.0.1:25432/postgres -X -q -t -A -v ON_ERROR_STOP=1 -f "$1"
