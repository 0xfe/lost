#!/usr/bin/env bash
# Publish Lost with the same asset-first cache policy as Infinite Jungle.
set -euo pipefail

usage() {
  cat <<'HELP'
Usage: ./upload.sh [--dry-run] [--clean]

Build and upload to https://muthanna.com/lost/
Destination: gs://muthanna.com/lost/

  --dry-run  Build and print cloud commands without uploading or waiting.
  --clean    After publishing, wait 6 minutes for cached HTML/loading,
             then remove obsolete files only under /lost/.
  -h, --help Show this help.

Index: 5-minute cache. Hashed assets: 1-day cache.
Without --clean, previous assets are retained. Serialize uploads to /lost/.
Requires Node.js, npm dependencies and authenticated gcloud (except dry runs).
HELP
}

dry_run=false
clean=false
for argument in "$@"; do
  case "$argument" in
    --dry-run)
      if "$dry_run"; then usage >&2; exit 2; fi
      dry_run=true ;;
    --clean)
      if "$clean"; then usage >&2; exit 2; fi
      clean=true ;;
    -h|--help) usage; exit 0 ;;
    *) printf 'Unknown argument: %s\n' "$argument" >&2; usage >&2; exit 2 ;;
  esac
done

cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
destination='gs://muthanna.com/lost/'
if ! "$dry_run"; then
  command -v gcloud >/dev/null || { printf 'Install and authenticate the Google Cloud CLI first.\n' >&2; exit 1; }
fi
npm run build
# Freeze this release so another local build cannot mix files into the upload.
staging=$(mktemp -d "${TMPDIR:-/tmp}/lost-upload.XXXXXX")
trap 'rm -rf -- "$staging"' EXIT
mkdir "$staging/site"
cp -R dist/. "$staging/site/"
[[ -s "$staging/site/index.html" && -d "$staging/site/assets" ]] || {
  printf 'Incomplete build: index.html or assets missing.\n' >&2; exit 1;
}

run() {
  if "$dry_run"; then printf 'Would run: '; printf '%q ' "$@"; printf '\n';
  else "$@"; fi
}
asset_flags=(--recursive --checksums-only --predefined-acl=publicRead
  '--exclude=^(index\.html|\.build-manifest\.json)$'
  '--cache-control=public,max-age=86400,immutable'
  --gzip-in-flight=css,js,json,map,svg,txt)
printf 'Uploading assets to %s%s\n' "$destination" "$(if "$dry_run"; then printf ' (dry run)'; fi)"
run gcloud storage rsync "$staging/site/" "$destination" "${asset_flags[@]}"
run gcloud storage cp "$staging/site/index.html" "${destination}index.html" \
  --predefined-acl=publicRead \
  '--cache-control=public,max-age=300,must-revalidate' \
  --content-type=text/html --gzip-in-flight=html

if "$clean"; then
  printf 'Cleanup waits 360 seconds, then checks that the remote index still matches this release.\n'
  run sleep 360
  if "$dry_run"; then
    run gcloud storage cat "${destination}index.html"
    printf 'Would compare remote index with the staged release; skip cleanup if changed.\n'
  else
    gcloud storage cat "${destination}index.html" > "$staging/remote-index.html"
    if ! cmp -s "$staging/site/index.html" "$staging/remote-index.html"; then
      printf 'The remote index changed; skipping cleanup. Retry --clean for the current release.\n' >&2
      exit 1
    fi
  fi
  run gcloud storage rsync "$staging/site/" "$destination" "${asset_flags[@]}" \
    --delete-unmatched-destination-objects
fi
if "$dry_run"; then printf 'Dry run complete; no cloud changes made.\n';
else printf 'Published https://muthanna.com/lost/\n'; fi
