# Uploading Lost

`./upload.sh` builds the site and uploads to **gs://muthanna.com/lost/**, for **https://muthanna.com/lost/**. It adapts Infinite Jungle's root uploader, using the same bucket, public-read object ACLs, asset-first ordering and cache policies. It does not modify Jungle or the bucket's other prefixes.

```sh
npm ci
./upload.sh --dry-run
./upload.sh
./upload.sh --clean
./upload.sh --help
# Equivalent npm entry point:
npm run upload -- --dry-run
```

Dry runs build and print commands without invoking gcloud or waiting. Normal uploads need an authenticated Google Cloud CLI with write access and the bucket's existing public-read ACL configuration. The script does not configure IAM, DNS, website routing or CDN policies. The host must serve directory URLs as `index.html`; relative asset URLs support `/lost/`.

| Objects | Cache-Control |
| --- | --- |
| Hashed JavaScript, CSS, atlas, audio and maps | `public,max-age=86400,immutable` |
| `index.html` | `public,max-age=300,must-revalidate` |

The script runs `npm run build` and freezes `dist/` in a temporary directory. The normal build verifies source assets/audio, typechecks and creates content-hashed files. Asset transfer uses [gcloud storage rsync](https://docs.cloud.google.com/sdk/gcloud/reference/storage/rsync) with checksum comparison and no deletion by default. HTML is excluded from that phase and always copied last using [gcloud storage cp](https://docs.cloud.google.com/sdk/gcloud/reference/storage/cp), setting its content type and short cache lifetime. Text uploads use in-flight gzip; PNG and WAV files are not recompressed. Any failed build or asset transfer stops publication before HTML changes. Temporary staging is removed on exit.

`--clean` waits 360 seconds after publication: the five-minute HTML TTL plus a loading grace period. It then compares the remote index with the staged one. If they differ, cleanup aborts; otherwise it removes obsolete objects strictly under `gs://muthanna.com/lost/`. The HTML exclusion preserves its separate cache metadata. Very old open/background clients may need to reload after cleanup.

Serialize uploads to this prefix. The remote-index comparison detects a competing completed release, but is not a distributed lock. Without `--clean`, old assets stay available to cached pages.

The older `npm run deploy -- [--dry-run] gs://BUCKET/path` remains a generic uploader. It runs the full check suite, uses a one-year immutable asset cache and never prunes; use the root uploader for parity with Jungle.

## Validation

`tests/upload.test.ts` uses an isolated fixture and recording-only npm/gcloud/sleep commands. It checks the exact destination, cache settings, order, dry-run behavior, argument errors, staging isolation, cleanup delay and scope, changed remote index, and build/transfer failures. No test contacts GCP. `bash -n upload.sh` checks shell syntax. A real dry run exercises the build and staging without publishing.

For a local subdirectory preview: `BASE_PATH=/lost/ PORT=4180 npm run serve -- --cache`, then open `http://localhost:4180/lost/`. Live cloud routing and response headers require verification after an explicitly requested deployment.
