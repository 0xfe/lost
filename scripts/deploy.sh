#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
dry_run=false
if [[ "${1:-}" == "--dry-run" ]]; then dry_run=true; shift; fi
destination="${1:-}"
if [[ $# != 1 || ! "$destination" =~ ^gs://[a-zA-Z0-9._-]+(/[a-zA-Z0-9._-]+)*/*$ ]]; then
  echo 'Usage: npm run deploy -- [--dry-run] gs://BUCKET/path' >&2
  exit 2
fi
destination="${destination%/}"
npm run check
assets=(gcloud storage rsync dist/assets "$destination/assets" --recursive --cache-control 'public,max-age=31536000,immutable')
html=(gcloud storage cp dist/index.html "$destination/index.html" --cache-control 'public,max-age=300,must-revalidate')
if "$dry_run"; then
  printf 'Assets first: '; printf '%q ' "${assets[@]}"; printf '\n'
  printf 'HTML last: '; printf '%q ' "${html[@]}"; printf '\n'
else
  command -v gcloud >/dev/null || { echo 'Install and authenticate gcloud before deploying.' >&2; exit 1; }
  "${assets[@]}"
  "${html[@]}"
fi
